# VERIFICATION SPRINT 17 -- Phase 4 / Sprint 4 : Web Customer Portal vente en ligne SEO
# Version : Auto-reparation active + Rapport final MD detaille
# 14 taches, 72 criteres extraits B-17
# AUCUNE EMOJI AUTORISEE

**Version** : v2.2 (verification detaillee)
**Phase** : 4 -- Vertical Insure (Skalean Broker ERP)
**Sprint** : 17 / 35 (cumul) -- Sprint 4 dans Phase 4
**Reference meta-prompt** : `B-17-sprint-17-web-customer-portal.md`
**Reference orchestrateur** : `C-17-sprint-17-web-customer-portal.md`
**Total criteres** : 72 criteres taches + ~10 transversaux

---

Tu es **Claude Code (ou Cowork)**. Tu dois executer une **verification COMPLETE et EXHAUSTIVE** du Sprint 17 apres execution toutes les 14 taches.

---

## REGLES D'EXECUTION

1. Tu **executes CHAQUE verification dans l'ordre** (taches puis transversales)
2. Quand une verification echoue, tu **TENTES UNE REPARATION AUTOMATIQUE** avant de noter FAIL
3. Apres chaque tentative de reparation, tu **re-executes la verification**
4. Tu consignes dans `sprint17-verify-report.md` **TOUS les resultats** au fil de l'execution
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
REPORT_FILE="sprint17-verify-report.md"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
RUN_ID=$(date '+%Y%m%d-%H%M%S')

cat > "$REPORT_FILE" << EOF
# Rapport de Verification - Sprint 17 : Web Customer Portal vente en ligne SEO

**Date** : $TIMESTAMP
**Run ID** : $RUN_ID
**Phase** : 4 -- Vertical Insure (Skalean Broker ERP)
**Sprint** : 17 (Phase 4 / Sprint 4)
**Reference B-17** : 14 taches, 72 criteres extraits
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

## TACHE 1/7 -- 4.4.1 : App Skeleton + Public Layout + SEO Foundation

```bash
echo ""
echo "================================================"
echo "TACHE 4.4.1 : App Skeleton + Public Layout + SEO Foundation"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 7"
echo "================================================"

# === Verification fichiers crees ===
# Test T01-F1: Existence fichier repo/apps/web-customer-portal/app/layout.tsx
if [ -f "repo/apps/web-customer-portal/app/layout.tsx" ]; then
  add_row "T01-F1" "Fichier layout.tsx existe" "PASS" "Cree"
else
  add_row "T01-F1" "Fichier layout.tsx existe" "FAIL" "Manquant"
fi
# Test T01-F2: Existence fichier repo/apps/web-customer-portal/app/[locale]/layout.tsx
if [ -f "repo/apps/web-customer-portal/app/[locale]/layout.tsx" ]; then
  add_row "T01-F2" "Fichier layout.tsx existe" "PASS" "Cree"
else
  add_row "T01-F2" "Fichier layout.tsx existe" "FAIL" "Manquant"
fi
# Test T01-F3: Existence fichier repo/apps/web-customer-portal/components/layout/public-header.tsx
if [ -f "repo/apps/web-customer-portal/components/layout/public-header.tsx" ]; then
  add_row "T01-F3" "Fichier public-header.tsx existe" "PASS" "Cree"
else
  add_row "T01-F3" "Fichier public-header.tsx existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T01-V1: App demarre port 3004 (P0)
echo "  Verifying T01-V1 : App demarre port 3004..."
add_row "T01-V1" "App demarre port 3004" "WARN" "(P0) Voir B-17 Tache 4.4.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V2: Robots.txt accessible (P0)
echo "  Verifying T01-V2 : Robots.txt accessible..."
add_row "T01-V2" "Robots.txt accessible" "WARN" "(P0) Voir B-17 Tache 4.4.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V3: Sitemap.xml genere avec pages locales (P0)
echo "  Verifying T01-V3 : Sitemap.xml genere avec pages locales..."
add_row "T01-V3" "Sitemap.xml genere avec pages locales" "WARN" "(P0) Voir B-17 Tache 4.4.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V4: OG images preview Twitter/Facebook OK (P0)
echo "  Verifying T01-V4 : OG images preview Twitter/Facebook OK..."
add_row "T01-V4" "OG images preview Twitter/Facebook OK" "WARN" "(P0) Voir B-17 Tache 4.4.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V5: Structured data validates schema.org (P0)
echo "  Verifying T01-V5 : Structured data validates schema.org..."
add_row "T01-V5" "Structured data validates schema.org" "WARN" "(P0) Voir B-17 Tache 4.4.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V6: Locale routing /fr / /ar-MA / /ar (P0)
echo "  Verifying T01-V6 : Locale routing /fr / /ar-MA / /ar..."
add_row "T01-V6" "Locale routing /fr / /ar-MA / /ar" "WARN" "(P0) Voir B-17 Tache 4.4.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V7: Tests setup 6+ scenarios (P1)
echo "  Verifying T01-V7 : Tests setup 6+ scenarios..."
add_row "T01-V7" "Tests setup 6+ scenarios" "WARN" "(P1) Voir B-17 Tache 4.4.1 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 2/5 -- 4.4.2 : Landing Page Racine

```bash
echo ""
echo "================================================"
echo "TACHE 4.4.2 : Landing Page Racine"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T02-F1: Existence fichier repo/apps/web-customer-portal/app/[locale]/page.tsx
if [ -f "repo/apps/web-customer-portal/app/[locale]/page.tsx" ]; then
  add_row "T02-F1" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T02-F1" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T02-F2: Existence fichier repo/apps/web-customer-portal/components/home/hero-section.tsx
