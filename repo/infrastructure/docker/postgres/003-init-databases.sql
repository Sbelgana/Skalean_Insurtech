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

-- Creer schemas dans la DB de test courante (skalean_insurtech_test).
-- Le script reste connecte a skalean_insurtech_test apres le \c plus haut.
CREATE SCHEMA IF NOT EXISTS n8n;
CREATE SCHEMA IF NOT EXISTS audit;
CREATE SCHEMA IF NOT EXISTS reporting;
\echo '[003-init-databases] Schemas (n8n, audit, reporting) created in skalean_insurtech_test'

-- En dev mode (skalean_insurtech DB existe), creer aussi les schemas la-bas.
-- En test stack (skalean_insurtech DB absente), \gexec produit aucune ligne -> no-op.
SELECT format('\c skalean_insurtech') AS cmd
FROM pg_database
WHERE datname = 'skalean_insurtech'
\gexec

SELECT 'CREATE SCHEMA IF NOT EXISTS n8n' AS s
WHERE current_database() = 'skalean_insurtech'
\gexec
SELECT 'CREATE SCHEMA IF NOT EXISTS audit' AS s
WHERE current_database() = 'skalean_insurtech'
\gexec
SELECT 'CREATE SCHEMA IF NOT EXISTS reporting' AS s
WHERE current_database() = 'skalean_insurtech'
\gexec

\echo '[003-init-databases] DONE.'
