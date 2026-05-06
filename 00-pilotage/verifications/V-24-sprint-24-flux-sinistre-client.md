# VERIFICATION SPRINT 24 -- Phase 5 / Sprint 6 : Flux Sinistre Client M8 End-to-End
# Version : Auto-reparation active + Rapport final MD detaille
# 13 taches, 58 criteres extraits B-24
# AUCUNE EMOJI AUTORISEE

**Version** : v2.2 (verification detaillee)
**Phase** : 5 -- Vertical Repair (Skalean Garage ERP)
**Sprint** : 24 / 35 (cumul) -- Sprint 6 dans Phase 5
**Reference meta-prompt** : `B-24-sprint-24-flux-sinistre-client.md`
**Reference orchestrateur** : `C-24-sprint-24-flux-sinistre-client.md`
**Total criteres** : 58 criteres taches + ~10 transversaux

---

Tu es **Claude Code (ou Cowork)**. Tu dois executer une **verification COMPLETE et EXHAUSTIVE** du Sprint 24 apres execution toutes les 13 taches.

---

## REGLES D'EXECUTION

1. Tu **executes CHAQUE verification dans l'ordre** (taches puis transversales)
2. Quand une verification echoue, tu **TENTES UNE REPARATION AUTOMATIQUE** avant de noter FAIL
3. Apres chaque tentative de reparation, tu **re-executes la verification**
4. Tu consignes dans `sprint24-verify-report.md` **TOUS les resultats** au fil de l'execution
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
REPORT_FILE="sprint24-verify-report.md"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
RUN_ID=$(date '+%Y%m%d-%H%M%S')

cat > "$REPORT_FILE" << EOF
# Rapport de Verification - Sprint 24 : Flux Sinistre Client M8 End-to-End

**Date** : $TIMESTAMP
**Run ID** : $RUN_ID
**Phase** : 5 -- Vertical Repair (Skalean Garage ERP)
**Sprint** : 24 (Phase 5 / Sprint 6)
**Reference B-24** : 13 taches, 58 criteres extraits
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

## TACHE 1/5 -- 5.6.1 : Workflow M8 Documente

```bash
echo ""
echo "================================================"
echo "TACHE 5.6.1 : Workflow M8 Documente"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T01-F1: Existence fichier repo/docs/workflow-m8-flux-sinistre-client.md
if [ -f "repo/docs/workflow-m8-flux-sinistre-client.md" ]; then
  add_row "T01-F1" "Fichier workflow-m8-flux-sinistre-client.md existe" "PASS" "Cree"
else
  add_row "T01-F1" "Fichier workflow-m8-flux-sinistre-client.md existe" "FAIL" "Manquant"
fi
# Test T01-F2: Existence fichier repo/docs/workflow-m8-comparison-m0.md
if [ -f "repo/docs/workflow-m8-comparison-m0.md" ]; then
  add_row "T01-F2" "Fichier workflow-m8-comparison-m0.md existe" "PASS" "Cree"
else
  add_row "T01-F2" "Fichier workflow-m8-comparison-m0.md existe" "FAIL" "Manquant"
fi
# Test T01-F3: Existence fichier repo/docs/workflow-m8-sla-table.md
if [ -f "repo/docs/workflow-m8-sla-table.md" ]; then
  add_row "T01-F3" "Fichier workflow-m8-sla-table.md existe" "PASS" "Cree"
else
  add_row "T01-F3" "Fichier workflow-m8-sla-table.md existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T01-V1: Document complet 8 etapes (P0)
echo "  Verifying T01-V1 : Document complet 8 etapes..."
add_row "T01-V1" "Document complet 8 etapes" "WARN" "(P0) Voir B-24 Tache 5.6.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V2: 5+ diagrammes sequences (P0)
echo "  Verifying T01-V2 : 5+ diagrammes sequences..."
add_row "T01-V2" "5+ diagrammes sequences" "WARN" "(P0) Voir B-24 Tache 5.6.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V3: SLA per etape definis (P0)
echo "  Verifying T01-V3 : SLA per etape definis..."
add_row "T01-V3" "SLA per etape definis" "WARN" "(P0) Voir B-24 Tache 5.6.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V4: Edge cases couverts (P0)
echo "  Verifying T01-V4 : Edge cases couverts..."
add_row "T01-V4" "Edge cases couverts" "WARN" "(P0) Voir B-24 Tache 5.6.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V5: Comparaison M0 vs M8 (P0)
echo "  Verifying T01-V5 : Comparaison M0 vs M8..."
add_row "T01-V5" "Comparaison M0 vs M8" "WARN" "(P0) Voir B-24 Tache 5.6.1 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 2/6 -- 5.6.2 : Cross-Tenant Sinistre Routing

```bash
echo ""
echo "================================================"
echo "TACHE 5.6.2 : Cross-Tenant Sinistre Routing"
echo "Priorite : P0 | Effort : 7h"
echo "Criteres a verifier : 6"
echo "================================================"

