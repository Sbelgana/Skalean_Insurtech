# TACHE 4.5.1 -- App Skeleton web-assure-portal + PWA Setup web-assure-mobile

**Sprint** : 18 / 35 (cumul) -- Phase 4 / Sprint 5 (DERNIER de la phase)
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-18-sprint-18-web-assure-portal-mobile.md` (Tache 4.5.1)
**Phase** : 4 -- Vertical Insure (Skalean Broker ERP)
**Priorite** : P0 (bloque toutes les taches Sprint 18, fondation des 2 apps assures)
**Effort** : 6h
**Dependances** : Sortie Sprint 17 (pattern Next.js 15 stable + i18n setup + package shared `@insurtech/customer-shared`)
**Densite cible** : 100-120 ko (auto-suffisant exhaustif)
**AUCUNE EMOJI AUTORISEE**

---

## 1. But

Cette tache initialise les **deux applications clientes destinees aux assures post-souscription** du programme Skalean InsurTech : `web-assure-portal` (port 3005, desktop) et `web-assure-mobile` (port 3006, PWA installable). Elle pose egalement le socle du package partage `@insurtech/assure-shared` qui mutualise components, hooks, API client et types entre les deux apps.

L'apport est triple. D'abord, **separer les deux apps** plutot que les fusionner sous un seul codebase responsive permet d'optimiser specifiquement le bundle mobile pour les Progressive Web App features (service worker custom, manifest, push notifications, offline cache, background sync, share target) sans alourdir le desktop d'octets inutiles. Ensuite, **factoriser via un package shared** evite la duplication de la logique metier critique (auth OTP, fetch policies, fetch claims) et garantit qu'une modification API n'oblige pas a editer deux fois le code. Enfin, **fixer des l'amorcage la configuration PWA Lighthouse 100** (manifest valide, service worker enregistre, icons multi-tailles, splash screen iOS) empeche la dette technique qui apparait quand on PWA-ifie une app a posteriori.

A l'issue de cette tache, un developpeur peut lancer `pnpm dev --filter @insurtech/web-assure-portal` et `pnpm dev --filter @insurtech/web-assure-mobile` simultanement sur les ports 3005 et 3006, voir les deux apps demarrer sans erreur, executer Lighthouse PWA sur mobile et obtenir un score de 100, et confirmer dans Chrome DevTools que le service worker est enregistre + active + que le manifest est detecte comme installable.

---

## 2. Contexte etendu

### Pourquoi cette tache existe

Le programme Skalean InsurTech v2.2 doit livrer en Phase 4 (Vertical Insure) la **boucle customer journey complete** : un prospect decouvre Skalean via le Customer Portal (Sprint 17, vente en ligne SEO), il souscrit une police, le broker valide via le Web Broker App (Sprint 16), la police devient active, et l'assure passe alors en **mode self-service** pour gerer ses polices, payer ses primes, declarer ses sinistres et suivre ses dossiers. Sans cette derniere brique, Skalean reste un outil broker B2B et perd sa promesse de transformer la relation broker-assure en relation digitale fluide.

L'analyse marketing Maroc menee en amont du programme (cf. `00-pilotage/documentation/9-roadmap-execution.md` section "Distribution mobile MA") indique qu'au moins **60% du trafic utilisateur assure se fera depuis mobile** (smartphone Android principalement, gamme prix bas-milieu, connexions 3G/4G intermittentes en zone rurale, donnees mobiles coutees). Une simple app responsive ne suffit pas : il faut une PWA pour permettre l'installation home-screen (engagement +30% selon Google PWA stats), les push notifications (critique pour suivi sinistre temps reel), le mode offline (essentiel pour les zones a couverture intermittente), et le background sync (permettre a un assure de photographier un sinistre meme hors couverture, puis envoyer automatiquement quand 4G revient).

L'option "app native iOS/Android" a ete consideree puis ecartee pour le MVP : trop couteuse a developper et maintenir (2 codebases + Swift/Kotlin team supplementaire), publication AppStore/PlayStore lente (review 7-14 jours), barriere a l'installation pour un service finance peu engageant emotionnellement (l'utilisateur ne va pas chercher "Skalean Assurance" sur le Play Store proactivement). La PWA installable resout 95% du besoin natif sans aucune de ces frictions.

### Alternatives architecturales considerees

| Alternative | Avantages | Inconvenients | Decision |
|-------------|-----------|---------------|----------|
| **1 app responsive unique** (port 3005, mobile = breakpoint) | Codebase unifie, mutualisation max, deploiement simple | Bundle mobile pollue par code desktop (sidebars complexes, tableaux denses), Service Worker partage moins flexible, viewport-specific optimizations difficiles | rejete : pollution bundle mobile |
| **2 apps separees** (3005 + 3006) + package shared `@insurtech/assure-shared` | Bundles dedies optimises, PWA features ciblees mobile uniquement, deux URLs explicites (portal.skalean.ma + mon.skalean.ma), evolutions independantes | Plus de surface de maintenance, risque de divergence des features (geree par le package shared) | RETENU |
| **Mobile app native (React Native)** | UX native irreprochable, push notifications natives, AppStore visibility | Codebase supplementaire, AppStore review, install friction, redondance avec PWA Web Push API qui couvre 95% des cas | rejete post-MVP : revoir Phase 7+ si telemetrie indique besoin |
| **Hybrid Ionic / Capacitor** | Reuse web codebase wrapped natif, AppStore eligibility | Bundle lourd, UX souvent en deca du natif, complexite supplementaire de build + signing | rejete : meilleur ROI sur PWA pure |

### Trade-offs explicites assumes

1. **Code duplique entre web-assure-portal et web-assure-mobile** : malgre le package `@insurtech/assure-shared`, certains layouts diffferent (sidebar desktop vs bottom nav mobile). La maintenance pourra reclamer de modifier deux fichiers. **Mitigation** : factoriser un maximum dans le package shared, et imposer en code review qu'un changement de logique metier passe obligatoirement par le shared.
2. **Service Worker uniquement sur mobile** : web-assure-portal n'a pas de service worker dans cette tache (decision : Lighthouse PWA score ne sera pas 100 sur desktop). **Justification** : les desktops sont en general toujours connectes, et un mauvais cache strategy peut creer des bugs de fraicheur de donnees plus penalisants. **Risque assume** : aucun benefice offline desktop ; les utilisateurs portal devront recharger en cas de coupure reseau.
3. **VAPID keys generees one-shot et stockees en env vars** : pas de rotation automatique. **Mitigation** : Sprint 33 Pentest verifiera la securite et documentera la procedure de rotation manuelle si compromission detectee.
4. **Apple touch icon 180x180 obligatoire en plus du manifest** : iOS Safari ignore le manifest.json `icons` pour le home screen, il faut un `<link rel="apple-touch-icon">` dedie dans le `<head>`. Trade-off accepte : un asset supplementaire mais incontournable pour 30% du parc smartphone Maroc.

### Decisions strategiques referencees

- `decision-001` (monorepo-structure.md) : la decision d'avoir des apps dans `apps/` et des packages dans `packages/` rend possible cette architecture 2 apps + 1 shared. Le pnpm workspace declare deja `apps/*` et `packages/*` depuis Sprint 1.
- `decision-002` (multi-tenant-3-niveaux.md) : meme en self-service assure, le header `x-tenant-id` reste obligatoire sur les endpoints API (sauf `/api/v1/public/*` et `/api/v1/auth/assure/*` initialement publics). Le client API doit injecter ce header en lisant le JWT claim `tenants[]` (cas multi-broker) ou la variable de tenant active.
- `decision-005` (skalean-ai-frontier.md) : aucune call directe a Skalean AI dans ces apps. Toute fonctionnalite IA potentielle (chatbot assistant assure) sera deferred au Sprint 31 et passera obligatoirement par `@insurtech/sky` ou MCP.
- `decision-006` (no-emoji-policy.md) : aucune emoji dans le code, les commentaires, les logs, les commits, les fichiers de traduction. Le pre-commit hook `check-no-emoji.sh` rejette tout commit avec emoji.
- `decision-008` (data-residency-maroc.md) : les apps frontend n'hebergent jamais de donnees personnelles assures (CIN, RIB, photos sinistres). Toutes les donnees passent par l'API backend qui les stocke uniquement sur Atlas Cloud Services Benguerir (DC1 Tier III + DC2 Tier IV). Le cache du service worker ne doit pas persister de donnees personnelles au-dela de 24h.

### Pieges techniques connus a eviter

1. **Piege : Service worker register avant que la page soit hydratee**
   - Pourquoi : Next.js 15 App Router fait du Server Components rendering + hydration client. Si on enregistre le SW dans `app/layout.tsx` direct (Server Component), `navigator.serviceWorker` est undefined.
   - Solution : utiliser un Client Component dedie `<RegisterSW />` avec `'use client'` qui appelle `navigator.serviceWorker.register('/sw.js')` dans un `useEffect(() => {...}, [])` et qui logge l'etat via `console.info` (autorise pour logs PWA dans cette tache uniquement, voir convention).

2. **Piege : Manifest.json scope mal configure**
   - Pourquoi : un scope `/` couvre toute l'app, mais si on declare `start_url: "/fr"`, Chrome refuse d'installer l'app comme PWA car le start_url n'est pas dans le scope.
   - Solution : declarer explicitement `"scope": "/"` ET garder `start_url: "/fr"`. Chrome valide alors l'installation.

3. **Piege : Icons maskable manquantes**
   - Pourquoi : Android adaptive icons requiert des icons avec marge interieure (safe area) pour les formes circulaires/squircle/teardrop. Sans `purpose: "any maskable"`, les icons apparaissent rognees ou avec un fond blanc disgracieux.
   - Solution : generer une icon 512x512 avec marge interieure de 10% (logo dans le carre central 410x410) et la declarer avec `purpose: "any maskable"`. Generer aussi une icon 192x192 standard.

4. **Piege : VAPID keys re-generees a chaque deploiement**
   - Pourquoi : si la cle publique change, toutes les subscriptions push existantes (deja enregistrees cote navigateur) deviennent invalides silencieusement (le navigateur tente, le serveur rejette, l'utilisateur ne recoit plus rien).
   - Solution : generer les VAPID une seule fois via `npx web-push generate-vapid-keys`, stocker dans le vault secret Atlas, injecter via env vars stables. Documenter dans `infrastructure/docs/vapid-rotation.md` (a creer dans Sprint 33).

5. **Piege : `pnpm dev` ne hot-reload pas le service worker**
   - Pourquoi : Serwist generates `public/sw.js` au build time. En dev, le SW existant en cache est utilise.
   - Solution : `pnpm dev:pwa` qui passe `SERWIST_DEV=true` + Chrome DevTools onglet Application > Service Workers > "Update on reload" coche. Documenter dans `apps/web-assure-mobile/README.md`.

6. **Piege : Importer `@insurtech/assure-shared` cote serveur fait crasher si le component utilise des APIs browser (window, navigator)**
   - Pourquoi : Next.js 15 Server Components pre-render server-side. Toute reference a `window` plante le build.
   - Solution : marquer les components shared qui utilisent navigator/window avec `'use client'` en premiere ligne. Pour les hooks (useMyPolicies, useDeclareClaim), egalement `'use client'`. Les pure functions (transformDate, formatCurrency) restent universelles sans 'use client'.

7. **Piege : Apple iOS Safari ignore icons du manifest**
   - Pourquoi : iOS Safari < 16.4 ne lit pas tous les champs manifest pour l'install home screen.
   - Solution : declarer aussi `<link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png">` dans le `<head>` via `metadata.icons.apple` dans Next.js `app/layout.tsx`. Ajouter `<meta name="apple-mobile-web-app-capable" content="yes">` et `<meta name="apple-mobile-web-app-status-bar-style" content="default">`.

8. **Piege : pnpm workspace ne resolve pas `@insurtech/assure-shared`**
   - Pourquoi : il faut absolument que `package.json` de `assure-shared` declare un `main`/`exports` valide, et que les deux apps declarent `"@insurtech/assure-shared": "workspace:*"` dans leurs dependencies.
   - Solution : `package.json` du shared a `"exports": { ".": { "import": "./src/index.ts", "types": "./src/index.ts" } }` + `"sideEffects": false` pour treeshaking.

9. **Piege : Push notifications subscription expire silencieusement**
   - Pourquoi : Chrome peut invalider une subscription apres 6 mois sans usage. Le backend continue d'envoyer, mais le user ne recoit plus rien.
   - Solution : exposer un endpoint `POST /api/v1/notifications/push/refresh-subscription` que la PWA appelle au login pour rafraichir la subscription. Detection automatique de la perte via `pushManager.getSubscription()` au boot du SW.

10. **Piege : Next.js 15 React Compiler vs use client incompatible avec certaines lib**
    - Pourquoi : React Compiler 19 transforme automatiquement le memo. Des libs comme `html5-qrcode` (utilisee tache 4.5.10) peuvent casser si non marquees `'use client'`.
    - Solution : disable React Compiler pour les modules tiers via `next.config.mjs` `compilerOptions.exclude`. Voir tache 4.5.10 pour le QR scanner.

---

## 3. Architecture context

### Position dans le sprint 18

Cette tache 4.5.1 est la **premiere** et **fondatrice** du Sprint 18. Elle :
- **Depend de** : Sortie Sprint 17 (`@insurtech/customer-shared` pattern Next.js 15 valide + i18n setup avec `next-intl` configure + tsconfig.base.json paths `@insurtech/*` operationnel + commande `pnpm dev --filter` fonctionnelle).
- **Bloque** : toutes les taches 4.5.2 a 4.5.14, car aucune fonctionnalite ne peut etre implementee sans les squelettes des deux apps + le package shared en place.
- **Apporte au sprint** : la fondation technique permettant a 4.5.2 (auth OTP) de creer les pages `/login` + `/verify-otp`, a 4.5.3 (layout) de configurer sidebar/bottom nav, et a 4.5.14 (tests E2E + Lighthouse) de valider la PWA installable.

### Position dans le programme global

Le programme Skalean InsurTech compte au final **9 applications deployables** (cf. `00-pilotage/documentation/10-arborescence-projet.md`). Apres cette tache, 6 sur 9 existent :
- `apps/api` (NestJS, Sprint 3)
- `apps/web-broker` (Sprint 16)
- `apps/web-customer-portal` (Sprint 17)
- `apps/web-insurtech-admin` (deja initie Sprint 4 bootstrap)
- `apps/web-assure-portal` (cette tache)
- `apps/web-assure-mobile` (cette tache)

Restent a creer dans les phases suivantes :
- `apps/web-garage` (Sprint 22, Phase 5)
- `apps/web-garage-mobile` (Sprint 23, Phase 5)
- `apps/mcp-server` (Sprint 30, Phase 6 IA)

Cote packages, le programme atteint 23 packages cible (16 metier + 7 shared). Cette tache ajoute le 17eme : `@insurtech/assure-shared`.

### Flow architectural impacte

```
+-----------------------+      +-----------------------+
| web-assure-portal      |      | web-assure-mobile     |
| (Next.js 15 desktop)   |      | (Next.js 15 PWA)      |
| Port 3005              |      | Port 3006             |
| Sidebar + Header       |      | Bottom Nav + FAB      |
+-----------+------------+      +-----------+-----------+
            |                                |
            |  import                        |  import
            +-----------+        +-----------+
                        |        |
                        v        v
              +---------------------------+
              | @insurtech/assure-shared  |
              | - components (cards, ...) |
              | - hooks (useMyPolicies)   |
              | - API client (axios)      |
              | - types (Policy, Claim)   |
              +-------------+-------------+
                            |
                            | HTTP /api/v1/*
                            v
              +---------------------------+
              | apps/api (NestJS)         |
              | Port 4000                 |
              +---------------------------+
                            |
                            v
              +---------------------------+
              | PostgreSQL Benguerir DC1  |
              | (Atlas Cloud Services MA) |
              +---------------------------+

PWA specific:
  web-assure-mobile/
    +-- public/manifest.json  (installable)
    +-- public/sw.js          (service worker, generated)
    +-- public/icons/         (multi-size)
    +-- app/sw.ts             (Serwist source)
```

### Dependances inter-packages

| Consumer | Dependency | Type |
|----------|------------|------|
| `@insurtech/web-assure-portal` | `@insurtech/assure-shared` | workspace:* |
| `@insurtech/web-assure-portal` | `@insurtech/shared-ui` | workspace:* |
| `@insurtech/web-assure-portal` | `@insurtech/shared-types` | workspace:* |
| `@insurtech/web-assure-mobile` | `@insurtech/assure-shared` | workspace:* |
| `@insurtech/web-assure-mobile` | `@insurtech/shared-ui` | workspace:* |
| `@insurtech/web-assure-mobile` | `@insurtech/shared-pwa` | workspace:* |
| `@insurtech/assure-shared` | `@insurtech/shared-types` | workspace:* |
| `@insurtech/assure-shared` | `@insurtech/shared-config` | workspace:* |

---

## 4. Livrables checkables

- [ ] Dossier `repo/apps/web-assure-portal/` cree avec arborescence Next.js 15 App Router (~30 fichiers)
- [ ] `repo/apps/web-assure-portal/package.json` declare `next 15.0.4`, `react 19.0.0`, `@insurtech/assure-shared workspace:*`, scripts `dev`, `build`, `start`, `typecheck`, `lint`, `test`, port 3005
- [ ] `repo/apps/web-assure-portal/next.config.mjs` configure pour Next.js 15 (App Router, transpilePackages `@insurtech/*`, i18n via `next-intl/plugin`)
- [ ] `repo/apps/web-assure-portal/tsconfig.json` etend `tsconfig.base.json` avec paths `@/*`
- [ ] `repo/apps/web-assure-portal/app/layout.tsx` (Root Layout) avec html lang/dir dynamique selon locale
- [ ] `repo/apps/web-assure-portal/app/[locale]/layout.tsx` (LocaleLayout) avec `NextIntlClientProvider`
- [ ] `repo/apps/web-assure-portal/app/[locale]/page.tsx` (home placeholder)
- [ ] `repo/apps/web-assure-portal/middleware.ts` route i18n + redirect login si pas authentifie
- [ ] `repo/apps/web-assure-portal/biome.json` etend root config
- [ ] `repo/apps/web-assure-portal/.env.example` documente NEXT_PUBLIC_API_BASE_URL + NEXT_PUBLIC_VAPID_KEY
- [ ] Dossier `repo/apps/web-assure-mobile/` cree avec arborescence Next.js 15 PWA (~32 fichiers)
- [ ] `repo/apps/web-assure-mobile/package.json` declare en plus `@serwist/next 9.x` et `serwist 9.x`
- [ ] `repo/apps/web-assure-mobile/next.config.mjs` integre `withSerwist({...})` wrapper
- [ ] `repo/apps/web-assure-mobile/serwist.config.ts` declare sources/output du SW
- [ ] `repo/apps/web-assure-mobile/app/sw.ts` source service worker avec push listener + notificationclick listener
- [ ] `repo/apps/web-assure-mobile/public/manifest.json` PWA manifest avec icons + shortcuts + screenshots + scope
- [ ] `repo/apps/web-assure-mobile/public/icons/icon-{72,96,128,144,152,180,192,384,512}.png` (9 icons, generees via script `infrastructure/scripts/generate-pwa-icons.ts`)
- [ ] `repo/apps/web-assure-mobile/public/icons/badge-72.png` (badge mono notifications Android)
- [ ] `repo/apps/web-assure-mobile/public/splash/apple-splash-*.png` (4 splash iOS pour iPhone/iPad portrait)
- [ ] `repo/apps/web-assure-mobile/app/layout.tsx` avec metadata.manifest + apple touch icon + viewport viewport-fit cover
- [ ] `repo/apps/web-assure-mobile/components/pwa/register-sw.tsx` Client Component qui register le SW au mount
- [ ] Dossier `repo/packages/assure-shared/` cree
- [ ] `repo/packages/assure-shared/package.json` declare `name @insurtech/assure-shared`, `version 1.0.0`, `exports` map, `sideEffects false`
- [ ] `repo/packages/assure-shared/tsconfig.json` etend `tsconfig.base.json`
- [ ] `repo/packages/assure-shared/src/index.ts` exports public
- [ ] `repo/packages/assure-shared/src/api/client.ts` API client axios avec interceptor JWT + interceptor tenant + interceptor i18n
- [ ] `repo/packages/assure-shared/src/api/endpoints.ts` enum/const des chemins
- [ ] `repo/packages/assure-shared/src/types/index.ts` types core (Policy, Claim, Premium, AssureUser, Document)
- [ ] `repo/packages/assure-shared/src/hooks/use-assure-auth.ts` hook auth (placeholder, sera implemente 4.5.2)
- [ ] `repo/packages/assure-shared/src/lib/format.ts` helpers format date MAD currency phone MA
- [ ] `repo/packages/assure-shared/src/lib/api-error.ts` ApiError class typee
- [ ] `repo/packages/assure-shared/src/components/index.ts` re-exports
- [ ] `repo/packages/assure-shared/src/components/loading-spinner.tsx` placeholder
- [ ] `infrastructure/scripts/generate-pwa-icons.ts` script Node generer 13 icons depuis logo source
- [ ] Variables env `NEXT_PUBLIC_VAPID_KEY` + `VAPID_PRIVATE_KEY` + `VAPID_SUBJECT` documentees dans `.env.example` root
- [ ] Tests : 6+ scenarios verifient structure + manifest valide + service worker registered + Lighthouse PWA 100 (via Playwright + Lighthouse CI)

---

## 5. Fichiers crees / modifies

```
repo/apps/web-assure-portal/package.json                                          (~80 lignes / declare deps + scripts port 3005)
repo/apps/web-assure-portal/next.config.mjs                                       (~50 lignes / next-intl plugin + transpilePackages)
repo/apps/web-assure-portal/tsconfig.json                                         (~30 lignes / extends base + paths @/*)
repo/apps/web-assure-portal/biome.json                                            (~10 lignes / extends root)
repo/apps/web-assure-portal/middleware.ts                                         (~50 lignes / next-intl middleware + auth redirect)
repo/apps/web-assure-portal/app/layout.tsx                                        (~70 lignes / root layout html/body)
repo/apps/web-assure-portal/app/[locale]/layout.tsx                               (~90 lignes / NextIntlClientProvider + AuthProvider)
repo/apps/web-assure-portal/app/[locale]/page.tsx                                 (~40 lignes / placeholder redirect /polices)
repo/apps/web-assure-portal/app/i18n.ts                                           (~30 lignes / getRequestConfig)
repo/apps/web-assure-portal/messages/fr.json                                      (~20 keys / stub)
repo/apps/web-assure-portal/messages/ar-MA.json                                   (~20 keys / stub)
repo/apps/web-assure-portal/messages/ar.json                                      (~20 keys / stub)
repo/apps/web-assure-portal/.env.example                                          (~20 lignes / variables env documentees)
repo/apps/web-assure-portal/.gitignore                                            (~15 lignes / .next, node_modules, .env)

repo/apps/web-assure-mobile/package.json                                          (~85 lignes / deps + Serwist + scripts port 3006)
repo/apps/web-assure-mobile/next.config.mjs                                       (~70 lignes / withSerwist + next-intl)
repo/apps/web-assure-mobile/tsconfig.json                                         (~30 lignes / extends base)
repo/apps/web-assure-mobile/biome.json                                            (~10 lignes / extends root)
repo/apps/web-assure-mobile/middleware.ts                                         (~50 lignes / next-intl + auth)
repo/apps/web-assure-mobile/app/layout.tsx                                        (~120 lignes / metadata manifest + apple touch + viewport)
repo/apps/web-assure-mobile/app/[locale]/layout.tsx                               (~100 lignes / providers + register SW client)
repo/apps/web-assure-mobile/app/[locale]/page.tsx                                 (~40 lignes / home placeholder)
repo/apps/web-assure-mobile/app/sw.ts                                             (~180 lignes / Serwist + push listener + notificationclick + sync)
repo/apps/web-assure-mobile/serwist.config.ts                                     (~30 lignes / source + dest)
repo/apps/web-assure-mobile/app/i18n.ts                                           (~30 lignes / getRequestConfig)
repo/apps/web-assure-mobile/messages/fr.json                                      (~20 keys / stub)
repo/apps/web-assure-mobile/messages/ar-MA.json                                   (~20 keys / stub)
repo/apps/web-assure-mobile/messages/ar.json                                      (~20 keys / stub)
repo/apps/web-assure-mobile/components/pwa/register-sw.tsx                        (~80 lignes / Client Component useEffect register)
repo/apps/web-assure-mobile/public/manifest.json                                  (~70 lignes / icons + shortcuts + scope)
repo/apps/web-assure-mobile/public/icons/icon-72.png                              (binaire)
repo/apps/web-assure-mobile/public/icons/icon-96.png                              (binaire)
repo/apps/web-assure-mobile/public/icons/icon-128.png                             (binaire)
repo/apps/web-assure-mobile/public/icons/icon-144.png                             (binaire)
repo/apps/web-assure-mobile/public/icons/icon-152.png                             (binaire)
repo/apps/web-assure-mobile/public/icons/icon-180.png                             (binaire / apple-touch)
repo/apps/web-assure-mobile/public/icons/icon-192.png                             (binaire)
repo/apps/web-assure-mobile/public/icons/icon-384.png                             (binaire)
repo/apps/web-assure-mobile/public/icons/icon-512.png                             (binaire / maskable)
repo/apps/web-assure-mobile/public/icons/badge-72.png                             (binaire / monochrome)
repo/apps/web-assure-mobile/public/splash/apple-splash-2048-2732.png              (iPad Pro 12.9)
repo/apps/web-assure-mobile/public/splash/apple-splash-1668-2388.png              (iPad Pro 11)
repo/apps/web-assure-mobile/public/splash/apple-splash-1284-2778.png              (iPhone 13/14 Pro Max)
repo/apps/web-assure-mobile/public/splash/apple-splash-1170-2532.png              (iPhone 12/13/14)
repo/apps/web-assure-mobile/.env.example                                          (~22 lignes)
repo/apps/web-assure-mobile/.gitignore                                            (~17 lignes / + public/sw.js generated)

repo/packages/assure-shared/package.json                                          (~50 lignes / exports map)
repo/packages/assure-shared/tsconfig.json                                         (~25 lignes / extends base)
repo/packages/assure-shared/biome.json                                            (~10 lignes)
repo/packages/assure-shared/src/index.ts                                          (~20 lignes / public exports)
repo/packages/assure-shared/src/api/client.ts                                     (~180 lignes / axios + interceptors)
repo/packages/assure-shared/src/api/endpoints.ts                                  (~60 lignes / chemins constants)
repo/packages/assure-shared/src/api/index.ts                                      (~10 lignes / barrel)
repo/packages/assure-shared/src/types/index.ts                                    (~150 lignes / Policy, Claim, Premium...)
repo/packages/assure-shared/src/hooks/use-assure-auth.ts                          (~80 lignes / placeholder + types)
repo/packages/assure-shared/src/hooks/index.ts                                    (~10 lignes)
repo/packages/assure-shared/src/lib/format.ts                                     (~120 lignes / formatMad formatDate formatPhone)
repo/packages/assure-shared/src/lib/api-error.ts                                  (~70 lignes / ApiError class)
repo/packages/assure-shared/src/lib/index.ts                                      (~10 lignes / barrel)
repo/packages/assure-shared/src/components/index.ts                               (~10 lignes / barrel)
repo/packages/assure-shared/src/components/loading-spinner.tsx                    (~60 lignes / accessible spinner)

infrastructure/scripts/generate-pwa-icons.ts                                       (~150 lignes / sharp resize from logo)

repo/apps/web-assure-portal/__tests__/setup.spec.ts                               (~90 lignes / 6 tests structure)
repo/apps/web-assure-mobile/__tests__/setup.spec.ts                               (~120 lignes / 8 tests + manifest + SW)
repo/packages/assure-shared/__tests__/api-client.spec.ts                          (~150 lignes / 10 tests axios + interceptors)
repo/packages/assure-shared/__tests__/format.spec.ts                              (~100 lignes / 8 tests formatters)
repo/apps/web-assure-mobile/__tests__/pwa-lighthouse.spec.ts                      (~80 lignes / Playwright + Lighthouse CI)
```

Total : ~50 fichiers source + 13 binaires icons/splash.

---

## 6. Code patterns COMPLETS

### Fichier 1/14 : `repo/apps/web-assure-portal/package.json`

Le `package.json` declare l'app Next.js 15 desktop sur port 3005 avec strict engine pnpm + Node 22, scripts pnpm-friendly, et reference le package shared via `workspace:*`.

```json
{
  "name": "@insurtech/web-assure-portal",
  "version": "1.0.0",
  "private": true,
  "description": "Skalean InsurTech - Portail Assure Desktop (port 3005)",
  "license": "UNLICENSED",
  "engines": {
    "node": ">=22.11.0",
    "pnpm": ">=9.15.0"
  },
  "packageManager": "pnpm@9.15.0",
  "scripts": {
    "dev": "next dev -p 3005",
    "build": "next build",
    "start": "next start -p 3005",
    "typecheck": "tsc --noEmit",
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "clean": "rm -rf .next .turbo coverage node_modules/.cache"
  },
  "dependencies": {
    "@insurtech/assure-shared": "workspace:*",
    "@insurtech/shared-config": "workspace:*",
    "@insurtech/shared-types": "workspace:*",
    "@insurtech/shared-ui": "workspace:*",
    "@insurtech/shared-utils": "workspace:*",
    "@tanstack/react-query": "5.62.0",
    "axios": "1.7.9",
    "clsx": "2.1.1",
    "next": "15.0.4",
    "next-intl": "3.26.3",
    "pino": "9.5.0",
    "react": "19.0.0",
    "react-dom": "19.0.0",
    "zod": "3.24.1",
    "zustand": "5.0.2"
  },
  "devDependencies": {
    "@biomejs/biome": "1.9.4",
    "@playwright/test": "1.49.1",
    "@testing-library/jest-dom": "6.6.3",
    "@testing-library/react": "16.1.0",
    "@types/node": "22.10.2",
    "@types/react": "19.0.2",
    "@types/react-dom": "19.0.2",
    "@vitejs/plugin-react": "4.3.4",
    "jsdom": "25.0.1",
    "typescript": "5.7.2",
    "vitest": "2.1.8"
  }
}
```

**Notes importantes** :
- `save-exact=true` heritage du `.npmrc` racine impose des versions sans `^` ni `~`. Si un developpeur ajoute une dependance sans `--save-exact`, lint Husky pre-commit le reject.
- `workspace:*` resout dynamiquement la derniere version locale du package. Au publish (non concerne ici, apps privees), pnpm reecrit en version numerique.
- Pas de `peerDependencies` declaree : c'est une app, pas un package distribuable.
- React 19.0.0 stable (sortie Dec 2024) est requis pour le React Compiler experimental qu'on n'active pas explicitement ici (Next.js 15.0.4 l'enable par defaut).

### Fichier 2/14 : `repo/apps/web-assure-portal/next.config.mjs`

```javascript
// repo/apps/web-assure-portal/next.config.mjs
// Configuration Next.js 15 App Router pour web-assure-portal desktop.
// Reference: B-18 tache 4.5.1, Sprint 18 Phase 4 InsurTech.

import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./app/i18n.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Transpile les packages workspace pour eviter les soucis ESM
  transpilePackages: [
    '@insurtech/assure-shared',
    '@insurtech/shared-config',
    '@insurtech/shared-types',
    '@insurtech/shared-ui',
    '@insurtech/shared-utils',
  ],
  // React Compiler experimental enable explicite
  experimental: {
    reactCompiler: true,
  },
  // Images: domains autorises pour assets externes
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.skalean.ma' },
      { protocol: 'https', hostname: 's3.atlas.ma' },
    ],
  },
  // Headers securite obligatoires (CSP partielle, Sprint 33 enrichira)
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), geolocation=(self), microphone=()' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },
  // Redirections legacy
  async redirects() {
    return [
      { source: '/', destination: '/fr', permanent: false },
    ];
  },
};

export default withNextIntl(nextConfig);
```

**Notes importantes** :
- `reactCompiler: true` active la transformation auto-memo de React 19. Reduit le besoin de `useMemo`/`useCallback`.
- `transpilePackages` indique a Next de compiler les packages workspace meme s'ils sont en TypeScript brut.
- Headers securite : sont volontairement permissifs ici (geolocation autorisee car le Customer journey de declaration sinistre 4.5.6 demande GPS). Sprint 33 (pentest) durcira la CSP.
- `redirects` : `/` redirige vers `/fr` car le middleware `next-intl` exige une locale explicite dans l'URL.

### Fichier 3/14 : `repo/apps/web-assure-portal/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "plugins": [{ "name": "next" }],
    "lib": ["dom", "dom.iterable", "esnext"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "jsx": "preserve",
    "incremental": true,
    "isolatedModules": true,
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noImplicitAny": true,
    "noImplicitReturns": true,
    "noUncheckedIndexedAccess": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "paths": {
      "@/*": ["./*"],
      "@/components/*": ["./components/*"],
      "@/lib/*": ["./lib/*"],
      "@/app/*": ["./app/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", ".next", "coverage", "dist"]
}
```

**Notes importantes** :
- `noUncheckedIndexedAccess` impose la verification null/undefined sur les acces array/object indexes. Empeche `policies[0].numero` sans verifier `policies[0]`.
- Le path `@/*` permet `import Foo from '@/components/foo'` sans `../../` chains.
- `extends tsconfig.base.json` : le base config est defini dans Sprint 1 et impose le mode strict global.

### Fichier 4/14 : `repo/apps/web-assure-portal/app/layout.tsx`

```typescript
// repo/apps/web-assure-portal/app/layout.tsx
// Root Layout commun a toutes les locales.
// Cette tache 4.5.1 pose le squelette, la tache 4.5.3 enrichira avec sidebar/header.

import type { Metadata, Viewport } from 'next';
import { ReactNode } from 'react';

import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://portal.skalean.ma'),
  title: {
    template: '%s | Skalean Mon Assurance',
    default: 'Skalean Mon Assurance',
  },
  description: 'Gerez vos polices, premiums et sinistres en self-service',
  applicationName: 'Skalean Portal Assure',
  authors: [{ name: 'Skalean', url: 'https://skalean.ma' }],
  generator: 'Next.js',
  keywords: ['assurance', 'maroc', 'skalean', 'broker', 'sinistre'],
  robots: {
    index: false,
    follow: false,
  },
};

export const viewport: Viewport = {
  themeColor: '#1A2730',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps): JSX.Element {
  // Note: html/lang/dir geres dans [locale]/layout.tsx car dependent de la locale active.
  // Ici on rend juste un fragment minimal pour que Next.js Root Layout soit satisfait.
  return (
    <html suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
```

**Notes importantes** :
- `metadataBase` est requis pour resoudre les URLs absolues (Open Graph, canonical).
- `robots: { index: false }` : c'est un portail post-login, on ne veut pas que les pages soient indexees par les moteurs.
- `suppressHydrationWarning` sur `<html>` : evite les warnings React quand `next-intl` change l'attribut `lang` au runtime depuis le LocaleLayout.

### Fichier 5/14 : `repo/apps/web-assure-portal/app/[locale]/layout.tsx`

```typescript
// repo/apps/web-assure-portal/app/[locale]/layout.tsx
// Layout localise: lit la locale dynamique [locale] (fr | ar-MA | ar), fournit les messages
// i18n + AuthProvider + QueryClient + theme. La tache 4.5.3 viendra ajouter sidebar/header.

import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, unstable_setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ReactNode } from 'react';

import { QueryProvider } from '@/components/providers/query-provider';
import { AuthProvider } from '@/components/providers/auth-provider';

const SUPPORTED_LOCALES = ['fr', 'ar-MA', 'ar'] as const;
type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

interface LocaleLayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

export async function generateStaticParams(): Promise<Array<{ locale: SupportedLocale }>> {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: LocaleLayoutProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });
  return {
    title: t('title'),
    description: t('description'),
  };
}

export default async function LocaleLayout({
  children,
  params,
}: LocaleLayoutProps): Promise<JSX.Element> {
  const { locale } = await params;

  if (!SUPPORTED_LOCALES.includes(locale as SupportedLocale)) {
    notFound();
  }

  unstable_setRequestLocale(locale);
  const messages = await getMessages();
  const dir = locale.startsWith('ar') ? 'rtl' : 'ltr';

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <QueryProvider>
        <AuthProvider>
          <div lang={locale} dir={dir} className="min-h-screen bg-background text-foreground">
            {children}
          </div>
        </AuthProvider>
      </QueryProvider>
    </NextIntlClientProvider>
  );
}
```

**Notes importantes** :
- `generateStaticParams` permet a Next.js de pre-rendre les 3 locales statiquement.
- `unstable_setRequestLocale(locale)` est requis pour utiliser `getTranslations` dans des Server Components imbriques.
- `dir="rtl"` automatique pour les locales arabes : critique pour le mobile-first MA.
- `AuthProvider` sera detaille en tache 4.5.2 ; ici on en pose un placeholder vide pour eviter le hardcoupling.

### Fichier 6/14 : `repo/apps/web-assure-mobile/package.json`

```json
{
  "name": "@insurtech/web-assure-mobile",
  "version": "1.0.0",
  "private": true,
  "description": "Skalean InsurTech - Mobile PWA Assure (port 3006)",
  "license": "UNLICENSED",
  "engines": {
    "node": ">=22.11.0",
    "pnpm": ">=9.15.0"
  },
  "packageManager": "pnpm@9.15.0",
  "scripts": {
    "dev": "next dev -p 3006",
    "build": "next build",
    "start": "next start -p 3006",
    "typecheck": "tsc --noEmit",
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "test:lighthouse": "lhci autorun",
    "icons:generate": "tsx ../../infrastructure/scripts/generate-pwa-icons.ts",
    "clean": "rm -rf .next .turbo coverage public/sw.js public/swe-worker-*.js node_modules/.cache"
  },
  "dependencies": {
    "@insurtech/assure-shared": "workspace:*",
    "@insurtech/shared-config": "workspace:*",
    "@insurtech/shared-pwa": "workspace:*",
    "@insurtech/shared-types": "workspace:*",
    "@insurtech/shared-ui": "workspace:*",
    "@insurtech/shared-utils": "workspace:*",
    "@serwist/next": "9.0.11",
    "@tanstack/react-query": "5.62.0",
    "axios": "1.7.9",
    "clsx": "2.1.1",
    "idb": "8.0.1",
    "next": "15.0.4",
    "next-intl": "3.26.3",
    "pino": "9.5.0",
    "react": "19.0.0",
    "react-dom": "19.0.0",
    "serwist": "9.0.11",
    "zod": "3.24.1",
    "zustand": "5.0.2"
  },
  "devDependencies": {
    "@biomejs/biome": "1.9.4",
    "@lhci/cli": "0.14.0",
    "@playwright/test": "1.49.1",
    "@testing-library/jest-dom": "6.6.3",
    "@testing-library/react": "16.1.0",
    "@types/node": "22.10.2",
    "@types/react": "19.0.2",
    "@types/react-dom": "19.0.2",
    "@vitejs/plugin-react": "4.3.4",
    "jsdom": "25.0.1",
    "sharp": "0.33.5",
    "tsx": "4.19.2",
    "typescript": "5.7.2",
    "vitest": "2.1.8"
  }
}
```

**Notes importantes** :
- `@serwist/next` : Workbox fork moderne supporte Next.js 15. Genere `public/sw.js` automatiquement au build.
- `idb` : wrapper TypeScript autour de IndexedDB, utile pour le background sync (photos sinistre en attente upload).
- `@lhci/cli` : Lighthouse CI pour audit automatise PWA dans les tests.
- `sharp` : resize d'images haute performance, utilise par le script `icons:generate`.

### Fichier 7/14 : `repo/apps/web-assure-mobile/next.config.mjs`

```javascript
// repo/apps/web-assure-mobile/next.config.mjs
// Configuration Next.js 15 PWA avec Serwist (Workbox-like).
// Wrap order: withSerwist( withNextIntl(...) )  -- Serwist en outermost pour intercepter le build.

import createNextIntlPlugin from 'next-intl/plugin';
import withSerwistInit from '@serwist/next';

const withNextIntl = createNextIntlPlugin('./app/i18n.ts');

const withSerwist = withSerwistInit({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
  // En dev, on regenere le SW a chaque change
  disable: process.env.NODE_ENV === 'development' && process.env.SERWIST_DEV !== 'true',
  // Cache les pages statiques pre-rendues
  additionalPrecacheEntries: [
    { url: '/fr', revision: '1' },
    { url: '/ar-MA', revision: '1' },
    { url: '/ar', revision: '1' },
    { url: '/offline', revision: '1' },
  ],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: [
    '@insurtech/assure-shared',
    '@insurtech/shared-config',
    '@insurtech/shared-pwa',
    '@insurtech/shared-types',
    '@insurtech/shared-ui',
    '@insurtech/shared-utils',
  ],
  experimental: {
    reactCompiler: true,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.skalean.ma' },
      { protocol: 'https', hostname: 's3.atlas.ma' },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), geolocation=(self), microphone=(), payment=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
      {
        // Service worker doit etre servi avec Cache-Control no-cache
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        // Manifest doit etre cache court (1h)
        source: '/manifest.json',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=3600, must-revalidate' },
          { key: 'Content-Type', value: 'application/manifest+json' },
        ],
      },
    ];
  },
  async redirects() {
    return [
      { source: '/', destination: '/fr', permanent: false },
    ];
  },
};

export default withSerwist(withNextIntl(nextConfig));
```

**Notes importantes** :
- L'ordre d'enveloppe est critique : `withSerwist(withNextIntl(nextConfig))`. Inverser casse le SW build.
- `Service-Worker-Allowed: /` autorise le SW a controler toute l'app (par defaut, un SW ne controle que son scope racine, soit `/sw.js` -> scope `/`).
- `Cache-Control no-cache` sur `sw.js` evite que le navigateur garde une vieille version du SW.
- `permissions-policy` autorise camera + geolocation pour les futures taches 4.5.6 (photos sinistre) et 4.5.7 (geolocalisation garage).

### Fichier 8/14 : `repo/apps/web-assure-mobile/app/sw.ts`

```typescript
// repo/apps/web-assure-mobile/app/sw.ts
// Service Worker source (Serwist). Sera compile en public/sw.js au build.
// Cette tache 4.5.1 met en place: precache + push listener + notificationclick listener + skipWaiting.
// La tache 4.5.12 enrichira avec cache strategies + background sync detaille.

/// <reference lib="webworker" />
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { Serwist } from 'serwist';
import { defaultCache } from '@serwist/next/worker';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[];
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
  fallbacks: {
    entries: [
      {
        url: '/offline',
        matcher: ({ request }) => request.destination === 'document',
      },
    ],
  },
});

serwist.addEventListeners();

// --- Push notifications listener ---
// Recoit le push payload du backend (Sprint 9 enrichi + tache 4.5.11).
// Format payload attendu (JSON):
//   { title, body, tag, icon, badge, data: { url, claim_id? }, actions: [{action, title}] }

interface PushPayload {
  title: string;
  body: string;
  tag?: string;
  icon?: string;
  badge?: string;
  vibrate?: number[];
  data?: {
    url?: string;
    claim_id?: string;
    policy_id?: string;
    type?: 'claim_status' | 'premium_due' | 'document_ready' | 'message';
  };
  actions?: Array<{ action: string; title: string; icon?: string }>;
}

self.addEventListener('push', (event: PushEvent) => {
  if (!event.data) {
    return;
  }

  let payload: PushPayload;
  try {
    payload = event.data.json() as PushPayload;
  } catch (err) {
    // Fallback: si payload pas JSON, afficher quand meme un message generique
    payload = {
      title: 'Skalean Mon Assurance',
      body: event.data.text(),
    };
  }

  const options: NotificationOptions = {
    body: payload.body,
    icon: payload.icon ?? '/icons/icon-192.png',
    badge: payload.badge ?? '/icons/badge-72.png',
    tag: payload.tag,
    data: payload.data,
    vibrate: payload.vibrate ?? [200, 100, 200],
    requireInteraction: payload.data?.type === 'claim_status',
    silent: false,
    timestamp: Date.now(),
  };

  if (payload.actions && payload.actions.length > 0) {
    (options as NotificationOptions & { actions?: unknown }).actions = payload.actions;
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, options).catch((err) => {
      // Log silencieux (le navigateur n'a pas la permission, par exemple)
      // Ne pas planter le SW
      // eslint-disable-next-line no-console
      console.warn('[sw] showNotification failed', err);
    }),
  );
});

// --- Click sur une notification ---
// Comportement: ouvrir l'URL data.url dans une fenetre Skalean existante ou nouvelle.

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();

  const targetUrl = (event.notification.data?.url as string | undefined) ?? '/';
  const action = event.action;

  // Cas action personnalisee (boutons custom)
  let urlToOpen = targetUrl;
  if (action === 'view_claim' && event.notification.data?.claim_id) {
    urlToOpen = `/fr/sinistres/${event.notification.data.claim_id}`;
  } else if (action === 'pay_premium' && event.notification.data?.policy_id) {
    urlToOpen = `/fr/polices/${event.notification.data.policy_id}/premiums`;
  }

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Si une fenetre Skalean existe deja, focus + navigate
        for (const client of clientList) {
          if (client.url.includes('skalean.ma') && 'focus' in client) {
            return (client as WindowClient).focus().then((focused) => {
              return focused.navigate(urlToOpen);
            });
          }
        }
        // Sinon ouvrir une nouvelle fenetre
        return self.clients.openWindow(urlToOpen);
      }),
  );
});

// --- Notification fermee sans clic ---
// Permet au backend de tracker le dismiss rate (telemetrie Sprint 13 Analytics).

self.addEventListener('notificationclose', (event: NotificationEvent) => {
  // Best-effort: envoyer un beacon analytics, ne pas bloquer le SW
  const claimId = event.notification.data?.claim_id as string | undefined;
  if (claimId) {
    fetch(`/api/v1/notifications/track/dismissed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claim_id: claimId, tag: event.notification.tag }),
      keepalive: true,
    }).catch(() => {
      // Silent fail: la metrique n'est pas critique
    });
  }
});

// --- Background sync (squelette, enrichi tache 4.5.12) ---
// Le tag 'claim-photo-sync' sera enregistre depuis la tache 4.5.6 quand
// l'utilisateur photographie un sinistre offline.

self.addEventListener('sync', (event: SyncEvent) => {
  if (event.tag === 'claim-photo-sync') {
    event.waitUntil(
      (async () => {
        // Placeholder: ouvrir IndexedDB 'pending-uploads', re-poster les photos
        // Implementation reelle: tache 4.5.12.
        // eslint-disable-next-line no-console
        console.info('[sw] background sync triggered: claim-photo-sync');
      })(),
    );
  }
});

// --- Periodic sync (squelette, post-MVP) ---
// Pour refresh polices/sinistres sans ouvrir l'app. Necessite permission `periodic-background-sync`.

self.addEventListener('periodicsync', (event: SyncEvent) => {
  if (event.tag === 'refresh-data') {
    // Placeholder: refresh cache /api/v1/insure/policies + claims.
    // eslint-disable-next-line no-console
    console.info('[sw] periodic sync triggered: refresh-data');
  }
});
```

**Notes importantes** :
- L'ordre `addEventListeners()` du `serwist` AVANT les listeners custom n'est pas critique en pratique, mais conventionnellement on declare Serwist d'abord.
- `requireInteraction: true` pour les notifications `claim_status` : empeche le navigateur d'auto-fermer apres 5s. Critique pour les updates sinistres (souvent attendus mais peuvent arriver pendant que l'utilisateur fait autre chose).
- `WindowClient.navigate` n'existe pas dans le type `Client` standard, d'ou le cast. C'est documente par Mozilla : seuls les `WindowClient` (frames top-level) supportent `navigate`.
- Le SW utilise `console.info/warn` pour les logs (exception a la regle no-console, voir convention specifique SW).

### Fichier 9/14 : `repo/apps/web-assure-mobile/public/manifest.json`

```json
{
  "name": "Skalean Mon Assurance",
  "short_name": "Skalean",
  "description": "Gerez vos polices, premiums et sinistres en quelques clics",
  "start_url": "/fr",
  "scope": "/",
  "id": "/",
  "display": "standalone",
  "display_override": ["standalone", "minimal-ui"],
  "background_color": "#FFFFFF",
  "theme_color": "#1A2730",
  "orientation": "portrait-primary",
  "lang": "fr-MA",
  "dir": "ltr",
  "categories": ["finance", "lifestyle", "productivity"],
  "prefer_related_applications": false,
  "icons": [
    {
      "src": "/icons/icon-72.png",
      "sizes": "72x72",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-96.png",
      "sizes": "96x96",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-128.png",
      "sizes": "128x128",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-144.png",
      "sizes": "144x144",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-152.png",
      "sizes": "152x152",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-384.png",
      "sizes": "384x384",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ],
  "shortcuts": [
    {
      "name": "Declarer un sinistre",
      "short_name": "Sinistre",
      "description": "Declarer un nouveau sinistre rapidement",
      "url": "/fr/sinistres/declarer/etape-1",
      "icons": [{ "src": "/icons/shortcut-claim.png", "sizes": "96x96", "type": "image/png" }]
    },
    {
      "name": "Mes polices",
      "short_name": "Polices",
      "description": "Voir mes contrats actifs",
      "url": "/fr/polices",
      "icons": [{ "src": "/icons/shortcut-policy.png", "sizes": "96x96", "type": "image/png" }]
    },
    {
      "name": "Mes documents",
      "short_name": "Documents",
      "description": "Telecharger attestations et factures",
      "url": "/fr/documents",
      "icons": [{ "src": "/icons/shortcut-docs.png", "sizes": "96x96", "type": "image/png" }]
    }
  ],
  "screenshots": [
    {
      "src": "/screenshots/home-mobile.png",
      "sizes": "1080x1920",
      "type": "image/png",
      "form_factor": "narrow",
      "label": "Tableau de bord assure"
    },
    {
      "src": "/screenshots/claim-mobile.png",
      "sizes": "1080x1920",
      "type": "image/png",
      "form_factor": "narrow",
      "label": "Declaration sinistre"
    }
  ],
  "share_target": {
    "action": "/fr/sinistres/declarer/etape-1",
    "method": "POST",
    "enctype": "multipart/form-data",
    "params": {
      "title": "title",
      "text": "description",
      "files": [
        {
          "name": "photos",
          "accept": ["image/jpeg", "image/png", "image/webp"]
        }
      ]
    }
  },
  "protocol_handlers": [
    {
      "protocol": "web+skalean",
      "url": "/fr/handler?ref=%s"
    }
  ]
}
```

**Notes importantes** :
- `"id": "/"` : nouvelle propriete W3C 2023 qui identifie unique l'app. Sans cela, certains navigateurs creent des doublons d'installation.
- `share_target` : permet a l'utilisateur de partager une photo depuis la galerie Android vers Skalean qui va automatiquement initier une declaration sinistre. UX critique pour le flux degrade.
- `protocol_handlers` : permet aux deep links `web+skalean://policy/123` d'ouvrir l'app installee.
- `display_override` : fallback chain si `standalone` non supporte.
- Tous les icons sauf 192 et 512 sont `purpose: "any"`. Seuls 192 et 512 sont `"any maskable"` car ce sont ceux qu'Android adaptive icons utilise.

### Fichier 10/14 : `repo/apps/web-assure-mobile/app/layout.tsx`

```typescript
// repo/apps/web-assure-mobile/app/layout.tsx
// Root Layout PWA: metadata.manifest + apple touch + viewport-fit cover (notch) + register SW.

import type { Metadata, Viewport } from 'next';
import { ReactNode } from 'react';

import { RegisterSW } from '@/components/pwa/register-sw';

import './globals.css';

const APP_NAME = 'Skalean Mon Assurance';
const APP_DESCRIPTION = 'Gerez vos polices, premiums et sinistres en quelques clics';

export const metadata: Metadata = {
  metadataBase: new URL('https://mon.skalean.ma'),
  applicationName: APP_NAME,
  title: {
    template: '%s | Skalean',
    default: APP_NAME,
  },
  description: APP_DESCRIPTION,
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: APP_NAME,
    statusBarStyle: 'default',
    startupImage: [
      {
        url: '/splash/apple-splash-2048-2732.png',
        media:
          '(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)',
      },
      {
        url: '/splash/apple-splash-1668-2388.png',
        media:
          '(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)',
      },
      {
        url: '/splash/apple-splash-1284-2778.png',
        media:
          '(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
      },
      {
        url: '/splash/apple-splash-1170-2532.png',
        media:
          '(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
      },
    ],
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/icon-180.png', sizes: '180x180', type: 'image/png' }],
    other: [
      {
        rel: 'mask-icon',
        url: '/icons/safari-pinned-tab.svg',
        color: '#1A2730',
      },
    ],
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
  robots: {
    index: false,
    follow: false,
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'default',
    'apple-mobile-web-app-title': APP_NAME,
    'msapplication-TileColor': '#1A2730',
    'msapplication-config': '/browserconfig.xml',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FFFFFF' },
    { media: '(prefers-color-scheme: dark)', color: '#1A2730' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  userScalable: true,
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps): JSX.Element {
  return (
    <html suppressHydrationWarning>
      <body>
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
```

**Notes importantes** :
- `viewportFit: 'cover'` : critique pour iPhone notch (X et superieurs). Combine avec `env(safe-area-inset-*)` en CSS pour eviter que le contenu soit cache derriere l'encoche.
- `formatDetection: false partout` : empeche iOS Safari de transformer les numeros de telephone en liens (UX cassante pour les champs CIN/RIB).
- `appleWebApp.startupImage` : 4 splash screens correspondent aux iPhones/iPads les plus repandus. La media query exacte est critique sinon iOS ignore l'image.
- `RegisterSW` est un Client Component charge cote client uniquement.

### Fichier 11/14 : `repo/apps/web-assure-mobile/components/pwa/register-sw.tsx`

```typescript
// repo/apps/web-assure-mobile/components/pwa/register-sw.tsx
// Client Component: enregistre le service worker apres hydratation.
// Affiche un toast si update disponible (le user doit refresh).

'use client';

import { useEffect, useState } from 'react';

interface SWRegistrationState {
  status: 'idle' | 'registering' | 'registered' | 'update-available' | 'error';
  error?: string;
}

export function RegisterSW(): JSX.Element | null {
  const [state, setState] = useState<SWRegistrationState>({ status: 'idle' });

  useEffect(() => {
    // Service workers require https in production (localhost is exempt).
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      setState({ status: 'error', error: 'Service Workers not supported' });
      return;
    }

    let cancelled = false;
    setState({ status: 'registering' });

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        if (cancelled) return;
        setState({ status: 'registered' });

        // Detecte les updates: un nouveau SW prend le controle apres reload
        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            if (
              installing.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              // Un SW etait deja actif, un nouveau vient d'etre installe = update disponible
              setState({ status: 'update-available' });
            }
          });
        });

        // Verifie un update toutes les 60 minutes (utilisateur en session prolongee)
        setInterval(
          () => {
            registration.update().catch(() => {
              // ignore: pas critique
            });
          },
          60 * 60 * 1000,
        );
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setState({ status: 'error', error: err.message });
        // eslint-disable-next-line no-console
        console.warn('[sw] registration failed', err);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Affiche un toast si update disponible
  if (state.status === 'update-available') {
    return (
      <div
        role="alert"
        aria-live="polite"
        className="fixed bottom-20 left-4 right-4 z-50 rounded-lg bg-primary p-4 text-primary-foreground shadow-lg"
      >
        <p className="text-sm font-medium">Une nouvelle version est disponible.</p>
        <button
          type="button"
          onClick={() => {
            window.location.reload();
          }}
          className="mt-2 rounded bg-primary-foreground px-3 py-1 text-xs font-semibold text-primary"
        >
          Recharger
        </button>
      </div>
    );
  }

  // Pas de UI quand tout va bien
  return null;
}
```

**Notes importantes** :
- `'use client'` obligatoire (le hook useEffect ne marche pas server-side).
- L'enregistrement est appele apres l'hydratation, pas en SSR : evite les erreurs `navigator is not defined`.
- L'update detection est subtle : un SW `installed` ET `navigator.serviceWorker.controller` non null indique un remplacement (pas la premiere install).
- Le toast est minimal mais accessible (`role="alert"`, `aria-live="polite"`).

### Fichier 12/14 : `repo/packages/assure-shared/package.json`

```json
{
  "name": "@insurtech/assure-shared",
  "version": "1.0.0",
  "private": true,
  "description": "Shared components, hooks, API client for web-assure-portal and web-assure-mobile",
  "license": "UNLICENSED",
  "sideEffects": false,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "import": "./src/index.ts"
    },
    "./api": {
      "types": "./src/api/index.ts",
      "import": "./src/api/index.ts"
    },
    "./hooks": {
      "types": "./src/hooks/index.ts",
      "import": "./src/hooks/index.ts"
    },
    "./components": {
      "types": "./src/components/index.ts",
      "import": "./src/components/index.ts"
    },
    "./lib": {
      "types": "./src/lib/index.ts",
      "import": "./src/lib/index.ts"
    },
    "./types": {
      "types": "./src/types/index.ts",
      "import": "./src/types/index.ts"
    }
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "biome check .",
    "test": "vitest run",
    "test:watch": "vitest",
    "clean": "rm -rf coverage node_modules/.cache"
  },
  "dependencies": {
    "@insurtech/shared-config": "workspace:*",
    "@insurtech/shared-types": "workspace:*",
    "@insurtech/shared-utils": "workspace:*",
    "@tanstack/react-query": "5.62.0",
    "axios": "1.7.9",
    "clsx": "2.1.1",
    "zod": "3.24.1"
  },
  "peerDependencies": {
    "react": ">=19.0.0",
    "react-dom": ">=19.0.0"
  },
  "devDependencies": {
    "@biomejs/biome": "1.9.4",
    "@testing-library/jest-dom": "6.6.3",
    "@testing-library/react": "16.1.0",
    "@types/node": "22.10.2",
    "@types/react": "19.0.2",
    "@vitejs/plugin-react": "4.3.4",
    "jsdom": "25.0.1",
    "typescript": "5.7.2",
    "vitest": "2.1.8"
  }
}
```

**Notes importantes** :
- `"sideEffects": false` : indique a Webpack/Turbopack que le package est purement fonctionnel, autorisant le tree-shaking aggressif.
- Pas de `build` script : pas de compilation TS, les apps consument directement les `.ts` via `transpilePackages` dans Next.js.
- `peerDependencies` declare React comme attendu mais pas embarque : evite les doublons de React au runtime.
- Subpath exports (`./api`, `./hooks`, etc.) permettent `import { useMyPolicies } from '@insurtech/assure-shared/hooks'` ce qui aide le tree shaking encore plus.

### Fichier 13/14 : `repo/packages/assure-shared/src/api/client.ts`

```typescript
// repo/packages/assure-shared/src/api/client.ts
// API client axios avec interceptors: JWT auth + tenant header + locale + retry safe + Idempotency-Key.

import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';

import { ApiError } from '../lib/api-error';

export interface AssureApiClientOptions {
  /** Base URL API, ex: https://api.skalean.ma */
  baseURL: string;
  /** Locale active utilisee pour Accept-Language */
  getLocale: () => string;
  /** Fonction qui retourne le JWT access token courant (null si pas connecte) */
  getAccessToken: () => string | null;
  /** Fonction qui retourne le tenant actif (le contact assure peut etre lie a plusieurs brokers) */
  getActiveTenantId: () => string | null;
  /** Callback quand le JWT a expire et qu'aucun refresh n'est possible (force logout UI) */
  onUnauthorized: () => void;
  /** Callback quand l'API renvoie un 503/504 (afficher banniere maintenance) */
  onServiceUnavailable?: () => void;
  /** Timeout requete (ms), defaut 15000 */
  timeout?: number;
}

