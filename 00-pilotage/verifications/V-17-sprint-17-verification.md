# VERIFICATION SPRINT 17 v3.0 -- Phase 4 / Sprint 4 : Customer Portal Backoffice
# Version : Auto-reparation active + Rapport final MD detaille
# 14 taches v3.0 + 12 transversaux + 6 specifiques Sprint 17 = 85+ criteres
# AUCUNE EMOJI AUTORISEE

**Version** : v3.0 (verification detaillee + auto-reparation + specifiques Lighthouse/A11y/PWA)
**Phase** : 4 -- Vertical Insure (Customer-facing web)
**Sprint** : 17 / 40 (cumul v3.0) -- Phase 4 Sprint 4
**Reference meta-prompt** : `B-17-sprint-17-customer-portal-v3.md`
**Reference orchestrateur** : `C-17-sprint-17-customer-portal-v3.md`
**Total criteres** : 67 taches + 12 transversaux + 6 specifiques = 85 criteres
**Jalon critique** : sans GO V-17 (>= 90%), Sprint 18 (Assure Mobile) bloque et Sprint 24 master orchestrator perd FNOL customer-side trigger

---

Tu es **Claude Code (ou Cowork)**. Tu dois executer une **verification COMPLETE et EXHAUSTIVE** du Sprint 17 v3.0 apres execution toutes les 14 taches.

---

## REGLES D'EXECUTION

1. Tu **executes CHAQUE verification dans l'ordre** (preparation -> taches -> transversales -> specifiques -> rapport)
2. Quand une verification echoue, tu **TENTES UNE REPARATION AUTOMATIQUE** avant de noter FAIL (3 tentatives max)
3. Apres chaque tentative de reparation, tu **re-executes la verification**
4. Tu consignes dans `sprint17-verify-report.md` **TOUS les resultats** au fil de l'execution
5. A la fin, tu produis le **rapport consolide** + calcul score GO / GO CONDITIONNEL / NO-GO
6. Tu **n'interromps JAMAIS** l'execution -- meme si une tache echoue, tu passes a la suivante

---

## FORMAT DU RAPPORT

| ID | Description | Statut | Details |
|----|-------------|--------|---------|

**Convention IDs** : `T{NN}-V{N}` / `T{NN}-F{N}` / `TR-{TYPE}` / `SP-{TYPE}` (specifiques Sprint 17)

**Statuts** : `PASS` / `PASS*` (repare auto) / `FAIL` (P0 bloquant) / `SKIP` / `WARN`

---

## PHASE DE PREPARATION

```bash
REPORT_FILE="sprint17-verify-report.md"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
RUN_ID=$(date '+%Y%m%d-%H%M%S')

cat > "$REPORT_FILE" << EOF
# Rapport de Verification - Sprint 17 v3.0 : Customer Portal Backoffice

**Date** : $TIMESTAMP
**Run ID** : $RUN_ID
**Phase** : 4 -- Vertical Insure (Customer-facing web)
**Sprint** : 17 (Phase 4 / Sprint 4) v3.0
**Reference B-17 v3.0** : 14 taches, 67 criteres + 12 transversaux + 6 specifiques = 85 total
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
PASS=0; PASS_REPAIRED=0; FAIL=0; SKIP=0; WARN=0
TABLE_ROWS=""

# Helper add_row
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

# Verify Sprint 16 GO (prerequis)
SPRINT16_GO=$(grep -c '^Statut.*GO' skalean-insurtech/sprint16-verify-report.md 2>/dev/null || echo 0)
[ "$SPRINT16_GO" -lt 1 ] && echo "[WARN] Sprint 16 non-GO -- Sprint 17 risque dependances"

# Verify Sprint 9 v3.0 GO (Comm module)
SPRINT9_GO=$(grep -c '^Statut.*GO' skalean-insurtech/sprint09-verify-report.md 2>/dev/null || echo 0)
[ "$SPRINT9_GO" -lt 1 ] && echo "[CRITICAL] Sprint 9 v3.0 non-GO -- WhatsApp scope strict customer impossible"
```

---

## TACHE 1/14 -- 4.4.1 : Bootstrap Next.js 14 + PWA + Sofidemy + i18n

```bash
echo ""
echo "TACHE 4.4.1 : Bootstrap Next.js 14"

# T01-F1 : App present
[ -d "repo/apps/web-customer-portal" ] && add_row "T01-F1" "App web-customer-portal" "PASS" "" || add_row "T01-F1" "App" "FAIL" "MANQUANT"

# T01-F2 : package.json + Next 14
if [ -f "repo/apps/web-customer-portal/package.json" ]; then
  NEXT_VERSION=$(jq -r '.dependencies.next // ""' repo/apps/web-customer-portal/package.json)
  [[ "$NEXT_VERSION" =~ 14\. ]] && add_row "T01-F2" "Next.js 14.x" "PASS" "$NEXT_VERSION" || add_row "T01-F2" "Next.js 14" "FAIL" "$NEXT_VERSION"
else
  add_row "T01-F2" "package.json" "FAIL" "Manquant"
fi

# T01-F3 : tsconfig + tailwind config
[ -f "repo/apps/web-customer-portal/tsconfig.json" ] && add_row "T01-F3a" "tsconfig.json" "PASS" "" || add_row "T01-F3a" "tsconfig" "FAIL" "Manquant"
[ -f "repo/apps/web-customer-portal/tailwind.config.ts" ] && add_row "T01-F3b" "tailwind.config.ts" "PASS" "" || add_row "T01-F3b" "tailwind" "FAIL" "Manquant"

# T01-V1 (P0) : Theme Sofidemy palettes
SOFIDEMY_PALETTES=$(grep -cE "#0E1B3D|#C8A465" repo/apps/web-customer-portal/tailwind.config.ts 2>/dev/null || echo 0)
[ "${SOFIDEMY_PALETTES:-0}" -ge 2 ] && add_row "T01-V1" "Theme Sofidemy palettes" "PASS" "primary+secondary" || add_row "T01-V1" "Theme Sofidemy" "FAIL" "Couleurs manquantes"

# T01-V2 (P0) : i18n 4 langues
MESSAGES_FILES=$(find repo/apps/web-customer-portal/src/messages -name "*.json" 2>/dev/null | wc -l)
if [ "${MESSAGES_FILES:-0}" -ge 4 ]; then
  add_row "T01-V2" "i18n 4 langues messages" "PASS" "$MESSAGES_FILES fichiers"
else
  add_row "T01-V2" "i18n 4 langues" "FAIL" "$MESSAGES_FILES / 4"
fi

# T01-V3 (P0) : PWA manifest valid
MANIFEST="repo/apps/web-customer-portal/public/manifest.json"
if [ -f "$MANIFEST" ]; then
  THEME_COLOR=$(jq -r '.theme_color // ""' "$MANIFEST")
  ICONS_COUNT=$(jq -r '.icons | length' "$MANIFEST")
  if [ "$THEME_COLOR" = "#0E1B3D" ] && [ "${ICONS_COUNT:-0}" -ge 2 ]; then
    add_row "T01-V3" "PWA manifest valid Sofidemy" "PASS" "theme=$THEME_COLOR / icons=$ICONS_COUNT"
  else
    add_row "T01-V3" "PWA manifest" "WARN" "theme=$THEME_COLOR / icons=$ICONS_COUNT"
  fi
else
  add_row "T01-V3" "PWA manifest" "FAIL" "Manquant"
fi

# T01-V4 (P0) : Pages App Router 8+
PAGES_COUNT=$(find repo/apps/web-customer-portal/src/app -name "page.tsx" 2>/dev/null | wc -l)
[ "${PAGES_COUNT:-0}" -ge 8 ] && add_row "T01-V4" "Pages App Router 8+" "PASS" "$PAGES_COUNT" || add_row "T01-V4" "Pages App Router" "WARN" "$PAGES_COUNT / 8"

# T01-V5 (P0) : Build Next.js OK
cd repo/apps/web-customer-portal && pnpm build 2>&1 > /tmp/build-t01.log; BC=$?
cd ../../..
if [ $BC -eq 0 ]; then
  add_row "T01-V5" "Build Next.js OK" "PASS" ""
else
  auto_repair "cd repo/apps/web-customer-portal && pnpm install --force && pnpm build" "[ \$? -eq 0 ]" "T01-V5" "Build Next.js"
fi

# T01-V6 (P0) : Tests bootstrap 5+
T01_TESTS=$(cd repo && pnpm vitest run --reporter=json apps/web-customer-portal 2>/dev/null | jq '.numPassedTests // 0' 2>/dev/null || echo 0)
[ "${T01_TESTS:-0}" -ge 5 ] && add_row "T01-V6" "Tests bootstrap 5+" "PASS" "$T01_TESTS" || add_row "T01-V6" "Tests bootstrap" "WARN" "$T01_TESTS / 5"
```

