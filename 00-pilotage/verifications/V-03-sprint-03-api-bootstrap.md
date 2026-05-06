# VERIFICATION SPRINT 3 -- Phase 1 / Sprint 3 : API Bootstrap NestJS
# Version : Auto-reparation active + Rapport final MD detaille
# 15 taches, 124 criteres extraits B-03
# AUCUNE EMOJI AUTORISEE

**Version** : v2.2 (verification detaillee)
**Phase** : 1 -- Bootstrap Infrastructure
**Sprint** : 3 / 35 (cumul) -- Sprint 3 dans Phase 1
**Reference meta-prompt** : `B-03-sprint-03-api-bootstrap.md`
**Reference orchestrateur** : `C-03-sprint-03-api-bootstrap.md`
**Total criteres** : 124 criteres taches + ~10 transversaux

---

Tu es **Claude Code (ou Cowork)**. Tu dois executer une **verification COMPLETE et EXHAUSTIVE** du Sprint 3 apres execution toutes les 15 taches.

---

## REGLES D'EXECUTION

1. Tu **executes CHAQUE verification dans l'ordre** (taches puis transversales)
2. Quand une verification echoue, tu **TENTES UNE REPARATION AUTOMATIQUE** avant de noter FAIL
3. Apres chaque tentative de reparation, tu **re-executes la verification**
4. Tu consignes dans `sprint03-verify-report.md` **TOUS les resultats** au fil de l'execution
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
REPORT_FILE="sprint03-verify-report.md"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
RUN_ID=$(date '+%Y%m%d-%H%M%S')

cat > "$REPORT_FILE" << EOF
# Rapport de Verification - Sprint 3 : API Bootstrap NestJS

**Date** : $TIMESTAMP
**Run ID** : $RUN_ID
**Phase** : 1 -- Bootstrap Infrastructure
**Sprint** : 3 (Phase 1 / Sprint 3)
**Reference B-03** : 15 taches, 124 criteres extraits
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

## VERIFICATIONS PAR TACHE (15 taches)

## TACHE 1/8 -- 1.3.1 : NestJS 10.4 + Fastify Adapter Setup

```bash
echo ""
echo "================================================"
echo "TACHE 1.3.1 : NestJS 10.4 + Fastify Adapter Setup"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 8"
echo "================================================"

# === Verification fichiers crees ===
# Test T01-F1: Existence fichier repo/apps/api/package.json
if [ -f "repo/apps/api/package.json" ]; then
  add_row "T01-F1" "Fichier package.json existe" "PASS" "Cree"
else
  add_row "T01-F1" "Fichier package.json existe" "FAIL" "Manquant"
fi
# Test T01-F2: Existence fichier repo/apps/api/tsconfig.json
if [ -f "repo/apps/api/tsconfig.json" ]; then
  add_row "T01-F2" "Fichier tsconfig.json existe" "PASS" "Cree"
else
  add_row "T01-F2" "Fichier tsconfig.json existe" "FAIL" "Manquant"
fi
# Test T01-F3: Existence fichier repo/apps/api/nest-cli.json
if [ -f "repo/apps/api/nest-cli.json" ]; then
  add_row "T01-F3" "Fichier nest-cli.json existe" "PASS" "Cree"
else
  add_row "T01-F3" "Fichier nest-cli.json existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T01-V1: 'pnpm --filter @insurtech/api dev' reussit (P0)
echo "  Verifying T01-V1 : 'pnpm --filter @insurtech/api dev' reussit..."
add_row "T01-V1" "'pnpm --filter @insurtech/api dev' reussit" "WARN" "(P0) Voir B-03 Tache 1.3.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V2: App demarre en < 5s (P0)
echo "  Verifying T01-V2 : App demarre en < 5s..."
add_row "T01-V2" "App demarre en < 5s" "WARN" "(P0) Voir B-03 Tache 1.3.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V3: 'curl http://localhost:4000/' retourne JSON valide (P0)
echo "  Verifying T01-V3 : 'curl http://localhost:4000/' retourne JSON valide..."
add_row "T01-V3" "'curl http://localhost:4000/' retourne JSON valide" "WARN" "(P0) Voir B-03 Tache 1.3.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V4: 'kill -SIGTERM <pid>' -> exit code 0 en < 30s (P0)
echo "  Verifying T01-V4 : 'kill -SIGTERM <pid>' -> exit code 0 en < 30s..."
add_row "T01-V4" "'kill -SIGTERM <pid>' -> exit code 0 en < 30s" "WARN" "(P0) Voir B-03 Tache 1.3.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V5: Telemetry initialise AVANT app NestJS (P0)
echo "  Verifying T01-V5 : Telemetry initialise AVANT app NestJS..."
add_row "T01-V5" "Telemetry initialise AVANT app NestJS" "WARN" "(P0) Voir B-03 Tache 1.3.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V6: Body > 10MB rejete (HTTP 413) (P0)
echo "  Verifying T01-V6 : Body > 10MB rejete (HTTP 413)..."
add_row "T01-V6" "Body > 10MB rejete (HTTP 413)" "WARN" "(P0) Voir B-03 Tache 1.3.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V7: 'trustProxy' actif (header X-Forwarded-For respecte) (P0)
echo "  Verifying T01-V7 : 'trustProxy' actif (header X-Forwarded-For respecte)..."
add_row "T01-V7" "'trustProxy' actif (header X-Forwarded-For respecte)" "WARN" "(P0) Voir B-03 Tache 1.3.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V8: Tests E2E basique (Tache 1.3.15) : GET / retourne 200 (P1)
echo "  Verifying T01-V8 : Tests E2E basique (Tache 1.3.15) : GET / retourne 200..."
add_row "T01-V8" "Tests E2E basique (Tache 1.3.15) : GET / retourne 200" "WARN" "(P1) Voir B-03 Tache 1.3.1 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 2/7 -- 1.3.2 : AppModule + ConfigModule + Structure Modulaire

```bash
echo ""
echo "================================================"
echo "TACHE 1.3.2 : AppModule + ConfigModule + Structure Modulaire"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 7"
echo "================================================"

# === Verification fichiers crees ===
# Test T02-F1: Existence fichier repo/apps/api/src/app.module.ts
if [ -f "repo/apps/api/src/app.module.ts" ]; then
  add_row "T02-F1" "Fichier app.module.ts existe" "PASS" "Cree"
else
  add_row "T02-F1" "Fichier app.module.ts existe" "FAIL" "Manquant"
fi
# Test T02-F2: Existence fichier repo/apps/api/src/config/config.module.ts
if [ -f "repo/apps/api/src/config/config.module.ts" ]; then
  add_row "T02-F2" "Fichier config.module.ts existe" "PASS" "Cree"
else
  add_row "T02-F2" "Fichier config.module.ts existe" "FAIL" "Manquant"
fi
# Test T02-F3: Existence fichier repo/apps/api/src/config/config.service.ts
if [ -f "repo/apps/api/src/config/config.service.ts" ]; then
  add_row "T02-F3" "Fichier config.service.ts existe" "PASS" "Cree"
else
  add_row "T02-F3" "Fichier config.service.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T02-V1: 'pnpm --filter @insurtech/api build' compile sans erreur (P0)
