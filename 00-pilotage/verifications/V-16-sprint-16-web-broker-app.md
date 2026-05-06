# VERIFICATION SPRINT 16 -- Phase 4 / Sprint 3 : Web Broker App (port 3001)
# Version : Auto-reparation active + Rapport final MD detaille
# 14 taches, 83 criteres extraits B-16
# AUCUNE EMOJI AUTORISEE

**Version** : v2.2 (verification detaillee)
**Phase** : 4 -- Vertical Insure (Skalean Broker ERP)
**Sprint** : 16 / 35 (cumul) -- Sprint 3 dans Phase 4
**Reference meta-prompt** : `B-16-sprint-16-web-broker-app.md`
**Reference orchestrateur** : `C-16-sprint-16-web-broker-app.md`
**Total criteres** : 83 criteres taches + ~10 transversaux

---

Tu es **Claude Code (ou Cowork)**. Tu dois executer une **verification COMPLETE et EXHAUSTIVE** du Sprint 16 apres execution toutes les 14 taches.

---

## REGLES D'EXECUTION

1. Tu **executes CHAQUE verification dans l'ordre** (taches puis transversales)
2. Quand une verification echoue, tu **TENTES UNE REPARATION AUTOMATIQUE** avant de noter FAIL
3. Apres chaque tentative de reparation, tu **re-executes la verification**
4. Tu consignes dans `sprint16-verify-report.md` **TOUS les resultats** au fil de l'execution
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
REPORT_FILE="sprint16-verify-report.md"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
RUN_ID=$(date '+%Y%m%d-%H%M%S')

cat > "$REPORT_FILE" << EOF
# Rapport de Verification - Sprint 16 : Web Broker App (port 3001)

**Date** : $TIMESTAMP
**Run ID** : $RUN_ID
**Phase** : 4 -- Vertical Insure (Skalean Broker ERP)
**Sprint** : 16 (Phase 4 / Sprint 3)
**Reference B-16** : 14 taches, 83 criteres extraits
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

## TACHE 1/7 -- 4.3.1 : App Skeleton + Layouts + Middleware Auth

```bash
echo ""
echo "================================================"
echo "TACHE 4.3.1 : App Skeleton + Layouts + Middleware Auth"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 7"
echo "================================================"

# === Verification fichiers crees ===
# Test T01-F1: Existence fichier repo/apps/web-broker/app/layout.tsx
if [ -f "repo/apps/web-broker/app/layout.tsx" ]; then
  add_row "T01-F1" "Fichier layout.tsx existe" "PASS" "Cree"
else
  add_row "T01-F1" "Fichier layout.tsx existe" "FAIL" "Manquant"
fi
# Test T01-F2: Existence fichier repo/apps/web-broker/app/[locale]/(auth)/layout.tsx
if [ -f "repo/apps/web-broker/app/[locale]/(auth)/layout.tsx" ]; then
  add_row "T01-F2" "Fichier layout.tsx existe" "PASS" "Cree"
else
  add_row "T01-F2" "Fichier layout.tsx existe" "FAIL" "Manquant"
fi
# Test T01-F3: Existence fichier repo/apps/web-broker/app/[locale]/(protected)/layout.tsx
if [ -f "repo/apps/web-broker/app/[locale]/(protected)/layout.tsx" ]; then
  add_row "T01-F3" "Fichier layout.tsx existe" "PASS" "Cree"
else
  add_row "T01-F3" "Fichier layout.tsx existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T01-V1: App demarre sur port 3001 (P0)
echo "  Verifying T01-V1 : App demarre sur port 3001..."
add_row "T01-V1" "App demarre sur port 3001" "WARN" "(P0) Voir B-16 Tache 4.3.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V2: Middleware redirect non-auth -> /login (P0)
echo "  Verifying T01-V2 : Middleware redirect non-auth -> /login..."
add_row "T01-V2" "Middleware redirect non-auth -> /login" "WARN" "(P0) Voir B-16 Tache 4.3.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V3: Middleware locale detection + redirect URL (P0)
echo "  Verifying T01-V3 : Middleware locale detection + redirect URL..."
add_row "T01-V3" "Middleware locale detection + redirect URL" "WARN" "(P0) Voir B-16 Tache 4.3.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V4: Cookies tokens + tenant set after login (P0)
echo "  Verifying T01-V4 : Cookies tokens + tenant set after login..."
add_row "T01-V4" "Cookies tokens + tenant set after login" "WARN" "(P0) Voir B-16 Tache 4.3.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V5: x-tenant-id injecte requests API (P0)
echo "  Verifying T01-V5 : x-tenant-id injecte requests API..."
add_row "T01-V5" "x-tenant-id injecte requests API" "WARN" "(P0) Voir B-16 Tache 4.3.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V6: Providers wrappers fonctionnent (QueryClient + theme + toasts) (P0)
echo "  Verifying T01-V6 : Providers wrappers fonctionnent (QueryClient + theme + toasts)..."
add_row "T01-V6" "Providers wrappers fonctionnent (QueryClient + theme + toasts)" "WARN" "(P0) Voir B-16 Tache 4.3.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V7: Tests setup 6+ scenarios (P1)
echo "  Verifying T01-V7 : Tests setup 6+ scenarios..."
add_row "T01-V7" "Tests setup 6+ scenarios" "WARN" "(P1) Voir B-16 Tache 4.3.1 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 2/9 -- 4.3.2 : Pages Auth : Login + MFA + Signup + Recovery

```bash
echo ""
echo "================================================"
echo "TACHE 4.3.2 : Pages Auth : Login + MFA + Signup + Recovery"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 9"
echo "================================================"

