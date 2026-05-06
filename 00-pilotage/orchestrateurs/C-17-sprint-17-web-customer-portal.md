# ORCHESTRATEUR SPRINT 17 -- Phase 4 / Sprint 4 : Web Customer Portal vente en ligne SEO
# 14 taches sequentielles + verification finale
# AUCUNE EMOJI AUTORISEE

**Version** : v2.2 (Option B detaillee)
**Phase** : 4 -- Vertical Insure (Skalean Broker ERP)
**Sprint** : 17 / 35 (cumul) -- Sprint 4 dans Phase 4
**Reference meta-prompt** : `B-17-sprint-17-web-customer-portal.md`
**Reference verification** : `V-17-sprint-17-verification.md`
**Numerotation taches** : 4.4.1 a 4.4.14
**Effort total** : ~80 heures developpement / 2 semaines
**Apport metier** : web-customer-portal vente en ligne SEO Lighthouse 95+

---

Tu es **Claude Code (ou Cowork)**. Tu dois executer **TOUTES les 14 taches** du Sprint 17 **UNE PAR UNE** dans l'ordre defini ci-dessous, puis lancer la verification automatique du sprint.

**Cet orchestrateur extrait le contenu detaille de chaque tache depuis B-17** -- pour code complet, patterns critiques et tests exhaustifs, lire le meta-prompt B-17 reference dans chaque tache.

---

## OBJECTIF DU SPRINT 17

Sprint 17 (4.4) -- Web Customer Portal vente en ligne SEO. Voir B-17-sprint-17-web-customer-portal.md pour contexte detaille.

---

## STRUCTURE DES FICHIERS

**Prompts des taches** (a executer en sequence) :
```
skalean-insurtech/00-pilotage/prompts-taches/sprint-17-web-customer-portal/
  task-4.4.1-prompt.md       # App Skeleton + Public Layout + SEO Foundation
  task-4.4.2-prompt.md       # Landing Page Racine
  task-4.4.3-prompt.md       # 5 Pages Branches
  task-4.4.4-prompt.md       # Tarification Simulator
  task-4.4.5-prompt.md       # Comparateur Multi-Produits
  task-4.4.6-prompt.md       # Souscription Wizard Etape 1 : Data Personnelle
  task-4.4.7-prompt.md       # Souscription Wizard Etape 2 : KYC
  task-4.4.8-prompt.md       # Souscription Wizard Etape 3 : Paiement
  task-4.4.9-prompt.md       # Souscription Wizard Etape 4 : Signature + Confirmation
  task-4.4.10-prompt.md       # Provisional Policy Generation + Display + PDF
  task-4.4.11-prompt.md       # SEO Complet
  task-4.4.12-prompt.md       # I18n + RTL + Mobile-First Responsive
  task-4.4.13-prompt.md       # Analytics Tracking
  task-4.4.14-prompt.md       # Tests E2E + Lighthouse
```

**Verification du sprint** (a lancer APRES toutes les taches) :
```
skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-17-sprint-17-verification.md
```

**Code source modifie** : `skalean-insurtech/repo/` (jamais 00-pilotage/)

**Decisions strategiques applicables** : voir `00-pilotage/decisions/001-010-*.md`

---

## REGLES D'EXECUTION CRITIQUES

### Execution sequentielle obligatoire

Tu DOIS attendre qu'une tache soit COMPLETEMENT TERMINEE avant de demarrer la suivante :
1. **Lire** le fichier prompt de la tache
2. **Implementer** TOUT le code demande dans `repo/`
3. **Compiler** (`pnpm tsc --noEmit` -- 0 erreur)
4. **Tester** (`pnpm vitest run` -- tous tests PASS)
5. **Linter** (`pnpm lint` -- 0 erreur)
6. **Commit** Conventional Commits (`git add -A && git commit`)
7. **SEULEMENT APRES** le commit, passer a la tache suivante

Raison : les taches ont des **dependances** entre elles. La tache N peut importer du code cree par la tache N-1. Executer en parallele creerait des conflits irreconciliables.

### Si une tache echoue

1. Tente de **reparer l'erreur** (3 tentatives maximum)
2. Si impossible, **note l'erreur** dans le rapport et **passe** a la tache suivante
3. **N'arrete JAMAIS** l'execution du sprint entier -- continue les taches restantes
4. La verification finale V-17 identifiera taches FAIL pour reprise ciblee

### Verification finale automatique

APRES avoir execute les 14 taches et commite chacune :
```bash
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-17-sprint-17-verification.md
```
Puis tu **executes CHAQUE section** du fichier de verification (commandes bash + checks automatiques).

---

## REGLES ABSOLUES skalean-insurtech (a appliquer dans CHAQUE tache)

### Conventions techniques

