# VERIFICATION SPRINT 34 -- Phase 7 / Sprint 6 : Performance Scaling (load + chaos + SLOs)
# Version : Auto-reparation active + Rapport final MD detaille
# 12 taches, 55 criteres extraits B-34
# AUCUNE EMOJI AUTORISEE

**Version** : v2.2 (verification detaillee)
**Phase** : 7 -- Hardening + Integrations + Pilote
**Sprint** : 34 / 35 (cumul) -- Sprint 6 dans Phase 7
**Reference meta-prompt** : `B-34-sprint-34-performance-scaling.md`
**Reference orchestrateur** : `C-34-sprint-34-performance-scaling.md`
**Total criteres** : 55 criteres taches + ~10 transversaux

---

Tu es **Claude Code (ou Cowork)**. Tu dois executer une **verification COMPLETE et EXHAUSTIVE** du Sprint 34 apres execution toutes les 12 taches.

---

## REGLES D'EXECUTION

1. Tu **executes CHAQUE verification dans l'ordre** (taches puis transversales)
2. Quand une verification echoue, tu **TENTES UNE REPARATION AUTOMATIQUE** avant de noter FAIL
3. Apres chaque tentative de reparation, tu **re-executes la verification**
4. Tu consignes dans `sprint34-verify-report.md` **TOUS les resultats** au fil de l'execution
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
REPORT_FILE="sprint34-verify-report.md"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
RUN_ID=$(date '+%Y%m%d-%H%M%S')

cat > "$REPORT_FILE" << EOF
# Rapport de Verification - Sprint 34 : Performance Scaling (load + chaos + SLOs)

**Date** : $TIMESTAMP
**Run ID** : $RUN_ID
**Phase** : 7 -- Hardening + Integrations + Pilote
**Sprint** : 34 (Phase 7 / Sprint 6)
**Reference B-34** : 12 taches, 55 criteres extraits
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

## TACHE 1/5 -- 7.6.1 : SLOs Definition + APM Setup

```bash
echo ""
echo "================================================"
echo "TACHE 7.6.1 : SLOs Definition + APM Setup"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T01-F1: Existence fichier repo/docs/performance/slos-defined.md
if [ -f "repo/docs/performance/slos-defined.md" ]; then
  add_row "T01-F1" "Fichier slos-defined.md existe" "PASS" "Cree"
else
  add_row "T01-F1" "Fichier slos-defined.md existe" "FAIL" "Manquant"
fi
# Test T01-F2: Existence fichier repo/infrastructure/observability/datadog-config.yaml
if [ -f "repo/infrastructure/observability/datadog-config.yaml" ]; then
  add_row "T01-F2" "Fichier datadog-config.yaml existe" "PASS" "Cree"
else
  add_row "T01-F2" "Fichier datadog-config.yaml existe" "FAIL" "Manquant"
fi
# Test T01-F3: Existence fichier repo/packages/common/src/observability/{tracing,metrics}.ts
if [ -f "repo/packages/common/src/observability/{tracing,metrics}.ts" ]; then
  add_row "T01-F3" "Fichier {tracing,metrics}.ts existe" "PASS" "Cree"
else
  add_row "T01-F3" "Fichier {tracing,metrics}.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T01-V1: SLOs documente (P0)
echo "  Verifying T01-V1 : SLOs documente..."
add_row "T01-V1" "SLOs documente" "WARN" "(P0) Voir B-34 Tache 7.6.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V2: APM operationnel (P0)
echo "  Verifying T01-V2 : APM operationnel..."
add_row "T01-V2" "APM operationnel" "WARN" "(P0) Voir B-34 Tache 7.6.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V3: Distributed traces visible (P0)
echo "  Verifying T01-V3 : Distributed traces visible..."
add_row "T01-V3" "Distributed traces visible" "WARN" "(P0) Voir B-34 Tache 7.6.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V4: Alerts configures (P0)
echo "  Verifying T01-V4 : Alerts configures..."
add_row "T01-V4" "Alerts configures" "WARN" "(P0) Voir B-34 Tache 7.6.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V5: Tests 5+ scenarios (P0)
echo "  Verifying T01-V5 : Tests 5+ scenarios..."
add_row "T01-V5" "Tests 5+ scenarios" "WARN" "(P0) Voir B-34 Tache 7.6.1 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 2/5 -- 7.6.2 : Load Testing K6 Scenarios

```bash
echo ""
echo "================================================"
echo "TACHE 7.6.2 : Load Testing K6 Scenarios"
echo "Priorite : P0 | Effort : 8h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T02-F2: Existence fichier repo/load-tests/scenarios/{api-load,api-stress,api-soak,api-spike}.js
if [ -f "repo/load-tests/scenarios/{api-load,api-stress,api-soak,api-spike}.js" ]; then
  add_row "T02-F2" "Fichier {api-load,api-stress,api-soak,api-spike}.js existe" "PASS" "Cree"
