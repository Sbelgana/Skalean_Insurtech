import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class InitialSystem1735000000001 implements MigrationInterface {
  public name = 'InitialSystem1735000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'citext') THEN
          RAISE EXCEPTION 'Extension citext is required (run task 1.2.1 first)';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') THEN
          RAISE EXCEPTION 'Extension pgcrypto is required (run task 1.2.1 first)';
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      CREATE TYPE tenant_type AS ENUM ('broker', 'garage', 'mixed');
    `);

    await queryRunner.query(`
      CREATE TABLE auth_tenants (
        id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
        name        text          NOT NULL,
        type        tenant_type   NOT NULL,
        settings    jsonb         NOT NULL DEFAULT '{}'::jsonb,
        created_at  timestamptz   NOT NULL DEFAULT now(),
        updated_at  timestamptz   NOT NULL DEFAULT now(),
        deleted_at  timestamptz   NULL,
        CONSTRAINT auth_tenants_name_chk CHECK (length(name) BETWEEN 2 AND 200)
      );
    `);
    await queryRunner.query(`CREATE INDEX idx_auth_tenants_type ON auth_tenants (type) WHERE deleted_at IS NULL;`);
    await queryRunner.query(`CREATE INDEX idx_auth_tenants_deleted_at ON auth_tenants (deleted_at) WHERE deleted_at IS NOT NULL;`);

    await queryRunner.query(`
      CREATE TABLE auth_users (
        id                       uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id                uuid         NULL REFERENCES auth_tenants(id) ON DELETE RESTRICT,
        email                    citext       NOT NULL UNIQUE,
        password_hash            text         NOT NULL,
        display_name             text         NOT NULL,
        mfa_enabled              boolean      NOT NULL DEFAULT false,
        mfa_secret_encrypted     text         NULL,
        email_verified_at        timestamptz  NULL,
        last_login_at            timestamptz  NULL,
        locked_until             timestamptz  NULL,
        failed_login_attempts    integer      NOT NULL DEFAULT 0,
        created_at               timestamptz  NOT NULL DEFAULT now(),
        updated_at               timestamptz  NOT NULL DEFAULT now(),
        deleted_at               timestamptz  NULL,
        CONSTRAINT auth_users_email_chk CHECK (length(email::text) BETWEEN 5 AND 320),
        CONSTRAINT auth_users_password_hash_chk CHECK (length(password_hash) BETWEEN 30 AND 500),
        CONSTRAINT auth_users_failed_attempts_chk CHECK (failed_login_attempts >= 0 AND failed_login_attempts <= 1000)
      );
    `);
    await queryRunner.query(`CREATE INDEX idx_auth_users_email_lower ON auth_users (lower(email::text));`);
    await queryRunner.query(`CREATE INDEX idx_auth_users_tenant_id ON auth_users (tenant_id) WHERE deleted_at IS NULL;`);
    await queryRunner.query(`CREATE INDEX idx_auth_users_locked_until ON auth_users (locked_until) WHERE locked_until IS NOT NULL;`);

    await queryRunner.query(`ALTER TABLE auth_users ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE auth_users FORCE ROW LEVEL SECURITY;`);
    await queryRunner.query(`
      CREATE POLICY auth_users_select ON auth_users
        FOR SELECT
        USING (tenant_id IS NULL OR app_can_access_tenant(tenant_id));
    `);
    await queryRunner.query(`
      CREATE POLICY auth_users_insert ON auth_users
        FOR INSERT
        WITH CHECK (tenant_id IS NULL OR app_can_access_tenant(tenant_id));
    `);
    await queryRunner.query(`
      CREATE POLICY auth_users_update ON auth_users
        FOR UPDATE
        USING (tenant_id IS NULL OR app_can_access_tenant(tenant_id))
        WITH CHECK (tenant_id IS NULL OR app_can_access_tenant(tenant_id));
    `);
    await queryRunner.query(`
      CREATE POLICY auth_users_delete ON auth_users
        FOR DELETE
        USING (tenant_id IS NULL OR app_can_access_tenant(tenant_id));
    `);

    await queryRunner.query(`
      CREATE TABLE auth_tenant_users (
        tenant_id    uuid         NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
        user_id      uuid         NOT NULL REFERENCES auth_users(id)   ON DELETE CASCADE,
        role         text         NOT NULL,
        permissions  jsonb        NOT NULL DEFAULT '{}'::jsonb,
        created_at   timestamptz  NOT NULL DEFAULT now(),
        updated_at   timestamptz  NOT NULL DEFAULT now(),
        PRIMARY KEY (tenant_id, user_id),
        CONSTRAINT auth_tenant_users_role_chk CHECK (role IN ('super_admin','tenant_admin','manager','agent','viewer'))
      );
    `);
    await queryRunner.query(`CREATE INDEX idx_auth_tenant_users_tenant_id ON auth_tenant_users (tenant_id);`);
    await queryRunner.query(`CREATE INDEX idx_auth_tenant_users_user_id   ON auth_tenant_users (user_id);`);
    await queryRunner.query(`CREATE INDEX idx_auth_tenant_users_role      ON auth_tenant_users (role);`);

    await queryRunner.query(`ALTER TABLE auth_tenant_users ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE auth_tenant_users FORCE ROW LEVEL SECURITY;`);
    await queryRunner.query(`CREATE POLICY auth_tenant_users_select ON auth_tenant_users FOR SELECT USING (app_can_access_tenant(tenant_id));`);
    await queryRunner.query(`CREATE POLICY auth_tenant_users_insert ON auth_tenant_users FOR INSERT WITH CHECK (app_can_access_tenant(tenant_id));`);
    await queryRunner.query(`CREATE POLICY auth_tenant_users_update ON auth_tenant_users FOR UPDATE USING (app_can_access_tenant(tenant_id)) WITH CHECK (app_can_access_tenant(tenant_id));`);
    await queryRunner.query(`CREATE POLICY auth_tenant_users_delete ON auth_tenant_users FOR DELETE USING (app_can_access_tenant(tenant_id));`);

    await queryRunner.query(`
      CREATE TABLE auth_sessions (
        id                   uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id              uuid         NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
        tenant_id            uuid         NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
        refresh_token_hash   text         NOT NULL UNIQUE,
        user_agent           text         NULL,
        ip_address           inet         NULL,
        created_at           timestamptz  NOT NULL DEFAULT now(),
        expires_at           timestamptz  NOT NULL,
        revoked_at           timestamptz  NULL,
        CONSTRAINT auth_sessions_expires_chk CHECK (expires_at > created_at),
        CONSTRAINT auth_sessions_token_chk CHECK (length(refresh_token_hash) BETWEEN 40 AND 200)
      );
    `);
    await queryRunner.query(`CREATE INDEX idx_auth_sessions_user_id    ON auth_sessions (user_id);`);
    await queryRunner.query(`CREATE INDEX idx_auth_sessions_tenant_id  ON auth_sessions (tenant_id);`);
    await queryRunner.query(`CREATE INDEX idx_auth_sessions_expires_at ON auth_sessions (expires_at) WHERE revoked_at IS NULL;`);

    await queryRunner.query(`ALTER TABLE auth_sessions ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE auth_sessions FORCE ROW LEVEL SECURITY;`);
    await queryRunner.query(`CREATE POLICY auth_sessions_select ON auth_sessions FOR SELECT USING (app_can_access_tenant(tenant_id));`);
    await queryRunner.query(`CREATE POLICY auth_sessions_insert ON auth_sessions FOR INSERT WITH CHECK (app_can_access_tenant(tenant_id));`);
    await queryRunner.query(`CREATE POLICY auth_sessions_update ON auth_sessions FOR UPDATE USING (app_can_access_tenant(tenant_id)) WITH CHECK (app_can_access_tenant(tenant_id));`);
    await queryRunner.query(`CREATE POLICY auth_sessions_delete ON auth_sessions FOR DELETE USING (app_can_access_tenant(tenant_id));`);

    await queryRunner.query(`
      CREATE TABLE audit_log (
        id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id       uuid         NULL REFERENCES auth_tenants(id) ON DELETE SET NULL,
        user_id         uuid         NULL REFERENCES auth_users(id)   ON DELETE SET NULL,
        action          text         NOT NULL,
        resource_type   text         NOT NULL,
        resource_id     uuid         NULL,
        changes         jsonb        NOT NULL DEFAULT '{}'::jsonb,
        ip_address      inet         NULL,
        user_agent      text         NULL,
        created_at      timestamptz  NOT NULL DEFAULT now(),
        CONSTRAINT audit_log_action_chk        CHECK (length(action) BETWEEN 2 AND 100),
        CONSTRAINT audit_log_resource_type_chk CHECK (length(resource_type) BETWEEN 2 AND 100),
        CONSTRAINT audit_log_changes_chk       CHECK (jsonb_typeof(changes) = 'object')
      );
    `);
    await queryRunner.query(`CREATE INDEX idx_audit_log_tenant_created ON audit_log (tenant_id, created_at DESC);`);
    await queryRunner.query(`CREATE INDEX idx_audit_log_user_id        ON audit_log (user_id) WHERE user_id IS NOT NULL;`);
    await queryRunner.query(`CREATE INDEX idx_audit_log_resource       ON audit_log (resource_type, resource_id) WHERE resource_id IS NOT NULL;`);
    await queryRunner.query(`CREATE INDEX idx_audit_log_action         ON audit_log (action);`);
    await queryRunner.query(`CREATE INDEX idx_audit_log_changes_gin    ON audit_log USING GIN (changes jsonb_path_ops);`);

    await queryRunner.query(`ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;`);
    await queryRunner.query(`
      CREATE POLICY audit_log_select ON audit_log
        FOR SELECT
        USING (tenant_id IS NULL OR app_can_access_tenant(tenant_id));
    `);
    await queryRunner.query(`
      CREATE POLICY audit_log_insert ON audit_log
        FOR INSERT
        WITH CHECK (tenant_id IS NULL OR app_can_access_tenant(tenant_id));
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION set_updated_at_column()
      RETURNS TRIGGER LANGUAGE plpgsql AS $$
      BEGIN
        NEW.updated_at = now();
        RETURN NEW;
      END$$;
    `);
    for (const tbl of ['auth_tenants', 'auth_users', 'auth_tenant_users']) {
      await queryRunner.query(`
        CREATE TRIGGER trg_${tbl}_updated_at
        BEFORE UPDATE ON ${tbl}
        FOR EACH ROW EXECUTE FUNCTION set_updated_at_column();
      `);
    }

    await queryRunner.query(`COMMENT ON TABLE auth_tenants       IS 'Organisation catalog (broker/garage/mixed). No RLS - SuperAdmin lookups across tenants.';`);
    await queryRunner.query(`COMMENT ON TABLE auth_users         IS 'User accounts. tenant_id NULL allowed for platform SuperAdmins. Email is citext UNIQUE.';`);
    await queryRunner.query(`COMMENT ON TABLE auth_tenant_users  IS 'Many-to-many junction. SuperAdmins may belong to multiple tenants.';`);
    await queryRunner.query(`COMMENT ON TABLE auth_sessions      IS 'Refresh token hashes (SHA-256). Used for rotation and explicit revocation.';`);
    await queryRunner.query(`COMMENT ON TABLE audit_log          IS 'APPEND-ONLY. 7 years retention (ACAPS). No UPDATE/DELETE policies.';`);
    await queryRunner.query(`COMMENT ON COLUMN auth_users.password_hash IS 'argon2id hash. Format: $argon2id$v=19$m=65536,t=3,p=4$<salt>$<hash>. Legacy bcrypt $2b$ accepted during migration window.';`);
    await queryRunner.query(`COMMENT ON COLUMN auth_users.mfa_secret_encrypted IS 'TOTP secret encrypted with MFA_SECRET_ENCRYPTION_KEY (AES-256-GCM). Rotated annually.';`);
    await queryRunner.query(`COMMENT ON COLUMN audit_log.changes IS 'JSONB schema: {before: {...}, after: {...}, fields_changed: ["field1","field2"]}';`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const tbl of ['auth_tenants', 'auth_users', 'auth_tenant_users']) {
      await queryRunner.query(`DROP TRIGGER IF EXISTS trg_${tbl}_updated_at ON ${tbl};`);
    }
    await queryRunner.query(`DROP FUNCTION IF EXISTS set_updated_at_column();`);

    await queryRunner.query(`DROP TABLE IF EXISTS audit_log CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS auth_sessions CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS auth_tenant_users CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS auth_users CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS auth_tenants CASCADE;`);

    await queryRunner.query(`DROP TYPE IF EXISTS tenant_type;`);
  }
}
