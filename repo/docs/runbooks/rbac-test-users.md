# RBAC Test Users -- Assurflow v3.0 (Sprint 7 Tache 2.3.12)

Liste des 26 users dev seedes par `infrastructure/scripts/seed-rbac-users.ts`.

**Password commun (dev only)** : `Test1234!@#$`
**MFA** : disabled (faciliter tests automates).
**Domain** : `*.assurflow.ma` (rebrand decision-011).

---

## Platform (2)

| Role | Email | Tenant | Description |
|------|-------|--------|-------------|
| super_admin_platform | super-admin@demo.assurflow.ma | (platform) | Wildcard `*` - bypass RLS, gestion plateforme |
| analyst_support | analyst-support@demo.assurflow.ma | (platform) | Read-only transverse pour support N2 |

## Broker -- Cabinet Bennani Demo (3)

| Role | Email | Tenant |
|------|-------|--------|
| broker_admin | broker-admin@demo-bennani.assurflow.ma | cabinet-bennani-demo |
| broker_user | broker-user@demo-bennani.assurflow.ma | cabinet-bennani-demo |
| broker_assistant | broker-assistant@demo-bennani.assurflow.ma | cabinet-bennani-demo |

## Garage -- Atlas Demo (6, dont v3.0 PartsHub)

| Role | Email | Tenant |
|------|-------|--------|
| garage_admin | garage-admin@demo-atlas.assurflow.ma | garage-atlas-demo |
| garage_chef | garage-chef@demo-atlas.assurflow.ma | garage-atlas-demo |
| garage_technicien | garage-tech@demo-atlas.assurflow.ma | garage-atlas-demo |
| garage_comptable | garage-compta@demo-atlas.assurflow.ma | garage-atlas-demo |
| garage_commercial | garage-commercial@demo-atlas.assurflow.ma | garage-atlas-demo |
| **garage_parts_manager** (v3.0) | garage-parts@demo-atlas.assurflow.ma | garage-atlas-demo |

## Carrier -- Wafa Assurance Demo (6, NOUVEAU v3.0)

| Role | Email | Tenant |
|------|-------|--------|
| carrier_admin | carrier-admin@demo-wafa.assurflow.ma | wafa-assurance-demo |
| carrier_claims_manager | carrier-claims@demo-wafa.assurflow.ma | wafa-assurance-demo |
| carrier_finance | carrier-finance@demo-wafa.assurflow.ma | wafa-assurance-demo |
| carrier_compliance | carrier-compliance@demo-wafa.assurflow.ma | wafa-assurance-demo |
| carrier_expert_manager | carrier-expert-mgr@demo-wafa.assurflow.ma | wafa-assurance-demo |
| carrier_partner_manager | carrier-partner-mgr@demo-wafa.assurflow.ma | wafa-assurance-demo |

## Expert -- 4 structures (NOUVEAU v3.0, decision-013)

| Role | Email | Tenant | Note |
|------|-------|--------|------|
| expert_independent | expert-independent@demo.assurflow.ma | expert-independent-demo | Personne physique agree ACAPS |
| expert_firm_admin | expert-firm-admin@demo-cabinet.assurflow.ma | cabinet-expertise-demo | Admin cabinet multi-associes |
| expert_associate | expert-associate@demo-cabinet.assurflow.ma | cabinet-expertise-demo | Associe cabinet |
| expert_carrier_internal | expert-internal@demo-wafa.assurflow.ma | wafa-assurance-demo | Salarie interne Wafa |

**Regle d'independance ACAPS** : aucun expert n'est rattache au tenant Garage.

## Tow -- Remorquage Atlas Demo (3, NOUVEAU v3.0)

| Role | Email | Tenant |
|------|-------|--------|
| tow_admin | tow-admin@demo-remorquage.assurflow.ma | tow-atlas-demo |
| tow_dispatcher | tow-dispatcher@demo-remorquage.assurflow.ma | tow-atlas-demo |
| tow_driver | tow-driver@demo-remorquage.assurflow.ma | tow-atlas-demo |

## L3 + Public (2)

| Role | Email | Tenant | Note |
|------|-------|--------|------|
| assure | assure@demo.assurflow.ma | cabinet-bennani-demo | Client final rattache courtier Bennani |
| prospect | prospect@demo.assurflow.ma | (public) | Pas de tenant, session Redis TTL 30min |

---

## Permissions effectives par role

Voir `00-pilotage/documentation/5-roles-permissions.md` v3.0 (sections 11.1-11.4 + 15) pour la matrice 26 x 130 complete.

Endpoint admin pour introspection runtime :
- `GET /api/v1/admin/rbac/roles/:role` -> direct + inherited + effective

## Scenarios de tests cross-tenant (7 types v3.0)

| Type | From | To | Permissions impliquees |
|------|------|----|-----------------------|
| broker_to_garage_assignment | broker_admin | garage_admin | Sprint 22 sinistre dispatch |
| assure_to_garage_visit | assure | garage_chef | Choix garage par assure |
| multi_tenant_user_access | analyst_support | any | Read-only transverse |
| **client_to_tower_dispatch** (v3.0) | assure ou broker_user | tow_dispatcher | Demande remorquage |
| **tower_to_garage_delivery** (v3.0) | tow_driver | garage_chef | Livraison vehicule |
| **garage_to_expert_request** (v3.0) | garage_chef | expert_independent | Notif expert designe |
| **garage_to_carrier_quote** (v3.0) | garage_admin | carrier_claims_manager | Envoi devis compagnie |

---

## CLI

```bash
# Validation seed coverage (executable standalone)
pnpm tsx infrastructure/scripts/seed-rbac-users.ts

# Tests
pnpm --filter @insurtech-monorepo test seed-rbac-users
```

Reference : Sprint 7 Tache 2.3.12 + Sprint 7.5a Foundation Migration + decisions 011-015.