# === Verification fichiers crees ===
# Test T02-F1: Existence fichier repo/apps/web-broker/app/[locale]/(auth)/login/page.tsx
if [ -f "repo/apps/web-broker/app/[locale]/(auth)/login/page.tsx" ]; then
  add_row "T02-F1" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T02-F1" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T02-F2: Existence fichier repo/apps/web-broker/app/[locale]/(auth)/verify-mfa/page.tsx
if [ -f "repo/apps/web-broker/app/[locale]/(auth)/verify-mfa/page.tsx" ]; then
  add_row "T02-F2" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T02-F2" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T02-F3: Existence fichier repo/apps/web-broker/app/[locale]/(auth)/signup/page.tsx
if [ -f "repo/apps/web-broker/app/[locale]/(auth)/signup/page.tsx" ]; then
  add_row "T02-F3" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T02-F3" "Fichier page.tsx existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T02-V1: Login email + password OK -> redirect /dashboard (P0)
echo "  Verifying T02-V1 : Login email + password OK -> redirect /dashboard..."
add_row "T02-V1" "Login email + password OK -> redirect /dashboard" "WARN" "(P0) Voir B-16 Tache 4.3.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V2: Login mauvais creds -> toast error (P0)
echo "  Verifying T02-V2 : Login mauvais creds -> toast error..."
add_row "T02-V2" "Login mauvais creds -> toast error" "WARN" "(P0) Voir B-16 Tache 4.3.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V3: Login MFA enabled -> redirect /verify-mfa (P0)
echo "  Verifying T02-V3 : Login MFA enabled -> redirect /verify-mfa..."
add_row "T02-V3" "Login MFA enabled -> redirect /verify-mfa" "WARN" "(P0) Voir B-16 Tache 4.3.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V4: MFA wrong code -> error (P0)
echo "  Verifying T02-V4 : MFA wrong code -> error..."
add_row "T02-V4" "MFA wrong code -> error" "WARN" "(P0) Voir B-16 Tache 4.3.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V5: Signup -> /email-sent (P0)
echo "  Verifying T02-V5 : Signup -> /email-sent..."
add_row "T02-V5" "Signup -> /email-sent" "WARN" "(P0) Voir B-16 Tache 4.3.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V6: Verify-email link -> /login + toast success (P0)
echo "  Verifying T02-V6 : Verify-email link -> /login + toast success..."
add_row "T02-V6" "Verify-email link -> /login + toast success" "WARN" "(P0) Voir B-16 Tache 4.3.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V7: Forgot + reset password complet (P0)
echo "  Verifying T02-V7 : Forgot + reset password complet..."
add_row "T02-V7" "Forgot + reset password complet" "WARN" "(P0) Voir B-16 Tache 4.3.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V8: Multi-tenant select-tenant page (P0)
echo "  Verifying T02-V8 : Multi-tenant select-tenant page..."
add_row "T02-V8" "Multi-tenant select-tenant page" "WARN" "(P0) Voir B-16 Tache 4.3.2 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 3/7 -- 4.3.3 : Layout Principal + Sidebar + Topbar + Tenant Switcher

```bash
echo ""
echo "================================================"
echo "TACHE 4.3.3 : Layout Principal + Sidebar + Topbar + Tenant Switcher"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 7"
echo "================================================"

# === Verification fichiers crees ===
# Test T03-F1: Existence fichier repo/apps/web-broker/components/layout/sidebar.tsx
if [ -f "repo/apps/web-broker/components/layout/sidebar.tsx" ]; then
  add_row "T03-F1" "Fichier sidebar.tsx existe" "PASS" "Cree"
else
  add_row "T03-F1" "Fichier sidebar.tsx existe" "FAIL" "Manquant"
fi
# Test T03-F2: Existence fichier repo/apps/web-broker/components/layout/topbar.tsx
if [ -f "repo/apps/web-broker/components/layout/topbar.tsx" ]; then
  add_row "T03-F2" "Fichier topbar.tsx existe" "PASS" "Cree"
else
  add_row "T03-F2" "Fichier topbar.tsx existe" "FAIL" "Manquant"
fi
# Test T03-F3: Existence fichier repo/apps/web-broker/components/layout/tenant-switcher.tsx
if [ -f "repo/apps/web-broker/components/layout/tenant-switcher.tsx" ]; then
  add_row "T03-F3" "Fichier tenant-switcher.tsx existe" "PASS" "Cree"
else
  add_row "T03-F3" "Fichier tenant-switcher.tsx existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T03-V1: Sidebar visible + navigation works (P0)
echo "  Verifying T03-V1 : Sidebar visible + navigation works..."
add_row "T03-V1" "Sidebar visible + navigation works" "WARN" "(P0) Voir B-16 Tache 4.3.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V2: Topbar all features (P0)
echo "  Verifying T03-V2 : Topbar all features..."
add_row "T03-V2" "Topbar all features" "WARN" "(P0) Voir B-16 Tache 4.3.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V3: Tenant switcher swap context (P0)
echo "  Verifying T03-V3 : Tenant switcher swap context..."
add_row "T03-V3" "Tenant switcher swap context" "WARN" "(P0) Voir B-16 Tache 4.3.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V4: Locale switcher swap fr/ar-MA/ar (P0)
echo "  Verifying T03-V4 : Locale switcher swap fr/ar-MA/ar..."
add_row "T03-V4" "Locale switcher swap fr/ar-MA/ar" "WARN" "(P0) Voir B-16 Tache 4.3.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V5: User menu logout works (P0)
echo "  Verifying T03-V5 : User menu logout works..."
add_row "T03-V5" "User menu logout works" "WARN" "(P0) Voir B-16 Tache 4.3.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V6: Responsive mobile (P0)
echo "  Verifying T03-V6 : Responsive mobile..."
add_row "T03-V6" "Responsive mobile" "WARN" "(P0) Voir B-16 Tache 4.3.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V7: Tests 8+ scenarios (P0)
echo "  Verifying T03-V7 : Tests 8+ scenarios..."
add_row "T03-V7" "Tests 8+ scenarios" "WARN" "(P0) Voir B-16 Tache 4.3.3 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 4/5 -- 4.3.4 : Dashboard Page : 6 Widgets

```bash
echo ""
echo "================================================"
echo "TACHE 4.3.4 : Dashboard Page : 6 Widgets"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T04-F1: Existence fichier repo/apps/web-broker/app/[locale]/(protected)/dashboard/page.tsx
if [ -f "repo/apps/web-broker/app/[locale]/(protected)/dashboard/page.tsx" ]; then
  add_row "T04-F1" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T04-F1" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T04-F2: Existence fichier repo/apps/web-broker/components/dashboard/{6 widgets}.tsx
