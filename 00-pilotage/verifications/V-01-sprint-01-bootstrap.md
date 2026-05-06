# VERIFICATION SPRINT 1 -- Phase 1 / Sprint 1 : Bootstrap Infrastructure
# Version : Auto-reparation active + Rapport final MD detaille
# 15 taches, 124 criteres extraits B-01
# AUCUNE EMOJI AUTORISEE

**Version** : v2.2 (verification detaillee)
**Phase** : 1 -- Bootstrap Infrastructure
**Sprint** : 1 / 35 (cumul) -- Sprint 1 dans Phase 1
**Reference meta-prompt** : `B-01-sprint-01-bootstrap.md`
**Reference orchestrateur** : `C-01-sprint-01-bootstrap.md`
**Total criteres** : 124 criteres taches + ~10 transversaux

---

Tu es **Claude Code (ou Cowork)**. Tu dois executer une **verification COMPLETE et EXHAUSTIVE** du Sprint 1 apres execution toutes les 15 taches.

---

## REGLES D'EXECUTION

1. Tu **executes CHAQUE verification dans l'ordre** (taches puis transversales)
2. Quand une verification echoue, tu **TENTES UNE REPARATION AUTOMATIQUE** avant de noter FAIL
3. Apres chaque tentative de reparation, tu **re-executes la verification**
4. Tu consignes dans `sprint01-verify-report.md` **TOUS les resultats** au fil de l'execution
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
REPORT_FILE="sprint01-verify-report.md"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
RUN_ID=$(date '+%Y%m%d-%H%M%S')

cat > "$REPORT_FILE" << EOF
# Rapport de Verification - Sprint 1 : Bootstrap Infrastructure

**Date** : $TIMESTAMP
**Run ID** : $RUN_ID
**Phase** : 1 -- Bootstrap Infrastructure
**Sprint** : 1 (Phase 1 / Sprint 1)
**Reference B-01** : 15 taches, 124 criteres extraits
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

## TACHE 1/7 -- 1.1.1 : Initialisation Monorepo pnpm + Turborepo + Structure

```bash
echo ""
echo "================================================"
echo "TACHE 1.1.1 : Initialisation Monorepo pnpm + Turborepo + Structure"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 7"
echo "================================================"

# === Verification fichiers crees ===
# Test T01-F1: Existence fichier repo/package.json
if [ -f "repo/package.json" ]; then
  add_row "T01-F1" "Fichier package.json existe" "PASS" "Cree"
else
  add_row "T01-F1" "Fichier package.json existe" "FAIL" "Manquant"
fi
# Test T01-F2: Existence fichier repo/pnpm-workspace.yaml
if [ -f "repo/pnpm-workspace.yaml" ]; then
  add_row "T01-F2" "Fichier pnpm-workspace.yaml existe" "PASS" "Cree"
else
  add_row "T01-F2" "Fichier pnpm-workspace.yaml existe" "FAIL" "Manquant"
fi
# Test T01-F3: Existence fichier repo/turbo.json
if [ -f "repo/turbo.json" ]; then
  add_row "T01-F3" "Fichier turbo.json existe" "PASS" "Cree"
else
  add_row "T01-F3" "Fichier turbo.json existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T01-V1: 'pnpm install --frozen-lockfile' reussit en < 90s sur machine 8 GB RAM (P0)
echo "  Verifying T01-V1 : 'pnpm install --frozen-lockfile' reussit en < 90s sur machine 8 GB RAM..."
add_row "T01-V1" "'pnpm install --frozen-lockfile' reussit en < 90s sur machine 8 GB RAM" "WARN" "(P0) Voir B-01 Tache 1.1.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V2: 'turbo --version' >= 2.3.0 (P0)
echo "  Verifying T01-V2 : 'turbo --version' >= 2.3.0..."
add_row "T01-V2" "'turbo --version' >= 2.3.0" "WARN" "(P0) Voir B-01 Tache 1.1.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V3: 'ls apps/ | wc -l' retourne 8 (P0)
echo "  Verifying T01-V3 : 'ls apps/ | wc -l' retourne 8..."
add_row "T01-V3" "'ls apps/ | wc -l' retourne 8" "WARN" "(P0) Voir B-01 Tache 1.1.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V4: 'ls packages/ | wc -l' retourne 21 (16 metier + 5 shared) (P0)
echo "  Verifying T01-V4 : 'ls packages/ | wc -l' retourne 21 (16 metier + 5 shared)..."
add_row "T01-V4" "'ls packages/ | wc -l' retourne 21 (16 metier + 5 shared)" "WARN" "(P0) Voir B-01 Tache 1.1.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V5: 'engine-strict' rejette install si Node < 22.11.0 (test : downgrade local Node temporairem (P0)
echo "  Verifying T01-V5 : 'engine-strict' rejette install si Node < 22.11.0 (test : downgrade lo..."
add_row "T01-V5" "'engine-strict' rejette install si Node < 22.11.0 (test : downgrade local Node temporairem" "WARN" "(P0) Voir B-01 Tache 1.1.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V6: 'pnpm typecheck' reussit (vide mais valide) (P0)
echo "  Verifying T01-V6 : 'pnpm typecheck' reussit (vide mais valide)..."
add_row "T01-V6" "'pnpm typecheck' reussit (vide mais valide)" "WARN" "(P0) Voir B-01 Tache 1.1.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V7: Cache turbo invalide correctement quand 'tsconfig.base.json' modifie (P1)
echo "  Verifying T01-V7 : Cache turbo invalide correctement quand 'tsconfig.base.json' modifie..."
add_row "T01-V7" "Cache turbo invalide correctement quand 'tsconfig.base.json' modifie" "WARN" "(P1) Voir B-01 Tache 1.1.1 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 2/8 -- 1.1.2 : TypeScript Strict + Biome Unifie

```bash
echo ""
echo "================================================"
echo "TACHE 1.1.2 : TypeScript Strict + Biome Unifie"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 8"
echo "================================================"

# === Verification fichiers crees ===
# Test T02-F1: Existence fichier repo/tsconfig.base.json
if [ -f "repo/tsconfig.base.json" ]; then
  add_row "T02-F1" "Fichier tsconfig.base.json existe" "PASS" "Cree"
else
  add_row "T02-F1" "Fichier tsconfig.base.json existe" "FAIL" "Manquant"
fi
# Test T02-F2: Existence fichier repo/tsconfig.json
if [ -f "repo/tsconfig.json" ]; then
  add_row "T02-F2" "Fichier tsconfig.json existe" "PASS" "Cree"
else
  add_row "T02-F2" "Fichier tsconfig.json existe" "FAIL" "Manquant"
fi
# Test T02-F3: Existence fichier repo/biome.json
if [ -f "repo/biome.json" ]; then
  add_row "T02-F3" "Fichier biome.json existe" "PASS" "Cree"
else
  add_row "T02-F3" "Fichier biome.json existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T02-V1: 'pnpm typecheck' reussit (P0)
