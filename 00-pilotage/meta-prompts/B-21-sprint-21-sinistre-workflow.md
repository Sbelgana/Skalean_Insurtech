# META-PROMPT B-21 -- SPRINT 21 SINISTRE WORKFLOW DETAILLE

**Version** : v2.2 (Option B)
**Phase** : 5 -- Vertical Repair (Skalean Garage ERP)
**Sprint** : 21 / 35 (cumul) -- Phase 5 Sprint 3
**Position** : Apres IA Estimation Photos, avant Web Garage App
**Numerotation taches** : 5.3.1 a 5.3.13
**Effort total** : ~70 heures developpement / 2 semaines
**Priorite** : P0 (workflow operationnel critique pour pilote Sprint 35)

---

## Objectif Global du Sprint

Implementer **workflow detaille sinistre end-to-end** : depuis reception vehicule jusqu'au reglement final + garantie. Sprint 19 livre foundation + state machine ; Sprint 21 enrichit chaque etape avec workflows complets, documents auto-generes, notifications real-time, integration assureurs (mock Sprint 21, reel Sprint 32 Phase 7), tracking advance.

A la sortie de ce sprint :
- Workflow reception vehicule : check vehicule + verification documents customer + photos arrivee
- Workflow diagnostic enrichi : suggestions IA Sprint 20 + technicien validation + photos additionnelles
- Workflow devis : envoi assureur OR client + tracking lecture/approbation + relance
- Workflow approbation : conditions assureur (franchise, exclusions) + extension demandes (pieces additionnelles)
- Workflow reparation : tracking advanced (% completion + parts arrived + technicien hours)
- Workflow livraison : QC checklist + signature reception customer + photos final
- Workflow facturation : split assureur (couverture) + customer (franchise + non-couvert)
- Documents auto-generes : rapport technique + certificat conformite + bon livraison
- Notifications real-time chaque etape (Sprint 9 Comm)
- Tests workflow E2E exhaustifs

---

## Frontiere du Sprint

**INCLUS** :
- 7 etapes workflow detaillees (reception / diagnostic / devis / approbation / reparation / livraison / facturation)
- Documents auto-generes per etape
- Notifications real-time multi-channel
- Tracking advanced (photos, signatures, QC checklist)
- Mock integration assureur (Sprint 21) -- reel Sprint 32 Phase 7
- Tests E2E

**EXCLU** (sera ajoute aux sprints suivants) :
- Web Garage App UI -- Sprint 22
- Web Garage Mobile (PWA technicien) -- Sprint 23
- Flux Sinistre Client end-to-end -- Sprint 24
- Cross-Tenant Framework garages partenaires -- Sprint 25
- Reel push devis vers assureurs -- Sprint 32 (defere)

---

## Lectures Prealables Obligatoires

1. Sortie Sprint 19 : entities Repair + workflow status state machine
2. Sortie Sprint 20 : IA Estimation Photos integration
3. Sortie Sprint 13 : Stock + HR
4. Sortie Sprint 11 : Pay refunds (paiement assureur + customer)
5. Sortie Sprint 9 : Comm orchestrator notifications

---

## Stack Imposee (Sprint 21)

| Composant | Version | Notes |
|-----------|---------|-------|
| decimal.js | 10.4.3 | precision computations facturation split |
| date-fns | 4.1.0 | duration tracking |
| zod | 3.24.1 | validation schemas |

Pas de nouvelle dep externe.

---

## Vue d'Ensemble des 13 Taches

| # | Tache | Effort | Priorite | Depend de |
|---|-------|--------|----------|-----------|
| 5.3.1 | Reception vehicule : checklist + photos arrivee + check documents customer | 5h | P0 | Sprint 20 |
| 5.3.2 | Diagnostic enrichi : IA + technicien + photos additionnelles + rapport | 6h | P0 | 5.3.1 |
| 5.3.3 | Envoi devis : assureur (mock) + client + tracking lecture/approbation | 6h | P0 | 5.3.2 |
| 5.3.4 | Approbation tracking : conditions assureur (franchise/exclusions) + extensions | 5h | P0 | 5.3.3 |
| 5.3.5 | Reparation tracking : % completion + parts arrived + technicien hours real-time | 6h | P0 | 5.3.4 |
| 5.3.6 | QC checklist + livraison : signatures reception customer + photos final | 6h | P0 | 5.3.5 |
| 5.3.7 | Facturation split assureur (couverture) / customer (franchise + non-couvert) | 6h | P0 | 5.3.6 |
| 5.3.8 | Documents auto-generes : rapport technique + certificat + bon livraison | 6h | P0 | 5.3.7 |
| 5.3.9 | Notifications real-time chaque etape : email + WA + push (Sprint 18 PWA) | 5h | P0 | 5.3.8 |
| 5.3.10 | Mock integration assureur : push devis + receive approbation (Sprint 32 reel) | 5h | P0 | 5.3.9 |
| 5.3.11 | Garantie tracking + reclamations workflow + intervention curative | 5h | P0 | 5.3.10 |
| 5.3.12 | Endpoints REST + permissions enrichies | 4h | P0 | 5.3.11 |
| 5.3.13 | Tests E2E workflow complet (40+) + fixtures + scenarios edge cases | 9h | P0 | 5.3.12 |

