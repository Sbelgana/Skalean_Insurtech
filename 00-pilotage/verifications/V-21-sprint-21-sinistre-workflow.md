# VERIFICATION SPRINT 21 -- Phase 5 / Sprint 3 : Sinistre Workflow Detaille
# Version : Auto-reparation active + Rapport final MD detaille
# 13 taches, 64 criteres extraits B-21
# AUCUNE EMOJI AUTORISEE

**Version** : v2.2 (verification detaillee)
**Phase** : 5 -- Vertical Repair (Skalean Garage ERP)
**Sprint** : 21 / 35 (cumul) -- Sprint 3 dans Phase 5
**Reference meta-prompt** : `B-21-sprint-21-sinistre-workflow.md`
**Reference orchestrateur** : `C-21-sprint-21-sinistre-workflow.md`
**Total criteres** : 64 criteres taches + ~10 transversaux

---

Tu es **Claude Code (ou Cowork)**. Tu dois executer une **verification COMPLETE et EXHAUSTIVE** du Sprint 21 apres execution toutes les 13 taches.

---

## REGLES D'EXECUTION

1. Tu **executes CHAQUE verification dans l'ordre** (taches puis transversales)
2. Quand une verification echoue, tu **TENTES UNE REPARATION AUTOMATIQUE** avant de noter FAIL
3. Apres chaque tentative de reparation, tu **re-executes la verification**
4. Tu consignes dans `sprint21-verify-report.md` **TOUS les resultats** au fil de l'execution
5. A la fin, tu produis le **rapport consolide** + calcul score GO/GO CONDITIONNEL/NO-GO
6. Tu **n'interromps JAMAIS** l'execution -- meme si une tache echoue, tu passes a la suivante

---

## FORMAT DU RAPPORT

Chaque test produit une ligne dans le tableau :

| ID | Description | Statut | Details |
|----|-------------|--------|---------|
| T01-V1 | Critere V1 Tache 1 | PASS | Details |

**Convention IDs** :
- `T{NN}-V{N}` : critere V{N} de Tache {NN} (ex : T01-V1, T15-V3)
- `T{NN}-F{N}` : critere fichier de Tache {NN} (ex : T01-F1)
- `TR-{TYPE}` : critere transversal sprint (ex : TR-BUILD, TR-TYPECHECK, TR-NO-EMOJI)

**Statuts** :
- `PASS` -- reussi au premier essai
- `PASS*` -- reussi apres reparation automatique
- `FAIL` -- echec, reparation impossible (P0 = bloquant)
- `SKIP` -- ignore (prerequis manquant)
- `WARN` -- partiellement reussi OU critere manuel non-automatisable

---

## PHASE DE PREPARATION

```bash
REPORT_FILE="sprint21-verify-report.md"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
RUN_ID=$(date '+%Y%m%d-%H%M%S')

cat > "$REPORT_FILE" << EOF
# Rapport de Verification - Sprint 21 : Sinistre Workflow Detaille

**Date** : $TIMESTAMP
**Run ID** : $RUN_ID
**Phase** : 5 -- Vertical Repair (Skalean Garage ERP)
**Sprint** : 21 (Phase 5 / Sprint 3)
**Reference B-21** : 13 taches, 64 criteres extraits
**Executeur** : Claude Code / Cowork (auto-verification + auto-reparation)

---

## Legende

- **PASS** : verification reussie au premier essai
- **PASS\*** : verification reussie apres reparation automatique
- **FAIL** : verification echouee, reparation impossible (P0 = bloquant)
- **SKIP** : verification ignoree (prerequis manquant)
- **WARN** : verification partiellement reussie / manuelle

---

EOF

echo "[PREP] Rapport initialise : $REPORT_FILE"

# Variables globales
PASS=0
PASS_REPAIRED=0
FAIL=0
SKIP=0
WARN=0
TABLE_ROWS=""

# Fonction d'ajout de ligne dans le rapport
add_row() {
  local id="$1" desc="$2" status="$3" details="$4"
  TABLE_ROWS="$TABLE_ROWS| $id | $desc | $status | $details |\n"
  case "$status" in
    PASS)    ((PASS++)) ;;
    "PASS*") ((PASS_REPAIRED++)) ;;
    FAIL)    ((FAIL++)) ;;
    SKIP)    ((SKIP++)) ;;
    WARN)    ((WARN++)) ;;
  esac
  echo "[$status] $id - $desc : $details"
}

# Variables connexion DB skalean-insurtech
DB_URL="${DATABASE_URL:-postgresql://insurtech_user:SecurePassword123!@localhost:5432/insurtech}"
REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6379}"

# Variables Skalean AI (service externe)
SKALEAN_AI_BASE_URL="${SKALEAN_AI_BASE_URL:-https://api-mock.skalean.ai}"
SKALEAN_AI_API_KEY="${SKALEAN_AI_API_KEY:-test_api_key}"

# Helpers
pg_query() { psql "$DB_URL" -t -c "$1" 2>/dev/null | tr -d ' \n'; }
pg_query_raw() { psql "$DB_URL" -c "$1" 2>/dev/null; }
```

---

## VERIFICATIONS PAR TACHE (13 taches)

## TACHE 1/5 -- 5.3.1 : Reception Vehicule

```bash
echo ""
echo "================================================"
echo "TACHE 5.3.1 : Reception Vehicule"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T01-F1: Existence fichier repo/packages/database/src/migrations/{date}-RepairReceptions.ts
if [ -f "repo/packages/database/src/migrations/{date}-RepairReceptions.ts" ]; then
  add_row "T01-F1" "Fichier {date}-RepairReceptions.ts existe" "PASS" "Cree"
else
  add_row "T01-F1" "Fichier {date}-RepairReceptions.ts existe" "FAIL" "Manquant"
fi
# Test T01-F2: Existence fichier repo/packages/repair/src/entities/repair-reception.entity.ts
if [ -f "repo/packages/repair/src/entities/repair-reception.entity.ts" ]; then
  add_row "T01-F2" "Fichier repair-reception.entity.ts existe" "PASS" "Cree"
else
  add_row "T01-F2" "Fichier repair-reception.entity.ts existe" "FAIL" "Manquant"
fi
# Test T01-F3: Existence fichier repo/packages/repair/src/services/receptions.service.ts
if [ -f "repo/packages/repair/src/services/receptions.service.ts" ]; then
  add_row "T01-F3" "Fichier receptions.service.ts existe" "PASS" "Cree"
else
  add_row "T01-F3" "Fichier receptions.service.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T01-V1: Reception start + photos + checklist (P0)
echo "  Verifying T01-V1 : Reception start + photos + checklist..."
add_row "T01-V1" "Reception start + photos + checklist" "WARN" "(P0) Voir B-21 Tache 5.3.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V2: 3 documents customer uploaded (P0)
echo "  Verifying T01-V2 : 3 documents customer uploaded..."
add_row "T01-V2" "3 documents customer uploaded" "WARN" "(P0) Voir B-21 Tache 5.3.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V3: Signature reception customer (P0)
echo "  Verifying T01-V3 : Signature reception customer..."
add_row "T01-V3" "Signature reception customer" "WARN" "(P0) Voir B-21 Tache 5.3.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V4: Transition sinistre 'under_diagnostic' (P0)
echo "  Verifying T01-V4 : Transition sinistre 'under_diagnostic'..."
add_row "T01-V4" "Transition sinistre 'under_diagnostic'" "WARN" "(P0) Voir B-21 Tache 5.3.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V5: Tests 8+ scenarios (P0)
echo "  Verifying T01-V5 : Tests 8+ scenarios..."
add_row "T01-V5" "Tests 8+ scenarios" "WARN" "(P0) Voir B-21 Tache 5.3.1 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 2/4 -- 5.3.2 : Diagnostic Enrichi : IA + Technicien

```bash
echo ""
echo "================================================"
echo "TACHE 5.3.2 : Diagnostic Enrichi : IA + Technicien"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 4"
echo "================================================"

