# VERIFICATION SPRINT 25 -- Phase 5 / Sprint 7 : Cross-Tenant Framework (3 types tenants Repair)
# Version : Auto-reparation active + Rapport final MD detaille
# 12 taches, 46 criteres extraits B-25
# AUCUNE EMOJI AUTORISEE

**Version** : v2.2 (verification detaillee)
**Phase** : 5 -- Vertical Repair (Skalean Garage ERP)
**Sprint** : 25 / 35 (cumul) -- Sprint 7 dans Phase 5
**Reference meta-prompt** : `B-25-sprint-25-cross-tenant-framework.md`
**Reference orchestrateur** : `C-25-sprint-25-cross-tenant-framework.md`
**Total criteres** : 46 criteres taches + ~10 transversaux

---

Tu es **Claude Code (ou Cowork)**. Tu dois executer une **verification COMPLETE et EXHAUSTIVE** du Sprint 25 apres execution toutes les 12 taches.

---

## REGLES D'EXECUTION

1. Tu **executes CHAQUE verification dans l'ordre** (taches puis transversales)
2. Quand une verification echoue, tu **TENTES UNE REPARATION AUTOMATIQUE** avant de noter FAIL
3. Apres chaque tentative de reparation, tu **re-executes la verification**
4. Tu consignes dans `sprint25-verify-report.md` **TOUS les resultats** au fil de l'execution
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
REPORT_FILE="sprint25-verify-report.md"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
RUN_ID=$(date '+%Y%m%d-%H%M%S')

cat > "$REPORT_FILE" << EOF
# Rapport de Verification - Sprint 25 : Cross-Tenant Framework (3 types tenants Repair)

**Date** : $TIMESTAMP
**Run ID** : $RUN_ID
**Phase** : 5 -- Vertical Repair (Skalean Garage ERP)
**Sprint** : 25 (Phase 5 / Sprint 7)
**Reference B-25** : 12 taches, 46 criteres extraits
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

## TACHE 1/4 -- 5.7.1 : TenantType + CapabilitiesMatrix

```bash
echo ""
echo "================================================"
echo "TACHE 5.7.1 : TenantType + CapabilitiesMatrix"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 4"
echo "================================================"

# === Verification fichiers crees ===
# Test T01-F1: Existence fichier repo/packages/database/src/migrations/{date}-AddTenantSubtypeAndCapabilities.ts
if [ -f "repo/packages/database/src/migrations/{date}-AddTenantSubtypeAndCapabilities.ts" ]; then
  add_row "T01-F1" "Fichier {date}-AddTenantSubtypeAndCapabilities.ts existe" "PASS" "Cree"
else
  add_row "T01-F1" "Fichier {date}-AddTenantSubtypeAndCapabilities.ts existe" "FAIL" "Manquant"
fi
# Test T01-F2: Existence fichier repo/packages/auth/src/cross-tenant/capabilities-matrix.ts
if [ -f "repo/packages/auth/src/cross-tenant/capabilities-matrix.ts" ]; then
  add_row "T01-F2" "Fichier capabilities-matrix.ts existe" "PASS" "Cree"
else
  add_row "T01-F2" "Fichier capabilities-matrix.ts existe" "FAIL" "Manquant"
fi
# Test T01-F3: Existence fichier repo/packages/auth/src/cross-tenant/types.ts
if [ -f "repo/packages/auth/src/cross-tenant/types.ts" ]; then
  add_row "T01-F3" "Fichier types.ts existe" "PASS" "Cree"
else
  add_row "T01-F3" "Fichier types.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T01-V1: 3 types enum (P0)
echo "  Verifying T01-V1 : 3 types enum..."
add_row "T01-V1" "3 types enum" "WARN" "(P0) Voir B-25 Tache 5.7.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V2: Capabilities matrix definition (P0)
echo "  Verifying T01-V2 : Capabilities matrix definition..."
add_row "T01-V2" "Capabilities matrix definition" "WARN" "(P0) Voir B-25 Tache 5.7.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V3: Service hasCapability fonctionne (P0)
echo "  Verifying T01-V3 : Service hasCapability fonctionne..."
add_row "T01-V3" "Service hasCapability fonctionne" "WARN" "(P0) Voir B-25 Tache 5.7.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V4: Tests 8+ scenarios (P0)
echo "  Verifying T01-V4 : Tests 8+ scenarios..."
add_row "T01-V4" "Tests 8+ scenarios" "WARN" "(P0) Voir B-25 Tache 5.7.1 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 2/3 -- 5.7.2 : Type 1 Atlas Implementation Formalize

```bash
echo ""
echo "================================================"
echo "TACHE 5.7.2 : Type 1 Atlas Implementation Formalize"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 3"
echo "================================================"

