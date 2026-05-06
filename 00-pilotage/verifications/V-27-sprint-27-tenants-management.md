# VERIFICATION SPRINT 27 -- Phase 6 / Sprint 2 : Tenants Management (onboarding wizard + billing)
# Version : Auto-reparation active + Rapport final MD detaille
# 12 taches, 52 criteres extraits B-27
# AUCUNE EMOJI AUTORISEE

**Version** : v2.2 (verification detaillee)
**Phase** : 6 -- Admin Platform
**Sprint** : 27 / 35 (cumul) -- Sprint 2 dans Phase 6
**Reference meta-prompt** : `B-27-sprint-27-tenants-management.md`
**Reference orchestrateur** : `C-27-sprint-27-tenants-management.md`
**Total criteres** : 52 criteres taches + ~10 transversaux

---

Tu es **Claude Code (ou Cowork)**. Tu dois executer une **verification COMPLETE et EXHAUSTIVE** du Sprint 27 apres execution toutes les 12 taches.

---

## REGLES D'EXECUTION

1. Tu **executes CHAQUE verification dans l'ordre** (taches puis transversales)
2. Quand une verification echoue, tu **TENTES UNE REPARATION AUTOMATIQUE** avant de noter FAIL
3. Apres chaque tentative de reparation, tu **re-executes la verification**
4. Tu consignes dans `sprint27-verify-report.md` **TOUS les resultats** au fil de l'execution
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
REPORT_FILE="sprint27-verify-report.md"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
RUN_ID=$(date '+%Y%m%d-%H%M%S')

cat > "$REPORT_FILE" << EOF
# Rapport de Verification - Sprint 27 : Tenants Management (onboarding wizard + billing)

**Date** : $TIMESTAMP
**Run ID** : $RUN_ID
**Phase** : 6 -- Admin Platform
**Sprint** : 27 (Phase 6 / Sprint 2)
**Reference B-27** : 12 taches, 52 criteres extraits
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

## TACHE 1/6 -- 6.2.1 : Billing Tenants Automation

```bash
echo ""
echo "================================================"
echo "TACHE 6.2.1 : Billing Tenants Automation"
echo "Priorite : P0 | Effort : 7h"
echo "Criteres a verifier : 6"
echo "================================================"

# === Verification fichiers crees ===
# Test T01-F1: Existence fichier repo/packages/database/src/migrations/{date}-PlatformBillingInvoices.ts
if [ -f "repo/packages/database/src/migrations/{date}-PlatformBillingInvoices.ts" ]; then
  add_row "T01-F1" "Fichier {date}-PlatformBillingInvoices.ts existe" "PASS" "Cree"
else
  add_row "T01-F1" "Fichier {date}-PlatformBillingInvoices.ts existe" "FAIL" "Manquant"
fi
# Test T01-F2: Existence fichier repo/packages/database/src/migrations/{date}-TenantBillingSettings.ts
if [ -f "repo/packages/database/src/migrations/{date}-TenantBillingSettings.ts" ]; then
  add_row "T01-F2" "Fichier {date}-TenantBillingSettings.ts existe" "PASS" "Cree"
else
  add_row "T01-F2" "Fichier {date}-TenantBillingSettings.ts existe" "FAIL" "Manquant"
fi
# Test T01-F3: Existence fichier repo/packages/admin/src/entities/platform-billing-invoice.entity.ts
if [ -f "repo/packages/admin/src/entities/platform-billing-invoice.entity.ts" ]; then
  add_row "T01-F3" "Fichier platform-billing-invoice.entity.ts existe" "PASS" "Cree"
else
  add_row "T01-F3" "Fichier platform-billing-invoice.entity.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T01-V1: Migration + entities (P0)
echo "  Verifying T01-V1 : Migration + entities..."
add_row "T01-V1" "Migration + entities" "WARN" "(P0) Voir B-27 Tache 6.2.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V2: generateInvoice computation correct (decimal.js) (P0)
echo "  Verifying T01-V2 : generateInvoice computation correct (decimal.js)..."
add_row "T01-V2" "generateInvoice computation correct (decimal.js)" "WARN" "(P0) Voir B-27 Tache 6.2.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V3: Cron mensuel (P0)
echo "  Verifying T01-V3 : Cron mensuel..."
add_row "T01-V3" "Cron mensuel" "WARN" "(P0) Voir B-27 Tache 6.2.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V4: Notifications super_admin (P0)
echo "  Verifying T01-V4 : Notifications super_admin..."
add_row "T01-V4" "Notifications super_admin" "WARN" "(P0) Voir B-27 Tache 6.2.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V5: Multi-tenant aggregations correctes (P0)
echo "  Verifying T01-V5 : Multi-tenant aggregations correctes..."
add_row "T01-V5" "Multi-tenant aggregations correctes" "WARN" "(P0) Voir B-27 Tache 6.2.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V6: Tests 10+ scenarios (P0)
echo "  Verifying T01-V6 : Tests 10+ scenarios..."
add_row "T01-V6" "Tests 10+ scenarios" "WARN" "(P0) Voir B-27 Tache 6.2.1 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 2/5 -- 6.2.2 : Page Billing UI

```bash
echo ""
echo "================================================"
echo "TACHE 6.2.2 : Page Billing UI"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T02-F1: Existence fichier repo/apps/web-insurtech-admin/app/[locale]/(protected)/billing/page.tsx
if [ -f "repo/apps/web-insurtech-admin/app/[locale]/(protected)/billing/page.tsx" ]; then
  add_row "T02-F1" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T02-F1" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T02-F2: Existence fichier repo/apps/web-insurtech-admin/app/[locale]/(protected)/billing/[id]/page.tsx
