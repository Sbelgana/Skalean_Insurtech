/**
 * RLS cross-tenant isolation tests -- HR tables (Sprint 13 paie CNSS/AMO).
 *
 * Tables : hr_employees, hr_payslips (Sprint 13).
 *
 * Reference : Sprint 6 / Tache 2.2.12.
 */

import { describe, it } from 'vitest';

describe.skip('RLS isolation -- HR (Pause #4 to enable)', () => {
  describe('hr_employees', () => {
    it.skip('TC-39 -- INSERT then cross-tenant SELECT returns 0', async () => {});
    it.skip('TC-40 -- PII redaction enforced (CIN, phone)', async () => {
      // Verifier que cross-tenant ne leak meme pas count metadata.
    });
  });
});
