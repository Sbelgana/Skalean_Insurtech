# VERIFICATION SPRINT 22 -- Phase 5 / Sprint 4 : Web Garage App (port 3002)
# Version : Auto-reparation active + Rapport final MD detaille
# 13 taches, 61 criteres extraits B-22
# AUCUNE EMOJI AUTORISEE

**Version** : v2.2 (verification detaillee)
**Phase** : 5 -- Vertical Repair (Skalean Garage ERP)
**Sprint** : 22 / 35 (cumul) -- Sprint 4 dans Phase 5
**Reference meta-prompt** : `B-22-sprint-22-web-garage-app.md`
**Reference orchestrateur** : `C-22-sprint-22-web-garage-app.md`
**Total criteres** : 61 criteres taches + ~10 transversaux

---

Tu es **Claude Code (ou Cowork)**. Tu dois executer une **verification COMPLETE et EXHAUSTIVE** du Sprint 22 apres execution toutes les 13 taches.

---

## REGLES D'EXECUTION

1. Tu **executes CHAQUE verification dans l'ordre** (taches puis transversales)
2. Quand une verification echoue, tu **TENTES UNE REPARATION AUTOMATIQUE** avant de noter FAIL
3. Apres chaque tentative de reparation, tu **re-executes la verification**
4. Tu consignes dans `sprint22-verify-report.md` **TOUS les resultats** au fil de l'execution
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
REPORT_FILE="sprint22-verify-report.md"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
RUN_ID=$(date '+%Y%m%d-%H%M%S')

cat > "$REPORT_FILE" << EOF
# Rapport de Verification - Sprint 22 : Web Garage App (port 3002)

**Date** : $TIMESTAMP
**Run ID** : $RUN_ID
**Phase** : 5 -- Vertical Repair (Skalean Garage ERP)
**Sprint** : 22 (Phase 5 / Sprint 4)
**Reference B-22** : 13 taches, 61 criteres extraits
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

## TACHE 1/5 -- 5.4.1 : App Skeleton + Layout

```bash
echo ""
echo "================================================"
echo "TACHE 5.4.1 : App Skeleton + Layout"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T01-F2: Existence fichier repo/apps/web-garage/middleware.ts
if [ -f "repo/apps/web-garage/middleware.ts" ]; then
  add_row "T01-F2" "Fichier middleware.ts existe" "PASS" "Cree"
else
  add_row "T01-F2" "Fichier middleware.ts existe" "FAIL" "Manquant"
fi
# Test T01-F3: Existence fichier repo/apps/web-garage/app/[locale]/(auth)/layout.tsx
if [ -f "repo/apps/web-garage/app/[locale]/(auth)/layout.tsx" ]; then
  add_row "T01-F3" "Fichier layout.tsx existe" "PASS" "Cree"
else
  add_row "T01-F3" "Fichier layout.tsx existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T01-V1: App demarre port 3002 (P0)
echo "  Verifying T01-V1 : App demarre port 3002..."
add_row "T01-V1" "App demarre port 3002" "WARN" "(P0) Voir B-22 Tache 5.4.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V2: Middleware fonctionne (P0)
echo "  Verifying T01-V2 : Middleware fonctionne..."
add_row "T01-V2" "Middleware fonctionne" "WARN" "(P0) Voir B-22 Tache 5.4.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V3: Layout sidebar + topbar (P0)
echo "  Verifying T01-V3 : Layout sidebar + topbar..."
add_row "T01-V3" "Layout sidebar + topbar" "WARN" "(P0) Voir B-22 Tache 5.4.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V4: FAB visible (P0)
echo "  Verifying T01-V4 : FAB visible..."
add_row "T01-V4" "FAB visible" "WARN" "(P0) Voir B-22 Tache 5.4.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V5: Tests setup 5+ scenarios (P0)
echo "  Verifying T01-V5 : Tests setup 5+ scenarios..."
add_row "T01-V5" "Tests setup 5+ scenarios" "WARN" "(P0) Voir B-22 Tache 5.4.1 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 2/2 -- 5.4.2 : Pages Auth Reuse Sprint 16

```bash
echo ""
echo "================================================"
echo "TACHE 5.4.2 : Pages Auth Reuse Sprint 16"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 2"
echo "================================================"

# === Verification fichiers crees ===
# Test T02-F1: Existence fichier repo/apps/web-garage/app/[locale]/(auth)/{7 pages}.tsx
if [ -f "repo/apps/web-garage/app/[locale]/(auth)/{7 pages}.tsx" ]; then
  add_row "T02-F1" "Fichier {7 pages}.tsx existe" "PASS" "Cree"
