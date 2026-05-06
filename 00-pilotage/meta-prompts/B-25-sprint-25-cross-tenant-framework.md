# META-PROMPT B-25 -- SPRINT 25 CROSS-TENANT FRAMEWORK (FIN Phase 5)

**Version** : v2.2 (Option B -- DERNIER sprint Phase 5)
**Phase** : 5 -- Vertical Repair (Skalean Garage ERP)
**Sprint** : 25 / 35 (cumul) -- Phase 5 Sprint 7 (DERNIER)
**Position** : Apres Flux Sinistre Client, FIN Phase 5
**Numerotation taches** : 5.7.1 a 5.7.12
**Effort total** : ~70 heures developpement / 2 semaines
**Priorite** : P0 (framework cross-tenant generalise -- pattern reutilisable Insure Phase 7)

---

## Objectif Global du Sprint

Generaliser le framework cross-tenant amorce Sprint 24 (sinistre routing assure -> garage) en **3 types tenants Repair runtime activation** : Atlas / Partenaires geres / Partenaires API. Pattern reutilisable Insure Sprint 32 Phase 7 (brokers partenaires connecteurs assureurs).

Sprint 25 livre **framework reutilisable** + onboarding wizard preparation Sprint 27 admin + tests isolation exhaustifs. **Phase 5 COMPLETE** : 7/7 sprints livres.

A la sortie de ce sprint :
- 3 types tenants Repair runtime activable :
  - **Type 1 Atlas** : garage interne Skalean (Sprint 19 deja livre)
  - **Type 2 Partenaires geres** : utilisent Skalean Garage ERP avec data isolated multi-tenant strict
  - **Type 3 Partenaires API only** : garages externes + integration API Skalean (passerelle minimale)
- Capabilities matrix per type + runtime checks
- Cross-tenant data sharing controle (read-only views shared / private writes)
- Onboarding wizard preparation (Sprint 27 admin UI)
- Pattern reutilisable Insure : brokers + assureurs Sprint 32
- Tests isolation exhaustifs (40+)
- **Phase 5 COMPLETE**

---

## Frontiere du Sprint

**INCLUS** :
- 3 types tenants Repair definition + activation
- CapabilitiesMatrix runtime checks
- Cross-tenant data sharing controlle
- Onboarding wizard backend (Sprint 27 UI)
- Pattern reutilisable documente
- Tests isolation
- **Phase 5 closure**

**EXCLU** (sera ajoute aux sprints suivants) :
- UI onboarding Sprint 27 admin
- Connecteurs assureurs partenaires (pattern reutilise) -- Sprint 32 Phase 7
- IA-powered tenant fraud detection -- Phase 7+
- Multi-region tenant routing -- Phase 7+

---

## Lectures Prealables Obligatoires

1. Sortie Sprint 6 : multi-tenant 3 niveaux + RLS
2. Sortie Sprint 24 : cross-tenant sinistre routing
3. Sortie Sprint 19 : Skalean Atlas (Type 1 Atlas)
4. Decision-002 : multi-tenant strict architecture

---

## Stack Imposee (Sprint 25)

| Composant | Version | Notes |
|-----------|---------|-------|
| zod | 3.24.1 | validation capabilities |
| undici | 7.1.1 | HTTP client (Type 3 API integrations) |
| opossum | 8.5.0 | circuit breaker (Type 3 partner APIs) |

---

## Vue d'Ensemble des 12 Taches

