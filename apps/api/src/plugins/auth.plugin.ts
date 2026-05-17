import { FastifyPluginAsync, FastifyRequest, FastifyReply, preHandlerHookHandler } from 'fastify';
import fp from 'fastify-plugin';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
  workspace_id: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user: AuthenticatedUser;
    workspaceId: string;
  }
}

const authPluginImpl: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest('workspaceId', '');
};

export const authPlugin = fp(authPluginImpl, {
  name: 'auth-plugin',
  fastify: '4.x',
});

let _supabaseAuth: ReturnType<typeof createClient> | null = null;
function getSupabaseAuth() {
  if (_supabaseAuth) return _supabaseAuth;
  const url = process.env['SUPABASE_URL']!;
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY']!;
  _supabaseAuth = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: { transport: ws as any },
  });
  return _supabaseAuth;
}

export const authenticate: preHandlerHookHandler = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Missing authorization header', code: 'UNAUTHORIZED' });
  }

  const token = authHeader.slice(7);

  try {
    const supabase = getSupabaseAuth();
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      return reply.status(401).send({ error: 'Invalid or expired token', code: 'UNAUTHORIZED' });
    }

    const u = data.user;
    let workspaceId =
      (u.app_metadata?.['workspace_id'] as string | undefined) ??
      (u.user_metadata?.['workspace_id'] as string | undefined);

    if (!workspaceId) {
      const { data: member } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', u.id)
        .limit(1)
        .single();
      workspaceId = member?.workspace_id ?? u.id;
    }

    const role =
      (u.app_metadata?.['role'] as string | undefined) ??
      (u.user_metadata?.['role'] as string | undefined) ??
      'member';

    (request as any).user = { id: u.id, email: u.email ?? '', role, workspace_id: workspaceId };
    request.workspaceId = workspaceId;
  } catch (err) {
    request.log.error({ err }, 'Token verification threw');
    return reply.status(401).send({ error: 'Token verification failed', code: 'UNAUTHORIZED' });
  }
};
