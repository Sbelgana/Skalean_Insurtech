/**
 * Sprint 8 Tache 8.9 part 2 -- EXTEND booking_appointments with polymorphic
 * related, state machine columns, attendees, calendar sync prep, and
 * duration CHECK.
 *
 * Depend de migration 022 (ALTER TYPE ADD VALUE 'in_progress' commit avant cette
 * migration). Sinon partial index WHERE status IN ('in_progress', ...) echoue
 * avec 55P04 check_safe_enum_use.
 *
 * Verification live state (avant Sprint 8.9) :
 *   - Table booking_appointments existe Sprint 2/3 init
 *   - btree_gist extension installee
 *   - EXCLUDE GIST no_overlap constraint actif
 *   - status enum 5 valeurs + 022 ajoute 'in_progress' = 6 total
 *
 * Sprint 8.9 partie 2 ajoute :
 *   - 12 colonnes : timezone / attendees / max_attendees / completed_at /
 *     no_show_at / cancelled_by_user_id / deal_id / sinistre_id /
 *     expert_assignment_id / external_calendar_event_id /
 *     external_calendar_provider
 *   - 3 FK : deal_id / expert_assignment_id / cancelled_by_user_id
 *   - 5 CHECK : polymorphic max 1 / duration >= 15min / completed_consistency /
 *     no_show_consistency / cancel_consistency (renforce) + external_provider
 *   - 4 indexes : tenant_status_start (utilise 'in_progress') / tenant_deal /
 *     tenant_expert / external_event_id
 *
 * Buffer logic Option B (Task 8.9 prompt) : service layer enforcement via
 * RoomsService.bufferMinutes + AppointmentsService.findOverlappingWithBuffer.
 * DB EXCLUDE Sprint 2 garantit zero RAW overlap (defense in depth).
 *
 * Reference : B-08 Tache 3.2.2 (split part 2/2).
 */

