import { promises as dns } from 'dns';

export interface ScrapedLead {
  businessName: string;
  email?: string;
  website?: string;
  score: number;
  rawData: {
    login: string;
    avatar?: string;
    bio?: string;
    company?: string;
    matchingSkills: string[];
    emailSource?: string | null;
    githubUrl: string;
  };
  socialLinks: { github: string };
}

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

const STOP_WORDS = new Set(['the', 'and', 'for', 'are', 'with', 'that', 'this', 'have', 'from', 'not', 'but']);

export function extractLangsFromQuery(query: string): string[] {
  const q = query.toLowerCase();
  const langs: string[] = [];
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
  const h: Record<string, string> = { Accept: 'application/vnd.github+json', 'User-Agent': 'SalesBuddy/1.0' };
  if (process.env['GITHUB_TOKEN']) h['Authorization'] = `Bearer ${process.env['GITHUB_TOKEN']}`;
  return h;
}

async function ghSearch(q: string, perPage = 30, page = 1): Promise<any[]> {
  const url = new URL('https://api.github.com/search/users');
  url.searchParams.set('q', q);
  url.searchParams.set('per_page', String(perPage));
  url.searchParams.set('page', String(page));
  const r = await fetch(url.toString(), { headers: ghHeaders() });
  if (!r.ok) return [];
  const d: any = await r.json();
  return d.items ?? [];
}

