# VERIFICATION SPRINT 13 -- Phase 3 / Sprint 6 : Analytics ClickHouse + Stock + HR
# Version : Auto-reparation active + Rapport final MD detaille
# 14 taches, 80 criteres extraits B-13
# AUCUNE EMOJI AUTORISEE

**Version** : v2.2 (verification detaillee)
**Phase** : 3 -- Modules Horizontaux
**Sprint** : 13 / 35 (cumul) -- Sprint 6 dans Phase 3
**Reference meta-prompt** : `B-13-sprint-13-analytics-stock-hr.md`
**Reference orchestrateur** : `C-13-sprint-13-analytics-stock-hr.md`
**Total criteres** : 80 criteres taches + ~10 transversaux

---

Tu es **Claude Code (ou Cowork)**. Tu dois executer une **verification COMPLETE et EXHAUSTIVE** du Sprint 13 apres execution toutes les 14 taches.

---

## REGLES D'EXECUTION

1. Tu **executes CHAQUE verification dans l'ordre** (taches puis transversales)
2. Quand une verification echoue, tu **TENTES UNE REPARATION AUTOMATIQUE** avant de noter FAIL
3. Apres chaque tentative de reparation, tu **re-executes la verification**
4. Tu consignes dans `sprint13-verify-report.md` **TOUS les resultats** au fil de l'execution
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
REPORT_FILE="sprint13-verify-report.md"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
RUN_ID=$(date '+%Y%m%d-%H%M%S')

cat > "$REPORT_FILE" << EOF
# Rapport de Verification - Sprint 13 : Analytics ClickHouse + Stock + HR

**Date** : $TIMESTAMP
**Run ID** : $RUN_ID
**Phase** : 3 -- Modules Horizontaux
**Sprint** : 13 (Phase 3 / Sprint 6)
**Reference B-13** : 14 taches, 80 criteres extraits
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

## TACHE 1/6 -- 3.6.1 : ClickHouse Setup + Schemas Analytics

```bash
echo ""
echo "================================================"
echo "TACHE 3.6.1 : ClickHouse Setup + Schemas Analytics"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 6"
echo "================================================"

# === Verification fichiers crees ===
# Test T01-F1: Existence fichier repo/docker-compose.yml
if [ -f "repo/docker-compose.yml" ]; then
  add_row "T01-F1" "Fichier docker-compose.yml existe" "PASS" "Cree"
else
  add_row "T01-F1" "Fichier docker-compose.yml existe" "FAIL" "Manquant"
fi
# Test T01-F2: Existence fichier repo/infrastructure/clickhouse/schemas/{8 sql files}
if [ -f "repo/infrastructure/clickhouse/schemas/{8 sql files}" ]; then
  add_row "T01-F2" "Fichier {8 sql files} existe" "PASS" "Cree"
else
  add_row "T01-F2" "Fichier {8 sql files} existe" "FAIL" "Manquant"
fi
# Test T01-F3: Existence fichier repo/packages/analytics/src/services/clickhouse.service.ts
if [ -f "repo/packages/analytics/src/services/clickhouse.service.ts" ]; then
  add_row "T01-F3" "Fichier clickhouse.service.ts existe" "PASS" "Cree"
else
  add_row "T01-F3" "Fichier clickhouse.service.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T01-V1: ClickHouse demarre via docker-compose (P0)
echo "  Verifying T01-V1 : ClickHouse demarre via docker-compose..."
add_row "T01-V1" "ClickHouse demarre via docker-compose" "WARN" "(P0) Voir B-13 Tache 3.6.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V2: Tables analytics crees (P0)
echo "  Verifying T01-V2 : Tables analytics crees..."
add_row "T01-V2" "Tables analytics crees" "WARN" "(P0) Voir B-13 Tache 3.6.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V3: dim_dates rempli (5 ans) (P0)
echo "  Verifying T01-V3 : dim_dates rempli (5 ans)..."
add_row "T01-V3" "dim_dates rempli (5 ans)" "WARN" "(P0) Voir B-13 Tache 3.6.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V4: ClickHouseService ping OK (P0)
echo "  Verifying T01-V4 : ClickHouseService ping OK..."
add_row "T01-V4" "ClickHouseService ping OK" "WARN" "(P0) Voir B-13 Tache 3.6.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V5: TTL configure (P0)
echo "  Verifying T01-V5 : TTL configure..."
add_row "T01-V5" "TTL configure" "WARN" "(P0) Voir B-13 Tache 3.6.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V6: Tests connexion 5+ scenarios (P0)
echo "  Verifying T01-V6 : Tests connexion 5+ scenarios..."
add_row "T01-V6" "Tests connexion 5+ scenarios" "WARN" "(P0) Voir B-13 Tache 3.6.1 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 2/7 -- 3.6.2 : ETL Pipeline Postgres -> ClickHouse (Polling MVP)

```bash
echo ""
echo "================================================"
echo "TACHE 3.6.2 : ETL Pipeline Postgres -> ClickHouse (Polling MVP)"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 7"
echo "================================================"

# === Verification fichiers crees ===
# Test T02-F1: Existence fichier repo/packages/analytics/src/etl/postgres-to-clickhouse.etl.ts
if [ -f "repo/packages/analytics/src/etl/postgres-to-clickhouse.etl.ts" ]; then
  add_row "T02-F1" "Fichier postgres-to-clickhouse.etl.ts existe" "PASS" "Cree"
else
  add_row "T02-F1" "Fichier postgres-to-clickhouse.etl.ts existe" "FAIL" "Manquant"
fi
# Test T02-F2: Existence fichier repo/packages/analytics/src/etl/etl-state.service.ts
if [ -f "repo/packages/analytics/src/etl/etl-state.service.ts" ]; then
  add_row "T02-F2" "Fichier etl-state.service.ts existe" "PASS" "Cree"
