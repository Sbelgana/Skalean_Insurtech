/**
 * Categorisation des routes pour branchement middleware tenant context.
 *
 * Reference : Sprint 6 / Tache 2.2.2.
 */

export enum RouteCategory {
  /** Routes infrastructure : /healthz, /readyz, /docs/*, /metrics. Skip tout. */
  Infrastructure = 'infrastructure',

  /** Routes publiques : /api/v1/public/*. Pas auth, pas tenant. */
  Public = 'public',

  /** Routes admin : /api/v1/admin/*. Super admin, pas tenant courant. */
  Admin = 'admin',

  /** Routes assure (L3 niveau 3) : /api/v1/assure/*. Tenant courant + assureUserId. */
  Assure = 'assure',

  /** Routes tenant standard (default) : /api/v1/*. Tenant courant requis. */
  Tenant = 'tenant',
}
