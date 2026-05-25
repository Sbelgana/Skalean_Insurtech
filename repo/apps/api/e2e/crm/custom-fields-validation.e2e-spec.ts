/**
 * CRM Custom Fields Validation E2E -- Sprint 8 Task 8.14b Phase 2.
 *
 * Covers:
 *   - create a custom field for companies
 *   - list custom fields and verify the field appears
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

const TENANT_ID = '00000000-0000-4000-8000-00000e2e0601';
const USER_ID   = '00000000-0000-4000-8000-00000e2e0602';

describe('CRM Custom Fields Validation E2E (Sprint 8 Task 8.14b)', () => {
  let ctx: TestAppContext;
  let token: string;
  let customFieldId: string;
  let fieldSlug: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    await ctx.dataSource.query(`SET app.is_super_admin = 'true'`);

    await ctx.dataSource.query(
      `INSERT INTO auth_tenants (id, type, name, status)
       VALUES ($1, 'broker', 'E2E Custom Fields Tenant', 'active')
       ON CONFLICT (id) DO NOTHING`,
      [TENANT_ID],
    );

    await ctx.dataSource.query(
      `INSERT INTO auth_users (id, tenant_id, email, password_hash, display_name)
       VALUES ($1, $2, $3, '$argon2id$v=0$test-placeholder', 'E2E CF User')
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

    // Generate a unique key to avoid conflicts across test runs
    fieldSlug = `e2e_field_${randomUUID().replace(/-/g, '').slice(0, 10)}`;
  });

  afterAll(async () => {
    if (ctx?.dataSource?.isInitialized) {
      await ctx.dataSource.query(`SET app.is_super_admin = 'true'`);
      await ctx.dataSource.query(
        `DELETE FROM crm_custom_field_definitions WHERE tenant_id = $1`,
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

  it('POST /api/v1/crm/custom-fields -> 201 creates a custom field', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/crm/custom-fields',
      headers: {
        Authorization: `Bearer ${token}`,
        'x-tenant-id': TENANT_ID,
        'content-type': 'application/json',
      },
      payload: {
        entityType: 'company',
        fieldKey: fieldSlug,
        fieldLabel: 'E2E Custom Field',
        fieldType: 'string',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body) as { data?: { id?: string; fieldKey?: string } };
    const field = body.data ?? (body as { id?: string; fieldKey?: string });
    expect(field.id).toBeDefined();
    expect(field.fieldKey).toBe(fieldSlug);
    customFieldId = field.id as string;
  });

  it('GET /api/v1/crm/custom-fields/:id -> 200 returns the created field', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: `/api/v1/crm/custom-fields/${customFieldId}`,
      headers: {
        Authorization: `Bearer ${token}`,
        'x-tenant-id': TENANT_ID,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { data?: { id?: string; entityType?: string } };
    const field = body.data ?? (body as { id?: string; entityType?: string });
    expect(field.id).toBe(customFieldId);
    expect(field.entityType).toBe('company');
  });
});
