/**
 * Sprint 8 Tache 8.3 -- CREATE TABLES crm_pipelines + crm_stages.
 *
 * But : pipelines configurables par tenant pour deals workflow (e.g. "Pipeline Auto",
 * "Pipeline Sante", "Pipeline Pro Garage") avec stages personnalisables.
 *
 * Note : Sprint 2 a fige crm_deals.stage en enum 6 valeurs (lead/qualified/proposal/
 * negotiation/won/lost). Task 8.4 (Deals) introduira stage_id FK -> crm_stages.id et
 * deprecate l'enum. Pour Task 8.3 on cree juste les nouvelles tables sans toucher crm_deals.
 *
 * Multi-tenant strict :
 *   - tenant_id obligatoire sur les 2 tables
 *   - RLS ENABLE + FORCE (heritage Sprint 6 + 7.5a)
 *   - Policies via app_can_access_tenant() helper v3.0
 *
 * Contraintes business :
 *   - Pipeline name UNIQUE per tenant (UNIQUE INDEX standard)
 *   - At most ONE is_default pipeline per tenant (UNIQUE PARTIAL INDEX WHERE is_default = true)
 *   - Stage position UNIQUE per pipeline (UNIQUE INDEX pipeline_id + position)
 *   - Stage name UNIQUE per pipeline (UNIQUE INDEX pipeline_id + name)
 *   - win_probability decimal 0-100 (CHECK)
 *   - color hex format (CHECK regex pour #RRGGBB)
 *   - Cascade : DELETE pipeline -> DELETE stages (ON DELETE CASCADE)
 *
 * Bug #5 Pause #5 prevention : grants explicites pour role insurtech_app.
 *
 * Reference : B-08 Tache 3.1.3.
 */

