# VERIFICATION SPRINT 14 -- Phase 4 / Sprint 1 : Insure Foundation (lookup tables tarification)
# Version : Auto-reparation active + Rapport final MD detaille
# 14 taches, 66 criteres extraits B-14
# AUCUNE EMOJI AUTORISEE

**Version** : v2.2 (verification detaillee)
**Phase** : 4 -- Vertical Insure (Skalean Broker ERP)
**Sprint** : 14 / 35 (cumul) -- Sprint 1 dans Phase 4
**Reference meta-prompt** : `B-14-sprint-14-insure-foundation.md`
**Reference orchestrateur** : `C-14-sprint-14-insure-foundation.md`
**Total criteres** : 66 criteres taches + ~10 transversaux

---

Tu es **Claude Code (ou Cowork)**. Tu dois executer une **verification COMPLETE et EXHAUSTIVE** du Sprint 14 apres execution toutes les 14 taches.

---

## REGLES D'EXECUTION

1. Tu **executes CHAQUE verification dans l'ordre** (taches puis transversales)
2. Quand une verification echoue, tu **TENTES UNE REPARATION AUTOMATIQUE** avant de noter FAIL
3. Apres chaque tentative de reparation, tu **re-executes la verification**
4. Tu consignes dans `sprint14-verify-report.md` **TOUS les resultats** au fil de l'execution
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
REPORT_FILE="sprint14-verify-report.md"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
RUN_ID=$(date '+%Y%m%d-%H%M%S')

cat > "$REPORT_FILE" << EOF
# Rapport de Verification - Sprint 14 : Insure Foundation (lookup tables tarification)

**Date** : $TIMESTAMP
**Run ID** : $RUN_ID
**Phase** : 4 -- Vertical Insure (Skalean Broker ERP)
**Sprint** : 14 (Phase 4 / Sprint 1)
**Reference B-14** : 14 taches, 66 criteres extraits
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

## VERIFICATIONS PAR TACHE (14 taches)

## TACHE 1/8 -- 4.1.1 : insure_products Entity + Catalog 5 Branches

```bash
echo ""
echo "================================================"
echo "TACHE 4.1.1 : insure_products Entity + Catalog 5 Branches"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 8"
echo "================================================"

# === Verification fichiers crees ===
# Test T01-F1: Existence fichier repo/packages/database/src/migrations/{date}-InsureProducts.ts
if [ -f "repo/packages/database/src/migrations/{date}-InsureProducts.ts" ]; then
  add_row "T01-F1" "Fichier {date}-InsureProducts.ts existe" "PASS" "Cree"
else
  add_row "T01-F1" "Fichier {date}-InsureProducts.ts existe" "FAIL" "Manquant"
fi
# Test T01-F2: Existence fichier repo/packages/insure/src/entities/insure-product.entity.ts
if [ -f "repo/packages/insure/src/entities/insure-product.entity.ts" ]; then
  add_row "T01-F2" "Fichier insure-product.entity.ts existe" "PASS" "Cree"
else
  add_row "T01-F2" "Fichier insure-product.entity.ts existe" "FAIL" "Manquant"
fi
# Test T01-F3: Existence fichier repo/packages/insure/src/services/products.service.ts
if [ -f "repo/packages/insure/src/services/products.service.ts" ]; then
  add_row "T01-F3" "Fichier products.service.ts existe" "PASS" "Cree"
else
  add_row "T01-F3" "Fichier products.service.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T01-V1: Migration creee + 5 branches enum (P0)
echo "  Verifying T01-V1 : Migration creee + 5 branches enum..."
add_row "T01-V1" "Migration creee + 5 branches enum" "WARN" "(P0) Voir B-14 Tache 4.1.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V2: Templates super admin only (P0)
echo "  Verifying T01-V2 : Templates super admin only..."
add_row "T01-V2" "Templates super admin only" "WARN" "(P0) Voir B-14 Tache 4.1.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V3: Variants tenant heritage parent (P0)
echo "  Verifying T01-V3 : Variants tenant heritage parent..."
add_row "T01-V3" "Variants tenant heritage parent" "WARN" "(P0) Voir B-14 Tache 4.1.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V4: 10+ templates seed crees (P0)
echo "  Verifying T01-V4 : 10+ templates seed crees..."
add_row "T01-V4" "10+ templates seed crees" "WARN" "(P0) Voir B-14 Tache 4.1.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V5: Garanties JSONB structuree (P0)
echo "  Verifying T01-V5 : Garanties JSONB structuree..."
add_row "T01-V5" "Garanties JSONB structuree" "WARN" "(P0) Voir B-14 Tache 4.1.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V6: Commission rate per product (P0)
echo "  Verifying T01-V6 : Commission rate per product..."
add_row "T01-V6" "Commission rate per product" "WARN" "(P0) Voir B-14 Tache 4.1.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V7: Audit + Kafka events (P0)
echo "  Verifying T01-V7 : Audit + Kafka events..."
add_row "T01-V7" "Audit + Kafka events" "WARN" "(P0) Voir B-14 Tache 4.1.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V8: Tests 10+ scenarios (P0)
echo "  Verifying T01-V8 : Tests 10+ scenarios..."
add_row "T01-V8" "Tests 10+ scenarios" "WARN" "(P0) Voir B-14 Tache 4.1.1 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 2/7 -- 4.1.2 : Tarification Engine Basique (Lookup Tables)

```bash
echo ""
echo "================================================"
echo "TACHE 4.1.2 : Tarification Engine Basique (Lookup Tables)"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 7"
echo "================================================"

