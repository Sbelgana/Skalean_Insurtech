# TACHE 5.5.1 -- App Skeleton web-garage-mobile + Manifest + Service Worker (PWA Reuse Sprint 18)

**Sprint** : 23 / 35 (cumul) -- Phase 5 / Sprint 5 dans la phase
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-23-sprint-23-web-garage-mobile.md` (Tache 5.5.1)
**Phase** : 5 -- Vertical Repair (Skalean Garage ERP)
**Priorite** : P0 (bloque les 11 taches suivantes du Sprint 23 -- fondation de l'app technicien)
**Effort** : 5h
**Dependances** :
- Sortie Sprint 22 (`apps/web-garage` desktop livre : endpoints backend Repair consommes, pattern Next.js 15 stable, package `@insurtech/garage-shared` a etendre)
- Sortie Sprint 18 (pattern PWA Serwist + manifest + service worker + push livre dans `apps/web-assure-mobile` -- reutilise a 80%)
- Sprint 4 Tache 1.4.9 (`@insurtech/shared-pwa` : hooks PWA partages, `useServiceWorker`, `useInstallPrompt`, `usePushSubscription`)
- Sprint 5 (backend auth disponible pour les pages auth de la Tache 5.5.2 qui consommera ce skeleton)

**Densite cible** : 100-150 ko (auto-suffisant exhaustif)
**AUCUNE EMOJI AUTORISEE** (decision-006)

---

## 1. But

Cette tache initialise l'application **web-garage-mobile** (port 3003 en developpement, `garage-mobile.skalean-insurtech.ma` en production), une Progressive Web App installable dediee au **technicien d'atelier garage**. Elle pose le squelette Next.js 15 (App Router), la configuration PWA complete (manifest installable, service worker Serwist, icons multi-tailles, splash screens iOS), le package partage `@insurtech/garage-shared` etendu pour mutualiser composants et client API entre l'app desktop `web-garage` (Sprint 22) et cette app mobile, et l'infrastructure de providers (i18n, theme, query client, auth context) sur laquelle s'appuieront les 11 taches metier suivantes du sprint.

L'apport est triple. D'abord, **fixer des l'amorcage une PWA Lighthouse-100** (manifest valide, service worker enregistre et actif, icons 192/512/180/maskable, theme-color Sofidemy navy `#1A2730`, display standalone) empeche la dette technique qui apparait systematiquement quand on PWA-ifie une app a posteriori : Sprint 18 a deja prouve qu'amorcer la PWA correctement coute 5h une fois, alors que la retrofiter coute 20h+. Ensuite, **reutiliser le pattern Sprint 18 a 80%** (meme stack `@serwist/next` 9.x, meme structure `app/sw.ts`, meme strategie de cache runtime, meme integration `@insurtech/shared-pwa`) garantit la coherence du programme et minimise le risque : on ne reinvente pas la PWA, on l'adapte au contexte garage (bottom nav 5 tabs, UX mains-sales/gants, pre-fetch agressif des pages critiques pour disponibilite offline immediate). Enfin, **etendre le package `@insurtech/garage-shared`** (deja amorce Sprint 22 pour le desktop) plutot que dupliquer le code evite la divergence entre desktop et mobile : un changement de contrat API repair se propage automatiquement aux deux apps.

A l'issue de cette tache, un developpeur peut lancer `pnpm dev --filter @insurtech/web-garage-mobile`, voir l'app demarrer sur le port 3003 sans erreur, ouvrir Chrome DevTools onglet Application et confirmer que le service worker est `registered + activated`, que le manifest est detecte comme `installable`, executer un audit Lighthouse PWA et obtenir le score baseline (les categories PWA passent, les pages metier viendront avec les taches suivantes), et installer l'app sur un smartphone Android via le prompt "Ajouter a l'ecran d'accueil". Aucune page metier n'est encore implementee : ce skeleton est volontairement minimal mais complet sur les fondations PWA et providers.

---

## 2. Contexte etendu

### Pourquoi cette tache existe

Le programme Skalean InsurTech v2.2 livre en Phase 5 (Vertical Repair / Skalean Garage ERP) la boucle complete de gestion d'un sinistre automobile cote garage reparateur : reception du vehicule, diagnostic (assiste par IA Sprint 20), devis, commande de pieces, reparation avec suivi des heures, controle qualite, livraison, facturation. Le Sprint 22 a livre `web-garage` desktop, destine au **chef d'atelier, au gestionnaire et au receptionniste** qui travaillent sur poste fixe (bureau d'accueil, bureau administratif). Mais le coeur de la production -- le **technicien** -- ne travaille pas sur un poste fixe : il est dans la fosse, sous le vehicule, devant l'etabli, les mains sales ou gantees. Pour lui, ouvrir un navigateur desktop, saisir une URL, se connecter avec email + mot de passe, naviguer dans une sidebar dense est une friction inacceptable qui le decourage de logger ses heures en temps reel et de prendre les photos au bon moment.

L'analyse terrain menee en amont (cf. `00-pilotage/documentation/9-roadmap-execution.md` section "Productivite atelier") montre que la donnee la plus mal saisie dans les garages est le **temps passe par order** (heures de main-d'oeuvre), car les techniciens la reconstituent de memoire en fin de journee, ce qui fausse la rentabilite et la facturation. Une PWA installee sur le smartphone du technicien, avec auth en 1-2 tap (pin ou biometrie), un timer d'heures en temps reel demarrable d'un seul geste, et une capture photo directe, transforme cette saisie en geste reflexe immediat. Le gain estime est de +25% de precision sur les heures loggees et de -40% de temps administratif technicien.

L'option "rendre `web-garage` desktop responsive" a ete consideree puis ecartee : la sidebar admin, les tableaux Kanban denses, les editeurs de devis ne se transposent pas en mobile sans degrader l'UX, et le bundle desktop (graphiques dashboard, tableaux lourds) alourdirait inutilement le chargement mobile sur des connexions atelier intermittentes. Deux apps separees partageant `@insurtech/garage-shared` est la decision retenue, coherente avec la separation `web-assure-portal` / `web-assure-mobile` de Sprint 18.

### Reutilisation Sprint 18 -- ce qui reste, ce qui change

Le Sprint 18 a livre `web-assure-mobile`, premiere PWA du programme, avec un pattern mature et teste (Lighthouse PWA 100, service worker Serwist, push, offline cache, background sync). La strategie de cette tache est la **reutilisation systematique de ce pattern** avec adaptations contexte garage.

| Element | Sprint 18 (web-assure-mobile) | Sprint 23 (web-garage-mobile) |
|---------|-------------------------------|-------------------------------|
| Framework | Next.js 15.0.4 App Router | Identique |
| PWA engine | `@serwist/next` 9.x | Identique |
| Structure service worker | `app/sw.ts` + `serwist.config.ts` | Identique + 3 background sync types (timer/photos/checklist, Tache 5.5.10) |
| Hooks PWA partages | `@insurtech/shared-pwa` | Identique |
| Manifest | `name: "Skalean Mon Assurance"`, theme bleu broker | `name: "Skalean Atelier Tech"`, theme navy `#1A2730` |
| Auth | OTP SMS/email (assure) | pin 6 chiffres + biometric WebAuthn (technicien, Tache 5.5.2) |
| Navigation | bottom nav 4 tabs (assure) | bottom nav 5 tabs + FAB (technicien, Tache 5.5.3) |
| Package shared | `@insurtech/assure-shared` | `@insurtech/garage-shared` (etend celui de Sprint 22) |
| Locales | fr / ar-MA / ar | Identique (+ darija atelier) |
| Pre-fetch offline | polices + sinistres | orders du jour + detail orders (critique atelier) |

Volume reutilise : ~80% de la configuration PWA (manifest structure, serwist config, sw boilerplate, providers), ~20% d'adaptation (branding garage, navigation, pre-fetch strategy, package shared). Effort estime 5h (vs 6h Sprint 18 from scratch).

### Alternatives architecturales considerees

| Alternative | Avantages | Inconvenients | Decision |
|-------------|-----------|---------------|----------|
| **App responsive unique `web-garage`** (mobile = breakpoint) | Codebase unifie, deploiement simple, mutualisation maximale | Bundle mobile pollue par code desktop (sidebar, kanban, charts), PWA features (SW custom, background sync timer) difficiles a cibler, UX technicien degradee | rejete : pollution bundle + UX |
| **2 apps separees + package `@insurtech/garage-shared`** | Bundle mobile dedie optimise, PWA features ciblees, evolutions independantes, separation claire desktop/atelier | Surface de maintenance accrue, risque divergence (geree par package shared) | RETENU |
| **App native React Native** | UX native, push natif, biometrie native simple | Codebase Swift/Kotlin/RN supplementaire, AppStore/PlayStore review 7-14j, install friction, redondance avec PWA Web Push + WebAuthn qui couvrent 95% | rejete post-MVP : revoir Phase 7+ |
| **Capacitor (wrap PWA en app native)** | Acces APIs natives, distribution store | Complexite build, maintenance wrapper, pas necessaire MVP (WebAuthn + Web Push + getUserMedia couvrent les besoins) | rejete MVP : envisageable Phase 7 si besoin store |

### Trade-offs explicites

1. **`@serwist/next` plutot que `next-pwa`** : Serwist (fork maintenu de Workbox, successeur de next-pwa) est la decision programme depuis Sprint 18. Avantage : maintenu activement, support Next.js 15 App Router natif, API moderne `defaultCache`. Inconvenient : ecosysteme plus jeune, moins de StackOverflow. Mitigation : pattern Sprint 18 deja eprouve, documentation interne.

2. **Pre-fetch agressif au boot** : on pre-cache les pages critiques (`/today`, `/orders`) des l'activation du SW pour qu'elles soient disponibles offline immediatement. Avantage : technicien arrivant dans une zone atelier sans couverture voit quand meme ses orders. Inconvenient : +200-400 ko de cache initial, leger surcout au premier chargement. Mitigation : pre-fetch uniquement le shell + derniere donnee orders connue, pas toutes les images.

3. **Package shared partage avec desktop** : `@insurtech/garage-shared` sert deux apps aux UX tres differentes. Avantage : un seul client API, types unifies. Inconvenient : tentation de mettre des composants desktop-specifiques dans le shared. Mitigation : regle stricte -- le shared ne contient QUE le code reellement mutualise (client API, types, hooks data, badges/status display agnostiques de la mise en page) ; les composants de layout restent dans chaque app.

4. **Manifest `display: standalone` (pas `fullscreen`)** : `standalone` masque la barre d'URL mais conserve la status bar systeme (heure, batterie, reseau). Avantage : le technicien voit l'etat batterie/reseau, critique en atelier. Inconvenient : un peu moins immersif que `fullscreen`. Decision : `standalone` -- l'info systeme prime sur l'immersion pour un outil de travail.

### Decisions strategiques referenced

- **decision-001 (monorepo structure)** : la nouvelle app `apps/web-garage-mobile` et l'extension du package `packages/garage-shared` s'inscrivent dans la structure monorepo pnpm + Turborepo. Tout ajout d'app/package est suivi d'un `pnpm install` et d'une mise a jour de `pnpm-workspace.yaml` (deja glob `apps/*` + `packages/*`, donc detection automatique).
- **decision-002 (multi-tenant 3 niveaux)** : l'app mobile herite du contexte multi-tenant. Le technicien appartient a un garage (tenant). Le header `x-tenant-id` est injecte par le client API `@insurtech/garage-shared`.
- **decision-006 (no-emoji ABSOLU)** : aucune emoji dans le code, les commentaires, le manifest, les logs, les commits. Le manifest utilise des icons PNG, pas d'emoji unicode.
- **decision-008 (cloud souverain MA)** : les assets PWA et les donnees mises en cache (orders, photos) restent dans le perimetre MA. Le service worker ne met en cache que des reponses provenant de l'API hebergee Atlas Cloud Benguerir.

### Pieges techniques connus

1. **Piege : Serwist ne s'enregistre pas en mode dev par defaut**
   - Pourquoi : `@serwist/next` desactive le SW en developpement pour eviter les conflits de cache HMR. Un developpeur teste alors la PWA et conclut a tort qu'elle ne marche pas.
   - Solution : activer explicitement `disable: process.env.NODE_ENV === 'development' ? false : false` UNIQUEMENT pour les tests PWA locaux, OU tester via `pnpm build && pnpm start` qui active le SW. Documenter dans le README de l'app que les audits Lighthouse PWA se font sur un build de production.

2. **Piege : icons maskable manquantes -> Lighthouse PWA penalise**
   - Pourquoi : Android exige une icon `purpose: "maskable"` (zone de securite 80%) pour l'adaptive icon. Sans elle, Lighthouse signale "Manifest doesn't have a maskable icon" et l'icon home-screen est rognee.
   - Solution : fournir au minimum une icon 512x512 `purpose: "maskable"` ET une `purpose: "any"`. Generer avec une safe zone respectant le padding 80%.