echo "  Verifying T02-V1 : 'pnpm --filter @insurtech/api build' compile sans erreur..."
add_row "T02-V1" "'pnpm --filter @insurtech/api build' compile sans erreur" "WARN" "(P0) Voir B-03 Tache 1.3.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V2: 'pnpm --filter @insurtech/api dev' demarre, AppModule charge tous les sub-modules (P0)
echo "  Verifying T02-V2 : 'pnpm --filter @insurtech/api dev' demarre, AppModule charge tous les ..."
add_row "T02-V2" "'pnpm --filter @insurtech/api dev' demarre, AppModule charge tous les sub-modules" "WARN" "(P0) Voir B-03 Tache 1.3.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V3: ConfigService injectable depuis n'importe quel service NestJS (P0)
echo "  Verifying T02-V3 : ConfigService injectable depuis n'importe quel service NestJS..."
add_row "T02-V3" "ConfigService injectable depuis n'importe quel service NestJS" "WARN" "(P0) Voir B-03 Tache 1.3.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V4: DataSource accessible depuis n'importe quel service (P0)
echo "  Verifying T02-V4 : DataSource accessible depuis n'importe quel service..."
add_row "T02-V4" "DataSource accessible depuis n'importe quel service" "WARN" "(P0) Voir B-03 Tache 1.3.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V5: 19 modules metier stubs presents (verifier 'ls modules/') (P0)
echo "  Verifying T02-V5 : 19 modules metier stubs presents (verifier 'ls modules/')..."
add_row "T02-V5" "19 modules metier stubs presents (verifier 'ls modules/')" "WARN" "(P0) Voir B-03 Tache 1.3.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V6: Pas de circular import detecte au build (P0)
echo "  Verifying T02-V6 : Pas de circular import detecte au build..."
add_row "T02-V6" "Pas de circular import detecte au build" "WARN" "(P0) Voir B-03 Tache 1.3.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V7: Modules metier annotes '@Global()' quand pertinent (P1)
echo "  Verifying T02-V7 : Modules metier annotes '@Global()' quand pertinent..."
add_row "T02-V7" "Modules metier annotes '@Global()' quand pertinent" "WARN" "(P1) Voir B-03 Tache 1.3.2 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 3/7 -- 1.3.3 : Pino Logger Integration via nestjs-pino

```bash
echo ""
echo "================================================"
echo "TACHE 1.3.3 : Pino Logger Integration via nestjs-pino"
echo "Priorite : P0 | Effort : 3h"
echo "Criteres a verifier : 7"
echo "================================================"

# === Verification fichiers crees ===
# Test T03-F1: Existence fichier repo/apps/api/src/app.module.ts
if [ -f "repo/apps/api/src/app.module.ts" ]; then
  add_row "T03-F1" "Fichier app.module.ts existe" "PASS" "Cree"
else
  add_row "T03-F1" "Fichier app.module.ts existe" "FAIL" "Manquant"
fi
# Test T03-F2: Existence fichier repo/apps/api/src/main.ts
if [ -f "repo/apps/api/src/main.ts" ]; then
  add_row "T03-F2" "Fichier main.ts existe" "PASS" "Cree"
else
  add_row "T03-F2" "Fichier main.ts existe" "FAIL" "Manquant"
fi
# Test T03-F3: Existence fichier repo/apps/api/package.json
if [ -f "repo/apps/api/package.json" ]; then
  add_row "T03-F3" "Fichier package.json existe" "PASS" "Cree"
else
  add_row "T03-F3" "Fichier package.json existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T03-V1: Logs au format JSON structured (parse-able par jq) (P0)
echo "  Verifying T03-V1 : Logs au format JSON structured (parse-able par jq)..."
add_row "T03-V1" "Logs au format JSON structured (parse-able par jq)" "WARN" "(P0) Voir B-03 Tache 1.3.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V2: Chaque request HTTP logge avec method/url/status/duration (P0)
echo "  Verifying T03-V2 : Chaque request HTTP logge avec method/url/status/duration..."
add_row "T03-V2" "Chaque request HTTP logge avec method/url/status/duration" "WARN" "(P0) Voir B-03 Tache 1.3.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V3: PII redaction active (test : header 'Authorization: Bearer XYZ' pas log en plain text) (P0)
echo "  Verifying T03-V3 : PII redaction active (test : header 'Authorization: Bearer XYZ' pas lo..."
add_row "T03-V3" "PII redaction active (test : header 'Authorization: Bearer XYZ' pas log en plain text)" "WARN" "(P0) Voir B-03 Tache 1.3.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V4: Pretty printing actif si NODE_ENV=development (P0)
echo "  Verifying T03-V4 : Pretty printing actif si NODE_ENV=development..."
add_row "T03-V4" "Pretty printing actif si NODE_ENV=development" "WARN" "(P0) Voir B-03 Tache 1.3.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V5: Boot log emit (P0)
echo "  Verifying T03-V5 : Boot log emit..."
add_row "T03-V5" "Boot log emit" "WARN" "(P0) Voir B-03 Tache 1.3.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V6: Shutdown log emit (P0)
echo "  Verifying T03-V6 : Shutdown log emit..."
add_row "T03-V6" "Shutdown log emit" "WARN" "(P0) Voir B-03 Tache 1.3.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V7: Trace ID present dans logs (necessite Tache 1.3.4) (P1)
echo "  Verifying T03-V7 : Trace ID present dans logs (necessite Tache 1.3.4)..."
add_row "T03-V7" "Trace ID present dans logs (necessite Tache 1.3.4)" "WARN" "(P1) Voir B-03 Tache 1.3.3 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 4/8 -- 1.3.4 : OpenTelemetry Traces + RequestContextMiddleware

```bash
echo ""
echo "================================================"
echo "TACHE 1.3.4 : OpenTelemetry Traces + RequestContextMiddleware"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 8"
echo "================================================"

# === Verification fichiers crees ===
# Test T04-F1: Existence fichier repo/apps/api/src/common/context/request-context.ts
if [ -f "repo/apps/api/src/common/context/request-context.ts" ]; then
  add_row "T04-F1" "Fichier request-context.ts existe" "PASS" "Cree"
else
  add_row "T04-F1" "Fichier request-context.ts existe" "FAIL" "Manquant"
fi
# Test T04-F2: Existence fichier repo/apps/api/src/common/middleware/request-context.middleware.ts
if [ -f "repo/apps/api/src/common/middleware/request-context.middleware.ts" ]; then
  add_row "T04-F2" "Fichier request-context.middleware.ts existe" "PASS" "Cree"
else
  add_row "T04-F2" "Fichier request-context.middleware.ts existe" "FAIL" "Manquant"
fi
# Test T04-F3: Existence fichier repo/apps/api/src/app.module.ts
if [ -f "repo/apps/api/src/app.module.ts" ]; then
  add_row "T04-F3" "Fichier app.module.ts existe" "PASS" "Cree"
else
  add_row "T04-F3" "Fichier app.module.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T04-V1: Middleware installe, applique sur ALL routes (P0)
echo "  Verifying T04-V1 : Middleware installe, applique sur ALL routes..."
add_row "T04-V1" "Middleware installe, applique sur ALL routes" "WARN" "(P0) Voir B-03 Tache 1.3.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V2: 'getRequestContext()' retourne contexte dans services downstream (P0)
echo "  Verifying T04-V2 : 'getRequestContext()' retourne contexte dans services downstream..."
add_row "T04-V2" "'getRequestContext()' retourne contexte dans services downstream" "WARN" "(P0) Voir B-03 Tache 1.3.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V3: Header 'x-trace-id' injecte sur response (P0)
echo "  Verifying T04-V3 : Header 'x-trace-id' injecte sur response..."
add_row "T04-V3" "Header 'x-trace-id' injecte sur response" "WARN" "(P0) Voir B-03 Tache 1.3.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V4: Header 'x-tenant-id' invalide (pas UUID) rejete HTTP 400 (P0)
echo "  Verifying T04-V4 : Header 'x-tenant-id' invalide (pas UUID) rejete HTTP 400..."
add_row "T04-V4" "Header 'x-tenant-id' invalide (pas UUID) rejete HTTP 400" "WARN" "(P0) Voir B-03 Tache 1.3.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V5: Async context propage : un setTimeout dans service voit le meme contexte (P0)
echo "  Verifying T04-V5 : Async context propage : un setTimeout dans service voit le meme contex..."
add_row "T04-V5" "Async context propage : un setTimeout dans service voit le meme contexte" "WARN" "(P0) Voir B-03 Tache 1.3.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V6: Span OTEL contient attributes tenant.id + user.id (P0)
echo "  Verifying T04-V6 : Span OTEL contient attributes tenant.id + user.id..."
add_row "T04-V6" "Span OTEL contient attributes tenant.id + user.id" "WARN" "(P0) Voir B-03 Tache 1.3.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V7: 2 requests concurrents ont contextes isoles (pas de leak) (P0)
echo "  Verifying T04-V7 : 2 requests concurrents ont contextes isoles (pas de leak)..."
add_row "T04-V7" "2 requests concurrents ont contextes isoles (pas de leak)" "WARN" "(P0) Voir B-03 Tache 1.3.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V8: Tests unitaires + E2E passent (P1)
echo "  Verifying T04-V8 : Tests unitaires + E2E passent..."
add_row "T04-V8" "Tests unitaires + E2E passent" "WARN" "(P1) Voir B-03 Tache 1.3.4 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 5/8 -- 1.3.5 : Helmet + CORS Strict + Compression + Body Limit

