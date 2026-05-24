# VERIFICATION SPRINT 32 v3.0 -- Phase 7 / Sprint 2 : Connecteurs 8 Carriers (Tier 1/2/3)
# Version : Auto-reparation active + Rapport final MD detaille
# 18 taches v3.0 + 12 transversaux + 6 specifiques carriers = 88+ criteres
# AUCUNE EMOJI AUTORISEE

**Version** : v3.0 (verification detaillee + auto-reparation + specifiques carriers Tier 1/2/3)
**Phase** : 7 -- Connecteurs externes
**Sprint** : 32 / 40 (cumul v3.0) -- Phase 7 Sprint 2
**Reference meta-prompt** : `B-32-sprint-32-connecteurs-8-carriers-v3.md`
**Reference orchestrateur** : `C-32-sprint-32-insure-connecteurs-v3.md`
**Total criteres** : 70 taches + 12 transversaux + 6 specifiques = 88 criteres
**Jalon critique** : sans GO V-32 (>= 90%), Sprint 33 (pentest) bloque + tarification real-time 8 carriers indisponible Demo Day

---

Tu es **Claude Code (ou Cowork)**. Tu dois executer une **verification COMPLETE et EXHAUSTIVE** du Sprint 32 v3.0 apres execution toutes les 18 taches.

---

## REGLES D'EXECUTION

1. Tu **executes CHAQUE verification dans l'ordre** (preparation -> taches -> transversales -> specifiques -> rapport)
2. Quand une verification echoue, tu **TENTES UNE REPARATION AUTOMATIQUE** avant FAIL (3 tentatives max)
3. Tu consignes dans `sprint32-verify-report.md` TOUS les resultats
4. A la fin, tu produis le rapport consolide + calcul GO / GO CONDITIONNEL / NO-GO
5. Tu n'interromps JAMAIS l'execution

---

## FORMAT DU RAPPORT

| ID | Description | Statut | Details |

**Convention IDs** : `T{NN}-V{N}` / `T{NN}-F{N}` / `TR-{TYPE}` / `SP-{TYPE}`

**Statuts** : `PASS` / `PASS*` (repare auto) / `FAIL` (P0 bloquant) / `SKIP` / `WARN`

---

## PHASE DE PREPARATION

```bash
REPORT_FILE="sprint32-verify-report.md"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
RUN_ID=$(date '+%Y%m%d-%H%M%S')

cat > "$REPORT_FILE" << EOF
# Rapport de Verification - Sprint 32 v3.0 : Connecteurs 8 Carriers

**Date** : $TIMESTAMP
**Run ID** : $RUN_ID
**Phase** : 7 -- Connecteurs externes
**Sprint** : 32 (Phase 7 / Sprint 2) v3.0
**Reference B-32 v3.0** : 18 taches, 70 criteres + 12 transversaux + 6 specifiques = 88 total

---

## Legende

- **PASS** : reussi premier essai
- **PASS\*** : reussi apres reparation auto
- **FAIL** : echec (P0 bloquant)
- **SKIP** : ignore
- **WARN** : partiellement / manuel

---

EOF

PASS=0; PASS_REPAIRED=0; FAIL=0; SKIP=0; WARN=0
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

auto_repair() {
  local repair_cmd="$1" verify_cmd="$2" id="$3" desc="$4"
  eval "$repair_cmd" 2>&1 | tee /tmp/repair-$id.log
  if eval "$verify_cmd"; then
    add_row "$id" "$desc" "PASS*" "Repare auto"
  else
    add_row "$id" "$desc" "FAIL" "Reparation impossible"
  fi
}

DB_URL="${DATABASE_URL:-postgresql://insurtech_user:SecurePassword123!@localhost:5432/insurtech}"
pg_query() { psql "$DB_URL" -t -c "$1" 2>/dev/null | tr -d ' \n'; }
```

---

## TACHE 1/18 -- 7.2.1 : Package @insurtech/carrier-connectors

