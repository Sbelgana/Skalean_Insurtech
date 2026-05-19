import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class Booking1735000000003 implements MigrationInterface {
  public name = 'Booking1735000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS btree_gist;`);

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
      CREATE TYPE booking_appointment_status AS ENUM (
        'scheduled', 'confirmed', 'cancelled', 'no_show', 'completed'
      );
    `);

    await queryRunner.query(`
      CREATE TYPE booking_calendar_provider AS ENUM (
        'google', 'outlook', 'caldav'
      );
    `);

    await queryRunner.query(`
      CREATE TABLE booking_rooms (
        id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id   uuid         NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
        name        varchar(150) NOT NULL,
        capacity    integer      NOT NULL DEFAULT 1
                    CHECK (capacity >= 1 AND capacity <= 999),
        location    varchar(255),
        color       char(7)      NOT NULL DEFAULT '#3B82F6'
                    CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
        active      boolean      NOT NULL DEFAULT true,
        metadata    jsonb        NOT NULL DEFAULT '{}'::jsonb,
        created_at  timestamptz  NOT NULL DEFAULT now(),
        updated_at  timestamptz  NOT NULL DEFAULT now(),
        CONSTRAINT booking_rooms_name_per_tenant UNIQUE (tenant_id, name)
      );
    `);

    await queryRunner.query(`
      CREATE INDEX idx_booking_rooms_tenant_active
        ON booking_rooms (tenant_id, active)
        WHERE active = true;
    `);

    await queryRunner.query(`
      CREATE TABLE booking_appointments (
        id                uuid                        PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id         uuid                        NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
        room_id           uuid                        NOT NULL REFERENCES booking_rooms(id) ON DELETE RESTRICT,
        contact_id        uuid                        REFERENCES crm_contacts(id) ON DELETE SET NULL,
        assigned_user_id  uuid                        REFERENCES auth_users(id) ON DELETE SET NULL,
        title             varchar(255)                NOT NULL,
        description       text,
        time_range        tstzrange                   NOT NULL,
        status            booking_appointment_status  NOT NULL DEFAULT 'scheduled',
        reminder_sent_at  timestamptz,
        cancelled_at      timestamptz,
        cancel_reason     varchar(500),
        metadata          jsonb                       NOT NULL DEFAULT '{}'::jsonb,
        created_by        uuid                        REFERENCES auth_users(id) ON DELETE SET NULL,
        created_at        timestamptz                 NOT NULL DEFAULT now(),
        updated_at        timestamptz                 NOT NULL DEFAULT now(),
        CONSTRAINT booking_appointments_time_range_valid
          CHECK (lower(time_range) < upper(time_range)),
        CONSTRAINT booking_appointments_cancel_consistency
          CHECK (
            (status <> 'cancelled') OR
            (status = 'cancelled' AND cancelled_at IS NOT NULL)
          )
      );
    `);

    await queryRunner.query(`
      ALTER TABLE booking_appointments
        ADD CONSTRAINT booking_appointments_no_overlap
        EXCLUDE USING GIST (
          tenant_id  WITH =,
          room_id    WITH =,
          time_range WITH &&
        )
        WHERE (status NOT IN ('cancelled', 'no_show'));
    `);

    await queryRunner.query(`
      CREATE INDEX idx_booking_appointments_tenant_contact
        ON booking_appointments (tenant_id, contact_id)
        WHERE contact_id IS NOT NULL;
    `);

    await queryRunner.query(`
      CREATE INDEX idx_booking_appointments_reminder_pending
        ON booking_appointments (time_range)
        WHERE reminder_sent_at IS NULL
          AND status IN ('scheduled', 'confirmed');
    `);

    await queryRunner.query(`
      CREATE INDEX idx_booking_appointments_assigned_user
        ON booking_appointments (tenant_id, assigned_user_id, time_range)
        WHERE assigned_user_id IS NOT NULL;
    `);

    await queryRunner.query(`
      CREATE TABLE booking_calendar_syncs (
        id                       uuid                       PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id                uuid                       NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
        user_id                  uuid                       NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
        provider                 booking_calendar_provider  NOT NULL,
        provider_account_id      varchar(255)               NOT NULL,
        access_token_encrypted   text                       NOT NULL,
        refresh_token_encrypted  text,
        token_expires_at         timestamptz,
        last_sync_at             timestamptz,
        last_sync_error          varchar(500),
        sync_enabled             boolean                    NOT NULL DEFAULT true,
        scope                    varchar(500),
        metadata                 jsonb                      NOT NULL DEFAULT '{}'::jsonb,
        created_at               timestamptz                NOT NULL DEFAULT now(),
        updated_at               timestamptz                NOT NULL DEFAULT now(),
        CONSTRAINT booking_calendar_syncs_unique_account
          UNIQUE (tenant_id, user_id, provider, provider_account_id)
      );
    `);

    await queryRunner.query(`
      CREATE INDEX idx_booking_calendar_syncs_user
        ON booking_calendar_syncs (tenant_id, user_id, provider);
    `);

    await queryRunner.query(`
      CREATE INDEX idx_booking_calendar_syncs_enabled
        ON booking_calendar_syncs (tenant_id, sync_enabled)
        WHERE sync_enabled = true;
    `);

    for (const table of ['booking_rooms', 'booking_appointments', 'booking_calendar_syncs']) {
      await queryRunner.query(`
        CREATE TRIGGER trg_${table}_updated_at
          BEFORE UPDATE ON ${table}
          FOR EACH ROW EXECUTE FUNCTION set_updated_at_column();
      `);
    }

    for (const table of ['booking_rooms', 'booking_appointments', 'booking_calendar_syncs']) {
      await queryRunner.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`);
      await queryRunner.query(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;`);
      await queryRunner.query(`
        CREATE POLICY ${table}_select ON ${table}
          FOR SELECT USING (app_can_access_tenant(tenant_id));
      `);
      await queryRunner.query(`
        CREATE POLICY ${table}_insert ON ${table}
          FOR INSERT WITH CHECK (app_can_access_tenant(tenant_id));
      `);
      await queryRunner.query(`
        CREATE POLICY ${table}_update ON ${table}
          FOR UPDATE USING (app_can_access_tenant(tenant_id))
          WITH CHECK (app_can_access_tenant(tenant_id));
      `);
      await queryRunner.query(`
        CREATE POLICY ${table}_delete ON ${table}
          FOR DELETE USING (app_can_access_tenant(tenant_id));
      `);
    }

    await queryRunner.query(`COMMENT ON TABLE booking_rooms IS 'Booking ressources : salles, baies atelier, experts. Multi-tenant RLS FORCE.';`);
    await queryRunner.query(`COMMENT ON TABLE booking_appointments IS 'Rendez-vous planifies avec EXCLUDE GIST anti-double-booking. time_range tstzrange [start, end).';`);
    await queryRunner.query(`COMMENT ON TABLE booking_calendar_syncs IS 'Synchronisation calendriers OAuth (Google/Outlook/CalDAV). Tokens chiffres AES-256-GCM at-rest. Loi 09-08 CNDP.';`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['booking_rooms', 'booking_appointments', 'booking_calendar_syncs']) {
      await queryRunner.query(`DROP TRIGGER IF EXISTS trg_${table}_updated_at ON ${table};`);
    }

    await queryRunner.query(`DROP TABLE IF EXISTS booking_calendar_syncs CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS booking_appointments CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS booking_rooms CASCADE;`);

    await queryRunner.query(`DROP TYPE IF EXISTS booking_calendar_provider;`);
    await queryRunner.query(`DROP TYPE IF EXISTS booking_appointment_status;`);
  }
}
