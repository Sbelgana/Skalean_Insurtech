/**
 * Sprint 6 Tache 2.2.9 -- TenantSuspensionService schema additions.
 *
 * ALTER auth_tenants :
 *   ADD COLUMN status enum (active|suspended|pending_setup|archived) DEFAULT 'active'
 *   ADD COLUMN suspended_at timestamptz NULL
 *   ADD COLUMN suspension_reason text NULL
 *   ADD COLUMN suspension_type text NULL CHECK (payment_failure|compliance_violation|manual_admin)
 *   ADD COLUMN reactivated_at timestamptz NULL
 *   ADD COLUMN reactivation_reason text NULL
 *
 * Backfill :
 *   tenants existants -> status='active' (sauf deleted_at IS NOT NULL -> 'archived')
 *
 * State machine enforce via CHECK constraints + service layer (Sprint 6).
 *
 * Reference : Sprint 6 / Tache 2.2.9.
 */

import type { MigrationInterface, QueryRunner } from 'typeorm';

export class TenantSuspensionStatus1735000000010 implements MigrationInterface {
  name = 'TenantSuspensionStatus1735000000010';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE auth_tenants
        ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
        ADD COLUMN IF NOT EXISTS suspended_at timestamptz NULL,
        ADD COLUMN IF NOT EXISTS suspension_reason text NULL,
        ADD COLUMN IF NOT EXISTS suspension_type text NULL,
        ADD COLUMN IF NOT EXISTS reactivated_at timestamptz NULL,
        ADD COLUMN IF NOT EXISTS reactivation_reason text NULL;
    `);

    await q.query(`
      ALTER TABLE auth_tenants
        ADD CONSTRAINT auth_tenants_status_chk
        CHECK (status IN ('active','suspended','pending_setup','archived'));
    `);

    await q.query(`
      ALTER TABLE auth_tenants
        ADD CONSTRAINT auth_tenants_suspension_type_chk
        CHECK (suspension_type IS NULL OR suspension_type IN ('payment_failure','compliance_violation','manual_admin'));
    `);

    // Backfill : archived tenants get status='archived'.
    await q.query(`
      UPDATE auth_tenants
      SET status = 'archived'
      WHERE deleted_at IS NOT NULL AND status = 'active';
    `);

    // Index on status for filter queries.
    await q.query(`
      CREATE INDEX IF NOT EXISTS idx_auth_tenants_status
        ON auth_tenants(status)
        WHERE deleted_at IS NULL;
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS idx_auth_tenants_status;`);
    await q.query(`ALTER TABLE auth_tenants DROP CONSTRAINT IF EXISTS auth_tenants_suspension_type_chk;`);
    await q.query(`ALTER TABLE auth_tenants DROP CONSTRAINT IF EXISTS auth_tenants_status_chk;`);
    await q.query(`
      ALTER TABLE auth_tenants
        DROP COLUMN IF EXISTS reactivation_reason,
        DROP COLUMN IF EXISTS reactivated_at,
        DROP COLUMN IF EXISTS suspension_type,
        DROP COLUMN IF EXISTS suspension_reason,
        DROP COLUMN IF EXISTS suspended_at,
        DROP COLUMN IF EXISTS status;
    `);
  }
}
