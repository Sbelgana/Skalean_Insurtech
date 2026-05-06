# VERIFICATION SPRINT 8 -- Phase 3 / Sprint 1 : CRM + Booking
# Version : Auto-reparation active + Rapport final MD detaille
# 14 taches, 111 criteres extraits B-08
# AUCUNE EMOJI AUTORISEE

**Version** : v2.2 (verification detaillee)
**Phase** : 3 -- Modules Horizontaux
**Sprint** : 8 / 35 (cumul) -- Sprint 1 dans Phase 3
**Reference meta-prompt** : `B-08-sprint-08-crm-booking.md`
**Reference orchestrateur** : `C-08-sprint-08-crm-booking.md`
**Total criteres** : 111 criteres taches + ~10 transversaux

---

Tu es **Claude Code (ou Cowork)**. Tu dois executer une **verification COMPLETE et EXHAUSTIVE** du Sprint 8 apres execution toutes les 14 taches.

---

## REGLES D'EXECUTION

1. Tu **executes CHAQUE verification dans l'ordre** (taches puis transversales)
2. Quand une verification echoue, tu **TENTES UNE REPARATION AUTOMATIQUE** avant de noter FAIL
3. Apres chaque tentative de reparation, tu **re-executes la verification**
4. Tu consignes dans `sprint08-verify-report.md` **TOUS les resultats** au fil de l'execution
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
REPORT_FILE="sprint08-verify-report.md"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
RUN_ID=$(date '+%Y%m%d-%H%M%S')

cat > "$REPORT_FILE" << EOF
# Rapport de Verification - Sprint 8 : CRM + Booking

**Date** : $TIMESTAMP
**Run ID** : $RUN_ID
**Phase** : 3 -- Modules Horizontaux
**Sprint** : 8 (Phase 3 / Sprint 1)
**Reference B-08** : 14 taches, 111 criteres extraits
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

## VERIFICATIONS PAR TACHE (14 taches)

## TACHE 1/11 -- 3.1.1 : CRM Companies (Entity + Service + Endpoints + Search)

```bash
echo ""
echo "================================================"
echo "TACHE 3.1.1 : CRM Companies (Entity + Service + Endpoints + Search)"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 11"
echo "================================================"

# === Verification fichiers crees ===
# Test T01-F1: Existence fichier repo/packages/crm/src/entities/crm-company.entity.ts
if [ -f "repo/packages/crm/src/entities/crm-company.entity.ts" ]; then
  add_row "T01-F1" "Fichier crm-company.entity.ts existe" "PASS" "Cree"
else
  add_row "T01-F1" "Fichier crm-company.entity.ts existe" "FAIL" "Manquant"
fi
# Test T01-F2: Existence fichier repo/packages/crm/src/services/companies.service.ts
if [ -f "repo/packages/crm/src/services/companies.service.ts" ]; then
  add_row "T01-F2" "Fichier companies.service.ts existe" "PASS" "Cree"
else
  add_row "T01-F2" "Fichier companies.service.ts existe" "FAIL" "Manquant"
fi
# Test T01-F3: Existence fichier repo/packages/crm/src/services/companies.service.spec.ts
if [ -f "repo/packages/crm/src/services/companies.service.spec.ts" ]; then
  add_row "T01-F3" "Fichier companies.service.spec.ts existe" "PASS" "Cree"
else
  add_row "T01-F3" "Fichier companies.service.spec.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T01-V1: POST cree company + audit + Kafka event (P0)
echo "  Verifying T01-V1 : POST cree company + audit + Kafka event..."
add_row "T01-V1" "POST cree company + audit + Kafka event" "WARN" "(P0) Voir B-08 Tache 3.1.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V2: GET liste avec pagination + filtres (P0)
echo "  Verifying T01-V2 : GET liste avec pagination + filtres..."
add_row "T01-V2" "GET liste avec pagination + filtres" "WARN" "(P0) Voir B-08 Tache 3.1.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V3: GET /:id retourne details (ABAC : @owner peut read OK) (P0)
echo "  Verifying T01-V3 : GET /:id retourne details (ABAC : @owner peut read OK)..."
add_row "T01-V3" "GET /:id retourne details (ABAC : @owner peut read OK)" "WARN" "(P0) Voir B-08 Tache 3.1.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V4: PATCH update + diff in audit (P0)
echo "  Verifying T01-V4 : PATCH update + diff in audit..."
add_row "T01-V4" "PATCH update + diff in audit" "WARN" "(P0) Voir B-08 Tache 3.1.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V5: DELETE soft delete (deleted_at set) (P0)
echo "  Verifying T01-V5 : DELETE soft delete (deleted_at set)..."
add_row "T01-V5" "DELETE soft delete (deleted_at set)" "WARN" "(P0) Voir B-08 Tache 3.1.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V6: ICE invalide (14 ou 16 chiffres) rejete 400 (P0)
echo "  Verifying T01-V6 : ICE invalide (14 ou 16 chiffres) rejete 400..."
add_row "T01-V6" "ICE invalide (14 ou 16 chiffres) rejete 400" "WARN" "(P0) Voir B-08 Tache 3.1.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V7: ICE checksum invalide rejete 400 (P0)
echo "  Verifying T01-V7 : ICE checksum invalide rejete 400..."
add_row "T01-V7" "ICE checksum invalide rejete 400" "WARN" "(P0) Voir B-08 Tache 3.1.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V8: Search trigram performant (< 50ms sur 10k rows) (P0)
echo "  Verifying T01-V8 : Search trigram performant (< 50ms sur 10k rows)..."
add_row "T01-V8" "Search trigram performant (< 50ms sur 10k rows)" "WARN" "(P0) Voir B-08 Tache 3.1.1 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 2/10 -- 3.1.2 : CRM Contacts (Entity + Service + Endpoints + Search + Validators)

```bash
echo ""
echo "================================================"
echo "TACHE 3.1.2 : CRM Contacts (Entity + Service + Endpoints + Search + Valida"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 10"
echo "================================================"

# === Verification fichiers crees ===
# Test T02-F1: Existence fichier repo/packages/crm/src/entities/crm-contact.entity.ts
if [ -f "repo/packages/crm/src/entities/crm-contact.entity.ts" ]; then
  add_row "T02-F1" "Fichier crm-contact.entity.ts existe" "PASS" "Cree"
else
  add_row "T02-F1" "Fichier crm-contact.entity.ts existe" "FAIL" "Manquant"
fi
# Test T02-F2: Existence fichier repo/packages/crm/src/services/contacts.service.ts
if [ -f "repo/packages/crm/src/services/contacts.service.ts" ]; then
  add_row "T02-F2" "Fichier contacts.service.ts existe" "PASS" "Cree"
else
  add_row "T02-F2" "Fichier contacts.service.ts existe" "FAIL" "Manquant"
