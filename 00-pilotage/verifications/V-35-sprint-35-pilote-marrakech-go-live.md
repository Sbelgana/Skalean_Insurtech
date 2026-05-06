# VERIFICATION SPRINT 35 -- Phase 7 / Sprint 7 : Pilote Marrakech + Go-Live (4 sem + suivi)
# Version : Auto-reparation active + Rapport final MD detaille
# 14 taches, 51 criteres extraits B-35
# AUCUNE EMOJI AUTORISEE

**Version** : v2.2 (verification detaillee)
**Phase** : 7 -- Hardening + Integrations + Pilote
**Sprint** : 35 / 35 (cumul) -- Sprint 7 dans Phase 7
**Reference meta-prompt** : `B-35-sprint-35-pilote-marrakech-go-live.md`
**Reference orchestrateur** : `C-35-sprint-35-pilote-marrakech-go-live.md`
**Total criteres** : 51 criteres taches + ~10 transversaux

---

Tu es **Claude Code (ou Cowork)**. Tu dois executer une **verification COMPLETE et EXHAUSTIVE** du Sprint 35 apres execution toutes les 14 taches.

---

## REGLES D'EXECUTION

1. Tu **executes CHAQUE verification dans l'ordre** (taches puis transversales)
2. Quand une verification echoue, tu **TENTES UNE REPARATION AUTOMATIQUE** avant de noter FAIL
3. Apres chaque tentative de reparation, tu **re-executes la verification**
4. Tu consignes dans `sprint35-verify-report.md` **TOUS les resultats** au fil de l'execution
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
REPORT_FILE="sprint35-verify-report.md"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
RUN_ID=$(date '+%Y%m%d-%H%M%S')

cat > "$REPORT_FILE" << EOF
# Rapport de Verification - Sprint 35 : Pilote Marrakech + Go-Live (4 sem + suivi)

**Date** : $TIMESTAMP
**Run ID** : $RUN_ID
**Phase** : 7 -- Hardening + Integrations + Pilote
**Sprint** : 35 (Phase 7 / Sprint 7)
**Reference B-35** : 14 taches, 51 criteres extraits
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

## TACHE 1/4 -- 7.7.1 : Pre-Pilote Checklist + Freeze Code

```bash
echo ""
echo "================================================"
echo "TACHE 7.7.1 : Pre-Pilote Checklist + Freeze Code"
echo "Priorite : P0 | Effort : 8h"
echo "Criteres a verifier : 4"
echo "================================================"

# === Verification fichiers crees ===
# Test T01-F1: Existence fichier repo/docs/pilote/pre-pilote-checklist.md
if [ -f "repo/docs/pilote/pre-pilote-checklist.md" ]; then
  add_row "T01-F1" "Fichier pre-pilote-checklist.md existe" "PASS" "Cree"
else
  add_row "T01-F1" "Fichier pre-pilote-checklist.md existe" "FAIL" "Manquant"
fi
# Test T01-F2: Existence fichier repo/docs/pilote/go-no-go-decision-template.md
if [ -f "repo/docs/pilote/go-no-go-decision-template.md" ]; then
  add_row "T01-F2" "Fichier go-no-go-decision-template.md existe" "PASS" "Cree"
else
  add_row "T01-F2" "Fichier go-no-go-decision-template.md existe" "FAIL" "Manquant"
fi
# Test T01-F3: Existence fichier repo/infrastructure/scripts/pre-pilote-smoke-test.sh
if [ -f "repo/infrastructure/scripts/pre-pilote-smoke-test.sh" ]; then
  add_row "T01-F3" "Fichier pre-pilote-smoke-test.sh existe" "PASS" "Cree"
else
  add_row "T01-F3" "Fichier pre-pilote-smoke-test.sh existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T01-V1: Checklist 100% green (P0)
echo "  Verifying T01-V1 : Checklist 100% green..."
add_row "T01-V1" "Checklist 100% green" "WARN" "(P0) Voir B-35 Tache 7.7.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V2: Smoke tests green (P0)
echo "  Verifying T01-V2 : Smoke tests green..."
add_row "T01-V2" "Smoke tests green" "WARN" "(P0) Voir B-35 Tache 7.7.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V3: Go/no-go signed off (P0)
echo "  Verifying T01-V3 : Go/no-go signed off..."
add_row "T01-V3" "Go/no-go signed off" "WARN" "(P0) Voir B-35 Tache 7.7.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V4: Backup snapshot (P0)
echo "  Verifying T01-V4 : Backup snapshot..."
add_row "T01-V4" "Backup snapshot" "WARN" "(P0) Voir B-35 Tache 7.7.1 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 2/4 -- 7.7.2 : Onboarding Skalean Atlas + Wafa Assurance

```bash
echo ""
echo "================================================"
echo "TACHE 7.7.2 : Onboarding Skalean Atlas + Wafa Assurance"
echo "Priorite : P0 | Effort : 10h"
echo "Criteres a verifier : 4"
echo "================================================"