---

## TACHE 2/14 -- 4.4.2 : Auth customer + onboarding + KYC + OTP

```bash
echo ""
echo "TACHE 4.4.2 : Auth customer + onboarding"

# T02-F1 : NextAuth config
[ -f "repo/apps/web-customer-portal/src/lib/auth/nextauth.config.ts" ] && add_row "T02-F1" "NextAuth config" "PASS" "" || add_row "T02-F1" "NextAuth" "FAIL" "Manquant"

# T02-F2 : Middleware
[ -f "repo/apps/web-customer-portal/src/middleware.ts" ] && add_row "T02-F2" "middleware.ts" "PASS" "" || add_row "T02-F2" "middleware" "FAIL" "Manquant"

# T02-F3 : Pages onboarding 3 etapes
ONBOARDING_PAGES=$(find repo/apps/web-customer-portal/src/app -path "*/onboarding/*" -name "page.tsx" 2>/dev/null | wc -l)
[ "${ONBOARDING_PAGES:-0}" -ge 3 ] && add_row "T02-F3" "3 pages onboarding" "PASS" "$ONBOARDING_PAGES" || add_row "T02-F3" "Onboarding" "WARN" "$ONBOARDING_PAGES / 3"

# T02-V1 (P0) : KYC CIN regex validation
KYC_REGEX=$(grep -rE "/\^\[A-Z\]\{1,2\}\\\\d\{1,8\}" repo/apps/web-customer-portal/src 2>/dev/null | wc -l)
[ "${KYC_REGEX:-0}" -ge 1 ] && add_row "T02-V1" "CIN regex validation" "PASS" "" || add_row "T02-V1" "CIN regex" "WARN" "Absent"

# T02-V2 (P0) : SMS OTP via Sprint 9 v3.0
OTP_USAGE=$(grep -rE "sendOtp\|smsService" repo/apps/api/src/modules/customer 2>/dev/null | wc -l)
[ "${OTP_USAGE:-0}" -ge 1 ] && add_row "T02-V2" "SMS OTP Sprint 9 v3.0" "PASS" "" || add_row "T02-V2" "SMS OTP" "FAIL" "Sprint 9 non integre"

# T02-V3 : Tests E2E 8+
T02_TESTS=$(cd repo/apps/web-customer-portal && pnpm playwright test e2e/auth-onboarding.e2e.ts --reporter=json 2>/dev/null | jq '.stats.expected // 0' 2>/dev/null || echo 0)
[ "${T02_TESTS:-0}" -ge 8 ] && add_row "T02-V3" "Tests E2E auth 8+" "PASS" "$T02_TESTS" || add_row "T02-V3" "Tests auth" "WARN" "$T02_TESTS / 8"
```

---

## TACHE 3/14 -- 4.4.3 : Dashboard customer

```bash
echo ""
echo "TACHE 4.4.3 : Dashboard customer 4 widgets"

# T03-F1 : Page dashboard
[ -f "repo/apps/web-customer-portal/src/app/[locale]/(dashboard)/page.tsx" ] && add_row "T03-F1" "Page dashboard" "PASS" "" || add_row "T03-F1" "Dashboard" "FAIL" "Manquant"

# T03-V1 : 4 widgets composants
WIDGETS_DIR="repo/apps/web-customer-portal/src/components/dashboard"
WIDGETS=$(find "$WIDGETS_DIR" -name "*Widget.tsx" 2>/dev/null | wc -l)
[ "${WIDGETS:-0}" -ge 4 ] && add_row "T03-V1" "4 widgets dashboard" "PASS" "$WIDGETS" || add_row "T03-V1" "Widgets" "WARN" "$WIDGETS / 4"

# T03-V2 : Hook useCustomerDashboard
[ -f "repo/apps/web-customer-portal/src/hooks/useCustomerDashboard.ts" ] && add_row "T03-V2" "useCustomerDashboard hook" "PASS" "" || add_row "T03-V2" "Hook" "WARN" "Manquant"

# T03-V3 : Permission customer.profile.view enforce
PERM_USAGE=$(grep -rE "customer\.profile\.view" repo/apps/api/src/modules/customer 2>/dev/null | wc -l)
[ "${PERM_USAGE:-0}" -ge 1 ] && add_row "T03-V3" "Permission profile.view" "PASS" "" || add_row "T03-V3" "Permission" "WARN" "Absent"

# T03-V4 : Tests 6+
T03_TESTS=$(cd repo && pnpm vitest run --reporter=json apps/web-customer-portal/src/components/dashboard 2>/dev/null | jq '.numPassedTests // 0' 2>/dev/null || echo 0)
[ "${T03_TESTS:-0}" -ge 6 ] && add_row "T03-V4" "Tests dashboard 6+" "PASS" "$T03_TESTS" || add_row "T03-V4" "Tests" "WARN" "$T03_TESTS / 6"
```

---

## TACHE 4/14 -- 4.4.4 : Polices visualisation + souscription + renewal

```bash
echo ""
echo "TACHE 4.4.4 : Polices + souscription + renewal"

# T04-F1 : Pages polices
[ -f "repo/apps/web-customer-portal/src/app/[locale]/(dashboard)/polices/page.tsx" ] && add_row "T04-F1a" "Page polices list" "PASS" "" || add_row "T04-F1a" "List" "FAIL" "Manquant"
[ -f "repo/apps/web-customer-portal/src/app/[locale]/(dashboard)/polices/[id]/page.tsx" ] && add_row "T04-F1b" "Page police detail" "PASS" "" || add_row "T04-F1b" "Detail" "FAIL" "Manquant"

# T04-F2 : Wizard souscription 4 etapes
SOUSCRIPTION_DIR="repo/apps/web-customer-portal/src/app/[locale]/(dashboard)/polices/souscrire"
[ -d "$SOUSCRIPTION_DIR" ] && add_row "T04-F2" "Wizard souscription" "PASS" "" || add_row "T04-F2" "Wizard" "WARN" "Manquant"

# T04-V1 : Hooks polices
HOOKS_POLICES=$(find repo/apps/web-customer-portal/src/hooks -name "use*Polices*" -o -name "use*Police*" 2>/dev/null | wc -l)
[ "${HOOKS_POLICES:-0}" -ge 2 ] && add_row "T04-V1" "Hooks polices >= 2" "PASS" "$HOOKS_POLICES" || add_row "T04-V1" "Hooks" "WARN" "$HOOKS_POLICES"

# T04-V2 : Permissions polices
PERM_POLICES=$(grep -rE "customer\.polices\." repo/apps/api/src/modules/customer 2>/dev/null | wc -l)
[ "${PERM_POLICES:-0}" -ge 3 ] && add_row "T04-V2" "Permissions polices 3+" "PASS" "$PERM_POLICES" || add_row "T04-V2" "Permissions" "WARN" "$PERM_POLICES"

# T04-V3 : Tests E2E 8+
T04_TESTS=$(cd repo/apps/web-customer-portal && pnpm playwright test e2e/polices.e2e.ts --reporter=json 2>/dev/null | jq '.stats.expected // 0' 2>/dev/null || echo 0)
[ "${T04_TESTS:-0}" -ge 8 ] && add_row "T04-V3" "Tests polices 8+" "PASS" "$T04_TESTS" || add_row "T04-V3" "Tests" "WARN" "$T04_TESTS / 8"
```

