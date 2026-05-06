# VERIFICATION SPRINT 23 -- Phase 5 / Sprint 5 : Web Garage Mobile PWA + WebAuthn
# Version : Auto-reparation active + Rapport final MD detaille
# 12 taches, 63 criteres extraits B-23
# AUCUNE EMOJI AUTORISEE

**Version** : v2.2 (verification detaillee)
**Phase** : 5 -- Vertical Repair (Skalean Garage ERP)
**Sprint** : 23 / 35 (cumul) -- Sprint 5 dans Phase 5
**Reference meta-prompt** : `B-23-sprint-23-web-garage-mobile.md`
**Reference orchestrateur** : `C-23-sprint-23-web-garage-mobile.md`
**Total criteres** : 63 criteres taches + ~10 transversaux

---

Tu es **Claude Code (ou Cowork)**. Tu dois executer une **verification COMPLETE et EXHAUSTIVE** du Sprint 23 apres execution toutes les 12 taches.

---

## REGLES D'EXECUTION

1. Tu **executes CHAQUE verification dans l'ordre** (taches puis transversales)
2. Quand une verification echoue, tu **TENTES UNE REPARATION AUTOMATIQUE** avant de noter FAIL
3. Apres chaque tentative de reparation, tu **re-executes la verification**
4. Tu consignes dans `sprint23-verify-report.md` **TOUS les resultats** au fil de l'execution
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
REPORT_FILE="sprint23-verify-report.md"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
RUN_ID=$(date '+%Y%m%d-%H%M%S')

cat > "$REPORT_FILE" << EOF
# Rapport de Verification - Sprint 23 : Web Garage Mobile PWA + WebAuthn

**Date** : $TIMESTAMP
**Run ID** : $RUN_ID
**Phase** : 5 -- Vertical Repair (Skalean Garage ERP)
**Sprint** : 23 (Phase 5 / Sprint 5)
**Reference B-23** : 12 taches, 63 criteres extraits
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

## VERIFICATIONS PAR TACHE (12 taches)

## TACHE 1/5 -- 5.5.1 : App Skeleton PWA Reuse Sprint 18 Pattern

```bash
echo ""
echo "================================================"
echo "TACHE 5.5.1 : App Skeleton PWA Reuse Sprint 18 Pattern"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T01-F2: Existence fichier repo/apps/web-garage-mobile/public/manifest.json
if [ -f "repo/apps/web-garage-mobile/public/manifest.json" ]; then
  add_row "T01-F2" "Fichier manifest.json existe" "PASS" "Cree"
else
  add_row "T01-F2" "Fichier manifest.json existe" "FAIL" "Manquant"
fi
# Test T01-F3: Existence fichier repo/apps/web-garage-mobile/app/sw.ts
if [ -f "repo/apps/web-garage-mobile/app/sw.ts" ]; then
  add_row "T01-F3" "Fichier sw.ts existe" "PASS" "Cree"
else
  add_row "T01-F3" "Fichier sw.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T01-V1: App demarre port 3003 (P0)
echo "  Verifying T01-V1 : App demarre port 3003..."
add_row "T01-V1" "App demarre port 3003" "WARN" "(P0) Voir B-23 Tache 5.5.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V2: Manifest installable (P0)
echo "  Verifying T01-V2 : Manifest installable..."
add_row "T01-V2" "Manifest installable" "WARN" "(P0) Voir B-23 Tache 5.5.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V3: Service worker registered (P0)
echo "  Verifying T01-V3 : Service worker registered..."
add_row "T01-V3" "Service worker registered" "WARN" "(P0) Voir B-23 Tache 5.5.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V4: Package shared utilisable (P0)
echo "  Verifying T01-V4 : Package shared utilisable..."
add_row "T01-V4" "Package shared utilisable" "WARN" "(P0) Voir B-23 Tache 5.5.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V5: Tests setup 5+ scenarios (P0)
echo "  Verifying T01-V5 : Tests setup 5+ scenarios..."
add_row "T01-V5" "Tests setup 5+ scenarios" "WARN" "(P0) Voir B-23 Tache 5.5.1 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 2/6 -- 5.5.2 : Auth Simplifiee : Pin + Biometric

```bash
echo ""
echo "================================================"
echo "TACHE 5.5.2 : Auth Simplifiee : Pin + Biometric"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 6"
echo "================================================"