# === Verification fichiers crees ===
# Test T02-F1: Existence fichier repo/docs/pilote/atlas-onboarding-complete.md
if [ -f "repo/docs/pilote/atlas-onboarding-complete.md" ]; then
  add_row "T02-F1" "Fichier atlas-onboarding-complete.md existe" "PASS" "Cree"
else
  add_row "T02-F1" "Fichier atlas-onboarding-complete.md existe" "FAIL" "Manquant"
fi
# Test T02-F2: Existence fichier repo/docs/pilote/wafa-connecteur-activation.md
if [ -f "repo/docs/pilote/wafa-connecteur-activation.md" ]; then
  add_row "T02-F2" "Fichier wafa-connecteur-activation.md existe" "PASS" "Cree"
else
  add_row "T02-F2" "Fichier wafa-connecteur-activation.md existe" "FAIL" "Manquant"
fi
# Test T02-F3: Existence fichier repo/infrastructure/scripts/promote-staging-to-production.ts
if [ -f "repo/infrastructure/scripts/promote-staging-to-production.ts" ]; then
  add_row "T02-F3" "Fichier promote-staging-to-production.ts existe" "PASS" "Cree"
else
  add_row "T02-F3" "Fichier promote-staging-to-production.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T02-V1: Atlas operationnel production (P0)
echo "  Verifying T02-V1 : Atlas operationnel production..."
add_row "T02-V1" "Atlas operationnel production" "WARN" "(P0) Voir B-35 Tache 7.7.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V2: Wafa connecteur active + tests OK (P0)
echo "  Verifying T02-V2 : Wafa connecteur active + tests OK..."
add_row "T02-V2" "Wafa connecteur active + tests OK" "WARN" "(P0) Voir B-35 Tache 7.7.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V3: 8 employees Atlas onboarded (P0)
echo "  Verifying T02-V3 : 8 employees Atlas onboarded..."
add_row "T02-V3" "8 employees Atlas onboarded" "WARN" "(P0) Voir B-35 Tache 7.7.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V4: Runbooks complets (P0)
echo "  Verifying T02-V4 : Runbooks complets..."
add_row "T02-V4" "Runbooks complets" "WARN" "(P0) Voir B-35 Tache 7.7.2 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 3/4 -- 7.7.3 : Onboarding 2-3 Brokers Tenants Partenaires

```bash
echo ""
echo "================================================"
echo "TACHE 7.7.3 : Onboarding 2-3 Brokers Tenants Partenaires"
echo "Priorite : P0 | Effort : 12h"
echo "Criteres a verifier : 4"
echo "================================================"

# === Verification fichiers crees ===
# Test T03-F1: Existence fichier repo/docs/pilote/brokers-onboarding-{tenant1,tenant2,tenant3}.md
if [ -f "repo/docs/pilote/brokers-onboarding-{tenant1,tenant2,tenant3}.md" ]; then
  add_row "T03-F1" "Fichier brokers-onboarding-{tenant1,tenant2,tenant3}.md existe" "PASS" "Cree"
else
  add_row "T03-F1" "Fichier brokers-onboarding-{tenant1,tenant2,tenant3}.md existe" "FAIL" "Manquant"
fi
# Test T03-F2: Existence fichier repo/docs/training/broker-formation-materials/{several}.md
if [ -f "repo/docs/training/broker-formation-materials/{several}.md" ]; then
  add_row "T03-F2" "Fichier {several}.md existe" "PASS" "Cree"
else
  add_row "T03-F2" "Fichier {several}.md existe" "FAIL" "Manquant"
fi
# Test T03-F3: Existence fichier repo/infrastructure/scripts/data-migration-legacy-{tenant}.ts
if [ -f "repo/infrastructure/scripts/data-migration-legacy-{tenant}.ts" ]; then
  add_row "T03-F3" "Fichier data-migration-legacy-{tenant}.ts existe" "PASS" "Cree"
else
  add_row "T03-F3" "Fichier data-migration-legacy-{tenant}.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T03-V1: 2-3 brokers tenants activated (P0)
echo "  Verifying T03-V1 : 2-3 brokers tenants activated..."
add_row "T03-V1" "2-3 brokers tenants activated" "WARN" "(P0) Voir B-35 Tache 7.7.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V2: Users formed + certified (P0)
echo "  Verifying T03-V2 : Users formed + certified..."
add_row "T03-V2" "Users formed + certified" "WARN" "(P0) Voir B-35 Tache 7.7.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V3: Data migration complete (si applicable) (P0)
echo "  Verifying T03-V3 : Data migration complete (si applicable)..."
add_row "T03-V3" "Data migration complete (si applicable)" "WARN" "(P0) Voir B-35 Tache 7.7.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V4: Support hotline active (P0)
echo "  Verifying T03-V4 : Support hotline active..."
add_row "T03-V4" "Support hotline active" "WARN" "(P0) Voir B-35 Tache 7.7.3 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 4/4 -- 7.7.4 : Onboarding 1-2 Garages Partenaires

```bash
echo ""
echo "================================================"
echo "TACHE 7.7.4 : Onboarding 1-2 Garages Partenaires"
echo "Priorite : P0 | Effort : 10h"
echo "Criteres a verifier : 4"
echo "================================================"

