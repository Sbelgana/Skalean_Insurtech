/**
 * ExpertReportService -- Sprint 7.5b.8 skeleton signatures.
 *
 * Implementations runtime : Sprint 14 (Insure Foundation) + Sprint 10 (signature integration).
 *
 * Signatures :
 *   - createReport : INSERT insure_expert_reports (status=draft)
 *   - signReport : Barid eSign (loi 43-20) -> status=signed + signature_hash + signed_at
 *   - getReportByAssignment : fetch single report par assignment_id
 */

import { NotImplementedError } from '../index.js';
import type {
  CreateExpertReportInput,
  ExpertReport,
  SignExpertReportInput,
} from '../types/expert-report.types.js';

const TARGET_SPRINT_REPORTS = 'Sprint 14';
const TARGET_SPRINT_SIGNATURE = 'Sprint 10 (Barid eSign integration)';

export class ExpertReportService {
  /**
   * Cree un rapport d'expertise lie a une assignment.
   *
   * Validations (Sprint 14) :
   * - assignment doit etre status='accepted' (workflow ACAPS)
   * - report_url format S3/MinIO Atlas Cloud Services (decision-008 residence MA)
   * - tenant_id automatique via RLS
   */
  async createReport(_input: CreateExpertReportInput): Promise<ExpertReport> {
    throw new NotImplementedError('createReport', TARGET_SPRINT_REPORTS);
  }

  /**
   * Signe electroniquement un rapport via Barid eSign (loi 43-20).
   *
   * Implementation Sprint 10 (signature service) + Sprint 14 (workflow).
   *
   * Workflow :
   * 1. fetch report status='submitted'
   * 2. call @insurtech/signature service -> signature Barid eSign
   * 3. archive PDF + SHA-256 hash
   * 4. UPDATE status='signed' + signature_hash + signed_at
   * 5. CHECK constraint signature_consistency_chk verifie integrite (migration 7.5b.7)
   */
  async signReport(_input: SignExpertReportInput): Promise<ExpertReport> {
    throw new NotImplementedError('signReport', TARGET_SPRINT_SIGNATURE);
  }

  /**
   * Recupere le rapport d'une assignment specifique.
   *
   * RLS automatique (tenant_id scope).
   */
  async getReportByAssignment(_assignmentId: string): Promise<ExpertReport | null> {
    throw new NotImplementedError('getReportByAssignment', TARGET_SPRINT_REPORTS);
  }
}
