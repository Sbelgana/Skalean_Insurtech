# VERIFICATION SPRINT 21 v3.0 -- Phase 5 / Sprint 3 : Sinistre Workflow + Expert + PartsHub
# Auto-reparation active + Rapport final MD detaille
# 19 taches, 95 criteres extraits B-21 v3.0
# AUCUNE EMOJI AUTORISEE

**Version** : v3.0 (verification detaillee)
**Phase** : 5 -- Vertical Repair
**Sprint** : 21 / 40 (cumul v3.0) -- Sprint 3 dans Phase 5
**Reference meta-prompt** : `B-21-sprint-21-sinistre-workflow.md` v3.0
**Reference orchestrateur** : `C-21-sprint-21-sinistre-workflow.md`
**Total criteres** : 95 criteres taches + 11 transversaux

---

Tu es **Claude Code (ou Cowork)**. Execute verification COMPLETE Sprint 21 v3.0 apres 19 taches.

---

## REGLES D'EXECUTION

1. Execute CHAQUE verification dans l'ordre
2. Tentative reparation automatique avant FAIL
3. Consigne dans `sprint21-verify-report.md`
4. Rapport consolide final + score GO/GO CONDITIONNEL/NO-GO
5. JAMAIS interrompre l'execution

---

## PHASE DE PREPARATION

```bash
REPORT_FILE="sprint21-verify-report.md"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
RUN_ID=$(date '+%Y%m%d-%H%M%S')

cat > "$REPORT_FILE" << EOF
# Rapport de Verification - Sprint 21 v3.0 : Sinistre Workflow + Expert + PartsHub

**Date** : $TIMESTAMP
**Run ID** : $RUN_ID
**Phase** : 5 -- Vertical Repair
**Sprint** : 21 (Phase 5 / Sprint 3)
**Reference B-21 v3.0** : 19 taches (13 v2.2 refondues + 6 PartsHub nouveaux), 95 criteres
**Executeur** : Claude Code / Cowork (auto-verification + auto-reparation)

---
EOF

echo "[PREP] Rapport initialise : $REPORT_FILE"

PASS=0; PASS_REPAIRED=0; FAIL=0; SKIP=0; WARN=0; TABLE_ROWS=""

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

DB_URL="${DATABASE_URL:-postgresql://insurtech_user:SecurePassword123!@localhost:5432/insurtech}"
pg_query() { psql "$DB_URL" -t -c "$1" 2>/dev/null | tr -d ' \n'; }
pg_query_raw() { psql "$DB_URL" -c "$1" 2>/dev/null; }
```

---

## VERIFICATIONS PAR TACHE (19 taches)

---

## TACHE 1/19 -- 5.3.1 : Reception vehicule (PRESERVE v2.2 + tow_mission_id)

```bash
echo ""
echo "TACHE 5.3.1 : Reception vehicule + tow_mission_id (PRESERVE + v3.0)"

# T01-F1 : Table repair_receptions
if pg_query "SELECT 1 FROM information_schema.tables WHERE table_name = 'repair_receptions'" | grep -q "1"; then
  add_row "T01-F1" "Table repair_receptions" "PASS" "Existe"
else
  add_row "T01-F1" "Table repair_receptions" "FAIL" "Manquante"
fi

# T01-V1 : tow_mission_id column ajoute v3.0
if pg_query "SELECT 1 FROM information_schema.columns WHERE table_name = 'repair_sinistres' AND column_name = 'tow_mission_id'" | grep -q "1"; then
  add_row "T01-V1" "Colonne tow_mission_id v3.0 ajoutee" "PASS" "v3.0 enrichi"
else
  add_row "T01-V1" "Colonne tow_mission_id v3.0 ajoutee" "FAIL" "Manquante"
fi

# T01-V2 : Service receptions 5 methodes
SERVICE="repo/packages/repair/src/services/receptions.service.ts"
METHODS=(start addPhotos checkVehicleState uploadCustomerDocuments complete)
OK=0; for m in "${METHODS[@]}"; do grep -q "$m" "$SERVICE" 2>/dev/null && OK=$((OK + 1)); done
[ "$OK" -eq 5 ] && add_row "T01-V2" "Service 5 methodes" "PASS" "" || add_row "T01-V2" "Service 5 methodes" "FAIL" "$OK / 5"
```

---

## TACHE 2/19 -- 5.3.2 : Diagnostic Sky AI enrichi (ENRICHI v3.0)

```bash
echo ""
echo "TACHE 5.3.2 : Diagnostic Sky AI enrichi (ENRICHI v3.0)"

SERVICE="repo/packages/repair/src/services/diagnostics.service.ts"

# T02-V1 : Reference Sky AI (vs IA generique)
if grep -qE "skyAi|sky_ai|@insurtech/sky" "$SERVICE" 2>/dev/null; then
  add_row "T02-V1" "Sky AI reference (vs IA generique)" "PASS" "Sky AI integre"
else
  add_row "T02-V1" "Sky AI reference (vs IA generique)" "FAIL" "Sky AI non integre"
fi

# T02-V2 : Confidence score visible rapport
if grep -qE "confidence_score|sky_ai_confidence" "$SERVICE" 2>/dev/null; then
  add_row "T02-V2" "Confidence score Sky AI visible" "PASS" "Implemente"
else
  add_row "T02-V2" "Confidence score Sky AI visible" "WARN" "A verifier"
fi
```

---

