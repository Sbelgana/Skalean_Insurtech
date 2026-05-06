# VERIFICATION SPRINT 31 -- Phase 7 / Sprint 3 : Agent Sky Multilingue (4 langues -- 4 apps)
# Version : Auto-reparation active + Rapport final MD detaille
# 13 taches, 57 criteres extraits B-31
# AUCUNE EMOJI AUTORISEE

**Version** : v2.2 (verification detaillee)
**Phase** : 7 -- Hardening + Integrations + Pilote
**Sprint** : 31 / 35 (cumul) -- Sprint 3 dans Phase 7
**Reference meta-prompt** : `B-31-sprint-31-agent-sky.md`
**Reference orchestrateur** : `C-31-sprint-31-agent-sky.md`
**Total criteres** : 57 criteres taches + ~10 transversaux

---

Tu es **Claude Code (ou Cowork)**. Tu dois executer une **verification COMPLETE et EXHAUSTIVE** du Sprint 31 apres execution toutes les 13 taches.

---

## REGLES D'EXECUTION

1. Tu **executes CHAQUE verification dans l'ordre** (taches puis transversales)
2. Quand une verification echoue, tu **TENTES UNE REPARATION AUTOMATIQUE** avant de noter FAIL
3. Apres chaque tentative de reparation, tu **re-executes la verification**
4. Tu consignes dans `sprint31-verify-report.md` **TOUS les resultats** au fil de l'execution
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
REPORT_FILE="sprint31-verify-report.md"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
RUN_ID=$(date '+%Y%m%d-%H%M%S')

cat > "$REPORT_FILE" << EOF
# Rapport de Verification - Sprint 31 : Agent Sky Multilingue (4 langues -- 4 apps)

**Date** : $TIMESTAMP
**Run ID** : $RUN_ID
**Phase** : 7 -- Hardening + Integrations + Pilote
**Sprint** : 31 (Phase 7 / Sprint 3)
**Reference B-31** : 13 taches, 57 criteres extraits
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

## TACHE 1/5 -- 7.3.1 : Backend Sky Orchestrator + MCP Client

```bash
echo ""
echo "================================================"
echo "TACHE 7.3.1 : Backend Sky Orchestrator + MCP Client"
echo "Priorite : P0 | Effort : 7h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T01-F2: Existence fichier repo/packages/sky/src/services/sky-orchestrator.service.ts
if [ -f "repo/packages/sky/src/services/sky-orchestrator.service.ts" ]; then
  add_row "T01-F2" "Fichier sky-orchestrator.service.ts existe" "PASS" "Cree"
else
  add_row "T01-F2" "Fichier sky-orchestrator.service.ts existe" "FAIL" "Manquant"
fi
# Test T01-F3: Existence fichier repo/packages/sky/src/services/mcp-client.service.ts
if [ -f "repo/packages/sky/src/services/mcp-client.service.ts" ]; then
  add_row "T01-F3" "Fichier mcp-client.service.ts existe" "PASS" "Cree"
else
  add_row "T01-F3" "Fichier mcp-client.service.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T01-V1: Endpoint chat + streaming (P0)
echo "  Verifying T01-V1 : Endpoint chat + streaming..."
add_row "T01-V1" "Endpoint chat + streaming" "WARN" "(P0) Voir B-31 Tache 7.3.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V2: MCP client integration (P0)
echo "  Verifying T01-V2 : MCP client integration..."
add_row "T01-V2" "MCP client integration" "WARN" "(P0) Voir B-31 Tache 7.3.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V3: Tool calling loop functional (P0)
echo "  Verifying T01-V3 : Tool calling loop functional..."
add_row "T01-V3" "Tool calling loop functional" "WARN" "(P0) Voir B-31 Tache 7.3.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V4: Max iterations safety (P0)
echo "  Verifying T01-V4 : Max iterations safety..."
add_row "T01-V4" "Max iterations safety" "WARN" "(P0) Voir B-31 Tache 7.3.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V5: Tests 8+ scenarios (P0)
echo "  Verifying T01-V5 : Tests 8+ scenarios..."
add_row "T01-V5" "Tests 8+ scenarios" "WARN" "(P0) Voir B-31 Tache 7.3.1 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 2/3 -- 7.3.2 : System Prompts Multilingues Per App

```bash
echo ""
echo "================================================"
echo "TACHE 7.3.2 : System Prompts Multilingues Per App"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 3"
echo "================================================"

# === Verification fichiers crees ===
# Test T02-F1: Existence fichier repo/packages/sky/src/prompts/{web-broker,web-garage,web-customer-portal}-{fr,ar-MA,ar,en}.md
if [ -f "repo/packages/sky/src/prompts/{web-broker,web-garage,web-customer-portal}-{fr,ar-MA,ar,en}.md" ]; then
  add_row "T02-F1" "Fichier {web-broker,web-garage,web-customer-portal}-{fr,ar-MA,ar,en}.md existe" "PASS" "Cree"
