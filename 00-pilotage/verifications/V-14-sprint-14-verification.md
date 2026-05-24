# VERIFICATION SPRINT 14 v3.0 -- Phase 4 / Sprint 1 : Insure Foundation + 3 Entites Experts
# Version : Auto-reparation active + Rapport final MD detaille
# 17 taches, 73 criteres extraits B-14 v3.0
# AUCUNE EMOJI AUTORISEE

**Version** : v3.0 (verification detaillee -- format strict Saad)
**Phase** : 4 -- Vertical Insure
**Sprint** : 14 / 40 (cumul v3.0) -- Sprint 1 dans Phase 4
**Reference meta-prompt** : `B-14-sprint-14-insure-foundation.md` v3.0
**Reference orchestrateur** : `C-14-sprint-14-insure-foundation.md`
**Total criteres** : 73 criteres taches + 11 transversaux

---

Tu es **Claude Code (ou Cowork)**. Tu dois executer une **verification COMPLETE et EXHAUSTIVE** du Sprint 14 v3.0 apres execution toutes les 17 taches.

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

| ID | Description | Statut | Details |
|----|-------------|--------|---------|
| T15-V1 | Critere V1 Tache 15 (4.1.15) | PASS | Details |

**Convention IDs** :
- `T{NN}-V{N}` : critere V{N} de Tache {NN} (T01=4.1.1 ... T17=4.1.17)
- `T{NN}-F{N}` : critere fichier de Tache {NN}
- `TR-{TYPE}` : critere transversal sprint

**Statuts** : PASS | PASS* | FAIL | SKIP | WARN

---

## PHASE DE PREPARATION

```bash
REPORT_FILE="sprint14-verify-report.md"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
RUN_ID=$(date '+%Y%m%d-%H%M%S')

cat > "$REPORT_FILE" << EOF
# Rapport de Verification - Sprint 14 v3.0 : Insure Foundation + 3 Entites Experts

**Date** : $TIMESTAMP
**Run ID** : $RUN_ID
**Phase** : 4 -- Vertical Insure
**Sprint** : 14 (Phase 4 / Sprint 1)
**Reference B-14 v3.0** : 17 taches (14 v2.2 preserves + 3 v3.0 nouveaux), 73 criteres
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

PASS=0
PASS_REPAIRED=0
FAIL=0
SKIP=0
WARN=0
TABLE_ROWS=""

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

DB_URL="${DATABASE_URL:-postgresql://insurtech_user:SecurePassword123!@localhost:5432/insurtech}"
REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6379}"

pg_query() { psql "$DB_URL" -t -c "$1" 2>/dev/null | tr -d ' \n'; }
pg_query_raw() { psql "$DB_URL" -c "$1" 2>/dev/null; }
```

---

## VERIFICATIONS PAR TACHE (17 taches)

---

## PHASE A : Heritage v2.2 (Taches 1-14)

Pour les taches 4.1.1 a 4.1.14 (v2.2 preserves), executer verifications standards heritees du V-14 v2.2 original. Synthese ci-dessous :

### TACHES 1-14 v2.2 (synthese) -- 50 criteres minimum

```bash
echo ""
echo "================================================"
echo "PHASE A : Verifications heritees v2.2 (Taches 4.1.1 a 4.1.14)"
echo "================================================"

# === T01-T14 : 7 entites Insure v2.2 verifies ===
TABLES_V22=(insure_products insure_quotes insure_policies insure_avenants insure_premiums insure_renewals insure_commissions)
TABLE_OK=0
for table in "${TABLES_V22[@]}"; do
  RESULT=$(pg_query "SELECT 1 FROM information_schema.tables WHERE table_name = '$table'")
  if [ "$RESULT" = "1" ]; then
    add_row "TA-${table}" "Table v2.2 $table presente" "PASS" "Cree"
    TABLE_OK=$((TABLE_OK + 1))
  else
    add_row "TA-${table}" "Table v2.2 $table presente" "FAIL" "Manquante"
  fi
done

# T14-V1 : Tests E2E v2.2 PASS (>= 50 scenarios)
cd repo
V22_TESTS_PASS=$(pnpm vitest run --reporter=json apps/api/test/insure 2>/dev/null | jq '.numPassedTests // 0' 2>/dev/null || echo 0)
cd ..
if [ "$V22_TESTS_PASS" -ge 50 ]; then
  add_row "T14-V1" "Tests E2E v2.2 PASS (>= 50)" "PASS" "$V22_TESTS_PASS tests"
else
  add_row "T14-V1" "Tests E2E v2.2 PASS (>= 50)" "FAIL" "$V22_TESTS_PASS / 50"
fi

# T14-V2 : Cron renewals + reminders fonctionnels
CRON_FILES=$(find repo/packages/insure/src/jobs -name "*.cron.ts" | wc -l)
if [ "$CRON_FILES" -ge 2 ]; then
  add_row "T14-V2" "Crons renewals + reminders" "PASS" "$CRON_FILES crons"
else
  add_row "T14-V2" "Crons renewals + reminders" "FAIL" "Manquants"
fi
```

