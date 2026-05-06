# META-PROMPT B-19 -- SPRINT 19 VERTICAL REPAIR FOUNDATION

**Version** : v2.2 (Option B -- PREMIER sprint Phase 5)
**Phase** : 5 -- Vertical Repair (Skalean Garage ERP)
**Sprint** : 19 / 35 (cumul) -- Phase 5 Sprint 1
**Position** : Apres Phase 4 Vertical Insure complete, debut Phase 5 vertical garage
**Numerotation taches** : 5.1.1 a 5.1.13
**Effort total** : ~75 heures developpement / 2 semaines
**Priorite** : P0 (premier sprint vertical Repair, valide pattern reutilise pour Phase 5)

---

## Objectif Global du Sprint

Implementer **fondations Vertical Repair** : 6 entites lifecycle reparation (garages, sinistres, diagnostics, devis, ordres reparation, factures, garanties) + workflow status complet (reception -> diagnostic -> devis -> approbation -> reparation -> livraison) + integrations cross-modules (Stock + HR + Pay + Books + Insure).

Skalean Atlas = premier garage tenant operationnel : garage interne Skalean qui valide tous les flows avant onboarding garages partenaires en Phase 7+.

A la sortie de ce sprint :
- 6 entities Repair operationnelles
- Workflow complet sinistre status transitions
- Skalean Atlas seed (premier garage tenant)
- Diagnostic + devis + approbation + reparation + livraison flows
- Integration Stock Sprint 13 : consommation pieces auto
- Integration HR Sprint 13 : assignment technicien + tracking heures
- Integration Pay Sprint 11 : paiement final (assureur ou client)
- Integration Books Sprint 12 : ecritures comptables
- Lien Insure Sprint 14+ : sinistre rattache a police
- Garanties post-reparation : tracking + reclamations
- Tests E2E exhaustifs

---

## Frontiere du Sprint

**INCLUS** :
- 6 entities Repair (garages, sinistres, diagnostics, devis, orders, invoices, warranties)
- Workflow status sinistre complet
- Skalean Atlas seed garage tenant
- Diagnostic engine basique (pas IA Sprint 30+)
- Devis generation + approbation
- Ordres reparation + tracking
- Integration Stock + HR + Pay + Books + Insure
- Garanties post-reparation
- Endpoints REST `/api/v1/repair/*`
- Tests E2E

**EXCLU** (sera ajoute aux sprints suivants) :
- IA Estimation Photos -- Sprint 20 (mock pendant dev)
- Workflow Sinistre Client (M8 declaration cote assure) -- Sprint 21
- Web Garage App UI -- Sprint 22
- Web Garage Mobile (PWA technicien) -- Sprint 23
- Flux Sinistre Client end-to-end -- Sprint 24
- Cross-Tenant Framework (3 types runtime) -- Sprint 25
- Reparations cross-branche (sante, habitation) -- Phase 7+
- IA-powered diagnostic + estimation -- Sprint 30+ defere

---

## Lectures Prealables Obligatoires

1. `00-pilotage/documentation/3-schemas-database-PARTIE2.sql` -- tables repair_* legacy + `00-pilotage/documentation/3-schemas-database-v2.2-additions.sql` -- tables repair_garages / repair_diagnostics / repair_orders / repair_invoices / repair_warranties (alignees naming v2.2)
2. Sortie Sprint 13 : Stock + HR (consume pendant reparation)
3. Sortie Sprint 14+ : Insure (sinistre lie a police)
4. Sortie Sprint 11 : Pay (paiement client/assureur)
5. Sortie Sprint 12 : Books (ecritures comptables)

## Dependencies Sprint precedents (explicites)

Ce Sprint 19 **depend critiquement** de :
- **Sprint 6** (Multi-Tenant 3 Niveaux + RLS) : tables `repair_*` activent RLS multi-tenant 3 niveaux -- toutes queries respectent `app_current_tenant()` ; tenants Repair Type 1 (Atlas) / Type 2 (managed_partner) / Type 3 (api_partner) cf Sprint 25
- **Sprint 7** (RBAC Granulaire) : permissions `repair.diagnostics.*`, `repair.orders.*`, `repair.invoices.*` definies dans 5-roles-permissions.md (12 roles x 85+ permissions)
- **Sprint 11** (Pay) : encaissement client + assureur via 6 passerelles MA + split facturation
- **Sprint 12** (Books) : auto-ecritures comptables (compte 706 prestations + TVA 20% MA)
- **Sprint 13** (Analytics + Stock + HR) : Stock parts consume pendant reparations + HR techniciens assignment
- **Sprint 14** (Insure) : reparations liees a police (Sprint 19+ relier via foreign key insure_policies)

---

## Stack Imposee (Sprint 19)

| Composant | Version | Notes |
|-----------|---------|-------|
| decimal.js | 10.4.3 | precision computations devis |
| date-fns | 4.1.0 | duration reparation |
| zod | 3.24.1 | validation schemas |

Pas de nouvelle dep externe.

---

## Vue d'Ensemble des 13 Taches

