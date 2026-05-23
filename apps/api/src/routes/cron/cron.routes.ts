import { FastifyPluginAsync } from 'fastify';
import { promises as dns } from 'dns';
import { supabase as db } from '@salesbuddy/db';
import { sendGmail } from '../../services/gmail.service';

async function isEmailValid(email: string): Promise<boolean> {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
  const domain = email.split('@')[1];
  try {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('DNS timeout')), 5000),
    );
    const records = await Promise.race([dns.resolveMx(domain), timeout]);
    return records.length > 0;
  } catch {
    return false;
  }
}

export const cronRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /cron/process-sequences
  // Called by cron-job.org every 5 minutes
  fastify.post('/cron/process-sequences', async (request, reply) => {
    const { secret } = request.query as { secret?: string };
    if (!process.env['CRON_SECRET'] || secret !== process.env['CRON_SECRET']) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    

    // Fetch all due enrollments with their step content and contact email
    const { data: enrollments, error } = await db
      .from('sequence_enrollments')
      .select(`
        id, workspace_id, contact_id, current_step, status,
        contact:leads!contact_id(id, email, first_name, last_name),
        sequence:sequences!sequence_id(
          id,
          steps:sequence_steps(step_number, subject, body, delay_days)
        )
      `)
      .eq('status', 'active')
      .not('next_send_at', 'is', null)
      .lte('next_send_at', new Date().toISOString())
      .limit(50);

    if (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'DB query failed' });
    }

    let processed = 0, failed = 0, skipped = 0;

    for (const enrollment of enrollments ?? []) {
      const contact = Array.isArray(enrollment.contact) ? enrollment.contact[0] : enrollment.contact as any;
      const sequence = Array.isArray(enrollment.sequence) ? enrollment.sequence[0] : enrollment.sequence as any;

      if (!contact?.email) { skipped++; continue; }

      const steps: any[] = sequence?.steps ?? [];
      const step = steps.find((s: any) => s.step_number === enrollment.current_step);

      if (!step) {
        // No more steps - complete the enrollment
        await db.from('sequence_enrollments')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('id', enrollment.id);
        continue;
      }

      // Get the workspace's connected email account
      const { data: account } = await db
        .from('email_accounts')
        .select('id, refresh_token')
        .eq('workspace_id', enrollment.workspace_id)
        .eq('is_default', true)
        .single();

      if (!account) { skipped++; continue; }

      try {
        const firstName = contact.first_name || contact.email.split('@')[0];
        const subject = (step.subject || '').replace(/\{\{first_name\}\}/gi, firstName);
        const rawBody = (step.body || '')
          .replace(/\{\{first_name\}\}/gi, firstName)
          .replace(/\[Your Name\]/gi, '')
          .replace(/\[Sender\]/gi, '')
          // strip dangling sign-offs left when placeholder is removed
          .replace(/\n(Best|Regards|Sincerely|Cheers|Thanks|Kind regards|Warm regards|Best regards),?\s*$/i, '')
          .trim();
        const htmlBody = rawBody
          .split(/\n\n+/)
          .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
          .join('');

        const messageId = await sendGmail(account.refresh_token, contact.email, subject, htmlBody);

        await db.from('email_logs').insert({
          workspace_id: enrollment.workspace_id,
          enrollment_id: enrollment.id,
          contact_id: enrollment.contact_id,
          email_account_id: account.id,
          step_number: step.step_number,
          subject,
          status: 'sent',
          gmail_message_id: messageId,
          sent_at: new Date().toISOString(),
        });

        // Advance to next step or complete
        const nextStep = steps.find((s: any) => s.step_number === enrollment.current_step + 1);
        if (nextStep) {
          const nextSendAt = new Date();
          nextSendAt.setDate(nextSendAt.getDate() + (nextStep.delay_days || 0));
          await db.from('sequence_enrollments').update({
            current_step: nextStep.step_number,
            next_send_at: nextSendAt.toISOString(),
          }).eq('id', enrollment.id);
        } else {
          await db.from('sequence_enrollments').update({
            status: 'completed',
            completed_at: new Date().toISOString(),
          }).eq('id', enrollment.id);
        }

        processed++;
      } catch (err) {
        fastify.log.error({ err, enrollmentId: enrollment.id }, 'Email send failed');
        await db.from('email_logs').insert({
          workspace_id: enrollment.workspace_id,
          enrollment_id: enrollment.id,
          contact_id: enrollment.contact_id,
          email_account_id: account.id,
          step_number: step.step_number,
          subject: step.subject,
          status: 'failed',
          error: err instanceof Error ? err.message : 'Unknown error',
          sent_at: new Date().toISOString(),
        });
        failed++;
      }
    }

    fastify.log.info({ processed, failed, skipped }, 'Cron: sequence processing done');
    return reply.send({ processed, failed, skipped, total: enrollments?.length ?? 0 });
  });

  // POST /cron/verify-emails - check MX records for unverified lead emails
  fastify.post('/cron/verify-emails', async (request, reply) => {
    const { secret } = request.query as { secret?: string };
    if (!process.env['CRON_SECRET'] || secret !== process.env['CRON_SECRET']) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { data: leads, error } = await db
      .from('leads')
      .select('id, email')
      .eq('email_status', 'unverified')
      .not('email', 'is', null)
      .is('deleted_at', null)
      .limit(100);

    if (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'DB query failed' });
    }

    let valid = 0, invalid = 0;
    const batch = leads ?? [];
    const CONCURRENCY = 10;
    for (let i = 0; i < batch.length; i += CONCURRENCY) {
      const chunk = batch.slice(i, i + CONCURRENCY);
      await Promise.all(chunk.map(async (lead) => {
        const ok = await isEmailValid(lead.email);
        await db.from('leads').update({ email_status: ok ? 'valid' : 'invalid' }).eq('id', lead.id);
        ok ? valid++ : invalid++;
      }));
    }

    fastify.log.info({ valid, invalid }, 'Cron: email verification done');
    return reply.send({ valid, invalid, total: batch.length });
  });
};