```bash
echo ""; echo "TACHE 7.2.1 : Package carrier-connectors"

[ -d "repo/packages/carrier-connectors" ] && add_row "T01-F1" "Package" "PASS" "" || add_row "T01-F1" "Package" "FAIL" "MANQUANT"

if [ -f "repo/packages/carrier-connectors/package.json" ]; then
  PKG=$(jq -r '.name' repo/packages/carrier-connectors/package.json 2>/dev/null)
  [ "$PKG" = "@insurtech/carrier-connectors" ] && add_row "T01-F2" "package.json name" "PASS" "" || add_row "T01-F2" "Name" "FAIL" "$PKG"
fi

# T01-V1 : Interface + Base abstract
[ -f "repo/packages/carrier-connectors/src/interfaces/carrier-connector.interface.ts" ] && add_row "T01-V1" "Interface" "PASS" "" || add_row "T01-V1" "Interface" "FAIL" "Manquant"
BASE=$(find repo/packages/carrier-connectors/src -name "*BaseCarrierConnector*" 2>/dev/null | head -1)
[ -n "$BASE" ] && add_row "T01-V2" "BaseCarrierConnector abstract" "PASS" "" || add_row "T01-V2" "Base class" "FAIL" "Manquant"

# T01-V3 : TypeScript 0 erreur
cd repo/packages/carrier-connectors && pnpm tsc --noEmit 2>&1 > /tmp/tsc-cc.log; cd ../../..
TS_ERR=$(grep -c "error TS" /tmp/tsc-cc.log)
[ "$TS_ERR" -eq 0 ] && add_row "T01-V3" "TypeScript 0 erreur" "PASS" "" || auto_repair "cd repo/packages/carrier-connectors && pnpm install --force && pnpm tsc --noEmit" "[ \$(grep -c 'error TS' /tmp/tsc-cc.log) -eq 0 ]" "T01-V3" "TypeScript"

T01_TESTS=$(cd repo && pnpm vitest run --reporter=json packages/carrier-connectors/src/interfaces 2>/dev/null | jq '.numPassedTests // 0' 2>/dev/null || echo 0)
[ "${T01_TESTS:-0}" -ge 5 ] && add_row "T01-V4" "Tests 5+" "PASS" "$T01_TESTS" || add_row "T01-V4" "Tests" "WARN" "$T01_TESTS / 5"
```

---

## TACHE 2/18 -- 7.2.2 : Data normalization NormalizedCarrierData

```bash
echo ""; echo "TACHE 7.2.2 : Normalization"

NORM="repo/packages/carrier-connectors/src/normalization/normalized-carrier-data.types.ts"
[ -f "$NORM" ] && add_row "T02-F1" "NormalizedCarrierData types" "PASS" "" || add_row "T02-F1" "Types" "FAIL" "Manquant"

FIELDS=$(grep -cE "policyNumber|premium|coverages|carrierId" "$NORM" 2>/dev/null || echo 0)
[ "${FIELDS:-0}" -ge 3 ] && add_row "T02-V1" "Schema unifie" "PASS" "" || add_row "T02-V1" "Schema" "WARN" "$FIELDS"

MAPPER="repo/packages/carrier-connectors/src/normalization/carrier-data-mapper.service.ts"
[ -f "$MAPPER" ] && add_row "T02-V2" "Mapper service" "PASS" "" || add_row "T02-V2" "Mapper" "FAIL" "Manquant"

T02_TESTS=$(cd repo && pnpm vitest run --reporter=json packages/carrier-connectors/src/normalization 2>/dev/null | jq '.numPassedTests // 0' 2>/dev/null || echo 0)
[ "${T02_TESTS:-0}" -ge 8 ] && add_row "T02-V3" "Tests 8+" "PASS" "$T02_TESTS" || add_row "T02-V3" "Tests" "WARN" "$T02_TESTS / 8"
```

---

## TACHE 3/18 -- 7.2.3 : Circuit breaker (opossum) + retry policies

```bash
echo ""; echo "TACHE 7.2.3 : Circuit breaker"

OPOSSUM=$(grep -c "opossum" repo/packages/carrier-connectors/package.json 2>/dev/null || echo 0)
[ "${OPOSSUM:-0}" -ge 1 ] && add_row "T03-F1" "opossum library" "PASS" "" || add_row "T03-F1" "opossum" "FAIL" "Manquante"

[ -f "repo/packages/carrier-connectors/src/resilience/circuit-breaker.service.ts" ] && add_row "T03-F2" "circuit-breaker.service" "PASS" "" || add_row "T03-F2" "Service" "FAIL" "Manquant"

RETRY=$(grep -rE "exponentialBackoff\|retries\|backoffMs" repo/packages/carrier-connectors/src/resilience 2>/dev/null | wc -l)
[ "${RETRY:-0}" -ge 1 ] && add_row "T03-V1" "Retry exponential backoff" "PASS" "" || add_row "T03-V1" "Retry" "WARN" "Absent"

T03_TESTS=$(cd repo && pnpm vitest run --reporter=json packages/carrier-connectors/src/resilience 2>/dev/null | jq '.numPassedTests // 0' 2>/dev/null || echo 0)
[ "${T03_TESTS:-0}" -ge 6 ] && add_row "T03-V2" "Tests resilience 6+" "PASS" "$T03_TESTS" || add_row "T03-V2" "Tests" "WARN" "$T03_TESTS / 6"
```

