# VERIFICATION SPRINT 26 -- Phase 6 / Sprint 1 : Admin Foundation (web-insurtech-admin + impersonation)
# Version : Auto-reparation active + Rapport final MD detaille
# 12 taches, 59 criteres extraits B-26
# AUCUNE EMOJI AUTORISEE

**Version** : v2.2 (verification detaillee)
**Phase** : 6 -- Admin Platform
**Sprint** : 26 / 35 (cumul) -- Sprint 1 dans Phase 6
**Reference meta-prompt** : `B-26-sprint-26-admin-foundation.md`
**Reference orchestrateur** : `C-26-sprint-26-admin-foundation.md`
**Total criteres** : 59 criteres taches + ~10 transversaux

---

Tu es **Claude Code (ou Cowork)**. Tu dois executer une **verification COMPLETE et EXHAUSTIVE** du Sprint 26 apres execution toutes les 12 taches.

---

## REGLES D'EXECUTION

1. Tu **executes CHAQUE verification dans l'ordre** (taches puis transversales)
2. Quand une verification echoue, tu **TENTES UNE REPARATION AUTOMATIQUE** avant de noter FAIL
3. Apres chaque tentative de reparation, tu **re-executes la verification**
4. Tu consignes dans `sprint26-verify-report.md` **TOUS les resultats** au fil de l'execution
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
REPORT_FILE="sprint26-verify-report.md"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
RUN_ID=$(date '+%Y%m%d-%H%M%S')

cat > "$REPORT_FILE" << EOF
# Rapport de Verification - Sprint 26 : Admin Foundation (web-insurtech-admin + impersonation)

**Date** : $TIMESTAMP
**Run ID** : $RUN_ID
**Phase** : 6 -- Admin Platform
**Sprint** : 26 (Phase 6 / Sprint 1)
**Reference B-26** : 12 taches, 59 criteres extraits
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

## TACHE 1/6 -- 6.1.1 : App Skeleton + Middleware Super Admin

```bash
echo ""
echo "================================================"
echo "TACHE 6.1.1 : App Skeleton + Middleware Super Admin"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 6"
echo "================================================"

# === Verification fichiers crees ===
# Test T01-F2: Existence fichier repo/apps/web-insurtech-admin/middleware.ts
if [ -f "repo/apps/web-insurtech-admin/middleware.ts" ]; then
  add_row "T01-F2" "Fichier middleware.ts existe" "PASS" "Cree"
else
  add_row "T01-F2" "Fichier middleware.ts existe" "FAIL" "Manquant"
fi
# Test T01-F3: Existence fichier repo/apps/web-insurtech-admin/app/layout.tsx
if [ -f "repo/apps/web-insurtech-admin/app/layout.tsx" ]; then
  add_row "T01-F3" "Fichier layout.tsx existe" "PASS" "Cree"
else
  add_row "T01-F3" "Fichier layout.tsx existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T01-V1: App demarre port 3000 (P0)
echo "  Verifying T01-V1 : App demarre port 3000..."
add_row "T01-V1" "App demarre port 3000" "WARN" "(P0) Voir B-26 Tache 6.1.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V2: Non super_admin redirect /access-denied (P0)
echo "  Verifying T01-V2 : Non super_admin redirect /access-denied..."
add_row "T01-V2" "Non super_admin redirect /access-denied" "WARN" "(P0) Voir B-26 Tache 6.1.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V3: 2FA mandatory enforce (P0)
echo "  Verifying T01-V3 : 2FA mandatory enforce..."
add_row "T01-V3" "2FA mandatory enforce" "WARN" "(P0) Voir B-26 Tache 6.1.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V4: Session 4h (P0)
echo "  Verifying T01-V4 : Session 4h..."
add_row "T01-V4" "Session 4h" "WARN" "(P0) Voir B-26 Tache 6.1.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V5: Audit log header (P0)
echo "  Verifying T01-V5 : Audit log header..."
add_row "T01-V5" "Audit log header" "WARN" "(P0) Voir B-26 Tache 6.1.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V6: Tests 6+ scenarios (P0)
echo "  Verifying T01-V6 : Tests 6+ scenarios..."
add_row "T01-V6" "Tests 6+ scenarios" "WARN" "(P0) Voir B-26 Tache 6.1.1 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 2/4 -- 6.1.2 : Pages Auth Super Admin

```bash
echo ""
echo "================================================"
echo "TACHE 6.1.2 : Pages Auth Super Admin"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 4"
echo "================================================"