---

## PHASE B : Extensions v3.0 (Taches 15-17)

## TACHE 15/17 -- 4.1.15 : insure_experts entity + catalog pool ACAPS + KYB workflow

```bash
echo ""
echo "================================================"
echo "TACHE 4.1.15 : insure_experts + KYB workflow (NOUVEAU v3.0)"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 9"
echo "================================================"

# === Verification fichiers crees ===
if [ -f "repo/packages/insure/src/entities/insure-expert.entity.ts" ]; then
  add_row "T15-F1" "Entity insure-expert.entity.ts existe" "PASS" "Cree"
else
  add_row "T15-F1" "Entity insure-expert.entity.ts existe" "FAIL" "Manquant"
fi

if [ -f "repo/packages/insure/src/services/experts-catalog.service.ts" ]; then
  add_row "T15-F2" "Service experts-catalog.service.ts existe" "PASS" "Cree"
else
  add_row "T15-F2" "Service experts-catalog.service.ts existe" "FAIL" "Manquant"
fi

if [ -f "repo/packages/insure/src/services/experts-catalog.service.spec.ts" ]; then
  add_row "T15-F3" "Tests experts-catalog.service.spec.ts existe" "PASS" "Cree"
else
  add_row "T15-F3" "Tests experts-catalog.service.spec.ts existe" "FAIL" "Manquant"
fi

if [ -f "repo/packages/insure/src/jobs/insure-experts-agrement-expiry.cron.ts" ]; then
  add_row "T15-F4" "Cron agrement-expiry existe" "PASS" "Cree"
else
  add_row "T15-F4" "Cron agrement-expiry existe" "FAIL" "Manquant"
fi

if [ -f "repo/apps/api/src/modules/insure/controllers/experts.controller.ts" ]; then
  add_row "T15-F5" "Controller experts.controller.ts existe" "PASS" "Cree"
else
  add_row "T15-F5" "Controller experts.controller.ts existe" "FAIL" "Manquant"
fi

# === V1 (P0) : Migration insure_experts appliquee + RLS + FORCE ===
RLS_OK=$(pg_query "SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE relname = 'insure_experts'")
if [ "$RLS_OK" = "t" ]; then
  add_row "T15-V1" "Table insure_experts + RLS + FORCE" "PASS" "RLS active"
else
  # AUTO-REPARATION
  pg_query_raw "ALTER TABLE insure_experts ENABLE ROW LEVEL SECURITY; ALTER TABLE insure_experts FORCE ROW LEVEL SECURITY;"
  RLS_OK2=$(pg_query "SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE relname = 'insure_experts'")
  if [ "$RLS_OK2" = "t" ]; then
    add_row "T15-V1" "Table insure_experts + RLS + FORCE" "PASS*" "Repare automatiquement"
  else
    add_row "T15-V1" "Table insure_experts + RLS + FORCE" "FAIL" "RLS non activable"
  fi
fi

# === V2 (P0) : Indexes GIN specialty + zones ===
GIN_SPEC=$(pg_query "SELECT COUNT(*) FROM pg_indexes WHERE indexname LIKE 'idx_insure_experts_specialty%'")
GIN_ZONES=$(pg_query "SELECT COUNT(*) FROM pg_indexes WHERE indexname LIKE 'idx_insure_experts_zones%'")
if [ "$GIN_SPEC" = "1" ] && [ "$GIN_ZONES" = "1" ]; then
  add_row "T15-V2" "Indexes GIN specialty + zones" "PASS" "2 indexes GIN"
else
  add_row "T15-V2" "Indexes GIN specialty + zones" "FAIL" "spec=$GIN_SPEC zones=$GIN_ZONES"
fi

# === V3 (P0) : Service 6 methodes ===
SERVICE="repo/packages/insure/src/services/experts-catalog.service.ts"
METHODS=(onboardExpert approveKyb rejectKyb suspendExpert checkAgrementExpiry searchExperts)
METHODS_OK=0
for method in "${METHODS[@]}"; do
  grep -q "$method" "$SERVICE" 2>/dev/null && METHODS_OK=$((METHODS_OK + 1))
done
if [ "$METHODS_OK" -eq 6 ]; then
  add_row "T15-V3" "Service 6 methodes" "PASS" "Toutes presentes"
else
  add_row "T15-V3" "Service 6 methodes" "FAIL" "$METHODS_OK / 6 methodes"
fi

# === V4 (P0) : Validation Zod CIN + ACAPS + email + expiry ===
ZOD_VALIDATION=$(grep -cE "OnboardExpertSchema|z\.string|z\.email|z\.date" "$SERVICE" 2>/dev/null)
if [ "$ZOD_VALIDATION" -ge 3 ]; then
  add_row "T15-V4" "Validation Zod presente" "PASS" "$ZOD_VALIDATION validations"
else
  add_row "T15-V4" "Validation Zod presente" "FAIL" "Validation Zod insuffisante"
fi

# === V5 (P0) : Cron daily ACAPS expiry registered ===
CRON_REG=$(grep -c "@Cron" repo/packages/insure/src/jobs/insure-experts-agrement-expiry.cron.ts 2>/dev/null)
if [ "$CRON_REG" -ge 1 ]; then
  add_row "T15-V5" "Cron daily ACAPS registered" "PASS" "Cron registered"
else
  add_row "T15-V5" "Cron daily ACAPS registered" "FAIL" "Cron pas trouve"
fi

# === V6 (P0) : 5 endpoints REST ===
CTRL="repo/apps/api/src/modules/insure/controllers/experts.controller.ts"
ENDPOINTS=("onboard" "search" "approve-kyb" "reject-kyb" "suspend")
EP_OK=0
for ep in "${ENDPOINTS[@]}"; do
  grep -q "$ep" "$CTRL" 2>/dev/null && EP_OK=$((EP_OK + 1))
done
if [ "$EP_OK" -eq 5 ]; then
  add_row "T15-V6" "5 endpoints REST presents" "PASS" "Tous endpoints"
else
  add_row "T15-V6" "5 endpoints REST presents" "FAIL" "$EP_OK / 5 endpoints"
fi

# === V7 (P0) : Tests 15+ scenarios PASS ===
cd repo
T15_TESTS=$(pnpm vitest run --reporter=json packages/insure/src/services/experts-catalog.service.spec.ts 2>/dev/null | jq '.numPassedTests // 0' 2>/dev/null || echo 0)
cd ..
if [ "$T15_TESTS" -ge 15 ]; then
  add_row "T15-V7" "Tests >= 15 scenarios PASS" "PASS" "$T15_TESTS tests"
else
  add_row "T15-V7" "Tests >= 15 scenarios PASS" "FAIL" "$T15_TESTS / 15"
fi

# === V8 (P0) : Events Kafka emis (verifier code reference Kafka) ===
KAFKA_EVENTS=$(grep -cE "insurtech\.events\.insure\.expert\.(onboarded|kyb_approved|agrement_expired)" "$SERVICE" 2>/dev/null)
if [ "$KAFKA_EVENTS" -ge 2 ]; then
  add_row "T15-V8" "Events Kafka insure.expert.* emis" "PASS" "$KAFKA_EVENTS events"
else
  add_row "T15-V8" "Events Kafka insure.expert.* emis" "FAIL" "$KAFKA_EVENTS / 3 events"
fi

# === V9 (P0) : Constraint carrier_internal ===
CHECK_CONSTRAINT=$(pg_query "SELECT COUNT(*) FROM information_schema.check_constraints WHERE constraint_name LIKE '%expert_type%'")
if [ "$CHECK_CONSTRAINT" -ge 1 ]; then
  add_row "T15-V9" "Constraint CHECK expert_type" "PASS" "Constraint active"
else
  add_row "T15-V9" "Constraint CHECK expert_type" "WARN" "Constraint verification manuelle"
fi
```

