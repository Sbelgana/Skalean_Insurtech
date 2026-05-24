# META-PROMPT B-21 v3.0 -- SPRINT 21 SINISTRE WORKFLOW DETAILLE + EXPERT CENTRAL + PARTSHUB INTEGRE

**Version** : v3.0 (Option B Migration -- refonte complete)
**Phase** : 5 -- Vertical Repair (Assurflow Garage ERP + Ecosystem)
**Sprint** : 21 / 40 (cumul v3.0) -- Phase 5 Sprint 3
**Position** : Apres IA Estimation Photos (Sprint 20 + 20.5 Sky AI pre-training), avant Web Garage App
**Numerotation taches** : 5.3.1 a 5.3.19 (vs 5.3.1 a 5.3.13 v2.2)
**Effort total** : ~100 heures developpement / 2 semaines etendues (vs 74h v2.2)
**Priorite** : P0 (workflow operationnel critique pour Demo Day 30 juin + pilote Sprint 35)

---

## Refonte v2.2 -> v3.0 : Changements majeurs

Ce sprint est **refondu** par rapport a v2.2 pour integrer 2 corrections terrain Saad majeures (analyse v2.0) :

### Correction 1 : Workflow expert correct (decision-013)

| Element | v2.2 (FAUX) | v3.0 (CORRECT) |
|---------|-------------|------------------|
| Recipient devis | Assureur (carrier) | **Expert designe par carrier** |
| Validateur devis | Assureur | **Expert agree ACAPS** |
| Carrier role | Recepteur | **CC notifications + valide paiement final** |
| Workflow status | `awaiting_approval` puis `approved` | `quote_sent_to_expert` -> `expertise_in_progress` -> `quote_validated_by_expert` |
| Mock service | Mock assureur approval | **Mock expert visite + validation** (Sprint 22.7 reel expert app) |
| Facturation | Split assureur 60% + customer 40% | **Carrier paye garage direct 90% cas** (circuit garage agree, garage avance fonds) |

### Correction 2 : PartsHub Phase 1 module integre (decision-014)

| Element | v2.2 | v3.0 |
|---------|------|------|
| Pieces detachees | Stock interne seulement (Sprint 13) | **Stock interne + Marketplace PartsHub fournisseurs externes** |
| Commande pieces | Telephone manuel | **1-click depuis app garage -> commande automatique fournisseur** |
| Revenue Assurflow | 0 sur pieces | **Commission 3-5% par transaction PartsHub** |
| Sprint taches | 13 | **19** (+6 PartsHub) |
| Effort | 74h | **100h** (+26h PartsHub) |

---

## Objectif Global du Sprint v3.0

Implementer **workflow detaille sinistre v3.0 end-to-end** depuis reception vehicule jusqu'au reglement final + garantie, **avec expert central comme acteur de validation devis** et **PartsHub Phase 1 integre dans Assurflow Garage**.

Sprint 19 livre foundation + state machine. Sprint 20 + 20.5 livrent IA estimation + Sky AI pre-training. **Sprint 21 v3.0 enrichit chaque etape avec workflows complets, workflow expert correct, PartsHub marketplace, documents auto-generes, notifications real-time, mock expert + mock carrier validation paiement** (Sprint 22.7 + 26.5 reels via apps dediees).

A la sortie de ce sprint :
- Workflow reception vehicule : check vehicule + verification documents customer + photos arrivee (inchange v2.2)
- Workflow diagnostic enrichi : Sky AI suggestions Sprint 20.5 + technicien validation + photos additionnelles (enrichi)
- **Workflow devis v3.0 : envoi a EXPERT designe par carrier (CC carrier) + tracking lecture/validation** (REFONDU)
- **Workflow validation expert v3.0 : visite garage + validation/modification/rejet ligne par ligne + signature Barid + soumission carrier** (REFONDU)
- **Workflow validation paiement carrier : approval multi-niveau (Sprint 26.5)** (NOUVEAU)
- **Workflow PartsHub : catalog fournisseurs + commande automatique + tracking livraison + commission 3-5%** (NOUVEAU)
- Workflow reparation : tracking advanced (% completion + parts arrived + technicien hours) (inchange)
- Workflow livraison : QC checklist + signature reception customer + photos final (inchange)
- **Workflow facturation v3.0 : carrier paye garage direct 90% (garage avance fonds) ; split franchise customer seulement 10% cas** (REFONDU)
- Documents auto-generes : rapport technique + certificat conformite + bon livraison (enrichis)
- Notifications real-time chaque etape (Sprint 9) (enrichies WhatsApp = status seulement)
- Tests workflow E2E exhaustifs (60+ vs 40+ v2.2)

---

## Frontiere du Sprint v3.0

**INCLUS** :
- 8 etapes workflow detaillees (reception / diagnostic / devis-expert / expertise / approbation-carrier / reparation / livraison / facturation)
- Workflow expert central avec validation line-by-line
- Workflow carrier validation paiement (mock Sprint 21 / reel Sprint 26.5)
- **PartsHub Phase 1 integre** (catalog + commande + tracking + commission)
- Documents auto-generes per etape
- Notifications real-time multi-channel (WhatsApp = status seulement)
- Tracking advanced (photos, signatures, QC checklist)
- Mock expert (Sprint 21) -- reel Sprint 22.7 Expert App
- Mock carrier validation paiement (Sprint 21) -- reel Sprint 26.5 Carrier Portal
- Tests E2E 60+

**EXCLU** (sera ajoute aux sprints suivants) :
- Web Garage App UI -- Sprint 22
- Web Garage Mobile (PWA technicien) -- Sprint 23
- Expert App (UI experts) -- Sprint 22.7
- Tow App (UI remorqueurs) -- Sprint 22.5
- Carrier Portal (UI carriers) -- Sprint 26.5
- Flux Sinistre Client end-to-end -- Sprint 24
- Cross-Tenant Framework garages partenaires -- Sprint 25
- Reel push devis vers carriers via API -- Sprint 32 (defere)
- PartsHub standalone marketplace -- Phase 2 (reevaluable post-pilote)

---

## Lectures Prealables Obligatoires

1. `00-pilotage/decisions/013-expert-acteur-central.md` -- workflow expert v3.0 critique
2. `00-pilotage/decisions/014-partshub-phase1.md` -- PartsHub specifications
3. Sortie Sprint 7.5a : 26 roles + 7 cross-tenant types + 130 perms
4. Sortie Sprint 19 : entities Repair + workflow status state machine v3.0
5. Sortie Sprint 20 + 20.5 : IA Estimation Photos + Sky AI pre-training historique garage Saad
6. Sortie Sprint 13 : Stock + HR (PartsHub integration stock garage)
7. Sortie Sprint 11 : Pay refunds + passerelles MA (carrier -> garage + commission fournisseurs)
8. Sortie Sprint 9 : Comm orchestrator notifications (WhatsApp status only)
9. Sortie Sprint 10 : Docs + Signature Barid eSign loi 43-20
10. Sortie Sprint 14 : insure_experts + insure_expert_assignments + insure_expert_reports (preview tables)

---

## Dependencies Sprint precedents (explicites)

Ce Sprint 21 v3.0 **depend critiquement** de :
- **Sprint 7.5a** : 4 expert roles + permissions expertise (10 perms) + cross-tenant `garage_to_expert_request` + 1 role `garage_parts_manager` + permissions parts (7 perms)
- **Sprint 6** : Multi-tenant + RLS + helper postgres app_can_access_tenant (7 types)
- **Sprint 7** : RBAC + Guards + AbacService policies
- **Sprint 9** : NotificationsService (Web Push + email + WhatsApp status only + SMS)
- **Sprint 10** : Barid eSign loi 43-20 (signature rapport expert + bon livraison)
- **Sprint 11** : PaymentGatewayInterface (CMI + YouCan + Mobile Money pour PartsHub fournisseurs + carrier->garage)
- **Sprint 13** : Stock + HR (integration PartsHub stock garage)
- **Sprint 14** : insure_experts + insure_expert_assignments + insure_expert_reports (full version)
- **Sprint 19** : Repair foundation (sinistres entities)
- **Sprint 20** : IA Estimation Photos
- **Sprint 20.5** : Sky AI pre-training historique garage Saad

---

## Stack Imposee (Sprint 21 v3.0)

| Composant | Version | Notes |
|-----------|---------|-------|
| decimal.js | 10.4.3 | precision computations facturation + PartsHub commission |
| date-fns | 4.1.0 | duration tracking + workflow timing |
| zod | 3.24.1 | validation schemas |
| @insurtech/signature | workspace | Barid eSign rapport expert (Sprint 10) |
| @insurtech/pay | workspace | Commission fournisseurs + carrier->garage payment |
| @insurtech/expertise | workspace | Service interaction expert (preview, full Sprint 22.7) |

Pas de nouvelle dep externe (extension stack existant).

---

## Vue d'Ensemble des 19 Taches v3.0