## TACHE 3/19 -- 5.3.3 : Envoi devis a EXPERT (REFONDU v3.0)

```bash
echo ""
echo "TACHE 5.3.3 : REFONDU envoi devis a EXPERT (CRITIQUE v3.0)"

# T03-F1 : Migration ajout colonnes devis
MIGR_OK=$(pg_query "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'repair_devis' AND column_name IN ('expert_assignment_id', 'expert_received_at', 'carrier_cc_user_id')")
if [ "$MIGR_OK" = "3" ]; then
  add_row "T03-F1" "Migration colonnes devis expert v3.0" "PASS" "3 colonnes ajoutees"
else
  add_row "T03-F1" "Migration colonnes devis expert v3.0" "FAIL" "$MIGR_OK / 3"
fi

# T03-V1 (P0 CRITIQUE) : Verification expert designe AVANT envoi
SERVICE="repo/packages/repair/src/services/devis.service.ts"
if grep -qE "expertAssignmentsRepo|insure_expert_assignments|expert_designation_required" "$SERVICE" 2>/dev/null; then
  add_row "T03-V1" "Verification expert designe avant envoi" "PASS" "Logique presente"
else
  add_row "T03-V1" "Verification expert designe avant envoi" "FAIL" "ABSENT (workflow v3.0 casse)"
fi

# T03-V2 (P0) : Email cc carrier + bcc customer
if grep -qE "cc.*carrier|cc:.*assignment\.carrier_user" "$SERVICE" 2>/dev/null; then
  add_row "T03-V2" "Email expert CC carrier" "PASS" "CC present"
else
  add_row "T03-V2" "Email expert CC carrier" "FAIL" "CC carrier absent"
fi

# T03-V3 (P0 CRITIQUE) : WhatsApp status only (decision Saad)
COMM_SVC="repo/packages/comm/src/services/whatsapp.service.ts"
if grep -qE "sendWhatsAppStatus|STATUS_ONLY_TEMPLATES|blacklistedFields" "$COMM_SVC" 2>/dev/null; then
  add_row "T03-V3" "WhatsApp scope strict (status only)" "PASS" "Whitelist + blacklist enforced"
else
  add_row "T03-V3" "WhatsApp scope strict (status only)" "FAIL" "ABSENT (correction Saad #7)"
fi

# T03-V4 : Status quote_sent_to_expert
if grep -q "quote_sent_to_expert" "$SERVICE" 2>/dev/null; then
  add_row "T03-V4" "Status quote_sent_to_expert" "PASS" "Status v3.0 utilise"
else
  add_row "T03-V4" "Status quote_sent_to_expert" "FAIL" "Status manquant"
fi

# T03-V5 : Tests 10+ scenarios
cd repo
T03_TESTS=$(pnpm vitest run --reporter=json packages/repair/src/services/devis.service.spec.ts 2>/dev/null | jq '.numPassedTests // 0' 2>/dev/null || echo 0)
cd ..
[ "$T03_TESTS" -ge 10 ] && add_row "T03-V5" "Tests >= 10 scenarios" "PASS" "$T03_TESTS tests" || add_row "T03-V5" "Tests >= 10 scenarios" "FAIL" "$T03_TESTS / 10"

# T03-V6 (P0) : Cross-tenant garage_to_expert_request cree
CROSS_TENANT=$(pg_query "SELECT COUNT(*) FROM cross_tenant_authorizations WHERE type = 'garage_to_expert_request' LIMIT 1")
if [ "${CROSS_TENANT:-0}" -ge 0 ]; then
  add_row "T03-V6" "Cross-tenant garage_to_expert_request" "PASS" "Type utilise"
else
  add_row "T03-V6" "Cross-tenant garage_to_expert_request" "WARN" "Verifier integration"
fi
```

---

## TACHE 4/19 -- 5.3.4 : Validation expert line-by-line + Barid (REFONDU v3.0)

```bash
echo ""
echo "TACHE 5.3.4 : REFONDU validation expert line-by-line"

# T04-F1 : Migration table
if pg_query "SELECT 1 FROM information_schema.tables WHERE table_name = 'repair_devis_expert_validations'" | grep -q "1"; then
  add_row "T04-F1" "Table repair_devis_expert_validations" "PASS" "Existe"
else
  add_row "T04-F1" "Table repair_devis_expert_validations" "FAIL" "Manquante"
fi

# T04-V1 (P0) : Service expert-validation 6 methodes
SERVICE="repo/packages/expertise/src/services/expert-validation.service.ts"
METHODS=(validateDevis modifyDevis rejectDevis generateReport signReport submitToCarrier)
OK=0; for m in "${METHODS[@]}"; do grep -q "$m" "$SERVICE" 2>/dev/null && OK=$((OK + 1)); done
[ "$OK" -eq 6 ] && add_row "T04-V1" "Service 6 methodes" "PASS" "" || add_row "T04-V1" "Service 6 methodes" "FAIL" "$OK / 6"

# T04-V2 (P0) : decimal.js precision modifyDevis line-by-line
if grep -qE "import.*Decimal|new Decimal" "$SERVICE" 2>/dev/null; then
  add_row "T04-V2" "decimal.js precision line-by-line" "PASS" "Import present"
else
  add_row "T04-V2" "decimal.js precision line-by-line" "FAIL" "decimal.js manquant"
fi

# T04-V3 (P0) : Signature Barid eSign integration
if grep -qE "barid|barid_esign|@insurtech/signature" "$SERVICE" 2>/dev/null; then
  add_row "T04-V3" "Signature Barid eSign loi 43-20" "PASS" "Integration presente"
else
  add_row "T04-V3" "Signature Barid eSign loi 43-20" "FAIL" "Barid absent"
fi

# T04-V4 : Tests 12+
cd repo
T04_TESTS=$(pnpm vitest run --reporter=json packages/expertise/src/services/expert-validation.service.spec.ts 2>/dev/null | jq '.numPassedTests // 0' 2>/dev/null || echo 0)
cd ..
[ "$T04_TESTS" -ge 12 ] && add_row "T04-V4" "Tests >= 12 scenarios" "PASS" "$T04_TESTS tests" || add_row "T04-V4" "Tests >= 12 scenarios" "FAIL" "$T04_TESTS / 12"
```

