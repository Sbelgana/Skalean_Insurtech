# VERIFICATION SPRINT 29 -- Phase 7 / Sprint 1 : Skalean AI REST Integration (swap Mock -> Real)
# Version : Auto-reparation active + Rapport final MD detaille
# 12 taches, 51 criteres extraits B-29
# AUCUNE EMOJI AUTORISEE

**Version** : v2.2 (verification detaillee)
**Phase** : 7 -- Hardening + Integrations + Pilote
**Sprint** : 29 / 35 (cumul) -- Sprint 1 dans Phase 7
**Reference meta-prompt** : `B-29-sprint-29-skalean-ai-rest.md`
**Reference orchestrateur** : `C-29-sprint-29-skalean-ai-rest.md`
**Total criteres** : 51 criteres taches + ~10 transversaux

---

Tu es **Claude Code (ou Cowork)**. Tu dois executer une **verification COMPLETE et EXHAUSTIVE** du Sprint 29 apres execution toutes les 12 taches.

---

## REGLES D'EXECUTION

1. Tu **executes CHAQUE verification dans l'ordre** (taches puis transversales)
2. Quand une verification echoue, tu **TENTES UNE REPARATION AUTOMATIQUE** avant de noter FAIL
3. Apres chaque tentative de reparation, tu **re-executes la verification**
4. Tu consignes dans `sprint29-verify-report.md` **TOUS les resultats** au fil de l'execution
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
REPORT_FILE="sprint29-verify-report.md"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
RUN_ID=$(date '+%Y%m%d-%H%M%S')

cat > "$REPORT_FILE" << EOF
# Rapport de Verification - Sprint 29 : Skalean AI REST Integration (swap Mock -> Real)

**Date** : $TIMESTAMP
**Run ID** : $RUN_ID
**Phase** : 7 -- Hardening + Integrations + Pilote
**Sprint** : 29 (Phase 7 / Sprint 1)
**Reference B-29** : 12 taches, 51 criteres extraits
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

## TACHE 1/6 -- 7.1.1 : SkaleanAiVisionClient HTTP Implementation

```bash
echo ""
echo "================================================"
echo "TACHE 7.1.1 : SkaleanAiVisionClient HTTP Implementation"
echo "Priorite : P0 | Effort : 7h"
echo "Criteres a verifier : 6"
echo "================================================"

# === Verification fichiers crees ===
# Test T01-F1: Existence fichier repo/packages/repair/src/ia-estimation/skalean-ai-vision.client.ts
if [ -f "repo/packages/repair/src/ia-estimation/skalean-ai-vision.client.ts" ]; then
  add_row "T01-F1" "Fichier skalean-ai-vision.client.ts existe" "PASS" "Cree"
else
  add_row "T01-F1" "Fichier skalean-ai-vision.client.ts existe" "FAIL" "Manquant"
fi
# Test T01-F2: Existence fichier repo/packages/repair/src/ia-estimation/skalean-ai-vision.client.spec.ts
if [ -f "repo/packages/repair/src/ia-estimation/skalean-ai-vision.client.spec.ts" ]; then
  add_row "T01-F2" "Fichier skalean-ai-vision.client.spec.ts existe" "PASS" "Cree"
else
  add_row "T01-F2" "Fichier skalean-ai-vision.client.spec.ts existe" "FAIL" "Manquant"
fi
# Test T01-F3: Existence fichier repo/packages/repair/src/ia-estimation/skalean-ai-config.ts
if [ -f "repo/packages/repair/src/ia-estimation/skalean-ai-config.ts" ]; then
  add_row "T01-F3" "Fichier skalean-ai-config.ts existe" "PASS" "Cree"
else
  add_row "T01-F3" "Fichier skalean-ai-config.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T01-V1: Implementation complete (replace stub) (P0)
echo "  Verifying T01-V1 : Implementation complete (replace stub)..."
add_row "T01-V1" "Implementation complete (replace stub)" "WARN" "(P0) Voir B-29 Tache 7.1.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V2: HTTP request + headers correct (P0)
echo "  Verifying T01-V2 : HTTP request + headers correct..."
add_row "T01-V2" "HTTP request + headers correct" "WARN" "(P0) Voir B-29 Tache 7.1.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V3: Mapping Skalean AI -> Sprint 20 format (P0)
echo "  Verifying T01-V3 : Mapping Skalean AI -> Sprint 20 format..."
add_row "T01-V3" "Mapping Skalean AI -> Sprint 20 format" "WARN" "(P0) Voir B-29 Tache 7.1.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V4: Errors typed (rate limit + budget + failed) (P0)
echo "  Verifying T01-V4 : Errors typed (rate limit + budget + failed)..."
add_row "T01-V4" "Errors typed (rate limit + budget + failed)" "WARN" "(P0) Voir B-29 Tache 7.1.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V5: Audit logging (P0)
echo "  Verifying T01-V5 : Audit logging..."
add_row "T01-V5" "Audit logging" "WARN" "(P0) Voir B-29 Tache 7.1.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V6: Tests 15+ scenarios (P0)
echo "  Verifying T01-V6 : Tests 15+ scenarios..."
add_row "T01-V6" "Tests 15+ scenarios" "WARN" "(P0) Voir B-29 Tache 7.1.1 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 2/5 -- 7.1.2 : Auth + Headers + Versioning + Retry

```bash
echo ""
echo "================================================"
echo "TACHE 7.1.2 : Auth + Headers + Versioning + Retry"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T02-F1: Existence fichier repo/packages/repair/src/ia-estimation/skalean-ai-retry-policy.ts
if [ -f "repo/packages/repair/src/ia-estimation/skalean-ai-retry-policy.ts" ]; then
  add_row "T02-F1" "Fichier skalean-ai-retry-policy.ts existe" "PASS" "Cree"