# === Verification fichiers crees ===
# Test T02-F1: Existence fichier repo/packages/insure/src/services/tarification.service.ts
if [ -f "repo/packages/insure/src/services/tarification.service.ts" ]; then
  add_row "T02-F1" "Fichier tarification.service.ts existe" "PASS" "Cree"
else
  add_row "T02-F1" "Fichier tarification.service.ts existe" "FAIL" "Manquant"
fi
# Test T02-F2: Existence fichier repo/packages/insure/src/services/branche-calculators/auto.calculator.ts
if [ -f "repo/packages/insure/src/services/branche-calculators/auto.calculator.ts" ]; then
  add_row "T02-F2" "Fichier auto.calculator.ts existe" "PASS" "Cree"
else
  add_row "T02-F2" "Fichier auto.calculator.ts existe" "FAIL" "Manquant"
fi
# Test T02-F3: Existence fichier repo/packages/insure/src/services/branche-calculators/sante.calculator.ts
if [ -f "repo/packages/insure/src/services/branche-calculators/sante.calculator.ts" ]; then
  add_row "T02-F3" "Fichier sante.calculator.ts existe" "PASS" "Cree"
else
  add_row "T02-F3" "Fichier sante.calculator.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T02-V1: 5 calculators (1 par branche) implementent interface (P0)
echo "  Verifying T02-V1 : 5 calculators (1 par branche) implementent interface..."
add_row "T02-V1" "5 calculators (1 par branche) implementent interface" "WARN" "(P0) Voir B-14 Tache 4.1.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V2: Auto : young driver +30% (P0)
echo "  Verifying T02-V2 : Auto : young driver +30%..."
add_row "T02-V2" "Auto : young driver +30%" "WARN" "(P0) Voir B-14 Tache 4.1.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V3: Auto : no claim bonus -10% (P0)
echo "  Verifying T02-V3 : Auto : no claim bonus -10%..."
add_row "T02-V3" "Auto : no claim bonus -10%" "WARN" "(P0) Voir B-14 Tache 4.1.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V4: Sante : age multiplier (P0)
echo "  Verifying T02-V4 : Sante : age multiplier..."
add_row "T02-V4" "Sante : age multiplier" "WARN" "(P0) Voir B-14 Tache 4.1.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V5: TVA 14% appliquee (P0)
echo "  Verifying T02-V5 : TVA 14% appliquee..."
add_row "T02-V5" "TVA 14% appliquee" "WARN" "(P0) Voir B-14 Tache 4.1.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V6: Cache lookup tables Redis (P0)
echo "  Verifying T02-V6 : Cache lookup tables Redis..."
add_row "T02-V6" "Cache lookup tables Redis" "WARN" "(P0) Voir B-14 Tache 4.1.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V7: Tests 25+ scenarios (P0)
echo "  Verifying T02-V7 : Tests 25+ scenarios..."
add_row "T02-V7" "Tests 25+ scenarios" "WARN" "(P0) Voir B-14 Tache 4.1.2 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 3/6 -- 4.1.3 : insure_quotes Entity + Devis PDF

```bash
echo ""
echo "================================================"
echo "TACHE 4.1.3 : insure_quotes Entity + Devis PDF"
echo "Priorite : P0 | Effort : 7h"
echo "Criteres a verifier : 6"
echo "================================================"

# === Verification fichiers crees ===
# Test T03-F1: Existence fichier repo/packages/database/src/migrations/{date}-InsureQuotes.ts
if [ -f "repo/packages/database/src/migrations/{date}-InsureQuotes.ts" ]; then
  add_row "T03-F1" "Fichier {date}-InsureQuotes.ts existe" "PASS" "Cree"
else
  add_row "T03-F1" "Fichier {date}-InsureQuotes.ts existe" "FAIL" "Manquant"
fi
# Test T03-F2: Existence fichier repo/packages/insure/src/entities/insure-quote.entity.ts
if [ -f "repo/packages/insure/src/entities/insure-quote.entity.ts" ]; then
  add_row "T03-F2" "Fichier insure-quote.entity.ts existe" "PASS" "Cree"
else
  add_row "T03-F2" "Fichier insure-quote.entity.ts existe" "FAIL" "Manquant"
fi
# Test T03-F3: Existence fichier repo/packages/insure/src/services/quotes.service.ts
if [ -f "repo/packages/insure/src/services/quotes.service.ts" ]; then
  add_row "T03-F3" "Fichier quotes.service.ts existe" "PASS" "Cree"
else
  add_row "T03-F3" "Fichier quotes.service.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T03-V1: Create quote auto-tarification (P0)
echo "  Verifying T03-V1 : Create quote auto-tarification..."
add_row "T03-V1" "Create quote auto-tarification" "WARN" "(P0) Voir B-14 Tache 4.1.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V2: Send genere PDF + email (P0)
echo "  Verifying T03-V2 : Send genere PDF + email..."
add_row "T03-V2" "Send genere PDF + email" "WARN" "(P0) Voir B-14 Tache 4.1.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V3: Validity expiry cron (P0)
echo "  Verifying T03-V3 : Validity expiry cron..."
add_row "T03-V3" "Validity expiry cron" "WARN" "(P0) Voir B-14 Tache 4.1.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V4: Accept transition + trigger souscription (P0)
echo "  Verifying T03-V4 : Accept transition + trigger souscription..."
add_row "T03-V4" "Accept transition + trigger souscription" "WARN" "(P0) Voir B-14 Tache 4.1.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V5: Multi-tenant + RBAC (P0)
echo "  Verifying T03-V5 : Multi-tenant + RBAC..."
add_row "T03-V5" "Multi-tenant + RBAC" "WARN" "(P0) Voir B-14 Tache 4.1.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V6: Tests 12+ scenarios (P0)
echo "  Verifying T03-V6 : Tests 12+ scenarios..."
add_row "T03-V6" "Tests 12+ scenarios" "WARN" "(P0) Voir B-14 Tache 4.1.3 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 4/5 -- 4.1.4 : insure_policies Entity + Status Workflow

```bash
echo ""
echo "================================================"
echo "TACHE 4.1.4 : insure_policies Entity + Status Workflow"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T04-F1: Existence fichier repo/packages/database/src/migrations/{date}-InsurePolicies.ts
if [ -f "repo/packages/database/src/migrations/{date}-InsurePolicies.ts" ]; then
  add_row "T04-F1" "Fichier {date}-InsurePolicies.ts existe" "PASS" "Cree"