fi
# Test T02-F3: Existence fichier repo/packages/crm/src/schemas/contact.schema.ts
if [ -f "repo/packages/crm/src/schemas/contact.schema.ts" ]; then
  add_row "T02-F3" "Fichier contact.schema.ts existe" "PASS" "Cree"
else
  add_row "T02-F3" "Fichier contact.schema.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T02-V1: CRUD complet operationnel (P0)
echo "  Verifying T02-V1 : CRUD complet operationnel..."
add_row "T02-V1" "CRUD complet operationnel" "WARN" "(P0) Voir B-08 Tache 3.1.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V2: CIN invalide rejete (3+ scenarios) (P0)
echo "  Verifying T02-V2 : CIN invalide rejete (3+ scenarios)..."
add_row "T02-V2" "CIN invalide rejete (3+ scenarios)" "WARN" "(P0) Voir B-08 Tache 3.1.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V3: Phone non-E.164 rejete + suggestion normalisation (P0)
echo "  Verifying T02-V3 : Phone non-E.164 rejete + suggestion normalisation..."
add_row "T02-V3" "Phone non-E.164 rejete + suggestion normalisation" "WARN" "(P0) Voir B-08 Tache 3.1.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V4: UNIQUE (tenant_id, cin) actif (duplicate rejected) (P0)
echo "  Verifying T02-V4 : UNIQUE (tenant_id, cin) actif (duplicate rejected)..."
add_row "T02-V4" "UNIQUE (tenant_id, cin) actif (duplicate rejected)" "WARN" "(P0) Voir B-08 Tache 3.1.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V5: Search trigram < 50ms sur 10k contacts (P0)
echo "  Verifying T02-V5 : Search trigram < 50ms sur 10k contacts..."
add_row "T02-V5" "Search trigram < 50ms sur 10k contacts" "WARN" "(P0) Voir B-08 Tache 3.1.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V6: Computed full_name auto-update (P0)
echo "  Verifying T02-V6 : Computed full_name auto-update..."
add_row "T02-V6" "Computed full_name auto-update" "WARN" "(P0) Voir B-08 Tache 3.1.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V7: preferred_language enum stricte (P0)
echo "  Verifying T02-V7 : preferred_language enum stricte..."
add_row "T02-V7" "preferred_language enum stricte" "WARN" "(P0) Voir B-08 Tache 3.1.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V8: Multi-tenant + RBAC + ABAC actifs (P0)
echo "  Verifying T02-V8 : Multi-tenant + RBAC + ABAC actifs..."
add_row "T02-V8" "Multi-tenant + RBAC + ABAC actifs" "WARN" "(P0) Voir B-08 Tache 3.1.2 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 3/7 -- 3.1.3 : CRM Pipelines + Stages

```bash
echo ""
echo "================================================"
echo "TACHE 3.1.3 : CRM Pipelines + Stages"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 7"
echo "================================================"

# === Verification fichiers crees ===
# Test T03-F1: Existence fichier repo/packages/database/src/migrations/{date}-CrmPipelinesStages.ts
if [ -f "repo/packages/database/src/migrations/{date}-CrmPipelinesStages.ts" ]; then
  add_row "T03-F1" "Fichier {date}-CrmPipelinesStages.ts existe" "PASS" "Cree"
else
  add_row "T03-F1" "Fichier {date}-CrmPipelinesStages.ts existe" "FAIL" "Manquant"
fi
# Test T03-F2: Existence fichier repo/packages/crm/src/entities/crm-pipeline.entity.ts
if [ -f "repo/packages/crm/src/entities/crm-pipeline.entity.ts" ]; then
  add_row "T03-F2" "Fichier crm-pipeline.entity.ts existe" "PASS" "Cree"
else
  add_row "T03-F2" "Fichier crm-pipeline.entity.ts existe" "FAIL" "Manquant"
fi
# Test T03-F3: Existence fichier repo/packages/crm/src/entities/crm-pipeline-stage.entity.ts
if [ -f "repo/packages/crm/src/entities/crm-pipeline-stage.entity.ts" ]; then
  add_row "T03-F3" "Fichier crm-pipeline-stage.entity.ts existe" "PASS" "Cree"
else
  add_row "T03-F3" "Fichier crm-pipeline-stage.entity.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T03-V1: POST cree pipeline + stages atomiquement (P0)
echo "  Verifying T03-V1 : POST cree pipeline + stages atomiquement..."
add_row "T03-V1" "POST cree pipeline + stages atomiquement" "WARN" "(P0) Voir B-08 Tache 3.1.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V2: GET retourne pipelines avec stages tries par position (P0)
echo "  Verifying T03-V2 : GET retourne pipelines avec stages tries par position..."
add_row "T03-V2" "GET retourne pipelines avec stages tries par position" "WARN" "(P0) Voir B-08 Tache 3.1.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V3: PATCH reorder stages (P0)
echo "  Verifying T03-V3 : PATCH reorder stages..."
add_row "T03-V3" "PATCH reorder stages" "WARN" "(P0) Voir B-08 Tache 3.1.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V4: Validation : pipeline sans terminal won OR lost rejete (P0)
echo "  Verifying T03-V4 : Validation : pipeline sans terminal won OR lost rejete..."
add_row "T03-V4" "Validation : pipeline sans terminal won OR lost rejete" "WARN" "(P0) Voir B-08 Tache 3.1.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V5: DELETE refuse si deals existants (P0)
echo "  Verifying T03-V5 : DELETE refuse si deals existants..."
add_row "T03-V5" "DELETE refuse si deals existants" "WARN" "(P0) Voir B-08 Tache 3.1.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V6: 'is_default' UNIQUE par tenant (P0)
echo "  Verifying T03-V6 : 'is_default' UNIQUE par tenant..."
add_row "T03-V6" "'is_default' UNIQUE par tenant" "WARN" "(P0) Voir B-08 Tache 3.1.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V7: Tests 8+ scenarios (P0)
echo "  Verifying T03-V7 : Tests 8+ scenarios..."
add_row "T03-V7" "Tests 8+ scenarios" "WARN" "(P0) Voir B-08 Tache 3.1.3 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 4/9 -- 3.1.4 : CRM Deals (Opportunites + Workflow Stages)

```bash
echo ""
echo "================================================"
echo "TACHE 3.1.4 : CRM Deals (Opportunites + Workflow Stages)"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 9"
echo "================================================"

# === Verification fichiers crees ===
# Test T04-F1: Existence fichier repo/packages/crm/src/entities/crm-deal.entity.ts
if [ -f "repo/packages/crm/src/entities/crm-deal.entity.ts" ]; then
  add_row "T04-F1" "Fichier crm-deal.entity.ts existe" "PASS" "Cree"
else
  add_row "T04-F1" "Fichier crm-deal.entity.ts existe" "FAIL" "Manquant"