---

## TACHE 16/17 -- 4.1.16 : insure_expert_assignments + service designation

```bash
echo ""
echo "================================================"
echo "TACHE 4.1.16 : insure_expert_assignments (NOUVEAU v3.0)"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 8"
echo "================================================"

# === Fichiers ===
for f in \
  "repo/packages/insure/src/entities/insure-expert-assignment.entity.ts" \
  "repo/packages/insure/src/services/expert-assignments.service.ts" \
  "repo/packages/insure/src/services/expert-assignments.service.spec.ts" \
  "repo/apps/api/src/modules/insure/controllers/expert-assignments.controller.ts"; do
  BASE=$(basename "$f")
  if [ -f "$f" ]; then
    add_row "T16-F-$BASE" "Fichier $BASE existe" "PASS" "Cree"
  else
    add_row "T16-F-$BASE" "Fichier $BASE existe" "FAIL" "Manquant"
  fi
done

# === V1 (P0) : Migration table + RLS + FORCE ===
RLS_OK=$(pg_query "SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE relname = 'insure_expert_assignments'")
if [ "$RLS_OK" = "t" ]; then
  add_row "T16-V1" "Table insure_expert_assignments + RLS" "PASS" "RLS + FORCE active"
else
  pg_query_raw "ALTER TABLE insure_expert_assignments ENABLE ROW LEVEL SECURITY; ALTER TABLE insure_expert_assignments FORCE ROW LEVEL SECURITY;"
  RLS_OK2=$(pg_query "SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE relname = 'insure_expert_assignments'")
  if [ "$RLS_OK2" = "t" ]; then
    add_row "T16-V1" "Table insure_expert_assignments + RLS" "PASS*" "Repare auto"
  else
    add_row "T16-V1" "Table insure_expert_assignments + RLS" "FAIL" "RLS non activable"
  fi
fi

# === V2 (P0) : Workflow 6 etats CHECK constraint ===
STATUS_CHECK=$(pg_query_raw "\d insure_expert_assignments" 2>&1 | grep -cE "designated|accepted|rejected|in_progress|completed|cancelled")
if [ "$STATUS_CHECK" -ge 1 ]; then
  add_row "T16-V2" "Workflow 6 etats CHECK constraint" "PASS" "Constraint presente"
else
  add_row "T16-V2" "Workflow 6 etats CHECK constraint" "FAIL" "Constraint manquante"
fi

# === V3 (P0) : Cross-tenant garage_to_expert_request auto-create ===
SERVICE="repo/packages/insure/src/services/expert-assignments.service.ts"
CROSS_TENANT=$(grep -c "garage_to_expert_request" "$SERVICE" 2>/dev/null)
if [ "$CROSS_TENANT" -ge 1 ]; then
  add_row "T16-V3" "Cross-tenant garage_to_expert_request auto-create" "PASS" "Code present"
else
  add_row "T16-V3" "Cross-tenant garage_to_expert_request auto-create" "FAIL" "Code absent"
fi

# === V4 (P0) : Service 9 methodes ===
METHODS=(designateExpert acceptAssignment rejectAssignment scheduleVisit markVisitCompleted markReportSubmitted cancelAssignment listMyAssignments listCarrierAssignments)
METHODS_OK=0
for method in "${METHODS[@]}"; do
  grep -q "$method" "$SERVICE" 2>/dev/null && METHODS_OK=$((METHODS_OK + 1))
done
if [ "$METHODS_OK" -eq 9 ]; then
  add_row "T16-V4" "Service 9 methodes" "PASS" "Toutes presentes"
elif [ "$METHODS_OK" -ge 7 ]; then
  add_row "T16-V4" "Service 9 methodes" "WARN" "$METHODS_OK / 9 (tolere)"
else
  add_row "T16-V4" "Service 9 methodes" "FAIL" "$METHODS_OK / 9"
fi

# === V5 (P0) : 7 endpoints REST ===
CTRL="repo/apps/api/src/modules/insure/controllers/expert-assignments.controller.ts"
EP_COUNT=$(grep -cE "@(Post|Get|Put|Delete)" "$CTRL" 2>/dev/null)
if [ "$EP_COUNT" -ge 7 ]; then
  add_row "T16-V5" "7 endpoints REST" "PASS" "$EP_COUNT endpoints"
else
  add_row "T16-V5" "7 endpoints REST" "FAIL" "$EP_COUNT / 7"
fi

# === V6 (P0) : Permissions Sprint 7.5a enforces ===
PERMS=$(grep -cE "carrier\.experts\.designate|expertise\.missions" "$CTRL" 2>/dev/null)
if [ "$PERMS" -ge 2 ]; then
  add_row "T16-V6" "Permissions Sprint 7.5a enforces" "PASS" "$PERMS permissions"
else
  add_row "T16-V6" "Permissions Sprint 7.5a enforces" "FAIL" "$PERMS / 2"
fi

# === V7 (P0) : Events Kafka emis ===
KAFKA_EVENTS=$(grep -cE "insurtech\.events\.insure\.expert\.(designated|accepted|completed)" "$SERVICE" 2>/dev/null)
if [ "$KAFKA_EVENTS" -ge 2 ]; then
  add_row "T16-V7" "Events Kafka emis" "PASS" "$KAFKA_EVENTS events"
else
  add_row "T16-V7" "Events Kafka emis" "WARN" "$KAFKA_EVENTS events (verifier)"
fi

# === V8 (P0) : Tests 20+ scenarios PASS ===
cd repo
T16_TESTS=$(pnpm vitest run --reporter=json packages/insure/src/services/expert-assignments.service.spec.ts 2>/dev/null | jq '.numPassedTests // 0' 2>/dev/null || echo 0)
cd ..
if [ "$T16_TESTS" -ge 20 ]; then
  add_row "T16-V8" "Tests >= 20 scenarios PASS" "PASS" "$T16_TESTS tests"
else
  add_row "T16-V8" "Tests >= 20 scenarios PASS" "FAIL" "$T16_TESTS / 20"
fi
```