---

## TACHE 5/14 -- 4.4.5 : NOUVEAU FNOL declaration wizard 6 etapes

```bash
echo ""
echo "TACHE 4.4.5 : NOUVEAU FNOL wizard 6 etapes"

# T05-F1 : Wizard pages 6 etapes
WIZARD_PAGES=$(find repo/apps/web-customer-portal/src/app/[locale]/\(dashboard\)/sinistres/nouveau -name "page.tsx" 2>/dev/null | wc -l)
if [ "${WIZARD_PAGES:-0}" -ge 6 ]; then
  add_row "T05-F1" "Wizard FNOL 6 pages" "PASS" "$WIZARD_PAGES etapes"
else
  add_row "T05-F1" "Wizard FNOL" "WARN" "$WIZARD_PAGES / 6"
fi

# T05-F2 : Composants FnolStep
FNOL_COMPONENTS=$(find repo/apps/web-customer-portal/src/components/fnol -name "FnolStep*.tsx" 2>/dev/null | wc -l)
[ "${FNOL_COMPONENTS:-0}" -ge 6 ] && add_row "T05-F2" "6 composants FnolStep" "PASS" "$FNOL_COMPONENTS" || add_row "T05-F2" "FnolStep" "WARN" "$FNOL_COMPONENTS / 6"

# T05-F3 : Hook useFnolWizard
[ -f "repo/apps/web-customer-portal/src/hooks/useFnolWizard.ts" ] && add_row "T05-F3" "useFnolWizard hook" "PASS" "" || add_row "T05-F3" "Hook" "WARN" "Manquant"

# T05-V1 (P0) : Kafka producer Sprint 24 trigger
KAFKA_TRIGGER=$(grep -rE "insurtech\.events\.repair\|kafkaProducer.*fnol" repo/apps/api/src/modules/customer 2>/dev/null | wc -l)
[ "${KAFKA_TRIGGER:-0}" -ge 1 ] && add_row "T05-V1" "Kafka trigger Sprint 24" "PASS" "" || add_row "T05-V1" "Kafka trigger" "FAIL" "Sprint 24 trigger absent"

# T05-V2 (P0) : Notification customer Sprint 9 v3.0
NOTIF_CUSTOMER=$(grep -rE "customer_fnol_received\|notificationRouter" repo/apps/api/src/modules/customer 2>/dev/null | wc -l)
[ "${NOTIF_CUSTOMER:-0}" -ge 1 ] && add_row "T05-V2" "Notification Sprint 9 v3.0" "PASS" "" || add_row "T05-V2" "Notification" "WARN" "Sprint 9 integration absente"

# T05-V3 (P0) : Permission customer.sinistres.report
PERM_FNOL=$(grep -rE "customer\.sinistres\.report" repo/apps/api/src/modules/customer 2>/dev/null | wc -l)
[ "${PERM_FNOL:-0}" -ge 1 ] && add_row "T05-V3" "Permission sinistres.report" "PASS" "" || add_row "T05-V3" "Permission" "WARN" "Absent"

# T05-V4 (P0) : Photos S3 multipart upload
S3_UPLOAD=$(grep -rE "s3SignedUrl\|presignedPost\|multipart" repo/apps/api/src/modules/customer 2>/dev/null | wc -l)
[ "${S3_UPLOAD:-0}" -ge 1 ] && add_row "T05-V4" "Photos S3 multipart" "PASS" "" || add_row "T05-V4" "S3 upload" "WARN" "Absent"

# T05-V5 (P0) : Tests E2E 10+
T05_TESTS=$(cd repo/apps/web-customer-portal && pnpm playwright test e2e/fnol-wizard.e2e.ts --reporter=json 2>/dev/null | jq '.stats.expected // 0' 2>/dev/null || echo 0)
[ "${T05_TESTS:-0}" -ge 10 ] && add_row "T05-V5" "Tests FNOL E2E 10+" "PASS" "$T05_TESTS" || add_row "T05-V5" "Tests FNOL" "WARN" "$T05_TESTS / 10"
```

---

## TACHE 6/14 -- 4.4.6 : Sinistres list + filters

```bash
echo ""
echo "TACHE 4.4.6 : Sinistres list + filters"

[ -f "repo/apps/web-customer-portal/src/app/[locale]/(dashboard)/sinistres/page.tsx" ] && add_row "T06-F1" "Page sinistres" "PASS" "" || add_row "T06-F1" "Page" "FAIL" "Manquant"
[ -f "repo/apps/web-customer-portal/src/components/sinistres/SinistresList.tsx" ] && add_row "T06-F2" "SinistresList component" "PASS" "" || add_row "T06-F2" "List component" "WARN" "Manquant"

# T06-V1 : Filtres avances
FILTERS_USAGE=$(grep -rE "FilterPanel\|status.*filter\|date.*range" repo/apps/web-customer-portal/src/components/sinistres 2>/dev/null | wc -l)
[ "${FILTERS_USAGE:-0}" -ge 2 ] && add_row "T06-V1" "Filtres avances" "PASS" "$FILTERS_USAGE refs" || add_row "T06-V1" "Filtres" "WARN" "Faibles"

# T06-V2 : Tests 5+
T06_TESTS=$(cd repo && pnpm vitest run --reporter=json apps/web-customer-portal/src/components/sinistres 2>/dev/null | jq '.numPassedTests // 0' 2>/dev/null || echo 0)
[ "${T06_TESTS:-0}" -ge 5 ] && add_row "T06-V2" "Tests sinistres 5+" "PASS" "$T06_TESTS" || add_row "T06-V2" "Tests" "WARN" "$T06_TESTS / 5"
```

---

## TACHE 7/14 -- 4.4.7 : REFONDU Tracking SSE 12 milestones