else
  add_row "T02-F1" "Fichier skalean-ai-retry-policy.ts existe" "FAIL" "Manquant"
fi
# Test T02-F2: Existence fichier repo/packages/repair/src/ia-estimation/skalean-ai-auth.service.ts
if [ -f "repo/packages/repair/src/ia-estimation/skalean-ai-auth.service.ts" ]; then
  add_row "T02-F2" "Fichier skalean-ai-auth.service.ts existe" "PASS" "Cree"
else
  add_row "T02-F2" "Fichier skalean-ai-auth.service.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T02-V1: Bearer auth + KMS (P0)
echo "  Verifying T02-V1 : Bearer auth + KMS..."
add_row "T02-V1" "Bearer auth + KMS" "WARN" "(P0) Voir B-29 Tache 7.1.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V2: Retry exponential backoff (P0)
echo "  Verifying T02-V2 : Retry exponential backoff..."
add_row "T02-V2" "Retry exponential backoff" "WARN" "(P0) Voir B-29 Tache 7.1.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V3: 429 retry-after respect (P0)
echo "  Verifying T02-V3 : 429 retry-after respect..."
add_row "T02-V3" "429 retry-after respect" "WARN" "(P0) Voir B-29 Tache 7.1.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V4: 4xx no retry (P0)
echo "  Verifying T02-V4 : 4xx no retry..."
add_row "T02-V4" "4xx no retry" "WARN" "(P0) Voir B-29 Tache 7.1.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V5: Tests 8+ scenarios (P0)
echo "  Verifying T02-V5 : Tests 8+ scenarios..."
add_row "T02-V5" "Tests 8+ scenarios" "WARN" "(P0) Voir B-29 Tache 7.1.2 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 3/4 -- 7.1.3 : Cache Redis 24h Reuse