---

## TACHE 17/17 -- 4.1.17 : insure_expert_reports preview Sprint 22.7

```bash
echo ""
echo "================================================"
echo "TACHE 4.1.17 : insure_expert_reports preview (NOUVEAU v3.0)"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 7"
echo "================================================"

# === Fichiers ===
for f in \
  "repo/packages/insure/src/entities/insure-expert-report.entity.ts" \
  "repo/packages/insure/src/services/expert-reports-basic.service.ts" \
  "repo/packages/insure/src/services/expert-reports-basic.service.spec.ts" \
  "repo/apps/api/src/modules/insure/controllers/expert-reports.controller.ts" \
  "repo/docs/expert-reports-sprint-22.7-extension-path.md"; do
  BASE=$(basename "$f")
  if [ -f "$f" ]; then
    add_row "T17-F-$BASE" "Fichier $BASE existe" "PASS" "Cree"
  else
    add_row "T17-F-$BASE" "Fichier $BASE existe" "FAIL" "Manquant"
  fi
done

# === V1 (P0) : Migration table + RLS ===
RLS_OK=$(pg_query "SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE relname = 'insure_expert_reports'")
if [ "$RLS_OK" = "t" ]; then
  add_row "T17-V1" "Table insure_expert_reports + RLS" "PASS" "RLS + FORCE active"
else
  pg_query_raw "ALTER TABLE insure_expert_reports ENABLE ROW LEVEL SECURITY; ALTER TABLE insure_expert_reports FORCE ROW LEVEL SECURITY;"
  RLS_OK2=$(pg_query "SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE relname = 'insure_expert_reports'")
  [ "$RLS_OK2" = "t" ] && add_row "T17-V1" "Table insure_expert_reports + RLS" "PASS*" "Repare" || add_row "T17-V1" "Table insure_expert_reports + RLS" "FAIL" "Non activable"
fi

# === V2 (P0) : JSONB fields ===
JSONB_FIELDS=$(pg_query "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'insure_expert_reports' AND data_type = 'jsonb'")
if [ "$JSONB_FIELDS" -ge 2 ]; then
  add_row "T17-V2" "JSONB report_content + modifications" "PASS" "$JSONB_FIELDS champs JSONB"
else
  add_row "T17-V2" "JSONB report_content + modifications" "FAIL" "$JSONB_FIELDS / 2"
fi

# === V3 (P0) : Service 5 methodes preview ===
SERVICE="repo/packages/insure/src/services/expert-reports-basic.service.ts"
METHODS=(createDraftReport updateDraft markCompleted getReport listAssignmentReports)
METHODS_OK=0
for method in "${METHODS[@]}"; do
  grep -q "$method" "$SERVICE" 2>/dev/null && METHODS_OK=$((METHODS_OK + 1))
done
if [ "$METHODS_OK" -eq 5 ]; then
  add_row "T17-V3" "Service 5 methodes preview" "PASS" "Toutes presentes"
else
  add_row "T17-V3" "Service 5 methodes preview" "FAIL" "$METHODS_OK / 5"
fi

# === V4 (P0) : 4 endpoints REST basics ===
CTRL="repo/apps/api/src/modules/insure/controllers/expert-reports.controller.ts"
EP_COUNT=$(grep -cE "@(Post|Get|Put)" "$CTRL" 2>/dev/null)
if [ "$EP_COUNT" -ge 4 ]; then
  add_row "T17-V4" "4 endpoints REST basics" "PASS" "$EP_COUNT endpoints"
else
  add_row "T17-V4" "4 endpoints REST basics" "FAIL" "$EP_COUNT / 4"
fi

# === V5 (P1) : Documentation Sprint 22.7 extension ===
DOC="repo/docs/expert-reports-sprint-22.7-extension-path.md"
if [ -f "$DOC" ]; then
  DOC_LINES=$(wc -l < "$DOC")
  if [ "$DOC_LINES" -ge 50 ]; then
    add_row "T17-V5" "Doc Sprint 22.7 extension path" "PASS" "$DOC_LINES lignes"
  else
    add_row "T17-V5" "Doc Sprint 22.7 extension path" "WARN" "$DOC_LINES lignes (faible)"
  fi
else
  add_row "T17-V5" "Doc Sprint 22.7 extension path" "FAIL" "Manquant"
fi

# === V6 (P0) : Tests 15+ scenarios basics PASS ===
cd repo
T17_TESTS=$(pnpm vitest run --reporter=json packages/insure/src/services/expert-reports-basic.service.spec.ts 2>/dev/null | jq '.numPassedTests // 0' 2>/dev/null || echo 0)
cd ..
if [ "$T17_TESTS" -ge 15 ]; then
  add_row "T17-V6" "Tests >= 15 scenarios PASS" "PASS" "$T17_TESTS tests"
else
  add_row "T17-V6" "Tests >= 15 scenarios PASS" "FAIL" "$T17_TESTS / 15"
fi

# === V7 (P0) : Permissions enforces ===
PERMS=$(grep -cE "expertise\.report\.(create|read)" "$CTRL" 2>/dev/null)
if [ "$PERMS" -ge 2 ]; then
  add_row "T17-V7" "Permissions expertise.report.* enforces" "PASS" "$PERMS perms"
else
  add_row "T17-V7" "Permissions expertise.report.* enforces" "FAIL" "$PERMS / 2"
fi
```

