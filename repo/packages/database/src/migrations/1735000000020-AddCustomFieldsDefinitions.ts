/**
 * Sprint 8 Tache 8.7 -- CREATE crm_custom_field_definitions + ADD custom_fields
 * jsonb columns on existing CRM entities + GIN jsonb_path_ops indexes.
 *
 * But : permettre aux tenants de definir leurs propres champs sur Companies /
 * Contacts / Deals / Interactions sans modification de schema. Validation
 * runtime via Zod construit dynamiquement depuis les definitions (Sprint 8.7
 * service layer).
 *
 * Verification live state (avant cette migration) :
 *   - 0 table `crm_custom_field_definitions` -> CREATE
 *   - 0 colonne `custom_fields` sur crm_companies/contacts/deals/interactions -> ADD
 *   - 0 index GIN jsonb_path_ops sur crm_* -> CREATE
 *
 * Multi-tenant strict :
 *   - tenant_id obligatoire sur definitions
 *   - RLS ENABLE + FORCE (heritage Sprint 6 + 7.5a)
 *   - Policies via app_can_access_tenant() helper v3.0
 *
 * Contraintes business :
 *   - UNIQUE (tenant_id, entity_type, field_key) : pas 2 definitions identiques
 *   - field_key regex snake_case `^[a-z][a-z0-9_]{0,48}$` (CHECK)
 *   - field_type enum-as-CHECK (string/number/boolean/date/datetime/select/multiselect/url/email)
 *   - entity_type enum-as-CHECK (company/contact/deal/interaction)
 *   - options jsonb requis quand field_type IN (select/multiselect) -- validation Zod side car
 *     CHECK SQL ne peut pas raisonner sur structure JSONB facilement
 *
 * Soft delete pattern (heritage 8.4 / 8.5) : `active boolean` flag (vs hard delete).
 *
 * Bug #5 Pause #5 prevention : grants explicites.
 *
 * Reference : B-08 Tache 3.1.7.
 */

