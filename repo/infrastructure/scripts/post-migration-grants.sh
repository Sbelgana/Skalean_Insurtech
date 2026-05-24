#!/usr/bin/env bash
# post-migration-grants.sh -- Sprint 7.5b Tache 7.5b.0 (recommandation Pause #5 Bug #5).
#
# Applique GRANT ALL TABLES + USAGE SEQUENCES sur insurtech_app + insurtech_admin
# apres chaque migration:run. A appeler automatiquement via pnpm hook ou CI.
#
# Pourquoi : `ALTER DEFAULT PRIVILEGES` ne s'applique qu'aux tables creees APRES
# l'execution du script. Les tables creees par migration TypeORM n'ont pas les
# grants -- d'ou erreur "permission denied for table" sous role insurtech_app.
#
# Usage :
#   bash infrastructure/scripts/post-migration-grants.sh
#   CONTAINER=skalean-postgres-test DB_NAME=skalean_insurtech_test bash post-migration-grants.sh
#
# Reference : pause-5-validation-runtime.md Bug #5.

set -euo pipefail

CONTAINER="${CONTAINER:-skalean-postgres-test}"
DB_USER="${DB_USER:-skalean}"
DB_NAME="${DB_NAME:-skalean_insurtech_test}"

log() { printf '[post-migration-grants] %s\n' "$*" >&2; }

log "Applying grants on ${DB_NAME} (container ${CONTAINER})"

docker exec "${CONTAINER}" psql -U "${DB_USER}" -d "${DB_NAME}" <<SQL
-- Grants tables (DML)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO insurtech_app, insurtech_admin;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO insurtech_ro;

-- Grants sequences (UUID gen + auto-increment columns)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO insurtech_app, insurtech_admin;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO insurtech_ro;

-- Grants audit + reporting schemas (Sprint 6+)
GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA audit TO insurtech_app;
GRANT SELECT ON ALL TABLES IN SCHEMA audit TO insurtech_admin, insurtech_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA reporting TO insurtech_app, insurtech_ro;

-- Maintenir ALTER DEFAULT pour les futures tables (au cas ou)
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO insurtech_app, insurtech_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO insurtech_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO insurtech_app, insurtech_admin;
SQL

log "Grants applied"