else
  add_row "T02-F1" "Fichier {web-broker,web-garage,web-customer-portal}-{fr,ar-MA,ar,en}.md existe" "FAIL" "Manquant"
fi
# Test T02-F2: Existence fichier repo/packages/sky/src/services/system-prompts.service.ts
if [ -f "repo/packages/sky/src/services/system-prompts.service.ts" ]; then
  add_row "T02-F2" "Fichier system-prompts.service.ts existe" "PASS" "Cree"
else
  add_row "T02-F2" "Fichier system-prompts.service.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T02-V1: 12 prompts disponibles (P0)
echo "  Verifying T02-V1 : 12 prompts disponibles..."
add_row "T02-V1" "12 prompts disponibles" "WARN" "(P0) Voir B-31 Tache 7.3.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V2: Service compose correctement (P0)
echo "  Verifying T02-V2 : Service compose correctement..."
add_row "T02-V2" "Service compose correctement" "WARN" "(P0) Voir B-31 Tache 7.3.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V3: Tests 5+ scenarios (P0)
echo "  Verifying T02-V3 : Tests 5+ scenarios..."
add_row "T02-V3" "Tests 5+ scenarios" "WARN" "(P0) Voir B-31 Tache 7.3.2 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 3/5 -- 7.3.3 : MCP Tool Calling : Agent Loop

```bash
echo ""
echo "================================================"
echo "TACHE 7.3.3 : MCP Tool Calling : Agent Loop"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T03-F1: Existence fichier repo/packages/sky/src/services/agent-loop.service.ts
if [ -f "repo/packages/sky/src/services/agent-loop.service.ts" ]; then
  add_row "T03-F1" "Fichier agent-loop.service.ts existe" "PASS" "Cree"
else
  add_row "T03-F1" "Fichier agent-loop.service.ts existe" "FAIL" "Manquant"
fi
# Test T03-F2: Existence fichier repo/packages/sky/src/services/tool-permissions.service.ts
if [ -f "repo/packages/sky/src/services/tool-permissions.service.ts" ]; then
  add_row "T03-F2" "Fichier tool-permissions.service.ts existe" "PASS" "Cree"
else
  add_row "T03-F2" "Fichier tool-permissions.service.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T03-V1: Tool selection automatic (P0)
echo "  Verifying T03-V1 : Tool selection automatic..."
add_row "T03-V1" "Tool selection automatic" "WARN" "(P0) Voir B-31 Tache 7.3.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V2: Whitelist per app + role (P0)
echo "  Verifying T03-V2 : Whitelist per app + role..."
add_row "T03-V2" "Whitelist per app + role" "WARN" "(P0) Voir B-31 Tache 7.3.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V3: Safety max iterations + timeout (P0)
echo "  Verifying T03-V3 : Safety max iterations + timeout..."
add_row "T03-V3" "Safety max iterations + timeout" "WARN" "(P0) Voir B-31 Tache 7.3.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V4: Error handling graceful (P0)
echo "  Verifying T03-V4 : Error handling graceful..."
add_row "T03-V4" "Error handling graceful" "WARN" "(P0) Voir B-31 Tache 7.3.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V5: Tests 10+ scenarios (P0)
echo "  Verifying T03-V5 : Tests 10+ scenarios..."
add_row "T03-V5" "Tests 10+ scenarios" "WARN" "(P0) Voir B-31 Tache 7.3.3 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 4/5 -- 7.3.4 : Conversations Persistance

```bash
echo ""
echo "================================================"
echo "TACHE 7.3.4 : Conversations Persistance"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T04-F1: Existence fichier repo/packages/database/src/migrations/{date}-SkyConversations.ts
if [ -f "repo/packages/database/src/migrations/{date}-SkyConversations.ts" ]; then
  add_row "T04-F1" "Fichier {date}-SkyConversations.ts existe" "PASS" "Cree"
else
  add_row "T04-F1" "Fichier {date}-SkyConversations.ts existe" "FAIL" "Manquant"
fi
# Test T04-F2: Existence fichier repo/packages/database/src/migrations/{date}-SkyMessages.ts
if [ -f "repo/packages/database/src/migrations/{date}-SkyMessages.ts" ]; then
  add_row "T04-F2" "Fichier {date}-SkyMessages.ts existe" "PASS" "Cree"
else
  add_row "T04-F2" "Fichier {date}-SkyMessages.ts existe" "FAIL" "Manquant"
fi
# Test T04-F3: Existence fichier repo/packages/sky/src/entities/{2 entities}.ts
if [ -f "repo/packages/sky/src/entities/{2 entities}.ts" ]; then
  add_row "T04-F3" "Fichier {2 entities}.ts existe" "PASS" "Cree"
else
  add_row "T04-F3" "Fichier {2 entities}.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T04-V1: Conversations persisted (P0)