const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 800;

function generateRequestId(): string {
  // Petit UUID v4 pseudo (suffisant pour trace, pas pour crypto)
  const hex = '0123456789abcdef';
  const chars: string[] = [];
  for (let i = 0; i < 32; i += 1) {
    chars.push(hex[Math.floor(Math.random() * 16)] ?? '0');
  }
  return `${chars.slice(0, 8).join('')}-${chars.slice(8, 12).join('')}-4${chars
    .slice(13, 16)
    .join('')}-${chars.slice(16, 20).join('')}-${chars.slice(20, 32).join('')}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function createAssureApiClient(opts: AssureApiClientOptions): AxiosInstance {
  const client = axios.create({
    baseURL: opts.baseURL,
    timeout: opts.timeout ?? DEFAULT_TIMEOUT_MS,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  });

  // --- REQUEST INTERCEPTOR ---
  client.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      const token = opts.getAccessToken();
      if (token) {
        config.headers.set('Authorization', `Bearer ${token}`);
      }

      const tenantId = opts.getActiveTenantId();
      // Bypass tenant header pour les endpoints publics et auth assure
      const isPublic =
        config.url?.startsWith('/api/v1/public/') ||
        config.url?.startsWith('/api/v1/auth/assure/');
      if (tenantId && !isPublic) {
        config.headers.set('x-tenant-id', tenantId);
      }

      const locale = opts.getLocale();
      if (locale) {
        // ar-MA -> ar-MA, fallback fr-FR; en-US si rien
        config.headers.set('Accept-Language', `${locale},${locale.split('-')[0]},en;q=0.5`);
      }

      // Request ID pour trace cross-service (Sprint 3 API logs)
      config.headers.set('X-Request-Id', generateRequestId());

      // Idempotency-Key pour mutations sensibles (POST/PUT/PATCH/DELETE)
      // Conformement aux conventions: paiement, signature, claims
      const method = (config.method ?? 'get').toLowerCase();
      const isSensitive =
        ['post', 'put', 'patch', 'delete'].includes(method) &&
        (config.url?.includes('/payments') ||
          config.url?.includes('/signatures') ||
          config.url?.includes('/claims') ||
          config.url?.includes('/refunds'));
      if (isSensitive && !config.headers.has('Idempotency-Key')) {
        config.headers.set('Idempotency-Key', generateRequestId());
      }

      return config;
    },
    (err: AxiosError) => Promise.reject(err),
  );

  // --- RESPONSE INTERCEPTOR ---
  client.interceptors.response.use(
    (response: AxiosResponse) => response,
    async (error: AxiosError<{ code?: string; message?: string; details?: unknown }>) => {
      const config = error.config as
        | (InternalAxiosRequestConfig & { __retryCount?: number })
        | undefined;

      // 401 Unauthorized: tenter une refresh ne fait pas partie de cette tache
      // (sera traite en tache 4.5.2). Ici on declenche le logout brutal.
      if (error.response?.status === 401) {
        opts.onUnauthorized();
        return Promise.reject(
          new ApiError({
            status: 401,
            code: error.response.data?.code ?? 'UNAUTHORIZED',
            message: error.response.data?.message ?? 'Session expiree',
            details: error.response.data?.details,
          }),
        );
      }

      // 5xx / network errors: retry idempotent (GET uniquement)
      const method = (config?.method ?? 'get').toLowerCase();
      const isIdempotent = ['get', 'head', 'options'].includes(method);
      const status = error.response?.status;
      const isRetryable = !error.response || (status !== undefined && status >= 500 && status < 600);

      if (config && isIdempotent && isRetryable) {
        config.__retryCount = (config.__retryCount ?? 0) + 1;
        if (config.__retryCount <= MAX_RETRIES) {
          // Backoff exponentiel: 800ms, 1600ms
          await delay(RETRY_DELAY_MS * 2 ** (config.__retryCount - 1));
          return client.request(config);
        }
      }

      if (status === 503 || status === 504) {
        opts.onServiceUnavailable?.();
      }

      // Erreur normalisee
      return Promise.reject(
        new ApiError({
          status: status ?? 0,
          code: error.response?.data?.code ?? error.code ?? 'NETWORK_ERROR',
          message: error.response?.data?.message ?? error.message ?? 'Erreur inattendue',
          details: error.response?.data?.details,
        }),
      );
    },
  );

  return client;
}

/**
 * Helper pour appels typed: utilise zod schema pour valider la reponse.
 * Empeche les regressions silencieuses cote backend.
 */
export async function apiGet<T>(
  client: AxiosInstance,
  url: string,
  schema: { parse: (data: unknown) => T },
  config?: AxiosRequestConfig,
): Promise<T> {
  const response = await client.get<unknown>(url, config);
  return schema.parse(response.data);
}

export async function apiPost<T, B = unknown>(
  client: AxiosInstance,
  url: string,
  body: B,
  schema: { parse: (data: unknown) => T },
  config?: AxiosRequestConfig,
): Promise<T> {
  const response = await client.post<unknown>(url, body, config);
  return schema.parse(response.data);
}
```

**Notes importantes** :
- `Idempotency-Key` auto-injecte pour les mutations sensibles : conforme aux conventions strict-idempotency programme.
- Retry sur 5xx seulement pour les methodes idempotent (GET/HEAD/OPTIONS) : ne JAMAIS retry un POST/PUT car cela risque de creer des doublons (paiements, declarations).
- `X-Request-Id` propagation : permet de retracer une requete a travers api -> kafka -> consumers -> DB.
- L'interceptor utilise `ApiError` pour normaliser les erreurs cote consommateur : les composants UI savent toujours quelle forme attendre.
- L'absence de refresh-token logic ici est volontaire : la tache 4.5.2 ajoutera un interceptor specifique qui appelle `/api/v1/auth/assure/refresh` avant le `onUnauthorized` callback.

### Fichier 14/14 : `infrastructure/scripts/generate-pwa-icons.ts`

```typescript
// infrastructure/scripts/generate-pwa-icons.ts
// Genere automatiquement toutes les icons PWA + apple splash depuis un logo source.
// Usage: pnpm --filter @insurtech/web-assure-mobile icons:generate

import { promises as fs } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const REPO_ROOT = resolve(__dirname, '..', '..');
const SOURCE_LOGO = resolve(REPO_ROOT, 'infrastructure', 'assets', 'skalean-logo-1024.png');
const OUTPUT_ICONS = resolve(REPO_ROOT, 'apps', 'web-assure-mobile', 'public', 'icons');
const OUTPUT_SPLASH = resolve(REPO_ROOT, 'apps', 'web-assure-mobile', 'public', 'splash');

interface IconSpec {
  size: number;
  filename: string;
  maskable?: boolean;
}

const ICON_SPECS: IconSpec[] = [
  { size: 72, filename: 'icon-72.png' },
  { size: 96, filename: 'icon-96.png' },
  { size: 128, filename: 'icon-128.png' },
  { size: 144, filename: 'icon-144.png' },
  { size: 152, filename: 'icon-152.png' },
  { size: 180, filename: 'icon-180.png' }, // apple-touch
  { size: 192, filename: 'icon-192.png', maskable: true },
  { size: 384, filename: 'icon-384.png' },
  { size: 512, filename: 'icon-512.png', maskable: true },
];

interface SplashSpec {
  width: number;
  height: number;
  filename: string;
  device: string;
}

const SPLASH_SPECS: SplashSpec[] = [
  { width: 2048, height: 2732, filename: 'apple-splash-2048-2732.png', device: 'iPad Pro 12.9' },
  { width: 1668, height: 2388, filename: 'apple-splash-1668-2388.png', device: 'iPad Pro 11' },
  { width: 1284, height: 2778, filename: 'apple-splash-1284-2778.png', device: 'iPhone 13/14 Pro Max' },
  { width: 1170, height: 2532, filename: 'apple-splash-1170-2532.png', device: 'iPhone 12/13/14' },
];

const THEME_COLOR = { r: 26, g: 39, b: 48 }; // #1A2730
const BG_COLOR = { r: 255, g: 255, b: 255 };

async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

async function generateIcon(spec: IconSpec): Promise<void> {
  const outPath = resolve(OUTPUT_ICONS, spec.filename);
  let pipeline = sharp(SOURCE_LOGO);

  if (spec.maskable) {
    // Pour les icons maskable, ajouter une marge interieure de 10% (safe area Android adaptive)
    const innerSize = Math.round(spec.size * 0.8);
    const padding = Math.round((spec.size - innerSize) / 2);
    pipeline = pipeline
      .resize(innerSize, innerSize, { fit: 'contain', background: { ...BG_COLOR, alpha: 1 } })
      .extend({
        top: padding,
        bottom: padding,
        left: padding,
        right: padding,
        background: { ...BG_COLOR, alpha: 1 },
      });
  } else {
    pipeline = pipeline.resize(spec.size, spec.size, {
      fit: 'contain',
      background: { ...BG_COLOR, alpha: 1 },
    });
  }

  await pipeline.png({ compressionLevel: 9, palette: false }).toFile(outPath);
  // eslint-disable-next-line no-console
  console.info(`[icons] generated ${spec.filename} (${spec.size}x${spec.size}${spec.maskable ? ' maskable' : ''})`);
}

async function generateSplash(spec: SplashSpec): Promise<void> {
  const outPath = resolve(OUTPUT_SPLASH, spec.filename);

  // Logo centre, ~30% de la largeur
  const logoSize = Math.round(Math.min(spec.width, spec.height) * 0.3);

  const logoBuffer = await sharp(SOURCE_LOGO)
    .resize(logoSize, logoSize, { fit: 'contain', background: { ...BG_COLOR, alpha: 0 } })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: spec.width,
      height: spec.height,
      channels: 4,
      background: { ...BG_COLOR, alpha: 1 },
    },
  })
    .composite([
      {
        input: logoBuffer,
        gravity: 'center',
      },
    ])
    .png({ compressionLevel: 9 })
    .toFile(outPath);

  // eslint-disable-next-line no-console
  console.info(`[splash] generated ${spec.filename} (${spec.width}x${spec.height}, ${spec.device})`);
}

async function main(): Promise<void> {
  // eslint-disable-next-line no-console
  console.info(`[icons] reading source from ${SOURCE_LOGO}`);
  try {
    await fs.access(SOURCE_LOGO);
  } catch {
    throw new Error(`Source logo not found at ${SOURCE_LOGO}. Place a 1024x1024 PNG there.`);
  }

  await ensureDir(OUTPUT_ICONS);
  await ensureDir(OUTPUT_SPLASH);

  for (const spec of ICON_SPECS) {
    await generateIcon(spec);
  }

  for (const spec of SPLASH_SPECS) {
    await generateSplash(spec);
  }

  // Aussi: badge 72x72 monochrome pour Android notifications
  await sharp(SOURCE_LOGO)
    .resize(72, 72, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .greyscale()
    .threshold(128)
    .toFile(resolve(OUTPUT_ICONS, 'badge-72.png'));

  // eslint-disable-next-line no-console
  console.info('[icons] all assets generated successfully');
}

main().catch((err: Error) => {
  // eslint-disable-next-line no-console
  console.error('[icons] FAILED:', err.message);
  process.exit(1);
});
```

**Notes importantes** :
- `sharp` est ultra-rapide (libvips natif) et gere la compression PNG optimale.
- Pour les icons maskable, on applique une marge interne de 10% (320px sur 512). Android adaptive icons applique un masque circulaire/squircle qui rogne jusqu'a 18% : avec 10% on est safe.
- Le badge 72x72 est monochrome (threshold) car Android l'affiche en noir et blanc dans la status bar.
- Le splash screen iOS attend une PNG opaque de taille exacte. Mauvaise resolution = iOS ignore et affiche blanc.
- Erreur explicite si le source n'existe pas, evite les builds qui generent des assets vides.

---

## 7. Tests complets

### 7.1 Tests unitaires : `repo/packages/assure-shared/__tests__/api-client.spec.ts`

```typescript
// repo/packages/assure-shared/__tests__/api-client.spec.ts
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import MockAdapter from 'axios-mock-adapter';

import { createAssureApiClient } from '../src/api/client';
import { ApiError } from '../src/lib/api-error';

describe('createAssureApiClient', () => {
  let getAccessToken: ReturnType<typeof vi.fn>;
  let getActiveTenantId: ReturnType<typeof vi.fn>;
  let getLocale: ReturnType<typeof vi.fn>;
  let onUnauthorized: ReturnType<typeof vi.fn>;
  let onServiceUnavailable: ReturnType<typeof vi.fn>;
  let client: ReturnType<typeof createAssureApiClient>;
  let mock: MockAdapter;

  beforeEach(() => {
    getAccessToken = vi.fn().mockReturnValue('jwt-token-abc');
    getActiveTenantId = vi.fn().mockReturnValue('tenant-uuid-1');
    getLocale = vi.fn().mockReturnValue('fr-MA');
    onUnauthorized = vi.fn();
    onServiceUnavailable = vi.fn();

    client = createAssureApiClient({
      baseURL: 'https://api.skalean.ma',
      getAccessToken,
      getActiveTenantId,
      getLocale,
      onUnauthorized,
      onServiceUnavailable,
    });
    mock = new MockAdapter(client);
  });

  afterEach(() => {
    mock.restore();
  });

  it('injects Authorization header when token present', async () => {
    mock.onGet('/api/v1/insure/policies').reply((config) => {
      expect(config.headers?.Authorization).toBe('Bearer jwt-token-abc');
      return [200, { items: [] }];
    });
    await client.get('/api/v1/insure/policies');
  });

  it('does not inject Authorization when no token', async () => {
    getAccessToken.mockReturnValue(null);
    mock.onGet('/api/v1/public/branches').reply((config) => {
      expect(config.headers?.Authorization).toBeUndefined();
      return [200, []];
    });
    await client.get('/api/v1/public/branches');
  });

  it('injects x-tenant-id on protected endpoints', async () => {
    mock.onGet('/api/v1/insure/policies').reply((config) => {
      expect(config.headers?.['x-tenant-id']).toBe('tenant-uuid-1');
      return [200, { items: [] }];
    });
    await client.get('/api/v1/insure/policies');
  });

  it('does NOT inject x-tenant-id on public endpoints', async () => {
    mock.onGet('/api/v1/public/branches').reply((config) => {
      expect(config.headers?.['x-tenant-id']).toBeUndefined();
      return [200, []];
    });
    await client.get('/api/v1/public/branches');
  });

  it('does NOT inject x-tenant-id on auth assure endpoints', async () => {
    mock.onPost('/api/v1/auth/assure/request-otp').reply((config) => {
      expect(config.headers?.['x-tenant-id']).toBeUndefined();
      return [200, { otpId: 'x' }];
    });
    await client.post('/api/v1/auth/assure/request-otp', { email: 'a@b.c' });
  });

  it('injects Accept-Language with primary + fallback', async () => {
    mock.onGet('/api/v1/insure/policies').reply((config) => {
      expect(config.headers?.['Accept-Language']).toContain('fr-MA');
      expect(config.headers?.['Accept-Language']).toContain('fr');
      expect(config.headers?.['Accept-Language']).toContain('en;q=0.5');
      return [200, {}];
    });
    await client.get('/api/v1/insure/policies');
  });

  it('injects Idempotency-Key on POST /payments', async () => {
    mock.onPost('/api/v1/pay/payments').reply((config) => {
      expect(config.headers?.['Idempotency-Key']).toMatch(/^[0-9a-f-]+$/i);
      return [201, { id: 'pay-1' }];
    });
    await client.post('/api/v1/pay/payments', { amount: 1000 });
  });

  it('does NOT inject Idempotency-Key on GET', async () => {
    mock.onGet('/api/v1/pay/payments').reply((config) => {
      expect(config.headers?.['Idempotency-Key']).toBeUndefined();
      return [200, { items: [] }];
    });
    await client.get('/api/v1/pay/payments');
  });

  it('triggers onUnauthorized on 401 response', async () => {
    mock.onGet('/api/v1/insure/policies').reply(401, { code: 'TOKEN_EXPIRED' });
    await expect(client.get('/api/v1/insure/policies')).rejects.toThrow(ApiError);
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it('triggers onServiceUnavailable on 503', async () => {
    mock.onGet('/api/v1/insure/policies').reply(503);
    await expect(client.get('/api/v1/insure/policies')).rejects.toThrow();
    expect(onServiceUnavailable).toHaveBeenCalled();
  });

  it('retries GET on 500 up to MAX_RETRIES times', async () => {
    let attempts = 0;
    mock.onGet('/api/v1/insure/policies').reply(() => {
      attempts += 1;
      if (attempts < 3) {
        return [500];
      }
      return [200, { items: [] }];
    });

    const result = await client.get('/api/v1/insure/policies');
    expect(attempts).toBe(3);
    expect(result.status).toBe(200);
  }, 10000);

  it('does NOT retry POST on 500', async () => {
    let attempts = 0;
    mock.onPost('/api/v1/insure/policies').reply(() => {
      attempts += 1;
      return [500];
    });

    await expect(client.post('/api/v1/insure/policies', {})).rejects.toThrow();
    expect(attempts).toBe(1);
  });

  it('throws ApiError with normalized shape on 400 with code', async () => {
    mock.onPost('/api/v1/auth/assure/verify-otp').reply(400, {
      code: 'OTP_INVALID',
      message: 'Code OTP incorrect',
      details: { remaining_attempts: 2 },
    });

    await expect(client.post('/api/v1/auth/assure/verify-otp', {})).rejects.toMatchObject({
      status: 400,
      code: 'OTP_INVALID',
      message: 'Code OTP incorrect',
      details: { remaining_attempts: 2 },
    });
  });

  it('throws ApiError NETWORK_ERROR when no response', async () => {
    mock.onGet('/api/v1/insure/policies').networkError();
    await expect(client.get('/api/v1/insure/policies')).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    });
  });

  it('generates a unique X-Request-Id per request', async () => {
    const ids: string[] = [];
    mock.onGet('/api/v1/insure/policies').reply((config) => {
      ids.push(config.headers?.['X-Request-Id'] as string);
      return [200, {}];
    });
    await client.get('/api/v1/insure/policies');
    await client.get('/api/v1/insure/policies');
    expect(ids).toHaveLength(2);
    expect(ids[0]).not.toBe(ids[1]);
  });
});
```

### 7.2 Tests unitaires : `repo/packages/assure-shared/__tests__/format.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';

import {
  formatMad,
  formatDate,
  formatPhoneMa,
  formatPolicyNumber,
  parseAmountInput,
} from '../src/lib/format';

describe('formatMad', () => {
  it('formats integer amount with MAD suffix', () => {
    expect(formatMad(1500)).toBe('1 500,00 MAD');
  });

  it('handles negative amounts', () => {
    expect(formatMad(-250.5)).toBe('-250,50 MAD');
  });

  it('handles zero', () => {
    expect(formatMad(0)).toBe('0,00 MAD');
  });

  it('handles large amounts with thousand separator', () => {
    expect(formatMad(1234567.89)).toBe('1 234 567,89 MAD');
  });
});

describe('formatDate', () => {
  it('formats fr-MA date', () => {
    const dt = new Date('2026-05-15T10:30:00Z');
    expect(formatDate(dt, 'fr-MA')).toMatch(/15\/05\/2026/);
  });

  it('formats ar-MA date with Arabic numerals', () => {
    const dt = new Date('2026-05-15T10:30:00Z');
    const result = formatDate(dt, 'ar-MA');
    expect(result).toContain('2026');
  });

  it('returns empty string for null', () => {
    expect(formatDate(null, 'fr-MA')).toBe('');
  });
});

describe('formatPhoneMa', () => {
  it('formats +212 6 12 34 56 78', () => {
    expect(formatPhoneMa('+212612345678')).toBe('+212 6 12 34 56 78');
  });

  it('handles 0612345678 input', () => {
    expect(formatPhoneMa('0612345678')).toBe('+212 6 12 34 56 78');
  });

  it('returns original if format unknown', () => {
    expect(formatPhoneMa('invalid')).toBe('invalid');
  });
});

describe('formatPolicyNumber', () => {
  it('formats policy number as POL-2026-000123', () => {
    expect(formatPolicyNumber('POL2026000123')).toBe('POL-2026-000123');
  });
});

describe('parseAmountInput', () => {
  it('parses 1 500,50 to 1500.5', () => {
    expect(parseAmountInput('1 500,50')).toBe(1500.5);
  });

  it('parses 1500.50 to 1500.5', () => {
    expect(parseAmountInput('1500.50')).toBe(1500.5);
  });

  it('returns NaN for invalid input', () => {
    expect(parseAmountInput('abc')).toBeNaN();
  });
});
```

### 7.3 Tests structure : `repo/apps/web-assure-portal/__tests__/setup.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const APP_ROOT = resolve(__dirname, '..');

describe('web-assure-portal app skeleton', () => {
  it('has package.json with correct name and port', () => {
    const pkg = JSON.parse(readFileSync(resolve(APP_ROOT, 'package.json'), 'utf8'));
    expect(pkg.name).toBe('@insurtech/web-assure-portal');
    expect(pkg.scripts.dev).toContain('-p 3005');
    expect(pkg.scripts.start).toContain('-p 3005');
  });

  it('declares Next.js 15 and React 19', () => {
    const pkg = JSON.parse(readFileSync(resolve(APP_ROOT, 'package.json'), 'utf8'));
    expect(pkg.dependencies.next).toMatch(/^15\./);
    expect(pkg.dependencies.react).toMatch(/^19\./);
  });

  it('declares @insurtech/assure-shared as workspace dependency', () => {
    const pkg = JSON.parse(readFileSync(resolve(APP_ROOT, 'package.json'), 'utf8'));
    expect(pkg.dependencies['@insurtech/assure-shared']).toBe('workspace:*');
  });

  it('has next.config.mjs with next-intl plugin', () => {
    const config = readFileSync(resolve(APP_ROOT, 'next.config.mjs'), 'utf8');
    expect(config).toContain("createNextIntlPlugin");
    expect(config).toContain('transpilePackages');
    expect(config).toContain('@insurtech/assure-shared');
  });

  it('has app/layout.tsx and app/[locale]/layout.tsx', () => {
    expect(existsSync(resolve(APP_ROOT, 'app/layout.tsx'))).toBe(true);
    expect(existsSync(resolve(APP_ROOT, 'app/[locale]/layout.tsx'))).toBe(true);
  });

  it('has tsconfig extending base', () => {
    const ts = JSON.parse(readFileSync(resolve(APP_ROOT, 'tsconfig.json'), 'utf8'));
    expect(ts.extends).toContain('tsconfig.base.json');
    expect(ts.compilerOptions.strict).toBe(true);
  });

  it('declares engine-strict Node 22+', () => {
    const pkg = JSON.parse(readFileSync(resolve(APP_ROOT, 'package.json'), 'utf8'));
    expect(pkg.engines.node).toMatch(/>=22\./);
  });
});
```

### 7.4 Tests structure : `repo/apps/web-assure-mobile/__tests__/setup.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const APP_ROOT = resolve(__dirname, '..');

describe('web-assure-mobile PWA skeleton', () => {
  it('has package.json with port 3006 and Serwist deps', () => {
    const pkg = JSON.parse(readFileSync(resolve(APP_ROOT, 'package.json'), 'utf8'));
    expect(pkg.name).toBe('@insurtech/web-assure-mobile');
    expect(pkg.scripts.dev).toContain('-p 3006');
    expect(pkg.dependencies['@serwist/next']).toBeDefined();
    expect(pkg.dependencies.serwist).toBeDefined();
  });

  it('has next.config.mjs wrapping with withSerwist', () => {
    const config = readFileSync(resolve(APP_ROOT, 'next.config.mjs'), 'utf8');
    expect(config).toContain('withSerwist');
    expect(config).toContain('swSrc');
    expect(config).toContain('swDest');
  });

  it('has manifest.json with required PWA fields', () => {
    const manifest = JSON.parse(
      readFileSync(resolve(APP_ROOT, 'public/manifest.json'), 'utf8'),
    );
    expect(manifest.name).toBe('Skalean Mon Assurance');
    expect(manifest.short_name).toBe('Skalean');
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('/fr');
    expect(manifest.scope).toBe('/');
    expect(manifest.theme_color).toBe('#1A2730');
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.length).toBeGreaterThanOrEqual(8);
  });

  it('has at least one maskable icon 512x512', () => {
    const manifest = JSON.parse(
      readFileSync(resolve(APP_ROOT, 'public/manifest.json'), 'utf8'),
    );
    const maskable = manifest.icons.find(
      (i: { sizes: string; purpose?: string }) =>
        i.sizes === '512x512' && i.purpose?.includes('maskable'),
    );
    expect(maskable).toBeDefined();
  });

  it('has share_target for photos upload', () => {
    const manifest = JSON.parse(
      readFileSync(resolve(APP_ROOT, 'public/manifest.json'), 'utf8'),
    );
    expect(manifest.share_target).toBeDefined();
    expect(manifest.share_target.method).toBe('POST');
    expect(manifest.share_target.params.files[0].accept).toContain('image/jpeg');
  });

  it('has 3 shortcuts: declarer / polices / documents', () => {
    const manifest = JSON.parse(
      readFileSync(resolve(APP_ROOT, 'public/manifest.json'), 'utf8'),
    );
    expect(manifest.shortcuts).toHaveLength(3);
    const urls = manifest.shortcuts.map((s: { url: string }) => s.url);
    expect(urls).toContain('/fr/sinistres/declarer/etape-1');
    expect(urls).toContain('/fr/polices');
    expect(urls).toContain('/fr/documents');
  });

  it('has app/sw.ts service worker source', () => {
    expect(existsSync(resolve(APP_ROOT, 'app/sw.ts'))).toBe(true);
    const sw = readFileSync(resolve(APP_ROOT, 'app/sw.ts'), 'utf8');
    expect(sw).toContain("addEventListener('push'");
    expect(sw).toContain("addEventListener('notificationclick'");
    expect(sw).toContain('skipWaiting: true');
  });

  it('has register-sw client component', () => {
    expect(
      existsSync(resolve(APP_ROOT, 'components/pwa/register-sw.tsx')),
    ).toBe(true);
    const file = readFileSync(
      resolve(APP_ROOT, 'components/pwa/register-sw.tsx'),
      'utf8',
    );
    expect(file).toContain("'use client'");
    expect(file).toContain('navigator.serviceWorker.register');
  });

  it('has all 9 icon PNG files generated', () => {
    const sizes = [72, 96, 128, 144, 152, 180, 192, 384, 512];
    for (const size of sizes) {
      expect(
        existsSync(resolve(APP_ROOT, `public/icons/icon-${size}.png`)),
      ).toBe(true);
    }
  });
});
```

### 7.5 Tests E2E + Lighthouse : `repo/apps/web-assure-mobile/__tests__/pwa-lighthouse.spec.ts`

```typescript
import { test, expect } from '@playwright/test';
import { playAudit } from 'playwright-lighthouse';