if [ -f "repo/apps/web-broker/components/dashboard/{6 widgets}.tsx" ]; then
  add_row "T04-F2" "Fichier {6 widgets}.tsx existe" "PASS" "Cree"
else
  add_row "T04-F2" "Fichier {6 widgets}.tsx existe" "FAIL" "Manquant"
fi
# Test T04-F3: Existence fichier repo/apps/web-broker/components/dashboard/dashboard-filters.tsx
if [ -f "repo/apps/web-broker/components/dashboard/dashboard-filters.tsx" ]; then
  add_row "T04-F3" "Fichier dashboard-filters.tsx existe" "PASS" "Cree"
else
  add_row "T04-F3" "Fichier dashboard-filters.tsx existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T04-V1: 6 widgets render avec data (P0)
echo "  Verifying T04-V1 : 6 widgets render avec data..."
add_row "T04-V1" "6 widgets render avec data" "WARN" "(P0) Voir B-16 Tache 4.3.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V2: Filters apply across widgets (P0)
echo "  Verifying T04-V2 : Filters apply across widgets..."
add_row "T04-V2" "Filters apply across widgets" "WARN" "(P0) Voir B-16 Tache 4.3.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V3: Loading + empty states (P0)
echo "  Verifying T04-V3 : Loading + empty states..."
add_row "T04-V3" "Loading + empty states" "WARN" "(P0) Voir B-16 Tache 4.3.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V4: URL state synced (P0)
echo "  Verifying T04-V4 : URL state synced..."
add_row "T04-V4" "URL state synced" "WARN" "(P0) Voir B-16 Tache 4.3.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V5: Tests 6+ scenarios (P0)
echo "  Verifying T04-V5 : Tests 6+ scenarios..."
add_row "T04-V5" "Tests 6+ scenarios" "WARN" "(P0) Voir B-16 Tache 4.3.4 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 5/8 -- 4.3.5 : Contacts Page : List + Filters + Detail Timeline

```bash
echo ""
echo "================================================"
echo "TACHE 4.3.5 : Contacts Page : List + Filters + Detail Timeline"
echo "Priorite : P0 | Effort : 7h"
echo "Criteres a verifier : 8"
echo "================================================"

# === Verification fichiers crees ===
# Test T05-F1: Existence fichier repo/apps/web-broker/app/[locale]/(protected)/contacts/page.tsx
if [ -f "repo/apps/web-broker/app/[locale]/(protected)/contacts/page.tsx" ]; then
  add_row "T05-F1" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T05-F1" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T05-F2: Existence fichier repo/apps/web-broker/app/[locale]/(protected)/contacts/[id]/page.tsx
if [ -f "repo/apps/web-broker/app/[locale]/(protected)/contacts/[id]/page.tsx" ]; then
  add_row "T05-F2" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T05-F2" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T05-F3: Existence fichier repo/apps/web-broker/components/contacts/contacts-table.tsx
if [ -f "repo/apps/web-broker/components/contacts/contacts-table.tsx" ]; then
  add_row "T05-F3" "Fichier contacts-table.tsx existe" "PASS" "Cree"
else
  add_row "T05-F3" "Fichier contacts-table.tsx existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T05-V1: List + pagination + sort (P0)
echo "  Verifying T05-V1 : List + pagination + sort..."
add_row "T05-V1" "List + pagination + sort" "WARN" "(P0) Voir B-16 Tache 4.3.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V2: Filters apply (P0)
echo "  Verifying T05-V2 : Filters apply..."
add_row "T05-V2" "Filters apply" "WARN" "(P0) Voir B-16 Tache 4.3.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V3: Search debounced (P0)
echo "  Verifying T05-V3 : Search debounced..."
add_row "T05-V3" "Search debounced" "WARN" "(P0) Voir B-16 Tache 4.3.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V4: Create modal validation Zod (P0)
echo "  Verifying T05-V4 : Create modal validation Zod..."
add_row "T05-V4" "Create modal validation Zod" "WARN" "(P0) Voir B-16 Tache 4.3.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V5: Edit modal pre-fills data (P0)
echo "  Verifying T05-V5 : Edit modal pre-fills data..."
add_row "T05-V5" "Edit modal pre-fills data" "WARN" "(P0) Voir B-16 Tache 4.3.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V6: Detail timeline render (P0)
echo "  Verifying T05-V6 : Detail timeline render..."
add_row "T05-V6" "Detail timeline render" "WARN" "(P0) Voir B-16 Tache 4.3.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V7: Optimistic UI (P0)
echo "  Verifying T05-V7 : Optimistic UI..."
add_row "T05-V7" "Optimistic UI" "WARN" "(P0) Voir B-16 Tache 4.3.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V8: Tests 10+ scenarios (P0)
echo "  Verifying T05-V8 : Tests 10+ scenarios..."
add_row "T05-V8" "Tests 10+ scenarios" "WARN" "(P0) Voir B-16 Tache 4.3.5 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 6/4 -- 4.3.6 : Companies Page

```bash
echo ""
echo "================================================"
echo "TACHE 4.3.6 : Companies Page"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 4"
echo "================================================"

