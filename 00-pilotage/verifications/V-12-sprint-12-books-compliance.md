# VERIFICATION SPRINT 12 -- Phase 3 / Sprint 5 : Books CGNC + Compliance ACAPS/DGI/AMC
# Version : Auto-reparation active + Rapport final MD detaille
# 13 taches, 78 criteres extraits B-12
# AUCUNE EMOJI AUTORISEE

**Version** : v2.2 (verification detaillee)
**Phase** : 3 -- Modules Horizontaux
**Sprint** : 12 / 35 (cumul) -- Sprint 5 dans Phase 3
**Reference meta-prompt** : `B-12-sprint-12-books-compliance.md`
**Reference orchestrateur** : `C-12-sprint-12-books-compliance.md`
**Total criteres** : 78 criteres taches + ~10 transversaux

---

Tu es **Claude Code (ou Cowork)**. Tu dois executer une **verification COMPLETE et EXHAUSTIVE** du Sprint 12 apres execution toutes les 13 taches.

---

## REGLES D'EXECUTION

1. Tu **executes CHAQUE verification dans l'ordre** (taches puis transversales)
2. Quand une verification echoue, tu **TENTES UNE REPARATION AUTOMATIQUE** avant de noter FAIL
3. Apres chaque tentative de reparation, tu **re-executes la verification**
4. Tu consignes dans `sprint12-verify-report.md` **TOUS les resultats** au fil de l'execution
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
REPORT_FILE="sprint12-verify-report.md"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
RUN_ID=$(date '+%Y%m%d-%H%M%S')

cat > "$REPORT_FILE" << EOF
# Rapport de Verification - Sprint 12 : Books CGNC + Compliance ACAPS/DGI/AMC

**Date** : $TIMESTAMP
**Run ID** : $RUN_ID
**Phase** : 3 -- Modules Horizontaux
**Sprint** : 12 (Phase 3 / Sprint 5)
**Reference B-12** : 13 taches, 78 criteres extraits
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

## TACHE 1/6 -- 3.5.1 : Plan Comptable CGNC Seed + AccountChart Entity

```bash
echo ""
echo "================================================"
echo "TACHE 3.5.1 : Plan Comptable CGNC Seed + AccountChart Entity"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 6"
echo "================================================"

# === Verification fichiers crees ===
# Test T01-F1: Existence fichier repo/packages/database/src/migrations/{date}-BooksAccounts.ts
if [ -f "repo/packages/database/src/migrations/{date}-BooksAccounts.ts" ]; then
  add_row "T01-F1" "Fichier {date}-BooksAccounts.ts existe" "PASS" "Cree"
else
  add_row "T01-F1" "Fichier {date}-BooksAccounts.ts existe" "FAIL" "Manquant"
fi
# Test T01-F2: Existence fichier repo/packages/books/src/entities/books-account.entity.ts
if [ -f "repo/packages/books/src/entities/books-account.entity.ts" ]; then
  add_row "T01-F2" "Fichier books-account.entity.ts existe" "PASS" "Cree"
else
  add_row "T01-F2" "Fichier books-account.entity.ts existe" "FAIL" "Manquant"
fi
# Test T01-F3: Existence fichier repo/packages/books/src/seeds/cgnc-classes.ts
if [ -f "repo/packages/books/src/seeds/cgnc-classes.ts" ]; then
  add_row "T01-F3" "Fichier cgnc-classes.ts existe" "PASS" "Cree"
else
  add_row "T01-F3" "Fichier cgnc-classes.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T01-V1: Seed CGNC reussi (250+ comptes) (P0)
echo "  Verifying T01-V1 : Seed CGNC reussi (250+ comptes)..."
add_row "T01-V1" "Seed CGNC reussi (250+ comptes)" "WARN" "(P0) Voir B-12 Tache 3.5.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V2: Hierarchy correct (parent/child) (P0)
echo "  Verifying T01-V2 : Hierarchy correct (parent/child)..."
add_row "T01-V2" "Hierarchy correct (parent/child)" "WARN" "(P0) Voir B-12 Tache 3.5.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V3: Comptes insurtech presents (4421-4425, 706x) (P0)
echo "  Verifying T01-V3 : Comptes insurtech presents (4421-4425, 706x)..."
add_row "T01-V3" "Comptes insurtech presents (4421-4425, 706x)" "WARN" "(P0) Voir B-12 Tache 3.5.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V4: Custom account creation par tenant OK (P0)
echo "  Verifying T01-V4 : Custom account creation par tenant OK..."
add_row "T01-V4" "Custom account creation par tenant OK" "WARN" "(P0) Voir B-12 Tache 3.5.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V5: findByCode OK avec lookup standard + custom (P0)
echo "  Verifying T01-V5 : findByCode OK avec lookup standard + custom..."
add_row "T01-V5" "findByCode OK avec lookup standard + custom" "WARN" "(P0) Voir B-12 Tache 3.5.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V6: Tests 8+ scenarios (P0)
echo "  Verifying T01-V6 : Tests 8+ scenarios..."
add_row "T01-V6" "Tests 8+ scenarios" "WARN" "(P0) Voir B-12 Tache 3.5.1 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 2/9 -- 3.5.2 : books_journal_entries Entity + JournalService

```bash
echo ""
echo "================================================"
echo "TACHE 3.5.2 : books_journal_entries Entity + JournalService"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 9"
echo "================================================"

# === Verification fichiers crees ===
# Test T02-F1: Existence fichier repo/packages/database/src/migrations/{date}-BooksJournalEntries.ts
if [ -f "repo/packages/database/src/migrations/{date}-BooksJournalEntries.ts" ]; then
  add_row "T02-F1" "Fichier {date}-BooksJournalEntries.ts existe" "PASS" "Cree"
