/**
 * Sprint 8 Tache 8.10 (foundation) -- EXTEND booking_calendar_syncs with
 * webhook subscription tracking + sync state + auto-disable thresholds.
 *
 * Verification live state (avant cette migration) :
 *   - Table `booking_calendar_syncs` existe Sprint 2/3 init avec :
 *     id, tenant_id, user_id, provider (enum google/outlook/caldav),
 *     provider_account_id, access_token_encrypted, refresh_token_encrypted,
 *     token_expires_at, last_sync_at, last_sync_error, sync_enabled, scope,
 *     metadata, created_at, updated_at
 *   - Encryption AES-256-GCM deja active via TypeORM ValueTransformer
 *     (createEncryptedColumnTransformer 'CALENDAR_TOKEN_ENCRYPTION_KEY')
 *     -- format ciphertext "iv_b64:tag_b64:enc_b64" single text column
 *   - RLS FORCE + 4 policies + updated_at trigger + 2 indexes
 *
 * Sprint 8.10 ajoute (additive, scope foundation only -- user decision Option A) :
 *   - webhook_subscription_id varchar(300) NULLABLE -- Google channel ID OR
 *     Microsoft Graph subscription ID (gere par Task 8.10b real OAuth providers)
 *   - webhook_resource_id varchar(300) NULLABLE -- Google resource ID
 *     (validation webhook reception)
 *   - webhook_expires_at timestamptz NULLABLE -- Google 7j, MS Graph ~70h max ;
 *     cron renew avant expiration
 *   - last_sync_status varchar(20) NULLABLE CHECK ('success'/'partial'/'failed')
 *   - consecutive_failures int NOT NULL DEFAULT 0 -- auto-disable apres seuil
 *     (sync_enabled = false) pour preserver tokens en attendant user reauth
 *
 * Foundation only : pas de Provider services (googleapis/MS Graph deps) ni
 * Controller endpoints OAuth flow ni Webhook receivers. Real integration
 * deferred Task 8.10b ou Sprint 8.14 quand dev credentials disponibles.
 *
 * Reference : B-08 Tache 3.2.3 (foundation).
 */

import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ExtendBookingCalendarSyncs1735000000024 implements MigrationInterface {
  name = 'ExtendBookingCalendarSyncs1735000000024';

  async up(q: QueryRunner): Promise<void> {
    // -------------------------------------------------------------------------
    // 1. ADD webhook + sync state columns
    // -------------------------------------------------------------------------
    await q.query(`
      ALTER TABLE booking_calendar_syncs
        ADD COLUMN IF NOT EXISTS webhook_subscription_id varchar(300);
    `);
    await q.query(`
      ALTER TABLE booking_calendar_syncs
        ADD COLUMN IF NOT EXISTS webhook_resource_id varchar(300);
    `);
    await q.query(`
      ALTER TABLE booking_calendar_syncs
        ADD COLUMN IF NOT EXISTS webhook_expires_at timestamptz;
    `);
    await q.query(`
      ALTER TABLE booking_calendar_syncs
        ADD COLUMN IF NOT EXISTS last_sync_status varchar(20);
    `);
    await q.query(`
      ALTER TABLE booking_calendar_syncs
        ADD COLUMN IF NOT EXISTS consecutive_failures int NOT NULL DEFAULT 0;
    `);

    // -------------------------------------------------------------------------
    // 2. CHECK constraints
    // -------------------------------------------------------------------------
    await q.query(`
      ALTER TABLE booking_calendar_syncs
        ADD CONSTRAINT booking_calendar_syncs_last_sync_status_check
        CHECK (
          last_sync_status IS NULL
          OR last_sync_status IN ('success', 'partial', 'failed')
        );
    `);
    await q.query(`
      ALTER TABLE booking_calendar_syncs
        ADD CONSTRAINT booking_calendar_syncs_consecutive_failures_non_negative
        CHECK (consecutive_failures >= 0);
    `);

    // -------------------------------------------------------------------------
    // 3. Indexes
    // -------------------------------------------------------------------------
    // Webhook reception lookup (Task 8.10b real receivers will query by external id)
    await q.query(`
      CREATE INDEX IF NOT EXISTS idx_booking_calendar_syncs_webhook
        ON booking_calendar_syncs(webhook_subscription_id)
        WHERE webhook_subscription_id IS NOT NULL;
    `);
    // Cron renewal lookup : webhooks expiring soon
    await q.query(`
      CREATE INDEX IF NOT EXISTS idx_booking_calendar_syncs_webhook_expiry
        ON booking_calendar_syncs(webhook_expires_at)
        WHERE webhook_expires_at IS NOT NULL AND sync_enabled = true;
    `);

    // -------------------------------------------------------------------------
    // 4. Documentation
    // -------------------------------------------------------------------------
    await q.query(
      `COMMENT ON COLUMN booking_calendar_syncs.webhook_subscription_id IS 'Google channel ID or Microsoft Graph subscription ID. Populated by Task 8.10b createWebhookSubscription.';`,
    );
    await q.query(
      `COMMENT ON COLUMN booking_calendar_syncs.webhook_expires_at IS 'Webhook subscription expiration. Google 7j max, MS Graph ~70h max. Cron renews before this.';`,
    );
    await q.query(
      `COMMENT ON COLUMN booking_calendar_syncs.consecutive_failures IS 'Incremented on each failed sync. At threshold (5 typically), service auto-disables sync_enabled=false to preserve tokens for user re-auth.';`,
    );
    await q.query(
      `COMMENT ON COLUMN booking_calendar_syncs.last_sync_status IS 'success / partial / failed. Updated by sync worker Task 8.12.';`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS idx_booking_calendar_syncs_webhook_expiry;`);
    await q.query(`DROP INDEX IF EXISTS idx_booking_calendar_syncs_webhook;`);
    await q.query(
      `ALTER TABLE booking_calendar_syncs DROP CONSTRAINT IF EXISTS booking_calendar_syncs_consecutive_failures_non_negative;`,
    );
    await q.query(
      `ALTER TABLE booking_calendar_syncs DROP CONSTRAINT IF EXISTS booking_calendar_syncs_last_sync_status_check;`,
    );
    await q.query(
      `ALTER TABLE booking_calendar_syncs DROP COLUMN IF EXISTS consecutive_failures;`,
    );
    await q.query(
      `ALTER TABLE booking_calendar_syncs DROP COLUMN IF EXISTS last_sync_status;`,
    );
    await q.query(
      `ALTER TABLE booking_calendar_syncs DROP COLUMN IF EXISTS webhook_expires_at;`,
    );
    await q.query(
      `ALTER TABLE booking_calendar_syncs DROP COLUMN IF EXISTS webhook_resource_id;`,
    );
    await q.query(
      `ALTER TABLE booking_calendar_syncs DROP COLUMN IF EXISTS webhook_subscription_id;`,
    );
  }
}
