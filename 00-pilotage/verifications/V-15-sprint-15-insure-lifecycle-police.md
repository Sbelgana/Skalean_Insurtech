# VERIFICATION SPRINT 15 -- Phase 4 / Sprint 2 : Insure Lifecycle Avance (transferts/flottes/queue)
# Version : Auto-reparation active + Rapport final MD detaille
# 13 taches, 67 criteres extraits B-15
# AUCUNE EMOJI AUTORISEE

**Version** : v2.2 (verification detaillee)
**Phase** : 4 -- Vertical Insure (Skalean Broker ERP)
**Sprint** : 15 / 35 (cumul) -- Sprint 2 dans Phase 4
**Reference meta-prompt** : `B-15-sprint-15-insure-lifecycle-police.md`
**Reference orchestrateur** : `C-15-sprint-15-insure-lifecycle-police.md`
**Total criteres** : 67 criteres taches + ~10 transversaux

---

Tu es **Claude Code (ou Cowork)**. Tu dois executer une **verification COMPLETE et EXHAUSTIVE** du Sprint 15 apres execution toutes les 13 taches.

---

## REGLES D'EXECUTION

1. Tu **executes CHAQUE verification dans l'ordre** (taches puis transversales)
2. Quand une verification echoue, tu **TENTES UNE REPARATION AUTOMATIQUE** avant de noter FAIL
3. Apres chaque tentative de reparation, tu **re-executes la verification**
4. Tu consignes dans `sprint15-verify-report.md` **TOUS les resultats** au fil de l'execution
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
REPORT_FILE="sprint15-verify-report.md"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
RUN_ID=$(date '+%Y%m%d-%H%M%S')

cat > "$REPORT_FILE" << EOF
# Rapport de Verification - Sprint 15 : Insure Lifecycle Avance (transferts/flottes/queue)

**Date** : $TIMESTAMP
**Run ID** : $RUN_ID
**Phase** : 4 -- Vertical Insure (Skalean Broker ERP)
**Sprint** : 15 (Phase 4 / Sprint 2)
**Reference B-15** : 13 taches, 67 criteres extraits
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

## TACHE 1/8 -- 4.2.1 : Transfer Entity + Workflow Signature Double

```bash
echo ""
echo "================================================"
echo "TACHE 4.2.1 : Transfer Entity + Workflow Signature Double"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 8"
echo "================================================"

# === Verification fichiers crees ===
# Test T01-F1: Existence fichier repo/packages/database/src/migrations/{date}-InsureTransfers.ts
if [ -f "repo/packages/database/src/migrations/{date}-InsureTransfers.ts" ]; then
  add_row "T01-F1" "Fichier {date}-InsureTransfers.ts existe" "PASS" "Cree"
else
  add_row "T01-F1" "Fichier {date}-InsureTransfers.ts existe" "FAIL" "Manquant"
fi
# Test T01-F2: Existence fichier repo/packages/insure/src/entities/insure-transfer.entity.ts
if [ -f "repo/packages/insure/src/entities/insure-transfer.entity.ts" ]; then
  add_row "T01-F2" "Fichier insure-transfer.entity.ts existe" "PASS" "Cree"
else
  add_row "T01-F2" "Fichier insure-transfer.entity.ts existe" "FAIL" "Manquant"
fi
# Test T01-F3: Existence fichier repo/packages/insure/src/services/transfers.service.ts
if [ -f "repo/packages/insure/src/services/transfers.service.ts" ]; then
  add_row "T01-F3" "Fichier transfers.service.ts existe" "PASS" "Cree"
else
  add_row "T01-F3" "Fichier transfers.service.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T01-V1: Initiate transfer cree row + PDF + signing workflow 2 signers (P0)
echo "  Verifying T01-V1 : Initiate transfer cree row + PDF + signing workflow 2 signers..."
add_row "T01-V1" "Initiate transfer cree row + PDF + signing workflow 2 signers" "WARN" "(P0) Voir B-15 Tache 4.2.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V2: Police pas active rejete (P0)
echo "  Verifying T01-V2 : Police pas active rejete..."
add_row "T01-V2" "Police pas active rejete" "WARN" "(P0) Voir B-15 Tache 4.2.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V3: Pending existant rejete (P0)
echo "  Verifying T01-V3 : Pending existant rejete..."
add_row "T01-V3" "Pending existant rejete" "WARN" "(P0) Voir B-15 Tache 4.2.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V4: Apres 2 signatures : policy.contact_id update + audit (P0)
echo "  Verifying T01-V4 : Apres 2 signatures : policy.contact_id update + audit..."
add_row "T01-V4" "Apres 2 signatures : policy.contact_id update + audit" "WARN" "(P0) Voir B-15 Tache 4.2.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V5: Notification Comm aux 2 parties (P0)
echo "  Verifying T01-V5 : Notification Comm aux 2 parties..."
add_row "T01-V5" "Notification Comm aux 2 parties" "WARN" "(P0) Voir B-15 Tache 4.2.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V6: Cancel avant completion OK (P0)
echo "  Verifying T01-V6 : Cancel avant completion OK..."
add_row "T01-V6" "Cancel avant completion OK" "WARN" "(P0) Voir B-15 Tache 4.2.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V7: Signature decline 1 signer : transfer cancelled (P0)
echo "  Verifying T01-V7 : Signature decline 1 signer : transfer cancelled..."
add_row "T01-V7" "Signature decline 1 signer : transfer cancelled" "WARN" "(P0) Voir B-15 Tache 4.2.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V8: Tests 12+ scenarios (P0)
echo "  Verifying T01-V8 : Tests 12+ scenarios..."
add_row "T01-V8" "Tests 12+ scenarios" "WARN" "(P0) Voir B-15 Tache 4.2.1 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 2/4 -- 4.2.2 : Fractionnement Primes Runtime

```bash
echo ""
echo "================================================"
echo "TACHE 4.2.2 : Fractionnement Primes Runtime"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 4"
echo "================================================"