- **Multi-tenant** : CHAQUE query DB filtre par `tenant_id` automatique (Subscriber + RLS) + header `x-tenant-id` obligatoire sauf `/api/v1/public/*` et `/api/v1/admin/*`
- **Validation** : Zod uniquement (JAMAIS class-validator)
- **Logger** : Pino via `this.logger` (JAMAIS `console.log`, JAMAIS `new Logger()`)
- **Events** : Kafka sur `insurtech.events.{vertical}.{entity}.{action}` pour chaque action metier
- **RBAC** : `@Roles()` + `RolesGuard` + `TenantGuard` sur chaque endpoint
- **Tests** : Vitest, chaque fichier `.ts` a un fichier `.spec.ts` (coverage >= 85% global, 90% modules critiques)
- **Types** : TypeScript strict, **AUCUN `any` implicite**, `noUncheckedIndexedAccess: true`
- **Hash password** : argon2id (JAMAIS bcrypt, JAMAIS scrypt)
- **JWT** : RS256 + key rotation 90 jours
- **Encryption at rest** : AES-256-GCM (Atlas Cloud Services KMS)
- **Package manager** : pnpm (JAMAIS npm ou yarn)
- **Imports** : `@insurtech/*` pour packages partages
- **Skalean AI** : utilise UNIQUEMENT via `@insurtech/sky` ou MCP client (JAMAIS de duplication LLM/RAG/vector store)
- **AUCUNE EMOJI** dans le code, commentaires ou logs (decision-006 ABSOLUE)
- **Idempotency-Key** : header obligatoire pour mutations + tools MCP write
- **Conventional Commits** : tous commits suivent `<type>(scope): description`

### Conformite InsurTech Maroc (9 lois MA)

- **Audit ACAPS** : chaque ecriture sur `insure_*`, `repair_*`, `pay_*` declenche entree dans `compliance_acaps_audits` (10 ans retention)
- **Donnees Maroc** (loi 09-08 CNDP) : aucune donnee assure/police/sinistre/paiement ne transite hors **Atlas Cloud Services Benguerir** (decision-008 -- DC1 Tier III + DC2 Tier IV)
- **Multilinguisme** : toute communication assure (notifications/emails/WhatsApp/Sky) supporte fr/ar-MA (darija)/ar (classique)/en
- **Conformite loi 43-20** : signatures electroniques utilisent uniquement `@insurtech/signature` (Barid eSign + ANRT TSA RFC 3161 + archivage 10 ans)
- **Conformite loi 17-99 article 9** : droit retract 30j B2C tracable (Sprint 15 cancellation_legal_basis)
- **Conformite loi 9-88** : ecritures comptables CGNC plan + SAFT-MA export DGI
- **Conformite loi 43-05** : AML monitoring + SAR generation AMC
- **TVA MA** : 5 taux (0/7/10/14/20%) -- Sprint 12
- **CNSS** : 4.48% + **AMO** : 2.26% -- Sprint 13 paie
- **BAM** : limit 100k MAD + 3D Secure obligatoire (Sprint 11)
- **Notification breach** : sous 72h CNDP + Atlas Cloud Services SOC

---

## CONTEXTE PHASE 4 -- Vertical Insure (Skalean Broker ERP)

### Position du Sprint 4 dans la Phase 4

Sprint 17 (4.4) -- **Web Customer Portal vente en ligne SEO**.

Voir `B-17-sprint-17-web-customer-portal.md` (section "POSITION DANS LA PHASE" + "DEPENDANCES") pour contexte detaille des dependances cross-sprints (entrees consommees + sorties produites).

### Modules concernes par cette Phase

@insurtech/insure, apps/web-broker, apps/web-customer-portal, apps/web-assure-portal, apps/web-assure-mobile

### Apport metier de ce sprint

web-customer-portal vente en ligne SEO Lighthouse 95+

### Decisions strategiques applicables

Cf. `00-pilotage/decisions/`. Decisions cles pour ce sprint : voir B-17 section "Decisions strategiques applicables".

---

## EXECUTION SEQUENTIELLE DES 14 TACHES

Chaque tache ci-dessous indique : metadata (priorite/effort/deps), but extrait de B-17, actions principales (livrables checkables), fichiers cibles, criteres P0, validation et commit.

**Pour code complet, patterns critiques, tests exhaustifs** : lire le prompt tache detaille genere depuis B-17.

---

### Tache 1 / 14 : App Skeleton + Public Layout + SEO Foundation

**Metadonnees** : P0 | 6h | Depend de : Depend de Sprint 16

**But** : Initialiser app `web-customer-portal` Next.js 15 publique (no auth required) avec SEO foundation : metadata API + robots + sitemap structure + OG images.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-17-web-customer-portal/task-4.4.1-prompt.md
```

**Actions principales attendues** :
- Folder `repo/apps/web-customer-portal/`
- App skeleton Next.js 15 + design tokens Sprint 4
- Layout public `app/layout.tsx` :
- Metadata foundation `metadata.ts` : titre + description + OG + Twitter card defaults
- `app/robots.ts` : robots.txt dynamique
- `app/sitemap.ts` : sitemap.xml generation (toutes pages publiques + per locale)

**Fichiers cibles principaux** :
  - `repo/apps/web-customer-portal/app/layout.tsx`
  - `repo/apps/web-customer-portal/app/[locale]/layout.tsx`
  - `repo/apps/web-customer-portal/components/layout/public-header.tsx`
  - `repo/apps/web-customer-portal/components/layout/public-footer.tsx`
  - `repo/apps/web-customer-portal/app/robots.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : App demarre port 3004
  - V2 (P0) : Robots.txt accessible
  - V3 (P0) : Sitemap.xml genere avec pages locales

