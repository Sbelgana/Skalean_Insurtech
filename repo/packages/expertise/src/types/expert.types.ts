/**
 * Expert types -- Sprint 7.5b foundation skeleton (decision-013).
 *
 * Sprint 14 (Insure Foundation) creera implementations + DB sync.
 * Sprint 22.7 (Expert App) consumera ces types pour UI.
 *
 * ACAPS compliance : `acapsRegistrationNumber` obligatoire pour experts independants
 * (loi 17-99 + agrement ACAPS). Decision-013 materialise independance vs garage.
 */

/** Statut de l'expert dans le systeme (cycle de vie ACAPS). */
export type ExpertStatus = 'pending' | 'active' | 'suspended' | 'archived';

/** Specialite d'expertise (Sprint 14 etendra). */
export type ExpertSpeciality = 'automobile' | 'dommage_corporel' | 'responsabilite_civile';

/**
 * Profil expert (correspond a la table insure_experts -- Sprint 7.5b.5).
 *
 * tenant_id obligatoire (RLS multi-tenant) :
 *   - expert_independent / expert_firm_admin / expert_associate : tenant Expert
 *   - expert_carrier_internal : tenant Carrier (salarie)
 *   JAMAIS tenant Garage (regle ACAPS independance, decision-013).
 */
export interface Expert {
  readonly id: string;
  readonly tenantId: string;
  readonly userId: string;
  readonly cin: string;
  readonly acapsRegistrationNumber: string;
  readonly speciality: ExpertSpeciality;
  readonly acapsRegistrationDate: Date;
  readonly status: ExpertStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** Input registration expert (Sprint 14 service signature). */
export interface RegisterExpertInput {
  readonly tenantId: string;
  readonly userId: string;
  readonly cin: string;
  readonly acapsRegistrationNumber: string;
  readonly speciality: ExpertSpeciality;
  readonly acapsRegistrationDate: Date;
}