# === Verification fichiers crees ===
# Test T02-F1: Existence fichier repo/packages/repair/src/services/diagnostics.service.ts
if [ -f "repo/packages/repair/src/services/diagnostics.service.ts" ]; then
  add_row "T02-F1" "Fichier diagnostics.service.ts existe" "PASS" "Cree"
else
  add_row "T02-F1" "Fichier diagnostics.service.ts existe" "FAIL" "Manquant"
fi
# Test T02-F2: Existence fichier repo/packages/docs/src/templates/{fr,ar-MA,ar}/diagnostic-report.hbs
if [ -f "repo/packages/docs/src/templates/{fr,ar-MA,ar}/diagnostic-report.hbs" ]; then
  add_row "T02-F2" "Fichier diagnostic-report.hbs existe" "PASS" "Cree"
else
  add_row "T02-F2" "Fichier diagnostic-report.hbs existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T02-V1: Diagnostic enriched IA + technicien (P0)
echo "  Verifying T02-V1 : Diagnostic enriched IA + technicien..."
add_row "T02-V1" "Diagnostic enriched IA + technicien" "WARN" "(P0) Voir B-21 Tache 5.3.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V2: Photos additionnelles upload (P0)
echo "  Verifying T02-V2 : Photos additionnelles upload..."
add_row "T02-V2" "Photos additionnelles upload" "WARN" "(P0) Voir B-21 Tache 5.3.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V3: Rapport technique PDF generated (P0)
echo "  Verifying T02-V3 : Rapport technique PDF generated..."
add_row "T02-V3" "Rapport technique PDF generated" "WARN" "(P0) Voir B-21 Tache 5.3.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V4: Tests 6+ scenarios (P0)
echo "  Verifying T02-V4 : Tests 6+ scenarios..."
add_row "T02-V4" "Tests 6+ scenarios" "WARN" "(P0) Voir B-21 Tache 5.3.2 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 3/5 -- 5.3.3 : Envoi Devis : Assureur + Client + Tracking

```bash
echo ""
echo "================================================"
echo "TACHE 5.3.3 : Envoi Devis : Assureur + Client + Tracking"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T03-F1: Existence fichier repo/packages/database/src/migrations/{date}-AddDevisReadTracking.ts
if [ -f "repo/packages/database/src/migrations/{date}-AddDevisReadTracking.ts" ]; then
  add_row "T03-F1" "Fichier {date}-AddDevisReadTracking.ts existe" "PASS" "Cree"
else
  add_row "T03-F1" "Fichier {date}-AddDevisReadTracking.ts existe" "FAIL" "Manquant"
fi
# Test T03-F2: Existence fichier repo/packages/repair/src/services/devis.service.ts
if [ -f "repo/packages/repair/src/services/devis.service.ts" ]; then
  add_row "T03-F2" "Fichier devis.service.ts existe" "PASS" "Cree"
else
  add_row "T03-F2" "Fichier devis.service.ts existe" "FAIL" "Manquant"
fi
# Test T03-F3: Existence fichier repo/packages/repair/src/jobs/devis-relances-cron.ts
if [ -f "repo/packages/repair/src/jobs/devis-relances-cron.ts" ]; then
  add_row "T03-F3" "Fichier devis-relances-cron.ts existe" "PASS" "Cree"
else
  add_row "T03-F3" "Fichier devis-relances-cron.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T03-V1: Recipients logic correct (P0)
echo "  Verifying T03-V1 : Recipients logic correct..."
add_row "T03-V1" "Recipients logic correct" "WARN" "(P0) Voir B-21 Tache 5.3.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V2: Tracking lecture (P0)
echo "  Verifying T03-V2 : Tracking lecture..."
add_row "T03-V2" "Tracking lecture" "WARN" "(P0) Voir B-21 Tache 5.3.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V3: Relances automatiques (P0)
echo "  Verifying T03-V3 : Relances automatiques..."
add_row "T03-V3" "Relances automatiques" "WARN" "(P0) Voir B-21 Tache 5.3.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V4: Mock assureur approval simulation (P0)
echo "  Verifying T03-V4 : Mock assureur approval simulation..."
add_row "T03-V4" "Mock assureur approval simulation" "WARN" "(P0) Voir B-21 Tache 5.3.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V5: Tests 10+ scenarios (P0)
echo "  Verifying T03-V5 : Tests 10+ scenarios..."
add_row "T03-V5" "Tests 10+ scenarios" "WARN" "(P0) Voir B-21 Tache 5.3.3 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 4/4 -- 5.3.4 : Approbation Tracking : Conditions + Extensions

```bash
echo ""
echo "================================================"
echo "TACHE 5.3.4 : Approbation Tracking : Conditions + Extensions"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 4"
echo "================================================"

# === Verification fichiers crees ===
# Test T04-F1: Existence fichier repo/packages/database/src/migrations/{date}-RepairDevisApprovals.ts
if [ -f "repo/packages/database/src/migrations/{date}-RepairDevisApprovals.ts" ]; then
  add_row "T04-F1" "Fichier {date}-RepairDevisApprovals.ts existe" "PASS" "Cree"
else
  add_row "T04-F1" "Fichier {date}-RepairDevisApprovals.ts existe" "FAIL" "Manquant"
fi
# Test T04-F2: Existence fichier repo/packages/repair/src/entities/repair-devis-approval.entity.ts
if [ -f "repo/packages/repair/src/entities/repair-devis-approval.entity.ts" ]; then
  add_row "T04-F2" "Fichier repair-devis-approval.entity.ts existe" "PASS" "Cree"
else
  add_row "T04-F2" "Fichier repair-devis-approval.entity.ts existe" "FAIL" "Manquant"