**Total** : 74 heures.

---

# DETAIL DES 13 TACHES

---

## Tache 5.3.1 -- Reception Vehicule

**Metadonnees** : Phase 5 / Sprint 21 / P0 / 5h / Depend de Sprint 20

**But** : Workflow reception vehicule : checklist arrivee + photos + verification documents customer (carte grise + permis + attestation assurance).

**Livrables checkables** :
- [ ] Migration : table `repair_receptions` :
  - id, sinistre_id (FK), received_by (FK hr_employees), received_at, vehicle_state_check (jsonb : checklist 12 points -- carrosserie + interieur + kilometrage + niveaux), photos_arrival (jsonb : URLs S3), customer_documents (jsonb : { carte_grise_doc_id, permis_doc_id, attestation_assurance_doc_id }), customer_signature_doc_id, condition_notes
- [ ] Service `receptions.service.ts` :
  - `start(sinistreId, employeeId)` -- create reception row + transition sinistre 'received'
  - `addPhotos(receptionId, photos[])` -- upload S3 + store URLs
  - `checkVehicleState(receptionId, checklistData)` -- 12 points verification
  - `uploadCustomerDocuments(receptionId, docs)` -- 3 documents required
  - `complete(receptionId, customerSignatureDocId)` -- transition sinistre 'under_diagnostic'
- [ ] Checklist 12 points :
  1. Carrosserie face (rayures, bosses)
  2. Carrosserie cote droit
  3. Carrosserie cote gauche
  4. Carrosserie arriere
  5. Pare-brise + vitres
  6. Roues + pneus (4)
  7. Niveau carburant (estimation)
  8. Kilometrage (releve)
  9. Interieur tableau bord (etat)
  10. Sieges (etat propre/abime)
  11. Coffre (objects laisses)
  12. Cle + papiers receptionnees
- [ ] Documents customer required (Sprint 10 docs) :
  - Carte grise vehicule
  - Permis de conduire customer
  - Attestation assurance valide
- [ ] Signature reception customer : utilise Sprint 10 Barid eSign signature simple (acceptation reception)
- [ ] Endpoints REST + permissions
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/packages/database/src/migrations/{date}-RepairReceptions.ts                  # ~50 lignes
repo/packages/repair/src/entities/repair-reception.entity.ts                       # ~50 lignes
repo/packages/repair/src/services/receptions.service.ts                              # ~250 lignes
repo/packages/docs/src/templates/{fr,ar-MA,ar}/reception-checklist.hbs              # 3 templates
repo/apps/api/src/modules/repair/controllers/receptions.controller.ts                # ~150 lignes
```

**Notes implementation** :
- Customer signature reception : protege garage si dispute ulterieure (etat vehicule arrival documente)
- Photos avant/apres : critical pour reglement assureur
- Checklist standardise : qualite consistente garages futurs
- Sprint 23 mobile garage : photos directes camera technicien

**Criteres validation** :
- V1 (P0) : Reception start + photos + checklist
- V2 (P0) : 3 documents customer uploaded
- V3 (P0) : Signature reception customer
- V4 (P0) : Transition sinistre 'under_diagnostic'
- V5 (P0) : Tests 8+ scenarios

---

## Tache 5.3.2 -- Diagnostic Enrichi : IA + Technicien

**Metadonnees** : Phase 5 / Sprint 21 / P0 / 6h / Depend de 5.3.1

**But** : Workflow diagnostic complet : IA suggestions Sprint 20 + technicien expertise + photos additionnelles + rapport technique PDF.

**Livrables checkables** :
- [ ] Update Sprint 19 `diagnostics.service.ts` :
  - Auto-trigger IA estimation lors start (Sprint 20 deja livre)
  - Apres IA : technicien voit suggestions UI Sprint 22
  - Technicien add photos additionnelles (analyse approfondie)
  - Technicien valide/edit/reject IA suggestions (Sprint 20 livre)
  - Generate rapport technique PDF (utilise PdfGenerator Sprint 10)
- [ ] Rapport technique structure :
  - Header : sinistre + vehicule + date diagnostic
  - Photos arrivee (Tache 5.3.1)
  - IA estimation summary (confidence + damages detected)
  - Technicien validation : accept all / edits / additional findings
  - Recommendations
  - Signature technicien
- [ ] Endpoint `POST /api/v1/repair/diagnostics/:id/generate-report`
- [ ] Auto-attach rapport au sinistre + envoie assureur si police impactee
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/packages/repair/src/services/diagnostics.service.ts                          # update : generateReport
repo/packages/docs/src/templates/{fr,ar-MA,ar}/diagnostic-report.hbs                # 3 templates rapport technique
```