# === Verification fichiers crees ===
# Test T02-F1: Existence fichier repo/packages/database/src/migrations/{date}-AuthUserPinsCredentials.ts
if [ -f "repo/packages/database/src/migrations/{date}-AuthUserPinsCredentials.ts" ]; then
  add_row "T02-F1" "Fichier {date}-AuthUserPinsCredentials.ts existe" "PASS" "Cree"
else
  add_row "T02-F1" "Fichier {date}-AuthUserPinsCredentials.ts existe" "FAIL" "Manquant"
fi
# Test T02-F2: Existence fichier repo/packages/auth/src/services/pin-auth.service.ts
if [ -f "repo/packages/auth/src/services/pin-auth.service.ts" ]; then
  add_row "T02-F2" "Fichier pin-auth.service.ts existe" "PASS" "Cree"
else
  add_row "T02-F2" "Fichier pin-auth.service.ts existe" "FAIL" "Manquant"
fi
# Test T02-F3: Existence fichier repo/packages/auth/src/services/biometric-auth.service.ts
if [ -f "repo/packages/auth/src/services/biometric-auth.service.ts" ]; then
  add_row "T02-F3" "Fichier biometric-auth.service.ts existe" "PASS" "Cree"
else
  add_row "T02-F3" "Fichier biometric-auth.service.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T02-V1: Setup pin OK (P0)
echo "  Verifying T02-V1 : Setup pin OK..."
add_row "T02-V1" "Setup pin OK" "WARN" "(P0) Voir B-23 Tache 5.5.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V2: Verify pin -> JWT (P0)
echo "  Verifying T02-V2 : Verify pin -> JWT..."
add_row "T02-V2" "Verify pin -> JWT" "WARN" "(P0) Voir B-23 Tache 5.5.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V3: Setup biometric WebAuthn (P0)
echo "  Verifying T02-V3 : Setup biometric WebAuthn..."
add_row "T02-V3" "Setup biometric WebAuthn" "WARN" "(P0) Voir B-23 Tache 5.5.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V4: Verify biometric -> JWT (P0)
echo "  Verifying T02-V4 : Verify biometric -> JWT..."
add_row "T02-V4" "Verify biometric -> JWT" "WARN" "(P0) Voir B-23 Tache 5.5.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V5: Pin oublie fallback login email (P0)
echo "  Verifying T02-V5 : Pin oublie fallback login email..."
add_row "T02-V5" "Pin oublie fallback login email" "WARN" "(P0) Voir B-23 Tache 5.5.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V6: Tests 8+ scenarios (P0)
echo "  Verifying T02-V6 : Tests 8+ scenarios..."
add_row "T02-V6" "Tests 8+ scenarios" "WARN" "(P0) Voir B-23 Tache 5.5.2 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 3/5 -- 5.5.3 : Layout Mobile : Bottom Nav

```bash
echo ""
echo "================================================"
echo "TACHE 5.5.3 : Layout Mobile : Bottom Nav"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T03-F1: Existence fichier repo/apps/web-garage-mobile/app/[locale]/(protected)/layout.tsx
if [ -f "repo/apps/web-garage-mobile/app/[locale]/(protected)/layout.tsx" ]; then
  add_row "T03-F1" "Fichier layout.tsx existe" "PASS" "Cree"
else
  add_row "T03-F1" "Fichier layout.tsx existe" "FAIL" "Manquant"
fi
# Test T03-F2: Existence fichier repo/apps/web-garage-mobile/components/layout/bottom-nav.tsx
if [ -f "repo/apps/web-garage-mobile/components/layout/bottom-nav.tsx" ]; then
  add_row "T03-F2" "Fichier bottom-nav.tsx existe" "PASS" "Cree"
else
  add_row "T03-F2" "Fichier bottom-nav.tsx existe" "FAIL" "Manquant"
fi
# Test T03-F3: Existence fichier repo/apps/web-garage-mobile/components/layout/mobile-topbar.tsx
if [ -f "repo/apps/web-garage-mobile/components/layout/mobile-topbar.tsx" ]; then
  add_row "T03-F3" "Fichier mobile-topbar.tsx existe" "PASS" "Cree"
else
  add_row "T03-F3" "Fichier mobile-topbar.tsx existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T03-V1: Bottom nav 5 tabs (P0)
echo "  Verifying T03-V1 : Bottom nav 5 tabs..."
add_row "T03-V1" "Bottom nav 5 tabs" "WARN" "(P0) Voir B-23 Tache 5.5.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V2: Topbar compact (P0)
echo "  Verifying T03-V2 : Topbar compact..."
add_row "T03-V2" "Topbar compact" "WARN" "(P0) Voir B-23 Tache 5.5.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V3: FAB context-sensitive (P0)
echo "  Verifying T03-V3 : FAB context-sensitive..."
add_row "T03-V3" "FAB context-sensitive" "WARN" "(P0) Voir B-23 Tache 5.5.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V4: Safe areas (P0)
echo "  Verifying T03-V4 : Safe areas..."
add_row "T03-V4" "Safe areas" "WARN" "(P0) Voir B-23 Tache 5.5.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V5: Tests 5+ scenarios (P0)
echo "  Verifying T03-V5 : Tests 5+ scenarios..."
add_row "T03-V5" "Tests 5+ scenarios" "WARN" "(P0) Voir B-23 Tache 5.5.3 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 4/5 -- 5.5.4 : Page "Aujourd'hui"

```bash
echo ""
echo "================================================"
echo "TACHE 5.5.4 : Page "Aujourd'hui""
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T04-F1: Existence fichier repo/apps/web-garage-mobile/app/[locale]/(protected)/today/page.tsx
if [ -f "repo/apps/web-garage-mobile/app/[locale]/(protected)/today/page.tsx" ]; then
  add_row "T04-F1" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T04-F1" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T04-F2: Existence fichier repo/apps/web-garage-mobile/components/today/{several sections}.tsx
