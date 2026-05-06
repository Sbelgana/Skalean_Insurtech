# VERIFICATION SPRINT 10 -- Phase 3 / Sprint 3 : Docs + Signature loi 43-20
# Version : Auto-reparation active + Rapport final MD detaille
# 13 taches, 91 criteres extraits B-10
# AUCUNE EMOJI AUTORISEE

**Version** : v2.2 (verification detaillee)
**Phase** : 3 -- Modules Horizontaux
**Sprint** : 10 / 35 (cumul) -- Sprint 3 dans Phase 3
**Reference meta-prompt** : `B-10-sprint-10-docs-signature.md`
**Reference orchestrateur** : `C-10-sprint-10-docs-signature.md`
**Total criteres** : 91 criteres taches + ~10 transversaux

---

Tu es **Claude Code (ou Cowork)**. Tu dois executer une **verification COMPLETE et EXHAUSTIVE** du Sprint 10 apres execution toutes les 13 taches.

---

## REGLES D'EXECUTION

1. Tu **executes CHAQUE verification dans l'ordre** (taches puis transversales)
2. Quand une verification echoue, tu **TENTES UNE REPARATION AUTOMATIQUE** avant de noter FAIL
3. Apres chaque tentative de reparation, tu **re-executes la verification**
4. Tu consignes dans `sprint10-verify-report.md` **TOUS les resultats** au fil de l'execution
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
REPORT_FILE="sprint10-verify-report.md"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
RUN_ID=$(date '+%Y%m%d-%H%M%S')

cat > "$REPORT_FILE" << EOF
# Rapport de Verification - Sprint 10 : Docs + Signature loi 43-20

**Date** : $TIMESTAMP
**Run ID** : $RUN_ID
**Phase** : 3 -- Modules Horizontaux
**Sprint** : 10 (Phase 3 / Sprint 3)
**Reference B-10** : 13 taches, 91 criteres extraits
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

## TACHE 1/5 -- 3.3.1 : Entities Documents + Versions Enrichies

```bash
echo ""
echo "================================================"
echo "TACHE 3.3.1 : Entities Documents + Versions Enrichies"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T01-F1: Existence fichier repo/packages/docs/src/entities/doc-document.entity.ts
if [ -f "repo/packages/docs/src/entities/doc-document.entity.ts" ]; then
  add_row "T01-F1" "Fichier doc-document.entity.ts existe" "PASS" "Cree"
else
  add_row "T01-F1" "Fichier doc-document.entity.ts existe" "FAIL" "Manquant"
fi
# Test T01-F2: Existence fichier repo/packages/docs/src/entities/doc-version.entity.ts
if [ -f "repo/packages/docs/src/entities/doc-version.entity.ts" ]; then
  add_row "T01-F2" "Fichier doc-version.entity.ts existe" "PASS" "Cree"
else
  add_row "T01-F2" "Fichier doc-version.entity.ts existe" "FAIL" "Manquant"
fi
# Test T01-F3: Existence fichier repo/packages/docs/src/schemas/document.schema.ts
if [ -f "repo/packages/docs/src/schemas/document.schema.ts" ]; then
  add_row "T01-F3" "Fichier document.schema.ts existe" "PASS" "Cree"
else
  add_row "T01-F3" "Fichier document.schema.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T01-V1: Entity hydrate (P0)
echo "  Verifying T01-V1 : Entity hydrate..."
add_row "T01-V1" "Entity hydrate" "WARN" "(P0) Voir B-10 Tache 3.3.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V2: Schema Zod create reject invalid (P0)
echo "  Verifying T01-V2 : Schema Zod create reject invalid..."
add_row "T01-V2" "Schema Zod create reject invalid" "WARN" "(P0) Voir B-10 Tache 3.3.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V3: Retention rules : police signed = 10 ans + 1 jour (P0)
echo "  Verifying T01-V3 : Retention rules : police signed = 10 ans + 1 jour..."
add_row "T01-V3" "Retention rules : police signed = 10 ans + 1 jour" "WARN" "(P0) Voir B-10 Tache 3.3.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V4: Cascade delete preserve audit (P0)
echo "  Verifying T01-V4 : Cascade delete preserve audit..."
add_row "T01-V4" "Cascade delete preserve audit" "WARN" "(P0) Voir B-10 Tache 3.3.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V5: Tests 6+ scenarios (P1)
echo "  Verifying T01-V5 : Tests 6+ scenarios..."
add_row "T01-V5" "Tests 6+ scenarios" "WARN" "(P1) Voir B-10 Tache 3.3.1 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 2/8 -- 3.3.2 : S3 Client Casablanca + KMS + Multi-Tenant Buckets

```bash
echo ""
echo "================================================"
echo "TACHE 3.3.2 : S3 Client Casablanca + KMS + Multi-Tenant Buckets"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 8"
echo "================================================"

# === Verification fichiers crees ===
# Test T02-F1: Existence fichier repo/packages/docs/src/services/s3-multitenant.service.ts
if [ -f "repo/packages/docs/src/services/s3-multitenant.service.ts" ]; then
  add_row "T02-F1" "Fichier s3-multitenant.service.ts existe" "PASS" "Cree"
else
  add_row "T02-F1" "Fichier s3-multitenant.service.ts existe" "FAIL" "Manquant"
fi
# Test T02-F2: Existence fichier repo/packages/docs/src/services/s3-multitenant.service.spec.ts
if [ -f "repo/packages/docs/src/services/s3-multitenant.service.spec.ts" ]; then
  add_row "T02-F2" "Fichier s3-multitenant.service.spec.ts existe" "PASS" "Cree"
else
  add_row "T02-F2" "Fichier s3-multitenant.service.spec.ts existe" "FAIL" "Manquant"
fi
# Test T02-F3: Existence fichier repo/packages/docs/src/services/bucket-lifecycle.service.ts
if [ -f "repo/packages/docs/src/services/bucket-lifecycle.service.ts" ]; then
  add_row "T02-F3" "Fichier bucket-lifecycle.service.ts existe" "PASS" "Cree"
else
  add_row "T02-F3" "Fichier bucket-lifecycle.service.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T02-V1: Bucket cree au tenant onboarding (P0)
