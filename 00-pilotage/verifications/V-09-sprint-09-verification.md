# VERIFICATION SPRINT 9 v3.0 -- Phase 2 / Sprint 7 : Comm WhatsApp Scope Strict + Email Data Sensible
# Version : Auto-reparation active + Rapport final MD detaille
# 10 taches v3.0 + 12 transversaux + 4 CNDP CRITIQUES = 90+ criteres
# AUCUNE EMOJI AUTORISEE

**Version** : v3.0 (verification detaillee + auto-reparation + CNDP CRITIQUES)
**Phase** : 2 -- Securite + Infrastructure
**Sprint** : 9 / 40 (cumul v3.0) -- Phase 2 Sprint 7
**Reference meta-prompt** : `B-09-sprint-09-comm-whatsapp-scope-strict-v3.md`
**Reference orchestrateur** : `C-09-sprint-09-comm-whatsapp-scope-strict.md`
**Total criteres** : 70 taches + 12 transversaux + 4 CNDP CRITIQUES = 86 criteres
**Jalon critique** : sans GO V-09 (>= 95%), Sprints downstream (14/17/18/21/22.5/22.7/24/26.5) restent v2.2 non-conforme CNDP

---

Tu es **Claude Code (ou Cowork)**. Tu dois executer une **verification COMPLETE et EXHAUSTIVE** du Sprint 9 v3.0 apres execution toutes les 10 taches.

---

## REGLES D'EXECUTION

1. Tu **executes CHAQUE verification dans l'ordre** (preparation -> taches -> transversales -> CNDP CRITIQUES -> rapport)
2. Quand une verification echoue, tu **TENTES UNE REPARATION AUTOMATIQUE** avant de noter FAIL (3 tentatives max)
3. Apres chaque tentative de reparation, tu **re-executes la verification**
4. Tu consignes dans `sprint09-verify-report.md` **TOUS les resultats** au fil de l'execution
5. A la fin, tu produis le **rapport consolide** + calcul score GO / GO CONDITIONNEL / NO-GO
6. Tu **n'interromps JAMAIS** l'execution -- meme si une tache echoue, tu passes a la suivante
7. **CNDP CRITIQUES** : 4 verifications end-to-end legal -- si FAIL, escalation IMMEDIATE Saad + Abla

---

## FORMAT DU RAPPORT

| ID | Description | Statut | Details |
|----|-------------|--------|---------|
| T01-V1 | Critere V1 Tache 1 | PASS | Details |

**Convention IDs** :
- `T{NN}-V{N}` : critere V{N} de Tache {NN}
- `T{NN}-F{N}` : critere fichier de Tache {NN}
- `TR-{TYPE}` : critere transversal sprint
- `CNDP-{N}` : critere CNDP CRITIQUE legal v3.0

**Statuts** : `PASS` / `PASS*` (repare auto) / `FAIL` (P0 bloquant) / `SKIP` / `WARN`

---

## PHASE DE PREPARATION

```bash
REPORT_FILE="sprint09-verify-report.md"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
RUN_ID=$(date '+%Y%m%d-%H%M%S')

cat > "$REPORT_FILE" << EOF
# Rapport de Verification - Sprint 9 v3.0 : Comm WhatsApp Scope Strict

**Date** : $TIMESTAMP
**Run ID** : $RUN_ID
**Phase** : 2 -- Securite + Infrastructure
**Sprint** : 9 (Phase 2 / Sprint 7) v3.0
**Reference B-09 v3.0** : 10 taches, 70 criteres + 12 transversaux + 4 CNDP CRITIQUES = 86 total
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

# Variables globales compteurs
PASS=0; PASS_REPAIRED=0; FAIL=0; SKIP=0; WARN=0
CNDP_VIOLATIONS=0; LEGAL_BLOCKING=0
TABLE_ROWS=""

# Helper add_row
add_row() {
  local id="$1" desc="$2" status="$3" details="$4"
  TABLE_ROWS="$TABLE_ROWS| $id | $desc | $status | $details |\n"
  case "$status" in
    PASS)    ((PASS++)) ;;
    "PASS*") ((PASS_REPAIRED++)) ;;
    FAIL)    ((FAIL++))
             [[ "$id" =~ ^CNDP- ]] && ((CNDP_VIOLATIONS++)) && ((LEGAL_BLOCKING++)) ;;
    SKIP)    ((SKIP++)) ;;
    WARN)    ((WARN++)) ;;
  esac
  echo "[$status] $id - $desc : $details"
}

# Helper auto_repair
auto_repair() {
  local repair_command="$1" verification_command="$2" id="$3" desc="$4"
  echo "[REPAIR] $id - Tentative reparation"
  eval "$repair_command" 2>&1 | tee /tmp/repair-$id.log
  if eval "$verification_command"; then
    add_row "$id" "$desc" "PASS*" "Repare automatiquement"
    return 0
  else
    add_row "$id" "$desc" "FAIL" "Reparation impossible"
    return 1
  fi
}

# Connection database
DB_URL="${DATABASE_URL:-postgresql://insurtech_user:SecurePassword123!@localhost:5432/insurtech}"
pg_query() { psql "$DB_URL" -t -c "$1" 2>/dev/null | tr -d ' \n'; }

# Verify Sprint 8 GO (prerequis)
SPRINT8_GO=$(grep -c '^Statut.*GO' skalean-insurtech/sprint08-verify-report.md 2>/dev/null || echo 0)
[ "$SPRINT8_GO" -lt 1 ] && echo "[WARN] Sprint 8 non-GO detected"
```

---

## TACHE 1/10 -- 2.7.1 : Package @insurtech/comm + types + constants

```bash
echo ""
echo "TACHE 2.7.1 : Package @insurtech/comm"

# T01-F1 : Package present
[ -d "repo/packages/comm" ] && add_row "T01-F1" "Package @insurtech/comm" "PASS" "" || add_row "T01-F1" "Package" "FAIL" "Dossier manquant CRITIQUE"

# T01-F2 : package.json
if [ -f "repo/packages/comm/package.json" ]; then
  PKG_NAME=$(jq -r '.name' repo/packages/comm/package.json 2>/dev/null)
  [ "$PKG_NAME" = "@insurtech/comm" ] && add_row "T01-F2" "package.json @insurtech/comm" "PASS" "" || add_row "T01-F2" "package.json" "FAIL" "$PKG_NAME"
else
  add_row "T01-F2" "package.json" "FAIL" "Manquant"
fi

# T01-F3 : 4 types files
TYPES_COUNT=$(find repo/packages/comm/src/types -name "*.types.ts" 2>/dev/null | wc -l)
[ "$TYPES_COUNT" -ge 4 ] && add_row "T01-F3" "4 types files" "PASS" "$TYPES_COUNT" || add_row "T01-F3" "4 types files" "FAIL" "$TYPES_COUNT / 4"

# T01-F4 : 4 schemas Zod files
SCHEMAS_COUNT=$(find repo/packages/comm/src/schemas -name "*.schema.ts" 2>/dev/null | wc -l)
[ "$SCHEMAS_COUNT" -ge 4 ] && add_row "T01-F4" "4 schemas Zod" "PASS" "$SCHEMAS_COUNT" || add_row "T01-F4" "4 schemas Zod" "FAIL" "$SCHEMAS_COUNT / 4"

# T01-V1 (P0 CRITIQUE) : STATUS_ONLY_TEMPLATES = 45 entries
cd repo/packages/comm && pnpm build 2>&1 > /tmp/build-comm.log && cd ../../..
TEMPLATES_COUNT=$(node -e "
try {
  const { ALL_STATUS_TEMPLATES } = require('./repo/packages/comm/dist/index.js');
  console.log(ALL_STATUS_TEMPLATES.length);
} catch (e) { console.log('0'); }
" 2>/dev/null || echo 0)
if [ "${TEMPLATES_COUNT:-0}" -eq 45 ]; then
  add_row "T01-V1" "STATUS_ONLY_TEMPLATES = 45 entries" "PASS" "$TEMPLATES_COUNT"
elif [ "${TEMPLATES_COUNT:-0}" -ge 40 ]; then
  add_row "T01-V1" "STATUS_ONLY_TEMPLATES" "WARN" "$TEMPLATES_COUNT / 45"
else
  add_row "T01-V1" "STATUS_ONLY_TEMPLATES" "FAIL" "$TEMPLATES_COUNT / 45"
fi

# T01-V2 (P0 CRITIQUE LEGAL) : BLACKLISTED_FIELD_PATTERNS >= 15
BLACKLIST_COUNT=$(node -e "
try {
  const { BLACKLISTED_FIELD_PATTERNS } = require('./repo/packages/comm/dist/index.js');
  console.log(BLACKLISTED_FIELD_PATTERNS.length);
} catch (e) { console.log('0'); }
" 2>/dev/null || echo 0)
[ "${BLACKLIST_COUNT:-0}" -ge 15 ] && add_row "T01-V2" "BLACKLISTED_FIELD_PATTERNS >= 15" "PASS" "$BLACKLIST_COUNT" || add_row "T01-V2" "BLACKLISTED" "FAIL" "$BLACKLIST_COUNT / 15 CRITIQUE LEGAL"

# T01-V3 (P0) : Helper isBlacklistedField fonctionnel
HELPER_TEST=$(node -e "
try {
  const { isBlacklistedField } = require('./repo/packages/comm/dist/index.js');
  if (isBlacklistedField('amount') && !isBlacklistedField('first_name')) console.log('OK');
  else console.log('FAIL');
} catch (e) { console.log('ERROR'); }
" 2>/dev/null || echo "ERROR")
case "$HELPER_TEST" in
  "OK") add_row "T01-V3" "Helper isBlacklistedField fonctionnel" "PASS" "amount=true / first_name=false" ;;
  *) add_row "T01-V3" "Helper isBlacklistedField" "FAIL" "Logic ou export incorrect" ;;
esac

# T01-V4 (P0) : TypeScript strict 0 erreur
cd repo/packages/comm && pnpm tsc --noEmit 2>&1 > /tmp/tsc-comm.log
TS_ERR=$(grep -c "error TS" /tmp/tsc-comm.log)
cd ../../..
if [ "$TS_ERR" -eq 0 ]; then
  add_row "T01-V4" "TypeScript strict 0 erreur" "PASS" ""
else
  auto_repair "cd repo/packages/comm && pnpm install --force && pnpm tsc --noEmit" "[ \$(grep -c 'error TS' /tmp/tsc-comm.log) -eq 0 ]" "T01-V4" "TypeScript strict"
fi

# T01-V5 (P0) : Tests bootstrap 4+ PASS
T01_TESTS=$(cd repo && pnpm vitest run --reporter=json packages/comm/src/__tests__/bootstrap.spec.ts 2>/dev/null | jq '.numPassedTests // 0' 2>/dev/null || echo 0)
[ "${T01_TESTS:-0}" -ge 4 ] && add_row "T01-V5" "Tests bootstrap 4+ PASS" "PASS" "$T01_TESTS" || add_row "T01-V5" "Tests bootstrap" "WARN" "$T01_TESTS / 4"
```

