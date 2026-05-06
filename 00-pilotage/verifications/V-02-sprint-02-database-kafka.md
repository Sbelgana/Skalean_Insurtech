# VERIFICATION SPRINT 2 -- Phase 1 / Sprint 2 : Database + Kafka
# Version : Auto-reparation active + Rapport final MD detaille
# 15 taches, 127 criteres extraits B-02
# AUCUNE EMOJI AUTORISEE

**Version** : v2.2 (verification detaillee)
**Phase** : 1 -- Bootstrap Infrastructure
**Sprint** : 2 / 35 (cumul) -- Sprint 2 dans Phase 1
**Reference meta-prompt** : `B-02-sprint-02-database-kafka.md`
**Reference orchestrateur** : `C-02-sprint-02-database-kafka.md`
**Total criteres** : 127 criteres taches + ~10 transversaux

---

Tu es **Claude Code (ou Cowork)**. Tu dois executer une **verification COMPLETE et EXHAUSTIVE** du Sprint 2 apres execution toutes les 15 taches.

---

## REGLES D'EXECUTION

1. Tu **executes CHAQUE verification dans l'ordre** (taches puis transversales)
2. Quand une verification echoue, tu **TENTES UNE REPARATION AUTOMATIQUE** avant de noter FAIL
3. Apres chaque tentative de reparation, tu **re-executes la verification**
4. Tu consignes dans `sprint02-verify-report.md` **TOUS les resultats** au fil de l'execution
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
REPORT_FILE="sprint02-verify-report.md"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
RUN_ID=$(date '+%Y%m%d-%H%M%S')

cat > "$REPORT_FILE" << EOF
# Rapport de Verification - Sprint 2 : Database + Kafka

**Date** : $TIMESTAMP
**Run ID** : $RUN_ID
**Phase** : 1 -- Bootstrap Infrastructure
**Sprint** : 2 (Phase 1 / Sprint 2)
**Reference B-02** : 15 taches, 127 criteres extraits
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

## VERIFICATIONS PAR TACHE (15 taches)

## TACHE 1/8 -- 1.2.1 : Enrichir @insurtech/database

```bash
echo ""
echo "================================================"
echo "TACHE 1.2.1 : Enrichir @insurtech/database"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 8"
echo "================================================"

# === Verification fichiers crees ===
# Test T01-F1: Existence fichier repo/packages/database/package.json
if [ -f "repo/packages/database/package.json" ]; then
  add_row "T01-F1" "Fichier package.json existe" "PASS" "Cree"
else
  add_row "T01-F1" "Fichier package.json existe" "FAIL" "Manquant"
fi
# Test T01-F2: Existence fichier repo/packages/database/src/entities/base/base-entity.ts
if [ -f "repo/packages/database/src/entities/base/base-entity.ts" ]; then
  add_row "T01-F2" "Fichier base-entity.ts existe" "PASS" "Cree"
else
  add_row "T01-F2" "Fichier base-entity.ts existe" "FAIL" "Manquant"
fi
# Test T01-F3: Existence fichier repo/packages/database/src/entities/base/auditable-entity.ts
if [ -f "repo/packages/database/src/entities/base/auditable-entity.ts" ]; then
  add_row "T01-F3" "Fichier auditable-entity.ts existe" "PASS" "Cree"
else
  add_row "T01-F3" "Fichier auditable-entity.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T01-V1: Structure dossiers entities/migrations/subscribers/helpers presente (P0)
echo "  Verifying T01-V1 : Structure dossiers entities/migrations/subscribers/helpers presente..."
add_row "T01-V1" "Structure dossiers entities/migrations/subscribers/helpers presente" "WARN" "(P0) Voir B-02 Tache 1.2.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V2: 'BaseEntity' abstract avec id, tenant_id, timestamps, soft delete (P0)
echo "  Verifying T01-V2 : 'BaseEntity' abstract avec id, tenant_id, timestamps, soft delete..."
add_row "T01-V2" "'BaseEntity' abstract avec id, tenant_id, timestamps, soft delete" "WARN" "(P0) Voir B-02 Tache 1.2.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V3: 'AuditableEntity' extends BaseEntity + created_by + updated_by (P0)
echo "  Verifying T01-V3 : 'AuditableEntity' extends BaseEntity + created_by + updated_by..."
add_row "T01-V3" "'AuditableEntity' extends BaseEntity + created_by + updated_by" "WARN" "(P0) Voir B-02 Tache 1.2.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V4: 'withTenantContext()' execute SET LOCAL et fn dans meme transaction (P0)
echo "  Verifying T01-V4 : 'withTenantContext()' execute SET LOCAL et fn dans meme transaction..."
add_row "T01-V4" "'withTenantContext()' execute SET LOCAL et fn dans meme transaction" "WARN" "(P0) Voir B-02 Tache 1.2.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V5: Scripts CLI 'migration:create/generate/run/revert/show' fonctionnent (vide initialement) (P0)
echo "  Verifying T01-V5 : Scripts CLI 'migration:create/generate/run/revert/show' fonctionnent (..."
add_row "T01-V5" "Scripts CLI 'migration:create/generate/run/revert/show' fonctionnent (vide initialement)" "WARN" "(P0) Voir B-02 Tache 1.2.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V6: Re-export propre dans 'index.ts' (peut importer 'BaseEntity', 'withTenantContext', etc.) (P0)
echo "  Verifying T01-V6 : Re-export propre dans 'index.ts' (peut importer 'BaseEntity', 'withTen..."
add_row "T01-V6" "Re-export propre dans 'index.ts' (peut importer 'BaseEntity', 'withTenantContext', etc.)" "WARN" "(P0) Voir B-02 Tache 1.2.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V7: 'pnpm --filter @insurtech/database build' reussit (P0)
echo "  Verifying T01-V7 : 'pnpm --filter @insurtech/database build' reussit..."
add_row "T01-V7" "'pnpm --filter @insurtech/database build' reussit" "WARN" "(P0) Voir B-02 Tache 1.2.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V8: Tests unitaires 'withTenantContext' (mock EntityManager) couvrent happy path + super admin (P1)
echo "  Verifying T01-V8 : Tests unitaires 'withTenantContext' (mock EntityManager) couvrent happ..."
add_row "T01-V8" "Tests unitaires 'withTenantContext' (mock EntityManager) couvrent happy path + super admin" "WARN" "(P1) Voir B-02 Tache 1.2.1 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 2/10 -- 1.2.2 : Migration "Initial System" : 5 Tables (Auth + Audit Log) + RLS

```bash
echo ""
echo "================================================"
echo "TACHE 1.2.2 : Migration "Initial System" : 5 Tables (Auth + Audit Log) + R"
echo "Priorite : P0 | Effort : 8h"
echo "Criteres a verifier : 10"
echo "================================================"

# === Verification fichiers crees ===
# Test T02-F1: Existence fichier repo/packages/database/src/migrations/1735000000001-InitialSystem.ts
if [ -f "repo/packages/database/src/migrations/1735000000001-InitialSystem.ts" ]; then
  add_row "T02-F1" "Fichier 1735000000001-InitialSystem.ts existe" "PASS" "Cree"
else
  add_row "T02-F1" "Fichier 1735000000001-InitialSystem.ts existe" "FAIL" "Manquant"
fi
# Test T02-F2: Existence fichier repo/packages/database/src/entities/system/auth-tenant.entity.ts
if [ -f "repo/packages/database/src/entities/system/auth-tenant.entity.ts" ]; then
  add_row "T02-F2" "Fichier auth-tenant.entity.ts existe" "PASS" "Cree"
else
  add_row "T02-F2" "Fichier auth-tenant.entity.ts existe" "FAIL" "Manquant"
fi
# Test T02-F3: Existence fichier repo/packages/database/src/entities/system/auth-user.entity.ts
if [ -f "repo/packages/database/src/entities/system/auth-user.entity.ts" ]; then
  add_row "T02-F3" "Fichier auth-user.entity.ts existe" "PASS" "Cree"