fi
# Test T04-F2: Existence fichier repo/packages/crm/src/services/deals.service.ts
if [ -f "repo/packages/crm/src/services/deals.service.ts" ]; then
  add_row "T04-F2" "Fichier deals.service.ts existe" "PASS" "Cree"
else
  add_row "T04-F2" "Fichier deals.service.ts existe" "FAIL" "Manquant"
fi
# Test T04-F3: Existence fichier repo/packages/crm/src/schemas/deal.schema.ts
if [ -f "repo/packages/crm/src/schemas/deal.schema.ts" ]; then
  add_row "T04-F3" "Fichier deal.schema.ts existe" "PASS" "Cree"
else
  add_row "T04-F3" "Fichier deal.schema.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T04-V1: CRUD complet deals (P0)
echo "  Verifying T04-V1 : CRUD complet deals..."
add_row "T04-V1" "CRUD complet deals" "WARN" "(P0) Voir B-08 Tache 3.1.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V2: moveToStage transition + audit log + Kafka event (P0)
echo "  Verifying T04-V2 : moveToStage transition + audit log + Kafka event..."
add_row "T04-V2" "moveToStage transition + audit log + Kafka event" "WARN" "(P0) Voir B-08 Tache 3.1.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V3: won/lost shortcut + auto-set won_at/lost_at (P0)
echo "  Verifying T04-V3 : won/lost shortcut + auto-set won_at/lost_at..."
add_row "T04-V3" "won/lost shortcut + auto-set won_at/lost_at" "WARN" "(P0) Voir B-08 Tache 3.1.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V4: Stage transition vers stage hors pipeline rejete (P0)
echo "  Verifying T04-V4 : Stage transition vers stage hors pipeline rejete..."
add_row "T04-V4" "Stage transition vers stage hors pipeline rejete" "WARN" "(P0) Voir B-08 Tache 3.1.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V5: Forecast agrege correct (P0)
echo "  Verifying T04-V5 : Forecast agrege correct..."
add_row "T04-V5" "Forecast agrege correct" "WARN" "(P0) Voir B-08 Tache 3.1.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V6: ABAC : non-owner read_own deny (P0)
echo "  Verifying T04-V6 : ABAC : non-owner read_own deny..."
add_row "T04-V6" "ABAC : non-owner read_own deny" "WARN" "(P0) Voir B-08 Tache 3.1.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V7: Validation amount >= 0 (P0)
echo "  Verifying T04-V7 : Validation amount >= 0..."
add_row "T04-V7" "Validation amount >= 0" "WARN" "(P0) Voir B-08 Tache 3.1.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V8: Filtres + pagination (P0)
echo "  Verifying T04-V8 : Filtres + pagination..."
add_row "T04-V8" "Filtres + pagination" "WARN" "(P0) Voir B-08 Tache 3.1.4 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 5/8 -- 3.1.5 : CRM Interactions (Timeline)

```bash
echo ""
echo "================================================"
echo "TACHE 3.1.5 : CRM Interactions (Timeline)"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 8"
echo "================================================"

# === Verification fichiers crees ===
# Test T05-F1: Existence fichier repo/packages/crm/src/entities/crm-interaction.entity.ts
if [ -f "repo/packages/crm/src/entities/crm-interaction.entity.ts" ]; then
  add_row "T05-F1" "Fichier crm-interaction.entity.ts existe" "PASS" "Cree"
else
  add_row "T05-F1" "Fichier crm-interaction.entity.ts existe" "FAIL" "Manquant"
fi
# Test T05-F2: Existence fichier repo/packages/crm/src/services/interactions.service.ts
if [ -f "repo/packages/crm/src/services/interactions.service.ts" ]; then
  add_row "T05-F2" "Fichier interactions.service.ts existe" "PASS" "Cree"
else
  add_row "T05-F2" "Fichier interactions.service.ts existe" "FAIL" "Manquant"
fi
# Test T05-F3: Existence fichier repo/packages/crm/src/services/interactions-auto-logger.consumer.ts
if [ -f "repo/packages/crm/src/services/interactions-auto-logger.consumer.ts" ]; then
  add_row "T05-F3" "Fichier interactions-auto-logger.consumer.ts existe" "PASS" "Cree"
else
  add_row "T05-F3" "Fichier interactions-auto-logger.consumer.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T05-V1: POST manual log fonctionne (P0)
echo "  Verifying T05-V1 : POST manual log fonctionne..."
add_row "T05-V1" "POST manual log fonctionne" "WARN" "(P0) Voir B-08 Tache 3.1.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V2: GET timeline contact retourne interactions DESC (P0)
echo "  Verifying T05-V2 : GET timeline contact retourne interactions DESC..."
add_row "T05-V2" "GET timeline contact retourne interactions DESC" "WARN" "(P0) Voir B-08 Tache 3.1.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V3: Auto-log via event Kafka comm.message_sent (P0)
echo "  Verifying T05-V3 : Auto-log via event Kafka comm.message_sent..."
add_row "T05-V3" "Auto-log via event Kafka comm.message_sent" "WARN" "(P0) Voir B-08 Tache 3.1.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V4: Pas de PATCH/DELETE (append-only enforced) (P0)
echo "  Verifying T05-V4 : Pas de PATCH/DELETE (append-only enforced)..."
add_row "T05-V4" "Pas de PATCH/DELETE (append-only enforced)" "WARN" "(P0) Voir B-08 Tache 3.1.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V5: Pagination cursor-based (P0)
echo "  Verifying T05-V5 : Pagination cursor-based..."
add_row "T05-V5" "Pagination cursor-based" "WARN" "(P0) Voir B-08 Tache 3.1.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V6: occurred_at != created_at supporte (log past) (P0)
echo "  Verifying T05-V6 : occurred_at != created_at supporte (log past)..."
add_row "T05-V6" "occurred_at != created_at supporte (log past)" "WARN" "(P0) Voir B-08 Tache 3.1.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V7: Multi-tenant + RBAC (P0)
echo "  Verifying T05-V7 : Multi-tenant + RBAC..."
add_row "T05-V7" "Multi-tenant + RBAC" "WARN" "(P0) Voir B-08 Tache 3.1.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V8: Tests 8+ scenarios (P1)
echo "  Verifying T05-V8 : Tests 8+ scenarios..."
add_row "T05-V8" "Tests 8+ scenarios" "WARN" "(P1) Voir B-08 Tache 3.1.5 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 6/7 -- 3.1.6 : Full-Text Search pg_trgm Cross-CRM

```bash
echo ""
echo "================================================"
echo "TACHE 3.1.6 : Full-Text Search pg_trgm Cross-CRM"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 7"
echo "================================================"

# === Verification fichiers crees ===
# Test T06-F1: Existence fichier repo/packages/crm/src/services/crm-search.service.ts
if [ -f "repo/packages/crm/src/services/crm-search.service.ts" ]; then
  add_row "T06-F1" "Fichier crm-search.service.ts existe" "PASS" "Cree"