---

## TACHES 4-7 -- TIER 1 (4 carriers REST API + OAuth2)

```bash
echo ""; echo "TACHES 7.2.4-7.2.7 : TIER 1 (AXA + Allianz + Saham + Sanad)"

for carrier in axa allianz saham sanad; do
  F="repo/packages/carrier-connectors/src/carriers/${carrier}/${carrier}-connector.service.ts"
  if [ -f "$F" ]; then
    LINES=$(wc -l < "$F")
    [ "$LINES" -ge 100 ] && add_row "T_${carrier}-F1" "${carrier^^} connector" "PASS" "$LINES l" || add_row "T_${carrier}-F1" "${carrier^^}" "WARN" "$LINES"
  else
    add_row "T_${carrier}-F1" "${carrier^^} connector" "FAIL" "Manquant"
  fi
  
  OAUTH=$(grep -cE "oauth2\|client_credentials\|access_token" "$F" 2>/dev/null || echo 0)
  [ "${OAUTH:-0}" -ge 1 ] && add_row "T_${carrier}-V1" "${carrier^^} OAuth2" "PASS" "" || add_row "T_${carrier}-V1" "${carrier^^} OAuth2" "WARN" "Absent"
done
```

---

## TACHE 8/18 -- 7.2.8 : TIER 2 Wafa hybride (API + scraping)

```bash
echo ""; echo "TACHE 7.2.8 : TIER 2 Wafa"

WAFA="repo/packages/carrier-connectors/src/carriers/wafa/wafa-connector.service.ts"
[ -f "$WAFA" ] && add_row "T08-F1" "Wafa connector" "PASS" "" || add_row "T08-F1" "Wafa" "FAIL" "Manquant"

PUPPETEER=$(grep -c "puppeteer" repo/packages/carrier-connectors/package.json 2>/dev/null || echo 0)
[ "${PUPPETEER:-0}" -ge 1 ] && add_row "T08-V1" "Puppeteer installed" "PASS" "" || add_row "T08-V1" "Puppeteer" "WARN" "Manquante"

SCRAPING=$(grep -rE "page.goto\|browser.launch\|page.evaluate" "$WAFA" 2>/dev/null | wc -l)
[ "${SCRAPING:-0}" -ge 1 ] && add_row "T08-V2" "Wafa scraping logic" "PASS" "" || add_row "T08-V2" "Scraping" "WARN" "Absent"

T08_TESTS=$(cd repo && pnpm vitest run --reporter=json packages/carrier-connectors/src/carriers/wafa 2>/dev/null | jq '.numPassedTests // 0' 2>/dev/null || echo 0)
[ "${T08_TESTS:-0}" -ge 6 ] && add_row "T08-V3" "Tests Wafa 6+" "PASS" "$T08_TESTS" || add_row "T08-V3" "Tests" "WARN" "$T08_TESTS / 6"
```

---

## TACHES 9-11 -- TIER 3 (3 carriers email/manual : RMA + Atlanta + MAMDA-MCMA)

```bash
echo ""; echo "TACHES 7.2.9-7.2.11 : TIER 3 (email/manual)"

for carrier in rma atlanta mamda; do
  F="repo/packages/carrier-connectors/src/carriers/${carrier}/${carrier}-connector.service.ts"
  [ -f "$F" ] && add_row "T_${carrier}-F1" "${carrier^^} connector" "PASS" "" || add_row "T_${carrier}-F1" "${carrier^^}" "FAIL" "Manquant"
  
  FB=$(grep -cE "emailFallback\|manualQueue\|enqueueManual" "$F" 2>/dev/null || echo 0)
  [ "${FB:-0}" -ge 1 ] && add_row "T_${carrier}-V1" "${carrier^^} email+manual" "PASS" "" || add_row "T_${carrier}-V1" "${carrier^^} fallback" "WARN" "Absent"
done
```

---

## TACHE 12/18 -- 7.2.12 : Carrier Registry + service orchestration

