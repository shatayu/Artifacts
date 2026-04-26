#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"
DAEMON_DIR="$(pwd)"

if [ ! -f .env ]; then
  echo "Missing .env. Copy .env.example to .env and fill in API_BASE_URL + API_KEY."
  exit 1
fi

# Load .env into the current shell so we can read API_BASE_URL/API_KEY
set -a
# shellcheck disable=SC1091
source .env
set +a

if [ -z "${API_BASE_URL:-}" ] || [ -z "${API_KEY:-}" ]; then
  echo "API_BASE_URL or API_KEY missing in .env"
  exit 1
fi

echo "[install] installing deps..."
npm install --silent

echo "[install] building bundle..."
npm run build --silent

NODE_PATH=$(command -v node)
HOME_DIR="$HOME"
PLIST_DIR="$HOME/Library/LaunchAgents"
LOG_DIR="$HOME/Library/Logs/Artifacts"
WORKSPACE_DIR="${CLAUDE_WORKSPACE_DIR:-$HOME/Library/Application Support/Claude/local-agent-mode-sessions/3cac6382-4eed-4c3c-adda-a3b49db1c031/351936ed-a38a-42fd-a05b-ac73f950c80e}"

mkdir -p "$PLIST_DIR" "$LOG_DIR"

PLIST="$PLIST_DIR/com.shatayu.artifacts-sync.plist"

# Use a placeholder delimiter that won't appear in any of the values
sed -e "s|@@NODE_PATH@@|$NODE_PATH|g" \
    -e "s|@@DAEMON_DIR@@|$DAEMON_DIR|g" \
    -e "s|@@HOME@@|$HOME_DIR|g" \
    -e "s|@@API_BASE_URL@@|$API_BASE_URL|g" \
    -e "s|@@API_KEY@@|$API_KEY|g" \
    -e "s|@@CLAUDE_WORKSPACE_DIR@@|$WORKSPACE_DIR|g" \
    launchd/com.shatayu.artifacts-sync.plist.template > "$PLIST"

# Reload
launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"

echo "[install] installed: $PLIST"
echo "[install] log: $LOG_DIR/sync.log"
echo "[install] verify: launchctl list | grep artifacts-sync"
echo "[install] tail log: tail -f $LOG_DIR/sync.log"
