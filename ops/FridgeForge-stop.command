#!/bin/bash
# Stop FridgeForge (LaunchAgent keepalive if present, else free :3000).
set -euo pipefail
cd "$(dirname "$0")"
exec ./FridgeForge-keepalive-stop.command
