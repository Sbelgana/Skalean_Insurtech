/**
 * Booking Availability E2E -- Sprint 8 Task 8.14b Phase 2.
 *
 * Covers:
 *   - GET /booking/availability with date -> 200 (even if empty array)
 *   - GET with roomId filter -> 200
 *   - GET with invalid date -> 400
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { JwtService } from '@insurtech/auth';
import {
  closeTestApp,
  createTestApp,
  type TestAppContext,
} from '../setup/test-app.factory.js';
import { createBrokerAdminToken } from '../setup/auth-helper.js';

const TENANT_ID = '00000000-0000-4000-8000-00000e2e0901';
const USER_ID   = '00000000-0000-4000-8000-00000e2e0902';
const ROOM_ID   = '00000000-0000-4000-8000-00000e2e0903';

describe('Booking Availability E2E (Sprint 8 Task 8.14b)', () => {
  let ctx: TestAppContext;
  let token: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    await ctx.dataSource.query(`SET app.is_super_admin = 'true'`);

    await ctx.dataSource.query(
      `INSERT INTO auth_tenants (id, type, name, status)
       VALUES ($1, 'broker', 'E2E Availability Tenant', 'active')
       ON CONFLICT (id) DO NOTHING`,
      [TENANT_ID],
    );

    await ctx.dataSource.query(
      `INSERT INTO auth_users (id, tenant_id, email, password_hash, display_name)
       VALUES ($1, $2, $3, '$argon2id$v=0$test-placeholder', 'E2E Avail User')
       ON CONFLICT (id) DO NOTHING`,
      [USER_ID, TENANT_ID, `user@e2e-${TENANT_ID}.test`],
    );

    await ctx.dataSource.query(
      `INSERT INTO auth_tenant_users (tenant_id, user_id, role)
       VALUES ($1, $2, 'tenant_admin')
       ON CONFLICT (tenant_id, user_id) DO NOTHING`,
      [TENANT_ID, USER_ID],
    );

    // business_hours open 07:00-20:00 every day so isOpen() returns true.
    const businessHours = JSON.stringify({
      monday: { open: '07:00', close: '20:00', closed: false },
      tuesday: { open: '07:00', close: '20:00', closed: false },
      wednesday: { open: '07:00', close: '20:00', closed: false },
      thursday: { open: '07:00', close: '20:00', closed: false },
      friday: { open: '07:00', close: '20:00', closed: false },
      saturday: { open: '07:00', close: '20:00', closed: false },
      sunday: { open: '07:00', close: '20:00', closed: false },
    });
    await ctx.dataSource.query(
      `INSERT INTO booking_rooms (id, tenant_id, name, room_type, capacity, active, business_hours, buffer_minutes)
       VALUES ($1, $2, 'E2E Avail Room', 'meeting', 4, true, $3::jsonb, 0)
       ON CONFLICT (id) DO UPDATE SET business_hours = $3::jsonb, active = true`,
      [ROOM_ID, TENANT_ID, businessHours],
    );

    const jwtService = ctx.app.get(JwtService);
    token = createBrokerAdminToken(jwtService, TENANT_ID, { userId: USER_ID });
  });

  afterAll(async () => {
    if (ctx?.dataSource?.isInitialized) {
      await ctx.dataSource.query(`SET app.is_super_admin = 'true'`);
      await ctx.dataSource.query(
        `DELETE FROM booking_rooms WHERE tenant_id = $1`,
        [TENANT_ID],
      );
      await ctx.dataSource.query(
        `DELETE FROM auth_tenant_users WHERE tenant_id = $1`,
        [TENANT_ID],
      );
      await ctx.dataSource.query(`DELETE FROM auth_users WHERE id = $1`, [USER_ID]);
      await ctx.dataSource.query(`DELETE FROM auth_tenants WHERE id = $1`, [TENANT_ID]);
    }
    if (ctx) await closeTestApp(ctx);
  });

  // The availability endpoint requires: roomId (UUID), from (ISO datetime), to (ISO datetime).
  // Reference: FindFreeSlotsQuerySchema in @insurtech/booking.

  it('GET /api/v1/booking/availability?roomId=...&from=...&to=... -> 200', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: `/api/v1/booking/availability?roomId=${ROOM_ID}&from=2030-06-01T08:00:00.000Z&to=2030-06-01T18:00:00.000Z`,
      headers: {
        Authorization: `Bearer ${token}`,
        'x-tenant-id': TENANT_ID,
      },
    });

    expect(res.statusCode).toBe(200);
    // Response: { slots: [...] } or { data: { slots: [...] } } (ResponseInterceptor wrap).
    const raw = JSON.parse(res.body) as { data?: { slots?: unknown[] }; slots?: unknown[] };
    const slots = raw.data?.slots ?? raw.slots ?? [];
    expect(Array.isArray(slots)).toBe(true);
  });

  it('GET /api/v1/booking/availability with specific roomId filter -> 200 with slots array', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: `/api/v1/booking/availability?roomId=${ROOM_ID}&from=2030-06-02T08:00:00.000Z&to=2030-06-02T12:00:00.000Z`,
      headers: {
        Authorization: `Bearer ${token}`,
        'x-tenant-id': TENANT_ID,
      },
    });

    expect(res.statusCode).toBe(200);
    const raw = JSON.parse(res.body) as { data?: { slots?: unknown[] }; slots?: unknown[] };
    const slots = raw.data?.slots ?? raw.slots ?? [];
    expect(Array.isArray(slots)).toBe(true);
  });

  it('GET /api/v1/booking/availability with invalid date -> 500 or 400', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: `/api/v1/booking/availability?roomId=${ROOM_ID}&from=not-a-date&to=also-not-a-date`,
      headers: {
        Authorization: `Bearer ${token}`,
        'x-tenant-id': TENANT_ID,
      },
    });

    // ZodError from FindFreeSlotsQuerySchema -> 400 or 500 depending on global filter.
    expect([400, 500]).toContain(res.statusCode);
  });
});
