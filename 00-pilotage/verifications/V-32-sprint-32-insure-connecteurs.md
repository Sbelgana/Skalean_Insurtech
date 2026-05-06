# VERIFICATION SPRINT 32 -- Phase 7 / Sprint 4 : Insure Connecteurs Assureurs (5 connecteurs)
# Version : Auto-reparation active + Rapport final MD detaille
# 13 taches, 48 criteres extraits B-32
# AUCUNE EMOJI AUTORISEE

**Version** : v2.2 (verification detaillee)
**Phase** : 7 -- Hardening + Integrations + Pilote
**Sprint** : 32 / 35 (cumul) -- Sprint 4 dans Phase 7
**Reference meta-prompt** : `B-32-sprint-32-insure-connecteurs.md`
**Reference orchestrateur** : `C-32-sprint-32-insure-connecteurs.md`
**Total criteres** : 48 criteres taches + ~10 transversaux

---

Tu es **Claude Code (ou Cowork)**. Tu dois executer une **verification COMPLETE et EXHAUSTIVE** du Sprint 32 apres execution toutes les 13 taches.

---

## REGLES D'EXECUTION

1. Tu **executes CHAQUE verification dans l'ordre** (taches puis transversales)
2. Quand une verification echoue, tu **TENTES UNE REPARATION AUTOMATIQUE** avant de noter FAIL
3. Apres chaque tentative de reparation, tu **re-executes la verification**
4. Tu consignes dans `sprint32-verify-report.md` **TOUS les resultats** au fil de l'execution
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
REPORT_FILE="sprint32-verify-report.md"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
RUN_ID=$(date '+%Y%m%d-%H%M%S')

cat > "$REPORT_FILE" << EOF
# Rapport de Verification - Sprint 32 : Insure Connecteurs Assureurs (5 connecteurs)

**Date** : $TIMESTAMP
**Run ID** : $RUN_ID
**Phase** : 7 -- Hardening + Integrations + Pilote
**Sprint** : 32 (Phase 7 / Sprint 4)
**Reference B-32** : 13 taches, 48 criteres extraits
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

## VERIFICATIONS PAR TACHE (13 taches)

## TACHE 1/6 -- 7.4.1 : InsurerConnectorInterface + Base Abstract Class

```bash
echo ""
echo "================================================"
echo "TACHE 7.4.1 : InsurerConnectorInterface + Base Abstract Class"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 6"
echo "================================================"

# === Verification fichiers crees ===
# Test T01-F1: Existence fichier repo/packages/insure/src/connectors/insurer-connector.interface.ts
if [ -f "repo/packages/insure/src/connectors/insurer-connector.interface.ts" ]; then
  add_row "T01-F1" "Fichier insurer-connector.interface.ts existe" "PASS" "Cree"
else
  add_row "T01-F1" "Fichier insurer-connector.interface.ts existe" "FAIL" "Manquant"
fi
# Test T01-F2: Existence fichier repo/packages/insure/src/connectors/base-insurer-connector.ts
if [ -f "repo/packages/insure/src/connectors/base-insurer-connector.ts" ]; then
  add_row "T01-F2" "Fichier base-insurer-connector.ts existe" "PASS" "Cree"
else
  add_row "T01-F2" "Fichier base-insurer-connector.ts existe" "FAIL" "Manquant"
fi
# Test T01-F3: Existence fichier repo/packages/insure/src/connectors/types.ts
if [ -f "repo/packages/insure/src/connectors/types.ts" ]; then
  add_row "T01-F3" "Fichier types.ts existe" "PASS" "Cree"
else
  add_row "T01-F3" "Fichier types.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T01-V1: Interface declare 8 methods (P0)
echo "  Verifying T01-V1 : Interface declare 8 methods..."
add_row "T01-V1" "Interface declare 8 methods" "WARN" "(P0) Voir B-32 Tache 7.4.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V2: Base class HTTP retry + circuit breaker (P0)
echo "  Verifying T01-V2 : Base class HTTP retry + circuit breaker..."
add_row "T01-V2" "Base class HTTP retry + circuit breaker" "WARN" "(P0) Voir B-32 Tache 7.4.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V3: Circuit breaker open -> InsurerCircuitBreakerOpenError (P0)
echo "  Verifying T01-V3 : Circuit breaker open -> InsurerCircuitBreakerOpenError..."
add_row "T01-V3" "Circuit breaker open -> InsurerCircuitBreakerOpenError" "WARN" "(P0) Voir B-32 Tache 7.4.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V4: Cache Redis 5min hit (P0)
echo "  Verifying T01-V4 : Cache Redis 5min hit..."
add_row "T01-V4" "Cache Redis 5min hit" "WARN" "(P0) Voir B-32 Tache 7.4.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V5: Metrics OTEL emit (P0)
echo "  Verifying T01-V5 : Metrics OTEL emit..."
add_row "T01-V5" "Metrics OTEL emit" "WARN" "(P0) Voir B-32 Tache 7.4.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V6: Tests 8+ scenarios (P0)
echo "  Verifying T01-V6 : Tests 8+ scenarios..."
add_row "T01-V6" "Tests 8+ scenarios" "WARN" "(P0) Voir B-32 Tache 7.4.1 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 2/5 -- 7.4.2 : Wafa Assurance Connector (Priorite 1)

```bash
echo ""
echo "================================================"
echo "TACHE 7.4.2 : Wafa Assurance Connector (Priorite 1)"
echo "Priorite : P0 | Effort : 8h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T02-F1: Existence fichier repo/packages/insure/src/connectors/wafa/wafa.connector.ts
if [ -f "repo/packages/insure/src/connectors/wafa/wafa.connector.ts" ]; then
  add_row "T02-F1" "Fichier wafa.connector.ts existe" "PASS" "Cree"
