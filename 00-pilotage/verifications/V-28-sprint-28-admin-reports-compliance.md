# VERIFICATION SPRINT 28 -- Phase 6 / Sprint 3 : Admin Reports + Compliance (4 regulators MA)
# Version : Auto-reparation active + Rapport final MD detaille
# 12 taches, 55 criteres extraits B-28
# AUCUNE EMOJI AUTORISEE

**Version** : v2.2 (verification detaillee)
**Phase** : 6 -- Admin Platform
**Sprint** : 28 / 35 (cumul) -- Sprint 3 dans Phase 6
**Reference meta-prompt** : `B-28-sprint-28-admin-reports-compliance.md`
**Reference orchestrateur** : `C-28-sprint-28-admin-reports-compliance.md`
**Total criteres** : 55 criteres taches + ~10 transversaux

---

Tu es **Claude Code (ou Cowork)**. Tu dois executer une **verification COMPLETE et EXHAUSTIVE** du Sprint 28 apres execution toutes les 12 taches.

---

## REGLES D'EXECUTION

1. Tu **executes CHAQUE verification dans l'ordre** (taches puis transversales)
2. Quand une verification echoue, tu **TENTES UNE REPARATION AUTOMATIQUE** avant de noter FAIL
3. Apres chaque tentative de reparation, tu **re-executes la verification**
4. Tu consignes dans `sprint28-verify-report.md` **TOUS les resultats** au fil de l'execution
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
REPORT_FILE="sprint28-verify-report.md"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
RUN_ID=$(date '+%Y%m%d-%H%M%S')

cat > "$REPORT_FILE" << EOF
# Rapport de Verification - Sprint 28 : Admin Reports + Compliance (4 regulators MA)

**Date** : $TIMESTAMP
**Run ID** : $RUN_ID
**Phase** : 6 -- Admin Platform
**Sprint** : 28 (Phase 6 / Sprint 3)
**Reference B-28** : 12 taches, 55 criteres extraits
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

## TACHE 1/5 -- 6.3.1 : ACAPS Reports UI

```bash
echo ""
echo "================================================"
echo "TACHE 6.3.1 : ACAPS Reports UI"
echo "Priorite : P0 | Effort : 7h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T01-F1: Existence fichier repo/apps/web-insurtech-admin/app/[locale]/(protected)/compliance/acaps/page.tsx
if [ -f "repo/apps/web-insurtech-admin/app/[locale]/(protected)/compliance/acaps/page.tsx" ]; then
  add_row "T01-F1" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T01-F1" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T01-F2: Existence fichier repo/apps/web-insurtech-admin/components/compliance/acaps-{quarterly-policies,quarterly-sinistres,annual-solvency}.tsx
if [ -f "repo/apps/web-insurtech-admin/components/compliance/acaps-{quarterly-policies,quarterly-sinistres,annual-solvency}.tsx" ]; then
  add_row "T01-F2" "Fichier acaps-{quarterly-policies,quarterly-sinistres,annual-solvency}.tsx existe" "PASS" "Cree"
else
  add_row "T01-F2" "Fichier acaps-{quarterly-policies,quarterly-sinistres,annual-solvency}.tsx existe" "FAIL" "Manquant"
fi
# Test T01-F3: Existence fichier repo/apps/web-insurtech-admin/components/compliance/report-preview.tsx
if [ -f "repo/apps/web-insurtech-admin/components/compliance/report-preview.tsx" ]; then
  add_row "T01-F3" "Fichier report-preview.tsx existe" "PASS" "Cree"
else
  add_row "T01-F3" "Fichier report-preview.tsx existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T01-V1: 3 types reports (P0)
echo "  Verifying T01-V1 : 3 types reports..."
add_row "T01-V1" "3 types reports" "WARN" "(P0) Voir B-28 Tache 6.3.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V2: Generate + preview (P0)
echo "  Verifying T01-V2 : Generate + preview..."
add_row "T01-V2" "Generate + preview" "WARN" "(P0) Voir B-28 Tache 6.3.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V3: Send workflow + tracking (P0)
echo "  Verifying T01-V3 : Send workflow + tracking..."
add_row "T01-V3" "Send workflow + tracking" "WARN" "(P0) Voir B-28 Tache 6.3.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V4: Permissions (P0)
echo "  Verifying T01-V4 : Permissions..."
add_row "T01-V4" "Permissions" "WARN" "(P0) Voir B-28 Tache 6.3.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V5: Tests 8+ scenarios (P0)
echo "  Verifying T01-V5 : Tests 8+ scenarios..."
add_row "T01-V5" "Tests 8+ scenarios" "WARN" "(P0) Voir B-28 Tache 6.3.1 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 2/5 -- 6.3.2 : SAFT-MA Exports UI

```bash
echo ""
echo "================================================"
echo "TACHE 6.3.2 : SAFT-MA Exports UI"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T02-F1: Existence fichier repo/apps/web-insurtech-admin/app/[locale]/(protected)/compliance/saft-ma/page.tsx
if [ -f "repo/apps/web-insurtech-admin/app/[locale]/(protected)/compliance/saft-ma/page.tsx" ]; then
  add_row "T02-F1" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T02-F1" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T02-F2: Existence fichier repo/apps/web-insurtech-admin/components/compliance/saft-ma-preview.tsx
