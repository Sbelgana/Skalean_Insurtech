# VERIFICATION SPRINT 7 -- Phase 2 / Sprint 3 : RBAC Granulaire (12 roles x 85+ permissions)
# Version : Auto-reparation active + Rapport final MD detaille
# 12 taches, 82 criteres extraits B-07
# AUCUNE EMOJI AUTORISEE

**Version** : v2.2 (verification detaillee)
**Phase** : 2 -- Securite
**Sprint** : 7 / 35 (cumul) -- Sprint 3 dans Phase 2
**Reference meta-prompt** : `B-07-sprint-07-rbac.md`
**Reference orchestrateur** : `C-07-sprint-07-rbac.md`
**Total criteres** : 82 criteres taches + ~10 transversaux

---

Tu es **Claude Code (ou Cowork)**. Tu dois executer une **verification COMPLETE et EXHAUSTIVE** du Sprint 7 apres execution toutes les 12 taches.

---

## REGLES D'EXECUTION

1. Tu **executes CHAQUE verification dans l'ordre** (taches puis transversales)
2. Quand une verification echoue, tu **TENTES UNE REPARATION AUTOMATIQUE** avant de noter FAIL
3. Apres chaque tentative de reparation, tu **re-executes la verification**
4. Tu consignes dans `sprint07-verify-report.md` **TOUS les resultats** au fil de l'execution
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
REPORT_FILE="sprint07-verify-report.md"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
RUN_ID=$(date '+%Y%m%d-%H%M%S')

cat > "$REPORT_FILE" << EOF
# Rapport de Verification - Sprint 7 : RBAC Granulaire (12 roles x 85+ permissions)

**Date** : $TIMESTAMP
**Run ID** : $RUN_ID
**Phase** : 2 -- Securite
**Sprint** : 7 (Phase 2 / Sprint 3)
**Reference B-07** : 12 taches, 82 criteres extraits
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

## TACHE 1/7 -- 2.3.1 : Definition 12 Roles + 85+ Permissions Catalog

```bash
echo ""
echo "================================================"
echo "TACHE 2.3.1 : Definition 12 Roles + 85+ Permissions Catalog"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 7"
echo "================================================"

# === Verification fichiers crees ===
# Test T01-F1: Existence fichier repo/packages/auth/src/rbac/roles.enum.ts
if [ -f "repo/packages/auth/src/rbac/roles.enum.ts" ]; then
  add_row "T01-F1" "Fichier roles.enum.ts existe" "PASS" "Cree"
else
  add_row "T01-F1" "Fichier roles.enum.ts existe" "FAIL" "Manquant"
fi
# Test T01-F2: Existence fichier repo/packages/auth/src/rbac/permissions.enum.ts
if [ -f "repo/packages/auth/src/rbac/permissions.enum.ts" ]; then
  add_row "T01-F2" "Fichier permissions.enum.ts existe" "PASS" "Cree"
else
  add_row "T01-F2" "Fichier permissions.enum.ts existe" "FAIL" "Manquant"
fi
# Test T01-F3: Existence fichier repo/packages/auth/src/rbac/permissions-by-module.ts
if [ -f "repo/packages/auth/src/rbac/permissions-by-module.ts" ]; then
  add_row "T01-F3" "Fichier permissions-by-module.ts existe" "PASS" "Cree"
else
  add_row "T01-F3" "Fichier permissions-by-module.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T01-V1: 12 roles enum (test count) (P0)
echo "  Verifying T01-V1 : 12 roles enum (test count)..."
add_row "T01-V1" "12 roles enum (test count)" "WARN" "(P0) Voir B-07 Tache 2.3.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V2: 85+ permissions enum (test count) (P0)
echo "  Verifying T01-V2 : 85+ permissions enum (test count)..."
add_row "T01-V2" "85+ permissions enum (test count)" "WARN" "(P0) Voir B-07 Tache 2.3.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V3: Convention naming respectee partout (regex check) (P0)
echo "  Verifying T01-V3 : Convention naming respectee partout (regex check)..."
add_row "T01-V3" "Convention naming respectee partout (regex check)" "WARN" "(P0) Voir B-07 Tache 2.3.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V4: Pas de duplications (test set deduplication) (P0)
echo "  Verifying T01-V4 : Pas de duplications (test set deduplication)..."
add_row "T01-V4" "Pas de duplications (test set deduplication)" "WARN" "(P0) Voir B-07 Tache 2.3.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V5: 15 modules couverts (test grouping) (P0)
echo "  Verifying T01-V5 : 15 modules couverts (test grouping)..."
add_row "T01-V5" "15 modules couverts (test grouping)" "WARN" "(P0) Voir B-07 Tache 2.3.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V6: Documentation inline (chaque permission a un commentaire) (P0)
echo "  Verifying T01-V6 : Documentation inline (chaque permission a un commentaire)..."
add_row "T01-V6" "Documentation inline (chaque permission a un commentaire)" "WARN" "(P0) Voir B-07 Tache 2.3.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V7: 'permissions-by-module' reflete enum (P1)
echo "  Verifying T01-V7 : 'permissions-by-module' reflete enum..."
add_row "T01-V7" "'permissions-by-module' reflete enum" "WARN" "(P1) Voir B-07 Tache 2.3.1 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 2/7 -- 2.3.2 : PermissionsMatrix + RoleHierarchy

```bash
echo ""
echo "================================================"
echo "TACHE 2.3.2 : PermissionsMatrix + RoleHierarchy"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 7"
echo "================================================"

# === Verification fichiers crees ===
# Test T02-F1: Existence fichier repo/packages/auth/src/rbac/permissions-matrix.ts
if [ -f "repo/packages/auth/src/rbac/permissions-matrix.ts" ]; then
  add_row "T02-F1" "Fichier permissions-matrix.ts existe" "PASS" "Cree"