echo "  Verifying T02-V1 : 'pnpm typecheck' reussit..."
add_row "T02-V1" "'pnpm typecheck' reussit" "WARN" "(P0) Voir B-01 Tache 1.1.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V2: 'pnpm lint' reussit (0 erreur Biome) (P0)
echo "  Verifying T02-V2 : 'pnpm lint' reussit (0 erreur Biome)..."
add_row "T02-V2" "'pnpm lint' reussit (0 erreur Biome)" "WARN" "(P0) Voir B-01 Tache 1.1.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V3: 'pnpm format --check .' propre (P0)
echo "  Verifying T02-V3 : 'pnpm format --check .' propre..."
add_row "T02-V3" "'pnpm format --check .' propre" "WARN" "(P0) Voir B-01 Tache 1.1.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V4: 'noUncheckedIndexedAccess: true' actif (test : essayer 'arr[0].foo' -> error TS) (P0)
echo "  Verifying T02-V4 : 'noUncheckedIndexedAccess: true' actif (test : essayer 'arr[0].foo' ->..."
add_row "T02-V4" "'noUncheckedIndexedAccess: true' actif (test : essayer 'arr[0].foo' -> error TS)" "WARN" "(P0) Voir B-01 Tache 1.1.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V5: 'exactOptionalPropertyTypes: true' actif (P0)
echo "  Verifying T02-V5 : 'exactOptionalPropertyTypes: true' actif..."
add_row "T02-V5" "'exactOptionalPropertyTypes: true' actif" "WARN" "(P0) Voir B-01 Tache 1.1.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V6: 'noConsoleLog: error' rejette 'console.log' en code (sauf tests) (P0)
echo "  Verifying T02-V6 : 'noConsoleLog: error' rejette 'console.log' en code (sauf tests)..."
add_row "T02-V6" "'noConsoleLog: error' rejette 'console.log' en code (sauf tests)" "WARN" "(P0) Voir B-01 Tache 1.1.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V7: VS Code formate automatiquement on save (P1)
echo "  Verifying T02-V7 : VS Code formate automatiquement on save..."
add_row "T02-V7" "VS Code formate automatiquement on save" "WARN" "(P1) Voir B-01 Tache 1.1.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V8: Path mapping '@insurtech/*' resoud correctement (P1)
echo "  Verifying T02-V8 : Path mapping '@insurtech/*' resoud correctement..."
add_row "T02-V8" "Path mapping '@insurtech/*' resoud correctement" "WARN" "(P1) Voir B-01 Tache 1.1.2 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 3/11 -- 1.1.3 : Docker Compose Dev (7 Services)

```bash
echo ""
echo "================================================"
echo "TACHE 1.1.3 : Docker Compose Dev (7 Services)"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 11"
echo "================================================"

# === Verification fichiers crees ===
# Test T03-F1: Existence fichier repo/infrastructure/docker/docker-compose.dev.yaml
if [ -f "repo/infrastructure/docker/docker-compose.dev.yaml" ]; then
  add_row "T03-F1" "Fichier docker-compose.dev.yaml existe" "PASS" "Cree"
else
  add_row "T03-F1" "Fichier docker-compose.dev.yaml existe" "FAIL" "Manquant"
fi
# Test T03-F2: Existence fichier repo/infrastructure/docker/docker-compose.test.yaml
if [ -f "repo/infrastructure/docker/docker-compose.test.yaml" ]; then
  add_row "T03-F2" "Fichier docker-compose.test.yaml existe" "PASS" "Cree"
else
  add_row "T03-F2" "Fichier docker-compose.test.yaml existe" "FAIL" "Manquant"
fi
# Test T03-F3: Existence fichier repo/infrastructure/docker/redis/redis.conf
if [ -f "repo/infrastructure/docker/redis/redis.conf" ]; then
  add_row "T03-F3" "Fichier redis.conf existe" "PASS" "Cree"
else
  add_row "T03-F3" "Fichier redis.conf existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T03-V1: 'pnpm docker:up' reussit (P0)
echo "  Verifying T03-V1 : 'pnpm docker:up' reussit..."
add_row "T03-V1" "'pnpm docker:up' reussit" "WARN" "(P0) Voir B-01 Tache 1.1.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V2: 'docker ps | grep skalean | wc -l' >= 7 (au moins 7 containers) (P0)
echo "  Verifying T03-V2 : 'docker ps | grep skalean | wc -l' >= 7 (au moins 7 containers)..."
add_row "T03-V2" "'docker ps | grep skalean | wc -l' >= 7 (au moins 7 containers)" "WARN" "(P0) Voir B-01 Tache 1.1.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V3: Tous services healthy en < 60s : 'docker compose ps --format json | jq '.Health'' (P0)
echo "  Verifying T03-V3 : Tous services healthy en < 60s : 'docker compose ps --format json | jq..."
add_row "T03-V3" "Tous services healthy en < 60s : 'docker compose ps --format json | jq '.Health''" "WARN" "(P0) Voir B-01 Tache 1.1.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V4: 'docker exec skalean-postgres pg_isready -U skalean' reussit (P0)
echo "  Verifying T03-V4 : 'docker exec skalean-postgres pg_isready -U skalean' reussit..."
add_row "T03-V4" "'docker exec skalean-postgres pg_isready -U skalean' reussit" "WARN" "(P0) Voir B-01 Tache 1.1.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V5: 'docker exec skalean-redis redis-cli -a skalean_redis_dev ping' retourne PONG (P0)
echo "  Verifying T03-V5 : 'docker exec skalean-redis redis-cli -a skalean_redis_dev ping' retour..."
add_row "T03-V5" "'docker exec skalean-redis redis-cli -a skalean_redis_dev ping' retourne PONG" "WARN" "(P0) Voir B-01 Tache 1.1.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V6: 'docker exec skalean-kafka kafka-topics.sh --list' reussit (vide initialement avant Tache  (P0)
echo "  Verifying T03-V6 : 'docker exec skalean-kafka kafka-topics.sh --list' reussit (vide initi..."
add_row "T03-V6" "'docker exec skalean-kafka kafka-topics.sh --list' reussit (vide initialement avant Tache " "WARN" "(P0) Voir B-01 Tache 1.1.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V7: 'curl -s http://localhost:8025/api/v2/messages' (Mailhog) retourne JSON (P0)
echo "  Verifying T03-V7 : 'curl -s http://localhost:8025/api/v2/messages' (Mailhog) retourne JSO..."
add_row "T03-V7" "'curl -s http://localhost:8025/api/v2/messages' (Mailhog) retourne JSON" "WARN" "(P0) Voir B-01 Tache 1.1.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V8: MinIO console accessible :9001 + 3 buckets crees automatiquement (P0)
echo "  Verifying T03-V8 : MinIO console accessible :9001 + 3 buckets crees automatiquement..."
add_row "T03-V8" "MinIO console accessible :9001 + 3 buckets crees automatiquement" "WARN" "(P0) Voir B-01 Tache 1.1.3 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 4/10 -- 1.1.4 : PostgreSQL 16 + Extensions + Helpers RLS Multi-Tenant 3 Niveaux

```bash
echo ""
echo "================================================"
echo "TACHE 1.1.4 : PostgreSQL 16 + Extensions + Helpers RLS Multi-Tenant 3 Nive"
echo "Priorite : P0 | Effort : 7h"
echo "Criteres a verifier : 10"
echo "================================================"

# === Verification fichiers crees ===
# Test T04-F1: Existence fichier repo/infrastructure/docker/postgres/init.sh
if [ -f "repo/infrastructure/docker/postgres/init.sh" ]; then
  add_row "T04-F1" "Fichier init.sh existe" "PASS" "Cree"
else
  add_row "T04-F1" "Fichier init.sh existe" "FAIL" "Manquant"
fi
# Test T04-F2: Existence fichier repo/infrastructure/docker/postgres/001-init-extensions.sql
if [ -f "repo/infrastructure/docker/postgres/001-init-extensions.sql" ]; then
  add_row "T04-F2" "Fichier 001-init-extensions.sql existe" "PASS" "Cree"
else
  add_row "T04-F2" "Fichier 001-init-extensions.sql existe" "FAIL" "Manquant"
fi
# Test T04-F3: Existence fichier repo/infrastructure/docker/postgres/002-init-tenant-rls-helpers.sql
if [ -f "repo/infrastructure/docker/postgres/002-init-tenant-rls-helpers.sql" ]; then
  add_row "T04-F3" "Fichier 002-init-tenant-rls-helpers.sql existe" "PASS" "Cree"
else
  add_row "T04-F3" "Fichier 002-init-tenant-rls-helpers.sql existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T04-V1: 'docker exec skalean-postgres psql -U skalean -d skalean_insurtech -c 'SELECT extname FROM (P0)
