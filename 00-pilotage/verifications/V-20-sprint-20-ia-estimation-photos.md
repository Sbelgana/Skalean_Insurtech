# VERIFICATION SPRINT 20 -- Phase 5 / Sprint 2 : IA Estimation Photos (mock realistic)
# Version : Auto-reparation active + Rapport final MD detaille
# 12 taches, 53 criteres extraits B-20
# AUCUNE EMOJI AUTORISEE

**Version** : v2.2 (verification detaillee)
**Phase** : 5 -- Vertical Repair (Skalean Garage ERP)
**Sprint** : 20 / 35 (cumul) -- Sprint 2 dans Phase 5
**Reference meta-prompt** : `B-20-sprint-20-ia-estimation-photos.md`
**Reference orchestrateur** : `C-20-sprint-20-ia-estimation-photos.md`
**Total criteres** : 53 criteres taches + ~10 transversaux

---

Tu es **Claude Code (ou Cowork)**. Tu dois executer une **verification COMPLETE et EXHAUSTIVE** du Sprint 20 apres execution toutes les 12 taches.

---

## REGLES D'EXECUTION

1. Tu **executes CHAQUE verification dans l'ordre** (taches puis transversales)
2. Quand une verification echoue, tu **TENTES UNE REPARATION AUTOMATIQUE** avant de noter FAIL
3. Apres chaque tentative de reparation, tu **re-executes la verification**
4. Tu consignes dans `sprint20-verify-report.md` **TOUS les resultats** au fil de l'execution
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
REPORT_FILE="sprint20-verify-report.md"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
RUN_ID=$(date '+%Y%m%d-%H%M%S')

cat > "$REPORT_FILE" << EOF
# Rapport de Verification - Sprint 20 : IA Estimation Photos (mock realistic)

**Date** : $TIMESTAMP
**Run ID** : $RUN_ID
**Phase** : 5 -- Vertical Repair (Skalean Garage ERP)
**Sprint** : 20 (Phase 5 / Sprint 2)
**Reference B-20** : 12 taches, 53 criteres extraits
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

## TACHE 1/4 -- 5.2.1 : IaEstimationPhotosClient Interface + Types

```bash
echo ""
echo "================================================"
echo "TACHE 5.2.1 : IaEstimationPhotosClient Interface + Types"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 4"
echo "================================================"

# === Verification fichiers crees ===
# Test T01-F1: Existence fichier repo/packages/repair/src/ia-estimation/ia-estimation.interface.ts
if [ -f "repo/packages/repair/src/ia-estimation/ia-estimation.interface.ts" ]; then
  add_row "T01-F1" "Fichier ia-estimation.interface.ts existe" "PASS" "Cree"
else
  add_row "T01-F1" "Fichier ia-estimation.interface.ts existe" "FAIL" "Manquant"
fi
# Test T01-F2: Existence fichier repo/packages/repair/src/ia-estimation/types.ts
if [ -f "repo/packages/repair/src/ia-estimation/types.ts" ]; then
  add_row "T01-F2" "Fichier types.ts existe" "PASS" "Cree"
else
  add_row "T01-F2" "Fichier types.ts existe" "FAIL" "Manquant"
fi
# Test T01-F3: Existence fichier repo/packages/repair/src/ia-estimation/errors.ts
if [ -f "repo/packages/repair/src/ia-estimation/errors.ts" ]; then
  add_row "T01-F3" "Fichier errors.ts existe" "PASS" "Cree"
else
  add_row "T01-F3" "Fichier errors.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T01-V1: Interface declare 3 methods (P0)
echo "  Verifying T01-V1 : Interface declare 3 methods..."
add_row "T01-V1" "Interface declare 3 methods" "WARN" "(P0) Voir B-20 Tache 5.2.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V2: Types Zod-validated (P0)
echo "  Verifying T01-V2 : Types Zod-validated..."
add_row "T01-V2" "Types Zod-validated" "WARN" "(P0) Voir B-20 Tache 5.2.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V3: Errors typed 3 classes (P0)
echo "  Verifying T01-V3 : Errors typed 3 classes..."
add_row "T01-V3" "Errors typed 3 classes" "WARN" "(P0) Voir B-20 Tache 5.2.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V4: Tests contracts 6+ scenarios (P0)
echo "  Verifying T01-V4 : Tests contracts 6+ scenarios..."
add_row "T01-V4" "Tests contracts 6+ scenarios" "WARN" "(P0) Voir B-20 Tache 5.2.1 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 2/6 -- 5.2.2 : MockIaEstimationClient Implementation

```bash
echo ""
echo "================================================"
echo "TACHE 5.2.2 : MockIaEstimationClient Implementation"
echo "Priorite : P0 | Effort : 7h"
echo "Criteres a verifier : 6"
echo "================================================"

