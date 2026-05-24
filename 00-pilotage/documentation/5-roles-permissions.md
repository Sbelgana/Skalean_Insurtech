# ROLES ET PERMISSIONS Assurflow v3.0 (anciennement Skalean InsurTech v2.2)

**Version** : 3.0.0 (Sprint 7.5a Foundation Migration)
**Date** : Mai 2026 (mise a jour 2026-05-23)
**Source** : Sprint 7 RBAC (B-07) + Sprint 7.5a Foundation (B-7.5a) + Sprint 25 Cross-Tenant (B-25)
**Decisions** : decision-011 + decision-012 + decision-013 + decision-014
**AUCUNE EMOJI AUTORISEE**

---

## 1. VUE D'ENSEMBLE

Assurflow utilise un systeme RBAC (Role-Based Access Control) augmente d'ABAC (Attribute-Based Access Control) pour les regles contextuelles. La migration v2.2 -> v3.0 (Sprint 7.5a) est purement additive : les 12 roles et 90+ permissions v2.2 sont conserves a l'identique.

**26 roles utilisateurs** (Sprint 7.5a -- v3.0) :
- 2 roles Skalean staff (Platform Niveau 1)
- 3 roles Tenant Broker (Niveau 2)
- 6 roles Tenant Garage (Niveau 2) -- inclut garage_parts_manager (PartsHub, decision-014)
- 6 roles Tenant Carrier (Niveau 2) -- decision-012 ecosysteme 6 acteurs
- 4 roles Tenant Expert (Niveau 2) -- decision-013 expert acteur central agree ACAPS
- 3 roles Tenant Tow (Niveau 2) -- decision-012 remorqueur
- 1 role Assure (Niveau 3 -- L3 dans tenant)
- 1 role Prospect (Public)

**~130 permissions distinctes** organisees en 24 modules :
- 20 modules v2.2 (auth / tenant / crm / booking / comm / docs / signature / pay / books / compliance / analytics / insure / repair / stock / hr / admin / cross_tenant / sky / mcp / public)
- 4 modules v3.0 ajoutes Sprint 7.5a : carrier (15 perms) / expertise (10 perms) / tow (8 perms) / parts (7 perms)

**7 types cross-tenant authorization** (3 v2.2 + 4 v3.0) -- voir section 6.

**Decisions strategiques fondatrices** : 011 Rebranding Skalean/Assurflow + 012 Ecosysteme 6 acteurs + 013 Expert acteur central + 014 PartsHub.

---

## 2. MATRICE 12 ROLES x PRINCIPALES PERMISSIONS

### 2.1 Roles Platform (Skalean staff -- Niveau 1)

| Role | Description | Wildcard |
|------|-------------|----------|
| **super_admin_platform** | Equipe Skalean tech/ops -- bypass RLS, gestion plateforme complete | `*` (toutes permissions) |
| **analyst_support** | Equipe Skalean support/analyse -- read-only sur tous tenants | `*.read` (lecture seule) |

**Acces speciaux** :
- Routes `/api/v1/admin/*` (bypass RLS)
- Endpoint `/admin/impersonate` (Sprint 26 -- avec audit complet)
- MFA obligatoire (TOTP + WebAuthn optionnel)

### 2.2 Roles Tenant Broker (cabinet courtage -- Niveau 2)

| Role | Description | Hierarchie |
|------|-------------|------------|
| **broker_admin** | Admin cabinet -- CRUD tenant complete | herite broker_user + broker_assistant |
| **broker_user** | Courtier souscripteur | herite broker_assistant |
| **broker_assistant** | Assistant administratif | base |

**Permissions broker_admin (~30)** :
- `crm.contacts.*`, `crm.companies.*`, `crm.deals.*`
- `booking.*`
- `insure.policies.*`, `insure.quotes.*`, `insure.commissions.read`
- `pay.transactions.read`, `pay.refunds.create`
- `books.invoices.*`, `books.journals.read`
- `analytics.dashboards.read`
- `users.create`, `users.update`, `users.read` (within tenant)
- `tenant.settings.update`
- `custom_fields.manage`

**Permissions broker_user (~20)** :
- `crm.contacts.read`, `crm.contacts.create`, `crm.contacts.update_own`
- `crm.deals.create`, `crm.deals.update_own`
- `insure.quotes.create`, `insure.policies.create`, `insure.policies.read`
- `pay.transactions.read`
- `analytics.dashboards.read_own`