else
  add_row "T02-F2" "Fichier etl-state.service.ts existe" "FAIL" "Manquant"
fi
# Test T02-F3: Existence fichier repo/packages/analytics/src/jobs/etl-cron.job.ts
if [ -f "repo/packages/analytics/src/jobs/etl-cron.job.ts" ]; then
  add_row "T02-F3" "Fichier etl-cron.job.ts existe" "PASS" "Cree"
else
  add_row "T02-F3" "Fichier etl-cron.job.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T02-V1: Sync delta fonctionne (P0)
echo "  Verifying T02-V1 : Sync delta fonctionne..."
add_row "T02-V1" "Sync delta fonctionne" "WARN" "(P0) Voir B-13 Tache 3.6.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V2: Idempotency : 2 syncs same data -> 1 row CH (P0)
echo "  Verifying T02-V2 : Idempotency : 2 syncs same data -> 1 row CH..."
add_row "T02-V2" "Idempotency : 2 syncs same data -> 1 row CH" "WARN" "(P0) Voir B-13 Tache 3.6.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V3: State tracking : last_sync_timestamp persiste (P0)
echo "  Verifying T02-V3 : State tracking : last_sync_timestamp persiste..."
add_row "T02-V3" "State tracking : last_sync_timestamp persiste" "WARN" "(P0) Voir B-13 Tache 3.6.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V4: Cron 5min execute (P0)
echo "  Verifying T02-V4 : Cron 5min execute..."
add_row "T02-V4" "Cron 5min execute" "WARN" "(P0) Voir B-13 Tache 3.6.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V5: Batch 1000 perf OK (P0)
echo "  Verifying T02-V5 : Batch 1000 perf OK..."
add_row "T02-V5" "Batch 1000 perf OK" "WARN" "(P0) Voir B-13 Tache 3.6.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V6: Resync full force (P0)
echo "  Verifying T02-V6 : Resync full force..."
add_row "T02-V6" "Resync full force" "WARN" "(P0) Voir B-13 Tache 3.6.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V7: Tests 8+ scenarios (P0)
echo "  Verifying T02-V7 : Tests 8+ scenarios..."
add_row "T02-V7" "Tests 8+ scenarios" "WARN" "(P0) Voir B-13 Tache 3.6.2 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 3/6 -- 3.6.3 : AnalyticsService + Queries Dashboards

```bash
echo ""
echo "================================================"
echo "TACHE 3.6.3 : AnalyticsService + Queries Dashboards"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 6"
echo "================================================"

# === Verification fichiers crees ===
# Test T03-F1: Existence fichier repo/packages/analytics/src/services/analytics.service.ts
if [ -f "repo/packages/analytics/src/services/analytics.service.ts" ]; then
  add_row "T03-F1" "Fichier analytics.service.ts existe" "PASS" "Cree"
else
  add_row "T03-F1" "Fichier analytics.service.ts existe" "FAIL" "Manquant"
fi
# Test T03-F2: Existence fichier repo/packages/analytics/src/services/analytics.service.spec.ts
if [ -f "repo/packages/analytics/src/services/analytics.service.spec.ts" ]; then
  add_row "T03-F2" "Fichier analytics.service.spec.ts existe" "PASS" "Cree"
else
  add_row "T03-F2" "Fichier analytics.service.spec.ts existe" "FAIL" "Manquant"
fi
# Test T03-F3: Existence fichier repo/packages/analytics/src/types/dashboards.ts
if [ -f "repo/packages/analytics/src/types/dashboards.ts" ]; then
  add_row "T03-F3" "Fichier dashboards.ts existe" "PASS" "Cree"
else
  add_row "T03-F3" "Fichier dashboards.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T03-V1: getRevenue retourne points avec aggregates corrects (P0)
echo "  Verifying T03-V1 : getRevenue retourne points avec aggregates corrects..."
add_row "T03-V1" "getRevenue retourne points avec aggregates corrects" "WARN" "(P0) Voir B-13 Tache 3.6.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V2: groupBy day/week/month fonctionne (P0)
echo "  Verifying T03-V2 : groupBy day/week/month fonctionne..."
add_row "T03-V2" "groupBy day/week/month fonctionne" "WARN" "(P0) Voir B-13 Tache 3.6.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V3: Multi-tenant isolation (tenant_id filter) (P0)
echo "  Verifying T03-V3 : Multi-tenant isolation (tenant_id filter)..."
add_row "T03-V3" "Multi-tenant isolation (tenant_id filter)" "WARN" "(P0) Voir B-13 Tache 3.6.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V4: Cache hit 2eme call (P0)
echo "  Verifying T03-V4 : Cache hit 2eme call..."
add_row "T03-V4" "Cache hit 2eme call" "WARN" "(P0) Voir B-13 Tache 3.6.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V5: Performance < 1s sur fixtures realistes (P0)
echo "  Verifying T03-V5 : Performance < 1s sur fixtures realistes..."
add_row "T03-V5" "Performance < 1s sur fixtures realistes" "WARN" "(P0) Voir B-13 Tache 3.6.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V6: Tests 10+ scenarios (P0)
echo "  Verifying T03-V6 : Tests 10+ scenarios..."
add_row "T03-V6" "Tests 10+ scenarios" "WARN" "(P0) Voir B-13 Tache 3.6.3 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 4/5 -- 3.6.4 : 6 Dashboards Endpoints

```bash
echo ""
echo "================================================"
echo "TACHE 3.6.4 : 6 Dashboards Endpoints"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T04-F1: Existence fichier repo/apps/api/src/modules/analytics/controllers/dashboards.controller.ts
if [ -f "repo/apps/api/src/modules/analytics/controllers/dashboards.controller.ts" ]; then
  add_row "T04-F1" "Fichier dashboards.controller.ts existe" "PASS" "Cree"