else
  add_row "T04-F1" "Fichier {date}-InsurePolicies.ts existe" "FAIL" "Manquant"
fi
# Test T04-F2: Existence fichier repo/packages/insure/src/entities/insure-policy.entity.ts
if [ -f "repo/packages/insure/src/entities/insure-policy.entity.ts" ]; then
  add_row "T04-F2" "Fichier insure-policy.entity.ts existe" "PASS" "Cree"
else
  add_row "T04-F2" "Fichier insure-policy.entity.ts existe" "FAIL" "Manquant"
fi
# Test T04-F3: Existence fichier repo/packages/insure/src/services/policies.service.ts
if [ -f "repo/packages/insure/src/services/policies.service.ts" ]; then
  add_row "T04-F3" "Fichier policies.service.ts existe" "PASS" "Cree"
else
  add_row "T04-F3" "Fichier policies.service.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T04-V1: policy_number sequentiel format correct (P0)
echo "  Verifying T04-V1 : policy_number sequentiel format correct..."
add_row "T04-V1" "policy_number sequentiel format correct" "WARN" "(P0) Voir B-14 Tache 4.1.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V2: Status workflow transitions valid only (P0)
echo "  Verifying T04-V2 : Status workflow transitions valid only..."
add_row "T04-V2" "Status workflow transitions valid only" "WARN" "(P0) Voir B-14 Tache 4.1.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V3: Cancel avec reason + audit (P0)
echo "  Verifying T04-V3 : Cancel avec reason + audit..."
add_row "T04-V3" "Cancel avec reason + audit" "WARN" "(P0) Voir B-14 Tache 4.1.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V4: Filtres expiring_soon = end_date < NOW + 60j (P0)
echo "  Verifying T04-V4 : Filtres expiring_soon = end_date < NOW + 60j..."
add_row "T04-V4" "Filtres expiring_soon = end_date < NOW + 60j" "WARN" "(P0) Voir B-14 Tache 4.1.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V5: Tests 10+ scenarios (P0)
echo "  Verifying T04-V5 : Tests 10+ scenarios..."
add_row "T04-V5" "Tests 10+ scenarios" "WARN" "(P0) Voir B-14 Tache 4.1.4 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 5/6 -- 4.1.5 : Souscription Workflow : Quote -> Policy via Signature