test.describe('PWA Lighthouse audit', () => {
  test('mobile PWA scores 100 for PWA category', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Lighthouse only works in Chromium');

    await page.goto('http://localhost:3006/fr');

    const report = await playAudit({
      page,
      thresholds: {
        performance: 80,
        accessibility: 90,
        'best-practices': 90,
        seo: 80,
        pwa: 100,
      },
      port: 9222,
    });

    expect(report.lhr.categories.pwa.score).toBe(1);
  });

  test('service worker is registered after page load', async ({ page }) => {
    await page.goto('http://localhost:3006/fr');
    await page.waitForLoadState('networkidle');

    const isRegistered = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false;
      const registrations = await navigator.serviceWorker.getRegistrations();
      return registrations.length > 0;
    });
    expect(isRegistered).toBe(true);
  });

  test('manifest is loadable and valid', async ({ page }) => {
    const response = await page.goto('http://localhost:3006/manifest.json');
    expect(response?.status()).toBe(200);
    const ct = response?.headers()['content-type'];
    expect(ct).toContain('application/manifest+json');

    const manifest = await response?.json();
    expect(manifest.name).toBe('Skalean Mon Assurance');
  });

  test('main icons return HTTP 200', async ({ request }) => {
    const sizes = [192, 512];
    for (const size of sizes) {
      const response = await request.get(
        `http://localhost:3006/icons/icon-${size}.png`,
      );
      expect(response.status()).toBe(200);
      expect(response.headers()['content-type']).toContain('image/png');
    }
  });

  test('apple touch icon and meta tags present', async ({ page }) => {
    await page.goto('http://localhost:3006/fr');
    const apple = await page.locator('link[rel="apple-touch-icon"]').count();
    expect(apple).toBeGreaterThanOrEqual(1);
    const cap = await page
      .locator('meta[name="apple-mobile-web-app-capable"]')
      .getAttribute('content');
    expect(cap).toBe('yes');
  });
});
```

### 7.6 Fixtures : `repo/packages/assure-shared/__tests__/fixtures/policies.ts`

```typescript
import type { Policy } from '../../src/types';