async function ghFlexSearch(userQuery: string, langs: string[], expFilter: string, page: number): Promise<any[]> {
  const seen = new Set<string>();
  const candidates: any[] = [];
  const add = (users: any[]) => {
    for (const u of users) {
      if (!seen.has(u.login.toLowerCase())) { seen.add(u.login.toLowerCase()); candidates.push(u); }
    }
  };
  if (langs.length > 0) {
    const res = await Promise.all(langs.map(l => ghSearch(`language:${l} ${expFilter}`, 30, page).catch(() => [])));
    for (const b of res) add(b);
  }
  const stripped = userQuery
    .replace(/\b(junior|mid|senior|staff|lead|principal|architect|developer|engineer|programmer|fullstack|backend|frontend|years?|yrs?|\d+)\b/gi, '')
    .replace(/[,]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (stripped && candidates.length < 30) {
    const filter = langs.length > 0 ? expFilter : 'followers:>10 repos:>3';
    add(await ghSearch(`${stripped} ${filter}`, 25, page).catch(() => []));
  }
  // Last-resort fallback: if still no candidates, search by experience filter alone
  if (candidates.length === 0) {
    add(await ghSearch(`${expFilter} type:user`, 30, page).catch(() => []));
  }
  return candidates.slice(0, 50);
}

async function ghFetchProfiles(candidates: any[], limit = 20): Promise<any[]> {
  const top = candidates.slice(0, Math.min(limit * 2, 40));
  const profiles = await Promise.all(
    top.map(u => fetch(`https://api.github.com/users/${u.login}`, { headers: ghHeaders() })
      .then(r => r.ok ? r.json() : null).catch(() => null))
  );
  return profiles.filter((p): p is any => p !== null);
}

function ghScoreProfiles(profiles: any[], userQuery: string, langs: string[], tier: number) {
  const queryTerms = userQuery.toLowerCase().split(/\W+/).filter(t => t.length >= 3 && !STOP_WORDS.has(t));
  return profiles.map(p => {
    const bio = (p.bio ?? '').toLowerCase();
    const name = (p.name ?? p.login ?? '').toLowerCase();
    const matching = queryTerms.filter(t => bio.includes(t) || name.includes(t));
    const display = matching.length > 0 ? matching : langs.slice(0, 2);
    const dTier = Math.abs(tier - ghDevTier(p.followers, p.public_repos));
    const expBonus = dTier === 0 ? 2 : dTier === 1 ? 1 : 0;
    return { profile: p, matchingSkills: display, matchScore: matching.length + expBonus };
  }).sort((a, b) => b.matchScore - a.matchScore);
}

export async function ghMineEmail(login: string, profile: any): Promise<{ email: string | null; source: 'profile' | 'commit' | null }> {
  if (profile.email && !NOREPLY_RE.test(profile.email)) return { email: profile.email, source: 'profile' };
  try {
    const repos: any[] = await fetch(`https://api.github.com/users/${login}/repos?type=owner&sort=pushed&per_page=5`, { headers: ghHeaders() }).then(r => r.ok ? r.json() : []);
    for (const repo of repos.filter((r: any) => !r.fork).slice(0, 3)) {
      const commits: any[] = await fetch(`https://api.github.com/repos/${login}/${repo.name}/commits?author=${login}&per_page=1`, { headers: ghHeaders() }).then(r => r.ok ? r.json() : []);
      const email = commits[0]?.commit?.author?.email ?? null;
      if (email && !NOREPLY_RE.test(email)) return { email, source: 'commit' };
    }
  } catch { /* best-effort */ }
  try {
    const events: any[] = await fetch(`https://api.github.com/users/${login}/events?per_page=50`, { headers: ghHeaders() }).then(r => r.ok ? r.json() : []);
    for (const ev of events) {
      if (ev.type !== 'PushEvent') continue;
      for (const c of ev.payload?.commits ?? []) {
        if (c.author?.email && !NOREPLY_RE.test(c.author.email)) return { email: c.author.email, source: 'commit' };
      }
    }
  } catch { /* best-effort */ }
  try {
    const repos: any[] = await fetch(`https://api.github.com/users/${login}/repos?type=owner&sort=pushed&per_page=3`, { headers: ghHeaders() }).then(r => r.ok ? r.json() : []);
    for (const repo of repos.slice(0, 2)) {
      const text: string = await fetch(`https://api.github.com/repos/${login}/${repo.name}/readme`, { headers: { ...ghHeaders(), Accept: 'application/vnd.github.raw' } }).then(r => r.ok ? r.text() : '');
      const match = text.match(GH_EMAIL_RE);
      if (match && !NOREPLY_RE.test(match[0])) return { email: match[0], source: 'commit' };
    }
  } catch { /* best-effort */ }
  return { email: null, source: null };
}

export async function scrapeGithubDevs(query: string, limit: number, startPage = 1): Promise<ScrapedLead[]> {
  const langs = extractLangsFromQuery(query);
  const { level, years } = extractLevelFromQuery(query);
  const tier = ghUserTier(level, years);
  const expFilter = ghExperienceQuery(tier);

  const seen = new Set<string>();
  const results: any[] = [];
  const MAX_PAGES = startPage + 15;

  for (let page = startPage; page <= MAX_PAGES && results.length < limit; page++) {
    const candidates = await ghFlexSearch(query, langs, expFilter, page);
    const fresh = candidates.filter(u => !seen.has(u.login));
    if (fresh.length === 0) break;
    for (const u of fresh) seen.add(u.login);

    const profiles = await ghFetchProfiles(fresh, limit - results.length);
    const scored = ghScoreProfiles(profiles, query, langs, tier);
    const needed = limit - results.length;

    const enriched = await Promise.all(
      scored.slice(0, needed * 2).map(async ({ profile: p, matchingSkills, matchScore }) => {
        const { email, source } = await ghMineEmail(p.login, p);
        return { ...p, matchingSkills, matchScore, email, emailSource: source };
      })
    );

    for (const d of enriched) {
      if (results.length >= limit) break;
      results.push(d);
    }
  }

  return results.map(d => {
    const website = d.blog ? (d.blog.startsWith('http') ? d.blog : `https://${d.blog}`) : undefined;
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
      rawData: { login: d.login, avatar: d.avatar_url, bio: d.bio, company: d.company, matchingSkills: d.matchingSkills, emailSource: d.emailSource, githubUrl: d.html_url },
      socialLinks: { github: d.html_url },
    };
  });
}

export async function isEmailValid(email: string): Promise<boolean> {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
  const domain = email.split('@')[1];
  try {
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('DNS timeout')), 5000));
    const records = await Promise.race([dns.resolveMx(domain), timeout]);
    return records.length > 0;
  } catch {
    return false;
  }
}
