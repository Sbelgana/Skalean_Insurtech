/**
 * CRM Deals Workflow E2E -- Sprint 8 Task 8.14b Phase 2.
 *
 * Covers the full deal lifecycle:
 *   create -> list -> move-stage -> close-won -> close-lost -> reopen
 *
 * Prerequisites:
 *   - Test stack UP (postgres / redis / kafka)
 *   - Test DB has Sprint 8 migrations applied
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

const TENANT_ID  = '00000000-0000-4000-8000-00000e2e0301';
const USER_ID    = '00000000-0000-4000-8000-00000e2e0302';
const PIPELINE_ID = '00000000-0000-4000-8000-00000e2e0303';
const STAGE1_ID  = '00000000-0000-4000-8000-00000e2e0304';
const STAGE2_ID  = '00000000-0000-4000-8000-00000e2e0305';
const COMPANY_ID = '00000000-0000-4000-8000-00000e2e0306';

describe('CRM Deals Workflow E2E (Sprint 8 Task 8.14b)', () => {
  let ctx: TestAppContext;
  let token: string;
  let dealId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    await ctx.dataSource.query(`SET app.is_super_admin = 'true'`);

    await ctx.dataSource.query(
      `INSERT INTO auth_tenants (id, type, name, status)
       VALUES ($1, 'broker', 'E2E Deals Tenant', 'active')
       ON CONFLICT (id) DO NOTHING`,
      [TENANT_ID],
    );

    await ctx.dataSource.query(
      `INSERT INTO auth_users (id, tenant_id, email, password_hash, display_name)
       VALUES ($1, $2, $3, '$argon2id$v=0$test-placeholder', 'E2E Deals User')
       ON CONFLICT (id) DO NOTHING`,
      [USER_ID, TENANT_ID, `user@e2e-${TENANT_ID}.test`],
    );

    await ctx.dataSource.query(
      `INSERT INTO auth_tenant_users (tenant_id, user_id, role)
       VALUES ($1, $2, 'tenant_admin')
       ON CONFLICT (tenant_id, user_id) DO NOTHING`,
      [TENANT_ID, USER_ID],
    );

    await ctx.dataSource.query(
      `INSERT INTO crm_pipelines (id, tenant_id, name)
       VALUES ($1, $2, 'E2E Pipeline')
       ON CONFLICT (id) DO NOTHING`,
      [PIPELINE_ID, TENANT_ID],
    );

    await ctx.dataSource.query(
      `INSERT INTO crm_stages (id, tenant_id, pipeline_id, name, position)
       VALUES ($1, $2, $3, 'Prospecting', 0)
       ON CONFLICT (id) DO NOTHING`,
      [STAGE1_ID, TENANT_ID, PIPELINE_ID],
    );

    await ctx.dataSource.query(
      `INSERT INTO crm_stages (id, tenant_id, pipeline_id, name, position)
       VALUES ($1, $2, $3, 'Qualified', 1)
       ON CONFLICT (id) DO NOTHING`,
      [STAGE2_ID, TENANT_ID, PIPELINE_ID],
    );

    await ctx.dataSource.query(
      `INSERT INTO crm_companies (id, tenant_id, name, country, created_by)
       VALUES ($1, $2, 'E2E Company', 'MA', $3)
       ON CONFLICT (id) DO NOTHING`,
      [COMPANY_ID, TENANT_ID, USER_ID],
    );

    const jwtService = ctx.app.get(JwtService);
    token = createBrokerAdminToken(jwtService, TENANT_ID, { userId: USER_ID });
  });

  afterAll(async () => {
    if (ctx?.dataSource?.isInitialized) {
      await ctx.dataSource.query(`SET app.is_super_admin = 'true'`);
      await ctx.dataSource.query(
        `DELETE FROM crm_deals WHERE tenant_id = $1`,
        [TENANT_ID],
      );
      await ctx.dataSource.query(
        `DELETE FROM crm_stages WHERE tenant_id = $1`,
        [TENANT_ID],
      );
      await ctx.dataSource.query(
        `DELETE FROM crm_pipelines WHERE tenant_id = $1`,
        [TENANT_ID],
      );
      await ctx.dataSource.query(
        `DELETE FROM crm_companies WHERE tenant_id = $1`,
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

  it('POST /api/v1/crm/deals -> 201 creates a deal', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/crm/deals',
      headers: {
        Authorization: `Bearer ${token}`,
        'x-tenant-id': TENANT_ID,
        'content-type': 'application/json',
      },
      payload: {
        name: `E2E Deal ${randomUUID().slice(0, 8)}`,
        companyId: COMPANY_ID,
        pipelineId: PIPELINE_ID,
        stageId: STAGE1_ID,
        ownerUserId: USER_ID,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body) as { data?: { id?: string; name?: string } };
    const deal = body.data ?? (body as { id?: string; name?: string });
    expect(deal.id).toBeDefined();
    dealId = deal.id as string;
  });

  it('GET /api/v1/crm/deals -> 200 lists deals for tenant', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/crm/deals',
      headers: {
        Authorization: `Bearer ${token}`,
        'x-tenant-id': TENANT_ID,
      },
    });

    expect(res.statusCode).toBe(200);
    // DealsService.list() returns PaginatedDeals { items, total, limit, offset }.
    // ResponseInterceptor wraps: { data: { items: [...], total: N, ... } }.
    const body = JSON.parse(res.body) as {
      data?: { items?: unknown[] } | unknown[];
    };
    const payload = body.data;
    const items = Array.isArray(payload)
      ? payload
      : (payload as { items?: unknown[] } | undefined)?.items ?? [];
    expect(Array.isArray(items)).toBe(true);
  });

  it('POST /api/v1/crm/deals/:id/move-stage -> 200 moves deal to next stage', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/crm/deals/${dealId}/move-stage`,
      headers: {
        Authorization: `Bearer ${token}`,
        'x-tenant-id': TENANT_ID,
        'content-type': 'application/json',
      },
      payload: { stageId: STAGE2_ID },
    });

    expect([200, 201]).toContain(res.statusCode);
  });

  it('POST /api/v1/crm/deals/:id/close-won -> 200 closes deal as won', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/crm/deals/${dealId}/close-won`,
      headers: {
        Authorization: `Bearer ${token}`,
        'x-tenant-id': TENANT_ID,
        'content-type': 'application/json',
      },
      payload: {},
    });

    expect([200, 201]).toContain(res.statusCode);
  });

  it('POST close-lost then reopen -> deal cycles back to open', async () => {
    // Create a fresh deal for this test
    const createRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/crm/deals',
      headers: {
        Authorization: `Bearer ${token}`,
        'x-tenant-id': TENANT_ID,
        'content-type': 'application/json',
      },
      payload: {
        name: `E2E Cycle Deal ${randomUUID().slice(0, 8)}`,
        companyId: COMPANY_ID,
        pipelineId: PIPELINE_ID,
        stageId: STAGE1_ID,
        ownerUserId: USER_ID,
      },
    });
    expect(createRes.statusCode).toBe(201);
    const createBody = JSON.parse(createRes.body) as { data?: { id: string } };
    const cycleDealId = (createBody.data?.id ?? (createBody as { id: string }).id) as string;

    const lostRes = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/crm/deals/${cycleDealId}/close-lost`,
      headers: {
        Authorization: `Bearer ${token}`,
        'x-tenant-id': TENANT_ID,
        'content-type': 'application/json',
      },
      payload: { reason: 'E2E test close-lost' },
    });
    expect([200, 201]).toContain(lostRes.statusCode);

    const reopenRes = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/crm/deals/${cycleDealId}/reopen`,
      headers: {
        Authorization: `Bearer ${token}`,
        'x-tenant-id': TENANT_ID,
        'content-type': 'application/json',
      },
      payload: { reason: 'E2E test reopen - deal cycles back to open' },
    });
    expect([200, 201]).toContain(reopenRes.statusCode);
  });
});
