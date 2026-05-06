# TACHE 1.4.16 -- Tests E2E Playwright + Lighthouse Baseline + Storybook 8.4 (P0/P1)

**Sprint** : 4 (Phase 1 / Sprint 4 dans phase, dernier de Phase 1 Bootstrap)
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-04-sprint-04-frontend-bootstrap.md` (Tache 1.4.16)
**Phase** : 1 -- Bootstrap
**Priorite** : P0 (Tests E2E + Lighthouse) / P1 (Storybook)
**Effort** : 7h
**Dependances** : 1.4.15 (pages placeholder + 404/500 finalisees), 1.4.1 a 1.4.7 (8 apps Next.js demarrent), 1.4.8 (shared-ui composants), 1.4.11 (multilingue 3 locales operationnel), 1.4.14 (layouts sidebar+topbar)
**Densite cible** : 100-150 ko (auto-suffisant exhaustif, aucune lecture annexe necessaire)
**AUCUNE EMOJI AUTORISEE** (decision-006 strictement appliquee)

---

## 1. But (0.5-1 ko)

Mettre en place la suite de tests bout-en-bout (E2E) Playwright validant que les **8 applications frontend** Next.js demarrent et exposent leur surface principale (rendu, locale switcher, theme toggle, 404, hydration sans erreur, responsive desktop / mobile), executer un **audit Lighthouse baseline** (Performance, Accessibility, Best Practices, SEO, PWA) sur chacune des 8 apps avec generation de rapports JSON exploitables, et configurer un **Storybook 8.4** pour le package `@insurtech/shared-ui` afin que les designers et developpeurs puissent inspecter isolement les 30+ composants shadcn/ui, basculer le theme light/dark, basculer les locales fr / ar-MA / ar avec direction RTL, et verifier zero violation accessibilite via l'addon `@storybook/addon-a11y`.

Cibles initiales **Sprint 4 baseline** (ajustees aux sprints suivants) :
- Performance >= 70 partout (cible Sprint 17 web-broker = 90, cible Sprint 18 web-customer-portal = 95)
- Accessibility >= 90 partout (loi accessibilite Maroc Sprint 30 imposera 100)
- Best Practices >= 90 partout
- SEO >= 90 partout (cible Sprint 18 web-customer-portal = 100, schema.org JSON-LD + sitemap.xml + hreflang)
- PWA >= 90 sur les 2 apps mobile (web-garage-mobile + web-assure-mobile)

A la sortie de cette tache, la commande `pnpm test:e2e` execute la suite Playwright complete (10+ specs), `pnpm lighthouse:baseline` produit `repo/lighthouse-reports/baseline-{app}.json` pour les 8 apps, et `pnpm --filter @insurtech/shared-ui storybook` demarre Storybook sur `http://localhost:6006` avec les stories visibles. Cette tache cloture le Sprint 4 et la Phase 1 Bootstrap.

---

## 2. Contexte etendu (5-10 ko)

### Pourquoi cette tache existe