if [ -f "repo/apps/web-insurtech-admin/components/compliance/saft-ma-preview.tsx" ]; then
  add_row "T02-F2" "Fichier saft-ma-preview.tsx existe" "PASS" "Cree"
else
  add_row "T02-F2" "Fichier saft-ma-preview.tsx existe" "FAIL" "Manquant"
fi
# Test T02-F3: Existence fichier repo/apps/web-insurtech-admin/components/compliance/saft-ma-validator.tsx
if [ -f "repo/apps/web-insurtech-admin/components/compliance/saft-ma-validator.tsx" ]; then
  add_row "T02-F3" "Fichier saft-ma-validator.tsx existe" "PASS" "Cree"
else
  add_row "T02-F3" "Fichier saft-ma-validator.tsx existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T02-V1: Generate XML (P0)
echo "  Verifying T02-V1 : Generate XML..."
add_row "T02-V1" "Generate XML" "WARN" "(P0) Voir B-28 Tache 6.3.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V2: Validation XSD (P0)
echo "  Verifying T02-V2 : Validation XSD..."
add_row "T02-V2" "Validation XSD" "WARN" "(P0) Voir B-28 Tache 6.3.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V3: Preview readable (P0)
echo "  Verifying T02-V3 : Preview readable..."
add_row "T02-V3" "Preview readable" "WARN" "(P0) Voir B-28 Tache 6.3.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V4: Download + send DGI (P0)
echo "  Verifying T02-V4 : Download + send DGI..."
add_row "T02-V4" "Download + send DGI" "WARN" "(P0) Voir B-28 Tache 6.3.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V5: Tests 6+ scenarios (P0)
echo "  Verifying T02-V5 : Tests 6+ scenarios..."
add_row "T02-V5" "Tests 6+ scenarios" "WARN" "(P0) Voir B-28 Tache 6.3.2 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 3/6 -- 6.3.3 : AML Monitoring Dashboard