echo "  Verifying T02-V1 : Bucket cree au tenant onboarding..."
add_row "T02-V1" "Bucket cree au tenant onboarding" "WARN" "(P0) Voir B-10 Tache 3.3.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V2: Upload + download roundtrip OK (P0)
echo "  Verifying T02-V2 : Upload + download roundtrip OK..."
add_row "T02-V2" "Upload + download roundtrip OK" "WARN" "(P0) Voir B-10 Tache 3.3.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V3: Multi-tenant isolation : tenant A bucket pas accessible depuis tenant B (P0)
echo "  Verifying T02-V3 : Multi-tenant isolation : tenant A bucket pas accessible depuis tenant ..."
add_row "T02-V3" "Multi-tenant isolation : tenant A bucket pas accessible depuis tenant B" "WARN" "(P0) Voir B-10 Tache 3.3.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V4: Presigned URL TTL 1h respecte (refuse > 1h) (P0)
echo "  Verifying T02-V4 : Presigned URL TTL 1h respecte (refuse > 1h)..."
add_row "T02-V4" "Presigned URL TTL 1h respecte (refuse > 1h)" "WARN" "(P0) Voir B-10 Tache 3.3.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V5: 3 buckets per tenant (docs, photos, archive) (P0)
echo "  Verifying T02-V5 : 3 buckets per tenant (docs, photos, archive)..."
add_row "T02-V5" "3 buckets per tenant (docs, photos, archive)" "WARN" "(P0) Voir B-10 Tache 3.3.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V6: Versioning enabled prod (P0)
echo "  Verifying T02-V6 : Versioning enabled prod..."
add_row "T02-V6" "Versioning enabled prod" "WARN" "(P0) Voir B-10 Tache 3.3.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V7: Object Lock archive bucket (immutable) (P0)
echo "  Verifying T02-V7 : Object Lock archive bucket (immutable)..."
add_row "T02-V7" "Object Lock archive bucket (immutable)" "WARN" "(P0) Voir B-10 Tache 3.3.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V8: Tests 12+ scenarios (P1)
echo "  Verifying T02-V8 : Tests 12+ scenarios..."
add_row "T02-V8" "Tests 12+ scenarios" "WARN" "(P1) Voir B-10 Tache 3.3.2 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 3/9 -- 3.3.3 : DocumentService (CRUD + Presigned URLs + Retention)

```bash
echo ""
echo "================================================"
echo "TACHE 3.3.3 : DocumentService (CRUD + Presigned URLs + Retention)"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 9"
echo "================================================"

# === Verification fichiers crees ===
# Test T03-F1: Existence fichier repo/packages/docs/src/services/document.service.ts
if [ -f "repo/packages/docs/src/services/document.service.ts" ]; then
  add_row "T03-F1" "Fichier document.service.ts existe" "PASS" "Cree"
else
  add_row "T03-F1" "Fichier document.service.ts existe" "FAIL" "Manquant"
fi
# Test T03-F2: Existence fichier repo/packages/docs/src/services/document.service.spec.ts
if [ -f "repo/packages/docs/src/services/document.service.spec.ts" ]; then
  add_row "T03-F2" "Fichier document.service.spec.ts existe" "PASS" "Cree"
else
  add_row "T03-F2" "Fichier document.service.spec.ts existe" "FAIL" "Manquant"
fi
# Test T03-F3: Existence fichier repo/apps/api/src/modules/docs/controllers/documents.controller.ts
if [ -f "repo/apps/api/src/modules/docs/controllers/documents.controller.ts" ]; then
  add_row "T03-F3" "Fichier documents.controller.ts existe" "PASS" "Cree"
else
  add_row "T03-F3" "Fichier documents.controller.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T03-V1: POST upload OK + S3 + DB row (P0)
echo "  Verifying T03-V1 : POST upload OK + S3 + DB row..."
add_row "T03-V1" "POST upload OK + S3 + DB row" "WARN" "(P0) Voir B-10 Tache 3.3.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V2: Hash SHA-256 compute correct (verifier reproductible) (P0)
echo "  Verifying T03-V2 : Hash SHA-256 compute correct (verifier reproductible)..."
add_row "T03-V2" "Hash SHA-256 compute correct (verifier reproductible)" "WARN" "(P0) Voir B-10 Tache 3.3.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V3: MIME type non whitelist rejete 400 (P0)
echo "  Verifying T03-V3 : MIME type non whitelist rejete 400..."
add_row "T03-V3" "MIME type non whitelist rejete 400" "WARN" "(P0) Voir B-10 Tache 3.3.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V4: GET /download retourne presigned URL (P0)
echo "  Verifying T03-V4 : GET /download retourne presigned URL..."
add_row "T03-V4" "GET /download retourne presigned URL" "WARN" "(P0) Voir B-10 Tache 3.3.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V5: Versioning : addVersion increment version_number (P0)
echo "  Verifying T03-V5 : Versioning : addVersion increment version_number..."
add_row "T03-V5" "Versioning : addVersion increment version_number" "WARN" "(P0) Voir B-10 Tache 3.3.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V6: Status transitions invalides rejetes (P0)
echo "  Verifying T03-V6 : Status transitions invalides rejetes..."
add_row "T03-V6" "Status transitions invalides rejetes" "WARN" "(P0) Voir B-10 Tache 3.3.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V7: Multi-tenant isolation (P0)
echo "  Verifying T03-V7 : Multi-tenant isolation..."
add_row "T03-V7" "Multi-tenant isolation" "WARN" "(P0) Voir B-10 Tache 3.3.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V8: Audit + Kafka events (P0)
echo "  Verifying T03-V8 : Audit + Kafka events..."
add_row "T03-V8" "Audit + Kafka events" "WARN" "(P0) Voir B-10 Tache 3.3.3 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 4/7 -- 3.3.4 : AccessLogService (Track Who Downloaded What When)

```bash
echo ""
echo "================================================"
echo "TACHE 3.3.4 : AccessLogService (Track Who Downloaded What When)"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 7"
echo "================================================"

# === Verification fichiers crees ===
# Test T04-F1: Existence fichier repo/packages/docs/src/services/access-log.service.ts
if [ -f "repo/packages/docs/src/services/access-log.service.ts" ]; then
  add_row "T04-F1" "Fichier access-log.service.ts existe" "PASS" "Cree"