| # | Tache | Effort | Priorite | Refonte v3.0 ? | Depend de |
|---|-------|--------|----------|-----------------|-----------|
| 5.3.1 | Reception vehicule : checklist + photos arrivee + check documents customer | 5h | P0 | Inchange v2.2 | Sprint 20 |
| 5.3.2 | Diagnostic enrichi : Sky AI + technicien + photos additionnelles + rapport | 6h | P0 | Enrichi (Sky AI vs IA generique) | 5.3.1 |
| **5.3.3** | **Envoi devis a EXPERT designe par carrier (CC carrier) + tracking** | **6h** | **P0** | **REFONDU** | **5.3.2** |
| **5.3.4** | **Workflow validation expert : visite + decision line-by-line + signature Barid** | **8h** | **P0** | **REFONDU** | **5.3.3** |
| **5.3.5** | **Approbation paiement carrier (mock Sprint 21 / reel Sprint 26.5)** | **5h** | **P0** | **REFONDU** | **5.3.4** |
| 5.3.6 | Reparation tracking : % completion + parts arrived + technicien hours | 6h | P0 | Inchange v2.2 | 5.3.5 |
| 5.3.7 | QC checklist + livraison : signatures reception customer + photos final | 6h | P0 | Inchange v2.2 | 5.3.6 |
| **5.3.8** | **Facturation v3.0 : carrier->garage direct (90% cas) + franchise customer (10% cas)** | **5h** | **P0** | **REFONDU** | **5.3.7** |
| 5.3.9 | Documents auto-generes : rapport technique + certificat + bon livraison | 6h | P0 | Enrichi (rapport expert + Barid) | 5.3.8 |
| 5.3.10 | Notifications real-time chaque etape : email + WA status only + push | 5h | P0 | Enrichi (WhatsApp scope strict) | 5.3.9 |
| **5.3.11** | **Mock expert visite + validation (Sprint 22.7 reel) + Mock carrier paiement (Sprint 26.5 reel)** | **5h** | **P0** | **REFONDU** | **5.3.10** |
| 5.3.12 | Garantie tracking + reclamations workflow + intervention curative | 5h | P0 | Inchange v2.2 | 5.3.11 |
| 5.3.13 | Endpoints REST + permissions enrichies | 4h | P0 | Etendu (expertise + parts) | 5.3.12 |
| **5.3.14** | **PartsHub : catalog fournisseurs + onboarding KYB + favorites garage** | **6h** | **P0** | **NOUVEAU** | **5.3.13** |
| **5.3.15** | **PartsHub : commande automatique fournisseur (API + email backup)** | **5h** | **P0** | **NOUVEAU** | **5.3.14** |
| **5.3.16** | **PartsHub : tracking livraison + statut real-time + receive vehicle** | **4h** | **P0** | **NOUVEAU** | **5.3.15** |
| **5.3.17** | **PartsHub : paiement en ligne fournisseurs (integration Sprint 11)** | **5h** | **P0** | **NOUVEAU** | **5.3.16** |
| **5.3.18** | **PartsHub : commission tracking 3-5% + log + dashboard Assurflow** | **5h** | **P0** | **NOUVEAU** | **5.3.17** |
| **5.3.19** | **Tests E2E workflow complet v3.0 (60+) + PartsHub + expert + edge cases** | **9h** | **P0** | **REFONDU** | **5.3.18** |

**Total** : 100 heures (vs 74h v2.2). +26h pour expert workflow correct + PartsHub Phase 1.

---

# DETAIL DES 19 TACHES v3.0

---

## Tache 5.3.1 -- Reception Vehicule (inchange v2.2)

**Sprint** : 21 (Phase 5 / Sprint 3)
**Phase** : 5 -- Vertical Repair
**Priorite** : P0
**Effort** : 5h
**Dependances** : Sprint 20

### But

Workflow reception vehicule : checklist arrivee + photos + verification documents customer (carte grise + permis + attestation assurance).

### Status v2.2 -> v3.0

**INCHANGE** -- la reception vehicule garage reste identique. La seule difference est que **le vehicule peut arriver via remorqueur Assurflow Tow** (Sprint 22.5). Dans ce cas, le bon de remorquage Tow est attache au sinistre.

### Livrables checkables

- [ ] Migration : table `repair_receptions` (12 points checklist + photos + 3 docs + signature)
- [ ] Service `receptions.service.ts` : start / addPhotos / checkVehicleState / uploadCustomerDocuments / complete
- [ ] **NOUVEAU v3.0** : si sinistre.tow_mission_id existe, attacher bon remorquage + photos Tow avant/apres
- [ ] Documents customer required : carte grise + permis + attestation assurance
- [ ] Signature reception customer via Barid eSign (Sprint 10)
- [ ] Endpoints REST + permissions
- [ ] Tests 8+ scenarios

### Criteres validation V1-V5

| ID | Critere | Priorite |
|----|---------|----------|
| V1 | Reception start + photos + checklist | P0 |
| V2 | 3 documents customer uploaded | P0 |
| V3 | Signature reception customer | P0 |
| V4 | Transition sinistre 'received_at_garage' | P0 |
| V5 | Si tow_mission_id : attach proofs Tow | P0 |
| V6 | Tests 8+ scenarios | P0 |

---

## Tache 5.3.2 -- Diagnostic Enrichi avec Sky AI (enrichi v3.0)

**Sprint** : 21 (Phase 5 / Sprint 3)
**Phase** : 5 -- Vertical Repair
**Priorite** : P0
**Effort** : 6h
**Dependances** : 5.3.1

### But

Workflow diagnostic complet : Sky AI suggestions (Sprint 20.5 entraine sur historique reel garage Saad) + technicien expertise + photos additionnelles + rapport technique PDF.

### Status v2.2 -> v3.0

**ENRICHI** -- IA generique v2.2 remplacee par **Sky AI** (decision: asset unique garage Saad pre-entraine). Le rapport technique mentionne explicitement la confidence Sky AI.

### Livrables checkables

- [ ] Update Sprint 19 `diagnostics.service.ts` :
  - Auto-trigger **Sky AI** estimation lors start (Sprint 20.5 livre pre-training)
  - Apres Sky AI : technicien voit suggestions UI Sprint 22 avec confidence score
  - Technicien add photos additionnelles
  - Technicien valide/edit/reject Sky AI suggestions
  - Generate rapport technique PDF avec **Sky AI confidence visible**
- [ ] Rapport technique structure :
  - Header : sinistre + vehicule + date diagnostic
  - Photos arrivee (Tache 5.3.1)
  - **Sky AI estimation summary** (confidence + damages detected + similar cases historical)
  - Technicien validation : accept all / edits / additional findings
  - Recommendations
  - Signature technicien
- [ ] Endpoint `POST /api/v1/repair/diagnostics/:id/generate-report`
- [ ] Auto-attach rapport au sinistre + envoie a expert (sera designe Tache 5.3.3)
- [ ] Tests

### Criteres validation V1-V4

| ID | Critere | Priorite |
|----|---------|----------|
| V1 | Diagnostic enriched Sky AI + technicien | P0 |
| V2 | Sky AI confidence visible rapport | P0 |
| V3 | Photos additionnelles upload | P0 |
| V4 | Rapport technique PDF generated | P0 |
| V5 | Tests 6+ scenarios | P0 |

---

## Tache 5.3.3 -- REFONDU : Envoi devis a EXPERT designe par carrier (CC carrier)

**Sprint** : 21 (Phase 5 / Sprint 3)
**Phase** : 5 -- Vertical Repair
**Priorite** : P0
**Effort** : 6h
**Dependances** : 5.3.2

### But (REFONDU v3.0)

**Workflow correct v3.0** : Le garagiste fait son devis et l'envoie par courriel a l'EXPERT designe par l'assurance, non pas au carrier directement, pour approbation. La compagnie d'assurance (carrier) est toujours mise en CC pour les communications.

### Refonte v2.2 -> v3.0

**v2.2 (FAUX)** :
```
Garage devis -> ASSUREUR (mock) + COPY customer
                       |
                       v (1-3 jours)
              Assureur webhook approval/reject
```

**v3.0 (CORRECT)** :
```
Garage devis -> EXPERT (designe par carrier) + CC CARRIER + COPY customer
                       |
                       v (24-48h)
              Expert visite garage physiquement
                       |
                       v
              Expert valide/modifie/rejete LIGNE PAR LIGNE
                       |
                       v
              Expert signe rapport (Barid eSign)
                       |
                       v
              Expert soumet rapport au CARRIER (qui etait en CC)
                       |
                       v
              Carrier valide paiement multi-niveau (Tache 5.3.5)
```

### Livrables checkables

- [ ] **NOUVELLE LOGIQUE Sprint 19 `devis.service.ts.send()`** :
  - Determine recipients selon contexte :
    - Si sinistre.insure_policy_id : envoie EXPERT designe + CC CARRIER + COPY customer
    - Sinon : envoie CUSTOMER seul (cas tres rare hors circuit assure)
  - **Verifier qu'un expert a ete designe par carrier** :
    - Query `insure_expert_assignments WHERE sinistre_id = X AND status IN ('designated', 'accepted')`
    - Si pas d'expert designe : trigger evenement `repair.devis.expert_designation_required` -> carrier_expert_manager reçoit notification (Sprint 26.5)
    - Si expert designe : send devis a expert email + push (Sprint 22.7 expert app)
- [ ] Email + WhatsApp Sprint 9 avec template `devis-envoye-expert.hbs` (NOUVEAU)
  - WhatsApp = notification STATUS uniquement (decision Saad correction 7) : "Devis envoye a votre expert designe. Visite prevue sous 48h."
  - Email = data sensible (devis detaille en piece jointe)
- [ ] Tracking : webhook email open (Sprint 9) + Sprint 22.7 expert app open
- [ ] Status devis : `quote_sent_to_expert` -> `expertise_in_progress` (Tache 5.3.4)
- [ ] Migration : ajouter colonnes `repair_devis.expert_assignment_id` (FK insure_expert_assignments) + `expert_received_at` + `carrier_cc_user_id`
- [ ] Cron relances :
  - Si devis sent + 48h sans visite expert : notification expert (1ere relance)
  - Si devis sent + 72h sans visite : notification expert + carrier_expert_manager (escalade)
  - Si devis sent + 7 jours sans validation : auto-escalade (Sprint 26.5 alert)
- [ ] Tests 10+ scenarios

### Pattern critique : nouvelle logique recipients

