# VERIFICATION SPRINT 18 v3.0 -- Phase 4 / Sprint 5 : Assure Mobile App (Acteur 5)
# Version : Auto-reparation active + Rapport final MD detaille
# 12 taches v3.0 + 12 transversaux + 6 specifiques mobile = 80+ criteres
# AUCUNE EMOJI AUTORISEE

**Version** : v3.0 (verification detaillee + auto-reparation + specifiques mobile Expo/EAS/Detox)
**Phase** : 4 -- Vertical Insure (Assure-facing mobile)
**Sprint** : 18 / 40 (cumul v3.0) -- Phase 4 Sprint 5
**Reference meta-prompt** : `B-18-sprint-18-assure-portal-mobile-v3.md`
**Reference orchestrateur** : `C-18-sprint-18-assure-portal-mobile-v3.md`
**Total criteres** : 60 taches + 12 transversaux + 6 specifiques = 78 criteres
**Jalon critique** : sans GO V-18 (>= 90%), Sprint 19 (Vertical Repair Foundation) bloque + EAS Build production stores impossible + Demo Day risque

---

Tu es **Claude Code (ou Cowork)**. Tu dois executer une **verification COMPLETE et EXHAUSTIVE** du Sprint 18 v3.0 apres execution toutes les 12 taches.

---

## REGLES D'EXECUTION

1. Tu **executes CHAQUE verification dans l'ordre** (preparation -> taches -> transversales -> specifiques mobile -> rapport)
2. Quand une verification echoue, tu **TENTES UNE REPARATION AUTOMATIQUE** avant de noter FAIL (3 tentatives max)
3. Apres chaque tentative de reparation, tu **re-executes la verification**
4. Tu consignes dans `sprint18-verify-report.md` **TOUS les resultats** au fil de l'execution
5. A la fin, tu produis le **rapport consolide** + calcul score GO / GO CONDITIONNEL / NO-GO
6. Tu **n'interromps JAMAIS** l'execution

---

## FORMAT DU RAPPORT

| ID | Description | Statut | Details |
|----|-------------|--------|---------|

**Convention IDs** : `T{NN}-V{N}` / `T{NN}-F{N}` / `TR-{TYPE}` / `SP-{TYPE}` (specifiques mobile)

**Statuts** : `PASS` / `PASS*` (repare auto) / `FAIL` (P0 bloquant) / `SKIP` / `WARN`

---

## PHASE DE PREPARATION

```bash
REPORT_FILE="sprint18-verify-report.md"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
RUN_ID=$(date '+%Y%m%d-%H%M%S')

cat > "$REPORT_FILE" << EOF
# Rapport de Verification - Sprint 18 v3.0 : Assure Mobile App

**Date** : $TIMESTAMP
**Run ID** : $RUN_ID
**Phase** : 4 -- Vertical Insure (Assure-facing mobile)
**Sprint** : 18 (Phase 4 / Sprint 5) v3.0
**Reference B-18 v3.0** : 12 taches, 60 criteres + 12 transversaux + 6 specifiques = 78 total
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

PASS=0; PASS_REPAIRED=0; FAIL=0; SKIP=0; WARN=0
TABLE_ROWS=""

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

DB_URL="${DATABASE_URL:-postgresql://insurtech_user:SecurePassword123!@localhost:5432/insurtech}"
pg_query() { psql "$DB_URL" -t -c "$1" 2>/dev/null | tr -d ' \n'; }

# Verify Sprint 17 + Sprint 9 v3.0 GO (prerequis)
SPRINT17_GO=$(grep -c '^Statut.*GO' skalean-insurtech/sprint17-verify-report.md 2>/dev/null || echo 0)
[ "$SPRINT17_GO" -lt 1 ] && echo "[WARN] Sprint 17 non-GO -- FNOL patterns risque"

SPRINT9_GO=$(grep -c '^Statut.*GO' skalean-insurtech/sprint09-verify-report.md 2>/dev/null || echo 0)
[ "$SPRINT9_GO" -lt 1 ] && echo "[CRITICAL] Sprint 9 v3.0 non-GO -- WhatsApp scope strict assure impossible"
```

---

## TACHE 1/12 -- 4.5.1 : Bootstrap Expo SDK 51 + theme + i18n + 9 ecrans

```bash
echo ""
echo "TACHE 4.5.1 : Bootstrap Expo SDK 51"

[ -d "repo/apps/web-assure-app" ] && add_row "T01-F1" "App web-assure-app" "PASS" "" || add_row "T01-F1" "App" "FAIL" "MANQUANT"

# T01-F2 : package.json + Expo SDK 51
if [ -f "repo/apps/web-assure-app/package.json" ]; then
  EXPO_VERSION=$(jq -r '.dependencies.expo // ""' repo/apps/web-assure-app/package.json)
  [[ "$EXPO_VERSION" =~ 51 ]] && add_row "T01-F2" "Expo SDK 51" "PASS" "$EXPO_VERSION" || add_row "T01-F2" "Expo SDK 51" "FAIL" "$EXPO_VERSION"
else
  add_row "T01-F2" "package.json" "FAIL" "Manquant"
fi

# T01-F3 : app.json + eas.json
[ -f "repo/apps/web-assure-app/app.json" ] && add_row "T01-F3a" "app.json" "PASS" "" || add_row "T01-F3a" "app.json" "FAIL" "Manquant"
[ -f "repo/apps/web-assure-app/eas.json" ] && add_row "T01-F3b" "eas.json" "PASS" "" || add_row "T01-F3b" "eas.json" "FAIL" "Manquant"

# T01-V1 (P0) : Permissions iOS background location
IOS_LOC_PERM=$(jq -r '.expo.ios.infoPlist.NSLocationAlwaysAndWhenInUseUsageDescription // ""' repo/apps/web-assure-app/app.json)
[ -n "$IOS_LOC_PERM" ] && add_row "T01-V1" "iOS NSLocationAlwaysAndWhenInUse permission" "PASS" "" || add_row "T01-V1" "iOS location" "FAIL" "Absent (App Store rejet)"

# T01-V2 (P0) : Android background location permission
ANDROID_BG_LOC=$(jq -r '.expo.android.permissions[]?' repo/apps/web-assure-app/app.json 2>/dev/null | grep -c "ACCESS_BACKGROUND_LOCATION" || echo 0)
[ "${ANDROID_BG_LOC:-0}" -ge 1 ] && add_row "T01-V2" "Android ACCESS_BACKGROUND_LOCATION" "PASS" "" || add_row "T01-V2" "Android background" "FAIL" "Absent (Play Store rejet)"

# T01-V3 (P0) : iOS UIBackgroundModes location
IOS_BG_MODES=$(jq -r '.expo.ios.infoPlist.UIBackgroundModes[]?' repo/apps/web-assure-app/app.json 2>/dev/null | grep -c "location" || echo 0)
[ "${IOS_BG_MODES:-0}" -ge 1 ] && add_row "T01-V3" "iOS UIBackgroundModes location" "PASS" "" || add_row "T01-V3" "iOS BG modes" "WARN" "Absent"

# T01-V4 (P0) : Theme Sofidemy palettes
SOFIDEMY=$(grep -cE "#0E1B3D|#C8A465" repo/apps/web-assure-app/src/theme/sofidemy.ts 2>/dev/null || echo 0)
[ "${SOFIDEMY:-0}" -ge 2 ] && add_row "T01-V4" "Theme Sofidemy palettes" "PASS" "" || add_row "T01-V4" "Theme Sofidemy" "FAIL" "Couleurs absentes"

# T01-V5 (P0) : i18n 4 langues
LANG_FILES=$(find repo/apps/web-assure-app/src/i18n -name "*.json" 2>/dev/null | wc -l)
[ "${LANG_FILES:-0}" -ge 4 ] && add_row "T01-V5" "i18n 4 langues" "PASS" "$LANG_FILES" || add_row "T01-V5" "i18n 4 langues" "FAIL" "$LANG_FILES / 4"

# T01-V6 (P0) : 9 ecrans squelette
SCREENS_COUNT=$(find repo/apps/web-assure-app/src/screens -name "*Screen.tsx" 2>/dev/null | wc -l)
[ "${SCREENS_COUNT:-0}" -ge 9 ] && add_row "T01-V6" "9 ecrans squelette" "PASS" "$SCREENS_COUNT" || add_row "T01-V6" "9 ecrans" "WARN" "$SCREENS_COUNT / 9"

# T01-V7 (P0) : EAS Build preview OK
EAS_BUILD=$(cd repo/apps/web-assure-app && eas build --profile preview --platform all --non-interactive --dry-run 2>&1 | grep -c "build configured" || echo 0)
[ "${EAS_BUILD:-0}" -ge 1 ] && add_row "T01-V7" "EAS Build preview configured" "PASS" "" || add_row "T01-V7" "EAS Build" "WARN" "Verifier manuellement"

# T01-V8 (P0) : Tests bootstrap 5+
T01_TESTS=$(cd repo && pnpm vitest run --reporter=json apps/web-assure-app 2>/dev/null | jq '.numPassedTests // 0' 2>/dev/null || echo 0)
[ "${T01_TESTS:-0}" -ge 5 ] && add_row "T01-V8" "Tests bootstrap 5+" "PASS" "$T01_TESTS" || add_row "T01-V8" "Tests" "WARN" "$T01_TESTS / 5"
```