| # | Tache | Effort | Priorite | Depend de |
|---|-------|--------|----------|-----------|
| 5.1.1 | repair_garages entity + Skalean Atlas seed + capacities/specialties | 5h | P0 | Phase 4 |
| 5.1.2 | repair_sinistres entity + workflow status (10 etats) + transitions | 7h | P0 | 5.1.1 |
| 5.1.3 | repair_diagnostics entity + service (estimation initiale) | 5h | P0 | 5.1.2 |
| 5.1.4 | repair_devis entity + service + generation PDF + workflow approbation | 7h | P0 | 5.1.3 |
| 5.1.5 | repair_orders entity + service (commandes reparation post-approbation) | 6h | P0 | 5.1.4 |
| 5.1.6 | Integration Stock : consommation pieces auto (Kafka consumer) | 5h | P0 | 5.1.5 |
| 5.1.7 | Integration HR : assignment technicien + tracking heures | 5h | P0 | 5.1.6 |
| 5.1.8 | repair_invoices entity + facturation finale (assureur OR client) | 6h | P0 | 5.1.7 |
| 5.1.9 | Integration Pay : paiement final + integration Books ecritures | 5h | P0 | 5.1.8 |
| 5.1.10 | repair_warranties entity + tracking + reclamations garantie | 5h | P0 | 5.1.9 |
| 5.1.11 | Endpoints REST `/api/v1/repair/*` + permissions Repair | 5h | P0 | 5.1.10 |
| 5.1.12 | Dashboards Repair (extends Sprint 13 analytics) | 4h | P1 | 5.1.11 |
| 5.1.13 | Tests E2E (40+) + fixtures realistes + seeds Skalean Atlas | 10h | P0 | 5.1.12 |

**Total** : 75 heures.

---

# DETAIL DES 13 TACHES

---

## Tache 5.1.1 -- repair_garages Entity + Skalean Atlas Seed

**Metadonnees** : Phase 5 / Sprint 19 / P0 / 5h / Depend de Phase 4

**But** : Entity garages avec catalog services + capacities + specialties + Skalean Atlas comme premier seed.

**Contexte** : Skalean Atlas = filiale Skalean Group, garage interne premier tenant Vertical Repair. Permet validation flows complets avant onboarding garages partenaires Phase 7. Tous garages futurs (cross-tenant Sprint 25) heriteront de ce pattern.

**Livrables checkables** :
- [ ] Migration : table `repair_garages` :
  - id, tenant_id (NOT NULL), name, type (enum 'skalean_atlas' | 'partner' | 'independent'), address, city, postal_code, gps_lat, gps_lng, phone, email, opening_hours (jsonb : weekly schedule), specialties (jsonb : array branches couvertes -- auto seul Sprint 19), capacity_simultaneous_repairs (int), avg_rating (numeric), staff_count (int), photo_url, status (enum 'active' | 'pending_approval' | 'suspended'), created_at
- [ ] Migration : table `repair_garage_services` :
  - id, garage_id (FK), service_type (enum 'oil_change' | 'brakes' | 'tires' | 'engine' | 'body_work' | 'paint' | 'electrical' | 'other'), avg_duration_hours, hourly_rate (numeric)
- [ ] Service `garages.service.ts` (CRUD) + permissions
- [ ] Seed Skalean Atlas : 1 entity + 8 services types + opening_hours Lun-Sam 8h-19h + Casablanca Mers Sultan
- [ ] Seed initial Sprint 22 ajoutera plus de garages partenaires
- [ ] Endpoints :
  - `GET /api/v1/repair/garages` (filters : city, specialty, services, distance from coords)
  - `POST /api/v1/repair/garages` (super admin)
  - `GET /api/v1/repair/garages/:id`
  - `PATCH /api/v1/repair/garages/:id`
- [ ] Endpoint critical pour Sprint 18 : `GET /api/v1/repair/garages/available?branche=auto&lat=...&lng=...&max_distance_km=20`
- [ ] Multi-tenant : chaque garage = 1 tenant Repair (= 1 instance Skalean Garage ERP)
- [ ] Tests : CRUD + filters + Atlas seed

**Pattern critique : Skalean Atlas seed**

```typescript
// repo/infrastructure/scripts/seed-skalean-atlas.ts
const SKALEAN_ATLAS_SEED = {
  name: 'Skalean Atlas',
  type: 'skalean_atlas',
  address: 'Boulevard Mohammed V, Mers Sultan',
  city: 'Casablanca',
  postal_code: '20000',
  gps_lat: 33.5731,
  gps_lng: -7.5898,
  phone: '+212522123456',
  email: 'atlas@skalean-insurtech.ma',
  opening_hours: {
    monday: { open: '08:00', close: '19:00' },
    tuesday: { open: '08:00', close: '19:00' },
    wednesday: { open: '08:00', close: '19:00' },
    thursday: { open: '08:00', close: '19:00' },
    friday: { open: '08:00', close: '19:00' },
    saturday: { open: '08:00', close: '14:00' },
    sunday: null, // ferme
  },
  specialties: ['auto'],         // Sprint 19 MVP
  capacity_simultaneous_repairs: 12,
  staff_count: 8,
  status: 'active',
};

const ATLAS_SERVICES = [
  { service_type: 'oil_change', avg_duration_hours: 0.5, hourly_rate: 250 },
  { service_type: 'brakes', avg_duration_hours: 2, hourly_rate: 350 },
  { service_type: 'tires', avg_duration_hours: 0.75, hourly_rate: 250 },
  { service_type: 'engine', avg_duration_hours: 4, hourly_rate: 450 },
  { service_type: 'body_work', avg_duration_hours: 8, hourly_rate: 400 },
  { service_type: 'paint', avg_duration_hours: 16, hourly_rate: 350 },
  { service_type: 'electrical', avg_duration_hours: 3, hourly_rate: 400 },
  { service_type: 'other', avg_duration_hours: 1, hourly_rate: 350 },
];
```