```typescript
// repo/packages/repair/src/services/devis.service.ts (refonte v3.0)

async send(devisId: string): Promise<DevisSendResult> {
  const devis = await this.devisRepo.findOneOrFail({ 
    where: { id: devisId }, 
    relations: ['sinistre', 'sinistre.policy'] 
  });
  
  // ============ v3.0 : Verifier expert designe par carrier ============
  if (devis.sinistre.insure_policy_id) {
    // Sinistre couvert par police = workflow circuit assure
    const expertAssignment = await this.expertAssignmentsRepo.findOne({
      where: { 
        sinistre_id: devis.sinistre_id, 
        status: In(['designated', 'accepted']) 
      },
      relations: ['expert', 'carrier_user']
    });
    
    if (!expertAssignment) {
      // Pas d'expert designe -> trigger event pour carrier_expert_manager
      await this.kafkaProducer.emit('insurtech.events.repair.devis.expert_designation_required', {
        devis_id: devisId,
        sinistre_id: devis.sinistre_id,
        carrier_tenant_id: devis.sinistre.policy.carrier_tenant_id,
      });
      
      // Notify carrier_expert_manager (Sprint 26.5 Carrier Portal)
      await this.notifyCarrierExpertDesignationRequired(devis.sinistre.policy.carrier_tenant_id, devis);
      
      // Status devis : pending expert designation
      await this.devisRepo.update(devisId, { 
        status: 'pending_expert_designation' 
      });
      
      return { 
        success: false, 
        reason: 'no_expert_designated',
        carrier_notified: true
      };
    }
    
    // Expert designe -> send devis a expert (CC carrier + COPY customer)
    await this.sendDevisToExpert(devis, expertAssignment);
    
    return { 
      success: true, 
      recipient_type: 'expert',
      expert_id: expertAssignment.expert_id,
      carrier_cc_user_id: expertAssignment.carrier_user_id,
      customer_copy: true
    };
  } else {
    // Cas rare : pas de police -> customer seul
    await this.sendDevisToCustomer(devis);
    return { success: true, recipient_type: 'customer' };
  }
}

private async sendDevisToExpert(
  devis: RepairDevis, 
  assignment: InsureExpertAssignment
): Promise<void> {
  // 1. Send email to expert with devis PDF attached
  await this.commService.sendEmail({
    to: assignment.expert.email,
    cc: [assignment.carrier_user.email],  // carrier en CC
    bcc: [devis.sinistre.customer_email],   // customer en COPY
    template: 'devis-envoye-expert',
    locale: assignment.expert.preferred_language ?? 'fr',
    data: {
      expertName: assignment.expert.full_name,
      sinistreId: devis.sinistre_id,
      garageName: devis.sinistre.garage_tenant.name,
      garageAddress: devis.sinistre.garage_tenant.address,
      vehicleInfo: devis.sinistre.vehicle_immatriculation,
      devisTotalMad: devis.total_ttc,
      devisLinesCount: devis.lines.length,
      visitDeadline: addDays(new Date(), 2),  // 48h
      reportUrl: `${process.env.WEB_EXPERT_URL}/missions/${assignment.id}`,
    },
    attachments: [
      { path: devis.pdf_url, filename: `Devis-${devis.id}.pdf` },
      { path: devis.sinistre.diagnostic_report_url, filename: `Diagnostic-${devis.sinistre_id}.pdf` },
    ],
  });
  
  // 2. Send WhatsApp STATUS notification only (Sprint 9 + correction Saad WhatsApp scope)
  await this.commService.sendWhatsAppStatus({
    to: assignment.expert.phone,
    locale: assignment.expert.preferred_language ?? 'fr',
    template: 'devis-recu-status',  // SIMPLE : "Devis recu, action requise" + lien app
    data: {
      sinistreId: devis.sinistre_id,
      appUrl: `${process.env.WEB_EXPERT_MOBILE_URL}/missions/${assignment.id}`,
    },
    // PAS de data sensible (devis, montants, vehicule, etc.) -- email pour ca
  });
  
  // 3. Push notification expert via Sprint 22.7 expert app
  await this.notificationsService.notifyExpertNewDevis(assignment.expert.user_id, devis.id);
  
  // 4. Update devis status
  await this.devisRepo.update(devis.id, {
    status: 'quote_sent_to_expert',
    expert_assignment_id: assignment.id,
    expert_received_at: new Date(),
    carrier_cc_user_id: assignment.carrier_user_id,
  });
  
  // 5. Update assignment status
  await this.expertAssignmentsRepo.update(assignment.id, {
    status: 'in_progress',
  });
  
  // 6. Update sinistre status
  await this.sinistresRepo.update(devis.sinistre_id, {
    status: 'quote_sent_to_expert',
  });
  
  // 7. Emit Kafka events
  await this.kafkaProducer.emit('insurtech.events.repair.devis.sent_to_expert', {
    devis_id: devis.id,
    sinistre_id: devis.sinistre_id,
    expert_id: assignment.expert_id,
    carrier_user_id: assignment.carrier_user_id,
  });
  
  // 8. Audit log
  await this.auditLogService.log({
    entity_type: 'repair_devis',
    entity_id: devis.id,
    action: 'sent_to_expert',
    actor_user_id: this.userContext.userId,
    details: { 
      expertId: assignment.expert_id,
      carrierCcUserId: assignment.carrier_user_id 
    },
  });
}
```

### Criteres validation V1-V10

| ID | Critere | Priorite |
|----|---------|----------|
| V1 | Recipients logic correct (expert + CC carrier + COPY customer) | P0 |
| V2 | Verification expert designe AVANT envoi | P0 |
| V3 | Si pas expert designe : trigger carrier_expert_manager | P0 |
| V4 | Email = data sensible (devis + diagnostic attached) | P0 |
| V5 | WhatsApp = status only, PAS data sensible (correction Saad) | P0 |
| V6 | Tracking lecture email + app expert | P0 |
| V7 | Status devis quote_sent_to_expert | P0 |
| V8 | Relances 48h / 72h / 7 jours | P0 |
| V9 | Tests 10+ scenarios PASS | P0 |
| V10 | Conforme decision-013 expert acteur central | P0 |

### Fichiers crees / modifies

```
repo/packages/database/src/migrations/{date}-Sprint21-DevisExpertAssignment.ts  # ~30 lignes
repo/packages/repair/src/services/devis.service.ts                              # refonte send()
repo/packages/repair/src/services/devis.service.spec.ts                          # refonte tests
repo/packages/comm/src/templates/{fr,ar-MA,ar}/devis-envoye-expert.hbs            # 3 templates email
repo/packages/comm/src/templates/{fr,ar-MA,ar}/devis-recu-status.hbs              # 3 templates WhatsApp status
repo/packages/repair/src/jobs/devis-relances-cron.ts                              # update timing
```

---

## Tache 5.3.4 -- REFONDU : Workflow validation expert ligne par ligne + signature Barid

**Sprint** : 21 (Phase 5 / Sprint 3)
**Phase** : 5 -- Vertical Repair
**Priorite** : P0
**Effort** : 8h
**Dependances** : 5.3.3

### But (REFONDU v3.0)

**Workflow correct v3.0** : C'est l'EXPERT qui approuve ou rejete le devis (ligne par ligne). Pas le carrier directement. Apres validation expert, signature electronique Barid eSign (loi 43-20) puis soumission au carrier pour validation paiement.

### Refonte v2.2 -> v3.0

**v2.2 (FAUX)** : Assureur approuve devis avec conditions (franchise / exclusions / cap).
**v3.0 (CORRECT)** : Expert valide / modifie / rejete devis line-by-line. Carrier valide ensuite seulement le paiement (Tache 5.3.5).

### Livrables checkables

- [ ] Migration : table `repair_devis_expert_validations` :
  - id, devis_id (FK), expert_assignment_id (FK), expert_id (FK insure_experts), expert_user_id (FK auth_users)
  - decision text NOT NULL CHECK (decision IN ('validated', 'modified', 'rejected'))
  - decision_justification text NOT NULL
  - modifications jsonb (si decision='modified' : { lines_modified: [{line_id, old_amount, new_amount, reason}], total_before, total_after })
  - signature_id uuid (FK docs_signatures Sprint 10 -- Barid eSign)
  - signed_at timestamptz
  - submitted_to_carrier_at timestamptz
- [ ] Service `expert-validation.service.ts` (preview Sprint 22.7) :
  - `validateDevis(devisId, justification)` : decision='validated', emit event repair_devis.validated_by_expert
  - `modifyDevis(devisId, modifications)` : decision='modified', compute total_before/after, update devis lines, transition status quote_modified_by_expert
  - `rejectDevis(devisId, justification)` : decision='rejected', notify garage to revise + resubmit
  - `generateReport(devisId, validationId)` : react-pdf rapport expertise + upload Atlas Cloud Services
  - `signReport(validationId, expertUserId, otp)` : Barid eSign loi 43-20 (Sprint 10)
  - `submitToCarrier(validationId)` : after signed, notify carrier for payment approval
- [ ] Workflow status transitions v3.0 (cf. decision-013) :
  - `quote_sent_to_expert` -> `expertise_in_progress`
  - `expertise_in_progress` -> `quote_validated_by_expert` | `quote_modified_by_expert` | `quote_rejected_by_expert`
  - `quote_modified_by_expert` -> `quote_resubmitted` (garage accepte mods) -> `expertise_in_progress` (re-validation)
  - `quote_validated_by_expert` -> `payment_approval_pending` (Tache 5.3.5)
- [ ] Mock expert validation (Tache 5.3.11) : Sprint 22.7 reel via Expert App
- [ ] Permissions : expertise.validate_quote / modify_quote / reject_quote / report.create / report.sign
- [ ] Endpoint `POST /api/v1/repair/devis/:id/expert-validation` (utilise par Mock Tache 5.3.11 / Expert App Sprint 22.7)
- [ ] Tests 12+ scenarios

### Pattern critique : modifyDevis (line-by-line)