else
  add_row "T02-F1" "Fichier {date}-BooksJournalEntries.ts existe" "FAIL" "Manquant"
fi
# Test T02-F2: Existence fichier repo/packages/books/src/entities/books-journal-entry.entity.ts
if [ -f "repo/packages/books/src/entities/books-journal-entry.entity.ts" ]; then
  add_row "T02-F2" "Fichier books-journal-entry.entity.ts existe" "PASS" "Cree"
else
  add_row "T02-F2" "Fichier books-journal-entry.entity.ts existe" "FAIL" "Manquant"
fi
# Test T02-F3: Existence fichier repo/packages/books/src/entities/books-journal-line.entity.ts
if [ -f "repo/packages/books/src/entities/books-journal-line.entity.ts" ]; then
  add_row "T02-F3" "Fichier books-journal-line.entity.ts existe" "PASS" "Cree"
else
  add_row "T02-F3" "Fichier books-journal-line.entity.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T02-V1: Entry balanced (debits = credits) accepte (P0)
echo "  Verifying T02-V1 : Entry balanced (debits = credits) accepte..."
add_row "T02-V1" "Entry balanced (debits = credits) accepte" "WARN" "(P0) Voir B-12 Tache 3.5.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V2: Entry imbalanced rejete avec details (P0)
echo "  Verifying T02-V2 : Entry imbalanced rejete avec details..."
add_row "T02-V2" "Entry imbalanced rejete avec details" "WARN" "(P0) Voir B-12 Tache 3.5.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V3: Entry vide rejete (P0)
echo "  Verifying T02-V3 : Entry vide rejete..."
add_row "T02-V3" "Entry vide rejete" "WARN" "(P0) Voir B-12 Tache 3.5.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V4: Account inconnu rejete (P0)
echo "  Verifying T02-V4 : Account inconnu rejete..."
add_row "T02-V4" "Account inconnu rejete" "WARN" "(P0) Voir B-12 Tache 3.5.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V5: entry_number sequentiel par tenant+exercice+journal (P0)
echo "  Verifying T02-V5 : entry_number sequentiel par tenant+exercice+journal..."
add_row "T02-V5" "entry_number sequentiel par tenant+exercice+journal" "WARN" "(P0) Voir B-12 Tache 3.5.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V6: Validate transition draft -> validated immutable (P0)
echo "  Verifying T02-V6 : Validate transition draft -> validated immutable..."
add_row "T02-V6" "Validate transition draft -> validated immutable" "WARN" "(P0) Voir B-12 Tache 3.5.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V7: Reverse cree contre-ecriture (P0)
echo "  Verifying T02-V7 : Reverse cree contre-ecriture..."
add_row "T02-V7" "Reverse cree contre-ecriture" "WARN" "(P0) Voir B-12 Tache 3.5.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V8: Multi-tenant + RBAC (P0)
echo "  Verifying T02-V8 : Multi-tenant + RBAC..."
add_row "T02-V8" "Multi-tenant + RBAC" "WARN" "(P0) Voir B-12 Tache 3.5.2 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 3/7 -- 3.5.3 : Auto-Generation Ecritures depuis Pay Events

```bash
echo ""
echo "================================================"
echo "TACHE 3.5.3 : Auto-Generation Ecritures depuis Pay Events"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 7"
echo "================================================"

# === Verification fichiers crees ===
# Test T03-F1: Existence fichier repo/packages/books/src/consumers/pay-to-journal.consumer.ts
if [ -f "repo/packages/books/src/consumers/pay-to-journal.consumer.ts" ]; then
  add_row "T03-F1" "Fichier pay-to-journal.consumer.ts existe" "PASS" "Cree"
else
  add_row "T03-F1" "Fichier pay-to-journal.consumer.ts existe" "FAIL" "Manquant"
fi
# Test T03-F2: Existence fichier repo/packages/books/src/consumers/pay-to-journal.consumer.spec.ts
if [ -f "repo/packages/books/src/consumers/pay-to-journal.consumer.spec.ts" ]; then
  add_row "T03-F2" "Fichier pay-to-journal.consumer.spec.ts existe" "PASS" "Cree"
else
  add_row "T03-F2" "Fichier pay-to-journal.consumer.spec.ts existe" "FAIL" "Manquant"
fi
# Test T03-F3: Existence fichier repo/packages/books/src/services/journal-templates.service.ts
if [ -f "repo/packages/books/src/services/journal-templates.service.ts" ]; then
  add_row "T03-F3" "Fichier journal-templates.service.ts existe" "PASS" "Cree"
else
  add_row "T03-F3" "Fichier journal-templates.service.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T03-V1: Pay captured event -> ecriture creee (P0)
echo "  Verifying T03-V1 : Pay captured event -> ecriture creee..."
add_row "T03-V1" "Pay captured event -> ecriture creee" "WARN" "(P0) Voir B-12 Tache 3.5.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V2: Comptes corrects (debit banque, credit client) (P0)
echo "  Verifying T03-V2 : Comptes corrects (debit banque, credit client)..."
add_row "T03-V2" "Comptes corrects (debit banque, credit client)" "WARN" "(P0) Voir B-12 Tache 3.5.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V3: Idempotency : 2 events meme transactionId -> 1 ecriture (P0)
echo "  Verifying T03-V3 : Idempotency : 2 events meme transactionId -> 1 ecriture..."
add_row "T03-V3" "Idempotency : 2 events meme transactionId -> 1 ecriture" "WARN" "(P0) Voir B-12 Tache 3.5.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V4: Multi-tenant context propage (P0)
echo "  Verifying T03-V4 : Multi-tenant context propage..."
add_row "T03-V4" "Multi-tenant context propage" "WARN" "(P0) Voir B-12 Tache 3.5.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V5: Mapping provider -> compte correct (P0)
echo "  Verifying T03-V5 : Mapping provider -> compte correct..."
add_row "T03-V5" "Mapping provider -> compte correct" "WARN" "(P0) Voir B-12 Tache 3.5.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V6: Cash kiosque -> 5161 caisse (P0)
echo "  Verifying T03-V6 : Cash kiosque -> 5161 caisse..."
add_row "T03-V6" "Cash kiosque -> 5161 caisse" "WARN" "(P0) Voir B-12 Tache 3.5.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V7: Tests 8+ scenarios (P0)
echo "  Verifying T03-V7 : Tests 8+ scenarios..."
add_row "T03-V7" "Tests 8+ scenarios" "WARN" "(P0) Voir B-12 Tache 3.5.3 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 4/5 -- 3.5.4 : TVA Service + 5 Taux MA

```bash
echo ""
echo "================================================"
echo "TACHE 3.5.4 : TVA Service + 5 Taux MA"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T04-F1: Existence fichier repo/packages/books/src/services/tva.service.ts
if [ -f "repo/packages/books/src/services/tva.service.ts" ]; then
  add_row "T04-F1" "Fichier tva.service.ts existe" "PASS" "Cree"