```bash
echo ""; echo "TACHE 7.2.12 : Registry"

REG="repo/packages/carrier-connectors/src/registry/carrier-connector-registry.service.ts"
[ -f "$REG" ] && add_row "T12-F1" "Registry service" "PASS" "" || add_row "T12-F1" "Registry" "FAIL" "Manquant"

REG_CARRIERS=$(grep -rE "axa|allianz|saham|sanad|wafa|rma|atlanta|mamda" repo/packages/carrier-connectors/src/registry 2>/dev/null | sort -u | wc -l)
[ "${REG_CARRIERS:-0}" -ge 8 ] && add_row "T12-V1" "8 carriers registres" "PASS" "$REG_CARRIERS" || add_row "T12-V1" "8 carriers" "WARN" "$REG_CARRIERS / 8"

T12_TESTS=$(cd repo && pnpm vitest run --reporter=json packages/carrier-connectors/src/registry 2>/dev/null | jq '.numPassedTests // 0' 2>/dev/null || echo 0)
[ "${T12_TESTS:-0}" -ge 8 ] && add_row "T12-V2" "Tests registry 8+" "PASS" "$T12_TESTS" || add_row "T12-V2" "Tests" "WARN" "$T12_TESTS / 8"
```

---

## TACHE 13/18 -- 7.2.13 : Audit ACAPS sync events

```bash
echo ""; echo "TACHE 7.2.13 : Audit ACAPS"

MIG=$(find repo/apps/api/src/migrations -name "*CarrierSyncAudits*" 2>/dev/null | head -1)
[ -n "$MIG" ] && add_row "T13-F1" "Migration CarrierSyncAudits" "PASS" "" || add_row "T13-F1" "Migration" "FAIL" "Manquante"

TBL=$(pg_query "SELECT 1 FROM information_schema.tables WHERE table_name='carrier_sync_audits'")
[ -n "$TBL" ] && add_row "T13-V1" "Table carrier_sync_audits" "PASS" "" || add_row "T13-V1" "Table" "FAIL" "Manquante"

AUD="repo/packages/carrier-connectors/src/audit/carrier-audit.service.ts"
[ -f "$AUD" ] && grep -q "auditCarrierSync\|logSyncEvent" "$AUD" && add_row "T13-V2" "Service auditCarrierSync" "PASS" "" || add_row "T13-V2" "Service audit" "FAIL" "Manquant"
```

---

## TACHE 14/18 -- 7.2.14 : Mock mode + sandbox

```bash
echo ""; echo "TACHE 7.2.14 : Mock mode"

[ -f "repo/packages/carrier-connectors/src/mock/mock-mode.service.ts" ] && add_row "T14-F1" "Mock mode service" "PASS" "" || add_row "T14-F1" "Mock" "FAIL" "Manquant"

MODE=$(grep -rE "CARRIER_MODE\|carrierMode" repo/packages/carrier-connectors/src 2>/dev/null | wc -l)
[ "${MODE:-0}" -ge 1 ] && add_row "T14-V1" "CARRIER_MODE env" "PASS" "" || add_row "T14-V1" "Mode env" "WARN" "Absent"

FIX=$(find repo/packages/carrier-connectors/src/mock/fixtures -name "*.json" 2>/dev/null | wc -l)
[ "${FIX:-0}" -ge 8 ] && add_row "T14-V2" "Mock fixtures 8 carriers" "PASS" "$FIX" || add_row "T14-V2" "Fixtures" "WARN" "$FIX / 8"

T14_TESTS=$(cd repo && pnpm vitest run --reporter=json packages/carrier-connectors/src/mock 2>/dev/null | jq '.numPassedTests // 0' 2>/dev/null || echo 0)
[ "${T14_TESTS:-0}" -ge 6 ] && add_row "T14-V3" "Tests mock 6+" "PASS" "$T14_TESTS" || add_row "T14-V3" "Tests" "WARN" "$T14_TESTS / 6"
```

---

## TACHE 15/18 -- 7.2.15 : Endpoints REST + permissions carrier_admin

```bash
echo ""; echo "TACHE 7.2.15 : Endpoints REST"

CTRL="repo/apps/api/src/modules/carriers/carriers.controller.ts"
[ -f "$CTRL" ] && add_row "T15-F1" "carriers.controller" "PASS" "" || add_row "T15-F1" "Controller" "FAIL" "Manquant"

EP=$(grep -cE "@Post\|@Get\|@Put" "$CTRL" 2>/dev/null || echo 0)
[ "${EP:-0}" -ge 6 ] && add_row "T15-V1" "Endpoints 6+" "PASS" "$EP" || add_row "T15-V1" "Endpoints" "WARN" "$EP / 6"

PERM=$(grep -cE "carrier_admin\|carriers\.manage" "$CTRL" 2>/dev/null || echo 0)
[ "${PERM:-0}" -ge 1 ] && add_row "T15-V2" "Permission carrier_admin" "PASS" "" || add_row "T15-V2" "Permission" "WARN" "Absent"

T15_TESTS=$(cd repo && pnpm vitest run --reporter=json apps/api/src/modules/carriers 2>/dev/null | jq '.numPassedTests // 0' 2>/dev/null || echo 0)
[ "${T15_TESTS:-0}" -ge 6 ] && add_row "T15-V3" "Tests 6+" "PASS" "$T15_TESTS" || add_row "T15-V3" "Tests" "WARN" "$T15_TESTS / 6"
```

