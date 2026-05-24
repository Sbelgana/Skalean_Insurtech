# ORCHESTRATEUR SPRINT 21 v3.0 -- Phase 5 / Sprint 3 : Sinistre Workflow + Expert + PartsHub
# 19 taches sequentielles (13 v2.2 REFONDUES + 6 v3.0 PartsHub NOUVEAUX) + verification finale
# AUCUNE EMOJI AUTORISEE

**Version** : v3.0 (Option B detaillee -- refonte complete)
**Phase** : 5 -- Vertical Repair (Assurflow Garage ERP + Ecosystem)
**Sprint** : 21 / 40 (cumul v3.0) -- Phase 5 Sprint 3
**Reference meta-prompt** : `B-21-sprint-21-sinistre-workflow.md` v3.0
**Reference verification** : `V-21-sprint-21-verification.md`
**Numerotation taches** : 5.3.1 a 5.3.19 (vs 5.3.1 a 5.3.13 v2.2)
**Effort total** : ~100 heures developpement / 2 semaines etendues (vs 74h v2.2)
**Apport metier** : Workflow expert central correct + facturation v3.0 carrier->garage + PartsHub commission 3-5%

---

Tu es **Claude Code (ou Cowork)**. Tu dois executer **TOUTES les 19 taches** du Sprint 21 v3.0 **UNE PAR UNE** dans l'ordre defini.

**STRATEGIE REFONTE COMPLETE v3.0** : Contrairement a Sprint 14 (preservatif), Sprint 21 v3.0 **REFOND COMPLETEMENT** le workflow car le v2.2 etait base sur des hypotheses fausses (devis envoye au carrier directement, split assureur 60% / customer 40%). Le v3.0 corrige selon decisions 013-014.

---

## OBJECTIF DU SPRINT 21 v3.0

Sprint 21 (5.3) -- Sinistre Workflow + Expert + PartsHub. Voir B-21 v3.0 pour contexte detaille.

Implementer workflow detaille sinistre **v3.0 end-to-end** avec :
- **Workflow expert central** : garage envoie devis a EXPERT designe par carrier (CC carrier), expert valide ligne par ligne, signature Barid eSign, carrier valide paiement multi-niveau
- **Facturation v3.0** : 90% cas circuit garage agree (carrier paye garage direct 7 jours, customer paye franchise minime) / 10% cas customer total
- **PartsHub Phase 1** integre : catalog fournisseurs + commande automatique + paiement + commission Assurflow 3-5%

---

## STRUCTURE DES FICHIERS

```
skalean-insurtech/00-pilotage/prompts-taches/sprint-21-sinistre-workflow/
  task-5.3.1-prompt.md   # Reception vehicule (PRESERVE v2.2 + tow_mission_id)
  task-5.3.2-prompt.md   # Diagnostic Sky AI enrichi (ENRICHI v3.0)
  task-5.3.3-prompt.md   # Envoi devis a EXPERT (REFONDU v3.0)
  task-5.3.4-prompt.md   # Validation expert line-by-line + Barid (REFONDU v3.0)
  task-5.3.5-prompt.md   # Approbation paiement carrier (REFONDU v3.0)
  task-5.3.6-prompt.md   # Reparation tracking (PRESERVE v2.2)
  task-5.3.7-prompt.md   # QC + livraison (PRESERVE v2.2)
  task-5.3.8-prompt.md   # Facturation v3.0 (REFONDU v3.0)
  task-5.3.9-prompt.md   # Documents auto-generes (ENRICHI v3.0)
  task-5.3.10-prompt.md  # Notifications WhatsApp scope strict (ENRICHI v3.0)
  task-5.3.11-prompt.md  # Mock expert + carrier (REFONDU v3.0)
  task-5.3.12-prompt.md  # Garantie tracking (PRESERVE v2.2)
  task-5.3.13-prompt.md  # Endpoints REST + permissions (ETENDU v3.0)
  task-5.3.14-prompt.md  # NOUVEAU v3.0 : PartsHub catalog fournisseurs + KYB
  task-5.3.15-prompt.md  # NOUVEAU v3.0 : PartsHub commande automatique
  task-5.3.16-prompt.md  # NOUVEAU v3.0 : PartsHub tracking livraison
  task-5.3.17-prompt.md  # NOUVEAU v3.0 : PartsHub paiement fournisseurs
  task-5.3.18-prompt.md  # NOUVEAU v3.0 : PartsHub commission tracking + dashboard
  task-5.3.19-prompt.md  # REFONDU v3.0 : Tests E2E 60+ workflow complet
```