else
  add_row "T04-F1" "Fichier access-log.service.ts existe" "FAIL" "Manquant"
fi
# Test T04-F2: Existence fichier repo/packages/docs/src/services/access-log.service.spec.ts
if [ -f "repo/packages/docs/src/services/access-log.service.spec.ts" ]; then
  add_row "T04-F2" "Fichier access-log.service.spec.ts existe" "PASS" "Cree"
else
  add_row "T04-F2" "Fichier access-log.service.spec.ts existe" "FAIL" "Manquant"
fi
# Test T04-F3: Existence fichier repo/apps/api/src/modules/docs/interceptors/log-document-access.interceptor.ts
if [ -f "repo/apps/api/src/modules/docs/interceptors/log-document-access.interceptor.ts" ]; then
  add_row "T04-F3" "Fichier log-document-access.interceptor.ts existe" "PASS" "Cree"
else
  add_row "T04-F3" "Fichier log-document-access.interceptor.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T04-V1: View access logged (P0)
echo "  Verifying T04-V1 : View access logged..."
add_row "T04-V1" "View access logged" "WARN" "(P0) Voir B-10 Tache 3.3.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V2: Download access logged (P0)
echo "  Verifying T04-V2 : Download access logged..."
add_row "T04-V2" "Download access logged" "WARN" "(P0) Voir B-10 Tache 3.3.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V3: Append-only (pas UPDATE/DELETE) (P0)
echo "  Verifying T04-V3 : Append-only (pas UPDATE/DELETE)..."
add_row "T04-V3" "Append-only (pas UPDATE/DELETE)" "WARN" "(P0) Voir B-10 Tache 3.3.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V4: Detection abus 100/h emit alert (P0)
echo "  Verifying T04-V4 : Detection abus 100/h emit alert..."
add_row "T04-V4" "Detection abus 100/h emit alert" "WARN" "(P0) Voir B-10 Tache 3.3.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V5: Admin endpoint retourne logs (P0)
echo "  Verifying T04-V5 : Admin endpoint retourne logs..."
add_row "T04-V5" "Admin endpoint retourne logs" "WARN" "(P0) Voir B-10 Tache 3.3.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V6: Logging async (response time pas degrade) (P0)
echo "  Verifying T04-V6 : Logging async (response time pas degrade)..."
add_row "T04-V6" "Logging async (response time pas degrade)" "WARN" "(P0) Voir B-10 Tache 3.3.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V7: Tests 8+ scenarios (P1)
echo "  Verifying T04-V7 : Tests 8+ scenarios..."
add_row "T04-V7" "Tests 8+ scenarios" "WARN" "(P1) Voir B-10 Tache 3.3.4 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 5/9 -- 3.3.5 : PdfGeneratorService + 4 Templates Initiaux

```bash
echo ""
echo "================================================"
echo "TACHE 3.3.5 : PdfGeneratorService + 4 Templates Initiaux"
echo "Priorite : P0 | Effort : 7h"
echo "Criteres a verifier : 9"
echo "================================================"

# === Verification fichiers crees ===
# Test T05-F1: Existence fichier repo/packages/docs/src/services/pdf-generator.service.ts
if [ -f "repo/packages/docs/src/services/pdf-generator.service.ts" ]; then
  add_row "T05-F1" "Fichier pdf-generator.service.ts existe" "PASS" "Cree"
else
  add_row "T05-F1" "Fichier pdf-generator.service.ts existe" "FAIL" "Manquant"
fi
# Test T05-F2: Existence fichier repo/packages/docs/src/services/pdf-generator.service.spec.ts
if [ -f "repo/packages/docs/src/services/pdf-generator.service.spec.ts" ]; then
  add_row "T05-F2" "Fichier pdf-generator.service.spec.ts existe" "PASS" "Cree"
else
  add_row "T05-F2" "Fichier pdf-generator.service.spec.ts existe" "FAIL" "Manquant"
fi
# Test T05-F3: Existence fichier repo/packages/docs/src/templates/_layout.hbs
if [ -f "repo/packages/docs/src/templates/_layout.hbs" ]; then
  add_row "T05-F3" "Fichier _layout.hbs existe" "PASS" "Cree"
else
  add_row "T05-F3" "Fichier _layout.hbs existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T05-V1: generate(devis, fr, data) retourne PDF Buffer valide (P0)
echo "  Verifying T05-V1 : generate(devis, fr, data) retourne PDF Buffer valide..."
add_row "T05-V1" "generate(devis, fr, data) retourne PDF Buffer valide" "WARN" "(P0) Voir B-10 Tache 3.3.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V2: 4 templates fonctionnent (P0)
echo "  Verifying T05-V2 : 4 templates fonctionnent..."
add_row "T05-V2" "4 templates fonctionnent" "WARN" "(P0) Voir B-10 Tache 3.3.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V3: 3 locales fr/ar-MA/ar (P0)
echo "  Verifying T05-V3 : 3 locales fr/ar-MA/ar..."
add_row "T05-V3" "3 locales fr/ar-MA/ar" "WARN" "(P0) Voir B-10 Tache 3.3.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V4: RTL applique pour ar/ar-MA (P0)
echo "  Verifying T05-V4 : RTL applique pour ar/ar-MA..."
add_row "T05-V4" "RTL applique pour ar/ar-MA" "WARN" "(P0) Voir B-10 Tache 3.3.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V5: Performance < 3s (P0)
echo "  Verifying T05-V5 : Performance < 3s..."
add_row "T05-V5" "Performance < 3s" "WARN" "(P0) Voir B-10 Tache 3.3.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V6: Helpers (formatDate, formatCurrency, qrCode) fonctionnent (P0)
echo "  Verifying T05-V6 : Helpers (formatDate, formatCurrency, qrCode) fonctionnent..."
add_row "T05-V6" "Helpers (formatDate, formatCurrency, qrCode) fonctionnent" "WARN" "(P0) Voir B-10 Tache 3.3.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V7: Snapshot tests 12 outputs (4 templates x 3 locales) (P0)
echo "  Verifying T05-V7 : Snapshot tests 12 outputs (4 templates x 3 locales)..."
add_row "T05-V7" "Snapshot tests 12 outputs (4 templates x 3 locales)" "WARN" "(P0) Voir B-10 Tache 3.3.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V8: Embedded fonts/logos (pas URLs externes) (P0)
echo "  Verifying T05-V8 : Embedded fonts/logos (pas URLs externes)..."
add_row "T05-V8" "Embedded fonts/logos (pas URLs externes)" "WARN" "(P0) Voir B-10 Tache 3.3.5 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 6/7 -- 3.3.6 : sig_signing_workflows Entity + SigningWorkflowService

```bash
echo ""
echo "================================================"
echo "TACHE 3.3.6 : sig_signing_workflows Entity + SigningWorkflowService"
echo "Priorite : P0 | Effort : 7h"
echo "Criteres a verifier : 7"
echo "================================================"