**Criteres validation** :
- V1 (P0) : Diagnostic enriched IA + technicien
- V2 (P0) : Photos additionnelles upload
- V3 (P0) : Rapport technique PDF generated
- V4 (P0) : Tests 6+ scenarios

---

## Tache 5.3.3 -- Envoi Devis : Assureur + Client + Tracking

**Metadonnees** : Phase 5 / Sprint 21 / P0 / 6h / Depend de 5.3.2

**But** : Workflow envoi devis : recipients selon contexte + tracking lecture/approbation + relances automatiques.

**Livrables checkables** :
- [ ] Update Sprint 19 `devis.service.ts.send()` :
  - Determine recipients :
    - Si sinistre.insure_policy_id : envoie ASSUREUR (mock Sprint 21, reel Sprint 32) + COPY customer
    - Sinon : envoie CUSTOMER seul
  - Email + WhatsApp Sprint 9 avec template `devis-envoye.hbs`
  - Tracking : webhook email open / WA read (Sprint 9)
  - Status devis : sent -> read (si webhook recu) -> approved/rejected
- [ ] Migration : ajouter colonnes `repair_devis.read_at` + `read_by_type` ('insurer' | 'customer')
- [ ] Cron relances :
  - Si devis sent + 3 jours sans approval : relance assureur + customer
  - Si devis sent + 7 jours sans approval : escalade chef garage
  - Si devis 14 jours sans approval : auto-expire + transition sinistre 'cancelled' (sauf explicit extend)
- [ ] Mock assureur : simule webhook approbation 1-3 jours apres send (env `MOCK_INSURER_APPROVAL_DELAY_HOURS`)
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/packages/database/src/migrations/{date}-AddDevisReadTracking.ts                # ~30 lignes
repo/packages/repair/src/services/devis.service.ts                                  # update sending logic
repo/packages/repair/src/jobs/devis-relances-cron.ts                                  # ~100 lignes
repo/packages/repair/src/services/mock-insurer-approval.service.ts                    # ~150 lignes (Sprint 21 mock)
```

**Criteres validation** :
- V1 (P0) : Recipients logic correct
- V2 (P0) : Tracking lecture
- V3 (P0) : Relances automatiques
- V4 (P0) : Mock assureur approval simulation
- V5 (P0) : Tests 10+ scenarios

---

## Tache 5.3.4 -- Approbation Tracking : Conditions + Extensions

**Metadonnees** : Phase 5 / Sprint 21 / P0 / 5h / Depend de 5.3.3

**But** : Tracking approbation enrichi : conditions assureur (franchise applicable, exclusions, plafond) + extensions (devis additionnel pieces decouvert in-progress).

**Livrables checkables** :
- [ ] Migration : table `repair_devis_approvals` :
  - id, devis_id (FK), approved_by_type ('insurer' | 'customer'), approval_conditions (jsonb : { franchise_amount, exclusions[], coverage_cap, special_conditions }), approved_amount (numeric : peut etre < devis total si plafond), approved_at, approver_reference, approval_doc_id (FK)
- [ ] Service `devis-approvals.service.ts` :
  - `approve(devisId, approverType, conditions)` -- INSERT row + transition devis status
  - `getApprovalConditions(sinistreId)` -- pour facturation split
- [ ] Workflow extensions :
  - Si reparation revele pieces additionnelles : create devis avenant
  - Avenant doit etre approuve avant continuation
  - Sinistre status : 'under_repair' -> 'awaiting_approval' (avenant) -> 'under_repair'
- [ ] Migration : ajouter `repair_devis.parent_devis_id` (FK self : avenant)
- [ ] Endpoints :
  - `POST /api/v1/repair/devis/:id/approve` (avec conditions)
  - `POST /api/v1/repair/sinistres/:id/request-additional-devis`
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/packages/database/src/migrations/{date}-RepairDevisApprovals.ts                 # ~50 lignes
repo/packages/repair/src/entities/repair-devis-approval.entity.ts                     # ~40 lignes
repo/packages/repair/src/services/devis-approvals.service.ts                          # ~200 lignes
repo/apps/api/src/modules/repair/controllers/devis-approvals.controller.ts             # ~120 lignes
```