if [ -f "repo/apps/web-insurtech-admin/app/[locale]/(protected)/billing/[id]/page.tsx" ]; then
  add_row "T02-F2" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T02-F2" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T02-F3: Existence fichier repo/apps/web-insurtech-admin/components/billing/{several components}.tsx
if [ -f "repo/apps/web-insurtech-admin/components/billing/{several components}.tsx" ]; then
  add_row "T02-F3" "Fichier {several components}.tsx existe" "PASS" "Cree"
else
  add_row "T02-F3" "Fichier {several components}.tsx existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T02-V1: 3 tabs functional (P0)
echo "  Verifying T02-V1 : 3 tabs functional..."
add_row "T02-V1" "3 tabs functional" "WARN" "(P0) Voir B-27 Tache 6.2.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V2: Invoices CRUD (P0)
echo "  Verifying T02-V2 : Invoices CRUD..."
add_row "T02-V2" "Invoices CRUD" "WARN" "(P0) Voir B-27 Tache 6.2.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V3: Settings edit (P0)
echo "  Verifying T02-V3 : Settings edit..."
add_row "T02-V3" "Settings edit" "WARN" "(P0) Voir B-27 Tache 6.2.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V4: Reports KPIs (P0)
echo "  Verifying T02-V4 : Reports KPIs..."
add_row "T02-V4" "Reports KPIs" "WARN" "(P0) Voir B-27 Tache 6.2.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V5: Tests 6+ scenarios (P0)
echo "  Verifying T02-V5 : Tests 6+ scenarios..."
add_row "T02-V5" "Tests 6+ scenarios" "WARN" "(P0) Voir B-27 Tache 6.2.2 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 3/5 -- 6.2.3 : Tenant Lifecycle : Pause / Archive