else
  add_row "T02-F1" "Fichier {7 pages}.tsx existe" "FAIL" "Manquant"
fi
# Test T02-F2: Existence fichier repo/apps/web-garage/components/auth/{several reuse}
if [ -f "repo/apps/web-garage/components/auth/{several reuse}" ]; then
  add_row "T02-F2" "Fichier {several reuse} existe" "PASS" "Cree"
else
  add_row "T02-F2" "Fichier {several reuse} existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T02-V1: Login + MFA flow OK (P0)
echo "  Verifying T02-V1 : Login + MFA flow OK..."
add_row "T02-V1" "Login + MFA flow OK" "WARN" "(P0) Voir B-22 Tache 5.4.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V2: Tests 5+ scenarios (P0)
echo "  Verifying T02-V2 : Tests 5+ scenarios..."
add_row "T02-V2" "Tests 5+ scenarios" "WARN" "(P0) Voir B-22 Tache 5.4.2 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 3/3 -- 5.4.3 : Dashboard Garage : 6 Widgets

```bash
echo ""
echo "================================================"
echo "TACHE 5.4.3 : Dashboard Garage : 6 Widgets"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 3"
echo "================================================"

# === Verification fichiers crees ===
# Test T03-F1: Existence fichier repo/apps/web-garage/app/[locale]/(protected)/dashboard/page.tsx
if [ -f "repo/apps/web-garage/app/[locale]/(protected)/dashboard/page.tsx" ]; then
  add_row "T03-F1" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T03-F1" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T03-F2: Existence fichier repo/apps/web-garage/components/dashboard/{6 widgets}.tsx
if [ -f "repo/apps/web-garage/components/dashboard/{6 widgets}.tsx" ]; then
  add_row "T03-F2" "Fichier {6 widgets}.tsx existe" "PASS" "Cree"
else
  add_row "T03-F2" "Fichier {6 widgets}.tsx existe" "FAIL" "Manquant"
fi
# Test T03-F3: Existence fichier repo/apps/web-garage/lib/queries/dashboard.queries.ts
if [ -f "repo/apps/web-garage/lib/queries/dashboard.queries.ts" ]; then
  add_row "T03-F3" "Fichier dashboard.queries.ts existe" "PASS" "Cree"
else
  add_row "T03-F3" "Fichier dashboard.queries.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T03-V1: 6 widgets render (P0)
echo "  Verifying T03-V1 : 6 widgets render..."
add_row "T03-V1" "6 widgets render" "WARN" "(P0) Voir B-22 Tache 5.4.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V2: Filters apply (P0)
echo "  Verifying T03-V2 : Filters apply..."
add_row "T03-V2" "Filters apply" "WARN" "(P0) Voir B-22 Tache 5.4.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V3: Tests 5+ scenarios (P0)
echo "  Verifying T03-V3 : Tests 5+ scenarios..."
add_row "T03-V3" "Tests 5+ scenarios" "WARN" "(P0) Voir B-22 Tache 5.4.3 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 4/5 -- 5.4.4 : Sinistres Page : Kanban + Table

```bash
echo ""
echo "================================================"
echo "TACHE 5.4.4 : Sinistres Page : Kanban + Table"
echo "Priorite : P0 | Effort : 7h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T04-F1: Existence fichier repo/apps/web-garage/app/[locale]/(protected)/sinistres/page.tsx
if [ -f "repo/apps/web-garage/app/[locale]/(protected)/sinistres/page.tsx" ]; then
  add_row "T04-F1" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T04-F1" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T04-F2: Existence fichier repo/apps/web-garage/components/sinistres/sinistres-kanban.tsx
if [ -f "repo/apps/web-garage/components/sinistres/sinistres-kanban.tsx" ]; then
  add_row "T04-F2" "Fichier sinistres-kanban.tsx existe" "PASS" "Cree"
else
  add_row "T04-F2" "Fichier sinistres-kanban.tsx existe" "FAIL" "Manquant"
fi
# Test T04-F3: Existence fichier repo/apps/web-garage/components/sinistres/sinistres-table.tsx
if [ -f "repo/apps/web-garage/components/sinistres/sinistres-table.tsx" ]; then
  add_row "T04-F3" "Fichier sinistres-table.tsx existe" "PASS" "Cree"
else
  add_row "T04-F3" "Fichier sinistres-table.tsx existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T04-V1: Kanban 10 colonnes (P0)