---

## TACHE 16/18 -- 7.2.16 : Monitoring Prometheus + Grafana

```bash
echo ""; echo "TACHE 7.2.16 : Monitoring"

METRICS="repo/packages/carrier-connectors/src/monitoring/prometheus-metrics.ts"
[ -f "$METRICS" ] && add_row "T16-F1" "Prometheus metrics" "PASS" "" || add_row "T16-F1" "Metrics" "FAIL" "Manquant"

CNT=$(grep -cE "Counter\|carrier_sync_total\|carrier_errors_total" "$METRICS" 2>/dev/null || echo 0)
[ "${CNT:-0}" -ge 3 ] && add_row "T16-V1" "Counters 3+" "PASS" "$CNT" || add_row "T16-V1" "Counters" "WARN" "$CNT"

GRAF=$(find repo/infrastructure -name "carriers-dashboard*.json" 2>/dev/null | head -1)
[ -n "$GRAF" ] && add_row "T16-V2" "Grafana dashboard" "PASS" "" || add_row "T16-V2" "Grafana" "WARN" "Manquant"

ALERTS=$(find repo/infrastructure -name "carriers-alerts*.yml" 2>/dev/null | head -1)
[ -n "$ALERTS" ] && add_row "T16-V3" "Alertes config" "PASS" "" || add_row "T16-V3" "Alertes" "WARN" "Manquant"
```

---

## TACHE 17/18 -- 7.2.17 : Documentation carrier-by-carrier

```bash
echo ""; echo "TACHE 7.2.17 : Documentation"

DOCS="repo/docs/integrations/carriers"
if [ -d "$DOCS" ]; then
  DC=$(find "$DOCS" -name "*.md" 2>/dev/null | wc -l)
  [ "${DC:-0}" -ge 8 ] && add_row "T17-V1" "8 docs carriers" "PASS" "$DC" || add_row "T17-V1" "Docs" "WARN" "$DC / 8"
else
  add_row "T17-V1" "Dossier docs" "FAIL" "Manquant"
fi

[ -f "repo/docs/architecture/carrier-integration-strategy.md" ] && add_row "T17-V2" "Doc architecture" "PASS" "" || add_row "T17-V2" "Doc arch" "WARN" "Manquante"
```

---

## TACHE 18/18 -- 7.2.18 : Tests E2E 50+ + benchmarks

```bash
echo ""; echo "TACHE 7.2.18 : Tests E2E + benchmarks"

TOT=$(cd repo && pnpm vitest run --reporter=json packages/carrier-connectors 2>/dev/null | jq '.numPassedTests // 0' 2>/dev/null || echo 0)
if [ "${TOT:-0}" -ge 50 ]; then add_row "T18-V1" "Tests E2E >= 50" "PASS" "$TOT"
elif [ "${TOT:-0}" -ge 40 ]; then add_row "T18-V1" "Tests E2E" "WARN" "$TOT / 50"
else add_row "T18-V1" "Tests E2E" "FAIL" "$TOT / 50"; fi

COV=$(cd repo && pnpm vitest run --coverage --reporter=json packages/carrier-connectors 2>/dev/null | jq '.coverageMap.total.lines.pct // 0' 2>/dev/null || echo 0)
if (( $(echo "${COV:-0} >= 85" | bc -l 2>/dev/null || echo 0) )); then add_row "T18-V2" "Coverage >= 85%" "PASS" "${COV}%"
else add_row "T18-V2" "Coverage" "WARN" "${COV}% / 85%"; fi

BENCH=$(cat repo/benchmarks/carriers-latency.json 2>/dev/null | jq -r '.p95_ms // 99999' 2>/dev/null || echo 99999)
if (( $(echo "${BENCH:-99999} < 3000" | bc -l 2>/dev/null || echo 0) )); then add_row "T18-V3" "Benchmark P95 < 3000ms" "PASS" "${BENCH}ms"
else add_row "T18-V3" "Benchmark" "WARN" "${BENCH}ms"; fi
```

---

## VERIFICATIONS TRANSVERSALES SPRINT 32 (12 transversaux)