# === Verification fichiers crees ===
# Test T02-F1: Existence fichier repo/packages/repair/src/ia-estimation/mock-ia-estimation.client.ts
if [ -f "repo/packages/repair/src/ia-estimation/mock-ia-estimation.client.ts" ]; then
  add_row "T02-F1" "Fichier mock-ia-estimation.client.ts existe" "PASS" "Cree"
else
  add_row "T02-F1" "Fichier mock-ia-estimation.client.ts existe" "FAIL" "Manquant"
fi
# Test T02-F2: Existence fichier repo/packages/repair/src/ia-estimation/damage-patterns.data.ts
if [ -f "repo/packages/repair/src/ia-estimation/damage-patterns.data.ts" ]; then
  add_row "T02-F2" "Fichier damage-patterns.data.ts existe" "PASS" "Cree"
else
  add_row "T02-F2" "Fichier damage-patterns.data.ts existe" "FAIL" "Manquant"
fi
# Test T02-F3: Existence fichier repo/packages/repair/src/ia-estimation/mock-ia-estimation.client.spec.ts
if [ -f "repo/packages/repair/src/ia-estimation/mock-ia-estimation.client.spec.ts" ]; then
  add_row "T02-F3" "Fichier mock-ia-estimation.client.spec.ts existe" "PASS" "Cree"
else
  add_row "T02-F3" "Fichier mock-ia-estimation.client.spec.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T02-V1: Mock retourne data structuree (P0)
echo "  Verifying T02-V1 : Mock retourne data structuree..."
add_row "T02-V1" "Mock retourne data structuree" "WARN" "(P0) Voir B-20 Tache 5.2.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V2: 5 damage types supportes (P0)
echo "  Verifying T02-V2 : 5 damage types supportes..."
add_row "T02-V2" "5 damage types supportes" "WARN" "(P0) Voir B-20 Tache 5.2.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V3: Pseudo-deterministic (seed) (P0)
echo "  Verifying T02-V3 : Pseudo-deterministic (seed)..."
add_row "T02-V3" "Pseudo-deterministic (seed)" "WARN" "(P0) Voir B-20 Tache 5.2.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V4: Latency simulation 1-3s (P0)
echo "  Verifying T02-V4 : Latency simulation 1-3s..."
add_row "T02-V4" "Latency simulation 1-3s" "WARN" "(P0) Voir B-20 Tache 5.2.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V5: Edge cases handled (P0)
echo "  Verifying T02-V5 : Edge cases handled..."
add_row "T02-V5" "Edge cases handled" "WARN" "(P0) Voir B-20 Tache 5.2.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V6: Tests 15+ scenarios (P0)
echo "  Verifying T02-V6 : Tests 15+ scenarios..."
add_row "T02-V6" "Tests 15+ scenarios" "WARN" "(P0) Voir B-20 Tache 5.2.2 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 3/4 -- 5.2.3 : SkaleanAiVisionClient Placeholder