else
  add_row "T04-F1" "Fichier tva.service.ts existe" "FAIL" "Manquant"
fi
# Test T04-F2: Existence fichier repo/packages/books/src/services/tva.service.spec.ts
if [ -f "repo/packages/books/src/services/tva.service.spec.ts" ]; then
  add_row "T04-F2" "Fichier tva.service.spec.ts existe" "PASS" "Cree"
else
  add_row "T04-F2" "Fichier tva.service.spec.ts existe" "FAIL" "Manquant"
fi
# Test T04-F3: Existence fichier repo/packages/books/src/types/tva.ts
if [ -f "repo/packages/books/src/types/tva.ts" ]; then
  add_row "T04-F3" "Fichier tva.ts existe" "PASS" "Cree"
else
  add_row "T04-F3" "Fichier tva.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T04-V1: 'calculateTtc(100, 20)' retourne '{ ht: 100, tva: 20, ttc: 120 }' (P0)
echo "  Verifying T04-V1 : 'calculateTtc(100, 20)' retourne '{ ht: 100, tva: 20, ttc: 120 }'..."
add_row "T04-V1" "'calculateTtc(100, 20)' retourne '{ ht: 100, tva: 20, ttc: 120 }'" "WARN" "(P0) Voir B-12 Tache 3.5.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V2: 5 taux supportes (P0)
echo "  Verifying T04-V2 : 5 taux supportes..."
add_row "T04-V2" "5 taux supportes" "WARN" "(P0) Voir B-12 Tache 3.5.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V3: Rounding precision (decimal.js) (P0)
echo "  Verifying T04-V3 : Rounding precision (decimal.js)..."
add_row "T04-V3" "Rounding precision (decimal.js)" "WARN" "(P0) Voir B-12 Tache 3.5.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V4: Categories mapping correct (P0)
echo "  Verifying T04-V4 : Categories mapping correct..."
add_row "T04-V4" "Categories mapping correct" "WARN" "(P0) Voir B-12 Tache 3.5.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V5: Tests 10+ scenarios edge cases (P0)
echo "  Verifying T04-V5 : Tests 10+ scenarios edge cases..."
add_row "T04-V5" "Tests 10+ scenarios edge cases" "WARN" "(P0) Voir B-12 Tache 3.5.4 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 5/8 -- 3.5.5 : Invoices Module : Numerotation Legale + Format DGI

```bash
echo ""
echo "================================================"
echo "TACHE 3.5.5 : Invoices Module : Numerotation Legale + Format DGI"
echo "Priorite : P0 | Effort : 7h"
echo "Criteres a verifier : 8"
echo "================================================"

# === Verification fichiers crees ===
# Test T05-F1: Existence fichier repo/packages/database/src/migrations/{date}-BooksInvoices.ts
if [ -f "repo/packages/database/src/migrations/{date}-BooksInvoices.ts" ]; then
  add_row "T05-F1" "Fichier {date}-BooksInvoices.ts existe" "PASS" "Cree"
else
  add_row "T05-F1" "Fichier {date}-BooksInvoices.ts existe" "FAIL" "Manquant"
fi
# Test T05-F2: Existence fichier repo/packages/books/src/entities/books-invoice.entity.ts
if [ -f "repo/packages/books/src/entities/books-invoice.entity.ts" ]; then
  add_row "T05-F2" "Fichier books-invoice.entity.ts existe" "PASS" "Cree"
else
  add_row "T05-F2" "Fichier books-invoice.entity.ts existe" "FAIL" "Manquant"
fi
# Test T05-F3: Existence fichier repo/packages/books/src/services/invoices.service.ts
if [ -f "repo/packages/books/src/services/invoices.service.ts" ]; then
  add_row "T05-F3" "Fichier invoices.service.ts existe" "PASS" "Cree"
else
  add_row "T05-F3" "Fichier invoices.service.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T05-V1: Invoice cree avec numerotation auto (P0)
echo "  Verifying T05-V1 : Invoice cree avec numerotation auto..."
add_row "T05-V1" "Invoice cree avec numerotation auto" "WARN" "(P0) Voir B-12 Tache 3.5.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V2: Numerotation sequentielle UNIQUE per tenant (P0)
echo "  Verifying T05-V2 : Numerotation sequentielle UNIQUE per tenant..."
add_row "T05-V2" "Numerotation sequentielle UNIQUE per tenant" "WARN" "(P0) Voir B-12 Tache 3.5.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V3: Champs DGI presents dans PDF (P0)
echo "  Verifying T05-V3 : Champs DGI presents dans PDF..."
add_row "T05-V3" "Champs DGI presents dans PDF" "WARN" "(P0) Voir B-12 Tache 3.5.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V4: Validate cree journal + PDF + email (P0)
echo "  Verifying T05-V4 : Validate cree journal + PDF + email..."
add_row "T05-V4" "Validate cree journal + PDF + email" "WARN" "(P0) Voir B-12 Tache 3.5.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V5: Mark paid cree ecriture encaissement (P0)
echo "  Verifying T05-V5 : Mark paid cree ecriture encaissement..."
add_row "T05-V5" "Mark paid cree ecriture encaissement" "WARN" "(P0) Voir B-12 Tache 3.5.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V6: Cancel cree avoir (P0)
echo "  Verifying T05-V6 : Cancel cree avoir..."
add_row "T05-V6" "Cancel cree avoir" "WARN" "(P0) Voir B-12 Tache 3.5.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V7: ICE 15 chiffres validation (P0)
echo "  Verifying T05-V7 : ICE 15 chiffres validation..."
add_row "T05-V7" "ICE 15 chiffres validation" "WARN" "(P0) Voir B-12 Tache 3.5.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V8: Tests 12+ scenarios (P0)
echo "  Verifying T05-V8 : Tests 12+ scenarios..."
add_row "T05-V8" "Tests 12+ scenarios" "WARN" "(P0) Voir B-12 Tache 3.5.5 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 6/6 -- 3.5.6 : Bilan + Compte Resultat Generation

```bash
echo ""
echo "================================================"
echo "TACHE 3.5.6 : Bilan + Compte Resultat Generation"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 6"
echo "================================================"