else
  add_row "T06-F1" "Fichier crm-search.service.ts existe" "FAIL" "Manquant"
fi
# Test T06-F2: Existence fichier repo/packages/crm/src/schemas/search.schema.ts
if [ -f "repo/packages/crm/src/schemas/search.schema.ts" ]; then
  add_row "T06-F2" "Fichier search.schema.ts existe" "PASS" "Cree"
else
  add_row "T06-F2" "Fichier search.schema.ts existe" "FAIL" "Manquant"
fi
# Test T06-F3: Existence fichier repo/apps/api/src/modules/crm/controllers/search.controller.ts
if [ -f "repo/apps/api/src/modules/crm/controllers/search.controller.ts" ]; then
  add_row "T06-F3" "Fichier search.controller.ts existe" "PASS" "Cree"
else
  add_row "T06-F3" "Fichier search.controller.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T06-V1: GET /search?q=Mohamed retourne resultats trigram (P0)
echo "  Verifying T06-V1 : GET /search?q=Mohamed retourne resultats trigram..."
add_row "T06-V1" "GET /search?q=Mohamed retourne resultats trigram" "WARN" "(P0) Voir B-08 Tache 3.1.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V2: Resultats triees par score DESC (P0)
echo "  Verifying T06-V2 : Resultats triees par score DESC..."
add_row "T06-V2" "Resultats triees par score DESC" "WARN" "(P0) Voir B-08 Tache 3.1.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V3: Filtre 'types=contacts,companies' exclut deals (P0)
echo "  Verifying T06-V3 : Filtre 'types=contacts,companies' exclut deals..."
add_row "T06-V3" "Filtre 'types=contacts,companies' exclut deals" "WARN" "(P0) Voir B-08 Tache 3.1.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V4: Performance < 100ms sur dataset realiste (test perf) (P0)
echo "  Verifying T06-V4 : Performance < 100ms sur dataset realiste (test perf)..."
add_row "T06-V4" "Performance < 100ms sur dataset realiste (test perf)" "WARN" "(P0) Voir B-08 Tache 3.1.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V5: Multi-tenant : tenant A pas de leak tenant B (P0)
echo "  Verifying T06-V5 : Multi-tenant : tenant A pas de leak tenant B..."
add_row "T06-V5" "Multi-tenant : tenant A pas de leak tenant B" "WARN" "(P0) Voir B-08 Tache 3.1.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V6: Threshold similarity configurable (P0)
echo "  Verifying T06-V6 : Threshold similarity configurable..."
add_row "T06-V6" "Threshold similarity configurable" "WARN" "(P0) Voir B-08 Tache 3.1.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V7: Tests 6+ scenarios (P1)
echo "  Verifying T06-V7 : Tests 6+ scenarios..."
add_row "T06-V7" "Tests 6+ scenarios" "WARN" "(P1) Voir B-08 Tache 3.1.6 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 7/7 -- 3.1.7 : Custom Fields Dynamic (JSONB + Zod Runtime)

```bash
echo ""
echo "================================================"
echo "TACHE 3.1.7 : Custom Fields Dynamic (JSONB + Zod Runtime)"
echo "Priorite : P1 | Effort : 5h"
echo "Criteres a verifier : 7"
echo "================================================"

# === Verification fichiers crees ===
# Test T07-F1: Existence fichier repo/packages/database/src/migrations/{date}-CustomFieldsDefinitions.ts
if [ -f "repo/packages/database/src/migrations/{date}-CustomFieldsDefinitions.ts" ]; then
  add_row "T07-F1" "Fichier {date}-CustomFieldsDefinitions.ts existe" "PASS" "Cree"
else
  add_row "T07-F1" "Fichier {date}-CustomFieldsDefinitions.ts existe" "FAIL" "Manquant"
fi
# Test T07-F2: Existence fichier repo/packages/crm/src/services/custom-fields.service.ts
if [ -f "repo/packages/crm/src/services/custom-fields.service.ts" ]; then
  add_row "T07-F2" "Fichier custom-fields.service.ts existe" "PASS" "Cree"
else
  add_row "T07-F2" "Fichier custom-fields.service.ts existe" "FAIL" "Manquant"
fi
# Test T07-F3: Existence fichier repo/packages/crm/src/services/custom-fields.service.spec.ts
if [ -f "repo/packages/crm/src/services/custom-fields.service.spec.ts" ]; then
  add_row "T07-F3" "Fichier custom-fields.service.spec.ts existe" "PASS" "Cree"
else
  add_row "T07-F3" "Fichier custom-fields.service.spec.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T07-V1: Define custom field reussit (P1)
echo "  Verifying T07-V1 : Define custom field reussit..."
add_row "T07-V1" "Define custom field reussit" "WARN" "(P1) Voir B-08 Tache 3.1.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V2: Validate data contre schema dynamique OK (P1)
echo "  Verifying T07-V2 : Validate data contre schema dynamique OK..."
add_row "T07-V2" "Validate data contre schema dynamique OK" "WARN" "(P1) Voir B-08 Tache 3.1.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V3: Validate invalid data rejete avec details (P1)
echo "  Verifying T07-V3 : Validate invalid data rejete avec details..."
add_row "T07-V3" "Validate invalid data rejete avec details" "WARN" "(P1) Voir B-08 Tache 3.1.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V4: CRUD CRM integre validation custom fields (P1)
echo "  Verifying T07-V4 : CRUD CRM integre validation custom fields..."
add_row "T07-V4" "CRUD CRM integre validation custom fields" "WARN" "(P1) Voir B-08 Tache 3.1.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V5: Required field manquant rejete (P1)
echo "  Verifying T07-V5 : Required field manquant rejete..."
add_row "T07-V5" "Required field manquant rejete" "WARN" "(P1) Voir B-08 Tache 3.1.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V6: Field types 7 supportes (P1)
echo "  Verifying T07-V6 : Field types 7 supportes..."
add_row "T07-V6" "Field types 7 supportes" "WARN" "(P1) Voir B-08 Tache 3.1.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V7: Tests 10+ scenarios (P1)
echo "  Verifying T07-V7 : Tests 10+ scenarios..."
add_row "T07-V7" "Tests 10+ scenarios" "WARN" "(P1) Voir B-08 Tache 3.1.7 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 8/5 -- 3.1.8 : Booking Rooms

```bash
echo ""
echo "================================================"
echo "TACHE 3.1.8 : Booking Rooms"
echo "Priorite : P0 | Effort : 3h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T08-F1: Existence fichier repo/packages/booking/src/entities/booking-room.entity.ts
if [ -f "repo/packages/booking/src/entities/booking-room.entity.ts" ]; then
  add_row "T08-F1" "Fichier booking-room.entity.ts existe" "PASS" "Cree"
