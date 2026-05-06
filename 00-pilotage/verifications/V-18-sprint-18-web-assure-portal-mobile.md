# VERIFICATION SPRINT 18 -- Phase 4 / Sprint 5 : Web Assure Portal + Mobile PWA
# Version : Auto-reparation active + Rapport final MD detaille
# 14 taches, 70 criteres extraits B-18
# AUCUNE EMOJI AUTORISEE

**Version** : v2.2 (verification detaillee)
**Phase** : 4 -- Vertical Insure (Skalean Broker ERP)
**Sprint** : 18 / 35 (cumul) -- Sprint 5 dans Phase 4
**Reference meta-prompt** : `B-18-sprint-18-web-assure-portal-mobile.md`
**Reference orchestrateur** : `C-18-sprint-18-web-assure-portal-mobile.md`
**Total criteres** : 70 criteres taches + ~10 transversaux

---

Tu es **Claude Code (ou Cowork)**. Tu dois executer une **verification COMPLETE et EXHAUSTIVE** du Sprint 18 apres execution toutes les 14 taches.

---

## REGLES D'EXECUTION

1. Tu **executes CHAQUE verification dans l'ordre** (taches puis transversales)
2. Quand une verification echoue, tu **TENTES UNE REPARATION AUTOMATIQUE** avant de noter FAIL
3. Apres chaque tentative de reparation, tu **re-executes la verification**
4. Tu consignes dans `sprint18-verify-report.md` **TOUS les resultats** au fil de l'execution
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
REPORT_FILE="sprint18-verify-report.md"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
RUN_ID=$(date '+%Y%m%d-%H%M%S')

cat > "$REPORT_FILE" << EOF
# Rapport de Verification - Sprint 18 : Web Assure Portal + Mobile PWA

**Date** : $TIMESTAMP
**Run ID** : $RUN_ID
**Phase** : 4 -- Vertical Insure (Skalean Broker ERP)
**Sprint** : 18 (Phase 4 / Sprint 5)
**Reference B-18** : 14 taches, 70 criteres extraits
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

## TACHE 1/7 -- 4.5.1 : App Skeleton + PWA Setup

```bash
echo ""
echo "================================================"
echo "TACHE 4.5.1 : App Skeleton + PWA Setup"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 7"
echo "================================================"

# === Verification fichiers crees ===
# Test T01-F3: Existence fichier repo/apps/web-assure-mobile/public/manifest.json
if [ -f "repo/apps/web-assure-mobile/public/manifest.json" ]; then
  add_row "T01-F3" "Fichier manifest.json existe" "PASS" "Cree"
else
  add_row "T01-F3" "Fichier manifest.json existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T01-V1: 2 apps demarrent (3005 + 3006) (P0)
echo "  Verifying T01-V1 : 2 apps demarrent (3005 + 3006)..."
add_row "T01-V1" "2 apps demarrent (3005 + 3006)" "WARN" "(P0) Voir B-18 Tache 4.5.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V2: Manifest.json valide (P0)
echo "  Verifying T01-V2 : Manifest.json valide..."
add_row "T01-V2" "Manifest.json valide" "WARN" "(P0) Voir B-18 Tache 4.5.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V3: Service worker registered + activated (P0)
echo "  Verifying T01-V3 : Service worker registered + activated..."
add_row "T01-V3" "Service worker registered + activated" "WARN" "(P0) Voir B-18 Tache 4.5.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V4: Lighthouse PWA score 100 (P0)
echo "  Verifying T01-V4 : Lighthouse PWA score 100..."
add_row "T01-V4" "Lighthouse PWA score 100" "WARN" "(P0) Voir B-18 Tache 4.5.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V5: Installable mobile (Chrome / Safari) (P0)
echo "  Verifying T01-V5 : Installable mobile (Chrome / Safari)..."
add_row "T01-V5" "Installable mobile (Chrome / Safari)" "WARN" "(P0) Voir B-18 Tache 4.5.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V6: Package shared utilisable par 2 apps (P0)
echo "  Verifying T01-V6 : Package shared utilisable par 2 apps..."
add_row "T01-V6" "Package shared utilisable par 2 apps" "WARN" "(P0) Voir B-18 Tache 4.5.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V7: Tests setup 6+ scenarios (P0)
echo "  Verifying T01-V7 : Tests setup 6+ scenarios..."
add_row "T01-V7" "Tests setup 6+ scenarios" "WARN" "(P0) Voir B-18 Tache 4.5.1 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 2/7 -- 4.5.2 : Auth Assure : OTP Login + Signup Auto-Link

```bash
echo ""
echo "================================================"
echo "TACHE 4.5.2 : Auth Assure : OTP Login + Signup Auto-Link"
echo "Priorite : P0 | Effort : 7h"
echo "Criteres a verifier : 7"
echo "================================================"

# === Verification fichiers crees ===
# Test T02-F1: Existence fichier repo/packages/database/src/migrations/{date}-AssureUsers.ts
if [ -f "repo/packages/database/src/migrations/{date}-AssureUsers.ts" ]; then
  add_row "T02-F1" "Fichier {date}-AssureUsers.ts existe" "PASS" "Cree"