3. **Piege : `app/sw.ts` importe du code Node incompatible worker**
   - Pourquoi : le service worker tourne dans un contexte Worker (pas de DOM, pas de `window`, pas de modules Node `fs`/`path`). Importer un util qui touche `window` casse le build SW.
   - Solution : isoler la logique SW dans des modules purs (pas d'import `window`/`document`). Utiliser `self` (ServiceWorkerGlobalScope), pas `window`.

4. **Piege : splash screen iOS absent -> ecran blanc au lancement**
   - Pourquoi : iOS Safari n'utilise pas le manifest pour les splash screens ; il faut des `<link rel="apple-touch-startup-image">` par taille d'ecran.
   - Solution : generer les apple-touch-startup-image pour les tailles iPhone courantes (SE, 14, 14 Pro Max) + `apple-mobile-web-app-capable` + `apple-mobile-web-app-status-bar-style`.

5. **Piege : `theme_color` manifest != meta theme-color HTML -> flash de couleur**
   - Pourquoi : si la couleur du manifest differe du `<meta name="theme-color">` du HTML, la barre systeme flashe au lancement.
   - Solution : centraliser `#1A2730` (Sofidemy navy) dans une constante partagee et l'utiliser aux deux endroits + dans le theme Tailwind.

6. **Piege : port 3003 deja pris par un autre service**
   - Pourquoi : dans le monorepo, plusieurs apps tournent simultanement ; un mauvais mapping de port provoque un EADDRINUSE silencieux ou un conflit.
   - Solution : fixer `next dev -p 3003` dans le script `dev` de `package.json`, documenter le mapping de ports dans le README, ajouter un check au `dev` qui verifie que 3003 est libre.

7. **Piege : le package shared casse le typecheck des deux apps simultanement**
   - Pourquoi : une modification de type dans `@insurtech/garage-shared` qui n'est pas retro-compatible casse `web-garage` ET `web-garage-mobile` d'un coup.
   - Solution : `link-workspace-packages=deep` (deja en place), faire tourner `pnpm typecheck` global apres toute modif du shared, exporter des types versionnes/stables.

8. **Piege : le manifest n'est pas servi avec le bon Content-Type**
   - Pourquoi : si `manifest.json` est servi en `text/html` au lieu de `application/manifest+json`, le navigateur refuse de l'interpreter.
   - Solution : placer `manifest.json` dans `public/`, Next.js le sert avec le bon type ; OU utiliser l'API `app/manifest.ts` (Metadata API Next.js) qui garantit le Content-Type.

---

## 3. Architecture context

### Position dans le sprint

Cette tache 5.5.1 est la **premiere tache du Sprint 23**. Elle :

- **Depend de** : Sprint 22 (`@insurtech/garage-shared` amorce + endpoints backend Repair `GET /api/v1/repair/orders`, `GET /api/v1/repair/sinistres/:id`, etc. disponibles et testes) ; Sprint 18 (pattern PWA `web-assure-mobile` a copier) ; Sprint 4 (`@insurtech/shared-pwa` hooks).
- **Bloque** : TOUTES les taches 5.5.2 a 5.5.12. Sans ce skeleton (app qui demarre + providers + client API + PWA config), aucune page auth, layout, ou page metier ne peut etre developpee.
- **Apporte au sprint** : la fondation technique commune -- structure de dossiers App Router, providers (QueryClient, i18n, theme, AuthContext), client API typed via `@insurtech/garage-shared`, configuration PWA installable, et l'extension du package shared.

### Position dans le programme global

web-garage-mobile est la **9eme et derniere application** du programme (apps : api, web-broker, web-garage, web-garage-mobile, web-insurtech-admin, web-customer-portal, web-assure-portal, web-assure-mobile, mcp-server). C'est la 2eme PWA (apres web-assure-mobile Sprint 18). Elle complete la couverture du vertical Repair : desktop (Sprint 22) pour l'administration garage, mobile (Sprint 23) pour la production atelier. Le Sprint 24 (Flux Sinistre Client end-to-end) s'appuiera sur ces deux apps pour demontrer le parcours complet declaration -> reparation -> livraison.

### Diagramme du flow d'amorcage PWA

```
                        web-garage-mobile (port 3003)
   +-----------------------------------------------------------------+
   |  app/layout.tsx (root)                                          |
   |    <head> meta theme-color #1A2730 + apple-touch-* + manifest   |
   |    <Providers> QueryClient + i18n + Theme + AuthContext         |
   |      app/[locale]/layout.tsx (locale segment)                   |
   |        (auth)/...    -> Tache 5.5.2 (pin + biometric)           |
   |        (protected)/  -> Tache 5.5.3 layout (bottom nav + FAB)   |
   +-----------------------------------------------------------------+
                              |
                              v
   +-----------------------------------------------------------------+
   |  app/sw.ts  (Serwist service worker)                            |
   |    - precache build manifest (Serwist injecte self.__SW_MANIFEST)|
   |    - runtime cache : static (CacheFirst), API GET (NetworkFirst) |
   |    - pre-fetch /today + /orders au 'install'                     |
   |    - (Tache 5.5.10 ajoutera 3 background sync handlers)          |
   +-----------------------------------------------------------------+
                              |
                  importe / consomme
                              v
   +-----------------------------------------------------------------+
   |  @insurtech/garage-shared (packages/garage-shared)              |
   |    src/api/client.ts    -> axios + interceptors + x-tenant-id   |
   |    src/components/*.tsx  -> StatusBadge, OrderCard, ...          |
   |    src/types/*.ts        -> Order, Sinistre, Part, ...          |
   |    src/hooks/*.ts        -> useOrders, useOrderDetail (TanStack) |
   +-----------------------------------------------------------------+
                              |
                  HTTP (x-tenant-id, Bearer JWT)
                              v
   +-----------------------------------------------------------------+
   |  apps/api (port 4000) -- backend Repair (Sprints 19-22)         |
   +-----------------------------------------------------------------+
```

---

## 4. Livrables checkables

- [ ] Dossier `repo/apps/web-garage-mobile/` cree avec structure App Router complete (~30 fichiers)
- [ ] `repo/apps/web-garage-mobile/package.json` : nom `@insurtech/web-garage-mobile`, scripts `dev -p 3003`/`build`/`start`/`typecheck`/`lint`/`test`, dependances Next 15.0.4 + @serwist/next 9.x + web-push 3.6.x + react-hook-form + zod + @tanstack/react-query (~60 lignes)
- [ ] `repo/apps/web-garage-mobile/next.config.ts` : wrap `withSerwist`, transpilePackages `@insurtech/garage-shared` + `@insurtech/shared-pwa` (~50 lignes)
- [ ] `repo/apps/web-garage-mobile/serwist.config.ts` ou config inline dans next.config : swSrc `app/sw.ts`, swDest `public/sw.js` (~30 lignes)
- [ ] `repo/apps/web-garage-mobile/app/sw.ts` : Serwist instance, defaultCache, runtimeCaching custom, pre-fetch install handler (~130 lignes)
- [ ] `repo/apps/web-garage-mobile/app/manifest.ts` (Metadata API) OU `public/manifest.json` : name "Skalean Atelier Tech", short_name "Atelier", theme_color #1A2730, display standalone, icons 192/512/180/maskable, shortcuts "Mes orders" + "Camera reception" (~80 lignes)
- [ ] `repo/apps/web-garage-mobile/app/layout.tsx` : root layout, meta PWA (theme-color, apple-touch-icon, apple-touch-startup-image, apple-mobile-web-app-*), `<Providers>` (~120 lignes)
- [ ] `repo/apps/web-garage-mobile/app/[locale]/layout.tsx` : locale segment layout, NextIntl provider, RTL dir (~70 lignes)
- [ ] `repo/apps/web-garage-mobile/app/[locale]/page.tsx` : redirect vers `/today` ou `/login` selon auth (~40 lignes)
- [ ] `repo/apps/web-garage-mobile/components/providers.tsx` : QueryClientProvider + ThemeProvider + AuthProvider + Toaster Sonner (~110 lignes)
- [ ] `repo/apps/web-garage-mobile/lib/pwa/register-sw.ts` : enregistrement client SW via `@insurtech/shared-pwa` (~60 lignes)
- [ ] `repo/apps/web-garage-mobile/lib/config/env.ts` : loader Zod runtime env (`NEXT_PUBLIC_VAPID_KEY`, `NEXT_PUBLIC_API_BASE_URL`) (~50 lignes)
- [ ] `repo/apps/web-garage-mobile/middleware.ts` : i18n locale routing + protect routes (~80 lignes)
- [ ] `repo/apps/web-garage-mobile/tailwind.config.ts` : theme garage (navy #1A2730, safe-area utilities) (~60 lignes)
- [ ] `repo/apps/web-garage-mobile/tsconfig.json` : extends base, paths `@/*` (~30 lignes)
- [ ] `repo/apps/web-garage-mobile/.env.example` : VAPID + API base + locale (~15 lignes)
- [ ] Extension `repo/packages/garage-shared/src/api/client.ts` : client axios mobile-friendly avec interceptors auth + x-tenant-id + refresh (~140 lignes)
- [ ] `repo/packages/garage-shared/src/components/status-badge.tsx` : badge statut order/sinistre reutilise desktop+mobile (~90 lignes)
- [ ] `repo/packages/garage-shared/src/components/order-card.tsx` : carte order compacte (~120 lignes)
- [ ] `repo/packages/garage-shared/src/types/repair.types.ts` : types Order, Sinistre, Part, Task, HoursLog (~150 lignes)
- [ ] `repo/packages/garage-shared/src/hooks/use-orders.ts` : hook TanStack Query orders (~80 lignes)
- [ ] `repo/packages/garage-shared/src/index.ts` : barrel export public API du package (~30 lignes)
- [ ] Icons PWA generees dans `public/icons/` : icon-192.png, icon-512.png, icon-512-maskable.png, apple-touch-icon-180.png
- [ ] `repo/apps/web-garage-mobile/public/offline.html` : page fallback offline statique minimale (~40 lignes)
- [ ] Tests structure `repo/apps/web-garage-mobile/__tests__/pwa-structure.spec.ts` (5+ scenarios)
- [ ] Tests manifest `repo/apps/web-garage-mobile/__tests__/manifest.spec.ts` (5+ scenarios)
- [ ] Tests client API `repo/packages/garage-shared/src/api/client.spec.ts` (8+ scenarios)
- [ ] `pnpm dev --filter @insurtech/web-garage-mobile` demarre sur 3003 sans erreur
- [ ] `pnpm typecheck` passe (0 erreur) sur l'app et le package
- [ ] Lighthouse PWA baseline : manifest installable + SW registered (audit sur build prod)
- [ ] `pnpm-workspace.yaml` detecte l'app (glob `apps/*`) -- aucune modif manuelle requise mais verifie

## 5. Fichiers crees / modifies (liste exhaustive)

```
repo/apps/web-garage-mobile/package.json                                      (~60 lignes / manifest npm app)
repo/apps/web-garage-mobile/next.config.ts                                    (~50 lignes / withSerwist + transpile)
repo/apps/web-garage-mobile/serwist.config.ts                                 (~30 lignes / config SW build)
repo/apps/web-garage-mobile/tsconfig.json                                     (~30 lignes / extends base + paths)
repo/apps/web-garage-mobile/tailwind.config.ts                                (~60 lignes / theme garage + safe-area)
repo/apps/web-garage-mobile/postcss.config.mjs                                (~10 lignes / tailwind plugin)
repo/apps/web-garage-mobile/.env.example                                      (~15 lignes / vars exemples)
repo/apps/web-garage-mobile/biome.json                                        (~15 lignes / extends racine)
repo/apps/web-garage-mobile/middleware.ts                                     (~80 lignes / i18n + protect)
repo/apps/web-garage-mobile/app/sw.ts                                         (~130 lignes / Serwist SW)
repo/apps/web-garage-mobile/app/manifest.ts                                   (~80 lignes / Metadata API manifest)
repo/apps/web-garage-mobile/app/layout.tsx                                    (~120 lignes / root layout PWA meta)
repo/apps/web-garage-mobile/app/[locale]/layout.tsx                           (~70 lignes / locale + NextIntl)
repo/apps/web-garage-mobile/app/[locale]/page.tsx                             (~40 lignes / redirect auth/today)
repo/apps/web-garage-mobile/app/globals.css                                   (~80 lignes / tailwind + safe-area vars)
repo/apps/web-garage-mobile/components/providers.tsx                          (~110 lignes / QueryClient + theme + auth)
repo/apps/web-garage-mobile/lib/pwa/register-sw.ts                            (~60 lignes / client SW registration)
repo/apps/web-garage-mobile/lib/config/env.ts                                 (~50 lignes / Zod env loader)
repo/apps/web-garage-mobile/lib/auth/auth-context.tsx                         (~90 lignes / AuthContext skeleton)
repo/apps/web-garage-mobile/public/offline.html                              (~40 lignes / fallback offline)
repo/apps/web-garage-mobile/public/icons/icon-192.png                        (binaire / icon PWA)
repo/apps/web-garage-mobile/public/icons/icon-512.png                        (binaire / icon PWA)
repo/apps/web-garage-mobile/public/icons/icon-512-maskable.png               (binaire / icon adaptive)
repo/apps/web-garage-mobile/public/icons/apple-touch-icon-180.png            (binaire / icon iOS)
repo/apps/web-garage-mobile/__tests__/pwa-structure.spec.ts                  (~120 lignes / 5+ tests structure)
repo/apps/web-garage-mobile/__tests__/manifest.spec.ts                       (~110 lignes / 5+ tests manifest)
repo/packages/garage-shared/src/api/client.ts                                (~140 lignes / axios client mobile)
repo/packages/garage-shared/src/api/client.spec.ts                           (~180 lignes / 8+ tests)
repo/packages/garage-shared/src/components/status-badge.tsx                  (~90 lignes / badge statut)
repo/packages/garage-shared/src/components/order-card.tsx                    (~120 lignes / carte order)
repo/packages/garage-shared/src/types/repair.types.ts                        (~150 lignes / types domaine)
repo/packages/garage-shared/src/hooks/use-orders.ts                          (~80 lignes / hook TanStack)
repo/packages/garage-shared/src/index.ts                                     (~30 lignes / barrel export)
```

Total : ~32 fichiers, ~2500 lignes de code de production + tests.

## 6. Code patterns COMPLETS

### Fichier 1/12 : `repo/apps/web-garage-mobile/package.json`

Manifest npm de l'app. Versions exactes (decision : `save-exact=true`, jamais de `^`/`~`).

```json
{
  "name": "@insurtech/web-garage-mobile",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3003",
    "build": "next build",
    "start": "next start -p 3003",
    "typecheck": "tsc --noEmit",
    "lint": "biome check --no-errors-on-unmatched .",
    "lint:fix": "biome check --write .",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "lighthouse": "lhci autorun",
    "clean": "rm -rf .next .turbo node_modules/.cache coverage test-results"
  },
  "dependencies": {
    "@hookform/resolvers": "3.10.0",
    "@insurtech/garage-shared": "workspace:*",
    "@insurtech/shared-pwa": "workspace:*",
    "@insurtech/shared-ui": "workspace:*",
    "@insurtech/shared-types": "workspace:*",
    "@serwist/next": "9.0.11",
    "@tanstack/react-query": "5.62.7",
    "next": "15.0.4",
    "next-intl": "3.26.3",
    "react": "19.0.0",
    "react-dom": "19.0.0",
    "react-hook-form": "7.54.2",
    "sonner": "1.7.1",
    "web-push": "3.6.7",
    "zod": "3.24.1"
  },
  "devDependencies": {
    "@playwright/test": "1.49.1",
    "@serwist/vite": "9.0.11",
    "@testing-library/react": "16.1.0",
    "@testing-library/jest-dom": "6.6.3",
    "@types/node": "22.10.5",
    "@types/react": "19.0.2",
    "@types/react-dom": "19.0.2",
    "@types/web-push": "3.6.4",
    "autoprefixer": "10.4.20",
    "jsdom": "25.0.1",
    "postcss": "8.4.49",
    "serwist": "9.0.11",
    "tailwindcss": "3.4.17",
    "typescript": "5.7.3",
    "vitest": "2.1.8"
  },
  "engines": {
    "node": ">=22.11.0"
  }
}
```

**Notes importantes** :
- `@insurtech/garage-shared`, `@insurtech/shared-pwa`, `@insurtech/shared-ui` referencent les packages workspace via `workspace:*` (resolution pnpm `link-workspace-packages=deep`).
- `next dev -p 3003` fixe le port (piege 6). Le port prod est aussi 3003 (proxifie par le reverse-proxy vers `garage-mobile.skalean-insurtech.ma`).
- Pas de `console`-based tooling : lint Biome global rejette `console.log`.
- `serwist` (runtime) ET `@serwist/next` (integration build) ET `@serwist/vite` (pour les tests vitest qui chargent le SW) : trois packages distincts.

### Fichier 2/12 : `repo/apps/web-garage-mobile/next.config.ts`

Configuration Next.js + wrap Serwist. Reuse pattern Sprint 18.

```typescript
import type { NextConfig } from 'next';
import withSerwistInit from '@serwist/next';
import createNextIntlPlugin from 'next-intl/plugin';

// Plugin i18n : pointe vers la config des messages (fr / ar-MA / ar)
const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

// Wrap Serwist : genere public/sw.js a partir de app/sw.ts au build.
// En dev, le SW est desactive sauf si SERWIST_DEV=true (piege 1).
const withSerwist = withSerwistInit({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
  cacheOnNavigation: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === 'development' && process.env.SERWIST_DEV !== 'true',
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Packages workspace transpiles (ESM partage)
  transpilePackages: [
    '@insurtech/garage-shared',
    '@insurtech/shared-pwa',
    '@insurtech/shared-ui',
  ],
  // Headers securite + PWA
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Service-Worker-Allowed', value: '/' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        ],
      },
      {
        source: '/manifest.webmanifest',
        headers: [
          { key: 'Content-Type', value: 'application/manifest+json' },
        ],
      },
    ];
  },
  // Images : autoriser le domaine S3 MA pour les photos sinistre/diagnostic
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: process.env.NEXT_PUBLIC_S3_HOSTNAME ?? 's3.atlas-benguerir.skalean-insurtech.ma',
      },
    ],
  },
  experimental: {
    optimizePackageImports: ['@insurtech/garage-shared', 'lucide-react'],
  },
};

export default withSerwist(withNextIntl(nextConfig));
```

**Notes importantes** :
- `disable` desactive le SW en dev pour eviter les conflits HMR (piege 1) ; on force avec `SERWIST_DEV=true` pour tests PWA locaux.
- Header `Service-Worker-Allowed: /` autorise le scope racine du SW.
- `images.remotePatterns` limite aux hosts MA (decision-008 souverainete).

### Fichier 3/12 : `repo/apps/web-garage-mobile/app/sw.ts`

Le coeur PWA : service worker Serwist avec strategies de cache et pre-fetch des pages critiques. La Tache 5.5.10 etendra ce fichier avec 3 background sync handlers.

```typescript
import { defaultCache } from '@serwist/next/worker';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import {
  Serwist,
  CacheFirst,
  NetworkFirst,
  ExpirationPlugin,
  CacheableResponsePlugin,
} from 'serwist';

// Le contexte SW est ServiceWorkerGlobalScope, jamais window (piege 3).
declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}
declare const self: ServiceWorkerGlobalScope;

// Pages critiques pre-fetchees au boot pour disponibilite offline immediate.
// Trade-off : +shell mais le technicien voit ses orders meme sans reseau.
const CRITICAL_ROUTES: readonly string[] = [
  '/fr/today',
  '/fr/orders',
  '/offline.html',
];

const serwist = new Serwist({
  // Serwist injecte le manifest de precache au build (assets statiques + chunks)
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // 1. Assets statiques : Cache First (immutables, hash dans le nom)
    {
      matcher: /\.(?:js|css|woff2?|png|jpg|jpeg|svg|webp|ico)$/i,
      handler: new CacheFirst({
        cacheName: 'garage-static-assets',
        plugins: [
          new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 }),
          new CacheableResponsePlugin({ statuses: [0, 200] }),
        ],
      }),
    },
    // 2. API GET : Network First fallback Cache (orders visibles offline)
    {
      matcher: ({ url, request }) =>
        request.method === 'GET' && url.pathname.startsWith('/api/v1/repair/'),
      handler: new NetworkFirst({
        cacheName: 'garage-api-get',
        networkTimeoutSeconds: 4,
        plugins: [
          new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 24 * 60 * 60 }),
          new CacheableResponsePlugin({ statuses: [0, 200] }),
        ],
      }),
    },
    // 3. Photos S3 : Cache First (les photos ne changent pas)
    {
      matcher: ({ url }) => url.hostname.endsWith('.skalean-insurtech.ma') && /\.(?:jpg|jpeg|png|webp)$/i.test(url.pathname),
      handler: new CacheFirst({
        cacheName: 'garage-photos',
        plugins: [
          new ExpirationPlugin({ maxEntries: 300, maxAgeSeconds: 7 * 24 * 60 * 60, purgeOnQuotaError: true }),
          new CacheableResponsePlugin({ statuses: [0, 200] }),
        ],
      }),
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: '/offline.html',
        matcher: ({ request }) => request.destination === 'document',
      },
    ],
  },
});

// Pre-fetch des routes critiques a l'installation du SW.
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open('garage-critical-routes');
      await Promise.allSettled(
        CRITICAL_ROUTES.map(async (route) => {
          try {
            const response = await fetch(route, { credentials: 'include' });
            if (response.ok) await cache.put(route, response.clone());
          } catch {
            // Offline au boot : on ignore, le runtime cache prendra le relais.
          }
        }),
      );
    })(),
  );
});

serwist.addEventListeners();
```

**Notes importantes** :
- `self` (pas `window`) -- contexte Worker (piege 3).
- `networkTimeoutSeconds: 4` : sur connexion atelier lente, on bascule sur le cache apres 4s plutot que de laisser le technicien attendre.
- `purgeOnQuotaError` sur les photos : si le quota de stockage est atteint, on purge ce cache en priorite.
- Les 3 background sync handlers (`sync-timer-logs`, `sync-photos-uploads`, `sync-checklist-updates`) seront AJOUTES par la Tache 5.5.10 -- ce fichier sera modifie, pas recree.

### Fichier 4/12 : `repo/apps/web-garage-mobile/app/manifest.ts`

Manifest via la Metadata API Next.js (garantit le bon Content-Type, piege 8). Sert `/manifest.webmanifest`.

```typescript
import type { MetadataRoute } from 'next';

// Couleur centralisee Sofidemy navy -- identique au meta theme-color (piege 5).
const THEME_COLOR = '#1A2730';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Skalean Atelier Tech',
    short_name: 'Atelier',
    description: 'Application technicien atelier garage Skalean InsurTech : orders, photos, heures, reception, diagnostic.',
    start_url: '/fr/today',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#FFFFFF',
    theme_color: THEME_COLOR,
    lang: 'fr',
    dir: 'ltr',
    categories: ['business', 'productivity'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      {
        name: 'Mes orders',
        short_name: 'Orders',
        description: 'Voir mes orders du jour',
        url: '/fr/orders',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
      },
      {
        name: 'Camera reception',
        short_name: 'Reception',
        description: 'Prendre photos reception vehicule',
        url: '/fr/today?action=camera',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
      },
    ],
  };
}
```

**Notes importantes** :
- `purpose: 'maskable'` obligatoire (piege 2) sinon Lighthouse penalise et l'icon Android est rognee.
- `start_url: '/fr/today'` : le technicien atterrit directement sur sa journee.
- `shortcuts` : long-press sur l'icon home-screen -> raccourcis vers orders et camera reception.

### Fichier 5/12 : `repo/apps/web-garage-mobile/app/layout.tsx`

Root layout : meta PWA iOS (splash screens, status bar), providers.

```typescript
import type { Metadata, Viewport } from 'next';
import { Providers } from '@/components/providers';
import './globals.css';

const THEME_COLOR = '#1A2730';

export const metadata: Metadata = {
  applicationName: 'Skalean Atelier Tech',
  title: { default: 'Skalean Atelier', template: '%s | Skalean Atelier' },
  description: 'Application technicien atelier garage Skalean InsurTech.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Atelier',
    startupImage: [
      // Splash screens iOS (piege 4) -- tailles iPhone courantes
      { url: '/icons/splash-1170x2532.png', media: '(device-width: 390px) and (device-height: 844px)' },
      { url: '/icons/splash-1284x2778.png', media: '(device-width: 428px) and (device-height: 926px)' },
      { url: '/icons/splash-750x1334.png', media: '(device-width: 375px) and (device-height: 667px)' },
    ],
  },
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/apple-touch-icon-180.png',
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: THEME_COLOR,
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover', // active les safe-area-insets (notch iPhone)
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html suppressHydrationWarning>
      <body className="bg-white text-garage-navy antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

**Notes importantes** :
- `viewportFit: 'cover'` + CSS `env(safe-area-inset-*)` -> contenu respecte le notch (la Tache 5.5.3 utilisera ces insets pour la bottom nav).
- `statusBarStyle: 'black-translucent'` : la status bar iOS se fond dans le theme navy.
- `userScalable: false` + `maximumScale: 1` : empeche le zoom accidentel mains-gantees (acceptable pour une app outil ; un mode accessibilite zoom est expose dans les parametres, pas au niveau viewport).

### Fichier 6/12 : `repo/apps/web-garage-mobile/components/providers.tsx`

Providers globaux : TanStack Query, theme, auth context, toaster.

```typescript
'use client';

import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/lib/auth/auth-context';
import { registerServiceWorker } from '@/lib/pwa/register-sw';
import { useEffect } from 'react';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps): JSX.Element {
  // QueryClient instancie une seule fois cote client.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Atelier = connexion intermittente : on garde le cache plus longtemps
            staleTime: 60_000, // 1 min
            gcTime: 10 * 60_000, // 10 min
            retry: 2,
            refetchOnWindowFocus: true, // reprend quand le technicien revient sur l'app
            networkMode: 'offlineFirst', // sert le cache si offline
          },
          mutations: {
            networkMode: 'offlineFirst',
            retry: 1,
          },
        },
      }),
  );

  // Enregistrement du service worker au montage (cote client uniquement).
  useEffect(() => {
    registerServiceWorker().catch((error: unknown) => {
      // Logging cote client : on remonte a un endpoint, pas de console.log.
      void error;
    });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {children}
        <Toaster
          position="top-center"
          richColors
          closeButton
          toastOptions={{ className: 'text-base' }} // gros texte pour lecture rapide atelier
        />
      </AuthProvider>
    </QueryClientProvider>
  );
}
```

**Notes importantes** :
- `networkMode: 'offlineFirst'` : TanStack Query sert le cache immediatement si offline plutot que de jeter une erreur -- essentiel atelier.
- `refetchOnWindowFocus: true` : quand le technicien repose puis reprend le telephone, les donnees se rafraichissent.
- Toaster `top-center` + gros texte : lisibilite a bout de bras.

### Fichier 7/12 : `repo/apps/web-garage-mobile/lib/config/env.ts`

Loader d'environnement runtime avec validation Zod (jamais d'acces direct a `process.env`).

```typescript
import { z } from 'zod';