if [ -f "repo/apps/web-customer-portal/components/home/hero-section.tsx" ]; then
  add_row "T02-F2" "Fichier hero-section.tsx existe" "PASS" "Cree"
else
  add_row "T02-F2" "Fichier hero-section.tsx existe" "FAIL" "Manquant"
fi
# Test T02-F3: Existence fichier repo/apps/web-customer-portal/components/home/branches-grid.tsx
if [ -f "repo/apps/web-customer-portal/components/home/branches-grid.tsx" ]; then
  add_row "T02-F3" "Fichier branches-grid.tsx existe" "PASS" "Cree"
else
  add_row "T02-F3" "Fichier branches-grid.tsx existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T02-V1: Toutes 8 sections render (P0)
echo "  Verifying T02-V1 : Toutes 8 sections render..."
add_row "T02-V1" "Toutes 8 sections render" "WARN" "(P0) Voir B-17 Tache 4.4.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V2: CTAs trackees (P0)
echo "  Verifying T02-V2 : CTAs trackees..."
add_row "T02-V2" "CTAs trackees" "WARN" "(P0) Voir B-17 Tache 4.4.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V3: Mobile responsive (P0)
echo "  Verifying T02-V3 : Mobile responsive..."
add_row "T02-V3" "Mobile responsive" "WARN" "(P0) Voir B-17 Tache 4.4.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V4: Lighthouse Performance 90+ (P0)
echo "  Verifying T02-V4 : Lighthouse Performance 90+..."
add_row "T02-V4" "Lighthouse Performance 90+" "WARN" "(P0) Voir B-17 Tache 4.4.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V5: Tests 6+ scenarios (P0)
echo "  Verifying T02-V5 : Tests 6+ scenarios..."
add_row "T02-V5" "Tests 6+ scenarios" "WARN" "(P0) Voir B-17 Tache 4.4.2 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 3/5 -- 4.4.3 : 5 Pages Branches

```bash
echo ""
echo "================================================"
echo "TACHE 4.4.3 : 5 Pages Branches"
echo "Priorite : P0 | Effort : 7h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T03-F1: Existence fichier repo/apps/web-customer-portal/app/[locale]/auto/page.tsx
if [ -f "repo/apps/web-customer-portal/app/[locale]/auto/page.tsx" ]; then
  add_row "T03-F1" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T03-F1" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T03-F2: Existence fichier repo/apps/web-customer-portal/app/[locale]/sante/page.tsx
if [ -f "repo/apps/web-customer-portal/app/[locale]/sante/page.tsx" ]; then
  add_row "T03-F2" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T03-F2" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T03-F3: Existence fichier repo/apps/web-customer-portal/app/[locale]/habitation/page.tsx
if [ -f "repo/apps/web-customer-portal/app/[locale]/habitation/page.tsx" ]; then
  add_row "T03-F3" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T03-F3" "Fichier page.tsx existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T03-V1: 5 pages render (P0)
echo "  Verifying T03-V1 : 5 pages render..."
add_row "T03-V1" "5 pages render" "WARN" "(P0) Voir B-17 Tache 4.4.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V2: SEO metadata per page (P0)
echo "  Verifying T03-V2 : SEO metadata per page..."
add_row "T03-V2" "SEO metadata per page" "WARN" "(P0) Voir B-17 Tache 4.4.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V3: Static generation OK (P0)
echo "  Verifying T03-V3 : Static generation OK..."
add_row "T03-V3" "Static generation OK" "WARN" "(P0) Voir B-17 Tache 4.4.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V4: Internal linking (P0)
echo "  Verifying T03-V4 : Internal linking..."
add_row "T03-V4" "Internal linking" "WARN" "(P0) Voir B-17 Tache 4.4.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V5: Tests 10+ scenarios (P0)
echo "  Verifying T03-V5 : Tests 10+ scenarios..."
add_row "T03-V5" "Tests 10+ scenarios" "WARN" "(P0) Voir B-17 Tache 4.4.3 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 4/6 -- 4.4.4 : Tarification Simulator

```bash
echo ""
echo "================================================"
echo "TACHE 4.4.4 : Tarification Simulator"
echo "Priorite : P0 | Effort : 7h"
echo "Criteres a verifier : 6"
echo "================================================"

# === Verification fichiers crees ===
# Test T04-F1: Existence fichier repo/apps/web-customer-portal/app/[locale]/simulateur/{5 branches}/page.tsx
if [ -f "repo/apps/web-customer-portal/app/[locale]/simulateur/{5 branches}/page.tsx" ]; then
  add_row "T04-F1" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T04-F1" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T04-F2: Existence fichier repo/apps/web-customer-portal/components/simulator/{several components}.tsx