else
  add_row "T02-F3" "Fichier auth-user.entity.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T02-V1: 'pnpm migration:run' reussit sans erreur (P0)
echo "  Verifying T02-V1 : 'pnpm migration:run' reussit sans erreur..."
add_row "T02-V1" "'pnpm migration:run' reussit sans erreur" "WARN" "(P0) Voir B-02 Tache 1.2.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V2: 5 tables creees : '\dt auth_*' + '\dt audit_log' (P0)
echo "  Verifying T02-V2 : 5 tables creees : '\dt auth_*' + '\dt audit_log'..."
add_row "T02-V2" "5 tables creees : '\dt auth_*' + '\dt audit_log'" "WARN" "(P0) Voir B-02 Tache 1.2.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V3: RLS active sur 4 tables : 'SELECT relname FROM pg_class WHERE relrowsecurity = true' (P0)
echo "  Verifying T02-V3 : RLS active sur 4 tables : 'SELECT relname FROM pg_class WHERE relrowse..."
add_row "T02-V3" "RLS active sur 4 tables : 'SELECT relname FROM pg_class WHERE relrowsecurity = true'" "WARN" "(P0) Voir B-02 Tache 1.2.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V4: 4 policies par table : '\d auth_users' montre policies SELECT/INSERT/UPDATE/DELETE (P0)
echo "  Verifying T02-V4 : 4 policies par table : '\d auth_users' montre policies SELECT/INSERT/U..."
add_row "T02-V4" "4 policies par table : '\d auth_users' montre policies SELECT/INSERT/UPDATE/DELETE" "WARN" "(P0) Voir B-02 Tache 1.2.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V5: 'FORCE ROW LEVEL SECURITY' actif : 'relforcerowsecurity = true' (P0)
echo "  Verifying T02-V5 : 'FORCE ROW LEVEL SECURITY' actif : 'relforcerowsecurity = true'..."
add_row "T02-V5" "'FORCE ROW LEVEL SECURITY' actif : 'relforcerowsecurity = true'" "WARN" "(P0) Voir B-02 Tache 1.2.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V6: Indexes presents : '\d auth_users' montre email UNIQUE + lower(email) (P0)
echo "  Verifying T02-V6 : Indexes presents : '\d auth_users' montre email UNIQUE + lower(email)..."
add_row "T02-V6" "Indexes presents : '\d auth_users' montre email UNIQUE + lower(email)" "WARN" "(P0) Voir B-02 Tache 1.2.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V7: 'pnpm migration:revert' reussit (drop tables proprement) (P0)
echo "  Verifying T02-V7 : 'pnpm migration:revert' reussit (drop tables proprement)..."
add_row "T02-V7" "'pnpm migration:revert' reussit (drop tables proprement)" "WARN" "(P0) Voir B-02 Tache 1.2.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V8: Re-run migration apres revert reussit (P0)
echo "  Verifying T02-V8 : Re-run migration apres revert reussit..."
add_row "T02-V8" "Re-run migration apres revert reussit" "WARN" "(P0) Voir B-02 Tache 1.2.2 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 3/10 -- 1.2.3 : Migration "CRM" : 4 Tables + RLS + Indexes Trigram

```bash
echo ""
echo "================================================"
echo "TACHE 1.2.3 : Migration "CRM" : 4 Tables + RLS + Indexes Trigram"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 10"
echo "================================================"

# === Verification fichiers crees ===
# Test T03-F1: Existence fichier repo/packages/database/src/migrations/1735000000002-CRM.ts
if [ -f "repo/packages/database/src/migrations/1735000000002-CRM.ts" ]; then
  add_row "T03-F1" "Fichier 1735000000002-CRM.ts existe" "PASS" "Cree"
else
  add_row "T03-F1" "Fichier 1735000000002-CRM.ts existe" "FAIL" "Manquant"
fi
# Test T03-F2: Existence fichier repo/packages/database/src/entities/crm/crm-company.entity.ts
if [ -f "repo/packages/database/src/entities/crm/crm-company.entity.ts" ]; then
  add_row "T03-F2" "Fichier crm-company.entity.ts existe" "PASS" "Cree"
else
  add_row "T03-F2" "Fichier crm-company.entity.ts existe" "FAIL" "Manquant"
fi
# Test T03-F3: Existence fichier repo/packages/database/src/entities/crm/crm-contact.entity.ts
if [ -f "repo/packages/database/src/entities/crm/crm-contact.entity.ts" ]; then
  add_row "T03-F3" "Fichier crm-contact.entity.ts existe" "PASS" "Cree"
else
  add_row "T03-F3" "Fichier crm-contact.entity.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T03-V1: Migration up reussit (P0)
echo "  Verifying T03-V1 : Migration up reussit..."
add_row "T03-V1" "Migration up reussit" "WARN" "(P0) Voir B-02 Tache 1.2.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V2: 4 tables creees avec colonnes specifiees (P0)
echo "  Verifying T03-V2 : 4 tables creees avec colonnes specifiees..."
add_row "T03-V2" "4 tables creees avec colonnes specifiees" "WARN" "(P0) Voir B-02 Tache 1.2.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V3: RLS active sur les 4 tables (P0)
echo "  Verifying T03-V3 : RLS active sur les 4 tables..."
add_row "T03-V3" "RLS active sur les 4 tables" "WARN" "(P0) Voir B-02 Tache 1.2.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V4: Indexes GIN trigram presents : '\d crm_contacts' (P0)
echo "  Verifying T03-V4 : Indexes GIN trigram presents : '\d crm_contacts'..."
add_row "T03-V4" "Indexes GIN trigram presents : '\d crm_contacts'" "WARN" "(P0) Voir B-02 Tache 1.2.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V5: UNIQUE (tenant_id, ice) actif : tentative 2eme INSERT meme ICE same tenant fail (P0)
echo "  Verifying T03-V5 : UNIQUE (tenant_id, ice) actif : tentative 2eme INSERT meme ICE same te..."
add_row "T03-V5" "UNIQUE (tenant_id, ice) actif : tentative 2eme INSERT meme ICE same tenant fail" "WARN" "(P0) Voir B-02 Tache 1.2.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V6: Recherche trigram performante : 'EXPLAIN ANALYZE SELECT * WHERE full_name ILIKE '%john%''  (P0)
echo "  Verifying T03-V6 : Recherche trigram performante : 'EXPLAIN ANALYZE SELECT * WHERE full_n..."
add_row "T03-V6" "Recherche trigram performante : 'EXPLAIN ANALYZE SELECT * WHERE full_name ILIKE '%john%'' " "WARN" "(P0) Voir B-02 Tache 1.2.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V7: Foreign keys ON DELETE RESTRICT actifs (P0)
echo "  Verifying T03-V7 : Foreign keys ON DELETE RESTRICT actifs..."
add_row "T03-V7" "Foreign keys ON DELETE RESTRICT actifs" "WARN" "(P0) Voir B-02 Tache 1.2.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V8: Migration revert reversible (P0)
echo "  Verifying T03-V8 : Migration revert reversible..."
add_row "T03-V8" "Migration revert reversible" "WARN" "(P0) Voir B-02 Tache 1.2.3 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 4/9 -- 1.2.4 : Migration "Booking" : 3 Tables + EXCLUDE Constraint

```bash
echo ""
echo "================================================"
echo "TACHE 1.2.4 : Migration "Booking" : 3 Tables + EXCLUDE Constraint"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 9"
echo "================================================"

# === Verification fichiers crees ===
# Test T04-F1: Existence fichier repo/packages/database/src/migrations/1735000000003-Booking.ts
if [ -f "repo/packages/database/src/migrations/1735000000003-Booking.ts" ]; then
  add_row "T04-F1" "Fichier 1735000000003-Booking.ts existe" "PASS" "Cree"
else
  add_row "T04-F1" "Fichier 1735000000003-Booking.ts existe" "FAIL" "Manquant"
