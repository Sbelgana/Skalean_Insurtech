# VERIFICATION SPRINT 9 -- Phase 3 / Sprint 2 : Comm WhatsApp + Email
# Version : Auto-reparation active + Rapport final MD detaille
# 13 taches, 90 criteres extraits B-09
# AUCUNE EMOJI AUTORISEE

**Version** : v2.2 (verification detaillee)
**Phase** : 3 -- Modules Horizontaux
**Sprint** : 9 / 35 (cumul) -- Sprint 2 dans Phase 3
**Reference meta-prompt** : `B-09-sprint-09-comm-wa-email.md`
**Reference orchestrateur** : `C-09-sprint-09-comm-wa-email.md`
**Total criteres** : 90 criteres taches + ~10 transversaux

---

Tu es **Claude Code (ou Cowork)**. Tu dois executer une **verification COMPLETE et EXHAUSTIVE** du Sprint 9 apres execution toutes les 13 taches.

---

## REGLES D'EXECUTION

1. Tu **executes CHAQUE verification dans l'ordre** (taches puis transversales)
2. Quand une verification echoue, tu **TENTES UNE REPARATION AUTOMATIQUE** avant de noter FAIL
3. Apres chaque tentative de reparation, tu **re-executes la verification**
4. Tu consignes dans `sprint09-verify-report.md` **TOUS les resultats** au fil de l'execution
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
REPORT_FILE="sprint09-verify-report.md"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
RUN_ID=$(date '+%Y%m%d-%H%M%S')

cat > "$REPORT_FILE" << EOF
# Rapport de Verification - Sprint 9 : Comm WhatsApp + Email

**Date** : $TIMESTAMP
**Run ID** : $RUN_ID
**Phase** : 3 -- Modules Horizontaux
**Sprint** : 9 (Phase 3 / Sprint 2)
**Reference B-09** : 13 taches, 90 criteres extraits
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

## TACHE 1/5 -- 3.2.1 : comm_messages Entity Enrichie + Schemas Zod

```bash
echo ""
echo "================================================"
echo "TACHE 3.2.1 : comm_messages Entity Enrichie + Schemas Zod"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T01-F1: Existence fichier repo/packages/comm/src/entities/comm-message.entity.ts
if [ -f "repo/packages/comm/src/entities/comm-message.entity.ts" ]; then
  add_row "T01-F1" "Fichier comm-message.entity.ts existe" "PASS" "Cree"
else
  add_row "T01-F1" "Fichier comm-message.entity.ts existe" "FAIL" "Manquant"
fi
# Test T01-F2: Existence fichier repo/packages/comm/src/schemas/message.schema.ts
if [ -f "repo/packages/comm/src/schemas/message.schema.ts" ]; then
  add_row "T01-F2" "Fichier message.schema.ts existe" "PASS" "Cree"
else
  add_row "T01-F2" "Fichier message.schema.ts existe" "FAIL" "Manquant"
fi
# Test T01-F3: Existence fichier repo/packages/comm/src/schemas/webhook.schema.ts
if [ -f "repo/packages/comm/src/schemas/webhook.schema.ts" ]; then
  add_row "T01-F3" "Fichier webhook.schema.ts existe" "PASS" "Cree"
else
  add_row "T01-F3" "Fichier webhook.schema.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T01-V1: Entity hydrate correctement (P0)
echo "  Verifying T01-V1 : Entity hydrate correctement..."
add_row "T01-V1" "Entity hydrate correctement" "WARN" "(P0) Voir B-09 Tache 3.2.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V2: Send Schema rejette to invalide (pas E.164 ni email) (P0)
echo "  Verifying T01-V2 : Send Schema rejette to invalide (pas E.164 ni email)..."
add_row "T01-V2" "Send Schema rejette to invalide (pas E.164 ni email)" "WARN" "(P0) Voir B-09 Tache 3.2.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V3: Send Schema accept WA template_variables JSONB (P0)
echo "  Verifying T01-V3 : Send Schema accept WA template_variables JSONB..."
add_row "T01-V3" "Send Schema accept WA template_variables JSONB" "WARN" "(P0) Voir B-09 Tache 3.2.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V4: Helpers normalisent phone correctement (P0)
echo "  Verifying T01-V4 : Helpers normalisent phone correctement..."
add_row "T01-V4" "Helpers normalisent phone correctement" "WARN" "(P0) Voir B-09 Tache 3.2.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V5: Tests 8+ scenarios (P0)
echo "  Verifying T01-V5 : Tests 8+ scenarios..."
add_row "T01-V5" "Tests 8+ scenarios" "WARN" "(P0) Voir B-09 Tache 3.2.1 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 2/8 -- 3.2.2 : WhatsApp Cloud API Client (Meta v21.0)

```bash
echo ""
echo "================================================"
echo "TACHE 3.2.2 : WhatsApp Cloud API Client (Meta v21.0)"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 8"
echo "================================================"

# === Verification fichiers crees ===
# Test T02-F1: Existence fichier repo/packages/comm/src/providers/whatsapp/whatsapp-cloud-api.client.ts
if [ -f "repo/packages/comm/src/providers/whatsapp/whatsapp-cloud-api.client.ts" ]; then
  add_row "T02-F1" "Fichier whatsapp-cloud-api.client.ts existe" "PASS" "Cree"
else
  add_row "T02-F1" "Fichier whatsapp-cloud-api.client.ts existe" "FAIL" "Manquant"
fi
# Test T02-F2: Existence fichier repo/packages/comm/src/providers/whatsapp/whatsapp-cloud-api.client.spec.ts
if [ -f "repo/packages/comm/src/providers/whatsapp/whatsapp-cloud-api.client.spec.ts" ]; then
  add_row "T02-F2" "Fichier whatsapp-cloud-api.client.spec.ts existe" "PASS" "Cree"
else
  add_row "T02-F2" "Fichier whatsapp-cloud-api.client.spec.ts existe" "FAIL" "Manquant"
fi
# Test T02-F3: Existence fichier repo/packages/comm/src/providers/whatsapp/types.ts
if [ -f "repo/packages/comm/src/providers/whatsapp/types.ts" ]; then
  add_row "T02-F3" "Fichier types.ts existe" "PASS" "Cree"