# === Verification fichiers crees ===
# Test T02-F1: Existence fichier repo/infrastructure/scripts/seed-skalean-atlas.ts
if [ -f "repo/infrastructure/scripts/seed-skalean-atlas.ts" ]; then
  add_row "T02-F1" "Fichier seed-skalean-atlas.ts existe" "PASS" "Cree"
else
  add_row "T02-F1" "Fichier seed-skalean-atlas.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T02-V1: Atlas tenant correctement tagged (P0)
echo "  Verifying T02-V1 : Atlas tenant correctement tagged..."
add_row "T02-V1" "Atlas tenant correctement tagged" "WARN" "(P0) Voir B-25 Tache 5.7.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V2: Capabilities applique (P0)
echo "  Verifying T02-V2 : Capabilities applique..."
add_row "T02-V2" "Capabilities applique" "WARN" "(P0) Voir B-25 Tache 5.7.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V3: Tests 4+ scenarios (P0)
echo "  Verifying T02-V3 : Tests 4+ scenarios..."
add_row "T02-V3" "Tests 4+ scenarios" "WARN" "(P0) Voir B-25 Tache 5.7.2 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 3/4 -- 5.7.3 : Type 2 Partenaires Geres : Multi-Tenant Strict

```bash
echo ""
echo "================================================"
echo "TACHE 5.7.3 : Type 2 Partenaires Geres : Multi-Tenant Strict"
echo "Priorite : P0 | Effort : 7h"
echo "Criteres a verifier : 4"
echo "================================================"

# === Verification fichiers crees ===
# Test T03-F1: Existence fichier repo/packages/auth/src/services/managed-partner-onboarding.service.ts
if [ -f "repo/packages/auth/src/services/managed-partner-onboarding.service.ts" ]; then
  add_row "T03-F1" "Fichier managed-partner-onboarding.service.ts existe" "PASS" "Cree"
else
  add_row "T03-F1" "Fichier managed-partner-onboarding.service.ts existe" "FAIL" "Manquant"
fi
# Test T03-F2: Existence fichier repo/packages/database/src/migrations/{date}-CrossTenantViews.ts
if [ -f "repo/packages/database/src/migrations/{date}-CrossTenantViews.ts" ]; then
  add_row "T03-F2" "Fichier {date}-CrossTenantViews.ts existe" "PASS" "Cree"
else
  add_row "T03-F2" "Fichier {date}-CrossTenantViews.ts existe" "FAIL" "Manquant"
fi
# Test T03-F3: Existence fichier repo/apps/api/src/modules/admin/controllers/managed-partner.controller.ts
if [ -f "repo/apps/api/src/modules/admin/controllers/managed-partner.controller.ts" ]; then
  add_row "T03-F3" "Fichier managed-partner.controller.ts existe" "PASS" "Cree"
else
  add_row "T03-F3" "Fichier managed-partner.controller.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T03-V1: Type 2 tenant cree avec capabilities (P0)
echo "  Verifying T03-V1 : Type 2 tenant cree avec capabilities..."
add_row "T03-V1" "Type 2 tenant cree avec capabilities" "WARN" "(P0) Voir B-25 Tache 5.7.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V2: Multi-tenant isolation respect (P0)
echo "  Verifying T03-V2 : Multi-tenant isolation respect..."
add_row "T03-V2" "Multi-tenant isolation respect" "WARN" "(P0) Voir B-25 Tache 5.7.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V3: Cross-tenant view sinistre status fonctionne (P0)
echo "  Verifying T03-V3 : Cross-tenant view sinistre status fonctionne..."
add_row "T03-V3" "Cross-tenant view sinistre status fonctionne" "WARN" "(P0) Voir B-25 Tache 5.7.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V4: Tests isolation 8+ scenarios (P0)
echo "  Verifying T03-V4 : Tests isolation 8+ scenarios..."
add_row "T03-V4" "Tests isolation 8+ scenarios" "WARN" "(P0) Voir B-25 Tache 5.7.3 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 4/5 -- 5.7.4 : Type 3 Partenaires API Only : Passerelle

```bash
echo ""
echo "================================================"
echo "TACHE 5.7.4 : Type 3 Partenaires API Only : Passerelle"
echo "Priorite : P0 | Effort : 7h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T04-F1: Existence fichier repo/packages/database/src/migrations/{date}-ApiPartnerConfigurations.ts
if [ -f "repo/packages/database/src/migrations/{date}-ApiPartnerConfigurations.ts" ]; then
  add_row "T04-F1" "Fichier {date}-ApiPartnerConfigurations.ts existe" "PASS" "Cree"