else
  add_row "T04-F1" "Fichier dashboards.controller.ts existe" "FAIL" "Manquant"
fi
# Test T04-F2: Existence fichier repo/apps/api/src/modules/analytics/services/{several}.service.ts
if [ -f "repo/apps/api/src/modules/analytics/services/{several}.service.ts" ]; then
  add_row "T04-F2" "Fichier {several}.service.ts existe" "PASS" "Cree"
else
  add_row "T04-F2" "Fichier {several}.service.ts existe" "FAIL" "Manquant"
fi
# Test T04-F3: Existence fichier repo/apps/api/test/analytics/dashboards.e2e-spec.ts
if [ -f "repo/apps/api/test/analytics/dashboards.e2e-spec.ts" ]; then
  add_row "T04-F3" "Fichier dashboards.e2e-spec.ts existe" "PASS" "Cree"
else
  add_row "T04-F3" "Fichier dashboards.e2e-spec.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T04-V1: 6 endpoints fonctionnent (P0)
echo "  Verifying T04-V1 : 6 endpoints fonctionnent..."
add_row "T04-V1" "6 endpoints fonctionnent" "WARN" "(P0) Voir B-13 Tache 3.6.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V2: Format response coherent (P0)
echo "  Verifying T04-V2 : Format response coherent..."
add_row "T04-V2" "Format response coherent" "WARN" "(P0) Voir B-13 Tache 3.6.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V3: RBAC + multi-tenant (P0)
echo "  Verifying T04-V3 : RBAC + multi-tenant..."
add_row "T04-V3" "RBAC + multi-tenant" "WARN" "(P0) Voir B-13 Tache 3.6.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V4: Filters date_range + group_by (P0)
echo "  Verifying T04-V4 : Filters date_range + group_by..."
add_row "T04-V4" "Filters date_range + group_by" "WARN" "(P0) Voir B-13 Tache 3.6.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V5: Tests E2E 12+ scenarios (P0)
echo "  Verifying T04-V5 : Tests E2E 12+ scenarios..."
add_row "T04-V5" "Tests E2E 12+ scenarios" "WARN" "(P0) Voir B-13 Tache 3.6.4 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 5/6 -- 3.6.5 : Stock Items Entity + Categories + Valorisation FIFO

```bash
echo ""
echo "================================================"
echo "TACHE 3.6.5 : Stock Items Entity + Categories + Valorisation FIFO"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 6"
echo "================================================"

# === Verification fichiers crees ===
# Test T05-F1: Existence fichier repo/packages/database/src/migrations/{date}-StockTables.ts
if [ -f "repo/packages/database/src/migrations/{date}-StockTables.ts" ]; then
  add_row "T05-F1" "Fichier {date}-StockTables.ts existe" "PASS" "Cree"
else
  add_row "T05-F1" "Fichier {date}-StockTables.ts existe" "FAIL" "Manquant"
fi
# Test T05-F2: Existence fichier repo/packages/stock/src/entities/{3 entities}.ts
if [ -f "repo/packages/stock/src/entities/{3 entities}.ts" ]; then
  add_row "T05-F2" "Fichier {3 entities}.ts existe" "PASS" "Cree"
else
  add_row "T05-F2" "Fichier {3 entities}.ts existe" "FAIL" "Manquant"
fi
# Test T05-F3: Existence fichier repo/packages/stock/src/services/stock-items.service.ts
if [ -f "repo/packages/stock/src/services/stock-items.service.ts" ]; then
  add_row "T05-F3" "Fichier stock-items.service.ts existe" "PASS" "Cree"
else
  add_row "T05-F3" "Fichier stock-items.service.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T05-V1: CRUD items (P0)
echo "  Verifying T05-V1 : CRUD items..."
add_row "T05-V1" "CRUD items" "WARN" "(P0) Voir B-13 Tache 3.6.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V2: SKU UNIQUE per tenant (P0)
echo "  Verifying T05-V2 : SKU UNIQUE per tenant..."
add_row "T05-V2" "SKU UNIQUE per tenant" "WARN" "(P0) Voir B-13 Tache 3.6.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V3: getCurrentStock retourne quantity + valorisation FIFO correct (P0)
echo "  Verifying T05-V3 : getCurrentStock retourne quantity + valorisation FIFO correct..."
add_row "T05-V3" "getCurrentStock retourne quantity + valorisation FIFO correct" "WARN" "(P0) Voir B-13 Tache 3.6.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V4: Categories hierarchy (P0)
echo "  Verifying T05-V4 : Categories hierarchy..."
add_row "T05-V4" "Categories hierarchy" "WARN" "(P0) Voir B-13 Tache 3.6.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V5: Photos upload S3 (P0)
echo "  Verifying T05-V5 : Photos upload S3..."
add_row "T05-V5" "Photos upload S3" "WARN" "(P0) Voir B-13 Tache 3.6.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V6: Tests 8+ scenarios (P0)
echo "  Verifying T05-V6 : Tests 8+ scenarios..."
add_row "T05-V6" "Tests 8+ scenarios" "WARN" "(P0) Voir B-13 Tache 3.6.5 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 6/7 -- 3.6.6 : Stock Mouvements + Impacts FIFO

```bash
echo ""
echo "================================================"
echo "TACHE 3.6.6 : Stock Mouvements + Impacts FIFO"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 7"
echo "================================================"

# === Verification fichiers crees ===
# Test T06-F1: Existence fichier repo/packages/database/src/migrations/{date}-StockMovements.ts
if [ -f "repo/packages/database/src/migrations/{date}-StockMovements.ts" ]; then
  add_row "T06-F1" "Fichier {date}-StockMovements.ts existe" "PASS" "Cree"