```bash
echo ""
echo "================================================"
echo "TACHE 5.2.3 : SkaleanAiVisionClient Placeholder"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 4"
echo "================================================"

# === Verification fichiers crees ===
# Test T03-F1: Existence fichier repo/packages/repair/src/ia-estimation/skalean-ai-vision.client.ts
if [ -f "repo/packages/repair/src/ia-estimation/skalean-ai-vision.client.ts" ]; then
  add_row "T03-F1" "Fichier skalean-ai-vision.client.ts existe" "PASS" "Cree"
else
  add_row "T03-F1" "Fichier skalean-ai-vision.client.ts existe" "FAIL" "Manquant"
fi
# Test T03-F2: Existence fichier repo/packages/repair/src/ia-estimation/skalean-ai-vision.client.spec.ts
if [ -f "repo/packages/repair/src/ia-estimation/skalean-ai-vision.client.spec.ts" ]; then
  add_row "T03-F2" "Fichier skalean-ai-vision.client.spec.ts existe" "PASS" "Cree"
else
  add_row "T03-F2" "Fichier skalean-ai-vision.client.spec.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T03-V1: Class exists implementing interface (P0)
echo "  Verifying T03-V1 : Class exists implementing interface..."
add_row "T03-V1" "Class exists implementing interface" "WARN" "(P0) Voir B-20 Tache 5.2.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V2: estimateDamages throws NotImplementedException (P0)
echo "  Verifying T03-V2 : estimateDamages throws NotImplementedException..."
add_row "T03-V2" "estimateDamages throws NotImplementedException" "WARN" "(P0) Voir B-20 Tache 5.2.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V3: Constructor validates config (P0)
echo "  Verifying T03-V3 : Constructor validates config..."
add_row "T03-V3" "Constructor validates config" "WARN" "(P0) Voir B-20 Tache 5.2.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V4: Tests 4+ scenarios (P0)
echo "  Verifying T03-V4 : Tests 4+ scenarios..."
add_row "T03-V4" "Tests 4+ scenarios" "WARN" "(P0) Voir B-20 Tache 5.2.3 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 4/5 -- 5.2.4 : DI Module Configuration (Swap Factory)

```bash
echo ""
echo "================================================"
echo "TACHE 5.2.4 : DI Module Configuration (Swap Factory)"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T04-F1: Existence fichier repo/packages/repair/src/ia-estimation/ia-estimation.module.ts
if [ -f "repo/packages/repair/src/ia-estimation/ia-estimation.module.ts" ]; then
  add_row "T04-F1" "Fichier ia-estimation.module.ts existe" "PASS" "Cree"
else
  add_row "T04-F1" "Fichier ia-estimation.module.ts existe" "FAIL" "Manquant"
fi
# Test T04-F2: Existence fichier repo/packages/repair/src/ia-estimation/ia-estimation.module.spec.ts
if [ -f "repo/packages/repair/src/ia-estimation/ia-estimation.module.spec.ts" ]; then
  add_row "T04-F2" "Fichier ia-estimation.module.spec.ts existe" "PASS" "Cree"
else
  add_row "T04-F2" "Fichier ia-estimation.module.spec.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T04-V1: Module provides client (P0)
echo "  Verifying T04-V1 : Module provides client..."
add_row "T04-V1" "Module provides client" "WARN" "(P0) Voir B-20 Tache 5.2.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V2: Mock default (P0)
echo "  Verifying T04-V2 : Mock default..."
add_row "T04-V2" "Mock default" "WARN" "(P0) Voir B-20 Tache 5.2.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V3: Swap config swap implementation (P0)
echo "  Verifying T04-V3 : Swap config swap implementation..."
add_row "T04-V3" "Swap config swap implementation" "WARN" "(P0) Voir B-20 Tache 5.2.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V4: Logger + health check (P0)
echo "  Verifying T04-V4 : Logger + health check..."
add_row "T04-V4" "Logger + health check" "WARN" "(P0) Voir B-20 Tache 5.2.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V5: Tests 6+ scenarios (P0)
echo "  Verifying T04-V5 : Tests 6+ scenarios..."
add_row "T04-V5" "Tests 6+ scenarios" "WARN" "(P0) Voir B-20 Tache 5.2.4 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 5/5 -- 5.2.5 : Auto-Trigger Lors Diagnostic.Start()