else
  add_row "T04-F1" "Fichier {date}-ApiPartnerConfigurations.ts existe" "FAIL" "Manquant"
fi
# Test T04-F2: Existence fichier repo/packages/repair/src/connectors/api-partner-connector.interface.ts
if [ -f "repo/packages/repair/src/connectors/api-partner-connector.interface.ts" ]; then
  add_row "T04-F2" "Fichier api-partner-connector.interface.ts existe" "PASS" "Cree"
else
  add_row "T04-F2" "Fichier api-partner-connector.interface.ts existe" "FAIL" "Manquant"
fi
# Test T04-F3: Existence fichier repo/packages/repair/src/connectors/api-partner-connector.service.ts
if [ -f "repo/packages/repair/src/connectors/api-partner-connector.service.ts" ]; then
  add_row "T04-F3" "Fichier api-partner-connector.service.ts existe" "PASS" "Cree"
else
  add_row "T04-F3" "Fichier api-partner-connector.service.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T04-V1: Type 3 connector fonctionne (P0)
echo "  Verifying T04-V1 : Type 3 connector fonctionne..."
add_row "T04-V1" "Type 3 connector fonctionne" "WARN" "(P0) Voir B-25 Tache 5.7.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V2: Circuit breaker active (P0)
echo "  Verifying T04-V2 : Circuit breaker active..."
add_row "T04-V2" "Circuit breaker active" "WARN" "(P0) Voir B-25 Tache 5.7.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V3: Webhook signature verifiee (P0)
echo "  Verifying T04-V3 : Webhook signature verifiee..."
add_row "T04-V3" "Webhook signature verifiee" "WARN" "(P0) Voir B-25 Tache 5.7.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V4: Mapping data Skalean <-> partner (P0)
echo "  Verifying T04-V4 : Mapping data Skalean <-> partner..."
add_row "T04-V4" "Mapping data Skalean <-> partner" "WARN" "(P0) Voir B-25 Tache 5.7.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V5: Tests 10+ scenarios (P0)
echo "  Verifying T04-V5 : Tests 10+ scenarios..."
add_row "T04-V5" "Tests 10+ scenarios" "WARN" "(P0) Voir B-25 Tache 5.7.4 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 5/4 -- 5.7.5 : CrossTenantSharingService

