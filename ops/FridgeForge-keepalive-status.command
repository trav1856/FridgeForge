#!/bin/bash
# Status for FridgeForge LaunchAgent keepalive.
set -euo pipefail
cd "$(dirname "$0")"
# shellcheck disable=SC1091
source ./ff-keepalive-lib.sh

echo "=== LaunchAgent $FF_LABEL ==="
if launchctl print "$FF_DOMAIN/$FF_LABEL" >/tmp/ff-la-status.txt 2>&1; then
  grep -E 'state =|pid =|runs =|last exit code|path =|KeepAlive' /tmp/ff-la-status.txt || head -n 25 /tmp/ff-la-status.txt
else
  echo "(not loaded)"
  cat /tmp/ff-la-status.txt 2>/dev/null | head -n 5 || true
fi
echo
echo "=== :3000 listeners ==="
lsof -nP -iTCP:3000 -sTCP:LISTEN 2>/dev/null || echo "(none)"
echo
echo "=== curl / ==="
curl -s -o /dev/null -w 'HTTP %{http_code}\n' --max-time 5 http://127.0.0.1:3000/ || echo 'curl failed'
echo
echo "=== log (tail) ==="
tail -n 15 "$FF_ROOT/ops/logs/next-dev.log" 2>/dev/null || echo "(no log yet)"