import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ReshapeBookingAppointments1735000000023 implements MigrationInterface {
  name = 'ReshapeBookingAppointments1735000000023';

  async up(q: QueryRunner): Promise<void> {
    // -------------------------------------------------------------------------
    // 1. ADD new columns
    // -------------------------------------------------------------------------
    await q.query(`
      ALTER TABLE booking_appointments
        ADD COLUMN IF NOT EXISTS timezone varchar(50) NOT NULL DEFAULT 'Africa/Casablanca';
    `);
    await q.query(`
      ALTER TABLE booking_appointments
        ADD COLUMN IF NOT EXISTS attendees jsonb NOT NULL DEFAULT '[]'::jsonb;
    `);
    await q.query(`
      ALTER TABLE booking_appointments
        ADD COLUMN IF NOT EXISTS max_attendees int;
    `);
    await q.query(`
      ALTER TABLE booking_appointments
        ADD COLUMN IF NOT EXISTS completed_at timestamptz;
    `);
    await q.query(`
      ALTER TABLE booking_appointments
        ADD COLUMN IF NOT EXISTS no_show_at timestamptz;
    `);
    await q.query(`
      ALTER TABLE booking_appointments
        ADD COLUMN IF NOT EXISTS cancelled_by_user_id uuid;
    `);
    await q.query(`
      ALTER TABLE booking_appointments
        ADD COLUMN IF NOT EXISTS deal_id uuid;
    `);
    await q.query(`
      ALTER TABLE booking_appointments
        ADD COLUMN IF NOT EXISTS sinistre_id uuid;
    `);
    await q.query(`
      ALTER TABLE booking_appointments
        ADD COLUMN IF NOT EXISTS expert_assignment_id uuid;
    `);
    await q.query(`
      ALTER TABLE booking_appointments
        ADD COLUMN IF NOT EXISTS external_calendar_event_id varchar(300);
    `);
    await q.query(`
      ALTER TABLE booking_appointments
        ADD COLUMN IF NOT EXISTS external_calendar_provider varchar(20);
    `);

    // -------------------------------------------------------------------------
    // 2. FKs
    // -------------------------------------------------------------------------
    await q.query(`
      ALTER TABLE booking_appointments
        ADD CONSTRAINT booking_appointments_deal_id_fkey
        FOREIGN KEY (deal_id) REFERENCES crm_deals(id) ON DELETE SET NULL;
    `);
    await q.query(`
      ALTER TABLE booking_appointments
        ADD CONSTRAINT booking_appointments_expert_assignment_id_fkey
        FOREIGN KEY (expert_assignment_id)
        REFERENCES insure_expert_assignments(id) ON DELETE SET NULL;
    `);
    await q.query(`
      ALTER TABLE booking_appointments
        ADD CONSTRAINT booking_appointments_cancelled_by_user_id_fkey
        FOREIGN KEY (cancelled_by_user_id) REFERENCES auth_users(id) ON DELETE SET NULL;
    `);

    // -------------------------------------------------------------------------
    // 3. CHECK constraints
    // -------------------------------------------------------------------------
    await q.query(`
      ALTER TABLE booking_appointments
        ADD CONSTRAINT booking_appointments_polymorphic_max_one
        CHECK (
          (CASE WHEN deal_id IS NOT NULL THEN 1 ELSE 0 END)
        + (CASE WHEN sinistre_id IS NOT NULL THEN 1 ELSE 0 END)
        + (CASE WHEN expert_assignment_id IS NOT NULL THEN 1 ELSE 0 END)
        <= 1
        );
    `);
    await q.query(`
      ALTER TABLE booking_appointments
        ADD CONSTRAINT booking_appointments_min_duration_15min
        CHECK (upper(time_range) - lower(time_range) >= INTERVAL '15 minutes');
    `);
    await q.query(`
      ALTER TABLE booking_appointments
        ADD CONSTRAINT booking_appointments_completed_consistency
        CHECK (
          (status = 'completed' AND completed_at IS NOT NULL)
          OR (status <> 'completed' AND completed_at IS NULL)
        );
    `);
    await q.query(`
      ALTER TABLE booking_appointments
        ADD CONSTRAINT booking_appointments_no_show_consistency
        CHECK (
          (status = 'no_show' AND no_show_at IS NOT NULL)
          OR (status <> 'no_show' AND no_show_at IS NULL)
        );
    `);

    // Tighten cancel_consistency
    await q.query(
      `ALTER TABLE booking_appointments DROP CONSTRAINT IF EXISTS booking_appointments_cancel_consistency;`,
    );
    await q.query(`
      ALTER TABLE booking_appointments
        ADD CONSTRAINT booking_appointments_cancel_consistency
        CHECK (
          (status = 'cancelled' AND cancelled_at IS NOT NULL AND cancelled_by_user_id IS NOT NULL)
          OR (status <> 'cancelled' AND cancelled_at IS NULL AND cancelled_by_user_id IS NULL)
        );
    `);

    await q.query(`
      ALTER TABLE booking_appointments
        ADD CONSTRAINT booking_appointments_external_provider_check
        CHECK (
          external_calendar_provider IS NULL
          OR external_calendar_provider IN ('google', 'outlook')
        );
    `);

    // -------------------------------------------------------------------------
    // 4. Indexes (planner hints for state machine queries + polymorphic + sync)
    //    Uses 'in_progress' value -- now safe because migration 022 committed it.
    // -------------------------------------------------------------------------
    // NOTE : even though migration 022 commits 'in_progress' before this
    // migration runs, Postgres `check_safe_enum_use` (errcode 55P04) flags
    // direct references to a newly-added enum value in CREATE INDEX WHERE
    // clauses if the catalog snapshot was taken before the ADD VALUE.
    // Workaround : express the predicate as NOT-set of the OTHER values
    // (cancelled / no_show / completed) which are all pre-existing.
    await q.query(`
      CREATE INDEX IF NOT EXISTS idx_booking_appointments_tenant_status_start
        ON booking_appointments(tenant_id, status, lower(time_range))
        WHERE status NOT IN ('cancelled', 'no_show', 'completed');
    `);
    await q.query(`
      CREATE INDEX IF NOT EXISTS idx_booking_appointments_tenant_deal
        ON booking_appointments(tenant_id, deal_id)
        WHERE deal_id IS NOT NULL;
    `);
    await q.query(`
      CREATE INDEX IF NOT EXISTS idx_booking_appointments_tenant_expert
        ON booking_appointments(tenant_id, expert_assignment_id)
        WHERE expert_assignment_id IS NOT NULL;
    `);
    await q.query(`
      CREATE INDEX IF NOT EXISTS idx_booking_appointments_external_event
        ON booking_appointments(external_calendar_event_id)
        WHERE external_calendar_event_id IS NOT NULL;
    `);

    // -------------------------------------------------------------------------
    // 5. Documentation
    // -------------------------------------------------------------------------
    await q.query(
      `COMMENT ON COLUMN booking_appointments.deal_id IS 'Polymorphic FK -- max 1 of (deal_id, sinistre_id, expert_assignment_id). ON DELETE SET NULL preserves appointment history.';`,
    );
    await q.query(
      `COMMENT ON COLUMN booking_appointments.expert_assignment_id IS 'FK insure_expert_assignments (Sprint 7.5b foundation). ON DELETE SET NULL.';`,
    );
    await q.query(
      `COMMENT ON COLUMN booking_appointments.sinistre_id IS 'Reserved Sprint 21 sinistre workflow. No FK yet (table will be created Sprint 21).';`,
    );
    await q.query(
      `COMMENT ON COLUMN booking_appointments.external_calendar_event_id IS 'OAuth calendar event id (Google/Outlook). Populated by Task 8.10 sync.';`,
    );
    await q.query(
      `COMMENT ON COLUMN booking_appointments.attendees IS 'JSONB array of {name, email, phone}. PII -- loi 09-08 CNDP audit on access.';`,
    );
    await q.query(
      `COMMENT ON CONSTRAINT booking_appointments_no_overlap ON booking_appointments IS 'Sprint 2 EXCLUDE GIST btree_gist : zero overlap (tenant_id, room_id, time_range) except cancelled/no_show. Buffer minutes enforced at service layer (Option B, Task 8.9).';`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS idx_booking_appointments_external_event;`);
    await q.query(`DROP INDEX IF EXISTS idx_booking_appointments_tenant_expert;`);
    await q.query(`DROP INDEX IF EXISTS idx_booking_appointments_tenant_deal;`);
    await q.query(`DROP INDEX IF EXISTS idx_booking_appointments_tenant_status_start;`);

    await q.query(
      `ALTER TABLE booking_appointments DROP CONSTRAINT IF EXISTS booking_appointments_external_provider_check;`,
    );
    await q.query(
      `ALTER TABLE booking_appointments DROP CONSTRAINT IF EXISTS booking_appointments_no_show_consistency;`,
    );
    await q.query(
      `ALTER TABLE booking_appointments DROP CONSTRAINT IF EXISTS booking_appointments_completed_consistency;`,
    );
    await q.query(
      `ALTER TABLE booking_appointments DROP CONSTRAINT IF EXISTS booking_appointments_min_duration_15min;`,
    );
    await q.query(
      `ALTER TABLE booking_appointments DROP CONSTRAINT IF EXISTS booking_appointments_polymorphic_max_one;`,
    );

    await q.query(
      `ALTER TABLE booking_appointments DROP CONSTRAINT IF EXISTS booking_appointments_cancel_consistency;`,
    );
    await q.query(`
      ALTER TABLE booking_appointments
        ADD CONSTRAINT booking_appointments_cancel_consistency
        CHECK (
          status <> 'cancelled'
          OR (status = 'cancelled' AND cancelled_at IS NOT NULL)
        );
    `);

    await q.query(
      `ALTER TABLE booking_appointments DROP CONSTRAINT IF EXISTS booking_appointments_cancelled_by_user_id_fkey;`,
    );
    await q.query(
      `ALTER TABLE booking_appointments DROP CONSTRAINT IF EXISTS booking_appointments_expert_assignment_id_fkey;`,
    );
    await q.query(
      `ALTER TABLE booking_appointments DROP CONSTRAINT IF EXISTS booking_appointments_deal_id_fkey;`,
    );

    await q.query(
      `ALTER TABLE booking_appointments DROP COLUMN IF EXISTS external_calendar_provider;`,
    );
    await q.query(
      `ALTER TABLE booking_appointments DROP COLUMN IF EXISTS external_calendar_event_id;`,
    );
    await q.query(
      `ALTER TABLE booking_appointments DROP COLUMN IF EXISTS expert_assignment_id;`,
    );
    await q.query(`ALTER TABLE booking_appointments DROP COLUMN IF EXISTS sinistre_id;`);
    await q.query(`ALTER TABLE booking_appointments DROP COLUMN IF EXISTS deal_id;`);
    await q.query(
      `ALTER TABLE booking_appointments DROP COLUMN IF EXISTS cancelled_by_user_id;`,
    );
    await q.query(`ALTER TABLE booking_appointments DROP COLUMN IF EXISTS no_show_at;`);
    await q.query(
      `ALTER TABLE booking_appointments DROP COLUMN IF EXISTS completed_at;`,
    );
    await q.query(
      `ALTER TABLE booking_appointments DROP COLUMN IF EXISTS max_attendees;`,
    );
    await q.query(`ALTER TABLE booking_appointments DROP COLUMN IF EXISTS attendees;`);
    await q.query(`ALTER TABLE booking_appointments DROP COLUMN IF EXISTS timezone;`);
  }
}