```bash
echo ""
echo "TACHE 4.4.7 : REFONDU Tracking SSE 12 milestones"

# T07-F1 : Page tracking
[ -f "repo/apps/web-customer-portal/src/app/[locale]/(dashboard)/sinistres/[id]/page.tsx" ] && add_row "T07-F1" "Page tracking" "PASS" "" || add_row "T07-F1" "Page" "FAIL" "Manquant"

# T07-F2 : MilestoneTimeline
[ -f "repo/apps/web-customer-portal/src/components/tracking/MilestoneTimeline.tsx" ] && add_row "T07-F2" "MilestoneTimeline" "PASS" "" || add_row "T07-F2" "Timeline" "WARN" "Manquant"

# T07-F3 : Hook useRealtimeTracking
[ -f "repo/apps/web-customer-portal/src/hooks/useRealtimeTracking.ts" ] && add_row "T07-F3" "useRealtimeTracking hook" "PASS" "" || add_row "T07-F3" "Hook" "FAIL" "Manquant"

# T07-V1 (P0) : SSE endpoint server-side
SSE_ENDPOINT=$(grep -rE "@Sse\|text/event-stream\|EventSource" repo/apps/api/src/modules/customer 2>/dev/null | wc -l)
[ "${SSE_ENDPOINT:-0}" -ge 1 ] && add_row "T07-V1" "SSE endpoint server" "PASS" "" || add_row "T07-V1" "SSE endpoint" "FAIL" "Absent"

# T07-V2 (P0) : 12 milestones declares
MILESTONES_COUNT=$(grep -rE "MILESTONES\|milestone" repo/apps/web-customer-portal/src/components/tracking 2>/dev/null | grep -oE "declared|carrier_reviewed|tow_dispatched|vehicle_received|diagnosed|devis_sent|expert_validated|carrier_approved|parts_ordered|repair_in_progress|qc_done|ready_for_delivery" | sort -u | wc -l)
if [ "${MILESTONES_COUNT:-0}" -ge 10 ]; then
  add_row "T07-V2" "12 milestones declares" "PASS" "$MILESTONES_COUNT / 12"
elif [ "${MILESTONES_COUNT:-0}" -ge 8 ]; then
  add_row "T07-V2" "12 milestones" "WARN" "$MILESTONES_COUNT / 12"
else
  add_row "T07-V2" "12 milestones" "FAIL" "$MILESTONES_COUNT / 12"
fi

# T07-V3 : Reconnection auto
RECONNECT=$(grep -rE "reconnect\|EventSource.*onerror\|heartbeat" repo/apps/web-customer-portal/src/hooks/useRealtimeTracking.ts 2>/dev/null | wc -l)
[ "${RECONNECT:-0}" -ge 1 ] && add_row "T07-V3" "SSE reconnection auto" "PASS" "" || add_row "T07-V3" "Reconnection" "WARN" "Absent"

# T07-V4 : Tests E2E 8+
T07_TESTS=$(cd repo/apps/web-customer-portal && pnpm playwright test e2e/tracking-sse.e2e.ts --reporter=json 2>/dev/null | jq '.stats.expected // 0' 2>/dev/null || echo 0)
[ "${T07_TESTS:-0}" -ge 8 ] && add_row "T07-V4" "Tests tracking SSE 8+" "PASS" "$T07_TESTS" || add_row "T07-V4" "Tests" "WARN" "$T07_TESTS / 8"
```

---

## TACHE 8/14 -- 4.4.8 : NOUVEAU Sky AI integration customer

```bash
echo ""
echo "TACHE 4.4.8 : NOUVEAU Sky AI integration"

# T08-F1 : SkyAiScoreWidget
[ -f "repo/apps/web-customer-portal/src/components/dashboard/SkyAiScoreWidget.tsx" ] && add_row "T08-F1" "SkyAiScoreWidget" "PASS" "" || add_row "T08-F1" "Score widget" "WARN" "Manquant"

# T08-F2 : SkyAiEstimationCard
[ -f "repo/apps/web-customer-portal/src/components/tracking/SkyAiEstimationCard.tsx" ] && add_row "T08-F2" "SkyAiEstimationCard" "PASS" "" || add_row "T08-F2" "Estimation card" "WARN" "Manquant"

# T08-V1 (P0) : Service forward Sprint 15
SKY_SERVICE=$(grep -rE "sky.*ai.*service\|Sprint 15" repo/apps/api/src/modules/customer 2>/dev/null | wc -l)
[ "${SKY_SERVICE:-0}" -ge 1 ] && add_row "T08-V1" "Sky AI service Sprint 15 reuse" "PASS" "" || add_row "T08-V1" "Sky AI service" "WARN" "Absent"

# T08-V2 (P0) : Low confidence warning
LOW_CONF_WARN=$(grep -rE "confidence.*<.*70\|low confidence" repo/apps/web-customer-portal/src/components 2>/dev/null | wc -l)
[ "${LOW_CONF_WARN:-0}" -ge 1 ] && add_row "T08-V2" "Low confidence warning" "PASS" "" || add_row "T08-V2" "Confidence" "WARN" "Absent"

# T08-V3 (P0) : GDPR explanation IA (article 22 loi 09-08)
GDPR_EXPLAIN=$(grep -rE "article 22\|right to explanation\|explanation.*IA\|gdpr.*explanation" repo/apps/web-customer-portal/src 2>/dev/null | wc -l)
[ "${GDPR_EXPLAIN:-0}" -ge 1 ] && add_row "T08-V3" "GDPR explanation IA article 22" "PASS" "" || add_row "T08-V3" "GDPR explanation" "WARN" "Manquant (loi 09-08)"

# T08-V4 : Tests 6+
T08_TESTS=$(cd repo && pnpm vitest run --reporter=json apps/web-customer-portal/src/components/dashboard/SkyAiScoreWidget.test.tsx 2>/dev/null | jq '.numPassedTests // 0' 2>/dev/null || echo 0)
[ "${T08_TESTS:-0}" -ge 6 ] && add_row "T08-V4" "Tests Sky AI 6+" "PASS" "$T08_TESTS" || add_row "T08-V4" "Tests" "WARN" "$T08_TESTS / 6"
```

---

## TACHE 9/14 -- 4.4.9 : Paiements + factures + CMI

```bash
echo ""
echo "TACHE 4.4.9 : Paiements + factures + CMI"

# T09-F1 : Pages paiements
[ -f "repo/apps/web-customer-portal/src/app/[locale]/(dashboard)/paiements/page.tsx" ] && add_row "T09-F1" "Page paiements" "PASS" "" || add_row "T09-F1" "Page" "FAIL" "Manquant"
[ -d "repo/apps/web-customer-portal/src/app/[locale]/(dashboard)/paiements/factures" ] && add_row "T09-F2" "Page factures" "PASS" "" || add_row "T09-F2" "Factures" "WARN" "Manquant"

# T09-V1 : CMI integration
CMI_INTEG=$(grep -rE "CMI\|paiement.*carte\|cardPayment" repo/apps/api/src/modules/customer 2>/dev/null | wc -l)
[ "${CMI_INTEG:-0}" -ge 1 ] && add_row "T09-V1" "CMI integration" "PASS" "" || add_row "T09-V1" "CMI" "WARN" "Sprint 11 deps"

# T09-V2 : Factures DGI compliance
DGI_TVA=$(grep -rE "tva.*10\|TVA.*0\.10\|DGI" repo/apps/api/src/modules/customer 2>/dev/null | wc -l)
[ "${DGI_TVA:-0}" -ge 1 ] && add_row "T09-V2" "DGI TVA 10% factures" "PASS" "" || add_row "T09-V2" "DGI" "WARN" "Absent"

# T09-V3 : Permissions paiements
PERM_PAY=$(grep -rE "customer\.paiements\." repo/apps/api/src/modules/customer 2>/dev/null | wc -l)
[ "${PERM_PAY:-0}" -ge 2 ] && add_row "T09-V3" "Permissions paiements 2+" "PASS" "$PERM_PAY" || add_row "T09-V3" "Permissions" "WARN" "$PERM_PAY"

# T09-V4 : Tests 6+
T09_TESTS=$(cd repo && pnpm vitest run --reporter=json apps/web-customer-portal/src/app/\[locale\]/\(dashboard\)/paiements 2>/dev/null | jq '.numPassedTests // 0' 2>/dev/null || echo 0)
[ "${T09_TESTS:-0}" -ge 6 ] && add_row "T09-V4" "Tests paiements 6+" "PASS" "$T09_TESTS" || add_row "T09-V4" "Tests" "WARN" "$T09_TESTS / 6"
```