echo "  Verifying T04-V1 : Conversations persisted..."
add_row "T04-V1" "Conversations persisted" "WARN" "(P0) Voir B-31 Tache 7.3.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V2: History retrieval (P0)
echo "  Verifying T04-V2 : History retrieval..."
add_row "T04-V2" "History retrieval" "WARN" "(P0) Voir B-31 Tache 7.3.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V3: Cleanup retention (P0)
echo "  Verifying T04-V3 : Cleanup retention..."
add_row "T04-V3" "Cleanup retention" "WARN" "(P0) Voir B-31 Tache 7.3.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V4: Permissions own only (P0)
echo "  Verifying T04-V4 : Permissions own only..."
add_row "T04-V4" "Permissions own only" "WARN" "(P0) Voir B-31 Tache 7.3.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V5: Tests 6+ scenarios (P0)
echo "  Verifying T04-V5 : Tests 6+ scenarios..."
add_row "T04-V5" "Tests 6+ scenarios" "WARN" "(P0) Voir B-31 Tache 7.3.4 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 5/4 -- 7.3.5 : Chat Widget UI Shared Package

```bash
echo ""
echo "================================================"
echo "TACHE 7.3.5 : Chat Widget UI Shared Package"
echo "Priorite : P0 | Effort : 7h"
echo "Criteres a verifier : 4"
echo "================================================"

# === Verification fichiers crees ===
# Test T05-F2: Existence fichier repo/packages/sky-ui/src/components/sky-chat-widget.tsx
if [ -f "repo/packages/sky-ui/src/components/sky-chat-widget.tsx" ]; then
  add_row "T05-F2" "Fichier sky-chat-widget.tsx existe" "PASS" "Cree"
else
  add_row "T05-F2" "Fichier sky-chat-widget.tsx existe" "FAIL" "Manquant"
fi
# Test T05-F3: Existence fichier repo/packages/sky-ui/src/components/{several sub-components}.tsx
if [ -f "repo/packages/sky-ui/src/components/{several sub-components}.tsx" ]; then
  add_row "T05-F3" "Fichier {several sub-components}.tsx existe" "PASS" "Cree"
else
  add_row "T05-F3" "Fichier {several sub-components}.tsx existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T05-V1: Widget integrable (P0)
echo "  Verifying T05-V1 : Widget integrable..."
add_row "T05-V1" "Widget integrable" "WARN" "(P0) Voir B-31 Tache 7.3.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V2: Streaming display (P0)
echo "  Verifying T05-V2 : Streaming display..."
add_row "T05-V2" "Streaming display" "WARN" "(P0) Voir B-31 Tache 7.3.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V3: Markdown render (P0)
echo "  Verifying T05-V3 : Markdown render..."
add_row "T05-V3" "Markdown render" "WARN" "(P0) Voir B-31 Tache 7.3.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V4: Tests Storybook 8+ scenarios (P0)
echo "  Verifying T05-V4 : Tests Storybook 8+ scenarios..."
add_row "T05-V4" "Tests Storybook 8+ scenarios" "WARN" "(P0) Voir B-31 Tache 7.3.5 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 6/4 -- 7.3.6 : Integration web-broker + I18n

```bash
echo ""
echo "================================================"
echo "TACHE 7.3.6 : Integration web-broker + I18n"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 4"
echo "================================================"

# === Verification fichiers crees ===
# Test T06-F1: Existence fichier repo/apps/web-broker/app/[locale]/(protected)/layout.tsx
if [ -f "repo/apps/web-broker/app/[locale]/(protected)/layout.tsx" ]; then
  add_row "T06-F1" "Fichier layout.tsx existe" "PASS" "Cree"
else
  add_row "T06-F1" "Fichier layout.tsx existe" "FAIL" "Manquant"
fi
# Test T06-F2: Existence fichier repo/apps/web-broker/messages/{fr,ar-MA,ar,en}.json
if [ -f "repo/apps/web-broker/messages/{fr,ar-MA,ar,en}.json" ]; then
  add_row "T06-F2" "Fichier {fr,ar-MA,ar,en}.json existe" "PASS" "Cree"
else
  add_row "T06-F2" "Fichier {fr,ar-MA,ar,en}.json existe" "FAIL" "Manquant"
fi
# Test T06-F3: Existence fichier repo/apps/web-broker/components/sky/quick-suggestions-broker.tsx
if [ -f "repo/apps/web-broker/components/sky/quick-suggestions-broker.tsx" ]; then
  add_row "T06-F3" "Fichier quick-suggestions-broker.tsx existe" "PASS" "Cree"
else
  add_row "T06-F3" "Fichier quick-suggestions-broker.tsx existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T06-V1: Widget integre (P0)
