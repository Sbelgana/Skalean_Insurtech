/**
 * RLS super admin bypass tests.
 *
 * Verifie que `set_config(app.is_super_admin, 'true', true)` permet a la session
 * de voir tous les tenants via helper Sprint 1 app_can_access_tenant() Cond 1.
 *
 * Reference : Sprint 6 / Tache 2.2.12.
 */

import { describe, it } from 'vitest';

describe.skip('RLS super admin bypass (Pause #4 to enable)', () => {
  it.skip('TC-45 -- super admin SELECT crm_companies returns all tenants', async () => {
    // Setup : INSERT rows tenant A, B, C (3 differents via withRlsBypass).
    // Action : withRlsSuperAdminContext, SELECT * FROM crm_companies.
    // Verify : retourne 3 rows (cross-tenant visible).
  });

  it.skip('TC-46 -- super admin UPDATE cross-tenant affects all rows', async () => {
    // INSERT rows tenant A, B. UPDATE under super admin context.
    // Verify : 2 rows affected.
  });

  it.skip('TC-47 -- super admin DELETE cross-tenant works', async () => {
    // INSERT row tenant A. DELETE under super admin context.
    // Verify : 1 row affected.
  });

  it.skip('TC-48 -- super admin set_config app.is_super_admin = false reverts to RLS', async () => {
    // Set is_super_admin=true, SELECT all. Then set is_super_admin=false
    // (via reset SET LOCAL to '', simulate non-admin). SELECT should respect RLS.
  });

  it.skip('TC-49 -- super admin bypass not active without set_config (defense in depth)', async () => {
    // withRlsTenantContext sans isSuperAdmin et sans tenantId.
    // Verify : SELECT returns 0 rows (pas de leak).
  });
});
