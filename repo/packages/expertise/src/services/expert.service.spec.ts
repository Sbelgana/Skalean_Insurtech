/**
 * Tests skeleton ExpertService + ExpertReportService -- Sprint 7.5b.8.
 *
 * Verifie que les signatures throw NotImplementedError avec sprint target correct.
 */

import { describe, expect, it } from 'vitest';
import { ExpertService } from './expert.service.js';
import { ExpertReportService } from './expert-report.service.js';
import { NotImplementedError } from '../index.js';

describe('ExpertService skeleton (Sprint 7.5b.8)', () => {
  const service = new ExpertService();

  it('1. registerExpert throws NotImplementedError targeting Sprint 14', async () => {
    await expect(
      service.registerExpert({
        tenantId: 't',
        userId: 'u',
        cin: 'CIN12345',
        acapsRegistrationNumber: 'ACAPS-001',
        speciality: 'automobile',
        acapsRegistrationDate: new Date(),
      }),
    ).rejects.toThrow(NotImplementedError);
  });

  it('2. registerExpert error message contains Sprint 14', async () => {
    try {
      await service.registerExpert({
        tenantId: 't',
        userId: 'u',
        cin: 'CIN',
        acapsRegistrationNumber: 'A',
        speciality: 'automobile',
        acapsRegistrationDate: new Date(),
      });
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as NotImplementedError).targetSprint).toBe('Sprint 14');
    }
  });

  it('3. listExperts throws NotImplementedError', async () => {
    await expect(service.listExperts()).rejects.toThrow(NotImplementedError);
  });

  it('4. designateExpertForSinistre throws NotImplementedError', async () => {
    await expect(
      service.designateExpertForSinistre({
        tenantId: 't',
        expertId: 'e',
        sinistreId: 's',
        designatedByUserId: 'u',
      }),
    ).rejects.toThrow(NotImplementedError);
  });
});

describe('ExpertReportService skeleton (Sprint 7.5b.8)', () => {
  const service = new ExpertReportService();

  it('5. createReport throws NotImplementedError targeting Sprint 14', async () => {
    await expect(
      service.createReport({
        tenantId: 't',
        assignmentId: 'a',
        reportUrl: 's3://bucket/r.pdf',
      }),
    ).rejects.toThrow(NotImplementedError);
  });

  it('6. signReport throws NotImplementedError targeting Sprint 10 (signature)', async () => {
    try {
      await service.signReport({
        reportId: 'r',
        signedByUserId: 'u',
        signatureHash: 'sha256:abc',
      });
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as NotImplementedError).targetSprint).toContain('Sprint 10');
    }
  });

  it('7. getReportByAssignment throws NotImplementedError', async () => {
    await expect(service.getReportByAssignment('a')).rejects.toThrow(NotImplementedError);
  });

  it('8. error names + instances coherents', async () => {
    try {
      await service.getReportByAssignment('x');
    } catch (err) {
      expect(err).toBeInstanceOf(NotImplementedError);
      expect((err as Error).name).toBe('NotImplementedError');
    }
  });
});