# === Verification fichiers crees ===
# Test T02-F1: Existence fichier repo/packages/insure/src/services/fractionnement.service.ts
if [ -f "repo/packages/insure/src/services/fractionnement.service.ts" ]; then
  add_row "T02-F1" "Fichier fractionnement.service.ts existe" "PASS" "Cree"
else
  add_row "T02-F1" "Fichier fractionnement.service.ts existe" "FAIL" "Manquant"
fi
# Test T02-F2: Existence fichier repo/apps/api/src/modules/insure/controllers/fractionnement.controller.ts
if [ -f "repo/apps/api/src/modules/insure/controllers/fractionnement.controller.ts" ]; then
  add_row "T02-F2" "Fichier fractionnement.controller.ts existe" "PASS" "Cree"
else
  add_row "T02-F2" "Fichier fractionnement.controller.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T02-V1: Change annual -> monthly recompute echeancier (P0)
echo "  Verifying T02-V1 : Change annual -> monthly recompute echeancier..."
add_row "T02-V1" "Change annual -> monthly recompute echeancier" "WARN" "(P0) Voir B-15 Tache 4.2.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V2: Frais 3% applique (P0)
echo "  Verifying T02-V2 : Frais 3% applique..."
add_row "T02-V2" "Frais 3% applique" "WARN" "(P0) Voir B-15 Tache 4.2.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V3: Premiums futurs cancelled (P0)
echo "  Verifying T02-V3 : Premiums futurs cancelled..."
add_row "T02-V3" "Premiums futurs cancelled" "WARN" "(P0) Voir B-15 Tache 4.2.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V4: Tests 8+ scenarios (P0)
echo "  Verifying T02-V4 : Tests 8+ scenarios..."
add_row "T02-V4" "Tests 8+ scenarios" "WARN" "(P0) Voir B-15 Tache 4.2.2 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 3/4 -- 4.2.3 : Suspension Temporaire + Reprise

```bash
echo ""
echo "================================================"
echo "TACHE 4.2.3 : Suspension Temporaire + Reprise"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 4"
echo "================================================"

# === Verification fichiers crees ===
# Test T03-F1: Existence fichier repo/packages/database/src/migrations/{date}-AddSuspensionColumns.ts
if [ -f "repo/packages/database/src/migrations/{date}-AddSuspensionColumns.ts" ]; then
  add_row "T03-F1" "Fichier {date}-AddSuspensionColumns.ts existe" "PASS" "Cree"
else
  add_row "T03-F1" "Fichier {date}-AddSuspensionColumns.ts existe" "FAIL" "Manquant"
fi
# Test T03-F2: Existence fichier repo/packages/insure/src/services/suspension.service.ts
if [ -f "repo/packages/insure/src/services/suspension.service.ts" ]; then
  add_row "T03-F2" "Fichier suspension.service.ts existe" "PASS" "Cree"
else
  add_row "T03-F2" "Fichier suspension.service.ts existe" "FAIL" "Manquant"
fi
# Test T03-F3: Existence fichier repo/apps/api/src/modules/insure/controllers/suspension.controller.ts
if [ -f "repo/apps/api/src/modules/insure/controllers/suspension.controller.ts" ]; then
  add_row "T03-F3" "Fichier suspension.controller.ts existe" "PASS" "Cree"
else
  add_row "T03-F3" "Fichier suspension.controller.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T03-V1: Suspend transition status + cancel premiums futurs (P0)
echo "  Verifying T03-V1 : Suspend transition status + cancel premiums futurs..."
add_row "T03-V1" "Suspend transition status + cancel premiums futurs" "WARN" "(P0) Voir B-15 Tache 4.2.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V2: Resume restore status + extension end_date (P0)
echo "  Verifying T03-V2 : Resume restore status + extension end_date..."
add_row "T03-V2" "Resume restore status + extension end_date" "WARN" "(P0) Voir B-15 Tache 4.2.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V3: Suspension > 6 mois rejetee (P0)
echo "  Verifying T03-V3 : Suspension > 6 mois rejetee..."
add_row "T03-V3" "Suspension > 6 mois rejetee" "WARN" "(P0) Voir B-15 Tache 4.2.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V4: Tests 8+ scenarios (P0)
echo "  Verifying T03-V4 : Tests 8+ scenarios..."
add_row "T03-V4" "Tests 8+ scenarios" "WARN" "(P0) Voir B-15 Tache 4.2.3 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 4/7 -- 4.2.4 : Resiliation Anticipee + Remboursement Pro-Rata

```bash
echo ""
echo "================================================"
echo "TACHE 4.2.4 : Resiliation Anticipee + Remboursement Pro-Rata"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 7"
echo "================================================"

