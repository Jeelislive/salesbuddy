import { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../../plugins/auth.plugin';
import { supabase as db } from '@salesbuddy/db';
import { scrapeGithubDevs, isEmailValid } from '../../services/github-search.service';

// ─── Agent runner ─────────────────────────────────────────────────────────────

export async function runAgent(agentId: string): Promise<{ actions: string[] }> {
  const { data: agent } = await db.from('agents').select('*').eq('id', agentId).single();
  if (!agent || agent.status !== 'active') return { actions: [] };

  const actions: string[] = [];

  const log = async (action: string, status: string, summary: string, details: object = {}) => {
    await db.from('agent_logs').insert({ agent_id: agentId, workspace_id: agent.workspace_id, action, status, summary, details });
    actions.push(summary);
  };

  // ── Step 1: Find leads ────────────────────────────────────────────────────
  if (agent.can_find_leads && agent.icp_query) {
    try {
      const found = await scrapeGithubDevs(agent.icp_query, agent.leads_per_run ?? 10);

      // Get existing emails/logins to deduplicate
      const { data: existing } = await db.from('leads')
        .select('email, metadata')
        .eq('workspace_id', agent.workspace_id)
        .is('deleted_at', null);

      const existingKeys = new Set<string>();
      for (const l of existing ?? []) {
        if (l.email) existingKeys.add(l.email.toLowerCase());
        const login = (l.metadata as any)?.login;
        if (login) existingKeys.add(login.toLowerCase());
      }

      const newLeads = found.filter(l => {
        const emailKey = l.email?.toLowerCase();
        const loginKey = l.rawData.login?.toLowerCase();
        return (!emailKey || !existingKeys.has(emailKey)) && (!loginKey || !existingKeys.has(loginKey));
      });

      let inserted = 0;
      for (const l of newLeads) {
        if (!l.email) continue;
        const nameParts = (l.businessName || '').trim().split(' ');
        await db.from('leads').insert({
          workspace_id: agent.workspace_id,
          first_name: nameParts[0] || l.rawData.login,
          last_name: nameParts.slice(1).join(' ') || '',
          email: l.email,
          title: (l.rawData.bio ?? '').split(/[\n|•·]/)[0].trim().slice(0, 150) || null,
          company_name: (l.rawData.company ?? '').replace(/^@/, '') || null,
          website: l.website || null,
          source: 'AI Agent',
          score: l.score,
          email_status: 'unverified',
          status: 'new',
          metadata: { login: l.rawData.login, avatar: l.rawData.avatar, githubUrl: l.rawData.githubUrl },
        });
        inserted++;
      }

      await log('find_leads', 'success', `Found ${found.length} leads, imported ${inserted} new`, { found: found.length, inserted });
    } catch (err) {
      await log('find_leads', 'failed', `Lead search failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  // ── Step 2: Verify emails ─────────────────────────────────────────────────
  if (agent.can_verify_emails) {
    try {
      const { data: leads } = await db.from('leads')
        .select('id, email')
        .eq('workspace_id', agent.workspace_id)
        .eq('email_status', 'unverified')
        .not('email', 'is', null)
        .is('deleted_at', null)
        .limit(50);

      let valid = 0, invalid = 0;
      const CONCURRENCY = 10;
      const batch = leads ?? [];
      for (let i = 0; i < batch.length; i += CONCURRENCY) {
        const chunk = batch.slice(i, i + CONCURRENCY);
        await Promise.all(chunk.map(async (lead) => {
          const ok = await isEmailValid(lead.email);
          await db.from('leads').update({ email_status: ok ? 'valid' : 'invalid' }).eq('id', lead.id);
          ok ? valid++ : invalid++;
        }));
      }

      await log('verify_emails', 'success', `Verified ${batch.length} emails — ${valid} valid, ${invalid} invalid`, { total: batch.length, valid, invalid });
    } catch (err) {
      await log('verify_emails', 'failed', `Email verification failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  // ── Step 3: Enroll qualified leads ────────────────────────────────────────
  if (agent.can_enroll_leads && agent.target_sequence_id) {
    try {
      // Get sequence steps to know next_send_at
      const { data: sequence } = await db.from('sequences')
        .select('id, steps:sequence_steps(step_number, delay_days)')
        .eq('id', agent.target_sequence_id)
        .single();

      if (!sequence) {
        await log('enroll_leads', 'skipped', 'Target sequence not found');
      } else {
        const steps: any[] = (sequence as any).steps ?? [];
        const step1 = steps.find((s: any) => s.step_number === 1);

        // Already enrolled in this sequence
        const { data: enrolled } = await db.from('sequence_enrollments')
          .select('contact_id')
          .eq('workspace_id', agent.workspace_id)
          .eq('sequence_id', agent.target_sequence_id);
        const enrolledIds = new Set((enrolled ?? []).map((e: any) => e.contact_id));

        // Qualified leads: valid email, above min score, not yet enrolled
        const { data: leads } = await db.from('leads')
          .select('id')
          .eq('workspace_id', agent.workspace_id)
          .eq('email_status', 'valid')
          .gte('score', agent.min_lead_score ?? 0)
          .is('deleted_at', null)
          .limit(agent.leads_per_run ?? 10);

        const toEnroll = (leads ?? []).filter((l: any) => !enrolledIds.has(l.id));

        const nextSendAt = new Date();
        if (step1?.delay_days) nextSendAt.setDate(nextSendAt.getDate() + step1.delay_days);

        let count = 0;
        for (const lead of toEnroll) {
          await db.from('sequence_enrollments').insert({
            workspace_id: agent.workspace_id,
            sequence_id: agent.target_sequence_id,
            contact_id: lead.id,
            status: 'active',
            current_step: 1,
            next_send_at: nextSendAt.toISOString(),
          });
          count++;
        }

        await log('enroll_leads', 'success', `Enrolled ${count} leads into sequence`, { enrolled: count });
      }
    } catch (err) {
      await log('enroll_leads', 'failed', `Enrollment failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  // Update last_run_at
  await db.from('agents').update({ last_run_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', agentId);

  return { actions };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export const agentsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /agents
  fastify.get('/agents', { preHandler: authenticate }, async (request, reply) => {
    const { data, error } = await db.from('agents')
      .select('*')
      .eq('workspace_id', request.workspaceId)
      .order('created_at', { ascending: false });
    if (error) return reply.status(500).send({ error: 'Failed to fetch agents' });
    return reply.send(data ?? []);
  });

  // POST /agents
  fastify.post('/agents', { preHandler: authenticate }, async (request, reply) => {
    const body = request.body as any;
    const { data, error } = await db.from('agents').insert({
      workspace_id: request.workspaceId,
      name: body.name || 'AI Sales Agent',
      status: 'stopped',
      icp_query: body.icp_query ?? null,
      target_sequence_id: body.target_sequence_id ?? null,
      leads_per_run: body.leads_per_run ?? 10,
      min_lead_score: body.min_lead_score ?? 0,
      can_find_leads: body.can_find_leads ?? true,
      can_verify_emails: body.can_verify_emails ?? true,
      can_enroll_leads: body.can_enroll_leads ?? false,
    }).select().single();
    if (error) return reply.status(500).send({ error: 'Failed to create agent' });
    return reply.status(201).send(data);
  });

  // PATCH /agents/:id
  fastify.patch('/agents/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    const { data, error } = await db.from('agents')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('workspace_id', request.workspaceId)
      .select().single();
    if (error) return reply.status(500).send({ error: 'Failed to update agent' });
    return reply.send(data);
  });

  // DELETE /agents/:id
  fastify.delete('/agents/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await db.from('agents').delete().eq('id', id).eq('workspace_id', request.workspaceId);
    return reply.status(204).send();
  });

  // GET /agents/:id/logs
  fastify.get('/agents/:id/logs', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { data, error } = await db.from('agent_logs')
      .select('*')
      .eq('agent_id', id)
      .eq('workspace_id', request.workspaceId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) return reply.status(500).send({ error: 'Failed to fetch logs' });
    return reply.send(data ?? []);
  });

  // POST /agents/:id/run — manual trigger
  fastify.post('/agents/:id/run', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    // Verify agent belongs to workspace
    const { data: agent } = await db.from('agents').select('id, status').eq('id', id).eq('workspace_id', request.workspaceId).single();
    if (!agent) return reply.status(404).send({ error: 'Agent not found' });
    if (agent.status === 'stopped') return reply.status(400).send({ error: 'Agent is stopped. Set it to active first.' });

    // Run async — return immediately
    runAgent(id).catch(err => fastify.log.error({ err, agentId: id }, 'Agent run failed'));
    return reply.send({ message: 'Agent run started' });
  });
};