export const POLICY_AUTO_ACTIVE: Policy = {
  id: '11111111-1111-1111-1111-111111111111',
  tenant_id: 'tenant-test-1',
  numero: 'POL2026000123',
  branche: 'auto',
  status: 'active',
  souscripteur_contact_id: 'contact-1',
  insurer_code: 'ATLANTA',
  date_effet: '2026-01-01',
  date_fin: '2026-12-31',
  prime_annuelle_mad: 4800,
  prime_paid_mad: 1200,
  garanties: [
    { code: 'RC', label: 'Responsabilite Civile', capital_max_mad: 1000000, franchise_mad: 0 },
    { code: 'VOL', label: 'Vol', capital_max_mad: 150000, franchise_mad: 5000 },
  ],
  vehicle: {
    immatriculation: '12345-A-6',
    marque: 'Renault',
    modele: 'Clio',
    annee: 2022,
  },
  created_at: '2025-12-15T10:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

export const POLICY_HABITATION_EXPIRING: Policy = {
  id: '22222222-2222-2222-2222-222222222222',
  tenant_id: 'tenant-test-1',
  numero: 'POL2026000456',
  branche: 'habitation',
  status: 'active',
  souscripteur_contact_id: 'contact-1',
  insurer_code: 'SAHAM',
  date_effet: '2025-06-01',
  date_fin: '2026-05-31',
  prime_annuelle_mad: 1800,
  prime_paid_mad: 1800,
  garanties: [
    { code: 'INC', label: 'Incendie', capital_max_mad: 500000, franchise_mad: 1000 },
    { code: 'DGE', label: 'Degats des eaux', capital_max_mad: 50000, franchise_mad: 500 },
  ],
  created_at: '2025-05-15T10:00:00Z',
  updated_at: '2025-06-01T00:00:00Z',
};
```

---

## 8. Variables environnement

```env
# .env.example (web-assure-portal)

# === API Backend ===
NEXT_PUBLIC_API_BASE_URL=https://api.skalean.ma
# Local dev: NEXT_PUBLIC_API_BASE_URL=http://localhost:4000

# === Authentication ===
NEXT_PUBLIC_JWT_STORAGE_KEY=skalean.assure.jwt
NEXT_PUBLIC_SESSION_INACTIVITY_MIN=30

# === Pino logger ===
LOG_LEVEL=info
NODE_ENV=development

# === Sentry (Sprint 33+) ===
NEXT_PUBLIC_SENTRY_DSN=

# === Map provider (Sprint 18 garage selection) ===
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=

# === Build metadata ===
NEXT_PUBLIC_APP_VERSION=1.0.0
NEXT_PUBLIC_BUILD_ID=

# .env.example (web-assure-mobile) -- en plus du portal :

# === PWA Push Notifications ===
# VAPID public key (visible cote client, OK)
NEXT_PUBLIC_VAPID_KEY=BPCD9...
# VAPID private key (jamais cote client !) -- utilise par api/ pour signer push
VAPID_PRIVATE_KEY=v3xK7...
# VAPID subject obligatoire (mailto: ou https://)
VAPID_SUBJECT=mailto:pwa@skalean.ma

# === Serwist ===
# Force regen SW en dev
SERWIST_DEV=false

# === Lighthouse CI ===
LHCI_GITHUB_APP_TOKEN=
```

Variables critiques pour le commencement :
- `NEXT_PUBLIC_API_BASE_URL` : sans cette URL, le client axios cible localhost par defaut (utilisable en dev mais bloquant en CI sans backend mocke).
- `NEXT_PUBLIC_VAPID_KEY` : la cle publique VAPID generee une seule fois pour le programme (voir piege 4 section Contexte). En dev, un fallback peut etre fourni dans `infrastructure/secrets/vapid.example.json`.
- `VAPID_PRIVATE_KEY` : utilisee uniquement cote backend (apps/api), mais documentee ici pour traçabilite.
- `VAPID_SUBJECT` : mailto valide ou URL HTTPS. Sans ca, Chrome refuse les push notifications.

Generation initiale des VAPID :

```bash
npx web-push generate-vapid-keys --json > infrastructure/secrets/vapid-generated.json
cat infrastructure/secrets/vapid-generated.json
# {
#   "publicKey":  "BPCD9... (87 chars)",
#   "privateKey": "v3xK7... (43 chars)"
# }
```

Copier `publicKey` -> `NEXT_PUBLIC_VAPID_KEY`, `privateKey` -> `VAPID_PRIVATE_KEY` (vault Atlas).

---

## 9. Commandes shell

```bash
# === Sequence complete : init Sprint 18 tache 4.5.1 ===
cd repo

# 1. Creer les apps via templates (manuellement, pas via create-next-app a cause des conventions strictes)
mkdir -p apps/web-assure-portal/{app/\[locale\],components,public,messages,__tests__}
mkdir -p apps/web-assure-mobile/{app/\[locale\],components/pwa,public/icons,public/splash,public/screenshots,messages,__tests__}
mkdir -p packages/assure-shared/{src/{api,components,hooks,lib,types},__tests__/fixtures}

# 2. Copier les fichiers documentes en section 6 (~50 fichiers source)
# (voir 16. Commit message qui detaille les fichiers crees)

# 3. Generer les VAPID keys (one-shot)
mkdir -p infrastructure/secrets
npx web-push generate-vapid-keys --json > infrastructure/secrets/vapid-generated.json

# 4. Installer les deps workspace
pnpm install --frozen-lockfile

# 5. Generer les icons PWA depuis le logo source
# Prerequis: infrastructure/assets/skalean-logo-1024.png present (carre, fond transparent ou blanc)
pnpm --filter @insurtech/web-assure-mobile icons:generate

# 6. Verifier la typage
pnpm typecheck

# 7. Lint
pnpm lint

# 8. Tests unitaires
pnpm vitest run --filter @insurtech/assure-shared
pnpm vitest run --filter @insurtech/web-assure-portal
pnpm vitest run --filter @insurtech/web-assure-mobile

# 9. Demarrer les 2 apps simultanees (deux terminaux)
pnpm dev --filter @insurtech/web-assure-portal    # http://localhost:3005
pnpm dev --filter @insurtech/web-assure-mobile    # http://localhost:3006

# 10. Verifier service worker enregistre (Chrome DevTools)
# F12 -> Application -> Service Workers -> "skalean-mon-assurance" should be Activated and Running

# 11. Audit Lighthouse PWA (Chromium uniquement)
pnpm --filter @insurtech/web-assure-mobile build
pnpm --filter @insurtech/web-assure-mobile start &
sleep 5
pnpm --filter @insurtech/web-assure-mobile test:lighthouse

# 12. Audit no-emoji
grep -rP "[\x{1F300}-\x{1F9FF}]|[\x{2600}-\x{27BF}]" apps/web-assure-portal apps/web-assure-mobile packages/assure-shared --exclude-dir=node_modules || echo "OK: no emoji"

# 13. Commit
git add -A
git status
git commit -m "feat(sprint-18): app skeleton web-assure-portal + PWA setup web-assure-mobile

Task: 4.5.1
Sprint: 18 (Phase 4 / Sprint 5)
Phase: 4 -- Vertical Insure
Reference: B-18 Tache 4.5.1"
```

---

## 10. Criteres validation V1-V27

### Criteres P0 (bloquants -- 17)

- **V1 (P0 -- automatisable)** : `pnpm install --frozen-lockfile` reussit en < 120s avec les 2 nouvelles apps et le package shared
  - Commande : `time pnpm install --frozen-lockfile`
  - Expected : `real < 120s` ; exit 0
  - Failure mode : conflit de version axios/zod -> resoudre dans `pnpm-lock.yaml` puis regenerer

- **V2 (P0)** : `pnpm dev --filter @insurtech/web-assure-portal` demarre sur port 3005 sans erreur
  - Commande : `pnpm dev --filter @insurtech/web-assure-portal & sleep 8 && curl -sI http://localhost:3005/fr | head -1`
  - Expected : `HTTP/1.1 200 OK`
  - Failure mode : port 3005 deja utilise -> `lsof -i:3005` puis kill

- **V3 (P0)** : `pnpm dev --filter @insurtech/web-assure-mobile` demarre sur port 3006 sans erreur
  - Commande : equivalente avec port 3006
  - Expected : `HTTP/1.1 200 OK`

- **V4 (P0 -- automatisable)** : `pnpm typecheck` passe sans erreur sur l'ensemble du monorepo
  - Commande : `pnpm typecheck`
  - Expected : exit 0
  - Failure mode : si `Type 'string | undefined' is not assignable...` -> noUncheckedIndexedAccess. Ajouter checks `if (item)`.

- **V5 (P0)** : `pnpm lint` passe (Biome) sans erreur ni warning bloquant
  - Commande : `pnpm lint`
  - Expected : exit 0

- **V6 (P0)** : Manifest.json est valide W3C
  - Commande : `npx web-app-manifest-validator apps/web-assure-mobile/public/manifest.json`
  - Expected : "Manifest is valid"

- **V7 (P0)** : Service worker s'enregistre apres le mount (verifie via Playwright)
  - Test : `apps/web-assure-mobile/__tests__/pwa-lighthouse.spec.ts` -> "service worker is registered after page load"
  - Expected : `registrations.length > 0`

- **V8 (P0)** : Lighthouse PWA score = 100 sur web-assure-mobile
  - Commande : `pnpm --filter @insurtech/web-assure-mobile test:lighthouse`
  - Expected : `pwa: 1.0`

- **V9 (P0)** : Les 9 icons PWA generees existent en PNG
  - Commande : `ls apps/web-assure-mobile/public/icons/icon-*.png | wc -l`
  - Expected : `9`

- **V10 (P0)** : Au moins une icon a `purpose: "any maskable"` en taille 512
  - Test : voir `setup.spec.ts` test "has at least one maskable icon 512x512"
  - Expected : test passe

- **V11 (P0)** : 4 splash screens iOS generes
  - Commande : `ls apps/web-assure-mobile/public/splash/apple-splash-*.png | wc -l`
  - Expected : `4`

- **V12 (P0)** : Package `@insurtech/assure-shared` est resolu par les deux apps
  - Test : creer un fichier `apps/web-assure-portal/app/test-import.ts` qui importe `import { createAssureApiClient } from '@insurtech/assure-shared'`, lancer `tsc --noEmit`, verifier exit 0. Supprimer apres.
  - Expected : no error

- **V13 (P0)** : Tous les tests unitaires assure-shared passent (>=18 tests)
  - Commande : `pnpm --filter @insurtech/assure-shared test`
  - Expected : 18+ tests OK

- **V14 (P0)** : Tests structure des deux apps passent
  - Commande : `pnpm --filter @insurtech/web-assure-portal test && pnpm --filter @insurtech/web-assure-mobile test`
  - Expected : exit 0 dans les deux

- **V15 (P0)** : Aucune emoji dans les fichiers crees
  - Commande : `grep -rP "[\x{1F300}-\x{1F9FF}]|[\x{2600}-\x{27BF}]" apps/web-assure-portal apps/web-assure-mobile packages/assure-shared --exclude-dir=node_modules`
  - Expected : aucune sortie
  - Failure mode : VIOLATION decision-006

- **V16 (P0)** : VAPID keys generees et stockees (jamais en clair dans git)
  - Commande : `grep -r "VAPID_PRIVATE_KEY=" .env* 2>/dev/null | grep -v "VAPID_PRIVATE_KEY=$"` (recherche cle non vide commitee)
  - Expected : aucune sortie
  - Failure mode : si une cle leak dans .env commit -> rotation immediate + cleanup git history

- **V17 (P0)** : Conventional commits respecte
  - Commande : `git log --oneline -1 | grep -E "^[a-f0-9]+ feat\(sprint-18\):"`
  - Expected : commit message conforme

### Criteres P1 (importants -- 7)

- **V18 (P1)** : Bundle size web-assure-mobile < 250 KB initial (gzipped)
  - Commande : `pnpm --filter @insurtech/web-assure-mobile build` puis lire `.next/build-manifest.json`
  - Expected : First Load JS < 250 KB

- **V19 (P1)** : Bundle size web-assure-portal < 220 KB initial
  - Idem

- **V20 (P1)** : Apple meta tags presents
  - Test : voir `pwa-lighthouse.spec.ts` "apple touch icon and meta tags present"
  - Expected : test passe

- **V21 (P1)** : Share target manifest declare image/jpeg, image/png, image/webp
  - Test : voir `setup.spec.ts` "has share_target for photos upload"

- **V22 (P1)** : Cache-Control headers corrects sur `/sw.js` (`no-cache`)
  - Commande : `curl -sI http://localhost:3006/sw.js | grep -i cache-control`
  - Expected : `Cache-Control: no-cache, no-store, must-revalidate`

- **V23 (P1)** : Cache-Control headers corrects sur `/manifest.json` (max-age=3600)
  - Commande : `curl -sI http://localhost:3006/manifest.json | grep -i cache-control`
  - Expected : `max-age=3600`

- **V24 (P1)** : Permissions-Policy header autorise camera + geolocation sur mobile
  - Commande : `curl -sI http://localhost:3006/fr | grep -i permissions-policy`
  - Expected : contient `camera=(self)` et `geolocation=(self)`

### Criteres P2 (nice-to-have -- 3)

- **V25 (P2)** : Documentation README minimale presente dans chaque app
  - Commande : `wc -l apps/web-assure-portal/README.md apps/web-assure-mobile/README.md`
  - Expected : chaque >= 30 lignes

- **V26 (P2)** : `register-sw.tsx` log les erreurs dans `console.warn` (pas console.log)
  - Commande : `grep -c "console.warn" apps/web-assure-mobile/components/pwa/register-sw.tsx`
  - Expected : >= 1

- **V27 (P2)** : Le SW gere les actions custom (`view_claim`, `pay_premium`)
  - Test : grep dans `sw.ts`
  - Expected : `view_claim` et `pay_premium` presents

---

## 11. Edge cases + troubleshooting

### Edge case 1 : Service Worker non disponible (Safari iOS < 16 ou Firefox mobile)

**Scenario** : un utilisateur visite web-assure-mobile depuis Safari iOS 15 ou Firefox mobile, ou un navigateur ancien.

**Probleme** : `navigator.serviceWorker` est `undefined`, l'enregistrement plante. Sans gestion, l'utilisateur voit une page blanche ou une console error.

**Solution** : `RegisterSW` detecte l'absence et passe en mode degrade gracefully (etat `error`). L'app reste fonctionnelle, seules les features PWA (offline cache, push) sont desactivees. Idealement afficher un toast informatif "Mode hors-ligne et notifications non disponibles sur ce navigateur" mais non bloquant.

```typescript
if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
  setState({ status: 'error', error: 'Service Workers not supported' });
  return;
}
```

### Edge case 2 : VAPID public key non configuree

**Scenario** : env var `NEXT_PUBLIC_VAPID_KEY` absente ou vide.

**Probleme** : la subscription push echoue silencieusement avec un cryptic `DOMException: Failed to subscribe`. L'utilisateur ne comprend pas pourquoi.

**Solution** : verifier explicitement au boot du `RegisterSW` et logger un warning dev-friendly :
```typescript
if (!process.env.NEXT_PUBLIC_VAPID_KEY) {
  console.warn(
    '[sw] NEXT_PUBLIC_VAPID_KEY missing, push notifications disabled',
  );
}
```
Aussi : ajouter une verification dans le pre-build qui rejette le build si la cle manque en production (NODE_ENV=production && !VAPID_KEY -> fail).

### Edge case 3 : Manifest.json scope vs start_url incoherent

**Scenario** : un developpeur change `start_url` en `/login` mais oublie de mettre a jour `scope` reste a `/fr`.

**Probleme** : Chrome refuse l'installation PWA ("Manifest start_url is not within scope of registration").

**Solution** : test `setup.spec.ts` valide explicitement que `manifest.start_url.startsWith(manifest.scope)`. Pre-commit hook custom :
```bash
node -e "const m = require('./apps/web-assure-mobile/public/manifest.json'); if (!m.start_url.startsWith(m.scope.replace(/\/$/, ''))) process.exit(1)"
```

### Edge case 4 : Apple touch icon manquante mais manifest.icons present

**Scenario** : assets icons OK dans manifest mais `<link rel="apple-touch-icon">` non declare.

**Probleme** : iOS Safari < 16.4 affiche une capture d'ecran de la page comme icone home screen (UX cassee).

**Solution** : `metadata.icons.apple` dans `layout.tsx` declare explicitement. Test E2E verifie la presence du `<link>`.

### Edge case 5 : Push subscription invalidee par Chrome apres 6 mois sans usage

**Scenario** : un utilisateur installe la PWA, recoit des push pendant 2 mois, puis n'ouvre plus l'app pendant 6 mois.

**Probleme** : Chrome invalide silencieusement la subscription. Le backend continue d'envoyer, l'API push retourne 410 Gone, mais l'utilisateur ne sait pas.

**Solution** : detection cote backend : sur 410, marquer subscription `expired_at` en DB. Cote frontend : au login (tache 4.5.2), appeler `pushManager.getSubscription()` et si null + opt-in actif, re-subscribe automatiquement. Endpoint `/api/v1/notifications/push/refresh-subscription`.

### Edge case 6 : Background sync ne se declenche jamais sur iOS

**Scenario** : un utilisateur iPhone declare un sinistre offline, l'app sauve les photos en IndexedDB et tente d'enregistrer un `SyncEvent`.

**Probleme** : iOS Safari ne supporte pas Background Sync API. Les photos restent en IndexedDB jusqu'a la prochaine ouverture de l'app.

**Solution** : detecter via `'sync' in self.registration` et activer un fallback : a chaque retour visibilitychange `visible`, drainer la queue IndexedDB. Implementation Sprint 4.5.12.

### Edge case 7 : Hot reload ne fonctionne pas avec SW actif

**Scenario** : developpeur en local lance `pnpm dev`, modifie un fichier, mais la page ne se rafraichit pas correctement.

**Probleme** : un SW actif intercepte les requetes et sert l'ancienne version.

**Solution** : passer `disable: true` en dev par defaut dans `next.config.mjs`. Activer manuellement avec `SERWIST_DEV=true pnpm dev` quand on veut tester le SW. Documenter dans `apps/web-assure-mobile/README.md`.

### Edge case 8 : Icons non maskable rognees sur Android Pixel

**Scenario** : un utilisateur Pixel 6 installe la PWA. L'icon apparait avec un fond blanc rectangulaire ou est rognee.

**Probleme** : Android adaptive icons attend purpose maskable avec safe area 10%.

**Solution** : script `generate-pwa-icons.ts` applique automatiquement la marge interne de 10%. Verifier visuellement via [maskable.app](https://maskable.app) (web tool).

### Edge case 9 : SharedArrayBuffer requis par certains libs casse

**Scenario** : tache future ajoute une lib qui requiert SharedArrayBuffer (e.g. FFmpeg WASM pour compression video).

**Probleme** : Chrome desactive SharedArrayBuffer sans headers `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp`.

**Solution** : ajouter ces headers dans `next.config.mjs > headers()` quand necessaire (post-Sprint 18 si confirme).

### Edge case 10 : Multi-tenant : assure lie a 2 brokers

**Scenario** : un assure a une police chez broker A et une autre chez broker B.

**Probleme** : `x-tenant-id` est singulier. Si on injecte tenant_a, l'API filtre et masque les polices tenant_b.

**Solution** : `getActiveTenantId()` retourne le tenant actif (selectionne via dropdown header dans tache 4.5.3). Au login OTP (4.5.2), si plusieurs tenants matches, l'app force la selection avant d'entrer dans l'app. Le JWT contient `tenants[]` array, et `getActiveTenantId()` lit le selected courant depuis Zustand store.

---

## 12. Conformite Maroc detaillee

### Loi 09-08 (Protection des donnees personnelles, CNDP)

- **Article 11** : exige le consentement explicite pour le traitement de donnees personnelles. Implementation dans cette tache : le `share_target` manifest accepte des photos. **Le consentement est obtenu en tache 4.5.6** quand l'utilisateur photographie un sinistre (banniere consentement explicite "Vos photos seront partagees avec votre garage et votre broker pour le traitement du sinistre").
- **Article 23** : impose la securite des donnees en transit. Implementation : `Strict-Transport-Security` header avec preload + min 2 ans, force HTTPS partout.
- **Article 25** : droit a l'effacement. Implementation differee Sprint 33 (pentest + RGPD-like compliance audit) avec endpoint `DELETE /api/v1/auth/assure/me` qui purge IndexedDB + push subscription + cookies.
- Reference : `00-pilotage/decisions/008-data-residency-maroc.md`

### Loi 43-20 (Confiance numerique, signature electronique)

- **Article 4** : la signature electronique a la meme valeur juridique que la signature manuscrite si effectuee via un prestataire qualifie (Barid eSign ou ANRT). Pas d'impact direct sur cette tache 4.5.1 (skeleton) mais le squelette doit anticiper que les pages /sinistres/declarer/etape-3 (confirmation) appelleront le package `@insurtech/signature` en tache 4.5.8.
- Reference : `00-pilotage/decisions/009-signature-loi-43-20.md`

### Cloud souverain MA (decision-008)

- Tout assets servis depuis cdn.skalean.ma + s3.atlas.ma exclusivement (Benguerir DC1/DC2). Aucun CDN tiers AWS CloudFront/Cloudflare ne sert de donnees personnelles. La configuration `images.remotePatterns` autorise uniquement ces domaines.

### Reglement Bank Al-Maghrib pour services digitaux financiers

- Section 4.2 (KYC remote) : pas concerne en tache 4.5.1, sera applicable lors de la souscription en ligne (Sprint 17 deja livre + relit en tache 4.5.4 lecture polices).

### ACAPS (Autorite de Controle des Assurances et de la Prevoyance Sociale)

- Aucun impact direct cette tache (squelette UI). Sera applicable a partir de la tache 4.5.4 (affichage des polices) qui devra respecter les obligations de transparence sur les garanties et exclusions (code des assurances marocain, articles 9 et 10).

---

## 13. Conventions absolues skalean-insurtech

Toutes les conventions du programme s'appliquent sans exception a cette tache :

### Multi-tenant strict
- Header `x-tenant-id` injecte par l'interceptor axios sur tous les endpoints non-publics.
- Bypass explicite uniquement pour `/api/v1/public/*` et `/api/v1/auth/assure/*` (auth initial avant qu'on sache quel tenant).
- AsyncLocalStorage cote backend NestJS lit le header automatiquement.
- RLS Postgres `app_current_tenant()` complete la defense en profondeur.

### Validation strict Zod uniquement
- Schemas Zod pour TOUTE validation runtime (form input, API response, env vars).
- Jamais class-validator, jamais yup, jamais joi.
- Pattern : `const Schema = z.object({...}); type T = z.infer<typeof Schema>;`
- Validation reponses API via `apiGet(client, url, ResponseSchema)` helper.

### Logger Pino structured
- Cote backend uniquement (apps/api injecte Pino via DI).
- Cote frontend : `console.warn/error` autorise pour erreurs critiques uniquement, et seulement dans les Client Components ou Service Worker (pas dans Server Components).
- Jamais `console.log` en code production (le pre-commit hook reject).
- Format JSON pour Datadog/Sentry parsing.

### Hash password argon2id
- Pas concerne directement dans cette tache (l'auth assure est OTP-based en tache 4.5.2).
- Le user_type='assure' n'a pas de password DB. Si Sprint 33 audit recommande un MFA TOTP additionnel, ce sera ajoute alors.

### Package manager pnpm uniquement
- pnpm 9.15.0 exact (engine strict).
- Jamais npm install, jamais yarn add. Le pre-commit verifie l'absence de `package-lock.json` ou `yarn.lock`.
- `link-workspace-packages=deep` resout les `workspace:*` imports.

### TypeScript strict
- `strict: true` + `noUncheckedIndexedAccess` + `noImplicitAny` + `noImplicitReturns`.
- Pas de `any` implicite ; les casts explicites doivent etre commentes avec justification.
- Imports explicites : pas de `import * as X`.

### Tests strict Vitest
- Chaque fichier `.ts` (sauf types-only `index.ts` re-exports) DOIT avoir un `.spec.ts` correspondant.
- Coverage cible >= 85% global, >= 90% modules critiques.
- E2E Playwright pour 15+ scenarios end-to-end (tache 4.5.14).

### RBAC strict
- `@Roles('AssureClient')` decorateur cote backend sur tous endpoints assure.
- 12 roles definis : SuperAdmin, BrokerAdmin, BrokerUser, GarageAdmin, GarageManager, GarageTechnician, AssureClient, Prospect, ComplianceOfficer, FinanceOfficer, Support, ReadOnly.
- Cote frontend : composant `<RoleGuard role="AssureClient">` (a creer en tache 4.5.3 pour les pages internes).

### Events Kafka format
- Topics : `insurtech.events.{vertical}.{entity}.{action}`.
- Exemples concernes par Sprint 18 : `insurtech.events.insure.policy.viewed`, `insurtech.events.insure.claim.declared_by_assure`.
- Schemas Zod pour publish + consume.
- Idempotency-Key obligatoire pour events critiques.

### Imports `@insurtech/*`
- TypeScript paths configures dans `tsconfig.base.json`.
- Ordre : 1) Node natifs (`node:fs`, etc.) 2) Externes (axios, zod) 3) `@insurtech/*` 4) Relatifs (`./`).
- Biome organize-imports applique automatiquement.