else
  add_row "T02-F1" "Fichier {date}-AssureUsers.ts existe" "FAIL" "Manquant"
fi
# Test T02-F2: Existence fichier repo/packages/auth/src/entities/assure-user.entity.ts
if [ -f "repo/packages/auth/src/entities/assure-user.entity.ts" ]; then
  add_row "T02-F2" "Fichier assure-user.entity.ts existe" "PASS" "Cree"
else
  add_row "T02-F2" "Fichier assure-user.entity.ts existe" "FAIL" "Manquant"
fi
# Test T02-F3: Existence fichier repo/packages/auth/src/services/otp-auth.service.ts
if [ -f "repo/packages/auth/src/services/otp-auth.service.ts" ]; then
  add_row "T02-F3" "Fichier otp-auth.service.ts existe" "PASS" "Cree"
else
  add_row "T02-F3" "Fichier otp-auth.service.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T02-V1: OTP generation + Redis storage TTL 10min (P0)
echo "  Verifying T02-V1 : OTP generation + Redis storage TTL 10min..."
add_row "T02-V1" "OTP generation + Redis storage TTL 10min" "WARN" "(P0) Voir B-18 Tache 4.5.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V2: OTP envoyee email + SMS si phone (P0)
echo "  Verifying T02-V2 : OTP envoyee email + SMS si phone..."
add_row "T02-V2" "OTP envoyee email + SMS si phone" "WARN" "(P0) Voir B-18 Tache 4.5.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V3: Verify correct -> JWT (P0)
echo "  Verifying T02-V3 : Verify correct -> JWT..."
add_row "T02-V3" "Verify correct -> JWT" "WARN" "(P0) Voir B-18 Tache 4.5.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V4: Wrong OTP : remaining_attempts decremente (P0)
echo "  Verifying T02-V4 : Wrong OTP : remaining_attempts decremente..."
add_row "T02-V4" "Wrong OTP : remaining_attempts decremente" "WARN" "(P0) Voir B-18 Tache 4.5.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V5: Max attempts : OTP invalidated (P0)
echo "  Verifying T02-V5 : Max attempts : OTP invalidated..."
add_row "T02-V5" "Max attempts : OTP invalidated" "WARN" "(P0) Voir B-18 Tache 4.5.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V6: Auto-link contact existing (P0)
echo "  Verifying T02-V6 : Auto-link contact existing..."
add_row "T02-V6" "Auto-link contact existing" "WARN" "(P0) Voir B-18 Tache 4.5.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V7: Tests 10+ scenarios (P0)
echo "  Verifying T02-V7 : Tests 10+ scenarios..."
add_row "T02-V7" "Tests 10+ scenarios" "WARN" "(P0) Voir B-18 Tache 4.5.2 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 3/5 -- 4.5.3 : Layout Assure : Header + Bottom Nav + Sidebar

```bash
echo ""
echo "================================================"
echo "TACHE 4.5.3 : Layout Assure : Header + Bottom Nav + Sidebar"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T03-F1: Existence fichier repo/apps/web-assure-portal/components/layout/sidebar.tsx
if [ -f "repo/apps/web-assure-portal/components/layout/sidebar.tsx" ]; then
  add_row "T03-F1" "Fichier sidebar.tsx existe" "PASS" "Cree"
else
  add_row "T03-F1" "Fichier sidebar.tsx existe" "FAIL" "Manquant"
fi
# Test T03-F2: Existence fichier repo/apps/web-assure-portal/components/layout/header.tsx
if [ -f "repo/apps/web-assure-portal/components/layout/header.tsx" ]; then
  add_row "T03-F2" "Fichier header.tsx existe" "PASS" "Cree"
else
  add_row "T03-F2" "Fichier header.tsx existe" "FAIL" "Manquant"
fi
# Test T03-F3: Existence fichier repo/apps/web-assure-mobile/components/layout/bottom-nav.tsx
if [ -f "repo/apps/web-assure-mobile/components/layout/bottom-nav.tsx" ]; then
  add_row "T03-F3" "Fichier bottom-nav.tsx existe" "PASS" "Cree"
else
  add_row "T03-F3" "Fichier bottom-nav.tsx existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T03-V1: Desktop sidebar + navigation (P0)
echo "  Verifying T03-V1 : Desktop sidebar + navigation..."
add_row "T03-V1" "Desktop sidebar + navigation" "WARN" "(P0) Voir B-18 Tache 4.5.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V2: Mobile bottom nav 5 tabs (P0)
echo "  Verifying T03-V2 : Mobile bottom nav 5 tabs..."
add_row "T03-V2" "Mobile bottom nav 5 tabs" "WARN" "(P0) Voir B-18 Tache 4.5.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V3: FAB Declarer sinistre persistent (P0)
echo "  Verifying T03-V3 : FAB Declarer sinistre persistent..."
add_row "T03-V3" "FAB Declarer sinistre persistent" "WARN" "(P0) Voir B-18 Tache 4.5.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V4: Pull-to-refresh (P0)
echo "  Verifying T03-V4 : Pull-to-refresh..."
add_row "T03-V4" "Pull-to-refresh" "WARN" "(P0) Voir B-18 Tache 4.5.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V5: Tests 6+ scenarios (P0)
echo "  Verifying T03-V5 : Tests 6+ scenarios..."
add_row "T03-V5" "Tests 6+ scenarios" "WARN" "(P0) Voir B-18 Tache 4.5.3 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 4/5 -- 4.5.4 : Mes Polices Page : List + Detail

```bash
echo ""
echo "================================================"
echo "TACHE 4.5.4 : Mes Polices Page : List + Detail"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T04-F1: Existence fichier repo/apps/web-assure-portal/app/[locale]/polices/page.tsx
if [ -f "repo/apps/web-assure-portal/app/[locale]/polices/page.tsx" ]; then
  add_row "T04-F1" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T04-F1" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T04-F2: Existence fichier repo/apps/web-assure-portal/app/[locale]/polices/[id]/page.tsx