# === Verification fichiers crees ===
# Test T02-F1: Existence fichier repo/apps/web-insurtech-admin/app/[locale]/(auth)/{6 pages}.tsx
if [ -f "repo/apps/web-insurtech-admin/app/[locale]/(auth)/{6 pages}.tsx" ]; then
  add_row "T02-F1" "Fichier {6 pages}.tsx existe" "PASS" "Cree"
else
  add_row "T02-F1" "Fichier {6 pages}.tsx existe" "FAIL" "Manquant"
fi
# Test T02-F2: Existence fichier repo/apps/web-insurtech-admin/components/auth/{several}.tsx
if [ -f "repo/apps/web-insurtech-admin/components/auth/{several}.tsx" ]; then
  add_row "T02-F2" "Fichier {several}.tsx existe" "PASS" "Cree"
else
  add_row "T02-F2" "Fichier {several}.tsx existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T02-V1: Login + MFA (P0)
echo "  Verifying T02-V1 : Login + MFA..."
add_row "T02-V1" "Login + MFA" "WARN" "(P0) Voir B-26 Tache 6.1.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V2: Setup 2FA QR + recovery codes mandatory (P0)
echo "  Verifying T02-V2 : Setup 2FA QR + recovery codes mandatory..."
add_row "T02-V2" "Setup 2FA QR + recovery codes mandatory" "WARN" "(P0) Voir B-26 Tache 6.1.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V3: Recovery code accepted (P0)
echo "  Verifying T02-V3 : Recovery code accepted..."
add_row "T02-V3" "Recovery code accepted" "WARN" "(P0) Voir B-26 Tache 6.1.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V4: Tests 6+ scenarios (P0)
echo "  Verifying T02-V4 : Tests 6+ scenarios..."
add_row "T02-V4" "Tests 6+ scenarios" "WARN" "(P0) Voir B-26 Tache 6.1.2 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 3/5 -- 6.1.3 : Layout Admin + Privilege Escalation Indicator

```bash
echo ""
echo "================================================"
echo "TACHE 6.1.3 : Layout Admin + Privilege Escalation Indicator"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T03-F1: Existence fichier repo/apps/web-insurtech-admin/components/layout/admin-sidebar.tsx
if [ -f "repo/apps/web-insurtech-admin/components/layout/admin-sidebar.tsx" ]; then
  add_row "T03-F1" "Fichier admin-sidebar.tsx existe" "PASS" "Cree"
else
  add_row "T03-F1" "Fichier admin-sidebar.tsx existe" "FAIL" "Manquant"
fi
# Test T03-F2: Existence fichier repo/apps/web-insurtech-admin/components/layout/admin-topbar.tsx
if [ -f "repo/apps/web-insurtech-admin/components/layout/admin-topbar.tsx" ]; then
  add_row "T03-F2" "Fichier admin-topbar.tsx existe" "PASS" "Cree"
else
  add_row "T03-F2" "Fichier admin-topbar.tsx existe" "FAIL" "Manquant"
fi
# Test T03-F3: Existence fichier repo/apps/web-insurtech-admin/components/layout/privilege-escalation-banner.tsx
if [ -f "repo/apps/web-insurtech-admin/components/layout/privilege-escalation-banner.tsx" ]; then
  add_row "T03-F3" "Fichier privilege-escalation-banner.tsx existe" "PASS" "Cree"
else
  add_row "T03-F3" "Fichier privilege-escalation-banner.tsx existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T03-V1: Sidebar complete (P0)
echo "  Verifying T03-V1 : Sidebar complete..."
add_row "T03-V1" "Sidebar complete" "WARN" "(P0) Voir B-26 Tache 6.1.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V2: Topbar + search global (P0)
echo "  Verifying T03-V2 : Topbar + search global..."
add_row "T03-V2" "Topbar + search global" "WARN" "(P0) Voir B-26 Tache 6.1.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V3: Privilege escalation banner (P0)
echo "  Verifying T03-V3 : Privilege escalation banner..."
add_row "T03-V3" "Privilege escalation banner" "WARN" "(P0) Voir B-26 Tache 6.1.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V4: Audit footer (P0)
echo "  Verifying T03-V4 : Audit footer..."
add_row "T03-V4" "Audit footer" "WARN" "(P0) Voir B-26 Tache 6.1.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V5: Tests 5+ scenarios (P0)
echo "  Verifying T03-V5 : Tests 5+ scenarios..."
add_row "T03-V5" "Tests 5+ scenarios" "WARN" "(P0) Voir B-26 Tache 6.1.3 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 4/5 -- 6.1.4 : Dashboard Platform-Wide

```bash
echo ""
echo "================================================"
echo "TACHE 6.1.4 : Dashboard Platform-Wide"
echo "Priorite : P0 | Effort : 7h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T04-F1: Existence fichier repo/apps/web-insurtech-admin/app/[locale]/(protected)/dashboard/page.tsx
if [ -f "repo/apps/web-insurtech-admin/app/[locale]/(protected)/dashboard/page.tsx" ]; then
  add_row "T04-F1" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T04-F1" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T04-F2: Existence fichier repo/apps/web-insurtech-admin/components/dashboard/{6 widgets}.tsx
