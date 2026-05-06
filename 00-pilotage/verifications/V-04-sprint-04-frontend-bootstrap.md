# VERIFICATION SPRINT 4 -- Phase 1 / Sprint 4 : Frontend Bootstrap (8 apps Next.js)
# Version : Auto-reparation active + Rapport final MD detaille
# 16 taches, 118 criteres extraits B-04
# AUCUNE EMOJI AUTORISEE

**Version** : v2.2 (verification detaillee)
**Phase** : 1 -- Bootstrap Infrastructure
**Sprint** : 4 / 35 (cumul) -- Sprint 4 dans Phase 1
**Reference meta-prompt** : `B-04-sprint-04-frontend-bootstrap.md`
**Reference orchestrateur** : `C-04-sprint-04-frontend-bootstrap.md`
**Total criteres** : 118 criteres taches + ~10 transversaux

---

Tu es **Claude Code (ou Cowork)**. Tu dois executer une **verification COMPLETE et EXHAUSTIVE** du Sprint 4 apres execution toutes les 16 taches.

---

## REGLES D'EXECUTION

1. Tu **executes CHAQUE verification dans l'ordre** (taches puis transversales)
2. Quand une verification echoue, tu **TENTES UNE REPARATION AUTOMATIQUE** avant de noter FAIL
3. Apres chaque tentative de reparation, tu **re-executes la verification**
4. Tu consignes dans `sprint04-verify-report.md` **TOUS les resultats** au fil de l'execution
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
REPORT_FILE="sprint04-verify-report.md"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
RUN_ID=$(date '+%Y%m%d-%H%M%S')

cat > "$REPORT_FILE" << EOF
# Rapport de Verification - Sprint 4 : Frontend Bootstrap (8 apps Next.js)

**Date** : $TIMESTAMP
**Run ID** : $RUN_ID
**Phase** : 1 -- Bootstrap Infrastructure
**Sprint** : 4 (Phase 1 / Sprint 4)
**Reference B-04** : 16 taches, 118 criteres extraits
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

## VERIFICATIONS PAR TACHE (16 taches)

## TACHE 1/8 -- 1.4.1 : web-broker Bootstrap (Port 3001)

```bash
echo ""
echo "================================================"
echo "TACHE 1.4.1 : web-broker Bootstrap (Port 3001)"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 8"
echo "================================================"

# === Verification fichiers crees ===
# Test T01-F1: Existence fichier repo/apps/web-broker/package.json
if [ -f "repo/apps/web-broker/package.json" ]; then
  add_row "T01-F1" "Fichier package.json existe" "PASS" "Cree"
else
  add_row "T01-F1" "Fichier package.json existe" "FAIL" "Manquant"
fi
# Test T01-F2: Existence fichier repo/apps/web-broker/next.config.mjs
if [ -f "repo/apps/web-broker/next.config.mjs" ]; then
  add_row "T01-F2" "Fichier next.config.mjs existe" "PASS" "Cree"
else
  add_row "T01-F2" "Fichier next.config.mjs existe" "FAIL" "Manquant"
fi
# Test T01-F3: Existence fichier repo/apps/web-broker/tsconfig.json
if [ -f "repo/apps/web-broker/tsconfig.json" ]; then
  add_row "T01-F3" "Fichier tsconfig.json existe" "PASS" "Cree"
else
  add_row "T01-F3" "Fichier tsconfig.json existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T01-V1: 'pnpm --filter @insurtech/web-broker dev' demarre port 3001 (P0)
echo "  Verifying T01-V1 : 'pnpm --filter @insurtech/web-broker dev' demarre port 3001..."
add_row "T01-V1" "'pnpm --filter @insurtech/web-broker dev' demarre port 3001" "WARN" "(P0) Voir B-04 Tache 1.4.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V2: 'http://localhost:3001/fr' accessible, theme Skalean visible (P0)
echo "  Verifying T01-V2 : 'http://localhost:3001/fr' accessible, theme Skalean visible..."
add_row "T01-V2" "'http://localhost:3001/fr' accessible, theme Skalean visible" "WARN" "(P0) Voir B-04 Tache 1.4.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V3: 'http://localhost:3001/ar' retourne page RTL (P0)
echo "  Verifying T01-V3 : 'http://localhost:3001/ar' retourne page RTL..."
add_row "T01-V3" "'http://localhost:3001/ar' retourne page RTL" "WARN" "(P0) Voir B-04 Tache 1.4.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V4: 'http://localhost:3001/' redirect vers '/fr/' (P0)
echo "  Verifying T01-V4 : 'http://localhost:3001/' redirect vers '/fr/'..."
add_row "T01-V4" "'http://localhost:3001/' redirect vers '/fr/'" "WARN" "(P0) Voir B-04 Tache 1.4.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V5: Console : pas d'erreur Next.js 15 (P0)
echo "  Verifying T01-V5 : Console : pas d'erreur Next.js 15..."
add_row "T01-V5" "Console : pas d'erreur Next.js 15" "WARN" "(P0) Voir B-04 Tache 1.4.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V6: Build prod reussit ('pnpm --filter @insurtech/web-broker build') (P0)
echo "  Verifying T01-V6 : Build prod reussit ('pnpm --filter @insurtech/web-broker build')..."
add_row "T01-V6" "Build prod reussit ('pnpm --filter @insurtech/web-broker build')" "WARN" "(P0) Voir B-04 Tache 1.4.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V7: API client interceptors injectent x-tenant-id + x-trace-id (P0)
echo "  Verifying T01-V7 : API client interceptors injectent x-tenant-id + x-trace-id..."
add_row "T01-V7" "API client interceptors injectent x-tenant-id + x-trace-id" "WARN" "(P0) Voir B-04 Tache 1.4.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V8: Lighthouse home Performance > 80 (baseline, cible Sprint 17 = 90) (P1)
echo "  Verifying T01-V8 : Lighthouse home Performance > 80 (baseline, cible Sprint 17 = 90)..."
add_row "T01-V8" "Lighthouse home Performance > 80 (baseline, cible Sprint 17 = 90)" "WARN" "(P1) Voir B-04 Tache 1.4.1 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 2/5 -- 1.4.2 : web-garage Bootstrap (Port 3002)

```bash
echo ""
echo "================================================"
echo "TACHE 1.4.2 : web-garage Bootstrap (Port 3002)"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T02-F2: Existence fichier package.json + next.config.mjs (port 3002)
if [ -f "package.json + next.config.mjs (port 3002)" ]; then
  add_row "T02-F2" "Fichier package.json + next.config.mjs (port 3002) existe" "PASS" "Cree"
else
  add_row "T02-F2" "Fichier package.json + next.config.mjs (port 3002) existe" "FAIL" "Manquant"
fi
# Test T02-F3: Existence fichier src/app/[locale]/layout.tsx
if [ -f "src/app/[locale]/layout.tsx" ]; then
  add_row "T02-F3" "Fichier layout.tsx existe" "PASS" "Cree"