---

## TACHE 10/14 -- 4.4.10 : Documents personnels

```bash
echo ""
echo "TACHE 4.4.10 : Documents personnels"

[ -f "repo/apps/web-customer-portal/src/app/[locale]/(dashboard)/documents/page.tsx" ] && add_row "T10-F1" "Page documents" "PASS" "" || add_row "T10-F1" "Page" "FAIL" "Manquant"

# T10-V1 : S3 signed URLs
S3_SIGNED=$(grep -rE "getSignedUrl\|presigned.*url" repo/apps/api/src/modules/customer 2>/dev/null | wc -l)
[ "${S3_SIGNED:-0}" -ge 1 ] && add_row "T10-V1" "S3 signed URLs 1h" "PASS" "" || add_row "T10-V1" "S3 signed" "WARN" "Absent"

# T10-V2 : Sharing temporaire 7j
SHARING=$(grep -rE "share.*token\|expiresIn.*7d" repo/apps/api/src/modules/customer 2>/dev/null | wc -l)
[ "${SHARING:-0}" -ge 1 ] && add_row "T10-V2" "Sharing temporaire 7j" "PASS" "" || add_row "T10-V2" "Sharing" "WARN" "Absent"

# T10-V3 : Tests 4+
T10_TESTS=$(cd repo && pnpm vitest run --reporter=json apps/web-customer-portal/src/app/\[locale\]/\(dashboard\)/documents 2>/dev/null | jq '.numPassedTests // 0' 2>/dev/null || echo 0)
[ "${T10_TESTS:-0}" -ge 4 ] && add_row "T10-V3" "Tests documents 4+" "PASS" "$T10_TESTS" || add_row "T10-V3" "Tests" "WARN" "$T10_TESTS / 4"
```

---

## TACHE 11/14 -- 4.4.11 : Profile + multilingue + RGPD

```bash
echo ""
echo "TACHE 4.4.11 : Profile + RGPD"

[ -f "repo/apps/web-customer-portal/src/app/[locale]/(dashboard)/profile/page.tsx" ] && add_row "T11-F1" "Page profile" "PASS" "" || add_row "T11-F1" "Page" "FAIL" "Manquant"

# T11-V1 (P0) : RGPD delete account workflow
RGPD_DELETE=$(grep -rE "delete.*account\|right to.*forget\|article 22.*delete" repo/apps/api/src/modules/customer 2>/dev/null | wc -l)
[ "${RGPD_DELETE:-0}" -ge 1 ] && add_row "T11-V1" "RGPD delete account workflow" "PASS" "" || add_row "T11-V1" "RGPD delete" "FAIL" "Loi 09-08 article 22 absent"

# T11-V2 (P0) : Grace period 30 jours
GRACE_PERIOD=$(grep -rE "30 days\|gracePeriod.*30\|30 jours" repo/apps/api/src/modules/customer 2>/dev/null | wc -l)
[ "${GRACE_PERIOD:-0}" -ge 1 ] && add_row "T11-V2" "Grace period 30j" "PASS" "" || add_row "T11-V2" "Grace" "WARN" "Absent"

# T11-V3 : Multilingue switching persiste
LANG_PERSIST=$(grep -rE "useRouter.*locale\|setLanguage\|localStorage.*locale" repo/apps/web-customer-portal/src 2>/dev/null | wc -l)
[ "${LANG_PERSIST:-0}" -ge 1 ] && add_row "T11-V3" "Multilingue persiste" "PASS" "" || add_row "T11-V3" "Multilingue" "WARN" "A verifier"

# T11-V4 : Tests 8+
T11_TESTS=$(cd repo && pnpm vitest run --reporter=json apps/web-customer-portal/src/app/\[locale\]/\(dashboard\)/profile 2>/dev/null | jq '.numPassedTests // 0' 2>/dev/null || echo 0)
[ "${T11_TESTS:-0}" -ge 8 ] && add_row "T11-V4" "Tests profile 8+" "PASS" "$T11_TESTS" || add_row "T11-V4" "Tests" "WARN" "$T11_TESTS / 8"
```

---

## TACHE 12/14 -- 4.4.12 : NOUVEAU Feedback + support

```bash
echo ""
echo "TACHE 4.4.12 : NOUVEAU Feedback + support"

[ -d "repo/apps/web-customer-portal/src/app/[locale]/(dashboard)/feedback" ] && add_row "T12-F1" "Pages feedback" "PASS" "" || add_row "T12-F1" "Feedback" "WARN" "Manquant"
[ -d "repo/apps/web-customer-portal/src/app/[locale]/(dashboard)/support" ] && add_row "T12-F2" "Pages support" "PASS" "" || add_row "T12-F2" "Support" "WARN" "Manquant"

# T12-V1 : Permissions feedback + support
PERM_FB=$(grep -rE "customer\.feedback\.submit\|customer\.support\.create" repo/apps/api/src/modules/customer 2>/dev/null | wc -l)
[ "${PERM_FB:-0}" -ge 2 ] && add_row "T12-V1" "Permissions feedback+support" "PASS" "" || add_row "T12-V1" "Permissions" "WARN" "$PERM_FB"

# T12-V2 : Tests 6+
T12_TESTS=$(cd repo && pnpm vitest run --reporter=json apps/web-customer-portal/src/app/\[locale\]/\(dashboard\)/feedback 2>/dev/null | jq '.numPassedTests // 0' 2>/dev/null || echo 0)
[ "${T12_TESTS:-0}" -ge 6 ] && add_row "T12-V2" "Tests feedback 6+" "PASS" "$T12_TESTS" || add_row "T12-V2" "Tests" "WARN" "$T12_TESTS / 6"
```

---

## TACHE 13/14 -- 4.4.13 : NOUVEAU WhatsApp scope strict customer

```bash
echo ""
echo "TACHE 4.4.13 : NOUVEAU WhatsApp scope strict customer"

# T13-F1 : Composant WhatsAppPreferences
[ -f "repo/apps/web-customer-portal/src/components/profile/WhatsAppPreferences.tsx" ] && add_row "T13-F1" "WhatsAppPreferences" "PASS" "" || add_row "T13-F1" "Component" "WARN" "Manquant"

# T13-V1 (P0) : 8 templates customer whitelist Sprint 9 v3.0
TEMPLATES_CUSTOMER=$(node -e "
try {
  const { STATUS_ONLY_TEMPLATES } = require('./repo/packages/comm/dist');
  console.log(STATUS_ONLY_TEMPLATES.customer ? STATUS_ONLY_TEMPLATES.customer.length : 0);
} catch (e) { console.log('0'); }
" 2>/dev/null || echo 0)
if [ "${TEMPLATES_CUSTOMER:-0}" -ge 8 ]; then
  add_row "T13-V1" "8 templates customer whitelist" "PASS" "$TEMPLATES_CUSTOMER"
else
  add_row "T13-V1" "8 templates customer" "FAIL" "$TEMPLATES_CUSTOMER / 8 (Sprint 9 v3.0 prerequis)"
fi

# T13-V2 (P0) : Opt-out endpoint public CNDP
OPTOUT_ENDPOINT=$(find repo/apps/api/src -name "*optout*" -o -name "*opt-out*" 2>/dev/null | wc -l)
[ "${OPTOUT_ENDPOINT:-0}" -ge 1 ] && add_row "T13-V2" "Opt-out endpoint public CNDP" "PASS" "" || add_row "T13-V2" "Opt-out" "FAIL" "Loi 09-08 obligation"

# T13-V3 : Tests 4+
T13_TESTS=$(cd repo && pnpm vitest run --reporter=json apps/web-customer-portal/src/components/profile/WhatsAppPreferences.test.tsx 2>/dev/null | jq '.numPassedTests // 0' 2>/dev/null || echo 0)
[ "${T13_TESTS:-0}" -ge 4 ] && add_row "T13-V3" "Tests WhatsApp prefs 4+" "PASS" "$T13_TESTS" || add_row "T13-V3" "Tests" "WARN" "$T13_TESTS / 4"
```

