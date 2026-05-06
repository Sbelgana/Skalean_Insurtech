# VERIFICATION SPRINT 6 -- Phase 2 / Sprint 2 : Multi-Tenant 3 Niveaux + RLS
# Version : Auto-reparation active + Rapport final MD detaille
# 12 taches, 106 criteres extraits B-06
# AUCUNE EMOJI AUTORISEE

**Version** : v2.2 (verification detaillee)
**Phase** : 2 -- Securite
**Sprint** : 6 / 35 (cumul) -- Sprint 2 dans Phase 2
**Reference meta-prompt** : `B-06-sprint-06-multi-tenant.md`
**Reference orchestrateur** : `C-06-sprint-06-multi-tenant.md`
**Total criteres** : 106 criteres taches + ~10 transversaux

---

Tu es **Claude Code (ou Cowork)**. Tu dois executer une **verification COMPLETE et EXHAUSTIVE** du Sprint 6 apres execution toutes les 12 taches.

---

## REGLES D'EXECUTION

1. Tu **executes CHAQUE verification dans l'ordre** (taches puis transversales)
2. Quand une verification echoue, tu **TENTES UNE REPARATION AUTOMATIQUE** avant de noter FAIL
3. Apres chaque tentative de reparation, tu **re-executes la verification**
4. Tu consignes dans `sprint06-verify-report.md` **TOUS les resultats** au fil de l'execution
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
REPORT_FILE="sprint06-verify-report.md"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
RUN_ID=$(date '+%Y%m%d-%H%M%S')

cat > "$REPORT_FILE" << EOF
# Rapport de Verification - Sprint 6 : Multi-Tenant 3 Niveaux + RLS

**Date** : $TIMESTAMP
**Run ID** : $RUN_ID
**Phase** : 2 -- Securite
**Sprint** : 6 (Phase 2 / Sprint 2)
**Reference B-06** : 12 taches, 106 criteres extraits
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

## TACHE 1/8 -- 2.2.1 : TenantContextService : AsyncLocalStorage + Types

```bash
echo ""
echo "================================================"
echo "TACHE 2.2.1 : TenantContextService : AsyncLocalStorage + Types"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 8"
echo "================================================"

# === Verification fichiers crees ===
# Test T01-F1: Existence fichier repo/packages/auth/src/services/tenant-context.service.ts
if [ -f "repo/packages/auth/src/services/tenant-context.service.ts" ]; then
  add_row "T01-F1" "Fichier tenant-context.service.ts existe" "PASS" "Cree"
else
  add_row "T01-F1" "Fichier tenant-context.service.ts existe" "FAIL" "Manquant"
fi
# Test T01-F2: Existence fichier repo/packages/auth/src/services/tenant-context.service.spec.ts
if [ -f "repo/packages/auth/src/services/tenant-context.service.spec.ts" ]; then
  add_row "T01-F2" "Fichier tenant-context.service.spec.ts existe" "PASS" "Cree"
else
  add_row "T01-F2" "Fichier tenant-context.service.spec.ts existe" "FAIL" "Manquant"
fi
# Test T01-F3: Existence fichier repo/packages/auth/src/types/tenant-context.ts
if [ -f "repo/packages/auth/src/types/tenant-context.ts" ]; then
  add_row "T01-F3" "Fichier tenant-context.ts existe" "PASS" "Cree"
else
  add_row "T01-F3" "Fichier tenant-context.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T01-V1: 'runWithContext(ctx, fn)' execute fn avec context accessible (P0)
echo "  Verifying T01-V1 : 'runWithContext(ctx, fn)' execute fn avec context accessible..."
add_row "T01-V1" "'runWithContext(ctx, fn)' execute fn avec context accessible" "WARN" "(P0) Voir B-06 Tache 2.2.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V2: 'getCurrentContext()' retourne context actif (P0)
echo "  Verifying T01-V2 : 'getCurrentContext()' retourne context actif..."
add_row "T01-V2" "'getCurrentContext()' retourne context actif" "WARN" "(P0) Voir B-06 Tache 2.2.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V3: 2 requests paralleles ont contexts isoles (test integration) (P0)
echo "  Verifying T01-V3 : 2 requests paralleles ont contexts isoles (test integration)..."
add_row "T01-V3" "2 requests paralleles ont contexts isoles (test integration)" "WARN" "(P0) Voir B-06 Tache 2.2.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V4: 'requireTenantId()' throws si pas de context (P0)
echo "  Verifying T01-V4 : 'requireTenantId()' throws si pas de context..."
add_row "T01-V4" "'requireTenantId()' throws si pas de context" "WARN" "(P0) Voir B-06 Tache 2.2.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V5: 'requireSuperAdmin()' throws si !isSuperAdmin (P0)
echo "  Verifying T01-V5 : 'requireSuperAdmin()' throws si !isSuperAdmin..."
add_row "T01-V5" "'requireSuperAdmin()' throws si !isSuperAdmin" "WARN" "(P0) Voir B-06 Tache 2.2.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V6: Helpers retournent bonnes valeurs (5+ tests) (P0)
echo "  Verifying T01-V6 : Helpers retournent bonnes valeurs (5+ tests)..."
add_row "T01-V6" "Helpers retournent bonnes valeurs (5+ tests)" "WARN" "(P0) Voir B-06 Tache 2.2.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V7: Async/await + setTimeout propagent context correctement (P0)
echo "  Verifying T01-V7 : Async/await + setTimeout propagent context correctement..."
add_row "T01-V7" "Async/await + setTimeout propagent context correctement" "WARN" "(P0) Voir B-06 Tache 2.2.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V8: Tests integration confirment isolation (P1)
echo "  Verifying T01-V8 : Tests integration confirment isolation..."
add_row "T01-V8" "Tests integration confirment isolation" "WARN" "(P1) Voir B-06 Tache 2.2.1 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 2/10 -- 2.2.2 : TenantContextMiddleware : Lit x-tenant-id + Valide

```bash
echo ""
echo "================================================"
echo "TACHE 2.2.2 : TenantContextMiddleware : Lit x-tenant-id + Valide"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 10"
echo "================================================"

# === Verification fichiers crees ===
# Test T02-F1: Existence fichier repo/apps/api/src/common/middleware/tenant-context.middleware.ts
if [ -f "repo/apps/api/src/common/middleware/tenant-context.middleware.ts" ]; then
  add_row "T02-F1" "Fichier tenant-context.middleware.ts existe" "PASS" "Cree"
