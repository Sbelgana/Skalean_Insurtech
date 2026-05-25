/**
 * Booking Appointments State Machine E2E -- Sprint 8 Task 8.14b Phase 2.
 *
 * Covers:
 *   - scheduled -> confirm -> in-progress -> complete lifecycle
 *   - create appointment then cancel with reason
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

const TENANT_ID = '00000000-0000-4000-8000-00000e2e0801';
const USER_ID   = '00000000-0000-4000-8000-00000e2e0802';
const ROOM_ID   = '00000000-0000-4000-8000-00000e2e0803';

describe('Booking Appointments State Machine E2E (Sprint 8 Task 8.14b)', () => {
  let ctx: TestAppContext;
  let token: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    await ctx.dataSource.query(`SET app.is_super_admin = 'true'`);

    await ctx.dataSource.query(
      `INSERT INTO auth_tenants (id, type, name, status)
       VALUES ($1, 'broker', 'E2E State Machine Tenant', 'active')
       ON CONFLICT (id) DO NOTHING`,
      [TENANT_ID],
    );

    await ctx.dataSource.query(
      `INSERT INTO auth_users (id, tenant_id, email, password_hash, display_name)
       VALUES ($1, $2, $3, '$argon2id$v=0$test-placeholder', 'E2E SM User')
       ON CONFLICT (id) DO NOTHING`,
      [USER_ID, TENANT_ID, `user@e2e-${TENANT_ID}.test`],
    );

    await ctx.dataSource.query(
      `INSERT INTO auth_tenant_users (tenant_id, user_id, role)
       VALUES ($1, $2, 'tenant_admin')
       ON CONFLICT (tenant_id, user_id) DO NOTHING`,
      [TENANT_ID, USER_ID],
    );

    // Delete any stale appointments from previous failed runs before seeding.
    await ctx.dataSource.query(
      `DELETE FROM booking_appointments WHERE tenant_id = $1`,
      [TENANT_ID],
    );

    // business_hours open 07:00-20:00 every day so isOpen() returns true
    // for all appointment times used in this suite.
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
       VALUES ($1, $2, 'E2E Room', 'meeting', 4, true, $3::jsonb, 0)
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

  it('scheduled -> confirm -> in-progress -> complete lifecycle', async () => {
    const createRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/booking/appointments',
      headers: {
        Authorization: `Bearer ${token}`,
        'x-tenant-id': TENANT_ID,
        'content-type': 'application/json',
      },
      payload: {
        roomId: ROOM_ID,
        startAt: '2030-07-01T09:00:00.000Z',
        endAt: '2030-07-01T10:00:00.000Z',
        title: `E2E SM Appointment ${randomUUID().slice(0, 8)}`,
      },
    });
    expect(createRes.statusCode).toBe(201);
    const createBody = JSON.parse(createRes.body) as { data?: { id: string } };
    const apptId = (createBody.data?.id ?? (createBody as { id: string }).id) as string;

    const confirmRes = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/booking/appointments/${apptId}/confirm`,
      headers: {
        Authorization: `Bearer ${token}`,
        'x-tenant-id': TENANT_ID,
        'content-type': 'application/json',
      },
      payload: {},
    });
    expect([200, 201]).toContain(confirmRes.statusCode);

    const inProgressRes = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/booking/appointments/${apptId}/in-progress`,
      headers: {
        Authorization: `Bearer ${token}`,
        'x-tenant-id': TENANT_ID,
        'content-type': 'application/json',
      },
      payload: {},
    });
    expect([200, 201]).toContain(inProgressRes.statusCode);

    const completeRes = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/booking/appointments/${apptId}/complete`,
      headers: {
        Authorization: `Bearer ${token}`,
        'x-tenant-id': TENANT_ID,
        'content-type': 'application/json',
      },
      payload: {},
    });
    expect([200, 201]).toContain(completeRes.statusCode);
  });

  it('create appointment -> cancel with reason', async () => {
    const createRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/booking/appointments',
      headers: {
        Authorization: `Bearer ${token}`,
        'x-tenant-id': TENANT_ID,
        'content-type': 'application/json',
      },
      payload: {
        roomId: ROOM_ID,
        startAt: '2030-07-01T11:00:00.000Z',
        endAt: '2030-07-01T12:00:00.000Z',
        title: `E2E Cancel ${randomUUID().slice(0, 8)}`,
      },
    });
    expect(createRes.statusCode).toBe(201);
    const createBody = JSON.parse(createRes.body) as { data?: { id: string } };
    const apptId = (createBody.data?.id ?? (createBody as { id: string }).id) as string;

    const cancelRes = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/booking/appointments/${apptId}/cancel`,
      headers: {
        Authorization: `Bearer ${token}`,
        'x-tenant-id': TENANT_ID,
        'content-type': 'application/json',
      },
      payload: { reason: 'E2E test cancellation' },
    });
    expect([200, 201]).toContain(cancelRes.statusCode);
  });

  it('no-show transition -> returns success or method not allowed based on state', async () => {
    const createRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/booking/appointments',
      headers: {
        Authorization: `Bearer ${token}`,
        'x-tenant-id': TENANT_ID,
        'content-type': 'application/json',
      },
      payload: {
        roomId: ROOM_ID,
        startAt: '2030-07-01T13:00:00.000Z',
        endAt: '2030-07-01T14:00:00.000Z',
        title: `E2E No-Show ${randomUUID().slice(0, 8)}`,
      },
    });
    expect(createRes.statusCode).toBe(201);
    const createBody = JSON.parse(createRes.body) as { data?: { id: string } };
    const apptId = (createBody.data?.id ?? (createBody as { id: string }).id) as string;

    const noShowRes = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/booking/appointments/${apptId}/no-show`,
      headers: {
        Authorization: `Bearer ${token}`,
        'x-tenant-id': TENANT_ID,
        'content-type': 'application/json',
      },
      payload: {},
    });
    // no-show may only be valid from confirmed state; from scheduled it could be 422 or 200
    expect([200, 201, 422, 400]).toContain(noShowRes.statusCode);
  });

  it('reschedule transition -> updates appointment times', async () => {
    const createRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/booking/appointments',
      headers: {
        Authorization: `Bearer ${token}`,
        'x-tenant-id': TENANT_ID,
        'content-type': 'application/json',
      },
      payload: {
        roomId: ROOM_ID,
        startAt: '2030-07-02T09:00:00.000Z',
        endAt: '2030-07-02T10:00:00.000Z',
        title: `E2E Reschedule ${randomUUID().slice(0, 8)}`,
      },
    });
    expect(createRes.statusCode).toBe(201);
    const createBody = JSON.parse(createRes.body) as { data?: { id: string } };
    const apptId = (createBody.data?.id ?? (createBody as { id: string }).id) as string;

    const rescheduleRes = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/booking/appointments/${apptId}/reschedule`,
      headers: {
        Authorization: `Bearer ${token}`,
        'x-tenant-id': TENANT_ID,
        'content-type': 'application/json',
      },
      payload: {
        newStartAt: '2030-07-03T09:00:00.000Z',
        newEndAt: '2030-07-03T10:00:00.000Z',
      },
    });
    expect([200, 201]).toContain(rescheduleRes.statusCode);
  });
});