if [ -f "repo/apps/web-assure-portal/app/[locale]/polices/[id]/page.tsx" ]; then
  add_row "T04-F2" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T04-F2" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T04-F3: Existence fichier repo/apps/web-assure-mobile/app/[locale]/polices/page.tsx
if [ -f "repo/apps/web-assure-mobile/app/[locale]/polices/page.tsx" ]; then
  add_row "T04-F3" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T04-F3" "Fichier page.tsx existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T04-V1: List polices personnel (P0)
echo "  Verifying T04-V1 : List polices personnel..."
add_row "T04-V1" "List polices personnel" "WARN" "(P0) Voir B-18 Tache 4.5.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V2: Detail tabs all functional (P0)
echo "  Verifying T04-V2 : Detail tabs all functional..."
add_row "T04-V2" "Detail tabs all functional" "WARN" "(P0) Voir B-18 Tache 4.5.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V3: Actions selon contexte (P0)
echo "  Verifying T04-V3 : Actions selon contexte..."
add_row "T04-V3" "Actions selon contexte" "WARN" "(P0) Voir B-18 Tache 4.5.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V4: Mobile responsive (P0)
echo "  Verifying T04-V4 : Mobile responsive..."
add_row "T04-V4" "Mobile responsive" "WARN" "(P0) Voir B-18 Tache 4.5.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V5: Tests 8+ scenarios (P0)
echo "  Verifying T04-V5 : Tests 8+ scenarios..."
add_row "T04-V5" "Tests 8+ scenarios" "WARN" "(P0) Voir B-18 Tache 4.5.4 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 5/4 -- 4.5.5 : Premiums Echeancier + Paiement Reglement

```bash
echo ""
echo "================================================"
echo "TACHE 4.5.5 : Premiums Echeancier + Paiement Reglement"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 4"
echo "================================================"

# === Verification fichiers crees ===
# Test T05-F1: Existence fichier repo/apps/web-assure-portal/app/[locale]/polices/[id]/premiums/page.tsx
if [ -f "repo/apps/web-assure-portal/app/[locale]/polices/[id]/premiums/page.tsx" ]; then
  add_row "T05-F1" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T05-F1" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T05-F2: Existence fichier repo/packages/assure-shared/src/components/premiums-timeline.tsx
if [ -f "repo/packages/assure-shared/src/components/premiums-timeline.tsx" ]; then
  add_row "T05-F2" "Fichier premiums-timeline.tsx existe" "PASS" "Cree"
else
  add_row "T05-F2" "Fichier premiums-timeline.tsx existe" "FAIL" "Manquant"
fi
# Test T05-F3: Existence fichier repo/packages/assure-shared/src/components/payment-method-dialog.tsx
if [ -f "repo/packages/assure-shared/src/components/payment-method-dialog.tsx" ]; then
  add_row "T05-F3" "Fichier payment-method-dialog.tsx existe" "PASS" "Cree"
else
  add_row "T05-F3" "Fichier payment-method-dialog.tsx existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T05-V1: Timeline visible (P0)
echo "  Verifying T05-V1 : Timeline visible..."
add_row "T05-V1" "Timeline visible" "WARN" "(P0) Voir B-18 Tache 4.5.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V2: Pay flow complete (P0)
echo "  Verifying T05-V2 : Pay flow complete..."
add_row "T05-V2" "Pay flow complete" "WARN" "(P0) Voir B-18 Tache 4.5.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V3: Receipts download (P0)
echo "  Verifying T05-V3 : Receipts download..."
add_row "T05-V3" "Receipts download" "WARN" "(P0) Voir B-18 Tache 4.5.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V4: Tests 6+ scenarios (P0)
echo "  Verifying T05-V4 : Tests 6+ scenarios..."
add_row "T05-V4" "Tests 6+ scenarios" "WARN" "(P0) Voir B-18 Tache 4.5.5 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 6/6 -- 4.5.6 : Declarer Sinistre Etape 1 : Infos + Photos

```bash
echo ""
echo "================================================"
echo "TACHE 4.5.6 : Declarer Sinistre Etape 1 : Infos + Photos"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 6"
echo "================================================"

