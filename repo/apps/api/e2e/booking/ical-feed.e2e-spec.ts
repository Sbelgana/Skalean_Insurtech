/**
 * Booking iCal Feed E2E -- Sprint 8 Task 8.14b Phase 2.
 *
 * Covers:
 *   - POST /booking/calendar/ical-tokens creates token -> 201
 *   - GET /booking/calendar/ical-tokens lists tokens -> 200 array
 *   - DELETE /booking/calendar/ical-tokens/:id -> 200 or 204
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { JwtService } from '@insurtech/auth';
import {
  closeTestApp,
  createTestApp,
  type TestAppContext,
} from '../setup/test-app.factory.js';
import { createBrokerAdminToken } from '../setup/auth-helper.js';

const TENANT_ID = '00000000-0000-4000-8000-00000e2e1001';
const USER_ID   = '00000000-0000-4000-8000-00000e2e1002';

describe('Booking iCal Feed E2E (Sprint 8 Task 8.14b)', () => {
  let ctx: TestAppContext;
  let token: string;
  let icalTokenId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    await ctx.dataSource.query(`SET app.is_super_admin = 'true'`);

    await ctx.dataSource.query(
      `INSERT INTO auth_tenants (id, type, name, status)
       VALUES ($1, 'broker', 'E2E iCal Tenant', 'active')
       ON CONFLICT (id) DO NOTHING`,
      [TENANT_ID],
    );

    await ctx.dataSource.query(
      `INSERT INTO auth_users (id, tenant_id, email, password_hash, display_name)
       VALUES ($1, $2, $3, '$argon2id$v=0$test-placeholder', 'E2E iCal User')
       ON CONFLICT (id) DO NOTHING`,
      [USER_ID, TENANT_ID, `user@e2e-${TENANT_ID}.test`],
    );

    await ctx.dataSource.query(
      `INSERT INTO auth_tenant_users (tenant_id, user_id, role)
       VALUES ($1, $2, 'tenant_admin')
       ON CONFLICT (tenant_id, user_id) DO NOTHING`,
      [TENANT_ID, USER_ID],
    );

    const jwtService = ctx.app.get(JwtService);
    token = createBrokerAdminToken(jwtService, TENANT_ID, { userId: USER_ID });
  });

  afterAll(async () => {
    if (ctx?.dataSource?.isInitialized) {
      await ctx.dataSource.query(`SET app.is_super_admin = 'true'`);
      await ctx.dataSource.query(
        `DELETE FROM booking_ical_tokens WHERE tenant_id = $1`,
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

  it('POST /api/v1/booking/calendar/ical-tokens -> 201 creates iCal token', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/booking/calendar/ical-tokens',
      headers: {
        Authorization: `Bearer ${token}`,
        'x-tenant-id': TENANT_ID,
        'content-type': 'application/json',
      },
      payload: {
        name: 'E2E iCal Token',
        scope: 'own',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body) as { data?: { id?: string; name?: string }; id?: string };
    const tokenId = body.data?.id ?? (body as { id?: string }).id;
    expect(tokenId).toBeDefined();
    icalTokenId = tokenId as string;
  });

  it('GET /api/v1/booking/calendar/ical-tokens -> 200 returns array of tokens', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/booking/calendar/ical-tokens',
      headers: {
        Authorization: `Bearer ${token}`,
        'x-tenant-id': TENANT_ID,
      },
    });

    expect(res.statusCode).toBe(200);
    // Controller returns { tokens: IcalTokenSummaryDto[] }.
    // ResponseInterceptor wraps: { success: true, data: { tokens: [...] }, meta: {...} }.
    const body = JSON.parse(res.body) as {
      data?: { tokens?: unknown[] } | unknown[];
      success?: boolean;
    };
    const payload = body.data;
    const items = Array.isArray(payload)
      ? payload
      : (payload as { tokens?: unknown[] } | undefined)?.tokens ?? [];
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThanOrEqual(1);
  });

  it('DELETE /api/v1/booking/calendar/ical-tokens/:id -> 200 or 204', async () => {
    const res = await ctx.app.inject({
      method: 'DELETE',
      url: `/api/v1/booking/calendar/ical-tokens/${icalTokenId}`,
      headers: {
        Authorization: `Bearer ${token}`,
        'x-tenant-id': TENANT_ID,
      },
    });

    expect([200, 204]).toContain(res.statusCode);
  });
});
