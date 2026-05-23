import { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../../plugins/auth.plugin';
import { supabase } from '@salesbuddy/db';

export const analyticsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /analytics/summary - single endpoint for all dashboard analytics
  fastify.get('/analytics/summary', { preHandler: authenticate }, async (request, reply) => {
    const wid = request.workspaceId;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

    const [leadsRes, emailsRes, emailsTodayRes, sequencesRes, enrollmentsRes, emailLogsRes] =
      await Promise.all([
        supabase.from('leads').select('source').eq('workspace_id', wid).is('deleted_at', null),
        supabase.from('email_logs').select('id', { count: 'exact', head: true }).eq('workspace_id', wid).eq('status', 'sent'),
        supabase.from('email_logs').select('id', { count: 'exact', head: true }).eq('workspace_id', wid).eq('status', 'sent').gte('sent_at', todayISO),
        supabase.from('sequences').select('id, name, status').eq('workspace_id', wid).neq('status', 'archived').order('created_at', { ascending: false }),
        supabase.from('sequence_enrollments').select('id, sequence_id, status').eq('workspace_id', wid),
        supabase.from('email_logs').select('sent_at, status, enrollment_id').eq('workspace_id', wid).gte('sent_at', fourteenDaysAgo).order('sent_at', { ascending: true }),
      ]);

    // ── Overview ───────────────────────────────────────────────
    const overview = {
      total_leads: leadsRes.data?.length ?? 0,
      emails_sent: emailsRes.count ?? 0,
      emails_sent_today: emailsTodayRes.count ?? 0,
      active_sequences: (sequencesRes.data ?? []).filter((s: any) => s.status === 'active').length,
      total_enrolled: (enrollmentsRes.data ?? []).length,
    };

    // ── Lead sources ───────────────────────────────────────────
    const sourceCounts: Record<string, number> = {};
    for (const l of leadsRes.data ?? []) {
      const src = (l.source as string | null) || 'Manual';
      sourceCounts[src] = (sourceCounts[src] ?? 0) + 1;
    }
    const lead_sources = Object.entries(sourceCounts)
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    // ── Email activity last 14 days ────────────────────────────
    const dayMap: Record<string, { sent: number; failed: number }> = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      dayMap[key] = { sent: 0, failed: 0 };
    }
    for (const log of emailLogsRes.data ?? []) {
      const key = (log.sent_at as string).slice(0, 10);
      if (!dayMap[key]) continue;
      if (log.status === 'sent') dayMap[key].sent++;
      else dayMap[key].failed++;
    }
    const email_activity = Object.entries(dayMap).map(([date, v]) => ({
      date: new Date(date).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
      sent: v.sent,
      failed: v.failed,
    }));

    // ── Sequence performance ───────────────────────────────────
    const enrollMap: Record<string, { enrolled: number; completed: number }> = {};
    for (const e of enrollmentsRes.data ?? []) {
      const sid = e.sequence_id as string;
      enrollMap[sid] = enrollMap[sid] ?? { enrolled: 0, completed: 0 };
      enrollMap[sid].enrolled++;
      if (e.status === 'completed') enrollMap[sid].completed++;
    }
    const enrollToSeq: Record<string, string> = {};
    for (const e of enrollmentsRes.data ?? []) enrollToSeq[(e as any).id] = e.sequence_id as string;

    const seqSentMap: Record<string, number> = {};
    for (const log of emailLogsRes.data ?? []) {
      if (log.status === 'sent' && log.enrollment_id) {
        const sid = enrollToSeq[log.enrollment_id as string];
        if (sid) seqSentMap[sid] = (seqSentMap[sid] ?? 0) + 1;
      }
    }

    const sequences = (sequencesRes.data ?? []).map((s: any) => ({
      id: s.id,
      name: s.name,
      status: s.status,
      enrolled: enrollMap[s.id]?.enrolled ?? 0,
      completed: enrollMap[s.id]?.completed ?? 0,
      emails_sent: seqSentMap[s.id] ?? 0,
    }));

    return reply.send({ overview, lead_sources, email_activity, sequences });
  });
};