# === Verification fichiers crees ===
# Test T04-F1: Existence fichier repo/packages/insure/src/services/resiliation.service.ts
if [ -f "repo/packages/insure/src/services/resiliation.service.ts" ]; then
  add_row "T04-F1" "Fichier resiliation.service.ts existe" "PASS" "Cree"
else
  add_row "T04-F1" "Fichier resiliation.service.ts existe" "FAIL" "Manquant"
fi
# Test T04-F2: Existence fichier repo/packages/insure/src/services/resiliation.service.spec.ts
if [ -f "repo/packages/insure/src/services/resiliation.service.spec.ts" ]; then
  add_row "T04-F2" "Fichier resiliation.service.spec.ts existe" "PASS" "Cree"
else
  add_row "T04-F2" "Fichier resiliation.service.spec.ts existe" "FAIL" "Manquant"
fi
# Test T04-F3: Existence fichier repo/apps/api/src/modules/insure/controllers/resiliation.controller.ts
if [ -f "repo/apps/api/src/modules/insure/controllers/resiliation.controller.ts" ]; then
  add_row "T04-F3" "Fichier resiliation.controller.ts existe" "PASS" "Cree"
else
  add_row "T04-F3" "Fichier resiliation.controller.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T04-V1: Pro-rata calcul correct (decimal.js) (P0)
echo "  Verifying T04-V1 : Pro-rata calcul correct (decimal.js)..."
add_row "T04-V1" "Pro-rata calcul correct (decimal.js)" "WARN" "(P0) Voir B-15 Tache 4.2.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V2: Frais 5% applique (P0)
echo "  Verifying T04-V2 : Frais 5% applique..."
add_row "T04-V2" "Frais 5% applique" "WARN" "(P0) Voir B-15 Tache 4.2.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V3: Droit retract 30 jours integral (P0)
echo "  Verifying T04-V3 : Droit retract 30 jours integral..."
add_row "T04-V3" "Droit retract 30 jours integral" "WARN" "(P0) Voir B-15 Tache 4.2.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V4: Refund initiate via Pay Sprint 11 (P0)
echo "  Verifying T04-V4 : Refund initiate via Pay Sprint 11..."
add_row "T04-V4" "Refund initiate via Pay Sprint 11" "WARN" "(P0) Voir B-15 Tache 4.2.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V5: Premiums futurs cancelled (P0)
echo "  Verifying T04-V5 : Premiums futurs cancelled..."
add_row "T04-V5" "Premiums futurs cancelled" "WARN" "(P0) Voir B-15 Tache 4.2.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V6: Status workflow respect (P0)
echo "  Verifying T04-V6 : Status workflow respect..."
add_row "T04-V6" "Status workflow respect" "WARN" "(P0) Voir B-15 Tache 4.2.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V7: Tests 12+ scenarios edge cases (P0)
echo "  Verifying T04-V7 : Tests 12+ scenarios edge cases..."
add_row "T04-V7" "Tests 12+ scenarios edge cases" "WARN" "(P0) Voir B-15 Tache 4.2.4 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 5/5 -- 4.2.5 : Polices Flottes (1 Police, N Objets)

```bash
echo ""
echo "================================================"
echo "TACHE 4.2.5 : Polices Flottes (1 Police, N Objets)"
echo "Priorite : P0 | Effort : 7h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T05-F1: Existence fichier repo/packages/database/src/migrations/{date}-InsurePolicyObjects.ts
if [ -f "repo/packages/database/src/migrations/{date}-InsurePolicyObjects.ts" ]; then
  add_row "T05-F1" "Fichier {date}-InsurePolicyObjects.ts existe" "PASS" "Cree"
else
  add_row "T05-F1" "Fichier {date}-InsurePolicyObjects.ts existe" "FAIL" "Manquant"
fi
# Test T05-F2: Existence fichier repo/packages/insure/src/entities/insure-policy-object.entity.ts
if [ -f "repo/packages/insure/src/entities/insure-policy-object.entity.ts" ]; then
  add_row "T05-F2" "Fichier insure-policy-object.entity.ts existe" "PASS" "Cree"
else
  add_row "T05-F2" "Fichier insure-policy-object.entity.ts existe" "FAIL" "Manquant"
fi
# Test T05-F3: Existence fichier repo/packages/insure/src/services/flotte.service.ts
if [ -f "repo/packages/insure/src/services/flotte.service.ts" ]; then
  add_row "T05-F3" "Fichier flotte.service.ts existe" "PASS" "Cree"
else
  add_row "T05-F3" "Fichier flotte.service.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T05-V1: Add object recompute prime totale (P0)
echo "  Verifying T05-V1 : Add object recompute prime totale..."
add_row "T05-V1" "Add object recompute prime totale" "WARN" "(P0) Voir B-15 Tache 4.2.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V2: Remove object refund pro-rata (P0)
echo "  Verifying T05-V2 : Remove object refund pro-rata..."
add_row "T05-V2" "Remove object refund pro-rata" "WARN" "(P0) Voir B-15 Tache 4.2.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V3: Endossement signature trigger (P0)
echo "  Verifying T05-V3 : Endossement signature trigger..."
add_row "T05-V3" "Endossement signature trigger" "WARN" "(P0) Voir B-15 Tache 4.2.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V4: 4 object types supportes (P0)
echo "  Verifying T05-V4 : 4 object types supportes..."
add_row "T05-V4" "4 object types supportes" "WARN" "(P0) Voir B-15 Tache 4.2.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V5: Tests 10+ scenarios (P0)
echo "  Verifying T05-V5 : Tests 10+ scenarios..."
add_row "T05-V5" "Tests 10+ scenarios" "WARN" "(P0) Voir B-15 Tache 4.2.5 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 6/5 -- 4.2.6 : Endossements Auto

```bash
echo ""
echo "================================================"
echo "TACHE 4.2.6 : Endossements Auto"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T06-F1: Existence fichier repo/packages/insure/src/services/endossements/auto-endossements.service.ts
if [ -f "repo/packages/insure/src/services/endossements/auto-endossements.service.ts" ]; then
  add_row "T06-F1" "Fichier auto-endossements.service.ts existe" "PASS" "Cree"
