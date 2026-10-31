#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Isolated test database. Production/demo data is never reset.
if ! docker compose exec -T db psql -U transit -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='transit_test'" | grep -q 1; then
  docker compose exec -T db createdb -U transit transit_test
fi
docker compose exec -T app sh -c 'TEST_DATABASE_URL="${DATABASE_URL%/transit}/transit_test" python -m pytest tests -v'