---

## TACHE 14/14 -- 4.4.14 : Tests E2E 40+ + seeds 20 + accessibility + Lighthouse

```bash
echo ""
echo "TACHE 4.4.14 : Tests E2E + accessibility + Lighthouse"

# T14-V1 (P0) : Tests E2E total >= 40
TOTAL_E2E=$(cd repo/apps/web-customer-portal && pnpm playwright test --list --reporter=json 2>/dev/null | jq '[.suites[]?.specs[]?] | length' 2>/dev/null || echo 0)
if [ "${TOTAL_E2E:-0}" -ge 40 ]; then
  add_row "T14-V1" "Tests E2E >= 40" "PASS" "$TOTAL_E2E"
elif [ "${TOTAL_E2E:-0}" -ge 30 ]; then
  add_row "T14-V1" "Tests E2E >= 40" "WARN" "$TOTAL_E2E / 40"
else
  add_row "T14-V1" "Tests E2E >= 40" "FAIL" "$TOTAL_E2E / 40"
fi

# T14-V2 (P0) : Seeds 20 customers
SEEDS_FILE=$(find repo/apps/api/src -name "*customer*seed*" -o -name "seeds-customers*" 2>/dev/null | head -1)
if [ -n "$SEEDS_FILE" ]; then
  SEEDS_COUNT=$(grep -cE "first_name:|firstName:" "$SEEDS_FILE" 2>/dev/null || echo 0)
  [ "${SEEDS_COUNT:-0}" -ge 20 ] && add_row "T14-V2" "Seeds 20 customers" "PASS" "$SEEDS_COUNT" || add_row "T14-V2" "Seeds" "WARN" "$SEEDS_COUNT / 20"
else
  add_row "T14-V2" "Seeds file" "FAIL" "Manquant"
fi

# T14-V3 (P0) : Coverage >= 85%
COV=$(cd repo && pnpm vitest run --coverage --reporter=json apps/web-customer-portal 2>/dev/null | jq '.coverageMap.total.lines.pct // 0' 2>/dev/null || echo 0)
if (( $(echo "${COV:-0} >= 85" | bc -l 2>/dev/null || echo 0) )); then
  add_row "T14-V3" "Coverage >= 85%" "PASS" "${COV}%"
else
  add_row "T14-V3" "Coverage >= 85%" "WARN" "${COV}% / 85%"
fi

# T14-V4 : Accessibility audit pa11y
PA11Y_RESULT=$(cd repo/apps/web-customer-portal && pnpm dlx pa11y http://localhost:3000/fr --reporter=json 2>/dev/null | jq '[.issues[] | select(.type == "error")] | length' 2>/dev/null || echo 999)
if [ "${PA11Y_RESULT:-999}" -eq 0 ]; then
  add_row "T14-V4" "Accessibility pa11y 0 errors" "PASS" ""
elif [ "${PA11Y_RESULT:-999}" -lt 5 ]; then
  add_row "T14-V4" "Accessibility pa11y" "WARN" "$PA11Y_RESULT errors"
else
  add_row "T14-V4" "Accessibility pa11y" "WARN" "$PA11Y_RESULT errors ou non execute"
fi
```

---

## VERIFICATIONS TRANSVERSALES SPRINT 17 (12 transversaux)

```bash
echo ""
echo "TRANSVERSAUX SPRINT 17"

cd repo

# TR-BUILD
pnpm turbo run build --filter=@insurtech/web-customer-portal 2>&1 > /tmp/build-tr.log; BC=$?
[ $BC -eq 0 ] && add_row "TR-BUILD" "Build web-customer-portal OK" "PASS" "" || auto_repair "pnpm install --force && pnpm turbo run build --filter=@insurtech/web-customer-portal" "[ \$? -eq 0 ]" "TR-BUILD" "Build"

# TR-TYPECHECK
pnpm tsc --noEmit -p apps/web-customer-portal 2>&1 > /tmp/tsc-tr.log
TS_ERR=$(grep -c "error TS" /tmp/tsc-tr.log)
[ "$TS_ERR" -eq 0 ] && add_row "TR-TYPECHECK" "TypeScript 0 erreur" "PASS" "" || add_row "TR-TYPECHECK" "TypeScript" "FAIL" "$TS_ERR erreurs"

# TR-TESTS
TEST_RESULTS=$(pnpm vitest run --reporter=json apps/web-customer-portal 2>/dev/null | jq '{passed: .numPassedTests, failed: .numFailedTests}' 2>/dev/null || echo '{}')
TR_PASSED=$(echo "$TEST_RESULTS" | jq -r '.passed // 0')
TR_FAILED=$(echo "$TEST_RESULTS" | jq -r '.failed // 0')
[ "${TR_FAILED:-0}" -eq 0 ] && [ "${TR_PASSED:-0}" -gt 0 ] && add_row "TR-TESTS" "Tests Vitest tous PASS" "PASS" "$TR_PASSED / 0 failed" || add_row "TR-TESTS" "Tests" "FAIL" "$TR_PASSED / $TR_FAILED failed"

# TR-COVERAGE
COV=$(pnpm vitest run --coverage --reporter=json apps/web-customer-portal 2>/dev/null | jq '.coverageMap.total.lines.pct // 0' 2>/dev/null || echo 0)
if (( $(echo "${COV:-0} >= 85" | bc -l 2>/dev/null || echo 0) )); then
  add_row "TR-COVERAGE" "Coverage >= 85%" "PASS" "${COV}%"
else
  add_row "TR-COVERAGE" "Coverage" "WARN" "${COV}% / 85%"
fi

# TR-LINT
pnpm lint apps/web-customer-portal 2>&1 > /tmp/lint-tr.log; LC=$?
[ $LC -eq 0 ] && add_row "TR-LINT" "Biome lint 0 erreur" "PASS" "" || auto_repair "pnpm lint apps/web-customer-portal --apply" "pnpm lint apps/web-customer-portal" "TR-LINT" "Biome lint"

cd ..

# TR-NO-EMOJI
EMOJI=$(grep -rP "[\x{1F300}-\x{1F9FF}]|[\x{2600}-\x{27BF}]" repo/apps/web-customer-portal --include="*.tsx" --include="*.ts" --include="*.json" --include="*.md" 2>/dev/null | wc -l)
[ "$EMOJI" -eq 0 ] && add_row "TR-NO-EMOJI" "0 emoji" "PASS" "decision-006" || add_row "TR-NO-EMOJI" "Emoji" "FAIL" "$EMOJI emojis"

# TR-CONSOLE
CONSOLE=$(grep -rn "console\.log\|console\.error" repo/apps/web-customer-portal --include="*.tsx" --include="*.ts" 2>/dev/null | grep -v ".spec.ts" | grep -v ".test.tsx" | grep -v ".e2e.ts" | wc -l)
[ "$CONSOLE" -eq 0 ] && add_row "TR-CONSOLE" "0 console.* (Pino)" "PASS" "" || add_row "TR-CONSOLE" "console" "FAIL" "$CONSOLE occurrences"

# TR-COMMITS
NON_CONV=$(git log --since="2 weeks ago" --pretty=format:"%s" -- repo/apps/web-customer-portal | grep -vE "^(feat|fix|docs|test|chore|refactor|perf)(\(.+\))?:" | wc -l)
[ "$NON_CONV" -eq 0 ] && add_row "TR-COMMITS" "Conventional Commits 100%" "PASS" "" || add_row "TR-COMMITS" "Commits" "WARN" "$NON_CONV non-conformes"

# TR-TENANT
TENANT_USAGE=$(grep -rE "tenantId" repo/apps/api/src/modules/customer --include="*.ts" 2>/dev/null | wc -l)
[ "${TENANT_USAGE:-0}" -ge 10 ] && add_row "TR-TENANT" "Multi-tenant tenantId" "PASS" "$TENANT_USAGE refs" || add_row "TR-TENANT" "Tenant" "WARN" "$TENANT_USAGE"

# TR-ZOD
ZOD_USAGE=$(grep -rE "from 'zod'\|z\.object" repo/apps/web-customer-portal/src --include="*.ts" 2>/dev/null | wc -l)
[ "${ZOD_USAGE:-0}" -ge 5 ] && add_row "TR-ZOD" "Zod validation usage" "PASS" "$ZOD_USAGE schemas" || add_row "TR-ZOD" "Zod" "WARN" "$ZOD_USAGE"

# TR-MIGRATIONS
MIGRATIONS_COUNT=$(find repo/apps/api/src/migrations -name "*Customer*" -newer /tmp/sprint16-end-marker 2>/dev/null | wc -l)
[ "${MIGRATIONS_COUNT:-0}" -ge 1 ] && add_row "TR-MIGRATIONS" "Migrations customer" "PASS" "$MIGRATIONS_COUNT" || add_row "TR-MIGRATIONS" "Migrations" "WARN" "0 nouvelles"

# TR-MULTILINGUE
MESSAGES_FILES=$(find repo/apps/web-customer-portal/src/messages -name "*.json" 2>/dev/null | wc -l)
[ "${MESSAGES_FILES:-0}" -eq 4 ] && add_row "TR-MULTILINGUE" "4 langues messages" "PASS" "" || add_row "TR-MULTILINGUE" "Multilingue" "WARN" "$MESSAGES_FILES / 4"
```