else
  add_row "T06-F1" "Fichier auto-endossements.service.ts existe" "FAIL" "Manquant"
fi
# Test T06-F2: Existence fichier repo/apps/api/src/modules/insure/controllers/auto-endossements.controller.ts
if [ -f "repo/apps/api/src/modules/insure/controllers/auto-endossements.controller.ts" ]; then
  add_row "T06-F2" "Fichier auto-endossements.controller.ts existe" "PASS" "Cree"
else
  add_row "T06-F2" "Fichier auto-endossements.controller.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T06-V1: Change vehicle recompute prime (P0)
echo "  Verifying T06-V1 : Change vehicle recompute prime..."
add_row "T06-V1" "Change vehicle recompute prime" "WARN" "(P0) Voir B-15 Tache 4.2.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V2: Add driver impact tarif si jeune (P0)
echo "  Verifying T06-V2 : Add driver impact tarif si jeune..."
add_row "T06-V2" "Add driver impact tarif si jeune" "WARN" "(P0) Voir B-15 Tache 4.2.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V3: Change usage perso -> pro recompute (tarif pro souvent +) (P0)
echo "  Verifying T06-V3 : Change usage perso -> pro recompute (tarif pro souvent +)..."
add_row "T06-V3" "Change usage perso -> pro recompute (tarif pro souvent +)" "WARN" "(P0) Voir B-15 Tache 4.2.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V4: Workflow signature avenant (P0)
echo "  Verifying T06-V4 : Workflow signature avenant..."
add_row "T06-V4" "Workflow signature avenant" "WARN" "(P0) Voir B-15 Tache 4.2.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V5: Tests 10+ scenarios (P0)
echo "  Verifying T06-V5 : Tests 10+ scenarios..."
add_row "T06-V5" "Tests 10+ scenarios" "WARN" "(P0) Voir B-15 Tache 4.2.6 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 7/4 -- 4.2.7 : Endossements Sante

```bash
echo ""
echo "================================================"
echo "TACHE 4.2.7 : Endossements Sante"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 4"
echo "================================================"

# === Verification fichiers crees ===
# Test T07-F1: Existence fichier repo/packages/insure/src/services/endossements/sante-endossements.service.ts
if [ -f "repo/packages/insure/src/services/endossements/sante-endossements.service.ts" ]; then
  add_row "T07-F1" "Fichier sante-endossements.service.ts existe" "PASS" "Cree"
else
  add_row "T07-F1" "Fichier sante-endossements.service.ts existe" "FAIL" "Manquant"
fi
# Test T07-F2: Existence fichier repo/apps/api/src/modules/insure/controllers/sante-endossements.controller.ts
if [ -f "repo/apps/api/src/modules/insure/controllers/sante-endossements.controller.ts" ]; then
  add_row "T07-F2" "Fichier sante-endossements.controller.ts existe" "PASS" "Cree"
else
  add_row "T07-F2" "Fichier sante-endossements.controller.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T07-V1: Add beneficiaire recompute prime (P0)
echo "  Verifying T07-V1 : Add beneficiaire recompute prime..."
add_row "T07-V1" "Add beneficiaire recompute prime" "WARN" "(P0) Voir B-15 Tache 4.2.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V2: Limit max 5 beneficiaires (P0)
echo "  Verifying T07-V2 : Limit max 5 beneficiaires..."
add_row "T07-V2" "Limit max 5 beneficiaires" "WARN" "(P0) Voir B-15 Tache 4.2.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V3: Enfants > 25 ans rejete (sauf certificat scolarite/handicap) (P0)
echo "  Verifying T07-V3 : Enfants > 25 ans rejete (sauf certificat scolarite/handicap)..."
add_row "T07-V3" "Enfants > 25 ans rejete (sauf certificat scolarite/handicap)" "WARN" "(P0) Voir B-15 Tache 4.2.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V4: Tests 8+ scenarios (P0)
echo "  Verifying T07-V4 : Tests 8+ scenarios..."
add_row "T07-V4" "Tests 8+ scenarios" "WARN" "(P0) Voir B-15 Tache 4.2.7 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 8/4 -- 4.2.8 : Endossements Habitation/RC Pro/Voyage

```bash
echo ""
echo "================================================"
echo "TACHE 4.2.8 : Endossements Habitation/RC Pro/Voyage"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 4"
echo "================================================"

