#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if ! docker compose exec -T db psql -U transit -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='transit_test'" | grep -q 1; then
  docker compose exec -T db createdb -U transit transit_test
fi
build_args=(--build)
if [ "${1:-}" = "--no-build" ]; then build_args=(); fi
docker compose -f compose.yaml -f compose.test.yaml run --rm "${build_args[@]}" test