else
  add_row "T02-F1" "Fichier wafa.connector.ts existe" "FAIL" "Manquant"
fi
# Test T02-F2: Existence fichier repo/packages/insure/src/connectors/wafa/wafa.connector.spec.ts
if [ -f "repo/packages/insure/src/connectors/wafa/wafa.connector.spec.ts" ]; then
  add_row "T02-F2" "Fichier wafa.connector.spec.ts existe" "PASS" "Cree"
else
  add_row "T02-F2" "Fichier wafa.connector.spec.ts existe" "FAIL" "Manquant"
fi
# Test T02-F3: Existence fichier repo/packages/insure/src/connectors/wafa/wafa-mapping.ts
if [ -f "repo/packages/insure/src/connectors/wafa/wafa-mapping.ts" ]; then
  add_row "T02-F3" "Fichier wafa-mapping.ts existe" "PASS" "Cree"
else
  add_row "T02-F3" "Fichier wafa-mapping.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T02-V1: Connector implements interface (P0)
echo "  Verifying T02-V1 : Connector implements interface..."
add_row "T02-V1" "Connector implements interface" "WARN" "(P0) Voir B-32 Tache 7.4.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V2: 7 methods fonctionnent (mock) (P0)
echo "  Verifying T02-V2 : 7 methods fonctionnent (mock)..."
add_row "T02-V2" "7 methods fonctionnent (mock)" "WARN" "(P0) Voir B-32 Tache 7.4.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V3: HMAC signature verification (P0)
echo "  Verifying T02-V3 : HMAC signature verification..."
add_row "T02-V3" "HMAC signature verification" "WARN" "(P0) Voir B-32 Tache 7.4.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V4: Mapping data Wafa <-> Skalean (P0)
echo "  Verifying T02-V4 : Mapping data Wafa <-> Skalean..."
add_row "T02-V4" "Mapping data Wafa <-> Skalean" "WARN" "(P0) Voir B-32 Tache 7.4.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V5: Tests 12+ scenarios mock (P0)
echo "  Verifying T02-V5 : Tests 12+ scenarios mock..."
add_row "T02-V5" "Tests 12+ scenarios mock" "WARN" "(P0) Voir B-32 Tache 7.4.2 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 3/3 -- 7.4.3 : Atlanta Assurance Connector

```bash
echo ""
echo "================================================"
echo "TACHE 7.4.3 : Atlanta Assurance Connector"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 3"
echo "================================================"

# === Verification fichiers crees ===
# Test T03-F1: Existence fichier repo/packages/insure/src/connectors/atlanta/atlanta.connector.ts
if [ -f "repo/packages/insure/src/connectors/atlanta/atlanta.connector.ts" ]; then
  add_row "T03-F1" "Fichier atlanta.connector.ts existe" "PASS" "Cree"
else
  add_row "T03-F1" "Fichier atlanta.connector.ts existe" "FAIL" "Manquant"
fi
# Test T03-F2: Existence fichier repo/packages/insure/src/connectors/atlanta/atlanta-mapping.ts
if [ -f "repo/packages/insure/src/connectors/atlanta/atlanta-mapping.ts" ]; then
  add_row "T03-F2" "Fichier atlanta-mapping.ts existe" "PASS" "Cree"
else
  add_row "T03-F2" "Fichier atlanta-mapping.ts existe" "FAIL" "Manquant"
fi
# Test T03-F3: Existence fichier repo/packages/insure/src/connectors/atlanta/mock-atlanta.connector.ts
if [ -f "repo/packages/insure/src/connectors/atlanta/mock-atlanta.connector.ts" ]; then
  add_row "T03-F3" "Fichier mock-atlanta.connector.ts existe" "PASS" "Cree"
else
  add_row "T03-F3" "Fichier mock-atlanta.connector.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T03-V1: Connector implements interface (P0)
echo "  Verifying T03-V1 : Connector implements interface..."
add_row "T03-V1" "Connector implements interface" "WARN" "(P0) Voir B-32 Tache 7.4.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V2: 7 methods fonctionnent (P0)
echo "  Verifying T03-V2 : 7 methods fonctionnent..."
add_row "T03-V2" "7 methods fonctionnent" "WARN" "(P0) Voir B-32 Tache 7.4.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V3: Tests 10+ scenarios (P0)
echo "  Verifying T03-V3 : Tests 10+ scenarios..."
add_row "T03-V3" "Tests 10+ scenarios" "WARN" "(P0) Voir B-32 Tache 7.4.3 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 4/0 -- 7.4.4 : Saham Connector

```bash
echo ""
echo "================================================"
echo "TACHE 7.4.4 : Saham Connector"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 0"
echo "================================================"