if [ -f "repo/apps/web-customer-portal/components/simulator/{several components}.tsx" ]; then
  add_row "T04-F2" "Fichier {several components}.tsx existe" "PASS" "Cree"
else
  add_row "T04-F2" "Fichier {several components}.tsx existe" "FAIL" "Manquant"
fi
# Test T04-F3: Existence fichier repo/apps/web-customer-portal/lib/hooks/use-debounce.ts
if [ -f "repo/apps/web-customer-portal/lib/hooks/use-debounce.ts" ]; then
  add_row "T04-F3" "Fichier use-debounce.ts existe" "PASS" "Cree"
else
  add_row "T04-F3" "Fichier use-debounce.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T04-V1: 5 simulators (1 par branche) (P0)
echo "  Verifying T04-V1 : 5 simulators (1 par branche)..."
add_row "T04-V1" "5 simulators (1 par branche)" "WARN" "(P0) Voir B-17 Tache 4.4.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V2: Real-time computation debounced 500ms (P0)
echo "  Verifying T04-V2 : Real-time computation debounced 500ms..."
add_row "T04-V2" "Real-time computation debounced 500ms" "WARN" "(P0) Voir B-17 Tache 4.4.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V3: Quote breakdown display (P0)
echo "  Verifying T04-V3 : Quote breakdown display..."
add_row "T04-V3" "Quote breakdown display" "WARN" "(P0) Voir B-17 Tache 4.4.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V4: Save quote DB status=draft (P0)
echo "  Verifying T04-V4 : Save quote DB status=draft..."
add_row "T04-V4" "Save quote DB status=draft" "WARN" "(P0) Voir B-17 Tache 4.4.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V5: Continue redirect wizard (P0)
echo "  Verifying T04-V5 : Continue redirect wizard..."
add_row "T04-V5" "Continue redirect wizard" "WARN" "(P0) Voir B-17 Tache 4.4.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V6: Tests 10+ scenarios (P0)
echo "  Verifying T04-V6 : Tests 10+ scenarios..."
add_row "T04-V6" "Tests 10+ scenarios" "WARN" "(P0) Voir B-17 Tache 4.4.4 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 5/4 -- 4.4.5 : Comparateur Multi-Produits

```bash
echo ""
echo "================================================"
echo "TACHE 4.4.5 : Comparateur Multi-Produits"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 4"
echo "================================================"

# === Verification fichiers crees ===
# Test T05-F1: Existence fichier repo/apps/web-customer-portal/app/[locale]/comparer/[branche]/page.tsx
if [ -f "repo/apps/web-customer-portal/app/[locale]/comparer/[branche]/page.tsx" ]; then
  add_row "T05-F1" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T05-F1" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T05-F2: Existence fichier repo/apps/web-customer-portal/components/compare/products-grid.tsx
if [ -f "repo/apps/web-customer-portal/components/compare/products-grid.tsx" ]; then
  add_row "T05-F2" "Fichier products-grid.tsx existe" "PASS" "Cree"
else
  add_row "T05-F2" "Fichier products-grid.tsx existe" "FAIL" "Manquant"
fi
# Test T05-F3: Existence fichier repo/apps/web-customer-portal/components/compare/products-table.tsx
if [ -f "repo/apps/web-customer-portal/components/compare/products-table.tsx" ]; then
  add_row "T05-F3" "Fichier products-table.tsx existe" "PASS" "Cree"
else
  add_row "T05-F3" "Fichier products-table.tsx existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T05-V1: 5 quotes parallel computation (P0)
echo "  Verifying T05-V1 : 5 quotes parallel computation..."
add_row "T05-V1" "5 quotes parallel computation" "WARN" "(P0) Voir B-17 Tache 4.4.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V2: Side-by-side display (P0)
echo "  Verifying T05-V2 : Side-by-side display..."
add_row "T05-V2" "Side-by-side display" "WARN" "(P0) Voir B-17 Tache 4.4.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V3: Filter / sort (P0)
echo "  Verifying T05-V3 : Filter / sort..."
add_row "T05-V3" "Filter / sort" "WARN" "(P0) Voir B-17 Tache 4.4.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V4: Tests 5+ scenarios (P0)
echo "  Verifying T05-V4 : Tests 5+ scenarios..."
add_row "T05-V4" "Tests 5+ scenarios" "WARN" "(P0) Voir B-17 Tache 4.4.5 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 6/5 -- 4.4.6 : Souscription Wizard Etape 1 : Data Personnelle

```bash
echo ""
echo "================================================"
echo "TACHE 4.4.6 : Souscription Wizard Etape 1 : Data Personnelle"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T06-F1: Existence fichier repo/apps/web-customer-portal/app/[locale]/souscription/etape-1/page.tsx
if [ -f "repo/apps/web-customer-portal/app/[locale]/souscription/etape-1/page.tsx" ]; then
  add_row "T06-F1" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T06-F1" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T06-F2: Existence fichier repo/apps/web-customer-portal/components/wizard/wizard-progress.tsx