else
  add_row "T02-F3" "Fichier layout.tsx existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T02-V1: Demarre port 3002 (P0)
echo "  Verifying T02-V1 : Demarre port 3002..."
add_row "T02-V1" "Demarre port 3002" "WARN" "(P0) Voir B-04 Tache 1.4.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V2: 3 locales accessibles (P0)
echo "  Verifying T02-V2 : 3 locales accessibles..."
add_row "T02-V2" "3 locales accessibles" "WARN" "(P0) Voir B-04 Tache 1.4.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V3: Theme Skalean variant garage applique (P0)
echo "  Verifying T02-V3 : Theme Skalean variant garage applique..."
add_row "T02-V3" "Theme Skalean variant garage applique" "WARN" "(P0) Voir B-04 Tache 1.4.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V4: Build prod reussit (P0)
echo "  Verifying T02-V4 : Build prod reussit..."
add_row "T02-V4" "Build prod reussit" "WARN" "(P0) Voir B-04 Tache 1.4.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V5: Vocabulaire garage dans messages (sinistre, devis, atelier) (P1)
echo "  Verifying T02-V5 : Vocabulaire garage dans messages (sinistre, devis, atelier)..."
add_row "T02-V5" "Vocabulaire garage dans messages (sinistre, devis, atelier)" "WARN" "(P1) Voir B-04 Tache 1.4.2 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 3/8 -- 1.4.3 : web-garage-mobile Bootstrap (Port 3003 -- PWA)

```bash
echo ""
echo "================================================"
echo "TACHE 1.4.3 : web-garage-mobile Bootstrap (Port 3003 -- PWA)"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 8"
echo "================================================"

# === Verification fichiers crees ===
# Test T03-F2: Existence fichier package.json + next.config.mjs (port 3003 + PWA config)
if [ -f "package.json + next.config.mjs (port 3003 + PWA config)" ]; then
  add_row "T03-F2" "Fichier package.json + next.config.mjs (port 3003 + PWA config) existe" "PASS" "Cree"
else
  add_row "T03-F2" "Fichier package.json + next.config.mjs (port 3003 + PWA config) existe" "FAIL" "Manquant"
fi
# Test T03-F3: Existence fichier public/manifest.webmanifest
if [ -f "public/manifest.webmanifest" ]; then
  add_row "T03-F3" "Fichier manifest.webmanifest existe" "PASS" "Cree"
else
  add_row "T03-F3" "Fichier manifest.webmanifest existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T03-V1: Demarre port 3003 (P0)
echo "  Verifying T03-V1 : Demarre port 3003..."
add_row "T03-V1" "Demarre port 3003" "WARN" "(P0) Voir B-04 Tache 1.4.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V2: Manifest valide (chrome://manifest) (P0)
echo "  Verifying T03-V2 : Manifest valide (chrome://manifest)..."
add_row "T03-V2" "Manifest valide (chrome://manifest)" "WARN" "(P0) Voir B-04 Tache 1.4.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V3: Service worker enregistre (DevTools > Application > Service Workers) (P0)
echo "  Verifying T03-V3 : Service worker enregistre (DevTools > Application > Service Workers)..."
add_row "T03-V3" "Service worker enregistre (DevTools > Application > Service Workers)" "WARN" "(P0) Voir B-04 Tache 1.4.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V4: Install prompt declenche (chrome devtools 'Install' button visible) (P0)
echo "  Verifying T03-V4 : Install prompt declenche (chrome devtools 'Install' button visible)..."
add_row "T03-V4" "Install prompt declenche (chrome devtools 'Install' button visible)" "WARN" "(P0) Voir B-04 Tache 1.4.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V5: Mode offline fonctionnel : page placeholder accessible meme deconnecte (P0)
echo "  Verifying T03-V5 : Mode offline fonctionnel : page placeholder accessible meme deconnecte..."
add_row "T03-V5" "Mode offline fonctionnel : page placeholder accessible meme deconnecte" "WARN" "(P0) Voir B-04 Tache 1.4.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V6: Lighthouse PWA score > 90 (P0)
echo "  Verifying T03-V6 : Lighthouse PWA score > 90..."
add_row "T03-V6" "Lighthouse PWA score > 90" "WARN" "(P0) Voir B-04 Tache 1.4.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V7: Theme color #E95D2C applique status bar mobile (P0)
echo "  Verifying T03-V7 : Theme color #E95D2C applique status bar mobile..."
add_row "T03-V7" "Theme color #E95D2C applique status bar mobile" "WARN" "(P0) Voir B-04 Tache 1.4.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V8: Hook useInstallPrompt + useOnlineStatus utilisables (P1)
echo "  Verifying T03-V8 : Hook useInstallPrompt + useOnlineStatus utilisables..."
add_row "T03-V8" "Hook useInstallPrompt + useOnlineStatus utilisables" "WARN" "(P1) Voir B-04 Tache 1.4.3 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 4/5 -- 1.4.4 : web-insurtech-admin Bootstrap (Port 3000)

```bash
echo ""
echo "================================================"
echo "TACHE 1.4.4 : web-insurtech-admin Bootstrap (Port 3000)"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T04-F2: Existence fichier package.json + next.config.mjs (port 3000)
if [ -f "package.json + next.config.mjs (port 3000)" ]; then
  add_row "T04-F2" "Fichier package.json + next.config.mjs (port 3000) existe" "PASS" "Cree"
else
  add_row "T04-F2" "Fichier package.json + next.config.mjs (port 3000) existe" "FAIL" "Manquant"
fi
# Test T04-F3: Existence fichier src/app/[locale]/layout.tsx (sidebar admin)
if [ -f "src/app/[locale]/layout.tsx (sidebar admin)" ]; then
  add_row "T04-F3" "Fichier layout.tsx (sidebar admin) existe" "PASS" "Cree"
else
  add_row "T04-F3" "Fichier layout.tsx (sidebar admin) existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T04-V1: Demarre port 3000 (P0)
echo "  Verifying T04-V1 : Demarre port 3000..."
add_row "T04-V1" "Demarre port 3000" "WARN" "(P0) Voir B-04 Tache 1.4.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V2: Theme admin variant (Navy dominant) applique (P0)
echo "  Verifying T04-V2 : Theme admin variant (Navy dominant) applique..."
add_row "T04-V2" "Theme admin variant (Navy dominant) applique" "WARN" "(P0) Voir B-04 Tache 1.4.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V3: Sidebar admin avec sections placeholder (P0)
echo "  Verifying T04-V3 : Sidebar admin avec sections placeholder..."
add_row "T04-V3" "Sidebar admin avec sections placeholder" "WARN" "(P0) Voir B-04 Tache 1.4.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V4: Build prod reussit (P0)
echo "  Verifying T04-V4 : Build prod reussit..."
add_row "T04-V4" "Build prod reussit" "WARN" "(P0) Voir B-04 Tache 1.4.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V5: Locale FR par defaut (P1)
echo "  Verifying T04-V5 : Locale FR par defaut..."
add_row "T04-V5" "Locale FR par defaut" "WARN" "(P1) Voir B-04 Tache 1.4.4 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 5/10 -- 1.4.5 : web-customer-portal Bootstrap (Port 3004 -- NEW v2.0 SSG + ISR + SEO)