# === Verification fichiers crees ===
# Test T04-F1: Existence fichier repo/docs/pilote/garages-onboarding-{garage1,garage2}.md
if [ -f "repo/docs/pilote/garages-onboarding-{garage1,garage2}.md" ]; then
  add_row "T04-F1" "Fichier garages-onboarding-{garage1,garage2}.md existe" "PASS" "Cree"
else
  add_row "T04-F1" "Fichier garages-onboarding-{garage1,garage2}.md existe" "FAIL" "Manquant"
fi
# Test T04-F2: Existence fichier repo/docs/training/garage-formation-materials/{several}.md
if [ -f "repo/docs/training/garage-formation-materials/{several}.md" ]; then
  add_row "T04-F2" "Fichier {several}.md existe" "PASS" "Cree"
else
  add_row "T04-F2" "Fichier {several}.md existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T04-V1: 1-2 garages activated (P0)
echo "  Verifying T04-V1 : 1-2 garages activated..."
add_row "T04-V1" "1-2 garages activated" "WARN" "(P0) Voir B-35 Tache 7.7.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V2: Tests integration M8 OK (P0)
echo "  Verifying T04-V2 : Tests integration M8 OK..."
add_row "T04-V2" "Tests integration M8 OK" "WARN" "(P0) Voir B-35 Tache 7.7.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V3: Users formes (P0)
echo "  Verifying T04-V3 : Users formes..."
add_row "T04-V3" "Users formes" "WARN" "(P0) Voir B-35 Tache 7.7.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V4: Support hotline (P0)
echo "  Verifying T04-V4 : Support hotline..."
add_row "T04-V4" "Support hotline" "WARN" "(P0) Voir B-35 Tache 7.7.4 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 5/3 -- 7.7.5 : Customer Acquisition (50+ Assures)

```bash
echo ""
echo "================================================"
echo "TACHE 7.7.5 : Customer Acquisition (50+ Assures)"
echo "Priorite : P0 | Effort : 14h"
echo "Criteres a verifier : 3"
echo "================================================"

# === Verification fichiers crees ===
# Test T05-F1: Existence fichier repo/docs/pilote/customer-acquisition-strategy.md
if [ -f "repo/docs/pilote/customer-acquisition-strategy.md" ]; then
  add_row "T05-F1" "Fichier customer-acquisition-strategy.md existe" "PASS" "Cree"
else
  add_row "T05-F1" "Fichier customer-acquisition-strategy.md existe" "FAIL" "Manquant"
fi
# Test T05-F2: Existence fichier repo/docs/marketing/{several materials}.pdf
if [ -f "repo/docs/marketing/{several materials}.pdf" ]; then
  add_row "T05-F2" "Fichier {several materials}.pdf existe" "PASS" "Cree"
else
  add_row "T05-F2" "Fichier {several materials}.pdf existe" "FAIL" "Manquant"
fi
# Test T05-F3: Existence fichier repo/apps/web-customer-portal/app/[locale]/landing-pilote/page.tsx
if [ -f "repo/apps/web-customer-portal/app/[locale]/landing-pilote/page.tsx" ]; then
  add_row "T05-F3" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T05-F3" "Fichier page.tsx existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T05-V1: 50+ customers acquired (P0)
echo "  Verifying T05-V1 : 50+ customers acquired..."
add_row "T05-V1" "50+ customers acquired" "WARN" "(P0) Voir B-35 Tache 7.7.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V2: CAC < 500 MAD (P0)
echo "  Verifying T05-V2 : CAC < 500 MAD..."
add_row "T05-V2" "CAC < 500 MAD" "WARN" "(P0) Voir B-35 Tache 7.7.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V3: Conversion rate target met (P0)
echo "  Verifying T05-V3 : Conversion rate target met..."
add_row "T05-V3" "Conversion rate target met" "WARN" "(P0) Voir B-35 Tache 7.7.5 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 6/4 -- 7.7.6 : Office Marrakech Setup + Support 24/7

```bash
echo ""
echo "================================================"
echo "TACHE 7.7.6 : Office Marrakech Setup + Support 24/7"
echo "Priorite : P0 | Effort : 10h"
echo "Criteres a verifier : 4"
echo "================================================"

