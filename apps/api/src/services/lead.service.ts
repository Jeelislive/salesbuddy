import { supabase as db } from '@salesbuddy/db';
import { scrapeGithubDevs, isEmailValid } from './github-search.service';

export async function findAndImportGithubLeads(
  workspaceId: string,
  query: string,
  limit: number,
): Promise<{ found: number; inserted: number }> {
  const found = await scrapeGithubDevs(query, limit);

  const { data: existing } = await db.from('leads')
    .select('email, metadata')
    .eq('workspace_id', workspaceId)
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
    const { error } = await db.from('leads').insert({
      workspace_id: workspaceId,
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
    if (!error) inserted++;
  }

  return { found: found.length, inserted };
}

export async function verifyWorkspaceEmails(
  workspaceId: string,
  limit = 50,
): Promise<{ total: number; valid: number; invalid: number }> {
  const { data: leads } = await db.from('leads')
    .select('id, email')
    .eq('workspace_id', workspaceId)
    .eq('email_status', 'unverified')
    .not('email', 'is', null)
    .is('deleted_at', null)
    .limit(limit);

  const batch = leads ?? [];
  let valid = 0, invalid = 0;
  const CONCURRENCY = 10;

  for (let i = 0; i < batch.length; i += CONCURRENCY) {
    const chunk = batch.slice(i, i + CONCURRENCY);
    await Promise.all(chunk.map(async (lead) => {
      const ok = await isEmailValid(lead.email);
      await db.from('leads').update({ email_status: ok ? 'valid' : 'invalid' }).eq('id', lead.id);
      ok ? valid++ : invalid++;
    }));
  }

  return { total: batch.length, valid, invalid };
}

export async function enrollQualifiedLeads(
  workspaceId: string,
  sequenceId: string,
  minScore: number,
  limit: number,
): Promise<{ enrolled: number; skipped: boolean }> {
  const { data: sequence } = await db.from('sequences')
    .select('id, steps:sequence_steps(step_number, delay_days)')
    .eq('id', sequenceId)
    .single();

  if (!sequence) return { enrolled: 0, skipped: true };

  const steps: any[] = (sequence as any).steps ?? [];
  const step1 = steps.find((s: any) => s.step_number === 1);

  const { data: enrolled } = await db.from('sequence_enrollments')
    .select('contact_id')
    .eq('workspace_id', workspaceId)
    .eq('sequence_id', sequenceId);
  const enrolledIds = new Set((enrolled ?? []).map((e: any) => e.contact_id));

  const { data: leads } = await db.from('leads')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('email_status', 'valid')
    .gte('score', minScore)
    .is('deleted_at', null)
    .limit(limit);

  const toEnroll = (leads ?? []).filter((l: any) => !enrolledIds.has(l.id));

  const nextSendAt = new Date();
  if (step1?.delay_days) nextSendAt.setDate(nextSendAt.getDate() + step1.delay_days);

  let count = 0;
  for (const lead of toEnroll) {
    const { error } = await db.from('sequence_enrollments').insert({
      workspace_id: workspaceId,
      sequence_id: sequenceId,
      contact_id: lead.id,
      status: 'active',
      current_step: 1,
      next_send_at: nextSendAt.toISOString(),
    });
    if (!error) count++;
  }

  return { enrolled: count, skipped: false };
}
