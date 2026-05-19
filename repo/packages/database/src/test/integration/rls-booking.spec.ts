import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { DataSource, QueryRunner } from 'typeorm';

vi.hoisted(() => {
  process.env['SKIP_INTEGRATION'] ??= 'true';
});

const SKIP = process.env['SKIP_INTEGRATION'] === 'true';

describe.skipIf(SKIP)('RLS isolation -- booking tables', () => {
  let ds: DataSource;
  const tenantA = '11111111-1111-1111-aaaa-111111111111';
  const tenantB = '22222222-2222-2222-bbbb-222222222222';

  const setSession = async (qr: QueryRunner, tenantId: string | null, isSuperAdmin = false) => {
    await qr.query(`SELECT set_config('app.current_tenant_id', $1, true);`, [tenantId ?? '']);
    await qr.query(`SELECT set_config('app.is_super_admin', $1, true);`, [String(isSuperAdmin)]);
  };

  beforeAll(async () => {
    const { createTestDataSource } = await import('../helpers/datasource.js');
    ds = await createTestDataSource({ migrationsRun: true });
    const qr = ds.createQueryRunner();
    await setSession(qr, null, true);
    await qr.query(
      `INSERT INTO auth_tenants (id, name, type) VALUES ($1,'Book-TenantA','broker'),($2,'Book-TenantB','garage') ON CONFLICT DO NOTHING;`,
      [tenantA, tenantB],
    );
    await qr.release();
  });

  afterAll(async () => {
    if (ds?.isInitialized) await ds.destroy();
  });

  beforeEach(async () => {
    const qr = ds.createQueryRunner();
    await setSession(qr, null, true);
    await qr.query(`DELETE FROM booking_appointments;`);
    await qr.query(`DELETE FROM booking_rooms;`);
    await qr.release();
  });

  it('tenant A ne voit pas les salles de tenant B', async () => {
    const qrA = ds.createQueryRunner();
    await setSession(qrA, tenantA);
    await qrA.query(`INSERT INTO booking_rooms (tenant_id, name) VALUES ($1, 'Salle-TA');`, [tenantA]);
    await qrA.release();

    const qrB = ds.createQueryRunner();
    await setSession(qrB, tenantB);
    await qrB.query(`INSERT INTO booking_rooms (tenant_id, name) VALUES ($1, 'Salle-TB');`, [tenantB]);
    const rows: Array<{ name: string }> = await qrB.query(`SELECT name FROM booking_rooms;`);
    expect(rows).toEqual([{ name: 'Salle-TB' }]);
    await qrB.release();
  });

  it('tenant A ne peut pas inserer une salle avec tenant_id de tenant B', async () => {
    const qr = ds.createQueryRunner();
    await setSession(qr, tenantA);
    await expect(
      qr.query(`INSERT INTO booking_rooms (tenant_id, name) VALUES ($1, 'Hack');`, [tenantB]),
    ).rejects.toThrow(/row-level security|policy/i);
    await qr.release();
  });

  it('tenant A ne peut pas UPDATE une salle de tenant B (0 lignes)', async () => {
    const qrB = ds.createQueryRunner();
    await setSession(qrB, tenantB);
    const inserted: Array<{ id: string }> = await qrB.query(
      `INSERT INTO booking_rooms (tenant_id, name) VALUES ($1, 'SB') RETURNING id;`,
      [tenantB],
    );
    await qrB.release();

    const qrA = ds.createQueryRunner();
    await setSession(qrA, tenantA);
    const result = await qrA.query(
      `UPDATE booking_rooms SET name = 'Hijacked' WHERE id = $1 RETURNING id;`,
      [inserted[0]?.id],
    ) as unknown[];
    expect(result).toHaveLength(0);
    await qrA.release();
  });

  it('SuperAdmin voit les salles de tous les tenants', async () => {
    const qrA = ds.createQueryRunner();
    await setSession(qrA, tenantA);
    await qrA.query(`INSERT INTO booking_rooms (tenant_id, name) VALUES ($1, 'Admin-Room');`, [tenantA]);
    await qrA.release();

    const qrAdmin = ds.createQueryRunner();
    await setSession(qrAdmin, tenantB, true);
    const rows: Array<{ name: string }> = await qrAdmin.query(
      `SELECT name FROM booking_rooms WHERE tenant_id = $1;`,
      [tenantA],
    );
    expect(rows.length).toBeGreaterThanOrEqual(1);
    await qrAdmin.release();
  });

  it('FORCE RLS actif sur booking_rooms', async () => {
    const [row]: Array<{ relforcerowsecurity: boolean }> = await ds.query(
      `SELECT relforcerowsecurity FROM pg_class WHERE relname = 'booking_rooms';`,
    );
    expect(row?.relforcerowsecurity).toBe(true);
  });
});