else
  add_row "T02-F2" "Fichier {api-load,api-stress,api-soak,api-spike}.js existe" "FAIL" "Manquant"
fi
# Test T02-F3: Existence fichier repo/load-tests/scenarios/workflows/{login,quote,sinistre-dispatch,sky-chat}.js
if [ -f "repo/load-tests/scenarios/workflows/{login,quote,sinistre-dispatch,sky-chat}.js" ]; then
  add_row "T02-F3" "Fichier {login,quote,sinistre-dispatch,sky-chat}.js existe" "PASS" "Cree"
else
  add_row "T02-F3" "Fichier {login,quote,sinistre-dispatch,sky-chat}.js existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T02-V1: 4 scenarios api (P0)
echo "  Verifying T02-V1 : 4 scenarios api..."
add_row "T02-V1" "4 scenarios api" "WARN" "(P0) Voir B-34 Tache 7.6.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V2: 4 workflows critiques (P0)
echo "  Verifying T02-V2 : 4 workflows critiques..."
add_row "T02-V2" "4 workflows critiques" "WARN" "(P0) Voir B-34 Tache 7.6.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V3: SLO thresholds enforced (P0)
echo "  Verifying T02-V3 : SLO thresholds enforced..."
add_row "T02-V3" "SLO thresholds enforced" "WARN" "(P0) Voir B-34 Tache 7.6.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V4: CI nightly (P0)
echo "  Verifying T02-V4 : CI nightly..."
add_row "T02-V4" "CI nightly" "WARN" "(P0) Voir B-34 Tache 7.6.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V5: Reports HTML (P0)
echo "  Verifying T02-V5 : Reports HTML..."
add_row "T02-V5" "Reports HTML" "WARN" "(P0) Voir B-34 Tache 7.6.2 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 3/5 -- 7.6.3 : Database Optimization

```bash
echo ""
echo "================================================"
echo "TACHE 7.6.3 : Database Optimization"
echo "Priorite : P0 | Effort : 7h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T03-F1: Existence fichier repo/docs/performance/database-optimization-report.md
if [ -f "repo/docs/performance/database-optimization-report.md" ]; then
  add_row "T03-F1" "Fichier database-optimization-report.md existe" "PASS" "Cree"
else
  add_row "T03-F1" "Fichier database-optimization-report.md existe" "FAIL" "Manquant"
fi
# Test T03-F2: Existence fichier repo/packages/database/src/migrations/{date}-AddPerformanceIndexes.ts
if [ -f "repo/packages/database/src/migrations/{date}-AddPerformanceIndexes.ts" ]; then
  add_row "T03-F2" "Fichier {date}-AddPerformanceIndexes.ts existe" "PASS" "Cree"
else
  add_row "T03-F2" "Fichier {date}-AddPerformanceIndexes.ts existe" "FAIL" "Manquant"
fi
# Test T03-F3: Existence fichier repo/packages/database/src/migrations/{date}-DropUnusedIndexes.ts
if [ -f "repo/packages/database/src/migrations/{date}-DropUnusedIndexes.ts" ]; then
  add_row "T03-F3" "Fichier {date}-DropUnusedIndexes.ts existe" "PASS" "Cree"
else
  add_row "T03-F3" "Fichier {date}-DropUnusedIndexes.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T03-V1: Slow queries identifies + fixed (P0)
echo "  Verifying T03-V1 : Slow queries identifies + fixed..."
add_row "T03-V1" "Slow queries identifies + fixed" "WARN" "(P0) Voir B-34 Tache 7.6.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V2: Indexes optimises (P0)
echo "  Verifying T03-V2 : Indexes optimises..."
add_row "T03-V2" "Indexes optimises" "WARN" "(P0) Voir B-34 Tache 7.6.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V3: N+1 patterns elimines (P0)
echo "  Verifying T03-V3 : N+1 patterns elimines..."
add_row "T03-V3" "N+1 patterns elimines" "WARN" "(P0) Voir B-34 Tache 7.6.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V4: Queries critiques < 100ms p95 (P0)
echo "  Verifying T03-V4 : Queries critiques < 100ms p95..."
add_row "T03-V4" "Queries critiques < 100ms p95" "WARN" "(P0) Voir B-34 Tache 7.6.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V5: Tests 8+ scenarios (P0)
echo "  Verifying T03-V5 : Tests 8+ scenarios..."
add_row "T03-V5" "Tests 8+ scenarios" "WARN" "(P0) Voir B-34 Tache 7.6.3 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 4/5 -- 7.6.4 : Read Replicas Postgres + Connection Pooling

```bash
echo ""
echo "================================================"
echo "TACHE 7.6.4 : Read Replicas Postgres + Connection Pooling"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T04-F1: Existence fichier repo/packages/database/src/data-sources/master-data-source.ts
if [ -f "repo/packages/database/src/data-sources/master-data-source.ts" ]; then
  add_row "T04-F1" "Fichier master-data-source.ts existe" "PASS" "Cree"