```bash
echo ""
echo "================================================"
echo "TACHE 1.4.5 : web-customer-portal Bootstrap (Port 3004 -- NEW v2.0 SSG + I"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 10"
echo "================================================"

# === Verification fichiers crees ===
# Test T05-F2: Existence fichier package.json + next.config.mjs (port 3004 + ISR config)
if [ -f "package.json + next.config.mjs (port 3004 + ISR config)" ]; then
  add_row "T05-F2" "Fichier package.json + next.config.mjs (port 3004 + ISR config) existe" "PASS" "Cree"
else
  add_row "T05-F2" "Fichier package.json + next.config.mjs (port 3004 + ISR config) existe" "FAIL" "Manquant"
fi
# Test T05-F3: Existence fichier next-sitemap.config.js (sitemap.xml generation)
if [ -f "next-sitemap.config.js (sitemap.xml generation)" ]; then
  add_row "T05-F3" "Fichier next-sitemap.config.js (sitemap.xml generation) existe" "PASS" "Cree"
else
  add_row "T05-F3" "Fichier next-sitemap.config.js (sitemap.xml generation) existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T05-V1: Demarre port 3004 (P0)
echo "  Verifying T05-V1 : Demarre port 3004..."
add_row "T05-V1" "Demarre port 3004" "WARN" "(P0) Voir B-04 Tache 1.4.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V2: SSG : 'pnpm build' genere pages statiques (P0)
echo "  Verifying T05-V2 : SSG : 'pnpm build' genere pages statiques..."
add_row "T05-V2" "SSG : 'pnpm build' genere pages statiques" "WARN" "(P0) Voir B-04 Tache 1.4.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V3: ISR configure ('revalidate: 3600') (P0)
echo "  Verifying T05-V3 : ISR configure ('revalidate: 3600')..."
add_row "T05-V3" "ISR configure ('revalidate: 3600')" "WARN" "(P0) Voir B-04 Tache 1.4.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V4: sitemap.xml accessible '/sitemap.xml' (P0)
echo "  Verifying T05-V4 : sitemap.xml accessible '/sitemap.xml'..."
add_row "T05-V4" "sitemap.xml accessible '/sitemap.xml'" "WARN" "(P0) Voir B-04 Tache 1.4.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V5: robots.txt accessible (P0)
echo "  Verifying T05-V5 : robots.txt accessible..."
add_row "T05-V5" "robots.txt accessible" "WARN" "(P0) Voir B-04 Tache 1.4.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V6: Open Graph tags presents (test : meta scraper) (P0)
echo "  Verifying T05-V6 : Open Graph tags presents (test : meta scraper)..."
add_row "T05-V6" "Open Graph tags presents (test : meta scraper)" "WARN" "(P0) Voir B-04 Tache 1.4.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V7: Hreflang tags sur pages localisees (P0)
echo "  Verifying T05-V7 : Hreflang tags sur pages localisees..."
add_row "T05-V7" "Hreflang tags sur pages localisees" "WARN" "(P0) Voir B-04 Tache 1.4.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V8: Lighthouse Performance > 80 baseline (P0)
echo "  Verifying T05-V8 : Lighthouse Performance > 80 baseline..."
add_row "T05-V8" "Lighthouse Performance > 80 baseline" "WARN" "(P0) Voir B-04 Tache 1.4.5 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 6/5 -- 1.4.6 : web-assure-portal Bootstrap (Port 3005 -- NEW v2.0)

```bash
echo ""
echo "================================================"
echo "TACHE 1.4.6 : web-assure-portal Bootstrap (Port 3005 -- NEW v2.0)"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Pas de fichiers specifiques verifies pour cette tache (voir B-04)
add_row "T06-F0" "Tache 1.4.6 livrables" "SKIP" "Voir B-04 pour livrables detailles"

# === Verification criteres P0/P1/P2 ===
# Test T06-V1: Demarre port 3005 (P0)
echo "  Verifying T06-V1 : Demarre port 3005..."
add_row "T06-V1" "Demarre port 3005" "WARN" "(P0) Voir B-04 Tache 1.4.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V2: Theme variant assure (Sky Blue dominant) (P0)
echo "  Verifying T06-V2 : Theme variant assure (Sky Blue dominant)..."
add_row "T06-V2" "Theme variant assure (Sky Blue dominant)" "WARN" "(P0) Voir B-04 Tache 1.4.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V3: Pages placeholder accessibles (P0)
echo "  Verifying T06-V3 : Pages placeholder accessibles..."
add_row "T06-V3" "Pages placeholder accessibles" "WARN" "(P0) Voir B-04 Tache 1.4.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V4: Layout self-service (pas de sidebar dense) (P0)
echo "  Verifying T06-V4 : Layout self-service (pas de sidebar dense)..."
add_row "T06-V4" "Layout self-service (pas de sidebar dense)" "WARN" "(P0) Voir B-04 Tache 1.4.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V5: Build prod reussit (P0)
echo "  Verifying T06-V5 : Build prod reussit..."
add_row "T06-V5" "Build prod reussit" "WARN" "(P0) Voir B-04 Tache 1.4.6 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 7/6 -- 1.4.7 : web-assure-mobile Bootstrap (Port 3006 -- NEW v2.0 PWA)

