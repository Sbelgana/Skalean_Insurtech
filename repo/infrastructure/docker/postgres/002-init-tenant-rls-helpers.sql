-- ============================================================================
-- Skalean InsurTech v2.2 -- Helpers SQL Multi-Tenant 3 niveaux
-- Reference: 00-pilotage/meta-prompts/B-01-sprint-01-bootstrap.md (Tache 1.1.4)
--            decision-002 (multi-tenant 3 niveaux : Platform / Tenant / Assure)
--            decision-006 (no-emoji)
--            8-skalean-insurtech-prompt-master.md Section 2 (multi-tenant strict)
-- ============================================================================
-- 6 Helpers SQL definis :
--   1. app_current_tenant()                           -- UUID tenant courant
--   2. app_current_user_id()                          -- UUID user courant
--   3. app_is_super_admin()                           -- bypass RLS
--   4. app_assure_user_id()                           -- UUID assure L3 si applicable
--   5. app_cross_tenant_authorization_id()            -- exception cross-tenant Sprint 25
--   6. app_can_access_tenant(target_tenant_id uuid)   -- evaluation aggregate
--
-- Les helpers sont declares STABLE PARALLEL SAFE pour permettre query parallele.
-- Variables session lues : current_setting('app.X', true) ou true = missing_ok.
--
-- Pattern usage (Sprint 6 implementera le runtime) :
--   BEGIN;
--   SET LOCAL app.current_tenant_id = '<uuid-customer-tenant>';
--   SET LOCAL app.current_user_id   = '<uuid-user-courtier>';
--   SET LOCAL app.is_super_admin    = 'false';
--   -- queries here filtrees automatiquement par RLS policies (Sprint 2+)
--   COMMIT;
--
-- Pour bypass RLS (super admin Skalean) :
--   BEGIN;
--   SET LOCAL app.is_super_admin = 'true';
--   SET LOCAL app.current_user_id = '<uuid-skalean-admin>';
--   -- queries voient TOUS les tenants
--   COMMIT;
--
-- Aucune emoji autorisee.
-- ============================================================================

\set ON_ERROR_STOP on

\echo '[002-init-rls-helpers] Creating 6 SQL helpers...'

-- ============================================================================
-- Helper 1 : app_current_tenant()
-- ============================================================================
-- Retourne l'UUID du customer tenant courant (L2) ou NULL si non set.
-- NULL signifie : pas dans un contexte authentifie tenant.
-- Le 2eme argument 'true' a current_setting permet de retourner NULL au lieu
-- de raise si la variable n'est pas set.
-- NULLIF(..., '') convertit chaine vide en NULL avant cast UUID (sinon cast fail).
CREATE OR REPLACE FUNCTION app_current_tenant()
RETURNS uuid
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  SELECT NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
$$;

COMMENT ON FUNCTION app_current_tenant() IS
'Skalean InsurTech v2.2 -- Returns the UUID of the current customer tenant (L2). NULL if no tenant context. Read app.current_tenant_id session var. Used by RLS policies on all tables with tenant_id column. Reference: decision-002.';

-- ============================================================================
-- Helper 2 : app_current_user_id()
-- ============================================================================
-- Retourne l'UUID du user courant (L1 platform admin OR L2 tenant user OR L3 assure).
-- NULL si pas dans contexte authentifie.
CREATE OR REPLACE FUNCTION app_current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '')::uuid
$$;

COMMENT ON FUNCTION app_current_user_id() IS
'Skalean InsurTech v2.2 -- Returns the UUID of the current user (any level). NULL if no auth context. Read app.current_user_id session var. Used by audit logs + RLS policies row-level auth. Reference: decision-002.';

-- ============================================================================
-- Helper 3 : app_is_super_admin()
-- ============================================================================
-- Retourne TRUE si le user courant est super admin Skalean Platform (L1).
-- Default FALSE (security-first).
-- Bypass RLS quand TRUE -- a utiliser avec extreme prudence.
CREATE OR REPLACE FUNCTION app_is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  SELECT COALESCE(NULLIF(current_setting('app.is_super_admin', true), ''), 'false')::boolean
$$;

COMMENT ON FUNCTION app_is_super_admin() IS
'Skalean InsurTech v2.2 -- Returns TRUE if current user is super admin Skalean Platform (L1). Default FALSE. Read app.is_super_admin session var. Bypass RLS when TRUE. Use with extreme caution. Reference: decision-002.';

-- ============================================================================
-- Helper 4 : app_assure_user_id()
-- ============================================================================
-- Retourne l'UUID du user courant SI il est un assure (L3), sinon NULL.
-- Utilise pour filtrer plus finement (assure ne voit QUE ses propres polices).
-- Differe de app_current_user_id() qui retourne tout user.
CREATE OR REPLACE FUNCTION app_assure_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  SELECT NULLIF(current_setting('app.assure_user_id', true), '')::uuid
$$;