# === Verification fichiers crees ===
# Test T06-F1: Existence fichier repo/apps/web-broker/app/[locale]/(protected)/companies/{several}.tsx
if [ -f "repo/apps/web-broker/app/[locale]/(protected)/companies/{several}.tsx" ]; then
  add_row "T06-F1" "Fichier {several}.tsx existe" "PASS" "Cree"
else
  add_row "T06-F1" "Fichier {several}.tsx existe" "FAIL" "Manquant"
fi
# Test T06-F2: Existence fichier repo/apps/web-broker/components/companies/{components}.tsx
if [ -f "repo/apps/web-broker/components/companies/{components}.tsx" ]; then
  add_row "T06-F2" "Fichier {components}.tsx existe" "PASS" "Cree"
else
  add_row "T06-F2" "Fichier {components}.tsx existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T06-V1: CRUD complet (P0)
echo "  Verifying T06-V1 : CRUD complet..."
add_row "T06-V1" "CRUD complet" "WARN" "(P0) Voir B-16 Tache 4.3.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V2: ICE validation MA (P0)
echo "  Verifying T06-V2 : ICE validation MA..."
add_row "T06-V2" "ICE validation MA" "WARN" "(P0) Voir B-16 Tache 4.3.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V3: Detail avec contacts lies (P0)
echo "  Verifying T06-V3 : Detail avec contacts lies..."
add_row "T06-V3" "Detail avec contacts lies" "WARN" "(P0) Voir B-16 Tache 4.3.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V4: Tests 6+ scenarios (P0)
echo "  Verifying T06-V4 : Tests 6+ scenarios..."
add_row "T06-V4" "Tests 6+ scenarios" "WARN" "(P0) Voir B-16 Tache 4.3.6 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 7/6 -- 4.3.7 : Deals Page : Kanban + Table

```bash
echo ""
echo "================================================"
echo "TACHE 4.3.7 : Deals Page : Kanban + Table"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 6"
echo "================================================"

# === Verification fichiers crees ===
# Test T07-F1: Existence fichier repo/apps/web-broker/app/[locale]/(protected)/deals/page.tsx
if [ -f "repo/apps/web-broker/app/[locale]/(protected)/deals/page.tsx" ]; then
  add_row "T07-F1" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T07-F1" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T07-F2: Existence fichier repo/apps/web-broker/app/[locale]/(protected)/deals/[id]/page.tsx
if [ -f "repo/apps/web-broker/app/[locale]/(protected)/deals/[id]/page.tsx" ]; then
  add_row "T07-F2" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T07-F2" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T07-F3: Existence fichier repo/apps/web-broker/components/deals/deals-kanban.tsx
if [ -f "repo/apps/web-broker/components/deals/deals-kanban.tsx" ]; then
  add_row "T07-F3" "Fichier deals-kanban.tsx existe" "PASS" "Cree"
else
  add_row "T07-F3" "Fichier deals-kanban.tsx existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T07-V1: Kanban view drag-drop (P0)
echo "  Verifying T07-V1 : Kanban view drag-drop..."
add_row "T07-V1" "Kanban view drag-drop" "WARN" "(P0) Voir B-16 Tache 4.3.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V2: Stage move POST API + audit (P0)
echo "  Verifying T07-V2 : Stage move POST API + audit..."
add_row "T07-V2" "Stage move POST API + audit" "WARN" "(P0) Voir B-16 Tache 4.3.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V3: Table view filters (P0)
echo "  Verifying T07-V3 : Table view filters..."
add_row "T07-V3" "Table view filters" "WARN" "(P0) Voir B-16 Tache 4.3.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V4: Create/edit modal (P0)
echo "  Verifying T07-V4 : Create/edit modal..."
add_row "T07-V4" "Create/edit modal" "WARN" "(P0) Voir B-16 Tache 4.3.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V5: Won/Lost shortcuts (P0)
echo "  Verifying T07-V5 : Won/Lost shortcuts..."
add_row "T07-V5" "Won/Lost shortcuts" "WARN" "(P0) Voir B-16 Tache 4.3.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V6: Tests 8+ scenarios (P0)
echo "  Verifying T07-V6 : Tests 8+ scenarios..."
add_row "T07-V6" "Tests 8+ scenarios" "WARN" "(P0) Voir B-16 Tache 4.3.7 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 8/7 -- 4.3.8 : Polices Page : List + Detail Avec Premiums

```bash
echo ""
echo "================================================"
echo "TACHE 4.3.8 : Polices Page : List + Detail Avec Premiums"
echo "Priorite : P0 | Effort : 7h"
echo "Criteres a verifier : 7"
echo "================================================"