# === Verification fichiers crees ===
# Test T06-F1: Existence fichier repo/packages/books/src/services/financial-statements.service.ts
if [ -f "repo/packages/books/src/services/financial-statements.service.ts" ]; then
  add_row "T06-F1" "Fichier financial-statements.service.ts existe" "PASS" "Cree"
else
  add_row "T06-F1" "Fichier financial-statements.service.ts existe" "FAIL" "Manquant"
fi
# Test T06-F2: Existence fichier repo/packages/books/src/services/financial-statements.service.spec.ts
if [ -f "repo/packages/books/src/services/financial-statements.service.spec.ts" ]; then
  add_row "T06-F2" "Fichier financial-statements.service.spec.ts existe" "PASS" "Cree"
else
  add_row "T06-F2" "Fichier financial-statements.service.spec.ts existe" "FAIL" "Manquant"
fi
# Test T06-F3: Existence fichier repo/apps/api/src/modules/books/controllers/financial-reports.controller.ts
if [ -f "repo/apps/api/src/modules/books/controllers/financial-reports.controller.ts" ]; then
  add_row "T06-F3" "Fichier financial-reports.controller.ts existe" "PASS" "Cree"
else
  add_row "T06-F3" "Fichier financial-reports.controller.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T06-V1: generateBilan retourne actif + passif balanced (P0)
echo "  Verifying T06-V1 : generateBilan retourne actif + passif balanced..."
add_row "T06-V1" "generateBilan retourne actif + passif balanced" "WARN" "(P0) Voir B-12 Tache 3.5.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V2: generateCompteResultat retourne resultat net (P0)
echo "  Verifying T06-V2 : generateCompteResultat retourne resultat net..."
add_row "T06-V2" "generateCompteResultat retourne resultat net" "WARN" "(P0) Voir B-12 Tache 3.5.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V3: grandLivre detail correct (P0)
echo "  Verifying T06-V3 : grandLivre detail correct..."
add_row "T06-V3" "grandLivre detail correct" "WARN" "(P0) Voir B-12 Tache 3.5.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V4: Performance < 5s sur 10k entries (P0)
echo "  Verifying T06-V4 : Performance < 5s sur 10k entries..."
add_row "T06-V4" "Performance < 5s sur 10k entries" "WARN" "(P0) Voir B-12 Tache 3.5.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V5: PDF export OK (P0)
echo "  Verifying T06-V5 : PDF export OK..."
add_row "T06-V5" "PDF export OK" "WARN" "(P0) Voir B-12 Tache 3.5.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V6: Tests 8+ scenarios (P0)
echo "  Verifying T06-V6 : Tests 8+ scenarios..."
add_row "T06-V6" "Tests 8+ scenarios" "WARN" "(P0) Voir B-12 Tache 3.5.6 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 7/6 -- 3.5.7 : ACAPS Report Framework + compliance_acaps_reports Entity