else
  add_row "T04-F1" "Fichier master-data-source.ts existe" "FAIL" "Manquant"
fi
# Test T04-F2: Existence fichier repo/packages/database/src/data-sources/replica-data-source.ts
if [ -f "repo/packages/database/src/data-sources/replica-data-source.ts" ]; then
  add_row "T04-F2" "Fichier replica-data-source.ts existe" "PASS" "Cree"
else
  add_row "T04-F2" "Fichier replica-data-source.ts existe" "FAIL" "Manquant"
fi
# Test T04-F3: Existence fichier repo/packages/database/src/services/read-replica-router.service.ts
if [ -f "repo/packages/database/src/services/read-replica-router.service.ts" ]; then
  add_row "T04-F3" "Fichier read-replica-router.service.ts existe" "PASS" "Cree"
else
  add_row "T04-F3" "Fichier read-replica-router.service.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T04-V1: Read replicas operationnels (P0)
echo "  Verifying T04-V1 : Read replicas operationnels..."
add_row "T04-V1" "Read replicas operationnels" "WARN" "(P0) Voir B-34 Tache 7.6.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V2: Routing queries correct (P0)
echo "  Verifying T04-V2 : Routing queries correct..."
add_row "T04-V2" "Routing queries correct" "WARN" "(P0) Voir B-34 Tache 7.6.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V3: Replica lag monitored (P0)
echo "  Verifying T04-V3 : Replica lag monitored..."
add_row "T04-V3" "Replica lag monitored" "WARN" "(P0) Voir B-34 Tache 7.6.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V4: pgBouncer pooling (P0)
echo "  Verifying T04-V4 : pgBouncer pooling..."
add_row "T04-V4" "pgBouncer pooling" "WARN" "(P0) Voir B-34 Tache 7.6.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V5: Tests 6+ scenarios (P0)
echo "  Verifying T04-V5 : Tests 6+ scenarios..."
add_row "T04-V5" "Tests 6+ scenarios" "WARN" "(P0) Voir B-34 Tache 7.6.4 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 5/4 -- 7.6.5 : Cache Strategy Redis Cluster

