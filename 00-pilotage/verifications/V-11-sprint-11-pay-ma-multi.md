# VERIFICATION SPRINT 11 -- Phase 3 / Sprint 4 : Pay Multi-Passerelles MA (6 gateways)
# Version : Auto-reparation active + Rapport final MD detaille
# 14 taches, 75 criteres extraits B-11
# AUCUNE EMOJI AUTORISEE

**Version** : v2.2 (verification detaillee)
**Phase** : 3 -- Modules Horizontaux
**Sprint** : 11 / 35 (cumul) -- Sprint 4 dans Phase 3
**Reference meta-prompt** : `B-11-sprint-11-pay-ma-multi.md`
**Reference orchestrateur** : `C-11-sprint-11-pay-ma-multi.md`
**Total criteres** : 75 criteres taches + ~10 transversaux

---

Tu es **Claude Code (ou Cowork)**. Tu dois executer une **verification COMPLETE et EXHAUSTIVE** du Sprint 11 apres execution toutes les 14 taches.

---

## REGLES D'EXECUTION

1. Tu **executes CHAQUE verification dans l'ordre** (taches puis transversales)
2. Quand une verification echoue, tu **TENTES UNE REPARATION AUTOMATIQUE** avant de noter FAIL
3. Apres chaque tentative de reparation, tu **re-executes la verification**
4. Tu consignes dans `sprint11-verify-report.md` **TOUS les resultats** au fil de l'execution
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
REPORT_FILE="sprint11-verify-report.md"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
RUN_ID=$(date '+%Y%m%d-%H%M%S')

cat > "$REPORT_FILE" << EOF
# Rapport de Verification - Sprint 11 : Pay Multi-Passerelles MA (6 gateways)

**Date** : $TIMESTAMP
**Run ID** : $RUN_ID
**Phase** : 3 -- Modules Horizontaux
**Sprint** : 11 (Phase 3 / Sprint 4)
**Reference B-11** : 14 taches, 75 criteres extraits
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

## TACHE 1/6 -- 3.4.1 : Entities pay_methods + pay_transactions + pay_reconciliation

```bash
echo ""
echo "================================================"
echo "TACHE 3.4.1 : Entities pay_methods + pay_transactions + pay_reconciliation"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 6"
echo "================================================"

# === Verification fichiers crees ===
# Test T01-F1: Existence fichier repo/packages/pay/src/entities/pay-method.entity.ts
if [ -f "repo/packages/pay/src/entities/pay-method.entity.ts" ]; then
  add_row "T01-F1" "Fichier pay-method.entity.ts existe" "PASS" "Cree"
else
  add_row "T01-F1" "Fichier pay-method.entity.ts existe" "FAIL" "Manquant"
fi
# Test T01-F2: Existence fichier repo/packages/pay/src/entities/pay-transaction.entity.ts
if [ -f "repo/packages/pay/src/entities/pay-transaction.entity.ts" ]; then
  add_row "T01-F2" "Fichier pay-transaction.entity.ts existe" "PASS" "Cree"
else
  add_row "T01-F2" "Fichier pay-transaction.entity.ts existe" "FAIL" "Manquant"
fi
# Test T01-F3: Existence fichier repo/packages/pay/src/entities/pay-reconciliation.entity.ts
if [ -f "repo/packages/pay/src/entities/pay-reconciliation.entity.ts" ]; then
  add_row "T01-F3" "Fichier pay-reconciliation.entity.ts existe" "PASS" "Cree"
else
  add_row "T01-F3" "Fichier pay-reconciliation.entity.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T01-V1: Entities hydrate (P0)
echo "  Verifying T01-V1 : Entities hydrate..."
add_row "T01-V1" "Entities hydrate" "WARN" "(P0) Voir B-11 Tache 3.4.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V2: Amount > 100000 MAD rejete (BAM rule) (P0)
echo "  Verifying T01-V2 : Amount > 100000 MAD rejete (BAM rule)..."
add_row "T01-V2" "Amount > 100000 MAD rejete (BAM rule)" "WARN" "(P0) Voir B-11 Tache 3.4.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V3: Currency != MAD rejete (P0)
echo "  Verifying T01-V3 : Currency != MAD rejete..."
add_row "T01-V3" "Currency != MAD rejete" "WARN" "(P0) Voir B-11 Tache 3.4.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V4: Idempotency key UNIQUE (P0)
echo "  Verifying T01-V4 : Idempotency key UNIQUE..."
add_row "T01-V4" "Idempotency key UNIQUE" "WARN" "(P0) Voir B-11 Tache 3.4.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V5: Schemas Zod tests reject invalid (P0)
echo "  Verifying T01-V5 : Schemas Zod tests reject invalid..."
add_row "T01-V5" "Schemas Zod tests reject invalid" "WARN" "(P0) Voir B-11 Tache 3.4.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V6: Tests 6+ scenarios (P1)
echo "  Verifying T01-V6 : Tests 6+ scenarios..."
add_row "T01-V6" "Tests 6+ scenarios" "WARN" "(P1) Voir B-11 Tache 3.4.1 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 2/5 -- 3.4.2 : PaymentGatewayInterface + Base Abstract Gateway

```bash
echo ""
echo "================================================"
echo "TACHE 3.4.2 : PaymentGatewayInterface + Base Abstract Gateway"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T02-F1: Existence fichier repo/packages/pay/src/interfaces/payment-gateway.interface.ts
if [ -f "repo/packages/pay/src/interfaces/payment-gateway.interface.ts" ]; then
  add_row "T02-F1" "Fichier payment-gateway.interface.ts existe" "PASS" "Cree"
else
  add_row "T02-F1" "Fichier payment-gateway.interface.ts existe" "FAIL" "Manquant"
