/**
 * RLS cross-tenant isolation tests -- Docs tables.
 *
 * Tables : docs_documents, docs_signatures (Sprint 10+ enrichi).
 *
 * Reference : Sprint 6 / Tache 2.2.12.
 */

import { describe, it } from 'vitest';

describe.skip('RLS isolation -- Docs (Pause #4 to enable)', () => {
  describe('docs_documents', () => {
    it.skip('TC-16 -- INSERT then cross-tenant SELECT returns 0', async () => {});
    it.skip('TC-17 -- UPDATE cross-tenant returns 0 affected', async () => {});
    it.skip('TC-18 -- DELETE cross-tenant returns 0 affected', async () => {});
  });

  describe('docs_signatures', () => {
    it.skip('TC-19 -- INSERT then cross-tenant SELECT returns 0', async () => {});
  });
});