if [ -f "repo/apps/web-customer-portal/components/wizard/wizard-progress.tsx" ]; then
  add_row "T06-F2" "Fichier wizard-progress.tsx existe" "PASS" "Cree"
else
  add_row "T06-F2" "Fichier wizard-progress.tsx existe" "FAIL" "Manquant"
fi
# Test T06-F3: Existence fichier repo/apps/web-customer-portal/components/wizard/personal-data-form.tsx
if [ -f "repo/apps/web-customer-portal/components/wizard/personal-data-form.tsx" ]; then
  add_row "T06-F3" "Fichier personal-data-form.tsx existe" "PASS" "Cree"
else
  add_row "T06-F3" "Fichier personal-data-form.tsx existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T06-V1: Form particulier + entreprise (P0)
echo "  Verifying T06-V1 : Form particulier + entreprise..."
add_row "T06-V1" "Form particulier + entreprise" "WARN" "(P0) Voir B-17 Tache 4.4.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V2: Validation Zod stricte (P0)
echo "  Verifying T06-V2 : Validation Zod stricte..."
add_row "T06-V2" "Validation Zod stricte" "WARN" "(P0) Voir B-17 Tache 4.4.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V3: CIN + ICE + phone formats valides (P0)
echo "  Verifying T06-V3 : CIN + ICE + phone formats valides..."
add_row "T06-V3" "CIN + ICE + phone formats valides" "WARN" "(P0) Voir B-17 Tache 4.4.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V4: Auto-save + reload state (P0)
echo "  Verifying T06-V4 : Auto-save + reload state..."
add_row "T06-V4" "Auto-save + reload state" "WARN" "(P0) Voir B-17 Tache 4.4.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V5: Tests 8+ scenarios (P0)
echo "  Verifying T06-V5 : Tests 8+ scenarios..."
add_row "T06-V5" "Tests 8+ scenarios" "WARN" "(P0) Voir B-17 Tache 4.4.6 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 7/5 -- 4.4.7 : Souscription Wizard Etape 2 : KYC

```bash
echo ""
echo "================================================"
echo "TACHE 4.4.7 : Souscription Wizard Etape 2 : KYC"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T07-F1: Existence fichier repo/apps/web-customer-portal/app/[locale]/souscription/etape-2/page.tsx
if [ -f "repo/apps/web-customer-portal/app/[locale]/souscription/etape-2/page.tsx" ]; then
  add_row "T07-F1" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T07-F1" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T07-F2: Existence fichier repo/apps/web-customer-portal/components/wizard/kyc-upload.tsx
if [ -f "repo/apps/web-customer-portal/components/wizard/kyc-upload.tsx" ]; then
  add_row "T07-F2" "Fichier kyc-upload.tsx existe" "PASS" "Cree"
else
  add_row "T07-F2" "Fichier kyc-upload.tsx existe" "FAIL" "Manquant"
fi
# Test T07-F3: Existence fichier repo/apps/web-customer-portal/components/wizard/upload-zone.tsx
if [ -f "repo/apps/web-customer-portal/components/wizard/upload-zone.tsx" ]; then
  add_row "T07-F3" "Fichier upload-zone.tsx existe" "PASS" "Cree"
else
  add_row "T07-F3" "Fichier upload-zone.tsx existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T07-V1: Upload zones drag-drop (P0)
echo "  Verifying T07-V1 : Upload zones drag-drop..."
add_row "T07-V1" "Upload zones drag-drop" "WARN" "(P0) Voir B-17 Tache 4.4.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V2: Validation files (P0)
echo "  Verifying T07-V2 : Validation files..."
add_row "T07-V2" "Validation files" "WARN" "(P0) Voir B-17 Tache 4.4.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V3: S3 upload reussit (P0)
echo "  Verifying T07-V3 : S3 upload reussit..."
add_row "T07-V3" "S3 upload reussit" "WARN" "(P0) Voir B-17 Tache 4.4.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V4: Pre-approbation logic (P0)
echo "  Verifying T07-V4 : Pre-approbation logic..."
add_row "T07-V4" "Pre-approbation logic" "WARN" "(P0) Voir B-17 Tache 4.4.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V5: Tests 8+ scenarios (P0)
echo "  Verifying T07-V5 : Tests 8+ scenarios..."
add_row "T07-V5" "Tests 8+ scenarios" "WARN" "(P0) Voir B-17 Tache 4.4.7 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 8/6 -- 4.4.8 : Souscription Wizard Etape 3 : Paiement

```bash
echo ""
echo "================================================"
echo "TACHE 4.4.8 : Souscription Wizard Etape 3 : Paiement"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 6"
echo "================================================"

# === Verification fichiers crees ===
# Test T08-F1: Existence fichier repo/apps/web-customer-portal/app/[locale]/souscription/etape-3/page.tsx
if [ -f "repo/apps/web-customer-portal/app/[locale]/souscription/etape-3/page.tsx" ]; then
  add_row "T08-F1" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T08-F1" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T08-F2: Existence fichier repo/apps/web-customer-portal/app/[locale]/souscription/paiement/return/page.tsx