**Fichiers crees / modifies** :
```
repo/packages/database/src/migrations/{date}-RepairGarages.ts                  # ~80 lignes
repo/packages/repair/src/entities/repair-garage.entity.ts                       # ~50 lignes
repo/packages/repair/src/entities/repair-garage-service.entity.ts                # ~40 lignes
repo/packages/repair/src/services/garages.service.ts                             # ~250 lignes
repo/apps/api/src/modules/repair/controllers/garages.controller.ts               # ~150 lignes
repo/infrastructure/scripts/seed-skalean-atlas.ts                                  # ~150 lignes
```

**Notes implementation** :
- Skalean Atlas = tenant Repair operationnel des Sprint 19 (avant developpement web-garage Sprint 22-23)
- Other tenants (partenaires) cross-tenant Sprint 25 : runtime activation 3 types
- GPS coords critique : geolocation queries (Sprint 18 deja consume)
- Sprint 22 web-garage UI consumera ces endpoints

**Criteres validation** :
- V1 (P0) : Migration creee
- V2 (P0) : Skalean Atlas seed reussit
- V3 (P0) : 8 services seed
- V4 (P0) : Endpoint `/available` filtre coords
- V5 (P0) : Multi-tenant
- V6 (P0) : Tests 6+ scenarios

---

## Tache 5.1.2 -- repair_sinistres Entity + Workflow Status

**Metadonnees** : Phase 5 / Sprint 19 / P0 / 7h / Depend de 5.1.1

**But** : Entity sinistres + workflow status complet (10 etats) + transitions strictes + audit trail.

**Livrables checkables** :
- [ ] Migration : table `repair_sinistres` :
  - id, tenant_id (FK garage), sinistre_number (UNIQUE format `SIN-AUTO-2026-0001`), insure_policy_id (FK insure_policies, nullable si client direct sans police), customer_id (FK contacts), vehicle_data (jsonb : marque/modele/immatriculation/VIN/annee), incident_data (jsonb : date/lieu/circonstances/photos), status (enum 10 etats), assigned_technician_id (FK hr_employees), declared_at, scheduled_at, completed_at, closed_at, created_by
- [ ] 10 etats workflow :
  1. `declared` -- assure declare (Sprint 18 mobile)
  2. `acknowledged` -- garage accepte
  3. `appointment_scheduled` -- RDV booking
  4. `received` -- vehicule arrive garage
  5. `under_diagnostic` -- diagnostic en cours
  6. `awaiting_estimate` -- diagnostic fait, devis en preparation
  7. `awaiting_approval` -- devis envoye, attente approbation client/assureur
  8. `under_repair` -- approbation OK, reparation en cours
  9. `completed` -- reparation finie, vehicule pret
  10. `delivered` -- vehicule rendu client
  - Etats final : `closed` (apres garantie OK) ou `cancelled` (sinistre annule)
- [ ] Service `sinistres.service.ts` :
  - `create(data)` -- INSERT status='declared'
  - `transitionStatus(sinistreId, newStatus, metadata)` -- valide transition + audit
  - `assignTechnician(sinistreId, technicianId)`
  - `findAll(filters, pagination)`
- [ ] Validation transitions strictes (state machine)
- [ ] Audit trail : table `repair_sinistre_status_history` (id, sinistre_id, from_status, to_status, changed_by, changed_at, comment)
- [ ] Endpoints :
  - `POST /api/v1/repair/sinistres` (create)
  - `GET /api/v1/repair/sinistres` (filters)
  - `POST /api/v1/repair/sinistres/:id/transition` (status change avec metadata)
  - `POST /api/v1/repair/sinistres/:id/assign` (technicien)
- [ ] Permissions : `repair.sinistres.create/read/transition/assign`
- [ ] Audit + Kafka events `repair.sinistre_*` per transition
- [ ] Tests : workflow + transitions valides + invalid rejected

**Pattern critique : workflow status state machine**