```bash
echo ""
echo "================================================"
echo "TACHE 5.2.5 : Auto-Trigger Lors Diagnostic.Start()"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T05-F1: Existence fichier repo/packages/repair/src/services/diagnostics.service.ts
if [ -f "repo/packages/repair/src/services/diagnostics.service.ts" ]; then
  add_row "T05-F1" "Fichier diagnostics.service.ts existe" "PASS" "Cree"
else
  add_row "T05-F1" "Fichier diagnostics.service.ts existe" "FAIL" "Manquant"
fi
# Test T05-F2: Existence fichier repo/packages/repair/src/jobs/run-ia-estimation.job.ts
if [ -f "repo/packages/repair/src/jobs/run-ia-estimation.job.ts" ]; then
  add_row "T05-F2" "Fichier run-ia-estimation.job.ts existe" "PASS" "Cree"
else
  add_row "T05-F2" "Fichier run-ia-estimation.job.ts existe" "FAIL" "Manquant"
fi
# Test T05-F3: Existence fichier repo/packages/repair/src/jobs/ia-estimation-worker.ts
if [ -f "repo/packages/repair/src/jobs/ia-estimation-worker.ts" ]; then
  add_row "T05-F3" "Fichier ia-estimation-worker.ts existe" "PASS" "Cree"
else
  add_row "T05-F3" "Fichier ia-estimation-worker.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T05-V1: Auto-trigger lors diagnostic start (P0)
echo "  Verifying T05-V1 : Auto-trigger lors diagnostic start..."
add_row "T05-V1" "Auto-trigger lors diagnostic start" "WARN" "(P0) Voir B-20 Tache 5.2.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V2: Async via BullMQ (P0)
echo "  Verifying T05-V2 : Async via BullMQ..."
add_row "T05-V2" "Async via BullMQ" "WARN" "(P0) Voir B-20 Tache 5.2.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V3: Retry 3x backoff (P0)
echo "  Verifying T05-V3 : Retry 3x backoff..."
add_row "T05-V3" "Retry 3x backoff" "WARN" "(P0) Voir B-20 Tache 5.2.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V4: DLQ alerte (P0)
echo "  Verifying T05-V4 : DLQ alerte..."
add_row "T05-V4" "DLQ alerte" "WARN" "(P0) Voir B-20 Tache 5.2.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V5: Tests 8+ scenarios (P0)
echo "  Verifying T05-V5 : Tests 8+ scenarios..."
add_row "T05-V5" "Tests 8+ scenarios" "WARN" "(P0) Voir B-20 Tache 5.2.5 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 6/4 -- 5.2.6 : repair_ia_estimations Entity + Service

```bash
echo ""
echo "================================================"
echo "TACHE 5.2.6 : repair_ia_estimations Entity + Service"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 4"
echo "================================================"

# === Verification fichiers crees ===
# Test T06-F1: Existence fichier repo/packages/database/src/migrations/{date}-RepairIaEstimations.ts
if [ -f "repo/packages/database/src/migrations/{date}-RepairIaEstimations.ts" ]; then
  add_row "T06-F1" "Fichier {date}-RepairIaEstimations.ts existe" "PASS" "Cree"
else
  add_row "T06-F1" "Fichier {date}-RepairIaEstimations.ts existe" "FAIL" "Manquant"
fi
# Test T06-F2: Existence fichier repo/packages/repair/src/entities/repair-ia-estimation.entity.ts
if [ -f "repo/packages/repair/src/entities/repair-ia-estimation.entity.ts" ]; then
  add_row "T06-F2" "Fichier repair-ia-estimation.entity.ts existe" "PASS" "Cree"
else
  add_row "T06-F2" "Fichier repair-ia-estimation.entity.ts existe" "FAIL" "Manquant"
fi
# Test T06-F3: Existence fichier repo/packages/repair/src/services/ia-estimations.service.ts
if [ -f "repo/packages/repair/src/services/ia-estimations.service.ts" ]; then
  add_row "T06-F3" "Fichier ia-estimations.service.ts existe" "PASS" "Cree"
else
  add_row "T06-F3" "Fichier ia-estimations.service.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T06-V1: Migration creee (P0)
echo "  Verifying T06-V1 : Migration creee..."
add_row "T06-V1" "Migration creee" "WARN" "(P0) Voir B-20 Tache 5.2.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V2: Service CRUD operationnel (P0)
echo "  Verifying T06-V2 : Service CRUD operationnel..."
add_row "T06-V2" "Service CRUD operationnel" "WARN" "(P0) Voir B-20 Tache 5.2.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V3: technician_edits diff stocke (P0)
echo "  Verifying T06-V3 : technician_edits diff stocke..."
add_row "T06-V3" "technician_edits diff stocke" "WARN" "(P0) Voir B-20 Tache 5.2.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V4: Tests 8+ scenarios (P0)
echo "  Verifying T06-V4 : Tests 8+ scenarios..."
add_row "T06-V4" "Tests 8+ scenarios" "WARN" "(P0) Voir B-20 Tache 5.2.6 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 7/5 -- 5.2.7 : Workflow Validation Technicien