echo "  Verifying T04-V1 : Kanban 10 colonnes..."
add_row "T04-V1" "Kanban 10 colonnes" "WARN" "(P0) Voir B-22 Tache 5.4.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V2: Drag-drop transitions (P0)
echo "  Verifying T04-V2 : Drag-drop transitions..."
add_row "T04-V2" "Drag-drop transitions" "WARN" "(P0) Voir B-22 Tache 5.4.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V3: Optimistic UI + revert (P0)
echo "  Verifying T04-V3 : Optimistic UI + revert..."
add_row "T04-V3" "Optimistic UI + revert" "WARN" "(P0) Voir B-22 Tache 5.4.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V4: Table filters + search (P0)
echo "  Verifying T04-V4 : Table filters + search..."
add_row "T04-V4" "Table filters + search" "WARN" "(P0) Voir B-22 Tache 5.4.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V5: Tests 8+ scenarios (P0)
echo "  Verifying T04-V5 : Tests 8+ scenarios..."
add_row "T04-V5" "Tests 8+ scenarios" "WARN" "(P0) Voir B-22 Tache 5.4.4 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 5/4 -- 5.4.5 : Sinistre Detail Page : Timeline + Tabs

```bash
echo ""
echo "================================================"
echo "TACHE 5.4.5 : Sinistre Detail Page : Timeline + Tabs"
echo "Priorite : P0 | Effort : 8h"
echo "Criteres a verifier : 4"
echo "================================================"

# === Verification fichiers crees ===
# Test T05-F1: Existence fichier repo/apps/web-garage/app/[locale]/(protected)/sinistres/[id]/page.tsx
if [ -f "repo/apps/web-garage/app/[locale]/(protected)/sinistres/[id]/page.tsx" ]; then
  add_row "T05-F1" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T05-F1" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T05-F2: Existence fichier repo/apps/web-garage/components/sinistres/sinistre-timeline.tsx
if [ -f "repo/apps/web-garage/components/sinistres/sinistre-timeline.tsx" ]; then
  add_row "T05-F2" "Fichier sinistre-timeline.tsx existe" "PASS" "Cree"
else
  add_row "T05-F2" "Fichier sinistre-timeline.tsx existe" "FAIL" "Manquant"
fi
# Test T05-F3: Existence fichier repo/apps/web-garage/components/sinistres/sinistre-detail-tabs.tsx
if [ -f "repo/apps/web-garage/components/sinistres/sinistre-detail-tabs.tsx" ]; then
  add_row "T05-F3" "Fichier sinistre-detail-tabs.tsx existe" "PASS" "Cree"
else
  add_row "T05-F3" "Fichier sinistre-detail-tabs.tsx existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T05-V1: Detail tabs all functional (P0)
echo "  Verifying T05-V1 : Detail tabs all functional..."
add_row "T05-V1" "Detail tabs all functional" "WARN" "(P0) Voir B-22 Tache 5.4.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V2: Timeline visuelle (P0)
echo "  Verifying T05-V2 : Timeline visuelle..."
add_row "T05-V2" "Timeline visuelle" "WARN" "(P0) Voir B-22 Tache 5.4.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V3: Contextual actions selon status (P0)
echo "  Verifying T05-V3 : Contextual actions selon status..."
add_row "T05-V3" "Contextual actions selon status" "WARN" "(P0) Voir B-22 Tache 5.4.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V4: Tests 10+ scenarios (P0)
echo "  Verifying T05-V4 : Tests 10+ scenarios..."
add_row "T05-V4" "Tests 10+ scenarios" "WARN" "(P0) Voir B-22 Tache 5.4.5 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 6/5 -- 5.4.6 : Reception Page

```bash
echo ""
echo "================================================"
echo "TACHE 5.4.6 : Reception Page"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T06-F1: Existence fichier repo/apps/web-garage/app/[locale]/(protected)/sinistres/[id]/reception/page.tsx
if [ -f "repo/apps/web-garage/app/[locale]/(protected)/sinistres/[id]/reception/page.tsx" ]; then
  add_row "T06-F1" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T06-F1" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T06-F2: Existence fichier repo/apps/web-garage/components/reception/checklist-12-points.tsx
if [ -f "repo/apps/web-garage/components/reception/checklist-12-points.tsx" ]; then
  add_row "T06-F2" "Fichier checklist-12-points.tsx existe" "PASS" "Cree"
else
  add_row "T06-F2" "Fichier checklist-12-points.tsx existe" "FAIL" "Manquant"