| # | Tache | Effort | Priorite | Depend de |
|---|-------|--------|----------|-----------|
| 5.7.1 | TenantType enum + entity tenant_capabilities + CapabilitiesMatrix | 5h | P0 | Sprint 24 |
| 5.7.2 | Type 1 Atlas implementation (existing Sprint 19, formalize) | 4h | P0 | 5.7.1 |
| 5.7.3 | Type 2 Partenaires geres : multi-tenant strict + data sharing controlled | 7h | P0 | 5.7.2 |
| 5.7.4 | Type 3 Partenaires API only : passerelle integration + circuit breaker | 7h | P0 | 5.7.3 |
| 5.7.5 | CrossTenantSharingService : read-only views shared + private writes | 6h | P0 | 5.7.4 |
| 5.7.6 | Runtime activation : enable/disable type per tenant + audit | 5h | P0 | 5.7.5 |
| 5.7.7 | Onboarding wizard backend : workflow create tenant + setup capabilities | 6h | P0 | 5.7.6 |
| 5.7.8 | Capabilities checks middleware : runtime guards per request | 5h | P0 | 5.7.7 |
| 5.7.9 | Pattern reutilisable Insure : documentation + interfaces (Sprint 32 prep) | 4h | P0 | 5.7.8 |
| 5.7.10 | Endpoints REST + permissions cross-tenant management | 5h | P0 | 5.7.9 |
| 5.7.11 | Documentation : architecture + onboarding guide + scenarios | 4h | P0 | 5.7.10 |
| 5.7.12 | Tests isolation exhaustifs (40+) + Phase 5 closure | 12h | P0 | 5.7.11 |

**Total** : 70 heures.

---

# DETAIL DES 12 TACHES

---

## Tache 5.7.1 -- TenantType + CapabilitiesMatrix

**Metadonnees** : Phase 5 / Sprint 25 / P0 / 5h / Depend de Sprint 24

**But** : Definir 3 types tenants Repair + matrice capabilities + entity tenant_capabilities.

**Livrables checkables** :
- [ ] Enum `TenantTypeRepair` :
  - `atlas` (Type 1)
  - `managed_partner` (Type 2)
  - `api_partner` (Type 3)
- [ ] Migration : ajouter `tenants.tenant_subtype` (text, nullable) + `tenants.tenant_capabilities` (jsonb)
- [ ] Migration : table `tenant_capabilities` (granular) :
  - id, tenant_id (FK), capability_key (e.g. 'repair.diagnostics.create', 'insure.connectors.api_access'), enabled (boolean), config (jsonb), valid_from, valid_until
- [ ] CapabilitiesMatrix definition :
  - **Atlas** : ALL capabilities enabled (full Skalean Garage ERP)
  - **Managed Partner** : Repair entities full + read-only Insure shared views (sinistres lies polices) + Pay/Books/HR full + Stock full
  - **API Partner** : Limited subset (receive sinistres + send updates only) + No internal ERP entities
- [ ] Service `capabilities-matrix.service.ts` :
  - `getCapabilities(tenantId): TenantCapabilities`
  - `hasCapability(tenantId, key): boolean`
  - `enableCapability(tenantId, key, config)` (super admin)
- [ ] Tests

**Pattern critique : capabilities matrix definition**

```typescript
// repo/packages/auth/src/cross-tenant/capabilities-matrix.ts
export const CAPABILITIES_MATRIX_REPAIR: Record<TenantTypeRepair, CapabilityKey[]> = {
  atlas: [
    // Full ownership + management
    'repair.garages.full',
    'repair.sinistres.create',
    'repair.diagnostics.create',
    'repair.devis.create',
    'repair.orders.create',
    'repair.invoices.create',
    'repair.warranties.create',
    'repair.stock.full',
    'repair.hr.full',
    'repair.pay.full',
    'repair.books.full',
    'repair.analytics.read',
    'cross_tenant.receive_dispatched_sinistres',
    'cross_tenant.share_status_with_assure_tenant',
  ],

  managed_partner: [
    // Use Skalean Garage ERP with isolation
    'repair.garages.read_own',
    'repair.sinistres.create',
    'repair.diagnostics.create',
    'repair.devis.create',
    'repair.orders.create',
    'repair.invoices.create',
    'repair.warranties.create',
    'repair.stock.full',
    'repair.hr.full',
    'repair.pay.full',
    'repair.books.full',
    'repair.analytics.read_own',
    'cross_tenant.receive_dispatched_sinistres',
    'cross_tenant.share_status_with_assure_tenant',
    // PAS de cross_tenant share entire data (isolation strict)
  ],

  api_partner: [
    // Limited : passerelle only
    'repair.sinistres.receive_dispatch',
    'repair.sinistres.send_status_updates',
    'repair.devis.send_external',           // Send devis a Skalean (via API external)
    'repair.invoices.send_external',
    'cross_tenant.api_authentication',
    // PAS d'utilisation Skalean Garage ERP entities
  ],
};

export function getDefaultCapabilities(tenantType: TenantTypeRepair): CapabilityKey[] {
  return CAPABILITIES_MATRIX_REPAIR[tenantType] || [];
}
```