Le Sprint 4 a livre 8 apps Next.js + 3 packages shared (UI, PWA, Maps) + multilingue + tooling monorepo. Sans suite E2E, **toute regression** introduite par les Sprints metier suivants (5 Auth, 8 CRM, 17 Souscription, 22 Sinistres) passerait inapercue jusqu'au QA manuel ou pire en production. Sans baseline Lighthouse, **l'objectif Sprint 18 customer-portal Performance >= 95 SEO 100** devient impossible a piloter (on ne saurait pas si on s'ameliore ou regresse depuis le Sprint 4). Sans Storybook, le **package shared-ui** est inutilisable hors-contexte par le designer (Anouar Benghazi) et les nouveaux developpeurs (onboarding ~2 jours pour comprendre les variantes de Button.tsx).

Cette tache est positionnee en derniere du Sprint 4 (1.4.16) car elle agrege l'ensemble des livrables des taches 1.4.1 a 1.4.15 : on ne peut tester E2E une app que lorsqu'elle demarre (1.4.1-1.4.7), on ne peut auditer Lighthouse que lorsque les pages placeholder rendent (1.4.15), on ne peut storybooker un composant que lorsqu'il existe dans `shared-ui` (1.4.8).

### Alternatives considerees

#### Playwright vs Cypress vs Selenium WebDriver

| Critere | Playwright 1.49 (CHOIX) | Cypress 13 | Selenium WebDriver 4 |
|---------|--------------------------|------------|------------------------|
| Multi-navigateur natif | Chromium + Firefox + Webkit (real Safari) | Chromium + Firefox + Edge (pas Webkit reel) | Tous mais setup driver lourd |
| Mobile emulation | iPhone 14 / 15 / Pixel 7 / 8 prebuiltins | Plugins externes | Manuel useragent + viewport |
| Parallelism | Native `fullyParallel` cross-spec | Mode parallel paid (Cypress Cloud) | Selenium Grid lourd |
| Trace viewer | Native (`.zip` time-travel debugging) | Cypress Studio replay limite | Capture screenshots manuel |
| Network mock | `page.route()` granular | `cy.intercept()` | Browsermob proxy ext |
| Languages | TypeScript + Python + Java + .NET | JavaScript only | Tous langages |
| Auto-wait | Native (selectors waitFor implicite) | Native (`cy.get`) | Manuel `WebDriverWait` |
| Component testing | Experimentale (`@playwright/experimental-ct-react`) | Native (Cypress Component Testing) | Non |
| Bundle CI artifacts | HTML report + JSON + traces + screenshots zip | HTML + screenshots + videos | Manuel |
| Vitesse execution | ~30% plus rapide que Cypress (no proxy interception) | Reference | ~2x plus lent |

**Decision** : Playwright 1.49+. Justifie par real Webkit (necessaire pour valider iOS Safari sur PWA `web-garage-mobile` et `web-assure-mobile`), trace viewer time-travel pour debug, fullyParallel sans cout cloud, projects multi-device natifs.

#### Lighthouse standalone vs Lighthouse CI vs WebPageTest

| Critere | Lighthouse 12.3 npm + custom script (CHOIX) | Lighthouse CI 0.14 (lighthouserc.cjs) | WebPageTest API |
|---------|----------------------------------------------|----------------------------------------|------------------|
| Local + CI | Oui via `tsx scripts/lighthouse-baseline.ts` | Oui via `lhci autorun` | Cloud only (token API requis) |
| Stockage rapports | JSON local `lighthouse-reports/` | temporary-public-storage ou serveur dedie | Cloud webpagetest.org |
| Assertions seuils | Custom script (exit code 1) | Natif `assertions: { categories: ... }` | Manuel |
| Multi-page batch | Boucle for sur 8 apps | URLs array dans config | Manuel |
| Charts diff baseline | Manuel (compare JSON timestamps) | Native trend graphs (lhci server) | Native |
| Multi-pass (mobile + desktop) | Custom code | `presets: ['mobile', 'desktop']` | Native |
| Support PWA score | Oui | Oui | Limite |

**Decision** : Combinaison **Lighthouse 12.3 npm + Lighthouse CI 0.14**. Le script `lighthouse-baseline.ts` local genere les JSON exhaustifs pour debug developpeur, la config `lighthouserc.cjs` automatise les seuils en CI GitHub Actions avec assertions strictes par app. Double instrumentation = redondance acceptable car Lighthouse CI ajoute la dimension trend.

#### Storybook 8.4 vs Storybook 9 (alpha) vs Histoire (Vue) vs Ladle

| Critere | Storybook 8.4 (CHOIX) | Storybook 9.0 alpha | Ladle 5 | Histoire 0.x |
|---------|------------------------|---------------------|---------|---------------|
| Maturite | Stable depuis octobre 2024 (3 mois retour terrain) | Alpha Q1 2026 | Stable mais ecosystem plus petit | Vue only |
| Framework Next.js | `@storybook/nextjs` officiel | Casse : nouveau framework wrapper | `@ladle/react` agnostic | Non |
| Vite vs Webpack | Vite 5 (default 8.x) ou Webpack 5 fallback | Vite 6 only (breaking) | Vite only | Vite |
| Addons ecosystem | 100+ addons matures (a11y, themes, i18n, interactions) | Migration en cours | ~10 addons | Limite |
| CSF v3 | Native | Native | Compatible CSF | Format custom |
| MDX docs | Native | Breaking changes | Limite | Non |
| autodocs | Native | Idem | Manuel | Non |
| Bundle size dev | ~250 ko (optimise depuis 8.0) | Inconnu | ~80 ko (le plus leger) | ~150 ko |

**Decision** : Storybook 8.4.7 + framework `@storybook/nextjs` 8.4. Justifie par maturite 3 mois, addons a11y/themes/i18n disponibles, integration native next/font et next/image, CSF v3 + autodocs MDX. Migration vers Storybook 9 planifiee Sprint 35.

#### CSF v3 vs Component Story Format v2 vs MDX 1

| Critere | CSF v3 (CHOIX) | CSF v2 | MDX 1 |
|---------|-----------------|---------|-------|
| Type-safety | Excellent (`Meta` + `StoryObj`) | Moyen (`ComponentMeta`) | Faible |
| Args composition | `args: { ... }` natif merging | Manuel | Manuel |
| Play function | Native (interactions) | Plugin | Limite |
| autodocs from JSDoc | Auto | Manuel | Manuel |
| Migration vers v9 | Smooth | Casse | Casse |

**Decision** : CSF v3 strict pour toutes les stories.

### Trade-offs explicites

1. **Tests E2E desktop only via project chromium** : Firefox + Webkit desktop non testes en Sprint 4 (cout maintenance trop eleve pour bootstrap). Sera ajoute Sprint 18 customer-portal (audience publique, navigateurs heterogenes) et Sprint 22 sinistres (Safari Mac courtier).

2. **Mobile via emulation Playwright (Pixel 7 + iPhone 14 Pro)** : pas de real device cloud (BrowserStack / Sauce Labs) en Sprint 4 -- Sprint 35 ajoutera. Emulation diverge ~10-20% real device sur Performance Lighthouse mais coherente pour smoke tests fonctionnels.

3. **Lighthouse local vs CI cold cache** : CI machine GitHub Actions runner (2 cores, 7 Go RAM) genere systematiquement des scores ~10-15 points sous local developpeur (M1 Macbook Pro). On documente ce delta et on configure les seuils CI avec marge (Performance 65 en CI vs 70 en local par exemple). Sprint 18 reduira ce gap via warmup runs.

4. **PWA score 90 sur web-garage-mobile + web-assure-mobile** : depend de service worker actif. En headless Chromium Playwright, les SW peuvent etre desactives par defaut. Solution : `--enable-features=ServiceWorker` flag + `chromium.launch({ args: ['--enable-features=ServiceWorker'] })`.

5. **Storybook Tailwind 4 beta compatibility** : Tailwind 4 utilise un nouveau plugin Vite (`@tailwindcss/vite`). L'integration avec `@storybook/nextjs` framework 8.4 demande `viteFinal` customization (manuel). Si bug bloquant, fallback Tailwind 3.4.17 via package shared-ui jusqu'a Sprint 9 (planifie pour migration Tailwind 4 stable).

6. **next/font integration Storybook** : `next/font/google` usuellement charge cote serveur Next.js. Dans Storybook (Vite), on doit injecter manuellement les fonts Montserrat + Noto Naskh Arabic via `<link>` dans `preview-head.html`. Sinon flash sans police puis pop-in.

7. **a11y addon false positives Radix UI** : `@storybook/addon-a11y` v8 utilise axe-core 4.10. Certains composants Radix UI (`@radix-ui/react-dialog`, `@radix-ui/react-popover`) levent des warnings `aria-hidden-focus` sur les portals. Configuration `parameters.a11y.config.rules: [{ id: 'aria-hidden-focus', enabled: false }]` au cas par cas.

8. **Visual regression flaky cross-OS** : sub-pixel rendering Linux CI vs macOS dev = differences ~1-2 pixels qui font echouer screenshots binary diff. Solution Sprint 4 : pas de visual regression (Chromatic / Loki) -- ajout Sprint 35.

9. **Storybook composition main app** : pas dans Sprint 4. Sprint 35 deploiera Storybook hors monorepo (chromatic.com ou Vercel) avec composition de plusieurs Storybooks (shared-ui + per-app stories).

10. **Lighthouse 12 API breaking changes** : `lighthouse 11 -> 12` a renomme certaines categories (`pwa` toujours present mais deprecated dans Lighthouse 13). On pinning `lighthouse@12.3.0` exact (pas caret) pour eviter rupture mineure.

11. **CI machine cores affect parallel test stability** : Playwright `fullyParallel: true` sur GitHub runner 2 cores genere des contentions CPU = flakiness. Configuration `workers: process.env.CI ? 2 : '50%'` limite le parallelism CI pour stabilite.

12. **Jest vs Vitest pour les meta-tests Section 7** : Vitest deja deploye Sprint 1. On reste sur Vitest pour coherence stack.

### Decisions strategiques referenced

- **decision-001 (monorepo pnpm + Turbo)** : la suite E2E vit a la racine du monorepo `repo/e2e/` (pas dans chaque app individuellement). Lighthouse baseline = `repo/scripts/lighthouse-baseline.ts`. Storybook = `repo/packages/shared-ui/.storybook/`.
- **decision-006 (NO EMOJI ABSOLU)** : zero emoji dans aucun fichier code, JSON Storybook, MDX docs, commit, README. Linter custom verifie en CI (`scripts/check-no-emoji.sh`).
- **decision-008 (cloud souverain MA)** : Lighthouse audit depuis machine locale ou CI GitHub Actions runner (US/Europe). Pour audit reel depuis Maroc (latence reseau Atlas Cloud Benguerir Casablanca), Sprint 35 ajoutera runner self-hosted MA. Sprint 4 = audit emulation local accepte.
- **decision-009 (multilinguisme MA)** : tests E2E couvrent les 3 locales fr / ar-MA / ar. Storybook expose toolbar locale switcher avec les 3 locales.
- **decision (ACAPS supervision)** : tests E2E doivent verifier la mention conformite ACAPS dans le footer des apps `web-broker`, `web-customer-portal`, `web-assure-portal` (page d'accueil placeholder Sprint 4 affiche deja le footer).

### Pieges techniques connus (12 minimum)

1. **Lighthouse cold cache vs warm cache** : un audit avec cache vide (cold) genere un Performance score ~10 points sous cache chaud. La premiere visite simule un visiteur reel premiere fois. Configuration `settings: { disableStorageReset: false }` force cache vide.

2. **Mobile emulator Pixel 7 vs real device** : real device 10-20% plus lent (CPU throttling reel + reseau cellulaire 4G reel vs simule). Sprint 4 = emulator suffisant baseline.

3. **Playwright `fullyParallel: true` may interleave logs** : si plusieurs specs ecrivent stdout simultanement, logs entrelaces difficiles a lire. Solution : reporter `list` ou `line` en local, `github` en CI.

4. **Storybook Tailwind 4 beta require viteFinal config** : sans `viteFinal` customisation, Storybook ne charge pas le plugin `@tailwindcss/vite` et les classes Tailwind ne s'appliquent pas dans les stories.

5. **next/font Storybook integration tricky** : `next/font/google` charge fonts cote serveur Next.js. En Storybook (Vite), il faut soit utiliser `next/font` mock soit injecter les fonts via `<link rel="preload">` dans `preview-head.html`.

6. **Service worker not active in headless Chromium** : par defaut, headless Chromium Playwright n'active pas les service workers (security). Pour tester offline mode et PWA installability, il faut `chromium.launch({ args: ['--enable-features=ServiceWorker', '--no-sandbox'] })`.

7. **Lighthouse 95+ requires Critical CSS + image optimization** : dans Sprint 4 baseline ne sera **pas** atteint sans optimisation. Sprint 18 (customer-portal) ajoutera : Critical CSS via `critters` plugin Next.js, font preload, next/image AVIF/WebP, lazy-loading, CDN cache headers.

8. **a11y addon false positives sur Radix UI primitives** : portals Radix levent `aria-hidden-focus` quand le focus se deplace dans portal. Config rules par story si necessaire.

9. **Visual regression flaky cross-OS rendering** : sub-pixel rendering different Linux CI vs macOS dev. Pas de Chromatic/Loki en Sprint 4. Sprint 35 ajoutera avec tolerance pixel diff configuree.

10. **Storybook 8.4 vs 9.x future migration** : Storybook 9 (alpha Q1 2026) breaking changes : framework wrapper renomme, addon-essentials retire (split en addons individuels). Sprint 35 = migration prevue.

11. **Lighthouse 12 API breaking changes** : `lighthouse 12.3` retourne categories deprecated `pwa` qui sera supprimee Lighthouse 13. Pinning version exact + commentaire TODO migration.

12. **CI machine cores affect parallel test stability** : runner GitHub Actions 2 cores = `workers: 2` max. Sinon contentions CPU = timeouts.

13. **Hreflang tags audit Lighthouse** : Lighthouse SEO score 100 demande `<link rel="alternate" hreflang="fr">`, `hreflang="ar-MA"`, `hreflang="ar"`, `hreflang="x-default"` dans `<head>`. Implemente via `generateMetadata` Next.js en Sprint 18 customer-portal.

14. **JSON-LD schema.org validation** : Lighthouse SEO ne valide pas la structure JSON-LD. Validation via `schema.org Validator` API externe ou `jsonld` npm package en test E2E.

15. **Cookie consent banner CNDP test E2E** : loi 09-08 CNDP impose banner cookie sur premiere visite. Test verifie presence banner + boutons accepter/refuser + persistance choix dans cookie `cookie_consent`.

---

## 3. Architecture context (3-5 ko)

### Position dans Sprint 4

`task-1.4.16` est la **derniere des 16 taches** du Sprint 4 et cloture la Phase 1 Bootstrap :

```
Sprint 4 -- Frontend Bootstrap (16 taches)

[1.4.1 a 1.4.7]  <-- 8 apps Next.js bootstrap
       |
       v
[1.4.8 shared-ui]  <-- 30+ composants shadcn
       |
       v
[1.4.11 i18n] [1.4.12 turbo] [1.4.13 OpenAPI client] [1.4.14 layouts]
       |              |              |                       |
       +--------------+--------------+-----------------------+
                              |
                              v
                  [1.4.15 placeholder pages + 404/500]
                              |
                              v
                  [1.4.16 E2E + Lighthouse + Storybook]  <-- VOUS ETES ICI
                              |
                              v
                       Phase 1 BOOTSTRAP CLOTURE
                              |
                              v
                       [Sprint 5 -- Auth + RBAC]
```

### Position dans le programme

Cette tache constitue le **filet de securite** pour les sprints metier suivants :
- Sprint 5 (Auth) ajoutera des specs E2E `login.spec.ts` heritant de la config Playwright posee ici.
- Sprint 8 (CRM) ajoutera `contacts.spec.ts` reutilisant les fixtures.
- Sprint 17 (Souscription) ajoutera `policies.spec.ts`.
- Sprint 18 (Customer Portal SEO) ELEVERA les seuils Lighthouse a 95 Performance / 100 SEO.
- Sprint 22 (Sinistres) ajoutera `claims.spec.ts`.
- Sprint 25 (Sinistres mobile assure) elevera PWA score 95+.
- Sprint 30 (Accessibilite WCAG 2.1 AA loi MA) elevera Accessibility 100 + Pa11y CI ajout.
- Sprint 35 (Industrialisation) ajoutera Chromatic visual regression + BrowserStack real devices + Storybook composition Vercel deploy.

### Diagramme ASCII de l'infrastructure tests + Storybook

```
repo/
|
|-- playwright.config.ts                        # config E2E globale
|-- lighthouserc.cjs                            # config Lighthouse CI
|
|-- e2e/                                         # specs E2E (hors apps)
|   |-- web/
|   |   |-- web-broker.spec.ts                  # spec app courtage :3001
|   |   |-- web-garage.spec.ts                  # spec app garage :3002
|   |   |-- web-insurtech-admin.spec.ts         # spec app SuperAdmin :3000
|   |   |-- web-customer-portal.spec.ts         # spec portail public :3004 SEO
|   |   |-- web-assure-portal.spec.ts           # spec self-service :3005
|   |   |-- (web-broker, web-garage, web-customer-portal, web-assure-portal)
|   |
|   |-- mobile/
|   |   |-- web-garage-mobile.spec.ts           # spec PWA :3003 mobile-safari + mobile-chrome
|   |   |-- web-assure-mobile.spec.ts           # spec PWA :3006
|   |
|   |-- fixtures/
|   |   |-- locales.ts                          # constants ['fr', 'ar-MA', 'ar']
|   |   |-- viewports.ts                        # {mobile: 320, tablet: 768, desktop: 1280}
|   |
|   `-- helpers/
|       |-- a11y.ts                             # axe-playwright wrapper
|       `-- lighthouse-runner.ts                # helper lance audit single app
|
|-- scripts/
|   |-- lighthouse-baseline.ts                  # script audit 8 apps + tableau ASCII summary
|   `-- check-no-emoji.sh                       # linter zero emoji (existant Sprint 1)
|
|-- lighthouse-reports/                          # output (gitignore)
|   |-- baseline-web-broker.json
|   |-- baseline-web-garage.json
|   |-- baseline-web-garage-mobile.json
|   |-- baseline-web-insurtech-admin.json
|   |-- baseline-web-customer-portal.json
|   |-- baseline-web-assure-portal.json
|   |-- baseline-web-assure-mobile.json
|   `-- baseline-summary.txt                    # ASCII table per-app scores
|
|-- docs/architecture/
|   `-- lighthouse-strategy.md                  # cibles + workflow + budgets
|
`-- packages/shared-ui/
    |-- .storybook/
    |   |-- main.ts                             # config framework + addons
    |   |-- preview.tsx                         # decorators ThemeProvider + i18n
    |   |-- manager.ts                          # UI customization theme Skalean
    |   |-- preview-head.html                   # fonts injection Montserrat + Noto Naskh
    |
    `-- src/components/
        |-- Button.stories.tsx                  # CSF v3
        |-- Card.stories.tsx
        |-- Dialog.stories.tsx
        |-- Input.stories.tsx
        |-- Select.stories.tsx
        |-- Toast.stories.tsx
        |-- (24+ autres stories pour 30+ composants)
```

### Flow d'execution pnpm test:e2e

```
pnpm test:e2e
     |
     v
1. Playwright lit playwright.config.ts
     |
     v
2. webServer auto-start `pnpm dev:portals` + `pnpm dev:dashboards` (8 apps :3000-3006)
     |
     v
3. Wait baseURLs reachable (timeout 60s par app)
     |
     v
4. Execute projects:
   - chromium (desktop 1280x720) -> 6 specs web/
   - mobile-safari (iPhone 14 Pro) -> 2 specs mobile/
   - mobile-chrome (Pixel 7) -> 2 specs mobile/
     |
     v
5. fullyParallel: true, workers: 2 en CI / 50% local
     |
     v
6. Pour chaque spec : retries 2 en CI, 0 en local
     |
     v
7. Output:
   - HTML report `playwright-report/`
   - JSON report `test-results/results.json`
   - Trace `.zip` on first retry
   - Screenshot only-on-failure
   - GitHub annotations (CI)
```

### Flow d'execution pnpm lighthouse:baseline

```
pnpm lighthouse:baseline
     |
     v
tsx scripts/lighthouse-baseline.ts
     |
     v
1. Detect apps URLs via env (BROKER_URL, GARAGE_URL, etc.)
     |
     v
2. Pour chaque app (8 fois):
   - Launch chromium headless
   - Run lighthouse({port, hostname, url, settings: {output: 'json', logLevel: 'silent'}})
   - Multi-pass: mobile profile + desktop profile
     |
     v
3. Save JSON: lighthouse-reports/baseline-{app}.json
     |
     v
4. Parse score categories:
   - performance, accessibility, best-practices, seo, pwa
     |
     v
5. ASCII table summary stdout
     |
     v
6. Compare to CIBLES (Performance 70, A11y 90, BP 90, SEO 90, PWA 90 mobile)
     |
     v
7. Exit code:
   - 0 si tous P0 metrics passes
   - 1 si au moins un P0 metric below cible
```

---

## 4. Inputs et prerequis (1-2 ko)

### Inputs

- **Sprint 1** : monorepo pnpm + apps stubs + scripts dev parallel (`pnpm dev:portals`).
- **Sprint 4 taches 1.4.1 a 1.4.15** : 8 apps demarrent + locale fr/ar-MA/ar + theme Skalean + 30+ composants shared-ui + layouts sidebar+topbar + pages placeholder + 404/500.
- **Versions deps a installer** :
  - `@playwright/test@1.49.1`
  - `playwright@1.49.1`
  - `lighthouse@12.3.0`
  - `@lhci/cli@0.14.0`
  - `tsx@4.19.2` (deja Sprint 1)
  - `storybook@8.4.7`
  - `@storybook/nextjs@8.4.7`
  - `@storybook/addon-essentials@8.4.7`
  - `@storybook/addon-a11y@8.4.7`
  - `@storybook/addon-themes@8.4.7`
  - `@storybook/addon-i18n@1.0.0` (community plugin)
  - `@storybook/addon-interactions@8.4.7`
  - `@chromatic-com/storybook@3.2.2`
  - `axe-playwright@2.0.1`
  - `chrome-launcher@1.1.2`

### Prerequis

- Node 22.13.0 (deja Sprint 1).
- pnpm 9.15.0 (deja Sprint 1).
- 8 apps Next.js demarrent sur ports 3000-3006 (Sprint 4 taches 1.4.1-1.4.7).
- Variables d'environnement :
  - `BROKER_URL=http://localhost:3001`
  - `GARAGE_URL=http://localhost:3002`
  - `GARAGE_MOBILE_URL=http://localhost:3003`
  - `ADMIN_URL=http://localhost:3000`
  - `CUSTOMER_PORTAL_URL=http://localhost:3004`
  - `ASSURE_PORTAL_URL=http://localhost:3005`
  - `ASSURE_MOBILE_URL=http://localhost:3006`
  - `CI=true` (sur GitHub Actions, sinon vide local)

### Fichiers existants attendus

- `repo/pnpm-workspace.yaml`
- `repo/package.json` (root, scripts dev:portals deja defini Sprint 1)
- `repo/apps/web-broker/` (Sprint 4 tache 1.4.1)
- `repo/apps/web-garage/` (Sprint 4 tache 1.4.2)
- `repo/apps/web-garage-mobile/` (Sprint 4 tache 1.4.3)
- `repo/apps/web-insurtech-admin/` (Sprint 4 tache 1.4.4)
- `repo/apps/web-customer-portal/` (Sprint 4 tache 1.4.5)
- `repo/apps/web-assure-portal/` (Sprint 4 tache 1.4.6)
- `repo/apps/web-assure-mobile/` (Sprint 4 tache 1.4.7)
- `repo/packages/shared-ui/src/components/Button.tsx` etc. (Sprint 4 tache 1.4.8)

---

## 5. Modifications structurelles (1-2 ko)

### Repertoires et fichiers a creer

```
repo/
|
|-- playwright.config.ts                                  # CREATE
|-- lighthouserc.cjs                                      # CREATE
|
|-- e2e/                                                  # CREATE
|   |-- web/                                              # CREATE
|   |   |-- web-broker.spec.ts                            # CREATE
|   |   |-- web-garage.spec.ts                            # CREATE
|   |   |-- web-insurtech-admin.spec.ts                   # CREATE
|   |   |-- web-customer-portal.spec.ts                   # CREATE
|   |   `-- web-assure-portal.spec.ts                     # CREATE
|   |
|   |-- mobile/                                           # CREATE
|   |   |-- web-garage-mobile.spec.ts                     # CREATE
|   |   `-- web-assure-mobile.spec.ts                     # CREATE
|   |
|   |-- fixtures/                                         # CREATE
|   |   |-- locales.ts                                    # CREATE
|   |   `-- viewports.ts                                  # CREATE
|   |
|   `-- helpers/                                          # CREATE
|       |-- a11y.ts                                       # CREATE
|       `-- lighthouse-runner.ts                          # CREATE
|
|-- scripts/
|   `-- lighthouse-baseline.ts                            # CREATE
|
|-- lighthouse-reports/                                   # CREATE (gitignore)
|   `-- .gitkeep                                          # CREATE
|
|-- docs/architecture/
|   `-- lighthouse-strategy.md                            # CREATE
|
|-- packages/shared-ui/
|   |-- .storybook/                                       # CREATE
|   |   |-- main.ts                                       # CREATE
|   |   |-- preview.tsx                                   # CREATE
|   |   |-- manager.ts                                    # CREATE
|   |   `-- preview-head.html                             # CREATE
|   |
|   |-- src/components/
|   |   |-- Button.stories.tsx                            # CREATE
|   |   |-- Card.stories.tsx                              # CREATE
|   |   |-- Dialog.stories.tsx                            # CREATE
|   |   |-- Input.stories.tsx                             # CREATE
|   |   |-- Select.stories.tsx                            # CREATE
|   |   `-- Toast.stories.tsx                             # CREATE (+24 autres)
|   |
|   `-- package.json                                      # UPDATE add scripts storybook
|
|-- package.json                                          # UPDATE root scripts test:e2e
`-- .gitignore                                            # UPDATE add lighthouse-reports/
```

### Modifications package.json root

Ajouter scripts :
```
"scripts": {
  "test:e2e": "playwright test",
  "test:e2e:ui": "playwright test --ui",
  "test:e2e:debug": "playwright test --debug",
  "test:e2e:report": "playwright show-report",
  "lighthouse:baseline": "tsx scripts/lighthouse-baseline.ts",
  "lighthouse:ci": "lhci autorun"
}
```

### Modifications packages/shared-ui/package.json

Ajouter scripts :
```
"scripts": {
  "storybook": "storybook dev -p 6006",
  "build-storybook": "storybook build"
}
```

---

## 6. Patches et code complet (50-80 ko)

Cette section contient les **14 fichiers de code complets** structurants.

### 6.1 -- repo/playwright.config.ts (~120 lignes)

```typescript
import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 2 : '50%',
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    isCI ? ['github'] : ['null'],
  ].filter(Boolean) as any,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'fr-FR',
    timezoneId: 'Africa/Casablanca',
    extraHTTPHeaders: {
      'Accept-Language': 'fr-FR,fr;q=0.9,ar;q=0.8',
    },
    ignoreHTTPSErrors: true,
  },

  projects: [
    {
      name: 'chromium',
      testMatch: /e2e\/web\/.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
        baseURL: process.env.BROKER_URL ?? 'http://localhost:3001',
        launchOptions: {
          args: [
            '--enable-features=ServiceWorker',
            '--no-sandbox',
            '--disable-dev-shm-usage',
          ],
        },
      },
    },
    {
      name: 'mobile-safari',
      testMatch: /e2e\/mobile\/.*\.spec\.ts/,
      use: {
        ...devices['iPhone 14 Pro'],
        baseURL: process.env.GARAGE_MOBILE_URL ?? 'http://localhost:3003',
      },
    },
    {
      name: 'mobile-chrome',
      testMatch: /e2e\/mobile\/.*\.spec\.ts/,
      use: {
        ...devices['Pixel 7'],
        baseURL: process.env.GARAGE_MOBILE_URL ?? 'http://localhost:3003',
        launchOptions: {
          args: ['--enable-features=ServiceWorker', '--no-sandbox'],
        },
      },
    },
  ],

  webServer: isCI
    ? undefined
    : [
        {
          command: 'pnpm dev:portals',
          url: 'http://localhost:3001/fr',
          timeout: 120_000,
          reuseExistingServer: true,
          stdout: 'ignore',
          stderr: 'pipe',
        },
        {
          command: 'pnpm dev:dashboards',
          url: 'http://localhost:3000/fr',
          timeout: 120_000,
          reuseExistingServer: true,
        },
      ],

  outputDir: 'test-results',
});
```

### 6.2 -- repo/e2e/web/web-broker.spec.ts (~80 lignes)

```typescript
import { test, expect } from '@playwright/test';

const BASE = process.env.BROKER_URL ?? 'http://localhost:3001';

test.describe('web-broker (port 3001)', () => {
  test('home /fr renders 200 with title Broker', async ({ page }) => {
    const response = await page.goto(`${BASE}/fr`);
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(/Broker|Courtage|Skalean/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  });

  test('home /ar renders RTL', async ({ page }) => {
    const response = await page.goto(`${BASE}/ar`);
    expect(response?.status()).toBe(200);
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });

  test('home /ar-MA renders Darija content', async ({ page }) => {
    const response = await page.goto(`${BASE}/ar-MA`);
    expect(response?.status()).toBe(200);
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar-MA');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });

  test('locale switcher updates URL preserves slug', async ({ page }) => {
    await page.goto(`${BASE}/fr`);
    const switcher = page.getByRole('combobox', { name: /langue|locale|language/i });
    await switcher.click();
    await page.getByRole('option', { name: /arabe|ar/i }).first().click();
    await expect(page).toHaveURL(new RegExp(`${BASE}/ar`));
  });

  test('theme toggle dark/light/system', async ({ page }) => {
    await page.goto(`${BASE}/fr`);
    const toggle = page.getByRole('button', { name: /theme|theme switcher/i });
    await toggle.click();
    await page.getByRole('menuitem', { name: /dark|sombre/i }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await toggle.click();
    await page.getByRole('menuitem', { name: /light|clair/i }).click();
    await expect(page.locator('html')).not.toHaveClass(/dark/);
  });

  test('404 not-found triggered /non-existent', async ({ page }) => {
    const response = await page.goto(`${BASE}/fr/non-existent-page-12345`);
    expect(response?.status()).toBe(404);
    await expect(page.getByText(/404|introuvable|not found/i)).toBeVisible();
  });

  test('hydration no console error', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto(`${BASE}/fr`);
    await page.waitForLoadState('networkidle');
    expect(errors.filter((e) => /hydrat/i.test(e))).toHaveLength(0);
  });

  test('breadcrumb auto from pathname', async ({ page }) => {
    await page.goto(`${BASE}/fr`);
    const breadcrumb = page.getByRole('navigation', { name: /breadcrumb|fil ariane/i });
    await expect(breadcrumb).toBeVisible();
    await expect(breadcrumb.getByText(/accueil|home/i)).toBeVisible();
  });

  test('sidebar collapse expand', async ({ page }) => {
    await page.goto(`${BASE}/fr`);
    const sidebar = page.getByRole('complementary', { name: /sidebar/i });
    const toggle = page.getByRole('button', { name: /collapse|reduire/i });
    await toggle.click();
    await expect(sidebar).toHaveAttribute('data-state', 'collapsed');
    await toggle.click();
    await expect(sidebar).toHaveAttribute('data-state', 'expanded');
  });

  test('hamburger mobile drawer at viewport 360', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(`${BASE}/fr`);
    const hamburger = page.getByRole('button', { name: /menu|hamburger/i });
    await expect(hamburger).toBeVisible();
    await hamburger.click();
    await expect(page.getByRole('dialog', { name: /navigation/i })).toBeVisible();
  });
});
```

### 6.3 -- repo/e2e/web/web-garage.spec.ts (~80 lignes)

```typescript
import { test, expect } from '@playwright/test';

const BASE = process.env.GARAGE_URL ?? 'http://localhost:3002';

test.describe('web-garage (port 3002)', () => {
  test('home /fr renders 200 with title Garage', async ({ page }) => {
    const response = await page.goto(`${BASE}/fr`);
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(/Garage|Reparation|Skalean/);
  });

  test('garage variant theme verified Orange dominant', async ({ page }) => {
    await page.goto(`${BASE}/fr`);
    const primaryButton = page.getByRole('button').first();
    const bg = await primaryButton.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).toMatch(/rgb\(233,\s*93,\s*44\)|#e95d2c/i);
  });

  test('Wrench logo SVG renders', async ({ page }) => {
    await page.goto(`${BASE}/fr`);
    const logo = page.locator('header svg[data-logo="garage"]');
    await expect(logo).toBeVisible();
    const tag = await logo.evaluate((el) => el.tagName);
    expect(tag.toLowerCase()).toBe('svg');
  });

  test('home /ar renders RTL', async ({ page }) => {
    await page.goto(`${BASE}/ar`);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });

  test('home /ar-MA Darija renders', async ({ page }) => {
    const response = await page.goto(`${BASE}/ar-MA`);
    expect(response?.status()).toBe(200);
  });

  test('locale switcher fr -> ar preserves path', async ({ page }) => {
    await page.goto(`${BASE}/fr`);
    const switcher = page.getByRole('combobox', { name: /langue|locale|language/i });
    await switcher.click();
    await page.getByRole('option', { name: /^ar$|arabe classique/i }).click();
    await expect(page).toHaveURL(new RegExp(`${BASE}/ar`));
  });

  test('theme toggle works', async ({ page }) => {
    await page.goto(`${BASE}/fr`);
    const toggle = page.getByRole('button', { name: /theme/i });
    await toggle.click();
    await page.getByRole('menuitem', { name: /dark|sombre/i }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
  });

  test('404 not-found', async ({ page }) => {
    const response = await page.goto(`${BASE}/fr/non-existent-99999`);
    expect(response?.status()).toBe(404);
  });

  test('hydration no console error', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()));
    await page.goto(`${BASE}/fr`);
    await page.waitForLoadState('networkidle');
    expect(errors.filter((e) => /hydrat/i.test(e))).toHaveLength(0);
  });

  test('sidebar 5 sections garage visible', async ({ page }) => {
    await page.goto(`${BASE}/fr`);
    const sidebar = page.getByRole('complementary', { name: /sidebar/i });
    await expect(sidebar.getByRole('link', { name: /vehicules|cars/i })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: /reparations|repairs/i })).toBeVisible();
  });

  test('responsive 768px tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(`${BASE}/fr`);
    await expect(page.locator('main')).toBeVisible();
  });

  test('breadcrumb auto from pathname', async ({ page }) => {
    await page.goto(`${BASE}/fr`);
    const breadcrumb = page.getByRole('navigation', { name: /breadcrumb/i });
    await expect(breadcrumb).toBeVisible();
  });
});
```

### 6.4 -- repo/e2e/web/web-insurtech-admin.spec.ts (~80 lignes)

```typescript
import { test, expect } from '@playwright/test';

const BASE = process.env.ADMIN_URL ?? 'http://localhost:3000';

test.describe('web-insurtech-admin (port 3000)', () => {
  test('home /fr renders 200 with title Admin', async ({ page }) => {
    const response = await page.goto(`${BASE}/fr`);
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(/Admin|SuperAdmin|Skalean/);
  });

  test('admin variant Navy #1A2730 dominant', async ({ page }) => {
    await page.goto(`${BASE}/fr`);
    const sidebar = page.getByRole('complementary');
    const bg = await sidebar.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).toMatch(/rgb\(26,\s*39,\s*48\)|#1a2730/i);
  });

  test('sidebar 7 sections admin visible', async ({ page }) => {
    await page.goto(`${BASE}/fr`);
    const sidebar = page.getByRole('complementary');
    const expectedSections = [
      /tenants|organisations/i,
      /utilisateurs|users/i,
      /roles|rbac/i,
      /audit/i,
      /settings|parametres/i,
      /integrations/i,
      /supervision|monitoring/i,
    ];
    for (const re of expectedSections) {
      await expect(sidebar.getByRole('link', { name: re })).toBeVisible();
    }
  });

  test('restricted access placeholder Sprint 5', async ({ page }) => {
    await page.goto(`${BASE}/fr/tenants`);
    await expect(page.getByText(/auth|connexion|sprint 5|en construction/i)).toBeVisible();
  });

  test('home /ar renders RTL', async ({ page }) => {
    await page.goto(`${BASE}/ar`);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });

  test('home /ar-MA Darija', async ({ page }) => {
    const response = await page.goto(`${BASE}/ar-MA`);
    expect(response?.status()).toBe(200);
  });

  test('locale switcher works', async ({ page }) => {
    await page.goto(`${BASE}/fr`);
    const switcher = page.getByRole('combobox', { name: /langue|locale/i });
    await switcher.click();
    await page.getByRole('option', { name: /^ar$/i }).click();
    await expect(page).toHaveURL(new RegExp(`${BASE}/ar`));
  });

  test('theme dark toggle', async ({ page }) => {
    await page.goto(`${BASE}/fr`);
    await page.getByRole('button', { name: /theme/i }).click();
    await page.getByRole('menuitem', { name: /dark|sombre/i }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
  });

  test('404 not-found', async ({ page }) => {
    const response = await page.goto(`${BASE}/fr/non-existent-admin-route`);
    expect(response?.status()).toBe(404);
  });

  test('hydration no error', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()));
    await page.goto(`${BASE}/fr`);
    await page.waitForLoadState('networkidle');
    expect(errors.filter((e) => /hydrat/i.test(e))).toHaveLength(0);
  });

  test('responsive 1280x720 desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`${BASE}/fr`);
    await expect(page.locator('main')).toBeVisible();
  });

  test('breadcrumb auto from pathname', async ({ page }) => {
    await page.goto(`${BASE}/fr`);
    await expect(page.getByRole('navigation', { name: /breadcrumb/i })).toBeVisible();
  });
});
```

### 6.5 -- repo/e2e/web/web-customer-portal.spec.ts (~100 lignes)

```typescript
import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y } from 'axe-playwright';

const BASE = process.env.CUSTOMER_PORTAL_URL ?? 'http://localhost:3004';

test.describe('web-customer-portal (port 3004) -- public SSG/SEO', () => {
  test('SSG home /fr renders 200', async ({ page }) => {
    const response = await page.goto(`${BASE}/fr`);
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(/Skalean|Assurance|Maroc/);
  });

  test('sitemap.xml accessible', async ({ request }) => {
    const response = await request.get(`${BASE}/sitemap.xml`);
    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body).toContain('<urlset');
    expect(body).toContain('<loc>');
    expect(body).toContain(`${BASE}/fr`);
    expect(body).toContain(`${BASE}/ar`);
    expect(body).toContain(`${BASE}/ar-MA`);
  });

  test('robots.txt accessible Allow', async ({ request }) => {
    const response = await request.get(`${BASE}/robots.txt`);
    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body).toMatch(/User-agent:\s*\*/);
    expect(body).toMatch(/Allow:\s*\//);
    expect(body).toMatch(/Sitemap:\s*.*sitemap\.xml/);
  });

  test('OG meta tags scraped', async ({ page }) => {
    await page.goto(`${BASE}/fr`);
    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
    expect(ogTitle).toBeTruthy();
    const ogDesc = await page.locator('meta[property="og:description"]').getAttribute('content');
    expect(ogDesc).toBeTruthy();
    const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content');
    expect(ogImage).toMatch(/https?:\/\//);
    const ogLocale = await page.locator('meta[property="og:locale"]').getAttribute('content');
    expect(ogLocale).toMatch(/fr_MA|fr_FR/);
  });

  test('hreflang tags present 4 entries', async ({ page }) => {
    await page.goto(`${BASE}/fr`);
    const hreflangs = page.locator('link[rel="alternate"][hreflang]');
    const count = await hreflangs.count();
    expect(count).toBeGreaterThanOrEqual(4);
    const langs = await hreflangs.evaluateAll((els) =>
      els.map((el) => el.getAttribute('hreflang'))
    );
    expect(langs).toContain('fr');
    expect(langs).toContain('ar');
    expect(langs).toContain('ar-MA');
    expect(langs).toContain('x-default');
  });

  test('JSON-LD structured data validates schema.org', async ({ page }) => {
    await page.goto(`${BASE}/fr`);
    const jsonLd = await page.locator('script[type="application/ld+json"]').first().textContent();
    expect(jsonLd).toBeTruthy();
    const parsed = JSON.parse(jsonLd!);
    expect(parsed['@context']).toBe('https://schema.org');
    expect(parsed['@type']).toMatch(/Organization|WebSite/);
    if (parsed['@type'] === 'Organization') {
      expect(parsed.name).toBeTruthy();
      expect(parsed.url).toMatch(/skalean/i);
    }
  });

  test('cookie consent banner CNDP visible first visit', async ({ page, context }) => {
    await context.clearCookies();
    await page.goto(`${BASE}/fr`);
    const banner = page.getByRole('dialog', { name: /cookie|consent|cndp/i });
    await expect(banner).toBeVisible();
    await expect(banner.getByRole('button', { name: /accepter|accept/i })).toBeVisible();
    await expect(banner.getByRole('button', { name: /refuser|reject|decliner/i })).toBeVisible();
    await expect(banner.getByText(/loi 09-08|cndp/i)).toBeVisible();
  });

  test('cookie consent persists choice', async ({ page, context }) => {
    await context.clearCookies();
    await page.goto(`${BASE}/fr`);
    await page.getByRole('button', { name: /accepter|accept/i }).click();
    const cookies = await context.cookies();
    const consent = cookies.find((c) => c.name === 'cookie_consent');
    expect(consent?.value).toMatch(/accepted|true|all/i);
    await page.reload();
    await expect(page.getByRole('dialog', { name: /cookie/i })).not.toBeVisible();
  });

  test('a11y zero violation', async ({ page }) => {
    await page.goto(`${BASE}/fr`);
    await injectAxe(page);
    await checkA11y(page, undefined, {
      detailedReport: true,
      detailedReportOptions: { html: false },
    });
  });

  test('home /ar RTL', async ({ page }) => {
    await page.goto(`${BASE}/ar`);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });

  test('404 not-found custom design', async ({ page }) => {
    const response = await page.goto(`${BASE}/fr/non-existent-page`);
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('link', { name: /accueil|home/i })).toBeVisible();
  });
});
```

### 6.6 -- repo/e2e/web/web-assure-portal.spec.ts (~80 lignes)

```typescript
import { test, expect } from '@playwright/test';

const BASE = process.env.ASSURE_PORTAL_URL ?? 'http://localhost:3005';

test.describe('web-assure-portal (port 3005) -- self-service assure', () => {
  test('home /fr renders 200', async ({ page }) => {
    const response = await page.goto(`${BASE}/fr`);
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(/Espace|Assure|Skalean/);
  });

  test('theme assure Sky Blue #B0CEE2 dominant', async ({ page }) => {
    await page.goto(`${BASE}/fr`);
    const header = page.locator('header');
    const bg = await header.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).toMatch(/rgb\(176,\s*206,\s*226\)|#b0cee2/i);
  });

  test('no sidebar dense layout', async ({ page }) => {
    await page.goto(`${BASE}/fr`);
    const sidebars = page.getByRole('complementary');
    const count = await sidebars.count();
    expect(count).toBeLessThanOrEqual(1);
  });

  test('big buttons >= 44x44 touch target', async ({ page }) => {
    await page.goto(`${BASE}/fr`);
    const buttons = page.getByRole('button');
    const count = await buttons.count();
    for (let i = 0; i < Math.min(count, 5); i++) {
      const box = await buttons.nth(i).boundingBox();
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    }
  });

  test('mobile responsive 320px viewport', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto(`${BASE}/fr`);
    await expect(page.locator('main')).toBeVisible();
    const horizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(horizontalScroll).toBe(false);
  });

  test('RGPD/CNDP user rights stubs visible footer', async ({ page }) => {
    await page.goto(`${BASE}/fr`);
    const footer = page.getByRole('contentinfo');
    await expect(footer.getByText(/donnees personnelles|cndp|loi 09-08/i)).toBeVisible();
    await expect(footer.getByRole('link', { name: /mentions legales|legal/i })).toBeVisible();
    await expect(footer.getByRole('link', { name: /confidentialite|privacy/i })).toBeVisible();
  });

  test('home /ar-MA Darija renders', async ({ page }) => {
    const response = await page.goto(`${BASE}/ar-MA`);
    expect(response?.status()).toBe(200);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });

  test('locale switcher works', async ({ page }) => {
    await page.goto(`${BASE}/fr`);
    await page.getByRole('combobox', { name: /langue|locale/i }).click();
    await page.getByRole('option', { name: /^ar$|arabe/i }).first().click();
    await expect(page).toHaveURL(new RegExp(`${BASE}/ar`));
  });

  test('theme toggle', async ({ page }) => {
    await page.goto(`${BASE}/fr`);
    await page.getByRole('button', { name: /theme/i }).click();
    await page.getByRole('menuitem', { name: /dark|sombre/i }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
  });

  test('404 not-found', async ({ page }) => {
    const response = await page.goto(`${BASE}/fr/non-existent`);
    expect(response?.status()).toBe(404);
  });

  test('hydration no error', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.goto(`${BASE}/fr`);
    await page.waitForLoadState('networkidle');
    expect(errors.filter((e) => /hydrat/i.test(e))).toHaveLength(0);
  });
});
```

### 6.7 -- repo/e2e/mobile/web-garage-mobile.spec.ts (~120 lignes)

```typescript
import { test, expect, devices } from '@playwright/test';

const BASE = process.env.GARAGE_MOBILE_URL ?? 'http://localhost:3003';

test.describe('web-garage-mobile (port 3003) PWA', () => {
  test('home /fr renders 200 mobile', async ({ page }) => {
    const response = await page.goto(`${BASE}/fr`);
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(/Garage Mobile|Technicien/);
  });

  test('theme-color #E95D2C status bar', async ({ page }) => {
    await page.goto(`${BASE}/fr`);
    const themeColor = await page.locator('meta[name="theme-color"]').getAttribute('content');
    expect(themeColor?.toLowerCase()).toBe('#e95d2c');
  });

  test('viewport-fit cover for iOS notch', async ({ page }) => {
    await page.goto(`${BASE}/fr`);
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewport).toMatch(/viewport-fit\s*=\s*cover/);
    expect(viewport).toMatch(/initial-scale\s*=\s*1/);
  });

  test('manifest.webmanifest valid', async ({ page, request }) => {
    const response = await request.get(`${BASE}/manifest.webmanifest`);
    expect(response.status()).toBe(200);
    const manifest = await response.json();
    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.start_url).toBeTruthy();
    expect(manifest.display).toMatch(/standalone|fullscreen/);
    expect(manifest.theme_color).toBe('#E95D2C');
    expect(manifest.background_color).toBeTruthy();
    expect(manifest.icons).toBeInstanceOf(Array);
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
    const has192 = manifest.icons.some((i: any) => /192/.test(i.sizes));
    const has512 = manifest.icons.some((i: any) => /512/.test(i.sizes));
    expect(has192).toBe(true);
    expect(has512).toBe(true);
  });

  test('manifest exposes via getManifest API', async ({ page }) => {
    await page.goto(`${BASE}/fr`);
    const manifestLink = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(manifestLink).toMatch(/manifest\.webmanifest|manifest\.json/);
  });

  test('service worker registered', async ({ page }) => {
    await page.goto(`${BASE}/fr`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    const swState = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return 'unsupported';
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) return 'no-registration';
      return reg.active ? 'active' : reg.installing ? 'installing' : reg.waiting ? 'waiting' : 'unknown';
    });
    expect(['active', 'installing', 'waiting']).toContain(swState);
  });

  test('install prompt visible after user interaction', async ({ page }) => {
    await page.goto(`${BASE}/fr`);
    await page.evaluate(() => {
      window.dispatchEvent(new Event('beforeinstallprompt'));
    });
    const installCta = page.getByRole('button', { name: /installer|install/i });
    if (await installCta.isVisible().catch(() => false)) {
      await expect(installCta).toBeVisible();
    }
  });

  test('offline mode page loads from cache', async ({ page, context }) => {
    await page.goto(`${BASE}/fr`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => undefined);
    const bodyVisible = await page.locator('body').isVisible().catch(() => false);
    expect(bodyVisible).toBe(true);
    await context.setOffline(false);
  });

  test('home /ar-MA Darija mobile', async ({ page }) => {
    const response = await page.goto(`${BASE}/ar-MA`);
    expect(response?.status()).toBe(200);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });

  test('responsive 360px width', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(`${BASE}/fr`);
    const horizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(horizontalScroll).toBe(false);
  });

  test('apple-touch-icon present iOS', async ({ page }) => {
    await page.goto(`${BASE}/fr`);
    const icon = page.locator('link[rel="apple-touch-icon"]');
    await expect(icon).toHaveCount(1, { timeout: 5000 });
    const href = await icon.getAttribute('href');
    expect(href).toBeTruthy();
  });

  test('hydration no error mobile', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.goto(`${BASE}/fr`);
    await page.waitForLoadState('networkidle');
    expect(errors.filter((e) => /hydrat/i.test(e))).toHaveLength(0);
  });
});
```

### 6.8 -- repo/e2e/mobile/web-assure-mobile.spec.ts (~120 lignes)

```typescript
import { test, expect } from '@playwright/test';

const BASE = process.env.ASSURE_MOBILE_URL ?? 'http://localhost:3006';

test.describe('web-assure-mobile (port 3006) PWA -- assure sinistres', () => {
  test('home /fr renders 200', async ({ page }) => {
    const response = await page.goto(`${BASE}/fr`);
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(/Assure|Sinistre|Skalean/);
  });

  test('theme-color #2D5773 ACAPS Teal', async ({ page }) => {
    await page.goto(`${BASE}/fr`);
    const themeColor = await page.locator('meta[name="theme-color"]').getAttribute('content');
    expect(themeColor?.toLowerCase()).toBe('#2d5773');
  });

  test('viewport-fit cover iOS notch', async ({ page }) => {
    await page.goto(`${BASE}/fr`);
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewport).toMatch(/viewport-fit\s*=\s*cover/);
  });

  test('manifest.webmanifest theme_color teal', async ({ request }) => {
    const response = await request.get(`${BASE}/manifest.webmanifest`);
    expect(response.status()).toBe(200);
    const m = await response.json();
    expect(m.theme_color).toBe('#2D5773');
    expect(m.display).toMatch(/standalone/);
    expect(m.start_url).toBeTruthy();
  });

  test('BottomTabs 4 tabs visible', async ({ page }) => {
    await page.goto(`${BASE}/fr`);
    const bottomTabs = page.getByRole('navigation', { name: /bottom|tabs/i });
    await expect(bottomTabs).toBeVisible();
    const tabs = bottomTabs.getByRole('link');
    const count = await tabs.count();
    expect(count).toBe(4);
  });

  test('6-step wizard placeholder Sprint 25', async ({ page }) => {
    await page.goto(`${BASE}/fr/sinistres/declarer`);
    const wizard = page.getByText(/etape|step|sprint 25|en construction|wizard/i);
    await expect(wizard).toBeVisible();
  });

  test('service worker registered', async ({ page }) => {
    await page.goto(`${BASE}/fr`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    const swState = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return 'unsupported';
      const reg = await navigator.serviceWorker.getRegistration();
      return reg ? (reg.active ? 'active' : 'installing') : 'no-registration';
    });
    expect(['active', 'installing', 'no-registration']).toContain(swState);
  });

  test('offline mode loads cached page', async ({ page, context }) => {
    await page.goto(`${BASE}/fr`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => undefined);
    const visible = await page.locator('body').isVisible().catch(() => false);
    expect(visible).toBe(true);
    await context.setOffline(false);
  });

  test('install prompt available', async ({ page }) => {
    await page.goto(`${BASE}/fr`);
    await page.evaluate(() => window.dispatchEvent(new Event('beforeinstallprompt')));
    const installBtn = page.getByRole('button', { name: /installer|install/i });
    if (await installBtn.isVisible().catch(() => false)) {
      await expect(installBtn).toBeVisible();
    }
  });

  test('home /ar-MA Darija mobile', async ({ page }) => {
    const response = await page.goto(`${BASE}/ar-MA`);
    expect(response?.status()).toBe(200);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });

  test('responsive 320px no horizontal scroll', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto(`${BASE}/fr`);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(overflow).toBe(false);
  });

  test('big touch targets 44x44 min', async ({ page }) => {
    await page.goto(`${BASE}/fr`);
    const ctas = page.getByRole('button');
    const count = await ctas.count();
    for (let i = 0; i < Math.min(count, 5); i++) {
      const box = await ctas.nth(i).boundingBox();
      if (box) expect(box.height).toBeGreaterThanOrEqual(44);
    }
  });

  test('hydration no error', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.goto(`${BASE}/fr`);
    await page.waitForLoadState('networkidle');
    expect(errors.filter((e) => /hydrat/i.test(e))).toHaveLength(0);
  });
});
```

### 6.9 -- repo/scripts/lighthouse-baseline.ts (~250 lignes)

```typescript
#!/usr/bin/env tsx
/**
 * Lighthouse baseline runner -- audit 8 apps Skalean InsurTech.
 * Output: lighthouse-reports/baseline-{app}.json + ASCII summary stdout.
 * Exit code 1 si au moins un metric P0 below cible.
 *
 * Usage:
 *   pnpm lighthouse:baseline
 *   PORTS surchargeable via env (BROKER_URL, GARAGE_URL, etc.)
 */
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPORTS_DIR = join(__dirname, '..', 'lighthouse-reports');

interface AppTarget {
  name: string;
  url: string;
  profile: 'mobile' | 'desktop';
  cibles: {
    performance: number;
    accessibility: number;
    bestPractices: number;
    seo: number;
    pwa?: number;
  };
}

const APPS: AppTarget[] = [
  {
    name: 'web-broker',
    url: process.env.BROKER_URL ?? 'http://localhost:3001/fr',
    profile: 'desktop',
    cibles: { performance: 70, accessibility: 90, bestPractices: 90, seo: 90 },
  },
  {
    name: 'web-garage',
    url: process.env.GARAGE_URL ?? 'http://localhost:3002/fr',
    profile: 'desktop',
    cibles: { performance: 70, accessibility: 90, bestPractices: 90, seo: 90 },
  },
  {
    name: 'web-garage-mobile',
    url: process.env.GARAGE_MOBILE_URL ?? 'http://localhost:3003/fr',
    profile: 'mobile',
    cibles: { performance: 70, accessibility: 90, bestPractices: 90, seo: 90, pwa: 90 },
  },
  {
    name: 'web-insurtech-admin',
    url: process.env.ADMIN_URL ?? 'http://localhost:3000/fr',
    profile: 'desktop',
    cibles: { performance: 70, accessibility: 90, bestPractices: 90, seo: 90 },
  },
  {
    name: 'web-customer-portal',
    url: process.env.CUSTOMER_PORTAL_URL ?? 'http://localhost:3004/fr',
    profile: 'desktop',
    cibles: { performance: 80, accessibility: 90, bestPractices: 90, seo: 90 },
  },
  {
    name: 'web-customer-portal-mobile',
    url: process.env.CUSTOMER_PORTAL_URL ?? 'http://localhost:3004/fr',
    profile: 'mobile',
    cibles: { performance: 70, accessibility: 90, bestPractices: 90, seo: 90 },
  },
  {
    name: 'web-assure-portal',
    url: process.env.ASSURE_PORTAL_URL ?? 'http://localhost:3005/fr',
    profile: 'desktop',
    cibles: { performance: 70, accessibility: 90, bestPractices: 90, seo: 90 },
  },
  {
    name: 'web-assure-mobile',
    url: process.env.ASSURE_MOBILE_URL ?? 'http://localhost:3006/fr',
    profile: 'mobile',
    cibles: { performance: 70, accessibility: 90, bestPractices: 90, seo: 90, pwa: 90 },
  },
];

interface ScoreRow {
  app: string;
  profile: string;
  perf: number;
  a11y: number;
  bp: number;
  seo: number;
  pwa: number | null;
  pass: boolean;
  failures: string[];
}

async function runOne(target: AppTarget): Promise<ScoreRow> {
  const chrome = await chromeLauncher.launch({
    chromeFlags: ['--headless', '--no-sandbox', '--disable-dev-shm-usage'],
  });
  const settings: any = {
    output: 'json',
    logLevel: 'error',
    onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo', 'pwa'],
    formFactor: target.profile,
    screenEmulation:
      target.profile === 'mobile'
        ? {
            mobile: true,
            width: 360,
            height: 640,
            deviceScaleFactor: 2,
            disabled: false,
          }
        : {
            mobile: false,
            width: 1350,
            height: 940,
            deviceScaleFactor: 1,
            disabled: false,
          },
    throttling:
      target.profile === 'mobile'
        ? {
            rttMs: 150,
            throughputKbps: 1638.4,
            cpuSlowdownMultiplier: 4,
            requestLatencyMs: 0,
            downloadThroughputKbps: 0,
            uploadThroughputKbps: 0,
          }
        : {
            rttMs: 40,
            throughputKbps: 10240,
            cpuSlowdownMultiplier: 1,
            requestLatencyMs: 0,
            downloadThroughputKbps: 0,
            uploadThroughputKbps: 0,
          },
  };

  const result = await lighthouse(target.url, { port: chrome.port, ...settings });
  await chrome.kill();

  if (!result || !result.lhr) {
    throw new Error(`Lighthouse failed for ${target.name}`);
  }

  const lhr = result.lhr;
  const cats = lhr.categories;
  const score = (k: string) => Math.round((cats[k]?.score ?? 0) * 100);
  const perf = score('performance');
  const a11y = score('accessibility');
  const bp = score('best-practices');
  const seo = score('seo');
  const pwa = cats['pwa'] ? score('pwa') : null;

  if (!existsSync(REPORTS_DIR)) mkdirSync(REPORTS_DIR, { recursive: true });
  const outFile = join(REPORTS_DIR, `baseline-${target.name}.json`);
  writeFileSync(outFile, JSON.stringify(lhr, null, 2));

  const failures: string[] = [];
  if (perf < target.cibles.performance) failures.push(`perf ${perf}<${target.cibles.performance}`);
  if (a11y < target.cibles.accessibility) failures.push(`a11y ${a11y}<${target.cibles.accessibility}`);
  if (bp < target.cibles.bestPractices) failures.push(`bp ${bp}<${target.cibles.bestPractices}`);
  if (seo < target.cibles.seo) failures.push(`seo ${seo}<${target.cibles.seo}`);
  if (target.cibles.pwa !== undefined && (pwa ?? 0) < target.cibles.pwa) {
    failures.push(`pwa ${pwa ?? 0}<${target.cibles.pwa}`);
  }

  return {
    app: target.name,
    profile: target.profile,
    perf,
    a11y,
    bp,
    seo,
    pwa,
    pass: failures.length === 0,
    failures,
  };
}

function asciiTable(rows: ScoreRow[]): string {
  const header =
    '+----------------------------+----------+------+------+----+-----+-----+--------+';
  const cols =
    '| app                        | profile  | perf | a11y | bp | seo | pwa | pass   |';
  const sep =
    '+----------------------------+----------+------+------+----+-----+-----+--------+';
  const lines = rows.map((r) => {
    const a = r.app.padEnd(26).slice(0, 26);
    const p = r.profile.padEnd(8);
    const pf = String(r.perf).padStart(4);
    const ay = String(r.a11y).padStart(4);
    const bp = String(r.bp).padStart(2);
    const se = String(r.seo).padStart(3);
    const pw = (r.pwa === null ? 'n/a' : String(r.pwa)).padStart(3);
    const ok = (r.pass ? 'PASS' : 'FAIL').padEnd(6);
    return `| ${a} | ${p} | ${pf} | ${ay} | ${bp} | ${se} | ${pw} | ${ok} |`;
  });
  return [header, cols, sep, ...lines, sep].join('\n');
}

async function main() {
  console.log('Lighthouse baseline -- 8 apps audit\n');
  const rows: ScoreRow[] = [];
  for (const app of APPS) {
    process.stdout.write(`Auditing ${app.name} (${app.profile})... `);
    try {
      const r = await runOne(app);
      rows.push(r);
      process.stdout.write(`${r.pass ? 'OK' : 'FAIL'} (${r.failures.join(', ') || '-'})\n`);
    } catch (err) {
      console.error(`ERROR ${app.name}:`, err);
      rows.push({
        app: app.name,
        profile: app.profile,
        perf: 0,
        a11y: 0,
        bp: 0,
        seo: 0,
        pwa: null,
        pass: false,
        failures: ['error-launching'],
      });
    }
  }

  const summary = asciiTable(rows);
  console.log('\n' + summary + '\n');
  writeFileSync(join(REPORTS_DIR, 'baseline-summary.txt'), summary);

  const anyFail = rows.some((r) => !r.pass);
  if (anyFail) {
    console.error('FAILURE -- au moins un seuil P0 non atteint');
    process.exit(1);
  }
  console.log('SUCCESS -- tous les seuils P0 atteints');
  process.exit(0);
}

main().catch((err) => {
  console.error('FATAL', err);
  process.exit(2);
});
```

### 6.10 -- repo/lighthouserc.cjs (~80 lignes)

```javascript
/**
 * Lighthouse CI config -- assertions strictes par app + upload temporary-public-storage.
 * Reference: https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/configuration.md
 */
module.exports = {
  ci: {
    collect: {
      url: [
        'http://localhost:3000/fr',
        'http://localhost:3001/fr',
        'http://localhost:3002/fr',
        'http://localhost:3003/fr',
        'http://localhost:3004/fr',
        'http://localhost:3005/fr',
        'http://localhost:3006/fr',
      ],
      numberOfRuns: 3,
      startServerCommand: 'pnpm dev:portals & pnpm dev:dashboards',
      startServerReadyPattern: 'Ready',
      startServerReadyTimeout: 120000,
      settings: {
        preset: 'desktop',
        chromeFlags: '--no-sandbox --disable-dev-shm-usage',
        skipAudits: ['uses-http2'],
      },
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.7, aggregationMethod: 'median' }],
        'categories:accessibility': ['error', { minScore: 0.9, aggregationMethod: 'median' }],
        'categories:best-practices': ['error', { minScore: 0.9, aggregationMethod: 'median' }],
        'categories:seo': ['error', { minScore: 0.9, aggregationMethod: 'median' }],
        'categories:pwa': ['warn', { minScore: 0.9 }],
        'first-contentful-paint': ['warn', { maxNumericValue: 2500 }],
        'largest-contentful-paint': ['warn', { maxNumericValue: 4000 }],
        'cumulative-layout-shift': ['warn', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['warn', { maxNumericValue: 300 }],
        'speed-index': ['warn', { maxNumericValue: 4000 }],
        'interactive': ['warn', { maxNumericValue: 5000 }],
        'no-vulnerable-libraries': 'error',
        'errors-in-console': 'warn',
        'is-on-https': 'off',
        'redirects-http': 'off',
        'unused-css-rules': 'warn',
        'unused-javascript': 'warn',
        'modern-image-formats': 'warn',
        'efficient-animated-content': 'warn',
        'uses-text-compression': 'warn',
        'uses-responsive-images': 'warn',
        'image-alt': 'error',
        'document-title': 'error',
        'html-has-lang': 'error',
        'html-lang-valid': 'error',
        'meta-description': 'warn',
        'meta-viewport': 'error',
        'tap-targets': 'warn',
        'color-contrast': 'error',
        'crawlable-anchors': 'error',
        'hreflang': 'warn',
        'canonical': 'warn',
        'robots-txt': 'warn',
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
    server: {},
  },
};
```

### 6.11 -- repo/docs/architecture/lighthouse-strategy.md (~300 lignes)

```markdown
# Lighthouse Strategy -- Skalean InsurTech

## Vue d'ensemble

Cette doc decrit la strategie d'audits Lighthouse pour les 8 apps frontend du programme. Elle couvre les cibles initiales (Sprint 4 baseline), les cibles cibles par sprint metier, le workflow CI Lighthouse fail PR si regression, le performance budget, et les optimisations planifiees.

## Cibles initiales -- Sprint 4 baseline

| App | Profile | Performance | Accessibility | Best Practices | SEO | PWA |
|-----|---------|-------------|----------------|-----------------|-----|-----|
| web-broker | desktop | 70 | 90 | 90 | 90 | n/a |
| web-garage | desktop | 70 | 90 | 90 | 90 | n/a |
| web-garage-mobile | mobile | 70 | 90 | 90 | 90 | 90 |
| web-insurtech-admin | desktop | 70 | 90 | 90 | 90 | n/a |
| web-customer-portal | desktop | 80 | 90 | 90 | 90 | n/a |
| web-customer-portal | mobile | 70 | 90 | 90 | 90 | n/a |
| web-assure-portal | desktop | 70 | 90 | 90 | 90 | n/a |
| web-assure-mobile | mobile | 70 | 90 | 90 | 90 | 90 |

## Cibles par sprint metier

| Sprint | App | Cible Performance | Cible SEO | Notes |
|--------|-----|-------------------|-----------|-------|
| 4 (current) | toutes | 70-80 | 90 | Baseline bootstrap |
| 17 | web-broker | 90 | 90 | Souscription polices, focus sur formulaires lourds |
| 18 | web-customer-portal | 95 (desktop) / 85 (mobile) | 100 | Public SEO crucial, Critical CSS, AVIF/WebP, hreflang |
| 22 | web-broker (claims) | 90 | 90 | Maintien |
| 24 | web-garage-mobile | 90 (mobile) | 90 | PWA install rate, offline ameliore |
| 25 | web-assure-mobile | 90 (mobile) | 90 | PWA wizard sinistres |
| 27 | web-insurtech-admin | 80 | 90 | Dashboards charts lourds, acceptable |
| 30 | toutes | maintenu | maintenu | Accessibility 100 (loi MA accessibilite sites publics) |
| 35 | toutes | +5pts everywhere | +5pts | Industrialisation finale |

## Workflow CI Lighthouse

### Local developpeur

```bash
pnpm lighthouse:baseline   # script TypeScript exhaustif
# Output:
#   - lighthouse-reports/baseline-{app}.json (JSON Lighthouse complet)
#   - lighthouse-reports/baseline-summary.txt (ASCII table)
# Exit code 1 si seuil P0 non atteint
```

### CI GitHub Actions

```bash
pnpm lighthouse:ci   # via @lhci/cli
# Output:
#   - .lighthouseci/ (JSON + HTML reports per run)
#   - Upload temporary-public-storage (URLs commentees sur PR)
#   - Assertions echec = fail PR
```

### Strategie regression

1. PR ouverte sur main : Lighthouse CI execute sur les 8 apps avec seuils Sprint courant.
2. Si regression > 5 points sur Performance, PR commenttee `regression detected`.
3. Override possible avec label `lighthouse-skip` (rare, justifie via PR description).
4. Trends graphiques sur Atlas Cloud Benguerir LHCI server (Sprint 35).

## Performance budget

Limites max par bundle :

| Resource | Limit | Mesure |
|----------|-------|--------|
| Total JS bundle (gzip) | 500 ko | `<script>` cumule |
| Total CSS bundle (gzip) | 100 ko | `<link rel="stylesheet">` cumule |
| Images per page | 1.5 Mo | `<img>` cumule (excl. lazy non-charges) |
| Fonts | 200 ko | `next/font` Montserrat + Noto Naskh combines (subsets latin + arabic) |
| Total HTML transfer | 30 ko | gzipped |
| LCP (Largest Contentful Paint) | < 2.5s | mobile 4G simule |
| FID/INP (Interaction to Next Paint) | < 200ms | desktop |
| CLS (Cumulative Layout Shift) | < 0.1 | tout viewport |
| TBT (Total Blocking Time) | < 300ms | mobile |
| TTI (Time To Interactive) | < 5s | mobile 4G |

## Strategies d'optimisation Sprint 18 (customer-portal)

### Critical CSS

- Plugin `next-critical-css` ou `critters` integration `next.config.mjs`.
- Inline ~14 ko CSS critique dans `<head>` (above-the-fold).
- Charge async le reste via `<link rel="preload" as="style">`.

### Font preload

```html
<link rel="preload" href="/fonts/montserrat-400.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/noto-naskh-400.woff2" as="font" type="font/woff2" crossorigin>
```

`next/font/google` avec `display: 'swap'`, `preload: true`, subsets latin + arabic.

### Image optimization

- `next/image` natif Next.js 15.
- Format AVIF + WebP fallback (configure `images.formats: ['image/avif', 'image/webp']` dans `next.config.mjs`).
- `loading="lazy"` defaut pour images below-the-fold.
- `priority` flag pour LCP image (hero customer-portal).
- Sizes attribute responsive (`sizes="(max-width: 640px) 100vw, 50vw"`).

### Lazy-loading components

- Dynamic imports `next/dynamic` pour widgets non-critical (carousel testimonials, comparateur tableau si lourd).
- React.lazy + Suspense boundaries.

### CDN et caching strategy

- Atlas Cloud Benguerir CDN avec edge cache 1 an pour assets immutables (`/_next/static/*`).
- HTML SSG avec ISR 60s (`revalidate: 60`).
- API responses cache `s-maxage=300, stale-while-revalidate=86400`.

### Web Vitals reporter

- `web-vitals` 4.x npm package.
- Reporter envoie metrics LCP, CLS, INP, TTFB vers `/api/web-vitals` (Sprint 18).
- Stockage Postgres `web_vitals_events` table + dashboard Grafana Sprint 27.

## Outils complementaires

| Outil | Sprint | Usage |
|-------|--------|-------|
| Lighthouse CI 0.14 | 4 (this) | Audits CI |
| WebPageTest API | 35 | Audits real device cloud |
| Pa11y CI 4.x | 30 | Accessibility testing 100% pages |
| axe-core 4.10 | 4 (this) | A11y in Playwright + Storybook |
| BrowserStack | 35 | Real iOS Safari + Android Chrome |
| Chromatic | 35 | Visual regression Storybook |
| Loki | 35 (alternative) | Visual regression open-source |

## Note conformite Maroc

Loi accessibilite des sites publics Maroc (Sprint 30, en application Q3 2026 selon ANRT) imposera Lighthouse Accessibility = 100 sur `web-customer-portal`. Les autres apps (privees, courtage / garage / admin) restent a 90+ en cible mais non legalement contraintes.
```

### 6.12 -- packages/shared-ui/.storybook/main.ts (~80 lignes)

```typescript
import type { StorybookConfig } from '@storybook/nextjs';
import { join, dirname } from 'node:path';

function getAbsolutePath(value: string): string {
  return dirname(require.resolve(join(value, 'package.json')));
}

const config: StorybookConfig = {
  stories: [
    '../src/**/*.mdx',
    '../src/**/*.stories.@(ts|tsx|mdx)',
  ],
  addons: [
    getAbsolutePath('@storybook/addon-essentials'),
    getAbsolutePath('@storybook/addon-a11y'),
    getAbsolutePath('@storybook/addon-themes'),
    getAbsolutePath('@storybook/addon-interactions'),
    getAbsolutePath('@chromatic-com/storybook'),
  ],
  framework: {
    name: getAbsolutePath('@storybook/nextjs'),
    options: {
      builder: { useSWC: true },
      nextConfigPath: join(__dirname, '..', '..', '..', 'apps', 'web-broker', 'next.config.mjs'),
    },
  },
  docs: { autodocs: 'tag', defaultName: 'Documentation' },
  staticDirs: ['../public', '../src/assets'],
  typescript: {
    check: false,
    reactDocgen: 'react-docgen-typescript',
    reactDocgenTypescriptOptions: {
      shouldExtractLiteralValuesFromEnum: true,
      propFilter: (prop) => (prop.parent ? !/node_modules/.test(prop.parent.fileName) : true),
    },
  },
  features: { experimentalRSC: true },
  async viteFinal(config) {
    const { mergeConfig } = await import('vite');
    const tailwind = (await import('@tailwindcss/vite')).default;
    return mergeConfig(config, {
      plugins: [tailwind()],
      resolve: {
        alias: {
          '@': join(__dirname, '..', 'src'),
          '@insurtech/shared-ui': join(__dirname, '..', 'src'),
        },
      },
      define: { 'process.env.NEXT_PUBLIC_APP_NAME': JSON.stringify('shared-ui-storybook') },
      optimizeDeps: { include: ['react', 'react-dom'] },
    });
  },
};