fi
# Test T02-F2: Existence fichier repo/packages/pay/src/gateways/base-gateway.ts
if [ -f "repo/packages/pay/src/gateways/base-gateway.ts" ]; then
  add_row "T02-F2" "Fichier base-gateway.ts existe" "PASS" "Cree"
else
  add_row "T02-F2" "Fichier base-gateway.ts existe" "FAIL" "Manquant"
fi
# Test T02-F3: Existence fichier repo/packages/pay/src/types/gateway-results.ts
if [ -f "repo/packages/pay/src/types/gateway-results.ts" ]; then
  add_row "T02-F3" "Fichier gateway-results.ts existe" "PASS" "Cree"
else
  add_row "T02-F3" "Fichier gateway-results.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T02-V1: Interface declare 6+ methods (P0)
echo "  Verifying T02-V1 : Interface declare 6+ methods..."
add_row "T02-V1" "Interface declare 6+ methods" "WARN" "(P0) Voir B-11 Tache 3.4.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V2: Base class HTTP retry sur 5xx (P0)
echo "  Verifying T02-V2 : Base class HTTP retry sur 5xx..."
add_row "T02-V2" "Base class HTTP retry sur 5xx" "WARN" "(P0) Voir B-11 Tache 3.4.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V3: Errors typed correctement (P0)
echo "  Verifying T02-V3 : Errors typed correctement..."
add_row "T02-V3" "Errors typed correctement" "WARN" "(P0) Voir B-11 Tache 3.4.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V4: Compile TypeScript strict (P0)
echo "  Verifying T02-V4 : Compile TypeScript strict..."
add_row "T02-V4" "Compile TypeScript strict" "WARN" "(P0) Voir B-11 Tache 3.4.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V5: Tests base class 4+ scenarios (P1)
echo "  Verifying T02-V5 : Tests base class 4+ scenarios..."
add_row "T02-V5" "Tests base class 4+ scenarios" "WARN" "(P1) Voir B-11 Tache 3.4.2 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 3/7 -- 3.4.3 : CMI Gateway (Cards EMV + 3DS)

```bash
echo ""
echo "================================================"
echo "TACHE 3.4.3 : CMI Gateway (Cards EMV + 3DS)"
echo "Priorite : P0 | Effort : 7h"
echo "Criteres a verifier : 7"
echo "================================================"

# === Verification fichiers crees ===
# Test T03-F1: Existence fichier repo/packages/pay/src/gateways/cmi/cmi.gateway.ts
if [ -f "repo/packages/pay/src/gateways/cmi/cmi.gateway.ts" ]; then
  add_row "T03-F1" "Fichier cmi.gateway.ts existe" "PASS" "Cree"
else
  add_row "T03-F1" "Fichier cmi.gateway.ts existe" "FAIL" "Manquant"
fi
# Test T03-F2: Existence fichier repo/packages/pay/src/gateways/cmi/cmi.gateway.spec.ts
if [ -f "repo/packages/pay/src/gateways/cmi/cmi.gateway.spec.ts" ]; then
  add_row "T03-F2" "Fichier cmi.gateway.spec.ts existe" "PASS" "Cree"
else
  add_row "T03-F2" "Fichier cmi.gateway.spec.ts existe" "FAIL" "Manquant"
fi
# Test T03-F3: Existence fichier repo/packages/pay/src/gateways/cmi/cmi-types.ts
if [ -f "repo/packages/pay/src/gateways/cmi/cmi-types.ts" ]; then
  add_row "T03-F3" "Fichier cmi-types.ts existe" "PASS" "Cree"
else
  add_row "T03-F3" "Fichier cmi-types.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T03-V1: initiate retourne formData + hash (P0)
echo "  Verifying T03-V1 : initiate retourne formData + hash..."
add_row "T03-V1" "initiate retourne formData + hash" "WARN" "(P0) Voir B-11 Tache 3.4.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V2: Hash SHA-512 correctement calcule (P0)
echo "  Verifying T03-V2 : Hash SHA-512 correctement calcule..."
add_row "T03-V2" "Hash SHA-512 correctement calcule" "WARN" "(P0) Voir B-11 Tache 3.4.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V3: 3DS enabled (storetype 3D_PAY_HOSTING) (P0)
echo "  Verifying T03-V3 : 3DS enabled (storetype 3D_PAY_HOSTING)..."
add_row "T03-V3" "3DS enabled (storetype 3D_PAY_HOSTING)" "WARN" "(P0) Voir B-11 Tache 3.4.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V4: Currency 504 (MAD) (P0)
echo "  Verifying T03-V4 : Currency 504 (MAD)..."
add_row "T03-V4" "Currency 504 (MAD)" "WARN" "(P0) Voir B-11 Tache 3.4.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V5: webhook signature verification (P0)
echo "  Verifying T03-V5 : webhook signature verification..."
add_row "T03-V5" "webhook signature verification" "WARN" "(P0) Voir B-11 Tache 3.4.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V6: Tests 12+ scenarios mock (P0)
echo "  Verifying T03-V6 : Tests 12+ scenarios mock..."
add_row "T03-V6" "Tests 12+ scenarios mock" "WARN" "(P0) Voir B-11 Tache 3.4.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V7: Card data NEVER in our scope (verifie via tests) (P0)
echo "  Verifying T03-V7 : Card data NEVER in our scope (verifie via tests)..."
add_row "T03-V7" "Card data NEVER in our scope (verifie via tests)" "WARN" "(P0) Voir B-11 Tache 3.4.3 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 4/5 -- 3.4.4 : YouCan Pay Gateway (Cards Alternative)

```bash
echo ""
echo "================================================"
echo "TACHE 3.4.4 : YouCan Pay Gateway (Cards Alternative)"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T04-F1: Existence fichier repo/packages/pay/src/gateways/youcan-pay/youcan-pay.gateway.ts
if [ -f "repo/packages/pay/src/gateways/youcan-pay/youcan-pay.gateway.ts" ]; then
  add_row "T04-F1" "Fichier youcan-pay.gateway.ts existe" "PASS" "Cree"
