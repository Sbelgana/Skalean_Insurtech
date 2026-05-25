/**
 * Calendar Sync E2E -- Sprint 8 Task 8.14b Phase 2.
 *
 * Tests that do not require real OAuth credentials run unconditionally.
 * Tests requiring real Google/Outlook OAuth tokens are skipped unless
 * real credentials are configured (GOOGLE_CLIENT_ID !== placeholder).
 *
 * Covers (conditional on real credentials):
 *   - GET /booking/calendar/webhook/health -> 200
 *   - GET /booking/calendar/connections -> 200 array
 *   - Remaining OAuth flow tests require interactive OAuth tokens (skipped)
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { JwtService } from '@insurtech/auth';
import {
  closeTestApp,
  createTestApp,
  type TestAppContext,
} from '../setup/test-app.factory.js';
import { createBrokerAdminToken } from '../setup/auth-helper.js';

const TENANT_ID = '00000000-0000-4000-8000-00000e2e1101';
const USER_ID   = '00000000-0000-4000-8000-00000e2e1102';

const isOAuthConfigured =
  typeof process.env['GOOGLE_CLIENT_ID'] === 'string' &&
  process.env['GOOGLE_CLIENT_ID'] !== 'PLACEHOLDER_GOOGLE_CLIENT_ID' &&
  process.env['GOOGLE_CLIENT_ID'].length > 0;

describe('Calendar Sync E2E (Sprint 8 Task 8.14b)', () => {
  let ctx: TestAppContext;
  let token: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    await ctx.dataSource.query(`SET app.is_super_admin = 'true'`);

    await ctx.dataSource.query(
      `INSERT INTO auth_tenants (id, type, name, status)
       VALUES ($1, 'broker', 'E2E CalSync Tenant', 'active')
       ON CONFLICT (id) DO NOTHING`,
      [TENANT_ID],
    );

    await ctx.dataSource.query(
      `INSERT INTO auth_users (id, tenant_id, email, password_hash, display_name)
       VALUES ($1, $2, $3, '$argon2id$v=0$test-placeholder', 'E2E CalSync User')
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
        `DELETE FROM auth_tenant_users WHERE tenant_id = $1`,
        [TENANT_ID],
      );
      await ctx.dataSource.query(`DELETE FROM auth_users WHERE id = $1`, [USER_ID]);
      await ctx.dataSource.query(`DELETE FROM auth_tenants WHERE id = $1`, [TENANT_ID]);
    }
    if (ctx) await closeTestApp(ctx);
  });

  describe.skipIf(!isOAuthConfigured)('Calendar Sync (requires real OAuth credentials)', () => {
    it('GET /api/v1/booking/calendar/webhook/health -> 200', async () => {
      const res = await ctx.app.inject({
        method: 'GET',
        url: '/api/v1/booking/calendar/webhook/health',
        headers: {
          Authorization: `Bearer ${token}`,
          'x-tenant-id': TENANT_ID,
        },
      });
      expect(res.statusCode).toBe(200);
    });

    it('GET /api/v1/booking/calendar/connections -> 200 array', async () => {
      const res = await ctx.app.inject({
        method: 'GET',
        url: '/api/v1/booking/calendar/connections',
        headers: {
          Authorization: `Bearer ${token}`,
          'x-tenant-id': TENANT_ID,
        },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body) as { data?: unknown[] };
      const items = body.data ?? (body as unknown[]);
      expect(Array.isArray(items)).toBe(true);
    });

    // The following tests require real OAuth tokens obtained via browser redirect.
    // They cannot be automated without user interaction and are skipped here.
    // To run manually: complete OAuth flow and inject real access tokens.
    describe.skip('OAuth flow tests (require interactive browser OAuth)', () => {
      it('GET /api/v1/booking/calendar/google/auth-url -> returns redirect URL', () => {
        // Requires real GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET
      });

      it('GET /api/v1/booking/calendar/outlook/auth-url -> returns redirect URL', () => {
        // Requires real OUTLOOK_CLIENT_ID and OUTLOOK_CLIENT_SECRET
      });

      it('POST /api/v1/booking/calendar/google/callback -> exchanges code for tokens', () => {
        // Requires real OAuth authorization code from Google
      });

      it('POST /api/v1/booking/calendar/outlook/callback -> exchanges code for tokens', () => {
        // Requires real OAuth authorization code from Microsoft
      });

      it('GET /api/v1/booking/calendar/sync-status -> returns sync status', () => {
        // Requires connected OAuth account
      });

      it('POST /api/v1/booking/calendar/sync -> triggers manual sync', () => {
        // Requires connected OAuth account
      });

      it('DELETE /api/v1/booking/calendar/connections/:id -> disconnects calendar', () => {
        // Requires connected OAuth account
      });

      it('Webhook payload from Google -> processes event upsert', () => {
        // Requires valid Google webhook signature and channel setup
      });
    });
  });

  // Unconditional test: health check returns 200 or 503 (when OAuth not configured)
  it('GET /api/v1/booking/calendar/webhook/health -> returns 200 or 503', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/booking/calendar/webhook/health',
      headers: {
        Authorization: `Bearer ${token}`,
        'x-tenant-id': TENANT_ID,
      },
    });
    // 200 when OAuth configured, 503 when placeholders are set (design decision)
    expect([200, 503]).toContain(res.statusCode);
  });
});
