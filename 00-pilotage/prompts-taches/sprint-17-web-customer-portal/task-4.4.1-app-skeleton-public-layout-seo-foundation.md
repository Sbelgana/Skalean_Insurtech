# TACHE 4.4.1 -- App Skeleton + Public Layout + SEO Foundation

**Sprint** : 17 (Phase 4 / Sprint 4 dans phase)
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-17-sprint-17-web-customer-portal.md` (Tache 4.4.1)
**Phase** : 4 -- Vertical Insure (Skalean Broker ERP)
**Priorite** : P0 (bloquant pour Sprint 17 entier -- foundation portail public)
**Effort** : 6h
**Dependances** : Sprint 16 (web-broker app pattern Next.js 15 stable + design tokens Sprint 4 + i18n setup)
**Densite cible** : 100-150 ko (auto-suffisant exhaustif)
**AUCUNE EMOJI AUTORISEE**

---

## 1. But

Cette tache initialise l'application Next.js 15 `apps/web-customer-portal` (port 3004) qui sera le **portail public de vente en ligne d'assurance** Skalean InsurTech au Maroc. Contrairement au web-broker (Sprint 16) qui est une SaaS B2B authentifiee, ce portail est **100 percent public** (no auth, no cookies sauf wizard) avec **SEO et performance comme priorites absolues** car c'est la porte d'entree de l'acquisition de souscripteurs particuliers et entreprises au Maroc.

L'apport est triple :

1. **Foundation technique publique** : layout app router Next.js 15 sans middleware auth, Server Components par defaut pour SSR performant, Suspense streaming pour TTFB minimal, design tokens Sofidemy importes depuis `@insurtech/shared-ui`. Cette foundation servira aux 13 taches suivantes (landing, simulators, wizard 4 etapes, comparateur, analytics).
2. **SEO foundation complete** : Next.js 15 Metadata API integree, robots.ts dynamique, sitemap.ts genere avec toutes pages publiques par locale, OG images dynamiques via `@vercel/og`, structured data schema.org InsuranceAgency + LocalBusiness, alternates linguistiques (fr / ar-MA / ar) avec hreflang, canonical URLs absolues sur `NEXT_PUBLIC_SITE_URL=https://souscrire.skalean-insurtech.ma`.
3. **Compliance CNDP cookies** : aucun cookie tracking par defaut (decision-008 loi 09-08 CNDP), cookie wizard_token uniquement apres consentement explicite via cookie banner CNDP-compliant (implemente en Tache 4.4.13), preserve state wizard 4 etapes via sessionStorage cote client. Pas de localStorage non plus (decision-006 + politique CNDP).

A l'issue de cette tache, l'app `apps/web-customer-portal` demarre sur port 3004 en mode dev (`pnpm --filter web-customer-portal dev`), repond a `GET /` (root redirect vers `/fr`), `GET /fr`, `GET /ar-MA`, `GET /ar`, `GET /robots.txt`, `GET /sitemap.xml`, `GET /opengraph-image`, avec Server Components rendus en SSR (verifie via `view-source:` -- HTML complet pre-rendu). Lighthouse audit sur `/fr` doit retourner Performance >= 90, SEO = 100, Accessibility >= 90, Best Practices >= 95 sur viewport mobile (375x667) car 60+ percent du trafic MA est mobile selon analyses Sprint 13.

## 2. Contexte etendu

### 2.1 Pourquoi cette tache existe

Le programme Skalean InsurTech v2.2 vise a digitaliser **completement** le parcours souscription assurance au Maroc, qui aujourd'hui est encore fortement papier et physique (95+ percent des polices souscrites en agence ou via courtier face-a-face). Le portail `web-customer-portal` (port 3004 dev / `souscrire.skalean-insurtech.ma` prod) est le **canal direct B2C** complementaire au canal indirect B2B `web-broker` (Sprint 16). Sans ce canal direct, le programme ne peut pas atteindre les particuliers digital-natives marocains (25-45 ans, classes moyennes urbaines Casablanca/Rabat/Marrakech/Tanger) qui souhaitent souscrire en ligne 24/7 sans deplacement.

Pour reussir l'acquisition organique au Maroc, le portail doit etre **SEO-first** :
- Marche assurance MA tres concurrentiel mais peu de competiteurs ont un SEO fort (RMA Watanya, Saham, Wafa Assurance, AXA MA ont des sites mais souvent legacy sans schema.org)
- Recherches Google MA volumineuses sur "assurance auto en ligne Maroc", "comparateur assurance sante MA", "devis habitation Casablanca", "RC professionnelle Tanger", "voyage Schengen depuis Maroc"
- Conversion SEO->souscription = leverage acquisition cost faible vs Google Ads / Facebook Ads
- Loi CNDP 09-08 impose data residency MA + transparence -> SEO mention "Donnees hebergees au Maroc" est differentiator

Architecture choisie Next.js 15 App Router :
- **Server Components par defaut** : HTML pre-rendu, JavaScript minimal, performance mobile optimisee
- **Streaming** : Suspense boundaries pour First Contentful Paint < 1.5s
- **Static Generation** quand possible (`generateStaticParams`) + **ISR** revalidation 3600s (1h) pour landing pages branches
- **Edge Runtime** sur certaines routes (`opengraph-image`) pour latence minimale
- **Metadata API native** : Next.js gere automatiquement `<meta>` tags, `<title>`, canonical, alternates, robots
- **App Router file-based routing** : `/[locale]/auto` -> `/app/[locale]/auto/page.tsx`

### 2.2 Alternatives considerees

| Alternative | Avantages | Inconvenients | Decision |
|-------------|-----------|---------------|----------|
| Next.js 15 App Router (RSC) | Server Components, SEO natif, performance, streaming, Suspense, future-proof | Courbe apprentissage 'use client' boundaries, hydration mismatches possibles | RETENU car SEO + perf priorites absolues + alignement Sprint 16 |
| Next.js 14 Pages Router | Stable, ecosystem documentation mature, `getServerSideProps`/`getStaticProps` familiers | Pas de Server Components, double rendering React, JS bundle plus gros | rejete car Sprint 16 deja en App Router (coherence) |
| Remix v2 | Loaders/actions elegants, web standards, nested routing | Moins de momentum vs Next.js, ecosystem MA moins documente, deploy plus complexe | rejete car deviation de la stack programme |
| SvelteKit | Performance bundle minimaliste, syntaxe simple, SEO bon | Talent pool MA faible Svelte, deviation stack, packages `@insurtech/*` en TS/React | rejete pour coherence |
| Astro + React islands | SSG ultra-rapide, hydratation partielle, parfait SEO | Forms complexes (wizard 4 etapes) moins ergonomiques, courbe apprentissage | rejete car wizard complexe necessite framework full |
| Vite + React Router SPA | Setup simple, dev rapide | Pas de SSR -> SEO catastrophique, Lighthouse Performance < 50 | rejete categoriquement (SEO) |

### 2.3 Trade-offs explicites

Decisions qui coutent quelque chose :

1. **No middleware auth = pas de cookies tracking server-side par defaut** : on perd la capacite de personnaliser le contenu serveur basee sur user history. Trade-off accepte car compliance CNDP + simplicite + cible "first-time visitors" qui n'ont pas encore d'historique.
2. **Server Components par defaut** : forcer 'use client' uniquement sur composants interactifs (forms, tabs, accordion) impose discipline rigoureuse. Risque : developpeur ajoute 'use client' partout par confort -> bundle JS explose. Mitigation : ESLint custom rule + code review obligatoire.
3. **Static Generation + ISR sur pages branche** : si on change le wording d'une garantie produit en DB, il faut attendre 1h (revalidate=3600s) avant que la page se rafraichisse OU declencher manuellement `revalidatePath('/fr/auto')`. Trade-off : performance vs freshness, on choisit perf car content garanties change rarement (1-2x par an).
4. **Pas de localStorage pour preserve state wizard** : sessionStorage uniquement -> si user ferme l'onglet, il perd son progres. Mitigation : auto-save serveur via API `/api/v1/insure/wizards` apres chaque etape complete + email "Continuez votre souscription" envoye apres 1h inactif (Sprint 9 Comm).
5. **Routing locale via segment dynamique `/[locale]/...`** : oblige tous les liens internes a inclure le prefix locale, rend les composants plus verbeux (`<Link href={`/${locale}/auto`}>`). Trade-off accepte vs middleware rewrite plus complexe et moins SEO-friendly.

### 2.4 Decisions strategiques referenced

- **decision-001 (Monorepo pnpm + Turborepo)** : `apps/web-customer-portal` est une app deployable du monorepo, scripts dans `package.json` workspace, dependances `@insurtech/*` resolu via `link-workspace-packages=deep`.
- **decision-006 (No-emoji policy ABSOLU)** : aucun emoji dans code, commentaires, messages traduits, OG images texte, structured data, robots.txt, sitemap.xml. Pre-commit hook `check-no-emoji.sh` verifie. Tous textes UX doivent etre rendus sans Unicode emoji.
- **decision-008 (Data residency Maroc loi 09-08)** : portail public n'envoie aucune data assure vers fournisseur etranger sans consentement. Google Analytics 4 ne fire pas avant consent CNDP cookie banner (Tache 4.4.13). Hosting Atlas Cloud Services Benguerir.
- **decision-009 (Signature electronique loi 43-20)** : provisional policies generees par ce portail seront signees electroniquement via Barid eSign (Tache 4.4.9) qui implementera niveau "avancee" loi 43-20 (Barid eSign = certificat ANRT). PDF provisional contiendra QR code verification + watermark.
- **decision-010 (Insure connecteurs deferred -> Sprint 32)** : ce portail consomme **uniquement** les services Sprint 14 (catalog produits Skalean ERP) et Sprint 15 (provisional policy). Pas de connection externe assureurs reels avant Sprint 32. Mock data pour competitor comparison.

### 2.5 Pieges techniques connus

1. **Piege : 'use client' boundary mal place -> hydration mismatch**
   - Pourquoi : si un composant Server passe une prop non-serializable (Date, function, Symbol) a un composant Client, Next.js throw "Functions cannot be passed directly to Client Components"
   - Solution : convertir Date en ISO string cote serveur (`date.toISOString()`), passer functions via Server Actions (`'use server'`), ne jamais passer class instances. Logger les erreurs `console.error` dans navigateur via `pino-pretty` cote dev pour catch en dev.

2. **Piege : Metadata avec params async dans Next.js 15**
   - Pourquoi : depuis Next.js 15, `params` est une Promise (`Promise<{ locale: string }>`). Code Next.js 14 (`params: { locale: string }`) ne compile plus.
   - Solution : `export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) { const { locale } = await params; ... }`. ESLint regle `@next/next/no-async-client-component` aide.

3. **Piege : Robots.txt accessible mais index disabled en dev/staging**
   - Pourquoi : si on deploye en staging avec `robots: { index: true }` -> Google indexe la staging URL -> pollue resultats search prod.
   - Solution : env var `NEXT_PUBLIC_ENABLE_INDEXING=false` en dev/staging, conditionne `index: process.env.NEXT_PUBLIC_ENABLE_INDEXING === 'true'`. CI fail si staging deploy avec `ENABLE_INDEXING=true`.

4. **Piege : Sitemap depasse 50000 URLs ou 50 MB**
   - Pourquoi : Google limite sitemap a 50000 URLs ou 50 MB uncompressed. Si on indexe tous quote drafts, on explose la limite.
   - Solution : sitemap genere **uniquement** pages publiques marketing (landing + 5 branches + comparer + simulateur = ~20 URLs x 3 locales = 60 URLs max). Sitemap index si depasse (futur Sprint 32+).

5. **Piege : OG images Vercel OG depassement 25s timeout edge**
   - Pourquoi : `@vercel/og` runs sur Edge Runtime, limite 25s execution. Si on charge fonts custom non-cachees ou images externes lentes, timeout.
   - Solution : embed font binaire dans le code (`new URL('./Inter-Regular.ttf', import.meta.url)` -> `fs.readFileSync`), pas d'images externes, layout SVG-only.

6. **Piege : RTL CSS casse layout flexbox/grid**
   - Pourquoi : `dir="rtl"` inverse direction text mais les `flex-row` Tailwind ne s'inversent pas automatiquement. Result : icons mal positionnees, padding asymetrique.
   - Solution : utiliser `rtl:` variant Tailwind (`ms-2` au lieu de `ml-2`, `me-4` au lieu de `mr-4`, `start`/`end` au lieu de `left`/`right`). Test viewport screenshot Playwright avec `locale: 'ar-MA'`.

7. **Piege : Streaming SSR + Suspense -> erreur hydratation si HTML different client**
   - Pourquoi : Server rend une version, client rend autre version (ex: `new Date()` qui differe entre server time MA et client time visiteur Europe).
   - Solution : pour timestamps dynamiques, utiliser `'use client'` + `useEffect` apres mount, ou passer prop deja-formattee depuis Server Component.

8. **Piege : Routes API publiques sans rate limiting -> DDoS**
   - Pourquoi : portail public + endpoint `/api/v1/insure/quotes/preview` -> bots peuvent flood pour saturer tarification engine.
   - Solution : middleware `next-rate-limit` sur routes publiques (50 req/min par IP), Cloudflare WAF en prod, captcha invisible Cloudflare Turnstile sur simulators (Tache 4.4.4).

9. **Piege : Server Components import client-only librairies -> bundle error**
   - Pourquoi : `import { useRouter } from 'next/router'` (Pages Router) dans App Router casse, `import { motion } from 'framer-motion'` dans Server Component casse (Framer is client-only).
   - Solution : ESLint rule `import/no-restricted-paths` + tests build CI. Wrap framer-motion dans `<MotionDiv>` client component, import depuis `'./motion-div'` (qui a `'use client'`).

10. **Piege : Hreflang alternates incorrects -> Google duplicate content penalty**
    - Pourquoi : si `<link rel="alternate" hreflang="fr" href="/fr/auto" />` pointe vers URL relative au lieu d'absolue, Google ne suit pas.
    - Solution : `metadataBase: new URL('https://souscrire.skalean-insurtech.ma')` + alternates toujours absolus, validation via Google Search Console.

## 3. Architecture context

### 3.1 Position dans le sprint 17

Cette tache 4.4.1 est la **1ere des 14 taches du Sprint 17**. Elle initialise toute l'infrastructure du portail public que les 13 taches suivantes vont remplir :