else
  add_row "T02-F1" "Fichier tenant-context.middleware.ts existe" "FAIL" "Manquant"
fi
# Test T02-F2: Existence fichier repo/apps/api/src/common/middleware/tenant-context.middleware.spec.ts
if [ -f "repo/apps/api/src/common/middleware/tenant-context.middleware.spec.ts" ]; then
  add_row "T02-F2" "Fichier tenant-context.middleware.spec.ts existe" "PASS" "Cree"
else
  add_row "T02-F2" "Fichier tenant-context.middleware.spec.ts existe" "FAIL" "Manquant"
fi
# Test T02-F3: Existence fichier repo/apps/api/src/app.module.ts
if [ -f "repo/apps/api/src/app.module.ts" ]; then
  add_row "T02-F3" "Fichier app.module.ts existe" "PASS" "Cree"
else
  add_row "T02-F3" "Fichier app.module.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T02-V1: Header valide -> context cree avec tenantId (P0)
echo "  Verifying T02-V1 : Header valide -> context cree avec tenantId..."
add_row "T02-V1" "Header valide -> context cree avec tenantId" "WARN" "(P0) Voir B-06 Tache 2.2.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V2: Header invalide UUID -> 400 (P0)
echo "  Verifying T02-V2 : Header invalide UUID -> 400..."
add_row "T02-V2" "Header invalide UUID -> 400" "WARN" "(P0) Voir B-06 Tache 2.2.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V3: Header absent sur route protected -> 400 (PublicEndpointGuard Sprint 3) (P0)
echo "  Verifying T02-V3 : Header absent sur route protected -> 400 (PublicEndpointGuard Sprint 3..."
add_row "T02-V3" "Header absent sur route protected -> 400 (PublicEndpointGuard Sprint 3)" "WARN" "(P0) Voir B-06 Tache 2.2.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V4: Header present mais user pas acces -> 403 TENANT_ACCESS_DENIED (P0)
echo "  Verifying T02-V4 : Header present mais user pas acces -> 403 TENANT_ACCESS_DENIED..."
add_row "T02-V4" "Header present mais user pas acces -> 403 TENANT_ACCESS_DENIED" "WARN" "(P0) Voir B-06 Tache 2.2.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V5: Routes /admin/* -> isSuperAdmin true, tenantId undefined (P0)
echo "  Verifying T02-V5 : Routes /admin/* -> isSuperAdmin true, tenantId undefined..."
add_row "T02-V5" "Routes /admin/* -> isSuperAdmin true, tenantId undefined" "WARN" "(P0) Voir B-06 Tache 2.2.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V6: Routes /assure/* -> assureUserId set (P0)
echo "  Verifying T02-V6 : Routes /assure/* -> assureUserId set..."
add_row "T02-V6" "Routes /assure/* -> assureUserId set" "WARN" "(P0) Voir B-06 Tache 2.2.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V7: Cache Redis hit 2eme request meme user/tenant (P0)
echo "  Verifying T02-V7 : Cache Redis hit 2eme request meme user/tenant..."
add_row "T02-V7" "Cache Redis hit 2eme request meme user/tenant" "WARN" "(P0) Voir B-06 Tache 2.2.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V8: Tenant suspendu -> 403 TENANT_SUSPENDED (P0)
echo "  Verifying T02-V8 : Tenant suspendu -> 403 TENANT_SUSPENDED..."
add_row "T02-V8" "Tenant suspendu -> 403 TENANT_SUSPENDED" "WARN" "(P0) Voir B-06 Tache 2.2.2 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 3/6 -- 2.2.3 : TenantContextGuard + Decorators

```bash
echo ""
echo "================================================"
echo "TACHE 2.2.3 : TenantContextGuard + Decorators"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 6"
echo "================================================"

# === Verification fichiers crees ===
# Test T03-F1: Existence fichier repo/apps/api/src/common/guards/tenant-context.guard.ts
if [ -f "repo/apps/api/src/common/guards/tenant-context.guard.ts" ]; then
  add_row "T03-F1" "Fichier tenant-context.guard.ts existe" "PASS" "Cree"
else
  add_row "T03-F1" "Fichier tenant-context.guard.ts existe" "FAIL" "Manquant"
fi
# Test T03-F2: Existence fichier repo/apps/api/src/common/decorators/tenant-id.decorator.ts
if [ -f "repo/apps/api/src/common/decorators/tenant-id.decorator.ts" ]; then
  add_row "T03-F2" "Fichier tenant-id.decorator.ts existe" "PASS" "Cree"
else
  add_row "T03-F2" "Fichier tenant-id.decorator.ts existe" "FAIL" "Manquant"
fi
# Test T03-F3: Existence fichier repo/apps/api/src/common/decorators/current-tenant.decorator.ts
if [ -f "repo/apps/api/src/common/decorators/current-tenant.decorator.ts" ]; then
  add_row "T03-F3" "Fichier current-tenant.decorator.ts existe" "PASS" "Cree"
else
  add_row "T03-F3" "Fichier current-tenant.decorator.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T03-V1: '@TenantId()' retourne tenantId du context (P0)
echo "  Verifying T03-V1 : '@TenantId()' retourne tenantId du context..."
add_row "T03-V1" "'@TenantId()' retourne tenantId du context" "WARN" "(P0) Voir B-06 Tache 2.2.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V2: '@CurrentTenant()' retourne TenantSettings (P0)
echo "  Verifying T03-V2 : '@CurrentTenant()' retourne TenantSettings..."
add_row "T03-V2" "'@CurrentTenant()' retourne TenantSettings" "WARN" "(P0) Voir B-06 Tache 2.2.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V3: '@AssureUserId()' retourne assureUserId si L3 (P0)
echo "  Verifying T03-V3 : '@AssureUserId()' retourne assureUserId si L3..."
add_row "T03-V3" "'@AssureUserId()' retourne assureUserId si L3" "WARN" "(P0) Voir B-06 Tache 2.2.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V4: Guard rejette si tenantId manquant sur endpoint normal (P0)
echo "  Verifying T03-V4 : Guard rejette si tenantId manquant sur endpoint normal..."
add_row "T03-V4" "Guard rejette si tenantId manquant sur endpoint normal" "WARN" "(P0) Voir B-06 Tache 2.2.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V5: '@AdminOnly()' decorator pour route admin (P0)
echo "  Verifying T03-V5 : '@AdminOnly()' decorator pour route admin..."
add_row "T03-V5" "'@AdminOnly()' decorator pour route admin" "WARN" "(P0) Voir B-06 Tache 2.2.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V6: Tests decorators 4+ scenarios (P1)
echo "  Verifying T03-V6 : Tests decorators 4+ scenarios..."
add_row "T03-V6" "Tests decorators 4+ scenarios" "WARN" "(P1) Voir B-06 Tache 2.2.3 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 4/9 -- 2.2.4 : TenantTransactionInterceptor : SET LOCAL Postgres Automatique

```bash
echo ""
echo "================================================"
echo "TACHE 2.2.4 : TenantTransactionInterceptor : SET LOCAL Postgres Automatiqu"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 9"
echo "================================================"