# === Verification fichiers crees ===
# Test T08-F1: Existence fichier repo/apps/web-broker/app/[locale]/(protected)/polices/page.tsx
if [ -f "repo/apps/web-broker/app/[locale]/(protected)/polices/page.tsx" ]; then
  add_row "T08-F1" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T08-F1" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T08-F2: Existence fichier repo/apps/web-broker/app/[locale]/(protected)/polices/[id]/page.tsx
if [ -f "repo/apps/web-broker/app/[locale]/(protected)/polices/[id]/page.tsx" ]; then
  add_row "T08-F2" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T08-F2" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T08-F3: Existence fichier repo/apps/web-broker/components/polices/polices-table.tsx
if [ -f "repo/apps/web-broker/components/polices/polices-table.tsx" ]; then
  add_row "T08-F3" "Fichier polices-table.tsx existe" "PASS" "Cree"
else
  add_row "T08-F3" "Fichier polices-table.tsx existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T08-V1: List + filters (P0)
echo "  Verifying T08-V1 : List + filters..."
add_row "T08-V1" "List + filters" "WARN" "(P0) Voir B-16 Tache 4.3.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V2: Detail tabs all functional (P0)
echo "  Verifying T08-V2 : Detail tabs all functional..."
add_row "T08-V2" "Detail tabs all functional" "WARN" "(P0) Voir B-16 Tache 4.3.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V3: Cancel modal pro-rata preview (P0)
echo "  Verifying T08-V3 : Cancel modal pro-rata preview..."
add_row "T08-V3" "Cancel modal pro-rata preview" "WARN" "(P0) Voir B-16 Tache 4.3.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V4: Suspend modal date range (P0)
echo "  Verifying T08-V4 : Suspend modal date range..."
add_row "T08-V4" "Suspend modal date range" "WARN" "(P0) Voir B-16 Tache 4.3.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V5: Transfer modal contact selector (P0)
echo "  Verifying T08-V5 : Transfer modal contact selector..."
add_row "T08-V5" "Transfer modal contact selector" "WARN" "(P0) Voir B-16 Tache 4.3.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V6: Avenants + renouvellements (P0)
echo "  Verifying T08-V6 : Avenants + renouvellements..."
add_row "T08-V6" "Avenants + renouvellements" "WARN" "(P0) Voir B-16 Tache 4.3.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V7: Tests 12+ scenarios (P0)
echo "  Verifying T08-V7 : Tests 12+ scenarios..."
add_row "T08-V7" "Tests 12+ scenarios" "WARN" "(P0) Voir B-16 Tache 4.3.8 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 9/6 -- 4.3.9 : Broker Queue Page : Pending Dossiers + Validate/Reject

```bash
echo ""
echo "================================================"
echo "TACHE 4.3.9 : Broker Queue Page : Pending Dossiers + Validate/Reject"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 6"
echo "================================================"

# === Verification fichiers crees ===
# Test T09-F1: Existence fichier repo/apps/web-broker/app/[locale]/(protected)/broker-queue/page.tsx
if [ -f "repo/apps/web-broker/app/[locale]/(protected)/broker-queue/page.tsx" ]; then
  add_row "T09-F1" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T09-F1" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T09-F2: Existence fichier repo/apps/web-broker/app/[locale]/(protected)/broker-queue/[id]/page.tsx
if [ -f "repo/apps/web-broker/app/[locale]/(protected)/broker-queue/[id]/page.tsx" ]; then
  add_row "T09-F2" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T09-F2" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T09-F3: Existence fichier repo/apps/web-broker/components/broker-queue/queue-table.tsx
if [ -f "repo/apps/web-broker/components/broker-queue/queue-table.tsx" ]; then
  add_row "T09-F3" "Fichier queue-table.tsx existe" "PASS" "Cree"
else
  add_row "T09-F3" "Fichier queue-table.tsx existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T09-V1: List + filtres + SLA timer visible (P0)
echo "  Verifying T09-V1 : List + filtres + SLA timer visible..."
add_row "T09-V1" "List + filtres + SLA timer visible" "WARN" "(P0) Voir B-16 Tache 4.3.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V2: Validate trigger souscription + replace provisional (P0)
echo "  Verifying T09-V2 : Validate trigger souscription + replace provisional..."
add_row "T09-V2" "Validate trigger souscription + replace provisional" "WARN" "(P0) Voir B-16 Tache 4.3.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V3: Reject + reason + notify customer (P0)
echo "  Verifying T09-V3 : Reject + reason + notify customer..."
add_row "T09-V3" "Reject + reason + notify customer" "WARN" "(P0) Voir B-16 Tache 4.3.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V4: Assign self (P0)
echo "  Verifying T09-V4 : Assign self..."
add_row "T09-V4" "Assign self" "WARN" "(P0) Voir B-16 Tache 4.3.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V5: Escalate super admin (P0)
echo "  Verifying T09-V5 : Escalate super admin..."
add_row "T09-V5" "Escalate super admin" "WARN" "(P0) Voir B-16 Tache 4.3.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V6: Tests 10+ scenarios (P0)
echo "  Verifying T09-V6 : Tests 10+ scenarios..."
add_row "T09-V6" "Tests 10+ scenarios" "WARN" "(P0) Voir B-16 Tache 4.3.9 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 10/4 -- 4.3.10 : Sinistres Page Read-Only (M9 Courtier Sans Intervention)

```bash
echo ""
echo "================================================"
echo "TACHE 4.3.10 : Sinistres Page Read-Only (M9 Courtier Sans Intervention)"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 4"
echo "================================================"

