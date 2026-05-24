# ORCHESTRATEUR SPRINT 24 v3.0 -- Phase 5 / Sprint 6 : Flux Sinistre 5 Acteurs + Scenario Demo Day
# 15 taches sequentielles (10 v2.2 refondues + 5 v3.0 expert/carrier nouveaux) + verification finale
# AUCUNE EMOJI AUTORISEE

**Version** : v3.0 (Option B detaillee -- refonte complete + scenario Demo Day 30 juin 2026)
**Phase** : 5 -- Vertical Repair (orchestration ecosystem 6 acteurs)
**Sprint** : 24 / 40 (cumul v3.0) -- Sprint 6 dans Phase 5
**Reference meta-prompt** : `B-24-sprint-24-flux-sinistre-client.md` v3.0
**Reference verification** : `V-24-sprint-24-verification.md`
**Numerotation taches** : 5.6.1 a 5.6.15 (vs 5.6.1 a 5.6.10 v2.2)
**Effort total** : ~90 heures developpement / 2 semaines (vs 60h v2.2)
**Apport metier** : Orchestration end-to-end **5 ACTEURS** (Customer + Carrier + Garage + Tow + Expert) + Scenario Demo Day 30 juin 2026 reproductible

**Jalon critique** : Sprint 24 GO = **Demo Day prete** (probabilite scope complet < 5%, fallback J-15 documente).

---

Tu es **Claude Code (ou Cowork)**. Tu dois executer **TOUTES les 15 taches** du Sprint 24 v3.0 **UNE PAR UNE** dans l'ordre defini.

**STRATEGIE REFONTE COMPLETE v3.0** : Le v2.2 etait base sur 3 acteurs (Customer + Carrier + Garage). Le v3.0 **REFOND ET ETEND** a 5 acteurs (ajout Tow + Expert) avec orchestrateur master qui coordonne tous les acteurs + scenario Demo Day fixtures reproductible.

---

## OBJECTIF DU SPRINT 24 v3.0

Sprint 24 (5.6) -- Flux Sinistre 5 Acteurs + Scenario Demo Day. Voir B-24 v3.0 pour contexte detaille.

Implementer **orchestration end-to-end** d'un sinistre auto realiste depuis declaration customer jusqu'a livraison vehicule, avec **5 acteurs coordonnes** :
- **Customer** (assure) : declaration + suivi statut + signature reception
- **Carrier** (compagnie) : validation FNOL + designation expert + approbation paiement
- **Tow** (depanneur) : intervention sur place + remorquage vers garage
- **Expert** (expert ACAPS) : visite + validation devis line-by-line + signature Barid
- **Garage** (reparateur) : reception vehicule + diagnostic Sky AI + reparation + livraison

**Plus** : Scenario Demo Day fixtures reproductible (3 sinistres complets simules pour pitch live 30 juin 2026).

---

## STRUCTURE DES FICHIERS

```
skalean-insurtech/00-pilotage/prompts-taches/sprint-24-flux-sinistre/
  task-5.6.1-prompt.md   # FNOL customer + auto-create sinistre (REFONDU v3.0)
  task-5.6.2-prompt.md   # Carrier validation FNOL + decision route (REFONDU v3.0)
  task-5.6.3-prompt.md   # NOUVEAU v3.0 : Designation Tow par carrier
  task-5.6.4-prompt.md   # NOUVEAU v3.0 : Tow intervention + remorquage
  task-5.6.5-prompt.md   # NOUVEAU v3.0 : Designation Expert par carrier
  task-5.6.6-prompt.md   # NOUVEAU v3.0 : Expert visite + rapport + Barid
  task-5.6.7-prompt.md   # Garage reception + diagnostic Sky AI (REFONDU v3.0)
  task-5.6.8-prompt.md   # Devis garage envoye a Expert (PRESERVE Sprint 21)
  task-5.6.9-prompt.md   # Expert validation devis + carrier approval (PRESERVE Sprint 21)
  task-5.6.10-prompt.md  # Reparation tracking real-time customer (REFONDU v3.0)
  task-5.6.11-prompt.md  # Livraison + signature customer (PRESERVE v2.2)
  task-5.6.12-prompt.md  # NOUVEAU v3.0 : Master Orchestrator service 5 acteurs
  task-5.6.13-prompt.md  # REFONDU v3.0 : Dashboard real-time 5 acteurs visibility
  task-5.6.14-prompt.md  # NOUVEAU v3.0 : Scenario Demo Day fixtures reproductible
  task-5.6.15-prompt.md  # REFONDU v3.0 : Tests E2E 80+ flux complet 5 acteurs
```