---

## TACHE 2/12 -- 4.5.2 : Auth Assure + linking 3 cas usage + migration

```bash
echo ""
echo "TACHE 4.5.2 : Auth Assure + linking 3 cas"

# T02-F1 : Migration assure_user_ids
MIGRATION=$(find repo/apps/api/src/migrations -name "*AddAssureUserIds*" 2>/dev/null | head -1)
[ -n "$MIGRATION" ] && add_row "T02-F1" "Migration AddAssureUserIds" "PASS" "" || add_row "T02-F1" "Migration" "FAIL" "Manquante"

# T02-F2 : Migration assure_invitations
MIGRATION_INV=$(find repo/apps/api/src/migrations -name "*CreateAssureInvitations*" 2>/dev/null | head -1)
[ -n "$MIGRATION_INV" ] && add_row "T02-F2" "Migration AssureInvitations" "PASS" "" || add_row "T02-F2" "Migration inv" "WARN" "Manquante"

# T02-V1 (P0) : Colonne assure_user_ids UUID[]
COL_EXISTS=$(pg_query "SELECT data_type FROM information_schema.columns WHERE table_name='insure_policies' AND column_name='assure_user_ids'")
[ "$COL_EXISTS" = "ARRAY" ] && add_row "T02-V1" "Colonne assure_user_ids UUID[]" "PASS" "" || add_row "T02-V1" "Colonne assure_user_ids" "FAIL" "Type=$COL_EXISTS"

# T02-V2 (P0) : Index GIN
INDEX_GIN=$(pg_query "SELECT indexname FROM pg_indexes WHERE tablename='insure_policies' AND indexname LIKE '%assure_user_ids%'")
[ -n "$INDEX_GIN" ] && add_row "T02-V2" "Index GIN assure_user_ids" "PASS" "" || add_row "T02-V2" "Index GIN" "FAIL" "Manquant"

# T02-V3 (P0) : Services auth + linking
[ -f "repo/apps/api/src/modules/assure/assure-auth.service.ts" ] && add_row "T02-V3a" "assure-auth.service" "PASS" "" || add_row "T02-V3a" "auth service" "FAIL" "Manquant"
[ -f "repo/apps/api/src/modules/assure/assure-policy-linking.service.ts" ] && add_row "T02-V3b" "assure-policy-linking.service" "PASS" "" || add_row "T02-V3b" "linking service" "FAIL" "Manquant"

# T02-V4 (P0) : Methods Cas A/B/C
AUTH_SVC="repo/apps/api/src/modules/assure/assure-auth.service.ts"
CAS_A=$(grep -c "linkExistingCustomerAsAssure" "$AUTH_SVC" 2>/dev/null || echo 0)
CAS_B=$(grep -c "createAssureInvitation\|registerAssureFromInvitation" "$AUTH_SVC" 2>/dev/null || echo 0)
[ "${CAS_A:-0}" -ge 1 ] && [ "${CAS_B:-0}" -ge 2 ] && add_row "T02-V4" "Methods 3 cas usage (A+B)" "PASS" "" || add_row "T02-V4" "Methods 3 cas" "FAIL" "A=$CAS_A B=$CAS_B"

# T02-V5 (P0) : verifyAssureBelongsToPolicy ANY query
LINKING_SVC="repo/apps/api/src/modules/assure/assure-policy-linking.service.ts"
VERIFY_BELONGS=$(grep -cE "verifyAssureBelongsToPolicy\|ANY\(p\.assure_user_ids\)" "$LINKING_SVC" 2>/dev/null || echo 0)
[ "${VERIFY_BELONGS:-0}" -ge 1 ] && add_row "T02-V5" "verifyAssureBelongsToPolicy ANY()" "PASS" "" || add_row "T02-V5" "verifyBelongs" "FAIL" "Absent"

# T02-V6 : Tests 10+
T02_TESTS=$(cd repo && pnpm vitest run --reporter=json apps/api/src/modules/assure 2>/dev/null | jq '.numPassedTests // 0' 2>/dev/null || echo 0)
[ "${T02_TESTS:-0}" -ge 10 ] && add_row "T02-V6" "Tests auth+linking 10+" "PASS" "$T02_TESTS" || add_row "T02-V6" "Tests" "WARN" "$T02_TESTS / 10"
```

---

## TACHE 3/12 -- 4.5.3 : Dashboard Assure + Home + 3 actions

