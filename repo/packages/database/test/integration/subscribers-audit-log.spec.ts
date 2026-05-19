/**
 * TC-SUB-AL-01 to TC-SUB-AL-10 -- AuditLogWriterSubscriber integration tests.
 * Validates that insert/update/soft-delete on auditable tables writes correct
 * audit_log rows, that non-auditable tables are skipped, and that rollback
 * rolls back the audit entry too (same transaction).
 * Aucune emoji (decision-006).
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { DataSource } from 'typeorm';
import { AuthUser } from '../../src/entities/system/auth-user.entity.js';
import { runInTenantContext } from '../../src/context/tenant-context.js';
import {
  buildTestDataSource,
  runAllMigrations,
  truncateAllTables,
  withTenant,
  TENANT_A_ID,
} from '../setup.js';

const DB_AVAILABLE = Boolean(process.env['DATABASE_TEST_URL'] ?? process.env['DATABASE_HOST']);

describe.skipIf(!DB_AVAILABLE)('subscribers audit-log integration', () => {
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

  it('TC-SUB-AL-01 -- writes audit_log row on INSERT into auditable table', async () => {
    await withTenant(ds, TENANT_A_ID, async (em) => {
      const u = em.getRepository(AuthUser).create({
        tenantId: TENANT_A_ID,
        email: 'audit1@int.test.skalean.ma',
        passwordHash: 'h'.repeat(60),
        displayName: 'Audit User 1',
      });
      await em.getRepository(AuthUser).save(u);
    });
    const audit = await withTenant(ds, TENANT_A_ID, async (em) =>
      em.query(`SELECT * FROM audit_log WHERE resource_type = 'auth_users' ORDER BY created_at DESC LIMIT 1`),
    );
    expect(audit.length).toBeGreaterThanOrEqual(1);
    expect(audit[0].action).toBe('INSERT');
  });

  it('TC-SUB-AL-02 -- writes audit_log row on UPDATE with fields_changed array', async () => {
    const id = await withTenant(ds, TENANT_A_ID, async (em) => {
      const u = em.getRepository(AuthUser).create({
        tenantId: TENANT_A_ID,
        email: 'audit2@int.test.skalean.ma',
        passwordHash: 'h'.repeat(60),
        displayName: 'Audit User 2',
      });
      const s = await em.getRepository(AuthUser).save(u);
      return s.id;
    });
    await withTenant(ds, TENANT_A_ID, async (em) => {
      await em.getRepository(AuthUser).update(id, { displayName: 'Updated Name' });
    });
    const audit = await withTenant(ds, TENANT_A_ID, async (em) =>
      em.query(
        `SELECT * FROM audit_log WHERE resource_type = 'auth_users' AND action = 'UPDATE' ORDER BY created_at DESC LIMIT 1`,
      ),
    );
    expect(audit.length).toBeGreaterThanOrEqual(1);
    const changes = audit[0].changes as { fieldsChanged?: string[] };
    expect(Array.isArray(changes.fieldsChanged)).toBe(true);
    expect(changes.fieldsChanged).toContain('display_name');
  });

  it('TC-SUB-AL-03 -- writes audit_log row on soft delete', async () => {
    const id = await withTenant(ds, TENANT_A_ID, async (em) => {
      const u = em.getRepository(AuthUser).create({
        tenantId: TENANT_A_ID,
        email: 'audit3@int.test.skalean.ma',
        passwordHash: 'h'.repeat(60),
        displayName: 'Audit User 3',
      });
      const s = await em.getRepository(AuthUser).save(u);
      return s.id;
    });
    await withTenant(ds, TENANT_A_ID, async (em) => {
      await em.getRepository(AuthUser).softDelete(id);
    });
    const audit = await withTenant(ds, TENANT_A_ID, async (em) =>
      em.query(
        `SELECT action FROM audit_log WHERE resource_type = 'auth_users' AND action = 'SOFT_DELETE'`,
      ),
    );
    expect(audit.length).toBeGreaterThanOrEqual(1);
  });

  it('TC-SUB-AL-04 -- does not recurse on audit_log itself', async () => {
    await withTenant(ds, TENANT_A_ID, async (em) => {
      const u = em.getRepository(AuthUser).create({
        tenantId: TENANT_A_ID,
        email: 'audit4@int.test.skalean.ma',
        passwordHash: 'h'.repeat(60),
        displayName: 'Audit User 4',
      });
      await em.getRepository(AuthUser).save(u);
    });
    const selfAudit = await withTenant(ds, TENANT_A_ID, async (em) =>
      em.query(`SELECT resource_type FROM audit_log WHERE resource_type = 'audit_log'`),
    );
    expect(selfAudit.length).toBe(0);
  });

  it('TC-SUB-AL-05 -- non-auditable tables (analytics_events) not in audit_log', async () => {
    await withTenant(ds, TENANT_A_ID, async (em) => {
      await em.query(
        `INSERT INTO analytics_events (id, tenant_id, event_type, occurred_at) VALUES (gen_random_uuid(), $1, 'page_view', now())`,
        [TENANT_A_ID],
      );
    });
    const audit = await withTenant(ds, TENANT_A_ID, async (em) =>
      em.query(`SELECT resource_type FROM audit_log WHERE resource_type = 'analytics_events'`),
    );
    expect(audit.length).toBe(0);
  });

  it('TC-SUB-AL-06 -- fields_changed array has stable (sorted) key ordering', async () => {
    const id = await withTenant(ds, TENANT_A_ID, async (em) => {
      const u = em.getRepository(AuthUser).create({
        tenantId: TENANT_A_ID,
        email: 'audit5@int.test.skalean.ma',
        passwordHash: 'h'.repeat(60),
        displayName: 'Audit User 5',
      });
      const s = await em.getRepository(AuthUser).save(u);
      return s.id;
    });
    await withTenant(ds, TENANT_A_ID, async (em) => {
      await em.getRepository(AuthUser).update(id, { displayName: 'Updated 5', mfaEnabled: true });
    });
    const audit = await withTenant(ds, TENANT_A_ID, async (em) =>
      em.query(
        `SELECT changes FROM audit_log WHERE resource_type = 'auth_users' AND action = 'UPDATE' ORDER BY created_at DESC LIMIT 1`,
      ),
    );
    const changes = audit[0].changes as { fieldsChanged?: string[] };
    const keys = changes.fieldsChanged ?? [];
    expect(keys).toEqual([...keys].sort());
  });

  it('TC-SUB-AL-07 -- records user_id (actor) from AsyncLocalStorage context', async () => {
    const actorId = '99999999-9999-9999-9999-999999999999';
    await runInTenantContext(
      { tenantId: TENANT_A_ID, userId: actorId, userIp: null, isSuperAdmin: false, correlationId: 'corr-007' },
      async () => {
        await withTenant(ds, TENANT_A_ID, async (em) => {
          const u = em.getRepository(AuthUser).create({
            tenantId: TENANT_A_ID,
            email: 'audit6@int.test.skalean.ma',
            passwordHash: 'h'.repeat(60),
            displayName: 'Audit User 6',
          });
          await em.getRepository(AuthUser).save(u);
        });
      },
    );
    const audit = await withTenant(ds, TENANT_A_ID, async (em) =>
      em.query(
        `SELECT user_id FROM audit_log WHERE resource_type = 'auth_users' AND action = 'INSERT' ORDER BY created_at DESC LIMIT 1`,
      ),
    );
    expect(audit[0].user_id).toBe(actorId);
  });

  it('TC-SUB-AL-08 -- records correlation_id in user_agent column', async () => {
    const corr = 'corr-test-1234';
    await runInTenantContext(
      { tenantId: TENANT_A_ID, userId: null, userIp: null, isSuperAdmin: false, correlationId: corr },
      async () => {
        await withTenant(ds, TENANT_A_ID, async (em) => {
          const u = em.getRepository(AuthUser).create({
            tenantId: TENANT_A_ID,
            email: 'audit7@int.test.skalean.ma',
            passwordHash: 'h'.repeat(60),
            displayName: 'Audit User 7',
          });
          await em.getRepository(AuthUser).save(u);
        });
      },
    );
    const audit = await withTenant(ds, TENANT_A_ID, async (em) =>
      em.query(
        `SELECT user_agent FROM audit_log WHERE resource_type = 'auth_users' AND action = 'INSERT' ORDER BY created_at DESC LIMIT 1`,
      ),
    );
    expect(audit[0].user_agent).toBe(corr);
  });

  it('TC-SUB-AL-09 -- records ip_address from AsyncLocalStorage context', async () => {
    const ip = '196.200.176.20';
    await runInTenantContext(
      { tenantId: TENANT_A_ID, userId: null, userIp: ip, isSuperAdmin: false, correlationId: 'corr-009' },
      async () => {
        await withTenant(ds, TENANT_A_ID, async (em) => {
          const u = em.getRepository(AuthUser).create({
            tenantId: TENANT_A_ID,
            email: 'audit8@int.test.skalean.ma',
            passwordHash: 'h'.repeat(60),
            displayName: 'Audit User 8',
          });
          await em.getRepository(AuthUser).save(u);
        });
      },
    );
    const audit = await withTenant(ds, TENANT_A_ID, async (em) =>
      em.query(
        `SELECT ip_address::text AS v FROM audit_log WHERE resource_type = 'auth_users' ORDER BY created_at DESC LIMIT 1`,
      ),
    );
    expect(audit[0].v).toBe(ip);
  });

  it('TC-SUB-AL-10 -- audit row is rolled back when transaction rolls back', async () => {
    try {
      await ds.transaction(async (em) => {
        await em.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [TENANT_A_ID]);
        const u = em.getRepository(AuthUser).create({
          tenantId: TENANT_A_ID,
          email: 'audit9@int.test.skalean.ma',
          passwordHash: 'h'.repeat(60),
          displayName: 'Audit User 9',
        });
        await em.getRepository(AuthUser).save(u);
        throw new Error('rollback please');
      });
    } catch {
      // expected rollback
    }
    const audit = await withTenant(ds, TENANT_A_ID, async (em) =>
      em.query(
        `SELECT id FROM audit_log WHERE resource_type = 'auth_users'`,
      ),
    );
    expect(audit.length).toBe(0);
  });
});
