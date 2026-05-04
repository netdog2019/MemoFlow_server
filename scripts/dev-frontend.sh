#!/usr/bin/env sh

set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
WEB_DIR="$ROOT_DIR/web"

BACKEND_PORT="${MEMOS_DEV_BACKEND_PORT:-8081}"
FRONTEND_PORT="${MEMOS_DEV_FRONTEND_PORT:-3001}"
DEV_PROXY_SERVER="${DEV_PROXY_SERVER:-http://localhost:$BACKEND_PORT}"
DEV_HOST="${DEV_HOST:-0.0.0.0}"

cd "$WEB_DIR"

if [ ! -d node_modules ]; then
  echo "Installing frontend dependencies..."
  corepack pnpm install
fi

echo "Starting memos frontend on port $FRONTEND_PORT"
echo "Proxy target: $DEV_PROXY_SERVER"
echo "Frontend host: $DEV_HOST"

exec env DEV_PROXY_SERVER="$DEV_PROXY_SERVER" DEV_HOST="$DEV_HOST" corepack pnpm exec vite --host "$DEV_HOST" --port "$FRONTEND_PORT"