if [ -f "repo/apps/web-customer-portal/app/[locale]/souscription/paiement/return/page.tsx" ]; then
  add_row "T08-F2" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T08-F2" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T08-F3: Existence fichier repo/apps/web-customer-portal/components/wizard/payment-methods.tsx
if [ -f "repo/apps/web-customer-portal/components/wizard/payment-methods.tsx" ]; then
  add_row "T08-F3" "Fichier payment-methods.tsx existe" "PASS" "Cree"
else
  add_row "T08-F3" "Fichier payment-methods.tsx existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T08-V1: Recap visible (P0)
echo "  Verifying T08-V1 : Recap visible..."
add_row "T08-V1" "Recap visible" "WARN" "(P0) Voir B-17 Tache 4.4.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V2: Methode payment selection (P0)
echo "  Verifying T08-V2 : Methode payment selection..."
add_row "T08-V2" "Methode payment selection" "WARN" "(P0) Voir B-17 Tache 4.4.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V3: Pay initiate + redirect (P0)
echo "  Verifying T08-V3 : Pay initiate + redirect..."
add_row "T08-V3" "Pay initiate + redirect" "WARN" "(P0) Voir B-17 Tache 4.4.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V4: Return handle success/fail (P0)
echo "  Verifying T08-V4 : Return handle success/fail..."
add_row "T08-V4" "Return handle success/fail" "WARN" "(P0) Voir B-17 Tache 4.4.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V5: Polling pending (P0)
echo "  Verifying T08-V5 : Polling pending..."
add_row "T08-V5" "Polling pending" "WARN" "(P0) Voir B-17 Tache 4.4.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V6: Tests 8+ scenarios (P0)
echo "  Verifying T08-V6 : Tests 8+ scenarios..."
add_row "T08-V6" "Tests 8+ scenarios" "WARN" "(P0) Voir B-17 Tache 4.4.8 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 9/6 -- 4.4.9 : Souscription Wizard Etape 4 : Signature + Confirmation

```bash
echo ""
echo "================================================"
echo "TACHE 4.4.9 : Souscription Wizard Etape 4 : Signature + Confirmation"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 6"
echo "================================================"

# === Verification fichiers crees ===
# Test T09-F1: Existence fichier repo/apps/web-customer-portal/app/[locale]/souscription/etape-4/page.tsx
if [ -f "repo/apps/web-customer-portal/app/[locale]/souscription/etape-4/page.tsx" ]; then
  add_row "T09-F1" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T09-F1" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T09-F2: Existence fichier repo/apps/web-customer-portal/app/[locale]/souscription/confirmation/page.tsx
if [ -f "repo/apps/web-customer-portal/app/[locale]/souscription/confirmation/page.tsx" ]; then
  add_row "T09-F2" "Fichier page.tsx existe" "PASS" "Cree"
else
  add_row "T09-F2" "Fichier page.tsx existe" "FAIL" "Manquant"
fi
# Test T09-F3: Existence fichier repo/apps/web-customer-portal/components/wizard/signature-step.tsx
if [ -f "repo/apps/web-customer-portal/components/wizard/signature-step.tsx" ]; then
  add_row "T09-F3" "Fichier signature-step.tsx existe" "PASS" "Cree"
else
  add_row "T09-F3" "Fichier signature-step.tsx existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T09-V1: Provisional policy preview (P0)
echo "  Verifying T09-V1 : Provisional policy preview..."
add_row "T09-V1" "Provisional policy preview" "WARN" "(P0) Voir B-17 Tache 4.4.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V2: Signature complete (P0)
echo "  Verifying T09-V2 : Signature complete..."
add_row "T09-V2" "Signature complete" "WARN" "(P0) Voir B-17 Tache 4.4.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V3: Submission broker queue (P0)
echo "  Verifying T09-V3 : Submission broker queue..."
add_row "T09-V3" "Submission broker queue" "WARN" "(P0) Voir B-17 Tache 4.4.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V4: Confirmation page complete (P0)
echo "  Verifying T09-V4 : Confirmation page complete..."
add_row "T09-V4" "Confirmation page complete" "WARN" "(P0) Voir B-17 Tache 4.4.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V5: Email + SMS confirmation envoyes (P0)
echo "  Verifying T09-V5 : Email + SMS confirmation envoyes..."
add_row "T09-V5" "Email + SMS confirmation envoyes" "WARN" "(P0) Voir B-17 Tache 4.4.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V6: Tests 6+ scenarios (P0)
echo "  Verifying T09-V6 : Tests 6+ scenarios..."
add_row "T09-V6" "Tests 6+ scenarios" "WARN" "(P0) Voir B-17 Tache 4.4.9 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 10/5 -- 4.4.10 : Provisional Policy Generation + Display + PDF

```bash
echo ""
echo "================================================"
echo "TACHE 4.4.10 : Provisional Policy Generation + Display + PDF"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T10-F1: Existence fichier repo/apps/web-customer-portal/components/wizard/provisional-display.tsx
if [ -f "repo/apps/web-customer-portal/components/wizard/provisional-display.tsx" ]; then
  add_row "T10-F1" "Fichier provisional-display.tsx existe" "PASS" "Cree"