```typescript
// repo/packages/repair/src/services/sinistre-state-machine.ts
const SINISTRE_TRANSITIONS: Record<SinistreStatus, SinistreStatus[]> = {
  declared: ['acknowledged', 'cancelled'],
  acknowledged: ['appointment_scheduled', 'cancelled'],
  appointment_scheduled: ['received', 'cancelled'],
  received: ['under_diagnostic', 'cancelled'],
  under_diagnostic: ['awaiting_estimate', 'cancelled'],
  awaiting_estimate: ['awaiting_approval', 'cancelled'],
  awaiting_approval: ['under_repair', 'cancelled'],   // approved
  under_repair: ['completed', 'awaiting_approval'],     // si pieces additionnelles
  completed: ['delivered'],
  delivered: ['closed'],                                // apres periode garantie
  closed: [],                                           // terminal
  cancelled: [],                                        // terminal
};

export class SinistreStateMachine {
  validateTransition(currentStatus: SinistreStatus, newStatus: SinistreStatus): void {
    const allowedTransitions = SINISTRE_TRANSITIONS[currentStatus];
    if (!allowedTransitions.includes(newStatus)) {
      throw new BadRequestException({
        code: 'INVALID_STATUS_TRANSITION',
        from: currentStatus,
        to: newStatus,
        allowed: allowedTransitions,
      });
    }
  }

  async transition(
    sinistreId: string,
    newStatus: SinistreStatus,
    metadata: { comment?: string; pieces_added?: any[] },
  ): Promise<RepairSinistre> {
    return this.dataSource.transaction(async (em) => {
      const sinistre = await em.findOneOrFail(RepairSinistre, sinistreId);
      this.validateTransition(sinistre.status, newStatus);

      // Update status
      await em.update(RepairSinistre, sinistreId, {
        status: newStatus,
        ...(newStatus === 'received' && { received_at: new Date() }),
        ...(newStatus === 'completed' && { completed_at: new Date() }),
        ...(newStatus === 'delivered' && { delivered_at: new Date() }),
        ...(newStatus === 'closed' && { closed_at: new Date() }),
      });

      // Audit trail
      await em.save(RepairSinistreStatusHistory, {
        sinistre_id: sinistreId,
        from_status: sinistre.status,
        to_status: newStatus,
        changed_by: getCurrentUserId(),
        changed_at: new Date(),
        comment: metadata.comment,
        metadata_json: metadata,
      });

      // Kafka event
      await this.kafkaPublisher.publish(`repair.sinistre.${newStatus}`, {
        sinistre_id: sinistreId, from_status: sinistre.status, to_status: newStatus,
      });

      return em.findOneOrFail(RepairSinistre, sinistreId);
    });
  }
}
```

**Fichiers crees / modifies** :
```
repo/packages/database/src/migrations/{date}-RepairSinistres.ts                  # ~70 lignes
repo/packages/repair/src/entities/repair-sinistre.entity.ts                       # ~70 lignes
repo/packages/repair/src/entities/repair-sinistre-status-history.entity.ts        # ~40 lignes
repo/packages/repair/src/services/sinistres.service.ts                             # ~250 lignes
repo/packages/repair/src/services/sinistre-state-machine.ts                         # ~120 lignes
repo/apps/api/src/modules/repair/controllers/sinistres.controller.ts                # ~180 lignes
```

**Notes implementation** :
- 10 etats : voucher complet du flow garage MA standard
- State machine class : centralise transitions logic
- Audit history : table separee pour preservation totale (regulator inspection)
- Numerotation sinistre_number similaire policy_number Sprint 14

**Criteres validation** :
- V1 (P0) : Migration tables + indexes
- V2 (P0) : 10 status enum
- V3 (P0) : State machine valide transitions
- V4 (P0) : Invalid transitions rejected
- V5 (P0) : History audit trail complet
- V6 (P0) : Kafka events per transition
- V7 (P0) : Tests 12+ scenarios

---

## Tache 5.1.3 -- repair_diagnostics Entity + Service

**Metadonnees** : Phase 5 / Sprint 19 / P0 / 5h / Depend de 5.1.2

**But** : Diagnostic initial du sinistre par technicien : list problems detectes + estimation pieces necessaires + heures estimees + photos.

**Livrables checkables** :
- [ ] Migration : table `repair_diagnostics` :
  - id, sinistre_id (FK), diagnosed_by (FK hr_employees), problems (jsonb : array { description, severity, parts_needed, estimated_hours }), photos (jsonb : URLs), recommendations, total_estimated_hours, total_estimated_parts_cost (numeric), status (enum 'in_progress' | 'completed'), created_at, completed_at
- [ ] Service `diagnostics.service.ts` :
  - `start(sinistreId, technicianId)` -- transition sinistre status='under_diagnostic' + create diagnostic
  - `addProblem(diagnosticId, problemData)` -- ajout problem detected
  - `complete(diagnosticId)` -- transition sinistre 'awaiting_estimate' + compute totals
  - `findBySinistre(sinistreId)`
- [ ] Endpoints :
  - `POST /api/v1/repair/sinistres/:id/diagnostic/start`
  - `POST /api/v1/repair/diagnostics/:id/problems`
  - `POST /api/v1/repair/diagnostics/:id/complete`