**Verification** : `V-24-sprint-24-verification.md`
**Decisions cles** : 015 (Demo Day) + 013 (expert central) + 012 (6 acteurs ecosystem) + 011 (rebrand)

---

## REGLES D'EXECUTION CRITIQUES

Sequentielle obligatoire (compile + tests + lint + commit avant tache suivante).

### Si une tache echoue : 3 tentatives reparation puis FAIL + continuer.

### Verification finale : V-24 automatique apres 15 taches.

### Jalon Sprint 24 = Jalon Demo Day

**Score V-24 >= 95%** -> GO -> Demo Day prete + fixtures reproductibles
**Score V-24 85-95%** -> GO CONDITIONNEL -> Fallback Demo Day J-15 (decision-015 fallback documente)
**Score V-24 < 85%** -> NO-GO -> Demo Day repoussee + decision Saad/Abla obligatoire

---

## REGLES ABSOLUES skalean-insurtech v3.0

(Identique C-14/C-21 -- multi-tenant + Zod + Pino + Kafka + RBAC + Tests Vitest + TypeScript strict + pnpm + @insurtech/* + AUCUNE EMOJI + Idempotency-Key + Conventional Commits)

**Specifique Sprint 24 v3.0** :
- **5 acteurs orchestration** : carrier_admin (orchestrateur principal) + 4 acteurs distribues
- **Master Orchestrator pattern** : 1 service central coordonnant tous les workflows (Tache 5.6.12)
- **Cross-tenant 7 types** : `carrier_to_garage` + `carrier_to_tow` + `carrier_to_expert` + `garage_to_carrier` + `garage_to_expert_request` + `tow_to_carrier` + `expert_to_carrier`
- **WhatsApp scope strict** : whitelist status only (correction Saad #7 -- decision absolue)
- **Sky AI** : diagnostic + Decision Engine routing carrier (Sprint 20.5 pre-trained)
- **Real-time updates** : SSE (Server-Sent Events) + WebSocket dashboard 5 acteurs visibility
- **Demo Day fixtures** : 3 sinistres scenarios complets reproductibles avec timeline rejouable

### Conformite Demo Day 30 juin 2026 (decision-015)

- Scenario 1 : Sinistre simple (collision avec Tow + Expert + Reparation legere) -- 8 min pitch
- Scenario 2 : Sinistre complexe (collision multiple + 3 experts firm + carrier approval cascade) -- 12 min pitch
- Scenario 3 : Sinistre rejete (expert reject -> contestation -> escalade) -- 5 min pitch
- Fixtures de 5 demonstrations consecutives sans reset DB

---

## CONTEXTE PHASE 5 -- Vertical Repair

### Position du Sprint 6 dans la Phase 5

Sprint 24 (5.6) -- **Flux Sinistre 5 Acteurs + Scenario Demo Day** -- 6eme et **AVANT-DERNIER** sprint Phase 5 (suivi par Sprint 24.5 hardening Demo Day eventuellement).

### Modules concernes

@insurtech/repair (orchestration centrale), @insurtech/expertise (Sprint 14 + 22.7), @insurtech/insure (Sprint 14), @insurtech/tow (Sprint 22.5), @insurtech/comm (WhatsApp scope strict), @insurtech/signature (Barid), @insurtech/sky (Decision Engine), @insurtech/database, apps/api

### Apport metier

Orchestration complete ecosystem 6 acteurs **fonctionnelle pour Demo Day**.

---

## EXECUTION SEQUENTIELLE DES 15 TACHES

---

### Tache 1 / 15 : FNOL customer + auto-create sinistre (REFONDU v3.0)

**Metadonnees** : P0 | 5h | Depend de : Sprint 23 (Customer App)

**But** : Customer App declare FNOL (First Notice Of Loss) -> auto-create `repair_sinistres` + entry `insure_claims_log` + event Kafka `insurtech.events.repair.sinistre.declared` + notification carrier + customer confirmation.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-24-flux-sinistre/task-5.6.1-prompt.md
```

**Actions principales attendues** :
- Migration ajout colonnes `repair_sinistres` : `fnol_declared_at`, `fnol_declared_by_user_id`, `fnol_source` (customer_app/carrier_callcenter/agent_broker), `fnol_initial_estimate_mad`, `fnol_attached_photos[]`, `fnol_attached_documents[]`
- Service `fnol-declarations.service.ts` (~300 lignes) :
  - `declareFnol(input)` -- Zod validation + create sinistre + log + notifications
  - `attachPhotos(sinistreId, urls[])`
  - `attachDocuments(sinistreId, urls[])`
  - `submitToCarrier(sinistreId)` -- transition declared -> carrier_review_pending
- Cross-tenant `customer_to_carrier_fnol` (NOUVEAU type Sprint 7.5a v3.0 etendu si manquant)
- Notifications immediate : email carrier (detail FNOL + photos) + WhatsApp customer (confirmation reception scope strict)
- Endpoints REST : POST `/api/v1/repair/sinistres/fnol-declare` + GET `/api/v1/repair/sinistres/:id/status`
- Permissions Sprint 7.5a : `customer.sinistres.declare_fnol` + `carrier.sinistres.review_fnol`
- Tests 12+

**Criteres P0 cles** :
- V1 : Auto-create sinistre + log + transition status declared
- V2 : Event Kafka emis
- V3 : WhatsApp scope strict (status only, blacklist amount)
- V4 : Photos + documents attached securises (URLs signed S3-compatible)
- V5 : Tests 12+ PASS

**Commit** :
```bash
git commit -m "feat(sprint-24): REFONTE fnol customer app + auto-create sinistre

Task: 5.6.1
Sprint: 24 (Phase 5 / Sprint 6)
Phase: 5 -- Vertical Repair
Decisions: decision-012 6 acteurs"
```

---

### Tache 2 / 15 : Carrier validation FNOL + decision route (REFONDU v3.0)

**Metadonnees** : P0 | 6h | Depend de : 5.6.1

**But** : Carrier (mock Sprint 24, reel Sprint 26.5) recoit FNOL + Sky AI Decision Engine recommande route (besoin Tow oui/non, expert immediat oui/non, garage agree suggere). Decision finale carrier validate/reject.

**Actions principales** :
- Service `carrier-fnol-review.service.ts` :
  - `reviewFnol(sinistreId, decision, justification)` -- validate / reject / request_more_info
  - `requestSkyAiRoutingRecommendation(sinistreId)` -- appelle Sprint 20.5 Sky AI Decision Engine
  - `routeSinistre(sinistreId, routingDecision)` -- transitions vers Tow + Expert + Garage selon routing
- Sky AI Decision Engine input : description sinistre + photos + customer history + carrier policies catalog
- Sky AI output : `{ tow_needed: bool, expert_priority: 'urgent'/'standard'/'low', suggested_garage_ids: [], suggested_expert_ids: [], estimated_severity: 'minor'/'major'/'total_loss' }`
- Mock Sprint 24 : MockCarrierFnolService simulation 90% validate / 5% reject / 5% more_info
- Permissions Sprint 7.5a : `carrier.sinistres.validate_fnol` + `carrier.sinistres.route`
- Tests 12+

**Criteres P0** :
- V1 : Service review 3 methodes
- V2 : Sky AI Decision Engine integration
- V3 : Routing decisions persistees `repair_sinistres.carrier_routing_decision` jsonb
- V4 : Mock rejection rate 5%
- V5 : Tests 12+ PASS

**Commit** :
```bash
git commit -m "feat(sprint-24): REFONTE carrier fnol review + sky ai decision routing

Task: 5.6.2
Decisions: decision-013 + sky ai routing"
```

---

### Tache 3 / 15 : NOUVEAU -- Designation Tow par carrier

**Metadonnees** : P0 | 5h | Depend de : 5.6.2

**But** : Si Sky AI recommande tow_needed=true, carrier designe automatiquement Tow operator depuis pool Sprint 22.5. Cross-tenant `carrier_to_tow_assignment` cree. Tow recoit notification mission.

**Actions** :
- Service `carrier-tow-designation.service.ts` :
  - `designateTow(input)` -- pattern voir B-24 v3.0 Tache 5.6.3 (selection Tow par zone + availability + rating)
  - `cancelTowDesignation(sinistreId, reason)`
- Integration Sprint 22.5 entites `tow_operators` + `tow_missions`
- Cross-tenant `carrier_to_tow_assignment` auto-create
- Notification Tow operator : push notification mobile (Sprint 22.5) + SMS backup + email
- Endpoints REST + permissions `carrier.tow.designate` + `tow.missions.accept`
- Tests 10+

**Commit** :
```bash
git commit -m "feat(sprint-24): NOUVEAU designation tow par carrier + cross-tenant

Task: 5.6.3
Decisions: decision-012 acteur tow"
```

---

### Tache 4 / 15 : NOUVEAU -- Tow intervention + remorquage

**Metadonnees** : P0 | 6h | Depend de : 5.6.3

**But** : Tow operator accepte mission + intervient sur place + photos vehicule etat initial + remorquage vers garage agree selectionne. Customer suivi temps reel localisation Tow.

**Actions** :
- Service `tow-intervention.service.ts` (preview Sprint 22.5 complet) :
  - `acceptMission(missionId, towUserId)`
  - `startIntervention(missionId, lat, lng)`
  - `uploadVehicleStatePhotos(missionId, urls[])`
  - `startTowing(missionId, destination_garage_id)`
  - `markVehicleDelivered(missionId, garage_reception_id)`
- Real-time tracking GPS : `tow_mission_locations` table (lat + lng + heading + speed + timestamp every 30s)
- Customer notifications : WhatsApp status milestones (accepted + en_route + arrived_on_site + towing_started + delivered_to_garage)
- Integration Tache 5.6.7 (garage reception) : tow_mission_id transmis automatiquement
- Tests 12+

**Commit** :
```bash
git commit -m "feat(sprint-24): NOUVEAU tow intervention + tracking gps real-time

Task: 5.6.4"
```

---

### Tache 5 / 15 : NOUVEAU -- Designation Expert par carrier

**Metadonnees** : P0 | 5h | Depend de : 5.6.4

**But** : Apres reception garage confirmee (ou en parallele si severity major selon Sky AI), carrier designe Expert depuis pool Sprint 14. Cross-tenant `carrier_to_expert_assignment` auto-create.

**Actions** :
- Reuse Sprint 14 Tache 4.1.16 `expert-assignments.service.ts.designateExpert()`
- Wrapper service Sprint 24 `sinistre-expert-orchestration.service.ts` :
  - `designateExpertForSinistre(sinistreId, urgency)` -- selection expert via Sky AI ranking (specialty + zone + availability + rating + response_time)
  - `escalateExpertDesignation(sinistreId, reason)` -- si pas d'expert disponible -> firm_admin escalation
- Permissions Sprint 7.5a : `carrier.experts.designate` (carrier_expert_manager)
- Tests 8+

**Commit** :
```bash
git commit -m "feat(sprint-24): NOUVEAU designation expert orchestree depuis pool sprint 14

Task: 5.6.5
Decisions: decision-013"
```

---

### Tache 6 / 15 : NOUVEAU -- Expert visite + rapport + Barid

**Metadonnees** : P0 | 7h | Depend de : 5.6.5

**But** : Expert (mock Sprint 24, reel Sprint 22.7 Expert App) accepte mission + visite garage + inspecte vehicule + redige rapport + signe Barid eSign + soumet carrier.

**Actions** :
- Service `expert-visit-orchestration.service.ts` (wrapper Sprint 22.7 preview) :
  - `acceptExpertAssignment(assignmentId, expertUserId)`
  - `scheduleVisit(assignmentId, scheduledAt)`
  - `recordVisitArrival(assignmentId, lat, lng)`
  - `submitInspectionReport(assignmentId, reportData)`
  - `signReportWithBarid(reportId, otp)` -- Sprint 10 Barid eSign
  - `submitReportToCarrier(reportId)`
- Mock Sprint 24 : `MockExpertVisitOrchestrationService` (90% scheduled in 24h / 10% delay 48-72h)
- Photos inspection + checklist 15 points + verdict severity
- Integration Sprint 14 Tache 4.1.17 (expert_reports table + service)
- Tests 10+

**Commit** :
```bash
git commit -m "feat(sprint-24): NOUVEAU expert visite + rapport + barid esign

Task: 5.6.6
Decisions: decision-013 + sprint 14 entites consumed"
```

---

### Tache 7 / 15 : Garage reception + diagnostic Sky AI (REFONDU v3.0)

**Metadonnees** : P0 | 5h | Depend de : 5.6.6 (ou parallel selon routing)

**But** : Garage recoit vehicule (via Tow ou customer direct) + checklist + diagnostic **Sky AI** (vs IA generique v2.2). Preview Sprint 21 Tache 5.3.1+5.3.2.

**Actions principales** :
- Reuse Sprint 21 `receptions.service.ts` + `diagnostics.service.ts`
- Wrapper Sprint 24 `sinistre-garage-orchestration.service.ts` :
  - `receiveVehicleFromTow(sinistreId, towMissionId)` -- auto-link tow + garage
  - `receiveVehicleFromCustomer(sinistreId, customerArrivalData)`
  - `runSkyAiDiagnostic(sinistreId)` -- appelle Sprint 20.5 Sky AI pre-trained
- Confidence score Sky AI visible rapport
- Tests 8+

**Commit** :
```bash
git commit -m "feat(sprint-24): REFONTE garage reception + sky ai diagnostic

Task: 5.6.7"
```

---

### Tache 8 / 15 : Devis garage envoye a Expert (PRESERVE Sprint 21)

**Metadonnees** : P0 | 3h | Depend de : 5.6.7

**But** : Reuse Sprint 21 Tache 5.3.3 (REFONDU envoi devis a expert designe par carrier). Sprint 24 = orchestration cross-vertical seulement.

**Actions** :
- Wrapper `sinistre-devis-orchestration.service.ts` :
  - `triggerDevisExpertRoute(sinistreId)` -- coordonne Sprint 21 Tache 5.3.3 + transition status sinistre
- Permissions reused

**Commit** :
```bash
git commit -m "feat(sprint-24): orchestration devis garage expert (reuse sprint 21)

Task: 5.6.8"
```

---

### Tache 9 / 15 : Expert validation devis + carrier approval (PRESERVE Sprint 21)

**Metadonnees** : P0 | 3h | Depend de : 5.6.8

**But** : Reuse Sprint 21 Taches 5.3.4 + 5.3.5 (expert validation line-by-line + carrier payment approval).

**Actions** :
- Wrapper orchestration + monitoring + escalation

**Commit** :
```bash
git commit -m "feat(sprint-24): orchestration expert validation + carrier approval

Task: 5.6.9"
```

---

### Tache 10 / 15 : Reparation tracking real-time customer (REFONDU v3.0)

**Metadonnees** : P0 | 5h | Depend de : 5.6.9

**But** : **REFONDU** : Customer App suit en temps reel l'avancement reparation. SSE (Server-Sent Events) + WebSocket pour updates push.

**Actions** :
- Service `customer-realtime-tracking.service.ts` :
  - `subscribeToSinistreUpdates(sinistreId, customerUserId)` -- SSE stream
  - `pushMilestone(sinistreId, milestone, data)` -- emit event
  - `getCurrentProgress(sinistreId)` -- snapshot
- Milestones : 12 (declared / carrier_reviewed / tow_dispatched / vehicle_received / diagnosed / devis_sent_expert / expert_validated / carrier_approved / parts_ordered / repair_in_progress / qc_done / ready_for_delivery)
- Notifications : WhatsApp status milestones whitelist seulement
- Tests 10+

**Commit** :
```bash
git commit -m "feat(sprint-24): REFONTE customer realtime tracking sse + websocket

Task: 5.6.10"
```

---

### Tache 11 / 15 : Livraison + signature customer (PRESERVE v2.2)

**Metadonnees** : P0 | 3h | Depend de : 5.6.10

**But** : Reuse Sprint 21 Tache 5.3.7 (livraison + signature reception customer).

**Commit** :
```bash
git commit -m "feat(sprint-24): orchestration livraison customer signature

Task: 5.6.11"
```

---

### Tache 12 / 15 : NOUVEAU -- Master Orchestrator service 5 acteurs

**Metadonnees** : P0 | 8h | Depend de : 5.6.11

**But** : Service central qui coordonne **TOUS** les workflows 5 acteurs avec state machine + retry + escalation + audit.

**Actions principales** :
- Service `sinistre-master-orchestrator.service.ts` (~600 lignes) :
  - State machine sinistre : 18 etats (declared / under_carrier_review / tow_designated / tow_in_progress / vehicle_at_garage / diagnostic_in_progress / devis_at_expert / devis_validated / carrier_payment_approved / repair_in_progress / qc / ready_delivery / delivered / closed + branches rejection/escalation)
  - `transitionState(sinistreId, fromState, toState, actorRole, payload)` -- single source of truth transitions
  - `getStateHistory(sinistreId)` -- audit trail complet
  - `getActiveActors(sinistreId)` -- qui doit agir maintenant
  - `escalateBlockedSinistre(sinistreId, blockedSince)` -- cron daily detection
  - `recoverFromFailure(sinistreId, failurePoint)` -- retry strategies
- Table `repair_sinistres_state_history` : audit trail complete (sinistreId + state + transitioned_by_user_id + transitioned_at + payload jsonb)
- RLS + FORCE active
- Cron daily blocked detection : sinistres bloques > 48h sans transition -> escalation broker_admin + carrier
- Tests 25+ (state machine + transitions + escalations + recovery)

**Criteres P0 cles** :
- V1 : Service complete avec 18 etats
- V2 : State machine transitions strictes (validation matrice transitions)
- V3 : Table state_history + RLS
- V4 : Cron daily blocked detection
- V5 : Tests 25+ PASS

**Commit** :
```bash
git commit -m "feat(sprint-24): NOUVEAU master orchestrator service 5 acteurs state machine

Task: 5.6.12
Decisions: decision-012 + state machine pattern"
```

---

### Tache 13 / 15 : REFONDU -- Dashboard real-time 5 acteurs visibility

**Metadonnees** : P0 | 6h | Depend de : 5.6.12

**But** : Dashboard real-time multi-acteurs (chacun voit son scope). Carrier voit tout. Garage voit ses sinistres. Tow voit ses missions. Expert voit ses assignments. Customer voit ses sinistres.

**Actions** :
- Service `realtime-dashboard.service.ts` :
  - `getCarrierDashboard(carrierTenantId)` -- all sinistres + KPIs (avg_resolution_time + satisfaction + cost)
  - `getGarageDashboard(garageTenantId)`
  - `getTowDashboard(towTenantId)`
  - `getExpertDashboard(expertUserId)`
  - `getCustomerDashboard(customerUserId)`
- WebSocket subscriptions par acteur
- Endpoints REST + WebSocket
- Permissions Sprint 7.5a enforces (chaque dashboard filtre par role)
- Tests 12+

**Commit** :
```bash
git commit -m "feat(sprint-24): REFONTE dashboard realtime 5 acteurs visibility

Task: 5.6.13"
```

---

### Tache 14 / 15 : NOUVEAU -- Scenario Demo Day fixtures reproductible (CRITIQUE)

**Metadonnees** : P0 | 8h | Depend de : 5.6.13

**But** : Fixtures 3 sinistres complets reproductibles pour pitch Demo Day 30 juin 2026. 5 demonstrations consecutives possibles sans reset DB.

**Actions principales** :
- Script seeds `repo/infrastructure/scripts/seed-demo-day-fixtures-v3.ts` (~800 lignes) :
  - Scenario 1 : Collision simple Casablanca (3 acteurs Customer + Carrier + Garage agree)
    - Customer "Yassine Alaoui" + voiture Peugeot 208 2019 + collision parking (degats portiere + retro)
    - Carrier mock "Wafa Assurance" valide FNOL 5min
    - Pas de Tow (vehicule roulant)
    - Expert "Karim Bennani ACAPS-2024-EXP-001" designe + valide devis line-by-line
    - Garage "Carrosserie Garage Saad" (donnees reelles Saad) reception + Sky AI diagnostic 92% confidence + reparation 7 jours
    - Livraison + signature customer + satisfaction 5/5
  - Scenario 2 : Collision multiple Rabat (5 acteurs complet)
    - Customer "Fatima Zahra Idrissi" + voiture Renault Clio 2021 + collision intersection (3 vehicules)
    - Carrier "RMA Assurance" valide FNOL + Sky AI severity=major + tow_needed=true + expert urgent
    - Tow operator "DepannageMaroc24" intervient + GPS tracking + livraison garage
    - Expert "Said Tazi ACAPS-2023-EXP-014 firm Tazi & Associates" + 3 experts associes for complex case
    - Garage "Auto Service Casablanca" reception + diagnostic + devis 32 lines + expert validate avec 5 modifications + carrier approval + reparation 14 jours + PartsHub commande 8 pieces
    - Livraison + signature + satisfaction 4/5
  - Scenario 3 : Sinistre rejete + contestation (escalation)
    - Customer "Mohamed Akram" + voiture Dacia Logan 2018 + collision suspicious
    - Carrier "Sanad" Sky AI severity=major + fraud_risk=high
    - Expert "Aicha Belkadi ACAPS-2022-EXP-008" inspection + decision='rejected' + justification fraud detected
    - Customer conteste -> escalade broker_admin -> 2eme expert nomine -> confirmation rejection
    - Sinistre closed_rejected + customer satisfaction insurance plainte ACAPS (mock)
- Reset fonction `resetDemoDayFixtures()` : DB rollback + replay timeline en 30 secondes
- Timeline rejouable : scenario 1 (8 min) + scenario 2 (12 min) + scenario 3 (5 min) = 25 min pitch complet
- Documentation `docs/demo-day-runbook-30-juin-2026.md` (~300 lignes) : sequence pitch + dashboard slides + Q&A prepare

**Criteres P0 cles** :
- V1 : Script seeds genere 3 scenarios completes sans erreur
- V2 : Reset fonction operational (5 demos consecutives)
- V3 : Timeline 25 min reproductible
- V4 : Documentation runbook complete
- V5 : Garage Saad data integrees (asset unique 1500+ sinistres reels)
- V6 : 5 acteurs visibles dashboard temps reel pendant demo

**Commit** :
```bash
git commit -m "feat(sprint-24): NOUVEAU scenario demo day fixtures 3 sinistres reproductibles

Task: 5.6.14
Decisions: decision-015 demo day 30 juin 2026
Sprint: 24 (Phase 5 / Sprint 6)"
```

---

### Tache 15 / 15 : REFONDU -- Tests E2E 80+ flux complet 5 acteurs

**Metadonnees** : P0 | 10h | Depend de : 5.6.14

**But** : Tests E2E 80+ (vs 30 v2.2). Couvrent les 18 etats state machine + 3 scenarios complets + edge cases + escalations + recovery.

**Actions** :
- Tests E2E flux complets :
  - Test scenario 1 happy path (15 etats traverses)
  - Test scenario 2 happy path complete 5 acteurs (18 etats)
  - Test scenario 3 rejection + contestation (etats branches)
  - Test edge case : Tow refuse mission -> auto re-designation
  - Test edge case : Expert agrement expired pendant assignment -> reassignment
  - Test edge case : Carrier reject paiement -> escalation + nouveau devis
  - Test edge case : Customer absent livraison -> reschedule cron
  - Test recovery : sinistre bloque 48h -> escalation broker + notif Saad
  - Test load : 50 sinistres parallel orchestrated
- Fixtures Demo Day reused
- Coverage Sprint 24 >= 90% (vs 85% baseline)
- Tests 80+ scenarios

**Commit** :
```bash
git commit -m "test(sprint-24): tests e2e 80+ flux complet 5 acteurs + edge cases

Task: 5.6.15"
```

---

## SYNTHESE -- Cloture Sprint 24 v3.0 (= Demo Day Prete)

Apres execution des 15 taches :

```bash
# Verifier 15 commits Sprint 24
git log --since="2 weeks ago" --pretty=format:"%s" -- repo/ | grep "Task: 5.6" | wc -l
# Attendu : 15

# 0 emoji
grep -rP "[\x{1F300}-\x{1F9FF}]" repo/ --include="*.ts" --include="*.md" | wc -l
# Attendu : 0

# Lancer V-24 (= validation Demo Day readiness)
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-24-sprint-24-verification.md

# Si V-24 GO (>= 95%) -> Demo Day prete
git tag -a "sprint-24-complete-v3-demo-day-ready" -m "Sprint 24 v3.0 complete + Demo Day prete

- Orchestration end-to-end 5 acteurs fonctionnelle
- Master Orchestrator state machine 18 etats
- 3 scenarios Demo Day reproductibles
- Dashboard real-time 5 acteurs
- 80+ tests E2E PASS
- Score V-24 >= 95% -- GO Demo Day 30 juin 2026

Reference: B-24 v3.0 + decision-015 + decision-012 + decision-013"

git push origin sprint-24-complete-v3-demo-day-ready

# Dry-run Demo Day J-7 (24 juin 2026)
pnpm run seed:demo-day-fixtures
pnpm run demo-day:dry-run --duration=25min --scenarios=1,2,3

# Si dry-run KO -> fallback J-15 documented decision-015
```

---

## RESUME DU WORKFLOW

```
[Demarrage Sprint 24 v3.0]
   |
   v
[Tache 5.6.1 : FNOL customer + auto-create]
   |
   v
[Tache 5.6.2 : Carrier review + Sky AI routing]
   |
   v
[Branche conditionnelle Sky AI : tow_needed]
   |
   +-- [Tache 5.6.3 : Designation Tow] -> [Tache 5.6.4 : Tow intervention]
   |
   v
[Tache 5.6.5 : Designation Expert] (parallele possible avec garage)
   |
   v
[Tache 5.6.6 : Expert visite + Barid] (parallele garage)
   |
   v
[Tache 5.6.7 : Garage reception + Sky AI diagnostic]
   |
   v
[Taches 5.6.8-9 : Devis -> Expert -> Carrier approval] (Sprint 21 reuse)
   |
   v
[Tache 5.6.10 : Reparation realtime customer]
   |
   v
[Tache 5.6.11 : Livraison + signature customer]
   |
   v
[Tache 5.6.12 : NOUVEAU Master Orchestrator state machine 18 etats]
   |
   v
[Tache 5.6.13 : REFONTE Dashboard 5 acteurs realtime]
   |
   v
[Tache 5.6.14 : NOUVEAU CRITIQUE Scenario Demo Day fixtures]
   |
   v
[Tache 5.6.15 : Tests E2E 80+]
   |
   v
[V-24 verification automatique]
   |
   v
[Score >= 95%] -> GO -> Demo Day 30 juin 2026 prete
[Score 85-95%]  -> GO CONDITIONNEL -> Fallback J-15 decision-015
[Score < 85%]   -> NO-GO -> Demo Day repoussee + decision Saad/Abla
```

**Duree totale estimee** : 90 heures (vs 60h v2.2). +30h pour orchestrator state machine + scenario Demo Day fixtures.

**Modules affectes** : @insurtech/repair (orchestration centrale), @insurtech/expertise, @insurtech/insure, @insurtech/tow, @insurtech/comm, @insurtech/signature, @insurtech/sky, apps/api

**Apport metier principal** : Orchestration end-to-end ecosystem 6 acteurs fonctionnelle + Demo Day reproductible.

**Prerequis Demo Day** : Sprint 24 v3.0 GO complet (score >= 95% V-24) + dry-run J-7 OK.

**Sprint suivant** : Sprint 25 Customer App polish (eventuellement Sprint 24.5 hardening si necessaire).

---

## COMMANDES DE LANCEMENT

### Prerequis (Sprint 23 GO)
```bash
ls skalean-insurtech/sprint23-verify-report.md
grep '^Statut.*GO' skalean-insurtech/sprint23-verify-report.md
```

### Lancement Sprint 24 v3.0
```bash
claude-code \
  --orchestrator skalean-insurtech/00-pilotage/meta-prompts/phase-C-orchestration/C-24-sprint-24-flux-sinistre.md \
  --reference-prompt skalean-insurtech/00-pilotage/meta-prompts/phase-B-tasks/B-24-sprint-24-flux-sinistre-client.md \
  --verification skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-24-sprint-24-verification.md
```

### Suivi temps reel
```bash
tail -f skalean-insurtech/cowork-sprint-24.log
git log --oneline --since="2 weeks ago" -- repo/ | grep "Sprint: 24"
```

### Apres completion + Demo Day dry-run
```bash
cat skalean-insurtech/sprint24-verify-report.md
pnpm run demo-day:dry-run
```

---

## NOTES IMPORTANTES POUR COWORK

1. **Lire B-24 v3.0 complet** AVANT generation prompts taches (Demo Day = jalon critique business)
2. **State machine pattern** (Tache 5.6.12) = OBLIGATOIRE -- pas raccourci ad-hoc
3. **Cross-tenant 7 types** doivent fonctionner end-to-end pour scenarios Demo Day
4. **Demo Day fixtures** (Tache 5.6.14) = LIVRABLE CRITIQUE = reproductibilite 5 demos consecutives
5. **Garage Saad data** integree comme fixture Scenario 1 (asset unique 1500+ sinistres reels)
6. **Mock services** Sprint 24 = ne PAS s'appuyer sur Sprint 22.7 + 26.5 reels (peuvent etre incomplets)
7. **Sky AI Decision Engine** (Sprint 20.5) = pre-requis dur, sinon Tache 5.6.2 non livrable
8. **Decision-015** fallback Demo Day J-15 documente : scope reduit (scenario 1 seul + dashboard simple)
9. **Tests load 50 parallel** (Tache 5.6.15) = stress test critique pour pitch live
10. **NE JAMAIS modifier 00-pilotage/** -- uniquement repo/

---

**Fin orchestrateur C-24 v3.0 -- Sprint 24 (5.6) Flux Sinistre 5 Acteurs + Scenario Demo Day.**

**Total taches** : 15 | **Effort** : ~90h | **Apport** : Orchestration ecosystem 6 acteurs + Demo Day prete