else
  add_row "T04-F1" "Fichier youcan-pay.gateway.ts existe" "FAIL" "Manquant"
fi
# Test T04-F2: Existence fichier repo/packages/pay/src/gateways/youcan-pay/youcan-pay.gateway.spec.ts
if [ -f "repo/packages/pay/src/gateways/youcan-pay/youcan-pay.gateway.spec.ts" ]; then
  add_row "T04-F2" "Fichier youcan-pay.gateway.spec.ts existe" "PASS" "Cree"
else
  add_row "T04-F2" "Fichier youcan-pay.gateway.spec.ts existe" "FAIL" "Manquant"
fi
# Test T04-F3: Existence fichier repo/packages/pay/src/gateways/youcan-pay/mock-youcan-pay.gateway.ts
if [ -f "repo/packages/pay/src/gateways/youcan-pay/mock-youcan-pay.gateway.ts" ]; then
  add_row "T04-F3" "Fichier mock-youcan-pay.gateway.ts existe" "PASS" "Cree"
else
  add_row "T04-F3" "Fichier mock-youcan-pay.gateway.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T04-V1: initiate retourne payment_url (P0)
echo "  Verifying T04-V1 : initiate retourne payment_url..."
add_row "T04-V1" "initiate retourne payment_url" "WARN" "(P0) Voir B-11 Tache 3.4.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V2: getStatus retourne PaymentStatus normalise (P0)
echo "  Verifying T04-V2 : getStatus retourne PaymentStatus normalise..."
add_row "T04-V2" "getStatus retourne PaymentStatus normalise" "WARN" "(P0) Voir B-11 Tache 3.4.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V3: Webhook signature HMAC-SHA256 verifiee (P0)
echo "  Verifying T04-V3 : Webhook signature HMAC-SHA256 verifiee..."
add_row "T04-V3" "Webhook signature HMAC-SHA256 verifiee" "WARN" "(P0) Voir B-11 Tache 3.4.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V4: Refund partial + full (P0)
echo "  Verifying T04-V4 : Refund partial + full..."
add_row "T04-V4" "Refund partial + full" "WARN" "(P0) Voir B-11 Tache 3.4.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V5: Tests 8+ scenarios (P0)
echo "  Verifying T04-V5 : Tests 8+ scenarios..."
add_row "T04-V5" "Tests 8+ scenarios" "WARN" "(P0) Voir B-11 Tache 3.4.4 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 5/5 -- 3.4.5 : PayZone Gateway (Cards + Cash Kiosques)

```bash
echo ""
echo "================================================"
echo "TACHE 3.4.5 : PayZone Gateway (Cards + Cash Kiosques)"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T05-F1: Existence fichier repo/packages/pay/src/gateways/payzone/payzone.gateway.ts
if [ -f "repo/packages/pay/src/gateways/payzone/payzone.gateway.ts" ]; then
  add_row "T05-F1" "Fichier payzone.gateway.ts existe" "PASS" "Cree"
else
  add_row "T05-F1" "Fichier payzone.gateway.ts existe" "FAIL" "Manquant"
fi
# Test T05-F2: Existence fichier repo/packages/pay/src/gateways/payzone/voucher-renderer.ts
if [ -f "repo/packages/pay/src/gateways/payzone/voucher-renderer.ts" ]; then
  add_row "T05-F2" "Fichier voucher-renderer.ts existe" "PASS" "Cree"
else
  add_row "T05-F2" "Fichier voucher-renderer.ts existe" "FAIL" "Manquant"
fi
# Test T05-F3: Existence fichier repo/packages/pay/src/gateways/payzone/payzone.gateway.spec.ts
if [ -f "repo/packages/pay/src/gateways/payzone/payzone.gateway.spec.ts" ]; then
  add_row "T05-F3" "Fichier payzone.gateway.spec.ts existe" "PASS" "Cree"
else
  add_row "T05-F3" "Fichier payzone.gateway.spec.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T05-V1: initiate cash retourne voucher PDF + barcode (P0)
echo "  Verifying T05-V1 : initiate cash retourne voucher PDF + barcode..."
add_row "T05-V1" "initiate cash retourne voucher PDF + barcode" "WARN" "(P0) Voir B-11 Tache 3.4.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V2: initiate cards retourne payment_url (P0)
echo "  Verifying T05-V2 : initiate cards retourne payment_url..."
add_row "T05-V2" "initiate cards retourne payment_url" "WARN" "(P0) Voir B-11 Tache 3.4.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V3: Voucher TTL 7 jours (P0)
echo "  Verifying T05-V3 : Voucher TTL 7 jours..."
add_row "T05-V3" "Voucher TTL 7 jours" "WARN" "(P0) Voir B-11 Tache 3.4.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V4: Webhook kiosque scan update status (P0)
echo "  Verifying T05-V4 : Webhook kiosque scan update status..."
add_row "T05-V4" "Webhook kiosque scan update status" "WARN" "(P0) Voir B-11 Tache 3.4.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V5: Tests 10+ scenarios (P0)
echo "  Verifying T05-V5 : Tests 10+ scenarios..."
add_row "T05-V5" "Tests 10+ scenarios" "WARN" "(P0) Voir B-11 Tache 3.4.5 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 6/4 -- 3.4.6 : Mobile Wallets : Inwi Money + Orange Money + M-Wallet BAM

```bash
echo ""
echo "================================================"
echo "TACHE 3.4.6 : Mobile Wallets : Inwi Money + Orange Money + M-Wallet BAM"
echo "Priorite : P0 | Effort : 7h"
echo "Criteres a verifier : 4"
echo "================================================"