**Fichiers crees / modifies** :
```
repo/packages/database/src/migrations/{date}-AddTenantSubtypeAndCapabilities.ts            # ~50 lignes
repo/packages/auth/src/cross-tenant/capabilities-matrix.ts                                  # ~250 lignes
repo/packages/auth/src/cross-tenant/types.ts                                                # ~80 lignes
repo/packages/auth/src/services/capabilities.service.ts                                      # ~200 lignes
repo/apps/api/src/modules/admin/controllers/capabilities.controller.ts                       # ~120 lignes
```

**Criteres validation** :
- V1 (P0) : 3 types enum
- V2 (P0) : Capabilities matrix definition
- V3 (P0) : Service hasCapability fonctionne
- V4 (P0) : Tests 8+ scenarios

---

## Tache 5.7.2 -- Type 1 Atlas Implementation Formalize

**Metadonnees** : Phase 5 / Sprint 25 / P0 / 4h / Depend de 5.7.1

**But** : Formaliser implementation Atlas existante (Sprint 19) avec capabilities + tagging tenant.

**Livrables checkables** :
- [ ] Update Skalean Atlas seed (Sprint 19) : add `tenant_subtype = 'atlas'`
- [ ] Capabilities Atlas appliquees runtime
- [ ] Tests : Atlas access toutes capabilities

**Fichiers crees / modifies** :
```
repo/infrastructure/scripts/seed-skalean-atlas.ts                                            # update : add subtype + capabilities
```

**Criteres validation** :
- V1 (P0) : Atlas tenant correctement tagged
- V2 (P0) : Capabilities applique
- V3 (P0) : Tests 4+ scenarios

---

## Tache 5.7.3 -- Type 2 Partenaires Geres : Multi-Tenant Strict

**Metadonnees** : Phase 5 / Sprint 25 / P0 / 7h / Depend de 5.7.2

**But** : Implementer Type 2 -- garages partenaires utilisent Skalean Garage ERP avec data isolated multi-tenant strict (Sprint 6 RLS) + read-only views shared cross-tenant.

**Contexte** : Type 2 = garages independants qui souhaitent utiliser Skalean Garage ERP en SaaS subscription. Utilisent toutes features ERP. Data 100% isolees per tenant. Mais peuvent recevoir sinistres dispatches depuis tenants assure (cross-tenant).

**Livrables checkables** :
- [ ] Validation multi-tenant strict (RLS Sprint 6 deja livre) -- check capabilities Type 2 :
  - `repair.garages.read_own` (only own data)
  - `repair.sinistres.create` etc.
  - `cross_tenant.receive_dispatched_sinistres` (peut etre cible dispatch)
- [ ] Service `managed-partner-onboarding.service.ts` :
  - `createTenant(data)` : tenant + admin user + default capabilities
  - `setupGarage(tenantId, garageData)` : create repair_garage row
  - `inviteUsers(tenantId, users)` : trigger Sprint 5 invite users
- [ ] Configuration : tenant settings (commission_rate Skalean, billing_frequency, support_level)
- [ ] Cross-tenant share read-only views :
  - `vw_cross_tenant_sinistre_status` : sinistres dispatch status visible source tenant assure
- [ ] Endpoints :
  - `POST /api/v1/admin/tenants/managed-partner` (super admin onboard)
  - `GET /api/v1/admin/tenants/:id/capabilities` (review capabilities)
- [ ] Tests : isolation + cross-tenant share