```bash
echo ""
echo "================================================"
echo "TACHE 1.3.5 : Helmet + CORS Strict + Compression + Body Limit"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 8"
echo "================================================"

# === Verification fichiers crees ===
# Test T05-F1: Existence fichier repo/apps/api/src/main.ts
if [ -f "repo/apps/api/src/main.ts" ]; then
  add_row "T05-F1" "Fichier main.ts existe" "PASS" "Cree"
else
  add_row "T05-F1" "Fichier main.ts existe" "FAIL" "Manquant"
fi
# Test T05-F2: Existence fichier repo/apps/api/src/common/security/cors.config.ts
if [ -f "repo/apps/api/src/common/security/cors.config.ts" ]; then
  add_row "T05-F2" "Fichier cors.config.ts existe" "PASS" "Cree"
else
  add_row "T05-F2" "Fichier cors.config.ts existe" "FAIL" "Manquant"
fi
# Test T05-F3: Existence fichier repo/apps/api/src/common/security/helmet.config.ts
if [ -f "repo/apps/api/src/common/security/helmet.config.ts" ]; then
  add_row "T05-F3" "Fichier helmet.config.ts existe" "PASS" "Cree"
else
  add_row "T05-F3" "Fichier helmet.config.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T05-V1: Helmet headers presents : 'X-Content-Type-Options', 'X-Frame-Options', 'Strict-Transport-S (P0)
echo "  Verifying T05-V1 : Helmet headers presents : 'X-Content-Type-Options', 'X-Frame-Options',..."
add_row "T05-V1" "Helmet headers presents : 'X-Content-Type-Options', 'X-Frame-Options', 'Strict-Transport-S" "WARN" "(P0) Voir B-03 Tache 1.3.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V2: CORS allowlist actif : origin non-autorise rejete (HTTP 403 ou pas de Access-Control-* hea (P0)
echo "  Verifying T05-V2 : CORS allowlist actif : origin non-autorise rejete (HTTP 403 ou pas de ..."
add_row "T05-V2" "CORS allowlist actif : origin non-autorise rejete (HTTP 403 ou pas de Access-Control-* hea" "WARN" "(P0) Voir B-03 Tache 1.3.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V3: OPTIONS preflight retourne 204 avec CORS headers (P0)
echo "  Verifying T05-V3 : OPTIONS preflight retourne 204 avec CORS headers..."
add_row "T05-V3" "OPTIONS preflight retourne 204 avec CORS headers" "WARN" "(P0) Voir B-03 Tache 1.3.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V4: Compression active : 'Content-Encoding: br' ou 'gzip' sur responses > 1KB (P0)
echo "  Verifying T05-V4 : Compression active : 'Content-Encoding: br' ou 'gzip' sur responses > ..."
add_row "T05-V4" "Compression active : 'Content-Encoding: br' ou 'gzip' sur responses > 1KB" "WARN" "(P0) Voir B-03 Tache 1.3.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V5: Body 11MB rejete HTTP 413 (P0)
echo "  Verifying T05-V5 : Body 11MB rejete HTTP 413..."
add_row "T05-V5" "Body 11MB rejete HTTP 413" "WARN" "(P0) Voir B-03 Tache 1.3.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V6: 'X-Powered-By' absent (P0)
echo "  Verifying T05-V6 : 'X-Powered-By' absent..."
add_row "T05-V6" "'X-Powered-By' absent" "WARN" "(P0) Voir B-03 Tache 1.3.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V7: CSP strict en place (test : eval bloque par CSP) (P0)
echo "  Verifying T05-V7 : CSP strict en place (test : eval bloque par CSP)..."
add_row "T05-V7" "CSP strict en place (test : eval bloque par CSP)" "WARN" "(P0) Voir B-03 Tache 1.3.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V8: HSTS 'max-age=31536000' en prod (P1)
echo "  Verifying T05-V8 : HSTS 'max-age=31536000' en prod..."
add_row "T05-V8" "HSTS 'max-age=31536000' en prod" "WARN" "(P1) Voir B-03 Tache 1.3.5 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 6/7 -- 1.3.6 : ZodValidationPipe Global

```bash
echo ""
echo "================================================"
echo "TACHE 1.3.6 : ZodValidationPipe Global"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 7"
echo "================================================"

# === Verification fichiers crees ===
# Test T06-F1: Existence fichier repo/apps/api/src/common/pipes/zod-validation.pipe.ts
if [ -f "repo/apps/api/src/common/pipes/zod-validation.pipe.ts" ]; then
  add_row "T06-F1" "Fichier zod-validation.pipe.ts existe" "PASS" "Cree"
else
  add_row "T06-F1" "Fichier zod-validation.pipe.ts existe" "FAIL" "Manquant"
fi
# Test T06-F2: Existence fichier repo/apps/api/src/common/pipes/zod-validation.pipe.spec.ts
if [ -f "repo/apps/api/src/common/pipes/zod-validation.pipe.spec.ts" ]; then
  add_row "T06-F2" "Fichier zod-validation.pipe.spec.ts existe" "PASS" "Cree"
else
  add_row "T06-F2" "Fichier zod-validation.pipe.spec.ts existe" "FAIL" "Manquant"
fi
# Test T06-F3: Existence fichier repo/apps/api/src/common/dto/create-zod-dto.helper.ts
if [ -f "repo/apps/api/src/common/dto/create-zod-dto.helper.ts" ]; then
  add_row "T06-F3" "Fichier create-zod-dto.helper.ts existe" "PASS" "Cree"
else
  add_row "T06-F3" "Fichier create-zod-dto.helper.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T06-V1: POST body valide passe (P0)