# === Verification fichiers crees ===
# Test T06-F1: Existence fichier repo/packages/pay/src/gateways/inwi-money/inwi-money.gateway.ts
if [ -f "repo/packages/pay/src/gateways/inwi-money/inwi-money.gateway.ts" ]; then
  add_row "T06-F1" "Fichier inwi-money.gateway.ts existe" "PASS" "Cree"
else
  add_row "T06-F1" "Fichier inwi-money.gateway.ts existe" "FAIL" "Manquant"
fi
# Test T06-F2: Existence fichier repo/packages/pay/src/gateways/orange-money/orange-money.gateway.ts
if [ -f "repo/packages/pay/src/gateways/orange-money/orange-money.gateway.ts" ]; then
  add_row "T06-F2" "Fichier orange-money.gateway.ts existe" "PASS" "Cree"
else
  add_row "T06-F2" "Fichier orange-money.gateway.ts existe" "FAIL" "Manquant"
fi
# Test T06-F3: Existence fichier repo/packages/pay/src/gateways/mwallet-bam/mwallet-bam.gateway.ts
if [ -f "repo/packages/pay/src/gateways/mwallet-bam/mwallet-bam.gateway.ts" ]; then
  add_row "T06-F3" "Fichier mwallet-bam.gateway.ts existe" "PASS" "Cree"
else
  add_row "T06-F3" "Fichier mwallet-bam.gateway.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T06-V1: 3 gateways implementent interface (P0)
echo "  Verifying T06-V1 : 3 gateways implementent interface..."
add_row "T06-V1" "3 gateways implementent interface" "WARN" "(P0) Voir B-11 Tache 3.4.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V2: QR code + USSD genere (P0)
echo "  Verifying T06-V2 : QR code + USSD genere..."
add_row "T06-V2" "QR code + USSD genere" "WARN" "(P0) Voir B-11 Tache 3.4.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V3: Polling status fonctionne (P0)
echo "  Verifying T06-V3 : Polling status fonctionne..."
add_row "T06-V3" "Polling status fonctionne" "WARN" "(P0) Voir B-11 Tache 3.4.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V4: Tests per wallet 5+ scenarios (P0)
echo "  Verifying T06-V4 : Tests per wallet 5+ scenarios..."
add_row "T06-V4" "Tests per wallet 5+ scenarios" "WARN" "(P0) Voir B-11 Tache 3.4.6 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 7/6 -- 3.4.7 : PaymentOrchestrator + GatewaySelector

```bash
echo ""
echo "================================================"
echo "TACHE 3.4.7 : PaymentOrchestrator + GatewaySelector"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 6"
echo "================================================"

# === Verification fichiers crees ===
# Test T07-F1: Existence fichier repo/packages/pay/src/services/payment-orchestrator.service.ts
if [ -f "repo/packages/pay/src/services/payment-orchestrator.service.ts" ]; then
  add_row "T07-F1" "Fichier payment-orchestrator.service.ts existe" "PASS" "Cree"
else
  add_row "T07-F1" "Fichier payment-orchestrator.service.ts existe" "FAIL" "Manquant"
fi
# Test T07-F2: Existence fichier repo/packages/pay/src/services/gateway-selector.service.ts
if [ -f "repo/packages/pay/src/services/gateway-selector.service.ts" ]; then
  add_row "T07-F2" "Fichier gateway-selector.service.ts existe" "PASS" "Cree"
else
  add_row "T07-F2" "Fichier gateway-selector.service.ts existe" "FAIL" "Manquant"
fi
# Test T07-F3: Existence fichier repo/packages/pay/src/services/gateway-registry.service.ts
if [ -f "repo/packages/pay/src/services/gateway-registry.service.ts" ]; then
  add_row "T07-F3" "Fichier gateway-registry.service.ts existe" "PASS" "Cree"
else
  add_row "T07-F3" "Fichier gateway-registry.service.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T07-V1: Provider preferred utilise si dispo (P0)
echo "  Verifying T07-V1 : Provider preferred utilise si dispo..."
add_row "T07-V1" "Provider preferred utilise si dispo" "WARN" "(P0) Voir B-11 Tache 3.4.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V2: Fallback sur next si premier unavailable (P0)
echo "  Verifying T07-V2 : Fallback sur next si premier unavailable..."
add_row "T07-V2" "Fallback sur next si premier unavailable" "WARN" "(P0) Voir B-11 Tache 3.4.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V3: All gateways down -> 503 (P0)
echo "  Verifying T07-V3 : All gateways down -> 503..."
add_row "T07-V3" "All gateways down -> 503" "WARN" "(P0) Voir B-11 Tache 3.4.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V4: Idempotency : meme key retourne meme transactionId (P0)
echo "  Verifying T07-V4 : Idempotency : meme key retourne meme transactionId..."
add_row "T07-V4" "Idempotency : meme key retourne meme transactionId" "WARN" "(P0) Voir B-11 Tache 3.4.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V5: Audit + Kafka events (P0)
echo "  Verifying T07-V5 : Audit + Kafka events..."
add_row "T07-V5" "Audit + Kafka events" "WARN" "(P0) Voir B-11 Tache 3.4.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V6: Tests routing 12+ scenarios (P0)
echo "  Verifying T07-V6 : Tests routing 12+ scenarios..."
add_row "T07-V6" "Tests routing 12+ scenarios" "WARN" "(P0) Voir B-11 Tache 3.4.7 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 8/6 -- 3.4.8 : Webhooks Receivers (6 Providers) + Signature Verification

```bash
echo ""
echo "================================================"
echo "TACHE 3.4.8 : Webhooks Receivers (6 Providers) + Signature Verification"
echo "Priorite : P0 | Effort : 7h"
echo "Criteres a verifier : 6"
echo "================================================"

