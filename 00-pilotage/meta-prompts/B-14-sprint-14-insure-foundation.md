# META-PROMPT B-14 v3.0 -- SPRINT 14 INSURE FOUNDATION + 3 ENTITES EXPERTS (Vertical Broker)

**Version** : v3.0 (Option B Migration -- refonte minimale +3 entites experts)
**Phase** : 4 -- Vertical Insure (Assurflow Broker ERP + Experts Pool ACAPS)
**Sprint** : 14 / 40 (cumul v3.0) -- PREMIER de la Phase 4
**Position** : Apres Phase 3 horizontaux complete, debut Phase 4 vertical metier
**Numerotation taches** : 4.1.1 a 4.1.17 (vs 4.1.1 a 4.1.14 v2.2)
**Effort total** : ~95 heures developpement / 2.5 semaines (vs 80h v2.2)
**Priorite** : P0 (premier sprint vertical Phase 4 + foundation experts pool Sprint 22.7)

---

## Refonte v2.2 -> v3.0 : Changements minimes

Ce sprint est **legerement etendu** par rapport a v2.2 pour ajouter les 3 entites experts permettant :
- Carrier Portal Sprint 26.5 (designation experts)
- Expert App Sprint 22.7 (consume mission queue)
- Sprint 21 v3.0 workflow expert (envoi devis vers expert designe)

### Changements cle

| Element | v2.2 | v3.0 | Change |
|---------|------|------|--------|
| **Taches** | 14 | **17** | +3 (taches 4.1.15 a 4.1.17) |
| **Entites Insure** | 7 (products + quotes + policies + avenants + premiums + renewals + commissions) | **10** (+3 experts entities) | +3 |
| **Roles utilises** | broker_admin/user/assistant + carrier (Sprint 32) | + **expert_independent / firm_admin / associate / carrier_internal** (Sprint 7.5a) | +4 |
| **Effort** | 80h | **95h** | +15h |
| **Tests E2E** | 50+ | **65+** | +15 |

**Taches 4.1.1 a 4.1.14 = INCHANGEES v2.2** (preserves -- les modifier serait risque).

**Taches 4.1.15 a 4.1.17 = NOUVELLES v3.0** :
- 4.1.15 : `insure_experts` entity + catalog + KYB workflow (5h)
- 4.1.16 : `insure_expert_assignments` entity + service (5h)
- 4.1.17 : `insure_expert_reports` entity + service preview Sprint 22.7 (5h)

---

## Objectif Global du Sprint v3.0

Implementer **fondations Vertical Insure** + **3 entites experts pool ACAPS** :

**Heritage v2.2 (preserves)** :
- 7 entites lifecycle police (products, quotes, policies, avenants, premiums, renewals, commissions)
- Tarification engine basique
- Workflow signature police via Barid eSign
- Commissions courtier auto-calcul
- Reminders primes echues

**Nouveautes v3.0** :
- **3 entites experts** : `insure_experts` (pool agrees ACAPS) + `insure_expert_assignments` (designations par carriers) + `insure_expert_reports` (rapports expertise digitaux)
- Workflow catalog experts : carrier_admin onboarde son pool experts agrees ACAPS
- Service designation expert (consume Sprint 26.5 Carrier Portal)
- Service reception missions par expert (consume Sprint 22.7 Expert App)
- Cross-tenant `garage_to_expert_request` integration

---

## Frontiere du Sprint v3.0

**INCLUS (v2.2 preserves)** :
- 7 entities Insure + RLS multi-tenant
- 5 branches initiales (auto / sante / multirisque habitation / RC pro / voyage)
- Catalog products + tarification + quotes + policies + avenants + premiums + renewals + commissions
- Endpoints REST `/api/v1/insure/*`
- Integration cross-module Comm + Docs + Pay + Books + ACAPS

**INCLUS (NOUVEAU v3.0)** :
- **`insure_experts` entity** : catalog experts agrees ACAPS (CIN + agrement + specialty + zone + status)
- **`insure_expert_assignments` entity** : designations par carriers (workflow status complete)
- **`insure_expert_reports` entity** : rapports expertise (preview Sprint 22.7 full version)
- Services : ExpertsCatalogService + ExpertAssignmentsService + ExpertReportsService (preview)
- KYB workflow experts (validation ACAPS agrement non expire)
- Endpoints `/api/v1/insure/experts/*` (basics, full Sprint 22.7)

**EXCLU (v2.2 inchange + v3.0 specifique)** :
- Connecteurs assureurs (Wafa, Atlanta, Saham, RMA, AXA, MATU, Sanad) -- Sprint 32
- Self-service assure portal -- Sprint 18
- **Expert App UI complete -- Sprint 22.7** (mobile + desktop apps experts)
- **Carrier Portal UI complete -- Sprint 26.5** (carrier_expert_manager dashboard)
- **Workflow validation devis line-by-line -- Sprint 22.7** (full service avec signature Barid)
- IA-powered tarification -- Sprint 30+ defere

---

## Lectures Prealables Obligatoires

1. `00-pilotage/decisions/013-expert-acteur-central.md` -- workflow expert v3.0
2. `00-pilotage/documentation/3-schemas-database-PARTIE2.sql` -- tables insure_*
3. Sortie Sprint 7.5a : AuthRole +4 expert roles + cross-tenant `garage_to_expert_request`
4. Phase 3 modules horizontaux : tous prerequis bricks (Comm Sprint 9 + Docs Sprint 10 + Pay Sprint 11 + Books Sprint 12)
5. ACAPS regulations : pool experts agrees + agrement renewal