```bash
echo ""; echo "TRANSVERSAUX SPRINT 32"
cd repo

pnpm turbo run build --filter=@insurtech/carrier-connectors 2>&1 > /tmp/build-tr.log; BC=$?
[ $BC -eq 0 ] && add_row "TR-BUILD" "Build OK" "PASS" "" || auto_repair "pnpm install --force && pnpm turbo run build --filter=@insurtech/carrier-connectors" "[ \$? -eq 0 ]" "TR-BUILD" "Build"

pnpm tsc --noEmit 2>&1 > /tmp/tsc-tr.log
TS_ERR=$(grep -c "error TS" /tmp/tsc-tr.log)
[ "$TS_ERR" -eq 0 ] && add_row "TR-TYPECHECK" "TS 0 erreur" "PASS" "" || add_row "TR-TYPECHECK" "TypeScript" "FAIL" "$TS_ERR erreurs"

TR=$(pnpm vitest run --reporter=json packages/carrier-connectors 2>/dev/null | jq '{passed: .numPassedTests, failed: .numFailedTests}' 2>/dev/null || echo '{}')
TP=$(echo "$TR" | jq -r '.passed // 0'); TF=$(echo "$TR" | jq -r '.failed // 0')
[ "${TF:-0}" -eq 0 ] && [ "${TP:-0}" -gt 0 ] && add_row "TR-TESTS" "Tests PASS" "PASS" "$TP / 0 failed" || add_row "TR-TESTS" "Tests" "FAIL" "$TP / $TF"

COV=$(pnpm vitest run --coverage --reporter=json packages/carrier-connectors 2>/dev/null | jq '.coverageMap.total.lines.pct // 0' 2>/dev/null || echo 0)
if (( $(echo "${COV:-0} >= 85" | bc -l 2>/dev/null || echo 0) )); then add_row "TR-COVERAGE" "Coverage >= 85%" "PASS" "${COV}%"
else add_row "TR-COVERAGE" "Coverage" "WARN" "${COV}%"; fi

pnpm lint 2>&1 > /tmp/lint-tr.log; LC=$?
[ $LC -eq 0 ] && add_row "TR-LINT" "Lint 0 erreur" "PASS" "" || auto_repair "pnpm lint --apply" "pnpm lint" "TR-LINT" "Lint"
cd ..

EMOJI=$(grep -rP "[\x{1F300}-\x{1F9FF}]|[\x{2600}-\x{27BF}]" repo/packages/carrier-connectors --include="*.ts" --include="*.md" 2>/dev/null | wc -l)
[ "$EMOJI" -eq 0 ] && add_row "TR-NO-EMOJI" "0 emoji" "PASS" "" || add_row "TR-NO-EMOJI" "Emoji" "FAIL" "$EMOJI"

CONS=$(grep -rn "console\.log\|console\.error" repo/packages/carrier-connectors --include="*.ts" 2>/dev/null | grep -v ".spec.ts" | wc -l)
[ "$CONS" -eq 0 ] && add_row "TR-CONSOLE" "0 console.*" "PASS" "" || add_row "TR-CONSOLE" "console" "FAIL" "$CONS"

NC=$(git log --since="2 weeks ago" --pretty=format:"%s" -- repo/packages/carrier-connectors | grep -vE "^(feat|fix|docs|test|chore|refactor|perf)(\(.+\))?:" | wc -l)
[ "$NC" -eq 0 ] && add_row "TR-COMMITS" "Conv Commits 100%" "PASS" "" || add_row "TR-COMMITS" "Commits" "WARN" "$NC non-conformes"

TN=$(grep -rE "tenantId" repo/packages/carrier-connectors/src --include="*.ts" 2>/dev/null | wc -l)
[ "${TN:-0}" -ge 5 ] && add_row "TR-TENANT" "Multi-tenant" "PASS" "$TN" || add_row "TR-TENANT" "Tenant" "WARN" "$TN"

ZD=$(grep -rE "from 'zod'\|z\.object" repo/packages/carrier-connectors/src --include="*.ts" 2>/dev/null | wc -l)
[ "${ZD:-0}" -ge 5 ] && add_row "TR-ZOD" "Zod validation" "PASS" "$ZD" || add_row "TR-ZOD" "Zod" "WARN" "$ZD"

MIG=$(find repo/apps/api/src/migrations -name "*Carrier*" 2>/dev/null | wc -l)
[ "${MIG:-0}" -ge 1 ] && add_row "TR-MIGRATIONS" "Migrations carrier" "PASS" "$MIG" || add_row "TR-MIGRATIONS" "Migrations" "WARN" "Manquantes"

PM=$(grep -rE "carrier_admin\|carriers\.manage" repo/packages/auth/src/permissions 2>/dev/null | wc -l)
[ "${PM:-0}" -ge 1 ] && add_row "TR-PERMISSIONS" "Permissions carriers" "PASS" "" || add_row "TR-PERMISSIONS" "Permissions" "WARN" "Absent"
```