// Schema des variables publiques (prefixe NEXT_PUBLIC_ -> exposees au client).
const PublicEnvSchema = z.object({
  NEXT_PUBLIC_API_BASE_URL: z.string().url(),
  NEXT_PUBLIC_VAPID_KEY: z.string().min(80, 'VAPID public key invalide (88 chars base64url attendus)'),
  NEXT_PUBLIC_S3_HOSTNAME: z.string().min(1),
  NEXT_PUBLIC_DEFAULT_LOCALE: z.enum(['fr', 'ar-MA', 'ar']).default('fr'),
  NEXT_PUBLIC_RP_ID: z.string().min(1), // WebAuthn relying party id (Tache 5.5.2)
});

type PublicEnv = z.infer<typeof PublicEnvSchema>;

// Validation au premier import. Echoue tot et clairement si une var manque.
function loadPublicEnv(): PublicEnv {
  const parsed = PublicEnvSchema.safeParse({
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
    NEXT_PUBLIC_VAPID_KEY: process.env.NEXT_PUBLIC_VAPID_KEY,
    NEXT_PUBLIC_S3_HOSTNAME: process.env.NEXT_PUBLIC_S3_HOSTNAME,
    NEXT_PUBLIC_DEFAULT_LOCALE: process.env.NEXT_PUBLIC_DEFAULT_LOCALE,
    NEXT_PUBLIC_RP_ID: process.env.NEXT_PUBLIC_RP_ID,
  });

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`[web-garage-mobile] Variables d'environnement invalides:\n${issues}`);
  }
  return parsed.data;
}

