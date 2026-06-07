# Vera agent (Track A)

Google ADK agent that drives a KYC case end-to-end.

## Setup (needs Python ≥ 3.10)

```bash
cd apps/agent
python3.11 -m venv .venv && source .venv/bin/activate
pip install -e .
cp ../../.env.example .env   # fill in GOOGLE_API_KEY / Vertex config
```

## Run

```bash
python -m vera.main        # constructs the agent / prints sanity check
adk run vera               # interactive ADK session (once ADK is installed)
```

## What's here

- `vera/state_machine.py` — case lifecycle, mirror of `packages/db/src/index.ts`. Keep in sync.
- `vera/main.py` — Vera instruction (trust & safety rules baked in) + the case-action tool stubs.

## Track A TODO (issues #2, #3)

- Wire tool stubs to Postgres using the `@trustline/db` schema.
- Single-source questionnaire engine (consume `packages/shared/src/questionnaire.ts`).
- AML screening via Sumsub; explainable decision engine; audit-event writes; metrics feed.
- Deploy to Cloud Run.