echo "  Verifying T06-V1 : POST body valide passe..."
add_row "T06-V1" "POST body valide passe" "WARN" "(P0) Voir B-03 Tache 1.3.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V2: POST body invalide retourne HTTP 400 (P0)
echo "  Verifying T06-V2 : POST body invalide retourne HTTP 400..."
add_row "T06-V2" "POST body invalide retourne HTTP 400" "WARN" "(P0) Voir B-03 Tache 1.3.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V3: Erreur 400 contient liste fields invalides avec path + message (P0)
echo "  Verifying T06-V3 : Erreur 400 contient liste fields invalides avec path + message..."
add_row "T06-V3" "Erreur 400 contient liste fields invalides avec path + message" "WARN" "(P0) Voir B-03 Tache 1.3.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V4: Pipe applicable per-endpoint (different schema par route) (P0)
echo "  Verifying T06-V4 : Pipe applicable per-endpoint (different schema par route)..."
add_row "T06-V4" "Pipe applicable per-endpoint (different schema par route)" "WARN" "(P0) Voir B-03 Tache 1.3.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V5: 'createZodDto()' helper genere DTO class compatible Swagger (P0)
echo "  Verifying T06-V5 : 'createZodDto()' helper genere DTO class compatible Swagger..."
add_row "T06-V5" "'createZodDto()' helper genere DTO class compatible Swagger" "WARN" "(P0) Voir B-03 Tache 1.3.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V6: Tests pipe couvrent happy + error path (P0)
echo "  Verifying T06-V6 : Tests pipe couvrent happy + error path..."
add_row "T06-V6" "Tests pipe couvrent happy + error path" "WARN" "(P0) Voir B-03 Tache 1.3.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V7: Zod transform value transmise au controller (apres parse) (P1)
echo "  Verifying T06-V7 : Zod transform value transmise au controller (apres parse)..."
add_row "T06-V7" "Zod transform value transmise au controller (apres parse)" "WARN" "(P1) Voir B-03 Tache 1.3.6 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 7/7 -- 1.3.7 : ResponseInterceptor : Format API Standardise

```bash
echo ""
echo "================================================"
echo "TACHE 1.3.7 : ResponseInterceptor : Format API Standardise"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 7"
echo "================================================"

# === Verification fichiers crees ===
# Test T07-F1: Existence fichier repo/apps/api/src/common/interceptors/response.interceptor.ts
if [ -f "repo/apps/api/src/common/interceptors/response.interceptor.ts" ]; then
  add_row "T07-F1" "Fichier response.interceptor.ts existe" "PASS" "Cree"
else
  add_row "T07-F1" "Fichier response.interceptor.ts existe" "FAIL" "Manquant"
fi
# Test T07-F2: Existence fichier repo/apps/api/src/common/decorators/skip-response-wrap.decorator.ts
if [ -f "repo/apps/api/src/common/decorators/skip-response-wrap.decorator.ts" ]; then
  add_row "T07-F2" "Fichier skip-response-wrap.decorator.ts existe" "PASS" "Cree"
else
  add_row "T07-F2" "Fichier skip-response-wrap.decorator.ts existe" "FAIL" "Manquant"
fi
# Test T07-F3: Existence fichier repo/apps/api/src/common/interceptors/response.interceptor.spec.ts
if [ -f "repo/apps/api/src/common/interceptors/response.interceptor.spec.ts" ]; then
  add_row "T07-F3" "Fichier response.interceptor.spec.ts existe" "PASS" "Cree"
else
  add_row "T07-F3" "Fichier response.interceptor.spec.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T07-V1: GET endpoint retourne '{ data, meta }' avec traceId (P0)
echo "  Verifying T07-V1 : GET endpoint retourne '{ data, meta }' avec traceId..."
add_row "T07-V1" "GET endpoint retourne '{ data, meta }' avec traceId" "WARN" "(P0) Voir B-03 Tache 1.3.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V2: Array retourne '{ data: [...], meta: { total } }' (P0)
echo "  Verifying T07-V2 : Array retourne '{ data: [...], meta: { total } }'..."
add_row "T07-V2" "Array retourne '{ data: [...], meta: { total } }'" "WARN" "(P0) Voir B-03 Tache 1.3.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V3: Paginated '{ items, total, page }' retourne '{ data: items, meta: { pagination } }' (P0)
echo "  Verifying T07-V3 : Paginated '{ items, total, page }' retourne '{ data: items, meta: { pa..."
add_row "T07-V3" "Paginated '{ items, total, page }' retourne '{ data: items, meta: { pagination } }'" "WARN" "(P0) Voir B-03 Tache 1.3.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V4: '/healthz' non-wrap (return raw '{ status: 'ok' }') (P0)
echo "  Verifying T07-V4 : '/healthz' non-wrap (return raw '{ status: 'ok' }')..."
add_row "T07-V4" "'/healthz' non-wrap (return raw '{ status: 'ok' }')" "WARN" "(P0) Voir B-03 Tache 1.3.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V5: 'meta.timestamp' ISO 8601 (P0)
echo "  Verifying T07-V5 : 'meta.timestamp' ISO 8601..."
add_row "T07-V5" "'meta.timestamp' ISO 8601" "WARN" "(P0) Voir B-03 Tache 1.3.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V6: 'meta.traceId' correspond au header 'x-trace-id' (P0)
echo "  Verifying T07-V6 : 'meta.traceId' correspond au header 'x-trace-id'..."
add_row "T07-V6" "'meta.traceId' correspond au header 'x-trace-id'" "WARN" "(P0) Voir B-03 Tache 1.3.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V7: Tests unitaires couvrent 4+ scenarios (P0)
echo "  Verifying T07-V7 : Tests unitaires couvrent 4+ scenarios..."
add_row "T07-V7" "Tests unitaires couvrent 4+ scenarios" "WARN" "(P0) Voir B-03 Tache 1.3.7 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 8/10 -- 1.3.8 : ExceptionFilter Global : Erreurs Structurees + Redaction PII

```bash
echo ""
echo "================================================"
echo "TACHE 1.3.8 : ExceptionFilter Global : Erreurs Structurees + Redaction PII"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 10"
echo "================================================"

# === Verification fichiers crees ===
# Test T08-F1: Existence fichier repo/apps/api/src/common/filters/all-exceptions.filter.ts
if [ -f "repo/apps/api/src/common/filters/all-exceptions.filter.ts" ]; then
  add_row "T08-F1" "Fichier all-exceptions.filter.ts existe" "PASS" "Cree"
else
  add_row "T08-F1" "Fichier all-exceptions.filter.ts existe" "FAIL" "Manquant"
fi
# Test T08-F2: Existence fichier repo/apps/api/src/common/filters/all-exceptions.filter.spec.ts
if [ -f "repo/apps/api/src/common/filters/all-exceptions.filter.spec.ts" ]; then
  add_row "T08-F2" "Fichier all-exceptions.filter.spec.ts existe" "PASS" "Cree"
else
  add_row "T08-F2" "Fichier all-exceptions.filter.spec.ts existe" "FAIL" "Manquant"
fi
# Test T08-F3: Existence fichier repo/apps/api/src/common/errors/error-codes.ts
if [ -f "repo/apps/api/src/common/errors/error-codes.ts" ]; then
  add_row "T08-F3" "Fichier error-codes.ts existe" "PASS" "Cree"
else
  add_row "T08-F3" "Fichier error-codes.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T08-V1: HttpException retourne format '{ error, code, traceId }' (P0)
echo "  Verifying T08-V1 : HttpException retourne format '{ error, code, traceId }'..."
add_row "T08-V1" "HttpException retourne format '{ error, code, traceId }'" "WARN" "(P0) Voir B-03 Tache 1.3.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V2: Erreur inconnue catch, status 500, stack non-expose en prod (P0)
echo "  Verifying T08-V2 : Erreur inconnue catch, status 500, stack non-expose en prod..."
add_row "T08-V2" "Erreur inconnue catch, status 500, stack non-expose en prod" "WARN" "(P0) Voir B-03 Tache 1.3.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V3: Stack expose en dev (NODE_ENV=development) (P0)
echo "  Verifying T08-V3 : Stack expose en dev (NODE_ENV=development)..."
add_row "T08-V3" "Stack expose en dev (NODE_ENV=development)" "WARN" "(P0) Voir B-03 Tache 1.3.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V4: Validation Zod retourne 400 + 'details.fields' (P0)
echo "  Verifying T08-V4 : Validation Zod retourne 400 + 'details.fields'..."
add_row "T08-V4" "Validation Zod retourne 400 + 'details.fields'" "WARN" "(P0) Voir B-03 Tache 1.3.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V5: Logs Pino emit error level avec context complet (P0)
echo "  Verifying T08-V5 : Logs Pino emit error level avec context complet..."
add_row "T08-V5" "Logs Pino emit error level avec context complet" "WARN" "(P0) Voir B-03 Tache 1.3.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V6: Sentry capture pour status >= 500 (mock test) (P0)
echo "  Verifying T08-V6 : Sentry capture pour status >= 500 (mock test)..."
add_row "T08-V6" "Sentry capture pour status >= 500 (mock test)" "WARN" "(P0) Voir B-03 Tache 1.3.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V7: PII redaction : 'password' jamais dans response error (P0)
echo "  Verifying T08-V7 : PII redaction : 'password' jamais dans response error..."
add_row "T08-V7" "PII redaction : 'password' jamais dans response error" "WARN" "(P0) Voir B-03 Tache 1.3.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V8: Code erreur stable present (test : switch sur code marche) (P0)
echo "  Verifying T08-V8 : Code erreur stable present (test : switch sur code marche)..."
add_row "T08-V8" "Code erreur stable present (test : switch sur code marche)" "WARN" "(P0) Voir B-03 Tache 1.3.8 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 9/8 -- 1.3.9 : Swagger OpenAPI 3.0 Setup