# === Verification fichiers crees ===
# Test T06-F1: Existence fichier repo/docs/pilote/office-marrakech-setup.md
if [ -f "repo/docs/pilote/office-marrakech-setup.md" ]; then
  add_row "T06-F1" "Fichier office-marrakech-setup.md existe" "PASS" "Cree"
else
  add_row "T06-F1" "Fichier office-marrakech-setup.md existe" "FAIL" "Manquant"
fi
# Test T06-F2: Existence fichier repo/docs/pilote/support-24-7-runbook.md
if [ -f "repo/docs/pilote/support-24-7-runbook.md" ]; then
  add_row "T06-F2" "Fichier support-24-7-runbook.md existe" "PASS" "Cree"
else
  add_row "T06-F2" "Fichier support-24-7-runbook.md existe" "FAIL" "Manquant"
fi
# Test T06-F3: Existence fichier repo/docs/pilote/sla-support-customers.md
if [ -f "repo/docs/pilote/sla-support-customers.md" ]; then
  add_row "T06-F3" "Fichier sla-support-customers.md existe" "PASS" "Cree"
else
  add_row "T06-F3" "Fichier sla-support-customers.md existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T06-V1: Office operationnel (P0)
echo "  Verifying T06-V1 : Office operationnel..."
add_row "T06-V1" "Office operationnel" "WARN" "(P0) Voir B-35 Tache 7.7.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V2: Equipe locale onboarded (P0)
echo "  Verifying T06-V2 : Equipe locale onboarded..."
add_row "T06-V2" "Equipe locale onboarded" "WARN" "(P0) Voir B-35 Tache 7.7.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V3: Hotline 24/7 active (P0)
echo "  Verifying T06-V3 : Hotline 24/7 active..."
add_row "T06-V3" "Hotline 24/7 active" "WARN" "(P0) Voir B-35 Tache 7.7.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V4: SLA documente + tests (P0)
echo "  Verifying T06-V4 : SLA documente + tests..."
add_row "T06-V4" "SLA documente + tests" "WARN" "(P0) Voir B-35 Tache 7.7.6 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 7/4 -- 7.7.7 : Communications Launch

```bash
echo ""
echo "================================================"
echo "TACHE 7.7.7 : Communications Launch"
echo "Priorite : P0 | Effort : 8h"
echo "Criteres a verifier : 4"
echo "================================================"

# === Verification fichiers crees ===
# Test T07-F1: Existence fichier repo/docs/pilote/launch-communications-plan.md
if [ -f "repo/docs/pilote/launch-communications-plan.md" ]; then
  add_row "T07-F1" "Fichier launch-communications-plan.md existe" "PASS" "Cree"
else
  add_row "T07-F1" "Fichier launch-communications-plan.md existe" "FAIL" "Manquant"
fi
# Test T07-F2: Existence fichier repo/docs/pilote/communique-presse.md
if [ -f "repo/docs/pilote/communique-presse.md" ]; then
  add_row "T07-F2" "Fichier communique-presse.md existe" "PASS" "Cree"
else
  add_row "T07-F2" "Fichier communique-presse.md existe" "FAIL" "Manquant"
fi
# Test T07-F3: Existence fichier repo/docs/pilote/acaps-notification-official.md
if [ -f "repo/docs/pilote/acaps-notification-official.md" ]; then
  add_row "T07-F3" "Fichier acaps-notification-official.md existe" "PASS" "Cree"
else
  add_row "T07-F3" "Fichier acaps-notification-official.md existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T07-V1: Communique presse distribue (P0)
echo "  Verifying T07-V1 : Communique presse distribue..."
add_row "T07-V1" "Communique presse distribue" "WARN" "(P0) Voir B-35 Tache 7.7.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V2: ACAPS notification + meeting (P0)
echo "  Verifying T07-V2 : ACAPS notification + meeting..."
add_row "T07-V2" "ACAPS notification + meeting" "WARN" "(P0) Voir B-35 Tache 7.7.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V3: Stakeholders informes (P0)
echo "  Verifying T07-V3 : Stakeholders informes..."
add_row "T07-V3" "Stakeholders informes" "WARN" "(P0) Voir B-35 Tache 7.7.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V4: Web presence updated (P0)
echo "  Verifying T07-V4 : Web presence updated..."
add_row "T07-V4" "Web presence updated" "WARN" "(P0) Voir B-35 Tache 7.7.7 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 8/4 -- 7.7.8 : Launch Day Operations

```bash
echo ""
echo "================================================"
echo "TACHE 7.7.8 : Launch Day Operations"
echo "Priorite : P0 | Effort : 16h"
echo "Criteres a verifier : 4"
echo "================================================"

# === Verification fichiers crees ===
# Test T08-F1: Existence fichier repo/docs/pilote/launch-day-runbook.md
if [ -f "repo/docs/pilote/launch-day-runbook.md" ]; then
  add_row "T08-F1" "Fichier launch-day-runbook.md existe" "PASS" "Cree"
