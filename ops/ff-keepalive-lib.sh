#!/bin/bash
# Shared helpers for FridgeForge LaunchAgent keepalive scripts.
FF_LABEL="com.fridgeforge.next"
FF_ROOT="/Users/trav/FridgeForge"
FF_PLIST_SRC="$FF_ROOT/ops/com.fridgeforge.next.plist"
FF_PLIST_DST="$HOME/Library/LaunchAgents/${FF_LABEL}.plist"
FF_UID="$(id -u)"
FF_DOMAIN="gui/${FF_UID}"

ff_port_pids() {
  lsof -nP -iTCP:3000 -sTCP:LISTEN -t 2>/dev/null || true
}

ff_stop_port() {
  local pids
  pids="$(ff_port_pids)"
  if [[ -n "$pids" ]]; then
    echo "Stopping existing listener(s) on :3000: $pids"
    # Kill process group roots gently, then hard if needed
    # shellcheck disable=SC2086
    kill $pids 2>/dev/null || true
    sleep 1
    pids="$(ff_port_pids)"
    if [[ -n "$pids" ]]; then
      # shellcheck disable=SC2086
      kill -9 $pids 2>/dev/null || true
      sleep 1
    fi
  fi
}

ff_bootout() {
  launchctl bootout "$FF_DOMAIN/$FF_LABEL" 2>/dev/null || \
    launchctl unload "$FF_PLIST_DST" 2>/dev/null || true
}

ff_bootstrap() {
  mkdir -p "$HOME/Library/LaunchAgents" "$FF_ROOT/ops/logs"
  cp "$FF_PLIST_SRC" "$FF_PLIST_DST"
  launchctl bootstrap "$FF_DOMAIN" "$FF_PLIST_DST"
  launchctl enable "$FF_DOMAIN/$FF_LABEL" 2>/dev/null || true
  launchctl kickstart -k "$FF_DOMAIN/$FF_LABEL" 2>/dev/null || \
    launchctl start "$FF_LABEL" 2>/dev/null || true
}