- [ ] Permissions : `repair.diagnostics.start/create/complete`
- [ ] Sprint 20 IA Estimation Photos enrichira (mock pendant Sprint 19 dev)
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/packages/database/src/migrations/{date}-RepairDiagnostics.ts               # ~50 lignes
repo/packages/repair/src/entities/repair-diagnostic.entity.ts                    # ~50 lignes
repo/packages/repair/src/services/diagnostics.service.ts                          # ~200 lignes
repo/apps/api/src/modules/repair/controllers/diagnostics.controller.ts             # ~120 lignes
```

**Criteres validation** :
- V1 (P0) : Diagnostic create + transition status
- V2 (P0) : Problems addition + computation totals
- V3 (P0) : Complete transition status
- V4 (P0) : Tests 8+ scenarios

---

## Tache 5.1.4 -- repair_devis Entity + PDF + Approbation

**Metadonnees** : Phase 5 / Sprint 19 / P0 / 7h / Depend de 5.1.3

**But** : Generation devis post-diagnostic + PDF + envoi assureur/client + workflow approbation.

**Livrables checkables** :
- [ ] Migration : table `repair_devis` :
  - id, sinistre_id (FK), diagnostic_id (FK), devis_number (UNIQUE format `DEV-2026-00001`), items (jsonb : array { description, quantity, unit_price_ht, total_ht, type 'parts' | 'labor' | 'misc' }), subtotal_ht, total_tva, total_ttc, validity_until, status (enum 'draft' | 'sent' | 'approved' | 'rejected' | 'expired'), pdf_doc_id (FK), sent_to (jsonb : array { type 'insurer' | 'customer', email, sent_at }), approved_at, approved_by_type (enum 'insurer' | 'customer'), rejected_at, rejected_reason, created_by
- [ ] Service `devis.service.ts` :
  - `createFromDiagnostic(diagnosticId)` -- compute items + INSERT draft
  - `addItem(devisId, item)` -- ajout ligne manuelle
  - `updateItem(devisId, itemId, data)`
  - `removeItem(devisId, itemId)`
  - `send(devisId, recipients)` -- generate PDF + email + status sent
  - `approve(devisId, approverType)` -- transition + trigger sinistre status='under_repair'
  - `reject(devisId, reason)`
- [ ] PDF devis : utilise PdfGenerator Sprint 10 + template `devis-reparation.hbs`
- [ ] Validity 14 jours par defaut
- [ ] Cron expire after validity
- [ ] Si police lien : envoie a assureur (Sprint 32 connecteurs Phase 7) + customer
- [ ] Si pas police : envoie customer seul
- [ ] Endpoints CRUD + send + approve + reject
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/packages/database/src/migrations/{date}-RepairDevis.ts                       # ~50 lignes
repo/packages/repair/src/entities/repair-devis.entity.ts                            # ~60 lignes
repo/packages/repair/src/services/devis.service.ts                                  # ~280 lignes
repo/packages/repair/src/services/devis-numbering.service.ts                         # ~80 lignes
repo/packages/docs/src/templates/{fr,ar-MA,ar}/devis-reparation.hbs                  # 3 templates
repo/apps/api/src/modules/repair/controllers/devis.controller.ts                    # ~150 lignes
```

**Criteres validation** :
- V1 (P0) : Devis creation depuis diagnostic
- V2 (P0) : Items computation precision
- V3 (P0) : PDF generation
- V4 (P0) : Send email assureur + customer
- V5 (P0) : Approve trigger transition sinistre
- V6 (P0) : Cron expire 14j
- V7 (P0) : Tests 10+ scenarios

---

## Tache 5.1.5 -- repair_orders Entity + Service

**Metadonnees** : Phase 5 / Sprint 19 / P0 / 6h / Depend de 5.1.4

**But** : Ordres reparation (work orders) post-devis approbation : assignment technicien + tracking heures + checklist taches.

**Livrables checkables** :
- [ ] Migration : table `repair_orders` :
  - id, sinistre_id (FK), devis_id (FK), order_number (UNIQUE), assigned_technician_id (FK hr_employees), tasks (jsonb : checklist tasks), parts_consumption (jsonb : list parts utilises), labor_hours_logged (numeric), labor_cost_actual, parts_cost_actual, status (enum 'pending' | 'in_progress' | 'completed' | 'cancelled'), started_at, completed_at, notes
- [ ] Service `orders.service.ts` :
  - `createFromApprovedDevis(devisId)` -- INSERT pending + parse devis items en tasks
  - `start(orderId, technicianId)` -- transition + sinistre status='under_repair'
  - `logHours(orderId, hours, taskDescription)` -- tracking heures
  - `consumePart(orderId, stockItemId, quantity)` -- consume Stock Sprint 13 + record movement
  - `markTaskCompleted(orderId, taskId)`
  - `complete(orderId)` -- transition sinistre status='completed'
- [ ] Tracking : heures_logged + cumul vs estimate
- [ ] Endpoints :
  - `POST /api/v1/repair/orders/from-devis/:devisId`
  - `POST /api/v1/repair/orders/:id/start`
  - `POST /api/v1/repair/orders/:id/log-hours`
  - `POST /api/v1/repair/orders/:id/consume-part`
  - `POST /api/v1/repair/orders/:id/complete`
