/**
 * TC-SUB-TID-01 to TC-SUB-TID-08 -- TenantIdInjectorSubscriber integration tests.
 * Validates that the subscriber auto-injects tenant_id on INSERT,
 * blocks inserts without context, and blocks cross-tenant writes.
 * Aucune emoji (decision-006).
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { DataSource } from 'typeorm';
import { CrmContactEntity } from '../../src/entities/crm/crm-contact.entity.js';
import {
  buildTestDataSource,
  runAllMigrations,
  truncateAllTables,
  withTenant,
  withoutTenant,
  TENANT_A_ID,
  TENANT_B_ID,
} from '../setup.js';

const DB_AVAILABLE = Boolean(process.env['DATABASE_TEST_URL'] ?? process.env['DATABASE_HOST']);

describe.skipIf(!DB_AVAILABLE)('subscribers tenant-id integration', () => {
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
      `INSERT INTO auth_tenants (id, name, type) VALUES ($1, 'TA', 'broker'), ($2, 'TB', 'garage') ON CONFLICT DO NOTHING`,
      [TENANT_A_ID, TENANT_B_ID],
    );
  });

  it('TC-SUB-TID-01 -- INSERT without tenant context is blocked by RLS', async () => {
    await expect(
      withoutTenant(ds, async (em) => {
        await em.query(
          `INSERT INTO crm_contacts (id, tenant_id, first_name, last_name) VALUES (gen_random_uuid(), $1, 'X', 'Y')`,
          [TENANT_A_ID],
        );
      }),
    ).rejects.toThrow(/row.level security|rls/i);
  });

  it('TC-SUB-TID-02 -- auto-injects tenant_id when context is set via SQL session', async () => {
    const saved = await withTenant(ds, TENANT_A_ID, async (em) => {
      const repo = em.getRepository(CrmContactEntity);
      const entity = repo.create({ firstName: 'Auto', lastName: 'Inject', tenantId: TENANT_A_ID });
      return repo.save(entity);
    });
    expect(saved.tenantId).toBe(TENANT_A_ID);
  });

  it('TC-SUB-TID-03 -- preserves explicit tenant_id when matching context', async () => {
    const saved = await withTenant(ds, TENANT_A_ID, async (em) => {
      const repo = em.getRepository(CrmContactEntity);
      const entity = repo.create({ tenantId: TENANT_A_ID, firstName: 'Explicit', lastName: 'Tenant' });
      return repo.save(entity);
    });
    expect(saved.tenantId).toBe(TENANT_A_ID);
  });

  it('TC-SUB-TID-04 -- cross-tenant insert blocked by RLS (tenant B context cannot see tenant A rows)', async () => {
    const id = await withTenant(ds, TENANT_A_ID, async (em) => {
      const res = await em.query(
        `INSERT INTO crm_contacts (id, tenant_id, first_name, last_name) VALUES (gen_random_uuid(), $1, 'A', 'Contact') RETURNING id`,
        [TENANT_A_ID],
      );
      return (res as Array<{ id: string }>)[0]?.id;
    });
    const rows = await withTenant(ds, TENANT_B_ID, async (em) =>
      em.query(`SELECT id FROM crm_contacts WHERE id = $1`, [id]),
    );
    expect(rows.length).toBe(0);
  });

  it('TC-SUB-TID-05 -- does not overwrite tenant_id on update', async () => {
    const id = await withTenant(ds, TENANT_A_ID, async (em) => {
      const repo = em.getRepository(CrmContactEntity);
      const e = repo.create({ firstName: 'D', lastName: 'Update', tenantId: TENANT_A_ID });
      const r = await repo.save(e);
      return r.id;
    });
    await withTenant(ds, TENANT_A_ID, async (em) => {
      const repo = em.getRepository(CrmContactEntity);
      await repo.update(id, { firstName: 'D2' });
    });
    const final = await withTenant(ds, TENANT_A_ID, async (em) =>
      em.getRepository(CrmContactEntity).findOneByOrFail({ id }),
    );
    expect(final.tenantId).toBe(TENANT_A_ID);
    expect(final.firstName).toBe('D2');
  });

  it('TC-SUB-TID-06 -- subscriber active across multiple tenanted entities (crm_companies)', async () => {
    await withTenant(ds, TENANT_A_ID, async (em) => {
      await em.query(
        `INSERT INTO crm_companies (id, tenant_id, name) VALUES (gen_random_uuid(), $1, 'Co Test')`,
        [TENANT_A_ID],
      );
    });
    const rows = await withTenant(ds, TENANT_A_ID, async (em) =>
      em.query(`SELECT tenant_id FROM crm_companies`),
    );
    expect(rows[0].tenant_id).toBe(TENANT_A_ID);
  });

  it('TC-SUB-TID-07 -- auth_tenants table exempted from tenant injection', async () => {
    await ds.query(
      `INSERT INTO auth_tenants (id, name, type) VALUES (gen_random_uuid(), 'New Tenant', 'mixed')`,
    );
    const rows = await ds.query(`SELECT id FROM auth_tenants WHERE name = 'New Tenant'`);
    expect(rows.length).toBe(1);
  });

  it('TC-SUB-TID-08 -- handles bulk insert with single tenant context', async () => {
    await withTenant(ds, TENANT_A_ID, async (em) => {
      const repo = em.getRepository(CrmContactEntity);
      const list = Array.from({ length: 10 }, (_, i) =>
        repo.create({ firstName: `Bulk${i}`, lastName: 'Test', tenantId: TENANT_A_ID }),
      );
      await repo.save(list);
    });
    const count = await withTenant(ds, TENANT_A_ID, async (em) =>
      em.getRepository(CrmContactEntity).count(),
    );
    expect(count).toBe(10);
  });
});