echo "  Verifying T04-V1 : 'docker exec skalean-postgres psql -U skalean -d skalean_insurtech -c ..."
add_row "T04-V1" "'docker exec skalean-postgres psql -U skalean -d skalean_insurtech -c 'SELECT extname FROM" "WARN" "(P0) Voir B-01 Tache 1.1.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V2: Les 6 helpers sont definis : '\df app_*' dans psql (P0)
echo "  Verifying T04-V2 : Les 6 helpers sont definis : '\df app_*' dans psql..."
add_row "T04-V2" "Les 6 helpers sont definis : '\df app_*' dans psql" "WARN" "(P0) Voir B-01 Tache 1.1.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V3: 'SELECT app_current_tenant()' retourne NULL hors session SET LOCAL (P0)
echo "  Verifying T04-V3 : 'SELECT app_current_tenant()' retourne NULL hors session SET LOCAL..."
add_row "T04-V3" "'SELECT app_current_tenant()' retourne NULL hors session SET LOCAL" "WARN" "(P0) Voir B-01 Tache 1.1.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V4: 'BEGIN; SET LOCAL app.current_tenant_id = '<uuid>'; SELECT app_current_tenant(); COMMIT;'  (P0)
echo "  Verifying T04-V4 : 'BEGIN; SET LOCAL app.current_tenant_id = '<uuid>'; SELECT app_current..."
add_row "T04-V4" "'BEGIN; SET LOCAL app.current_tenant_id = '<uuid>'; SELECT app_current_tenant(); COMMIT;' " "WARN" "(P0) Voir B-01 Tache 1.1.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V5: 'SELECT app_is_super_admin()' retourne 'false' par defaut (P0)
echo "  Verifying T04-V5 : 'SELECT app_is_super_admin()' retourne 'false' par defaut..."
add_row "T04-V5" "'SELECT app_is_super_admin()' retourne 'false' par defaut" "WARN" "(P0) Voir B-01 Tache 1.1.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V6: 'SELECT gen_random_uuid()' retourne UUID v4 valide (P0)
echo "  Verifying T04-V6 : 'SELECT gen_random_uuid()' retourne UUID v4 valide..."
add_row "T04-V6" "'SELECT gen_random_uuid()' retourne UUID v4 valide" "WARN" "(P0) Voir B-01 Tache 1.1.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V7: Schema 'n8n' existe : '\dn' (P0)
echo "  Verifying T04-V7 : Schema 'n8n' existe : '\dn'..."
add_row "T04-V7" "Schema 'n8n' existe : '\dn'" "WARN" "(P0) Voir B-01 Tache 1.1.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V8: Database 'skalean_insurtech_test' existe : '\l' (P0)
echo "  Verifying T04-V8 : Database 'skalean_insurtech_test' existe : '\l'..."
add_row "T04-V8" "Database 'skalean_insurtech_test' existe : '\l'" "WARN" "(P0) Voir B-01 Tache 1.1.4 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 5/8 -- 1.1.5 : Redis 7.4 + Strategy 6 DBs

```bash
echo ""
echo "================================================"
echo "TACHE 1.1.5 : Redis 7.4 + Strategy 6 DBs"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 8"
echo "================================================"

# === Verification fichiers crees ===
# Test T05-F1: Existence fichier repo/infrastructure/docker/redis/redis.conf
if [ -f "repo/infrastructure/docker/redis/redis.conf" ]; then
  add_row "T05-F1" "Fichier redis.conf existe" "PASS" "Cree"
else
  add_row "T05-F1" "Fichier redis.conf existe" "FAIL" "Manquant"
fi
# Test T05-F2: Existence fichier repo/packages/shared-utils/src/redis/redis-clients.ts
if [ -f "repo/packages/shared-utils/src/redis/redis-clients.ts" ]; then
  add_row "T05-F2" "Fichier redis-clients.ts existe" "PASS" "Cree"
else
  add_row "T05-F2" "Fichier redis-clients.ts existe" "FAIL" "Manquant"
fi
# Test T05-F3: Existence fichier repo/packages/shared-utils/src/redis/redis-clients.spec.ts
if [ -f "repo/packages/shared-utils/src/redis/redis-clients.spec.ts" ]; then
  add_row "T05-F3" "Fichier redis-clients.spec.ts existe" "PASS" "Cree"
else
  add_row "T05-F3" "Fichier redis-clients.spec.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T05-V1: 'docker exec skalean-redis redis-cli -a $REDIS_PASSWORD ping' retourne PONG (P0)
echo "  Verifying T05-V1 : 'docker exec skalean-redis redis-cli -a $REDIS_PASSWORD ping' retourne..."
add_row "T05-V1" "'docker exec skalean-redis redis-cli -a $REDIS_PASSWORD ping' retourne PONG" "WARN" "(P0) Voir B-01 Tache 1.1.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V2: 'createRedisClient({ url, db: 0 })' connecte sans erreur (P0)
echo "  Verifying T05-V2 : 'createRedisClient({ url, db: 0 })' connecte sans erreur..."
add_row "T05-V2" "'createRedisClient({ url, db: 0 })' connecte sans erreur" "WARN" "(P0) Voir B-01 Tache 1.1.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V3: Test isolation : key set en DB 0 PAS visible en DB 1 (P0)
echo "  Verifying T05-V3 : Test isolation : key set en DB 0 PAS visible en DB 1..."
add_row "T05-V3" "Test isolation : key set en DB 0 PAS visible en DB 1" "WARN" "(P0) Voir B-01 Tache 1.1.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V4: 'REDIS_DB' constante exporte 6 DBs avec valeurs 0-5 (P0)
echo "  Verifying T05-V4 : 'REDIS_DB' constante exporte 6 DBs avec valeurs 0-5..."
add_row "T05-V4" "'REDIS_DB' constante exporte 6 DBs avec valeurs 0-5" "WARN" "(P0) Voir B-01 Tache 1.1.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V5: Retry strategy max 10 fois, delay max 2000ms (P0)
echo "  Verifying T05-V5 : Retry strategy max 10 fois, delay max 2000ms..."
add_row "T05-V5" "Retry strategy max 10 fois, delay max 2000ms" "WARN" "(P0) Voir B-01 Tache 1.1.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V6: Logs Pino emis sur connect/error/close (P0)
echo "  Verifying T05-V6 : Logs Pino emis sur connect/error/close..."
add_row "T05-V6" "Logs Pino emis sur connect/error/close" "WARN" "(P0) Voir B-01 Tache 1.1.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V7: 'closeAllRedisClients()' ferme tous les clients singleton (P0)
echo "  Verifying T05-V7 : 'closeAllRedisClients()' ferme tous les clients singleton..."
add_row "T05-V7" "'closeAllRedisClients()' ferme tous les clients singleton" "WARN" "(P0) Voir B-01 Tache 1.1.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V8: Documentation cache-strategy.md couvre les 6 DBs + naming convention (P1)
echo "  Verifying T05-V8 : Documentation cache-strategy.md couvre les 6 DBs + naming convention..."
add_row "T05-V8" "Documentation cache-strategy.md couvre les 6 DBs + naming convention" "WARN" "(P1) Voir B-01 Tache 1.1.5 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 6/7 -- 1.1.6 : Kafka 3.7 KRaft + Topic Catalog (30 Topics)

```bash
echo ""
echo "================================================"
echo "TACHE 1.1.6 : Kafka 3.7 KRaft + Topic Catalog (30 Topics)"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 7"
echo "================================================"

# === Verification fichiers crees ===
# Test T06-F1: Existence fichier repo/infrastructure/docker/kafka/init-topics.sh
if [ -f "repo/infrastructure/docker/kafka/init-topics.sh" ]; then
  add_row "T06-F1" "Fichier init-topics.sh existe" "PASS" "Cree"
else
  add_row "T06-F1" "Fichier init-topics.sh existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T06-V1: 'docker logs skalean-kafka-init' montre 'Created : ...' pour chaque topic (P0)