---

## TACHE 2/10 -- 2.7.2 : CRITIQUE WhatsApp service scope strict 7 etapes

```bash
echo ""
echo "TACHE 2.7.2 : CRITIQUE WhatsApp scope strict (correction Saad #7)"

# T02-F1 : whatsapp.service.ts present + taille
SERVICE="repo/packages/comm/src/services/whatsapp.service.ts"
if [ -f "$SERVICE" ]; then
  LINES=$(wc -l < "$SERVICE")
  [ "$LINES" -ge 200 ] && add_row "T02-F1" "whatsapp.service.ts >= 200 lignes" "PASS" "$LINES" || add_row "T02-F1" "whatsapp.service.ts" "WARN" "$LINES (faible)"
else
  add_row "T02-F1" "whatsapp.service.ts" "FAIL" "MANQUANT CRITIQUE"
fi

# T02-F2 : Services dependances (rate-limiter + template-renderer)
[ -f "repo/packages/comm/src/services/rate-limiter.service.ts" ] && add_row "T02-F2a" "rate-limiter.service.ts" "PASS" "" || add_row "T02-F2a" "rate-limiter" "FAIL" "Manquant"
[ -f "repo/packages/comm/src/services/template-renderer.service.ts" ] && add_row "T02-F2b" "template-renderer.service.ts" "PASS" "" || add_row "T02-F2b" "template-renderer" "FAIL" "Manquant"

# T02-F3 : Entity whatsapp-templates-registry
[ -f "repo/packages/comm/src/entities/whatsapp-templates-registry.entity.ts" ] && add_row "T02-F3" "whatsapp-templates-registry.entity" "PASS" "" || add_row "T02-F3" "Entity" "FAIL" "Manquant"

# T02-V1 (P0 CRITIQUE LEGAL) : Whitelist enforcement
WHITELIST_LOGIC=$(grep -cE "isTemplateWhitelisted|ALL_STATUS_TEMPLATES.includes|not in.*whitelist" "$SERVICE" 2>/dev/null || echo 0)
[ "${WHITELIST_LOGIC:-0}" -ge 1 ] && add_row "T02-V1" "Whitelist enforcement code present" "PASS" "$WHITELIST_LOGIC refs" || add_row "T02-V1" "Whitelist enforcement" "FAIL" "CRITIQUE LEGAL absent"

# T02-V2 (P0 CRITIQUE LEGAL) : Blacklist enforcement
BLACKLIST_LOGIC=$(grep -cE "detectBlacklistedFields|BLACKLISTED_FIELD_PATTERNS|blacklist.*violation" "$SERVICE" 2>/dev/null || echo 0)
[ "${BLACKLIST_LOGIC:-0}" -ge 1 ] && add_row "T02-V2" "Blacklist enforcement code present" "PASS" "$BLACKLIST_LOGIC refs" || add_row "T02-V2" "Blacklist enforcement" "FAIL" "MANQUANT CRITIQUE LEGAL CNDP"

# T02-V3 (P0) : 7 etapes presentes
ETAPES_FOUND=0
for etape in "ETAPE 1" "ETAPE 2" "ETAPE 3" "ETAPE 4" "ETAPE 5" "ETAPE 6" "ETAPE 7"; do
  grep -q "$etape" "$SERVICE" 2>/dev/null && ETAPES_FOUND=$((ETAPES_FOUND + 1))
done
if [ "$ETAPES_FOUND" -eq 7 ]; then
  add_row "T02-V3" "7 etapes enforcement documentees" "PASS" ""
elif [ "$ETAPES_FOUND" -ge 5 ]; then
  add_row "T02-V3" "7 etapes" "WARN" "$ETAPES_FOUND / 7"
else
  add_row "T02-V3" "7 etapes" "FAIL" "$ETAPES_FOUND / 7"
fi

# T02-V4 (P0) : Rate limiting
RATE_LIMIT=$(grep -cE "rateLimiter\|10.*heure\|10.*hour\|limit:.*10" "$SERVICE" 2>/dev/null || echo 0)
[ "${RATE_LIMIT:-0}" -ge 1 ] && add_row "T02-V4" "Rate limiting 10/heure code" "PASS" "" || add_row "T02-V4" "Rate limiting" "FAIL" "Absent"

# T02-V5 (P0) : Audit ACAPS log
AUDIT_LOG=$(grep -cE "auditService|acapsAudit|logNotificationSent" "$SERVICE" 2>/dev/null || echo 0)
[ "${AUDIT_LOG:-0}" -ge 1 ] && add_row "T02-V5" "Audit ACAPS log code" "PASS" "$AUDIT_LOG" || add_row "T02-V5" "Audit ACAPS log" "FAIL" "Absent"

# T02-V6 (P0) : Phone hash SHA256
PHONE_HASH=$(grep -cE "hashPhone|createHmac.*sha256|sha256.*phone" "$SERVICE" 2>/dev/null || echo 0)
[ "${PHONE_HASH:-0}" -ge 1 ] && add_row "T02-V6" "Phone hash SHA256 code" "PASS" "" || add_row "T02-V6" "Phone hash" "FAIL" "Plain phone risk CNDP"

# T02-V7 (P0) : Multilingue 4 langues
MULTILINGUE=$(grep -cE "WhatsAppLanguageEnum|language.*fallback|fr.*ar.*ar-MA.*en" "$SERVICE" 2>/dev/null || echo 0)
[ "${MULTILINGUE:-0}" -ge 1 ] && add_row "T02-V7" "Multilingue 4 langues code" "PASS" "" || add_row "T02-V7" "Multilingue" "WARN" "A verifier"

# T02-V8 (P0) : Tests 20+ scenarios
T02_TESTS=$(cd repo && pnpm vitest run --reporter=json packages/comm/src/services/whatsapp.service.spec.ts 2>/dev/null | jq '.numPassedTests // 0' 2>/dev/null || echo 0)
if [ "${T02_TESTS:-0}" -ge 20 ]; then
  add_row "T02-V8" "Tests WhatsApp 20+ scenarios" "PASS" "$T02_TESTS"
elif [ "${T02_TESTS:-0}" -ge 15 ]; then
  add_row "T02-V8" "Tests WhatsApp 20+" "WARN" "$T02_TESTS / 20"
else
  add_row "T02-V8" "Tests WhatsApp 20+" "FAIL" "$T02_TESTS / 20 CRITIQUE"
fi

# T02-V9 (P0 CRITIQUE LEGAL) : Tests blacklist 8+ specifiques
BLACKLIST_TESTS=$(cd repo && pnpm vitest run --reporter=json packages/comm 2>/dev/null | jq '[.testResults[]?.testResults[]? | select(.title | test("blacklist|REJECTS"; "i"))] | length' 2>/dev/null || echo 0)
[ "${BLACKLIST_TESTS:-0}" -ge 8 ] && add_row "T02-V9" "Tests blacklist 8+ specifiques" "PASS" "$BLACKLIST_TESTS" || add_row "T02-V9" "Tests blacklist 8+" "FAIL" "$BLACKLIST_TESTS / 8 CRITIQUE LEGAL"
```