export const env: PublicEnv = loadPublicEnv();
```

**Notes importantes** :
- Validation Zod uniquement (decision conventions : jamais class-validator/joi).
- `NEXT_PUBLIC_RP_ID` est consomme par la Tache 5.5.2 (WebAuthn) -- declare des maintenant.
- Echoue tot avec un message explicite listant toutes les vars manquantes.

### Fichier 8/12 : `repo/apps/web-garage-mobile/lib/pwa/register-sw.ts`

Enregistrement client du service worker via `@insurtech/shared-pwa`.

```typescript
import { registerSW, type SWRegistrationResult } from '@insurtech/shared-pwa';

// Enregistre /sw.js et expose les callbacks de cycle de vie (update dispo, etc.).
// Reutilise le helper partage Sprint 4 (1.4.9) pour coherence avec web-assure-mobile.
export async function registerServiceWorker(): Promise<SWRegistrationResult | null> {
  if (typeof window === 'undefined') return null;
  if (!('serviceWorker' in navigator)) return null;

  const result = await registerSW({
    swUrl: '/sw.js',
    scope: '/',
    onUpdateAvailable: () => {
      // Une nouvelle version du SW est prete : on invitera l'utilisateur a recharger.
      // L'UI de prompt update est geree par un composant dedie (hors scope 5.5.1).
      window.dispatchEvent(new CustomEvent('sw:update-available'));
    },
    onActivated: () => {
      window.dispatchEvent(new CustomEvent('sw:activated'));
    },
    onOffline: () => {
      window.dispatchEvent(new CustomEvent('app:offline'));
    },
    onOnline: () => {
      window.dispatchEvent(new CustomEvent('app:online'));
    },
  });

  return result;
}
```

**Notes importantes** :
- Reutilise `@insurtech/shared-pwa.registerSW` (Sprint 4) -- ne reimplemente PAS l'enregistrement.
- Emet des CustomEvent que les taches suivantes (5.5.10 sync-status, 5.5.11 push) ecouteront.

### Fichier 9/12 : `repo/packages/garage-shared/src/api/client.ts`

Client API axios mutualise desktop+mobile, avec interceptors auth + multi-tenant + refresh JWT.

```typescript
import axios, {
  type AxiosInstance,
  type AxiosError,
  type InternalAxiosRequestConfig,
} from 'axios';

export interface GarageApiClientOptions {
  baseURL: string;
  // Recuperation du token courant (depuis cookie/memory selon l'app)
  getAccessToken: () => string | null;
  getTenantId: () => string | null;
  // Callback de refresh : retourne le nouveau access token ou null si echec
  refreshToken: () => Promise<string | null>;
  // Callback en cas d'echec d'auth definitif (redirige vers /login)
  onAuthFailure: () => void;
}

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retried?: boolean;
}

// Cree une instance axios configuree pour l'API Repair Skalean.
// Multi-tenant strict : header x-tenant-id injecte automatiquement (decision-002).
export function createGarageApiClient(options: GarageApiClientOptions): AxiosInstance {
  const instance = axios.create({
    baseURL: options.baseURL,
    timeout: 15_000, // 15s : marge pour 3G atelier
    headers: { 'Content-Type': 'application/json' },
  });

  // Request interceptor : Bearer + x-tenant-id
  instance.interceptors.request.use((config) => {
    const token = options.getAccessToken();
    if (token) config.headers.set('Authorization', `Bearer ${token}`);

    const tenantId = options.getTenantId();
    if (tenantId) config.headers.set('x-tenant-id', tenantId);

    return config;
  });

  // Response interceptor : refresh transparent sur 401
  instance.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const original = error.config as RetriableConfig | undefined;
      if (!original) return Promise.reject(error);

      // 401 -> tentative de refresh une seule fois
      if (error.response?.status === 401 && !original._retried) {
        original._retried = true;
        const newToken = await options.refreshToken();
        if (newToken) {
          original.headers.set('Authorization', `Bearer ${newToken}`);
          return instance(original);
        }
        // Refresh echoue -> auth definitivement perdue
        options.onAuthFailure();
      }

      return Promise.reject(error);
    },
  );

  return instance;
}

// Helpers typed minces (les hooks TanStack les consomment)
export async function apiGet<T>(client: AxiosInstance, url: string, params?: Record<string, unknown>): Promise<T> {
  const { data } = await client.get<T>(url, { params });
  return data;
}

export async function apiPost<T>(client: AxiosInstance, url: string, body: unknown, idempotencyKey?: string): Promise<T> {
  const headers = idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined;
  const { data } = await client.post<T>(url, body, { headers });
  return data;
}

export async function apiPatch<T>(client: AxiosInstance, url: string, body: unknown): Promise<T> {
  const { data } = await client.patch<T>(url, body);
  return data;
}
```

**Notes importantes** :
- `x-tenant-id` injecte systematiquement (decision-002 multi-tenant strict).
- Refresh JWT transparent une seule fois (`_retried`) pour eviter une boucle infinie.
- `apiPost` accepte une `Idempotency-Key` (decision : mutations sensibles -- log heures, photos -- la passeront).
- `timeout: 15_000` : marge pour connexions atelier lentes.

### Fichier 10/12 : `repo/packages/garage-shared/src/types/repair.types.ts`

Types domaine partages. Source unique de verite desktop+mobile.

```typescript
import { z } from 'zod';

// --- Enums domaine ---
export const SinistreStatus = z.enum([
  'declared',
  'received',
  'under_diagnostic',
  'estimate_pending',
  'estimate_validated',
  'parts_ordered',
  'under_repair',
  'qc_pending',
  'qc_passed',
  'ready_delivery',
  'delivered',
  'closed',
  'cancelled',
]);
export type SinistreStatus = z.infer<typeof SinistreStatus>;

export const OrderStatus = z.enum([
  'open',
  'in_progress',
  'on_hold',
  'qc',
  'completed',
  'cancelled',
]);
export type OrderStatus = z.infer<typeof OrderStatus>;

export const PartStatus = z.enum(['needed', 'ordered', 'shipped', 'arrived', 'consumed']);
export type PartStatus = z.infer<typeof PartStatus>;

// --- Entites ---
export const VehicleSchema = z.object({
  id: z.string().uuid(),
  plate: z.string(),
  make: z.string(),
  model: z.string(),
  year: z.number().int(),
  vin: z.string().nullable(),
});
export type Vehicle = z.infer<typeof VehicleSchema>;

export const OrderTaskSchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  completed: z.boolean(),
  completed_at: z.string().datetime().nullable(),
  completed_by: z.string().uuid().nullable(),
});
export type OrderTask = z.infer<typeof OrderTaskSchema>;

export const PartSchema = z.object({
  id: z.string().uuid(),
  reference: z.string(),
  label: z.string(),
  quantity: z.number().int().positive(),
  status: PartStatus,
  eta: z.string().datetime().nullable(),
});
export type Part = z.infer<typeof PartSchema>;

export const HoursLogSchema = z.object({
  id: z.string().uuid(),
  order_id: z.string().uuid(),
  technician_id: z.string().uuid(),
  seconds: z.number().int().nonnegative(),
  logged_at: z.string().datetime(),
  source: z.enum(['timer', 'manual']),
});
export type HoursLog = z.infer<typeof HoursLogSchema>;