echo "  Verifying T06-V1 : Widget integre..."
add_row "T06-V1" "Widget integre" "WARN" "(P0) Voir B-31 Tache 7.3.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V2: Quick suggestions per locale (P0)
echo "  Verifying T06-V2 : Quick suggestions per locale..."
add_row "T06-V2" "Quick suggestions per locale" "WARN" "(P0) Voir B-31 Tache 7.3.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V3: RTL position correct (P0)
echo "  Verifying T06-V3 : RTL position correct..."
add_row "T06-V3" "RTL position correct" "WARN" "(P0) Voir B-31 Tache 7.3.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V4: Tests 5+ scenarios (P0)
echo "  Verifying T06-V4 : Tests 5+ scenarios..."
add_row "T06-V4" "Tests 5+ scenarios" "WARN" "(P0) Voir B-31 Tache 7.3.6 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 7/3 -- 7.3.7 : Integration web-garage + Role-Specific Suggestions

```bash
echo ""
echo "================================================"
echo "TACHE 7.3.7 : Integration web-garage + Role-Specific Suggestions"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 3"
echo "================================================"

# === Verification fichiers crees ===
# Test T07-F1: Existence fichier repo/apps/web-garage/app/[locale]/(protected)/layout.tsx
if [ -f "repo/apps/web-garage/app/[locale]/(protected)/layout.tsx" ]; then
  add_row "T07-F1" "Fichier layout.tsx existe" "PASS" "Cree"
else
  add_row "T07-F1" "Fichier layout.tsx existe" "FAIL" "Manquant"
fi
# Test T07-F2: Existence fichier repo/apps/web-garage/messages/{fr,ar-MA,ar,en}.json
if [ -f "repo/apps/web-garage/messages/{fr,ar-MA,ar,en}.json" ]; then
  add_row "T07-F2" "Fichier {fr,ar-MA,ar,en}.json existe" "PASS" "Cree"
else
  add_row "T07-F2" "Fichier {fr,ar-MA,ar,en}.json existe" "FAIL" "Manquant"
fi
# Test T07-F3: Existence fichier repo/apps/web-garage/components/sky/quick-suggestions-garage.tsx
if [ -f "repo/apps/web-garage/components/sky/quick-suggestions-garage.tsx" ]; then
  add_row "T07-F3" "Fichier quick-suggestions-garage.tsx existe" "PASS" "Cree"
else
  add_row "T07-F3" "Fichier quick-suggestions-garage.tsx existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T07-V1: Widget integre 4 roles (P0)
echo "  Verifying T07-V1 : Widget integre 4 roles..."
add_row "T07-V1" "Widget integre 4 roles" "WARN" "(P0) Voir B-31 Tache 7.3.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V2: Suggestions per role (P0)
echo "  Verifying T07-V2 : Suggestions per role..."
add_row "T07-V2" "Suggestions per role" "WARN" "(P0) Voir B-31 Tache 7.3.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V3: Tests 5+ scenarios (P0)
echo "  Verifying T07-V3 : Tests 5+ scenarios..."
add_row "T07-V3" "Tests 5+ scenarios" "WARN" "(P0) Voir B-31 Tache 7.3.7 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 8/4 -- 7.3.8 : Integration web-customer-portal + Onboarding Adapted

```bash
echo ""
echo "================================================"
echo "TACHE 7.3.8 : Integration web-customer-portal + Onboarding Adapted"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 4"
echo "================================================"

# === Verification fichiers crees ===
# Test T08-F1: Existence fichier repo/apps/web-customer-portal/app/[locale]/layout.tsx
if [ -f "repo/apps/web-customer-portal/app/[locale]/layout.tsx" ]; then
  add_row "T08-F1" "Fichier layout.tsx existe" "PASS" "Cree"
else
  add_row "T08-F1" "Fichier layout.tsx existe" "FAIL" "Manquant"
fi
# Test T08-F2: Existence fichier repo/apps/web-customer-portal/messages/{fr,ar-MA,ar,en}.json
if [ -f "repo/apps/web-customer-portal/messages/{fr,ar-MA,ar,en}.json" ]; then
  add_row "T08-F2" "Fichier {fr,ar-MA,ar,en}.json existe" "PASS" "Cree"
else
  add_row "T08-F2" "Fichier {fr,ar-MA,ar,en}.json existe" "FAIL" "Manquant"
fi
# Test T08-F3: Existence fichier repo/apps/web-customer-portal/components/sky/onboarding-popup.tsx
if [ -f "repo/apps/web-customer-portal/components/sky/onboarding-popup.tsx" ]; then
  add_row "T08-F3" "Fichier onboarding-popup.tsx existe" "PASS" "Cree"
else
  add_row "T08-F3" "Fichier onboarding-popup.tsx existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T08-V1: Widget integre customer (P0)
