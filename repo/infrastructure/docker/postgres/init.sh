#!/usr/bin/env bash
# Skalean InsurTech v2.2 -- Postgres init entry point
# Reference: 00-pilotage/meta-prompts/B-01-sprint-01-bootstrap.md (Tache 1.1.4)
#            decision-002 (multi-tenant 3 niveaux)
#            decision-006 (no-emoji)
#
# Postgres docker-entrypoint-initdb.d execute :
#   - tous les fichiers *.sql ordre alphabetique
#   - tous les fichiers *.sh ordre alphabetique
#   AU PREMIER BOOT UNIQUEMENT (data dir vide).
#
# Pour re-executer apres modification : pnpm docker:reset
# Aucune emoji autorisee.

set -euo pipefail

echo "[postgres-init] Skalean InsurTech v2.2 -- init scripts loading"
echo "[postgres-init] User: ${POSTGRES_USER}, DB: ${POSTGRES_DB}"
echo "[postgres-init] Init scripts order :"
echo "[postgres-init]   001-init-extensions.sql      (5 extensions)"
echo "[postgres-init]   002-init-tenant-rls-helpers.sql (6 helpers SQL)"
echo "[postgres-init]   003-init-databases.sql       (schema n8n + DB test)"
echo "[postgres-init]   004-init-roles-grants.sql    (roles applicatifs + grants)"
echo "[postgres-init] Each *.sql will be executed by postgres entrypoint."
echo "[postgres-init] Setup complete."