if [ -f "repo/apps/web-garage-mobile/components/today/{several sections}.tsx" ]; then
  add_row "T04-F2" "Fichier {several sections}.tsx existe" "PASS" "Cree"
else
  add_row "T04-F2" "Fichier {several sections}.tsx existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T04-V1: Sections complete (P0)
echo "  Verifying T04-V1 : Sections complete..."
add_row "T04-V1" "Sections complete" "WARN" "(P0) Voir B-23 Tache 5.5.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V2: Data quick fetch (P0)
echo "  Verifying T04-V2 : Data quick fetch..."
add_row "T04-V2" "Data quick fetch" "WARN" "(P0) Voir B-23 Tache 5.5.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V3: Tap navigation (P0)
echo "  Verifying T04-V3 : Tap navigation..."
add_row "T04-V3" "Tap navigation" "WARN" "(P0) Voir B-23 Tache 5.5.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V4: Pull-to-refresh (P0)
echo "  Verifying T04-V4 : Pull-to-refresh..."
add_row "T04-V4" "Pull-to-refresh" "WARN" "(P0) Voir B-23 Tache 5.5.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V5: Tests 5+ scenarios (P0)
echo "  Verifying T04-V5 : Tests 5+ scenarios..."
add_row "T04-V5" "Tests 5+ scenarios" "WARN" "(P0) Voir B-23 Tache 5.5.4 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 5/5 -- 5.5.5 : Page Detail Order Mobile

```bash
echo ""
echo "================================================"
echo "TACHE 5.5.5 : Page Detail Order Mobile"
echo "Priorite : P0 | Effort : 7h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T05-F1: Existence fichier repo/apps/web-garage-mobile/app/[locale]/(protected)/orders/[id]/page.tsx
if [ -f "repo/apps/web-garage-mobile/app/[locale]/(protected)/orders/[id]/page.tsx" ]; then
  add_row "T05-F1" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T05-F1" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T05-F2: Existence fichier repo/apps/web-garage-mobile/components/orders/order-mobile-detail.tsx
if [ -f "repo/apps/web-garage-mobile/components/orders/order-mobile-detail.tsx" ]; then
  add_row "T05-F2" "Fichier order-mobile-detail.tsx existe" "PASS" "Cree"
else
  add_row "T05-F2" "Fichier order-mobile-detail.tsx existe" "FAIL" "Manquant"
fi
# Test T05-F3: Existence fichier repo/apps/web-garage-mobile/components/orders/tasks-mobile-checklist.tsx
if [ -f "repo/apps/web-garage-mobile/components/orders/tasks-mobile-checklist.tsx" ]; then
  add_row "T05-F3" "Fichier tasks-mobile-checklist.tsx existe" "PASS" "Cree"
else
  add_row "T05-F3" "Fichier tasks-mobile-checklist.tsx existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T05-V1: Page complete sections (P0)
echo "  Verifying T05-V1 : Page complete sections..."
add_row "T05-V1" "Page complete sections" "WARN" "(P0) Voir B-23 Tache 5.5.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V2: Tap task mark completed (P0)
echo "  Verifying T05-V2 : Tap task mark completed..."
add_row "T05-V2" "Tap task mark completed" "WARN" "(P0) Voir B-23 Tache 5.5.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V3: Quick actions FAB (P0)
echo "  Verifying T05-V3 : Quick actions FAB..."
add_row "T05-V3" "Quick actions FAB" "WARN" "(P0) Voir B-23 Tache 5.5.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V4: Optimistic UI (P0)
echo "  Verifying T05-V4 : Optimistic UI..."
add_row "T05-V4" "Optimistic UI" "WARN" "(P0) Voir B-23 Tache 5.5.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V5: Tests 8+ scenarios (P0)
echo "  Verifying T05-V5 : Tests 8+ scenarios..."
add_row "T05-V5" "Tests 8+ scenarios" "WARN" "(P0) Voir B-23 Tache 5.5.5 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 6/5 -- 5.5.6 : Reception Mobile : Camera Direct

```bash
echo ""
echo "================================================"
echo "TACHE 5.5.6 : Reception Mobile : Camera Direct"
echo "Priorite : P0 | Effort : 7h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T06-F1: Existence fichier repo/apps/web-garage-mobile/app/[locale]/(protected)/sinistres/[id]/reception/page.tsx
if [ -f "repo/apps/web-garage-mobile/app/[locale]/(protected)/sinistres/[id]/reception/page.tsx" ]; then
  add_row "T06-F1" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T06-F1" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T06-F2: Existence fichier repo/apps/web-garage-mobile/components/reception/mobile-camera-capture.tsx