echo "  Verifying T08-V1 : Widget integre customer..."
add_row "T08-V1" "Widget integre customer" "WARN" "(P0) Voir B-31 Tache 7.3.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V2: Tools whitelist customer-context (P0)
echo "  Verifying T08-V2 : Tools whitelist customer-context..."
add_row "T08-V2" "Tools whitelist customer-context" "WARN" "(P0) Voir B-31 Tache 7.3.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V3: Onboarding popup (P0)
echo "  Verifying T08-V3 : Onboarding popup..."
add_row "T08-V3" "Onboarding popup" "WARN" "(P0) Voir B-31 Tache 7.3.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V4: Tests 5+ scenarios (P0)
echo "  Verifying T08-V4 : Tests 5+ scenarios..."
add_row "T08-V4" "Tests 5+ scenarios" "WARN" "(P0) Voir B-31 Tache 7.3.8 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 9/6 -- 7.3.8b : Integration web-assure-portal + Suggestions Assure Post-Souscription

```bash
echo ""
echo "================================================"
echo "TACHE 7.3.8b : Integration web-assure-portal + Suggestions Assure Post-Sous"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 6"
echo "================================================"

# === Verification fichiers crees ===
# Test T09-F1: Existence fichier repo/apps/web-assure-portal/app/[locale]/(protected)/layout.tsx
if [ -f "repo/apps/web-assure-portal/app/[locale]/(protected)/layout.tsx" ]; then
  add_row "T09-F1" "Fichier layout.tsx existe" "PASS" "Cree"
else
  add_row "T09-F1" "Fichier layout.tsx existe" "FAIL" "Manquant"
fi
# Test T09-F2: Existence fichier repo/apps/web-assure-portal/messages/{fr,ar-MA,ar,en}.json
if [ -f "repo/apps/web-assure-portal/messages/{fr,ar-MA,ar,en}.json" ]; then
  add_row "T09-F2" "Fichier {fr,ar-MA,ar,en}.json existe" "PASS" "Cree"
else
  add_row "T09-F2" "Fichier {fr,ar-MA,ar,en}.json existe" "FAIL" "Manquant"
fi
# Test T09-F3: Existence fichier repo/apps/web-assure-portal/components/sky/quick-suggestions-assure.tsx
if [ -f "repo/apps/web-assure-portal/components/sky/quick-suggestions-assure.tsx" ]; then
  add_row "T09-F3" "Fichier quick-suggestions-assure.tsx existe" "PASS" "Cree"
else
  add_row "T09-F3" "Fichier quick-suggestions-assure.tsx existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T09-V1: Widget integre web-assure-portal layout (P0)
echo "  Verifying T09-V1 : Widget integre web-assure-portal layout..."
add_row "T09-V1" "Widget integre web-assure-portal layout" "WARN" "(P0) Voir B-31 Tache 7.3.8b pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V2: Tools whitelist assure-context (read-only own resources) (P0)
echo "  Verifying T09-V2 : Tools whitelist assure-context (read-only own resources)..."
add_row "T09-V2" "Tools whitelist assure-context (read-only own resources)" "WARN" "(P0) Voir B-31 Tache 7.3.8b pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V3: Onboarding popup (P0)
echo "  Verifying T09-V3 : Onboarding popup..."
add_row "T09-V3" "Onboarding popup" "WARN" "(P0) Voir B-31 Tache 7.3.8b pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V4: System prompt 4 locales empathique (P0)
echo "  Verifying T09-V4 : System prompt 4 locales empathique..."
add_row "T09-V4" "System prompt 4 locales empathique" "WARN" "(P0) Voir B-31 Tache 7.3.8b pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V5: ABAC verification : assure ne peut pas accéder polices/sinistres autres users (P0)
echo "  Verifying T09-V5 : ABAC verification : assure ne peut pas accéder polices/sinistres autre..."
add_row "T09-V5" "ABAC verification : assure ne peut pas accéder polices/sinistres autres users" "WARN" "(P0) Voir B-31 Tache 7.3.8b pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V6: Tests 5+ scenarios (P0)
echo "  Verifying T09-V6 : Tests 5+ scenarios..."
add_row "T09-V6" "Tests 5+ scenarios" "WARN" "(P0) Voir B-31 Tache 7.3.8b pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 10/5 -- 7.3.9 : Confirmation Modals Write Tools

```bash
echo ""
echo "================================================"
echo "TACHE 7.3.9 : Confirmation Modals Write Tools"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T10-F1: Existence fichier repo/packages/sky-ui/src/components/confirmation-modal.tsx
if [ -f "repo/packages/sky-ui/src/components/confirmation-modal.tsx" ]; then
  add_row "T10-F1" "Fichier confirmation-modal.tsx existe" "PASS" "Cree"
else
  add_row "T10-F1" "Fichier confirmation-modal.tsx existe" "FAIL" "Manquant"
fi
# Test T10-F2: Existence fichier repo/packages/sky-ui/src/hooks/use-sky-chat.ts
if [ -f "repo/packages/sky-ui/src/hooks/use-sky-chat.ts" ]; then
  add_row "T10-F2" "Fichier use-sky-chat.ts existe" "PASS" "Cree"