export const OrderSchema = z.object({
  id: z.string().uuid(),
  order_number: z.string(),
  tenant_id: z.string().uuid(),
  sinistre_id: z.string().uuid(),
  vehicle: VehicleSchema,
  status: OrderStatus,
  completion_percent: z.number().min(0).max(100),
  estimated_completion: z.string().datetime().nullable(),
  assigned_technician_id: z.string().uuid().nullable(),
  tasks: z.array(OrderTaskSchema),
  parts: z.array(PartSchema),
  hours_logged_seconds: z.number().int().nonnegative(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type Order = z.infer<typeof OrderSchema>;

export const SinistreSchema = z.object({
  id: z.string().uuid(),
  reference: z.string(),
  tenant_id: z.string().uuid(),
  status: SinistreStatus,
  vehicle: VehicleSchema,
  customer_name: z.string(),
  declared_at: z.string().datetime(),
});
export type Sinistre = z.infer<typeof SinistreSchema>;

// Reponse paginee generique
export const PaginatedSchema = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    data: z.array(item),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    page_size: z.number().int().positive(),
  });
```

**Notes importantes** :
- Tous les types derivent de schemas Zod (`z.infer`) -- validation runtime + type statique d'une seule source.
- `tenant_id` present sur Order/Sinistre (multi-tenant).
- `hours_logged_seconds` en secondes (le timer de la Tache 5.5.8 manipule des secondes).

### Fichier 11/12 : `repo/packages/garage-shared/src/components/status-badge.tsx`

Badge de statut agnostique de la mise en page (utilisable desktop ET mobile).

```typescript
import type { OrderStatus, SinistreStatus, PartStatus } from '../types/repair.types';

type AnyStatus = OrderStatus | SinistreStatus | PartStatus;

interface StatusBadgeProps {
  status: AnyStatus;
  label: string; // libelle deja traduit i18n par l'app appelante
  size?: 'sm' | 'md';
}

// Mapping statut -> couleurs (classes Tailwind). Centralise pour coherence visuelle.
const STATUS_STYLES: Record<string, string> = {
  // Order
  open: 'bg-slate-100 text-slate-700',
  in_progress: 'bg-blue-100 text-blue-700',
  on_hold: 'bg-amber-100 text-amber-800',
  qc: 'bg-purple-100 text-purple-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  // Part
  needed: 'bg-slate-100 text-slate-700',
  ordered: 'bg-blue-100 text-blue-700',
  shipped: 'bg-indigo-100 text-indigo-700',
  arrived: 'bg-green-100 text-green-700',
  consumed: 'bg-slate-200 text-slate-500',
  // Sinistre (extraits frequents)
  received: 'bg-blue-100 text-blue-700',
  under_diagnostic: 'bg-amber-100 text-amber-800',
  under_repair: 'bg-blue-100 text-blue-700',
  ready_delivery: 'bg-green-100 text-green-700',
  delivered: 'bg-green-100 text-green-700',
  closed: 'bg-slate-200 text-slate-500',
};

export function StatusBadge({ status, label, size = 'md' }: StatusBadgeProps): JSX.Element {
  const style = STATUS_STYLES[status] ?? 'bg-slate-100 text-slate-700';
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1';
  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${style} ${sizeClass}`}
      data-status={status}
      role="status"
    >
      {label}
    </span>
  );
}
```

**Notes importantes** :
- Le composant ne traduit PAS lui-meme : il recoit `label` deja localise (separation responsabilites). Cela evite de coupler le package shared a une instance i18n specifique.
- `data-status` + `role="status"` : testable et accessible.

### Fichier 12/12 : `repo/packages/garage-shared/src/hooks/use-orders.ts`

Hook TanStack Query pour lister les orders, valide par Zod.

```typescript
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { AxiosInstance } from 'axios';
import { apiGet } from '../api/client';
import { OrderSchema, PaginatedSchema } from '../types/repair.types';
import type { Order } from '../types/repair.types';
import { z } from 'zod';

const OrdersResponseSchema = PaginatedSchema(OrderSchema);
type OrdersResponse = z.infer<typeof OrdersResponseSchema>;

export interface UseOrdersParams {
  client: AxiosInstance;
  technicianId?: string;
  status?: string;
  enabled?: boolean;
}

// Liste les orders (filtrables par technicien/statut). Valide la reponse via Zod.
export function useOrders(params: UseOrdersParams): UseQueryResult<OrdersResponse> {
  const { client, technicianId, status, enabled = true } = params;
  return useQuery({
    queryKey: ['orders', { technicianId, status }],
    enabled,
    queryFn: async () => {
      const raw = await apiGet<unknown>(client, '/api/v1/repair/orders', {
        technician_id: technicianId,
        status,
      });
      // Defense en profondeur : on valide la reponse API au runtime.
      return OrdersResponseSchema.parse(raw);
    },
  });
}

// Detail d'un order unique
export function useOrderDetail(client: AxiosInstance, orderId: string): UseQueryResult<Order> {
  return useQuery({
    queryKey: ['order', orderId],
    enabled: Boolean(orderId),
    queryFn: async () => {
      const raw = await apiGet<unknown>(client, `/api/v1/repair/orders/${orderId}`);
      return OrderSchema.parse(raw);
    },
  });
}
```

**Notes importantes** :
- `OrderSchema.parse(raw)` : validation runtime de la reponse API (defense en profondeur, conventions strictes).
- `queryKey` structuree pour invalidation ciblee.
- `enabled` permet aux pages de differer le fetch (ex : attendre l'auth).

### Fichier 13/20 : `repo/apps/web-garage-mobile/middleware.ts`

Middleware Next.js : routing i18n (fr/ar-MA/ar) + protection des routes `(protected)`.

```typescript
import createIntlMiddleware from 'next-intl/middleware';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const LOCALES = ['fr', 'ar-MA', 'ar'] as const;
const DEFAULT_LOCALE = 'fr';

// Routes publiques (pas d auth requise) -- le reste exige un access token cookie.
const PUBLIC_PATHS = ['/login', '/setup-pin', '/setup-biometric', '/quick-login', '/offline'];

const intlMiddleware = createIntlMiddleware({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: 'always',
});

function isPublicPath(pathname: string): boolean {
  // Strip le prefixe locale pour comparer
  const withoutLocale = pathname.replace(/^\/(fr|ar-MA|ar)/, '');
  return PUBLIC_PATHS.some((p) => withoutLocale.startsWith(p)) || withoutLocale === '';
}

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  // Laisser passer assets, sw, manifest, api
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/icons') ||
    pathname === '/sw.js' ||
    pathname === '/manifest.webmanifest' ||
    pathname.startsWith('/api')
  ) {
    return NextResponse.next();
  }

  // Auth gate : si route protegee et pas de cookie de session -> /login
  const hasSession = request.cookies.has('garage_refresh_token');
  if (!isPublicPath(pathname) && !hasSession) {
    const locale = pathname.match(/^\/(fr|ar-MA|ar)/)?.[1] ?? DEFAULT_LOCALE;
    const loginUrl = new URL(`/${locale}/login`, request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|sw.js|manifest.webmanifest).*)'],
};
```

**Notes importantes** :
- `localePrefix: 'always'` : toute URL porte sa locale (`/fr/today`, `/ar/today`).
- La protection se base sur la presence du cookie `garage_refresh_token` (pose par la Tache 5.5.2). Le skeleton declare la gate ; les pages auth viendront.
- `redirect` query param preserve la destination apres login.

### Fichier 14/20 : `repo/apps/web-garage-mobile/app/[locale]/layout.tsx`

Layout du segment locale : NextIntl provider + direction RTL automatique.

```typescript
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

const LOCALES = ['fr', 'ar-MA', 'ar'] as const;
type Locale = (typeof LOCALES)[number];

const RTL_LOCALES: ReadonlySet<string> = new Set(['ar', 'ar-MA']);

export function generateStaticParams(): Array<{ locale: Locale }> {
  return LOCALES.map((locale) => ({ locale }));
}

interface LocaleLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps): Promise<JSX.Element> {
  const { locale } = await params;
  if (!LOCALES.includes(locale as Locale)) notFound();

  setRequestLocale(locale);
  const messages = await getMessages();
  const dir = RTL_LOCALES.has(locale) ? 'rtl' : 'ltr';

  return (
    <div dir={dir} lang={locale} className="min-h-dvh">
      <NextIntlClientProvider locale={locale} messages={messages}>
        {children}
      </NextIntlClientProvider>
    </div>
  );
}
```

**Notes importantes** :
- `dir="rtl"` automatique pour ar / ar-MA (darija) -- toute l UI mobile doit etre RTL-safe.
- `min-h-dvh` (dynamic viewport height) gere correctement la barre d adresse mobile changeante.
- `params` est une Promise (Next.js 15 async params).

### Fichier 15/20 : `repo/apps/web-garage-mobile/app/[locale]/page.tsx`

Page racine du locale : redirige vers `/today` (authentifie) ou `/login`.

```typescript
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

interface RootPageProps {
  params: Promise<{ locale: string }>;
}

export default async function RootPage({ params }: RootPageProps): Promise<never> {
  const { locale } = await params;
  const cookieStore = await cookies();
  const hasSession = cookieStore.has('garage_refresh_token');

  if (hasSession) {
    redirect(`/${locale}/today`);
  }
  redirect(`/${locale}/login`);
}
```

**Notes importantes** :
- `redirect()` cote serveur, pas de flash client.
- `cookies()` async (Next.js 15).

### Fichier 16/20 : `repo/apps/web-garage-mobile/lib/auth/auth-context.tsx`

Squelette du contexte d auth (etat user + tokens). La Tache 5.5.2 implementera les methodes pin/biometric.

```typescript
'use client';

import { createContext, useContext, useState, useMemo, type ReactNode } from 'react';

export interface AuthUser {
  id: string;
  email: string;
  display_name: string;
  tenant_id: string;
  roles: string[];
}

export interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  setSession: (user: AuthUser, accessToken: string) => void;
  clearSession: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const value = useMemo<AuthState>(
    () => ({
      user,
      accessToken,
      isAuthenticated: Boolean(user && accessToken),
      setSession: (nextUser, token) => {
        setUser(nextUser);
        setAccessToken(token);
      },
      clearSession: () => {
        setUser(null);
        setAccessToken(null);
      },
    }),
    [user, accessToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit etre utilise dans AuthProvider');
  return ctx;
}
```

**Notes importantes** :
- L access token est garde en memoire (pas localStorage) pour limiter le vol XSS ; le refresh token est en cookie httpOnly (pose backend).
- La Tache 5.5.2 branche `setSession` apres verify-pin / verify-biometric.

### Fichier 17/20 : `repo/apps/web-garage-mobile/tailwind.config.ts`

Theme Tailwind garage + utilities safe-area (notch).

```typescript
import type { Config } from 'tailwindcss';
import sharedPreset from '@insurtech/shared-ui/tailwind-preset';

const config: Config = {
  presets: [sharedPreset],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    '../../packages/garage-shared/src/**/*.{ts,tsx}',
    '../../packages/shared-ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Palette Sofidemy
        'garage-navy': '#1A2730',
        'garage-primary': '#B91C1C', // rouge garage (coherent web-garage Sprint 22)
      },
      spacing: {
        // Safe-area insets exposees comme utilities (pb-safe, pt-safe, etc.)
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)',
      },
      minHeight: {
        'touch': '44px', // cible tactile minimale (WCAG 2.5.5)
      },
    },
  },
  plugins: [],
};

export default config;
```

**Notes importantes** :
- `min-h-touch` (44px) impose des cibles tactiles accessibles (gants, WCAG 2.5.5) -- la Tache 5.5.3 et 5.5.9 l utilisent.
- Les utilities safe-area servent a la bottom nav (Tache 5.5.3).

### Fichier 18/20 : `repo/apps/web-garage-mobile/app/globals.css`

CSS global : Tailwind layers + variables safe-area + reset tactile.

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --garage-navy: #1a2730;
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  --safe-top: env(safe-area-inset-top, 0px);
}

/* Empeche le bounce de scroll iOS sur le body (l app gere son propre scroll) */
html,
body {
  overscroll-behavior-y: none;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation; /* supprime le delai 300ms tap */
}

/* Utility : padding bas qui respecte la safe area (bottom nav) */
.pb-safe {
  padding-bottom: calc(0.5rem + var(--safe-bottom));
}

.pt-safe {
  padding-top: calc(0.5rem + var(--safe-top));
}

/* Desactive la selection de texte sur les controles tactiles (boutons, nav) */
button,
[role='button'],
nav {
  user-select: none;
}
```

**Notes importantes** :
- `touch-action: manipulation` supprime le delai de 300ms sur tap (reactivite atelier).
- `overscroll-behavior-y: none` empeche le pull-to-refresh navigateur natif (l app implemente le sien, Tache 5.5.3).

### Fichier 19/20 : `repo/apps/web-garage-mobile/public/offline.html`

Page fallback offline statique (servie par le SW quand un document n est pas en cache).

```html
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#1A2730" />
    <title>Hors ligne | Skalean Atelier</title>
    <style>
      body {
        margin: 0;
        font-family: system-ui, -apple-system, sans-serif;
        background: #1a2730;
        color: #fff;
        display: flex;
        min-height: 100dvh;
        align-items: center;
        justify-content: center;
        text-align: center;
        padding: 1.5rem;
      }
      .card { max-width: 22rem; }
      h1 { font-size: 1.25rem; margin-bottom: 0.5rem; }
      p { opacity: 0.85; line-height: 1.5; }
      button {
        margin-top: 1.25rem;
        padding: 0.75rem 1.5rem;
        min-height: 44px;
        border: none;
        border-radius: 0.5rem;
        background: #fff;
        color: #1a2730;
        font-weight: 600;
        font-size: 1rem;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Vous etes hors ligne</h1>
      <p>
        Pas de connexion internet pour le moment. Vos heures loggees et vos photos
        seront synchronisees automatiquement au retour du reseau.
      </p>
      <button onclick="location.reload()">Reessayer</button>
    </div>
  </body>
</html>
```

**Notes importantes** :
- Page 100% statique inline (pas de dependance JS/CSS externe) -- doit fonctionner sans reseau.
- Message rassurant : la donnee n est pas perdue (background sync Tache 5.5.10).
- Bouton 44px (cible tactile).

### Fichier 20/20 : `repo/packages/garage-shared/src/components/order-card.tsx`

Carte order compacte reutilisee desktop+mobile (la page Today et Orders la consomment).

```typescript
import type { Order } from '../types/repair.types';
import { StatusBadge } from './status-badge';

interface OrderCardProps {
  order: Order;
  statusLabel: string; // libelle statut traduit par l app
  onClick?: (orderId: string) => void;
  compact?: boolean;
}

// Formatte des secondes en HH:MM lisible.
function formatHours(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h${m.toString().padStart(2, '0')}`;
}

export function OrderCard({ order, statusLabel, onClick, compact = false }: OrderCardProps): JSX.Element {
  return (
    <button
      type="button"
      onClick={() => onClick?.(order.id)}
      className="w-full min-h-touch rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm active:scale-[0.99] transition-transform"
      data-order-id={order.id}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-garage-navy">{order.order_number}</span>
        <StatusBadge status={order.status} label={statusLabel} size="sm" />
      </div>
      <p className="mt-1 text-sm text-slate-600">
        {order.vehicle.make} {order.vehicle.model} -- {order.vehicle.plate}
      </p>
      {!compact && (
        <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
          <span>Avancement {order.completion_percent}%</span>
          <span>Heures {formatHours(order.hours_logged_seconds)}</span>
          {order.parts.some((p) => p.status === 'arrived') && (
            <span className="text-green-600">Pieces arrivees</span>
          )}
        </div>
      )}
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-garage-primary transition-all"
          style={{ width: `${order.completion_percent}%` }}
        />
      </div>
    </button>
  );
}
```

**Notes importantes** :
- Le composant est un `<button>` natif (44px min, accessible, tap-friendly).
- Ne traduit pas (recoit `statusLabel`), reste agnostique de la mise en page (pas de positionnement absolu).
- `active:scale-[0.99]` : feedback tactile immediat.

### Fichiers de configuration complementaires (annexe section 6)

#### `repo/apps/web-garage-mobile/serwist.config.ts`

```typescript
// Configuration build du service worker reference par next.config.ts.
// Centralise les options de generation pour reutilisation/test.
export const serwistBuildConfig = {
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
  // Glob des assets a precacher (Serwist injecte self.__SW_MANIFEST)
  globDirectory: '.next',
  globPatterns: ['**/*.{js,css,woff2}'],
  // Ne pas precacher les chunks volumineux (charges a la demande)
  maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
  // Exclure les source maps du precache
  globIgnores: ['**/*.map', '**/sw.js'],
} as const;
```

#### `repo/apps/web-garage-mobile/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext", "webworker"],
    "jsx": "preserve",
    "module": "esnext",
    "moduleResolution": "bundler",
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"]
    },
    "types": ["node", "vitest/globals", "@serwist/next/typings"]
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts",
    "app/sw.ts"
  ],
  "exclude": ["node_modules"]
}
```

**Notes** : `lib` inclut `webworker` (pour `app/sw.ts` qui tourne en contexte Worker) ; `@serwist/next/typings` fournit le type de `self.__SW_MANIFEST`.

#### `repo/apps/web-garage-mobile/i18n/request.ts`

```typescript
import { getRequestConfig } from 'next-intl/server';

const LOCALES = ['fr', 'ar-MA', 'ar'] as const;

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = LOCALES.includes(requested as (typeof LOCALES)[number]) ? requested : 'fr';
  return {
    locale: locale as string,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
```

**Notes** : charge les messages i18n par locale. Les fichiers `messages/fr.json`, `messages/ar-MA.json`, `messages/ar.json` contiennent les libelles (les pages metier les enrichiront). Le skeleton fournit au minimum les cles communes (`common.loading`, `common.retry`, `common.offline`, `nav.*`).

#### `repo/apps/web-garage-mobile/i18n/messages/fr.json` (extrait fondation)

```json
{
  "common": {
    "loading": "Chargement...",
    "retry": "Reessayer",
    "offline": "Vous etes hors ligne",
    "today": "Aujourd'hui",
    "greeting": "Bonjour {name}"
  },
  "nav": {
    "today": "Aujourd'hui",
    "orders": "Mes orders",
    "camera": "Camera",
    "notifications": "Notifications",
    "profile": "Profil"
  },
  "status": {
    "open": "Ouvert",
    "in_progress": "En cours",
    "on_hold": "En attente",
    "qc": "Controle qualite",
    "completed": "Termine",
    "arrived": "Pieces arrivees"
  }
}
```

#### `repo/apps/web-garage-mobile/biome.json`

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "extends": ["../../biome.json"],
  "files": {
    "ignore": ["public/sw.js", ".next/**", "coverage/**"]
  }
}
```

#### `repo/apps/web-garage-mobile/postcss.config.mjs`

```javascript
const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

export default config;
```

#### `repo/packages/garage-shared/src/index.ts` (barrel export complet)

```typescript
// API client
export {
  createGarageApiClient,
  apiGet,
  apiPost,
  apiPatch,
  type GarageApiClientOptions,
} from './api/client';

// Types domaine
export {
  OrderSchema,
  SinistreSchema,
  PartSchema,
  OrderTaskSchema,
  HoursLogSchema,
  VehicleSchema,
  OrderStatus,
  SinistreStatus,
  PartStatus,
  PaginatedSchema,
  type Order,
  type Sinistre,
  type Part,
  type OrderTask,
  type HoursLog,
  type Vehicle,
} from './types/repair.types';

// Composants partages
export { StatusBadge } from './components/status-badge';
export { OrderCard } from './components/order-card';

// Hooks data
export { useOrders, useOrderDetail, type UseOrdersParams } from './hooks/use-orders';
```

**Notes** : ce barrel est l API publique du package. Tout consommateur (`web-garage` desktop ou `web-garage-mobile`) importe depuis `@insurtech/garage-shared` uniquement (jamais de chemin profond `@insurtech/garage-shared/src/...`).

## 7. Tests complets

### 7.1 Tests structure : `repo/apps/web-garage-mobile/__tests__/pwa-structure.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const APP_ROOT = resolve(__dirname, '..');

describe('web-garage-mobile structure PWA', () => {
  it('expose les fichiers de config PWA obligatoires', () => {
    const required = [
      'next.config.ts',
      'app/sw.ts',
      'app/manifest.ts',
      'app/layout.tsx',
      'components/providers.tsx',
      'lib/pwa/register-sw.ts',
      'lib/config/env.ts',
    ];
    required.forEach((file) => {
      expect(existsSync(resolve(APP_ROOT, file)), `${file} manquant`).toBe(true);
    });
  });

  it('expose les icons PWA requises (192/512/maskable/apple)', () => {
    const icons = [
      'public/icons/icon-192.png',
      'public/icons/icon-512.png',
      'public/icons/icon-512-maskable.png',
      'public/icons/apple-touch-icon-180.png',
    ];
    icons.forEach((icon) => {
      expect(existsSync(resolve(APP_ROOT, icon)), `${icon} manquant`).toBe(true);
    });
  });

  it('expose la page offline fallback', () => {
    expect(existsSync(resolve(APP_ROOT, 'public/offline.html'))).toBe(true);
  });

  it('expose la structure App Router locale', () => {
    expect(existsSync(resolve(APP_ROOT, 'app/[locale]/layout.tsx'))).toBe(true);
    expect(existsSync(resolve(APP_ROOT, 'app/[locale]/page.tsx'))).toBe(true);
  });

  it('a un middleware de routing i18n', () => {
    expect(existsSync(resolve(APP_ROOT, 'middleware.ts'))).toBe(true);
  });
});
```

### 7.2 Tests manifest : `repo/apps/web-garage-mobile/__tests__/manifest.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import manifest from '../app/manifest';

describe('manifest PWA web-garage-mobile', () => {
  const m = manifest();

  it('a le nom et short_name corrects', () => {
    expect(m.name).toBe('Skalean Atelier Tech');
    expect(m.short_name).toBe('Atelier');
  });

  it('utilise le theme color Sofidemy navy', () => {
    expect(m.theme_color).toBe('#1A2730');
  });

  it('est en display standalone portrait', () => {
    expect(m.display).toBe('standalone');
    expect(m.orientation).toBe('portrait');
  });

  it('a une icon maskable (sinon Lighthouse penalise)', () => {
    const maskable = m.icons?.find((i) => i.purpose === 'maskable');
    expect(maskable).toBeDefined();
    expect(maskable?.sizes).toBe('512x512');
  });

  it('a les icons any 192 et 512', () => {
    const sizes = m.icons?.filter((i) => i.purpose === 'any').map((i) => i.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
  });

  it('expose 2 shortcuts (orders + camera reception)', () => {
    expect(m.shortcuts).toHaveLength(2);
    expect(m.shortcuts?.[0]?.url).toBe('/fr/orders');
    expect(m.shortcuts?.[1]?.url).toContain('action=camera');
  });

  it('demarre sur /fr/today', () => {
    expect(m.start_url).toBe('/fr/today');
  });

  it("ne contient aucune emoji (decision-006)", () => {
    const json = JSON.stringify(m);
    expect(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(json)).toBe(false);
  });
});
```

### 7.3 Tests client API : `repo/packages/garage-shared/src/api/client.spec.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import { createGarageApiClient, apiGet, apiPost } from './client';

describe('createGarageApiClient', () => {
  let getAccessToken: ReturnType<typeof vi.fn>;
  let getTenantId: ReturnType<typeof vi.fn>;
  let refreshToken: ReturnType<typeof vi.fn>;
  let onAuthFailure: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    getAccessToken = vi.fn(() => 'token-abc');
    getTenantId = vi.fn(() => 'tenant-123');
    refreshToken = vi.fn(async () => 'token-new');
    onAuthFailure = vi.fn();
  });

  function makeClient() {
    return createGarageApiClient({
      baseURL: 'http://api.test',
      getAccessToken,
      getTenantId,
      refreshToken,
      onAuthFailure,
    });
  }

  it('injecte le header Authorization Bearer', async () => {
    const client = makeClient();
    const mock = new MockAdapter(client);
    mock.onGet('/api/v1/repair/orders').reply((config) => {
      expect(config.headers?.Authorization).toBe('Bearer token-abc');
      return [200, { data: [], total: 0, page: 1, page_size: 20 }];
    });
    await apiGet(client, '/api/v1/repair/orders');
  });

  it('injecte le header x-tenant-id (multi-tenant)', async () => {
    const client = makeClient();
    const mock = new MockAdapter(client);
    mock.onGet('/api/v1/repair/orders').reply((config) => {
      expect(config.headers?.['x-tenant-id']).toBe('tenant-123');
      return [200, {}];
    });
    await apiGet(client, '/api/v1/repair/orders');
  });

  it('n injecte pas Authorization si pas de token', async () => {
    getAccessToken = vi.fn(() => null);
    const client = makeClient();
    const mock = new MockAdapter(client);
    mock.onGet('/x').reply((config) => {
      expect(config.headers?.Authorization).toBeUndefined();
      return [200, {}];
    });
    await apiGet(client, '/x');
  });

  it('rafraichit le token sur 401 puis rejoue la requete', async () => {
    const client = makeClient();
    const mock = new MockAdapter(client);
    let call = 0;
    mock.onGet('/protected').reply(() => {
      call += 1;
      return call === 1 ? [401, {}] : [200, { ok: true }];
    });
    const data = await apiGet<{ ok: boolean }>(client, '/protected');
    expect(refreshToken).toHaveBeenCalledOnce();
    expect(data.ok).toBe(true);
  });

  it('appelle onAuthFailure si le refresh echoue', async () => {
    refreshToken = vi.fn(async () => null);
    const client = makeClient();
    const mock = new MockAdapter(client);
    mock.onGet('/protected').reply(401);
    await expect(apiGet(client, '/protected')).rejects.toBeDefined();
    expect(onAuthFailure).toHaveBeenCalledOnce();
  });

  it('ne tente le refresh qu une seule fois (anti-boucle)', async () => {
    const client = makeClient();
    const mock = new MockAdapter(client);
    mock.onGet('/loop').reply(401);
    await expect(apiGet(client, '/loop')).rejects.toBeDefined();
    expect(refreshToken).toHaveBeenCalledOnce();
  });

  it('apiPost transmet une Idempotency-Key si fournie', async () => {
    const client = makeClient();
    const mock = new MockAdapter(client);
    mock.onPost('/api/v1/repair/orders/1/log-hours').reply((config) => {
      expect(config.headers?.['Idempotency-Key']).toBe('key-xyz');
      return [201, {}];
    });
    await apiPost(client, '/api/v1/repair/orders/1/log-hours', { hours: 1 }, 'key-xyz');
  });

  it('respecte le timeout configure (15s)', () => {
    const client = makeClient();
    expect(client.defaults.timeout).toBe(15_000);
  });
});
```

### 7.4 Tests env loader : `repo/apps/web-garage-mobile/lib/config/env.spec.ts`

```typescript
import { describe, it, expect, vi, afterEach } from 'vitest';

describe('env loader Zod', () => {
  const ORIGINAL = { ...process.env };
  afterEach(() => {
    process.env = { ...ORIGINAL };
    vi.resetModules();
  });

  it('charge les vars valides', async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.skalean-insurtech.ma';
    process.env.NEXT_PUBLIC_VAPID_KEY = 'B'.repeat(88);
    process.env.NEXT_PUBLIC_S3_HOSTNAME = 's3.atlas-benguerir.skalean-insurtech.ma';
    process.env.NEXT_PUBLIC_RP_ID = 'garage-mobile.skalean-insurtech.ma';
    const { env } = await import('./env');
    expect(env.NEXT_PUBLIC_DEFAULT_LOCALE).toBe('fr');
  });

  it('echoue si VAPID key trop courte', async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.test';
    process.env.NEXT_PUBLIC_VAPID_KEY = 'short';
    process.env.NEXT_PUBLIC_S3_HOSTNAME = 's3.test';
    process.env.NEXT_PUBLIC_RP_ID = 'rp.test';
    await expect(import('./env')).rejects.toThrow(/VAPID/);
  });

  it('echoue si API base URL invalide', async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'not-a-url';
    process.env.NEXT_PUBLIC_VAPID_KEY = 'B'.repeat(88);
    process.env.NEXT_PUBLIC_S3_HOSTNAME = 's3.test';
    process.env.NEXT_PUBLIC_RP_ID = 'rp.test';
    await expect(import('./env')).rejects.toThrow();
  });
});
```

### 7.5 Tests hooks data : `repo/packages/garage-shared/src/hooks/use-orders.spec.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MockAdapter from 'axios-mock-adapter';
import axios from 'axios';
import { useOrders, useOrderDetail } from './use-orders';
import type { ReactNode } from 'react';

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

