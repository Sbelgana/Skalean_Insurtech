/**
 * Insure entities barrel -- Sprint 7.5b foundation.
 *
 * 3 entities foundation skeleton (decision-013 Expert acteur central) :
 *   - InsureExpert (Tache 7.5b.5)
 *   - InsureExpertAssignment (Tache 7.5b.6)
 *   - InsureExpertReport (Tache 7.5b.7)
 *
 * Sprint 14 (Insure Foundation) ajoutera : police, quote, contract entities.
 */

export { InsureExpert, type ExpertSpeciality, type ExpertStatus } from './insure-expert.entity.js';
export {
  InsureExpertAssignment,
  type ExpertAssignmentStatus,
} from './insure-expert-assignment.entity.js';
export {
  InsureExpertReport,
  type ExpertReportStatus,
} from './insure-expert-report.entity.js';

import { InsureExpert } from './insure-expert.entity.js';
import { InsureExpertAssignment } from './insure-expert-assignment.entity.js';
import { InsureExpertReport } from './insure-expert-report.entity.js';

export const insureEntities = [
  InsureExpert,
  InsureExpertAssignment,
  InsureExpertReport,
] as const;