else
  add_row "T10-F2" "Fichier use-sky-chat.ts existe" "FAIL" "Manquant"
fi
# Test T10-F3: Existence fichier repo/packages/sky/src/services/agent-loop.service.ts
if [ -f "repo/packages/sky/src/services/agent-loop.service.ts" ]; then
  add_row "T10-F3" "Fichier agent-loop.service.ts existe" "PASS" "Cree"
else
  add_row "T10-F3" "Fichier agent-loop.service.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T10-V1: Modal display (P0)
echo "  Verifying T10-V1 : Modal display..."
add_row "T10-V1" "Modal display" "WARN" "(P0) Voir B-31 Tache 7.3.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V2: Confirm/Cancel flow (P0)
echo "  Verifying T10-V2 : Confirm/Cancel flow..."
add_row "T10-V2" "Confirm/Cancel flow" "WARN" "(P0) Voir B-31 Tache 7.3.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V3: Idempotency Key (P0)
echo "  Verifying T10-V3 : Idempotency Key..."
add_row "T10-V3" "Idempotency Key" "WARN" "(P0) Voir B-31 Tache 7.3.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V4: Audit logged (P0)
echo "  Verifying T10-V4 : Audit logged..."
add_row "T10-V4" "Audit logged" "WARN" "(P0) Voir B-31 Tache 7.3.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V5: Tests 6+ scenarios (P0)
echo "  Verifying T10-V5 : Tests 6+ scenarios..."
add_row "T10-V5" "Tests 6+ scenarios" "WARN" "(P0) Voir B-31 Tache 7.3.9 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 11/5 -- 7.3.10 : Voice-to-Text + Analytics Dashboard

```bash
echo ""
echo "================================================"
echo "TACHE 7.3.10 : Voice-to-Text + Analytics Dashboard"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T11-F1: Existence fichier repo/packages/sky-ui/src/components/voice-input-button.tsx
if [ -f "repo/packages/sky-ui/src/components/voice-input-button.tsx" ]; then
  add_row "T11-F1" "Fichier voice-input-button.tsx existe" "PASS" "Cree"
else
  add_row "T11-F1" "Fichier voice-input-button.tsx existe" "FAIL" "Manquant"
fi
# Test T11-F2: Existence fichier repo/packages/database/src/migrations/{date}-SkySatisfactionRatings.ts
if [ -f "repo/packages/database/src/migrations/{date}-SkySatisfactionRatings.ts" ]; then
  add_row "T11-F2" "Fichier {date}-SkySatisfactionRatings.ts existe" "PASS" "Cree"
else
  add_row "T11-F2" "Fichier {date}-SkySatisfactionRatings.ts existe" "FAIL" "Manquant"
fi
# Test T11-F3: Existence fichier repo/packages/sky/src/services/sky-analytics.service.ts
if [ -f "repo/packages/sky/src/services/sky-analytics.service.ts" ]; then
  add_row "T11-F3" "Fichier sky-analytics.service.ts existe" "PASS" "Cree"
else
  add_row "T11-F3" "Fichier sky-analytics.service.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T11-V1: Voice-to-text fr/ar (P0)
echo "  Verifying T11-V1 : Voice-to-text fr/ar..."
add_row "T11-V1" "Voice-to-text fr/ar" "WARN" "(P0) Voir B-31 Tache 7.3.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V2: Fallback typing (P0)
echo "  Verifying T11-V2 : Fallback typing..."
add_row "T11-V2" "Fallback typing" "WARN" "(P0) Voir B-31 Tache 7.3.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V3: Analytics dashboard (P0)
echo "  Verifying T11-V3 : Analytics dashboard..."
add_row "T11-V3" "Analytics dashboard" "WARN" "(P0) Voir B-31 Tache 7.3.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V4: Satisfaction ratings (P0)
echo "  Verifying T11-V4 : Satisfaction ratings..."
add_row "T11-V4" "Satisfaction ratings" "WARN" "(P0) Voir B-31 Tache 7.3.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V5: Tests 6+ scenarios (P0)
echo "  Verifying T11-V5 : Tests 6+ scenarios..."
add_row "T11-V5" "Tests 6+ scenarios" "WARN" "(P0) Voir B-31 Tache 7.3.10 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 12/3 -- 7.3.11 : Documentation + Onboarding Users + Best Prompts

```bash
echo ""
echo "================================================"
echo "TACHE 7.3.11 : Documentation + Onboarding Users + Best Prompts"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 3"
echo "================================================"

# === Verification fichiers crees ===
# Test T12-F1: Existence fichier repo/docs/sky-architecture.md
if [ -f "repo/docs/sky-architecture.md" ]; then
  add_row "T12-F1" "Fichier sky-architecture.md existe" "PASS" "Cree"