else
  add_row "T02-F1" "Fichier permissions-matrix.ts existe" "FAIL" "Manquant"
fi
# Test T02-F2: Existence fichier repo/packages/auth/src/rbac/role-hierarchy.ts
if [ -f "repo/packages/auth/src/rbac/role-hierarchy.ts" ]; then
  add_row "T02-F2" "Fichier role-hierarchy.ts existe" "PASS" "Cree"
else
  add_row "T02-F2" "Fichier role-hierarchy.ts existe" "FAIL" "Manquant"
fi
# Test T02-F3: Existence fichier repo/packages/auth/src/rbac/permissions-matrix.spec.ts
if [ -f "repo/packages/auth/src/rbac/permissions-matrix.spec.ts" ]; then
  add_row "T02-F3" "Fichier permissions-matrix.spec.ts existe" "PASS" "Cree"
else
  add_row "T02-F3" "Fichier permissions-matrix.spec.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T02-V1: Matrix 12 roles avec permissions (P0)
echo "  Verifying T02-V1 : Matrix 12 roles avec permissions..."
add_row "T02-V1" "Matrix 12 roles avec permissions" "WARN" "(P0) Voir B-07 Tache 2.3.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V2: super_admin wildcard ''*'' (P0)
echo "  Verifying T02-V2 : super_admin wildcard ''*''..."
add_row "T02-V2" "super_admin wildcard ''*''" "WARN" "(P0) Voir B-07 Tache 2.3.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V3: 'getEffectivePermissions(broker_admin)' inclut permissions broker_user + broker_assistant (P0)
echo "  Verifying T02-V3 : 'getEffectivePermissions(broker_admin)' inclut permissions broker_user..."
add_row "T02-V3" "'getEffectivePermissions(broker_admin)' inclut permissions broker_user + broker_assistant" "WARN" "(P0) Voir B-07 Tache 2.3.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V4: Pas de cross-inheritance broker <-> garage (P0)
echo "  Verifying T02-V4 : Pas de cross-inheritance broker <-> garage..."
add_row "T02-V4" "Pas de cross-inheritance broker <-> garage" "WARN" "(P0) Voir B-07 Tache 2.3.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V5: Boot validation : aucune permission inconnue (P0)
echo "  Verifying T02-V5 : Boot validation : aucune permission inconnue..."
add_row "T02-V5" "Boot validation : aucune permission inconnue" "WARN" "(P0) Voir B-07 Tache 2.3.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V6: 85+ permissions distinctes total (P0)
echo "  Verifying T02-V6 : 85+ permissions distinctes total..."
add_row "T02-V6" "85+ permissions distinctes total" "WARN" "(P0) Voir B-07 Tache 2.3.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V7: Tests 8+ scenarios (P1)
echo "  Verifying T02-V7 : Tests 8+ scenarios..."
add_row "T02-V7" "Tests 8+ scenarios" "WARN" "(P1) Voir B-07 Tache 2.3.2 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 3/9 -- 2.3.3 : RbacService : Evaluation Principale

```bash
echo ""
echo "================================================"
echo "TACHE 2.3.3 : RbacService : Evaluation Principale"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 9"
echo "================================================"

# === Verification fichiers crees ===
# Test T03-F1: Existence fichier repo/packages/auth/src/rbac/rbac.service.ts
if [ -f "repo/packages/auth/src/rbac/rbac.service.ts" ]; then
  add_row "T03-F1" "Fichier rbac.service.ts existe" "PASS" "Cree"
else
  add_row "T03-F1" "Fichier rbac.service.ts existe" "FAIL" "Manquant"
fi
# Test T03-F2: Existence fichier repo/packages/auth/src/rbac/rbac.service.spec.ts
if [ -f "repo/packages/auth/src/rbac/rbac.service.spec.ts" ]; then
  add_row "T03-F2" "Fichier rbac.service.spec.ts existe" "PASS" "Cree"
else
  add_row "T03-F2" "Fichier rbac.service.spec.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T03-V1: super_admin_platform : 'canAccess' retourne allowed=true pour TOUTE permission (P0)
echo "  Verifying T03-V1 : super_admin_platform : 'canAccess' retourne allowed=true pour TOUTE pe..."
add_row "T03-V1" "super_admin_platform : 'canAccess' retourne allowed=true pour TOUTE permission" "WARN" "(P0) Voir B-07 Tache 2.3.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V2: broker_admin : 'canAccess('crm.contacts.create')' allowed=true (P0)
echo "  Verifying T03-V2 : broker_admin : 'canAccess('crm.contacts.create')' allowed=true..."
add_row "T03-V2" "broker_admin : 'canAccess('crm.contacts.create')' allowed=true" "WARN" "(P0) Voir B-07 Tache 2.3.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V3: broker_user : 'canAccess('crm.contacts.delete')' allowed=false (pas dans matrix) (P0)
echo "  Verifying T03-V3 : broker_user : 'canAccess('crm.contacts.delete')' allowed=false (pas da..."
add_row "T03-V3" "broker_user : 'canAccess('crm.contacts.delete')' allowed=false (pas dans matrix)" "WARN" "(P0) Voir B-07 Tache 2.3.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V4: 'canAccess' avec ABAC context delegate AbacService (P0)
echo "  Verifying T03-V4 : 'canAccess' avec ABAC context delegate AbacService..."
add_row "T03-V4" "'canAccess' avec ABAC context delegate AbacService" "WARN" "(P0) Voir B-07 Tache 2.3.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V5: Cache hit 2eme call meme role (P0)
echo "  Verifying T03-V5 : Cache hit 2eme call meme role..."
add_row "T03-V5" "Cache hit 2eme call meme role" "WARN" "(P0) Voir B-07 Tache 2.3.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V6: 'canAccessAny' retourne true si AU MOINS UNE permission OK (P0)
echo "  Verifying T03-V6 : 'canAccessAny' retourne true si AU MOINS UNE permission OK..."
add_row "T03-V6" "'canAccessAny' retourne true si AU MOINS UNE permission OK" "WARN" "(P0) Voir B-07 Tache 2.3.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V7: 'canAccessAll' retourne false si AU MOINS UNE manque (P0)
echo "  Verifying T03-V7 : 'canAccessAll' retourne false si AU MOINS UNE manque..."
add_row "T03-V7" "'canAccessAll' retourne false si AU MOINS UNE manque" "WARN" "(P0) Voir B-07 Tache 2.3.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V8: Reason explicite si denied (PERMISSION_NOT_GRANTED, ABAC_DENIED) (P0)
echo "  Verifying T03-V8 : Reason explicite si denied (PERMISSION_NOT_GRANTED, ABAC_DENIED)..."
add_row "T03-V8" "Reason explicite si denied (PERMISSION_NOT_GRANTED, ABAC_DENIED)" "WARN" "(P0) Voir B-07 Tache 2.3.3 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 4/7 -- 2.3.4 : RoleGuard + Decorators @Role()

```bash
echo ""
echo "================================================"
echo "TACHE 2.3.4 : RoleGuard + Decorators @Role()"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 7"
echo "================================================"