```bash
echo ""
echo "================================================"
echo "TACHE 7.1.3 : Cache Redis 24h Reuse"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 4"
echo "================================================"

# === Verification fichiers crees ===
# Test T03-F1: Existence fichier repo/packages/repair/src/ia-estimation/cached-ia-estimation.client.ts
if [ -f "repo/packages/repair/src/ia-estimation/cached-ia-estimation.client.ts" ]; then
  add_row "T03-F1" "Fichier cached-ia-estimation.client.ts existe" "PASS" "Cree"
else
  add_row "T03-F1" "Fichier cached-ia-estimation.client.ts existe" "FAIL" "Manquant"
fi
# Test T03-F2: Existence fichier repo/packages/admin/src/services/ai-cache-stats.service.ts
if [ -f "repo/packages/admin/src/services/ai-cache-stats.service.ts" ]; then
  add_row "T03-F2" "Fichier ai-cache-stats.service.ts existe" "PASS" "Cree"
else
  add_row "T03-F2" "Fichier ai-cache-stats.service.ts existe" "FAIL" "Manquant"
fi
# Test T03-F3: Existence fichier repo/apps/api/src/modules/admin/controllers/ai-monitoring.controller.ts
if [ -f "repo/apps/api/src/modules/admin/controllers/ai-monitoring.controller.ts" ]; then
  add_row "T03-F3" "Fichier ai-monitoring.controller.ts existe" "PASS" "Cree"
else
  add_row "T03-F3" "Fichier ai-monitoring.controller.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T03-V1: Cache hit ratio per provider (P0)
echo "  Verifying T03-V1 : Cache hit ratio per provider..."
add_row "T03-V1" "Cache hit ratio per provider" "WARN" "(P0) Voir B-29 Tache 7.1.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V2: Savings MAD computed (P0)
echo "  Verifying T03-V2 : Savings MAD computed..."
add_row "T03-V2" "Savings MAD computed" "WARN" "(P0) Voir B-29 Tache 7.1.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V3: Endpoint admin stats (P0)
echo "  Verifying T03-V3 : Endpoint admin stats..."
add_row "T03-V3" "Endpoint admin stats" "WARN" "(P0) Voir B-29 Tache 7.1.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V4: Tests 6+ scenarios (P0)
echo "  Verifying T03-V4 : Tests 6+ scenarios..."
add_row "T03-V4" "Tests 6+ scenarios" "WARN" "(P0) Voir B-29 Tache 7.1.3 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 4/5 -- 7.1.4 : Circuit Breaker + Health Check + Fallback Mock

```bash
echo ""
echo "================================================"
echo "TACHE 7.1.4 : Circuit Breaker + Health Check + Fallback Mock"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T04-F1: Existence fichier repo/packages/repair/src/ia-estimation/skalean-ai-circuit-breaker.ts
if [ -f "repo/packages/repair/src/ia-estimation/skalean-ai-circuit-breaker.ts" ]; then
  add_row "T04-F1" "Fichier skalean-ai-circuit-breaker.ts existe" "PASS" "Cree"
else
  add_row "T04-F1" "Fichier skalean-ai-circuit-breaker.ts existe" "FAIL" "Manquant"
fi
# Test T04-F2: Existence fichier repo/apps/api/src/modules/admin/controllers/ai-health.controller.ts
if [ -f "repo/apps/api/src/modules/admin/controllers/ai-health.controller.ts" ]; then
  add_row "T04-F2" "Fichier ai-health.controller.ts existe" "PASS" "Cree"
else
  add_row "T04-F2" "Fichier ai-health.controller.ts existe" "FAIL" "Manquant"
fi
# Test T04-F3: Existence fichier repo/packages/comm/src/templates/{fr}/admin-skalean-ai-{breaker-alert,recovered}.hbs
if [ -f "repo/packages/comm/src/templates/{fr}/admin-skalean-ai-{breaker-alert,recovered}.hbs" ]; then
  add_row "T04-F3" "Fichier admin-skalean-ai-{breaker-alert,recovered}.hbs existe" "PASS" "Cree"
else
  add_row "T04-F3" "Fichier admin-skalean-ai-{breaker-alert,recovered}.hbs existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T04-V1: Circuit breaker config (P0)
echo "  Verifying T04-V1 : Circuit breaker config..."
add_row "T04-V1" "Circuit breaker config" "WARN" "(P0) Voir B-29 Tache 7.1.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V2: Fallback Mock automatic (P0)
echo "  Verifying T04-V2 : Fallback Mock automatic..."
add_row "T04-V2" "Fallback Mock automatic" "WARN" "(P0) Voir B-29 Tache 7.1.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V3: Health check endpoint (P0)
echo "  Verifying T04-V3 : Health check endpoint..."
add_row "T04-V3" "Health check endpoint" "WARN" "(P0) Voir B-29 Tache 7.1.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V4: Notifications super_admin (P0)
echo "  Verifying T04-V4 : Notifications super_admin..."
add_row "T04-V4" "Notifications super_admin" "WARN" "(P0) Voir B-29 Tache 7.1.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V5: Tests 8+ scenarios (P0)
echo "  Verifying T04-V5 : Tests 8+ scenarios..."
add_row "T04-V5" "Tests 8+ scenarios" "WARN" "(P0) Voir B-29 Tache 7.1.4 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 5/5 -- 7.1.5 : Cost Monitoring + Budget Alerts

