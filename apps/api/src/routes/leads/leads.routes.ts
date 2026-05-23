import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../../plugins/auth.plugin';
import { LeadRepository } from '@salesbuddy/db';
import { enrichmentQueue } from '@salesbuddy/queue';
import { anthropic } from '@salesbuddy/ai';

const LEAD_SCRAPER_API = 'https://leadapi-y92c.onrender.com/api/scrapers/leads';

// ─── Email Verification ───────────────────────────────────────────────────────

import { promises as dns } from 'dns';

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

// ─── GitHub Developer Scraper ─────────────────────────────────────────────────

const NOREPLY_RE = /^(\d+\+)?[^@]+@users\.noreply\.github\.com$/i;
const GH_EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/;

const STACK_TO_LANG: Record<string, string> = {
  TypeScript: 'TypeScript', JavaScript: 'JavaScript', Python: 'Python',
  Go: 'Go', Rust: 'Rust', Java: 'Java', Ruby: 'Ruby',
  'C++': 'C++', 'C#': 'C#', Swift: 'Swift', Kotlin: 'Kotlin',
  PHP: 'PHP', Dart: 'Dart',
  React: 'TypeScript', 'Next.js': 'TypeScript', Svelte: 'TypeScript',
  Angular: 'TypeScript', Vue: 'JavaScript', 'Node.js': 'JavaScript',
  NestJS: 'TypeScript', Express: 'JavaScript',
  FastAPI: 'Python', Django: 'Python', Flask: 'Python',
  Rails: 'Ruby', Spring: 'Java', 'Spring Boot': 'Java',
  Laravel: 'PHP', Flutter: 'Dart',
};

const LEVEL_KEYWORDS: Record<string, string> = {
  junior: 'junior', entry: 'junior', beginner: 'junior',
  mid: 'mid', intermediate: 'mid', middle: 'mid',
  senior: 'senior', sr: 'senior',
  staff: 'staff', lead: 'staff', principal: 'staff', architect: 'staff',
};

function extractLangsFromQuery(query: string): string[] {
  const q = query.toLowerCase();
  const langs: string[] = [];
  // Match multi-word keys first (e.g. "Next.js" before "JavaScript")
  const sortedKeys = Object.keys(STACK_TO_LANG).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    const lang = STACK_TO_LANG[key];
    if (q.includes(key.toLowerCase()) && !langs.includes(lang)) langs.push(lang);
  }
  return langs.slice(0, 3);
}

function extractLevelFromQuery(query: string): { level: string; years: number } {
  const q = query.toLowerCase();
  let level = 'mid';
  for (const [kw, lvl] of Object.entries(LEVEL_KEYWORDS)) {
    if (q.includes(kw)) { level = lvl; break; }
  }
  const yearsMatch = q.match(/(\d+)\s*(?:year|yr)/);
  const years = yearsMatch ? parseInt(yearsMatch[1]) : level === 'senior' ? 7 : level === 'junior' ? 1 : 3;
  return { level, years };
}

function ghUserTier(level: string, years: number): number {
  const y = years ?? (level === 'staff' ? 12 : level === 'senior' ? 7 : level === 'mid' ? 3 : 1);
  if (y >= 10) return 3;
  if (y >= 5) return 2;
  if (y >= 2) return 1;
  return 0;
}

function ghDevTier(followers: number, repos: number): number {
  if (followers > 500 || repos > 60) return 3;
  if (followers > 100 || repos > 25) return 2;
  if (followers > 25 || repos > 8) return 1;
  return 0;
}

function ghExperienceQuery(tier: number): string {
  switch (tier) {
    case 0: return 'followers:5..150 repos:>3';
    case 1: return 'followers:20..400 repos:>8';
    case 2: return 'followers:60..1500 repos:>12';
    default: return 'followers:150..5000 repos:>18';
  }
}

function ghHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'SalesBuddy/1.0',
  };
  if (process.env['GITHUB_TOKEN']) h['Authorization'] = `Bearer ${process.env['GITHUB_TOKEN']}`;
  return h;
}

