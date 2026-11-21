#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
project="$PWD"
port="${WODO_PORT:-8080}"
export WODO_SITE_DIR="$project/frontend/dist/frontend/browser"
export WODO_CACHE_DIR="${WODO_CACHE_DIR:-$project/.wodo-cache}"
export TZ=Europe/Warsaw
npm --prefix frontend run build
cd backend
exec uv run --locked uvicorn main:app --host 127.0.0.1 --port "$port" --no-proxy-headers