```bash
echo ""
echo "================================================"
echo "TACHE 6.2.3 : Tenant Lifecycle : Pause / Archive"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T03-F1: Existence fichier repo/packages/database/src/migrations/{date}-AddTenantLifecycleColumns.ts
if [ -f "repo/packages/database/src/migrations/{date}-AddTenantLifecycleColumns.ts" ]; then
  add_row "T03-F1" "Fichier {date}-AddTenantLifecycleColumns.ts existe" "PASS" "Cree"
else
  add_row "T03-F1" "Fichier {date}-AddTenantLifecycleColumns.ts existe" "FAIL" "Manquant"
fi
# Test T03-F2: Existence fichier repo/packages/admin/src/services/tenant-lifecycle.service.ts
if [ -f "repo/packages/admin/src/services/tenant-lifecycle.service.ts" ]; then
  add_row "T03-F2" "Fichier tenant-lifecycle.service.ts existe" "PASS" "Cree"
else
  add_row "T03-F2" "Fichier tenant-lifecycle.service.ts existe" "FAIL" "Manquant"
fi
# Test T03-F3: Existence fichier repo/packages/admin/src/jobs/tenant-lifecycle-cron.ts
if [ -f "repo/packages/admin/src/jobs/tenant-lifecycle-cron.ts" ]; then
  add_row "T03-F3" "Fichier tenant-lifecycle-cron.ts existe" "PASS" "Cree"
else
  add_row "T03-F3" "Fichier tenant-lifecycle-cron.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T03-V1: 3 lifecycle states (P0)
echo "  Verifying T03-V1 : 3 lifecycle states..."
add_row "T03-V1" "3 lifecycle states" "WARN" "(P0) Voir B-27 Tache 6.2.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V2: Notifications tenant (P0)
echo "  Verifying T03-V2 : Notifications tenant..."
add_row "T03-V2" "Notifications tenant" "WARN" "(P0) Voir B-27 Tache 6.2.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V3: Auto-reactivate cron (P0)
echo "  Verifying T03-V3 : Auto-reactivate cron..."
add_row "T03-V3" "Auto-reactivate cron" "WARN" "(P0) Voir B-27 Tache 6.2.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V4: Audit complete (P0)
echo "  Verifying T03-V4 : Audit complete..."
add_row "T03-V4" "Audit complete" "WARN" "(P0) Voir B-27 Tache 6.2.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V5: Tests 8+ scenarios (P0)
echo "  Verifying T03-V5 : Tests 8+ scenarios..."
add_row "T03-V5" "Tests 8+ scenarios" "WARN" "(P0) Voir B-27 Tache 6.2.3 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 4/5 -- 6.2.4 : Bulk Operations : Mass Updates

```bash
echo ""
echo "================================================"
echo "TACHE 6.2.4 : Bulk Operations : Mass Updates"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T04-F1: Existence fichier repo/packages/database/src/migrations/{date}-BulkOperations.ts
if [ -f "repo/packages/database/src/migrations/{date}-BulkOperations.ts" ]; then
  add_row "T04-F1" "Fichier {date}-BulkOperations.ts existe" "PASS" "Cree"
else
  add_row "T04-F1" "Fichier {date}-BulkOperations.ts existe" "FAIL" "Manquant"
fi
# Test T04-F2: Existence fichier repo/packages/admin/src/services/bulk-operations.service.ts
if [ -f "repo/packages/admin/src/services/bulk-operations.service.ts" ]; then
  add_row "T04-F2" "Fichier bulk-operations.service.ts existe" "PASS" "Cree"
else
  add_row "T04-F2" "Fichier bulk-operations.service.ts existe" "FAIL" "Manquant"
fi
# Test T04-F3: Existence fichier repo/packages/admin/src/workers/bulk-ops.worker.ts
if [ -f "repo/packages/admin/src/workers/bulk-ops.worker.ts" ]; then
  add_row "T04-F3" "Fichier bulk-ops.worker.ts existe" "PASS" "Cree"
else
  add_row "T04-F3" "Fichier bulk-ops.worker.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T04-V1: 4 bulk operations (P0)
echo "  Verifying T04-V1 : 4 bulk operations..."
add_row "T04-V1" "4 bulk operations" "WARN" "(P0) Voir B-27 Tache 6.2.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V2: Async via queue (P0)
echo "  Verifying T04-V2 : Async via queue..."
add_row "T04-V2" "Async via queue" "WARN" "(P0) Voir B-27 Tache 6.2.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V3: Progress tracking (P0)
echo "  Verifying T04-V3 : Progress tracking..."
add_row "T04-V3" "Progress tracking" "WARN" "(P0) Voir B-27 Tache 6.2.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V4: UI selection + confirmation (P0)
echo "  Verifying T04-V4 : UI selection + confirmation..."
add_row "T04-V4" "UI selection + confirmation" "WARN" "(P0) Voir B-27 Tache 6.2.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V5: Tests 8+ scenarios (P0)
echo "  Verifying T04-V5 : Tests 8+ scenarios..."
add_row "T04-V5" "Tests 8+ scenarios" "WARN" "(P0) Voir B-27 Tache 6.2.4 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 5/5 -- 6.2.5 : Comparaison Benchmark Tenants