else
  add_row "T12-F1" "Fichier sky-architecture.md existe" "FAIL" "Manquant"
fi
# Test T12-F2: Existence fichier repo/docs/sky-user-guide-{broker,garage,customer}.md
if [ -f "repo/docs/sky-user-guide-{broker,garage,customer}.md" ]; then
  add_row "T12-F2" "Fichier sky-user-guide-{broker,garage,customer}.md existe" "PASS" "Cree"
else
  add_row "T12-F2" "Fichier sky-user-guide-{broker,garage,customer}.md existe" "FAIL" "Manquant"
fi
# Test T12-F3: Existence fichier repo/docs/sky-best-prompts-catalog.md
if [ -f "repo/docs/sky-best-prompts-catalog.md" ]; then
  add_row "T12-F3" "Fichier sky-best-prompts-catalog.md existe" "PASS" "Cree"
else
  add_row "T12-F3" "Fichier sky-best-prompts-catalog.md existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T12-V1: 5 documents complets (P0)
echo "  Verifying T12-V1 : 5 documents complets..."
add_row "T12-V1" "5 documents complets" "WARN" "(P0) Voir B-31 Tache 7.3.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V2: Prompts catalog 4 langues (P0)
echo "  Verifying T12-V2 : Prompts catalog 4 langues..."
add_row "T12-V2" "Prompts catalog 4 langues" "WARN" "(P0) Voir B-31 Tache 7.3.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V3: User-friendly guides (P0)
echo "  Verifying T12-V3 : User-friendly guides..."
add_row "T12-V3" "User-friendly guides" "WARN" "(P0) Voir B-31 Tache 7.3.11 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 13/5 -- 7.3.12 : Tests E2E + WCAG + Lighthouse

```bash
echo ""
echo "================================================"
echo "TACHE 7.3.12 : Tests E2E + WCAG + Lighthouse"
echo "Priorite : P0 | Effort : 9h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T13-F1: Existence fichier repo/apps/web-broker/e2e/sky/{several specs}.spec.ts
if [ -f "repo/apps/web-broker/e2e/sky/{several specs}.spec.ts" ]; then
  add_row "T13-F1" "Fichier {several specs}.spec.ts existe" "PASS" "Cree"
else
  add_row "T13-F1" "Fichier {several specs}.spec.ts existe" "FAIL" "Manquant"
fi
# Test T13-F2: Existence fichier repo/apps/web-garage/e2e/sky/{several specs}.spec.ts
if [ -f "repo/apps/web-garage/e2e/sky/{several specs}.spec.ts" ]; then
  add_row "T13-F2" "Fichier {several specs}.spec.ts existe" "PASS" "Cree"
else
  add_row "T13-F2" "Fichier {several specs}.spec.ts existe" "FAIL" "Manquant"
fi
# Test T13-F3: Existence fichier repo/apps/web-customer-portal/e2e/sky/{several specs}.spec.ts
if [ -f "repo/apps/web-customer-portal/e2e/sky/{several specs}.spec.ts" ]; then
  add_row "T13-F3" "Fichier {several specs}.spec.ts existe" "PASS" "Cree"
else
  add_row "T13-F3" "Fichier {several specs}.spec.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T13-V1: 15+ tests passent 3 apps (P0)
echo "  Verifying T13-V1 : 15+ tests passent 3 apps..."
add_row "T13-V1" "15+ tests passent 3 apps" "WARN" "(P0) Voir B-31 Tache 7.3.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V2: WCAG AA (P0)
echo "  Verifying T13-V2 : WCAG AA..."
add_row "T13-V2" "WCAG AA" "WARN" "(P0) Voir B-31 Tache 7.3.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V3: Lighthouse green (P0)
echo "  Verifying T13-V3 : Lighthouse green..."
add_row "T13-V3" "Lighthouse green" "WARN" "(P0) Voir B-31 Tache 7.3.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V4: CI green (P0)
echo "  Verifying T13-V4 : CI green..."
add_row "T13-V4" "CI green" "WARN" "(P0) Voir B-31 Tache 7.3.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V5: Reproducibility 5x (P0)
echo "  Verifying T13-V5 : Reproducibility 5x..."
add_row "T13-V5" "Reproducibility 5x" "WARN" "(P0) Voir B-31 Tache 7.3.12 pour test detaille - critere a auto-tester via script ad-hoc"

```

---


---


## VERIFICATIONS TRANSVERSALES SPRINT 31

### TR-BUILD : Build complet du sprint

```bash
echo ""
echo "================================================"
echo "VERIFICATIONS TRANSVERSALES SPRINT 31"
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

### TR-MIGRATIONS : Migrations DB Sprint 31

```bash
echo "=== TR-MIGRATIONS : Migrations DB ==="
MIGR_COUNT=$(pg_query "SELECT COUNT(*) FROM migrations WHERE name LIKE '%sprint31%' OR name LIKE '%Sprint31%'" || echo 0)
if [ "$MIGR_COUNT" -gt 0 ]; then
  add_row "TR-MIG" "Migrations Sprint 31 appliquees" "PASS" "$MIGR_COUNT migrations"