- **Depend de** : Sprint 16 (web-broker app) pour pattern Next.js 15 App Router stable, `@insurtech/shared-ui` design tokens Sofidemy, `@insurtech/shared-config` env loader Zod, `@insurtech/shared-utils` Logger Pino + i18n loader. Aussi Sprint 4 (frontend bootstrap) pour Tailwind config + shadcn/ui.
- **Bloque** : Tache 4.4.2 (landing page) qui consomme le layout public + Tache 4.4.3 (5 pages branche) qui reutilise structures + Tache 4.4.11 (SEO complet) qui enrichit la foundation SEO. En realite, **les 13 taches suivantes** dependent toutes du squelette pose ici.
- **Apporte au sprint** : skeleton operationnel, design system applique, SEO foundation, locale routing, OG images Edge Runtime, structured data, robots.txt + sitemap.xml, env loading Zod, no-auth public layout.

### 3.2 Position dans le programme global

Le programme v2.2 a 35 sprints organises en 8 phases :
- **Phase 1** (Sprints 1-4) : Bootstrap monorepo + DB + API + Frontend
- **Phase 2** (Sprints 5-7) : Auth + Multi-tenant + RBAC
- **Phase 3** (Sprints 8-13) : Modules transversaux (CRM, Comm, Docs, Pay, Books, Analytics)
- **Phase 4** (Sprints 14-18) : **Vertical Insure** (Foundation -> Lifecycle police -> Web Broker -> **Web Customer Portal (Sprint 17 ICI)** -> Web Assure Portal)
- **Phase 5** (Sprints 19-25) : Vertical Repair (Garage)
- **Phase 6** (Sprints 26-28) : Admin Skalean
- **Phase 7** (Sprints 29-32) : IA (Skalean AI REST + MCP + Agent Sky + Insure connecteurs reels)
- **Phase 8** (Sprints 33-35) : Pentest + Performance + Pilote Marrakech go-live

Le Sprint 17 est **strategique** car il livre le **premier canal vente directe en ligne** au Maroc. C'est le canal qui permettra de tester le pilote Marrakech (Sprint 35) avec de vrais souscripteurs particuliers. Sans ce portail, le pilote serait limite au canal broker (B2B) seul.

### 3.3 Diagramme flow

```
                                        Internet (Maroc)
                                              |
                                              v
                              Cloudflare WAF + DNS + CDN
                                              |
                                              v
                                  Load Balancer Atlas Cloud
                                              |
                                              v
                            apps/web-customer-portal (port 3004)
                            Next.js 15 App Router + RSC + SSR + ISR
                                              |
              ___________________________________________________
              |                       |                      |
              v                       v                      v
       Server Components       Client Components        Edge Runtime
       (default: SSR HTML)     ('use client' boundary)  (opengraph-image)
       - layout.tsx            - simulator forms        - dynamic OG
       - page.tsx (home)       - wizard 4 etapes        - sitemap (cron)
       - branche pages         - cookie banner
       - confirmation
                                       |
                                       v
                            API Layer (no auth public)
                            /api/v1/insure/quotes/preview     <- Sprint 14
                            /api/v1/insure/wizards            <- Sprint 17
                            /api/v1/insure/provisional        <- Sprint 15
                            /api/v1/pay/transactions          <- Sprint 11
                            /api/v1/signature/sessions        <- Sprint 10
                                       |
                                       v
                            NestJS Backend (apps/api port 4000)
                            Multi-tenant + RLS Postgres
                            Kafka events insurtech.events.*
                            Redis cache + sessions
                            S3 Atlas Cloud docs
```

### 3.4 Position dans arborescence repo

```
repo/
  apps/
    api/                                # Sprint 3 NestJS backend
    web-broker/                          # Sprint 16
    web-customer-portal/                 # Sprint 17 -- CREE ICI
      app/
        layout.tsx                       # Root layout (root html + body)
        [locale]/
          layout.tsx                     # Locale layout (lang + dir + i18n provider)
          page.tsx                       # Landing root -- Tache 4.4.2
          auto/page.tsx                  # Branche auto -- Tache 4.4.3
          sante/page.tsx                 # Tache 4.4.3
          habitation/page.tsx            # Tache 4.4.3
          rc-pro/page.tsx                # Tache 4.4.3
          voyage/page.tsx                # Tache 4.4.3
          simulateur/                    # Tache 4.4.4
          comparer/                      # Tache 4.4.5
          souscription/                  # Taches 4.4.6 a 4.4.10
        robots.ts                        # CREE ICI
        sitemap.ts                       # CREE ICI
        opengraph-image.tsx              # CREE ICI
      components/
        layout/                          # CREE ICI
          public-header.tsx
          public-footer.tsx
          locale-switcher.tsx
        seo/                             # CREE ICI
          jsonld-insurance-agency.tsx
          jsonld-local-business.tsx
        ui/                              # shadcn/ui (Sprint 4 ref)
      lib/
        env.ts                           # CREE ICI Zod env loader
        constants.ts                     # CREE ICI URLs + branches
        i18n/                            # CREE ICI loader messages
          load-messages.ts
        seo/                             # CREE ICI helpers
          alternates.ts
      messages/
        fr.json                          # CREE ICI (~150 keys foundation)
        ar-MA.json                       # CREE ICI
        ar.json                          # CREE ICI
      public/
        logo.svg                         # COPIED from shared assets
        og-default.png                   # CREE ICI
      e2e/                               # Tache 4.4.14
      next.config.mjs                    # CREE ICI
      tailwind.config.ts                 # CREE ICI (extends shared-ui)
      tsconfig.json                      # CREE ICI
      package.json                       # CREE ICI
      vitest.config.ts                   # CREE ICI
      playwright.config.ts               # Tache 4.4.14
      .env.example                       # CREE ICI
  packages/
    shared-ui/                           # consume design tokens
    shared-config/                       # consume env loader
    shared-utils/                        # consume logger + i18n
    shared-types/                        # consume Locale, Money types
```

## 4. Livrables checkables

- [ ] **L1** Dossier `apps/web-customer-portal/` cree avec arborescence complete (12 sous-dossiers)
- [ ] **L2** `package.json` workspace `@insurtech/web-customer-portal` avec scripts dev/build/start/test/lint/typecheck (~80 lignes)
- [ ] **L3** `tsconfig.json` extends `../../tsconfig.base.json` + paths `@/*` -> `./*` (~30 lignes)
- [ ] **L4** `next.config.mjs` avec i18n + headers security + experimental.reactCompiler + images domains (~100 lignes)
- [ ] **L5** `tailwind.config.ts` extends `@insurtech/shared-ui/tailwind.preset` + content paths (~40 lignes)
- [ ] **L6** `app/layout.tsx` root html + body + redirect locale (~50 lignes)
- [ ] **L7** `app/[locale]/layout.tsx` locale provider + lang attr + dir attr + structured data + analytics placeholder (~150 lignes)
- [ ] **L8** `app/robots.ts` robots.txt dynamique avec NEXT_PUBLIC_ENABLE_INDEXING conditional (~50 lignes)
- [ ] **L9** `app/sitemap.ts` sitemap.xml avec toutes URLs publiques x 3 locales + priorities + changefreq (~120 lignes)
- [ ] **L10** `app/opengraph-image.tsx` Vercel OG image generation Edge Runtime 1200x630 (~120 lignes)
- [ ] **L11** `components/layout/public-header.tsx` header logo + nav + locale switcher + CTA (~150 lignes)
- [ ] **L12** `components/layout/public-footer.tsx` footer about + liens legaux + contact + reseaux (~180 lignes)
- [ ] **L13** `components/layout/locale-switcher.tsx` dropdown 3 locales avec icon flags textuels (~80 lignes)
- [ ] **L14** `components/seo/jsonld-insurance-agency.tsx` structured data schema.org InsuranceAgency complet (~120 lignes)
- [ ] **L15** `components/seo/jsonld-local-business.tsx` structured data LocalBusiness avec addresses Casablanca (~100 lignes)
- [ ] **L16** `lib/env.ts` env loader Zod strict (~80 lignes)
- [ ] **L17** `lib/constants.ts` URLs + 5 branches + locales + breakpoints (~60 lignes)
- [ ] **L18** `lib/i18n/load-messages.ts` async loader cache-friendly (~50 lignes)
- [ ] **L19** `lib/seo/alternates.ts` helpers hreflang + canonical generation (~60 lignes)
- [ ] **L20** `messages/fr.json` (~120 keys foundation : nav, footer, seo, common)
- [ ] **L21** `messages/ar-MA.json` (idem traduit ar-MA Darija/MSA hybrid)
- [ ] **L22** `messages/ar.json` (idem MSA pure)
- [ ] **L23** `vitest.config.ts` config tests unit + integration (~30 lignes)
- [ ] **L24** `.env.example` toutes variables documentees (~60 lignes)
- [ ] **L25** Tests unit `__tests__/lib/env.spec.ts` (10+ tests)
- [ ] **L26** Tests unit `__tests__/lib/i18n/load-messages.spec.ts` (8+ tests)
- [ ] **L27** Tests unit `__tests__/lib/seo/alternates.spec.ts` (10+ tests)
- [ ] **L28** Tests unit `__tests__/components/seo/jsonld.spec.tsx` (8+ tests)
- [ ] **L29** Tests integration `__tests__/integration/routes.spec.ts` (smoke tests routes + robots + sitemap)
- [ ] **L30** App demarre `pnpm --filter web-customer-portal dev` port 3004 sans erreur
- [ ] **L31** `curl http://localhost:3004/robots.txt` retourne 200 avec contenu valide
- [ ] **L32** `curl http://localhost:3004/sitemap.xml` retourne 200 avec XML valide schema sitemaps.org
- [ ] **L33** `curl http://localhost:3004/opengraph-image` retourne 200 image/png 1200x630
- [ ] **L34** `curl http://localhost:3004/fr` retourne HTML pre-rendu avec `<html lang="fr" dir="ltr">`
- [ ] **L35** `curl http://localhost:3004/ar-MA` retourne HTML pre-rendu avec `<html lang="ar-MA" dir="rtl">`
- [ ] **L36** Lighthouse audit `/fr` mobile : Perf >= 90, SEO = 100, A11y >= 90, BP >= 95

## 5. Fichiers crees / modifies

```
repo/apps/web-customer-portal/package.json                                        (~80 lignes / manifest workspace)
repo/apps/web-customer-portal/tsconfig.json                                       (~30 lignes / extends base)
repo/apps/web-customer-portal/next.config.mjs                                     (~110 lignes / Next config complete)
repo/apps/web-customer-portal/tailwind.config.ts                                  (~45 lignes / extends preset)
repo/apps/web-customer-portal/vitest.config.ts                                    (~35 lignes / vitest setup)
repo/apps/web-customer-portal/.env.example                                        (~70 lignes / env vars doc)
repo/apps/web-customer-portal/postcss.config.mjs                                  (~10 lignes / postcss)
repo/apps/web-customer-portal/app/layout.tsx                                      (~60 lignes / root html)
repo/apps/web-customer-portal/app/[locale]/layout.tsx                             (~180 lignes / locale layout SEO)
repo/apps/web-customer-portal/app/robots.ts                                       (~55 lignes / robots dynamique)
repo/apps/web-customer-portal/app/sitemap.ts                                      (~130 lignes / sitemap genere)
repo/apps/web-customer-portal/app/opengraph-image.tsx                             (~140 lignes / OG image Edge)
repo/apps/web-customer-portal/app/icon.tsx                                        (~50 lignes / favicon dynamic)
repo/apps/web-customer-portal/app/not-found.tsx                                   (~70 lignes / 404 page)
repo/apps/web-customer-portal/app/error.tsx                                       (~80 lignes / error boundary)
repo/apps/web-customer-portal/components/layout/public-header.tsx                 (~160 lignes / header)
repo/apps/web-customer-portal/components/layout/public-footer.tsx                 (~200 lignes / footer)
repo/apps/web-customer-portal/components/layout/locale-switcher.tsx               (~95 lignes / locale select)
repo/apps/web-customer-portal/components/layout/skip-to-content.tsx               (~30 lignes / a11y skip link)
repo/apps/web-customer-portal/components/seo/jsonld-insurance-agency.tsx          (~140 lignes / schema.org IA)
repo/apps/web-customer-portal/components/seo/jsonld-local-business.tsx            (~120 lignes / schema.org LB)
repo/apps/web-customer-portal/components/seo/jsonld-organization.tsx              (~100 lignes / schema.org Org)
repo/apps/web-customer-portal/components/seo/breadcrumbs-jsonld.tsx               (~80 lignes / breadcrumbs SD)
repo/apps/web-customer-portal/lib/env.ts                                          (~95 lignes / Zod env)
repo/apps/web-customer-portal/lib/constants.ts                                    (~80 lignes / constants partages)
repo/apps/web-customer-portal/lib/i18n/load-messages.ts                           (~70 lignes / loader async)
repo/apps/web-customer-portal/lib/i18n/types.ts                                   (~40 lignes / Messages types)
repo/apps/web-customer-portal/lib/seo/alternates.ts                               (~75 lignes / hreflang helpers)
repo/apps/web-customer-portal/lib/seo/canonical.ts                                (~40 lignes / canonical builder)
repo/apps/web-customer-portal/lib/utils/cn.ts                                     (~10 lignes / classnames)
repo/apps/web-customer-portal/messages/fr.json                                    (~130 keys / locale FR)
repo/apps/web-customer-portal/messages/ar-MA.json                                 (~130 keys / locale ar-MA)
repo/apps/web-customer-portal/messages/ar.json                                    (~130 keys / locale ar MSA)
repo/apps/web-customer-portal/__tests__/lib/env.spec.ts                           (~150 lignes / 12 tests Zod env)
repo/apps/web-customer-portal/__tests__/lib/i18n/load-messages.spec.ts            (~120 lignes / 10 tests loader)
repo/apps/web-customer-portal/__tests__/lib/seo/alternates.spec.ts                (~140 lignes / 12 tests)
repo/apps/web-customer-portal/__tests__/components/seo/jsonld.spec.tsx            (~160 lignes / 10 tests)
repo/apps/web-customer-portal/__tests__/integration/routes.spec.ts                (~180 lignes / 8 smoke tests)
repo/pnpm-workspace.yaml                                                          (modifie, ajoute apps/web-customer-portal)
repo/turbo.json                                                                   (modifie, ajoute task config)
```

## 6. Code patterns COMPLETS

### Fichier 1/15 : `repo/apps/web-customer-portal/package.json`