# === Verification fichiers crees ===
# Test T06-F1: Existence fichier repo/apps/web-assure-portal/app/[locale]/sinistres/declarer/etape-1/page.tsx
if [ -f "repo/apps/web-assure-portal/app/[locale]/sinistres/declarer/etape-1/page.tsx" ]; then
  add_row "T06-F1" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T06-F1" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T06-F2: Existence fichier repo/apps/web-assure-mobile/app/[locale]/sinistres/declarer/etape-1/page.tsx
if [ -f "repo/apps/web-assure-mobile/app/[locale]/sinistres/declarer/etape-1/page.tsx" ]; then
  add_row "T06-F2" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T06-F2" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T06-F3: Existence fichier repo/packages/assure-shared/src/components/sinistre-photos-upload.tsx
if [ -f "repo/packages/assure-shared/src/components/sinistre-photos-upload.tsx" ]; then
  add_row "T06-F3" "Fichier sinistre-photos-upload.tsx existe" "PASS" "Cree"
else
  add_row "T06-F3" "Fichier sinistre-photos-upload.tsx existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T06-V1: Form complet (P0)
echo "  Verifying T06-V1 : Form complet..."
add_row "T06-V1" "Form complet" "WARN" "(P0) Voir B-18 Tache 4.5.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V2: Photos upload + compression (P0)
echo "  Verifying T06-V2 : Photos upload + compression..."
add_row "T06-V2" "Photos upload + compression" "WARN" "(P0) Voir B-18 Tache 4.5.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V3: Camera mobile direct (P0)
echo "  Verifying T06-V3 : Camera mobile direct..."
add_row "T06-V3" "Camera mobile direct" "WARN" "(P0) Voir B-18 Tache 4.5.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V4: GPS geolocation (P0)
echo "  Verifying T06-V4 : GPS geolocation..."
add_row "T06-V4" "GPS geolocation" "WARN" "(P0) Voir B-18 Tache 4.5.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V5: Save draft (P0)
echo "  Verifying T06-V5 : Save draft..."
add_row "T06-V5" "Save draft" "WARN" "(P0) Voir B-18 Tache 4.5.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V6: Tests 8+ scenarios (P0)
echo "  Verifying T06-V6 : Tests 8+ scenarios..."
add_row "T06-V6" "Tests 8+ scenarios" "WARN" "(P0) Voir B-18 Tache 4.5.6 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 7/5 -- 4.5.7 : Declarer Sinistre Etape 2 : Choix Garage M8

```bash
echo ""
echo "================================================"
echo "TACHE 4.5.7 : Declarer Sinistre Etape 2 : Choix Garage M8"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T07-F1: Existence fichier repo/apps/web-assure-portal/app/[locale]/sinistres/declarer/etape-2/page.tsx
if [ -f "repo/apps/web-assure-portal/app/[locale]/sinistres/declarer/etape-2/page.tsx" ]; then
  add_row "T07-F1" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T07-F1" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T07-F2: Existence fichier repo/apps/web-assure-mobile/app/[locale]/sinistres/declarer/etape-2/page.tsx
if [ -f "repo/apps/web-assure-mobile/app/[locale]/sinistres/declarer/etape-2/page.tsx" ]; then
  add_row "T07-F2" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T07-F2" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T07-F3: Existence fichier repo/packages/assure-shared/src/components/garage-card.tsx
if [ -f "repo/packages/assure-shared/src/components/garage-card.tsx" ]; then
  add_row "T07-F3" "Fichier garage-card.tsx existe" "PASS" "Cree"
else
  add_row "T07-F3" "Fichier garage-card.tsx existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T07-V1: List garages avec geolocalisation (P0)
echo "  Verifying T07-V1 : List garages avec geolocalisation..."
add_row "T07-V1" "List garages avec geolocalisation" "WARN" "(P0) Voir B-18 Tache 4.5.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V2: Skalean Atlas highlighted (P0)
echo "  Verifying T07-V2 : Skalean Atlas highlighted..."
add_row "T07-V2" "Skalean Atlas highlighted" "WARN" "(P0) Voir B-18 Tache 4.5.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V3: Filtres distance + rating + specialite (P0)
echo "  Verifying T07-V3 : Filtres distance + rating + specialite..."
add_row "T07-V3" "Filtres distance + rating + specialite" "WARN" "(P0) Voir B-18 Tache 4.5.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V4: Selection + continue (P0)
echo "  Verifying T07-V4 : Selection + continue..."
add_row "T07-V4" "Selection + continue" "WARN" "(P0) Voir B-18 Tache 4.5.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V5: Tests 6+ scenarios (P0)
echo "  Verifying T07-V5 : Tests 6+ scenarios..."
add_row "T07-V5" "Tests 6+ scenarios" "WARN" "(P0) Voir B-18 Tache 4.5.7 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 8/5 -- 4.5.8 : Declarer Sinistre Etape 3 : Appointment Booking + Confirmation

```bash
echo ""
echo "================================================"
echo "TACHE 4.5.8 : Declarer Sinistre Etape 3 : Appointment Booking + Confirmati"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T08-F1: Existence fichier repo/apps/web-assure-portal/app/[locale]/sinistres/declarer/etape-3/page.tsx
if [ -f "repo/apps/web-assure-portal/app/[locale]/sinistres/declarer/etape-3/page.tsx" ]; then
  add_row "T08-F1" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T08-F1" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T08-F2: Existence fichier repo/apps/web-assure-portal/app/[locale]/sinistres/declarer/confirmation/page.tsx
