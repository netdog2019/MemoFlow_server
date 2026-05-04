#!/usr/bin/env sh

set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
BACKEND_SCRIPT="$ROOT_DIR/scripts/dev-backend.sh"
FRONTEND_SCRIPT="$ROOT_DIR/scripts/dev-frontend.sh"

backend_pid=""
frontend_pid=""

cleanup() {
  code=$?

  if [ -n "$frontend_pid" ] && kill -0 "$frontend_pid" 2>/dev/null; then
    kill "$frontend_pid" 2>/dev/null || true
  fi

  if [ -n "$backend_pid" ] && kill -0 "$backend_pid" 2>/dev/null; then
    kill "$backend_pid" 2>/dev/null || true
  fi

  wait 2>/dev/null || true
  exit "$code"
}

trap cleanup INT TERM EXIT

"$BACKEND_SCRIPT" &
backend_pid=$!

sleep 2

"$FRONTEND_SCRIPT" &
frontend_pid=$!

echo
echo "Memos dev mode is starting."
echo "Frontend: http://localhost:${MEMOS_DEV_FRONTEND_PORT:-3001}"
echo "Backend:  http://localhost:${MEMOS_DEV_BACKEND_PORT:-8081}"
echo "Press Ctrl+C to stop both processes."
echo

wait "$backend_pid" "$frontend_pid"
