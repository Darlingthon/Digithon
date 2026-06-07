#!/usr/bin/env bash
# Place a REAL Vera call end-to-end (Twilio Media Streams ↔ OpenAI Realtime).
#
#   ./scripts/voice-test.sh +15551234567            # call this number, use case_demo_bob
#   ./scripts/voice-test.sh +15551234567 case_demo_bob
#
# Prereqs (see docs/VOICE-TEST.md):
#   - .env has OPENAI_API_KEY, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
#   - ngrok authtoken configured:  ngrok config add-authtoken <token>
#   - Postgres up + seeded:        npm run db:up && npm run db:seed
#   - On a Twilio trial, the destination number must be verified.
set -euo pipefail

TO="${1:?usage: ./scripts/voice-test.sh <E.164 number to call> [caseId]}"
CASE="${2:-case_demo_bob}"   # must be in QUESTIONNAIRE_SENT (or REVERIFY_SENT)
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

set -a; source .env; set +a
for v in OPENAI_API_KEY TWILIO_ACCOUNT_SID TWILIO_AUTH_TOKEN TWILIO_PHONE_NUMBER; do
  [ -n "${!v:-}" ] || { echo "❌ $v missing in .env"; exit 1; }
done

NGROK_PID=""; CH_PID=""
cleanup() { [ -n "$CH_PID" ] && kill "$CH_PID" 2>/dev/null || true; [ -n "$NGROK_PID" ] && kill "$NGROK_PID" 2>/dev/null || true; }
trap cleanup EXIT INT TERM

echo "▶ starting ngrok on :4000…"
ngrok http 4000 --log stdout > /tmp/ngrok.log 2>&1 &
NGROK_PID=$!
PUBLIC=""
for _ in $(seq 1 20); do
  # || true: ngrok's API isn't up on the first polls; don't let pipefail abort.
  PUBLIC="$(curl -s http://127.0.0.1:4040/api/tunnels 2>/dev/null | sed -n 's/.*"public_url":"\(https:[^"]*\)".*/\1/p' | head -1 || true)"
  [ -n "$PUBLIC" ] && break; sleep 1
done
[ -n "$PUBLIC" ] || { echo "❌ couldn't get ngrok URL (is the authtoken set?)"; exit 1; }
echo "  public URL: $PUBLIC"

echo "▶ booting channels (voice live)…"
CHANNELS_PUBLIC_URL="$PUBLIC" CHANNELS_PORT=4000 npm run channels:dev > /tmp/voice-live.log 2>&1 &
CH_PID=$!
for _ in $(seq 1 30); do curl -sf http://localhost:4000/health >/dev/null 2>&1 && break; sleep 1; done
echo "  health: $(curl -s http://localhost:4000/health)"

echo "▶ placing call to $TO for $CASE …"
curl -s -X POST "http://localhost:4000/calls/$CASE" -H 'content-type: application/json' -d "{\"phone\":\"$TO\"}"; echo
echo ""
echo "📞 Pick up — Vera will run the questionnaire. Live logs (Ctrl-C to stop):"
echo "────────────────────────────────────────────────────────────────"
tail -f /tmp/voice-live.log