# === Verification fichiers crees ===
# Test T04-F1: Existence fichier repo/packages/insure/src/connectors/saham/saham.connector.ts
if [ -f "repo/packages/insure/src/connectors/saham/saham.connector.ts" ]; then
  add_row "T04-F1" "Fichier saham.connector.ts existe" "PASS" "Cree"
else
  add_row "T04-F1" "Fichier saham.connector.ts existe" "FAIL" "Manquant"
fi
# Test T04-F2: Existence fichier repo/packages/insure/src/connectors/saham/saham-mapping.ts
if [ -f "repo/packages/insure/src/connectors/saham/saham-mapping.ts" ]; then
  add_row "T04-F2" "Fichier saham-mapping.ts existe" "PASS" "Cree"
else
  add_row "T04-F2" "Fichier saham-mapping.ts existe" "FAIL" "Manquant"
fi
# Test T04-F3: Existence fichier repo/packages/insure/src/connectors/saham/mock-saham.connector.ts
if [ -f "repo/packages/insure/src/connectors/saham/mock-saham.connector.ts" ]; then
  add_row "T04-F3" "Fichier mock-saham.connector.ts existe" "PASS" "Cree"
else
  add_row "T04-F3" "Fichier mock-saham.connector.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Aucun critere extrait pour cette tache
add_row "T04-V0" "Tache 7.4.4 criteres" "SKIP" "Voir B-32 Tache 7.4.4 pour criteres detailles"
```

---

## TACHE 5/0 -- 7.4.5 : RMA Connector

```bash
echo ""
echo "================================================"
echo "TACHE 7.4.5 : RMA Connector"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 0"
echo "================================================"

# === Verification fichiers crees ===
# Test T05-F1: Existence fichier repo/packages/insure/src/connectors/rma/rma.connector.ts
if [ -f "repo/packages/insure/src/connectors/rma/rma.connector.ts" ]; then
  add_row "T05-F1" "Fichier rma.connector.ts existe" "PASS" "Cree"
else
  add_row "T05-F1" "Fichier rma.connector.ts existe" "FAIL" "Manquant"
fi
# Test T05-F2: Existence fichier repo/packages/insure/src/connectors/rma/rma-mapping.ts
if [ -f "repo/packages/insure/src/connectors/rma/rma-mapping.ts" ]; then
  add_row "T05-F2" "Fichier rma-mapping.ts existe" "PASS" "Cree"
else
  add_row "T05-F2" "Fichier rma-mapping.ts existe" "FAIL" "Manquant"
fi
# Test T05-F3: Existence fichier repo/packages/insure/src/connectors/rma/mock-rma.connector.ts
if [ -f "repo/packages/insure/src/connectors/rma/mock-rma.connector.ts" ]; then
  add_row "T05-F3" "Fichier mock-rma.connector.ts existe" "PASS" "Cree"
else
  add_row "T05-F3" "Fichier mock-rma.connector.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Aucun critere extrait pour cette tache
add_row "T05-V0" "Tache 7.4.5 criteres" "SKIP" "Voir B-32 Tache 7.4.5 pour criteres detailles"
```

---

## TACHE 6/0 -- 7.4.6 : AXA Maroc Connector

```bash
echo ""
echo "================================================"
echo "TACHE 7.4.6 : AXA Maroc Connector"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 0"
echo "================================================"

# === Verification fichiers crees ===
# Test T06-F1: Existence fichier repo/packages/insure/src/connectors/axa/axa.connector.ts
if [ -f "repo/packages/insure/src/connectors/axa/axa.connector.ts" ]; then
  add_row "T06-F1" "Fichier axa.connector.ts existe" "PASS" "Cree"