# === Verification fichiers crees ===
# Test T08-F1: Existence fichier repo/packages/insure/src/services/endossements/{3 services}.ts
if [ -f "repo/packages/insure/src/services/endossements/{3 services}.ts" ]; then
  add_row "T08-F1" "Fichier {3 services}.ts existe" "PASS" "Cree"
else
  add_row "T08-F1" "Fichier {3 services}.ts existe" "FAIL" "Manquant"
fi
# Test T08-F2: Existence fichier repo/apps/api/src/modules/insure/controllers/{3 controllers}.ts
if [ -f "repo/apps/api/src/modules/insure/controllers/{3 controllers}.ts" ]; then
  add_row "T08-F2" "Fichier {3 controllers}.ts existe" "PASS" "Cree"
else
  add_row "T08-F2" "Fichier {3 controllers}.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T08-V1: Habitation update biens recompute (P0)
echo "  Verifying T08-V1 : Habitation update biens recompute..."
add_row "T08-V1" "Habitation update biens recompute" "WARN" "(P0) Voir B-15 Tache 4.2.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V2: RC pro change activite recompute (P0)
echo "  Verifying T08-V2 : RC pro change activite recompute..."
add_row "T08-V2" "RC pro change activite recompute" "WARN" "(P0) Voir B-15 Tache 4.2.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V3: Voyage extend destination + duration (P0)
echo "  Verifying T08-V3 : Voyage extend destination + duration..."
add_row "T08-V3" "Voyage extend destination + duration" "WARN" "(P0) Voir B-15 Tache 4.2.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V4: Tests 12+ scenarios (P0)
echo "  Verifying T08-V4 : Tests 12+ scenarios..."
add_row "T08-V4" "Tests 12+ scenarios" "WARN" "(P0) Voir B-15 Tache 4.2.8 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 9/7 -- 4.2.9 : BrokerValidationQueueService (File Web-Customer-Portal)

```bash
echo ""
echo "================================================"
echo "TACHE 4.2.9 : BrokerValidationQueueService (File Web-Customer-Portal)"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 7"
echo "================================================"

# === Verification fichiers crees ===
# Test T09-F1: Existence fichier repo/packages/database/src/migrations/{date}-BrokerValidationQueue.ts
if [ -f "repo/packages/database/src/migrations/{date}-BrokerValidationQueue.ts" ]; then
  add_row "T09-F1" "Fichier {date}-BrokerValidationQueue.ts existe" "PASS" "Cree"
else
  add_row "T09-F1" "Fichier {date}-BrokerValidationQueue.ts existe" "FAIL" "Manquant"
fi
# Test T09-F2: Existence fichier repo/packages/insure/src/entities/insure-broker-validation-queue.entity.ts
if [ -f "repo/packages/insure/src/entities/insure-broker-validation-queue.entity.ts" ]; then
  add_row "T09-F2" "Fichier insure-broker-validation-queue.entity.ts existe" "PASS" "Cree"
else
  add_row "T09-F2" "Fichier insure-broker-validation-queue.entity.ts existe" "FAIL" "Manquant"
fi
# Test T09-F3: Existence fichier repo/packages/insure/src/services/broker-validation-queue.service.ts
if [ -f "repo/packages/insure/src/services/broker-validation-queue.service.ts" ]; then
  add_row "T09-F3" "Fichier broker-validation-queue.service.ts existe" "PASS" "Cree"
else
  add_row "T09-F3" "Fichier broker-validation-queue.service.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T09-V1: Enqueue cree row + notify broker (P0)
echo "  Verifying T09-V1 : Enqueue cree row + notify broker..."
add_row "T09-V1" "Enqueue cree row + notify broker" "WARN" "(P0) Voir B-15 Tache 4.2.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V2: Assign transition + email broker (P0)
echo "  Verifying T09-V2 : Assign transition + email broker..."
add_row "T09-V2" "Assign transition + email broker" "WARN" "(P0) Voir B-15 Tache 4.2.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V3: Validate -> trigger souscription Sprint 14 (P0)
echo "  Verifying T09-V3 : Validate -> trigger souscription Sprint 14..."
add_row "T09-V3" "Validate -> trigger souscription Sprint 14" "WARN" "(P0) Voir B-15 Tache 4.2.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V4: Reject -> notify customer (P0)
echo "  Verifying T09-V4 : Reject -> notify customer..."
add_row "T09-V4" "Reject -> notify customer" "WARN" "(P0) Voir B-15 Tache 4.2.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V5: Cron escalation > 24h (P0)
echo "  Verifying T09-V5 : Cron escalation > 24h..."
add_row "T09-V5" "Cron escalation > 24h" "WARN" "(P0) Voir B-15 Tache 4.2.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V6: SLA working days only (exclu weekend MA) (P0)
echo "  Verifying T09-V6 : SLA working days only (exclu weekend MA)..."
add_row "T09-V6" "SLA working days only (exclu weekend MA)" "WARN" "(P0) Voir B-15 Tache 4.2.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V7: Tests 10+ scenarios (P0)
echo "  Verifying T09-V7 : Tests 10+ scenarios..."
add_row "T09-V7" "Tests 10+ scenarios" "WARN" "(P0) Voir B-15 Tache 4.2.9 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 10/7 -- 4.2.10 : ProvisionalPolicyService (Doc Provisoire 7 Jours)

```bash
echo ""
echo "================================================"
echo "TACHE 4.2.10 : ProvisionalPolicyService (Doc Provisoire 7 Jours)"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 7"
echo "================================================"