else
  add_row "T06-F1" "Fichier {date}-StockMovements.ts existe" "FAIL" "Manquant"
fi
# Test T06-F2: Existence fichier repo/packages/stock/src/entities/stock-movement.entity.ts
if [ -f "repo/packages/stock/src/entities/stock-movement.entity.ts" ]; then
  add_row "T06-F2" "Fichier stock-movement.entity.ts existe" "PASS" "Cree"
else
  add_row "T06-F2" "Fichier stock-movement.entity.ts existe" "FAIL" "Manquant"
fi
# Test T06-F3: Existence fichier repo/packages/stock/src/services/stock-movements.service.ts
if [ -f "repo/packages/stock/src/services/stock-movements.service.ts" ]; then
  add_row "T06-F3" "Fichier stock-movements.service.ts existe" "PASS" "Cree"
else
  add_row "T06-F3" "Fichier stock-movements.service.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T06-V1: recordEntry cree lot + movement (P0)
echo "  Verifying T06-V1 : recordEntry cree lot + movement..."
add_row "T06-V1" "recordEntry cree lot + movement" "WARN" "(P0) Voir B-13 Tache 3.6.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V2: recordExit FIFO consume oldest lots (P0)
echo "  Verifying T06-V2 : recordExit FIFO consume oldest lots..."
add_row "T06-V2" "recordExit FIFO consume oldest lots" "WARN" "(P0) Voir B-13 Tache 3.6.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V3: Insufficient stock reject 400 (P0)
echo "  Verifying T06-V3 : Insufficient stock reject 400..."
add_row "T06-V3" "Insufficient stock reject 400" "WARN" "(P0) Voir B-13 Tache 3.6.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V4: Total cost calcul correct (P0)
echo "  Verifying T06-V4 : Total cost calcul correct..."
add_row "T06-V4" "Total cost calcul correct" "WARN" "(P0) Voir B-13 Tache 3.6.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V5: recordAdjustment update sans creer mouvement standard (P0)
echo "  Verifying T06-V5 : recordAdjustment update sans creer mouvement standard..."
add_row "T06-V5" "recordAdjustment update sans creer mouvement standard" "WARN" "(P0) Voir B-13 Tache 3.6.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V6: Audit + Kafka events (P0)
echo "  Verifying T06-V6 : Audit + Kafka events..."
add_row "T06-V6" "Audit + Kafka events" "WARN" "(P0) Voir B-13 Tache 3.6.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V7: Tests 12+ scenarios (P0)
echo "  Verifying T06-V7 : Tests 12+ scenarios..."
add_row "T06-V7" "Tests 12+ scenarios" "WARN" "(P0) Voir B-13 Tache 3.6.6 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 7/4 -- 3.6.7 : Stock Alertes Seuil + Notifications