---

## Dependencies Sprint precedents (explicites)

Ce Sprint 14 v3.0 **depend critiquement** de :
- **Sprint 7.5a** : 4 expert roles + permissions expertise + cross-tenant types
- **Sprint 6** : Multi-tenant + RLS + helper postgres app_can_access_tenant
- **Sprint 7** : RBAC + Guards
- **Sprint 9** : NotificationsService (notifications experts)
- **Sprint 10** : Docs + Signature Barid eSign (pour rapports experts Sprint 22.7)
- **Sprint 11** : Pay (pour honoraires experts -> carriers Sprint 22.7)

Ce Sprint 14 v3.0 **BLOQUE** :
- **Sprint 15** : Insure Lifecycle Police (consume entites Sprint 14)
- **Sprint 22.7** : Expert App (consume `insure_experts` + `insure_expert_assignments` + `insure_expert_reports`)
- **Sprint 26.5** : Carrier Portal (consume `insure_experts` pour designation)
- **Sprint 21 v3.0** : Sinistre Workflow (route devis vers expert designe via `insure_expert_assignments`)

---

## Stack Imposee (Sprint 14 v3.0)

| Composant | Version | Notes |
|-----------|---------|-------|
| decimal.js | 10.4.3 | tarification + commissions + honoraires experts precision |
| date-fns | 4.1.0 | duration polices + renewals + ACAPS agrement expiry |
| zod | 3.24.1 | validation schemas |
| **@insurtech/signature** | workspace | Preview Barid eSign pour rapports experts (Sprint 22.7) |

Pas de nouvelle dep externe.

---

## Vue d'Ensemble des 17 Taches v3.0

| # | Tache | Effort | Priorite | Refonte v3.0 ? | Depend de |
|---|-------|--------|----------|-----------------|-----------|
| 4.1.1 | insure_products entity + catalog 5 branches initiales (admin) | 6h | P0 | Inchange v2.2 | Phase 3 |
| 4.1.2 | Tarification engine basique (lookup tables) | 6h | P0 | Inchange v2.2 | 4.1.1 |
| 4.1.3 | insure_quotes entity + service + devis PDF generation | 7h | P0 | Inchange v2.2 | 4.1.2 |
| 4.1.4 | insure_policies entity + service + status workflow | 6h | P0 | Inchange v2.2 | 4.1.3 |
| 4.1.5 | Souscription workflow : quote -> policy via signature Barid eSign | 6h | P0 | Inchange v2.2 | 4.1.4 |
| 4.1.6 | insure_avenants entity + service (modifs police active) | 5h | P0 | Inchange v2.2 | 4.1.5 |
| 4.1.7 | insure_premiums entity + echeancier + tracking paiements | 5h | P0 | Inchange v2.2 | 4.1.6 |
| 4.1.8 | insure_renewals entity + cron renewal 60j avant expiration | 5h | P0 | Inchange v2.2 | 4.1.7 |
| 4.1.9 | insure_commissions entity + auto-calcul + integration Books | 5h | P0 | Inchange v2.2 | 4.1.8 |
| 4.1.10 | Cron reminders primes (J-15, J-7, J-3, post-echeance) | 4h | P0 | Inchange v2.2 | 4.1.9 |
| 4.1.11 | Auto-log interactions CRM Insure events + ACAPS data feed | 4h | P0 | Inchange v2.2 | 4.1.10 |
| 4.1.12 | Endpoints REST `/api/v1/insure/*` + permissions Insure | 6h | P0 | Inchange v2.2 | 4.1.11 |
| 4.1.13 | Dashboards Insure (extends Sprint 13 analytics) | 4h | P1 | Inchange v2.2 | 4.1.12 |
| 4.1.14 | Tests E2E (50+) + fixtures realistes 5 branches + seeds | 11h | P0 | Inchange v2.2 | 4.1.13 |
| **4.1.15** | **insure_experts entity + catalog pool ACAPS + KYB workflow** | **5h** | **P0** | **NOUVEAU v3.0** | **4.1.14** |
| **4.1.16** | **insure_expert_assignments entity + service designation par carriers** | **5h** | **P0** | **NOUVEAU v3.0** | **4.1.15** |
| **4.1.17** | **insure_expert_reports entity + service preview Sprint 22.7** | **5h** | **P0** | **NOUVEAU v3.0** | **4.1.16** |

**Total** : 95 heures (vs 80h v2.2). +15h pour 3 entites experts.

---

# TACHES 4.1.1 a 4.1.14 (INCHANGE v2.2)

Les 14 taches v2.2 sont **preservees inchangees**. Reference : `B-14-sprint-14-insure-foundation.md` v2.2 original (lignes 100-902).

**Aucune modification** sur :
- 7 entites Insure (products / quotes / policies / avenants / premiums / renewals / commissions)
- Tarification engine basique
- Workflow lifecycle police
- Souscription via Barid eSign
- Commissions courtier
- Cron renewals + reminders
- ACAPS data feed
- Tests E2E v2.2 (50+ scenarios preserves)

**Important** : ces taches doivent etre executees **AVANT** les 3 nouvelles taches experts v3.0 (sequencing strict).

---

# DETAIL DES 3 NOUVELLES TACHES v3.0

---