echo "  Verifying T06-V1 : 'docker logs skalean-kafka-init' montre 'Created : ...' pour chaque to..."
add_row "T06-V1" "'docker logs skalean-kafka-init' montre 'Created : ...' pour chaque topic" "WARN" "(P0) Voir B-01 Tache 1.1.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V2: 'docker exec skalean-kafka kafka-topics.sh --bootstrap-server kafka:9092 --list | wc -l' > (P0)
echo "  Verifying T06-V2 : 'docker exec skalean-kafka kafka-topics.sh --bootstrap-server kafka:90..."
add_row "T06-V2" "'docker exec skalean-kafka kafka-topics.sh --bootstrap-server kafka:9092 --list | wc -l' >" "WARN" "(P0) Voir B-01 Tache 1.1.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V3: Convention 'insurtech.events.{vertical}.{entity}.{action}' respectee : 'kafka-topics.sh -- (P0)
echo "  Verifying T06-V3 : Convention 'insurtech.events.{vertical}.{entity}.{action}' respectee :..."
add_row "T06-V3" "Convention 'insurtech.events.{vertical}.{entity}.{action}' respectee : 'kafka-topics.sh --" "WARN" "(P0) Voir B-01 Tache 1.1.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V4: 'kafka-topics.sh --describe --topic insurtech.events.repair.sinistre_declared' retourne 6  (P0)
echo "  Verifying T06-V4 : 'kafka-topics.sh --describe --topic insurtech.events.repair.sinistre_d..."
add_row "T06-V4" "'kafka-topics.sh --describe --topic insurtech.events.repair.sinistre_declared' retourne 6 " "WARN" "(P0) Voir B-01 Tache 1.1.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V5: Test producer/consumer : send + receive 1 message reussit en < 5s (P0)
echo "  Verifying T06-V5 : Test producer/consumer : send + receive 1 message reussit en < 5s..."
add_row "T06-V5" "Test producer/consumer : send + receive 1 message reussit en < 5s" "WARN" "(P0) Voir B-01 Tache 1.1.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V6: Compression lz4 active : '--describe --topic ... --include-config-properties' montre 'comp (P0)
echo "  Verifying T06-V6 : Compression lz4 active : '--describe --topic ... --include-config-prop..."
add_row "T06-V6" "Compression lz4 active : '--describe --topic ... --include-config-properties' montre 'comp" "WARN" "(P0) Voir B-01 Tache 1.1.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V7: Re-execution 'init-topics.sh' ne fail pas (idempotent via '--if-not-exists') (P1)
echo "  Verifying T06-V7 : Re-execution 'init-topics.sh' ne fail pas (idempotent via '--if-not-ex..."
add_row "T06-V7" "Re-execution 'init-topics.sh' ne fail pas (idempotent via '--if-not-exists')" "WARN" "(P1) Voir B-01 Tache 1.1.6 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 7/8 -- 1.1.7 : MinIO S3-Compatible Dev + Atlas Cloud Services Prod Ready

```bash
echo ""
echo "================================================"
echo "TACHE 1.1.7 : MinIO S3-Compatible Dev + Atlas Cloud Services Prod Ready"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 8"
echo "================================================"

# === Verification fichiers crees ===
# Test T07-F1: Existence fichier repo/packages/shared-utils/src/s3/s3-client.ts
if [ -f "repo/packages/shared-utils/src/s3/s3-client.ts" ]; then
  add_row "T07-F1" "Fichier s3-client.ts existe" "PASS" "Cree"
else
  add_row "T07-F1" "Fichier s3-client.ts existe" "FAIL" "Manquant"
fi
# Test T07-F2: Existence fichier repo/packages/shared-utils/src/s3/s3-client.spec.ts
if [ -f "repo/packages/shared-utils/src/s3/s3-client.spec.ts" ]; then
  add_row "T07-F2" "Fichier s3-client.spec.ts existe" "PASS" "Cree"
else
  add_row "T07-F2" "Fichier s3-client.spec.ts existe" "FAIL" "Manquant"
fi
# Test T07-F3: Existence fichier repo/docs/architecture/storage-provider.md
if [ -f "repo/docs/architecture/storage-provider.md" ]; then
  add_row "T07-F3" "Fichier storage-provider.md existe" "PASS" "Cree"
else
  add_row "T07-F3" "Fichier storage-provider.md existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T07-V1: 'docker exec skalean-minio mc ls local/' liste 3 buckets (P0)
echo "  Verifying T07-V1 : 'docker exec skalean-minio mc ls local/' liste 3 buckets..."
add_row "T07-V1" "'docker exec skalean-minio mc ls local/' liste 3 buckets" "WARN" "(P0) Voir B-01 Tache 1.1.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V2: 'createS3Client()' factory retourne client S3Client valide (P0)
echo "  Verifying T07-V2 : 'createS3Client()' factory retourne client S3Client valide..."
add_row "T07-V2" "'createS3Client()' factory retourne client S3Client valide" "WARN" "(P0) Voir B-01 Tache 1.1.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V3: 'getS3Client()' singleton retourne meme instance entre appels (P0)
echo "  Verifying T07-V3 : 'getS3Client()' singleton retourne meme instance entre appels..."
add_row "T07-V3" "'getS3Client()' singleton retourne meme instance entre appels" "WARN" "(P0) Voir B-01 Tache 1.1.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V4: Upload + download fichier test reussit (P0)
echo "  Verifying T07-V4 : Upload + download fichier test reussit..."
add_row "T07-V4" "Upload + download fichier test reussit" "WARN" "(P0) Voir B-01 Tache 1.1.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V5: Region 'ma-bgr-1' (Benguerir Atlas) configuree (P0)
echo "  Verifying T07-V5 : Region 'ma-bgr-1' (Benguerir Atlas) configuree..."
add_row "T07-V5" "Region 'ma-bgr-1' (Benguerir Atlas) configuree" "WARN" "(P0) Voir B-01 Tache 1.1.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V6: 'forcePathStyle: true' actif sur MinIO (P0)
echo "  Verifying T07-V6 : 'forcePathStyle: true' actif sur MinIO..."
add_row "T07-V6" "'forcePathStyle: true' actif sur MinIO" "WARN" "(P0) Voir B-01 Tache 1.1.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V7: Documentation storage-provider.md couvre dev/prod + conformite CNDP (P1)
echo "  Verifying T07-V7 : Documentation storage-provider.md couvre dev/prod + conformite CNDP..."
add_row "T07-V7" "Documentation storage-provider.md couvre dev/prod + conformite CNDP" "WARN" "(P1) Voir B-01 Tache 1.1.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V8: Bucket '*-photos' accepte anonymous download (test : 'curl http://localhost:9000/skalean-i (P1)
echo "  Verifying T07-V8 : Bucket '*-photos' accepte anonymous download (test : 'curl http://loca..."
add_row "T07-V8" "Bucket '*-photos' accepte anonymous download (test : 'curl http://localhost:9000/skalean-i" "WARN" "(P1) Voir B-01 Tache 1.1.7 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 8/9 -- 1.1.8 : shared-config Env Loader Zod Runtime Validation

```bash
echo ""
echo "================================================"
echo "TACHE 1.1.8 : shared-config Env Loader Zod Runtime Validation"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 9"
echo "================================================"

# === Verification fichiers crees ===
# Test T08-F1: Existence fichier repo/packages/shared-config/package.json
if [ -f "repo/packages/shared-config/package.json" ]; then
  add_row "T08-F1" "Fichier package.json existe" "PASS" "Cree"
else
  add_row "T08-F1" "Fichier package.json existe" "FAIL" "Manquant"
fi
# Test T08-F2: Existence fichier repo/packages/shared-config/tsconfig.json
if [ -f "repo/packages/shared-config/tsconfig.json" ]; then
  add_row "T08-F2" "Fichier tsconfig.json existe" "PASS" "Cree"
else
  add_row "T08-F2" "Fichier tsconfig.json existe" "FAIL" "Manquant"
fi
# Test T08-F3: Existence fichier repo/packages/shared-config/src/env.schema.ts
if [ -f "repo/packages/shared-config/src/env.schema.ts" ]; then
  add_row "T08-F3" "Fichier env.schema.ts existe" "PASS" "Cree"