# === Verification fichiers crees ===
# Test T10-F1: Existence fichier repo/packages/database/src/migrations/{date}-InsureProvisionalPolicies.ts
if [ -f "repo/packages/database/src/migrations/{date}-InsureProvisionalPolicies.ts" ]; then
  add_row "T10-F1" "Fichier {date}-InsureProvisionalPolicies.ts existe" "PASS" "Cree"
else
  add_row "T10-F1" "Fichier {date}-InsureProvisionalPolicies.ts existe" "FAIL" "Manquant"
fi
# Test T10-F2: Existence fichier repo/packages/insure/src/entities/insure-provisional-policy.entity.ts
if [ -f "repo/packages/insure/src/entities/insure-provisional-policy.entity.ts" ]; then
  add_row "T10-F2" "Fichier insure-provisional-policy.entity.ts existe" "PASS" "Cree"
else
  add_row "T10-F2" "Fichier insure-provisional-policy.entity.ts existe" "FAIL" "Manquant"
fi
# Test T10-F3: Existence fichier repo/packages/insure/src/services/provisional-policy.service.ts
if [ -f "repo/packages/insure/src/services/provisional-policy.service.ts" ]; then
  add_row "T10-F3" "Fichier provisional-policy.service.ts existe" "PASS" "Cree"
else
  add_row "T10-F3" "Fichier provisional-policy.service.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T10-V1: Generate cree provisional + PDF + signature (P0)
echo "  Verifying T10-V1 : Generate cree provisional + PDF + signature..."
add_row "T10-V1" "Generate cree provisional + PDF + signature" "WARN" "(P0) Voir B-15 Tache 4.2.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V2: TTL 7 jours respecte (cron expire) (P0)
echo "  Verifying T10-V2 : TTL 7 jours respecte (cron expire)..."
add_row "T10-V2" "TTL 7 jours respecte (cron expire)" "WARN" "(P0) Voir B-15 Tache 4.2.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V3: Replace lien final policy (P0)
echo "  Verifying T10-V3 : Replace lien final policy..."
add_row "T10-V3" "Replace lien final policy" "WARN" "(P0) Voir B-15 Tache 4.2.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V4: Revoke si broker reject (P0)
echo "  Verifying T10-V4 : Revoke si broker reject..."
add_row "T10-V4" "Revoke si broker reject" "WARN" "(P0) Voir B-15 Tache 4.2.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V5: Watermark 'PROVISOIRE' present (P0)
echo "  Verifying T10-V5 : Watermark 'PROVISOIRE' present..."
add_row "T10-V5" "Watermark 'PROVISOIRE' present" "WARN" "(P0) Voir B-15 Tache 4.2.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V6: QR code verification fonctionne (P0)
echo "  Verifying T10-V6 : QR code verification fonctionne..."
add_row "T10-V6" "QR code verification fonctionne" "WARN" "(P0) Voir B-15 Tache 4.2.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V7: Tests 8+ scenarios (P0)
echo "  Verifying T10-V7 : Tests 8+ scenarios..."
add_row "T10-V7" "Tests 8+ scenarios" "WARN" "(P0) Voir B-15 Tache 4.2.10 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 11/3 -- 4.2.11 : Endpoints REST Avances + Permissions Enrichies

