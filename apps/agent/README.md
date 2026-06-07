# Vera agent (Track A)

Google ADK agent that drives a KYC case end-to-end.

## Setup (needs Python ≥ 3.10)

```bash
cd apps/agent
python3.11 -m venv .venv && source .venv/bin/activate
pip install -e .
cp ../../.env.example ../../.env   # fill local DB/Sumsub/GCP values; never commit it
```

## Run

```bash
python -m vera.main        # constructs the agent / prints sanity check
adk run vera               # interactive ADK session (once ADK is installed)
```

## What's here

- `vera/state_machine.py` — case lifecycle, mirror of `packages/db/src/index.ts`. Keep in sync.
- `vera/main.py` — Vera instruction (trust & safety rules baked in) + ADK tools.
- `vera/repository.py` — Postgres-backed case actions + audit writes for local ADK runs.

## Brain API contract

- `POST /api/cases` creates a case and moves it to `IDV_PENDING`.
- `POST /api/cases/:caseId/actions/*` drives IDV, questionnaire, screening, decision, and call transcript writes.
- `GET /api/cases/:caseId/audit` returns ordered audit events.
- `GET /api/metrics` returns live dashboard metrics.

## Sumsub sandbox

Set `SUMSUB_APP_TOKEN`, `SUMSUB_SECRET_KEY`, `SUMSUB_BASE_URL`, and optionally `SUMSUB_LEVEL_NAME` in local `.env`. If credentials or level are missing, Brain records a refer-safe screening result instead of crashing.
