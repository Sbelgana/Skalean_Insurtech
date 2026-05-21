/**
 * RLS cross-tenant isolation tests -- Books tables (Sprint 12 compta).
 *
 * Tables : books_accounts, books_invoices, books_invoice_lines.
 *
 * Reference : Sprint 6 / Tache 2.2.12.
 */

import { describe, it } from 'vitest';

describe.skip('RLS isolation -- Books (Pause #4 to enable)', () => {
  describe('books_accounts', () => {
    it.skip('TC-25 -- INSERT then cross-tenant SELECT returns 0', async () => {});
    it.skip('TC-26 -- UPDATE cross-tenant returns 0 affected', async () => {});
  });

  describe('books_invoices', () => {
    it.skip('TC-27 -- INSERT then cross-tenant SELECT returns 0', async () => {});
    it.skip('TC-28 -- DELETE cross-tenant returns 0 affected (CGNC immutable)', async () => {});
  });

  describe('books_invoice_lines', () => {
    it.skip('TC-29 -- INSERT then cross-tenant SELECT returns 0', async () => {});
  });
});