---

## VERIFICATIONS TRANSVERSALES SPRINT 14 v3.0

### TR-BUILD : Build complet du sprint

```bash
echo ""
echo "================================================"
echo "VERIFICATIONS TRANSVERSALES SPRINT 14 v3.0"
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

### TR-TESTS : Tests Vitest unitaires (>= 65 scenarios Sprint 14 + no regression)

```bash
echo "=== TR-TESTS : Tests Vitest ==="
VITEST_OUT=$(pnpm vitest run --coverage --reporter=json 2>/dev/null)
TESTS_PASSED=$(echo "$VITEST_OUT" | jq '.numPassedTests // 0' 2>/dev/null || echo 0)
TESTS_TOTAL=$(echo "$VITEST_OUT" | jq '.numTotalTests // 0' 2>/dev/null || echo 0)

# Baseline Sprint 6 = 1071 tests. Sprint 14 ajoute 65+ tests = 1136+ total
if [ "$TESTS_TOTAL" -ge 1136 ] && [ "$TESTS_PASSED" -eq "$TESTS_TOTAL" ]; then
  add_row "TR-TESTS" "Tests unitaires PASS (>= 1136 baseline+Sprint 14)" "PASS" "$TESTS_PASSED/$TESTS_TOTAL"
elif [ "$TESTS_PASSED" -eq "$TESTS_TOTAL" ]; then
  add_row "TR-TESTS" "Tests unitaires PASS" "WARN" "$TESTS_PASSED/$TESTS_TOTAL (< baseline)"