# === Verification fichiers crees ===
# Test T02-F1: Existence fichier repo/packages/database/src/migrations/{date}-SinistreCrossTenantLinks.ts
if [ -f "repo/packages/database/src/migrations/{date}-SinistreCrossTenantLinks.ts" ]; then
  add_row "T02-F1" "Fichier {date}-SinistreCrossTenantLinks.ts existe" "PASS" "Cree"
else
  add_row "T02-F1" "Fichier {date}-SinistreCrossTenantLinks.ts existe" "FAIL" "Manquant"
fi
# Test T02-F2: Existence fichier repo/packages/repair/src/entities/sinistre-cross-tenant-link.entity.ts
if [ -f "repo/packages/repair/src/entities/sinistre-cross-tenant-link.entity.ts" ]; then
  add_row "T02-F2" "Fichier sinistre-cross-tenant-link.entity.ts existe" "PASS" "Cree"
else
  add_row "T02-F2" "Fichier sinistre-cross-tenant-link.entity.ts existe" "FAIL" "Manquant"
fi
# Test T02-F3: Existence fichier repo/packages/repair/src/services/cross-tenant-sinistre-routing.service.ts
if [ -f "repo/packages/repair/src/services/cross-tenant-sinistre-routing.service.ts" ]; then
  add_row "T02-F3" "Fichier cross-tenant-sinistre-routing.service.ts existe" "PASS" "Cree"
else
  add_row "T02-F3" "Fichier cross-tenant-sinistre-routing.service.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T02-V1: Dispatch source -> target tenant (P0)
echo "  Verifying T02-V1 : Dispatch source -> target tenant..."
add_row "T02-V1" "Dispatch source -> target tenant" "WARN" "(P0) Voir B-24 Tache 5.6.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V2: Validation police + capacity (P0)
echo "  Verifying T02-V2 : Validation police + capacity..."
add_row "T02-V2" "Validation police + capacity" "WARN" "(P0) Voir B-24 Tache 5.6.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V3: Tenant context switch correct (P0)
echo "  Verifying T02-V3 : Tenant context switch correct..."
add_row "T02-V3" "Tenant context switch correct" "WARN" "(P0) Voir B-24 Tache 5.6.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V4: Link row insert (P0)
echo "  Verifying T02-V4 : Link row insert..."
add_row "T02-V4" "Link row insert" "WARN" "(P0) Voir B-24 Tache 5.6.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V5: Audit + Kafka events (P0)
echo "  Verifying T02-V5 : Audit + Kafka events..."
add_row "T02-V5" "Audit + Kafka events" "WARN" "(P0) Voir B-24 Tache 5.6.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V6: Tests cross-tenant isolation 8+ scenarios (P0)
echo "  Verifying T02-V6 : Tests cross-tenant isolation 8+ scenarios..."
add_row "T02-V6" "Tests cross-tenant isolation 8+ scenarios" "WARN" "(P0) Voir B-24 Tache 5.6.2 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 3/5 -- 5.6.3 : Validation Auto Pre-Screening

```bash
echo ""
echo "================================================"
echo "TACHE 5.6.3 : Validation Auto Pre-Screening"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T03-F1: Existence fichier repo/packages/insure/src/services/sinistre-pre-screening.service.ts
if [ -f "repo/packages/insure/src/services/sinistre-pre-screening.service.ts" ]; then
  add_row "T03-F1" "Fichier sinistre-pre-screening.service.ts existe" "PASS" "Cree"
else
  add_row "T03-F1" "Fichier sinistre-pre-screening.service.ts existe" "FAIL" "Manquant"
fi
# Test T03-F2: Existence fichier repo/packages/insure/src/services/fraud-rules-basics.service.ts
if [ -f "repo/packages/insure/src/services/fraud-rules-basics.service.ts" ]; then
  add_row "T03-F2" "Fichier fraud-rules-basics.service.ts existe" "PASS" "Cree"
else
  add_row "T03-F2" "Fichier fraud-rules-basics.service.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T03-V1: 7 validations executees (P0)
echo "  Verifying T03-V1 : 7 validations executees..."
add_row "T03-V1" "7 validations executees" "WARN" "(P0) Voir B-24 Tache 5.6.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V2: Errors classified (P0)
echo "  Verifying T03-V2 : Errors classified..."
add_row "T03-V2" "Errors classified" "WARN" "(P0) Voir B-24 Tache 5.6.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V3: Auto-acknowledge si tout OK (P0)
echo "  Verifying T03-V3 : Auto-acknowledge si tout OK..."
add_row "T03-V3" "Auto-acknowledge si tout OK" "WARN" "(P0) Voir B-24 Tache 5.6.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V4: Pending review broker si fail (P0)
echo "  Verifying T03-V4 : Pending review broker si fail..."
add_row "T03-V4" "Pending review broker si fail" "WARN" "(P0) Voir B-24 Tache 5.6.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V5: Tests 12+ scenarios (P0)
echo "  Verifying T03-V5 : Tests 12+ scenarios..."
add_row "T03-V5" "Tests 12+ scenarios" "WARN" "(P0) Voir B-24 Tache 5.6.3 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 4/5 -- 5.6.4 : Dispatch Garage Workflow

```bash
echo ""
echo "================================================"
echo "TACHE 5.6.4 : Dispatch Garage Workflow"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T04-F1: Existence fichier repo/packages/repair/src/services/dispatch-workflow.service.ts
if [ -f "repo/packages/repair/src/services/dispatch-workflow.service.ts" ]; then
  add_row "T04-F1" "Fichier dispatch-workflow.service.ts existe" "PASS" "Cree"