# === Verification fichiers crees ===
# Test T04-F1: Existence fichier repo/apps/api/src/common/interceptors/tenant-transaction.interceptor.ts
if [ -f "repo/apps/api/src/common/interceptors/tenant-transaction.interceptor.ts" ]; then
  add_row "T04-F1" "Fichier tenant-transaction.interceptor.ts existe" "PASS" "Cree"
else
  add_row "T04-F1" "Fichier tenant-transaction.interceptor.ts existe" "FAIL" "Manquant"
fi
# Test T04-F2: Existence fichier repo/apps/api/src/common/interceptors/tenant-transaction.interceptor.spec.ts
if [ -f "repo/apps/api/src/common/interceptors/tenant-transaction.interceptor.spec.ts" ]; then
  add_row "T04-F2" "Fichier tenant-transaction.interceptor.spec.ts existe" "PASS" "Cree"
else
  add_row "T04-F2" "Fichier tenant-transaction.interceptor.spec.ts existe" "FAIL" "Manquant"
fi
# Test T04-F3: Existence fichier repo/apps/api/src/common/decorators/skip-tenant-transaction.decorator.ts
if [ -f "repo/apps/api/src/common/decorators/skip-tenant-transaction.decorator.ts" ]; then
  add_row "T04-F3" "Fichier skip-tenant-transaction.decorator.ts existe" "PASS" "Cree"
else
  add_row "T04-F3" "Fichier skip-tenant-transaction.decorator.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T04-V1: Endpoint normal : SET LOCAL execute avant handler (P0)
echo "  Verifying T04-V1 : Endpoint normal : SET LOCAL execute avant handler..."
add_row "T04-V1" "Endpoint normal : SET LOCAL execute avant handler" "WARN" "(P0) Voir B-06 Tache 2.2.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V2: Test RLS : INSERT auto-injecte tenant_id (subscriber Sprint 2 utilise) (P0)
echo "  Verifying T04-V2 : Test RLS : INSERT auto-injecte tenant_id (subscriber Sprint 2 utilise)..."
add_row "T04-V2" "Test RLS : INSERT auto-injecte tenant_id (subscriber Sprint 2 utilise)" "WARN" "(P0) Voir B-06 Tache 2.2.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V3: Test SELECT : retourne uniquement rows tenant courant (P0)
echo "  Verifying T04-V3 : Test SELECT : retourne uniquement rows tenant courant..."
add_row "T04-V3" "Test SELECT : retourne uniquement rows tenant courant" "WARN" "(P0) Voir B-06 Tache 2.2.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V4: Endpoint admin : SET LOCAL is_super_admin -> SELECT cross-tenant OK (P0)
echo "  Verifying T04-V4 : Endpoint admin : SET LOCAL is_super_admin -> SELECT cross-tenant OK..."
add_row "T04-V4" "Endpoint admin : SET LOCAL is_super_admin -> SELECT cross-tenant OK" "WARN" "(P0) Voir B-06 Tache 2.2.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V5: Endpoint assure (L3) : SET LOCAL assure_user_id (P0)
echo "  Verifying T04-V5 : Endpoint assure (L3) : SET LOCAL assure_user_id..."
add_row "T04-V5" "Endpoint assure (L3) : SET LOCAL assure_user_id" "WARN" "(P0) Voir B-06 Tache 2.2.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V6: Exception dans handler -> transaction rollback (P0)
echo "  Verifying T04-V6 : Exception dans handler -> transaction rollback..."
add_row "T04-V6" "Exception dans handler -> transaction rollback" "WARN" "(P0) Voir B-06 Tache 2.2.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V7: '@SkipTenantTransaction()' : pas de transaction wrap (P0)
echo "  Verifying T04-V7 : '@SkipTenantTransaction()' : pas de transaction wrap..."
add_row "T04-V7" "'@SkipTenantTransaction()' : pas de transaction wrap" "WARN" "(P0) Voir B-06 Tache 2.2.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V8: Performance overhead < 10ms par endpoint (P0)
echo "  Verifying T04-V8 : Performance overhead < 10ms par endpoint..."
add_row "T04-V8" "Performance overhead < 10ms par endpoint" "WARN" "(P0) Voir B-06 Tache 2.2.4 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 5/9 -- 2.2.5 : TenantValidationService : Existence + Actif + Suspension

