#!/usr/bin/env bash
# db-reset.sh -- Sprint 7.5b Tache 7.5b.0 (recommandation Pause #5).
#
# DROP + CREATE database + extensions + init SQL + migrations + grants.
# Cible par defaut : skalean-postgres-test (port 5433, db skalean_insurtech_test).
#
# Usage :
#   bash infrastructure/scripts/db-reset.sh
#   bash infrastructure/scripts/db-reset.sh --container skalean-postgres-dev --db skalean_insurtech
#
# Reference : pause-5-validation-runtime.md + decision-006 (no-emoji).

set -euo pipefail

# Defaults (test stack)
CONTAINER="${CONTAINER:-skalean-postgres-test}"
DB_USER="${DB_USER:-skalean}"
DB_NAME="${DB_NAME:-skalean_insurtech_test}"
DB_URL="${DATABASE_URL:-postgresql://skalean:skalean_test@localhost:5433/${DB_NAME}}"

# Parse args
while [[ $# -gt 0 ]]; do
  case "$1" in
    --container) CONTAINER="$2"; shift 2 ;;
    --db) DB_NAME="$2"; shift 2 ;;
    --user) DB_USER="$2"; shift 2 ;;
    *) echo "[db-reset] Unknown arg: $1" >&2; exit 1 ;;
  esac
done

log() { printf '[db-reset] %s\n' "$*" >&2; }

log "Resetting database ${DB_NAME} on container ${CONTAINER}"

# Step 1 : DROP + CREATE database (force disconnect any existing sessions)
log "Step 1/5 : DROP + CREATE database"
docker exec "${CONTAINER}" psql -U "${DB_USER}" -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${DB_NAME}' AND pid <> pg_backend_pid();" > /dev/null
docker exec "${CONTAINER}" psql -U "${DB_USER}" -d postgres -c "DROP DATABASE IF EXISTS ${DB_NAME};"
docker exec "${CONTAINER}" psql -U "${DB_USER}" -d postgres -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"
docker exec "${CONTAINER}" psql -U "${DB_USER}" -d postgres -c "GRANT CONNECT ON DATABASE ${DB_NAME} TO insurtech_app, insurtech_admin, insurtech_ro;"

# Step 2 : Extensions (citext, pgcrypto, pg_trgm)
log "Step 2/5 : Install extensions (citext + pgcrypto + pg_trgm)"
docker exec "${CONTAINER}" psql -U "${DB_USER}" -d "${DB_NAME}" -c "CREATE EXTENSION IF NOT EXISTS citext; CREATE EXTENSION IF NOT EXISTS pgcrypto; CREATE EXTENSION IF NOT EXISTS pg_trgm;"

# Step 3 : Create schemas (audit, reporting, n8n)
log "Step 3/5 : Create schemas"
docker exec "${CONTAINER}" psql -U "${DB_USER}" -d "${DB_NAME}" -c "CREATE SCHEMA IF NOT EXISTS audit; CREATE SCHEMA IF NOT EXISTS reporting; CREATE SCHEMA IF NOT EXISTS n8n;"

# Step 4 : Apply init SQL files (RLS helpers + roles grants)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
INIT_DIR="${REPO_DIR}/infrastructure/docker/postgres"

log "Step 4/5 : Apply init SQL (002 RLS helpers + 004 roles/grants)"
# Pipe SQL via stdin pour eviter chemin Windows conversion (Git Bash) lors docker cp.
cat "${INIT_DIR}/002-init-tenant-rls-helpers.sql" | docker exec -i "${CONTAINER}" psql -U "${DB_USER}" -d "${DB_NAME}" > /dev/null
cat "${INIT_DIR}/004-init-roles-grants.sql" | docker exec -i "${CONTAINER}" psql -U "${DB_USER}" -d "${DB_NAME}" > /dev/null 2>&1 || log "Note : 004 grants partially failed (audit schema may not exist yet) -- non-fatal"

# Step 5 : Run migrations + post-migration grants
log "Step 5/5 : Run TypeORM migrations + post-migration grants"
cd "${REPO_DIR}"
DATABASE_URL="${DB_URL}" pnpm --filter @insurtech/database migration:run > /dev/null

# Apply grants on freshly-created tables (Bug #5 Pause #5 prevention)
log "Applying post-migration grants on public schema tables"
docker exec "${CONTAINER}" psql -U "${DB_USER}" -d "${DB_NAME}" -c "GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO insurtech_app, insurtech_admin; GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO insurtech_app, insurtech_admin; GRANT SELECT ON ALL TABLES IN SCHEMA public TO insurtech_ro;" > /dev/null

log "Database reset complete -- ${DB_NAME} ready"
log "Tables count : $(docker exec "${CONTAINER}" psql -U "${DB_USER}" -d "${DB_NAME}" -tA -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';")"