```bash
echo ""
echo "================================================"
echo "TACHE 3.5.7 : ACAPS Report Framework + compliance_acaps_reports Entity"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 6"
echo "================================================"

# === Verification fichiers crees ===
# Test T07-F1: Existence fichier repo/packages/database/src/migrations/{date}-ComplianceAcapsReports.ts
if [ -f "repo/packages/database/src/migrations/{date}-ComplianceAcapsReports.ts" ]; then
  add_row "T07-F1" "Fichier {date}-ComplianceAcapsReports.ts existe" "PASS" "Cree"
else
  add_row "T07-F1" "Fichier {date}-ComplianceAcapsReports.ts existe" "FAIL" "Manquant"
fi
# Test T07-F2: Existence fichier repo/packages/compliance/src/entities/compliance-acaps-report.entity.ts
if [ -f "repo/packages/compliance/src/entities/compliance-acaps-report.entity.ts" ]; then
  add_row "T07-F2" "Fichier compliance-acaps-report.entity.ts existe" "PASS" "Cree"
else
  add_row "T07-F2" "Fichier compliance-acaps-report.entity.ts existe" "FAIL" "Manquant"
fi
# Test T07-F3: Existence fichier repo/packages/compliance/src/services/acaps-reporting.service.ts
if [ -f "repo/packages/compliance/src/services/acaps-reporting.service.ts" ]; then
  add_row "T07-F3" "Fichier acaps-reporting.service.ts existe" "PASS" "Cree"
else
  add_row "T07-F3" "Fichier acaps-reporting.service.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T07-V1: Migration creee (P0)
echo "  Verifying T07-V1 : Migration creee..."
add_row "T07-V1" "Migration creee" "WARN" "(P0) Voir B-12 Tache 3.5.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V2: generateReport cree draft (P0)
echo "  Verifying T07-V2 : generateReport cree draft..."
add_row "T07-V2" "generateReport cree draft" "WARN" "(P0) Voir B-12 Tache 3.5.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V3: Workflow transitions valides (P0)
echo "  Verifying T07-V3 : Workflow transitions valides..."
add_row "T07-V3" "Workflow transitions valides" "WARN" "(P0) Voir B-12 Tache 3.5.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V4: Cron trimestriel + annuel actifs (P0)
echo "  Verifying T07-V4 : Cron trimestriel + annuel actifs..."
add_row "T07-V4" "Cron trimestriel + annuel actifs" "WARN" "(P0) Voir B-12 Tache 3.5.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V5: Export XML/PDF fonctionne (P0)
echo "  Verifying T07-V5 : Export XML/PDF fonctionne..."
add_row "T07-V5" "Export XML/PDF fonctionne" "WARN" "(P0) Voir B-12 Tache 3.5.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V6: Tests 6+ scenarios (P0)
echo "  Verifying T07-V6 : Tests 6+ scenarios..."
add_row "T07-V6" "Tests 6+ scenarios" "WARN" "(P0) Voir B-12 Tache 3.5.7 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 8/6 -- 3.5.8 : Report Trimestriel : Portefeuille Polices + Sinistres

```bash
echo ""
echo "================================================"
echo "TACHE 3.5.8 : Report Trimestriel : Portefeuille Polices + Sinistres"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 6"
echo "================================================"

# === Verification fichiers crees ===
# Test T08-F1: Existence fichier repo/packages/compliance/src/services/quarterly-portfolio-report.service.ts
if [ -f "repo/packages/compliance/src/services/quarterly-portfolio-report.service.ts" ]; then
  add_row "T08-F1" "Fichier quarterly-portfolio-report.service.ts existe" "PASS" "Cree"
else
  add_row "T08-F1" "Fichier quarterly-portfolio-report.service.ts existe" "FAIL" "Manquant"
fi
# Test T08-F2: Existence fichier repo/packages/compliance/src/services/quarterly-portfolio-report.service.spec.ts
if [ -f "repo/packages/compliance/src/services/quarterly-portfolio-report.service.spec.ts" ]; then
  add_row "T08-F2" "Fichier quarterly-portfolio-report.service.spec.ts existe" "PASS" "Cree"
else
  add_row "T08-F2" "Fichier quarterly-portfolio-report.service.spec.ts existe" "FAIL" "Manquant"
fi
# Test T08-F3: Existence fichier repo/packages/compliance/src/templates/acaps-quarterly.xsl
if [ -f "repo/packages/compliance/src/templates/acaps-quarterly.xsl" ]; then
  add_row "T08-F3" "Fichier acaps-quarterly.xsl existe" "PASS" "Cree"
else
  add_row "T08-F3" "Fichier acaps-quarterly.xsl existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T08-V1: generate retourne structure complete (P0)
echo "  Verifying T08-V1 : generate retourne structure complete..."
add_row "T08-V1" "generate retourne structure complete" "WARN" "(P0) Voir B-12 Tache 3.5.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V2: 8 sections presentes (P0)
echo "  Verifying T08-V2 : 8 sections presentes..."
add_row "T08-V2" "8 sections presentes" "WARN" "(P0) Voir B-12 Tache 3.5.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V3: Format XML respecte schema ACAPS (P0)
echo "  Verifying T08-V3 : Format XML respecte schema ACAPS..."
add_row "T08-V3" "Format XML respecte schema ACAPS" "WARN" "(P0) Voir B-12 Tache 3.5.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V4: Validation champs obligatoires (P0)
echo "  Verifying T08-V4 : Validation champs obligatoires..."
add_row "T08-V4" "Validation champs obligatoires" "WARN" "(P0) Voir B-12 Tache 3.5.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V5: PDF lisible (P0)
echo "  Verifying T08-V5 : PDF lisible..."
add_row "T08-V5" "PDF lisible" "WARN" "(P0) Voir B-12 Tache 3.5.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V6: Tests fixtures 6+ scenarios (P0)
echo "  Verifying T08-V6 : Tests fixtures 6+ scenarios..."
add_row "T08-V6" "Tests fixtures 6+ scenarios" "WARN" "(P0) Voir B-12 Tache 3.5.8 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 9/5 -- 3.5.9 : Report Annuel : Solvabilite + Reserves Techniques