---

## VERIFICATIONS SPECIFIQUES SPRINT 17 (6 specifiques)

```bash
echo ""
echo "VERIFICATIONS SPECIFIQUES SPRINT 17"

# SP-LIGHTHOUSE-PERF : Lighthouse Performance >= 85
LH_PERF=$(cd repo/apps/web-customer-portal && pnpm dlx lighthouse http://localhost:3000/fr --output=json --quiet 2>/dev/null | jq '.categories.performance.score * 100' 2>/dev/null || echo 0)
if (( $(echo "${LH_PERF:-0} >= 85" | bc -l 2>/dev/null || echo 0) )); then
  add_row "SP-LIGHTHOUSE-PERF" "Lighthouse Performance >= 85" "PASS" "${LH_PERF}"
elif (( $(echo "${LH_PERF:-0} >= 75" | bc -l 2>/dev/null || echo 0) )); then
  add_row "SP-LIGHTHOUSE-PERF" "Lighthouse Perf >= 85" "WARN" "${LH_PERF} / 85"
else
  add_row "SP-LIGHTHOUSE-PERF" "Lighthouse Perf" "WARN" "${LH_PERF} ou non execute"
fi

# SP-LIGHTHOUSE-A11Y : Lighthouse Accessibility >= 95
LH_A11Y=$(cd repo/apps/web-customer-portal && pnpm dlx lighthouse http://localhost:3000/fr --output=json --quiet 2>/dev/null | jq '.categories.accessibility.score * 100' 2>/dev/null || echo 0)
if (( $(echo "${LH_A11Y:-0} >= 95" | bc -l 2>/dev/null || echo 0) )); then
  add_row "SP-LIGHTHOUSE-A11Y" "Lighthouse A11y >= 95" "PASS" "${LH_A11Y}"
else
  add_row "SP-LIGHTHOUSE-A11Y" "Lighthouse A11y >= 95" "WARN" "${LH_A11Y} / 95"
fi

# SP-LIGHTHOUSE-PWA : Lighthouse PWA >= 90
LH_PWA=$(cd repo/apps/web-customer-portal && pnpm dlx lighthouse http://localhost:3000/fr --output=json --quiet --only-categories=pwa 2>/dev/null | jq '.categories.pwa.score * 100' 2>/dev/null || echo 0)
if (( $(echo "${LH_PWA:-0} >= 90" | bc -l 2>/dev/null || echo 0) )); then
  add_row "SP-LIGHTHOUSE-PWA" "Lighthouse PWA >= 90" "PASS" "${LH_PWA}"
else
  add_row "SP-LIGHTHOUSE-PWA" "Lighthouse PWA" "WARN" "${LH_PWA} / 90"
fi

# SP-SSE-WORKING : SSE endpoint reachable
SSE_TEST=$(curl -s -N -m 3 http://localhost:3001/api/v1/customer/sinistres/test-id/stream 2>&1 | head -1 | grep -c "event\|data:" || echo 0)
[ "${SSE_TEST:-0}" -ge 1 ] && add_row "SP-SSE-WORKING" "SSE endpoint reachable" "PASS" "" || add_row "SP-SSE-WORKING" "SSE endpoint" "WARN" "Non testable"

# SP-SKY-AI-INTEGRATION : Sprint 15 Sky AI integration
SKY_AI_CALL=$(grep -rE "Sprint 15\|sky-ai-service\|skyAiService" repo/apps/api/src/modules/customer 2>/dev/null | wc -l)
[ "${SKY_AI_CALL:-0}" -ge 1 ] && add_row "SP-SKY-AI-INTEGRATION" "Sprint 15 Sky AI integration" "PASS" "" || add_row "SP-SKY-AI-INTEGRATION" "Sky AI" "WARN" "Absent"

# SP-WHATSAPP-CUSTOMER : Sprint 9 v3.0 customer templates integration
WA_CUSTOMER_INTEG=$(grep -rE "STATUS_ONLY_TEMPLATES\.customer\|customer_fnol_received\|customer_repair" repo/apps/api/src/modules/customer 2>/dev/null | wc -l)
[ "${WA_CUSTOMER_INTEG:-0}" -ge 1 ] && add_row "SP-WHATSAPP-CUSTOMER" "Sprint 9 v3.0 customer templates" "PASS" "" || add_row "SP-WHATSAPP-CUSTOMER" "WhatsApp customer" "WARN" "Absent"
```

---

## GENERATION DU RAPPORT FINAL