## Tache 4.1.15 -- NOUVEAU v3.0 : insure_experts entity + catalog pool ACAPS + KYB

**Sprint** : 14 (Phase 4 / Sprint 1)
**Phase** : 4 -- Vertical Insure
**Priorite** : P0
**Effort** : 5h
**Dependances** : 4.1.14 (Sprint 14 v2.2 fini) + Sprint 7.5a (4 expert roles + permissions)

### But

Implementer entity `insure_experts` (catalog experts agrees ACAPS) + workflow KYB onboarding + verification ACAPS agrement renewal.

### Contexte

Les experts auto agrees ACAPS sont l'acteur 6/6 ecosystem Assurflow v3.0 (decision-013). Ils valident les devis garage avant approbation paiement carrier. Sans pool experts catalogue dans Assurflow, le workflow v3.0 ne peut pas fonctionner.

Cette tache cree la **table de reference** des experts. Les Sprints 22.7 (Expert App) et 26.5 (Carrier Portal) consument cette table.

### Livrables checkables

- [ ] Migration : table `insure_experts` :
  ```sql
  CREATE TABLE insure_experts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth_users(id) ON DELETE SET NULL,
    
    -- Identite + agrement ACAPS
    full_name text NOT NULL,
    cin_number text NOT NULL,
    cin_document_url text,
    phone text NOT NULL,
    email text NOT NULL,
    acaps_agrement_number text NOT NULL UNIQUE,
    acaps_agrement_document_url text NOT NULL,
    acaps_agrement_expiry_date date NOT NULL,
    acaps_specialty text[] NOT NULL CHECK (array_length(acaps_specialty, 1) > 0),
    -- specialty values : 'auto', 'incendie', 'multirisque', 'transport', 'autre'
    
    -- Cabinet (si associate ou firm_admin)
    firm_name text,
    firm_address text,
    firm_phone text,
    firm_email text,
    firm_ice text,  -- Identifiant Commun Entreprise
    
    -- Type d'expert
    expert_type text NOT NULL CHECK (expert_type IN ('independent', 'firm_admin', 'associate', 'carrier_internal')),
    carrier_tenant_id uuid REFERENCES auth_tenants(id),  -- NOT NULL si expert_type='carrier_internal'
    
    -- Geographic operating zones
    active_zones text[],  -- 'casablanca', 'marrakech', 'rabat', 'tanger', 'fes', 'agadir', etc.
    
    -- Stats (computed by Sprint 26.5)
    total_missions integer NOT NULL DEFAULT 0,
    avg_rating decimal(3, 2),
    avg_response_time_hours decimal(5, 2),
    
    -- Honoraires baseline (peut etre override par mission)
    baseline_honoraire_mad decimal(10, 2),
    
    -- Status
    status text NOT NULL CHECK (status IN ('active', 'pending_kyb', 'suspended', 'expired_agrement', 'inactive')) DEFAULT 'pending_kyb',
    
    -- KYB workflow
    kyb_reviewed_at timestamptz,
    kyb_reviewed_by_user_id uuid REFERENCES auth_users(id),
    kyb_rejection_reason text,
    
    -- Metadata
    notes text,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW()
  );

  CREATE INDEX idx_insure_experts_tenant ON insure_experts(tenant_id);
  CREATE INDEX idx_insure_experts_status ON insure_experts(status);
  CREATE INDEX idx_insure_experts_specialty ON insure_experts USING GIN(acaps_specialty);
  CREATE INDEX idx_insure_experts_zones ON insure_experts USING GIN(active_zones);
  CREATE INDEX idx_insure_experts_carrier ON insure_experts(carrier_tenant_id) WHERE expert_type = 'carrier_internal';

  ALTER TABLE insure_experts ENABLE ROW LEVEL SECURITY;
  ALTER TABLE insure_experts FORCE ROW LEVEL SECURITY;
  CREATE POLICY insure_experts_tenant_isolation ON insure_experts USING (app_can_access_tenant(tenant_id));
  ```
- [ ] Entity TypeORM `insure-expert.entity.ts` (~80 lignes)
- [ ] Service `experts-catalog.service.ts` :
  - `onboardExpert(input)` : creation expert avec status='pending_kyb'
  - `approveKyb(expertId, reviewerId)` : verification documents + status='active'
  - `rejectKyb(expertId, reviewerId, reason)` : status='inactive' + raison
  - `suspendExpert(expertId, reason)` : status='suspended'
  - `checkAgrementExpiry()` : cron daily, si expiry_date < today, status='expired_agrement'
  - `searchExperts(filters)` : par specialty + zone + status + carrier_tenant_id
- [ ] Validation Zod : email format + CIN MA format + acaps_agrement_number format + expiry_date > today
- [ ] Cron `insure-experts-agrement-expiry.cron.ts` : daily check + notify experts 30j avant expiration
- [ ] Endpoints REST :
  - `POST /api/v1/insure/experts/onboard`
  - `GET /api/v1/insure/experts/search?specialty=auto&zone=marrakech`
  - `POST /api/v1/insure/experts/:id/approve-kyb`
  - `POST /api/v1/insure/experts/:id/reject-kyb`
  - `POST /api/v1/insure/experts/:id/suspend`
- [ ] Permissions :
  - `insure.experts.read_pool` (carrier_admin + carrier_expert_manager + super_admin_platform)
  - `insure.experts.onboard` (super_admin_platform + carrier_admin)
  - `insure.experts.approve_kyb` (super_admin_platform + carrier_admin)
  - `insure.experts.suspend` (super_admin_platform + carrier_admin)