if [ -f "repo/apps/web-insurtech-admin/components/dashboard/{6 widgets}.tsx" ]; then
  add_row "T04-F2" "Fichier {6 widgets}.tsx existe" "PASS" "Cree"
else
  add_row "T04-F2" "Fichier {6 widgets}.tsx existe" "FAIL" "Manquant"
fi
# Test T04-F3: Existence fichier repo/apps/web-insurtech-admin/lib/queries/admin-dashboard.queries.ts
if [ -f "repo/apps/web-insurtech-admin/lib/queries/admin-dashboard.queries.ts" ]; then
  add_row "T04-F3" "Fichier admin-dashboard.queries.ts existe" "PASS" "Cree"
else
  add_row "T04-F3" "Fichier admin-dashboard.queries.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T04-V1: 6 widgets cross-tenant (P0)
echo "  Verifying T04-V1 : 6 widgets cross-tenant..."
add_row "T04-V1" "6 widgets cross-tenant" "WARN" "(P0) Voir B-26 Tache 6.1.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V2: Filters apply (P0)
echo "  Verifying T04-V2 : Filters apply..."
add_row "T04-V2" "Filters apply" "WARN" "(P0) Voir B-26 Tache 6.1.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V3: Click drill-down (P0)
echo "  Verifying T04-V3 : Click drill-down..."
add_row "T04-V3" "Click drill-down" "WARN" "(P0) Voir B-26 Tache 6.1.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V4: Real-time refresh (P0)
echo "  Verifying T04-V4 : Real-time refresh..."
add_row "T04-V4" "Real-time refresh" "WARN" "(P0) Voir B-26 Tache 6.1.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V5: Tests 6+ scenarios (P0)
echo "  Verifying T04-V5 : Tests 6+ scenarios..."
add_row "T04-V5" "Tests 6+ scenarios" "WARN" "(P0) Voir B-26 Tache 6.1.4 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 5/3 -- 6.1.5 : Tenants List Page

```bash
echo ""
echo "================================================"
echo "TACHE 6.1.5 : Tenants List Page"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 3"
echo "================================================"

# === Verification fichiers crees ===
# Test T05-F1: Existence fichier repo/apps/web-insurtech-admin/app/[locale]/(protected)/tenants/page.tsx
if [ -f "repo/apps/web-insurtech-admin/app/[locale]/(protected)/tenants/page.tsx" ]; then
  add_row "T05-F1" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T05-F1" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T05-F2: Existence fichier repo/apps/web-insurtech-admin/components/tenants/tenants-table.tsx
if [ -f "repo/apps/web-insurtech-admin/components/tenants/tenants-table.tsx" ]; then
  add_row "T05-F2" "Fichier tenants-table.tsx existe" "PASS" "Cree"
else
  add_row "T05-F2" "Fichier tenants-table.tsx existe" "FAIL" "Manquant"
fi
# Test T05-F3: Existence fichier repo/apps/web-insurtech-admin/components/tenants/tenants-bulk-actions.tsx
if [ -f "repo/apps/web-insurtech-admin/components/tenants/tenants-bulk-actions.tsx" ]; then
  add_row "T05-F3" "Fichier tenants-bulk-actions.tsx existe" "PASS" "Cree"
else
  add_row "T05-F3" "Fichier tenants-bulk-actions.tsx existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T05-V1: List + filters + search (P0)
echo "  Verifying T05-V1 : List + filters + search..."
add_row "T05-V1" "List + filters + search" "WARN" "(P0) Voir B-26 Tache 6.1.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V2: Bulk actions (P0)
echo "  Verifying T05-V2 : Bulk actions..."
add_row "T05-V2" "Bulk actions" "WARN" "(P0) Voir B-26 Tache 6.1.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V3: Tests 6+ scenarios (P0)
echo "  Verifying T05-V3 : Tests 6+ scenarios..."
add_row "T05-V3" "Tests 6+ scenarios" "WARN" "(P0) Voir B-26 Tache 6.1.5 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 6/5 -- 6.1.6 : Tenant Detail Page

```bash
echo ""
echo "================================================"
echo "TACHE 6.1.6 : Tenant Detail Page"
echo "Priorite : P0 | Effort : 7h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T06-F1: Existence fichier repo/apps/web-insurtech-admin/app/[locale]/(protected)/tenants/[id]/page.tsx
if [ -f "repo/apps/web-insurtech-admin/app/[locale]/(protected)/tenants/[id]/page.tsx" ]; then
  add_row "T06-F1" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T06-F1" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T06-F2: Existence fichier repo/apps/web-insurtech-admin/components/tenants/tenant-detail-tabs.tsx
