# Dominion Edge Holdings — QLA Acquisition Platform

Full-stack private acquisition platform for Marco Fernstaedt, built on Dan Peña's QLA methodology from *Your First Hundred Million*.

## Modules

1. **Dashboard** — Daily command center with affirmations, progress stats, and phase bars
2. **QLA Checklist** — 82-item accordion checklist across 9 phases (Foundation → Exit)
3. **Board CRM** — Track all 6 advisory board seats from candidate to equity agreement
4. **Deal Pipeline** — Target tracking across 8 stages from Identified to Closed
5. **Capital (DSCR)** — Live SBA 7(a) deal modeler with real-time pass/fail DSCR output
6. **Scripts** — 6 word-for-word scripts for seller outreach and board recruitment
7. **AI Agents** — 6 specialized Claude-powered advisors (Peña Coach, Deal Scout, Outreach Writer, Board Builder, Deal Structurer, Market Intel)
8. **Resources** — Timeline, key URLs, and Peña's 8 core principles

## Stack

- **Frontend**: React + Vite — deploy on Vercel
- **Backend**: Node.js + Express — deploy on Railway
- **AI**: Anthropic API (`claude-sonnet-4-20250514`)
- **Storage**: localStorage (persistent across browser sessions)

## Local Development

### Backend

```bash
cd backend
cp .env.example .env
# Set ANTHROPIC_API_KEY in .env
npm install
npm run dev
```

### Frontend

```bash
cd frontend
cp .env.example .env
# VITE_API_URL defaults to http://localhost:3001
npm install
npm run dev
```

### Both at once (from root)

```bash
npm install
npm run dev
```

## Deployment

### Backend → Railway

1. Connect Railway to this repo, set root directory to `/backend`
2. Add env var: `ANTHROPIC_API_KEY=sk-ant-...`
3. Railway auto-detects Node.js and runs `npm start`

### Frontend → Vercel

1. Connect Vercel to this repo, set root directory to `/frontend`
2. Add env var: `VITE_API_URL=https://your-backend.railway.app`
3. Build: `npm run build` | Output: `dist`

## Cost Estimate (Monthly)

| Service | Cost |
|---------|------|
| Anthropic API (heavy daily use) | $10–25 |
| Railway backend | Free → $5 |
| Vercel frontend | Free |
| **Total** | **$10–30** |

## First Acquisition Target

- Industry: Pest Control — Phoenix Metro
- Revenue: $1.5M–$3M
- EBITDA/SDE: $200K–$500K
- Price: $800K–$2.5M (4–5x SDE)
- Financing: SBA 7(a) + Seller Note
- DSCR requirement: ≥ 1.25x (non-negotiable)