```bash
echo ""
echo "================================================"
echo "TACHE 6.2.5 : Comparaison Benchmark Tenants"
echo "Priorite : P0 | Effort : 7h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T05-F1: Existence fichier repo/apps/web-insurtech-admin/app/[locale]/(protected)/tenants/benchmark/page.tsx
if [ -f "repo/apps/web-insurtech-admin/app/[locale]/(protected)/tenants/benchmark/page.tsx" ]; then
  add_row "T05-F1" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T05-F1" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T05-F2: Existence fichier repo/apps/web-insurtech-admin/components/benchmark/{several charts}.tsx
if [ -f "repo/apps/web-insurtech-admin/components/benchmark/{several charts}.tsx" ]; then
  add_row "T05-F2" "Fichier {several charts}.tsx existe" "PASS" "Cree"
else
  add_row "T05-F2" "Fichier {several charts}.tsx existe" "FAIL" "Manquant"
fi
# Test T05-F3: Existence fichier repo/packages/admin/src/services/benchmark.service.ts
if [ -f "repo/packages/admin/src/services/benchmark.service.ts" ]; then
  add_row "T05-F3" "Fichier benchmark.service.ts existe" "PASS" "Cree"
else
  add_row "T05-F3" "Fichier benchmark.service.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T05-V1: Tenants ranked (P0)
echo "  Verifying T05-V1 : Tenants ranked..."
add_row "T05-V1" "Tenants ranked" "WARN" "(P0) Voir B-27 Tache 6.2.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V2: Outliers detection statistical (P0)
echo "  Verifying T05-V2 : Outliers detection statistical..."
add_row "T05-V2" "Outliers detection statistical" "WARN" "(P0) Voir B-27 Tache 6.2.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V3: Charts comparison (P0)
echo "  Verifying T05-V3 : Charts comparison..."
add_row "T05-V3" "Charts comparison" "WARN" "(P0) Voir B-27 Tache 6.2.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V4: PDF export (P0)
echo "  Verifying T05-V4 : PDF export..."
add_row "T05-V4" "PDF export" "WARN" "(P0) Voir B-27 Tache 6.2.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V5: Tests 6+ scenarios (P0)
echo "  Verifying T05-V5 : Tests 6+ scenarios..."
add_row "T05-V5" "Tests 6+ scenarios" "WARN" "(P0) Voir B-27 Tache 6.2.5 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 6/5 -- 6.2.6 : Reports Tenant : Monthly + Quarterly

```bash
echo ""
echo "================================================"
echo "TACHE 6.2.6 : Reports Tenant : Monthly + Quarterly"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T06-F1: Existence fichier repo/packages/docs/src/templates/{fr,ar-MA,ar}/tenant-{monthly,qbr}-report.hbs
if [ -f "repo/packages/docs/src/templates/{fr,ar-MA,ar}/tenant-{monthly,qbr}-report.hbs" ]; then
  add_row "T06-F1" "Fichier tenant-{monthly,qbr}-report.hbs existe" "PASS" "Cree"
else
  add_row "T06-F1" "Fichier tenant-{monthly,qbr}-report.hbs existe" "FAIL" "Manquant"
fi
# Test T06-F2: Existence fichier repo/packages/admin/src/services/tenant-reports.service.ts
if [ -f "repo/packages/admin/src/services/tenant-reports.service.ts" ]; then
  add_row "T06-F2" "Fichier tenant-reports.service.ts existe" "PASS" "Cree"
else
  add_row "T06-F2" "Fichier tenant-reports.service.ts existe" "FAIL" "Manquant"
