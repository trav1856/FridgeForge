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

mkdir -p "$ROOT/ops/logs"
echo "$(date '+%Y-%m-%d %H:%M:%S %Z') ff-next-run: starting next dev on :3000 (pid $$)"

# exec next directly so LaunchAgent KeepAlive watches the server process
# (not an npm parent that can outlive a crashed next-server child).
exec "$ROOT/node_modules/.bin/next" dev --port 3000 --hostname 0.0.0.0