**Validation** :
```bash
cd repo
pnpm tsc --noEmit                    # Typecheck strict
pnpm vitest run --coverage           # Tests unitaires + coverage
pnpm lint                            # Biome lint + format check
cd ..
```

**Commit** :
```bash
git add -A
git commit -m "feat(sprint-17): app skeleton + public layout + seo foundation

Task: 4.4.1
Sprint: 17 (Phase 4 / Sprint 4)
Phase: 4 -- Vertical Insure (Skalean Broker ERP)
Decisions: see B-17 Tache 4.4.1"
```

---

### Tache 2 / 14 : Landing Page Racine

**Metadonnees** : P0 | 5h | Depend de : Depend de 4.4.1

**But** : Page racine `/[locale]/` : hero + 5 branches CTA + benefits + testimonials + FAQ + footer.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-17-web-customer-portal/task-4.4.2-prompt.md
```

**Actions principales attendues** :
- Page `app/[locale]/page.tsx` (Server Component)
- Sections :
- Animations : framer-motion entrance (subtle)
- Mobile-first : breakpoints sm/md/lg
- CTAs trackees (Tache 4.4.13 analytics)
- Internal linking : SEO intra-site

**Fichiers cibles principaux** :
  - `repo/apps/web-customer-portal/app/[locale]/page.tsx`
  - `repo/apps/web-customer-portal/components/home/hero-section.tsx`
  - `repo/apps/web-customer-portal/components/home/branches-grid.tsx`
  - `repo/apps/web-customer-portal/components/home/how-it-works.tsx`
  - `repo/apps/web-customer-portal/components/home/benefits-section.tsx`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Toutes 8 sections render
  - V2 (P0) : CTAs trackees
  - V3 (P0) : Mobile responsive

**Validation** :
```bash
cd repo
pnpm tsc --noEmit                    # Typecheck strict
pnpm vitest run --coverage           # Tests unitaires + coverage
pnpm lint                            # Biome lint + format check
cd ..
```

**Commit** :
```bash
git add -A
git commit -m "feat(sprint-17): landing page racine

Task: 4.4.2
Sprint: 17 (Phase 4 / Sprint 4)
Phase: 4 -- Vertical Insure (Skalean Broker ERP)
Decisions: see B-17 Tache 4.4.2"
```

---

### Tache 3 / 14 : 5 Pages Branches

**Metadonnees** : P0 | 7h | Depend de : Depend de 4.4.2

**But** : 5 landing pages dediees par branche (`/[locale]/auto`, `/sante`, `/habitation`, `/rc-pro`, `/voyage`) : SEO ciblee + content + CTA tarification.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-17-web-customer-portal/task-4.4.3-prompt.md
```

**Actions principales attendues** :
- 5 pages : `app/[locale]/{auto,sante,habitation,rc-pro,voyage}/page.tsx`
- Per page :
- SEO per page :
- Static Generation (`generateStaticParams`) -- pages prerendered
- ISR : revalidate every hour si contenu change
- Tests par page

**Fichiers cibles principaux** :
  - `repo/apps/web-customer-portal/app/[locale]/auto/page.tsx`
  - `repo/apps/web-customer-portal/app/[locale]/sante/page.tsx`
  - `repo/apps/web-customer-portal/app/[locale]/habitation/page.tsx`
  - `repo/apps/web-customer-portal/app/[locale]/rc-pro/page.tsx`
  - `repo/apps/web-customer-portal/app/[locale]/voyage/page.tsx`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 5 pages render
  - V2 (P0) : SEO metadata per page
  - V3 (P0) : Static generation OK

**Validation** :
```bash
cd repo
pnpm tsc --noEmit                    # Typecheck strict
pnpm vitest run --coverage           # Tests unitaires + coverage
pnpm lint                            # Biome lint + format check
cd ..
```

**Commit** :
```bash
git add -A
git commit -m "feat(sprint-17): 5 pages branches

Task: 4.4.3
Sprint: 17 (Phase 4 / Sprint 4)
Phase: 4 -- Vertical Insure (Skalean Broker ERP)
Decisions: see B-17 Tache 4.4.3"
```

---

### Tache 4 / 14 : Tarification Simulator

**Metadonnees** : P0 | 7h | Depend de : Depend de 4.4.3