```bash
echo ""
echo "TACHE 4.5.3 : Dashboard Assure Home"

[ -f "repo/apps/web-assure-app/src/screens/HomeScreen.tsx" ] && add_row "T03-F1" "HomeScreen" "PASS" "" || add_row "T03-F1" "HomeScreen" "FAIL" "Manquant"

# T03-V1 : 3 actions rapides (Declarer + Urgence + Attestation)
HOME="repo/apps/web-assure-app/src/screens/HomeScreen.tsx"
ACTIONS=$(grep -cE "actions\.declare|actions\.emergency|actions\.attestation" "$HOME" 2>/dev/null || echo 0)
[ "${ACTIONS:-0}" -ge 3 ] && add_row "T03-V1" "3 actions rapides" "PASS" "" || add_row "T03-V1" "Actions" "WARN" "$ACTIONS / 3"

# T03-V2 : Hooks polices + sinistres
HOOKS=$(find repo/apps/web-assure-app/src/hooks -name "useAssure*.ts" 2>/dev/null | wc -l)
[ "${HOOKS:-0}" -ge 2 ] && add_row "T03-V2" "Hooks useAssurePolicies+Sinistres" "PASS" "$HOOKS" || add_row "T03-V2" "Hooks" "WARN" "$HOOKS"

# T03-V3 : Tests 6+
T03_TESTS=$(cd repo && pnpm vitest run --reporter=json apps/web-assure-app/src/screens/HomeScreen.test.tsx 2>/dev/null | jq '.numPassedTests // 0' 2>/dev/null || echo 0)
[ "${T03_TESTS:-0}" -ge 6 ] && add_row "T03-V3" "Tests home 6+" "PASS" "$T03_TESTS" || add_row "T03-V3" "Tests" "WARN" "$T03_TESTS / 6"
```

---

## TACHE 4/12 -- 4.5.4 : NOUVEAU Carte police QR Code signed + offline

```bash
echo ""
echo "TACHE 4.5.4 : NOUVEAU Carte police QR Code"

[ -f "repo/apps/web-assure-app/src/screens/PolicyCardScreen.tsx" ] && add_row "T04-F1" "PolicyCardScreen" "PASS" "" || add_row "T04-F1" "Screen" "FAIL" "Manquant"

# T04-F2 : Service API
[ -f "repo/apps/api/src/modules/assure/assure-policy-card.service.ts" ] && add_row "T04-F2" "policy-card.service" "PASS" "" || add_row "T04-F2" "Service" "FAIL" "Manquant"

# T04-F3 : Endpoint public verify
PUBLIC_VERIFY=$(find repo/apps/api/src -name "*public-policy-verify*" 2>/dev/null | head -1)
[ -n "$PUBLIC_VERIFY" ] && add_row "T04-F3" "public-policy-verify endpoint" "PASS" "" || add_row "T04-F3" "Endpoint public" "FAIL" "Manquant"

# T04-V1 (P0) : QR Code signed payload (carrier private key)
QR_SIGNING=$(grep -rE "signingService\|carrier-private-key\|signedQrPayload" repo/apps/api/src/modules/assure 2>/dev/null | wc -l)
[ "${QR_SIGNING:-0}" -ge 1 ] && add_row "T04-V1" "QR Code signed carrier key" "PASS" "" || add_row "T04-V1" "QR signing" "FAIL" "Anti-fraud absent"

# T04-V2 (P0) : Cache offline 30 jours
OFFLINE_CACHE=$(grep -rE "staleTime.*30.*day\|30.*days\|2592000" repo/apps/web-assure-app/src 2>/dev/null | wc -l)
[ "${OFFLINE_CACHE:-0}" -ge 1 ] && add_row "T04-V2" "Cache offline 30j" "PASS" "" || add_row "T04-V2" "Cache offline" "WARN" "Absent"

# T04-V3 (P0) : QR Code library react-native-qrcode-svg
QR_LIB=$(grep -c "react-native-qrcode-svg" repo/apps/web-assure-app/package.json 2>/dev/null || echo 0)
[ "${QR_LIB:-0}" -ge 1 ] && add_row "T04-V3" "QR library installed" "PASS" "" || add_row "T04-V3" "QR library" "FAIL" "Manquante"

# T04-V4 (P0) : Modal plein-ecran
FULLSCREEN_QR=$(grep -rE "isFullScreenQr\|Modal.*qr\|QrCodeFullScreen" repo/apps/web-assure-app/src 2>/dev/null | wc -l)
[ "${FULLSCREEN_QR:-0}" -ge 1 ] && add_row "T04-V4" "Mode plein-ecran QR" "PASS" "" || add_row "T04-V4" "Plein-ecran" "WARN" "Absent"

# T04-V5 : Tests 8+
T04_TESTS=$(cd repo && pnpm vitest run --reporter=json apps/web-assure-app/src/screens/PolicyCardScreen.test.tsx 2>/dev/null | jq '.numPassedTests // 0' 2>/dev/null || echo 0)
[ "${T04_TESTS:-0}" -ge 8 ] && add_row "T04-V5" "Tests policy card 8+" "PASS" "$T04_TESTS" || add_row "T04-V5" "Tests" "WARN" "$T04_TESTS / 8"
```

---

## TACHE 5/12 -- 4.5.5 : NOUVEAU FNOL Assure + Sprint 24 trigger

```bash
echo ""
echo "TACHE 4.5.5 : NOUVEAU FNOL Assure 4 etapes"

[ -f "repo/apps/web-assure-app/src/screens/SinistreNewScreen.tsx" ] && add_row "T05-F1" "SinistreNewScreen" "PASS" "" || add_row "T05-F1" "Screen" "FAIL" "Manquant"

# T05-F2 : 4 composants FnolStep
FNOL_STEPS=$(find repo/apps/web-assure-app/src/components/fnol -name "FnolStep*.tsx" 2>/dev/null | wc -l)
[ "${FNOL_STEPS:-0}" -ge 4 ] && add_row "T05-F2" "4 composants FnolStep" "PASS" "$FNOL_STEPS" || add_row "T05-F2" "FnolStep" "WARN" "$FNOL_STEPS / 4"

# T05-F3 : Service API FNOL Assure
[ -f "repo/apps/api/src/modules/assure/assure-fnol.service.ts" ] && add_row "T05-F3" "assure-fnol.service" "PASS" "" || add_row "T05-F3" "Service" "FAIL" "Manquant"

# T05-V1 (P0) : Kafka trigger Sprint 24
KAFKA_TRIGGER=$(grep -rE "insurtech\.events\.repair\|fnol_declared\|source.*assure_app" repo/apps/api/src/modules/assure 2>/dev/null | wc -l)
[ "${KAFKA_TRIGGER:-0}" -ge 1 ] && add_row "T05-V1" "Kafka trigger Sprint 24" "PASS" "" || add_row "T05-V1" "Kafka trigger" "FAIL" "Absent"

# T05-V2 (P0) : Notification Customer Cas B2B
NOTIF_CUSTOMER=$(grep -rE "customer_assure_declared_fnol\|notificationRouter" repo/apps/api/src/modules/assure 2>/dev/null | wc -l)
[ "${NOTIF_CUSTOMER:-0}" -ge 1 ] && add_row "T05-V2" "Notification Customer B2B" "PASS" "" || add_row "T05-V2" "Notif Customer" "WARN" "Absent"

# T05-V3 (P0) : Permission assure.sinistres.report
PERM_FNOL=$(grep -rE "assure\.sinistres\.report" repo/apps/api/src/modules/assure 2>/dev/null | wc -l)
[ "${PERM_FNOL:-0}" -ge 1 ] && add_row "T05-V3" "Permission sinistres.report" "PASS" "" || add_row "T05-V3" "Permission" "WARN" "Absent"

# T05-V4 (P0) : verifyAssureBelongsToPolicy check
VERIFY_CHECK=$(grep -rE "verifyAssureBelongsToPolicy.*fnol\|belongs.*policyId" repo/apps/api/src/modules/assure 2>/dev/null | wc -l)
[ "${VERIFY_CHECK:-0}" -ge 1 ] && add_row "T05-V4" "verifyBelongs check FNOL" "PASS" "" || add_row "T05-V4" "Belongs check" "WARN" "Absent"

# T05-V5 : Tests E2E Detox 10+
T05_DETOX=$(cd repo/apps/web-assure-app && pnpm detox test e2e/fnol-wizard.e2e.ts --configuration ios.sim.debug --reporter=json 2>/dev/null | jq '.numPassedTests // 0' 2>/dev/null || echo 0)
[ "${T05_DETOX:-0}" -ge 10 ] && add_row "T05-V5" "Tests Detox FNOL 10+" "PASS" "$T05_DETOX" || add_row "T05-V5" "Tests Detox" "WARN" "$T05_DETOX / 10"
```

