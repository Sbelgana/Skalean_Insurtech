import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class Communications1735000000004 implements MigrationInterface {
  public name = 'Communications1735000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'auth_tenants') THEN
          RAISE EXCEPTION 'Table auth_tenants requise. Executer migration InitialSystem1735000000001.';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'crm_contacts') THEN
          RAISE EXCEPTION 'Table crm_contacts requise. Executer migration CRM1735000000002.';
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      CREATE TYPE comm_channel_enum AS ENUM ('whatsapp', 'email', 'sms', 'voice');
    `);
    await queryRunner.query(`
      CREATE TYPE comm_direction_enum AS ENUM ('inbound', 'outbound');
    `);
    await queryRunner.query(`
      CREATE TYPE comm_status_enum AS ENUM (
        'pending', 'queued', 'sent', 'delivered', 'read', 'failed'
      );
    `);
    await queryRunner.query(`
      CREATE TYPE comm_provider_enum AS ENUM ('meta', 'twilio', 'sendgrid', 'mailgun');
    `);
    await queryRunner.query(`
      CREATE TYPE comm_template_category_enum AS ENUM (
        'marketing', 'transactional', 'reminder'
      );
    `);
    await queryRunner.query(`
      CREATE TYPE comm_language_enum AS ENUM ('fr', 'ar-MA', 'ar');
    `);
    await queryRunner.query(`
      CREATE TYPE comm_meta_template_status_enum AS ENUM (
        'draft', 'pending_review', 'approved', 'rejected'
      );
    `);
    await queryRunner.query(`
      CREATE TYPE comm_webhook_processed_status_enum AS ENUM (
        'pending', 'success', 'duplicate', 'invalid_signature', 'error'
      );
    `);

    // comm_templates created before comm_messages (FK dependency)
    await queryRunner.query(`
      CREATE TABLE comm_templates (
        id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id             UUID         NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
        name                  VARCHAR(255) NOT NULL,
        channel               comm_channel_enum NOT NULL,
        category              comm_template_category_enum NOT NULL,
        language              comm_language_enum NOT NULL,
        subject_template      VARCHAR(998),
        body_template         TEXT         NOT NULL CHECK (char_length(body_template) <= 4096),
        variables_schema      JSONB        NOT NULL DEFAULT '{"type":"object","properties":{},"required":[]}'::jsonb,
        meta_template_name    VARCHAR(512) CHECK (
          meta_template_name IS NULL OR meta_template_name ~ '^[a-z0-9_]{1,512}$'
        ),
        meta_template_status  comm_meta_template_status_enum NOT NULL DEFAULT 'draft',
        active                BOOLEAN      NOT NULL DEFAULT TRUE,
        created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        CONSTRAINT comm_templates_subject_required_when_email CHECK (
          (channel <> 'email') OR (subject_template IS NOT NULL)
        ),
        CONSTRAINT comm_templates_meta_required_when_wa_approved CHECK (
          (channel <> 'whatsapp')
          OR (meta_template_status <> 'approved')
          OR (meta_template_name IS NOT NULL)
        )
      );
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX idx_comm_templates_tenant_name_lang
        ON comm_templates (tenant_id, name, language)
        WHERE active = TRUE;
    `);
    await queryRunner.query(`
      CREATE INDEX idx_comm_templates_tenant_channel
        ON comm_templates (tenant_id, channel, active);
    `);

    await queryRunner.query(`
      CREATE TABLE comm_messages (
        id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id           UUID         NOT NULL REFERENCES auth_tenants(id) ON DELETE RESTRICT,
        contact_id          UUID         REFERENCES crm_contacts(id) ON DELETE SET NULL,
        channel             comm_channel_enum NOT NULL,
        direction           comm_direction_enum NOT NULL,
        to_address          VARCHAR(320) NOT NULL,
        from_address        VARCHAR(320) NOT NULL,
        subject             VARCHAR(998),
        body                TEXT         NOT NULL,
        template_id         UUID         REFERENCES comm_templates(id) ON DELETE SET NULL,
        template_variables  JSONB        NOT NULL DEFAULT '{}'::jsonb,
        status              comm_status_enum NOT NULL DEFAULT 'pending',
        provider            comm_provider_enum NOT NULL,
        provider_message_id VARCHAR(255),
        sent_at             TIMESTAMPTZ,
        delivered_at        TIMESTAMPTZ,
        read_at             TIMESTAMPTZ,
        failed_at           TIMESTAMPTZ,
        fail_reason         TEXT,
        created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        CONSTRAINT comm_messages_subject_only_email CHECK (
          (channel = 'email') OR (subject IS NULL)
        ),
        CONSTRAINT comm_messages_to_address_format CHECK (
          (channel = 'email' AND to_address ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
          OR (channel IN ('whatsapp', 'sms', 'voice') AND to_address ~ '^\+\d{8,15}$')
        ),
        CONSTRAINT comm_messages_failed_requires_reason CHECK (
          (status <> 'failed') OR (fail_reason IS NOT NULL)
        ),
        CONSTRAINT comm_messages_status_timestamp_consistency CHECK (
          (status NOT IN ('sent', 'delivered', 'read') OR sent_at IS NOT NULL)
        )
      );
    `);
    await queryRunner.query(`
      CREATE INDEX idx_comm_messages_tenant_channel_status_sent
        ON comm_messages (tenant_id, channel, status, sent_at DESC NULLS LAST);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_comm_messages_tenant_contact_created
        ON comm_messages (tenant_id, contact_id, created_at DESC)
        WHERE contact_id IS NOT NULL;
    `);
    await queryRunner.query(`
      CREATE INDEX idx_comm_messages_provider_msgid
        ON comm_messages (provider, provider_message_id)
        WHERE provider_message_id IS NOT NULL;
    `);
    await queryRunner.query(`
      CREATE INDEX idx_comm_messages_tenant_template
        ON comm_messages (tenant_id, template_id)
        WHERE template_id IS NOT NULL;
    `);

    await queryRunner.query(`
      CREATE TABLE comm_optouts (
        id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id         UUID         NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
        contact_id        UUID         NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
        channel           comm_channel_enum NOT NULL,
        optout_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        revoked_at        TIMESTAMPTZ,
        reason            TEXT,
        created_by_contact BOOLEAN     NOT NULL,
        created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        CONSTRAINT comm_optouts_admin_requires_reason CHECK (
          created_by_contact = TRUE OR (reason IS NOT NULL AND char_length(reason) > 0)
        )
      );
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX idx_comm_optouts_tenant_contact_channel_active
        ON comm_optouts (tenant_id, contact_id, channel)
        WHERE revoked_at IS NULL;
    `);
    await queryRunner.query(`
      CREATE INDEX idx_comm_optouts_tenant_contact
        ON comm_optouts (tenant_id, contact_id);
    `);

    await queryRunner.query(`
      CREATE TABLE comm_webhooks_received (
        id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id         UUID         REFERENCES auth_tenants(id) ON DELETE SET NULL,
        provider          comm_provider_enum NOT NULL,
        event_type        VARCHAR(100) NOT NULL,
        payload           JSONB        NOT NULL,
        signature_valid   BOOLEAN      NOT NULL,
        processed_at      TIMESTAMPTZ,
        processed_status  comm_webhook_processed_status_enum NOT NULL DEFAULT 'pending',
        idempotency_key   TEXT         NOT NULL,
        created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX idx_comm_webhooks_idempotency_key
        ON comm_webhooks_received (idempotency_key);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_comm_webhooks_provider_event
        ON comm_webhooks_received (provider, event_type, created_at DESC);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_comm_webhooks_processed_status
        ON comm_webhooks_received (processed_status, created_at)
        WHERE processed_status IN ('pending', 'error');
    `);

    // RLS on 3 tables (comm_webhooks_received excluded — tenant_id may be NULL at ingest time)
    await queryRunner.query(`ALTER TABLE comm_messages ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE comm_messages FORCE ROW LEVEL SECURITY;`);
    await queryRunner.query(`
      CREATE POLICY comm_messages_select ON comm_messages
        FOR SELECT USING (app_can_access_tenant(tenant_id));
    `);
    await queryRunner.query(`
      CREATE POLICY comm_messages_insert ON comm_messages
        FOR INSERT WITH CHECK (app_can_access_tenant(tenant_id));
    `);
    await queryRunner.query(`
      CREATE POLICY comm_messages_update ON comm_messages
        FOR UPDATE USING (app_can_access_tenant(tenant_id))
        WITH CHECK (app_can_access_tenant(tenant_id));
    `);
    await queryRunner.query(`
      CREATE POLICY comm_messages_delete ON comm_messages
        FOR DELETE USING (app_can_access_tenant(tenant_id));
    `);

    await queryRunner.query(`ALTER TABLE comm_templates ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE comm_templates FORCE ROW LEVEL SECURITY;`);
    await queryRunner.query(`
      CREATE POLICY comm_templates_select ON comm_templates
        FOR SELECT USING (app_can_access_tenant(tenant_id));
    `);
    await queryRunner.query(`
      CREATE POLICY comm_templates_insert ON comm_templates
        FOR INSERT WITH CHECK (app_can_access_tenant(tenant_id));
    `);
    await queryRunner.query(`
      CREATE POLICY comm_templates_update ON comm_templates
        FOR UPDATE USING (app_can_access_tenant(tenant_id))
        WITH CHECK (app_can_access_tenant(tenant_id));
    `);
    await queryRunner.query(`
      CREATE POLICY comm_templates_delete ON comm_templates
        FOR DELETE USING (app_can_access_tenant(tenant_id));
    `);

    await queryRunner.query(`ALTER TABLE comm_optouts ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE comm_optouts FORCE ROW LEVEL SECURITY;`);
    await queryRunner.query(`
      CREATE POLICY comm_optouts_select ON comm_optouts
        FOR SELECT USING (app_can_access_tenant(tenant_id));
    `);
    await queryRunner.query(`
      CREATE POLICY comm_optouts_insert ON comm_optouts
        FOR INSERT WITH CHECK (app_can_access_tenant(tenant_id));
    `);
    await queryRunner.query(`
      CREATE POLICY comm_optouts_update ON comm_optouts
        FOR UPDATE USING (app_can_access_tenant(tenant_id))
        WITH CHECK (app_can_access_tenant(tenant_id));
    `);
    await queryRunner.query(`
      CREATE POLICY comm_optouts_delete ON comm_optouts
        FOR DELETE USING (app_can_access_tenant(tenant_id));
    `);

    // Triggers updated_at
    await queryRunner.query(`
      CREATE TRIGGER trg_comm_messages_updated_at
        BEFORE UPDATE ON comm_messages
        FOR EACH ROW EXECUTE FUNCTION set_updated_at_column();
    `);
    await queryRunner.query(`
      CREATE TRIGGER trg_comm_templates_updated_at
        BEFORE UPDATE ON comm_templates
        FOR EACH ROW EXECUTE FUNCTION set_updated_at_column();
    `);
    await queryRunner.query(`
      CREATE TRIGGER trg_comm_optouts_updated_at
        BEFORE UPDATE ON comm_optouts
        FOR EACH ROW EXECUTE FUNCTION set_updated_at_column();
    `);

    await queryRunner.query(`
      COMMENT ON TABLE comm_messages IS 'Journal universel messages 4 channels (WA/Email/SMS/Voice). RLS active. Retention 5 ans (decision-019).';
    `);
    await queryRunner.query(`
      COMMENT ON TABLE comm_templates IS 'Templates pre-approuves multilingue fr/ar-MA/ar. Meta WA workflow approval (decision-008).';
    `);
    await queryRunner.query(`
      COMMENT ON TABLE comm_optouts IS 'Opt-out granulaire per-channel. RGPD art.21 + Loi 09-08 art.9. Retention illimitee (decision-019).';
    `);
    await queryRunner.query(`
      COMMENT ON TABLE comm_webhooks_received IS 'Webhooks providers append-only. Idempotency cross-providers. Retention 7 ans audit (decision-021).';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_comm_optouts_updated_at ON comm_optouts;`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_comm_templates_updated_at ON comm_templates;`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_comm_messages_updated_at ON comm_messages;`);

    await queryRunner.query(`DROP TABLE IF EXISTS comm_webhooks_received;`);
    await queryRunner.query(`DROP TABLE IF EXISTS comm_optouts;`);
    await queryRunner.query(`DROP TABLE IF EXISTS comm_messages;`);
    await queryRunner.query(`DROP TABLE IF EXISTS comm_templates;`);

    await queryRunner.query(`DROP TYPE IF EXISTS comm_webhook_processed_status_enum;`);
    await queryRunner.query(`DROP TYPE IF EXISTS comm_meta_template_status_enum;`);
    await queryRunner.query(`DROP TYPE IF EXISTS comm_language_enum;`);
    await queryRunner.query(`DROP TYPE IF EXISTS comm_template_category_enum;`);
    await queryRunner.query(`DROP TYPE IF EXISTS comm_provider_enum;`);
    await queryRunner.query(`DROP TYPE IF EXISTS comm_status_enum;`);
    await queryRunner.query(`DROP TYPE IF EXISTS comm_direction_enum;`);
    await queryRunner.query(`DROP TYPE IF EXISTS comm_channel_enum;`);
  }
}