if [ -f "repo/apps/web-insurtech-admin/components/tenants/tenant-detail-tabs.tsx" ]; then
  add_row "T06-F2" "Fichier tenant-detail-tabs.tsx existe" "PASS" "Cree"
else
  add_row "T06-F2" "Fichier tenant-detail-tabs.tsx existe" "FAIL" "Manquant"
fi
# Test T06-F3: Existence fichier repo/apps/web-insurtech-admin/components/tenants/impersonate-button.tsx
if [ -f "repo/apps/web-insurtech-admin/components/tenants/impersonate-button.tsx" ]; then
  add_row "T06-F3" "Fichier impersonate-button.tsx existe" "PASS" "Cree"
else
  add_row "T06-F3" "Fichier impersonate-button.tsx existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T06-V1: 8 tabs functional (P0)
echo "  Verifying T06-V1 : 8 tabs functional..."
add_row "T06-V1" "8 tabs functional" "WARN" "(P0) Voir B-26 Tache 6.1.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V2: Impersonate workflow (P0)
echo "  Verifying T06-V2 : Impersonate workflow..."
add_row "T06-V2" "Impersonate workflow" "WARN" "(P0) Voir B-26 Tache 6.1.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V3: Suspend tenant (P0)
echo "  Verifying T06-V3 : Suspend tenant..."
add_row "T06-V3" "Suspend tenant" "WARN" "(P0) Voir B-26 Tache 6.1.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V4: Privilege banner active (P0)
echo "  Verifying T06-V4 : Privilege banner active..."
add_row "T06-V4" "Privilege banner active" "WARN" "(P0) Voir B-26 Tache 6.1.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V5: Tests 8+ scenarios (P0)
echo "  Verifying T06-V5 : Tests 8+ scenarios..."
add_row "T06-V5" "Tests 8+ scenarios" "WARN" "(P0) Voir B-26 Tache 6.1.6 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 7/5 -- 6.1.7 : Onboarding Wizard UI