else
  add_row "T02-F3" "Fichier types.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T02-V1: 'sendTemplate' retourne message_id Meta (P0)
echo "  Verifying T02-V1 : 'sendTemplate' retourne message_id Meta..."
add_row "T02-V1" "'sendTemplate' retourne message_id Meta" "WARN" "(P0) Voir B-09 Tache 3.2.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V2: Phone E.164 normalise (sans +) (P0)
echo "  Verifying T02-V2 : Phone E.164 normalise (sans +)..."
add_row "T02-V2" "Phone E.164 normalise (sans +)" "WARN" "(P0) Voir B-09 Tache 3.2.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V3: Template variables interpolees dans components (P0)
echo "  Verifying T02-V3 : Template variables interpolees dans components..."
add_row "T02-V3" "Template variables interpolees dans components" "WARN" "(P0) Voir B-09 Tache 3.2.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V4: Retry 3 fois sur 5xx (P0)
echo "  Verifying T02-V4 : Retry 3 fois sur 5xx..."
add_row "T02-V4" "Retry 3 fois sur 5xx" "WARN" "(P0) Voir B-09 Tache 3.2.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V5: Errors typed (MetaInvalidTemplate, etc.) (P0)
echo "  Verifying T02-V5 : Errors typed (MetaInvalidTemplate, etc.)..."
add_row "T02-V5" "Errors typed (MetaInvalidTemplate, etc.)" "WARN" "(P0) Voir B-09 Tache 3.2.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V6: Mock client comportement equivalent (P0)
echo "  Verifying T02-V6 : Mock client comportement equivalent..."
add_row "T02-V6" "Mock client comportement equivalent" "WARN" "(P0) Voir B-09 Tache 3.2.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V7: Tests integration via mock (pas de vrai API call) (P0)
echo "  Verifying T02-V7 : Tests integration via mock (pas de vrai API call)..."
add_row "T02-V7" "Tests integration via mock (pas de vrai API call)" "WARN" "(P0) Voir B-09 Tache 3.2.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V8: Logs structures emit (P1)
echo "  Verifying T02-V8 : Logs structures emit..."
add_row "T02-V8" "Logs structures emit" "WARN" "(P1) Voir B-09 Tache 3.2.2 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 3/7 -- 3.2.3 : WA Template Renderer + 3 Locales

```bash
echo ""
echo "================================================"
echo "TACHE 3.2.3 : WA Template Renderer + 3 Locales"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 7"
echo "================================================"

# === Verification fichiers crees ===
# Test T03-F1: Existence fichier repo/packages/comm/src/services/wa-template-renderer.service.ts
if [ -f "repo/packages/comm/src/services/wa-template-renderer.service.ts" ]; then
  add_row "T03-F1" "Fichier wa-template-renderer.service.ts existe" "PASS" "Cree"
else
  add_row "T03-F1" "Fichier wa-template-renderer.service.ts existe" "FAIL" "Manquant"
fi
# Test T03-F2: Existence fichier repo/packages/comm/src/services/wa-template-renderer.service.spec.ts
if [ -f "repo/packages/comm/src/services/wa-template-renderer.service.spec.ts" ]; then
  add_row "T03-F2" "Fichier wa-template-renderer.service.spec.ts existe" "PASS" "Cree"
else
  add_row "T03-F2" "Fichier wa-template-renderer.service.spec.ts existe" "FAIL" "Manquant"
fi
# Test T03-F3: Existence fichier repo/packages/comm/src/types/meta-template-components.ts
if [ -f "repo/packages/comm/src/types/meta-template-components.ts" ]; then
  add_row "T03-F3" "Fichier meta-template-components.ts existe" "PASS" "Cree"
else
  add_row "T03-F3" "Fichier meta-template-components.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T03-V1: 'render('appointment_reminder', 'fr', { user_name: 'Mohamed', appointment_time: '15:00' }) (P0)
echo "  Verifying T03-V1 : 'render('appointment_reminder', 'fr', { user_name: 'Mohamed', appointm..."
add_row "T03-V1" "'render('appointment_reminder', 'fr', { user_name: 'Mohamed', appointment_time: '15:00' })" "WARN" "(P0) Voir B-09 Tache 3.2.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V2: Variable manquante throw error explicite (P0)
echo "  Verifying T03-V2 : Variable manquante throw error explicite..."
add_row "T03-V2" "Variable manquante throw error explicite" "WARN" "(P0) Voir B-09 Tache 3.2.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V3: Variable extra ignoree (pas erreur, juste pas utilisee) (P0)
echo "  Verifying T03-V3 : Variable extra ignoree (pas erreur, juste pas utilisee)..."
add_row "T03-V3" "Variable extra ignoree (pas erreur, juste pas utilisee)" "WARN" "(P0) Voir B-09 Tache 3.2.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V4: Locale ar-MA utilise contenu darija (P0)
echo "  Verifying T03-V4 : Locale ar-MA utilise contenu darija..."
add_row "T03-V4" "Locale ar-MA utilise contenu darija" "WARN" "(P0) Voir B-09 Tache 3.2.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V5: Fallback locale si template absent (P0)
echo "  Verifying T03-V5 : Fallback locale si template absent..."
add_row "T03-V5" "Fallback locale si template absent" "WARN" "(P0) Voir B-09 Tache 3.2.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V6: 'validateMetaApproved' rejette 'meta_template_status='pending_review'' (P0)
echo "  Verifying T03-V6 : 'validateMetaApproved' rejette 'meta_template_status='pending_review''..."
add_row "T03-V6" "'validateMetaApproved' rejette 'meta_template_status='pending_review''" "WARN" "(P0) Voir B-09 Tache 3.2.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V7: Tests 8+ scenarios (P0)
echo "  Verifying T03-V7 : Tests 8+ scenarios..."
add_row "T03-V7" "Tests 8+ scenarios" "WARN" "(P0) Voir B-09 Tache 3.2.3 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 4/9 -- 3.2.4 : WA Webhook Receiver + Signature HMAC Verification

```bash
echo ""
echo "================================================"
echo "TACHE 3.2.4 : WA Webhook Receiver + Signature HMAC Verification"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 9"
echo "================================================"