**But** : Simulator interactif tarification : forms par branche + computation real-time consume Sprint 14 endpoint + display prix instantane.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-17-web-customer-portal/task-4.4.4-prompt.md
```

**Actions principales attendues** :
- Page `/[locale]/simulateur/[branche]` (5 simulators)
- Form Auto :
- Form Sante : age + nombre membres famille + couvertures option
- Form Habitation : type bien + surface + valeur biens + cambriolage option
- Form RC Pro : profession + chiffre affaires
- Form Voyage : destinations + duree + nombre voyageurs

**Fichiers cibles principaux** :
  - `repo/apps/web-customer-portal/app/[locale]/simulateur/{5 branches}/page.tsx`
  - `repo/apps/web-customer-portal/components/simulator/{several components}.tsx`
  - `repo/apps/web-customer-portal/lib/hooks/use-debounce.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 5 simulators (1 par branche)
  - V2 (P0) : Real-time computation debounced 500ms
  - V3 (P0) : Quote breakdown display

**Validation** :
```bash
cd repo
pnpm tsc --noEmit                    # Typecheck strict
pnpm vitest run --coverage           # Tests unitaires + coverage
pnpm lint                            # Biome lint + format check
cd ..
```

**Commit** :
```bash
git add -A
git commit -m "feat(sprint-17): tarification simulator

Task: 4.4.4
Sprint: 17 (Phase 4 / Sprint 4)
Phase: 4 -- Vertical Insure (Skalean Broker ERP)
Decisions: see B-17 Tache 4.4.4"
```

---

### Tache 5 / 14 : Comparateur Multi-Produits

**Metadonnees** : P0 | 5h | Depend de : Depend de 4.4.4

**But** : Comparateur per branche : 3-5 produits options (Tiers / Tiers+ / Tous Risques pour auto) + visualisation differences side-by-side.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-17-web-customer-portal/task-4.4.5-prompt.md
```

**Actions principales attendues** :
- Page `/[locale]/comparer/[branche]`
- Form criteres user (similar simulator) -> request 5 quotes parallele (1 per produit branche)
- Display side-by-side cards : prix + garanties + exclusions + recommendation (highlighted "Best value")
- Toggle vue : Cards / Table detailed
- Filter / sort : par prix / par couverture
- CTA per card : "Souscrire ce produit" -> wizard Tache 4.4.6

**Fichiers cibles principaux** :
  - `repo/apps/web-customer-portal/app/[locale]/comparer/[branche]/page.tsx`
  - `repo/apps/web-customer-portal/components/compare/products-grid.tsx`
  - `repo/apps/web-customer-portal/components/compare/products-table.tsx`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 5 quotes parallel computation
  - V2 (P0) : Side-by-side display
  - V3 (P0) : Filter / sort

**Validation** :
```bash
cd repo
pnpm tsc --noEmit                    # Typecheck strict
pnpm vitest run --coverage           # Tests unitaires + coverage
pnpm lint                            # Biome lint + format check
cd ..
```

**Commit** :
```bash
git add -A
git commit -m "feat(sprint-17): comparateur multi-produits

Task: 4.4.5
Sprint: 17 (Phase 4 / Sprint 4)
Phase: 4 -- Vertical Insure (Skalean Broker ERP)
Decisions: see B-17 Tache 4.4.5"
```

---

### Tache 6 / 14 : Souscription Wizard Etape 1 : Data Personnelle

**Metadonnees** : P0 | 5h | Depend de : Depend de 4.4.5

**But** : Premier ecran wizard souscription : data personnelle + adresse (validation Zod stricte MA formats).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-17-web-customer-portal/task-4.4.6-prompt.md
```

**Actions principales attendues** :
- Page `/[locale]/souscription/etape-1`
- Form react-hook-form :
- Progress bar : etape 1/4
- Validation Zod stricte : CIN format, ICE checksum, phone E.164
- Save dans sessionStorage `wizard_state.step1` apres validation
- Auto-save brouillon : POST /api/v1/insure/wizards (preserve state si refresh)

**Fichiers cibles principaux** :
  - `repo/apps/web-customer-portal/app/[locale]/souscription/etape-1/page.tsx`
  - `repo/apps/web-customer-portal/components/wizard/wizard-progress.tsx`
  - `repo/apps/web-customer-portal/components/wizard/personal-data-form.tsx`
  - `repo/apps/web-customer-portal/lib/wizard/wizard-state.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Form particulier + entreprise
  - V2 (P0) : Validation Zod stricte
  - V3 (P0) : CIN + ICE + phone formats valides

**Validation** :
```bash
cd repo
pnpm tsc --noEmit                    # Typecheck strict
pnpm vitest run --coverage           # Tests unitaires + coverage
pnpm lint                            # Biome lint + format check
cd ..
```

**Commit** :
```bash
git add -A
git commit -m "feat(sprint-17): souscription wizard etape 1 : data personnelle