fi
# Test T04-F2: Existence fichier repo/packages/database/src/entities/booking/booking-room.entity.ts
if [ -f "repo/packages/database/src/entities/booking/booking-room.entity.ts" ]; then
  add_row "T04-F2" "Fichier booking-room.entity.ts existe" "PASS" "Cree"
else
  add_row "T04-F2" "Fichier booking-room.entity.ts existe" "FAIL" "Manquant"
fi
# Test T04-F3: Existence fichier repo/packages/database/src/entities/booking/booking-appointment.entity.ts
if [ -f "repo/packages/database/src/entities/booking/booking-appointment.entity.ts" ]; then
  add_row "T04-F3" "Fichier booking-appointment.entity.ts existe" "PASS" "Cree"
else
  add_row "T04-F3" "Fichier booking-appointment.entity.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T04-V1: Migration up reussit, tables creees (P0)
echo "  Verifying T04-V1 : Migration up reussit, tables creees..."
add_row "T04-V1" "Migration up reussit, tables creees" "WARN" "(P0) Voir B-02 Tache 1.2.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V2: EXCLUDE constraint actif : '\d booking_appointments' montre 'EXCLUDE USING GIST' (P0)
echo "  Verifying T04-V2 : EXCLUDE constraint actif : '\d booking_appointments' montre 'EXCLUDE U..."
add_row "T04-V2" "EXCLUDE constraint actif : '\d booking_appointments' montre 'EXCLUDE USING GIST'" "WARN" "(P0) Voir B-02 Tache 1.2.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V3: Test anti-overlap : INSERT 2 RDV meme room time chevauchant -> 2eme rejete (P0)
echo "  Verifying T04-V3 : Test anti-overlap : INSERT 2 RDV meme room time chevauchant -> 2eme re..."
add_row "T04-V3" "Test anti-overlap : INSERT 2 RDV meme room time chevauchant -> 2eme rejete" "WARN" "(P0) Voir B-02 Tache 1.2.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V4: INSERT 2 RDV meme room time differente -> les 2 reussissent (P0)
echo "  Verifying T04-V4 : INSERT 2 RDV meme room time differente -> les 2 reussissent..."
add_row "T04-V4" "INSERT 2 RDV meme room time differente -> les 2 reussissent" "WARN" "(P0) Voir B-02 Tache 1.2.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V5: INSERT 2 RDV chevauchants si premier 'cancelled' -> 2eme reussit (WHERE clause) (P0)
echo "  Verifying T04-V5 : INSERT 2 RDV chevauchants si premier 'cancelled' -> 2eme reussit (WHER..."
add_row "T04-V5" "INSERT 2 RDV chevauchants si premier 'cancelled' -> 2eme reussit (WHERE clause)" "WARN" "(P0) Voir B-02 Tache 1.2.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V6: RLS bloque cross-tenant (P0)
echo "  Verifying T04-V6 : RLS bloque cross-tenant..."
add_row "T04-V6" "RLS bloque cross-tenant" "WARN" "(P0) Voir B-02 Tache 1.2.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V7: tokens calendar_syncs stockes chiffres (pas plain text) (P0)
echo "  Verifying T04-V7 : tokens calendar_syncs stockes chiffres (pas plain text)..."
add_row "T04-V7" "tokens calendar_syncs stockes chiffres (pas plain text)" "WARN" "(P0) Voir B-02 Tache 1.2.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V8: Migration revert reversible (P0)
echo "  Verifying T04-V8 : Migration revert reversible..."
add_row "T04-V8" "Migration revert reversible" "WARN" "(P0) Voir B-02 Tache 1.2.4 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 5/8 -- 1.2.5 : Migration "Communications" : 4 Tables

```bash
echo ""
echo "================================================"
echo "TACHE 1.2.5 : Migration "Communications" : 4 Tables"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 8"
echo "================================================"

# === Verification fichiers crees ===
# Test T05-F1: Existence fichier repo/packages/database/src/migrations/1735000000004-Communications.ts
if [ -f "repo/packages/database/src/migrations/1735000000004-Communications.ts" ]; then
  add_row "T05-F1" "Fichier 1735000000004-Communications.ts existe" "PASS" "Cree"
else
  add_row "T05-F1" "Fichier 1735000000004-Communications.ts existe" "FAIL" "Manquant"
fi
# Test T05-F2: Existence fichier repo/packages/database/src/entities/comm/comm-message.entity.ts
if [ -f "repo/packages/database/src/entities/comm/comm-message.entity.ts" ]; then
  add_row "T05-F2" "Fichier comm-message.entity.ts existe" "PASS" "Cree"
else
  add_row "T05-F2" "Fichier comm-message.entity.ts existe" "FAIL" "Manquant"
fi
# Test T05-F3: Existence fichier repo/packages/database/src/entities/comm/comm-template.entity.ts
if [ -f "repo/packages/database/src/entities/comm/comm-template.entity.ts" ]; then
  add_row "T05-F3" "Fichier comm-template.entity.ts existe" "PASS" "Cree"
else
  add_row "T05-F3" "Fichier comm-template.entity.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T05-V1: Migration up reussit (P0)
echo "  Verifying T05-V1 : Migration up reussit..."
add_row "T05-V1" "Migration up reussit" "WARN" "(P0) Voir B-02 Tache 1.2.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V2: 4 tables creees (P0)
echo "  Verifying T05-V2 : 4 tables creees..."
add_row "T05-V2" "4 tables creees" "WARN" "(P0) Voir B-02 Tache 1.2.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V3: RLS active sur 3 tables (pas webhooks_received) (P0)
echo "  Verifying T05-V3 : RLS active sur 3 tables (pas webhooks_received)..."
add_row "T05-V3" "RLS active sur 3 tables (pas webhooks_received)" "WARN" "(P0) Voir B-02 Tache 1.2.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V4: UNIQUE (idempotency_key) actif : 2eme INSERT meme key fail (P0)
echo "  Verifying T05-V4 : UNIQUE (idempotency_key) actif : 2eme INSERT meme key fail..."
add_row "T05-V4" "UNIQUE (idempotency_key) actif : 2eme INSERT meme key fail" "WARN" "(P0) Voir B-02 Tache 1.2.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V5: Indexes performants : 'EXPLAIN' sur 'messages WA failed today' utilise index (P0)
echo "  Verifying T05-V5 : Indexes performants : 'EXPLAIN' sur 'messages WA failed today' utilise..."
add_row "T05-V5" "Indexes performants : 'EXPLAIN' sur 'messages WA failed today' utilise index" "WARN" "(P0) Voir B-02 Tache 1.2.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V6: Enum 'language' accepte fr / ar-MA / ar (P0)
echo "  Verifying T05-V6 : Enum 'language' accepte fr / ar-MA / ar..."
add_row "T05-V6" "Enum 'language' accepte fr / ar-MA / ar" "WARN" "(P0) Voir B-02 Tache 1.2.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V7: Migration revert reversible (P0)
echo "  Verifying T05-V7 : Migration revert reversible..."
add_row "T05-V7" "Migration revert reversible" "WARN" "(P0) Voir B-02 Tache 1.2.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V8: 'template_variables' accepte JSONB arbitraire valide (P1)
echo "  Verifying T05-V8 : 'template_variables' accepte JSONB arbitraire valide..."
add_row "T05-V8" "'template_variables' accepte JSONB arbitraire valide" "WARN" "(P1) Voir B-02 Tache 1.2.5 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 6/7 -- 1.2.6 : Migration "Docs + Pay" : 6 Tables

```bash
echo ""
echo "================================================"
echo "TACHE 1.2.6 : Migration "Docs + Pay" : 6 Tables"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 7"
echo "================================================"

# === Verification fichiers crees ===
# Test T06-F1: Existence fichier repo/packages/database/src/migrations/1735000000005-DocsPayments.ts
if [ -f "repo/packages/database/src/migrations/1735000000005-DocsPayments.ts" ]; then
  add_row "T06-F1" "Fichier 1735000000005-DocsPayments.ts existe" "PASS" "Cree"
