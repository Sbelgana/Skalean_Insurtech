# Decision 002 -- Multi-tenant 3 Niveaux + RLS Postgres

**Date** : 2025-12
**Statut** : Acceptee
**Decideurs** : Saad (CTO), Abla (CEO)
**ADR mirror** : `repo/docs/architecture/ADR-002-multi-tenant-3-levels.md`

---

## Contexte

Skalean InsurTech sert :
- **Skalean staff** (Platform admin + analysts)
- **Tenants Customer B2B** (cabinets courtiers + garages auto)
- **Assures finaux** (clients des cabinets/garages)

Isolation data critique :
- Cabinet A ne doit PAS voir polices Cabinet B
- Garage Atlas ne doit PAS voir devis Garage Concurrent
- Assure Khalid (cabinet A) ne doit voir QUE ses propres polices

Compliance MA loi 09-08 (CNDP) : isolation stricte = obligatoire reglementaire.

## Probleme adresse

- Isolation stricte multi-tenant 0 leak cross-tenant (zero tolerance)
- Application support 3 niveaux acces : Platform / Tenant / L3 Assure (subset within tenant)
- Cross-tenant authorizations exceptionnelles (Sprint 25 : broker_to_garage_assignment)
- Performance : ne pas degrader queries (1000+ tenants concurrents)
- Defense en profondeur : meme bug application -> RLS bloque leak

## Decision

**Multi-tenant strict 3 niveaux avec RLS Postgres comme derniere ligne de defense**.

Architecture :

**Niveau 1 -- Platform (Skalean staff)** :
- `super_admin_platform` + `analyst_support`
- Bypass RLS via `app_is_super_admin()` Postgres helper
- Routes `/api/v1/admin/*`
- MFA obligatoire

**Niveau 2 -- Customer Tenant** :
- `x-tenant-id` header **mandatory** sauf `/api/v1/public/*` et `/api/v1/admin/*`
- TenantContext propage via AsyncLocalStorage Node.js
- `SET LOCAL app.current_tenant_id` execute automatique avant chaque transaction
- RLS Postgres : `tenant_id = current_setting('app.current_tenant_id')`

**Niveau 3 -- Assure (L3 dans tenant)** :
- Routes `/api/v1/assure/*`
- `app_assure_user_id` filter additionnel
- ABAC : `policies.owner_id = ctx.userId`

Cross-tenant authorizations (Sprint 25) :
- 3 types : broker_to_garage_assignment / assure_to_garage_visit / multi_tenant_user_access
- Helper `app_can_access_tenant(target_tenant_id)` agrege super admin OR same tenant OR cross-tenant auth active

## Avantages

1. **Defense en profondeur** : meme bug app, RLS bloque
2. **Performance** : RLS Postgres natif (pas filtres applicatifs lents)
3. **Compliance CNDP** : isolation auditable + conforme
4. **Flexibilite** : super admin bypass + cross-tenant authz exceptionnels
5. **Conformite ACAPS** : isolation portfolios courtiers stricte

## Inconvenients

1. **Complexite implementation** : Sprint 1 helpers SQL + Sprint 6 middleware
2. **Tests exhaustifs requis** : Sprint 7 + Sprint 33 = 80+ scenarios isolation
3. **Connection pooling complexity** : PgBouncer mode transaction

## Impact technique

- **Sprint 1** : helpers SQL `app_current_tenant()`, `app_is_super_admin()`, `app_can_access_tenant()`
- **Sprint 2** : RLS policies sur 32 tables PARTIE1
- **Sprint 6** : middleware tenant context + interceptor SET LOCAL automatic
- **Sprint 7** : RBAC granulaire (12 roles x 85+ permissions) layered above
- **Sprint 25** : Cross-tenant framework runtime activation

## Communication

Equipe : isolation = NON-NEGOCIABLE. Tout sprint metier doit verifier RLS via tests integration.
ACAPS audit : isolation rapportee dans dossier Programme Emergence.

## References

- Sprint 1 (B-01), 6 (B-06), 25 (B-25) : implementation
- Sprint 33 (B-33) : pentest 50+ multi-tenant isolation tests
- Loi 09-08 CNDP : conformite obligatoire
- ADR-002 : detail technique RLS strategy