# === Verification fichiers crees ===
# Test T06-F1: Existence fichier repo/packages/database/src/migrations/{date}-SigningWorkflows.ts
if [ -f "repo/packages/database/src/migrations/{date}-SigningWorkflows.ts" ]; then
  add_row "T06-F1" "Fichier {date}-SigningWorkflows.ts existe" "PASS" "Cree"
else
  add_row "T06-F1" "Fichier {date}-SigningWorkflows.ts existe" "FAIL" "Manquant"
fi
# Test T06-F2: Existence fichier repo/packages/signature/src/entities/sig-signing-workflow.entity.ts
if [ -f "repo/packages/signature/src/entities/sig-signing-workflow.entity.ts" ]; then
  add_row "T06-F2" "Fichier sig-signing-workflow.entity.ts existe" "PASS" "Cree"
else
  add_row "T06-F2" "Fichier sig-signing-workflow.entity.ts existe" "FAIL" "Manquant"
fi
# Test T06-F3: Existence fichier repo/packages/signature/src/services/signing-workflow.service.ts
if [ -f "repo/packages/signature/src/services/signing-workflow.service.ts" ]; then
  add_row "T06-F3" "Fichier signing-workflow.service.ts existe" "PASS" "Cree"
else
  add_row "T06-F3" "Fichier signing-workflow.service.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T06-V1: Migration creee (P0)
echo "  Verifying T06-V1 : Migration creee..."
add_row "T06-V1" "Migration creee" "WARN" "(P0) Voir B-10 Tache 3.3.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V2: createWorkflow stocke signers JSONB (P0)
echo "  Verifying T06-V2 : createWorkflow stocke signers JSONB..."
add_row "T06-V2" "createWorkflow stocke signers JSONB" "WARN" "(P0) Voir B-10 Tache 3.3.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V3: Status transitions valides only (P0)
echo "  Verifying T06-V3 : Status transitions valides only..."
add_row "T06-V3" "Status transitions valides only" "WARN" "(P0) Voir B-10 Tache 3.3.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V4: Sequential : signer 2 notifie apres signer 1 sign (P0)
echo "  Verifying T06-V4 : Sequential : signer 2 notifie apres signer 1 sign..."
add_row "T06-V4" "Sequential : signer 2 notifie apres signer 1 sign" "WARN" "(P0) Voir B-10 Tache 3.3.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V5: expires_at auto-set 7 jours (P0)
echo "  Verifying T06-V5 : expires_at auto-set 7 jours..."
add_row "T06-V5" "expires_at auto-set 7 jours" "WARN" "(P0) Voir B-10 Tache 3.3.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V6: Audit + Kafka events (P0)
echo "  Verifying T06-V6 : Audit + Kafka events..."
add_row "T06-V6" "Audit + Kafka events" "WARN" "(P0) Voir B-10 Tache 3.3.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V7: Tests 10+ scenarios (P0)
echo "  Verifying T06-V7 : Tests 10+ scenarios..."
add_row "T06-V7" "Tests 10+ scenarios" "WARN" "(P0) Voir B-10 Tache 3.3.6 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 7/6 -- 3.3.7 : Barid eSign API Client + Workflow Envoi

```bash
echo ""
echo "================================================"
echo "TACHE 3.3.7 : Barid eSign API Client + Workflow Envoi"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 6"
echo "================================================"

# === Verification fichiers crees ===
# Test T07-F1: Existence fichier repo/packages/signature/src/providers/barid-esign/barid-esign.client.ts
if [ -f "repo/packages/signature/src/providers/barid-esign/barid-esign.client.ts" ]; then
  add_row "T07-F1" "Fichier barid-esign.client.ts existe" "PASS" "Cree"
else
  add_row "T07-F1" "Fichier barid-esign.client.ts existe" "FAIL" "Manquant"
fi
# Test T07-F2: Existence fichier repo/packages/signature/src/providers/barid-esign/barid-esign.client.spec.ts
if [ -f "repo/packages/signature/src/providers/barid-esign/barid-esign.client.spec.ts" ]; then
  add_row "T07-F2" "Fichier barid-esign.client.spec.ts existe" "PASS" "Cree"
else
  add_row "T07-F2" "Fichier barid-esign.client.spec.ts existe" "FAIL" "Manquant"
fi
# Test T07-F3: Existence fichier repo/packages/signature/src/providers/barid-esign/types.ts
if [ -f "repo/packages/signature/src/providers/barid-esign/types.ts" ]; then
  add_row "T07-F3" "Fichier types.ts existe" "PASS" "Cree"
else
  add_row "T07-F3" "Fichier types.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T07-V1: createSignatureRequest reussi (mock retourne workflow_id) (P0)
echo "  Verifying T07-V1 : createSignatureRequest reussi (mock retourne workflow_id)..."
add_row "T07-V1" "createSignatureRequest reussi (mock retourne workflow_id)" "WARN" "(P0) Voir B-10 Tache 3.3.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V2: Signers structure correcte (P0)
echo "  Verifying T07-V2 : Signers structure correcte..."
add_row "T07-V2" "Signers structure correcte" "WARN" "(P0) Voir B-10 Tache 3.3.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V3: Signature type qualified utilise (P0)
echo "  Verifying T07-V3 : Signature type qualified utilise..."
add_row "T07-V3" "Signature type qualified utilise" "WARN" "(P0) Voir B-10 Tache 3.3.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V4: Errors typed (Unavailable, InvalidSigner, etc.) (P0)
echo "  Verifying T07-V4 : Errors typed (Unavailable, InvalidSigner, etc.)..."
add_row "T07-V4" "Errors typed (Unavailable, InvalidSigner, etc.)" "WARN" "(P0) Voir B-10 Tache 3.3.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V5: Mock client comportement equivalent (P0)
echo "  Verifying T07-V5 : Mock client comportement equivalent..."
add_row "T07-V5" "Mock client comportement equivalent" "WARN" "(P0) Voir B-10 Tache 3.3.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V6: Tests integration via mock 10+ scenarios (P0)
echo "  Verifying T07-V6 : Tests integration via mock 10+ scenarios..."
add_row "T07-V6" "Tests integration via mock 10+ scenarios" "WARN" "(P0) Voir B-10 Tache 3.3.7 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 8/6 -- 3.3.8 : Hash SHA-256 + Horodatage Qualifie ANRT

```bash
echo ""
echo "================================================"
echo "TACHE 3.3.8 : Hash SHA-256 + Horodatage Qualifie ANRT"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 6"
echo "================================================"

