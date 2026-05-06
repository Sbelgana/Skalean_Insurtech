# TEMPLATE -- FICHIER VERIFICATION DE SPRINT

**Usage** : Ce template guide la creation d'un fichier `verify-sprint-{cumul}.md` qui contient le script complet de verification automatique d'un sprint, avec auto-reparation et generation de rapport markdown structure.

**Fichier cible** : `prompts/verifications/verify-sprint-{cumul}.md`

**Convention de numerotation** : `{cumul}` = numero cumule du sprint (1 a 32).

---

## STRUCTURE DU FICHIER

```markdown
# VERIFICATION SPRINT {cumul} -- Phase {X} / Sprint {Y} : {Nom}
# Version : Auto-reparation active + Rapport final MD
# {Nombre de taches}, {Nombre total de criteres}

[En-tete d'instructions a Claude Code]

## REGLES D'EXECUTION
## FORMAT DU RAPPORT
## PHASE DE PREPARATION
## TACHE {X}.{Y}.1 : {Nom}
## TACHE {X}.{Y}.2 : {Nom}
[... toutes les taches ...]
## VERIFICATIONS TRANSVERSALES SPRINT {cumul}
## GENERATION DU RAPPORT FINAL
## TABLEAU DE RESULTATS COMPLET
## SCORE GLOBAL
## JALON GO/NO-GO PHASE {X}
## INSTRUCTION FINALE A CLAUDE CODE
```

---

## SECTION 1 -- EN-TETE

```markdown
# VERIFICATION SPRINT {cumul} -- Phase {X} / Sprint {Y} : {Nom complet}
# Version : Auto-reparation active + Rapport final MD
# {Nombre de taches} taches, {Nombre criteres} criteres

Tu es Claude Code. Tu dois executer une verification COMPLETE et EXHAUSTIVE du Sprint {cumul}.
```

**Exemples** :

```markdown
# VERIFICATION SPRINT 13 -- Phase 4 / Sprint 4 : Pay MA Multi-Passerelles
# Version : Auto-reparation active + Rapport final MD
# 16 taches, 287 criteres
```

---

## SECTION 2 -- REGLES D'EXECUTION

Section invariante :

```markdown
## REGLES D'EXECUTION
1. Tu executes CHAQUE verification dans l'ordre
2. Quand une verification echoue, tu TENTES UNE REPARATION AUTOMATIQUE avant de noter FAIL
3. Apres chaque tentative de reparation, tu re-executes la verification
4. Tu consignes dans un fichier `sprint{cumul}-verify-report.md` TOUS les resultats au fil de l'execution
5. A la fin, tu produis le rapport consolide et calcules le score GO/NO-GO
6. Tu n'interromps JAMAIS l'execution -- meme si une tache echoue completement, tu passes a la suivante
```

---

## SECTION 3 -- FORMAT DU RAPPORT

```markdown
## FORMAT DU RAPPORT (a construire incrementalement)
Pour chaque test :
| ID     | Description                        | Statut | Details                    |
|--------|------------------------------------|--------|----------------------------|
| T01-01 | Exemple verification               | PASS   | Details du resultat        |
```

**Convention IDs** :
- `T{NN}-{NN}` : critere de tache (1er NN = numero tache dans sprint, 2e NN = numero critere dans tache)
- `TR-{NN}` : critere transversal du sprint
- Exemples : `T01-05`, `T15-12`, `TR-03`

**Statuts** :
- `PASS` -- reussi au premier essai
- `PASS*` -- reussi apres reparation automatique
- `FAIL` -- echec, reparation impossible
- `SKIP` -- ignore (prerequis manquant)
- `WARN` -- partiellement reussi

---

## SECTION 4 -- PHASE DE PREPARATION

```markdown
## PHASE DE PREPARATION

```bash
REPORT_FILE="sprint{cumul}-verify-report.md"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
RUN_ID=$(date '+%Y%m%d-%H%M%S')

cat > "$REPORT_FILE" << EOF
# Rapport de Verification - Sprint {cumul} : {Nom}
**Date**: $TIMESTAMP
**Run ID**: $RUN_ID
**Executeur**: Claude Code (auto-verification + auto-reparation)
---
## Legende
- PASS : verification reussie
- PASS* : verification reussie apres reparation automatique
- FAIL : verification echouee, reparation impossible
- SKIP : verification ignoree (prerequis manquant)
- WARN : verification partiellement reussie
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