```typescript
import Decimal from 'decimal.js';

async modifyDevis(
  devisId: string,
  expertUserId: string,
  modifications: DevisModifications,
  justification: string
): Promise<DevisExpertValidation> {
  const devis = await this.devisRepo.findOneOrFail({ 
    where: { id: devisId }, 
    relations: ['lines', 'sinistre'] 
  });
  
  // Verify expert is assigned to this sinistre
  const assignment = await this.expertAssignmentsRepo.findOneOrFail({
    where: { 
      sinistre_id: devis.sinistre_id, 
      expert_user_id: expertUserId,
      status: In(['accepted', 'in_progress']) 
    }
  });
  
  // Validation : modifications schema
  const validated = DevisModificationsSchema.parse(modifications);
  
  // Compute totals
  const totalBefore = new Decimal(devis.total_ttc);
  let totalAfter = totalBefore;
  
  const linesModifiedDetails: LineModificationDetail[] = [];
  
  for (const mod of validated.lines_modified) {
    const line = devis.lines.find(l => l.id === mod.line_id);
    if (!line) throw new BadRequestException(`Line ${mod.line_id} not found in devis`);
    
    const oldAmount = new Decimal(line.total_ttc);
    const newAmount = new Decimal(mod.new_amount);
    
    // Sanity check : ne peut pas etre negatif
    if (newAmount.isNegative()) {
      throw new BadRequestException(`Line ${mod.line_id} new_amount cannot be negative`);
    }
    
    totalAfter = totalAfter.minus(oldAmount).plus(newAmount);
    
    linesModifiedDetails.push({
      line_id: mod.line_id,
      description: line.description,
      old_quantity: line.quantity,
      new_quantity: mod.new_quantity ?? line.quantity,
      old_unit_price: line.unit_price,
      new_unit_price: mod.new_unit_price ?? line.unit_price,
      old_total_ttc: oldAmount.toFixed(2),
      new_total_ttc: newAmount.toFixed(2),
      reason: mod.reason,
    });
    
    // Update devis line
    await this.repairDevisLinesRepo.update(mod.line_id, {
      quantity: mod.new_quantity ?? line.quantity,
      unit_price: mod.new_unit_price ?? line.unit_price,
      total_ttc: newAmount.toFixed(2),
      modified_by_expert_at: new Date(),
      modified_by_expert_id: expertUserId,
      modification_reason: mod.reason,
    });
  }
  
  // Update devis total
  await this.devisRepo.update(devis.id, {
    total_ttc: totalAfter.toFixed(2),
    total_ht: totalAfter.div(1.20).toFixed(2),
    total_tva: totalAfter.minus(totalAfter.div(1.20)).toFixed(2),
    modified_by_expert_at: new Date(),
    status: 'quote_modified_by_expert',
  });
  
  // Create validation record
  const validation = await this.validationsRepo.save({
    devis_id: devisId,
    expert_assignment_id: assignment.id,
    expert_id: assignment.expert_id,
    expert_user_id: expertUserId,
    decision: 'modified',
    decision_justification: justification,
    modifications: {
      lines_modified: linesModifiedDetails,
      total_before: totalBefore.toFixed(2),
      total_after: totalAfter.toFixed(2),
    },
  });
  
  // Update sinistre status
  await this.sinistresRepo.update(devis.sinistre_id, {
    status: 'quote_modified_by_expert',
  });
  
  // Emit Kafka event
  await this.kafkaProducer.emit('insurtech.events.repair.devis.modified_by_expert', {
    devis_id: devis.id,
    sinistre_id: devis.sinistre_id,
    validation_id: validation.id,
    total_before: totalBefore.toFixed(2),
    total_after: totalAfter.toFixed(2),
    modifications_count: linesModifiedDetails.length,
  });
  
  // Audit log
  await this.auditLogService.log({
    entity_type: 'repair_devis',
    entity_id: devis.id,
    action: 'modified_by_expert',
    actor_user_id: expertUserId,
    details: { 
      totalBefore: totalBefore.toFixed(2),
      totalAfter: totalAfter.toFixed(2),
      modifications: linesModifiedDetails,
    },
  });
  
  // Notify garage of modifications
  await this.notificationsService.notifyGarageDevisModifiedByExpert(
    devis.sinistre.garage_tenant_id, 
    devis.id,
    validation.id
  );
  
  return validation;
}
```

### Criteres validation V1-V12

| ID | Critere | Priorite |
|----|---------|----------|
| V1 | Migration table repair_devis_expert_validations | P0 |
| V2 | Service validate / modify / reject methods | P0 |
| V3 | Modify line-by-line avec decimal.js precision | P0 |
| V4 | Workflow status transitions v3.0 | P0 |
| V5 | Generate rapport PDF react-pdf | P0 |
| V6 | Signature Barid eSign loi 43-20 | P0 |
| V7 | Submit to carrier apres signed | P0 |
| V8 | Notifications garage des modifications | P0 |
| V9 | Permissions expertise enforces | P0 |
| V10 | Events Kafka emits | P0 |
| V11 | Audit log toutes operations | P0 |
| V12 | Tests 12+ scenarios PASS | P0 |

### Fichiers crees / modifies

```
repo/packages/database/src/migrations/{date}-Sprint21-DevisExpertValidations.ts # ~50 lignes
repo/packages/repair/src/entities/repair-devis-expert-validation.entity.ts        # ~60 lignes
repo/packages/expertise/src/services/expert-validation.service.ts                  # ~400 lignes (preview Sprint 22.7)
repo/packages/expertise/src/services/expert-validation.service.spec.ts             # ~300 lignes (tests)
repo/packages/docs/src/templates/{fr,ar-MA,ar}/rapport-expertise.hbs                # 3 templates
repo/apps/api/src/modules/repair/controllers/expert-validations.controller.ts        # ~150 lignes
```

---

## Tache 5.3.5 -- REFONDU : Approbation paiement carrier (mock Sprint 21 / reel Sprint 26.5)

**Sprint** : 21 (Phase 5 / Sprint 3)
**Phase** : 5 -- Vertical Repair
**Priorite** : P0
**Effort** : 5h
**Dependances** : 5.3.4

### But (REFONDU v3.0)

**Workflow correct v3.0** : Apres validation expert (Tache 5.3.4), le rapport expertise + devis valide est soumis au CARRIER pour validation paiement. Carrier valide seulement le paiement (pas le devis -- l'expert l'a deja fait).

### Refonte v2.2 -> v3.0

**v2.2 (FAUX)** : "Approbation tracking : conditions assureur (franchise/exclusions/cap) + extensions avenants"
**v3.0 (CORRECT)** : "Workflow validation paiement carrier multi-niveau (mock Sprint 21 / reel Sprint 26.5)" -- l'approbation business du devis est faite par l'EXPERT (Tache 5.3.4), le carrier valide juste le paiement.

### Livrables checkables

- [ ] Migration : table `repair_devis_carrier_approvals` :
  - id, devis_id (FK), validation_id (FK repair_devis_expert_validations)
  - carrier_tenant_id (FK), payment_approval_id (FK carrier_payment_approvals Sprint 26.5)
  - amount_mad numeric NOT NULL
  - status : pending / approved / rejected / paid
  - approved_at / rejected_at / paid_at
  - rejection_reason text
- [ ] Service `carrier-payment-approval.service.ts` (preview Sprint 26.5) :
  - `requestApproval(devisId)` : after expert validation signed -> create carrier_payment_approval (Sprint 26.5 entity)
  - `simulateMockApproval(approvalId)` : mock Sprint 21 (delai 1-3 jours, 10% rejection rate)
  - Real implementation Sprint 26.5 Carrier Portal (multi-niveau 4 paliers)
- [ ] Workflow status :
  - `quote_validated_by_expert` -> `payment_approval_pending`
  - `payment_approval_pending` -> `payment_approved_by_carrier` | `payment_rejected_by_carrier`
  - `payment_approved_by_carrier` -> `reparation_started`
  - `payment_rejected_by_carrier` -> escalade dispute + notification expert + garage
- [ ] Mock realistic Sprint 21 :
  - Cron `mock-carrier-payment-approvals.cron.ts`
  - Variables env : `MOCK_CARRIER_APPROVAL_DELAY_MIN_HOURS=24` (vs v2.2 1-3 jours), `MAX_HOURS=72`, `MOCK_REJECTION_RATE=0.05` (5% rejet vs 10% v2.2 -- experts ont deja filtrer)
- [ ] Sprint 26.5 : workflow approval multi-niveau 4 paliers (L1<5k / L2 5k-20k / L3 20k-100k / L4 >100k)
- [ ] Endpoints : `POST /api/v1/repair/devis/:id/request-carrier-payment-approval` + webhook recevant approval/rejection
- [ ] Tests 8+ scenarios

### Criteres validation V1-V8

| ID | Critere | Priorite |
|----|---------|----------|
| V1 | Migration table repair_devis_carrier_approvals | P0 |
| V2 | Service requestApproval apres expert validation | P0 |
| V3 | Mock carrier approval realistic | P0 |
| V4 | Status transitions correct | P0 |
| V5 | Sprint 26.5 reel preview integration | P0 |
| V6 | Rejection workflow + escalade | P0 |
| V7 | Notifications garage + expert | P0 |
| V8 | Tests 8+ scenarios PASS | P0 |

### Fichiers crees / modifies

```
repo/packages/database/src/migrations/{date}-Sprint21-CarrierApprovals.ts          # ~40 lignes
repo/packages/repair/src/services/carrier-payment-approval.service.ts                 # ~250 lignes
repo/packages/repair/src/jobs/mock-carrier-payment-approvals.cron.ts                    # ~150 lignes
repo/docs/carrier-portal-integration-migration-sprint-26.5.md                            # ~100 lignes
```

---

## Tache 5.3.6 -- Reparation Tracking Real-Time (inchange v2.2)

**Sprint** : 21 (Phase 5 / Sprint 3)
**Phase** : 5 -- Vertical Repair
**Priorite** : P0
**Effort** : 6h
**Dependances** : 5.3.5