**Fichiers crees / modifies** :
```
repo/packages/auth/src/services/managed-partner-onboarding.service.ts                       # ~250 lignes
repo/packages/database/src/migrations/{date}-CrossTenantViews.ts                              # ~80 lignes (read-only views)
repo/apps/api/src/modules/admin/controllers/managed-partner.controller.ts                     # ~120 lignes
```

**Criteres validation** :
- V1 (P0) : Type 2 tenant cree avec capabilities
- V2 (P0) : Multi-tenant isolation respect
- V3 (P0) : Cross-tenant view sinistre status fonctionne
- V4 (P0) : Tests isolation 8+ scenarios

---

## Tache 5.7.4 -- Type 3 Partenaires API Only : Passerelle

**Metadonnees** : Phase 5 / Sprint 25 / P0 / 7h / Depend de 5.7.3

**But** : Implementer Type 3 -- garages externes (avec leur propre ERP) qui integrent Skalean via API only (passerelle minimale).

**Contexte** : Type 3 = garages garage qui ont deja un systeme + souhaitent recevoir sinistres Skalean via API. Skalean ne stocke PAS leurs data internal (diagnostic, orders, etc.). Skalean stocke seulement : sinistre dispatch + status updates received from partner.

**Livrables checkables** :
- [ ] Pattern Adapter (similar Sprint 11 Pay) : `ApiPartnerConnectorInterface`
- [ ] Methods :
  - `dispatchSinistre(externalSinistreData)` -- HTTP POST partner API
  - `pollStatus(externalRef)` -- poll status updates
  - `verifyWebhookSignature(rawBody, signature)` -- HMAC verification
- [ ] Migration : table `api_partner_configurations` :
  - id, tenant_id, api_base_url, api_key_encrypted, webhook_secret_encrypted, mapping_config (jsonb : how to translate Skalean data <-> partner data), retry_policy, rate_limit
- [ ] Service `api-partner-connector.service.ts` (avec circuit breaker opossum)
- [ ] **Webhook receiver pattern detaille** :
  - **Endpoint dedie per partner** : `/api/v1/public/webhooks/api-partners/:tenantId` (vs endpoint generique `/api/v1/public/webhooks/api-partners` avec routing par x-partner-id header)
  - **Decision pattern adopte** : endpoint dedie per `:tenantId` (URL path) -- plus simple a router + plus securise (no header spoofing risk)
  - URL pattern : `https://api.skalean-insurtech.ma/api/v1/public/webhooks/api-partners/{partner-tenant-uuid}`
  - Routing flow :
    1. Extract `:tenantId` from URL path
    2. Lookup `api_partner_configurations` WHERE tenant_id = tenantId AND active = true
    3. Get `webhook_secret_encrypted` -> decrypt via KMS
    4. Verify HMAC-SHA256 signature header `X-Partner-Signature` (raw body)
    5. Verify timestamp `X-Partner-Timestamp` (window 5min replay protection)
    6. Parse partner status update payload
    7. Map partner data -> Skalean format via `config.mapping_config`
    8. Update sinistre status in target tenant (privilege escalation TenantContext + audit log)
    9. Publish Kafka event `insurtech.events.cross_tenant.partner_update`
  - Rate limiting : 100 req/min per partner (per tenantId)
  - Idempotency : header `Idempotency-Key` mandatory + Redis dedup 1h
  - Errors : 401 (signature invalid) / 404 (partner not found) / 422 (mapping error) / 429 (rate limit)
- [ ] Limited capabilities Type 3 :
  - PAS d'acces Skalean Garage ERP UI
  - PAS de Books/HR/Stock chez Skalean (partner gere son ERP)
  - Read-only sinistres dispatched + send updates back
- [ ] Tests : dispatch + status updates + webhook + signature + replay attack rejected + invalid mapping rejected

**Pattern critique : API Partner Connector**