else
  add_row "T08-F1" "Fichier launch-day-runbook.md existe" "FAIL" "Manquant"
fi
# Test T08-F2: Existence fichier repo/docs/pilote/war-room-protocols.md
if [ -f "repo/docs/pilote/war-room-protocols.md" ]; then
  add_row "T08-F2" "Fichier war-room-protocols.md existe" "PASS" "Cree"
else
  add_row "T08-F2" "Fichier war-room-protocols.md existe" "FAIL" "Manquant"
fi
# Test T08-F3: Existence fichier repo/infrastructure/scripts/hotfix-deploy.sh
if [ -f "repo/infrastructure/scripts/hotfix-deploy.sh" ]; then
  add_row "T08-F3" "Fichier hotfix-deploy.sh existe" "PASS" "Cree"
else
  add_row "T08-F3" "Fichier hotfix-deploy.sh existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T08-V1: War room 72h sustained (P0)
echo "  Verifying T08-V1 : War room 72h sustained..."
add_row "T08-V1" "War room 72h sustained" "WARN" "(P0) Voir B-35 Tache 7.7.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V2: Monitoring continuous (P0)
echo "  Verifying T08-V2 : Monitoring continuous..."
add_row "T08-V2" "Monitoring continuous" "WARN" "(P0) Voir B-35 Tache 7.7.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V3: Issues triage SLA met (P0)
echo "  Verifying T08-V3 : Issues triage SLA met..."
add_row "T08-V3" "Issues triage SLA met" "WARN" "(P0) Voir B-35 Tache 7.7.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V4: 0 incident critique non-resolu (P0)
echo "  Verifying T08-V4 : 0 incident critique non-resolu..."
add_row "T08-V4" "0 incident critique non-resolu" "WARN" "(P0) Voir B-35 Tache 7.7.8 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 9/4 -- 7.7.9 : Pilote 4 Semaines Operations

```bash
echo ""
echo "================================================"
echo "TACHE 7.7.9 : Pilote 4 Semaines Operations"
echo "Priorite : P0 | Effort : 24h"
echo "Criteres a verifier : 4"
echo "================================================"

# === Verification fichiers crees ===
# Test T09-F1: Existence fichier repo/docs/pilote/daily-standups-log.md
if [ -f "repo/docs/pilote/daily-standups-log.md" ]; then
  add_row "T09-F1" "Fichier daily-standups-log.md existe" "PASS" "Cree"
else
  add_row "T09-F1" "Fichier daily-standups-log.md existe" "FAIL" "Manquant"
fi
# Test T09-F2: Existence fichier repo/docs/pilote/weekly-reviews-{w1,w2,w3,w4}.md
if [ -f "repo/docs/pilote/weekly-reviews-{w1,w2,w3,w4}.md" ]; then
  add_row "T09-F2" "Fichier weekly-reviews-{w1,w2,w3,w4}.md existe" "PASS" "Cree"
else
  add_row "T09-F2" "Fichier weekly-reviews-{w1,w2,w3,w4}.md existe" "FAIL" "Manquant"
fi
# Test T09-F3: Existence fichier repo/docs/pilote/iterations-log.md
if [ -f "repo/docs/pilote/iterations-log.md" ]; then
  add_row "T09-F3" "Fichier iterations-log.md existe" "PASS" "Cree"
else
  add_row "T09-F3" "Fichier iterations-log.md existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T09-V1: Daily standups sustained 4 semaines (P0)
echo "  Verifying T09-V1 : Daily standups sustained 4 semaines..."
add_row "T09-V1" "Daily standups sustained 4 semaines" "WARN" "(P0) Voir B-35 Tache 7.7.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V2: Weekly reviews documente (P0)
echo "  Verifying T09-V2 : Weekly reviews documente..."
add_row "T09-V2" "Weekly reviews documente" "WARN" "(P0) Voir B-35 Tache 7.7.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V3: Issues triage SLA met (P0)
echo "  Verifying T09-V3 : Issues triage SLA met..."
add_row "T09-V3" "Issues triage SLA met" "WARN" "(P0) Voir B-35 Tache 7.7.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V4: Iterations applique (P0)
echo "  Verifying T09-V4 : Iterations applique..."
add_row "T09-V4" "Iterations applique" "WARN" "(P0) Voir B-35 Tache 7.7.9 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 10/4 -- 7.7.10 : Customer Feedback Loop

```bash
echo ""
echo "================================================"
echo "TACHE 7.7.10 : Customer Feedback Loop"
echo "Priorite : P0 | Effort : 10h"
echo "Criteres a verifier : 4"
echo "================================================"