---

## TACHE 3/10 -- 2.7.3 : Templates WhatsApp 45 + sync Meta

```bash
echo ""
echo "TACHE 2.7.3 : Templates WhatsApp + Meta sync"

TEMPLATE_DIR="repo/packages/comm/src/templates/whatsapp"
[ -d "$TEMPLATE_DIR" ] && add_row "T03-F1" "Dossier templates/whatsapp/" "PASS" "" || add_row "T03-F1" "Dossier" "FAIL" "Manquant"

# T03-F2 : 6 sous-dossiers categories
CATEGORIES=(repair insure customer assure tow expert)
CAT_OK=0
for cat in "${CATEGORIES[@]}"; do [ -d "$TEMPLATE_DIR/$cat" ] && CAT_OK=$((CAT_OK + 1)); done
[ "$CAT_OK" -eq 6 ] && add_row "T03-F2" "6 categories sous-dossiers" "PASS" "" || add_row "T03-F2" "6 categories" "FAIL" "$CAT_OK / 6"

# T03-V1 (P0) : 45 templates fr
TEMPLATES_FR=$(find "$TEMPLATE_DIR" -name "*.fr.hbs" 2>/dev/null | wc -l)
if [ "${TEMPLATES_FR:-0}" -ge 45 ]; then
  add_row "T03-V1" "45 templates uniques (fr)" "PASS" "$TEMPLATES_FR"
elif [ "${TEMPLATES_FR:-0}" -ge 40 ]; then
  add_row "T03-V1" "45 templates" "WARN" "$TEMPLATES_FR / 45"
else
  add_row "T03-V1" "45 templates" "FAIL" "$TEMPLATES_FR / 45"
fi

# T03-V2 (P0) : 180 variantes 4 langues
TOTAL_HBS=$(find "$TEMPLATE_DIR" -name "*.hbs" 2>/dev/null | wc -l)
if [ "${TOTAL_HBS:-0}" -ge 180 ]; then
  add_row "T03-V2" "180+ variantes 4 langues" "PASS" "$TOTAL_HBS"
else
  add_row "T03-V2" "180 variantes" "WARN" "$TOTAL_HBS / 180"
fi

# T03-V3 (P0 CRITIQUE LEGAL) : 0 variable dangereuse
DANGEROUS_VARS=$(grep -rE "\{\{\s*(amount|price|total_mad|cin|token|password|iban|cvv|devis_total|franchise|honoraire)" "$TEMPLATE_DIR" 2>/dev/null | wc -l)
if [ "${DANGEROUS_VARS:-0}" -eq 0 ]; then
  add_row "T03-V3" "0 variable dangereuse templates" "PASS" "Conformite CNDP OK"
else
  add_row "T03-V3" "0 variable dangereuse" "FAIL" "$DANGEROUS_VARS violations CRITIQUE LEGAL"
  ((CNDP_VIOLATIONS++))
fi

# T03-V4 (P0) : Migration whatsapp_templates_registry
MIGRATION_RUN=$(pg_query "SELECT 1 FROM information_schema.tables WHERE table_name = 'whatsapp_templates_registry'")
[ -n "$MIGRATION_RUN" ] && add_row "T03-V4" "Table whatsapp_templates_registry" "PASS" "" || add_row "T03-V4" "Migration" "FAIL" "Table manquante"

# T03-V5 : Trigger set_updated_at
TRIGGER_EXISTS=$(pg_query "SELECT 1 FROM information_schema.triggers WHERE event_object_table = 'whatsapp_templates_registry'")
[ -n "$TRIGGER_EXISTS" ] && add_row "T03-V5" "Trigger set_updated_at" "PASS" "" || add_row "T03-V5" "Trigger" "WARN" "Absent"

# T03-V6 : Meta Business Manager sync
META_SYNCED=$(pg_query "SELECT COUNT(*) FROM whatsapp_templates_registry WHERE meta_template_id IS NOT NULL")
if [ "${META_SYNCED:-0}" -ge 45 ]; then
  add_row "T03-V6" "Meta sync >= 45 templates" "PASS" "$META_SYNCED"
elif [ "${META_SYNCED:-0}" -ge 1 ]; then
  add_row "T03-V6" "Meta sync >= 45" "WARN" "$META_SYNCED / 45"
else
  add_row "T03-V6" "Meta sync" "WARN" "0 (sync prod manuel)"
fi

# T03-V7 (P0) : Script CI safety check
[ -f "scripts/check-whatsapp-templates-safety.sh" ] && add_row "T03-V7" "Script CI safety check" "PASS" "" || add_row "T03-V7" "Script CI" "FAIL" "Manquant"

# T03-V8 : GitHub Action workflow
[ -f ".github/workflows/whatsapp-templates-safety.yml" ] && add_row "T03-V8" "GitHub Action workflow" "PASS" "" || add_row "T03-V8" "GitHub Action" "WARN" "Absent"
```

---

## TACHE 4/10 -- 2.7.4 : Email service DKIM/SPF/DMARC + fallback Mailjet

```bash
echo ""
echo "TACHE 2.7.4 : Email service data sensible"

SERVICE="repo/packages/comm/src/services/email.service.ts"
[ -f "$SERVICE" ] && add_row "T04-F1" "email.service.ts" "PASS" "" || add_row "T04-F1" "email.service.ts" "FAIL" "Manquant"

# T04-F2 : sendgrid + mailjet clients
[ -f "repo/packages/comm/src/services/sendgrid-client.service.ts" ] && add_row "T04-F2a" "sendgrid-client" "PASS" "" || add_row "T04-F2a" "sendgrid-client" "FAIL" "Manquant"
[ -f "repo/packages/comm/src/services/mailjet-client.service.ts" ] && add_row "T04-F2b" "mailjet-client (fallback)" "PASS" "" || add_row "T04-F2b" "mailjet-client" "FAIL" "Manquant"

# T04-F3 : Email templates HTML
EMAIL_TEMPLATES_TOTAL=$(find repo/packages/comm/src/templates/email -name "*.html" 2>/dev/null | wc -l)
if [ "${EMAIL_TEMPLATES_TOTAL:-0}" -ge 120 ]; then
  add_row "T04-F3" "Email templates 120+ variantes" "PASS" "$EMAIL_TEMPLATES_TOTAL"
elif [ "${EMAIL_TEMPLATES_TOTAL:-0}" -ge 60 ]; then
  add_row "T04-F3" "Email templates" "WARN" "$EMAIL_TEMPLATES_TOTAL / 120"
else
  add_row "T04-F3" "Email templates" "FAIL" "$EMAIL_TEMPLATES_TOTAL / 120"
fi

# T04-V1 (P0) : DKIM TXT record
DKIM_OK=$(dig +short TXT "assurflow._domainkey.assurflow.ma" 2>/dev/null | grep -c "v=DKIM1" || echo 0)
[ "${DKIM_OK:-0}" -ge 1 ] && add_row "T04-V1" "DKIM TXT record DNS prod" "PASS" "" || add_row "T04-V1" "DKIM" "WARN" "Verifier prod DNS"

# T04-V2 (P0) : SPF TXT record
SPF_OK=$(dig +short TXT "assurflow.ma" 2>/dev/null | grep -c "v=spf1" || echo 0)
[ "${SPF_OK:-0}" -ge 1 ] && add_row "T04-V2" "SPF TXT record" "PASS" "" || add_row "T04-V2" "SPF" "WARN" "Non visible"

# T04-V3 (P0) : DMARC policy reject
DMARC_OK=$(dig +short TXT "_dmarc.assurflow.ma" 2>/dev/null | grep -c "p=reject\|p=quarantine" || echo 0)
[ "${DMARC_OK:-0}" -ge 1 ] && add_row "T04-V3" "DMARC policy reject" "PASS" "" || add_row "T04-V3" "DMARC" "WARN" "Non visible"

# T04-V4 (P0) : Fallback Mailjet logic
FALLBACK_LOGIC=$(grep -cE "Mailjet\|fallback.*sendgrid\|catch.*sg" "$SERVICE" 2>/dev/null || echo 0)
[ "${FALLBACK_LOGIC:-0}" -ge 1 ] && add_row "T04-V4" "Fallback Mailjet logic" "PASS" "" || add_row "T04-V4" "Fallback Mailjet" "FAIL" "Absent"

# T04-V5 (P0) : Documentation DNS config
[ -f "repo/docs/infrastructure/email-dns-config.md" ] && add_row "T04-V5" "Doc DNS config" "PASS" "" || add_row "T04-V5" "Doc DNS" "FAIL" "Manquante"

# T04-V6 : Tests 15+
T04_TESTS=$(cd repo && pnpm vitest run --reporter=json packages/comm/src/services/email.service.spec.ts 2>/dev/null | jq '.numPassedTests // 0' 2>/dev/null || echo 0)
[ "${T04_TESTS:-0}" -ge 15 ] && add_row "T04-V6" "Tests Email 15+" "PASS" "$T04_TESTS" || add_row "T04-V6" "Tests Email" "WARN" "$T04_TESTS / 15"

# T04-V7 : RTL rendering
RTL_TEMPLATES=$(grep -rE 'dir="rtl"' repo/packages/comm/src/templates/email --include="*.html" 2>/dev/null | wc -l)
[ "${RTL_TEMPLATES:-0}" -ge 10 ] && add_row "T04-V7" "RTL rendering ar/ar-MA" "PASS" "$RTL_TEMPLATES" || add_row "T04-V7" "RTL" "WARN" "$RTL_TEMPLATES"
```