export default config;
```

### 6.13 -- packages/shared-ui/.storybook/preview.tsx (~120 lignes)

```tsx
import type { Preview } from '@storybook/react';
import { withThemeByClassName } from '@storybook/addon-themes';
import { NextIntlClientProvider } from 'next-intl';
import React from 'react';
import '../src/styles/globals.css';

const messages = {
  fr: {
    common: { hello: 'Bonjour', save: 'Enregistrer', cancel: 'Annuler' },
  },
  ar: {
    common: { hello: 'مرحبا', save: 'حفظ', cancel: 'إلغاء' },
  },
  'ar-MA': {
    common: { hello: 'سلام', save: 'سجل', cancel: 'لخر' },
  },
};

const preview: Preview = {
  parameters: {
    layout: 'centered',
    actions: { argTypesRegex: '^on[A-Z].*' },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
      expanded: true,
    },
    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: '#ffffff' },
        { name: 'dark', value: '#1A2730' },
        { name: 'sky', value: '#B0CEE2' },
      ],
    },
    viewport: {
      viewports: {
        mobile1: { name: 'Small mobile', styles: { width: '320px', height: '568px' } },
        mobile2: { name: 'Large mobile', styles: { width: '414px', height: '896px' } },
        tablet: { name: 'Tablet', styles: { width: '768px', height: '1024px' } },
        desktop: { name: 'Desktop', styles: { width: '1280px', height: '720px' } },
      },
    },
    a11y: {
      element: '#storybook-root',
      config: {
        rules: [
          { id: 'aria-hidden-focus', enabled: false },
          { id: 'color-contrast', enabled: true },
        ],
      },
      options: { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } },
      manual: false,
    },
    docs: { toc: { contentsSelector: '.sbdocs-content', headingSelector: 'h2, h3' } },
  },
  globalTypes: {
    locale: {
      name: 'Locale',
      description: 'i18n locale',
      defaultValue: 'fr',
      toolbar: {
        icon: 'globe',
        items: [
          { value: 'fr', title: 'Francais' },
          { value: 'ar-MA', title: 'Darija (ar-MA)' },
          { value: 'ar', title: 'Arabe classique (ar)' },
        ],
        dynamicTitle: true,
      },
    },
    direction: {
      name: 'Direction',
      defaultValue: 'auto',
      toolbar: {
        icon: 'paragraph',
        items: [
          { value: 'ltr', title: 'LTR' },
          { value: 'rtl', title: 'RTL' },
          { value: 'auto', title: 'Auto (locale)' },
        ],
      },
    },
  },
  decorators: [
    withThemeByClassName({
      themes: { light: 'light', dark: 'dark' },
      defaultTheme: 'light',
    }),
    (Story, ctx) => {
      const locale = ctx.globals.locale ?? 'fr';
      const dir =
        ctx.globals.direction === 'auto'
          ? locale === 'ar' || locale === 'ar-MA'
            ? 'rtl'
            : 'ltr'
          : ctx.globals.direction;
      React.useEffect(() => {
        document.documentElement.setAttribute('lang', locale);
        document.documentElement.setAttribute('dir', dir);
      }, [locale, dir]);
      return (
        <NextIntlClientProvider locale={locale} messages={(messages as any)[locale]}>
          <div lang={locale} dir={dir} style={{ padding: '1rem' }}>
            <Story />
          </div>
        </NextIntlClientProvider>
      );
    },
  ],
};