else
  add_row "T06-F1" "Fichier axa.connector.ts existe" "FAIL" "Manquant"
fi
# Test T06-F2: Existence fichier repo/packages/insure/src/connectors/axa/axa-mapping.ts
if [ -f "repo/packages/insure/src/connectors/axa/axa-mapping.ts" ]; then
  add_row "T06-F2" "Fichier axa-mapping.ts existe" "PASS" "Cree"
else
  add_row "T06-F2" "Fichier axa-mapping.ts existe" "FAIL" "Manquant"
fi
# Test T06-F3: Existence fichier repo/packages/insure/src/connectors/axa/mock-axa.connector.ts
if [ -f "repo/packages/insure/src/connectors/axa/mock-axa.connector.ts" ]; then
  add_row "T06-F3" "Fichier mock-axa.connector.ts existe" "PASS" "Cree"
else
  add_row "T06-F3" "Fichier mock-axa.connector.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Aucun critere extrait pour cette tache
add_row "T06-V0" "Tache 7.4.6 criteres" "SKIP" "Voir B-32 Tache 7.4.6 pour criteres detailles"
```

---

## TACHE 7/6 -- 7.4.7 : TarificationOrchestrator (Routing + Fallback)

```bash
echo ""
echo "================================================"
echo "TACHE 7.4.7 : TarificationOrchestrator (Routing + Fallback)"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 6"
echo "================================================"

# === Verification fichiers crees ===
# Test T07-F1: Existence fichier repo/packages/insure/src/services/tarification-orchestrator.service.ts
if [ -f "repo/packages/insure/src/services/tarification-orchestrator.service.ts" ]; then
  add_row "T07-F1" "Fichier tarification-orchestrator.service.ts existe" "PASS" "Cree"
else
  add_row "T07-F1" "Fichier tarification-orchestrator.service.ts existe" "FAIL" "Manquant"
fi
# Test T07-F2: Existence fichier repo/packages/insure/src/services/tarification-orchestrator.service.spec.ts
if [ -f "repo/packages/insure/src/services/tarification-orchestrator.service.spec.ts" ]; then
  add_row "T07-F2" "Fichier tarification-orchestrator.service.spec.ts existe" "PASS" "Cree"
else
  add_row "T07-F2" "Fichier tarification-orchestrator.service.spec.ts existe" "FAIL" "Manquant"
fi
# Test T07-F3: Existence fichier repo/packages/insure/src/services/connector-registry.service.ts
if [ -f "repo/packages/insure/src/services/connector-registry.service.ts" ]; then
  add_row "T07-F3" "Fichier connector-registry.service.ts existe" "PASS" "Cree"
else
  add_row "T07-F3" "Fichier connector-registry.service.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T07-V1: Real-time success retourne 'source='insurer_realtime'' (P0)
echo "  Verifying T07-V1 : Real-time success retourne 'source='insurer_realtime''..."
add_row "T07-V1" "Real-time success retourne 'source='insurer_realtime''" "WARN" "(P0) Voir B-32 Tache 7.4.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V2: Circuit breaker open -> fallback automatique (P0)
echo "  Verifying T07-V2 : Circuit breaker open -> fallback automatique..."
add_row "T07-V2" "Circuit breaker open -> fallback automatique" "WARN" "(P0) Voir B-32 Tache 7.4.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V3: Pas connecteur -> fallback Sprint 14 (P0)
echo "  Verifying T07-V3 : Pas connecteur -> fallback Sprint 14..."
add_row "T07-V3" "Pas connecteur -> fallback Sprint 14" "WARN" "(P0) Voir B-32 Tache 7.4.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V4: Errors data invalid : pas fallback (propagate) (P0)
echo "  Verifying T07-V4 : Errors data invalid : pas fallback (propagate)..."
add_row "T07-V4" "Errors data invalid : pas fallback (propagate)" "WARN" "(P0) Voir B-32 Tache 7.4.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V5: Cache hit 5min (P0)
echo "  Verifying T07-V5 : Cache hit 5min..."
add_row "T07-V5" "Cache hit 5min" "WARN" "(P0) Voir B-32 Tache 7.4.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V6: Tests 10+ scenarios (P0)
echo "  Verifying T07-V6 : Tests 10+ scenarios..."
add_row "T07-V6" "Tests 10+ scenarios" "WARN" "(P0) Voir B-32 Tache 7.4.7 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 8/6 -- 7.4.8 : SouscriptionOrchestrator (Push Police vers Assureur)