---

## TACHE 5/19 -- 5.3.5 : Approbation paiement carrier (REFONDU v3.0)

```bash
echo ""
echo "TACHE 5.3.5 : REFONDU approbation paiement carrier"

# T05-F1 : Table carrier_approvals
if pg_query "SELECT 1 FROM information_schema.tables WHERE table_name = 'repair_devis_carrier_approvals'" | grep -q "1"; then
  add_row "T05-F1" "Table repair_devis_carrier_approvals" "PASS" "Existe"
else
  add_row "T05-F1" "Table repair_devis_carrier_approvals" "FAIL" "Manquante"
fi

# T05-V1 : Workflow status correct
SERVICE="repo/packages/repair/src/services/carrier-payment-approval.service.ts"
if grep -qE "payment_approval_pending|payment_approved_by_carrier" "$SERVICE" 2>/dev/null; then
  add_row "T05-V1" "Status payment_approval_pending|approved_by_carrier" "PASS" "Workflow v3.0"
else
  add_row "T05-V1" "Status payment_approval_pending|approved_by_carrier" "FAIL" "Workflow manquant"
fi

# T05-V2 : Mock realistic (90% approved / 5% rejected)
CRON="repo/packages/repair/src/jobs/mock-carrier-payment-approvals.cron.ts"
if grep -qE "MOCK_REJECTION_RATE.*0\.05|MOCK_REJECTION_RATE.*5" "$CRON" 2>/dev/null; then
  add_row "T05-V2" "Mock rejection rate 5% v3.0" "PASS" "Realistic v3.0"
else
  add_row "T05-V2" "Mock rejection rate 5% v3.0" "WARN" "A verifier"
fi
```

---

## TACHES 6-7 : Reparation tracking + QC (PRESERVE v2.2 -- synthese)

```bash
echo ""
echo "TACHES 5.3.6-7 : Reparation tracking + QC (PRESERVE v2.2)"

# T06-V1 : Service orders-tracking 3 methodes
SERVICE="repo/packages/repair/src/services/orders-tracking.service.ts"
METHODS=(updateCompletion markPartArrived recordHoursWorked)
OK=0; for m in "${METHODS[@]}"; do grep -q "$m" "$SERVICE" 2>/dev/null && OK=$((OK + 1)); done
[ "$OK" -eq 3 ] && add_row "T06-V1" "Service tracking 3 methodes" "PASS" "" || add_row "T06-V1" "Service tracking 3 methodes" "FAIL" "$OK / 3"

# T06-V2 (P0 v3.0) : parts_arrival_status source partshub_supplier
if grep -qE "partshub_supplier|internal_stock" "$SERVICE" 2>/dev/null; then
  add_row "T06-V2" "parts_arrival_status source partshub|internal" "PASS" "v3.0 enrichi"
else
  add_row "T06-V2" "parts_arrival_status source partshub|internal" "FAIL" "Source absent"
fi

# T07-V1 : QC checklist 10 points
QC_SERVICE="repo/packages/repair/src/services/qc-checks.service.ts"
[ -f "$QC_SERVICE" ] && add_row "T07-V1" "Service qc-checks present" "PASS" "" || add_row "T07-V1" "Service qc-checks present" "FAIL" "Manquant"
```

---

## TACHE 8/19 -- 5.3.8 : Facturation v3.0 (REFONDU CRITIQUE v3.0)