```bash
echo ""
echo "================================================"
echo "TACHE 2.2.5 : TenantValidationService : Existence + Actif + Suspension"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 9"
echo "================================================"

# === Verification fichiers crees ===
# Test T05-F1: Existence fichier repo/apps/api/src/modules/tenant/services/tenant-validation.service.ts
if [ -f "repo/apps/api/src/modules/tenant/services/tenant-validation.service.ts" ]; then
  add_row "T05-F1" "Fichier tenant-validation.service.ts existe" "PASS" "Cree"
else
  add_row "T05-F1" "Fichier tenant-validation.service.ts existe" "FAIL" "Manquant"
fi
# Test T05-F2: Existence fichier repo/apps/api/src/modules/tenant/services/tenant-validation.service.spec.ts
if [ -f "repo/apps/api/src/modules/tenant/services/tenant-validation.service.spec.ts" ]; then
  add_row "T05-F2" "Fichier tenant-validation.service.spec.ts existe" "PASS" "Cree"
else
  add_row "T05-F2" "Fichier tenant-validation.service.spec.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T05-V1: 'tenantExists' retourne true/false correct (P0)
echo "  Verifying T05-V1 : 'tenantExists' retourne true/false correct..."
add_row "T05-V1" "'tenantExists' retourne true/false correct" "WARN" "(P0) Voir B-06 Tache 2.2.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V2: 'getTenantById' retourne tenant ou null (P0)
echo "  Verifying T05-V2 : 'getTenantById' retourne tenant ou null..."
add_row "T05-V2" "'getTenantById' retourne tenant ou null" "WARN" "(P0) Voir B-06 Tache 2.2.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V3: 'isTenantActive' rejette suspended/archived (P0)
echo "  Verifying T05-V3 : 'isTenantActive' rejette suspended/archived..."
add_row "T05-V3" "'isTenantActive' rejette suspended/archived" "WARN" "(P0) Voir B-06 Tache 2.2.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V4: 'userCanAccessTenant' retourne role si autorise (P0)
echo "  Verifying T05-V4 : 'userCanAccessTenant' retourne role si autorise..."
add_row "T05-V4" "'userCanAccessTenant' retourne role si autorise" "WARN" "(P0) Voir B-06 Tache 2.2.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V5: 'userCanAccessTenant' retourne reason si rejected (P0)
echo "  Verifying T05-V5 : 'userCanAccessTenant' retourne reason si rejected..."
add_row "T05-V5" "'userCanAccessTenant' retourne reason si rejected" "WARN" "(P0) Voir B-06 Tache 2.2.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V6: 'requireActiveTenant' throws ForbiddenException si suspendu (P0)
echo "  Verifying T05-V6 : 'requireActiveTenant' throws ForbiddenException si suspendu..."
add_row "T05-V6" "'requireActiveTenant' throws ForbiddenException si suspendu" "WARN" "(P0) Voir B-06 Tache 2.2.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V7: Cache Redis hit 2e call meme params (P0)
echo "  Verifying T05-V7 : Cache Redis hit 2e call meme params..."
add_row "T05-V7" "Cache Redis hit 2e call meme params" "WARN" "(P0) Voir B-06 Tache 2.2.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V8: Cache invalide via event Kafka (P0)
echo "  Verifying T05-V8 : Cache invalide via event Kafka..."
add_row "T05-V8" "Cache invalide via event Kafka" "WARN" "(P0) Voir B-06 Tache 2.2.5 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 6/10 -- 2.2.6 : CrossTenantAuthorizationService : 3 Types v2.0

```bash
echo ""
echo "================================================"
echo "TACHE 2.2.6 : CrossTenantAuthorizationService : 3 Types v2.0"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 10"
echo "================================================"

# === Verification fichiers crees ===
# Test T06-F1: Existence fichier repo/apps/api/src/modules/tenant/services/cross-tenant-authorization.service.ts
if [ -f "repo/apps/api/src/modules/tenant/services/cross-tenant-authorization.service.ts" ]; then
  add_row "T06-F1" "Fichier cross-tenant-authorization.service.ts existe" "PASS" "Cree"
else
  add_row "T06-F1" "Fichier cross-tenant-authorization.service.ts existe" "FAIL" "Manquant"
fi
# Test T06-F2: Existence fichier repo/apps/api/src/modules/tenant/services/cross-tenant-authorization.service.spec.ts
if [ -f "repo/apps/api/src/modules/tenant/services/cross-tenant-authorization.service.spec.ts" ]; then
  add_row "T06-F2" "Fichier cross-tenant-authorization.service.spec.ts existe" "PASS" "Cree"
else
  add_row "T06-F2" "Fichier cross-tenant-authorization.service.spec.ts existe" "FAIL" "Manquant"
fi
# Test T06-F3: Existence fichier repo/packages/database/src/entities/system/cross-tenant-authorization.entity.ts
if [ -f "repo/packages/database/src/entities/system/cross-tenant-authorization.entity.ts" ]; then
  add_row "T06-F3" "Fichier cross-tenant-authorization.entity.ts existe" "PASS" "Cree"
else
  add_row "T06-F3" "Fichier cross-tenant-authorization.entity.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T06-V1: 3 types declares en enum (P0)
echo "  Verifying T06-V1 : 3 types declares en enum..."
add_row "T06-V1" "3 types declares en enum" "WARN" "(P0) Voir B-06 Tache 2.2.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V2: 'create()' INSERT row + audit log (P0)
echo "  Verifying T06-V2 : 'create()' INSERT row + audit log..."
add_row "T06-V2" "'create()' INSERT row + audit log" "WARN" "(P0) Voir B-06 Tache 2.2.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V3: 'validate()' retourne allowed=true si actif (P0)
echo "  Verifying T06-V3 : 'validate()' retourne allowed=true si actif..."
add_row "T06-V3" "'validate()' retourne allowed=true si actif" "WARN" "(P0) Voir B-06 Tache 2.2.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V4: 'validate()' rejette si revoked_at set (P0)
echo "  Verifying T06-V4 : 'validate()' rejette si revoked_at set..."
add_row "T06-V4" "'validate()' rejette si revoked_at set" "WARN" "(P0) Voir B-06 Tache 2.2.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V5: 'validate()' rejette si expires_at passe (P0)
echo "  Verifying T06-V5 : 'validate()' rejette si expires_at passe..."
add_row "T06-V5" "'validate()' rejette si expires_at passe" "WARN" "(P0) Voir B-06 Tache 2.2.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V6: 'revoke()' set revoked_at + reason (P0)
echo "  Verifying T06-V6 : 'revoke()' set revoked_at + reason..."
add_row "T06-V6" "'revoke()' set revoked_at + reason" "WARN" "(P0) Voir B-06 Tache 2.2.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V7: 'listForTenant' retourne authz from + to ce tenant (P0)
echo "  Verifying T06-V7 : 'listForTenant' retourne authz from + to ce tenant..."
add_row "T06-V7" "'listForTenant' retourne authz from + to ce tenant" "WARN" "(P0) Voir B-06 Tache 2.2.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V8: Scope check : action hors scope rejetee (P0)
echo "  Verifying T06-V8 : Scope check : action hors scope rejetee..."
add_row "T06-V8" "Scope check : action hors scope rejetee" "WARN" "(P0) Voir B-06 Tache 2.2.6 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 7/10 -- 2.2.7 : TenantManagementService + Endpoints CRUD

