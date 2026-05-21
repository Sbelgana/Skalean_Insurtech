/**
 * RLS cross-tenant isolation tests -- CRM tables.
 *
 * Pause Technique #4 -- VALIDE RUNTIME contre skalean-postgres-test.
 * Pattern : SET ROLE insurtech_app + set_config(app.current_tenant_id, ...).
 * Helper Sprint 1 app_can_access_tenant() applique automatiquement RLS.
 *
 * Reference : Sprint 6 / Tache 2.2.12 + Pause #4.
 */

import { randomUUID } from 'node:crypto';
import type { DataSource } from '@insurtech/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDataSource } from './_helpers/test-data-source.js';
import {
  withRlsBypass,
  withRlsTenantContext,
  withRlsTenantContextCommit,
} from './_helpers/rls-test-helper.js';

describe('RLS isolation -- CRM cross-tenant (runtime live)', () => {
  let ds: DataSource;
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const userA = randomUUID();
  const userB = randomUUID();

  beforeAll(async () => {
    ds = createTestDataSource();
    await ds.initialize();

    // Fixtures via bypass (role superuser skalean) car les RLS sur auth_tenants/users
    // requierent un contexte deja installe -- pour fixture setup on bypass.
    await withRlsBypass(ds, async (em) => {
      await em.query(
        `INSERT INTO auth_tenants (id, name, type, settings, status) VALUES ($1, 'Tenant A', 'broker', '{}', 'active') ON CONFLICT (id) DO NOTHING`,
        [tenantA],
      );
      await em.query(
        `INSERT INTO auth_tenants (id, name, type, settings, status) VALUES ($1, 'Tenant B', 'broker', '{}', 'active') ON CONFLICT (id) DO NOTHING`,
        [tenantB],
      );
      await em.query(
        `INSERT INTO auth_users (id, tenant_id, email, password_hash, display_name) VALUES ($1, $2, $3, '$argon2id$v=19$m=4096,t=3,p=1$placeholder-test-fixture-hash-bytes', 'User A') ON CONFLICT (id) DO NOTHING`,
        [userA, tenantA, `user-a-${userA}@test.ma`],
      );
      await em.query(
        `INSERT INTO auth_users (id, tenant_id, email, password_hash, display_name) VALUES ($1, $2, $3, '$argon2id$v=19$m=4096,t=3,p=1$placeholder-test-fixture-hash-bytes', 'User B') ON CONFLICT (id) DO NOTHING`,
        [userB, tenantB, `user-b-${userB}@test.ma`],
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
  });

  afterAll(async () => {
    await withRlsBypass(ds, async (em) => {
      await em.query(`DELETE FROM crm_companies WHERE tenant_id IN ($1, $2)`, [tenantA, tenantB]);
      await em.query(`DELETE FROM auth_tenant_users WHERE tenant_id IN ($1, $2)`, [tenantA, tenantB]);
      await em.query(`DELETE FROM auth_users WHERE id IN ($1, $2)`, [userA, userB]);
      await em.query(`DELETE FROM auth_tenants WHERE id IN ($1, $2)`, [tenantA, tenantB]);
    });
    await ds.destroy();
  });

  it('TC-1 -- INSERT crm_companies tenant A, SELECT tenant B context returns 0 rows', async () => {
    const companyName = `Test Company ${randomUUID()}`;
    const companyId = randomUUID();

    // Insert under tenant A context
    await withRlsTenantContextCommit(ds, { tenantId: tenantA, userId: userA }, async (em) => {
      await em.query(
        `INSERT INTO crm_companies (id, tenant_id, name, created_by) VALUES ($1, $2, $3, $4)`,
        [companyId, tenantA, companyName, userA],
      );
    });

    // SELECT under tenant B context : should see 0 rows.
    const rowsB = await withRlsTenantContext(
      ds,
      { tenantId: tenantB, userId: userB },
      async (em) =>
        em.query(`SELECT id FROM crm_companies WHERE name = $1`, [companyName]) as Promise<unknown[]>,
    );
    expect(rowsB).toEqual([]);

    // SELECT under tenant A context : should see 1 row.
    const rowsA = await withRlsTenantContext(
      ds,
      { tenantId: tenantA, userId: userA },
      async (em) =>
        em.query(`SELECT id FROM crm_companies WHERE name = $1`, [companyName]) as Promise<unknown[]>,
    );
    expect(rowsA).toHaveLength(1);

    // Cleanup
    await withRlsBypass(ds, async (em) => {
      await em.query(`DELETE FROM crm_companies WHERE id = $1`, [companyId]);
    });
  });

  it('TC-2 -- UPDATE crm_companies cross-tenant returns 0 rows affected', async () => {
    const companyId = randomUUID();
    const companyName = `Update Target ${randomUUID()}`;

    await withRlsTenantContextCommit(ds, { tenantId: tenantA, userId: userA }, async (em) => {
      await em.query(
        `INSERT INTO crm_companies (id, tenant_id, name, created_by) VALUES ($1, $2, $3, $4)`,
        [companyId, tenantA, companyName, userA],
      );
    });

    // UPDATE from tenant B context : should affect 0 rows.
    const updateResult = await withRlsTenantContext(
      ds,
      { tenantId: tenantB, userId: userB },
      async (em) => {
        const res = (await em.query(
          `UPDATE crm_companies SET name = 'HACKED' WHERE id = $1 RETURNING id`,
          [companyId],
        )) as [unknown[], number];
        return res[0];
      },
    );
    expect(updateResult).toEqual([]);

    // Verify under tenant A : name unchanged.
    const verify = await withRlsTenantContext(
      ds,
      { tenantId: tenantA, userId: userA },
      async (em) =>
        em.query(`SELECT name FROM crm_companies WHERE id = $1`, [companyId]) as Promise<
          { name: string }[]
        >,
    );
    expect(verify[0]?.name).toBe(companyName);

    await withRlsBypass(ds, async (em) => {
      await em.query(`DELETE FROM crm_companies WHERE id = $1`, [companyId]);
    });
  });

  it('TC-3 -- DELETE crm_companies cross-tenant returns 0 rows affected', async () => {
    const companyId = randomUUID();

    await withRlsTenantContextCommit(ds, { tenantId: tenantA, userId: userA }, async (em) => {
      await em.query(
        `INSERT INTO crm_companies (id, tenant_id, name, created_by) VALUES ($1, $2, 'Delete Target', $3)`,
        [companyId, tenantA, userA],
      );
    });

    // DELETE from tenant B : should fail (0 rows).
    const deleteRes = await withRlsTenantContext(
      ds,
      { tenantId: tenantB, userId: userB },
      async (em) => {
        const res = (await em.query(
          `DELETE FROM crm_companies WHERE id = $1 RETURNING id`,
          [companyId],
        )) as [unknown[], number];
        return res[0];
      },
    );
    expect(deleteRes).toEqual([]);

    // Verify row still exists under tenant A.
    const verify = await withRlsTenantContext(
      ds,
      { tenantId: tenantA, userId: userA },
      async (em) =>
        em.query(`SELECT id FROM crm_companies WHERE id = $1`, [companyId]) as Promise<unknown[]>,
    );
    expect(verify).toHaveLength(1);

    await withRlsBypass(ds, async (em) => {
      await em.query(`DELETE FROM crm_companies WHERE id = $1`, [companyId]);
    });
  });

  it('TC-4 -- SELECT same tenant returns all owned rows', async () => {
    const ids = [randomUUID(), randomUUID(), randomUUID()];

    await withRlsTenantContextCommit(ds, { tenantId: tenantA, userId: userA }, async (em) => {
      for (const id of ids) {
        await em.query(
          `INSERT INTO crm_companies (id, tenant_id, name, created_by) VALUES ($1, $2, $3, $4)`,
          [id, tenantA, `Multi ${id}`, userA],
        );
      }
    });

    const rowsA = await withRlsTenantContext(
      ds,
      { tenantId: tenantA, userId: userA },
      async (em) =>
        em.query(
          `SELECT id FROM crm_companies WHERE id = ANY($1::uuid[])`,
          [ids],
        ) as Promise<unknown[]>,
    );
    expect(rowsA).toHaveLength(3);

    await withRlsBypass(ds, async (em) => {
      await em.query(`DELETE FROM crm_companies WHERE id = ANY($1::uuid[])`, [ids]);
    });
  });
});
