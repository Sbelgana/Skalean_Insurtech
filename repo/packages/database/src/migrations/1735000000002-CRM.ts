import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class CRM1735000000002 implements MigrationInterface {
  public name = 'CRM1735000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
          RAISE EXCEPTION 'Extension pg_trgm requise. Executer migration 1734000000000-EnableExtensions.';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'citext') THEN
          RAISE EXCEPTION 'Extension citext requise. Executer migration 1734000000000-EnableExtensions.';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'auth_users') THEN
          RAISE EXCEPTION 'Table auth_users requise. Executer migration InitialSystem1735000000001.';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'auth_tenants') THEN
          RAISE EXCEPTION 'Table auth_tenants requise. Executer migration InitialSystem1735000000001.';
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      CREATE TYPE crm_preferred_language AS ENUM ('fr', 'ar-MA', 'ar');
      CREATE TYPE crm_preferred_channel  AS ENUM ('whatsapp', 'email', 'sms', 'voice');
      CREATE TYPE crm_deal_stage         AS ENUM ('lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost');
      CREATE TYPE crm_interaction_type   AS ENUM ('call', 'email', 'whatsapp', 'meeting', 'note');
      CREATE TYPE crm_interaction_direction AS ENUM ('inbound', 'outbound');
    `);

    await queryRunner.query(`
      CREATE TABLE crm_companies (
        id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id     uuid          NOT NULL REFERENCES auth_tenants(id) ON DELETE RESTRICT,
        name          text          NOT NULL,
        industry      text,
        ice           text,
        rc            text,
        patente       text,
        address       text,
        city          text,
        country       text          NOT NULL DEFAULT 'MA',
        phone         text,
        email         citext,
        website       text,
        owner_user_id uuid          REFERENCES auth_users(id) ON DELETE RESTRICT,
        tags          text[]        NOT NULL DEFAULT '{}',
        notes         text,
        created_at    timestamptz   NOT NULL DEFAULT now(),
        updated_at    timestamptz   NOT NULL DEFAULT now(),
        created_by    uuid          REFERENCES auth_users(id) ON DELETE RESTRICT,
        updated_by    uuid          REFERENCES auth_users(id) ON DELETE RESTRICT,
        deleted_at    timestamptz,
        CONSTRAINT crm_companies_ice_format CHECK (ice IS NULL OR ice ~ '^[0-9]{15}$'),
        CONSTRAINT crm_companies_phone_format CHECK (phone IS NULL OR phone ~ '^\\+212[567]\\d{8}$'),
        CONSTRAINT crm_companies_country_iso CHECK (country ~ '^[A-Z]{2}$'),
        CONSTRAINT crm_companies_name_not_empty CHECK (length(name) > 0)
      );
    `);

    await queryRunner.query(`
      CREATE TABLE crm_contacts (
        id                  uuid                      PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id           uuid                      NOT NULL REFERENCES auth_tenants(id) ON DELETE RESTRICT,
        company_id          uuid                      REFERENCES crm_companies(id) ON DELETE RESTRICT,
        first_name          text                      NOT NULL,
        last_name           text                      NOT NULL,
        full_name           text                      GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED,
        email               citext,
        phone               text,
        cin                 text,
        preferred_language  crm_preferred_language    NOT NULL DEFAULT 'fr',
        preferred_channel   crm_preferred_channel     NOT NULL DEFAULT 'email',
        tags                text[]                    NOT NULL DEFAULT '{}',
        notes               text,
        created_at          timestamptz               NOT NULL DEFAULT now(),
        updated_at          timestamptz               NOT NULL DEFAULT now(),
        created_by          uuid                      REFERENCES auth_users(id) ON DELETE RESTRICT,
        updated_by          uuid                      REFERENCES auth_users(id) ON DELETE RESTRICT,
        deleted_at          timestamptz,
        CONSTRAINT crm_contacts_cin_format CHECK (cin IS NULL OR cin ~ '^[A-Z]{1,2}[0-9]{6,8}$'),
        CONSTRAINT crm_contacts_phone_format CHECK (phone IS NULL OR phone ~ '^\\+212[567]\\d{8}$'),
        CONSTRAINT crm_contacts_first_name_not_empty CHECK (char_length(first_name) > 0),
        CONSTRAINT crm_contacts_last_name_not_empty CHECK (char_length(last_name) > 0)
      );
    `);

    await queryRunner.query(`
      CREATE TABLE crm_deals (
        id                   uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id            uuid             NOT NULL REFERENCES auth_tenants(id) ON DELETE RESTRICT,
        contact_id           uuid             NOT NULL REFERENCES crm_contacts(id) ON DELETE RESTRICT,
        company_id           uuid             REFERENCES crm_companies(id) ON DELETE RESTRICT,
        title                text             NOT NULL,
        stage                crm_deal_stage   NOT NULL DEFAULT 'lead',
        amount_dirham        numeric(15, 2)   NOT NULL DEFAULT 0,
        currency             char(3)          NOT NULL DEFAULT 'MAD',
        expected_close_date  date,
        won_at               timestamptz,
        lost_at              timestamptz,
        lost_reason          text,
        owner_user_id        uuid             NOT NULL REFERENCES auth_users(id) ON DELETE RESTRICT,
        notes                text,
        created_at           timestamptz      NOT NULL DEFAULT now(),
        updated_at           timestamptz      NOT NULL DEFAULT now(),
        created_by           uuid             REFERENCES auth_users(id) ON DELETE RESTRICT,
        updated_by           uuid             REFERENCES auth_users(id) ON DELETE RESTRICT,
        deleted_at           timestamptz,
        CONSTRAINT crm_deals_amount_positive CHECK (amount_dirham >= 0),
        CONSTRAINT crm_deals_currency_iso CHECK (currency ~ '^[A-Z]{3}$'),
        CONSTRAINT crm_deals_title_not_empty CHECK (length(title) > 0),
        CONSTRAINT crm_deals_won_consistency CHECK ((stage = 'won' AND won_at IS NOT NULL) OR stage <> 'won'),
        CONSTRAINT crm_deals_lost_consistency CHECK ((stage = 'lost' AND lost_at IS NOT NULL) OR stage <> 'lost')
      );
    `);

    await queryRunner.query(`
      CREATE TABLE crm_interactions (
        id           uuid                        PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id    uuid                        NOT NULL REFERENCES auth_tenants(id) ON DELETE RESTRICT,
        contact_id   uuid                        NOT NULL REFERENCES crm_contacts(id) ON DELETE RESTRICT,
        deal_id      uuid                        REFERENCES crm_deals(id) ON DELETE RESTRICT,
        type         crm_interaction_type        NOT NULL,
        direction    crm_interaction_direction   NOT NULL,
        subject      text                        NOT NULL,
        content      text,
        occurred_at  timestamptz                 NOT NULL DEFAULT now(),
        created_by   uuid                        NOT NULL REFERENCES auth_users(id) ON DELETE RESTRICT,
        created_at   timestamptz                 NOT NULL DEFAULT now(),
        CONSTRAINT crm_interactions_subject_not_empty CHECK (char_length(subject) > 0),
        CONSTRAINT crm_interactions_content_max_size  CHECK (content IS NULL OR char_length(content) < 50000)
      );
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION crm_interactions_block_modification()
      RETURNS trigger AS $$
      BEGIN
        IF current_setting('app.archivist_bypass', true) = 'true' THEN
          RETURN COALESCE(NEW, OLD);
        END IF;
        RAISE EXCEPTION 'crm_interactions est append-only. UPDATE et DELETE interdits (decision-008 audit CNDP).';
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER crm_interactions_no_update
        BEFORE UPDATE ON crm_interactions
        FOR EACH ROW EXECUTE FUNCTION crm_interactions_block_modification();

      CREATE TRIGGER crm_interactions_no_delete
        BEFORE DELETE ON crm_interactions
        FOR EACH ROW EXECUTE FUNCTION crm_interactions_block_modification();
    `);

    for (const tbl of ['crm_companies', 'crm_contacts', 'crm_deals']) {
      await queryRunner.query(`
        CREATE TRIGGER trg_${tbl}_updated_at
          BEFORE UPDATE ON ${tbl}
          FOR EACH ROW EXECUTE FUNCTION set_updated_at_column();
      `);
    }

    await queryRunner.query(`
      CREATE INDEX idx_crm_companies_tenant  ON crm_companies (tenant_id) WHERE deleted_at IS NULL;
      CREATE INDEX idx_crm_companies_owner   ON crm_companies (tenant_id, owner_user_id) WHERE deleted_at IS NULL;
      CREATE INDEX idx_crm_companies_created ON crm_companies (tenant_id, created_at DESC) WHERE deleted_at IS NULL;
      CREATE UNIQUE INDEX uq_crm_companies_tenant_ice ON crm_companies (tenant_id, ice)
        WHERE ice IS NOT NULL AND deleted_at IS NULL;

      CREATE INDEX idx_crm_contacts_tenant  ON crm_contacts (tenant_id) WHERE deleted_at IS NULL;
      CREATE INDEX idx_crm_contacts_company ON crm_contacts (tenant_id, company_id) WHERE deleted_at IS NULL;
      CREATE INDEX idx_crm_contacts_email   ON crm_contacts (tenant_id, email) WHERE deleted_at IS NULL;
      CREATE UNIQUE INDEX uq_crm_contacts_tenant_cin ON crm_contacts (tenant_id, cin)
        WHERE cin IS NOT NULL AND deleted_at IS NULL;
      CREATE UNIQUE INDEX uq_crm_contacts_tenant_email ON crm_contacts (tenant_id, email)
        WHERE email IS NOT NULL AND deleted_at IS NULL;

      CREATE INDEX idx_crm_deals_tenant_stage ON crm_deals (tenant_id, stage) WHERE deleted_at IS NULL;
      CREATE INDEX idx_crm_deals_owner        ON crm_deals (tenant_id, owner_user_id) WHERE deleted_at IS NULL;
      CREATE INDEX idx_crm_deals_contact      ON crm_deals (tenant_id, contact_id) WHERE deleted_at IS NULL;
      CREATE INDEX idx_crm_deals_close_date   ON crm_deals (tenant_id, expected_close_date)
        WHERE deleted_at IS NULL AND stage NOT IN ('won', 'lost');

      CREATE INDEX idx_crm_interactions_tenant_contact ON crm_interactions (tenant_id, contact_id, occurred_at DESC);
      CREATE INDEX idx_crm_interactions_tenant_deal    ON crm_interactions (tenant_id, deal_id, occurred_at DESC)
        WHERE deal_id IS NOT NULL;
      CREATE INDEX idx_crm_interactions_tenant_type    ON crm_interactions (tenant_id, type, occurred_at DESC);
    `);

    await queryRunner.query(`
      CREATE INDEX idx_crm_companies_name_trgm  ON crm_companies  USING GIN (name gin_trgm_ops)
        WHERE deleted_at IS NULL;
      CREATE INDEX idx_crm_companies_email_trgm ON crm_companies  USING GIN ((email::text) gin_trgm_ops)
        WHERE deleted_at IS NULL AND email IS NOT NULL;

      CREATE INDEX idx_crm_contacts_full_name_trgm ON crm_contacts USING GIN (full_name gin_trgm_ops)
        WHERE deleted_at IS NULL;
      CREATE INDEX idx_crm_contacts_email_trgm     ON crm_contacts USING GIN ((email::text) gin_trgm_ops)
        WHERE deleted_at IS NULL AND email IS NOT NULL;
      CREATE INDEX idx_crm_contacts_phone_trgm     ON crm_contacts USING GIN (phone gin_trgm_ops)
        WHERE deleted_at IS NULL AND phone IS NOT NULL;

      CREATE INDEX idx_crm_deals_title_trgm ON crm_deals USING GIN (title gin_trgm_ops)
        WHERE deleted_at IS NULL;

      CREATE INDEX idx_crm_interactions_subject_trgm ON crm_interactions USING GIN (subject gin_trgm_ops);
      CREATE INDEX idx_crm_interactions_content_trgm ON crm_interactions
        USING GIN (substring(content, 1, 5000) gin_trgm_ops)
        WHERE content IS NOT NULL;
    `);

    await queryRunner.query(`ALTER TABLE crm_companies   ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE crm_companies   FORCE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE crm_contacts    ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE crm_contacts    FORCE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE crm_deals       ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE crm_deals       FORCE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE crm_interactions ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE crm_interactions FORCE ROW LEVEL SECURITY;`);

    await queryRunner.query(`
      CREATE POLICY crm_companies_select ON crm_companies
        FOR SELECT USING (app_can_access_tenant(tenant_id));
      CREATE POLICY crm_companies_insert ON crm_companies
        FOR INSERT WITH CHECK (app_can_access_tenant(tenant_id));
      CREATE POLICY crm_companies_update ON crm_companies
        FOR UPDATE USING (app_can_access_tenant(tenant_id))
        WITH CHECK (app_can_access_tenant(tenant_id));
      CREATE POLICY crm_companies_delete ON crm_companies
        FOR DELETE USING (app_can_access_tenant(tenant_id));

      CREATE POLICY crm_contacts_select ON crm_contacts
        FOR SELECT USING (app_can_access_tenant(tenant_id));
      CREATE POLICY crm_contacts_insert ON crm_contacts
        FOR INSERT WITH CHECK (app_can_access_tenant(tenant_id));
      CREATE POLICY crm_contacts_update ON crm_contacts
        FOR UPDATE USING (app_can_access_tenant(tenant_id))
        WITH CHECK (app_can_access_tenant(tenant_id));
      CREATE POLICY crm_contacts_delete ON crm_contacts
        FOR DELETE USING (app_can_access_tenant(tenant_id));

      CREATE POLICY crm_deals_select ON crm_deals
        FOR SELECT USING (app_can_access_tenant(tenant_id));
      CREATE POLICY crm_deals_insert ON crm_deals
        FOR INSERT WITH CHECK (app_can_access_tenant(tenant_id));
      CREATE POLICY crm_deals_update ON crm_deals
        FOR UPDATE USING (app_can_access_tenant(tenant_id))
        WITH CHECK (app_can_access_tenant(tenant_id));
      CREATE POLICY crm_deals_delete ON crm_deals
        FOR DELETE USING (app_can_access_tenant(tenant_id));

      CREATE POLICY crm_interactions_select ON crm_interactions
        FOR SELECT USING (app_can_access_tenant(tenant_id));
      CREATE POLICY crm_interactions_insert ON crm_interactions
        FOR INSERT WITH CHECK (app_can_access_tenant(tenant_id));
      CREATE POLICY crm_interactions_update ON crm_interactions
        FOR UPDATE USING (app_can_access_tenant(tenant_id));
      CREATE POLICY crm_interactions_delete ON crm_interactions
        FOR DELETE USING (app_can_access_tenant(tenant_id));
    `);

    await queryRunner.query(`COMMENT ON TABLE crm_companies IS 'CRM entreprises -- ICE 15 chiffres conformite DGI Maroc -- RLS FORCE multi-tenant';`);
    await queryRunner.query(`COMMENT ON TABLE crm_contacts IS 'CRM contacts personnes physiques -- CIN regex Maroc -- full_name GENERATED STORED -- RLS FORCE';`);
    await queryRunner.query(`COMMENT ON TABLE crm_deals IS 'CRM opportunites commerciales -- montant MAD dirhams -- pipeline 6 stages -- RLS FORCE';`);
    await queryRunner.query(`COMMENT ON TABLE crm_interactions IS 'CRM journal append-only -- audit CNDP Loi 09-08 -- conservation 5 ans minimum -- trigger block UPDATE/DELETE';`);
    await queryRunner.query(`COMMENT ON COLUMN crm_companies.ice IS 'Identifiant Commun Entreprise Maroc -- 15 chiffres -- Article 23 CGI';`);
    await queryRunner.query(`COMMENT ON COLUMN crm_contacts.cin IS 'Carte Identite Nationale Maroc -- format [A-Z]{1,2}[0-9]{6,8}';`);
    await queryRunner.query(`COMMENT ON COLUMN crm_contacts.full_name IS 'GENERATED ALWAYS AS (first_name || space || last_name) STORED -- pour index GIN trigram';`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS crm_interactions_no_update  ON crm_interactions;`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS crm_interactions_no_delete  ON crm_interactions;`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_crm_companies_updated_at ON crm_companies;`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_crm_contacts_updated_at  ON crm_contacts;`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_crm_deals_updated_at     ON crm_deals;`);

    await queryRunner.query(`DROP FUNCTION IF EXISTS crm_interactions_block_modification();`);

    await queryRunner.query(`DROP TABLE IF EXISTS crm_interactions CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS crm_deals        CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS crm_contacts     CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS crm_companies    CASCADE;`);

    await queryRunner.query(`DROP TYPE IF EXISTS crm_interaction_direction;`);
    await queryRunner.query(`DROP TYPE IF EXISTS crm_interaction_type;`);
    await queryRunner.query(`DROP TYPE IF EXISTS crm_deal_stage;`);
    await queryRunner.query(`DROP TYPE IF EXISTS crm_preferred_channel;`);
    await queryRunner.query(`DROP TYPE IF EXISTS crm_preferred_language;`);
  }
}
