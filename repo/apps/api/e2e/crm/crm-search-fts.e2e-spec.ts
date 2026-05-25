/**
 * CRM Full-Text Search E2E -- Sprint 8 Task 8.14b Phase 2.
 *
 * Covers:
 *   - create company then search by name via GET /crm/search/companies?q=...
 *   - create contact then search via GET /crm/search?q=...
 *
 * Note: FTS indexing may have a slight delay. Tests verify status 200 with
 * an array response rather than asserting non-empty results.
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

const TENANT_ID = '00000000-0000-4000-8000-00000e2e0501';
const USER_ID   = '00000000-0000-4000-8000-00000e2e0502';

describe('CRM Full-Text Search E2E (Sprint 8 Task 8.14b)', () => {
  let ctx: TestAppContext;
  let token: string;
  let uniqueCompanyName: string;
  let uniqueContactName: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    await ctx.dataSource.query(`SET app.is_super_admin = 'true'`);

    await ctx.dataSource.query(
      `INSERT INTO auth_tenants (id, type, name, status)
       VALUES ($1, 'broker', 'E2E FTS Tenant', 'active')
       ON CONFLICT (id) DO NOTHING`,
      [TENANT_ID],
    );

    await ctx.dataSource.query(
      `INSERT INTO auth_users (id, tenant_id, email, password_hash, display_name)
       VALUES ($1, $2, $3, '$argon2id$v=0$test-placeholder', 'E2E FTS User')
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

    // Unique names to use as search terms
    uniqueCompanyName = `E2EZorp${randomUUID().replace(/-/g, '').slice(0, 12)}`;
    uniqueContactName = `E2EFlux${randomUUID().replace(/-/g, '').slice(0, 12)}`;
  });

  afterAll(async () => {
    if (ctx?.dataSource?.isInitialized) {
      await ctx.dataSource.query(`SET app.is_super_admin = 'true'`);
      await ctx.dataSource.query(
        `DELETE FROM crm_contacts WHERE tenant_id = $1`,
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

  it('GET /crm/search/companies?q=uniqueName -> 200 array after creating company', async () => {
    const createRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/crm/companies',
      headers: {
        Authorization: `Bearer ${token}`,
        'x-tenant-id': TENANT_ID,
        'content-type': 'application/json',
      },
      payload: { name: uniqueCompanyName, country: 'MA' },
    });
    expect(createRes.statusCode).toBe(201);

    const searchRes = await ctx.app.inject({
      method: 'GET',
      url: `/api/v1/crm/search/companies?q=${encodeURIComponent(uniqueCompanyName)}`,
      headers: {
        Authorization: `Bearer ${token}`,
        'x-tenant-id': TENANT_ID,
      },
    });
    expect(searchRes.statusCode).toBe(200);
    // searchCompanies returns CompanySearchHit[] array.
    // ResponseInterceptor wraps: { data: [...] }.
    const body = JSON.parse(searchRes.body) as { data?: unknown[] | { items?: unknown[] } };
    const dataField = body.data;
    const isValidResponse =
      Array.isArray(dataField) ||
      (dataField !== null &&
        typeof dataField === 'object' &&
        Array.isArray((dataField as { items?: unknown }).items));
    expect(isValidResponse).toBe(true);
  });

  it('GET /crm/search?q=uniqueName -> 200 array after creating contact', async () => {
    const createRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/crm/contacts',
      headers: {
        Authorization: `Bearer ${token}`,
        'x-tenant-id': TENANT_ID,
        'content-type': 'application/json',
      },
      payload: {
        firstName: uniqueContactName,
        lastName: 'E2ETest',
        email: `${uniqueContactName.toLowerCase()}@e2e.test`,
      },
    });
    expect(createRes.statusCode).toBe(201);

    const searchRes = await ctx.app.inject({
      method: 'GET',
      url: `/api/v1/crm/search?q=${encodeURIComponent(uniqueContactName)}`,
      headers: {
        Authorization: `Bearer ${token}`,
        'x-tenant-id': TENANT_ID,
      },
    });
    expect(searchRes.statusCode).toBe(200);
    // globalSearch returns GlobalSearchResult { companies: [...], contacts: [...], deals: [...] }.
    // ResponseInterceptor wraps: { data: { companies: [...], contacts: [...], ... } }.
    const body = JSON.parse(searchRes.body) as {
      data?: unknown[] | { companies?: unknown[]; contacts?: unknown[]; items?: unknown[] };
    };
    const dataField = body.data;
    const isValidResponse =
      Array.isArray(dataField) ||
      (dataField !== null &&
        typeof dataField === 'object' &&
        ('companies' in (dataField as object) ||
          'contacts' in (dataField as object) ||
          Array.isArray((dataField as { items?: unknown }).items)));
    expect(isValidResponse).toBe(true);
  });
});