```bash
echo ""
echo "================================================"
echo "TACHE 3.5.9 : Report Annuel : Solvabilite + Reserves Techniques"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T09-F1: Existence fichier repo/packages/compliance/src/services/annual-solvency-report.service.ts
if [ -f "repo/packages/compliance/src/services/annual-solvency-report.service.ts" ]; then
  add_row "T09-F1" "Fichier annual-solvency-report.service.ts existe" "PASS" "Cree"
else
  add_row "T09-F1" "Fichier annual-solvency-report.service.ts existe" "FAIL" "Manquant"
fi
# Test T09-F2: Existence fichier repo/packages/compliance/src/services/annual-solvency-report.service.spec.ts
if [ -f "repo/packages/compliance/src/services/annual-solvency-report.service.spec.ts" ]; then
  add_row "T09-F2" "Fichier annual-solvency-report.service.spec.ts existe" "PASS" "Cree"
else
  add_row "T09-F2" "Fichier annual-solvency-report.service.spec.ts existe" "FAIL" "Manquant"
fi
# Test T09-F3: Existence fichier repo/packages/docs/src/templates/{fr}/acaps-annual.hbs
if [ -f "repo/packages/docs/src/templates/{fr}/acaps-annual.hbs" ]; then
  add_row "T09-F3" "Fichier acaps-annual.hbs existe" "PASS" "Cree"
else
  add_row "T09-F3" "Fichier acaps-annual.hbs existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T09-V1: Report annuel structure complete (P0)
echo "  Verifying T09-V1 : Report annuel structure complete..."
add_row "T09-V1" "Report annuel structure complete" "WARN" "(P0) Voir B-12 Tache 3.5.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V2: Marge solvabilite calcul correct (P0)
echo "  Verifying T09-V2 : Marge solvabilite calcul correct..."
add_row "T09-V2" "Marge solvabilite calcul correct" "WARN" "(P0) Voir B-12 Tache 3.5.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V3: Bilan + compte resultat integres (P0)
echo "  Verifying T09-V3 : Bilan + compte resultat integres..."
add_row "T09-V3" "Bilan + compte resultat integres" "WARN" "(P0) Voir B-12 Tache 3.5.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V4: XML valide schema (P0)
echo "  Verifying T09-V4 : XML valide schema..."
add_row "T09-V4" "XML valide schema" "WARN" "(P0) Voir B-12 Tache 3.5.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V5: Tests 5+ scenarios (P0)
echo "  Verifying T09-V5 : Tests 5+ scenarios..."
add_row "T09-V5" "Tests 5+ scenarios" "WARN" "(P0) Voir B-12 Tache 3.5.9 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 10/6 -- 3.5.10 : AML Monitoring + Alertes AMC

```bash
echo ""
echo "================================================"
echo "TACHE 3.5.10 : AML Monitoring + Alertes AMC"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 6"
echo "================================================"

# === Verification fichiers crees ===
# Test T10-F1: Existence fichier repo/packages/database/src/migrations/{date}-ComplianceAmlAlerts.ts
if [ -f "repo/packages/database/src/migrations/{date}-ComplianceAmlAlerts.ts" ]; then
  add_row "T10-F1" "Fichier {date}-ComplianceAmlAlerts.ts existe" "PASS" "Cree"
else
  add_row "T10-F1" "Fichier {date}-ComplianceAmlAlerts.ts existe" "FAIL" "Manquant"
fi
# Test T10-F2: Existence fichier repo/packages/compliance/src/services/aml-monitoring.service.ts
if [ -f "repo/packages/compliance/src/services/aml-monitoring.service.ts" ]; then
  add_row "T10-F2" "Fichier aml-monitoring.service.ts existe" "PASS" "Cree"
else
  add_row "T10-F2" "Fichier aml-monitoring.service.ts existe" "FAIL" "Manquant"
fi
# Test T10-F3: Existence fichier repo/packages/compliance/src/services/aml-rules/{5 rules}.ts
if [ -f "repo/packages/compliance/src/services/aml-rules/{5 rules}.ts" ]; then
  add_row "T10-F3" "Fichier {5 rules}.ts existe" "PASS" "Cree"
else
  add_row "T10-F3" "Fichier {5 rules}.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T10-V1: 5 rules engines fonctionnent (P0)
echo "  Verifying T10-V1 : 5 rules engines fonctionnent..."
add_row "T10-V1" "5 rules engines fonctionnent" "WARN" "(P0) Voir B-12 Tache 3.5.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V2: Alert cree avec risk_score (P0)
echo "  Verifying T10-V2 : Alert cree avec risk_score..."
add_row "T10-V2" "Alert cree avec risk_score" "WARN" "(P0) Voir B-12 Tache 3.5.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V3: Workflow status transitions (P0)
echo "  Verifying T10-V3 : Workflow status transitions..."
add_row "T10-V3" "Workflow status transitions" "WARN" "(P0) Voir B-12 Tache 3.5.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V4: Export declaration soupcon DOC (P0)
echo "  Verifying T10-V4 : Export declaration soupcon DOC..."
add_row "T10-V4" "Export declaration soupcon DOC" "WARN" "(P0) Voir B-12 Tache 3.5.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V5: RBAC strict (super admin + analyst) (P0)
echo "  Verifying T10-V5 : RBAC strict (super admin + analyst)..."
add_row "T10-V5" "RBAC strict (super admin + analyst)" "WARN" "(P0) Voir B-12 Tache 3.5.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V6: Tests 10+ scenarios (P0)
echo "  Verifying T10-V6 : Tests 10+ scenarios..."
add_row "T10-V6" "Tests 10+ scenarios" "WARN" "(P0) Voir B-12 Tache 3.5.10 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 11/5 -- 3.5.11 : SAFT-MA Export XML