# Fonction d'ajout de ligne
add_row() {
  local id="$1" desc="$2" status="$3" details="$4"
  TABLE_ROWS="${TABLE_ROWS}| ${id} | ${desc} | ${status} | ${details} |\n"
  case "$status" in
    PASS)   ((PASS++)) ;;
    "PASS*") ((PASS_REPAIRED++)) ;;
    FAIL)   ((FAIL++)) ;;
    SKIP)   ((SKIP++)) ;;
    WARN)   ((WARN++)) ;;
  esac
  echo "[${status}] ${id} - ${desc} : ${details}"
}

# Variables connexion DB skalean-insurtech
DB_URL="${DATABASE_URL:-postgresql://insurtech_user:SecurePassword123!@localhost:5432/insurtech}"
REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6379}"
REDIS_PASS="${REDIS_PASSWORD:-RedisPassword456!}"

# Variables Skalean AI (service externe)
SKALEAN_AI_BASE_URL="${SKALEAN_AI_BASE_URL:-https://api-mock.skalean.ai}"
SKALEAN_AI_API_KEY="${SKALEAN_AI_API_KEY:-test_api_key}"

# Variables specifiques InsurTech
PAY_SANDBOX="${PAY_SANDBOX:-true}"
ACAPS_AUDIT_MODE="${ACAPS_AUDIT_MODE:-strict}"
WA_BUSINESS_TEST_PHONE="${WA_BUSINESS_TEST_PHONE:-+212600000000}"

pg_query() { psql "$DB_URL" -t -c "$1" 2>/dev/null | tr -d ' \n'; }
pg_query_raw() { psql "$DB_URL" -c "$1" 2>/dev/null; }
```
```

---

## SECTION 5 -- VERIFICATION D'UNE TACHE

Pour chaque tache du sprint, une section dediee execute tous ses criteres :

```markdown
## TACHE {X}.{Y}.{Z} : {Nom court}

### V1 -- Fichiers crees

```bash
echo ""
echo "=== TACHE {X}.{Y}.{Z} : Verification fichiers crees ==="

# Test T{TT}-01 : Existence fichier principal
if [ -f "packages/horizontal-pay-ma/src/gateways/cmi.gateway.ts" ]; then
  add_row "T{TT}-01" "Fichier cmi.gateway.ts existe" "PASS" "Fichier present"
else
  echo "[REPAIR] Fichier manquant, tentative de creation depuis template..."
  # Logique de reparation (creation depuis template, generation, ...)
  if [ -f "packages/horizontal-pay-ma/src/gateways/cmi.gateway.ts" ]; then
    add_row "T{TT}-01" "Fichier cmi.gateway.ts existe" "PASS*" "Cree apres reparation"
  else
    add_row "T{TT}-01" "Fichier cmi.gateway.ts existe" "FAIL" "Reparation impossible"
  fi
fi

# Test T{TT}-02 : Export classe attendue
EXPORTS=$(grep -c "export class CmiGateway" packages/horizontal-pay-ma/src/gateways/cmi.gateway.ts 2>/dev/null || echo 0)
if [ "$EXPORTS" -ge 1 ]; then
  add_row "T{TT}-02" "Classe CmiGateway exportee" "PASS" "Export trouve"
else
  add_row "T{TT}-02" "Classe CmiGateway exportee" "FAIL" "Export non trouve"
fi
```

### V2 -- Compilation et types

```bash
echo "=== TACHE {X}.{Y}.{Z} : Verification compilation ==="

cd packages/horizontal-pay-ma
TSC_OUT=$(pnpm tsc --noEmit 2>&1)
TSC_CODE=$?
cd ../..

if [ $TSC_CODE -eq 0 ]; then
  add_row "T{TT}-03" "Compilation TypeScript propre" "PASS" "0 erreur"
else
  ERRORS=$(echo "$TSC_OUT" | grep -c "error TS")
  add_row "T{TT}-03" "Compilation TypeScript propre" "FAIL" "$ERRORS erreurs detectees"
fi
```

### V3 -- Tests Vitest

```bash
echo "=== TACHE {X}.{Y}.{Z} : Tests Vitest ==="

VITEST_OUT=$(pnpm vitest run packages/horizontal-pay-ma/src/gateways/cmi --coverage --reporter=json 2>/dev/null)
TESTS_PASSED=$(echo "$VITEST_OUT" | jq '.numPassedTests // 0')
TESTS_TOTAL=$(echo "$VITEST_OUT" | jq '.numTotalTests // 0')

if [ "$TESTS_TOTAL" -gt 0 ] && [ "$TESTS_PASSED" -eq "$TESTS_TOTAL" ]; then
  add_row "T{TT}-04" "Tests unitaires passent" "PASS" "$TESTS_PASSED/$TESTS_TOTAL"