async function ghSearch(q: string, perPage = 30, page = 1): Promise<any[]> {
  const url = new URL('https://api.github.com/search/users');
  url.searchParams.set('q', q);
  url.searchParams.set('per_page', String(perPage));
  url.searchParams.set('page', String(page));
  const r = await fetch(url.toString(), { headers: ghHeaders() });
  console.log(`[GH] search q="${q}" → ${r.status}`);
  if (!r.ok) { const t = await r.text().catch(() => ''); console.log(`[GH] error body: ${t}`); return []; }
  const d: any = await r.json();
  return d.items ?? [];
}

async function ghFlexSearch(userQuery: string, langs: string[], expFilter: string, page: number): Promise<any[]> {
  const seen = new Set<string>();
  const candidates: any[] = [];
  const addBatch = (users: any[]) => {
    for (const u of users) {
      if (!seen.has(u.login.toLowerCase())) { seen.add(u.login.toLowerCase()); candidates.push(u); }
    }
  };

  // Strategy 1: language-based search
  if (langs.length > 0) {
    const langResults = await Promise.all(
      langs.map(lang => ghSearch(`language:${lang} ${expFilter}`, 30, page).catch(() => []))
    );
    for (const batch of langResults) addBatch(batch);
  }

  // Strategy 2: free-text search
  const stripped = userQuery
    .replace(/\b(junior|mid|senior|staff|lead|principal|architect|developer|engineer|programmer|fullstack|backend|frontend|years?|yrs?|\d+)\b/gi, '')
    .trim();
  if (stripped && candidates.length < 30) {
    const filter = langs.length > 0 ? expFilter : 'followers:>10 repos:>3';
    const batch = await ghSearch(`${stripped} ${filter}`, 25, page).catch(() => []);
    addBatch(batch);
  }

  console.log(`[GH] candidates after search: ${candidates.length}`);
  return candidates.slice(0, 50);
}

async function ghFetchProfiles(candidates: any[]): Promise<any[]> {
  const top = candidates.slice(0, 15);
  const profiles = await Promise.all(
    top.map((u) =>
      fetch(`https://api.github.com/users/${u.login}`, { headers: ghHeaders() })
        .then((r) => r.ok ? r.json() : null)
        .catch(() => null)
    )
  );
  return profiles.filter((p): p is any => p !== null);
}

const STOP_WORDS = new Set(['the', 'and', 'for', 'are', 'with', 'that', 'this', 'have', 'from', 'not', 'but']);

function ghScoreProfiles(profiles: any[], userQuery: string, langs: string[], tier: number) {
  // Score by matching query terms against bio — works for any free-text query
  const queryTerms = userQuery
    .toLowerCase()
    .split(/\W+/)
    .filter((t) => t.length >= 3 && !STOP_WORDS.has(t));

  return profiles
    .map((p) => {
      const bioText = (p.bio ?? '').toLowerCase();
      const nameText = (p.name ?? p.login ?? '').toLowerCase();
      const matchingSkills = queryTerms.filter((t) => bioText.includes(t) || nameText.includes(t));
      // Fallback display label when no bio matches
      const displaySkills = matchingSkills.length > 0 ? matchingSkills : langs.slice(0, 2);
      const dTier = Math.abs(tier - ghDevTier(p.followers, p.public_repos));
      const expBonus = dTier === 0 ? 2 : dTier === 1 ? 1 : 0;
      return { profile: p, matchingSkills: displaySkills, matchScore: matchingSkills.length + expBonus };
    })
    .sort((a, b) => b.matchScore - a.matchScore);
}