```bash
echo ""
echo "================================================"
echo "TACHE 7.4.8 : SouscriptionOrchestrator (Push Police vers Assureur)"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 6"
echo "================================================"

# === Verification fichiers crees ===
# Test T08-F1: Existence fichier repo/packages/database/src/migrations/{date}-AddInsurerSyncColumns.ts
if [ -f "repo/packages/database/src/migrations/{date}-AddInsurerSyncColumns.ts" ]; then
  add_row "T08-F1" "Fichier {date}-AddInsurerSyncColumns.ts existe" "PASS" "Cree"
else
  add_row "T08-F1" "Fichier {date}-AddInsurerSyncColumns.ts existe" "FAIL" "Manquant"
fi
# Test T08-F2: Existence fichier repo/packages/insure/src/consumers/signature-completed-insure-push.consumer.ts
if [ -f "repo/packages/insure/src/consumers/signature-completed-insure-push.consumer.ts" ]; then
  add_row "T08-F2" "Fichier signature-completed-insure-push.consumer.ts existe" "PASS" "Cree"
else
  add_row "T08-F2" "Fichier signature-completed-insure-push.consumer.ts existe" "FAIL" "Manquant"
fi
# Test T08-F3: Existence fichier repo/packages/insure/src/jobs/insurer-push-retry.worker.ts
if [ -f "repo/packages/insure/src/jobs/insurer-push-retry.worker.ts" ]; then
  add_row "T08-F3" "Fichier insurer-push-retry.worker.ts existe" "PASS" "Cree"
else
  add_row "T08-F3" "Fichier insurer-push-retry.worker.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T08-V1: Signature complete -> push assureur (P0)
echo "  Verifying T08-V1 : Signature complete -> push assureur..."
add_row "T08-V1" "Signature complete -> push assureur" "WARN" "(P0) Voir B-32 Tache 7.4.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V2: insurer_policy_number stocke (P0)
echo "  Verifying T08-V2 : insurer_policy_number stocke..."
add_row "T08-V2" "insurer_policy_number stocke" "WARN" "(P0) Voir B-32 Tache 7.4.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V3: Idempotency : 2eme call ignore (P0)
echo "  Verifying T08-V3 : Idempotency : 2eme call ignore..."
add_row "T08-V3" "Idempotency : 2eme call ignore" "WARN" "(P0) Voir B-32 Tache 7.4.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V4: Retry transient errors (P0)
echo "  Verifying T08-V4 : Retry transient errors..."
add_row "T08-V4" "Retry transient errors" "WARN" "(P0) Voir B-32 Tache 7.4.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V5: DLQ apres 3 echecs (P0)
echo "  Verifying T08-V5 : DLQ apres 3 echecs..."
add_row "T08-V5" "DLQ apres 3 echecs" "WARN" "(P0) Voir B-32 Tache 7.4.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V6: Tests 8+ scenarios (P0)
echo "  Verifying T08-V6 : Tests 8+ scenarios..."
add_row "T08-V6" "Tests 8+ scenarios" "WARN" "(P0) Voir B-32 Tache 7.4.8 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 9/5 -- 7.4.9 : Sync Polices Service (Pull Updates Assureurs)

```bash
echo ""
echo "================================================"
echo "TACHE 7.4.9 : Sync Polices Service (Pull Updates Assureurs)"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T09-F1: Existence fichier repo/packages/insure/src/services/policy-sync.service.ts
if [ -f "repo/packages/insure/src/services/policy-sync.service.ts" ]; then
  add_row "T09-F1" "Fichier policy-sync.service.ts existe" "PASS" "Cree"
else
  add_row "T09-F1" "Fichier policy-sync.service.ts existe" "FAIL" "Manquant"
fi
# Test T09-F2: Existence fichier repo/packages/insure/src/jobs/policy-sync.cron.ts
if [ -f "repo/packages/insure/src/jobs/policy-sync.cron.ts" ]; then
  add_row "T09-F2" "Fichier policy-sync.cron.ts existe" "PASS" "Cree"
else
  add_row "T09-F2" "Fichier policy-sync.cron.ts existe" "FAIL" "Manquant"
fi
# Test T09-F3: Existence fichier repo/apps/api/src/modules/admin/controllers/admin-insure-sync.controller.ts
if [ -f "repo/apps/api/src/modules/admin/controllers/admin-insure-sync.controller.ts" ]; then
  add_row "T09-F3" "Fichier admin-insure-sync.controller.ts existe" "PASS" "Cree"
else
  add_row "T09-F3" "Fichier admin-insure-sync.controller.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T09-V1: Sync detect updates assureur (P0)