```typescript
// repo/packages/repair/src/connectors/api-partner-connector.service.ts
@Injectable()
export class ApiPartnerConnectorService extends BaseConnector {
  constructor(
    private config: ApiPartnerConfiguration,
    private kmsService: KmsService,
    private logger: Logger,
  ) {
    super();
    this.dispatchBreaker = new CircuitBreaker(this._dispatch.bind(this), {
      timeout: 15000,                      // partners might be slow
      errorThresholdPercentage: 30,
      resetTimeout: 60000,
    });
  }

  async dispatchSinistre(externalSinistreData: any): Promise<{ partnerRef: string }> {
    return this.dispatchBreaker.fire(externalSinistreData);
  }

  private async _dispatch(externalSinistreData: any): Promise<{ partnerRef: string }> {
    const apiKey = await this.kmsService.decrypt(this.config.api_key_encrypted);

    // Mapping data Skalean -> Partner format (per-tenant config)
    const mappedData = this.mapToPartnerFormat(externalSinistreData, this.config.mapping_config);

    const response = await this.http.fetch(`${this.config.api_base_url}/sinistres`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Skalean-Source': 'cross-tenant-dispatch',
      },
      body: JSON.stringify(mappedData),
    });

    if (!response.ok) {
      throw new ApiPartnerDispatchFailedError({ partner: this.config.tenant_id, status: response.status });
    }

    const data = await response.json();
    return { partnerRef: data.partner_ref ?? data.id };
  }

  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    const secret = this.kmsService.decryptSync(this.config.webhook_secret_encrypted);
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  }
}
```

**Fichiers crees / modifies** :
```
repo/packages/database/src/migrations/{date}-ApiPartnerConfigurations.ts                       # ~50 lignes
repo/packages/repair/src/connectors/api-partner-connector.interface.ts                          # ~100 lignes
repo/packages/repair/src/connectors/api-partner-connector.service.ts                              # ~300 lignes
repo/apps/api/src/modules/repair/webhooks/api-partner-webhook.controller.ts                       # ~150 lignes
```

**Criteres validation** :
- V1 (P0) : Type 3 connector fonctionne
- V2 (P0) : Circuit breaker active
- V3 (P0) : Webhook signature verifiee
- V4 (P0) : Mapping data Skalean <-> partner
- V5 (P0) : Tests 10+ scenarios

---

## Tache 5.7.5 -- CrossTenantSharingService

**Metadonnees** : Phase 5 / Sprint 25 / P0 / 6h / Depend de 5.7.4

**But** : Service centralise data sharing cross-tenant : read-only views sinistres status + photos + documents (selon capabilities).

**Livrables checkables** :
- [ ] Service `cross-tenant-sharing.service.ts` :
  - `shareSinistreStatusReadOnly(sourceTenantId, targetTenantId, sinistreId)` -- expose status updates
  - `getSharedSinistreView(viewerTenantId, sinistreId)` -- check permissions + return data filtered
  - `unshareSinistre(sinistreId)` -- revoke
- [ ] Sharing rules per type :
  - **Atlas <-> Atlas** : full sharing (1 tenant only)
  - **Atlas/Managed -> Assure tenant** : share status + photos progress + documents (lecture seulement)
  - **API Partner -> Assure tenant** : status updates only (pas de photos/documents internes)
