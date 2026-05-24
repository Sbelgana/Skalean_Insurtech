/**
 * Sprint 7.5b Tache 7.5b.7 -- CREATE TABLE insure_expert_reports (skeleton).
 *
 * Rapport d'expertise (PDF) signe electroniquement (decision-009 loi 43-20 Barid eSign).
 *
 * Conformite :
 *   - report_url : S3/MinIO ou Atlas Cloud Services Maroc Object Storage (decision-008)
 *   - signature_hash : SHA-256 du PDF signe (audit trail)
 *   - signed_at : timestamp signature electronique loi 43-20
 *
 * Cycle de vie (status 5 valeurs) :
 *   draft -> submitted -> signed -> archived
 *   submitted -> rejected (cycle re-edition)
 *
 * Sprint 14 : service createReport + signReport.
 * Sprint 10 : integration Barid eSign (signature flow).
 * Sprint 22.7 : Expert App UI upload PDF + display rapport.
 */

import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInsureExpertReports1735000000015 implements MigrationInterface {
  name = 'CreateInsureExpertReports1735000000015';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS insure_expert_reports (
        id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id           uuid          NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
        assignment_id       uuid          NOT NULL REFERENCES insure_expert_assignments(id) ON DELETE RESTRICT,
        report_url          text          NOT NULL,
        signature_hash      text          NULL,
        signed_at           timestamptz   NULL,
        status              text          NOT NULL DEFAULT 'draft',
        created_at          timestamptz   NOT NULL DEFAULT NOW(),
        updated_at          timestamptz   NOT NULL DEFAULT NOW(),
        CONSTRAINT insure_expert_reports_status_chk
          CHECK (status IN ('draft', 'submitted', 'signed', 'archived', 'rejected')),
        CONSTRAINT insure_expert_reports_signature_consistency_chk
          CHECK (
            (status = 'signed' AND signature_hash IS NOT NULL AND signed_at IS NOT NULL)
            OR (status <> 'signed')
          )
      );
    `);

    // Indexes
    await q.query(
      `CREATE INDEX IF NOT EXISTS idx_ier_tenant ON insure_expert_reports(tenant_id);`,
    );
    await q.query(
      `CREATE INDEX IF NOT EXISTS idx_ier_assignment ON insure_expert_reports(assignment_id);`,
    );
    await q.query(`CREATE INDEX IF NOT EXISTS idx_ier_status ON insure_expert_reports(status);`);

    // RLS active
    await q.query(`ALTER TABLE insure_expert_reports ENABLE ROW LEVEL SECURITY;`);
    await q.query(`ALTER TABLE insure_expert_reports FORCE ROW LEVEL SECURITY;`);

    // Policies
    await q.query(`DROP POLICY IF EXISTS ier_select ON insure_expert_reports;`);
    await q.query(`
      CREATE POLICY ier_select ON insure_expert_reports
        FOR SELECT
        USING (app_can_access_tenant(tenant_id));
    `);
    await q.query(`DROP POLICY IF EXISTS ier_insert ON insure_expert_reports;`);
    await q.query(`
      CREATE POLICY ier_insert ON insure_expert_reports
        FOR INSERT
        WITH CHECK (app_can_access_tenant(tenant_id));
    `);
    await q.query(`DROP POLICY IF EXISTS ier_update ON insure_expert_reports;`);
    await q.query(`
      CREATE POLICY ier_update ON insure_expert_reports
        FOR UPDATE
        USING (app_can_access_tenant(tenant_id))
        WITH CHECK (app_can_access_tenant(tenant_id));
    `);
    await q.query(`DROP POLICY IF EXISTS ier_delete ON insure_expert_reports;`);
    await q.query(`
      CREATE POLICY ier_delete ON insure_expert_reports
        FOR DELETE
        USING (app_can_access_tenant(tenant_id));
    `);

    // Trigger updated_at
    await q.query(`DROP TRIGGER IF EXISTS trg_ier_updated_at ON insure_expert_reports;`);
    await q.query(`
      CREATE TRIGGER trg_ier_updated_at
        BEFORE UPDATE ON insure_expert_reports
        FOR EACH ROW
        EXECUTE FUNCTION set_updated_at_timestamp();
    `);

    // Grants
    await q.query(`
      GRANT SELECT, INSERT, UPDATE, DELETE ON insure_expert_reports
        TO insurtech_app, insurtech_admin;
    `);
    await q.query(`GRANT SELECT ON insure_expert_reports TO insurtech_ro;`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TRIGGER IF EXISTS trg_ier_updated_at ON insure_expert_reports;`);
    await q.query(`DROP POLICY IF EXISTS ier_select ON insure_expert_reports;`);
    await q.query(`DROP POLICY IF EXISTS ier_insert ON insure_expert_reports;`);
    await q.query(`DROP POLICY IF EXISTS ier_update ON insure_expert_reports;`);
    await q.query(`DROP POLICY IF EXISTS ier_delete ON insure_expert_reports;`);
    await q.query(`DROP TABLE IF EXISTS insure_expert_reports CASCADE;`);
  }
}