```bash
echo ""
echo "================================================"
echo "TACHE 1.3.9 : Swagger OpenAPI 3.0 Setup"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 8"
echo "================================================"

# === Verification fichiers crees ===
# Test T09-F1: Existence fichier repo/apps/api/src/main.ts
if [ -f "repo/apps/api/src/main.ts" ]; then
  add_row "T09-F1" "Fichier main.ts existe" "PASS" "Cree"
else
  add_row "T09-F1" "Fichier main.ts existe" "FAIL" "Manquant"
fi
# Test T09-F2: Existence fichier repo/apps/api/src/common/swagger/swagger.config.ts
if [ -f "repo/apps/api/src/common/swagger/swagger.config.ts" ]; then
  add_row "T09-F2" "Fichier swagger.config.ts existe" "PASS" "Cree"
else
  add_row "T09-F2" "Fichier swagger.config.ts existe" "FAIL" "Manquant"
fi
# Test T09-F3: Existence fichier repo/apps/api/src/common/swagger/swagger-tags.ts
if [ -f "repo/apps/api/src/common/swagger/swagger-tags.ts" ]; then
  add_row "T09-F3" "Fichier swagger-tags.ts existe" "PASS" "Cree"
else
  add_row "T09-F3" "Fichier swagger-tags.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T09-V1: 'curl http://localhost:4000/docs' retourne HTML Swagger UI (P0)
echo "  Verifying T09-V1 : 'curl http://localhost:4000/docs' retourne HTML Swagger UI..."
add_row "T09-V1" "'curl http://localhost:4000/docs' retourne HTML Swagger UI" "WARN" "(P0) Voir B-03 Tache 1.3.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V2: 'curl http://localhost:4000/docs-json' retourne OpenAPI JSON valide (P0)
echo "  Verifying T09-V2 : 'curl http://localhost:4000/docs-json' retourne OpenAPI JSON valide..."
add_row "T09-V2" "'curl http://localhost:4000/docs-json' retourne OpenAPI JSON valide" "WARN" "(P0) Voir B-03 Tache 1.3.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V3: OpenAPI version 3.0 (P0)
echo "  Verifying T09-V3 : OpenAPI version 3.0..."
add_row "T09-V3" "OpenAPI version 3.0" "WARN" "(P0) Voir B-03 Tache 1.3.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V4: Tags catalog present (vide initialement, peuple Sprint 5+) (P0)
echo "  Verifying T09-V4 : Tags catalog present (vide initialement, peuple Sprint 5+)..."
add_row "T09-V4" "Tags catalog present (vide initialement, peuple Sprint 5+)" "WARN" "(P0) Voir B-03 Tache 1.3.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V5: Header 'x-tenant-id' documente comme parameter security global (P0)
echo "  Verifying T09-V5 : Header 'x-tenant-id' documente comme parameter security global..."
add_row "T09-V5" "Header 'x-tenant-id' documente comme parameter security global" "WARN" "(P0) Voir B-03 Tache 1.3.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V6: Format response '{ data, meta }' documente (P0)
echo "  Verifying T09-V6 : Format response '{ data, meta }' documente..."
add_row "T09-V6" "Format response '{ data, meta }' documente" "WARN" "(P0) Voir B-03 Tache 1.3.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V7: CSP relaxe sur /docs n'echoue pas (UI fonctionne) (P0)
echo "  Verifying T09-V7 : CSP relaxe sur /docs n'echoue pas (UI fonctionne)..."
add_row "T09-V7" "CSP relaxe sur /docs n'echoue pas (UI fonctionne)" "WARN" "(P0) Voir B-03 Tache 1.3.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V8: Theme Skalean applique (P1)
echo "  Verifying T09-V8 : Theme Skalean applique..."
add_row "T09-V8" "Theme Skalean applique" "WARN" "(P1) Voir B-03 Tache 1.3.9 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 10/8 -- 1.3.10 : HealthModule : /healthz et /readyz

```bash
echo ""
echo "================================================"
echo "TACHE 1.3.10 : HealthModule : /healthz et /readyz"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 8"
echo "================================================"

# === Verification fichiers crees ===
# Test T10-F1: Existence fichier repo/apps/api/src/modules/health/health.module.ts
if [ -f "repo/apps/api/src/modules/health/health.module.ts" ]; then
  add_row "T10-F1" "Fichier health.module.ts existe" "PASS" "Cree"
else
  add_row "T10-F1" "Fichier health.module.ts existe" "FAIL" "Manquant"
fi
# Test T10-F2: Existence fichier repo/apps/api/src/modules/health/health.controller.ts
if [ -f "repo/apps/api/src/modules/health/health.controller.ts" ]; then
  add_row "T10-F2" "Fichier health.controller.ts existe" "PASS" "Cree"
else
  add_row "T10-F2" "Fichier health.controller.ts existe" "FAIL" "Manquant"
fi
# Test T10-F3: Existence fichier repo/apps/api/src/modules/health/indicators/db-health.indicator.ts
if [ -f "repo/apps/api/src/modules/health/indicators/db-health.indicator.ts" ]; then
  add_row "T10-F3" "Fichier db-health.indicator.ts existe" "PASS" "Cree"
else
  add_row "T10-F3" "Fichier db-health.indicator.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T10-V1: 'curl /healthz' retourne 200 + '{ status: 'ok' }' (P0)
echo "  Verifying T10-V1 : 'curl /healthz' retourne 200 + '{ status: 'ok' }'..."
add_row "T10-V1" "'curl /healthz' retourne 200 + '{ status: 'ok' }'" "WARN" "(P0) Voir B-03 Tache 1.3.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V2: 'curl /readyz' retourne 200 + tous services up (P0)
echo "  Verifying T10-V2 : 'curl /readyz' retourne 200 + tous services up..."
add_row "T10-V2" "'curl /readyz' retourne 200 + tous services up" "WARN" "(P0) Voir B-03 Tache 1.3.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V3: Si DB stop : '/readyz' retourne 503 (P0)
echo "  Verifying T10-V3 : Si DB stop : '/readyz' retourne 503..."
add_row "T10-V3" "Si DB stop : '/readyz' retourne 503" "WARN" "(P0) Voir B-03 Tache 1.3.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V4: '/healthz' reste 200 meme si DB down (liveness) (P0)
echo "  Verifying T10-V4 : '/healthz' reste 200 meme si DB down (liveness)..."
add_row "T10-V4" "'/healthz' reste 200 meme si DB down (liveness)" "WARN" "(P0) Voir B-03 Tache 1.3.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V5: Cache 5s actif (verifier 2 calls successifs : second cache hit) (P0)
echo "  Verifying T10-V5 : Cache 5s actif (verifier 2 calls successifs : second cache hit)..."
add_row "T10-V5" "Cache 5s actif (verifier 2 calls successifs : second cache hit)" "WARN" "(P0) Voir B-03 Tache 1.3.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V6: Endpoints publics (pas d'auth required) (P0)
echo "  Verifying T10-V6 : Endpoints publics (pas d'auth required)..."
add_row "T10-V6" "Endpoints publics (pas d'auth required)" "WARN" "(P0) Voir B-03 Tache 1.3.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V7: Format response readyz documente Swagger (P0)
echo "  Verifying T10-V7 : Format response readyz documente Swagger..."
add_row "T10-V7" "Format response readyz documente Swagger" "WARN" "(P0) Voir B-03 Tache 1.3.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V8: Tests E2E couvrent les 4 scenarios (P1)
echo "  Verifying T10-V8 : Tests E2E couvrent les 4 scenarios..."
add_row "T10-V8" "Tests E2E couvrent les 4 scenarios" "WARN" "(P1) Voir B-03 Tache 1.3.10 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 11/8 -- 1.3.11 : BullMQ Integration : JobsModule

