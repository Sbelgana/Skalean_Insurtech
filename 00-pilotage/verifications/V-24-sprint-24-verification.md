# VERIFICATION SPRINT 24 v3.0 -- Phase 5 / Sprint 6 : Flux Sinistre 5 Acteurs + Scenario Demo Day
# Auto-reparation active + Rapport final MD detaille
# 15 taches, 80 criteres extraits B-24 v3.0
# AUCUNE EMOJI AUTORISEE

**Version** : v3.0 (verification detaillee + jalon Demo Day)
**Phase** : 5 -- Vertical Repair
**Sprint** : 24 / 40 (cumul v3.0) -- Sprint 6 dans Phase 5
**Reference meta-prompt** : `B-24-sprint-24-flux-sinistre-client.md` v3.0
**Reference orchestrateur** : `C-24-sprint-24-flux-sinistre.md`
**Total criteres** : 80 criteres taches + 11 transversaux + 5 specifiques Demo Day

---

Tu es **Claude Code (ou Cowork)**. Execute verification COMPLETE Sprint 24 v3.0 apres 15 taches. **JALON CRITIQUE : Demo Day 30 juin 2026 readiness.**

---

## REGLES D'EXECUTION

1. Execute CHAQUE verification dans l'ordre (taches + transversaux + Demo Day specifiques)
2. Tentative reparation automatique avant FAIL
3. Consigne dans `sprint24-verify-report.md`
4. Rapport consolide final + score GO/GO CONDITIONNEL/NO-GO + **Demo Day readiness verdict**
5. JAMAIS interrompre l'execution

**Jalon Demo Day** :
- **GO** (score >= 95%) -> Demo Day 30 juin 2026 prete + dry-run J-7 planifie
- **GO CONDITIONNEL** (85-95%) -> Fallback J-15 decision-015 (scope reduit scenario 1 seul)
- **NO-GO** (< 85%) -> Demo Day repoussee + escalation Saad/Abla obligatoire

---

## PHASE DE PREPARATION

```bash
REPORT_FILE="sprint24-verify-report.md"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
RUN_ID=$(date '+%Y%m%d-%H%M%S')

cat > "$REPORT_FILE" << EOF
# Rapport de Verification - Sprint 24 v3.0 : Flux Sinistre 5 Acteurs + Demo Day

**Date** : $TIMESTAMP
**Run ID** : $RUN_ID
**Phase** : 5 -- Vertical Repair
**Sprint** : 24 (Phase 5 / Sprint 6)
**Reference B-24 v3.0** : 15 taches (10 v2.2 refondues + 5 v3.0 nouveaux), 80 criteres
**Jalon** : Demo Day 30 juin 2026 readiness
**Executeur** : Claude Code / Cowork (auto-verification + auto-reparation)

---
EOF

echo "[PREP] Rapport initialise : $REPORT_FILE"

PASS=0; PASS_REPAIRED=0; FAIL=0; SKIP=0; WARN=0; TABLE_ROWS=""

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
pg_query() { psql "$DB_URL" -t -c "$1" 2>/dev/null | tr -d ' \n'; }
pg_query_raw() { psql "$DB_URL" -c "$1" 2>/dev/null; }
```

---

## VERIFICATIONS PAR TACHE (15 taches)

---

## TACHE 1/15 -- 5.6.1 : FNOL customer + auto-create (REFONDU v3.0)

```bash
echo ""
echo "TACHE 5.6.1 : FNOL customer (REFONDU v3.0)"

# T01-F1 : Migration colonnes fnol_*
COLS_OK=$(pg_query "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'repair_sinistres' AND column_name IN ('fnol_declared_at', 'fnol_declared_by_user_id', 'fnol_source', 'fnol_initial_estimate_mad')")
if [ "$COLS_OK" -ge 4 ]; then
  add_row "T01-F1" "Colonnes fnol_* migration v3.0" "PASS" "$COLS_OK / 4"
else
  add_row "T01-F1" "Colonnes fnol_* migration v3.0" "FAIL" "$COLS_OK / 4"
fi

# T01-V1 : Service fnol-declarations 4 methodes
SERVICE="repo/packages/repair/src/services/fnol-declarations.service.ts"
METHODS=(declareFnol attachPhotos attachDocuments submitToCarrier)
OK=0; for m in "${METHODS[@]}"; do grep -q "$m" "$SERVICE" 2>/dev/null && OK=$((OK + 1)); done
[ "$OK" -eq 4 ] && add_row "T01-V1" "Service 4 methodes" "PASS" "" || add_row "T01-V1" "Service 4 methodes" "FAIL" "$OK / 4"

# T01-V2 : Event Kafka emis
KAFKA=$(grep -c "insurtech\.events\.repair\.sinistre\.declared" "$SERVICE" 2>/dev/null)
[ "$KAFKA" -ge 1 ] && add_row "T01-V2" "Event Kafka emis" "PASS" "" || add_row "T01-V2" "Event Kafka emis" "FAIL" "Absent"

# T01-V3 : WhatsApp scope strict
WA_USAGE=$(grep -cE "sendWhatsAppStatus|STATUS_ONLY" "$SERVICE" 2>/dev/null)
[ "$WA_USAGE" -ge 1 ] && add_row "T01-V3" "WhatsApp scope strict" "PASS" "" || add_row "T01-V3" "WhatsApp scope strict" "FAIL" "Non strict"

# T01-V4 : Tests 12+
cd repo
T01_TESTS=$(pnpm vitest run --reporter=json packages/repair/src/services/fnol-declarations.service.spec.ts 2>/dev/null | jq '.numPassedTests // 0' 2>/dev/null || echo 0)
cd ..
[ "$T01_TESTS" -ge 12 ] && add_row "T01-V4" "Tests >= 12" "PASS" "$T01_TESTS tests" || add_row "T01-V4" "Tests >= 12" "FAIL" "$T01_TESTS / 12"
```