# === Verification fichiers crees ===
# Test T10-F1: Existence fichier repo/apps/web-insurtech-admin/app/[locale]/(protected)/feedback/page.tsx
if [ -f "repo/apps/web-insurtech-admin/app/[locale]/(protected)/feedback/page.tsx" ]; then
  add_row "T10-F1" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T10-F1" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T10-F2: Existence fichier repo/packages/feedback/src/services/nps-tracker.service.ts
if [ -f "repo/packages/feedback/src/services/nps-tracker.service.ts" ]; then
  add_row "T10-F2" "Fichier nps-tracker.service.ts existe" "PASS" "Cree"
else
  add_row "T10-F2" "Fichier nps-tracker.service.ts existe" "FAIL" "Manquant"
fi
# Test T10-F3: Existence fichier repo/docs/pilote/customer-feedback-analysis.md
if [ -f "repo/docs/pilote/customer-feedback-analysis.md" ]; then
  add_row "T10-F3" "Fichier customer-feedback-analysis.md existe" "PASS" "Cree"
else
  add_row "T10-F3" "Fichier customer-feedback-analysis.md existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T10-V1: NPS surveys + interviews (P0)
echo "  Verifying T10-V1 : NPS surveys + interviews..."
add_row "T10-V1" "NPS surveys + interviews" "WARN" "(P0) Voir B-35 Tache 7.7.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V2: Dashboard feedback (P0)
echo "  Verifying T10-V2 : Dashboard feedback..."
add_row "T10-V2" "Dashboard feedback" "WARN" "(P0) Voir B-35 Tache 7.7.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V3: Iterations applique (P0)
echo "  Verifying T10-V3 : Iterations applique..."
add_row "T10-V3" "Iterations applique" "WARN" "(P0) Voir B-35 Tache 7.7.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V4: NPS > 8 cible (P0)
echo "  Verifying T10-V4 : NPS > 8 cible..."
add_row "T10-V4" "NPS > 8 cible" "WARN" "(P0) Voir B-35 Tache 7.7.10 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 11/3 -- 7.7.11 : KPIs Tracking + ACAPS Reporting

```bash
echo ""
echo "================================================"
echo "TACHE 7.7.11 : KPIs Tracking + ACAPS Reporting"
echo "Priorite : P0 | Effort : 8h"
echo "Criteres a verifier : 3"
echo "================================================"

# === Verification fichiers crees ===
# Test T11-F1: Existence fichier repo/apps/web-insurtech-admin/app/[locale]/(protected)/c-level-daily/page.tsx
if [ -f "repo/apps/web-insurtech-admin/app/[locale]/(protected)/c-level-daily/page.tsx" ]; then
  add_row "T11-F1" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T11-F1" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T11-F2: Existence fichier repo/docs/pilote/kpis-tracking-framework.md
if [ -f "repo/docs/pilote/kpis-tracking-framework.md" ]; then
  add_row "T11-F2" "Fichier kpis-tracking-framework.md existe" "PASS" "Cree"
else
  add_row "T11-F2" "Fichier kpis-tracking-framework.md existe" "FAIL" "Manquant"
fi
# Test T11-F3: Existence fichier repo/docs/pilote/acaps-first-report-pilote-q1.md
if [ -f "repo/docs/pilote/acaps-first-report-pilote-q1.md" ]; then
  add_row "T11-F3" "Fichier acaps-first-report-pilote-q1.md existe" "PASS" "Cree"
else
  add_row "T11-F3" "Fichier acaps-first-report-pilote-q1.md existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T11-V1: KPIs tracking framework (P0)
echo "  Verifying T11-V1 : KPIs tracking framework..."
add_row "T11-V1" "KPIs tracking framework" "WARN" "(P0) Voir B-35 Tache 7.7.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V2: Dashboards C-level (P0)
echo "  Verifying T11-V2 : Dashboards C-level..."
add_row "T11-V2" "Dashboards C-level" "WARN" "(P0) Voir B-35 Tache 7.7.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V3: ACAPS report submitted (P0)
echo "  Verifying T11-V3 : ACAPS report submitted..."
add_row "T11-V3" "ACAPS report submitted" "WARN" "(P0) Voir B-35 Tache 7.7.11 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 12/2 -- 7.7.12 : Lessons Learned + Retrospective

```bash
echo ""
echo "================================================"
echo "TACHE 7.7.12 : Lessons Learned + Retrospective"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 2"
echo "================================================"

# === Verification fichiers crees ===
# Test T12-F1: Existence fichier repo/docs/pilote/retrospective-pilote-marrakech.md
if [ -f "repo/docs/pilote/retrospective-pilote-marrakech.md" ]; then
  add_row "T12-F1" "Fichier retrospective-pilote-marrakech.md existe" "PASS" "Cree"
else
  add_row "T12-F1" "Fichier retrospective-pilote-marrakech.md existe" "FAIL" "Manquant"