else
  add_row "T04-F1" "Fichier dispatch-workflow.service.ts existe" "FAIL" "Manquant"
fi
# Test T04-F2: Existence fichier repo/packages/repair/src/services/technician-suggestion.service.ts
if [ -f "repo/packages/repair/src/services/technician-suggestion.service.ts" ]; then
  add_row "T04-F2" "Fichier technician-suggestion.service.ts existe" "PASS" "Cree"
else
  add_row "T04-F2" "Fichier technician-suggestion.service.ts existe" "FAIL" "Manquant"
fi
# Test T04-F3: Existence fichier repo/apps/api/src/modules/repair/controllers/dispatch.controller.ts
if [ -f "repo/apps/api/src/modules/repair/controllers/dispatch.controller.ts" ]; then
  add_row "T04-F3" "Fichier dispatch.controller.ts existe" "PASS" "Cree"
else
  add_row "T04-F3" "Fichier dispatch.controller.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T04-V1: Notification chef garage (P0)
echo "  Verifying T04-V1 : Notification chef garage..."
add_row "T04-V1" "Notification chef garage" "WARN" "(P0) Voir B-24 Tache 5.6.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V2: Auto-suggestion technicien (P0)
echo "  Verifying T04-V2 : Auto-suggestion technicien..."
add_row "T04-V2" "Auto-suggestion technicien" "WARN" "(P0) Voir B-24 Tache 5.6.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V3: Accept dispatch + appointment (P0)
echo "  Verifying T04-V3 : Accept dispatch + appointment..."
add_row "T04-V3" "Accept dispatch + appointment" "WARN" "(P0) Voir B-24 Tache 5.6.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V4: Reject re-dispatch (P0)
echo "  Verifying T04-V4 : Reject re-dispatch..."
add_row "T04-V4" "Reject re-dispatch" "WARN" "(P0) Voir B-24 Tache 5.6.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V5: Tests 8+ scenarios (P0)
echo "  Verifying T04-V5 : Tests 8+ scenarios..."
add_row "T04-V5" "Tests 8+ scenarios" "WARN" "(P0) Voir B-24 Tache 5.6.4 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 5/5 -- 5.6.5 : Sinistre Cycle Tracker (Vue 360)