- [ ] Tests unit + integration 15+ scenarios

### Pattern critique : ExpertsCatalogService

```typescript
@Injectable()
export class ExpertsCatalogService {
  /**
   * Onboard nouveau expert dans pool.
   * Status initial : pending_kyb.
   * Verification ACAPS agrement obligatoire avant activation.
   */
  async onboardExpert(input: OnboardExpertInput): Promise<InsureExpert> {
    // Validation
    const validated = OnboardExpertSchema.parse(input);
    
    // Check uniqueness ACAPS agrement
    const existing = await this.expertsRepo.findOne({
      where: { acaps_agrement_number: validated.acaps_agrement_number }
    });
    if (existing) {
      throw new ConflictException(`Expert ACAPS ${validated.acaps_agrement_number} already exists`);
    }
    
    // Check expiry date in future
    if (isBefore(validated.acaps_agrement_expiry_date, new Date())) {
      throw new BadRequestException('ACAPS agrement expiry date must be in future');
    }
    
    // Create expert
    const expert = await this.expertsRepo.save({
      tenant_id: validated.tenant_id,
      user_id: validated.user_id ?? null,
      full_name: validated.full_name,
      cin_number: validated.cin_number,
      cin_document_url: validated.cin_document_url,
      phone: validated.phone,
      email: validated.email,
      acaps_agrement_number: validated.acaps_agrement_number,
      acaps_agrement_document_url: validated.acaps_agrement_document_url,
      acaps_agrement_expiry_date: validated.acaps_agrement_expiry_date,
      acaps_specialty: validated.acaps_specialty,
      firm_name: validated.firm_name,
      firm_address: validated.firm_address,
      firm_ice: validated.firm_ice,
      expert_type: validated.expert_type,
      carrier_tenant_id: validated.carrier_tenant_id,
      active_zones: validated.active_zones ?? [],
      baseline_honoraire_mad: validated.baseline_honoraire_mad ?? 1500,  // default 1500 MAD
      status: 'pending_kyb',
    });
    
    // Notify admin for KYB review
    await this.notificationsService.notifyAdminExpertKybRequired(expert.id);
    
    // Audit log
    await this.auditLogService.log({
      entity_type: 'insure_expert',
      entity_id: expert.id,
      action: 'onboarded',
      actor_user_id: this.userContext.userId,
    });
    
    // Emit event
    await this.kafkaProducer.emit('insurtech.events.insure.expert.onboarded', {
      expert_id: expert.id,
      expert_type: expert.expert_type,
      tenant_id: expert.tenant_id,
    });
    
    return expert;
  }
  
  /**
   * Approve KYB after document verification.
   * Status : pending_kyb -> active.
   */
  async approveKyb(expertId: string, reviewerId: string): Promise<void> {
    const expert = await this.expertsRepo.findOneOrFail({ where: { id: expertId } });
    
    if (expert.status !== 'pending_kyb') {
      throw new BadRequestException(`Expert ${expertId} is not pending_kyb (status: ${expert.status})`);
    }
    
    // Re-check agrement expiry
    if (isBefore(expert.acaps_agrement_expiry_date, new Date())) {
      throw new BadRequestException('ACAPS agrement expired');
    }
    
    await this.expertsRepo.update(expertId, {
      status: 'active',
      kyb_reviewed_at: new Date(),
      kyb_reviewed_by_user_id: reviewerId,
    });
    
    // Notify expert
    await this.notificationsService.notifyExpertKybApproved(expert.user_id);
    
    // Emit event
    await this.kafkaProducer.emit('insurtech.events.insure.expert.kyb_approved', {
      expert_id: expertId,
      reviewer_id: reviewerId,
    });
  }
  
  /**
   * Cron daily : check ACAPS agrement expiry.
   * Auto-suspend experts dont agrement expired.
   */
  async checkAgrementExpiry(): Promise<void> {
    const today = new Date();
    
    // Find experts active dont agrement expired
    const expiredExperts = await this.expertsRepo.find({
      where: { 
        status: 'active',
        acaps_agrement_expiry_date: LessThan(today) 
      }
    });
    
    for (const expert of expiredExperts) {
      await this.expertsRepo.update(expert.id, { status: 'expired_agrement' });
      
      await this.notificationsService.notifyExpertAgrementExpired(expert.user_id);
      
      await this.kafkaProducer.emit('insurtech.events.insure.expert.agrement_expired', {
        expert_id: expert.id,
      });
    }
    
    // Find experts agrement expire dans 30j -> reminder
    const expiringExperts = await this.expertsRepo.find({
      where: {
        status: 'active',
        acaps_agrement_expiry_date: Between(today, addDays(today, 30))
      }
    });
    
    for (const expert of expiringExperts) {
      await this.notificationsService.notifyExpertAgrementExpiringSoon(
        expert.user_id, 
        expert.acaps_agrement_expiry_date
      );
    }
  }
  
  /**
   * Search experts pool avec filtres (utilise par Sprint 26.5 Carrier Portal).
   */
  async searchExperts(filters: SearchExpertsFilters): Promise<InsureExpert[]> {
    const qb = this.expertsRepo.createQueryBuilder('expert')
      .where('expert.status = :status', { status: 'active' });
    
    if (filters.specialty) {
      qb.andWhere(':specialty = ANY(expert.acaps_specialty)', { specialty: filters.specialty });
    }
    
    if (filters.zone) {
      qb.andWhere(':zone = ANY(expert.active_zones)', { zone: filters.zone });
    }
    
    if (filters.expert_type) {
      qb.andWhere('expert.expert_type = :type', { type: filters.expert_type });
    }
    
    if (filters.carrier_tenant_id && filters.expert_type === 'carrier_internal') {
      qb.andWhere('expert.carrier_tenant_id = :carrier', { carrier: filters.carrier_tenant_id });
    }
    
    // Order : avg_rating DESC, avg_response_time_hours ASC, total_missions DESC
    qb.orderBy('expert.avg_rating', 'DESC', 'NULLS LAST')
      .addOrderBy('expert.avg_response_time_hours', 'ASC', 'NULLS LAST')
      .addOrderBy('expert.total_missions', 'DESC');
    
    return qb.getMany();
  }
}
```