**Permissions broker_assistant (~10)** :
- `crm.contacts.read`, `crm.contacts.create`
- `booking.appointments.create`, `booking.appointments.read`
- `comm.messages.send`

### 2.3 Roles Tenant Garage (Niveau 2)

| Role | Description | Specialite |
|------|-------------|------------|
| **garage_admin** | Admin garage -- CRUD complete | Gestion totale tenant |
| **garage_chef** | Chef d'atelier | Sinistres assign + close |
| **garage_technicien** | Technicien atelier | Reparations execute (PWA mobile) |
| **garage_comptable** | Comptable garage | Books + Pay |
| **garage_commercial** | Commercial garage | Devis + clients |

**Permissions garage_chef** (~12) :
- `repair.sinistres.read`, `repair.sinistres.assign`, `repair.sinistres.close`
- `repair.devis.approve`
- `repair.diagnostics.create`, `repair.diagnostics.update`
- `hr.assignments.create`
- PAS de stock/HR/Books direct

**Permissions garage_technicien** (~6) :
- `repair.sinistres.read_assigned` (ABAC : assigned to me)
- `repair.reparations.start`, `repair.reparations.complete`
- `stock.items.use`
- `repair.photos.upload`
- WebAuthn biometric login required (Sprint 23)

**Permissions garage_comptable** (~10) :
- `books.invoices.read`, `books.invoices.create`
- `books.accounts.manage`
- `pay.transactions.read`, `pay.transactions.reconcile`
- `pay.refunds.create`

**Permissions garage_commercial** (~8) :
- `crm.contacts.read`, `crm.contacts.create`
- `repair.devis.create`, `repair.devis.read`
- `comm.messages.send`

### 2.4 Role Assure (L3 -- Niveau 3)

| Role | Description | Niveau |
|------|-------------|--------|
| **assure** | Client final assure connecte (web-assure-portal + mobile) | L3 dans tenant |

**Permissions assure** (~8) :
- `insure.policies.read_own` (ABAC : owner_id = user_id)
- `repair.sinistres.read_own`
- `repair.sinistres.create_own` (declaration M8 Sprint 24)
- `pay.transactions.read_own`
- `docs.documents.read_own`
- `notifications.read_own`
- `notifications.update_own` (settings preferences)

**Routes specifiques** : `/api/v1/assure/*` avec filter `app_assure_user_id` actif.

### 2.5 Role Prospect (Public -- pas auth)

| Role | Description |
|------|-------------|
| **prospect** | Prospect public (web-customer-portal sans login) |

**Permissions prospect** (~4) :
- `public.products.read` (Sprint 14 catalog)
- `public.quotes.generate` (simulator Sprint 17)
- `public.kyc.submit` (KYC pre-approbation)
- `public.payments.process` (Sprint 17 souscription)

**Sessions** : Redis TTL 30min (pas DB persistence prospect avant inscription -- decision-008 CNDP).

---

## 3. ROLE HIERARCHY

```
super_admin_platform (top)  -- bypass tout

analyst_support             -- read-only universal

broker_admin
  └── broker_user
        └── broker_assistant

garage_admin
  ├── garage_chef
  │     └── garage_technicien
  ├── garage_comptable
  └── garage_commercial

assure (L3 in tenant)
prospect (public)
```

**Heritage** : `getEffectivePermissions(broker_admin)` = permissions broker_admin + broker_user + broker_assistant (resolution recursive).

**Pas de cross-inheritance** : broker_* et garage_* sont independants (1 user = 1 role per tenant).

---

## 4. ABAC -- ATTRIBUTE-BASED RULES

### 4.1 OwnResourcesPolicy

**Permissions `*_own`** :
- `insure.policies.read_own` : assure peut lire SES polices (ABAC : `policies.owner_id = ctx.userId`)
- `repair.sinistres.read_own` : assure peut lire SES sinistres
- `repair.sinistres.read_assigned` : technicien peut lire sinistres ASSIGNES a lui

### 4.2 TimeBasedPolicy

- `pay.refunds.create` : permis si `transaction.created_at > NOW() - 30 days` (loi 17-99 droit retract MA)
- `policies.cancel_anticipated` : permis Sprint 15 selon delais reglementaires

### 4.3 StatusBasedPolicy

