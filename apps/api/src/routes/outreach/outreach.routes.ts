import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../../plugins/auth.plugin';
import { SequenceRepository } from '@salesbuddy/db';
import { anthropic, DEFAULT_MODEL, buildEmailSequencePrompt } from '@salesbuddy/ai';

const repo = new SequenceRepository();

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const SequenceStepSchema = z.object({
  step_number: z.number().int().positive(),
  type: z.enum(['email', 'wait', 'task', 'sms', 'linkedin']),
  subject: z.string().max(300).optional(),
  body: z.string().min(1),
  delay_days: z.number().int().min(0).optional().default(0),
  delay_hours: z.number().int().min(0).max(23).optional().default(0),
});

const CreateSequenceSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  steps: z.array(SequenceStepSchema).min(1).max(20),
});

const UpdateStatusSchema = z.object({
  status: z.enum(['active', 'paused', 'archived']),
});

const EnrollSchema = z.object({
  contact_ids: z.array(z.string().uuid()).min(1).max(100),
});

const EnrollmentsQuerySchema = z.object({
  sequence_id: z.string().uuid().optional(),
  status: z.string().optional(),
  contact_id: z.string().uuid().optional(),
});

const GenerateSequenceSchema = z.object({
  icp: z.object({
    industry: z.string().optional(),
    role: z.string().optional(),
    company_size: z.string().optional(),
    pain_points: z.array(z.string()).optional(),
  }),
  product: z.object({
    name: z.string().min(1),
    value_proposition: z.string().min(1),
    key_features: z.array(z.string()).optional(),
  }),
  steps: z.number().int().min(2).max(10).default(5),
  tone: z.enum(['professional', 'conversational', 'direct']).optional().default('professional'),
});

// ─── Routes ───────────────────────────────────────────────────────────────────

export const outreachRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /sequences
  fastify.get(
    '/sequences',
    { preHandler: authenticate },
    async (request, reply) => {
      try {
        const sequences = await repo.findAll(request.workspaceId);
        return reply.send({ data: sequences });
      } catch (err) {
        fastify.log.error(err);
        return reply
          .status(500)
          .send({ error: 'Failed to fetch sequences', code: 'FETCH_ERROR' });
      }
    },
  );

  // POST /sequences
  fastify.post(
    '/sequences',
    { preHandler: authenticate },
    async (request, reply) => {
      const parsed = CreateSequenceSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid sequence data',
          code: 'VALIDATION_ERROR',
          details: parsed.error.flatten(),
        });
      }

      const { steps, ...seqData } = parsed.data;

      try {
        const sequence = await repo.create(request.workspaceId, seqData, steps);
        return reply.status(201).send(sequence);
      } catch (err) {
        fastify.log.error(err);
        return reply
          .status(500)
          .send({ error: 'Failed to create sequence', code: 'CREATE_ERROR' });
      }
    },
  );

  // POST /sequences/generate - AI-generate sequence steps via Anthropic
  fastify.post(
    '/sequences/generate',
    { preHandler: authenticate },
    async (request, reply) => {
      const parsed = GenerateSequenceSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid generation parameters',
          code: 'VALIDATION_ERROR',
          details: parsed.error.flatten(),
        });
      }

      try {
        const messages = buildEmailSequencePrompt(parsed.data);
        const response = await anthropic.messages.create({
          model: DEFAULT_MODEL,
          max_tokens: 4096,
          messages,
        });

        const rawText =
          response.content[0]?.type === 'text' ? response.content[0].text : '';

        let steps: unknown[];
        try {
          steps = JSON.parse(rawText);
          if (!Array.isArray(steps)) throw new Error('Expected array');
        } catch {
          fastify.log.error({ rawText }, 'AI returned non-JSON sequence');
          return reply.status(502).send({
            error: 'AI returned an unexpected format',
            code: 'AI_PARSE_ERROR',
          });
        }

        return reply.send({ steps, model: DEFAULT_MODEL });
      } catch (err: unknown) {
        fastify.log.error(err);
        const message = err instanceof Error ? err.message : 'Unknown AI error';
        return reply.status(502).send({ error: message, code: 'AI_ERROR' });
      }
    },
  );

  // GET /sequences/:id
  fastify.get(
    '/sequences/:id',
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      try {
        const sequence = await repo.findById(request.workspaceId, id);
        if (!sequence) {
          return reply.status(404).send({ error: 'Sequence not found', code: 'NOT_FOUND' });
        }
        return reply.send(sequence);
      } catch (err) {
        fastify.log.error(err);
        return reply
          .status(500)
          .send({ error: 'Failed to fetch sequence', code: 'FETCH_ERROR' });
      }
    },
  );

  // PUT /sequences/:id/status - pause / resume / archive
  fastify.put(
    '/sequences/:id/status',
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = UpdateStatusSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid status value',
          code: 'VALIDATION_ERROR',
          details: parsed.error.flatten(),
        });
      }

      try {
        const existing = await repo.findById(request.workspaceId, id);
        if (!existing) {
          return reply.status(404).send({ error: 'Sequence not found', code: 'NOT_FOUND' });
        }
        const updated = await repo.updateStatus(request.workspaceId, id, parsed.data.status);
        return reply.send(updated);
      } catch (err) {
        fastify.log.error(err);
        return reply
          .status(500)
          .send({ error: 'Failed to update sequence status', code: 'UPDATE_ERROR' });
      }
    },
  );

  // POST /sequences/:id/enroll
  fastify.post(
    '/sequences/:id/enroll',
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = EnrollSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid enrollment data',
          code: 'VALIDATION_ERROR',
          details: parsed.error.flatten(),
        });
      }

      try {
        const sequence = await repo.findById(request.workspaceId, id);
        if (!sequence) {
          return reply.status(404).send({ error: 'Sequence not found', code: 'NOT_FOUND' });
        }
        if (sequence.status !== 'active') {
          return reply.status(422).send({
            error: 'Cannot enroll into a non-active sequence',
            code: 'SEQUENCE_NOT_ACTIVE',
          });
        }

        const enrollments = await repo.enroll(
          request.workspaceId,
          id,
          parsed.data.contact_ids,
        );
        return reply.status(201).send({
          enrolled: enrollments.length,
          skipped: parsed.data.contact_ids.length - enrollments.length,
          enrollments,
        });
      } catch (err) {
        fastify.log.error(err);
        return reply.status(500).send({ error: 'Failed to enroll contacts', code: 'ENROLL_ERROR' });
      }
    },
  );

  // GET /enrollments
  fastify.get(
    '/enrollments',
    { preHandler: authenticate },
    async (request, reply) => {
      const parsed = EnrollmentsQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid query parameters',
          code: 'VALIDATION_ERROR',
          details: parsed.error.flatten(),
        });
      }

      try {
        const enrollments = await repo.getEnrollments(request.workspaceId, parsed.data);
        return reply.send({ data: enrollments });
      } catch (err) {
        fastify.log.error(err);
        return reply
          .status(500)
          .send({ error: 'Failed to fetch enrollments', code: 'FETCH_ERROR' });
      }
    },
  );
};