### Notes implementation

1. **ACAPS agrement renewal** : cron daily auto-suspend si expired + reminder 30j avant. Critique car ACAPS regulator suspend les experts non a jour.
2. **expert_type = 'carrier_internal'** : doit avoir `carrier_tenant_id` non null. Constraint applicative + check.
3. **Specialty + zone** : indexes GIN pour search performance.
4. **baseline_honoraire_mad default 1500** : valeur indicative MA pour expertise auto standard.
5. **Workflow KYB** : initial onboarding par expert ou carrier_admin -> review par super_admin_platform ou carrier_admin -> approve/reject.

### Criteres validation V1-V10

| ID | Critere | Priorite |
|----|---------|----------|
| V1 | Migration table insure_experts | P0 |
| V2 | RLS active + tenant isolation | P0 |
| V3 | Indexes performance (GIN specialty + zones) | P0 |
| V4 | Service 6 methodes (onboard / approveKyb / rejectKyb / suspend / checkExpiry / search) | P0 |
| V5 | Validation Zod CIN + ACAPS + email | P0 |
| V6 | Cron daily expiry check | P0 |
| V7 | Constraint carrier_tenant_id si carrier_internal | P0 |
| V8 | 5 endpoints REST + permissions | P0 |
| V9 | Tests 15+ scenarios PASS | P0 |
| V10 | Events Kafka emis | P0 |

### Fichiers crees / modifies

```
repo/packages/database/src/migrations/{date}-Sprint14-InsureExperts.ts                   # ~60 lignes
repo/packages/insure/src/entities/insure-expert.entity.ts                                # ~80 lignes
repo/packages/insure/src/services/experts-catalog.service.ts                              # ~350 lignes
repo/packages/insure/src/services/experts-catalog.service.spec.ts                          # ~200 lignes
repo/packages/insure/src/jobs/insure-experts-agrement-expiry.cron.ts                        # ~120 lignes
repo/apps/api/src/modules/insure/controllers/experts.controller.ts                          # ~150 lignes
```

---

## Tache 4.1.16 -- NOUVEAU v3.0 : insure_expert_assignments + service designation

**Sprint** : 14 (Phase 4 / Sprint 1)
**Phase** : 4 -- Vertical Insure
**Priorite** : P0
**Effort** : 5h
**Dependances** : 4.1.15

### But

Implementer entity `insure_expert_assignments` (designations experts par carriers) + service designation + workflow accept/reject/schedule.

### Contexte

L'expert est designe par le **carrier** sur un sinistre (decision-013). Cette table trace toutes les designations + workflow status. Sera consume par Sprint 22.7 (Expert App) et Sprint 26.5 (Carrier Portal).

### Livrables checkables

- [ ] Migration : table `insure_expert_assignments` :
  ```sql
  CREATE TABLE insure_expert_assignments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
    
    -- Carrier qui designe
    carrier_tenant_id uuid NOT NULL REFERENCES auth_tenants(id),
    carrier_user_id uuid NOT NULL REFERENCES auth_users(id),
    
    -- Expert designe
    expert_tenant_id uuid NOT NULL REFERENCES auth_tenants(id),
    expert_id uuid NOT NULL REFERENCES insure_experts(id),
    expert_user_id uuid NOT NULL REFERENCES auth_users(id),
    
    -- Sinistre lie (FK insure_sinistres si existe, sinon uuid)
    sinistre_id uuid NOT NULL,
    
    -- Garage cible (pour visite)
    garage_tenant_id uuid REFERENCES auth_tenants(id),
    garage_address text,
    garage_lat decimal(10, 7),
    garage_lng decimal(10, 7),
    
    -- Status workflow
    status text NOT NULL CHECK (status IN (
      'designated',     -- designation par carrier (initial)
      'accepted',       -- expert a accepte
      'rejected',       -- expert a rejete (avec raison)
      'in_progress',    -- visite en cours
      'completed',      -- rapport soumis
      'cancelled'       -- annule par carrier
    )) DEFAULT 'designated',
    
    -- Timestamps
    designated_at timestamptz NOT NULL DEFAULT NOW(),
    accepted_at timestamptz,
    rejected_at timestamptz,
    rejection_reason text,
    visit_scheduled_at timestamptz,
    visit_completed_at timestamptz,
    report_submitted_at timestamptz,
    completed_at timestamptz,
    cancelled_at timestamptz,
    cancelled_reason text,
    
    -- Honoraire pour cette mission
    honoraire_mad decimal(10, 2) NOT NULL,
    honoraire_invoice_id uuid,  -- FK books_invoices Sprint 12 (Sprint 22.7 plein integration)
    honoraire_payment_status text CHECK (honoraire_payment_status IN ('pending', 'invoiced', 'paid', 'overdue')) DEFAULT 'pending',
    
    -- Notes
    notes text,
    
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW()
  );

  CREATE INDEX idx_expert_assignments_tenant ON insure_expert_assignments(tenant_id);
  CREATE INDEX idx_expert_assignments_carrier ON insure_expert_assignments(carrier_tenant_id);
  CREATE INDEX idx_expert_assignments_expert ON insure_expert_assignments(expert_id);
  CREATE INDEX idx_expert_assignments_sinistre ON insure_expert_assignments(sinistre_id);
  CREATE INDEX idx_expert_assignments_status ON insure_expert_assignments(status);
  CREATE INDEX idx_expert_assignments_garage ON insure_expert_assignments(garage_tenant_id);

  ALTER TABLE insure_expert_assignments ENABLE ROW LEVEL SECURITY;
  ALTER TABLE insure_expert_assignments FORCE ROW LEVEL SECURITY;
  CREATE POLICY expert_assignments_tenant_isolation ON insure_expert_assignments USING (app_can_access_tenant(tenant_id));
  ```
