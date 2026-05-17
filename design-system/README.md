# SalesBuddy — Design System & Architecture

This folder contains all product decisions, feature specs, system design, and architecture rules for SalesBuddy.

## Files

| File | Description |
|------|-------------|
| `product-features.md` | Complete feature list by module |
| `system-design.md` | Full system architecture & service breakdown |
| `database-schema.md` | Supabase PostgreSQL schema |
| `tech-stack.md` | Technology decisions & reasons |
| `ai-pipeline.md` | AI flow from lead discovery to closed deal |
| `monorepo-structure.md` | NX monorepo folder structure |

## Product Vision

> Replace the entire sales team of a tech company with an AI-powered SaaS platform that autonomously prospects, outreaches, qualifies, demos, proposes, and closes deals.

## Tech Stack Summary

- **Frontend**: React + Vite + TypeScript + Tailwind + shadcn
- **Backend**: Node.js + Express (NX monorepo)
- **Database**: Supabase (PostgreSQL)
- **AI**: Claude API (claude-sonnet-4-6)
- **Queue**: BullMQ + Redis
- **Auth**: Supabase Auth
- **Billing**: Stripe
- **Deployment**: Vercel (web) + Railway (workers)
