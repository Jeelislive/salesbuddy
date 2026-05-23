import { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../../plugins/auth.plugin';
import { getGmailAuthUrl, exchangeCode, encrypt } from '../../services/gmail.service';
import { supabase as db } from '@salesbuddy/db';

export const emailRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /email/accounts - list connected email accounts for workspace
  fastify.get('/email/accounts', { preHandler: authenticate }, async (request, reply) => {
    
    const { data } = await db
      .from('email_accounts')
      .select('id, email, provider, is_default, created_at')
      .eq('workspace_id', request.workspaceId)
      .order('created_at');
    return reply.send({ accounts: data ?? [] });
  });

  // GET /email/auth/google - return OAuth URL for frontend to redirect to
  fastify.get('/email/auth/google', { preHandler: authenticate }, async (request, reply) => {
    const state = Buffer.from(JSON.stringify({
      workspaceId: request.workspaceId,
      userId: request.user.id,
    })).toString('base64url');
    return reply.send({ url: getGmailAuthUrl(state) });
  });

  // GET /email/auth/google/callback - Google redirects here after consent
  fastify.get('/email/auth/google/callback', async (request, reply) => {
    const { code, state, error } = request.query as Record<string, string>;

    if (error || !code || !state) {
      return reply.redirect(`${process.env['CORS_ORIGIN']}/settings?gmail=error`);
    }

    try {
      const { workspaceId, userId } = JSON.parse(Buffer.from(state, 'base64url').toString());
      const tokens = await exchangeCode(code);

      if (!tokens.refresh_token) {
        return reply.redirect(`${process.env['CORS_ORIGIN']}/settings?gmail=no_refresh_token`);
      }

      // Get the user's Gmail address using access_token directly
      const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const userInfo = await userInfoRes.json();

      
      const { error: upsertErr } = await db.from('email_accounts').upsert({
        workspace_id: workspaceId,
        user_id: userId,
        email: userInfo.email,
        provider: 'gmail',
        refresh_token: encrypt(tokens.refresh_token),
        token_expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
        is_default: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'workspace_id,email' });

      if (upsertErr) {
        fastify.log.error({ upsertErr, workspaceId, email: userInfo.email }, 'Failed to save email account');
        return reply.redirect(`${process.env['CORS_ORIGIN']}/settings?gmail=error`);
      }

      return reply.redirect(`${process.env['CORS_ORIGIN']}/settings?gmail=connected`);
    } catch (err) {
      fastify.log.error(err);
      return reply.redirect(`${process.env['CORS_ORIGIN']}/settings?gmail=error`);
    }
  });

  // DELETE /email/accounts/:id - disconnect account
  fastify.delete('/email/accounts/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    
    await db.from('email_accounts').delete()
      .eq('id', id)
      .eq('workspace_id', request.workspaceId);
    return reply.status(204).send();
  });
};