# === Verification fichiers crees ===
# Test T08-F1: Existence fichier repo/apps/api/src/modules/pay/webhooks/{6 controllers}.ts
if [ -f "repo/apps/api/src/modules/pay/webhooks/{6 controllers}.ts" ]; then
  add_row "T08-F1" "Fichier {6 controllers}.ts existe" "PASS" "Cree"
else
  add_row "T08-F1" "Fichier {6 controllers}.ts existe" "FAIL" "Manquant"
fi
# Test T08-F2: Existence fichier repo/apps/api/src/modules/pay/middleware/{6 signatures}.ts
if [ -f "repo/apps/api/src/modules/pay/middleware/{6 signatures}.ts" ]; then
  add_row "T08-F2" "Fichier {6 signatures}.ts existe" "PASS" "Cree"
else
  add_row "T08-F2" "Fichier {6 signatures}.ts existe" "FAIL" "Manquant"
fi
# Test T08-F3: Existence fichier repo/apps/api/src/modules/pay/consumers/pay-webhook-processor.consumer.ts
if [ -f "repo/apps/api/src/modules/pay/consumers/pay-webhook-processor.consumer.ts" ]; then
  add_row "T08-F3" "Fichier pay-webhook-processor.consumer.ts existe" "PASS" "Cree"
else
  add_row "T08-F3" "Fichier pay-webhook-processor.consumer.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T08-V1: 6 webhooks endpoints fonctionnent (P0)
echo "  Verifying T08-V1 : 6 webhooks endpoints fonctionnent..."
add_row "T08-V1" "6 webhooks endpoints fonctionnent" "WARN" "(P0) Voir B-11 Tache 3.4.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V2: Signatures verifiees per provider (P0)
echo "  Verifying T08-V2 : Signatures verifiees per provider..."
add_row "T08-V2" "Signatures verifiees per provider" "WARN" "(P0) Voir B-11 Tache 3.4.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V3: Idempotency : duplicate webhook ignore (P0)
echo "  Verifying T08-V3 : Idempotency : duplicate webhook ignore..."
add_row "T08-V3" "Idempotency : duplicate webhook ignore" "WARN" "(P0) Voir B-11 Tache 3.4.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V4: Captured -> facture PDF genere + email (P0)
echo "  Verifying T08-V4 : Captured -> facture PDF genere + email..."
add_row "T08-V4" "Captured -> facture PDF genere + email" "WARN" "(P0) Voir B-11 Tache 3.4.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V5: Failed -> notification user (P0)
echo "  Verifying T08-V5 : Failed -> notification user..."
add_row "T08-V5" "Failed -> notification user" "WARN" "(P0) Voir B-11 Tache 3.4.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V6: Tests E2E 12+ scenarios (P0)
echo "  Verifying T08-V6 : Tests E2E 12+ scenarios..."
add_row "T08-V6" "Tests E2E 12+ scenarios" "WARN" "(P0) Voir B-11 Tache 3.4.8 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 9/7 -- 3.4.9 : Refund Service (Partial + Full) avec Workflow Approval

```bash
echo ""
echo "================================================"
echo "TACHE 3.4.9 : Refund Service (Partial + Full) avec Workflow Approval"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 7"
echo "================================================"

# === Verification fichiers crees ===
# Test T09-F1: Existence fichier repo/packages/pay/src/services/refund.service.ts
if [ -f "repo/packages/pay/src/services/refund.service.ts" ]; then
  add_row "T09-F1" "Fichier refund.service.ts existe" "PASS" "Cree"
else
  add_row "T09-F1" "Fichier refund.service.ts existe" "FAIL" "Manquant"
fi
# Test T09-F2: Existence fichier repo/packages/database/src/migrations/{date}-PayRefundRequests.ts
if [ -f "repo/packages/database/src/migrations/{date}-PayRefundRequests.ts" ]; then
  add_row "T09-F2" "Fichier {date}-PayRefundRequests.ts existe" "PASS" "Cree"
else
  add_row "T09-F2" "Fichier {date}-PayRefundRequests.ts existe" "FAIL" "Manquant"
fi
# Test T09-F3: Existence fichier repo/packages/pay/src/entities/pay-refund-request.entity.ts
if [ -f "repo/packages/pay/src/entities/pay-refund-request.entity.ts" ]; then
  add_row "T09-F3" "Fichier pay-refund-request.entity.ts existe" "PASS" "Cree"
else
  add_row "T09-F3" "Fichier pay-refund-request.entity.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T09-V1: Request refund cree pending row (P0)
echo "  Verifying T09-V1 : Request refund cree pending row..."
add_row "T09-V1" "Request refund cree pending row" "WARN" "(P0) Voir B-11 Tache 3.4.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V2: Auto-approve <= 1000 MAD (P0)
echo "  Verifying T09-V2 : Auto-approve <= 1000 MAD..."
add_row "T09-V2" "Auto-approve <= 1000 MAD" "WARN" "(P0) Voir B-11 Tache 3.4.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V3: > 1000 MAD require approval admin (P0)
echo "  Verifying T09-V3 : > 1000 MAD require approval admin..."
add_row "T09-V3" "> 1000 MAD require approval admin" "WARN" "(P0) Voir B-11 Tache 3.4.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V4: Approval execute provider refund + update txn (P0)
echo "  Verifying T09-V4 : Approval execute provider refund + update txn..."
add_row "T09-V4" "Approval execute provider refund + update txn" "WARN" "(P0) Voir B-11 Tache 3.4.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V5: Refund > 90 jours rejete (ABAC) (P0)
echo "  Verifying T09-V5 : Refund > 90 jours rejete (ABAC)..."
add_row "T09-V5" "Refund > 90 jours rejete (ABAC)" "WARN" "(P0) Voir B-11 Tache 3.4.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V6: Notification user (P0)
echo "  Verifying T09-V6 : Notification user..."
add_row "T09-V6" "Notification user" "WARN" "(P0) Voir B-11 Tache 3.4.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V7: Tests 10+ scenarios (P0)
echo "  Verifying T09-V7 : Tests 10+ scenarios..."
add_row "T09-V7" "Tests 10+ scenarios" "WARN" "(P0) Voir B-11 Tache 3.4.9 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 10/5 -- 3.4.10 : Reconciliation Service (CSV Bank + Auto-Match)

```bash
echo ""
echo "================================================"
echo "TACHE 3.4.10 : Reconciliation Service (CSV Bank + Auto-Match)"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T10-F1: Existence fichier repo/packages/pay/src/services/reconciliation.service.ts
if [ -f "repo/packages/pay/src/services/reconciliation.service.ts" ]; then
  add_row "T10-F1" "Fichier reconciliation.service.ts existe" "PASS" "Cree"
