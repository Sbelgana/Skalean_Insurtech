/**
 * RLS super admin bypass tests -- runtime live.
 *
 * Verifie que set_config(app.is_super_admin, 'true', true) permet a la session
 * de voir tous les tenants via helper Sprint 1 app_can_access_tenant() Cond 1.
 *
 * Reference : Sprint 6 / Tache 2.2.12 + Pause #4.
 */

import { randomUUID } from 'node:crypto';
import type { DataSource } from '@insurtech/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  withRlsBypass,
  withRlsSuperAdminContext,
  withRlsTenantContext,
  withRlsTenantContextCommit,
} from './_helpers/rls-test-helper.js';
import { createTestDataSource } from './_helpers/test-data-source.js';

const PASSWORD_HASH = '$argon2id$v=19$m=4096,t=3,p=1$placeholder-super-admin-bypass-test';

describe('RLS super admin bypass (runtime live)', () => {
  let ds: DataSource;
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const tenantC = randomUUID();
  const userA = randomUUID();
  const userB = randomUUID();
  const companyIds = [randomUUID(), randomUUID(), randomUUID()];

  beforeAll(async () => {
    ds = createTestDataSource();
    await ds.initialize();

    await withRlsBypass(ds, async (em) => {
      // 3 tenants
      for (const [id, name] of [
        [tenantA, 'SuperAdmin A'],
        [tenantB, 'SuperAdmin B'],
        [tenantC, 'SuperAdmin C'],
      ]) {
        await em.query(
          `INSERT INTO auth_tenants (id, name, type, settings, status) VALUES ($1, $2, 'broker', '{}', 'active') ON CONFLICT (id) DO NOTHING`,
          [id, name],
        );
      }
      // 2 users (one per tenant A, B)
      await em.query(
        `INSERT INTO auth_users (id, tenant_id, email, password_hash, display_name) VALUES ($1, $2, $3, $4, 'User SuperA') ON CONFLICT (id) DO NOTHING`,
        [userA, tenantA, `super-a-${userA}@test.ma`, PASSWORD_HASH],
      );
      await em.query(
        `INSERT INTO auth_users (id, tenant_id, email, password_hash, display_name) VALUES ($1, $2, $3, $4, 'User SuperB') ON CONFLICT (id) DO NOTHING`,
        [userB, tenantB, `super-b-${userB}@test.ma`, PASSWORD_HASH],
      );
      await em.query(
        `INSERT INTO auth_tenant_users (tenant_id, user_id, role) VALUES ($1, $2, 'tenant_admin') ON CONFLICT DO NOTHING`,
        [tenantA, userA],
      );
      await em.query(
        `INSERT INTO auth_tenant_users (tenant_id, user_id, role) VALUES ($1, $2, 'tenant_admin') ON CONFLICT DO NOTHING`,
        [tenantB, userB],
      );
    });

    // Insert 1 crm_company per tenant via withRlsTenantContextCommit
    await withRlsTenantContextCommit(
      ds,
      { tenantId: tenantA, userId: userA },
      async (em) =>
        em.query(
          `INSERT INTO crm_companies (id, tenant_id, name, created_by) VALUES ($1, $2, 'A Company', $3)`,
          [companyIds[0], tenantA, userA],
        ),
    );
    await withRlsTenantContextCommit(
      ds,
      { tenantId: tenantB, userId: userB },
      async (em) =>
        em.query(
          `INSERT INTO crm_companies (id, tenant_id, name, created_by) VALUES ($1, $2, 'B Company', $3)`,
          [companyIds[1], tenantB, userB],
        ),
    );
    // Tenant C : insert via withRlsBypass (commit, super admin context).
    await withRlsBypass(ds, async (em) =>
      em.query(
        `INSERT INTO crm_companies (id, tenant_id, name, created_by) VALUES ($1, $2, 'C Company', NULL)`,
        [companyIds[2], tenantC],
      ),
    );
  });

  afterAll(async () => {
    await withRlsBypass(ds, async (em) => {
      // Delete ALL crm_companies for these tenants (TC-46 may have created extras).
      await em.query(
        `DELETE FROM crm_companies WHERE tenant_id IN ($1, $2, $3)`,
        [tenantA, tenantB, tenantC],
      );
      await em.query(
        `DELETE FROM auth_tenant_users WHERE tenant_id IN ($1, $2, $3)`,
        [tenantA, tenantB, tenantC],
      );
      await em.query(`DELETE FROM auth_users WHERE id IN ($1, $2)`, [userA, userB]);
      await em.query(`DELETE FROM auth_tenants WHERE id IN ($1, $2, $3)`, [
        tenantA,
        tenantB,
        tenantC,
      ]);
    });
    await ds.destroy();
  });

  it('TC-45 -- super admin SELECT crm_companies returns all tenants', async () => {
    const rows = await withRlsSuperAdminContext(ds, async (em) =>
      em.query(
        `SELECT id, tenant_id FROM crm_companies WHERE id = ANY($1::uuid[]) ORDER BY tenant_id`,
        [companyIds],
      ) as Promise<unknown[]>,
    );
    expect(rows).toHaveLength(3);
  });

  it('TC-46 -- super admin UPDATE cross-tenant affects all rows', async () => {
    const result = await withRlsSuperAdminContext(ds, async (em) => {
      const res = (await em.query(
        `UPDATE crm_companies SET notes = 'super-admin-touched' WHERE id = ANY($1::uuid[]) RETURNING id`,
        [companyIds],
      )) as [unknown[], number];
      return res[0];
    });
    expect(result).toHaveLength(3);

    // Cleanup notes
    await withRlsSuperAdminContext(ds, async (em) =>
      em.query(`UPDATE crm_companies SET notes = NULL WHERE id = ANY($1::uuid[])`, [companyIds]),
    );
  });

  it('TC-47 -- super admin DELETE cross-tenant works', async () => {
    const tempId = randomUUID();
    await withRlsBypass(ds, async (em) =>
      em.query(
        `INSERT INTO crm_companies (id, tenant_id, name) VALUES ($1, $2, 'Doomed')`,
        [tempId, tenantA],
      ),
    );

    const deleteResult = await withRlsSuperAdminContext(ds, async (em) => {
      const res = (await em.query(
        `DELETE FROM crm_companies WHERE id = $1 RETURNING id`,
        [tempId],
      )) as [unknown[], number];
      return res[0];
    });
    expect(deleteResult).toHaveLength(1);
  });

  it('TC-48 -- without is_super_admin, SELECT respects RLS (no leak)', async () => {
    // Same connection : start with super admin context, then close transaction,
    // start new transaction WITHOUT super admin -> should respect RLS.
    const rows = await withRlsTenantContext(
      ds,
      { tenantId: tenantA, userId: userA },
      async (em) =>
        em.query(
          `SELECT id FROM crm_companies WHERE id = ANY($1::uuid[])`,
          [companyIds],
        ) as Promise<unknown[]>,
    );
    // Only the row created under tenantA should be visible.
    expect(rows).toHaveLength(1);
  });

  it('TC-49 -- no context at all returns 0 (defense in depth)', async () => {
    const rows = await withRlsTenantContext(ds, {}, async (em) =>
      em.query(`SELECT id FROM crm_companies WHERE id = ANY($1::uuid[])`, [companyIds]) as Promise<
        unknown[]
      >,
    );
    expect(rows).toEqual([]);
  });
});
