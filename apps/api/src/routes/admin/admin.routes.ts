import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../../plugins/auth.plugin';
import { supabase } from '@salesbuddy/db';
import { generateToken } from '@salesbuddy/shared-utils';
import { UserRole } from '@salesbuddy/shared-constants';

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const UpdateWorkspaceSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  settings: z.record(z.unknown()).optional(),
});

const InviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.nativeEnum(UserRole).optional().default(UserRole.MEMBER),
});

// ─── Role guard helper ────────────────────────────────────────────────────────

function isAdminOrOwner(role: string): boolean {
  return role === UserRole.OWNER || role === UserRole.ADMIN;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export const adminRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /admin/workspace - get workspace settings
  fastify.get(
    '/workspace',
    { preHandler: authenticate },
    async (request, reply) => {
      const { data, error } = await supabase
        .from('workspaces')
        .select('*')
        .eq('id', request.workspaceId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return reply.status(404).send({ error: 'Workspace not found', code: 'NOT_FOUND' });
        }
        fastify.log.error(error);
        return reply
          .status(500)
          .send({ error: 'Failed to fetch workspace', code: 'FETCH_ERROR' });
      }

      return reply.send(data);
    },
  );

  // PUT /admin/workspace - update workspace name / settings
  fastify.put(
    '/workspace',
    { preHandler: authenticate },
    async (request, reply) => {
      if (!isAdminOrOwner(request.user.role)) {
        return reply
          .status(403)
          .send({ error: 'Only admins can update workspace settings', code: 'FORBIDDEN' });
      }

      const parsed = UpdateWorkspaceSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid workspace data',
          code: 'VALIDATION_ERROR',
          details: parsed.error.flatten(),
        });
      }

      const { data, error } = await supabase
        .from('workspaces')
        .update({ ...parsed.data, updated_at: new Date().toISOString() })
        .eq('id', request.workspaceId)
        .select()
        .single();

      if (error) {
        fastify.log.error(error);
        return reply
          .status(500)
          .send({ error: 'Failed to update workspace', code: 'UPDATE_ERROR' });
      }

      return reply.send(data);
    },
  );

  // GET /admin/members - list workspace members with roles
  fastify.get(
    '/members',
    { preHandler: authenticate },
    async (request, reply) => {
      const { data, error } = await supabase
        .from('workspace_members')
        .select('*')
        .eq('workspace_id', request.workspaceId)
        .order('created_at', { ascending: true });

      if (error) {
        fastify.log.error(error);
        return reply
          .status(500)
          .send({ error: 'Failed to fetch members', code: 'FETCH_ERROR' });
      }

      return reply.send({ data });
    },
  );

  // POST /admin/members/invite - create invite record
  fastify.post(
    '/members/invite',
    { preHandler: authenticate },
    async (request, reply) => {
      if (!isAdminOrOwner(request.user.role)) {
        return reply
          .status(403)
          .send({ error: 'Only admins can invite members', code: 'FORBIDDEN' });
      }

      const parsed = InviteMemberSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid invite data',
          code: 'VALIDATION_ERROR',
          details: parsed.error.flatten(),
        });
      }

      // Check for existing member with this email
      const { data: existing } = await supabase
        .from('workspace_members')
        .select('id')
        .eq('workspace_id', request.workspaceId)
        .eq('email', parsed.data.email)
        .single();

      if (existing) {
        return reply.status(409).send({
          error: 'A member with this email already exists',
          code: 'DUPLICATE_MEMBER',
        });
      }

      const inviteToken = generateToken(32);

      const { data, error } = await supabase
        .from('workspace_members')
        .insert({
          workspace_id: request.workspaceId,
          email: parsed.data.email,
          role: parsed.data.role,
          invited_at: new Date().toISOString(),
          invite_token: inviteToken,
        })
        .select()
        .single();

      if (error) {
        fastify.log.error(error);
        return reply
          .status(500)
          .send({ error: 'Failed to create invite', code: 'CREATE_ERROR' });
      }

      // Invite email delivery is handled by a background job in the workers app.
      return reply.status(201).send({
        ...data,
        invite_url: `${process.env['CORS_ORIGIN'] ?? 'http://localhost:3001'}/invite/${inviteToken}`,
      });
    },
  );

  // GET /admin/billing - get subscription information
  fastify.get(
    '/billing',
    { preHandler: authenticate },
    async (request, reply) => {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('workspace_id', request.workspaceId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No subscription record - return free-tier defaults
          return reply.send({
            plan: 'free',
            status: 'active',
            features: [],
            limits: { leads: 250, sequences: 3, members: 1 },
          });
        }
        fastify.log.error(error);
        return reply
          .status(500)
          .send({ error: 'Failed to fetch billing info', code: 'FETCH_ERROR' });
      }

      return reply.send(data);
    },
  );
};