```bash
echo ""
echo "================================================"
echo "TACHE 5.7.5 : CrossTenantSharingService"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 4"
echo "================================================"

# === Verification fichiers crees ===
# Test T05-F1: Existence fichier repo/packages/repair/src/services/cross-tenant-sharing.service.ts
if [ -f "repo/packages/repair/src/services/cross-tenant-sharing.service.ts" ]; then
  add_row "T05-F1" "Fichier cross-tenant-sharing.service.ts existe" "PASS" "Cree"
else
  add_row "T05-F1" "Fichier cross-tenant-sharing.service.ts existe" "FAIL" "Manquant"
fi
# Test T05-F2: Existence fichier repo/apps/api/src/modules/cross-tenant/cross-tenant-views.controller.ts
if [ -f "repo/apps/api/src/modules/cross-tenant/cross-tenant-views.controller.ts" ]; then
  add_row "T05-F2" "Fichier cross-tenant-views.controller.ts existe" "PASS" "Cree"
else
  add_row "T05-F2" "Fichier cross-tenant-views.controller.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T05-V1: Sharing rules par type tenant (P0)
echo "  Verifying T05-V1 : Sharing rules par type tenant..."
add_row "T05-V1" "Sharing rules par type tenant" "WARN" "(P0) Voir B-25 Tache 5.7.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V2: Read-only respect (P0)
echo "  Verifying T05-V2 : Read-only respect..."
add_row "T05-V2" "Read-only respect" "WARN" "(P0) Voir B-25 Tache 5.7.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V3: Audit complete (P0)
echo "  Verifying T05-V3 : Audit complete..."
add_row "T05-V3" "Audit complete" "WARN" "(P0) Voir B-25 Tache 5.7.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V4: Tests 10+ scenarios (P0)
echo "  Verifying T05-V4 : Tests 10+ scenarios..."
add_row "T05-V4" "Tests 10+ scenarios" "WARN" "(P0) Voir B-25 Tache 5.7.5 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 6/5 -- 5.7.6 : Runtime Activation Type per Tenant

```bash
echo ""
echo "================================================"
echo "TACHE 5.7.6 : Runtime Activation Type per Tenant"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T06-F1: Existence fichier repo/packages/database/src/migrations/{date}-TenantTypeChanges.ts
if [ -f "repo/packages/database/src/migrations/{date}-TenantTypeChanges.ts" ]; then
  add_row "T06-F1" "Fichier {date}-TenantTypeChanges.ts existe" "PASS" "Cree"
else
  add_row "T06-F1" "Fichier {date}-TenantTypeChanges.ts existe" "FAIL" "Manquant"
fi
# Test T06-F2: Existence fichier repo/packages/auth/src/services/tenant-type-management.service.ts
if [ -f "repo/packages/auth/src/services/tenant-type-management.service.ts" ]; then
  add_row "T06-F2" "Fichier tenant-type-management.service.ts existe" "PASS" "Cree"
else
  add_row "T06-F2" "Fichier tenant-type-management.service.ts existe" "FAIL" "Manquant"
fi
# Test T06-F3: Existence fichier repo/apps/api/src/modules/admin/controllers/tenant-type.controller.ts
if [ -f "repo/apps/api/src/modules/admin/controllers/tenant-type.controller.ts" ]; then
  add_row "T06-F3" "Fichier tenant-type.controller.ts existe" "PASS" "Cree"
else
  add_row "T06-F3" "Fichier tenant-type.controller.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T06-V1: SetType valide capabilities (P0)
echo "  Verifying T06-V1 : SetType valide capabilities..."
add_row "T06-V1" "SetType valide capabilities" "WARN" "(P0) Voir B-25 Tache 5.7.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V2: Transitions controles (P0)
echo "  Verifying T06-V2 : Transitions controles..."
add_row "T06-V2" "Transitions controles" "WARN" "(P0) Voir B-25 Tache 5.7.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V3: Disable preserves data (P0)
echo "  Verifying T06-V3 : Disable preserves data..."
add_row "T06-V3" "Disable preserves data" "WARN" "(P0) Voir B-25 Tache 5.7.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V4: Audit complete (P0)
echo "  Verifying T06-V4 : Audit complete..."
add_row "T06-V4" "Audit complete" "WARN" "(P0) Voir B-25 Tache 5.7.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V5: Tests 8+ scenarios (P0)
echo "  Verifying T06-V5 : Tests 8+ scenarios..."
add_row "T06-V5" "Tests 8+ scenarios" "WARN" "(P0) Voir B-25 Tache 5.7.6 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 7/4 -- 5.7.7 : Onboarding Wizard Backend