```bash
echo ""
echo "================================================"
echo "TACHE 6.1.7 : Onboarding Wizard UI"
echo "Priorite : P0 | Effort : 7h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T07-F1: Existence fichier repo/apps/web-insurtech-admin/app/[locale]/(protected)/onboarding/page.tsx
if [ -f "repo/apps/web-insurtech-admin/app/[locale]/(protected)/onboarding/page.tsx" ]; then
  add_row "T07-F1" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T07-F1" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T07-F2: Existence fichier repo/apps/web-insurtech-admin/components/onboarding/{7 steps components}.tsx
if [ -f "repo/apps/web-insurtech-admin/components/onboarding/{7 steps components}.tsx" ]; then
  add_row "T07-F2" "Fichier {7 steps components}.tsx existe" "PASS" "Cree"
else
  add_row "T07-F2" "Fichier {7 steps components}.tsx existe" "FAIL" "Manquant"
fi
# Test T07-F3: Existence fichier repo/apps/web-insurtech-admin/components/onboarding/wizard-progress.tsx
if [ -f "repo/apps/web-insurtech-admin/components/onboarding/wizard-progress.tsx" ]; then
  add_row "T07-F3" "Fichier wizard-progress.tsx existe" "PASS" "Cree"
else
  add_row "T07-F3" "Fichier wizard-progress.tsx existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T07-V1: 7 steps complete (P0)
echo "  Verifying T07-V1 : 7 steps complete..."
add_row "T07-V1" "7 steps complete" "WARN" "(P0) Voir B-26 Tache 6.1.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V2: Draft save + resume (P0)
echo "  Verifying T07-V2 : Draft save + resume..."
add_row "T07-V2" "Draft save + resume" "WARN" "(P0) Voir B-26 Tache 6.1.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V3: Validation per step (P0)
echo "  Verifying T07-V3 : Validation per step..."
add_row "T07-V3" "Validation per step" "WARN" "(P0) Voir B-26 Tache 6.1.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V4: Backend launch trigger (P0)
echo "  Verifying T07-V4 : Backend launch trigger..."
add_row "T07-V4" "Backend launch trigger" "WARN" "(P0) Voir B-26 Tache 6.1.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V5: Tests 8+ scenarios (P0)
echo "  Verifying T07-V5 : Tests 8+ scenarios..."
add_row "T07-V5" "Tests 8+ scenarios" "WARN" "(P0) Voir B-26 Tache 6.1.7 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 8/5 -- 6.1.8 : Users Management Cross-Tenant + Impersonate

```bash
echo ""
echo "================================================"
echo "TACHE 6.1.8 : Users Management Cross-Tenant + Impersonate"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T08-F1: Existence fichier repo/apps/web-insurtech-admin/app/[locale]/(protected)/users/page.tsx
if [ -f "repo/apps/web-insurtech-admin/app/[locale]/(protected)/users/page.tsx" ]; then
  add_row "T08-F1" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T08-F1" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T08-F2: Existence fichier repo/apps/web-insurtech-admin/components/users/users-table.tsx
if [ -f "repo/apps/web-insurtech-admin/components/users/users-table.tsx" ]; then
  add_row "T08-F2" "Fichier users-table.tsx existe" "PASS" "Cree"
else
  add_row "T08-F2" "Fichier users-table.tsx existe" "FAIL" "Manquant"
fi
# Test T08-F3: Existence fichier repo/apps/web-insurtech-admin/components/users/impersonate-modal.tsx
if [ -f "repo/apps/web-insurtech-admin/components/users/impersonate-modal.tsx" ]; then
  add_row "T08-F3" "Fichier impersonate-modal.tsx existe" "PASS" "Cree"
else
  add_row "T08-F3" "Fichier impersonate-modal.tsx existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T08-V1: Users list + filters (P0)
echo "  Verifying T08-V1 : Users list + filters..."
add_row "T08-V1" "Users list + filters" "WARN" "(P0) Voir B-26 Tache 6.1.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V2: Invite + suspend + reset MFA (P0)
echo "  Verifying T08-V2 : Invite + suspend + reset MFA..."
add_row "T08-V2" "Invite + suspend + reset MFA" "WARN" "(P0) Voir B-26 Tache 6.1.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V3: Impersonate workflow complete (P0)
echo "  Verifying T08-V3 : Impersonate workflow complete..."
add_row "T08-V3" "Impersonate workflow complete" "WARN" "(P0) Voir B-26 Tache 6.1.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V4: Audit complete (P0)
echo "  Verifying T08-V4 : Audit complete..."
add_row "T08-V4" "Audit complete" "WARN" "(P0) Voir B-26 Tache 6.1.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V5: Tests 10+ scenarios (P0)
echo "  Verifying T08-V5 : Tests 10+ scenarios..."
add_row "T08-V5" "Tests 10+ scenarios" "WARN" "(P0) Voir B-26 Tache 6.1.8 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 9/5 -- 6.1.9 : Capabilities Matrix UI