- [ ] Privilege escalation : super-admin OR tenant_admin source
- [ ] Audit complete chaque acces cross-tenant
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/packages/repair/src/services/cross-tenant-sharing.service.ts                            # ~300 lignes
repo/apps/api/src/modules/cross-tenant/cross-tenant-views.controller.ts                       # ~120 lignes
```

**Criteres validation** :
- V1 (P0) : Sharing rules par type tenant
- V2 (P0) : Read-only respect
- V3 (P0) : Audit complete
- V4 (P0) : Tests 10+ scenarios

---

## Tache 5.7.6 -- Runtime Activation Type per Tenant

**Metadonnees** : Phase 5 / Sprint 25 / P0 / 5h / Depend de 5.7.5

**But** : Permettre runtime enable/disable type tenant + audit + transitions controles.

**Livrables checkables** :
- [ ] Service `tenant-type-management.service.ts` :
  - `setType(tenantId, type, capabilities)` -- super admin only
  - `transitionType(tenantId, fromType, toType)` -- e.g. managed_partner -> api_partner (data preserved)
  - `disableType(tenantId)` -- soft delete (data retained)
- [ ] Validations transitions :
  - Atlas -> autre : interdit (Atlas = Skalean property)
  - managed_partner <-> api_partner : permis (avec data migration script optional)
  - Tout -> disabled : preserves data, blocks access
- [ ] Audit : table `tenant_type_changes` (id, tenant_id, from_type, to_type, changed_by, changed_at, reason)
- [ ] Endpoints :
  - `POST /api/v1/admin/tenants/:id/set-type`
  - `POST /api/v1/admin/tenants/:id/transition-type`
  - `POST /api/v1/admin/tenants/:id/disable`
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/packages/database/src/migrations/{date}-TenantTypeChanges.ts                            # ~40 lignes
repo/packages/auth/src/services/tenant-type-management.service.ts                              # ~250 lignes
repo/apps/api/src/modules/admin/controllers/tenant-type.controller.ts                          # ~100 lignes
```

**Criteres validation** :
- V1 (P0) : SetType valide capabilities
- V2 (P0) : Transitions controles
- V3 (P0) : Disable preserves data
- V4 (P0) : Audit complete
- V5 (P0) : Tests 8+ scenarios

---

## Tache 5.7.7 -- Onboarding Wizard Backend

**Metadonnees** : Phase 5 / Sprint 25 / P0 / 6h / Depend de 5.7.6

**But** : Workflow backend onboarding nouveau tenant partner (Type 2 ou 3) -- Sprint 27 admin UI consume.

**Livrables checkables** :
- [ ] Service `partner-onboarding-workflow.service.ts`
- [ ] Steps :
  1. **Validate partner data** : nom + ICE + RC + contact + adresse
  2. **Create tenant** : insert tenants table + tenant_subtype
  3. **Setup capabilities** : selon type (Tache 5.7.1)
  4. **Create admin user** : send invitation email Sprint 5
  5. **Create garage entity** : si Type 2 (managed)
  6. **Setup API config** : si Type 3 (api_partner) -- generate keys + webhook secret
  7. **Send welcome pack** : guide onboarding + credentials
- [ ] Migration : table `tenant_onboarding_workflows` :
  - id, tenant_id, type, current_step, steps_completed (jsonb), errors, started_at, completed_at, abandoned_at
- [ ] Endpoints :
  - `POST /api/v1/admin/onboarding/start`
  - `POST /api/v1/admin/onboarding/:id/complete-step`
  - `GET /api/v1/admin/onboarding/:id`
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/packages/database/src/migrations/{date}-TenantOnboardingWorkflows.ts                     # ~50 lignes
repo/packages/auth/src/services/partner-onboarding-workflow.service.ts                          # ~300 lignes
repo/apps/api/src/modules/admin/controllers/onboarding.controller.ts                            # ~150 lignes
```

**Criteres validation** :
- V1 (P0) : Workflow 7 steps
- V2 (P0) : Type 2 vs Type 3 differents
- V3 (P0) : API keys generation Type 3
- V4 (P0) : Tests 8+ scenarios

---

## Tache 5.7.8 -- Capabilities Checks Middleware

**Metadonnees** : Phase 5 / Sprint 25 / P0 / 5h / Depend de 5.7.7

**But** : Middleware NestJS verifie runtime tenant capabilities avant chaque request + reject si missing.

**Livrables checkables** :
- [ ] Decorator `@RequireCapability('repair.garages.create')` similar `@Roles()` Sprint 7
- [ ] Guard `CapabilitiesGuard` :
  - Read tenant capabilities from JWT OR DB cache
  - Check requested capability presence
  - Throw 403 si missing
- [ ] Cache capabilities Redis 5min (eviter DB lookup chaque request)
- [ ] Application : decorate critical endpoints (write operations)
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/packages/auth/src/decorators/require-capability.decorator.ts                                # ~50 lignes
repo/packages/auth/src/guards/capabilities.guard.ts                                              # ~150 lignes
repo/packages/auth/src/services/capabilities-cache.service.ts                                     # ~100 lignes
```