---

## TACHE 2/15 -- 5.6.2 : Carrier review + Sky AI routing (REFONDU v3.0)

```bash
echo ""
echo "TACHE 5.6.2 : Carrier review + Sky AI routing (REFONDU v3.0)"

SERVICE="repo/packages/repair/src/services/carrier-fnol-review.service.ts"

# T02-V1 : Service 3 methodes
METHODS=(reviewFnol requestSkyAiRoutingRecommendation routeSinistre)
OK=0; for m in "${METHODS[@]}"; do grep -q "$m" "$SERVICE" 2>/dev/null && OK=$((OK + 1)); done
[ "$OK" -eq 3 ] && add_row "T02-V1" "Service 3 methodes" "PASS" "" || add_row "T02-V1" "Service 3 methodes" "FAIL" "$OK / 3"

# T02-V2 : Sky AI Decision Engine integration
if grep -qE "@insurtech/sky|skyAiDecisionEngine|SkyAiService" "$SERVICE" 2>/dev/null; then
  add_row "T02-V2" "Sky AI Decision Engine integre" "PASS" "Integration OK"
else
  add_row "T02-V2" "Sky AI Decision Engine integre" "FAIL" "Sky AI absent"
fi

# T02-V3 : Routing decisions JSONB persistees
if pg_query "SELECT 1 FROM information_schema.columns WHERE table_name = 'repair_sinistres' AND column_name = 'carrier_routing_decision' AND data_type = 'jsonb'" | grep -q "1"; then
  add_row "T02-V3" "carrier_routing_decision JSONB" "PASS" "Persisted"
else
  add_row "T02-V3" "carrier_routing_decision JSONB" "FAIL" "Colonne absente"
fi

# T02-V4 : Mock rejection 5%
MOCK="repo/packages/repair/src/services/mock-carrier-fnol.service.ts"
if grep -qE "MOCK_REJECTION_RATE.*0\.05|0\.05.*reject" "$MOCK" 2>/dev/null; then
  add_row "T02-V4" "Mock rejection rate 5%" "PASS" "Realistic v3.0"
else
  add_row "T02-V4" "Mock rejection rate 5%" "WARN" "A verifier"
fi

# T02-V5 : Tests 12+
cd repo
T02_TESTS=$(pnpm vitest run --reporter=json packages/repair/src/services/carrier-fnol-review.service.spec.ts 2>/dev/null | jq '.numPassedTests // 0' 2>/dev/null || echo 0)
cd ..
[ "$T02_TESTS" -ge 12 ] && add_row "T02-V5" "Tests >= 12" "PASS" "$T02_TESTS tests" || add_row "T02-V5" "Tests >= 12" "FAIL" "$T02_TESTS / 12"
```

---

## TACHE 3/15 -- 5.6.3 : Designation Tow par carrier (NOUVEAU v3.0)

```bash
echo ""
echo "TACHE 5.6.3 : Designation Tow par carrier (NOUVEAU v3.0)"

SERVICE="repo/packages/repair/src/services/carrier-tow-designation.service.ts"

# T03-F1 : Service present
[ -f "$SERVICE" ] && add_row "T03-F1" "Service carrier-tow-designation" "PASS" "Cree" || add_row "T03-F1" "Service carrier-tow-designation" "FAIL" "Manquant"

# T03-V1 : Service 2 methodes
METHODS=(designateTow cancelTowDesignation)
OK=0; for m in "${METHODS[@]}"; do grep -q "$m" "$SERVICE" 2>/dev/null && OK=$((OK + 1)); done
[ "$OK" -eq 2 ] && add_row "T03-V1" "Service 2 methodes" "PASS" "" || add_row "T03-V1" "Service 2 methodes" "FAIL" "$OK / 2"

# T03-V2 : Cross-tenant carrier_to_tow_assignment
if grep -q "carrier_to_tow_assignment" "$SERVICE" 2>/dev/null; then
  add_row "T03-V2" "Cross-tenant carrier_to_tow_assignment" "PASS" "Type utilise"
else
  add_row "T03-V2" "Cross-tenant carrier_to_tow_assignment" "FAIL" "Type absent"
fi

# T03-V3 : Tests 10+
cd repo
T03_TESTS=$(pnpm vitest run --reporter=json packages/repair/src/services/carrier-tow-designation.service.spec.ts 2>/dev/null | jq '.numPassedTests // 0' 2>/dev/null || echo 0)
cd ..
[ "$T03_TESTS" -ge 10 ] && add_row "T03-V3" "Tests >= 10" "PASS" "$T03_TESTS tests" || add_row "T03-V3" "Tests >= 10" "FAIL" "$T03_TESTS / 10"
```

---

## TACHE 4/15 -- 5.6.4 : Tow intervention + GPS tracking (NOUVEAU v3.0)

```bash
echo ""
echo "TACHE 5.6.4 : Tow intervention + GPS tracking (NOUVEAU v3.0)"

SERVICE="repo/packages/repair/src/services/tow-intervention.service.ts"

# T04-V1 : Service 5 methodes
METHODS=(acceptMission startIntervention uploadVehicleStatePhotos startTowing markVehicleDelivered)
OK=0; for m in "${METHODS[@]}"; do grep -q "$m" "$SERVICE" 2>/dev/null && OK=$((OK + 1)); done
[ "$OK" -eq 5 ] && add_row "T04-V1" "Service 5 methodes" "PASS" "" || add_row "T04-V1" "Service 5 methodes" "FAIL" "$OK / 5"

# T04-V2 : Table tow_mission_locations real-time
if pg_query "SELECT 1 FROM information_schema.tables WHERE table_name = 'tow_mission_locations'" | grep -q "1"; then
  add_row "T04-V2" "Table tow_mission_locations" "PASS" "GPS tracking"
else
  add_row "T04-V2" "Table tow_mission_locations" "FAIL" "Table absente"
fi

# T04-V3 : Tests 12+
cd repo
T04_TESTS=$(pnpm vitest run --reporter=json packages/repair/src/services/tow-intervention.service.spec.ts 2>/dev/null | jq '.numPassedTests // 0' 2>/dev/null || echo 0)
cd ..
[ "$T04_TESTS" -ge 12 ] && add_row "T04-V3" "Tests >= 12" "PASS" "$T04_TESTS tests" || add_row "T04-V3" "Tests >= 12" "FAIL" "$T04_TESTS / 12"
```