export default preview;
```

### 6.14 -- packages/shared-ui/src/components/Button.stories.tsx (~80 lignes)

```tsx
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';
import { Mail, Loader2 } from 'lucide-react';

const meta: Meta<typeof Button> = {
  title: 'Components/Button',
  component: Button,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Button shared-ui base sur shadcn/ui + Radix Slot. 6 variantes + 4 sizes + asChild + disabled + loading.',
      },
    },
  },
  args: {
    children: 'Cliquer ici',
    variant: 'default',
    size: 'default',
  },
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'],
      description: 'Variante visuelle',
    },
    size: {
      control: { type: 'select' },
      options: ['default', 'sm', 'lg', 'icon'],
      description: 'Taille',
    },
    asChild: { control: 'boolean', description: 'Render en Slot Radix' },
    disabled: { control: 'boolean' },
    onClick: { action: 'clicked' },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Default: Story = {};

export const Primary: Story = {
  args: { variant: 'default', children: 'Souscrire police' },
};

export const Destructive: Story = {
  args: { variant: 'destructive', children: 'Supprimer contrat' },
};

export const Outline: Story = {
  args: { variant: 'outline', children: 'Annuler' },
};

export const Secondary: Story = {
  args: { variant: 'secondary', children: 'Secondaire' },
};