```bash
echo ""
echo "================================================"
echo "TACHE 6.3.3 : AML Monitoring Dashboard"
echo "Priorite : P0 | Effort : 7h"
echo "Criteres a verifier : 6"
echo "================================================"

# === Verification fichiers crees ===
# Test T03-F1: Existence fichier repo/apps/web-insurtech-admin/app/[locale]/(protected)/compliance/aml/page.tsx
if [ -f "repo/apps/web-insurtech-admin/app/[locale]/(protected)/compliance/aml/page.tsx" ]; then
  add_row "T03-F1" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T03-F1" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T03-F2: Existence fichier repo/apps/web-insurtech-admin/components/compliance/aml-alerts-panel.tsx
if [ -f "repo/apps/web-insurtech-admin/components/compliance/aml-alerts-panel.tsx" ]; then
  add_row "T03-F2" "Fichier aml-alerts-panel.tsx existe" "PASS" "Cree"
else
  add_row "T03-F2" "Fichier aml-alerts-panel.tsx existe" "FAIL" "Manquant"
fi
# Test T03-F3: Existence fichier repo/apps/web-insurtech-admin/components/compliance/aml-review-workflow.tsx
if [ -f "repo/apps/web-insurtech-admin/components/compliance/aml-review-workflow.tsx" ]; then
  add_row "T03-F3" "Fichier aml-review-workflow.tsx existe" "PASS" "Cree"
else
  add_row "T03-F3" "Fichier aml-review-workflow.tsx existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T03-V1: Alerts panel (P0)
echo "  Verifying T03-V1 : Alerts panel..."
add_row "T03-V1" "Alerts panel" "WARN" "(P0) Voir B-28 Tache 6.3.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V2: Severity classification (P0)
echo "  Verifying T03-V2 : Severity classification..."
add_row "T03-V2" "Severity classification" "WARN" "(P0) Voir B-28 Tache 6.3.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V3: Review workflow + audit (P0)
echo "  Verifying T03-V3 : Review workflow + audit..."
add_row "T03-V3" "Review workflow + audit" "WARN" "(P0) Voir B-28 Tache 6.3.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V4: SAR generation + send (P0)
echo "  Verifying T03-V4 : SAR generation + send..."
add_row "T03-V4" "SAR generation + send" "WARN" "(P0) Voir B-28 Tache 6.3.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V5: Cron escalation (P0)
echo "  Verifying T03-V5 : Cron escalation..."
add_row "T03-V5" "Cron escalation" "WARN" "(P0) Voir B-28 Tache 6.3.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V6: Tests 10+ scenarios (P0)
echo "  Verifying T03-V6 : Tests 10+ scenarios..."
add_row "T03-V6" "Tests 10+ scenarios" "WARN" "(P0) Voir B-28 Tache 6.3.3 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 4/5 -- 6.3.4 : Audit Reports Avances

```bash
echo ""
echo "================================================"
echo "TACHE 6.3.4 : Audit Reports Avances"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T04-F1: Existence fichier repo/apps/web-insurtech-admin/app/[locale]/(protected)/compliance/audit-reports/page.tsx
if [ -f "repo/apps/web-insurtech-admin/app/[locale]/(protected)/compliance/audit-reports/page.tsx" ]; then
  add_row "T04-F1" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T04-F1" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T04-F2: Existence fichier repo/apps/web-insurtech-admin/components/compliance/audit-aggregations.tsx
if [ -f "repo/apps/web-insurtech-admin/components/compliance/audit-aggregations.tsx" ]; then
  add_row "T04-F2" "Fichier audit-aggregations.tsx existe" "PASS" "Cree"
else
  add_row "T04-F2" "Fichier audit-aggregations.tsx existe" "FAIL" "Manquant"
fi
# Test T04-F3: Existence fichier repo/packages/docs/src/templates/{fr,en}/audit-{executive,forensic}.hbs
if [ -f "repo/packages/docs/src/templates/{fr,en}/audit-{executive,forensic}.hbs" ]; then
  add_row "T04-F3" "Fichier audit-{executive,forensic}.hbs existe" "PASS" "Cree"
else
  add_row "T04-F3" "Fichier audit-{executive,forensic}.hbs existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T04-V1: 3 templates rapport (P0)
echo "  Verifying T04-V1 : 3 templates rapport..."
add_row "T04-V1" "3 templates rapport" "WARN" "(P0) Voir B-28 Tache 6.3.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V2: Aggregations correctes (P0)
echo "  Verifying T04-V2 : Aggregations correctes..."
add_row "T04-V2" "Aggregations correctes" "WARN" "(P0) Voir B-28 Tache 6.3.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V3: Multi-format exports (P0)
echo "  Verifying T04-V3 : Multi-format exports..."
add_row "T04-V3" "Multi-format exports" "WARN" "(P0) Voir B-28 Tache 6.3.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V4: Scheduled monthly (P0)
echo "  Verifying T04-V4 : Scheduled monthly..."
add_row "T04-V4" "Scheduled monthly" "WARN" "(P0) Voir B-28 Tache 6.3.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V5: Tests 6+ scenarios (P0)
echo "  Verifying T04-V5 : Tests 6+ scenarios..."
add_row "T04-V5" "Tests 6+ scenarios" "WARN" "(P0) Voir B-28 Tache 6.3.4 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 5/5 -- 6.3.5 : Compliance Dashboard Global