```bash
echo ""
echo "================================================"
echo "TACHE 1.4.7 : web-assure-mobile Bootstrap (Port 3006 -- NEW v2.0 PWA)"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 6"
echo "================================================"

# === Verification fichiers crees ===
# Test T07-F2: Existence fichier package.json + next.config.mjs (port 3006 + PWA config)
if [ -f "package.json + next.config.mjs (port 3006 + PWA config)" ]; then
  add_row "T07-F2" "Fichier package.json + next.config.mjs (port 3006 + PWA config) existe" "PASS" "Cree"
else
  add_row "T07-F2" "Fichier package.json + next.config.mjs (port 3006 + PWA config) existe" "FAIL" "Manquant"
fi
# Test T07-F3: Existence fichier public/manifest.webmanifest (theme assure)
if [ -f "public/manifest.webmanifest (theme assure)" ]; then
  add_row "T07-F3" "Fichier manifest.webmanifest (theme assure) existe" "PASS" "Cree"
else
  add_row "T07-F3" "Fichier manifest.webmanifest (theme assure) existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T07-V1: Demarre port 3006 (P0)
echo "  Verifying T07-V1 : Demarre port 3006..."
add_row "T07-V1" "Demarre port 3006" "WARN" "(P0) Voir B-04 Tache 1.4.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V2: Manifest valide (P0)
echo "  Verifying T07-V2 : Manifest valide..."
add_row "T07-V2" "Manifest valide" "WARN" "(P0) Voir B-04 Tache 1.4.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V3: Service worker enregistre (P0)
echo "  Verifying T07-V3 : Service worker enregistre..."
add_row "T07-V3" "Service worker enregistre" "WARN" "(P0) Voir B-04 Tache 1.4.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V4: Lighthouse PWA > 90 (P0)
echo "  Verifying T07-V4 : Lighthouse PWA > 90..."
add_row "T07-V4" "Lighthouse PWA > 90" "WARN" "(P0) Voir B-04 Tache 1.4.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V5: Theme color ACAPS Teal status bar (P0)
echo "  Verifying T07-V5 : Theme color ACAPS Teal status bar..."
add_row "T07-V5" "Theme color ACAPS Teal status bar" "WARN" "(P0) Voir B-04 Tache 1.4.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V6: Page declarer-sinistre placeholder accessible (P1)
echo "  Verifying T07-V6 : Page declarer-sinistre placeholder accessible..."
add_row "T07-V6" "Page declarer-sinistre placeholder accessible" "WARN" "(P1) Voir B-04 Tache 1.4.7 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 8/9 -- 1.4.8 : Package shared-ui : Theme + 30+ Composants shadcn

```bash
echo ""
echo "================================================"
echo "TACHE 1.4.8 : Package shared-ui : Theme + 30+ Composants shadcn"
echo "Priorite : P0 | Effort : 8h"
echo "Criteres a verifier : 9"
echo "================================================"

# === Verification fichiers crees ===
# Test T08-F2: Existence fichier package.json + tsconfig.json
if [ -f "package.json + tsconfig.json" ]; then
  add_row "T08-F2" "Fichier package.json + tsconfig.json existe" "PASS" "Cree"
else
  add_row "T08-F2" "Fichier package.json + tsconfig.json existe" "FAIL" "Manquant"
fi
# Test T08-F3: Existence fichier src/index.ts (re-exports)
if [ -f "src/index.ts (re-exports)" ]; then
  add_row "T08-F3" "Fichier index.ts (re-exports) existe" "PASS" "Cree"
else
  add_row "T08-F3" "Fichier index.ts (re-exports) existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T08-V1: Package build reussit (P0)
echo "  Verifying T08-V1 : Package build reussit..."
add_row "T08-V1" "Package build reussit" "WARN" "(P0) Voir B-04 Tache 1.4.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V2: Tailwind preset utilisable depuis 8 apps (P0)
echo "  Verifying T08-V2 : Tailwind preset utilisable depuis 8 apps..."
add_row "T08-V2" "Tailwind preset utilisable depuis 8 apps" "WARN" "(P0) Voir B-04 Tache 1.4.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V3: Theme CSS variables Skalean appliquees (P0)
echo "  Verifying T08-V3 : Theme CSS variables Skalean appliquees..."
add_row "T08-V3" "Theme CSS variables Skalean appliquees" "WARN" "(P0) Voir B-04 Tache 1.4.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V4: 30+ composants shadcn presents et fonctionnels (P0)
echo "  Verifying T08-V4 : 30+ composants shadcn presents et fonctionnels..."
add_row "T08-V4" "30+ composants shadcn presents et fonctionnels" "WARN" "(P0) Voir B-04 Tache 1.4.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V5: Mode dark fonctionnel (P0)
echo "  Verifying T08-V5 : Mode dark fonctionnel..."
add_row "T08-V5" "Mode dark fonctionnel" "WARN" "(P0) Voir B-04 Tache 1.4.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V6: Mode RTL fonctionnel pour ar (P0)
echo "  Verifying T08-V6 : Mode RTL fonctionnel pour ar..."
add_row "T08-V6" "Mode RTL fonctionnel pour ar" "WARN" "(P0) Voir B-04 Tache 1.4.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V7: ThemeProvider + LocaleSwitcher operationnels (P0)
echo "  Verifying T08-V7 : ThemeProvider + LocaleSwitcher operationnels..."
add_row "T08-V7" "ThemeProvider + LocaleSwitcher operationnels" "WARN" "(P0) Voir B-04 Tache 1.4.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V8: Storybook setup (Tache 1.4.16) (P1)
echo "  Verifying T08-V8 : Storybook setup (Tache 1.4.16)..."
add_row "T08-V8" "Storybook setup (Tache 1.4.16)" "WARN" "(P1) Voir B-04 Tache 1.4.8 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 9/8 -- 1.4.9 : Package shared-pwa : Hooks PWA Install/Offline/SW (NEW v2.0)

```bash
echo ""
echo "================================================"
echo "TACHE 1.4.9 : Package shared-pwa : Hooks PWA Install/Offline/SW (NEW v2.0)"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 8"
echo "================================================"

# === Verification fichiers crees ===
# Test T09-F2: Existence fichier package.json + tsconfig.json
if [ -f "package.json + tsconfig.json" ]; then
  add_row "T09-F2" "Fichier package.json + tsconfig.json existe" "PASS" "Cree"
else
  add_row "T09-F2" "Fichier package.json + tsconfig.json existe" "FAIL" "Manquant"
fi
# Test T09-F3: Existence fichier src/index.ts
if [ -f "src/index.ts" ]; then
  add_row "T09-F3" "Fichier index.ts existe" "PASS" "Cree"
else
  add_row "T09-F3" "Fichier index.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T09-V1: Package build reussit (P0)
echo "  Verifying T09-V1 : Package build reussit..."
add_row "T09-V1" "Package build reussit" "WARN" "(P0) Voir B-04 Tache 1.4.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V2: 'useInstallPrompt()' utilisable, retourne 'canInstall: true' apres event capture (P0)
echo "  Verifying T09-V2 : 'useInstallPrompt()' utilisable, retourne 'canInstall: true' apres eve..."
add_row "T09-V2" "'useInstallPrompt()' utilisable, retourne 'canInstall: true' apres event capture" "WARN" "(P0) Voir B-04 Tache 1.4.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V3: 'useOnlineStatus()' retourne online/offline correct (P0)
echo "  Verifying T09-V3 : 'useOnlineStatus()' retourne online/offline correct..."
add_row "T09-V3" "'useOnlineStatus()' retourne online/offline correct" "WARN" "(P0) Voir B-04 Tache 1.4.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V4: 'useServiceWorker()' expose registration (P0)
echo "  Verifying T09-V4 : 'useServiceWorker()' expose registration..."
add_row "T09-V4" "'useServiceWorker()' expose registration" "WARN" "(P0) Voir B-04 Tache 1.4.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V5: '<PwaInstallBanner>' rendable (P0)
echo "  Verifying T09-V5 : '<PwaInstallBanner>' rendable..."
add_row "T09-V5" "'<PwaInstallBanner>' rendable" "WARN" "(P0) Voir B-04 Tache 1.4.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V6: Strategies offline documentees (P0)
echo "  Verifying T09-V6 : Strategies offline documentees..."
add_row "T09-V6" "Strategies offline documentees" "WARN" "(P0) Voir B-04 Tache 1.4.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V7: Tests hooks passent (P1)
echo "  Verifying T09-V7 : Tests hooks passent..."
add_row "T09-V7" "Tests hooks passent" "WARN" "(P1) Voir B-04 Tache 1.4.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V8: iOS Safari fallback documente (P1)
echo "  Verifying T09-V8 : iOS Safari fallback documente..."
add_row "T09-V8" "iOS Safari fallback documente" "WARN" "(P1) Voir B-04 Tache 1.4.9 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 10/8 -- 1.4.10 : Package shared-maps : Wrapper Mapbox GL JS (NEW v2.0)

```bash
echo ""
echo "================================================"
echo "TACHE 1.4.10 : Package shared-maps : Wrapper Mapbox GL JS (NEW v2.0)"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 8"
echo "================================================"