else
  add_row "T{TT}-04" "Tests unitaires passent" "FAIL" "$TESTS_PASSED/$TESTS_TOTAL passes"
fi

COVERAGE=$(echo "$VITEST_OUT" | jq '.coverageMap.total.lines.pct // 0')
if (( $(echo "$COVERAGE >= 85" | bc -l) )); then
  add_row "T{TT}-05" "Couverture lignes >= 85%" "PASS" "${COVERAGE}%"
else
  add_row "T{TT}-05" "Couverture lignes >= 85%" "FAIL" "${COVERAGE}% (cible 85%)"
fi
```

### V4 -- Conformite skalean-insurtech

```bash
echo "=== TACHE {X}.{Y}.{Z} : Conformite skalean-insurtech ==="

# Test T{TT}-06 : Aucun console.log
CONSOLE_LOGS=$(grep -rn "console.log" packages/horizontal-pay-ma/src/gateways/cmi/ 2>/dev/null | wc -l)
if [ "$CONSOLE_LOGS" -eq 0 ]; then
  add_row "T{TT}-06" "Aucun console.log dans le code" "PASS" "0 occurrence"
else
  echo "[REPAIR] Tentative de remplacement console.log par this.logger..."
  # sed pour remplacer console.log par this.logger.info
  CONSOLE_LOGS_AFTER=$(grep -rn "console.log" packages/horizontal-pay-ma/src/gateways/cmi/ 2>/dev/null | wc -l)
  if [ "$CONSOLE_LOGS_AFTER" -eq 0 ]; then
    add_row "T{TT}-06" "Aucun console.log dans le code" "PASS*" "Repare automatiquement"
  else
    add_row "T{TT}-06" "Aucun console.log dans le code" "FAIL" "$CONSOLE_LOGS_AFTER restants"
  fi
fi

# Test T{TT}-07 : Aucune emoji
EMOJI_COUNT=$(grep -rP "[\x{1F300}-\x{1F9FF}]|[\x{2600}-\x{27BF}]" packages/horizontal-pay-ma/src/gateways/cmi/ 2>/dev/null | wc -l)
if [ "$EMOJI_COUNT" -eq 0 ]; then
  add_row "T{TT}-07" "Aucune emoji dans le code" "PASS" "0 emoji"
else
  add_row "T{TT}-07" "Aucune emoji dans le code" "FAIL" "$EMOJI_COUNT emojis detectees"
fi

# Test T{TT}-08 : Filtre tenant_id present
TENANT_FILTER=$(grep -c "tenant_id" packages/horizontal-pay-ma/src/gateways/cmi/cmi.gateway.ts 2>/dev/null || echo 0)
if [ "$TENANT_FILTER" -ge 1 ]; then
  add_row "T{TT}-08" "Filtre tenant_id present" "PASS" "$TENANT_FILTER occurrence(s)"
else
  add_row "T{TT}-08" "Filtre tenant_id present" "FAIL" "Multi-tenant absent"
fi
```

### V5 -- Securite paiement (specifique InsurTech)

```bash
echo "=== TACHE {X}.{Y}.{Z} : Securite paiement ==="

# Test T{TT}-09 : Hash SHA-512 utilise
SHA512_USAGE=$(grep -c "sha512\|SHA-512\|sha-512" packages/horizontal-pay-ma/src/gateways/cmi/cmi.gateway.ts 2>/dev/null || echo 0)
if [ "$SHA512_USAGE" -ge 1 ]; then
  add_row "T{TT}-09" "Hash SHA-512 utilise" "PASS" "Detecte"
else
  add_row "T{TT}-09" "Hash SHA-512 utilise" "FAIL" "Non detecte"
fi

# Test T{TT}-10 : Verification signature webhook
WEBHOOK_SIG=$(grep -c "verify.*signature\|signature.*verify" packages/horizontal-pay-ma/src/gateways/cmi/cmi.webhook.ts 2>/dev/null || echo 0)
if [ "$WEBHOOK_SIG" -ge 1 ]; then
  add_row "T{TT}-10" "Verification signature webhook" "PASS" "Implementee"
else
  add_row "T{TT}-10" "Verification signature webhook" "FAIL" "Manquante"
fi

# Test T{TT}-11 : Idempotence transactions
IDEMPOTENT=$(grep -c "idempotent\|order_id.*unique" packages/horizontal-pay-ma/src/gateways/cmi/ 2>/dev/null || echo 0)
if [ "$IDEMPOTENT" -ge 1 ]; then
  add_row "T{TT}-11" "Idempotence garantie" "PASS" "Pattern detecte"
else
  add_row "T{TT}-11" "Idempotence garantie" "FAIL" "Pattern manquant"
