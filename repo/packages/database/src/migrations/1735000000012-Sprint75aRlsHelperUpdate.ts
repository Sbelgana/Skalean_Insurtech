/**
 * Sprint 7.5a Tache 7.5a.5 -- Helper Postgres app_can_access_tenant() v3.0.
 *
 * Etend la fonction RLS helper pour supporter les 7 types cross-tenant v3.0.
 *
 * Conditions evaluees (par ordre) :
 *   Cond 1 : super admin (bypass)                  -- inchangee depuis v2.2
 *   Cond 2 : same tenant                            -- inchangee depuis v2.2
 *   Cond 3 : active cross-tenant authorization      -- ELARGIE en v3.0
 *
 * v2.2 Cond 3 utilisait une session var `app.cross_tenant_authorization_id`
 * pointant vers une autorisation specifique, MAIS la lookup query referenc-
 * ait les mauvaises colonnes (`target_tenant_id` au lieu de `to_tenant_id`,
 * `expired_at` au lieu de `expires_at`) -- bug latent corrige ici.
 *
 * v3.0 Cond 3 : utilise une EXISTS query qui matche n'importe quelle auto-
 * risation active (non revoquee, non expiree) entre le tenant courant et
 * le tenant cible, dans l'une ou l'autre direction, parmi les 7 types
 * supportes (decision-012).
 *
 * Soft rollback : `down()` restaure la version v2.2 (3 types) avec les
 * memes corrections de colonnes (bug fix maintenu).
 *
 * Reference :
 *   - 00-pilotage/decisions/012-ecosysteme-6-acteurs.md
 *   - B-7.5a Tache 7.5a.5.
 */

import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Sprint75aRlsHelperUpdate1735000000012 implements MigrationInterface {
  name = 'Sprint75aRlsHelperUpdate1735000000012';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE OR REPLACE FUNCTION app_can_access_tenant(target_tenant_id uuid)
      RETURNS boolean
      LANGUAGE plpgsql
      STABLE
      PARALLEL SAFE
      AS $$
      DECLARE
        current_tenant uuid;
        current_tenant_text text;
      BEGIN
        -- Cond 0 : null target = invalid (defensive)
        IF target_tenant_id IS NULL THEN
          RETURN FALSE;
        END IF;

        -- Cond 1 : super admin bypass
        IF app_is_super_admin() THEN
          RETURN TRUE;
        END IF;

        -- Cond 2 : same tenant
        current_tenant := app_current_tenant();
        IF current_tenant IS NOT NULL AND current_tenant = target_tenant_id THEN
          RETURN TRUE;
        END IF;

        -- Cond 3 : active cross-tenant authorization (v3.0 : 7 types).
        -- La table cross_tenant_authorizations est creee par Sprint 7.5a.4.
        -- Si elle n'existe pas (cas defensif), la branche retourne FALSE via
        -- exception handler.
        current_tenant_text := current_setting('app.current_tenant_id', true);
        IF current_tenant_text IS NOT NULL AND current_tenant_text <> '' THEN
          BEGIN
            IF EXISTS (
              SELECT 1
              FROM cross_tenant_authorizations cta
              WHERE cta.revoked_at IS NULL
                AND cta.expires_at > NOW()
                AND cta.type IN (
                  'broker_to_garage_assignment',
                  'assure_to_garage_visit',
                  'multi_tenant_user_access',
                  'client_to_tower_dispatch',
                  'tower_to_garage_delivery',
                  'garage_to_expert_request',
                  'garage_to_carrier_quote'
                )
                AND (
                  (cta.from_tenant_id::text = current_tenant_text AND cta.to_tenant_id = target_tenant_id)
                  OR (cta.to_tenant_id::text = current_tenant_text AND cta.from_tenant_id = target_tenant_id)
                )
            ) THEN
              RETURN TRUE;
            END IF;
          EXCEPTION WHEN undefined_table THEN
            -- Table cross_tenant_authorizations pas encore creee : fallback FALSE
            RETURN FALSE;
          END;
        END IF;

        -- Aucune condition verifiee : refuser
        RETURN FALSE;
      END;
      $$;
    `);

    await q.query(`
      COMMENT ON FUNCTION app_can_access_tenant(uuid) IS
        'Assurflow v3.0 (Sprint 7.5a) -- Evaluate if current context can access target_tenant_id. TRUE if (super admin) OR (same tenant) OR (active cross-tenant authorization parmi 7 types v3.0). Used by all RLS policies. Reference: decision-002 + decision-012 + B-7.5a Tache 7.5a.5.';
    `);

    // Ensure le grant execute est conserve sur les roles applicatifs.
    await q.query(
      `GRANT EXECUTE ON FUNCTION app_can_access_tenant(uuid) TO insurtech_app, insurtech_admin, insurtech_ro;`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    // Soft rollback : restaurer la version v2.2 (3 types) avec les memes
    // corrections de colonnes (bug fix preservation).
    await q.query(`
      CREATE OR REPLACE FUNCTION app_can_access_tenant(target_tenant_id uuid)
      RETURNS boolean
      LANGUAGE plpgsql
      STABLE
      PARALLEL SAFE
      AS $$
      DECLARE
        current_tenant uuid;
        current_tenant_text text;
      BEGIN
        IF target_tenant_id IS NULL THEN
          RETURN FALSE;
        END IF;

        IF app_is_super_admin() THEN
          RETURN TRUE;
        END IF;

        current_tenant := app_current_tenant();
        IF current_tenant IS NOT NULL AND current_tenant = target_tenant_id THEN
          RETURN TRUE;
        END IF;

        current_tenant_text := current_setting('app.current_tenant_id', true);
        IF current_tenant_text IS NOT NULL AND current_tenant_text <> '' THEN
          BEGIN
            IF EXISTS (
              SELECT 1
              FROM cross_tenant_authorizations cta
              WHERE cta.revoked_at IS NULL
                AND cta.expires_at > NOW()
                AND cta.type IN (
                  'broker_to_garage_assignment',
                  'assure_to_garage_visit',
                  'multi_tenant_user_access'
                )
                AND (
                  (cta.from_tenant_id::text = current_tenant_text AND cta.to_tenant_id = target_tenant_id)
                  OR (cta.to_tenant_id::text = current_tenant_text AND cta.from_tenant_id = target_tenant_id)
                )
            ) THEN
              RETURN TRUE;
            END IF;
          EXCEPTION WHEN undefined_table THEN
            RETURN FALSE;
          END;
        END IF;

        RETURN FALSE;
      END;
      $$;
    `);

    await q.query(
      `GRANT EXECUTE ON FUNCTION app_can_access_tenant(uuid) TO insurtech_app, insurtech_admin, insurtech_ro;`,
    );
  }
}