fi
# Test T12-F2: Existence fichier repo/docs/pilote/lessons-learned-{technique,business,operations}.md
if [ -f "repo/docs/pilote/lessons-learned-{technique,business,operations}.md" ]; then
  add_row "T12-F2" "Fichier lessons-learned-{technique,business,operations}.md existe" "PASS" "Cree"
else
  add_row "T12-F2" "Fichier lessons-learned-{technique,business,operations}.md existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T12-V1: Retrospectives 4 stakeholders groups (P0)
echo "  Verifying T12-V1 : Retrospectives 4 stakeholders groups..."
add_row "T12-V1" "Retrospectives 4 stakeholders groups" "WARN" "(P0) Voir B-35 Tache 7.7.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V2: Lessons documente (P0)
echo "  Verifying T12-V2 : Lessons documente..."
add_row "T12-V2" "Lessons documente" "WARN" "(P0) Voir B-35 Tache 7.7.12 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 13/3 -- 7.7.13 : Plan Generalisation Phase 8

```bash
echo ""
echo "================================================"
echo "TACHE 7.7.13 : Plan Generalisation Phase 8"
echo "Priorite : P0 | Effort : 8h"
echo "Criteres a verifier : 3"
echo "================================================"

# === Verification fichiers crees ===
# Test T13-F1: Existence fichier repo/docs/phase-8-roadmap-scale-up.md
if [ -f "repo/docs/phase-8-roadmap-scale-up.md" ]; then
  add_row "T13-F1" "Fichier phase-8-roadmap-scale-up.md existe" "PASS" "Cree"
else
  add_row "T13-F1" "Fichier phase-8-roadmap-scale-up.md existe" "FAIL" "Manquant"
fi
# Test T13-F2: Existence fichier repo/docs/phase-8-investment-plan.md
if [ -f "repo/docs/phase-8-investment-plan.md" ]; then
  add_row "T13-F2" "Fichier phase-8-investment-plan.md existe" "PASS" "Cree"
else
  add_row "T13-F2" "Fichier phase-8-investment-plan.md existe" "FAIL" "Manquant"
fi
# Test T13-F3: Existence fichier repo/docs/feature-backlog-prioritized.md
if [ -f "repo/docs/feature-backlog-prioritized.md" ]; then
  add_row "T13-F3" "Fichier feature-backlog-prioritized.md existe" "PASS" "Cree"
else
  add_row "T13-F3" "Fichier feature-backlog-prioritized.md existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T13-V1: Roadmap Phase 8 detaillee (P0)
echo "  Verifying T13-V1 : Roadmap Phase 8 detaillee..."
add_row "T13-V1" "Roadmap Phase 8 detaillee" "WARN" "(P0) Voir B-35 Tache 7.7.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V2: Scale-up requirements (P0)
echo "  Verifying T13-V2 : Scale-up requirements..."
add_row "T13-V2" "Scale-up requirements" "WARN" "(P0) Voir B-35 Tache 7.7.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V3: Feature backlog priorise (P0)
echo "  Verifying T13-V3 : Feature backlog priorise..."
add_row "T13-V3" "Feature backlog priorise" "WARN" "(P0) Voir B-35 Tache 7.7.13 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 14/4 -- 7.7.14 : Programme Closure

```bash
echo ""
echo "================================================"
echo "TACHE 7.7.14 : Programme Closure"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 4"
echo "================================================"

# === Verification fichiers crees ===
# Test T14-F1: Existence fichier repo/docs/programme-closure-final.md
if [ -f "repo/docs/programme-closure-final.md" ]; then
  add_row "T14-F1" "Fichier programme-closure-final.md existe" "PASS" "Cree"
else
  add_row "T14-F1" "Fichier programme-closure-final.md existe" "FAIL" "Manquant"
fi
# Test T14-F2: Existence fichier repo/docs/handover-tech-to-ops.md
if [ -f "repo/docs/handover-tech-to-ops.md" ]; then
  add_row "T14-F2" "Fichier handover-tech-to-ops.md existe" "PASS" "Cree"
else
  add_row "T14-F2" "Fichier handover-tech-to-ops.md existe" "FAIL" "Manquant"
fi
# Test T14-F3: Existence fichier repo/docs/celebration-acknowledgments.md
if [ -f "repo/docs/celebration-acknowledgments.md" ]; then
  add_row "T14-F3" "Fichier celebration-acknowledgments.md existe" "PASS" "Cree"
else
  add_row "T14-F3" "Fichier celebration-acknowledgments.md existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T14-V1: Programme closure officielle (P0)