import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCrmPipelinesStages1735000000016 implements MigrationInterface {
  name = 'CreateCrmPipelinesStages1735000000016';

  async up(q: QueryRunner): Promise<void> {
    // ---------------------------------------------------------------------
    // Table crm_pipelines
    // ---------------------------------------------------------------------
    await q.query(`
      CREATE TABLE IF NOT EXISTS crm_pipelines (
        id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id       uuid          NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
        name            varchar(150)  NOT NULL,
        description     text,
        is_default      boolean       NOT NULL DEFAULT false,
        created_at      timestamptz   NOT NULL DEFAULT NOW(),
        updated_at      timestamptz   NOT NULL DEFAULT NOW(),
        created_by      uuid,
        updated_by      uuid,
        CONSTRAINT crm_pipelines_name_not_empty CHECK (char_length(name) >= 1)
      );
    `);

    // Indexes pipelines
    await q.query(
      `CREATE INDEX IF NOT EXISTS idx_crm_pipelines_tenant ON crm_pipelines(tenant_id);`,
    );
    await q.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_pipelines_tenant_name
        ON crm_pipelines(tenant_id, name);
    `);
    // At most one default pipeline per tenant
    await q.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_pipelines_tenant_default
        ON crm_pipelines(tenant_id)
        WHERE is_default = true;
    `);

    // RLS pipelines
    await q.query(`ALTER TABLE crm_pipelines ENABLE ROW LEVEL SECURITY;`);
    await q.query(`ALTER TABLE crm_pipelines FORCE ROW LEVEL SECURITY;`);
    await q.query(`DROP POLICY IF EXISTS crm_pipelines_select ON crm_pipelines;`);
    await q.query(`
      CREATE POLICY crm_pipelines_select ON crm_pipelines
        FOR SELECT USING (app_can_access_tenant(tenant_id));
    `);
    await q.query(`DROP POLICY IF EXISTS crm_pipelines_insert ON crm_pipelines;`);
    await q.query(`
      CREATE POLICY crm_pipelines_insert ON crm_pipelines
        FOR INSERT WITH CHECK (app_can_access_tenant(tenant_id));
    `);
    await q.query(`DROP POLICY IF EXISTS crm_pipelines_update ON crm_pipelines;`);
    await q.query(`
      CREATE POLICY crm_pipelines_update ON crm_pipelines
        FOR UPDATE USING (app_can_access_tenant(tenant_id))
        WITH CHECK (app_can_access_tenant(tenant_id));
    `);
    await q.query(`DROP POLICY IF EXISTS crm_pipelines_delete ON crm_pipelines;`);
    await q.query(`
      CREATE POLICY crm_pipelines_delete ON crm_pipelines
        FOR DELETE USING (app_can_access_tenant(tenant_id));
    `);

    // Trigger updated_at (function defined Sprint 7.5a.4 -- set_updated_at_timestamp)
    await q.query(`DROP TRIGGER IF EXISTS trg_crm_pipelines_updated_at ON crm_pipelines;`);
    await q.query(`
      CREATE TRIGGER trg_crm_pipelines_updated_at
        BEFORE UPDATE ON crm_pipelines
        FOR EACH ROW
        EXECUTE FUNCTION set_updated_at_timestamp();
    `);

    // ---------------------------------------------------------------------
    // Table crm_stages
    // ---------------------------------------------------------------------
    await q.query(`
      CREATE TABLE IF NOT EXISTS crm_stages (
        id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id         uuid          NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
        pipeline_id       uuid          NOT NULL REFERENCES crm_pipelines(id) ON DELETE CASCADE,
        name              varchar(100)  NOT NULL,
        position          int           NOT NULL,
        color             varchar(7)    NOT NULL DEFAULT '#808080',
        win_probability   numeric(5,2)  NOT NULL DEFAULT 0,
        created_at        timestamptz   NOT NULL DEFAULT NOW(),
        updated_at        timestamptz   NOT NULL DEFAULT NOW(),
        created_by        uuid,
        updated_by        uuid,
        CONSTRAINT crm_stages_name_not_empty CHECK (char_length(name) >= 1),
        CONSTRAINT crm_stages_position_positive CHECK (position >= 0),
        CONSTRAINT crm_stages_win_probability_range
          CHECK (win_probability >= 0 AND win_probability <= 100),
        CONSTRAINT crm_stages_color_hex
          CHECK (color ~ '^#[0-9A-Fa-f]{6}$')
      );
    `);

    // Indexes stages
    await q.query(`CREATE INDEX IF NOT EXISTS idx_crm_stages_tenant ON crm_stages(tenant_id);`);
    await q.query(
      `CREATE INDEX IF NOT EXISTS idx_crm_stages_pipeline ON crm_stages(pipeline_id);`,
    );
    await q.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_stages_pipeline_position
        ON crm_stages(pipeline_id, position);
    `);
    await q.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_stages_pipeline_name
        ON crm_stages(pipeline_id, name);
    `);

    // RLS stages
    await q.query(`ALTER TABLE crm_stages ENABLE ROW LEVEL SECURITY;`);
    await q.query(`ALTER TABLE crm_stages FORCE ROW LEVEL SECURITY;`);
    await q.query(`DROP POLICY IF EXISTS crm_stages_select ON crm_stages;`);
    await q.query(`
      CREATE POLICY crm_stages_select ON crm_stages
        FOR SELECT USING (app_can_access_tenant(tenant_id));
    `);
    await q.query(`DROP POLICY IF EXISTS crm_stages_insert ON crm_stages;`);
    await q.query(`
      CREATE POLICY crm_stages_insert ON crm_stages
        FOR INSERT WITH CHECK (app_can_access_tenant(tenant_id));
    `);
    await q.query(`DROP POLICY IF EXISTS crm_stages_update ON crm_stages;`);
    await q.query(`
      CREATE POLICY crm_stages_update ON crm_stages
        FOR UPDATE USING (app_can_access_tenant(tenant_id))
        WITH CHECK (app_can_access_tenant(tenant_id));
    `);
    await q.query(`DROP POLICY IF EXISTS crm_stages_delete ON crm_stages;`);
    await q.query(`
      CREATE POLICY crm_stages_delete ON crm_stages
        FOR DELETE USING (app_can_access_tenant(tenant_id));
    `);

    // Trigger updated_at
    await q.query(`DROP TRIGGER IF EXISTS trg_crm_stages_updated_at ON crm_stages;`);
    await q.query(`
      CREATE TRIGGER trg_crm_stages_updated_at
        BEFORE UPDATE ON crm_stages
        FOR EACH ROW
        EXECUTE FUNCTION set_updated_at_timestamp();
    `);

    // Grants (Bug #5 Pause #5 prevention)
    await q.query(`
      GRANT SELECT, INSERT, UPDATE, DELETE ON crm_pipelines
        TO insurtech_app, insurtech_admin;
    `);
    await q.query(`GRANT SELECT ON crm_pipelines TO insurtech_ro;`);
    await q.query(`
      GRANT SELECT, INSERT, UPDATE, DELETE ON crm_stages
        TO insurtech_app, insurtech_admin;
    `);
    await q.query(`GRANT SELECT ON crm_stages TO insurtech_ro;`);

    // Documentation
    await q.query(
      `COMMENT ON TABLE crm_pipelines IS 'CRM pipelines configurables per tenant -- max 1 default per tenant -- RLS FORCE -- Sprint 8.3';`,
    );
    await q.query(
      `COMMENT ON TABLE crm_stages IS 'CRM pipeline stages -- position unique per pipeline -- color hex -- win_probability 0-100 -- RLS FORCE -- Sprint 8.3';`,
    );
    await q.query(
      `COMMENT ON COLUMN crm_pipelines.is_default IS 'At most ONE default pipeline per tenant -- enforced via uq_crm_pipelines_tenant_default partial index';`,
    );
    await q.query(
      `COMMENT ON COLUMN crm_stages.win_probability IS 'Probabilite de gain pour deals dans ce stage -- numeric 5,2 [0..100]';`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TRIGGER IF EXISTS trg_crm_stages_updated_at ON crm_stages;`);
    await q.query(`DROP TRIGGER IF EXISTS trg_crm_pipelines_updated_at ON crm_pipelines;`);
    await q.query(`DROP POLICY IF EXISTS crm_stages_select ON crm_stages;`);
    await q.query(`DROP POLICY IF EXISTS crm_stages_insert ON crm_stages;`);
    await q.query(`DROP POLICY IF EXISTS crm_stages_update ON crm_stages;`);
    await q.query(`DROP POLICY IF EXISTS crm_stages_delete ON crm_stages;`);
    await q.query(`DROP POLICY IF EXISTS crm_pipelines_select ON crm_pipelines;`);
    await q.query(`DROP POLICY IF EXISTS crm_pipelines_insert ON crm_pipelines;`);
    await q.query(`DROP POLICY IF EXISTS crm_pipelines_update ON crm_pipelines;`);
    await q.query(`DROP POLICY IF EXISTS crm_pipelines_delete ON crm_pipelines;`);
    await q.query(`DROP TABLE IF EXISTS crm_stages CASCADE;`);
    await q.query(`DROP TABLE IF EXISTS crm_pipelines CASCADE;`);
  }
}