```bash
echo ""
echo "================================================"
echo "TACHE 7.1.5 : Cost Monitoring + Budget Alerts"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T05-F1: Existence fichier repo/packages/database/src/migrations/{date}-IaEstimationCallsLog.ts
if [ -f "repo/packages/database/src/migrations/{date}-IaEstimationCallsLog.ts" ]; then
  add_row "T05-F1" "Fichier {date}-IaEstimationCallsLog.ts existe" "PASS" "Cree"
else
  add_row "T05-F1" "Fichier {date}-IaEstimationCallsLog.ts existe" "FAIL" "Manquant"
fi
# Test T05-F2: Existence fichier repo/packages/repair/src/entities/ia-estimation-call-log.entity.ts
if [ -f "repo/packages/repair/src/entities/ia-estimation-call-log.entity.ts" ]; then
  add_row "T05-F2" "Fichier ia-estimation-call-log.entity.ts existe" "PASS" "Cree"
else
  add_row "T05-F2" "Fichier ia-estimation-call-log.entity.ts existe" "FAIL" "Manquant"
fi
# Test T05-F3: Existence fichier repo/packages/admin/src/services/cost-tracking.service.ts
if [ -f "repo/packages/admin/src/services/cost-tracking.service.ts" ]; then
  add_row "T05-F3" "Fichier cost-tracking.service.ts existe" "PASS" "Cree"
else
  add_row "T05-F3" "Fichier cost-tracking.service.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T05-V1: Calls log (P0)
echo "  Verifying T05-V1 : Calls log..."
add_row "T05-V1" "Calls log" "WARN" "(P0) Voir B-29 Tache 7.1.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V2: Cost computation per call (P0)
echo "  Verifying T05-V2 : Cost computation per call..."
add_row "T05-V2" "Cost computation per call" "WARN" "(P0) Voir B-29 Tache 7.1.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V3: Budget thresholds (P0)
echo "  Verifying T05-V3 : Budget thresholds..."
add_row "T05-V3" "Budget thresholds" "WARN" "(P0) Voir B-29 Tache 7.1.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V4: Notifications alerts (P0)
echo "  Verifying T05-V4 : Notifications alerts..."
add_row "T05-V4" "Notifications alerts" "WARN" "(P0) Voir B-29 Tache 7.1.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V5: Tests 8+ scenarios (P0)
echo "  Verifying T05-V5 : Tests 8+ scenarios..."
add_row "T05-V5" "Tests 8+ scenarios" "WARN" "(P0) Voir B-29 Tache 7.1.5 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 6/5 -- 7.1.6 : Activation Gradual Feature Flag

```bash
echo ""
echo "================================================"
echo "TACHE 7.1.6 : Activation Gradual Feature Flag"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T06-F1: Existence fichier repo/packages/repair/src/ia-estimation/ia-estimation-router.ts
if [ -f "repo/packages/repair/src/ia-estimation/ia-estimation-router.ts" ]; then
  add_row "T06-F1" "Fichier ia-estimation-router.ts existe" "PASS" "Cree"
else
  add_row "T06-F1" "Fichier ia-estimation-router.ts existe" "FAIL" "Manquant"
fi
# Test T06-F2: Existence fichier repo/packages/admin/src/services/rollout.service.ts
if [ -f "repo/packages/admin/src/services/rollout.service.ts" ]; then
  add_row "T06-F2" "Fichier rollout.service.ts existe" "PASS" "Cree"
else
  add_row "T06-F2" "Fichier rollout.service.ts existe" "FAIL" "Manquant"
fi
# Test T06-F3: Existence fichier repo/apps/api/src/modules/admin/controllers/rollout.controller.ts
if [ -f "repo/apps/api/src/modules/admin/controllers/rollout.controller.ts" ]; then
  add_row "T06-F3" "Fichier rollout.controller.ts existe" "PASS" "Cree"
else
  add_row "T06-F3" "Fichier rollout.controller.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T06-V1: Router percentage-based (P0)
