-- ============================================================================
-- Skalean InsurTech v2.2 -- Init extensions PostgreSQL
-- Reference: 00-pilotage/meta-prompts/B-01-sprint-01-bootstrap.md (Tache 1.1.4)
--            decision-002 (multi-tenant) + decision-006 (no-emoji)
-- ============================================================================
-- Extensions installees (5) :
--   pgcrypto    -- gen_random_uuid() UUID v4 cryptographique
--   pg_trgm     -- full-text search trigram (CRM Sprint 8, Repair Sprint 19)
--   btree_gist  -- EXCLUDE constraint avec tsrange (Booking Sprint 8)
--   unaccent    -- recherche insensible aux accents francais (noms MA)
--   citext      -- colonnes case-insensitive (emails, identifiants)
--
-- Aucune emoji autorisee dans ce fichier.
-- ============================================================================

\set ON_ERROR_STOP on

\echo '[001-init-extensions] Installing 5 extensions...'

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
\echo '[001-init-extensions] pgcrypto installed'

CREATE EXTENSION IF NOT EXISTS "pg_trgm";
\echo '[001-init-extensions] pg_trgm installed'

CREATE EXTENSION IF NOT EXISTS "btree_gist";
\echo '[001-init-extensions] btree_gist installed'

CREATE EXTENSION IF NOT EXISTS "unaccent";
\echo '[001-init-extensions] unaccent installed'

CREATE EXTENSION IF NOT EXISTS "citext";
\echo '[001-init-extensions] citext installed'

\echo '[001-init-extensions] Verification (5 extensions expected) :'
SELECT extname, extversion FROM pg_extension WHERE extname IN ('pgcrypto', 'pg_trgm', 'btree_gist', 'unaccent', 'citext') ORDER BY extname;

\echo '[001-init-extensions] DONE.'