```bash
echo ""
echo "================================================"
echo "TACHE 4.1.5 : Souscription Workflow : Quote -> Policy via Signature"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 6"
echo "================================================"

# === Verification fichiers crees ===
# Test T05-F1: Existence fichier repo/packages/insure/src/services/souscription.service.ts
if [ -f "repo/packages/insure/src/services/souscription.service.ts" ]; then
  add_row "T05-F1" "Fichier souscription.service.ts existe" "PASS" "Cree"
else
  add_row "T05-F1" "Fichier souscription.service.ts existe" "FAIL" "Manquant"
fi
# Test T05-F2: Existence fichier repo/packages/insure/src/consumers/signature-completed.consumer.ts
if [ -f "repo/packages/insure/src/consumers/signature-completed.consumer.ts" ]; then
  add_row "T05-F2" "Fichier signature-completed.consumer.ts existe" "PASS" "Cree"
else
  add_row "T05-F2" "Fichier signature-completed.consumer.ts existe" "FAIL" "Manquant"
fi
# Test T05-F3: Existence fichier repo/apps/api/src/modules/insure/controllers/souscription.controller.ts
if [ -f "repo/apps/api/src/modules/insure/controllers/souscription.controller.ts" ]; then
  add_row "T05-F3" "Fichier souscription.controller.ts existe" "PASS" "Cree"
else
  add_row "T05-F3" "Fichier souscription.controller.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T05-V1: Initiate souscription cree policy + signing workflow (P0)
echo "  Verifying T05-V1 : Initiate souscription cree policy + signing workflow..."
add_row "T05-V1" "Initiate souscription cree policy + signing workflow" "WARN" "(P0) Voir B-14 Tache 4.1.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V2: Signature completed -> policy active + premiums + commission (P0)
echo "  Verifying T05-V2 : Signature completed -> policy active + premiums + commission..."
add_row "T05-V2" "Signature completed -> policy active + premiums + commission" "WARN" "(P0) Voir B-14 Tache 4.1.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V3: Signature declined -> policy cancelled (P0)
echo "  Verifying T05-V3 : Signature declined -> policy cancelled..."
add_row "T05-V3" "Signature declined -> policy cancelled" "WARN" "(P0) Voir B-14 Tache 4.1.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V4: Signature expired -> policy expired (P0)
echo "  Verifying T05-V4 : Signature expired -> policy expired..."
add_row "T05-V4" "Signature expired -> policy expired" "WARN" "(P0) Voir B-14 Tache 4.1.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V5: Idempotency consumer (P0)
echo "  Verifying T05-V5 : Idempotency consumer..."
add_row "T05-V5" "Idempotency consumer" "WARN" "(P0) Voir B-14 Tache 4.1.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V6: Tests E2E full flow 8+ scenarios (P0)
echo "  Verifying T05-V6 : Tests E2E full flow 8+ scenarios..."
add_row "T05-V6" "Tests E2E full flow 8+ scenarios" "WARN" "(P0) Voir B-14 Tache 4.1.5 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 6/4 -- 4.1.6 : insure_avenants Entity + Service

```bash
echo ""
echo "================================================"
echo "TACHE 4.1.6 : insure_avenants Entity + Service"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 4"
echo "================================================"

# === Verification fichiers crees ===
# Test T06-F1: Existence fichier repo/packages/database/src/migrations/{date}-InsureAvenants.ts
if [ -f "repo/packages/database/src/migrations/{date}-InsureAvenants.ts" ]; then
  add_row "T06-F1" "Fichier {date}-InsureAvenants.ts existe" "PASS" "Cree"
else
  add_row "T06-F1" "Fichier {date}-InsureAvenants.ts existe" "FAIL" "Manquant"
fi
# Test T06-F2: Existence fichier repo/packages/insure/src/entities/insure-avenant.entity.ts
if [ -f "repo/packages/insure/src/entities/insure-avenant.entity.ts" ]; then
  add_row "T06-F2" "Fichier insure-avenant.entity.ts existe" "PASS" "Cree"
else
  add_row "T06-F2" "Fichier insure-avenant.entity.ts existe" "FAIL" "Manquant"
fi
# Test T06-F3: Existence fichier repo/packages/insure/src/services/avenants.service.ts
if [ -f "repo/packages/insure/src/services/avenants.service.ts" ]; then
  add_row "T06-F3" "Fichier avenants.service.ts existe" "PASS" "Cree"
else
  add_row "T06-F3" "Fichier avenants.service.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T06-V1: Create avenant ajout garantie (P0)
echo "  Verifying T06-V1 : Create avenant ajout garantie..."
add_row "T06-V1" "Create avenant ajout garantie" "WARN" "(P0) Voir B-14 Tache 4.1.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V2: Recalcul prime + complement pro-rata (P0)
echo "  Verifying T06-V2 : Recalcul prime + complement pro-rata..."
add_row "T06-V2" "Recalcul prime + complement pro-rata" "WARN" "(P0) Voir B-14 Tache 4.1.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V3: Workflow signature trigger (P0)
echo "  Verifying T06-V3 : Workflow signature trigger..."
add_row "T06-V3" "Workflow signature trigger" "WARN" "(P0) Voir B-14 Tache 4.1.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V4: Tests 8+ scenarios (P0)
echo "  Verifying T06-V4 : Tests 8+ scenarios..."
add_row "T06-V4" "Tests 8+ scenarios" "WARN" "(P0) Voir B-14 Tache 4.1.6 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 7/4 -- 4.1.7 : insure_premiums Echeancier + Tracking