fi
# Test T06-F3: Existence fichier repo/packages/admin/src/jobs/tenant-reports-cron.ts
if [ -f "repo/packages/admin/src/jobs/tenant-reports-cron.ts" ]; then
  add_row "T06-F3" "Fichier tenant-reports-cron.ts existe" "PASS" "Cree"
else
  add_row "T06-F3" "Fichier tenant-reports-cron.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T06-V1: Monthly + QBR templates (P0)
echo "  Verifying T06-V1 : Monthly + QBR templates..."
add_row "T06-V1" "Monthly + QBR templates" "WARN" "(P0) Voir B-27 Tache 6.2.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V2: PDF generation (P0)
echo "  Verifying T06-V2 : PDF generation..."
add_row "T06-V2" "PDF generation" "WARN" "(P0) Voir B-27 Tache 6.2.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V3: Cron scheduled (P0)
echo "  Verifying T06-V3 : Cron scheduled..."
add_row "T06-V3" "Cron scheduled" "WARN" "(P0) Voir B-27 Tache 6.2.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V4: UI list + download (P0)
echo "  Verifying T06-V4 : UI list + download..."
add_row "T06-V4" "UI list + download" "WARN" "(P0) Voir B-27 Tache 6.2.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V5: Tests 6+ scenarios (P0)
echo "  Verifying T06-V5 : Tests 6+ scenarios..."
add_row "T06-V5" "Tests 6+ scenarios" "WARN" "(P0) Voir B-27 Tache 6.2.6 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 7/4 -- 6.2.7 : Configuration Platform-Wide

```bash
echo ""
echo "================================================"
echo "TACHE 6.2.7 : Configuration Platform-Wide"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 4"
echo "================================================"

# === Verification fichiers crees ===
# Test T07-F1: Existence fichier repo/packages/database/src/migrations/{date}-PlatformSettings.ts
if [ -f "repo/packages/database/src/migrations/{date}-PlatformSettings.ts" ]; then
  add_row "T07-F1" "Fichier {date}-PlatformSettings.ts existe" "PASS" "Cree"
else
  add_row "T07-F1" "Fichier {date}-PlatformSettings.ts existe" "FAIL" "Manquant"
fi
# Test T07-F2: Existence fichier repo/packages/admin/src/services/platform-settings.service.ts
if [ -f "repo/packages/admin/src/services/platform-settings.service.ts" ]; then
  add_row "T07-F2" "Fichier platform-settings.service.ts existe" "PASS" "Cree"
else
  add_row "T07-F2" "Fichier platform-settings.service.ts existe" "FAIL" "Manquant"
fi
# Test T07-F3: Existence fichier repo/apps/web-insurtech-admin/app/[locale]/(protected)/settings/platform/page.tsx
if [ -f "repo/apps/web-insurtech-admin/app/[locale]/(protected)/settings/platform/page.tsx" ]; then
  add_row "T07-F3" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T07-F3" "Fichier page.tsx existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T07-V1: Settings stored + cached (P0)
echo "  Verifying T07-V1 : Settings stored + cached..."
add_row "T07-V1" "Settings stored + cached" "WARN" "(P0) Voir B-27 Tache 6.2.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V2: super_admin only + audit (P0)
echo "  Verifying T07-V2 : super_admin only + audit..."
add_row "T07-V2" "super_admin only + audit" "WARN" "(P0) Voir B-27 Tache 6.2.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V3: UI sections complete (P0)
echo "  Verifying T07-V3 : UI sections complete..."
add_row "T07-V3" "UI sections complete" "WARN" "(P0) Voir B-27 Tache 6.2.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V4: Tests 5+ scenarios (P0)
echo "  Verifying T07-V4 : Tests 5+ scenarios..."
add_row "T07-V4" "Tests 5+ scenarios" "WARN" "(P0) Voir B-27 Tache 6.2.7 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 8/4 -- 6.2.8 : Impersonation History + Analytics

```bash
echo ""
echo "================================================"
echo "TACHE 6.2.8 : Impersonation History + Analytics"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 4"
echo "================================================"