# === Verification fichiers crees ===
# Test T04-F1: Existence fichier repo/apps/api/src/modules/comm/controllers/wa-webhook.controller.ts
if [ -f "repo/apps/api/src/modules/comm/controllers/wa-webhook.controller.ts" ]; then
  add_row "T04-F1" "Fichier wa-webhook.controller.ts existe" "PASS" "Cree"
else
  add_row "T04-F1" "Fichier wa-webhook.controller.ts existe" "FAIL" "Manquant"
fi
# Test T04-F2: Existence fichier repo/apps/api/src/modules/comm/middleware/wa-signature.middleware.ts
if [ -f "repo/apps/api/src/modules/comm/middleware/wa-signature.middleware.ts" ]; then
  add_row "T04-F2" "Fichier wa-signature.middleware.ts existe" "PASS" "Cree"
else
  add_row "T04-F2" "Fichier wa-signature.middleware.ts existe" "FAIL" "Manquant"
fi
# Test T04-F3: Existence fichier repo/apps/api/src/modules/comm/consumers/wa-webhook-processor.consumer.ts
if [ -f "repo/apps/api/src/modules/comm/consumers/wa-webhook-processor.consumer.ts" ]; then
  add_row "T04-F3" "Fichier wa-webhook-processor.consumer.ts existe" "PASS" "Cree"
else
  add_row "T04-F3" "Fichier wa-webhook-processor.consumer.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T04-V1: GET verification : challenge retourne si verify_token match (P0)
echo "  Verifying T04-V1 : GET verification : challenge retourne si verify_token match..."
add_row "T04-V1" "GET verification : challenge retourne si verify_token match" "WARN" "(P0) Voir B-09 Tache 3.2.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V2: POST signature valide : 200 OK + processed (P0)
echo "  Verifying T04-V2 : POST signature valide : 200 OK + processed..."
add_row "T04-V2" "POST signature valide : 200 OK + processed" "WARN" "(P0) Voir B-09 Tache 3.2.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V3: POST signature invalide : 401 + warn log (P0)
echo "  Verifying T04-V3 : POST signature invalide : 401 + warn log..."
add_row "T04-V3" "POST signature invalide : 401 + warn log" "WARN" "(P0) Voir B-09 Tache 3.2.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V4: POST signature missing : 401 (P0)
echo "  Verifying T04-V4 : POST signature missing : 401..."
add_row "T04-V4" "POST signature missing : 401" "WARN" "(P0) Voir B-09 Tache 3.2.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V5: Idempotency : 2 POSTs meme body -> 1 seul process (P0)
echo "  Verifying T04-V5 : Idempotency : 2 POSTs meme body -> 1 seul process..."
add_row "T04-V5" "Idempotency : 2 POSTs meme body -> 1 seul process" "WARN" "(P0) Voir B-09 Tache 3.2.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V6: Status update propage a comm_messages (P0)
echo "  Verifying T04-V6 : Status update propage a comm_messages..."
add_row "T04-V6" "Status update propage a comm_messages" "WARN" "(P0) Voir B-09 Tache 3.2.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V7: Incoming message cree row + auto-log interaction CRM (P0)
echo "  Verifying T04-V7 : Incoming message cree row + auto-log interaction CRM..."
add_row "T04-V7" "Incoming message cree row + auto-log interaction CRM" "WARN" "(P0) Voir B-09 Tache 3.2.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V8: Response < 5s (async via Kafka) (P0)
echo "  Verifying T04-V8 : Response < 5s (async via Kafka)..."
add_row "T04-V8" "Response < 5s (async via Kafka)" "WARN" "(P0) Voir B-09 Tache 3.2.4 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 5/6 -- 3.2.5 : Template Manager + 20+ Templates Seed

```bash
echo ""
echo "================================================"
echo "TACHE 3.2.5 : Template Manager + 20+ Templates Seed"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 6"
echo "================================================"

# === Verification fichiers crees ===
# Test T05-F1: Existence fichier repo/packages/comm/src/services/template-manager.service.ts
if [ -f "repo/packages/comm/src/services/template-manager.service.ts" ]; then
  add_row "T05-F1" "Fichier template-manager.service.ts existe" "PASS" "Cree"
else
  add_row "T05-F1" "Fichier template-manager.service.ts existe" "FAIL" "Manquant"
fi
# Test T05-F2: Existence fichier repo/packages/comm/src/services/template-manager.service.spec.ts
if [ -f "repo/packages/comm/src/services/template-manager.service.spec.ts" ]; then
  add_row "T05-F2" "Fichier template-manager.service.spec.ts existe" "PASS" "Cree"
else
  add_row "T05-F2" "Fichier template-manager.service.spec.ts existe" "FAIL" "Manquant"
fi
# Test T05-F3: Existence fichier repo/apps/api/src/modules/comm/controllers/templates.controller.ts
if [ -f "repo/apps/api/src/modules/comm/controllers/templates.controller.ts" ]; then
  add_row "T05-F3" "Fichier templates.controller.ts existe" "PASS" "Cree"
else
  add_row "T05-F3" "Fichier templates.controller.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T05-V1: 60+ templates seed crees (P0)
echo "  Verifying T05-V1 : 60+ templates seed crees..."
add_row "T05-V1" "60+ templates seed crees" "WARN" "(P0) Voir B-09 Tache 3.2.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V2: 3 locales par template (P0)
echo "  Verifying T05-V2 : 3 locales par template..."
add_row "T05-V2" "3 locales par template" "WARN" "(P0) Voir B-09 Tache 3.2.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V3: CRUD templates fonctionne (P0)
echo "  Verifying T05-V3 : CRUD templates fonctionne..."
add_row "T05-V3" "CRUD templates fonctionne" "WARN" "(P0) Voir B-09 Tache 3.2.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V4: Workflow draft -> pending -> approved fonctionne (P0)
echo "  Verifying T05-V4 : Workflow draft -> pending -> approved fonctionne..."
add_row "T05-V4" "Workflow draft -> pending -> approved fonctionne" "WARN" "(P0) Voir B-09 Tache 3.2.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V5: Validation longueur Meta (P0)
echo "  Verifying T05-V5 : Validation longueur Meta..."
add_row "T05-V5" "Validation longueur Meta" "WARN" "(P0) Voir B-09 Tache 3.2.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V6: Tests 8+ scenarios (P1)
echo "  Verifying T05-V6 : Tests 8+ scenarios..."
add_row "T05-V6" "Tests 8+ scenarios" "WARN" "(P1) Voir B-09 Tache 3.2.5 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 6/8 -- 3.2.6 : Email SMTP Client + DKIM/SPF + Mailgun

```bash
echo ""
echo "================================================"
echo "TACHE 3.2.6 : Email SMTP Client + DKIM/SPF + Mailgun"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 8"
echo "================================================"

