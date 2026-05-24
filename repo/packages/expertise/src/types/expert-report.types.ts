/**
 * Expert Report types -- Sprint 7.5b foundation skeleton (decision-013 + decision-009).
 *
 * Rapport d'expertise = donnees d'assure soumises a :
 *   - residence MA Atlas Cloud Services Benguerir (decision-008 loi 09-08 CNDP)
 *   - signature electronique loi 43-20 via Barid eSign (decision-009)
 *
 * Sprint 14 + 22.7 implementeront stockage S3/MinIO + signature flow.
 */

/** Statut du rapport d'expertise. */
export type ExpertReportStatus = 'draft' | 'submitted' | 'signed' | 'archived' | 'rejected';

/**
 * Rapport d'expertise (correspond a la table insure_expert_reports -- Sprint 7.5b.7).
 *
 * `signature_hash` est le hash de l'archive PDF signee via Barid eSign (loi 43-20).
 * Empty si status = 'draft' ou 'submitted'.
 */
export interface ExpertReport {
  readonly id: string;
  readonly tenantId: string;
  readonly assignmentId: string;
  readonly reportUrl: string;
  readonly signatureHash?: string | null;
  readonly signedAt?: Date | null;
  readonly status: ExpertReportStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** Input creation rapport (Sprint 14 service signature). */
export interface CreateExpertReportInput {
  readonly tenantId: string;
  readonly assignmentId: string;
  readonly reportUrl: string;
}

/** Input signature rapport via Barid eSign (Sprint 14 + Sprint 10 signature integration). */
export interface SignExpertReportInput {
  readonly reportId: string;
  readonly signedByUserId: string;
  readonly signatureHash: string;
}