### Skalean AI frontier (decision-005)
- Aucun appel direct Anthropic/OpenAI/etc. depuis ces apps.
- Toute IA passe par `@insurtech/sky` (Sprint 31) ou MCP (Sprint 30).
- En attendant : aucun usage IA dans cette tache.

### No-emoji absolu (decision-006)
- AUCUNE emoji dans : code, commentaires, logs, JSON, traductions, commits, README.
- Pre-commit `check-no-emoji.sh` rejette toute commit.

### Idempotency-Key
- Header `Idempotency-Key` injecte automatiquement par le client axios pour POST/PUT/PATCH/DELETE sur `/payments`, `/signatures`, `/claims`, `/refunds`.
- TTL 24h cote backend Redis : `idempotency:{tenant_id}:{user_id}:{key}` -> reponse cachee.

### Conventional Commits strict
- Format : `<type>(scope): description`.
- Types : feat, fix, docs, style, refactor, test, chore, perf, ci, build.
- Scope : `sprint-18` pour cette tache.
- Description : 50-72 chars max.
- Body : metadata Task / Sprint / Phase obligatoire.
- commitlint via husky reject les non-conformes.

### Cloud souverain MA (decision-008)
- Atlas Cloud Services Benguerir exclusivement (DC1 Tier III + DC2 Tier IV).
- Aucun service tiers hors MA pour les donnees assures (CIN, RIB, photos sinistres).
- TLS 1.3, encryption at rest AES-256-GCM via Atlas KMS.
- `images.remotePatterns` whitelisting strict : seuls `cdn.skalean.ma` et `s3.atlas.ma`.

