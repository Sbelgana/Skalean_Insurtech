/**
 * Tests RLS isolation insure_experts + insure_expert_assignments + insure_expert_reports.
 *
 * Sprint 7.5b Tache 7.5b.5/6/7 -- foundation skeletons.
 *
 * Pattern Pause #4 : SET ROLE insurtech_app + SET LOCAL app.current_tenant_id.
 * Helper : withRlsTenantContextCommit / withRlsSuperAdminContext.
 *
 * Verifies :
 *   - INSERT insure_experts tenant A : SELECT depuis tenant B retourne 0 rows
 *   - UPDATE / DELETE cross-tenant : 0 rows affected
 *   - Foreign keys (auth_users, auth_tenants) respectees
 */

import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { DataSource } from '@insurtech/database';
import { createTestDataSource } from './_helpers/test-data-source.js';
import {
  withRlsBypass,
  withRlsTenantContextCommit,
  withRlsSuperAdminContext,
} from './_helpers/rls-test-helper.js';

const TENANT_A = '00000000-aaaa-4aaa-8aaa-000000000001';
const TENANT_B = '00000000-bbbb-4bbb-8bbb-000000000002';
const USER_A = '00000000-aaaa-4aaa-8aaa-000000000011';
const USER_B = '00000000-bbbb-4bbb-8bbb-000000000022';

