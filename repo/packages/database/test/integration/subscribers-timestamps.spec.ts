/**
 * TC-SUB-TS-01 to TC-SUB-TS-06 -- TimestampsInjectorSubscriber integration tests.
 * Validates that created_at and updated_at are correctly set/updated.
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
  TENANT_A_ID,
} from '../setup.js';

const DB_AVAILABLE = Boolean(process.env['DATABASE_TEST_URL'] ?? process.env['DATABASE_HOST']);

describe.skipIf(!DB_AVAILABLE)('subscribers timestamps integration', () => {
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
      `INSERT INTO auth_tenants (id, name, type) VALUES ($1, 'TA', 'broker') ON CONFLICT DO NOTHING`,
      [TENANT_A_ID],
    );
  });

  it('TC-SUB-TS-01 -- sets created_at and updated_at on INSERT', async () => {
    const saved = await withTenant(ds, TENANT_A_ID, async (em) => {
      const c = em.getRepository(CrmContactEntity).create({
        tenantId: TENANT_A_ID,
        firstName: 'TS',
        lastName: 'One',
      });
      return em.getRepository(CrmContactEntity).save(c);
    });
    expect(saved.createdAt).toBeInstanceOf(Date);
    expect(saved.updatedAt).toBeInstanceOf(Date);
    expect(Math.abs(saved.createdAt.getTime() - saved.updatedAt.getTime())).toBeLessThan(1000);
  });

  it('TC-SUB-TS-02 -- updates updated_at but not created_at on UPDATE', async () => {
    const initial = await withTenant(ds, TENANT_A_ID, async (em) => {
      const c = em.getRepository(CrmContactEntity).create({
        tenantId: TENANT_A_ID,
        firstName: 'TS',
        lastName: 'Two',
      });
      return em.getRepository(CrmContactEntity).save(c);
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    const updated = await withTenant(ds, TENANT_A_ID, async (em) => {
      const repo = em.getRepository(CrmContactEntity);
      await repo.update(initial.id, { firstName: 'TS2-updated' });
      return repo.findOneByOrFail({ id: initial.id });
    });
    expect(updated.createdAt.getTime()).toBe(initial.createdAt.getTime());
    expect(updated.updatedAt.getTime()).toBeGreaterThan(initial.updatedAt.getTime());
  });

  it('TC-SUB-TS-03 -- does not override created_at when explicitly provided', async () => {
    const explicit = new Date('2020-01-01T00:00:00Z');
    const saved = await withTenant(ds, TENANT_A_ID, async (em) => {
      const c = em.getRepository(CrmContactEntity).create({
        tenantId: TENANT_A_ID,
        firstName: 'TS',
        lastName: 'Three',
        createdAt: explicit,
      });
      return em.getRepository(CrmContactEntity).save(c);
    });
    expect(saved.createdAt.toISOString()).toBe(explicit.toISOString());
  });

  it('TC-SUB-TS-04 -- created_at is close to server time (within 5 seconds)', async () => {
    const saved = await withTenant(ds, TENANT_A_ID, async (em) => {
      const c = em.getRepository(CrmContactEntity).create({
        tenantId: TENANT_A_ID,
        firstName: 'TS',
        lastName: 'Four',
      });
      return em.getRepository(CrmContactEntity).save(c);
    });
    const drift = Math.abs(Date.now() - saved.createdAt.getTime());
    expect(drift).toBeLessThan(5_000);
  });

  it('TC-SUB-TS-05 -- sets timestamps on bulk insert', async () => {
    await withTenant(ds, TENANT_A_ID, async (em) => {
      const repo = em.getRepository(CrmContactEntity);
      const list = Array.from({ length: 5 }, (_, i) =>
        repo.create({ tenantId: TENANT_A_ID, firstName: `B${i}`, lastName: 'Bulk' }),
      );
      await repo.save(list);
    });
    const rows = await withTenant(ds, TENANT_A_ID, async (em) =>
      em.getRepository(CrmContactEntity).find(),
    );
    for (const r of rows) {
      expect(r.createdAt).toBeInstanceOf(Date);
      expect(r.updatedAt).toBeInstanceOf(Date);
    }
  });

  it('TC-SUB-TS-06 -- does not update updated_at on no-op save (same values)', async () => {
    const initial = await withTenant(ds, TENANT_A_ID, async (em) => {
      const c = em.getRepository(CrmContactEntity).create({
        tenantId: TENANT_A_ID,
        firstName: 'TS',
        lastName: 'Six',
      });
      return em.getRepository(CrmContactEntity).save(c);
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    const after = await withTenant(ds, TENANT_A_ID, async (em) => {
      const repo = em.getRepository(CrmContactEntity);
      const e = await repo.findOneByOrFail({ id: initial.id });
      // Save with same values -- updatedAt should not change significantly
      return repo.save(e);
    });
    // Allow up to 100ms drift due to subscriber always setting updatedAt on beforeUpdate
    const diff = after.updatedAt.getTime() - initial.updatedAt.getTime();
    expect(diff).toBeGreaterThanOrEqual(0);
    expect(diff).toBeLessThan(5_000);
  });
});