---

## TACHE 6/12 -- 4.5.6 : Sinistres list + tabs + filtres

```bash
echo ""
echo "TACHE 4.5.6 : Sinistres list"

[ -f "repo/apps/web-assure-app/src/screens/SinistresScreen.tsx" ] && add_row "T06-F1" "SinistresScreen" "PASS" "" || add_row "T06-F1" "Screen" "FAIL" "Manquant"

# T06-V1 : Tabs implementation
TABS_LIB=$(grep -c "react-native-tab-view\|TabView" repo/apps/web-assure-app/src/screens/SinistresScreen.tsx 2>/dev/null || echo 0)
[ "${TABS_LIB:-0}" -ge 1 ] && add_row "T06-V1" "Tabs implementation" "PASS" "" || add_row "T06-V1" "Tabs" "WARN" "Absent"

# T06-V2 : Tests 4+
T06_TESTS=$(cd repo && pnpm vitest run --reporter=json apps/web-assure-app/src/screens/SinistresScreen.test.tsx 2>/dev/null | jq '.numPassedTests // 0' 2>/dev/null || echo 0)
[ "${T06_TESTS:-0}" -ge 4 ] && add_row "T06-V2" "Tests sinistres 4+" "PASS" "$T06_TESTS" || add_row "T06-V2" "Tests" "WARN" "$T06_TESTS / 4"
```

---

## TACHE 7/12 -- 4.5.7 : Tracking SSE 12 milestones mobile

```bash
echo ""
echo "TACHE 4.5.7 : Tracking SSE mobile"

[ -f "repo/apps/web-assure-app/src/screens/SinistreTrackingScreen.tsx" ] && add_row "T07-F1" "TrackingScreen" "PASS" "" || add_row "T07-F1" "Screen" "FAIL" "Manquant"

# T07-F2 : Hook useRealtimeTracking
[ -f "repo/apps/web-assure-app/src/hooks/useRealtimeTracking.ts" ] && add_row "T07-F2" "useRealtimeTracking hook" "PASS" "" || add_row "T07-F2" "Hook" "FAIL" "Manquant"

# T07-V1 (P0) : Library react-native-event-source
SSE_LIB=$(grep -c "react-native-event-source" repo/apps/web-assure-app/package.json 2>/dev/null || echo 0)
[ "${SSE_LIB:-0}" -ge 1 ] && add_row "T07-V1" "SSE library installed" "PASS" "" || add_row "T07-V1" "SSE library" "FAIL" "Manquante"

# T07-V2 (P0) : 12 milestones declares
MILESTONES_COUNT=$(grep -rE "MILESTONES|milestone" repo/apps/web-assure-app/src/components/tracking 2>/dev/null | grep -oE "declared|carrier_reviewed|tow_dispatched|vehicle_received|diagnosed|devis_sent|expert_validated|carrier_approved|parts_ordered|repair_in_progress|qc_done|ready_for_delivery" | sort -u | wc -l)
[ "${MILESTONES_COUNT:-0}" -ge 10 ] && add_row "T07-V2" "12 milestones declares" "PASS" "$MILESTONES_COUNT / 12" || add_row "T07-V2" "Milestones" "WARN" "$MILESTONES_COUNT / 12"

# T07-V3 : Reconnection auto
RECONNECT=$(grep -rE "reconnect\|onerror" repo/apps/web-assure-app/src/hooks/useRealtimeTracking.ts 2>/dev/null | wc -l)
[ "${RECONNECT:-0}" -ge 1 ] && add_row "T07-V3" "SSE reconnection auto" "PASS" "" || add_row "T07-V3" "Reconnection" "WARN" "Absent"

# T07-V4 : Tests Detox 8+
T07_DETOX=$(cd repo/apps/web-assure-app && pnpm detox test e2e/tracking-sse.e2e.ts --configuration ios.sim.debug --reporter=json 2>/dev/null | jq '.numPassedTests // 0' 2>/dev/null || echo 0)
[ "${T07_DETOX:-0}" -ge 8 ] && add_row "T07-V4" "Tests tracking SSE 8+" "PASS" "$T07_DETOX" || add_row "T07-V4" "Tests" "WARN" "$T07_DETOX / 8"
```

---

## TACHE 8/12 -- 4.5.8 : NOUVEAU GPS tow + emergency + map

```bash
echo ""
echo "TACHE 4.5.8 : NOUVEAU GPS tow + emergency"

[ -f "repo/apps/web-assure-app/src/screens/EmergencyScreen.tsx" ] && add_row "T08-F1" "EmergencyScreen" "PASS" "" || add_row "T08-F1" "EmergencyScreen" "FAIL" "Manquant"
[ -f "repo/apps/web-assure-app/src/components/tracking/TowGpsMap.tsx" ] && add_row "T08-F2" "TowGpsMap component" "PASS" "" || add_row "T08-F2" "TowGpsMap" "WARN" "Manquant"

# T08-F3 : Hook GPS tracking
[ -f "repo/apps/web-assure-app/src/hooks/useGpsTowTracking.ts" ] && add_row "T08-F3a" "useGpsTowTracking" "PASS" "" || add_row "T08-F3a" "Hook GPS" "WARN" "Manquant"
[ -f "repo/apps/web-assure-app/src/hooks/useBackgroundLocation.ts" ] && add_row "T08-F3b" "useBackgroundLocation" "PASS" "" || add_row "T08-F3b" "BG Location" "WARN" "Manquant"

# T08-V1 (P0) : Library react-native-maps
MAPS_LIB=$(grep -c "react-native-maps" repo/apps/web-assure-app/package.json 2>/dev/null || echo 0)
[ "${MAPS_LIB:-0}" -ge 1 ] && add_row "T08-V1" "Maps library installed" "PASS" "" || add_row "T08-V1" "Maps library" "FAIL" "Manquante"

# T08-V2 (P0) : Emergency service triggers urgent notification
EMERGENCY_SVC="repo/apps/api/src/modules/assure/assure-emergency.service.ts"
EMERGENCY_NOTIF=$(grep -cE "carrier_assure_emergency\|contentType.*urgent" "$EMERGENCY_SVC" 2>/dev/null || echo 0)
[ "${EMERGENCY_NOTIF:-0}" -ge 1 ] && add_row "T08-V2" "Emergency notification urgent" "PASS" "" || add_row "T08-V2" "Emergency notif" "FAIL" "Workflow absent"

# T08-V3 (P0) : Permission assure.contact_emergency
PERM_EMERG=$(grep -rE "assure\.contact_emergency" repo/apps/api/src/modules/assure 2>/dev/null | wc -l)
[ "${PERM_EMERG:-0}" -ge 1 ] && add_row "T08-V3" "Permission contact_emergency" "PASS" "" || add_row "T08-V3" "Permission" "FAIL" "Absent"

# T08-V4 (P0) : False positive prevention (confirmation pre-trigger)
FALSE_POS=$(grep -rE "Alert.alert.*confirm\|confirmation pre.*trigger\|cancellation" repo/apps/web-assure-app/src/screens/EmergencyScreen.tsx 2>/dev/null | wc -l)
[ "${FALSE_POS:-0}" -ge 1 ] && add_row "T08-V4" "False positive prevention" "PASS" "" || add_row "T08-V4" "False positive" "WARN" "Absent"

# T08-V5 : Police 19 + Medical 150 link
POLICE_LINK=$(grep -cE "tel:19\|tel:150" repo/apps/web-assure-app/src/screens/EmergencyScreen.tsx 2>/dev/null || echo 0)
[ "${POLICE_LINK:-0}" -ge 2 ] && add_row "T08-V5" "Police 19 + Medical 150 links" "PASS" "" || add_row "T08-V5" "Emergency links" "WARN" "$POLICE_LINK / 2"

# T08-V6 : Tests 10+
T08_TESTS=$(cd repo && pnpm vitest run --reporter=json apps/web-assure-app/src/screens/EmergencyScreen.test.tsx 2>/dev/null | jq '.numPassedTests // 0' 2>/dev/null || echo 0)
[ "${T08_TESTS:-0}" -ge 10 ] && add_row "T08-V6" "Tests emergency 10+" "PASS" "$T08_TESTS" || add_row "T08-V6" "Tests" "WARN" "$T08_TESTS / 10"
```