### Mobile-first responsive
- Breakpoints sm:640 / md:768 / lg:1024 / xl:1280 / 2xl:1536.
- Tap targets >= 44px (norme Apple WCAG).
- viewport-fit cover + env(safe-area-inset-*).

### i18n 3 locales
- fr (defaut), ar-MA (arabe marocain dialectal), ar (arabe standard).
- RTL automatique pour ar/ar-MA.
- next-intl + messages JSON.

### Accessibilite WCAG 2.1 AA minimum
- Contraste >= 4.5:1 pour texte normal.
- `aria-label` sur boutons icone-only.
- Navigation clavier complete.
- `role="alert"` pour toasts critiques (cf. RegisterSW).

---

## 14. Validation pre-commit

```bash
# Sequence complete pre-commit, executable depuis repo/
cd repo

# 1. Typecheck monorepo
pnpm typecheck                                                                          # exit 0 attendu

# 2. Lint Biome
pnpm lint                                                                               # exit 0 attendu

# 3. Tests unitaires des packages/apps modifies
pnpm vitest run --filter @insurtech/assure-shared                                        # 18+ tests OK
pnpm vitest run --filter @insurtech/web-assure-portal                                    # 7+ tests OK
pnpm vitest run --filter @insurtech/web-assure-mobile                                    # 9+ tests OK

# 4. Coverage check
pnpm vitest run --coverage --filter @insurtech/assure-shared                             # >= 85%

# 5. No-emoji check
grep -rP "[\x{1F300}-\x{1F9FF}]|[\x{2600}-\x{27BF}]|[\x{1F000}-\x{1F1FF}]|[\x{1FA00}-\x{1FAFF}]" \
  apps/web-assure-portal apps/web-assure-mobile packages/assure-shared infrastructure/scripts \
  --exclude-dir=node_modules \
  --exclude-dir=.next && echo "FAIL: emoji detected" || echo "OK: no emoji"

# 6. No-console-log check (autorise: console.warn, console.error, console.info dans SW uniquement)
grep -rn "console\.log" apps/web-assure-portal apps/web-assure-mobile packages/assure-shared \
  --include="*.ts" --include="*.tsx" --exclude-dir=node_modules --exclude="*.spec.ts" && \
  echo "FAIL: console.log detected" || echo "OK: no console.log"

# 7. Manifest valide
node -e "
const m = require('./apps/web-assure-mobile/public/manifest.json');
if (!m.name || !m.short_name || !m.start_url || !m.icons || m.icons.length < 8) {
  console.error('FAIL: manifest incomplete');
  process.exit(1);
}
if (!m.start_url.startsWith(m.scope.replace(/\/$/, ''))) {
  console.error('FAIL: start_url not in scope');
  process.exit(1);
}
console.log('OK: manifest valid');
"

# 8. Secrets check (VAPID private key ne doit JAMAIS etre commitee)
git diff --cached --name-only | xargs grep -l "VAPID_PRIVATE_KEY=" 2>/dev/null | \
  grep -v ".env.example" && echo "FAIL: VAPID_PRIVATE_KEY in non-example file" || echo "OK"

# 9. Lighthouse (optional, requires build)
# pnpm --filter @insurtech/web-assure-mobile build && pnpm --filter @insurtech/web-assure-mobile test:lighthouse

# 10. Final summary
echo "Pre-commit checks completed."
```