- [ ] Entity TypeORM `insure-expert-assignment.entity.ts` (~90 lignes)
- [ ] Service `expert-assignments.service.ts` :
  - `designateExpert(input)` : carrier designe expert + create assignment + create cross-tenant authorization + notify expert
  - `acceptAssignment(assignmentId, expertUserId)` : status='accepted', notify carrier + garage
  - `rejectAssignment(assignmentId, expertUserId, reason)` : status='rejected', trigger re-designation
  - `scheduleVisit(assignmentId, scheduledAt)` : visit_scheduled_at, notify garage
  - `markVisitCompleted(assignmentId)` : visit_completed_at, status='in_progress'
  - `markReportSubmitted(assignmentId, reportId)` : report_submitted_at, status='completed'
  - `cancelAssignment(assignmentId, reason)` : carrier annule + auto re-designate ou escalate
  - `listMyAssignments(expertUserId, filters)` : expert voit ses missions
  - `listCarrierAssignments(carrierTenantId, filters)` : carrier voit toutes designations
- [ ] Cross-tenant : auto-create `garage_to_expert_request` lors designation (Sprint 7.5a type)
- [ ] Permissions :
  - `carrier.experts.designate` (carrier_expert_manager + carrier_admin)
  - `expertise.missions.read` (expert_*)
  - `expertise.missions.accept` (expert_*)
  - `expertise.missions.reject` (expert_*)
- [ ] Endpoints REST :
  - `POST /api/v1/insure/expert-assignments`
  - `GET /api/v1/insure/expert-assignments/my-missions` (expert)
  - `GET /api/v1/insure/expert-assignments/carrier-designations` (carrier)
  - `POST /api/v1/insure/expert-assignments/:id/accept`
  - `POST /api/v1/insure/expert-assignments/:id/reject`
  - `POST /api/v1/insure/expert-assignments/:id/schedule-visit`
  - `POST /api/v1/insure/expert-assignments/:id/cancel`
- [ ] Tests unit + integration 20+ scenarios

### Pattern critique : designateExpert avec cross-tenant authorization

```typescript
async designateExpert(input: DesignateExpertInput): Promise<InsureExpertAssignment> {
  const validated = DesignateExpertSchema.parse(input);
  
  // Verify expert is active + agrement not expired
  const expert = await this.expertsRepo.findOneOrFail({ 
    where: { id: validated.expert_id, status: 'active' } 
  });
  
  if (isBefore(expert.acaps_agrement_expiry_date, new Date())) {
    throw new BadRequestException('Expert ACAPS agrement expired');
  }
  
  // Verify carrier user has permission
  await this.rbacService.userHasPermission(
    validated.carrier_user_id,
    'carrier.experts.designate'
  );
  
  // Create assignment
  const assignment = await this.assignmentsRepo.save({
    tenant_id: validated.carrier_tenant_id,
    carrier_tenant_id: validated.carrier_tenant_id,
    carrier_user_id: validated.carrier_user_id,
    expert_tenant_id: expert.tenant_id,
    expert_id: expert.id,
    expert_user_id: expert.user_id!,
    sinistre_id: validated.sinistre_id,
    garage_tenant_id: validated.garage_tenant_id,
    garage_address: validated.garage_address,
    garage_lat: validated.garage_lat,
    garage_lng: validated.garage_lng,
    honoraire_mad: validated.honoraire_mad ?? expert.baseline_honoraire_mad ?? 1500,
    status: 'designated',
  });
  
  // Create cross-tenant authorization (Sprint 7.5a type garage_to_expert_request)
  if (validated.garage_tenant_id) {
    await this.crossTenantAuthRepo.save({
      type: 'garage_to_expert_request',
      from_tenant_id: validated.garage_tenant_id,
      to_tenant_id: expert.tenant_id,
      resource_type: 'sinistre',
      resource_id: validated.sinistre_id,
      created_by_user_id: validated.carrier_user_id,
      expires_at: addDays(new Date(), 30),
    });
  }
  
  // Notify expert via Web Push + email + SMS
  await this.notificationsService.notifyExpertNewMission(expert.user_id!, assignment.id);
  
  // Audit log
  await this.auditLogService.log({
    entity_type: 'insure_expert_assignment',
    entity_id: assignment.id,
    action: 'designated',
    actor_user_id: validated.carrier_user_id,
    details: { 
      expert_id: expert.id, 
      sinistre_id: validated.sinistre_id,
      honoraire_mad: assignment.honoraire_mad 
    },
  });
  
  // Emit event
  await this.kafkaProducer.emit('insurtech.events.insure.expert.designated', {
    assignment_id: assignment.id,
    expert_id: expert.id,
    carrier_tenant_id: validated.carrier_tenant_id,
    sinistre_id: validated.sinistre_id,
  });
  
  return assignment;
}
```

