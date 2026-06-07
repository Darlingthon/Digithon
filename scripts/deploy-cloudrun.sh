#!/usr/bin/env bash
# Deploy TrustLine services to Google Cloud Run.
# Builds the verified per-app Dockerfiles, pushes to Artifact Registry, deploys.
#
# Prereqs (see docs/DEPLOY.md):
#   gcloud auth login && gcloud auth configure-docker ${REGION}-docker.pkg.dev
#   export PROJECT_ID=your-project   (REQUIRED)
#   secrets created in Secret Manager (the script can create them from .env)
#
# Usage:
#   PROJECT_ID=trustline-hack ./scripts/deploy-cloudrun.sh all
#   PROJECT_ID=trustline-hack ./scripts/deploy-cloudrun.sh web
#   PROJECT_ID=trustline-hack ./scripts/deploy-cloudrun.sh channels
#   PROJECT_ID=trustline-hack ./scripts/deploy-cloudrun.sh secrets   # push .env -> Secret Manager
set -euo pipefail

: "${PROJECT_ID:?set PROJECT_ID}"
REGION="${REGION:-us-central1}"
REPO="${REPO:-trustline}"
AR="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
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

# Create/update secrets from the local .env (only the sensitive ones).
push_secrets() {
  say "Pushing secrets from .env -> Secret Manager"
  set -a; source "$ROOT/.env"; set +a
  for KEY in DATABASE_URL OPENAI_API_KEY TWILIO_ACCOUNT_SID TWILIO_AUTH_TOKEN \
             TWILIO_MESSAGING_SERVICE_SID TWILIO_VERIFY_SERVICE_SID SUMSUB_APP_TOKEN SUMSUB_SECRET_KEY; do
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

build_push() { # name dockerfile
  local name="$1" dockerfile="$2" img="${AR}/${1}:latest"
  say "Build + push $name"
  docker build --platform linux/amd64 -f "$dockerfile" -t "$img" "$ROOT"
  docker push "$img"
}

deploy_web() {
  build_push web "$ROOT/apps/web/Dockerfile"
  say "Deploy web"
  gcloud run deploy web --image "${AR}/web:latest" --region "$REGION" --project "$PROJECT_ID" \
    --allow-unauthenticated --port 3000 \
    --set-env-vars "NEXT_PUBLIC_APP_URL=${WEB_PUBLIC_URL:-}" \
    --set-secrets "DATABASE_URL=DATABASE_URL:latest"
}

deploy_channels() {
  build_push channels "$ROOT/apps/channels/Dockerfile"
  say "Deploy channels"
  gcloud run deploy channels --image "${AR}/channels:latest" --region "$REGION" --project "$PROJECT_ID" \
    --allow-unauthenticated --port 8080 \
    --set-env-vars "NEXT_PUBLIC_APP_URL=${WEB_PUBLIC_URL:-},CHANNELS_PUBLIC_URL=${CHANNELS_PUBLIC_URL:-}" \
    --set-secrets "DATABASE_URL=DATABASE_URL:latest,TWILIO_ACCOUNT_SID=TWILIO_ACCOUNT_SID:latest,TWILIO_AUTH_TOKEN=TWILIO_AUTH_TOKEN:latest,TWILIO_MESSAGING_SERVICE_SID=TWILIO_MESSAGING_SERVICE_SID:latest,TWILIO_VERIFY_SERVICE_SID=TWILIO_VERIFY_SERVICE_SID:latest,OPENAI_API_KEY=OPENAI_API_KEY:latest"
}

case "$TARGET" in
  secrets)  push_secrets ;;
  web)      enable_apis; ensure_repo; deploy_web ;;
  channels) enable_apis; ensure_repo; deploy_channels ;;
  all)      enable_apis; ensure_repo; push_secrets; deploy_web; deploy_channels ;;
  *) echo "usage: PROJECT_ID=... $0 {all|web|channels|secrets}"; exit 1 ;;
esac

say "Done. Service URLs:"
gcloud run services list --project "$PROJECT_ID" --region "$REGION" \
  --format="table(metadata.name, status.url)" 2>/dev/null || true