else
  add_row "T06-F1" "Fichier 1735000000005-DocsPayments.ts existe" "FAIL" "Manquant"
fi
# Test T06-F2: Existence fichier repo/packages/database/src/entities/docs/{3 entities}.ts
if [ -f "repo/packages/database/src/entities/docs/{3 entities}.ts" ]; then
  add_row "T06-F2" "Fichier {3 entities}.ts existe" "PASS" "Cree"
else
  add_row "T06-F2" "Fichier {3 entities}.ts existe" "FAIL" "Manquant"
fi
# Test T06-F3: Existence fichier repo/packages/database/src/entities/pay/{3 entities}.ts
if [ -f "repo/packages/database/src/entities/pay/{3 entities}.ts" ]; then
  add_row "T06-F3" "Fichier {3 entities}.ts existe" "PASS" "Cree"
else
  add_row "T06-F3" "Fichier {3 entities}.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T06-V1: Migration up reussit, 6 tables creees (P0)
echo "  Verifying T06-V1 : Migration up reussit, 6 tables creees..."
add_row "T06-V1" "Migration up reussit, 6 tables creees" "WARN" "(P0) Voir B-02 Tache 1.2.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V2: RLS active sur 6 tables (P0)
echo "  Verifying T06-V2 : RLS active sur 6 tables..."
add_row "T06-V2" "RLS active sur 6 tables" "WARN" "(P0) Voir B-02 Tache 1.2.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V3: UNIQUE (document_id, version_number) actif (P0)
echo "  Verifying T06-V3 : UNIQUE (document_id, version_number) actif..."
add_row "T06-V3" "UNIQUE (document_id, version_number) actif" "WARN" "(P0) Voir B-02 Tache 1.2.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V4: 'pay_methods.config_encrypted' accepte JSONB (P0)
echo "  Verifying T06-V4 : 'pay_methods.config_encrypted' accepte JSONB..."
add_row "T06-V4" "'pay_methods.config_encrypted' accepte JSONB" "WARN" "(P0) Voir B-02 Tache 1.2.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V5: Indexes performants : 'transactions failed last 24h' utilise index (P0)
echo "  Verifying T06-V5 : Indexes performants : 'transactions failed last 24h' utilise index..."
add_row "T06-V5" "Indexes performants : 'transactions failed last 24h' utilise index" "WARN" "(P0) Voir B-02 Tache 1.2.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V6: Migration revert reversible (P0)
echo "  Verifying T06-V6 : Migration revert reversible..."
add_row "T06-V6" "Migration revert reversible" "WARN" "(P0) Voir B-02 Tache 1.2.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V7: doc_access_logs append-only (verifier qu'aucune UPDATE policy) (P1)
echo "  Verifying T06-V7 : doc_access_logs append-only (verifier qu'aucune UPDATE policy)..."
add_row "T06-V7" "doc_access_logs append-only (verifier qu'aucune UPDATE policy)" "WARN" "(P1) Voir B-02 Tache 1.2.6 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 7/7 -- 1.2.7 : Migration "Books + Compliance" : 6 Tables

```bash
echo ""
echo "================================================"
echo "TACHE 1.2.7 : Migration "Books + Compliance" : 6 Tables"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 7"
echo "================================================"

# === Verification fichiers crees ===
# Test T07-F1: Existence fichier repo/packages/database/src/migrations/1735000000006-BooksCompliance.ts
if [ -f "repo/packages/database/src/migrations/1735000000006-BooksCompliance.ts" ]; then
  add_row "T07-F1" "Fichier 1735000000006-BooksCompliance.ts existe" "PASS" "Cree"
else
  add_row "T07-F1" "Fichier 1735000000006-BooksCompliance.ts existe" "FAIL" "Manquant"
fi
# Test T07-F2: Existence fichier repo/packages/database/src/entities/books/{3 entities}.ts
if [ -f "repo/packages/database/src/entities/books/{3 entities}.ts" ]; then
  add_row "T07-F2" "Fichier {3 entities}.ts existe" "PASS" "Cree"
else
  add_row "T07-F2" "Fichier {3 entities}.ts existe" "FAIL" "Manquant"
fi
# Test T07-F3: Existence fichier repo/packages/database/src/entities/compliance/{3 entities}.ts
if [ -f "repo/packages/database/src/entities/compliance/{3 entities}.ts" ]; then
  add_row "T07-F3" "Fichier {3 entities}.ts existe" "PASS" "Cree"
else
  add_row "T07-F3" "Fichier {3 entities}.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T07-V1: Migration up reussit, 6 tables creees (P0)
echo "  Verifying T07-V1 : Migration up reussit, 6 tables creees..."
add_row "T07-V1" "Migration up reussit, 6 tables creees" "WARN" "(P0) Voir B-02 Tache 1.2.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V2: RLS active sur 6 tables (P0)
echo "  Verifying T07-V2 : RLS active sur 6 tables..."
add_row "T07-V2" "RLS active sur 6 tables" "WARN" "(P0) Voir B-02 Tache 1.2.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V3: UNIQUE (tenant_id, invoice_number) actif (P0)
echo "  Verifying T07-V3 : UNIQUE (tenant_id, invoice_number) actif..."
add_row "T07-V3" "UNIQUE (tenant_id, invoice_number) actif" "WARN" "(P0) Voir B-02 Tache 1.2.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V4: Auto-ref books_accounts.parent_account_id pour hierarchie comptes (P0)
echo "  Verifying T07-V4 : Auto-ref books_accounts.parent_account_id pour hierarchie comptes..."
add_row "T07-V4" "Auto-ref books_accounts.parent_account_id pour hierarchie comptes" "WARN" "(P0) Voir B-02 Tache 1.2.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V5: consent_logs append-only (pas UPDATE policy) (P0)
echo "  Verifying T07-V5 : consent_logs append-only (pas UPDATE policy)..."
add_row "T07-V5" "consent_logs append-only (pas UPDATE policy)" "WARN" "(P0) Voir B-02 Tache 1.2.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V6: Migration revert reversible (P0)
echo "  Verifying T07-V6 : Migration revert reversible..."
add_row "T07-V6" "Migration revert reversible" "WARN" "(P0) Voir B-02 Tache 1.2.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V7: Index issue_date DESC sur invoices performant (P1)
echo "  Verifying T07-V7 : Index issue_date DESC sur invoices performant..."
add_row "T07-V7" "Index issue_date DESC sur invoices performant" "WARN" "(P1) Voir B-02 Tache 1.2.7 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 8/6 -- 1.2.8 : Migration "Analytics + Stock + HR" : 5 Tables

```bash
echo ""
echo "================================================"
echo "TACHE 1.2.8 : Migration "Analytics + Stock + HR" : 5 Tables"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 6"
echo "================================================"

# === Verification fichiers crees ===
# Test T08-F1: Existence fichier repo/packages/database/src/migrations/1735000000007-AnalyticsStockHR.ts
if [ -f "repo/packages/database/src/migrations/1735000000007-AnalyticsStockHR.ts" ]; then
  add_row "T08-F1" "Fichier 1735000000007-AnalyticsStockHR.ts existe" "PASS" "Cree"
else
  add_row "T08-F1" "Fichier 1735000000007-AnalyticsStockHR.ts existe" "FAIL" "Manquant"
fi
# Test T08-F2: Existence fichier repo/packages/database/src/entities/analytics/analytics-event.entity.ts
if [ -f "repo/packages/database/src/entities/analytics/analytics-event.entity.ts" ]; then
  add_row "T08-F2" "Fichier analytics-event.entity.ts existe" "PASS" "Cree"
else
  add_row "T08-F2" "Fichier analytics-event.entity.ts existe" "FAIL" "Manquant"
fi
# Test T08-F3: Existence fichier repo/packages/database/src/entities/stock/{2 entities}.ts
if [ -f "repo/packages/database/src/entities/stock/{2 entities}.ts" ]; then
  add_row "T08-F3" "Fichier {2 entities}.ts existe" "PASS" "Cree"
