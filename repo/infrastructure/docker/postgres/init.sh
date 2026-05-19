#!/usr/bin/env bash
# Postgres init entry point -- Skalean InsurTech v2.2
# Reference: task-1.1.4 (extensions + RLS helpers)
# Les fichiers SQL 001-*.sql, 002-*.sql, 003-*.sql sont executes automatiquement
# par postgres docker-entrypoint-initdb.d dans l'ordre alphabetique
set -euo pipefail

echo "[postgres-init] Starting Skalean InsurTech database initialization"
echo "[postgres-init] SQL scripts in /docker-entrypoint-initdb.d will run alphabetically"