```bash
echo ""
echo "================================================"
echo "TACHE 5.7.7 : Onboarding Wizard Backend"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 4"
echo "================================================"

# === Verification fichiers crees ===
# Test T07-F1: Existence fichier repo/packages/database/src/migrations/{date}-TenantOnboardingWorkflows.ts
if [ -f "repo/packages/database/src/migrations/{date}-TenantOnboardingWorkflows.ts" ]; then
  add_row "T07-F1" "Fichier {date}-TenantOnboardingWorkflows.ts existe" "PASS" "Cree"
else
  add_row "T07-F1" "Fichier {date}-TenantOnboardingWorkflows.ts existe" "FAIL" "Manquant"
fi
# Test T07-F2: Existence fichier repo/packages/auth/src/services/partner-onboarding-workflow.service.ts
if [ -f "repo/packages/auth/src/services/partner-onboarding-workflow.service.ts" ]; then
  add_row "T07-F2" "Fichier partner-onboarding-workflow.service.ts existe" "PASS" "Cree"
else
  add_row "T07-F2" "Fichier partner-onboarding-workflow.service.ts existe" "FAIL" "Manquant"
fi
# Test T07-F3: Existence fichier repo/apps/api/src/modules/admin/controllers/onboarding.controller.ts
if [ -f "repo/apps/api/src/modules/admin/controllers/onboarding.controller.ts" ]; then
  add_row "T07-F3" "Fichier onboarding.controller.ts existe" "PASS" "Cree"
else
  add_row "T07-F3" "Fichier onboarding.controller.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T07-V1: Workflow 7 steps (P0)
echo "  Verifying T07-V1 : Workflow 7 steps..."
add_row "T07-V1" "Workflow 7 steps" "WARN" "(P0) Voir B-25 Tache 5.7.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V2: Type 2 vs Type 3 differents (P0)
echo "  Verifying T07-V2 : Type 2 vs Type 3 differents..."
add_row "T07-V2" "Type 2 vs Type 3 differents" "WARN" "(P0) Voir B-25 Tache 5.7.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V3: API keys generation Type 3 (P0)
echo "  Verifying T07-V3 : API keys generation Type 3..."
add_row "T07-V3" "API keys generation Type 3" "WARN" "(P0) Voir B-25 Tache 5.7.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V4: Tests 8+ scenarios (P0)
echo "  Verifying T07-V4 : Tests 8+ scenarios..."
add_row "T07-V4" "Tests 8+ scenarios" "WARN" "(P0) Voir B-25 Tache 5.7.7 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 8/4 -- 5.7.8 : Capabilities Checks Middleware

```bash
echo ""
echo "================================================"
echo "TACHE 5.7.8 : Capabilities Checks Middleware"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 4"
echo "================================================"

# === Verification fichiers crees ===
# Test T08-F1: Existence fichier repo/packages/auth/src/decorators/require-capability.decorator.ts
if [ -f "repo/packages/auth/src/decorators/require-capability.decorator.ts" ]; then
  add_row "T08-F1" "Fichier require-capability.decorator.ts existe" "PASS" "Cree"
else
  add_row "T08-F1" "Fichier require-capability.decorator.ts existe" "FAIL" "Manquant"
fi
# Test T08-F2: Existence fichier repo/packages/auth/src/guards/capabilities.guard.ts
if [ -f "repo/packages/auth/src/guards/capabilities.guard.ts" ]; then
  add_row "T08-F2" "Fichier capabilities.guard.ts existe" "PASS" "Cree"
else
  add_row "T08-F2" "Fichier capabilities.guard.ts existe" "FAIL" "Manquant"
fi
# Test T08-F3: Existence fichier repo/packages/auth/src/services/capabilities-cache.service.ts
if [ -f "repo/packages/auth/src/services/capabilities-cache.service.ts" ]; then
  add_row "T08-F3" "Fichier capabilities-cache.service.ts existe" "PASS" "Cree"
else
  add_row "T08-F3" "Fichier capabilities-cache.service.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T08-V1: Decorator + Guard (P0)