echo "  Verifying T14-V1 : Programme closure officielle..."
add_row "T14-V1" "Programme closure officielle" "WARN" "(P0) Voir B-35 Tache 7.7.14 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T14-V2: Handover complete (P0)
echo "  Verifying T14-V2 : Handover complete..."
add_row "T14-V2" "Handover complete" "WARN" "(P0) Voir B-35 Tache 7.7.14 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T14-V3: Communications closure (P0)
echo "  Verifying T14-V3 : Communications closure..."
add_row "T14-V3" "Communications closure" "WARN" "(P0) Voir B-35 Tache 7.7.14 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T14-V4: Phase 8 backlog ready (P0)
echo "  Verifying T14-V4 : Phase 8 backlog ready..."
add_row "T14-V4" "Phase 8 backlog ready" "WARN" "(P0) Voir B-35 Tache 7.7.14 pour test detaille - critere a auto-tester via script ad-hoc"

```

---


---


## VERIFICATIONS TRANSVERSALES SPRINT 35

### TR-BUILD : Build complet du sprint

```bash
echo ""
echo "================================================"
echo "VERIFICATIONS TRANSVERSALES SPRINT 35"
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

### TR-ATLAS : Connectivite Atlas Cloud Services Benguerir

```bash
echo "=== TR-ATLAS : Atlas Cloud Services ==="
ATLAS_S3_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "https://s3.bgr.atlascloudservices.ma/" || echo 0)
if [ "$ATLAS_S3_HEALTH" -eq 200 ] || [ "$ATLAS_S3_HEALTH" -eq 403 ]; then
  add_row "TR-ATLAS-S3" "Atlas S3 endpoint accessible" "PASS" "HTTP $ATLAS_S3_HEALTH"
else
  add_row "TR-ATLAS-S3" "Atlas S3 endpoint accessible" "FAIL" "HTTP $ATLAS_S3_HEALTH"
fi
```



---

## GENERATION DU RAPPORT FINAL

```bash
echo ""
echo "================================================"
echo "GENERATION DU RAPPORT FINAL SPRINT 35"
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

## Jalon GO/NO-GO Sprint 35

EOF

# Calcul statut final
if (( $(echo "$SCORE >= 95" | bc -l) )); then
  STATUT="GO"
  cat >> "$REPORT_FILE" << EOF
**STATUT** : GO -- Sprint 35 valide, passage Sprint final (FIN PROGRAMME) autorise

Le sprint a passe les criteres requis. Cowork peut demarrer Sprint (programme termine).

EOF
  echo ""
  echo "================================================"
  echo "SPRINT 35 : GO ($SCORE%)"
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
  echo "SPRINT 35 : GO CONDITIONNEL ($SCORE%)"
  echo "================================================"
else
  STATUT="NO-GO"
  cat >> "$REPORT_FILE" << EOF
**STATUT** : NO-GO -- Score $SCORE% trop bas (cible 85% minimum)

Le sprint **doit etre repris** :
- Lister tous FAIL P0
- Escalation Saad/Abla decision (cut scope OR delai)
- Reprise sprint avant Sprint final

EOF
  echo ""
  echo "================================================"
  echo "SPRINT 35 : NO-GO ($SCORE%)"
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
  echo "git commit -m \"chore(sprint-35): close sprint 35 -- $STATUT ($SCORE%)\"" >> "$REPORT_FILE"
  echo '```' >> "$REPORT_FILE"
fi

echo ""
echo "Rapport complet dans : $REPORT_FILE"
```

---

## INSTRUCTION FINALE A CLAUDE CODE / COWORK

Apres l'execution complete des verifications ci-dessus :

1. **Lis le contenu de `sprint35-verify-report.md`** integralement
2. **Identifie les FAIL critiques** (criteres P0) qui necessitent intervention manuelle
3. **Affiche un resume executif** :
   - Nombre total de criteres
   - Pourcentage PASS / PASS\* / FAIL / WARN
   - Liste des FAIL avec contexte technique
   - Recommandation : GO / GO CONDITIONNEL / NO-GO
4. **Si NO-GO** : ne pas demarrer le Sprint suivant, alerter Saad/Abla via Slack `#insurtech-dev`
5. **Si GO ou GO CONDITIONNEL** : produire le commit de cloture du sprint :

```bash
git add skalean-insurtech/sprint35-verify-report.md
git commit -m "chore(sprint-35): close sprint 35 with verification report

- Verification automatique executee
- Score global : <SCORE>%
- <PASS> criteres PASS, <PASS_REPAIRED> reparations auto, <FAIL> FAIL
- Statut : <GO|GO CONDITIONNEL|NO-GO>

Phase: 7 -- Hardening + Integrations + Pilote
Sprint: 35 (Phase 7 / Sprint 7)
Reference B-35, C-35, V-35
Report: sprint35-verify-report.md"
```

6. **Documentation continue** : si decisions techniques prises pendant verification, ajouter notes dans `repo/docs/runbooks/sprint-35-lessons-learned.md`

---

**Fin de la verification V-35 v2.2 detaillee -- Sprint 35 (7.7) Pilote Marrakech + Go-Live (4 sem + suivi).**

**Total criteres taches** : 51 | **Total transversaux** : ~10 | **Effort sprint** : 150h