```bash
echo ""
echo "================================================"
echo "TACHE 7.6.5 : Cache Strategy Redis Cluster"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 4"
echo "================================================"

# === Verification fichiers crees ===
# Test T05-F1: Existence fichier repo/infrastructure/redis/cluster-config.yaml
if [ -f "repo/infrastructure/redis/cluster-config.yaml" ]; then
  add_row "T05-F1" "Fichier cluster-config.yaml existe" "PASS" "Cree"
else
  add_row "T05-F1" "Fichier cluster-config.yaml existe" "FAIL" "Manquant"
fi
# Test T05-F2: Existence fichier repo/docs/performance/cache-strategy-review.md
if [ -f "repo/docs/performance/cache-strategy-review.md" ]; then
  add_row "T05-F2" "Fichier cache-strategy-review.md existe" "PASS" "Cree"
else
  add_row "T05-F2" "Fichier cache-strategy-review.md existe" "FAIL" "Manquant"
fi
# Test T05-F3: Existence fichier repo/packages/cache/src/services/cache-monitoring.service.ts
if [ -f "repo/packages/cache/src/services/cache-monitoring.service.ts" ]; then
  add_row "T05-F3" "Fichier cache-monitoring.service.ts existe" "PASS" "Cree"
else
  add_row "T05-F3" "Fichier cache-monitoring.service.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T05-V1: Redis cluster 3 nodes (P0)
echo "  Verifying T05-V1 : Redis cluster 3 nodes..."
add_row "T05-V1" "Redis cluster 3 nodes" "WARN" "(P0) Voir B-34 Tache 7.6.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V2: Hit ratios > 70% (P0)
echo "  Verifying T05-V2 : Hit ratios > 70%..."
add_row "T05-V2" "Hit ratios > 70%" "WARN" "(P0) Voir B-34 Tache 7.6.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V3: Failover tested (P0)
echo "  Verifying T05-V3 : Failover tested..."
add_row "T05-V3" "Failover tested" "WARN" "(P0) Voir B-34 Tache 7.6.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V4: Tests 6+ scenarios (P0)
echo "  Verifying T05-V4 : Tests 6+ scenarios..."
add_row "T05-V4" "Tests 6+ scenarios" "WARN" "(P0) Voir B-34 Tache 7.6.5 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 6/5 -- 7.6.6 : CDN Cloudflare

```bash
echo ""
echo "================================================"
echo "TACHE 7.6.6 : CDN Cloudflare"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T06-F1: Existence fichier repo/infrastructure/cloudflare/{8 zones}.yaml
if [ -f "repo/infrastructure/cloudflare/{8 zones}.yaml" ]; then
  add_row "T06-F1" "Fichier {8 zones}.yaml existe" "PASS" "Cree"
else
  add_row "T06-F1" "Fichier {8 zones}.yaml existe" "FAIL" "Manquant"
fi
# Test T06-F2: Existence fichier repo/infrastructure/cloudflare/waf-rules.yaml
if [ -f "repo/infrastructure/cloudflare/waf-rules.yaml" ]; then
  add_row "T06-F2" "Fichier waf-rules.yaml existe" "PASS" "Cree"
else
  add_row "T06-F2" "Fichier waf-rules.yaml existe" "FAIL" "Manquant"
fi
# Test T06-F3: Existence fichier repo/docs/performance/cdn-strategy.md
if [ -f "repo/docs/performance/cdn-strategy.md" ]; then
  add_row "T06-F3" "Fichier cdn-strategy.md existe" "PASS" "Cree"
else
  add_row "T06-F3" "Fichier cdn-strategy.md existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T06-V1: 8 domains CDN configures (P0)
echo "  Verifying T06-V1 : 8 domains CDN configures..."
add_row "T06-V1" "8 domains CDN configures" "WARN" "(P0) Voir B-34 Tache 7.6.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V2: Static cache 1 year (P0)
echo "  Verifying T06-V2 : Static cache 1 year..."
add_row "T06-V2" "Static cache 1 year" "WARN" "(P0) Voir B-34 Tache 7.6.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V3: WAF rules active (P0)
echo "  Verifying T06-V3 : WAF rules active..."
add_row "T06-V3" "WAF rules active" "WARN" "(P0) Voir B-34 Tache 7.6.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V4: Latency reduction mesurable (P0)
echo "  Verifying T06-V4 : Latency reduction mesurable..."
add_row "T06-V4" "Latency reduction mesurable" "WARN" "(P0) Voir B-34 Tache 7.6.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V5: Tests 5+ scenarios (P0)
echo "  Verifying T06-V5 : Tests 5+ scenarios..."
add_row "T06-V5" "Tests 5+ scenarios" "WARN" "(P0) Voir B-34 Tache 7.6.6 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 7/5 -- 7.6.7 : Horizontal Scaling