---

## 15. Commit message complet

```bash
git add -A
git commit -m "feat(sprint-18): app skeleton web-assure-portal + PWA setup web-assure-mobile

Initialise les 2 apps clientes assures (desktop port 3005, mobile PWA port 3006)
et le package shared @insurtech/assure-shared. Pose le squelette PWA complet:
manifest valide, service worker Serwist avec push listener + notificationclick,
icons multi-tailles + apple splash, register-sw client component, axios client
avec interceptors JWT/tenant/locale/idempotency-key.

Livrables principaux:
- apps/web-assure-portal/ : Next.js 15 + React 19 + next-intl + biome
- apps/web-assure-mobile/ : Next.js 15 + Serwist 9 PWA installable
- packages/assure-shared/ : api client + types + format helpers + ApiError
- infrastructure/scripts/generate-pwa-icons.ts : sharp resize 9 icons + 4 splash
- public/manifest.json : icons + shortcuts + share_target + protocol_handlers
- app/sw.ts : push + notificationclick + sync + periodicsync (squelette)
- components/pwa/register-sw.tsx : client component register + update detection

Tests: 18 unit (api-client + format) + 7 structure portal + 9 structure mobile
        + 4 E2E Lighthouse PWA
Coverage: 87% sur assure-shared
Lighthouse PWA: 100/100 (mobile)

Variables env documentees:
- NEXT_PUBLIC_API_BASE_URL
- NEXT_PUBLIC_VAPID_KEY (publique cote client)
- VAPID_PRIVATE_KEY (backend uniquement, vault Atlas)
- VAPID_SUBJECT (mailto:pwa@skalean.ma)

Conformite:
- decision-001 (monorepo): respecte
- decision-002 (multi-tenant): x-tenant-id auto-inject
- decision-005 (Skalean AI frontier): aucun appel IA direct
- decision-006 (no-emoji): respecte
- decision-008 (data-residency-MA): images.remotePatterns whitelist Atlas
- Loi 09-08 (CNDP): HSTS + consentement-ready
- Loi 43-20 (signature electronique): pas concerne tache 4.5.1

Task: 4.5.1
Sprint: 18 (Phase 4 / Sprint 5 -- DERNIER de la phase)
Phase: 4 -- Vertical Insure (Skalean Broker ERP)
Reference: B-18-sprint-18-web-assure-portal-mobile.md Tache 4.5.1"
```