```bash
echo ""
echo "================================================"
echo "TACHE 4.1.7 : insure_premiums Echeancier + Tracking"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 4"
echo "================================================"

# === Verification fichiers crees ===
# Test T07-F1: Existence fichier repo/packages/database/src/migrations/{date}-InsurePremiums.ts
if [ -f "repo/packages/database/src/migrations/{date}-InsurePremiums.ts" ]; then
  add_row "T07-F1" "Fichier {date}-InsurePremiums.ts existe" "PASS" "Cree"
else
  add_row "T07-F1" "Fichier {date}-InsurePremiums.ts existe" "FAIL" "Manquant"
fi
# Test T07-F2: Existence fichier repo/packages/insure/src/entities/insure-premium.entity.ts
if [ -f "repo/packages/insure/src/entities/insure-premium.entity.ts" ]; then
  add_row "T07-F2" "Fichier insure-premium.entity.ts existe" "PASS" "Cree"
else
  add_row "T07-F2" "Fichier insure-premium.entity.ts existe" "FAIL" "Manquant"
fi
# Test T07-F3: Existence fichier repo/packages/insure/src/services/premiums.service.ts
if [ -f "repo/packages/insure/src/services/premiums.service.ts" ]; then
  add_row "T07-F3" "Fichier premiums.service.ts existe" "PASS" "Cree"
else
  add_row "T07-F3" "Fichier premiums.service.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T07-V1: Schedule annual / quarterly / monthly (P0)
echo "  Verifying T07-V1 : Schedule annual / quarterly / monthly..."
add_row "T07-V1" "Schedule annual / quarterly / monthly" "WARN" "(P0) Voir B-14 Tache 4.1.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V2: Pay capture -> premium paid auto (P0)
echo "  Verifying T07-V2 : Pay capture -> premium paid auto..."
add_row "T07-V2" "Pay capture -> premium paid auto" "WARN" "(P0) Voir B-14 Tache 4.1.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V3: Overdue cron daily (P0)
echo "  Verifying T07-V3 : Overdue cron daily..."
add_row "T07-V3" "Overdue cron daily" "WARN" "(P0) Voir B-14 Tache 4.1.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V4: Tests 8+ scenarios (P0)
echo "  Verifying T07-V4 : Tests 8+ scenarios..."
add_row "T07-V4" "Tests 8+ scenarios" "WARN" "(P0) Voir B-14 Tache 4.1.7 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 8/4 -- 4.1.8 : insure_renewals Cron 60j Avant Expiration

```bash
echo ""
echo "================================================"
echo "TACHE 4.1.8 : insure_renewals Cron 60j Avant Expiration"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 4"
echo "================================================"

# === Verification fichiers crees ===
# Test T08-F1: Existence fichier repo/packages/database/src/migrations/{date}-InsureRenewals.ts
if [ -f "repo/packages/database/src/migrations/{date}-InsureRenewals.ts" ]; then
  add_row "T08-F1" "Fichier {date}-InsureRenewals.ts existe" "PASS" "Cree"
else
  add_row "T08-F1" "Fichier {date}-InsureRenewals.ts existe" "FAIL" "Manquant"
fi
# Test T08-F2: Existence fichier repo/packages/insure/src/entities/insure-renewal.entity.ts
if [ -f "repo/packages/insure/src/entities/insure-renewal.entity.ts" ]; then
  add_row "T08-F2" "Fichier insure-renewal.entity.ts existe" "PASS" "Cree"
else
  add_row "T08-F2" "Fichier insure-renewal.entity.ts existe" "FAIL" "Manquant"
fi
# Test T08-F3: Existence fichier repo/packages/insure/src/services/renewals.service.ts
if [ -f "repo/packages/insure/src/services/renewals.service.ts" ]; then
  add_row "T08-F3" "Fichier renewals.service.ts existe" "PASS" "Cree"
else
  add_row "T08-F3" "Fichier renewals.service.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T08-V1: Cron daily detect expiring 60j (P0)
echo "  Verifying T08-V1 : Cron daily detect expiring 60j..."
add_row "T08-V1" "Cron daily detect expiring 60j" "WARN" "(P0) Voir B-14 Tache 4.1.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V2: Renewal quote genere + email envoyee (P0)
echo "  Verifying T08-V2 : Renewal quote genere + email envoyee..."
add_row "T08-V2" "Renewal quote genere + email envoyee" "WARN" "(P0) Voir B-14 Tache 4.1.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V3: Accept renewal -> new policy (P0)
echo "  Verifying T08-V3 : Accept renewal -> new policy..."
add_row "T08-V3" "Accept renewal -> new policy" "WARN" "(P0) Voir B-14 Tache 4.1.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V4: Tests 6+ scenarios (P0)
echo "  Verifying T08-V4 : Tests 6+ scenarios..."
add_row "T08-V4" "Tests 6+ scenarios" "WARN" "(P0) Voir B-14 Tache 4.1.8 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 9/5 -- 4.1.9 : insure_commissions Auto-Calcul + Books