COMMENT ON FUNCTION app_assure_user_id() IS
'Skalean InsurTech v2.2 -- Returns UUID of current user IF they are an assure (L3), else NULL. Read app.assure_user_id session var. Used to scope L3 access to own policies/sinistres/factures. Reference: decision-002.';

-- ============================================================================
-- Helper 5 : app_cross_tenant_authorization_id()
-- ============================================================================
-- Retourne l'UUID d'une autorisation cross-tenant active si applicable.
-- Mecanisme exception pour Sprint 25 (cross-tenant framework Repair) :
-- un utilisateur courtier peut acceder TEMPORAIREMENT au tenant garage
-- pour suivre un sinistre, via une authorization explicitement creee.
-- NULL si aucune exception en cours.
CREATE OR REPLACE FUNCTION app_cross_tenant_authorization_id()
RETURNS uuid
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  SELECT NULLIF(current_setting('app.cross_tenant_authorization_id', true), '')::uuid
$$;

COMMENT ON FUNCTION app_cross_tenant_authorization_id() IS
'Skalean InsurTech v2.2 -- Returns UUID of active cross-tenant authorization, NULL if none. Used by Sprint 25 cross-tenant framework Repair (broker accessing garage tenant for sinistre tracking). Read app.cross_tenant_authorization_id session var. Reference: decision-002 + B-25.';

-- ============================================================================
-- Helper 6 : app_can_access_tenant(target_tenant_id uuid)
-- ============================================================================
-- AGGREGATE helper -- evalue si le contexte courant peut acceder a target_tenant_id.
-- Retourne TRUE si l'une des conditions suivantes est verifiee :
--   1. Super admin Skalean Platform (bypass)
--   2. Same tenant : app_current_tenant() = target_tenant_id
--   3. Cross-tenant authorization active autorisant target (Sprint 25)
-- Retourne FALSE sinon.
-- Cette fonction est appelee par les RLS policies sur les tables tenant-scoped.
CREATE OR REPLACE FUNCTION app_can_access_tenant(target_tenant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
PARALLEL SAFE
AS $$
DECLARE
  current_tenant uuid;
  cross_auth_id uuid;
  cross_auth_target uuid;
  cross_auth_active boolean;
BEGIN
  -- Condition 0 : null target = invalid call (defensive)
  IF target_tenant_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Condition 1 : super admin bypass
  IF app_is_super_admin() THEN
    RETURN TRUE;
  END IF;

  -- Condition 2 : same tenant
  current_tenant := app_current_tenant();
  IF current_tenant IS NOT NULL AND current_tenant = target_tenant_id THEN
    RETURN TRUE;
  END IF;

  -- Condition 3 : cross-tenant authorization active (Sprint 25)
  -- Note : la table app.cross_tenant_authorizations est creee Sprint 25.
  -- En Sprint 1, cette branche retourne FALSE (table absente).
  -- Le check fait par try/catch pour ne pas casser en l'absence.
  cross_auth_id := app_cross_tenant_authorization_id();
  IF cross_auth_id IS NOT NULL THEN
    BEGIN
      EXECUTE format(
        'SELECT target_tenant_id, expired_at IS NULL OR expired_at > NOW() FROM cross_tenant_authorizations WHERE id = %L',
        cross_auth_id
      ) INTO cross_auth_target, cross_auth_active;
      IF cross_auth_active AND cross_auth_target = target_tenant_id THEN
        RETURN TRUE;
      END IF;
    EXCEPTION WHEN undefined_table THEN
      -- Table cross_tenant_authorizations pas encore creee (avant Sprint 25)
      -- Fallback : pas d'autorisation cross-tenant possible
      RETURN FALSE;
    END;
  END IF;

  -- Aucune condition verifiee : refuser acces
  RETURN FALSE;
END;
$$;

COMMENT ON FUNCTION app_can_access_tenant(uuid) IS
'Skalean InsurTech v2.2 -- Evaluate if current context can access target_tenant_id. TRUE if (super admin) OR (same tenant) OR (active cross-tenant authorization Sprint 25). Used by all RLS policies on tenant-scoped tables. Reference: decision-002 + B-25.';

-- ============================================================================
-- Verification : 6 helpers crees
-- ============================================================================
\echo '[002-init-rls-helpers] Verification helpers crees :'

SELECT
  routine_name,
  routine_type,
  data_type AS return_type,
  external_language,
  is_deterministic
FROM information_schema.routines
WHERE routine_name LIKE 'app\_%'
ORDER BY routine_name;

\echo '[002-init-rls-helpers] DONE -- 6 helpers operational.'