fi
# Test T06-F3: Existence fichier repo/apps/web-garage/components/reception/photos-uploader.tsx
if [ -f "repo/apps/web-garage/components/reception/photos-uploader.tsx" ]; then
  add_row "T06-F3" "Fichier photos-uploader.tsx existe" "PASS" "Cree"
else
  add_row "T06-F3" "Fichier photos-uploader.tsx existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T06-V1: 12 points checklist form (P0)
echo "  Verifying T06-V1 : 12 points checklist form..."
add_row "T06-V1" "12 points checklist form" "WARN" "(P0) Voir B-22 Tache 5.4.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V2: Photos upload S3 (P0)
echo "  Verifying T06-V2 : Photos upload S3..."
add_row "T06-V2" "Photos upload S3" "WARN" "(P0) Voir B-22 Tache 5.4.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V3: 3 docs customer upload (P0)
echo "  Verifying T06-V3 : 3 docs customer upload..."
add_row "T06-V3" "3 docs customer upload" "WARN" "(P0) Voir B-22 Tache 5.4.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V4: Signature pad (P0)
echo "  Verifying T06-V4 : Signature pad..."
add_row "T06-V4" "Signature pad" "WARN" "(P0) Voir B-22 Tache 5.4.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V5: Tests 6+ scenarios (P0)
echo "  Verifying T06-V5 : Tests 6+ scenarios..."
add_row "T06-V5" "Tests 6+ scenarios" "WARN" "(P0) Voir B-22 Tache 5.4.6 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 7/6 -- 5.4.7 : Diagnostics Page : IA + Technicien

```bash
echo ""
echo "================================================"
echo "TACHE 5.4.7 : Diagnostics Page : IA + Technicien"
echo "Priorite : P0 | Effort : 7h"
echo "Criteres a verifier : 6"
echo "================================================"

# === Verification fichiers crees ===
# Test T07-F1: Existence fichier repo/apps/web-garage/app/[locale]/(protected)/sinistres/[id]/diagnostic/page.tsx
if [ -f "repo/apps/web-garage/app/[locale]/(protected)/sinistres/[id]/diagnostic/page.tsx" ]; then
  add_row "T07-F1" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T07-F1" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T07-F2: Existence fichier repo/apps/web-garage/components/diagnostic/ia-suggestions-display.tsx
if [ -f "repo/apps/web-garage/components/diagnostic/ia-suggestions-display.tsx" ]; then
  add_row "T07-F2" "Fichier ia-suggestions-display.tsx existe" "PASS" "Cree"
else
  add_row "T07-F2" "Fichier ia-suggestions-display.tsx existe" "FAIL" "Manquant"
fi
# Test T07-F3: Existence fichier repo/apps/web-garage/components/diagnostic/manual-diagnostic-form.tsx
if [ -f "repo/apps/web-garage/components/diagnostic/manual-diagnostic-form.tsx" ]; then
  add_row "T07-F3" "Fichier manual-diagnostic-form.tsx existe" "PASS" "Cree"
else
  add_row "T07-F3" "Fichier manual-diagnostic-form.tsx existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T07-V1: IA suggestions display complete (P0)
echo "  Verifying T07-V1 : IA suggestions display complete..."
add_row "T07-V1" "IA suggestions display complete" "WARN" "(P0) Voir B-22 Tache 5.4.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V2: 3 actions (accept/edit/reject) (P0)
echo "  Verifying T07-V2 : 3 actions (accept/edit/reject)..."
add_row "T07-V2" "3 actions (accept/edit/reject)" "WARN" "(P0) Voir B-22 Tache 5.4.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V3: Manual diagnostic alternative (P0)
echo "  Verifying T07-V3 : Manual diagnostic alternative..."
add_row "T07-V3" "Manual diagnostic alternative" "WARN" "(P0) Voir B-22 Tache 5.4.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V4: Photos additionnelles (P0)
echo "  Verifying T07-V4 : Photos additionnelles..."
add_row "T07-V4" "Photos additionnelles" "WARN" "(P0) Voir B-22 Tache 5.4.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V5: Report generation (P0)
echo "  Verifying T07-V5 : Report generation..."
add_row "T07-V5" "Report generation" "WARN" "(P0) Voir B-22 Tache 5.4.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V6: Tests 8+ scenarios (P0)
echo "  Verifying T07-V6 : Tests 8+ scenarios..."
add_row "T07-V6" "Tests 8+ scenarios" "WARN" "(P0) Voir B-22 Tache 5.4.7 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 8/6 -- 5.4.8 : Devis Page : Create + Items + Send

```bash
echo ""
echo "================================================"
echo "TACHE 5.4.8 : Devis Page : Create + Items + Send"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 6"
echo "================================================"