```bash
echo ""
echo "================================================"
echo "TACHE 6.1.9 : Capabilities Matrix UI"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T09-F1: Existence fichier repo/apps/web-insurtech-admin/app/[locale]/(protected)/tenants/[id]/capabilities/page.tsx
if [ -f "repo/apps/web-insurtech-admin/app/[locale]/(protected)/tenants/[id]/capabilities/page.tsx" ]; then
  add_row "T09-F1" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T09-F1" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T09-F2: Existence fichier repo/apps/web-insurtech-admin/components/capabilities/capabilities-matrix-ui.tsx
if [ -f "repo/apps/web-insurtech-admin/components/capabilities/capabilities-matrix-ui.tsx" ]; then
  add_row "T09-F2" "Fichier capabilities-matrix-ui.tsx existe" "PASS" "Cree"
else
  add_row "T09-F2" "Fichier capabilities-matrix-ui.tsx existe" "FAIL" "Manquant"
fi
# Test T09-F3: Existence fichier repo/apps/web-insurtech-admin/components/capabilities/changes-history.tsx
if [ -f "repo/apps/web-insurtech-admin/components/capabilities/changes-history.tsx" ]; then
  add_row "T09-F3" "Fichier changes-history.tsx existe" "PASS" "Cree"
else
  add_row "T09-F3" "Fichier changes-history.tsx existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T09-V1: Matrix display (P0)
echo "  Verifying T09-V1 : Matrix display..."
add_row "T09-V1" "Matrix display" "WARN" "(P0) Voir B-26 Tache 6.1.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V2: Toggle + save (P0)
echo "  Verifying T09-V2 : Toggle + save..."
add_row "T09-V2" "Toggle + save" "WARN" "(P0) Voir B-26 Tache 6.1.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V3: History changes (P0)
echo "  Verifying T09-V3 : History changes..."
add_row "T09-V3" "History changes" "WARN" "(P0) Voir B-26 Tache 6.1.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V4: Validation dependencies (P0)
echo "  Verifying T09-V4 : Validation dependencies..."
add_row "T09-V4" "Validation dependencies" "WARN" "(P0) Voir B-26 Tache 6.1.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V5: Tests 6+ scenarios (P0)
echo "  Verifying T09-V5 : Tests 6+ scenarios..."
add_row "T09-V5" "Tests 6+ scenarios" "WARN" "(P0) Voir B-26 Tache 6.1.9 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 10/5 -- 6.1.10 : Health Monitoring

```bash
echo ""
echo "================================================"
echo "TACHE 6.1.10 : Health Monitoring"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T10-F1: Existence fichier repo/apps/web-insurtech-admin/app/[locale]/(protected)/health/page.tsx
if [ -f "repo/apps/web-insurtech-admin/app/[locale]/(protected)/health/page.tsx" ]; then
  add_row "T10-F1" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T10-F1" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T10-F2: Existence fichier repo/apps/web-insurtech-admin/components/health/{several monitors}.tsx
if [ -f "repo/apps/web-insurtech-admin/components/health/{several monitors}.tsx" ]; then
  add_row "T10-F2" "Fichier {several monitors}.tsx existe" "PASS" "Cree"
else
  add_row "T10-F2" "Fichier {several monitors}.tsx existe" "FAIL" "Manquant"
fi
# Test T10-F3: Existence fichier repo/apps/api/src/modules/admin/controllers/health-monitoring.controller.ts
if [ -f "repo/apps/api/src/modules/admin/controllers/health-monitoring.controller.ts" ]; then
  add_row "T10-F3" "Fichier health-monitoring.controller.ts existe" "PASS" "Cree"
else
  add_row "T10-F3" "Fichier health-monitoring.controller.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T10-V1: Services status (P0)
echo "  Verifying T10-V1 : Services status..."
add_row "T10-V1" "Services status" "WARN" "(P0) Voir B-26 Tache 6.1.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V2: Metrics OTEL (P0)
echo "  Verifying T10-V2 : Metrics OTEL..."
add_row "T10-V2" "Metrics OTEL" "WARN" "(P0) Voir B-26 Tache 6.1.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V3: Alerts active (P0)
echo "  Verifying T10-V3 : Alerts active..."
add_row "T10-V3" "Alerts active" "WARN" "(P0) Voir B-26 Tache 6.1.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V4: Auto-refresh (P0)
echo "  Verifying T10-V4 : Auto-refresh..."
add_row "T10-V4" "Auto-refresh" "WARN" "(P0) Voir B-26 Tache 6.1.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V5: Tests 6+ scenarios (P0)
echo "  Verifying T10-V5 : Tests 6+ scenarios..."
add_row "T10-V5" "Tests 6+ scenarios" "WARN" "(P0) Voir B-26 Tache 6.1.10 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 11/6 -- 6.1.11 : Audit Logs Viewer + Search Avance