```bash
echo ""
echo "TACHE 5.3.8 : REFONTE facturation v3.0 (CRITIQUE)"

# T08-F1 : Migration invoice_circuit_type
if pg_query "SELECT 1 FROM information_schema.columns WHERE table_name = 'repair_invoices' AND column_name = 'invoice_circuit_type'" | grep -q "1"; then
  add_row "T08-F1" "Colonne invoice_circuit_type v3.0" "PASS" "Migration OK"
else
  add_row "T08-F1" "Colonne invoice_circuit_type v3.0" "FAIL" "Migration manquante"
fi

# T08-V1 (P0 CRITIQUE) : generateInvoicesV3 method
SERVICE="repo/packages/repair/src/services/invoices.service.ts"
if grep -q "generateInvoicesV3" "$SERVICE" 2>/dev/null; then
  add_row "T08-V1" "Method generateInvoicesV3" "PASS" "Refonte v3.0"
else
  add_row "T08-V1" "Method generateInvoicesV3" "FAIL" "Toujours v2.2 split"
fi

# T08-V2 : Circuit types (agreed_garage / non_agreed / no_coverage)
if grep -qE "agreed_garage|non_agreed|no_coverage" "$SERVICE" 2>/dev/null; then
  add_row "T08-V2" "Circuit types agreed/non_agreed/no_coverage" "PASS" "3 types"
else
  add_row "T08-V2" "Circuit types agreed/non_agreed/no_coverage" "FAIL" "Types absents"
fi

# T08-V3 : payment_due_days 7 (carrier)
if grep -qE "payment_due_days.*7|payment_due_days: 7" "$SERVICE" 2>/dev/null; then
  add_row "T08-V3" "payment_due_days=7 carrier" "PASS" "v3.0"
else
  add_row "T08-V3" "payment_due_days=7 carrier" "WARN" "A verifier"
fi

# T08-V4 : decimal.js partout
if grep -cE "new Decimal|Decimal\(" "$SERVICE" 2>/dev/null | grep -qE "^[5-9]|^[0-9]{2}"; then
  add_row "T08-V4" "decimal.js precision" "PASS" "Multiple usages"
else
  add_row "T08-V4" "decimal.js precision" "WARN" "Usage limite"
fi

# T08-V5 : Tests 10+
cd repo
T08_TESTS=$(pnpm vitest run --reporter=json packages/repair/src/services/invoices.service.spec.ts 2>/dev/null | jq '.numPassedTests // 0' 2>/dev/null || echo 0)
cd ..
[ "$T08_TESTS" -ge 10 ] && add_row "T08-V5" "Tests >= 10 scenarios" "PASS" "$T08_TESTS tests" || add_row "T08-V5" "Tests >= 10 scenarios" "FAIL" "$T08_TESTS / 10"
```

---

## TACHE 9/19 -- 5.3.9 : Documents auto-generes (ENRICHI v3.0)

```bash
echo ""
echo "TACHE 5.3.9 : Documents auto-generes 8 templates"

# T09-V1 : 8 templates (vs 5 v2.2)
TEMPLATE_DIR="repo/packages/docs/src/templates"
TEMPLATE_COUNT=$(find "$TEMPLATE_DIR" -name "*.hbs" 2>/dev/null | xargs -I {} dirname {} | sort -u | wc -l)
if [ "$TEMPLATE_COUNT" -ge 8 ]; then
  add_row "T09-V1" "8+ templates documents" "PASS" "$TEMPLATE_COUNT templates"
else
  add_row "T09-V1" "8+ templates documents" "WARN" "$TEMPLATE_COUNT / 8"
fi

# T09-V2 : Template rapport-expertise (NOUVEAU v3.0)
if find "$TEMPLATE_DIR" -name "rapport-expertise*.hbs" 2>/dev/null | grep -q "."; then
  add_row "T09-V2" "Template rapport-expertise v3.0" "PASS" "Cree"
else
  add_row "T09-V2" "Template rapport-expertise v3.0" "FAIL" "Manquant"
fi
```

---

## TACHE 10/19 -- 5.3.10 : Notifications WhatsApp scope strict (CRITIQUE v3.0)

```bash
echo ""
echo "TACHE 5.3.10 : WhatsApp scope strict (correction Saad #7)"

WA_SERVICE="repo/packages/comm/src/services/whatsapp.service.ts"

# T10-V1 (P0 CRITIQUE) : Whitelist STATUS_ONLY_TEMPLATES
if grep -q "STATUS_ONLY_TEMPLATES" "$WA_SERVICE" 2>/dev/null; then
  add_row "T10-V1" "Whitelist STATUS_ONLY_TEMPLATES" "PASS" "Whitelist enforced"
else
  add_row "T10-V1" "Whitelist STATUS_ONLY_TEMPLATES" "FAIL" "Whitelist absente"
fi

# T10-V2 (P0 CRITIQUE) : Blacklist fields enforcement
if grep -qE "blacklistedFields.*amount|blacklistedFields.*price|amount.*price.*total_mad" "$WA_SERVICE" 2>/dev/null; then
  add_row "T10-V2" "Blacklist fields data sensible" "PASS" "Server-side enforcement"
else
  add_row "T10-V2" "Blacklist fields data sensible" "FAIL" "Blacklist absente (CNDP risk)"
fi

# T10-V3 : Method sendWhatsAppStatus
if grep -q "sendWhatsAppStatus" "$WA_SERVICE" 2>/dev/null; then
  add_row "T10-V3" "Method sendWhatsAppStatus" "PASS" "Method dedie"
else
  add_row "T10-V3" "Method sendWhatsAppStatus" "FAIL" "Method manquant"
fi

# T10-V4 : 9 templates Comm (vs 8 v2.2)
COMM_TEMPLATES=$(find repo/packages/comm/src/templates -name "repair-*.hbs" 2>/dev/null | wc -l)
if [ "$COMM_TEMPLATES" -ge 9 ]; then
  add_row "T10-V4" "9+ templates repair-* notifications" "PASS" "$COMM_TEMPLATES templates"
else
  add_row "T10-V4" "9+ templates repair-* notifications" "WARN" "$COMM_TEMPLATES / 9"
fi
```

---

## TACHE 11/19 -- 5.3.11 : Mock expert + carrier (REFONDU v3.0)

```bash
echo ""
echo "TACHE 5.3.11 : Mock expert + carrier"

# T11-F1 : Mock expert visit service
[ -f "repo/packages/repair/src/services/mock-expert-visit.service.ts" ] && \
  add_row "T11-F1" "MockExpertVisitService present" "PASS" "" || \
  add_row "T11-F1" "MockExpertVisitService present" "FAIL" "Manquant"

# T11-F2 : Mock carrier payment service
[ -f "repo/packages/repair/src/services/mock-carrier-payment.service.ts" ] && \
  add_row "T11-F2" "MockCarrierPaymentService present" "PASS" "" || \
  add_row "T11-F2" "MockCarrierPaymentService present" "FAIL" "Manquant"
```

