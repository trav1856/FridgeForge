#!/bin/bash
# FridgeForge Next.js keepalive runner (LaunchAgent KeepAlive).
# Loads env from ops/.env.postgres.local then project .env; starts next on :3000.
set -euo pipefail

ROOT="/Users/trav/FridgeForge"
cd "$ROOT"

export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin${PATH:+:$PATH}"
export HOME="${HOME:-/Users/trav}"

# Source env files (later overrides earlier). Do not print secrets.
set -a
if [[ -f "$ROOT/ops/.env.postgres.local" ]]; then
  # shellcheck disable=SC1091
  source "$ROOT/ops/.env.postgres.local"
fi
if [[ -f "$ROOT/.env" ]]; then
  # shellcheck disable=SC1091
  source "$ROOT/.env"
fi
set +a

# Production mode: Secure cookies, optimized server (not next dev).
export NODE_ENV=production

mkdir -p "$ROOT/ops/logs"
echo "$(date '+%Y-%m-%d %H:%M:%S %Z') ff-next-run: starting next start on 127.0.0.1:3000 (NODE_ENV=production, pid $$)"

# exec next directly so LaunchAgent KeepAlive watches the server process
# (not an npm parent that can outlive a crashed next-server child).
# Bind 127.0.0.1 to match Tailscale Funnel proxy target (127.0.0.1:3000).
# Note: LAN / corelia.local no longer reaches :3000 directly; use Funnel URL.
exec "$ROOT/node_modules/.bin/next" start --port 3000 --hostname 127.0.0.1
