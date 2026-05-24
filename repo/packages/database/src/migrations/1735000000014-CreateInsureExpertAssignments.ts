/**
 * Sprint 7.5b Tache 7.5b.6 -- CREATE TABLE insure_expert_assignments (skeleton).
 *
 * Mission d'expertise designee a un expert par un carrier (decision-013 workflow).
 *
 * Cycle de vie (status 5 valeurs) :
 *   designated -> accepted -> completed
 *   designated -> rejected
 *   designated -> cancelled
 *
 * Reference cross-tenant authorization Sprint 7.5a v3.0 :
 *   - type 6 garage_to_expert_request (lecture devis par expert)
 *   - le designation cross-tenant utilise un mecanisme dedie (Sprint 14)
 *
 * Sprint 14 : service designation + workflow validation devis.
 * Sprint 22.7 : Expert App PWA pour accepter/rejeter missions + validation devis.
 */

import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInsureExpertAssignments1735000000014 implements MigrationInterface {
  name = 'CreateInsureExpertAssignments1735000000014';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS insure_expert_assignments (
        id                       uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id                uuid          NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
        expert_id                uuid          NOT NULL REFERENCES insure_experts(id) ON DELETE RESTRICT,
        sinistre_id              uuid          NOT NULL,
        designated_by_user_id    uuid          NOT NULL REFERENCES auth_users(id) ON DELETE RESTRICT,
        status                   text          NOT NULL DEFAULT 'designated',
        designated_at            timestamptz   NOT NULL DEFAULT NOW(),
        accepted_at              timestamptz   NULL,
        completed_at             timestamptz   NULL,
        rejection_reason         text          NULL,
        created_at               timestamptz   NOT NULL DEFAULT NOW(),
        updated_at               timestamptz   NOT NULL DEFAULT NOW(),
        CONSTRAINT insure_expert_assignments_status_chk
          CHECK (status IN ('designated', 'accepted', 'rejected', 'completed', 'cancelled'))
      );
    `);

    // Indexes
    await q.query(
      `CREATE INDEX IF NOT EXISTS idx_iea_tenant ON insure_expert_assignments(tenant_id);`,
    );
    await q.query(
      `CREATE INDEX IF NOT EXISTS idx_iea_expert ON insure_expert_assignments(expert_id);`,
    );
    await q.query(
      `CREATE INDEX IF NOT EXISTS idx_iea_sinistre ON insure_expert_assignments(sinistre_id);`,
    );
    await q.query(`CREATE INDEX IF NOT EXISTS idx_iea_status ON insure_expert_assignments(status);`);

    // RLS active
    await q.query(`ALTER TABLE insure_expert_assignments ENABLE ROW LEVEL SECURITY;`);
    await q.query(`ALTER TABLE insure_expert_assignments FORCE ROW LEVEL SECURITY;`);

    // Policies
    await q.query(`DROP POLICY IF EXISTS iea_select ON insure_expert_assignments;`);
    await q.query(`
      CREATE POLICY iea_select ON insure_expert_assignments
        FOR SELECT
        USING (app_can_access_tenant(tenant_id));
    `);
    await q.query(`DROP POLICY IF EXISTS iea_insert ON insure_expert_assignments;`);
    await q.query(`
      CREATE POLICY iea_insert ON insure_expert_assignments
        FOR INSERT
        WITH CHECK (app_can_access_tenant(tenant_id));
    `);
    await q.query(`DROP POLICY IF EXISTS iea_update ON insure_expert_assignments;`);
    await q.query(`
      CREATE POLICY iea_update ON insure_expert_assignments
        FOR UPDATE
        USING (app_can_access_tenant(tenant_id))
        WITH CHECK (app_can_access_tenant(tenant_id));
    `);
    await q.query(`DROP POLICY IF EXISTS iea_delete ON insure_expert_assignments;`);
    await q.query(`
      CREATE POLICY iea_delete ON insure_expert_assignments
        FOR DELETE
        USING (app_can_access_tenant(tenant_id));
    `);

    // Trigger updated_at
    await q.query(`DROP TRIGGER IF EXISTS trg_iea_updated_at ON insure_expert_assignments;`);
    await q.query(`
      CREATE TRIGGER trg_iea_updated_at
        BEFORE UPDATE ON insure_expert_assignments
        FOR EACH ROW
        EXECUTE FUNCTION set_updated_at_timestamp();
    `);

    // Grants
    await q.query(`
      GRANT SELECT, INSERT, UPDATE, DELETE ON insure_expert_assignments
        TO insurtech_app, insurtech_admin;
    `);
    await q.query(`GRANT SELECT ON insure_expert_assignments TO insurtech_ro;`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TRIGGER IF EXISTS trg_iea_updated_at ON insure_expert_assignments;`);
    await q.query(`DROP POLICY IF EXISTS iea_select ON insure_expert_assignments;`);
    await q.query(`DROP POLICY IF EXISTS iea_insert ON insure_expert_assignments;`);
    await q.query(`DROP POLICY IF EXISTS iea_update ON insure_expert_assignments;`);
    await q.query(`DROP POLICY IF EXISTS iea_delete ON insure_expert_assignments;`);
    await q.query(`DROP TABLE IF EXISTS insure_expert_assignments CASCADE;`);
  }
}