# === Verification fichiers crees ===
# Test T10-F1: Existence fichier repo/apps/web-broker/app/[locale]/(protected)/sinistres/page.tsx
if [ -f "repo/apps/web-broker/app/[locale]/(protected)/sinistres/page.tsx" ]; then
  add_row "T10-F1" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T10-F1" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T10-F2: Existence fichier repo/apps/web-broker/app/[locale]/(protected)/sinistres/[id]/page.tsx
if [ -f "repo/apps/web-broker/app/[locale]/(protected)/sinistres/[id]/page.tsx" ]; then
  add_row "T10-F2" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T10-F2" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T10-F3: Existence fichier repo/apps/web-broker/components/sinistres/sinistre-status-flow.tsx
if [ -f "repo/apps/web-broker/components/sinistres/sinistre-status-flow.tsx" ]; then
  add_row "T10-F3" "Fichier sinistre-status-flow.tsx existe" "PASS" "Cree"
else
  add_row "T10-F3" "Fichier sinistre-status-flow.tsx existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T10-V1: List read-only fonctionne (P0)
echo "  Verifying T10-V1 : List read-only fonctionne..."
add_row "T10-V1" "List read-only fonctionne" "WARN" "(P0) Voir B-16 Tache 4.3.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V2: Detail read-only complet (P0)
echo "  Verifying T10-V2 : Detail read-only complet..."
add_row "T10-V2" "Detail read-only complet" "WARN" "(P0) Voir B-16 Tache 4.3.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V3: Pas de boutons Create/Edit/Delete (P0)
echo "  Verifying T10-V3 : Pas de boutons Create/Edit/Delete..."
add_row "T10-V3" "Pas de boutons Create/Edit/Delete" "WARN" "(P0) Voir B-16 Tache 4.3.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V4: Tests 6+ scenarios (P0)
echo "  Verifying T10-V4 : Tests 6+ scenarios..."
add_row "T10-V4" "Tests 6+ scenarios" "WARN" "(P0) Voir B-16 Tache 4.3.10 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 11/6 -- 4.3.11 : Parametres + Profile Pages

```bash
echo ""
echo "================================================"
echo "TACHE 4.3.11 : Parametres + Profile Pages"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 6"
echo "================================================"

# === Verification fichiers crees ===
# Test T11-F1: Existence fichier repo/apps/web-broker/app/[locale]/(protected)/parametres/page.tsx
if [ -f "repo/apps/web-broker/app/[locale]/(protected)/parametres/page.tsx" ]; then
  add_row "T11-F1" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T11-F1" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T11-F2: Existence fichier repo/apps/web-broker/app/[locale]/(protected)/parametres/{several tabs}.tsx
if [ -f "repo/apps/web-broker/app/[locale]/(protected)/parametres/{several tabs}.tsx" ]; then
  add_row "T11-F2" "Fichier {several tabs}.tsx existe" "PASS" "Cree"
else
  add_row "T11-F2" "Fichier {several tabs}.tsx existe" "FAIL" "Manquant"
fi
# Test T11-F3: Existence fichier repo/apps/web-broker/app/[locale]/(protected)/profile/page.tsx
if [ -f "repo/apps/web-broker/app/[locale]/(protected)/profile/page.tsx" ]; then
  add_row "T11-F3" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T11-F3" "Fichier page.tsx existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T11-V1: Parametres tabs accessibles broker_admin (P0)
echo "  Verifying T11-V1 : Parametres tabs accessibles broker_admin..."
add_row "T11-V1" "Parametres tabs accessibles broker_admin" "WARN" "(P0) Voir B-16 Tache 4.3.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V2: Profile tabs accessibles tous users (P0)
echo "  Verifying T11-V2 : Profile tabs accessibles tous users..."
add_row "T11-V2" "Profile tabs accessibles tous users" "WARN" "(P0) Voir B-16 Tache 4.3.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V3: MFA setup flow QR -> verify -> codes (P0)
echo "  Verifying T11-V3 : MFA setup flow QR -> verify -> codes..."
add_row "T11-V3" "MFA setup flow QR -> verify -> codes" "WARN" "(P0) Voir B-16 Tache 4.3.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V4: Active sessions + revoke (P0)
echo "  Verifying T11-V4 : Active sessions + revoke..."
add_row "T11-V4" "Active sessions + revoke" "WARN" "(P0) Voir B-16 Tache 4.3.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V5: Branding upload logo (P0)
echo "  Verifying T11-V5 : Branding upload logo..."
add_row "T11-V5" "Branding upload logo" "WARN" "(P0) Voir B-16 Tache 4.3.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V6: Tests 8+ scenarios (P0)
echo "  Verifying T11-V6 : Tests 8+ scenarios..."
add_row "T11-V6" "Tests 8+ scenarios" "WARN" "(P0) Voir B-16 Tache 4.3.11 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 12/4 -- 4.3.12 : RBAC UI : Conditional Rendering Per Role

```bash
echo ""
echo "================================================"
echo "TACHE 4.3.12 : RBAC UI : Conditional Rendering Per Role"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 4"
echo "================================================"