# === Verification fichiers crees ===
# Test T06-F1: Existence fichier repo/packages/comm/src/providers/email/email.service.ts
if [ -f "repo/packages/comm/src/providers/email/email.service.ts" ]; then
  add_row "T06-F1" "Fichier email.service.ts existe" "PASS" "Cree"
else
  add_row "T06-F1" "Fichier email.service.ts existe" "FAIL" "Manquant"
fi
# Test T06-F2: Existence fichier repo/packages/comm/src/providers/email/email.service.spec.ts
if [ -f "repo/packages/comm/src/providers/email/email.service.spec.ts" ]; then
  add_row "T06-F2" "Fichier email.service.spec.ts existe" "PASS" "Cree"
else
  add_row "T06-F2" "Fichier email.service.spec.ts existe" "FAIL" "Manquant"
fi
# Test T06-F3: Existence fichier repo/packages/comm/src/providers/email/dkim-signer.helper.ts
if [ -f "repo/packages/comm/src/providers/email/dkim-signer.helper.ts" ]; then
  add_row "T06-F3" "Fichier dkim-signer.helper.ts existe" "PASS" "Cree"
else
  add_row "T06-F3" "Fichier dkim-signer.helper.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T06-V1: send via Mailhog dev OK (P0)
echo "  Verifying T06-V1 : send via Mailhog dev OK..."
add_row "T06-V1" "send via Mailhog dev OK" "WARN" "(P0) Voir B-09 Tache 3.2.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V2: send via Mailgun staging OK (test env) (P0)
echo "  Verifying T06-V2 : send via Mailgun staging OK (test env)..."
add_row "T06-V2" "send via Mailgun staging OK (test env)" "WARN" "(P0) Voir B-09 Tache 3.2.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V3: DKIM signature appliquee (verifier headers) (P0)
echo "  Verifying T06-V3 : DKIM signature appliquee (verifier headers)..."
add_row "T06-V3" "DKIM signature appliquee (verifier headers)" "WARN" "(P0) Voir B-09 Tache 3.2.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V4: List-Unsubscribe present (P0)
echo "  Verifying T06-V4 : List-Unsubscribe present..."
add_row "T06-V4" "List-Unsubscribe present" "WARN" "(P0) Voir B-09 Tache 3.2.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V5: Multipart HTML + text (P0)
echo "  Verifying T06-V5 : Multipart HTML + text..."
add_row "T06-V5" "Multipart HTML + text" "WARN" "(P0) Voir B-09 Tache 3.2.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V6: Provider switchable via env (P0)
echo "  Verifying T06-V6 : Provider switchable via env..."
add_row "T06-V6" "Provider switchable via env" "WARN" "(P0) Voir B-09 Tache 3.2.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V7: Documentation DNS claire (P0)
echo "  Verifying T06-V7 : Documentation DNS claire..."
add_row "T06-V7" "Documentation DNS claire" "WARN" "(P0) Voir B-09 Tache 3.2.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V8: Tests 8+ scenarios (P1)
echo "  Verifying T06-V8 : Tests 8+ scenarios..."
add_row "T06-V8" "Tests 8+ scenarios" "WARN" "(P1) Voir B-09 Tache 3.2.6 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 7/8 -- 3.2.7 : Email Template Renderer + RTL ar/ar-MA

```bash
echo ""
echo "================================================"
echo "TACHE 3.2.7 : Email Template Renderer + RTL ar/ar-MA"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 8"
echo "================================================"

# === Verification fichiers crees ===
# Test T07-F1: Existence fichier repo/packages/comm/src/services/email-template-renderer.service.ts
if [ -f "repo/packages/comm/src/services/email-template-renderer.service.ts" ]; then
  add_row "T07-F1" "Fichier email-template-renderer.service.ts existe" "PASS" "Cree"
else
  add_row "T07-F1" "Fichier email-template-renderer.service.ts existe" "FAIL" "Manquant"
fi
# Test T07-F2: Existence fichier repo/packages/comm/src/services/email-template-renderer.service.spec.ts
if [ -f "repo/packages/comm/src/services/email-template-renderer.service.spec.ts" ]; then
  add_row "T07-F2" "Fichier email-template-renderer.service.spec.ts existe" "PASS" "Cree"
else
  add_row "T07-F2" "Fichier email-template-renderer.service.spec.ts existe" "FAIL" "Manquant"
fi
# Test T07-F3: Existence fichier repo/packages/comm/src/templates/_layout.hbs
if [ -f "repo/packages/comm/src/templates/_layout.hbs" ]; then
  add_row "T07-F3" "Fichier _layout.hbs existe" "PASS" "Cree"
else
  add_row "T07-F3" "Fichier _layout.hbs existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T07-V1: 'render('appointment_reminder', 'fr', vars)' retourne subject + html + text (P0)
echo "  Verifying T07-V1 : 'render('appointment_reminder', 'fr', vars)' retourne subject + html +..."
add_row "T07-V1" "'render('appointment_reminder', 'fr', vars)' retourne subject + html + text" "WARN" "(P0) Voir B-09 Tache 3.2.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V2: Locale ar-MA : html avec dir='rtl' (P0)
echo "  Verifying T07-V2 : Locale ar-MA : html avec dir='rtl'..."
add_row "T07-V2" "Locale ar-MA : html avec dir='rtl'" "WARN" "(P0) Voir B-09 Tache 3.2.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V3: Variables interpolees correctement (P0)
echo "  Verifying T07-V3 : Variables interpolees correctement..."
add_row "T07-V3" "Variables interpolees correctement" "WARN" "(P0) Voir B-09 Tache 3.2.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V4: Layout shared applique (logo + footer) (P0)
echo "  Verifying T07-V4 : Layout shared applique (logo + footer)..."
add_row "T07-V4" "Layout shared applique (logo + footer)" "WARN" "(P0) Voir B-09 Tache 3.2.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V5: CSS inline (apres juice) (P0)
echo "  Verifying T07-V5 : CSS inline (apres juice)..."
add_row "T07-V5" "CSS inline (apres juice)" "WARN" "(P0) Voir B-09 Tache 3.2.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V6: Plain text auto-genere (P0)
echo "  Verifying T07-V6 : Plain text auto-genere..."
add_row "T07-V6" "Plain text auto-genere" "WARN" "(P0) Voir B-09 Tache 3.2.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V7: Helpers : formatDate retourne format locale (P0)
echo "  Verifying T07-V7 : Helpers : formatDate retourne format locale..."
add_row "T07-V7" "Helpers : formatDate retourne format locale" "WARN" "(P0) Voir B-09 Tache 3.2.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V8: Tests 8+ scenarios (P0)
echo "  Verifying T07-V8 : Tests 8+ scenarios..."
add_row "T07-V8" "Tests 8+ scenarios" "WARN" "(P0) Voir B-09 Tache 3.2.7 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 8/7 -- 3.2.8 : BullMQ Queues + Retry + DLQ

```bash
echo ""
echo "================================================"
echo "TACHE 3.2.8 : BullMQ Queues + Retry + DLQ"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 7"
echo "================================================"