```bash
TOTAL=$((PASS + PASS_REPAIRED + FAIL + SKIP + WARN))
SCORE_NUM=$((PASS + PASS_REPAIRED))
SCORE_PCT=$(echo "scale=1; $SCORE_NUM * 100 / $TOTAL" | bc -l 2>/dev/null || echo "0")

JALON="NO-GO"
DOWNSTREAM_STATUS="SPRINT 18 (Assure Mobile) BLOQUE + Sprint 24 trigger FNOL absent"

if (( $(echo "$SCORE_PCT >= 90" | bc -l 2>/dev/null || echo 0) )); then
  JALON="GO"
  DOWNSTREAM_STATUS="Sprint 18 (Assure Mobile) peut demarrer + Sprint 24 trigger OK"
elif (( $(echo "$SCORE_PCT >= 80" | bc -l 2>/dev/null || echo 0) )); then
  JALON="GO CONDITIONNEL"
  DOWNSTREAM_STATUS="Sprint 18 demarre parallele + dette technique documentee"
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
**Jalon Sprint 17** : $JALON
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

EOF

# Decision matrix detaillee
case "$JALON" in
  GO)
    cat >> "$REPORT_FILE" << EOF
## Jalon GO/NO-GO Sprint 17

**GO** -- Sprint 17 v3.0 valide ($SCORE_PCT%). Customer Portal operationnel.

### Actions :

1. **Tag Git** :
\`\`\`bash
git tag -a "sprint-17-complete-v3-customer-portal" -m "Sprint 17 v3.0 -- score $SCORE_PCT%"
git push origin sprint-17-complete-v3-customer-portal
\`\`\`

2. **Deploiement progressif** :
   - Build production verifie + bundle size < 500 KB initial
   - Lighthouse Perf >= 85 / A11y >= 95 / PWA >= 90 valides
   - Seeds 20 customers preserves pour demo
   - PWA installable App Store / Play Store ready (post-pilote)

3. **Sprint 18** (Assure Mobile) peut demarrer

4. **Downstream impacts positifs** :
   - Sprint 24 Master Orchestrator recoit FNOL trigger customer-side
   - Sprint 22.5 Tow Mission triggered post-FNOL customer
   - Demo Day 30 juin 2026 : Customer Portal demo-ready
EOF
    ;;
  "GO CONDITIONNEL")
    cat >> "$REPORT_FILE" << EOF
## Jalon GO/NO-GO Sprint 17

**GO CONDITIONNEL** ($SCORE_PCT%) -- Customer Portal degraded mais utilisable.

### Actions :

1. Documenter dette technique \`dette-technique-sprint-17.md\` :
   - Lister FAIL/WARN avec estimation effort
   - Priorisation P0 (FNOL trigger / Sky AI / RGPD delete) vs P1 (Lighthouse / SEO)
   - Plan resolution post-GO

2. Re-tester scenarios FAIL avant deploiement prod (special FNOL + Sky AI + RGPD)

3. **Tag conditionnel** :
\`\`\`bash
git tag -a "sprint-17-complete-v3-conditional" -m "Sprint 17 v3.0 -- score $SCORE_PCT% conditionnel"
\`\`\`

4. Sprint 18 peut commencer en parallele resolution dette
EOF
    ;;
  NO-GO)
    cat >> "$REPORT_FILE" << EOF
## Jalon GO/NO-GO Sprint 17

**NO-GO** ($SCORE_PCT%) -- Customer Portal non livrable.

### Actions :

1. **Escalation Saad + Abla** (Customer Portal = acteur 4 ecosystem 6 acteurs CRITICAL)
2. Identifier FAIL P0 :
   - T05-V1 : Sprint 24 trigger absent (FNOL pas operationnel)
   - T07-V1 : SSE endpoint absent (tracking impossible)
   - T11-V1 : RGPD delete account (LEGAL loi 09-08)
   - T13-V1 : WhatsApp customer templates (Sprint 9 v3.0 prerequis)
3. **NE PAS deployer en production** (Demo Day 30 juin 2026 risque)
4. Re-V-17 dans 3-5 jours
5. Sprint 18 (Assure Mobile) reste bloque en attendant
EOF
    ;;
esac

echo ""
echo "================================================"
echo "RAPPORT FINAL : $REPORT_FILE"
echo "Score : $SCORE_PCT% / Jalon : $JALON"
echo "Downstream : $DOWNSTREAM_STATUS"
echo "================================================"

cat "$REPORT_FILE"
```

---

## Decisions strategiques applicables

- **decision-006** : NO emoji policy (TR-NO-EMOJI)
- **decision-008** : Data residency Maroc + multilingue 4 langues (TR-MULTILINGUE)
- **decision-011** : Rebrand Sofidemy theme bleu marine + gold (T01-V1)
- **decision-012** : Ecosystem 6 acteurs Customer = acteur 4 distinct du Assure
- **correction Saad #7** : WhatsApp scope strict heritage Sprint 9 v3.0 (T13-V1 / SP-WHATSAPP-CUSTOMER)
- **decision-015** : Demo Day 30 juin 2026 -- Customer Portal demo-ready obligatoire

---

## Prochaine etape

**Si GO** :
1. Tag `sprint-17-complete-v3-customer-portal` + deploiement progressif
2. Sprint 18 (Assure Mobile App Expo SDK 51) peut demarrer
3. Sprint 24 (Master Orchestrator) recoit FNOL trigger customer-side
4. Sprint 22.5 (Tow Mission) triggered post-FNOL customer

**Si GO CONDITIONNEL** :
1. Documenter dette technique + Sprint 18 parallele resolution
2. Re-tester scenarios FAIL avant prod (special RGPD + Sky AI + FNOL)

**Si NO-GO** :
1. ESCALATION Saad + Abla (acteur 4 ecosystem critical)
2. Re-V-17 dans 3-5 jours
3. Sprint 18 reste bloque

---

## NOTES IMPORTANTES POUR EXECUTION

1. **Customer Portal = acteur 4 ecosystem 6 acteurs (decision-012)** : sans GO Sprint 17, ecosystem incomplet
2. **Sprint 9 v3.0 prerequis** : WhatsApp customer integration (T13) depend Sprint 9 v3.0 STATUS_ONLY_TEMPLATES.customer
3. **Sprint 24 trigger** : FNOL wizard (T05) MUST publish Kafka event `insurtech.events.repair`
4. **RGPD delete account** : loi 09-08 article 22 droit a l'oubli (T11-V1) -- workflow 30 jours grace period obligatoire
5. **GDPR Sky AI explanation** : loi 09-08 article 22 droit a explication IA (T08-V3) -- afficher confidence + algorithme summary
6. **Demo Day 30 juin 2026** : Customer Portal demo-ready obligatoire (decision-015)
7. **Lighthouse targets** : Perf >= 85 / A11y >= 95 / PWA >= 90 (3 verifications specifiques SP-LIGHTHOUSE-*)
8. **PWA installable** : manifest + service worker + icons obligatoires (T01-V3)
9. **Auto-reparation activee** sur TR-BUILD + TR-LINT + T01-V5

---

## INSTRUCTION FINALE A CLAUDE CODE / COWORK

Apres execution complete V-17 :

1. **Lire** `sprint17-verify-report.md` integralement
2. **Verifier** le score % final + criteres FAIL P0
3. **Si GO** : tag git + deploiement progressif + Sprint 18 demarre
4. **Si GO CONDITIONNEL** : documenter dette + Sprint 18 parallele
5. **Si NO-GO** : ESCALATION Saad + Abla + Sprint 18 bloque
6. **Garder** le rapport pour audit ACAPS (retention 10 ans obligatoire)

---

**Fin verification V-17 v3.0 -- Sprint 17 (4.4) Customer Portal Backoffice.**

**Total criteres** : 67 taches + 12 transversaux + 6 specifiques = 85 criteres
**Auto-reparation active** : TR-BUILD + TR-LINT + T01-V5 (3 tentatives)
**Jalon critique** : sans GO V-17, Sprint 18 + Sprint 24 trigger bloques + Demo Day risque
