#!/bin/bash
# Unload FridgeForge LaunchAgent and free :3000.
set -euo pipefail
cd "$(dirname "$0")"
# shellcheck disable=SC1091
source ./ff-keepalive-lib.sh

echo "Stopping $FF_LABEL"
ff_bootout
ff_stop_port
echo "Stopped. launchctl:"
launchctl print "$FF_DOMAIN/$FF_LABEL" 2>&1 | head -n 5 || echo "(not loaded)"
pids="$(ff_port_pids)"
if [[ -n "$pids" ]]; then
  echo "WARN: still listening on :3000: $pids"
  exit 1
fi
echo "Port :3000 is free."