### But

Tracking advanced reparation : % completion + parts arrived (incl. PartsHub Tache 5.3.16) + technicien hours en temps reel.

### Status v2.2 -> v3.0

**INCHANGE** -- la seule difference est que `parts_arrival_status` integre maintenant les pieces PartsHub (Sprint 21 Tache 5.3.16) en plus du stock interne.

### Livrables checkables

- [ ] Update Sprint 19 `repair_orders` entity : completion_percentage, parts_arrival_status jsonb, last_status_update
- [ ] **v3.0** : `parts_arrival_status` peut etre source 'internal_stock' (Sprint 13) OR 'partshub_supplier' (Tache 5.3.16)
- [ ] Service `orders-tracking.service.ts` : updateCompletion / markPartArrived / recordHoursWorked
- [ ] Real-time updates via Kafka + Sprint 18 mobile assure poll status
- [ ] Notifications customer : milestones (50% / 100% / ready for delivery)
- [ ] Endpoints REST
- [ ] Tests

### Criteres validation V1-V5

| ID | Critere | Priorite |
|----|---------|----------|
| V1 | Update completion percentage | P0 |
| V2 | Parts arrived (internal + PartsHub) | P0 |
| V3 | Hours worked HR integration | P0 |
| V4 | Notifications milestones | P0 |
| V5 | Tests 8+ scenarios | P0 |

---

## Tache 5.3.7 -- QC + Livraison (inchange v2.2)

**Sprint** : 21 (Phase 5 / Sprint 3)
**Phase** : 5 -- Vertical Repair
**Priorite** : P0
**Effort** : 6h
**Dependances** : 5.3.6

### But

Workflow Quality Check + livraison vehicule : checklist 10 points + signature reception customer + photos final.

### Status v2.2 -> v3.0

**INCHANGE** -- workflow QC + livraison reste identique.

### Livrables checkables

- [ ] Migration : table `repair_qc_checks` (10 points + photos final + signature)
- [ ] Service `qc-checks.service.ts` : inspect / pass / fail (escalade) / photos
- [ ] Workflow QC failed : retour reparation + notification chef garage
- [ ] Service `deliveries.service.ts` : schedule / execute / signature customer / photos final
- [ ] Signature reception customer via Barid eSign (Sprint 10)
- [ ] Endpoints REST
- [ ] Tests 8+ scenarios

### Criteres validation V1-V6

| ID | Critere | Priorite |
|----|---------|----------|
| V1 | QC checklist 10 points | P0 |
| V2 | Pass / fail / escalade workflow | P0 |
| V3 | Photos final + signature customer | P0 |
| V4 | Status transition delivered | P0 |
| V5 | Tests 8+ scenarios | P0 |

---

## Tache 5.3.8 -- REFONDU : Facturation v3.0 (carrier->garage direct 90% cas)

**Sprint** : 21 (Phase 5 / Sprint 3)
**Phase** : 5 -- Vertical Repair
**Priorite** : P0
**Effort** : 5h
**Dependances** : 5.3.7

### But (REFONDU v3.0)

**Realite terrain v3.0** (correction Saad 6 + 7) : Dans le circuit garage agree (90% cas), c'est le GARAGE qui avance les fonds et qui facture directement le CARRIER apres paiement. Le client paye seulement sa franchise (montant minime) directement au garage. PAS de split facturation complexe v2.2.

### Refonte v2.2 -> v3.0

**v2.2 (FAUX)** : Split intelligent facturation assureur 60% + customer 40% avec decimal.js + 12 tests scenarios edge cases.

**v3.0 (CORRECT)** :
- **90% cas (circuit garage agree)** : garage avance fonds. Facturation simple :
  - Facture 1 (carrier) : montant total devis valide expert (carrier paye garage 7 jours via Sprint 26.5)
  - Facture 2 (customer franchise) : montant franchise SI > 0 (souvent minime, e.g. 500-1500 MAD)
- **10% cas (garage non agree ou sinistre hors couverture)** : garage facture customer total (workflow simplifie similar v2.2)

### Livrables checkables

- [ ] Migration : ajouter colonnes `repair_invoices.invoice_circuit_type` (TEXT CHECK 'agreed_garage' | 'non_agreed' | 'no_coverage')
- [ ] Service `invoices.service.ts` refonte v3.0 :
  - `generateInvoicesV3(orderId)` : determine circuit selon expert validation + police
  - Cas `agreed_garage` : Facture 1 (carrier) + Facture 2 (customer franchise) si > 0
  - Cas `non_agreed` ou `no_coverage` : Facture 1 (customer total)
- [ ] decimal.js precision conservee (cas franchise + cas customer full)
- [ ] Workflow paiement carrier : Sprint 11 Pay declenche apres `payment_approved_by_carrier` (Tache 5.3.5)
- [ ] Endpoints REST
- [ ] Tests 10+ scenarios (vs 12 v2.2 -- simplifie car 90% cas trivial)

### Pattern critique : generateInvoicesV3

```typescript
async generateInvoicesV3(orderId: string): Promise<Invoice[]> {
  const order = await this.ordersRepo.findOneOrFail({
    where: { id: orderId },
    relations: ['sinistre', 'sinistre.policy', 'devis', 'devis.expert_validation']
  });
  
  // Determine circuit type
  let circuitType: 'agreed_garage' | 'non_agreed' | 'no_coverage';
  
  if (!order.sinistre.insure_policy_id) {
    circuitType = 'no_coverage';
  } else if (this.isAgreedGarage(order.sinistre.garage_tenant_id, order.sinistre.policy.carrier_tenant_id)) {
    circuitType = 'agreed_garage';
  } else {
    circuitType = 'non_agreed';
  }
  
  const invoices: Invoice[] = [];
  const totalAmount = new Decimal(order.devis.total_ttc);
  
  if (circuitType === 'agreed_garage') {
    // 90% cas : garage avance fonds, carrier paye garage, customer paye franchise
    const franchise = new Decimal(order.sinistre.policy.franchise_amount_mad ?? 0);
    
    // Facture 1 : carrier
    const carrierAmount = totalAmount.minus(franchise);
    if (carrierAmount.gt(0)) {
      const carrierInvoice = await this.createInvoice({
        sinistre_id: order.sinistre_id,
        order_id: orderId,
        recipient_type: 'carrier',
        recipient_tenant_id: order.sinistre.policy.carrier_tenant_id,
        total_ttc: carrierAmount.toFixed(2),
        total_ht: carrierAmount.div(1.20).toFixed(2),
        total_tva: carrierAmount.minus(carrierAmount.div(1.20)).toFixed(2),
        invoice_circuit_type: 'agreed_garage',
        payment_due_days: 7,  // Sprint 26.5 carrier paye 7 jours
      });
      invoices.push(carrierInvoice);
    }
    
    // Facture 2 : customer franchise (si > 0)
    if (franchise.gt(0)) {
      const customerInvoice = await this.createInvoice({
        sinistre_id: order.sinistre_id,
        order_id: orderId,
        recipient_type: 'customer',
        recipient_data: this.getCustomerData(order.sinistre),
        total_ttc: franchise.toFixed(2),
        total_ht: franchise.div(1.20).toFixed(2),
        total_tva: franchise.minus(franchise.div(1.20)).toFixed(2),
        invoice_circuit_type: 'agreed_garage',
        payment_due_days: 0,  // immediat livraison
      });
      invoices.push(customerInvoice);
    }
  } else if (circuitType === 'non_agreed' || circuitType === 'no_coverage') {
    // 10% cas : customer paye total (puis se fait rembourser par carrier separement)
    const customerInvoice = await this.createInvoice({
      sinistre_id: order.sinistre_id,
      order_id: orderId,
      recipient_type: 'customer',
      recipient_data: this.getCustomerData(order.sinistre),
      total_ttc: totalAmount.toFixed(2),
      total_ht: totalAmount.div(1.20).toFixed(2),
      total_tva: totalAmount.minus(totalAmount.div(1.20)).toFixed(2),
      invoice_circuit_type: circuitType,
      payment_due_days: 0,
    });
    invoices.push(customerInvoice);
  }
  
  return invoices;
}
```

### Criteres validation V1-V10

| ID | Critere | Priorite |
|----|---------|----------|
| V1 | Migration invoice_circuit_type | P0 |
| V2 | Service refonte v3.0 | P0 |
| V3 | Cas agreed_garage : 2 invoices (carrier + franchise) | P0 |
| V4 | Cas no_coverage : 1 invoice customer | P0 |
| V5 | Franchise = 0 : skip customer invoice | P0 |
| V6 | decimal.js precision | P0 |
| V7 | payment_due_days 7 (carrier) vs 0 (customer) | P0 |
| V8 | Workflow paiement carrier Sprint 11 | P0 |
| V9 | Tests 10+ scenarios PASS | P0 |
| V10 | Conforme correction Saad terrain 6 + 7 | P0 |

### Fichiers crees / modifies

```
repo/packages/database/src/migrations/{date}-Sprint21-InvoiceCircuitType.ts      # ~20 lignes
repo/packages/repair/src/services/invoices.service.ts                            # refonte v3.0
repo/packages/repair/src/services/invoices.service.spec.ts                        # refonte tests
```

---

## Tache 5.3.9 -- Documents Auto-Generes (enrichi v3.0)

**Sprint** : 21 (Phase 5 / Sprint 3)
**Phase** : 5 -- Vertical Repair
**Priorite** : P0
**Effort** : 6h
**Dependances** : 5.3.8

### But

Auto-generation documents officiels chaque etape + **rapport expertise expert avec signature Barid eSign**.

### Status v2.2 -> v3.0

**ENRICHI** -- nouveau document : `rapport-expertise.hbs` (Tache 5.3.4) avec signature Barid eSign loi 43-20.

### Livrables checkables

