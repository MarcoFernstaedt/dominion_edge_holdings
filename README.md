# Dominion Edge Holdings — Acquisition Operating System (AOS)

A full-stack, AI-augmented operating system built for small business acquisition operators following the **QLA (Quiet Light Acquisitions) methodology**. Purpose-built for a single-principal firm executing on its first acquisition.

---

## Overview

Dominion Edge AOS combines deterministic scoring engines, relationship intelligence, capital access tools, and AI-generated drafts into a unified command center. Every scoring function is deterministic and auditable. AI is used only for commentary and document drafting — never for scoring decisions.

**Current operator:** Marco Fernstaedt · Phoenix, AZ
**Target profile:** Service businesses (pest control, HVAC, plumbing) · $1–3M SDE · SBA-eligible · Owner-operated

---

## Architecture

```
dominion_edge_holdings/
├── frontend/             # Next.js 14 · React 18 · TypeScript · Tailwind CSS
│   └── src/
│       ├── app/          # App Router pages (48 pages across 12 modules)
│       ├── components/   # Shared UI components + layout
│       └── lib/          # API client, Zustand store, auth utils, types
└── backend/              # Node.js · Express 5 · ES Modules
    ├── src/              # Production entry point (Prisma-backed, JWT auth)
    │   ├── app.js        # Express factory — routes, middleware, auth guard
    │   ├── index.js      # Server listen + job scheduler + process handlers
    │   ├── controllers/  # Route handlers (thin, delegate to services/repos)
    │   ├── routes/       # Express routers (one file per domain)
    │   ├── middleware/    # auth, validate, errorResponse, globalError
    │   ├── jobs/         # Background job definitions (isolated handlers)
    │   ├── config/       # env.js — single source of truth for all env vars
    │   └── lib/          # logger, prisma client, helpers
    ├── services/         # Deterministic domain service modules
    ├── agents/           # Claude-powered AI agents
    ├── adapters/         # Integration adapters (Apollo, Google, S3)
    ├── db/               # Prisma repo layer (repo.js + healthPing)
    ├── prisma/           # schema.prisma + migrations
    └── tests/            # Jest + Supertest integration tests
```

### Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14.2, React 18, TypeScript 5.6, Tailwind CSS 3.4 |
| State | Zustand 5 (localStorage-persisted) |
| Backend | Node.js + Express 5.2, ES Modules |
| AI | Anthropic Claude (Sonnet/Haiku) via `@anthropic-ai/sdk` |
| Validation | Zod (both frontend and backend) |
| Security | Helmet, CORS allowlist, express-rate-limit |
| Testing | Vitest (frontend), Jest + Supertest (backend) |

---

## Modules

### Operations

| Module | Route | Description |
|---|---|---|
| Command Center | `/command-center` | Unified dashboard: next action, firm scores, credibility index, alerts, daily affirmation |
| Playbook | `/playbook` | Stage-based QLA playbook with daily task queue |
| Execution Tracker | `/execution` | Daily/weekly/monthly KPI tracking, pipeline health, board/investor conversation counts |
| Checklist | `/checklist` | 82-item QLA acquisition checklist with proof submission |

### Deal Flow

| Module | Route | Description |
|---|---|---|
| Pipeline | `/pipeline` | 8-stage kanban deal pipeline with DSCR health indicators |
| Sourcing Radar | `/pipeline/sourcing-radar` | Automated lead sourcing with multi-adapter support (manual, CSV, broker) |
| Deal Feed | `/deal-feed` | Deal marketplace with scoring and import-to-pipeline workflow |
| Underwriting | `/underwriting` | DSCR calculator, scenario modeling, SBA loan structuring |

### Relationships & Board

| Module | Route | Description |
|---|---|---|
| CRM | `/crm/companies`, `/crm/contacts` | Company and contact management |
| Board | `/board` | Board seat assembly (6 required roles), candidate tracking, cap table, real-time seat health scores |
| Relationships | `/relationships` | Relationship management engine with interaction tracking, follow-up scheduling |
| Network Intelligence | `/network` | Credibility index, board readiness score, investor readiness gaps, network leverage alerts |
| Conversations | `/conversations` | Weekly KPI targets for owner/board/investor conversation cadence |

### Capital

| Module | Route | Description |
|---|---|---|
| Capital Raising | `/capital-raising` | Investor CRM, capital stack modeling, investor memos, firm messaging, pitch decks |
| Artifacts | `/artifacts` | AI-generated document management with approval workflow and export tracking |

### Communication

| Module | Route | Description |
|---|---|---|
| Outreach | `/outreach` | Email outreach templates and AI draft generation |
| Meetings | `/meetings` | Meeting scheduling and AI-powered prep packets |
| Inbox | `/inbox` | Email thread management with AI reply suggestions |

### Intelligence

| Module | Route | Description |
|---|---|---|
| AI Agents | `/agents` | 10 specialized Claude agents: Deal Analysis, Board Builder, Investor Outreach, Strategy Advisor, CRM Steward, Lead Discovery, Meeting Prep, Response Analysis, Daily Operations, Outreach Execution |
| Documents | `/documents` | Legal template library (LOI, board invite, deal memo, diligence checklist) with attorney-review warnings |
| Reports | `/reports` | Summary exports and reporting |