- `policies.cancel` : permis si `policy.status = 'active'` (refuse si expired)
- `quotes.update` : permis si `quote.status = 'draft'` (refuse si signed)
- `invoices.update` : permis si `invoice.status = 'draft'` (refuse si paid)

### 4.4 WorkflowStatePolicy

- Sinistre transitions valides : `declared -> acknowledged -> appointment_scheduled -> ... -> closed`
- Devis transitions : `draft -> submitted -> approved/rejected -> expired`
- Police transitions : `quoted -> active -> renewed/cancelled/expired`

---

## 5. PERMISSIONS PAR MODULE (~85 total)

### auth (~10)
- `users.create`, `users.read`, `users.update`, `users.delete`
- `roles.assign`, `roles.revoke`
- `sessions.read_own`, `sessions.revoke_own`, `sessions.revoke_all`
- `mfa.enable`, `mfa.disable`

### crm (~15)
- `crm.contacts.*` (read/create/update/delete + read_own)
- `crm.companies.*`
- `crm.deals.*`
- `crm.pipelines.manage`
- `crm.interactions.create`

### booking (~6)
- `booking.rooms.*`
- `booking.appointments.*`
- `booking.calendar.sync`

### comm (~5)
- `comm.messages.send`, `comm.messages.read`
- `comm.templates.manage`
- `comm.conversations.read`

### docs (~6)
- `docs.documents.*` (CRUD + read_own)
- `docs.signatures.read`

### pay (~7)
- `pay.transactions.*` (read/read_own)
- `pay.refunds.*`
- `pay.gateways.config`

### books (~8)
- `books.invoices.*`
- `books.journals.read`
- `books.accounts.manage`
- `books.tax_declarations.create`

### compliance (~5)
- `compliance.acaps_reports.generate`
- `compliance.dgi_safmta.export`
- `compliance.aml_alerts.review`
- `compliance.cndp_purge.execute`

### analytics (~3)
- `analytics.dashboards.read`, `analytics.dashboards.read_own`
- `analytics.reports.export`

### insure (~10)
- `insure.policies.*` (CRUD + read_own + cancel + transfer)
- `insure.quotes.*`
- `insure.commissions.read`
- `insure.connectors.config` (Sprint 32 -- super admin only)

### repair (~12)
- `repair.sinistres.*` (CRUD + assign + close + read_own + read_assigned)
- `repair.diagnostics.*`
- `repair.devis.*` (CRUD + approve)
- `repair.orders.*`
- `repair.invoices.*`
- `repair.warranties.*`
- `repair.photos.upload`

### stock (~4)
- `stock.items.read`, `stock.items.manage`
- `stock.items.use` (technicien)
- `stock.movements.read`

### hr (~5)
- `hr.employees.*`
- `hr.contracts.manage`
- `hr.payslips.read_own`
- `hr.assignments.create`

### admin (~10)
- `admin.tenants.create`, `admin.tenants.suspend`, `admin.tenants.purge`
- `admin.users.list_all`
- `admin.reports.acaps_generate`
- `admin.impersonate`
- `admin.audit.read`
- `admin.system.health`

### cross_tenant (~5)
- `cross_tenant.share_status` (Sprint 25)
- `cross_tenant.api_authentication` (Type 3 partner)
- `cross_tenant.receive_dispatched_sinistres`

### sky (Sprint 31) (~3)
- `sky.conversations.read_own`
- `sky.tools.invoke` (write tools require additional confirmation)
- `sky.analytics.read`

### mcp (Sprint 30) (~2)
- `mcp.tools.discover`
- `mcp.tools.invoke` (per-tool scopes)

---

## 6. SUPER ADMIN BYPASS

**super_admin_platform** :
- Wildcard `*` permission (bypass matrix lookup)
- `app_is_super_admin()` Postgres helper -> bypass RLS
- Routes `/api/v1/admin/*` (with audit + impersonation tracking)
- MFA obligatoire (TOTP + WebAuthn)

**analyst_support** :
- Wildcard `*.read` (read-only universal)
- `app_is_super_admin()` true mais filter automatic write attempts -> 403

---

## 7. CROSS-TENANT AUTHORIZATIONS (Sprint 25)

3 types autorisations cross-tenant :

### Type 1 : broker_to_garage_assignment
- Broker assigne sinistre a garage tenant
- Broker peut suivre status (read)
- Garage peut acceder dossier sinistre limite (read scope)