### Criteres validation V1-V10

| ID | Critere | Priorite |
|----|---------|----------|
| V1 | Migration table insure_expert_assignments | P0 |
| V2 | RLS active + tenant isolation | P0 |
| V3 | Service 9 methodes | P0 |
| V4 | Cross-tenant auto-create garage_to_expert_request | P0 |
| V5 | Verification expert active + agrement valid | P0 |
| V6 | Workflow status 6 etats | P0 |
| V7 | Permissions enforces | P0 |
| V8 | 7 endpoints REST | P0 |
| V9 | Events Kafka 6 types | P0 |
| V10 | Tests 20+ scenarios PASS | P0 |

### Fichiers crees / modifies

```
repo/packages/database/src/migrations/{date}-Sprint14-InsureExpertAssignments.ts          # ~70 lignes
repo/packages/insure/src/entities/insure-expert-assignment.entity.ts                       # ~90 lignes
repo/packages/insure/src/services/expert-assignments.service.ts                             # ~400 lignes
repo/packages/insure/src/services/expert-assignments.service.spec.ts                         # ~300 lignes
repo/apps/api/src/modules/insure/controllers/expert-assignments.controller.ts                 # ~200 lignes
```

---

## Tache 4.1.17 -- NOUVEAU v3.0 : insure_expert_reports + service preview Sprint 22.7

**Sprint** : 14 (Phase 4 / Sprint 1)
**Phase** : 4 -- Vertical Insure
**Priorite** : P0
**Effort** : 5h
**Dependances** : 4.1.16

### But

Implementer entity `insure_expert_reports` (rapports expertise digitaux) + service basique preview. **Full version dans Sprint 22.7 Expert App** (validation devis line-by-line + signature Barid eSign).

### Contexte

L'expert produit un rapport apres visite garage avec decision : validated / modified / rejected sur le devis. Cette entity stocke le rapport. Sprint 14 livre la table + service minimal CRUD. Sprint 22.7 livre la logique metier complete (UI + validation devis + signature Barid).

### Livrables checkables

- [ ] Migration : table `insure_expert_reports` :
  ```sql
  CREATE TABLE insure_expert_reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
    
    assignment_id uuid NOT NULL REFERENCES insure_expert_assignments(id) ON DELETE CASCADE,
    expert_id uuid NOT NULL REFERENCES insure_experts(id),
    expert_user_id uuid NOT NULL REFERENCES auth_users(id),
    
    -- Devis source
    devis_id uuid NOT NULL,  -- FK repair_devis (Sprint 19)
    
    -- Contenu rapport (JSONB structure flexible)
    report_content jsonb NOT NULL DEFAULT '{}'::jsonb,
    /*
    structure : {
      sections: [
        { type: 'observation', title: '...', content: '...' },
        { type: 'damages', items: [...] },
        { type: 'recommendations', content: '...' }
      ],
      findings: [...],
      recommendations: '...'
    }
    */
    
    -- Photos
    photos_urls text[] NOT NULL DEFAULT '{}',
    
    -- Decision
    decision text CHECK (decision IN ('validated', 'modified', 'rejected')),
    decision_justification text,
    
    -- Modifications devis (si decision='modified')
    modifications jsonb,
    /*
    structure : {
      lines_modified: [
        { line_id, old_quantity, new_quantity, old_unit_price, new_unit_price, old_total_ttc, new_total_ttc, reason }
      ],
      total_before: 'X.XX',
      total_after: 'Y.YY'
    }
    */
    
    -- Generated PDF
    pdf_url text,
    pdf_generated_at timestamptz,
    
    -- Signature Barid eSign (Sprint 10 + full Sprint 22.7)
    signature_id uuid,  -- FK docs_signatures Sprint 10
    signed_at timestamptz,
    signature_legal_status text CHECK (signature_legal_status IN ('pending', 'signed', 'expired')) DEFAULT 'pending',
    
    -- Status workflow
    status text NOT NULL CHECK (status IN ('draft', 'completed', 'signed', 'submitted_to_carrier')) DEFAULT 'draft',
    
    -- Submission to carrier
    submitted_to_carrier_at timestamptz,
    carrier_received_at timestamptz,
    
    -- Metadata
    notes text,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW()
  );

  CREATE INDEX idx_expert_reports_tenant ON insure_expert_reports(tenant_id);
  CREATE INDEX idx_expert_reports_assignment ON insure_expert_reports(assignment_id);
  CREATE INDEX idx_expert_reports_expert ON insure_expert_reports(expert_id);
  CREATE INDEX idx_expert_reports_devis ON insure_expert_reports(devis_id);
  CREATE INDEX idx_expert_reports_status ON insure_expert_reports(status);

  ALTER TABLE insure_expert_reports ENABLE ROW LEVEL SECURITY;
  ALTER TABLE insure_expert_reports FORCE ROW LEVEL SECURITY;
  CREATE POLICY expert_reports_tenant_isolation ON insure_expert_reports USING (app_can_access_tenant(tenant_id));
  ```