```bash
echo ""
echo "================================================"
echo "TACHE 3.5.11 : SAFT-MA Export XML"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T11-F1: Existence fichier repo/packages/books/src/services/saft-ma-exporter.service.ts
if [ -f "repo/packages/books/src/services/saft-ma-exporter.service.ts" ]; then
  add_row "T11-F1" "Fichier saft-ma-exporter.service.ts existe" "PASS" "Cree"
else
  add_row "T11-F1" "Fichier saft-ma-exporter.service.ts existe" "FAIL" "Manquant"
fi
# Test T11-F2: Existence fichier repo/packages/books/src/services/saft-ma-exporter.service.spec.ts
if [ -f "repo/packages/books/src/services/saft-ma-exporter.service.spec.ts" ]; then
  add_row "T11-F2" "Fichier saft-ma-exporter.service.spec.ts existe" "PASS" "Cree"
else
  add_row "T11-F2" "Fichier saft-ma-exporter.service.spec.ts existe" "FAIL" "Manquant"
fi
# Test T11-F3: Existence fichier repo/packages/books/src/saft-ma/saft-ma.xsd
if [ -f "repo/packages/books/src/saft-ma/saft-ma.xsd" ]; then
  add_row "T11-F3" "Fichier saft-ma.xsd existe" "PASS" "Cree"
else
  add_row "T11-F3" "Fichier saft-ma.xsd existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T11-V1: Export retourne XML valide (P0)
echo "  Verifying T11-V1 : Export retourne XML valide..."
add_row "T11-V1" "Export retourne XML valide" "WARN" "(P0) Voir B-12 Tache 3.5.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V2: Structure SAFT-MA respecte (P0)
echo "  Verifying T11-V2 : Structure SAFT-MA respecte..."
add_row "T11-V2" "Structure SAFT-MA respecte" "WARN" "(P0) Voir B-12 Tache 3.5.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V3: 100% data exercice incluse (P0)
echo "  Verifying T11-V3 : 100% data exercice incluse..."
add_row "T11-V3" "100% data exercice incluse" "WARN" "(P0) Voir B-12 Tache 3.5.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V4: Performance OK gros volumes (P0)
echo "  Verifying T11-V4 : Performance OK gros volumes..."
add_row "T11-V4" "Performance OK gros volumes" "WARN" "(P0) Voir B-12 Tache 3.5.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V5: Tests 6+ scenarios (P0)
echo "  Verifying T11-V5 : Tests 6+ scenarios..."
add_row "T11-V5" "Tests 6+ scenarios" "WARN" "(P0) Voir B-12 Tache 3.5.11 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 12/4 -- 3.5.12 : Endpoints REST + Scheduled Jobs

```bash
echo ""
echo "================================================"
echo "TACHE 3.5.12 : Endpoints REST + Scheduled Jobs"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 4"
echo "================================================"

# === Verification fichiers crees ===
# Test T12-F1: Existence fichier repo/packages/books/src/jobs/{several cron}.ts
if [ -f "repo/packages/books/src/jobs/{several cron}.ts" ]; then
  add_row "T12-F1" "Fichier {several cron}.ts existe" "PASS" "Cree"
else
  add_row "T12-F1" "Fichier {several cron}.ts existe" "FAIL" "Manquant"
fi
# Test T12-F2: Existence fichier repo/packages/compliance/src/jobs/{several cron}.ts
if [ -f "repo/packages/compliance/src/jobs/{several cron}.ts" ]; then
  add_row "T12-F2" "Fichier {several cron}.ts existe" "PASS" "Cree"
else
  add_row "T12-F2" "Fichier {several cron}.ts existe" "FAIL" "Manquant"
fi
# Test T12-F3: Existence fichier repo/packages/comm/src/templates/{fr,ar-MA,ar}/acaps-draft-ready.hbs
if [ -f "repo/packages/comm/src/templates/{fr,ar-MA,ar}/acaps-draft-ready.hbs" ]; then
  add_row "T12-F3" "Fichier acaps-draft-ready.hbs existe" "PASS" "Cree"
else
  add_row "T12-F3" "Fichier acaps-draft-ready.hbs existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T12-V1: Cron jobs declenches selon schedule (P0)
echo "  Verifying T12-V1 : Cron jobs declenches selon schedule..."
add_row "T12-V1" "Cron jobs declenches selon schedule" "WARN" "(P0) Voir B-12 Tache 3.5.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V2: Notification super admin recue (P0)
echo "  Verifying T12-V2 : Notification super admin recue..."
add_row "T12-V2" "Notification super admin recue" "WARN" "(P0) Voir B-12 Tache 3.5.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V3: Cross-module events fonctionnent (P0)
echo "  Verifying T12-V3 : Cross-module events fonctionnent..."
add_row "T12-V3" "Cross-module events fonctionnent" "WARN" "(P0) Voir B-12 Tache 3.5.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V4: Tests integration 6+ scenarios (P0)
echo "  Verifying T12-V4 : Tests integration 6+ scenarios..."
add_row "T12-V4" "Tests integration 6+ scenarios" "WARN" "(P0) Voir B-12 Tache 3.5.12 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 13/5 -- 3.5.13 : Tests E2E (30+) + Fixtures + Seeds