else
  add_row "T10-F1" "Fichier reconciliation.service.ts existe" "FAIL" "Manquant"
fi
# Test T10-F2: Existence fichier repo/packages/pay/src/services/csv-parser.service.ts
if [ -f "repo/packages/pay/src/services/csv-parser.service.ts" ]; then
  add_row "T10-F2" "Fichier csv-parser.service.ts existe" "PASS" "Cree"
else
  add_row "T10-F2" "Fichier csv-parser.service.ts existe" "FAIL" "Manquant"
fi
# Test T10-F3: Existence fichier repo/apps/api/src/modules/pay/controllers/reconciliation.controller.ts
if [ -f "repo/apps/api/src/modules/pay/controllers/reconciliation.controller.ts" ]; then
  add_row "T10-F3" "Fichier reconciliation.controller.ts existe" "PASS" "Cree"
else
  add_row "T10-F3" "Fichier reconciliation.controller.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T10-V1: Import CSV reussi (P0)
echo "  Verifying T10-V1 : Import CSV reussi..."
add_row "T10-V1" "Import CSV reussi" "WARN" "(P0) Voir B-11 Tache 3.4.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V2: Auto-match identifie matched + unmatched + ambiguous (P0)
echo "  Verifying T10-V2 : Auto-match identifie matched + unmatched + ambiguous..."
add_row "T10-V2" "Auto-match identifie matched + unmatched + ambiguous" "WARN" "(P0) Voir B-11 Tache 3.4.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V3: Manual match force assignation (P0)
echo "  Verifying T10-V3 : Manual match force assignation..."
add_row "T10-V3" "Manual match force assignation" "WARN" "(P0) Voir B-11 Tache 3.4.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V4: Report discrepancies (P0)
echo "  Verifying T10-V4 : Report discrepancies..."
add_row "T10-V4" "Report discrepancies" "WARN" "(P0) Voir B-11 Tache 3.4.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V5: Tests 8+ scenarios (P0)
echo "  Verifying T10-V5 : Tests 8+ scenarios..."
add_row "T10-V5" "Tests 8+ scenarios" "WARN" "(P0) Voir B-11 Tache 3.4.10 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 11/5 -- 3.4.11 : Fraud Detection Rules Engine Basique

```bash
echo ""
echo "================================================"
echo "TACHE 3.4.11 : Fraud Detection Rules Engine Basique"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T11-F1: Existence fichier repo/packages/pay/src/services/fraud-detection.service.ts
if [ -f "repo/packages/pay/src/services/fraud-detection.service.ts" ]; then
  add_row "T11-F1" "Fichier fraud-detection.service.ts existe" "PASS" "Cree"
else
  add_row "T11-F1" "Fichier fraud-detection.service.ts existe" "FAIL" "Manquant"
fi
# Test T11-F2: Existence fichier repo/packages/pay/src/services/fraud-rules/{several}.rule.ts
if [ -f "repo/packages/pay/src/services/fraud-rules/{several}.rule.ts" ]; then
  add_row "T11-F2" "Fichier {several}.rule.ts existe" "PASS" "Cree"
else
  add_row "T11-F2" "Fichier {several}.rule.ts existe" "FAIL" "Manquant"
fi
# Test T11-F3: Existence fichier repo/packages/database/src/migrations/{date}-PayFraudEvaluations.ts
if [ -f "repo/packages/database/src/migrations/{date}-PayFraudEvaluations.ts" ]; then
  add_row "T11-F3" "Fichier {date}-PayFraudEvaluations.ts existe" "PASS" "Cree"
else
  add_row "T11-F3" "Fichier {date}-PayFraudEvaluations.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T11-V1: Rules engine evalue transactions (P0)
echo "  Verifying T11-V1 : Rules engine evalue transactions..."
add_row "T11-V1" "Rules engine evalue transactions" "WARN" "(P0) Voir B-11 Tache 3.4.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V2: Block action bloque avant gateway (P0)
echo "  Verifying T11-V2 : Block action bloque avant gateway..."
add_row "T11-V2" "Block action bloque avant gateway" "WARN" "(P0) Voir B-11 Tache 3.4.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V3: Review action queue admin (P0)
echo "  Verifying T11-V3 : Review action queue admin..."
add_row "T11-V3" "Review action queue admin" "WARN" "(P0) Voir B-11 Tache 3.4.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V4: Audit trail des decisions (P0)
echo "  Verifying T11-V4 : Audit trail des decisions..."
add_row "T11-V4" "Audit trail des decisions" "WARN" "(P0) Voir B-11 Tache 3.4.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V5: Tests 10+ scenarios fraude (P0)
echo "  Verifying T11-V5 : Tests 10+ scenarios fraude..."
add_row "T11-V5" "Tests 10+ scenarios fraude" "WARN" "(P0) Voir B-11 Tache 3.4.11 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 12/4 -- 3.4.12 : BullMQ Retry Queues + DLQ + Idempotency

```bash
echo ""
echo "================================================"
echo "TACHE 3.4.12 : BullMQ Retry Queues + DLQ + Idempotency"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 4"
echo "================================================"