```bash
echo ""
echo "================================================"
echo "TACHE 7.6.7 : Horizontal Scaling"
echo "Priorite : P0 | Effort : 7h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T07-F1: Existence fichier repo/infrastructure/aws/autoscaling-groups.yaml
if [ -f "repo/infrastructure/aws/autoscaling-groups.yaml" ]; then
  add_row "T07-F1" "Fichier autoscaling-groups.yaml existe" "PASS" "Cree"
else
  add_row "T07-F1" "Fichier autoscaling-groups.yaml existe" "FAIL" "Manquant"
fi
# Test T07-F2: Existence fichier repo/infrastructure/k8s/hpa-{service}.yaml
if [ -f "repo/infrastructure/k8s/hpa-{service}.yaml" ]; then
  add_row "T07-F2" "Fichier hpa-{service}.yaml existe" "PASS" "Cree"
else
  add_row "T07-F2" "Fichier hpa-{service}.yaml existe" "FAIL" "Manquant"
fi
# Test T07-F3: Existence fichier repo/docs/performance/horizontal-scaling-strategy.md
if [ -f "repo/docs/performance/horizontal-scaling-strategy.md" ]; then
  add_row "T07-F3" "Fichier horizontal-scaling-strategy.md existe" "PASS" "Cree"
else
  add_row "T07-F3" "Fichier horizontal-scaling-strategy.md existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T07-V1: Autoscaling rules configures (P0)
echo "  Verifying T07-V1 : Autoscaling rules configures..."
add_row "T07-V1" "Autoscaling rules configures" "WARN" "(P0) Voir B-34 Tache 7.6.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V2: Load balancers + health checks (P0)
echo "  Verifying T07-V2 : Load balancers + health checks..."
add_row "T07-V2" "Load balancers + health checks" "WARN" "(P0) Voir B-34 Tache 7.6.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V3: Scale-up tested (P0)
echo "  Verifying T07-V3 : Scale-up tested..."
add_row "T07-V3" "Scale-up tested" "WARN" "(P0) Voir B-34 Tache 7.6.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V4: Scale-down tested (P0)
echo "  Verifying T07-V4 : Scale-down tested..."
add_row "T07-V4" "Scale-down tested" "WARN" "(P0) Voir B-34 Tache 7.6.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V5: Tests 6+ scenarios (P0)
echo "  Verifying T07-V5 : Tests 6+ scenarios..."
add_row "T07-V5" "Tests 6+ scenarios" "WARN" "(P0) Voir B-34 Tache 7.6.7 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 8/5 -- 7.6.8 : Kafka Throughput Optimization

```bash
echo ""
echo "================================================"
echo "TACHE 7.6.8 : Kafka Throughput Optimization"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T08-F1: Existence fichier repo/infrastructure/kafka/topics-partitioning.yaml
if [ -f "repo/infrastructure/kafka/topics-partitioning.yaml" ]; then
  add_row "T08-F1" "Fichier topics-partitioning.yaml existe" "PASS" "Cree"
else
  add_row "T08-F1" "Fichier topics-partitioning.yaml existe" "FAIL" "Manquant"
fi
# Test T08-F2: Existence fichier repo/packages/kafka/src/config/{producer,consumer}-config.ts
if [ -f "repo/packages/kafka/src/config/{producer,consumer}-config.ts" ]; then
  add_row "T08-F2" "Fichier {producer,consumer}-config.ts existe" "PASS" "Cree"
else
  add_row "T08-F2" "Fichier {producer,consumer}-config.ts existe" "FAIL" "Manquant"
fi
# Test T08-F3: Existence fichier repo/docs/performance/kafka-optimization.md
if [ -f "repo/docs/performance/kafka-optimization.md" ]; then
  add_row "T08-F3" "Fichier kafka-optimization.md existe" "PASS" "Cree"
else
  add_row "T08-F3" "Fichier kafka-optimization.md existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T08-V1: Partitions optimises (P0)
echo "  Verifying T08-V1 : Partitions optimises..."
add_row "T08-V1" "Partitions optimises" "WARN" "(P0) Voir B-34 Tache 7.6.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V2: Throughput +50% mesure (P0)
echo "  Verifying T08-V2 : Throughput +50% mesure..."
add_row "T08-V2" "Throughput +50% mesure" "WARN" "(P0) Voir B-34 Tache 7.6.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V3: Consumer lag monitored (P0)
echo "  Verifying T08-V3 : Consumer lag monitored..."
add_row "T08-V3" "Consumer lag monitored" "WARN" "(P0) Voir B-34 Tache 7.6.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V4: DLQ + replay (P0)
echo "  Verifying T08-V4 : DLQ + replay..."
add_row "T08-V4" "DLQ + replay" "WARN" "(P0) Voir B-34 Tache 7.6.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V5: Tests 5+ scenarios (P0)
echo "  Verifying T08-V5 : Tests 5+ scenarios..."
add_row "T08-V5" "Tests 5+ scenarios" "WARN" "(P0) Voir B-34 Tache 7.6.8 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 9/5 -- 7.6.9 : Cost Optimization

