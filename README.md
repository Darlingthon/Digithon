# TrustLine — Vera

An AI employee (**Vera**) that runs the **KYC** process end-to-end: identity
verification, a risk-based questionnaire across web + voice, AML screening, an
explainable decision, and a complete audit trail. When a customer stalls, Vera
calls them to finish the job.

See [AGENTS.md](AGENTS.md) for the full product spec and working rules.

## Monorepo layout

```
apps/
  web/        Next.js + TS (assistant-ui) — self-service UI + reviewer dashboard   (Track C)
  agent/      Python Google ADK — the Vera agent, decisioning, audit               (Track A)
packages/
  db/         Prisma schema + client + seed — the shared data model & state machine
  shared/     Shared TS types, the single-source questionnaire, mock fixtures
```

## Parallel tracks (3 people)

| Track | Owns | Issues |
|---|---|---|
| 🟣 Foundation | this scaffold | #1 |
| 🔵 A · Brain | `apps/agent`, decisioning, audit, metrics | #2, #3 |
| 🟢 B · Channels | Twilio SMS/OTP + Vera voice (gpt-realtime-2) | #4, #5 |
| 🔴 C · Frontend | `apps/web` — IDV, questionnaire, dashboard | #6, #7 |

The **data model** (`packages/db`), **case state machine**, **questionnaire**
(`packages/shared`), and **mock API** are the shared contract — build against
the fixtures, swap to live data as Track A lands it.

## Quick start

```bash
npm install                 # install JS workspaces
npm run db:up               # start Postgres (Docker)
npm run db:generate         # prisma generate
npm run db:migrate          # create tables
npm run db:seed             # 3 demo cases
npm run dev                 # web app at http://localhost:3000
```

Or all DB steps at once: `npm run bootstrap`.

Agent (separate, Python ≥ 3.10): see [apps/agent/README.md](apps/agent/README.md).

## Env

Copy `.env.example` → `.env` and fill in vendor keys (Twilio, OpenAI, Sumsub,
GCP). The DB URL already matches `docker-compose.yml`.

## Mock endpoints (live now)

- `GET /api/cases` — demo cases
- `GET /api/metrics` — the before/after success metrics