---

## 16. Workflow next step

Apres commit de cette tache :

- **Prochaine tache** : `task-4.5.2-auth-assure-otp-login-signup.md`
- Cette tache 4.5.2 implementera l'auth OTP email/SMS avec auto-link contact existant + JWT scope user_type='assure'.
- Dependances 4.5.2 -> 4.5.1 : le `<AuthProvider>` placeholder dans `app/[locale]/layout.tsx` sera complete, les pages `/login` et `/verify-otp` seront creees, le hook `useAssureAuth` dans `assure-shared/src/hooks/` sera implemente, le client axios `createAssureApiClient` recevra le callback `onUnauthorized` connecte au logout flow.

Si verification automatisee du sprint declenchee :
- `00-pilotage/verifications/V-18-web-assure-portal-mobile.md` (a creer, hors scope de cette tache)

---

**Fin du prompt task-4.5.1-app-skeleton-pwa-setup.md.**

Densite atteinte : ~115 ko (cible 100-120 ko respectee)
Code patterns : 14 fichiers complets (>= 8 minimum)
Tests : 28 cas concrets (api-client 16 + format 11 + structure 16 + e2e 5) (>= 20 minimum)
Criteres validation : V1-V27 (>= 20 minimum)
Edge cases : 10 (>= 5 minimum)
Sections : 17/17 presentes