**Notes implementation** :
- Franchise : montant a charge customer (Sprint 14 polices definie franchise)
- Exclusions : items devis non rembourses par assureur (e.g. nettoyage interieur)
- Coverage cap : plafond couverture police (e.g. capital max 50k MAD)
- Avenant devis : workflow signature + approval similaire devis principal

**Criteres validation** :
- V1 (P0) : Approval avec conditions stockees
- V2 (P0) : Avenants supported
- V3 (P0) : getApprovalConditions retourne data complete
- V4 (P0) : Tests 8+ scenarios

---

## Tache 5.3.5 -- Reparation Tracking Real-Time

**Metadonnees** : Phase 5 / Sprint 21 / P0 / 6h / Depend de 5.3.4

**But** : Tracking advanced reparation : % completion + parts arrived + technicien hours en temps reel.

**Livrables checkables** :
- [ ] Update Sprint 19 `repair_orders` entity :
  - Ajout colonnes : `completion_percentage` (int 0-100), `parts_arrival_status` (jsonb : { part_id, status: 'pending' | 'ordered' | 'arrived' | 'used', expected_date, arrived_at }), `last_status_update`
- [ ] Service `orders-tracking.service.ts` :
  - `updateCompletion(orderId, percentage, taskCompleted)` -- update % + Kafka event
  - `markPartArrived(orderId, partId)` -- update parts_arrival_status
  - `recordHoursWorked(orderId, technicianId, hours, taskDescription)` -- HR Sprint 13 integration
- [ ] Real-time updates : Kafka events + Sprint 18 mobile assure poll status (Sprint 23 garage app real-time)
- [ ] Notifications customer : milestones (50% completion, 100% completed, ready for delivery)
- [ ] Endpoints :
  - `POST /api/v1/repair/orders/:id/update-completion`
  - `POST /api/v1/repair/orders/:id/parts/:partId/arrived`
  - `GET /api/v1/repair/orders/:id/tracking` (status + photos progres)
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/packages/database/src/migrations/{date}-AddOrderTrackingColumns.ts            # ~30 lignes
repo/packages/repair/src/services/orders-tracking.service.ts                         # ~250 lignes
repo/packages/comm/src/templates/{fr,ar-MA,ar}/repair-progress-update.hbs            # 3 templates
```

**Criteres validation** :
- V1 (P0) : % completion tracking
- V2 (P0) : Parts arrival tracking
- V3 (P0) : Hours logged HR
- V4 (P0) : Notifications milestones
- V5 (P0) : Tests 10+ scenarios

---

## Tache 5.3.6 -- QC Checklist + Livraison

**Metadonnees** : Phase 5 / Sprint 21 / P0 / 6h / Depend de 5.3.5

**But** : Quality Control checklist post-reparation + livraison customer avec signature reception + photos final + bon livraison.

**Livrables checkables** :
- [ ] Migration : table `repair_quality_checks` :
  - id, sinistre_id (FK), order_id (FK), inspector_id (FK hr_employees), qc_checklist (jsonb : 10 points QC), photos_after (jsonb), passed (boolean), failed_items (jsonb), inspected_at
- [ ] Migration : table `repair_deliveries` :
  - id, sinistre_id (FK), delivered_to_customer_id (FK contacts), delivered_at, customer_signature_doc_id, customer_satisfaction_rating (1-5, optional), customer_feedback (text), delivery_doc_id (FK : bon livraison PDF)
- [ ] Service `quality-checks.service.ts` :
  - `inspect(orderId, inspectorId, checklistData)` -- 10 points verification + photos after
  - `markPassed(qcId)` -- transition sinistre 'completed' + ready for delivery
  - `markFailed(qcId, failedItems)` -- requires re-work + status reverts 'under_repair'
- [ ] Service `deliveries.service.ts` :
  - `prepareDelivery(sinistreId)` -- generate bon livraison PDF
  - `executeDelivery(sinistreId, customerSignatureData)` -- signature customer + transition 'delivered'
  - `recordSatisfaction(deliveryId, rating, feedback)`
- [ ] QC checklist 10 points :
  1. Verification visuelle reparation
  2. Test fonctionnel pieces remplacees
  3. Niveau fluides (huile, eau, freins)
  4. Pneus (pression + usure)
  5. Eclairage (phares, feux)
  6. Test electrique
  7. Test demarrage
  8. Test conduite (si applicable)
  9. Nettoyage interieur/exterieur
  10. Documents prepares (facture + bon livraison + cle)
- [ ] Endpoints
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/packages/database/src/migrations/{date}-RepairQualityChecks.ts                  # ~50 lignes
repo/packages/database/src/migrations/{date}-RepairDeliveries.ts                      # ~50 lignes
repo/packages/repair/src/entities/{2 entities}.ts                                      # ~80 lignes
repo/packages/repair/src/services/quality-checks.service.ts                            # ~200 lignes
repo/packages/repair/src/services/deliveries.service.ts                                  # ~200 lignes
repo/packages/docs/src/templates/{fr,ar-MA,ar}/bon-livraison.hbs                          # 3 templates
repo/apps/api/src/modules/repair/controllers/{2 controllers}.ts                          # ~250 lignes
```

