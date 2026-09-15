# BizPilot — Your AI business manager

BizPilot is an **AI Business Operating System for South African SMEs**, starting with service businesses (plumbers, electricians, handymen, builders, painters, cleaners, gardeners, appliance repair, mechanics, solar, security, HVAC).

One platform that acts like an AI employee: it answers WhatsApp enquiries, qualifies and scores leads, drafts quotes from **your configured prices**, schedules jobs onto real technicians, sends invoices, chases overdue payments, requests reviews and briefs you every morning.

---

## 1. Project structure

```
src/
  app/
    page.tsx                 # Premium marketing landing page (SEO + JSON-LD)
    auth/page.tsx            # Login / register / one-click demo
    onboarding/page.tsx      # 6-step business onboarding wizard
    dashboard/               # App shell (protected, multi-tenant)
      layout.tsx             #   session → tenant → Shell
      page.tsx               #   Dashboard: daily briefing, KPIs, insights
      inbox/                 #   WhatsApp-first inbox + AI receptionist
      leads/                 #   Drag-and-drop pipeline + AI scoring
      customers/             #   CRM with spend/jobs/timeline
      jobs/                  #   Job cards, technician workflow, scheduling
      quotes/                #   Quote generator, VAT, PDF/print, convert-to-job
      invoices/              #   Invoices, payments, AI reminders
      analytics/             #   Full BI + AI insights
      settings/              #   Profile, services, team, hours, AI, knowledge, integrations, subscription
    admin/page.tsx           # Platform admin (MRR, tenants, AI usage)
    api/
      health/route.ts        # Health check
      [...path]/route.ts     # REST dispatcher: auth, tenant + RBAC checks
    manifest.ts / robots.ts / sitemap.ts   # PWA + SEO
  server/
    core.ts        # Auth (scrypt), sessions, RBAC, tenant guards, rate limiting,
                   #   payment + messaging provider abstractions, notifications, audit
    ai.ts          # AI engine: intent tools, lead scoring, scheduling engine,
                   #   briefing, insights, receptionist, action executors, chat stream
    handlers.ts    # All REST handlers (customers, leads, conversations, jobs,
                   #   quotes, invoices, payments, knowledge, subscription, admin…)
    seed.ts        # Demo tenant: Thando Plumbing & Electrical (fully seeded)
  db/schema.ts     # 40+ table PostgreSQL schema (Drizzle ORM)
  lib/             # Client API helper, SA formatting, i18n foundation
  components/      # UI kit, charts, shell, AI panel, theme
```

## 2. Database schema

Multi-tenant: every business row carries `businessId`; every query is tenant-scoped by the auth middleware. Key tables:

`users, sessions, businesses, business_members, subscriptions, subscription_events, customers, customer_addresses, leads, lead_activities, conversations, messages, services, service_prices, team_members, working_hours, appointments, jobs, job_photos, quotes, quote_items, invoices, invoice_items, payments, expenses, reviews, notifications, notification_settings, ai_agents, ai_conversations, ai_messages, ai_actions, ai_usage, knowledge_documents, knowledge_chunks, business_settings, integrations, audit_logs`

Apply the schema:

```bash
npx drizzle-kit push
```

## 3. Environment variables

See `.env.example`. **Nothing is required for local dev** — mock providers handle WhatsApp/Yoco/SMTP and the AI engine is on-device.

- `DATABASE_URL` — PostgreSQL (Neon in prod)
- `NEXT_PUBLIC_APP_URL` — public base URL
- `AI_API_KEY / AI_BASE_URL / AI_MODEL` — optional external LLM
- `WHATSAPP_API_KEY / WHATSAPP_PHONE_NUMBER_ID` — Meta WhatsApp Cloud API
- `YOCO_MERCHANT_KEY / YOCO_SECRET / YOCO_CLIENT_ID` — Yoco payments
- `SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / SMTP_FROM` — email

## 4. Setup

```bash
cp .env.example .env      # set DATABASE_URL
npm install
npx drizzle-kit push      # apply schema
npm run dev               # http://localhost:3000
```

**Demo login:** on the sign-in page click **“Explore the live demo business”** (or `demo@bizpilot.co.za` / `demo1234`) — signs into a fully seeded Cape Town plumbing & electrical business with leads, jobs, quotes, invoices, conversations and AI activity.

**Platform admin:** `admin@bizpilot.co.za` / `admin1234` → `/admin`.

## 5. Authentication flow

1. `POST /api/auth/register` — scrypt-hashed password, session token in DB.
2. Session cookie `bp_session` (httpOnly, sameSite=Lax, 30 days, secure in prod).
3. Onboarding creates the tenant: business + owner membership + 14-day trial + AI agents + settings + working hours.
4. Every request re-resolves session → user → active membership → role; tenant scope is injected into every handler.

## 6. API architecture

REST-style endpoints served by one validated dispatcher (`app/api/[...path]/route.ts`): auth + tenant resolution, per-route RBAC caps, rate limiting (in-memory bucket, Redis-ready), JSON validation, and a uniform error contract `{ error, code, data }`.