```bash
echo ""
echo "================================================"
echo "TACHE 5.2.7 : Workflow Validation Technicien"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T07-F1: Existence fichier repo/packages/repair/src/services/diagnostics.service.ts
if [ -f "repo/packages/repair/src/services/diagnostics.service.ts" ]; then
  add_row "T07-F1" "Fichier diagnostics.service.ts existe" "PASS" "Cree"
else
  add_row "T07-F1" "Fichier diagnostics.service.ts existe" "FAIL" "Manquant"
fi
# Test T07-F2: Existence fichier repo/apps/api/src/modules/repair/controllers/diagnostics.controller.ts
if [ -f "repo/apps/api/src/modules/repair/controllers/diagnostics.controller.ts" ]; then
  add_row "T07-F2" "Fichier diagnostics.controller.ts existe" "PASS" "Cree"
else
  add_row "T07-F2" "Fichier diagnostics.controller.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T07-V1: Accept copies suggestions (P0)
echo "  Verifying T07-V1 : Accept copies suggestions..."
add_row "T07-V1" "Accept copies suggestions" "WARN" "(P0) Voir B-20 Tache 5.2.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V2: Edit applies + logs diff (P0)
echo "  Verifying T07-V2 : Edit applies + logs diff..."
add_row "T07-V2" "Edit applies + logs diff" "WARN" "(P0) Voir B-20 Tache 5.2.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V3: Reject preserves diagnostic vide (P0)
echo "  Verifying T07-V3 : Reject preserves diagnostic vide..."
add_row "T07-V3" "Reject preserves diagnostic vide" "WARN" "(P0) Voir B-20 Tache 5.2.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V4: Audit complete (P0)
echo "  Verifying T07-V4 : Audit complete..."
add_row "T07-V4" "Audit complete" "WARN" "(P0) Voir B-20 Tache 5.2.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V5: Tests 8+ scenarios (P0)
echo "  Verifying T07-V5 : Tests 8+ scenarios..."
add_row "T07-V5" "Tests 8+ scenarios" "WARN" "(P0) Voir B-20 Tache 5.2.7 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 8/5 -- 5.2.8 : Cache Redis 24h + Invalidation

```bash
echo ""
echo "================================================"
echo "TACHE 5.2.8 : Cache Redis 24h + Invalidation"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T08-F1: Existence fichier repo/packages/repair/src/ia-estimation/cached-ia-estimation.client.ts
if [ -f "repo/packages/repair/src/ia-estimation/cached-ia-estimation.client.ts" ]; then
  add_row "T08-F1" "Fichier cached-ia-estimation.client.ts existe" "PASS" "Cree"
else
  add_row "T08-F1" "Fichier cached-ia-estimation.client.ts existe" "FAIL" "Manquant"
fi
# Test T08-F2: Existence fichier repo/packages/repair/src/ia-estimation/cached-ia-estimation.client.spec.ts
if [ -f "repo/packages/repair/src/ia-estimation/cached-ia-estimation.client.spec.ts" ]; then
  add_row "T08-F2" "Fichier cached-ia-estimation.client.spec.ts existe" "PASS" "Cree"
else
  add_row "T08-F2" "Fichier cached-ia-estimation.client.spec.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T08-V1: Cache hit returns same result (P0)
echo "  Verifying T08-V1 : Cache hit returns same result..."
add_row "T08-V1" "Cache hit returns same result" "WARN" "(P0) Voir B-20 Tache 5.2.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V2: Cache miss calls client (P0)
echo "  Verifying T08-V2 : Cache miss calls client..."
add_row "T08-V2" "Cache miss calls client" "WARN" "(P0) Voir B-20 Tache 5.2.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V3: TTL 24h (P0)
echo "  Verifying T08-V3 : TTL 24h..."
add_row "T08-V3" "TTL 24h" "WARN" "(P0) Voir B-20 Tache 5.2.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V4: Invalidation force (P0)
echo "  Verifying T08-V4 : Invalidation force..."
add_row "T08-V4" "Invalidation force" "WARN" "(P0) Voir B-20 Tache 5.2.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V5: Tests 6+ scenarios (P0)
echo "  Verifying T08-V5 : Tests 6+ scenarios..."
add_row "T08-V5" "Tests 6+ scenarios" "WARN" "(P0) Voir B-20 Tache 5.2.8 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 9/4 -- 5.2.9 : Endpoints REST

