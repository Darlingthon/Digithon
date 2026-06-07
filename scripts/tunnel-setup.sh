#!/usr/bin/env bash
# One-time setup of a STATIC cloudflared named tunnel, served by the `cloudflared`
# container in docker-compose. Public URLs survive restarts (unlike trycloudflare).
#
# Publishes:   web.<domain>      -> http://host.docker.internal:3000   (Next.js)
#              channels.<domain> -> http://host.docker.internal:4000   (Twilio/voice)
# (host.docker.internal = the published host ports, so it works whether web/channels
#  run on the host via `npm` OR in compose.)
#
# Prereqs:
#   - a domain managed by Cloudflare; set TUNNEL_DOMAIN in .env (or pass as arg)
#   - run `cloudflared tunnel login` once (a browser opens) BEFORE this script
#
#   ./scripts/tunnel-setup.sh yourdomain.com
# Then:  docker compose --profile tunnel up -d cloudflared
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
[ -f "$ROOT/.env" ] && { set -a; source "$ROOT/.env"; set +a; }
DOMAIN="${1:-${TUNNEL_DOMAIN:-}}"
NAME="${TUNNEL_NAME:-trustline}"
CFG_DIR="$ROOT/ops/cloudflared"
: "${DOMAIN:?set TUNNEL_DOMAIN in .env or pass the domain as an argument}"
# Hostnames (override to use a custom subdomain like trustline.<domain> for web).
WEB_HOST="${WEB_HOST:-web.${DOMAIN}}"
CHANNELS_HOST="${CHANNELS_HOST:-channels.${DOMAIN}}"

command -v cloudflared >/dev/null || { echo "install cloudflared first (brew install cloudflared)"; exit 1; }
if [ ! -f "$HOME/.cloudflared/cert.pem" ]; then
  echo "▶ Not authenticated. Run this first (opens a browser, pick the zone for $DOMAIN):"
  echo "    cloudflared tunnel login"
  exit 1
fi
mkdir -p "$CFG_DIR"

# Create the tunnel (idempotent) and find its ID + credentials file.
if ! cloudflared tunnel list --name "$NAME" --output json 2>/dev/null | grep -q '"id"'; then
  echo "▶ Creating tunnel '$NAME'…"
  cloudflared tunnel create "$NAME"
fi
TUNNEL_ID="$(cloudflared tunnel list --name "$NAME" --output json | python3 -c 'import sys,json;print(json.load(sys.stdin)[0]["id"])')"
echo "▶ Tunnel $NAME = $TUNNEL_ID"

# Copy credentials into the repo so the compose container can mount them.
cp "$HOME/.cloudflared/${TUNNEL_ID}.json" "$CFG_DIR/${TUNNEL_ID}.json"

# Write the ingress config (container paths + host.docker.internal targets).
cat > "$CFG_DIR/config.yml" <<EOF
tunnel: ${TUNNEL_ID}
credentials-file: /etc/cloudflared/${TUNNEL_ID}.json
ingress:
  - hostname: ${WEB_HOST}
    service: http://host.docker.internal:3000
  - hostname: ${CHANNELS_HOST}
    service: http://host.docker.internal:4000
  - service: http_status:404
EOF
echo "▶ Wrote $CFG_DIR/config.yml"

# Point DNS at the tunnel (idempotent).
cloudflared tunnel route dns "$NAME" "${WEB_HOST}" 2>/dev/null || true
cloudflared tunnel route dns "$NAME" "${CHANNELS_HOST}" 2>/dev/null || true
echo "▶ Routed ${WEB_HOST} + ${CHANNELS_HOST}"

# Update .env so the app emits the stable public URLs.
python3 - "$ROOT/.env" "https://${WEB_HOST}" "https://${CHANNELS_HOST}" <<'PY'
import sys, re
env, web, ch = sys.argv[1:4]
s = open(env).read()
def setk(s,k,v):
    p=re.compile(rf'^{k}=.*$', re.M); line=f'{k}="{v}"'
    return p.sub(line,s,1) if p.search(s) else s.rstrip()+"\n"+line+"\n"
s=setk(s,"NEXT_PUBLIC_APP_URL",web); s=setk(s,"CHANNELS_PUBLIC_URL",ch)
open(env,"w").write(s)
print(f"▶ .env updated: NEXT_PUBLIC_APP_URL={web}  CHANNELS_PUBLIC_URL={ch}")
PY

echo
echo "✅ Tunnel ready. Start it:"
echo "    docker compose --profile tunnel up -d cloudflared"
echo "   Then restart web + channels so they emit the new public URLs."