echo "  Verifying T06-V1 : Router percentage-based..."
add_row "T06-V1" "Router percentage-based" "WARN" "(P0) Voir B-29 Tache 7.1.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V2: Deterministic per input (P0)
echo "  Verifying T06-V2 : Deterministic per input..."
add_row "T06-V2" "Deterministic per input" "WARN" "(P0) Voir B-29 Tache 7.1.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V3: Endpoint admin set rollout (P0)
echo "  Verifying T06-V3 : Endpoint admin set rollout..."
add_row "T06-V3" "Endpoint admin set rollout" "WARN" "(P0) Voir B-29 Tache 7.1.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V4: Audit changes (P0)
echo "  Verifying T06-V4 : Audit changes..."
add_row "T06-V4" "Audit changes" "WARN" "(P0) Voir B-29 Tache 7.1.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V5: Tests 8+ scenarios (P0)
echo "  Verifying T06-V5 : Tests 8+ scenarios..."
add_row "T06-V5" "Tests 8+ scenarios" "WARN" "(P0) Voir B-29 Tache 7.1.6 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 7/4 -- 7.1.7 : Migration Validation : 100 Mock vs Real

```bash
echo ""
echo "================================================"
echo "TACHE 7.1.7 : Migration Validation : 100 Mock vs Real"
echo "Priorite : P0 | Effort : 7h"
echo "Criteres a verifier : 4"
echo "================================================"

# === Verification fichiers crees ===
# Test T07-F1: Existence fichier repo/infrastructure/scripts/validate-skalean-ai-migration.ts
if [ -f "repo/infrastructure/scripts/validate-skalean-ai-migration.ts" ]; then
  add_row "T07-F1" "Fichier validate-skalean-ai-migration.ts existe" "PASS" "Cree"
else
  add_row "T07-F1" "Fichier validate-skalean-ai-migration.ts existe" "FAIL" "Manquant"
fi
# Test T07-F2: Existence fichier repo/infrastructure/scripts/migration-validation-report.template.html
if [ -f "repo/infrastructure/scripts/migration-validation-report.template.html" ]; then
  add_row "T07-F2" "Fichier migration-validation-report.template.html existe" "PASS" "Cree"
else
  add_row "T07-F2" "Fichier migration-validation-report.template.html existe" "FAIL" "Manquant"
fi
# Test T07-F3: Existence fichier repo/infrastructure/fixtures/ia-estimation-100-validation.json
if [ -f "repo/infrastructure/fixtures/ia-estimation-100-validation.json" ]; then
  add_row "T07-F3" "Fichier ia-estimation-100-validation.json existe" "PASS" "Cree"
else
  add_row "T07-F3" "Fichier ia-estimation-100-validation.json existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T07-V1: Script execute 100 inputs (P0)
echo "  Verifying T07-V1 : Script execute 100 inputs..."
add_row "T07-V1" "Script execute 100 inputs" "WARN" "(P0) Voir B-29 Tache 7.1.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V2: Report HTML genere (P0)
echo "  Verifying T07-V2 : Report HTML genere..."
add_row "T07-V2" "Report HTML genere" "WARN" "(P0) Voir B-29 Tache 7.1.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V3: Acceptance criteria documente (P0)
echo "  Verifying T07-V3 : Acceptance criteria documente..."
add_row "T07-V3" "Acceptance criteria documente" "WARN" "(P0) Voir B-29 Tache 7.1.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V4: Sandbox env separate (P0)
echo "  Verifying T07-V4 : Sandbox env separate..."
add_row "T07-V4" "Sandbox env separate" "WARN" "(P0) Voir B-29 Tache 7.1.7 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 8/3 -- 7.1.8 : Performance Comparison Benchmarks

```bash
echo ""
echo "================================================"
echo "TACHE 7.1.8 : Performance Comparison Benchmarks"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 3"
echo "================================================"

# === Verification fichiers crees ===
# Test T08-F1: Existence fichier repo/infrastructure/scripts/benchmark-skalean-ai-performance.ts
if [ -f "repo/infrastructure/scripts/benchmark-skalean-ai-performance.ts" ]; then
  add_row "T08-F1" "Fichier benchmark-skalean-ai-performance.ts existe" "PASS" "Cree"
else
  add_row "T08-F1" "Fichier benchmark-skalean-ai-performance.ts existe" "FAIL" "Manquant"
fi
# Test T08-F2: Existence fichier repo/infrastructure/scripts/benchmark-skalean-ai-accuracy.ts
if [ -f "repo/infrastructure/scripts/benchmark-skalean-ai-accuracy.ts" ]; then
  add_row "T08-F2" "Fichier benchmark-skalean-ai-accuracy.ts existe" "PASS" "Cree"
