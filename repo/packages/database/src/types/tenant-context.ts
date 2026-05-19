/**
 * TenantContext -- Skalean InsurTech.
 *
 * Structure passee aux helpers transactionnels withTenantContext pour
 * positionner les variables de session Postgres utilisees par les policies RLS
 * (decision-002 RLS strict, decision-003 multi-tenant 3 niveaux).
 *
 * - tenantId : UUID tenant courtier. Null uniquement si isSuperAdmin = true.
 * - userId : UUID collaborateur courtier ou super admin. Null pour jobs systeme.
 * - assureUserId : UUID assure final (extranet client). Null si contexte courtier.
 * - isSuperAdmin : true uniquement super admin global Skalean (RLS bypass).
 */
export interface TenantContext {
  readonly tenantId: string | null;
  readonly userId: string | null;
  readonly assureUserId: string | null;
  readonly isSuperAdmin: boolean;
}
