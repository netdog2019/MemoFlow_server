#!/usr/bin/env sh

set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"

PORT="${MEMOS_DEV_BACKEND_PORT:-8081}"
DATA_DIR="${MEMOS_DEV_DATA_DIR:-$ROOT_DIR/.dev-data}"
GO_CACHE_DIR="${MEMOS_DEV_GO_CACHE_DIR:-$ROOT_DIR/.dev-cache/go-build}"
GO_MOD_CACHE_DIR="${MEMOS_DEV_GO_MOD_CACHE_DIR:-$ROOT_DIR/.dev-cache/go-mod}"

mkdir -p "$DATA_DIR" "$GO_CACHE_DIR" "$GO_MOD_CACHE_DIR"

export GOCACHE="$GO_CACHE_DIR"
export GOMODCACHE="$GO_MOD_CACHE_DIR"

cd "$ROOT_DIR"

echo "Starting memos backend on http://localhost:$PORT"
echo "Data directory: $DATA_DIR"

exec go run ./cmd/memos --port "$PORT" --data "$DATA_DIR"