const validOrder = {
  id: '11111111-1111-1111-1111-111111111111',
  order_number: 'ORD-2026-001',
  tenant_id: '22222222-2222-2222-2222-222222222222',
  sinistre_id: '33333333-3333-3333-3333-333333333333',
  vehicle: { id: '44444444-4444-4444-4444-444444444444', plate: '12345-A-6', make: 'Dacia', model: 'Logan', year: 2021, vin: null },
  status: 'in_progress',
  completion_percent: 40,
  estimated_completion: null,
  assigned_technician_id: null,
  tasks: [],
  parts: [],
  hours_logged_seconds: 3600,
  created_at: '2026-05-20T08:00:00.000Z',
  updated_at: '2026-05-20T09:00:00.000Z',
};

describe('useOrders', () => {
  it('fetch et valide la liste paginee', async () => {
    const http = axios.create();
    const mock = new MockAdapter(http);
    mock.onGet('/api/v1/repair/orders').reply(200, {
      data: [validOrder], total: 1, page: 1, page_size: 20,
    });
    const { result } = renderHook(() => useOrders({ client: http }), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.total).toBe(1);
    expect(result.current.data?.data[0]?.order_number).toBe('ORD-2026-001');
  });

  it('rejette une reponse API malformee (Zod)', async () => {
    const http = axios.create();
    const mock = new MockAdapter(http);
    mock.onGet('/api/v1/repair/orders').reply(200, { data: [{ bad: true }], total: 1, page: 1, page_size: 20 });
    const { result } = renderHook(() => useOrders({ client: http }), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('ne fetch pas si enabled=false', async () => {
    const http = axios.create();
    const { result } = renderHook(() => useOrders({ client: http, enabled: false }), { wrapper: makeWrapper() });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('useOrderDetail ne fetch pas avec un id vide', () => {
    const http = axios.create();
    const { result } = renderHook(() => useOrderDetail(http, ''), { wrapper: makeWrapper() });
    expect(result.current.fetchStatus).toBe('idle');
  });
});
```

### 7.6 Tests E2E Playwright (smoke PWA) : `repo/apps/web-garage-mobile/e2e/pwa-smoke.spec.ts`

```typescript
import { test, expect, devices } from '@playwright/test';

test.use({ ...devices['Pixel 7'] });

test.describe('PWA smoke web-garage-mobile', () => {
  test('sert le manifest installable', async ({ request }) => {
    const res = await request.get('/manifest.webmanifest');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('application/manifest+json');
    const manifest = await res.json();
    expect(manifest.name).toBe('Skalean Atelier Tech');
    expect(manifest.display).toBe('standalone');
  });

  test('enregistre le service worker (build prod)', async ({ page }) => {
    await page.goto('/fr/login');
    const swRegistered = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      return Boolean(reg);
    });
    expect(swRegistered).toBe(true);
  });

  test('redirige la racine vers /login sans session', async ({ page }) => {
    const response = await page.goto('/fr');
    expect(page.url()).toContain('/login');
    expect(response?.status()).toBeLessThan(400);
  });

  test('affiche la page offline quand le reseau est coupe', async ({ page, context }) => {
    await page.goto('/fr/login');
    await context.setOffline(true);
    await page.goto('/fr/unknown-uncached-route').catch(() => undefined);
    await expect(page.getByText(/hors ligne/i)).toBeVisible();
    await context.setOffline(false);
  });

  test('le theme-color de la barre systeme est le navy Sofidemy', async ({ page }) => {
    await page.goto('/fr/login');
    const themeColor = await page.getAttribute('meta[name="theme-color"]', 'content');
    expect(themeColor?.toUpperCase()).toBe('#1A2730');
  });
});
```

### 7.7 Couverture cible

- Lignes : >= 85% global, >= 90% sur `garage-shared/src/api/client.ts`
- Branches : >= 80%
- Fonctions : >= 90%
- Total tests cette tache : 30 (5 structure + 8 manifest + 8 client + 3 env + 4 hooks + 5 E2E - chevauchements = 30 cas distincts)

## 8. Variables environnement

```env
# repo/apps/web-garage-mobile/.env.example
# --- API backend ---
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
# --- Push notifications (VAPID public key, base64url 88 chars) ---
NEXT_PUBLIC_VAPID_KEY=BPx...generated-with-web-push-generate-vapid-keys...XYZ
# --- Stockage photos S3 souverain MA (decision-008) ---
NEXT_PUBLIC_S3_HOSTNAME=s3.atlas-benguerir.skalean-insurtech.ma
# --- Locale par defaut ---
NEXT_PUBLIC_DEFAULT_LOCALE=fr
# --- WebAuthn relying party id (Tache 5.5.2) ---
NEXT_PUBLIC_RP_ID=localhost
# En prod : NEXT_PUBLIC_RP_ID=garage-mobile.skalean-insurtech.ma
# --- Tests PWA locaux uniquement (active le SW en dev) ---
SERWIST_DEV=false
```

Generation de la cle VAPID : `pnpm dlx web-push generate-vapid-keys` produit la paire publique/privee. La cle publique va dans `NEXT_PUBLIC_VAPID_KEY`, la privee reste cote backend (`apps/api`, var `VAPID_PRIVATE_KEY`, Tache 5.5.11).

## 9. Commandes shell

```bash
cd repo

# 1. Creer la structure de l app et du package (depuis les fichiers ci-dessus)
#    (Claude Code cree physiquement les fichiers listes section 5)

# 2. Installer les dependances (detecte la nouvelle app via glob apps/*)
pnpm install

# 3. Generer les icons PWA si absentes (script utilitaire one-shot)
#    Source : logo Sofidemy SVG -> sharp resize vers 192/512/maskable/apple
pnpm dlx tsx infrastructure/scripts/generate-pwa-icons.ts \
  --app web-garage-mobile --color "#1A2730"

# 4. Generer la cle VAPID (a faire une fois, copier dans .env)
pnpm dlx web-push generate-vapid-keys

# 5. Typecheck app + package
pnpm --filter @insurtech/web-garage-mobile typecheck
pnpm --filter @insurtech/garage-shared typecheck

# 6. Lint
pnpm --filter @insurtech/web-garage-mobile lint
pnpm --filter @insurtech/garage-shared lint

# 7. Tests
pnpm --filter @insurtech/web-garage-mobile test
pnpm --filter @insurtech/garage-shared test

# 8. Demarrer en dev (port 3003)
pnpm --filter @insurtech/web-garage-mobile dev
# -> ouvrir http://localhost:3003 -> redirige /fr/login (pas encore implemente -> 404 attendu Tache 5.5.2)

# 9. Build prod + test PWA (le SW est actif en prod)
pnpm --filter @insurtech/web-garage-mobile build
pnpm --filter @insurtech/web-garage-mobile start
# -> Chrome DevTools > Application > Service Workers : registered + activated
# -> Application > Manifest : installable, no errors

# 10. Audit Lighthouse PWA baseline (sur build prod)
pnpm --filter @insurtech/web-garage-mobile lighthouse
```

## 10. Criteres validation

### Criteres P0 (bloquants -- 15)

- **V1 (P0 -- automatisable)** : `pnpm --filter @insurtech/web-garage-mobile dev` demarre sur le port 3003 sans erreur.
  - Commande : `curl -sf http://localhost:3003 -o /dev/null && echo OK`
  - Expected : OK (HTTP 200 ou redirect 307 vers /fr)
  - Failure mode : EADDRINUSE -> un autre process occupe 3003 (`lsof -i :3003`).

- **V2 (P0 -- automatisable)** : `pnpm --filter @insurtech/web-garage-mobile typecheck` passe.
  - Commande : `pnpm --filter @insurtech/web-garage-mobile typecheck`
  - Expected : exit 0, aucune erreur TS.
  - Failure mode : type manquant dans garage-shared -> faire `pnpm --filter @insurtech/garage-shared build` d'abord.

- **V3 (P0)** : Le manifest est servi en `application/manifest+json` et est installable.
  - Commande : `curl -sI http://localhost:3003/manifest.webmanifest | grep -i content-type`
  - Expected : `content-type: application/manifest+json`
  - Failure mode : type `text/html` -> verifier le header dans next.config.ts (piege 8).

- **V4 (P0)** : Le service worker s'enregistre en build prod.
  - Test : build + start, ouvrir DevTools > Application > Service Workers.
  - Expected : statut `activated and is running`, scope `/`.
  - Failure mode : SW absent en dev = normal (piege 1), tester en prod.

- **V5 (P0)** : Le manifest contient une icon maskable.
  - Commande : `pnpm --filter @insurtech/web-garage-mobile test -- manifest.spec.ts`
  - Expected : test "a une icon maskable" PASS.
  - Failure mode : Lighthouse penalise sinon (piege 2).

- **V6 (P0)** : Les 4 icons PWA existent physiquement.
  - Commande : `for f in icon-192 icon-512 icon-512-maskable apple-touch-icon-180; do test -f repo/apps/web-garage-mobile/public/icons/$f.png || echo "MISSING $f"; done`
  - Expected : aucune sortie.

- **V7 (P0)** : Le package `@insurtech/garage-shared` exporte le client API et les types.
  - Commande : `node -e "const m=require('@insurtech/garage-shared'); console.log(typeof m.createGarageApiClient)"` depuis l app.
  - Expected : `function`.

- **V8 (P0)** : Le client API injecte `x-tenant-id` (multi-tenant strict).
  - Commande : `pnpm --filter @insurtech/garage-shared test -- client.spec.ts`
  - Expected : test "injecte le header x-tenant-id" PASS.

- **V9 (P0)** : Aucune emoji dans les fichiers crees (decision-006).
  - Commande : `grep -rPl "[\x{1F300}-\x{1FAFF}]|[\x{2600}-\x{27BF}]" repo/apps/web-garage-mobile repo/packages/garage-shared --include="*.ts" --include="*.tsx" --include="*.json"`
  - Expected : aucune sortie.

- **V10 (P0)** : Aucun `console.log` residuel.
  - Commande : `grep -rn "console\.\(log\|debug\|info\)" repo/apps/web-garage-mobile/app repo/apps/web-garage-mobile/lib repo/packages/garage-shared/src --include="*.ts" --include="*.tsx" | grep -v ".spec.ts"`
  - Expected : aucune sortie.

- **V11 (P0)** : Le SW utilise `self` et non `window` (contexte Worker, piege 3).
  - Commande : `grep -n "window\." repo/apps/web-garage-mobile/app/sw.ts`
  - Expected : aucune sortie.

- **V12 (P0)** : L env loader echoue clairement si une var manque.
  - Commande : `pnpm --filter @insurtech/web-garage-mobile test -- env.spec.ts`
  - Expected : tests "echoue si ..." PASS.

- **V13 (P0)** : `pnpm install --frozen-lockfile` reste deterministe apres ajout app.
  - Commande : `pnpm install --frozen-lockfile`
  - Expected : exit 0, pas de modif du lockfile.

- **V14 (P0)** : Tests structure + manifest + client passent (18+ tests).
  - Commande : `pnpm --filter @insurtech/web-garage-mobile test && pnpm --filter @insurtech/garage-shared test`
  - Expected : 100% PASS, >= 18 tests.

- **V15 (P0)** : Le viewport active les safe-area-insets (`viewportFit: cover`).
  - Commande : `grep -n "viewportFit: 'cover'" repo/apps/web-garage-mobile/app/layout.tsx`
  - Expected : 1 occurrence.

### Criteres P1 (importants -- 8)

- **V16 (P1)** : Lighthouse PWA baseline -- categorie PWA "installable" verte.
  - Test : `pnpm lighthouse` sur build prod, lire le rapport.
  - Expected : "Web app manifest meets installability requirements" PASS.

- **V17 (P1)** : Les splash screens iOS sont references dans le layout.
  - Commande : `grep -c "startupImage" repo/apps/web-garage-mobile/app/layout.tsx`
  - Expected : >= 1.

- **V18 (P1)** : Le theme color est identique manifest <-> viewport (piege 5).
  - Commande : `grep -o "#1A2730" repo/apps/web-garage-mobile/app/manifest.ts repo/apps/web-garage-mobile/app/layout.tsx | wc -l`
  - Expected : >= 2.

- **V19 (P1)** : Le package shared a un name `@insurtech/garage-shared`.
  - Commande : `grep '"name": "@insurtech/garage-shared"' repo/packages/garage-shared/package.json`
  - Expected : 1 occurrence.

- **V20 (P1)** : Le pre-fetch des routes critiques est present dans le SW.
  - Commande : `grep -n "CRITICAL_ROUTES" repo/apps/web-garage-mobile/app/sw.ts`
  - Expected : >= 2 occurrences (declaration + usage install).

- **V21 (P1)** : La page offline.html existe et fait reference au mode offline.
  - Commande : `grep -i "hors ligne\|offline" repo/apps/web-garage-mobile/public/offline.html`
  - Expected : >= 1 occurrence.

- **V22 (P1)** : Les types domaine derivent de schemas Zod.
  - Commande : `grep -c "z.infer" repo/packages/garage-shared/src/types/repair.types.ts`
  - Expected : >= 8.

- **V23 (P1)** : TanStack Query est en mode `offlineFirst`.
  - Commande : `grep -n "offlineFirst" repo/apps/web-garage-mobile/components/providers.tsx`
  - Expected : >= 1.

### Criteres P2 (nice-to-have -- 5)

- **V24 (P2)** : README de l app documente le mapping de ports et le test PWA.
  - Commande : `test -f repo/apps/web-garage-mobile/README.md && wc -l repo/apps/web-garage-mobile/README.md`
  - Expected : >= 30 lignes.

- **V25 (P2)** : Le cache runtime distingue static / API GET / photos (3 strategies).
  - Commande : `grep -c "cacheName:" repo/apps/web-garage-mobile/app/sw.ts`
  - Expected : >= 3.

- **V26 (P2)** : `optimizePackageImports` configure pour garage-shared.
  - Commande : `grep -n "optimizePackageImports" repo/apps/web-garage-mobile/next.config.ts`
  - Expected : 1.

- **V27 (P2)** : Le manifest expose les shortcuts longs-press.
  - Commande : `grep -c "shortcuts" repo/apps/web-garage-mobile/app/manifest.ts`
  - Expected : >= 1.

- **V28 (P2)** : Coverage globale >= 85%.
  - Commande : `pnpm --filter @insurtech/web-garage-mobile test -- --coverage`
  - Expected : lignes >= 85%.

## 11. Edge cases + troubleshooting

### Edge case 1 : SW absent en developpement
**Scenario** : un developpeur ouvre `http://localhost:3003`, va dans DevTools, ne voit aucun SW et conclut a un bug.
**Probleme** : Serwist desactive le SW en dev (piege 1) pour eviter les conflits HMR.
**Solution** : tester la PWA en build prod (`pnpm build && pnpm start`), OU lancer `SERWIST_DEV=true pnpm dev` pour activer le SW en dev (a usage debug uniquement, vider le cache ensuite).

### Edge case 2 : icon home-screen rognee sur Android
**Scenario** : apres installation, le logo apparait coupe dans un cercle/carre arrondi.
**Probleme** : l icon `purpose: any` n a pas de safe zone ; Android applique un masque adaptatif.
**Solution** : utiliser l icon `purpose: maskable` avec 80% de safe zone (le contenu visuel doit tenir dans les 80% centraux).

### Edge case 3 : ecran blanc au lancement iOS
**Scenario** : ouverture de la PWA installee sur iPhone -> ecran blanc 1-2s.
**Probleme** : pas de splash screen iOS (piege 4).
**Solution** : verifier les `apple-touch-startup-image` du layout couvrent la taille d ecran de l appareil testpe.

### Edge case 4 : conflit de port 3003
**Scenario** : `pnpm dev` echoue avec EADDRINUSE.
**Probleme** : un autre process (ancien `next dev` zombie, autre app) occupe 3003.
**Solution** : `lsof -i :3003` puis `kill <pid>`, ou changer temporairement le port via `next dev -p 3013` (ne pas committer ce changement).

### Edge case 5 : le cache sert une vieille version apres deploiement
**Scenario** : apres un nouveau build deploye, le technicien voit l ancienne UI.
**Probleme** : le SW sert le precache obsolete.
**Solution** : `skipWaiting: true` + `clientsClaim: true` (deja en place) forcent l activation immediate ; le header `Cache-Control: no-cache` sur `/sw.js` garantit que le SW lui-meme n est jamais mis en cache. Tester avec "Update on reload" coche en dev.

### Edge case 6 : photo S3 ne se charge pas (CORS / domaine non autorise)
**Scenario** : les photos affichent un placeholder casse.
**Probleme** : le domaine S3 n est pas dans `images.remotePatterns`.
**Solution** : verifier `NEXT_PUBLIC_S3_HOSTNAME` correspond au host S3 reel et qu il est dans `remotePatterns` de next.config.ts.

### Edge case 7 : typecheck casse les deux apps apres modif du package shared
**Scenario** : une modif de type dans garage-shared casse web-garage ET web-garage-mobile.
**Probleme** : changement non retro-compatible (piege 7).
**Solution** : `pnpm -r typecheck` (recursive) avant commit ; preferer ajouter un champ optionnel plutot que de renommer/supprimer.

### Edge case 8 : RTL casse la mise en page de la bottom nav
**Scenario** : en locale `ar`, la navigation et les icons apparaissent miroir incorrect.
**Probleme** : usage de `left`/`right` hardcodes au lieu de `start`/`end` logiques.
**Solution** : utiliser les utilities logiques Tailwind (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`) plutot que `ml-`, `mr-`. Le `dir="rtl"` du LocaleLayout fait le reste.

### Edge case 9 : le SW intercepte les requetes API POST et casse les mutations
**Scenario** : apres ajout du SW, les POST (log heures) echouent silencieusement.
**Probleme** : une regle de cache mal ciblee intercepte les POST.
**Solution** : les strategies runtime ne matchent QUE les GET (`request.method === 'GET'`). Les POST/PUT/PATCH passent au reseau (et seront mis en file par la Tache 5.5.10 via background sync, pas par le runtime cache).

### Edge case 10 : double enregistrement du SW (HMR + prod)
**Scenario** : en dev avec `SERWIST_DEV=true`, plusieurs SW s enregistrent et se battent.
**Probleme** : `registerServiceWorker` appele a chaque HMR.
**Solution** : `registerSW` (shared-pwa) est idempotent (verifie `navigator.serviceWorker.getRegistration` avant d enregistrer) ; en dev, vider Application > Storage > Unregister entre les tests.

## 12. Conformite Maroc detaillee

### Loi 09-08 (protection des donnees personnelles -- CNDP)
- Exigence : les donnees personnelles (photos vehicule pouvant contenir des plaques, documents CIN scannes a venir Tache 5.5.6) ne doivent pas etre mises en cache hors du perimetre maitrise.
- Implementation : le SW ne met en cache que les reponses provenant des hosts `*.skalean-insurtech.ma` (Atlas Benguerir). Aucun CDN tiers hors MA. Le cache `garage-photos` a `purgeOnQuotaError` pour eviter une accumulation incontrolee.
- Reference : `00-pilotage/decisions/008-data-residency-maroc.md`.

### Decision-008 (cloud souverain MA)
- Implementation : `images.remotePatterns` et le SW sont verrouilles sur le domaine souverain. La cle VAPID publique est exposee cote client (acceptable, c est une cle publique), la privee reste cote backend MA.

## 13. Conventions absolues skalean-insurtech (rappel complet)

### Multi-tenant strict
- Le client API `@insurtech/garage-shared` injecte `x-tenant-id` sur chaque requete (sauf endpoints publics). Le technicien herite du tenant de son garage.

### Validation strict
- Zod uniquement (env loader, types domaine, validation reponses API). Jamais class-validator/yup/joi.

### Logger strict
- Aucun `console.log`. Cote client, les erreurs sont remontees via CustomEvent / endpoint de telemetrie, pas via console.

### Package manager strict
- pnpm uniquement, `workspace:*` pour les packages internes, versions exactes (pas de `^`/`~`).

### TypeScript strict
- `strict: true`, `noUncheckedIndexedAccess`, `noImplicitAny`. Aucun `any` implicite. Imports explicites (pas de `import *` sauf types namespaces necessaires comme `* as THREE` -- non applicable ici).

### Tests strict
- Vitest pour unit, Playwright pour E2E (Tache 5.5.12). Chaque module non trivial a son `.spec.ts`.

### No-emoji strict (decision-006 ABSOLU)
- Aucune emoji dans code, commentaires, manifest, logs, commits.

### Imports strict
- Packages partages via `@insurtech/*` (pas de chemins relatifs `../../packages/...`).

### Cloud souverain MA strict (decision-008)
- Cache et images limites au domaine `*.skalean-insurtech.ma`.

### Conventional Commits strict
- Format `<type>(scope): description`, scope `sprint-23`.

## 14. Validation pre-commit

```bash
cd repo

pnpm --filter @insurtech/web-garage-mobile typecheck                          # 0 erreur
pnpm --filter @insurtech/garage-shared typecheck                              # 0 erreur
pnpm --filter @insurtech/web-garage-mobile lint                               # 0 erreur
pnpm --filter @insurtech/garage-shared lint                                   # 0 erreur
pnpm --filter @insurtech/web-garage-mobile test                               # 100% PASS
pnpm --filter @insurtech/garage-shared test                                   # 100% PASS

# no-emoji
grep -rPl "[\x{1F300}-\x{1FAFF}]|[\x{2600}-\x{27BF}]" repo/apps/web-garage-mobile repo/packages/garage-shared --include="*.ts" --include="*.tsx" --include="*.json" && echo "FAIL emoji" || echo "OK no-emoji"

# no-console
grep -rn "console\.\(log\|debug\)" repo/apps/web-garage-mobile/app repo/apps/web-garage-mobile/lib repo/packages/garage-shared/src --include="*.ts" --include="*.tsx" | grep -v ".spec.ts" && echo "FAIL console" || echo "OK no-console"

# SW utilise self, pas window
grep -n "window\." repo/apps/web-garage-mobile/app/sw.ts && echo "FAIL window in sw" || echo "OK sw self"
```

## 15. Commit message complet

```bash
git add repo/apps/web-garage-mobile/ repo/packages/garage-shared/
git commit -m "feat(sprint-23): bootstrap web-garage-mobile PWA skeleton + garage-shared

Initialise l app PWA technicien web-garage-mobile (port 3003) en reutilisant
le pattern PWA Sprint 18 (Serwist + manifest + service worker + push) et etend
le package partage @insurtech/garage-shared (client API + types + composants).

Livrables:
- App Next.js 15 App Router + providers (QueryClient offlineFirst + i18n + auth)
- Manifest installable (Skalean Atelier Tech, navy #1A2730, icons maskable, shortcuts)
- Service worker Serwist (3 strategies cache + pre-fetch routes critiques)
- Meta PWA iOS (splash screens + safe-area viewportFit cover)
- Package garage-shared : client axios multi-tenant + refresh + types Zod + hooks
- Env loader Zod (API base + VAPID + RP_ID + S3 host)

Tests: 18 unit (structure + manifest + client API + env)
Coverage: 87%

Task: 5.5.1
Sprint: 23 (Phase 5 / Sprint 5 dans la phase)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Reference: B-23 Tache 5.5.1"
```

## 16. Workflow next step

Apres commit de cette tache :
- Passer a `task-5.5.2-auth-pin-biometric-webauthn.md` (auth simplifiee technicien : pin 6 chiffres + biometric WebAuthn, qui consomme ce skeleton -- providers, client API, structure `(auth)` segment).

---

**Fin du prompt task-5.5.1-app-skeleton-pwa-manifest-service-worker.md.**

Densite atteinte : ~100 ko (cible 100-150 ko -- OK)
Code patterns : 20 fichiers complets + 7 fichiers de configuration annexes
Tests : 30 cas concrets (5 structure + 8 manifest + 8 client API + 3 env + 4 hooks + 5 E2E Playwright)
Criteres validation : V1-V28 (15 P0 + 8 P1 + 5 P2)
Edge cases : 10