echo "  Verifying T08-V1 : Decorator + Guard..."
add_row "T08-V1" "Decorator + Guard" "WARN" "(P0) Voir B-25 Tache 5.7.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V2: Cache Redis 5min (P0)
echo "  Verifying T08-V2 : Cache Redis 5min..."
add_row "T08-V2" "Cache Redis 5min" "WARN" "(P0) Voir B-25 Tache 5.7.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V3: 403 si missing (P0)
echo "  Verifying T08-V3 : 403 si missing..."
add_row "T08-V3" "403 si missing" "WARN" "(P0) Voir B-25 Tache 5.7.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V4: Tests 8+ scenarios (P0)
echo "  Verifying T08-V4 : Tests 8+ scenarios..."
add_row "T08-V4" "Tests 8+ scenarios" "WARN" "(P0) Voir B-25 Tache 5.7.8 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 9/4 -- 5.7.9 : Pattern Reutilisable Insure (Sprint 32 Prep)

```bash
echo ""
echo "================================================"
echo "TACHE 5.7.9 : Pattern Reutilisable Insure (Sprint 32 Prep)"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 4"
echo "================================================"

# === Verification fichiers crees ===
# Test T09-F1: Existence fichier repo/docs/cross-tenant-pattern-reuse.md
if [ -f "repo/docs/cross-tenant-pattern-reuse.md" ]; then
  add_row "T09-F1" "Fichier cross-tenant-pattern-reuse.md existe" "PASS" "Cree"
else
  add_row "T09-F1" "Fichier cross-tenant-pattern-reuse.md existe" "FAIL" "Manquant"
fi
# Test T09-F2: Existence fichier repo/packages/insure/src/cross-tenant/capabilities-matrix-insure.ts
if [ -f "repo/packages/insure/src/cross-tenant/capabilities-matrix-insure.ts" ]; then
  add_row "T09-F2" "Fichier capabilities-matrix-insure.ts existe" "PASS" "Cree"
else
  add_row "T09-F2" "Fichier capabilities-matrix-insure.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T09-V1: Documentation pattern complete (P0)
echo "  Verifying T09-V1 : Documentation pattern complete..."
add_row "T09-V1" "Documentation pattern complete" "WARN" "(P0) Voir B-25 Tache 5.7.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V2: Capabilities Insure preparation (P0)
echo "  Verifying T09-V2 : Capabilities Insure preparation..."
add_row "T09-V2" "Capabilities Insure preparation" "WARN" "(P0) Voir B-25 Tache 5.7.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V3: Interfaces compiles (P0)
echo "  Verifying T09-V3 : Interfaces compiles..."
add_row "T09-V3" "Interfaces compiles" "WARN" "(P0) Voir B-25 Tache 5.7.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V4: Sprint 32 ready a reutiliser (P0)
echo "  Verifying T09-V4 : Sprint 32 ready a reutiliser..."
add_row "T09-V4" "Sprint 32 ready a reutiliser" "WARN" "(P0) Voir B-25 Tache 5.7.9 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 10/2 -- 5.7.10 : Endpoints REST + Permissions

```bash
echo ""
echo "================================================"
echo "TACHE 5.7.10 : Endpoints REST + Permissions"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 2"
echo "================================================"

# === Verification fichiers crees ===
# Test T10-F1: Existence fichier repo/packages/auth/src/rbac/permissions.enum.ts
if [ -f "repo/packages/auth/src/rbac/permissions.enum.ts" ]; then
  add_row "T10-F1" "Fichier permissions.enum.ts existe" "PASS" "Cree"
else
  add_row "T10-F1" "Fichier permissions.enum.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T10-V1: Permissions cross-tenant management (P0)
echo "  Verifying T10-V1 : Permissions cross-tenant management..."
add_row "T10-V1" "Permissions cross-tenant management" "WARN" "(P0) Voir B-25 Tache 5.7.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V2: Tests 6+ scenarios (P0)
echo "  Verifying T10-V2 : Tests 6+ scenarios..."
add_row "T10-V2" "Tests 6+ scenarios" "WARN" "(P0) Voir B-25 Tache 5.7.10 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 11/3 -- 5.7.11 : Documentation Architecture

