#!/usr/bin/env bash
# Deploy TrustLine (web + channels + agent + Cloud SQL) to Google Cloud Run.
# Builds the per-app Dockerfiles, pushes to Artifact Registry, provisions a
# Cloud SQL Postgres, pushes secrets, deploys all three services, and wires the
# cross-service URLs in a second pass.
#
# Prereqs (see docs/DEPLOY.md):
#   gcloud auth login
#   gcloud auth configure-docker ${REGION}-docker.pkg.dev
#   export PROJECT_ID=your-project        (REQUIRED)
#   a filled-in .env at the repo root      (secrets are read from it)
#
# Usage:
#   PROJECT_ID=trustline-hack ./scripts/deploy-cloudrun.sh all       # everything
#   PROJECT_ID=trustline-hack ./scripts/deploy-cloudrun.sh db        # Cloud SQL only
#   PROJECT_ID=trustline-hack ./scripts/deploy-cloudrun.sh secrets   # .env -> Secret Manager
#   PROJECT_ID=trustline-hack ./scripts/deploy-cloudrun.sh web|channels|agent
#   PROJECT_ID=trustline-hack ./scripts/deploy-cloudrun.sh wire      # re-wire service URLs
set -euo pipefail

: "${PROJECT_ID:?set PROJECT_ID}"
REGION="${REGION:-us-central1}"
REPO="${REPO:-trustline}"
AR="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SQL_INSTANCE="${SQL_INSTANCE:-trustline-db}"
SQL_CONN="${PROJECT_ID}:${REGION}:${SQL_INSTANCE}"
TARGET="${1:-all}"

say() { printf "\n\033[1;36m▶ %s\033[0m\n" "$*"; }

enable_apis() {
  say "Enabling APIs"
  gcloud services enable run.googleapis.com cloudbuild.googleapis.com \
    artifactregistry.googleapis.com secretmanager.googleapis.com \
    sqladmin.googleapis.com --project "$PROJECT_ID"
}

ensure_repo() {
  gcloud artifacts repositories describe "$REPO" --location "$REGION" --project "$PROJECT_ID" >/dev/null 2>&1 || {
    say "Creating Artifact Registry repo '$REPO'"
    gcloud artifacts repositories create "$REPO" --repository-format=docker \
      --location "$REGION" --project "$PROJECT_ID"
  }
}

# ── Cloud SQL (Postgres). Smallest shared-core tier; fine for a demo. ──
ensure_cloudsql() {
  if gcloud sql instances describe "$SQL_INSTANCE" --project "$PROJECT_ID" >/dev/null 2>&1; then
    say "Cloud SQL '$SQL_INSTANCE' already exists"
  else
    say "Creating Cloud SQL '$SQL_INSTANCE' (POSTGRES_16, db-f1-micro) — takes a few minutes"
    gcloud sql instances create "$SQL_INSTANCE" \
      --database-version=POSTGRES_16 --edition=ENTERPRISE --tier=db-f1-micro \
      --region="$REGION" --storage-size=10 --storage-type=HDD \
      --project "$PROJECT_ID"
  fi
  gcloud sql databases create trustline --instance="$SQL_INSTANCE" --project "$PROJECT_ID" 2>/dev/null || true

  # App DB user with a generated password, stored in Secret Manager (DB_PASSWORD).
  local pass
  if gcloud secrets describe DB_PASSWORD --project "$PROJECT_ID" >/dev/null 2>&1; then
    pass="$(gcloud secrets versions access latest --secret=DB_PASSWORD --project "$PROJECT_ID")"
  else
    pass="$(openssl rand -base64 24 | tr -d '/+=')"
    printf "%s" "$pass" | gcloud secrets create DB_PASSWORD --data-file=- --project "$PROJECT_ID" >/dev/null
  fi
  gcloud sql users create trustline --instance="$SQL_INSTANCE" --password="$pass" --project "$PROJECT_ID" 2>/dev/null \
    || gcloud sql users set-password trustline --instance="$SQL_INSTANCE" --password="$pass" --project "$PROJECT_ID"

  # DATABASE_URL via the Cloud SQL unix socket (works for Prisma AND psycopg).
  local url="postgresql://trustline:${pass}@localhost/trustline?host=/cloudsql/${SQL_CONN}&schema=public"
  if gcloud secrets describe DATABASE_URL --project "$PROJECT_ID" >/dev/null 2>&1; then
    printf "%s" "$url" | gcloud secrets versions add DATABASE_URL --data-file=- --project "$PROJECT_ID" >/dev/null
  else
    printf "%s" "$url" | gcloud secrets create DATABASE_URL --data-file=- --project "$PROJECT_ID" >/dev/null
  fi
  say "Cloud SQL ready ($SQL_CONN). Run migrations once (see docs/DEPLOY.md)."
}