```bash
echo ""
echo "================================================"
echo "TACHE 5.6.5 : Sinistre Cycle Tracker (Vue 360)"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T05-F1: Existence fichier repo/packages/database/src/migrations/{date}-SinistreCycleTrackers.ts
if [ -f "repo/packages/database/src/migrations/{date}-SinistreCycleTrackers.ts" ]; then
  add_row "T05-F1" "Fichier {date}-SinistreCycleTrackers.ts existe" "PASS" "Cree"
else
  add_row "T05-F1" "Fichier {date}-SinistreCycleTrackers.ts existe" "FAIL" "Manquant"
fi
# Test T05-F2: Existence fichier repo/packages/repair/src/entities/sinistre-cycle-tracker.entity.ts
if [ -f "repo/packages/repair/src/entities/sinistre-cycle-tracker.entity.ts" ]; then
  add_row "T05-F2" "Fichier sinistre-cycle-tracker.entity.ts existe" "PASS" "Cree"
else
  add_row "T05-F2" "Fichier sinistre-cycle-tracker.entity.ts existe" "FAIL" "Manquant"
fi
# Test T05-F3: Existence fichier repo/packages/repair/src/services/cycle-tracker.service.ts
if [ -f "repo/packages/repair/src/services/cycle-tracker.service.ts" ]; then
  add_row "T05-F3" "Fichier cycle-tracker.service.ts existe" "PASS" "Cree"
else
  add_row "T05-F3" "Fichier cycle-tracker.service.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T05-V1: Tracker created auto (P0)
echo "  Verifying T05-V1 : Tracker created auto..."
add_row "T05-V1" "Tracker created auto" "WARN" "(P0) Voir B-24 Tache 5.6.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V2: 8 phases tracked (P0)
echo "  Verifying T05-V2 : 8 phases tracked..."
add_row "T05-V2" "8 phases tracked" "WARN" "(P0) Voir B-24 Tache 5.6.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V3: SLA computed (P0)
echo "  Verifying T05-V3 : SLA computed..."
add_row "T05-V3" "SLA computed" "WARN" "(P0) Voir B-24 Tache 5.6.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V4: 3 perspectives view (P0)
echo "  Verifying T05-V4 : 3 perspectives view..."
add_row "T05-V4" "3 perspectives view" "WARN" "(P0) Voir B-24 Tache 5.6.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V5: Tests 8+ scenarios (P0)
echo "  Verifying T05-V5 : Tests 8+ scenarios..."
add_row "T05-V5" "Tests 8+ scenarios" "WARN" "(P0) Voir B-24 Tache 5.6.5 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 6/5 -- 5.6.6 : Notifications Coordonnees Multi-Parties

```bash
echo ""
echo "================================================"
echo "TACHE 5.6.6 : Notifications Coordonnees Multi-Parties"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T06-F1: Existence fichier repo/packages/comm/src/templates/{fr,ar-MA,ar}/m8/{30+ templates}.hbs
if [ -f "repo/packages/comm/src/templates/{fr,ar-MA,ar}/m8/{30+ templates}.hbs" ]; then
  add_row "T06-F1" "Fichier {30+ templates}.hbs existe" "PASS" "Cree"
else
  add_row "T06-F1" "Fichier {30+ templates}.hbs existe" "FAIL" "Manquant"
fi
# Test T06-F2: Existence fichier repo/packages/repair/src/consumers/cycle-events-to-notifications.consumer.ts
if [ -f "repo/packages/repair/src/consumers/cycle-events-to-notifications.consumer.ts" ]; then
  add_row "T06-F2" "Fichier cycle-events-to-notifications.consumer.ts existe" "PASS" "Cree"
else
  add_row "T06-F2" "Fichier cycle-events-to-notifications.consumer.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T06-V1: 30+ templates 3 locales (P0)
echo "  Verifying T06-V1 : 30+ templates 3 locales..."
add_row "T06-V1" "30+ templates 3 locales" "WARN" "(P0) Voir B-24 Tache 5.6.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V2: 4 parties notified per role (P0)
echo "  Verifying T06-V2 : 4 parties notified per role..."
add_row "T06-V2" "4 parties notified per role" "WARN" "(P0) Voir B-24 Tache 5.6.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V3: Channels per role correct (P0)
echo "  Verifying T06-V3 : Channels per role correct..."
add_row "T06-V3" "Channels per role correct" "WARN" "(P0) Voir B-24 Tache 5.6.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V4: Auto-trigger Kafka (P0)
echo "  Verifying T06-V4 : Auto-trigger Kafka..."
add_row "T06-V4" "Auto-trigger Kafka" "WARN" "(P0) Voir B-24 Tache 5.6.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V5: Tests 10+ scenarios (P0)
echo "  Verifying T06-V5 : Tests 10+ scenarios..."
add_row "T06-V5" "Tests 10+ scenarios" "WARN" "(P0) Voir B-24 Tache 5.6.6 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 7/5 -- 5.6.7 : Dashboard "Mon Sinistre" Assure

