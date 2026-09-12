#!/bin/bash
# Install + load FridgeForge LaunchAgent (KeepAlive on :3000).
set -euo pipefail
cd "$(dirname "$0")"
# shellcheck disable=SC1091
source ./ff-keepalive-lib.sh

echo "Installing $FF_LABEL → $FF_PLIST_DST"
ff_bootout
ff_stop_port
ff_bootstrap

echo "Waiting for :3000…"
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do
  if curl -sf -o /dev/null -w '' http://127.0.0.1:3000/ 2>/dev/null; then
    code="$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/ || echo fail)"
    echo "OK: http://127.0.0.1:3000/ → $code"
    launchctl print "$FF_DOMAIN/$FF_LABEL" 2>/dev/null | head -n 20 || true
    exit 0
  fi
  sleep 1
done
echo "WARN: agent loaded but / did not return yet; check ops/logs/next-dev.log"
launchctl print "$FF_DOMAIN/$FF_LABEL" 2>/dev/null | head -n 30 || true
tail -n 40 "$FF_ROOT/ops/logs/next-dev.log" 2>/dev/null || true
exit 1