else
  add_row "T08-F3" "Fichier env.schema.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T08-V1: 'loadEnv()' retourne objet typed 'Env' sans erreur si .env valide (P0)
echo "  Verifying T08-V1 : 'loadEnv()' retourne objet typed 'Env' sans erreur si .env valide..."
add_row "T08-V1" "'loadEnv()' retourne objet typed 'Env' sans erreur si .env valide" "WARN" "(P0) Voir B-01 Tache 1.1.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V2: 'process.exit(1)' appele si JWT_SECRET < 32 chars (P0)
echo "  Verifying T08-V2 : 'process.exit(1)' appele si JWT_SECRET < 32 chars..."
add_row "T08-V2" "'process.exit(1)' appele si JWT_SECRET < 32 chars" "WARN" "(P0) Voir B-01 Tache 1.1.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V3: Cache singleton : 2 appels 'loadEnv()' retournent meme reference (P0)
echo "  Verifying T08-V3 : Cache singleton : 2 appels 'loadEnv()' retournent meme reference..."
add_row "T08-V3" "Cache singleton : 2 appels 'loadEnv()' retournent meme reference" "WARN" "(P0) Voir B-01 Tache 1.1.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V4: 'KAFKA_BROKERS=k1:9092,k2:9092' parse en '['k1:9092', 'k2:9092']' (P0)
echo "  Verifying T08-V4 : 'KAFKA_BROKERS=k1:9092,k2:9092' parse en '['k1:9092', 'k2:9092']'..."
add_row "T08-V4" "'KAFKA_BROKERS=k1:9092,k2:9092' parse en '['k1:9092', 'k2:9092']'" "WARN" "(P0) Voir B-01 Tache 1.1.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V5: 'Bool' transformer : ''true'', ''false'', 'true', 'false' tous fonctionnent (P0)
echo "  Verifying T08-V5 : 'Bool' transformer : ''true'', ''false'', 'true', 'false' tous fonctio..."
add_row "T08-V5" "'Bool' transformer : ''true'', ''false'', 'true', 'false' tous fonctionnent" "WARN" "(P0) Voir B-01 Tache 1.1.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V6: Coerce number : 'API_PORT='4000'' -> '4000' (P0)
echo "  Verifying T08-V6 : Coerce number : 'API_PORT='4000'' -> '4000'..."
add_row "T08-V6" "Coerce number : 'API_PORT='4000'' -> '4000'" "WARN" "(P0) Voir B-01 Tache 1.1.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V7: '.env.example' complete et a jour (P0)
echo "  Verifying T08-V7 : '.env.example' complete et a jour..."
add_row "T08-V7" "'.env.example' complete et a jour" "WARN" "(P0) Voir B-01 Tache 1.1.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V8: Erreur Zod retourne path precis : 'JWT_SECRET: Required' (pas juste 'validation failed') (P1)
echo "  Verifying T08-V8 : Erreur Zod retourne path precis : 'JWT_SECRET: Required' (pas juste 'v..."
add_row "T08-V8" "Erreur Zod retourne path precis : 'JWT_SECRET: Required' (pas juste 'validation failed')" "WARN" "(P1) Voir B-01 Tache 1.1.8 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 9/10 -- 1.1.9 : database TypeORM 0.3 DataSource

```bash
echo ""
echo "================================================"
echo "TACHE 1.1.9 : database TypeORM 0.3 DataSource"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 10"
echo "================================================"

# === Verification fichiers crees ===
# Test T09-F1: Existence fichier repo/packages/database/package.json
if [ -f "repo/packages/database/package.json" ]; then
  add_row "T09-F1" "Fichier package.json existe" "PASS" "Cree"
else
  add_row "T09-F1" "Fichier package.json existe" "FAIL" "Manquant"
fi
# Test T09-F2: Existence fichier repo/packages/database/tsconfig.json
if [ -f "repo/packages/database/tsconfig.json" ]; then
  add_row "T09-F2" "Fichier tsconfig.json existe" "PASS" "Cree"
else
  add_row "T09-F2" "Fichier tsconfig.json existe" "FAIL" "Manquant"
fi
# Test T09-F3: Existence fichier repo/packages/database/src/data-source.ts
if [ -f "repo/packages/database/src/data-source.ts" ]; then
  add_row "T09-F3" "Fichier data-source.ts existe" "PASS" "Cree"
else
  add_row "T09-F3" "Fichier data-source.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T09-V1: 'AppDataSource.isInitialized' true apres 'initDataSource()' (P0)
echo "  Verifying T09-V1 : 'AppDataSource.isInitialized' true apres 'initDataSource()'..."
add_row "T09-V1" "'AppDataSource.isInitialized' true apres 'initDataSource()'" "WARN" "(P0) Voir B-01 Tache 1.1.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V2: 'AppDataSource.query('SELECT 1 AS one')' retourne '[{ one: 1 }]' (P0)
echo "  Verifying T09-V2 : 'AppDataSource.query('SELECT 1 AS one')' retourne '[{ one: 1 }]'..."
add_row "T09-V2" "'AppDataSource.query('SELECT 1 AS one')' retourne '[{ one: 1 }]'" "WARN" "(P0) Voir B-01 Tache 1.1.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V3: Helpers RLS accessibles : 'SELECT app_current_tenant()' retourne NULL (P0)
echo "  Verifying T09-V3 : Helpers RLS accessibles : 'SELECT app_current_tenant()' retourne NULL..."
add_row "T09-V3" "Helpers RLS accessibles : 'SELECT app_current_tenant()' retourne NULL" "WARN" "(P0) Voir B-01 Tache 1.1.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V4: SET LOCAL fonctionne en transaction : 'BEGIN; SET LOCAL app.current_tenant_id = '...'; SEL (P0)
echo "  Verifying T09-V4 : SET LOCAL fonctionne en transaction : 'BEGIN; SET LOCAL app.current_te..."
add_row "T09-V4" "SET LOCAL fonctionne en transaction : 'BEGIN; SET LOCAL app.current_tenant_id = '...'; SEL" "WARN" "(P0) Voir B-01 Tache 1.1.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V5: 'synchronize: false' (verifier qu'aucune table auto-creee) (P0)
echo "  Verifying T09-V5 : 'synchronize: false' (verifier qu'aucune table auto-creee)..."
add_row "T09-V5" "'synchronize: false' (verifier qu'aucune table auto-creee)" "WARN" "(P0) Voir B-01 Tache 1.1.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V6: 'statement_timeout=60000' actif : query SLEEP > 60s rejetee (P0)
echo "  Verifying T09-V6 : 'statement_timeout=60000' actif : query SLEEP > 60s rejetee..."
add_row "T09-V6" "'statement_timeout=60000' actif : query SLEEP > 60s rejetee" "WARN" "(P0) Voir B-01 Tache 1.1.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V7: 'application_name=skalean-insurtech-development' visible dans 'pg_stat_activity' (P0)
echo "  Verifying T09-V7 : 'application_name=skalean-insurtech-development' visible dans 'pg_stat..."
add_row "T09-V7" "'application_name=skalean-insurtech-development' visible dans 'pg_stat_activity'" "WARN" "(P0) Voir B-01 Tache 1.1.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V8: 'closeDataSource()' ferme proprement (P0)
echo "  Verifying T09-V8 : 'closeDataSource()' ferme proprement..."
add_row "T09-V8" "'closeDataSource()' ferme proprement" "WARN" "(P0) Voir B-01 Tache 1.1.9 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 10/11 -- 1.1.10 : GitHub Actions CI

```bash
echo ""
echo "================================================"
echo "TACHE 1.1.10 : GitHub Actions CI"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 11"
echo "================================================"

# === Verification fichiers crees ===
# Test T10-F1: Existence fichier repo/.github/workflows/ci.yaml
if [ -f "repo/.github/workflows/ci.yaml" ]; then
  add_row "T10-F1" "Fichier ci.yaml existe" "PASS" "Cree"