```bash
echo ""
echo "================================================"
echo "TACHE 5.6.7 : Dashboard "Mon Sinistre" Assure"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T07-F1: Existence fichier repo/apps/web-assure-mobile/app/[locale]/sinistres/[id]/page.tsx
if [ -f "repo/apps/web-assure-mobile/app/[locale]/sinistres/[id]/page.tsx" ]; then
  add_row "T07-F1" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T07-F1" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T07-F2: Existence fichier repo/packages/assure-shared/src/components/sinistre-cycle-timeline.tsx
if [ -f "repo/packages/assure-shared/src/components/sinistre-cycle-timeline.tsx" ]; then
  add_row "T07-F2" "Fichier sinistre-cycle-timeline.tsx existe" "PASS" "Cree"
else
  add_row "T07-F2" "Fichier sinistre-cycle-timeline.tsx existe" "FAIL" "Manquant"
fi
# Test T07-F3: Existence fichier repo/packages/assure-shared/src/components/sinistre-parties.tsx
if [ -f "repo/packages/assure-shared/src/components/sinistre-parties.tsx" ]; then
  add_row "T07-F3" "Fichier sinistre-parties.tsx existe" "PASS" "Cree"
else
  add_row "T07-F3" "Fichier sinistre-parties.tsx existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T07-V1: Cycle timeline 8 phases (P0)
echo "  Verifying T07-V1 : Cycle timeline 8 phases..."
add_row "T07-V1" "Cycle timeline 8 phases" "WARN" "(P0) Voir B-24 Tache 5.6.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V2: ETA visible (P0)
echo "  Verifying T07-V2 : ETA visible..."
add_row "T07-V2" "ETA visible" "WARN" "(P0) Voir B-24 Tache 5.6.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V3: Parties contact (P0)
echo "  Verifying T07-V3 : Parties contact..."
add_row "T07-V3" "Parties contact" "WARN" "(P0) Voir B-24 Tache 5.6.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V4: Real-time updates (P0)
echo "  Verifying T07-V4 : Real-time updates..."
add_row "T07-V4" "Real-time updates" "WARN" "(P0) Voir B-24 Tache 5.6.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V5: Tests 6+ scenarios (P0)
echo "  Verifying T07-V5 : Tests 6+ scenarios..."
add_row "T07-V5" "Tests 6+ scenarios" "WARN" "(P0) Voir B-24 Tache 5.6.7 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 8/3 -- 5.6.8 : Dashboard Broker Read-Only Sinistres

```bash
echo ""
echo "================================================"
echo "TACHE 5.6.8 : Dashboard Broker Read-Only Sinistres"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 3"
echo "================================================"

# === Verification fichiers crees ===
# Test T08-F1: Existence fichier repo/apps/web-broker/app/[locale]/(protected)/sinistres/[id]/page.tsx
if [ -f "repo/apps/web-broker/app/[locale]/(protected)/sinistres/[id]/page.tsx" ]; then
  add_row "T08-F1" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T08-F1" "Fichier page.tsx existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T08-V1: Vue 360 broker (P0)
echo "  Verifying T08-V1 : Vue 360 broker..."
add_row "T08-V1" "Vue 360 broker" "WARN" "(P0) Voir B-24 Tache 5.6.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V2: Read-only respect (P0)
echo "  Verifying T08-V2 : Read-only respect..."
add_row "T08-V2" "Read-only respect" "WARN" "(P0) Voir B-24 Tache 5.6.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V3: Tests 4+ scenarios (P0)
echo "  Verifying T08-V3 : Tests 4+ scenarios..."
add_row "T08-V3" "Tests 4+ scenarios" "WARN" "(P0) Voir B-24 Tache 5.6.8 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 9/3 -- 5.6.9 : Dashboard Chef Garage : Pipeline + KPIs

```bash
echo ""
echo "================================================"
echo "TACHE 5.6.9 : Dashboard Chef Garage : Pipeline + KPIs"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 3"
echo "================================================"

# === Verification fichiers crees ===
# Test T09-F1: Existence fichier repo/apps/web-garage/app/[locale]/(protected)/dispatch-pipeline/page.tsx
if [ -f "repo/apps/web-garage/app/[locale]/(protected)/dispatch-pipeline/page.tsx" ]; then
  add_row "T09-F1" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T09-F1" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T09-F2: Existence fichier repo/apps/web-garage/components/dispatch/{several components}.tsx
if [ -f "repo/apps/web-garage/components/dispatch/{several components}.tsx" ]; then
  add_row "T09-F2" "Fichier {several components}.tsx existe" "PASS" "Cree"
else
  add_row "T09-F2" "Fichier {several components}.tsx existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T09-V1: Pipeline visible (P0)
echo "  Verifying T09-V1 : Pipeline visible..."
add_row "T09-V1" "Pipeline visible" "WARN" "(P0) Voir B-24 Tache 5.6.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V2: KPIs accurate (P0)
echo "  Verifying T09-V2 : KPIs accurate..."
add_row "T09-V2" "KPIs accurate" "WARN" "(P0) Voir B-24 Tache 5.6.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V3: Tests 5+ scenarios (P0)
echo "  Verifying T09-V3 : Tests 5+ scenarios..."
add_row "T09-V3" "Tests 5+ scenarios" "WARN" "(P0) Voir B-24 Tache 5.6.9 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 10/3 -- 5.6.10 : Endpoints REST Cross-Tenant + Permissions

```bash
echo ""
echo "================================================"
echo "TACHE 5.6.10 : Endpoints REST Cross-Tenant + Permissions"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 3"
echo "================================================"