```bash
echo ""
echo "================================================"
echo "TACHE 5.7.11 : Documentation Architecture"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 3"
echo "================================================"

# === Verification fichiers crees ===
# Test T11-F1: Existence fichier repo/docs/cross-tenant-architecture.md
if [ -f "repo/docs/cross-tenant-architecture.md" ]; then
  add_row "T11-F1" "Fichier cross-tenant-architecture.md existe" "PASS" "Cree"
else
  add_row "T11-F1" "Fichier cross-tenant-architecture.md existe" "FAIL" "Manquant"
fi
# Test T11-F2: Existence fichier repo/docs/onboarding-partner-guide.md
if [ -f "repo/docs/onboarding-partner-guide.md" ]; then
  add_row "T11-F2" "Fichier onboarding-partner-guide.md existe" "PASS" "Cree"
else
  add_row "T11-F2" "Fichier onboarding-partner-guide.md existe" "FAIL" "Manquant"
fi
# Test T11-F3: Existence fichier repo/docs/cross-tenant-isolation-tests-guide.md
if [ -f "repo/docs/cross-tenant-isolation-tests-guide.md" ]; then
  add_row "T11-F3" "Fichier cross-tenant-isolation-tests-guide.md existe" "PASS" "Cree"
else
  add_row "T11-F3" "Fichier cross-tenant-isolation-tests-guide.md existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T11-V1: 3 documents complets (P0)
echo "  Verifying T11-V1 : 3 documents complets..."
add_row "T11-V1" "3 documents complets" "WARN" "(P0) Voir B-25 Tache 5.7.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V2: Diagrams clairs (P0)
echo "  Verifying T11-V2 : Diagrams clairs..."
add_row "T11-V2" "Diagrams clairs" "WARN" "(P0) Voir B-25 Tache 5.7.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V3: Sprint 35 pilote ready (P0)
echo "  Verifying T11-V3 : Sprint 35 pilote ready..."
add_row "T11-V3" "Sprint 35 pilote ready" "WARN" "(P0) Voir B-25 Tache 5.7.11 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 12/4 -- 5.7.12 : Tests Isolation Exhaustifs + Phase 5 Closure

```bash
echo ""
echo "================================================"
echo "TACHE 5.7.12 : Tests Isolation Exhaustifs + Phase 5 Closure"
echo "Priorite : P0 | Effort : 12h"
echo "Criteres a verifier : 4"
echo "================================================"

# === Verification fichiers crees ===
# Test T12-F1: Existence fichier repo/apps/api/test/cross-tenant/{40+ specs}.e2e-spec.ts
if [ -f "repo/apps/api/test/cross-tenant/{40+ specs}.e2e-spec.ts" ]; then
  add_row "T12-F1" "Fichier {40+ specs}.e2e-spec.ts existe" "PASS" "Cree"
else
  add_row "T12-F1" "Fichier {40+ specs}.e2e-spec.ts existe" "FAIL" "Manquant"
fi
# Test T12-F2: Existence fichier repo/docs/phase-5-completion.md
if [ -f "repo/docs/phase-5-completion.md" ]; then
  add_row "T12-F2" "Fichier phase-5-completion.md existe" "PASS" "Cree"
else
  add_row "T12-F2" "Fichier phase-5-completion.md existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T12-V1: 40+ tests passent (P0)
echo "  Verifying T12-V1 : 40+ tests passent..."
add_row "T12-V1" "40+ tests passent" "WARN" "(P0) Voir B-25 Tache 5.7.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V2: CI green (P0)
echo "  Verifying T12-V2 : CI green..."
add_row "T12-V2" "CI green" "WARN" "(P0) Voir B-25 Tache 5.7.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V3: Documentation Phase 5 closure (P0)
echo "  Verifying T12-V3 : Documentation Phase 5 closure..."
add_row "T12-V3" "Documentation Phase 5 closure" "WARN" "(P0) Voir B-25 Tache 5.7.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V4: Reproducibility 5x (P0)
echo "  Verifying T12-V4 : Reproducibility 5x..."
add_row "T12-V4" "Reproducibility 5x" "WARN" "(P0) Voir B-25 Tache 5.7.12 pour test detaille - critere a auto-tester via script ad-hoc"