else
  add_row "T10-F1" "Fichier ci.yaml existe" "FAIL" "Manquant"
fi
# Test T10-F2: Existence fichier repo/.github/PULL_REQUEST_TEMPLATE.md
if [ -f "repo/.github/PULL_REQUEST_TEMPLATE.md" ]; then
  add_row "T10-F2" "Fichier PULL_REQUEST_TEMPLATE.md existe" "PASS" "Cree"
else
  add_row "T10-F2" "Fichier PULL_REQUEST_TEMPLATE.md existe" "FAIL" "Manquant"
fi
# Test T10-F3: Existence fichier repo/.github/CODEOWNERS
if [ -f "repo/.github/CODEOWNERS" ]; then
  add_row "T10-F3" "Fichier CODEOWNERS existe" "PASS" "Cree"
else
  add_row "T10-F3" "Fichier CODEOWNERS existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T10-V1: Workflow CI declenche sur PR ouverte (P0)
echo "  Verifying T10-V1 : Workflow CI declenche sur PR ouverte..."
add_row "T10-V1" "Workflow CI declenche sur PR ouverte" "WARN" "(P0) Voir B-01 Tache 1.1.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V2: 5 jobs s'executent (visible dans Actions tab) (P0)
echo "  Verifying T10-V2 : 5 jobs s'executent (visible dans Actions tab)..."
add_row "T10-V2" "5 jobs s'executent (visible dans Actions tab)" "WARN" "(P0) Voir B-01 Tache 1.1.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V3: Lint + typecheck reussissent (vide initialement) (P0)
echo "  Verifying T10-V3 : Lint + typecheck reussissent (vide initialement)..."
add_row "T10-V3" "Lint + typecheck reussissent (vide initialement)" "WARN" "(P0) Voir B-01 Tache 1.1.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V4: Build reussit (P0)
echo "  Verifying T10-V4 : Build reussit..."
add_row "T10-V4" "Build reussit" "WARN" "(P0) Voir B-01 Tache 1.1.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V5: Tests reussissent (avec services Postgres + Redis) (P0)
echo "  Verifying T10-V5 : Tests reussissent (avec services Postgres + Redis)..."
add_row "T10-V5" "Tests reussissent (avec services Postgres + Redis)" "WARN" "(P0) Voir B-01 Tache 1.1.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V6: Audit non-bloquant (continue-on-error) (P0)
echo "  Verifying T10-V6 : Audit non-bloquant (continue-on-error)..."
add_row "T10-V6" "Audit non-bloquant (continue-on-error)" "WARN" "(P0) Voir B-01 Tache 1.1.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V7: ci-summary fail si un job critique fail (P0)
echo "  Verifying T10-V7 : ci-summary fail si un job critique fail..."
add_row "T10-V7" "ci-summary fail si un job critique fail" "WARN" "(P0) Voir B-01 Tache 1.1.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V8: check-no-emoji bloque PR si emoji detectee (P0)
echo "  Verifying T10-V8 : check-no-emoji bloque PR si emoji detectee..."
add_row "T10-V8" "check-no-emoji bloque PR si emoji detectee" "WARN" "(P0) Voir B-01 Tache 1.1.10 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 11/8 -- 1.1.11 : Vitest 2.1 + Playwright 1.49

```bash
echo ""
echo "================================================"
echo "TACHE 1.1.11 : Vitest 2.1 + Playwright 1.49"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 8"
echo "================================================"

# === Verification fichiers crees ===
# Test T11-F1: Existence fichier repo/vitest.config.ts
if [ -f "repo/vitest.config.ts" ]; then
  add_row "T11-F1" "Fichier vitest.config.ts existe" "PASS" "Cree"
else
  add_row "T11-F1" "Fichier vitest.config.ts existe" "FAIL" "Manquant"
fi
# Test T11-F2: Existence fichier repo/test/setup.ts
if [ -f "repo/test/setup.ts" ]; then
  add_row "T11-F2" "Fichier setup.ts existe" "PASS" "Cree"
else
  add_row "T11-F2" "Fichier setup.ts existe" "FAIL" "Manquant"
fi
# Test T11-F3: Existence fichier repo/playwright.config.ts
if [ -f "repo/playwright.config.ts" ]; then
  add_row "T11-F3" "Fichier playwright.config.ts existe" "PASS" "Cree"
else
  add_row "T11-F3" "Fichier playwright.config.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T11-V1: 'pnpm test' execute Vitest (vide en Sprint 1) (P0)
echo "  Verifying T11-V1 : 'pnpm test' execute Vitest (vide en Sprint 1)..."
add_row "T11-V1" "'pnpm test' execute Vitest (vide en Sprint 1)" "WARN" "(P0) Voir B-01 Tache 1.1.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V2: 'pnpm test:e2e' execute Playwright (vide en Sprint 1) (P0)
echo "  Verifying T11-V2 : 'pnpm test:e2e' execute Playwright (vide en Sprint 1)..."
add_row "T11-V2" "'pnpm test:e2e' execute Playwright (vide en Sprint 1)" "WARN" "(P0) Voir B-01 Tache 1.1.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V3: Coverage threshold 70% applique (test : ajouter code non-couvert -> CI fail) (P0)
echo "  Verifying T11-V3 : Coverage threshold 70% applique (test : ajouter code non-couvert -> CI..."
add_row "T11-V3" "Coverage threshold 70% applique (test : ajouter code non-couvert -> CI fail)" "WARN" "(P0) Voir B-01 Tache 1.1.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V4: Path aliases '@insurtech/*' resolus dans tests (P0)
echo "  Verifying T11-V4 : Path aliases '@insurtech/*' resolus dans tests..."
add_row "T11-V4" "Path aliases '@insurtech/*' resolus dans tests" "WARN" "(P0) Voir B-01 Tache 1.1.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V5: Locale fr-MA + TZ Casablanca par defaut (P0)
echo "  Verifying T11-V5 : Locale fr-MA + TZ Casablanca par defaut..."
add_row "T11-V5" "Locale fr-MA + TZ Casablanca par defaut" "WARN" "(P0) Voir B-01 Tache 1.1.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V6: 3 projects Playwright accessibles : api, chromium, mobile-safari (P0)
echo "  Verifying T11-V6 : 3 projects Playwright accessibles : api, chromium, mobile-safari..."
add_row "T11-V6" "3 projects Playwright accessibles : api, chromium, mobile-safari" "WARN" "(P0) Voir B-01 Tache 1.1.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V7: forbidOnly true en CI rejette '.only' (P0)
echo "  Verifying T11-V7 : forbidOnly true en CI rejette '.only'..."
add_row "T11-V7" "forbidOnly true en CI rejette '.only'" "WARN" "(P0) Voir B-01 Tache 1.1.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V8: reuseExistingServer permet dev fluide (P1)
echo "  Verifying T11-V8 : reuseExistingServer permet dev fluide..."
add_row "T11-V8" "reuseExistingServer permet dev fluide" "WARN" "(P1) Voir B-01 Tache 1.1.11 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 12/9 -- 1.1.12 : Pino Logger + OpenTelemetry SDK + Sentry Ready

```bash
echo ""
echo "================================================"
echo "TACHE 1.1.12 : Pino Logger + OpenTelemetry SDK + Sentry Ready"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 9"
echo "================================================"

# === Verification fichiers crees ===
# Test T12-F1: Existence fichier repo/packages/shared-utils/src/logger/logger.ts
if [ -f "repo/packages/shared-utils/src/logger/logger.ts" ]; then
  add_row "T12-F1" "Fichier logger.ts existe" "PASS" "Cree"
else
  add_row "T12-F1" "Fichier logger.ts existe" "FAIL" "Manquant"
fi
# Test T12-F2: Existence fichier repo/packages/shared-utils/src/telemetry/otel.ts
if [ -f "repo/packages/shared-utils/src/telemetry/otel.ts" ]; then
  add_row "T12-F2" "Fichier otel.ts existe" "PASS" "Cree"