# === Verification fichiers crees ===
# Test T08-F1: Existence fichier repo/packages/comm/src/workers/wa-send.worker.ts
if [ -f "repo/packages/comm/src/workers/wa-send.worker.ts" ]; then
  add_row "T08-F1" "Fichier wa-send.worker.ts existe" "PASS" "Cree"
else
  add_row "T08-F1" "Fichier wa-send.worker.ts existe" "FAIL" "Manquant"
fi
# Test T08-F2: Existence fichier repo/packages/comm/src/workers/email-send.worker.ts
if [ -f "repo/packages/comm/src/workers/email-send.worker.ts" ]; then
  add_row "T08-F2" "Fichier email-send.worker.ts existe" "PASS" "Cree"
else
  add_row "T08-F2" "Fichier email-send.worker.ts existe" "FAIL" "Manquant"
fi
# Test T08-F3: Existence fichier repo/packages/comm/src/workers/wa-webhook-process.worker.ts
if [ -f "repo/packages/comm/src/workers/wa-webhook-process.worker.ts" ]; then
  add_row "T08-F3" "Fichier wa-webhook-process.worker.ts existe" "PASS" "Cree"
else
  add_row "T08-F3" "Fichier wa-webhook-process.worker.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T08-V1: Job reussi : message status='sent' + Kafka event (P0)
echo "  Verifying T08-V1 : Job reussi : message status='sent' + Kafka event..."
add_row "T08-V1" "Job reussi : message status='sent' + Kafka event" "WARN" "(P0) Voir B-09 Tache 3.2.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V2: Job fail transient : retry 3 fois (P0)
echo "  Verifying T08-V2 : Job fail transient : retry 3 fois..."
add_row "T08-V2" "Job fail transient : retry 3 fois" "WARN" "(P0) Voir B-09 Tache 3.2.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V3: 3 echecs : message status='failed' + DLQ event (P0)
echo "  Verifying T08-V3 : 3 echecs : message status='failed' + DLQ event..."
add_row "T08-V3" "3 echecs : message status='failed' + DLQ event" "WARN" "(P0) Voir B-09 Tache 3.2.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V4: Idempotency : 2eme job meme messageId skip (P0)
echo "  Verifying T08-V4 : Idempotency : 2eme job meme messageId skip..."
add_row "T08-V4" "Idempotency : 2eme job meme messageId skip" "WARN" "(P0) Voir B-09 Tache 3.2.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V5: Concurrency 10 : 10 jobs parallele OK (P0)
echo "  Verifying T08-V5 : Concurrency 10 : 10 jobs parallele OK..."
add_row "T08-V5" "Concurrency 10 : 10 jobs parallele OK" "WARN" "(P0) Voir B-09 Tache 3.2.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V6: BullDashboard montre queues (P0)
echo "  Verifying T08-V6 : BullDashboard montre queues..."
add_row "T08-V6" "BullDashboard montre queues" "WARN" "(P0) Voir B-09 Tache 3.2.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V7: Tests 10+ scenarios (P0)
echo "  Verifying T08-V7 : Tests 10+ scenarios..."
add_row "T08-V7" "Tests 10+ scenarios" "WARN" "(P0) Voir B-09 Tache 3.2.8 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 9/7 -- 3.2.9 : Message Orchestrator (Routing par preferred_channel)