# === Verification fichiers crees ===
# Test T08-F1: Existence fichier repo/apps/web-insurtech-admin/app/[locale]/(protected)/impersonation-history/page.tsx
if [ -f "repo/apps/web-insurtech-admin/app/[locale]/(protected)/impersonation-history/page.tsx" ]; then
  add_row "T08-F1" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T08-F1" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T08-F2: Existence fichier repo/apps/web-insurtech-admin/components/impersonation/{several}.tsx
if [ -f "repo/apps/web-insurtech-admin/components/impersonation/{several}.tsx" ]; then
  add_row "T08-F2" "Fichier {several}.tsx existe" "PASS" "Cree"
else
  add_row "T08-F2" "Fichier {several}.tsx existe" "FAIL" "Manquant"
fi
# Test T08-F3: Existence fichier repo/packages/admin/src/services/impersonation-analytics.service.ts
if [ -f "repo/packages/admin/src/services/impersonation-analytics.service.ts" ]; then
  add_row "T08-F3" "Fichier impersonation-analytics.service.ts existe" "PASS" "Cree"
else
  add_row "T08-F3" "Fichier impersonation-analytics.service.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T08-V1: History table + filters (P0)
echo "  Verifying T08-V1 : History table + filters..."
add_row "T08-V1" "History table + filters" "WARN" "(P0) Voir B-27 Tache 6.2.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V2: Analytics widgets (P0)
echo "  Verifying T08-V2 : Analytics widgets..."
add_row "T08-V2" "Analytics widgets" "WARN" "(P0) Voir B-27 Tache 6.2.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V3: Abuse alerts (P0)
echo "  Verifying T08-V3 : Abuse alerts..."
add_row "T08-V3" "Abuse alerts" "WARN" "(P0) Voir B-27 Tache 6.2.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V4: Tests 5+ scenarios (P0)
echo "  Verifying T08-V4 : Tests 5+ scenarios..."
add_row "T08-V4" "Tests 5+ scenarios" "WARN" "(P0) Voir B-27 Tache 6.2.8 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 9/3 -- 6.2.9 : Notifications Platform-Wide

```bash
echo ""
echo "================================================"
echo "TACHE 6.2.9 : Notifications Platform-Wide"
echo "Priorite : P1 | Effort : 4h"
echo "Criteres a verifier : 3"
echo "================================================"

# === Verification fichiers crees ===
# Test T09-F1: Existence fichier repo/apps/web-insurtech-admin/app/[locale]/(protected)/notifications-platform/page.tsx
if [ -f "repo/apps/web-insurtech-admin/app/[locale]/(protected)/notifications-platform/page.tsx" ]; then
  add_row "T09-F1" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T09-F1" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T09-F2: Existence fichier repo/packages/admin/src/services/platform-notifications.service.ts
if [ -f "repo/packages/admin/src/services/platform-notifications.service.ts" ]; then
  add_row "T09-F2" "Fichier platform-notifications.service.ts existe" "PASS" "Cree"
else
  add_row "T09-F2" "Fichier platform-notifications.service.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T09-V1: Form + preview (P1)
echo "  Verifying T09-V1 : Form + preview..."
add_row "T09-V1" "Form + preview" "WARN" "(P1) Voir B-27 Tache 6.2.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V2: Send mass (P1)
echo "  Verifying T09-V2 : Send mass..."
add_row "T09-V2" "Send mass" "WARN" "(P1) Voir B-27 Tache 6.2.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V3: Tests 4+ scenarios (P1)
echo "  Verifying T09-V3 : Tests 4+ scenarios..."
add_row "T09-V3" "Tests 4+ scenarios" "WARN" "(P1) Voir B-27 Tache 6.2.9 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 10/2 -- 6.2.10 : Endpoints REST + Permissions

```bash
echo ""
echo "================================================"
echo "TACHE 6.2.10 : Endpoints REST + Permissions"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 2"
echo "================================================"