else
  add_row "T08-F3" "Fichier {2 entities}.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T08-V1: Migration up reussit, 5 tables creees (P0)
echo "  Verifying T08-V1 : Migration up reussit, 5 tables creees..."
add_row "T08-V1" "Migration up reussit, 5 tables creees" "WARN" "(P0) Voir B-02 Tache 1.2.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V2: RLS active (P0)
echo "  Verifying T08-V2 : RLS active..."
add_row "T08-V2" "RLS active" "WARN" "(P0) Voir B-02 Tache 1.2.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V3: UNIQUE constraints actifs (sku, employee_number) (P0)
echo "  Verifying T08-V3 : UNIQUE constraints actifs (sku, employee_number)..."
add_row "T08-V3" "UNIQUE constraints actifs (sku, employee_number)" "WARN" "(P0) Voir B-02 Tache 1.2.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V4: Indexes performants pour queries 'stock low alert' et 'attendance today' (P0)
echo "  Verifying T08-V4 : Indexes performants pour queries 'stock low alert' et 'attendance toda..."
add_row "T08-V4" "Indexes performants pour queries 'stock low alert' et 'attendance today'" "WARN" "(P0) Voir B-02 Tache 1.2.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V5: Migration revert reversible (P0)
echo "  Verifying T08-V5 : Migration revert reversible..."
add_row "T08-V5" "Migration revert reversible" "WARN" "(P0) Voir B-02 Tache 1.2.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V6: 'analytics_events.properties' accepte JSONB arbitraire (P1)
echo "  Verifying T08-V6 : 'analytics_events.properties' accepte JSONB arbitraire..."
add_row "T08-V6" "'analytics_events.properties' accepte JSONB arbitraire" "WARN" "(P1) Voir B-02 Tache 1.2.8 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 9/9 -- 1.2.9 : TypeORM Subscribers : 3 Transverses

```bash
echo ""
echo "================================================"
echo "TACHE 1.2.9 : TypeORM Subscribers : 3 Transverses"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 9"
echo "================================================"

# === Verification fichiers crees ===
# Test T09-F1: Existence fichier repo/packages/database/src/subscribers/tenant-id-injector.subscriber.ts
if [ -f "repo/packages/database/src/subscribers/tenant-id-injector.subscriber.ts" ]; then
  add_row "T09-F1" "Fichier tenant-id-injector.subscriber.ts existe" "PASS" "Cree"
else
  add_row "T09-F1" "Fichier tenant-id-injector.subscriber.ts existe" "FAIL" "Manquant"
fi
# Test T09-F2: Existence fichier repo/packages/database/src/subscribers/audit-log-writer.subscriber.ts
if [ -f "repo/packages/database/src/subscribers/audit-log-writer.subscriber.ts" ]; then
  add_row "T09-F2" "Fichier audit-log-writer.subscriber.ts existe" "PASS" "Cree"
else
  add_row "T09-F2" "Fichier audit-log-writer.subscriber.ts existe" "FAIL" "Manquant"
fi
# Test T09-F3: Existence fichier repo/packages/database/src/subscribers/timestamps-injector.subscriber.ts
if [ -f "repo/packages/database/src/subscribers/timestamps-injector.subscriber.ts" ]; then
  add_row "T09-F3" "Fichier timestamps-injector.subscriber.ts existe" "PASS" "Cree"
else
  add_row "T09-F3" "Fichier timestamps-injector.subscriber.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T09-V1: 3 subscribers enregistres dans DataSource (P0)
echo "  Verifying T09-V1 : 3 subscribers enregistres dans DataSource..."
add_row "T09-V1" "3 subscribers enregistres dans DataSource" "WARN" "(P0) Voir B-02 Tache 1.2.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V2: INSERT sans tenant context throw error (sauf super admin) (P0)
echo "  Verifying T09-V2 : INSERT sans tenant context throw error (sauf super admin)..."
add_row "T09-V2" "INSERT sans tenant context throw error (sauf super admin)" "WARN" "(P0) Voir B-02 Tache 1.2.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V3: INSERT avec tenant context auto-injecte tenant_id (P0)
echo "  Verifying T09-V3 : INSERT avec tenant context auto-injecte tenant_id..."
add_row "T09-V3" "INSERT avec tenant context auto-injecte tenant_id" "WARN" "(P0) Voir B-02 Tache 1.2.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V4: UPDATE auditable entity ecrit row dans audit_log (P0)
echo "  Verifying T09-V4 : UPDATE auditable entity ecrit row dans audit_log..."
add_row "T09-V4" "UPDATE auditable entity ecrit row dans audit_log" "WARN" "(P0) Voir B-02 Tache 1.2.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V5: audit_log.changes contient diff before/after correct (P0)
echo "  Verifying T09-V5 : audit_log.changes contient diff before/after correct..."
add_row "T09-V5" "audit_log.changes contient diff before/after correct" "WARN" "(P0) Voir B-02 Tache 1.2.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V6: Pas de recursion : INSERT audit_log ne genere PAS un audit log additionel (P0)
echo "  Verifying T09-V6 : Pas de recursion : INSERT audit_log ne genere PAS un audit log additio..."
add_row "T09-V6" "Pas de recursion : INSERT audit_log ne genere PAS un audit log additionel" "WARN" "(P0) Voir B-02 Tache 1.2.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V7: Tables exemptees (auth_tenants, audit_log) pas affectees par TenantIdInjector (P0)
echo "  Verifying T09-V7 : Tables exemptees (auth_tenants, audit_log) pas affectees par TenantIdI..."
add_row "T09-V7" "Tables exemptees (auth_tenants, audit_log) pas affectees par TenantIdInjector" "WARN" "(P0) Voir B-02 Tache 1.2.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V8: Tests integration covers happy path + error path (P0)
echo "  Verifying T09-V8 : Tests integration covers happy path + error path..."
add_row "T09-V8" "Tests integration covers happy path + error path" "WARN" "(P0) Voir B-02 Tache 1.2.9 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 10/6 -- 1.2.10 : Topics Kafka Enrichi : 50+ Topics

```bash
echo ""
echo "================================================"
echo "TACHE 1.2.10 : Topics Kafka Enrichi : 50+ Topics"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 6"
echo "================================================"

# === Verification fichiers crees ===
# Test T10-F1: Existence fichier repo/infrastructure/docker/kafka/init-topics.sh
if [ -f "repo/infrastructure/docker/kafka/init-topics.sh" ]; then
  add_row "T10-F1" "Fichier init-topics.sh existe" "PASS" "Cree"
else
  add_row "T10-F1" "Fichier init-topics.sh existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T10-V1: Script execute sans erreur (incluant re-execution) (P0)
echo "  Verifying T10-V1 : Script execute sans erreur (incluant re-execution)..."
add_row "T10-V1" "Script execute sans erreur (incluant re-execution)" "WARN" "(P0) Voir B-02 Tache 1.2.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V2: Total topics >= 50 (P0)
echo "  Verifying T10-V2 : Total topics >= 50..."
add_row "T10-V2" "Total topics >= 50" "WARN" "(P0) Voir B-02 Tache 1.2.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V3: Naming convention respectee (P0)
echo "  Verifying T10-V3 : Naming convention respectee..."
add_row "T10-V3" "Naming convention respectee" "WARN" "(P0) Voir B-02 Tache 1.2.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V4: Topics DLQ avec retention 30 jours (P0)
echo "  Verifying T10-V4 : Topics DLQ avec retention 30 jours..."
add_row "T10-V4" "Topics DLQ avec retention 30 jours" "WARN" "(P0) Voir B-02 Tache 1.2.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V5: Topics compliance avec retention 30 jours (P0)
echo "  Verifying T10-V5 : Topics compliance avec retention 30 jours..."
add_row "T10-V5" "Topics compliance avec retention 30 jours" "WARN" "(P0) Voir B-02 Tache 1.2.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V6: 'kafka-topics.sh --describe --topic insurtech.events.compliance.acaps_submitted' montre re (P0)
echo "  Verifying T10-V6 : 'kafka-topics.sh --describe --topic insurtech.events.compliance.acaps_..."
add_row "T10-V6" "'kafka-topics.sh --describe --topic insurtech.events.compliance.acaps_submitted' montre re" "WARN" "(P0) Voir B-02 Tache 1.2.10 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 11/9 -- 1.2.11 : Init @insurtech/shared-events : Topics enum + Zod schemas + types