fi
# Test T04-F3: Existence fichier repo/packages/repair/src/services/devis-approvals.service.ts
if [ -f "repo/packages/repair/src/services/devis-approvals.service.ts" ]; then
  add_row "T04-F3" "Fichier devis-approvals.service.ts existe" "PASS" "Cree"
else
  add_row "T04-F3" "Fichier devis-approvals.service.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T04-V1: Approval avec conditions stockees (P0)
echo "  Verifying T04-V1 : Approval avec conditions stockees..."
add_row "T04-V1" "Approval avec conditions stockees" "WARN" "(P0) Voir B-21 Tache 5.3.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V2: Avenants supported (P0)
echo "  Verifying T04-V2 : Avenants supported..."
add_row "T04-V2" "Avenants supported" "WARN" "(P0) Voir B-21 Tache 5.3.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V3: getApprovalConditions retourne data complete (P0)
echo "  Verifying T04-V3 : getApprovalConditions retourne data complete..."
add_row "T04-V3" "getApprovalConditions retourne data complete" "WARN" "(P0) Voir B-21 Tache 5.3.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V4: Tests 8+ scenarios (P0)
echo "  Verifying T04-V4 : Tests 8+ scenarios..."
add_row "T04-V4" "Tests 8+ scenarios" "WARN" "(P0) Voir B-21 Tache 5.3.4 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 5/5 -- 5.3.5 : Reparation Tracking Real-Time

```bash
echo ""
echo "================================================"
echo "TACHE 5.3.5 : Reparation Tracking Real-Time"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T05-F1: Existence fichier repo/packages/database/src/migrations/{date}-AddOrderTrackingColumns.ts
if [ -f "repo/packages/database/src/migrations/{date}-AddOrderTrackingColumns.ts" ]; then
  add_row "T05-F1" "Fichier {date}-AddOrderTrackingColumns.ts existe" "PASS" "Cree"
else
  add_row "T05-F1" "Fichier {date}-AddOrderTrackingColumns.ts existe" "FAIL" "Manquant"
fi
# Test T05-F2: Existence fichier repo/packages/repair/src/services/orders-tracking.service.ts
if [ -f "repo/packages/repair/src/services/orders-tracking.service.ts" ]; then
  add_row "T05-F2" "Fichier orders-tracking.service.ts existe" "PASS" "Cree"
else
  add_row "T05-F2" "Fichier orders-tracking.service.ts existe" "FAIL" "Manquant"
fi
# Test T05-F3: Existence fichier repo/packages/comm/src/templates/{fr,ar-MA,ar}/repair-progress-update.hbs
if [ -f "repo/packages/comm/src/templates/{fr,ar-MA,ar}/repair-progress-update.hbs" ]; then
  add_row "T05-F3" "Fichier repair-progress-update.hbs existe" "PASS" "Cree"
else
  add_row "T05-F3" "Fichier repair-progress-update.hbs existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T05-V1: % completion tracking (P0)
echo "  Verifying T05-V1 : % completion tracking..."
add_row "T05-V1" "% completion tracking" "WARN" "(P0) Voir B-21 Tache 5.3.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V2: Parts arrival tracking (P0)
echo "  Verifying T05-V2 : Parts arrival tracking..."
add_row "T05-V2" "Parts arrival tracking" "WARN" "(P0) Voir B-21 Tache 5.3.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V3: Hours logged HR (P0)
echo "  Verifying T05-V3 : Hours logged HR..."
add_row "T05-V3" "Hours logged HR" "WARN" "(P0) Voir B-21 Tache 5.3.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V4: Notifications milestones (P0)
echo "  Verifying T05-V4 : Notifications milestones..."
add_row "T05-V4" "Notifications milestones" "WARN" "(P0) Voir B-21 Tache 5.3.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V5: Tests 10+ scenarios (P0)
echo "  Verifying T05-V5 : Tests 10+ scenarios..."
add_row "T05-V5" "Tests 10+ scenarios" "WARN" "(P0) Voir B-21 Tache 5.3.5 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 6/6 -- 5.3.6 : QC Checklist + Livraison

```bash
echo ""
echo "================================================"
echo "TACHE 5.3.6 : QC Checklist + Livraison"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 6"
echo "================================================"

# === Verification fichiers crees ===
# Test T06-F1: Existence fichier repo/packages/database/src/migrations/{date}-RepairQualityChecks.ts
if [ -f "repo/packages/database/src/migrations/{date}-RepairQualityChecks.ts" ]; then
  add_row "T06-F1" "Fichier {date}-RepairQualityChecks.ts existe" "PASS" "Cree"
else
  add_row "T06-F1" "Fichier {date}-RepairQualityChecks.ts existe" "FAIL" "Manquant"
fi
# Test T06-F2: Existence fichier repo/packages/database/src/migrations/{date}-RepairDeliveries.ts
if [ -f "repo/packages/database/src/migrations/{date}-RepairDeliveries.ts" ]; then
  add_row "T06-F2" "Fichier {date}-RepairDeliveries.ts existe" "PASS" "Cree"
else
  add_row "T06-F2" "Fichier {date}-RepairDeliveries.ts existe" "FAIL" "Manquant"
fi
# Test T06-F3: Existence fichier repo/packages/repair/src/entities/{2 entities}.ts
if [ -f "repo/packages/repair/src/entities/{2 entities}.ts" ]; then
  add_row "T06-F3" "Fichier {2 entities}.ts existe" "PASS" "Cree"
else
  add_row "T06-F3" "Fichier {2 entities}.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T06-V1: QC 10 points + photos (P0)
echo "  Verifying T06-V1 : QC 10 points + photos..."
add_row "T06-V1" "QC 10 points + photos" "WARN" "(P0) Voir B-21 Tache 5.3.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V2: QC failed -> re-work (P0)
echo "  Verifying T06-V2 : QC failed -> re-work..."
add_row "T06-V2" "QC failed -> re-work" "WARN" "(P0) Voir B-21 Tache 5.3.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V3: Delivery + signature (P0)
echo "  Verifying T06-V3 : Delivery + signature..."
add_row "T06-V3" "Delivery + signature" "WARN" "(P0) Voir B-21 Tache 5.3.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V4: Bon livraison PDF (P0)
echo "  Verifying T06-V4 : Bon livraison PDF..."
add_row "T06-V4" "Bon livraison PDF" "WARN" "(P0) Voir B-21 Tache 5.3.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V5: Satisfaction rating (P0)
echo "  Verifying T06-V5 : Satisfaction rating..."
add_row "T06-V5" "Satisfaction rating" "WARN" "(P0) Voir B-21 Tache 5.3.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V6: Tests 10+ scenarios (P0)
echo "  Verifying T06-V6 : Tests 10+ scenarios..."
add_row "T06-V6" "Tests 10+ scenarios" "WARN" "(P0) Voir B-21 Tache 5.3.6 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 7/8 -- 5.3.7 : Facturation Split Assureur / Customer