if [ -f "repo/apps/web-assure-portal/app/[locale]/sinistres/declarer/confirmation/page.tsx" ]; then
  add_row "T08-F2" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T08-F2" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T08-F3: Existence fichier repo/packages/assure-shared/src/components/calendar-widget.tsx
if [ -f "repo/packages/assure-shared/src/components/calendar-widget.tsx" ]; then
  add_row "T08-F3" "Fichier calendar-widget.tsx existe" "PASS" "Cree"
else
  add_row "T08-F3" "Fichier calendar-widget.tsx existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T08-V1: Calendar widget creneaux (P0)
echo "  Verifying T08-V1 : Calendar widget creneaux..."
add_row "T08-V1" "Calendar widget creneaux" "WARN" "(P0) Voir B-18 Tache 4.5.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V2: Submit cree sinistre + appointment (P0)
echo "  Verifying T08-V2 : Submit cree sinistre + appointment..."
add_row "T08-V2" "Submit cree sinistre + appointment" "WARN" "(P0) Voir B-18 Tache 4.5.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V3: Notifications garage + assure (P0)
echo "  Verifying T08-V3 : Notifications garage + assure..."
add_row "T08-V3" "Notifications garage + assure" "WARN" "(P0) Voir B-18 Tache 4.5.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V4: Confirmation page (P0)
echo "  Verifying T08-V4 : Confirmation page..."
add_row "T08-V4" "Confirmation page" "WARN" "(P0) Voir B-18 Tache 4.5.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V5: Tests 6+ scenarios (P0)
echo "  Verifying T08-V5 : Tests 6+ scenarios..."
add_row "T08-V5" "Tests 6+ scenarios" "WARN" "(P0) Voir B-18 Tache 4.5.8 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 9/4 -- 4.5.9 : Mes Sinistres : List + Detail Timeline

```bash
echo ""
echo "================================================"
echo "TACHE 4.5.9 : Mes Sinistres : List + Detail Timeline"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 4"
echo "================================================"

# === Verification fichiers crees ===
# Test T09-F1: Existence fichier repo/apps/web-assure-portal/app/[locale]/sinistres/page.tsx
if [ -f "repo/apps/web-assure-portal/app/[locale]/sinistres/page.tsx" ]; then
  add_row "T09-F1" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T09-F1" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T09-F2: Existence fichier repo/apps/web-assure-portal/app/[locale]/sinistres/[id]/page.tsx
if [ -f "repo/apps/web-assure-portal/app/[locale]/sinistres/[id]/page.tsx" ]; then
  add_row "T09-F2" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T09-F2" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T09-F3: Existence fichier repo/packages/assure-shared/src/components/sinistre-timeline.tsx
if [ -f "repo/packages/assure-shared/src/components/sinistre-timeline.tsx" ]; then
  add_row "T09-F3" "Fichier sinistre-timeline.tsx existe" "PASS" "Cree"
else
  add_row "T09-F3" "Fichier sinistre-timeline.tsx existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T09-V1: List + filtres (P0)
echo "  Verifying T09-V1 : List + filtres..."
add_row "T09-V1" "List + filtres" "WARN" "(P0) Voir B-18 Tache 4.5.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V2: Detail timeline visuelle (P0)
echo "  Verifying T09-V2 : Detail timeline visuelle..."
add_row "T09-V2" "Detail timeline visuelle" "WARN" "(P0) Voir B-18 Tache 4.5.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V3: Status updates polling (P0)
echo "  Verifying T09-V3 : Status updates polling..."
add_row "T09-V3" "Status updates polling" "WARN" "(P0) Voir B-18 Tache 4.5.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V4: Tests 6+ scenarios (P0)
echo "  Verifying T09-V4 : Tests 6+ scenarios..."
add_row "T09-V4" "Tests 6+ scenarios" "WARN" "(P0) Voir B-18 Tache 4.5.9 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 10/4 -- 4.5.10 : Mes Documents + QR Scanner

```bash
echo ""
echo "================================================"
echo "TACHE 4.5.10 : Mes Documents + QR Scanner"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 4"
echo "================================================"

# === Verification fichiers crees ===
# Test T10-F1: Existence fichier repo/apps/web-assure-portal/app/[locale]/documents/page.tsx
if [ -f "repo/apps/web-assure-portal/app/[locale]/documents/page.tsx" ]; then
  add_row "T10-F1" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T10-F1" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T10-F2: Existence fichier repo/apps/web-assure-mobile/app/[locale]/documents/scan-qr/page.tsx