fi
```
```

---

## SECTION 6 -- VERIFICATIONS TRANSVERSALES

```markdown
## VERIFICATIONS TRANSVERSALES SPRINT {cumul}

### TR-01 : Build complet du monorepo

```bash
echo "=== TR : Build complet ==="
BUILD_OUT=$(pnpm turbo run build --filter=...horizontal-pay-ma 2>&1)
BUILD_CODE=$?
if [ $BUILD_CODE -eq 0 ]; then
  add_row "TR-01" "Build monorepo passe" "PASS" "Tous packages compiles"
else
  add_row "TR-01" "Build monorepo passe" "FAIL" "Erreurs detectees"
fi
```

### TR-02 : Tests E2E sprint complet

```bash
echo "=== TR : Tests E2E ==="
E2E_OUT=$(pnpm playwright test --project=insurtech 2>&1)
E2E_CODE=$?
if [ $E2E_CODE -eq 0 ]; then
  add_row "TR-02" "Tests E2E passent" "PASS" "Tous scenarios OK"
else
  add_row "TR-02" "Tests E2E passent" "FAIL" "Scenarios echoues"
fi
```

### TR-03 : Migrations DB appliquees

```bash
echo "=== TR : Migrations DB ==="
MIGR_COUNT=$(pg_query "SELECT COUNT(*) FROM migrations WHERE name LIKE '%sprint{cumul}%'")
if [ "$MIGR_COUNT" -gt 0 ]; then
  add_row "TR-03" "Migrations sprint {cumul} appliquees" "PASS" "$MIGR_COUNT migrations"
else
  add_row "TR-03" "Migrations sprint {cumul} appliquees" "FAIL" "Aucune migration"
fi
```

### TR-04 : Aucune emoji dans tout le sprint

```bash
echo "=== TR : Aucune emoji globale ==="
EMOJI_GLOBAL=$(grep -rP "[\x{1F300}-\x{1F9FF}]|[\x{2600}-\x{27BF}]" packages/horizontal-pay-ma/ 2>/dev/null | wc -l)
if [ "$EMOJI_GLOBAL" -eq 0 ]; then
  add_row "TR-04" "Aucune emoji dans sprint complet" "PASS" "Conforme"
else
  add_row "TR-04" "Aucune emoji dans sprint complet" "FAIL" "$EMOJI_GLOBAL emojis"
fi
```

### TR-05 : Conformite ACAPS (specifique InsurTech)

```bash
echo "=== TR : Conformite ACAPS ==="
ACAPS_AUDIT_COUNT=$(pg_query "SELECT COUNT(*) FROM compliance_acaps_audits WHERE created_at > NOW() - INTERVAL '1 day'")
if [ "$ACAPS_AUDIT_COUNT" -gt 0 ]; then
  add_row "TR-05" "Audit trail ACAPS actif" "PASS" "$ACAPS_AUDIT_COUNT entrees recentes"
else
  add_row "TR-05" "Audit trail ACAPS actif" "WARN" "Aucune entree (verifier)"
fi
```

### TR-06 : Connexion Skalean AI service externe

```bash
echo "=== TR : Skalean AI client ==="
AI_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "$SKALEAN_AI_BASE_URL/health" -H "Authorization: Bearer $SKALEAN_AI_API_KEY" || echo 0)
if [ "$AI_HEALTH" -eq 200 ]; then
  add_row "TR-06" "Skalean AI service accessible" "PASS" "200 OK"
else
  add_row "TR-06" "Skalean AI service accessible" "WARN" "HTTP $AI_HEALTH (verifier credentials)"
fi
```
```

---

## SECTION 7 -- GENERATION DU RAPPORT FINAL

```markdown
## GENERATION DU RAPPORT FINAL

```bash
echo ""
echo "=== GENERATION DU RAPPORT FINAL ==="

TOTAL=$((PASS + PASS_REPAIRED + FAIL + SKIP + WARN))
SCORE=$(echo "scale=2; ($PASS + $PASS_REPAIRED) * 100 / $TOTAL" | bc)

cat >> "$REPORT_FILE" << EOF

## Tableau de Resultats Complet

| ID     | Description                        | Statut | Details                    |
|--------|------------------------------------|--------|----------------------------|
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

**Score Global de Reussite** : ${SCORE}%

## Jalon Go/No-Go Phase {X}

EOF

if (( $(echo "$SCORE >= 95" | bc -l) )); then
  echo "**STATUT** : GO -- Sprint {cumul} valide, passage au Sprint {cumul+1} autorise" >> "$REPORT_FILE"
  echo ""
  echo "============================================="
  echo "SPRINT {cumul} : GO ($SCORE%)"
  echo "============================================="