---

## VERIFICATIONS SPECIFIQUES SPRINT 32 (6 specifiques)

```bash
echo ""; echo "VERIFICATIONS SPECIFIQUES"

# SP-8-CARRIERS-IMPLEMENTED
COK=0
for c in axa allianz saham sanad wafa rma atlanta mamda; do
  [ -d "repo/packages/carrier-connectors/src/carriers/$c" ] && COK=$((COK + 1))
done
if [ "$COK" -eq 8 ]; then add_row "SP-8-CARRIERS-IMPLEMENTED" "8 carriers implementes" "PASS" ""
else add_row "SP-8-CARRIERS-IMPLEMENTED" "8 carriers" "FAIL" "$COK / 8"; fi

# SP-TIER1-OAUTH2
T1=$(grep -rE "OAuth2|client_credentials" repo/packages/carrier-connectors/src/carriers/{axa,allianz,saham,sanad} 2>/dev/null | wc -l)
[ "${T1:-0}" -ge 4 ] && add_row "SP-TIER1-OAUTH2" "TIER 1 OAuth2 (4 carriers)" "PASS" "" || add_row "SP-TIER1-OAUTH2" "TIER 1" "WARN" "$T1 / 4"

# SP-CIRCUIT-BREAKER-CHAOS
CHAOS=$(find repo/packages/carrier-connectors -name "*chaos*.spec.ts" 2>/dev/null | wc -l)
[ "${CHAOS:-0}" -ge 1 ] && add_row "SP-CIRCUIT-BREAKER-CHAOS" "Chaos test" "PASS" "" || add_row "SP-CIRCUIT-BREAKER-CHAOS" "Chaos" "WARN" "Absent"

# SP-RECONCILIATION
RECON=$(find repo/packages/carrier-connectors/src -name "*reconciliation*.service.ts" 2>/dev/null | head -1)
[ -n "$RECON" ] && add_row "SP-RECONCILIATION" "Reconciliation service" "PASS" "" || add_row "SP-RECONCILIATION" "Reconciliation" "WARN" "Absent"

# SP-MOCK-MODE
MF=$(find repo/packages/carrier-connectors/src/mock/fixtures -name "*.json" 2>/dev/null | wc -l)
[ "${MF:-0}" -ge 8 ] && add_row "SP-MOCK-MODE" "Mock fixtures 8 carriers" "PASS" "$MF" || add_row "SP-MOCK-MODE" "Mock" "WARN" "$MF / 8"

# SP-AUDIT-CARRIER-SYNC
SA=$(pg_query "SELECT 1 FROM information_schema.tables WHERE table_name='carrier_sync_audits'")
[ -n "$SA" ] && add_row "SP-AUDIT-CARRIER-SYNC" "Table carrier_sync_audits" "PASS" "" || add_row "SP-AUDIT-CARRIER-SYNC" "Audit ACAPS" "FAIL" "Manquante"
```

---

## GENERATION DU RAPPORT FINAL