else
  add_row "TR-MIG" "Migrations Sprint 31 appliquees" "WARN" "Aucune migration detectee (verifier)"
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

### TR-SKALEAN-AI : Service Skalean AI accessible

```bash
echo "=== TR-SKALEAN-AI : Skalean AI ==="
AI_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "$SKALEAN_AI_BASE_URL/health" -H "Authorization: Bearer $SKALEAN_AI_API_KEY" || echo 0)
if [ "$AI_HEALTH" -eq 200 ]; then
  add_row "TR-AI" "Skalean AI service accessible" "PASS" "200 OK"
else
  add_row "TR-AI" "Skalean AI service accessible" "WARN" "HTTP $AI_HEALTH (verifier credentials)"
fi
```

### TR-MCP : MCP Server fonctionnel

```bash
echo "=== TR-MCP : MCP Server ==="
MCP_DISCOVER=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:4001/mcp/v1/discover" || echo 0)
if [ "$MCP_DISCOVER" -eq 200 ]; then
  add_row "TR-MCP" "MCP Server discovery endpoint" "PASS" "200 OK"
else
  add_row "TR-MCP" "MCP Server discovery endpoint" "WARN" "HTTP $MCP_DISCOVER (verifier port 4001)"
fi
```



---

## GENERATION DU RAPPORT FINAL

```bash
echo ""
echo "================================================"
echo "GENERATION DU RAPPORT FINAL SPRINT 31"
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

## Jalon GO/NO-GO Sprint 31

EOF

# Calcul statut final
if (( $(echo "$SCORE >= 95" | bc -l) )); then
  STATUT="GO"
  cat >> "$REPORT_FILE" << EOF
**STATUT** : GO -- Sprint 31 valide, passage Sprint 32 autorise

Le sprint a passe les criteres requis. Cowork peut demarrer Sprint 32.

EOF
  echo ""
  echo "================================================"
  echo "SPRINT 31 : GO ($SCORE%)"
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
  echo "SPRINT 31 : GO CONDITIONNEL ($SCORE%)"
  echo "================================================"
else
  STATUT="NO-GO"
  cat >> "$REPORT_FILE" << EOF
**STATUT** : NO-GO -- Score $SCORE% trop bas (cible 85% minimum)

Le sprint **doit etre repris** :
- Lister tous FAIL P0
- Escalation Saad/Abla decision (cut scope OR delai)
- Reprise sprint avant Sprint 32

EOF
  echo ""
  echo "================================================"
  echo "SPRINT 31 : NO-GO ($SCORE%)"
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
  echo "git commit -m \"chore(sprint-31): close sprint 31 -- $STATUT ($SCORE%)\"" >> "$REPORT_FILE"
  echo '```' >> "$REPORT_FILE"
fi

echo ""
echo "Rapport complet dans : $REPORT_FILE"
```

---

## INSTRUCTION FINALE A CLAUDE CODE / COWORK

Apres l'execution complete des verifications ci-dessus :

1. **Lis le contenu de `sprint31-verify-report.md`** integralement
2. **Identifie les FAIL critiques** (criteres P0) qui necessitent intervention manuelle
3. **Affiche un resume executif** :
   - Nombre total de criteres
   - Pourcentage PASS / PASS\* / FAIL / WARN
   - Liste des FAIL avec contexte technique
   - Recommandation : GO / GO CONDITIONNEL / NO-GO
4. **Si NO-GO** : ne pas demarrer le Sprint suivant, alerter Saad/Abla via Slack `#insurtech-dev`
5. **Si GO ou GO CONDITIONNEL** : produire le commit de cloture du sprint :

```bash
git add skalean-insurtech/sprint31-verify-report.md
git commit -m "chore(sprint-31): close sprint 31 with verification report

- Verification automatique executee
- Score global : <SCORE>%
- <PASS> criteres PASS, <PASS_REPAIRED> reparations auto, <FAIL> FAIL
- Statut : <GO|GO CONDITIONNEL|NO-GO>

Phase: 7 -- Hardening + Integrations + Pilote
Sprint: 31 (Phase 7 / Sprint 3)
Reference B-31, C-31, V-31
Report: sprint31-verify-report.md"
```

6. **Documentation continue** : si decisions techniques prises pendant verification, ajouter notes dans `repo/docs/runbooks/sprint-31-lessons-learned.md`

---

**Fin de la verification V-31 v2.2 detaillee -- Sprint 31 (7.3) Agent Sky Multilingue (4 langues -- 4 apps).**

**Total criteres taches** : 57 | **Total transversaux** : ~10 | **Effort sprint** : 75h
