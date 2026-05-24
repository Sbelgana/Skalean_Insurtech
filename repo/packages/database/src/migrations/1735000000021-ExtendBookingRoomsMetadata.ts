/**
 * Sprint 8 Tache 8.8 -- EXTEND booking_rooms with rich metadata for v3.0.
 *
 * Verification live state (avant cette migration) :
 *   - Table booking_rooms existe (Sprint 2/3 init) avec : id, tenant_id, name,
 *     capacity, location, color, active, metadata, created_at, updated_at +
 *     UNIQUE(tenant_id, name) + idx (tenant, active) + RLS FORCE + trigger
 *     updated_at + FK auth_tenants ON DELETE CASCADE.
 *   - booking_appointments referencee booking_rooms.id (FK).
 *
 * Sprint 8.8 ajoute :
 *   - description text (libre)
 *   - city varchar(100) (Casablanca / Rabat / Marrakech / Tanger / Fes / ...)
 *   - timezone varchar(50) DEFAULT 'Africa/Casablanca' (heritage Maroc, pas de DST)
 *   - business_hours jsonb DEFAULT '{}' (per-day { open, close, closed })
 *   - buffer_minutes int DEFAULT 15 CHECK (>= 0) (entre 2 appointments meme room)
 *   - equipment jsonb DEFAULT '[]' (array de strings : "wifi", "projector", ...)
 *   - room_type varchar(30) DEFAULT 'meeting' CHECK
 *     ('meeting'/'office'/'workshop'/'parking'/'visit'/'other')
 *
 * Indexes ajoutes :
 *   - (tenant_id, room_type, active) -- filtre par type frequent
 *   - (tenant_id, city) -- filtre par ville Maroc
 *
 * Permissions reutilisees : BOOKING_ROOMS_READ + BOOKING_ROOMS_MANAGE existent
 * deja dans le catalog Sprint 7.5a (pattern umbrella MANAGE comme Task 8.3
 * CRM_PIPELINES_MANAGE).
 *
 * Bug #5 Pause #5 prevention : grants conserves (table existante, pas de re-grant
 * necessaire mais la post-migration script s'execute auto).
 *
 * Reference : B-08 Tache 3.2.1.
 */

import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ExtendBookingRoomsMetadata1735000000021 implements MigrationInterface {
  name = 'ExtendBookingRoomsMetadata1735000000021';

  async up(q: QueryRunner): Promise<void> {
    // -------------------------------------------------------------------------
    // 1. Add new columns (NULLABLE where appropriate, NOT NULL with default sinon)
    // -------------------------------------------------------------------------
    await q.query(`
      ALTER TABLE booking_rooms
        ADD COLUMN IF NOT EXISTS description text;
    `);
    await q.query(`
      ALTER TABLE booking_rooms
        ADD COLUMN IF NOT EXISTS city varchar(100);
    `);
    await q.query(`
      ALTER TABLE booking_rooms
        ADD COLUMN IF NOT EXISTS timezone varchar(50) NOT NULL DEFAULT 'Africa/Casablanca';
    `);
    await q.query(`
      ALTER TABLE booking_rooms
        ADD COLUMN IF NOT EXISTS business_hours jsonb NOT NULL DEFAULT '{}'::jsonb;
    `);
    await q.query(`
      ALTER TABLE booking_rooms
        ADD COLUMN IF NOT EXISTS buffer_minutes int NOT NULL DEFAULT 15;
    `);
    await q.query(`
      ALTER TABLE booking_rooms
        ADD COLUMN IF NOT EXISTS equipment jsonb NOT NULL DEFAULT '[]'::jsonb;
    `);
    await q.query(`
      ALTER TABLE booking_rooms
        ADD COLUMN IF NOT EXISTS room_type varchar(30) NOT NULL DEFAULT 'meeting';
    `);

    // -------------------------------------------------------------------------
    // 2. CHECK constraints
    // -------------------------------------------------------------------------
    await q.query(`
      ALTER TABLE booking_rooms
        ADD CONSTRAINT booking_rooms_buffer_minutes_check
        CHECK (buffer_minutes >= 0);
    `);
    await q.query(`
      ALTER TABLE booking_rooms
        ADD CONSTRAINT booking_rooms_room_type_check
        CHECK (room_type IN ('meeting', 'office', 'workshop', 'parking', 'visit', 'other'));
    `);

    // -------------------------------------------------------------------------
    // 3. New indexes
    // -------------------------------------------------------------------------
    await q.query(`
      CREATE INDEX IF NOT EXISTS idx_booking_rooms_tenant_type_active
        ON booking_rooms(tenant_id, room_type, active)
        WHERE active = true;
    `);
    await q.query(`
      CREATE INDEX IF NOT EXISTS idx_booking_rooms_tenant_city
        ON booking_rooms(tenant_id, city)
        WHERE city IS NOT NULL AND active = true;
    `);

    // -------------------------------------------------------------------------
    // 4. Documentation
    // -------------------------------------------------------------------------
    await q.query(
      `COMMENT ON COLUMN booking_rooms.business_hours IS 'JSONB per-day schedule. Format: {monday: {open: "08:00", close: "18:00", closed: false}, ...}';`,
    );
    await q.query(
      `COMMENT ON COLUMN booking_rooms.timezone IS 'IANA timezone (Africa/Casablanca par defaut, UTC+1 permanent depuis 2018).';`,
    );
    await q.query(
      `COMMENT ON COLUMN booking_rooms.buffer_minutes IS 'Buffer entre 2 appointments meme room (cleanup, deplacement). Utilise Task 8.9 EXCLUDE GIST + Task 8.11 Availability.';`,
    );
    await q.query(
      `COMMENT ON COLUMN booking_rooms.equipment IS 'Array JSONB de strings equipement disponible (wifi/projector/videoconf/lift/...).';`,
    );
    await q.query(
      `COMMENT ON COLUMN booking_rooms.room_type IS 'Type ressource bookable : meeting/office/workshop/parking/visit/other. Extensible via ALTER CHECK Sprint 22.5/22.7 si besoin.';`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS idx_booking_rooms_tenant_city;`);
    await q.query(`DROP INDEX IF EXISTS idx_booking_rooms_tenant_type_active;`);
    await q.query(
      `ALTER TABLE booking_rooms DROP CONSTRAINT IF EXISTS booking_rooms_room_type_check;`,
    );
    await q.query(
      `ALTER TABLE booking_rooms DROP CONSTRAINT IF EXISTS booking_rooms_buffer_minutes_check;`,
    );
    await q.query(`ALTER TABLE booking_rooms DROP COLUMN IF EXISTS room_type;`);
    await q.query(`ALTER TABLE booking_rooms DROP COLUMN IF EXISTS equipment;`);
    await q.query(`ALTER TABLE booking_rooms DROP COLUMN IF EXISTS buffer_minutes;`);
    await q.query(`ALTER TABLE booking_rooms DROP COLUMN IF EXISTS business_hours;`);
    await q.query(`ALTER TABLE booking_rooms DROP COLUMN IF EXISTS timezone;`);
    await q.query(`ALTER TABLE booking_rooms DROP COLUMN IF EXISTS city;`);
    await q.query(`ALTER TABLE booking_rooms DROP COLUMN IF EXISTS description;`);
  }
}
