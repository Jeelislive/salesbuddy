import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../../plugins/auth.plugin';
import { LeadRepository } from '@salesbuddy/db';
import { enrichmentQueue } from '@salesbuddy/queue';
import { anthropic } from '@salesbuddy/ai';

const LEAD_SCRAPER_API = 'https://leadapi-y92c.onrender.com/api/scrapers/leads';

const repo = new LeadRepository();

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const CreateLeadSchema = z.object({
  first_name: z.string().min(1).max(100),
  last_name: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().max(30).optional(),
  title: z.string().max(150).optional(),
  company_name: z.string().max(200).optional(),
  source: z.string().max(50).optional(),
  status: z.string().max(50).optional(),
  score: z.number().int().min(0).max(100).optional(),
  notes: z.string().max(5000).optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
  assigned_to: z.string().uuid().optional(),
});

const UpdateLeadSchema = CreateLeadSchema.partial();

const ListLeadsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  status: z.string().optional(),
  source: z.string().optional(),
  search: z.string().max(200).optional(),
});

const BulkImportSchema = z.object({
  leads: z.array(CreateLeadSchema).min(1).max(500),
});

// ─── Routes ───────────────────────────────────────────────────────────────────

export const leadsRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /leads/enrich-batch — enrich multiple leads with AI (no Redis needed)
  fastify.post(
    '/enrich-batch',
    { preHandler: authenticate },
    async (request, reply) => {
      const { lead_ids } = request.body as { lead_ids: string[] };
      if (!Array.isArray(lead_ids) || lead_ids.length === 0) {
        return reply.status(400).send({ error: 'lead_ids array is required' });
      }
      if (!process.env.ANTHROPIC_API_KEY) {
        return reply.status(503).send({ error: 'ANTHROPIC_API_KEY not configured', code: 'NO_AI_KEY' });
      }

      const { createUserClient } = await import('@salesbuddy/db');
      const db = createUserClient(request.headers.authorization!.slice(7));

      const { data: leads } = await db
        .from('leads')
        .select('id, first_name, last_name, email, company_name, title, score, status')
        .eq('workspace_id', request.workspaceId)
        .in('id', lead_ids.slice(0, 20)); // cap at 20 per batch

      if (!leads?.length) return reply.send({ enriched: 0 });

      
      let enriched = 0;

      for (const lead of leads) {
        try {
          const name = `${lead.first_name} ${lead.last_name}`.trim();
          const msg = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 200,
            system: 'You are a B2B sales intelligence assistant. Given a contact\'s info, infer their likely job title, seniority level, and AI lead score (0-100 based on how likely they are to buy B2B SaaS). Respond ONLY with valid JSON: {"title": "...", "score": 0-100, "status": "new|qualified|contacted"}',
            messages: [{
              role: 'user',
              content: `Name: ${name}\nEmail: ${lead.email ?? 'unknown'}\nCompany: ${lead.company_name ?? 'unknown'}\nCurrent title: ${lead.title ?? 'unknown'}`,
            }],
          });

          const text = (msg.content[0] as any)?.text?.trim() ?? '';
          const json = JSON.parse(text);

          await db.from('leads').update({
            title: json.title || lead.title,
            score: typeof json.score === 'number' ? Math.min(100, Math.max(0, json.score)) : lead.score,
            status: json.status || lead.status,
            updated_at: new Date().toISOString(),
          }).eq('id', lead.id).eq('workspace_id', request.workspaceId);

          enriched++;
        } catch { /* skip this lead */ }
      }

      return reply.send({ enriched, total: leads.length });
    },
  );

  // POST /leads/ai-discover — AI-powered lead search
  fastify.post(
    '/ai-discover',
    { preHandler: authenticate },
    async (request, reply) => {
      const { prompt, limit = 10 } = request.body as { prompt: string; limit?: number };
      if (!prompt?.trim()) {
        return reply.status(400).send({ error: 'prompt is required' });
      }

      let searchQuery = prompt.trim();

      if (process.env.ANTHROPIC_API_KEY) {
        try {
          
          const msg = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 60,
            system:
              'Extract a concise search query (2-6 keywords) from the user\'s lead generation request. ' +
              'The query will search GitHub profiles, Reddit users, and Product Hunt makers. ' +
              'Output ONLY the keywords, no explanation.',
            messages: [{ role: 'user', content: prompt }],
          });
          const text = (msg.content[0] as any)?.text?.trim();
          if (text) searchQuery = text;
        } catch { /* fall back to original prompt */ }
      }

      try {
        const cap = Math.min(Number(limit) || 10, 50);
        const res = await fetch(`${LEAD_SCRAPER_API}?query=${encodeURIComponent(searchQuery)}&limit=${cap}`);
        if (!res.ok) throw new Error(`upstream ${res.status}`);
        const data = await res.json() as { leads?: unknown[] };
        return reply.send({ query: searchQuery, leads: data.leads ?? [] });
      } catch (err) {
        fastify.log.error(err);
        return reply.status(502).send({ error: 'Failed to fetch leads from external source' });
      }
    },
  );

  // GET /leads/stats — must be registered before /leads/:id to avoid route conflict
  fastify.get(
    '/stats',
    { preHandler: authenticate },
    async (request, reply) => {
      try {
        const stats = await repo.getStats(request.workspaceId);
        return reply.send(stats);
      } catch (err) {
        fastify.log.error(err);
        return reply.status(500).send({ error: 'Failed to fetch lead stats', code: 'STATS_ERROR' });
      }
    },
  );

  // GET /leads
  fastify.get(
    '/',
    { preHandler: authenticate },
    async (request, reply) => {
      const parsed = ListLeadsQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid query parameters',
          code: 'VALIDATION_ERROR',
          details: parsed.error.flatten(),
        });
      }

      try {
        const result = await repo.findAll(request.workspaceId, parsed.data);
        return reply.send(result);
      } catch (err) {
        fastify.log.error(err);
        return reply.status(500).send({ error: 'Failed to fetch leads', code: 'FETCH_ERROR' });
      }
    },
  );

  // POST /leads
  fastify.post(
    '/',
    { preHandler: authenticate },
    async (request, reply) => {
      const parsed = CreateLeadSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid lead data',
          code: 'VALIDATION_ERROR',
          details: parsed.error.flatten(),
        });
      }

      try {
        const lead = await repo.create(request.workspaceId, parsed.data);
        return reply.status(201).send(lead);
      } catch (err) {
        fastify.log.error(err);
        return reply.status(500).send({ error: 'Failed to create lead', code: 'CREATE_ERROR' });
      }
    },
  );

  // POST /leads/import — bulk import
  fastify.post(
    '/import',
    { preHandler: authenticate },
    async (request, reply) => {
      const parsed = BulkImportSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid import data',
          code: 'VALIDATION_ERROR',
          details: parsed.error.flatten(),
        });
      }

      try {
        const created = await repo.bulkCreate(request.workspaceId, parsed.data.leads);
        return reply.status(201).send({ imported: created.length, leads: created });
      } catch (err) {
        fastify.log.error(err);
        return reply.status(500).send({ error: 'Failed to import leads', code: 'IMPORT_ERROR' });
      }
    },
  );

  // GET /leads/:id
  fastify.get(
    '/:id',
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      try {
        const lead = await repo.findById(request.workspaceId, id);
        if (!lead) {
          return reply.status(404).send({ error: 'Lead not found', code: 'NOT_FOUND' });
        }
        return reply.send(lead);
      } catch (err) {
        fastify.log.error(err);
        return reply.status(500).send({ error: 'Failed to fetch lead', code: 'FETCH_ERROR' });
      }
    },
  );

  // PUT /leads/:id
  fastify.put(
    '/:id',
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = UpdateLeadSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid lead data',
          code: 'VALIDATION_ERROR',
          details: parsed.error.flatten(),
        });
      }

      try {
        const existing = await repo.findById(request.workspaceId, id);
        if (!existing) {
          return reply.status(404).send({ error: 'Lead not found', code: 'NOT_FOUND' });
        }
        const updated = await repo.update(request.workspaceId, id, parsed.data);
        return reply.send(updated);
      } catch (err) {
        fastify.log.error(err);
        return reply.status(500).send({ error: 'Failed to update lead', code: 'UPDATE_ERROR' });
      }
    },
  );

  // DELETE /leads/:id — soft delete
  fastify.delete(
    '/:id',
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      try {
        const existing = await repo.findById(request.workspaceId, id);
        if (!existing) {
          return reply.status(404).send({ error: 'Lead not found', code: 'NOT_FOUND' });
        }
        await repo.softDelete(request.workspaceId, id);
        return reply.status(204).send();
      } catch (err) {
        fastify.log.error(err);
        return reply.status(500).send({ error: 'Failed to delete lead', code: 'DELETE_ERROR' });
      }
    },
  );

  // POST /leads/:id/enrich — enqueue BullMQ enrichment job
  fastify.post(
    '/:id/enrich',
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      try {
        const lead = await repo.findById(request.workspaceId, id);
        if (!lead) {
          return reply.status(404).send({ error: 'Lead not found', code: 'NOT_FOUND' });
        }

        const job = await enrichmentQueue.add(
          'enrich-lead',
          {
            workspace_id: request.workspaceId,
            lead_id: id,
            email: lead.email,
            company_name: lead.company_name,
          },
          { jobId: `enrich-lead-${id}` },
        );

        return reply.status(202).send({
          message: 'Enrichment job queued',
          job_id: job.id,
        });
      } catch (err) {
        fastify.log.error(err);
        return reply.status(500).send({ error: 'Failed to queue enrichment', code: 'QUEUE_ERROR' });
      }
    },
  );
};