```bash
echo ""
echo "================================================"
echo "TACHE 3.2.9 : Message Orchestrator (Routing par preferred_channel)"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 7"
echo "================================================"

# === Verification fichiers crees ===
# Test T09-F1: Existence fichier repo/packages/comm/src/services/message-orchestrator.service.ts
if [ -f "repo/packages/comm/src/services/message-orchestrator.service.ts" ]; then
  add_row "T09-F1" "Fichier message-orchestrator.service.ts existe" "PASS" "Cree"
else
  add_row "T09-F1" "Fichier message-orchestrator.service.ts existe" "FAIL" "Manquant"
fi
# Test T09-F2: Existence fichier repo/packages/comm/src/services/message-orchestrator.service.spec.ts
if [ -f "repo/packages/comm/src/services/message-orchestrator.service.spec.ts" ]; then
  add_row "T09-F2" "Fichier message-orchestrator.service.spec.ts existe" "PASS" "Cree"
else
  add_row "T09-F2" "Fichier message-orchestrator.service.spec.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T09-V1: Contact preferred WA + opt-in -> envoie via WA (P0)
echo "  Verifying T09-V1 : Contact preferred WA + opt-in -> envoie via WA..."
add_row "T09-V1" "Contact preferred WA + opt-in -> envoie via WA" "WARN" "(P0) Voir B-09 Tache 3.2.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V2: Contact preferred WA + opt-out -> fallback email (P0)
echo "  Verifying T09-V2 : Contact preferred WA + opt-out -> fallback email..."
add_row "T09-V2" "Contact preferred WA + opt-out -> fallback email" "WARN" "(P0) Voir B-09 Tache 3.2.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V3: Contact sans phone + sans email -> NoAvailableChannelError (P0)
echo "  Verifying T09-V3 : Contact sans phone + sans email -> NoAvailableChannelError..."
add_row "T09-V3" "Contact sans phone + sans email -> NoAvailableChannelError" "WARN" "(P0) Voir B-09 Tache 3.2.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V4: Template pas Meta approved -> fallback email (P0)
echo "  Verifying T09-V4 : Template pas Meta approved -> fallback email..."
add_row "T09-V4" "Template pas Meta approved -> fallback email" "WARN" "(P0) Voir B-09 Tache 3.2.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V5: Broadcast filtres correctement (P0)
echo "  Verifying T09-V5 : Broadcast filtres correctement..."
add_row "T09-V5" "Broadcast filtres correctement" "WARN" "(P0) Voir B-09 Tache 3.2.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V6: Audit + Kafka publishees (P0)
echo "  Verifying T09-V6 : Audit + Kafka publishees..."
add_row "T09-V6" "Audit + Kafka publishees" "WARN" "(P0) Voir B-09 Tache 3.2.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V7: Tests 12+ scenarios (P0)
echo "  Verifying T09-V7 : Tests 12+ scenarios..."
add_row "T09-V7" "Tests 12+ scenarios" "WARN" "(P0) Voir B-09 Tache 3.2.9 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 10/6 -- 3.2.10 : Delivery Tracking + Bounces + Alerts

```bash
echo ""
echo "================================================"
echo "TACHE 3.2.10 : Delivery Tracking + Bounces + Alerts"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 6"
echo "================================================"

# === Verification fichiers crees ===
# Test T10-F1: Existence fichier repo/packages/comm/src/services/delivery-tracking.service.ts
if [ -f "repo/packages/comm/src/services/delivery-tracking.service.ts" ]; then
  add_row "T10-F1" "Fichier delivery-tracking.service.ts existe" "PASS" "Cree"
else
  add_row "T10-F1" "Fichier delivery-tracking.service.ts existe" "FAIL" "Manquant"
fi
# Test T10-F2: Existence fichier repo/apps/api/src/modules/comm/controllers/mailgun-webhook.controller.ts
if [ -f "repo/apps/api/src/modules/comm/controllers/mailgun-webhook.controller.ts" ]; then
  add_row "T10-F2" "Fichier mailgun-webhook.controller.ts existe" "PASS" "Cree"
else
  add_row "T10-F2" "Fichier mailgun-webhook.controller.ts existe" "FAIL" "Manquant"
fi
# Test T10-F3: Existence fichier repo/apps/api/src/modules/comm/middleware/mailgun-signature.middleware.ts
if [ -f "repo/apps/api/src/modules/comm/middleware/mailgun-signature.middleware.ts" ]; then
  add_row "T10-F3" "Fichier mailgun-signature.middleware.ts existe" "PASS" "Cree"
else
  add_row "T10-F3" "Fichier mailgun-signature.middleware.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T10-V1: WA webhook : status update sent->delivered->read (P0)
echo "  Verifying T10-V1 : WA webhook : status update sent->delivered->read..."
add_row "T10-V1" "WA webhook : status update sent->delivered->read" "WARN" "(P0) Voir B-09 Tache 3.2.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V2: Mailgun webhook bounce hard : opt-out auto (P0)
echo "  Verifying T10-V2 : Mailgun webhook bounce hard : opt-out auto..."
add_row "T10-V2" "Mailgun webhook bounce hard : opt-out auto" "WARN" "(P0) Voir B-09 Tache 3.2.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V3: Bounce soft : retry pas opt-out (P0)
echo "  Verifying T10-V3 : Bounce soft : retry pas opt-out..."
add_row "T10-V3" "Bounce soft : retry pas opt-out" "WARN" "(P0) Voir B-09 Tache 3.2.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V4: Bounce rate > 5% : Kafka event emit (P0)
echo "  Verifying T10-V4 : Bounce rate > 5% : Kafka event emit..."
add_row "T10-V4" "Bounce rate > 5% : Kafka event emit" "WARN" "(P0) Voir B-09 Tache 3.2.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V5: Stats endpoint retourne aggregates (P0)
echo "  Verifying T10-V5 : Stats endpoint retourne aggregates..."
add_row "T10-V5" "Stats endpoint retourne aggregates" "WARN" "(P0) Voir B-09 Tache 3.2.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V6: Tests 10+ scenarios (P0)
echo "  Verifying T10-V6 : Tests 10+ scenarios..."
add_row "T10-V6" "Tests 10+ scenarios" "WARN" "(P0) Voir B-09 Tache 3.2.10 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 11/8 -- 3.2.11 : Opt-out Management CNDP + Endpoint Public