# === Verification fichiers crees ===
# Test T08-F1: Existence fichier repo/packages/signature/src/services/timestamp-anrt.service.ts
if [ -f "repo/packages/signature/src/services/timestamp-anrt.service.ts" ]; then
  add_row "T08-F1" "Fichier timestamp-anrt.service.ts existe" "PASS" "Cree"
else
  add_row "T08-F1" "Fichier timestamp-anrt.service.ts existe" "FAIL" "Manquant"
fi
# Test T08-F2: Existence fichier repo/packages/signature/src/services/timestamp-anrt.service.spec.ts
if [ -f "repo/packages/signature/src/services/timestamp-anrt.service.spec.ts" ]; then
  add_row "T08-F2" "Fichier timestamp-anrt.service.spec.ts existe" "PASS" "Cree"
else
  add_row "T08-F2" "Fichier timestamp-anrt.service.spec.ts existe" "FAIL" "Manquant"
fi
# Test T08-F3: Existence fichier repo/packages/database/src/migrations/{date}-AddTsaTimestampColumns.ts
if [ -f "repo/packages/database/src/migrations/{date}-AddTsaTimestampColumns.ts" ]; then
  add_row "T08-F3" "Fichier {date}-AddTsaTimestampColumns.ts existe" "PASS" "Cree"
else
  add_row "T08-F3" "Fichier {date}-AddTsaTimestampColumns.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T08-V1: applyTimestamp retourne token + applied_at (P0)
echo "  Verifying T08-V1 : applyTimestamp retourne token + applied_at..."
add_row "T08-V1" "applyTimestamp retourne token + applied_at" "WARN" "(P0) Voir B-10 Tache 3.3.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V2: verifyTimestamp valid token retourne genTime correct (P0)
echo "  Verifying T08-V2 : verifyTimestamp valid token retourne genTime correct..."
add_row "T08-V2" "verifyTimestamp valid token retourne genTime correct" "WARN" "(P0) Voir B-10 Tache 3.3.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V3: verifyTimestamp tampered document retourne invalid (P0)
echo "  Verifying T08-V3 : verifyTimestamp tampered document retourne invalid..."
add_row "T08-V3" "verifyTimestamp tampered document retourne invalid" "WARN" "(P0) Voir B-10 Tache 3.3.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V4: mTLS auth utilise certs depuis env paths (P0)
echo "  Verifying T08-V4 : mTLS auth utilise certs depuis env paths..."
add_row "T08-V4" "mTLS auth utilise certs depuis env paths" "WARN" "(P0) Voir B-10 Tache 3.3.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V5: Tests integration mock TSA (P0)
echo "  Verifying T08-V5 : Tests integration mock TSA..."
add_row "T08-V5" "Tests integration mock TSA" "WARN" "(P0) Voir B-10 Tache 3.3.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V6: Storage columns sig_signing_workflows (P0)
echo "  Verifying T08-V6 : Storage columns sig_signing_workflows..."
add_row "T08-V6" "Storage columns sig_signing_workflows" "WARN" "(P0) Voir B-10 Tache 3.3.8 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 9/7 -- 3.3.9 : Webhook Receiver Barid eSign

```bash
echo ""
echo "================================================"
echo "TACHE 3.3.9 : Webhook Receiver Barid eSign"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 7"
echo "================================================"

# === Verification fichiers crees ===
# Test T09-F1: Existence fichier repo/apps/api/src/modules/signature/controllers/barid-webhook.controller.ts
if [ -f "repo/apps/api/src/modules/signature/controllers/barid-webhook.controller.ts" ]; then
  add_row "T09-F1" "Fichier barid-webhook.controller.ts existe" "PASS" "Cree"
else
  add_row "T09-F1" "Fichier barid-webhook.controller.ts existe" "FAIL" "Manquant"
fi
# Test T09-F2: Existence fichier repo/apps/api/src/modules/signature/middleware/barid-signature.middleware.ts
if [ -f "repo/apps/api/src/modules/signature/middleware/barid-signature.middleware.ts" ]; then
  add_row "T09-F2" "Fichier barid-signature.middleware.ts existe" "PASS" "Cree"
else
  add_row "T09-F2" "Fichier barid-signature.middleware.ts existe" "FAIL" "Manquant"
fi
# Test T09-F3: Existence fichier repo/apps/api/src/modules/signature/consumers/barid-webhook-processor.consumer.ts
if [ -f "repo/apps/api/src/modules/signature/consumers/barid-webhook-processor.consumer.ts" ]; then
  add_row "T09-F3" "Fichier barid-webhook-processor.consumer.ts existe" "PASS" "Cree"
else
  add_row "T09-F3" "Fichier barid-webhook-processor.consumer.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T09-V1: Webhook signature_completed processed (P0)
echo "  Verifying T09-V1 : Webhook signature_completed processed..."
add_row "T09-V1" "Webhook signature_completed processed" "WARN" "(P0) Voir B-10 Tache 3.3.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V2: ANRT timestamp applique apres Barid completion (P0)
echo "  Verifying T09-V2 : ANRT timestamp applique apres Barid completion..."
add_row "T09-V2" "ANRT timestamp applique apres Barid completion" "WARN" "(P0) Voir B-10 Tache 3.3.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V3: Workflow status updated (P0)
echo "  Verifying T09-V3 : Workflow status updated..."
add_row "T09-V3" "Workflow status updated" "WARN" "(P0) Voir B-10 Tache 3.3.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V4: Notification user envoyee (P0)
echo "  Verifying T09-V4 : Notification user envoyee..."
add_row "T09-V4" "Notification user envoyee" "WARN" "(P0) Voir B-10 Tache 3.3.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V5: Signature HMAC validation (P0)
echo "  Verifying T09-V5 : Signature HMAC validation..."
add_row "T09-V5" "Signature HMAC validation" "WARN" "(P0) Voir B-10 Tache 3.3.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V6: Idempotency works (P0)
echo "  Verifying T09-V6 : Idempotency works..."
add_row "T09-V6" "Idempotency works" "WARN" "(P0) Voir B-10 Tache 3.3.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V7: Tests 10+ scenarios (P0)
echo "  Verifying T09-V7 : Tests 10+ scenarios..."
add_row "T09-V7" "Tests 10+ scenarios" "WARN" "(P0) Voir B-10 Tache 3.3.9 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 10/7 -- 3.3.10 : sig_audit_trails Immutable + AuditTrailService

```bash
echo ""
echo "================================================"
echo "TACHE 3.3.10 : sig_audit_trails Immutable + AuditTrailService"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 7"
echo "================================================"

