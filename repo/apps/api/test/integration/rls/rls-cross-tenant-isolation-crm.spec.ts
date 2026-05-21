/**
 * RLS cross-tenant isolation tests -- CRM tables.
 *
 * Tables : crm_companies, crm_contacts, crm_deals, crm_interactions.
 *
 * Pattern : SET ROLE skalean_app + SET LOCAL app.current_tenant_id.
 * Sprint 1 helper app_can_access_tenant() applique automatiquement.
 *
 * Pause Technique #4 :
 *   Pre-requis : pnpm migration:run sur skalean-postgres-test.
 *   Enabler describe.skip -> describe + it.skip -> it.
 *
 * Reference : Sprint 6 / Tache 2.2.12.
 */

import { describe, it } from 'vitest';

describe.skip('RLS isolation -- CRM (Pause #4 to enable)', () => {
  describe('crm_companies', () => {
    it.skip('TC-1 -- INSERT tenant A then SELECT from tenant B context returns 0 rows', async () => {
      // Setup : create tenant A + B, user A + B linked via auth_tenant_users (via withRlsBypass).
      // Action :
      //   withRlsTenantContext(ds, {tenantId: A, userId: U_A}, em => INSERT crm_companies tenant_id=A)
      //   withRlsTenantContext(ds, {tenantId: B, userId: U_B}, em => SELECT * FROM crm_companies WHERE name=X)
      // Verify : SELECT returns 0 rows.
    });

    it.skip('TC-2 -- UPDATE cross-tenant returns 0 rows affected', async () => {
      // INSERT tenant A. UPDATE from tenant B context. Verify result.affected === 0.
    });

    it.skip('TC-3 -- DELETE cross-tenant returns 0 rows affected', async () => {
      // INSERT tenant A. DELETE from tenant B context. Verify result.affected === 0.
    });

    it.skip('TC-4 -- SELECT same tenant returns N rows', async () => {
      // INSERT 3 rows tenant A. SELECT from tenant A context. Verify 3 rows visible.
    });
  });

  describe('crm_contacts', () => {
    it.skip('TC-5 -- INSERT then cross-tenant SELECT returns 0', async () => {});
    it.skip('TC-6 -- UPDATE cross-tenant returns 0 affected', async () => {});
  });

  describe('crm_deals', () => {
    it.skip('TC-7 -- INSERT then cross-tenant SELECT returns 0', async () => {});
    it.skip('TC-8 -- INSERT WITH CHECK rejects wrong tenant_id', async () => {
      // Tenter INSERT avec tenant_id=A depuis context tenant=B. Verify error or 0.
    });
  });

  describe('crm_interactions', () => {
    it.skip('TC-9 -- INSERT then cross-tenant SELECT returns 0', async () => {});
  });
});