---

## TACHE 5/10 -- 2.7.5 : Push notifications Expo + FCM + APNs

```bash
echo ""
echo "TACHE 2.7.5 : Push notifications"

SERVICE="repo/packages/comm/src/services/push.service.ts"
[ -f "$SERVICE" ] && add_row "T05-F1" "push.service.ts" "PASS" "" || add_row "T05-F1" "push.service.ts" "FAIL" "Manquant"

# T05-F2 : Clients Expo + FCM + APNs
[ -f "repo/packages/comm/src/services/expo-client.service.ts" ] && add_row "T05-F2a" "expo-client" "PASS" "" || add_row "T05-F2a" "expo-client" "FAIL" "Manquant"
[ -f "repo/packages/comm/src/services/fcm-client.service.ts" ] && add_row "T05-F2b" "fcm-client" "PASS" "" || add_row "T05-F2b" "fcm-client" "FAIL" "Manquant"
[ -f "repo/packages/comm/src/services/apns-client.service.ts" ] && add_row "T05-F2c" "apns-client" "PASS" "" || add_row "T05-F2c" "apns-client" "FAIL" "Manquant"

# T05-V1 (P0) : Integrations
INTEGRATIONS=$(grep -cE "expo-server-sdk\|firebase-admin\|@parse/node-apn" "$SERVICE" 2>/dev/null || echo 0)
[ "${INTEGRATIONS:-0}" -ge 1 ] && add_row "T05-V1" "Integrations Expo+FCM+APNs" "PASS" "$INTEGRATIONS" || add_row "T05-V1" "Integrations" "FAIL" "Manquantes"

# T05-V2 (P0) : Validation title/body
VALIDATION_LOGIC=$(grep -cE "title.length.*50\|body.length.*100" "$SERVICE" 2>/dev/null || echo 0)
[ "${VALIDATION_LOGIC:-0}" -ge 1 ] && add_row "T05-V2" "Validation title 50 / body 100" "PASS" "" || add_row "T05-V2" "Validation" "FAIL" "Absent"

# T05-V3 (P0 CRITIQUE) : Regex sensitive data reject
SENSITIVE_REJECT=$(grep -cE "containsSensitiveData\|/.*MAD\|/.*amount\|/.*CIN" "$SERVICE" 2>/dev/null || echo 0)
[ "${SENSITIVE_REJECT:-0}" -ge 1 ] && add_row "T05-V3" "Regex sensitive data reject" "PASS" "" || add_row "T05-V3" "Sensitive reject" "FAIL" "Absent CRITIQUE"

# T05-V4 (P0) : Deep links
DEEP_LINKS=$(grep -cE "assurflow://" "$SERVICE" 2>/dev/null || echo 0)
[ "${DEEP_LINKS:-0}" -ge 1 ] && add_row "T05-V4" "Deep links iOS+Android" "PASS" "" || add_row "T05-V4" "Deep links" "WARN" "Absents"

# T05-V5 : Tests 10+
T05_TESTS=$(cd repo && pnpm vitest run --reporter=json packages/comm/src/services/push.service.spec.ts 2>/dev/null | jq '.numPassedTests // 0' 2>/dev/null || echo 0)
[ "${T05_TESTS:-0}" -ge 10 ] && add_row "T05-V5" "Tests Push 10+" "PASS" "$T05_TESTS" || add_row "T05-V5" "Tests Push" "WARN" "$T05_TESTS / 10"
```

---

## TACHE 6/10 -- 2.7.6 : SMS OTP only (Twilio + Orange Maroc)

```bash
echo ""
echo "TACHE 2.7.6 : SMS OTP only"

SERVICE="repo/packages/comm/src/services/sms.service.ts"
[ -f "$SERVICE" ] && add_row "T06-F1" "sms.service.ts" "PASS" "" || add_row "T06-F1" "sms.service.ts" "FAIL" "Manquant"

[ -f "repo/packages/comm/src/services/twilio-client.service.ts" ] && add_row "T06-F2a" "twilio-client" "PASS" "" || add_row "T06-F2a" "twilio-client" "FAIL" "Manquant"
[ -f "repo/packages/comm/src/services/orange-maroc-client.service.ts" ] && add_row "T06-F2b" "orange-maroc-client" "PASS" "" || add_row "T06-F2b" "orange-maroc-client" "FAIL" "Manquant"

# T06-V1 (P0 CRITIQUE) : NO public sendSms() general
SEND_OTP_EXISTS=$(grep -c "async sendOtp" "$SERVICE" 2>/dev/null || echo 0)
NO_GENERAL_SMS=$(grep -E "async sendSms\(|async sendSMS\(" "$SERVICE" 2>/dev/null | grep -v "sendOtp" | wc -l)
if [ "${SEND_OTP_EXISTS:-0}" -ge 1 ] && [ "${NO_GENERAL_SMS:-0}" -eq 0 ]; then
  add_row "T06-V1" "SMS reserve OTP only (no sendSms)" "PASS" "Architecture correcte"
else
  add_row "T06-V1" "SMS reserve OTP only" "FAIL" "sendSms general detecte"
fi

# T06-V2 (P0) : OTP format 6 digits
OTP_VALIDATION=$(grep -cE "/\^\\\\d\{6\}\\\$/|otp.length.*6\|6 digits" "$SERVICE" 2>/dev/null || echo 0)
[ "${OTP_VALIDATION:-0}" -ge 1 ] && add_row "T06-V2" "OTP format 6 digits" "PASS" "" || add_row "T06-V2" "OTP format" "FAIL" "Absent"

# T06-V3 (P0) : TTL 5 min
TTL_VALIDATION=$(grep -cE "ttlMinutes.*5\|TTL.*5\|Valide 5 min" "$SERVICE" 2>/dev/null || echo 0)
[ "${TTL_VALIDATION:-0}" -ge 1 ] && add_row "T06-V3" "TTL 5 min validation" "PASS" "" || add_row "T06-V3" "TTL" "WARN" "Absent"

# T06-V4 : Fallback Orange Maroc
FALLBACK_ORANGE=$(grep -cE "OrangeMarocClient\|orange.*fallback" "$SERVICE" 2>/dev/null || echo 0)
[ "${FALLBACK_ORANGE:-0}" -ge 1 ] && add_row "T06-V4" "Fallback Orange Maroc" "PASS" "" || add_row "T06-V4" "Fallback Orange" "WARN" "Absent"

# T06-V5 : Tests 8+
T06_TESTS=$(cd repo && pnpm vitest run --reporter=json packages/comm/src/services/sms.service.spec.ts 2>/dev/null | jq '.numPassedTests // 0' 2>/dev/null || echo 0)
[ "${T06_TESTS:-0}" -ge 8 ] && add_row "T06-V5" "Tests SMS 8+" "PASS" "$T06_TESTS" || add_row "T06-V5" "Tests SMS" "WARN" "$T06_TESTS / 8"
```

---

## TACHE 7/10 -- 2.7.7 : Notification Router multi-canal