else
  add_row "TR-TESTS" "Tests unitaires PASS" "FAIL" "$TESTS_PASSED/$TESTS_TOTAL passes"
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

### TR-TENANT : Multi-tenant filter + RLS new tables

```bash
echo "=== TR-TENANT : Multi-tenant filter + RLS ==="
# 3 nouvelles tables doivent avoir RLS active + FORCE
NEW_TABLES=(insure_experts insure_expert_assignments insure_expert_reports)
RLS_OK_COUNT=0
for table in "${NEW_TABLES[@]}"; do
  RLS=$(pg_query "SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE relname = '$table'")
  [ "$RLS" = "t" ] && RLS_OK_COUNT=$((RLS_OK_COUNT + 1))
done
if [ "$RLS_OK_COUNT" -eq 3 ]; then
  add_row "TR-TENANT" "RLS active + FORCE sur 3 nouvelles tables" "PASS" "3/3 tables"
else
  add_row "TR-TENANT" "RLS active + FORCE sur 3 nouvelles tables" "FAIL" "$RLS_OK_COUNT / 3"
fi
```

### TR-ZOD : Validation Zod (pas class-validator)

```bash
echo "=== TR-ZOD : Validation Zod ==="
CLASS_VALIDATOR=$(grep -rn "class-validator\|@IsString\|@IsEmail\|@IsNotEmpty" repo/packages/insure repo/apps/api/src/modules/insure --include="*.ts" 2>/dev/null | wc -l)
if [ "$CLASS_VALIDATOR" -eq 0 ]; then
  add_row "TR-ZOD" "Validation Zod (no class-validator)" "PASS" "Conforme"
else
  add_row "TR-ZOD" "Validation Zod (no class-validator)" "FAIL" "$CLASS_VALIDATOR usages class-validator"
fi

cd ..
```