```bash
echo ""
echo "================================================"
echo "TACHE 6.3.5 : Compliance Dashboard Global"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T05-F1: Existence fichier repo/apps/web-insurtech-admin/app/[locale]/(protected)/compliance/dashboard/page.tsx
if [ -f "repo/apps/web-insurtech-admin/app/[locale]/(protected)/compliance/dashboard/page.tsx" ]; then
  add_row "T05-F1" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T05-F1" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T05-F2: Existence fichier repo/apps/web-insurtech-admin/components/compliance/{4 regulator cards}.tsx
if [ -f "repo/apps/web-insurtech-admin/components/compliance/{4 regulator cards}.tsx" ]; then
  add_row "T05-F2" "Fichier {4 regulator cards}.tsx existe" "PASS" "Cree"
else
  add_row "T05-F2" "Fichier {4 regulator cards}.tsx existe" "FAIL" "Manquant"
fi
# Test T05-F3: Existence fichier repo/apps/web-insurtech-admin/components/compliance/regulators-calendar.tsx
if [ -f "repo/apps/web-insurtech-admin/components/compliance/regulators-calendar.tsx" ]; then
  add_row "T05-F3" "Fichier regulators-calendar.tsx existe" "PASS" "Cree"
else
  add_row "T05-F3" "Fichier regulators-calendar.tsx existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T05-V1: 4 cards regulators (P0)
echo "  Verifying T05-V1 : 4 cards regulators..."
add_row "T05-V1" "4 cards regulators" "WARN" "(P0) Voir B-28 Tache 6.3.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V2: Color coding (P0)
echo "  Verifying T05-V2 : Color coding..."
add_row "T05-V2" "Color coding" "WARN" "(P0) Voir B-28 Tache 6.3.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V3: Maturity scoring (P0)
echo "  Verifying T05-V3 : Maturity scoring..."
add_row "T05-V3" "Maturity scoring" "WARN" "(P0) Voir B-28 Tache 6.3.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V4: Calendar 12 mois (P0)
echo "  Verifying T05-V4 : Calendar 12 mois..."
add_row "T05-V4" "Calendar 12 mois" "WARN" "(P0) Voir B-28 Tache 6.3.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V5: Tests 6+ scenarios (P0)
echo "  Verifying T05-V5 : Tests 6+ scenarios..."
add_row "T05-V5" "Tests 6+ scenarios" "WARN" "(P0) Voir B-28 Tache 6.3.5 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 6/5 -- 6.3.6 : Reports Schedules + Auto-Send

```bash
echo ""
echo "================================================"
echo "TACHE 6.3.6 : Reports Schedules + Auto-Send"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T06-F1: Existence fichier repo/packages/database/src/migrations/{date}-ComplianceReportSchedules.ts
if [ -f "repo/packages/database/src/migrations/{date}-ComplianceReportSchedules.ts" ]; then
  add_row "T06-F1" "Fichier {date}-ComplianceReportSchedules.ts existe" "PASS" "Cree"
else
  add_row "T06-F1" "Fichier {date}-ComplianceReportSchedules.ts existe" "FAIL" "Manquant"
fi
# Test T06-F2: Existence fichier repo/packages/admin/src/services/compliance-scheduler.service.ts
if [ -f "repo/packages/admin/src/services/compliance-scheduler.service.ts" ]; then
  add_row "T06-F2" "Fichier compliance-scheduler.service.ts existe" "PASS" "Cree"
else
  add_row "T06-F2" "Fichier compliance-scheduler.service.ts existe" "FAIL" "Manquant"
fi
# Test T06-F3: Existence fichier repo/apps/web-insurtech-admin/app/[locale]/(protected)/compliance/schedules/page.tsx
if [ -f "repo/apps/web-insurtech-admin/app/[locale]/(protected)/compliance/schedules/page.tsx" ]; then
  add_row "T06-F3" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T06-F3" "Fichier page.tsx existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T06-V1: Schedules configurables (P0)