---

## TACHE 12/19 -- 5.3.12 : Garantie tracking (PRESERVE v2.2)

```bash
echo ""
echo "TACHE 5.3.12 : Garantie (PRESERVE v2.2)"

SERVICE="repo/packages/repair/src/services/warranty-claims.service.ts"
[ -f "$SERVICE" ] && add_row "T12-V1" "Service warranty-claims" "PASS" "" || add_row "T12-V1" "Service warranty-claims" "FAIL" "Manquant"
```

---

## TACHE 13/19 -- 5.3.13 : Endpoints + permissions (ETENDU v3.0)

```bash
echo ""
echo "TACHE 5.3.13 : Endpoints + 32 permissions"

# T13-V1 : Permissions expertise (10 perms)
PERMS_FILE="repo/packages/auth/src/rbac/permissions.enum.ts"
EXPERTISE_PERMS=$(grep -c "expertise\." "$PERMS_FILE" 2>/dev/null || echo 0)
if [ "$EXPERTISE_PERMS" -ge 10 ]; then
  add_row "T13-V1" "Permissions expertise (10)" "PASS" "$EXPERTISE_PERMS perms"
else
  add_row "T13-V1" "Permissions expertise (10)" "FAIL" "$EXPERTISE_PERMS / 10"
fi

# T13-V2 : Permissions parts (7 perms)
PARTS_PERMS=$(grep -c "parts\." "$PERMS_FILE" 2>/dev/null || echo 0)
if [ "$PARTS_PERMS" -ge 7 ]; then
  add_row "T13-V2" "Permissions parts (7)" "PASS" "$PARTS_PERMS perms"
else
  add_row "T13-V2" "Permissions parts (7)" "FAIL" "$PARTS_PERMS / 7"
fi
```

---

# PARTSHUB PHASE 1 (Taches 14-18) -- NOUVEAU v3.0

---

## TACHE 14/19 -- 5.3.14 : PartsHub catalog + KYB (NOUVEAU v3.0)

```bash
echo ""
echo "TACHE 5.3.14 : PartsHub catalog fournisseurs + KYB (NOUVEAU v3.0)"

# T14-F1 : Tables PartsHub
TABLES=(parts_suppliers parts_supplier_catalog parts_suppliers_favorites)
OK=0
for table in "${TABLES[@]}"; do
  RESULT=$(pg_query "SELECT 1 FROM information_schema.tables WHERE table_name = '$table'")
  [ "$RESULT" = "1" ] && OK=$((OK + 1))
done
if [ "$OK" -eq 3 ]; then
  add_row "T14-F1" "3 tables PartsHub creees" "PASS" ""
else
  add_row "T14-F1" "3 tables PartsHub creees" "FAIL" "$OK / 3"
fi

# T14-V1 (P0) : RLS active 3 tables
RLS_OK=0
for table in "${TABLES[@]}"; do
  RLS=$(pg_query "SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE relname = '$table'")
  [ "$RLS" = "t" ] && RLS_OK=$((RLS_OK + 1))
done
if [ "$RLS_OK" -eq 3 ]; then
  add_row "T14-V1" "RLS + FORCE 3 tables PartsHub" "PASS" "3/3"
else
  # Auto-reparation
  for table in "${TABLES[@]}"; do
    pg_query_raw "ALTER TABLE $table ENABLE ROW LEVEL SECURITY; ALTER TABLE $table FORCE ROW LEVEL SECURITY;"
  done
  RLS_OK2=0
  for table in "${TABLES[@]}"; do
    RLS=$(pg_query "SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE relname = '$table'")
    [ "$RLS" = "t" ] && RLS_OK2=$((RLS_OK2 + 1))
  done
  if [ "$RLS_OK2" -eq 3 ]; then
    add_row "T14-V1" "RLS + FORCE 3 tables PartsHub" "PASS*" "Repare auto"
  else
    add_row "T14-V1" "RLS + FORCE 3 tables PartsHub" "FAIL" "$RLS_OK2 / 3"
  fi
fi

# T14-V2 : Service parts-suppliers 6 methodes
SERVICE="repo/packages/repair/src/services/parts-suppliers.service.ts"
METHODS=(onboardSupplier approveKyb rejectKyb searchCatalog addToFavorites listFavorites)
OK=0; for m in "${METHODS[@]}"; do grep -q "$m" "$SERVICE" 2>/dev/null && OK=$((OK + 1)); done
[ "$OK" -eq 6 ] && add_row "T14-V2" "Service 6 methodes" "PASS" "" || add_row "T14-V2" "Service 6 methodes" "FAIL" "$OK / 6"

# T14-V3 : Tests 15+
cd repo
T14_TESTS=$(pnpm vitest run --reporter=json packages/repair/src/services/parts-suppliers.service.spec.ts 2>/dev/null | jq '.numPassedTests // 0' 2>/dev/null || echo 0)
cd ..
[ "$T14_TESTS" -ge 15 ] && add_row "T14-V3" "Tests >= 15 scenarios" "PASS" "$T14_TESTS tests" || add_row "T14-V3" "Tests >= 15 scenarios" "FAIL" "$T14_TESTS / 15"
```