---

## TACHE 5/15 -- 5.6.5 : Designation Expert orchestree (NOUVEAU v3.0)

```bash
echo ""
echo "TACHE 5.6.5 : Designation Expert orchestree (NOUVEAU v3.0)"

SERVICE="repo/packages/repair/src/services/sinistre-expert-orchestration.service.ts"

# T05-V1 : Service 2 methodes
METHODS=(designateExpertForSinistre escalateExpertDesignation)
OK=0; for m in "${METHODS[@]}"; do grep -q "$m" "$SERVICE" 2>/dev/null && OK=$((OK + 1)); done
[ "$OK" -eq 2 ] && add_row "T05-V1" "Service 2 methodes" "PASS" "" || add_row "T05-V1" "Service 2 methodes" "FAIL" "$OK / 2"

# T05-V2 : Reuse Sprint 14 expert-assignments
if grep -qE "expertAssignmentsService|expert-assignments\.service" "$SERVICE" 2>/dev/null; then
  add_row "T05-V2" "Reuse Sprint 14 expert-assignments" "PASS" ""
else
  add_row "T05-V2" "Reuse Sprint 14 expert-assignments" "FAIL" "Pas integre Sprint 14"
fi
```

---

## TACHE 6/15 -- 5.6.6 : Expert visite + Barid (NOUVEAU v3.0)

```bash
echo ""
echo "TACHE 5.6.6 : Expert visite + Barid (NOUVEAU v3.0)"

SERVICE="repo/packages/repair/src/services/expert-visit-orchestration.service.ts"

# T06-V1 : Service 6 methodes
METHODS=(acceptExpertAssignment scheduleVisit recordVisitArrival submitInspectionReport signReportWithBarid submitReportToCarrier)
OK=0; for m in "${METHODS[@]}"; do grep -q "$m" "$SERVICE" 2>/dev/null && OK=$((OK + 1)); done
[ "$OK" -eq 6 ] && add_row "T06-V1" "Service 6 methodes" "PASS" "" || add_row "T06-V1" "Service 6 methodes" "FAIL" "$OK / 6"

# T06-V2 : Barid eSign integration
if grep -qE "barid|@insurtech/signature" "$SERVICE" 2>/dev/null; then
  add_row "T06-V2" "Barid eSign integration" "PASS" "Signature OK"
else
  add_row "T06-V2" "Barid eSign integration" "FAIL" "Barid absent"
fi

# T06-V3 : Mock orchestration realistic
MOCK="repo/packages/repair/src/services/mock-expert-visit-orchestration.service.ts"
[ -f "$MOCK" ] && add_row "T06-V3" "MockExpertVisitOrchestrationService" "PASS" "" || add_row "T06-V3" "MockExpertVisitOrchestrationService" "FAIL" "Manquant"

# T06-V4 : Tests 10+
cd repo
T06_TESTS=$(pnpm vitest run --reporter=json packages/repair/src/services/expert-visit-orchestration.service.spec.ts 2>/dev/null | jq '.numPassedTests // 0' 2>/dev/null || echo 0)
cd ..
[ "$T06_TESTS" -ge 10 ] && add_row "T06-V4" "Tests >= 10" "PASS" "$T06_TESTS tests" || add_row "T06-V4" "Tests >= 10" "FAIL" "$T06_TESTS / 10"
```

---

## TACHE 7/15 -- 5.6.7 : Garage reception + Sky AI diagnostic (REFONDU v3.0)

```bash
echo ""
echo "TACHE 5.6.7 : Garage reception + Sky AI diagnostic"

SERVICE="repo/packages/repair/src/services/sinistre-garage-orchestration.service.ts"

# T07-V1 : Service 3 methodes
METHODS=(receiveVehicleFromTow receiveVehicleFromCustomer runSkyAiDiagnostic)
OK=0; for m in "${METHODS[@]}"; do grep -q "$m" "$SERVICE" 2>/dev/null && OK=$((OK + 1)); done
[ "$OK" -eq 3 ] && add_row "T07-V1" "Service 3 methodes" "PASS" "" || add_row "T07-V1" "Service 3 methodes" "FAIL" "$OK / 3"

# T07-V2 : Sky AI integration
if grep -qE "@insurtech/sky|skyAi" "$SERVICE" 2>/dev/null; then
  add_row "T07-V2" "Sky AI diagnostic integre" "PASS" ""
else
  add_row "T07-V2" "Sky AI diagnostic integre" "FAIL" "Sky AI absent"
fi
```

---

## TACHES 8-9 -- 5.6.8-9 : Reuse Sprint 21 (devis + expert validation + carrier approval)

```bash
echo ""
echo "TACHES 5.6.8-9 : Reuse Sprint 21 orchestration"

# T08-V1 : Wrapper devis orchestration
SERVICE_8="repo/packages/repair/src/services/sinistre-devis-orchestration.service.ts"
[ -f "$SERVICE_8" ] && add_row "T08-V1" "Wrapper devis orchestration" "PASS" "" || add_row "T08-V1" "Wrapper devis orchestration" "FAIL" "Manquant"

# T09-V1 : Reuse Sprint 21 expert validation + carrier approval
SERVICE_21_EXPERT="repo/packages/expertise/src/services/expert-validation.service.ts"
SERVICE_21_CARRIER="repo/packages/repair/src/services/carrier-payment-approval.service.ts"
if [ -f "$SERVICE_21_EXPERT" ] && [ -f "$SERVICE_21_CARRIER" ]; then
  add_row "T09-V1" "Sprint 21 services reused" "PASS" "Both present"
else
  add_row "T09-V1" "Sprint 21 services reused" "FAIL" "Sprint 21 services manquants"
fi
```