# === Verification fichiers crees ===
# Test T04-F1: Existence fichier repo/apps/api/src/common/decorators/role.decorator.ts
if [ -f "repo/apps/api/src/common/decorators/role.decorator.ts" ]; then
  add_row "T04-F1" "Fichier role.decorator.ts existe" "PASS" "Cree"
else
  add_row "T04-F1" "Fichier role.decorator.ts existe" "FAIL" "Manquant"
fi
# Test T04-F2: Existence fichier repo/apps/api/src/common/decorators/min-role.decorator.ts
if [ -f "repo/apps/api/src/common/decorators/min-role.decorator.ts" ]; then
  add_row "T04-F2" "Fichier min-role.decorator.ts existe" "PASS" "Cree"
else
  add_row "T04-F2" "Fichier min-role.decorator.ts existe" "FAIL" "Manquant"
fi
# Test T04-F3: Existence fichier repo/apps/api/src/common/guards/role.guard.ts
if [ -f "repo/apps/api/src/common/guards/role.guard.ts" ]; then
  add_row "T04-F3" "Fichier role.guard.ts existe" "PASS" "Cree"
else
  add_row "T04-F3" "Fichier role.guard.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T04-V1: @Role('broker_admin') accept broker_admin (P0)
echo "  Verifying T04-V1 : @Role('broker_admin') accept broker_admin..."
add_row "T04-V1" "@Role('broker_admin') accept broker_admin" "WARN" "(P0) Voir B-07 Tache 2.3.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V2: @Role('broker_admin') reject broker_user (403) (P0)
echo "  Verifying T04-V2 : @Role('broker_admin') reject broker_user (403)..."
add_row "T04-V2" "@Role('broker_admin') reject broker_user (403)" "WARN" "(P0) Voir B-07 Tache 2.3.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V3: @Role('a', 'b') accept a OR b (P0)
echo "  Verifying T04-V3 : @Role('a', 'b') accept a OR b..."
add_row "T04-V3" "@Role('a', 'b') accept a OR b" "WARN" "(P0) Voir B-07 Tache 2.3.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V4: @MinRole('broker_admin') accept broker_admin + broker_user + broker_assistant (P0)
echo "  Verifying T04-V4 : @MinRole('broker_admin') accept broker_admin + broker_user + broker_as..."
add_row "T04-V4" "@MinRole('broker_admin') accept broker_admin + broker_user + broker_assistant" "WARN" "(P0) Voir B-07 Tache 2.3.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V5: super_admin_platform bypass tous role checks (P0)
echo "  Verifying T04-V5 : super_admin_platform bypass tous role checks..."
add_row "T04-V5" "super_admin_platform bypass tous role checks" "WARN" "(P0) Voir B-07 Tache 2.3.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V6: Pas de role -> 403 (P0)
echo "  Verifying T04-V6 : Pas de role -> 403..."
add_row "T04-V6" "Pas de role -> 403" "WARN" "(P0) Voir B-07 Tache 2.3.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V7: Tests 8+ scenarios (P0)
echo "  Verifying T04-V7 : Tests 8+ scenarios..."
add_row "T04-V7" "Tests 8+ scenarios" "WARN" "(P0) Voir B-07 Tache 2.3.4 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 5/8 -- 2.3.5 : PermissionGuard + Decorator @RequirePermission()