Task: 4.4.6
Sprint: 17 (Phase 4 / Sprint 4)
Phase: 4 -- Vertical Insure (Skalean Broker ERP)
Decisions: see B-17 Tache 4.4.6"
```

---

### Tache 7 / 14 : Souscription Wizard Etape 2 : KYC

**Metadonnees** : P0 | 6h | Depend de : Depend de 4.4.6

**But** : Etape 2 : KYC upload CIN photo recto/verso + verification basique (OCR future Sprint 30+, Sprint 17 = check format file + manual review fallback).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-17-web-customer-portal/task-4.4.7-prompt.md
```

**Actions principales attendues** :
- Page `/[locale]/souscription/etape-2`
- Upload zones : CIN recto + CIN verso (drag-drop ou click)
- Validation : taille < 5MB + format jpg/png/pdf + clarity check basique
- Si entreprise : upload Kbis + statuts + RIB
- Server-side : upload S3 multi-tenant (Sprint 10) + virus scan
- Pre-approbation auto (Sprint 17 basique) :

**Fichiers cibles principaux** :
  - `repo/apps/web-customer-portal/app/[locale]/souscription/etape-2/page.tsx`
  - `repo/apps/web-customer-portal/components/wizard/kyc-upload.tsx`
  - `repo/apps/web-customer-portal/components/wizard/upload-zone.tsx`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Upload zones drag-drop
  - V2 (P0) : Validation files
  - V3 (P0) : S3 upload reussit

**Validation** :
```bash
cd repo
pnpm tsc --noEmit                    # Typecheck strict
pnpm vitest run --coverage           # Tests unitaires + coverage
pnpm lint                            # Biome lint + format check
cd ..
```

**Commit** :
```bash
git add -A
git commit -m "feat(sprint-17): souscription wizard etape 2 : kyc

Task: 4.4.7
Sprint: 17 (Phase 4 / Sprint 4)
Phase: 4 -- Vertical Insure (Skalean Broker ERP)
Decisions: see B-17 Tache 4.4.7"
```

---

### Tache 8 / 14 : Souscription Wizard Etape 3 : Paiement

**Metadonnees** : P0 | 6h | Depend de : Depend de 4.4.7

**But** : Etape 3 : choisir methode paiement + integrer Pay Sprint 11 + redirect provider + handle return URL.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-17-web-customer-portal/task-4.4.8-prompt.md
```

**Actions principales attendues** :
- Page `/[locale]/souscription/etape-3`
- Recap quote : prix + frequence + total
- Choix frequence : annuel / mensuel / trimestriel (avec frais conversion afficher)
- Choix methode : cartes (CMI) / mobile money (Inwi/Orange) / virement / cash kiosque
- Initialize Pay : POST /api/v1/pay/transactions/initiate
- Si redirect-based : 3D Secure ou portail provider -> redirect

**Fichiers cibles principaux** :
  - `repo/apps/web-customer-portal/app/[locale]/souscription/etape-3/page.tsx`
  - `repo/apps/web-customer-portal/app/[locale]/souscription/paiement/return/page.tsx`
  - `repo/apps/web-customer-portal/components/wizard/payment-methods.tsx`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Recap visible
  - V2 (P0) : Methode payment selection
  - V3 (P0) : Pay initiate + redirect

**Validation** :
```bash
cd repo
pnpm tsc --noEmit                    # Typecheck strict
pnpm vitest run --coverage           # Tests unitaires + coverage
pnpm lint                            # Biome lint + format check
cd ..
```

**Commit** :
```bash
git add -A
git commit -m "feat(sprint-17): souscription wizard etape 3 : paiement

Task: 4.4.8
Sprint: 17 (Phase 4 / Sprint 4)
Phase: 4 -- Vertical Insure (Skalean Broker ERP)
Decisions: see B-17 Tache 4.4.8"
```

---

### Tache 9 / 14 : Souscription Wizard Etape 4 : Signature + Confirmation

**Metadonnees** : P0 | 5h | Depend de : Depend de 4.4.8

**But** : Etape 4 finale : signature electronique provisional policy + page confirmation finale.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-17-web-customer-portal/task-4.4.9-prompt.md
```

**Actions principales attendues** :
- Page `/[locale]/souscription/etape-4`
- Display provisional policy preview (PDF)
- Signature workflow Barid eSign Sprint 10 : embed signing widget OR redirect Barid + return
- Apres signature : provisional policy status='active' + soumission broker queue
- Page confirmation `/souscription/confirmation` :
- Tests

**Fichiers cibles principaux** :
  - `repo/apps/web-customer-portal/app/[locale]/souscription/etape-4/page.tsx`
  - `repo/apps/web-customer-portal/app/[locale]/souscription/confirmation/page.tsx`
  - `repo/apps/web-customer-portal/components/wizard/signature-step.tsx`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Provisional policy preview
  - V2 (P0) : Signature complete
  - V3 (P0) : Submission broker queue

**Validation** :
```bash
cd repo
pnpm tsc --noEmit                    # Typecheck strict
pnpm vitest run --coverage           # Tests unitaires + coverage
pnpm lint                            # Biome lint + format check
cd ..
```