---

## TACHE 9/12 -- 4.5.9 : Documents Assure lecture-seule + offline

```bash
echo ""
echo "TACHE 4.5.9 : Documents Assure"

[ -f "repo/apps/web-assure-app/src/screens/DocumentsScreen.tsx" ] && add_row "T09-F1" "DocumentsScreen" "PASS" "" || add_row "T09-F1" "Screen" "FAIL" "Manquant"

# T09-V1 : S3 signed URLs
S3_SIGNED=$(grep -rE "getSignedUrl\|presignedUrl" repo/apps/api/src/modules/assure 2>/dev/null | wc -l)
[ "${S3_SIGNED:-0}" -ge 1 ] && add_row "T09-V1" "S3 signed URLs" "PASS" "" || add_row "T09-V1" "S3 signed" "WARN" "Absent"

# T09-V2 : Cache AsyncStorage offline 30j
ASYNC_STORAGE=$(grep -rE "AsyncStorage\|staleTime.*30" repo/apps/web-assure-app/src/screens/DocumentsScreen.tsx 2>/dev/null | wc -l)
[ "${ASYNC_STORAGE:-0}" -ge 1 ] && add_row "T09-V2" "Cache offline 30j" "PASS" "" || add_row "T09-V2" "Cache offline" "WARN" "Absent"

# T09-V3 : Permission assure.documents.access
PERM_DOCS=$(grep -rE "assure\.documents\.access" repo/apps/api/src/modules/assure 2>/dev/null | wc -l)
[ "${PERM_DOCS:-0}" -ge 1 ] && add_row "T09-V3" "Permission documents.access" "PASS" "" || add_row "T09-V3" "Permission" "WARN" "Absent"

# T09-V4 : Tests 4+
T09_TESTS=$(cd repo && pnpm vitest run --reporter=json apps/web-assure-app/src/screens/DocumentsScreen.test.tsx 2>/dev/null | jq '.numPassedTests // 0' 2>/dev/null || echo 0)
[ "${T09_TESTS:-0}" -ge 4 ] && add_row "T09-V4" "Tests documents 4+" "PASS" "$T09_TESTS" || add_row "T09-V4" "Tests" "WARN" "$T09_TESTS / 4"
```

---

## TACHE 10/12 -- 4.5.10 : Profile + emergency contacts + multilingue

```bash
echo ""
echo "TACHE 4.5.10 : Profile + emergency contacts"

[ -f "repo/apps/web-assure-app/src/screens/ProfileScreen.tsx" ] && add_row "T10-F1" "ProfileScreen" "PASS" "" || add_row "T10-F1" "Screen" "FAIL" "Manquant"

# T10-V1 (P0) : Emergency contacts max 3 modifiable
EMERG_CONTACTS=$(grep -rE "EmergencyContacts\|emergencyContacts.*max.*3\|contacts.length.*3" repo/apps/web-assure-app/src 2>/dev/null | wc -l)
[ "${EMERG_CONTACTS:-0}" -ge 1 ] && add_row "T10-V1" "Emergency contacts max 3" "PASS" "" || add_row "T10-V1" "Emergency contacts" "WARN" "Absent"

# T10-V2 : Multilingue switching
LANG_SWITCH=$(grep -rE "i18n\.changeLanguage\|setLanguage\|LanguageSwitcher" repo/apps/web-assure-app/src/screens/ProfileScreen.tsx 2>/dev/null | wc -l)
[ "${LANG_SWITCH:-0}" -ge 1 ] && add_row "T10-V2" "Multilingue switching" "PASS" "" || add_row "T10-V2" "Multilingue" "WARN" "Absent"

# T10-V3 : Permission profile.update_mine
PERM_PROFILE=$(grep -rE "assure\.profile\.update_mine" repo/apps/api/src/modules/assure 2>/dev/null | wc -l)
[ "${PERM_PROFILE:-0}" -ge 1 ] && add_row "T10-V3" "Permission profile.update_mine" "PASS" "" || add_row "T10-V3" "Permission" "WARN" "Absent"

# T10-V4 : Tests 6+
T10_TESTS=$(cd repo && pnpm vitest run --reporter=json apps/web-assure-app/src/screens/ProfileScreen.test.tsx 2>/dev/null | jq '.numPassedTests // 0' 2>/dev/null || echo 0)
[ "${T10_TESTS:-0}" -ge 6 ] && add_row "T10-V4" "Tests profile 6+" "PASS" "$T10_TESTS" || add_row "T10-V4" "Tests" "WARN" "$T10_TESTS / 6"
```

---

## TACHE 11/12 -- 4.5.11 : NOUVEAU Push + WhatsApp scope strict 8 templates