- [ ] Documents auto-generes (utilise Sprint 10) :
  - Bon reception (reception complete)
  - Rapport diagnostic Sky AI (diagnostic complete)
  - Devis (Sprint 19)
  - **Rapport expertise expert** (Tache 5.3.4 -- NOUVEAU v3.0)
  - Approbation devis expert (validation expert -- enrichi v3.0)
  - Bon livraison (delivery)
  - Facture(s) (Tache 5.3.8 v3.0 -- carrier OR customer franchise)
  - Certificat conformite reparation
- [ ] Templates 3 locales chacun
- [ ] Auto-attach a sinistre + envoi destinataires
- [ ] Archive 10 ans (loi 43-20)
- [ ] Tests 8+ scenarios

### Criteres validation V1-V5

| ID | Critere | Priorite |
|----|---------|----------|
| V1 | 7 documents auto-generes (+ rapport expertise) | P0 |
| V2 | Templates 3 locales | P0 |
| V3 | Auto-attach sinistre | P0 |
| V4 | Archive 10 ans | P0 |
| V5 | Tests 8+ scenarios | P0 |

---

## Tache 5.3.10 -- Notifications Real-Time (enrichi v3.0 -- WhatsApp scope strict)

**Sprint** : 21 (Phase 5 / Sprint 3)
**Phase** : 5 -- Vertical Repair
**Priorite** : P0
**Effort** : 5h
**Dependances** : 5.3.9

### But

Notifications real-time chaque etape sinistre + **WhatsApp = STATUS SEULEMENT** (correction Saad 7).

### Status v2.2 -> v3.0

**ENRICHI** -- WhatsApp scope strict applique. JAMAIS de data sensible (montants, devis, info personnel) sur WhatsApp. Email + app pour data sensible.

### Livrables checkables

- [ ] Templates Comm Sprint 9 :
  - `repair-vehicle-received.hbs` (customer + carrier in CC)
  - `repair-diagnostic-completed.hbs` (expert si designe + carrier in CC)
  - `repair-devis-sent-to-expert.hbs` (expert main + carrier CC + customer COPY)
  - `repair-expert-validation-completed.hbs` (carrier main + garage CC + customer COPY)
  - `repair-payment-approved-by-carrier.hbs` (garage main + customer COPY)
  - `repair-progress-25/50/75/100.hbs` (customer + garage)
  - `repair-ready-for-delivery.hbs` (customer)
  - `repair-delivered.hbs` (customer + carrier + expert)
  - `repair-warranty-active.hbs` (customer)
- [ ] Channels per notification :
  - Email : tous evenements avec data complete
  - **WhatsApp : SEULEMENT status notifications (e.g. "Votre vehicule est pret a la livraison")** -- PAS de montants/data sensible
  - Push PWA : milestones + ready
- [ ] Locale customer.preferred_language Sprint 8
- [ ] Tests integration

### Pattern critique : WhatsApp status only

```typescript
// repo/packages/comm/src/services/whatsapp.service.ts (extension)

/**
 * WhatsApp pour notifications STATUS UNIQUEMENT.
 * PAS de data sensible (montants, devis, info personnel).
 * Decision Saad correction terrain 7 :
 *   "WhatsApp = notifications status seulement, JAMAIS données sensibles 
 *    (email + app pour ça)"
 */
async sendWhatsAppStatus(input: {
  to: string;
  locale: 'fr' | 'ar-MA' | 'ar';
  template: WhatsAppStatusTemplate;  // typed union of allowed templates
  data: Record<string, unknown>;
}): Promise<void> {
  // Validation : verifier que template est de type 'status' uniquement
  if (!STATUS_ONLY_TEMPLATES.includes(input.template)) {
    throw new BadRequestException(
      `Template ${input.template} contains sensitive data. Use email instead. (CNDP loi 09-08)`
    );
  }
  
  // Validation : verifier que data ne contient pas de fields blacklisted
  const blacklistedFields = ['amount', 'price', 'total_mad', 'franchise', 'devis_total', 'cin', 'password', 'token'];
  for (const field of Object.keys(input.data)) {
    if (blacklistedFields.some(blocked => field.toLowerCase().includes(blocked))) {
      throw new BadRequestException(
        `Field "${field}" cannot be sent via WhatsApp (sensitive data). Use email instead.`
      );
    }
  }
  
  // Send via Twilio / Meta WhatsApp Business API
  await this.twilioClient.messages.create({
    to: `whatsapp:${input.to}`,
    from: process.env.TWILIO_WA_FROM,
    body: this.renderTemplate(input.template, input.locale, input.data),
  });
  
  // Audit log
  await this.auditLogService.log({
    entity_type: 'whatsapp_status_notification',
    action: 'sent',
    details: { 
      template: input.template, 
      to_redacted: this.redactPhone(input.to)  // PII redaction
    },
  });
}

// Liste templates STATUS ONLY autorises (whitelist)
const STATUS_ONLY_TEMPLATES = [
  'devis-recu-status',
  'repair-progress-status',
  'ready-for-delivery-status',
  'delivered-status',
  'tow-dispatch-status',
  'tow-arrived-status',
  'expert-visit-scheduled-status',
] as const;
type WhatsAppStatusTemplate = typeof STATUS_ONLY_TEMPLATES[number];
```

### Criteres validation V1-V6

| ID | Critere | Priorite |
|----|---------|----------|
| V1 | 9 templates locales 3 langues | P0 |
| V2 | Auto-trigger events Kafka | P0 |
| V3 | WhatsApp = status only (whitelist enforced) | P0 |
| V4 | Data sensible bloque WhatsApp (BadRequest) | P0 |
| V5 | Email = data complete | P0 |
| V6 | Tests 10+ scenarios | P0 |

---

## Tache 5.3.11 -- REFONDU : Mock expert visite + Mock carrier paiement

**Sprint** : 21 (Phase 5 / Sprint 3)
**Phase** : 5 -- Vertical Repair
**Priorite** : P0
**Effort** : 5h
**Dependances** : 5.3.10

### But (REFONDU v3.0)

Mock services simulant : **(1) visite expert + validation devis** (Sprint 22.7 Expert App reel) + **(2) carrier paiement approval** (Sprint 26.5 Carrier Portal reel). 

### Refonte v2.2 -> v3.0

**v2.2 (FAUX)** : Mock service single = "mock assureur" simulant approval/rejection devis avec conditions (franchise/exclusions/cap).

**v3.0 (CORRECT)** : 2 mocks distincts :
1. **MockExpertService** : simule visite garage 24-48h + validation/modification/rejet devis line-by-line + signature Barid (Sprint 22.7 reel via Expert App)
2. **MockCarrierPaymentService** : simule approval paiement multi-niveau apres validation expert (Sprint 26.5 reel via Carrier Portal)

### Livrables checkables

- [ ] Service `mock-expert-visit.service.ts` :
  - `simulateExpertVisit(devisId)` -- schedule visite apres delai 24-48h
  - `simulateExpertDecision(devisId)` -- random decision (70% validated / 20% modified / 10% rejected)
  - Si validated : trigger validation Tache 5.3.4 avec justification mock
  - Si modified : random 1-3 lignes modifiees avec reductions 5-20%
  - Si rejected : random reason from realistic list
  - Sign report mock (signature_id mock + signed_at)
- [ ] Service `mock-carrier-payment.service.ts` :
  - `simulateCarrierPaymentApproval(devisId)` -- triggered after expert validation signed
  - Determine level requis selon montant (L1 / L2 / L3 / L4)
  - Random outcome : 90% approved / 5% rejected / 5% pending escalation
  - Si approved : update repair_devis_carrier_approvals.status='approved' + trigger Sprint 11 pay
- [ ] Cron `mock-expert-carrier-callbacks.cron.ts` :
  - Variables env : `MOCK_EXPERT_VISIT_DELAY_HOURS=24-48`, `MOCK_CARRIER_APPROVAL_DELAY_HOURS=24-72`
  - Variables : `MOCK_EXPERT_REJECTION_RATE=0.10`, `MOCK_CARRIER_REJECTION_RATE=0.05`
- [ ] Sprint 22.7 reel : MockExpertService swap par real Expert App + endpoints
- [ ] Sprint 26.5 reel : MockCarrierPaymentService swap par real Carrier Portal multi-niveau
- [ ] Documentation pattern swap
- [ ] Tests 8+ scenarios

### Criteres validation V1-V8

| ID | Critere | Priorite |
|----|---------|----------|
| V1 | Mock expert visite scheduled | P0 |
| V2 | Mock expert decision realistic (70/20/10) | P0 |
| V3 | Mock carrier payment approval | P0 |
| V4 | Determine level requis multi-niveau | P0 |
| V5 | Cron declenche callbacks | P0 |
| V6 | Documentation pattern swap Sprint 22.7 + 26.5 | P0 |
| V7 | Tests 8+ scenarios | P0 |
| V8 | Pattern DI swap clean | P0 |

### Fichiers crees / modifies

```
repo/packages/repair/src/services/mock-expert-visit.service.ts                     # ~250 lignes
repo/packages/repair/src/services/mock-carrier-payment.service.ts                   # ~200 lignes
repo/packages/repair/src/jobs/mock-expert-carrier-callbacks.cron.ts                  # ~150 lignes
repo/docs/expert-app-integration-migration-sprint-22.7.md                              # ~100 lignes
repo/docs/carrier-portal-integration-migration-sprint-26.5.md                          # ~100 lignes
```

---

## Tache 5.3.12 -- Garantie Tracking + Reclamations (inchange v2.2)

**Sprint** : 21 (Phase 5 / Sprint 3)
**Phase** : 5 -- Vertical Repair
**Priorite** : P0
**Effort** : 5h
**Dependances** : 5.3.11

### But

Workflow garantie post-livraison enrichi : tracking expiration + reclamations + intervention curative gratuite.

