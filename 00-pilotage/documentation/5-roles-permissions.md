# ROLES ET PERMISSIONS skalean-insurtech v2.2

**Version** : 2.2.0
**Date** : Mai 2026
**Source** : Sprint 7 RBAC (B-07) + Sprint 25 Cross-Tenant (B-25)
**AUCUNE EMOJI AUTORISEE**

---

## 1. VUE D'ENSEMBLE

skalean-insurtech utilise un systeme RBAC (Role-Based Access Control) augmente d'ABAC (Attribute-Based Access Control) pour les regles contextuelles.

**12 roles utilisateurs** definis dans Sprint 7 :
- 2 roles Skalean staff (Platform Niveau 1)
- 5 roles Tenant cabinet courtier (Niveau 2)
- 5 roles Tenant garage (Niveau 2)
- 1 role Assure (Niveau 3 -- L3 dans tenant)
- 1 role Prospect (Public)

**85+ permissions distinctes** organisees en ~15 modules (auth / crm / booking / comm / docs / pay / books / compliance / analytics / insure / repair / stock / hr / admin / cross_tenant).

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

**Fin du document 5-roles-permissions.md v2.2.**