else
  add_row "T08-F1" "Fichier booking-room.entity.ts existe" "FAIL" "Manquant"
fi
# Test T08-F2: Existence fichier repo/packages/booking/src/services/rooms.service.ts
if [ -f "repo/packages/booking/src/services/rooms.service.ts" ]; then
  add_row "T08-F2" "Fichier rooms.service.ts existe" "PASS" "Cree"
else
  add_row "T08-F2" "Fichier rooms.service.ts existe" "FAIL" "Manquant"
fi
# Test T08-F3: Existence fichier repo/packages/booking/src/schemas/room.schema.ts
if [ -f "repo/packages/booking/src/schemas/room.schema.ts" ]; then
  add_row "T08-F3" "Fichier room.schema.ts existe" "PASS" "Cree"
else
  add_row "T08-F3" "Fichier room.schema.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T08-V1: CRUD complete (P0)
echo "  Verifying T08-V1 : CRUD complete..."
add_row "T08-V1" "CRUD complete" "WARN" "(P0) Voir B-08 Tache 3.1.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V2: Active flag fonctionne (rooms inactives pas listees par defaut) (P0)
echo "  Verifying T08-V2 : Active flag fonctionne (rooms inactives pas listees par defaut)..."
add_row "T08-V2" "Active flag fonctionne (rooms inactives pas listees par defaut)" "WARN" "(P0) Voir B-08 Tache 3.1.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V3: Default rooms appliquees au onboarding (P0)
echo "  Verifying T08-V3 : Default rooms appliquees au onboarding..."
add_row "T08-V3" "Default rooms appliquees au onboarding" "WARN" "(P0) Voir B-08 Tache 3.1.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V4: Multi-tenant + RBAC (P0)
echo "  Verifying T08-V4 : Multi-tenant + RBAC..."
add_row "T08-V4" "Multi-tenant + RBAC" "WARN" "(P0) Voir B-08 Tache 3.1.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V5: Tests 5+ scenarios (P1)
echo "  Verifying T08-V5 : Tests 5+ scenarios..."
add_row "T08-V5" "Tests 5+ scenarios" "WARN" "(P1) Voir B-08 Tache 3.1.8 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 9/10 -- 3.1.9 : Booking Appointments + EXCLUDE Constraint

```bash
echo ""
echo "================================================"
echo "TACHE 3.1.9 : Booking Appointments + EXCLUDE Constraint"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 10"
echo "================================================"

# === Verification fichiers crees ===
# Test T09-F1: Existence fichier repo/packages/booking/src/entities/booking-appointment.entity.ts
if [ -f "repo/packages/booking/src/entities/booking-appointment.entity.ts" ]; then
  add_row "T09-F1" "Fichier booking-appointment.entity.ts existe" "PASS" "Cree"
else
  add_row "T09-F1" "Fichier booking-appointment.entity.ts existe" "FAIL" "Manquant"
fi
# Test T09-F2: Existence fichier repo/packages/booking/src/services/appointments.service.ts
if [ -f "repo/packages/booking/src/services/appointments.service.ts" ]; then
  add_row "T09-F2" "Fichier appointments.service.ts existe" "PASS" "Cree"
else
  add_row "T09-F2" "Fichier appointments.service.ts existe" "FAIL" "Manquant"
fi
# Test T09-F3: Existence fichier repo/packages/booking/src/schemas/appointment.schema.ts
if [ -f "repo/packages/booking/src/schemas/appointment.schema.ts" ]; then
  add_row "T09-F3" "Fichier appointment.schema.ts existe" "PASS" "Cree"
else
  add_row "T09-F3" "Fichier appointment.schema.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T09-V1: POST cree appointment (P0)
echo "  Verifying T09-V1 : POST cree appointment..."
add_row "T09-V1" "POST cree appointment" "WARN" "(P0) Voir B-08 Tache 3.1.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V2: POST overlap meme room rejete 409 avec details existing (P0)
echo "  Verifying T09-V2 : POST overlap meme room rejete 409 avec details existing..."
add_row "T09-V2" "POST overlap meme room rejete 409 avec details existing" "WARN" "(P0) Voir B-08 Tache 3.1.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V3: POST 2 RDV meme room times non-overlapping OK (P0)
echo "  Verifying T09-V3 : POST 2 RDV meme room times non-overlapping OK..."
add_row "T09-V3" "POST 2 RDV meme room times non-overlapping OK" "WARN" "(P0) Voir B-08 Tache 3.1.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V4: POST RDV chevauchant si premier 'cancelled' OK (WHERE clause EXCLUDE) (P0)
echo "  Verifying T09-V4 : POST RDV chevauchant si premier 'cancelled' OK (WHERE clause EXCLUDE)..."
add_row "T09-V4" "POST RDV chevauchant si premier 'cancelled' OK (WHERE clause EXCLUDE)" "WARN" "(P0) Voir B-08 Tache 3.1.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V5: Cancel + reason audit log (P0)
echo "  Verifying T09-V5 : Cancel + reason audit log..."
add_row "T09-V5" "Cancel + reason audit log" "WARN" "(P0) Voir B-08 Tache 3.1.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V6: Complete transition statu (P0)
echo "  Verifying T09-V6 : Complete transition statu..."
add_row "T09-V6" "Complete transition statu" "WARN" "(P0) Voir B-08 Tache 3.1.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V7: Filters : date_range, status, room (P0)
echo "  Verifying T09-V7 : Filters : date_range, status, room..."
add_row "T09-V7" "Filters : date_range, status, room" "WARN" "(P0) Voir B-08 Tache 3.1.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V8: ABAC : assigned_user_id check (P0)
echo "  Verifying T09-V8 : ABAC : assigned_user_id check..."
add_row "T09-V8" "ABAC : assigned_user_id check" "WARN" "(P0) Voir B-08 Tache 3.1.9 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 10/7 -- 3.1.10 : Booking CalendarSync (OAuth2 Google + Outlook)

```bash
echo ""
echo "================================================"
echo "TACHE 3.1.10 : Booking CalendarSync (OAuth2 Google + Outlook)"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 7"
echo "================================================"

# === Verification fichiers crees ===
# Test T10-F1: Existence fichier repo/packages/booking/src/services/calendar-sync.service.ts
if [ -f "repo/packages/booking/src/services/calendar-sync.service.ts" ]; then
  add_row "T10-F1" "Fichier calendar-sync.service.ts existe" "PASS" "Cree"
else
  add_row "T10-F1" "Fichier calendar-sync.service.ts existe" "FAIL" "Manquant"
fi
# Test T10-F2: Existence fichier repo/packages/booking/src/services/calendar-sync.service.spec.ts
if [ -f "repo/packages/booking/src/services/calendar-sync.service.spec.ts" ]; then
  add_row "T10-F2" "Fichier calendar-sync.service.spec.ts existe" "PASS" "Cree"