```bash
echo ""
echo "================================================"
echo "TACHE 2.3.5 : PermissionGuard + Decorator @RequirePermission()"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 8"
echo "================================================"

# === Verification fichiers crees ===
# Test T05-F1: Existence fichier repo/apps/api/src/common/decorators/require-permission.decorator.ts
if [ -f "repo/apps/api/src/common/decorators/require-permission.decorator.ts" ]; then
  add_row "T05-F1" "Fichier require-permission.decorator.ts existe" "PASS" "Cree"
else
  add_row "T05-F1" "Fichier require-permission.decorator.ts existe" "FAIL" "Manquant"
fi
# Test T05-F2: Existence fichier repo/apps/api/src/common/guards/permission.guard.ts
if [ -f "repo/apps/api/src/common/guards/permission.guard.ts" ]; then
  add_row "T05-F2" "Fichier permission.guard.ts existe" "PASS" "Cree"
else
  add_row "T05-F2" "Fichier permission.guard.ts existe" "FAIL" "Manquant"
fi
# Test T05-F3: Existence fichier repo/apps/api/src/common/guards/permission.guard.spec.ts
if [ -f "repo/apps/api/src/common/guards/permission.guard.spec.ts" ]; then
  add_row "T05-F3" "Fichier permission.guard.spec.ts existe" "PASS" "Cree"
else
  add_row "T05-F3" "Fichier permission.guard.spec.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T05-V1: @RequirePermission accept si role a permission (P0)
echo "  Verifying T05-V1 : @RequirePermission accept si role a permission..."
add_row "T05-V1" "@RequirePermission accept si role a permission" "WARN" "(P0) Voir B-07 Tache 2.3.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V2: @RequirePermission reject si role n'a pas permission (403) (P0)
echo "  Verifying T05-V2 : @RequirePermission reject si role n'a pas permission (403)..."
add_row "T05-V2" "@RequirePermission reject si role n'a pas permission (403)" "WARN" "(P0) Voir B-07 Tache 2.3.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V3: @RequireAnyPermission accept si AU MOINS une OK (P0)
echo "  Verifying T05-V3 : @RequireAnyPermission accept si AU MOINS une OK..."
add_row "T05-V3" "@RequireAnyPermission accept si AU MOINS une OK" "WARN" "(P0) Voir B-07 Tache 2.3.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V4: @RequireAllPermissions reject si AU MOINS une manque (P0)
echo "  Verifying T05-V4 : @RequireAllPermissions reject si AU MOINS une manque..."
add_row "T05-V4" "@RequireAllPermissions reject si AU MOINS une manque" "WARN" "(P0) Voir B-07 Tache 2.3.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V5: super_admin bypass (P0)
echo "  Verifying T05-V5 : super_admin bypass..."
add_row "T05-V5" "super_admin bypass" "WARN" "(P0) Voir B-07 Tache 2.3.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V6: Audit log sur denied (P0)
echo "  Verifying T05-V6 : Audit log sur denied..."
add_row "T05-V6" "Audit log sur denied" "WARN" "(P0) Voir B-07 Tache 2.3.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V7: 403 retourne code + permissions demandees (P0)
echo "  Verifying T05-V7 : 403 retourne code + permissions demandees..."
add_row "T05-V7" "403 retourne code + permissions demandees" "WARN" "(P0) Voir B-07 Tache 2.3.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V8: Tests 12+ scenarios (P0)
echo "  Verifying T05-V8 : Tests 12+ scenarios..."
add_row "T05-V8" "Tests 12+ scenarios" "WARN" "(P0) Voir B-07 Tache 2.3.5 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 6/5 -- 2.3.6 : Types ABAC + Interfaces

```bash
echo ""
echo "================================================"
echo "TACHE 2.3.6 : Types ABAC + Interfaces"
echo "Priorite : P0 | Effort : 3h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T06-F1: Existence fichier repo/packages/auth/src/abac/types.ts
if [ -f "repo/packages/auth/src/abac/types.ts" ]; then
  add_row "T06-F1" "Fichier types.ts existe" "PASS" "Cree"
else
  add_row "T06-F1" "Fichier types.ts existe" "FAIL" "Manquant"
fi
# Test T06-F2: Existence fichier repo/packages/auth/src/abac/types.spec.ts
if [ -f "repo/packages/auth/src/abac/types.spec.ts" ]; then
  add_row "T06-F2" "Fichier types.spec.ts existe" "PASS" "Cree"
else
  add_row "T06-F2" "Fichier types.spec.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T06-V1: Interfaces compilent (P0)
echo "  Verifying T06-V1 : Interfaces compilent..."
add_row "T06-V1" "Interfaces compilent" "WARN" "(P0) Voir B-07 Tache 2.3.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V2: 'AbacContext' couvre cas usage 4 policies (Tache 2.3.7) (P0)
echo "  Verifying T06-V2 : 'AbacContext' couvre cas usage 4 policies (Tache 2.3.7)..."
add_row "T06-V2" "'AbacContext' couvre cas usage 4 policies (Tache 2.3.7)" "WARN" "(P0) Voir B-07 Tache 2.3.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V3: 'AbacResult.allowed' boolean + reason optional (P0)
echo "  Verifying T06-V3 : 'AbacResult.allowed' boolean + reason optional..."
add_row "T06-V3" "'AbacResult.allowed' boolean + reason optional" "WARN" "(P0) Voir B-07 Tache 2.3.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V4: Resource types enum correct (P0)
echo "  Verifying T06-V4 : Resource types enum correct..."
add_row "T06-V4" "Resource types enum correct" "WARN" "(P0) Voir B-07 Tache 2.3.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V5: Zod schemas runtime validation (P1)
echo "  Verifying T06-V5 : Zod schemas runtime validation..."
add_row "T06-V5" "Zod schemas runtime validation" "WARN" "(P1) Voir B-07 Tache 2.3.6 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 7/8 -- 2.3.7 : AbacService + 4 Policies

