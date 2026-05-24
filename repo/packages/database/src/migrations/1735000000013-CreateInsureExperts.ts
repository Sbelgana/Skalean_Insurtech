/**
 * Sprint 7.5b Tache 7.5b.5 -- CREATE TABLE insure_experts (foundation skeleton).
 *
 * Table representant les experts automobile agrees ACAPS (decision-013).
 *
 * Multi-tenant :
 *   - tenant_id obligatoire (Expert tenant OU Carrier tenant pour expert_carrier_internal)
 *   - JAMAIS rattache au tenant Garage (regle ACAPS independance, decision-013)
 *   - RLS active + FORCE RLS (heritage Sprint 6)
 *
 * Conformite :
 *   - acaps_registration_number obligatoire (loi 17-99 + agrement ACAPS)
 *   - cin obligatoire (identification personne physique experte)
 *   - speciality ENUM : automobile / dommage_corporel / responsabilite_civile
 *   - status ENUM : pending / active / suspended / archived
 *
 * Sprint 14 : CRUD service + dashboard Carrier (designation pool).
 * Sprint 22.7 : Expert App PWA mobile + workflow validation devis.
 */

import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInsureExperts1735000000013 implements MigrationInterface {
  name = 'CreateInsureExperts1735000000013';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS insure_experts (
        id                          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id                   uuid          NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
        user_id                     uuid          NOT NULL REFERENCES auth_users(id) ON DELETE RESTRICT,
        cin                         text          NOT NULL,
        acaps_registration_number   text          NOT NULL,
        speciality                  text          NOT NULL,
        acaps_registration_date     date          NOT NULL,
        status                      text          NOT NULL DEFAULT 'pending',
        created_at                  timestamptz   NOT NULL DEFAULT NOW(),
        updated_at                  timestamptz   NOT NULL DEFAULT NOW(),
        CONSTRAINT insure_experts_speciality_chk
          CHECK (speciality IN ('automobile', 'dommage_corporel', 'responsabilite_civile')),
        CONSTRAINT insure_experts_status_chk
          CHECK (status IN ('pending', 'active', 'suspended', 'archived')),
        CONSTRAINT insure_experts_acaps_uq UNIQUE (acaps_registration_number),
        CONSTRAINT insure_experts_user_uq UNIQUE (user_id)
      );
    `);

    // Indexes
    await q.query(`CREATE INDEX IF NOT EXISTS idx_insure_experts_tenant ON insure_experts(tenant_id);`);
    await q.query(`CREATE INDEX IF NOT EXISTS idx_insure_experts_status ON insure_experts(status);`);
    await q.query(
      `CREATE INDEX IF NOT EXISTS idx_insure_experts_speciality ON insure_experts(speciality);`,
    );

    // RLS active (heritage Sprint 6 + 7.5a)
    await q.query(`ALTER TABLE insure_experts ENABLE ROW LEVEL SECURITY;`);
    await q.query(`ALTER TABLE insure_experts FORCE ROW LEVEL SECURITY;`);

    // Policies via app_can_access_tenant() helper v3.0 (Sprint 7.5a.5)
    await q.query(`DROP POLICY IF EXISTS insure_experts_select ON insure_experts;`);
    await q.query(`
      CREATE POLICY insure_experts_select ON insure_experts
        FOR SELECT
        USING (app_can_access_tenant(tenant_id));
    `);
    await q.query(`DROP POLICY IF EXISTS insure_experts_insert ON insure_experts;`);
    await q.query(`
      CREATE POLICY insure_experts_insert ON insure_experts
        FOR INSERT
        WITH CHECK (app_can_access_tenant(tenant_id));
    `);
    await q.query(`DROP POLICY IF EXISTS insure_experts_update ON insure_experts;`);
    await q.query(`
      CREATE POLICY insure_experts_update ON insure_experts
        FOR UPDATE
        USING (app_can_access_tenant(tenant_id))
        WITH CHECK (app_can_access_tenant(tenant_id));
    `);
    await q.query(`DROP POLICY IF EXISTS insure_experts_delete ON insure_experts;`);
    await q.query(`
      CREATE POLICY insure_experts_delete ON insure_experts
        FOR DELETE
        USING (app_can_access_tenant(tenant_id));
    `);

    // Trigger updated_at (function created Sprint 7.5a.4 -- set_updated_at_timestamp)
    await q.query(`DROP TRIGGER IF EXISTS trg_insure_experts_updated_at ON insure_experts;`);
    await q.query(`
      CREATE TRIGGER trg_insure_experts_updated_at
        BEFORE UPDATE ON insure_experts
        FOR EACH ROW
        EXECUTE FUNCTION set_updated_at_timestamp();
    `);

    // Bug #5 Pause #5 prevention : grants explicites pour role insurtech_app
    await q.query(`
      GRANT SELECT, INSERT, UPDATE, DELETE ON insure_experts
        TO insurtech_app, insurtech_admin;
    `);
    await q.query(`GRANT SELECT ON insure_experts TO insurtech_ro;`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TRIGGER IF EXISTS trg_insure_experts_updated_at ON insure_experts;`);
    await q.query(`DROP POLICY IF EXISTS insure_experts_select ON insure_experts;`);
    await q.query(`DROP POLICY IF EXISTS insure_experts_insert ON insure_experts;`);
    await q.query(`DROP POLICY IF EXISTS insure_experts_update ON insure_experts;`);
    await q.query(`DROP POLICY IF EXISTS insure_experts_delete ON insure_experts;`);
    await q.query(`DROP TABLE IF EXISTS insure_experts CASCADE;`);
  }
}