import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCustomFieldsDefinitions1735000000020 implements MigrationInterface {
  name = 'AddCustomFieldsDefinitions1735000000020';

  async up(q: QueryRunner): Promise<void> {
    // -------------------------------------------------------------------------
    // 1. CREATE TABLE crm_custom_field_definitions
    // -------------------------------------------------------------------------
    await q.query(`
      CREATE TABLE IF NOT EXISTS crm_custom_field_definitions (
        id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id           uuid          NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
        entity_type         varchar(20)   NOT NULL,
        field_key           varchar(50)   NOT NULL,
        field_label         varchar(150)  NOT NULL,
        field_type          varchar(20)   NOT NULL,
        options             jsonb,
        validation_rules    jsonb         NOT NULL DEFAULT '{}',
        required            boolean       NOT NULL DEFAULT false,
        display_order       int           NOT NULL DEFAULT 0,
        active              boolean       NOT NULL DEFAULT true,
        description         text,
        created_at          timestamptz   NOT NULL DEFAULT NOW(),
        updated_at          timestamptz   NOT NULL DEFAULT NOW(),
        created_by          uuid,
        updated_by          uuid,
        CONSTRAINT cfd_entity_type_check
          CHECK (entity_type IN ('company', 'contact', 'deal', 'interaction')),
        CONSTRAINT cfd_field_type_check
          CHECK (field_type IN ('string', 'number', 'boolean', 'date', 'datetime',
                                'select', 'multiselect', 'url', 'email')),
        CONSTRAINT cfd_field_key_format
          CHECK (field_key ~ '^[a-z][a-z0-9_]{0,48}$'),
        CONSTRAINT cfd_label_not_empty
          CHECK (char_length(field_label) >= 1)
      );
    `);

    // UNIQUE : pas 2 definitions identiques per tenant/entity
    await q.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_cfd_tenant_entity_key
        ON crm_custom_field_definitions(tenant_id, entity_type, field_key);
    `);

    // Index dominant : list active definitions for an entity type
    await q.query(`
      CREATE INDEX IF NOT EXISTS idx_cfd_tenant_entity_active
        ON crm_custom_field_definitions(tenant_id, entity_type, active, display_order);
    `);

    // RLS
    await q.query(`ALTER TABLE crm_custom_field_definitions ENABLE ROW LEVEL SECURITY;`);
    await q.query(`ALTER TABLE crm_custom_field_definitions FORCE ROW LEVEL SECURITY;`);
    await q.query(`DROP POLICY IF EXISTS cfd_select ON crm_custom_field_definitions;`);
    await q.query(`
      CREATE POLICY cfd_select ON crm_custom_field_definitions
        FOR SELECT USING (app_can_access_tenant(tenant_id));
    `);
    await q.query(`DROP POLICY IF EXISTS cfd_insert ON crm_custom_field_definitions;`);
    await q.query(`
      CREATE POLICY cfd_insert ON crm_custom_field_definitions
        FOR INSERT WITH CHECK (app_can_access_tenant(tenant_id));
    `);
    await q.query(`DROP POLICY IF EXISTS cfd_update ON crm_custom_field_definitions;`);
    await q.query(`
      CREATE POLICY cfd_update ON crm_custom_field_definitions
        FOR UPDATE USING (app_can_access_tenant(tenant_id))
        WITH CHECK (app_can_access_tenant(tenant_id));
    `);
    await q.query(`DROP POLICY IF EXISTS cfd_delete ON crm_custom_field_definitions;`);
    await q.query(`
      CREATE POLICY cfd_delete ON crm_custom_field_definitions
        FOR DELETE USING (app_can_access_tenant(tenant_id));
    `);

    // Trigger updated_at (heritage Sprint 7.5a.4)
    await q.query(
      `DROP TRIGGER IF EXISTS trg_cfd_updated_at ON crm_custom_field_definitions;`,
    );
    await q.query(`
      CREATE TRIGGER trg_cfd_updated_at
        BEFORE UPDATE ON crm_custom_field_definitions
        FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();
    `);

    // -------------------------------------------------------------------------
    // 2. ADD custom_fields jsonb columns on existing CRM tables
    // -------------------------------------------------------------------------
    await q.query(`
      ALTER TABLE crm_companies
        ADD COLUMN IF NOT EXISTS custom_fields jsonb NOT NULL DEFAULT '{}';
    `);
    await q.query(`
      ALTER TABLE crm_contacts
        ADD COLUMN IF NOT EXISTS custom_fields jsonb NOT NULL DEFAULT '{}';
    `);
    await q.query(`
      ALTER TABLE crm_deals
        ADD COLUMN IF NOT EXISTS custom_fields jsonb NOT NULL DEFAULT '{}';
    `);
    await q.query(`
      ALTER TABLE crm_interactions
        ADD COLUMN IF NOT EXISTS custom_fields jsonb NOT NULL DEFAULT '{}';
    `);

    // -------------------------------------------------------------------------
    // 3. GIN jsonb_path_ops indexes (optimise pour `@>` containment queries)
    // -------------------------------------------------------------------------
    await q.query(`
      CREATE INDEX IF NOT EXISTS idx_crm_companies_custom_fields_gin
        ON crm_companies USING GIN (custom_fields jsonb_path_ops)
        WHERE deleted_at IS NULL;
    `);
    await q.query(`
      CREATE INDEX IF NOT EXISTS idx_crm_contacts_custom_fields_gin
        ON crm_contacts USING GIN (custom_fields jsonb_path_ops)
        WHERE deleted_at IS NULL;
    `);
    await q.query(`
      CREATE INDEX IF NOT EXISTS idx_crm_deals_custom_fields_gin
        ON crm_deals USING GIN (custom_fields jsonb_path_ops)
        WHERE deleted_at IS NULL;
    `);
    // Interactions : soft-delete uses deleted_at NULL ; mirror predicate
    await q.query(`
      CREATE INDEX IF NOT EXISTS idx_crm_interactions_custom_fields_gin
        ON crm_interactions USING GIN (custom_fields jsonb_path_ops)
        WHERE deleted_at IS NULL;
    `);

    // -------------------------------------------------------------------------
    // 4. Grants (Bug #5 Pause #5 prevention)
    // -------------------------------------------------------------------------
    await q.query(`
      GRANT SELECT, INSERT, UPDATE, DELETE ON crm_custom_field_definitions
        TO insurtech_app, insurtech_admin;
    `);
    await q.query(`GRANT SELECT ON crm_custom_field_definitions TO insurtech_ro;`);

    // -------------------------------------------------------------------------
    // 5. Documentation
    // -------------------------------------------------------------------------
    await q.query(
      `COMMENT ON TABLE crm_custom_field_definitions IS 'CRM custom fields metadata per tenant -- field_key snake_case unique per (tenant, entity_type) -- options requis pour select/multiselect (Zod side-validation, pas CHECK SQL) -- soft-delete via active flag -- Sprint 8.7';`,
    );
    await q.query(
      `COMMENT ON COLUMN crm_companies.custom_fields IS 'JSONB key/value pour custom fields per tenant. Schema valide a l''insert/update via CustomFieldsValidatorService (Zod runtime). GIN jsonb_path_ops idx pour @> queries.';`,
    );
    await q.query(
      `COMMENT ON COLUMN crm_contacts.custom_fields IS 'Voir crm_companies.custom_fields -- meme contrat.';`,
    );
    await q.query(
      `COMMENT ON COLUMN crm_deals.custom_fields IS 'Voir crm_companies.custom_fields -- meme contrat.';`,
    );
    await q.query(
      `COMMENT ON COLUMN crm_interactions.custom_fields IS 'Voir crm_companies.custom_fields -- meme contrat ; sur interactions, immutable post-create via Sprint 2 + 8.5 append-only triggers.';`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    // Drop indexes
    await q.query(`DROP INDEX IF EXISTS idx_crm_interactions_custom_fields_gin;`);
    await q.query(`DROP INDEX IF EXISTS idx_crm_deals_custom_fields_gin;`);
    await q.query(`DROP INDEX IF EXISTS idx_crm_contacts_custom_fields_gin;`);
    await q.query(`DROP INDEX IF EXISTS idx_crm_companies_custom_fields_gin;`);

    // Drop custom_fields columns
    await q.query(`ALTER TABLE crm_interactions DROP COLUMN IF EXISTS custom_fields;`);
    await q.query(`ALTER TABLE crm_deals DROP COLUMN IF EXISTS custom_fields;`);
    await q.query(`ALTER TABLE crm_contacts DROP COLUMN IF EXISTS custom_fields;`);
    await q.query(`ALTER TABLE crm_companies DROP COLUMN IF EXISTS custom_fields;`);

    // Drop policies + trigger + table
    await q.query(`DROP TRIGGER IF EXISTS trg_cfd_updated_at ON crm_custom_field_definitions;`);
    await q.query(`DROP POLICY IF EXISTS cfd_select ON crm_custom_field_definitions;`);
    await q.query(`DROP POLICY IF EXISTS cfd_insert ON crm_custom_field_definitions;`);
    await q.query(`DROP POLICY IF EXISTS cfd_update ON crm_custom_field_definitions;`);
    await q.query(`DROP POLICY IF EXISTS cfd_delete ON crm_custom_field_definitions;`);
    await q.query(`DROP TABLE IF EXISTS crm_custom_field_definitions CASCADE;`);
  }
}