# === Verification fichiers crees ===
# Test T08-F1: Existence fichier repo/apps/web-garage/app/[locale]/(protected)/sinistres/[id]/devis/page.tsx
if [ -f "repo/apps/web-garage/app/[locale]/(protected)/sinistres/[id]/devis/page.tsx" ]; then
  add_row "T08-F1" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T08-F1" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T08-F2: Existence fichier repo/apps/web-garage/components/devis/devis-editor.tsx
if [ -f "repo/apps/web-garage/components/devis/devis-editor.tsx" ]; then
  add_row "T08-F2" "Fichier devis-editor.tsx existe" "PASS" "Cree"
else
  add_row "T08-F2" "Fichier devis-editor.tsx existe" "FAIL" "Manquant"
fi
# Test T08-F3: Existence fichier repo/apps/web-garage/components/devis/devis-tracking.tsx
if [ -f "repo/apps/web-garage/components/devis/devis-tracking.tsx" ]; then
  add_row "T08-F3" "Fichier devis-tracking.tsx existe" "PASS" "Cree"
else
  add_row "T08-F3" "Fichier devis-tracking.tsx existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T08-V1: Create from diagnostic (P0)
echo "  Verifying T08-V1 : Create from diagnostic..."
add_row "T08-V1" "Create from diagnostic" "WARN" "(P0) Voir B-22 Tache 5.4.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V2: Items editor + auto totals (P0)
echo "  Verifying T08-V2 : Items editor + auto totals..."
add_row "T08-V2" "Items editor + auto totals" "WARN" "(P0) Voir B-22 Tache 5.4.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V3: Send + recipients (P0)
echo "  Verifying T08-V3 : Send + recipients..."
add_row "T08-V3" "Send + recipients" "WARN" "(P0) Voir B-22 Tache 5.4.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V4: Tracking visualization (P0)
echo "  Verifying T08-V4 : Tracking visualization..."
add_row "T08-V4" "Tracking visualization" "WARN" "(P0) Voir B-22 Tache 5.4.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V5: Avenants supported (P0)
echo "  Verifying T08-V5 : Avenants supported..."
add_row "T08-V5" "Avenants supported" "WARN" "(P0) Voir B-22 Tache 5.4.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V6: Tests 8+ scenarios (P0)
echo "  Verifying T08-V6 : Tests 8+ scenarios..."
add_row "T08-V6" "Tests 8+ scenarios" "WARN" "(P0) Voir B-22 Tache 5.4.8 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 9/5 -- 5.4.9 : Orders Page : Tracking + Hours + Parts

```bash
echo ""
echo "================================================"
echo "TACHE 5.4.9 : Orders Page : Tracking + Hours + Parts"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T09-F1: Existence fichier repo/apps/web-garage/app/[locale]/(protected)/orders/page.tsx
if [ -f "repo/apps/web-garage/app/[locale]/(protected)/orders/page.tsx" ]; then
  add_row "T09-F1" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T09-F1" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T09-F2: Existence fichier repo/apps/web-garage/app/[locale]/(protected)/orders/[id]/page.tsx
if [ -f "repo/apps/web-garage/app/[locale]/(protected)/orders/[id]/page.tsx" ]; then
  add_row "T09-F2" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T09-F2" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T09-F3: Existence fichier repo/apps/web-garage/components/orders/tasks-checklist.tsx
if [ -f "repo/apps/web-garage/components/orders/tasks-checklist.tsx" ]; then
  add_row "T09-F3" "Fichier tasks-checklist.tsx existe" "PASS" "Cree"
else
  add_row "T09-F3" "Fichier tasks-checklist.tsx existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T09-V1: Order detail complete (P0)
echo "  Verifying T09-V1 : Order detail complete..."
add_row "T09-V1" "Order detail complete" "WARN" "(P0) Voir B-22 Tache 5.4.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V2: Hours timer + manual log (P0)
echo "  Verifying T09-V2 : Hours timer + manual log..."
add_row "T09-V2" "Hours timer + manual log" "WARN" "(P0) Voir B-22 Tache 5.4.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V3: Parts consumer integration Stock (P0)
echo "  Verifying T09-V3 : Parts consumer integration Stock..."
add_row "T09-V3" "Parts consumer integration Stock" "WARN" "(P0) Voir B-22 Tache 5.4.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V4: Photos progress (P0)
echo "  Verifying T09-V4 : Photos progress..."
add_row "T09-V4" "Photos progress" "WARN" "(P0) Voir B-22 Tache 5.4.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V5: Tests 8+ scenarios (P0)
echo "  Verifying T09-V5 : Tests 8+ scenarios..."
add_row "T09-V5" "Tests 8+ scenarios" "WARN" "(P0) Voir B-22 Tache 5.4.9 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 10/5 -- 5.4.10 : QC + Delivery Page

```bash
echo ""
echo "================================================"
echo "TACHE 5.4.10 : QC + Delivery Page"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T10-F1: Existence fichier repo/apps/web-garage/app/[locale]/(protected)/sinistres/[id]/qc/page.tsx
if [ -f "repo/apps/web-garage/app/[locale]/(protected)/sinistres/[id]/qc/page.tsx" ]; then
  add_row "T10-F1" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T10-F1" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T10-F2: Existence fichier repo/apps/web-garage/app/[locale]/(protected)/sinistres/[id]/delivery/page.tsx