```bash
echo ""
echo "================================================"
echo "TACHE 7.6.9 : Cost Optimization"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T09-F1: Existence fichier repo/docs/performance/cost-optimization-strategy.md
if [ -f "repo/docs/performance/cost-optimization-strategy.md" ]; then
  add_row "T09-F1" "Fichier cost-optimization-strategy.md existe" "PASS" "Cree"
else
  add_row "T09-F1" "Fichier cost-optimization-strategy.md existe" "FAIL" "Manquant"
fi
# Test T09-F2: Existence fichier repo/infrastructure/aws/reserved-instances-plan.yaml
if [ -f "repo/infrastructure/aws/reserved-instances-plan.yaml" ]; then
  add_row "T09-F2" "Fichier reserved-instances-plan.yaml existe" "PASS" "Cree"
else
  add_row "T09-F2" "Fichier reserved-instances-plan.yaml existe" "FAIL" "Manquant"
fi
# Test T09-F3: Existence fichier repo/infrastructure/scripts/cost-anomaly-detector.ts
if [ -f "repo/infrastructure/scripts/cost-anomaly-detector.ts" ]; then
  add_row "T09-F3" "Fichier cost-anomaly-detector.ts existe" "PASS" "Cree"
else
  add_row "T09-F3" "Fichier cost-anomaly-detector.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T09-V1: Right-sizing complete (P0)
echo "  Verifying T09-V1 : Right-sizing complete..."
add_row "T09-V1" "Right-sizing complete" "WARN" "(P0) Voir B-34 Tache 7.6.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V2: Reserved instances plan (P0)
echo "  Verifying T09-V2 : Reserved instances plan..."
add_row "T09-V2" "Reserved instances plan" "WARN" "(P0) Voir B-34 Tache 7.6.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V3: Cost monitoring + alerts (P0)
echo "  Verifying T09-V3 : Cost monitoring + alerts..."
add_row "T09-V3" "Cost monitoring + alerts" "WARN" "(P0) Voir B-34 Tache 7.6.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V4: Per-tenant attribution (P0)
echo "  Verifying T09-V4 : Per-tenant attribution..."
add_row "T09-V4" "Per-tenant attribution" "WARN" "(P0) Voir B-34 Tache 7.6.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V5: Documentation playbook (P0)
echo "  Verifying T09-V5 : Documentation playbook..."
add_row "T09-V5" "Documentation playbook" "WARN" "(P0) Voir B-34 Tache 7.6.9 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 10/5 -- 7.6.10 : Stress Testing + Chaos Engineering

```bash
echo ""
echo "================================================"
echo "TACHE 7.6.10 : Stress Testing + Chaos Engineering"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T10-F1: Existence fichier repo/load-tests/stress/{stress,spike,soak}.js
if [ -f "repo/load-tests/stress/{stress,spike,soak}.js" ]; then
  add_row "T10-F1" "Fichier {stress,spike,soak}.js existe" "PASS" "Cree"
else
  add_row "T10-F1" "Fichier {stress,spike,soak}.js existe" "FAIL" "Manquant"
fi
# Test T10-F2: Existence fichier repo/load-tests/chaos/{several scenarios}.yaml
if [ -f "repo/load-tests/chaos/{several scenarios}.yaml" ]; then
  add_row "T10-F2" "Fichier {several scenarios}.yaml existe" "PASS" "Cree"
else
  add_row "T10-F2" "Fichier {several scenarios}.yaml existe" "FAIL" "Manquant"
fi
# Test T10-F3: Existence fichier repo/docs/performance/chaos-engineering-results.md
if [ -f "repo/docs/performance/chaos-engineering-results.md" ]; then
  add_row "T10-F3" "Fichier chaos-engineering-results.md existe" "PASS" "Cree"
else
  add_row "T10-F3" "Fichier chaos-engineering-results.md existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T10-V1: Breaking point identifie (P0)
