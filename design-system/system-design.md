# SalesBuddy — System Design

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                        CLIENTS                          │
│    React Web App     │    Embeddable Chat Widget        │
└──────────┬───────────────────────────┬──────────────────┘
           │                           │
           ▼                           ▼
┌──────────────────────────────────────────────────────────┐
│                     API GATEWAY                          │
│          (Rate Limiting, Auth, Routing)                  │
└───┬──────────┬──────────┬──────────┬──────────┬─────────┘
    │          │          │          │          │
    ▼          ▼          ▼          ▼          ▼
 Leads     Outreach    AI Agent   Proposals  Analytics
 Service   Service     Service    Service    Service
    │          │          │          │          │
    └──────────┴──────────┴──────────┴──────────┘
                          │
                ┌─────────┴──────────┐
                │                    │
           Supabase DB          Redis + BullMQ
           (PostgreSQL)         (Job Queues)
                │
         Supabase Storage
         (Proposals, PDFs, Files)
```

---

## Service Breakdown

### `apps/api` — API Gateway

```
Express + TypeScript
├── Middleware: JWT auth (Supabase), rate limiting, org context injection
├── Routes:
│   ├── /auth           → Supabase Auth passthrough
│   ├── /leads          → CRUD, scoring, enrichment triggers
│   ├── /campaigns      → Campaign & sequence management
│   ├── /deals          → Pipeline operations
│   ├── /proposals      → Generate, send, track proposals
│   ├── /analytics      → Dashboard data queries
│   └── /integrations   → Connect CRM, calendar, Slack
└── Enqueues background jobs via libs/queue → BullMQ
```

### `apps/ai-service` — AI Engine (Internal Service)

```
Express + TypeScript (internal, not public)
├── POST /qualify          → Lead qualification conversation
├── POST /generate-email   → Personalized outreach email generation
├── POST /demo-agent       → Interactive demo conversation handler
├── POST /objections       → Handle sales objections with context
├── POST /proposal-copy    → Generate proposal content and pricing copy
└── POST /health-score     → Analyze account health from usage data
All powered by Claude API (claude-sonnet-4-6)
```

### `apps/outreach-worker` — Background Job Worker

```
BullMQ Workers consuming Redis queues:
├── lead-enrichment      → Calls Apollo/Clearbit APIs, stores enriched data
├── email-sender         → Sends emails via SendGrid, handles open tracking
├── linkedin-outreach    → Via PhantomBuster/LinkedIn API
├── sequence-scheduler   → Advances leads through sequence steps on schedule
├── crm-sync             → Pushes/pulls data from HubSpot/Salesforce
└── health-scorer        → Recalculates account health scores nightly
```

### `apps/webhook-receiver` — Inbound Webhook Handler

```
Lightweight Express app
├── /webhooks/sendgrid     → Email open, click, reply, bounce events
├── /webhooks/stripe       → Billing events (payment success, churn)
├── /webhooks/docusign     → Proposal signed/declined events
└── /webhooks/hubspot      → CRM data change events
```

### `apps/web` — React Frontend

```
React + Vite + TypeScript
├── TanStack Query     → Server state & caching
├── Zustand            → Client-side global state
├── React Router v6    → Page routing
├── Tailwind + shadcn  → UI component system
│
├── Pages:
│   ├── /dashboard      → Revenue, pipeline, key metrics overview
│   ├── /leads          → Lead table, score badges, enrichment status
│   ├── /campaigns      → Sequence builder, stats, A/B results
│   ├── /pipeline       → Kanban deal board
│   ├── /proposals      → Proposal list, editor, tracking
│   ├── /accounts       → Health scores, usage, renewal alerts
│   ├── /analytics      → Charts, funnels, attribution
│   └── /settings       → Integrations, billing, team management
│
└── Embeddable Widget   → Separate Vite bundle for chat agent
```

---

## Communication Patterns

| Pattern | Used For |
|---------|----------|
| REST API | All CRUD operations, standard requests |
| WebSocket | Live chat conversations (AI agent) |
| BullMQ Jobs | Async background tasks (email sending, enrichment) |
| Supabase Realtime | Live deal pipeline updates, notifications |
| Webhooks (inbound) | Email reply events, payment events, signature events |

---

## Multi-Tenancy Strategy

- Every DB table has `org_id` column
- Supabase Row Level Security (RLS) policies enforce tenant isolation
- JWT contains `org_id` claim set at login
- API Gateway injects org context into every request
- Redis keys namespaced by `org:{org_id}:*`

---

## Security

- All API routes require valid Supabase JWT
- RLS on all Supabase tables (no data leaks between orgs)
- Integration credentials encrypted at rest (AES-256)
- Rate limiting per org on API Gateway
- SendGrid sending domains verified per org (SPF/DKIM)
- No secrets stored in frontend bundle