# === Verification fichiers crees ===
# Test T10-F2: Existence fichier package.json + tsconfig.json
if [ -f "package.json + tsconfig.json" ]; then
  add_row "T10-F2" "Fichier package.json + tsconfig.json existe" "PASS" "Cree"
else
  add_row "T10-F2" "Fichier package.json + tsconfig.json existe" "FAIL" "Manquant"
fi
# Test T10-F3: Existence fichier src/index.ts
if [ -f "src/index.ts" ]; then
  add_row "T10-F3" "Fichier index.ts existe" "PASS" "Cree"
else
  add_row "T10-F3" "Fichier index.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T10-V1: Package build reussit (P0)
echo "  Verifying T10-V1 : Package build reussit..."
add_row "T10-V1" "Package build reussit" "WARN" "(P0) Voir B-04 Tache 1.4.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V2: '<Map>' rendable avec center default Casablanca (P0)
echo "  Verifying T10-V2 : '<Map>' rendable avec center default Casablanca..."
add_row "T10-V2" "'<Map>' rendable avec center default Casablanca" "WARN" "(P0) Voir B-04 Tache 1.4.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V3: '<Marker>' ajoute marker (P0)
echo "  Verifying T10-V3 : '<Marker>' ajoute marker..."
add_row "T10-V3" "'<Marker>' ajoute marker" "WARN" "(P0) Voir B-04 Tache 1.4.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V4: 'useGeolocation()' retourne position (P0)
echo "  Verifying T10-V4 : 'useGeolocation()' retourne position..."
add_row "T10-V4" "'useGeolocation()' retourne position" "WARN" "(P0) Voir B-04 Tache 1.4.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V5: 'useReverseGeocoding()' retourne adresse (P0)
echo "  Verifying T10-V5 : 'useReverseGeocoding()' retourne adresse..."
add_row "T10-V5" "'useReverseGeocoding()' retourne adresse" "WARN" "(P0) Voir B-04 Tache 1.4.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V6: '<SearchBox>' autocomplete fonctionnel (P0)
echo "  Verifying T10-V6 : '<SearchBox>' autocomplete fonctionnel..."
add_row "T10-V6" "'<SearchBox>' autocomplete fonctionnel" "WARN" "(P0) Voir B-04 Tache 1.4.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V7: Style custom Skalean applique (P1)
echo "  Verifying T10-V7 : Style custom Skalean applique..."
add_row "T10-V7" "Style custom Skalean applique" "WARN" "(P1) Voir B-04 Tache 1.4.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V8: Marker cluster rend si > 50 markers (P1)
echo "  Verifying T10-V8 : Marker cluster rend si > 50 markers..."
add_row "T10-V8" "Marker cluster rend si > 50 markers" "WARN" "(P1) Voir B-04 Tache 1.4.10 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 11/10 -- 1.4.11 : Multilingue next-intl 8 Apps + RTL

```bash
echo ""
echo "================================================"
echo "TACHE 1.4.11 : Multilingue next-intl 8 Apps + RTL"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 10"
echo "================================================"

# === Verification fichiers crees ===
# Test T11-F2: Existence fichier routing.ts (locales, defaultLocale, pathnames)
if [ -f "routing.ts (locales, defaultLocale, pathnames)" ]; then
  add_row "T11-F2" "Fichier routing.ts (locales, defaultLocale, pathnames) existe" "PASS" "Cree"
else
  add_row "T11-F2" "Fichier routing.ts (locales, defaultLocale, pathnames) existe" "FAIL" "Manquant"
fi
# Test T11-F3: Existence fichier request.ts (loadMessages depuis dossier app courant)
if [ -f "request.ts (loadMessages depuis dossier app courant)" ]; then
  add_row "T11-F3" "Fichier request.ts (loadMessages depuis dossier app courant) existe" "PASS" "Cree"
else
  add_row "T11-F3" "Fichier request.ts (loadMessages depuis dossier app courant) existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T11-V1: 3 locales accessibles sur les 8 apps : '/fr', '/ar-MA', '/ar' (P0)
echo "  Verifying T11-V1 : 3 locales accessibles sur les 8 apps : '/fr', '/ar-MA', '/ar'..."
add_row "T11-V1" "3 locales accessibles sur les 8 apps : '/fr', '/ar-MA', '/ar'" "WARN" "(P0) Voir B-04 Tache 1.4.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V2: 'dir='rtl'' automatique sur '<html>' si ar (P0)
echo "  Verifying T11-V2 : 'dir='rtl'' automatique sur '<html>' si ar..."
add_row "T11-V2" "'dir='rtl'' automatique sur '<html>' si ar" "WARN" "(P0) Voir B-04 Tache 1.4.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V3: Middleware redirect '/dashboard' -> '/fr/dashboard' (P0)
echo "  Verifying T11-V3 : Middleware redirect '/dashboard' -> '/fr/dashboard'..."
add_row "T11-V3" "Middleware redirect '/dashboard' -> '/fr/dashboard'" "WARN" "(P0) Voir B-04 Tache 1.4.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V4: Cookie locale persiste preference (P0)
echo "  Verifying T11-V4 : Cookie locale persiste preference..."
add_row "T11-V4" "Cookie locale persiste preference" "WARN" "(P0) Voir B-04 Tache 1.4.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V5: Accept-Language header respecte si pas de cookie (P0)
echo "  Verifying T11-V5 : Accept-Language header respecte si pas de cookie..."
add_row "T11-V5" "Accept-Language header respecte si pas de cookie" "WARN" "(P0) Voir B-04 Tache 1.4.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V6: Tailwind RTL utilities actives (P0)
echo "  Verifying T11-V6 : Tailwind RTL utilities actives..."
add_row "T11-V6" "Tailwind RTL utilities actives" "WARN" "(P0) Voir B-04 Tache 1.4.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V7: Fonts arabes chargees correctement (Noto Naskh Arabic) (P0)
echo "  Verifying T11-V7 : Fonts arabes chargees correctement (Noto Naskh Arabic)..."
add_row "T11-V7" "Fonts arabes chargees correctement (Noto Naskh Arabic)" "WARN" "(P0) Voir B-04 Tache 1.4.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V8: Messages chargees pour la locale (test : changer locale -> texte change) (P0)
echo "  Verifying T11-V8 : Messages chargees pour la locale (test : changer locale -> texte chang..."
add_row "T11-V8" "Messages chargees pour la locale (test : changer locale -> texte change)" "WARN" "(P0) Voir B-04 Tache 1.4.11 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 12/6 -- 1.4.12 : Tooling Monorepo Frontend (Turbo + Scripts Dev Parallel)

```bash
echo ""
echo "================================================"
echo "TACHE 1.4.12 : Tooling Monorepo Frontend (Turbo + Scripts Dev Parallel)"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 6"
echo "================================================"