else
  add_row "T10-F2" "Fichier calendar-sync.service.spec.ts existe" "FAIL" "Manquant"
fi
# Test T10-F3: Existence fichier repo/packages/booking/src/providers/google-calendar.provider.ts
if [ -f "repo/packages/booking/src/providers/google-calendar.provider.ts" ]; then
  add_row "T10-F3" "Fichier google-calendar.provider.ts existe" "PASS" "Cree"
else
  add_row "T10-F3" "Fichier google-calendar.provider.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T10-V1: OAuth initiate retourne authUrl + state (P0)
echo "  Verifying T10-V1 : OAuth initiate retourne authUrl + state..."
add_row "T10-V1" "OAuth initiate retourne authUrl + state" "WARN" "(P0) Voir B-08 Tache 3.1.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V2: Callback exchange code + store tokens chiffres (P0)
echo "  Verifying T10-V2 : Callback exchange code + store tokens chiffres..."
add_row "T10-V2" "Callback exchange code + store tokens chiffres" "WARN" "(P0) Voir B-08 Tache 3.1.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V3: State mismatch rejete (CSRF protection) (P0)
echo "  Verifying T10-V3 : State mismatch rejete (CSRF protection)..."
add_row "T10-V3" "State mismatch rejete (CSRF protection)" "WARN" "(P0) Voir B-08 Tache 3.1.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V4: refreshAccessToken renouvelle expire (P0)
echo "  Verifying T10-V4 : refreshAccessToken renouvelle expire..."
add_row "T10-V4" "refreshAccessToken renouvelle expire" "WARN" "(P0) Voir B-08 Tache 3.1.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V5: Disconnect : delete + revoke chez provider (P0)
echo "  Verifying T10-V5 : Disconnect : delete + revoke chez provider..."
add_row "T10-V5" "Disconnect : delete + revoke chez provider" "WARN" "(P0) Voir B-08 Tache 3.1.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V6: Tokens stockes encrypted (jamais plain) (P0)
echo "  Verifying T10-V6 : Tokens stockes encrypted (jamais plain)..."
add_row "T10-V6" "Tokens stockes encrypted (jamais plain)" "WARN" "(P0) Voir B-08 Tache 3.1.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V7: Tests E2E happy path 8+ scenarios (P0)
echo "  Verifying T10-V7 : Tests E2E happy path 8+ scenarios..."
add_row "T10-V7" "Tests E2E happy path 8+ scenarios" "WARN" "(P0) Voir B-08 Tache 3.1.10 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 11/7 -- 3.1.11 : Availability Service (Slots Libres + Business Hours)

```bash
echo ""
echo "================================================"
echo "TACHE 3.1.11 : Availability Service (Slots Libres + Business Hours)"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 7"
echo "================================================"

# === Verification fichiers crees ===
# Test T11-F1: Existence fichier repo/packages/booking/src/services/availability.service.ts
if [ -f "repo/packages/booking/src/services/availability.service.ts" ]; then
  add_row "T11-F1" "Fichier availability.service.ts existe" "PASS" "Cree"
else
  add_row "T11-F1" "Fichier availability.service.ts existe" "FAIL" "Manquant"
fi
# Test T11-F2: Existence fichier repo/packages/booking/src/services/availability.service.spec.ts
if [ -f "repo/packages/booking/src/services/availability.service.spec.ts" ]; then
  add_row "T11-F2" "Fichier availability.service.spec.ts existe" "PASS" "Cree"
else
  add_row "T11-F2" "Fichier availability.service.spec.ts existe" "FAIL" "Manquant"
fi
# Test T11-F3: Existence fichier repo/packages/booking/src/services/holidays.service.ts
if [ -f "repo/packages/booking/src/services/holidays.service.ts" ]; then
  add_row "T11-F3" "Fichier holidays.service.ts existe" "PASS" "Cree"
else
  add_row "T11-F3" "Fichier holidays.service.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T11-V1: Slots libres correct (exclude existing) (P0)
echo "  Verifying T11-V1 : Slots libres correct (exclude existing)..."
add_row "T11-V1" "Slots libres correct (exclude existing)" "WARN" "(P0) Voir B-08 Tache 3.1.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V2: Business hours respectees (P0)
echo "  Verifying T11-V2 : Business hours respectees..."
add_row "T11-V2" "Business hours respectees" "WARN" "(P0) Voir B-08 Tache 3.1.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V3: Holidays MA exclus (P0)
echo "  Verifying T11-V3 : Holidays MA exclus..."
add_row "T11-V3" "Holidays MA exclus" "WARN" "(P0) Voir B-08 Tache 3.1.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V4: Buffer 15min entre slots (P0)
echo "  Verifying T11-V4 : Buffer 15min entre slots..."
add_row "T11-V4" "Buffer 15min entre slots" "WARN" "(P0) Voir B-08 Tache 3.1.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V5: Performance < 200ms 1 mois range (P0)
echo "  Verifying T11-V5 : Performance < 200ms 1 mois range..."
add_row "T11-V5" "Performance < 200ms 1 mois range" "WARN" "(P0) Voir B-08 Tache 3.1.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V6: Multi-tenant settings respect (P0)
echo "  Verifying T11-V6 : Multi-tenant settings respect..."
add_row "T11-V6" "Multi-tenant settings respect" "WARN" "(P0) Voir B-08 Tache 3.1.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V7: Tests 10+ scenarios (P0)
echo "  Verifying T11-V7 : Tests 10+ scenarios..."
add_row "T11-V7" "Tests 10+ scenarios" "WARN" "(P0) Voir B-08 Tache 3.1.11 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 12/8 -- 3.1.12 : Calendar Sync Bi-Directionnel Google + Outlook

```bash
echo ""
echo "================================================"
echo "TACHE 3.1.12 : Calendar Sync Bi-Directionnel Google + Outlook"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 8"
echo "================================================"

# === Verification fichiers crees ===
# Test T12-F1: Existence fichier repo/packages/booking/src/services/calendar-sync-bidirectional.service.ts
if [ -f "repo/packages/booking/src/services/calendar-sync-bidirectional.service.ts" ]; then
  add_row "T12-F1" "Fichier calendar-sync-bidirectional.service.ts existe" "PASS" "Cree"
else
  add_row "T12-F1" "Fichier calendar-sync-bidirectional.service.ts existe" "FAIL" "Manquant"
fi
# Test T12-F2: Existence fichier repo/packages/booking/src/jobs/calendar-pull-events.job.ts
if [ -f "repo/packages/booking/src/jobs/calendar-pull-events.job.ts" ]; then
  add_row "T12-F2" "Fichier calendar-pull-events.job.ts existe" "PASS" "Cree"
else
  add_row "T12-F2" "Fichier calendar-pull-events.job.ts existe" "FAIL" "Manquant"