if [ -f "repo/apps/web-garage-mobile/components/reception/mobile-camera-capture.tsx" ]; then
  add_row "T06-F2" "Fichier mobile-camera-capture.tsx existe" "PASS" "Cree"
else
  add_row "T06-F2" "Fichier mobile-camera-capture.tsx existe" "FAIL" "Manquant"
fi
# Test T06-F3: Existence fichier repo/apps/web-garage-mobile/components/reception/checklist-mobile-swipe.tsx
if [ -f "repo/apps/web-garage-mobile/components/reception/checklist-mobile-swipe.tsx" ]; then
  add_row "T06-F3" "Fichier checklist-mobile-swipe.tsx existe" "PASS" "Cree"
else
  add_row "T06-F3" "Fichier checklist-mobile-swipe.tsx existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T06-V1: Camera direct multi-photo (P0)
echo "  Verifying T06-V1 : Camera direct multi-photo..."
add_row "T06-V1" "Camera direct multi-photo" "WARN" "(P0) Voir B-23 Tache 5.5.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V2: Checklist swipe UI (P0)
echo "  Verifying T06-V2 : Checklist swipe UI..."
add_row "T06-V2" "Checklist swipe UI" "WARN" "(P0) Voir B-23 Tache 5.5.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V3: Signature pad (P0)
echo "  Verifying T06-V3 : Signature pad..."
add_row "T06-V3" "Signature pad" "WARN" "(P0) Voir B-23 Tache 5.5.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V4: Save draft (P0)
echo "  Verifying T06-V4 : Save draft..."
add_row "T06-V4" "Save draft" "WARN" "(P0) Voir B-23 Tache 5.5.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V5: Tests 6+ scenarios (P0)
echo "  Verifying T06-V5 : Tests 6+ scenarios..."
add_row "T06-V5" "Tests 6+ scenarios" "WARN" "(P0) Voir B-23 Tache 5.5.6 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 7/5 -- 5.5.7 : Diagnostic Photos Mobile