echo "  Verifying T06-V1 : Schedules configurables..."
add_row "T06-V1" "Schedules configurables" "WARN" "(P0) Voir B-28 Tache 6.3.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V2: Cron orchestrator (P0)
echo "  Verifying T06-V2 : Cron orchestrator..."
add_row "T06-V2" "Cron orchestrator" "WARN" "(P0) Voir B-28 Tache 6.3.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V3: Auto-send + manual review fallback (P0)
echo "  Verifying T06-V3 : Auto-send + manual review fallback..."
add_row "T06-V3" "Auto-send + manual review fallback" "WARN" "(P0) Voir B-28 Tache 6.3.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V4: History runs (P0)
echo "  Verifying T06-V4 : History runs..."
add_row "T06-V4" "History runs" "WARN" "(P0) Voir B-28 Tache 6.3.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V5: Tests 6+ scenarios (P0)
echo "  Verifying T06-V5 : Tests 6+ scenarios..."
add_row "T06-V5" "Tests 6+ scenarios" "WARN" "(P0) Voir B-28 Tache 6.3.6 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 7/5 -- 6.3.7 : Compliance Documents Browser

```bash
echo ""
echo "================================================"
echo "TACHE 6.3.7 : Compliance Documents Browser"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T07-F1: Existence fichier repo/apps/web-insurtech-admin/app/[locale]/(protected)/compliance/archive/page.tsx
if [ -f "repo/apps/web-insurtech-admin/app/[locale]/(protected)/compliance/archive/page.tsx" ]; then
  add_row "T07-F1" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T07-F1" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T07-F2: Existence fichier repo/apps/web-insurtech-admin/components/compliance/documents-archive-table.tsx
if [ -f "repo/apps/web-insurtech-admin/components/compliance/documents-archive-table.tsx" ]; then
  add_row "T07-F2" "Fichier documents-archive-table.tsx existe" "PASS" "Cree"
else
  add_row "T07-F2" "Fichier documents-archive-table.tsx existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T07-V1: Browser + filters (P0)
echo "  Verifying T07-V1 : Browser + filters..."
add_row "T07-V1" "Browser + filters" "WARN" "(P0) Voir B-28 Tache 6.3.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V2: Search free (P0)
echo "  Verifying T07-V2 : Search free..."
add_row "T07-V2" "Search free" "WARN" "(P0) Voir B-28 Tache 6.3.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V3: Preview + download (P0)
echo "  Verifying T07-V3 : Preview + download..."
add_row "T07-V3" "Preview + download" "WARN" "(P0) Voir B-28 Tache 6.3.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V4: Bulk download (P0)
echo "  Verifying T07-V4 : Bulk download..."
add_row "T07-V4" "Bulk download" "WARN" "(P0) Voir B-28 Tache 6.3.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V5: Tests 5+ scenarios (P0)
echo "  Verifying T07-V5 : Tests 5+ scenarios..."
add_row "T07-V5" "Tests 5+ scenarios" "WARN" "(P0) Voir B-28 Tache 6.3.7 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 8/5 -- 6.3.8 : Tenant Compliance Scorecard

```bash
echo ""
echo "================================================"
echo "TACHE 6.3.8 : Tenant Compliance Scorecard"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T08-F1: Existence fichier repo/apps/web-insurtech-admin/app/[locale]/(protected)/compliance/tenants-scorecard/page.tsx
if [ -f "repo/apps/web-insurtech-admin/app/[locale]/(protected)/compliance/tenants-scorecard/page.tsx" ]; then
  add_row "T08-F1" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T08-F1" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T08-F2: Existence fichier repo/packages/admin/src/services/tenant-compliance-scoring.service.ts
if [ -f "repo/packages/admin/src/services/tenant-compliance-scoring.service.ts" ]; then
  add_row "T08-F2" "Fichier tenant-compliance-scoring.service.ts existe" "PASS" "Cree"
else
  add_row "T08-F2" "Fichier tenant-compliance-scoring.service.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T08-V1: Scoring algorithm (P0)
echo "  Verifying T08-V1 : Scoring algorithm..."
add_row "T08-V1" "Scoring algorithm" "WARN" "(P0) Voir B-28 Tache 6.3.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V2: DataTable + filters (P0)
echo "  Verifying T08-V2 : DataTable + filters..."
add_row "T08-V2" "DataTable + filters" "WARN" "(P0) Voir B-28 Tache 6.3.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V3: Detail per tenant (P0)
echo "  Verifying T08-V3 : Detail per tenant..."
add_row "T08-V3" "Detail per tenant" "WARN" "(P0) Voir B-28 Tache 6.3.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V4: Cron weekly (P0)
echo "  Verifying T08-V4 : Cron weekly..."
add_row "T08-V4" "Cron weekly" "WARN" "(P0) Voir B-28 Tache 6.3.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V5: Tests 5+ scenarios (P0)
echo "  Verifying T08-V5 : Tests 5+ scenarios..."
add_row "T08-V5" "Tests 5+ scenarios" "WARN" "(P0) Voir B-28 Tache 6.3.8 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 9/3 -- 6.3.9 : Notifications Regulators