# === Verification fichiers crees ===
# Test T12-F1: Existence fichier repo/package.json
if [ -f "repo/package.json" ]; then
  add_row "T12-F1" "Fichier package.json existe" "PASS" "Cree"
else
  add_row "T12-F1" "Fichier package.json existe" "FAIL" "Manquant"
fi
# Test T12-F2: Existence fichier repo/turbo.json
if [ -f "repo/turbo.json" ]; then
  add_row "T12-F2" "Fichier turbo.json existe" "PASS" "Cree"
else
  add_row "T12-F2" "Fichier turbo.json existe" "FAIL" "Manquant"
fi
# Test T12-F3: Existence fichier repo/scripts/dev-portals.sh
if [ -f "repo/scripts/dev-portals.sh" ]; then
  add_row "T12-F3" "Fichier dev-portals.sh existe" "PASS" "Cree"
else
  add_row "T12-F3" "Fichier dev-portals.sh existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T12-V1: 'pnpm dev:web-broker' demarre 1 app (P0)
echo "  Verifying T12-V1 : 'pnpm dev:web-broker' demarre 1 app..."
add_row "T12-V1" "'pnpm dev:web-broker' demarre 1 app" "WARN" "(P0) Voir B-04 Tache 1.4.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V2: 'pnpm dev:portals' demarre 3 apps (P0)
echo "  Verifying T12-V2 : 'pnpm dev:portals' demarre 3 apps..."
add_row "T12-V2" "'pnpm dev:portals' demarre 3 apps" "WARN" "(P0) Voir B-04 Tache 1.4.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V3: Modification dans shared-ui hot-reload les 8 apps (P0)
echo "  Verifying T12-V3 : Modification dans shared-ui hot-reload les 8 apps..."
add_row "T12-V3" "Modification dans shared-ui hot-reload les 8 apps" "WARN" "(P0) Voir B-04 Tache 1.4.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V4: 'pnpm build:apps' reussit (P0)
echo "  Verifying T12-V4 : 'pnpm build:apps' reussit..."
add_row "T12-V4" "'pnpm build:apps' reussit" "WARN" "(P0) Voir B-04 Tache 1.4.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V5: 'pnpm doctor' verifie environnement (P0)
echo "  Verifying T12-V5 : 'pnpm doctor' verifie environnement..."
add_row "T12-V5" "'pnpm doctor' verifie environnement" "WARN" "(P0) Voir B-04 Tache 1.4.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V6: 'pnpm dev:all' fonctionne sur machine 16+ GB RAM (P1)
echo "  Verifying T12-V6 : 'pnpm dev:all' fonctionne sur machine 16+ GB RAM..."
add_row "T12-V6" "'pnpm dev:all' fonctionne sur machine 16+ GB RAM" "WARN" "(P1) Voir B-04 Tache 1.4.12 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 13/6 -- 1.4.13 : Generation Client API TypeScript depuis OpenAPI

```bash
echo ""
echo "================================================"
echo "TACHE 1.4.13 : Generation Client API TypeScript depuis OpenAPI"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 6"
echo "================================================"

# === Verification fichiers crees ===
# Test T13-F2: Existence fichier package.json + tsconfig.json
if [ -f "package.json + tsconfig.json" ]; then
  add_row "T13-F2" "Fichier package.json + tsconfig.json existe" "PASS" "Cree"
else
  add_row "T13-F2" "Fichier package.json + tsconfig.json existe" "FAIL" "Manquant"
fi
# Test T13-F3: Existence fichier src/types.gen.ts (genere -- ~10000 lignes apres Sprint 5+)
if [ -f "src/types.gen.ts (genere -- ~10000 lignes apres Sprint 5+)" ]; then
  add_row "T13-F3" "Fichier types.gen.ts (genere -- ~10000 lignes apres Sprint 5+) existe" "PASS" "Cree"
else
  add_row "T13-F3" "Fichier types.gen.ts (genere -- ~10000 lignes apres Sprint 5+) existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T13-V1: 'pnpm generate:api-client' reussit (P0)
echo "  Verifying T13-V1 : 'pnpm generate:api-client' reussit..."
add_row "T13-V1" "'pnpm generate:api-client' reussit" "WARN" "(P0) Voir B-04 Tache 1.4.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V2: Types generes : test TypeScript autocomplete sur endpoint '/api/v1/auth/login' (P0)
echo "  Verifying T13-V2 : Types generes : test TypeScript autocomplete sur endpoint '/api/v1/aut..."
add_row "T13-V2" "Types generes : test TypeScript autocomplete sur endpoint '/api/v1/auth/login'" "WARN" "(P0) Voir B-04 Tache 1.4.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V3: Hook 'useApiQuery' typed retourne data correctement (P0)
echo "  Verifying T13-V3 : Hook 'useApiQuery' typed retourne data correctement..."
add_row "T13-V3" "Hook 'useApiQuery' typed retourne data correctement" "WARN" "(P0) Voir B-04 Tache 1.4.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V4: Erreur compilation si endpoint inexistant (P0)
echo "  Verifying T13-V4 : Erreur compilation si endpoint inexistant..."
add_row "T13-V4" "Erreur compilation si endpoint inexistant" "WARN" "(P0) Voir B-04 Tache 1.4.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V5: Documentation workflow regeneration claire (P0)
echo "  Verifying T13-V5 : Documentation workflow regeneration claire..."
add_row "T13-V5" "Documentation workflow regeneration claire" "WARN" "(P0) Voir B-04 Tache 1.4.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V6: Tests integration : appel API reel via client genere (P1)
echo "  Verifying T13-V6 : Tests integration : appel API reel via client genere..."
add_row "T13-V6" "Tests integration : appel API reel via client genere" "WARN" "(P1) Voir B-04 Tache 1.4.13 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 14/9 -- 1.4.14 : Layouts Partages (Sidebar + Topbar) Par Type App

```bash
echo ""
echo "================================================"
echo "TACHE 1.4.14 : Layouts Partages (Sidebar + Topbar) Par Type App"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 9"
echo "================================================"