```bash
echo ""
echo "================================================"
echo "TACHE 3.2.11 : Opt-out Management CNDP + Endpoint Public"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 8"
echo "================================================"

# === Verification fichiers crees ===
# Test T11-F1: Existence fichier repo/packages/comm/src/services/optout.service.ts
if [ -f "repo/packages/comm/src/services/optout.service.ts" ]; then
  add_row "T11-F1" "Fichier optout.service.ts existe" "PASS" "Cree"
else
  add_row "T11-F1" "Fichier optout.service.ts existe" "FAIL" "Manquant"
fi
# Test T11-F2: Existence fichier repo/packages/comm/src/services/optout.service.spec.ts
if [ -f "repo/packages/comm/src/services/optout.service.spec.ts" ]; then
  add_row "T11-F2" "Fichier optout.service.spec.ts existe" "PASS" "Cree"
else
  add_row "T11-F2" "Fichier optout.service.spec.ts existe" "FAIL" "Manquant"
fi
# Test T11-F3: Existence fichier repo/apps/api/src/modules/comm/controllers/optout.controller.ts
if [ -f "repo/apps/api/src/modules/comm/controllers/optout.controller.ts" ]; then
  add_row "T11-F3" "Fichier optout.controller.ts existe" "PASS" "Cree"
else
  add_row "T11-F3" "Fichier optout.controller.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T11-V1: Opt-out token genere + URL fonctionne (P0)
echo "  Verifying T11-V1 : Opt-out token genere + URL fonctionne..."
add_row "T11-V1" "Opt-out token genere + URL fonctionne" "WARN" "(P0) Voir B-09 Tache 3.2.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V2: One-click endpoint works (POST direct) (P0)
echo "  Verifying T11-V2 : One-click endpoint works (POST direct)..."
add_row "T11-V2" "One-click endpoint works (POST direct)" "WARN" "(P0) Voir B-09 Tache 3.2.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V3: STOP keyword WA detecte + auto-opt-out (P0)
echo "  Verifying T11-V3 : STOP keyword WA detecte + auto-opt-out..."
add_row "T11-V3" "STOP keyword WA detecte + auto-opt-out" "WARN" "(P0) Voir B-09 Tache 3.2.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V4: Apres opt-out : message orchestrator skip ce canal (P0)
echo "  Verifying T11-V4 : Apres opt-out : message orchestrator skip ce canal..."
add_row "T11-V4" "Apres opt-out : message orchestrator skip ce canal" "WARN" "(P0) Voir B-09 Tache 3.2.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V5: Lien opt-out injecte tous emails (P0)
echo "  Verifying T11-V5 : Lien opt-out injecte tous emails..."
add_row "T11-V5" "Lien opt-out injecte tous emails" "WARN" "(P0) Voir B-09 Tache 3.2.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V6: Re-opt-in possible mais require explicit (P0)
echo "  Verifying T11-V6 : Re-opt-in possible mais require explicit..."
add_row "T11-V6" "Re-opt-in possible mais require explicit" "WARN" "(P0) Voir B-09 Tache 3.2.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V7: Audit log (P0)
echo "  Verifying T11-V7 : Audit log..."
add_row "T11-V7" "Audit log" "WARN" "(P0) Voir B-09 Tache 3.2.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V8: Tests 10+ scenarios (P0)
echo "  Verifying T11-V8 : Tests 10+ scenarios..."
add_row "T11-V8" "Tests 10+ scenarios" "WARN" "(P0) Voir B-09 Tache 3.2.11 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 12/6 -- 3.2.12 : Endpoints REST /api/v1/comm/*

```bash
echo ""
echo "================================================"
echo "TACHE 3.2.12 : Endpoints REST /api/v1/comm/*"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 6"
echo "================================================"

# === Verification fichiers crees ===
# Test T12-F1: Existence fichier repo/apps/api/src/modules/comm/controllers/messages.controller.ts
if [ -f "repo/apps/api/src/modules/comm/controllers/messages.controller.ts" ]; then
  add_row "T12-F1" "Fichier messages.controller.ts existe" "PASS" "Cree"
else
  add_row "T12-F1" "Fichier messages.controller.ts existe" "FAIL" "Manquant"
fi
# Test T12-F2: Existence fichier repo/apps/api/src/modules/comm/controllers/comm-preferences.controller.ts
if [ -f "repo/apps/api/src/modules/comm/controllers/comm-preferences.controller.ts" ]; then
  add_row "T12-F2" "Fichier comm-preferences.controller.ts existe" "PASS" "Cree"
else
  add_row "T12-F2" "Fichier comm-preferences.controller.ts existe" "FAIL" "Manquant"
fi
# Test T12-F3: Existence fichier repo/apps/api/src/modules/comm/dto/{several}.ts
if [ -f "repo/apps/api/src/modules/comm/dto/{several}.ts" ]; then
  add_row "T12-F3" "Fichier {several}.ts existe" "PASS" "Cree"
else
  add_row "T12-F3" "Fichier {several}.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T12-V1: POST /send orchestrate + retourne messageId (P0)
echo "  Verifying T12-V1 : POST /send orchestrate + retourne messageId..."
add_row "T12-V1" "POST /send orchestrate + retourne messageId" "WARN" "(P0) Voir B-09 Tache 3.2.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V2: GET /messages liste avec filtres (P0)
echo "  Verifying T12-V2 : GET /messages liste avec filtres..."
add_row "T12-V2" "GET /messages liste avec filtres" "WARN" "(P0) Voir B-09 Tache 3.2.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V3: GET /:id/timeline retourne events (P0)
echo "  Verifying T12-V3 : GET /:id/timeline retourne events..."
add_row "T12-V3" "GET /:id/timeline retourne events" "WARN" "(P0) Voir B-09 Tache 3.2.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V4: RBAC + multi-tenant respectes (P0)
echo "  Verifying T12-V4 : RBAC + multi-tenant respectes..."
add_row "T12-V4" "RBAC + multi-tenant respectes" "WARN" "(P0) Voir B-09 Tache 3.2.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V5: Pagination (P0)
echo "  Verifying T12-V5 : Pagination..."
add_row "T12-V5" "Pagination" "WARN" "(P0) Voir B-09 Tache 3.2.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V6: Tests E2E 10+ scenarios (P1)
echo "  Verifying T12-V6 : Tests E2E 10+ scenarios..."
add_row "T12-V6" "Tests E2E 10+ scenarios" "WARN" "(P1) Voir B-09 Tache 3.2.12 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 13/5 -- 3.2.13 : Tests E2E Exhaustifs (40+) + Mocks