```bash
echo ""
echo "================================================"
echo "TACHE 2.3.7 : AbacService + 4 Policies"
echo "Priorite : P0 | Effort : 7h"
echo "Criteres a verifier : 8"
echo "================================================"

# === Verification fichiers crees ===
# Test T07-F1: Existence fichier repo/packages/auth/src/abac/abac.service.ts
if [ -f "repo/packages/auth/src/abac/abac.service.ts" ]; then
  add_row "T07-F1" "Fichier abac.service.ts existe" "PASS" "Cree"
else
  add_row "T07-F1" "Fichier abac.service.ts existe" "FAIL" "Manquant"
fi
# Test T07-F2: Existence fichier repo/packages/auth/src/abac/policies/own-resources.policy.ts
if [ -f "repo/packages/auth/src/abac/policies/own-resources.policy.ts" ]; then
  add_row "T07-F2" "Fichier own-resources.policy.ts existe" "PASS" "Cree"
else
  add_row "T07-F2" "Fichier own-resources.policy.ts existe" "FAIL" "Manquant"
fi
# Test T07-F3: Existence fichier repo/packages/auth/src/abac/policies/time-based.policy.ts
if [ -f "repo/packages/auth/src/abac/policies/time-based.policy.ts" ]; then
  add_row "T07-F3" "Fichier time-based.policy.ts existe" "PASS" "Cree"
else
  add_row "T07-F3" "Fichier time-based.policy.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T07-V1: 'evaluate' route vers policy correct (P0)
echo "  Verifying T07-V1 : 'evaluate' route vers policy correct..."
add_row "T07-V1" "'evaluate' route vers policy correct" "WARN" "(P0) Voir B-07 Tache 2.3.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V2: OwnResourcesPolicy : owner OK, non-owner reject (P0)
echo "  Verifying T07-V2 : OwnResourcesPolicy : owner OK, non-owner reject..."
add_row "T07-V2" "OwnResourcesPolicy : owner OK, non-owner reject" "WARN" "(P0) Voir B-07 Tache 2.3.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V3: TimeBasedPolicy : < threshold OK, > threshold reject (P0)
echo "  Verifying T07-V3 : TimeBasedPolicy : < threshold OK, > threshold reject..."
add_row "T07-V3" "TimeBasedPolicy : < threshold OK, > threshold reject" "WARN" "(P0) Voir B-07 Tache 2.3.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V4: StatusBasedPolicy : status allowed OK, autre reject (P0)
echo "  Verifying T07-V4 : StatusBasedPolicy : status allowed OK, autre reject..."
add_row "T07-V4" "StatusBasedPolicy : status allowed OK, autre reject" "WARN" "(P0) Voir B-07 Tache 2.3.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V5: WorkflowStatePolicy : transition valide OK, invalide reject (P0)
echo "  Verifying T07-V5 : WorkflowStatePolicy : transition valide OK, invalide reject..."
add_row "T07-V5" "WorkflowStatePolicy : transition valide OK, invalide reject" "WARN" "(P0) Voir B-07 Tache 2.3.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V6: Si pas de policy applicable -> allowed (RBAC enough) (P0)
echo "  Verifying T07-V6 : Si pas de policy applicable -> allowed (RBAC enough)..."
add_row "T07-V6" "Si pas de policy applicable -> allowed (RBAC enough)" "WARN" "(P0) Voir B-07 Tache 2.3.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V7: Logs structured emit (P0)
echo "  Verifying T07-V7 : Logs structured emit..."
add_row "T07-V7" "Logs structured emit" "WARN" "(P0) Voir B-07 Tache 2.3.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V8: Tests 20+ scenarios passent (P1)
echo "  Verifying T07-V8 : Tests 20+ scenarios passent..."
add_row "T07-V8" "Tests 20+ scenarios passent" "WARN" "(P1) Voir B-07 Tache 2.3.7 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 8/7 -- 2.3.8 : AbacGuard + Decorator @AbacPolicy()

```bash
echo ""
echo "================================================"
echo "TACHE 2.3.8 : AbacGuard + Decorator @AbacPolicy()"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 7"
echo "================================================"

# === Verification fichiers crees ===
# Test T08-F1: Existence fichier repo/apps/api/src/common/decorators/abac-resource.decorator.ts
if [ -f "repo/apps/api/src/common/decorators/abac-resource.decorator.ts" ]; then
  add_row "T08-F1" "Fichier abac-resource.decorator.ts existe" "PASS" "Cree"
else
  add_row "T08-F1" "Fichier abac-resource.decorator.ts existe" "FAIL" "Manquant"
fi
# Test T08-F2: Existence fichier repo/apps/api/src/common/guards/abac.guard.ts
if [ -f "repo/apps/api/src/common/guards/abac.guard.ts" ]; then
  add_row "T08-F2" "Fichier abac.guard.ts existe" "PASS" "Cree"
else
  add_row "T08-F2" "Fichier abac.guard.ts existe" "FAIL" "Manquant"
fi
# Test T08-F3: Existence fichier repo/apps/api/src/common/services/resource-loader.service.ts
if [ -f "repo/apps/api/src/common/services/resource-loader.service.ts" ]; then
  add_row "T08-F3" "Fichier resource-loader.service.ts existe" "PASS" "Cree"
else
  add_row "T08-F3" "Fichier resource-loader.service.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T08-V1: @AbacResource + permission *_own : owner OK (P0)