elif (( $(echo "$SCORE >= 85" | bc -l) )); then
  echo "**STATUT** : GO CONDITIONNEL -- Score $SCORE% (cible 95%). Hot fixes requis." >> "$REPORT_FILE"
  echo ""
  echo "============================================="
  echo "SPRINT {cumul} : GO CONDITIONNEL ($SCORE%)"
  echo "============================================="
else
  echo "**STATUT** : NO-GO -- Score $SCORE% trop bas. Sprint a reprendre." >> "$REPORT_FILE"
  echo ""
  echo "============================================="
  echo "SPRINT {cumul} : NO-GO ($SCORE%)"
  echo "============================================="
fi

echo ""
echo "Rapport complet dans : $REPORT_FILE"
```
```

---

## SECTION 8 -- INSTRUCTION FINALE

```markdown
## INSTRUCTION FINALE A CLAUDE CODE

Apres l'execution complete des verifications ci-dessus :

1. **Lis le contenu de `sprint{cumul}-verify-report.md`** integralement
2. **Identifie les FAIL critiques** (criteres P0) qui necessitent une intervention manuelle
3. **Affiche un resume executif** :
   - Nombre total de criteres
   - Pourcentage PASS, PASS*, FAIL
   - Liste des FAIL avec contexte technique
   - Recommandation : GO, GO CONDITIONNEL, ou NO-GO
4. **Si NO-GO** : ne pas demarrer le Sprint suivant, alerter l'humain
5. **Si GO ou GO CONDITIONNEL** : produire un commit de cloture du sprint :

```
chore(sprint-{cumul}): close sprint {cumul} with verification report

- Verification automatique executee le {date}
- Score global : {SCORE}%
- {PASS} criteres PASS, {PASS_REPAIRED} reparations auto, {FAIL} FAIL
- Statut : {GO|GO CONDITIONNEL|NO-GO}

Phase: {X}
Sprint: {cumul} (Phase {X} / Sprint {Y})
Report: sprint{cumul}-verify-report.md
```
```

---

## CONVENTIONS SPECIFIQUES PAR PHASE

### Phase 1-2 (Infrastructure et Auth)
Verifications focus : compilation tous packages, migrations DB sans erreur, tests unitaires couvrant 85% minimum, auth multi-tenant isolation stricte, RBAC fonctionnel.

### Phase 3 (Skalean AI Client)
Verifications focus : connexion mock Skalean AI fonctionnelle, circuit breaker actif, cache Redis operationnel, observabilite Pino + Sentry + metrics.

### Phase 4 (Modules Horizontaux)
Verifications focus : 10 modules independamment fonctionnels, integration croisee testee, multi-passerelles paiement sandbox testees, signature loi 43-20 testee avec tiers de confiance sandbox.

### Phase 5-6 (SaaS Broker et Garage)
Verifications focus : connecteurs assureurs sandbox, agent Sky integre, cycle de vie police complet, IA estimation avec dataset test (>= 85% accuracy), workflow sinistre end-to-end.

### Phase 7 (Cross-tenant)
Verifications focus : isolation stricte preservee meme avec autorisation cross-tenant, revocation immediate, audit complet.

### Phase 8 (InsurTech Admin)
Verifications focus : KPIs cross-tenant exacts, exports reports valides, facturation B2B operationnelle.

### Phase 9 (Hardening)
Verifications focus : pentest externe sans High/Critical, performance > 1000 tenants concurrents, conformite ACAPS attestee, conformite CNDP attestee.

### Phase 10 (Pilote)
Verifications focus : metriques pilote 30 jours conformes (delai sinistre < 24h, satisfaction > 4/5, NPS > 30).

---

## REGLES DE QUALITE

### Regle Q1 -- Idempotence
Le fichier de verification peut etre execute plusieurs fois sans effet de bord.

### Regle Q2 -- Sandbox uniquement
Aucune commande ne touche un environnement de production. Variables `SANDBOX=true` systematiquement utilisees.

### Regle Q3 -- Auto-reparation explicite
Chaque tentative marquee `echo "[REPAIR] ..."` pour traçabilité humaine.

### Regle Q4 -- Trois tentatives maximum
Au-dela de 3 tentatives, test marque FAIL et verification continue.

### Regle Q5 -- Rapport markdown valide
UTF-8, tableaux bien formes, sections hierarchisees, lisible sur GitHub et IDE.

---

**Fin du template `04-template-verification.md`.**
**Voir `05-template-orchestrateur.md` pour le format des fichiers d'orchestration.**