else
  add_row "T10-F1" "Fichier provisional-display.tsx existe" "FAIL" "Manquant"
fi
# Test T10-F2: Existence fichier repo/apps/web-customer-portal/components/wizard/pdf-viewer.tsx
if [ -f "repo/apps/web-customer-portal/components/wizard/pdf-viewer.tsx" ]; then
  add_row "T10-F2" "Fichier pdf-viewer.tsx existe" "PASS" "Cree"
else
  add_row "T10-F2" "Fichier pdf-viewer.tsx existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T10-V1: Provisional generated (P0)
echo "  Verifying T10-V1 : Provisional generated..."
add_row "T10-V1" "Provisional generated" "WARN" "(P0) Voir B-17 Tache 4.4.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V2: Display complete (P0)
echo "  Verifying T10-V2 : Display complete..."
add_row "T10-V2" "Display complete" "WARN" "(P0) Voir B-17 Tache 4.4.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V3: PDF preview + download (P0)
echo "  Verifying T10-V3 : PDF preview + download..."
add_row "T10-V3" "PDF preview + download" "WARN" "(P0) Voir B-17 Tache 4.4.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V4: QR code + watermark visible (P0)
echo "  Verifying T10-V4 : QR code + watermark visible..."
add_row "T10-V4" "QR code + watermark visible" "WARN" "(P0) Voir B-17 Tache 4.4.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V5: Tests 5+ scenarios (P0)
echo "  Verifying T10-V5 : Tests 5+ scenarios..."
add_row "T10-V5" "Tests 5+ scenarios" "WARN" "(P0) Voir B-17 Tache 4.4.10 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 11/5 -- 4.4.11 : SEO Complet

```bash
echo ""
echo "================================================"
echo "TACHE 4.4.11 : SEO Complet"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T11-F1: Existence fichier repo/apps/web-customer-portal/app/sitemap.ts
if [ -f "repo/apps/web-customer-portal/app/sitemap.ts" ]; then
  add_row "T11-F1" "Fichier sitemap.ts existe" "PASS" "Cree"
else
  add_row "T11-F1" "Fichier sitemap.ts existe" "FAIL" "Manquant"
fi
# Test T11-F2: Existence fichier repo/apps/web-customer-portal/components/seo/{several jsonld variants}.tsx
if [ -f "repo/apps/web-customer-portal/components/seo/{several jsonld variants}.tsx" ]; then
  add_row "T11-F2" "Fichier {several jsonld variants}.tsx existe" "PASS" "Cree"
else
  add_row "T11-F2" "Fichier {several jsonld variants}.tsx existe" "FAIL" "Manquant"
fi
# Test T11-F3: Existence fichier repo/apps/web-customer-portal/app/{various pages}/opengraph-image.tsx
if [ -f "repo/apps/web-customer-portal/app/{various pages}/opengraph-image.tsx" ]; then
  add_row "T11-F3" "Fichier opengraph-image.tsx existe" "PASS" "Cree"
else
  add_row "T11-F3" "Fichier opengraph-image.tsx existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T11-V1: Metadata exhaustive (P0)
echo "  Verifying T11-V1 : Metadata exhaustive..."
add_row "T11-V1" "Metadata exhaustive" "WARN" "(P0) Voir B-17 Tache 4.4.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V2: Sitemap genere correctement (P0)
echo "  Verifying T11-V2 : Sitemap genere correctement..."
add_row "T11-V2" "Sitemap genere correctement" "WARN" "(P0) Voir B-17 Tache 4.4.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V3: Structured data validates (P0)
echo "  Verifying T11-V3 : Structured data validates..."
add_row "T11-V3" "Structured data validates" "WARN" "(P0) Voir B-17 Tache 4.4.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V4: Lighthouse SEO 100 (P0)
echo "  Verifying T11-V4 : Lighthouse SEO 100..."
add_row "T11-V4" "Lighthouse SEO 100" "WARN" "(P0) Voir B-17 Tache 4.4.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V5: Tests SEO 8+ scenarios (P0)
echo "  Verifying T11-V5 : Tests SEO 8+ scenarios..."
add_row "T11-V5" "Tests SEO 8+ scenarios" "WARN" "(P0) Voir B-17 Tache 4.4.11 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 12/5 -- 4.4.12 : I18n + RTL + Mobile-First Responsive

```bash
echo ""
echo "================================================"
echo "TACHE 4.4.12 : I18n + RTL + Mobile-First Responsive"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T12-F1: Existence fichier repo/apps/web-customer-portal/messages/{fr,ar-MA,ar}.json
if [ -f "repo/apps/web-customer-portal/messages/{fr,ar-MA,ar}.json" ]; then
  add_row "T12-F1" "Fichier {fr,ar-MA,ar}.json existe" "PASS" "Cree"
else
  add_row "T12-F1" "Fichier {fr,ar-MA,ar}.json existe" "FAIL" "Manquant"