else
  add_row "T08-F2" "Fichier benchmark-skalean-ai-accuracy.ts existe" "FAIL" "Manquant"
fi
# Test T08-F3: Existence fichier repo/infrastructure/fixtures/100-annotated-scenarios.json
if [ -f "repo/infrastructure/fixtures/100-annotated-scenarios.json" ]; then
  add_row "T08-F3" "Fichier 100-annotated-scenarios.json existe" "PASS" "Cree"
else
  add_row "T08-F3" "Fichier 100-annotated-scenarios.json existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T08-V1: Benchmarks executes (P0)
echo "  Verifying T08-V1 : Benchmarks executes..."
add_row "T08-V1" "Benchmarks executes" "WARN" "(P0) Voir B-29 Tache 7.1.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V2: Reports generes (P0)
echo "  Verifying T08-V2 : Reports generes..."
add_row "T08-V2" "Reports generes" "WARN" "(P0) Voir B-29 Tache 7.1.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V3: Insights documentes (latency vs accuracy trade-off) (P0)
echo "  Verifying T08-V3 : Insights documentes (latency vs accuracy trade-off)..."
add_row "T08-V3" "Insights documentes (latency vs accuracy trade-off)" "WARN" "(P0) Voir B-29 Tache 7.1.8 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 9/4 -- 7.1.9 : Rollback Procedure

```bash
echo ""
echo "================================================"
echo "TACHE 7.1.9 : Rollback Procedure"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 4"
echo "================================================"

# === Verification fichiers crees ===
# Test T09-F1: Existence fichier repo/docs/skalean-ai-rollback-procedure.md
if [ -f "repo/docs/skalean-ai-rollback-procedure.md" ]; then
  add_row "T09-F1" "Fichier skalean-ai-rollback-procedure.md existe" "PASS" "Cree"
else
  add_row "T09-F1" "Fichier skalean-ai-rollback-procedure.md existe" "FAIL" "Manquant"
fi
# Test T09-F2: Existence fichier repo/docs/skalean-ai-incident-response-runbook.md
if [ -f "repo/docs/skalean-ai-incident-response-runbook.md" ]; then
  add_row "T09-F2" "Fichier skalean-ai-incident-response-runbook.md existe" "PASS" "Cree"
else
  add_row "T09-F2" "Fichier skalean-ai-incident-response-runbook.md existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T09-V1: Procedure complete (P0)
echo "  Verifying T09-V1 : Procedure complete..."
add_row "T09-V1" "Procedure complete" "WARN" "(P0) Voir B-29 Tache 7.1.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V2: Decision tree clair (P0)
echo "  Verifying T09-V2 : Decision tree clair..."
add_row "T09-V2" "Decision tree clair" "WARN" "(P0) Voir B-29 Tache 7.1.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V3: Tests rollback < 60s (P0)
echo "  Verifying T09-V3 : Tests rollback < 60s..."
add_row "T09-V3" "Tests rollback < 60s" "WARN" "(P0) Voir B-29 Tache 7.1.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V4: Runbook ops (P0)
echo "  Verifying T09-V4 : Runbook ops..."
add_row "T09-V4" "Runbook ops" "WARN" "(P0) Voir B-29 Tache 7.1.9 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 10/4 -- 7.1.10 : Admin Dashboard Skalean AI

```bash
echo ""
echo "================================================"
echo "TACHE 7.1.10 : Admin Dashboard Skalean AI"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 4"
echo "================================================"

# === Verification fichiers crees ===
# Test T10-F1: Existence fichier repo/apps/web-insurtech-admin/app/[locale]/(protected)/ai-monitoring/skalean-ai/page.tsx
if [ -f "repo/apps/web-insurtech-admin/app/[locale]/(protected)/ai-monitoring/skalean-ai/page.tsx" ]; then
  add_row "T10-F1" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T10-F1" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T10-F2: Existence fichier repo/apps/web-insurtech-admin/components/ai-monitoring/{several charts}.tsx
if [ -f "repo/apps/web-insurtech-admin/components/ai-monitoring/{several charts}.tsx" ]; then
  add_row "T10-F2" "Fichier {several charts}.tsx existe" "PASS" "Cree"
else
  add_row "T10-F2" "Fichier {several charts}.tsx existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T10-V1: Dashboard complet (P0)