```bash
echo ""
echo "================================================"
echo "TACHE 6.1.11 : Audit Logs Viewer + Search Avance"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 6"
echo "================================================"

# === Verification fichiers crees ===
# Test T11-F1: Existence fichier repo/apps/web-insurtech-admin/app/[locale]/(protected)/audit-logs/page.tsx
if [ -f "repo/apps/web-insurtech-admin/app/[locale]/(protected)/audit-logs/page.tsx" ]; then
  add_row "T11-F1" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T11-F1" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T11-F2: Existence fichier repo/apps/web-insurtech-admin/components/audit/audit-logs-table.tsx
if [ -f "repo/apps/web-insurtech-admin/components/audit/audit-logs-table.tsx" ]; then
  add_row "T11-F2" "Fichier audit-logs-table.tsx existe" "PASS" "Cree"
else
  add_row "T11-F2" "Fichier audit-logs-table.tsx existe" "FAIL" "Manquant"
fi
# Test T11-F3: Existence fichier repo/apps/web-insurtech-admin/components/audit/audit-detail-modal.tsx
if [ -f "repo/apps/web-insurtech-admin/components/audit/audit-detail-modal.tsx" ]; then
  add_row "T11-F3" "Fichier audit-detail-modal.tsx existe" "PASS" "Cree"
else
  add_row "T11-F3" "Fichier audit-detail-modal.tsx existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T11-V1: Filters complete (P0)
echo "  Verifying T11-V1 : Filters complete..."
add_row "T11-V1" "Filters complete" "WARN" "(P0) Voir B-26 Tache 6.1.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V2: Search free text (P0)
echo "  Verifying T11-V2 : Search free text..."
add_row "T11-V2" "Search free text" "WARN" "(P0) Voir B-26 Tache 6.1.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V3: Export CSV (P0)
echo "  Verifying T11-V3 : Export CSV..."
add_row "T11-V3" "Export CSV" "WARN" "(P0) Voir B-26 Tache 6.1.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V4: Detail modal JSON (P0)
echo "  Verifying T11-V4 : Detail modal JSON..."
add_row "T11-V4" "Detail modal JSON" "WARN" "(P0) Voir B-26 Tache 6.1.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V5: Performance > 10M rows (P0)
echo "  Verifying T11-V5 : Performance > 10M rows..."
add_row "T11-V5" "Performance > 10M rows" "WARN" "(P0) Voir B-26 Tache 6.1.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V6: Tests 6+ scenarios (P0)
echo "  Verifying T11-V6 : Tests 6+ scenarios..."
add_row "T11-V6" "Tests 6+ scenarios" "WARN" "(P0) Voir B-26 Tache 6.1.11 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 12/5 -- 6.1.12 : Tests E2E + WCAG + Lighthouse

```bash
echo ""
echo "================================================"
echo "TACHE 6.1.12 : Tests E2E + WCAG + Lighthouse"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T12-F1: Existence fichier repo/apps/web-insurtech-admin/e2e/{15+ specs}.spec.ts
if [ -f "repo/apps/web-insurtech-admin/e2e/{15+ specs}.spec.ts" ]; then
  add_row "T12-F1" "Fichier {15+ specs}.spec.ts existe" "PASS" "Cree"
else
  add_row "T12-F1" "Fichier {15+ specs}.spec.ts existe" "FAIL" "Manquant"
fi
# Test T12-F2: Existence fichier repo/apps/web-insurtech-admin/playwright.config.ts
if [ -f "repo/apps/web-insurtech-admin/playwright.config.ts" ]; then
  add_row "T12-F2" "Fichier playwright.config.ts existe" "PASS" "Cree"
else
  add_row "T12-F2" "Fichier playwright.config.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T12-V1: 15+ tests passent (P0)
echo "  Verifying T12-V1 : 15+ tests passent..."
add_row "T12-V1" "15+ tests passent" "WARN" "(P0) Voir B-26 Tache 6.1.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V2: Lighthouse perf 90+ (P0)
echo "  Verifying T12-V2 : Lighthouse perf 90+..."
add_row "T12-V2" "Lighthouse perf 90+" "WARN" "(P0) Voir B-26 Tache 6.1.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V3: Accessibility WCAG 2.1 AA (P0)
echo "  Verifying T12-V3 : Accessibility WCAG 2.1 AA..."
add_row "T12-V3" "Accessibility WCAG 2.1 AA" "WARN" "(P0) Voir B-26 Tache 6.1.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V4: CI green (P0)
echo "  Verifying T12-V4 : CI green..."
add_row "T12-V4" "CI green" "WARN" "(P0) Voir B-26 Tache 6.1.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V5: Reproducibility 5x (P0)
echo "  Verifying T12-V5 : Reproducibility 5x..."
add_row "T12-V5" "Reproducibility 5x" "WARN" "(P0) Voir B-26 Tache 6.1.12 pour test detaille - critere a auto-tester via script ad-hoc"