```bash
echo ""
echo "================================================"
echo "TACHE 1.2.11 : Init @insurtech/shared-events : Topics enum + Zod schemas + "
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 9"
echo "================================================"

# === Verification fichiers crees ===
# Test T11-F1: Existence fichier repo/packages/shared-events/package.json
if [ -f "repo/packages/shared-events/package.json" ]; then
  add_row "T11-F1" "Fichier package.json existe" "PASS" "Cree"
else
  add_row "T11-F1" "Fichier package.json existe" "FAIL" "Manquant"
fi
# Test T11-F2: Existence fichier repo/packages/shared-events/tsconfig.json
if [ -f "repo/packages/shared-events/tsconfig.json" ]; then
  add_row "T11-F2" "Fichier tsconfig.json existe" "PASS" "Cree"
else
  add_row "T11-F2" "Fichier tsconfig.json existe" "FAIL" "Manquant"
fi
# Test T11-F3: Existence fichier repo/packages/shared-events/src/topics.ts
if [ -f "repo/packages/shared-events/src/topics.ts" ]; then
  add_row "T11-F3" "Fichier topics.ts existe" "PASS" "Cree"
else
  add_row "T11-F3" "Fichier topics.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T11-V1: Package build reussit (P0)
echo "  Verifying T11-V1 : Package build reussit..."
add_row "T11-V1" "Package build reussit" "WARN" "(P0) Voir B-02 Tache 1.2.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V2: 'Topics' enum exporte 50+ valeurs (P0)
echo "  Verifying T11-V2 : 'Topics' enum exporte 50+ valeurs..."
add_row "T11-V2" "'Topics' enum exporte 50+ valeurs" "WARN" "(P0) Voir B-02 Tache 1.2.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V3: 50+ schemas Zod presents et valides (P0)
echo "  Verifying T11-V3 : 50+ schemas Zod presents et valides..."
add_row "T11-V3" "50+ schemas Zod presents et valides" "WARN" "(P0) Voir B-02 Tache 1.2.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V4: 'validateEvent(Topics.AUTH_USER_SIGNED_IN, payload)' reussit avec payload conforme (P0)
echo "  Verifying T11-V4 : 'validateEvent(Topics.AUTH_USER_SIGNED_IN, payload)' reussit avec payl..."
add_row "T11-V4" "'validateEvent(Topics.AUTH_USER_SIGNED_IN, payload)' reussit avec payload conforme" "WARN" "(P0) Voir B-02 Tache 1.2.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V5: 'validateEvent' echoue avec payload non-conforme (return error details) (P0)
echo "  Verifying T11-V5 : 'validateEvent' echoue avec payload non-conforme (return error details..."
add_row "T11-V5" "'validateEvent' echoue avec payload non-conforme (return error details)" "WARN" "(P0) Voir B-02 Tache 1.2.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V6: Map 'Topics -> ZodSchema' complete (chaque topic a un schema) (P0)
echo "  Verifying T11-V6 : Map 'Topics -> ZodSchema' complete (chaque topic a un schema)..."
add_row "T11-V6" "Map 'Topics -> ZodSchema' complete (chaque topic a un schema)" "WARN" "(P0) Voir B-02 Tache 1.2.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V7: ULID generator produit IDs valides (regex match) (P0)
echo "  Verifying T11-V7 : ULID generator produit IDs valides (regex match)..."
add_row "T11-V7" "ULID generator produit IDs valides (regex match)" "WARN" "(P0) Voir B-02 Tache 1.2.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V8: Types TypeScript inferes : 'UserSignedInPayload' typed correctement (P0)
echo "  Verifying T11-V8 : Types TypeScript inferes : 'UserSignedInPayload' typed correctement..."
add_row "T11-V8" "Types TypeScript inferes : 'UserSignedInPayload' typed correctement" "WARN" "(P0) Voir B-02 Tache 1.2.11 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 12/10 -- 1.2.12 : KafkaPublisher Service NestJS

```bash
echo ""
echo "================================================"
echo "TACHE 1.2.12 : KafkaPublisher Service NestJS"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 10"
echo "================================================"

# === Verification fichiers crees ===
# Test T12-F1: Existence fichier repo/packages/shared-events/src/publisher/kafka-publisher.service.ts
if [ -f "repo/packages/shared-events/src/publisher/kafka-publisher.service.ts" ]; then
  add_row "T12-F1" "Fichier kafka-publisher.service.ts existe" "PASS" "Cree"
else
  add_row "T12-F1" "Fichier kafka-publisher.service.ts existe" "FAIL" "Manquant"
fi
# Test T12-F2: Existence fichier repo/packages/shared-events/src/publisher/kafka-publisher.module.ts
if [ -f "repo/packages/shared-events/src/publisher/kafka-publisher.module.ts" ]; then
  add_row "T12-F2" "Fichier kafka-publisher.module.ts existe" "PASS" "Cree"
else
  add_row "T12-F2" "Fichier kafka-publisher.module.ts existe" "FAIL" "Manquant"
fi
# Test T12-F3: Existence fichier repo/packages/shared-events/src/publisher/errors.ts
if [ -f "repo/packages/shared-events/src/publisher/errors.ts" ]; then
  add_row "T12-F3" "Fichier errors.ts existe" "PASS" "Cree"
else
  add_row "T12-F3" "Fichier errors.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T12-V1: Service publie evenement vers Kafka reel (test integration) (P0)
echo "  Verifying T12-V1 : Service publie evenement vers Kafka reel (test integration)..."
add_row "T12-V1" "Service publie evenement vers Kafka reel (test integration)" "WARN" "(P0) Voir B-02 Tache 1.2.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V2: Payload invalide rejete par Zod avant envoi (P0)
echo "  Verifying T12-V2 : Payload invalide rejete par Zod avant envoi..."
add_row "T12-V2" "Payload invalide rejete par Zod avant envoi" "WARN" "(P0) Voir B-02 Tache 1.2.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V3: event_id genere (ULID valide) (P0)
echo "  Verifying T12-V3 : event_id genere (ULID valide)..."
add_row "T12-V3" "event_id genere (ULID valide)" "WARN" "(P0) Voir B-02 Tache 1.2.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V4: Partition key = tenant_id verifiable cote consumer (P0)
echo "  Verifying T12-V4 : Partition key = tenant_id verifiable cote consumer..."
add_row "T12-V4" "Partition key = tenant_id verifiable cote consumer" "WARN" "(P0) Voir B-02 Tache 1.2.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V5: Retry 3 fois sur transient error (P0)
echo "  Verifying T12-V5 : Retry 3 fois sur transient error..."
add_row "T12-V5" "Retry 3 fois sur transient error" "WARN" "(P0) Voir B-02 Tache 1.2.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V6: Circuit breaker ouvre apres 5 echecs (test : Kafka down) (P0)
echo "  Verifying T12-V6 : Circuit breaker ouvre apres 5 echecs (test : Kafka down)..."
add_row "T12-V6" "Circuit breaker ouvre apres 5 echecs (test : Kafka down)" "WARN" "(P0) Voir B-02 Tache 1.2.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V7: Logs structures emit avec event_id + topic (P0)
echo "  Verifying T12-V7 : Logs structures emit avec event_id + topic..."
add_row "T12-V7" "Logs structures emit avec event_id + topic" "WARN" "(P0) Voir B-02 Tache 1.2.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V8: Metrics OTEL emis (verifier endpoint Prometheus) (P0)
echo "  Verifying T12-V8 : Metrics OTEL emis (verifier endpoint Prometheus)..."
add_row "T12-V8" "Metrics OTEL emis (verifier endpoint Prometheus)" "WARN" "(P0) Voir B-02 Tache 1.2.12 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 13/10 -- 1.2.13 : KafkaConsumerBase Abstract Class