```bash
echo ""
echo "================================================"
echo "TACHE 4.2.11 : Endpoints REST Avances + Permissions Enrichies"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 3"
echo "================================================"

# === Verification fichiers crees ===
# Test T11-F1: Existence fichier repo/packages/auth/src/rbac/permissions.enum.ts
if [ -f "repo/packages/auth/src/rbac/permissions.enum.ts" ]; then
  add_row "T11-F1" "Fichier permissions.enum.ts existe" "PASS" "Cree"
else
  add_row "T11-F1" "Fichier permissions.enum.ts existe" "FAIL" "Manquant"
fi
# Test T11-F2: Existence fichier repo/packages/auth/src/rbac/permissions-matrix.ts
if [ -f "repo/packages/auth/src/rbac/permissions-matrix.ts" ]; then
  add_row "T11-F2" "Fichier permissions-matrix.ts existe" "PASS" "Cree"
else
  add_row "T11-F2" "Fichier permissions-matrix.ts existe" "FAIL" "Manquant"
fi
# Test T11-F3: Existence fichier repo/apps/api/test/insure/sprint-15-permissions.e2e-spec.ts
if [ -f "repo/apps/api/test/insure/sprint-15-permissions.e2e-spec.ts" ]; then
  add_row "T11-F3" "Fichier sprint-15-permissions.e2e-spec.ts existe" "PASS" "Cree"
else
  add_row "T11-F3" "Fichier sprint-15-permissions.e2e-spec.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T11-V1: 12+ permissions Sprint 15 ajoutees (P0)
echo "  Verifying T11-V1 : 12+ permissions Sprint 15 ajoutees..."
add_row "T11-V1" "12+ permissions Sprint 15 ajoutees" "WARN" "(P0) Voir B-15 Tache 4.2.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V2: Roles broker_* enrichis (P0)
echo "  Verifying T11-V2 : Roles broker_* enrichis..."
add_row "T11-V2" "Roles broker_* enrichis" "WARN" "(P0) Voir B-15 Tache 4.2.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V3: Tests RBAC 10+ scenarios (P0)
echo "  Verifying T11-V3 : Tests RBAC 10+ scenarios..."
add_row "T11-V3" "Tests RBAC 10+ scenarios" "WARN" "(P0) Voir B-15 Tache 4.2.11 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 12/5 -- 4.2.12 : Audit Trail Enrichi + Kafka Events

```bash
echo ""
echo "================================================"
echo "TACHE 4.2.12 : Audit Trail Enrichi + Kafka Events"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T12-F1: Existence fichier repo/packages/analytics/src/etl/postgres-to-clickhouse.etl.ts
if [ -f "repo/packages/analytics/src/etl/postgres-to-clickhouse.etl.ts" ]; then
  add_row "T12-F1" "Fichier postgres-to-clickhouse.etl.ts existe" "PASS" "Cree"
else
  add_row "T12-F1" "Fichier postgres-to-clickhouse.etl.ts existe" "FAIL" "Manquant"
fi
# Test T12-F2: Existence fichier repo/apps/api/src/modules/analytics/services/insure-operations-dashboard.service.ts
if [ -f "repo/apps/api/src/modules/analytics/services/insure-operations-dashboard.service.ts" ]; then
  add_row "T12-F2" "Fichier insure-operations-dashboard.service.ts existe" "PASS" "Cree"
else
  add_row "T12-F2" "Fichier insure-operations-dashboard.service.ts existe" "FAIL" "Manquant"
fi
# Test T12-F3: Existence fichier repo/apps/api/test/insure/sprint-15-audit.e2e-spec.ts
if [ -f "repo/apps/api/test/insure/sprint-15-audit.e2e-spec.ts" ]; then
  add_row "T12-F3" "Fichier sprint-15-audit.e2e-spec.ts existe" "PASS" "Cree"
else
  add_row "T12-F3" "Fichier sprint-15-audit.e2e-spec.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T12-V1: 15+ Kafka events specifiques (P0)
echo "  Verifying T12-V1 : 15+ Kafka events specifiques..."
add_row "T12-V1" "15+ Kafka events specifiques" "WARN" "(P0) Voir B-15 Tache 4.2.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V2: audit_log enrichi (P0)
echo "  Verifying T12-V2 : audit_log enrichi..."
add_row "T12-V2" "audit_log enrichi" "WARN" "(P0) Voir B-15 Tache 4.2.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V3: ETL ClickHouse sync nouvelles tables (P0)
echo "  Verifying T12-V3 : ETL ClickHouse sync nouvelles tables..."
add_row "T12-V3" "ETL ClickHouse sync nouvelles tables" "WARN" "(P0) Voir B-15 Tache 4.2.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V4: Dashboard 'Insure Operations' (P0)
echo "  Verifying T12-V4 : Dashboard 'Insure Operations'..."
add_row "T12-V4" "Dashboard 'Insure Operations'" "WARN" "(P0) Voir B-15 Tache 4.2.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V5: Tests 8+ scenarios (P0)
echo "  Verifying T12-V5 : Tests 8+ scenarios..."
add_row "T12-V5" "Tests 8+ scenarios" "WARN" "(P0) Voir B-15 Tache 4.2.12 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 13/4 -- 4.2.13 : Tests E2E (50+) + Fixtures Cas Complexes

```bash
echo ""
echo "================================================"
echo "TACHE 4.2.13 : Tests E2E (50+) + Fixtures Cas Complexes"
echo "Priorite : P0 | Effort : 8h"
echo "Criteres a verifier : 4"
echo "================================================"

# === Verification fichiers crees ===
# Test T13-F1: Existence fichier repo/apps/api/test/insure/sprint-15/{50+ specs}.e2e-spec.ts
if [ -f "repo/apps/api/test/insure/sprint-15/{50+ specs}.e2e-spec.ts" ]; then
  add_row "T13-F1" "Fichier {50+ specs}.e2e-spec.ts existe" "PASS" "Cree"
else
  add_row "T13-F1" "Fichier {50+ specs}.e2e-spec.ts existe" "FAIL" "Manquant"
fi
# Test T13-F2: Existence fichier repo/infrastructure/scripts/seed-insure-sprint15-fixtures.ts
if [ -f "repo/infrastructure/scripts/seed-insure-sprint15-fixtures.ts" ]; then
  add_row "T13-F2" "Fichier seed-insure-sprint15-fixtures.ts existe" "PASS" "Cree"
else
  add_row "T13-F2" "Fichier seed-insure-sprint15-fixtures.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T13-V1: 50+ tests passent (P0)
echo "  Verifying T13-V1 : 50+ tests passent..."
add_row "T13-V1" "50+ tests passent" "WARN" "(P0) Voir B-15 Tache 4.2.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V2: CI green (P0)
echo "  Verifying T13-V2 : CI green..."
add_row "T13-V2" "CI green" "WARN" "(P0) Voir B-15 Tache 4.2.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V3: Fixtures realistes (P0)
echo "  Verifying T13-V3 : Fixtures realistes..."
add_row "T13-V3" "Fixtures realistes" "WARN" "(P0) Voir B-15 Tache 4.2.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V4: Reproducibility 5x (P0)
echo "  Verifying T13-V4 : Reproducibility 5x..."
add_row "T13-V4" "Reproducibility 5x" "WARN" "(P0) Voir B-15 Tache 4.2.13 pour test detaille - critere a auto-tester via script ad-hoc"

```