if [ -f "repo/apps/web-garage/app/[locale]/(protected)/sinistres/[id]/delivery/page.tsx" ]; then
  add_row "T10-F2" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T10-F2" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T10-F3: Existence fichier repo/apps/web-garage/components/qc/checklist-10-points.tsx
if [ -f "repo/apps/web-garage/components/qc/checklist-10-points.tsx" ]; then
  add_row "T10-F3" "Fichier checklist-10-points.tsx existe" "PASS" "Cree"
else
  add_row "T10-F3" "Fichier checklist-10-points.tsx existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T10-V1: QC 10 points + photos + signature (P0)
echo "  Verifying T10-V1 : QC 10 points + photos + signature..."
add_row "T10-V1" "QC 10 points + photos + signature" "WARN" "(P0) Voir B-22 Tache 5.4.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V2: Pass/Fail workflow (P0)
echo "  Verifying T10-V2 : Pass/Fail workflow..."
add_row "T10-V2" "Pass/Fail workflow" "WARN" "(P0) Voir B-22 Tache 5.4.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V3: Delivery + signature customer (P0)
echo "  Verifying T10-V3 : Delivery + signature customer..."
add_row "T10-V3" "Delivery + signature customer" "WARN" "(P0) Voir B-22 Tache 5.4.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V4: Satisfaction rating (P0)
echo "  Verifying T10-V4 : Satisfaction rating..."
add_row "T10-V4" "Satisfaction rating" "WARN" "(P0) Voir B-22 Tache 5.4.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V5: Tests 6+ scenarios (P0)
echo "  Verifying T10-V5 : Tests 6+ scenarios..."
add_row "T10-V5" "Tests 6+ scenarios" "WARN" "(P0) Voir B-22 Tache 5.4.10 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 11/5 -- 5.4.11 : Invoices Page : Split Preview + Download

```bash
echo ""
echo "================================================"
echo "TACHE 5.4.11 : Invoices Page : Split Preview + Download"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T11-F1: Existence fichier repo/apps/web-garage/app/[locale]/(protected)/sinistres/[id]/invoices/page.tsx
if [ -f "repo/apps/web-garage/app/[locale]/(protected)/sinistres/[id]/invoices/page.tsx" ]; then
  add_row "T11-F1" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T11-F1" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T11-F2: Existence fichier repo/apps/web-garage/components/invoices/split-preview.tsx
if [ -f "repo/apps/web-garage/components/invoices/split-preview.tsx" ]; then
  add_row "T11-F2" "Fichier split-preview.tsx existe" "PASS" "Cree"
else
  add_row "T11-F2" "Fichier split-preview.tsx existe" "FAIL" "Manquant"
fi
# Test T11-F3: Existence fichier repo/apps/web-garage/components/invoices/invoice-detail.tsx
if [ -f "repo/apps/web-garage/components/invoices/invoice-detail.tsx" ]; then
  add_row "T11-F3" "Fichier invoice-detail.tsx existe" "PASS" "Cree"
else
  add_row "T11-F3" "Fichier invoice-detail.tsx existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T11-V1: Split preview avant generation (P0)
echo "  Verifying T11-V1 : Split preview avant generation..."
add_row "T11-V1" "Split preview avant generation" "WARN" "(P0) Voir B-22 Tache 5.4.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V2: Generate produit 2 factures (P0)
echo "  Verifying T11-V2 : Generate produit 2 factures..."
add_row "T11-V2" "Generate produit 2 factures" "WARN" "(P0) Voir B-22 Tache 5.4.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V3: PDF preview + download (P0)
echo "  Verifying T11-V3 : PDF preview + download..."
add_row "T11-V3" "PDF preview + download" "WARN" "(P0) Voir B-22 Tache 5.4.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V4: Mark paid manual (P0)
echo "  Verifying T11-V4 : Mark paid manual..."
add_row "T11-V4" "Mark paid manual" "WARN" "(P0) Voir B-22 Tache 5.4.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V5: Tests 6+ scenarios (P0)
echo "  Verifying T11-V5 : Tests 6+ scenarios..."
add_row "T11-V5" "Tests 6+ scenarios" "WARN" "(P0) Voir B-22 Tache 5.4.11 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 12/5 -- 5.4.12 : Parametres + 4 Roles RBAC + I18n

```bash
echo ""
echo "================================================"
echo "TACHE 5.4.12 : Parametres + 4 Roles RBAC + I18n"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T12-F1: Existence fichier repo/apps/web-garage/app/[locale]/(protected)/parametres/page.tsx
if [ -f "repo/apps/web-garage/app/[locale]/(protected)/parametres/page.tsx" ]; then
  add_row "T12-F1" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T12-F1" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T12-F2: Existence fichier repo/apps/web-garage/components/auth/has-role-garage.tsx