```bash
echo ""
echo "================================================"
echo "TACHE 6.3.9 : Notifications Regulators"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 3"
echo "================================================"

# === Verification fichiers crees ===
# Test T09-F1: Existence fichier repo/packages/database/src/migrations/{date}-RegulatorCommunications.ts
if [ -f "repo/packages/database/src/migrations/{date}-RegulatorCommunications.ts" ]; then
  add_row "T09-F1" "Fichier {date}-RegulatorCommunications.ts existe" "PASS" "Cree"
else
  add_row "T09-F1" "Fichier {date}-RegulatorCommunications.ts existe" "FAIL" "Manquant"
fi
# Test T09-F2: Existence fichier repo/packages/admin/src/services/regulator-communications.service.ts
if [ -f "repo/packages/admin/src/services/regulator-communications.service.ts" ]; then
  add_row "T09-F2" "Fichier regulator-communications.service.ts existe" "PASS" "Cree"
else
  add_row "T09-F2" "Fichier regulator-communications.service.ts existe" "FAIL" "Manquant"
fi
# Test T09-F3: Existence fichier repo/packages/comm/src/templates/{fr}/regulator-{acaps,dgi,amc,cndp}-{4 templates}.hbs
if [ -f "repo/packages/comm/src/templates/{fr}/regulator-{acaps,dgi,amc,cndp}-{4 templates}.hbs" ]; then
  add_row "T09-F3" "Fichier regulator-{acaps,dgi,amc,cndp}-{4 templates}.hbs existe" "PASS" "Cree"
else
  add_row "T09-F3" "Fichier regulator-{acaps,dgi,amc,cndp}-{4 templates}.hbs existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T09-V1: 4 regulators communications (P0)
echo "  Verifying T09-V1 : 4 regulators communications..."
add_row "T09-V1" "4 regulators communications" "WARN" "(P0) Voir B-28 Tache 6.3.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V2: Tracking acknowledgments (P0)
echo "  Verifying T09-V2 : Tracking acknowledgments..."
add_row "T09-V2" "Tracking acknowledgments" "WARN" "(P0) Voir B-28 Tache 6.3.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V3: Tests 4+ scenarios (P0)
echo "  Verifying T09-V3 : Tests 4+ scenarios..."
add_row "T09-V3" "Tests 4+ scenarios" "WARN" "(P0) Voir B-28 Tache 6.3.9 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 10/3 -- 6.3.10 : Endpoints REST + Permissions + KMS

```bash
echo ""
echo "================================================"
echo "TACHE 6.3.10 : Endpoints REST + Permissions + KMS"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 3"
echo "================================================"

# === Verification fichiers crees ===
# Test T10-F1: Existence fichier repo/packages/auth/src/rbac/permissions.enum.ts
if [ -f "repo/packages/auth/src/rbac/permissions.enum.ts" ]; then
  add_row "T10-F1" "Fichier permissions.enum.ts existe" "PASS" "Cree"
else
  add_row "T10-F1" "Fichier permissions.enum.ts existe" "FAIL" "Manquant"
fi
# Test T10-F2: Existence fichier repo/packages/admin/src/services/kms-compliance-encryption.service.ts
if [ -f "repo/packages/admin/src/services/kms-compliance-encryption.service.ts" ]; then
  add_row "T10-F2" "Fichier kms-compliance-encryption.service.ts existe" "PASS" "Cree"
else
  add_row "T10-F2" "Fichier kms-compliance-encryption.service.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T10-V1: 15+ permissions (P0)
echo "  Verifying T10-V1 : 15+ permissions..."
add_row "T10-V1" "15+ permissions" "WARN" "(P0) Voir B-28 Tache 6.3.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V2: KMS encryption documents sensibles (P0)
echo "  Verifying T10-V2 : KMS encryption documents sensibles..."
add_row "T10-V2" "KMS encryption documents sensibles" "WARN" "(P0) Voir B-28 Tache 6.3.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V3: Tests 6+ scenarios (P0)
echo "  Verifying T10-V3 : Tests 6+ scenarios..."
add_row "T10-V3" "Tests 6+ scenarios" "WARN" "(P0) Voir B-28 Tache 6.3.10 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 11/3 -- 6.3.11 : Documentation Compliance MA Officielle

