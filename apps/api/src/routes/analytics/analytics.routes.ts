import { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../../plugins/auth.plugin';
import { supabase } from '@salesbuddy/db';
import { DealRepository } from '@salesbuddy/db';
import { todayStartISO } from '@salesbuddy/shared-utils';

const dealRepo = new DealRepository();

export const analyticsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /analytics/pipeline — deals grouped by stage with total values
  fastify.get(
    '/pipeline',
    { preHandler: authenticate },
    async (request, reply) => {
      try {
        const stats = await dealRepo.getPipelineStats(request.workspaceId);
        return reply.send({ pipeline: stats });
      } catch (err) {
        fastify.log.error(err);
        return reply
          .status(500)
          .send({ error: 'Failed to fetch pipeline analytics', code: 'ANALYTICS_ERROR' });
      }
    },
  );

  // GET /analytics/outreach — sequence performance metrics
  fastify.get(
    '/outreach',
    { preHandler: authenticate },
    async (request, reply) => {
      const { data: sequences, error: seqErr } = await supabase
        .from('sequences')
        .select('id, name')
        .eq('workspace_id', request.workspaceId)
        .neq('status', 'archived');

      if (seqErr) {
        fastify.log.error(seqErr);
        return reply
          .status(500)
          .send({ error: 'Failed to fetch outreach analytics', code: 'ANALYTICS_ERROR' });
      }

      const seqIds = (sequences ?? []).map((s: { id: string }) => s.id);
      if (seqIds.length === 0) {
        return reply.send({ outreach: [] });
      }

      const { data: enrollments, error: enrErr } = await supabase
        .from('enrollments')
        .select('sequence_id, status')
        .eq('workspace_id', request.workspaceId)
        .in('sequence_id', seqIds);

      if (enrErr) {
        fastify.log.error(enrErr);
        return reply
          .status(500)
          .send({ error: 'Failed to fetch enrollment data', code: 'ANALYTICS_ERROR' });
      }

      const { data: activities, error: actErr } = await supabase
        .from('activities')
        .select('type, metadata')
        .eq('workspace_id', request.workspaceId)
        .in('type', ['email_sent', 'email_opened', 'email_replied', 'meeting']);

      if (actErr) {
        fastify.log.error(actErr);
        return reply
          .status(500)
          .send({ error: 'Failed to fetch activity data', code: 'ANALYTICS_ERROR' });
      }

      // Aggregate per sequence
      const enrollMap: Record<string, { enrolled: number; completed: number }> = {};
      for (const e of enrollments ?? []) {
        const sid = e.sequence_id as string;
        enrollMap[sid] = enrollMap[sid] ?? { enrolled: 0, completed: 0 };
        enrollMap[sid].enrolled++;
        if (e.status === 'completed') enrollMap[sid].completed++;
      }

      const activityMap: Record<string, number> = { email_sent: 0, email_opened: 0, email_replied: 0, meeting: 0 };
      for (const a of activities ?? []) {
        activityMap[a.type as string] = (activityMap[a.type as string] ?? 0) + 1;
      }

      const outreach = (sequences ?? []).map((seq: { id: string; name: string }) => {
        const agg = enrollMap[seq.id] ?? { enrolled: 0, completed: 0 };
        const sent = activityMap['email_sent'] ?? 0;
        const replied = activityMap['email_replied'] ?? 0;
        return {
          sequence_id: seq.id,
          sequence_name: seq.name,
          enrolled: agg.enrolled,
          sent,
          opened: activityMap['email_opened'] ?? 0,
          replied,
          meetings_booked: activityMap['meeting'] ?? 0,
          open_rate: sent > 0 ? Math.round(((activityMap['email_opened'] ?? 0) / sent) * 100) : 0,
          reply_rate: sent > 0 ? Math.round((replied / sent) * 100) : 0,
        };
      });

      return reply.send({ outreach });
    },
  );

  // GET /analytics/forecast — weighted pipeline forecast
  fastify.get(
    '/forecast',
    { preHandler: authenticate },
    async (request, reply) => {
      const { data: deals, error } = await supabase
        .from('deals')
        .select('stage_id, value, probability')
        .eq('workspace_id', request.workspaceId)
        .is('deleted_at', null)
        .is('won_at', null)
        .is('lost_at', null);

      if (error) {
        fastify.log.error(error);
        return reply
          .status(500)
          .send({ error: 'Failed to fetch forecast data', code: 'ANALYTICS_ERROR' });
      }

      const stageMap: Record<string, { weighted_value: number; deal_count: number }> = {};
      let total_weighted = 0;

      for (const deal of deals ?? []) {
        const sid = deal.stage_id as string;
        const value = (deal.value ?? 0) as number;
        const prob = ((deal.probability ?? 50) as number) / 100;
        const weighted = value * prob;

        stageMap[sid] = stageMap[sid] ?? { weighted_value: 0, deal_count: 0 };
        stageMap[sid].weighted_value += weighted;
        stageMap[sid].deal_count++;
        total_weighted += weighted;
      }

      const forecast = Object.entries(stageMap).map(([stage_id, agg]) => ({
        stage_name: stage_id,
        weighted_value: Math.round(agg.weighted_value),
        deal_count: agg.deal_count,
      }));

      return reply.send({
        forecast,
        total_weighted_pipeline: Math.round(total_weighted),
      });
    },
  );

  // GET /analytics/overview — dashboard summary stats
  fastify.get(
    '/overview',
    { preHandler: authenticate },
    async (request, reply) => {
      const workspaceId = request.workspaceId;
      const todayStart = todayStartISO();

      const [leadsRes, dealsRes, emailsRes, pipelineRes] = await Promise.allSettled([
        supabase
          .from('leads')
          .select('*', { count: 'exact', head: true })
          .eq('workspace_id', workspaceId)
          .is('deleted_at', null),
        supabase
          .from('deals')
          .select('*', { count: 'exact', head: true })
          .eq('workspace_id', workspaceId)
          .is('deleted_at', null)
          .is('won_at', null)
          .is('lost_at', null),
        supabase
          .from('activities')
          .select('*', { count: 'exact', head: true })
          .eq('workspace_id', workspaceId)
          .eq('type', 'email_sent')
          .gte('performed_at', todayStart),
        supabase
          .from('deals')
          .select('value')
          .eq('workspace_id', workspaceId)
          .is('deleted_at', null)
          .is('won_at', null)
          .is('lost_at', null),
      ]);

      const leadCount =
        leadsRes.status === 'fulfilled' ? (leadsRes.value.count ?? 0) : 0;
      const activeDeals =
        dealsRes.status === 'fulfilled' ? (dealsRes.value.count ?? 0) : 0;
      const emailsSentToday =
        emailsRes.status === 'fulfilled' ? (emailsRes.value.count ?? 0) : 0;

      let pipelineValue = 0;
      if (pipelineRes.status === 'fulfilled' && pipelineRes.value.data) {
        pipelineValue = pipelineRes.value.data.reduce(
          (sum: number, d: { value: number | null }) => sum + (d.value ?? 0),
          0,
        );
      }

      return reply.send({
        lead_count: leadCount,
        active_deals: activeDeals,
        pipeline_value: pipelineValue,
        emails_sent_today: emailsSentToday,
      });
    },
  );
};
