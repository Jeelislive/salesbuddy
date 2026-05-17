import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../../plugins/auth.plugin';
import { DealRepository } from '@salesbuddy/db';

const repo = new DealRepository();

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const CreateDealSchema = z.object({
  title: z.string().min(1).max(300),
  value: z.number().nonnegative().optional(),
  currency: z.string().length(3).optional(),
  stage_id: z.string().min(1),
  probability: z.number().int().min(0).max(100).optional(),
  expected_close_date: z.string().datetime().optional(),
  contact_id: z.string().uuid().optional(),
  company_id: z.string().uuid().optional(),
  lead_id: z.string().uuid().optional(),
  owner_id: z.string().uuid().optional(),
  notes: z.string().max(5000).optional(),
  tags: z.array(z.string()).optional(),
});

const UpdateDealSchema = CreateDealSchema.partial();

const ListDealsQuerySchema = z.object({
  stage_id: z.string().optional(),
  owner_id: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

const UpdateStageSchema = z.object({
  stage_id: z.string().min(1),
});

const MarkLostSchema = z.object({
  lost_reason: z.string().min(1).max(1000),
});

// ─── Routes ───────────────────────────────────────────────────────────────────

export const dealsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /deals/stats — register before /:id
  fastify.get(
    '/stats',
    { preHandler: authenticate },
    async (request, reply) => {
      try {
        const stats = await repo.getPipelineStats(request.workspaceId);
        return reply.send({ pipeline: stats });
      } catch (err) {
        fastify.log.error(err);
        return reply.status(500).send({ error: 'Failed to fetch deal stats', code: 'STATS_ERROR' });
      }
    },
  );

  // GET /deals
  fastify.get(
    '/',
    { preHandler: authenticate },
    async (request, reply) => {
      const parsed = ListDealsQuerySchema.safeParse(request.query);
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
        return reply.status(500).send({ error: 'Failed to fetch deals', code: 'FETCH_ERROR' });
      }
    },
  );

  // POST /deals
  fastify.post(
    '/',
    { preHandler: authenticate },
    async (request, reply) => {
      const parsed = CreateDealSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid deal data',
          code: 'VALIDATION_ERROR',
          details: parsed.error.flatten(),
        });
      }

      try {
        const deal = await repo.create(request.workspaceId, parsed.data);
        return reply.status(201).send(deal);
      } catch (err) {
        fastify.log.error(err);
        return reply.status(500).send({ error: 'Failed to create deal', code: 'CREATE_ERROR' });
      }
    },
  );

  // GET /deals/:id — includes activities
  fastify.get(
    '/:id',
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      try {
        const deal = await repo.findById(request.workspaceId, id);
        if (!deal) {
          return reply.status(404).send({ error: 'Deal not found', code: 'NOT_FOUND' });
        }
        return reply.send(deal);
      } catch (err) {
        fastify.log.error(err);
        return reply.status(500).send({ error: 'Failed to fetch deal', code: 'FETCH_ERROR' });
      }
    },
  );

  // PUT /deals/:id
  fastify.put(
    '/:id',
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = UpdateDealSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid deal data',
          code: 'VALIDATION_ERROR',
          details: parsed.error.flatten(),
        });
      }

      try {
        const existing = await repo.findById(request.workspaceId, id);
        if (!existing) {
          return reply.status(404).send({ error: 'Deal not found', code: 'NOT_FOUND' });
        }
        const updated = await repo.update(request.workspaceId, id, parsed.data);
        return reply.send(updated);
      } catch (err) {
        fastify.log.error(err);
        return reply.status(500).send({ error: 'Failed to update deal', code: 'UPDATE_ERROR' });
      }
    },
  );

  // PUT /deals/:id/stage
  fastify.put(
    '/:id/stage',
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = UpdateStageSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid stage data',
          code: 'VALIDATION_ERROR',
          details: parsed.error.flatten(),
        });
      }

      try {
        const existing = await repo.findById(request.workspaceId, id);
        if (!existing) {
          return reply.status(404).send({ error: 'Deal not found', code: 'NOT_FOUND' });
        }
        const updated = await repo.updateStage(request.workspaceId, id, parsed.data.stage_id);
        return reply.send(updated);
      } catch (err) {
        fastify.log.error(err);
        return reply
          .status(500)
          .send({ error: 'Failed to update deal stage', code: 'UPDATE_ERROR' });
      }
    },
  );

  // POST /deals/:id/won
  fastify.post(
    '/:id/won',
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      try {
        const existing = await repo.findById(request.workspaceId, id);
        if (!existing) {
          return reply.status(404).send({ error: 'Deal not found', code: 'NOT_FOUND' });
        }
        const deal = await repo.markWon(request.workspaceId, id);
        return reply.send(deal);
      } catch (err) {
        fastify.log.error(err);
        return reply.status(500).send({ error: 'Failed to mark deal as won', code: 'UPDATE_ERROR' });
      }
    },
  );

  // POST /deals/:id/lost
  fastify.post(
    '/:id/lost',
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = MarkLostSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Lost reason is required',
          code: 'VALIDATION_ERROR',
          details: parsed.error.flatten(),
        });
      }

      try {
        const existing = await repo.findById(request.workspaceId, id);
        if (!existing) {
          return reply.status(404).send({ error: 'Deal not found', code: 'NOT_FOUND' });
        }
        const deal = await repo.markLost(request.workspaceId, id, parsed.data.lost_reason);
        return reply.send(deal);
      } catch (err) {
        fastify.log.error(err);
        return reply
          .status(500)
          .send({ error: 'Failed to mark deal as lost', code: 'UPDATE_ERROR' });
      }
    },
  );
};
