-- ============================================================================
-- Skalean InsurTech v2.2 -- Init databases supplementaires + schemas
-- Reference: 00-pilotage/meta-prompts/B-01-sprint-01-bootstrap.md (Tache 1.1.4)
-- ============================================================================
-- Cree :
--   - Database skalean_insurtech_test (tests integration paralleles)
--   - Schema n8n (utilise par n8n container Tache 1.1.3)
--
-- Aucune emoji autorisee.
-- ============================================================================

\set ON_ERROR_STOP on

\echo '[003-init-databases] Creating test database and n8n schema...'

-- DB test (paralleliser tests integration)
SELECT 'CREATE DATABASE skalean_insurtech_test'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'skalean_insurtech_test')\gexec

\c skalean_insurtech_test
\echo '[003-init-databases] Connected to skalean_insurtech_test'

-- Re-installer extensions sur DB test
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gist";
CREATE EXTENSION IF NOT EXISTS "unaccent";
CREATE EXTENSION IF NOT EXISTS "citext";

\echo '[003-init-databases] Test DB extensions installed'

-- Re-back to skalean_insurtech principal
\c skalean_insurtech

-- Schema n8n (n8n container DB_POSTGRESDB_SCHEMA=n8n)
CREATE SCHEMA IF NOT EXISTS n8n;
\echo '[003-init-databases] Schema n8n created'

-- Schema audit (sera utilise Sprint 12 compliance)
CREATE SCHEMA IF NOT EXISTS audit;
\echo '[003-init-databases] Schema audit created (Sprint 12 ready)'

-- Schema reporting (sera utilise Sprint 13 analytics ETL Postgres -> ClickHouse)
CREATE SCHEMA IF NOT EXISTS reporting;
\echo '[003-init-databases] Schema reporting created (Sprint 13 ready)'

\echo '[003-init-databases] DONE.'
