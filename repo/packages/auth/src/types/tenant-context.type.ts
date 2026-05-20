/**
 * @insurtech/auth/types/tenant-context
 *
 * Types pour le contexte multi-tenant 3 niveaux Skalean InsurTech v2.2.
 *
 * Reference :
 *   - Sprint 6 / Tache 2.2.1
 *   - decision-002-multi-tenant-3-niveaux
 *
 * Le TenantContext est stocke dans AsyncLocalStorage (instance globale tenantContextStorage)
 * et accessible via TenantContextService partout dans la pile d'appel d'une request.
 */

import type { AuthRole } from './auth-roles.js';

/**
 * Settings d'un tenant fetches une fois par request et caches dans le contexte
 * pour eviter les multiples acces DB pendant le traitement de la request.
 *
 * Source : `auth_tenants.settings jsonb` (Sprint 2 schema PARTIE1).
 */
export interface TenantSettings {
  /** Locale par defaut du tenant : 'fr' (default Maroc) | 'ar-MA' | 'ar' | 'en'. */
  locale: 'fr' | 'ar-MA' | 'ar' | 'en';

  /** Fuseau horaire du tenant. Default 'Africa/Casablanca' (UTC+1 sans DST). */
  timezone: string;

  /** Devise par defaut du tenant. Default 'MAD' (Maroc). */
  currency: 'MAD' | 'EUR' | 'USD';

  /** Branding personnalise tenant (couleurs, logo). */
  branding: {
    primaryColor: string;
    secondaryColor?: string;
    logoUrl: string | null;
    faviconUrl?: string | null;
  };

  /** Feature flags par tenant. */
  features: {
    mfaRequiredForAdmin: boolean;
    sinistreAutoAssign: boolean;
    skySandboxEnabled?: boolean;
    aiEstimationEnabled?: boolean;
  };

  /** Quotas par tenant (Tache 2.2.11 ResourceQuotaService). */
  quotas: {
    maxUsers: number;
    maxPolices: number;
    maxStorageGb: number;
  };

  /** Identite legale ICE Maroc (optionnel onboarding, mandatory production). */
  ice?: string;

  /** Type de tenant. */
  tenantType: 'broker' | 'garage' | 'mixed';
}

/**
 * Contexte runtime d'une request HTTP propage via AsyncLocalStorage.
 *
 * Construit par `TenantContextMiddleware` (Tache 2.2.2) au debut de chaque request,
 * accessible via `TenantContextService.getCurrentContext()` partout dans la request.
 *
 * Tous les champs sont `readonly` pour empecher les mutations directes.
 * Pour modifier un champ : `runWithUpdatedContext(updates, fn)`.
 */
export interface TenantContext {
  // ===== NIVEAU 2 -- Customer Tenant =====
  /**
   * UUID du tenant courant. `undefined` pour routes admin (`/api/v1/admin/*`)
   * et routes publiques (`/api/v1/public/*`).
   */
  readonly tenantId?: string;

  /** Settings du tenant courant (cache request-scoped, evite re-fetch DB). */
  readonly tenantSettings?: TenantSettings;

  // ===== NIVEAU 1 -- Platform (Skalean operations) =====
  /**
   * `true` si l'utilisateur courant est super_admin_platform OU analyst_support
   * accedant via routes `/api/v1/admin/*`. Permet bypass RLS Postgres.
   */
  readonly isSuperAdmin: boolean;

  // ===== NIVEAU 3 -- Assure (L3, Sprint 19+) =====
  /**
   * UUID de l'utilisateur assure si la request provient de `/api/v1/assure/*`.
   * Filtre additionnel pour limiter visibilite aux ressources de cet assure
   * (au sein du tenant courtier qui le gere).
   */
  readonly assureUserId?: string;

  // ===== Identite utilisateur =====
  /** UUID de l'utilisateur authentifie. `undefined` pour routes publiques anonymes. */
  readonly userId?: string;

  /** Role applicatif de l'utilisateur dans le tenant courant. */
  readonly userRole?: AuthRole;

  // ===== Cross-tenant authorizations (Sprint 26 framework) =====
  /**
   * UUID d'une cross-tenant authorization active si la request utilise
   * un header `x-cross-tenant-auth-id`. Sprint 26 implementera runtime usage.
   */
  readonly crossTenantAuthorizationId?: string;

  // ===== Observability (heritage Sprint 3 RequestContext) =====
  /** Trace ID propage W3C Trace Context (header `traceparent` ou genere). */
  readonly traceId: string;

  /** Correlation ID applicatif (header `x-correlation-id`). */
  readonly correlationId?: string;

  /** Adresse IP source (parsed from X-Forwarded-For si reverse proxy). */
  readonly ipAddress: string;

  /** User-Agent header complet. */
  readonly userAgent: string;
}

/**
 * Type partiel pour `runWithUpdatedContext` permettant de modifier
 * UN sous-ensemble de champs en heritant le reste du contexte courant.
 */
export type TenantContextUpdate = Partial<TenantContext>;

/**
 * Builder type pour construire un contexte minimal valide
 * (utilise par middleware Tache 2.2.2 et tests).
 */
export type TenantContextInit = Pick<
  TenantContext,
  'isSuperAdmin' | 'traceId' | 'ipAddress' | 'userAgent'
> &
  Partial<TenantContext>;