echo "  Verifying T10-V1 : Breaking point identifie..."
add_row "T10-V1" "Breaking point identifie" "WARN" "(P0) Voir B-34 Tache 7.6.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V2: Spike recovery (P0)
echo "  Verifying T10-V2 : Spike recovery..."
add_row "T10-V2" "Spike recovery" "WARN" "(P0) Voir B-34 Tache 7.6.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V3: Chaos experiments executes (P0)
echo "  Verifying T10-V3 : Chaos experiments executes..."
add_row "T10-V3" "Chaos experiments executes" "WARN" "(P0) Voir B-34 Tache 7.6.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V4: Failover validated (P0)
echo "  Verifying T10-V4 : Failover validated..."
add_row "T10-V4" "Failover validated" "WARN" "(P0) Voir B-34 Tache 7.6.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V5: RTO < 60s (P0)
echo "  Verifying T10-V5 : RTO < 60s..."
add_row "T10-V5" "RTO < 60s" "WARN" "(P0) Voir B-34 Tache 7.6.10 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 11/4 -- 7.6.11 : SLI/SLO Dashboards + Alerts + Runbook

```bash
echo ""
echo "================================================"
echo "TACHE 7.6.11 : SLI/SLO Dashboards + Alerts + Runbook"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 4"
echo "================================================"

# === Verification fichiers crees ===
# Test T11-F1: Existence fichier repo/infrastructure/observability/dashboards/{several}.json
if [ -f "repo/infrastructure/observability/dashboards/{several}.json" ]; then
  add_row "T11-F1" "Fichier {several}.json existe" "PASS" "Cree"
else
  add_row "T11-F1" "Fichier {several}.json existe" "FAIL" "Manquant"
fi
# Test T11-F2: Existence fichier repo/infrastructure/observability/alerts/{several}.yaml
if [ -f "repo/infrastructure/observability/alerts/{several}.yaml" ]; then
  add_row "T11-F2" "Fichier {several}.yaml existe" "PASS" "Cree"
else
  add_row "T11-F2" "Fichier {several}.yaml existe" "FAIL" "Manquant"
fi
# Test T11-F3: Existence fichier repo/docs/performance/runbook-ops-capacity-planning.md
if [ -f "repo/docs/performance/runbook-ops-capacity-planning.md" ]; then
  add_row "T11-F3" "Fichier runbook-ops-capacity-planning.md existe" "PASS" "Cree"
else
  add_row "T11-F3" "Fichier runbook-ops-capacity-planning.md existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T11-V1: 5+ dashboards (P0)
echo "  Verifying T11-V1 : 5+ dashboards..."
add_row "T11-V1" "5+ dashboards" "WARN" "(P0) Voir B-34 Tache 7.6.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V2: Alerts critical/warning (P0)
echo "  Verifying T11-V2 : Alerts critical/warning..."
add_row "T11-V2" "Alerts critical/warning" "WARN" "(P0) Voir B-34 Tache 7.6.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V3: Runbook ops (P0)
echo "  Verifying T11-V3 : Runbook ops..."
add_row "T11-V3" "Runbook ops" "WARN" "(P0) Voir B-34 Tache 7.6.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V4: Tests 5+ scenarios (P0)
echo "  Verifying T11-V4 : Tests 5+ scenarios..."
add_row "T11-V4" "Tests 5+ scenarios" "WARN" "(P0) Voir B-34 Tache 7.6.11 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 12/2 -- 7.6.12 : Documentation + Acceptance Criteria Sprint 35

```bash
echo ""
echo "================================================"
echo "TACHE 7.6.12 : Documentation + Acceptance Criteria Sprint 35"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 2"
echo "================================================"

# === Verification fichiers crees ===
# Test T12-F1: Existence fichier repo/docs/performance/performance-guide.md
if [ -f "repo/docs/performance/performance-guide.md" ]; then
  add_row "T12-F1" "Fichier performance-guide.md existe" "PASS" "Cree"
else
  add_row "T12-F1" "Fichier performance-guide.md existe" "FAIL" "Manquant"
fi
# Test T12-F2: Existence fichier repo/docs/performance/scaling-architecture.md
if [ -f "repo/docs/performance/scaling-architecture.md" ]; then
  add_row "T12-F2" "Fichier scaling-architecture.md existe" "PASS" "Cree"
else
  add_row "T12-F2" "Fichier scaling-architecture.md existe" "FAIL" "Manquant"
fi
# Test T12-F3: Existence fichier repo/docs/performance/sprint-35-pilot-acceptance-criteria.md
if [ -f "repo/docs/performance/sprint-35-pilot-acceptance-criteria.md" ]; then
  add_row "T12-F3" "Fichier sprint-35-pilot-acceptance-criteria.md existe" "PASS" "Cree"