**Criteres validation** :
- V1 (P0) : Decorator + Guard
- V2 (P0) : Cache Redis 5min
- V3 (P0) : 403 si missing
- V4 (P0) : Tests 8+ scenarios

---

## Tache 5.7.9 -- Pattern Reutilisable Insure (Sprint 32 Prep)

**Metadonnees** : Phase 5 / Sprint 25 / P0 / 4h / Depend de 5.7.8

**But** : Documentation + interfaces pour reutiliser pattern cross-tenant Insure (Sprint 32 connecteurs assureurs).

**Livrables checkables** :
- [ ] Document `repo/docs/cross-tenant-pattern-reuse.md`
- [ ] Pattern reutilisation Insure :
  - Brokers : Type 2 managed_partner (utilise Skalean Broker ERP)
  - Assureurs : Type 3 api_partner (Sprint 32 connecteurs)
- [ ] Capabilities matrix Insure (preparation Sprint 32) :
  - `insure.policies.create` (broker tenants)
  - `insure.connectors.api_access` (assureur tenants)
  - etc.
- [ ] Interfaces communes : `BaseConnector`, `WebhookHandler`, `IsolationService` reutilisables
- [ ] Tests : compile-only verifications interfaces

**Fichiers crees / modifies** :
```
repo/docs/cross-tenant-pattern-reuse.md                                                          # ~200 lignes
repo/packages/insure/src/cross-tenant/capabilities-matrix-insure.ts                                # ~200 lignes (preparation)
```

**Criteres validation** :
- V1 (P0) : Documentation pattern complete
- V2 (P0) : Capabilities Insure preparation
- V3 (P0) : Interfaces compiles
- V4 (P0) : Sprint 32 ready a reutiliser

---

## Tache 5.7.10 -- Endpoints REST + Permissions

**Metadonnees** : Phase 5 / Sprint 25 / P0 / 5h / Depend de 5.7.9

**But** : Consolidation endpoints + permissions cross-tenant management.

**Livrables checkables** :
- [ ] Endpoints livres dans taches precedentes (consolidation)
- [ ] Permissions ajoutees catalog Sprint 7 :
  - `admin.tenants.set_type`
  - `admin.tenants.transition_type`
  - `admin.tenants.disable`
  - `admin.onboarding.execute`
  - `admin.capabilities.modify`
- [ ] Defaults : super admin Skalean only
- [ ] Tests RBAC

**Fichiers crees / modifies** :
```
repo/packages/auth/src/rbac/permissions.enum.ts                                                  # update
```

**Criteres validation** :
- V1 (P0) : Permissions cross-tenant management
- V2 (P0) : Tests 6+ scenarios

---

## Tache 5.7.11 -- Documentation Architecture

**Metadonnees** : Phase 5 / Sprint 25 / P0 / 4h / Depend de 5.7.10

**But** : Documentation finale architecture cross-tenant + onboarding guide + scenarios.

**Livrables checkables** :
- [ ] Document `repo/docs/cross-tenant-architecture.md`
- [ ] Document `repo/docs/onboarding-partner-guide.md` (pour customer success Skalean Sprint 35 pilote)
- [ ] Document `repo/docs/cross-tenant-isolation-tests-guide.md`
- [ ] Diagrams Mermaid

**Fichiers crees / modifies** :
```
repo/docs/cross-tenant-architecture.md                                                            # ~300 lignes
repo/docs/onboarding-partner-guide.md                                                              # ~200 lignes
repo/docs/cross-tenant-isolation-tests-guide.md                                                    # ~150 lignes
```

**Criteres validation** :
- V1 (P0) : 3 documents complets
- V2 (P0) : Diagrams clairs
- V3 (P0) : Sprint 35 pilote ready

---

## Tache 5.7.12 -- Tests Isolation Exhaustifs + Phase 5 Closure