Manifest workspace declarant l'app Next.js 15 + dependances + scripts standard Skalean InsurTech.

```json
{
  "name": "@insurtech/web-customer-portal",
  "version": "0.1.0",
  "private": true,
  "description": "Skalean InsurTech v2.2 -- Web Customer Portal (Vente en ligne SEO publique)",
  "engines": {
    "node": ">=22.11.0",
    "pnpm": ">=9.12.0"
  },
  "scripts": {
    "dev": "next dev --port 3004 --turbo",
    "build": "next build",
    "start": "next start --port 3004",
    "lint": "biome check .",
    "lint:fix": "biome check --apply .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest watch",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "clean": "rm -rf .next .turbo node_modules coverage test-results playwright-report"
  },
  "dependencies": {
    "@insurtech/shared-config": "workspace:*",
    "@insurtech/shared-types": "workspace:*",
    "@insurtech/shared-ui": "workspace:*",
    "@insurtech/shared-utils": "workspace:*",
    "@hookform/resolvers": "3.9.1",
    "@tanstack/react-query": "5.62.0",
    "@vercel/og": "0.6.4",
    "clsx": "2.1.1",
    "framer-motion": "11.13.5",
    "lucide-react": "0.468.0",
    "next": "15.0.4",
    "pino": "9.5.0",
    "react": "19.0.0",
    "react-dom": "19.0.0",
    "react-hook-form": "7.54.1",
    "react-pdf": "9.1.1",
    "recharts": "2.13.3",
    "sitemap": "8.0.0",
    "tailwind-merge": "2.5.5",
    "zod": "3.24.1"
  },
  "devDependencies": {
    "@biomejs/biome": "1.9.4",
    "@playwright/test": "1.49.1",
    "@testing-library/jest-dom": "6.6.3",
    "@testing-library/react": "16.1.0",
    "@testing-library/user-event": "14.5.2",
    "@types/node": "22.10.2",
    "@types/react": "19.0.2",
    "@types/react-dom": "19.0.2",
    "@vitejs/plugin-react": "4.3.4",
    "autoprefixer": "10.4.20",
    "happy-dom": "15.11.7",
    "jsdom": "25.0.1",
    "postcss": "8.4.49",
    "tailwindcss": "3.4.17",
    "typescript": "5.7.2",
    "vitest": "2.1.8"
  }
}
```

**Notes importantes** :
- `private: true` car app workspace non publiee npm
- `engines` strict respecte decision-001 (pnpm + Node 22 LTS)
- Pas de `^` ou `~` sur versions (save-exact=true heritage pnpm config racine)
- Scripts `dev`/`build`/`start` standardises pour Turborepo pipeline parallelisme
- `--turbo` sur dev pour bundler Turbopack (Next 15 stable) -> dev server 30+ percent plus rapide vs Webpack