- [ ] Permissions : `repair.orders.*`
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/packages/database/src/migrations/{date}-RepairOrders.ts                       # ~50 lignes
repo/packages/repair/src/entities/repair-order.entity.ts                             # ~60 lignes
repo/packages/repair/src/services/orders.service.ts                                  # ~250 lignes
repo/apps/api/src/modules/repair/controllers/orders.controller.ts                    # ~150 lignes
```

**Criteres validation** :
- V1 (P0) : Order creation depuis devis approved
- V2 (P0) : Hours tracking
- V3 (P0) : Parts consumption integration Stock
- V4 (P0) : Transitions sinistre status
- V5 (P0) : Tests 10+ scenarios

---

## Tache 5.1.6 -- Integration Stock : Consommation Pieces Auto

**Metadonnees** : Phase 5 / Sprint 19 / P0 / 5h / Depend de 5.1.5

**But** : Auto-consume pieces stock via Kafka event quand `repair_orders.consumePart()` -> Sprint 13 Stock movement type='exit' + idempotency.

**Livrables checkables** :
- [ ] Consumer Kafka `repair.parts_consumed` -> Sprint 13 stock movement (deja prepare dans Sprint 13 Tache 3.6.8)
- [ ] Verification : Sprint 13 deja livre integration -- Sprint 19 emit Kafka event correct
- [ ] Tests integration end-to-end : sinistre -> diagnostic -> devis approved -> order start -> consume part -> Stock decrement + valorisation FIFO + journal entry comptable
- [ ] Edge cases : insufficient stock -> order ne peut pas continuer (validation business)

**Fichiers crees / modifies** :
```
repo/packages/repair/src/services/orders.service.ts                                  # update : emit Kafka event
repo/apps/api/test/repair/integration/stock-integration.e2e-spec.ts                  # tests
```

**Criteres validation** :
- V1 (P0) : Kafka event emis correctement
- V2 (P0) : Stock decrement automatique
- V3 (P0) : FIFO valorisation correcte
- V4 (P0) : Insufficient stock blocage
- V5 (P0) : Tests integration 5+ scenarios

---

## Tache 5.1.7 -- Integration HR : Assignment Technicien + Heures

**Metadonnees** : Phase 5 / Sprint 19 / P0 / 5h / Depend de 5.1.6

**But** : Integration HR Sprint 13 : assignment sinistre/order a technicien employe + tracking heures workforce.

**Livrables checkables** :
- [ ] Validation assignment : technicien existe + role='technicien' + actif
- [ ] Tracking heures : update `hr_employees.hours_worked_this_month` ou table separee `hr_time_logs`
- [ ] Migration : table `hr_time_logs` :
  - id, employee_id (FK), task_type (enum 'repair_order' | 'leave' | 'training' | 'admin'), task_id (UUID si repair_order = order_id), hours_logged (numeric), date, description
- [ ] Service `hr-time-logs.service.ts` (cross-module : repair calls)
- [ ] Endpoint `GET /api/v1/hr/employees/:id/time-logs?month=YYYY-MM` (consume Sprint 22 web-garage UI)
- [ ] Integration paie Sprint 13 : heures workforce -> bulletin paie
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/packages/database/src/migrations/{date}-HrTimeLogs.ts                          # ~40 lignes
repo/packages/hr/src/entities/hr-time-log.entity.ts                                  # ~40 lignes
repo/packages/hr/src/services/hr-time-logs.service.ts                                 # ~150 lignes
repo/packages/repair/src/services/orders.service.ts                                   # update : log hours
repo/apps/api/src/modules/hr/controllers/time-logs.controller.ts                       # ~80 lignes
```

**Criteres validation** :
- V1 (P0) : Assignment validation
- V2 (P0) : Hours logged automatique
- V3 (P0) : Integration paie
- V4 (P0) : Tests 8+ scenarios

---

## Tache 5.1.8 -- repair_invoices Facturation Finale

**Metadonnees** : Phase 5 / Sprint 19 / P0 / 6h / Depend de 5.1.7

**But** : Facturation finale post-reparation : assureur (si police impactee) OR client (si pas police OR retract franchise).

**Livrables checkables** :
- [ ] Migration : table `repair_invoices` :
  - id, sinistre_id (FK), order_id (FK), invoice_number (UNIQUE format DGI-conform), recipient_type (enum 'insurer' | 'customer'), recipient_data (jsonb : ICE + nom + adresse), items (jsonb), subtotal_ht, total_tva, total_ttc, paid_amount, status (enum 'draft' | 'sent' | 'paid' | 'partial_paid' | 'overdue'), due_date, pdf_doc_id (FK), journal_entry_id (FK)
- [ ] Service `invoices.service.ts` :
  - `createFromCompletedOrder(orderId)` -- compute items + recipient (police ? insurer : customer)
  - `send(invoiceId)` -- generate PDF + email
  - `markPaid(invoiceId, payTransactionId)` -- consumer Pay event
- [ ] Numerotation sequentiel UNIQUE per tenant + DGI conform (Sprint 12 pattern)
- [ ] Champs DGI : ICE garage + ICE acheteur + RC + patente + TVA breakdown
- [ ] Recipient logic :
  - Si sinistre.insure_policy_id existe : facture envoye assureur (avec franchise customer)
  - Sinon : facture entiere customer