### Type 2 : assure_to_garage_visit (M8 flux)
- Assure choisit garage (web-assure-mobile Sprint 18)
- Garage voit polices assure pertinentes (read scope)
- Pas transfer tenant (data isolation preservee)

### Type 3 : multi_tenant_user_access
- super_admin_platform / analyst_support
- Acces transverse via `/api/v1/admin/*`

---

## 8. ENFORCEMENT TECHNIQUE

### 8.1 Backend (NestJS)

```typescript
@UseGuards(AuthGuard, TenantGuard, RolesGuard)
@Roles('broker_admin', 'broker_user')
@RequirePermission('crm.contacts.create')
@Controller('api/v1/crm/contacts')
export class ContactsController {
  @Post()
  async create(@CurrentUser() user, @Body() dto) {
    // ABAC check additional
    return this.service.create(dto, user);
  }
}
```

### 8.2 Frontend (Next.js + React)

```typescript
const { hasPermission } = useAuth();

{hasPermission('insure.policies.create') && (
  <Button onClick={createPolicy}>Nouvelle police</Button>
)}
```

### 8.3 RLS Postgres (last line of defense)

```sql
CREATE POLICY tenant_isolation ON crm_contacts
  USING (app_can_access_tenant(tenant_id));
```

Meme bug application : RLS bloque cross-tenant leak.

---

## 9. TESTS RBAC

**Sprint 7 livre** :
- `role-matrix-coverage.spec.ts` : 12 roles x 10 permissions samples = 120 assertions
- Per-role tests : `super_admin.spec.ts`, `broker_admin.spec.ts`, etc. (12 fichiers)
- ABAC tests : OwnResourcesPolicy, TimeBasedPolicy, StatusBasedPolicy, WorkflowStatePolicy
- 80+ scenarios total

**Sprint 33 Pentest** : 50+ scenarios multi-tenant isolation cross-tenant leak attempts.

---

## 10. SEEDS DEV

`pnpm seeds:rbac` cree 12 users :
- 1 super_admin_platform : `super-admin@demo.skalean-insurtech.ma`
- 1 analyst_support
- 3 broker users (Cabinet Demo Bennani)
- 5 garage users (Garage Demo Atlas)
- 1 assure
- 1 prospect (no tenant)

Password test : `Test1234!@#$` (NEVER prod).
MFA disabled (faciliter tests).

---

**Fin du document v2.2. -- Section v3.0 ci-dessous.**

---

# PARTIE II -- ASSURFLOW v3.0 EXTENSION (Sprint 7.5a Foundation Migration)

Date : 2026-05-23. Decisions : 011 + 012 + 013 + 014. Reference : B-7.5a.

## 11. NOUVEAUX ROLES v3.0 (14 ajoutes)

L'extension v3.0 est strictement additive : les 12 roles v2.2 sont conserves a l'identique (pas de renommage, pas de suppression).

### 11.1 Garage parts manager (PartsHub -- decision-014)

| Role | Description | Tenant |
|------|-------------|--------|
| **garage_parts_manager** | Responsable pieces garage (fournisseurs, commandes, commissions) | Garage |

Permissions principales (module `parts.*`, 7 perms) :
- `parts.suppliers.read`, `parts.suppliers.add_to_favorites`
- `parts.orders.create`, `parts.orders.read`, `parts.orders.cancel_within_window`
- `parts.commission.view_dashboard`
- `parts.invoices.read`

### 11.2 Roles Tenant Carrier (compagnie d'assurance -- decision-012)

| Role | Description | Hierarchie |
|------|-------------|------------|
| **carrier_admin** | Admin compagnie (CRUD complet tenant carrier) | herite les 5 enfants |
| **carrier_claims_manager** | Responsable sinistres -- designe experts, approuve indemnisations | base |
| **carrier_finance** | Workflow approbation paiements 4 niveaux | base |
| **carrier_compliance** | Reporting ACAPS, fraude, audit | base |
| **carrier_expert_manager** | Pool experts (designation, evaluation) | base |
| **carrier_partner_manager** | Gestion partenaires courtiers/garages | base |

Permissions principales (module `carrier.*`, 15 perms) :
- Dashboard / claims : `carrier.dashboard.read`, `carrier.claims.read`, `carrier.claims.read_all`
- Paiement multi-niveaux : `carrier.payment.approve_level1` a `approve_level4`, `carrier.payment.reject`
- Experts pool : `carrier.experts.designate`, `carrier.experts.read_pool`, `carrier.experts.evaluate`
- Partners : `carrier.partners.read_stats`, `carrier.brokers.manage`
- Compliance / fraude : `carrier.compliance_reports.generate`, `carrier.fraud_alerts.read`