```bash
echo ""
echo "================================================"
echo "TACHE 3.2.13 : Tests E2E Exhaustifs (40+) + Mocks"
echo "Priorite : P0 | Effort : 8h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T13-F1: Existence fichier repo/apps/api/test/comm/{40+ specs}.e2e-spec.ts
if [ -f "repo/apps/api/test/comm/{40+ specs}.e2e-spec.ts" ]; then
  add_row "T13-F1" "Fichier {40+ specs}.e2e-spec.ts existe" "PASS" "Cree"
else
  add_row "T13-F1" "Fichier {40+ specs}.e2e-spec.ts existe" "FAIL" "Manquant"
fi
# Test T13-F2: Existence fichier repo/apps/api/test/comm/fixtures/comm-test-helpers.ts
if [ -f "repo/apps/api/test/comm/fixtures/comm-test-helpers.ts" ]; then
  add_row "T13-F2" "Fichier comm-test-helpers.ts existe" "PASS" "Cree"
else
  add_row "T13-F2" "Fichier comm-test-helpers.ts existe" "FAIL" "Manquant"
fi
# Test T13-F3: Existence fichier repo/apps/api/test/comm/fixtures/mock-meta-server.ts
if [ -f "repo/apps/api/test/comm/fixtures/mock-meta-server.ts" ]; then
  add_row "T13-F3" "Fichier mock-meta-server.ts existe" "PASS" "Cree"
else
  add_row "T13-F3" "Fichier mock-meta-server.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T13-V1: 40+ tests passent (P0)
echo "  Verifying T13-V1 : 40+ tests passent..."
add_row "T13-V1" "40+ tests passent" "WARN" "(P0) Voir B-09 Tache 3.2.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V2: Tests passent CI (P0)
echo "  Verifying T13-V2 : Tests passent CI..."
add_row "T13-V2" "Tests passent CI" "WARN" "(P0) Voir B-09 Tache 3.2.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V3: Mocks Meta + Mailhog fonctionnent (P0)
echo "  Verifying T13-V3 : Mocks Meta + Mailhog fonctionnent..."
add_row "T13-V3" "Mocks Meta + Mailhog fonctionnent" "WARN" "(P0) Voir B-09 Tache 3.2.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V4: Coverage : tous flows comm testees (P0)
echo "  Verifying T13-V4 : Coverage : tous flows comm testees..."
add_row "T13-V4" "Coverage : tous flows comm testees" "WARN" "(P0) Voir B-09 Tache 3.2.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V5: Reproducibility 5x runs (P0)
echo "  Verifying T13-V5 : Reproducibility 5x runs..."
add_row "T13-V5" "Reproducibility 5x runs" "WARN" "(P0) Voir B-09 Tache 3.2.13 pour test detaille - critere a auto-tester via script ad-hoc"

```

---


---


## VERIFICATIONS TRANSVERSALES SPRINT 9

### TR-BUILD : Build complet du sprint

```bash
echo ""
echo "================================================"
echo "VERIFICATIONS TRANSVERSALES SPRINT 9"
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

### TR-MIGRATIONS : Migrations DB Sprint 9

```bash
echo "=== TR-MIGRATIONS : Migrations DB ==="
MIGR_COUNT=$(pg_query "SELECT COUNT(*) FROM migrations WHERE name LIKE '%sprint09%' OR name LIKE '%Sprint09%'" || echo 0)
if [ "$MIGR_COUNT" -gt 0 ]; then
  add_row "TR-MIG" "Migrations Sprint 9 appliquees" "PASS" "$MIGR_COUNT migrations"
else
  add_row "TR-MIG" "Migrations Sprint 9 appliquees" "WARN" "Aucune migration detectee (verifier)"
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
echo "GENERATION DU RAPPORT FINAL SPRINT 9"
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

## Jalon GO/NO-GO Sprint 9

EOF

# Calcul statut final
if (( $(echo "$SCORE >= 95" | bc -l) )); then
  STATUT="GO"
  cat >> "$REPORT_FILE" << EOF
**STATUT** : GO -- Sprint 9 valide, passage Sprint 10 autorise

Le sprint a passe les criteres requis. Cowork peut demarrer Sprint 10.

EOF
  echo ""
  echo "================================================"
  echo "SPRINT 9 : GO ($SCORE%)"
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
  echo "SPRINT 9 : GO CONDITIONNEL ($SCORE%)"
  echo "================================================"
else
  STATUT="NO-GO"
  cat >> "$REPORT_FILE" << EOF
**STATUT** : NO-GO -- Score $SCORE% trop bas (cible 85% minimum)

Le sprint **doit etre repris** :
- Lister tous FAIL P0
- Escalation Saad/Abla decision (cut scope OR delai)
- Reprise sprint avant Sprint 10

EOF
  echo ""
  echo "================================================"
  echo "SPRINT 9 : NO-GO ($SCORE%)"
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
  echo "git commit -m \"chore(sprint-09): close sprint 9 -- $STATUT ($SCORE%)\"" >> "$REPORT_FILE"
  echo '```' >> "$REPORT_FILE"
fi

echo ""
echo "Rapport complet dans : $REPORT_FILE"
```

---

## INSTRUCTION FINALE A CLAUDE CODE / COWORK

Apres l'execution complete des verifications ci-dessus :

1. **Lis le contenu de `sprint09-verify-report.md`** integralement
2. **Identifie les FAIL critiques** (criteres P0) qui necessitent intervention manuelle
3. **Affiche un resume executif** :
   - Nombre total de criteres
   - Pourcentage PASS / PASS\* / FAIL / WARN
   - Liste des FAIL avec contexte technique
   - Recommandation : GO / GO CONDITIONNEL / NO-GO
4. **Si NO-GO** : ne pas demarrer le Sprint suivant, alerter Saad/Abla via Slack `#insurtech-dev`
5. **Si GO ou GO CONDITIONNEL** : produire le commit de cloture du sprint :

```bash
git add skalean-insurtech/sprint09-verify-report.md
git commit -m "chore(sprint-09): close sprint 9 with verification report

- Verification automatique executee
- Score global : <SCORE>%
- <PASS> criteres PASS, <PASS_REPAIRED> reparations auto, <FAIL> FAIL
- Statut : <GO|GO CONDITIONNEL|NO-GO>

Phase: 3 -- Modules Horizontaux
Sprint: 9 (Phase 3 / Sprint 2)
Reference B-09, C-09, V-09
Report: sprint09-verify-report.md"
```

6. **Documentation continue** : si decisions techniques prises pendant verification, ajouter notes dans `repo/docs/runbooks/sprint-09-lessons-learned.md`

---

**Fin de la verification V-09 v2.2 detaillee -- Sprint 9 (3.2) Comm WhatsApp + Email.**

**Total criteres taches** : 90 | **Total transversaux** : ~10 | **Effort sprint** : 75h