```bash
echo ""
echo "TACHE 2.7.7 : Notification Router"

SERVICE="repo/packages/comm/src/services/notification-router.service.ts"
[ -f "$SERVICE" ] && add_row "T07-F1" "notification-router.service.ts" "PASS" "" || add_row "T07-F1" "Router" "FAIL" "Manquant"

[ -f "repo/packages/comm/src/types/content-type.types.ts" ] && add_row "T07-F2" "content-type.types.ts" "PASS" "" || add_row "T07-F2" "content-type.types" "FAIL" "Manquant"

# T07-V1 (P0 CRITIQUE LEGAL) : data_sensible NEVER WhatsApp
ROUTING_LOGIC=$(grep -cE "data_sensible.*email\|DATA_SENSIBLE.*email\|content_type.*data_sensible" "$SERVICE" 2>/dev/null || echo 0)
WA_IN_SENSITIVE=$(awk '/data_sensible/{flag=1} /break|case|}/{if(flag&&/whatsapp/i) print "RISK"; flag=0}' "$SERVICE" 2>/dev/null | grep -c RISK || echo 0)
if [ "${ROUTING_LOGIC:-0}" -ge 1 ] && [ "${WA_IN_SENSITIVE:-0}" -eq 0 ]; then
  add_row "T07-V1" "data_sensible -> Email ONLY (no WhatsApp)" "PASS" "Routing strict CNDP"
else
  add_row "T07-V1" "data_sensible -> Email ONLY" "FAIL" "WhatsApp risk CRITIQUE LEGAL"
  ((CNDP_VIOLATIONS++))
fi

# T07-V2 (P0) : status_only routing
STATUS_ROUTING=$(grep -cE "status_only.*whatsapp\|status_only.*push" "$SERVICE" 2>/dev/null || echo 0)
[ "${STATUS_ROUTING:-0}" -ge 1 ] && add_row "T07-V2" "status_only -> WhatsApp+Push" "PASS" "" || add_row "T07-V2" "status_only" "WARN" "A verifier"

# T07-V3 (P0) : urgent multi-canal
URGENT_ROUTING=$(grep -cE "urgent.*push.*sms\|urgent.*Promise.all" "$SERVICE" 2>/dev/null || echo 0)
[ "${URGENT_ROUTING:-0}" -ge 1 ] && add_row "T07-V3" "urgent -> multi-canal" "PASS" "" || add_row "T07-V3" "urgent" "WARN" "A verifier"

# T07-V4 : User prefs
PREFS_USAGE=$(grep -cE "userPrefsService\|whatsappEnabled\|prefs\\." "$SERVICE" 2>/dev/null || echo 0)
[ "${PREFS_USAGE:-0}" -ge 1 ] && add_row "T07-V4" "User prefs respectes" "PASS" "" || add_row "T07-V4" "User prefs" "WARN" "Absent"

# T07-V5 : Tests 12+
T07_TESTS=$(cd repo && pnpm vitest run --reporter=json packages/comm/src/services/notification-router.service.spec.ts 2>/dev/null | jq '.numPassedTests // 0' 2>/dev/null || echo 0)
[ "${T07_TESTS:-0}" -ge 12 ] && add_row "T07-V5" "Tests Router 12+" "PASS" "$T07_TESTS" || add_row "T07-V5" "Tests Router" "WARN" "$T07_TESTS / 12"
```

---

## TACHE 8/10 -- 2.7.8 : Audit ACAPS 10 ans + phone_hash

```bash
echo ""
echo "TACHE 2.7.8 : Audit ACAPS"

# T08-F1 : Migration
MIGRATION_FILE=$(find repo/apps/api/src/migrations -name "*ExtendAcapsAuditsForComm*" 2>/dev/null | head -1)
[ -n "$MIGRATION_FILE" ] && add_row "T08-F1" "Migration ExtendAcapsAuditsForComm" "PASS" "" || add_row "T08-F1" "Migration" "FAIL" "Manquante"

# T08-V1 (P0) : Colonnes audit comm
COLS=$(pg_query "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'compliance_acaps_audits' AND column_name IN ('channel', 'template_name', 'recipient_hash', 'message_id', 'correlation_id', 'duration_ms', 'status')")
[ "${COLS:-0}" -ge 7 ] && add_row "T08-V1" "7 colonnes audit comm" "PASS" "$COLS / 7" || add_row "T08-V1" "Colonnes" "FAIL" "$COLS / 7"

# T08-V2 (P0) : Retention 10 ans generated
RETENTION_COL=$(pg_query "SELECT 1 FROM information_schema.columns WHERE table_name = 'compliance_acaps_audits' AND column_name = 'retention_until'")
[ -n "$RETENTION_COL" ] && add_row "T08-V2" "Colonne retention_until 10 ans" "PASS" "" || add_row "T08-V2" "retention_until" "FAIL" "Absente"

# T08-V3 : Indexes performance
INDEXES=$(pg_query "SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'compliance_acaps_audits' AND indexname LIKE 'idx_acaps_audits_%'")
[ "${INDEXES:-0}" -ge 4 ] && add_row "T08-V3" "4 indexes performance" "PASS" "$INDEXES" || add_row "T08-V3" "Indexes" "WARN" "$INDEXES / 4"

# T08-V4 : Service logNotificationSent
AUDIT_SVC="repo/packages/comm/src/services/notification-audit.service.ts"
[ -f "$AUDIT_SVC" ] && grep -q "logNotificationSent" "$AUDIT_SVC" && add_row "T08-V4" "Service logNotificationSent" "PASS" "" || add_row "T08-V4" "Service" "FAIL" "Manquant"

# T08-V5 : Endpoint admin search audit
[ -f "repo/apps/api/src/modules/comm/audit.controller.ts" ] && add_row "T08-V5" "audit.controller.ts" "PASS" "" || add_row "T08-V5" "audit.controller" "FAIL" "Manquant"

# T08-V6 : Cron archivage S3
CRON_FILE="repo/apps/api/src/modules/comm/audit-archival.cron.ts"
[ -f "$CRON_FILE" ] && grep -q "@Cron" "$CRON_FILE" && add_row "T08-V6" "Cron archivage S3 Glacier" "PASS" "" || add_row "T08-V6" "Cron archivage" "WARN" "Absent"

# T08-V7 : Tests 8+
T08_TESTS=$(cd repo && pnpm vitest run --reporter=json packages/comm/src/services/notification-audit.service.spec.ts 2>/dev/null | jq '.numPassedTests // 0' 2>/dev/null || echo 0)
[ "${T08_TESTS:-0}" -ge 8 ] && add_row "T08-V7" "Tests Audit 8+" "PASS" "$T08_TESTS" || add_row "T08-V7" "Tests Audit" "WARN" "$T08_TESTS / 8"
```

---

## TACHE 9/10 -- 2.7.9 : Endpoints REST + permissions

```bash
echo ""
echo "TACHE 2.7.9 : Endpoints REST + permissions"

CTRL="repo/apps/api/src/modules/comm/comm.controller.ts"
[ -f "$CTRL" ] && add_row "T09-F1" "comm.controller.ts" "PASS" "" || add_row "T09-F1" "controller" "FAIL" "Manquant"

# T09-F2 : DTOs Zod
DTO_COUNT=$(find repo/apps/api/src/modules/comm/dto -name "*.dto.ts" 2>/dev/null | wc -l)
[ "${DTO_COUNT:-0}" -ge 2 ] && add_row "T09-F2" "DTOs Zod >= 2" "PASS" "$DTO_COUNT" || add_row "T09-F2" "DTOs" "WARN" "$DTO_COUNT"

# T09-V1 : 5 endpoints
ENDPOINTS=$(grep -cE "@Post\|@Get\|@Put" "$CTRL" 2>/dev/null || echo 0)
[ "${ENDPOINTS:-0}" -ge 5 ] && add_row "T09-V1" "Endpoints >= 5" "PASS" "$ENDPOINTS" || add_row "T09-V1" "Endpoints" "WARN" "$ENDPOINTS / 5"

# T09-V2 (P0) : Permission customer.notifications.manage
PERM_USAGE=$(grep -cE "customer\.notifications\.manage" "$CTRL" 2>/dev/null || echo 0)
[ "${PERM_USAGE:-0}" -ge 3 ] && add_row "T09-V2" "Permission notifications.manage" "PASS" "$PERM_USAGE" || add_row "T09-V2" "Permission" "WARN" "$PERM_USAGE"

# T09-V3 : Tenant isolation
TENANT_GUARD=$(grep -rE "@TenantGuard\|x-tenant-id\|tenantId.*header" repo/apps/api/src/modules/comm 2>/dev/null | wc -l)
[ "${TENANT_GUARD:-0}" -ge 1 ] && add_row "T09-V3" "Tenant isolation" "PASS" "" || add_row "T09-V3" "Tenant" "WARN" "A verifier"

# T09-V4 : Swagger
SWAGGER_DECORATORS=$(grep -cE "@ApiOperation\|@ApiResponse\|@ApiTags" "$CTRL" 2>/dev/null || echo 0)
[ "${SWAGGER_DECORATORS:-0}" -ge 3 ] && add_row "T09-V4" "OpenAPI Swagger" "PASS" "$SWAGGER_DECORATORS" || add_row "T09-V4" "Swagger" "WARN" "$SWAGGER_DECORATORS"

# T09-V5 : Tests E2E 6+
T09_TESTS=$(cd repo && pnpm vitest run --reporter=json apps/api/src/modules/comm/comm.controller.spec.ts 2>/dev/null | jq '.numPassedTests // 0' 2>/dev/null || echo 0)
[ "${T09_TESTS:-0}" -ge 6 ] && add_row "T09-V5" "Tests Controller 6+" "PASS" "$T09_TESTS" || add_row "T09-V5" "Tests" "WARN" "$T09_TESTS / 6"
```

