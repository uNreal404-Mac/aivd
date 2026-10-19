#!/usr/bin/env bash
# Toggle VIDEO_GENERATION_ENABLED on the preview Worker using the EXISTING
# local build (.open-next). It never rebuilds and never touches secrets.
#
# Usage (from apps/video):  scripts/preview-generation-toggle.sh on|off
#
# Retries `wrangler deploy` up to 3 times when Cloudflare fails the
# assets upload session (error 10013), then verifies the generate
# endpoint: off => HTTP 503, on => anything but 503.
set -euo pipefail

WORKER="dreamutopia-video-preview" # must match "name" in wrangler.jsonc
SITE="${PREVIEW_SITE_URL:-https://aivd-preview.pages.dev}"
MAX_ATTEMPTS=3

case "${1:-}" in
  on) value="true" ;;
  off) value="false" ;;
  *) echo "usage: $0 on|off" >&2; exit 2 ;;
esac

cd "$(dirname "$0")/.."

if ! grep -q "\"name\": \"$WORKER\"" wrangler.jsonc; then
  echo "wrangler.jsonc is not configured for $WORKER" >&2
  exit 1
fi

if [[ ! -f .open-next/worker.js ]]; then
  echo "no .open-next build found; build first (not done by this script)" >&2
  exit 1
fi

echo "branch: $(git rev-parse --abbrev-ref HEAD)  head: $(git rev-parse --short HEAD)"
echo "build:  $(stat -f '%Sm' .open-next/worker.js 2>/dev/null || stat -c '%y' .open-next/worker.js)"

log="$(mktemp -t preview-toggle.XXXXXX)"
trap 'rm -f "$log"' EXIT

attempt=1
while :; do
  echo "deploy VIDEO_GENERATION_ENABLED=$value (attempt $attempt/$MAX_ATTEMPTS)"
  if npx wrangler deploy --var "VIDEO_GENERATION_ENABLED:$value" >"$log" 2>&1; then
    break
  fi
  if grep -q "10013" "$log" && (( attempt < MAX_ATTEMPTS )); then
    echo "Cloudflare 10013 (assets upload session); retrying in $((attempt * 5))s"
    sleep $((attempt * 5))
    attempt=$((attempt + 1))
    continue
  fi
  tail -n 20 "$log" >&2
  echo "deploy failed" >&2
  exit 1
done

version="$(grep -Eo 'Current Version ID: [0-9a-f-]+' "$log" | awk '{print $4}' || true)"
echo "version: ${version:-unknown}"

# The new version can take a few seconds to serve everywhere.
expected="$value"
for i in 1 2 3 4 5 6; do
  code="$(curl -s -o /dev/null -w '%{http_code}' -X POST "$SITE/api/v1/video/generate" \
    -H 'Content-Type: application/json' -d '{}')"
  if [[ "$expected" == "false" && "$code" == "503" ]] || [[ "$expected" == "true" && "$code" != "503" ]]; then
    echo "verified: POST /api/v1/video/generate -> HTTP $code"
    exit 0
  fi
  sleep 5
done

echo "verification failed: POST /api/v1/video/generate -> HTTP $code (expected $([[ $expected == false ]] && echo 503 || echo 'not 503'))" >&2
exit 1