```bash
echo ""
echo "================================================"
echo "TACHE 2.2.7 : TenantManagementService + Endpoints CRUD"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 10"
echo "================================================"

# === Verification fichiers crees ===
# Test T07-F1: Existence fichier repo/apps/api/src/modules/tenant/services/tenant-management.service.ts
if [ -f "repo/apps/api/src/modules/tenant/services/tenant-management.service.ts" ]; then
  add_row "T07-F1" "Fichier tenant-management.service.ts existe" "PASS" "Cree"
else
  add_row "T07-F1" "Fichier tenant-management.service.ts existe" "FAIL" "Manquant"
fi
# Test T07-F2: Existence fichier repo/apps/api/src/modules/admin/controllers/admin-tenants.controller.ts
if [ -f "repo/apps/api/src/modules/admin/controllers/admin-tenants.controller.ts" ]; then
  add_row "T07-F2" "Fichier admin-tenants.controller.ts existe" "PASS" "Cree"
else
  add_row "T07-F2" "Fichier admin-tenants.controller.ts existe" "FAIL" "Manquant"
fi
# Test T07-F3: Existence fichier repo/apps/api/src/modules/admin/dto/tenant.dto.ts
if [ -f "repo/apps/api/src/modules/admin/dto/tenant.dto.ts" ]; then
  add_row "T07-F3" "Fichier tenant.dto.ts existe" "PASS" "Cree"
else
  add_row "T07-F3" "Fichier tenant.dto.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T07-V1: POST /admin/tenants cree tenant avec super admin token (P0)
echo "  Verifying T07-V1 : POST /admin/tenants cree tenant avec super admin token..."
add_row "T07-V1" "POST /admin/tenants cree tenant avec super admin token" "WARN" "(P0) Voir B-06 Tache 2.2.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V2: POST /admin/tenants sans super admin -> 403 (P0)
echo "  Verifying T07-V2 : POST /admin/tenants sans super admin -> 403..."
add_row "T07-V2" "POST /admin/tenants sans super admin -> 403" "WARN" "(P0) Voir B-06 Tache 2.2.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V3: GET liste retourne pagination (P0)
echo "  Verifying T07-V3 : GET liste retourne pagination..."
add_row "T07-V3" "GET liste retourne pagination" "WARN" "(P0) Voir B-06 Tache 2.2.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V4: PATCH update + cache invalide (P0)
echo "  Verifying T07-V4 : PATCH update + cache invalide..."
add_row "T07-V4" "PATCH update + cache invalide" "WARN" "(P0) Voir B-06 Tache 2.2.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V5: DELETE soft delete (deleted_at set) (P0)
echo "  Verifying T07-V5 : DELETE soft delete (deleted_at set)..."
add_row "T07-V5" "DELETE soft delete (deleted_at set)" "WARN" "(P0) Voir B-06 Tache 2.2.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V6: GET /:id/users retourne users du tenant (P0)
echo "  Verifying T07-V6 : GET /:id/users retourne users du tenant..."
add_row "T07-V6" "GET /:id/users retourne users du tenant" "WARN" "(P0) Voir B-06 Tache 2.2.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V7: GET /:id/stats retourne stats correctes (P0)
echo "  Verifying T07-V7 : GET /:id/stats retourne stats correctes..."
add_row "T07-V7" "GET /:id/stats retourne stats correctes" "WARN" "(P0) Voir B-06 Tache 2.2.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V8: Filtres marchent (type, status, search) (P0)
echo "  Verifying T07-V8 : Filtres marchent (type, status, search)..."
add_row "T07-V8" "Filtres marchent (type, status, search)" "WARN" "(P0) Voir B-06 Tache 2.2.7 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 8/9 -- 2.2.8 : TenantOnboardingService : Workflow Creation Cabinet/Garage

```bash
echo ""
echo "================================================"
echo "TACHE 2.2.8 : TenantOnboardingService : Workflow Creation Cabinet/Garage"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 9"
echo "================================================"

# === Verification fichiers crees ===
# Test T08-F1: Existence fichier repo/apps/api/src/modules/tenant/services/tenant-onboarding.service.ts
if [ -f "repo/apps/api/src/modules/tenant/services/tenant-onboarding.service.ts" ]; then
  add_row "T08-F1" "Fichier tenant-onboarding.service.ts existe" "PASS" "Cree"
else
  add_row "T08-F1" "Fichier tenant-onboarding.service.ts existe" "FAIL" "Manquant"
fi
# Test T08-F2: Existence fichier repo/apps/api/src/modules/auth/auth.controller.ts
if [ -f "repo/apps/api/src/modules/auth/auth.controller.ts" ]; then
  add_row "T08-F2" "Fichier auth.controller.ts existe" "PASS" "Cree"
else
  add_row "T08-F2" "Fichier auth.controller.ts existe" "FAIL" "Manquant"
fi
# Test T08-F3: Existence fichier repo/apps/api/src/modules/auth/auth.service.ts
if [ -f "repo/apps/api/src/modules/auth/auth.service.ts" ]; then
  add_row "T08-F3" "Fichier auth.service.ts existe" "PASS" "Cree"
else
  add_row "T08-F3" "Fichier auth.service.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T08-V1: POST /onboard cree tenant + super admin user (P0)
echo "  Verifying T08-V1 : POST /onboard cree tenant + super admin user..."
add_row "T08-V1" "POST /onboard cree tenant + super admin user" "WARN" "(P0) Voir B-06 Tache 2.2.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V2: Email invitation envoye (P0)
echo "  Verifying T08-V2 : Email invitation envoye..."
add_row "T08-V2" "Email invitation envoye" "WARN" "(P0) Voir B-06 Tache 2.2.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V3: Tenant status 'pending_setup' initialement (P0)
echo "  Verifying T08-V3 : Tenant status 'pending_setup' initialement..."
add_row "T08-V3" "Tenant status 'pending_setup' initialement" "WARN" "(P0) Voir B-06 Tache 2.2.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V4: POST /setup-account avec token valide active tenant (P0)
echo "  Verifying T08-V4 : POST /setup-account avec token valide active tenant..."
add_row "T08-V4" "POST /setup-account avec token valide active tenant" "WARN" "(P0) Voir B-06 Tache 2.2.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V5: Apres setup-account : tenant status 'active' (P0)
echo "  Verifying T08-V5 : Apres setup-account : tenant status 'active'..."
add_row "T08-V5" "Apres setup-account : tenant status 'active'" "WARN" "(P0) Voir B-06 Tache 2.2.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V6: Tenant settings defaults appliques (P0)
echo "  Verifying T08-V6 : Tenant settings defaults appliques..."
add_row "T08-V6" "Tenant settings defaults appliques" "WARN" "(P0) Voir B-06 Tache 2.2.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V7: Audit log + Kafka events (P0)
echo "  Verifying T08-V7 : Audit log + Kafka events..."
add_row "T08-V7" "Audit log + Kafka events" "WARN" "(P0) Voir B-06 Tache 2.2.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V8: Token expire (>24h) rejete (P0)
echo "  Verifying T08-V8 : Token expire (>24h) rejete..."
add_row "T08-V8" "Token expire (>24h) rejete" "WARN" "(P0) Voir B-06 Tache 2.2.8 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 9/8 -- 2.2.9 : TenantSuspensionService : Suspend/Reactivate