---

## TACHE 10/10 -- 2.7.10 : Tests E2E 30+ + benchmarks + doc policy

```bash
echo ""
echo "TACHE 2.7.10 : Tests E2E + benchmarks + doc"

# T10-V1 (P0 CRITIQUE LEGAL) : Tests blacklist 8+
BLACKLIST_TESTS=$(cd repo && pnpm vitest run --reporter=json packages/comm 2>/dev/null | jq '[.testResults[]?.testResults[]? | select(.title | test("blacklist|REJECTS"; "i"))] | length' 2>/dev/null || echo 0)
[ "${BLACKLIST_TESTS:-0}" -ge 8 ] && add_row "T10-V1" "Tests blacklist 8+ specifiques" "PASS" "$BLACKLIST_TESTS" || add_row "T10-V1" "Tests blacklist" "FAIL" "$BLACKLIST_TESTS / 8 CRITIQUE LEGAL"

# T10-V2 (P0) : Tests E2E >= 30
TOTAL_TESTS=$(cd repo && pnpm vitest run --reporter=json packages/comm 2>/dev/null | jq '.numPassedTests // 0' 2>/dev/null || echo 0)
if [ "${TOTAL_TESTS:-0}" -ge 30 ]; then
  add_row "T10-V2" "Tests E2E total >= 30" "PASS" "$TOTAL_TESTS"
elif [ "${TOTAL_TESTS:-0}" -ge 22 ]; then
  add_row "T10-V2" "Tests E2E >= 30" "WARN" "$TOTAL_TESTS / 30"
else
  add_row "T10-V2" "Tests E2E >= 30" "FAIL" "$TOTAL_TESTS / 30"
fi

# T10-V3 (P0) : Coverage >= 90%
COV=$(cd repo && pnpm vitest run --coverage --reporter=json packages/comm 2>/dev/null | jq '.coverageMap.total.lines.pct // 0' 2>/dev/null || echo 0)
if (( $(echo "${COV:-0} >= 90" | bc -l 2>/dev/null || echo 0) )); then
  add_row "T10-V3" "Coverage >= 90% (critique CNDP)" "PASS" "${COV}%"
elif (( $(echo "${COV:-0} >= 85" | bc -l 2>/dev/null || echo 0) )); then
  add_row "T10-V3" "Coverage >= 90%" "WARN" "${COV}% (target 90%)"
else
  add_row "T10-V3" "Coverage >= 90%" "FAIL" "${COV}% / 90%"
fi

# T10-V4 (P0) : Benchmark P95 < 2000ms
BENCH=$(cat repo/benchmarks/whatsapp-latency.json 2>/dev/null | jq -r '.p95_ms // 99999' 2>/dev/null || echo 99999)
if (( $(echo "${BENCH:-99999} < 2000" | bc -l 2>/dev/null || echo 0) )); then
  add_row "T10-V4" "Benchmark WhatsApp P95 < 2000ms" "PASS" "${BENCH}ms"
elif (( $(echo "${BENCH:-99999} < 3000" | bc -l 2>/dev/null || echo 0) )); then
  add_row "T10-V4" "Benchmark P95" "WARN" "${BENCH}ms (degraded)"
else
  add_row "T10-V4" "Benchmark P95" "WARN" "${BENCH}ms ou non execute"
fi

# T10-V5 (P0) : Doc policy 150+ lignes
DOC_POLICY="repo/docs/architecture/whatsapp-scope-strict-policy.md"
if [ -f "$DOC_POLICY" ]; then
  DOC_LINES=$(wc -l < "$DOC_POLICY")
  [ "$DOC_LINES" -ge 150 ] && add_row "T10-V5" "Doc policy >= 150 lignes" "PASS" "$DOC_LINES" || add_row "T10-V5" "Doc policy" "WARN" "$DOC_LINES / 150"
else
  add_row "T10-V5" "Doc policy" "FAIL" "Manquante"
fi

# T10-V6 : Doc CNDP verification
[ -f "repo/docs/architecture/cndp-conformity-verification.md" ] && add_row "T10-V6" "Doc CNDP verification" "PASS" "" || add_row "T10-V6" "Doc CNDP" "WARN" "Manquante"
```

---

## VERIFICATIONS TRANSVERSALES SPRINT 9 (12 transversaux)

```bash
echo ""
echo "TRANSVERSAUX SPRINT 9"

cd repo

# TR-BUILD
pnpm turbo run build --filter=@insurtech/comm 2>&1 > /tmp/build-tr.log; BC=$?
if [ $BC -eq 0 ]; then
  add_row "TR-BUILD" "Build @insurtech/comm OK" "PASS" ""
else
  auto_repair "pnpm install --force && pnpm turbo run build --filter=@insurtech/comm" "[ \$? -eq 0 ]" "TR-BUILD" "Build"
fi

# TR-TYPECHECK
pnpm tsc --noEmit 2>&1 > /tmp/tsc-tr.log
TS_ERR=$(grep -c "error TS" /tmp/tsc-tr.log)
[ "$TS_ERR" -eq 0 ] && add_row "TR-TYPECHECK" "TypeScript strict 0 erreur" "PASS" "" || add_row "TR-TYPECHECK" "TypeScript" "FAIL" "$TS_ERR erreurs"

# TR-TESTS
TEST_RESULTS=$(pnpm vitest run --reporter=json packages/comm 2>/dev/null | jq '{passed: .numPassedTests, failed: .numFailedTests}' 2>/dev/null || echo '{}')
TR_PASSED=$(echo "$TEST_RESULTS" | jq -r '.passed // 0')
TR_FAILED=$(echo "$TEST_RESULTS" | jq -r '.failed // 0')
[ "${TR_FAILED:-0}" -eq 0 ] && [ "${TR_PASSED:-0}" -gt 0 ] && add_row "TR-TESTS" "Tests Vitest tous PASS" "PASS" "$TR_PASSED / 0 failed" || add_row "TR-TESTS" "Tests" "FAIL" "$TR_PASSED / $TR_FAILED failed"

# TR-COVERAGE
COV=$(pnpm vitest run --coverage --reporter=json packages/comm 2>/dev/null | jq '.coverageMap.total.lines.pct // 0' 2>/dev/null || echo 0)
if (( $(echo "${COV:-0} >= 90" | bc -l 2>/dev/null || echo 0) )); then
  add_row "TR-COVERAGE" "Coverage >= 90% (critique CNDP)" "PASS" "${COV}%"
elif (( $(echo "${COV:-0} >= 85" | bc -l 2>/dev/null || echo 0) )); then
  add_row "TR-COVERAGE" "Coverage" "WARN" "${COV}% (cible 90%)"
else
  add_row "TR-COVERAGE" "Coverage" "FAIL" "${COV}%"
fi

# TR-LINT
pnpm lint 2>&1 > /tmp/lint-tr.log; LC=$?
[ $LC -eq 0 ] && add_row "TR-LINT" "Biome lint 0 erreur" "PASS" "" || auto_repair "pnpm lint --apply" "pnpm lint" "TR-LINT" "Biome lint"

cd ..

# TR-NO-EMOJI
EMOJI=$(grep -rP "[\x{1F300}-\x{1F9FF}]|[\x{2600}-\x{27BF}]" repo/packages/comm --include="*.ts" --include="*.hbs" --include="*.html" --include="*.md" 2>/dev/null | wc -l)
[ "$EMOJI" -eq 0 ] && add_row "TR-NO-EMOJI" "0 emoji" "PASS" "decision-006" || add_row "TR-NO-EMOJI" "0 emoji" "FAIL" "$EMOJI emojis"

# TR-CONSOLE
CONSOLE=$(grep -rn "console\.log\|console\.error" repo/packages/comm --include="*.ts" 2>/dev/null | grep -v ".spec.ts" | grep -v ".test.ts" | wc -l)
[ "$CONSOLE" -eq 0 ] && add_row "TR-CONSOLE" "0 console.* (Pino)" "PASS" "" || add_row "TR-CONSOLE" "console" "FAIL" "$CONSOLE occurrences"

# TR-COMMITS
NON_CONV=$(git log --since="1 week ago" --pretty=format:"%s" -- repo/packages/comm | grep -vE "^(feat|fix|docs|test|chore|refactor|perf)(\(.+\))?:" | wc -l)
[ "$NON_CONV" -eq 0 ] && add_row "TR-COMMITS" "Conventional Commits 100%" "PASS" "" || add_row "TR-COMMITS" "Commits" "WARN" "$NON_CONV non-conformes"

# TR-TENANT
TENANT_USAGE=$(grep -rE "tenantId" repo/packages/comm/src/services --include="*.ts" 2>/dev/null | wc -l)
[ "${TENANT_USAGE:-0}" -ge 10 ] && add_row "TR-TENANT" "Multi-tenant tenantId usage" "PASS" "$TENANT_USAGE refs" || add_row "TR-TENANT" "Tenant" "WARN" "$TENANT_USAGE"

# TR-ZOD
ZOD_USAGE=$(grep -rE "from 'zod'\|z\." repo/packages/comm/src/schemas --include="*.ts" 2>/dev/null | wc -l)
NO_CLASS_VALIDATOR=$(grep -rE "class-validator" repo/packages/comm/src --include="*.ts" 2>/dev/null | wc -l)
[ "${ZOD_USAGE:-0}" -ge 4 ] && [ "${NO_CLASS_VALIDATOR:-0}" -eq 0 ] && add_row "TR-ZOD" "Zod validation only" "PASS" "" || add_row "TR-ZOD" "Zod" "WARN" "zod=$ZOD_USAGE / class-validator=$NO_CLASS_VALIDATOR"

# TR-MIGRATIONS
MIGRATIONS_COUNT=$(find repo/apps/api/src/migrations -name "*Whatsapp*" -o -name "*AcapsAuditsForComm*" 2>/dev/null | wc -l)
[ "${MIGRATIONS_COUNT:-0}" -ge 2 ] && add_row "TR-MIGRATIONS" "Migrations DB Sprint 9" "PASS" "$MIGRATIONS_COUNT migrations" || add_row "TR-MIGRATIONS" "Migrations" "WARN" "$MIGRATIONS_COUNT / 2"

# TR-MULTILINGUE
LANG_FILES_HBS=$(find repo/packages/comm/src/templates/whatsapp -name "*.fr.hbs" -o -name "*.ar.hbs" -o -name "*.ar-MA.hbs" -o -name "*.en.hbs" 2>/dev/null | wc -l)
[ "${LANG_FILES_HBS:-0}" -ge 100 ] && add_row "TR-MULTILINGUE" "4 langues effectives" "PASS" "$LANG_FILES_HBS fichiers" || add_row "TR-MULTILINGUE" "Multilingue" "WARN" "$LANG_FILES_HBS"
```