echo "  Verifying T10-V1 : Dashboard complet..."
add_row "T10-V1" "Dashboard complet" "WARN" "(P0) Voir B-29 Tache 7.1.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V2: Real-time refresh (P0)
echo "  Verifying T10-V2 : Real-time refresh..."
add_row "T10-V2" "Real-time refresh" "WARN" "(P0) Voir B-29 Tache 7.1.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V3: Actions admin (P0)
echo "  Verifying T10-V3 : Actions admin..."
add_row "T10-V3" "Actions admin" "WARN" "(P0) Voir B-29 Tache 7.1.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V4: Tests 5+ scenarios (P0)
echo "  Verifying T10-V4 : Tests 5+ scenarios..."
add_row "T10-V4" "Tests 5+ scenarios" "WARN" "(P0) Voir B-29 Tache 7.1.10 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 11/2 -- 7.1.11 : Documentation Finale

```bash
echo ""
echo "================================================"
echo "TACHE 7.1.11 : Documentation Finale"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 2"
echo "================================================"

# === Verification fichiers crees ===
# Test T11-F1: Existence fichier repo/docs/skalean-ai-integration-architecture.md
if [ -f "repo/docs/skalean-ai-integration-architecture.md" ]; then
  add_row "T11-F1" "Fichier skalean-ai-integration-architecture.md existe" "PASS" "Cree"
else
  add_row "T11-F1" "Fichier skalean-ai-integration-architecture.md existe" "FAIL" "Manquant"
fi
# Test T11-F2: Existence fichier repo/docs/skalean-ai-onboarding-guide.md
if [ -f "repo/docs/skalean-ai-onboarding-guide.md" ]; then
  add_row "T11-F2" "Fichier skalean-ai-onboarding-guide.md existe" "PASS" "Cree"
else
  add_row "T11-F2" "Fichier skalean-ai-onboarding-guide.md existe" "FAIL" "Manquant"
fi
# Test T11-F3: Existence fichier repo/docs/skalean-ai-cost-optimization.md
if [ -f "repo/docs/skalean-ai-cost-optimization.md" ]; then
  add_row "T11-F3" "Fichier skalean-ai-cost-optimization.md existe" "PASS" "Cree"
else
  add_row "T11-F3" "Fichier skalean-ai-cost-optimization.md existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T11-V1: 3 documents complets (P0)
echo "  Verifying T11-V1 : 3 documents complets..."
add_row "T11-V1" "3 documents complets" "WARN" "(P0) Voir B-29 Tache 7.1.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V2: Diagrams clairs (P0)
echo "  Verifying T11-V2 : Diagrams clairs..."
add_row "T11-V2" "Diagrams clairs" "WARN" "(P0) Voir B-29 Tache 7.1.11 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 12/4 -- 7.1.12 : Tests Integration End-to-End

```bash
echo ""
echo "================================================"
echo "TACHE 7.1.12 : Tests Integration End-to-End"
echo "Priorite : P0 | Effort : 9h"
echo "Criteres a verifier : 4"
echo "================================================"

# === Verification fichiers crees ===
# Test T12-F1: Existence fichier repo/apps/api/test/integration/skalean-ai/{15+ specs}.e2e-spec.ts
if [ -f "repo/apps/api/test/integration/skalean-ai/{15+ specs}.e2e-spec.ts" ]; then
  add_row "T12-F1" "Fichier {15+ specs}.e2e-spec.ts existe" "PASS" "Cree"
else
  add_row "T12-F1" "Fichier {15+ specs}.e2e-spec.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T12-V1: 15+ tests passent (P0)
echo "  Verifying T12-V1 : 15+ tests passent..."
add_row "T12-V1" "15+ tests passent" "WARN" "(P0) Voir B-29 Tache 7.1.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V2: Sandbox integration green (P0)
echo "  Verifying T12-V2 : Sandbox integration green..."
add_row "T12-V2" "Sandbox integration green" "WARN" "(P0) Voir B-29 Tache 7.1.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V3: CI green (P0)
echo "  Verifying T12-V3 : CI green..."
add_row "T12-V3" "CI green" "WARN" "(P0) Voir B-29 Tache 7.1.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V4: Reproducibility 5x (P0)
echo "  Verifying T12-V4 : Reproducibility 5x..."
add_row "T12-V4" "Reproducibility 5x" "WARN" "(P0) Voir B-29 Tache 7.1.12 pour test detaille - critere a auto-tester via script ad-hoc"