```bash
echo ""
echo "================================================"
echo "TACHE 3.6.7 : Stock Alertes Seuil + Notifications"
echo "Priorite : P1 | Effort : 4h"
echo "Criteres a verifier : 4"
echo "================================================"

# === Verification fichiers crees ===
# Test T07-F1: Existence fichier repo/packages/stock/src/services/stock-alerts.service.ts
if [ -f "repo/packages/stock/src/services/stock-alerts.service.ts" ]; then
  add_row "T07-F1" "Fichier stock-alerts.service.ts existe" "PASS" "Cree"
else
  add_row "T07-F1" "Fichier stock-alerts.service.ts existe" "FAIL" "Manquant"
fi
# Test T07-F2: Existence fichier repo/packages/stock/src/jobs/low-stock-cron.job.ts
if [ -f "repo/packages/stock/src/jobs/low-stock-cron.job.ts" ]; then
  add_row "T07-F2" "Fichier low-stock-cron.job.ts existe" "PASS" "Cree"
else
  add_row "T07-F2" "Fichier low-stock-cron.job.ts existe" "FAIL" "Manquant"
fi
# Test T07-F3: Existence fichier repo/packages/comm/src/templates/{fr,ar-MA,ar}/low-stock-alert.hbs
if [ -f "repo/packages/comm/src/templates/{fr,ar-MA,ar}/low-stock-alert.hbs" ]; then
  add_row "T07-F3" "Fichier low-stock-alert.hbs existe" "PASS" "Cree"
else
  add_row "T07-F3" "Fichier low-stock-alert.hbs existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T07-V1: findLowStockItems retourne items < threshold (P1)
echo "  Verifying T07-V1 : findLowStockItems retourne items < threshold..."
add_row "T07-V1" "findLowStockItems retourne items < threshold" "WARN" "(P1) Voir B-13 Tache 3.6.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V2: Cron daily envoie email (P1)
echo "  Verifying T07-V2 : Cron daily envoie email..."
add_row "T07-V2" "Cron daily envoie email" "WARN" "(P1) Voir B-13 Tache 3.6.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V3: Trigger after exit emit event (P1)
echo "  Verifying T07-V3 : Trigger after exit emit event..."
add_row "T07-V3" "Trigger after exit emit event" "WARN" "(P1) Voir B-13 Tache 3.6.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V4: Tests 5+ scenarios (P1)
echo "  Verifying T07-V4 : Tests 5+ scenarios..."
add_row "T07-V4" "Tests 5+ scenarios" "WARN" "(P1) Voir B-13 Tache 3.6.7 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 8/4 -- 3.6.8 : Stock Endpoints REST `/api/v1/stock/*`

```bash
echo ""
echo "================================================"
echo "TACHE 3.6.8 : Stock Endpoints REST `/api/v1/stock/*`"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 4"
echo "================================================"

# === Verification fichiers crees ===
# Test T08-F1: Existence fichier repo/apps/api/src/modules/stock/controllers/{several}.ts
if [ -f "repo/apps/api/src/modules/stock/controllers/{several}.ts" ]; then
  add_row "T08-F1" "Fichier {several}.ts existe" "PASS" "Cree"
else
  add_row "T08-F1" "Fichier {several}.ts existe" "FAIL" "Manquant"
fi
# Test T08-F2: Existence fichier repo/packages/stock/src/consumers/repair-parts-consumed.consumer.ts
if [ -f "repo/packages/stock/src/consumers/repair-parts-consumed.consumer.ts" ]; then
  add_row "T08-F2" "Fichier repair-parts-consumed.consumer.ts existe" "PASS" "Cree"
else
  add_row "T08-F2" "Fichier repair-parts-consumed.consumer.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T08-V1: Endpoints CRUD operationnels (P0)
echo "  Verifying T08-V1 : Endpoints CRUD operationnels..."
add_row "T08-V1" "Endpoints CRUD operationnels" "WARN" "(P0) Voir B-13 Tache 3.6.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V2: Inventaire report OK (P0)
echo "  Verifying T08-V2 : Inventaire report OK..."
add_row "T08-V2" "Inventaire report OK" "WARN" "(P0) Voir B-13 Tache 3.6.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V3: Cross-module Kafka events fonctionnent (P0)
echo "  Verifying T08-V3 : Cross-module Kafka events fonctionnent..."
add_row "T08-V3" "Cross-module Kafka events fonctionnent" "WARN" "(P0) Voir B-13 Tache 3.6.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V4: Tests E2E 6+ scenarios (P0)
echo "  Verifying T08-V4 : Tests E2E 6+ scenarios..."
add_row "T08-V4" "Tests E2E 6+ scenarios" "WARN" "(P0) Voir B-13 Tache 3.6.8 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 9/6 -- 3.6.9 : HR Employees + Contrats

```bash
echo ""
echo "================================================"
echo "TACHE 3.6.9 : HR Employees + Contrats"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 6"
echo "================================================"

# === Verification fichiers crees ===
# Test T09-F1: Existence fichier repo/packages/database/src/migrations/{date}-HrEmployeesContracts.ts
if [ -f "repo/packages/database/src/migrations/{date}-HrEmployeesContracts.ts" ]; then
  add_row "T09-F1" "Fichier {date}-HrEmployeesContracts.ts existe" "PASS" "Cree"
else
  add_row "T09-F1" "Fichier {date}-HrEmployeesContracts.ts existe" "FAIL" "Manquant"
fi
# Test T09-F2: Existence fichier repo/packages/hr/src/entities/{2 entities}.ts
if [ -f "repo/packages/hr/src/entities/{2 entities}.ts" ]; then
  add_row "T09-F2" "Fichier {2 entities}.ts existe" "PASS" "Cree"
else
  add_row "T09-F2" "Fichier {2 entities}.ts existe" "FAIL" "Manquant"
fi
# Test T09-F3: Existence fichier repo/packages/hr/src/services/employees.service.ts
if [ -f "repo/packages/hr/src/services/employees.service.ts" ]; then
  add_row "T09-F3" "Fichier employees.service.ts existe" "PASS" "Cree"
else
  add_row "T09-F3" "Fichier employees.service.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T09-V1: CRUD employees (P0)
echo "  Verifying T09-V1 : CRUD employees..."
add_row "T09-V1" "CRUD employees" "WARN" "(P0) Voir B-13 Tache 3.6.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V2: Contrats lies a employees (P0)
echo "  Verifying T09-V2 : Contrats lies a employees..."
add_row "T09-V2" "Contrats lies a employees" "WARN" "(P0) Voir B-13 Tache 3.6.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V3: CIN + CNSS format MA validate (P0)
echo "  Verifying T09-V3 : CIN + CNSS format MA validate..."
add_row "T09-V3" "CIN + CNSS format MA validate" "WARN" "(P0) Voir B-13 Tache 3.6.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V4: Termination workflow (P0)
echo "  Verifying T09-V4 : Termination workflow..."
add_row "T09-V4" "Termination workflow" "WARN" "(P0) Voir B-13 Tache 3.6.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V5: Multi-tenant + RBAC (P0)
echo "  Verifying T09-V5 : Multi-tenant + RBAC..."
add_row "T09-V5" "Multi-tenant + RBAC" "WARN" "(P0) Voir B-13 Tache 3.6.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V6: Tests 8+ scenarios (P0)
echo "  Verifying T09-V6 : Tests 8+ scenarios..."
add_row "T09-V6" "Tests 8+ scenarios" "WARN" "(P0) Voir B-13 Tache 3.6.9 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 10/7 -- 3.6.10 : HR Conges + Workflow Approval

```bash
echo ""
echo "================================================"
echo "TACHE 3.6.10 : HR Conges + Workflow Approval"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 7"
echo "================================================"

# === Verification fichiers crees ===
# Test T10-F1: Existence fichier repo/packages/database/src/migrations/{date}-HrLeaves.ts
if [ -f "repo/packages/database/src/migrations/{date}-HrLeaves.ts" ]; then
  add_row "T10-F1" "Fichier {date}-HrLeaves.ts existe" "PASS" "Cree"
else
  add_row "T10-F1" "Fichier {date}-HrLeaves.ts existe" "FAIL" "Manquant"
fi
# Test T10-F2: Existence fichier repo/packages/hr/src/entities/{2 entities}.ts
if [ -f "repo/packages/hr/src/entities/{2 entities}.ts" ]; then
  add_row "T10-F2" "Fichier {2 entities}.ts existe" "PASS" "Cree"
else
  add_row "T10-F2" "Fichier {2 entities}.ts existe" "FAIL" "Manquant"
fi
# Test T10-F3: Existence fichier repo/packages/hr/src/services/leaves.service.ts
if [ -f "repo/packages/hr/src/services/leaves.service.ts" ]; then
  add_row "T10-F3" "Fichier leaves.service.ts existe" "PASS" "Cree"
else
  add_row "T10-F3" "Fichier leaves.service.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T10-V1: Demande conges + balance check (P0)
echo "  Verifying T10-V1 : Demande conges + balance check..."
add_row "T10-V1" "Demande conges + balance check" "WARN" "(P0) Voir B-13 Tache 3.6.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V2: Approval transition + decrement balance (P0)
echo "  Verifying T10-V2 : Approval transition + decrement balance..."
add_row "T10-V2" "Approval transition + decrement balance" "WARN" "(P0) Voir B-13 Tache 3.6.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V3: Reject avec reason (P0)
echo "  Verifying T10-V3 : Reject avec reason..."
add_row "T10-V3" "Reject avec reason" "WARN" "(P0) Voir B-13 Tache 3.6.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V4: Cancel avant approved (P0)
echo "  Verifying T10-V4 : Cancel avant approved..."
add_row "T10-V4" "Cancel avant approved" "WARN" "(P0) Voir B-13 Tache 3.6.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V5: Notifications email envoyees (P0)
echo "  Verifying T10-V5 : Notifications email envoyees..."
add_row "T10-V5" "Notifications email envoyees" "WARN" "(P0) Voir B-13 Tache 3.6.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V6: Conges payes 18j/an MA (P0)
echo "  Verifying T10-V6 : Conges payes 18j/an MA..."
add_row "T10-V6" "Conges payes 18j/an MA" "WARN" "(P0) Voir B-13 Tache 3.6.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V7: Tests 10+ scenarios (P0)
echo "  Verifying T10-V7 : Tests 10+ scenarios..."
add_row "T10-V7" "Tests 10+ scenarios" "WARN" "(P0) Voir B-13 Tache 3.6.10 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 11/9 -- 3.6.11 : HR Paie Basique : Bulletin + CNSS + AMO + IR

```bash
echo ""
echo "================================================"
echo "TACHE 3.6.11 : HR Paie Basique : Bulletin + CNSS + AMO + IR"
echo "Priorite : P0 | Effort : 7h"
echo "Criteres a verifier : 9"
echo "================================================"

# === Verification fichiers crees ===
# Test T11-F1: Existence fichier repo/packages/database/src/migrations/{date}-HrPayslips.ts
if [ -f "repo/packages/database/src/migrations/{date}-HrPayslips.ts" ]; then
  add_row "T11-F1" "Fichier {date}-HrPayslips.ts existe" "PASS" "Cree"
else
  add_row "T11-F1" "Fichier {date}-HrPayslips.ts existe" "FAIL" "Manquant"
fi
# Test T11-F2: Existence fichier repo/packages/hr/src/entities/hr-payslip.entity.ts
if [ -f "repo/packages/hr/src/entities/hr-payslip.entity.ts" ]; then
  add_row "T11-F2" "Fichier hr-payslip.entity.ts existe" "PASS" "Cree"
else
  add_row "T11-F2" "Fichier hr-payslip.entity.ts existe" "FAIL" "Manquant"
fi
# Test T11-F3: Existence fichier repo/packages/hr/src/services/payroll.service.ts
if [ -f "repo/packages/hr/src/services/payroll.service.ts" ]; then
  add_row "T11-F3" "Fichier payroll.service.ts existe" "PASS" "Cree"
else
  add_row "T11-F3" "Fichier payroll.service.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T11-V1: computeCnss correct (cap 6000 MAD) (P0)
echo "  Verifying T11-V1 : computeCnss correct (cap 6000 MAD)..."
add_row "T11-V1" "computeCnss correct (cap 6000 MAD)" "WARN" "(P0) Voir B-13 Tache 3.6.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V2: computeAmo correct (no cap) (P0)
echo "  Verifying T11-V2 : computeAmo correct (no cap)..."
add_row "T11-V2" "computeAmo correct (no cap)" "WARN" "(P0) Voir B-13 Tache 3.6.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V3: computeIr correct sur 6 brackets (P0)
echo "  Verifying T11-V3 : computeIr correct sur 6 brackets..."
add_row "T11-V3" "computeIr correct sur 6 brackets" "WARN" "(P0) Voir B-13 Tache 3.6.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V4: Charges famille deduction (P0)
echo "  Verifying T11-V4 : Charges famille deduction..."
add_row "T11-V4" "Charges famille deduction" "WARN" "(P0) Voir B-13 Tache 3.6.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V5: generatePayslip retourne struct complete (P0)
echo "  Verifying T11-V5 : generatePayslip retourne struct complete..."
add_row "T11-V5" "generatePayslip retourne struct complete" "WARN" "(P0) Voir B-13 Tache 3.6.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V6: Cron 25 du mois (P0)
echo "  Verifying T11-V6 : Cron 25 du mois..."
add_row "T11-V6" "Cron 25 du mois" "WARN" "(P0) Voir B-13 Tache 3.6.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V7: Bulletin PDF lisible (P0)
echo "  Verifying T11-V7 : Bulletin PDF lisible..."
add_row "T11-V7" "Bulletin PDF lisible" "WARN" "(P0) Voir B-13 Tache 3.6.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V8: Validate -> journal entries (P0)
echo "  Verifying T11-V8 : Validate -> journal entries..."
add_row "T11-V8" "Validate -> journal entries" "WARN" "(P0) Voir B-13 Tache 3.6.11 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 12/4 -- 3.6.12 : HR Endpoints + Integration Books

```bash
echo ""
echo "================================================"
echo "TACHE 3.6.12 : HR Endpoints + Integration Books"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 4"
echo "================================================"

# === Verification fichiers crees ===
# Test T12-F1: Existence fichier repo/apps/api/src/modules/hr/controllers/{several}.ts
if [ -f "repo/apps/api/src/modules/hr/controllers/{several}.ts" ]; then
  add_row "T12-F1" "Fichier {several}.ts existe" "PASS" "Cree"
else
  add_row "T12-F1" "Fichier {several}.ts existe" "FAIL" "Manquant"
fi
# Test T12-F2: Existence fichier repo/packages/books/src/consumers/hr-payslip-to-journal.consumer.ts
if [ -f "repo/packages/books/src/consumers/hr-payslip-to-journal.consumer.ts" ]; then
  add_row "T12-F2" "Fichier hr-payslip-to-journal.consumer.ts existe" "PASS" "Cree"
else
  add_row "T12-F2" "Fichier hr-payslip-to-journal.consumer.ts existe" "FAIL" "Manquant"
fi
# Test T12-F3: Existence fichier repo/packages/hr/src/services/declarations.service.ts
if [ -f "repo/packages/hr/src/services/declarations.service.ts" ]; then
  add_row "T12-F3" "Fichier declarations.service.ts existe" "PASS" "Cree"
else
  add_row "T12-F3" "Fichier declarations.service.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T12-V1: Payslip validated -> ecriture cree (P0)
echo "  Verifying T12-V1 : Payslip validated -> ecriture cree..."
add_row "T12-V1" "Payslip validated -> ecriture cree" "WARN" "(P0) Voir B-13 Tache 3.6.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V2: Declaration CNSS retourne agregats (P0)
echo "  Verifying T12-V2 : Declaration CNSS retourne agregats..."
add_row "T12-V2" "Declaration CNSS retourne agregats" "WARN" "(P0) Voir B-13 Tache 3.6.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V3: Declaration IR annual (P0)
echo "  Verifying T12-V3 : Declaration IR annual..."
add_row "T12-V3" "Declaration IR annual" "WARN" "(P0) Voir B-13 Tache 3.6.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V4: Tests 6+ scenarios (P0)
echo "  Verifying T12-V4 : Tests 6+ scenarios..."
add_row "T12-V4" "Tests 6+ scenarios" "WARN" "(P0) Voir B-13 Tache 3.6.12 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 13/4 -- 3.6.13 : Cross-Module Stock+HR (Preparation Sprint 23)

```bash
echo ""
echo "================================================"
echo "TACHE 3.6.13 : Cross-Module Stock+HR (Preparation Sprint 23)"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 4"
echo "================================================"

# === Verification fichiers crees ===
# Test T13-F1: Existence fichier repo/docs/integration/stock-hr-garage-flows.md
if [ -f "repo/docs/integration/stock-hr-garage-flows.md" ]; then
  add_row "T13-F1" "Fichier stock-hr-garage-flows.md existe" "PASS" "Cree"
else
  add_row "T13-F1" "Fichier stock-hr-garage-flows.md existe" "FAIL" "Manquant"
fi
# Test T13-F2: Existence fichier repo/apps/api/test/integration/garage-end-to-end.e2e-spec.ts
if [ -f "repo/apps/api/test/integration/garage-end-to-end.e2e-spec.ts" ]; then
  add_row "T13-F2" "Fichier garage-end-to-end.e2e-spec.ts existe" "PASS" "Cree"
else
  add_row "T13-F2" "Fichier garage-end-to-end.e2e-spec.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T13-V1: Documentation flows complete (P0)
echo "  Verifying T13-V1 : Documentation flows complete..."
add_row "T13-V1" "Documentation flows complete" "WARN" "(P0) Voir B-13 Tache 3.6.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V2: Test E2E garage flow passe (P0)
echo "  Verifying T13-V2 : Test E2E garage flow passe..."
add_row "T13-V2" "Test E2E garage flow passe" "WARN" "(P0) Voir B-13 Tache 3.6.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V3: Performance dashboards OK volumes realistes (P0)
echo "  Verifying T13-V3 : Performance dashboards OK volumes realistes..."
add_row "T13-V3" "Performance dashboards OK volumes realistes" "WARN" "(P0) Voir B-13 Tache 3.6.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V4: Endpoints Sprint 23 prerequis valides (P0)
echo "  Verifying T13-V4 : Endpoints Sprint 23 prerequis valides..."
add_row "T13-V4" "Endpoints Sprint 23 prerequis valides" "WARN" "(P0) Voir B-13 Tache 3.6.13 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 14/5 -- 3.6.14 : Tests E2E (35+) + Phase 3 Closure

```bash
echo ""
echo "================================================"
echo "TACHE 3.6.14 : Tests E2E (35+) + Phase 3 Closure"
echo "Priorite : P0 | Effort : 8h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T14-F1: Existence fichier repo/apps/api/test/{various}/{35+ specs}.e2e-spec.ts
if [ -f "repo/apps/api/test/{various}/{35+ specs}.e2e-spec.ts" ]; then
  add_row "T14-F1" "Fichier {35+ specs}.e2e-spec.ts existe" "PASS" "Cree"
else
  add_row "T14-F1" "Fichier {35+ specs}.e2e-spec.ts existe" "FAIL" "Manquant"
fi
# Test T14-F2: Existence fichier repo/infrastructure/scripts/seed-stock-hr.ts
if [ -f "repo/infrastructure/scripts/seed-stock-hr.ts" ]; then
  add_row "T14-F2" "Fichier seed-stock-hr.ts existe" "PASS" "Cree"
else
  add_row "T14-F2" "Fichier seed-stock-hr.ts existe" "FAIL" "Manquant"
fi
# Test T14-F3: Existence fichier repo/docs/phase-3-completion.md
if [ -f "repo/docs/phase-3-completion.md" ]; then
  add_row "T14-F3" "Fichier phase-3-completion.md existe" "PASS" "Cree"
else
  add_row "T14-F3" "Fichier phase-3-completion.md existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T14-V1: 35+ tests passent (P0)
echo "  Verifying T14-V1 : 35+ tests passent..."
add_row "T14-V1" "35+ tests passent" "WARN" "(P0) Voir B-13 Tache 3.6.14 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T14-V2: CI green (P0)
echo "  Verifying T14-V2 : CI green..."
add_row "T14-V2" "CI green" "WARN" "(P0) Voir B-13 Tache 3.6.14 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T14-V3: Fixtures realistes (P0)
echo "  Verifying T14-V3 : Fixtures realistes..."
add_row "T14-V3" "Fixtures realistes" "WARN" "(P0) Voir B-13 Tache 3.6.14 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T14-V4: Documentation Phase 3 closure (P0)
echo "  Verifying T14-V4 : Documentation Phase 3 closure..."
add_row "T14-V4" "Documentation Phase 3 closure" "WARN" "(P0) Voir B-13 Tache 3.6.14 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T14-V5: Reproducibility 5x runs (P0)
echo "  Verifying T14-V5 : Reproducibility 5x runs..."
add_row "T14-V5" "Reproducibility 5x runs" "WARN" "(P0) Voir B-13 Tache 3.6.14 pour test detaille - critere a auto-tester via script ad-hoc"

```

---


---


## VERIFICATIONS TRANSVERSALES SPRINT 13

### TR-BUILD : Build complet du sprint

```bash
echo ""
echo "================================================"
echo "VERIFICATIONS TRANSVERSALES SPRINT 13"
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

### TR-MIGRATIONS : Migrations DB Sprint 13

```bash
echo "=== TR-MIGRATIONS : Migrations DB ==="
MIGR_COUNT=$(pg_query "SELECT COUNT(*) FROM migrations WHERE name LIKE '%sprint13%' OR name LIKE '%Sprint13%'" || echo 0)
if [ "$MIGR_COUNT" -gt 0 ]; then
  add_row "TR-MIG" "Migrations Sprint 13 appliquees" "PASS" "$MIGR_COUNT migrations"
else
  add_row "TR-MIG" "Migrations Sprint 13 appliquees" "WARN" "Aucune migration detectee (verifier)"
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
echo "GENERATION DU RAPPORT FINAL SPRINT 13"
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

## Jalon GO/NO-GO Sprint 13

EOF

# Calcul statut final
if (( $(echo "$SCORE >= 95" | bc -l) )); then
  STATUT="GO"
  cat >> "$REPORT_FILE" << EOF
**STATUT** : GO -- Sprint 13 valide, passage Sprint 14 autorise

Le sprint a passe les criteres requis. Cowork peut demarrer Sprint 14.

EOF
  echo ""
  echo "================================================"
  echo "SPRINT 13 : GO ($SCORE%)"
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
  echo "SPRINT 13 : GO CONDITIONNEL ($SCORE%)"
  echo "================================================"
else
  STATUT="NO-GO"
  cat >> "$REPORT_FILE" << EOF
**STATUT** : NO-GO -- Score $SCORE% trop bas (cible 85% minimum)

Le sprint **doit etre repris** :
- Lister tous FAIL P0
- Escalation Saad/Abla decision (cut scope OR delai)
- Reprise sprint avant Sprint 14

EOF
  echo ""
  echo "================================================"
  echo "SPRINT 13 : NO-GO ($SCORE%)"
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
  echo "git commit -m \"chore(sprint-13): close sprint 13 -- $STATUT ($SCORE%)\"" >> "$REPORT_FILE"
  echo '```' >> "$REPORT_FILE"
fi

echo ""
echo "Rapport complet dans : $REPORT_FILE"
```

---

## INSTRUCTION FINALE A CLAUDE CODE / COWORK

Apres l'execution complete des verifications ci-dessus :

1. **Lis le contenu de `sprint13-verify-report.md`** integralement
2. **Identifie les FAIL critiques** (criteres P0) qui necessitent intervention manuelle
3. **Affiche un resume executif** :
   - Nombre total de criteres
   - Pourcentage PASS / PASS\* / FAIL / WARN
   - Liste des FAIL avec contexte technique
   - Recommandation : GO / GO CONDITIONNEL / NO-GO
4. **Si NO-GO** : ne pas demarrer le Sprint suivant, alerter Saad/Abla via Slack `#insurtech-dev`
5. **Si GO ou GO CONDITIONNEL** : produire le commit de cloture du sprint :

```bash
git add skalean-insurtech/sprint13-verify-report.md
git commit -m "chore(sprint-13): close sprint 13 with verification report

- Verification automatique executee
- Score global : <SCORE>%
- <PASS> criteres PASS, <PASS_REPAIRED> reparations auto, <FAIL> FAIL
- Statut : <GO|GO CONDITIONNEL|NO-GO>

Phase: 3 -- Modules Horizontaux
Sprint: 13 (Phase 3 / Sprint 6)
Reference B-13, C-13, V-13
Report: sprint13-verify-report.md"
```

6. **Documentation continue** : si decisions techniques prises pendant verification, ajouter notes dans `repo/docs/runbooks/sprint-13-lessons-learned.md`

---

**Fin de la verification V-13 v2.2 detaillee -- Sprint 13 (3.6) Analytics ClickHouse + Stock + HR.**

**Total criteres taches** : 80 | **Total transversaux** : ~10 | **Effort sprint** : 75h