```bash
echo ""
echo "================================================"
echo "TACHE 5.3.7 : Facturation Split Assureur / Customer"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 8"
echo "================================================"

# === Verification fichiers crees ===
# Test T07-F1: Existence fichier repo/packages/database/src/migrations/{date}-AddInvoiceSplitParent.ts
if [ -f "repo/packages/database/src/migrations/{date}-AddInvoiceSplitParent.ts" ]; then
  add_row "T07-F1" "Fichier {date}-AddInvoiceSplitParent.ts existe" "PASS" "Cree"
else
  add_row "T07-F1" "Fichier {date}-AddInvoiceSplitParent.ts existe" "FAIL" "Manquant"
fi
# Test T07-F2: Existence fichier repo/packages/repair/src/services/invoices.service.ts
if [ -f "repo/packages/repair/src/services/invoices.service.ts" ]; then
  add_row "T07-F2" "Fichier invoices.service.ts existe" "PASS" "Cree"
else
  add_row "T07-F2" "Fichier invoices.service.ts existe" "FAIL" "Manquant"
fi
# Test T07-F3: Existence fichier repo/packages/repair/src/services/invoices.service.spec.ts
if [ -f "repo/packages/repair/src/services/invoices.service.spec.ts" ]; then
  add_row "T07-F3" "Fichier invoices.service.spec.ts existe" "PASS" "Cree"
else
  add_row "T07-F3" "Fichier invoices.service.spec.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T07-V1: Split correct (insurer + customer) (P0)
echo "  Verifying T07-V1 : Split correct (insurer + customer)..."
add_row "T07-V1" "Split correct (insurer + customer)" "WARN" "(P0) Voir B-21 Tache 5.3.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V2: Pas police : customer full (P0)
echo "  Verifying T07-V2 : Pas police : customer full..."
add_row "T07-V2" "Pas police : customer full" "WARN" "(P0) Voir B-21 Tache 5.3.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V3: Coverage cap respect (P0)
echo "  Verifying T07-V3 : Coverage cap respect..."
add_row "T07-V3" "Coverage cap respect" "WARN" "(P0) Voir B-21 Tache 5.3.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V4: Exclusions imputed customer (P0)
echo "  Verifying T07-V4 : Exclusions imputed customer..."
add_row "T07-V4" "Exclusions imputed customer" "WARN" "(P0) Voir B-21 Tache 5.3.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V5: Edge case : full coverage = customer 0 (P0)
echo "  Verifying T07-V5 : Edge case : full coverage = customer 0..."
add_row "T07-V5" "Edge case : full coverage = customer 0" "WARN" "(P0) Voir B-21 Tache 5.3.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V6: Edge case : pas couverture = customer total (P0)
echo "  Verifying T07-V6 : Edge case : pas couverture = customer total..."
add_row "T07-V6" "Edge case : pas couverture = customer total" "WARN" "(P0) Voir B-21 Tache 5.3.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V7: decimal.js precision (P0)
echo "  Verifying T07-V7 : decimal.js precision..."
add_row "T07-V7" "decimal.js precision" "WARN" "(P0) Voir B-21 Tache 5.3.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V8: Tests 12+ scenarios (P0)
echo "  Verifying T07-V8 : Tests 12+ scenarios..."
add_row "T07-V8" "Tests 12+ scenarios" "WARN" "(P0) Voir B-21 Tache 5.3.7 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 8/5 -- 5.3.8 : Documents Auto-Generes

```bash
echo ""
echo "================================================"
echo "TACHE 5.3.8 : Documents Auto-Generes"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T08-F1: Existence fichier repo/packages/docs/src/templates/{fr,ar-MA,ar}/bon-reception.hbs
if [ -f "repo/packages/docs/src/templates/{fr,ar-MA,ar}/bon-reception.hbs" ]; then
  add_row "T08-F1" "Fichier bon-reception.hbs existe" "PASS" "Cree"
else
  add_row "T08-F1" "Fichier bon-reception.hbs existe" "FAIL" "Manquant"
fi
# Test T08-F2: Existence fichier repo/packages/docs/src/templates/{fr,ar-MA,ar}/diagnostic-report.hbs
if [ -f "repo/packages/docs/src/templates/{fr,ar-MA,ar}/diagnostic-report.hbs" ]; then
  add_row "T08-F2" "Fichier diagnostic-report.hbs existe" "PASS" "Cree"
else
  add_row "T08-F2" "Fichier diagnostic-report.hbs existe" "FAIL" "Manquant"
fi
# Test T08-F3: Existence fichier repo/packages/docs/src/templates/{fr,ar-MA,ar}/devis-approval.hbs
if [ -f "repo/packages/docs/src/templates/{fr,ar-MA,ar}/devis-approval.hbs" ]; then
  add_row "T08-F3" "Fichier devis-approval.hbs existe" "PASS" "Cree"
else
  add_row "T08-F3" "Fichier devis-approval.hbs existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T08-V1: 5 documents auto-generes (P0)
echo "  Verifying T08-V1 : 5 documents auto-generes..."
add_row "T08-V1" "5 documents auto-generes" "WARN" "(P0) Voir B-21 Tache 5.3.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V2: Templates 3 locales (P0)
echo "  Verifying T08-V2 : Templates 3 locales..."
add_row "T08-V2" "Templates 3 locales" "WARN" "(P0) Voir B-21 Tache 5.3.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V3: Auto-attach sinistre (P0)
echo "  Verifying T08-V3 : Auto-attach sinistre..."
add_row "T08-V3" "Auto-attach sinistre" "WARN" "(P0) Voir B-21 Tache 5.3.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V4: Archive 10 ans (P0)
echo "  Verifying T08-V4 : Archive 10 ans..."
add_row "T08-V4" "Archive 10 ans" "WARN" "(P0) Voir B-21 Tache 5.3.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V5: Tests 8+ scenarios (P0)
echo "  Verifying T08-V5 : Tests 8+ scenarios..."
add_row "T08-V5" "Tests 8+ scenarios" "WARN" "(P0) Voir B-21 Tache 5.3.8 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 9/5 -- 5.3.9 : Notifications Real-Time Multi-Channel

