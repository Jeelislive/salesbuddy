# SalesBuddy — Features Roadmap

Features a real sales team needs. Work top-to-bottom.

---

## 🔴 High Priority (core workflow gaps)

### 1. Reply Detection + Auto-Stop Sequence
- Poll Gmail inbox for replies to sent sequence emails
- Match reply by `In-Reply-To` / `References` header against `gmail_message_id` in `email_logs`
- When reply detected: mark enrollment as `replied`, stop further steps
- Show "Replied" status badge on enrollment in Outreach page
- **Why first:** sending follow-ups after a lead replies kills deals

### 2. Email Open & Click Tracking
- Inject 1×1 tracking pixel into sent HTML emails (unique URL per email_log)
- Add a `/track/open/:token` endpoint that logs the open and returns a transparent GIF
- Wrap links with `/track/click/:token?url=...` redirect
- Store `opened_at`, `clicked_at` in `email_logs`
- Show open rate / click rate in Analytics and sequence performance table
- **Why:** reply rate shows 0% forever without this; core sales metric

### 3. Tasks & Reminders
- Tasks table: `id, workspace_id, lead_id, deal_id, title, due_at, completed_at, assigned_to`
- Create tasks from lead detail, deal card, or manually
- Dashboard widget: "Due today" task list
- Email/in-app notification when task is due
- **Why:** sales reps live in their task list; without it they forget to follow up

### 4. Lead Activity Timeline
- Per-lead view: full chronological log of every touchpoint
- Events: email sent, email opened, email clicked, replied, task completed, note added, status changed
- Single source of truth before a sales call
- **Why:** reps need context before every interaction

### 5. Notes on Leads & Deals
- Freeform text notes with timestamps, attached to a lead or deal
- Visible in lead detail popup and deal card
- **Why:** call notes, meeting outcomes — essential for any CRM

---

## 🟡 Medium Priority

### 6. Team Members & Role-Based Access
- Invite team members to workspace via email
- Roles: `admin` (full access), `member` (own leads/deals), `viewer` (read-only)
- Lead/deal assignment — assign to a specific rep
- Activity feed showing team actions

### 7. Deal Stage Customization
- Let users create, rename, reorder, delete pipeline stages
- Set probability % per stage
- Drag-and-drop Kanban board view for deals

### 8. Win/Loss Tracking
- Mark deals as Won or Lost with a reason field
- Close rate, average deal size, win rate by stage in Analytics
- Revenue forecasting based on probability × amount

### 9. Calendar & Meeting Booking
- Google Calendar OAuth integration
- Generate a booking link (Calendly-style) for a rep's calendar
- Log scheduled meetings as lead activity events
- "Book a call" CTA button auto-insertable in email sequences

### 10. Slack / Email Notifications
- Notify via Slack webhook when: lead replies, deal stage changes, task due, sequence completes
- In-app notification bell with unread count
- Daily digest email: tasks due today, replies received, deals moving

---

## 🟢 Lower Priority

### 11. A/B Testing for Email Sequences
- Define 2 variants (A/B) for subject line or body per step
- Split enrollments 50/50 automatically
- Report open rate / reply rate per variant in Analytics

### 12. LinkedIn Outreach
- We already scrape LinkedIn profiles
- Send connection requests + DMs via LinkedIn automation (Puppeteer)
- Track LinkedIn touchpoints in activity timeline

### 13. Webhooks & Zapier Integration
- Outbound webhooks on events: lead created, deal won, reply received
- Zapier app — push/pull leads, trigger sequences
- HubSpot / Salesforce two-way sync

### 14. SMS Sequences
- Twilio integration for text-based follow-up steps
- Mix email + SMS steps in a single sequence
- Opt-out handling (STOP keyword)

### 15. Company Enrichment
- Auto-enrich lead's company: funding round, headcount, tech stack, industry
- Sources: Clearbit (paid) or free alternatives (LinkedIn scrape, Crunchbase)
- Show enriched company data in lead detail