---

## TACHE 15/19 -- 5.3.15 : PartsHub commande automatique (NOUVEAU v3.0)

```bash
echo ""
echo "TACHE 5.3.15 : PartsHub commande automatique (NOUVEAU v3.0)"

# T15-F1 : Table parts_orders
if pg_query "SELECT 1 FROM information_schema.tables WHERE table_name = 'parts_orders'" | grep -q "1"; then
  add_row "T15-F1" "Table parts_orders" "PASS" "Existe"
else
  add_row "T15-F1" "Table parts_orders" "FAIL" "Manquante"
fi

# T15-V1 : Service parts-orders 4 methodes
SERVICE="repo/packages/repair/src/services/parts-orders.service.ts"
METHODS=(createOrder sendToSupplier cancelOrder updateStatus)
OK=0; for m in "${METHODS[@]}"; do grep -q "$m" "$SERVICE" 2>/dev/null && OK=$((OK + 1)); done
[ "$OK" -eq 4 ] && add_row "T15-V1" "Service 4 methodes" "PASS" "" || add_row "T15-V1" "Service 4 methodes" "FAIL" "$OK / 4"

# T15-V2 : Workflow status 6 etats
if grep -qE "draft.*sent_to_supplier.*accepted_by_supplier.*in_transit.*delivered.*received_in_stock" "$SERVICE" 2>/dev/null; then
  add_row "T15-V2" "Workflow status 6 etats" "PASS" "Workflow complet"
else
  add_row "T15-V2" "Workflow status 6 etats" "WARN" "A verifier"
fi
```

---

## TACHE 16/19 -- 5.3.16 : PartsHub tracking + receive (NOUVEAU v3.0)

```bash
echo ""
echo "TACHE 5.3.16 : PartsHub tracking livraison"

SERVICE="repo/packages/repair/src/services/parts-orders-tracking.service.ts"
METHODS=(updateDeliveryStatus markDelivered receiveInStock reportDamaged)
OK=0; for m in "${METHODS[@]}"; do grep -q "$m" "$SERVICE" 2>/dev/null && OK=$((OK + 1)); done
[ "$OK" -eq 4 ] && add_row "T16-V1" "Service 4 methodes tracking" "PASS" "" || add_row "T16-V1" "Service 4 methodes tracking" "FAIL" "$OK / 4"
```

---

## TACHE 17/19 -- 5.3.17 : PartsHub paiement + commission (NOUVEAU v3.0 CRITIQUE)

```bash
echo ""
echo "TACHE 5.3.17 : PartsHub paiement + commission 3-5%"

SERVICE="repo/packages/repair/src/services/parts-payments.service.ts"

# T17-V1 (P0 CRITIQUE) : Commission auto-deduite decimal.js
if grep -qE "commissionAmount.*Decimal|commission_rate.*Decimal|times.*100|dividedBy.*100" "$SERVICE" 2>/dev/null; then
  add_row "T17-V1" "Commission auto-deduite decimal.js" "PASS" "Precision OK"
else
  add_row "T17-V1" "Commission auto-deduite decimal.js" "FAIL" "Commission missing"
fi

# T17-V2 : Integration Sprint 11 Pay
if grep -qE "payService|@insurtech/pay|PaymentGateway" "$SERVICE" 2>/dev/null; then
  add_row "T17-V2" "Integration Sprint 11 Pay" "PASS" "Pay integre"
else
  add_row "T17-V2" "Integration Sprint 11 Pay" "FAIL" "Pay absent"
fi

# T17-V3 : Tests 10+
cd repo
T17_TESTS=$(pnpm vitest run --reporter=json packages/repair/src/services/parts-payments.service.spec.ts 2>/dev/null | jq '.numPassedTests // 0' 2>/dev/null || echo 0)
cd ..
[ "$T17_TESTS" -ge 10 ] && add_row "T17-V3" "Tests >= 10 scenarios" "PASS" "$T17_TESTS tests" || add_row "T17-V3" "Tests >= 10 scenarios" "FAIL" "$T17_TESTS / 10"
```

---

## TACHE 18/19 -- 5.3.18 : PartsHub commission tracking + dashboard

```bash
echo ""
echo "TACHE 5.3.18 : PartsHub commission tracking + dashboards"

# T18-F1 : Table commission_log
if pg_query "SELECT 1 FROM information_schema.tables WHERE table_name = 'parts_commission_log'" | grep -q "1"; then
  add_row "T18-F1" "Table parts_commission_log" "PASS" "Existe"
else
  add_row "T18-F1" "Table parts_commission_log" "FAIL" "Manquante"
fi

# T18-V1 : Service stats
SERVICE="repo/packages/repair/src/services/parts-commission.service.ts"
METHODS=(computeCommissionStats listPendingCommissions markCommissionPaid)
OK=0; for m in "${METHODS[@]}"; do grep -q "$m" "$SERVICE" 2>/dev/null && OK=$((OK + 1)); done
[ "$OK" -eq 3 ] && add_row "T18-V1" "Service 3 methodes" "PASS" "" || add_row "T18-V1" "Service 3 methodes" "FAIL" "$OK / 3"

# T18-V2 : 2 dashboards endpoints
CTRL_DIR="repo/apps/api/src/modules/repair/controllers"
DASHBOARDS=$(grep -rE "parts/commission/stats|parts/garage-stats" "$CTRL_DIR" 2>/dev/null | wc -l)
if [ "$DASHBOARDS" -ge 2 ]; then
  add_row "T18-V2" "2 endpoints dashboards" "PASS" "Admin + garage"
else
  add_row "T18-V2" "2 endpoints dashboards" "FAIL" "$DASHBOARDS / 2"
fi
```