if [ -f "repo/apps/web-assure-mobile/app/[locale]/documents/scan-qr/page.tsx" ]; then
  add_row "T10-F2" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T10-F2" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T10-F3: Existence fichier repo/packages/assure-shared/src/components/qr-scanner.tsx
if [ -f "repo/packages/assure-shared/src/components/qr-scanner.tsx" ]; then
  add_row "T10-F3" "Fichier qr-scanner.tsx existe" "PASS" "Cree"
else
  add_row "T10-F3" "Fichier qr-scanner.tsx existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T10-V1: List documents (P0)
echo "  Verifying T10-V1 : List documents..."
add_row "T10-V1" "List documents" "WARN" "(P0) Voir B-18 Tache 4.5.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V2: PDF preview + download (P0)
echo "  Verifying T10-V2 : PDF preview + download..."
add_row "T10-V2" "PDF preview + download" "WARN" "(P0) Voir B-18 Tache 4.5.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V3: QR scanner camera (P0)
echo "  Verifying T10-V3 : QR scanner camera..."
add_row "T10-V3" "QR scanner camera" "WARN" "(P0) Voir B-18 Tache 4.5.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V4: Tests 6+ scenarios (P0)
echo "  Verifying T10-V4 : Tests 6+ scenarios..."
add_row "T10-V4" "Tests 6+ scenarios" "WARN" "(P0) Voir B-18 Tache 4.5.10 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 11/5 -- 4.5.11 : Notifications Center + Push PWA

```bash
echo ""
echo "================================================"
echo "TACHE 4.5.11 : Notifications Center + Push PWA"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T11-F1: Existence fichier repo/packages/database/src/migrations/{date}-Notifications.ts
if [ -f "repo/packages/database/src/migrations/{date}-Notifications.ts" ]; then
  add_row "T11-F1" "Fichier {date}-Notifications.ts existe" "PASS" "Cree"
else
  add_row "T11-F1" "Fichier {date}-Notifications.ts existe" "FAIL" "Manquant"
fi
# Test T11-F2: Existence fichier repo/packages/notifications/src/services/push-subscription.service.ts
if [ -f "repo/packages/notifications/src/services/push-subscription.service.ts" ]; then
  add_row "T11-F2" "Fichier push-subscription.service.ts existe" "PASS" "Cree"
else
  add_row "T11-F2" "Fichier push-subscription.service.ts existe" "FAIL" "Manquant"
fi
# Test T11-F3: Existence fichier repo/packages/notifications/src/services/web-push-sender.service.ts
if [ -f "repo/packages/notifications/src/services/web-push-sender.service.ts" ]; then
  add_row "T11-F3" "Fichier web-push-sender.service.ts existe" "PASS" "Cree"
else
  add_row "T11-F3" "Fichier web-push-sender.service.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T11-V1: Subscription PWA fonctionne (P0)
echo "  Verifying T11-V1 : Subscription PWA fonctionne..."
add_row "T11-V1" "Subscription PWA fonctionne" "WARN" "(P0) Voir B-18 Tache 4.5.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V2: Backend send push (P0)
echo "  Verifying T11-V2 : Backend send push..."
add_row "T11-V2" "Backend send push" "WARN" "(P0) Voir B-18 Tache 4.5.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V3: Service worker handler (P0)
echo "  Verifying T11-V3 : Service worker handler..."
add_row "T11-V3" "Service worker handler" "WARN" "(P0) Voir B-18 Tache 4.5.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V4: Settings opt-in/out (P0)
echo "  Verifying T11-V4 : Settings opt-in/out..."
add_row "T11-V4" "Settings opt-in/out" "WARN" "(P0) Voir B-18 Tache 4.5.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V5: Tests 6+ scenarios (P0)
echo "  Verifying T11-V5 : Tests 6+ scenarios..."
add_row "T11-V5" "Tests 6+ scenarios" "WARN" "(P0) Voir B-18 Tache 4.5.11 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 12/5 -- 4.5.12 : Service Worker + Offline Cache

```bash
echo ""
echo "================================================"
echo "TACHE 4.5.12 : Service Worker + Offline Cache"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T12-F1: Existence fichier repo/apps/web-assure-mobile/app/sw.ts
if [ -f "repo/apps/web-assure-mobile/app/sw.ts" ]; then
  add_row "T12-F1" "Fichier sw.ts existe" "PASS" "Cree"
else
  add_row "T12-F1" "Fichier sw.ts existe" "FAIL" "Manquant"
fi
# Test T12-F2: Existence fichier repo/apps/web-assure-mobile/app/[locale]/offline/page.tsx
if [ -f "repo/apps/web-assure-mobile/app/[locale]/offline/page.tsx" ]; then
  add_row "T12-F2" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T12-F2" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T12-F3: Existence fichier repo/packages/assure-shared/src/lib/background-sync.ts
if [ -f "repo/packages/assure-shared/src/lib/background-sync.ts" ]; then
  add_row "T12-F3" "Fichier background-sync.ts existe" "PASS" "Cree"
else
  add_row "T12-F3" "Fichier background-sync.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T12-V1: Cache static assets (P0)