# === Verification fichiers crees ===
# Test T10-F1: Existence fichier repo/packages/auth/src/rbac/permissions.enum.ts
if [ -f "repo/packages/auth/src/rbac/permissions.enum.ts" ]; then
  add_row "T10-F1" "Fichier permissions.enum.ts existe" "PASS" "Cree"
else
  add_row "T10-F1" "Fichier permissions.enum.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T10-V1: 15+ permissions (P0)
echo "  Verifying T10-V1 : 15+ permissions..."
add_row "T10-V1" "15+ permissions" "WARN" "(P0) Voir B-27 Tache 6.2.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V2: Tests RBAC 6+ scenarios (P0)
echo "  Verifying T10-V2 : Tests RBAC 6+ scenarios..."
add_row "T10-V2" "Tests RBAC 6+ scenarios" "WARN" "(P0) Voir B-27 Tache 6.2.10 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 11/3 -- 6.2.11 : Audit + Kafka + ETL

```bash
echo ""
echo "================================================"
echo "TACHE 6.2.11 : Audit + Kafka + ETL"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 3"
echo "================================================"

# === Verification fichiers crees ===
# Test T11-F1: Existence fichier repo/packages/analytics/src/etl/postgres-to-clickhouse.etl.ts
if [ -f "repo/packages/analytics/src/etl/postgres-to-clickhouse.etl.ts" ]; then
  add_row "T11-F1" "Fichier postgres-to-clickhouse.etl.ts existe" "PASS" "Cree"
else
  add_row "T11-F1" "Fichier postgres-to-clickhouse.etl.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T11-V1: 7+ Kafka events (P0)
echo "  Verifying T11-V1 : 7+ Kafka events..."
add_row "T11-V1" "7+ Kafka events" "WARN" "(P0) Voir B-27 Tache 6.2.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V2: ETL clickhouse (P0)
echo "  Verifying T11-V2 : ETL clickhouse..."
add_row "T11-V2" "ETL clickhouse" "WARN" "(P0) Voir B-27 Tache 6.2.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V3: Tests 4+ scenarios (P0)
echo "  Verifying T11-V3 : Tests 4+ scenarios..."
add_row "T11-V3" "Tests 4+ scenarios" "WARN" "(P0) Voir B-27 Tache 6.2.11 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 12/5 -- 6.2.12 : Tests E2E + WCAG + Lighthouse

```bash
echo ""
echo "================================================"
echo "TACHE 6.2.12 : Tests E2E + WCAG + Lighthouse"
echo "Priorite : P0 | Effort : 8h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T12-F1: Existence fichier repo/apps/web-insurtech-admin/e2e/sprint-27/{15+ specs}.spec.ts
if [ -f "repo/apps/web-insurtech-admin/e2e/sprint-27/{15+ specs}.spec.ts" ]; then
  add_row "T12-F1" "Fichier {15+ specs}.spec.ts existe" "PASS" "Cree"
else
  add_row "T12-F1" "Fichier {15+ specs}.spec.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T12-V1: 15+ tests passent (P0)
echo "  Verifying T12-V1 : 15+ tests passent..."
add_row "T12-V1" "15+ tests passent" "WARN" "(P0) Voir B-27 Tache 6.2.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V2: Lighthouse green (P0)
echo "  Verifying T12-V2 : Lighthouse green..."
add_row "T12-V2" "Lighthouse green" "WARN" "(P0) Voir B-27 Tache 6.2.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V3: WCAG AA (P0)
echo "  Verifying T12-V3 : WCAG AA..."
add_row "T12-V3" "WCAG AA" "WARN" "(P0) Voir B-27 Tache 6.2.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V4: CI green (P0)
echo "  Verifying T12-V4 : CI green..."
add_row "T12-V4" "CI green" "WARN" "(P0) Voir B-27 Tache 6.2.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V5: Reproducibility 5x (P0)
echo "  Verifying T12-V5 : Reproducibility 5x..."
add_row "T12-V5" "Reproducibility 5x" "WARN" "(P0) Voir B-27 Tache 6.2.12 pour test detaille - critere a auto-tester via script ad-hoc"