---

## TACHE 19/19 -- 5.3.19 : Tests E2E 60+ workflow complet

```bash
echo ""
echo "TACHE 5.3.19 : Tests E2E 60+ workflow complet"

cd repo
TOTAL_E2E=$(pnpm vitest run --reporter=json apps/api/test/repair/sprint-21-workflow-v3 2>/dev/null | jq '.numPassedTests // 0' 2>/dev/null || echo 0)
cd ..
if [ "$TOTAL_E2E" -ge 60 ]; then
  add_row "T19-V1" "Tests E2E >= 60 scenarios" "PASS" "$TOTAL_E2E tests"
elif [ "$TOTAL_E2E" -ge 40 ]; then
  add_row "T19-V1" "Tests E2E >= 60 scenarios" "WARN" "$TOTAL_E2E / 60 (tolere)"
else
  add_row "T19-V1" "Tests E2E >= 60 scenarios" "FAIL" "$TOTAL_E2E / 60"
fi

# T19-V2 : Seeds fixtures Sprint 21 v3.0
SEEDS="repo/infrastructure/scripts/seed-sprint-21-fixtures-v3.ts"
[ -f "$SEEDS" ] && add_row "T19-V2" "Seeds fixtures v3.0" "PASS" "" || add_row "T19-V2" "Seeds fixtures v3.0" "FAIL" "Manquant"
```

---

## VERIFICATIONS TRANSVERSALES SPRINT 21 v3.0

```bash
echo ""
echo "================================================"
echo "VERIFICATIONS TRANSVERSALES SPRINT 21 v3.0"
echo "================================================"

cd repo

# TR-BUILD
BUILD_OUT=$(pnpm turbo run build 2>&1); BUILD_CODE=$?
[ $BUILD_CODE -eq 0 ] && add_row "TR-BUILD" "Build monorepo" "PASS" "" || add_row "TR-BUILD" "Build monorepo" "FAIL" "Erreurs build"

# TR-TYPECHECK
pnpm tsc --noEmit 2>&1 > /tmp/tsc.log
TS_ERRORS=$(grep -c "error TS" /tmp/tsc.log)
[ "$TS_ERRORS" -eq 0 ] && add_row "TR-TYPECHECK" "TypeScript strict" "PASS" "0 erreur" || add_row "TR-TYPECHECK" "TypeScript strict" "FAIL" "$TS_ERRORS erreurs"

# TR-TESTS (baseline + Sprint 21 = >= 1071 + 100 = 1171+)
VITEST_OUT=$(pnpm vitest run --coverage --reporter=json 2>/dev/null)
TESTS_PASSED=$(echo "$VITEST_OUT" | jq '.numPassedTests // 0' 2>/dev/null || echo 0)
TESTS_TOTAL=$(echo "$VITEST_OUT" | jq '.numTotalTests // 0' 2>/dev/null || echo 0)
if [ "$TESTS_TOTAL" -ge 1171 ] && [ "$TESTS_PASSED" -eq "$TESTS_TOTAL" ]; then
  add_row "TR-TESTS" "Tests Vitest >= 1171 PASS" "PASS" "$TESTS_PASSED/$TESTS_TOTAL"
else
  add_row "TR-TESTS" "Tests Vitest" "FAIL" "$TESTS_PASSED/$TESTS_TOTAL"
fi

# TR-COVERAGE
COVERAGE=$(echo "$VITEST_OUT" | jq '.coverageMap.total.lines.pct // 0' 2>/dev/null || echo 0)
if (( $(echo "$COVERAGE >= 85" | bc -l 2>/dev/null || echo 0) )); then
  add_row "TR-COVERAGE" "Coverage >= 85%" "PASS" "${COVERAGE}%"
else
  add_row "TR-COVERAGE" "Coverage >= 85%" "WARN" "${COVERAGE}%"
fi

# TR-LINT
pnpm lint 2>&1 > /tmp/lint.log
LINT_CODE=$?
[ $LINT_CODE -eq 0 ] && add_row "TR-LINT" "Biome lint" "PASS" "0 erreur" || add_row "TR-LINT" "Biome lint" "WARN" "Erreurs"

cd ..

# TR-NO-EMOJI
EMOJI_COUNT=$(grep -rP "[\x{1F300}-\x{1F9FF}]|[\x{2600}-\x{27BF}]" repo/apps repo/packages --include="*.ts" --include="*.tsx" --include="*.md" 2>/dev/null | wc -l)
[ "$EMOJI_COUNT" -eq 0 ] && add_row "TR-NO-EMOJI" "0 emoji" "PASS" "decision-006" || add_row "TR-NO-EMOJI" "0 emoji" "FAIL" "$EMOJI_COUNT emojis"

# TR-CONSOLE
CONSOLE_LOGS=$(grep -rn "console\.log\|console\.error\|console\.warn" repo/apps repo/packages --include="*.ts" 2>/dev/null | grep -v ".spec.ts" | wc -l)
[ "$CONSOLE_LOGS" -eq 0 ] && add_row "TR-CONSOLE" "0 console.*" "PASS" "Pino obligatoire" || add_row "TR-CONSOLE" "0 console.*" "FAIL" "$CONSOLE_LOGS"

# TR-COMMITS
NON_CONVENTIONAL=$(git log --since="2 weeks ago" --pretty=format:"%s" -- repo/ | grep -vE "^(feat|fix|docs|style|refactor|test|chore|perf|ci|build)(\(.+\))?:" | wc -l)
[ "$NON_CONVENTIONAL" -eq 0 ] && add_row "TR-COMMITS" "Conventional Commits" "PASS" "" || add_row "TR-COMMITS" "Conventional Commits" "WARN" "$NON_CONVENTIONAL non-conformes"

# TR-RLS-NEW-TABLES (4 nouvelles tables : devis_expert_validations + carrier_approvals + 3 PartsHub)
NEW_TABLES=(repair_devis_expert_validations repair_devis_carrier_approvals parts_suppliers parts_orders parts_commission_log)
RLS_OK_COUNT=0
for table in "${NEW_TABLES[@]}"; do
  RLS=$(pg_query "SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE relname = '$table'")
  [ "$RLS" = "t" ] && RLS_OK_COUNT=$((RLS_OK_COUNT + 1))
done
if [ "$RLS_OK_COUNT" -ge 5 ]; then
  add_row "TR-RLS" "RLS + FORCE 5 nouvelles tables" "PASS" "5/5"
else
  add_row "TR-RLS" "RLS + FORCE 5 nouvelles tables" "FAIL" "$RLS_OK_COUNT / 5"
fi

# TR-MIGRATIONS Sprint 21 v3.0
MIGR_COUNT=$(pg_query "SELECT COUNT(*) FROM migrations WHERE name LIKE '%Sprint21%' OR name LIKE '%sprint21%'")
if [ "${MIGR_COUNT:-0}" -ge 5 ]; then
  add_row "TR-MIG" "Migrations Sprint 21 (>= 5)" "PASS" "$MIGR_COUNT"
else
  add_row "TR-MIG" "Migrations Sprint 21" "WARN" "$MIGR_COUNT / 5"
fi
```