```

---


---


## VERIFICATIONS TRANSVERSALES SPRINT 26

### TR-BUILD : Build complet du sprint

```bash
echo ""
echo "================================================"
echo "VERIFICATIONS TRANSVERSALES SPRINT 26"
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

### TR-MIGRATIONS : Migrations DB Sprint 26

```bash
echo "=== TR-MIGRATIONS : Migrations DB ==="
MIGR_COUNT=$(pg_query "SELECT COUNT(*) FROM migrations WHERE name LIKE '%sprint26%' OR name LIKE '%Sprint26%'" || echo 0)
if [ "$MIGR_COUNT" -gt 0 ]; then
  add_row "TR-MIG" "Migrations Sprint 26 appliquees" "PASS" "$MIGR_COUNT migrations"
else
  add_row "TR-MIG" "Migrations Sprint 26 appliquees" "WARN" "Aucune migration detectee (verifier)"
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

### TR-LIGHTHOUSE : Cibles Lighthouse Sprint 26

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
echo "GENERATION DU RAPPORT FINAL SPRINT 26"
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

## Jalon GO/NO-GO Sprint 26

EOF

# Calcul statut final
if (( $(echo "$SCORE >= 95" | bc -l) )); then
  STATUT="GO"
  cat >> "$REPORT_FILE" << EOF
**STATUT** : GO -- Sprint 26 valide, passage Sprint 27 autorise

Le sprint a passe les criteres requis. Cowork peut demarrer Sprint 27.

EOF
  echo ""
  echo "================================================"
  echo "SPRINT 26 : GO ($SCORE%)"
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
  echo "SPRINT 26 : GO CONDITIONNEL ($SCORE%)"
  echo "================================================"
else
  STATUT="NO-GO"
  cat >> "$REPORT_FILE" << EOF
**STATUT** : NO-GO -- Score $SCORE% trop bas (cible 85% minimum)

Le sprint **doit etre repris** :
- Lister tous FAIL P0
- Escalation Saad/Abla decision (cut scope OR delai)
- Reprise sprint avant Sprint 27

EOF
  echo ""
  echo "================================================"
  echo "SPRINT 26 : NO-GO ($SCORE%)"
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
  echo "git commit -m \"chore(sprint-26): close sprint 26 -- $STATUT ($SCORE%)\"" >> "$REPORT_FILE"
  echo '```' >> "$REPORT_FILE"
fi

echo ""
echo "Rapport complet dans : $REPORT_FILE"
```

---

## INSTRUCTION FINALE A CLAUDE CODE / COWORK

Apres l'execution complete des verifications ci-dessus :

1. **Lis le contenu de `sprint26-verify-report.md`** integralement
2. **Identifie les FAIL critiques** (criteres P0) qui necessitent intervention manuelle
3. **Affiche un resume executif** :
   - Nombre total de criteres
   - Pourcentage PASS / PASS\* / FAIL / WARN
   - Liste des FAIL avec contexte technique
   - Recommandation : GO / GO CONDITIONNEL / NO-GO
4. **Si NO-GO** : ne pas demarrer le Sprint suivant, alerter Saad/Abla via Slack `#insurtech-dev`
5. **Si GO ou GO CONDITIONNEL** : produire le commit de cloture du sprint :

```bash
git add skalean-insurtech/sprint26-verify-report.md
git commit -m "chore(sprint-26): close sprint 26 with verification report

- Verification automatique executee
- Score global : <SCORE>%
- <PASS> criteres PASS, <PASS_REPAIRED> reparations auto, <FAIL> FAIL
- Statut : <GO|GO CONDITIONNEL|NO-GO>

Phase: 6 -- Admin Platform
Sprint: 26 (Phase 6 / Sprint 1)
Reference B-26, C-26, V-26
Report: sprint26-verify-report.md"
```

6. **Documentation continue** : si decisions techniques prises pendant verification, ajouter notes dans `repo/docs/runbooks/sprint-26-lessons-learned.md`

---

**Fin de la verification V-26 v2.2 detaillee -- Sprint 26 (6.1) Admin Foundation (web-insurtech-admin + impersonation).**

**Total criteres taches** : 59 | **Total transversaux** : ~10 | **Effort sprint** : 70h