else
  add_row "T12-F3" "Fichier sprint-35-pilot-acceptance-criteria.md existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T12-V1: 3 documents complets (P0)
echo "  Verifying T12-V1 : 3 documents complets..."
add_row "T12-V1" "3 documents complets" "WARN" "(P0) Voir B-34 Tache 7.6.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V2: Acceptance criteria Sprint 35 (P0)
echo "  Verifying T12-V2 : Acceptance criteria Sprint 35..."
add_row "T12-V2" "Acceptance criteria Sprint 35" "WARN" "(P0) Voir B-34 Tache 7.6.12 pour test detaille - critere a auto-tester via script ad-hoc"

```

---


---


## VERIFICATIONS TRANSVERSALES SPRINT 34

### TR-BUILD : Build complet du sprint

```bash
echo ""
echo "================================================"
echo "VERIFICATIONS TRANSVERSALES SPRINT 34"
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



---

## GENERATION DU RAPPORT FINAL

```bash
echo ""
echo "================================================"
echo "GENERATION DU RAPPORT FINAL SPRINT 34"
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

## Jalon GO/NO-GO Sprint 34

EOF

# Calcul statut final
if (( $(echo "$SCORE >= 95" | bc -l) )); then
  STATUT="GO"
  cat >> "$REPORT_FILE" << EOF
**STATUT** : GO -- Sprint 34 valide, passage Sprint 35 autorise

Le sprint a passe les criteres requis. Cowork peut demarrer Sprint 35.

EOF
  echo ""
  echo "================================================"
  echo "SPRINT 34 : GO ($SCORE%)"
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
  echo "SPRINT 34 : GO CONDITIONNEL ($SCORE%)"
  echo "================================================"
else
  STATUT="NO-GO"
  cat >> "$REPORT_FILE" << EOF
**STATUT** : NO-GO -- Score $SCORE% trop bas (cible 85% minimum)

Le sprint **doit etre repris** :
- Lister tous FAIL P0
- Escalation Saad/Abla decision (cut scope OR delai)
- Reprise sprint avant Sprint 35

EOF
  echo ""
  echo "================================================"
  echo "SPRINT 34 : NO-GO ($SCORE%)"
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
  echo "git commit -m \"chore(sprint-34): close sprint 34 -- $STATUT ($SCORE%)\"" >> "$REPORT_FILE"
  echo '```' >> "$REPORT_FILE"
fi

echo ""
echo "Rapport complet dans : $REPORT_FILE"
```

---

## INSTRUCTION FINALE A CLAUDE CODE / COWORK

Apres l'execution complete des verifications ci-dessus :

1. **Lis le contenu de `sprint34-verify-report.md`** integralement
2. **Identifie les FAIL critiques** (criteres P0) qui necessitent intervention manuelle
3. **Affiche un resume executif** :
   - Nombre total de criteres
   - Pourcentage PASS / PASS\* / FAIL / WARN
   - Liste des FAIL avec contexte technique
   - Recommandation : GO / GO CONDITIONNEL / NO-GO
4. **Si NO-GO** : ne pas demarrer le Sprint suivant, alerter Saad/Abla via Slack `#insurtech-dev`
5. **Si GO ou GO CONDITIONNEL** : produire le commit de cloture du sprint :

```bash
git add skalean-insurtech/sprint34-verify-report.md
git commit -m "chore(sprint-34): close sprint 34 with verification report

- Verification automatique executee
- Score global : <SCORE>%
- <PASS> criteres PASS, <PASS_REPAIRED> reparations auto, <FAIL> FAIL
- Statut : <GO|GO CONDITIONNEL|NO-GO>

Phase: 7 -- Hardening + Integrations + Pilote
Sprint: 34 (Phase 7 / Sprint 6)
Reference B-34, C-34, V-34
Report: sprint34-verify-report.md"
```

6. **Documentation continue** : si decisions techniques prises pendant verification, ajouter notes dans `repo/docs/runbooks/sprint-34-lessons-learned.md`

---

**Fin de la verification V-34 v2.2 detaillee -- Sprint 34 (7.6) Performance Scaling (load + chaos + SLOs).**

**Total criteres taches** : 55 | **Total transversaux** : ~10 | **Effort sprint** : 70h
