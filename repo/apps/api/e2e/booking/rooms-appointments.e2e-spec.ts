/**
 * Booking Rooms + Appointments E2E -- Sprint 8 Task 8.14b Phase 2.
 *
 * Covers:
 *   - create room -> 201
 *   - create appointment in that room -> 201
 *   - create overlapping appointment -> 409 (GIST exclusion)
 *   - GET room -> 200
 *   - DELETE room (soft-delete) -> 200 or 204
 */

import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { JwtService } from '@insurtech/auth';
import {
  closeTestApp,
  createTestApp,
  type TestAppContext,
} from '../setup/test-app.factory.js';
import { createBrokerAdminToken } from '../setup/auth-helper.js';

const TENANT_ID = '00000000-0000-4000-8000-00000e2e0701';
const USER_ID   = '00000000-0000-4000-8000-00000e2e0702';

describe('Booking Rooms + Appointments E2E (Sprint 8 Task 8.14b)', () => {
  let ctx: TestAppContext;
  let token: string;
  let roomId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    await ctx.dataSource.query(`SET app.is_super_admin = 'true'`);

    await ctx.dataSource.query(
      `INSERT INTO auth_tenants (id, type, name, status)
       VALUES ($1, 'broker', 'E2E Rooms Tenant', 'active')
       ON CONFLICT (id) DO NOTHING`,
      [TENANT_ID],
    );

    await ctx.dataSource.query(
      `INSERT INTO auth_users (id, tenant_id, email, password_hash, display_name)
       VALUES ($1, $2, $3, '$argon2id$v=0$test-placeholder', 'E2E Rooms User')
       ON CONFLICT (id) DO NOTHING`,
      [USER_ID, TENANT_ID, `user@e2e-${TENANT_ID}.test`],
    );

    await ctx.dataSource.query(
      `INSERT INTO auth_tenant_users (tenant_id, user_id, role)
       VALUES ($1, $2, 'tenant_admin')
       ON CONFLICT (tenant_id, user_id) DO NOTHING`,
      [TENANT_ID, USER_ID],
    );

    // Clean up stale appointments from previous failed runs.
    await ctx.dataSource.query(
      `DELETE FROM booking_appointments WHERE tenant_id = $1`,
      [TENANT_ID],
    );
    await ctx.dataSource.query(
      `DELETE FROM booking_rooms WHERE tenant_id = $1`,
      [TENANT_ID],
    );

    const jwtService = ctx.app.get(JwtService);
    token = createBrokerAdminToken(jwtService, TENANT_ID, { userId: USER_ID });
  });

  afterAll(async () => {
    if (ctx?.dataSource?.isInitialized) {
      await ctx.dataSource.query(`SET app.is_super_admin = 'true'`);
      await ctx.dataSource.query(
        `DELETE FROM booking_appointments WHERE tenant_id = $1`,
        [TENANT_ID],
      );
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

  it('POST /api/v1/booking/rooms -> 201 creates a room', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/booking/rooms',
      headers: {
        Authorization: `Bearer ${token}`,
        'x-tenant-id': TENANT_ID,
        'content-type': 'application/json',
      },
      payload: {
        name: `E2E Room ${randomUUID().slice(0, 8)}`,
        roomType: 'meeting',
        capacity: 4,
        // Open all day every day so isOpen() passes for any appointment time.
        businessHours: {
          monday: { open: '07:00', close: '20:00', closed: false },
          tuesday: { open: '07:00', close: '20:00', closed: false },
          wednesday: { open: '07:00', close: '20:00', closed: false },
          thursday: { open: '07:00', close: '20:00', closed: false },
          friday: { open: '07:00', close: '20:00', closed: false },
          saturday: { open: '07:00', close: '20:00', closed: false },
          sunday: { open: '07:00', close: '20:00', closed: false },
        },
        bufferMinutes: 0,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body) as { data?: { id?: string } };
    const room = body.data ?? (body as { id?: string });
    expect(room.id).toBeDefined();
    roomId = room.id as string;
  });

  it('POST /api/v1/booking/appointments -> 201 creates appointment in the room', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/booking/appointments',
      headers: {
        Authorization: `Bearer ${token}`,
        'x-tenant-id': TENANT_ID,
        'content-type': 'application/json',
      },
      payload: {
        roomId,
        startAt: '2030-06-01T10:00:00.000Z',
        endAt: '2030-06-01T11:00:00.000Z',
        title: `E2E Appointment ${randomUUID().slice(0, 8)}`,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body) as { data?: { id?: string } };
    const appointment = body.data ?? (body as { id?: string });
    expect(appointment.id).toBeDefined();
  });

  it('POST overlapping appointment -> 409 conflict', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/booking/appointments',
      headers: {
        Authorization: `Bearer ${token}`,
        'x-tenant-id': TENANT_ID,
        'content-type': 'application/json',
      },
      payload: {
        roomId,
        startAt: '2030-06-01T10:30:00.000Z',
        endAt: '2030-06-01T11:30:00.000Z',
        title: `E2E Overlap ${randomUUID().slice(0, 8)}`,
      },
    });

    expect(res.statusCode).toBe(409);
  });

  it('GET /api/v1/booking/rooms/:id -> 200 returns the room', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: `/api/v1/booking/rooms/${roomId}`,
      headers: {
        Authorization: `Bearer ${token}`,
        'x-tenant-id': TENANT_ID,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { data?: { id?: string } };
    const room = body.data ?? (body as { id?: string });
    expect(room.id).toBe(roomId);
  });

  it('DELETE /api/v1/booking/rooms/:id -> 200 or 204 soft-deletes the room', async () => {
    const res = await ctx.app.inject({
      method: 'DELETE',
      url: `/api/v1/booking/rooms/${roomId}`,
      headers: {
        Authorization: `Bearer ${token}`,
        'x-tenant-id': TENANT_ID,
      },
    });

    expect([200, 204]).toContain(res.statusCode);
  });
});