- [ ] Endpoints CRUD + send + payment
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/packages/database/src/migrations/{date}-RepairInvoices.ts                      # ~50 lignes
repo/packages/repair/src/entities/repair-invoice.entity.ts                            # ~60 lignes
repo/packages/repair/src/services/invoices.service.ts                                  # ~250 lignes
repo/packages/docs/src/templates/{fr,ar-MA,ar}/repair-invoice.hbs                       # 3 templates
repo/apps/api/src/modules/repair/controllers/invoices.controller.ts                     # ~150 lignes
```

**Criteres validation** :
- V1 (P0) : Invoice creation depuis order completed
- V2 (P0) : Recipient logic (insurer vs customer)
- V3 (P0) : DGI conform fields
- V4 (P0) : PDF generation
- V5 (P0) : Tests 10+ scenarios

---

## Tache 5.1.9 -- Integration Pay + Books Ecritures

**Metadonnees** : Phase 5 / Sprint 19 / P0 / 5h / Depend de 5.1.8

**But** : Integration Pay Sprint 11 (paiement final) + Books Sprint 12 (ecritures comptables).

**Livrables checkables** :
- [ ] Trigger Pay (Sprint 11) : assureur ou customer paie facture
- [ ] Consumer Kafka `pay.transaction_captured` Sprint 11 :
  - Si related_resource_type='repair_invoice' : update invoice status='paid' + create journal entry
- [ ] Sprint 12 Books deja consumer general -> ecriture auto :
  - Debit : 411 Clients (customer) ou 4421-4425 (assureurs partenaires)
  - Credit : 706 Prestations services (reparations garage) + 4456 TVA collectee
- [ ] Sinistre status='delivered' + transition 'closed' apres paiement complet
- [ ] Tests integration

**Fichiers crees / modifies** :
```
repo/packages/repair/src/consumers/pay-to-invoice.consumer.ts                          # ~150 lignes
repo/apps/api/test/repair/integration/pay-books-integration.e2e-spec.ts                # tests
```

**Criteres validation** :
- V1 (P0) : Pay event -> invoice paid
- V2 (P0) : Journal entry creee
- V3 (P0) : Sinistre transition 'closed'
- V4 (P0) : Tests integration 6+ scenarios

---

## Tache 5.1.10 -- repair_warranties Tracking + Reclamations

**Metadonnees** : Phase 5 / Sprint 19 / P0 / 5h / Depend de 5.1.9

**But** : Garanties post-reparation : duration variable selon types pieces + reclamations dans periode garantie.

**Livrables checkables** :
- [ ] Migration : table `repair_warranties` :
  - id, sinistre_id (FK), order_id (FK), warranty_type (enum 'parts_only' | 'parts_and_labor' | 'extended'), duration_months (default 6 parts only, 12 parts+labor), starts_at (= delivered_at), expires_at (computed), status (enum 'active' | 'expired' | 'claimed_used'), customer_signature_doc_id, terms_and_conditions
- [ ] Migration : table `repair_warranty_claims` :
  - id, warranty_id (FK), claim_description, claim_photos (jsonb), status (enum 'pending' | 'accepted' | 'rejected'), resolution_type (enum 're_repair_free' | 'partial_refund' | 'rejected'), resolved_at, resolution_notes
- [ ] Service `warranties.service.ts` :
  - `createForSinistre(sinistreId, warrantyType)` -- INSERT post-delivery
  - `submitClaim(warrantyId, description, photos)`
  - `processClaim(claimId, resolution)`
- [ ] Cron daily : expire warranties + reminders 30j avant expiration
- [ ] Endpoints CRUD + claims
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/packages/database/src/migrations/{date}-RepairWarranties.ts                       # ~50 lignes
repo/packages/repair/src/entities/{2 entities}.ts                                       # ~70 lignes
repo/packages/repair/src/services/warranties.service.ts                                  # ~200 lignes
repo/apps/api/src/modules/repair/controllers/warranties.controller.ts                     # ~120 lignes
```

**Criteres validation** :
- V1 (P0) : Warranty creation post-delivery
- V2 (P0) : Claim submission
- V3 (P0) : Resolution workflow
- V4 (P0) : Cron expiry + reminders
- V5 (P0) : Tests 8+ scenarios

---

## Tache 5.1.11 -- Endpoints REST + Permissions Repair

**Metadonnees** : Phase 5 / Sprint 19 / P0 / 5h / Depend de 5.1.10

**But** : Consolidation endpoints `/api/v1/repair/*` + permissions Repair dans matrice RBAC Sprint 7.

**Livrables checkables** :
- [ ] Endpoints livres dans taches precedentes (consolidation)
- [ ] Permissions ajoutees catalog Sprint 7 :
  - `repair.garages.*`
  - `repair.sinistres.create/read/transition/assign`
  - `repair.diagnostics.start/create/complete`
  - `repair.devis.create/send/approve/reject`
  - `repair.orders.start/log_hours/consume_part/complete`
  - `repair.invoices.create/send`
  - `repair.warranties.read/claim`
- [ ] Update PermissionsMatrix : 4 roles garage (garage_admin / garage_chef / garage_technicien / garage_gestionnaire)
- [ ] Tests permissions

**Fichiers crees / modifies** :
```
repo/packages/auth/src/rbac/permissions.enum.ts                                       # update : ajout permissions Repair
repo/packages/auth/src/rbac/permissions-matrix.ts                                       # update : roles garage_*
repo/apps/api/test/repair/sprint-19-permissions.e2e-spec.ts                            # tests
```