async function ghMineEmail(login: string, profile: any): Promise<{ email: string | null; source: 'profile' | 'commit' | null }> {
  if (profile.email && !NOREPLY_RE.test(profile.email)) return { email: profile.email, source: 'profile' };

  try {
    const repos: any[] = await fetch(
      `https://api.github.com/users/${login}/repos?type=owner&sort=pushed&per_page=5`, { headers: ghHeaders() }
    ).then((r) => r.ok ? r.json() : []);
    for (const repo of repos.filter((r: any) => !r.fork).slice(0, 3)) {
      const commits: any[] = await fetch(
        `https://api.github.com/repos/${login}/${repo.name}/commits?author=${login}&per_page=1`, { headers: ghHeaders() }
      ).then((r) => r.ok ? r.json() : []);
      const email = commits[0]?.commit?.author?.email ?? null;
      if (email && !NOREPLY_RE.test(email)) return { email, source: 'commit' };
    }
  } catch { /* best-effort */ }

  try {
    const events: any[] = await fetch(
      `https://api.github.com/users/${login}/events?per_page=50`, { headers: ghHeaders() }
    ).then((r) => r.ok ? r.json() : []);
    for (const event of events) {
      if (event.type !== 'PushEvent') continue;
      for (const commit of event.payload?.commits ?? []) {
        if (commit.author?.email && !NOREPLY_RE.test(commit.author.email)) {
          return { email: commit.author.email, source: 'commit' };
        }
      }
    }
  } catch { /* best-effort */ }

  try {
    const repos: any[] = await fetch(
      `https://api.github.com/users/${login}/repos?type=owner&sort=pushed&per_page=3`, { headers: ghHeaders() }
    ).then((r) => r.ok ? r.json() : []);
    for (const repo of repos.slice(0, 2)) {
      const text: string = await fetch(
        `https://api.github.com/repos/${login}/${repo.name}/readme`,
        { headers: { ...ghHeaders(), Accept: 'application/vnd.github.raw' } }
      ).then((r) => r.ok ? r.text() : '');
      const match = text.match(GH_EMAIL_RE);
      if (match && !NOREPLY_RE.test(match[0])) return { email: match[0], source: 'commit' };
    }
  } catch { /* best-effort */ }

  return { email: null, source: null };
}