# Push the non-DB secrets from .env (DATABASE_URL is set by ensure_cloudsql).
push_secrets() {
  say "Pushing secrets from .env -> Secret Manager"
  set -a; source "$ROOT/.env"; set +a
  for KEY in OPENAI_API_KEY OPENAI_REALTIME_MODEL \
             TWILIO_ACCOUNT_SID TWILIO_AUTH_TOKEN TWILIO_MESSAGING_SERVICE_SID \
             TWILIO_VERIFY_SERVICE_SID TWILIO_PHONE_NUMBER \
             SUMSUB_APP_TOKEN SUMSUB_SECRET_KEY SUMSUB_BASE_URL SUMSUB_LEVEL_NAME \
             GOOGLE_API_KEY GOOGLE_MODEL; do
    VAL="${!KEY:-}"
    [ -z "$VAL" ] && { echo "  · skip $KEY (empty)"; continue; }
    if gcloud secrets describe "$KEY" --project "$PROJECT_ID" >/dev/null 2>&1; then
      printf "%s" "$VAL" | gcloud secrets versions add "$KEY" --data-file=- --project "$PROJECT_ID" >/dev/null
    else
      printf "%s" "$VAL" | gcloud secrets create "$KEY" --data-file=- --project "$PROJECT_ID" >/dev/null
    fi
    echo "  ✓ $KEY"
  done
}

build_push() { # name dockerfile [context]
  local name="$1" dockerfile="$2" ctx="${3:-$ROOT}" img="${AR}/${1}:latest"
  say "Build + push $name"
  docker build --platform linux/amd64 -f "$dockerfile" -t "$img" "$ctx"
  docker push "$img"
}

svc_url() { gcloud run services describe "$1" --region "$REGION" --project "$PROJECT_ID" --format='value(status.url)' 2>/dev/null; }

deploy_web() {
  build_push web "$ROOT/apps/web/Dockerfile"
  say "Deploy web"
  gcloud run deploy web --image "${AR}/web:latest" --region "$REGION" --project "$PROJECT_ID" \
    --allow-unauthenticated --port 3000 --cpu 1 --memory 512Mi \
    --add-cloudsql-instances "$SQL_CONN" \
    --set-secrets "DATABASE_URL=DATABASE_URL:latest"
}

deploy_channels() {
  build_push channels "$ROOT/apps/channels/Dockerfile"
  say "Deploy channels"
  # min-instances=1 keeps the voice bridge + fallback sweep always-on; long
  # timeout + no CPU throttling for the Media Streams WebSocket.
  gcloud run deploy channels --image "${AR}/channels:latest" --region "$REGION" --project "$PROJECT_ID" \
    --allow-unauthenticated --port 8080 --cpu 1 --memory 512Mi \
    --min-instances 1 --timeout 3600 --no-cpu-throttling \
    --add-cloudsql-instances "$SQL_CONN" \
    --set-secrets "DATABASE_URL=DATABASE_URL:latest,OPENAI_API_KEY=OPENAI_API_KEY:latest,TWILIO_ACCOUNT_SID=TWILIO_ACCOUNT_SID:latest,TWILIO_AUTH_TOKEN=TWILIO_AUTH_TOKEN:latest,TWILIO_MESSAGING_SERVICE_SID=TWILIO_MESSAGING_SERVICE_SID:latest,TWILIO_VERIFY_SERVICE_SID=TWILIO_VERIFY_SERVICE_SID:latest,TWILIO_PHONE_NUMBER=TWILIO_PHONE_NUMBER:latest"
}

deploy_agent() {
  build_push agent "$ROOT/apps/agent/Dockerfile" "$ROOT/apps/agent"
  say "Deploy agent"
  gcloud run deploy agent --image "${AR}/agent:latest" --region "$REGION" --project "$PROJECT_ID" \
    --allow-unauthenticated --port 8000 --cpu 1 --memory 1Gi \
    --add-cloudsql-instances "$SQL_CONN" \
    --set-env-vars "GOOGLE_GENAI_USE_VERTEXAI=false" \
    --set-secrets "DATABASE_URL=DATABASE_URL:latest,GOOGLE_API_KEY=GOOGLE_API_KEY:latest,GOOGLE_MODEL=GOOGLE_MODEL:latest"
}

# Second pass: services now have URLs, so wire web<->channels together.
wire_urls() {
  say "Wiring cross-service URLs"
  local web ch; web="$(svc_url web)"; ch="$(svc_url channels)"
  if [ -z "$web" ] || [ -z "$ch" ]; then echo "  deploy web + channels first"; return 1; fi
  echo "  web=$web  channels=$ch"
  gcloud run services update web --region "$REGION" --project "$PROJECT_ID" \
    --update-env-vars "NEXT_PUBLIC_APP_URL=${web},CHANNELS_URL=${ch}"
  gcloud run services update channels --region "$REGION" --project "$PROJECT_ID" \
    --update-env-vars "NEXT_PUBLIC_APP_URL=${web},CHANNELS_PUBLIC_URL=${ch}"
}

case "$TARGET" in
  db)       enable_apis; ensure_cloudsql ;;
  secrets)  push_secrets ;;
  web)      enable_apis; ensure_repo; deploy_web ;;
  channels) enable_apis; ensure_repo; deploy_channels ;;
  agent)    enable_apis; ensure_repo; deploy_agent ;;
  wire)     wire_urls ;;
  all)      enable_apis; ensure_repo; ensure_cloudsql; push_secrets; deploy_web; deploy_channels; deploy_agent; wire_urls ;;
  *) echo "usage: PROJECT_ID=... $0 {all|db|secrets|web|channels|agent|wire}"; exit 1 ;;
esac

say "Done. Service URLs:"
gcloud run services list --project "$PROJECT_ID" --region "$REGION" \
  --format="table(metadata.name, status.url)" 2>/dev/null || true
