import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class DocsPayments1735000000005 implements MigrationInterface {
  public name = 'DocsPayments1735000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'auth_tenants') THEN
          RAISE EXCEPTION 'Table auth_tenants requise. Executer migration InitialSystem1735000000001.';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'auth_users') THEN
          RAISE EXCEPTION 'Table auth_users requise. Executer migration InitialSystem1735000000001.';
        END IF;
      END$$;
    `);

    // Phase 1 : ENUMs
    await queryRunner.query(`
      CREATE TYPE doc_type_enum AS ENUM (
        'police', 'devis', 'facture', 'sinistre', 'kyc', 'contrat', 'autre'
      );
    `);
    await queryRunner.query(`
      CREATE TYPE doc_status_enum AS ENUM (
        'draft', 'final', 'signed', 'archived'
      );
    `);
    await queryRunner.query(`
      CREATE TYPE doc_access_action_enum AS ENUM (
        'view', 'download', 'share'
      );
    `);
    await queryRunner.query(`
      CREATE TYPE pay_provider_enum AS ENUM (
        'cmi', 'youcan', 'payzone',
        'm_wallet_inwi', 'm_wallet_orange', 'm_wallet_iam',
        'cash', 'cheque', 'virement'
      );
    `);
    await queryRunner.query(`
      CREATE TYPE pay_status_enum AS ENUM (
        'initiated', 'pending', 'completed', 'failed',
        'refunded', 'partially_refunded'
      );
    `);
    await queryRunner.query(`
      CREATE TYPE reconciliation_status_enum AS ENUM (
        'matched', 'unmatched', 'discrepancy'
      );
    `);
    await queryRunner.query(`
      CREATE TYPE pay_currency_enum AS ENUM (
        'MAD', 'EUR', 'USD', 'GBP'
      );
    `);

    // Phase 2 : Table doc_documents
    await queryRunner.query(`
      CREATE TABLE doc_documents (
        id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id             UUID         NOT NULL REFERENCES auth_tenants(id) ON DELETE RESTRICT,
        type                  doc_type_enum NOT NULL,
        title                 VARCHAR(255) NOT NULL,
        description           TEXT,
        related_resource_type VARCHAR(64),
        related_resource_id   UUID,
        s3_bucket             VARCHAR(128) NOT NULL,
        s3_key                VARCHAR(512) NOT NULL,
        mime_type             VARCHAR(128) NOT NULL,
        size_bytes            BIGINT       NOT NULL CHECK (size_bytes > 0),
        sha256                CHAR(64)     NOT NULL,
        status                doc_status_enum NOT NULL DEFAULT 'draft',
        retention_until       DATE,
        created_by            UUID         NOT NULL REFERENCES auth_users(id) ON DELETE RESTRICT,
        created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        deleted_at            TIMESTAMPTZ,
        CONSTRAINT chk_sha256_lower CHECK (sha256 ~ '^[0-9a-f]{64}$')
      );
    `);

    // Phase 3 : Table doc_versions (append-only)
    await queryRunner.query(`
      CREATE TABLE doc_versions (
        id             UUID   PRIMARY KEY DEFAULT gen_random_uuid(),
        document_id    UUID   NOT NULL REFERENCES doc_documents(id) ON DELETE CASCADE,
        version_number INT    NOT NULL CHECK (version_number > 0),
        s3_key         VARCHAR(512) NOT NULL,
        size_bytes     BIGINT NOT NULL CHECK (size_bytes > 0),
        sha256         CHAR(64) NOT NULL,
        change_summary TEXT,
        created_by     UUID   NOT NULL REFERENCES auth_users(id) ON DELETE RESTRICT,
        created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_doc_versions_doc_ver UNIQUE (document_id, version_number),
        CONSTRAINT chk_versions_sha256_lower CHECK (sha256 ~ '^[0-9a-f]{64}$')
      );
    `);

    // Phase 4 : Table doc_access_logs (append-only)
    await queryRunner.query(`
      CREATE TABLE doc_access_logs (
        id          UUID   PRIMARY KEY DEFAULT gen_random_uuid(),
        document_id UUID   NOT NULL REFERENCES doc_documents(id) ON DELETE CASCADE,
        user_id     UUID   REFERENCES auth_users(id) ON DELETE SET NULL,
        action      doc_access_action_enum NOT NULL,
        ip_address  INET,
        user_agent  VARCHAR(512),
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Phase 5 : Table pay_methods
    await queryRunner.query(`
      CREATE TABLE pay_methods (
        id                UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id         UUID    NOT NULL REFERENCES auth_tenants(id) ON DELETE RESTRICT,
        name              VARCHAR(128) NOT NULL,
        provider          pay_provider_enum NOT NULL,
        config_encrypted  JSONB   NOT NULL,
        config_key_version INT    NOT NULL DEFAULT 1,
        priority          INT     NOT NULL DEFAULT 100,
        active            BOOLEAN NOT NULL DEFAULT TRUE,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_pay_methods_tenant_name UNIQUE (tenant_id, name)
      );
    `);

    // Phase 6 : Table pay_transactions
    await queryRunner.query(`
      CREATE TABLE pay_transactions (
        id                     UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id              UUID    NOT NULL REFERENCES auth_tenants(id) ON DELETE RESTRICT,
        pay_method_id          UUID    NOT NULL REFERENCES pay_methods(id) ON DELETE RESTRICT,
        related_resource_type  VARCHAR(64),
        related_resource_id    UUID,
        amount_dirham          NUMERIC(15,2) NOT NULL CHECK (amount_dirham >= 0),
        currency               pay_currency_enum NOT NULL DEFAULT 'MAD',
        status                 pay_status_enum NOT NULL DEFAULT 'initiated',
        provider_transaction_id VARCHAR(255),
        provider_response      JSONB,
        customer_name          VARCHAR(255),
        customer_email         VARCHAR(255),
        customer_phone         VARCHAR(32),
        callback_url           VARCHAR(2048),
        success_url            VARCHAR(2048),
        cancel_url             VARCHAR(2048),
        initiated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        completed_at           TIMESTAMPTZ,
        failed_at              TIMESTAMPTZ,
        fail_reason            TEXT,
        created_by             UUID    NOT NULL REFERENCES auth_users(id) ON DELETE RESTRICT,
        created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_pay_tx_tenant_provider_tx UNIQUE (tenant_id, provider_transaction_id),
        CONSTRAINT chk_provider_response_size CHECK (
          provider_response IS NULL OR octet_length(provider_response::text) < 32768
        )
      );
    `);

    // Phase 7 : Table pay_reconciliation
    await queryRunner.query(`
      CREATE TABLE pay_reconciliation (
        id                  UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id           UUID    NOT NULL REFERENCES auth_tenants(id) ON DELETE RESTRICT,
        transaction_id      UUID    NOT NULL REFERENCES pay_transactions(id) ON DELETE RESTRICT,
        bank_statement_ref  VARCHAR(128),
        reconciled_at       TIMESTAMPTZ,
        reconciled_by       UUID    REFERENCES auth_users(id) ON DELETE SET NULL,
        status              reconciliation_status_enum NOT NULL DEFAULT 'unmatched',
        discrepancy_amount  NUMERIC(15,2) DEFAULT 0,
        notes               TEXT,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Phase 8 : Indexes
    await queryRunner.query(`
      CREATE INDEX idx_doc_documents_tenant_type_created
        ON doc_documents (tenant_id, type, created_at DESC);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_doc_documents_polymorphic
        ON doc_documents (tenant_id, related_resource_type, related_resource_id);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_doc_documents_sha256
        ON doc_documents (sha256);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_doc_documents_retention
        ON doc_documents (retention_until)
        WHERE retention_until IS NOT NULL;
    `);
    await queryRunner.query(`
      CREATE INDEX idx_doc_versions_document
        ON doc_versions (document_id, version_number DESC);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_doc_access_logs_document_created
        ON doc_access_logs (document_id, created_at DESC);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_pay_methods_tenant_priority
        ON pay_methods (tenant_id, priority ASC)
        WHERE active = TRUE;
    `);
    await queryRunner.query(`
      CREATE INDEX idx_pay_transactions_tenant_status_initiated
        ON pay_transactions (tenant_id, status, initiated_at DESC);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_pay_transactions_polymorphic
        ON pay_transactions (tenant_id, related_resource_type, related_resource_id);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_pay_reconciliation_tx
        ON pay_reconciliation (transaction_id);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_pay_reconciliation_tenant_status
        ON pay_reconciliation (tenant_id, status);
    `);

    // Phase 9 : Trigger retention_until calc
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION doc_documents_retention_calc()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.status = 'signed' THEN
          NEW.retention_until := (NEW.created_at + INTERVAL '10 years 1 day')::date;
        ELSIF NEW.status IN ('final', 'archived') THEN
          NEW.retention_until := (NEW.created_at + INTERVAL '7 years')::date;
        ELSE
          NEW.retention_until := NULL;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql STABLE;
    `);
    await queryRunner.query(`
      CREATE TRIGGER doc_documents_retention_calc_trg
        BEFORE INSERT OR UPDATE OF status ON doc_documents
        FOR EACH ROW EXECUTE FUNCTION doc_documents_retention_calc();
    `);

    // Phase 10 : Triggers append-only
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION enforce_append_only()
      RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'Table % is append-only. UPDATE and DELETE are forbidden.', TG_TABLE_NAME;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await queryRunner.query(`
      CREATE TRIGGER doc_versions_append_only_trg
        BEFORE UPDATE OR DELETE ON doc_versions
        FOR EACH ROW EXECUTE FUNCTION enforce_append_only();
    `);
    await queryRunner.query(`
      CREATE TRIGGER doc_access_logs_append_only_trg
        BEFORE UPDATE OR DELETE ON doc_access_logs
        FOR EACH ROW EXECUTE FUNCTION enforce_append_only();
    `);

    // Phase 11 : Trigger blocage suppression si retention active
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION doc_documents_block_delete_if_retained()
      RETURNS TRIGGER AS $$
      BEGIN
        IF OLD.retention_until IS NOT NULL AND OLD.retention_until > CURRENT_DATE THEN
          RAISE EXCEPTION 'Document % is under legal retention until %.', OLD.id, OLD.retention_until;
        END IF;
        RETURN OLD;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await queryRunner.query(`
      CREATE TRIGGER doc_documents_block_delete_trg
        BEFORE DELETE ON doc_documents
        FOR EACH ROW EXECUTE FUNCTION doc_documents_block_delete_if_retained();
    `);

    // updated_at triggers
    await queryRunner.query(`
      CREATE TRIGGER trg_doc_documents_updated_at
        BEFORE UPDATE ON doc_documents
        FOR EACH ROW EXECUTE FUNCTION set_updated_at_column();
    `);
    await queryRunner.query(`
      CREATE TRIGGER trg_pay_methods_updated_at
        BEFORE UPDATE ON pay_methods
        FOR EACH ROW EXECUTE FUNCTION set_updated_at_column();
    `);
    await queryRunner.query(`
      CREATE TRIGGER trg_pay_transactions_updated_at
        BEFORE UPDATE ON pay_transactions
        FOR EACH ROW EXECUTE FUNCTION set_updated_at_column();
    `);

    // Phase 12 : RLS sur les 6 tables
    const tablesWithTenantId = [
      'doc_documents', 'pay_methods', 'pay_transactions', 'pay_reconciliation',
    ];
    for (const t of tablesWithTenantId) {
      await queryRunner.query(`ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY;`);
      await queryRunner.query(`ALTER TABLE ${t} FORCE ROW LEVEL SECURITY;`);
    }
    for (const t of ['doc_versions', 'doc_access_logs']) {
      await queryRunner.query(`ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY;`);
      await queryRunner.query(`ALTER TABLE ${t} FORCE ROW LEVEL SECURITY;`);
    }

    // Phase 13 : Policies RLS tables avec tenant_id direct
    for (const t of tablesWithTenantId) {
      await queryRunner.query(`
        CREATE POLICY ${t}_select ON ${t}
          FOR SELECT USING (app_can_access_tenant(tenant_id));
      `);
      await queryRunner.query(`
        CREATE POLICY ${t}_insert ON ${t}
          FOR INSERT WITH CHECK (app_can_access_tenant(tenant_id));
      `);
      await queryRunner.query(`
        CREATE POLICY ${t}_update ON ${t}
          FOR UPDATE USING (app_can_access_tenant(tenant_id))
          WITH CHECK (app_can_access_tenant(tenant_id));
      `);
      await queryRunner.query(`
        CREATE POLICY ${t}_delete ON ${t}
          FOR DELETE USING (app_can_access_tenant(tenant_id));
      `);
    }

    // Policies RLS pour doc_versions et doc_access_logs (tenant_id via doc_documents)
    for (const t of ['doc_versions', 'doc_access_logs']) {
      await queryRunner.query(`
        CREATE POLICY ${t}_select ON ${t}
          FOR SELECT USING (
            EXISTS (
              SELECT 1 FROM doc_documents d
              WHERE d.id = ${t}.document_id
                AND app_can_access_tenant(d.tenant_id)
            )
          );
      `);
      await queryRunner.query(`
        CREATE POLICY ${t}_insert ON ${t}
          FOR INSERT WITH CHECK (
            EXISTS (
              SELECT 1 FROM doc_documents d
              WHERE d.id = ${t}.document_id
                AND app_can_access_tenant(d.tenant_id)
            )
          );
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_pay_transactions_updated_at ON pay_transactions;`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_pay_methods_updated_at ON pay_methods;`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_doc_documents_updated_at ON doc_documents;`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS doc_documents_block_delete_trg ON doc_documents;`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS doc_access_logs_append_only_trg ON doc_access_logs;`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS doc_versions_append_only_trg ON doc_versions;`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS doc_documents_retention_calc_trg ON doc_documents;`);

    await queryRunner.query(`DROP TABLE IF EXISTS pay_reconciliation CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS pay_transactions CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS pay_methods CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS doc_access_logs CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS doc_versions CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS doc_documents CASCADE;`);

    await queryRunner.query(`DROP FUNCTION IF EXISTS doc_documents_block_delete_if_retained CASCADE;`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS enforce_append_only CASCADE;`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS doc_documents_retention_calc CASCADE;`);

    await queryRunner.query(`DROP TYPE IF EXISTS pay_currency_enum;`);
    await queryRunner.query(`DROP TYPE IF EXISTS reconciliation_status_enum;`);
    await queryRunner.query(`DROP TYPE IF EXISTS pay_status_enum;`);
    await queryRunner.query(`DROP TYPE IF EXISTS pay_provider_enum;`);
    await queryRunner.query(`DROP TYPE IF EXISTS doc_access_action_enum;`);
    await queryRunner.query(`DROP TYPE IF EXISTS doc_status_enum;`);
    await queryRunner.query(`DROP TYPE IF EXISTS doc_type_enum;`);
  }
}