---

## Intelligence Engines (Backend)

All scoring is deterministic. AI annotates; it never recomputes scores.

### BoardSeatEngine
Calculates health state per seat (`empty → weak → developing → active → secured`) and risk level (`low → moderate → high → critical`). Industry veteran and capital connector receive elevated priority weighting. Outputs board readiness score (0–100) with 8 component breakdown.

### BoardCandidateScoring
Fit score (0–100) across 9 components — seat relevance, seniority, credibility, network, warm intro availability, response quality, time burden, and advisory fit. Commitment probability with 7 signal inputs. Stale candidate penalty for no contact in 21+ days.

### RelationshipGraph
BFS intro path finding (1–2 hop maximum) with 6-component path score: path length, edge strength, recency, relationship trust, intermediary influence, reliability. Contact centrality scoring across 5 dimensions.

### RelationshipScoring
10-state relationship lifecycle: `identified → known → contacted → engaged → responsive → trusted → advocate → cooling → stalled → archived`. Advocate detection (warm+hot sentiment, ≥2 replies, ≥1 intro, trust ≥60). Next-move recommendation engine with touch urgency.

### InvestorScoring
Fit score across 9 components including warm intro strength and investor thesis relevance. Warmth states: `cold → warm → warm_intro_available → engaged → active → soft`. 11-stage investor funnel from `identified` to `committed/passed`. Soft circle probability (directional signal).

### CredibilityIndex
9-component firm-level credibility score (0–100). Labels: `limited → early_stage → developing → credible → elite`. Downstream signals: investor readiness boost, warm intro ask confidence, outreach urgency. Gap list with actionable descriptions.

### NetworkAlerts
10 alert types covering cooling relationships, unused warm intros, weak board seats, stalled investors, and low meeting traction. Severity: `info → watch → important → critical`. Feeds the command center network summary.

### ArtifactStore
20 artifact types with approval workflow and staleness tracking. Source snapshot hashing for provenance and staleness detection. Approval state machine: `draft → submitted_for_approval → approved/rejected/revision_requested → sent/exported`. Version groups (groupId links artifact versions).

### ExportService
Eligibility gating: approval-required artifacts (email drafts, letters, memos, board pitches) must be approved before external export. Export types: `email, pdf, docx, clipboard, board_portal, lender_portal, investor_portal`. Full audit trail with provenance snapshot (version, approval state, content hash) at export time.

### NotificationService
20 notification types across approvals, tasks, meetings, deals, board, investors, and artifacts. Pinned alerts (persist until state improves) vs. feed alerts (ephemeral). Per-type deduplication windows. Severity: `info → watch → important → critical`.

---

## Key API Endpoints

```
GET    /health

# Board Intelligence
GET    /api/board/seats/health
GET    /api/board/seats/:seatType/candidates
GET    /api/board/candidates/:id/fit

# Credibility & Network
GET    /api/credibility
GET    /api/command-center/network
GET    /api/network/alerts
GET    /api/network/intro-paths
GET    /api/relationships/graph
GET    /api/relationships/high-value
GET    /api/relationships/:id/network-context
POST   /api/relationships/:id/next-move
POST   /api/relationships/edges

# Investors
GET    /api/investors/funnel
GET    /api/investors/high-fit
GET    /api/investors/readiness-gaps
GET    /api/investors/:id/fit

# Notifications
GET    /api/notifications
POST   /api/notifications/:id/read
POST   /api/notifications/:id/dismiss
POST   /api/notifications/mark-all-read

# Artifacts & Export
POST   /api/artifacts/generate
POST   /api/artifacts/:id/regenerate
POST   /api/artifacts/:id/archive
POST   /api/artifacts/:id/export
GET    /api/exports
GET    /api/exports/:id/audit
POST   /api/exports/:id/complete
POST   /api/exports/:id/cancel

# Quick Actions (mobile-first)
POST   /api/quick-log
POST   /api/quick-action/next-action/open
POST   /api/quick-action/proof-submit
POST   /api/quick-action/approve-and-send
```

---

## Security

- **Helmet.js** — Content Security Policy, clickjacking prevention, HSTS
- **CORS allowlist** — Never wildcard; defaults to `localhost:3000` in development
- **Rate limiting** — 500 req/15min general; 20 req/min for AI endpoints
- **Input validation** — Zod schemas on all POST/PATCH routes (frontend and backend)
- **Error sanitization** — Stack traces never returned in production responses
- **Request IDs** — Every request tagged for distributed tracing
- **No credentials in frontend** — SMTP passwords and API keys backend-only via `.env`
- **Single-user design** — Add JWT/session auth before any multi-user deployment

---

## Setup

### Prerequisites

- Node.js 20+
- Anthropic API key

### Install all dependencies

```bash
npm run install:all
```

### Backend environment

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

```env
ANTHROPIC_API_KEY=sk-ant-...
PORT=3001
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:3000

# Optional — for email features
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@gmail.com
SMTP_PASS=app-password
FROM_EMAIL=you@gmail.com
FROM_NAME=Dominion Edge Holdings
```