```bash
echo ""
echo "================================================"
echo "TACHE 5.2.9 : Endpoints REST"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 4"
echo "================================================"

# === Verification fichiers crees ===
# Test T09-F1: Existence fichier repo/apps/api/src/modules/admin/controllers/admin-ia-estimations.controller.ts
if [ -f "repo/apps/api/src/modules/admin/controllers/admin-ia-estimations.controller.ts" ]; then
  add_row "T09-F1" "Fichier admin-ia-estimations.controller.ts existe" "PASS" "Cree"
else
  add_row "T09-F1" "Fichier admin-ia-estimations.controller.ts existe" "FAIL" "Manquant"
fi
# Test T09-F2: Existence fichier repo/packages/auth/src/rbac/permissions.enum.ts
if [ -f "repo/packages/auth/src/rbac/permissions.enum.ts" ]; then
  add_row "T09-F2" "Fichier permissions.enum.ts existe" "PASS" "Cree"
else
  add_row "T09-F2" "Fichier permissions.enum.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T09-V1: Endpoints REST operationnels (P0)
echo "  Verifying T09-V1 : Endpoints REST operationnels..."
add_row "T09-V1" "Endpoints REST operationnels" "WARN" "(P0) Voir B-20 Tache 5.2.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V2: Health endpoint (P0)
echo "  Verifying T09-V2 : Health endpoint..."
add_row "T09-V2" "Health endpoint" "WARN" "(P0) Voir B-20 Tache 5.2.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V3: Manual re-estimate (P0)
echo "  Verifying T09-V3 : Manual re-estimate..."
add_row "T09-V3" "Manual re-estimate" "WARN" "(P0) Voir B-20 Tache 5.2.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V4: Tests 6+ scenarios (P0)
echo "  Verifying T09-V4 : Tests 6+ scenarios..."
add_row "T09-V4" "Tests 6+ scenarios" "WARN" "(P0) Voir B-20 Tache 5.2.9 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 10/4 -- 5.2.10 : Audit + Kafka + Analytics

```bash
echo ""
echo "================================================"
echo "TACHE 5.2.10 : Audit + Kafka + Analytics"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 4"
echo "================================================"

# === Verification fichiers crees ===
# Test T10-F1: Existence fichier repo/packages/analytics/src/etl/postgres-to-clickhouse.etl.ts
if [ -f "repo/packages/analytics/src/etl/postgres-to-clickhouse.etl.ts" ]; then
  add_row "T10-F1" "Fichier postgres-to-clickhouse.etl.ts existe" "PASS" "Cree"
else
  add_row "T10-F1" "Fichier postgres-to-clickhouse.etl.ts existe" "FAIL" "Manquant"
fi
# Test T10-F2: Existence fichier repo/infrastructure/clickhouse/schemas/fct_ia_estimations.sql
if [ -f "repo/infrastructure/clickhouse/schemas/fct_ia_estimations.sql" ]; then
  add_row "T10-F2" "Fichier fct_ia_estimations.sql existe" "PASS" "Cree"
else
  add_row "T10-F2" "Fichier fct_ia_estimations.sql existe" "FAIL" "Manquant"
fi
# Test T10-F3: Existence fichier repo/apps/api/src/modules/analytics/services/ia-estimations-dashboard.service.ts
if [ -f "repo/apps/api/src/modules/analytics/services/ia-estimations-dashboard.service.ts" ]; then
  add_row "T10-F3" "Fichier ia-estimations-dashboard.service.ts existe" "PASS" "Cree"
else
  add_row "T10-F3" "Fichier ia-estimations-dashboard.service.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T10-V1: Kafka events emits (P0)