```bash
echo ""
echo "================================================"
echo "TACHE 2.2.9 : TenantSuspensionService : Suspend/Reactivate"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 8"
echo "================================================"

# === Verification fichiers crees ===
# Test T09-F1: Existence fichier repo/apps/api/src/modules/tenant/services/tenant-suspension.service.ts
if [ -f "repo/apps/api/src/modules/tenant/services/tenant-suspension.service.ts" ]; then
  add_row "T09-F1" "Fichier tenant-suspension.service.ts existe" "PASS" "Cree"
else
  add_row "T09-F1" "Fichier tenant-suspension.service.ts existe" "FAIL" "Manquant"
fi
# Test T09-F2: Existence fichier repo/apps/api/src/modules/admin/controllers/admin-tenants.controller.ts
if [ -f "repo/apps/api/src/modules/admin/controllers/admin-tenants.controller.ts" ]; then
  add_row "T09-F2" "Fichier admin-tenants.controller.ts existe" "PASS" "Cree"
else
  add_row "T09-F2" "Fichier admin-tenants.controller.ts existe" "FAIL" "Manquant"
fi
# Test T09-F3: Existence fichier repo/packages/comm/src/templates/{fr,ar-MA,ar}/tenant-suspended.hbs
if [ -f "repo/packages/comm/src/templates/{fr,ar-MA,ar}/tenant-suspended.hbs" ]; then
  add_row "T09-F3" "Fichier tenant-suspended.hbs existe" "PASS" "Cree"
else
  add_row "T09-F3" "Fichier tenant-suspended.hbs existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T09-V1: suspend() set status + revoke sessions (P0)
echo "  Verifying T09-V1 : suspend() set status + revoke sessions..."
add_row "T09-V1" "suspend() set status + revoke sessions" "WARN" "(P0) Voir B-06 Tache 2.2.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V2: User suspended tenant : login retourne 403 TENANT_SUSPENDED (P0)
echo "  Verifying T09-V2 : User suspended tenant : login retourne 403 TENANT_SUSPENDED..."
add_row "T09-V2" "User suspended tenant : login retourne 403 TENANT_SUSPENDED" "WARN" "(P0) Voir B-06 Tache 2.2.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V3: Super admin peut acceder tenant suspendu (admin routes) (P0)
echo "  Verifying T09-V3 : Super admin peut acceder tenant suspendu (admin routes)..."
add_row "T09-V3" "Super admin peut acceder tenant suspendu (admin routes)" "WARN" "(P0) Voir B-06 Tache 2.2.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V4: reactivate() set active + login OK (P0)
echo "  Verifying T09-V4 : reactivate() set active + login OK..."
add_row "T09-V4" "reactivate() set active + login OK" "WARN" "(P0) Voir B-06 Tache 2.2.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V5: archive() set terminal status (P0)
echo "  Verifying T09-V5 : archive() set terminal status..."
add_row "T09-V5" "archive() set terminal status" "WARN" "(P0) Voir B-06 Tache 2.2.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V6: Email notification envoye (P0)
echo "  Verifying T09-V6 : Email notification envoye..."
add_row "T09-V6" "Email notification envoye" "WARN" "(P0) Voir B-06 Tache 2.2.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V7: Audit log + Kafka events (P0)
echo "  Verifying T09-V7 : Audit log + Kafka events..."
add_row "T09-V7" "Audit log + Kafka events" "WARN" "(P0) Voir B-06 Tache 2.2.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V8: Tests E2E 5+ scenarios (P1)
echo "  Verifying T09-V8 : Tests E2E 5+ scenarios..."
add_row "T09-V8" "Tests E2E 5+ scenarios" "WARN" "(P1) Voir B-06 Tache 2.2.9 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 10/8 -- 2.2.10 : SuperAdminGuard + Endpoints /api/v1/admin/*

```bash
echo ""
echo "================================================"
echo "TACHE 2.2.10 : SuperAdminGuard + Endpoints /api/v1/admin/*"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 8"
echo "================================================"

# === Verification fichiers crees ===
# Test T10-F1: Existence fichier repo/apps/api/src/common/guards/super-admin.guard.ts
if [ -f "repo/apps/api/src/common/guards/super-admin.guard.ts" ]; then
  add_row "T10-F1" "Fichier super-admin.guard.ts existe" "PASS" "Cree"
else
  add_row "T10-F1" "Fichier super-admin.guard.ts existe" "FAIL" "Manquant"
fi
# Test T10-F2: Existence fichier repo/apps/api/src/common/decorators/admin-role.decorator.ts
if [ -f "repo/apps/api/src/common/decorators/admin-role.decorator.ts" ]; then
  add_row "T10-F2" "Fichier admin-role.decorator.ts existe" "PASS" "Cree"
else
  add_row "T10-F2" "Fichier admin-role.decorator.ts existe" "FAIL" "Manquant"
fi
# Test T10-F3: Existence fichier repo/apps/api/src/common/decorators/analyst-allowed.decorator.ts
if [ -f "repo/apps/api/src/common/decorators/analyst-allowed.decorator.ts" ]; then
  add_row "T10-F3" "Fichier analyst-allowed.decorator.ts existe" "PASS" "Cree"
else
  add_row "T10-F3" "Fichier analyst-allowed.decorator.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T10-V1: super_admin_platform peut acceder /admin/* (P0)