```bash
echo ""
echo "================================================"
echo "TACHE 4.1.9 : insure_commissions Auto-Calcul + Books"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T09-F1: Existence fichier repo/packages/database/src/migrations/{date}-InsureCommissions.ts
if [ -f "repo/packages/database/src/migrations/{date}-InsureCommissions.ts" ]; then
  add_row "T09-F1" "Fichier {date}-InsureCommissions.ts existe" "PASS" "Cree"
else
  add_row "T09-F1" "Fichier {date}-InsureCommissions.ts existe" "FAIL" "Manquant"
fi
# Test T09-F2: Existence fichier repo/packages/insure/src/entities/insure-commission.entity.ts
if [ -f "repo/packages/insure/src/entities/insure-commission.entity.ts" ]; then
  add_row "T09-F2" "Fichier insure-commission.entity.ts existe" "PASS" "Cree"
else
  add_row "T09-F2" "Fichier insure-commission.entity.ts existe" "FAIL" "Manquant"
fi
# Test T09-F3: Existence fichier repo/packages/insure/src/services/commissions.service.ts
if [ -f "repo/packages/insure/src/services/commissions.service.ts" ]; then
  add_row "T09-F3" "Fichier commissions.service.ts existe" "PASS" "Cree"
else
  add_row "T09-F3" "Fichier commissions.service.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T09-V1: Calcul commission correct (prime x rate) (P0)
echo "  Verifying T09-V1 : Calcul commission correct (prime x rate)..."
add_row "T09-V1" "Calcul commission correct (prime x rate)" "WARN" "(P0) Voir B-14 Tache 4.1.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V2: Premium paid -> commission recorded auto (P0)
echo "  Verifying T09-V2 : Premium paid -> commission recorded auto..."
add_row "T09-V2" "Premium paid -> commission recorded auto" "WARN" "(P0) Voir B-14 Tache 4.1.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V3: Journal entry creee (P0)
echo "  Verifying T09-V3 : Journal entry creee..."
add_row "T09-V3" "Journal entry creee" "WARN" "(P0) Voir B-14 Tache 4.1.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V4: Stats agreges (P0)
echo "  Verifying T09-V4 : Stats agreges..."
add_row "T09-V4" "Stats agreges" "WARN" "(P0) Voir B-14 Tache 4.1.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V5: Tests 8+ scenarios (P0)
echo "  Verifying T09-V5 : Tests 8+ scenarios..."
add_row "T09-V5" "Tests 8+ scenarios" "WARN" "(P0) Voir B-14 Tache 4.1.9 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 10/4 -- 4.1.10 : Cron Reminders Primes Echues

```bash
echo ""
echo "================================================"
echo "TACHE 4.1.10 : Cron Reminders Primes Echues"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 4"
echo "================================================"

# === Verification fichiers crees ===
# Test T10-F1: Existence fichier repo/packages/insure/src/jobs/premium-reminders.cron.ts
if [ -f "repo/packages/insure/src/jobs/premium-reminders.cron.ts" ]; then
  add_row "T10-F1" "Fichier premium-reminders.cron.ts existe" "PASS" "Cree"
else
  add_row "T10-F1" "Fichier premium-reminders.cron.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T10-V1: Cron daily emit reminders (P0)
echo "  Verifying T10-V1 : Cron daily emit reminders..."
add_row "T10-V1" "Cron daily emit reminders" "WARN" "(P0) Voir B-14 Tache 4.1.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V2: Anti-doublon via reminder_sent_at (P0)
echo "  Verifying T10-V2 : Anti-doublon via reminder_sent_at..."
add_row "T10-V2" "Anti-doublon via reminder_sent_at" "WARN" "(P0) Voir B-14 Tache 4.1.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V3: Escalade J+15 super admin (P0)
echo "  Verifying T10-V3 : Escalade J+15 super admin..."
add_row "T10-V3" "Escalade J+15 super admin" "WARN" "(P0) Voir B-14 Tache 4.1.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V4: Tests 6+ scenarios (P0)
echo "  Verifying T10-V4 : Tests 6+ scenarios..."
add_row "T10-V4" "Tests 6+ scenarios" "WARN" "(P0) Voir B-14 Tache 4.1.10 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 11/3 -- 4.1.11 : Auto-Log Interactions CRM + ACAPS Data Feed

```bash
echo ""
echo "================================================"
echo "TACHE 4.1.11 : Auto-Log Interactions CRM + ACAPS Data Feed"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 3"
echo "================================================"

# === Verification fichiers crees ===
# Test T11-F1: Existence fichier repo/packages/crm/src/consumers/insure-events-to-crm.consumer.ts
if [ -f "repo/packages/crm/src/consumers/insure-events-to-crm.consumer.ts" ]; then
  add_row "T11-F1" "Fichier insure-events-to-crm.consumer.ts existe" "PASS" "Cree"
else
  add_row "T11-F1" "Fichier insure-events-to-crm.consumer.ts existe" "FAIL" "Manquant"
fi
# Test T11-F2: Existence fichier repo/packages/compliance/src/services/quarterly-portfolio-report.service.ts
if [ -f "repo/packages/compliance/src/services/quarterly-portfolio-report.service.ts" ]; then
  add_row "T11-F2" "Fichier quarterly-portfolio-report.service.ts existe" "PASS" "Cree"
else
  add_row "T11-F2" "Fichier quarterly-portfolio-report.service.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T11-V1: Insure events -> CRM interactions logged (P0)
echo "  Verifying T11-V1 : Insure events -> CRM interactions logged..."
add_row "T11-V1" "Insure events -> CRM interactions logged" "WARN" "(P0) Voir B-14 Tache 4.1.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V2: ACAPS reports utilisent donnees reelles (P0)
echo "  Verifying T11-V2 : ACAPS reports utilisent donnees reelles..."
add_row "T11-V2" "ACAPS reports utilisent donnees reelles" "WARN" "(P0) Voir B-14 Tache 4.1.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V3: Tests 6+ scenarios (P0)
echo "  Verifying T11-V3 : Tests 6+ scenarios..."
add_row "T11-V3" "Tests 6+ scenarios" "WARN" "(P0) Voir B-14 Tache 4.1.11 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 12/3 -- 4.1.12 : Endpoints REST + Permissions

```bash
echo ""
echo "================================================"
echo "TACHE 4.1.12 : Endpoints REST + Permissions"
echo "Priorite : P0 | Effort : 6h"
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
# Test T12-F3: Existence fichier repo/apps/api/test/insure/permissions.e2e-spec.ts
if [ -f "repo/apps/api/test/insure/permissions.e2e-spec.ts" ]; then
  add_row "T12-F3" "Fichier permissions.e2e-spec.ts existe" "PASS" "Cree"