# === Verification fichiers crees ===
# Test T10-F1: Existence fichier repo/packages/auth/src/rbac/permissions.enum.ts
if [ -f "repo/packages/auth/src/rbac/permissions.enum.ts" ]; then
  add_row "T10-F1" "Fichier permissions.enum.ts existe" "PASS" "Cree"
else
  add_row "T10-F1" "Fichier permissions.enum.ts existe" "FAIL" "Manquant"
fi
# Test T10-F2: Existence fichier repo/packages/auth/src/rbac/cross-tenant-policies.ts
if [ -f "repo/packages/auth/src/rbac/cross-tenant-policies.ts" ]; then
  add_row "T10-F2" "Fichier cross-tenant-policies.ts existe" "PASS" "Cree"
else
  add_row "T10-F2" "Fichier cross-tenant-policies.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T10-V1: Permissions cross-tenant (P0)
echo "  Verifying T10-V1 : Permissions cross-tenant..."
add_row "T10-V1" "Permissions cross-tenant" "WARN" "(P0) Voir B-24 Tache 5.6.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V2: Privilege escalation rules (P0)
echo "  Verifying T10-V2 : Privilege escalation rules..."
add_row "T10-V2" "Privilege escalation rules" "WARN" "(P0) Voir B-24 Tache 5.6.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V3: Tests 8+ scenarios (P0)
echo "  Verifying T10-V3 : Tests 8+ scenarios..."
add_row "T10-V3" "Tests 8+ scenarios" "WARN" "(P0) Voir B-24 Tache 5.6.10 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 11/4 -- 5.6.11 : Audit Trail Cross-Tenant + Kafka Coordination

```bash
echo ""
echo "================================================"
echo "TACHE 5.6.11 : Audit Trail Cross-Tenant + Kafka Coordination"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 4"
echo "================================================"

# === Verification fichiers crees ===
# Test T11-F1: Existence fichier repo/packages/analytics/src/etl/postgres-to-clickhouse.etl.ts
if [ -f "repo/packages/analytics/src/etl/postgres-to-clickhouse.etl.ts" ]; then
  add_row "T11-F1" "Fichier postgres-to-clickhouse.etl.ts existe" "PASS" "Cree"
else
  add_row "T11-F1" "Fichier postgres-to-clickhouse.etl.ts existe" "FAIL" "Manquant"
fi
# Test T11-F2: Existence fichier repo/infrastructure/clickhouse/schemas/fct_sinistre_cycles.sql
if [ -f "repo/infrastructure/clickhouse/schemas/fct_sinistre_cycles.sql" ]; then
  add_row "T11-F2" "Fichier fct_sinistre_cycles.sql existe" "PASS" "Cree"
else
  add_row "T11-F2" "Fichier fct_sinistre_cycles.sql existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T11-V1: 8 Kafka events specifiques (P0)
echo "  Verifying T11-V1 : 8 Kafka events specifiques..."
add_row "T11-V1" "8 Kafka events specifiques" "WARN" "(P0) Voir B-24 Tache 5.6.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V2: Audit cross-tenant flag (P0)
echo "  Verifying T11-V2 : Audit cross-tenant flag..."
add_row "T11-V2" "Audit cross-tenant flag" "WARN" "(P0) Voir B-24 Tache 5.6.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V3: ETL ClickHouse (P0)
echo "  Verifying T11-V3 : ETL ClickHouse..."
add_row "T11-V3" "ETL ClickHouse" "WARN" "(P0) Voir B-24 Tache 5.6.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V4: Tests 6+ scenarios (P0)
echo "  Verifying T11-V4 : Tests 6+ scenarios..."
add_row "T11-V4" "Tests 6+ scenarios" "WARN" "(P0) Voir B-24 Tache 5.6.11 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 12/3 -- 5.6.12 : Documentation Flux M8

```bash
echo ""
echo "================================================"
echo "TACHE 5.6.12 : Documentation Flux M8"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 3"
echo "================================================"

# === Verification fichiers crees ===
# Test T12-F1: Existence fichier repo/docs/m8-implementation-guide.md
if [ -f "repo/docs/m8-implementation-guide.md" ]; then
  add_row "T12-F1" "Fichier m8-implementation-guide.md existe" "PASS" "Cree"
else
  add_row "T12-F1" "Fichier m8-implementation-guide.md existe" "FAIL" "Manquant"
fi
# Test T12-F2: Existence fichier repo/docs/m8-comparison-vs-traditional.md
if [ -f "repo/docs/m8-comparison-vs-traditional.md" ]; then
  add_row "T12-F2" "Fichier m8-comparison-vs-traditional.md existe" "PASS" "Cree"