# === Verification fichiers crees ===
# Test T12-F1: Existence fichier repo/apps/web-broker/lib/auth/use-permissions.tsx
if [ -f "repo/apps/web-broker/lib/auth/use-permissions.tsx" ]; then
  add_row "T12-F1" "Fichier use-permissions.tsx existe" "PASS" "Cree"
else
  add_row "T12-F1" "Fichier use-permissions.tsx existe" "FAIL" "Manquant"
fi
# Test T12-F2: Existence fichier repo/apps/web-broker/components/auth/has-permission.tsx
if [ -f "repo/apps/web-broker/components/auth/has-permission.tsx" ]; then
  add_row "T12-F2" "Fichier has-permission.tsx existe" "PASS" "Cree"
else
  add_row "T12-F2" "Fichier has-permission.tsx existe" "FAIL" "Manquant"
fi
# Test T12-F3: Existence fichier repo/apps/web-broker/components/auth/has-role.tsx
if [ -f "repo/apps/web-broker/components/auth/has-role.tsx" ]; then
  add_row "T12-F3" "Fichier has-role.tsx existe" "PASS" "Cree"
else
  add_row "T12-F3" "Fichier has-role.tsx existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T12-V1: 'useUserPermissions' retourne data correcte (P0)
echo "  Verifying T12-V1 : 'useUserPermissions' retourne data correcte..."
add_row "T12-V1" "'useUserPermissions' retourne data correcte" "WARN" "(P0) Voir B-16 Tache 4.3.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V2: '<HasPermission>' cache si manque (P0)
echo "  Verifying T12-V2 : '<HasPermission>' cache si manque..."
add_row "T12-V2" "'<HasPermission>' cache si manque" "WARN" "(P0) Voir B-16 Tache 4.3.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V3: Sidebar items conditionnels (P0)
echo "  Verifying T12-V3 : Sidebar items conditionnels..."
add_row "T12-V3" "Sidebar items conditionnels" "WARN" "(P0) Voir B-16 Tache 4.3.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V4: Tests per role 6+ scenarios (P0)
echo "  Verifying T12-V4 : Tests per role 6+ scenarios..."
add_row "T12-V4" "Tests per role 6+ scenarios" "WARN" "(P0) Voir B-16 Tache 4.3.12 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 13/5 -- 4.3.13 : I18n Complete : fr / ar-MA / ar + RTL

```bash
echo ""
echo "================================================"
echo "TACHE 4.3.13 : I18n Complete : fr / ar-MA / ar + RTL"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T13-F1: Existence fichier repo/apps/web-broker/messages/fr.json
if [ -f "repo/apps/web-broker/messages/fr.json" ]; then
  add_row "T13-F1" "Fichier fr.json existe" "PASS" "Cree"
else
  add_row "T13-F1" "Fichier fr.json existe" "FAIL" "Manquant"
fi
# Test T13-F2: Existence fichier repo/apps/web-broker/messages/ar-MA.json
if [ -f "repo/apps/web-broker/messages/ar-MA.json" ]; then
  add_row "T13-F2" "Fichier ar-MA.json existe" "PASS" "Cree"
else
  add_row "T13-F2" "Fichier ar-MA.json existe" "FAIL" "Manquant"
fi
# Test T13-F3: Existence fichier repo/apps/web-broker/messages/ar.json
if [ -f "repo/apps/web-broker/messages/ar.json" ]; then
  add_row "T13-F3" "Fichier ar.json existe" "PASS" "Cree"
else
  add_row "T13-F3" "Fichier ar.json existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T13-V1: 3 locales fichiers complets (P0)
echo "  Verifying T13-V1 : 3 locales fichiers complets..."
add_row "T13-V1" "3 locales fichiers complets" "WARN" "(P0) Voir B-16 Tache 4.3.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V2: Switch locale change UI texts (P0)
echo "  Verifying T13-V2 : Switch locale change UI texts..."
add_row "T13-V2" "Switch locale change UI texts" "WARN" "(P0) Voir B-16 Tache 4.3.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V3: RTL CSS applique ar/ar-MA (P0)
echo "  Verifying T13-V3 : RTL CSS applique ar/ar-MA..."
add_row "T13-V3" "RTL CSS applique ar/ar-MA" "WARN" "(P0) Voir B-16 Tache 4.3.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V4: Date + currency locale-aware (P0)
echo "  Verifying T13-V4 : Date + currency locale-aware..."
add_row "T13-V4" "Date + currency locale-aware" "WARN" "(P0) Voir B-16 Tache 4.3.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V5: Tests 6+ scenarios (P0)
echo "  Verifying T13-V5 : Tests 6+ scenarios..."
add_row "T13-V5" "Tests 6+ scenarios" "WARN" "(P0) Voir B-16 Tache 4.3.13 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 14/5 -- 4.3.14 : Tests E2E Playwright (20+) + Accessibility

```bash
echo ""
echo "================================================"
echo "TACHE 4.3.14 : Tests E2E Playwright (20+) + Accessibility"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T14-F1: Existence fichier repo/apps/web-broker/e2e/{20+ specs}.spec.ts
if [ -f "repo/apps/web-broker/e2e/{20+ specs}.spec.ts" ]; then
  add_row "T14-F1" "Fichier {20+ specs}.spec.ts existe" "PASS" "Cree"
else
  add_row "T14-F1" "Fichier {20+ specs}.spec.ts existe" "FAIL" "Manquant"
fi
# Test T14-F2: Existence fichier repo/apps/web-broker/e2e/fixtures/auth-helpers.ts
if [ -f "repo/apps/web-broker/e2e/fixtures/auth-helpers.ts" ]; then
  add_row "T14-F2" "Fichier auth-helpers.ts existe" "PASS" "Cree"