### Status v2.2 -> v3.0

**INCHANGE** -- workflow garantie reste identique.

### Livrables checkables

Voir B-21 v2.2 Tache 5.3.11 (preserved -- juste renumeree).

---

## Tache 5.3.13 -- Endpoints REST + Permissions (etendu v3.0)

**Sprint** : 21 (Phase 5 / Sprint 3)
**Phase** : 5 -- Vertical Repair
**Priorite** : P0
**Effort** : 4h
**Dependances** : 5.3.12

### But

Consolidation endpoints REST + permissions enrichies (incluant expertise + parts).

### Status v2.2 -> v3.0

**ETENDU** -- 15 permissions v2.2 + ~17 nouvelles permissions (expertise 10 + parts 7) = 32 perms ajoutees Sprint 7.5a (decision-013 + 014).

### Livrables checkables

- [ ] Endpoints consolides taches precedentes
- [ ] Permissions ajoutees catalog Sprint 7.5a :
  - `repair.receptions.start/complete`
  - `repair.qc_checks.inspect`
  - `repair.deliveries.execute`
  - `repair.invoices.split` (renomme `repair.invoices.generate_v3`)
  - `repair.warranty_claims.submit/process`
  - **`expertise.validate_quote/modify_quote/reject_quote/report.sign`** (NOUVEAU)
  - **`parts.suppliers.*` + `parts.orders.*` + `parts.commission.view`** (NOUVEAU)
- [ ] PermissionsMatrix mise a jour (Sprint 7.5a + Sprint 7)
- [ ] Tests permissions

### Criteres validation V1-V3

| ID | Critere | Priorite |
|----|---------|----------|
| V1 | 32+ permissions Sprint 21 ajoutees | P0 |
| V2 | Roles enrichis (garage + expert + parts_manager) | P0 |
| V3 | Tests RBAC 10+ scenarios | P0 |

---

# NOUVELLES TACHES PARTSHUB PHASE 1

---

## Tache 5.3.14 -- NOUVEAU PartsHub : Catalog fournisseurs + onboarding KYB

**Sprint** : 21 (Phase 5 / Sprint 3)
**Phase** : 5 -- Vertical Repair
**Priorite** : P0
**Effort** : 6h
**Dependances** : 5.3.13

### But

Implementer le **catalog fournisseurs pieces** + workflow onboarding KYB + favorites garage. Module integre dans Assurflow Garage (decision-014).

### Livrables checkables

- [ ] Migration : 4 tables PartsHub (decision-014) :
  - `parts_suppliers` : id, tenant_id (garage owner), supplier_name, address, geoloc, contact, kyb_documents, commission_rate, status, onboarded_at
  - `parts_supplier_catalog` : id, supplier_id (FK), part_reference, part_name, brand, vehicle_models[], price_ht, price_ttc, stock_available, delivery_time_days
  - `parts_suppliers_favorites` : id, garage_tenant_id, supplier_id (FK), added_at (favorites garage)
- [ ] RLS active sur 3 tables (tenant-scoped)
- [ ] Service `parts-suppliers.service.ts` :
  - `onboardSupplier(input)` : create supplier with KYB documents
  - `approveKyb(supplierId)` : admin/garage_parts_manager validates
  - `rejectKyb(supplierId, reason)`
  - `searchCatalog(partReference, vehicleModel, garageGeoloc, radius)` : search avec geo proximity + filtres
  - `addToFavorites(supplierId, garageTenantId)`
  - `listFavorites(garageTenantId)`
- [ ] Endpoints REST :
  - `POST /api/v1/parts/suppliers/onboard`
  - `GET /api/v1/parts/suppliers/search`
  - `POST /api/v1/parts/suppliers/:id/approve-kyb`
  - `POST /api/v1/parts/suppliers/:id/add-to-favorites`
- [ ] Permissions : `parts.suppliers.read/add_to_favorites`
- [ ] Tests 15+ scenarios

### Criteres validation V1-V8

| ID | Critere | Priorite |
|----|---------|----------|
| V1 | Migration 3 tables PartsHub | P0 |
| V2 | RLS active + tenant isolation | P0 |
| V3 | Onboarding KYB workflow | P0 |
| V4 | Search catalog avec geo + filtres | P0 |
| V5 | Favorites garage | P0 |
| V6 | Endpoints REST 4+ | P0 |
| V7 | Permissions enforces | P0 |
| V8 | Tests 15+ scenarios PASS | P0 |

---

## Tache 5.3.15 -- NOUVEAU PartsHub : Commande automatique fournisseur

**Sprint** : 21 (Phase 5 / Sprint 3)
**Phase** : 5 -- Vertical Repair
**Priorite** : P0
**Effort** : 5h
**Dependances** : 5.3.14

### But

Workflow commande automatique fournisseur : garage clique "Commander" dans app -> commande envoyee fournisseur via API + email backup.

### Livrables checkables

- [ ] Migration : table `parts_orders` :
  - id, tenant_id (garage), supplier_id (FK), sinistre_id (FK), repair_order_id (FK), part_ref, part_name, quantity, unit_price_ttc, total_amount_ttc, status, commission_amount_ttc, payment_status, created_at, expected_delivery_date
- [ ] Service `parts-orders.service.ts` :
  - `createOrder(input)` : 1-click order avec computed commission
  - `sendToSupplier(orderId)` : API call fournisseur + email backup
  - `cancelOrder(orderId, reason)` : cancel within window (e.g. 1h)
  - `updateStatus(orderId, status)` : status workflow
- [ ] Workflow status : `draft` -> `sent_to_supplier` -> `accepted_by_supplier` -> `in_transit` -> `delivered_at_garage` -> `received_in_stock` OR `cancelled`
- [ ] Cross-tenant : `garage_to_parts_supplier_order` (NOUVEAU type, ou utiliser supplier comme tenant)
- [ ] Notification fournisseur via email + (futur API webhook)
- [ ] Permission `parts.orders.create/read/cancel`
- [ ] Tests 12+ scenarios

### Criteres validation V1-V7

| ID | Critere | Priorite |
|----|---------|----------|
| V1 | Migration table parts_orders | P0 |
| V2 | Service createOrder 1-click | P0 |
| V3 | Send to supplier API + email | P0 |
| V4 | Cancel within window | P0 |
| V5 | Workflow status transitions | P0 |
| V6 | Permissions enforces | P0 |
| V7 | Tests 12+ scenarios PASS | P0 |

---

## Tache 5.3.16 -- NOUVEAU PartsHub : Tracking livraison + receive

**Sprint** : 21 (Phase 5 / Sprint 3)
**Phase** : 5 -- Vertical Repair
**Priorite** : P0
**Effort** : 4h
**Dependances** : 5.3.15

### But

Tracking livraison real-time + workflow receive piece au garage + integration stock interne (Sprint 13).

### Livrables checkables

- [ ] Service `parts-orders-tracking.service.ts` :
  - `updateDeliveryStatus(orderId, status, location)` : update tracking + notify garage
  - `markDelivered(orderId, deliveryProofUrl)` : photo proof + signature livreur
  - `receiveInStock(orderId, technicianId)` : transfer to stock interne (Sprint 13)
  - `reportDamaged(orderId, photos, description)` : rejection + retour fournisseur
- [ ] Integration Sprint 13 stock : commande PartsHub livree -> auto-import stock_items
- [ ] Integration Tache 5.3.6 : `parts_arrival_status` update avec source='partshub_supplier'
- [ ] Notifications garage : livraison en cours + arrivee
- [ ] Endpoints REST
- [ ] Tests 10+ scenarios

### Criteres validation V1-V6

| ID | Critere | Priorite |
|----|---------|----------|
| V1 | Update delivery status | P0 |
| V2 | Mark delivered avec proof | P0 |
| V3 | Receive in stock integration Sprint 13 | P0 |
| V4 | Report damaged workflow | P0 |
| V5 | Notifications garage | P0 |
| V6 | Tests 10+ scenarios PASS | P0 |

---

## Tache 5.3.17 -- NOUVEAU PartsHub : Paiement fournisseurs (Sprint 11)

**Sprint** : 21 (Phase 5 / Sprint 3)
**Phase** : 5 -- Vertical Repair
**Priorite** : P0
**Effort** : 5h
**Dependances** : 5.3.16

### But

Integration Sprint 11 Pay pour paiement fournisseurs via passerelles MA (CMI / YouCan / virement bancaire / Mobile Money).

### Livrables checkables

- [ ] Service `parts-payments.service.ts` :
  - `payOrder(orderId, gateway)` : create transaction Sprint 11
  - `confirmPayment(orderId, transactionId)` : update parts_orders.payment_status
  - `refundOrder(orderId, reason)` : Sprint 11 refund
- [ ] Variables passerelles per fournisseur (KYB onboarding info : RIB / wallet number)
- [ ] Workflow paiement : `parts_received` -> `payment_initiated` -> `payment_completed` (via Sprint 11 webhook)
- [ ] Commission Assurflow deduite AUTOMATIQUEMENT lors du paiement :
  - Montant total order = X
  - Commission Assurflow = X * (commission_rate / 100) (default 4%)
  - Montant verse fournisseur = X - commission
- [ ] Endpoints REST
- [ ] Tests 10+ scenarios

### Pattern critique : commission auto deduite

