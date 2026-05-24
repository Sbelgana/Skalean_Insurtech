/**
 * Tests bootstrap @insurtech/expertise -- Sprint 7.5b.1.
 *
 * Verifie :
 *   - Package importable
 *   - Types compilables
 *   - NotImplementedError fonctionne
 *   - Types structure cohrente
 */

import { describe, expect, it } from 'vitest';
import {
  EXPERTISE_PACKAGE_VERSION,
  NotImplementedError,
  type Expert,
  type ExpertAssignment,
  type ExpertReport,
  type ExpertAssignmentStatus,
  type ExpertReportStatus,
  type ExpertSpeciality,
  type ExpertStatus,
} from './index.js';

describe('@insurtech/expertise bootstrap (Sprint 7.5b.1)', () => {
  it('1. exposes package version', () => {
    expect(EXPERTISE_PACKAGE_VERSION).toBe('0.1.0');
  });

  it('2. NotImplementedError throws with sprint target', () => {
    const err = new NotImplementedError('test method', 'Sprint 14');
    expect(err.name).toBe('NotImplementedError');
    expect(err.message).toContain('Sprint 14');
    expect(err.targetSprint).toBe('Sprint 14');
    expect(err).toBeInstanceOf(Error);
  });

  it('3. Expert type accepts valid expert (compile + runtime check)', () => {
    const expert: Expert = {
      id: '00000000-0000-0000-0000-000000000001',
      tenantId: '00000000-0000-0000-0000-000000000002',
      userId: '00000000-0000-0000-0000-000000000003',
      cin: 'CIN12345',
      acapsRegistrationNumber: 'ACAPS-2026-0042',
      speciality: 'automobile',
      acapsRegistrationDate: new Date('2024-01-15'),
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(expert.status).toBe('active');
    expect(expert.speciality).toBe('automobile');
  });

  it('4. ExpertAssignment type accepts valid assignment (5 statuts ACAPS)', () => {
    const statuses: ExpertAssignmentStatus[] = [
      'designated',
      'accepted',
      'rejected',
      'completed',
      'cancelled',
    ];
    expect(statuses).toHaveLength(5);

    const assignment: ExpertAssignment = {
      id: 'a',
      tenantId: 't',
      expertId: 'e',
      sinistreId: 's',
      designatedByUserId: 'u',
      status: 'designated',
      designatedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(assignment.status).toBe('designated');
  });

  it('5. ExpertReport type accepts valid report (5 statuts)', () => {
    const statuses: ExpertReportStatus[] = ['draft', 'submitted', 'signed', 'archived', 'rejected'];
    expect(statuses).toHaveLength(5);

    const report: ExpertReport = {
      id: 'r',
      tenantId: 't',
      assignmentId: 'a',
      reportUrl: 's3://bucket/report.pdf',
      status: 'signed',
      signedAt: new Date(),
      signatureHash: 'sha256:abc',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(report.status).toBe('signed');
    expect(report.signatureHash).toContain('sha256');
  });

  it('6. ExpertSpeciality / ExpertStatus compile-time validation', () => {
    const specialities: ExpertSpeciality[] = [
      'automobile',
      'dommage_corporel',
      'responsabilite_civile',
    ];
    const statuses: ExpertStatus[] = ['pending', 'active', 'suspended', 'archived'];
    expect(specialities).toHaveLength(3);
    expect(statuses).toHaveLength(4);
  });
});
