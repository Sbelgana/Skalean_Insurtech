/**
 * TC-RLS-SA-01 to TC-RLS-SA-08 -- RLS super-admin bypass tests.
 * Validates that super admin can read/write across all tenants,
 * and that super admin flag does not leak between transactions.
 * Aucune emoji (decision-006).
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';
import {
  buildTestDataSource,
  runAllMigrations,
  truncateAllTables,
  withTenant,
  withSuperAdmin,
  withoutTenant,
  TENANT_A_ID,
  TENANT_B_ID,
  TENANT_C_ID,
} from '../setup.js';

const DB_AVAILABLE = Boolean(process.env['DATABASE_TEST_URL'] ?? process.env['DATABASE_HOST']);

// TODO Sprint 6 : rewrite RLS super-admin tests with non-superuser test role.
// Current spec fails because test DB user is superuser/BYPASSRLS, making RLS
// policies inactive regardless of app.is_super_admin session var. See KNOWN-ISSUES.md.
describe.skip('rls-super-admin integration', () => {
  let ds: DataSource;

  beforeAll(async () => {
    ds = await buildTestDataSource();
    await runAllMigrations(ds);
  });

  afterAll(async () => {
    await ds.destroy();
  });

  beforeEach(async () => {
    await truncateAllTables(ds);
    await ds.query(
      `INSERT INTO auth_tenants (id, name, type) VALUES ($1, 'TA', 'broker'), ($2, 'TB', 'garage'), ($3, 'TC', 'mixed') ON CONFLICT DO NOTHING`,
      [TENANT_A_ID, TENANT_B_ID, TENANT_C_ID],
    );
  });

  it('TC-RLS-SA-01 -- super admin sees rows across all tenants', async () => {
    for (const t of [TENANT_A_ID, TENANT_B_ID, TENANT_C_ID]) {
      await withTenant(ds, t, async (em) => {
        await em.query(
          `INSERT INTO crm_contacts (id, tenant_id, first_name, last_name) VALUES (gen_random_uuid(), $1, 'X', 'SA')`,
          [t],
        );
      });
    }
    const rows = await withSuperAdmin(ds, async (em) =>
      em.query(`SELECT tenant_id FROM crm_contacts ORDER BY tenant_id`),
    );
    expect(rows.length).toBe(3);
  });

  it('TC-RLS-SA-02 -- super admin can insert into any tenant', async () => {
    const id = randomUUID();
    await withSuperAdmin(ds, async (em) => {
      await em.query(
        `INSERT INTO crm_contacts (id, tenant_id, first_name, last_name) VALUES ($1, $2, 'SA', 'Insert')`,
        [id, TENANT_B_ID],
      );
    });
    const rows = await withTenant(ds, TENANT_B_ID, async (em) =>
      em.query(`SELECT id FROM crm_contacts WHERE id = $1`, [id]),
    );
    expect(rows.length).toBe(1);
  });

  it('TC-RLS-SA-03 -- non-super-admin without tenant context sees zero rows', async () => {
    await withTenant(ds, TENANT_A_ID, async (em) => {
      await em.query(
        `INSERT INTO crm_contacts (id, tenant_id, first_name, last_name) VALUES (gen_random_uuid(), $1, 'Z', 'Zero')`,
        [TENANT_A_ID],
      );
    });
    const rows = await withoutTenant(ds, async (em) =>
      em.query(`SELECT id FROM crm_contacts`),
    );
    expect(rows.length).toBe(0);
  });

  it('TC-RLS-SA-04 -- super admin flag false behaves like normal user', async () => {
    await withTenant(ds, TENANT_A_ID, async (em) => {
      await em.query(
        `INSERT INTO crm_contacts (id, tenant_id, first_name, last_name) VALUES (gen_random_uuid(), $1, 'W', 'Normal')`,
        [TENANT_A_ID],
      );
    });
    const rows = await ds.transaction(async (em) => {
      await em.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [TENANT_B_ID]);
      await em.query(`SELECT set_config('app.is_super_admin', 'false', true)`);
      return em.query(`SELECT id FROM crm_contacts`);
    });
    expect(rows.length).toBe(0);
  });

  it('TC-RLS-SA-05 -- super admin can update across tenants', async () => {
    const id = randomUUID();
    await withTenant(ds, TENANT_A_ID, async (em) => {
      await em.query(
        `INSERT INTO crm_contacts (id, tenant_id, first_name, last_name) VALUES ($1, $2, 'Old', 'Name')`,
        [id, TENANT_A_ID],
      );
    });
    await withSuperAdmin(ds, async (em) => {
      await em.query(`UPDATE crm_contacts SET first_name = 'New' WHERE id = $1`, [id]);
    });
    const rows = await withTenant(ds, TENANT_A_ID, async (em) =>
      em.query(`SELECT first_name FROM crm_contacts WHERE id = $1`, [id]),
    );
    expect(rows[0].first_name).toBe('New');
  });

  it('TC-RLS-SA-06 -- super admin can delete across tenants', async () => {
    const id = randomUUID();
    await withTenant(ds, TENANT_A_ID, async (em) => {
      await em.query(
        `INSERT INTO crm_contacts (id, tenant_id, first_name, last_name) VALUES ($1, $2, 'Del', 'Row')`,
        [id, TENANT_A_ID],
      );
    });
    await withSuperAdmin(ds, async (em) => {
      await em.query(`DELETE FROM crm_contacts WHERE id = $1`, [id]);
    });
    const rows = await withTenant(ds, TENANT_A_ID, async (em) =>
      em.query(`SELECT id FROM crm_contacts WHERE id = $1`, [id]),
    );
    expect(rows.length).toBe(0);
  });

  it('TC-RLS-SA-07 -- super admin context does not leak to next transaction', async () => {
    await withSuperAdmin(ds, async (em) => {
      await em.query(`SELECT 1`);
    });
    const rows = await withTenant(ds, TENANT_A_ID, async (em) =>
      em.query(`SELECT current_setting('app.is_super_admin', true) AS v`),
    );
    expect(rows[0].v).not.toBe('true');
  });

  it('TC-RLS-SA-08 -- audit_log entries are visible to super admin across tenants', async () => {
    for (const t of [TENANT_A_ID, TENANT_B_ID]) {
      await withTenant(ds, t, async (em) => {
        await em.query(
          `INSERT INTO audit_log (id, tenant_id, action, resource_type, changes) VALUES (gen_random_uuid(), $1, 'INSERT', 'crm_contacts', '{}'::jsonb)`,
          [t],
        );
      });
    }
    const audit = await withSuperAdmin(ds, async (em) =>
      em.query(`SELECT tenant_id FROM audit_log WHERE resource_type = 'crm_contacts'`),
    );
    expect(audit.length).toBeGreaterThanOrEqual(2);
  });
});