```

---


---


## VERIFICATIONS TRANSVERSALES SPRINT 27

### TR-BUILD : Build complet du sprint

```bash
echo ""
echo "================================================"
echo "VERIFICATIONS TRANSVERSALES SPRINT 27"
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

### TR-MIGRATIONS : Migrations DB Sprint 27

```bash
echo "=== TR-MIGRATIONS : Migrations DB ==="
MIGR_COUNT=$(pg_query "SELECT COUNT(*) FROM migrations WHERE name LIKE '%sprint27%' OR name LIKE '%Sprint27%'" || echo 0)
if [ "$MIGR_COUNT" -gt 0 ]; then
  add_row "TR-MIG" "Migrations Sprint 27 appliquees" "PASS" "$MIGR_COUNT migrations"
else
  add_row "TR-MIG" "Migrations Sprint 27 appliquees" "WARN" "Aucune migration detectee (verifier)"
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
echo "GENERATION DU RAPPORT FINAL SPRINT 27"
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

## Jalon GO/NO-GO Sprint 27

EOF

# Calcul statut final
if (( $(echo "$SCORE >= 95" | bc -l) )); then
  STATUT="GO"
  cat >> "$REPORT_FILE" << EOF
**STATUT** : GO -- Sprint 27 valide, passage Sprint 28 autorise

Le sprint a passe les criteres requis. Cowork peut demarrer Sprint 28.

EOF
  echo ""
  echo "================================================"
  echo "SPRINT 27 : GO ($SCORE%)"
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
  echo "SPRINT 27 : GO CONDITIONNEL ($SCORE%)"
  echo "================================================"
else
  STATUT="NO-GO"
  cat >> "$REPORT_FILE" << EOF
**STATUT** : NO-GO -- Score $SCORE% trop bas (cible 85% minimum)

Le sprint **doit etre repris** :
- Lister tous FAIL P0
- Escalation Saad/Abla decision (cut scope OR delai)
- Reprise sprint avant Sprint 28

EOF
  echo ""
  echo "================================================"
  echo "SPRINT 27 : NO-GO ($SCORE%)"
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
  echo "git commit -m \"chore(sprint-27): close sprint 27 -- $STATUT ($SCORE%)\"" >> "$REPORT_FILE"
  echo '```' >> "$REPORT_FILE"
fi

echo ""
echo "Rapport complet dans : $REPORT_FILE"
```

---

## INSTRUCTION FINALE A CLAUDE CODE / COWORK

Apres l'execution complete des verifications ci-dessus :

1. **Lis le contenu de `sprint27-verify-report.md`** integralement
2. **Identifie les FAIL critiques** (criteres P0) qui necessitent intervention manuelle
3. **Affiche un resume executif** :
   - Nombre total de criteres
   - Pourcentage PASS / PASS\* / FAIL / WARN
   - Liste des FAIL avec contexte technique
   - Recommandation : GO / GO CONDITIONNEL / NO-GO
4. **Si NO-GO** : ne pas demarrer le Sprint suivant, alerter Saad/Abla via Slack `#insurtech-dev`
5. **Si GO ou GO CONDITIONNEL** : produire le commit de cloture du sprint :

```bash
git add skalean-insurtech/sprint27-verify-report.md
git commit -m "chore(sprint-27): close sprint 27 with verification report

- Verification automatique executee
- Score global : <SCORE>%
- <PASS> criteres PASS, <PASS_REPAIRED> reparations auto, <FAIL> FAIL
- Statut : <GO|GO CONDITIONNEL|NO-GO>

Phase: 6 -- Admin Platform
Sprint: 27 (Phase 6 / Sprint 2)
Reference B-27, C-27, V-27
Report: sprint27-verify-report.md"
```

6. **Documentation continue** : si decisions techniques prises pendant verification, ajouter notes dans `repo/docs/runbooks/sprint-27-lessons-learned.md`

---

**Fin de la verification V-27 v2.2 detaillee -- Sprint 27 (6.2) Tenants Management (onboarding wizard + billing).**

**Total criteres taches** : 52 | **Total transversaux** : ~10 | **Effort sprint** : 70h