# === Verification fichiers crees ===
# Test T14-F2: Existence fichier DashboardLayout.tsx (~120 lignes)
if [ -f "DashboardLayout.tsx (~120 lignes)" ]; then
  add_row "T14-F2" "Fichier DashboardLayout.tsx (~120 lignes) existe" "PASS" "Cree"
else
  add_row "T14-F2" "Fichier DashboardLayout.tsx (~120 lignes) existe" "FAIL" "Manquant"
fi
# Test T14-F3: Existence fichier SelfServiceLayout.tsx (~80 lignes)
if [ -f "SelfServiceLayout.tsx (~80 lignes)" ]; then
  add_row "T14-F3" "Fichier SelfServiceLayout.tsx (~80 lignes) existe" "PASS" "Cree"
else
  add_row "T14-F3" "Fichier SelfServiceLayout.tsx (~80 lignes) existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T14-V1: '<DashboardLayout>' rendable avec sidebar + topbar (P0)
echo "  Verifying T14-V1 : '<DashboardLayout>' rendable avec sidebar + topbar..."
add_row "T14-V1" "'<DashboardLayout>' rendable avec sidebar + topbar" "WARN" "(P0) Voir B-04 Tache 1.4.14 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T14-V2: '<SelfServiceLayout>' rendable (P0)
echo "  Verifying T14-V2 : '<SelfServiceLayout>' rendable..."
add_row "T14-V2" "'<SelfServiceLayout>' rendable" "WARN" "(P0) Voir B-04 Tache 1.4.14 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T14-V3: '<MobileLayout>' rendable avec BottomTabs (P0)
echo "  Verifying T14-V3 : '<MobileLayout>' rendable avec BottomTabs..."
add_row "T14-V3" "'<MobileLayout>' rendable avec BottomTabs" "WARN" "(P0) Voir B-04 Tache 1.4.14 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T14-V4: '<PublicLayout>' rendable (P0)
echo "  Verifying T14-V4 : '<PublicLayout>' rendable..."
add_row "T14-V4" "'<PublicLayout>' rendable" "WARN" "(P0) Voir B-04 Tache 1.4.14 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T14-V5: Sidebar responsive (drawer mobile, collapse desktop) (P0)
echo "  Verifying T14-V5 : Sidebar responsive (drawer mobile, collapse desktop)..."
add_row "T14-V5" "Sidebar responsive (drawer mobile, collapse desktop)" "WARN" "(P0) Voir B-04 Tache 1.4.14 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T14-V6: Bottom tabs visible uniquement < md (P0)
echo "  Verifying T14-V6 : Bottom tabs visible uniquement < md..."
add_row "T14-V6" "Bottom tabs visible uniquement < md" "WARN" "(P0) Voir B-04 Tache 1.4.14 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T14-V7: Hook useSidebarOpen partage state (P0)
echo "  Verifying T14-V7 : Hook useSidebarOpen partage state..."
add_row "T14-V7" "Hook useSidebarOpen partage state" "WARN" "(P0) Voir B-04 Tache 1.4.14 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T14-V8: Layouts utilises dans 8 apps stubs (P1)
echo "  Verifying T14-V8 : Layouts utilises dans 8 apps stubs..."
add_row "T14-V8" "Layouts utilises dans 8 apps stubs" "WARN" "(P1) Voir B-04 Tache 1.4.14 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 15/6 -- 1.4.15 : Pages Placeholder + 404/500

```bash
echo ""
echo "================================================"
echo "TACHE 1.4.15 : Pages Placeholder + 404/500"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 6"
echo "================================================"

# === Verification fichiers crees ===
# Test T15-F1: Existence fichier repo/apps/{8 apps}/src/app/[locale]/not-found.tsx
if [ -f "repo/apps/{8 apps}/src/app/[locale]/not-found.tsx" ]; then
  add_row "T15-F1" "Fichier not-found.tsx existe" "PASS" "Cree"
else
  add_row "T15-F1" "Fichier not-found.tsx existe" "FAIL" "Manquant"
fi
# Test T15-F2: Existence fichier repo/apps/{8 apps}/src/app/[locale]/error.tsx
if [ -f "repo/apps/{8 apps}/src/app/[locale]/error.tsx" ]; then
  add_row "T15-F2" "Fichier error.tsx existe" "PASS" "Cree"
else
  add_row "T15-F2" "Fichier error.tsx existe" "FAIL" "Manquant"
fi
# Test T15-F3: Existence fichier repo/apps/{8 apps}/src/app/[locale]/loading.tsx
if [ -f "repo/apps/{8 apps}/src/app/[locale]/loading.tsx" ]; then
  add_row "T15-F3" "Fichier loading.tsx existe" "PASS" "Cree"
else
  add_row "T15-F3" "Fichier loading.tsx existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T15-V1: 404 page rendable + branded (P0)
echo "  Verifying T15-V1 : 404 page rendable + branded..."
add_row "T15-V1" "404 page rendable + branded" "WARN" "(P0) Voir B-04 Tache 1.4.15 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T15-V2: 500 page error boundary fonctionnel (test : throw Error) (P0)
echo "  Verifying T15-V2 : 500 page error boundary fonctionnel (test : throw Error)..."
add_row "T15-V2" "500 page error boundary fonctionnel (test : throw Error)" "WARN" "(P0) Voir B-04 Tache 1.4.15 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T15-V3: Loading page rendable (P0)
echo "  Verifying T15-V3 : Loading page rendable..."
add_row "T15-V3" "Loading page rendable" "WARN" "(P0) Voir B-04 Tache 1.4.15 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T15-V4: Texte localise 3 locales (P0)
echo "  Verifying T15-V4 : Texte localise 3 locales..."
add_row "T15-V4" "Texte localise 3 locales" "WARN" "(P0) Voir B-04 Tache 1.4.15 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T15-V5: traceId visible sur page 500 (P0)
echo "  Verifying T15-V5 : traceId visible sur page 500..."
add_row "T15-V5" "traceId visible sur page 500" "WARN" "(P0) Voir B-04 Tache 1.4.15 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T15-V6: Sentry capture 500 frontend (P1)
echo "  Verifying T15-V6 : Sentry capture 500 frontend..."
add_row "T15-V6" "Sentry capture 500 frontend" "WARN" "(P1) Voir B-04 Tache 1.4.15 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 16/9 -- 1.4.16 : Tests E2E + Lighthouse Baseline + Storybook (P1)

```bash
echo ""
echo "================================================"
echo "TACHE 1.4.16 : Tests E2E + Lighthouse Baseline + Storybook (P1)"
echo "Priorite :  | Effort : "
echo "Criteres a verifier : 9"
echo "================================================"