```bash
echo ""
echo "================================================"
echo "TACHE 5.5.7 : Diagnostic Photos Mobile"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T07-F1: Existence fichier repo/apps/web-garage-mobile/app/[locale]/(protected)/sinistres/[id]/diagnostic/page.tsx
if [ -f "repo/apps/web-garage-mobile/app/[locale]/(protected)/sinistres/[id]/diagnostic/page.tsx" ]; then
  add_row "T07-F1" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T07-F1" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T07-F2: Existence fichier repo/apps/web-garage-mobile/components/diagnostic/photos-burst.tsx
if [ -f "repo/apps/web-garage-mobile/components/diagnostic/photos-burst.tsx" ]; then
  add_row "T07-F2" "Fichier photos-burst.tsx existe" "PASS" "Cree"
else
  add_row "T07-F2" "Fichier photos-burst.tsx existe" "FAIL" "Manquant"
fi
# Test T07-F3: Existence fichier repo/apps/web-garage-mobile/components/diagnostic/ia-suggestions-mobile.tsx
if [ -f "repo/apps/web-garage-mobile/components/diagnostic/ia-suggestions-mobile.tsx" ]; then
  add_row "T07-F3" "Fichier ia-suggestions-mobile.tsx existe" "PASS" "Cree"
else
  add_row "T07-F3" "Fichier ia-suggestions-mobile.tsx existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T07-V1: Camera burst photos (P0)
echo "  Verifying T07-V1 : Camera burst photos..."
add_row "T07-V1" "Camera burst photos" "WARN" "(P0) Voir B-23 Tache 5.5.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V2: IA suggestions display (P0)
echo "  Verifying T07-V2 : IA suggestions display..."
add_row "T07-V2" "IA suggestions display" "WARN" "(P0) Voir B-23 Tache 5.5.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V3: Validation actions (P0)
echo "  Verifying T07-V3 : Validation actions..."
add_row "T07-V3" "Validation actions" "WARN" "(P0) Voir B-23 Tache 5.5.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V4: Notes voice-to-text (P0)
echo "  Verifying T07-V4 : Notes voice-to-text..."
add_row "T07-V4" "Notes voice-to-text" "WARN" "(P0) Voir B-23 Tache 5.5.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V5: Tests 6+ scenarios (P0)
echo "  Verifying T07-V5 : Tests 6+ scenarios..."
add_row "T07-V5" "Tests 6+ scenarios" "WARN" "(P0) Voir B-23 Tache 5.5.7 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 8/6 -- 5.5.8 : Hours Timer Real-Time + Offline Log

```bash
echo ""
echo "================================================"
echo "TACHE 5.5.8 : Hours Timer Real-Time + Offline Log"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 6"
echo "================================================"

# === Verification fichiers crees ===
# Test T08-F1: Existence fichier repo/apps/web-garage-mobile/lib/timer/hours-timer.ts
if [ -f "repo/apps/web-garage-mobile/lib/timer/hours-timer.ts" ]; then
  add_row "T08-F1" "Fichier hours-timer.ts existe" "PASS" "Cree"
else
  add_row "T08-F1" "Fichier hours-timer.ts existe" "FAIL" "Manquant"
fi
# Test T08-F2: Existence fichier repo/apps/web-garage-mobile/lib/timer/timer-sync-queue.ts
if [ -f "repo/apps/web-garage-mobile/lib/timer/timer-sync-queue.ts" ]; then
  add_row "T08-F2" "Fichier timer-sync-queue.ts existe" "PASS" "Cree"
else
  add_row "T08-F2" "Fichier timer-sync-queue.ts existe" "FAIL" "Manquant"
fi
# Test T08-F3: Existence fichier repo/apps/web-garage-mobile/components/timer/hours-timer-ui.tsx
if [ -f "repo/apps/web-garage-mobile/components/timer/hours-timer-ui.tsx" ]; then
  add_row "T08-F3" "Fichier hours-timer-ui.tsx existe" "PASS" "Cree"
else
  add_row "T08-F3" "Fichier hours-timer-ui.tsx existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T08-V1: Timer accuracy 1s (P0)
echo "  Verifying T08-V1 : Timer accuracy 1s..."
add_row "T08-V1" "Timer accuracy 1s" "WARN" "(P0) Voir B-23 Tache 5.5.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V2: Auto-pause 5min (P0)
echo "  Verifying T08-V2 : Auto-pause 5min..."
add_row "T08-V2" "Auto-pause 5min" "WARN" "(P0) Voir B-23 Tache 5.5.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V3: Persist localStorage (P0)
echo "  Verifying T08-V3 : Persist localStorage..."
add_row "T08-V3" "Persist localStorage" "WARN" "(P0) Voir B-23 Tache 5.5.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V4: Offline queue + sync online (P0)
echo "  Verifying T08-V4 : Offline queue + sync online..."
add_row "T08-V4" "Offline queue + sync online" "WARN" "(P0) Voir B-23 Tache 5.5.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V5: Background sync service worker (P0)
echo "  Verifying T08-V5 : Background sync service worker..."
add_row "T08-V5" "Background sync service worker" "WARN" "(P0) Voir B-23 Tache 5.5.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V6: Tests 10+ scenarios (P0)
echo "  Verifying T08-V6 : Tests 10+ scenarios..."
add_row "T08-V6" "Tests 10+ scenarios" "WARN" "(P0) Voir B-23 Tache 5.5.8 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 9/5 -- 5.5.9 : Quick QC Checklist Mobile