```bash
echo ""
echo "TACHE 4.5.11 : NOUVEAU Push + WhatsApp"

[ -f "repo/apps/api/src/modules/assure/assure-notifications.service.ts" ] && add_row "T11-F1" "notifications.service" "PASS" "" || add_row "T11-F1" "Service" "FAIL" "Manquant"

# T11-V1 (P0 CRITIQUE) : 8 templates assure whitelist
TEMPLATES_ASSURE=$(node -e "
try {
  const { STATUS_ONLY_TEMPLATES } = require('./repo/packages/comm/dist');
  console.log(STATUS_ONLY_TEMPLATES.assure ? STATUS_ONLY_TEMPLATES.assure.length : 0);
} catch (e) { console.log('0'); }
" 2>/dev/null || echo 0)
if [ "${TEMPLATES_ASSURE:-0}" -ge 8 ]; then
  add_row "T11-V1" "8 templates assure whitelist Sprint 9" "PASS" "$TEMPLATES_ASSURE"
else
  add_row "T11-V1" "8 templates assure" "FAIL" "$TEMPLATES_ASSURE / 8 (Sprint 9 v3.0 prerequis)"
fi

# T11-V2 (P0 CRITIQUE) : Aucun template assure data sensible
DANGEROUS_VARS_ASSURE=$(grep -rE "\{\{\s*(amount|cin|total_mad|iban)" repo/packages/comm/src/templates/whatsapp/assure 2>/dev/null | wc -l)
[ "${DANGEROUS_VARS_ASSURE:-0}" -eq 0 ] && add_row "T11-V2" "Templates assure 0 data sensible" "PASS" "" || add_row "T11-V2" "Data sensible" "FAIL" "$DANGEROUS_VARS_ASSURE CRITIQUE LEGAL"

# T11-V3 : Expo push token registered
EXPO_PUSH=$(grep -rE "getExpoPushTokenAsync\|registerPushToken" repo/apps/web-assure-app/src 2>/dev/null | wc -l)
[ "${EXPO_PUSH:-0}" -ge 1 ] && add_row "T11-V3" "Expo push token registered" "PASS" "" || add_row "T11-V3" "Expo push" "FAIL" "Absent"

# T11-V4 : Tests 5+
T11_TESTS=$(cd repo && pnpm vitest run --reporter=json apps/api/src/modules/assure/assure-notifications.service.spec.ts 2>/dev/null | jq '.numPassedTests // 0' 2>/dev/null || echo 0)
[ "${T11_TESTS:-0}" -ge 5 ] && add_row "T11-V4" "Tests notifications 5+" "PASS" "$T11_TESTS" || add_row "T11-V4" "Tests" "WARN" "$T11_TESTS / 5"
```

---

## TACHE 12/12 -- 4.5.12 : Tests E2E Detox 25+ + seeds 10 + EAS Build

```bash
echo ""
echo "TACHE 4.5.12 : Tests Detox + EAS Build production"

# T12-V1 (P0) : Tests Detox 25+
DETOX_TESTS=$(cd repo/apps/web-assure-app && pnpm detox test --configuration ios.sim.debug --reporter=json 2>/dev/null | jq '.numPassedTests // 0' 2>/dev/null || echo 0)
if [ "${DETOX_TESTS:-0}" -ge 25 ]; then
  add_row "T12-V1" "Tests Detox >= 25" "PASS" "$DETOX_TESTS"
elif [ "${DETOX_TESTS:-0}" -ge 18 ]; then
  add_row "T12-V1" "Tests Detox >= 25" "WARN" "$DETOX_TESTS / 25"
else
  add_row "T12-V1" "Tests Detox >= 25" "FAIL" "$DETOX_TESTS / 25"
fi

# T12-V2 (P0) : Seeds 10 assures (3 cas usage)
SEEDS_FILE=$(find repo/apps/api/src -name "*assure*seed*" -o -name "seeds-assures*" 2>/dev/null | head -1)
if [ -n "$SEEDS_FILE" ]; then
  SEEDS_COUNT=$(grep -cE "first_name:|firstName:" "$SEEDS_FILE" 2>/dev/null || echo 0)
  [ "${SEEDS_COUNT:-0}" -ge 10 ] && add_row "T12-V2" "Seeds 10 assures" "PASS" "$SEEDS_COUNT" || add_row "T12-V2" "Seeds" "WARN" "$SEEDS_COUNT / 10"
else
  add_row "T12-V2" "Seeds file" "FAIL" "Manquant"
fi

# T12-V3 (P0) : Coverage >= 85%
COV=$(cd repo && pnpm vitest run --coverage --reporter=json apps/web-assure-app 2>/dev/null | jq '.coverageMap.total.lines.pct // 0' 2>/dev/null || echo 0)
if (( $(echo "${COV:-0} >= 85" | bc -l 2>/dev/null || echo 0) )); then
  add_row "T12-V3" "Coverage >= 85%" "PASS" "${COV}%"
else
  add_row "T12-V3" "Coverage" "WARN" "${COV}% / 85%"
fi

# T12-V4 : EAS Build production iOS + Android
EAS_PROFILES_OK=$(jq -r '.build.production' repo/apps/web-assure-app/eas.json 2>/dev/null | grep -c "ios\|android" || echo 0)
[ "${EAS_PROFILES_OK:-0}" -ge 1 ] && add_row "T12-V4" "EAS Build production profile" "PASS" "" || add_row "T12-V4" "EAS production" "WARN" "Verifier eas.json"
```

---

## VERIFICATIONS TRANSVERSALES SPRINT 18 (12 transversaux)