**Commit** :
```bash
git add -A
git commit -m "feat(sprint-17): souscription wizard etape 4 : signature + confirmation

Task: 4.4.9
Sprint: 17 (Phase 4 / Sprint 4)
Phase: 4 -- Vertical Insure (Skalean Broker ERP)
Decisions: see B-17 Tache 4.4.9"
```

---

### Tache 10 / 14 : Provisional Policy Generation + Display + PDF

**Metadonnees** : P0 | 5h | Depend de : Depend de 4.4.9

**But** : Generation provisional policy via Sprint 15 + display dans confirmation + download PDF.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-17-web-customer-portal/task-4.4.10-prompt.md
```

**Actions principales attendues** :
- API call Sprint 15 : POST /api/v1/insure/provisional/generate (apres etape 4)
- Display provisional infos : numero + valid dates + garanties basiques
- PDF preview : `react-pdf` viewer integration
- Download PDF : signed URL S3 (Sprint 10)
- QR code visible : verification publique Sprint 10
- Watermark "PROVISOIRE" affiche

**Fichiers cibles principaux** :
  - `repo/apps/web-customer-portal/components/wizard/provisional-display.tsx`
  - `repo/apps/web-customer-portal/components/wizard/pdf-viewer.tsx`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Provisional generated
  - V2 (P0) : Display complete
  - V3 (P0) : PDF preview + download

**Validation** :
```bash
cd repo
pnpm tsc --noEmit                    # Typecheck strict
pnpm vitest run --coverage           # Tests unitaires + coverage
pnpm lint                            # Biome lint + format check
cd ..
```

**Commit** :
```bash
git add -A
git commit -m "feat(sprint-17): provisional policy generation + display + pdf

Task: 4.4.10
Sprint: 17 (Phase 4 / Sprint 4)
Phase: 4 -- Vertical Insure (Skalean Broker ERP)
Decisions: see B-17 Tache 4.4.10"
```

---

### Tache 11 / 14 : SEO Complet

**Metadonnees** : P0 | 5h | Depend de : Depend de 4.4.10

**But** : Optimisation SEO finale : metadata exhaustive + sitemap dynamique + structured data per page + OG images dynamiques.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-17-web-customer-portal/task-4.4.11-prompt.md
```

**Actions principales attendues** :
- Metadata API per page (titre + description + keywords + OG)
- Sitemap.xml dynamique : toutes pages + priorities + changefreq
- Robots.txt : allow tous + sitemap reference
- Structured data per page :
- OG images dynamiques per page (Vercel OG)
- Canonical URLs

**Fichiers cibles principaux** :
  - `repo/apps/web-customer-portal/app/sitemap.ts`
  - `repo/apps/web-customer-portal/components/seo/{several jsonld variants}.tsx`
  - `repo/apps/web-customer-portal/app/{various pages}/opengraph-image.tsx`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Metadata exhaustive
  - V2 (P0) : Sitemap genere correctement
  - V3 (P0) : Structured data validates

**Validation** :
```bash
cd repo
pnpm tsc --noEmit                    # Typecheck strict
pnpm vitest run --coverage           # Tests unitaires + coverage
pnpm lint                            # Biome lint + format check
cd ..
```

**Commit** :
```bash
git add -A
git commit -m "feat(sprint-17): seo complet

Task: 4.4.11
Sprint: 17 (Phase 4 / Sprint 4)
Phase: 4 -- Vertical Insure (Skalean Broker ERP)
Decisions: see B-17 Tache 4.4.11"
```

---

### Tache 12 / 14 : I18n + RTL + Mobile-First Responsive

**Metadonnees** : P0 | 5h | Depend de : Depend de 4.4.11

**But** : I18n complete fr / ar-MA / ar + RTL CSS + mobile-first responsive (60%+ trafic MA mobile).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-17-web-customer-portal/task-4.4.12-prompt.md
```

**Actions principales attendues** :
- Messages 3 locales complete (~600 keys)
- RTL CSS appliquee ar/ar-MA
- Mobile breakpoints : sm 640px, md 768px, lg 1024px, xl 1280px
- Touch-friendly : tap targets 44px+ (a11y standard)
- Performance mobile : LCP < 2.5s, CLS < 0.1, INP < 200ms
- Tests responsive multiple viewports

**Fichiers cibles principaux** :
  - `repo/apps/web-customer-portal/messages/{fr,ar-MA,ar}.json`
  - `repo/apps/web-customer-portal/app/globals.css`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 3 locales complete
  - V2 (P0) : RTL fonctionne ar/ar-MA
  - V3 (P0) : Mobile responsive tous viewports

**Validation** :
```bash
cd repo
pnpm tsc --noEmit                    # Typecheck strict
pnpm vitest run --coverage           # Tests unitaires + coverage
pnpm lint                            # Biome lint + format check
cd ..
```

**Commit** :
```bash
git add -A
git commit -m "feat(sprint-17): i18n + rtl + mobile-first responsive