echo "  Verifying T12-V1 : Cache static assets..."
add_row "T12-V1" "Cache static assets" "WARN" "(P0) Voir B-18 Tache 4.5.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V2: Network First API (P0)
echo "  Verifying T12-V2 : Network First API..."
add_row "T12-V2" "Network First API" "WARN" "(P0) Voir B-18 Tache 4.5.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V3: Background sync upload (P0)
echo "  Verifying T12-V3 : Background sync upload..."
add_row "T12-V3" "Background sync upload" "WARN" "(P0) Voir B-18 Tache 4.5.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V4: Offline page custom (P0)
echo "  Verifying T12-V4 : Offline page custom..."
add_row "T12-V4" "Offline page custom" "WARN" "(P0) Voir B-18 Tache 4.5.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V5: Tests offline 5+ scenarios (P0)
echo "  Verifying T12-V5 : Tests offline 5+ scenarios..."
add_row "T12-V5" "Tests offline 5+ scenarios" "WARN" "(P0) Voir B-18 Tache 4.5.12 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 13/4 -- 4.5.13 : I18n + RTL + Mobile-First Responsive

```bash
echo ""
echo "================================================"
echo "TACHE 4.5.13 : I18n + RTL + Mobile-First Responsive"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 4"
echo "================================================"

# === Verification fichiers crees ===
# Test T13-F1: Existence fichier repo/apps/web-assure-portal/messages/{fr,ar-MA,ar}.json
if [ -f "repo/apps/web-assure-portal/messages/{fr,ar-MA,ar}.json" ]; then
  add_row "T13-F1" "Fichier {fr,ar-MA,ar}.json existe" "PASS" "Cree"
else
  add_row "T13-F1" "Fichier {fr,ar-MA,ar}.json existe" "FAIL" "Manquant"
fi
# Test T13-F2: Existence fichier repo/apps/web-assure-mobile/messages/{fr,ar-MA,ar}.json
if [ -f "repo/apps/web-assure-mobile/messages/{fr,ar-MA,ar}.json" ]; then
  add_row "T13-F2" "Fichier {fr,ar-MA,ar}.json existe" "PASS" "Cree"
else
  add_row "T13-F2" "Fichier {fr,ar-MA,ar}.json existe" "FAIL" "Manquant"
fi
# Test T13-F3: Existence fichier repo/packages/assure-shared/messages/{shared keys}.json
if [ -f "repo/packages/assure-shared/messages/{shared keys}.json" ]; then
  add_row "T13-F3" "Fichier {shared keys}.json existe" "PASS" "Cree"
else
  add_row "T13-F3" "Fichier {shared keys}.json existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T13-V1: 3 locales complete (P0)
echo "  Verifying T13-V1 : 3 locales complete..."
add_row "T13-V1" "3 locales complete" "WARN" "(P0) Voir B-18 Tache 4.5.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V2: RTL fonctionne (P0)
echo "  Verifying T13-V2 : RTL fonctionne..."
add_row "T13-V2" "RTL fonctionne" "WARN" "(P0) Voir B-18 Tache 4.5.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V3: Mobile-first all viewports (P0)
echo "  Verifying T13-V3 : Mobile-first all viewports..."
add_row "T13-V3" "Mobile-first all viewports" "WARN" "(P0) Voir B-18 Tache 4.5.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V4: Tests 6+ scenarios (P0)
echo "  Verifying T13-V4 : Tests 6+ scenarios..."
add_row "T13-V4" "Tests 6+ scenarios" "WARN" "(P0) Voir B-18 Tache 4.5.13 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 14/4 -- 4.5.14 : Tests E2E + Lighthouse PWA + Phase 4 Closure

```bash
echo ""
echo "================================================"
echo "TACHE 4.5.14 : Tests E2E + Lighthouse PWA + Phase 4 Closure"
echo "Priorite : P0 | Effort : 12h"
echo "Criteres a verifier : 4"
echo "================================================"

# === Verification fichiers crees ===
# Test T14-F1: Existence fichier repo/apps/web-assure-portal/e2e/{15+ specs}.spec.ts
if [ -f "repo/apps/web-assure-portal/e2e/{15+ specs}.spec.ts" ]; then
  add_row "T14-F1" "Fichier {15+ specs}.spec.ts existe" "PASS" "Cree"
else
  add_row "T14-F1" "Fichier {15+ specs}.spec.ts existe" "FAIL" "Manquant"
fi
# Test T14-F2: Existence fichier repo/apps/web-assure-mobile/e2e/{15+ specs}.spec.ts
if [ -f "repo/apps/web-assure-mobile/e2e/{15+ specs}.spec.ts" ]; then
  add_row "T14-F2" "Fichier {15+ specs}.spec.ts existe" "PASS" "Cree"
else
  add_row "T14-F2" "Fichier {15+ specs}.spec.ts existe" "FAIL" "Manquant"
fi
# Test T14-F3: Existence fichier repo/docs/phase-4-completion.md
if [ -f "repo/docs/phase-4-completion.md" ]; then
  add_row "T14-F3" "Fichier phase-4-completion.md existe" "PASS" "Cree"