fi
# Test T12-F2: Existence fichier repo/apps/web-customer-portal/app/globals.css
if [ -f "repo/apps/web-customer-portal/app/globals.css" ]; then
  add_row "T12-F2" "Fichier globals.css existe" "PASS" "Cree"
else
  add_row "T12-F2" "Fichier globals.css existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T12-V1: 3 locales complete (P0)
echo "  Verifying T12-V1 : 3 locales complete..."
add_row "T12-V1" "3 locales complete" "WARN" "(P0) Voir B-17 Tache 4.4.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V2: RTL fonctionne ar/ar-MA (P0)
echo "  Verifying T12-V2 : RTL fonctionne ar/ar-MA..."
add_row "T12-V2" "RTL fonctionne ar/ar-MA" "WARN" "(P0) Voir B-17 Tache 4.4.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V3: Mobile responsive tous viewports (P0)
echo "  Verifying T12-V3 : Mobile responsive tous viewports..."
add_row "T12-V3" "Mobile responsive tous viewports" "WARN" "(P0) Voir B-17 Tache 4.4.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V4: Core Web Vitals greens (P0)
echo "  Verifying T12-V4 : Core Web Vitals greens..."
add_row "T12-V4" "Core Web Vitals greens" "WARN" "(P0) Voir B-17 Tache 4.4.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V5: Tests 8+ scenarios (P0)
echo "  Verifying T12-V5 : Tests 8+ scenarios..."
add_row "T12-V5" "Tests 8+ scenarios" "WARN" "(P0) Voir B-17 Tache 4.4.12 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 13/4 -- 4.4.13 : Analytics Tracking

```bash
echo ""
echo "================================================"
echo "TACHE 4.4.13 : Analytics Tracking"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 4"
echo "================================================"

# === Verification fichiers crees ===
# Test T13-F1: Existence fichier repo/apps/web-customer-portal/components/analytics/cookie-banner.tsx
if [ -f "repo/apps/web-customer-portal/components/analytics/cookie-banner.tsx" ]; then
  add_row "T13-F1" "Fichier cookie-banner.tsx existe" "PASS" "Cree"
else
  add_row "T13-F1" "Fichier cookie-banner.tsx existe" "FAIL" "Manquant"
fi
# Test T13-F2: Existence fichier repo/apps/web-customer-portal/components/analytics/ga-script.tsx
if [ -f "repo/apps/web-customer-portal/components/analytics/ga-script.tsx" ]; then
  add_row "T13-F2" "Fichier ga-script.tsx existe" "PASS" "Cree"
else
  add_row "T13-F2" "Fichier ga-script.tsx existe" "FAIL" "Manquant"
fi
# Test T13-F3: Existence fichier repo/apps/web-customer-portal/lib/analytics/track-event.ts
if [ -f "repo/apps/web-customer-portal/lib/analytics/track-event.ts" ]; then
  add_row "T13-F3" "Fichier track-event.ts existe" "PASS" "Cree"
else
  add_row "T13-F3" "Fichier track-event.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T13-V1: Cookie banner CNDP (P0)
echo "  Verifying T13-V1 : Cookie banner CNDP..."
add_row "T13-V1" "Cookie banner CNDP" "WARN" "(P0) Voir B-17 Tache 4.4.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V2: GA4 fires on consent (P0)
echo "  Verifying T13-V2 : GA4 fires on consent..."
add_row "T13-V2" "GA4 fires on consent" "WARN" "(P0) Voir B-17 Tache 4.4.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V3: Custom events funnel (P0)
echo "  Verifying T13-V3 : Custom events funnel..."
add_row "T13-V3" "Custom events funnel" "WARN" "(P0) Voir B-17 Tache 4.4.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V4: Tests 6+ scenarios (P0)
echo "  Verifying T13-V4 : Tests 6+ scenarios..."
add_row "T13-V4" "Tests 6+ scenarios" "WARN" "(P0) Voir B-17 Tache 4.4.13 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 14/4 -- 4.4.14 : Tests E2E + Lighthouse

```bash
echo ""
echo "================================================"
echo "TACHE 4.4.14 : Tests E2E + Lighthouse"
echo "Priorite : P0 | Effort : 9h"
echo "Criteres a verifier : 4"
echo "================================================"

# === Verification fichiers crees ===
# Test T14-F1: Existence fichier repo/apps/web-customer-portal/e2e/{15+ specs}.spec.ts
if [ -f "repo/apps/web-customer-portal/e2e/{15+ specs}.spec.ts" ]; then
  add_row "T14-F1" "Fichier {15+ specs}.spec.ts existe" "PASS" "Cree"
else
  add_row "T14-F1" "Fichier {15+ specs}.spec.ts existe" "FAIL" "Manquant"
fi
# Test T14-F2: Existence fichier repo/apps/web-customer-portal/lighthouse-audit-config.json
if [ -f "repo/apps/web-customer-portal/lighthouse-audit-config.json" ]; then
  add_row "T14-F2" "Fichier lighthouse-audit-config.json existe" "PASS" "Cree"