---

## TACHE 10/15 -- 5.6.10 : Customer realtime tracking SSE + WebSocket (REFONDU v3.0)

```bash
echo ""
echo "TACHE 5.6.10 : Customer realtime tracking (REFONDU v3.0)"

SERVICE="repo/packages/repair/src/services/customer-realtime-tracking.service.ts"

# T10-V1 : Service 3 methodes
METHODS=(subscribeToSinistreUpdates pushMilestone getCurrentProgress)
OK=0; for m in "${METHODS[@]}"; do grep -q "$m" "$SERVICE" 2>/dev/null && OK=$((OK + 1)); done
[ "$OK" -eq 3 ] && add_row "T10-V1" "Service 3 methodes" "PASS" "" || add_row "T10-V1" "Service 3 methodes" "FAIL" "$OK / 3"

# T10-V2 : SSE Server-Sent Events
if grep -qE "Sse|EventSource|text/event-stream" "$SERVICE" 2>/dev/null; then
  add_row "T10-V2" "SSE Server-Sent Events" "PASS" "SSE present"
else
  add_row "T10-V2" "SSE Server-Sent Events" "FAIL" "SSE absent"
fi

# T10-V3 : 12 milestones definies
MILESTONES=$(grep -cE "declared|carrier_reviewed|tow_dispatched|vehicle_received|diagnosed|devis_sent_expert|expert_validated|carrier_approved|parts_ordered|repair_in_progress|qc_done|ready_for_delivery" "$SERVICE" 2>/dev/null)
if [ "$MILESTONES" -ge 10 ]; then
  add_row "T10-V3" "12 milestones definies" "PASS" "$MILESTONES detectes"
else
  add_row "T10-V3" "12 milestones definies" "WARN" "$MILESTONES / 12"
fi
```

---

## TACHE 11/15 -- 5.6.11 : Livraison + signature (PRESERVE v2.2)

```bash
echo ""
echo "TACHE 5.6.11 : Livraison + signature (PRESERVE v2.2)"

if [ -f "repo/packages/repair/src/services/deliveries.service.ts" ]; then
  add_row "T11-V1" "Service deliveries present" "PASS" "PRESERVE OK"
else
  add_row "T11-V1" "Service deliveries present" "FAIL" "Manquant"
fi
```

---

## TACHE 12/15 -- 5.6.12 : NOUVEAU Master Orchestrator State Machine (CRITIQUE)

```bash
echo ""
echo "TACHE 5.6.12 : NOUVEAU Master Orchestrator State Machine 18 etats (CRITIQUE)"

SERVICE="repo/packages/repair/src/services/sinistre-master-orchestrator.service.ts"

# T12-F1 : Service present
if [ -f "$SERVICE" ]; then
  add_row "T12-F1" "Master Orchestrator service" "PASS" "Cree"
else
  add_row "T12-F1" "Master Orchestrator service" "FAIL" "MANQUANT (CRITIQUE)"
fi

# T12-V1 (P0 CRITIQUE) : 18 etats state machine
STATES_18=$(grep -cE "declared|under_carrier_review|tow_designated|tow_in_progress|vehicle_at_garage|diagnostic_in_progress|devis_at_expert|devis_validated|carrier_payment_approved|repair_in_progress|qc|ready_delivery|delivered|closed" "$SERVICE" 2>/dev/null)
if [ "$STATES_18" -ge 14 ]; then
  add_row "T12-V1" "State machine 18 etats" "PASS" "$STATES_18 etats detectes"
else
  add_row "T12-V1" "State machine 18 etats" "FAIL" "$STATES_18 / 18 etats"
fi

# T12-V2 (P0) : Service 6 methodes
METHODS=(transitionState getStateHistory getActiveActors escalateBlockedSinistre recoverFromFailure)
OK=0; for m in "${METHODS[@]}"; do grep -q "$m" "$SERVICE" 2>/dev/null && OK=$((OK + 1)); done
if [ "$OK" -ge 5 ]; then
  add_row "T12-V2" "Service 5+ methodes" "PASS" "$OK / 5"
else
  add_row "T12-V2" "Service 5+ methodes" "FAIL" "$OK / 5"
fi

# T12-V3 (P0) : Table state_history + RLS
if pg_query "SELECT 1 FROM information_schema.tables WHERE table_name = 'repair_sinistres_state_history'" | grep -q "1"; then
  RLS=$(pg_query "SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE relname = 'repair_sinistres_state_history'")
  if [ "$RLS" = "t" ]; then
    add_row "T12-V3" "Table state_history + RLS" "PASS" "RLS + FORCE"
  else
    pg_query_raw "ALTER TABLE repair_sinistres_state_history ENABLE ROW LEVEL SECURITY; ALTER TABLE repair_sinistres_state_history FORCE ROW LEVEL SECURITY;"
    add_row "T12-V3" "Table state_history + RLS" "PASS*" "Repare auto"
  fi
else
  add_row "T12-V3" "Table state_history + RLS" "FAIL" "Table manquante"
fi

# T12-V4 : Cron daily blocked detection
CRON_FILE=$(find repo/packages/repair/src/jobs -name "*blocked*.cron.ts" 2>/dev/null | head -1)
if [ -n "$CRON_FILE" ]; then
  add_row "T12-V4" "Cron daily blocked detection" "PASS" "Cron present"
else
  add_row "T12-V4" "Cron daily blocked detection" "FAIL" "Cron manquant"
fi

# T12-V5 (P0) : Tests 25+
cd repo
T12_TESTS=$(pnpm vitest run --reporter=json packages/repair/src/services/sinistre-master-orchestrator.service.spec.ts 2>/dev/null | jq '.numPassedTests // 0' 2>/dev/null || echo 0)
cd ..
if [ "$T12_TESTS" -ge 25 ]; then
  add_row "T12-V5" "Tests >= 25" "PASS" "$T12_TESTS tests"
else
  add_row "T12-V5" "Tests >= 25" "FAIL" "$T12_TESTS / 25"
fi
```

