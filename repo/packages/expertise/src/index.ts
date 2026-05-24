/**
 * @insurtech/expertise -- Foundation skeleton package (Sprint 7.5b.1).
 *
 * Architecture v3.0 (decision-013 Expert acteur central) :
 *   - Types : Expert / ExpertAssignment / ExpertReport
 *   - Services skeletons (Sprint 7.5b.8) : ExpertService / ExpertReportService
 *   - DB tables (Sprint 7.5b.5/6/7) : insure_experts / insure_expert_assignments / insure_expert_reports
 *
 * Implementations runtime : Sprint 14 (Insure Foundation) + Sprint 22.7 (Expert App).
 * Avant ces sprints, les services throw NotImplementedError.
 *
 * Reference :
 *   - decision-013-expert-acteur-central.md (4 roles + workflow + agrement ACAPS)
 *   - decision-008-data-residency-maroc.md (loi 09-08 CNDP)
 *   - decision-009-signature-loi-43-20.md (Barid eSign rapport expertise)
 *   - B-7.5a + B-7.5b foundation packages.
 */

// Types
export type {
  Expert,
  ExpertSpeciality,
  ExpertStatus,
  RegisterExpertInput,
} from './types/expert.types.js';

export type {
  ExpertAssignment,
  ExpertAssignmentStatus,
  ExpertQuoteDecision,
  DesignateExpertInput,
} from './types/expertise.types.js';

export type {
  ExpertReport,
  ExpertReportStatus,
  CreateExpertReportInput,
  SignExpertReportInput,
} from './types/expert-report.types.js';

// Services skeletons (Sprint 7.5b.8) -- throw NotImplementedError jusqu'a Sprint 14/22.7
export { ExpertService } from './services/expert.service.js';
export { ExpertReportService } from './services/expert-report.service.js';

// Constantes
export const EXPERTISE_PACKAGE_VERSION = '0.1.0';

/**
 * Marker error for skeleton services (Sprint 7.5b.8/9).
 * Thrown by service stubs until Sprint 14/22.5/22.7 implements them.
 */
export class NotImplementedError extends Error {
  constructor(message: string, public readonly targetSprint: string) {
    super(`[NotImplemented -- target Sprint ${targetSprint}] ${message}`);
    this.name = 'NotImplementedError';
  }
}
