/**
 * Sprint 8 Tache 8.13 -- CREATE TABLE booking_ical_tokens.
 *
 * iCal feed publication tokens. One-way RFC 5545 export of a user's
 * appointments (or wider tenant scope for admin tokens) consumable by Apple
 * Calendar / Outlook / Google Calendar subscribe-by-URL.
 *
 * Security model :
 *   - Plain token (`ical_<base64url(32 bytes)>`) is shown to the user ONCE
 *     at creation and NEVER stored. Only its SHA-256 hash is persisted.
 *   - Compromise of the DB alone does not leak any token (hash is one-way).
 *   - Token presence in URL path requires HTTPS in production -- HTTP logs
 *     would leak it.
 *
 * Scope :
 *   - `own`        : appointments where assigned_user_id = token.user_id
 *   - `team`       : every appointment in the same tenant
 *   - `all_tenant` : same as team, but logged at INFO + audit (admin only)
 *
 * Verification live state (avant cette migration) :
 *   - Table `booking_ical_tokens` n'existe pas (Sprint 2/3 init n'a pas prevu
 *     iCal feed -- decision-018 reserve cette feature pour Sprint 8.13).
 *   - Pas de migration anterieure mentionnant `booking_ical_tokens`.
 *
 * RLS multi-tenant strict (heritage Sprint 2) :
 *   - `app_can_access_tenant(tenant_id)` filtre toutes les operations.
 *   - 4 policies : select / insert / update / delete.
 *   - Public feed endpoint (controller) bypass RLS via repository direct
 *     access (token_hash is the auth) ; tenant_id stocke pour audit + scope.
 *
 * Reference : B-08 Tache 3.2.7.
 */

import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBookingIcalTokens1735000000025 implements MigrationInterface {
  name = 'CreateBookingIcalTokens1735000000025';

  async up(q: QueryRunner): Promise<void> {
    // -------------------------------------------------------------------------
    // 1. Table
    // -------------------------------------------------------------------------
    await q.query(`
      CREATE TABLE booking_ical_tokens (
        id                    uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id             uuid          NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
        user_id               uuid          NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
        token_hash            varchar(64)   NOT NULL,
        scope                 varchar(20)   NOT NULL DEFAULT 'own',
        name                  varchar(150)  NOT NULL,
        expires_at            timestamptz,
        last_accessed_at      timestamptz,
        access_count          int           NOT NULL DEFAULT 0,
        active                boolean       NOT NULL DEFAULT true,
        revoked_at            timestamptz,
        revoked_by_user_id    uuid          REFERENCES auth_users(id) ON DELETE SET NULL,
        created_at            timestamptz   NOT NULL DEFAULT now(),
        updated_at            timestamptz   NOT NULL DEFAULT now(),
        CONSTRAINT booking_ical_tokens_token_hash_unique UNIQUE (token_hash),
        CONSTRAINT booking_ical_tokens_scope_check
          CHECK (scope IN ('own', 'team', 'all_tenant')),
        CONSTRAINT booking_ical_tokens_access_count_non_negative
          CHECK (access_count >= 0),
        CONSTRAINT booking_ical_tokens_revoke_consistency
          CHECK (
            (active = true  AND revoked_at IS NULL AND revoked_by_user_id IS NULL)
            OR (active = false AND revoked_at IS NOT NULL)
          )
      );
    `);

    // -------------------------------------------------------------------------
    // 2. Indexes
    // -------------------------------------------------------------------------
    // Public feed lookup (most frequent query) : sha256 hash -> active token.
    // Single-column index covers the hot path. UNIQUE constraint provides
    // an index automatically ; we add a partial index for the active filter.
    await q.query(`
      CREATE INDEX idx_booking_ical_tokens_hash_active
        ON booking_ical_tokens (token_hash)
        WHERE active = true;
    `);

    // User-facing listing : "my tokens" UI.
    await q.query(`
      CREATE INDEX idx_booking_ical_tokens_owner
        ON booking_ical_tokens (tenant_id, user_id, active)
        WHERE active = true;
    `);

    // Admin listing per tenant.
    await q.query(`
      CREATE INDEX idx_booking_ical_tokens_tenant_scope
        ON booking_ical_tokens (tenant_id, scope);
    `);

    // -------------------------------------------------------------------------
    // 3. Trigger updated_at + RLS (heritage Sprint 2 pattern)
    // -------------------------------------------------------------------------
    await q.query(`
      CREATE TRIGGER trg_booking_ical_tokens_updated_at
        BEFORE UPDATE ON booking_ical_tokens
        FOR EACH ROW EXECUTE FUNCTION set_updated_at_column();
    `);

    await q.query(`ALTER TABLE booking_ical_tokens ENABLE ROW LEVEL SECURITY;`);
    await q.query(`ALTER TABLE booking_ical_tokens FORCE ROW LEVEL SECURITY;`);
    await q.query(`
      CREATE POLICY booking_ical_tokens_select ON booking_ical_tokens
        FOR SELECT USING (app_can_access_tenant(tenant_id));
    `);
    await q.query(`
      CREATE POLICY booking_ical_tokens_insert ON booking_ical_tokens
        FOR INSERT WITH CHECK (app_can_access_tenant(tenant_id));
    `);
    await q.query(`
      CREATE POLICY booking_ical_tokens_update ON booking_ical_tokens
        FOR UPDATE USING (app_can_access_tenant(tenant_id))
        WITH CHECK (app_can_access_tenant(tenant_id));
    `);
    await q.query(`
      CREATE POLICY booking_ical_tokens_delete ON booking_ical_tokens
        FOR DELETE USING (app_can_access_tenant(tenant_id));
    `);

    // -------------------------------------------------------------------------
    // 4. Documentation
    // -------------------------------------------------------------------------
    await q.query(
      `COMMENT ON TABLE booking_ical_tokens IS 'iCal RFC 5545 feed subscription tokens. Plain token never stored -- only SHA-256 hash. Sprint 8 Tache 8.13.';`,
    );
    await q.query(
      `COMMENT ON COLUMN booking_ical_tokens.token_hash IS 'SHA-256 hex of plain token (ical_<base64url(32 bytes)>). One-way -- plain token shown to user once at creation.';`,
    );
    await q.query(
      `COMMENT ON COLUMN booking_ical_tokens.scope IS 'own = user appointments | team = all tenant appointments | all_tenant = admin scope (audit log per access).';`,
    );
    await q.query(
      `COMMENT ON COLUMN booking_ical_tokens.expires_at IS 'Optional expiration. NULL = active until revoked.';`,
    );
    await q.query(
      `COMMENT ON COLUMN booking_ical_tokens.access_count IS 'Incremented on each .ics feed fetch. Pino info log per access (volumetrie potentielle, pas audit DB).';`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TRIGGER IF EXISTS trg_booking_ical_tokens_updated_at ON booking_ical_tokens;`);
    await q.query(`DROP TABLE IF EXISTS booking_ical_tokens CASCADE;`);
  }
}