**Verification** : `V-21-sprint-21-verification.md`
**Decisions cles** : 013 (expert central) + 014 (PartsHub) + 011 (rebrand)

---

## REGLES D'EXECUTION CRITIQUES

Sequentielle obligatoire (compile + tests + lint + commit avant tache suivante).

### Si une tache echoue : 3 tentatives reparation puis FAIL + continuer.

### Verification finale : V-21 automatique apres 19 taches.

---

## REGLES ABSOLUES skalean-insurtech v3.0

(Identique C-14 -- multi-tenant + Zod + Pino + Kafka + RBAC + Tests Vitest + TypeScript strict + pnpm + @insurtech/* + AUCUNE EMOJI + Idempotency-Key + Conventional Commits)

**Specifique Sprint 21 v3.0** :
- **decimal.js obligatoire** pour facturation v3.0 + commission PartsHub (precision)
- **Workflow expert** : verifier expert designe avant envoi devis (Tache 5.3.3)
- **WhatsApp scope strict** : whitelist templates status only (Tache 5.3.10)
- **Barid eSign** : signature rapport expert obligatoire (Tache 5.3.4)
- **Cross-tenant** : `garage_to_expert_request` (Sprint 7.5a) cree par envoi devis

---

## CONTEXTE PHASE 5 -- Vertical Repair

### Position du Sprint 3 dans la Phase 5

Sprint 21 (5.3) -- **Sinistre Workflow + Expert + PartsHub** -- 3eme sprint Phase 5 apres Sprint 19 (Repair Foundation) + Sprint 20 (IA Estimation) + Sprint 20.5 (Sky AI Pre-Training NOUVEAU).

### Modules concernes

@insurtech/repair, @insurtech/expertise (consomme Sprint 14 entites), @insurtech/pay (passerelles MA pour PartsHub fournisseurs), @insurtech/comm (WhatsApp scope strict), @insurtech/signature (Barid eSign rapport expert)

### Apport metier

Workflow sinistre v3.0 correct + facturation realiste circuit garage agree + PartsHub revenue source (commission 3-5%).

---

## EXECUTION SEQUENTIELLE DES 19 TACHES

---

### Tache 1 / 19 : Reception vehicule (PRESERVE v2.2 + tow_mission_id)

**Metadonnees** : P0 | 5h | Depend de : Sprint 20.5

**But** : Workflow reception garage + checklist 12 points + 3 docs customer + signature. **NOUVEAU v3.0** : si vehicule arrive via Tow (Sprint 22.5), attacher tow_mission_id + bon remorquage.

**Commit** :
```bash
git commit -m "feat(sprint-21): reception vehicule + tow_mission_id integration

Task: 5.3.1
Sprint: 21 (Phase 5 / Sprint 3)
Phase: 5 -- Vertical Repair"
```

---

### Tache 2 / 19 : Diagnostic Sky AI enrichi (ENRICHI v3.0)

**Metadonnees** : P0 | 6h | Depend de : 5.3.1

**But** : Diagnostic avec **Sky AI** (Sprint 20.5 pre-trained sur historique garage Saad) au lieu IA generique. Rapport mentionne confidence Sky AI explicitement.

**Commit** :
```bash
git commit -m "feat(sprint-21): diagnostic sky ai enrichi (vs ia generique)

Task: 5.3.2
Sprint: 21 (Phase 5 / Sprint 3)
Phase: 5 -- Vertical Repair"
```

---

### Tache 3 / 19 : Envoi devis a EXPERT (REFONDU v3.0)

**Metadonnees** : P0 | 6h | Depend de : 5.3.2

**But** : **REFONTE CRITIQUE** : devis envoye a EXPERT designe par carrier (CC carrier + COPY customer). Pas au carrier directement. WhatsApp = status only, email = data sensible.

**Actions principales attendues** :
- Migration : ajouter colonnes `repair_devis.expert_assignment_id` + `expert_received_at` + `carrier_cc_user_id`
- Refonte `repo/packages/repair/src/services/devis.service.ts.send()` :
  - Verifier expert designe via `insure_expert_assignments` (Sprint 14)
  - Si pas d'expert : trigger event `repair.devis.expert_designation_required` -> carrier_expert_manager
  - Si expert : envoie email expert + CC carrier + COPY customer + WhatsApp status only
- Pattern complet `sendDevisToExpert()` -- voir B-21 v3.0 Tache 5.3.3 code inline
- Status devis : `quote_sent_to_expert`
- Cron relances : 48h / 72h / 7j escalade
- Tests 10+ scenarios

**Criteres P0 cles** :
- V1 : Verification expert designe AVANT envoi
- V2 : Email = data sensible (devis + diagnostic attached)
- V3 : WhatsApp = status only (whitelist enforced)
- V4 : Status quote_sent_to_expert
- V5 : Tests 10+ PASS
- V6 : Conforme decision-013

**Commit** :
```bash
git commit -m "feat(sprint-21): REFONTE envoi devis a expert designe par carrier (CC carrier)

Task: 5.3.3
Sprint: 21 (Phase 5 / Sprint 3)
Phase: 5 -- Vertical Repair
Decisions: decision-013 expert central"
```

---

### Tache 4 / 19 : Validation expert line-by-line + Barid (REFONDU v3.0)

**Metadonnees** : P0 | 8h | Depend de : 5.3.3

**But** : **REFONTE CRITIQUE** : workflow validation expert (validate/modify/reject) ligne par ligne avec decimal.js precision + signature Barid eSign loi 43-20 + soumission carrier.

**Actions principales attendues** :
- Migration `repair_devis_expert_validations` (decision + justification + modifications jsonb + signature_id + submitted_to_carrier_at)
- Service `expert-validation.service.ts` (preview Sprint 22.7 -- 400 lignes) :
  - `validateDevis(devisId, justification)` -- decision='validated'
  - `modifyDevis(devisId, modifications)` -- pattern code complet voir B-21 v3.0 (decimal.js + line-by-line + audit)
  - `rejectDevis(devisId, justification)`
  - `generateReport(devisId, validationId)` -- react-pdf
  - `signReport(validationId, expertUserId, otp)` -- Barid eSign (Sprint 10)
  - `submitToCarrier(validationId)`
- Status transitions : quote_sent_to_expert -> expertise_in_progress -> quote_validated_by_expert | quote_modified_by_expert | quote_rejected_by_expert
- Tests 12+ scenarios

**Criteres P0 cles** :
- V1 : Migration table validations
- V2 : modifyDevis line-by-line decimal.js precision
- V3 : Signature Barid eSign loi 43-20
- V4 : Submit to carrier apres signed
- V5 : Tests 12+ PASS

**Commit** :
```bash
git commit -m "feat(sprint-21): REFONTE validation expert line-by-line + barid esign

Task: 5.3.4
Sprint: 21 (Phase 5 / Sprint 3)
Phase: 5 -- Vertical Repair
Decisions: decision-013"
```

---

### Tache 5 / 19 : Approbation paiement carrier (REFONDU v3.0)

**Metadonnees** : P0 | 5h | Depend de : 5.3.4

**But** : Apres validation expert signed, soumettre au CARRIER pour validation paiement multi-niveau. Mock Sprint 21 / reel Sprint 26.5 Carrier Portal.

**Actions principales attendues** :
- Migration `repair_devis_carrier_approvals` (FK validation + amount_mad + status pending/approved/rejected/paid)
- Service `carrier-payment-approval.service.ts` (preview Sprint 26.5)
- Workflow status : quote_validated_by_expert -> payment_approval_pending -> payment_approved_by_carrier
- Mock cron : MOCK_CARRIER_APPROVAL_DELAY_HOURS 24-72h, MOCK_REJECTION_RATE 0.05 (5%, vs 10% v2.2 car experts deja filter)
- Tests 8+

**Commit** :
```bash
git commit -m "feat(sprint-21): REFONTE approbation paiement carrier multi-niveau (mock)

Task: 5.3.5
Sprint: 21 (Phase 5 / Sprint 3)
Phase: 5 -- Vertical Repair
Decisions: decision-013"
```

---

### Tache 6 / 19 : Reparation tracking (PRESERVE v2.2 + parts_arrival_status enrichi)

**Metadonnees** : P0 | 6h | Depend de : 5.3.5

**But** : Tracking reparation real-time. **v3.0** : parts_arrival_status source 'internal_stock' (Sprint 13) OR 'partshub_supplier' (Sprint 21 Tache 5.3.16).

**Commit** :
```bash
git commit -m "feat(sprint-21): reparation tracking + parts source partshub|internal

Task: 5.3.6"
```

---

### Tache 7 / 19 : QC + livraison (PRESERVE v2.2)

**Metadonnees** : P0 | 6h | Depend de : 5.3.6

**But** : QC checklist 10 points + livraison + signature reception customer.

**Commit** :
```bash
git commit -m "feat(sprint-21): qc + livraison customer signature

Task: 5.3.7"
```

---

### Tache 8 / 19 : Facturation v3.0 (REFONDU v3.0)

**Metadonnees** : P0 | 5h | Depend de : 5.3.7

**But** : **REFONTE** : 90% cas circuit garage agree = Facture carrier (montant total) + Facture franchise customer (si > 0). 10% cas = Facture customer total. PAS de split assureur 60% / customer 40% comme v2.2.

**Actions principales** :
- Migration : ajouter colonne `repair_invoices.invoice_circuit_type` CHECK (agreed_garage / non_agreed / no_coverage)
- Refonte `invoices.service.ts.generateInvoicesV3()` -- pattern complet voir B-21 v3.0 Tache 5.3.8
- decimal.js precision conservee
- payment_due_days 7 (carrier) vs 0 (customer)
- Tests 10+

**Criteres P0** :
- V1 : Cas agreed_garage : 2 invoices
- V2 : Cas no_coverage : 1 invoice customer
- V3 : decimal.js precision
- V4 : Conforme correction Saad terrain 6+7

**Commit** :
```bash
git commit -m "feat(sprint-21): REFONTE facturation v3.0 carrier->garage direct 90%

Task: 5.3.8
Sprint: 21 (Phase 5 / Sprint 3)
Phase: 5 -- Vertical Repair
Decisions: correction Saad terrain 6+7"
```

---

### Tache 9 / 19 : Documents auto-generes (ENRICHI v3.0)

**Metadonnees** : P0 | 6h | Depend de : 5.3.8

**But** : 8 documents (vs 5 v2.2) : + rapport expertise expert (Tache 5.3.4) + approbation devis expert. Signature Barid eSign.

**Commit** :
```bash
git commit -m "feat(sprint-21): documents auto-generes + rapport expertise barid

Task: 5.3.9"
```

---

### Tache 10 / 19 : Notifications WhatsApp scope strict (ENRICHI v3.0)

**Metadonnees** : P0 | 5h | Depend de : 5.3.9

**But** : Notifications 9 templates. **CRITIQUE v3.0** : WhatsApp = status only (whitelist enforced server-side). Blacklist fields (amount/price/total_mad/franchise/devis_total/cin/password/token).

**Actions** :
- Update `repo/packages/comm/src/services/whatsapp.service.ts` -- pattern `sendWhatsAppStatus()` avec validation template whitelist + blacklist fields data (pattern complet voir B-21 v3.0 Tache 5.3.10)
- 9 templates Comm Sprint 9 + 3 langues
- Email = data sensible / WhatsApp = status / Push = milestones

**Commit** :
```bash
git commit -m "feat(sprint-21): notifications whatsapp scope strict status only (correction saad)

Task: 5.3.10
Decisions: correction terrain saad #7"
```

---

### Tache 11 / 19 : Mock expert + carrier (REFONDU v3.0)

**Metadonnees** : P0 | 5h | Depend de : 5.3.10

**But** : 2 mocks distincts : (1) MockExpertVisitService (visite + decision validated 70% / modified 20% / rejected 10%) (2) MockCarrierPaymentService (approval 90% / rejected 5% / escalation 5%). Sprint 22.7 + Sprint 26.5 reel.

**Commit** :
```bash
git commit -m "feat(sprint-21): mock expert + mock carrier paiement (preview sprints 22.7+26.5)

Task: 5.3.11"
```

---

### Tache 12 / 19 : Garantie tracking (PRESERVE v2.2)

**Metadonnees** : P0 | 5h | Depend de : 5.3.11

**But** : Workflow garantie post-livraison (PRESERVE v2.2 -- voir B-21 v2.2 Tache 5.3.11).

**Commit** :
```bash
git commit -m "feat(sprint-21): garantie tracking + claims workflow

Task: 5.3.12"
```

---

### Tache 13 / 19 : Endpoints REST + permissions (ETENDU v3.0)

**Metadonnees** : P0 | 4h | Depend de : 5.3.12

**But** : Consolidation endpoints + ajout 32 permissions Sprint 7.5a (10 expertise.* + 7 parts.* + 15 v2.2 conservees).

**Commit** :
```bash
git commit -m "feat(sprint-21): endpoints rest + 32 permissions (expertise + parts)

Task: 5.3.13"
```

---

# PARTSHUB PHASE 1 (Taches 14-18) -- NOUVEAU v3.0

---

### Tache 14 / 19 : PartsHub catalog fournisseurs + KYB (NOUVEAU v3.0)

**Metadonnees** : P0 | 6h | Depend de : 5.3.13

**But** : Catalog fournisseurs pieces + workflow KYB onboarding + favorites garage. Module integre dans Assurflow Garage (decision-014).

**Actions principales** :
- Migration 3 tables : `parts_suppliers` (KYB + commission_rate + status) + `parts_supplier_catalog` (part_reference + brand + price + stock + delivery_time) + `parts_suppliers_favorites`
- RLS active 3 tables
- Service `parts-suppliers.service.ts` : onboardSupplier / approveKyb / rejectKyb / searchCatalog (geo + filtres) / addToFavorites / listFavorites
- 4 endpoints REST
- Permissions Sprint 7.5a : `parts.suppliers.read/add_to_favorites`
- Tests 15+

**Commit** :
```bash
git commit -m "feat(sprint-21): NOUVEAU partshub catalog fournisseurs + kyb workflow

Task: 5.3.14
Sprint: 21 (Phase 5 / Sprint 3)
Phase: 5 -- Vertical Repair
Decisions: decision-014 partshub phase 1"
```

---

### Tache 15 / 19 : PartsHub commande automatique fournisseur (NOUVEAU v3.0)

**Metadonnees** : P0 | 5h | Depend de : 5.3.14

**But** : Workflow commande 1-click depuis app garage. API call fournisseur + email backup. Workflow status (draft -> sent -> accepted -> in_transit -> delivered -> received_in_stock).

**Actions** :
- Migration `parts_orders` table complete
- Service `parts-orders.service.ts` : createOrder (1-click) / sendToSupplier / cancelOrder / updateStatus
- Cross-tenant ou supplier comme tenant externe
- Tests 12+

**Commit** :
```bash
git commit -m "feat(sprint-21): NOUVEAU partshub commande automatique fournisseur

Task: 5.3.15
Decisions: decision-014"
```

---

### Tache 16 / 19 : PartsHub tracking livraison + receive (NOUVEAU v3.0)

**Metadonnees** : P0 | 4h | Depend de : 5.3.15

**But** : Tracking livraison real-time + workflow receive piece au garage + integration stock interne Sprint 13. Update Tache 5.3.6 parts_arrival_status source='partshub_supplier'.

**Actions** :
- Service `parts-orders-tracking.service.ts` : updateDeliveryStatus / markDelivered (photo proof) / receiveInStock (integration Sprint 13) / reportDamaged
- Tests 10+

**Commit** :
```bash
git commit -m "feat(sprint-21): NOUVEAU partshub tracking livraison + stock integration

Task: 5.3.16"
```

---

### Tache 17 / 19 : PartsHub paiement fournisseurs (NOUVEAU v3.0)

**Metadonnees** : P0 | 5h | Depend de : 5.3.16

**But** : Integration Sprint 11 Pay passerelles MA (CMI / virement / Mobile Money). **Commission Assurflow 3-5% auto-deduite** lors paiement.

**Actions** :
- Service `parts-payments.service.ts.payOrder()` -- pattern complet voir B-21 v3.0 Tache 5.3.17 (decimal.js commission)
- Workflow : received_in_stock -> payment_initiated -> payment_completed
- Log commission tracking
- Tests 10+

**Criteres P0** :
- V1 : Commission auto-deduite decimal.js
- V2 : Integration Sprint 11
- V3 : Tests 10+ PASS

**Commit** :
```bash
git commit -m "feat(sprint-21): NOUVEAU partshub paiement fournisseurs + commission 3-5%

Task: 5.3.17
Decisions: decision-014"
```

---

### Tache 18 / 19 : PartsHub commission tracking + dashboard (NOUVEAU v3.0)

**Metadonnees** : P0 | 5h | Depend de : 5.3.17

**But** : Commission tracking complete + 2 dashboards (Assurflow admin + garage_parts_manager).

**Actions** :
- Migration `parts_commission_log` (cree Tache 5.3.17, schema complete)
- Service `parts-commission.service.ts` : computeCommissionStats / listPendingCommissions / markCommissionPaid
- 2 dashboards REST endpoints
- Tests 10+

**Commit** :
```bash
git commit -m "feat(sprint-21): NOUVEAU partshub commission tracking + dashboards

Task: 5.3.18"
```

---

### Tache 19 / 19 : Tests E2E workflow complet v3.0 (60+) (REFONDU v3.0)

**Metadonnees** : P0 | 9h | Depend de : 5.3.18

**But** : 60+ tests E2E (vs 40 v2.2). Workflow happy path complet v3.0 + PartsHub + expert + edge cases.

**Actions** :
- Tests E2E 60+ : reception / diagnostic / devis expert / expert validation / carrier approval / reparation + PartsHub / facturation v3.0 / documents / notifications WhatsApp scope / mock / garantie / PartsHub edge cases
- Seeds Sprint 21 fixtures v3.0 (~600 lignes)
- Edge cases 7+

**Commit** :
```bash
git commit -m "test(sprint-21): tests e2e 60+ workflow v3.0 + edge cases

Task: 5.3.19"
```

---

## SYNTHESE -- Cloture Sprint 21 v3.0

Apres execution des 19 taches :

```bash
# Verifier 19 commits
git log --since="2 weeks ago" --pretty=format:"%s" -- repo/ | grep "Task: 5.3" | wc -l
# Attendu : 19

# 0 emoji
grep -rP "[\x{1F300}-\x{1F9FF}]" repo/ --include="*.ts" --include="*.md" | wc -l
# Attendu : 0

# Lancer V-21
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-21-sprint-21-verification.md

# Si V-21 GO (>= 95%)
git tag -a "sprint-21-complete-v3-workflow-expert-partshub" -m "Sprint 21 v3.0 complete

- Workflow expert correct (devis -> expert -> carrier)
- Facturation v3.0 carrier->garage 90% cas
- PartsHub commission 3-5%
- 60+ tests E2E PASS"

git push origin sprint-21-complete-v3-workflow-expert-partshub
```

---

## RESUME DU WORKFLOW

```
[Demarrage Sprint 21 v3.0]
   |
   v
[Taches 5.3.1-2 : reception + diagnostic Sky AI]
   |
   v
[Taches 5.3.3-5 : REFONTE devis expert + validation + carrier payment]
   |
   v
[Taches 5.3.6-7 : reparation + QC + livraison] 
   |
   v
[Tache 5.3.8 : REFONTE facturation v3.0]
   |
   v
[Taches 5.3.9-13 : documents + notifications + mock + garantie + endpoints]
   |
   v
[Taches 5.3.14-18 : NOUVEAU PartsHub Phase 1 complet]
   |
   v
[Tache 5.3.19 : Tests E2E 60+]
   |
   v
[V-21 verification automatique]
   |
   v
[Score >= 95%] -> GO -> tag -> Sprint 22
```

**Duree totale** : 100 heures (vs 74h v2.2). +26h pour expert workflow + PartsHub Phase 1.

**Modules affectes** : @insurtech/repair, @insurtech/expertise (preview), @insurtech/pay, @insurtech/comm, @insurtech/signature, @insurtech/database, apps/api

**Apport metier principal** : Workflow expert central correct + facturation realiste + PartsHub revenue.

**Prerequis Sprint 22** : Sprint 21 v3.0 GO complet (score >= 95% V-21).

**Sprint suivant** : Sprint 22 Web Garage App.

---

## COMMANDES DE LANCEMENT

### Prerequis (Sprint 20.5 GO)
```bash
ls skalean-insurtech/sprint20.5-verify-report.md
grep '^Statut.*GO' skalean-insurtech/sprint20.5-verify-report.md
```

### Lancement Sprint 21 v3.0
```bash
claude-code \
  --orchestrator skalean-insurtech/00-pilotage/meta-prompts/phase-C-orchestration/C-21-sprint-21-sinistre-workflow.md \
  --reference-prompt skalean-insurtech/00-pilotage/meta-prompts/phase-B-tasks/B-21-sprint-21-sinistre-workflow.md \
  --verification skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-21-sprint-21-verification.md
```

### Suivi temps reel
```bash
tail -f skalean-insurtech/cowork-sprint-21.log
git log --oneline --since="2 weeks ago" -- repo/ | grep "Sprint: 21"
```

### Apres completion
```bash
cat skalean-insurtech/sprint21-verify-report.md
```

---

## NOTES IMPORTANTES POUR COWORK

1. **Lire B-21 v3.0 complet** AVANT generation prompts taches (refonte critique)
2. **5 patterns code inline B-21 v3.0** (Tache 5.3.3 sendDevisToExpert + Tache 5.3.4 modifyDevis + Tache 5.3.8 generateInvoicesV3 + Tache 5.3.10 sendWhatsAppStatus + Tache 5.3.17 payOrder commission) = OBLIGATOIRES reproduits fidelement
3. **Workflow expert decision-013** : ne JAMAIS envoyer devis a carrier directement
4. **decimal.js partout** : facturation v3.0 + commission PartsHub + validation expert line-by-line
5. **WhatsApp scope strict** : decision Saad correction terrain #7 = absolu, blacklist fields enforced server-side
6. **5 patterns reels devis garage Saad** comme fixtures Sprint 21 (asset unique)
7. **NE JAMAIS modifier 00-pilotage/** -- uniquement repo/

---

**Fin orchestrateur C-21 v3.0 -- Sprint 21 (5.3) Sinistre Workflow + Expert + PartsHub.**

**Total taches** : 19 | **Effort** : ~100h | **Apport** : Workflow expert + PartsHub commission 3-5%