```bash
echo ""
echo "TRANSVERSAUX SPRINT 18"

cd repo

# TR-BUILD
pnpm turbo run build --filter=@insurtech/web-assure-app 2>&1 > /tmp/build-tr.log; BC=$?
[ $BC -eq 0 ] && add_row "TR-BUILD" "Build web-assure-app OK" "PASS" "" || auto_repair "pnpm install --force && pnpm turbo run build --filter=@insurtech/web-assure-app" "[ \$? -eq 0 ]" "TR-BUILD" "Build"

# TR-TYPECHECK
pnpm tsc --noEmit -p apps/web-assure-app 2>&1 > /tmp/tsc-tr.log
TS_ERR=$(grep -c "error TS" /tmp/tsc-tr.log)
[ "$TS_ERR" -eq 0 ] && add_row "TR-TYPECHECK" "TypeScript 0 erreur" "PASS" "" || add_row "TR-TYPECHECK" "TypeScript" "FAIL" "$TS_ERR erreurs"

# TR-TESTS
TEST_RESULTS=$(pnpm vitest run --reporter=json apps/web-assure-app 2>/dev/null | jq '{passed: .numPassedTests, failed: .numFailedTests}' 2>/dev/null || echo '{}')
TR_PASSED=$(echo "$TEST_RESULTS" | jq -r '.passed // 0')
TR_FAILED=$(echo "$TEST_RESULTS" | jq -r '.failed // 0')
[ "${TR_FAILED:-0}" -eq 0 ] && [ "${TR_PASSED:-0}" -gt 0 ] && add_row "TR-TESTS" "Tests Vitest tous PASS" "PASS" "$TR_PASSED / 0 failed" || add_row "TR-TESTS" "Tests" "FAIL" "$TR_PASSED / $TR_FAILED failed"

# TR-COVERAGE
COV=$(pnpm vitest run --coverage --reporter=json apps/web-assure-app 2>/dev/null | jq '.coverageMap.total.lines.pct // 0' 2>/dev/null || echo 0)
if (( $(echo "${COV:-0} >= 85" | bc -l 2>/dev/null || echo 0) )); then
  add_row "TR-COVERAGE" "Coverage >= 85%" "PASS" "${COV}%"
else
  add_row "TR-COVERAGE" "Coverage" "WARN" "${COV}% / 85%"
fi

# TR-LINT
pnpm lint apps/web-assure-app 2>&1 > /tmp/lint-tr.log; LC=$?
[ $LC -eq 0 ] && add_row "TR-LINT" "Biome lint 0 erreur" "PASS" "" || auto_repair "pnpm lint apps/web-assure-app --apply" "pnpm lint apps/web-assure-app" "TR-LINT" "Biome lint"

cd ..

# TR-NO-EMOJI
EMOJI=$(grep -rP "[\x{1F300}-\x{1F9FF}]|[\x{2600}-\x{27BF}]" repo/apps/web-assure-app --include="*.tsx" --include="*.ts" --include="*.json" --include="*.md" 2>/dev/null | wc -l)
[ "$EMOJI" -eq 0 ] && add_row "TR-NO-EMOJI" "0 emoji" "PASS" "" || add_row "TR-NO-EMOJI" "Emoji" "FAIL" "$EMOJI emojis"

# TR-CONSOLE
CONSOLE=$(grep -rn "console\.log\|console\.error" repo/apps/web-assure-app --include="*.tsx" --include="*.ts" 2>/dev/null | grep -v ".spec.ts" | grep -v ".test.tsx" | grep -v ".e2e.ts" | wc -l)
[ "$CONSOLE" -eq 0 ] && add_row "TR-CONSOLE" "0 console.*" "PASS" "" || add_row "TR-CONSOLE" "console" "FAIL" "$CONSOLE occurrences"

# TR-COMMITS
NON_CONV=$(git log --since="2 weeks ago" --pretty=format:"%s" -- repo/apps/web-assure-app | grep -vE "^(feat|fix|docs|test|chore|refactor|perf)(\(.+\))?:" | wc -l)
[ "$NON_CONV" -eq 0 ] && add_row "TR-COMMITS" "Conventional Commits 100%" "PASS" "" || add_row "TR-COMMITS" "Commits" "WARN" "$NON_CONV non-conformes"

# TR-TENANT
TENANT_USAGE=$(grep -rE "tenantId" repo/apps/api/src/modules/assure --include="*.ts" 2>/dev/null | wc -l)
[ "${TENANT_USAGE:-0}" -ge 10 ] && add_row "TR-TENANT" "Multi-tenant tenantId" "PASS" "$TENANT_USAGE refs" || add_row "TR-TENANT" "Tenant" "WARN" "$TENANT_USAGE"

# TR-ZOD
ZOD_USAGE=$(grep -rE "from 'zod'\|z\.object" repo/apps/web-assure-app/src --include="*.ts" 2>/dev/null | wc -l)
[ "${ZOD_USAGE:-0}" -ge 3 ] && add_row "TR-ZOD" "Zod validation" "PASS" "$ZOD_USAGE" || add_row "TR-ZOD" "Zod" "WARN" "$ZOD_USAGE"

# TR-MIGRATIONS
MIGRATIONS_COUNT=$(find repo/apps/api/src/migrations -name "*AssureUserIds*" -o -name "*AssureInvitations*" 2>/dev/null | wc -l)
[ "${MIGRATIONS_COUNT:-0}" -ge 2 ] && add_row "TR-MIGRATIONS" "Migrations Sprint 18 (2+)" "PASS" "$MIGRATIONS_COUNT" || add_row "TR-MIGRATIONS" "Migrations" "WARN" "$MIGRATIONS_COUNT / 2"

# TR-MULTILINGUE
LANG_FILES=$(find repo/apps/web-assure-app/src/i18n -name "*.json" 2>/dev/null | wc -l)
[ "${LANG_FILES:-0}" -eq 4 ] && add_row "TR-MULTILINGUE" "4 langues messages" "PASS" "" || add_row "TR-MULTILINGUE" "Multilingue" "WARN" "$LANG_FILES / 4"
```

---

## VERIFICATIONS SPECIFIQUES SPRINT 18 (6 specifiques mobile)

```bash
echo ""
echo "VERIFICATIONS SPECIFIQUES SPRINT 18"

# SP-EXPO-SDK : Expo SDK 51
EXPO_SDK_VERSION=$(jq -r '.dependencies.expo' repo/apps/web-assure-app/package.json 2>/dev/null)
[[ "$EXPO_SDK_VERSION" =~ 51 ]] && add_row "SP-EXPO-SDK" "Expo SDK 51 confirme" "PASS" "$EXPO_SDK_VERSION" || add_row "SP-EXPO-SDK" "Expo SDK 51" "FAIL" "$EXPO_SDK_VERSION"

# SP-EAS-BUILD-IOS : EAS Build iOS production OK
EAS_IOS_DRY=$(cd repo/apps/web-assure-app && eas build --platform ios --profile production --non-interactive --dry-run 2>&1 | grep -c "build configured\|All good" || echo 0)
[ "${EAS_IOS_DRY:-0}" -ge 1 ] && add_row "SP-EAS-BUILD-IOS" "EAS Build iOS production" "PASS" "" || add_row "SP-EAS-BUILD-IOS" "EAS iOS" "WARN" "Verifier manuel"

# SP-EAS-BUILD-ANDROID : EAS Build Android production OK
EAS_AND_DRY=$(cd repo/apps/web-assure-app && eas build --platform android --profile production --non-interactive --dry-run 2>&1 | grep -c "build configured\|All good" || echo 0)
[ "${EAS_AND_DRY:-0}" -ge 1 ] && add_row "SP-EAS-BUILD-ANDROID" "EAS Build Android production" "PASS" "" || add_row "SP-EAS-BUILD-ANDROID" "EAS Android" "WARN" "Verifier manuel"

# SP-QR-CODE-SIGNED : QR Code signature service
QR_SIGNED=$(grep -rE "signingService\|carrier-private-key\|verify.*signature" repo/apps/api/src/modules 2>/dev/null | wc -l)
[ "${QR_SIGNED:-0}" -ge 1 ] && add_row "SP-QR-CODE-SIGNED" "QR Code signing service" "PASS" "" || add_row "SP-QR-CODE-SIGNED" "QR signing" "WARN" "Anti-fraud absent"

# SP-GPS-BACKGROUND : Background location permissions
IOS_BG_LOC=$(jq -r '.expo.ios.infoPlist.UIBackgroundModes[]?' repo/apps/web-assure-app/app.json 2>/dev/null | grep -c "location" || echo 0)
ANDROID_BG_LOC=$(jq -r '.expo.android.permissions[]?' repo/apps/web-assure-app/app.json 2>/dev/null | grep -c "ACCESS_BACKGROUND_LOCATION" || echo 0)
if [ "${IOS_BG_LOC:-0}" -ge 1 ] && [ "${ANDROID_BG_LOC:-0}" -ge 1 ]; then
  add_row "SP-GPS-BACKGROUND" "GPS background iOS + Android" "PASS" ""
else
  add_row "SP-GPS-BACKGROUND" "GPS background" "FAIL" "iOS=$IOS_BG_LOC / Android=$ANDROID_BG_LOC"
fi

# SP-WHATSAPP-ASSURE : Sprint 9 v3.0 assure templates integration
WA_ASSURE_INTEG=$(grep -rE "STATUS_ONLY_TEMPLATES\.assure\|assure_fnol_received\|assure_tow_dispatched" repo/apps/api/src/modules/assure 2>/dev/null | wc -l)
[ "${WA_ASSURE_INTEG:-0}" -ge 1 ] && add_row "SP-WHATSAPP-ASSURE" "Sprint 9 v3.0 assure templates" "PASS" "" || add_row "SP-WHATSAPP-ASSURE" "WhatsApp assure" "WARN" "Absent"
```