```bash
TOTAL=$((PASS + PASS_REPAIRED + FAIL + SKIP + WARN))
SCORE_NUM=$((PASS + PASS_REPAIRED))
SCORE_PCT=$(echo "scale=1; $SCORE_NUM * 100 / $TOTAL" | bc -l 2>/dev/null || echo "0")

JALON="NO-GO"
DOWNSTREAM="Sprint 33 (Pentest) BLOQUE + Tarification real-time 8 carriers indisponible Demo Day"

if (( $(echo "$SCORE_PCT >= 90" | bc -l 2>/dev/null || echo 0) )); then
  JALON="GO"
  DOWNSTREAM="Sprint 33 peut demarrer + tarification 8 carriers prod-ready Demo Day"
elif (( $(echo "$SCORE_PCT >= 80" | bc -l 2>/dev/null || echo 0) )); then
  JALON="GO CONDITIONNEL"
  DOWNSTREAM="Sprint 33 parallele + dette technique TIER 3 documentee"
fi

cat >> "$REPORT_FILE" << EOF

## Synthese finale

| Categorie | Nombre |
|-----------|--------|
| PASS | $PASS |
| PASS* | $PASS_REPAIRED |
| FAIL | $FAIL |
| SKIP | $SKIP |
| WARN | $WARN |
| **TOTAL** | **$TOTAL** |

**Score** : $SCORE_PCT%
**Jalon Sprint 32** : $JALON
**Impact downstream** : $DOWNSTREAM

---

## Tableau Resultats Complet

| ID | Description | Statut | Details |
|----|-------------|--------|---------|
$(echo -e "$TABLE_ROWS")

EOF

case "$JALON" in
  GO)
    cat >> "$REPORT_FILE" << EOF

## Jalon GO/NO-GO Sprint 32

**GO** ($SCORE_PCT%) -- Connectors 8 carriers operationnels.

### Actions :
1. Tag : \`git tag -a "sprint-32-complete-v3-connecteurs-8-carriers" -m "Sprint 32 v3.0 -- score $SCORE_PCT%"\`
2. Activation production progressive : TIER 1 immediate / TIER 2 hybride / TIER 3 queue manuel
3. Sprint 33 (Pentest securite) peut demarrer
4. Demo Day 30 juin 2026 : 8 carriers tarification real-time visible audience (differentiator concurrentiel Maroc)
EOF
    ;;
  "GO CONDITIONNEL")
    cat >> "$REPORT_FILE" << EOF

## Jalon GO/NO-GO Sprint 32

**GO CONDITIONNEL** ($SCORE_PCT%) -- TIER 1 utilisable, TIER 2/3 dette.

### Actions :
1. Documenter dette \`dette-technique-sprint-32.md\` (special TIER 3)
2. Re-tester avant prod TIER 2/3 activation
3. Tag conditionnel + Sprint 33 parallele
EOF
    ;;
  NO-GO)
    cat >> "$REPORT_FILE" << EOF

## Jalon GO/NO-GO Sprint 32

**NO-GO** ($SCORE_PCT%) -- Connectors non livrables.

### Actions :
1. **Escalation Saad + Abla** (differentiator concurrentiel critical)
2. Identifier FAIL P0 : SP-8-CARRIERS-IMPLEMENTED / SP-AUDIT-CARRIER-SYNC / T12-V1 (registry)
3. **NE PAS deployer prod** (Demo Day risque)
4. Re-V-32 dans 3-5 jours + Sprint 33 bloque
EOF
    ;;
esac

echo ""
echo "================================================"
echo "RAPPORT FINAL : $REPORT_FILE"
echo "Score : $SCORE_PCT% / Jalon : $JALON"
echo "Downstream : $DOWNSTREAM"
echo "================================================"
cat "$REPORT_FILE"
```

---

## Decisions strategiques applicables

- **decision-006** : NO emoji policy (TR-NO-EMOJI)
- **decision-008** : Data residency Maroc (TIER 1 carriers verifies)
- **decision-014** : PartsHub Phase 1 (Sprint 32 data flows -> Sprint 23 PartsHub)
- **decision-015** : Demo Day 30 juin 2026 -- 8 carriers tarification real-time obligatoire

---

## Prochaine etape

**Si GO** : tag + activation progressive TIER 1->2->3 + Sprint 33 demarre + Demo Day prep
**Si GO CONDITIONNEL** : dette technique + Sprint 33 parallele
**Si NO-GO** : ESCALATION Saad + Abla + Sprint 33 bloque + Demo Day risque

---

## NOTES IMPORTANTES POUR EXECUTION

1. **8 carriers integration = differentiator concurrentiel Maroc** : aucun competitor n'a >5 carriers
2. **TIER 1/2/3 strategy** : 3 niveaux integration (API moderne / hybride / email manual)
3. **Audit ACAPS sync events** : compliance loi obligatoire (carrier_sync_audits table)
4. **Mock mode + sandbox** : essentiel tests sans depenses API
5. **Circuit breaker + chaos test** : robustesse production (1 carrier down ne tue pas systeme)
6. **Reconciliation service** : critique data integrity multi-source
7. **Demo Day 30 juin 2026** : 8 carriers tarification real-time visible audience (decision-015)
8. **Auto-reparation activee** sur TR-BUILD + TR-LINT

---

## INSTRUCTION FINALE A CLAUDE CODE / COWORK

1. Lire `sprint32-verify-report.md` integralement
2. Verifier score % + criteres FAIL P0
3. Si GO : tag + activation progressive + Sprint 33
4. Si GO CONDITIONNEL : dette + Sprint 33 parallele
5. Si NO-GO : ESCALATION Saad + Abla + Sprint 33 bloque
6. Garder rapport pour audit ACAPS (retention 10 ans)

---

**Fin verification V-32 v3.0 -- Sprint 32 (7.2) Connecteurs 8 Carriers (TIER 1/2/3).**

**Total criteres** : 70 taches + 12 transversaux + 6 specifiques = 88 criteres
**Auto-reparation active** : TR-BUILD + TR-LINT + T01-V3 (3 tentatives)
**Jalon critique** : sans GO V-32, Sprint 33 bloque + Demo Day 30 juin 2026 a risque (tarification 8 carriers indisponible)