- [ ] Entity TypeORM `insure-expert-report.entity.ts` (~100 lignes)
- [ ] Service `expert-reports-basic.service.ts` (preview Sprint 22.7 full version) :
  - `createDraftReport(input)` : create row with status='draft'
  - `updateDraft(reportId, updates)` : update report_content + photos
  - `markCompleted(reportId)` : status='draft' -> 'completed' (avant signature)
  - `getReport(reportId)` : read avec permissions check
  - `listAssignmentReports(assignmentId)` : tous rapports d'un assignment
- [ ] **Pas de signature Barid dans Sprint 14** -- juste preview structure. Full integration Sprint 22.7.
- [ ] **Pas de validation devis line-by-line dans Sprint 14** -- juste structure pour decision/modifications. Full UI Sprint 22.7.
- [ ] Permissions :
  - `expertise.report.create` (expert_*)
  - `expertise.report.read` (expert_* + carrier_* du tenant + admin)
- [ ] Endpoints REST :
  - `POST /api/v1/insure/expert-reports`
  - `GET /api/v1/insure/expert-reports/:id`
  - `PUT /api/v1/insure/expert-reports/:id`
  - `POST /api/v1/insure/expert-reports/:id/mark-completed`
- [ ] Tests unit + integration 15+ scenarios

### Notes implementation

1. **Preview seulement** : Sprint 14 livre la table + CRUD basique. Logique complete Sprint 22.7 (validation devis + signature + workflow soumission carrier).
2. **JSONB report_content** : structure flexible, schema validation Zod cote service.
3. **decision nullable Sprint 14** : Sprint 22.7 ajoutera workflow rendant obligatoire avant submission.
4. **signature_id nullable Sprint 14** : Sprint 22.7 integrera Barid eSign full.
5. **Sprint 22.7 etendra ce service** : ajoutera methodes validateDevis / modifyDevis / rejectDevis / signReport / submitToCarrier.

### Criteres validation V1-V8

| ID | Critere | Priorite |
|----|---------|----------|
| V1 | Migration table insure_expert_reports | P0 |
| V2 | RLS active + tenant isolation | P0 |
| V3 | Service basic 5 methodes preview | P0 |
| V4 | Indexes performance | P0 |
| V5 | Permissions enforces | P0 |
| V6 | 4 endpoints REST basics | P0 |
| V7 | Sprint 22.7 extension path documente | P0 |
| V8 | Tests 15+ scenarios basics | P0 |

### Fichiers crees / modifies

```
repo/packages/database/src/migrations/{date}-Sprint14-InsureExpertReports.ts              # ~70 lignes
repo/packages/insure/src/entities/insure-expert-report.entity.ts                            # ~100 lignes
repo/packages/insure/src/services/expert-reports-basic.service.ts                            # ~250 lignes (preview)
repo/packages/insure/src/services/expert-reports-basic.service.spec.ts                        # ~200 lignes
repo/apps/api/src/modules/insure/controllers/expert-reports.controller.ts                     # ~150 lignes
repo/docs/expert-reports-sprint-22.7-extension-path.md                                         # ~100 lignes (extension path Sprint 22.7)
```

---

# VERIFICATIONS TRANSVERSALES SPRINT 14 v3.0

- TR-BUILD : typecheck + build + lint OK
- TR-TEST : tests existants + nouveaux PASS sans regression
- TR-NO-EMOJI : 0 emoji
- TR-DB-MIGRATION : 3 nouvelles migrations idempotentes
- TR-RLS : 3 nouvelles tables avec RLS active
- TR-GIT-TAG : `sprint-14-complete-v3-insure-foundation`

---

# JALON GO/NO-GO SPRINT 14 v3.0

## GO

Criteres P0 PASS :
1. 7 entites Insure v2.2 livrees (preserves)
2. 3 nouvelles entites v3.0 livrees (insure_experts + assignments + reports)
3. KYB workflow experts fonctionnel
4. Service designation par carriers
5. Cross-tenant garage_to_expert_request auto-create
6. Sprint 22.7 extension path documente
7. 65+ tests E2E PASS (50+ v2.2 + 15+ v3.0)
8. Coverage Sprint 14 >= 85%
9. Tag pose

## NO-GO

Si critique FAIL :
- Migration regression (impact 7 entites v2.2)
- RLS leak nouvelles tables experts
- Cross-tenant fuite

Action : revert + reviser tache + re-tenter.

---

# REFERENCES

- decision-013-expert-acteur-central.md (workflow expert v3.0)
- decision-012-6-acteurs-ecosystem.md (acteur 6 Expert)
- B-7.5a Foundation (4 expert roles + cross-tenant garage_to_expert)
- B-22.7 Expert App (consume entites v3.0)
- B-26.5 Carrier Portal (consume insure_experts pour designation)
- B-21 v3.0 Sinistre Workflow (consume insure_expert_assignments)
- B-14 v2.2 (preserve -- taches 4.1.1 a 4.1.14)
- CHECKLIST-MASTER-EXECUTION.md section 4.1 (Sprint 14)

---

**Fin du meta-prompt B-14 v3.0 Insure Foundation + 3 entites experts.**