**Notes implementation** :
- QC failed : sinistre revient 'under_repair' + technicien notification
- Customer satisfaction rating : utilise Sprint 13 NPS dashboards
- Photos after vs before : preuve work executed
- Signature reception customer : Barid eSign simple OR pad signature physique numerise

**Criteres validation** :
- V1 (P0) : QC 10 points + photos
- V2 (P0) : QC failed -> re-work
- V3 (P0) : Delivery + signature
- V4 (P0) : Bon livraison PDF
- V5 (P0) : Satisfaction rating
- V6 (P0) : Tests 10+ scenarios

---

## Tache 5.3.7 -- Facturation Split Assureur / Customer

**Metadonnees** : Phase 5 / Sprint 21 / P0 / 6h / Depend de 5.3.6

**But** : Facturation split intelligente : montant assureur (couverture police) + montant customer (franchise + non-couvert).

**Livrables checkables** :
- [ ] Update Sprint 19 `invoices.service.ts.createFromCompletedOrder()` :
  - Si sinistre.insure_policy_id existe : split selon approval_conditions
  - Compute insurer_amount = total - franchise - exclusions
  - Compute customer_amount = franchise + exclusions (jamais negatif)
  - Generate 2 factures :
    - Facture 1 : recipient='insurer', amount=insurer_amount
    - Facture 2 : recipient='customer', amount=customer_amount (peut etre 0 si full coverage)
  - Si pas police : 1 seule facture customer (full amount)
- [ ] Migration : ajouter `repair_invoices.split_parent_id` (FK self : 2 factures liees same sinistre)
- [ ] Reglements :
  - Assureur paie via virement (Sprint 11 Pay manual reconciliation Phase 7+)
  - Customer paie immediate via Pay (cards / mobile money / cash kiosque)
- [ ] Tests : split correct + edge cases (full coverage = customer 0, exclusion = customer paie)

**Pattern critique : split logic facturation**

```typescript
// repo/packages/repair/src/services/invoices.service.ts
async createFromCompletedOrder(orderId: string): Promise<RepairInvoice[]> {
  const order = await this.ordersService.findById(orderId);
  const sinistre = await this.sinistresService.findById(order.sinistre_id);
  const policy = sinistre.insure_policy_id ? await this.policiesService.findById(sinistre.insure_policy_id) : null;

  const totalHt = new Decimal(order.parts_cost_actual).plus(order.labor_cost_actual);
  const tva = totalHt.mul('0.20'); // TVA standard 20% prestation auto
  const totalTtc = totalHt.plus(tva);

  if (!policy) {
    // No insurance : 1 facture customer full amount
    return [await this.createInvoice({
      sinistre_id: sinistre.id, order_id: orderId,
      recipient_type: 'customer', recipient_data: this.getCustomerData(sinistre),
      total_ht: totalHt, total_tva: tva, total_ttc: totalTtc,
    })];
  }

  // Insurance : split logic
  const approval = await this.approvalsService.getActive(sinistre.id);
  const franchise = new Decimal(approval.approval_conditions.franchise_amount ?? 0);
  const coverageCap = new Decimal(approval.approval_conditions.coverage_cap ?? Infinity);
  const exclusions = approval.approval_conditions.exclusions ?? [];

  // Compute exclusions amount (items dans devis exclus de coverage)
  const exclusionsAmount = this.computeExclusionsAmount(order, exclusions);

  // Insurer amount = min(total - franchise - exclusions, coverage_cap)
  const insurerAmount = Decimal.min(
    totalTtc.minus(franchise).minus(exclusionsAmount).clampedTo(0, Infinity),
    coverageCap,
  );

  // Customer amount = total - insurer_amount
  const customerAmount = totalTtc.minus(insurerAmount);

  const invoices: RepairInvoice[] = [];

  // Facture insurer (si > 0)
  if (insurerAmount.gt(0)) {
    invoices.push(await this.createInvoice({
      sinistre_id: sinistre.id, order_id: orderId,
      recipient_type: 'insurer', recipient_data: this.getInsurerData(policy),
      total_ttc: insurerAmount,
      // Compute HT/TVA proportionally
      total_ht: insurerAmount.div(1.20),
      total_tva: insurerAmount.minus(insurerAmount.div(1.20)),
    }));
  }

  // Facture customer (si > 0)
  if (customerAmount.gt(0)) {
    invoices.push(await this.createInvoice({
      sinistre_id: sinistre.id, order_id: orderId,
      recipient_type: 'customer', recipient_data: this.getCustomerData(sinistre),
      total_ttc: customerAmount,
      total_ht: customerAmount.div(1.20),
      total_tva: customerAmount.minus(customerAmount.div(1.20)),
    }));
  }

  // Link invoices via split_parent
  if (invoices.length === 2) {
    await this.invoicesRepo.update(invoices[1].id, { split_parent_id: invoices[0].id });
  }

  return invoices;
}
```