---

## TACHE 13/15 -- 5.6.13 : REFONTE Dashboard real-time 5 acteurs

```bash
echo ""
echo "TACHE 5.6.13 : REFONTE Dashboard realtime 5 acteurs"

SERVICE="repo/packages/repair/src/services/realtime-dashboard.service.ts"

# T13-V1 : Service 5 methodes (1 par acteur)
METHODS=(getCarrierDashboard getGarageDashboard getTowDashboard getExpertDashboard getCustomerDashboard)
OK=0; for m in "${METHODS[@]}"; do grep -q "$m" "$SERVICE" 2>/dev/null && OK=$((OK + 1)); done
if [ "$OK" -eq 5 ]; then
  add_row "T13-V1" "Service 5 dashboards (1 par acteur)" "PASS" ""
else
  add_row "T13-V1" "Service 5 dashboards" "FAIL" "$OK / 5"
fi

# T13-V2 : WebSocket subscriptions
if grep -qE "WebSocket|Gateway|@WebSocketServer" "$SERVICE" 2>/dev/null || find repo/apps/api/src -name "*.gateway.ts" | grep -q "dashboard"; then
  add_row "T13-V2" "WebSocket subscriptions par acteur" "PASS" "WebSocket implemented"
else
  add_row "T13-V2" "WebSocket subscriptions par acteur" "WARN" "A verifier"
fi

# T13-V3 : Tests 12+
cd repo
T13_TESTS=$(pnpm vitest run --reporter=json packages/repair/src/services/realtime-dashboard.service.spec.ts 2>/dev/null | jq '.numPassedTests // 0' 2>/dev/null || echo 0)
cd ..
[ "$T13_TESTS" -ge 12 ] && add_row "T13-V3" "Tests >= 12" "PASS" "$T13_TESTS tests" || add_row "T13-V3" "Tests >= 12" "FAIL" "$T13_TESTS / 12"
```

---

## TACHE 14/15 -- 5.6.14 : NOUVEAU Scenario Demo Day fixtures (CRITIQUE BUSINESS)

```bash
echo ""
echo "TACHE 5.6.14 : NOUVEAU Scenario Demo Day fixtures (CRITIQUE BUSINESS)"

# T14-F1 (P0 CRITIQUE) : Script seeds
SEEDS="repo/infrastructure/scripts/seed-demo-day-fixtures-v3.ts"
if [ -f "$SEEDS" ]; then
  SEED_LINES=$(wc -l < "$SEEDS")
  if [ "$SEED_LINES" -ge 500 ]; then
    add_row "T14-F1" "Script seeds Demo Day fixtures" "PASS" "$SEED_LINES lignes"
  else
    add_row "T14-F1" "Script seeds Demo Day fixtures" "WARN" "$SEED_LINES lignes (faible)"
  fi
else
  add_row "T14-F1" "Script seeds Demo Day fixtures" "FAIL" "MANQUANT (CRITIQUE)"
fi

# T14-V1 (P0 CRITIQUE) : 3 scenarios definis
if [ -f "$SEEDS" ]; then
  SCENARIOS=$(grep -cE "scenario_1|scenario_2|scenario_3|Scenario 1|Scenario 2|Scenario 3" "$SEEDS" 2>/dev/null)
  if [ "$SCENARIOS" -ge 3 ]; then
    add_row "T14-V1" "3 scenarios fixtures" "PASS" "$SCENARIOS detectes"
  else
    add_row "T14-V1" "3 scenarios fixtures" "FAIL" "$SCENARIOS / 3"
  fi
fi

# T14-V2 (P0) : Reset fonction operational
if grep -q "resetDemoDayFixtures" "$SEEDS" 2>/dev/null; then
  add_row "T14-V2" "resetDemoDayFixtures fonction" "PASS" "Reset OK"
else
  add_row "T14-V2" "resetDemoDayFixtures fonction" "FAIL" "Reset manquant"
fi

# T14-V3 (P0) : Garage Saad data integre
if grep -qE "Garage Saad|garage_saad|Carrosserie.*Saad" "$SEEDS" 2>/dev/null; then
  add_row "T14-V3" "Garage Saad data integree (asset unique)" "PASS" "Donnees reelles"
else
  add_row "T14-V3" "Garage Saad data integree" "FAIL" "Asset manquant"
fi

# T14-V4 : Documentation runbook
RUNBOOK="repo/docs/demo-day-runbook-30-juin-2026.md"
if [ -f "$RUNBOOK" ]; then
  RB_LINES=$(wc -l < "$RUNBOOK")
  if [ "$RB_LINES" -ge 200 ]; then
    add_row "T14-V4" "Documentation runbook Demo Day" "PASS" "$RB_LINES lignes"
  else
    add_row "T14-V4" "Documentation runbook Demo Day" "WARN" "$RB_LINES lignes (faible)"
  fi
else
  add_row "T14-V4" "Documentation runbook Demo Day" "FAIL" "Runbook manquant"
fi

# T14-V5 (P0) : Reproductibilite 5 demos consecutives (test E2E specifique)
cd repo
DEMO_REPRO_TEST=$(pnpm vitest run --reporter=json apps/api/test/demo-day/fixtures-reproducibility.e2e-spec.ts 2>/dev/null | jq '.numPassedTests // 0' 2>/dev/null || echo 0)
cd ..
if [ "$DEMO_REPRO_TEST" -ge 5 ]; then
  add_row "T14-V5" "5 demos reproductibles test E2E" "PASS" "$DEMO_REPRO_TEST tests"
else
  add_row "T14-V5" "5 demos reproductibles test E2E" "FAIL" "$DEMO_REPRO_TEST / 5"
fi
```