# === Verification fichiers crees ===
# Test T12-F1: Existence fichier repo/packages/pay/src/workers/{3 workers}.ts
if [ -f "repo/packages/pay/src/workers/{3 workers}.ts" ]; then
  add_row "T12-F1" "Fichier {3 workers}.ts existe" "PASS" "Cree"
else
  add_row "T12-F1" "Fichier {3 workers}.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T12-V1: Polling wallet works (P0)
echo "  Verifying T12-V1 : Polling wallet works..."
add_row "T12-V1" "Polling wallet works" "WARN" "(P0) Voir B-11 Tache 3.4.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V2: Retry refund 3x avec backoff (P0)
echo "  Verifying T12-V2 : Retry refund 3x avec backoff..."
add_row "T12-V2" "Retry refund 3x avec backoff" "WARN" "(P0) Voir B-11 Tache 3.4.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V3: DLQ apres 3 echecs (P0)
echo "  Verifying T12-V3 : DLQ apres 3 echecs..."
add_row "T12-V3" "DLQ apres 3 echecs" "WARN" "(P0) Voir B-11 Tache 3.4.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V4: Tests 6+ scenarios (P1)
echo "  Verifying T12-V4 : Tests 6+ scenarios..."
add_row "T12-V4" "Tests 6+ scenarios" "WARN" "(P1) Voir B-11 Tache 3.4.12 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 13/5 -- 3.4.13 : Endpoints REST + Integration Comm + Docs

```bash
echo ""
echo "================================================"
echo "TACHE 3.4.13 : Endpoints REST + Integration Comm + Docs"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T13-F1: Existence fichier repo/apps/api/src/modules/pay/controllers/{several}.ts
if [ -f "repo/apps/api/src/modules/pay/controllers/{several}.ts" ]; then
  add_row "T13-F1" "Fichier {several}.ts existe" "PASS" "Cree"
else
  add_row "T13-F1" "Fichier {several}.ts existe" "FAIL" "Manquant"
fi
# Test T13-F2: Existence fichier repo/apps/api/src/modules/pay/consumers/pay-events-handlers.consumer.ts
if [ -f "repo/apps/api/src/modules/pay/consumers/pay-events-handlers.consumer.ts" ]; then
  add_row "T13-F2" "Fichier pay-events-handlers.consumer.ts existe" "PASS" "Cree"
else
  add_row "T13-F2" "Fichier pay-events-handlers.consumer.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T13-V1: Endpoints CRUD operationnels (P0)
echo "  Verifying T13-V1 : Endpoints CRUD operationnels..."
add_row "T13-V1" "Endpoints CRUD operationnels" "WARN" "(P0) Voir B-11 Tache 3.4.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V2: Capture event -> facture PDF auto generee (P0)
echo "  Verifying T13-V2 : Capture event -> facture PDF auto generee..."
add_row "T13-V2" "Capture event -> facture PDF auto generee" "WARN" "(P0) Voir B-11 Tache 3.4.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V3: Capture event -> notification user (P0)
echo "  Verifying T13-V3 : Capture event -> notification user..."
add_row "T13-V3" "Capture event -> notification user" "WARN" "(P0) Voir B-11 Tache 3.4.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V4: Fail event -> notification echec (P0)
echo "  Verifying T13-V4 : Fail event -> notification echec..."
add_row "T13-V4" "Fail event -> notification echec" "WARN" "(P0) Voir B-11 Tache 3.4.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V5: Tests E2E 8+ scenarios (P0)
echo "  Verifying T13-V5 : Tests E2E 8+ scenarios..."
add_row "T13-V5" "Tests E2E 8+ scenarios" "WARN" "(P0) Voir B-11 Tache 3.4.13 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 14/5 -- 3.4.14 : Tests E2E Exhaustifs (50+) avec Sandboxes

```bash
echo ""
echo "================================================"
echo "TACHE 3.4.14 : Tests E2E Exhaustifs (50+) avec Sandboxes"
echo "Priorite : P0 | Effort : 10h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T14-F1: Existence fichier repo/apps/api/test/pay/{50+ specs}.e2e-spec.ts
if [ -f "repo/apps/api/test/pay/{50+ specs}.e2e-spec.ts" ]; then
  add_row "T14-F1" "Fichier {50+ specs}.e2e-spec.ts existe" "PASS" "Cree"
else
  add_row "T14-F1" "Fichier {50+ specs}.e2e-spec.ts existe" "FAIL" "Manquant"
fi
# Test T14-F2: Existence fichier repo/apps/api/test/pay/fixtures/{several mocks}.ts
if [ -f "repo/apps/api/test/pay/fixtures/{several mocks}.ts" ]; then
  add_row "T14-F2" "Fichier {several mocks}.ts existe" "PASS" "Cree"
else
  add_row "T14-F2" "Fichier {several mocks}.ts existe" "FAIL" "Manquant"