echo "  Verifying T10-V1 : Kafka events emits..."
add_row "T10-V1" "Kafka events emits" "WARN" "(P0) Voir B-20 Tache 5.2.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V2: ETL sync clickhouse (P0)
echo "  Verifying T10-V2 : ETL sync clickhouse..."
add_row "T10-V2" "ETL sync clickhouse" "WARN" "(P0) Voir B-20 Tache 5.2.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V3: Dashboard accuracy + perf (P0)
echo "  Verifying T10-V3 : Dashboard accuracy + perf..."
add_row "T10-V3" "Dashboard accuracy + perf" "WARN" "(P0) Voir B-20 Tache 5.2.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V4: Tests 6+ scenarios (P0)
echo "  Verifying T10-V4 : Tests 6+ scenarios..."
add_row "T10-V4" "Tests 6+ scenarios" "WARN" "(P0) Voir B-20 Tache 5.2.10 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 11/3 -- 5.2.11 : Documentation Swap Sprint 30+

```bash
echo ""
echo "================================================"
echo "TACHE 5.2.11 : Documentation Swap Sprint 30+"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 3"
echo "================================================"

# === Verification fichiers crees ===
# Test T11-F1: Existence fichier repo/docs/ia-estimation-migration-sprint-30.md
if [ -f "repo/docs/ia-estimation-migration-sprint-30.md" ]; then
  add_row "T11-F1" "Fichier ia-estimation-migration-sprint-30.md existe" "PASS" "Cree"
else
  add_row "T11-F1" "Fichier ia-estimation-migration-sprint-30.md existe" "FAIL" "Manquant"
fi
# Test T11-F2: Existence fichier repo/docs/ia-estimation-architecture.md
if [ -f "repo/docs/ia-estimation-architecture.md" ]; then
  add_row "T11-F2" "Fichier ia-estimation-architecture.md existe" "PASS" "Cree"
else
  add_row "T11-F2" "Fichier ia-estimation-architecture.md existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T11-V1: Documentation complete (P0)
echo "  Verifying T11-V1 : Documentation complete..."
add_row "T11-V1" "Documentation complete" "WARN" "(P0) Voir B-20 Tache 5.2.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V2: Procedure detaillee (P0)
echo "  Verifying T11-V2 : Procedure detaillee..."
add_row "T11-V2" "Procedure detaillee" "WARN" "(P0) Voir B-20 Tache 5.2.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V3: Tests integration template (P0)
echo "  Verifying T11-V3 : Tests integration template..."
add_row "T11-V3" "Tests integration template" "WARN" "(P0) Voir B-20 Tache 5.2.11 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 12/4 -- 5.2.12 : Tests E2E + Photos Fixtures

```bash
echo ""
echo "================================================"
echo "TACHE 5.2.12 : Tests E2E + Photos Fixtures"
echo "Priorite : P0 | Effort : 8h"
echo "Criteres a verifier : 4"
echo "================================================"

# === Verification fichiers crees ===
# Test T12-F1: Existence fichier repo/apps/api/test/repair/ia-estimation/{25+ specs}.e2e-spec.ts
if [ -f "repo/apps/api/test/repair/ia-estimation/{25+ specs}.e2e-spec.ts" ]; then
  add_row "T12-F1" "Fichier {25+ specs}.e2e-spec.ts existe" "PASS" "Cree"
else
  add_row "T12-F1" "Fichier {25+ specs}.e2e-spec.ts existe" "FAIL" "Manquant"
fi
# Test T12-F2: Existence fichier repo/infrastructure/scripts/seed-photos-fixtures.ts
if [ -f "repo/infrastructure/scripts/seed-photos-fixtures.ts" ]; then
  add_row "T12-F2" "Fichier seed-photos-fixtures.ts existe" "PASS" "Cree"
else
  add_row "T12-F2" "Fichier seed-photos-fixtures.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T12-V1: 25+ tests passent (P0)
echo "  Verifying T12-V1 : 25+ tests passent..."
add_row "T12-V1" "25+ tests passent" "WARN" "(P0) Voir B-20 Tache 5.2.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V2: Fixtures photos reproducibles (P0)
echo "  Verifying T12-V2 : Fixtures photos reproducibles..."
add_row "T12-V2" "Fixtures photos reproducibles" "WARN" "(P0) Voir B-20 Tache 5.2.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V3: CI green (P0)
echo "  Verifying T12-V3 : CI green..."
add_row "T12-V3" "CI green" "WARN" "(P0) Voir B-20 Tache 5.2.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V4: Reproducibility 5x (P0)
echo "  Verifying T12-V4 : Reproducibility 5x..."
add_row "T12-V4" "Reproducibility 5x" "WARN" "(P0) Voir B-20 Tache 5.2.12 pour test detaille - critere a auto-tester via script ad-hoc"