---

## TACHE 15/15 -- 5.6.15 : Tests E2E 80+ flux complet 5 acteurs

```bash
echo ""
echo "TACHE 5.6.15 : Tests E2E 80+ flux complet 5 acteurs"

cd repo
TOTAL_E2E=$(pnpm vitest run --reporter=json apps/api/test/repair/sprint-24-flux-5-acteurs 2>/dev/null | jq '.numPassedTests // 0' 2>/dev/null || echo 0)
cd ..
if [ "$TOTAL_E2E" -ge 80 ]; then
  add_row "T15-V1" "Tests E2E >= 80 scenarios" "PASS" "$TOTAL_E2E tests"
elif [ "$TOTAL_E2E" -ge 60 ]; then
  add_row "T15-V1" "Tests E2E >= 80 scenarios" "WARN" "$TOTAL_E2E / 80 (tolere)"
else
  add_row "T15-V1" "Tests E2E >= 80 scenarios" "FAIL" "$TOTAL_E2E / 80"
fi

# T15-V2 : Test load 50 parallel
cd repo
LOAD_TEST=$(pnpm vitest run --reporter=json apps/api/test/load/sprint-24-50-parallel.e2e-spec.ts 2>/dev/null | jq '.numPassedTests // 0' 2>/dev/null || echo 0)
cd ..
if [ "$LOAD_TEST" -ge 1 ]; then
  add_row "T15-V2" "Test load 50 parallel sinistres" "PASS" "Load test OK"
else
  add_row "T15-V2" "Test load 50 parallel sinistres" "WARN" "Load test manquant ou KO"
fi

# T15-V3 : Coverage Sprint 24 >= 90%
COVERAGE_SPRINT24=$(echo "$VITEST_OUT" | jq '.coverageMap.total.lines.pct // 0' 2>/dev/null || echo 0)
if (( $(echo "$COVERAGE_SPRINT24 >= 90" | bc -l 2>/dev/null || echo 0) )); then
  add_row "T15-V3" "Coverage Sprint 24 >= 90%" "PASS" "${COVERAGE_SPRINT24}%"
elif (( $(echo "$COVERAGE_SPRINT24 >= 85" | bc -l 2>/dev/null || echo 0) )); then
  add_row "T15-V3" "Coverage Sprint 24 >= 90%" "WARN" "${COVERAGE_SPRINT24}% (cible 90%)"
else
  add_row "T15-V3" "Coverage Sprint 24 >= 90%" "FAIL" "${COVERAGE_SPRINT24}%"
fi
```

---

## VERIFICATIONS TRANSVERSALES SPRINT 24 v3.0

