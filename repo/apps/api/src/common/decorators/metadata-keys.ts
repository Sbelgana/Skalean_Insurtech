/**
 * Metadata keys pour decorators class-level / method-level.
 *
 * Utilises avec NestJS Reflector pour lookup runtime via canActivate().
 *
 * Sprint 3 a deja livre IS_PUBLIC_KEY ('isPublic') dans src/decorators/public.decorator.ts.
 * Sprint 6 ajoute REQUIRE_TENANT_KEY et ADMIN_ONLY_KEY.
 *
 * Reference : Sprint 6 / Tache 2.2.3.
 */

/** Marque controller/method comme requiring TenantContext valide (tenantId non-undefined). */
export const REQUIRE_TENANT_KEY = 'require-tenant';

/** Marque controller/method comme admin-only (isSuperAdmin === true). */
export const ADMIN_ONLY_KEY = 'admin-only';

/** Marque controller/method comme assure L3 only (assureUserId non-undefined). */
export const REQUIRE_ASSURE_KEY = 'require-assure';

// === Sprint 6 Tache 2.2.10 -- SuperAdminGuard fine-grained ===

/** super_admin_platform OR analyst_support (analyst restricted to GET). */
export const SUPER_ADMIN_ONLY_KEY = 'super-admin-only';

/** Explicit allow analyst_support read-only sur cette route. */
export const ANALYST_ALLOWED_KEY = 'analyst-allowed';

/** Explicit write : seul super_admin_platform passe (analyst bloque). */
export const SUPER_ADMIN_WRITE_KEY = 'super-admin-write';