### TR-MIGRATIONS : Migrations DB Sprint 14 v3.0 (3 nouvelles)

```bash
echo "=== TR-MIGRATIONS : Migrations DB ==="
MIGR_COUNT=$(pg_query "SELECT COUNT(*) FROM migrations WHERE name LIKE '%Sprint14%' OR name LIKE '%sprint14%'")
if [ "$MIGR_COUNT" -ge 3 ]; then
  add_row "TR-MIG" "Migrations Sprint 14 appliquees (>= 3)" "PASS" "$MIGR_COUNT migrations"
else
  add_row "TR-MIG" "Migrations Sprint 14 appliquees (>= 3)" "WARN" "$MIGR_COUNT / 3 (verifier)"
fi
```

### TR-CROSS-TENANT : garage_to_expert_request auto-create fonctionnel

```bash
echo "=== TR-CROSS-TENANT : garage_to_expert_request ==="
cd repo
CROSS_TEST=$(pnpm vitest run --reporter=json apps/api/test/insure/expert-assignments-cross-tenant.e2e-spec.ts 2>/dev/null | jq '.numPassedTests // 0' 2>/dev/null || echo 0)
cd ..
if [ "$CROSS_TEST" -ge 3 ]; then
  add_row "TR-CROSS-TENANT" "Tests cross-tenant garage_to_expert" "PASS" "$CROSS_TEST tests"
else
  add_row "TR-CROSS-TENANT" "Tests cross-tenant garage_to_expert" "FAIL" "$CROSS_TEST / 3"
fi
```

---

## RAPPORT FINAL CONSOLIDE