echo "  Verifying T10-V1 : super_admin_platform peut acceder /admin/*..."
add_row "T10-V1" "super_admin_platform peut acceder /admin/*" "WARN" "(P0) Voir B-06 Tache 2.2.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V2: analyst_support peut acceder /admin/* (read-only) (P0)
echo "  Verifying T10-V2 : analyst_support peut acceder /admin/* (read-only)..."
add_row "T10-V2" "analyst_support peut acceder /admin/* (read-only)" "WARN" "(P0) Voir B-06 Tache 2.2.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V3: analyst_support tente write -> 403 (P0)
echo "  Verifying T10-V3 : analyst_support tente write -> 403..."
add_row "T10-V3" "analyst_support tente write -> 403" "WARN" "(P0) Voir B-06 Tache 2.2.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V4: broker_admin (non-super admin) rejete 403 (P0)
echo "  Verifying T10-V4 : broker_admin (non-super admin) rejete 403..."
add_row "T10-V4" "broker_admin (non-super admin) rejete 403" "WARN" "(P0) Voir B-06 Tache 2.2.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V5: Sans auth -> 401 (JwtAuthGuard avant) (P0)
echo "  Verifying T10-V5 : Sans auth -> 401 (JwtAuthGuard avant)..."
add_row "T10-V5" "Sans auth -> 401 (JwtAuthGuard avant)" "WARN" "(P0) Voir B-06 Tache 2.2.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V6: Audit log emit pour chaque admin access (P0)
echo "  Verifying T10-V6 : Audit log emit pour chaque admin access..."
add_row "T10-V6" "Audit log emit pour chaque admin access" "WARN" "(P0) Voir B-06 Tache 2.2.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V7: '@SuperAdminOnly()' decorator force super_admin (rejette analyst) (P0)
echo "  Verifying T10-V7 : '@SuperAdminOnly()' decorator force super_admin (rejette analyst)..."
add_row "T10-V7" "'@SuperAdminOnly()' decorator force super_admin (rejette analyst)" "WARN" "(P0) Voir B-06 Tache 2.2.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V8: Tests 8+ scenarios (P1)
echo "  Verifying T10-V8 : Tests 8+ scenarios..."
add_row "T10-V8" "Tests 8+ scenarios" "WARN" "(P1) Voir B-06 Tache 2.2.10 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 11/7 -- 2.2.11 : ResourceQuotaService : Quotas Par Tenant + Enforcement

```bash
echo ""
echo "================================================"
echo "TACHE 2.2.11 : ResourceQuotaService : Quotas Par Tenant + Enforcement"
echo "Priorite : P1 | Effort : 5h"
echo "Criteres a verifier : 7"
echo "================================================"

# === Verification fichiers crees ===
# Test T11-F1: Existence fichier repo/apps/api/src/modules/tenant/services/resource-quota.service.ts
if [ -f "repo/apps/api/src/modules/tenant/services/resource-quota.service.ts" ]; then
  add_row "T11-F1" "Fichier resource-quota.service.ts existe" "PASS" "Cree"
else
  add_row "T11-F1" "Fichier resource-quota.service.ts existe" "FAIL" "Manquant"
fi
# Test T11-F2: Existence fichier repo/apps/api/src/modules/tenant/services/resource-quota.service.spec.ts
if [ -f "repo/apps/api/src/modules/tenant/services/resource-quota.service.spec.ts" ]; then
  add_row "T11-F2" "Fichier resource-quota.service.spec.ts existe" "PASS" "Cree"
else
  add_row "T11-F2" "Fichier resource-quota.service.spec.ts existe" "FAIL" "Manquant"
fi
# Test T11-F3: Existence fichier repo/apps/api/src/common/errors/quota-exceeded.error.ts
if [ -f "repo/apps/api/src/common/errors/quota-exceeded.error.ts" ]; then
  add_row "T11-F3" "Fichier quota-exceeded.error.ts existe" "PASS" "Cree"
else
  add_row "T11-F3" "Fichier quota-exceeded.error.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T11-V1: 'getCurrentUsage' retourne counts corrects (P1)
echo "  Verifying T11-V1 : 'getCurrentUsage' retourne counts corrects..."
add_row "T11-V1" "'getCurrentUsage' retourne counts corrects" "WARN" "(P1) Voir B-06 Tache 2.2.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V2: 'canAddUser' retourne allowed=true si <limit, false sinon (P1)
echo "  Verifying T11-V2 : 'canAddUser' retourne allowed=true si <limit, false sinon..."
add_row "T11-V2" "'canAddUser' retourne allowed=true si <limit, false sinon" "WARN" "(P1) Voir B-06 Tache 2.2.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V3: 'enforceUserAdd' throws QuotaExceededException si limit (P1)
echo "  Verifying T11-V3 : 'enforceUserAdd' throws QuotaExceededException si limit..."
add_row "T11-V3" "'enforceUserAdd' throws QuotaExceededException si limit" "WARN" "(P1) Voir B-06 Tache 2.2.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V4: Soft warning email envoye 80% quota (one-time) (P1)
echo "  Verifying T11-V4 : Soft warning email envoye 80% quota (one-time)..."
add_row "T11-V4" "Soft warning email envoye 80% quota (one-time)" "WARN" "(P1) Voir B-06 Tache 2.2.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V5: Hard limit retourne erreur claire (avec quota courant + max) (P1)
echo "  Verifying T11-V5 : Hard limit retourne erreur claire (avec quota courant + max)..."
add_row "T11-V5" "Hard limit retourne erreur claire (avec quota courant + max)" "WARN" "(P1) Voir B-06 Tache 2.2.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V6: Cache Redis 1min actif (P1)
echo "  Verifying T11-V6 : Cache Redis 1min actif..."
add_row "T11-V6" "Cache Redis 1min actif" "WARN" "(P1) Voir B-06 Tache 2.2.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V7: Tests 8+ scenarios (P1)
echo "  Verifying T11-V7 : Tests 8+ scenarios..."
add_row "T11-V7" "Tests 8+ scenarios" "WARN" "(P1) Voir B-06 Tache 2.2.11 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 12/12 -- 2.2.12 : Tests RLS Isolation EXHAUSTIFS + Procedure Purge CNDP Loi 09-08

```bash
echo ""
echo "================================================"
echo "TACHE 2.2.12 : Tests RLS Isolation EXHAUSTIFS + Procedure Purge CNDP Loi 09"
echo "Priorite : P0 | Effort : 9h"
echo "Criteres a verifier : 12"
echo "================================================"

# === Verification fichiers crees ===
# Test T12-F1: Existence fichier repo/apps/api/test/integration/rls-isolation/{12 specs}.ts
if [ -f "repo/apps/api/test/integration/rls-isolation/{12 specs}.ts" ]; then
  add_row "T12-F1" "Fichier {12 specs}.ts existe" "PASS" "Cree"
else
  add_row "T12-F1" "Fichier {12 specs}.ts existe" "FAIL" "Manquant"
fi
# Test T12-F2: Existence fichier repo/apps/api/test/integration/rls-isolation/setup.ts
if [ -f "repo/apps/api/test/integration/rls-isolation/setup.ts" ]; then
  add_row "T12-F2" "Fichier setup.ts existe" "PASS" "Cree"
else
  add_row "T12-F2" "Fichier setup.ts existe" "FAIL" "Manquant"
fi
# Test T12-F3: Existence fichier repo/infrastructure/scripts/data-purge-tenant.ts
if [ -f "repo/infrastructure/scripts/data-purge-tenant.ts" ]; then
  add_row "T12-F3" "Fichier data-purge-tenant.ts existe" "PASS" "Cree"