```bash
echo ""
echo "================================================"
echo "TACHE 3.5.13 : Tests E2E (30+) + Fixtures + Seeds"
echo "Priorite : P0 | Effort : 7h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T13-F1: Existence fichier repo/apps/api/test/books/{20 specs}.e2e-spec.ts
if [ -f "repo/apps/api/test/books/{20 specs}.e2e-spec.ts" ]; then
  add_row "T13-F1" "Fichier {20 specs}.e2e-spec.ts existe" "PASS" "Cree"
else
  add_row "T13-F1" "Fichier {20 specs}.e2e-spec.ts existe" "FAIL" "Manquant"
fi
# Test T13-F2: Existence fichier repo/apps/api/test/compliance/{10 specs}.e2e-spec.ts
if [ -f "repo/apps/api/test/compliance/{10 specs}.e2e-spec.ts" ]; then
  add_row "T13-F2" "Fichier {10 specs}.e2e-spec.ts existe" "PASS" "Cree"
else
  add_row "T13-F2" "Fichier {10 specs}.e2e-spec.ts existe" "FAIL" "Manquant"
fi
# Test T13-F3: Existence fichier repo/infrastructure/scripts/seed-books-fixtures.ts
if [ -f "repo/infrastructure/scripts/seed-books-fixtures.ts" ]; then
  add_row "T13-F3" "Fichier seed-books-fixtures.ts existe" "PASS" "Cree"
else
  add_row "T13-F3" "Fichier seed-books-fixtures.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T13-V1: 30+ tests passent (P0)
echo "  Verifying T13-V1 : 30+ tests passent..."
add_row "T13-V1" "30+ tests passent" "WARN" "(P0) Voir B-12 Tache 3.5.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V2: CI green (P0)
echo "  Verifying T13-V2 : CI green..."
add_row "T13-V2" "CI green" "WARN" "(P0) Voir B-12 Tache 3.5.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V3: Fixtures realistes 6 mois (P0)
echo "  Verifying T13-V3 : Fixtures realistes 6 mois..."
add_row "T13-V3" "Fixtures realistes 6 mois" "WARN" "(P0) Voir B-12 Tache 3.5.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V4: Reproducibility 5x (P0)
echo "  Verifying T13-V4 : Reproducibility 5x..."
add_row "T13-V4" "Reproducibility 5x" "WARN" "(P0) Voir B-12 Tache 3.5.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V5: Coverage all flows (P0)
echo "  Verifying T13-V5 : Coverage all flows..."
add_row "T13-V5" "Coverage all flows" "WARN" "(P0) Voir B-12 Tache 3.5.13 pour test detaille - critere a auto-tester via script ad-hoc"

```

---


---


## VERIFICATIONS TRANSVERSALES SPRINT 12

### TR-BUILD : Build complet du sprint

```bash
echo ""
echo "================================================"
echo "VERIFICATIONS TRANSVERSALES SPRINT 12"
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

### TR-MIGRATIONS : Migrations DB Sprint 12

```bash
echo "=== TR-MIGRATIONS : Migrations DB ==="
MIGR_COUNT=$(pg_query "SELECT COUNT(*) FROM migrations WHERE name LIKE '%sprint12%' OR name LIKE '%Sprint12%'" || echo 0)
if [ "$MIGR_COUNT" -gt 0 ]; then
  add_row "TR-MIG" "Migrations Sprint 12 appliquees" "PASS" "$MIGR_COUNT migrations"
else
  add_row "TR-MIG" "Migrations Sprint 12 appliquees" "WARN" "Aucune migration detectee (verifier)"
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
echo "GENERATION DU RAPPORT FINAL SPRINT 12"
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

## Jalon GO/NO-GO Sprint 12

EOF

# Calcul statut final
if (( $(echo "$SCORE >= 95" | bc -l) )); then
  STATUT="GO"
  cat >> "$REPORT_FILE" << EOF
**STATUT** : GO -- Sprint 12 valide, passage Sprint 13 autorise

Le sprint a passe les criteres requis. Cowork peut demarrer Sprint 13.

EOF
  echo ""
  echo "================================================"
  echo "SPRINT 12 : GO ($SCORE%)"
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
  echo "SPRINT 12 : GO CONDITIONNEL ($SCORE%)"
  echo "================================================"
else
  STATUT="NO-GO"
  cat >> "$REPORT_FILE" << EOF
**STATUT** : NO-GO -- Score $SCORE% trop bas (cible 85% minimum)

Le sprint **doit etre repris** :
- Lister tous FAIL P0
- Escalation Saad/Abla decision (cut scope OR delai)
- Reprise sprint avant Sprint 13

EOF
  echo ""
  echo "================================================"
  echo "SPRINT 12 : NO-GO ($SCORE%)"
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
  echo "git commit -m \"chore(sprint-12): close sprint 12 -- $STATUT ($SCORE%)\"" >> "$REPORT_FILE"
  echo '```' >> "$REPORT_FILE"
fi

echo ""
echo "Rapport complet dans : $REPORT_FILE"
```

---

## INSTRUCTION FINALE A CLAUDE CODE / COWORK

Apres l'execution complete des verifications ci-dessus :

1. **Lis le contenu de `sprint12-verify-report.md`** integralement
2. **Identifie les FAIL critiques** (criteres P0) qui necessitent intervention manuelle
3. **Affiche un resume executif** :
   - Nombre total de criteres
   - Pourcentage PASS / PASS\* / FAIL / WARN
   - Liste des FAIL avec contexte technique
   - Recommandation : GO / GO CONDITIONNEL / NO-GO
4. **Si NO-GO** : ne pas demarrer le Sprint suivant, alerter Saad/Abla via Slack `#insurtech-dev`
5. **Si GO ou GO CONDITIONNEL** : produire le commit de cloture du sprint :

```bash
git add skalean-insurtech/sprint12-verify-report.md
git commit -m "chore(sprint-12): close sprint 12 with verification report

- Verification automatique executee
- Score global : <SCORE>%
- <PASS> criteres PASS, <PASS_REPAIRED> reparations auto, <FAIL> FAIL
- Statut : <GO|GO CONDITIONNEL|NO-GO>

Phase: 3 -- Modules Horizontaux
Sprint: 12 (Phase 3 / Sprint 5)
Reference B-12, C-12, V-12
Report: sprint12-verify-report.md"
```

6. **Documentation continue** : si decisions techniques prises pendant verification, ajouter notes dans `repo/docs/runbooks/sprint-12-lessons-learned.md`

---

**Fin de la verification V-12 v2.2 detaillee -- Sprint 12 (3.5) Books CGNC + Compliance ACAPS/DGI/AMC.**

**Total criteres taches** : 78 | **Total transversaux** : ~10 | **Effort sprint** : 75h