```bash
echo ""
echo "================================================"
echo "TACHE 5.3.9 : Notifications Real-Time Multi-Channel"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T09-F1: Existence fichier repo/packages/comm/src/templates/{fr,ar-MA,ar}/repair-{8 templates}.hbs
if [ -f "repo/packages/comm/src/templates/{fr,ar-MA,ar}/repair-{8 templates}.hbs" ]; then
  add_row "T09-F1" "Fichier repair-{8 templates}.hbs existe" "PASS" "Cree"
else
  add_row "T09-F1" "Fichier repair-{8 templates}.hbs existe" "FAIL" "Manquant"
fi
# Test T09-F2: Existence fichier repo/packages/repair/src/consumers/repair-events-to-comm.consumer.ts
if [ -f "repo/packages/repair/src/consumers/repair-events-to-comm.consumer.ts" ]; then
  add_row "T09-F2" "Fichier repair-events-to-comm.consumer.ts existe" "PASS" "Cree"
else
  add_row "T09-F2" "Fichier repair-events-to-comm.consumer.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T09-V1: 8 templates locales 3 langues (P0)
echo "  Verifying T09-V1 : 8 templates locales 3 langues..."
add_row "T09-V1" "8 templates locales 3 langues" "WARN" "(P0) Voir B-21 Tache 5.3.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V2: Auto-trigger sur events Kafka (P0)
echo "  Verifying T09-V2 : Auto-trigger sur events Kafka..."
add_row "T09-V2" "Auto-trigger sur events Kafka" "WARN" "(P0) Voir B-21 Tache 5.3.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V3: Multi-channel selon urgency (P0)
echo "  Verifying T09-V3 : Multi-channel selon urgency..."
add_row "T09-V3" "Multi-channel selon urgency" "WARN" "(P0) Voir B-21 Tache 5.3.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V4: Locale customer respect (P0)
echo "  Verifying T09-V4 : Locale customer respect..."
add_row "T09-V4" "Locale customer respect" "WARN" "(P0) Voir B-21 Tache 5.3.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V5: Tests 10+ scenarios (P0)
echo "  Verifying T09-V5 : Tests 10+ scenarios..."
add_row "T09-V5" "Tests 10+ scenarios" "WARN" "(P0) Voir B-21 Tache 5.3.9 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 10/5 -- 5.3.10 : Mock Integration Assureur

```bash
echo ""
echo "================================================"
echo "TACHE 5.3.10 : Mock Integration Assureur"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T10-F1: Existence fichier repo/packages/repair/src/services/mock-insurer-integration.service.ts
if [ -f "repo/packages/repair/src/services/mock-insurer-integration.service.ts" ]; then
  add_row "T10-F1" "Fichier mock-insurer-integration.service.ts existe" "PASS" "Cree"
else
  add_row "T10-F1" "Fichier mock-insurer-integration.service.ts existe" "FAIL" "Manquant"
fi
# Test T10-F2: Existence fichier repo/packages/repair/src/jobs/mock-insurer-callbacks.cron.ts
if [ -f "repo/packages/repair/src/jobs/mock-insurer-callbacks.cron.ts" ]; then
  add_row "T10-F2" "Fichier mock-insurer-callbacks.cron.ts existe" "PASS" "Cree"
else
  add_row "T10-F2" "Fichier mock-insurer-callbacks.cron.ts existe" "FAIL" "Manquant"
fi
# Test T10-F3: Existence fichier repo/docs/insurer-integration-migration-sprint-32.md
if [ -f "repo/docs/insurer-integration-migration-sprint-32.md" ]; then
  add_row "T10-F3" "Fichier insurer-integration-migration-sprint-32.md existe" "PASS" "Cree"
else
  add_row "T10-F3" "Fichier insurer-integration-migration-sprint-32.md existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T10-V1: Mock pushDevis log + scheduled callback (P0)
echo "  Verifying T10-V1 : Mock pushDevis log + scheduled callback..."
add_row "T10-V1" "Mock pushDevis log + scheduled callback" "WARN" "(P0) Voir B-21 Tache 5.3.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V2: Cron declenche callbacks (P0)
echo "  Verifying T10-V2 : Cron declenche callbacks..."
add_row "T10-V2" "Cron declenche callbacks" "WARN" "(P0) Voir B-21 Tache 5.3.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V3: Approval realistic + Rejection 10% (P0)
echo "  Verifying T10-V3 : Approval realistic + Rejection 10%..."
add_row "T10-V3" "Approval realistic + Rejection 10%" "WARN" "(P0) Voir B-21 Tache 5.3.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V4: Documentation pattern Sprint 32 swap (P0)
echo "  Verifying T10-V4 : Documentation pattern Sprint 32 swap..."
add_row "T10-V4" "Documentation pattern Sprint 32 swap" "WARN" "(P0) Voir B-21 Tache 5.3.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V5: Tests 6+ scenarios (P0)
echo "  Verifying T10-V5 : Tests 6+ scenarios..."
add_row "T10-V5" "Tests 6+ scenarios" "WARN" "(P0) Voir B-21 Tache 5.3.10 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 11/5 -- 5.3.11 : Garantie Tracking + Reclamations

```bash
echo ""
echo "================================================"
echo "TACHE 5.3.11 : Garantie Tracking + Reclamations"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T11-F1: Existence fichier repo/packages/repair/src/services/warranty-claims.service.ts
if [ -f "repo/packages/repair/src/services/warranty-claims.service.ts" ]; then
  add_row "T11-F1" "Fichier warranty-claims.service.ts existe" "PASS" "Cree"
else
  add_row "T11-F1" "Fichier warranty-claims.service.ts existe" "FAIL" "Manquant"
fi
# Test T11-F2: Existence fichier repo/packages/repair/src/jobs/warranty-expiry-reminder.cron.ts
if [ -f "repo/packages/repair/src/jobs/warranty-expiry-reminder.cron.ts" ]; then
  add_row "T11-F2" "Fichier warranty-expiry-reminder.cron.ts existe" "PASS" "Cree"
else
  add_row "T11-F2" "Fichier warranty-expiry-reminder.cron.ts existe" "FAIL" "Manquant"
fi
# Test T11-F3: Existence fichier repo/packages/comm/src/templates/{fr,ar-MA,ar}/warranty-{expires-soon,claim-received}.hbs
if [ -f "repo/packages/comm/src/templates/{fr,ar-MA,ar}/warranty-{expires-soon,claim-received}.hbs" ]; then
  add_row "T11-F3" "Fichier warranty-{expires-soon,claim-received}.hbs existe" "PASS" "Cree"
else
  add_row "T11-F3" "Fichier warranty-{expires-soon,claim-received}.hbs existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T11-V1: Submit claim workflow (P0)
echo "  Verifying T11-V1 : Submit claim workflow..."
add_row "T11-V1" "Submit claim workflow" "WARN" "(P0) Voir B-21 Tache 5.3.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V2: Re-repair free cree nouveau sinistre (P0)
echo "  Verifying T11-V2 : Re-repair free cree nouveau sinistre..."
add_row "T11-V2" "Re-repair free cree nouveau sinistre" "WARN" "(P0) Voir B-21 Tache 5.3.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V3: Partial refund Pay integration (P0)
echo "  Verifying T11-V3 : Partial refund Pay integration..."
add_row "T11-V3" "Partial refund Pay integration" "WARN" "(P0) Voir B-21 Tache 5.3.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V4: Cron expiry + reminders (P0)
echo "  Verifying T11-V4 : Cron expiry + reminders..."
add_row "T11-V4" "Cron expiry + reminders" "WARN" "(P0) Voir B-21 Tache 5.3.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V5: Tests 8+ scenarios (P0)
echo "  Verifying T11-V5 : Tests 8+ scenarios..."
add_row "T11-V5" "Tests 8+ scenarios" "WARN" "(P0) Voir B-21 Tache 5.3.11 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 12/3 -- 5.3.12 : Endpoints REST + Permissions

```bash
echo ""
echo "================================================"
echo "TACHE 5.3.12 : Endpoints REST + Permissions"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 3"
echo "================================================"

