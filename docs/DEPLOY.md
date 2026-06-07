# Deploying TrustLine to Cloud Run

Status: **artifacts ready, awaiting GCP project creds.** Dockerfiles for `web`
and `channels` are verified (they build and serve). The agent container is a
template for Track A. Sourced from Google's Cloud Run + ADK docs (not memory).

## What deploys where

| Service | Container | Port | Notes |
|---|---|---|---|
| `web` | `apps/web/Dockerfile` (Next.js standalone) | 3000 | ✅ verified build, 453 MB |
| `channels` | `apps/channels/Dockerfile` (Node + tsx) | 8080 | ✅ verified build; needs Twilio + DB secrets |
| `agent` | `apps/agent/Dockerfile` (ADK + uvicorn) | 8000 | template — Track A finalizes; or use `adk deploy cloud_run` |

## 0. Prereqs (once)

```bash
gcloud auth login                 # use the HACKATHON account, not a work one
export PROJECT_ID=trustline-hack  # your project
export REGION=us-central1
gcloud config set project $PROJECT_ID
gcloud auth configure-docker ${REGION}-docker.pkg.dev
```

The deploy script enables the required APIs (`run`, `cloudbuild`,
`artifactregistry`, `secretmanager`, `sqladmin`).

## 1. Database — pick one

The services need a `DATABASE_URL`. Two options:

**A. Managed Postgres (fastest — recommended for the hackathon).** Spin up a free
Neon / Supabase Postgres, put its connection string in `.env` as `DATABASE_URL`.
No Cloud SQL connector needed. The deploy script pushes it as a secret.

**B. Cloud SQL (per AGENTS.md, production path).** Provision (~10 min):
```bash
gcloud sql instances create trustline-db --database-version=POSTGRES_16 \
  --tier=db-f1-micro --region=$REGION --project $PROJECT_ID
gcloud sql databases create trustline --instance=trustline-db --project $PROJECT_ID
gcloud sql users set-password postgres --instance=trustline-db --password=... --project $PROJECT_ID
```
Then add to each `gcloud run deploy`: `--add-cloudsql-instances PROJECT:REGION:trustline-db`
and grant the runtime SA `roles/cloudsql.client` (the ADK deploy skill flags this
as the #1 cause of silent runtime auth failures). Use the Unix-socket
`DATABASE_URL=postgresql://...@localhost/trustline?host=/cloudsql/PROJECT:REGION:trustline-db`.

## 2. Secrets

Fill `.env` (Twilio, OpenAI, DATABASE_URL, Sumsub), then:
```bash
PROJECT_ID=$PROJECT_ID ./scripts/deploy-cloudrun.sh secrets
```
This creates/updates Secret Manager entries. Grant the Cloud Run runtime SA
`roles/secretmanager.secretAccessor` (the default compute SA, or a dedicated one).

## 3. Deploy

```bash
PROJECT_ID=$PROJECT_ID ./scripts/deploy-cloudrun.sh all        # web + channels
# or individually:
PROJECT_ID=$PROJECT_ID ./scripts/deploy-cloudrun.sh web
PROJECT_ID=$PROJECT_ID ./scripts/deploy-cloudrun.sh channels
```

The script builds `--platform linux/amd64` images (Cloud Run is amd64), pushes to
Artifact Registry, and deploys. It prints the service URLs at the end. After the
first `web` deploy, set `WEB_PUBLIC_URL` to its URL and redeploy `channels` so the
SMS links point at the deployed web app; set `CHANNELS_PUBLIC_URL` to the channels
URL so Twilio callbacks resolve.

## 4. Migrate the database

Run against the prod `DATABASE_URL` (from your machine, or a Cloud Run job):
```bash
DATABASE_URL='<prod url>' npx prisma migrate deploy --schema packages/db/prisma/schema.prisma
DATABASE_URL='<prod url>' npx tsx packages/db/prisma/seed.ts   # demo cases
```

## 5. Verify with the smoke harness

The same harness that runs locally validates the deployed env — just point it:
```bash
WEB_URL=https://web-xxxxx.run.app \
CHANNELS_URL=https://channels-xxxxx.run.app \
READONLY=1 npm run smoke
```
Use `READONLY=1` against shared/prod so it doesn't mutate case state or send SMS.

## 6. Twilio webhooks (channels)

Point your Twilio number at the deployed channels service:
- Messaging "A message comes in" → `https://channels-xxxxx.run.app/webhooks/sms`
- Voice "A call comes in" → `https://channels-xxxxx.run.app/voice`
- Status callback → `https://channels-xxxxx.run.app/webhooks/sms-status`

With real creds the service leaves dry-run automatically and validates
`X-Twilio-Signature` on every webhook.

## Agent (Track A)

Two paths (per the ADK Cloud Run docs):
```bash
# A. ADK CLI (no Dockerfile)
pip install google-adk
adk deploy cloud_run --project $PROJECT_ID --region $REGION apps/agent

# B. Container (apps/agent/Dockerfile, uses get_fast_api_app + uvicorn)
PROJECT_ID=$PROJECT_ID  # extend deploy-cloudrun.sh with a deploy_agent() mirroring web
```
Set `GOOGLE_GENAI_USE_VERTEXAI` + `GOOGLE_API_KEY` (or Vertex/ADC) as env/secrets.

## Rollback

```bash
gcloud run revisions list --service web --region $REGION
gcloud run services update-traffic web --to-revisions REVISION=100 --region $REGION
```

## Follow-ups / known gaps

- Min instances default 0 → cold starts. Set `--min-instances=1` on the demo
  service before presenting.
- Image sizes: `web` ~453 MB, `channels` ~750 MB (scoped prod install excludes
  the monorepo's Next.js deps; remainder is the Node base + Prisma engine). An
  Alpine/musl base could shave more but needs Prisma `binaryTargets` tuning.
