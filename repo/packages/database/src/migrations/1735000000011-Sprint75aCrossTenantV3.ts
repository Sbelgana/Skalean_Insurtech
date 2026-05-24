/**
 * Sprint 7.5a Tache 7.5a.4 -- Foundation Migration v3.0.
 *
 * Migration DB structures Assurflow v3.0 :
 *   - CREATE cross_tenant_authorizations IF NOT EXISTS (avec CHECK 7 types et CHECK 8 resource types).
 *     La table n'avait pas de CREATE TABLE explicite en v2.2 (entity TypeORM seule), donc
 *     la migration la cree de maniere idempotente.
 *   - Si la table existait deja, ALTER CHECK constraints (drop then add) pour v3.0.
 *   - CREATE TABLE expert_designations + RLS + indexes + trigger updated_at.
 *
 * RLS active via app_can_access_tenant() helper (extension Sprint 7.5a.5).
 *
 * Reference :
 *   - 00-pilotage/decisions/012-ecosysteme-6-acteurs.md (7 types cross-tenant)
 *   - 00-pilotage/decisions/013-expert-acteur-central.md (table expert_designations)
 *   - B-7.5a Tache 7.5a.4.
 */

import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Sprint75aCrossTenantV31735000000011 implements MigrationInterface {
  name = 'Sprint75aCrossTenantV31735000000011';

  async up(q: QueryRunner): Promise<void> {
    // ========================================================================
    // STEP 1 : cross_tenant_authorizations (CREATE IF NOT EXISTS, sinon ALTER)
    // ========================================================================
    await q.query(`
      CREATE TABLE IF NOT EXISTS cross_tenant_authorizations (
        id                    uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
        type                  text          NOT NULL,
        from_tenant_id        uuid          NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
        to_tenant_id          uuid          NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
        scope                 text[]        NOT NULL DEFAULT '{}'::text[],
        resource_type         text          NULL,
        resource_id           uuid          NULL,
        granted_by_user_id    uuid          NOT NULL REFERENCES auth_users(id) ON DELETE RESTRICT,
        granted_at            timestamptz   NOT NULL DEFAULT NOW(),
        expires_at            timestamptz   NOT NULL,
        revoked_at            timestamptz   NULL,
        revoked_by_user_id    uuid          NULL REFERENCES auth_users(id) ON DELETE RESTRICT,
        revoked_reason        text          NULL,
        metadata              jsonb         NOT NULL DEFAULT '{}'::jsonb
      );
    `);

    // Indexes (idempotents)
    await q.query(
      `CREATE INDEX IF NOT EXISTS idx_cta_from_tenant ON cross_tenant_authorizations (from_tenant_id);`,
    );
    await q.query(
      `CREATE INDEX IF NOT EXISTS idx_cta_to_tenant   ON cross_tenant_authorizations (to_tenant_id);`,
    );
    await q.query(
      `CREATE INDEX IF NOT EXISTS idx_cta_type        ON cross_tenant_authorizations (type);`,
    );
    // Index partiel actif (Sprint 6 framework) :
    // Bug fix Pause #5 : retirer expires_at > NOW() du predicate car NOW() est
    // STABLE (pas IMMUTABLE) -- viole CheckPredicate Postgres. Le filtering
    // expires_at est effectue au runtime dans le helper app_can_access_tenant.
    await q.query(`
      CREATE INDEX IF NOT EXISTS idx_cta_active
        ON cross_tenant_authorizations (from_tenant_id, to_tenant_id, type)
        WHERE revoked_at IS NULL;
    `);

    // CHECK constraint type : drop si existant, recreer avec 7 valeurs v3.0
    await q.query(`
      ALTER TABLE cross_tenant_authorizations
        DROP CONSTRAINT IF EXISTS cross_tenant_authorizations_type_chk;
    `);
    await q.query(`
      ALTER TABLE cross_tenant_authorizations
        ADD CONSTRAINT cross_tenant_authorizations_type_chk
        CHECK (type IN (
          'broker_to_garage_assignment',
          'assure_to_garage_visit',
          'multi_tenant_user_access',
          'client_to_tower_dispatch',
          'tower_to_garage_delivery',
          'garage_to_expert_request',
          'garage_to_carrier_quote'
        ));
    `);

    // CHECK constraint resource_type : drop si existant, recreer avec 8 valeurs v3.0
    await q.query(`
      ALTER TABLE cross_tenant_authorizations
        DROP CONSTRAINT IF EXISTS cross_tenant_authorizations_resource_type_chk;
    `);
    await q.query(`
      ALTER TABLE cross_tenant_authorizations
        ADD CONSTRAINT cross_tenant_authorizations_resource_type_chk
        CHECK (resource_type IS NULL OR resource_type IN (
          'sinistre',
          'police',
          'devis',
          'facture',
          'tenant',
          'mission',
          'expertise',
          'parts_order'
        ));
    `);

    // RLS sur cross_tenant_authorizations : tenant isolation via from OR to tenant.
    await q.query(`ALTER TABLE cross_tenant_authorizations ENABLE ROW LEVEL SECURITY;`);
    await q.query(`ALTER TABLE cross_tenant_authorizations FORCE ROW LEVEL SECURITY;`);
    await q.query(`
      DROP POLICY IF EXISTS cross_tenant_auth_select ON cross_tenant_authorizations;
    `);
    await q.query(`
      CREATE POLICY cross_tenant_auth_select ON cross_tenant_authorizations
        FOR SELECT
        USING (
          app_can_access_tenant(from_tenant_id) OR app_can_access_tenant(to_tenant_id)
        );
    `);
    await q.query(`
      DROP POLICY IF EXISTS cross_tenant_auth_insert ON cross_tenant_authorizations;
    `);
    await q.query(`
      CREATE POLICY cross_tenant_auth_insert ON cross_tenant_authorizations
        FOR INSERT
        WITH CHECK (
          app_can_access_tenant(from_tenant_id) OR app_can_access_tenant(to_tenant_id)
        );
    `);
    await q.query(`
      DROP POLICY IF EXISTS cross_tenant_auth_update ON cross_tenant_authorizations;
    `);
    await q.query(`
      CREATE POLICY cross_tenant_auth_update ON cross_tenant_authorizations
        FOR UPDATE
        USING (
          app_can_access_tenant(from_tenant_id) OR app_can_access_tenant(to_tenant_id)
        )
        WITH CHECK (
          app_can_access_tenant(from_tenant_id) OR app_can_access_tenant(to_tenant_id)
        );
    `);
    await q.query(`
      DROP POLICY IF EXISTS cross_tenant_auth_delete ON cross_tenant_authorizations;
    `);
    await q.query(`
      CREATE POLICY cross_tenant_auth_delete ON cross_tenant_authorizations
        FOR DELETE
        USING (
          app_can_access_tenant(from_tenant_id) OR app_can_access_tenant(to_tenant_id)
        );
    `);

    // ========================================================================
    // STEP 2 : expert_designations (decision-013)
    // ========================================================================
    await q.query(`
      CREATE TABLE IF NOT EXISTS expert_designations (
        id                   uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id            uuid          NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
        carrier_tenant_id    uuid          NOT NULL REFERENCES auth_tenants(id) ON DELETE RESTRICT,
        carrier_user_id      uuid          NOT NULL REFERENCES auth_users(id)   ON DELETE RESTRICT,
        expert_tenant_id     uuid          NOT NULL REFERENCES auth_tenants(id) ON DELETE RESTRICT,
        expert_user_id       uuid          NOT NULL REFERENCES auth_users(id)   ON DELETE RESTRICT,
        sinistre_id          uuid          NOT NULL,
        status               text          NOT NULL,
        designated_at        timestamptz   NOT NULL DEFAULT NOW(),
        accepted_at          timestamptz   NULL,
        rejected_at          timestamptz   NULL,
        rejection_reason     text          NULL,
        completed_at         timestamptz   NULL,
        notes                text          NULL,
        created_at           timestamptz   NOT NULL DEFAULT NOW(),
        updated_at           timestamptz   NOT NULL DEFAULT NOW(),
        CONSTRAINT expert_designations_status_chk
          CHECK (status IN ('designated','accepted','rejected','completed','cancelled'))
      );
    `);

    // Indexes
    await q.query(
      `CREATE INDEX IF NOT EXISTS idx_expert_designations_tenant   ON expert_designations(tenant_id);`,
    );
    await q.query(
      `CREATE INDEX IF NOT EXISTS idx_expert_designations_carrier  ON expert_designations(carrier_tenant_id);`,
    );
    await q.query(
      `CREATE INDEX IF NOT EXISTS idx_expert_designations_expert   ON expert_designations(expert_tenant_id);`,
    );
    await q.query(
      `CREATE INDEX IF NOT EXISTS idx_expert_designations_sinistre ON expert_designations(sinistre_id);`,
    );
    await q.query(
      `CREATE INDEX IF NOT EXISTS idx_expert_designations_status   ON expert_designations(status);`,
    );

    // RLS active (tenant_id isolation par app_can_access_tenant)
    await q.query(`ALTER TABLE expert_designations ENABLE ROW LEVEL SECURITY;`);
    await q.query(`ALTER TABLE expert_designations FORCE ROW LEVEL SECURITY;`);
    await q.query(`DROP POLICY IF EXISTS expert_designations_select ON expert_designations;`);
    await q.query(`
      CREATE POLICY expert_designations_select ON expert_designations
        FOR SELECT
        USING (app_can_access_tenant(tenant_id));
    `);
    await q.query(`DROP POLICY IF EXISTS expert_designations_insert ON expert_designations;`);
    await q.query(`
      CREATE POLICY expert_designations_insert ON expert_designations
        FOR INSERT
        WITH CHECK (app_can_access_tenant(tenant_id));
    `);
    await q.query(`DROP POLICY IF EXISTS expert_designations_update ON expert_designations;`);
    await q.query(`
      CREATE POLICY expert_designations_update ON expert_designations
        FOR UPDATE
        USING (app_can_access_tenant(tenant_id))
        WITH CHECK (app_can_access_tenant(tenant_id));
    `);
    await q.query(`DROP POLICY IF EXISTS expert_designations_delete ON expert_designations;`);
    await q.query(`
      CREATE POLICY expert_designations_delete ON expert_designations
        FOR DELETE
        USING (app_can_access_tenant(tenant_id));
    `);

    // Trigger updated_at : utilise une fonction generique (creee ici si absente).
    await q.query(`
      CREATE OR REPLACE FUNCTION set_updated_at_timestamp()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$;
    `);
    await q.query(`
      DROP TRIGGER IF EXISTS trg_expert_designations_updated_at ON expert_designations;
    `);
    await q.query(`
      CREATE TRIGGER trg_expert_designations_updated_at
        BEFORE UPDATE ON expert_designations
        FOR EACH ROW
        EXECUTE FUNCTION set_updated_at_timestamp();
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    // expert_designations cleanup
    await q.query(
      `DROP TRIGGER IF EXISTS trg_expert_designations_updated_at ON expert_designations;`,
    );
    await q.query(`DROP POLICY IF EXISTS expert_designations_delete ON expert_designations;`);
    await q.query(`DROP POLICY IF EXISTS expert_designations_update ON expert_designations;`);
    await q.query(`DROP POLICY IF EXISTS expert_designations_insert ON expert_designations;`);
    await q.query(`DROP POLICY IF EXISTS expert_designations_select ON expert_designations;`);
    await q.query(`DROP TABLE IF EXISTS expert_designations CASCADE;`);
    // Ne pas supprimer set_updated_at_timestamp() : peut etre utilisee ailleurs.

    // cross_tenant_authorizations : restaurer CHECK v2.2 (3 types, 5 resources)
    await q.query(`
      ALTER TABLE cross_tenant_authorizations
        DROP CONSTRAINT IF EXISTS cross_tenant_authorizations_type_chk;
    `);
    await q.query(`
      ALTER TABLE cross_tenant_authorizations
        ADD CONSTRAINT cross_tenant_authorizations_type_chk
        CHECK (type IN (
          'broker_to_garage_assignment',
          'assure_to_garage_visit',
          'multi_tenant_user_access'
        ));
    `);
    await q.query(`
      ALTER TABLE cross_tenant_authorizations
        DROP CONSTRAINT IF EXISTS cross_tenant_authorizations_resource_type_chk;
    `);
    await q.query(`
      ALTER TABLE cross_tenant_authorizations
        ADD CONSTRAINT cross_tenant_authorizations_resource_type_chk
        CHECK (resource_type IS NULL OR resource_type IN (
          'sinistre','police','devis','facture','tenant'
        ));
    `);
    // Note : la table cross_tenant_authorizations est conservee (creee Sprint 7.5a).
    // Le RLS reste actif. Down ne supprime que la portion v3.0 (CHECK constraints).
  }
}