### 11.3 Roles Tenant Expert (expert agree ACAPS -- decision-013)

| Role | Description | Tenant |
|------|-------------|--------|
| **expert_independent** | Expert automobile independant agree ACAPS (personne physique) | Expert (independant) |
| **expert_firm_admin** | Admin cabinet expertise multi-associes | Expert (cabinet) -- herite expert_associate |
| **expert_associate** | Expert associe cabinet expertise | Expert (cabinet) |
| **expert_carrier_internal** | Expert salarie interne compagnie | Carrier (role interne) |

**Regle d'independance** (decision-013) : aucun de ces roles ne peut etre rattache au tenant Garage. L'expert qui contre-expertise un devis ne peut pas appartenir a la structure qui a etabli ce devis (exigence agrement ACAPS).

Permissions principales (module `expertise.*`, 10 perms) :
- Missions : `expertise.missions.read`, `expertise.missions.accept`, `expertise.missions.reject`
- Workflow devis : `expertise.work.execute`, `expertise.quote.validate`, `expertise.quote.modify`, `expertise.quote.reject`
- Rapports : `expertise.report.create`, `expertise.report.sign` (Barid eSign loi 43-20)
- Honoraires : `expertise.honoraires.invoice`

### 11.4 Roles Tenant Tow (remorqueur -- decision-012)

| Role | Description | Hierarchie |
|------|-------------|------------|
| **tow_admin** | Admin operateur remorquage | herite tow_dispatcher + tow_driver |
| **tow_dispatcher** | Dispatcher (assigne missions aux conducteurs) | herite tow_driver |
| **tow_driver** | Conducteur (PWA mobile, execute missions) | base |

Permissions principales (module `tow.*`, 8 perms) :
- Missions : `tow.missions.read_available`, `tow.missions.accept`, `tow.missions.reject`, `tow.missions.complete`
- Operations : `tow.vehicle_photos.upload`, `tow.availability.toggle`
- Gestion : `tow.earnings.read`, `tow.drivers.manage`

WebAuthn biometric login prefere pour tow_driver (PWA mobile, terrain, sans clavier).

---

## 12. ROLE HIERARCHY v3.0

```
super_admin_platform (top)  -- bypass tout

analyst_support             -- read-only universal

broker_admin
  └── broker_user
        └── broker_assistant

garage_admin
  ├── garage_chef
  │     └── garage_technicien
  ├── garage_comptable
  ├── garage_commercial
  └── garage_parts_manager   -- v3.0 (PartsHub)

carrier_admin                -- v3.0
  ├── carrier_claims_manager
  ├── carrier_finance
  ├── carrier_compliance
  ├── carrier_expert_manager
  └── carrier_partner_manager

expert_firm_admin            -- v3.0
  └── expert_associate
expert_independent           -- v3.0 (terminal)
expert_carrier_internal      -- v3.0 (terminal, rattache tenant Carrier)

tow_admin                    -- v3.0
  └── tow_dispatcher
        └── tow_driver

assure (L3 in tenant)
prospect (public)
```

Heritage v3.0 : `getEffectivePermissions(carrier_admin)` resout recursivement les 5 enfants.

Cross-domain prohibition etendue : aucune chaine d'heritage ne peut traverser broker <-> garage <-> carrier <-> expert <-> tow (verifie au boot par MatrixValidator).

---

## 13. CROSS-TENANT AUTHORIZATIONS v3.0 (7 TYPES)

Les 3 types v2.2 sont conserves et 4 nouveaux types sont ajoutes en v3.0 :

| # | Type | Description | Origine |
|---|------|-------------|---------|
| 1 | broker_to_garage_assignment | Le courtier assigne un sinistre a un garage | v2.2 |
| 2 | assure_to_garage_visit | L'assure autorise un garage a voir son sinistre | v2.2 |
| 3 | multi_tenant_user_access | Un utilisateur opere pour plusieurs tenants | v2.2 |
| 4 | client_to_tower_dispatch | L'assure/courtier declenche une mission de remorquage | v3.0 |
| 5 | tower_to_garage_delivery | Le remorqueur livre le vehicule au garage cible | v3.0 |
| 6 | garage_to_expert_request | Le garage notifie l'expert designe pour validation devis | v3.0 |
| 7 | garage_to_carrier_quote | Le garage envoie le devis a la compagnie en copie | v3.0 |