### Frontend environment

```bash
cp frontend/.env.local.example frontend/.env.local
```

Edit `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### Run (development)

```bash
npm run dev           # starts frontend (port 3000) + backend (port 3001) concurrently
npm run dev:frontend  # frontend only
npm run dev:backend   # backend only
```

---

## Testing

```bash
# Backend — Jest + Supertest
cd backend && npm test

# Frontend — Vitest
cd frontend && npm test
cd frontend && npm run test:coverage
```

### Test suites

| File | Scope |
|---|---|
| `backend/tests/server.test.js` | Core API routes: CRUD, CORS, validation, security (55+ tests) |
| `backend/tests/services.test.js` | Service unit tests: DSCR, scoring, automation, cache |
| `backend/tests/spec3_spec4.test.js` | Spec 3+4: Board Intelligence, Credibility, Network Alerts, Notifications, Artifacts, Export, Quick Actions |
| `frontend/src/lib/__tests__/utils.test.ts` | Financial math and utility functions: DSCR, SDE, formatters, date utils |

---

## Build for Production

```bash
cd frontend && npm run build   # Next.js optimized build
cd frontend && npm start       # Production server (port 3000)
```

---

## Deployment

### Backend → Railway

```
Start command:  node server.js
Environment:
  ANTHROPIC_API_KEY=sk-ant-...
  PORT=3001
  NODE_ENV=production
  ALLOWED_ORIGINS=https://your-vercel-domain.vercel.app
```

### Frontend → Vercel

```
Framework:    Next.js
Build:        npm run build
Environment:
  NEXT_PUBLIC_API_URL=https://your-backend.railway.app
```

---

## Cost Estimate

| Service | Monthly |
|---|---|
| Anthropic API (moderate daily use) | $10–30 |
| Railway (backend hosting) | $5–10 |
| Vercel (frontend hosting) | Free tier |
| **Total** | **~$15–40/month** |

---

## Design System

Strict dark-mode-first. All UI uses these exact tokens — no amber, no off-brand colors.

| Token | Value | Usage |
|---|---|---|
| Background primary | `#0A0A0A` | App chrome background |
| Background elevated | `#111111` | Sidebar, drawer panels |
| Background card | `#141414` | Cards, list items |
| Background hover | `#1A1A1A` | Interactive hover states |
| Border subtle | `#262626` | Dividers, header borders |
| Border default | `#2A2A2E` | Card borders |
| Border strong | `#3A3A3E` | Focus/hover borders |
| Text primary | `#E8E6E3` | Headings, body copy |
| Text muted | `#A7A29A` | Secondary text, labels |
| Text dim | `#737373` | Placeholders, metadata |
| Accent gold | `#C9A227` | Brand color, active nav, CTAs |
| Success green | `#3FA66B` | Confirmed seats, positive status |
| Error red | `#C35B5B` | Destructive, critical alerts |

Fonts: System serif for headings (`font-serif`), system sans-serif for body. No external font dependencies.

---

## Project Status

| Batch | Status | Description |
|---|---|---|
| Core Platform | Complete | CRM, Pipeline, Board, Underwriting, Checklist, Playbook |
| AI Agent Suite | Complete | 15 Claude agents with PromptRegistry |
| Credibility & Network | Complete | Board Intelligence, Relationship Graph, Investor Scoring, Credibility Index, Network Alerts |
| Artifacts & Approvals | Complete | ArtifactStore, NotificationService, ExportService, Quick Actions |
| Batch 2 — Integrations | Complete | Google Workspace (Gmail + Calendar), Apollo enrichment, S3 object storage, integration registry/health |
| Batch 3 — Auth | Complete | JWT + httpOnly cookie auth, global route protection, requireRole, audit log actor tracking, first-run setup |
| Batch 4 — Reliability | Complete | BackgroundJobRunner retry/backoff, health endpoint integration status, admin route fixes, structured logging |
| Batch 5 — Polish | Complete | Dead code removal, env consolidation, deployment-ready config |

### Production Prerequisites

| Requirement | Variable | Notes |
|---|---|---|
| Database | `DATABASE_URL` | PostgreSQL; run `npx prisma migrate deploy` before first boot |
| Auth secret | `AUTH_JWT_SECRET` | Min 32 random bytes; required in production |
| AI (optional) | `ANTHROPIC_API_KEY` | Needed for AI drafts, briefings, agents |
| Gmail + Calendar | `GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN` | OAuth2 — required for inbox/meeting sync |
| Apollo | `APOLLO_API_KEY` | Lead discovery and contact enrichment |
| Object storage | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET` | S3 or compatible (R2, MinIO, B2) |
| Frontend URL | `ALLOWED_ORIGINS` | Comma-separated CORS origins for production frontend |
| System user | `SYSTEM_USER_ID` | Set after first `POST /api/auth/setup` |

---

## Legal

All document templates (LOI, board invite, deal memo) are draft templates only. Attorney review is required before any legal or business use.

Deal feed web scraping is intentionally disabled. Use manual entry, CSV import, or official broker APIs.

---

*Dominion Edge AOS — Built to operate at the edge of opportunity.*