```bash
echo ""
echo "================================================"
echo "TACHE 5.5.9 : Quick QC Checklist Mobile"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T09-F1: Existence fichier repo/apps/web-garage-mobile/app/[locale]/(protected)/sinistres/[id]/qc/page.tsx
if [ -f "repo/apps/web-garage-mobile/app/[locale]/(protected)/sinistres/[id]/qc/page.tsx" ]; then
  add_row "T09-F1" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T09-F1" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T09-F2: Existence fichier repo/apps/web-garage-mobile/components/qc/qc-mobile-swipe.tsx
if [ -f "repo/apps/web-garage-mobile/components/qc/qc-mobile-swipe.tsx" ]; then
  add_row "T09-F2" "Fichier qc-mobile-swipe.tsx existe" "PASS" "Cree"
else
  add_row "T09-F2" "Fichier qc-mobile-swipe.tsx existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T09-V1: 10 points checklist swipe (P0)
echo "  Verifying T09-V1 : 10 points checklist swipe..."
add_row "T09-V1" "10 points checklist swipe" "WARN" "(P0) Voir B-23 Tache 5.5.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V2: Photos after (P0)
echo "  Verifying T09-V2 : Photos after..."
add_row "T09-V2" "Photos after" "WARN" "(P0) Voir B-23 Tache 5.5.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V3: Signature pad (P0)
echo "  Verifying T09-V3 : Signature pad..."
add_row "T09-V3" "Signature pad" "WARN" "(P0) Voir B-23 Tache 5.5.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V4: Save progressif (P0)
echo "  Verifying T09-V4 : Save progressif..."
add_row "T09-V4" "Save progressif" "WARN" "(P0) Voir B-23 Tache 5.5.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V5: Tests 5+ scenarios (P0)
echo "  Verifying T09-V5 : Tests 5+ scenarios..."
add_row "T09-V5" "Tests 5+ scenarios" "WARN" "(P0) Voir B-23 Tache 5.5.9 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 10/6 -- 5.5.10 : Service Worker Offline Cache + Background Sync

```bash
echo ""
echo "================================================"
echo "TACHE 5.5.10 : Service Worker Offline Cache + Background Sync"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 6"
echo "================================================"

# === Verification fichiers crees ===
# Test T10-F1: Existence fichier repo/apps/web-garage-mobile/app/sw.ts
if [ -f "repo/apps/web-garage-mobile/app/sw.ts" ]; then
  add_row "T10-F1" "Fichier sw.ts existe" "PASS" "Cree"
else
  add_row "T10-F1" "Fichier sw.ts existe" "FAIL" "Manquant"
fi
# Test T10-F2: Existence fichier repo/apps/web-garage-mobile/lib/sync/sync-queue.ts
if [ -f "repo/apps/web-garage-mobile/lib/sync/sync-queue.ts" ]; then
  add_row "T10-F2" "Fichier sync-queue.ts existe" "PASS" "Cree"
else
  add_row "T10-F2" "Fichier sync-queue.ts existe" "FAIL" "Manquant"
fi
# Test T10-F3: Existence fichier repo/apps/web-garage-mobile/app/[locale]/(protected)/sync-status/page.tsx
if [ -f "repo/apps/web-garage-mobile/app/[locale]/(protected)/sync-status/page.tsx" ]; then
  add_row "T10-F3" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T10-F3" "Fichier page.tsx existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T10-V1: Cache static + API (P0)
echo "  Verifying T10-V1 : Cache static + API..."
add_row "T10-V1" "Cache static + API" "WARN" "(P0) Voir B-23 Tache 5.5.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V2: 3 background sync types (P0)
echo "  Verifying T10-V2 : 3 background sync types..."
add_row "T10-V2" "3 background sync types" "WARN" "(P0) Voir B-23 Tache 5.5.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V3: Offline page (P0)
echo "  Verifying T10-V3 : Offline page..."
add_row "T10-V3" "Offline page" "WARN" "(P0) Voir B-23 Tache 5.5.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V4: Sync queue UI (P0)
echo "  Verifying T10-V4 : Sync queue UI..."
add_row "T10-V4" "Sync queue UI" "WARN" "(P0) Voir B-23 Tache 5.5.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V5: Conflict resolution (P0)
echo "  Verifying T10-V5 : Conflict resolution..."
add_row "T10-V5" "Conflict resolution" "WARN" "(P0) Voir B-23 Tache 5.5.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V6: Tests offline 8+ scenarios (P0)
echo "  Verifying T10-V6 : Tests offline 8+ scenarios..."
add_row "T10-V6" "Tests offline 8+ scenarios" "WARN" "(P0) Voir B-23 Tache 5.5.10 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 11/5 -- 5.5.11 : Push Notifications + Voice-to-Text