**Fichiers crees / modifies** :
```
repo/packages/database/src/migrations/{date}-AddInvoiceSplitParent.ts                # ~20 lignes
repo/packages/repair/src/services/invoices.service.ts                                # update split logic
repo/packages/repair/src/services/invoices.service.spec.ts                            # ~250 lignes (tests split)
```

**Criteres validation** :
- V1 (P0) : Split correct (insurer + customer)
- V2 (P0) : Pas police : customer full
- V3 (P0) : Coverage cap respect
- V4 (P0) : Exclusions imputed customer
- V5 (P0) : Edge case : full coverage = customer 0
- V6 (P0) : Edge case : pas couverture = customer total
- V7 (P0) : decimal.js precision
- V8 (P0) : Tests 12+ scenarios

---

## Tache 5.3.8 -- Documents Auto-Generes

**Metadonnees** : Phase 5 / Sprint 21 / P0 / 6h / Depend de 5.3.7

**But** : Auto-generation documents officiels chaque etape : rapport diagnostic + bon de reception + bon livraison + certificat conformite.

**Livrables checkables** :
- [ ] Documents auto-generes (utilise Sprint 10 Docs+Signature) :
  - **Bon reception** : reception complete -> generate PDF
  - **Rapport diagnostic** : diagnostic complete -> generate PDF + envoie assureur si police
  - **Devis** : Sprint 19 deja livre
  - **Approbation devis** : approval recue -> generate PDF
  - **Bon livraison** : delivery -> generate PDF + signature customer
  - **Facture(s)** : invoices -> generate PDF (Sprint 19 deja livre)
  - **Certificat conformite reparation** : optional, post-livraison (preuve qualite Sprint 32+ exigence assureur)