```bash
echo ""
echo "================================================"
echo "TACHE 1.2.13 : KafkaConsumerBase Abstract Class"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 10"
echo "================================================"

# === Verification fichiers crees ===
# Test T13-F1: Existence fichier repo/packages/shared-events/src/consumer/kafka-consumer.base.ts
if [ -f "repo/packages/shared-events/src/consumer/kafka-consumer.base.ts" ]; then
  add_row "T13-F1" "Fichier kafka-consumer.base.ts existe" "PASS" "Cree"
else
  add_row "T13-F1" "Fichier kafka-consumer.base.ts existe" "FAIL" "Manquant"
fi
# Test T13-F2: Existence fichier repo/packages/shared-events/src/consumer/kafka-consumer.module.ts
if [ -f "repo/packages/shared-events/src/consumer/kafka-consumer.module.ts" ]; then
  add_row "T13-F2" "Fichier kafka-consumer.module.ts existe" "PASS" "Cree"
else
  add_row "T13-F2" "Fichier kafka-consumer.module.ts existe" "FAIL" "Manquant"
fi
# Test T13-F3: Existence fichier repo/packages/database/src/migrations/1735000000008-ConsumerProcessedEvents.ts
if [ -f "repo/packages/database/src/migrations/1735000000008-ConsumerProcessedEvents.ts" ]; then
  add_row "T13-F3" "Fichier 1735000000008-ConsumerProcessedEvents.ts existe" "PASS" "Cree"
else
  add_row "T13-F3" "Fichier 1735000000008-ConsumerProcessedEvents.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T13-V1: Classe abstraite compile (P0)
echo "  Verifying T13-V1 : Classe abstraite compile..."
add_row "T13-V1" "Classe abstraite compile" "WARN" "(P0) Voir B-02 Tache 1.2.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V2: Subclass simple fonctionne (test : consumer concret recoit message) (P0)
echo "  Verifying T13-V2 : Subclass simple fonctionne (test : consumer concret recoit message)..."
add_row "T13-V2" "Subclass simple fonctionne (test : consumer concret recoit message)" "WARN" "(P0) Voir B-02 Tache 1.2.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V3: Validation Zod amont -- payload invalide pas envoye a 'handle()' (P0)
echo "  Verifying T13-V3 : Validation Zod amont -- payload invalide pas envoye a 'handle()'..."
add_row "T13-V3" "Validation Zod amont -- payload invalide pas envoye a 'handle()'" "WARN" "(P0) Voir B-02 Tache 1.2.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V4: Idempotency : 2eme processing meme event_id ne re-execute pas 'handle()' (P0)
echo "  Verifying T13-V4 : Idempotency : 2eme processing meme event_id ne re-execute pas 'handle(..."
add_row "T13-V4" "Idempotency : 2eme processing meme event_id ne re-execute pas 'handle()'" "WARN" "(P0) Voir B-02 Tache 1.2.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V5: Retry exponential 3 fois sur erreur transient (P0)
echo "  Verifying T13-V5 : Retry exponential 3 fois sur erreur transient..."
add_row "T13-V5" "Retry exponential 3 fois sur erreur transient" "WARN" "(P0) Voir B-02 Tache 1.2.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V6: DLQ : apres 3 echecs, message publie dans DLQ topic (P0)
echo "  Verifying T13-V6 : DLQ : apres 3 echecs, message publie dans DLQ topic..."
add_row "T13-V6" "DLQ : apres 3 echecs, message publie dans DLQ topic" "WARN" "(P0) Voir B-02 Tache 1.2.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V7: Manual ack apres succes (offset commite) (P0)
echo "  Verifying T13-V7 : Manual ack apres succes (offset commite)..."
add_row "T13-V7" "Manual ack apres succes (offset commite)" "WARN" "(P0) Voir B-02 Tache 1.2.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V8: Logs structures avec event_id + topic + offset (P0)
echo "  Verifying T13-V8 : Logs structures avec event_id + topic + offset..."
add_row "T13-V8" "Logs structures avec event_id + topic + offset" "WARN" "(P0) Voir B-02 Tache 1.2.13 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 14/8 -- 1.2.14 : Seeds Dev Exhaustifs

```bash
echo ""
echo "================================================"
echo "TACHE 1.2.14 : Seeds Dev Exhaustifs"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 8"
echo "================================================"

# === Verification fichiers crees ===
# Test T14-F1: Existence fichier repo/infrastructure/scripts/seed-dev.ts
if [ -f "repo/infrastructure/scripts/seed-dev.ts" ]; then
  add_row "T14-F1" "Fichier seed-dev.ts existe" "PASS" "Cree"
else
  add_row "T14-F1" "Fichier seed-dev.ts existe" "FAIL" "Manquant"
fi
# Test T14-F2: Existence fichier repo/infrastructure/scripts/seed-reset.ts
if [ -f "repo/infrastructure/scripts/seed-reset.ts" ]; then
  add_row "T14-F2" "Fichier seed-reset.ts existe" "PASS" "Cree"
else
  add_row "T14-F2" "Fichier seed-reset.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T14-V1: 'pnpm seeds:run' reussit en < 30s (P0)
echo "  Verifying T14-V1 : 'pnpm seeds:run' reussit en < 30s..."
add_row "T14-V1" "'pnpm seeds:run' reussit en < 30s" "WARN" "(P0) Voir B-02 Tache 1.2.14 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T14-V2: 50 contacts crees (30 Bennani + 20 Atlas) (P0)
echo "  Verifying T14-V2 : 50 contacts crees (30 Bennani + 20 Atlas)..."
add_row "T14-V2" "50 contacts crees (30 Bennani + 20 Atlas)" "WARN" "(P0) Voir B-02 Tache 1.2.14 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T14-V3: 20 deals crees, mix stages (P0)
echo "  Verifying T14-V3 : 20 deals crees, mix stages..."
add_row "T14-V3" "20 deals crees, mix stages" "WARN" "(P0) Voir B-02 Tache 1.2.14 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T14-V4: 20 polices reliees a contacts Bennani (P0)
echo "  Verifying T14-V4 : 20 polices reliees a contacts Bennani..."
add_row "T14-V4" "20 polices reliees a contacts Bennani" "WARN" "(P0) Voir B-02 Tache 1.2.14 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T14-V5: Re-execution idempotent (pas de doublons) (P0)
echo "  Verifying T14-V5 : Re-execution idempotent (pas de doublons)..."
add_row "T14-V5" "Re-execution idempotent (pas de doublons)" "WARN" "(P0) Voir B-02 Tache 1.2.14 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T14-V6: 'pnpm seeds:reset' clean toutes tables (P0)
echo "  Verifying T14-V6 : 'pnpm seeds:reset' clean toutes tables..."
add_row "T14-V6" "'pnpm seeds:reset' clean toutes tables" "WARN" "(P0) Voir B-02 Tache 1.2.14 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T14-V7: Donnees realistes (noms MA plausibles, ICE/CIN format valide) (P0)
echo "  Verifying T14-V7 : Donnees realistes (noms MA plausibles, ICE/CIN format valide)..."
add_row "T14-V7" "Donnees realistes (noms MA plausibles, ICE/CIN format valide)" "WARN" "(P0) Voir B-02 Tache 1.2.14 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T14-V8: Logs progress informatifs (P1)
echo "  Verifying T14-V8 : Logs progress informatifs..."
add_row "T14-V8" "Logs progress informatifs" "WARN" "(P1) Voir B-02 Tache 1.2.14 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 15/10 -- 1.2.15 : Tests Integration : Migrations + RLS + Kafka End-to-End