```bash
echo ""
echo "================================================"
echo "TACHE 1.3.11 : BullMQ Integration : JobsModule"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 8"
echo "================================================"

# === Verification fichiers crees ===
# Test T11-F1: Existence fichier repo/apps/api/src/modules/jobs/jobs.module.ts
if [ -f "repo/apps/api/src/modules/jobs/jobs.module.ts" ]; then
  add_row "T11-F1" "Fichier jobs.module.ts existe" "PASS" "Cree"
else
  add_row "T11-F1" "Fichier jobs.module.ts existe" "FAIL" "Manquant"
fi
# Test T11-F2: Existence fichier repo/apps/api/src/modules/jobs/job-producer.service.ts
if [ -f "repo/apps/api/src/modules/jobs/job-producer.service.ts" ]; then
  add_row "T11-F2" "Fichier job-producer.service.ts existe" "PASS" "Cree"
else
  add_row "T11-F2" "Fichier job-producer.service.ts existe" "FAIL" "Manquant"
fi
# Test T11-F3: Existence fichier repo/apps/api/src/modules/jobs/job-producer.service.spec.ts
if [ -f "repo/apps/api/src/modules/jobs/job-producer.service.spec.ts" ]; then
  add_row "T11-F3" "Fichier job-producer.service.spec.ts existe" "PASS" "Cree"
else
  add_row "T11-F3" "Fichier job-producer.service.spec.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T11-V1: Module charge sans erreur (P0)
echo "  Verifying T11-V1 : Module charge sans erreur..."
add_row "T11-V1" "Module charge sans erreur" "WARN" "(P0) Voir B-03 Tache 1.3.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V2: Connection Redis DB 2 etablie (P0)
echo "  Verifying T11-V2 : Connection Redis DB 2 etablie..."
add_row "T11-V2" "Connection Redis DB 2 etablie" "WARN" "(P0) Voir B-03 Tache 1.3.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V3: Test : creer queue, ajouter job, dummy worker process succes (P0)
echo "  Verifying T11-V3 : Test : creer queue, ajouter job, dummy worker process succes..."
add_row "T11-V3" "Test : creer queue, ajouter job, dummy worker process succes" "WARN" "(P0) Voir B-03 Tache 1.3.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V4: Default job options (3 retries) actifs (P0)
echo "  Verifying T11-V4 : Default job options (3 retries) actifs..."
add_row "T11-V4" "Default job options (3 retries) actifs" "WARN" "(P0) Voir B-03 Tache 1.3.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V5: Graceful shutdown drain queues (P0)
echo "  Verifying T11-V5 : Graceful shutdown drain queues..."
add_row "T11-V5" "Graceful shutdown drain queues" "WARN" "(P0) Voir B-03 Tache 1.3.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V6: Logs Pino sur job lifecycle (P0)
echo "  Verifying T11-V6 : Logs Pino sur job lifecycle..."
add_row "T11-V6" "Logs Pino sur job lifecycle" "WARN" "(P0) Voir B-03 Tache 1.3.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V7: BullDashboard accessible (auth pas encore Sprint 5) (P1)
echo "  Verifying T11-V7 : BullDashboard accessible (auth pas encore Sprint 5)..."
add_row "T11-V7" "BullDashboard accessible (auth pas encore Sprint 5)" "WARN" "(P1) Voir B-03 Tache 1.3.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V8: 'JobProducer.add()' valide payload via Zod si schema declare (P1)
echo "  Verifying T11-V8 : 'JobProducer.add()' valide payload via Zod si schema declare..."
add_row "T11-V8" "'JobProducer.add()' valide payload via Zod si schema declare" "WARN" "(P1) Voir B-03 Tache 1.3.11 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 12/8 -- 1.3.12 : Sentry Integration

```bash
echo ""
echo "================================================"
echo "TACHE 1.3.12 : Sentry Integration"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 8"
echo "================================================"

# === Verification fichiers crees ===
# Test T12-F1: Existence fichier repo/apps/api/src/common/sentry/sentry.module.ts
if [ -f "repo/apps/api/src/common/sentry/sentry.module.ts" ]; then
  add_row "T12-F1" "Fichier sentry.module.ts existe" "PASS" "Cree"
else
  add_row "T12-F1" "Fichier sentry.module.ts existe" "FAIL" "Manquant"
fi
# Test T12-F2: Existence fichier repo/apps/api/src/common/sentry/sentry.config.ts
if [ -f "repo/apps/api/src/common/sentry/sentry.config.ts" ]; then
  add_row "T12-F2" "Fichier sentry.config.ts existe" "PASS" "Cree"
else
  add_row "T12-F2" "Fichier sentry.config.ts existe" "FAIL" "Manquant"
fi
# Test T12-F3: Existence fichier repo/apps/api/src/common/sentry/sentry-before-send.ts
if [ -f "repo/apps/api/src/common/sentry/sentry-before-send.ts" ]; then
  add_row "T12-F3" "Fichier sentry-before-send.ts existe" "PASS" "Cree"
else
  add_row "T12-F3" "Fichier sentry-before-send.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T12-V1: Si 'SENTRY_DSN' set : Sentry initialise (P0)
echo "  Verifying T12-V1 : Si 'SENTRY_DSN' set : Sentry initialise..."
add_row "T12-V1" "Si 'SENTRY_DSN' set : Sentry initialise" "WARN" "(P0) Voir B-03 Tache 1.3.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V2: Si 'SENTRY_DSN' absent : pas de crash, juste log warn (P0)
echo "  Verifying T12-V2 : Si 'SENTRY_DSN' absent : pas de crash, juste log warn..."
add_row "T12-V2" "Si 'SENTRY_DSN' absent : pas de crash, juste log warn" "WARN" "(P0) Voir B-03 Tache 1.3.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V3: Exception 5xx capture (mock + verify Sentry SDK called) (P0)
echo "  Verifying T12-V3 : Exception 5xx capture (mock + verify Sentry SDK called)..."
add_row "T12-V3" "Exception 5xx capture (mock + verify Sentry SDK called)" "WARN" "(P0) Voir B-03 Tache 1.3.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V4: Exception 4xx NE capture pas (P0)
echo "  Verifying T12-V4 : Exception 4xx NE capture pas..."
add_row "T12-V4" "Exception 4xx NE capture pas" "WARN" "(P0) Voir B-03 Tache 1.3.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V5: User context inclus dans Sentry event (apres Sprint 5) (P0)
echo "  Verifying T12-V5 : User context inclus dans Sentry event (apres Sprint 5)..."
add_row "T12-V5" "User context inclus dans Sentry event (apres Sprint 5)" "WARN" "(P0) Voir B-03 Tache 1.3.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V6: Tenant context inclus (P0)
echo "  Verifying T12-V6 : Tenant context inclus..."
add_row "T12-V6" "Tenant context inclus" "WARN" "(P0) Voir B-03 Tache 1.3.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V7: 'beforeSend' redact password/cin (P0)
echo "  Verifying T12-V7 : 'beforeSend' redact password/cin..."
add_row "T12-V7" "'beforeSend' redact password/cin" "WARN" "(P0) Voir B-03 Tache 1.3.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V8: Source maps upload script disponible (P1)
echo "  Verifying T12-V8 : Source maps upload script disponible..."
add_row "T12-V8" "Source maps upload script disponible" "WARN" "(P1) Voir B-03 Tache 1.3.12 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 13/9 -- 1.3.13 : Rate Limiting Global : @nestjs/throttler + Redis