# === Verification fichiers crees ===
# Test T10-F1: Existence fichier repo/packages/database/src/migrations/{date}-SigAuditTrails.ts
if [ -f "repo/packages/database/src/migrations/{date}-SigAuditTrails.ts" ]; then
  add_row "T10-F1" "Fichier {date}-SigAuditTrails.ts existe" "PASS" "Cree"
else
  add_row "T10-F1" "Fichier {date}-SigAuditTrails.ts existe" "FAIL" "Manquant"
fi
# Test T10-F2: Existence fichier repo/packages/signature/src/entities/sig-audit-trail.entity.ts
if [ -f "repo/packages/signature/src/entities/sig-audit-trail.entity.ts" ]; then
  add_row "T10-F2" "Fichier sig-audit-trail.entity.ts existe" "PASS" "Cree"
else
  add_row "T10-F2" "Fichier sig-audit-trail.entity.ts existe" "FAIL" "Manquant"
fi
# Test T10-F3: Existence fichier repo/packages/signature/src/services/audit-trail.service.ts
if [ -f "repo/packages/signature/src/services/audit-trail.service.ts" ]; then
  add_row "T10-F3" "Fichier audit-trail.service.ts existe" "PASS" "Cree"
else
  add_row "T10-F3" "Fichier audit-trail.service.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T10-V1: Table cree append-only (P0)
echo "  Verifying T10-V1 : Table cree append-only..."
add_row "T10-V1" "Table cree append-only" "WARN" "(P0) Voir B-10 Tache 3.3.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V2: INSERT events fonctionne (P0)
echo "  Verifying T10-V2 : INSERT events fonctionne..."
add_row "T10-V2" "INSERT events fonctionne" "WARN" "(P0) Voir B-10 Tache 3.3.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V3: UPDATE / DELETE rejetes (no policy) (P0)
echo "  Verifying T10-V3 : UPDATE / DELETE rejetes (no policy)..."
add_row "T10-V3" "UPDATE / DELETE rejetes (no policy)" "WARN" "(P0) Voir B-10 Tache 3.3.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V4: getTrail retourne timeline (P0)
echo "  Verifying T10-V4 : getTrail retourne timeline..."
add_row "T10-V4" "getTrail retourne timeline" "WARN" "(P0) Voir B-10 Tache 3.3.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V5: generatePdfTrail produit PDF lisible (P0)
echo "  Verifying T10-V5 : generatePdfTrail produit PDF lisible..."
add_row "T10-V5" "generatePdfTrail produit PDF lisible" "WARN" "(P0) Voir B-10 Tache 3.3.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V6: RLS multi-tenant (P0)
echo "  Verifying T10-V6 : RLS multi-tenant..."
add_row "T10-V6" "RLS multi-tenant" "WARN" "(P0) Voir B-10 Tache 3.3.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V7: Tests 6+ scenarios (P0)
echo "  Verifying T10-V7 : Tests 6+ scenarios..."
add_row "T10-V7" "Tests 6+ scenarios" "WARN" "(P0) Voir B-10 Tache 3.3.10 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 11/8 -- 3.3.11 : Public Verify Controller (Verification Document via Hash)

