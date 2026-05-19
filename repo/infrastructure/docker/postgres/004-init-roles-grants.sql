-- ============================================================================
-- Skalean InsurTech v2.2 -- Init roles applicatifs + grants
-- Reference: 00-pilotage/meta-prompts/B-01-sprint-01-bootstrap.md (Tache 1.1.4)
--            decision-002 (multi-tenant) + security best practices
-- ============================================================================
-- Roles crees :
--   insurtech_app    -- role applicatif normal (NOSUPERUSER, NOREPLICATION)
--                       Connecte par apps/api, packages/database
--                       Soumis aux RLS policies (Sprint 2+)
--   insurtech_admin  -- role admin pour migrations TypeORM
--                       Bypass RLS via FORCE_RLS_FALSE_FOR_OWNER (Sprint 6)
--                       Utilise UNIQUEMENT pour migrations + maintenance
--   insurtech_ro     -- role read-only pour analytics + reporting
--                       SELECT only sur public, audit, reporting schemas
--
-- Aucune emoji autorisee.
-- ============================================================================

\set ON_ERROR_STOP on

\echo '[004-init-roles-grants] Creating application roles...'

-- Role applicatif principal
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'insurtech_app') THEN
    CREATE ROLE insurtech_app WITH
      LOGIN
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOREPLICATION
      INHERIT
      PASSWORD 'insurtech_app_dev_only_change_in_prod';
    RAISE NOTICE '[004-init-roles-grants] Role insurtech_app created';
  ELSE
    RAISE NOTICE '[004-init-roles-grants] Role insurtech_app already exists, skipping';
  END IF;
END$$;

-- Role admin pour migrations
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'insurtech_admin') THEN
    CREATE ROLE insurtech_admin WITH
      LOGIN
      NOSUPERUSER
      CREATEDB
      NOCREATEROLE
      NOREPLICATION
      INHERIT
      PASSWORD 'insurtech_admin_dev_only_change_in_prod';
    RAISE NOTICE '[004-init-roles-grants] Role insurtech_admin created';
  ELSE
    RAISE NOTICE '[004-init-roles-grants] Role insurtech_admin already exists, skipping';
  END IF;
END$$;

-- Role read-only pour reporting
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'insurtech_ro') THEN
    CREATE ROLE insurtech_ro WITH
      LOGIN
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOREPLICATION
      INHERIT
      PASSWORD 'insurtech_ro_dev_only_change_in_prod';
    RAISE NOTICE '[004-init-roles-grants] Role insurtech_ro created';
  ELSE
    RAISE NOTICE '[004-init-roles-grants] Role insurtech_ro already exists, skipping';
  END IF;
END$$;

-- Grants sur DB principale
GRANT CONNECT ON DATABASE skalean_insurtech TO insurtech_app, insurtech_admin, insurtech_ro;

GRANT USAGE ON SCHEMA public TO insurtech_app, insurtech_admin, insurtech_ro;
GRANT USAGE ON SCHEMA audit TO insurtech_app, insurtech_admin, insurtech_ro;
GRANT USAGE ON SCHEMA reporting TO insurtech_app, insurtech_admin, insurtech_ro;
GRANT USAGE ON SCHEMA n8n TO insurtech_admin;

-- Grants execution helpers RLS (necessaire pour TOUS les roles applicatifs)
GRANT EXECUTE ON FUNCTION app_current_tenant() TO insurtech_app, insurtech_admin, insurtech_ro;
GRANT EXECUTE ON FUNCTION app_current_user_id() TO insurtech_app, insurtech_admin, insurtech_ro;
GRANT EXECUTE ON FUNCTION app_is_super_admin() TO insurtech_app, insurtech_admin, insurtech_ro;
GRANT EXECUTE ON FUNCTION app_assure_user_id() TO insurtech_app, insurtech_admin, insurtech_ro;
GRANT EXECUTE ON FUNCTION app_cross_tenant_authorization_id() TO insurtech_app, insurtech_admin, insurtech_ro;
GRANT EXECUTE ON FUNCTION app_can_access_tenant(uuid) TO insurtech_app, insurtech_admin, insurtech_ro;

-- Default privileges pour futures tables (Sprint 2+)
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO insurtech_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO insurtech_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO insurtech_ro;

ALTER DEFAULT PRIVILEGES IN SCHEMA audit GRANT INSERT ON TABLES TO insurtech_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA audit GRANT SELECT ON TABLES TO insurtech_admin, insurtech_ro;

ALTER DEFAULT PRIVILEGES IN SCHEMA reporting GRANT SELECT ON TABLES TO insurtech_app, insurtech_ro;

\echo '[004-init-roles-grants] DONE.'