```bash
echo ""
echo "================================================"
echo "TACHE 1.3.13 : Rate Limiting Global : @nestjs/throttler + Redis"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 9"
echo "================================================"

# === Verification fichiers crees ===
# Test T13-F1: Existence fichier repo/apps/api/src/common/throttler/throttler.module.ts
if [ -f "repo/apps/api/src/common/throttler/throttler.module.ts" ]; then
  add_row "T13-F1" "Fichier throttler.module.ts existe" "PASS" "Cree"
else
  add_row "T13-F1" "Fichier throttler.module.ts existe" "FAIL" "Manquant"
fi
# Test T13-F2: Existence fichier repo/apps/api/src/common/throttler/throttler-redis.storage.ts
if [ -f "repo/apps/api/src/common/throttler/throttler-redis.storage.ts" ]; then
  add_row "T13-F2" "Fichier throttler-redis.storage.ts existe" "PASS" "Cree"
else
  add_row "T13-F2" "Fichier throttler-redis.storage.ts existe" "FAIL" "Manquant"
fi
# Test T13-F3: Existence fichier repo/apps/api/src/common/throttler/throttler.guard.ts
if [ -f "repo/apps/api/src/common/throttler/throttler.guard.ts" ]; then
  add_row "T13-F3" "Fichier throttler.guard.ts existe" "PASS" "Cree"
else
  add_row "T13-F3" "Fichier throttler.guard.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T13-V1: 100e request OK, 101e retourne 429 (P0)
echo "  Verifying T13-V1 : 100e request OK, 101e retourne 429..."
add_row "T13-V1" "100e request OK, 101e retourne 429" "WARN" "(P0) Voir B-03 Tache 1.3.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V2: Apres 60s, quota reset (P0)
echo "  Verifying T13-V2 : Apres 60s, quota reset..."
add_row "T13-V2" "Apres 60s, quota reset" "WARN" "(P0) Voir B-03 Tache 1.3.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V3: Headers X-RateLimit-* presents (P0)
echo "  Verifying T13-V3 : Headers X-RateLimit-* presents..."
add_row "T13-V3" "Headers X-RateLimit-* presents" "WARN" "(P0) Voir B-03 Tache 1.3.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V4: Header Retry-After sur 429 (P0)
echo "  Verifying T13-V4 : Header Retry-After sur 429..."
add_row "T13-V4" "Header Retry-After sur 429" "WARN" "(P0) Voir B-03 Tache 1.3.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V5: Skip /healthz, /readyz, /docs (P0)
echo "  Verifying T13-V5 : Skip /healthz, /readyz, /docs..."
add_row "T13-V5" "Skip /healthz, /readyz, /docs" "WARN" "(P0) Voir B-03 Tache 1.3.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V6: User authentifie : tracking per user (vs IP) (P0)
echo "  Verifying T13-V6 : User authentifie : tracking per user (vs IP)..."
add_row "T13-V6" "User authentifie : tracking per user (vs IP)" "WARN" "(P0) Voir B-03 Tache 1.3.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V7: Erreur 429 format coherent ExceptionFilter (P0)
echo "  Verifying T13-V7 : Erreur 429 format coherent ExceptionFilter..."
add_row "T13-V7" "Erreur 429 format coherent ExceptionFilter" "WARN" "(P0) Voir B-03 Tache 1.3.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V8: Logs warn sur rate limit hit (P1)
echo "  Verifying T13-V8 : Logs warn sur rate limit hit..."
add_row "T13-V8" "Logs warn sur rate limit hit" "WARN" "(P1) Voir B-03 Tache 1.3.13 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 14/9 -- 1.3.14 : PublicEndpointGuard + @Public() Decorator

```bash
echo ""
echo "================================================"
echo "TACHE 1.3.14 : PublicEndpointGuard + @Public() Decorator"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 9"
echo "================================================"

# === Verification fichiers crees ===
# Test T14-F1: Existence fichier repo/apps/api/src/common/decorators/public.decorator.ts
if [ -f "repo/apps/api/src/common/decorators/public.decorator.ts" ]; then
  add_row "T14-F1" "Fichier public.decorator.ts existe" "PASS" "Cree"
else
  add_row "T14-F1" "Fichier public.decorator.ts existe" "FAIL" "Manquant"
fi
# Test T14-F2: Existence fichier repo/apps/api/src/common/guards/public-endpoint.guard.ts
if [ -f "repo/apps/api/src/common/guards/public-endpoint.guard.ts" ]; then
  add_row "T14-F2" "Fichier public-endpoint.guard.ts existe" "PASS" "Cree"
else
  add_row "T14-F2" "Fichier public-endpoint.guard.ts existe" "FAIL" "Manquant"
fi
# Test T14-F3: Existence fichier repo/apps/api/src/common/guards/public-endpoint.guard.spec.ts
if [ -f "repo/apps/api/src/common/guards/public-endpoint.guard.spec.ts" ]; then
  add_row "T14-F3" "Fichier public-endpoint.guard.spec.ts existe" "PASS" "Cree"
else
  add_row "T14-F3" "Fichier public-endpoint.guard.spec.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T14-V1: '/healthz' accepte sans auth (P0)
echo "  Verifying T14-V1 : '/healthz' accepte sans auth..."
add_row "T14-V1" "'/healthz' accepte sans auth" "WARN" "(P0) Voir B-03 Tache 1.3.14 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T14-V2: '/api/v1/public/*' accepte sans auth (P0)
echo "  Verifying T14-V2 : '/api/v1/public/*' accepte sans auth..."
add_row "T14-V2" "'/api/v1/public/*' accepte sans auth" "WARN" "(P0) Voir B-03 Tache 1.3.14 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T14-V3: '/docs' accepte sans auth (P0)
echo "  Verifying T14-V3 : '/docs' accepte sans auth..."
add_row "T14-V3" "'/docs' accepte sans auth" "WARN" "(P0) Voir B-03 Tache 1.3.14 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T14-V4: Endpoint @Public() accepte sans auth (P0)
echo "  Verifying T14-V4 : Endpoint @Public() accepte sans auth..."
add_row "T14-V4" "Endpoint @Public() accepte sans auth" "WARN" "(P0) Voir B-03 Tache 1.3.14 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T14-V5: Endpoint non-public rejete 401 sans header Authorization (P0)
echo "  Verifying T14-V5 : Endpoint non-public rejete 401 sans header Authorization..."
add_row "T14-V5" "Endpoint non-public rejete 401 sans header Authorization" "WARN" "(P0) Voir B-03 Tache 1.3.14 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T14-V6: Endpoint non-public rejete 400 sans header x-tenant-id (P0)
echo "  Verifying T14-V6 : Endpoint non-public rejete 400 sans header x-tenant-id..."
add_row "T14-V6" "Endpoint non-public rejete 400 sans header x-tenant-id" "WARN" "(P0) Voir B-03 Tache 1.3.14 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T14-V7: @Public() override path-based (peut marquer endpoint hors /public/* comme public) (P0)
echo "  Verifying T14-V7 : @Public() override path-based (peut marquer endpoint hors /public/* co..."
add_row "T14-V7" "@Public() override path-based (peut marquer endpoint hors /public/* comme public)" "WARN" "(P0) Voir B-03 Tache 1.3.14 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T14-V8: Logs warn sur tentative acces sans auth (P0)
echo "  Verifying T14-V8 : Logs warn sur tentative acces sans auth..."
add_row "T14-V8" "Logs warn sur tentative acces sans auth" "WARN" "(P0) Voir B-03 Tache 1.3.14 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 15/12 -- 1.3.15 : Tests E2E Bootstrap : Smoke Tests + Healthcheck + 404/500