# === Verification fichiers crees ===
# Test T12-F1: Existence fichier repo/packages/auth/src/rbac/permissions.enum.ts
if [ -f "repo/packages/auth/src/rbac/permissions.enum.ts" ]; then
  add_row "T12-F1" "Fichier permissions.enum.ts existe" "PASS" "Cree"
else
  add_row "T12-F1" "Fichier permissions.enum.ts existe" "FAIL" "Manquant"
fi
# Test T12-F2: Existence fichier repo/packages/auth/src/rbac/permissions-matrix.ts
if [ -f "repo/packages/auth/src/rbac/permissions-matrix.ts" ]; then
  add_row "T12-F2" "Fichier permissions-matrix.ts existe" "PASS" "Cree"
else
  add_row "T12-F2" "Fichier permissions-matrix.ts existe" "FAIL" "Manquant"
fi
# Test T12-F3: Existence fichier repo/apps/api/test/repair/sprint-21-permissions.e2e-spec.ts
if [ -f "repo/apps/api/test/repair/sprint-21-permissions.e2e-spec.ts" ]; then
  add_row "T12-F3" "Fichier sprint-21-permissions.e2e-spec.ts existe" "PASS" "Cree"
else
  add_row "T12-F3" "Fichier sprint-21-permissions.e2e-spec.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T12-V1: 15+ permissions Sprint 21 ajoutees (P0)
echo "  Verifying T12-V1 : 15+ permissions Sprint 21 ajoutees..."
add_row "T12-V1" "15+ permissions Sprint 21 ajoutees" "WARN" "(P0) Voir B-21 Tache 5.3.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V2: Roles enrichis (P0)
echo "  Verifying T12-V2 : Roles enrichis..."
add_row "T12-V2" "Roles enrichis" "WARN" "(P0) Voir B-21 Tache 5.3.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V3: Tests RBAC 8+ scenarios (P0)
echo "  Verifying T12-V3 : Tests RBAC 8+ scenarios..."
add_row "T12-V3" "Tests RBAC 8+ scenarios" "WARN" "(P0) Voir B-21 Tache 5.3.12 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 13/4 -- 5.3.13 : Tests E2E Workflow Complet (40+) + Edge Cases

```bash
echo ""
echo "================================================"
echo "TACHE 5.3.13 : Tests E2E Workflow Complet (40+) + Edge Cases"
echo "Priorite : P0 | Effort : 9h"
echo "Criteres a verifier : 4"
echo "================================================"

# === Verification fichiers crees ===
# Test T13-F1: Existence fichier repo/apps/api/test/repair/sprint-21-workflow/{40+ specs}.e2e-spec.ts
if [ -f "repo/apps/api/test/repair/sprint-21-workflow/{40+ specs}.e2e-spec.ts" ]; then
  add_row "T13-F1" "Fichier {40+ specs}.e2e-spec.ts existe" "PASS" "Cree"
else
  add_row "T13-F1" "Fichier {40+ specs}.e2e-spec.ts existe" "FAIL" "Manquant"
fi
# Test T13-F2: Existence fichier repo/infrastructure/scripts/seed-sprint-21-fixtures.ts
if [ -f "repo/infrastructure/scripts/seed-sprint-21-fixtures.ts" ]; then
  add_row "T13-F2" "Fichier seed-sprint-21-fixtures.ts existe" "PASS" "Cree"
else
  add_row "T13-F2" "Fichier seed-sprint-21-fixtures.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T13-V1: 40+ tests passent (P0)
echo "  Verifying T13-V1 : 40+ tests passent..."
add_row "T13-V1" "40+ tests passent" "WARN" "(P0) Voir B-21 Tache 5.3.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V2: CI green (P0)
echo "  Verifying T13-V2 : CI green..."
add_row "T13-V2" "CI green" "WARN" "(P0) Voir B-21 Tache 5.3.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V3: Edge cases couverts (P0)
echo "  Verifying T13-V3 : Edge cases couverts..."
add_row "T13-V3" "Edge cases couverts" "WARN" "(P0) Voir B-21 Tache 5.3.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V4: Reproducibility 5x (P0)
echo "  Verifying T13-V4 : Reproducibility 5x..."
add_row "T13-V4" "Reproducibility 5x" "WARN" "(P0) Voir B-21 Tache 5.3.13 pour test detaille - critere a auto-tester via script ad-hoc"

```

---


---


## VERIFICATIONS TRANSVERSALES SPRINT 21

### TR-BUILD : Build complet du sprint

```bash
echo ""
echo "================================================"
echo "VERIFICATIONS TRANSVERSALES SPRINT 21"
echo "================================================"

cd repo
echo "=== TR-BUILD : Build complet ==="
BUILD_OUT=$(pnpm turbo run build 2>&1)
BUILD_CODE=$?
if [ $BUILD_CODE -eq 0 ]; then
  add_row "TR-BUILD" "Build monorepo passe" "PASS" "Tous packages compiles"
else
  ERRORS=$(echo "$BUILD_OUT" | grep -c "error" || echo 0)
  add_row "TR-BUILD" "Build monorepo passe" "FAIL" "$ERRORS erreurs detectees"
fi
```

### TR-TYPECHECK : TypeScript strict 0 erreur

```bash
echo "=== TR-TYPECHECK : TypeScript strict ==="
TSC_OUT=$(pnpm tsc --noEmit 2>&1)
TSC_CODE=$?
if [ $TSC_CODE -eq 0 ]; then
  add_row "TR-TYPECHECK" "TypeScript compilation propre" "PASS" "0 erreur"
else
  TS_ERRORS=$(echo "$TSC_OUT" | grep -c "error TS")
  add_row "TR-TYPECHECK" "TypeScript compilation propre" "FAIL" "$TS_ERRORS erreurs TS"
fi
```

### TR-TESTS : Tests Vitest unitaires

