import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../../plugins/auth.plugin';
import { supabase } from '@salesbuddy/db';
import { anthropic, DEFAULT_MODEL, buildProposalPrompt } from '@salesbuddy/ai';
import { generateToken } from '@salesbuddy/shared-utils';

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const CreateProposalSchema = z.object({
  deal_id: z.string().uuid().optional(),
  contact_id: z.string().uuid().optional(),
  title: z.string().min(1).max(300),
  content: z.string().optional().default(''),
  expires_at: z.string().datetime().optional(),
});

const UpdateProposalSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  content: z.string().optional(),
  expires_at: z.string().datetime().optional(),
});

const GenerateProposalSchema = z.object({
  deal: z.object({
    title: z.string().min(1),
    value: z.number().nonnegative().optional(),
    currency: z.string().length(3).optional(),
    notes: z.string().optional(),
  }),
  contact: z.object({
    first_name: z.string().min(1),
    last_name: z.string().min(1),
    title: z.string().optional(),
    company_name: z.string().optional(),
  }),
  product: z.object({
    name: z.string().min(1),
    description: z.string().min(1),
    key_benefits: z.array(z.string()).optional(),
    pricing_model: z.string().optional(),
  }),
});

const TABLE = 'proposals';

// ─── Routes ───────────────────────────────────────────────────────────────────

export const proposalsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /proposals
  fastify.get(
    '/',
    { preHandler: authenticate },
    async (request, reply) => {
      const { data, error } = await supabase
        .from(TABLE)
        .select('*')
        .eq('workspace_id', request.workspaceId)
        .order('created_at', { ascending: false });

      if (error) {
        fastify.log.error(error);
        return reply
          .status(500)
          .send({ error: 'Failed to fetch proposals', code: 'FETCH_ERROR' });
      }
      return reply.send({ data });
    },
  );

  // POST /proposals — create draft
  fastify.post(
    '/',
    { preHandler: authenticate },
    async (request, reply) => {
      const parsed = CreateProposalSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid proposal data',
          code: 'VALIDATION_ERROR',
          details: parsed.error.flatten(),
        });
      }

      const tracking_token = generateToken(40);

      const { data, error } = await supabase
        .from(TABLE)
        .insert({
          ...parsed.data,
          workspace_id: request.workspaceId,
          created_by: request.user.id,
          status: 'draft',
          tracking_token,
          view_count: 0,
        })
        .select()
        .single();

      if (error) {
        fastify.log.error(error);
        return reply
          .status(500)
          .send({ error: 'Failed to create proposal', code: 'CREATE_ERROR' });
      }

      return reply.status(201).send(data);
    },
  );

  // POST /proposals/generate — AI-generate proposal content
  fastify.post(
    '/generate',
    { preHandler: authenticate },
    async (request, reply) => {
      const parsed = GenerateProposalSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid generation parameters',
          code: 'VALIDATION_ERROR',
          details: parsed.error.flatten(),
        });
      }

      try {
        const messages = buildProposalPrompt(parsed.data);
        const response = await anthropic.messages.create({
          model: DEFAULT_MODEL,
          max_tokens: 4096,
          messages,
        });

        const content =
          response.content[0]?.type === 'text' ? response.content[0].text : '';

        return reply.send({ content, model: DEFAULT_MODEL });
      } catch (err: unknown) {
        fastify.log.error(err);
        const message = err instanceof Error ? err.message : 'Unknown AI error';
        return reply.status(502).send({ error: message, code: 'AI_ERROR' });
      }
    },
  );

  // GET /proposals/:id
  fastify.get(
    '/:id',
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const { data, error } = await supabase
        .from(TABLE)
        .select('*')
        .eq('workspace_id', request.workspaceId)
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return reply.status(404).send({ error: 'Proposal not found', code: 'NOT_FOUND' });
        }
        fastify.log.error(error);
        return reply
          .status(500)
          .send({ error: 'Failed to fetch proposal', code: 'FETCH_ERROR' });
      }

      return reply.send(data);
    },
  );

  // PUT /proposals/:id — update content
  fastify.put(
    '/:id',
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = UpdateProposalSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid proposal data',
          code: 'VALIDATION_ERROR',
          details: parsed.error.flatten(),
        });
      }

      const { data, error } = await supabase
        .from(TABLE)
        .update({ ...parsed.data, updated_at: new Date().toISOString() })
        .eq('workspace_id', request.workspaceId)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return reply.status(404).send({ error: 'Proposal not found', code: 'NOT_FOUND' });
        }
        fastify.log.error(error);
        return reply
          .status(500)
          .send({ error: 'Failed to update proposal', code: 'UPDATE_ERROR' });
      }

      return reply.send(data);
    },
  );

  // POST /proposals/:id/send — mark as sent
  fastify.post(
    '/:id/send',
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const { data: existing, error: fetchErr } = await supabase
        .from(TABLE)
        .select('id, status, title')
        .eq('workspace_id', request.workspaceId)
        .eq('id', id)
        .single();

      if (fetchErr || !existing) {
        return reply.status(404).send({ error: 'Proposal not found', code: 'NOT_FOUND' });
      }

      const { data, error } = await supabase
        .from(TABLE)
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('workspace_id', request.workspaceId)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        fastify.log.error(error);
        return reply
          .status(500)
          .send({ error: 'Failed to mark proposal as sent', code: 'UPDATE_ERROR' });
      }

      // Email sending is handled asynchronously via the email queue in a worker.
      // Here we record the intent and return the updated proposal.
      return reply.send(data);
    },
  );

  // GET /proposals/track/:token — PUBLIC endpoint (no auth), marks viewed
  fastify.get(
    '/track/:token',
    async (request, reply) => {
      const { token } = request.params as { token: string };

      if (!token || token.length < 20) {
        return reply.status(400).send({ error: 'Invalid tracking token', code: 'INVALID_TOKEN' });
      }

      const { data: proposal, error: fetchErr } = await supabase
        .from(TABLE)
        .select('id, workspace_id, status, view_count, expires_at')
        .eq('tracking_token', token)
        .single();

      if (fetchErr || !proposal) {
        return reply.status(404).send({ error: 'Proposal not found', code: 'NOT_FOUND' });
      }

      if (proposal.expires_at && new Date(proposal.expires_at) < new Date()) {
        return reply.status(410).send({ error: 'Proposal has expired', code: 'PROPOSAL_EXPIRED' });
      }

      await supabase
        .from(TABLE)
        .update({
          viewed_at: new Date().toISOString(),
          view_count: (proposal.view_count ?? 0) + 1,
          status: proposal.status === 'sent' ? 'viewed' : proposal.status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', proposal.id);

      return reply.send({ tracked: true, proposal_id: proposal.id });
    },
  );
};
