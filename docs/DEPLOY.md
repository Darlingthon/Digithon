# Deploying TrustLine

Two ways to run the whole stack: **one Docker Compose** (local / single box) or
**Cloud Run + Cloud SQL** (managed). Cost estimate: [COSTS.md](./COSTS.md).

## What runs where

| Service | Container | Port | Notes |
|---|---|---|---|
| `web` | `apps/web/Dockerfile` (Next.js standalone) | 3000 | reviewer UI + customer pages + API |
| `channels` | `apps/channels/Dockerfile` (Node + tsx) | 8080 | Twilio SMS/OTP/voice + fallback sweep; needs Twilio + OpenAI + DB |
| `agent` | `apps/agent/Dockerfile` (ADK + uvicorn) | 8000 | `adk` chat agent; needs `GOOGLE_API_KEY` + DB |
| `postgres` | `postgres:16` (compose) / Cloud SQL | 5432 | one shared database (the spine) |

---

## A. Local — one Docker Compose

```bash
cp .env.example .env            # fill in secrets
docker compose up -d postgres   # just the DB (for `npm run dev`)
# …or the whole stack:
docker compose up --build       # postgres + migrate/seed + web + channels + agent
```
Apps read secrets from `.env` (`env_file`); compose overrides the DB host and
`CHANNELS_URL` for the internal network. `web` → :3000, `channels` → :4000,
`agent` → :8000.

For **stable public URLs** during a demo (so SMS links open on a phone and Twilio
can reach the voice bridge), use a Cloudflare **named tunnel** — see
[§C](#c-static-cloudflared-tunnels).

---

## B. Cloud Run + Cloud SQL

### 0. Prereqs (once)
```bash
gcloud auth login                 # use the HACKATHON account, not a work one
export PROJECT_ID=trustline-hack
export REGION=us-central1
gcloud config set project $PROJECT_ID
gcloud auth configure-docker ${REGION}-docker.pkg.dev
```

### 1. Deploy everything
Fill `.env`, then:
```bash
PROJECT_ID=$PROJECT_ID ./scripts/deploy-cloudrun.sh all
```
`all` runs, in order: enable APIs → Artifact Registry → **provision Cloud SQL**
(`db-f1-micro`, Postgres 16; creates DB + user, stores `DATABASE_URL` +
`DB_PASSWORD` in Secret Manager) → push `.env` secrets → deploy `web`, `channels`
(min-instances=1, no-CPU-throttle, 1h timeout for the voice WebSocket), `agent` →
**wire** the cross-service URLs. Sub-commands: `db | secrets | web | channels |
agent | wire`.

### 2. Grant the runtime service account (one-time, important)
The default Compute SA needs to read secrets and reach Cloud SQL — the #1 cause of
silent runtime failures:
```bash
SA="$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')-compute@developer.gserviceaccount.com"
gcloud projects add-iam-policy-binding $PROJECT_ID --member=serviceAccount:$SA --role=roles/secretmanager.secretAccessor
gcloud projects add-iam-policy-binding $PROJECT_ID --member=serviceAccount:$SA --role=roles/cloudsql.client
```

### 3. Migrate the database (once)
Cloud SQL has no public IP by default; use the Cloud SQL Auth Proxy from your machine:
```bash
cloud-sql-proxy $PROJECT_ID:$REGION:trustline-db &     # listens on 127.0.0.1:5432
PASS=$(gcloud secrets versions access latest --secret=DB_PASSWORD)
DBURL="postgresql://trustline:$PASS@localhost:5432/trustline?schema=public"
DATABASE_URL="$DBURL" npx prisma migrate deploy --schema packages/db/prisma/schema.prisma
DATABASE_URL="$DBURL" npx tsx packages/db/prisma/seed.ts   # demo cases
```

### 4. Twilio webhooks → the deployed channels URL
- Voice "A call comes in" → `https://channels-xxxx.run.app/voice`
- Messaging "A message comes in" → `https://channels-xxxx.run.app/webhooks/sms`
- Status callback → `https://channels-xxxx.run.app/webhooks/sms-status`

With real creds the service leaves dry-run automatically and validates
`X-Twilio-Signature` on every webhook (it rebuilds the URL from `CHANNELS_PUBLIC_URL`,
which `wire` sets to the deployed URL).

### 5. Smoke-test the deploy
```bash
WEB_URL=https://web-xxxx.run.app CHANNELS_URL=https://channels-xxxx.run.app \
  READONLY=1 npm run smoke
```

### Pause / resume (save money between sessions)
Run for a demo, then pause — no data/URL loss, near-zero cost while paused:
```bash
PROJECT_ID=$PROJECT_ID ./scripts/cloudrun-power.sh pause    # stop Cloud SQL + channels -> 0
PROJECT_ID=$PROJECT_ID ./scripts/cloudrun-power.sh resume   # start Cloud SQL + channels -> 1
PROJECT_ID=$PROJECT_ID ./scripts/cloudrun-power.sh status
```
Paused = only Cloud SQL **storage** keeps billing (~$0.20–0.30/wk for 10 GB) and a
tiny Artifact Registry charge; all compute stops. Cloud SQL takes ~1–2 min to
become `RUNNABLE` on resume. To stop the storage charge too, delete the Cloud SQL
instance (export/backup first) — images in Artifact Registry let you redeploy fast.

### Rollback
```bash
gcloud run revisions list --service web --region $REGION
gcloud run services update-traffic web --to-revisions REVISION=100 --region $REGION
```

---

## C. Static cloudflared tunnel (the `cloudflared` container)

Stable public URLs that survive restarts (quick `trycloudflare` tunnels are random
each run), served by the `cloudflared` compose container in **token mode**.

1. In the Cloudflare **Zero Trust** dashboard → **Networks → Tunnels → Create a
   tunnel** (Cloudflared). Name it `trustline`, copy the **token**.
2. Add two **Public Hostnames** to the tunnel:
   | Subdomain | Domain | Type | URL |
   |---|---|---|---|
   | `trustline` | `morzio.com` | HTTP | `host.docker.internal:3000` |
   | `channels`  | `morzio.com` | HTTP | `host.docker.internal:4000` |
3. Put the token in `.env` as `CLOUDFLARE_TUNNEL_TOKEN`, set
   `NEXT_PUBLIC_APP_URL=https://trustline.morzio.com` and
   `CHANNELS_PUBLIC_URL=https://channels.morzio.com`, then:
   ```bash
   docker compose --profile tunnel up -d cloudflared
   ```
4. **Restart web + channels** so SMS links + Twilio callbacks use the stable URLs.

`host.docker.internal` lets the connector reach the apps published on the host
(ports 3000/4000), whether they run in compose or via `npm`.

> CLI alternative (no dashboard): `scripts/tunnel-setup.sh <domain>` creates a
> config-file tunnel and routes DNS via the `cloudflared` CLI; swap the compose
> `command` to `tunnel --config /etc/cloudflared/config.yml run` + mount
> `ops/cloudflared`.

---

## Notes / known gaps
- **Always-on channels** (`--min-instances 1`) is the main fixed cost (~$11–13/wk)
  — it keeps the voice bridge + 24h auto-call sweep alive. Drop to `0` to save if
  you don't need the sweep between sessions (see COSTS.md).
- Image sizes: `web` ~450 MB, `channels` ~750 MB (scoped prod install excludes the
  monorepo's Next.js deps).
- Tear down Cloud SQL + Cloud Run when not demoing to stop the meter.