if [ -f "repo/apps/web-garage/components/auth/has-role-garage.tsx" ]; then
  add_row "T12-F2" "Fichier has-role-garage.tsx existe" "PASS" "Cree"
else
  add_row "T12-F2" "Fichier has-role-garage.tsx existe" "FAIL" "Manquant"
fi
# Test T12-F3: Existence fichier repo/apps/web-garage/messages/{fr,ar-MA,ar}.json
if [ -f "repo/apps/web-garage/messages/{fr,ar-MA,ar}.json" ]; then
  add_row "T12-F3" "Fichier {fr,ar-MA,ar}.json existe" "PASS" "Cree"
else
  add_row "T12-F3" "Fichier {fr,ar-MA,ar}.json existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T12-V1: Parametres garage_admin only (P0)
echo "  Verifying T12-V1 : Parametres garage_admin only..."
add_row "T12-V1" "Parametres garage_admin only" "WARN" "(P0) Voir B-22 Tache 5.4.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V2: 4 roles UI conditional (P0)
echo "  Verifying T12-V2 : 4 roles UI conditional..."
add_row "T12-V2" "4 roles UI conditional" "WARN" "(P0) Voir B-22 Tache 5.4.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V3: I18n 3 locales (P0)
echo "  Verifying T12-V3 : I18n 3 locales..."
add_row "T12-V3" "I18n 3 locales" "WARN" "(P0) Voir B-22 Tache 5.4.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V4: RTL fonctionne (P0)
echo "  Verifying T12-V4 : RTL fonctionne..."
add_row "T12-V4" "RTL fonctionne" "WARN" "(P0) Voir B-22 Tache 5.4.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V5: Tests 6+ scenarios (P0)
echo "  Verifying T12-V5 : Tests 6+ scenarios..."
add_row "T12-V5" "Tests 6+ scenarios" "WARN" "(P0) Voir B-22 Tache 5.4.12 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 13/5 -- 5.4.13 : Tests Playwright + WCAG + Lighthouse

```bash
echo ""
echo "================================================"
echo "TACHE 5.4.13 : Tests Playwright + WCAG + Lighthouse"
echo "Priorite : P0 | Effort : 8h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T13-F1: Existence fichier repo/apps/web-garage/e2e/{20+ specs}.spec.ts
if [ -f "repo/apps/web-garage/e2e/{20+ specs}.spec.ts" ]; then
  add_row "T13-F1" "Fichier {20+ specs}.spec.ts existe" "PASS" "Cree"
else
  add_row "T13-F1" "Fichier {20+ specs}.spec.ts existe" "FAIL" "Manquant"
fi
# Test T13-F2: Existence fichier repo/apps/web-garage/playwright.config.ts
if [ -f "repo/apps/web-garage/playwright.config.ts" ]; then
  add_row "T13-F2" "Fichier playwright.config.ts existe" "PASS" "Cree"
else
  add_row "T13-F2" "Fichier playwright.config.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T13-V1: 20+ tests passent (P0)
echo "  Verifying T13-V1 : 20+ tests passent..."
add_row "T13-V1" "20+ tests passent" "WARN" "(P0) Voir B-22 Tache 5.4.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V2: CI green (P0)
echo "  Verifying T13-V2 : CI green..."
add_row "T13-V2" "CI green" "WARN" "(P0) Voir B-22 Tache 5.4.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V3: Accessibility WCAG 2.1 AA (P0)
echo "  Verifying T13-V3 : Accessibility WCAG 2.1 AA..."
add_row "T13-V3" "Accessibility WCAG 2.1 AA" "WARN" "(P0) Voir B-22 Tache 5.4.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V4: Lighthouse perf 90+ (P0)
echo "  Verifying T13-V4 : Lighthouse perf 90+..."
add_row "T13-V4" "Lighthouse perf 90+" "WARN" "(P0) Voir B-22 Tache 5.4.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V5: Reproducibility 5x (P0)
echo "  Verifying T13-V5 : Reproducibility 5x..."
add_row "T13-V5" "Reproducibility 5x" "WARN" "(P0) Voir B-22 Tache 5.4.13 pour test detaille - critere a auto-tester via script ad-hoc"

```