else
  add_row "T12-F3" "Fichier permissions.e2e-spec.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T12-V1: 15+ permissions Insure ajoutees (P0)
echo "  Verifying T12-V1 : 15+ permissions Insure ajoutees..."
add_row "T12-V1" "15+ permissions Insure ajoutees" "WARN" "(P0) Voir B-14 Tache 4.1.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V2: Roles broker_admin/user/assistant : permissions correctes (P0)
echo "  Verifying T12-V2 : Roles broker_admin/user/assistant : permissions correctes..."
add_row "T12-V2" "Roles broker_admin/user/assistant : permissions correctes" "WARN" "(P0) Voir B-14 Tache 4.1.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V3: Tests RBAC 10+ scenarios (P0)
echo "  Verifying T12-V3 : Tests RBAC 10+ scenarios..."
add_row "T12-V3" "Tests RBAC 10+ scenarios" "WARN" "(P0) Voir B-14 Tache 4.1.12 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 13/3 -- 4.1.13 : Dashboards Insure

```bash
echo ""
echo "================================================"
echo "TACHE 4.1.13 : Dashboards Insure"
echo "Priorite : P1 | Effort : 4h"
echo "Criteres a verifier : 3"
echo "================================================"

# === Verification fichiers crees ===
# Test T13-F1: Existence fichier repo/packages/analytics/src/etl/postgres-to-clickhouse.etl.ts
if [ -f "repo/packages/analytics/src/etl/postgres-to-clickhouse.etl.ts" ]; then
  add_row "T13-F1" "Fichier postgres-to-clickhouse.etl.ts existe" "PASS" "Cree"
else
  add_row "T13-F1" "Fichier postgres-to-clickhouse.etl.ts existe" "FAIL" "Manquant"
fi
# Test T13-F2: Existence fichier repo/infrastructure/clickhouse/schemas/fct_{policies,quotes,commissions}.sql
if [ -f "repo/infrastructure/clickhouse/schemas/fct_{policies,quotes,commissions}.sql" ]; then
  add_row "T13-F2" "Fichier fct_{policies,quotes,commissions}.sql existe" "PASS" "Cree"
else
  add_row "T13-F2" "Fichier fct_{policies,quotes,commissions}.sql existe" "FAIL" "Manquant"
fi
# Test T13-F3: Existence fichier repo/apps/api/src/modules/analytics/services/insure-dashboards.service.ts
if [ -f "repo/apps/api/src/modules/analytics/services/insure-dashboards.service.ts" ]; then
  add_row "T13-F3" "Fichier insure-dashboards.service.ts existe" "PASS" "Cree"
else
  add_row "T13-F3" "Fichier insure-dashboards.service.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T13-V1: 4 dashboards Insure (P1)
echo "  Verifying T13-V1 : 4 dashboards Insure..."
add_row "T13-V1" "4 dashboards Insure" "WARN" "(P1) Voir B-14 Tache 4.1.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V2: ETL etendu (P1)
echo "  Verifying T13-V2 : ETL etendu..."
add_row "T13-V2" "ETL etendu" "WARN" "(P1) Voir B-14 Tache 4.1.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V3: Tests 6+ scenarios (P1)
echo "  Verifying T13-V3 : Tests 6+ scenarios..."
add_row "T13-V3" "Tests 6+ scenarios" "WARN" "(P1) Voir B-14 Tache 4.1.13 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 14/4 -- 4.1.14 : Tests E2E (50+) + Fixtures + Seeds

```bash
echo ""
echo "================================================"
echo "TACHE 4.1.14 : Tests E2E (50+) + Fixtures + Seeds"
echo "Priorite : P0 | Effort : 11h"
echo "Criteres a verifier : 4"
echo "================================================"

# === Verification fichiers crees ===
# Test T14-F1: Existence fichier repo/apps/api/test/insure/{50+ specs}.e2e-spec.ts
if [ -f "repo/apps/api/test/insure/{50+ specs}.e2e-spec.ts" ]; then
  add_row "T14-F1" "Fichier {50+ specs}.e2e-spec.ts existe" "PASS" "Cree"
else
  add_row "T14-F1" "Fichier {50+ specs}.e2e-spec.ts existe" "FAIL" "Manquant"
fi
# Test T14-F2: Existence fichier repo/infrastructure/scripts/seed-insure.ts
if [ -f "repo/infrastructure/scripts/seed-insure.ts" ]; then
  add_row "T14-F2" "Fichier seed-insure.ts existe" "PASS" "Cree"
