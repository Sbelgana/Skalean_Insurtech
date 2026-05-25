/**
 * Multi-Tenant Isolation E2E -- Sprint 8 Task 8.14b Phase 2.
 *
 * Proves that tenant data cannot cross boundaries:
 *   - Tenant A creates company, Tenant B cannot see it (404 or empty list)
 *   - Tenant B cannot delete Tenant A company (404 or 403)
 *   - Tenant A room not visible to Tenant B
 *   - JWT with wrong tenant_id in x-tenant-id header -> 403 or 400
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

const TENANT_A_ID = '00000000-0000-4000-8000-00000e2e1201';
const USER_A_ID   = '00000000-0000-4000-8000-00000e2e1202';
const TENANT_B_ID = '00000000-0000-4000-8000-00000e2e1301';
const USER_B_ID   = '00000000-0000-4000-8000-00000e2e1302';
const ROOM_A_ID   = '00000000-0000-4000-8000-00000e2e1303';

describe('Multi-Tenant Isolation E2E (Sprint 8 Task 8.14b)', () => {
  let ctx: TestAppContext;
  let tokenA: string;
  let tokenB: string;
  let companyAId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    await ctx.dataSource.query(`SET app.is_super_admin = 'true'`);

    // Tenant A
    await ctx.dataSource.query(
      `INSERT INTO auth_tenants (id, type, name, status)
       VALUES ($1, 'broker', 'E2E Tenant Alpha', 'active')
       ON CONFLICT (id) DO NOTHING`,
      [TENANT_A_ID],
    );
    await ctx.dataSource.query(
      `INSERT INTO auth_users (id, tenant_id, email, password_hash, display_name)
       VALUES ($1, $2, $3, '$argon2id$v=0$test-placeholder', 'E2E User Alpha')
       ON CONFLICT (id) DO NOTHING`,
      [USER_A_ID, TENANT_A_ID, `user@e2e-${TENANT_A_ID}.test`],
    );
    await ctx.dataSource.query(
      `INSERT INTO auth_tenant_users (tenant_id, user_id, role)
       VALUES ($1, $2, 'tenant_admin')
       ON CONFLICT (tenant_id, user_id) DO NOTHING`,
      [TENANT_A_ID, USER_A_ID],
    );

    // Tenant B
    await ctx.dataSource.query(
      `INSERT INTO auth_tenants (id, type, name, status)
       VALUES ($1, 'broker', 'E2E Tenant Beta', 'active')
       ON CONFLICT (id) DO NOTHING`,
      [TENANT_B_ID],
    );
    await ctx.dataSource.query(
      `INSERT INTO auth_users (id, tenant_id, email, password_hash, display_name)
       VALUES ($1, $2, $3, '$argon2id$v=0$test-placeholder', 'E2E User Beta')
       ON CONFLICT (id) DO NOTHING`,
      [USER_B_ID, TENANT_B_ID, `user@e2e-${TENANT_B_ID}.test`],
    );
    await ctx.dataSource.query(
      `INSERT INTO auth_tenant_users (tenant_id, user_id, role)
       VALUES ($1, $2, 'tenant_admin')
       ON CONFLICT (tenant_id, user_id) DO NOTHING`,
      [TENANT_B_ID, USER_B_ID],
    );

    // Seed a room belonging to Tenant A
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
       VALUES ($1, $2, 'Tenant A Room', 'meeting', 4, true, $3::jsonb, 0)
       ON CONFLICT (id) DO NOTHING`,
      [ROOM_A_ID, TENANT_A_ID, businessHours],
    );

    const jwtService = ctx.app.get(JwtService);
    tokenA = createBrokerAdminToken(jwtService, TENANT_A_ID, { userId: USER_A_ID });
    tokenB = createBrokerAdminToken(jwtService, TENANT_B_ID, { userId: USER_B_ID });
  });

  afterAll(async () => {
    if (ctx?.dataSource?.isInitialized) {
      await ctx.dataSource.query(`SET app.is_super_admin = 'true'`);
      await ctx.dataSource.query(
        `DELETE FROM booking_appointments WHERE tenant_id IN ($1, $2)`,
        [TENANT_A_ID, TENANT_B_ID],
      );
      await ctx.dataSource.query(
        `DELETE FROM booking_rooms WHERE tenant_id IN ($1, $2)`,
        [TENANT_A_ID, TENANT_B_ID],
      );
      await ctx.dataSource.query(
        `DELETE FROM crm_companies WHERE tenant_id IN ($1, $2)`,
        [TENANT_A_ID, TENANT_B_ID],
      );
      await ctx.dataSource.query(
        `DELETE FROM auth_tenant_users WHERE tenant_id IN ($1, $2)`,
        [TENANT_A_ID, TENANT_B_ID],
      );
      await ctx.dataSource.query(
        `DELETE FROM auth_users WHERE id IN ($1, $2)`,
        [USER_A_ID, USER_B_ID],
      );
      await ctx.dataSource.query(
        `DELETE FROM auth_tenants WHERE id IN ($1, $2)`,
        [TENANT_A_ID, TENANT_B_ID],
      );
    }
    if (ctx) await closeTestApp(ctx);
  });

  it('Tenant A creates company; Tenant B GET by ID returns 404 or empty', async () => {
    const createRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/crm/companies',
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'x-tenant-id': TENANT_A_ID,
        'content-type': 'application/json',
      },
      payload: {
        name: `TenantA Company ${randomUUID().slice(0, 8)}`,
        country: 'MA',
      },
    });
    expect(createRes.statusCode).toBe(201);
    const createBody = JSON.parse(createRes.body) as { data?: { id: string } };
    companyAId = (createBody.data?.id ?? (createBody as { id: string }).id) as string;

    // Tenant B attempts to read Tenant A company
    const readRes = await ctx.app.inject({
      method: 'GET',
      url: `/api/v1/crm/companies/${companyAId}`,
      headers: {
        Authorization: `Bearer ${tokenB}`,
        'x-tenant-id': TENANT_B_ID,
      },
    });
    expect([403, 404]).toContain(readRes.statusCode);
  });

  it('Tenant B cannot delete Tenant A company -> 403 or 404', async () => {
    const deleteRes = await ctx.app.inject({
      method: 'DELETE',
      url: `/api/v1/crm/companies/${companyAId}`,
      headers: {
        Authorization: `Bearer ${tokenB}`,
        'x-tenant-id': TENANT_B_ID,
      },
    });
    expect([403, 404]).toContain(deleteRes.statusCode);

    // Verify the company still exists for Tenant A
    const verifyRes = await ctx.app.inject({
      method: 'GET',
      url: `/api/v1/crm/companies/${companyAId}`,
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'x-tenant-id': TENANT_A_ID,
      },
    });
    expect(verifyRes.statusCode).toBe(200);
  });

  it('Tenant A room is not visible to Tenant B', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: `/api/v1/booking/rooms/${ROOM_A_ID}`,
      headers: {
        Authorization: `Bearer ${tokenB}`,
        'x-tenant-id': TENANT_B_ID,
      },
    });
    expect([403, 404]).toContain(res.statusCode);
  });

  it('JWT tenant_id != x-tenant-id header -> 403 or 400', async () => {
    // Token issued for Tenant A but header says Tenant B
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/crm/companies',
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'x-tenant-id': TENANT_B_ID,
      },
    });
    // The guard must reject when JWT tenant differs from header tenant
    expect([400, 403, 401]).toContain(res.statusCode);
  });

  it('Tenant B list companies only returns Tenant B data', async () => {
    // Create a company for Tenant B
    const createBRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/crm/companies',
      headers: {
        Authorization: `Bearer ${tokenB}`,
        'x-tenant-id': TENANT_B_ID,
        'content-type': 'application/json',
      },
      payload: {
        name: `TenantB Company ${randomUUID().slice(0, 8)}`,
        country: 'MA',
      },
    });
    expect(createBRes.statusCode).toBe(201);

    // Tenant B list should not contain Tenant A company
    const listRes = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/crm/companies',
      headers: {
        Authorization: `Bearer ${tokenB}`,
        'x-tenant-id': TENANT_B_ID,
      },
    });
    expect(listRes.statusCode).toBe(200);
    const listBody = JSON.parse(listRes.body) as { data?: Array<{ id: string }> };
    const items = (listBody.data ?? listBody) as Array<{ id: string }>;
    if (Array.isArray(items)) {
      const ids = items.map((c) => c.id);
      expect(ids).not.toContain(companyAId);
    }
  });
});