**Criteres validation** :
- V1 (P0) : 20+ permissions Repair
- V2 (P0) : 4 roles garage configures
- V3 (P0) : Tests RBAC 8+ scenarios

---

## Tache 5.1.12 -- Dashboards Repair

**Metadonnees** : Phase 5 / Sprint 19 / P1 / 4h / Depend de 5.1.11

**But** : Etendre Sprint 13 analytics avec metriques Repair-specific.

**Livrables checkables** :
- [ ] ETL Sprint 13 etendu : add tables fct_sinistres, fct_orders, fct_invoices_repair
- [ ] Dashboards :
  - `GET /api/v1/analytics/dashboards/repair-performance` (avg duration sinistre per status, throughput per technicien)
  - `GET /api/v1/analytics/dashboards/repair-revenue` (revenue garage YTD per service type)
  - `GET /api/v1/analytics/dashboards/repair-warranties` (claims rate per type warranty)
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/packages/analytics/src/etl/postgres-to-clickhouse.etl.ts                          # update : sync fct_repair_*
repo/infrastructure/clickhouse/schemas/fct_{sinistres,orders,invoices_repair}.sql      # 3 tables
repo/apps/api/src/modules/analytics/services/repair-dashboards.service.ts                # ~200 lignes
```

**Criteres validation** :
- V1 (P1) : 3 dashboards Repair
- V2 (P1) : ETL etendu
- V3 (P1) : Tests 5+ scenarios

---

## Tache 5.1.13 -- Tests E2E + Fixtures + Seeds

**Metadonnees** : Phase 5 / Sprint 19 / P0 / 10h / Depend de 5.1.12

**But** : Suite tests E2E exhaustive + fixtures realistes + seed Skalean Atlas complete.

**Livrables checkables** :

**Tests E2E (40+)** :
- [ ] Garages : CRUD + Skalean Atlas seed + filters geolocation (5)
- [ ] Sinistres : workflow 10 transitions + invalid rejected + audit (10)
- [ ] Diagnostics : start + add problems + complete (3)
- [ ] Devis : create + items + send + approve + reject + expire (6)
- [ ] Orders : start + log hours + consume parts + complete (5)
- [ ] Stock integration : consume + FIFO + insufficient (3)
- [ ] HR integration : assignment + time logs (3)
- [ ] Invoices : create + send + payment integration (3)
- [ ] Warranties : create + claim + resolution (3)

**Fixtures realistes** :
- 1 garage Skalean Atlas + 8 services
- 5 employees (1 admin, 1 chef, 3 techniciens, 1 gestionnaire) -- HR Sprint 13
- 100 stock items pieces auto -- Stock Sprint 13
- 30 sinistres mix scenarios (status varies) + diagnostics + devis + orders + warranties

**Fichiers crees / modifies** :
```
repo/apps/api/test/repair/{40+ specs}.e2e-spec.ts
repo/infrastructure/scripts/seed-repair-fixtures.ts                                      # ~400 lignes
```

**Criteres validation** :
- V1 (P0) : 40+ tests passent
- V2 (P0) : CI green
- V3 (P0) : Skalean Atlas operationnel
- V4 (P0) : Reproducibility 5x

---

## Sortie du Sprint 19

A la fin de l'execution des 13 taches :

```
Vertical Repair Foundation operational :
  - 6 entities : garages, sinistres, diagnostics, devis, orders, invoices, warranties
  - Skalean Atlas seed (premier garage tenant)
  - Workflow sinistre 10 etats + state machine + audit history
  - Diagnostic + devis + ordres reparation + invoices + garanties
  - Integration Stock Sprint 13 : consommation pieces FIFO
  - Integration HR Sprint 13 : assignment + time logs + paie
  - Integration Pay Sprint 11 : paiement final
  - Integration Books Sprint 12 : ecritures comptables
  - Integration Insure Sprint 14 : sinistre rattache a police
  - 4 roles garage RBAC (admin/chef/technicien/gestionnaire)
  - 3 dashboards Repair-specific

40+ tests E2E exhaustifs
```

**Sprint 20 (IA Estimation Photos -- mock pendant dev) demarre avec** :
- Foundation Repair operationnelle
- Skalean Atlas operational tenant
- Sprint 20 ajoute IA mock pour automation diagnostic via photos
- Sprint 30+ defere remplacera mock par integration Skalean AI reel

---

## Specifications Format Tache (pour Generation par Cowork)

Cowork genere `task-5.1.X-*.md` dans `00-pilotage/prompts-taches/sprint-19-vertical-repair-foundation/`.

**Patterns code inline conserves** : Skalean Atlas seed structure, workflow status state machine 10 etats avec transitions strictes.

**Reference** : `00-pilotage/documentation/3-schemas-database-PARTIE2.sql` (tables repair_* legacy) + `00-pilotage/documentation/3-schemas-database-v2.2-additions.sql` (tables repair_garages / repair_diagnostics / repair_orders / repair_invoices / repair_warranties alignees v2.2).

---

**Fin du meta-prompt B-19 v2.2 format Option B.**
