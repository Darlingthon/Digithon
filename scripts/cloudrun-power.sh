#!/usr/bin/env bash
# Pause / resume the deployed TrustLine stack to control the bill, WITHOUT losing
# data, images, or the *.run.app URLs.
#
#   pause:  stop Cloud SQL (no vCPU/RAM charge — only ~storage) + channels -> 0 instances
#   resume: start Cloud SQL + channels -> 1 always-on instance
#   status: show current state
#
# Usage:
#   PROJECT_ID=trustline-hack ./scripts/cloudrun-power.sh pause
#   PROJECT_ID=trustline-hack ./scripts/cloudrun-power.sh resume
#   PROJECT_ID=trustline-hack ./scripts/cloudrun-power.sh status
set -euo pipefail

: "${PROJECT_ID:?set PROJECT_ID}"
REGION="${REGION:-us-central1}"
SQL_INSTANCE="${SQL_INSTANCE:-trustline-db}"
ACTION="${1:-status}"
say() { printf "\n\033[1;36m▶ %s\033[0m\n" "$*"; }

sql_state() { gcloud sql instances describe "$SQL_INSTANCE" --project "$PROJECT_ID" --format='value(state)' 2>/dev/null || echo "NONE"; }
min_scale() { gcloud run services describe "$1" --region "$REGION" --project "$PROJECT_ID" \
  --format='value(spec.template.metadata.annotations["autoscaling.knative.dev/minScale"])' 2>/dev/null || echo "-"; }

case "$ACTION" in
  pause)
    say "Stopping Cloud SQL '$SQL_INSTANCE' (storage still bills; compute stops)"
    gcloud sql instances patch "$SQL_INSTANCE" --activation-policy=NEVER --project "$PROJECT_ID" -q
    say "Scaling channels to 0 (web/agent already scale to zero)"
    gcloud run services update channels --region "$REGION" --project "$PROJECT_ID" --min-instances 0 -q
    say "Paused. Cost is now ~storage only. Resume with: $0 resume"
    ;;
  resume)
    say "Starting Cloud SQL '$SQL_INSTANCE' (takes ~1-2 min to become RUNNABLE)"
    gcloud sql instances patch "$SQL_INSTANCE" --activation-policy=ALWAYS --project "$PROJECT_ID" -q
    say "Restoring channels to 1 always-on instance"
    gcloud run services update channels --region "$REGION" --project "$PROJECT_ID" --min-instances 1 -q
    say "Resumed. Give Cloud SQL a minute, then the app is live again."
    ;;
  status)
    say "Status"
    echo "  Cloud SQL '$SQL_INSTANCE': $(sql_state)"
    for s in web channels agent; do echo "  Cloud Run $s minScale: $(min_scale "$s")"; done
    gcloud run services list --project "$PROJECT_ID" --region "$REGION" \
      --format="table(metadata.name, status.url)" 2>/dev/null || true
    ;;
  *) echo "usage: PROJECT_ID=... $0 {pause|resume|status}"; exit 1 ;;
esac
