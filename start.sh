#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
# Parcel data lives on the host (gitignored) so it survives container/volume cleanups.
export WODO_PARCELS_HOST_DIR="${WODO_PARCELS_HOST_DIR:-$PWD/data/parcels}"
export WODO_UID="$(id -u)" WODO_GID="$(id -g)"
mkdir -p "$WODO_PARCELS_HOST_DIR"
exec docker compose up --build -d
