import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { DataSource } from 'typeorm';

vi.hoisted(() => {
  process.env['SKIP_INTEGRATION'] ??= 'true';
});

const SKIP = process.env['SKIP_INTEGRATION'] === 'true';

describe.skipIf(SKIP)('Migration Booking1735000000003', () => {
  let ds: DataSource;

  beforeAll(async () => {
    const { createTestDataSource } = await import('../helpers/datasource.js');
    ds = await createTestDataSource({ migrationsRun: false });
  });

  afterAll(async () => {
    if (ds?.isInitialized) await ds.destroy();
  });

  beforeEach(async () => {
    const { dropAllTables } = await import('../helpers/datasource.js');
    await dropAllTables(ds);
    await ds.runMigrations();
  });

  it('cree les 3 tables booking_rooms, booking_appointments, booking_calendar_syncs', async () => {
    const rows: Array<{ table_name: string }> = await ds.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('booking_rooms', 'booking_appointments', 'booking_calendar_syncs')
      ORDER BY table_name;
    `);
    expect(rows.map((r) => r.table_name)).toEqual([
      'booking_appointments', 'booking_calendar_syncs', 'booking_rooms',
    ]);
  });

  it('booking_appointments contient colonne time_range de type tstzrange', async () => {
    const rows: Array<{ column_name: string; data_type: string }> = await ds.query(`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_name = 'booking_appointments' AND column_name = 'time_range';
    `);
    expect(rows[0]?.data_type).toBe('tstzrange');
  });

  it('EXCLUDE constraint booking_appointments_no_overlap existe', async () => {
    const rows: Array<{ conname: string; contype: string }> = await ds.query(`
      SELECT conname, contype FROM pg_constraint
      WHERE conname = 'booking_appointments_no_overlap';
    `);
    expect(rows[0]?.conname).toBe('booking_appointments_no_overlap');
    expect(rows[0]?.contype).toBe('x');
  });

  it('CHECK constraint time_range_valid existe', async () => {
    const rows: Array<{ conname: string }> = await ds.query(`
      SELECT conname FROM pg_constraint
      WHERE conname = 'booking_appointments_time_range_valid';
    `);
    expect(rows[0]?.conname).toBe('booking_appointments_time_range_valid');
  });

  it('RLS FORCE active sur les 3 tables booking', async () => {
    const rows: Array<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }> =
      await ds.query(`
        SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class
        WHERE relname IN ('booking_rooms', 'booking_appointments', 'booking_calendar_syncs')
        ORDER BY relname;
      `);
    expect(rows).toHaveLength(3);
    for (const r of rows) {
      expect(r.relrowsecurity).toBe(true);
      expect(r.relforcerowsecurity).toBe(true);
    }
  });

  it('12 policies RLS creees (3 tables x 4 actions)', async () => {
    const rows: Array<{ count: number }> = await ds.query(`
      SELECT count(*)::int AS count FROM pg_policies
      WHERE tablename IN ('booking_rooms', 'booking_appointments', 'booking_calendar_syncs');
    `);
    expect(rows[0]?.count).toBe(12);
  });

  it('down() supprime les 3 tables et les 2 ENUMs booking', async () => {
    const { Booking1735000000003 } = await import('../../migrations/1735000000003-Booking.js');
    const migration = new Booking1735000000003();
    await migration.down(ds.createQueryRunner());

    const tables: Array<{ count: number }> = await ds.query(`
      SELECT count(*)::int AS count FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('booking_rooms', 'booking_appointments', 'booking_calendar_syncs');
    `);
    expect(tables[0]?.count).toBe(0);

    const enums: Array<{ count: number }> = await ds.query(`
      SELECT count(*)::int AS count FROM pg_type
      WHERE typname IN ('booking_appointment_status', 'booking_calendar_provider') AND typtype = 'e';
    `);
    expect(enums[0]?.count).toBe(0);
  });
});