```bash
echo ""
echo "================================================"
echo "TACHE 3.3.11 : Public Verify Controller (Verification Document via Hash)"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 8"
echo "================================================"

# === Verification fichiers crees ===
# Test T11-F1: Existence fichier repo/apps/api/src/modules/signature/controllers/public-verify.controller.ts
if [ -f "repo/apps/api/src/modules/signature/controllers/public-verify.controller.ts" ]; then
  add_row "T11-F1" "Fichier public-verify.controller.ts existe" "PASS" "Cree"
else
  add_row "T11-F1" "Fichier public-verify.controller.ts existe" "FAIL" "Manquant"
fi
# Test T11-F2: Existence fichier repo/packages/docs/src/templates/verify-page.hbs
if [ -f "repo/packages/docs/src/templates/verify-page.hbs" ]; then
  add_row "T11-F2" "Fichier verify-page.hbs existe" "PASS" "Cree"
else
  add_row "T11-F2" "Fichier verify-page.hbs existe" "FAIL" "Manquant"
fi
# Test T11-F3: Existence fichier repo/apps/api/test/signature/public-verify.e2e-spec.ts
if [ -f "repo/apps/api/test/signature/public-verify.e2e-spec.ts" ]; then
  add_row "T11-F3" "Fichier public-verify.e2e-spec.ts existe" "PASS" "Cree"
else
  add_row "T11-F3" "Fichier public-verify.e2e-spec.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T11-V1: GET hash valide retourne details (P0)
echo "  Verifying T11-V1 : GET hash valide retourne details..."
add_row "T11-V1" "GET hash valide retourne details" "WARN" "(P0) Voir B-10 Tache 3.3.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V2: GET hash invalide retourne 404 (P0)
echo "  Verifying T11-V2 : GET hash invalide retourne 404..."
add_row "T11-V2" "GET hash invalide retourne 404" "WARN" "(P0) Voir B-10 Tache 3.3.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V3: Document signed status retourne signing details (P0)
echo "  Verifying T11-V3 : Document signed status retourne signing details..."
add_row "T11-V3" "Document signed status retourne signing details" "WARN" "(P0) Voir B-10 Tache 3.3.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V4: Document draft status retourne 'non signe' (P0)
echo "  Verifying T11-V4 : Document draft status retourne 'non signe'..."
add_row "T11-V4" "Document draft status retourne 'non signe'" "WARN" "(P0) Voir B-10 Tache 3.3.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V5: Rate limit actif 60/h per IP (P0)
echo "  Verifying T11-V5 : Rate limit actif 60/h per IP..."
add_row "T11-V5" "Rate limit actif 60/h per IP" "WARN" "(P0) Voir B-10 Tache 3.3.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V6: Audit log verifications (P0)
echo "  Verifying T11-V6 : Audit log verifications..."
add_row "T11-V6" "Audit log verifications" "WARN" "(P0) Voir B-10 Tache 3.3.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V7: Page HTML render OK (P0)
echo "  Verifying T11-V7 : Page HTML render OK..."
add_row "T11-V7" "Page HTML render OK" "WARN" "(P0) Voir B-10 Tache 3.3.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V8: Tests 8+ scenarios (P0)
echo "  Verifying T11-V8 : Tests 8+ scenarios..."
add_row "T11-V8" "Tests 8+ scenarios" "WARN" "(P0) Voir B-10 Tache 3.3.11 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 12/7 -- 3.3.12 : SealedArchiveService (Bucket WORM 10 Ans + 1 Jour)

```bash
echo ""
echo "================================================"
echo "TACHE 3.3.12 : SealedArchiveService (Bucket WORM 10 Ans + 1 Jour)"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 7"
echo "================================================"

# === Verification fichiers crees ===
# Test T12-F1: Existence fichier repo/packages/signature/src/services/sealed-archive.service.ts
if [ -f "repo/packages/signature/src/services/sealed-archive.service.ts" ]; then
  add_row "T12-F1" "Fichier sealed-archive.service.ts existe" "PASS" "Cree"
else
  add_row "T12-F1" "Fichier sealed-archive.service.ts existe" "FAIL" "Manquant"
fi
# Test T12-F2: Existence fichier repo/packages/database/src/migrations/{date}-SigArchives.ts
if [ -f "repo/packages/database/src/migrations/{date}-SigArchives.ts" ]; then
  add_row "T12-F2" "Fichier {date}-SigArchives.ts existe" "PASS" "Cree"
else
  add_row "T12-F2" "Fichier {date}-SigArchives.ts existe" "FAIL" "Manquant"
fi
# Test T12-F3: Existence fichier repo/packages/signature/src/entities/sig-archive.entity.ts
if [ -f "repo/packages/signature/src/entities/sig-archive.entity.ts" ]; then
  add_row "T12-F3" "Fichier sig-archive.entity.ts existe" "PASS" "Cree"
else
  add_row "T12-F3" "Fichier sig-archive.entity.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T12-V1: archive() reussit + bucket archive contient document (P0)
echo "  Verifying T12-V1 : archive() reussit + bucket archive contient document..."
add_row "T12-V1" "archive() reussit + bucket archive contient document" "WARN" "(P0) Voir B-10 Tache 3.3.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V2: Object Lock locked_until = signed_at + 10 ans + 1 jour (P0)
echo "  Verifying T12-V2 : Object Lock locked_until = signed_at + 10 ans + 1 jour..."
add_row "T12-V2" "Object Lock locked_until = signed_at + 10 ans + 1 jour" "WARN" "(P0) Voir B-10 Tache 3.3.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V3: Tentative DELETE archive object rejete (Object Lock) (P0)
echo "  Verifying T12-V3 : Tentative DELETE archive object rejete (Object Lock)..."
add_row "T12-V3" "Tentative DELETE archive object rejete (Object Lock)" "WARN" "(P0) Voir B-10 Tache 3.3.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V4: sig_archives row stocke metadata (P0)
echo "  Verifying T12-V4 : sig_archives row stocke metadata..."
add_row "T12-V4" "sig_archives row stocke metadata" "WARN" "(P0) Voir B-10 Tache 3.3.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V5: verifyArchiveIntegrity match hash (P0)
echo "  Verifying T12-V5 : verifyArchiveIntegrity match hash..."
add_row "T12-V5" "verifyArchiveIntegrity match hash" "WARN" "(P0) Voir B-10 Tache 3.3.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V6: Trigger via Kafka event automatique (P0)
echo "  Verifying T12-V6 : Trigger via Kafka event automatique..."
add_row "T12-V6" "Trigger via Kafka event automatique" "WARN" "(P0) Voir B-10 Tache 3.3.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V7: Tests 8+ scenarios (P0)
echo "  Verifying T12-V7 : Tests 8+ scenarios..."
add_row "T12-V7" "Tests 8+ scenarios" "WARN" "(P0) Voir B-10 Tache 3.3.12 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 13/5 -- 3.3.13 : Tests E2E Exhaustifs (40+) avec Mocks + Seeds