echo "  Verifying T08-V1 : @AbacResource + permission *_own : owner OK..."
add_row "T08-V1" "@AbacResource + permission *_own : owner OK" "WARN" "(P0) Voir B-07 Tache 2.3.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V2: @AbacResource + permission *_own : non-owner reject 403 ABAC_DENIED (P0)
echo "  Verifying T08-V2 : @AbacResource + permission *_own : non-owner reject 403 ABAC_DENIED..."
add_row "T08-V2" "@AbacResource + permission *_own : non-owner reject 403 ABAC_DENIED" "WARN" "(P0) Voir B-07 Tache 2.3.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V3: Resource not found -> 404 (P0)
echo "  Verifying T08-V3 : Resource not found -> 404..."
add_row "T08-V3" "Resource not found -> 404" "WARN" "(P0) Voir B-07 Tache 2.3.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V4: Cache resource hit 2eme call (P0)
echo "  Verifying T08-V4 : Cache resource hit 2eme call..."
add_row "T08-V4" "Cache resource hit 2eme call" "WARN" "(P0) Voir B-07 Tache 2.3.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V5: Audit log ABAC denied (P0)
echo "  Verifying T08-V5 : Audit log ABAC denied..."
add_row "T08-V5" "Audit log ABAC denied" "WARN" "(P0) Voir B-07 Tache 2.3.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V6: Workflow transition test (close sinistre depuis state valide) (P0)
echo "  Verifying T08-V6 : Workflow transition test (close sinistre depuis state valide)..."
add_row "T08-V6" "Workflow transition test (close sinistre depuis state valide)" "WARN" "(P0) Voir B-07 Tache 2.3.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V7: Tests 10+ scenarios (P0)
echo "  Verifying T08-V7 : Tests 10+ scenarios..."
add_row "T08-V7" "Tests 10+ scenarios" "WARN" "(P0) Voir B-07 Tache 2.3.8 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 9/5 -- 2.3.9 : RbacAuditService : Log Access Granted + Denied

```bash
echo ""
echo "================================================"
echo "TACHE 2.3.9 : RbacAuditService : Log Access Granted + Denied"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T09-F1: Existence fichier repo/apps/api/src/modules/auth/services/rbac-audit.service.ts
if [ -f "repo/apps/api/src/modules/auth/services/rbac-audit.service.ts" ]; then
  add_row "T09-F1" "Fichier rbac-audit.service.ts existe" "PASS" "Cree"
else
  add_row "T09-F1" "Fichier rbac-audit.service.ts existe" "FAIL" "Manquant"
fi
# Test T09-F2: Existence fichier repo/apps/api/src/modules/auth/services/rbac-audit.service.spec.ts
if [ -f "repo/apps/api/src/modules/auth/services/rbac-audit.service.spec.ts" ]; then
  add_row "T09-F2" "Fichier rbac-audit.service.spec.ts existe" "PASS" "Cree"
else
  add_row "T09-F2" "Fichier rbac-audit.service.spec.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T09-V1: 'logAccessGranted' INSERT audit_log row (P0)
echo "  Verifying T09-V1 : 'logAccessGranted' INSERT audit_log row..."
add_row "T09-V1" "'logAccessGranted' INSERT audit_log row" "WARN" "(P0) Voir B-07 Tache 2.3.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V2: 'logAccessDenied' INSERT + Kafka event (P0)
echo "  Verifying T09-V2 : 'logAccessDenied' INSERT + Kafka event..."
add_row "T09-V2" "'logAccessDenied' INSERT + Kafka event" "WARN" "(P0) Voir B-07 Tache 2.3.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V3: Granted logging configurable env (P0)
echo "  Verifying T09-V3 : Granted logging configurable env..."
add_row "T09-V3" "Granted logging configurable env" "WARN" "(P0) Voir B-07 Tache 2.3.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V4: Denied toujours logged (P0)
echo "  Verifying T09-V4 : Denied toujours logged..."
add_row "T09-V4" "Denied toujours logged" "WARN" "(P0) Voir B-07 Tache 2.3.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V5: Tests 6+ scenarios (P0)
echo "  Verifying T09-V5 : Tests 6+ scenarios..."
add_row "T09-V5" "Tests 6+ scenarios" "WARN" "(P0) Voir B-07 Tache 2.3.9 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 10/5 -- 2.3.10 : PermissionCacheService Redis

```bash
echo ""
echo "================================================"
echo "TACHE 2.3.10 : PermissionCacheService Redis"
echo "Priorite : P1 | Effort : 4h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T10-F1: Existence fichier repo/packages/auth/src/rbac/permission-cache.service.ts
if [ -f "repo/packages/auth/src/rbac/permission-cache.service.ts" ]; then
  add_row "T10-F1" "Fichier permission-cache.service.ts existe" "PASS" "Cree"
else
  add_row "T10-F1" "Fichier permission-cache.service.ts existe" "FAIL" "Manquant"
fi
# Test T10-F2: Existence fichier repo/packages/auth/src/rbac/permission-cache.service.spec.ts
if [ -f "repo/packages/auth/src/rbac/permission-cache.service.spec.ts" ]; then
  add_row "T10-F2" "Fichier permission-cache.service.spec.ts existe" "PASS" "Cree"
else
  add_row "T10-F2" "Fichier permission-cache.service.spec.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T10-V1: Cache hit 2eme call meme role (P1)
echo "  Verifying T10-V1 : Cache hit 2eme call meme role..."
add_row "T10-V1" "Cache hit 2eme call meme role" "WARN" "(P1) Voir B-07 Tache 2.3.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V2: Invalidation : cache evict apres event (P1)
echo "  Verifying T10-V2 : Invalidation : cache evict apres event..."
add_row "T10-V2" "Invalidation : cache evict apres event" "WARN" "(P1) Voir B-07 Tache 2.3.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V3: TTL 5min respecte (P1)
echo "  Verifying T10-V3 : TTL 5min respecte..."
add_row "T10-V3" "TTL 5min respecte" "WARN" "(P1) Voir B-07 Tache 2.3.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V4: Logs hit/miss emit (P1)
echo "  Verifying T10-V4 : Logs hit/miss emit..."
add_row "T10-V4" "Logs hit/miss emit" "WARN" "(P1) Voir B-07 Tache 2.3.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V5: Tests 6+ scenarios (P1)
echo "  Verifying T10-V5 : Tests 6+ scenarios..."
add_row "T10-V5" "Tests 6+ scenarios" "WARN" "(P1) Voir B-07 Tache 2.3.10 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 11/6 -- 2.3.11 : PermissionsController : Endpoints Admin Gestion Roles

