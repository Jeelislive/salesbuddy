# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Run API (port 4000) + web (port 3000) in parallel
npm run build        # Build all projects via NX
npm run lint         # Lint all projects
npm run test         # Test all projects

# Target a single project
npx nx serve api
npx nx serve web
npx nx build api
```

API dev uses `ts-node-dev --respawn --transpile-only -r tsconfig-paths/register src/main.ts`.  
Web dev uses Vite. Web proxies `/api/*` → `http://localhost:4000`.

## Architecture

**NX monorepo** with npm workspaces.

```
apps/api/     Fastify 4 backend
apps/web/     React 18 + Vite frontend
libs/db/      Supabase client + repository classes
libs/queue/   BullMQ queues (EMAIL_SEND, ENRICHMENT, AI_AGENT, SEQUENCE)
libs/ai/      Anthropic SDK singleton + prompts
libs/shared/  TypeScript types, utils, constants
```

Path aliases (defined in `tsconfig.base.json`): `@salesbuddy/db`, `@salesbuddy/ai`, `@salesbuddy/queue`, `@salesbuddy/shared-types`, etc.

### API (`apps/api/src/`)

- `main.ts` → `app.ts` builds the Fastify instance
- Plugins registered in order: helmet → cors → rate-limit → auth
- All routes under `/api/v1/` prefix
- Auth plugin (`plugins/auth.plugin.ts`) verifies Supabase JWT, decorates every request with `request.user` and `request.workspaceId`
- Routes: `leads/`, `deals/`, `outreach/` (sequences + enrollments), `proposals/`, `analytics/`, `admin/`, `email/`, `cron/`
- Cron routes are **not** auth-protected — they use a shared `CRON_SECRET` query param instead

**Route conventions:**
- Validate with Zod `.safeParse()`, return `400 { error, code: 'VALIDATION_ERROR', details }` on failure
- Create → 201, async job queued → 202 `{ message, job_id }`, soft-delete → 204
- All error responses: `{ error: string, code: string, details?: any }`

### Web (`apps/web/src/`)

- React Router v6 with a `ProtectedRoute` that checks Zustand auth store
- **Zustand stores**: `auth.store.ts` (session + Google OAuth), `workspace.store.ts` (workspaceId, auto-creates workspace on first login), `theme.store.ts`, `command.store.ts`
- Most pages call Supabase directly (no API layer wrapper); the Fastify API is called for AI/enrichment/cron endpoints via `fetch` with `Authorization: Bearer <session.access_token>`
- UI components in `components/ui/` are Radix UI primitives with Tailwind

### Database (`libs/db/`)

- `client.ts` exports a service-role `supabase` proxy (lazy singleton) and `createUserClient(token)` for RLS-scoped queries
- Repository classes (`LeadRepository`, `DealRepository`, `SequenceRepository`) are the data access layer — instantiated once per route file
- Every table has `workspace_id`; all queries filter by it
- Soft deletes via `deleted_at`; always add `.is('deleted_at', null)` when reading
- Migrations in `libs/db/migrations/` — apply all three to Supabase before running

### AI (`libs/ai/`)

- Anthropic client singleton; `DEFAULT_MODEL` = `claude-sonnet-4-6`
- Cheaper tasks (lead scoring, query extraction) use `claude-haiku-4-5-20251001`
- Prompts in `src/prompts/`: `email-writer`, `lead-scoring`, `proposal`

### Queues (`libs/queue/`)

- BullMQ over ioredis; connection URL from `REDIS_URL`
- 3 retries with exponential backoff; keep 100 completed / remove 500 failed jobs

## Key Runtime Dependencies

| Service | Where configured |
|---------|-----------------|
| Supabase | `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in `apps/api/.env` |
| Redis | `REDIS_URL` in `apps/api/.env` |
| Anthropic | `ANTHROPIC_API_KEY` in `apps/api/.env` |
| Gmail OAuth | `GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI` + `ENCRYPTION_KEY` |
| Cron jobs | `CRON_SECRET` — sent as `?secret=` query param |
| Web Supabase | `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` in `apps/web/.env` |

## Cron Endpoints

Both called via HTTP POST with `?secret=<CRON_SECRET>`:

- `POST /api/v1/cron/process-sequences` — sends due sequence emails (every 5 min)
- `POST /api/v1/cron/verify-emails` — MX-validates unverified lead emails, 100/run (every 30 min)