```bash
echo ""
echo "================================================"
echo "TACHE 3.3.13 : Tests E2E Exhaustifs (40+) avec Mocks + Seeds"
echo "Priorite : P0 | Effort : 8h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T13-F1: Existence fichier repo/apps/api/test/docs/{20 specs}.e2e-spec.ts
if [ -f "repo/apps/api/test/docs/{20 specs}.e2e-spec.ts" ]; then
  add_row "T13-F1" "Fichier {20 specs}.e2e-spec.ts existe" "PASS" "Cree"
else
  add_row "T13-F1" "Fichier {20 specs}.e2e-spec.ts existe" "FAIL" "Manquant"
fi
# Test T13-F2: Existence fichier repo/apps/api/test/signature/{20 specs}.e2e-spec.ts
if [ -f "repo/apps/api/test/signature/{20 specs}.e2e-spec.ts" ]; then
  add_row "T13-F2" "Fichier {20 specs}.e2e-spec.ts existe" "PASS" "Cree"
else
  add_row "T13-F2" "Fichier {20 specs}.e2e-spec.ts existe" "FAIL" "Manquant"
fi
# Test T13-F3: Existence fichier repo/apps/api/test/fixtures/mock-barid-server.ts
if [ -f "repo/apps/api/test/fixtures/mock-barid-server.ts" ]; then
  add_row "T13-F3" "Fichier mock-barid-server.ts existe" "PASS" "Cree"
else
  add_row "T13-F3" "Fichier mock-barid-server.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T13-V1: 40+ tests passent (P0)
echo "  Verifying T13-V1 : 40+ tests passent..."
add_row "T13-V1" "40+ tests passent" "WARN" "(P0) Voir B-10 Tache 3.3.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V2: Tests passent CI (P0)
echo "  Verifying T13-V2 : Tests passent CI..."
add_row "T13-V2" "Tests passent CI" "WARN" "(P0) Voir B-10 Tache 3.3.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V3: Mocks complets fonctionnels (P0)
echo "  Verifying T13-V3 : Mocks complets fonctionnels..."
add_row "T13-V3" "Mocks complets fonctionnels" "WARN" "(P0) Voir B-10 Tache 3.3.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V4: Snapshot tests detecte regressions PDF (P0)
echo "  Verifying T13-V4 : Snapshot tests detecte regressions PDF..."
add_row "T13-V4" "Snapshot tests detecte regressions PDF" "WARN" "(P0) Voir B-10 Tache 3.3.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V5: Reproducibility 5x runs (P0)
echo "  Verifying T13-V5 : Reproducibility 5x runs..."
add_row "T13-V5" "Reproducibility 5x runs" "WARN" "(P0) Voir B-10 Tache 3.3.13 pour test detaille - critere a auto-tester via script ad-hoc"

```

---


---


## VERIFICATIONS TRANSVERSALES SPRINT 10

### TR-BUILD : Build complet du sprint

```bash
echo ""
echo "================================================"
echo "VERIFICATIONS TRANSVERSALES SPRINT 10"
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

### TR-MIGRATIONS : Migrations DB Sprint 10

```bash
echo "=== TR-MIGRATIONS : Migrations DB ==="
MIGR_COUNT=$(pg_query "SELECT COUNT(*) FROM migrations WHERE name LIKE '%sprint10%' OR name LIKE '%Sprint10%'" || echo 0)
if [ "$MIGR_COUNT" -gt 0 ]; then
  add_row "TR-MIG" "Migrations Sprint 10 appliquees" "PASS" "$MIGR_COUNT migrations"
else
  add_row "TR-MIG" "Migrations Sprint 10 appliquees" "WARN" "Aucune migration detectee (verifier)"
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
echo "GENERATION DU RAPPORT FINAL SPRINT 10"
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

## Jalon GO/NO-GO Sprint 10

EOF

# Calcul statut final
if (( $(echo "$SCORE >= 95" | bc -l) )); then
  STATUT="GO"
  cat >> "$REPORT_FILE" << EOF
**STATUT** : GO -- Sprint 10 valide, passage Sprint 11 autorise

Le sprint a passe les criteres requis. Cowork peut demarrer Sprint 11.

EOF
  echo ""
  echo "================================================"
  echo "SPRINT 10 : GO ($SCORE%)"
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
  echo "SPRINT 10 : GO CONDITIONNEL ($SCORE%)"
  echo "================================================"
else
  STATUT="NO-GO"
  cat >> "$REPORT_FILE" << EOF
**STATUT** : NO-GO -- Score $SCORE% trop bas (cible 85% minimum)

Le sprint **doit etre repris** :
- Lister tous FAIL P0
- Escalation Saad/Abla decision (cut scope OR delai)
- Reprise sprint avant Sprint 11

EOF
  echo ""
  echo "================================================"
  echo "SPRINT 10 : NO-GO ($SCORE%)"
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
  echo "git commit -m \"chore(sprint-10): close sprint 10 -- $STATUT ($SCORE%)\"" >> "$REPORT_FILE"
  echo '```' >> "$REPORT_FILE"
fi

echo ""
echo "Rapport complet dans : $REPORT_FILE"
```

---

## INSTRUCTION FINALE A CLAUDE CODE / COWORK

Apres l'execution complete des verifications ci-dessus :

1. **Lis le contenu de `sprint10-verify-report.md`** integralement
2. **Identifie les FAIL critiques** (criteres P0) qui necessitent intervention manuelle
3. **Affiche un resume executif** :
   - Nombre total de criteres
   - Pourcentage PASS / PASS\* / FAIL / WARN
   - Liste des FAIL avec contexte technique
   - Recommandation : GO / GO CONDITIONNEL / NO-GO
4. **Si NO-GO** : ne pas demarrer le Sprint suivant, alerter Saad/Abla via Slack `#insurtech-dev`
5. **Si GO ou GO CONDITIONNEL** : produire le commit de cloture du sprint :

```bash
git add skalean-insurtech/sprint10-verify-report.md
git commit -m "chore(sprint-10): close sprint 10 with verification report

- Verification automatique executee
- Score global : <SCORE>%
- <PASS> criteres PASS, <PASS_REPAIRED> reparations auto, <FAIL> FAIL
- Statut : <GO|GO CONDITIONNEL|NO-GO>

Phase: 3 -- Modules Horizontaux
Sprint: 10 (Phase 3 / Sprint 3)
Reference B-10, C-10, V-10
Report: sprint10-verify-report.md"
```

6. **Documentation continue** : si decisions techniques prises pendant verification, ajouter notes dans `repo/docs/runbooks/sprint-10-lessons-learned.md`

---

**Fin de la verification V-10 v2.2 detaillee -- Sprint 10 (3.3) Docs + Signature loi 43-20.**

**Total criteres taches** : 91 | **Total transversaux** : ~10 | **Effort sprint** : 75h