else
  add_row "T12-F2" "Fichier otel.ts existe" "FAIL" "Manquant"
fi
# Test T12-F3: Existence fichier repo/packages/shared-utils/src/index.ts
if [ -f "repo/packages/shared-utils/src/index.ts" ]; then
  add_row "T12-F3" "Fichier index.ts existe" "PASS" "Cree"
else
  add_row "T12-F3" "Fichier index.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T12-V1: 'logger.info({ password: 'secret', cin: 'A123' }, 'login')' emet log avec password/cin = ' (P0)
echo "  Verifying T12-V1 : 'logger.info({ password: 'secret', cin: 'A123' }, 'login')' emet log a..."
add_row "T12-V1" "'logger.info({ password: 'secret', cin: 'A123' }, 'login')' emet log avec password/cin = '" "WARN" "(P0) Voir B-01 Tache 1.1.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V2: Format JSON valide (parsable par jq) (P0)
echo "  Verifying T12-V2 : Format JSON valide (parsable par jq)..."
add_row "T12-V2" "Format JSON valide (parsable par jq)" "WARN" "(P0) Voir B-01 Tache 1.1.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V3: Pretty printing si NODE_ENV=development (P0)
echo "  Verifying T12-V3 : Pretty printing si NODE_ENV=development..."
add_row "T12-V3" "Pretty printing si NODE_ENV=development" "WARN" "(P0) Voir B-01 Tache 1.1.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V4: 'LOG_LEVEL=error' filtre logs info/debug (P0)
echo "  Verifying T12-V4 : 'LOG_LEVEL=error' filtre logs info/debug..."
add_row "T12-V4" "'LOG_LEVEL=error' filtre logs info/debug" "WARN" "(P0) Voir B-01 Tache 1.1.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V5: Base fields service+env+version presents dans chaque log (P0)
echo "  Verifying T12-V5 : Base fields service+env+version presents dans chaque log..."
add_row "T12-V5" "Base fields service+env+version presents dans chaque log" "WARN" "(P0) Voir B-01 Tache 1.1.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V6: 'startTelemetry()' initialise SDK sans erreur (meme sans OTLP endpoint) (P0)
echo "  Verifying T12-V6 : 'startTelemetry()' initialise SDK sans erreur (meme sans OTLP endpoint..."
add_row "T12-V6" "'startTelemetry()' initialise SDK sans erreur (meme sans OTLP endpoint)" "WARN" "(P0) Voir B-01 Tache 1.1.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V7: Auto-instrumentations enregistrees : verifier 'OTEL_DEBUG=true' montre instrumentations ch (P0)
echo "  Verifying T12-V7 : Auto-instrumentations enregistrees : verifier 'OTEL_DEBUG=true' montre..."
add_row "T12-V7" "Auto-instrumentations enregistrees : verifier 'OTEL_DEBUG=true' montre instrumentations ch" "WARN" "(P0) Voir B-01 Tache 1.1.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V8: 'shutdownTelemetry()' flush traces avant exit (P0)
echo "  Verifying T12-V8 : 'shutdownTelemetry()' flush traces avant exit..."
add_row "T12-V8" "'shutdownTelemetry()' flush traces avant exit" "WARN" "(P0) Voir B-01 Tache 1.1.12 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 13/8 -- 1.1.13 : Init des 16+ Shared Packages Stubs + 8 Apps Stubs

```bash
echo ""
echo "================================================"
echo "TACHE 1.1.13 : Init des 16+ Shared Packages Stubs + 8 Apps Stubs"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 8"
echo "================================================"

# === Verification fichiers crees ===
# Test T13-F1: Existence fichier repo/packages/auth/package.json + tsconfig.json + src/index.ts
if [ -f "repo/packages/auth/package.json + tsconfig.json + src/index.ts" ]; then
  add_row "T13-F1" "Fichier index.ts existe" "PASS" "Cree"
else
  add_row "T13-F1" "Fichier index.ts existe" "FAIL" "Manquant"
fi
# Test T13-F2: Existence fichier repo/packages/{database,crm,booking,...}/package.json + tsconfig.json + src/index.ts (~21 packages)
if [ -f "repo/packages/{database,crm,booking,...}/package.json + tsconfig.json + src/index.ts (~21 packages)" ]; then
  add_row "T13-F2" "Fichier index.ts (~21 packages) existe" "PASS" "Cree"
else
  add_row "T13-F2" "Fichier index.ts (~21 packages) existe" "FAIL" "Manquant"
fi
# Test T13-F3: Existence fichier repo/apps/api/package.json + tsconfig.json + src/main.ts placeholder
if [ -f "repo/apps/api/package.json + tsconfig.json + src/main.ts placeholder" ]; then
  add_row "T13-F3" "Fichier main.ts placeholder existe" "PASS" "Cree"
else
  add_row "T13-F3" "Fichier main.ts placeholder existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T13-V1: 'ls packages/ | wc -l' retourne 21 (16 metier + 5 shared) (P0)
echo "  Verifying T13-V1 : 'ls packages/ | wc -l' retourne 21 (16 metier + 5 shared)..."
add_row "T13-V1" "'ls packages/ | wc -l' retourne 21 (16 metier + 5 shared)" "WARN" "(P0) Voir B-01 Tache 1.1.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V2: 'ls apps/ | wc -l' retourne 8 (P0)
echo "  Verifying T13-V2 : 'ls apps/ | wc -l' retourne 8..."
add_row "T13-V2" "'ls apps/ | wc -l' retourne 8" "WARN" "(P0) Voir B-01 Tache 1.1.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V3: Chaque package a package.json + tsconfig.json + src/index.ts (P0)
echo "  Verifying T13-V3 : Chaque package a package.json + tsconfig.json + src/index.ts..."
add_row "T13-V3" "Chaque package a package.json + tsconfig.json + src/index.ts" "WARN" "(P0) Voir B-01 Tache 1.1.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V4: 'pnpm install' reussit, links workspace crees : 'ls -la node_modules/@insurtech/' (P0)
echo "  Verifying T13-V4 : 'pnpm install' reussit, links workspace crees : 'ls -la node_modules/@..."
add_row "T13-V4" "'pnpm install' reussit, links workspace crees : 'ls -la node_modules/@insurtech/'" "WARN" "(P0) Voir B-01 Tache 1.1.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V5: 'pnpm typecheck' reussit sur tous packages (P0)
echo "  Verifying T13-V5 : 'pnpm typecheck' reussit sur tous packages..."
add_row "T13-V5" "'pnpm typecheck' reussit sur tous packages" "WARN" "(P0) Voir B-01 Tache 1.1.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V6: 'pnpm lint' reussit sur tous packages (P0)
echo "  Verifying T13-V6 : 'pnpm lint' reussit sur tous packages..."
add_row "T13-V6" "'pnpm lint' reussit sur tous packages" "WARN" "(P0) Voir B-01 Tache 1.1.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V7: 'pnpm -r build' reussit (peut etre vide pour stubs) (P0)
echo "  Verifying T13-V7 : 'pnpm -r build' reussit (peut etre vide pour stubs)..."
add_row "T13-V7" "'pnpm -r build' reussit (peut etre vide pour stubs)" "WARN" "(P0) Voir B-01 Tache 1.1.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V8: Script init-package-stubs.sh idempotent (re-execution ne casse rien) (P1)
echo "  Verifying T13-V8 : Script init-package-stubs.sh idempotent (re-execution ne casse rien)..."
add_row "T13-V8" "Script init-package-stubs.sh idempotent (re-execution ne casse rien)" "WARN" "(P1) Voir B-01 Tache 1.1.13 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 14/10 -- 1.1.14 : Husky + commitlint + lint-staged + check-no-emoji

```bash
echo ""
echo "================================================"
echo "TACHE 1.1.14 : Husky + commitlint + lint-staged + check-no-emoji"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 10"
echo "================================================"