```bash
echo ""
echo "================================================"
echo "TACHE 2.3.11 : PermissionsController : Endpoints Admin Gestion Roles"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 6"
echo "================================================"

# === Verification fichiers crees ===
# Test T11-F1: Existence fichier repo/apps/api/src/modules/admin/controllers/admin-permissions.controller.ts
if [ -f "repo/apps/api/src/modules/admin/controllers/admin-permissions.controller.ts" ]; then
  add_row "T11-F1" "Fichier admin-permissions.controller.ts existe" "PASS" "Cree"
else
  add_row "T11-F1" "Fichier admin-permissions.controller.ts existe" "FAIL" "Manquant"
fi
# Test T11-F2: Existence fichier repo/apps/api/src/modules/admin/services/admin-permissions.service.ts
if [ -f "repo/apps/api/src/modules/admin/services/admin-permissions.service.ts" ]; then
  add_row "T11-F2" "Fichier admin-permissions.service.ts existe" "PASS" "Cree"
else
  add_row "T11-F2" "Fichier admin-permissions.service.ts existe" "FAIL" "Manquant"
fi
# Test T11-F3: Existence fichier repo/apps/api/test/admin-permissions.e2e-spec.ts
if [ -f "repo/apps/api/test/admin-permissions.e2e-spec.ts" ]; then
  add_row "T11-F3" "Fichier admin-permissions.e2e-spec.ts existe" "PASS" "Cree"
else
  add_row "T11-F3" "Fichier admin-permissions.e2e-spec.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T11-V1: GET /admin/rbac/roles retourne 12 (P0)
echo "  Verifying T11-V1 : GET /admin/rbac/roles retourne 12..."
add_row "T11-V1" "GET /admin/rbac/roles retourne 12" "WARN" "(P0) Voir B-07 Tache 2.3.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V2: GET /admin/rbac/roles/:role/permissions retourne effectives + hierarchy (P0)
echo "  Verifying T11-V2 : GET /admin/rbac/roles/:role/permissions retourne effectives + hierarch..."
add_row "T11-V2" "GET /admin/rbac/roles/:role/permissions retourne effectives + hierarchy" "WARN" "(P0) Voir B-07 Tache 2.3.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V3: GET /admin/rbac/permissions retourne 85+ (P0)
echo "  Verifying T11-V3 : GET /admin/rbac/permissions retourne 85+..."
add_row "T11-V3" "GET /admin/rbac/permissions retourne 85+" "WARN" "(P0) Voir B-07 Tache 2.3.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V4: GET /admin/rbac/audit/denied retourne recents (P0)
echo "  Verifying T11-V4 : GET /admin/rbac/audit/denied retourne recents..."
add_row "T11-V4" "GET /admin/rbac/audit/denied retourne recents" "WARN" "(P0) Voir B-07 Tache 2.3.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V5: Non-super admin reject 403 (P0)
echo "  Verifying T11-V5 : Non-super admin reject 403..."
add_row "T11-V5" "Non-super admin reject 403" "WARN" "(P0) Voir B-07 Tache 2.3.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V6: Tests E2E 6+ scenarios (P1)
echo "  Verifying T11-V6 : Tests E2E 6+ scenarios..."
add_row "T11-V6" "Tests E2E 6+ scenarios" "WARN" "(P1) Voir B-07 Tache 2.3.11 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 12/8 -- 2.3.12 : Tests Exhaustifs (80+) + Seeds Dev 12 Users

```bash
echo ""
echo "================================================"
echo "TACHE 2.3.12 : Tests Exhaustifs (80+) + Seeds Dev 12 Users"
echo "Priorite : P0 | Effort : 9h"
echo "Criteres a verifier : 8"
echo "================================================"

# === Verification fichiers crees ===
# Test T12-F1: Existence fichier repo/apps/api/test/rbac/role-matrix-coverage.spec.ts
if [ -f "repo/apps/api/test/rbac/role-matrix-coverage.spec.ts" ]; then
  add_row "T12-F1" "Fichier role-matrix-coverage.spec.ts existe" "PASS" "Cree"
else
  add_row "T12-F1" "Fichier role-matrix-coverage.spec.ts existe" "FAIL" "Manquant"
fi
# Test T12-F2: Existence fichier repo/apps/api/test/rbac/super-admin-platform.spec.ts
if [ -f "repo/apps/api/test/rbac/super-admin-platform.spec.ts" ]; then
  add_row "T12-F2" "Fichier super-admin-platform.spec.ts existe" "PASS" "Cree"
else
  add_row "T12-F2" "Fichier super-admin-platform.spec.ts existe" "FAIL" "Manquant"
fi
# Test T12-F3: Existence fichier repo/apps/api/test/rbac/analyst-support.spec.ts
if [ -f "repo/apps/api/test/rbac/analyst-support.spec.ts" ]; then
  add_row "T12-F3" "Fichier analyst-support.spec.ts existe" "PASS" "Cree"
else
  add_row "T12-F3" "Fichier analyst-support.spec.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T12-V1: 80+ scenarios tests passent (P0)