```bash
echo ""
echo "================================================"
echo "TACHE 6.3.11 : Documentation Compliance MA Officielle"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 3"
echo "================================================"

# === Verification fichiers crees ===
# Test T11-F1: Existence fichier repo/docs/compliance-acaps-guide.md
if [ -f "repo/docs/compliance-acaps-guide.md" ]; then
  add_row "T11-F1" "Fichier compliance-acaps-guide.md existe" "PASS" "Cree"
else
  add_row "T11-F1" "Fichier compliance-acaps-guide.md existe" "FAIL" "Manquant"
fi
# Test T11-F2: Existence fichier repo/docs/compliance-dgi-guide.md
if [ -f "repo/docs/compliance-dgi-guide.md" ]; then
  add_row "T11-F2" "Fichier compliance-dgi-guide.md existe" "PASS" "Cree"
else
  add_row "T11-F2" "Fichier compliance-dgi-guide.md existe" "FAIL" "Manquant"
fi
# Test T11-F3: Existence fichier repo/docs/compliance-amc-guide.md
if [ -f "repo/docs/compliance-amc-guide.md" ]; then
  add_row "T11-F3" "Fichier compliance-amc-guide.md existe" "PASS" "Cree"
else
  add_row "T11-F3" "Fichier compliance-amc-guide.md existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T11-V1: 5 documents complets (P0)
echo "  Verifying T11-V1 : 5 documents complets..."
add_row "T11-V1" "5 documents complets" "WARN" "(P0) Voir B-28 Tache 6.3.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V2: Diagrams clairs (P0)
echo "  Verifying T11-V2 : Diagrams clairs..."
add_row "T11-V2" "Diagrams clairs" "WARN" "(P0) Voir B-28 Tache 6.3.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V3: Phase 7 pilote ready (P0)
echo "  Verifying T11-V3 : Phase 7 pilote ready..."
add_row "T11-V3" "Phase 7 pilote ready" "WARN" "(P0) Voir B-28 Tache 6.3.11 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 12/5 -- 6.3.12 : Tests E2E + Phase 6 Closure

```bash
echo ""
echo "================================================"
echo "TACHE 6.3.12 : Tests E2E + Phase 6 Closure"
echo "Priorite : P0 | Effort : 9h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T12-F1: Existence fichier repo/apps/web-insurtech-admin/e2e/sprint-28/{15+ specs}.spec.ts
if [ -f "repo/apps/web-insurtech-admin/e2e/sprint-28/{15+ specs}.spec.ts" ]; then
  add_row "T12-F1" "Fichier {15+ specs}.spec.ts existe" "PASS" "Cree"
else
  add_row "T12-F1" "Fichier {15+ specs}.spec.ts existe" "FAIL" "Manquant"
fi
# Test T12-F2: Existence fichier repo/docs/phase-6-completion.md
if [ -f "repo/docs/phase-6-completion.md" ]; then
  add_row "T12-F2" "Fichier phase-6-completion.md existe" "PASS" "Cree"
else
  add_row "T12-F2" "Fichier phase-6-completion.md existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T12-V1: 15+ tests passent (P0)
echo "  Verifying T12-V1 : 15+ tests passent..."
add_row "T12-V1" "15+ tests passent" "WARN" "(P0) Voir B-28 Tache 6.3.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V2: Lighthouse green (P0)
echo "  Verifying T12-V2 : Lighthouse green..."
add_row "T12-V2" "Lighthouse green" "WARN" "(P0) Voir B-28 Tache 6.3.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V3: WCAG AA (P0)
echo "  Verifying T12-V3 : WCAG AA..."
add_row "T12-V3" "WCAG AA" "WARN" "(P0) Voir B-28 Tache 6.3.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V4: CI green (P0)
echo "  Verifying T12-V4 : CI green..."
add_row "T12-V4" "CI green" "WARN" "(P0) Voir B-28 Tache 6.3.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V5: Documentation Phase 6 closure (P0)
echo "  Verifying T12-V5 : Documentation Phase 6 closure..."
add_row "T12-V5" "Documentation Phase 6 closure" "WARN" "(P0) Voir B-28 Tache 6.3.12 pour test detaille - critere a auto-tester via script ad-hoc"

