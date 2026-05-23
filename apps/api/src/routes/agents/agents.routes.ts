import { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../../plugins/auth.plugin';
import { supabase as db } from '@salesbuddy/db';
import { findAndImportGithubLeads, verifyWorkspaceEmails, enrollQualifiedLeads } from '../../services/lead.service';

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
      const { found, inserted } = await findAndImportGithubLeads(
        agent.workspace_id,
        agent.icp_query,
        agent.leads_per_run ?? 10,
      );
      await log('find_leads', 'success', `Found ${found} leads, imported ${inserted} new`, { found, inserted });
    } catch (err) {
      await log('find_leads', 'failed', `Lead search failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  // ── Step 2: Verify emails ─────────────────────────────────────────────────
  if (agent.can_verify_emails) {
    try {
      const { total, valid, invalid } = await verifyWorkspaceEmails(agent.workspace_id, 50);
      await log('verify_emails', 'success', `Verified ${total} emails — ${valid} valid, ${invalid} invalid`, { total, valid, invalid });
    } catch (err) {
      await log('verify_emails', 'failed', `Email verification failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  // ── Step 3: Enroll qualified leads ────────────────────────────────────────
  if (agent.can_enroll_leads && agent.target_sequence_id) {
    try {
      const { enrolled, skipped } = await enrollQualifiedLeads(
        agent.workspace_id,
        agent.target_sequence_id,
        agent.min_lead_score ?? 0,
        agent.leads_per_run ?? 10,
      );
      if (skipped) {
        await log('enroll_leads', 'skipped', 'Target sequence not found');
      } else {
        await log('enroll_leads', 'success', `Enrolled ${enrolled} leads into sequence`, { enrolled });
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