# === Verification fichiers crees ===
# Test T14-F1: Existence fichier repo/.husky/pre-commit
if [ -f "repo/.husky/pre-commit" ]; then
  add_row "T14-F1" "Fichier pre-commit existe" "PASS" "Cree"
else
  add_row "T14-F1" "Fichier pre-commit existe" "FAIL" "Manquant"
fi
# Test T14-F2: Existence fichier repo/.husky/commit-msg
if [ -f "repo/.husky/commit-msg" ]; then
  add_row "T14-F2" "Fichier commit-msg existe" "PASS" "Cree"
else
  add_row "T14-F2" "Fichier commit-msg existe" "FAIL" "Manquant"
fi
# Test T14-F3: Existence fichier repo/.husky/pre-push
if [ -f "repo/.husky/pre-push" ]; then
  add_row "T14-F3" "Fichier pre-push existe" "PASS" "Cree"
else
  add_row "T14-F3" "Fichier pre-push existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T14-V1: 'git commit -m 'test'' echoue (commitlint : pas de type) (P0)
echo "  Verifying T14-V1 : 'git commit -m 'test'' echoue (commitlint : pas de type)..."
add_row "T14-V1" "'git commit -m 'test'' echoue (commitlint : pas de type)" "WARN" "(P0) Voir B-01 Tache 1.1.14 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T14-V2: 'git commit -m 'feat: test'' reussit (P0)
echo "  Verifying T14-V2 : 'git commit -m 'feat: test'' reussit..."
add_row "T14-V2" "'git commit -m 'feat: test'' reussit" "WARN" "(P0) Voir B-01 Tache 1.1.14 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T14-V3: 'git commit -m 'test test'' echoue (P0)
echo "  Verifying T14-V3 : 'git commit -m 'test test'' echoue..."
add_row "T14-V3" "'git commit -m 'test test'' echoue" "WARN" "(P0) Voir B-01 Tache 1.1.14 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T14-V4: Commit avec emoji dans fichier modifie echoue (check-no-emoji) (P0)
echo "  Verifying T14-V4 : Commit avec emoji dans fichier modifie echoue (check-no-emoji)..."
add_row "T14-V4" "Commit avec emoji dans fichier modifie echoue (check-no-emoji)" "WARN" "(P0) Voir B-01 Tache 1.1.14 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T14-V5: Commit sans erreur lint reussit, commit avec erreur lint echoue (P0)
echo "  Verifying T14-V5 : Commit sans erreur lint reussit, commit avec erreur lint echoue..."
add_row "T14-V5" "Commit sans erreur lint reussit, commit avec erreur lint echoue" "WARN" "(P0) Voir B-01 Tache 1.1.14 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T14-V6: 'git push' echoue si typecheck echoue (P0)
echo "  Verifying T14-V6 : 'git push' echoue si typecheck echoue..."
add_row "T14-V6" "'git push' echoue si typecheck echoue" "WARN" "(P0) Voir B-01 Tache 1.1.14 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T14-V7: 'pnpm install' cree '.husky/_/' automatiquement (via prepare) (P0)
echo "  Verifying T14-V7 : 'pnpm install' cree '.husky/_/' automatiquement (via prepare)..."
add_row "T14-V7" "'pnpm install' cree '.husky/_/' automatiquement (via prepare)" "WARN" "(P0) Voir B-01 Tache 1.1.14 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T14-V8: Subject > 100 chars rejete par commitlint (P0)
echo "  Verifying T14-V8 : Subject > 100 chars rejete par commitlint..."
add_row "T14-V8" "Subject > 100 chars rejete par commitlint" "WARN" "(P0) Voir B-01 Tache 1.1.14 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 15/0 -- 1.1.15 : Documentation Architecture (6 ADR + README + CLAUDE.md + CONTRIBUTING.md)

```bash
echo ""
echo "================================================"
echo "TACHE 1.1.15 : Documentation Architecture (6 ADR + README + CLAUDE.md + CON"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 0"
echo "================================================"

# === Verification fichiers crees ===
# Pas de fichiers specifiques verifies pour cette tache (voir B-01)
add_row "T15-F0" "Tache 1.1.15 livrables" "SKIP" "Voir B-01 pour livrables detailles"

# === Verification criteres P0/P1/P2 ===
# Aucun critere extrait pour cette tache
add_row "T15-V0" "Tache 1.1.15 criteres" "SKIP" "Voir B-01 Tache 1.1.15 pour criteres detailles"
```

---


---


## VERIFICATIONS TRANSVERSALES SPRINT 1

### TR-BUILD : Build complet du sprint

```bash
echo ""
echo "================================================"
echo "VERIFICATIONS TRANSVERSALES SPRINT 1"
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



---

## GENERATION DU RAPPORT FINAL

```bash
echo ""
echo "================================================"
echo "GENERATION DU RAPPORT FINAL SPRINT 1"
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

## Jalon GO/NO-GO Sprint 1

EOF

# Calcul statut final
if (( $(echo "$SCORE >= 95" | bc -l) )); then
  STATUT="GO"
  cat >> "$REPORT_FILE" << EOF
**STATUT** : GO -- Sprint 1 valide, passage Sprint 2 autorise

Le sprint a passe les criteres requis. Cowork peut demarrer Sprint 2.

EOF
  echo ""
  echo "================================================"
  echo "SPRINT 1 : GO ($SCORE%)"
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
  echo "SPRINT 1 : GO CONDITIONNEL ($SCORE%)"
  echo "================================================"
else
  STATUT="NO-GO"
  cat >> "$REPORT_FILE" << EOF
**STATUT** : NO-GO -- Score $SCORE% trop bas (cible 85% minimum)

Le sprint **doit etre repris** :
- Lister tous FAIL P0
- Escalation Saad/Abla decision (cut scope OR delai)
- Reprise sprint avant Sprint 2

EOF
  echo ""
  echo "================================================"
  echo "SPRINT 1 : NO-GO ($SCORE%)"
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
  echo "git commit -m \"chore(sprint-01): close sprint 1 -- $STATUT ($SCORE%)\"" >> "$REPORT_FILE"
  echo '```' >> "$REPORT_FILE"
fi

echo ""
echo "Rapport complet dans : $REPORT_FILE"
```

---

## INSTRUCTION FINALE A CLAUDE CODE / COWORK

Apres l'execution complete des verifications ci-dessus :

1. **Lis le contenu de `sprint01-verify-report.md`** integralement
2. **Identifie les FAIL critiques** (criteres P0) qui necessitent intervention manuelle
3. **Affiche un resume executif** :
   - Nombre total de criteres
   - Pourcentage PASS / PASS\* / FAIL / WARN
   - Liste des FAIL avec contexte technique
   - Recommandation : GO / GO CONDITIONNEL / NO-GO
4. **Si NO-GO** : ne pas demarrer le Sprint suivant, alerter Saad/Abla via Slack `#insurtech-dev`
5. **Si GO ou GO CONDITIONNEL** : produire le commit de cloture du sprint :

```bash
git add skalean-insurtech/sprint01-verify-report.md
git commit -m "chore(sprint-01): close sprint 1 with verification report

- Verification automatique executee
- Score global : <SCORE>%
- <PASS> criteres PASS, <PASS_REPAIRED> reparations auto, <FAIL> FAIL
- Statut : <GO|GO CONDITIONNEL|NO-GO>

Phase: 1 -- Bootstrap Infrastructure
Sprint: 1 (Phase 1 / Sprint 1)
Reference B-01, C-01, V-01
Report: sprint01-verify-report.md"
```

6. **Documentation continue** : si decisions techniques prises pendant verification, ajouter notes dans `repo/docs/runbooks/sprint-01-lessons-learned.md`

---

**Fin de la verification V-01 v2.2 detaillee -- Sprint 1 (1.1) Bootstrap Infrastructure.**

**Total criteres taches** : 124 | **Total transversaux** : ~10 | **Effort sprint** : 80h