else
  add_row "T12-F3" "Fichier data-purge-tenant.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T12-V1: 12 tests RLS isolation passent (P0)
echo "  Verifying T12-V1 : 12 tests RLS isolation passent..."
add_row "T12-V1" "12 tests RLS isolation passent" "WARN" "(P0) Voir B-06 Tache 2.2.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V2: Test couvre les 32 tables PARTIE1 (P0)
echo "  Verifying T12-V2 : Test couvre les 32 tables PARTIE1..."
add_row "T12-V2" "Test couvre les 32 tables PARTIE1" "WARN" "(P0) Voir B-06 Tache 2.2.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V3: Tests reproduisent zero leak cross-tenant (P0)
echo "  Verifying T12-V3 : Tests reproduisent zero leak cross-tenant..."
add_row "T12-V3" "Tests reproduisent zero leak cross-tenant" "WARN" "(P0) Voir B-06 Tache 2.2.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V4: Tests super admin bypass OK (P0)
echo "  Verifying T12-V4 : Tests super admin bypass OK..."
add_row "T12-V4" "Tests super admin bypass OK" "WARN" "(P0) Voir B-06 Tache 2.2.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V5: Tests L3 assure filter actif (P0)
echo "  Verifying T12-V5 : Tests L3 assure filter actif..."
add_row "T12-V5" "Tests L3 assure filter actif" "WARN" "(P0) Voir B-06 Tache 2.2.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V6: Tests cross-tenant auth (granted, revoked, expired) (P0)
echo "  Verifying T12-V6 : Tests cross-tenant auth (granted, revoked, expired)..."
add_row "T12-V6" "Tests cross-tenant auth (granted, revoked, expired)" "WARN" "(P0) Voir B-06 Tache 2.2.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V7: Tests tenant suspended bloque (P0)
echo "  Verifying T12-V7 : Tests tenant suspended bloque..."
add_row "T12-V7" "Tests tenant suspended bloque" "WARN" "(P0) Voir B-06 Tache 2.2.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V8: Script purge anonymize PII (test sur tenant test) (P0)
echo "  Verifying T12-V8 : Script purge anonymize PII (test sur tenant test)..."
add_row "T12-V8" "Script purge anonymize PII (test sur tenant test)" "WARN" "(P0) Voir B-06 Tache 2.2.12 pour test detaille - critere a auto-tester via script ad-hoc"

```

---


---


## VERIFICATIONS TRANSVERSALES SPRINT 6

### TR-BUILD : Build complet du sprint

```bash
echo ""
echo "================================================"
echo "VERIFICATIONS TRANSVERSALES SPRINT 6"
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

### TR-MIGRATIONS : Migrations DB Sprint 6

```bash
echo "=== TR-MIGRATIONS : Migrations DB ==="
MIGR_COUNT=$(pg_query "SELECT COUNT(*) FROM migrations WHERE name LIKE '%sprint06%' OR name LIKE '%Sprint06%'" || echo 0)
if [ "$MIGR_COUNT" -gt 0 ]; then
  add_row "TR-MIG" "Migrations Sprint 6 appliquees" "PASS" "$MIGR_COUNT migrations"
else
  add_row "TR-MIG" "Migrations Sprint 6 appliquees" "WARN" "Aucune migration detectee (verifier)"
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
echo "GENERATION DU RAPPORT FINAL SPRINT 6"
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

## Jalon GO/NO-GO Sprint 6

EOF

# Calcul statut final
if (( $(echo "$SCORE >= 95" | bc -l) )); then
  STATUT="GO"
  cat >> "$REPORT_FILE" << EOF
**STATUT** : GO -- Sprint 6 valide, passage Sprint 7 autorise

Le sprint a passe les criteres requis. Cowork peut demarrer Sprint 7.

EOF
  echo ""
  echo "================================================"
  echo "SPRINT 6 : GO ($SCORE%)"
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
  echo "SPRINT 6 : GO CONDITIONNEL ($SCORE%)"
  echo "================================================"
else
  STATUT="NO-GO"
  cat >> "$REPORT_FILE" << EOF
**STATUT** : NO-GO -- Score $SCORE% trop bas (cible 85% minimum)

Le sprint **doit etre repris** :
- Lister tous FAIL P0
- Escalation Saad/Abla decision (cut scope OR delai)
- Reprise sprint avant Sprint 7

EOF
  echo ""
  echo "================================================"
  echo "SPRINT 6 : NO-GO ($SCORE%)"
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
  echo "git commit -m \"chore(sprint-06): close sprint 6 -- $STATUT ($SCORE%)\"" >> "$REPORT_FILE"
  echo '```' >> "$REPORT_FILE"
fi

echo ""
echo "Rapport complet dans : $REPORT_FILE"
```

---

## INSTRUCTION FINALE A CLAUDE CODE / COWORK

Apres l'execution complete des verifications ci-dessus :

1. **Lis le contenu de `sprint06-verify-report.md`** integralement
2. **Identifie les FAIL critiques** (criteres P0) qui necessitent intervention manuelle
3. **Affiche un resume executif** :
   - Nombre total de criteres
   - Pourcentage PASS / PASS\* / FAIL / WARN
   - Liste des FAIL avec contexte technique
   - Recommandation : GO / GO CONDITIONNEL / NO-GO
4. **Si NO-GO** : ne pas demarrer le Sprint suivant, alerter Saad/Abla via Slack `#insurtech-dev`
5. **Si GO ou GO CONDITIONNEL** : produire le commit de cloture du sprint :

```bash
git add skalean-insurtech/sprint06-verify-report.md
git commit -m "chore(sprint-06): close sprint 6 with verification report

- Verification automatique executee
- Score global : <SCORE>%
- <PASS> criteres PASS, <PASS_REPAIRED> reparations auto, <FAIL> FAIL
- Statut : <GO|GO CONDITIONNEL|NO-GO>

Phase: 2 -- Securite
Sprint: 6 (Phase 2 / Sprint 2)
Reference B-06, C-06, V-06
Report: sprint06-verify-report.md"
```

6. **Documentation continue** : si decisions techniques prises pendant verification, ajouter notes dans `repo/docs/runbooks/sprint-06-lessons-learned.md`

---

**Fin de la verification V-06 v2.2 detaillee -- Sprint 6 (2.2) Multi-Tenant 3 Niveaux + RLS.**

**Total criteres taches** : 106 | **Total transversaux** : ~10 | **Effort sprint** : 75h