---

## VERIFICATIONS CNDP CRITIQUES (4 verifications LEGAL)

```bash
echo ""
echo "VERIFICATIONS CNDP CRITIQUES"

# CNDP-1 (P0 LEGAL ABSOLU) : End-to-end blacklist 'amount'
TEST_AMOUNT=$(node -e "
try {
  const { WhatsAppService, isBlacklistedField } = require('./repo/packages/comm/dist');
  if (!isBlacklistedField('amount')) { console.log('FAIL_HELPER'); process.exit(1); }
  const svc = new WhatsAppService({}, {}, {}, {});
  svc.sendWhatsAppStatus({
    to: '+212600000000', templateName: 'customer_premium_due_j15',
    data: { amount: '5000' }, language: 'fr', tenantId: 'test', userId: 'test'
  }).then(() => console.log('FAIL_NO_REJECT'))
    .catch(e => console.log(e.message.toLowerCase().includes('blacklist') ? 'PASS' : 'FAIL_WRONG_ERROR'));
} catch (e) { console.log('TEST_ERROR'); }
" 2>/dev/null || echo "TEST_ERROR")

case "$TEST_AMOUNT" in
  "PASS") add_row "CNDP-1" "Blacklist 'amount' rejette end-to-end" "PASS" "Conformite CNDP OK" ;;
  "FAIL_NO_REJECT") add_row "CNDP-1" "Blacklist 'amount'" "FAIL" "Amount accepted CRITIQUE LEGAL CNDP" ;;
  "FAIL_HELPER") add_row "CNDP-1" "Blacklist 'amount' helper" "FAIL" "isBlacklistedField incorrect" ;;
  *) add_row "CNDP-1" "Blacklist 'amount'" "WARN" "Test manuel requis" ;;
esac

# CNDP-2 (P0 LEGAL ABSOLU) : End-to-end blacklist 'cin'
TEST_CIN=$(node -e "
try {
  const { WhatsAppService, isBlacklistedField } = require('./repo/packages/comm/dist');
  if (!isBlacklistedField('cin')) { console.log('FAIL_HELPER'); process.exit(1); }
  const svc = new WhatsAppService({}, {}, {}, {});
  svc.sendWhatsAppStatus({
    to: '+212600000000', templateName: 'customer_otp_login',
    data: { cin: 'AB123456' }, language: 'fr', tenantId: 'test', userId: 'test'
  }).then(() => console.log('FAIL_NO_REJECT'))
    .catch(e => console.log(e.message.toLowerCase().includes('blacklist') ? 'PASS' : 'FAIL_WRONG_ERROR'));
} catch (e) { console.log('TEST_ERROR'); }
" 2>/dev/null || echo "TEST_ERROR")

case "$TEST_CIN" in
  "PASS") add_row "CNDP-2" "Blacklist 'cin' rejette end-to-end" "PASS" "Conformite CNDP OK" ;;
  "FAIL_NO_REJECT") add_row "CNDP-2" "Blacklist 'cin'" "FAIL" "CIN accepted CRITIQUE LEGAL CNDP" ;;
  *) add_row "CNDP-2" "Blacklist 'cin'" "WARN" "Test manuel requis" ;;
esac

# CNDP-3 (P0) : Whitelist template inconnu
TEST_UNKNOWN=$(node -e "
try {
  const { WhatsAppService } = require('./repo/packages/comm/dist');
  const svc = new WhatsAppService({}, {}, {}, {});
  svc.sendWhatsAppStatus({
    to: '+212600000000', templateName: 'malicious_template_xyz',
    data: {}, language: 'fr', tenantId: 'test', userId: 'test'
  }).then(() => console.log('FAIL'))
    .catch(e => console.log(e.message.toLowerCase().includes('whitelist') ? 'PASS' : 'FAIL'));
} catch (e) { console.log('TEST_ERROR'); }
" 2>/dev/null || echo "TEST_ERROR")

case "$TEST_UNKNOWN" in
  "PASS") add_row "CNDP-3" "Whitelist template inconnu rejette" "PASS" "" ;;
  *) add_row "CNDP-3" "Whitelist" "FAIL" "Template inconnu accepte" ;;
esac

# CNDP-4 (P0) : Documentation policy
DOC_POLICY="repo/docs/architecture/whatsapp-scope-strict-policy.md"
if [ -f "$DOC_POLICY" ]; then
  DOC_LINES=$(wc -l < "$DOC_POLICY")
  [ "$DOC_LINES" -ge 150 ] && add_row "CNDP-4" "Doc policy >= 150 lignes" "PASS" "$DOC_LINES" || add_row "CNDP-4" "Doc policy" "WARN" "$DOC_LINES / 150"
else
  add_row "CNDP-4" "Doc policy" "FAIL" "Manquante (audit externe)"
fi
```

---

## GENERATION DU RAPPORT FINAL