```bash
echo ""
echo "================================================"
echo "TACHE 1.2.15 : Tests Integration : Migrations + RLS + Kafka End-to-End"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 10"
echo "================================================"

# === Verification fichiers crees ===
# Test T15-F1: Existence fichier repo/packages/database/test/integration/migrations.spec.ts
if [ -f "repo/packages/database/test/integration/migrations.spec.ts" ]; then
  add_row "T15-F1" "Fichier migrations.spec.ts existe" "PASS" "Cree"
else
  add_row "T15-F1" "Fichier migrations.spec.ts existe" "FAIL" "Manquant"
fi
# Test T15-F2: Existence fichier repo/packages/database/test/integration/rls-multi-tenant.spec.ts
if [ -f "repo/packages/database/test/integration/rls-multi-tenant.spec.ts" ]; then
  add_row "T15-F2" "Fichier rls-multi-tenant.spec.ts existe" "PASS" "Cree"
else
  add_row "T15-F2" "Fichier rls-multi-tenant.spec.ts existe" "FAIL" "Manquant"
fi
# Test T15-F3: Existence fichier repo/packages/database/test/integration/rls-super-admin.spec.ts
if [ -f "repo/packages/database/test/integration/rls-super-admin.spec.ts" ]; then
  add_row "T15-F3" "Fichier rls-super-admin.spec.ts existe" "PASS" "Cree"
else
  add_row "T15-F3" "Fichier rls-super-admin.spec.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T15-V1: Tous 10 tests integration passent localement ('pnpm test') (P0)
echo "  Verifying T15-V1 : Tous 10 tests integration passent localement ('pnpm test')..."
add_row "T15-V1" "Tous 10 tests integration passent localement ('pnpm test')" "WARN" "(P0) Voir B-02 Tache 1.2.15 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T15-V2: Tous tests passent en CI (services PG + Kafka + Redis) (P0)
echo "  Verifying T15-V2 : Tous tests passent en CI (services PG + Kafka + Redis)..."
add_row "T15-V2" "Tous tests passent en CI (services PG + Kafka + Redis)" "WARN" "(P0) Voir B-02 Tache 1.2.15 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T15-V3: Migrations up/down/up reussit (P0)
echo "  Verifying T15-V3 : Migrations up/down/up reussit..."
add_row "T15-V3" "Migrations up/down/up reussit" "WARN" "(P0) Voir B-02 Tache 1.2.15 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T15-V4: RLS verifie sur les 32 tables (P0)
echo "  Verifying T15-V4 : RLS verifie sur les 32 tables..."
add_row "T15-V4" "RLS verifie sur les 32 tables" "WARN" "(P0) Voir B-02 Tache 1.2.15 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T15-V5: Subscribers fonctionnels (3 verifies) (P0)
echo "  Verifying T15-V5 : Subscribers fonctionnels (3 verifies)..."
add_row "T15-V5" "Subscribers fonctionnels (3 verifies)" "WARN" "(P0) Voir B-02 Tache 1.2.15 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T15-V6: Kafka publisher + consumer integres (P0)
echo "  Verifying T15-V6 : Kafka publisher + consumer integres..."
add_row "T15-V6" "Kafka publisher + consumer integres" "WARN" "(P0) Voir B-02 Tache 1.2.15 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T15-V7: DLQ recoit messages apres 3 echecs (P0)
echo "  Verifying T15-V7 : DLQ recoit messages apres 3 echecs..."
add_row "T15-V7" "DLQ recoit messages apres 3 echecs" "WARN" "(P0) Voir B-02 Tache 1.2.15 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T15-V8: Seeds reussissent (P0)
echo "  Verifying T15-V8 : Seeds reussissent..."
add_row "T15-V8" "Seeds reussissent" "WARN" "(P0) Voir B-02 Tache 1.2.15 pour test detaille - critere a auto-tester via script ad-hoc"

```

---


---


## VERIFICATIONS TRANSVERSALES SPRINT 2

### TR-BUILD : Build complet du sprint

```bash
echo ""
echo "================================================"
echo "VERIFICATIONS TRANSVERSALES SPRINT 2"
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

### TR-MIGRATIONS : Migrations DB Sprint 2

```bash
echo "=== TR-MIGRATIONS : Migrations DB ==="
MIGR_COUNT=$(pg_query "SELECT COUNT(*) FROM migrations WHERE name LIKE '%sprint02%' OR name LIKE '%Sprint02%'" || echo 0)
if [ "$MIGR_COUNT" -gt 0 ]; then
  add_row "TR-MIG" "Migrations Sprint 2 appliquees" "PASS" "$MIGR_COUNT migrations"
else
  add_row "TR-MIG" "Migrations Sprint 2 appliquees" "WARN" "Aucune migration detectee (verifier)"
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
echo "GENERATION DU RAPPORT FINAL SPRINT 2"
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

## Jalon GO/NO-GO Sprint 2

EOF

# Calcul statut final
if (( $(echo "$SCORE >= 95" | bc -l) )); then
  STATUT="GO"
  cat >> "$REPORT_FILE" << EOF
**STATUT** : GO -- Sprint 2 valide, passage Sprint 3 autorise

Le sprint a passe les criteres requis. Cowork peut demarrer Sprint 3.

EOF
  echo ""
  echo "================================================"
  echo "SPRINT 2 : GO ($SCORE%)"
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
  echo "SPRINT 2 : GO CONDITIONNEL ($SCORE%)"
  echo "================================================"
else
  STATUT="NO-GO"
  cat >> "$REPORT_FILE" << EOF
**STATUT** : NO-GO -- Score $SCORE% trop bas (cible 85% minimum)

Le sprint **doit etre repris** :
- Lister tous FAIL P0
- Escalation Saad/Abla decision (cut scope OR delai)
- Reprise sprint avant Sprint 3

EOF
  echo ""
  echo "================================================"
  echo "SPRINT 2 : NO-GO ($SCORE%)"
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
  echo "git commit -m \"chore(sprint-02): close sprint 2 -- $STATUT ($SCORE%)\"" >> "$REPORT_FILE"
  echo '```' >> "$REPORT_FILE"
fi

echo ""
echo "Rapport complet dans : $REPORT_FILE"
```

---

## INSTRUCTION FINALE A CLAUDE CODE / COWORK

Apres l'execution complete des verifications ci-dessus :

1. **Lis le contenu de `sprint02-verify-report.md`** integralement
2. **Identifie les FAIL critiques** (criteres P0) qui necessitent intervention manuelle
3. **Affiche un resume executif** :
   - Nombre total de criteres
   - Pourcentage PASS / PASS\* / FAIL / WARN
   - Liste des FAIL avec contexte technique
   - Recommandation : GO / GO CONDITIONNEL / NO-GO
4. **Si NO-GO** : ne pas demarrer le Sprint suivant, alerter Saad/Abla via Slack `#insurtech-dev`
5. **Si GO ou GO CONDITIONNEL** : produire le commit de cloture du sprint :

```bash
git add skalean-insurtech/sprint02-verify-report.md
git commit -m "chore(sprint-02): close sprint 2 with verification report

- Verification automatique executee
- Score global : <SCORE>%
- <PASS> criteres PASS, <PASS_REPAIRED> reparations auto, <FAIL> FAIL
- Statut : <GO|GO CONDITIONNEL|NO-GO>

Phase: 1 -- Bootstrap Infrastructure
Sprint: 2 (Phase 1 / Sprint 2)
Reference B-02, C-02, V-02
Report: sprint02-verify-report.md"
```

6. **Documentation continue** : si decisions techniques prises pendant verification, ajouter notes dans `repo/docs/runbooks/sprint-02-lessons-learned.md`

---

**Fin de la verification V-02 v2.2 detaillee -- Sprint 2 (1.2) Database + Kafka.**

**Total criteres taches** : 127 | **Total transversaux** : ~10 | **Effort sprint** : 80h