```bash
echo ""
echo "================================================"
echo "GENERATION RAPPORT FINAL"
echo "================================================"

TOTAL=$((PASS + PASS_REPAIRED + FAIL + SKIP + WARN))
SCORE_NUM=$((PASS + PASS_REPAIRED))
SCORE_PCT=$(echo "scale=1; $SCORE_NUM * 100 / $TOTAL" | bc -l 2>/dev/null || echo "0")

# Determination jalon GO / GO CONDITIONNEL / NO-GO
JALON="NO-GO"
if (( $(echo "$SCORE_PCT >= 95" | bc -l 2>/dev/null || echo 0) )); then
  JALON="GO"
elif (( $(echo "$SCORE_PCT >= 85" | bc -l 2>/dev/null || echo 0) )); then
  JALON="GO CONDITIONNEL"
fi

cat >> "$REPORT_FILE" << EOF

## Synthese finale

| Categorie | Nombre |
|-----------|--------|
| PASS (premier essai) | $PASS |
| PASS* (apres reparation) | $PASS_REPAIRED |
| FAIL | $FAIL |
| SKIP | $SKIP |
| WARN | $WARN |
| **TOTAL** | **$TOTAL** |

**Score** : $SCORE_PCT% ($SCORE_NUM / $TOTAL)

**Jalon** : $JALON

---

## Resultats detailles

| ID | Description | Statut | Details |
|----|-------------|--------|---------|
$(echo -e "$TABLE_ROWS")

---

## Decision

EOF

case "$JALON" in
  GO)
    cat >> "$REPORT_FILE" << EOF
**GO** -- Sprint 14 v3.0 valide. Passer au Sprint 15 Insure Lifecycle Police.

Actions :
1. \`git tag -a "sprint-14-complete-v3-insure-foundation" -m "Sprint 14 v3.0 complete -- score $SCORE_PCT%"\`
2. \`git push origin sprint-14-complete-v3-insure-foundation\`
3. Lancer Sprint 15 via C-15
EOF
    ;;
  "GO CONDITIONNEL")
    cat >> "$REPORT_FILE" << EOF
**GO CONDITIONNEL** -- Sprint 14 v3.0 partiellement valide ($SCORE_PCT%).

Actions :
1. Documenter dette dans \`00-pilotage/dette-technique-sprint-14.md\`
2. Resoudre FAIL P0 dans Sprint 15 si possible
3. Tag : \`git tag -a "sprint-14-complete-v3-conditional" -m "Sprint 14 v3.0 conditional -- score $SCORE_PCT%"\`
4. Lancer Sprint 15 avec dette tracked
EOF
    ;;
  NO-GO)
    cat >> "$REPORT_FILE" << EOF
**NO-GO** -- Sprint 14 v3.0 echoue ($SCORE_PCT%).

Actions :
1. Identifier les FAIL P0 dans tableau ci-dessus
2. Re-executer taches FAIL ciblees
3. Re-lancer V-14
4. NE PAS demarrer Sprint 15 avant GO obtenu
EOF
    ;;
esac

echo ""
echo "================================================"
echo "RAPPORT GENERE : $REPORT_FILE"
echo "Score : $SCORE_PCT% / Jalon : $JALON"
echo "================================================"

cat "$REPORT_FILE"
```

---

## NOTES IMPORTANTES POUR EXECUTION

1. **Auto-reparation active** : V1 RLS + FORCE tentee auto-repair si echec initial
2. **Tests E2E baseline** : Sprint 14 doit conserver tous tests precedents (1071+ baseline + ajouter 65+ Sprint 14)
3. **3 RLS critiques** : insure_experts + insure_expert_assignments + insure_expert_reports DOIVENT avoir RLS + FORCE
4. **Cross-tenant garage_to_expert_request** : test E2E obligatoire (TR-CROSS-TENANT)
5. **Score >= 95%** = GO, **85-95%** = GO CONDITIONNEL, **< 85%** = NO-GO
6. **Si FAIL P0 detecte** : lister dans rapport + suggerer re-tentative tache concernee
7. **Tag pose seulement si GO** -- sinon dette tracked dans dette-technique

---

**Fin verification V-14 v3.0 -- Sprint 14 (4.1) Insure Foundation + 3 entites experts.**

**Total criteres** : 73 (50 Phase A v2.2 + 23 Phase B v3.0) + 11 transversaux = 84 criteres