fi
# Test T14-F3: Existence fichier repo/infrastructure/scripts/seed-pay-test-data.ts
if [ -f "repo/infrastructure/scripts/seed-pay-test-data.ts" ]; then
  add_row "T14-F3" "Fichier seed-pay-test-data.ts existe" "PASS" "Cree"
else
  add_row "T14-F3" "Fichier seed-pay-test-data.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T14-V1: 50+ tests passent (P0)
echo "  Verifying T14-V1 : 50+ tests passent..."
add_row "T14-V1" "50+ tests passent" "WARN" "(P0) Voir B-11 Tache 3.4.14 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T14-V2: Sandbox CMI integration reelle OK (P0)
echo "  Verifying T14-V2 : Sandbox CMI integration reelle OK..."
add_row "T14-V2" "Sandbox CMI integration reelle OK" "WARN" "(P0) Voir B-11 Tache 3.4.14 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T14-V3: Mocks 5 providers fonctionnent (P0)
echo "  Verifying T14-V3 : Mocks 5 providers fonctionnent..."
add_row "T14-V3" "Mocks 5 providers fonctionnent" "WARN" "(P0) Voir B-11 Tache 3.4.14 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T14-V4: Reproducibility 5x runs (P0)
echo "  Verifying T14-V4 : Reproducibility 5x runs..."
add_row "T14-V4" "Reproducibility 5x runs" "WARN" "(P0) Voir B-11 Tache 3.4.14 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T14-V5: Coverage all critical flows (P0)
echo "  Verifying T14-V5 : Coverage all critical flows..."
add_row "T14-V5" "Coverage all critical flows" "WARN" "(P0) Voir B-11 Tache 3.4.14 pour test detaille - critere a auto-tester via script ad-hoc"

```

---


---


## VERIFICATIONS TRANSVERSALES SPRINT 11

### TR-BUILD : Build complet du sprint

```bash
echo ""
echo "================================================"
echo "VERIFICATIONS TRANSVERSALES SPRINT 11"
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

### TR-MIGRATIONS : Migrations DB Sprint 11

```bash
echo "=== TR-MIGRATIONS : Migrations DB ==="
MIGR_COUNT=$(pg_query "SELECT COUNT(*) FROM migrations WHERE name LIKE '%sprint11%' OR name LIKE '%Sprint11%'" || echo 0)
if [ "$MIGR_COUNT" -gt 0 ]; then
  add_row "TR-MIG" "Migrations Sprint 11 appliquees" "PASS" "$MIGR_COUNT migrations"
else
  add_row "TR-MIG" "Migrations Sprint 11 appliquees" "WARN" "Aucune migration detectee (verifier)"
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
echo "GENERATION DU RAPPORT FINAL SPRINT 11"
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

## Jalon GO/NO-GO Sprint 11

EOF

# Calcul statut final
if (( $(echo "$SCORE >= 95" | bc -l) )); then
  STATUT="GO"
  cat >> "$REPORT_FILE" << EOF
**STATUT** : GO -- Sprint 11 valide, passage Sprint 12 autorise

Le sprint a passe les criteres requis. Cowork peut demarrer Sprint 12.

EOF
  echo ""
  echo "================================================"
  echo "SPRINT 11 : GO ($SCORE%)"
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
  echo "SPRINT 11 : GO CONDITIONNEL ($SCORE%)"
  echo "================================================"
else
  STATUT="NO-GO"
  cat >> "$REPORT_FILE" << EOF
**STATUT** : NO-GO -- Score $SCORE% trop bas (cible 85% minimum)

Le sprint **doit etre repris** :
- Lister tous FAIL P0
- Escalation Saad/Abla decision (cut scope OR delai)
- Reprise sprint avant Sprint 12

EOF
  echo ""
  echo "================================================"
  echo "SPRINT 11 : NO-GO ($SCORE%)"
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
  echo "git commit -m \"chore(sprint-11): close sprint 11 -- $STATUT ($SCORE%)\"" >> "$REPORT_FILE"
  echo '```' >> "$REPORT_FILE"
fi

echo ""
echo "Rapport complet dans : $REPORT_FILE"
```

---

## INSTRUCTION FINALE A CLAUDE CODE / COWORK

Apres l'execution complete des verifications ci-dessus :

1. **Lis le contenu de `sprint11-verify-report.md`** integralement
2. **Identifie les FAIL critiques** (criteres P0) qui necessitent intervention manuelle
3. **Affiche un resume executif** :
   - Nombre total de criteres
   - Pourcentage PASS / PASS\* / FAIL / WARN
   - Liste des FAIL avec contexte technique
   - Recommandation : GO / GO CONDITIONNEL / NO-GO
4. **Si NO-GO** : ne pas demarrer le Sprint suivant, alerter Saad/Abla via Slack `#insurtech-dev`
5. **Si GO ou GO CONDITIONNEL** : produire le commit de cloture du sprint :

```bash
git add skalean-insurtech/sprint11-verify-report.md
git commit -m "chore(sprint-11): close sprint 11 with verification report

- Verification automatique executee
- Score global : <SCORE>%
- <PASS> criteres PASS, <PASS_REPAIRED> reparations auto, <FAIL> FAIL
- Statut : <GO|GO CONDITIONNEL|NO-GO>

Phase: 3 -- Modules Horizontaux
Sprint: 11 (Phase 3 / Sprint 4)
Reference B-11, C-11, V-11
Report: sprint11-verify-report.md"
```

6. **Documentation continue** : si decisions techniques prises pendant verification, ajouter notes dans `repo/docs/runbooks/sprint-11-lessons-learned.md`

---

**Fin de la verification V-11 v2.2 detaillee -- Sprint 11 (3.4) Pay Multi-Passerelles MA (6 gateways).**

**Total criteres taches** : 75 | **Total transversaux** : ~10 | **Effort sprint** : 80h
