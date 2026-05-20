/**
 * Sprint 5 -- Auth Foundations augmentation
 *
 * - ALTER auth_users : add role, locale, is_active, last_login_ip,
 *   mfa_recovery_codes_hashes, mfa_setup_completed_at
 * - CREATE auth_email_verifications (SHA-256-hashed token, 24h TTL, RLS)
 * - CREATE auth_password_recoveries (SHA-256-hashed token, 1h TTL, RLS)
 *
 * Tables are tenant-scoped via auth_users.tenant_id ; RLS policies inherit
 * from auth_users via FK chain.
 */

import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AuthSprint5Augmentation1735000000009 implements MigrationInterface {
  name = 'AuthSprint5Augmentation1735000000009';

  async up(q: QueryRunner): Promise<void> {
    // auth_users : add columns required by Sprint 5
    await q.query(`
      ALTER TABLE auth_users
        ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'prospect',
        ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'fr-MA',
        ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS last_login_ip inet NULL,
        ADD COLUMN IF NOT EXISTS mfa_recovery_codes_hashes jsonb NULL,
        ADD COLUMN IF NOT EXISTS mfa_setup_completed_at timestamptz NULL;
    `);
    await q.query(`
      ALTER TABLE auth_users
        ADD CONSTRAINT auth_users_role_chk CHECK (role IN (
          'super_admin_platform','analyst_support',
          'broker_admin','broker_user','broker_assistant',
          'garage_admin','garage_chef','garage_technicien','garage_comptable','garage_commercial',
          'assure','prospect'
        ));
    `);
    await q.query(`
      ALTER TABLE auth_users
        ADD CONSTRAINT auth_users_locale_chk CHECK (locale IN ('fr-MA','ar-MA','en','fr-FR'));
    `);
    await q.query(
      `CREATE INDEX IF NOT EXISTS idx_auth_users_role ON auth_users (role) WHERE deleted_at IS NULL;`,
    );

    // auth_email_verifications : signup + change-email + resend flows
    await q.query(`
      CREATE TABLE auth_email_verifications (
        id                      uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id                 uuid         NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
        tenant_id               uuid         NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
        token_hash              text         NOT NULL UNIQUE,
        purpose                 text         NOT NULL DEFAULT 'signup',
        expires_at              timestamptz  NOT NULL,
        consumed_at             timestamptz  NULL,
        created_at              timestamptz  NOT NULL DEFAULT now(),
        ip_at_creation          inet         NULL,
        user_agent_at_creation  text         NULL,
        CONSTRAINT auth_email_verifications_purpose_chk
          CHECK (purpose IN ('signup','change_email','resend')),
        CONSTRAINT auth_email_verifications_token_chk
          CHECK (length(token_hash) BETWEEN 40 AND 200),
        CONSTRAINT auth_email_verifications_expires_chk
          CHECK (expires_at > created_at)
      );
    `);
    await q.query(
      `CREATE INDEX idx_auth_email_verifications_user_id ON auth_email_verifications (user_id);`,
    );
    await q.query(
      `CREATE INDEX idx_auth_email_verifications_expires ON auth_email_verifications (expires_at) WHERE consumed_at IS NULL;`,
    );
    await q.query(
      `CREATE INDEX idx_auth_email_verifications_user_pending ON auth_email_verifications (user_id) WHERE consumed_at IS NULL;`,
    );

    await q.query(`ALTER TABLE auth_email_verifications ENABLE ROW LEVEL SECURITY;`);
    await q.query(`ALTER TABLE auth_email_verifications FORCE ROW LEVEL SECURITY;`);
    await q.query(`
      CREATE POLICY auth_email_verifications_select ON auth_email_verifications
        FOR SELECT USING (tenant_id IS NULL OR app_can_access_tenant(tenant_id));
    `);
    await q.query(`
      CREATE POLICY auth_email_verifications_insert ON auth_email_verifications
        FOR INSERT WITH CHECK (tenant_id IS NULL OR app_can_access_tenant(tenant_id));
    `);
    await q.query(`
      CREATE POLICY auth_email_verifications_update ON auth_email_verifications
        FOR UPDATE
        USING (tenant_id IS NULL OR app_can_access_tenant(tenant_id))
        WITH CHECK (tenant_id IS NULL OR app_can_access_tenant(tenant_id));
    `);
    await q.query(`
      CREATE POLICY auth_email_verifications_delete ON auth_email_verifications
        FOR DELETE USING (tenant_id IS NULL OR app_can_access_tenant(tenant_id));
    `);
    await q.query(
      `COMMENT ON TABLE auth_email_verifications IS 'Sprint 5 -- email verification tokens. Token stored SHA-256-hashed for defense in depth. TTL 24h.';`,
    );

    // auth_password_recoveries : forgot-password / reset-password flow
    await q.query(`
      CREATE TABLE auth_password_recoveries (
        id                      uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id                 uuid         NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
        tenant_id               uuid         NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
        token_hash              text         NOT NULL UNIQUE,
        expires_at              timestamptz  NOT NULL,
        consumed_at             timestamptz  NULL,
        attempts                integer      NOT NULL DEFAULT 0,
        created_at              timestamptz  NOT NULL DEFAULT now(),
        ip_at_creation          inet         NULL,
        user_agent_at_creation  text         NULL,
        CONSTRAINT auth_password_recoveries_token_chk
          CHECK (length(token_hash) BETWEEN 40 AND 200),
        CONSTRAINT auth_password_recoveries_expires_chk
          CHECK (expires_at > created_at),
        CONSTRAINT auth_password_recoveries_attempts_chk
          CHECK (attempts >= 0 AND attempts <= 10)
      );
    `);
    await q.query(
      `CREATE INDEX idx_auth_password_recoveries_user_id ON auth_password_recoveries (user_id);`,
    );
    await q.query(
      `CREATE INDEX idx_auth_password_recoveries_expires ON auth_password_recoveries (expires_at) WHERE consumed_at IS NULL;`,
    );

    await q.query(`ALTER TABLE auth_password_recoveries ENABLE ROW LEVEL SECURITY;`);
    await q.query(`ALTER TABLE auth_password_recoveries FORCE ROW LEVEL SECURITY;`);
    await q.query(`
      CREATE POLICY auth_password_recoveries_select ON auth_password_recoveries
        FOR SELECT USING (tenant_id IS NULL OR app_can_access_tenant(tenant_id));
    `);
    await q.query(`
      CREATE POLICY auth_password_recoveries_insert ON auth_password_recoveries
        FOR INSERT WITH CHECK (tenant_id IS NULL OR app_can_access_tenant(tenant_id));
    `);
    await q.query(`
      CREATE POLICY auth_password_recoveries_update ON auth_password_recoveries
        FOR UPDATE
        USING (tenant_id IS NULL OR app_can_access_tenant(tenant_id))
        WITH CHECK (tenant_id IS NULL OR app_can_access_tenant(tenant_id));
    `);
    await q.query(`
      CREATE POLICY auth_password_recoveries_delete ON auth_password_recoveries
        FOR DELETE USING (tenant_id IS NULL OR app_can_access_tenant(tenant_id));
    `);
    await q.query(
      `COMMENT ON TABLE auth_password_recoveries IS 'Sprint 5 -- password reset tokens. Token stored SHA-256-hashed. TTL 1h. attempts column for brute-force defense.';`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS auth_password_recoveries;`);
    await q.query(`DROP TABLE IF EXISTS auth_email_verifications;`);
    await q.query(`DROP INDEX IF EXISTS idx_auth_users_role;`);
    await q.query(`ALTER TABLE auth_users DROP CONSTRAINT IF EXISTS auth_users_locale_chk;`);
    await q.query(`ALTER TABLE auth_users DROP CONSTRAINT IF EXISTS auth_users_role_chk;`);
    await q.query(`
      ALTER TABLE auth_users
        DROP COLUMN IF EXISTS mfa_setup_completed_at,
        DROP COLUMN IF EXISTS mfa_recovery_codes_hashes,
        DROP COLUMN IF EXISTS last_login_ip,
        DROP COLUMN IF EXISTS is_active,
        DROP COLUMN IF EXISTS locale,
        DROP COLUMN IF EXISTS role;
    `);
  }
}