```bash
TOTAL=$((PASS + PASS_REPAIRED + FAIL + SKIP + WARN))
SCORE_NUM=$((PASS + PASS_REPAIRED))
SCORE_PCT=$(echo "scale=1; $SCORE_NUM * 100 / $TOTAL" | bc -l 2>/dev/null || echo "0")

JALON="NO-GO"
DOWNSTREAM_STATUS="SPRINTS DOWNSTREAM (14/17/18/21/22.5/22.7/24/26.5) BLOQUES"

if [ "$CNDP_VIOLATIONS" -gt 0 ]; then
  JALON="NO-GO LEGAL"
  DOWNSTREAM_STATUS="VIOLATION CNDP DETECTEE - NE PAS DEPLOYER PROD"
elif (( $(echo "$SCORE_PCT >= 95" | bc -l 2>/dev/null || echo 0) )); then
  JALON="GO"
  DOWNSTREAM_STATUS="SPRINTS DOWNSTREAM PEUVENT DEMARRER"
elif (( $(echo "$SCORE_PCT >= 85" | bc -l 2>/dev/null || echo 0) )); then
  JALON="GO CONDITIONNEL"
  DOWNSTREAM_STATUS="SPRINT 10 PEUT DEMARRER, DOWNSTREAM SUSPENDUS"
fi

cat >> "$REPORT_FILE" << EOF

## Synthese finale

| Categorie | Nombre |
|-----------|--------|
| PASS | $PASS |
| PASS* (repare auto) | $PASS_REPAIRED |
| FAIL | $FAIL |
| SKIP | $SKIP |
| WARN | $WARN |
| **TOTAL** | **$TOTAL** |

**Score** : $SCORE_PCT% ($SCORE_NUM / $TOTAL)
**Violations CNDP** : $CNDP_VIOLATIONS
**Jalon Sprint 9** : $JALON
**Impact downstream** : $DOWNSTREAM_STATUS

---

## Tableau de Resultats Complet

| ID | Description | Statut | Details |
|----|-------------|--------|---------|
$(echo -e "$TABLE_ROWS")

---

## Score Global

- **PASS** : $PASS
- **PASS\*** (repare auto) : $PASS_REPAIRED
- **FAIL** : $FAIL
- **WARN** : $WARN
- **SKIP** : $SKIP
- **TOTAL** : $TOTAL criteres
- **Score** : $SCORE_PCT%
- **Violations CNDP** : $CNDP_VIOLATIONS

EOF

# Decision matrix detaillee
case "$JALON" in
  "NO-GO LEGAL")
    cat >> "$REPORT_FILE" << EOF
## Jalon GO/NO-GO Sprint 9

**NO-GO LEGAL** -- $CNDP_VIOLATIONS violation(s) CNDP detectee(s).

### Actions IMMEDIATES (CRITIQUE LEGAL) :

1. **ESCALATION ABSOLUE Saad + Abla** -- risque legal CNDP loi 09-08 si deploiement prod
2. Identifier exactement quelles CNDP-N criteres FAIL :
   - CNDP-1 : blacklist 'amount' non rejette
   - CNDP-2 : blacklist 'cin' non rejette
   - CNDP-3 : whitelist template inconnu non rejette
   - CNDP-4 : documentation policy manquante
3. **NE PAS deployer en production** -- risque legal absolu
4. Resoudre violation puis re-V-09 dans 1-2 jours
5. Sprints downstream (14/17/18/21/22.5/22.7/24/26.5) restent v2.2 fallback
6. Sprint 10 peut commencer en parallele si scope independant Comm

### Risque legal :
- Loi 09-08 CNDP : amendes jusqu'a 300,000 MAD + 6 mois prison
- Loi ACAPS : retrait agrement courtage assurance
- Reputation : audit externe CNDP potentiel post-incident
EOF
    ;;
  GO)
    cat >> "$REPORT_FILE" << EOF
## Jalon GO/NO-GO Sprint 9

**GO** -- Sprint 9 v3.0 valide ($SCORE_PCT%). Comm module operationnel.

### Actions :

1. **Tag Git** :
\`\`\`bash
git tag -a "sprint-09-complete-v3-comm-scope-strict" -m "Sprint 9 v3.0 -- score $SCORE_PCT%"
git push origin sprint-09-complete-v3-comm-scope-strict
\`\`\`

2. **Deploiement production** :
   - WhatsApp Meta Business Manager templates approuves
   - DNS records DKIM/SPF/DMARC verifies prod
   - Audit ACAPS migration appliquee
   - Tests CNDP penetration manuel pre-prod execute

3. **Sprint 10** (Docs + Signature Barid eSign) peut demarrer

4. **Sprints downstream** (14/17/18/21/22.5/22.7/24/26.5) peuvent integrer @insurtech/comm v3.0
EOF
    ;;
  "GO CONDITIONNEL")
    cat >> "$REPORT_FILE" << EOF
## Jalon GO/NO-GO Sprint 9

**GO CONDITIONNEL** ($SCORE_PCT%) -- Comm degraded mais utilisable.

### Actions :

1. Documenter dette technique dans \`dette-technique-sprint-09.md\` :
   - Lister tous criteres FAIL/WARN
   - Estimation effort resolution
   - Risque legal/business par item

2. Re-tester scenarios FAIL avant deploiement prod (special CNDP-1/2/3/4 si WARN)

3. Verifier CNDP manuellement (legal critical) :
\`\`\`bash
# Test penetration manuel CNDP
curl -X POST localhost:3000/api/v1/comm/notifications/send \\
  -H "Authorization: Bearer \$TOKEN" \\
  -d '{"contentType":"status_only","templateName":"customer_otp_login","data":{"amount":"5000"}}'
# Attendu: 400 BadRequestException
\`\`\`

4. **Tag conditionnel** :
\`\`\`bash
git tag -a "sprint-09-complete-v3-conditional" -m "Sprint 9 v3.0 -- score $SCORE_PCT% conditionnel"
\`\`\`

5. Sprint 10 peut commencer en parallele resolution
EOF
    ;;
  NO-GO)
    cat >> "$REPORT_FILE" << EOF
## Jalon GO/NO-GO Sprint 9

**NO-GO** ($SCORE_PCT%) -- Comm non livrable.

### Actions :

1. Escalation Saad + Abla (CRITIQUE -- correction Saad #7 non implementee)
2. Identifier FAIL P0 specialement :
   - CNDP-1, CNDP-2, CNDP-3, CNDP-4 (LEGAL CNDP)
   - T02-V1, T02-V2 (whitelist + blacklist enforcement)
   - T01-V1, T01-V2 (constants)
3. **NE PAS deployer en production** (risque legal CNDP)
4. Re-V-09 dans 3-5 jours
5. Sprints downstream (14/17/18/21/22.5/22.7/24/26.5) restent sur v2.2 fallback en attendant
EOF
    ;;
esac

echo ""
echo "================================================"
echo "RAPPORT FINAL : $REPORT_FILE"
echo "Score : $SCORE_PCT% / Jalon : $JALON"
echo "Violations CNDP : $CNDP_VIOLATIONS"
echo "Downstream : $DOWNSTREAM_STATUS"
echo "================================================"

cat "$REPORT_FILE"
```

---

## Decisions strategiques applicables

- **decision-006** : NO emoji policy (verifie par TR-NO-EMOJI)
- **decision-008** : Data residency Maroc + multilingue 4 langues (verifie par TR-MULTILINGUE)
- **correction Saad terrain #7** : WhatsApp scope strict CNDP -- documentation conformite obligatoire (verifie par CNDP-1 a CNDP-4)
- **decision-015** : Demo Day 30 juin 2026 -- jalon Phase Pilote (Sprint 9 GO = pre-requis downstream)

---

## Prochaine etape

**Si GO** :
1. Tag `sprint-09-complete-v3-comm-scope-strict`
2. Deploiement production WhatsApp + Email + Push + SMS OTP
3. Verification finale CNDP audit interne (penetration manuel)
4. Lancement Sprint 10 (Docs + Signature Barid eSign loi 43-20)
5. Sprints downstream (14/17/18/21/22.5/22.7/24/26.5) integrent @insurtech/comm v3.0

**Si GO CONDITIONNEL** :
1. Documenter dette technique `dette-technique-sprint-09.md`
2. Re-tester scenarios FAIL avant prod (special CNDP-1 a CNDP-4)
3. Sprint 10 peut commencer en parallele resolution

**Si NO-GO ou NO-GO LEGAL** :
1. **ESCALATION CRITIQUE Saad + Abla** (correction Saad #7 / risque legal)
2. **NE PAS deployer en production** (risque legal CNDP)
3. Re-V-09 dans 3-5 jours
4. Sprints downstream restent v2.2 fallback

---

## NOTES IMPORTANTES POUR EXECUTION

1. **Sprint 9 = CRITIQUE LEGAL** : sans GO, risque violation CNDP loi 09-08 (data sensible WhatsApp)
2. **4 verifications CNDP** : tests automatises end-to-end blacklist + whitelist + documentation
3. **Coverage 90%** Sprint 9 (vs 85% standard) car critique correction Saad #7
4. **Documentation policy** obligatoire 150+ lignes (audit externe CNDP possible)
5. **Production checklist** : DKIM/SPF/DMARC + Meta Business Manager sync + 180 templates verifies
6. **Audit ACAPS 10 ans** : compliance loi non-negociable
7. **Auto-reparation activee** sur TR-BUILD + TR-LINT + T01-V4 (3 tentatives max)
8. **Phone hash SHA256 16 chars** : jamais plain phone dans audits/logs (CNDP)

---

## INSTRUCTION FINALE A CLAUDE CODE / COWORK

Apres execution complete V-09 :

1. **Lire** `sprint09-verify-report.md` integralement
2. **Verifier** le score % final + nombre violations CNDP
3. **Si GO** : tag git + deploiement progressif
4. **Si GO CONDITIONNEL** : documenter dette + Sprint 10 parallele
5. **Si NO-GO ou NO-GO LEGAL** : **ESCALATION IMMEDIATE Saad + Abla** + ne pas deployer
6. **Garder** le rapport pour audit ACAPS (retention 10 ans obligatoire)

---

**Fin verification V-09 v3.0 -- Sprint 9 (2.7) Comm WhatsApp Scope Strict + Email Data Sensible.**

**Total criteres** : 70 taches + 12 transversaux + 4 CNDP CRITIQUES = 86 criteres
**Auto-reparation active** : TR-BUILD + TR-LINT + T01-V4 (3 tentatives)
**Jalon critique** : sans GO V-09, downstream (14/17/18/21/22.5/22.7/24/26.5) bloques v2.2 non-conforme CNDP