async function scrapeGithubDevs(query: string, limit: number): Promise<any[]> {
  const langs = extractLangsFromQuery(query);
  const { level, years } = extractLevelFromQuery(query);
  const tier = ghUserTier(level, years);
  const expFilter = ghExperienceQuery(tier);
  const randomPage = Math.floor(Math.random() * 8) + 1;

  const candidates = await ghFlexSearch(query, langs, expFilter, randomPage);
  const profiles = await ghFetchProfiles(candidates);
  const scored = ghScoreProfiles(profiles, query, langs, tier);

  const enriched = await Promise.all(
    scored.slice(0, limit).map(async ({ profile: p, matchingSkills, matchScore }) => {
      const { email, source } = await ghMineEmail(p.login, p);
      return { ...p, matchingSkills, matchScore, email, emailSource: source };
    })
  );

  return enriched.map((d) => {
    const website = d.blog
      ? (d.blog.startsWith('http') ? d.blog : `https://${d.blog}`)
      : undefined;
    let score = 30;
    if (d.email) score += 30;
    if (website) score += 10;
    if ((d.followers ?? 0) > 100) score += 10;
    if (d.matchScore > 0) score += Math.min(d.matchScore * 5, 20);
    return {
      businessName: d.name || d.login,
      email: d.email ?? undefined,
      website,
      score: Math.min(score, 100),
      rawData: {
        login: d.login,
        avatar: d.avatar_url,
        bio: d.bio,
        company: d.company,
        matchingSkills: d.matchingSkills,
        emailSource: d.emailSource,
        githubUrl: d.html_url,
      },
      socialLinks: { github: d.html_url },
    };
  });
}

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
        const cap = Math.min(Number(limit) || 10, 30);
        const res = await fetch(`${LEAD_SCRAPER_API}?query=${encodeURIComponent(searchQuery)}&limit=${cap}`);
        if (!res.ok) throw new Error(`upstream ${res.status}`);
        const data = await res.json() as { leads?: any[] };
        const rawLeads = data.leads ?? [];

        // For leads without email that have a GitHub login, mine email from commits
        const enriched = await Promise.all(
          rawLeads.map(async (lead: any) => {
            if (lead.email) return lead;
            const login = lead.rawData?.login;
            if (!login) return lead;
            const { email } = await ghMineEmail(login, lead.rawData ?? {});
            return email ? { ...lead, email } : lead;
          }),
        );

        return reply.send({ query: searchQuery, leads: enriched });
      } catch (err) {
        fastify.log.error(err);
        return reply.status(502).send({ error: 'Lead search failed' });
      }
    },
  );

  // POST /leads/verify-emails — bulk MX verify all unverified leads in workspace
  fastify.post(
    '/verify-emails',
    { preHandler: authenticate },
    async (request, reply) => {
      const { createUserClient } = await import('@salesbuddy/db');
      const db = createUserClient(request.headers.authorization!.slice(7));

      const { data: leads, error } = await db
        .from('leads')
        .select('id, email')
        .eq('workspace_id', request.workspaceId)
        .eq('email_status', 'unverified')
        .not('email', 'is', null)
        .is('deleted_at', null)
        .limit(100);

      if (error) return reply.status(500).send({ error: 'DB query failed' });

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

      return reply.send({ valid, invalid, total: batch.length });
    },
  );

  // POST /leads/:id/verify-email — verify a single lead's email on demand
  fastify.post(
    '/:id/verify-email',
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { createUserClient } = await import('@salesbuddy/db');
      const db = createUserClient(request.headers.authorization!.slice(7));

      const { data: lead } = await db
        .from('leads')
        .select('id, email')
        .eq('workspace_id', request.workspaceId)
        .eq('id', id)
        .single();

      if (!lead) return reply.status(404).send({ error: 'Lead not found' });
      if (!lead.email) return reply.status(400).send({ error: 'Lead has no email' });

      const ok = await isEmailValid(lead.email);
      const email_status = ok ? 'valid' : 'invalid';
      await db.from('leads').update({ email_status }).eq('id', id);

      return reply.send({ email_status });
    },
  );

  // POST /leads/github-devs — GitHub developer lead search using user's free-text query
  fastify.post(
    '/github-devs',
    { preHandler: authenticate },
    async (request, reply) => {
      const { query, limit = 10 } = request.body as { query: string; limit?: number };
      if (!query?.trim()) return reply.status(400).send({ error: 'query is required' });

      let searchQuery = query.trim();

      // Use Claude to extract GitHub-searchable tech keywords from natural language
      if (process.env.ANTHROPIC_API_KEY) {
        try {
          const msg = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 80,
            system:
              'Extract the most relevant GitHub user search keywords from the request. ' +
              'RULES: ' +
              '1. If a specific programming language is implied, include it (Python, JavaScript, TypeScript, Go, Rust, Java, Ruby, PHP, Swift, Kotlin, Dart, C++). ' +
              '2. Include a role word if clear: developer, engineer, founder, designer, devops, ml, ai, blockchain. ' +
              '3. Include one topic if present: saas, startup, open-source, machine-learning, fintech, crypto. ' +
              '4. Output ONLY 2-4 space-separated lowercase keywords. No punctuation, no explanation. ' +
              'Examples: "saas founders" → "saas founder startup", "open source contributors" → "open-source developer", "python ml engineers" → "Python machine-learning".',
            messages: [{ role: 'user', content: query.trim() }],
          });
          const text = (msg.content[0] as any)?.text?.trim();
          if (text) searchQuery = text;
        } catch { /* fall back to raw query */ }
      }

      try {
        const cap = Math.min(Number(limit) || 10, 30);
        const leads = await scrapeGithubDevs(searchQuery, cap);
        return reply.send({ query: searchQuery, leads });
      } catch (err) {
        fastify.log.error(err);
        return reply.status(502).send({ error: 'GitHub search failed' });
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