```bash
echo ""
echo "================================================"
echo "VERIFICATIONS TRANSVERSALES SPRINT 24 v3.0"
echo "================================================"

cd repo

# TR-BUILD
BUILD_OUT=$(pnpm turbo run build 2>&1); BUILD_CODE=$?
[ $BUILD_CODE -eq 0 ] && add_row "TR-BUILD" "Build monorepo" "PASS" "" || add_row "TR-BUILD" "Build monorepo" "FAIL" "Erreurs build"

# TR-TYPECHECK
pnpm tsc --noEmit 2>&1 > /tmp/tsc.log
TS_ERRORS=$(grep -c "error TS" /tmp/tsc.log)
[ "$TS_ERRORS" -eq 0 ] && add_row "TR-TYPECHECK" "TypeScript strict" "PASS" "0 erreur" || add_row "TR-TYPECHECK" "TypeScript strict" "FAIL" "$TS_ERRORS"

# TR-TESTS baseline (1071 + Sprint 14:65 + Sprint 21:100 + Sprint 24:120 = 1356+ minimum)
VITEST_OUT=$(pnpm vitest run --coverage --reporter=json 2>/dev/null)
TESTS_PASSED=$(echo "$VITEST_OUT" | jq '.numPassedTests // 0' 2>/dev/null || echo 0)
TESTS_TOTAL=$(echo "$VITEST_OUT" | jq '.numTotalTests // 0' 2>/dev/null || echo 0)
if [ "$TESTS_TOTAL" -ge 1356 ] && [ "$TESTS_PASSED" -eq "$TESTS_TOTAL" ]; then
  add_row "TR-TESTS" "Tests Vitest >= 1356 PASS" "PASS" "$TESTS_PASSED/$TESTS_TOTAL"
else
  add_row "TR-TESTS" "Tests Vitest baseline+sprints" "FAIL" "$TESTS_PASSED/$TESTS_TOTAL"
fi

# TR-COVERAGE >= 85% global
COVERAGE=$(echo "$VITEST_OUT" | jq '.coverageMap.total.lines.pct // 0' 2>/dev/null || echo 0)
if (( $(echo "$COVERAGE >= 85" | bc -l 2>/dev/null || echo 0) )); then
  add_row "TR-COVERAGE" "Coverage global >= 85%" "PASS" "${COVERAGE}%"
else
  add_row "TR-COVERAGE" "Coverage global >= 85%" "WARN" "${COVERAGE}%"
fi

# TR-LINT
pnpm lint 2>&1 > /tmp/lint.log; LINT_CODE=$?
[ $LINT_CODE -eq 0 ] && add_row "TR-LINT" "Biome lint" "PASS" "0 erreur" || add_row "TR-LINT" "Biome lint" "WARN" "Erreurs"

cd ..

# TR-NO-EMOJI
EMOJI_COUNT=$(grep -rP "[\x{1F300}-\x{1F9FF}]|[\x{2600}-\x{27BF}]" repo/apps repo/packages --include="*.ts" --include="*.tsx" --include="*.md" 2>/dev/null | wc -l)
[ "$EMOJI_COUNT" -eq 0 ] && add_row "TR-NO-EMOJI" "0 emoji" "PASS" "decision-006" || add_row "TR-NO-EMOJI" "0 emoji" "FAIL" "$EMOJI_COUNT"

# TR-CONSOLE
CONSOLE_LOGS=$(grep -rn "console\.log\|console\.error\|console\.warn" repo/apps repo/packages --include="*.ts" 2>/dev/null | grep -v ".spec.ts" | wc -l)
[ "$CONSOLE_LOGS" -eq 0 ] && add_row "TR-CONSOLE" "0 console.*" "PASS" "Pino" || add_row "TR-CONSOLE" "0 console.*" "FAIL" "$CONSOLE_LOGS"

# TR-COMMITS
NON_CONVENTIONAL=$(git log --since="2 weeks ago" --pretty=format:"%s" -- repo/ | grep -vE "^(feat|fix|docs|style|refactor|test|chore|perf|ci|build)(\(.+\))?:" | wc -l)
[ "$NON_CONVENTIONAL" -eq 0 ] && add_row "TR-COMMITS" "Conventional Commits" "PASS" "" || add_row "TR-COMMITS" "Conventional Commits" "WARN" "$NON_CONVENTIONAL"

# TR-RLS-NEW-TABLES (Sprint 24 ajoute repair_sinistres_state_history + tow_mission_locations)
NEW_TABLES_S24=(repair_sinistres_state_history tow_mission_locations)
RLS_OK_COUNT=0
for table in "${NEW_TABLES_S24[@]}"; do
  RLS=$(pg_query "SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE relname = '$table'")
  [ "$RLS" = "t" ] && RLS_OK_COUNT=$((RLS_OK_COUNT + 1))
done
if [ "$RLS_OK_COUNT" -eq 2 ]; then
  add_row "TR-RLS" "RLS + FORCE 2 nouvelles tables" "PASS" "2/2"
else
  add_row "TR-RLS" "RLS + FORCE 2 nouvelles tables" "FAIL" "$RLS_OK_COUNT / 2"
fi

# TR-CROSS-TENANT-7-TYPES (verifier les 7 types fonctionnels)
CROSS_TYPES_USED=$(grep -rE "carrier_to_garage|carrier_to_tow|carrier_to_expert|garage_to_carrier|garage_to_expert_request|tow_to_carrier|expert_to_carrier" repo/packages repo/apps --include="*.ts" 2>/dev/null | wc -l)
if [ "$CROSS_TYPES_USED" -ge 14 ]; then
  add_row "TR-CROSS-TENANT" "Cross-tenant 7 types utilises" "PASS" "$CROSS_TYPES_USED usages"
else
  add_row "TR-CROSS-TENANT" "Cross-tenant 7 types utilises" "WARN" "$CROSS_TYPES_USED usages (verifier coverage)"
fi

# TR-MIGRATIONS Sprint 24
MIGR_COUNT=$(pg_query "SELECT COUNT(*) FROM migrations WHERE name LIKE '%Sprint24%' OR name LIKE '%sprint24%'")
if [ "${MIGR_COUNT:-0}" -ge 3 ]; then
  add_row "TR-MIG" "Migrations Sprint 24 (>= 3)" "PASS" "$MIGR_COUNT"
else
  add_row "TR-MIG" "Migrations Sprint 24" "WARN" "$MIGR_COUNT / 3"
fi
```

---

## VERIFICATIONS SPECIFIQUES DEMO DAY (5 criteres business critiques)

```bash
echo ""
echo "================================================"
echo "VERIFICATIONS DEMO DAY READINESS (30 juin 2026)"
echo "================================================"

# DD-1 (P0 CRITIQUE) : Seeds Demo Day executables
cd repo
if pnpm run seed:demo-day-fixtures --dry-run 2>&1 | grep -qE "success|completed|3 scenarios loaded"; then
  add_row "DD-1" "Seeds Demo Day executables" "PASS" "Dry-run OK"
else
  add_row "DD-1" "Seeds Demo Day executables" "FAIL" "Dry-run KO"
fi
cd ..

# DD-2 (P0 CRITIQUE) : Master Orchestrator fonctionnel pour les 3 scenarios
cd repo
SCENARIOS_TEST=$(pnpm vitest run --reporter=json apps/api/test/demo-day/scenarios-1-2-3.e2e-spec.ts 2>/dev/null | jq '.numPassedTests // 0' 2>/dev/null || echo 0)
cd ..
if [ "$SCENARIOS_TEST" -ge 3 ]; then
  add_row "DD-2" "3 scenarios E2E passent" "PASS" "$SCENARIOS_TEST tests"
else
  add_row "DD-2" "3 scenarios E2E passent" "FAIL" "$SCENARIOS_TEST / 3"
fi

# DD-3 (P0) : Dashboard 5 acteurs visibles temps reel
DASHBOARDS_LIVE=$(curl -s http://localhost:3000/api/v1/health/dashboards 2>/dev/null | jq -r '.dashboards_active' 2>/dev/null || echo 0)
if [ "${DASHBOARDS_LIVE:-0}" -ge 5 ]; then
  add_row "DD-3" "5 dashboards actifs simultanes" "PASS" ""
else
  add_row "DD-3" "5 dashboards actifs simultanes" "WARN" "API health check non disponible"
fi

# DD-4 (P0) : Timeline 25 min validee (sum 8+12+5 = 25)
RUNBOOK="repo/docs/demo-day-runbook-30-juin-2026.md"
if [ -f "$RUNBOOK" ] && grep -qE "25 min|25min|8 min.*12 min.*5 min" "$RUNBOOK"; then
  add_row "DD-4" "Timeline 25 min documentee" "PASS" "Runbook complet"
else
  add_row "DD-4" "Timeline 25 min documentee" "WARN" "Verifier runbook"
fi

# DD-5 (P0 CRITIQUE) : Fallback J-15 documente (decision-015)
DECISION="00-pilotage/decisions/015-demo-day-pitch.md"
if [ -f "$DECISION" ] && grep -qE "fallback|fall-back|repli|scope reduit" "$DECISION"; then
  add_row "DD-5" "Fallback J-15 documente" "PASS" "decision-015 OK"
else
  add_row "DD-5" "Fallback J-15 documente" "WARN" "Fallback a documenter"
fi
```