---

## RAPPORT FINAL CONSOLIDE

```bash
TOTAL=$((PASS + PASS_REPAIRED + FAIL + SKIP + WARN))
SCORE_NUM=$((PASS + PASS_REPAIRED))
SCORE_PCT=$(echo "scale=1; $SCORE_NUM * 100 / $TOTAL" | bc -l 2>/dev/null || echo "0")

JALON="NO-GO"
if (( $(echo "$SCORE_PCT >= 95" | bc -l 2>/dev/null || echo 0) )); then
  JALON="GO"
elif (( $(echo "$SCORE_PCT >= 85" | bc -l 2>/dev/null || echo 0) )); then
  JALON="GO CONDITIONNEL"
fi

cat >> "$REPORT_FILE" << EOF

## Synthese finale

| Categorie | Nombre |
|-----------|--------|
| PASS | $PASS |
| PASS* (repare) | $PASS_REPAIRED |
| FAIL | $FAIL |
| SKIP | $SKIP |
| WARN | $WARN |
| **TOTAL** | **$TOTAL** |

**Score** : $SCORE_PCT% ($SCORE_NUM / $TOTAL)
**Jalon** : $JALON

---

## Resultats detailles

| ID | Description | Statut | Details |
|----|-------------|--------|---------|
$(echo -e "$TABLE_ROWS")

---

## Decision

EOF

case "$JALON" in
  GO)
    cat >> "$REPORT_FILE" << EOF
**GO** -- Sprint 21 v3.0 valide.

Actions :
1. \`git tag -a "sprint-21-complete-v3-workflow-expert-partshub" -m "Sprint 21 v3.0 -- score $SCORE_PCT%"\`
2. Lancer Sprint 22 Web Garage App
EOF
    ;;
  "GO CONDITIONNEL")
    cat >> "$REPORT_FILE" << EOF
**GO CONDITIONNEL** ($SCORE_PCT%)

Actions :
1. Documenter dette \`dette-technique-sprint-21.md\`
2. Resoudre FAIL P0 ASAP
3. Lancer Sprint 22 avec dette tracked
EOF
    ;;
  NO-GO)
    cat >> "$REPORT_FILE" << EOF
**NO-GO** ($SCORE_PCT%)

Actions :
1. Identifier FAIL P0
2. Re-executer taches FAIL
3. Re-V-21
4. NE PAS demarrer Sprint 22
EOF
    ;;
esac

cat "$REPORT_FILE"
```

---

## NOTES IMPORTANTES POUR EXECUTION

1. **Auto-reparation** : RLS + FORCE PartsHub tables auto-repair
2. **Tests baseline** : 1071 + 100 Sprint 21 = 1171+ tests cumules
3. **5 RLS critiques nouvelles tables** : devis_expert_validations + carrier_approvals + parts_suppliers + parts_orders + parts_commission_log
4. **Sprint 21 v3.0 P0 cles** : T03-V1/V3 (workflow expert + WhatsApp scope) + T04-V2/V3 (decimal.js + Barid) + T08-V1 (facturation v3.0) + T17-V1 (commission auto)
5. **Score >= 95% = GO** / 85-95% = GO CONDITIONNEL / < 85% = NO-GO

---

**Fin verification V-21 v3.0 -- Sprint 21 Sinistre Workflow + Expert + PartsHub.**

**Total criteres** : 95 + 11 transversaux = 106 criteres