else
  add_row "T14-F2" "Fichier seed-insure.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T14-V1: 50+ tests passent (P0)
echo "  Verifying T14-V1 : 50+ tests passent..."
add_row "T14-V1" "50+ tests passent" "WARN" "(P0) Voir B-14 Tache 4.1.14 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T14-V2: CI green (P0)
echo "  Verifying T14-V2 : CI green..."
add_row "T14-V2" "CI green" "WARN" "(P0) Voir B-14 Tache 4.1.14 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T14-V3: Fixtures realistes 5 branches (P0)
echo "  Verifying T14-V3 : Fixtures realistes 5 branches..."
add_row "T14-V3" "Fixtures realistes 5 branches" "WARN" "(P0) Voir B-14 Tache 4.1.14 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T14-V4: Reproducibility 5x (P0)
echo "  Verifying T14-V4 : Reproducibility 5x..."
add_row "T14-V4" "Reproducibility 5x" "WARN" "(P0) Voir B-14 Tache 4.1.14 pour test detaille - critere a auto-tester via script ad-hoc"

```

---


---


## VERIFICATIONS TRANSVERSALES SPRINT 14

### TR-BUILD : Build complet du sprint

```bash
echo ""
echo "================================================"
echo "VERIFICATIONS TRANSVERSALES SPRINT 14"
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

### TR-MIGRATIONS : Migrations DB Sprint 14

```bash
echo "=== TR-MIGRATIONS : Migrations DB ==="
MIGR_COUNT=$(pg_query "SELECT COUNT(*) FROM migrations WHERE name LIKE '%sprint14%' OR name LIKE '%Sprint14%'" || echo 0)
if [ "$MIGR_COUNT" -gt 0 ]; then
  add_row "TR-MIG" "Migrations Sprint 14 appliquees" "PASS" "$MIGR_COUNT migrations"
else
  add_row "TR-MIG" "Migrations Sprint 14 appliquees" "WARN" "Aucune migration detectee (verifier)"
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
echo "GENERATION DU RAPPORT FINAL SPRINT 14"
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

## Jalon GO/NO-GO Sprint 14

EOF

# Calcul statut final
if (( $(echo "$SCORE >= 95" | bc -l) )); then
  STATUT="GO"
  cat >> "$REPORT_FILE" << EOF
**STATUT** : GO -- Sprint 14 valide, passage Sprint 15 autorise

Le sprint a passe les criteres requis. Cowork peut demarrer Sprint 15.

EOF
  echo ""
  echo "================================================"
  echo "SPRINT 14 : GO ($SCORE%)"
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
  echo "SPRINT 14 : GO CONDITIONNEL ($SCORE%)"
  echo "================================================"
else
  STATUT="NO-GO"
  cat >> "$REPORT_FILE" << EOF
**STATUT** : NO-GO -- Score $SCORE% trop bas (cible 85% minimum)

Le sprint **doit etre repris** :
- Lister tous FAIL P0
- Escalation Saad/Abla decision (cut scope OR delai)
- Reprise sprint avant Sprint 15

EOF
  echo ""
  echo "================================================"
  echo "SPRINT 14 : NO-GO ($SCORE%)"
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
  echo "git commit -m \"chore(sprint-14): close sprint 14 -- $STATUT ($SCORE%)\"" >> "$REPORT_FILE"
  echo '```' >> "$REPORT_FILE"
fi

echo ""
echo "Rapport complet dans : $REPORT_FILE"
```

---

## INSTRUCTION FINALE A CLAUDE CODE / COWORK

Apres l'execution complete des verifications ci-dessus :

1. **Lis le contenu de `sprint14-verify-report.md`** integralement
2. **Identifie les FAIL critiques** (criteres P0) qui necessitent intervention manuelle
3. **Affiche un resume executif** :
   - Nombre total de criteres
   - Pourcentage PASS / PASS\* / FAIL / WARN
   - Liste des FAIL avec contexte technique
   - Recommandation : GO / GO CONDITIONNEL / NO-GO
4. **Si NO-GO** : ne pas demarrer le Sprint suivant, alerter Saad/Abla via Slack `#insurtech-dev`
5. **Si GO ou GO CONDITIONNEL** : produire le commit de cloture du sprint :

```bash
git add skalean-insurtech/sprint14-verify-report.md
git commit -m "chore(sprint-14): close sprint 14 with verification report

- Verification automatique executee
- Score global : <SCORE>%
- <PASS> criteres PASS, <PASS_REPAIRED> reparations auto, <FAIL> FAIL
- Statut : <GO|GO CONDITIONNEL|NO-GO>

Phase: 4 -- Vertical Insure (Skalean Broker ERP)
Sprint: 14 (Phase 4 / Sprint 1)
Reference B-14, C-14, V-14
Report: sprint14-verify-report.md"
```

6. **Documentation continue** : si decisions techniques prises pendant verification, ajouter notes dans `repo/docs/runbooks/sprint-14-lessons-learned.md`

---

**Fin de la verification V-14 v2.2 detaillee -- Sprint 14 (4.1) Insure Foundation (lookup tables tarification).**

**Total criteres taches** : 66 | **Total transversaux** : ~10 | **Effort sprint** : 80h