```

---


---


## VERIFICATIONS TRANSVERSALES SPRINT 28

### TR-BUILD : Build complet du sprint

```bash
echo ""
echo "================================================"
echo "VERIFICATIONS TRANSVERSALES SPRINT 28"
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

### TR-MIGRATIONS : Migrations DB Sprint 28

```bash
echo "=== TR-MIGRATIONS : Migrations DB ==="
MIGR_COUNT=$(pg_query "SELECT COUNT(*) FROM migrations WHERE name LIKE '%sprint28%' OR name LIKE '%Sprint28%'" || echo 0)
if [ "$MIGR_COUNT" -gt 0 ]; then
  add_row "TR-MIG" "Migrations Sprint 28 appliquees" "PASS" "$MIGR_COUNT migrations"
else
  add_row "TR-MIG" "Migrations Sprint 28 appliquees" "WARN" "Aucune migration detectee (verifier)"
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
echo "GENERATION DU RAPPORT FINAL SPRINT 28"
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

## Jalon GO/NO-GO Sprint 28

EOF

# Calcul statut final
if (( $(echo "$SCORE >= 95" | bc -l) )); then
  STATUT="GO"
  cat >> "$REPORT_FILE" << EOF
**STATUT** : GO -- Sprint 28 valide, passage Sprint 29 autorise

Le sprint a passe les criteres requis. Cowork peut demarrer Sprint 29.

EOF
  echo ""
  echo "================================================"
  echo "SPRINT 28 : GO ($SCORE%)"
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
  echo "SPRINT 28 : GO CONDITIONNEL ($SCORE%)"
  echo "================================================"
else
  STATUT="NO-GO"
  cat >> "$REPORT_FILE" << EOF
**STATUT** : NO-GO -- Score $SCORE% trop bas (cible 85% minimum)

Le sprint **doit etre repris** :
- Lister tous FAIL P0
- Escalation Saad/Abla decision (cut scope OR delai)
- Reprise sprint avant Sprint 29

EOF
  echo ""
  echo "================================================"
  echo "SPRINT 28 : NO-GO ($SCORE%)"
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
  echo "git commit -m \"chore(sprint-28): close sprint 28 -- $STATUT ($SCORE%)\"" >> "$REPORT_FILE"
  echo '```' >> "$REPORT_FILE"
fi

echo ""
echo "Rapport complet dans : $REPORT_FILE"
```

---

## INSTRUCTION FINALE A CLAUDE CODE / COWORK

Apres l'execution complete des verifications ci-dessus :

1. **Lis le contenu de `sprint28-verify-report.md`** integralement
2. **Identifie les FAIL critiques** (criteres P0) qui necessitent intervention manuelle
3. **Affiche un resume executif** :
   - Nombre total de criteres
   - Pourcentage PASS / PASS\* / FAIL / WARN
   - Liste des FAIL avec contexte technique
   - Recommandation : GO / GO CONDITIONNEL / NO-GO
4. **Si NO-GO** : ne pas demarrer le Sprint suivant, alerter Saad/Abla via Slack `#insurtech-dev`
5. **Si GO ou GO CONDITIONNEL** : produire le commit de cloture du sprint :

```bash
git add skalean-insurtech/sprint28-verify-report.md
git commit -m "chore(sprint-28): close sprint 28 with verification report

- Verification automatique executee
- Score global : <SCORE>%
- <PASS> criteres PASS, <PASS_REPAIRED> reparations auto, <FAIL> FAIL
- Statut : <GO|GO CONDITIONNEL|NO-GO>

Phase: 6 -- Admin Platform
Sprint: 28 (Phase 6 / Sprint 3)
Reference B-28, C-28, V-28
Report: sprint28-verify-report.md"
```

6. **Documentation continue** : si decisions techniques prises pendant verification, ajouter notes dans `repo/docs/runbooks/sprint-28-lessons-learned.md`

---

**Fin de la verification V-28 v2.2 detaillee -- Sprint 28 (6.3) Admin Reports + Compliance (4 regulators MA).**

**Total criteres taches** : 55 | **Total transversaux** : ~10 | **Effort sprint** : 70h