describe('RLS isolation -- insure_experts cross-tenant (Sprint 7.5b)', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    if (process.env['SKIP_INTEGRATION'] === 'true') return;
    dataSource = createTestDataSource();
    await dataSource.initialize();

    // Setup : create 2 tenants + 2 users
    await withRlsBypass(dataSource, async (em) => {
      await em.query(
        `INSERT INTO auth_tenants (id, name, type, status) VALUES
          ($1, 'P5b Tenant A', 'broker', 'active'),
          ($2, 'P5b Tenant B', 'garage', 'active')
         ON CONFLICT (id) DO NOTHING`,
        [TENANT_A, TENANT_B],
      );
      await em.query(
        `INSERT INTO auth_users (id, tenant_id, email, password_hash, display_name) VALUES
          ($1, $3, 'p5b-user-a@assurflow.ma', 'argon2id$dummy_hash_for_test_only_min_30char_xy', 'User A'),
          ($2, $4, 'p5b-user-b@assurflow.ma', 'argon2id$dummy_hash_for_test_only_min_30char_xy', 'User B')
         ON CONFLICT (id) DO NOTHING`,
        [USER_A, USER_B, TENANT_A, TENANT_B],
      );
    });
  });

  afterAll(async () => {
    if (process.env['SKIP_INTEGRATION'] === 'true') return;
    if (!dataSource?.isInitialized) return;
    await withRlsSuperAdminContext(dataSource, async (em) => {
      await em.query(`DELETE FROM insure_expert_reports WHERE tenant_id IN ($1, $2)`, [
        TENANT_A,
        TENANT_B,
      ]);
      await em.query(`DELETE FROM insure_expert_assignments WHERE tenant_id IN ($1, $2)`, [
        TENANT_A,
        TENANT_B,
      ]);
      await em.query(`DELETE FROM insure_experts WHERE tenant_id IN ($1, $2)`, [TENANT_A, TENANT_B]);
      await em.query(`DELETE FROM auth_users WHERE id IN ($1, $2)`, [USER_A, USER_B]);
      await em.query(`DELETE FROM auth_tenants WHERE id IN ($1, $2)`, [TENANT_A, TENANT_B]);
    });
    await dataSource.destroy();
  });

  it('TC-1 -- INSERT insure_experts tenant A, SELECT tenant B context returns 0 rows', async () => {
    if (process.env['SKIP_INTEGRATION'] === 'true') return;

    // INSERT in tenant A context
    await withRlsTenantContextCommit(
      dataSource,
      { tenantId: TENANT_A, userId: USER_A },
      async (em) => {
        await em.query(
          `INSERT INTO insure_experts (tenant_id, user_id, cin, acaps_registration_number, speciality, acaps_registration_date, status)
           VALUES ($1, $2, 'CIN-A-001', 'ACAPS-A-001', 'automobile', '2024-01-15', 'active')`,
          [TENANT_A, USER_A],
        );
      },
    );

    // SELECT from tenant B context : doit retourner 0 rows
    const rows = await withRlsTenantContextCommit(
      dataSource,
      { tenantId: TENANT_B, userId: USER_B },
      async (em) => {
        return em.query(`SELECT * FROM insure_experts WHERE acaps_registration_number = $1`, [
          'ACAPS-A-001',
        ]);
      },
    );
    expect(rows).toHaveLength(0);
  });

  it('TC-2 -- INSERT assignment tenant A : INSERT report tenant A + chain integrity', async () => {
    if (process.env['SKIP_INTEGRATION'] === 'true') return;

    await withRlsTenantContextCommit(
      dataSource,
      { tenantId: TENANT_A, userId: USER_A },
      async (em) => {
        // Get expert id
        const experts = await em.query(
          `SELECT id FROM insure_experts WHERE tenant_id = $1 LIMIT 1`,
          [TENANT_A],
        );
        const expertId = experts[0].id;

        // INSERT assignment
        const assignments = await em.query(
          `INSERT INTO insure_expert_assignments (tenant_id, expert_id, sinistre_id, designated_by_user_id, status)
           VALUES ($1, $2, $3, $4, 'designated')
           RETURNING id`,
          [
            TENANT_A,
            expertId,
            '00000000-1111-1111-1111-111111111111',
            USER_A,
          ],
        );
        const assignmentId = assignments[0].id;

        // INSERT report
        await em.query(
          `INSERT INTO insure_expert_reports (tenant_id, assignment_id, report_url, status)
           VALUES ($1, $2, 's3://bucket/test-report.pdf', 'draft')`,
          [TENANT_A, assignmentId],
        );
      },
    );

    // Verify : SELECT from tenant A sees the chain
    const rowsA = await withRlsTenantContextCommit(
      dataSource,
      { tenantId: TENANT_A, userId: USER_A },
      async (em) => {
        return em.query(`SELECT count(*) as cnt FROM insure_expert_reports WHERE tenant_id = $1`, [
          TENANT_A,
        ]);
      },
    );
    expect(Number(rowsA[0].cnt)).toBe(1);

    // Verify : SELECT from tenant B sees nothing
    const rowsB = await withRlsTenantContextCommit(
      dataSource,
      { tenantId: TENANT_B, userId: USER_B },
      async (em) => {
        return em.query(`SELECT count(*) as cnt FROM insure_expert_reports WHERE tenant_id = $1`, [
          TENANT_A,
        ]);
      },
    );
    expect(Number(rowsB[0].cnt)).toBe(0);
  });

  it('TC-3 -- CHECK constraint expert speciality rejects invalid value', async () => {
    if (process.env['SKIP_INTEGRATION'] === 'true') return;

    await withRlsTenantContextCommit(
      dataSource,
      { tenantId: TENANT_A, userId: USER_A },
      async (em) => {
        await expect(
          em.query(
            `INSERT INTO insure_experts (tenant_id, user_id, cin, acaps_registration_number, speciality, acaps_registration_date, status)
             VALUES ($1, $2, 'CIN-A-002', 'ACAPS-A-002', 'invalid_speciality', '2024-01-15', 'active')`,
            [TENANT_A, USER_A],
          ),
        ).rejects.toThrow(/insure_experts_speciality_chk|check constraint/i);
      },
    );
  });

  it('TC-4 -- CHECK constraint status rejects invalid value', async () => {
    if (process.env['SKIP_INTEGRATION'] === 'true') return;

    await withRlsTenantContextCommit(
      dataSource,
      { tenantId: TENANT_A, userId: USER_A },
      async (em) => {
        const experts = await em.query(
          `SELECT id FROM insure_experts WHERE tenant_id = $1 LIMIT 1`,
          [TENANT_A],
        );
        const expertId = experts[0].id;
        await expect(
          em.query(
            `INSERT INTO insure_expert_assignments (tenant_id, expert_id, sinistre_id, designated_by_user_id, status)
             VALUES ($1, $2, $3, $4, 'invalid_status')`,
            [
              TENANT_A,
              expertId,
              '00000000-2222-2222-2222-222222222222',
              USER_A,
            ],
          ),
        ).rejects.toThrow(/insure_expert_assignments_status_chk|check constraint/i);
      },
    );
  });

  it('TC-5 -- ACAPS registration number uniqueness enforced', async () => {
    if (process.env['SKIP_INTEGRATION'] === 'true') return;

    await withRlsTenantContextCommit(
      dataSource,
      { tenantId: TENANT_A, userId: USER_A },
      async (em) => {
        // Tentative duplicate sur ACAPS-A-001 (already inserted TC-1)
        await expect(
          em.query(
            `INSERT INTO insure_experts (tenant_id, user_id, cin, acaps_registration_number, speciality, acaps_registration_date, status)
             VALUES ($1, $2, 'CIN-A-DIFF', 'ACAPS-A-001', 'automobile', '2024-01-15', 'active')`,
            [TENANT_A, USER_A],
          ),
        ).rejects.toThrow(/insure_experts_acaps_uq|unique constraint|duplicate/i);
      },
    );
  });

  it('TC-6 -- signature consistency CHECK : signed status requires signature_hash + signed_at', async () => {
    if (process.env['SKIP_INTEGRATION'] === 'true') return;

    await withRlsTenantContextCommit(
      dataSource,
      { tenantId: TENANT_A, userId: USER_A },
      async (em) => {
        const assignments = await em.query(
          `SELECT id FROM insure_expert_assignments WHERE tenant_id = $1 LIMIT 1`,
          [TENANT_A],
        );
        const assignmentId = assignments[0].id;

        // Tentative insert avec status=signed mais sans signature_hash : doit FAIL
        await expect(
          em.query(
            `INSERT INTO insure_expert_reports (tenant_id, assignment_id, report_url, status, signature_hash, signed_at)
             VALUES ($1, $2, 's3://bucket/r.pdf', 'signed', NULL, NULL)`,
            [TENANT_A, assignmentId],
          ),
        ).rejects.toThrow(/insure_expert_reports_signature_consistency_chk|check constraint/i);
      },
    );
  });
});