echo "  Verifying T09-V1 : Sync detect updates assureur..."
add_row "T09-V1" "Sync detect updates assureur" "WARN" "(P0) Voir B-32 Tache 7.4.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V2: Update Skalean (P0)
echo "  Verifying T09-V2 : Update Skalean..."
add_row "T09-V2" "Update Skalean" "WARN" "(P0) Voir B-32 Tache 7.4.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V3: Conflicts flagged (P0)
echo "  Verifying T09-V3 : Conflicts flagged..."
add_row "T09-V3" "Conflicts flagged" "WARN" "(P0) Voir B-32 Tache 7.4.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V4: Cron daily (P0)
echo "  Verifying T09-V4 : Cron daily..."
add_row "T09-V4" "Cron daily" "WARN" "(P0) Voir B-32 Tache 7.4.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V5: Tests 6+ scenarios (P0)
echo "  Verifying T09-V5 : Tests 6+ scenarios..."
add_row "T09-V5" "Tests 6+ scenarios" "WARN" "(P0) Voir B-32 Tache 7.4.9 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 10/3 -- 7.4.10 : Sinistres Connector : Declaration + Pull Updates

```bash
echo ""
echo "================================================"
echo "TACHE 7.4.10 : Sinistres Connector : Declaration + Pull Updates"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 3"
echo "================================================"

# === Verification fichiers crees ===
# Test T10-F1: Existence fichier repo/packages/insure/src/services/sinistre-sync.service.ts
if [ -f "repo/packages/insure/src/services/sinistre-sync.service.ts" ]; then
  add_row "T10-F1" "Fichier sinistre-sync.service.ts existe" "PASS" "Cree"
else
  add_row "T10-F1" "Fichier sinistre-sync.service.ts existe" "FAIL" "Manquant"
fi
# Test T10-F2: Existence fichier repo/packages/database/src/migrations/{date}-AddSinistreInsurerSync.ts
if [ -f "repo/packages/database/src/migrations/{date}-AddSinistreInsurerSync.ts" ]; then
  add_row "T10-F2" "Fichier {date}-AddSinistreInsurerSync.ts existe" "PASS" "Cree"
else
  add_row "T10-F2" "Fichier {date}-AddSinistreInsurerSync.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T10-V1: declareToInsurer push sinistre (P0)
echo "  Verifying T10-V1 : declareToInsurer push sinistre..."
add_row "T10-V1" "declareToInsurer push sinistre" "WARN" "(P0) Voir B-32 Tache 7.4.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V2: Sync from insurer (P0)
echo "  Verifying T10-V2 : Sync from insurer..."
add_row "T10-V2" "Sync from insurer" "WARN" "(P0) Voir B-32 Tache 7.4.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V3: Tests 6+ scenarios (P0)
echo "  Verifying T10-V3 : Tests 6+ scenarios..."
add_row "T10-V3" "Tests 6+ scenarios" "WARN" "(P0) Voir B-32 Tache 7.4.10 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 11/5 -- 7.4.11 : Webhook Receivers Per Assureur (5 Endpoints)

```bash
echo ""
echo "================================================"
echo "TACHE 7.4.11 : Webhook Receivers Per Assureur (5 Endpoints)"
echo "Priorite : P0 | Effort : 7h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T11-F1: Existence fichier repo/apps/api/src/modules/insure/webhooks/{5 controllers}.ts
if [ -f "repo/apps/api/src/modules/insure/webhooks/{5 controllers}.ts" ]; then
  add_row "T11-F1" "Fichier {5 controllers}.ts existe" "PASS" "Cree"
else
  add_row "T11-F1" "Fichier {5 controllers}.ts existe" "FAIL" "Manquant"
fi
# Test T11-F2: Existence fichier repo/apps/api/src/modules/insure/middleware/{5 signatures}.ts
if [ -f "repo/apps/api/src/modules/insure/middleware/{5 signatures}.ts" ]; then
  add_row "T11-F2" "Fichier {5 signatures}.ts existe" "PASS" "Cree"
else
  add_row "T11-F2" "Fichier {5 signatures}.ts existe" "FAIL" "Manquant"
fi
# Test T11-F3: Existence fichier repo/apps/api/src/modules/insure/consumers/insurer-webhook-processor.consumer.ts
if [ -f "repo/apps/api/src/modules/insure/consumers/insurer-webhook-processor.consumer.ts" ]; then
  add_row "T11-F3" "Fichier insurer-webhook-processor.consumer.ts existe" "PASS" "Cree"
else
  add_row "T11-F3" "Fichier insurer-webhook-processor.consumer.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T11-V1: 5 webhooks endpoints (P0)