else
  add_row "T14-F2" "Fichier lighthouse-audit-config.json existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T14-V1: 15+ tests passent (P0)
echo "  Verifying T14-V1 : 15+ tests passent..."
add_row "T14-V1" "15+ tests passent" "WARN" "(P0) Voir B-17 Tache 4.4.14 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T14-V2: CI green (P0)
echo "  Verifying T14-V2 : CI green..."
add_row "T14-V2" "CI green" "WARN" "(P0) Voir B-17 Tache 4.4.14 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T14-V3: Lighthouse all green (P0)
echo "  Verifying T14-V3 : Lighthouse all green..."
add_row "T14-V3" "Lighthouse all green" "WARN" "(P0) Voir B-17 Tache 4.4.14 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T14-V4: Reproducibility 5x (P0)
echo "  Verifying T14-V4 : Reproducibility 5x..."
add_row "T14-V4" "Reproducibility 5x" "WARN" "(P0) Voir B-17 Tache 4.4.14 pour test detaille - critere a auto-tester via script ad-hoc"

```

---


---


## VERIFICATIONS TRANSVERSALES SPRINT 17

### TR-BUILD : Build complet du sprint

```bash
echo ""
echo "================================================"
echo "VERIFICATIONS TRANSVERSALES SPRINT 17"
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

### TR-LIGHTHOUSE : Cibles Lighthouse Sprint 17

```bash
echo "=== TR-LIGHTHOUSE : Lighthouse scores ==="
# Note : execution Lighthouse necessite app demarree
# Voir 6-metriques-validation.md pour cibles per app
add_row "TR-LIGHTHOUSE" "Lighthouse scores manuel" "WARN" "Lancer pnpm lighthouse + verifier 6-metriques-validation.md"
```



---

## GENERATION DU RAPPORT FINAL

```bash
echo ""
echo "================================================"
echo "GENERATION DU RAPPORT FINAL SPRINT 17"
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

## Jalon GO/NO-GO Sprint 17

EOF

# Calcul statut final
if (( $(echo "$SCORE >= 95" | bc -l) )); then
  STATUT="GO"
  cat >> "$REPORT_FILE" << EOF
**STATUT** : GO -- Sprint 17 valide, passage Sprint 18 autorise

Le sprint a passe les criteres requis. Cowork peut demarrer Sprint 18.

EOF
  echo ""
  echo "================================================"
  echo "SPRINT 17 : GO ($SCORE%)"
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
  echo "SPRINT 17 : GO CONDITIONNEL ($SCORE%)"
  echo "================================================"
else
  STATUT="NO-GO"
  cat >> "$REPORT_FILE" << EOF
**STATUT** : NO-GO -- Score $SCORE% trop bas (cible 85% minimum)

Le sprint **doit etre repris** :
- Lister tous FAIL P0
- Escalation Saad/Abla decision (cut scope OR delai)
- Reprise sprint avant Sprint 18

EOF
  echo ""
  echo "================================================"
  echo "SPRINT 17 : NO-GO ($SCORE%)"
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
  echo "git commit -m \"chore(sprint-17): close sprint 17 -- $STATUT ($SCORE%)\"" >> "$REPORT_FILE"
  echo '```' >> "$REPORT_FILE"
fi

echo ""
echo "Rapport complet dans : $REPORT_FILE"
```

---

## INSTRUCTION FINALE A CLAUDE CODE / COWORK

Apres l'execution complete des verifications ci-dessus :

1. **Lis le contenu de `sprint17-verify-report.md`** integralement
2. **Identifie les FAIL critiques** (criteres P0) qui necessitent intervention manuelle
3. **Affiche un resume executif** :
   - Nombre total de criteres
   - Pourcentage PASS / PASS\* / FAIL / WARN
   - Liste des FAIL avec contexte technique
   - Recommandation : GO / GO CONDITIONNEL / NO-GO
4. **Si NO-GO** : ne pas demarrer le Sprint suivant, alerter Saad/Abla via Slack `#insurtech-dev`
5. **Si GO ou GO CONDITIONNEL** : produire le commit de cloture du sprint :

```bash
git add skalean-insurtech/sprint17-verify-report.md
git commit -m "chore(sprint-17): close sprint 17 with verification report

- Verification automatique executee
- Score global : <SCORE>%
- <PASS> criteres PASS, <PASS_REPAIRED> reparations auto, <FAIL> FAIL
- Statut : <GO|GO CONDITIONNEL|NO-GO>

Phase: 4 -- Vertical Insure (Skalean Broker ERP)
Sprint: 17 (Phase 4 / Sprint 4)
Reference B-17, C-17, V-17
Report: sprint17-verify-report.md"
```

6. **Documentation continue** : si decisions techniques prises pendant verification, ajouter notes dans `repo/docs/runbooks/sprint-17-lessons-learned.md`

---

**Fin de la verification V-17 v2.2 detaillee -- Sprint 17 (4.4) Web Customer Portal vente en ligne SEO.**

**Total criteres taches** : 72 | **Total transversaux** : ~10 | **Effort sprint** : 80h