**Metadonnees** : Phase 5 / Sprint 25 / P0 / 12h / Depend de 5.7.11

**But** : Suite tests exhaustive cross-tenant isolation + Phase 5 closure officielle.

**Livrables checkables** :

**Tests E2E (40+)** :
- [ ] Capabilities matrix : 3 types x ~15 capabilities = test access deny/allow (40 tests)
- [ ] Type 1 Atlas : full access (3)
- [ ] Type 2 Managed : isolation + cross-tenant share (8)
- [ ] Type 3 API Partner : passerelle + webhook signature + circuit breaker (8)
- [ ] Cross-tenant data sharing : sinistre status + photos + docs (5)
- [ ] Runtime activation : transitions + audit + isolation preserve (4)
- [ ] Onboarding wizard : 7 steps Type 2 + Type 3 (4)
- [ ] Privilege escalation cross-tenant audit (2)

**Phase 5 Closure document `repo/docs/phase-5-completion.md`** :
- 7 sprints livres : Foundation / IA Estimation / Sinistre Workflow / Web Garage / Web Garage Mobile / Flux M8 / Cross-Tenant Framework
- 87 taches detaillees Phase 5 (13+12+13+13+12+13+12)
- Skalean Garage ERP **production-ready**
- M8 workflow validated cross-tenant
- 3 types tenants ready pour onboarding Sprint 35 pilote

**Fichiers crees / modifies** :
```
repo/apps/api/test/cross-tenant/{40+ specs}.e2e-spec.ts
repo/docs/phase-5-completion.md                                                                    # closure
```

**Criteres validation** :
- V1 (P0) : 40+ tests passent
- V2 (P0) : CI green
- V3 (P0) : Documentation Phase 5 closure
- V4 (P0) : Reproducibility 5x

---

## Sortie du Sprint 25

A la fin de l'execution des 12 taches :

```
Cross-Tenant Framework operational :
  - 3 types tenants Repair runtime activation
    - Type 1 Atlas : Skalean garage interne
    - Type 2 Managed Partner : utilise Skalean ERP, data isolated
    - Type 3 API Partner : passerelle integration externe
  - CapabilitiesMatrix granular per type
  - CrossTenantSharingService : read-only views shared
  - Runtime activation : transitions + audit
  - Onboarding wizard backend (Sprint 27 UI ready)
  - Capabilities Guard middleware
  - API Partner connector + circuit breaker
  - Pattern reutilisable Insure (Sprint 32 ready)
  - Documentation complete + onboarding guide

40+ tests cross-tenant isolation

PHASE 5 COMPLETE : 7/7 sprints livres
```

**PHASE 5 RECAP** :

| Sprint | Module | Status |
|--------|--------|--------|
| B-19 | Vertical Repair Foundation (Skalean Atlas) | OK |
| B-20 | IA Estimation Photos (mock + DI swap Sprint 30+) | OK |
| B-21 | Sinistre Workflow detaille (split facturation) | OK |
| B-22 | Web Garage App | OK |
| B-23 | Web Garage Mobile PWA technicien | OK |
| B-24 | Flux Sinistre Client M8 end-to-end | OK |
| B-25 | Cross-Tenant Framework | OK |

**Sprint 26 (Phase 6 Admin Foundation) demarre avec** :
- Skalean Broker ERP + Skalean Garage ERP **production-ready**
- M8 workflow valide
- 3 types tenants ready
- Sprint 26 : web-insurtech-admin pour super admin Skalean (gestion plateforme global)

---

## Specifications Format Tache (pour Generation par Cowork)

Cowork genere `task-5.7.X-*.md` dans `00-pilotage/prompts-taches/sprint-25-cross-tenant-framework/`.

**Patterns code inline conserves** : capabilities matrix definition 3 types, ApiPartnerConnectorService avec circuit breaker + KMS encryption.

**Reference** : Sprint 6 multi-tenant + Sprint 24 cross-tenant routing.

---

**Fin du meta-prompt B-25 v2.2 format Option B. PHASE 5 COMPLETE.**