fi
# Test T12-F3: Existence fichier repo/packages/database/src/migrations/{date}-CalendarEventMappings.ts
if [ -f "repo/packages/database/src/migrations/{date}-CalendarEventMappings.ts" ]; then
  add_row "T12-F3" "Fichier {date}-CalendarEventMappings.ts existe" "PASS" "Cree"
else
  add_row "T12-F3" "Fichier {date}-CalendarEventMappings.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T12-V1: Create appointment skalean -> push provider OK (P0)
echo "  Verifying T12-V1 : Create appointment skalean -> push provider OK..."
add_row "T12-V1" "Create appointment skalean -> push provider OK" "WARN" "(P0) Voir B-08 Tache 3.1.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V2: Update -> sync provider (P0)
echo "  Verifying T12-V2 : Update -> sync provider..."
add_row "T12-V2" "Update -> sync provider" "WARN" "(P0) Voir B-08 Tache 3.1.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V3: Cancel -> delete provider event (P0)
echo "  Verifying T12-V3 : Cancel -> delete provider event..."
add_row "T12-V3" "Cancel -> delete provider event" "WARN" "(P0) Voir B-08 Tache 3.1.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V4: Pull events provider -> appears in skalean (status='external') (P0)
echo "  Verifying T12-V4 : Pull events provider -> appears in skalean (status='external')..."
add_row "T12-V4" "Pull events provider -> appears in skalean (status='external')" "WARN" "(P0) Voir B-08 Tache 3.1.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V5: Mapping idempotent (no duplicate) (P0)
echo "  Verifying T12-V5 : Mapping idempotent (no duplicate)..."
add_row "T12-V5" "Mapping idempotent (no duplicate)" "WARN" "(P0) Voir B-08 Tache 3.1.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V6: Conflict : skalean override (P0)
echo "  Verifying T12-V6 : Conflict : skalean override..."
add_row "T12-V6" "Conflict : skalean override" "WARN" "(P0) Voir B-08 Tache 3.1.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V7: Cron job execute every 5min (P0)
echo "  Verifying T12-V7 : Cron job execute every 5min..."
add_row "T12-V7" "Cron job execute every 5min" "WARN" "(P0) Voir B-08 Tache 3.1.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V8: Tests 8+ scenarios (P1)
echo "  Verifying T12-V8 : Tests 8+ scenarios..."
add_row "T12-V8" "Tests 8+ scenarios" "WARN" "(P1) Voir B-08 Tache 3.1.12 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 13/7 -- 3.1.13 : iCal Feed Export (Token-Based Public URL)

```bash
echo ""
echo "================================================"
echo "TACHE 3.1.13 : iCal Feed Export (Token-Based Public URL)"
echo "Priorite : P1 | Effort : 4h"
echo "Criteres a verifier : 7"
echo "================================================"

# === Verification fichiers crees ===
# Test T13-F1: Existence fichier repo/packages/booking/src/services/ical-export.service.ts
if [ -f "repo/packages/booking/src/services/ical-export.service.ts" ]; then
  add_row "T13-F1" "Fichier ical-export.service.ts existe" "PASS" "Cree"
else
  add_row "T13-F1" "Fichier ical-export.service.ts existe" "FAIL" "Manquant"
fi
# Test T13-F2: Existence fichier repo/apps/api/src/modules/booking/controllers/ical.controller.ts
if [ -f "repo/apps/api/src/modules/booking/controllers/ical.controller.ts" ]; then
  add_row "T13-F2" "Fichier ical.controller.ts existe" "PASS" "Cree"
else
  add_row "T13-F2" "Fichier ical.controller.ts existe" "FAIL" "Manquant"
fi
# Test T13-F3: Existence fichier repo/apps/api/test/booking/ical-feed.e2e-spec.ts
if [ -f "repo/apps/api/test/booking/ical-feed.e2e-spec.ts" ]; then
  add_row "T13-F3" "Fichier ical-feed.e2e-spec.ts existe" "PASS" "Cree"
else
  add_row "T13-F3" "Fichier ical-feed.e2e-spec.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T13-V1: GET /ical/:token retourne ics valide (P1)
echo "  Verifying T13-V1 : GET /ical/:token retourne ics valide..."
add_row "T13-V1" "GET /ical/:token retourne ics valide" "WARN" "(P1) Voir B-08 Tache 3.1.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V2: Format RFC 5545 (parse-able par Google Calendar) (P1)
echo "  Verifying T13-V2 : Format RFC 5545 (parse-able par Google Calendar)..."
add_row "T13-V2" "Format RFC 5545 (parse-able par Google Calendar)" "WARN" "(P1) Voir B-08 Tache 3.1.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V3: Token invalide 404 (P1)
echo "  Verifying T13-V3 : Token invalide 404..."
add_row "T13-V3" "Token invalide 404" "WARN" "(P1) Voir B-08 Tache 3.1.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V4: Regenerate revoke ancien token (P1)
echo "  Verifying T13-V4 : Regenerate revoke ancien token..."
add_row "T13-V4" "Regenerate revoke ancien token" "WARN" "(P1) Voir B-08 Tache 3.1.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V5: Cache Redis 5min actif (P1)
echo "  Verifying T13-V5 : Cache Redis 5min actif..."
add_row "T13-V5" "Cache Redis 5min actif" "WARN" "(P1) Voir B-08 Tache 3.1.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V6: Rate limit 60/h actif (P1)
echo "  Verifying T13-V6 : Rate limit 60/h actif..."
add_row "T13-V6" "Rate limit 60/h actif" "WARN" "(P1) Voir B-08 Tache 3.1.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V7: Tests 6+ scenarios (P1)
echo "  Verifying T13-V7 : Tests 6+ scenarios..."
add_row "T13-V7" "Tests 6+ scenarios" "WARN" "(P1) Voir B-08 Tache 3.1.13 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 14/8 -- 3.1.14 : Tests E2E Exhaustifs (40+) + Seeds Dev

```bash
echo ""
echo "================================================"
echo "TACHE 3.1.14 : Tests E2E Exhaustifs (40+) + Seeds Dev"
echo "Priorite : P0 | Effort : 7h"
echo "Criteres a verifier : 8"
echo "================================================"

# === Verification fichiers crees ===
# Test T14-F1: Existence fichier repo/apps/api/test/crm/{several specs}.e2e-spec.ts
if [ -f "repo/apps/api/test/crm/{several specs}.e2e-spec.ts" ]; then
  add_row "T14-F1" "Fichier {several specs}.e2e-spec.ts existe" "PASS" "Cree"
else
  add_row "T14-F1" "Fichier {several specs}.e2e-spec.ts existe" "FAIL" "Manquant"
fi
# Test T14-F2: Existence fichier repo/apps/api/test/booking/{several specs}.e2e-spec.ts
if [ -f "repo/apps/api/test/booking/{several specs}.e2e-spec.ts" ]; then
  add_row "T14-F2" "Fichier {several specs}.e2e-spec.ts existe" "PASS" "Cree"