**Resources** (8 types, +3 v3.0) : sinistre, police, devis, facture, tenant (v2.2) + mission, expertise, parts_order (v3.0).

**Helper Postgres `app_can_access_tenant(target_tenant uuid)`** etendu Sprint 7.5a tache 7.5a.5 :
- Cond 1 : super admin bypass (inchangee)
- Cond 2 : same tenant (inchangee)
- Cond 3 : EXISTS query bidirectionnelle sur cross_tenant_authorizations avec les 7 types v3.0 (active = non revoque ET non expire)

---

## 14. WORKFLOW SINISTRE v3.0 (expert acteur central)

Workflow de bout en bout demontre au Demo Day 30 juin 2026 (decision-015) :

1. **Survenance sinistre** : assure declare via app web ou WhatsApp.
2. **Assignation courtier** : `broker_to_garage_assignment` (type 1).
3. **Remorquage** : `client_to_tower_dispatch` (type 4) + `tower_to_garage_delivery` (type 5).
4. **Devis garage** + commande pieces : role `garage_parts_manager` active PartsHub.
5. **Designation expert** par compagnie : `carrier_claims_manager` ou `carrier_expert_manager` cree entree dans `expert_designations` (status = `designated`).
6. **Acces expert au devis** : `garage_to_expert_request` (type 6). L'expert valide, modifie ou rejette.
7. **Mise en copie compagnie** : `garage_to_carrier_quote` (type 7).
8. **Cloture designation** : status passe a `completed` dans `expert_designations`.

Table `expert_designations` (Sprint 7.5a tache 7.5a.4) : tenant_id, carrier_tenant_id, carrier_user_id, expert_tenant_id, expert_user_id, sinistre_id, status (5 valeurs), timestamps, motif rejet. RLS active via `app_can_access_tenant`.

---

## 15. MATRICE 26 ROLES x 130 PERMISSIONS (resume)

| Acteur | Nb roles | Modules permissions principaux | Total perms approx |
|--------|----------|--------------------------------|---------------------|
| Platform (Skalean) | 2 | wildcard / read-only universal | super_admin: 999, analyst: 35 |
| Broker | 3 | crm, insure, booking, comm, analytics | 30-60 par role |
| Garage | 6 | repair, stock, hr, parts (parts_mgr) | 15-55 par role |
| Carrier | 6 | carrier (15), partage avec insure/pay/compliance | 10-50 par role |
| Expert | 4 | expertise (10), partage avec docs/signature | 20-30 par role |
| Tow | 3 | tow (8), partage avec comm | 10-30 par role |
| Assure (L3) | 1 | *_own permissions cross-modules | 15 |
| Prospect | 1 | public.* | 4 |

Total : 26 roles x ~130 permissions (catalog complet `Permission` style `as const`, jamais enum).

---

## 16. CONFORMITE REGLEMENTAIRE v3.0

- **Loi 09-08 CNDP** : tous les tenants Carrier + Expert + Tow traitent des donnees d'assures. Residence MA stricte (decision-008, Atlas Cloud Services Benguerir).
- **ACAPS** : roles expert documentes avec numero agrement (table expert, sprint ulterieur). Independance materialisee par regle "expert jamais rattache tenant Garage".
- **Loi 17-99 Code des assurances** : tenant Carrier porte le risque, paie l'indemnisation, designe l'expert.
- **Loi 43-20 signature electronique** : rapports d'expertise signes via Barid eSign (decision-009).
- **Loi 9-88 comptabilite** : Carrier doit pouvoir exporter SAFT-MA pour DGI.
- **Loi 43-05 AML** : roles `carrier_compliance` + `carrier_fraud_alerts.read` pour monitoring SAR.

---

## 17. SEEDS DEV v3.0 (a venir Sprint 8+)

Le seed `pnpm seeds:rbac` sera etendu en Sprint 8 pour ajouter :
- 6 carrier users (Wafa Assurance demo)
- 4 expert users (Cabinet expertise Bennani + 1 independant + 1 carrier internal)
- 3 tow users (Remorquage Atlas demo)
- 1 garage_parts_manager additionnel

Total seed users : 26 (vs 12 v2.2).

---

**Fin du document 5-roles-permissions.md v3.0 (Sprint 7.5a Foundation Migration).**