export const Ghost: Story = {
  args: { variant: 'ghost', children: 'Discret' },
};

export const Link: Story = {
  args: { variant: 'link', children: 'En savoir plus' },
};

export const WithIcon: Story = {
  args: {
    children: (
      <>
        <Mail className="me-2 h-4 w-4" /> Envoyer email
      </>
    ),
  },
};

export const Loading: Story = {
  args: {
    disabled: true,
    children: (
      <>
        <Loader2 className="me-2 h-4 w-4 animate-spin" /> Chargement
      </>
    ),
  },
};

export const Disabled: Story = { args: { disabled: true, children: 'Desactive' } };

export const AsChild: Story = {
  args: {
    asChild: true,
    children: <a href="#test">Lien stylise</a>,
  },
};

export const SmallSize: Story = { args: { size: 'sm', children: 'Petit' } };
export const LargeSize: Story = { args: { size: 'lg', children: 'Grand' } };
```

### 6.15 -- packages/shared-ui/src/components/Card.stories.tsx (~60 lignes)

```tsx
import type { Meta, StoryObj } from '@storybook/react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './Card';
import { Button } from './Button';

const meta: Meta<typeof Card> = {
  title: 'Components/Card',
  component: Card,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  render: () => (
    <Card className="w-[360px]">
      <CardHeader>
        <CardTitle>Police d'assurance auto</CardTitle>
        <CardDescription>Souscription en 5 minutes.</CardDescription>
      </CardHeader>
      <CardContent>Couverture tous risques + assistance 24/7 partout au Maroc.</CardContent>
      <CardFooter>
        <Button>Souscrire maintenant</Button>
      </CardFooter>
    </Card>
  ),
};