---


---


## VERIFICATIONS TRANSVERSALES SPRINT 15

### TR-BUILD : Build complet du sprint

```bash
echo ""
echo "================================================"
echo "VERIFICATIONS TRANSVERSALES SPRINT 15"
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

### TR-MIGRATIONS : Migrations DB Sprint 15

```bash
echo "=== TR-MIGRATIONS : Migrations DB ==="
MIGR_COUNT=$(pg_query "SELECT COUNT(*) FROM migrations WHERE name LIKE '%sprint15%' OR name LIKE '%Sprint15%'" || echo 0)
if [ "$MIGR_COUNT" -gt 0 ]; then
  add_row "TR-MIG" "Migrations Sprint 15 appliquees" "PASS" "$MIGR_COUNT migrations"
else
  add_row "TR-MIG" "Migrations Sprint 15 appliquees" "WARN" "Aucune migration detectee (verifier)"
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
echo "GENERATION DU RAPPORT FINAL SPRINT 15"
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

## Jalon GO/NO-GO Sprint 15

EOF

# Calcul statut final
if (( $(echo "$SCORE >= 95" | bc -l) )); then
  STATUT="GO"
  cat >> "$REPORT_FILE" << EOF
**STATUT** : GO -- Sprint 15 valide, passage Sprint 16 autorise

Le sprint a passe les criteres requis. Cowork peut demarrer Sprint 16.

EOF
  echo ""
  echo "================================================"
  echo "SPRINT 15 : GO ($SCORE%)"
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
  echo "SPRINT 15 : GO CONDITIONNEL ($SCORE%)"
  echo "================================================"
else
  STATUT="NO-GO"
  cat >> "$REPORT_FILE" << EOF
**STATUT** : NO-GO -- Score $SCORE% trop bas (cible 85% minimum)

Le sprint **doit etre repris** :
- Lister tous FAIL P0
- Escalation Saad/Abla decision (cut scope OR delai)
- Reprise sprint avant Sprint 16

EOF
  echo ""
  echo "================================================"
  echo "SPRINT 15 : NO-GO ($SCORE%)"
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
  echo "git commit -m \"chore(sprint-15): close sprint 15 -- $STATUT ($SCORE%)\"" >> "$REPORT_FILE"
  echo '```' >> "$REPORT_FILE"
fi

echo ""
echo "Rapport complet dans : $REPORT_FILE"
```

---

## INSTRUCTION FINALE A CLAUDE CODE / COWORK

Apres l'execution complete des verifications ci-dessus :

1. **Lis le contenu de `sprint15-verify-report.md`** integralement
2. **Identifie les FAIL critiques** (criteres P0) qui necessitent intervention manuelle
3. **Affiche un resume executif** :
   - Nombre total de criteres
   - Pourcentage PASS / PASS\* / FAIL / WARN
   - Liste des FAIL avec contexte technique
   - Recommandation : GO / GO CONDITIONNEL / NO-GO
4. **Si NO-GO** : ne pas demarrer le Sprint suivant, alerter Saad/Abla via Slack `#insurtech-dev`
5. **Si GO ou GO CONDITIONNEL** : produire le commit de cloture du sprint :

```bash
git add skalean-insurtech/sprint15-verify-report.md
git commit -m "chore(sprint-15): close sprint 15 with verification report

- Verification automatique executee
- Score global : <SCORE>%
- <PASS> criteres PASS, <PASS_REPAIRED> reparations auto, <FAIL> FAIL
- Statut : <GO|GO CONDITIONNEL|NO-GO>

Phase: 4 -- Vertical Insure (Skalean Broker ERP)
Sprint: 15 (Phase 4 / Sprint 2)
Reference B-15, C-15, V-15
Report: sprint15-verify-report.md"
```

6. **Documentation continue** : si decisions techniques prises pendant verification, ajouter notes dans `repo/docs/runbooks/sprint-15-lessons-learned.md`

---

**Fin de la verification V-15 v2.2 detaillee -- Sprint 15 (4.2) Insure Lifecycle Avance (transferts/flottes/queue).**

**Total criteres taches** : 67 | **Total transversaux** : ~10 | **Effort sprint** : 75h
