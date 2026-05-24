/**
 * ExpertService -- Sprint 7.5b.8 skeleton signatures.
 *
 * Implementations runtime : Sprint 14 (Insure Foundation).
 *
 * Signatures definies pour permettre l'evolution coherente :
 *   - registerExpert : inscription ACAPS d'un expert (verification + INSERT insure_experts)
 *   - listExperts : liste tenant-scoped (Carrier voit son pool)
 *   - designateExpertForSinistre : creation insure_expert_assignments + cross-tenant auth
 *
 * Sprint 22.7 (Expert App) consumera via API endpoints.
 */

import { NotImplementedError } from '../index.js';
import type {
  Expert,
  RegisterExpertInput,
} from '../types/expert.types.js';
import type { DesignateExpertInput, ExpertAssignment } from '../types/expertise.types.js';

const TARGET_SPRINT = 'Sprint 14';

export class ExpertService {
  /**
   * Inscrit un nouvel expert dans le tenant.
   *
   * Validations attendues (Sprint 14) :
   * - acapsRegistrationNumber unique
   * - cin format valide (CIN MA)
   * - tenant doit etre de type Expert OU Carrier (decision-013)
   * - utilisateur referenced doit avoir un role expert_* (RBAC v3.0)
   */
  async registerExpert(_input: RegisterExpertInput): Promise<Expert> {
    throw new NotImplementedError('registerExpert', TARGET_SPRINT);
  }

  /**
   * Liste les experts du tenant courant. tenant_id automatique via RLS.
   *
   * Pour Carrier : retourne son pool (carrier_expert_manager / claims_manager).
   * Pour Expert : retourne ses associes (firm_admin).
   */
  async listExperts(_filters?: { speciality?: string; status?: string }): Promise<Expert[]> {
    throw new NotImplementedError('listExperts', TARGET_SPRINT);
  }

  /**
   * Designe un expert pour un sinistre (workflow decision-013).
   *
   * Cree :
   * - INSERT insure_expert_assignments (status=designated)
   * - Cross-tenant authorization Sprint 7.5a (carrier -> expert tenant)
   * - Notification expert (Sprint 9 Comm)
   *
   * Verifications :
   * - designated_by_user_id doit avoir role carrier_claims_manager OU carrier_expert_manager
   * - expert doit etre status='active'
   * - sinistre doit exister + appartenir a la compagnie qui designe
   */
  async designateExpertForSinistre(_input: DesignateExpertInput): Promise<ExpertAssignment> {
    throw new NotImplementedError('designateExpertForSinistre', TARGET_SPRINT);
  }
}