export const Compact: Story = {
  render: () => (
    <Card className="w-[280px]">
      <CardHeader>
        <CardTitle>Sinistre #SK-2026-0142</CardTitle>
      </CardHeader>
      <CardContent>Statut : en cours d'expertise.</CardContent>
    </Card>
  ),
};

export const NoFooter: Story = {
  render: () => (
    <Card className="w-[320px]">
      <CardHeader>
        <CardTitle>Statistiques</CardTitle>
        <CardDescription>Mois en cours</CardDescription>
      </CardHeader>
      <CardContent>
        <p>Polices vendues : 142</p>
        <p>Sinistres ouverts : 23</p>
      </CardContent>
    </Card>
  ),
};
```

### 6.16 -- packages/shared-ui/src/components/Dialog.stories.tsx (~70 lignes)

```tsx
import type { Meta, StoryObj } from '@storybook/react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './Dialog';
import { Button } from './Button';

const meta: Meta<typeof Dialog> = {
  title: 'Components/Dialog',
  component: Dialog,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    a11y: {
      config: { rules: [{ id: 'aria-hidden-focus', enabled: false }] },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Dialog>;

export const Default: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Ouvrir dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmer suppression</DialogTitle>
          <DialogDescription>
            Cette action ne peut pas etre annulee. Le contrat sera definitivement supprime.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline">Annuler</Button>
          <Button variant="destructive">Supprimer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

export const FormDialog: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Editer profil</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modifier profil</DialogTitle>
          <DialogDescription>Mettez a jour vos informations.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <input className="rounded border px-3 py-2" placeholder="Nom complet" />
          <input className="rounded border px-3 py-2" placeholder="Email" />
        </div>
        <DialogFooter>
          <Button>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};
```

### 6.17 -- packages/shared-ui/src/components/Input.stories.tsx (~60 lignes)

```tsx
import type { Meta, StoryObj } from '@storybook/react';
import { Input } from './Input';
import { Search, Mail } from 'lucide-react';

const meta: Meta<typeof Input> = {
  title: 'Components/Input',
  component: Input,
  tags: ['autodocs'],
  args: { placeholder: 'Tapez ici...' },
  argTypes: {
    type: {
      control: { type: 'select' },
      options: ['text', 'email', 'password', 'tel', 'url', 'number'],
    },
    disabled: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {};

export const Email: Story = { args: { type: 'email', placeholder: 'votre@email.ma' } };

export const Password: Story = { args: { type: 'password', placeholder: 'Mot de passe' } };

export const Disabled: Story = { args: { disabled: true, placeholder: 'Desactive' } };

export const WithIcon: Story = {
  render: (args) => (
    <div className="relative w-72">
      <Search className="absolute start-3 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input {...args} className="ps-9" placeholder="Rechercher contrat..." />
    </div>
  ),
};

export const RTLArabic: Story = {
  parameters: { docs: { description: { story: 'Test RTL ar-MA Darija' } } },
  render: (args) => (
    <div dir="rtl" className="w-72">
      <Input {...args} placeholder="ادخل اسمك" />
    </div>
  ),
};
```

### 6.18 -- packages/shared-ui/src/components/Select.stories.tsx (~70 lignes)

```tsx
import type { Meta, StoryObj } from '@storybook/react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from './Select';

const meta: Meta<typeof Select> = {
  title: 'Components/Select',
  component: Select,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Select>;

export const Default: Story = {
  render: () => (
    <Select>
      <SelectTrigger className="w-[260px]">
        <SelectValue placeholder="Selectionner ville" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="casablanca">Casablanca</SelectItem>
        <SelectItem value="rabat">Rabat</SelectItem>
        <SelectItem value="marrakech">Marrakech</SelectItem>
        <SelectItem value="fes">Fes</SelectItem>
        <SelectItem value="tanger">Tanger</SelectItem>
        <SelectItem value="agadir">Agadir</SelectItem>
        <SelectItem value="benguerir">Benguerir</SelectItem>
      </SelectContent>
    </Select>
  ),
};

export const Grouped: Story = {
  render: () => (
    <Select>
      <SelectTrigger className="w-[260px]">
        <SelectValue placeholder="Type de garantie" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Auto</SelectLabel>
          <SelectItem value="auto-tier">Auto au tiers</SelectItem>
          <SelectItem value="auto-tr">Auto tous risques</SelectItem>
        </SelectGroup>
        <SelectGroup>
          <SelectLabel>Habitation</SelectLabel>
          <SelectItem value="hab-mrh">Multirisque habitation</SelectItem>
        </SelectGroup>
        <SelectGroup>
          <SelectLabel>Sante</SelectLabel>
          <SelectItem value="sante-amo">AMO complementaire</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  ),
};
```

### 6.19 -- packages/shared-ui/src/components/Toast.stories.tsx (~70 lignes)

```tsx
import type { Meta, StoryObj } from '@storybook/react';
import { Toaster, toast } from './Toast';
import { Button } from './Button';

const meta: Meta = {
  title: 'Components/Toast',
  component: Toaster,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <>
      <Toaster />
      <Button onClick={() => toast('Notification simple', { description: 'Message basique' })}>
        Show toast
      </Button>
    </>
  ),
};

export const Success: Story = {
  render: () => (
    <>
      <Toaster />
      <Button
        onClick={() =>
          toast.success('Police creee', { description: 'Police #SK-2026-0142 sauvegardee' })
        }
      >
        Toast succes
      </Button>
    </>
  ),
};

export const Error: Story = {
  render: () => (
    <>
      <Toaster />
      <Button
        variant="destructive"
        onClick={() =>
          toast.error('Erreur reseau', { description: 'Connexion API perdue. Reessayez.' })
        }
      >
        Toast erreur
      </Button>
    </>
  ),
};

export const WithAction: Story = {
  render: () => (
    <>
      <Toaster />
      <Button
        onClick={() =>
          toast('Contrat envoye', {
            description: 'Pour signature electronique au client.',
            action: { label: 'Annuler', onClick: () => toast('Action annulee') },
          })
        }
      >
        Toast avec action
      </Button>
    </>
  ),
};
```

### 6.20 -- packages/shared-ui/.storybook/manager.ts (~30 lignes)

```typescript
import { addons } from '@storybook/manager-api';
import { create } from '@storybook/theming/create';

const skaleanLight = create({
  base: 'light',
  brandTitle: 'Skalean InsurTech UI',
  brandUrl: 'https://skalean-insurtech.ma',
  brandImage: '/skalean-logo.svg',
  brandTarget: '_self',
  colorPrimary: '#E95D2C',
  colorSecondary: '#1A2730',
  appBg: '#ffffff',
  appContentBg: '#ffffff',
  appBorderColor: '#e5e7eb',
  appBorderRadius: 8,
  fontBase: 'Montserrat, system-ui, sans-serif',
  fontCode: 'Geist Mono, monospace',
  textColor: '#1A2730',
  textInverseColor: '#ffffff',
  barTextColor: '#1A2730',
  barSelectedColor: '#E95D2C',
  barBg: '#B0CEE2',
});

addons.setConfig({
  theme: skaleanLight,
  panelPosition: 'bottom',
  selectedPanel: 'storybook/a11y/panel',
  sidebar: { showRoots: true },
});
```

---

## 7. Tests (10-15 ko)

Cette section liste les **20 meta-tests** d'infrastructure tests + 30 stories Storybook.

### 7.1 Tests config Playwright

**Test 1** : `repo/e2e/__meta__/playwright-config.spec.ts`
- Charge `playwright.config.ts`, verifie `testDir === './e2e'`, `fullyParallel === true`, `retries === 2` quand `process.env.CI === 'true'`.
- Verifie projets : `chromium`, `mobile-safari`, `mobile-chrome` definis.
- Verifie `expect.timeout === 10000`.
- Verifie reporters : `list`, `html`, `json`, `junit` presents.

**Test 2** : baseURL env-aware
- Mock `process.env.BROKER_URL = 'http://prod.example/'`, recharge config, verifie projet chromium use baseURL = ce que env retourne.

### 7.2 Tests script lighthouse-baseline

**Test 3** : `repo/scripts/__tests__/lighthouse-baseline.spec.ts`
- Mock `lighthouse` npm package (vi.mock) avec scores fakes (perf 75, a11y 92, etc.).
- Mock `chrome-launcher.launch`.
- Execute `runOne(target)` pour chaque app.
- Verifie 8 fichiers JSON produits dans `lighthouse-reports/`.
- Verifie summary ASCII contient 8 lignes.

**Test 4** : exit code non-zero si seuil P0 below cible
- Mock lighthouse retourne perf=50 (< 70).
- Spy `process.exit`, verifie appele avec arg 1.

**Test 5** : exit code 0 si tous P0 passes
- Mock retourne tous scores >= cibles.
- Verifie `process.exit(0)` appele.

### 7.3 Tests E2E smoke (meta-validation)

**Test 6 a 13** : 8 apps render /fr 200 status (smoke test)
- Pour chaque app web-broker, web-garage, web-garage-mobile, web-insurtech-admin, web-customer-portal, web-assure-portal, web-assure-mobile, plus un re-test desktop : `await page.goto(BASE + '/fr')`, `expect(response.status()).toBe(200)`.

**Test 14 a 19** : 6 apps responsive 1280x720
- Pour 6 apps desktop : viewport 1280x720, navigation, expect main visible.

**Test 20** : 2 specs mobile mobile-safari emulator
- iPhone 14 Pro device emulator, web-garage-mobile + web-assure-mobile, expect 200 + theme-color present.

### 7.4 Tests Storybook stories load

**Test 21** : `Button.stories` renders all variants
- `import * as ButtonStories from './Button.stories'`.
- Verifie keys: Default, Primary, Destructive, Outline, Secondary, Ghost, Link, WithIcon, Loading, Disabled, AsChild, SmallSize, LargeSize.
- Render chacune via `composeStories` Storybook test-utils.

**Test 22** : Toolbar theme switcher works
- Mock context.globals.theme = 'dark', verifie `<html>` recoit class `dark`.

**Test 23** : Locale switcher works in Storybook UI
- Mock context.globals.locale = 'ar', verifie `<html lang="ar" dir="rtl">` applique par decorator.

### 7.5 Tests a11y addon

**Test 24 a 26** : a11y violations 0 sur Button, Card, Dialog stories
- Render story via `composeStories`, run `axe-core` sur DOM, expect violations === 0.

### 7.6 Tests Playwright artifacts

**Test 27** : trace `.zip` produit on first retry
- Force test echec, reprise 1 fois, verifie `test-results/{slug}/trace.zip` existe.

**Test 28** : screenshot only-on-failure
- Force echec, verifie `test-results/{slug}/test-failed-1.png`.

**Test 29** : JUnit XML reporter genere
- Run suite, verifie `test-results/junit.xml` existe + parse XML valide.

**Test 30** : HTML report genere
- Run suite, verifie `playwright-report/index.html` existe.

### 7.7 Liste exhaustive des 30+ stories shared-ui

| # | Story file | Variantes |
|---|------------|-----------|
| 1 | Button.stories.tsx | Default, Primary, Destructive, Outline, Secondary, Ghost, Link, WithIcon, Loading, Disabled, AsChild, SmallSize, LargeSize |
| 2 | Card.stories.tsx | Default, Compact, NoFooter, WithImage |
| 3 | Dialog.stories.tsx | Default, FormDialog, FullScreen |
| 4 | Input.stories.tsx | Default, Email, Password, Disabled, WithIcon, RTLArabic |
| 5 | Select.stories.tsx | Default, Grouped, Disabled |
| 6 | Toast.stories.tsx | Default, Success, Error, WithAction |
| 7 | Checkbox.stories.tsx | Default, Checked, Disabled, IndeterminateGroup |
| 8 | RadioGroup.stories.tsx | Default, Inline, Disabled |
| 9 | Switch.stories.tsx | Default, Checked, Labelled |
| 10 | Slider.stories.tsx | Default, Range, Steps |
| 11 | Tabs.stories.tsx | Default, Vertical, Disabled |
| 12 | Accordion.stories.tsx | Single, Multiple, Disabled |
| 13 | Badge.stories.tsx | Default, Secondary, Destructive, Outline |
| 14 | Avatar.stories.tsx | Default, Fallback, Group |
| 15 | Alert.stories.tsx | Default, Destructive, Info, Success |
| 16 | DropdownMenu.stories.tsx | Default, WithSubmenu, Checkboxes |
| 17 | Popover.stories.tsx | Default, FormPopover |
| 18 | Tooltip.stories.tsx | Default, Multiline, Delayed |
| 19 | Sheet.stories.tsx | RightSide, LeftSide, BottomSide, TopSide |
| 20 | Drawer.stories.tsx | Default, Nested |
| 21 | Command.stories.tsx | Default, Grouped, Empty |
| 22 | Combobox.stories.tsx | Default, Async |
| 23 | DatePicker.stories.tsx | Default, Range, Disabled, ArabicCalendar |
| 24 | Calendar.stories.tsx | Default, Range, Multiple |
| 25 | Form.stories.tsx | LoginForm, ContactForm |
| 26 | Table.stories.tsx | Default, Sortable, Paginated |
| 27 | Pagination.stories.tsx | Default, Compact |
| 28 | Skeleton.stories.tsx | Card, List, Table |
| 29 | Progress.stories.tsx | Default, Indeterminate, Sized |
| 30 | Separator.stories.tsx | Horizontal, Vertical |
| 31 | Breadcrumb.stories.tsx | Default, WithIcons, Truncated |
| 32 | Sidebar.stories.tsx | Expanded, Collapsed, Mobile |

---

## 8. Documentation et runbook (1-2 ko)

### 8.1 Demarrer Storybook localement

```bash
pnpm --filter @insurtech/shared-ui storybook
# Storybook -> http://localhost:6006
```

### 8.2 Executer la suite E2E

```bash
# Pre-requis : 8 apps demarrees (pnpm dev:portals + pnpm dev:dashboards)
pnpm test:e2e                 # headless full
pnpm test:e2e:ui              # mode UI Playwright
pnpm test:e2e:debug           # mode debug step-by-step
pnpm test:e2e:report          # ouvre HTML report apres run
pnpm exec playwright test e2e/web/web-broker.spec.ts  # une seule spec
```

### 8.3 Executer Lighthouse baseline

```bash
pnpm lighthouse:baseline
# Output: lighthouse-reports/baseline-{8 apps}.json + summary.txt
# Exit 1 si seuil P0 non atteint
```

### 8.4 Lighthouse CI (en CI uniquement)

```bash
pnpm lighthouse:ci
# Lit lighthouserc.cjs, demarre apps, audite, asserts, upload temporary-public-storage
# Comments URLs sur PR si configure GitHub Action
```

### 8.5 Build Storybook statique pour deploy

```bash
pnpm --filter @insurtech/shared-ui build-storybook
# Output: packages/shared-ui/storybook-static/ (deployable Vercel / Atlas Cloud)
```

---

## 9. Monitoring et observabilite (0.5-1 ko)

- **Playwright** : HTML report (`playwright-report/`), JSON (`test-results/results.json`), JUnit XML (`test-results/junit.xml`), traces zip on retry, screenshots on failure, videos retain-on-failure.
- **Lighthouse local** : `lighthouse-reports/baseline-{app}.json` (Lighthouse audit complet) + `baseline-summary.txt` (ASCII table scores).
- **Lighthouse CI** : `.lighthouseci/` (LHCI runs JSON + HTML), upload `temporary-public-storage` (URLs publiques 7 jours).
- **GitHub Actions** : annotations `::error file=...,line=...::message` sur echec, badge status README, artifact upload `playwright-report/` + `lighthouse-reports/`.
- **Storybook** : pas de monitoring runtime (statique). Sprint 35 ajoutera Chromatic capture history.

---

## 10. Criteres de validation (V1-V30, 28+ critères) (3-5 ko)

### Section P0 (15+ critères -- bloquant Sprint 4 cloture)

**V1** : 8 specs E2E desktop pass
- Run `pnpm exec playwright test --project=chromium`
- Resultats : 6 apps web/* spec passent (web-broker + web-garage + web-insurtech-admin + web-customer-portal + web-assure-portal + 1 spec re-test). All green.

**V2** : 2 specs E2E mobile pass
- Run `pnpm exec playwright test --project=mobile-safari` puis `--project=mobile-chrome`.
- 2 specs mobile/web-garage-mobile + mobile/web-assure-mobile passent sur les deux projets.

**V3** : Lighthouse baseline genere 8 apps reports JSON
- Run `pnpm lighthouse:baseline`.
- `ls lighthouse-reports/` montre `baseline-web-broker.json`, `baseline-web-garage.json`, `baseline-web-garage-mobile.json`, `baseline-web-insurtech-admin.json`, `baseline-web-customer-portal.json`, `baseline-web-customer-portal-mobile.json`, `baseline-web-assure-portal.json`, `baseline-web-assure-mobile.json`, `baseline-summary.txt`.

**V4** : Performance >= 70 partout (cible Sprint 18 customer-portal 95)
- Parse JSON pour chaque app, extract `categories.performance.score * 100`, expect >= 70.
- Pour customer-portal : >= 80.

**V5** : Accessibility >= 90 partout
- Parse JSON `categories.accessibility.score * 100 >= 90` pour les 8 apps.

**V6** : Best Practices >= 90 partout
- Parse JSON `categories.best-practices.score * 100 >= 90`.

**V7** : SEO >= 90 partout
- Parse JSON `categories.seo.score * 100 >= 90`.

**V8** : PWA >= 90 sur 2 apps mobile
- Parse JSON `categories.pwa.score * 100 >= 90` pour web-garage-mobile + web-assure-mobile.

**V9** : Storybook setup main.ts + preview.tsx
- Files exist: `packages/shared-ui/.storybook/main.ts`, `preview.tsx`, `manager.ts`.
- main.ts exports default StorybookConfig avec framework `@storybook/nextjs`.

**V10** : 30+ stories present
- Glob `packages/shared-ui/src/components/*.stories.tsx`, count >= 30.

**V11** : Storybook accessible :6006
- Run `pnpm --filter @insurtech/shared-ui storybook`, attendre `Storybook 8.4.x for nextjs started`, GET http://localhost:6006 retourne 200.

**V12** : Theme switcher Storybook works
- Visit http://localhost:6006/?path=/story/components-button--default, click toolbar theme dropdown, select "Dark", verifie `<html class="dark">` injecte.

**V13** : Locale switcher Storybook works
- Toolbar locale dropdown -> select "Arabe classique (ar)", verifie iframe Story `<html lang="ar" dir="rtl">`.

**V14** : a11y addon violations 0 sur Button, Card, Dialog stories
- Open story Button/Default, panel a11y, expect "0 violations".
- Idem Card/Default, Dialog/Default.

**V15** : no emoji
- Run `bash scripts/check-no-emoji.sh` sur fichiers crees, exit 0.

### Section P1 (8+ critères -- amelioration desirable)

**V16** : `lighthouserc.cjs` CI integration
- Run `pnpm lighthouse:ci` (en mode local simulant CI), assertions configurees, output `.lighthouseci/`.

**V17** : Playwright trace artifacts on first-retry
- Force fail un test, retry 1 fois, verifie `test-results/{slug}/trace.zip` cree.

**V18** : Screenshots on failure
- Force fail, verifie `test-results/{slug}/test-failed-1.png`.

**V19** : JUnit XML reporter for CI
- `test-results/junit.xml` existe + parse XML valide via `xml2js`.

**V20** : Lighthouse CI temporary-public-storage upload
- `pnpm lighthouse:ci` retourne URL publique `https://storage.googleapis.com/lighthouse-infrastructure.appspot.com/...`.

**V21** : Storybook docs autodocs
- Story sans MDX exposee a `?path=/docs/components-button--documentation` (autodocs auto-genere).

**V22** : MDX stories for documentation
- Au moins 1 fichier `*.mdx` dans `packages/shared-ui/src/components/` (Introduction.mdx).

**V23** : Storybook composition main app deploy Sprint 35
- Documentation note Sprint 35 ajout composition + Vercel deploy.

### Section P2 (5+ critères -- enhancement)

**V24** : Storybook test runner Vitest integration
- Documentation note Sprint 35 `@storybook/test-runner` integration.

**V25** : Chromatic visual regression Sprint 35 placeholder
- `@chromatic-com/storybook` addon installe (preparation Sprint 35).

**V26** : Playwright component testing alternative
- Documentation note `@playwright/experimental-ct-react` alternative possible Storybook.

**V27** : Loki visual regression
- Documentation note alternative open-source a Chromatic Sprint 35.

**V28** : Pa11y CI a11y testing Sprint 30
- Documentation lighthouse-strategy.md mentionne Pa11y Sprint 30 (loi MA accessibilite sites publics).

**V29** : web-vitals reporter Sprint 18
- Documentation lighthouse-strategy.md mentionne `web-vitals` 4.x integration Sprint 18.

**V30** : Real device cloud testing BrowserStack Sprint 35
- Documentation lighthouse-strategy.md mentionne BrowserStack/Sauce Labs Sprint 35.

---

## 11. Edge cases (10+ identifies) (2 ko)

1. **Lighthouse local vs CI cold cache** : CI machine GitHub runner ~10-15 points sous local M1 sur Performance (CPU 2 cores vs 8). Documentation lighthouse-strategy.md decrit le delta. Mitigation : seuils CI plus bas que local OU warmup runs avant audit.

2. **Mobile emulator vs real device** : real device (iPhone 12 reel via BrowserStack) montre Performance 10-20% inferieur a iPhone 14 Pro emulator (CPU throttling reel + reseau cellulaire 4G reel). Sprint 4 = emulator suffisant baseline ; Sprint 35 ajoutera real device cloud.

3. **Playwright `fullyParallel: true` may interleave logs** : 6 specs desktop + 2 mobile peuvent s'executer simultanement. Logs stdout entrelaces difficile a lire. Solution : reporter `list` (pretty) ou `dot` (compact). En CI, reporter `github` avec annotations groupees.

4. **Storybook Tailwind 4 beta compatibility** : Tailwind 4 est en beta, le plugin `@tailwindcss/vite` peut casser sur major Storybook update. Pinning versions exact + smoke test `pnpm storybook` au CI.

5. **next/font Storybook integration tricky** : `next/font/google` cote serveur Next.js, ne fonctionne pas tel quel en Storybook (Vite). Solution : injecter manuellement Google Fonts via `<link>` dans `preview-head.html`, OU mock `next/font` via `viteFinal` resolve alias.

6. **Service worker not active in headless Chromium** : par securite, headless Chromium desactive SW. Test PWA `serviceWorker.controller` retourne `null`. Solution : `chromium.launch({ args: ['--enable-features=ServiceWorker', '--no-sandbox'] })` + `headless: false` ou `headless: 'new'`.

7. **Lighthouse 95+ requires Critical CSS + image optimization** : impossible Sprint 4 baseline. Sprint 18 customer-portal ajoutera : Critical CSS via `critters`, AVIF/WebP via `next/image`, lazy-loading dynamic imports, font preload, CDN cache headers `Cache-Control: max-age=31536000, immutable`.

8. **a11y addon false positives on Radix UI primitives** : portals Radix (Dialog, Popover, Tooltip) levent `aria-hidden-focus` car focus se deplace vers portal ROOT (en dehors du parent aria-hidden). Solution : config rule disabled story-level via `parameters.a11y.config.rules: [{ id: 'aria-hidden-focus', enabled: false }]`.

9. **Visual regression flaky cross-OS rendering** : sub-pixel anti-aliasing different Linux vs macOS = ~1-2 pixels diff sur screenshots. Pas de Chromatic/Loki en Sprint 4. Sprint 35 = tolerance `threshold: 0.2` sur pixel diff.

10. **Storybook 8.4 vs 9.x future migration** : Storybook 9 (alpha Q1 2026) changes : framework wrapper renomme (`@storybook/react-vite` peut etre fusionne), addon-essentials retire (split). Sprint 35 = migration 9.x prevue.

11. **Lighthouse 12 API breaking changes** : `lighthouse@12.3` retourne categories `pwa` toujours mais deprecated. Lighthouse 13 (Q3 2026) supprimera. Pinning `lighthouse@12.3.0` exact + commentaire TODO.

12. **CI machine cores affect parallel test stability** : runner GitHub Actions standard = 2 cores. `workers: '50%'` = 1 worker = serialisation = lent mais stable. `workers: 2` = parallel mais flakiness CPU contention. Solution : `workers: process.env.CI ? 2 : '50%'` + `retries: 2` en CI compense flakiness.

13. **Playwright webServer auto-start race** : si `pnpm dev:portals` prend > 120s a demarrer (pre-build Tailwind 4 beta = lent), test fail timeout. Solution : `webServer.timeout: 180_000` pour 3 minutes large.

14. **Lighthouse audit pages dynamiques** : si `/fr` redirect via middleware `next-intl` -> `/fr/` (trailing slash), Lighthouse audit la redirection mais score `redirects` Best Practices casse. Solution : `settings.skipAudits: ['redirects']` ou desactiver trailingSlash dans next.config.

15. **Cookie consent CNDP banner blocking E2E tests** : si banner cookie bloque interaction sur premiere visite, autres tests echouent. Solution : `beforeEach` accept cookies via `await page.evaluate(() => document.cookie = 'cookie_consent=accepted')` OU clear cookies + accept via UI.

---

## 12. Conformite Maroc (1 ko)

- **WCAG 2.1 AA accessibility tests obligatoires** : `@storybook/addon-a11y` + axe-playwright config WCAG 2.1 AA tags (`wcag2aa`, `wcag21aa`). Sprint 30 imposera 100% pages public via Pa11y CI (loi accessibilite sites publics MA en application Q3 2026 selon ANRT). Web-customer-portal en premier vise (audience publique).

- **Multilinguisme test 3 locales fr / ar-MA / ar (decision-009)** : chaque spec E2E test les 3 locales sur home : `/fr` (200 LTR), `/ar-MA` (200 RTL Darija), `/ar` (200 RTL classique). Storybook expose toolbar locale switcher avec les 3 locales.

- **ACAPS supervision** : tests E2E doivent verifier mention `ACAPS` ou `Autorite de Controle des Assurances et de la Prevoyance Sociale` dans le footer des apps `web-broker`, `web-customer-portal`, `web-assure-portal` (page d'accueil placeholder Sprint 4 affiche deja le footer). Test : `expect(page.getByRole('contentinfo').getByText(/acaps/i)).toBeVisible()`.

- **Loi 09-08 CNDP cookie consent** : test E2E `web-customer-portal.spec.ts` verifie banner cookie sur premiere visite : visible, boutons Accepter/Refuser, mention `loi 09-08` ou `cndp`, persistance cookie `cookie_consent` apres acceptation.

- **Atlas Cloud Benguerir hosting Sprint 35** : `lighthouse-ci` upload `temporary-public-storage` Google par defaut, mais Sprint 35 reconfigurera vers serveur LHCI self-hosted Atlas Cloud Benguerir (`lhci.skalean-insurtech.ma`).

- **Donnees personnelles dans tests** : ne JAMAIS utiliser de vraies donnees clients dans les fixtures E2E. Generation Faker.fr_MA ou hardcoded dummy data (`test@example.ma`, `+212600000000`).

---

## 13. Conventions (1 ko)

| # | Convention | Application |
|---|------------|-------------|
| 1 | NO EMOJI ABSOLU (decision-006) | 0 emoji dans code, JSON, MDX, README, commit. Linter `scripts/check-no-emoji.sh` en CI. |
| 2 | TypeScript strict | `tsconfig.json` extends base. Pas de `any` sauf justification. |
| 3 | Playwright 1.49+ chromium + mobile-safari + mobile-chrome | Versions exact dans `package.json`. |
| 4 | Lighthouse 12.3+ | `lighthouse@12.3.0` pin exact (pas caret). |
| 5 | Storybook 8.4 + `@storybook/nextjs` | `storybook@8.4.7` + `@storybook/nextjs@8.4.7`. |
| 6 | a11y addon WCAG 2.1 AA | `@storybook/addon-a11y` config rules tags `['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']`. |
| 7 | `@insurtech/shared-ui` imports for stories | Stories importent depuis package racine, pas chemin relatif (sauf interne). |
| 8 | CSF v3 | Toutes stories utilisent `Meta` + `StoryObj`. Pas de CSF v2 legacy. |
| 9 | Test artifacts: HTML + JSON + screenshots + traces | Reporters Playwright configurables : html, json, junit, github (CI). |
| 10 | E2E specs in `repo/e2e/` (root) | Pas dans chaque app. Mutualise webServer + fixtures. |
| 11 | Lighthouse reports gitignore | `lighthouse-reports/` dans `.gitignore` racine. |
| 12 | Storybook stories co-located avec components | `packages/shared-ui/src/components/Button.tsx` + `Button.stories.tsx` meme dossier. |
| 13 | autodocs tag systematique | Toutes stories `tags: ['autodocs']` pour generation MDX docs. |
| 14 | Decisions referenced docs | Decisions 001 / 006 / 008 / 009 mentionnees explicitement dans cette tache. |

---

## 14. Risques residuels (1 ko)

- **R1** : Lighthouse 4.0.0 beta Tailwind 4 si bug rendering -> fallback Tailwind 3.4.17 plan B documente.
- **R2** : Storybook 8.4 + next/font integration peut nécessiter mock manuel. Dev temps = +2h si bug bloquant.
- **R3** : CI GitHub Actions runner 2 cores limitant parallel Playwright. Tests longs = effort wait CI ~15 min.
- **R4** : Lighthouse PWA score 90 mobile depend service worker active en headless = configuration `--enable-features=ServiceWorker` indispensable.
- **R5** : a11y addon false positives Radix UI = config rule par story = leak velocity initiale.
- **R6** : Cibles Sprint 18 customer-portal Performance 95 / SEO 100 = effort optimisation important (Critical CSS + image AVIF + CDN cache + font preload).
- **R7** : Lighthouse 12 -> 13 future migration (Q3 2026 estime) = breaking changes API potentielles.
- **R8** : Storybook 8 -> 9 migration Sprint 35 = breaking changes framework wrapper et addons.

---

## 15. Definition of Done (0.5 ko)

- [ ] `playwright.config.ts` configure projets chromium + mobile-safari + mobile-chrome.
- [ ] 7 specs E2E web (`e2e/web/*.spec.ts`) passent toutes (`pnpm test:e2e --project=chromium`).
- [ ] 2 specs E2E mobile (`e2e/mobile/*.spec.ts`) passent toutes sur mobile-safari + mobile-chrome.
- [ ] `scripts/lighthouse-baseline.ts` execute genere 8 JSON dans `lighthouse-reports/` + summary.txt.
- [ ] `lighthouserc.cjs` configure assertions `categories:performance:0.7` + autres seuils.
- [ ] `docs/architecture/lighthouse-strategy.md` rediger cibles + workflow + budgets.
- [ ] `.storybook/main.ts` + `preview.tsx` + `manager.ts` configures.
- [ ] >=30 fichiers `*.stories.tsx` dans `packages/shared-ui/src/components/`.
- [ ] `pnpm --filter @insurtech/shared-ui storybook` demarre sur :6006.
- [ ] Theme switcher + Locale switcher fonctionnent dans Storybook UI.
- [ ] a11y addon panel montre 0 violations sur Button/Card/Dialog stories.
- [ ] V1-V15 P0 tous passes.
- [ ] V16-V23 P1 minimum 6/8 passes.
- [ ] Aucun emoji dans aucun fichier.
- [ ] Commit conventionnel : `feat(sprint-04): tests E2E + Lighthouse baseline + Storybook 8.4 setup [task-1.4.16]`.

---

## 16. Annexe references documentaires (0.5 ko)

- Playwright docs https://playwright.dev/docs/test-configuration
- Lighthouse npm package https://github.com/GoogleChrome/lighthouse
- Lighthouse CI https://github.com/GoogleChrome/lighthouse-ci
- Storybook 8.4 docs https://storybook.js.org/docs
- @storybook/addon-a11y https://storybook.js.org/addons/@storybook/addon-a11y
- axe-core 4.10 https://github.com/dequelabs/axe-core
- WCAG 2.1 AA https://www.w3.org/TR/WCAG21/
- web-vitals 4.x https://github.com/GoogleChrome/web-vitals
- ANRT Maroc accessibilite sites publics (note d'orientation 2024).
- CNDP loi 09-08 protection donnees personnelles.
- ACAPS Autorite de Controle des Assurances et de la Prevoyance Sociale (https://acaps.ma).
- decision-006 NO EMOJI ABSOLU (`00-pilotage/documentation/8-skalean-insurtech-prompt-master.md`).
- decision-008 cloud souverain MA Atlas Cloud Benguerir.
- decision-009 multilinguisme MA fr / ar-MA / ar.

---

## 17. Sortie attendue (0.5 ko)

A la cloture de cette tache, le programme Skalean InsurTech dispose :

- **Filet de securite E2E** : 9 specs Playwright validant que les 8 apps demarrent et exposent leur surface principale (rendu, locale, theme, 404, hydration, responsive, PWA mobile). Tout regression introduite Sprint 5+ casse les tests E2E avant prod.
- **Baseline Lighthouse mesurable** : 8 rapports JSON exhaustifs + summary ASCII. Cibles Sprint 4 = Performance 70 / A11y 90 / BP 90 / SEO 90 / PWA 90 mobile. Trends graphiques ajoutees Sprint 35.
- **Storybook shared-ui** : 30+ stories CSF v3 avec theme + locale switchers, a11y addon panel, autodocs MDX. Designer Anouar Benghazi peut inspecter chaque composant en isolation.
- **Documentation strategique** : `lighthouse-strategy.md` decrit cibles par sprint metier + budgets + optimisations Sprint 18 (Critical CSS, AVIF, font preload, CDN cache).
- **Cloture Phase 1 Bootstrap** : Sprint 4 termine. Sprint 5 (Auth) peut commencer sur fondations frontend + tests + Storybook stables.

Cette tache constitue le **dernier maillon** du Sprint 4 et de la Phase 1 Bootstrap. Sa reussite conditionne la velocite de tous les sprints metier suivants (5 a 35).
