/**
 * RLS cross-tenant isolation tests -- Analytics tables (Sprint 13).
 *
 * Tables : analytics_events (et autres a venir Sprint 13).
 *
 * Reference : Sprint 6 / Tache 2.2.12.
 */

import { describe, it } from 'vitest';

describe.skip('RLS isolation -- Analytics (Pause #4 to enable)', () => {
  describe('analytics_events', () => {
    it.skip('TC-35 -- INSERT then cross-tenant SELECT returns 0', async () => {});
    it.skip('TC-36 -- Aggregate query across tenants reveals zero leak', async () => {
      // SELECT COUNT(*) FROM analytics_events sous tenant B context
      // doit ignorer rows tenant A. Aggregate hides nothing.
    });
  });
});