```

---


---


## VERIFICATIONS TRANSVERSALES SPRINT 20

### TR-BUILD : Build complet du sprint

```bash
echo ""
echo "================================================"
echo "VERIFICATIONS TRANSVERSALES SPRINT 20"
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

### TR-MIGRATIONS : Migrations DB Sprint 20

```bash
echo "=== TR-MIGRATIONS : Migrations DB ==="
MIGR_COUNT=$(pg_query "SELECT COUNT(*) FROM migrations WHERE name LIKE '%sprint20%' OR name LIKE '%Sprint20%'" || echo 0)
if [ "$MIGR_COUNT" -gt 0 ]; then
  add_row "TR-MIG" "Migrations Sprint 20 appliquees" "PASS" "$MIGR_COUNT migrations"
else
  add_row "TR-MIG" "Migrations Sprint 20 appliquees" "WARN" "Aucune migration detectee (verifier)"
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
echo "GENERATION DU RAPPORT FINAL SPRINT 20"
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

## Jalon GO/NO-GO Sprint 20

EOF

# Calcul statut final
if (( $(echo "$SCORE >= 95" | bc -l) )); then
  STATUT="GO"
  cat >> "$REPORT_FILE" << EOF
**STATUT** : GO -- Sprint 20 valide, passage Sprint 21 autorise

Le sprint a passe les criteres requis. Cowork peut demarrer Sprint 21.

EOF
  echo ""
  echo "================================================"
  echo "SPRINT 20 : GO ($SCORE%)"
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
  echo "SPRINT 20 : GO CONDITIONNEL ($SCORE%)"
  echo "================================================"
else
  STATUT="NO-GO"
  cat >> "$REPORT_FILE" << EOF
**STATUT** : NO-GO -- Score $SCORE% trop bas (cible 85% minimum)

Le sprint **doit etre repris** :
- Lister tous FAIL P0
- Escalation Saad/Abla decision (cut scope OR delai)
- Reprise sprint avant Sprint 21

EOF
  echo ""
  echo "================================================"
  echo "SPRINT 20 : NO-GO ($SCORE%)"
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
  echo "git commit -m \"chore(sprint-20): close sprint 20 -- $STATUT ($SCORE%)\"" >> "$REPORT_FILE"
  echo '```' >> "$REPORT_FILE"
fi

echo ""
echo "Rapport complet dans : $REPORT_FILE"
```

---

## INSTRUCTION FINALE A CLAUDE CODE / COWORK

Apres l'execution complete des verifications ci-dessus :

1. **Lis le contenu de `sprint20-verify-report.md`** integralement
2. **Identifie les FAIL critiques** (criteres P0) qui necessitent intervention manuelle
3. **Affiche un resume executif** :
   - Nombre total de criteres
   - Pourcentage PASS / PASS\* / FAIL / WARN
   - Liste des FAIL avec contexte technique
   - Recommandation : GO / GO CONDITIONNEL / NO-GO
4. **Si NO-GO** : ne pas demarrer le Sprint suivant, alerter Saad/Abla via Slack `#insurtech-dev`
5. **Si GO ou GO CONDITIONNEL** : produire le commit de cloture du sprint :

```bash
git add skalean-insurtech/sprint20-verify-report.md
git commit -m "chore(sprint-20): close sprint 20 with verification report

- Verification automatique executee
- Score global : <SCORE>%
- <PASS> criteres PASS, <PASS_REPAIRED> reparations auto, <FAIL> FAIL
- Statut : <GO|GO CONDITIONNEL|NO-GO>

Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Sprint: 20 (Phase 5 / Sprint 2)
Reference B-20, C-20, V-20
Report: sprint20-verify-report.md"
```

6. **Documentation continue** : si decisions techniques prises pendant verification, ajouter notes dans `repo/docs/runbooks/sprint-20-lessons-learned.md`

---

**Fin de la verification V-20 v2.2 detaillee -- Sprint 20 (5.2) IA Estimation Photos (mock realistic).**

**Total criteres taches** : 53 | **Total transversaux** : ~10 | **Effort sprint** : 70h