else
  add_row "T14-F3" "Fichier phase-4-completion.md existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T14-V1: 15+ tests passent (P0)
echo "  Verifying T14-V1 : 15+ tests passent..."
add_row "T14-V1" "15+ tests passent" "WARN" "(P0) Voir B-18 Tache 4.5.14 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T14-V2: Lighthouse PWA 100 (P0)
echo "  Verifying T14-V2 : Lighthouse PWA 100..."
add_row "T14-V2" "Lighthouse PWA 100" "WARN" "(P0) Voir B-18 Tache 4.5.14 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T14-V3: Phase 4 closure document (P0)
echo "  Verifying T14-V3 : Phase 4 closure document..."
add_row "T14-V3" "Phase 4 closure document" "WARN" "(P0) Voir B-18 Tache 4.5.14 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T14-V4: Reproducibility 5x (P0)
echo "  Verifying T14-V4 : Reproducibility 5x..."
add_row "T14-V4" "Reproducibility 5x" "WARN" "(P0) Voir B-18 Tache 4.5.14 pour test detaille - critere a auto-tester via script ad-hoc"

```

---


---


## VERIFICATIONS TRANSVERSALES SPRINT 18

### TR-BUILD : Build complet du sprint

```bash
echo ""
echo "================================================"
echo "VERIFICATIONS TRANSVERSALES SPRINT 18"
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

### TR-LIGHTHOUSE : Cibles Lighthouse Sprint 18

```bash
echo "=== TR-LIGHTHOUSE : Lighthouse scores ==="
# Note : execution Lighthouse necessite app demarree
# Voir 6-metriques-validation.md pour cibles per app
add_row "TR-LIGHTHOUSE" "Lighthouse scores manuel" "WARN" "Lancer pnpm lighthouse + verifier 6-metriques-validation.md"
```



---

## GENERATION DU RAPPORT FINAL

```bash
echo ""
echo "================================================"
echo "GENERATION DU RAPPORT FINAL SPRINT 18"
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

## Jalon GO/NO-GO Sprint 18

EOF

# Calcul statut final
if (( $(echo "$SCORE >= 95" | bc -l) )); then
  STATUT="GO"
  cat >> "$REPORT_FILE" << EOF
**STATUT** : GO -- Sprint 18 valide, passage Sprint 19 autorise

Le sprint a passe les criteres requis. Cowork peut demarrer Sprint 19.

EOF
  echo ""
  echo "================================================"
  echo "SPRINT 18 : GO ($SCORE%)"
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
  echo "SPRINT 18 : GO CONDITIONNEL ($SCORE%)"
  echo "================================================"
else
  STATUT="NO-GO"
  cat >> "$REPORT_FILE" << EOF
**STATUT** : NO-GO -- Score $SCORE% trop bas (cible 85% minimum)

Le sprint **doit etre repris** :
- Lister tous FAIL P0
- Escalation Saad/Abla decision (cut scope OR delai)
- Reprise sprint avant Sprint 19

EOF
  echo ""
  echo "================================================"
  echo "SPRINT 18 : NO-GO ($SCORE%)"
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
  echo "git commit -m \"chore(sprint-18): close sprint 18 -- $STATUT ($SCORE%)\"" >> "$REPORT_FILE"
  echo '```' >> "$REPORT_FILE"
fi

echo ""
echo "Rapport complet dans : $REPORT_FILE"
```

---

## INSTRUCTION FINALE A CLAUDE CODE / COWORK

Apres l'execution complete des verifications ci-dessus :

1. **Lis le contenu de `sprint18-verify-report.md`** integralement
2. **Identifie les FAIL critiques** (criteres P0) qui necessitent intervention manuelle
3. **Affiche un resume executif** :
   - Nombre total de criteres
   - Pourcentage PASS / PASS\* / FAIL / WARN
   - Liste des FAIL avec contexte technique
   - Recommandation : GO / GO CONDITIONNEL / NO-GO
4. **Si NO-GO** : ne pas demarrer le Sprint suivant, alerter Saad/Abla via Slack `#insurtech-dev`
5. **Si GO ou GO CONDITIONNEL** : produire le commit de cloture du sprint :

```bash
git add skalean-insurtech/sprint18-verify-report.md
git commit -m "chore(sprint-18): close sprint 18 with verification report

- Verification automatique executee
- Score global : <SCORE>%
- <PASS> criteres PASS, <PASS_REPAIRED> reparations auto, <FAIL> FAIL
- Statut : <GO|GO CONDITIONNEL|NO-GO>

Phase: 4 -- Vertical Insure (Skalean Broker ERP)
Sprint: 18 (Phase 4 / Sprint 5)
Reference B-18, C-18, V-18
Report: sprint18-verify-report.md"
```

6. **Documentation continue** : si decisions techniques prises pendant verification, ajouter notes dans `repo/docs/runbooks/sprint-18-lessons-learned.md`

---

**Fin de la verification V-18 v2.2 detaillee -- Sprint 18 (4.5) Web Assure Portal + Mobile PWA.**

**Total criteres taches** : 70 | **Total transversaux** : ~10 | **Effort sprint** : 85h