- [ ] Templates 3 locales chacun
- [ ] Auto-attach a sinistre + envoi destinataires automatique via Comm Sprint 9
- [ ] Archive : tous documents archives 10 ans (loi 43-20)
- [ ] Endpoint `GET /api/v1/repair/sinistres/:id/documents` (liste tous documents lies)
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/packages/docs/src/templates/{fr,ar-MA,ar}/bon-reception.hbs                       # 3 templates
repo/packages/docs/src/templates/{fr,ar-MA,ar}/diagnostic-report.hbs                    # update Tache 5.3.2
repo/packages/docs/src/templates/{fr,ar-MA,ar}/devis-approval.hbs                       # 3 templates
repo/packages/docs/src/templates/{fr,ar-MA,ar}/bon-livraison.hbs                        # update Tache 5.3.6
repo/packages/docs/src/templates/{fr,ar-MA,ar}/certificat-conformite-reparation.hbs    # 3 templates
repo/packages/repair/src/services/document-generator.service.ts                          # ~250 lignes (orchestrator)
```

**Criteres validation** :
- V1 (P0) : 5 documents auto-generes
- V2 (P0) : Templates 3 locales
- V3 (P0) : Auto-attach sinistre
- V4 (P0) : Archive 10 ans
- V5 (P0) : Tests 8+ scenarios

---

## Tache 5.3.9 -- Notifications Real-Time Multi-Channel

**Metadonnees** : Phase 5 / Sprint 21 / P0 / 5h / Depend de 5.3.8

**But** : Notifications real-time chaque etape sinistre : email + WhatsApp + push notifications PWA Sprint 18.

**Livrables checkables** :
- [ ] Templates Comm Sprint 9 :
  - `repair-vehicle-received.hbs` (customer + assureur si police)
  - `repair-diagnostic-completed.hbs`
  - `repair-devis-sent.hbs`
  - `repair-approval-received.hbs`
  - `repair-progress-25/50/75/100.hbs` (milestones)
  - `repair-ready-for-delivery.hbs`
  - `repair-delivered.hbs`
  - `repair-warranty-active.hbs`
- [ ] Auto-trigger notifications via Kafka consumers `repair.sinistre.*` events
- [ ] Channels per notification :
  - Email : tous evenements
  - WhatsApp : milestones + ready-for-delivery (criticum)
  - Push PWA Sprint 18 : milestones + ready (real-time)
- [ ] Locale : utilise customer.preferred_language Sprint 8
- [ ] Tests integration

**Fichiers crees / modifies** :
```
repo/packages/comm/src/templates/{fr,ar-MA,ar}/repair-{8 templates}.hbs                # 24 templates total
repo/packages/repair/src/consumers/repair-events-to-comm.consumer.ts                     # ~250 lignes
```

**Criteres validation** :
- V1 (P0) : 8 templates locales 3 langues
- V2 (P0) : Auto-trigger sur events Kafka
- V3 (P0) : Multi-channel selon urgency
- V4 (P0) : Locale customer respect
- V5 (P0) : Tests 10+ scenarios

---

## Tache 5.3.10 -- Mock Integration Assureur

**Metadonnees** : Phase 5 / Sprint 21 / P0 / 5h / Depend de 5.3.9

**But** : Mock service simulant integration assureur (push devis + receive approbation) -- Sprint 32 (Phase 7) reel via connecteurs.

**Livrables checkables** :
- [ ] Service `mock-insurer-integration.service.ts` :
  - `pushDevis(devisId, insurerProvider)` -- log + simulate webhook callback 1-3 jours apres
  - `pushSinistreDeclaration(sinistreId)` -- declare sinistre chez assureur (simulation)
  - `pollApprovalStatus(devisId)` -- mock poll (jamais utilise mais available)
- [ ] Cron `mock-insurer-callbacks.job` :
  - Simule webhook approval/rejection per devis envoye apres delay configurable
  - Variables env : `MOCK_INSURER_APPROVAL_DELAY_MIN_HOURS=24`, `MAX_HOURS=72`, `MOCK_REJECTION_RATE=0.10` (10% rejet)
- [ ] Cron retourne approval ou rejection avec conditions realistic :
  - Approval : franchise 5000 MAD + coverage_cap = devis_total + standard exclusions
  - Rejection : reasons varies ('Item exclu police', 'Coverage epuisee', 'Documents manquants')
- [ ] Sprint 32 reel : MockService swap par RealConnectorService (5 assureurs)
- [ ] Tests : verify mock callbacks
- [ ] Documentation pattern swap

**Fichiers crees / modifies** :
```
repo/packages/repair/src/services/mock-insurer-integration.service.ts                   # ~300 lignes
repo/packages/repair/src/jobs/mock-insurer-callbacks.cron.ts                              # ~150 lignes
repo/docs/insurer-integration-migration-sprint-32.md                                       # ~150 lignes (pattern swap)
```

**Notes implementation** :
- Pattern similar Sprint 20 IA : mock realistic + DI swap
- 10% rejection rate : simule reality (assureurs rejettent parfois)
- Cron daily : declenche callbacks scheduled

**Criteres validation** :
- V1 (P0) : Mock pushDevis log + scheduled callback
- V2 (P0) : Cron declenche callbacks
- V3 (P0) : Approval realistic + Rejection 10%
- V4 (P0) : Documentation pattern Sprint 32 swap
- V5 (P0) : Tests 6+ scenarios

---

## Tache 5.3.11 -- Garantie Tracking + Reclamations

**Metadonnees** : Phase 5 / Sprint 21 / P0 / 5h / Depend de 5.3.10

**But** : Workflow garantie post-livraison enrichi : tracking expiration + reclamations + intervention curative gratuite (re-reparation pieces defectueuses).

**Livrables checkables** :
- [ ] Update Sprint 19 `repair_warranties` entity :
  - Compute auto `expires_at = starts_at + duration_months`
  - Status : `active` -> `expired` (cron daily)
- [ ] Service `warranty-claims.service.ts` (Sprint 19 ebauche, Sprint 21 enrichi) :
  - `submitClaim(warrantyId, description, photos)`
  - `processClaim(claimId, resolution)` :
    - `re_repair_free` : cree nouveau sinistre lie + trigger workflow Sprint 19 (zero cost customer)
    - `partial_refund` : trigger Pay refund Sprint 11
    - `rejected` : reasons documentees
- [ ] Cron daily : expire warranties + envoie reminders 30j avant expiration
- [ ] Endpoint customer Sprint 18 : `POST /api/v1/repair/warranties/:id/claim` (declaration reclamation depuis mobile)
- [ ] Notifications customer + garage
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/packages/repair/src/services/warranty-claims.service.ts                              # ~250 lignes (enrichi)
repo/packages/repair/src/jobs/warranty-expiry-reminder.cron.ts                              # ~100 lignes
repo/packages/comm/src/templates/{fr,ar-MA,ar}/warranty-{expires-soon,claim-received}.hbs    # 6 templates
```

**Criteres validation** :
- V1 (P0) : Submit claim workflow
- V2 (P0) : Re-repair free cree nouveau sinistre
- V3 (P0) : Partial refund Pay integration
- V4 (P0) : Cron expiry + reminders
- V5 (P0) : Tests 8+ scenarios

---

## Tache 5.3.12 -- Endpoints REST + Permissions