echo "  Verifying T11-V1 : 5 webhooks endpoints..."
add_row "T11-V1" "5 webhooks endpoints" "WARN" "(P0) Voir B-32 Tache 7.4.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V2: Signatures verifiees per assureur (P0)
echo "  Verifying T11-V2 : Signatures verifiees per assureur..."
add_row "T11-V2" "Signatures verifiees per assureur" "WARN" "(P0) Voir B-32 Tache 7.4.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V3: Idempotency (P0)
echo "  Verifying T11-V3 : Idempotency..."
add_row "T11-V3" "Idempotency" "WARN" "(P0) Voir B-32 Tache 7.4.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V4: Status updates appliquees (P0)
echo "  Verifying T11-V4 : Status updates appliquees..."
add_row "T11-V4" "Status updates appliquees" "WARN" "(P0) Voir B-32 Tache 7.4.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V5: Tests E2E 10+ scenarios (P0)
echo "  Verifying T11-V5 : Tests E2E 10+ scenarios..."
add_row "T11-V5" "Tests E2E 10+ scenarios" "WARN" "(P0) Voir B-32 Tache 7.4.11 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 12/4 -- 7.4.12 : Endpoints REST + Admin Monitoring

```bash
echo ""
echo "================================================"
echo "TACHE 7.4.12 : Endpoints REST + Admin Monitoring"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 4"
echo "================================================"

# === Verification fichiers crees ===
# Test T12-F1: Existence fichier repo/apps/api/src/modules/insure/controllers/connectors.controller.ts
if [ -f "repo/apps/api/src/modules/insure/controllers/connectors.controller.ts" ]; then
  add_row "T12-F1" "Fichier connectors.controller.ts existe" "PASS" "Cree"
else
  add_row "T12-F1" "Fichier connectors.controller.ts existe" "FAIL" "Manquant"
fi
# Test T12-F2: Existence fichier repo/apps/api/src/modules/admin/controllers/admin-connectors-health.controller.ts
if [ -f "repo/apps/api/src/modules/admin/controllers/admin-connectors-health.controller.ts" ]; then
  add_row "T12-F2" "Fichier admin-connectors-health.controller.ts existe" "PASS" "Cree"
else
  add_row "T12-F2" "Fichier admin-connectors-health.controller.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T12-V1: List connecteurs (P0)
echo "  Verifying T12-V1 : List connecteurs..."
add_row "T12-V1" "List connecteurs" "WARN" "(P0) Voir B-32 Tache 7.4.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V2: Test connection (P0)
echo "  Verifying T12-V2 : Test connection..."
add_row "T12-V2" "Test connection" "WARN" "(P0) Voir B-32 Tache 7.4.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V3: Health endpoint admin (P0)
echo "  Verifying T12-V3 : Health endpoint admin..."
add_row "T12-V3" "Health endpoint admin" "WARN" "(P0) Voir B-32 Tache 7.4.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V4: Tests 6+ scenarios (P0)
echo "  Verifying T12-V4 : Tests 6+ scenarios..."
add_row "T12-V4" "Tests 6+ scenarios" "WARN" "(P0) Voir B-32 Tache 7.4.12 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 13/5 -- 7.4.13 : Tests E2E (40+) avec Mocks 5 Assureurs

```bash
echo ""
echo "================================================"
echo "TACHE 7.4.13 : Tests E2E (40+) avec Mocks 5 Assureurs"
echo "Priorite : P0 | Effort : 9h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T13-F1: Existence fichier repo/apps/api/test/insure/connectors/{30+ specs}.e2e-spec.ts
if [ -f "repo/apps/api/test/insure/connectors/{30+ specs}.e2e-spec.ts" ]; then
  add_row "T13-F1" "Fichier {30+ specs}.e2e-spec.ts existe" "PASS" "Cree"
else
  add_row "T13-F1" "Fichier {30+ specs}.e2e-spec.ts existe" "FAIL" "Manquant"
fi
# Test T13-F2: Existence fichier repo/apps/api/test/fixtures/mock-insurer-servers/{5 mock servers}
if [ -f "repo/apps/api/test/fixtures/mock-insurer-servers/{5 mock servers}" ]; then
  add_row "T13-F2" "Fichier {5 mock servers} existe" "PASS" "Cree"
else
  add_row "T13-F2" "Fichier {5 mock servers} existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T13-V1: 40+ tests passent (P0)
echo "  Verifying T13-V1 : 40+ tests passent..."
add_row "T13-V1" "40+ tests passent" "WARN" "(P0) Voir B-32 Tache 7.4.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V2: Mocks 5 assureurs fonctionnent (P0)
echo "  Verifying T13-V2 : Mocks 5 assureurs fonctionnent..."
add_row "T13-V2" "Mocks 5 assureurs fonctionnent" "WARN" "(P0) Voir B-32 Tache 7.4.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V3: Circuit breaker scenarios verifies (P0)
echo "  Verifying T13-V3 : Circuit breaker scenarios verifies..."
add_row "T13-V3" "Circuit breaker scenarios verifies" "WARN" "(P0) Voir B-32 Tache 7.4.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V4: CI green (P0)
echo "  Verifying T13-V4 : CI green..."
add_row "T13-V4" "CI green" "WARN" "(P0) Voir B-32 Tache 7.4.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V5: Reproducibility 5x (P0)
echo "  Verifying T13-V5 : Reproducibility 5x..."
add_row "T13-V5" "Reproducibility 5x" "WARN" "(P0) Voir B-32 Tache 7.4.13 pour test detaille - critere a auto-tester via script ad-hoc"