```typescript
async payOrder(orderId: string, gateway: PaymentGatewayType): Promise<PaymentTransaction> {
  const order = await this.ordersRepo.findOneOrFail({
    where: { id: orderId },
    relations: ['supplier']
  });
  
  if (order.status !== 'received_in_stock') {
    throw new BadRequestException('Order must be received_in_stock before payment');
  }
  
  // Compute commission Assurflow
  const totalAmount = new Decimal(order.total_amount_ttc);
  const commissionRate = new Decimal(order.supplier.commission_rate ?? 4);  // default 4%
  const commissionAmount = totalAmount.times(commissionRate).dividedBy(100);
  const supplierAmount = totalAmount.minus(commissionAmount);
  
  // Create payment transaction Sprint 11
  const transaction = await this.payService.createPayment({
    from_tenant_id: order.tenant_id,
    to_tenant_id: null,  // pas un tenant Assurflow, supplier externe
    to_external_account: order.supplier.bank_account_info,  // RIB ou wallet
    amount_mad: supplierAmount.toFixed(2),
    reference: `PartsHub Order ${order.id} -- Sinistre ${order.sinistre_id}`,
    gateway,
    metadata: {
      partshub_order_id: order.id,
      commission_assurflow: commissionAmount.toFixed(2),
      total_order: totalAmount.toFixed(2),
    },
  });
  
  // Log commission tracking
  await this.commissionLogRepo.save({
    order_id: order.id,
    supplier_id: order.supplier_id,
    commission_rate: commissionRate.toNumber(),
    commission_amount_ttc: commissionAmount.toFixed(2),
    total_order_amount_ttc: totalAmount.toFixed(2),
    supplier_amount_ttc: supplierAmount.toFixed(2),
    payment_transaction_id: transaction.id,
  });
  
  // Update order
  await this.ordersRepo.update(orderId, {
    payment_status: 'initiated',
    payment_transaction_id: transaction.id,
    commission_amount_ttc: commissionAmount.toFixed(2),
  });
  
  return transaction;
}
```

### Criteres validation V1-V6

| ID | Critere | Priorite |
|----|---------|----------|
| V1 | Service payOrder fonctionnel | P0 |
| V2 | Commission auto deduite (decimal.js) | P0 |
| V3 | Integration Sprint 11 passerelles | P0 |
| V4 | Log commission tracking | P0 |
| V5 | Webhook confirmPayment | P0 |
| V6 | Tests 10+ scenarios PASS | P0 |

---

## Tache 5.3.18 -- NOUVEAU PartsHub : Commission tracking + dashboard Assurflow

**Sprint** : 21 (Phase 5 / Sprint 3)
**Phase** : 5 -- Vertical Repair
**Priorite** : P0
**Effort** : 5h
**Dependances** : 5.3.17

### But

Tracking commission Assurflow + dashboard pour garage_parts_manager + admin Assurflow.

### Livrables checkables

- [ ] Migration : table `parts_commission_log` (cree Tache 5.3.17, schema complete) :
  - id, order_id, supplier_id, commission_rate, commission_amount_ttc, total_order_amount_ttc, supplier_amount_ttc, payment_transaction_id, payable_to_assurflow_at, paid_to_assurflow_at
- [ ] Service `parts-commission.service.ts` :
  - `computeCommissionStats(period)` : aggregations par garage / supplier / month
  - `listPendingCommissions()` : pour Assurflow finance reception
  - `markCommissionPaid(commissionLogId, transactionId)` : Assurflow recevoit la commission
- [ ] Dashboard `/api/v1/parts/commission/stats` :
  - Total commission Assurflow par period (day/week/month)
  - Top 10 garages par volume
  - Top 10 suppliers par volume
- [ ] Dashboard `/api/v1/parts/garage-stats` (garage_parts_manager) :
  - Total orders par period
  - Top suppliers utilises
  - Average delivery time
  - Commission payee Assurflow
- [ ] Permission `parts.commission.view_dashboard`
- [ ] Tests 10+ scenarios

### Criteres validation V1-V6

| ID | Critere | Priorite |
|----|---------|----------|
| V1 | Migration commission_log complete | P0 |
| V2 | Service stats per period | P0 |
| V3 | Dashboard Assurflow admin | P0 |
| V4 | Dashboard garage_parts_manager | P0 |
| V5 | Permission enforces | P0 |
| V6 | Tests 10+ scenarios PASS | P0 |

---

## Tache 5.3.19 -- REFONDU : Tests E2E workflow complet v3.0 (60+) + edge cases

**Sprint** : 21 (Phase 5 / Sprint 3)
**Phase** : 5 -- Vertical Repair
**Priorite** : P0
**Effort** : 9h
**Dependances** : 5.3.18

### But

Suite tests E2E exhaustive workflow v3.0 end-to-end + PartsHub + expert workflow + edge cases.

### Livrables checkables

**Tests E2E (60+)** :
- [ ] Workflow happy path complete v3.0 : declared -> expert_designated -> received_at_garage -> diagnostic -> quote_sent_to_expert -> expertise -> validated -> carrier_paid -> reparation -> delivered -> closed (1 test long mais critical) (1)
- [ ] Reception : checklist + photos + documents + tow_mission_id si remorquage (5)
- [ ] Diagnostic : Sky AI + technicien + rapport avec confidence (4)
- [ ] Devis envoye a EXPERT (correction v3.0) : recipients correct (expert + carrier CC + customer COPY) (6)
- [ ] Expert validation line-by-line : validated / modified (3 lignes) / rejected (6)
- [ ] Expert signature Barid eSign loi 43-20 (3)
- [ ] Carrier payment approval mock : approved / rejected / multi-niveau (5)
- [ ] Reparation tracking : milestones + parts arrival (internal + PartsHub) (5)
- [ ] QC + delivery : passed / failed / signature (4)
- [ ] Facturation v3.0 : agreed_garage (2 invoices) / no_coverage (1 invoice) / franchise 0 / franchise > 0 (6)
- [ ] Documents auto-generes : 8 documents + rapport expertise (5)
- [ ] Notifications : WhatsApp status only (validate blacklist), email data sensible (4)
- [ ] Mock expert + mock carrier (3)
- [ ] **PartsHub workflow complet** : search supplier -> order -> tracking -> received -> payment + commission (5)
- [ ] **PartsHub edge cases** : cancel within window, damaged received, refund, multiple suppliers same part (4)
- [ ] Garantie claims : re-repair + refund + reject (3)

**Edge cases** :
- Reparation revele plus de degats : avenant devis (re-soumission a expert)
- Customer ne signe pas reception : status pending
- Expert reject devis : garage revise + resoumission
- Carrier payment rejected : escalade dispute
- QC failed multiple fois : escalade chef garage
- Customer paie partial franchise : invoice partial_paid status
- PartsHub supplier indisponible : trigger alternative supplier search

**Fichiers crees / modifies** :
```
repo/apps/api/test/repair/sprint-21-workflow-v3/{60+ specs}.e2e-spec.ts
repo/infrastructure/scripts/seed-sprint-21-fixtures-v3.ts                              # ~600 lignes scenarios complets
```

### Criteres validation V1-V8

| ID | Critere | Priorite |
|----|---------|----------|
| V1 | 60+ tests passent | P0 |
| V2 | CI green | P0 |
| V3 | Edge cases couverts | P0 |
| V4 | PartsHub workflow E2E | P0 |
| V5 | Expert workflow E2E | P0 |
| V6 | Carrier payment workflow E2E | P0 |
| V7 | Reproducibility 5x | P0 |
| V8 | Workflow v3.0 conforme decision-013 + 014 | P0 |

---

## Sortie du Sprint 21 v3.0

A la fin de l'execution des 19 taches :

```
Sinistre Workflow Detaille v3.0 operational :
  - Reception vehicule : checklist 12 points + photos + 3 docs customer + signature
  - Diagnostic enrichi : Sky AI Sprint 20.5 (historique garage Saad) + technicien + rapport
  - Devis envoye a EXPERT designe par carrier (CC carrier + COPY customer)
  - Expert validation line-by-line + signature Barid eSign loi 43-20
  - Carrier payment approval multi-niveau (mock Sprint 21 / reel Sprint 26.5)
  - Reparation tracking real-time : % completion + parts arrival (internal + PartsHub) + hours
  - QC checklist 10 points + livraison + signature reception customer
  - Facturation v3.0 : carrier->garage 90% cas + franchise customer 10% cas
  - 8 documents auto-generes (rapport expertise + signature Barid)
  - Notifications real-time multi-channel (email = data, WhatsApp = status only, push)
  - Mock expert + mock carrier (Sprint 22.7 + 26.5 reel via apps dediees)
  - PartsHub Phase 1 : catalog + commande + tracking + paiement + commission 3-5%
  - Garantie + reclamations + re-repair gratuit + refund

60+ tests E2E + edge cases couverts (vs 40+ v2.2)
```

**Sprint 22 (Web Garage App) demarre avec** :
- Workflow operationnel backend complet v3.0
- UI consume tous endpoints Sprints 19-21 (incluant expertise + parts)
- Pattern Next.js 15 reutilise Sprint 16
- PartsHub UI inclus dans Web Garage App (search + order + tracking + commission dashboard)

---

# REFERENCES

- decision-011-assurflow-rebrand.md (naming)
- decision-012-6-acteurs-ecosystem.md (expert + carrier + tow acteurs)
- decision-013-expert-acteur-central.md (workflow critique v3.0)
- decision-014-partshub-phase1.md (PartsHub integration)
- B-7.5a Foundation (26 roles + 7 cross-tenant types + 130 perms)
- B-10 Docs + Signature 43-20 (Barid eSign pour expert reports)
- B-11 Pay (passerelles MA pour PartsHub fournisseurs + carrier->garage)
- B-14 Insure Foundation (insure_experts full version)
- B-20 IA Estimation Photos
- B-20.5 Sky AI Pre-Training (a creer Sprint 7.5b)
- B-22.7 Expert App (workflow expert reel)
- B-26.5 Carrier Portal (workflow carrier reel)
- B-24 Flux Sinistre 5 acteurs (a refondre Sprint 7.5b)
- assurflow-analyse-strategique-v2.docx (corrections terrain Saad)
- CHECKLIST-MASTER-EXECUTION.md section 7.5 (Sprint 21)

---

**Fin du meta-prompt B-21 v3.0 Sinistre Workflow + Expert + PartsHub.**
