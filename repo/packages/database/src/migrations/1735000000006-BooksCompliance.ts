import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class BooksCompliance1735000000006 implements MigrationInterface {
  public name = 'BooksCompliance1735000000006';

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
        IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'doc_documents') THEN
          RAISE EXCEPTION 'Table doc_documents requise. Executer migration DocsPayments1735000000005.';
        END IF;
      END$$;
    `);

    // ENUMs Books
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE books_invoice_type AS ENUM ('invoice', 'credit_note', 'proforma');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE books_invoice_status AS ENUM ('draft', 'issued', 'paid', 'overdue', 'cancelled');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE books_account_type AS ENUM ('asset', 'liability', 'equity', 'revenue', 'expense');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    // ENUMs Compliance
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE compliance_acaps_report_type AS ENUM (
          'monthly_production', 'quarterly_sinistralite', 'annual_solvency'
        );
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE compliance_acaps_report_status AS ENUM (
          'draft', 'submitted', 'accepted', 'rejected'
        );
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE compliance_consent_type AS ENUM (
          'cnic_processing', 'data_marketing', 'data_third_party'
        );
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE compliance_consent_method AS ENUM (
          'web_form', 'whatsapp_optin', 'paper_signed'
        );
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    // Table books_invoices
    await queryRunner.query(`
      CREATE TABLE books_invoices (
        id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id        UUID         NOT NULL REFERENCES auth_tenants(id) ON DELETE RESTRICT,
        invoice_number   TEXT         NOT NULL,
        type             books_invoice_type NOT NULL DEFAULT 'invoice',
        customer_name    TEXT         NOT NULL,
        customer_ice     VARCHAR(15)  NOT NULL,
        customer_address TEXT         NOT NULL,
        issue_date       DATE         NOT NULL DEFAULT CURRENT_DATE,
        due_date         DATE         NOT NULL,
        currency         CHAR(3)      NOT NULL DEFAULT 'MAD',
        subtotal_ht      NUMERIC(15,2) NOT NULL CHECK (subtotal_ht >= 0),
        tva_amount       NUMERIC(15,2) NOT NULL CHECK (tva_amount >= 0),
        total_ttc        NUMERIC(15,2) NOT NULL CHECK (total_ttc >= 0),
        tva_rate         NUMERIC(5,2)  NOT NULL DEFAULT 20.00
                         CHECK (tva_rate IN (0, 7, 10, 14, 20)),
        status           books_invoice_status NOT NULL DEFAULT 'draft',
        pdf_document_id  UUID         REFERENCES doc_documents(id) ON DELETE SET NULL,
        created_by       UUID         NOT NULL REFERENCES auth_users(id) ON DELETE RESTRICT,
        created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        CONSTRAINT books_invoices_invoice_number_format CHECK (invoice_number ~ '^[0-9]{4}-[0-9]{5}$'),
        CONSTRAINT books_invoices_due_after_issue CHECK (due_date >= issue_date),
        CONSTRAINT books_invoices_ice_format CHECK (customer_ice ~ '^[0-9]{15}$'),
        CONSTRAINT books_invoices_tenant_number_unique UNIQUE (tenant_id, invoice_number)
      );
    `);
    await queryRunner.query(`
      CREATE INDEX idx_books_invoices_tenant_status
        ON books_invoices (tenant_id, status);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_books_invoices_tenant_issue_date
        ON books_invoices (tenant_id, issue_date DESC);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_books_invoices_due_date
        ON books_invoices (due_date)
        WHERE status = 'issued';
    `);

    // Table books_invoice_lines
    await queryRunner.query(`
      CREATE TABLE books_invoice_lines (
        id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        invoice_id     UUID         NOT NULL REFERENCES books_invoices(id) ON DELETE CASCADE,
        description    TEXT         NOT NULL,
        quantity       NUMERIC(15,4) NOT NULL CHECK (quantity > 0),
        unit_price_ht  NUMERIC(15,2) NOT NULL CHECK (unit_price_ht >= 0),
        total_ht       NUMERIC(15,2) NOT NULL CHECK (total_ht >= 0),
        tva_rate       NUMERIC(5,2)  NOT NULL DEFAULT 20.00
                       CHECK (tva_rate IN (0, 7, 10, 14, 20)),
        sort_order     INTEGER      NOT NULL DEFAULT 0
      );
    `);
    await queryRunner.query(`
      CREATE INDEX idx_books_invoice_lines_invoice
        ON books_invoice_lines (invoice_id, sort_order);
    `);

    // Table books_accounts
    await queryRunner.query(`
      CREATE TABLE books_accounts (
        id               UUID   PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id        UUID   NOT NULL REFERENCES auth_tenants(id) ON DELETE RESTRICT,
        account_number   TEXT   NOT NULL CHECK (account_number ~ '^[1-7][0-9]{2,5}$'),
        name             TEXT   NOT NULL,
        type             books_account_type NOT NULL,
        parent_account_id UUID  REFERENCES books_accounts(id) ON DELETE RESTRICT,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT books_accounts_tenant_number_unique UNIQUE (tenant_id, account_number)
      );
    `);
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION check_account_no_cycle()
      RETURNS TRIGGER AS $$
      DECLARE
        cursor_id UUID;
        depth     INTEGER := 0;
      BEGIN
        IF NEW.parent_account_id IS NULL THEN
          RETURN NEW;
        END IF;
        cursor_id := NEW.parent_account_id;
        WHILE cursor_id IS NOT NULL LOOP
          IF cursor_id = NEW.id THEN
            RAISE EXCEPTION 'Cycle detected in account hierarchy for account %', NEW.id;
          END IF;
          depth := depth + 1;
          IF depth > 4 THEN
            RAISE EXCEPTION 'Account hierarchy depth exceeds CGNC maximum of 4 levels';
          END IF;
          SELECT parent_account_id INTO cursor_id FROM books_accounts WHERE id = cursor_id;
        END LOOP;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await queryRunner.query(`
      CREATE TRIGGER trg_books_accounts_no_cycle
        BEFORE INSERT OR UPDATE ON books_accounts
        FOR EACH ROW EXECUTE FUNCTION check_account_no_cycle();
    `);
    await queryRunner.query(`
      CREATE INDEX idx_books_accounts_tenant_number
        ON books_accounts (tenant_id, account_number);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_books_accounts_parent
        ON books_accounts (parent_account_id)
        WHERE parent_account_id IS NOT NULL;
    `);

    // Table compliance_acaps_reports
    await queryRunner.query(`
      CREATE TABLE compliance_acaps_reports (
        id                UUID   PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id         UUID   NOT NULL REFERENCES auth_tenants(id) ON DELETE RESTRICT,
        period_start      DATE   NOT NULL,
        period_end        DATE   NOT NULL,
        report_type       compliance_acaps_report_type NOT NULL,
        status            compliance_acaps_report_status NOT NULL DEFAULT 'draft',
        submitted_at      TIMESTAMPTZ,
        acaps_reference   TEXT,
        file_document_id  UUID   REFERENCES doc_documents(id) ON DELETE SET NULL,
        created_by        UUID   NOT NULL REFERENCES auth_users(id) ON DELETE RESTRICT,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT compliance_acaps_period_valid CHECK (period_end >= period_start),
        CONSTRAINT compliance_acaps_reference_format CHECK (
          acaps_reference IS NULL
          OR acaps_reference ~ '^ACAPS-[0-9]{4}-[0-9]{6}-(MP|QS|AS)$'
        ),
        CONSTRAINT compliance_acaps_submitted_consistency CHECK (
          (status = 'draft' AND submitted_at IS NULL)
          OR (status IN ('submitted', 'accepted', 'rejected') AND submitted_at IS NOT NULL)
        )
      );
    `);
    await queryRunner.query(`
      CREATE INDEX idx_compliance_acaps_tenant_status
        ON compliance_acaps_reports (tenant_id, status);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_compliance_acaps_period
        ON compliance_acaps_reports (tenant_id, period_start, period_end);
    `);

    // Table compliance_data_retention_policies
    await queryRunner.query(`
      CREATE TABLE compliance_data_retention_policies (
        id              UUID   PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id       UUID   NOT NULL REFERENCES auth_tenants(id) ON DELETE RESTRICT,
        resource_type   TEXT   NOT NULL,
        retention_days  INTEGER NOT NULL CHECK (retention_days > 0),
        legal_basis     TEXT   NOT NULL,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT compliance_retention_tenant_resource_unique UNIQUE (tenant_id, resource_type)
      );
    `);
    await queryRunner.query(`
      CREATE INDEX idx_compliance_retention_tenant
        ON compliance_data_retention_policies (tenant_id);
    `);

    // Table compliance_consent_logs (append-only)
    await queryRunner.query(`
      CREATE TABLE compliance_consent_logs (
        id                   UUID   PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id            UUID   NOT NULL REFERENCES auth_tenants(id) ON DELETE RESTRICT,
        contact_id           UUID   NOT NULL REFERENCES crm_contacts(id) ON DELETE RESTRICT,
        consent_type         compliance_consent_type NOT NULL,
        consent_given        BOOLEAN NOT NULL,
        consent_method       compliance_consent_method NOT NULL,
        evidence_document_id UUID   REFERENCES doc_documents(id) ON DELETE SET NULL,
        expires_at           TIMESTAMPTZ,
        withdrawn_at         TIMESTAMPTZ,
        created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT compliance_consent_withdrawn_after_creation CHECK (
          withdrawn_at IS NULL OR withdrawn_at >= created_at
        ),
        CONSTRAINT compliance_consent_expires_after_creation CHECK (
          expires_at IS NULL OR expires_at >= created_at
        )
      );
    `);
    await queryRunner.query(`
      CREATE INDEX idx_compliance_consent_contact_type
        ON compliance_consent_logs (contact_id, consent_type, consent_given);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_compliance_consent_tenant_created
        ON compliance_consent_logs (tenant_id, created_at DESC);
    `);

    // RLS on all 6 tables
    const allTables = [
      'books_invoices', 'books_invoice_lines', 'books_accounts',
      'compliance_acaps_reports', 'compliance_data_retention_policies', 'compliance_consent_logs',
    ];
    for (const t of allTables) {
      await queryRunner.query(`ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY;`);
      await queryRunner.query(`ALTER TABLE ${t} FORCE ROW LEVEL SECURITY;`);
    }

    // books_invoices policies
    await queryRunner.query(`
      CREATE POLICY books_invoices_select ON books_invoices
        FOR SELECT USING (app_can_access_tenant(tenant_id));
    `);
    await queryRunner.query(`
      CREATE POLICY books_invoices_insert ON books_invoices
        FOR INSERT WITH CHECK (app_can_access_tenant(tenant_id));
    `);
    await queryRunner.query(`
      CREATE POLICY books_invoices_update ON books_invoices
        FOR UPDATE USING (app_can_access_tenant(tenant_id))
        WITH CHECK (app_can_access_tenant(tenant_id));
    `);
    // CGNC: aucune suppression de facture emise
    await queryRunner.query(`
      CREATE POLICY books_invoices_delete ON books_invoices
        FOR DELETE USING (false);
    `);

    // books_invoice_lines policies (tenant_id via books_invoices)
    await queryRunner.query(`
      CREATE POLICY books_invoice_lines_select ON books_invoice_lines
        FOR SELECT USING (
          EXISTS (
            SELECT 1 FROM books_invoices i
            WHERE i.id = books_invoice_lines.invoice_id
              AND app_can_access_tenant(i.tenant_id)
          )
        );
    `);
    await queryRunner.query(`
      CREATE POLICY books_invoice_lines_insert ON books_invoice_lines
        FOR INSERT WITH CHECK (
          EXISTS (
            SELECT 1 FROM books_invoices i
            WHERE i.id = books_invoice_lines.invoice_id
              AND app_can_access_tenant(i.tenant_id)
          )
        );
    `);
    await queryRunner.query(`
      CREATE POLICY books_invoice_lines_update ON books_invoice_lines
        FOR UPDATE USING (
          EXISTS (
            SELECT 1 FROM books_invoices i
            WHERE i.id = books_invoice_lines.invoice_id
              AND app_can_access_tenant(i.tenant_id)
          )
        );
    `);
    await queryRunner.query(`
      CREATE POLICY books_invoice_lines_delete ON books_invoice_lines
        FOR DELETE USING (false);
    `);

    // books_accounts + compliance_acaps_reports + compliance_data_retention_policies policies
    for (const t of ['books_accounts', 'compliance_acaps_reports', 'compliance_data_retention_policies']) {
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

    // compliance_consent_logs: append-only (no UPDATE/DELETE)
    await queryRunner.query(`
      CREATE POLICY compliance_consent_logs_select ON compliance_consent_logs
        FOR SELECT USING (app_can_access_tenant(tenant_id));
    `);
    await queryRunner.query(`
      CREATE POLICY compliance_consent_logs_insert ON compliance_consent_logs
        FOR INSERT WITH CHECK (app_can_access_tenant(tenant_id));
    `);
    await queryRunner.query(`
      CREATE POLICY compliance_consent_logs_update ON compliance_consent_logs
        FOR UPDATE USING (false);
    `);
    await queryRunner.query(`
      CREATE POLICY compliance_consent_logs_delete ON compliance_consent_logs
        FOR DELETE USING (false);
    `);

    // update_invoices_overdue helper function
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_invoices_overdue()
      RETURNS void AS $$
      BEGIN
        UPDATE books_invoices
        SET status = 'overdue', updated_at = NOW()
        WHERE status = 'issued' AND due_date < CURRENT_DATE;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // updated_at triggers (reuse set_updated_at_column from InitialSystem)
    for (const t of ['books_invoices', 'compliance_acaps_reports', 'compliance_data_retention_policies']) {
      await queryRunner.query(`
        CREATE TRIGGER trg_${t}_updated_at
          BEFORE UPDATE ON ${t}
          FOR EACH ROW EXECUTE FUNCTION set_updated_at_column();
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const t of ['books_invoices', 'compliance_acaps_reports', 'compliance_data_retention_policies']) {
      await queryRunner.query(`DROP TRIGGER IF EXISTS trg_${t}_updated_at ON ${t};`);
    }
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_books_accounts_no_cycle ON books_accounts;`);

    await queryRunner.query(`DROP TABLE IF EXISTS compliance_consent_logs CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS compliance_data_retention_policies CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS compliance_acaps_reports CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS books_invoice_lines CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS books_invoices CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS books_accounts CASCADE;`);

    await queryRunner.query(`DROP FUNCTION IF EXISTS update_invoices_overdue CASCADE;`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS check_account_no_cycle CASCADE;`);

    await queryRunner.query(`DROP TYPE IF EXISTS compliance_consent_method;`);
    await queryRunner.query(`DROP TYPE IF EXISTS compliance_consent_type;`);
    await queryRunner.query(`DROP TYPE IF EXISTS compliance_acaps_report_status;`);
    await queryRunner.query(`DROP TYPE IF EXISTS compliance_acaps_report_type;`);
    await queryRunner.query(`DROP TYPE IF EXISTS books_account_type;`);
    await queryRunner.query(`DROP TYPE IF EXISTS books_invoice_status;`);
    await queryRunner.query(`DROP TYPE IF EXISTS books_invoice_type;`);
  }
}