else
  add_row "T14-F2" "Fichier auth-helpers.ts existe" "FAIL" "Manquant"
fi
# Test T14-F3: Existence fichier repo/apps/web-broker/e2e/fixtures/test-tenant-setup.ts
if [ -f "repo/apps/web-broker/e2e/fixtures/test-tenant-setup.ts" ]; then
  add_row "T14-F3" "Fichier test-tenant-setup.ts existe" "PASS" "Cree"
else
  add_row "T14-F3" "Fichier test-tenant-setup.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T14-V1: 20+ tests passent (P0)
echo "  Verifying T14-V1 : 20+ tests passent..."
add_row "T14-V1" "20+ tests passent" "WARN" "(P0) Voir B-16 Tache 4.3.14 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T14-V2: CI green (P0)
echo "  Verifying T14-V2 : CI green..."
add_row "T14-V2" "CI green" "WARN" "(P0) Voir B-16 Tache 4.3.14 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T14-V3: Accessibility WCAG 2.1 AA (P0)
echo "  Verifying T14-V3 : Accessibility WCAG 2.1 AA..."
add_row "T14-V3" "Accessibility WCAG 2.1 AA" "WARN" "(P0) Voir B-16 Tache 4.3.14 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T14-V4: Reproducibility 5x runs (P0)
echo "  Verifying T14-V4 : Reproducibility 5x runs..."
add_row "T14-V4" "Reproducibility 5x runs" "WARN" "(P0) Voir B-16 Tache 4.3.14 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T14-V5: Coverage critical paths (P0)
echo "  Verifying T14-V5 : Coverage critical paths..."
add_row "T14-V5" "Coverage critical paths" "WARN" "(P0) Voir B-16 Tache 4.3.14 pour test detaille - critere a auto-tester via script ad-hoc"

```

---


---


## VERIFICATIONS TRANSVERSALES SPRINT 16

### TR-BUILD : Build complet du sprint

```bash
echo ""
echo "================================================"
echo "VERIFICATIONS TRANSVERSALES SPRINT 16"
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

### TR-LIGHTHOUSE : Cibles Lighthouse Sprint 16

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
echo "GENERATION DU RAPPORT FINAL SPRINT 16"
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

## Jalon GO/NO-GO Sprint 16

EOF

# Calcul statut final
if (( $(echo "$SCORE >= 95" | bc -l) )); then
  STATUT="GO"
  cat >> "$REPORT_FILE" << EOF
**STATUT** : GO -- Sprint 16 valide, passage Sprint 17 autorise

Le sprint a passe les criteres requis. Cowork peut demarrer Sprint 17.

EOF
  echo ""
  echo "================================================"
  echo "SPRINT 16 : GO ($SCORE%)"
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
  echo "SPRINT 16 : GO CONDITIONNEL ($SCORE%)"
  echo "================================================"
else
  STATUT="NO-GO"
  cat >> "$REPORT_FILE" << EOF
**STATUT** : NO-GO -- Score $SCORE% trop bas (cible 85% minimum)

Le sprint **doit etre repris** :
- Lister tous FAIL P0
- Escalation Saad/Abla decision (cut scope OR delai)
- Reprise sprint avant Sprint 17

EOF
  echo ""
  echo "================================================"
  echo "SPRINT 16 : NO-GO ($SCORE%)"
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
  echo "git commit -m \"chore(sprint-16): close sprint 16 -- $STATUT ($SCORE%)\"" >> "$REPORT_FILE"
  echo '```' >> "$REPORT_FILE"
fi

echo ""
echo "Rapport complet dans : $REPORT_FILE"
```

---

## INSTRUCTION FINALE A CLAUDE CODE / COWORK

Apres l'execution complete des verifications ci-dessus :

1. **Lis le contenu de `sprint16-verify-report.md`** integralement
2. **Identifie les FAIL critiques** (criteres P0) qui necessitent intervention manuelle
3. **Affiche un resume executif** :
   - Nombre total de criteres
   - Pourcentage PASS / PASS\* / FAIL / WARN
   - Liste des FAIL avec contexte technique
   - Recommandation : GO / GO CONDITIONNEL / NO-GO
4. **Si NO-GO** : ne pas demarrer le Sprint suivant, alerter Saad/Abla via Slack `#insurtech-dev`
5. **Si GO ou GO CONDITIONNEL** : produire le commit de cloture du sprint :

```bash
git add skalean-insurtech/sprint16-verify-report.md
git commit -m "chore(sprint-16): close sprint 16 with verification report

- Verification automatique executee
- Score global : <SCORE>%
- <PASS> criteres PASS, <PASS_REPAIRED> reparations auto, <FAIL> FAIL
- Statut : <GO|GO CONDITIONNEL|NO-GO>

Phase: 4 -- Vertical Insure (Skalean Broker ERP)
Sprint: 16 (Phase 4 / Sprint 3)
Reference B-16, C-16, V-16
Report: sprint16-verify-report.md"
```

6. **Documentation continue** : si decisions techniques prises pendant verification, ajouter notes dans `repo/docs/runbooks/sprint-16-lessons-learned.md`

---

**Fin de la verification V-16 v2.2 detaillee -- Sprint 16 (4.3) Web Broker App (port 3001).**

**Total criteres taches** : 83 | **Total transversaux** : ~10 | **Effort sprint** : 75h