```bash
echo ""
echo "================================================"
echo "TACHE 5.5.11 : Push Notifications + Voice-to-Text"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T11-F1: Existence fichier repo/apps/web-garage-mobile/lib/voice/voice-to-text.ts
if [ -f "repo/apps/web-garage-mobile/lib/voice/voice-to-text.ts" ]; then
  add_row "T11-F1" "Fichier voice-to-text.ts existe" "PASS" "Cree"
else
  add_row "T11-F1" "Fichier voice-to-text.ts existe" "FAIL" "Manquant"
fi
# Test T11-F2: Existence fichier repo/apps/web-garage-mobile/components/voice/voice-input.tsx
if [ -f "repo/apps/web-garage-mobile/components/voice/voice-input.tsx" ]; then
  add_row "T11-F2" "Fichier voice-input.tsx existe" "PASS" "Cree"
else
  add_row "T11-F2" "Fichier voice-input.tsx existe" "FAIL" "Manquant"
fi
# Test T11-F3: Existence fichier repo/apps/web-garage-mobile/components/notifications/push-prompt.tsx
if [ -f "repo/apps/web-garage-mobile/components/notifications/push-prompt.tsx" ]; then
  add_row "T11-F3" "Fichier push-prompt.tsx existe" "PASS" "Cree"
else
  add_row "T11-F3" "Fichier push-prompt.tsx existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T11-V1: Push subscription (P0)
echo "  Verifying T11-V1 : Push subscription..."
add_row "T11-V1" "Push subscription" "WARN" "(P0) Voir B-23 Tache 5.5.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V2: 4 event types push (P0)
echo "  Verifying T11-V2 : 4 event types push..."
add_row "T11-V2" "4 event types push" "WARN" "(P0) Voir B-23 Tache 5.5.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V3: Voice-to-text fr/ar (P0)
echo "  Verifying T11-V3 : Voice-to-text fr/ar..."
add_row "T11-V3" "Voice-to-text fr/ar" "WARN" "(P0) Voir B-23 Tache 5.5.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V4: Fallback if not supported (P0)
echo "  Verifying T11-V4 : Fallback if not supported..."
add_row "T11-V4" "Fallback if not supported" "WARN" "(P0) Voir B-23 Tache 5.5.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V5: Tests 5+ scenarios (P0)
echo "  Verifying T11-V5 : Tests 5+ scenarios..."
add_row "T11-V5" "Tests 5+ scenarios" "WARN" "(P0) Voir B-23 Tache 5.5.11 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 12/5 -- 5.5.12 : Tests Playwright Mobile + Lighthouse PWA

```bash
echo ""
echo "================================================"
echo "TACHE 5.5.12 : Tests Playwright Mobile + Lighthouse PWA"
echo "Priorite : P0 | Effort : 8h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T12-F1: Existence fichier repo/apps/web-garage-mobile/e2e/{15+ specs}.spec.ts
if [ -f "repo/apps/web-garage-mobile/e2e/{15+ specs}.spec.ts" ]; then
  add_row "T12-F1" "Fichier {15+ specs}.spec.ts existe" "PASS" "Cree"
else
  add_row "T12-F1" "Fichier {15+ specs}.spec.ts existe" "FAIL" "Manquant"
fi
# Test T12-F2: Existence fichier repo/apps/web-garage-mobile/playwright.config.ts
if [ -f "repo/apps/web-garage-mobile/playwright.config.ts" ]; then
  add_row "T12-F2" "Fichier playwright.config.ts existe" "PASS" "Cree"
else
  add_row "T12-F2" "Fichier playwright.config.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T12-V1: 15+ tests passent (P0)
echo "  Verifying T12-V1 : 15+ tests passent..."
add_row "T12-V1" "15+ tests passent" "WARN" "(P0) Voir B-23 Tache 5.5.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V2: Lighthouse PWA 100 (P0)
echo "  Verifying T12-V2 : Lighthouse PWA 100..."
add_row "T12-V2" "Lighthouse PWA 100" "WARN" "(P0) Voir B-23 Tache 5.5.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V3: Mobile viewports OK (P0)
echo "  Verifying T12-V3 : Mobile viewports OK..."
add_row "T12-V3" "Mobile viewports OK" "WARN" "(P0) Voir B-23 Tache 5.5.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V4: CI green (P0)
echo "  Verifying T12-V4 : CI green..."
add_row "T12-V4" "CI green" "WARN" "(P0) Voir B-23 Tache 5.5.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V5: Reproducibility 5x (P0)
echo "  Verifying T12-V5 : Reproducibility 5x..."
add_row "T12-V5" "Reproducibility 5x" "WARN" "(P0) Voir B-23 Tache 5.5.12 pour test detaille - critere a auto-tester via script ad-hoc"