```

---


---


## VERIFICATIONS TRANSVERSALES SPRINT 32

### TR-BUILD : Build complet du sprint

```bash
echo ""
echo "================================================"
echo "VERIFICATIONS TRANSVERSALES SPRINT 32"
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

### TR-MIGRATIONS : Migrations DB Sprint 32

```bash
echo "=== TR-MIGRATIONS : Migrations DB ==="
MIGR_COUNT=$(pg_query "SELECT COUNT(*) FROM migrations WHERE name LIKE '%sprint32%' OR name LIKE '%Sprint32%'" || echo 0)
if [ "$MIGR_COUNT" -gt 0 ]; then
  add_row "TR-MIG" "Migrations Sprint 32 appliquees" "PASS" "$MIGR_COUNT migrations"
else
  add_row "TR-MIG" "Migrations Sprint 32 appliquees" "WARN" "Aucune migration detectee (verifier)"
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
echo "GENERATION DU RAPPORT FINAL SPRINT 32"
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

## Jalon GO/NO-GO Sprint 32

EOF

# Calcul statut final
if (( $(echo "$SCORE >= 95" | bc -l) )); then
  STATUT="GO"
  cat >> "$REPORT_FILE" << EOF
**STATUT** : GO -- Sprint 32 valide, passage Sprint 33 autorise

Le sprint a passe les criteres requis. Cowork peut demarrer Sprint 33.

EOF
  echo ""
  echo "================================================"
  echo "SPRINT 32 : GO ($SCORE%)"
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
  echo "SPRINT 32 : GO CONDITIONNEL ($SCORE%)"
  echo "================================================"
else
  STATUT="NO-GO"
  cat >> "$REPORT_FILE" << EOF
**STATUT** : NO-GO -- Score $SCORE% trop bas (cible 85% minimum)

Le sprint **doit etre repris** :
- Lister tous FAIL P0
- Escalation Saad/Abla decision (cut scope OR delai)
- Reprise sprint avant Sprint 33

EOF
  echo ""
  echo "================================================"
  echo "SPRINT 32 : NO-GO ($SCORE%)"
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
  echo "git commit -m \"chore(sprint-32): close sprint 32 -- $STATUT ($SCORE%)\"" >> "$REPORT_FILE"
  echo '```' >> "$REPORT_FILE"
fi

echo ""
echo "Rapport complet dans : $REPORT_FILE"
```

---

## INSTRUCTION FINALE A CLAUDE CODE / COWORK

Apres l'execution complete des verifications ci-dessus :

1. **Lis le contenu de `sprint32-verify-report.md`** integralement
2. **Identifie les FAIL critiques** (criteres P0) qui necessitent intervention manuelle
3. **Affiche un resume executif** :
   - Nombre total de criteres
   - Pourcentage PASS / PASS\* / FAIL / WARN
   - Liste des FAIL avec contexte technique
   - Recommandation : GO / GO CONDITIONNEL / NO-GO
4. **Si NO-GO** : ne pas demarrer le Sprint suivant, alerter Saad/Abla via Slack `#insurtech-dev`
5. **Si GO ou GO CONDITIONNEL** : produire le commit de cloture du sprint :

```bash
git add skalean-insurtech/sprint32-verify-report.md
git commit -m "chore(sprint-32): close sprint 32 with verification report

- Verification automatique executee
- Score global : <SCORE>%
- <PASS> criteres PASS, <PASS_REPAIRED> reparations auto, <FAIL> FAIL
- Statut : <GO|GO CONDITIONNEL|NO-GO>

Phase: 7 -- Hardening + Integrations + Pilote
Sprint: 32 (Phase 7 / Sprint 4)
Reference B-32, C-32, V-32
Report: sprint32-verify-report.md"
```

6. **Documentation continue** : si decisions techniques prises pendant verification, ajouter notes dans `repo/docs/runbooks/sprint-32-lessons-learned.md`

---

**Fin de la verification V-32 v2.2 detaillee -- Sprint 32 (7.4) Insure Connecteurs Assureurs (5 connecteurs).**

**Total criteres taches** : 48 | **Total transversaux** : ~10 | **Effort sprint** : 80h