```

---


---


## VERIFICATIONS TRANSVERSALES SPRINT 29

### TR-BUILD : Build complet du sprint

```bash
echo ""
echo "================================================"
echo "VERIFICATIONS TRANSVERSALES SPRINT 29"
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

### TR-SKALEAN-AI : Service Skalean AI accessible

```bash
echo "=== TR-SKALEAN-AI : Skalean AI ==="
AI_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "$SKALEAN_AI_BASE_URL/health" -H "Authorization: Bearer $SKALEAN_AI_API_KEY" || echo 0)
if [ "$AI_HEALTH" -eq 200 ]; then
  add_row "TR-AI" "Skalean AI service accessible" "PASS" "200 OK"
else
  add_row "TR-AI" "Skalean AI service accessible" "WARN" "HTTP $AI_HEALTH (verifier credentials)"
fi
```



---

## GENERATION DU RAPPORT FINAL

```bash
echo ""
echo "================================================"
echo "GENERATION DU RAPPORT FINAL SPRINT 29"
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

## Jalon GO/NO-GO Sprint 29

EOF

# Calcul statut final
if (( $(echo "$SCORE >= 95" | bc -l) )); then
  STATUT="GO"
  cat >> "$REPORT_FILE" << EOF
**STATUT** : GO -- Sprint 29 valide, passage Sprint 30 autorise

Le sprint a passe les criteres requis. Cowork peut demarrer Sprint 30.

EOF
  echo ""
  echo "================================================"
  echo "SPRINT 29 : GO ($SCORE%)"
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
  echo "SPRINT 29 : GO CONDITIONNEL ($SCORE%)"
  echo "================================================"
else
  STATUT="NO-GO"
  cat >> "$REPORT_FILE" << EOF
**STATUT** : NO-GO -- Score $SCORE% trop bas (cible 85% minimum)

Le sprint **doit etre repris** :
- Lister tous FAIL P0
- Escalation Saad/Abla decision (cut scope OR delai)
- Reprise sprint avant Sprint 30

EOF
  echo ""
  echo "================================================"
  echo "SPRINT 29 : NO-GO ($SCORE%)"
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
  echo "git commit -m \"chore(sprint-29): close sprint 29 -- $STATUT ($SCORE%)\"" >> "$REPORT_FILE"
  echo '```' >> "$REPORT_FILE"
fi

echo ""
echo "Rapport complet dans : $REPORT_FILE"
```

---

## INSTRUCTION FINALE A CLAUDE CODE / COWORK

Apres l'execution complete des verifications ci-dessus :

1. **Lis le contenu de `sprint29-verify-report.md`** integralement
2. **Identifie les FAIL critiques** (criteres P0) qui necessitent intervention manuelle
3. **Affiche un resume executif** :
   - Nombre total de criteres
   - Pourcentage PASS / PASS\* / FAIL / WARN
   - Liste des FAIL avec contexte technique
   - Recommandation : GO / GO CONDITIONNEL / NO-GO
4. **Si NO-GO** : ne pas demarrer le Sprint suivant, alerter Saad/Abla via Slack `#insurtech-dev`
5. **Si GO ou GO CONDITIONNEL** : produire le commit de cloture du sprint :

```bash
git add skalean-insurtech/sprint29-verify-report.md
git commit -m "chore(sprint-29): close sprint 29 with verification report

- Verification automatique executee
- Score global : <SCORE>%
- <PASS> criteres PASS, <PASS_REPAIRED> reparations auto, <FAIL> FAIL
- Statut : <GO|GO CONDITIONNEL|NO-GO>

Phase: 7 -- Hardening + Integrations + Pilote
Sprint: 29 (Phase 7 / Sprint 1)
Reference B-29, C-29, V-29
Report: sprint29-verify-report.md"
```

6. **Documentation continue** : si decisions techniques prises pendant verification, ajouter notes dans `repo/docs/runbooks/sprint-29-lessons-learned.md`

---

**Fin de la verification V-29 v2.2 detaillee -- Sprint 29 (7.1) Skalean AI REST Integration (swap Mock -> Real).**

**Total criteres taches** : 51 | **Total transversaux** : ~10 | **Effort sprint** : 70h