echo "  Verifying T12-V1 : 80+ scenarios tests passent..."
add_row "T12-V1" "80+ scenarios tests passent" "WARN" "(P0) Voir B-07 Tache 2.3.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V2: Coverage : tous 12 roles testes (P0)
echo "  Verifying T12-V2 : Coverage : tous 12 roles testes..."
add_row "T12-V2" "Coverage : tous 12 roles testes" "WARN" "(P0) Voir B-07 Tache 2.3.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V3: Coverage : tous 4 ABAC policies testees (P0)
echo "  Verifying T12-V3 : Coverage : tous 4 ABAC policies testees..."
add_row "T12-V3" "Coverage : tous 4 ABAC policies testees" "WARN" "(P0) Voir B-07 Tache 2.3.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V4: Tests passent CI (P0)
echo "  Verifying T12-V4 : Tests passent CI..."
add_row "T12-V4" "Tests passent CI" "WARN" "(P0) Voir B-07 Tache 2.3.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V5: Seeds creent 12 users avec roles distincts (P0)
echo "  Verifying T12-V5 : Seeds creent 12 users avec roles distincts..."
add_row "T12-V5" "Seeds creent 12 users avec roles distincts" "WARN" "(P0) Voir B-07 Tache 2.3.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V6: Documentation runbook claire (P0)
echo "  Verifying T12-V6 : Documentation runbook claire..."
add_row "T12-V6" "Documentation runbook claire" "WARN" "(P0) Voir B-07 Tache 2.3.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V7: Reproducibility : run 5x consecutif passe (P0)
echo "  Verifying T12-V7 : Reproducibility : run 5x consecutif passe..."
add_row "T12-V7" "Reproducibility : run 5x consecutif passe" "WARN" "(P0) Voir B-07 Tache 2.3.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V8: Performance : suite tests < 60s (P1)
echo "  Verifying T12-V8 : Performance : suite tests < 60s..."
add_row "T12-V8" "Performance : suite tests < 60s" "WARN" "(P1) Voir B-07 Tache 2.3.12 pour test detaille - critere a auto-tester via script ad-hoc"

```

---


---


## VERIFICATIONS TRANSVERSALES SPRINT 7

### TR-BUILD : Build complet du sprint

```bash
echo ""
echo "================================================"
echo "VERIFICATIONS TRANSVERSALES SPRINT 7"
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

### TR-MIGRATIONS : Migrations DB Sprint 7

```bash
echo "=== TR-MIGRATIONS : Migrations DB ==="
MIGR_COUNT=$(pg_query "SELECT COUNT(*) FROM migrations WHERE name LIKE '%sprint07%' OR name LIKE '%Sprint07%'" || echo 0)
if [ "$MIGR_COUNT" -gt 0 ]; then
  add_row "TR-MIG" "Migrations Sprint 7 appliquees" "PASS" "$MIGR_COUNT migrations"
else
  add_row "TR-MIG" "Migrations Sprint 7 appliquees" "WARN" "Aucune migration detectee (verifier)"
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
echo "GENERATION DU RAPPORT FINAL SPRINT 7"
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

## Jalon GO/NO-GO Sprint 7

EOF

# Calcul statut final
if (( $(echo "$SCORE >= 95" | bc -l) )); then
  STATUT="GO"
  cat >> "$REPORT_FILE" << EOF
**STATUT** : GO -- Sprint 7 valide, passage Sprint 8 autorise

Le sprint a passe les criteres requis. Cowork peut demarrer Sprint 8.

EOF
  echo ""
  echo "================================================"
  echo "SPRINT 7 : GO ($SCORE%)"
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
  echo "SPRINT 7 : GO CONDITIONNEL ($SCORE%)"
  echo "================================================"
else
  STATUT="NO-GO"
  cat >> "$REPORT_FILE" << EOF
**STATUT** : NO-GO -- Score $SCORE% trop bas (cible 85% minimum)

Le sprint **doit etre repris** :
- Lister tous FAIL P0
- Escalation Saad/Abla decision (cut scope OR delai)
- Reprise sprint avant Sprint 8

EOF
  echo ""
  echo "================================================"
  echo "SPRINT 7 : NO-GO ($SCORE%)"
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
  echo "git commit -m \"chore(sprint-07): close sprint 7 -- $STATUT ($SCORE%)\"" >> "$REPORT_FILE"
  echo '```' >> "$REPORT_FILE"
fi

echo ""
echo "Rapport complet dans : $REPORT_FILE"
```

---

## INSTRUCTION FINALE A CLAUDE CODE / COWORK

Apres l'execution complete des verifications ci-dessus :

1. **Lis le contenu de `sprint07-verify-report.md`** integralement
2. **Identifie les FAIL critiques** (criteres P0) qui necessitent intervention manuelle
3. **Affiche un resume executif** :
   - Nombre total de criteres
   - Pourcentage PASS / PASS\* / FAIL / WARN
   - Liste des FAIL avec contexte technique
   - Recommandation : GO / GO CONDITIONNEL / NO-GO
4. **Si NO-GO** : ne pas demarrer le Sprint suivant, alerter Saad/Abla via Slack `#insurtech-dev`
5. **Si GO ou GO CONDITIONNEL** : produire le commit de cloture du sprint :

```bash
git add skalean-insurtech/sprint07-verify-report.md
git commit -m "chore(sprint-07): close sprint 7 with verification report

- Verification automatique executee
- Score global : <SCORE>%
- <PASS> criteres PASS, <PASS_REPAIRED> reparations auto, <FAIL> FAIL
- Statut : <GO|GO CONDITIONNEL|NO-GO>

Phase: 2 -- Securite
Sprint: 7 (Phase 2 / Sprint 3)
Reference B-07, C-07, V-07
Report: sprint07-verify-report.md"
```

6. **Documentation continue** : si decisions techniques prises pendant verification, ajouter notes dans `repo/docs/runbooks/sprint-07-lessons-learned.md`

---

**Fin de la verification V-07 v2.2 detaillee -- Sprint 7 (2.3) RBAC Granulaire (12 roles x 85+ permissions).**

**Total criteres taches** : 82 | **Total transversaux** : ~10 | **Effort sprint** : 70h