---

## RAPPORT FINAL CONSOLIDE

```bash
TOTAL=$((PASS + PASS_REPAIRED + FAIL + SKIP + WARN))
SCORE_NUM=$((PASS + PASS_REPAIRED))
SCORE_PCT=$(echo "scale=1; $SCORE_NUM * 100 / $TOTAL" | bc -l 2>/dev/null || echo "0")

JALON="NO-GO"
DEMO_DAY_VERDICT="REPOUSSEE"
if (( $(echo "$SCORE_PCT >= 95" | bc -l 2>/dev/null || echo 0) )); then
  JALON="GO"
  DEMO_DAY_VERDICT="PRETE -- 30 juin 2026"
elif (( $(echo "$SCORE_PCT >= 85" | bc -l 2>/dev/null || echo 0) )); then
  JALON="GO CONDITIONNEL"
  DEMO_DAY_VERDICT="FALLBACK J-15 (scope reduit scenario 1)"
fi

cat >> "$REPORT_FILE" << EOF

## Synthese finale

| Categorie | Nombre |
|-----------|--------|
| PASS | $PASS |
| PASS* (repare) | $PASS_REPAIRED |
| FAIL | $FAIL |
| SKIP | $SKIP |
| WARN | $WARN |
| **TOTAL** | **$TOTAL** |

**Score** : $SCORE_PCT% ($SCORE_NUM / $TOTAL)

**Jalon Sprint 24** : $JALON

**Jalon Demo Day 30 juin 2026** : $DEMO_DAY_VERDICT

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
**GO** -- Sprint 24 v3.0 valide. **Demo Day 30 juin 2026 PRETE**.

Actions :
1. \`git tag -a "sprint-24-complete-v3-demo-day-ready" -m "Sprint 24 v3.0 + Demo Day prete -- score $SCORE_PCT%"\`
2. Planifier dry-run J-7 (24 juin 2026) avec Saad + Abla
3. Preparer slides pitch + demo dashboard switching
4. Backup environment ready (DB snapshot + rollback playbook)
EOF
    ;;
  "GO CONDITIONNEL")
    cat >> "$REPORT_FILE" << EOF
**GO CONDITIONNEL** ($SCORE_PCT%) -- **Demo Day fallback J-15 active**.

Actions :
1. Documenter dette dans \`dette-technique-sprint-24.md\`
2. Resoudre FAIL P0 ASAP (deadline 15 juin 2026)
3. Demo Day = scope reduit scenario 1 (simple collision) seul + dashboard simple
4. Tag : \`git tag -a "sprint-24-complete-v3-conditional" -m "Sprint 24 v3.0 conditional -- score $SCORE_PCT%"\`
5. Communication Saad + Abla : decision-015 fallback active
EOF
    ;;
  NO-GO)
    cat >> "$REPORT_FILE" << EOF
**NO-GO** ($SCORE_PCT%) -- **Demo Day 30 juin 2026 REPOUSSEE**.

Actions :
1. Escalation Saad + Abla immediate
2. Identifier FAIL P0 critiques (Master Orchestrator + Demo Day fixtures)
3. Re-executer taches FAIL avec priorite max
4. Re-V-24 dans 5 jours max
5. Decision board : reporter Demo Day a juillet 2026 ou maintenir avec scope tres reduit
6. NE PAS communiquer externe Demo Day tant que GO non obtenu
EOF
    ;;
esac

echo ""
echo "================================================"
echo "RAPPORT GENERE : $REPORT_FILE"
echo "Score : $SCORE_PCT% / Jalon : $JALON"
echo "Demo Day Verdict : $DEMO_DAY_VERDICT"
echo "================================================"

cat "$REPORT_FILE"
```

---

## NOTES IMPORTANTES POUR EXECUTION

1. **Jalon Demo Day** = jalon BUSINESS critique (pas seulement technique). Score V-24 < 95% impacte directement pitch 30 juin 2026.
2. **Auto-reparation** : RLS + FORCE auto-repair sur state_history + tow_mission_locations
3. **Tests baseline cumules** : 1071 (Sprint 6) + 65 (S14) + 100 (S21) + 120 (S24) = 1356+ tests minimum cumules
4. **3 verifications CRITIQUES** : T12-V1 (state machine 18 etats) + T14-V1 (3 scenarios fixtures) + T14-V5 (reproductibilite 5 demos)
5. **5 verifications Demo Day specifiques** (DD-1 a DD-5) = obligatoires pour pitch live
6. **Decision-015 fallback** : si score 85-95%, fallback J-15 documente + scope reduit scenario 1
7. **Escalation NO-GO** : Saad + Abla immediate + decision board reporter ou scope tres reduit

---

**Fin verification V-24 v3.0 -- Sprint 24 Flux Sinistre 5 Acteurs + Demo Day.**

**Total criteres** : 80 + 11 transversaux + 5 Demo Day = 96 criteres