**Metadonnees** : Phase 5 / Sprint 21 / P0 / 4h / Depend de 5.3.11

**But** : Consolidation endpoints REST + permissions enrichies catalog Sprint 7.

**Livrables checkables** :
- [ ] Endpoints livres dans taches precedentes (consolidation)
- [ ] Permissions ajoutees catalog :
  - `repair.receptions.start/complete`
  - `repair.qc_checks.inspect`
  - `repair.deliveries.execute`
  - `repair.invoices.split`
  - `repair.warranty_claims.submit/process`
- [ ] Update PermissionsMatrix : roles garage_* enrichis
- [ ] Tests permissions

**Fichiers crees / modifies** :
```
repo/packages/auth/src/rbac/permissions.enum.ts                                          # update
repo/packages/auth/src/rbac/permissions-matrix.ts                                          # update
repo/apps/api/test/repair/sprint-21-permissions.e2e-spec.ts                              # tests
```

**Criteres validation** :
- V1 (P0) : 15+ permissions Sprint 21 ajoutees
- V2 (P0) : Roles enrichis
- V3 (P0) : Tests RBAC 8+ scenarios

---

## Tache 5.3.13 -- Tests E2E Workflow Complet (40+) + Edge Cases

**Metadonnees** : Phase 5 / Sprint 21 / P0 / 9h / Depend de 5.3.12

**But** : Suite tests E2E exhaustive workflow end-to-end + edge cases + fixtures realistic.

**Livrables checkables** :

**Tests E2E (40+)** :
- [ ] Workflow happy path complete : declared -> closed (1 test long mais critical) (1)
- [ ] Reception : checklist + photos + documents (4)
- [ ] Diagnostic : IA + technicien + rapport (3)
- [ ] Devis : envoi + tracking + approval + relances (5)
- [ ] Approbation : conditions + extensions avenants (4)
- [ ] Reparation tracking : milestones + parts + hours (5)
- [ ] QC + delivery : passed/failed + signature (4)
- [ ] Facturation split : 5 cases (full coverage / franchise / exclusions / cap / no insurance) (5)
- [ ] Documents auto-generes : 5 documents (5)
- [ ] Notifications : 8 events Kafka -> Comm (3)
- [ ] Mock insurer : pushDevis + callback approval/rejection (3)
- [ ] Garantie claims : re-repair + refund + reject (3)

**Edge cases** :
- Reparation revele plus de degats : avenant devis
- Customer ne signe pas reception : status pending
- Mock assureur reject : sinistre cancelled + customer notification
- QC failed multiple fois : escalade super admin tenant
- Customer paie partial : invoice partial_paid status

**Fichiers crees / modifies** :
```
repo/apps/api/test/repair/sprint-21-workflow/{40+ specs}.e2e-spec.ts
repo/infrastructure/scripts/seed-sprint-21-fixtures.ts                                    # ~400 lignes scenarios complets
```

**Criteres validation** :
- V1 (P0) : 40+ tests passent
- V2 (P0) : CI green
- V3 (P0) : Edge cases couverts
- V4 (P0) : Reproducibility 5x

---

## Sortie du Sprint 21

A la fin de l'execution des 13 taches :

```
Sinistre Workflow Detaille operational :
  - Reception vehicule : checklist 12 points + photos + 3 docs customer + signature
  - Diagnostic enrichi : IA Sprint 20 + technicien + rapport technique PDF
  - Devis : envoi assureur (mock) + customer + tracking + relances 3/7/14j
  - Approbation : conditions (franchise/exclusions/cap) + extensions avenants
  - Reparation tracking real-time : % completion + parts arrival + hours
  - QC checklist 10 points + livraison + signature reception customer
  - Facturation split intelligente : insurer + customer (decimal.js precision)
  - 5 documents auto-generes per etape (3 locales)
  - Notifications real-time multi-channel (email + WA + push)
  - Mock integration assureur (Sprint 32 reel via connecteurs)
  - Garantie + reclamations + re-repair gratuit + refund

40+ tests E2E + edge cases couverts
```

**Sprint 22 (Web Garage App) demarre avec** :
- Workflow operationnel backend complet
- UI consume tous endpoints Sprints 19-21
- Pattern Next.js 15 reutilise Sprint 16

---

## Specifications Format Tache (pour Generation par Cowork)

Cowork genere `task-5.3.X-*.md` dans `00-pilotage/prompts-taches/sprint-21-sinistre-workflow/`.

**Patterns code inline conserves** : split logic facturation avec decimal.js + edge cases (franchise, exclusions, cap, no insurance).

**Reference** : Sprint 19 entities + Sprint 20 IA + Sprints 9/10/11 modules horizontaux.

---

**Fin du meta-prompt B-21 v2.2 format Option B.**