Key routes: `/api/auth/*`, `/api/business*`, `/api/onboarding`, `/api/customers`, `/api/leads` (+`/convert`), `/api/conversations`, `/api/messages`, `/api/services`, `/api/team` (+`/availability`), `/api/jobs` (+`/photos`), `/api/quotes` (+`/duplicate`), `/api/invoices`, `/api/payments`, `/api/notifications`, `/api/analytics`, `/api/ai/{briefing,chat,confirm,history,activity}`, `/api/knowledge`, `/api/subscription/*`, `/api/search`, `/api/admin/overview`, `/api/demo`, `/api/health`.

## 7. AI architecture

- **On-device deterministic engine** (no external LLM required): intent parsing → typed **tools** that query the tenant's own database → composed answer with data cards. It never fabricates prices, availability or figures; when data is missing it asks.
- **Tool examples:** `computeKpis`, `revenueByService`, `overdueInvoices`, `findSlot` (scheduling engine), `scoreLeadSignal`, `techPerformance`, `quoteAcceptance`, `createQuote`, `createJob`, `sendPaymentReminders`, `followUpLeads`, `reassignJob`, `requestReviews`.
- **Streaming:** `POST /api/ai/chat` streams NDJSON events (status → card → text → action → done) so the UI shows which agent is working.
- **Human-in-the-loop:** consequential actions create an `ai_actions` row with status `suggested`; the UI shows a confirmation card; `POST /api/ai/confirm` executes (or cancels). Autonomy levels: *suggest / confirm / autonomous* (routine actions only).
- **Audit:** every AI action is stored with agent, reason, input, result and confirming user — surfaced in Settings → AI activity.

## 8. AI agents implemented

AI Receptionist (inbox auto-reply, escalation, lead capture & scoring) · AI Sales Agent (lead ranking, follow-ups, quote drafting) · AI Scheduling Agent (availability engine, conflict detection, job booking, reassignment) · AI Finance Agent (overdue detection, reminders) · AI Customer Success Agent (post-job review requests, win-backs) · AI Business Analyst (KPIs, service profitability, technician output) · AI CEO Agent (briefing, cross-domain Q&A, recommendations). All seven are toggleable per business in Settings.

## 9. Integrations implemented

- **In-app messaging** (fully wired) with WhatsApp-style inbox
- **Notifications:** in-app + provider fan-out (email/WhatsApp mock)
- **PWA:** manifest, icon, service worker (offline shell), installable
- **Search:** global command palette (⌘K)

## 10. Integration placeholders (mock providers, clearly labelled)

- **WhatsApp Business API** (Meta Cloud) — mock logs until `WHATSAPP_*` set
- **Yoco payments** — mock until `YOCO_*` set; EFT/cash work now
- **SMTP email** — mock until `SMTP_*` set
- **Google Calendar, Facebook/Instagram, voice AI, accounting/CIPC/SARS** — architecture slots in place for the roadmap (voice, lending marketplace, multi-country)

## 11. Seed / demo data

`POST /api/demo` (or the button on the login page) idempotently seeds **Thando Plumbing & Electrical**: 8 customers, 9 scored leads, 14 jobs (6 today, incl. a real schedule conflict the AI recommends fixing), 6 quotes, 8 invoices (R8,400 overdue), payments, WhatsApp conversations (one AI-handled, one escalated), reviews, knowledge docs, AI activity and notifications — all dated relative to today so the product always looks alive.

## 12. Deployment (production)

1. Provision PostgreSQL (Neon) → set `DATABASE_URL`.
2. `npx drizzle-kit push` (or manage migrations).
3. Set `NEXT_PUBLIC_APP_URL`, and provider credentials (WhatsApp/Yoco/SMTP) as available.
4. `npm run build && npm start` behind a TLS host (Vercel, Fly, Render).
5. Serve `sw.js` at the root; the PWA is installable immediately.

## 13. Security

- scrypt password hashing, DB-stored sessions, httpOnly cookies
- Tenant isolation on **every** query (business-scoped selects/updates/deletes)
- RBAC: owner / admin / manager / technician / accountant (+ platform admin)
- Rate limiting per IP+route, input validation, parameterised SQL (Drizzle), no secrets in the client bundle, uniform non-leaking error messages, full audit + AI activity trails, photo upload size caps

## 14. Testing

- **Demo walkthrough:** sign in via demo → read the briefing → apply the AI recommendation → open the escalated conversation and reply → simulate a customer message (Inbox → Simulate) → convert a lead to a quote → complete a job (review request fires) → record a payment → ask BizPilot “Which invoices are overdue?” and send reminders.
- **AI:** “How is my business doing?”, “Create a quote for Sarah — geyser replacement”, “Book Sarah for tomorrow at 10”, “Why did revenue fall this month?”
- **RBAC:** register a second user; manager cannot open Settings → Subscription; technician only sees own jobs.
- `npm run build` includes full TypeScript + Next type generation.
