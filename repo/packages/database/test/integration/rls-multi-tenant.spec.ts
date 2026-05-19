/**
 * TC-RLS-MT-01 to TC-RLS-MT-16 -- RLS cross-tenant isolation tests.
 * Validates that rows inserted by tenant A are invisible to tenant B.
 * Requires DATABASE_TEST_URL or DATABASE_HOST + migrated schema.
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
  TENANT_A_ID,
  TENANT_B_ID,
} from '../setup.js';

const DB_AVAILABLE = Boolean(process.env['DATABASE_TEST_URL'] ?? process.env['DATABASE_HOST']);

interface RlsCase {
  table: string;
  insertSql: (tenantId: string, id: string) => [string, unknown[]];
}

const cases: RlsCase[] = [
  {
    table: 'auth_users',
    insertSql: (tenantId, id) => [
      `INSERT INTO auth_users (id, tenant_id, email, password_hash, display_name) VALUES ($1, $2, $3, $4, $5)`,
      [id, tenantId, `${id.slice(0, 8)}@rls.test.skalean.ma`, 'h'.repeat(60), `User ${id.slice(0, 8)}`],
    ],
  },
  {
    table: 'crm_companies',
    insertSql: (tenantId, id) => [
      `INSERT INTO crm_companies (id, tenant_id, name) VALUES ($1, $2, $3)`,
      [id, tenantId, `Co ${id.slice(0, 8)}`],
    ],
  },
  {
    table: 'crm_contacts',
    insertSql: (tenantId, id) => [
      `INSERT INTO crm_contacts (id, tenant_id, first_name, last_name, email) VALUES ($1, $2, $3, $4, $5)`,
      [id, tenantId, 'Rls', `Contact-${id.slice(0, 6)}`, `${id.slice(0, 8)}@rls.test.ma`],
    ],
  },
  {
    table: 'booking_rooms',
    insertSql: (tenantId, id) => [
      `INSERT INTO booking_rooms (id, tenant_id, name, capacity) VALUES ($1, $2, $3, 4)`,
      [id, tenantId, `Room ${id.slice(0, 8)}`],
    ],
  },
  {
    table: 'comm_messages',
    insertSql: (tenantId, id) => [
      `INSERT INTO comm_messages (id, tenant_id, channel, direction, recipient, body, status) VALUES ($1, $2, 'email', 'outbound', 'a@x.ma', 'body', 'queued')`,
      [id, tenantId],
    ],
  },
  {
    table: 'comm_templates',
    insertSql: (tenantId, id) => [
      `INSERT INTO comm_templates (id, tenant_id, code, channel, body, locale) VALUES ($1, $2, $3, 'email', 'hi', 'fr')`,
      [id, tenantId, `tpl-${id.slice(0, 6)}`],
    ],
  },
  {
    table: 'doc_documents',
    insertSql: (tenantId, id) => [
      `INSERT INTO doc_documents (id, tenant_id, kind, title, storage_uri) VALUES ($1, $2, 'contract', 'Title', 's3://x/y')`,
      [id, tenantId],
    ],
  },
  {
    table: 'pay_transactions',
    insertSql: (tenantId, id) => [
      `INSERT INTO pay_transactions (id, tenant_id, provider, amount_dirham, currency, status) VALUES ($1, $2, 'cmi', 1000, 'MAD', 'pending')`,
      [id, tenantId],
    ],
  },
  {
    table: 'books_invoices',
    insertSql: (tenantId, id) => [
      `INSERT INTO books_invoices (id, tenant_id, number, total_dirham, currency, status) VALUES ($1, $2, $3, 1000, 'MAD', 'draft')`,
      [id, tenantId, `INV-${id.slice(0, 6)}`],
    ],
  },
  {
    table: 'compliance_consent_logs',
    insertSql: (tenantId, id) => [
      `INSERT INTO compliance_consent_logs (id, tenant_id, subject_id, purpose, granted) VALUES ($1, $2, gen_random_uuid(), 'marketing', true)`,
      [id, tenantId],
    ],
  },
  {
    table: 'analytics_events',
    insertSql: (tenantId, id) => [
      `INSERT INTO analytics_events (id, tenant_id, event_type, occurred_at) VALUES ($1, $2, 'page_view', now())`,
      [id, tenantId],
    ],
  },
  {
    table: 'stock_items',
    insertSql: (tenantId, id) => [
      `INSERT INTO stock_items (id, tenant_id, sku, name, quantity) VALUES ($1, $2, $3, 'Item', 10)`,
      [id, tenantId, `SKU-${id.slice(0, 6)}`],
    ],
  },
  {
    table: 'hr_employees',
    insertSql: (tenantId, id) => [
      `INSERT INTO hr_employees (id, tenant_id, full_name, email, role) VALUES ($1, $2, 'Emp', $3, 'agent')`,
      [id, tenantId, `${id.slice(0, 8)}@hr.test.ma`],
    ],
  },
  {
    table: 'audit_log',
    insertSql: (tenantId, id) => [
      `INSERT INTO audit_log (id, tenant_id, action, resource_type, resource_id, changes) VALUES ($1, $2, 'INSERT', 'test_table', gen_random_uuid(), '{}'::jsonb)`,
      [id, tenantId],
    ],
  },
  {
    table: 'auth_sessions',
    insertSql: (tenantId, id) => [
      `INSERT INTO auth_sessions (id, tenant_id, user_id, refresh_token_hash, expires_at) VALUES ($1, $2, $1, $3, now() + interval '1 day')`,
      [id, tenantId, 'h'.repeat(60)],
    ],
  },
  {
    table: 'crm_interactions',
    insertSql: (tenantId, id) => [
      `INSERT INTO crm_interactions (id, tenant_id, kind, subject, body) VALUES ($1, $2, 'note', 'Subject', 'Body')`,
      [id, tenantId],
    ],
  },
];

describe.skipIf(!DB_AVAILABLE)('rls-multi-tenant integration', () => {
  let ds: DataSource;

  beforeAll(async () => {
    ds = await buildTestDataSource();
    await runAllMigrations(ds);
    await ds.query(
      `INSERT INTO auth_tenants (id, name, type) VALUES ($1, 'Tenant A', 'broker'), ($2, 'Tenant B', 'garage') ON CONFLICT DO NOTHING`,
      [TENANT_A_ID, TENANT_B_ID],
    );
  });

  afterAll(async () => {
    await ds.destroy();
  });

  beforeEach(async () => {
    await truncateAllTables(ds);
    await ds.query(
      `INSERT INTO auth_tenants (id, name, type) VALUES ($1, 'Tenant A', 'broker'), ($2, 'Tenant B', 'garage') ON CONFLICT DO NOTHING`,
      [TENANT_A_ID, TENANT_B_ID],
    );
  });

  for (const c of cases) {
    it(`TC-RLS-MT -- isolates tenant A from tenant B on ${c.table}`, async () => {
      const id = randomUUID();
      const [sql, params] = c.insertSql(TENANT_A_ID, id);
      await withTenant(ds, TENANT_A_ID, async (em) => {
        await em.query(sql, params);
      });
      const visibleFromB = await withTenant(ds, TENANT_B_ID, async (em) =>
        em.query(`SELECT id FROM ${c.table} WHERE id = $1`, [id]),
      );
      expect(visibleFromB.length).toBe(0);
      const visibleFromA = await withTenant(ds, TENANT_A_ID, async (em) =>
        em.query(`SELECT id FROM ${c.table} WHERE id = $1`, [id]),
      );
      expect(visibleFromA.length).toBe(1);
    });
  }
});