Task: 4.4.12
Sprint: 17 (Phase 4 / Sprint 4)
Phase: 4 -- Vertical Insure (Skalean Broker ERP)
Decisions: see B-17 Tache 4.4.12"
```

---

### Tache 13 / 14 : Analytics Tracking

**Metadonnees** : P0 | 4h | Depend de : Depend de 4.4.12

**But** : Google Analytics 4 + custom events conversion funnel + GDPR/CNDP compliance (cookie banner).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-17-web-customer-portal/task-4.4.13-prompt.md
```

**Actions principales attendues** :
- Cookie banner CNDP-compliant : accept/refuse cookies analytics
- Google Analytics 4 setup (env GA_TRACKING_ID)
- Custom events conversion funnel :
- Privacy : pas tracking sans consent
- Server-side analytics aussi (Sprint 13 ETL fct events)
- Tests : events fired correctly

**Fichiers cibles principaux** :
  - `repo/apps/web-customer-portal/components/analytics/cookie-banner.tsx`
  - `repo/apps/web-customer-portal/components/analytics/ga-script.tsx`
  - `repo/apps/web-customer-portal/lib/analytics/track-event.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Cookie banner CNDP
  - V2 (P0) : GA4 fires on consent
  - V3 (P0) : Custom events funnel

**Validation** :
```bash
cd repo
pnpm tsc --noEmit                    # Typecheck strict
pnpm vitest run --coverage           # Tests unitaires + coverage
pnpm lint                            # Biome lint + format check
cd ..
```

**Commit** :
```bash
git add -A
git commit -m "feat(sprint-17): analytics tracking

Task: 4.4.13
Sprint: 17 (Phase 4 / Sprint 4)
Phase: 4 -- Vertical Insure (Skalean Broker ERP)
Decisions: see B-17 Tache 4.4.13"
```

---

### Tache 14 / 14 : Tests E2E + Lighthouse

**Metadonnees** : P0 | 9h | Depend de : Depend de 4.4.13

**But** : Suite tests Playwright + Lighthouse audits performance.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-17-web-customer-portal/task-4.4.14-prompt.md
```

**Actions principales attendues** :
- Landing pages : 5 branches accessible (5)
- Simulators : 5 branches computation (5)
- Wizard 4 etapes flow complete (4)
- Cookie banner accept/refuse (2)
- SEO meta + sitemap (3)
- Performance > 90

**Fichiers cibles principaux** :
  - `repo/apps/web-customer-portal/e2e/{15+ specs}.spec.ts`
  - `repo/apps/web-customer-portal/lighthouse-audit-config.json`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 15+ tests passent
  - V2 (P0) : CI green
  - V3 (P0) : Lighthouse all green

**Validation** :
```bash
cd repo
pnpm tsc --noEmit                    # Typecheck strict
pnpm vitest run --coverage           # Tests unitaires + coverage
pnpm lint                            # Biome lint + format check
cd ..
```

**Commit** :
```bash
git add -A
git commit -m "feat(sprint-17): tests e2e + lighthouse

Task: 4.4.14
Sprint: 17 (Phase 4 / Sprint 4)
Phase: 4 -- Vertical Insure (Skalean Broker ERP)
Decisions: see B-17 Tache 4.4.14"
```

---


## VERIFICATION DU SPRINT 17

Une fois les 14 taches terminees et commitees, **lancer la verification automatique** :

```bash
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-17-sprint-17-verification.md
```

Le fichier de verification V-17 contient :

- **Criteres P0 bloquants** : compilation TypeScript / tests Vitest / Biome lint / no-emoji / conventional commits
- **Criteres P1 avertissements** : couverture >= 85% / dependencies coherentes / docs API / metriques performance
- **Criteres P2 notes** : coverage >= 90% modules critiques / lighthouse score / accessibility
- **Auto-reparation** pour criteres recuperables (e.g. relance tests flaky)
- **Generation automatique** du rapport `sprint17-verify-report.md`
- **Calcul score global** + statut GO / GO CONDITIONNEL / NO-GO

**Score minimum requis pour GO** : >= 95% (sprint termine, GO Sprint suivant)
**Score minimum pour GO CONDITIONNEL** : 85-94% (hot fix requis, retard <= 1 semaine)
**En dessous de 85%** : NO-GO, **reprise sprint requise** (escalation Saad/Abla decision)

Apres execution, lire le rapport :

```bash
cat skalean-insurtech/sprint17-verify-report.md
```

Si statut **GO** ou **GO CONDITIONNEL**, executer le commit de cloture :

```bash
git add skalean-insurtech/sprint17-verify-report.md
git commit -m "chore(sprint-17): close sprint 17 with verification report

- Score global : {SCORE}%
- Statut : {GO|GO CONDITIONNEL}
- Phase : 4 (Vertical Insure (Skalean Broker ERP))
- Sprint : 17 (Phase 4 / Sprint 4)
- Apport : web-customer-portal vente en ligne SEO Lighthouse 95+
- Tests E2E cumules : {N}+

Sprint 17 completed -- handoff to Sprint 18."
```