```

---


---


## VERIFICATIONS TRANSVERSALES SPRINT 25

### TR-BUILD : Build complet du sprint

```bash
echo ""
echo "================================================"
echo "VERIFICATIONS TRANSVERSALES SPRINT 25"
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

### TR-MIGRATIONS : Migrations DB Sprint 25

```bash
echo "=== TR-MIGRATIONS : Migrations DB ==="
MIGR_COUNT=$(pg_query "SELECT COUNT(*) FROM migrations WHERE name LIKE '%sprint25%' OR name LIKE '%Sprint25%'" || echo 0)
if [ "$MIGR_COUNT" -gt 0 ]; then
  add_row "TR-MIG" "Migrations Sprint 25 appliquees" "PASS" "$MIGR_COUNT migrations"
else
  add_row "TR-MIG" "Migrations Sprint 25 appliquees" "WARN" "Aucune migration detectee (verifier)"
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
echo "GENERATION DU RAPPORT FINAL SPRINT 25"
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

## Jalon GO/NO-GO Sprint 25

EOF

# Calcul statut final
if (( $(echo "$SCORE >= 95" | bc -l) )); then
  STATUT="GO"
  cat >> "$REPORT_FILE" << EOF
**STATUT** : GO -- Sprint 25 valide, passage Sprint 26 autorise

Le sprint a passe les criteres requis. Cowork peut demarrer Sprint 26.

EOF
  echo ""
  echo "================================================"
  echo "SPRINT 25 : GO ($SCORE%)"
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
  echo "SPRINT 25 : GO CONDITIONNEL ($SCORE%)"
  echo "================================================"
else
  STATUT="NO-GO"
  cat >> "$REPORT_FILE" << EOF
**STATUT** : NO-GO -- Score $SCORE% trop bas (cible 85% minimum)

Le sprint **doit etre repris** :
- Lister tous FAIL P0
- Escalation Saad/Abla decision (cut scope OR delai)
- Reprise sprint avant Sprint 26

EOF
  echo ""
  echo "================================================"
  echo "SPRINT 25 : NO-GO ($SCORE%)"
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
  echo "git commit -m \"chore(sprint-25): close sprint 25 -- $STATUT ($SCORE%)\"" >> "$REPORT_FILE"
  echo '```' >> "$REPORT_FILE"
fi

echo ""
echo "Rapport complet dans : $REPORT_FILE"
```

---

## INSTRUCTION FINALE A CLAUDE CODE / COWORK

Apres l'execution complete des verifications ci-dessus :

1. **Lis le contenu de `sprint25-verify-report.md`** integralement
2. **Identifie les FAIL critiques** (criteres P0) qui necessitent intervention manuelle
3. **Affiche un resume executif** :
   - Nombre total de criteres
   - Pourcentage PASS / PASS\* / FAIL / WARN
   - Liste des FAIL avec contexte technique
   - Recommandation : GO / GO CONDITIONNEL / NO-GO
4. **Si NO-GO** : ne pas demarrer le Sprint suivant, alerter Saad/Abla via Slack `#insurtech-dev`
5. **Si GO ou GO CONDITIONNEL** : produire le commit de cloture du sprint :

```bash
git add skalean-insurtech/sprint25-verify-report.md
git commit -m "chore(sprint-25): close sprint 25 with verification report

- Verification automatique executee
- Score global : <SCORE>%
- <PASS> criteres PASS, <PASS_REPAIRED> reparations auto, <FAIL> FAIL
- Statut : <GO|GO CONDITIONNEL|NO-GO>

Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Sprint: 25 (Phase 5 / Sprint 7)
Reference B-25, C-25, V-25
Report: sprint25-verify-report.md"
```

6. **Documentation continue** : si decisions techniques prises pendant verification, ajouter notes dans `repo/docs/runbooks/sprint-25-lessons-learned.md`

---

**Fin de la verification V-25 v2.2 detaillee -- Sprint 25 (5.7) Cross-Tenant Framework (3 types tenants Repair).**

**Total criteres taches** : 46 | **Total transversaux** : ~10 | **Effort sprint** : 70h