else
  add_row "T12-F2" "Fichier m8-comparison-vs-traditional.md existe" "FAIL" "Manquant"
fi
# Test T12-F3: Existence fichier repo/docs/m8-acaps-compliance.md
if [ -f "repo/docs/m8-acaps-compliance.md" ]; then
  add_row "T12-F3" "Fichier m8-acaps-compliance.md existe" "PASS" "Cree"
else
  add_row "T12-F3" "Fichier m8-acaps-compliance.md existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T12-V1: 4 documents complets (P0)
echo "  Verifying T12-V1 : 4 documents complets..."
add_row "T12-V1" "4 documents complets" "WARN" "(P0) Voir B-24 Tache 5.6.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V2: Diagrams Mermaid (P0)
echo "  Verifying T12-V2 : Diagrams Mermaid..."
add_row "T12-V2" "Diagrams Mermaid" "WARN" "(P0) Voir B-24 Tache 5.6.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V3: Review ready (P0)
echo "  Verifying T12-V3 : Review ready..."
add_row "T12-V3" "Review ready" "WARN" "(P0) Voir B-24 Tache 5.6.12 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 13/6 -- 5.6.13 : Tests E2E End-to-End (40+) : 1 Sinistre 5 Apps

```bash
echo ""
echo "================================================"
echo "TACHE 5.6.13 : Tests E2E End-to-End (40+) : 1 Sinistre 5 Apps"
echo "Priorite : P0 | Effort : 12h"
echo "Criteres a verifier : 6"
echo "================================================"

# === Verification fichiers crees ===
# Test T13-F1: Existence fichier repo/apps/api/test/integration/m8-end-to-end-happy-path.e2e-spec.ts
if [ -f "repo/apps/api/test/integration/m8-end-to-end-happy-path.e2e-spec.ts" ]; then
  add_row "T13-F1" "Fichier m8-end-to-end-happy-path.e2e-spec.ts existe" "PASS" "Cree"
else
  add_row "T13-F1" "Fichier m8-end-to-end-happy-path.e2e-spec.ts existe" "FAIL" "Manquant"
fi
# Test T13-F2: Existence fichier repo/apps/api/test/integration/m8-edge-cases/{15+ specs}.e2e-spec.ts
if [ -f "repo/apps/api/test/integration/m8-edge-cases/{15+ specs}.e2e-spec.ts" ]; then
  add_row "T13-F2" "Fichier {15+ specs}.e2e-spec.ts existe" "PASS" "Cree"
else
  add_row "T13-F2" "Fichier {15+ specs}.e2e-spec.ts existe" "FAIL" "Manquant"
fi
# Test T13-F3: Existence fichier repo/apps/api/test/integration/m8-cross-tenant-isolation.e2e-spec.ts
if [ -f "repo/apps/api/test/integration/m8-cross-tenant-isolation.e2e-spec.ts" ]; then
  add_row "T13-F3" "Fichier m8-cross-tenant-isolation.e2e-spec.ts existe" "PASS" "Cree"
else
  add_row "T13-F3" "Fichier m8-cross-tenant-isolation.e2e-spec.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T13-V1: Happy path complete passe (P0)
echo "  Verifying T13-V1 : Happy path complete passe..."
add_row "T13-V1" "Happy path complete passe" "WARN" "(P0) Voir B-24 Tache 5.6.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V2: Edge cases couverts (P0)
echo "  Verifying T13-V2 : Edge cases couverts..."
add_row "T13-V2" "Edge cases couverts" "WARN" "(P0) Voir B-24 Tache 5.6.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V3: Cross-tenant isolation (P0)
echo "  Verifying T13-V3 : Cross-tenant isolation..."
add_row "T13-V3" "Cross-tenant isolation" "WARN" "(P0) Voir B-24 Tache 5.6.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V4: 40+ tests passent (P0)
echo "  Verifying T13-V4 : 40+ tests passent..."
add_row "T13-V4" "40+ tests passent" "WARN" "(P0) Voir B-24 Tache 5.6.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V5: CI green (P0)
echo "  Verifying T13-V5 : CI green..."
add_row "T13-V5" "CI green" "WARN" "(P0) Voir B-24 Tache 5.6.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V6: Reproducibility 5x (P0)
echo "  Verifying T13-V6 : Reproducibility 5x..."
add_row "T13-V6" "Reproducibility 5x" "WARN" "(P0) Voir B-24 Tache 5.6.13 pour test detaille - critere a auto-tester via script ad-hoc"

```

---


---


## VERIFICATIONS TRANSVERSALES SPRINT 24

### TR-BUILD : Build complet du sprint