---

## GENERATION DU RAPPORT FINAL

```bash
TOTAL=$((PASS + PASS_REPAIRED + FAIL + SKIP + WARN))
SCORE_NUM=$((PASS + PASS_REPAIRED))
SCORE_PCT=$(echo "scale=1; $SCORE_NUM * 100 / $TOTAL" | bc -l 2>/dev/null || echo "0")

JALON="NO-GO"
DOWNSTREAM_STATUS="SPRINT 19 (Vertical Repair Foundation) BLOQUE + EAS production stores impossible"

if (( $(echo "$SCORE_PCT >= 90" | bc -l 2>/dev/null || echo 0) )); then
  JALON="GO"
  DOWNSTREAM_STATUS="Sprint 19 peut demarrer + EAS Build production soumis stores"
elif (( $(echo "$SCORE_PCT >= 80" | bc -l 2>/dev/null || echo 0) )); then
  JALON="GO CONDITIONNEL"
  DOWNSTREAM_STATUS="Sprint 19 demarre parallele + dette technique documentee"
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
**Jalon Sprint 18** : $JALON
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

case "$JALON" in
  GO)
    cat >> "$REPORT_FILE" << EOF
## Jalon GO/NO-GO Sprint 18

**GO** -- Sprint 18 v3.0 valide ($SCORE_PCT%). Assure Mobile App operationnel.

### Actions :

1. **Tag Git** :
\`\`\`bash
git tag -a "sprint-18-complete-v3-assure-mobile" -m "Sprint 18 v3.0 -- score $SCORE_PCT%"
git push origin sprint-18-complete-v3-assure-mobile
\`\`\`

2. **EAS Build production** (iOS + Android) :
\`\`\`bash
cd repo/apps/web-assure-app
eas build --platform ios --profile production --non-interactive
eas build --platform android --profile production --non-interactive
\`\`\`

3. **Submission App Store + Google Play** (post-pilote Phase 7+) :
\`\`\`bash
eas submit --platform ios --latest
eas submit --platform android --latest
\`\`\`

4. **Sprint 19** (Vertical Repair Foundation) peut demarrer

5. **Downstream impacts positifs** :
   - Sprint 24 Master Orchestrator recoit FNOL trigger assure-side
   - Sprint 22.5 Tow Mission GPS visible mobile
   - Demo Day 30 juin 2026 : Mobile App demo-ready (QR Code + FNOL + tracking)
EOF
    ;;
  "GO CONDITIONNEL")
    cat >> "$REPORT_FILE" << EOF
## Jalon GO/NO-GO Sprint 18

**GO CONDITIONNEL** ($SCORE_PCT%) -- Assure Mobile degraded mais utilisable.

### Actions :

1. Documenter dette technique \`dette-technique-sprint-18.md\`
2. Re-tester FAIL avant stores submission (special GPS background + QR signing + WhatsApp assure)
3. **Tag conditionnel** :
\`\`\`bash
git tag -a "sprint-18-complete-v3-conditional" -m "Sprint 18 v3.0 -- score $SCORE_PCT% conditionnel"
\`\`\`
4. Sprint 19 peut commencer en parallele resolution
5. Stores submission reportee jusqu'a resolution P0 FAIL
EOF
    ;;
  NO-GO)
    cat >> "$REPORT_FILE" << EOF
## Jalon GO/NO-GO Sprint 18

**NO-GO** ($SCORE_PCT%) -- Assure Mobile non livrable.

### Actions :

1. **Escalation Saad + Abla** (Assure Mobile = acteur 5 ecosystem 6 acteurs CRITICAL)
2. Identifier FAIL P0 :
   - T01-V1/V2 : Permissions GPS background iOS + Android (Apple/Google rejet)
   - T02-V1/V2 : Migration assure_user_ids[] + index GIN
   - T05-V1 : Kafka trigger Sprint 24 absent
   - T11-V1/V2 : WhatsApp scope strict assure (Sprint 9 v3.0 prerequis)
3. **NE PAS deployer aux stores** (Demo Day risque)
4. Re-V-18 dans 3-5 jours
5. Sprint 19 reste bloque en attendant
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
- **decision-011** : Rebrand Sofidemy theme (T01-V4)
- **decision-012** : Ecosystem 6 acteurs Assure = acteur 5 distinct (T02-V1/V2/V5)
- **correction Saad #7** : WhatsApp scope strict heritage Sprint 9 v3.0 (T11-V1/V2 / SP-WHATSAPP-ASSURE)
- **decision-015** : Demo Day 30 juin 2026 -- Mobile App demo-ready obligatoire

---

## Prochaine etape

**Si GO** :
1. Tag `sprint-18-complete-v3-assure-mobile`
2. EAS Build production iOS + Android
3. Submission App Store + Google Play (post-pilote Phase 7+)
4. Sprint 19 (Vertical Repair Foundation) peut demarrer

**Si GO CONDITIONNEL** : documenter dette + Sprint 19 parallele

**Si NO-GO** : ESCALATION Saad + Abla + Sprint 19 bloque

---

## NOTES IMPORTANTES POUR EXECUTION

1. **Assure Mobile = acteur 5 ecosystem 6 acteurs (decision-012)** : sans GO Sprint 18, ecosystem B2C incomplet
2. **Sprint 9 v3.0 prerequis** : WhatsApp 8 templates assure (T11) depend Sprint 9 STATUS_ONLY_TEMPLATES.assure
3. **Sprint 17 prerequis** : FNOL patterns + tracking SSE reuse depuis Sprint 17 Customer Portal
4. **Permissions GPS background** : iOS UIBackgroundModes + Android ACCESS_BACKGROUND_LOCATION OBLIGATOIRES (App Store / Play Store rejet sinon)
5. **QR Code signing** : carrier private key requise anti-fraud + controle police MA (loi assurance attestation)
6. **Sprint 24 trigger** : FNOL Assure (T05) MUST publish Kafka event `insurtech.events.repair` source='assure_app'
7. **Emergency workflow** : false positive prevention CRITIQUE (confirmation pre-trigger + cancellation 10s)
8. **EAS Build production** : iOS + Android obligatoires post-Tache 4.5.12
9. **Demo Day 30 juin 2026** : Mobile App demo-ready obligatoire (QR Code visible audience)
10. **Auto-reparation activee** sur TR-BUILD + TR-LINT

---

## INSTRUCTION FINALE A CLAUDE CODE / COWORK

Apres execution complete V-18 :

1. **Lire** `sprint18-verify-report.md` integralement
2. **Verifier** le score % final + criteres FAIL P0
3. **Si GO** : tag git + EAS Build production + Sprint 19 demarre
4. **Si GO CONDITIONNEL** : documenter dette + Sprint 19 parallele
5. **Si NO-GO** : ESCALATION Saad + Abla + Sprint 19 bloque
6. **Garder** le rapport pour audit ACAPS (retention 10 ans obligatoire)

---

**Fin verification V-18 v3.0 -- Sprint 18 (4.5) Assure Mobile App.**

**Total criteres** : 60 taches + 12 transversaux + 6 specifiques = 78 criteres
**Auto-reparation active** : TR-BUILD + TR-LINT (3 tentatives)
**Jalon critique** : sans GO V-18, Sprint 19 bloque + EAS stores impossible + Demo Day risque