```bash
echo "=== TR-TESTS : Tests Vitest ==="
VITEST_OUT=$(pnpm vitest run --coverage --reporter=json 2>/dev/null)
TESTS_PASSED=$(echo "$VITEST_OUT" | jq '.numPassedTests // 0' 2>/dev/null || echo 0)
TESTS_TOTAL=$(echo "$VITEST_OUT" | jq '.numTotalTests // 0' 2>/dev/null || echo 0)

if [ "$TESTS_TOTAL" -gt 0 ] && [ "$TESTS_PASSED" -eq "$TESTS_TOTAL" ]; then
  add_row "TR-TESTS" "Tests unitaires PASS" "PASS" "$TESTS_PASSED/$TESTS_TOTAL"
elif [ "$TESTS_TOTAL" -gt 0 ]; then
  add_row "TR-TESTS" "Tests unitaires PASS" "FAIL" "$TESTS_PASSED/$TESTS_TOTAL passes"
else
  add_row "TR-TESTS" "Tests unitaires PASS" "WARN" "Aucun test detecte"
fi
```

### TR-COVERAGE : Couverture >= 85% (P1)

```bash
echo "=== TR-COVERAGE : Couverture tests ==="
COVERAGE=$(echo "$VITEST_OUT" | jq '.coverageMap.total.lines.pct // 0' 2>/dev/null || echo 0)
if (( $(echo "$COVERAGE >= 85" | bc -l 2>/dev/null || echo 0) )); then
  add_row "TR-COVERAGE" "Couverture tests >= 85%" "PASS" "${COVERAGE}%"
elif (( $(echo "$COVERAGE >= 70" | bc -l 2>/dev/null || echo 0) )); then
  add_row "TR-COVERAGE" "Couverture tests >= 85%" "WARN" "${COVERAGE}% (cible 85%, P1)"
else
  add_row "TR-COVERAGE" "Couverture tests >= 85%" "FAIL" "${COVERAGE}% trop faible"
fi
```

### TR-LINT : Biome lint propre

```bash
echo "=== TR-LINT : Biome lint ==="
LINT_OUT=$(pnpm lint 2>&1)
LINT_CODE=$?
if [ $LINT_CODE -eq 0 ]; then
  add_row "TR-LINT" "Biome lint propre" "PASS" "0 erreur"
else
  LINT_ERRORS=$(echo "$LINT_OUT" | grep -c "error" || echo 0)
  add_row "TR-LINT" "Biome lint propre" "WARN" "$LINT_ERRORS erreurs"
fi
```

### TR-NO-EMOJI : Aucune emoji dans le code (decision-006)

```bash
echo "=== TR-NO-EMOJI : Aucune emoji ==="
EMOJI_COUNT=$(grep -rP "[\x{1F300}-\x{1F9FF}]|[\x{2600}-\x{27BF}]" repo/apps repo/packages --include="*.ts" --include="*.tsx" --include="*.md" 2>/dev/null | wc -l)
if [ "$EMOJI_COUNT" -eq 0 ]; then
  add_row "TR-NO-EMOJI" "Aucune emoji code/docs" "PASS" "Conforme decision-006"
else
  add_row "TR-NO-EMOJI" "Aucune emoji code/docs" "FAIL" "$EMOJI_COUNT emojis detectees"
fi
```

### TR-CONSOLE : Aucun console.log (Pino logger obligatoire)

```bash
echo "=== TR-CONSOLE : Aucun console.log ==="
CONSOLE_LOGS=$(grep -rn "console\.log\|console\.error\|console\.warn" repo/apps repo/packages --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v ".spec.ts" | grep -v ".test.ts" | wc -l)
if [ "$CONSOLE_LOGS" -eq 0 ]; then
  add_row "TR-CONSOLE" "Aucun console.* (Pino obligatoire)" "PASS" "0 occurrence"
else
  add_row "TR-CONSOLE" "Aucun console.* (Pino obligatoire)" "FAIL" "$CONSOLE_LOGS occurrences"
fi
```

### TR-COMMITS : Conventional Commits

```bash
echo "=== TR-COMMITS : Conventional commits ==="
NON_CONVENTIONAL=$(git log --since="2 weeks ago" --pretty=format:"%s" -- repo/ | grep -vE "^(feat|fix|docs|style|refactor|test|chore|perf|ci|build)(\(.+\))?:" | wc -l)
if [ "$NON_CONVENTIONAL" -eq 0 ]; then
  add_row "TR-COMMITS" "Conventional Commits respectes" "PASS" "Tous commits conformes"
else
  add_row "TR-COMMITS" "Conventional Commits respectes" "WARN" "$NON_CONVENTIONAL commits non-conformes"
fi
```

### TR-TENANT : Multi-tenant filter present (sauf public/admin)

```bash
echo "=== TR-TENANT : Multi-tenant filter ==="
TENANT_FILES=$(grep -rl "tenant_id\|x-tenant-id\|TenantContext" repo/apps repo/packages --include="*.ts" 2>/dev/null | wc -l)
if [ "$TENANT_FILES" -ge 5 ]; then
  add_row "TR-TENANT" "Multi-tenant filter present" "PASS" "$TENANT_FILES fichiers"
else
  add_row "TR-TENANT" "Multi-tenant filter present" "WARN" "$TENANT_FILES fichiers (verifier coverage)"
fi
```

### TR-ZOD : Validation Zod (pas class-validator)

```bash
echo "=== TR-ZOD : Validation Zod ==="
CLASS_VALIDATOR=$(grep -rn "class-validator\|@IsString\|@IsEmail\|@IsNotEmpty" repo/apps repo/packages --include="*.ts" 2>/dev/null | wc -l)
if [ "$CLASS_VALIDATOR" -eq 0 ]; then
  add_row "TR-ZOD" "Validation Zod (no class-validator)" "PASS" "Conforme"
else
  add_row "TR-ZOD" "Validation Zod (no class-validator)" "FAIL" "$CLASS_VALIDATOR usages class-validator"
fi
```

cd ..

### TR-MIGRATIONS : Migrations DB Sprint 21

```bash
echo "=== TR-MIGRATIONS : Migrations DB ==="
MIGR_COUNT=$(pg_query "SELECT COUNT(*) FROM migrations WHERE name LIKE '%sprint21%' OR name LIKE '%Sprint21%'" || echo 0)
if [ "$MIGR_COUNT" -gt 0 ]; then
  add_row "TR-MIG" "Migrations Sprint 21 appliquees" "PASS" "$MIGR_COUNT migrations"
else
  add_row "TR-MIG" "Migrations Sprint 21 appliquees" "WARN" "Aucune migration detectee (verifier)"
fi
```

### TR-ACAPS : Conformite ACAPS audit trail

```bash
echo "=== TR-ACAPS : Audit trail ACAPS ==="
ACAPS_AUDIT_COUNT=$(pg_query "SELECT COUNT(*) FROM compliance_acaps_audits WHERE created_at > NOW() - INTERVAL '7 days'" || echo 0)
if [ "$ACAPS_AUDIT_COUNT" -gt 0 ]; then
  add_row "TR-ACAPS" "Audit trail ACAPS actif (7j)" "PASS" "$ACAPS_AUDIT_COUNT entrees"
else
  add_row "TR-ACAPS" "Audit trail ACAPS actif (7j)" "WARN" "Aucune entree (verifier subscriber)"
fi
```