---

## RESUME DU WORKFLOW

```
[Demarrage Sprint 17]
   |
   v
[Tache 4.4.1: App Skeleton + Public Layout + SEO Foundation]
   | -> compile -> tests -> commit
   v
[Tache 4.4.2: Landing Page Racine]
   | -> compile -> tests -> commit
   v
[Tache 4.4.3: 5 Pages Branches]
   | -> compile -> tests -> commit
   v
[Tache 4.4.4: Tarification Simulator]
   | -> compile -> tests -> commit
   v
[Tache 4.4.5: Comparateur Multi-Produits]
   | -> compile -> tests -> commit
   v
[Tache 4.4.6: Souscription Wizard Etape 1 : Data Personnelle]
   | -> compile -> tests -> commit
   v
[Tache 4.4.7: Souscription Wizard Etape 2 : KYC]
   | -> compile -> tests -> commit
   v
[Tache 4.4.8: Souscription Wizard Etape 3 : Paiement]
   | -> compile -> tests -> commit
   v
[Tache 4.4.9: Souscription Wizard Etape 4 : Signature + Confirmation]
   | -> compile -> tests -> commit
   v
[Tache 4.4.10: Provisional Policy Generation + Display + PDF]
   | -> compile -> tests -> commit
   v
[Tache 4.4.11: SEO Complet]
   | -> compile -> tests -> commit
   v
[Tache 4.4.12: I18n + RTL + Mobile-First Responsive]
   | -> compile -> tests -> commit
   v
[Tache 4.4.13: Analytics Tracking]
   | -> compile -> tests -> commit
   v
[Tache 4.4.14: Tests E2E + Lighthouse]
   | -> compile -> tests -> commit
   v
[Verification automatique sprint 17 -- V-17]
   |
   v
[Rapport sprint17-verify-report.md]
   |
   v
[Score >= 95%] -> GO -> commit cloture sprint -> Sprint suivant
[Score 85-94%] -> GO CONDITIONNEL -> hot fix puis cloture
[Score < 85%]  -> NO-GO -> reprise sprint
```

**Duree totale estimee** : 80 heures (5h par tache moyenne -- 2 devs FTE en parallele).

**Modules skalean-insurtech affectes** : @insurtech/insure, apps/web-broker, apps/web-customer-portal, apps/web-assure-portal, apps/web-assure-mobile

**Apport metier principal** : web-customer-portal vente en ligne SEO Lighthouse 95+.

**Prerequis Sprint 18** : Sprint 17 GO complet (score >= 95% verification automatique V-17).

**Sprint suivant** : Sprint 18.

---

## COMMANDES DE LANCEMENT

### Prerequis Sprint 16 (verification GO)

```bash
# Verifier Sprint 16 GO
ls skalean-insurtech/sprint16-verify-report.md
grep '^Statut.*GO' skalean-insurtech/sprint16-verify-report.md
```

### Lancement Sprint 17 (Cowork lit cet orchestrateur)

```bash
# Cowork command (claude-code or cowork CLI) :
claude-code \
  --orchestrator skalean-insurtech/00-pilotage/meta-prompts/phase-C-orchestration/C-17-sprint-17-web-customer-portal.md \
  --reference-prompt skalean-insurtech/00-pilotage/meta-prompts/phase-B-tasks/B-17-sprint-17-web-customer-portal.md \
  --verification skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-17-sprint-17-verification.md
```

### Suivi temps reel execution

```bash
# Tail le log Cowork
tail -f skalean-insurtech/cowork-sprint-17.log

# Verifier progression commits
git log --oneline --since="2 weeks ago" -- repo/ | grep "Sprint: 17"
```

### Apres completion -- verifier rapport

```bash
cat skalean-insurtech/sprint17-verify-report.md
```

---

## NOTES IMPORTANTES POUR COWORK

1. **Lire d'abord B-17** complet avant generation prompts taches (contexte critique)
2. **Generer les 14 prompts taches** dans `00-pilotage/prompts-taches/sprint-17-*/` AVANT de commencer execution
3. **Toujours respecter l'ordre** des taches (dependances explicites)
4. **Commit chaque tache separement** (granularite Git pour rollback facile)
5. **NE JAMAIS modifier `00-pilotage/`** -- uniquement `repo/`
6. **En cas de doute**, escalader Saad/Abla via Slack `#insurtech-dev` plutot que faire choix arbitraire
7. **Documentation continue** : si tu prends une decision technique, ajouter ADR dans `repo/docs/architecture/`

---

**Fin de l'orchestrateur C-17 v2.2 detaille -- Sprint 17 (4.4) Web Customer Portal vente en ligne SEO.**

**Total taches detaillees** : 14 | **Effort cumul** : ~80h | **Apport** : web-customer-portal vente en ligne SEO Lighthouse 95+