```bash
echo ""
echo "================================================"
echo "TACHE 1.3.15 : Tests E2E Bootstrap : Smoke Tests + Healthcheck + 404/500"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 12"
echo "================================================"

# === Verification fichiers crees ===
# Test T15-F1: Existence fichier repo/e2e/api/smoke.spec.ts
if [ -f "repo/e2e/api/smoke.spec.ts" ]; then
  add_row "T15-F1" "Fichier smoke.spec.ts existe" "PASS" "Cree"
else
  add_row "T15-F1" "Fichier smoke.spec.ts existe" "FAIL" "Manquant"
fi
# Test T15-F2: Existence fichier repo/e2e/api/healthcheck.spec.ts
if [ -f "repo/e2e/api/healthcheck.spec.ts" ]; then
  add_row "T15-F2" "Fichier healthcheck.spec.ts existe" "PASS" "Cree"
else
  add_row "T15-F2" "Fichier healthcheck.spec.ts existe" "FAIL" "Manquant"
fi
# Test T15-F3: Existence fichier repo/e2e/api/cors.spec.ts
if [ -f "repo/e2e/api/cors.spec.ts" ]; then
  add_row "T15-F3" "Fichier cors.spec.ts existe" "PASS" "Cree"
else
  add_row "T15-F3" "Fichier cors.spec.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T15-V1: 12+ tests E2E ecrits (P0)
echo "  Verifying T15-V1 : 12+ tests E2E ecrits..."
add_row "T15-V1" "12+ tests E2E ecrits" "WARN" "(P0) Voir B-03 Tache 1.3.15 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T15-V2: Tous tests passent localement (P0)
echo "  Verifying T15-V2 : Tous tests passent localement..."
add_row "T15-V2" "Tous tests passent localement" "WARN" "(P0) Voir B-03 Tache 1.3.15 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T15-V3: Tous tests passent CI (avec services Postgres+Redis+Kafka) (P0)
echo "  Verifying T15-V3 : Tous tests passent CI (avec services Postgres+Redis+Kafka)..."
add_row "T15-V3" "Tous tests passent CI (avec services Postgres+Redis+Kafka)" "WARN" "(P0) Voir B-03 Tache 1.3.15 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T15-V4: Smoke test : GET / format '{ data, meta }' (P0)
echo "  Verifying T15-V4 : Smoke test : GET / format '{ data, meta }'..."
add_row "T15-V4" "Smoke test : GET / format '{ data, meta }'" "WARN" "(P0) Voir B-03 Tache 1.3.15 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T15-V5: Healthcheck test : /healthz + /readyz reussissent (P0)
echo "  Verifying T15-V5 : Healthcheck test : /healthz + /readyz reussissent..."
add_row "T15-V5" "Healthcheck test : /healthz + /readyz reussissent" "WARN" "(P0) Voir B-03 Tache 1.3.15 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T15-V6: Validation test : 400 sur body invalide (P0)
echo "  Verifying T15-V6 : Validation test : 400 sur body invalide..."
add_row "T15-V6" "Validation test : 400 sur body invalide" "WARN" "(P0) Voir B-03 Tache 1.3.15 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T15-V7: Auth test : 401 sans Authorization (P0)
echo "  Verifying T15-V7 : Auth test : 401 sans Authorization..."
add_row "T15-V7" "Auth test : 401 sans Authorization" "WARN" "(P0) Voir B-03 Tache 1.3.15 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T15-V8: Public endpoint test : 200 sans auth (P0)
echo "  Verifying T15-V8 : Public endpoint test : 200 sans auth..."
add_row "T15-V8" "Public endpoint test : 200 sans auth" "WARN" "(P0) Voir B-03 Tache 1.3.15 pour test detaille - critere a auto-tester via script ad-hoc"

```

---


---


## VERIFICATIONS TRANSVERSALES SPRINT 3

### TR-BUILD : Build complet du sprint

```bash
echo ""
echo "================================================"
echo "VERIFICATIONS TRANSVERSALES SPRINT 3"
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
echo "GENERATION DU RAPPORT FINAL SPRINT 3"
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

## Jalon GO/NO-GO Sprint 3

EOF

# Calcul statut final
if (( $(echo "$SCORE >= 95" | bc -l) )); then
  STATUT="GO"
  cat >> "$REPORT_FILE" << EOF
**STATUT** : GO -- Sprint 3 valide, passage Sprint 4 autorise

Le sprint a passe les criteres requis. Cowork peut demarrer Sprint 4.

EOF
  echo ""
  echo "================================================"
  echo "SPRINT 3 : GO ($SCORE%)"
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
  echo "SPRINT 3 : GO CONDITIONNEL ($SCORE%)"
  echo "================================================"
else
  STATUT="NO-GO"
  cat >> "$REPORT_FILE" << EOF
**STATUT** : NO-GO -- Score $SCORE% trop bas (cible 85% minimum)

Le sprint **doit etre repris** :
- Lister tous FAIL P0
- Escalation Saad/Abla decision (cut scope OR delai)
- Reprise sprint avant Sprint 4

EOF
  echo ""
  echo "================================================"
  echo "SPRINT 3 : NO-GO ($SCORE%)"
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
  echo "git commit -m \"chore(sprint-03): close sprint 3 -- $STATUT ($SCORE%)\"" >> "$REPORT_FILE"
  echo '```' >> "$REPORT_FILE"
fi

echo ""
echo "Rapport complet dans : $REPORT_FILE"
```

---

## INSTRUCTION FINALE A CLAUDE CODE / COWORK

Apres l'execution complete des verifications ci-dessus :

1. **Lis le contenu de `sprint03-verify-report.md`** integralement
2. **Identifie les FAIL critiques** (criteres P0) qui necessitent intervention manuelle
3. **Affiche un resume executif** :
   - Nombre total de criteres
   - Pourcentage PASS / PASS\* / FAIL / WARN
   - Liste des FAIL avec contexte technique
   - Recommandation : GO / GO CONDITIONNEL / NO-GO
4. **Si NO-GO** : ne pas demarrer le Sprint suivant, alerter Saad/Abla via Slack `#insurtech-dev`
5. **Si GO ou GO CONDITIONNEL** : produire le commit de cloture du sprint :

```bash
git add skalean-insurtech/sprint03-verify-report.md
git commit -m "chore(sprint-03): close sprint 3 with verification report

- Verification automatique executee
- Score global : <SCORE>%
- <PASS> criteres PASS, <PASS_REPAIRED> reparations auto, <FAIL> FAIL
- Statut : <GO|GO CONDITIONNEL|NO-GO>

Phase: 1 -- Bootstrap Infrastructure
Sprint: 3 (Phase 1 / Sprint 3)
Reference B-03, C-03, V-03
Report: sprint03-verify-report.md"
```

6. **Documentation continue** : si decisions techniques prises pendant verification, ajouter notes dans `repo/docs/runbooks/sprint-03-lessons-learned.md`

---

**Fin de la verification V-03 v2.2 detaillee -- Sprint 3 (1.3) API Bootstrap NestJS.**

**Total criteres taches** : 124 | **Total transversaux** : ~10 | **Effort sprint** : 75h