```

---


---


## VERIFICATIONS TRANSVERSALES SPRINT 23

### TR-BUILD : Build complet du sprint

```bash
echo ""
echo "================================================"
echo "VERIFICATIONS TRANSVERSALES SPRINT 23"
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

### TR-MIGRATIONS : Migrations DB Sprint 23

```bash
echo "=== TR-MIGRATIONS : Migrations DB ==="
MIGR_COUNT=$(pg_query "SELECT COUNT(*) FROM migrations WHERE name LIKE '%sprint23%' OR name LIKE '%Sprint23%'" || echo 0)
if [ "$MIGR_COUNT" -gt 0 ]; then
  add_row "TR-MIG" "Migrations Sprint 23 appliquees" "PASS" "$MIGR_COUNT migrations"
else
  add_row "TR-MIG" "Migrations Sprint 23 appliquees" "WARN" "Aucune migration detectee (verifier)"
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

### TR-LIGHTHOUSE : Cibles Lighthouse Sprint 23

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
echo "GENERATION DU RAPPORT FINAL SPRINT 23"
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

## Jalon GO/NO-GO Sprint 23

EOF

# Calcul statut final
if (( $(echo "$SCORE >= 95" | bc -l) )); then
  STATUT="GO"
  cat >> "$REPORT_FILE" << EOF
**STATUT** : GO -- Sprint 23 valide, passage Sprint 24 autorise

Le sprint a passe les criteres requis. Cowork peut demarrer Sprint 24.

EOF
  echo ""
  echo "================================================"
  echo "SPRINT 23 : GO ($SCORE%)"
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
  echo "SPRINT 23 : GO CONDITIONNEL ($SCORE%)"
  echo "================================================"
else
  STATUT="NO-GO"
  cat >> "$REPORT_FILE" << EOF
**STATUT** : NO-GO -- Score $SCORE% trop bas (cible 85% minimum)

Le sprint **doit etre repris** :
- Lister tous FAIL P0
- Escalation Saad/Abla decision (cut scope OR delai)
- Reprise sprint avant Sprint 24

EOF
  echo ""
  echo "================================================"
  echo "SPRINT 23 : NO-GO ($SCORE%)"
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
  echo "git commit -m \"chore(sprint-23): close sprint 23 -- $STATUT ($SCORE%)\"" >> "$REPORT_FILE"
  echo '```' >> "$REPORT_FILE"
fi

echo ""
echo "Rapport complet dans : $REPORT_FILE"
```

---

## INSTRUCTION FINALE A CLAUDE CODE / COWORK

Apres l'execution complete des verifications ci-dessus :

1. **Lis le contenu de `sprint23-verify-report.md`** integralement
2. **Identifie les FAIL critiques** (criteres P0) qui necessitent intervention manuelle
3. **Affiche un resume executif** :
   - Nombre total de criteres
   - Pourcentage PASS / PASS\* / FAIL / WARN
   - Liste des FAIL avec contexte technique
   - Recommandation : GO / GO CONDITIONNEL / NO-GO
4. **Si NO-GO** : ne pas demarrer le Sprint suivant, alerter Saad/Abla via Slack `#insurtech-dev`
5. **Si GO ou GO CONDITIONNEL** : produire le commit de cloture du sprint :

```bash
git add skalean-insurtech/sprint23-verify-report.md
git commit -m "chore(sprint-23): close sprint 23 with verification report

- Verification automatique executee
- Score global : <SCORE>%
- <PASS> criteres PASS, <PASS_REPAIRED> reparations auto, <FAIL> FAIL
- Statut : <GO|GO CONDITIONNEL|NO-GO>

Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Sprint: 23 (Phase 5 / Sprint 5)
Reference B-23, C-23, V-23
Report: sprint23-verify-report.md"
```

6. **Documentation continue** : si decisions techniques prises pendant verification, ajouter notes dans `repo/docs/runbooks/sprint-23-lessons-learned.md`

---

**Fin de la verification V-23 v2.2 detaillee -- Sprint 23 (5.5) Web Garage Mobile PWA + WebAuthn.**

**Total criteres taches** : 63 | **Total transversaux** : ~10 | **Effort sprint** : 70h