### TR-KAFKA : Topics Kafka actifs

```bash
echo "=== TR-KAFKA : Topics Kafka ==="
TOPICS_COUNT=$(docker exec insurtech-kafka kafka-topics.sh --bootstrap-server localhost:9092 --list 2>/dev/null | grep "^insurtech\." | wc -l)
if [ "$TOPICS_COUNT" -ge 1 ]; then
  add_row "TR-KAFKA" "Topics insurtech.* configures" "PASS" "$TOPICS_COUNT topics"
else
  add_row "TR-KAFKA" "Topics insurtech.* configures" "WARN" "Aucun topic detecte"
fi
```



---

## GENERATION DU RAPPORT FINAL

```bash
echo ""
echo "================================================"
echo "GENERATION DU RAPPORT FINAL SPRINT 21"
echo "================================================"

TOTAL=$((PASS + PASS_REPAIRED + FAIL + SKIP + WARN))
if [ "$TOTAL" -eq 0 ]; then
  TOTAL=1  # Avoid division by zero
fi
SCORE=$(echo "scale=2; ($PASS + $PASS_REPAIRED) * 100 / $TOTAL" | bc 2>/dev/null || echo 0)

cat >> "$REPORT_FILE" << EOF

## Tableau de Resultats Complet

| ID | Description | Statut | Details |
|----|-------------|--------|---------|
$(echo -e "$TABLE_ROWS")

## Score Global

| Categorie | Compte | Pourcentage |
|-----------|--------|-------------|
| PASS      | $PASS  | $(echo "scale=1; $PASS * 100 / $TOTAL" | bc)% |
| PASS*     | $PASS_REPAIRED | $(echo "scale=1; $PASS_REPAIRED * 100 / $TOTAL" | bc)% |
| FAIL      | $FAIL  | $(echo "scale=1; $FAIL * 100 / $TOTAL" | bc)% |
| SKIP      | $SKIP  | $(echo "scale=1; $SKIP * 100 / $TOTAL" | bc)% |
| WARN      | $WARN  | $(echo "scale=1; $WARN * 100 / $TOTAL" | bc)% |
| **TOTAL** | $TOTAL | 100% |

**Score Global de Reussite** : $SCORE%

---

## Jalon GO/NO-GO Sprint 21

EOF

# Calcul statut final
if (( $(echo "$SCORE >= 95" | bc -l) )); then
  STATUT="GO"
  cat >> "$REPORT_FILE" << EOF
**STATUT** : GO -- Sprint 21 valide, passage Sprint 22 autorise

Le sprint a passe les criteres requis. Cowork peut demarrer Sprint 22.

EOF
  echo ""
  echo "================================================"
  echo "SPRINT 21 : GO ($SCORE%)"
  echo "================================================"
elif (( $(echo "$SCORE >= 85" | bc -l) )); then
  STATUT="GO CONDITIONNEL"
  cat >> "$REPORT_FILE" << EOF
**STATUT** : GO CONDITIONNEL -- Score $SCORE% (cible 95%)

Le sprint passe le minimum mais necessite hot fixes :
- Identifier FAIL critiques (P0)
- Reparation manuelle dans la semaine
- Re-verification avant Sprint suivant

EOF
  echo ""
  echo "================================================"
  echo "SPRINT 21 : GO CONDITIONNEL ($SCORE%)"
  echo "================================================"
else
  STATUT="NO-GO"
  cat >> "$REPORT_FILE" << EOF
**STATUT** : NO-GO -- Score $SCORE% trop bas (cible 85% minimum)

Le sprint **doit etre repris** :
- Lister tous FAIL P0
- Escalation Saad/Abla decision (cut scope OR delai)
- Reprise sprint avant Sprint 22

EOF
  echo ""
  echo "================================================"
  echo "SPRINT 21 : NO-GO ($SCORE%)"
  echo "================================================"
fi

cat >> "$REPORT_FILE" << EOF

---

## Decisions strategiques applicables

Voir `00-pilotage/decisions/`. Decisions critiques pour ce sprint :
- decision-006 : No-emoji policy ABSOLU
- decision-007 : AI-defere strategy (Mock/Real swap)
- decision-008 : Data residency Atlas Cloud Services Benguerir
- decision-002 : Multi-tenant 3 niveaux strict

---

## Prochaine etape

EOF

if [ "$STATUT" = "GO" ] || [ "$STATUT" = "GO CONDITIONNEL" ]; then
  echo "Si GO/GO CONDITIONNEL : commit cloture sprint" >> "$REPORT_FILE"
  echo '```bash' >> "$REPORT_FILE"
  echo "git add $REPORT_FILE" >> "$REPORT_FILE"
  echo "git commit -m \"chore(sprint-21): close sprint 21 -- $STATUT ($SCORE%)\"" >> "$REPORT_FILE"
  echo '```' >> "$REPORT_FILE"
fi

echo ""
echo "Rapport complet dans : $REPORT_FILE"
```

---

## INSTRUCTION FINALE A CLAUDE CODE / COWORK

Apres l'execution complete des verifications ci-dessus :

1. **Lis le contenu de `sprint21-verify-report.md`** integralement
2. **Identifie les FAIL critiques** (criteres P0) qui necessitent intervention manuelle
3. **Affiche un resume executif** :
   - Nombre total de criteres
   - Pourcentage PASS / PASS\* / FAIL / WARN
   - Liste des FAIL avec contexte technique
   - Recommandation : GO / GO CONDITIONNEL / NO-GO
4. **Si NO-GO** : ne pas demarrer le Sprint suivant, alerter Saad/Abla via Slack `#insurtech-dev`
5. **Si GO ou GO CONDITIONNEL** : produire le commit de cloture du sprint :

```bash
git add skalean-insurtech/sprint21-verify-report.md
git commit -m "chore(sprint-21): close sprint 21 with verification report

- Verification automatique executee
- Score global : <SCORE>%
- <PASS> criteres PASS, <PASS_REPAIRED> reparations auto, <FAIL> FAIL
- Statut : <GO|GO CONDITIONNEL|NO-GO>

Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Sprint: 21 (Phase 5 / Sprint 3)
Reference B-21, C-21, V-21
Report: sprint21-verify-report.md"
```

6. **Documentation continue** : si decisions techniques prises pendant verification, ajouter notes dans `repo/docs/runbooks/sprint-21-lessons-learned.md`

---

**Fin de la verification V-21 v2.2 detaillee -- Sprint 21 (5.3) Sinistre Workflow Detaille.**

**Total criteres taches** : 64 | **Total transversaux** : ~10 | **Effort sprint** : 70h