else
  add_row "T14-F2" "Fichier {several specs}.e2e-spec.ts existe" "FAIL" "Manquant"
fi
# Test T14-F3: Existence fichier repo/infrastructure/scripts/seed-crm-booking.ts
if [ -f "repo/infrastructure/scripts/seed-crm-booking.ts" ]; then
  add_row "T14-F3" "Fichier seed-crm-booking.ts existe" "PASS" "Cree"
else
  add_row "T14-F3" "Fichier seed-crm-booking.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T14-V1: 40+ tests passent localement (P0)
echo "  Verifying T14-V1 : 40+ tests passent localement..."
add_row "T14-V1" "40+ tests passent localement" "WARN" "(P0) Voir B-08 Tache 3.1.14 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T14-V2: Tests passent CI (P0)
echo "  Verifying T14-V2 : Tests passent CI..."
add_row "T14-V2" "Tests passent CI" "WARN" "(P0) Voir B-08 Tache 3.1.14 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T14-V3: Seeds creent data realiste (P0)
echo "  Verifying T14-V3 : Seeds creent data realiste..."
add_row "T14-V3" "Seeds creent data realiste" "WARN" "(P0) Voir B-08 Tache 3.1.14 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T14-V4: Reproducibility : 5 runs OK (P0)
echo "  Verifying T14-V4 : Reproducibility : 5 runs OK..."
add_row "T14-V4" "Reproducibility : 5 runs OK" "WARN" "(P0) Voir B-08 Tache 3.1.14 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T14-V5: Performance benchmarks respectes (P0)
echo "  Verifying T14-V5 : Performance benchmarks respectes..."
add_row "T14-V5" "Performance benchmarks respectes" "WARN" "(P0) Voir B-08 Tache 3.1.14 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T14-V6: Coverage : tous endpoints testes (P0)
echo "  Verifying T14-V6 : Coverage : tous endpoints testes..."
add_row "T14-V6" "Coverage : tous endpoints testes" "WARN" "(P0) Voir B-08 Tache 3.1.14 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T14-V7: Tests integration RBAC + multi-tenant (P0)
echo "  Verifying T14-V7 : Tests integration RBAC + multi-tenant..."
add_row "T14-V7" "Tests integration RBAC + multi-tenant" "WARN" "(P0) Voir B-08 Tache 3.1.14 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T14-V8: Documentation seeds dans runbook (P1)
echo "  Verifying T14-V8 : Documentation seeds dans runbook..."
add_row "T14-V8" "Documentation seeds dans runbook" "WARN" "(P1) Voir B-08 Tache 3.1.14 pour test detaille - critere a auto-tester via script ad-hoc"

```

---


---


## VERIFICATIONS TRANSVERSALES SPRINT 8

### TR-BUILD : Build complet du sprint

```bash
echo ""
echo "================================================"
echo "VERIFICATIONS TRANSVERSALES SPRINT 8"
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

### TR-MIGRATIONS : Migrations DB Sprint 8

```bash
echo "=== TR-MIGRATIONS : Migrations DB ==="
MIGR_COUNT=$(pg_query "SELECT COUNT(*) FROM migrations WHERE name LIKE '%sprint08%' OR name LIKE '%Sprint08%'" || echo 0)
if [ "$MIGR_COUNT" -gt 0 ]; then
  add_row "TR-MIG" "Migrations Sprint 8 appliquees" "PASS" "$MIGR_COUNT migrations"
else
  add_row "TR-MIG" "Migrations Sprint 8 appliquees" "WARN" "Aucune migration detectee (verifier)"
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
echo "GENERATION DU RAPPORT FINAL SPRINT 8"
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

## Jalon GO/NO-GO Sprint 8

EOF

# Calcul statut final
if (( $(echo "$SCORE >= 95" | bc -l) )); then
  STATUT="GO"
  cat >> "$REPORT_FILE" << EOF
**STATUT** : GO -- Sprint 8 valide, passage Sprint 9 autorise

Le sprint a passe les criteres requis. Cowork peut demarrer Sprint 9.

EOF
  echo ""
  echo "================================================"
  echo "SPRINT 8 : GO ($SCORE%)"
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
  echo "SPRINT 8 : GO CONDITIONNEL ($SCORE%)"
  echo "================================================"
else
  STATUT="NO-GO"
  cat >> "$REPORT_FILE" << EOF
**STATUT** : NO-GO -- Score $SCORE% trop bas (cible 85% minimum)

Le sprint **doit etre repris** :
- Lister tous FAIL P0
- Escalation Saad/Abla decision (cut scope OR delai)
- Reprise sprint avant Sprint 9

EOF
  echo ""
  echo "================================================"
  echo "SPRINT 8 : NO-GO ($SCORE%)"
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
  echo "git commit -m \"chore(sprint-08): close sprint 8 -- $STATUT ($SCORE%)\"" >> "$REPORT_FILE"
  echo '```' >> "$REPORT_FILE"
fi

echo ""
echo "Rapport complet dans : $REPORT_FILE"
```

---

## INSTRUCTION FINALE A CLAUDE CODE / COWORK

Apres l'execution complete des verifications ci-dessus :

1. **Lis le contenu de `sprint08-verify-report.md`** integralement
2. **Identifie les FAIL critiques** (criteres P0) qui necessitent intervention manuelle
3. **Affiche un resume executif** :
   - Nombre total de criteres
   - Pourcentage PASS / PASS\* / FAIL / WARN
   - Liste des FAIL avec contexte technique
   - Recommandation : GO / GO CONDITIONNEL / NO-GO
4. **Si NO-GO** : ne pas demarrer le Sprint suivant, alerter Saad/Abla via Slack `#insurtech-dev`
5. **Si GO ou GO CONDITIONNEL** : produire le commit de cloture du sprint :

```bash
git add skalean-insurtech/sprint08-verify-report.md
git commit -m "chore(sprint-08): close sprint 8 with verification report

- Verification automatique executee
- Score global : <SCORE>%
- <PASS> criteres PASS, <PASS_REPAIRED> reparations auto, <FAIL> FAIL
- Statut : <GO|GO CONDITIONNEL|NO-GO>

Phase: 3 -- Modules Horizontaux
Sprint: 8 (Phase 3 / Sprint 1)
Reference B-08, C-08, V-08
Report: sprint08-verify-report.md"
```

6. **Documentation continue** : si decisions techniques prises pendant verification, ajouter notes dans `repo/docs/runbooks/sprint-08-lessons-learned.md`

---

**Fin de la verification V-08 v2.2 detaillee -- Sprint 8 (3.1) CRM + Booking.**

**Total criteres taches** : 111 | **Total transversaux** : ~10 | **Effort sprint** : 75h