```bash
echo ""
echo "================================================"
echo "VERIFICATIONS TRANSVERSALES SPRINT 24"
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

### TR-MIGRATIONS : Migrations DB Sprint 24

```bash
echo "=== TR-MIGRATIONS : Migrations DB ==="
MIGR_COUNT=$(pg_query "SELECT COUNT(*) FROM migrations WHERE name LIKE '%sprint24%' OR name LIKE '%Sprint24%'" || echo 0)
if [ "$MIGR_COUNT" -gt 0 ]; then
  add_row "TR-MIG" "Migrations Sprint 24 appliquees" "PASS" "$MIGR_COUNT migrations"
else
  add_row "TR-MIG" "Migrations Sprint 24 appliquees" "WARN" "Aucune migration detectee (verifier)"
fi
```

### TR-ACAPS : Conformite ACAPS audit trail

```bash
echo "=== TR-ACAPS : Audit trail ACAPS ==="
ACAPS_AUDIT_COUNT=$(pg_query "SELECT COUNT(*) FROM compliance_acaps_audits WHERE created_at > NOW() - INTERVAL '7 days'" || echo 0)
if [ "$ACAPS_AUDIT_COUNT" -gt 0 ]; then
  add_row "TR-ACAPS" "Audit trail ACAPS actif (7j)" "PASS" "$ACAPS_AUDIT_COUNT entrees"
else
  add_row "TR-ACAPS" "Audit trail ACAPS actif (7j)" "WARN" "Aucune entree (verifier subscriber)"
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
echo "GENERATION DU RAPPORT FINAL SPRINT 24"
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

## Jalon GO/NO-GO Sprint 24

EOF

# Calcul statut final
if (( $(echo "$SCORE >= 95" | bc -l) )); then
  STATUT="GO"
  cat >> "$REPORT_FILE" << EOF
**STATUT** : GO -- Sprint 24 valide, passage Sprint 25 autorise

Le sprint a passe les criteres requis. Cowork peut demarrer Sprint 25.

EOF
  echo ""
  echo "================================================"
  echo "SPRINT 24 : GO ($SCORE%)"
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
  echo "SPRINT 24 : GO CONDITIONNEL ($SCORE%)"
  echo "================================================"
else
  STATUT="NO-GO"
  cat >> "$REPORT_FILE" << EOF
**STATUT** : NO-GO -- Score $SCORE% trop bas (cible 85% minimum)

Le sprint **doit etre repris** :
- Lister tous FAIL P0
- Escalation Saad/Abla decision (cut scope OR delai)
- Reprise sprint avant Sprint 25

EOF
  echo ""
  echo "================================================"
  echo "SPRINT 24 : NO-GO ($SCORE%)"
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
  echo "git commit -m \"chore(sprint-24): close sprint 24 -- $STATUT ($SCORE%)\"" >> "$REPORT_FILE"
  echo '```' >> "$REPORT_FILE"
fi

echo ""
echo "Rapport complet dans : $REPORT_FILE"
```

---

## INSTRUCTION FINALE A CLAUDE CODE / COWORK

Apres l'execution complete des verifications ci-dessus :

1. **Lis le contenu de `sprint24-verify-report.md`** integralement
2. **Identifie les FAIL critiques** (criteres P0) qui necessitent intervention manuelle
3. **Affiche un resume executif** :
   - Nombre total de criteres
   - Pourcentage PASS / PASS\* / FAIL / WARN
   - Liste des FAIL avec contexte technique
   - Recommandation : GO / GO CONDITIONNEL / NO-GO
4. **Si NO-GO** : ne pas demarrer le Sprint suivant, alerter Saad/Abla via Slack `#insurtech-dev`
5. **Si GO ou GO CONDITIONNEL** : produire le commit de cloture du sprint :

```bash
git add skalean-insurtech/sprint24-verify-report.md
git commit -m "chore(sprint-24): close sprint 24 with verification report

- Verification automatique executee
- Score global : <SCORE>%
- <PASS> criteres PASS, <PASS_REPAIRED> reparations auto, <FAIL> FAIL
- Statut : <GO|GO CONDITIONNEL|NO-GO>

Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Sprint: 24 (Phase 5 / Sprint 6)
Reference B-24, C-24, V-24
Report: sprint24-verify-report.md"
```

6. **Documentation continue** : si decisions techniques prises pendant verification, ajouter notes dans `repo/docs/runbooks/sprint-24-lessons-learned.md`

---

**Fin de la verification V-24 v2.2 detaillee -- Sprint 24 (5.6) Flux Sinistre Client M8 End-to-End.**

**Total criteres taches** : 58 | **Total transversaux** : ~10 | **Effort sprint** : 75h