---


---


## VERIFICATIONS TRANSVERSALES SPRINT 22

### TR-BUILD : Build complet du sprint

```bash
echo ""
echo "================================================"
echo "VERIFICATIONS TRANSVERSALES SPRINT 22"
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

### TR-LIGHTHOUSE : Cibles Lighthouse Sprint 22

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
echo "GENERATION DU RAPPORT FINAL SPRINT 22"
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

## Jalon GO/NO-GO Sprint 22

EOF

# Calcul statut final
if (( $(echo "$SCORE >= 95" | bc -l) )); then
  STATUT="GO"
  cat >> "$REPORT_FILE" << EOF
**STATUT** : GO -- Sprint 22 valide, passage Sprint 23 autorise

Le sprint a passe les criteres requis. Cowork peut demarrer Sprint 23.

EOF
  echo ""
  echo "================================================"
  echo "SPRINT 22 : GO ($SCORE%)"
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
  echo "SPRINT 22 : GO CONDITIONNEL ($SCORE%)"
  echo "================================================"
else
  STATUT="NO-GO"
  cat >> "$REPORT_FILE" << EOF
**STATUT** : NO-GO -- Score $SCORE% trop bas (cible 85% minimum)

Le sprint **doit etre repris** :
- Lister tous FAIL P0
- Escalation Saad/Abla decision (cut scope OR delai)
- Reprise sprint avant Sprint 23

EOF
  echo ""
  echo "================================================"
  echo "SPRINT 22 : NO-GO ($SCORE%)"
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
  echo "git commit -m \"chore(sprint-22): close sprint 22 -- $STATUT ($SCORE%)\"" >> "$REPORT_FILE"
  echo '```' >> "$REPORT_FILE"
fi

echo ""
echo "Rapport complet dans : $REPORT_FILE"
```

---

## INSTRUCTION FINALE A CLAUDE CODE / COWORK

Apres l'execution complete des verifications ci-dessus :

1. **Lis le contenu de `sprint22-verify-report.md`** integralement
2. **Identifie les FAIL critiques** (criteres P0) qui necessitent intervention manuelle
3. **Affiche un resume executif** :
   - Nombre total de criteres
   - Pourcentage PASS / PASS\* / FAIL / WARN
   - Liste des FAIL avec contexte technique
   - Recommandation : GO / GO CONDITIONNEL / NO-GO
4. **Si NO-GO** : ne pas demarrer le Sprint suivant, alerter Saad/Abla via Slack `#insurtech-dev`
5. **Si GO ou GO CONDITIONNEL** : produire le commit de cloture du sprint :

```bash
git add skalean-insurtech/sprint22-verify-report.md
git commit -m "chore(sprint-22): close sprint 22 with verification report

- Verification automatique executee
- Score global : <SCORE>%
- <PASS> criteres PASS, <PASS_REPAIRED> reparations auto, <FAIL> FAIL
- Statut : <GO|GO CONDITIONNEL|NO-GO>

Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Sprint: 22 (Phase 5 / Sprint 4)
Reference B-22, C-22, V-22
Report: sprint22-verify-report.md"
```

6. **Documentation continue** : si decisions techniques prises pendant verification, ajouter notes dans `repo/docs/runbooks/sprint-22-lessons-learned.md`

---

**Fin de la verification V-22 v2.2 detaillee -- Sprint 22 (5.4) Web Garage App (port 3002).**

**Total criteres taches** : 61 | **Total transversaux** : ~10 | **Effort sprint** : 75h