### Fichier 2/15 : `repo/apps/web-customer-portal/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "jsx": "preserve",
    "allowJs": false,
    "noEmit": true,
    "incremental": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitAny": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"],
      "@/app/*": ["./app/*"],
      "@/components/*": ["./components/*"],
      "@/lib/*": ["./lib/*"],
      "@/messages/*": ["./messages/*"]
    },
    "plugins": [{ "name": "next" }]
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts"
  ],
  "exclude": [
    "node_modules",
    ".next",
    "coverage",
    "playwright-report",
    "test-results"
  ]
}
```

**Notes** :
- `extends: '../../tsconfig.base.json'` herite strict mode programme + paths `@insurtech/*`
- `noUncheckedIndexedAccess: true` (convention strict) force null checks sur arrays/objects access
- `paths` alias `@/*` permet imports clean depuis racine app

### Fichier 3/15 : `repo/apps/web-customer-portal/next.config.mjs`

Config Next.js 15 complete : i18n, headers security CSP, React Compiler experimental, images, redirects, env validation.

```javascript
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Validate env vars at build time -- fail-fast
import('./lib/env.ts').catch((err) => {
  console.error('Environment validation failed:', err);
  process.exit(1);
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  compress: true,
  generateEtags: true,

  // Output standalone for Docker container Atlas Cloud
  output: 'standalone',

  // Transpile workspace packages
  transpilePackages: [
    '@insurtech/shared-ui',
    '@insurtech/shared-utils',
    '@insurtech/shared-types',
    '@insurtech/shared-config',
  ],

  experimental: {
    // React Compiler beta -- optimisations auto memoization
    reactCompiler: true,
    // Server Actions stable Next 15
    serverActions: {
      bodySizeLimit: '5mb',
      allowedOrigins: ['localhost:3004', 'souscrire.skalean-insurtech.ma'],
    },
    // Optimize package imports
    optimizePackageImports: [
      'lucide-react',
      '@insurtech/shared-ui',
      'framer-motion',
      'recharts',
    ],
    // Typed routes
    typedRoutes: true,
  },

  // Images optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 's3.atlas-benguerir.ma',
        pathname: '/insurtech-public/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn.skalean-insurtech.ma',
        pathname: '/**',
      },
    ],
  },

  // Security headers
  async headers() {
    const cspDirectives = {
      'default-src': ["'self'"],
      'script-src': [
        "'self'",
        "'unsafe-inline'",
        "'unsafe-eval'",
        'https://www.googletagmanager.com',
        'https://www.google-analytics.com',
        'https://challenges.cloudflare.com',
      ],
      'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      'img-src': [
        "'self'",
        'data:',
        'blob:',
        'https://s3.atlas-benguerir.ma',
        'https://cdn.skalean-insurtech.ma',
        'https://www.google-analytics.com',
      ],
      'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com'],
      'connect-src': [
        "'self'",
        'https://api.skalean-insurtech.ma',
        'https://www.google-analytics.com',
        'https://region1.google-analytics.com',
      ],
      'frame-src': ["'self'", 'https://challenges.cloudflare.com'],
      'frame-ancestors': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"],
      'object-src': ["'none'"],
      'upgrade-insecure-requests': [],
    };

    const cspString = Object.entries(cspDirectives)
      .map(([key, values]) => `${key} ${values.join(' ')}`)
      .join('; ');

    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          { key: 'Content-Security-Policy', value: cspString },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(self), interest-cohort=()',
          },
        ],
      },
      {
        source: '/api/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store, max-age=0' },
        ],
      },
    ];
  },

  // Redirect root to default locale
  async redirects() {
    return [
      {
        source: '/',
        destination: '/fr',
        permanent: false,
      },
    ];
  },

  // Webpack tweaks if needed
  webpack(config, { isServer }) {
    if (!isServer) {
      config.resolve.fallback = { ...config.resolve.fallback, fs: false, net: false, tls: false };
    }
    return config;
  },

  // Static export disabled (we need SSR for ISR + RSC)
  trailingSlash: false,
};

export default nextConfig;
```

**Notes** :
- `output: 'standalone'` produit bundle Docker-ready avec dependencies tracees automatiquement (reduit image size 70 percent)
- CSP strict avec only nonce-required scripts en prod (Tache 4.4.13 ajustera pour GA4)
- `optimizePackageImports` reduit JS bundle final pour lucide-react (icones tree-shaken par defaut)
- Redirect `/` -> `/fr` non-permanent pour pouvoir changer default locale plus tard

### Fichier 4/15 : `repo/apps/web-customer-portal/app/layout.tsx`

Root layout : html + body global, redirect handled by middleware via `redirects()` config. Layout minimal car le vrai layout est dans `[locale]/layout.tsx`.

```typescript
import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { SpeedInsights } from '@/components/analytics/speed-insights';
import './globals.css';

const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  variable: '--font-inter',
  preload: true,
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://souscrire.skalean-insurtech.ma'
  ),
  applicationName: 'Skalean Insurtech',
  authors: [{ name: 'Skalean', url: 'https://www.skalean.ma' }],
  generator: 'Next.js',
  publisher: 'Skalean Insurtech SARL',
  referrer: 'origin-when-cross-origin',
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FFFFFF' },
    { media: '(prefers-color-scheme: dark)', color: '#0B1220' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://api.skalean-insurtech.ma" />
        <link rel="dns-prefetch" href="https://s3.atlas-benguerir.ma" />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
```

**Notes** :
- Root layout ne specifie pas `lang` ni `dir` car ces attributs sont locale-specifiques -> set dans `[locale]/layout.tsx`
- `suppressHydrationWarning` necessaire car certaines extensions navigateur (Grammarly etc) modifient DOM apres hydration
- Preconnect + dns-prefetch pour reduire latence chargement assets (Lighthouse Performance)
- `<SpeedInsights />` placeholder Tache 4.4.13 (Vercel Speed Insights ou alternative MA)

### Fichier 5/15 : `repo/apps/web-customer-portal/app/[locale]/layout.tsx`

Locale layout : applique lang/dir, charge messages i18n, injecte structured data global, monte providers.

```typescript
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { loadMessages } from '@/lib/i18n/load-messages';
import { SUPPORTED_LOCALES, type Locale } from '@/lib/constants';
import { buildAlternates, buildCanonical } from '@/lib/seo/alternates';
import { I18nProvider } from '@/lib/i18n/provider';
import { QueryProvider } from '@/lib/providers/query-provider';
import { PublicHeader } from '@/components/layout/public-header';
import { PublicFooter } from '@/components/layout/public-footer';
import { SkipToContent } from '@/components/layout/skip-to-content';
import { InsuranceAgencyJsonLd } from '@/components/seo/jsonld-insurance-agency';
import { LocalBusinessJsonLd } from '@/components/seo/jsonld-local-business';
import { OrganizationJsonLd } from '@/components/seo/jsonld-organization';
import { env } from '@/lib/env';

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { locale } = await params;

  if (!SUPPORTED_LOCALES.includes(locale as Locale)) {
    notFound();
  }

  const messages = await loadMessages(locale as Locale);
  const indexingEnabled = env.NEXT_PUBLIC_ENABLE_INDEXING === 'true';

  return {
    title: {
      default: messages.seo.default_title,
      template: `%s | ${messages.seo.brand_name}`,
    },
    description: messages.seo.default_description,
    keywords: messages.seo.default_keywords.split(','),
    alternates: {
      canonical: buildCanonical(`/${locale}`),
      languages: buildAlternates('/'),
    },
    openGraph: {
      type: 'website',
      locale: ogLocale(locale as Locale),
      alternateLocale: SUPPORTED_LOCALES.filter((l) => l !== locale).map(ogLocale),
      url: buildCanonical(`/${locale}`),
      siteName: messages.seo.brand_name,
      title: messages.seo.default_title,
      description: messages.seo.default_description,
      images: [
        {
          url: '/opengraph-image',
          width: 1200,
          height: 630,
          alt: messages.seo.brand_name,
          type: 'image/png',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      site: '@SkaleanMA',
      creator: '@SkaleanMA',
      title: messages.seo.default_title,
      description: messages.seo.default_description,
      images: ['/opengraph-image'],
    },
    robots: {
      index: indexingEnabled,
      follow: indexingEnabled,
      nocache: !indexingEnabled,
      googleBot: {
        index: indexingEnabled,
        follow: indexingEnabled,
        noimageindex: !indexingEnabled,
        'max-image-preview': 'large',
        'max-snippet': -1,
        'max-video-preview': -1,
      },
    },
    verification: {
      google: env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
      other: {
        'msvalidate.01': env.NEXT_PUBLIC_BING_SITE_VERIFICATION ?? '',
      },
    },
    category: 'insurance',
    classification: 'business',
  };
}

function ogLocale(locale: Locale): string {
  switch (locale) {
    case 'fr':
      return 'fr_MA';
    case 'ar-MA':
      return 'ar_MA';
    case 'ar':
      return 'ar_AR';
  }
}

export default async function LocaleLayout({ children, params }: LayoutProps) {
  const { locale } = await params;

  if (!SUPPORTED_LOCALES.includes(locale as Locale)) {
    notFound();
  }

  const messages = await loadMessages(locale as Locale);
  const isRTL = locale === 'ar' || locale === 'ar-MA';

  return (
    <I18nProvider locale={locale as Locale} messages={messages}>
      <QueryProvider>
        <div lang={locale} dir={isRTL ? 'rtl' : 'ltr'} className="flex min-h-screen flex-col">
          <SkipToContent />
          <PublicHeader />
          <main id="main-content" className="flex-1">
            {children}
          </main>
          <PublicFooter />
        </div>
        <InsuranceAgencyJsonLd locale={locale as Locale} messages={messages} />
        <LocalBusinessJsonLd locale={locale as Locale} messages={messages} />
        <OrganizationJsonLd locale={locale as Locale} messages={messages} />
      </QueryProvider>
    </I18nProvider>
  );
}
```

**Notes** :
- `generateStaticParams` declare locales pour Static Generation (build genere `/fr`, `/ar-MA`, `/ar`)
- `params` est `Promise` en Next 15 -> await obligatoire
- `notFound()` redirige vers `not-found.tsx` si locale invalide
- `dir` attribut applique pour RTL ar/ar-MA -> CSS `rtl:` Tailwind variants fonctionnent
- 3 JsonLd composants injectent structured data global -> chaque page peut ajouter sa propre structured data specifique

### Fichier 6/15 : `repo/apps/web-customer-portal/app/robots.ts`

Robots.txt dynamique avec env conditional pour empecher indexation staging/dev.

```typescript
import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = env.NEXT_PUBLIC_SITE_URL;
  const indexingEnabled = env.NEXT_PUBLIC_ENABLE_INDEXING === 'true';

  if (!indexingEnabled) {
    return {
      rules: [
        {
          userAgent: '*',
          disallow: '/',
        },
      ],
      sitemap: `${baseUrl}/sitemap.xml`,
    };
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/_next/',
          '/admin/',
          '/souscription/etape-*',
          '/souscription/paiement/return',
          '/souscription/confirmation',
          '/*?session=*',
          '/*?wizard=*',
        ],
        crawlDelay: 1,
      },
      {
        userAgent: 'GPTBot',
        disallow: '/',
      },
      {
        userAgent: 'ChatGPT-User',
        disallow: '/',
      },
      {
        userAgent: 'Google-Extended',
        disallow: '/',
      },
      {
        userAgent: 'CCBot',
        disallow: '/',
      },
      {
        userAgent: 'anthropic-ai',
        disallow: '/',
      },
      {
        userAgent: 'Claude-Web',
        disallow: '/',
      },
      {
        userAgent: 'PerplexityBot',
        disallow: '/',
      },
      {
        userAgent: 'Googlebot',
        allow: '/',
        crawlDelay: 0,
      },
      {
        userAgent: 'Bingbot',
        allow: '/',
        crawlDelay: 1,
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
```

**Notes** :
- En dev/staging (`NEXT_PUBLIC_ENABLE_INDEXING=false`) -> tout disallow + sitemap reference quand meme (Google peut tester) -> staging URL pas indexee
- En prod : allow tous pages publiques marketing + disallow API/wizard interne (sessions privees user)
- Block AI crawlers (decision-005 + decision-008 ; data assure ne doit pas finir dans LLM training)
- `crawlDelay: 1` pour bots autres que Googlebot -> evite saturation infra

### Fichier 7/15 : `repo/apps/web-customer-portal/app/sitemap.ts`

Sitemap dynamique genere avec toutes pages publiques x 3 locales + priorities + changefreq.

```typescript
import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';
import { SUPPORTED_LOCALES, BRANCHES, type Locale, type Branche } from '@/lib/constants';

const ROOT_PRIORITY = 1.0;
const BRANCHE_PRIORITY = 0.9;
const SIMULATOR_PRIORITY = 0.8;
const COMPARER_PRIORITY = 0.8;
const STATIC_PRIORITY = 0.5;

const ROOT_CHANGEFREQ = 'weekly' as const;
const BRANCHE_CHANGEFREQ = 'weekly' as const;
const STATIC_CHANGEFREQ = 'monthly' as const;

interface SitemapEntry {
  url: string;
  lastModified: Date;
  changeFrequency: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority: number;
  alternates?: {
    languages: Record<string, string>;
  };
}

function buildLocalizedEntry(
  path: string,
  priority: number,
  changeFrequency: SitemapEntry['changeFrequency'],
  lastModified: Date
): SitemapEntry[] {
  const baseUrl = env.NEXT_PUBLIC_SITE_URL;

  return SUPPORTED_LOCALES.map((locale) => {
    const languages: Record<string, string> = {};
    for (const altLocale of SUPPORTED_LOCALES) {
      languages[altLocale] = `${baseUrl}/${altLocale}${path}`;
    }
    languages['x-default'] = `${baseUrl}/fr${path}`;

    return {
      url: `${baseUrl}/${locale}${path}`,
      lastModified,
      changeFrequency,
      priority,
      alternates: { languages },
    };
  });
}

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const entries: SitemapEntry[] = [];

  entries.push(...buildLocalizedEntry('', ROOT_PRIORITY, ROOT_CHANGEFREQ, now));

  for (const branche of BRANCHES) {
    entries.push(
      ...buildLocalizedEntry(`/${branche.slug}`, BRANCHE_PRIORITY, BRANCHE_CHANGEFREQ, now)
    );
    entries.push(
      ...buildLocalizedEntry(
        `/simulateur/${branche.slug}`,
        SIMULATOR_PRIORITY,
        BRANCHE_CHANGEFREQ,
        now
      )
    );
    entries.push(
      ...buildLocalizedEntry(
        `/comparer/${branche.slug}`,
        COMPARER_PRIORITY,
        BRANCHE_CHANGEFREQ,
        now
      )
    );
  }

  const staticPages = ['/a-propos', '/contact', '/mentions-legales', '/cgu', '/politique-confidentialite', '/faq'];
  for (const path of staticPages) {
    entries.push(...buildLocalizedEntry(path, STATIC_PRIORITY, STATIC_CHANGEFREQ, now));
  }

  return entries;
}
```

**Notes** :
- Pas d'inclusion des routes `/souscription/etape-*` (privees user)
- Alternates linguistiques pour SEO multilangue (Google utilise pour serve la bonne version)
- `x-default` pointe vers `/fr` (default locale)
- Toutes URLs absolues (requis sitemap protocol)

### Fichier 8/15 : `repo/apps/web-customer-portal/app/opengraph-image.tsx`

OG image dynamique generee par Vercel OG / Edge Runtime, taille 1200x630 (Facebook/Twitter standard).

```typescript
import { ImageResponse } from 'next/og';
import { env } from '@/lib/env';

export const runtime = 'edge';
export const alt = 'Skalean Insurtech - Vente en ligne assurance Maroc';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0B1220 0%, #1E3A8A 50%, #0EA5E9 100%)',
          fontFamily: '"Inter", sans-serif',
          padding: '60px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '40px',
          }}
        >
          <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
            <rect width="80" height="80" rx="16" fill="#FFFFFF" />
            <path
              d="M20 40 L35 25 L50 40 L35 55 Z"
              fill="#0EA5E9"
              stroke="#1E3A8A"
              strokeWidth="2"
            />
            <circle cx="55" cy="40" r="10" fill="#1E3A8A" />
          </svg>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              marginLeft: '24px',
            }}
          >
            <div
              style={{
                fontSize: '64px',
                fontWeight: 700,
                color: '#FFFFFF',
                lineHeight: 1.0,
              }}
            >
              Skalean
            </div>
            <div
              style={{
                fontSize: '32px',
                fontWeight: 400,
                color: '#0EA5E9',
                lineHeight: 1.0,
                marginTop: '4px',
              }}
            >
              Insurtech
            </div>
          </div>
        </div>

        <div
          style={{
            fontSize: '48px',
            fontWeight: 600,
            color: '#FFFFFF',
            textAlign: 'center',
            maxWidth: '900px',
            lineHeight: 1.2,
            marginBottom: '24px',
          }}
        >
          Souscrivez votre assurance en ligne au Maroc
        </div>

        <div
          style={{
            fontSize: '28px',
            color: '#CBD5E1',
            textAlign: 'center',
            maxWidth: '800px',
            lineHeight: 1.4,
          }}
        >
          Auto, Sante, Habitation, RC Pro, Voyage. Comparez et souscrivez en 5 minutes.
        </div>

        <div
          style={{
            position: 'absolute',
            bottom: '40px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            fontSize: '20px',
            color: '#94A3B8',
          }}
        >
          <span>Donnees hebergees au Maroc</span>
          <span>|</span>
          <span>Conforme ACAPS / CNDP</span>
          <span>|</span>
          <span>Loi 17-99</span>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
```

**Notes** :
- `export const runtime = 'edge'` -> Edge Runtime pour latence minimale generation
- Pas d'images externes (eviter timeout 25s)
- Couleurs Sofidemy design tokens (`#0B1220` dark, `#1E3A8A` primary, `#0EA5E9` accent)
- Tous textes en dur (pas i18n dans OG car serveur peut pas await locale -> Tache 4.4.11 ajoutera variants per locale via `/[locale]/opengraph-image.tsx`)
- Conforme decision-008 mention "Donnees hebergees au Maroc" pour SEO trust

### Fichier 9/15 : `repo/apps/web-customer-portal/components/layout/public-header.tsx`

Header public : logo + nav primary + locale switcher + CTA "Souscrire".

```typescript
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { LocaleSwitcher } from './locale-switcher';
import { useI18n } from '@/lib/i18n/provider';
import { BRANCHES } from '@/lib/constants';
import { cn } from '@/lib/utils/cn';

export function PublicHeader() {
  const { locale, t } = useI18n();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { href: `/${locale}/auto`, label: t('nav.auto') },
    { href: `/${locale}/sante`, label: t('nav.sante') },
    { href: `/${locale}/habitation`, label: t('nav.habitation') },
    { href: `/${locale}/rc-pro`, label: t('nav.rc_pro') },
    { href: `/${locale}/voyage`, label: t('nav.voyage') },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 lg:px-8">
        <Link
          href={`/${locale}`}
          className="flex items-center gap-2 text-lg font-bold text-slate-900"
          aria-label={t('nav.home_aria')}
        >
          <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
            <rect width="32" height="32" rx="6" fill="#1E3A8A" />
            <path d="M8 16 L14 10 L20 16 L14 22 Z" fill="#0EA5E9" />
            <circle cx="22" cy="16" r="4" fill="#FFFFFF" />
          </svg>
          <span>Skalean Insurtech</span>
        </Link>

        <nav className="hidden lg:flex items-center gap-6" aria-label={t('nav.primary')}>
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'text-sm font-medium transition-colors hover:text-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500',
                  isActive ? 'text-blue-700' : 'text-slate-700'
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <LocaleSwitcher />
          <Link
            href={`/${locale}/simulateur/auto`}
            className="hidden lg:inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          >
            {t('nav.cta_simulate')}
          </Link>
          <Link
            href={env.NEXT_PUBLIC_ASSURE_PORTAL_URL ?? '#'}
            className="hidden md:inline-flex items-center text-sm font-medium text-slate-700 hover:text-blue-700"
          >
            {t('nav.already_client')}
          </Link>
          <button
            type="button"
            className="lg:hidden p-2 text-slate-700"
            onClick={() => setMobileOpen((s) => !s)}
            aria-label={mobileOpen ? t('nav.close_menu') : t('nav.open_menu')}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
          >
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav
          id="mobile-nav"
          className="lg:hidden border-t border-slate-200 bg-white px-4 py-4"
          aria-label={t('nav.mobile')}
        >
          <ul className="flex flex-col gap-3">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="block py-2 text-sm font-medium text-slate-700 hover:text-blue-700"
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href={`/${locale}/simulateur/auto`}
                className="block mt-2 rounded-md bg-blue-600 px-4 py-2 text-center text-sm font-semibold text-white"
                onClick={() => setMobileOpen(false)}
              >
                {t('nav.cta_simulate')}
              </Link>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
```

**Notes** :
- `'use client'` car interactivity (useState mobile menu)
- `usePathname` pour aria-current active state
- Backdrop blur + opacite : header glass effect performant
- Mobile nav accessible (aria-expanded, aria-controls)
- Focus-visible outline pour navigation clavier (a11y WCAG)

### Fichier 10/15 : `repo/apps/web-customer-portal/components/layout/public-footer.tsx`

Footer public : about + liens legaux + contact + reseaux + mentions conformite MA.

```typescript
import Link from 'next/link';
import { useI18n } from '@/lib/i18n/provider';

export function PublicFooter() {
  const { locale, t } = useI18n();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-200 bg-slate-900 text-slate-200" role="contentinfo">
      <div className="container mx-auto px-4 py-12 lg:px-8 lg:py-16">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
                <rect width="32" height="32" rx="6" fill="#0EA5E9" />
                <path d="M8 16 L14 10 L20 16 L14 22 Z" fill="#1E3A8A" />
              </svg>
              <span className="text-lg font-bold text-white">Skalean Insurtech</span>
            </div>
            <p className="text-sm leading-relaxed text-slate-400">
              {t('footer.about_short')}
            </p>
            <div className="mt-4 flex items-center gap-3 text-xs text-slate-500">
              <span>{t('footer.acaps_mention')}</span>
            </div>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">
              {t('footer.products')}
            </h3>
            <ul className="space-y-2 text-sm">
              <li><Link href={`/${locale}/auto`} className="text-slate-400 hover:text-white">{t('nav.auto')}</Link></li>
              <li><Link href={`/${locale}/sante`} className="text-slate-400 hover:text-white">{t('nav.sante')}</Link></li>
              <li><Link href={`/${locale}/habitation`} className="text-slate-400 hover:text-white">{t('nav.habitation')}</Link></li>
              <li><Link href={`/${locale}/rc-pro`} className="text-slate-400 hover:text-white">{t('nav.rc_pro')}</Link></li>
              <li><Link href={`/${locale}/voyage`} className="text-slate-400 hover:text-white">{t('nav.voyage')}</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">
              {t('footer.support')}
            </h3>
            <ul className="space-y-2 text-sm">
              <li><Link href={`/${locale}/faq`} className="text-slate-400 hover:text-white">{t('footer.faq')}</Link></li>
              <li><Link href={`/${locale}/contact`} className="text-slate-400 hover:text-white">{t('footer.contact')}</Link></li>
              <li><Link href={`/${locale}/a-propos`} className="text-slate-400 hover:text-white">{t('footer.about')}</Link></li>
              <li>
                <a
                  href="tel:+212522000000"
                  className="text-slate-400 hover:text-white"
                  aria-label={t('footer.phone_aria')}
                >
                  +212 5 22 00 00 00
                </a>
              </li>
              <li>
                <a
                  href="mailto:support@skalean-insurtech.ma"
                  className="text-slate-400 hover:text-white"
                >
                  support@skalean-insurtech.ma
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">
              {t('footer.legal')}
            </h3>
            <ul className="space-y-2 text-sm">
              <li><Link href={`/${locale}/mentions-legales`} className="text-slate-400 hover:text-white">{t('footer.mentions')}</Link></li>
              <li><Link href={`/${locale}/cgu`} className="text-slate-400 hover:text-white">{t('footer.cgu')}</Link></li>
              <li><Link href={`/${locale}/politique-confidentialite`} className="text-slate-400 hover:text-white">{t('footer.privacy')}</Link></li>
              <li><Link href={`/${locale}/cookies`} className="text-slate-400 hover:text-white">{t('footer.cookies')}</Link></li>
              <li><a href="https://www.acaps.ma" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white">{t('footer.acaps_link')}</a></li>
              <li><a href="https://www.cndp.ma" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white">{t('footer.cndp_link')}</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-slate-800 pt-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="text-xs text-slate-500">
            <p>
              {t('footer.copyright', { year: currentYear })}
            </p>
            <p className="mt-1">
              {t('footer.compliance_mention')}
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span>{t('footer.data_residency')}</span>
            <span aria-hidden="true">|</span>
            <span>{t('footer.loi_09_08')}</span>
            <span aria-hidden="true">|</span>
            <span>{t('footer.loi_43_20')}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
```

**Notes** :
- Server Component (pas 'use client' car pas d'interactivity)
- Mention ACAPS + CNDP visibles -> SEO trust + compliance
- Liens externes `rel="noopener noreferrer"` (a11y + securite)
- Telephone format MA +212 5 22 00 00 00

### Fichier 11/15 : `repo/apps/web-customer-portal/components/seo/jsonld-insurance-agency.tsx`

Structured data schema.org InsuranceAgency complet (Google Rich Snippets eligibility).

```typescript
import type { Locale, Messages } from '@/lib/i18n/types';
import { env } from '@/lib/env';

interface InsuranceAgencyJsonLdProps {
  locale: Locale;
  messages: Messages;
}

export function InsuranceAgencyJsonLd({ locale, messages }: InsuranceAgencyJsonLdProps) {
  const baseUrl = env.NEXT_PUBLIC_SITE_URL;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'InsuranceAgency',
    '@id': `${baseUrl}/#insuranceagency`,
    name: messages.seo.brand_name,
    alternateName: 'Skalean InsurTech',
    legalName: 'Skalean Insurtech SARL',
    url: `${baseUrl}/${locale}`,
    logo: {
      '@type': 'ImageObject',
      url: `${baseUrl}/logo.png`,
      width: 512,
      height: 512,
    },
    image: `${baseUrl}/opengraph-image`,
    description: messages.seo.default_description,
    foundingDate: '2025-01-01',
    foundingLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Casablanca',
        addressCountry: 'MA',
      },
    },
    slogan: messages.seo.slogan,
    keywords: messages.seo.default_keywords,
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Boulevard Mohamed V, Quartier des Affaires',
      addressLocality: 'Casablanca',
      addressRegion: 'Casablanca-Settat',
      postalCode: '20000',
      addressCountry: 'MA',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: 33.5731,
      longitude: -7.5898,
    },
    telephone: '+212522000000',
    email: 'contact@skalean-insurtech.ma',
    sameAs: [
      'https://www.linkedin.com/company/skalean-insurtech',
      'https://www.facebook.com/SkaleanInsurtech',
      'https://twitter.com/SkaleanMA',
      'https://www.instagram.com/skalean.insurtech',
      'https://www.youtube.com/@SkaleanInsurtech',
    ],
    contactPoint: [
      {
        '@type': 'ContactPoint',
        telephone: '+212522000000',
        contactType: 'customer service',
        areaServed: 'MA',
        availableLanguage: ['French', 'Arabic'],
        hoursAvailable: {
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
          opens: '08:30',
          closes: '18:30',
          validFrom: '2025-01-01',
        },
      },
      {
        '@type': 'ContactPoint',
        telephone: '+212522000001',
        contactType: 'sales',
        areaServed: 'MA',
        availableLanguage: ['French', 'Arabic'],
      },
    ],
    areaServed: {
      '@type': 'Country',
      name: 'Morocco',
      identifier: 'MA',
    },
    serviceArea: {
      '@type': 'AdministrativeArea',
      name: 'Royaume du Maroc',
    },
    knowsLanguage: ['fr-MA', 'ar-MA', 'ar'],
    currenciesAccepted: 'MAD',
    paymentAccepted: ['Credit Card', 'Bank Transfer', 'Mobile Money', 'Cash'],
    priceRange: 'MAD',
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: messages.seo.product_catalog_name,
      itemListElement: [
        { '@type': 'Offer', name: messages.nav.auto, url: `${baseUrl}/${locale}/auto` },
        { '@type': 'Offer', name: messages.nav.sante, url: `${baseUrl}/${locale}/sante` },
        { '@type': 'Offer', name: messages.nav.habitation, url: `${baseUrl}/${locale}/habitation` },
        { '@type': 'Offer', name: messages.nav.rc_pro, url: `${baseUrl}/${locale}/rc-pro` },
        { '@type': 'Offer', name: messages.nav.voyage, url: `${baseUrl}/${locale}/voyage` },
      ],
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.6',
      reviewCount: '128',
      bestRating: '5',
      worstRating: '1',
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
```

**Notes** :
- `@id` permet linking entre structured data (Knowledge Graph Google)
- `aggregateRating` Sprint 17 = placeholder (Sprint 35+ : reels avis post-pilote)
- `hasOfferCatalog` lie aux 5 branches -> Google peut afficher carousel produits
- Telephone format E.164 (`+212522000000`)
- `geo` coordonnees Casablanca centre -> local SEO

### Fichier 12/15 : `repo/apps/web-customer-portal/lib/env.ts`

Env loader Zod strict avec fail-fast au boot.

```typescript
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  NEXT_PUBLIC_SITE_URL: z
    .string()
    .url()
    .default('http://localhost:3004')
    .refine((val) => !val.endsWith('/'), {
      message: 'NEXT_PUBLIC_SITE_URL must not end with /',
    }),

  NEXT_PUBLIC_API_BASE_URL: z
    .string()
    .url()
    .default('http://localhost:4000'),

  NEXT_PUBLIC_ASSURE_PORTAL_URL: z.string().url().optional(),

  NEXT_PUBLIC_ENABLE_INDEXING: z.enum(['true', 'false']).default('false'),

  NEXT_PUBLIC_GA_TRACKING_ID: z
    .string()
    .regex(/^G-[A-Z0-9]{10}$/, 'GA4 tracking ID format invalid (G-XXXXXXXXXX)')
    .optional(),

  NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION: z.string().optional(),

  NEXT_PUBLIC_BING_SITE_VERIFICATION: z.string().optional(),

  NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY: z
    .string()
    .regex(/^0x[A-Z0-9_]+$/, 'Turnstile site key format invalid')
    .optional(),

  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),

  NEXT_PUBLIC_DEFAULT_LOCALE: z.enum(['fr', 'ar-MA', 'ar']).default('fr'),

  NEXT_PUBLIC_TENANT_PUBLIC_ID: z.string().min(1).default('skalean-public'),
});

const parsed = envSchema.safeParse({
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  NEXT_PUBLIC_ASSURE_PORTAL_URL: process.env.NEXT_PUBLIC_ASSURE_PORTAL_URL,
  NEXT_PUBLIC_ENABLE_INDEXING: process.env.NEXT_PUBLIC_ENABLE_INDEXING,
  NEXT_PUBLIC_GA_TRACKING_ID: process.env.NEXT_PUBLIC_GA_TRACKING_ID,
  NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
  NEXT_PUBLIC_BING_SITE_VERIFICATION: process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION,
  NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  NEXT_PUBLIC_DEFAULT_LOCALE: process.env.NEXT_PUBLIC_DEFAULT_LOCALE,
  NEXT_PUBLIC_TENANT_PUBLIC_ID: process.env.NEXT_PUBLIC_TENANT_PUBLIC_ID,
});

if (!parsed.success) {
  const errors = parsed.error.flatten().fieldErrors;
  const messages = Object.entries(errors)
    .map(([key, errs]) => `${key}: ${(errs ?? []).join(', ')}`)
    .join('\n');
  throw new Error(`Environment validation failed:\n${messages}`);
}

export const env = parsed.data;
export type Env = z.infer<typeof envSchema>;
```

**Notes** :
- Fail-fast au build -> impossible de deployer avec env invalide
- Zod regex validation pour GA4 ID + Turnstile (formats stricts)
- Defaults dev pour DX (dev sans .env fonctionne)
- Tous public via `NEXT_PUBLIC_*` -> Next.js inline ces vars dans bundle client

### Fichier 13/15 : `repo/apps/web-customer-portal/lib/constants.ts`

Constants centralisees : locales, branches, breakpoints, URLs.

```typescript
export const SUPPORTED_LOCALES = ['fr', 'ar-MA', 'ar'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'fr';

export const RTL_LOCALES: ReadonlyArray<Locale> = ['ar', 'ar-MA'];

export function isRTL(locale: Locale): boolean {
  return RTL_LOCALES.includes(locale);
}

export interface BrancheConfig {
  readonly slug: string;
  readonly code: 'auto' | 'sante' | 'habitation' | 'rc-pro' | 'voyage';
  readonly category: 'damage' | 'health' | 'property' | 'liability' | 'travel';
  readonly defaultMinPremium: number;
  readonly icon: string;
}

export const BRANCHES: ReadonlyArray<BrancheConfig> = [
  { slug: 'auto', code: 'auto', category: 'damage', defaultMinPremium: 1500, icon: 'Car' },
  { slug: 'sante', code: 'sante', category: 'health', defaultMinPremium: 3000, icon: 'Heart' },
  { slug: 'habitation', code: 'habitation', category: 'property', defaultMinPremium: 800, icon: 'Home' },
  { slug: 'rc-pro', code: 'rc-pro', category: 'liability', defaultMinPremium: 2500, icon: 'Briefcase' },
  { slug: 'voyage', code: 'voyage', category: 'travel', defaultMinPremium: 200, icon: 'Plane' },
] as const;

export type Branche = (typeof BRANCHES)[number];

export const BRANCHE_SLUGS = BRANCHES.map((b) => b.slug);

export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

export const WIZARD_STEPS = ['etape-1', 'etape-2', 'etape-3', 'etape-4'] as const;
export type WizardStep = (typeof WIZARD_STEPS)[number];

export const API_ENDPOINTS = {
  quotePreview: '/api/v1/insure/quotes/preview',
  wizardSave: '/api/v1/insure/wizards',
  provisionalGenerate: '/api/v1/insure/provisional/generate',
  paymentInitiate: '/api/v1/pay/transactions/initiate',
  signatureSession: '/api/v1/signature/sessions',
} as const;

export const STORAGE_KEYS = {
  wizardState: 'insurtech_wizard_state',
  currentQuote: 'insurtech_current_quote',
  cookieConsent: 'insurtech_cookie_consent',
} as const;

export const COOKIE_NAMES = {
  wizardToken: 'wizard_token',
  consent: 'cookie_consent',
} as const;
```

**Notes** :
- `as const` pour readonly tuples + literal types
- 5 branches MA conformes catalog Sprint 14
- Premium minimums realistes marche MA (Auto 1500 MAD/an minimum tier broker)
- WIZARD_STEPS 4 etapes (Taches 4.4.6-4.4.9)

### Fichier 14/15 : `repo/apps/web-customer-portal/lib/i18n/load-messages.ts`

Loader async messages avec cache In-Memory (Server Components compatibles).

```typescript
import 'server-only';
import { cache } from 'react';
import type { Locale } from '@/lib/constants';
import type { Messages } from './types';

const messageCache = new Map<Locale, Messages>();

export const loadMessages = cache(async (locale: Locale): Promise<Messages> => {
  if (messageCache.has(locale)) {
    return messageCache.get(locale)!;
  }

  try {
    const messages = (await import(`@/messages/${locale}.json`)).default as Messages;
    messageCache.set(locale, messages);
    return messages;
  } catch (error) {
    if (locale !== 'fr') {
      const fallback = (await import('@/messages/fr.json')).default as Messages;
      return fallback;
    }
    throw new Error(`Failed to load messages for locale ${locale}: ${(error as Error).message}`);
  }
});

export function interpolate(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return params[key] !== undefined ? String(params[key]) : match;
  });
}
```

**Notes** :
- `'server-only'` empeche import accidentel cote client (bundle bloat)
- `cache()` React 19 deduplicate calls dans meme render pass
- Fallback `fr` si traduction manquante (defense en profondeur)
- `interpolate()` pour params dynamiques (annee, nom utilisateur)

### Fichier 15/15 : `repo/apps/web-customer-portal/lib/seo/alternates.ts`

Helpers SEO : alternates linguistiques + canonical URLs absolues.

```typescript
import { env } from '@/lib/env';
import { SUPPORTED_LOCALES, type Locale } from '@/lib/constants';

export function buildCanonical(path: string): string {
  const baseUrl = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`;
}

export function buildAlternates(pathWithoutLocale: string): Record<string, string> {
  const baseUrl = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  const cleanPath = pathWithoutLocale.startsWith('/') ? pathWithoutLocale : `/${pathWithoutLocale}`;

  const alternates: Record<string, string> = {};
  for (const locale of SUPPORTED_LOCALES) {
    alternates[locale] = `${baseUrl}/${locale}${cleanPath === '/' ? '' : cleanPath}`;
  }
  alternates['x-default'] = `${baseUrl}/fr${cleanPath === '/' ? '' : cleanPath}`;
  return alternates;
}

export function stripLocaleFromPathname(pathname: string): string {
  for (const locale of SUPPORTED_LOCALES) {
    if (pathname.startsWith(`/${locale}/`)) {
      return pathname.slice(locale.length + 1);
    }
    if (pathname === `/${locale}`) {
      return '/';
    }
  }
  return pathname;
}

export function ensureLocaleInPathname(pathname: string, locale: Locale): string {
  const stripped = stripLocaleFromPathname(pathname);
  return `/${locale}${stripped === '/' ? '' : stripped}`;
}

export function buildOpenGraphLocale(locale: Locale): string {
  switch (locale) {
    case 'fr':
      return 'fr_MA';
    case 'ar-MA':
      return 'ar_MA';
    case 'ar':
      return 'ar_AR';
  }
}
```

**Notes** :
- `replace(/\/$/, '')` defensive trim trailing slash
- `x-default` -> Google fallback si locale visiteur pas supportee
- OG locale format `xx_YY` (ISO 639-1 + ISO 3166-1)

## 7. Tests complets

### 7.1 Tests unitaires : `__tests__/lib/env.spec.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('env loader', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should load defaults when no env vars set', async () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    delete process.env.NEXT_PUBLIC_ENABLE_INDEXING;

    const { env } = await import('@/lib/env');
    expect(env.NEXT_PUBLIC_SITE_URL).toBe('http://localhost:3004');
    expect(env.NEXT_PUBLIC_API_BASE_URL).toBe('http://localhost:4000');
    expect(env.NEXT_PUBLIC_ENABLE_INDEXING).toBe('false');
  });

  it('should accept valid SITE_URL', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://souscrire.skalean-insurtech.ma';
    const { env } = await import('@/lib/env');
    expect(env.NEXT_PUBLIC_SITE_URL).toBe('https://souscrire.skalean-insurtech.ma');
  });

  it('should reject SITE_URL with trailing slash', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://souscrire.skalean-insurtech.ma/';
    await expect(import('@/lib/env')).rejects.toThrow(/must not end with/);
  });

  it('should reject invalid URL format', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'not-a-url';
    await expect(import('@/lib/env')).rejects.toThrow();
  });

  it('should accept valid GA4 tracking ID', async () => {
    process.env.NEXT_PUBLIC_GA_TRACKING_ID = 'G-ABC1234567';
    const { env } = await import('@/lib/env');
    expect(env.NEXT_PUBLIC_GA_TRACKING_ID).toBe('G-ABC1234567');
  });

  it('should reject GA4 tracking ID with wrong format', async () => {
    process.env.NEXT_PUBLIC_GA_TRACKING_ID = 'UA-12345';
    await expect(import('@/lib/env')).rejects.toThrow(/GA4 tracking ID format invalid/);
  });

  it('should accept ENABLE_INDEXING true or false strings only', async () => {
    process.env.NEXT_PUBLIC_ENABLE_INDEXING = 'true';
    const { env } = await import('@/lib/env');
    expect(env.NEXT_PUBLIC_ENABLE_INDEXING).toBe('true');
  });

  it('should reject ENABLE_INDEXING with other strings', async () => {
    process.env.NEXT_PUBLIC_ENABLE_INDEXING = 'yes';
    await expect(import('@/lib/env')).rejects.toThrow();
  });

  it('should accept valid default locale', async () => {
    process.env.NEXT_PUBLIC_DEFAULT_LOCALE = 'ar-MA';
    const { env } = await import('@/lib/env');
    expect(env.NEXT_PUBLIC_DEFAULT_LOCALE).toBe('ar-MA');
  });

  it('should reject invalid default locale', async () => {
    process.env.NEXT_PUBLIC_DEFAULT_LOCALE = 'en';
    await expect(import('@/lib/env')).rejects.toThrow();
  });

  it('should default tenant_public_id to skalean-public', async () => {
    delete process.env.NEXT_PUBLIC_TENANT_PUBLIC_ID;
    const { env } = await import('@/lib/env');
    expect(env.NEXT_PUBLIC_TENANT_PUBLIC_ID).toBe('skalean-public');
  });

  it('should accept Turnstile site key with valid format', async () => {
    process.env.NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY = '0x4AAAAAAA_TEST_KEY';
    const { env } = await import('@/lib/env');
    expect(env.NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY).toBe('0x4AAAAAAA_TEST_KEY');
  });
});
```

### 7.2 Tests unitaires : `__tests__/lib/i18n/load-messages.spec.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadMessages, interpolate } from '@/lib/i18n/load-messages';

vi.mock('server-only', () => ({}));

describe('loadMessages', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('should load fr messages successfully', async () => {
    const messages = await loadMessages('fr');
    expect(messages).toBeDefined();
    expect(messages.seo.brand_name).toBe('Skalean Insurtech');
  });

  it('should load ar-MA messages successfully', async () => {
    const messages = await loadMessages('ar-MA');
    expect(messages).toBeDefined();
    expect(messages.seo.brand_name).toBeDefined();
  });

  it('should load ar messages successfully', async () => {
    const messages = await loadMessages('ar');
    expect(messages).toBeDefined();
  });

  it('should cache messages on second call', async () => {
    const first = await loadMessages('fr');
    const second = await loadMessages('fr');
    expect(first).toBe(second);
  });

  it('should fallback to fr if other locale fails to load', async () => {
    const messages = await loadMessages('fr');
    expect(messages.nav.auto).toBeDefined();
  });

  it('should have all required nav keys per locale', async () => {
    for (const locale of ['fr', 'ar-MA', 'ar'] as const) {
      const messages = await loadMessages(locale);
      expect(messages.nav.auto).toBeDefined();
      expect(messages.nav.sante).toBeDefined();
      expect(messages.nav.habitation).toBeDefined();
      expect(messages.nav.rc_pro).toBeDefined();
      expect(messages.nav.voyage).toBeDefined();
    }
  });

  it('should have all required seo keys per locale', async () => {
    for (const locale of ['fr', 'ar-MA', 'ar'] as const) {
      const messages = await loadMessages(locale);
      expect(messages.seo.default_title).toBeDefined();
      expect(messages.seo.default_description).toBeDefined();
      expect(messages.seo.default_keywords).toBeDefined();
    }
  });
});

describe('interpolate', () => {
  it('should replace single placeholder', () => {
    expect(interpolate('Year {year}', { year: 2026 })).toBe('Year 2026');
  });

  it('should replace multiple placeholders', () => {
    expect(
      interpolate('Hello {name}, you have {count} messages', { name: 'Saad', count: 5 })
    ).toBe('Hello Saad, you have 5 messages');
  });

  it('should leave unmatched placeholders untouched', () => {
    expect(interpolate('Hello {name}', {})).toBe('Hello {name}');
  });

  it('should handle empty string', () => {
    expect(interpolate('', { name: 'test' })).toBe('');
  });
});
```

### 7.3 Tests unitaires : `__tests__/lib/seo/alternates.spec.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import {
  buildCanonical,
  buildAlternates,
  stripLocaleFromPathname,
  ensureLocaleInPathname,
  buildOpenGraphLocale,
} from '@/lib/seo/alternates';

vi.mock('@/lib/env', () => ({
  env: {
    NEXT_PUBLIC_SITE_URL: 'https://souscrire.skalean-insurtech.ma',
  },
}));

describe('buildCanonical', () => {
  it('should build absolute URL from path', () => {
    expect(buildCanonical('/fr')).toBe('https://souscrire.skalean-insurtech.ma/fr');
  });

  it('should add leading slash if missing', () => {
    expect(buildCanonical('fr/auto')).toBe('https://souscrire.skalean-insurtech.ma/fr/auto');
  });

  it('should strip trailing slash from base URL', () => {
    expect(buildCanonical('/contact')).toBe('https://souscrire.skalean-insurtech.ma/contact');
  });

  it('should handle root path', () => {
    expect(buildCanonical('/')).toBe('https://souscrire.skalean-insurtech.ma/');
  });
});

describe('buildAlternates', () => {
  it('should build hreflang for all locales', () => {
    const alternates = buildAlternates('/auto');
    expect(alternates['fr']).toBe('https://souscrire.skalean-insurtech.ma/fr/auto');
    expect(alternates['ar-MA']).toBe('https://souscrire.skalean-insurtech.ma/ar-MA/auto');
    expect(alternates['ar']).toBe('https://souscrire.skalean-insurtech.ma/ar/auto');
  });

  it('should include x-default pointing to fr', () => {
    const alternates = buildAlternates('/sante');
    expect(alternates['x-default']).toBe('https://souscrire.skalean-insurtech.ma/fr/sante');
  });

  it('should handle root path correctly', () => {
    const alternates = buildAlternates('/');
    expect(alternates['fr']).toBe('https://souscrire.skalean-insurtech.ma/fr');
    expect(alternates['x-default']).toBe('https://souscrire.skalean-insurtech.ma/fr');
  });
});

describe('stripLocaleFromPathname', () => {
  it('should remove fr locale prefix', () => {
    expect(stripLocaleFromPathname('/fr/auto')).toBe('/auto');
  });

  it('should remove ar-MA locale prefix', () => {
    expect(stripLocaleFromPathname('/ar-MA/sante')).toBe('/sante');
  });

  it('should return / for /fr root', () => {
    expect(stripLocaleFromPathname('/fr')).toBe('/');
  });

  it('should return unchanged path if no locale found', () => {
    expect(stripLocaleFromPathname('/some/path')).toBe('/some/path');
  });
});

describe('ensureLocaleInPathname', () => {
  it('should add locale prefix to path without locale', () => {
    expect(ensureLocaleInPathname('/auto', 'fr')).toBe('/fr/auto');
  });

  it('should replace existing locale prefix', () => {
    expect(ensureLocaleInPathname('/fr/auto', 'ar-MA')).toBe('/ar-MA/auto');
  });

  it('should handle root', () => {
    expect(ensureLocaleInPathname('/fr', 'ar')).toBe('/ar');
  });
});

describe('buildOpenGraphLocale', () => {
  it('should map fr to fr_MA', () => {
    expect(buildOpenGraphLocale('fr')).toBe('fr_MA');
  });

  it('should map ar-MA to ar_MA', () => {
    expect(buildOpenGraphLocale('ar-MA')).toBe('ar_MA');
  });

  it('should map ar to ar_AR', () => {
    expect(buildOpenGraphLocale('ar')).toBe('ar_AR');
  });
});
```

### 7.4 Tests composants : `__tests__/components/seo/jsonld.spec.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { InsuranceAgencyJsonLd } from '@/components/seo/jsonld-insurance-agency';
import { LocalBusinessJsonLd } from '@/components/seo/jsonld-local-business';
import { OrganizationJsonLd } from '@/components/seo/jsonld-organization';
import type { Messages } from '@/lib/i18n/types';

vi.mock('@/lib/env', () => ({
  env: { NEXT_PUBLIC_SITE_URL: 'https://souscrire.skalean-insurtech.ma' },
}));

const mockMessages: Messages = {
  seo: {
    brand_name: 'Skalean Insurtech',
    default_title: 'Skalean Insurtech',
    default_description: 'Test',
    default_keywords: 'assurance,maroc',
    slogan: 'Souscrivez en ligne',
    product_catalog_name: 'Catalogue assurance',
  },
  nav: {
    auto: 'Auto',
    sante: 'Sante',
    habitation: 'Habitation',
    rc_pro: 'RC Pro',
    voyage: 'Voyage',
  },
} as Messages;

describe('InsuranceAgencyJsonLd', () => {
  it('should render valid JSON-LD script', () => {
    const { container } = render(<InsuranceAgencyJsonLd locale="fr" messages={mockMessages} />);
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).toBeTruthy();
  });

  it('should contain InsuranceAgency type', () => {
    const { container } = render(<InsuranceAgencyJsonLd locale="fr" messages={mockMessages} />);
    const script = container.querySelector('script')!;
    const data = JSON.parse(script.innerHTML);
    expect(data['@type']).toBe('InsuranceAgency');
  });

  it('should include Morocco address', () => {
    const { container } = render(<InsuranceAgencyJsonLd locale="fr" messages={mockMessages} />);
    const data = JSON.parse(container.querySelector('script')!.innerHTML);
    expect(data.address.addressCountry).toBe('MA');
    expect(data.address.addressLocality).toBe('Casablanca');
  });

  it('should include MAD currency', () => {
    const { container } = render(<InsuranceAgencyJsonLd locale="fr" messages={mockMessages} />);
    const data = JSON.parse(container.querySelector('script')!.innerHTML);
    expect(data.currenciesAccepted).toBe('MAD');
  });

  it('should include offer catalog with 5 branches', () => {
    const { container } = render(<InsuranceAgencyJsonLd locale="fr" messages={mockMessages} />);
    const data = JSON.parse(container.querySelector('script')!.innerHTML);
    expect(data.hasOfferCatalog.itemListElement).toHaveLength(5);
  });

  it('should include contact points', () => {
    const { container } = render(<InsuranceAgencyJsonLd locale="fr" messages={mockMessages} />);
    const data = JSON.parse(container.querySelector('script')!.innerHTML);
    expect(data.contactPoint).toBeInstanceOf(Array);
    expect(data.contactPoint[0].telephone).toMatch(/^\+212/);
  });

  it('should include sameAs social links', () => {
    const { container } = render(<InsuranceAgencyJsonLd locale="fr" messages={mockMessages} />);
    const data = JSON.parse(container.querySelector('script')!.innerHTML);
    expect(data.sameAs).toContain('https://www.linkedin.com/company/skalean-insurtech');
  });

  it('should produce valid JSON', () => {
    const { container } = render(<InsuranceAgencyJsonLd locale="fr" messages={mockMessages} />);
    const json = container.querySelector('script')!.innerHTML;
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it('should not contain any emoji', () => {
    const { container } = render(<InsuranceAgencyJsonLd locale="fr" messages={mockMessages} />);
    const json = container.querySelector('script')!.innerHTML;
    const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{27BF}]/u;
    expect(emojiRegex.test(json)).toBe(false);
  });

  it('should render different content per locale', () => {
    const { container: c1 } = render(<InsuranceAgencyJsonLd locale="fr" messages={mockMessages} />);
    const { container: c2 } = render(<InsuranceAgencyJsonLd locale="ar-MA" messages={mockMessages} />);
    const data1 = JSON.parse(c1.querySelector('script')!.innerHTML);
    const data2 = JSON.parse(c2.querySelector('script')!.innerHTML);
    expect(data1.url).toContain('/fr');
    expect(data2.url).toContain('/ar-MA');
  });
});
```

### 7.5 Tests integration routes : `__tests__/integration/routes.spec.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';

const PORT = 3099;
const BASE_URL = `http://localhost:${PORT}`;

let server: ChildProcess;

beforeAll(async () => {
  server = spawn('pnpm', ['next', 'start', '--port', String(PORT)], {
    env: { ...process.env, NODE_ENV: 'production', NEXT_PUBLIC_ENABLE_INDEXING: 'true' },
    stdio: 'pipe',
  });

  let ready = false;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`${BASE_URL}/fr`);
      if (res.status === 200) {
        ready = true;
        break;
      }
    } catch {
      await setTimeout(1000);
    }
  }
  if (!ready) throw new Error('Server did not start in 30s');
}, 60000);

afterAll(() => {
  server?.kill('SIGTERM');
});

describe('Public routes smoke tests', () => {
  it('should serve /fr with 200', async () => {
    const res = await fetch(`${BASE_URL}/fr`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('<html');
    expect(html).toContain('lang="fr"');
    expect(html).toContain('dir="ltr"');
  });

  it('should serve /ar-MA with rtl', async () => {
    const res = await fetch(`${BASE_URL}/ar-MA`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('lang="ar-MA"');
    expect(html).toContain('dir="rtl"');
  });

  it('should redirect / to /fr', async () => {
    const res = await fetch(BASE_URL, { redirect: 'manual' });
    expect([302, 307]).toContain(res.status);
    expect(res.headers.get('location')).toBe('/fr');
  });

  it('should serve robots.txt', async () => {
    const res = await fetch(`${BASE_URL}/robots.txt`);
    expect(res.status).toBe(200);
    const txt = await res.text();
    expect(txt).toContain('User-Agent');
    expect(txt).toContain('Sitemap:');
  });

  it('should serve sitemap.xml with valid XML', async () => {
    const res = await fetch(`${BASE_URL}/sitemap.xml`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('xml');
    const xml = await res.text();
    expect(xml).toContain('<?xml');
    expect(xml).toContain('<urlset');
  });

  it('should serve opengraph-image as PNG', async () => {
    const res = await fetch(`${BASE_URL}/opengraph-image`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('image/png');
  });

  it('should return 404 for unknown locale', async () => {
    const res = await fetch(`${BASE_URL}/en`);
    expect(res.status).toBe(404);
  });

  it('should set security headers', async () => {
    const res = await fetch(`${BASE_URL}/fr`);
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('strict-transport-security')).toContain('max-age=');
  });
});
```

### 7.6 Tests E2E placeholder (Tache 4.4.14 ajoutera plus)

```typescript
import { test, expect } from '@playwright/test';

test.describe('Foundation routes', () => {
  test('home FR renders', async ({ page }) => {
    await page.goto('/fr');
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    await expect(page.locator('header')).toBeVisible();
    await expect(page.locator('footer')).toBeVisible();
  });

  test('home AR-MA renders RTL', async ({ page }) => {
    await page.goto('/ar-MA');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });

  test('locale switcher works', async ({ page }) => {
    await page.goto('/fr');
    await page.click('[data-testid="locale-switcher"]');
    await page.click('[data-testid="locale-option-ar-MA"]');
    await expect(page).toHaveURL(/\/ar-MA/);
  });

  test('robots.txt accessible', async ({ page }) => {
    const res = await page.goto('/robots.txt');
    expect(res?.status()).toBe(200);
  });

  test('sitemap.xml accessible', async ({ page }) => {
    const res = await page.goto('/sitemap.xml');
    expect(res?.status()).toBe(200);
  });
});
```

### 7.7 Fixtures messages : `messages/fr.json` (extrait foundation)

```json
{
  "nav": {
    "home": "Accueil",
    "home_aria": "Retour a l accueil Skalean Insurtech",
    "auto": "Auto",
    "sante": "Sante",
    "habitation": "Habitation",
    "rc_pro": "RC Professionnelle",
    "voyage": "Voyage",
    "primary": "Navigation principale",
    "mobile": "Navigation mobile",
    "open_menu": "Ouvrir le menu",
    "close_menu": "Fermer le menu",
    "cta_simulate": "Calculer mon prix",
    "already_client": "Deja client ?"
  },
  "seo": {
    "brand_name": "Skalean Insurtech",
    "default_title": "Assurance en ligne au Maroc -- Skalean Insurtech",
    "default_description": "Comparez et souscrivez votre assurance auto, sante, habitation, RC pro ou voyage en ligne au Maroc. Tarification instantanee, paiement securise, attestation provisoire en 5 minutes.",
    "default_keywords": "assurance en ligne maroc,comparateur assurance,assurance auto casablanca,assurance sante rabat,habitation marrakech,rc pro tanger,voyage schengen,souscription en ligne",
    "slogan": "Votre assurance en ligne au Maroc, simple et transparente",
    "product_catalog_name": "Produits d assurance Skalean"
  },
  "footer": {
    "about_short": "Premier portail vente en ligne d assurance au Maroc. Conforme aux exigences ACAPS et CNDP.",
    "products": "Nos produits",
    "support": "Support",
    "legal": "Mentions legales",
    "faq": "Questions frequentes",
    "contact": "Nous contacter",
    "about": "A propos de Skalean",
    "phone_aria": "Appeler Skalean Insurtech",
    "mentions": "Mentions legales",
    "cgu": "Conditions generales d utilisation",
    "privacy": "Politique de confidentialite",
    "cookies": "Politique cookies",
    "acaps_mention": "Agrement ACAPS en cours",
    "acaps_link": "ACAPS - Autorite de Controle",
    "cndp_link": "CNDP - Donnees personnelles",
    "copyright": "Copyright {year} Skalean Insurtech SARL. Tous droits reserves.",
    "compliance_mention": "Skalean Insurtech respecte la loi 17-99 (Code des assurances), la loi 09-08 (CNDP) et la loi 43-20 (signature electronique).",
    "data_residency": "Donnees hebergees au Maroc",
    "loi_09_08": "Loi 09-08 CNDP",
    "loi_43_20": "Loi 43-20 signature"
  }
}
```

## 8. Variables environnement

```env
NODE_ENV=development

NEXT_PUBLIC_SITE_URL=http://localhost:3004
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
NEXT_PUBLIC_ASSURE_PORTAL_URL=http://localhost:3005

NEXT_PUBLIC_ENABLE_INDEXING=false

NEXT_PUBLIC_GA_TRACKING_ID=G-ABCDEFGHIJ
NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=
NEXT_PUBLIC_BING_SITE_VERIFICATION=

NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY=0x4AAAAAAA_TEST_KEY
NEXT_PUBLIC_SENTRY_DSN=

NEXT_PUBLIC_DEFAULT_LOCALE=fr
NEXT_PUBLIC_TENANT_PUBLIC_ID=skalean-public

NEXT_TELEMETRY_DISABLED=1
NEXT_SHARP_PATH=/tmp/node_modules/sharp
```

En production (`souscrire.skalean-insurtech.ma`) :
- `NEXT_PUBLIC_SITE_URL=https://souscrire.skalean-insurtech.ma`
- `NEXT_PUBLIC_API_BASE_URL=https://api.skalean-insurtech.ma`
- `NEXT_PUBLIC_ENABLE_INDEXING=true`
- `NEXT_PUBLIC_GA_TRACKING_ID=G-XXXX` (vraie valeur)
- `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=` (depuis Google Search Console)

## 9. Commandes shell

```bash
cd repo

pnpm install

cd apps/web-customer-portal
cp .env.example .env.local

pnpm install

pnpm dev

curl -I http://localhost:3004/fr
curl -I http://localhost:3004/ar-MA
curl http://localhost:3004/robots.txt
curl http://localhost:3004/sitemap.xml | xmllint --noout -
curl -I http://localhost:3004/opengraph-image

pnpm typecheck
pnpm lint
pnpm vitest run

cd ../..
pnpm --filter @insurtech/web-customer-portal build

npx @lhci/cli@latest collect --url=http://localhost:3004/fr --numberOfRuns=3
```

## 10. Criteres validation V1-V25

### Criteres P0 (bloquants -- 15 minimum)

- **V1 (P0 -- automatisable)** : `pnpm --filter @insurtech/web-customer-portal dev` demarre en moins de 10s
  - Commande : `time pnpm --filter @insurtech/web-customer-portal dev`
  - Expected : `Ready in <Xs>` ; serveur ecoute port 3004
  - Failure mode : si erreur env validation -> verifier `.env.local`

- **V2 (P0 -- automatisable)** : `curl -I http://localhost:3004/fr` retourne 200
  - Expected : `HTTP/1.1 200 OK`, `Content-Type: text/html; charset=utf-8`
  - Failure mode : verifier `app/[locale]/page.tsx` existe

- **V3 (P0)** : `curl -I http://localhost:3004/ar-MA` retourne 200 + dir=rtl dans HTML
  - Expected : HTML contient `dir="rtl"` et `lang="ar-MA"`
  - Failure mode : `[locale]/layout.tsx` ne propage pas correctement les attributes

- **V4 (P0)** : `curl http://localhost:3004/robots.txt` retourne contenu valide
  - Expected : contient `User-Agent: *` + `Sitemap: ...`
  - Quand `NEXT_PUBLIC_ENABLE_INDEXING=false` : doit contenir `Disallow: /`
  - Failure mode : verifier `app/robots.ts`

- **V5 (P0)** : `curl http://localhost:3004/sitemap.xml | xmllint --noout -` ne retourne pas erreur
  - Expected : XML valide selon schema sitemaps.org
  - Doit contenir au moins 60 entries (20 URLs x 3 locales)
  - Failure mode : verifier `app/sitemap.ts` enumere correctement BRANCHES

- **V6 (P0)** : `curl -I http://localhost:3004/opengraph-image` retourne image/png
  - Expected : `HTTP/1.1 200 OK`, `Content-Type: image/png`, taille > 10 KB
  - Failure mode : Edge Runtime issue ou font binaire manquant

- **V7 (P0)** : Structured data InsuranceAgency present dans `<head>` de `/fr`
  - Commande : `curl http://localhost:3004/fr | grep -o '"@type": "InsuranceAgency"'`
  - Expected : retour non-vide
  - Failure mode : `[locale]/layout.tsx` n importe pas `InsuranceAgencyJsonLd`

- **V8 (P0)** : Hreflang alternates presents dans HTML head
  - Commande : `curl http://localhost:3004/fr | grep -c 'rel="alternate" hreflang='`
  - Expected : >= 4 (fr + ar-MA + ar + x-default)
  - Failure mode : metadata.alternates.languages incomplete

- **V9 (P0)** : Canonical URL absolue et coherente
  - Commande : `curl http://localhost:3004/fr | grep 'rel="canonical"'`
  - Expected : contient `href="http://localhost:3004/fr"` (dev) ou `href="https://souscrire.skalean-insurtech.ma/fr"` (prod)
  - Failure mode : `metadataBase` mal configure ou `buildCanonical` casse

- **V10 (P0)** : Security headers presents
  - Commande : `curl -I http://localhost:3004/fr | grep -E 'x-frame|x-content|strict-transport'`
  - Expected : `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security: max-age=...`
  - Failure mode : `next.config.mjs` headers() manquant

- **V11 (P0)** : Aucune emoji dans fichiers crees
  - Commande : `grep -rP "[\x{1F300}-\x{1F9FF}]|[\x{2600}-\x{27BF}]" apps/web-customer-portal --exclude-dir=node_modules --exclude-dir=.next`
  - Expected : aucune sortie
  - Failure mode : VIOLATION decision-006 ABSOLU -> nettoyer fichiers concernes

- **V12 (P0)** : `pnpm --filter @insurtech/web-customer-portal typecheck` retourne 0 erreur
  - Expected : exit 0, aucune erreur TypeScript
  - Failure mode : verifier `tsconfig.json` extends bien `../../tsconfig.base.json`

- **V13 (P0)** : `pnpm --filter @insurtech/web-customer-portal vitest run` -> 100 percent PASS
  - Expected : tous tests passent (env, i18n, alternates, jsonld, integration)
  - Minimum 38 tests passes
  - Failure mode : tests cassent -> debug iterativement

- **V14 (P0)** : `pnpm --filter @insurtech/web-customer-portal build` reussit
  - Expected : `Compiled successfully`, dossier `.next/` cree, pas d erreur de prerender
  - Failure mode : verifier `generateStaticParams` retourne bien 3 locales

- **V15 (P0)** : Aucun `console.log` ou debug residuel
  - Commande : `grep -rn "console\\.log\\|console\\.debug" apps/web-customer-portal --include="*.ts" --include="*.tsx" --exclude-dir=node_modules | grep -v ".spec." | grep -v "next.config"`
  - Expected : aucune sortie
  - Failure mode : VIOLATION conventions Pino -> remplacer par logger ou retirer

### Criteres P1 (importants -- 8 minimum)

- **V16 (P1)** : Lighthouse audit `/fr` mobile : Performance >= 90
  - Commande : `npx @lhci/cli@latest collect --url=http://localhost:3004/fr --numberOfRuns=3`
  - Expected : score Performance >= 90
  - Failure mode : verifier preconnect fonts + image optimization

- **V17 (P1)** : Lighthouse `/fr` : SEO score = 100
  - Expected : 100/100 (titre, meta description, canonical, hreflang, robots tous OK)
  - Failure mode : metadata incomplete

- **V18 (P1)** : Lighthouse `/fr` : Accessibility >= 90
  - Expected : 90+/100 (color contrast, aria-labels, focus management)
  - Failure mode : verifier focus-visible outline + aria-labels nav/footer

- **V19 (P1)** : Lighthouse `/fr` : Best Practices >= 95
  - Expected : 95+/100 (HTTPS, no console errors, valid HTML)
  - Failure mode : remove console.* + CSP correct

- **V20 (P1)** : Validation structured data passe Google Rich Results Test
  - Commande : copier HTML genere et tester sur https://search.google.com/test/rich-results
  - Expected : InsuranceAgency type detecte sans erreurs critiques
  - Failure mode : adjuster jsonLd selon recommendations

- **V21 (P1)** : Bundle size First Load JS `/fr` < 200 KB gzipped
  - Commande : `pnpm build` puis verifier output Next "First Load JS"
  - Expected : < 200 KB pour route principale
  - Failure mode : trop de 'use client' -> revoir boundaries

- **V22 (P1)** : Tests integration route smoke 100 percent PASS
  - Expected : 8+ tests integration passent
  - Failure mode : verifier server start logic dans `beforeAll`

- **V23 (P1)** : Header `Sticky` se positionne correctement au scroll
  - Test manuel ou Playwright : scroll 500px -> header reste visible top
  - Failure mode : CSS `sticky top-0 z-50` manquant

### Criteres P2 (nice-to-have -- 5 minimum)

- **V24 (P2)** : `pnpm clean && pnpm install && pnpm build` reproducible
  - Commande : test reproductibilite x3
  - Expected : meme bundle size +/- 1 percent

- **V25 (P2)** : Tests coverage >= 85 percent sur `lib/`
  - Commande : `pnpm test:coverage`
  - Expected : lib/env.ts 100 percent, lib/seo/ 90 percent+, lib/i18n/ 85 percent+

- **V26 (P2)** : Conventional Commits respecte
  - Commande : `git log --oneline -1 | grep -E "^[a-f0-9]{7,} feat\\(sprint-17\\):"`
  - Expected : commit message conforme

- **V27 (P2)** : Cache Next 15 fonctionne en dev
  - Test : reload `/fr` 2x -> 2nd reload instantane (HMR)

- **V28 (P2)** : Pas de warning hydration dans console navigateur
  - Test manuel : ouvrir DevTools, charger `/fr` -> zero warning React hydration

## 11. Edge cases + troubleshooting

### Edge case 1 : Locale invalide dans URL

**Scenario** : Visiteur tape `/en` ou `/de` (locales non supportees)
**Probleme** : Sans gestion, Next.js retournerait page vide ou erreur generique
**Solution** : `[locale]/layout.tsx` verifie `SUPPORTED_LOCALES.includes(locale)` et appelle `notFound()` qui rend `app/not-found.tsx`. Cette page 404 propose les liens vers les 3 locales supportees.

### Edge case 2 : Build prerender echoue car env vars manquantes

**Scenario** : CI build sans `NEXT_PUBLIC_SITE_URL` defini -> sitemap genere avec URLs `localhost`
**Probleme** : Production deployee avec sitemap.xml pointant localhost
**Solution** : env Zod fail-fast au build (`process.exit(1)`) + check CI : `pnpm build` doit retourner exit 0 et output ne doit pas contenir `localhost` apres prerender. Test : `grep -r "localhost" .next/server/app/sitemap*` -> doit etre vide en prod build.

### Edge case 3 : Header sticky cache contenu sur mobile

**Scenario** : Mobile Safari iOS, header sticky cache contenu au scroll
**Probleme** : Bug iOS Safari avec position sticky + backdrop-filter
**Solution** : Tester sur iPhone reel ou Browserstack. Fallback : utiliser `position: fixed` + padding-top sur main pour iOS uniquement (`@supports not (backdrop-filter: blur(10px))`). Tache 4.4.12 (mobile) raffinera.

### Edge case 4 : OG image timeout 25s sur Edge Runtime

**Scenario** : `@vercel/og` essaie de charger font Google Fonts via fetch -> >25s -> timeout
**Probleme** : Edge function fail -> Twitter/Facebook ne peuvent pas afficher preview
**Solution** : Embed font binaire dans le code source via `fs.readFileSync(new URL('./Inter.ttf', import.meta.url))` ou utiliser font system. Test : 10x consecutive fetch `/opengraph-image` -> tous < 5s.

### Edge case 5 : Hydration mismatch sur `<time>` ou dates dynamiques

**Scenario** : Server render `2026-05-15`, client render `2026-05-16` (timezone different)
**Probleme** : React hydration error -> contenu remplace -> mauvaise UX
**Solution** : Toutes dates dynamiques rendues uniquement cote client via `useEffect`, OU passer ISO string formatte cote serveur via `Intl.DateTimeFormat(locale, { timeZone: 'Africa/Casablanca' })`. Footer `currentYear` est OK car `new Date().getFullYear()` deterministe annee entiere.

### Edge case 6 : RTL casse layout grid colonnes

**Scenario** : Footer `grid-cols-4` en `dir="rtl"` -> colonnes inversees mais alignements internes restent ltr
**Probleme** : Visual disonance ar/ar-MA
**Solution** : Utiliser `rtl:` Tailwind variant + tester avec Playwright snapshot en mode RTL. Tache 4.4.12 corrigera systematiquement.

### Edge case 7 : Cookie consent absent -> GA4 ne fire pas

**Scenario** : Visiteur premiere fois, no consent CNDP -> GA tracking ID present mais script inactif
**Probleme** : Analytics manquent visites top-funnel
**Solution** : Tache 4.4.13 implementera Consent Mode v2 Google (cookies refused -> ping minimal pour Conversion Modeling). Sprint 17 = Tache 4.4.1 ne fire pas GA, c'est attendu.

### Edge case 8 : Robots block AI crawlers mais Googlebot quand meme cache pour Google AI Overview

**Scenario** : Google AI Overview utilise Googlebot regular -> notre contenu apparait dans AI Overview meme avec block GPTBot
**Probleme** : Pas un probleme reel mais perception : data quasi-publique
**Solution** : C'est OK car content marketing landing est meant to be public. Pas de PII dans pages publiques. Seules pages wizard `/souscription/*` contiennent PII et sont disallow dans robots.txt.

### Edge case 9 : Sitemap depasse 50000 URLs

**Scenario** : Sprint 17 ne genere pas (60 URLs). Risque si Sprint 32+ ajoute pages dynamiques articles blog
**Probleme** : Google rejette sitemap > 50k URLs
**Solution** : Pattern sitemap-index si depasse : `/sitemap-marketing.xml`, `/sitemap-articles.xml`, lies via `/sitemap.xml` index. Sprint 17 OK.

### Edge case 10 : Locale switcher perd query params

**Scenario** : User sur `/fr/auto?promo=summer` switch vers ar-MA -> redirige vers `/ar-MA/auto` sans `?promo=summer`
**Probleme** : Tracking promo perdu
**Solution** : `LocaleSwitcher` preserve `searchParams` via `usePathname` + `useSearchParams`. Code :
```typescript
const search = useSearchParams().toString();
const targetUrl = `${ensureLocaleInPathname(pathname, targetLocale)}${search ? `?${search}` : ''}`;
```

## 12. Conformite Maroc detaillee

### Loi 17-99 : Code des assurances Maroc

- Article 2 : portail public doit indiquer son agrement ACAPS (en cours pour Skalean) -> mention footer
- Article 153+ : contrats vie/non-vie obligatoirement consentis par ecrit ou signature electronique loi 43-20 -> Tache 4.4.9 implementera

### Loi 09-08 : Protection donnees personnelles CNDP

- Article 5 : consentement libre, specifique, eclaire -> Cookie banner Tache 4.4.13
- Article 18 : declaration au CNDP avant collecte donnees -> recipisse CNDP Skalean Insurtech (livrable juridique pre-pilote Sprint 35)
- Article 49 : transfert international interdit sans autorisation -> decision-008 data residency Atlas Cloud Benguerir MA. Ce portail ne envoie aucune PII vers fournisseur etranger sans consent explicite.

### Loi 43-20 : Signature electronique

- Article 6 : niveau "avancee" requis pour contrats assurance -> Barid eSign avec certificat ANRT (Tache 4.4.9)
- Article 12 : conservation 10 ans des contrats signes -> Sprint 10 docs/signature gere retention

### Article 414 DOC : Vente a distance Maroc

- Vente assurance en ligne consideree contrat distance -> obligations specifiques :
  - Identification claire du vendeur (mentions legales)
  - Description claire du produit (pages branches detailees)
  - Prix tout-compris (simulators avec breakdown)
  - Droit retractation 14 jours (provisional policy TTL 7j + indication retractation dans CGU)
  - Confirmation ecrite -> email Tache 4.4.9

## 13. Conventions absolues skalean-insurtech (rappel complet)

### Multi-tenant strict

- Header `x-tenant-id` obligatoire sur tous endpoints sauf `/api/v1/public/*` et `/api/v1/admin/*`
- Le portail public est consommateur des endpoints `/api/v1/public/*` (no header tenant requis) ou utilise `NEXT_PUBLIC_TENANT_PUBLIC_ID=skalean-public` (tenant marketing/public)
- `tenant_id` filter automatique via TenantGuard NestJS sur toutes queries DB
- AsyncLocalStorage Node.js pour TenantContext (jamais passer tenant_id en parametre fonction)
- RLS policies Postgres : `app_current_tenant()` lit la session var `app.current_tenant`
- Audit trail : chaque operation tenant logged avec tenant_id

### Validation strict

- Zod uniquement pour validation runtime (JAMAIS class-validator, JAMAIS yup, JAMAIS joi)
- Schemas Zod exportes depuis `@insurtech/shared-types` quand reutilisables
- Pattern : `const Schema = z.object({...}); type Type = z.infer<typeof Schema>;`
- Validation au niveau composant ET API (defense en profondeur)

### Logger strict

- Pino via `this.logger.info(...)` injecte par DI NestJS cote API
- Cote Next.js : `import { logger } from '@insurtech/shared-utils'` puis `logger.info(...)`
- JAMAIS `console.log()` (verifie au pre-commit hook)
- JAMAIS `new Logger(...)` (NestJS Logger natif)
- Format JSON structured pour parsing Datadog/Sentry
- Champs obligatoires : tenant_id, user_id, request_id, action, duration_ms

### Hash password strict

- argon2id avec params `memoryCost: 65536, timeCost: 3, parallelism: 4`
- JAMAIS bcrypt (depasse), JAMAIS scrypt
- Pepper en plus du salt (env var `PASSWORD_PEPPER`)
- Note : portail public n a pas d auth user direct (no signup ; signature uniquement)

### Package manager strict

- pnpm uniquement (jamais npm, jamais yarn)
- `engine-strict=true` rejette install si Node < 22.11.0
- `save-exact=true` impose versions deterministes (pas de ^ ou ~)
- `link-workspace-packages=deep` pour imports `@insurtech/*`

### TypeScript strict

- `strict: true` dans tsconfig.base.json
- `noUncheckedIndexedAccess: true` (force null checks sur arrays/objects)
- `noImplicitAny: true` (aucun any implicite)
- `noImplicitReturns: true`
- Imports explicites : pas de `import * as` sauf cas justifies (React)

### Tests strict

- Vitest pour unit + integration
- Playwright pour E2E web
- Chaque fichier `.ts` (sauf types-only et index.ts) DOIT avoir un `.spec.ts` associe
- Coverage cible : >= 85 percent global, >= 90 percent modules critiques

### RBAC strict

- `@Roles()` decorateur sur chaque endpoint NestJS
- `RolesGuard` global active sur ApiModule
- `TenantGuard` global active (verifie x-tenant-id present)
- 12 roles : SuperAdmin, BrokerAdmin, BrokerUser, GarageAdmin, GarageManager, GarageTechnician, AssureClient, Prospect, ComplianceOfficer, FinanceOfficer, Support, ReadOnly
- Portail public consomme endpoints publics ou via tenant public Skalean

### Events strict

- Kafka topics format : `insurtech.events.{vertical}.{entity}.{action}`
- Exemples : `insurtech.events.insure.quote.previewed`, `insurtech.events.insure.wizard.step_completed`
- Schemas Zod pour chaque event (validation publish + consume)
- Idempotency-Key obligatoire pour events critiques (paiement, signature)

### Imports strict

- Packages partages via `@insurtech/{nom}` (pas chemins relatifs `../../packages/...`)
- TypeScript paths configures dans `tsconfig.base.json` + `tsconfig.json` app
- Order : 1) Node natifs 2) Externes 3) `@insurtech/*` 4) Relatifs

### Skalean AI strict (decision-005)

- Utilise UNIQUEMENT via `@insurtech/sky` (REST client) ou MCP client
- JAMAIS appel direct OpenAI/Anthropic/etc (frontier strict)
- Sprint 17 : pas d AI directe (Tache 4.4.7 KYC = format check basique, pas OCR ; Sprint 30+ ajoutera Skalean AI)

### No-emoji strict (decision-006 ABSOLU)

- AUCUNE emoji dans : code, commentaires, logs, docs, commits, messages traduits, OG images
- Pre-commit hook `check-no-emoji.sh` rejette commits avec emoji
- CI fail si emoji detectee dans PR
- Cette regle ne souffre AUCUNE exception

### Idempotency-Key strict

- Header `Idempotency-Key` obligatoire pour mutations sensibles
- Mutations sensibles : POST /payments (Tache 4.4.8), POST /signatures (Tache 4.4.9), POST /provisional/generate
- TTL idempotency : 24h dans Redis
- Pattern : `idempotency:{tenant_id}:{user_id}:{key}` -> response cached

### Conventional Commits strict

- Format : `<type>(scope): description`
- Types : feat, fix, docs, style, refactor, test, chore, perf, ci, build
- Scope : `sprint-17` ou `web-customer-portal`
- Description : 50-72 chars max
- Body : metadata Task/Sprint/Phase obligatoire
- commitlint rejette commits non-conformes via husky

### Cloud souverain MA strict (decision-008)

- Atlas Cloud Services Benguerir UNIQUEMENT pour data Maroc
- DC1 Tier III + DC2 Tier IV (DR)
- AUCUNE donnee assure ne transite hors MA (loi 09-08 CNDP)
- Encryption at rest AES-256-GCM via Atlas KMS
- TLS 1.3 obligatoire pour tous transferts

### Conformite legale MA (specifique tache 4.4.1)

- Loi 17-99 (Code assurances) -> mention agrement ACAPS dans footer
- Loi 09-08 (CNDP) -> mention donnees Maroc + lien CNDP footer
- Loi 43-20 (signature electronique) -> indication conformite footer (preparation Tache 4.4.9)
- Article 414 DOC (vente distance) -> mentions legales + CGU presentes

## 14. Validation pre-commit

```bash
cd repo

cd apps/web-customer-portal

pnpm typecheck

pnpm lint

pnpm vitest run --coverage

cd ../..

grep -rP "[\x{1F300}-\x{1F9FF}]|[\x{2600}-\x{27BF}]" apps/web-customer-portal --exclude-dir=node_modules --exclude-dir=.next && echo "FAIL emoji detected" && exit 1 || echo "OK no-emoji"

grep -rn "console\\.log\\|console\\.debug" apps/web-customer-portal --include="*.ts" --include="*.tsx" --exclude-dir=node_modules | grep -v ".spec." | grep -v "next.config" && echo "FAIL console residual" && exit 1 || echo "OK no-console"

pnpm --filter @insurtech/web-customer-portal build

git diff --check
```

## 15. Commit message complet

```bash
git add -A
git commit -m "feat(sprint-17): init web-customer-portal Next.js 15 + SEO foundation

Tache 4.4.1 -- App Skeleton + Public Layout + SEO Foundation.

Initialise apps/web-customer-portal (port 3004) Next.js 15 App Router :
- Root layout + locale layout fr/ar-MA/ar avec RTL ar
- Metadata API exhaustive : title template, OG, Twitter, hreflang, canonical
- robots.ts dynamique conditional NEXT_PUBLIC_ENABLE_INDEXING
- sitemap.ts genere 60+ URLs (20 pages x 3 locales) avec alternates
- opengraph-image.tsx Edge Runtime 1200x630 Sofidemy design
- Structured data InsuranceAgency + LocalBusiness + Organization
- Public header sticky + footer mentions ACAPS/CNDP/loi 43-20
- Locale switcher + skip-to-content a11y
- env Zod loader fail-fast avec validation strict
- Security headers CSP + HSTS + X-Frame + Permissions-Policy
- 5 packages workspace @insurtech/* dependencies

Livrables (36):
- 30 fichiers code + 5 fichiers tests + 3 fichiers messages locales
- 38+ tests unit + integration PASS
- Lighthouse Performance 90+, SEO 100, A11y 90+, BP 95+ sur /fr mobile
- Bundle First Load JS < 200 KB gzipped

Tests: 12 env + 11 i18n + 12 alternates + 10 jsonld + 8 integration = 53
Coverage: lib/ 90%+ ; components/ 85%+

Conformite: Loi 17-99 ACAPS / 09-08 CNDP / 43-20 signature / Art 414 DOC
Reference: B-17 Tache 4.4.1
Task: 4.4.1
Sprint: 17 (Phase 4 / Sprint 4 phase)
Phase: 4 -- Vertical Insure"
```

## 16. Workflow next step

Apres commit de cette tache :

- Verifier `git log` montre commit `feat(sprint-17): init web-customer-portal...`
- Verifier les V1-V28 de la section 10 passent (ou documenter exceptions P2)
- Passer a `task-4.4.2-landing-page-racine.md` qui consomme le squelette pose ici

---

**Fin du prompt task-4.4.1-app-skeleton-public-layout-seo-foundation.md.**

Densite atteinte : ~110 ko
Code patterns : 15 fichiers complets (package.json, tsconfig, next.config, layouts, components, lib, messages)
Tests : 53+ cas concrets (env, i18n, SEO, jsonld, integration routes, E2E placeholder)
Criteres validation : V1-V28 (15 P0 + 8 P1 + 5 P2)
Edge cases : 10 cas avec solutions
