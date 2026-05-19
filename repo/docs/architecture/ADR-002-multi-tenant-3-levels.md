# ADR-002 : Multi-tenant 3 niveaux

**Date** : 2026-01-15
**Statut** : Acceptee
**Decideurs** : Saad Belgana (CTO), Abla Ait Kassi (CEO)
**Mirror** : `00-pilotage/decisions/002-multi-tenant-3-niveaux.md`

## Contexte

Plateforme assurance Maroc soumise a ACAPS, AMC, CNDP. Doit supporter :
- Skalean Platform (super admins)
- Customer tenants (courtiers Wafa, Atlanta, Saham, RMA + garages)
- Assures finaux (clients courtiers/garages)

Une violation cross-tenant (e.g. courtier voit donnees autre courtier) = scandale + amendes CNDP.

## Decision

**Strategie multi-tenant 3 niveaux avec defense en profondeur 4 couches** :

### 3 niveaux
- L1 Platform : Skalean SARL super admins (bypass RLS)
- L2 Customer Tenant : courtiers, garages, compagnies (chacun son tenant_id)
- L3 Assure : clients finaux (visibilite restreinte a SES propres polices/sinistres)

### 4 couches defense
1. Application : TenantContext AsyncLocalStorage Node.js + TypeORM Subscriber
2. API : TenantGuard NestJS verifie x-tenant-id header
3. DB (RLS Postgres) : policies appellent helpers SQL `app_can_access_tenant`
4. Audit : log chaque acces avec tenant_id + user_id + request_id

### Mecanisme RLS
- Variable session `app.current_tenant_id` settable via `SET LOCAL`
- Helper `app_current_tenant()` lit cette variable
- RLS policies sur chaque table : `USING (app_can_access_tenant(tenant_id))`
- Postgres injecte filter automatiquement, impossible a oublier

## Consequences

### Positives (+)
- Defense en profondeur (4 couches)
- Conformite ACAPS, AMC, CNDP
- Scale a 10000+ tenants

### Negatives (-)
- Overhead RLS ~2-5% queries simples
- Discipline `SET LOCAL` requise debut chaque transaction authentifiee
- Tests integration RLS isolation 50+ scenarios necessaires

## References

- decision-002 (mirror)
- Sprint 1 (B-01) Tache 1.1.4 : helpers SQL RLS
- Sprint 6 (B-06) : Multi-tenant runtime TenantContext
- 8-skalean-insurtech-prompt-master.md Section 2