# === Verification fichiers crees ===
# Test T16-F1: Existence fichier repo/e2e/web/web-broker.spec.ts
if [ -f "repo/e2e/web/web-broker.spec.ts" ]; then
  add_row "T16-F1" "Fichier web-broker.spec.ts existe" "PASS" "Cree"
else
  add_row "T16-F1" "Fichier web-broker.spec.ts existe" "FAIL" "Manquant"
fi
# Test T16-F2: Existence fichier repo/e2e/web/web-garage.spec.ts
if [ -f "repo/e2e/web/web-garage.spec.ts" ]; then
  add_row "T16-F2" "Fichier web-garage.spec.ts existe" "PASS" "Cree"
else
  add_row "T16-F2" "Fichier web-garage.spec.ts existe" "FAIL" "Manquant"
fi
# Test T16-F3: Existence fichier ... (8 specs apps)
if [ -f "... (8 specs apps)" ]; then
  add_row "T16-F3" "Fichier ... (8 specs apps) existe" "PASS" "Cree"
else
  add_row "T16-F3" "Fichier ... (8 specs apps) existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T16-V1: 8 specs E2E desktop passent (P0)
echo "  Verifying T16-V1 : 8 specs E2E desktop passent..."
add_row "T16-V1" "8 specs E2E desktop passent" "WARN" "(P0) Voir B-04 Tache 1.4.16 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T16-V2: 2 specs E2E mobile passent (P0)
echo "  Verifying T16-V2 : 2 specs E2E mobile passent..."
add_row "T16-V2" "2 specs E2E mobile passent" "WARN" "(P0) Voir B-04 Tache 1.4.16 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T16-V3: Lighthouse baseline genere pour 8 apps (P0)
echo "  Verifying T16-V3 : Lighthouse baseline genere pour 8 apps..."
add_row "T16-V3" "Lighthouse baseline genere pour 8 apps" "WARN" "(P0) Voir B-04 Tache 1.4.16 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T16-V4: Performance >= 70 partout (P0)
echo "  Verifying T16-V4 : Performance >= 70 partout..."
add_row "T16-V4" "Performance >= 70 partout" "WARN" "(P0) Voir B-04 Tache 1.4.16 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T16-V5: Accessibility >= 90 partout (P0)
echo "  Verifying T16-V5 : Accessibility >= 90 partout..."
add_row "T16-V5" "Accessibility >= 90 partout" "WARN" "(P0) Voir B-04 Tache 1.4.16 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T16-V6: PWA score >= 90 sur 2 apps mobile (P0)
echo "  Verifying T16-V6 : PWA score >= 90 sur 2 apps mobile..."
add_row "T16-V6" "PWA score >= 90 sur 2 apps mobile" "WARN" "(P0) Voir B-04 Tache 1.4.16 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T16-V7: Storybook setup + 30+ stories presents (P1)
echo "  Verifying T16-V7 : Storybook setup + 30+ stories presents..."
add_row "T16-V7" "Storybook setup + 30+ stories presents" "WARN" "(P1) Voir B-04 Tache 1.4.16 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T16-V8: Storybook accessible :6006 (P1)
echo "  Verifying T16-V8 : Storybook accessible :6006..."
add_row "T16-V8" "Storybook accessible :6006" "WARN" "(P1) Voir B-04 Tache 1.4.16 pour test detaille - critere a auto-tester via script ad-hoc"

```

---


---


## VERIFICATIONS TRANSVERSALES SPRINT 4

### TR-BUILD : Build complet du sprint

```bash
echo ""
echo "================================================"
echo "VERIFICATIONS TRANSVERSALES SPRINT 4"
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



---

## GENERATION DU RAPPORT FINAL

```bash
echo ""
echo "================================================"
echo "GENERATION DU RAPPORT FINAL SPRINT 4"
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

## Jalon GO/NO-GO Sprint 4

EOF

# Calcul statut final
if (( $(echo "$SCORE >= 95" | bc -l) )); then
  STATUT="GO"
  cat >> "$REPORT_FILE" << EOF
**STATUT** : GO -- Sprint 4 valide, passage Sprint 5 autorise

Le sprint a passe les criteres requis. Cowork peut demarrer Sprint 5.

EOF
  echo ""
  echo "================================================"
  echo "SPRINT 4 : GO ($SCORE%)"
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
  echo "SPRINT 4 : GO CONDITIONNEL ($SCORE%)"
  echo "================================================"
else
  STATUT="NO-GO"
  cat >> "$REPORT_FILE" << EOF
**STATUT** : NO-GO -- Score $SCORE% trop bas (cible 85% minimum)

Le sprint **doit etre repris** :
- Lister tous FAIL P0
- Escalation Saad/Abla decision (cut scope OR delai)
- Reprise sprint avant Sprint 5

EOF
  echo ""
  echo "================================================"
  echo "SPRINT 4 : NO-GO ($SCORE%)"
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
  echo "git commit -m \"chore(sprint-04): close sprint 4 -- $STATUT ($SCORE%)\"" >> "$REPORT_FILE"
  echo '```' >> "$REPORT_FILE"
fi

echo ""
echo "Rapport complet dans : $REPORT_FILE"
```

---

## INSTRUCTION FINALE A CLAUDE CODE / COWORK

Apres l'execution complete des verifications ci-dessus :

1. **Lis le contenu de `sprint04-verify-report.md`** integralement
2. **Identifie les FAIL critiques** (criteres P0) qui necessitent intervention manuelle
3. **Affiche un resume executif** :
   - Nombre total de criteres
   - Pourcentage PASS / PASS\* / FAIL / WARN
   - Liste des FAIL avec contexte technique
   - Recommandation : GO / GO CONDITIONNEL / NO-GO
4. **Si NO-GO** : ne pas demarrer le Sprint suivant, alerter Saad/Abla via Slack `#insurtech-dev`
5. **Si GO ou GO CONDITIONNEL** : produire le commit de cloture du sprint :

```bash
git add skalean-insurtech/sprint04-verify-report.md
git commit -m "chore(sprint-04): close sprint 4 with verification report

- Verification automatique executee
- Score global : <SCORE>%
- <PASS> criteres PASS, <PASS_REPAIRED> reparations auto, <FAIL> FAIL
- Statut : <GO|GO CONDITIONNEL|NO-GO>

Phase: 1 -- Bootstrap Infrastructure
Sprint: 4 (Phase 1 / Sprint 4)
Reference B-04, C-04, V-04
Report: sprint04-verify-report.md"
```

6. **Documentation continue** : si decisions techniques prises pendant verification, ajouter notes dans `repo/docs/runbooks/sprint-04-lessons-learned.md`

---

**Fin de la verification V-04 v2.2 detaillee -- Sprint 4 (1.4) Frontend Bootstrap (8 apps Next.js).**

**Total criteres taches** : 118 | **Total transversaux** : ~10 | **Effort sprint** : 90h
