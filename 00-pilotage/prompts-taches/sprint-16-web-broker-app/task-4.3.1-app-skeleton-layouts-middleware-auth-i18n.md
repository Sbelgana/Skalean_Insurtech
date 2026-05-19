# TACHE 4.3.1 -- App Skeleton + Layouts + Middleware Auth + i18n Setup (web-broker)

**Sprint** : 16 (Phase 4 / Vertical Insure / Sprint 16 sur 35 cumul)
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md` (Tache 4.3.1)
**Phase** : 4 -- Vertical Insure (Skalean Broker ERP)
**Priorite** : P0
**Effort** : 6h
**Dependances** :
- Sprint 4 (skeleton frontend Tache 1.4.1 -- bootstrap `apps/web-broker` deja livre : Next.js 15 App Router, Tailwind 4, i18n routing fr/ar-MA/ar, font Montserrat + Noto Naskh Arabic, providers chain, api-client axios placeholder)
- Sprint 5 (auth flows backend operationnels : POST /auth/signin, POST /auth/verify-mfa, POST /auth/refresh, cookies access_token + refresh_token httpOnly servis par API NestJS)
- Sprint 6 (tenant context multi-tenant : header `x-tenant-id` accepte par API, cookie `current_tenant_id` set apres login, AsyncLocalStorage server backend gere)
- Sprint 7 (RBAC : 12 roles cibles dont broker_admin / broker_user / broker_assistant, JWT contient `role` + `permissions[]`, PermissionGuard backend en place)

**Densite cible** : 100-150 ko (auto-suffisant -- aucune lecture annexe requise pour executer la tache)
**AUCUNE EMOJI AUTORISEE** (decision-006 strictement appliquee dans code, JSON, markdown, commits, logs)

---

## 1. But (0.5-1 ko)

Transformer le bootstrap Sprint 4 de l'app `apps/web-broker` en **squelette applicatif metier complet** : ajouter la couche middleware de **garde d'authentification** (cookies `access_token` + `refresh_token`), la couche middleware de **garde de tenant** (cookie `current_tenant_id` + injection header `x-tenant-id`), la couche middleware de **detection locale** (Accept-Language + cookie `NEXT_LOCALE`), trois **layouts imbriques** (`app/[locale]/layout.tsx` racine, `app/[locale]/(auth)/layout.tsx` pour pages publiques, `app/[locale]/(protected)/layout.tsx` pour pages authentifiees), un **api-client production-ready** consommant l'API NestJS du Sprint 3 avec auto-refresh transparent du JWT, injection automatique de `x-tenant-id`, propagation `Idempotency-Key` sur mutations, propagation `Accept-Language`, propagation `x-trace-id`, et la **chaine de providers complete** (QueryClient TanStack v5 + NextIntlClientProvider + ThemeProvider + Sonner Toaster + TenantContextSync + Sentry boundary).

Cette tache est la **fondation des 13 taches restantes du Sprint 16** (4.3.2 a 4.3.14). Aucune page metier (auth, dashboard, contacts, deals, polices, broker-queue, sinistres, parametres) ne peut etre developpee tant que cette tache n'est pas validee : le middleware decide qui voit quoi, l'api-client decide comment parler au backend, les layouts decident ou se branche le contenu. Le bootstrap Sprint 4 a pose le skeleton **technique** (Next.js 15 demarre sur 3001, locales fr/ar-MA/ar repondent en 200, theme applique) -- cette tache pose le skeleton **fonctionnel** (auth + tenant + i18n requete + providers metier).

A la sortie de cette tache, l'app `web-broker` est prete a recevoir les pages metier des taches 4.3.2 a 4.3.14 : `pnpm --filter @insurtech/web-broker dev` demarre sur 3001, une route protegee `/fr/dashboard` accedee sans cookie `access_token` redirige vers `/fr/login?redirect=/fr/dashboard`, l'api-client appele depuis un Server Component injecte automatiquement `x-tenant-id` depuis le cookie SSR et `Authorization: Bearer ${access_token}`, un 401 declenche un refresh transparent puis retry de la requete, le QueryClient hydrate les caches via `dehydrate/hydrate` Next.js 15 RSC, le Toaster Sonner est positionne `top-left` en RTL et `top-right` en LTR, et 25+ tests Vitest + 8+ tests Playwright valident chaque pattern.

---

## 2. Contexte etendu (5-10 ko)

### Pourquoi cette tache existe

Le bootstrap Sprint 4 (`task-1.4.1-web-broker-bootstrap-port-3001.md`) a livre un squelette **agnostique du metier** : Next.js 15 + Tailwind 4 + next-intl + axios placeholder + zustand store tenant + i18n 3 locales. Mais ce squelette ne sait **pas** :
- detecter si l'utilisateur est authentifie ;
- rafraichir un JWT expire de facon transparente ;
- bloquer l'acces aux routes `/dashboard`, `/contacts`, `/deals`, `/polices` ;
- separer visuellement les pages publiques (login, signup) des pages authentifiees (sidebar + topbar) ;
- gerer le **multi-tenant** (un courtier peut appartenir a plusieurs cabinets, donc plusieurs `tenant_id`) ;
- detecter et persister la locale preferee de l'utilisateur ;
- propager `x-tenant-id` automatiquement sur chaque requete API ;
- propager `Idempotency-Key` sur les mutations POST/PUT/PATCH/DELETE.

Tous ces comportements sont **transversaux** : chacune des 12 pages metier du Sprint 16 (login, verify-mfa, signup, forgot-password, dashboard, contacts, companies, deals, polices, broker-queue, sinistres, parametres, profile) en depend. Les coder une fois ici dans le middleware + les layouts + l'api-client = facteur d'effort 12 (un developpement, 12 reutilisations).

Le **timing** est imperatif : cette tache est la **premiere** du Sprint 16 (avant 4.3.2 pages auth) parce que :
1. la tache 4.3.2 (pages login + MFA + signup + recovery) consomme l'api-client refactore livre ici ;
2. la tache 4.3.3 (layout sidebar + topbar) etend `app/[locale]/(protected)/layout.tsx` livre ici ;
3. la tache 4.3.12 (RBAC UI) consomme le hook `useCurrentUser` et le decode JWT `jose` livres ici ;
4. la tache 4.3.13 (i18n complete + RTL) etend le routing next-intl et la detection locale livres ici.

Toute deviation des conventions posees ici impose un refactor cross-page couteux : on **ne touche plus** middleware + layouts + api-client apres 4.3.1.

### Alternatives considerees

#### Next.js 15.1.0 vs 14.2.x

| Critere | Next.js 15.1.0 (CHOIX) | Next.js 14.2.x (rejete) |
|---------|-------------------------|---------------------------|
| Sortie stable | decembre 2024 (15.1) | octobre 2023 |
| React 19 support | Officiel | Experimental |
| `await cookies()` / `await headers()` / `await params` | Imposes (Async Request APIs) | Sync (legacy) |
| Turbopack stable dev | Oui (production build experimental) | Beta |
| `after()` hook | Oui | Non |
| Caching defaults | `no-store` par defaut sur fetch | `force-cache` par defaut |
| `use cache` directive | Experimental disponible | Non |
| React Compiler beta | Compatible (opt-in via `experimental.reactCompiler: true`) | Non |
| Middleware Edge Runtime APIs | Stables, `NextResponse.rewrite`, `NextResponse.redirect` | Identiques |
| Maturite retour terrain (mai 2026 = 17 mois 15.x) | Stable | Stable mais transition deja amorcee |

**Decision** : 15.1.0 (deja choisi Sprint 4). On poursuit -- pas de regression. Si vulnerabilite critique, possibilite passer 15.0.4 ou 15.2.x (semver minor).

#### App Router vs Pages Router

Decision deja prise Sprint 4 (App Router exclusivement). Justifications repetees ici parce que la tache 4.3.1 exploite massivement les specificites App Router :
- **Layouts imbriques** : `[locale]/layout.tsx` -> `(auth)/layout.tsx` ou `(protected)/layout.tsx` -- impossible en Pages Router sans `_app.tsx` global et conditionnels custom.
- **Route Groups parentheses** : `(auth)` et `(protected)` n'ajoutent pas de segment URL mais permettent de scoper un layout. Critique pour separer visuellement /login (centered card) de /dashboard (sidebar + topbar).
- **Server Components dans layouts** : `[locale]/layout.tsx` peut faire `await cookies()` + decode JWT server-side -- impossible Pages Router.
- **Streaming via Suspense** : `loading.tsx` rendu pendant que `page.tsx` data-fetch -- non disponible Pages Router.

#### Middleware Edge Runtime vs Node.js Runtime

| Critere | Edge Runtime (CHOIX) | Node.js Runtime (rejete) |
|---------|----------------------|---------------------------|
| Latency cold start | ~50ms global edge | ~300ms cold |
| API Node disponibles | Web Standards seulement (`fetch`, `Request`, `Response`, `crypto.subtle`, `URL`) | Tout Node (`fs`, `path`, `process.env`) |
| `jose` lib | Compatible (utilise Web Crypto) | Compatible |
| `argon2` | NON COMPATIBLE | Compatible |
| Limite bundle size | 1 MB max | Pas de limite stricte |
| Conformite multi-region | Oui (deploye en peripherie) | Non (region centrale) |
| Cookies API | `request.cookies.get(name)` + `NextResponse.cookies.set()` | Identique |

**Decision** : Edge Runtime. Le middleware n'a **pas besoin** d'argon2 ni `fs` -- il fait detection cookie + decode JWT (jose suffit) + redirect. La latency edge est cruciale pour ne pas alourdir chaque navigation. **Important** : si on doit appeler API pour valider JWT cote serveur (introspection), on fait via `fetch` Web Standard -- compatible Edge.

#### next-intl 3.26.3 vs next-i18next vs Next.js native i18n

| Critere | next-intl 3.26.3 (CHOIX) | next-i18next | Next.js native (`next.config.i18n`) |
|---------|---------------------------|---------------|---------------------------------------|
| App Router support | Natif | Limite (plugin non maintenu App Router) | Deprecate App Router |
| Server Components RSC | Oui (`getTranslations()`, `getMessages()`) | Non | N/A |
| Routing localise | Natif (`/fr`, `/ar`) avec `localePrefix: 'always'` | Manuel | Natif Pages Router only |
| Middleware locale detection | Natif (`createMiddleware`) | Manuel | Header-based seulement |
| RTL support | Via `useLocale()` + helper | Manuel | Aucun |
| TypeScript types from JSON | Genere types stricts | Non | Non |
| ICU MessageFormat | Oui | Oui (via i18next-icu) | Non |
| Bundle size client | ~7 ko gzipped | ~35 ko (i18next + react-i18next) | 0 (natif) |
| Compose middleware (auth + tenant + i18n) | Doc officielle pattern compose | Doc absente App Router | N/A |

**Decision** : next-intl 3.26.3 (continuite Sprint 4). Cette tache **compose** le middleware next-intl avec un middleware d'auth custom -- pattern documente officiel.

#### Server Components vs Client Components dans layouts

| Critere | Server Component (CHOIX layout) | Client Component (rejete) |
|---------|--------------------------------|---------------------------|
| `await cookies()` | Oui | Non (utiliser `useCookies` hook) |
| `await headers()` | Oui | Non |
| Decode JWT server-side | Oui (jose `jwtVerify` ou `decodeJwt`) | Non |
| RSC streaming | Oui | Non (waterfall client-side) |
| Bundle client | 0 JS pour le layout | Inclut tout dans bundle |
| Hooks React (`useState`, `useEffect`) | Non disponibles | Disponibles |
| Context Providers necessaires (QueryClient, Theme) | Necessite enfant `'use client'` (`<Providers>`) | Direct |

**Decision** : Layout = Server Component. Providers wrapper = Client Component (`'use client'`) enfant. Pattern : layout fetch user + tenant + locale server-side, passe en props au Client Providers qui initialise QueryClient avec hydratation initial.

#### Sonner vs react-hot-toast vs shadcn/ui Toast

| Critere | Sonner 1.7.x (CHOIX) | react-hot-toast | shadcn/ui Toast (legacy) |
|---------|----------------------|------------------|---------------------------|
| API simple | `toast.success(msg)` | `toast.success(msg)` | `useToast()` + JSX |
| Bundle size | 12 ko | 8 ko | Depend (radix-ui underneath) |
| RSC compatible | Oui (use client wrapper) | Oui | Oui |
| Themable | Oui (`richColors` + `theme="light/dark/system"`) | Oui | Oui |
| RTL support | Oui (position `top-left`/`top-right`) | Limited | Oui |
| Stacking / queue | Natif | Natif | Manuel |
| Promise toast (`toast.promise`) | Excellent | Oui | Non |
| shadcn/ui recommandation actuelle | Sonner depuis 2024 | Legacy | Deprecated |

**Decision** : Sonner 1.7.1 (deja installe Sprint 4). Position dynamique selon `dir`.

#### TanStack Query staleTime defaut 5min vs Infinity vs 0

| Critere | staleTime 5min (CHOIX) | Infinity | 0 |
|---------|-------------------------|----------|---|
| Refetch on mount | Apres 5min | Jamais | Toujours |
| Refetch on window focus | Apres 5min | Jamais | Toujours (avec gcTime) |
| Bonne UX (pas de spinner re-render) | Oui | Oui | Non (spinner partout) |
| Donnees stale max | 5min | Infini | 0 |
| API load | Modere | Faible | Eleve |
| Donnees temps reel | Inadequat | Inadequat | Adequat |

**Decision** : staleTime 5min (300_000ms), gcTime 10min (600_000ms). Override par hook si besoin temps reel (notifications, broker-queue SLA). `refetchOnWindowFocus` desactive en dev, active prod.

### Trade-offs explicites

1. **Middleware Edge Runtime ne peut PAS appeler `argon2` ni `bcrypt`** : pour valider un mot de passe en middleware, impossible. Mitigation : middleware fait UNIQUEMENT decode JWT (cheap, Web Crypto) + redirect. Toute validation password se fait dans `app/api/auth/signin/route.ts` (Node Runtime explicite via `export const runtime = 'nodejs'`).

2. **Le decode JWT en middleware ne VERIFIE PAS la signature** (impossible sans `jose.jwtVerify(token, publicKey)` qui necessite fetch JWKS qui ralentit). Mitigation : middleware decode juste le payload pour extraire `exp` (timestamp) et `sub` (user id). Si `exp < now` -> redirect login. Si `sub` present + `exp` valide -> pass. La **veritable verification signature** se fait cote backend NestJS sur chaque requete (Sprint 5 livre AuthGuard).

3. **Refresh token race condition** : si l'utilisateur ouvre 5 tabs simultanees et que toutes voient le access_token expire en meme temps, 5 requetes `/auth/refresh` partent en parallele. Backend devrait deduplicate (Sprint 5), mais cote frontend on doit `Promise.all` queue les requetes. Mitigation : api-client utilise un singleton `refreshPromise: Promise<void> | null` -- la premiere requete 401 declenche le refresh, les autres attendent la meme promesse.

4. **Cookie `current_tenant_id` `httpOnly: false`** : pour que zustand store client puisse lire et permettre tenant switcher UI (Sprint 16 tache 4.3.3), le cookie tenant doit etre lisible JS. Risque : XSS pourrait lire le cookie. Mitigation : CSP strict (deja Sprint 4) + le `tenant_id` n'est pas un secret (juste un UUID identifiant). Le secret reel est `access_token` qui reste `httpOnly: true`.

5. **`x-tenant-id` injecte cote API route Next.js (proxy) vs cote client direct** : on choisit proxy via `app/api/proxy/[...path]/route.ts` qui ajoute le header depuis cookie SSR. Avantage : pas de manipulation header cote client (defense profondeur). Inconvenient : +1 saut reseau (negligible en dev, en prod le proxy est sur le meme region Atlas Cloud Benguerir).

6. **Middleware execute sur CHAQUE requete y compris assets statiques par defaut** : matcher mal configure = catastrophe perf (running middleware sur `/favicon.ico`, `/icon-192.png`). Mitigation : `config.matcher` exclut `api`, `_next/static`, `_next/image`, `favicon.*`, `manifest.webmanifest`, `robots.txt`, `icons/`, `*.png`, `*.svg`, `*.ico`.

7. **Locale detection redirige une fois trop** : si user va sur `/`, middleware detecte locale `fr` puis redirige `/fr`. OK. Mais si on a `localePrefix: 'always'` et l'user va sur `/dashboard` (sans locale), redirect `/fr/dashboard` PUIS auth middleware check redirect `/fr/login?redirect=/fr/dashboard`. Deux 302 successifs. Mitigation : composer les deux middlewares dans **une seule fonction** qui calcule locale + auth + tenant en un seul retour de NextResponse.

8. **JWT decode client-side avec `jose`** : `jose.decodeJwt(token)` retourne payload sans verifier signature. Bug courant : developpeur croit que `decodeJwt` valide. Mitigation : commentaire en tete du fichier + nom de fonction explicite `decodeJwtUnsafe()` pour rappeler.

### Decisions strategiques referenced

- **decision-001 (monorepo pnpm + Turbo)** : `apps/web-broker` reside dans `repo/apps/`. Cette tache n'ajoute aucune deps qui ne soit deja dans le Sprint 4 (`next-intl 3.26.3`, `@tanstack/react-query 5.62.7`, `axios 1.7.9`, `zustand 5.0.2`, `jose` ajoute ici en 5.9.6, `date-fns-tz 4.1.0` ajoute ici).
- **decision-002 (multi-tenant strict)** : tout endpoint API recoit `x-tenant-id` header. Cette tache propage automatiquement via api-client + middleware proxy.
- **decision-005 (Skalean AI frontier)** : aucune integration AI dans cette tache. Le hook `useAiGateway()` est pose en placeholder (NEXT_PUBLIC_AI_GATEWAY_URL var env) pour Sprint 13+.
- **decision-006 (NO EMOJI ABSOLU)** : zero emoji dans aucun fichier code, messages JSON, commit, log. Verifie par script CI `scripts/check-no-emoji.sh`.
- **decision-008 (cloud souverain Atlas Cloud Benguerir)** : `NEXT_PUBLIC_API_URL` pointe sur `api.skalean-insurtech.ma` prod (Atlas Cloud) ou `localhost:4000` dev. Aucune reference AWS. `images.remotePatterns` exclut `*.amazonaws.com`.
- **decision-009 (multilinguisme MA fr / ar-MA / ar)** : middleware detecte locale Accept-Language + cookie `NEXT_LOCALE` priorise. Si user authentifie a `preferred_locale` dans son profil JWT, on respecte ce choix en prio.
- **decision-010 (Sprint 16 web-broker app)** : cette tache 4.3.1 est officiellement la premiere des 14 du Sprint 16.

### Pieges techniques connus (15 minimum)

1. **`await cookies()` en Server Component declenche dynamic rendering** : tout layout qui fait `await cookies()` ne peut plus etre statiquement rendu. Pour `app/[locale]/(protected)/layout.tsx`, c'est OK (pages protegees sont dynamic). Pour `app/[locale]/layout.tsx`, on evite `cookies()` -- on passe locale via `params`.

2. **`generateStaticParams` doit retourner les 3 locales** : `[{ locale: 'fr' }, { locale: 'ar-MA' }, { locale: 'ar' }]`. Si on oublie, Next.js builds des fallbacks runtime au lieu d'avoir les pages prebuild. Verifie par script CI.

3. **Middleware compose order matters** : si on fait `nextIntlMiddleware(request)` PUIS `authMiddleware(request)`, l'auth voit l'URL deja localisee (`/fr/dashboard`). Si inverse, auth voit `/dashboard` brut. **Convention** : i18n EN PREMIER, auth EN SECOND. Documente dans le code.

4. **`NextResponse.next()` vs `NextResponse.rewrite()` vs `NextResponse.redirect()`** : `next()` continue le pipeline avec headers modifies. `rewrite()` change l'URL servie sans changer URL navigateur. `redirect()` envoie 302/307 au navigateur. Pour injecter `x-tenant-id` on utilise `next()` + set headers. Pour rediriger non-auth on utilise `redirect(/login)`.

5. **Headers set via middleware non visibles cote client** : si on fait `response.headers.set('x-tenant-id', '...')`, c'est UNIQUEMENT visible sur la response a la requete suivante. Les Server Components ne lisent pas ces headers, ils lisent `await headers()` qui sont les headers INCOMING request. Mitigation : pour propager `x-tenant-id` cote SSR, on lit le cookie `current_tenant_id` directement via `await cookies()` dans le Server Component.

6. **`jose.decodeJwt` jette si JWT malforme** : un cookie corrompu (espace, char invalide) declenche exception. Mitigation : `try/catch` autour + clear cookie + redirect login.

7. **`Date.now()` en middleware Edge Runtime peut differer du backend** : si l'horloge Edge est legerement decalee (rare mais possible), un JWT `exp` pas tout a fait expire peut etre vu expire. Mitigation : marge de 30 secondes (`exp * 1000 - 30_000 < Date.now()` = expired).

8. **NextIntlClientProvider rendu cote serveur ET client double les messages** : si on passe messages dans NextIntlClientProvider cote Server Component, ils sont serialises dans le HTML + dans le bundle client. Pour 500 keys par locale = ~50 ko inutiles dans le HTML. Mitigation : `messages={pick(messages, ['common', 'home', 'errors'])}` -- on ne passe que les namespaces utilises cote client.

9. **react-query `dehydrate` / `hydrate` necessite la meme version client+server** : si on mismatch (5.62.7 server vs 5.63.0 client), serialization casse silently. Mitigation : version exacte pinned (`"@tanstack/react-query": "5.62.7"` sans caret) + `pnpm-lock.yaml` commit.

10. **`'use client'` directive ne descend pas aux enfants automatiquement** : si Providers est `'use client'` mais que children passe contient un Server Component, c'est OK -- les Server Components RSC peuvent etre enfants de Client Components. Mais si l'enfant essaye d'importer un module Server-only, build casse. Mitigation : `import 'server-only'` en tete des modules sensibles + bien separer `lib/api-client.server.ts` vs `lib/api-client.client.ts` si necessaire.

11. **Cookies httpOnly inaccessibles cote client = impossible logout local** : pour logout, on doit appeler `POST /auth/signout` qui demande au backend de set Cookie avec `Max-Age=0` (expire). Si on essaye `document.cookie = 'access_token='; expires=...` cote client, ca echoue silencieusement (httpOnly bloque). Mitigation : toujours passer par route Next.js `/api/auth/signout` qui proxy backend.

12. **TanStack Query staleTime + RSC initial fetch double-fetches** : si le Server Component fait `await queryClient.fetchQuery(['contacts'])` ET le Client Component fait `useQuery(['contacts'])`, le client refetch immediatement parce que `staleTime` n'est pas hydrate. Mitigation : `dehydrate(queryClient)` cote server + `<HydrationBoundary state={dehydratedState}>` enveloppe.

13. **CSP `script-src 'unsafe-inline'` necessaire next-themes** : `next-themes` injecte un script inline blocking dans `<head>` pour eviter flash light->dark. CSP strict sans `unsafe-inline` bloque ce script. Mitigation : CSP autorise `'unsafe-inline'` pour `script-src` (deja Sprint 4) -- compromis necessaire jusqu'a script nonce.

14. **`setRequestLocale(locale)` doit etre appele dans CHAQUE Server Component qui consomme i18n** : sinon `getTranslations()` jette `MISSING_LOCALE` runtime error. Mitigation : convention -- chaque `page.tsx` Server Component commence par `setRequestLocale(locale)` apres `await params`.

15. **next-intl `IntlError: MISSING_MESSAGE`** : si une cle existe dans `fr.json` mais pas dans `ar-MA.json`, le runtime jette. En production, le build echoue. Mitigation : script CI `validate-i18n-keys.ts` (deja Sprint 4) verifie parite cles cross-locale.

16. **`process.env.NEXT_PUBLIC_*` lu cote server retourne valeur build-time** : si on change `.env.local` apres build, valeur cote serveur reste l'ancienne. Mitigation : restart dev server apres modif `.env*` + en prod, rebuild requis pour change.

17. **`crypto.randomUUID()` non disponible certains navigateurs vieux + Edge Runtime** : Edge Runtime supporte `crypto.randomUUID()` depuis Node 19. Navigateur : Safari < 15.4 ne supporte pas. Mitigation : helper `generateCryptoId()` deja Sprint 4 avec polyfill.

---

## 3. Architecture context (3-5 ko)

### Position dans Sprint 16

Cette tache est la **premiere des 14 taches** du Sprint 16. Elle bloque toutes les suivantes :

```
Sprint 16 -- Web Broker App (14 taches, 77h total)

[4.3.1 App skeleton + Layouts + Middleware Auth + i18n]  <-- ICI (6h)
   |
   +--> [4.3.2 Pages Auth : login + MFA + signup + recovery]  (6h)
   |       |
   |       +--> [4.3.3 Layout principal sidebar + topbar + tenant switcher]  (5h)
   |               |
   |               +--> [4.3.4 Dashboard 6 widgets]  (6h)
   |               +--> [4.3.5 Contacts page]  (7h)
   |               +--> [4.3.6 Companies page]  (5h)
   |               +--> [4.3.7 Deals kanban + table]  (6h)
   |               +--> [4.3.8 Polices list + detail]  (7h)
   |               +--> [4.3.9 Broker Queue + SLA timer]  (6h)
   |               +--> [4.3.10 Sinistres read-only]  (4h)
   |               +--> [4.3.11 Parametres + Profile]  (5h)
   |               +--> [4.3.12 RBAC UI conditional]  (4h)
   |               +--> [4.3.13 I18n complete + RTL]  (4h)
   |               +--> [4.3.14 Tests E2E Playwright + a11y]  (6h)
```

### Position dans le programme 35 sprints

```
PHASE 1 Bootstrap  (Sprints 1-4)    : skeleton infrastructure + 8 apps stubs
PHASE 2 Identity   (Sprints 5-7)    : auth + tenant + RBAC backend
PHASE 3 Core CRM   (Sprints 8-13)   : CRM, Comm, Docs, Pay, Books, Analytics, HR
PHASE 4 VERT Insure (Sprints 14-22) : <-- on est ici Sprint 16
  Sprint 14 : Insure backend core
  Sprint 15 : Insure lifecycle (cancel, suspend, transfer, broker queue)
  Sprint 16 : <-- web-broker app (cette tache 4.3.1 est la fondation)
  Sprint 17 : web-customer-portal (vente en ligne SEO)
  Sprint 18 : web-assure-portal (self-service assure)
  Sprint 22 : web-garage-app
PHASE 5 Repair     (Sprints 23-26)  : sinistres + flux M9 garage
PHASE 6 Admin      (Sprints 27-30)  : SuperAdmin + reporting
PHASE 7 IA + Pilot (Sprints 31-35)  : IA AI Frontier + pilote Marrakech
```

Cette tache pose le **pattern reutilise** par 3 autres apps Next.js dans des sprints suivants :
- Sprint 17 (web-customer-portal) copiera le middleware + api-client patterns.
- Sprint 18 (web-assure-portal) idem.
- Sprint 22 (web-garage-app) idem.
- Sprint 27 (web-insurtech-admin) idem avec couche super-admin RBAC.

### ASCII tree structure web-broker apres tache 4.3.1

```
repo/apps/web-broker/
|
|-- package.json                                          # MODIFIE : ajout jose 5.9.6, date-fns-tz 4.1.0
|-- next.config.mjs                                       # MODIFIE Sprint 4 : pas de change ici
|-- tailwind.config.ts                                    # INCHANGE Sprint 4
|-- tsconfig.json                                         # INCHANGE Sprint 4
|-- middleware.ts                                         # MODIFIE/RECREE : compose i18n + auth + tenant
|-- playwright.config.ts                                  # INCHANGE Sprint 4
|-- vitest.config.ts                                      # INCHANGE Sprint 4
|-- .env.example                                          # MODIFIE : ajout vars metier
|
|-- src/
|   |-- app/
|   |   |-- [locale]/
|   |   |   |-- layout.tsx                                # MODIFIE Sprint 4 : ajout HydrationBoundary
|   |   |   |-- page.tsx                                  # INCHANGE Sprint 4 (placeholder)
|   |   |   |-- error.tsx                                 # INCHANGE Sprint 4
|   |   |   |-- not-found.tsx                             # INCHANGE Sprint 4
|   |   |   |
|   |   |   |-- (auth)/                                   # NOUVEAU : route group pages publiques
|   |   |   |   |-- layout.tsx                            # NOUVEAU : centered card layout
|   |   |   |   |-- placeholder.tsx                       # NOUVEAU : marker file (sera replaced 4.3.2)
|   |   |   |
|   |   |   |-- (protected)/                              # NOUVEAU : route group pages authentifiees
|   |   |   |   |-- layout.tsx                            # NOUVEAU : guard auth + tenant + structure
|   |   |   |   |-- placeholder.tsx                       # NOUVEAU : marker file (sera replaced 4.3.3)
|   |   |
|   |   |-- api/
|   |   |   |-- auth/
|   |   |   |   |-- refresh/
|   |   |   |   |   |-- route.ts                          # NOUVEAU : proxy refresh token (Node runtime)
|   |   |   |   |-- signout/
|   |   |   |   |   |-- route.ts                          # NOUVEAU : clear cookies + proxy backend
|   |   |   |   |-- me/
|   |   |   |   |   |-- route.ts                          # NOUVEAU : GET current user from cookie
|   |   |   |   |-- switch-tenant/
|   |   |   |   |   |-- route.ts                          # NOUVEAU : POST switch tenant_id cookie
|   |   |   |
|   |   |   |-- health/
|   |   |   |   |-- route.ts                              # NOUVEAU : health check public
|   |   |
|   |   |-- globals.css                                   # INCHANGE Sprint 4
|   |
|   |-- middleware.ts                                     # SUPPRIME (deplace dans repo/apps/web-broker/middleware.ts)
|   |
|   |-- lib/
|   |   |-- api-client.ts                                 # REECRIT : axios + refresh interceptor + Idempotency-Key
|   |   |-- api-client.server.ts                          # NOUVEAU : variant Server Component fetch
|   |   |-- jwt.ts                                        # NOUVEAU : jose decodeJwt + types
|   |   |-- auth/
|   |   |   |-- session.ts                                # NOUVEAU : helper getSession() pour Server Components
|   |   |   |-- cookies.ts                                # NOUVEAU : helpers set/clear cookies typed
|   |   |-- i18n/
|   |   |   |-- config.ts                                 # NOUVEAU : export const constants + routes config
|   |   |   |-- request.ts                                # DEPLACE src/i18n/request.ts -> lib/i18n
|   |   |   |-- routing.ts                                # DEPLACE src/i18n/routing.ts -> lib/i18n
|   |   |   |-- formats.ts                                # NOUVEAU : formats centralises (currency MAD, dates Africa/Casablanca)
|   |   |-- query-client.ts                               # MODIFIE : ajout getQueryClient() singleton
|   |   |-- env.ts                                        # INCHANGE Sprint 4
|   |   |-- logger.ts                                     # INCHANGE Sprint 4
|   |   |-- sentry.ts                                     # INCHANGE Sprint 4
|   |   |-- crypto-id.ts                                  # INCHANGE Sprint 4
|   |
|   |-- components/
|   |   |-- providers.tsx                                 # MODIFIE Sprint 4 : ajout HydrationBoundary + locale prop
|   |   |-- auth/
|   |   |   |-- session-provider.tsx                      # NOUVEAU : Client Context user + permissions
|   |   |   |-- tenant-context-sync.tsx                   # NOUVEAU : sync zustand <-> cookie
|   |
|   |-- store/
|   |   |-- tenant-store.ts                               # MODIFIE Sprint 4 : ajout hydrate from cookie
|   |   |-- session-store.ts                              # NOUVEAU : zustand user/permissions cache
|   |
|   |-- messages/
|   |   |-- fr.json                                       # MODIFIE Sprint 4 : ajout namespace auth + tenant + errors
|   |   |-- ar-MA.json                                    # MODIFIE Sprint 4 : ajout namespace auth + tenant + errors
|   |   |-- ar.json                                       # MODIFIE Sprint 4 : ajout namespace auth + tenant + errors
|   |
|   |-- types/
|   |   |-- session.d.ts                                  # NOUVEAU : interfaces UserSession, Permission, Role
|   |   |-- api.d.ts                                      # NOUVEAU : ApiError, ApiResponse types
|
|-- test/
|   |-- fixtures/
|   |   |-- jwt.ts                                        # NOUVEAU : factory de JWT signe pour tests
|   |   |-- session.ts                                    # NOUVEAU : mock UserSession
|   |
|-- src/lib/__tests__/
|   |-- api-client.spec.ts                                # ETENDU : 8 -> 15 tests
|   |-- jwt.spec.ts                                       # NOUVEAU : 8 tests decodeJwt + isExpired
|   |-- auth/session.spec.ts                              # NOUVEAU : 6 tests getSession
|
|-- src/__tests__/
|   |-- middleware.spec.ts                                # NOUVEAU : 12 tests middleware compose
|
|-- e2e/
|   |-- 01-boot.spec.ts                                   # NOUVEAU : 4 tests boot + locales
|   |-- 02-middleware-auth.spec.ts                        # NOUVEAU : 6 tests redirect non-auth
|   |-- 03-tenant-cookie.spec.ts                          # NOUVEAU : 4 tests tenant injection
```

### Provider chain JSX rendue

```jsx
<html lang={locale} dir={dir} className={`${montserrat.variable} ${notoNaskhArabic.variable} ${geistMono.variable}`} suppressHydrationWarning>
  <body className="min-h-screen bg-background text-foreground antialiased">
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <NextIntlClientProvider locale={locale} messages={messages} timeZone="Africa/Casablanca" now={now} formats={formats}>
        <Providers locale={locale} dehydratedState={dehydratedState}>     {/* 'use client' wrapper */}
          <QueryClientProvider client={queryClient}>
            <HydrationBoundary state={dehydratedState}>
              <SessionProvider initialSession={session}>                  {/* user, role, permissions */}
                <TenantContextSync initialTenantId={tenantId}>            {/* sync zustand <-> cookie */}
                  <SentryErrorBoundary fallback={<ErrorFallback />}>
                    {children}                                            {/* (auth)/layout ou (protected)/layout */}
                  </SentryErrorBoundary>
                </TenantContextSync>
              </SessionProvider>
              {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
            </HydrationBoundary>
          </QueryClientProvider>
        </Providers>
        <Toaster position={dir === 'rtl' ? 'top-left' : 'top-right'} richColors closeButton dir={dir} />
      </NextIntlClientProvider>
    </ThemeProvider>
  </body>
</html>
```

---

## 4. Livrables checkables (L1 a L30)

- [ ] **L1** : `repo/apps/web-broker/middleware.ts` (~220 lignes) compose i18n (next-intl `createMiddleware`) + auth (decode JWT jose + check exp + redirect login si invalide sur routes protegees) + tenant (cookie `current_tenant_id` requis sur routes protegees, redirect `/select-tenant` sinon) + locale persist (cookie `NEXT_LOCALE`). Matcher exclut `api`, `_next/static`, `_next/image`, `favicon.*`, `manifest.webmanifest`, `robots.txt`, `icons/`. Export `export const config = { matcher: [...] }`.

- [ ] **L2** : `repo/apps/web-broker/src/app/[locale]/layout.tsx` (~180 lignes) Server Component root layout : `setRequestLocale(locale)`, `await cookies()` pour extraire access_token + tenant_id, decode JWT pour extraire session user, `getMessages({ locale })`, init `getQueryClient()` server-side + `queryClient.prefetchQuery(['session'], () => session)`, `dehydrate(queryClient)` passe a Providers, fonts via `next/font/google` (Montserrat + Noto Naskh Arabic + Geist Mono), `dir` calcule depuis locale (`['ar', 'ar-MA'].includes(locale)`), `<html lang dir suppressHydrationWarning>`, ThemeProvider next-themes, NextIntlClientProvider avec messages + timeZone Africa/Casablanca + formats currency MAD, Providers wrapper, Toaster Sonner position adaptee dir.

- [ ] **L3** : `repo/apps/web-broker/src/app/[locale]/(auth)/layout.tsx` (~95 lignes) Server Component route group layout pages publiques (login/signup/forgot/reset/verify) : check si user deja authentifie (cookie access_token valide) -> redirect `/${locale}/dashboard`, structure centered card avec logo Skalean en haut, langue switcher en haut a droite, body bg-muted/30, support RTL automatique. Pas de sidebar, pas de topbar.

- [ ] **L4** : `repo/apps/web-broker/src/app/[locale]/(protected)/layout.tsx` (~160 lignes) Server Component route group layout pages authentifiees : guard auth (si pas de session -> `redirect(/${locale}/login?redirect=${pathname})`), guard tenant (si pas de tenant_id cookie -> `redirect(/${locale}/select-tenant)`), prefetch initial data (`/auth/me`, `/tenants/me`), `<SessionProvider>` wrap, structure placeholder `<div className="flex min-h-screen">{children}</div>` (Sprint 16 tache 4.3.3 ajoutera Sidebar + Topbar).

- [ ] **L5** : `repo/apps/web-broker/src/components/providers.tsx` (~110 lignes) Client Component `'use client'` : `QueryClientProvider` avec `getQueryClient()` (singleton via useState + ref), `HydrationBoundary state={dehydratedState}`, `ThemeProvider` (deplace ici depuis layout pour acces useTheme client-side), Sentry init via useEffect avec idempotency flag, ReactQueryDevtools conditionnel `NODE_ENV === 'development'`. Prop `locale` propage pour init formats date-fns.

- [ ] **L6** : `repo/apps/web-broker/src/lib/api-client.ts` (~280 lignes) Axios instance avec : request interceptor injectant `Authorization: Bearer ${accessToken}` (depuis cookie cote serveur ou zustand cote client), `x-tenant-id` (zustand store cote client, cookie cote serveur), `x-trace-id` via `generateCryptoId()`, `Accept-Language: ${locale}`, `Idempotency-Key` UUID v4 sur POST/PUT/PATCH/DELETE only (jamais GET). Response interceptor : 401 declenche `refreshAccessToken()` singleton `refreshPromise` (queue requests parallel), retry request avec nouveau token, si refresh fail -> redirect login + clear cookies. 5xx -> `Sentry.captureException` + structured logger error. Network error -> typed `ApiError` jete au call-site.

- [ ] **L7** : `repo/apps/web-broker/src/lib/api-client.server.ts` (~85 lignes) variant Server Component qui utilise `fetch` native Next.js (avec cache control) + headers depuis `await cookies()` + `await headers()` -- pas d'axios cote server (Axios bundle inutile). Helpers `apiGet`, `apiPost`, `apiPatch`, `apiDelete` typés.

- [ ] **L8** : `repo/apps/web-broker/src/lib/jwt.ts` (~80 lignes) helpers `decodeJwtUnsafe(token: string): JwtPayload | null` (utilise `jose.decodeJwt`, try/catch), `isJwtExpired(payload: JwtPayload, marginSeconds = 30): boolean`, `getJwtExpiry(payload): Date`, typage strict `interface SkaleanJwtPayload { sub, role, permissions, tenant_id, exp, iat }`.

- [ ] **L9** : `repo/apps/web-broker/src/lib/auth/session.ts` (~95 lignes) Server-only helper `getSession()` lit cookie `access_token` + decode + retourne `UserSession | null`. Helper `requireSession()` jette si pas de session (utilise dans Server Components routes protegees). Helper `getCurrentTenantId()` lit cookie `current_tenant_id`. Helper `requireTenant()` jette si absent.

- [ ] **L10** : `repo/apps/web-broker/src/lib/auth/cookies.ts` (~70 lignes) helpers cookies typed : `setAccessTokenCookie(token, maxAge)`, `setRefreshTokenCookie(token, maxAge)`, `setTenantIdCookie(id)`, `clearAuthCookies()`. Options strict : `httpOnly` true sur tokens, `false` sur tenant_id, `secure` prod, `sameSite: 'lax'`, `path: '/'`.

- [ ] **L11** : `repo/apps/web-broker/src/lib/i18n/config.ts` (~50 lignes) constantes centralisees : `SUPPORTED_LOCALES = ['fr', 'ar-MA', 'ar']`, `DEFAULT_LOCALE = 'fr'`, `RTL_LOCALES = ['ar', 'ar-MA']`, `LOCALE_LABELS`, `LOCALE_NATIVE_LABELS`, `getDirection(locale): 'ltr' | 'rtl'`, type `AppLocale`.

- [ ] **L12** : `repo/apps/web-broker/src/lib/i18n/request.ts` (~75 lignes) `getRequestConfig` avec dynamic import messages, fallback fr, formats centralises (currency MAD, date Africa/Casablanca), `now: new Date()`, gestion erreur loading message.

- [ ] **L13** : `repo/apps/web-broker/src/lib/i18n/routing.ts` (~35 lignes) `defineRouting` avec `localePrefix: 'always'`, `localeDetection: true`, `domains` (placeholder Sprint 35), `createNavigation` exposant Link, redirect, usePathname, useRouter typed.

- [ ] **L14** : `repo/apps/web-broker/src/lib/i18n/formats.ts` (~85 lignes) helpers `formatCurrency(amount, locale)` retourne `Intl.NumberFormat(locale, { style: 'currency', currency: 'MAD' })`, `formatDate(date, locale, options)` utilise `date-fns-tz` avec `Africa/Casablanca`, `formatDateTime(date, locale)`, `formatRelative(date, locale)`, `formatNumber(n, locale)`.

- [ ] **L15** : `repo/apps/web-broker/src/store/session-store.ts` (~75 lignes) zustand store `{ session: UserSession | null, setSession, clearSession, hasPermission(p): boolean, hasRole(r): boolean }`. NOT persisted (recompute from cookie at each load).

- [ ] **L16** : `repo/apps/web-broker/src/store/tenant-store.ts` modifie pour hydrate from cookie sync : `useTenantStore.getState().hydrateFromCookie(cookieValue)`.

- [ ] **L17** : `repo/apps/web-broker/src/components/auth/session-provider.tsx` (~80 lignes) Client Component Context Provider : props `initialSession: UserSession | null`, init zustand session-store, expose hook `useSession()`. Auto-refresh user via TanStack Query `useQuery(['session'])` polling 5 min.

- [ ] **L18** : `repo/apps/web-broker/src/components/auth/tenant-context-sync.tsx` (~65 lignes) Client Component : `useEffect` watch zustand tenant-store + write cookie + reload page if tenant changes (force RSC re-render).

- [ ] **L19** : `repo/apps/web-broker/src/app/api/auth/refresh/route.ts` (~110 lignes) Node Runtime API route : lit cookie `refresh_token`, POST `/auth/refresh` backend, set new cookies, retourne 200. Si refresh fail (refresh_token expire ou revoked) -> clear cookies + 401.

- [ ] **L20** : `repo/apps/web-broker/src/app/api/auth/signout/route.ts` (~65 lignes) clear access_token + refresh_token + current_tenant_id cookies, proxy backend `/auth/signout` (revoke session backend), redirect `/login`.

- [ ] **L21** : `repo/apps/web-broker/src/app/api/auth/me/route.ts` (~75 lignes) GET endpoint lit cookie, decode JWT, proxy `/auth/me` backend, retourne UserSession. Cache `Cache-Control: private, max-age=60`.

- [ ] **L22** : `repo/apps/web-broker/src/app/api/auth/switch-tenant/route.ts` (~95 lignes) POST endpoint : body `{ tenant_id }`, valide user a acces ce tenant (proxy backend `/tenants/me`), set cookie `current_tenant_id`, retourne 200.

- [ ] **L23** : `repo/apps/web-broker/src/app/api/health/route.ts` (~25 lignes) GET endpoint public health check, retourne `{ status: 'ok', timestamp, version, env }`.

- [ ] **L24** : `repo/apps/web-broker/src/messages/fr.json` etendu (~70 keys ajoutees) namespaces `auth.*`, `tenant.*`, `errors.*` (network, unauthorized, forbidden, session_expired, refresh_failed, tenant_required), `middleware.*` (redirect_login, redirect_select_tenant).

- [ ] **L25** : `repo/apps/web-broker/src/messages/ar-MA.json` etendu meme cles que fr en Darija.

- [ ] **L26** : `repo/apps/web-broker/src/messages/ar.json` etendu meme cles que fr en arabe classique.

- [ ] **L27** : `repo/apps/web-broker/.env.example` etendu (~45 lignes total) ajout `NEXT_PUBLIC_APP_NAME=skalean-broker`, `NEXT_PUBLIC_DEFAULT_LOCALE=fr`, `NEXT_PUBLIC_SUPPORTED_LOCALES=fr,ar-MA,ar`, `NEXT_PUBLIC_AUTH_REFRESH_PATH=/api/auth/refresh`, `NEXT_PUBLIC_AUTH_LOGIN_PATH=/login`, `NEXT_PUBLIC_AUTH_LOGOUT_PATH=/api/auth/signout`, `NEXT_PUBLIC_SESSION_TTL_SEC=900` (15min), `NEXT_PUBLIC_REFRESH_TTL_SEC=2592000` (30j), `NEXT_PUBLIC_IDEMPOTENCY_HEADER=Idempotency-Key`.

- [ ] **L28** : Tests Vitest unit (`src/lib/__tests__/`, `src/__tests__/`) -- 25+ tests : api-client interceptors (8), jwt decode/expiry (8), session helpers (6), middleware compose (12), i18n config (5).

- [ ] **L29** : Tests Playwright E2E (`e2e/`) -- 8+ tests : boot port 3001, locales /fr/ar-MA/ar repondent, redirect non-auth -> login, cookie tenant inject header, switch tenant, switch locale persist cookie.

- [ ] **L30** : Validation finale : `pnpm --filter @insurtech/web-broker typecheck` 0 erreur, `pnpm --filter @insurtech/web-broker lint --max-warnings 0`, `pnpm --filter @insurtech/web-broker test` 100% pass, `pnpm --filter @insurtech/web-broker test:e2e` 100% pass, `grep -r "emoji" repo/apps/web-broker/src/` 0 ligne, `grep -r "console.log" repo/apps/web-broker/src/` 0 ligne hors tests.

---

## 5. Fichiers crees / modifies (liste exhaustive)

```
repo/apps/web-broker/
  middleware.ts                                                    # NOUVEAU      ~220 lignes  -- L1
  package.json                                                     # MODIFIE       +2 deps
  .env.example                                                     # MODIFIE       ~45 lignes  -- L27
  src/
    app/
      [locale]/
        layout.tsx                                                 # MODIFIE       ~180 lignes -- L2
        page.tsx                                                   # INCHANGE
        (auth)/
          layout.tsx                                               # NOUVEAU       ~95 lignes  -- L3
          placeholder.tsx                                          # NOUVEAU       ~15 lignes
        (protected)/
          layout.tsx                                               # NOUVEAU       ~160 lignes -- L4
          placeholder.tsx                                          # NOUVEAU       ~15 lignes
      api/
        auth/
          refresh/route.ts                                         # NOUVEAU       ~110 lignes -- L19
          signout/route.ts                                         # NOUVEAU       ~65 lignes  -- L20
          me/route.ts                                              # NOUVEAU       ~75 lignes  -- L21
          switch-tenant/route.ts                                   # NOUVEAU       ~95 lignes  -- L22
        health/route.ts                                            # NOUVEAU       ~25 lignes  -- L23
    components/
      providers.tsx                                                # MODIFIE       ~110 lignes -- L5
      auth/
        session-provider.tsx                                       # NOUVEAU       ~80 lignes  -- L17
        tenant-context-sync.tsx                                    # NOUVEAU       ~65 lignes  -- L18
    lib/
      api-client.ts                                                # REECRIT       ~280 lignes -- L6
      api-client.server.ts                                         # NOUVEAU       ~85 lignes  -- L7
      jwt.ts                                                       # NOUVEAU       ~80 lignes  -- L8
      auth/
        session.ts                                                 # NOUVEAU       ~95 lignes  -- L9
        cookies.ts                                                 # NOUVEAU       ~70 lignes  -- L10
      i18n/
        config.ts                                                  # NOUVEAU       ~50 lignes  -- L11
        request.ts                                                 # DEPLACE       ~75 lignes  -- L12
        routing.ts                                                 # DEPLACE       ~35 lignes  -- L13
        formats.ts                                                 # NOUVEAU       ~85 lignes  -- L14
      query-client.ts                                              # MODIFIE       ~75 lignes
    store/
      session-store.ts                                             # NOUVEAU       ~75 lignes  -- L15
      tenant-store.ts                                              # MODIFIE       ~85 lignes  -- L16
    messages/
      fr.json                                                      # MODIFIE       ~120 lignes -- L24
      ar-MA.json                                                   # MODIFIE       ~120 lignes -- L25
      ar.json                                                      # MODIFIE       ~120 lignes -- L26
    types/
      session.d.ts                                                 # NOUVEAU       ~60 lignes
      api.d.ts                                                     # NOUVEAU       ~55 lignes
  test/
    fixtures/
      jwt.ts                                                       # NOUVEAU       ~80 lignes
      session.ts                                                   # NOUVEAU       ~50 lignes
  src/lib/__tests__/
    api-client.spec.ts                                             # ETENDU        ~350 lignes (15 tests)
    jwt.spec.ts                                                    # NOUVEAU       ~180 lignes (8 tests)
    auth/session.spec.ts                                           # NOUVEAU       ~140 lignes (6 tests)
    i18n/config.spec.ts                                            # NOUVEAU       ~95 lignes  (5 tests)
  src/__tests__/
    middleware.spec.ts                                             # NOUVEAU       ~280 lignes (12 tests)
  e2e/
    01-boot.spec.ts                                                # NOUVEAU       ~95 lignes  (4 tests)
    02-middleware-auth.spec.ts                                     # NOUVEAU       ~165 lignes (6 tests)
    03-tenant-cookie.spec.ts                                       # NOUVEAU       ~120 lignes (4 tests)
```

Total : 32 fichiers crees, 9 fichiers modifies, ~3650 lignes nettes hors tests, ~1430 lignes tests.

---

## 6. Code patterns COMPLETS (production-ready)

### 6.1 `repo/apps/web-broker/middleware.ts` (~220 lignes)

```typescript
/**
 * Middleware compose -- web-broker
 * Reference : 00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md (Tache 4.3.1)
 *
 * Roles cumules dans l'ordre :
 *   1. Locale detection (next-intl) + redirect /<locale>/ avec localePrefix 'always'
 *   2. Auth guard : decode access_token cookie, redirect /login si manquant ou expire
 *      sur routes protegees (/dashboard, /contacts, /companies, /deals, /polices,
 *      /broker-queue, /sinistres, /parametres, /profile)
 *   3. Tenant guard : redirect /select-tenant si current_tenant_id cookie manquant
 *      sur routes protegees
 *   4. Injection x-tenant-id header pour routes API proxy
 *   5. Persist locale cookie NEXT_LOCALE (priorite : cookie > Accept-Language)
 *
 * Runtime : Edge Runtime (default Next.js middleware) -- pas de Node APIs.
 * Verification JWT : decode SEULEMENT (pas verify signature). La signature est
 * verifiee cote backend NestJS sur chaque requete API (Sprint 5 AuthGuard).
 *
 * Securite :
 *   - Cookie httpOnly access_token (Sprint 5 set via API NestJS Set-Cookie)
 *   - Edge Runtime no fs / no process APIs (limite a Web Standards)
 *   - JWT exp check avec marge 30 sec
 *
 * Conventions :
 *   - decision-006 NO EMOJI dans messages logs
 *   - decision-009 multilinguisme fr (default) / ar-MA / ar
 */
import { NextRequest, NextResponse } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { decodeJwt } from 'jose';
import { routing } from '@/lib/i18n/routing';

const PROTECTED_ROUTES = [
  '/dashboard',
  '/contacts',
  '/companies',
  '/deals',
  '/polices',
  '/broker-queue',
  '/sinistres',
  '/parametres',
  '/profile',
] as const;

const AUTH_ROUTES = [
  '/login',
  '/verify-mfa',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/select-tenant',
  '/email-sent',
] as const;

const PUBLIC_ROUTES = ['/'] as const;

const JWT_EXPIRY_MARGIN_SEC = 30;
const COOKIE_LOCALE = 'NEXT_LOCALE';
const COOKIE_ACCESS_TOKEN = 'access_token';
const COOKIE_TENANT_ID = 'current_tenant_id';

interface SkaleanJwtPayload {
  sub: string;
  role: string;
  permissions: string[];
  tenant_id: string | null;
  exp: number;
  iat: number;
}

function isJwtValid(token: string | undefined): SkaleanJwtPayload | null {
  if (!token) return null;
  try {
    const payload = decodeJwt(token) as unknown as SkaleanJwtPayload;
    if (!payload?.exp) return null;
    const nowSec = Math.floor(Date.now() / 1000);
    if (payload.exp - JWT_EXPIRY_MARGIN_SEC < nowSec) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function stripLocalePrefix(pathname: string, locale: string): string {
  if (pathname === `/${locale}`) return '/';
  if (pathname.startsWith(`/${locale}/`)) {
    return pathname.slice(`/${locale}`.length);
  }
  return pathname;
}

function matchRoute(cleanPath: string, routes: readonly string[]): boolean {
  return routes.some((route) => cleanPath === route || cleanPath.startsWith(`${route}/`));
}

function detectLocaleFromRequest(request: NextRequest): string {
  const cookieLocale = request.cookies.get(COOKIE_LOCALE)?.value;
  if (cookieLocale && (routing.locales as readonly string[]).includes(cookieLocale)) {
    return cookieLocale;
  }
  const acceptLanguage = request.headers.get('accept-language') ?? '';
  for (const part of acceptLanguage.split(',')) {
    const lang = part.split(';')[0]?.trim().toLowerCase();
    if (!lang) continue;
    if ((routing.locales as readonly string[]).includes(lang)) return lang;
    const base = lang.split('-')[0];
    if (base === 'ar') return 'ar';
    if (base === 'fr') return 'fr';
  }
  return routing.defaultLocale;
}

const intlMiddleware = createIntlMiddleware(routing);

export default async function middleware(request: NextRequest): Promise<NextResponse> {
  const pathname = request.nextUrl.pathname;

  // Step 1 : delegate to next-intl for locale detection + redirect
  // next-intl ecrit cookie NEXT_LOCALE + ajoute headers + redirect si necessaire
  const intlResponse = intlMiddleware(request);

  // If next-intl already returned a redirect, propagate immediately
  if (intlResponse.status >= 300 && intlResponse.status < 400) {
    return intlResponse;
  }

  // Step 2 : determine current locale (always present after intl middleware)
  const localeMatch = pathname.match(/^\/(fr|ar-MA|ar)(\/|$)/);
  const locale = localeMatch ? localeMatch[1] : detectLocaleFromRequest(request);
  const cleanPath = stripLocalePrefix(pathname, locale);

  // Step 3 : public routes (landing + assets) -> pass
  if (PUBLIC_ROUTES.includes(cleanPath as (typeof PUBLIC_ROUTES)[number])) {
    return intlResponse;
  }

  // Step 4 : auth routes (login, signup, etc.)
  // If user is already authenticated, redirect to /dashboard
  const accessToken = request.cookies.get(COOKIE_ACCESS_TOKEN)?.value;
  const jwtPayload = isJwtValid(accessToken);

  if (matchRoute(cleanPath, AUTH_ROUTES)) {
    if (jwtPayload && cleanPath !== '/select-tenant') {
      const tenantId = request.cookies.get(COOKIE_TENANT_ID)?.value;
      if (tenantId) {
        const dashboardUrl = new URL(`/${locale}/dashboard`, request.url);
        return NextResponse.redirect(dashboardUrl);
      }
      // No tenant selected, allow /select-tenant or redirect
      if (cleanPath !== '/select-tenant') {
        const selectTenantUrl = new URL(`/${locale}/select-tenant`, request.url);
        return NextResponse.redirect(selectTenantUrl);
      }
    }
    return intlResponse;
  }

  // Step 5 : protected routes
  if (matchRoute(cleanPath, PROTECTED_ROUTES)) {
    if (!jwtPayload) {
      // Clear stale cookies + redirect login
      const loginUrl = new URL(`/${locale}/login`, request.url);
      loginUrl.searchParams.set('redirect', pathname + request.nextUrl.search);
      const redirectResponse = NextResponse.redirect(loginUrl);
      redirectResponse.cookies.delete(COOKIE_ACCESS_TOKEN);
      return redirectResponse;
    }

    const tenantId = request.cookies.get(COOKIE_TENANT_ID)?.value;
    if (!tenantId) {
      const selectTenantUrl = new URL(`/${locale}/select-tenant`, request.url);
      return NextResponse.redirect(selectTenantUrl);
    }

    // Step 6 : inject x-tenant-id header for downstream proxy routes
    const response = NextResponse.next({
      request: {
        headers: new Headers(request.headers),
      },
    });
    response.headers.set('x-tenant-id', tenantId);
    response.headers.set('x-user-id', jwtPayload.sub);
    response.headers.set('x-user-role', jwtPayload.role);
    // Propagate intl cookies + headers
    intlResponse.cookies.getAll().forEach((c) => response.cookies.set(c));
    return response;
  }

  // Step 7 : everything else -> pass with intl response
  return intlResponse;
}

export const config = {
  matcher: [
    /*
     * Match all paths EXCEPT :
     * - /api (next.js API routes)
     * - /_next/static (build output)
     * - /_next/image (next/image optimizer)
     * - favicon.ico / favicon.svg
     * - manifest.webmanifest
     * - robots.txt
     * - sitemap.xml
     * - icons/* (PWA icons)
     * - images PNG/JPG/SVG racine
     */
    '/((?!api|_next/static|_next/image|favicon\\.ico|favicon\\.svg|manifest\\.webmanifest|robots\\.txt|sitemap\\.xml|icons|.*\\.png|.*\\.svg|.*\\.jpg|.*\\.jpeg|.*\\.webp).*)',
  ],
};
```

### 6.2 `repo/apps/web-broker/src/app/[locale]/layout.tsx` (~180 lignes)

```typescript
/**
 * Root layout web-broker -- locale-aware Server Component
 * Reference : 00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md (Tache 4.3.1)
 *
 * Server Component qui :
 *   - resolve params.locale
 *   - load messages via next-intl getMessages
 *   - decode cookie access_token -> initial session (UserSession | null)
 *   - prefetch session dans QueryClient server-side
 *   - dehydrate QueryClient pour hydratation client-side
 *   - injecte fonts via next/font/google (Montserrat + Noto Naskh Arabic + Geist Mono)
 *   - rend <html lang dir> + chain providers
 *
 * Pas de logique metier ici. Pages metier dans (auth)/ ou (protected)/.
 */
import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Montserrat, Noto_Naskh_Arabic, Geist_Mono } from 'next/font/google';
import { Toaster } from 'sonner';
import { ThemeProvider } from 'next-themes';
import { dehydrate } from '@tanstack/react-query';

import { Providers } from '@/components/providers';
import { routing } from '@/lib/i18n/routing';
import { getDirection, RTL_LOCALES, type AppLocale } from '@/lib/i18n/config';
import { getSession } from '@/lib/auth/session';
import { getQueryClient } from '@/lib/query-client';
import '@/app/globals.css';

const montserrat = Montserrat({
  subsets: ['latin', 'latin-ext'],
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  variable: '--font-montserrat',
  display: 'swap',
  preload: true,
});

const notoNaskhArabic = Noto_Naskh_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500', '700'],
  variable: '--font-arabic',
  display: 'swap',
  preload: true,
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
  preload: false,
});

type LocaleParams = { locale: AppLocale };

export async function generateStaticParams(): Promise<LocaleParams[]> {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<LocaleParams>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta' });
  return {
    title: {
      default: t('title.default'),
      template: `%s | ${t('title.brand')}`,
    },
    description: t('description'),
    applicationName: 'Skalean Broker',
    authors: [{ name: 'Skalean InsurTech' }],
    metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'),
    robots: { index: false, follow: false },
    icons: {
      icon: '/favicon.svg',
      apple: '/icons/apple-touch-icon.png',
    },
    manifest: '/manifest.webmanifest',
    alternates: {
      canonical: `/${locale}`,
      languages: {
        fr: '/fr',
        'ar-MA': '/ar-MA',
        ar: '/ar',
      },
    },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FFFFFF' },
    { media: '(prefers-color-scheme: dark)', color: '#1A2730' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

interface RootLayoutProps {
  children: React.ReactNode;
  params: Promise<LocaleParams>;
}

export default async function RootLayout({ children, params }: RootLayoutProps) {
  const { locale } = await params;

  if (!routing.locales.includes(locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const [messages, session, cookieStore] = await Promise.all([
    getMessages({ locale }),
    getSession(),
    cookies(),
  ]);

  const tenantId = cookieStore.get('current_tenant_id')?.value ?? null;
  const dir = getDirection(locale);

  const queryClient = getQueryClient();
  await queryClient.prefetchQuery({
    queryKey: ['session'],
    queryFn: () => Promise.resolve(session),
    staleTime: 5 * 60 * 1000,
  });
  const dehydratedState = dehydrate(queryClient);

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${montserrat.variable} ${notoNaskhArabic.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background text-foreground antialiased font-sans">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <NextIntlClientProvider
            locale={locale}
            messages={messages}
            timeZone="Africa/Casablanca"
            now={new Date()}
            formats={{
              dateTime: {
                short: { day: 'numeric', month: 'short', year: 'numeric' },
                long: {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                },
              },
              number: {
                currency: { style: 'currency', currency: 'MAD', maximumFractionDigits: 2 },
                percent: { style: 'percent', maximumFractionDigits: 1 },
              },
            }}
          >
            <Providers
              locale={locale}
              initialSession={session}
              initialTenantId={tenantId}
              dehydratedState={dehydratedState}
            >
              {children}
            </Providers>
          </NextIntlClientProvider>
          <Toaster
            position={RTL_LOCALES.has(locale) ? 'top-left' : 'top-right'}
            richColors
            closeButton
            dir={dir}
            theme="system"
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
```

### 6.3 `repo/apps/web-broker/src/app/[locale]/(auth)/layout.tsx` (~95 lignes)

```typescript
/**
 * Auth route group layout -- pages publiques (login, signup, forgot, reset, verify, select-tenant)
 * Reference : 00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md (Tache 4.3.1)
 *
 * Server Component qui :
 *   - check si session valide -> redirect /dashboard (utilisateur deja connecte)
 *   - rend structure centered card + logo Skalean + locale switcher
 *   - body bg muted clair, sans sidebar / topbar
 *
 * Sprint 16 tache 4.3.2 pose login/signup/forgot/reset/verify-mfa/verify-email/select-tenant
 * dans ce groupe.
 */
import { redirect } from 'next/navigation';
import Image from 'next/image';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getSession } from '@/lib/auth/session';
import { LocaleSwitcher } from '@insurtech/shared-ui/components/locale-switcher';
import { ThemeToggle } from '@insurtech/shared-ui/components/theme-toggle';
import type { AppLocale } from '@/lib/i18n/config';

interface AuthLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: AppLocale }>;
}

export default async function AuthLayout({ children, params }: AuthLayoutProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Si user deja authentifie, redirect dashboard (sauf si on est sur /select-tenant ou /verify-email)
  // Note : le middleware fait deja ce check pour la plupart des cas. Defense profondeur ici.
  const session = await getSession();
  const t = await getTranslations({ locale, namespace: 'auth' });

  if (session && session.tenantId) {
    redirect(`/${locale}/dashboard`);
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <header className="flex items-center justify-between px-6 py-4 sm:px-12">
        <a
          href={`/${locale}`}
          className="flex items-center gap-3"
          aria-label={t('aria.back_home')}
        >
          <Image
            src="/icons/skalean-logo.svg"
            alt="Skalean Broker"
            width={140}
            height={32}
            priority
            className="h-8 w-auto"
          />
        </a>
        <div className="flex items-center gap-3">
          <LocaleSwitcher />
          <ThemeToggle />
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-8 sm:px-6">
        <div className="w-full max-w-md">
          {children}
        </div>
      </main>

      <footer className="px-6 py-4 sm:px-12">
        <p className="text-center text-xs text-muted-foreground">
          {t('footer.copyright', { year: new Date().getFullYear() })}
        </p>
        <p className="mt-1 text-center text-xs text-muted-foreground">
          <a href={`/${locale}/legal/privacy`} className="underline hover:text-foreground">
            {t('footer.privacy')}
          </a>
          {' · '}
          <a href={`/${locale}/legal/cookies`} className="underline hover:text-foreground">
            {t('footer.cookies')}
          </a>
          {' · '}
          <a href={`/${locale}/legal/cndp`} className="underline hover:text-foreground">
            {t('footer.cndp_notice')}
          </a>
        </p>
      </footer>
    </div>
  );
}
```

### 6.4 `repo/apps/web-broker/src/app/[locale]/(protected)/layout.tsx` (~160 lignes)

```typescript
/**
 * Protected route group layout -- pages authentifiees (dashboard, contacts, deals, etc.)
 * Reference : 00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md (Tache 4.3.1)
 *
 * Server Component qui :
 *   - guard auth : session requise sinon redirect login
 *   - guard tenant : tenant_id requis sinon redirect select-tenant
 *   - prefetch initial user + tenant data dans QueryClient
 *   - rend structure placeholder pour Sidebar + Topbar (Sprint 16 tache 4.3.3)
 *
 * Sprint 16 tache 4.3.3 enrichit la structure avec Sidebar (gauche) + Topbar (haut)
 * + Breadcrumbs. Pour l'instant : flex container.
 */
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';

import { SessionProvider } from '@/components/auth/session-provider';
import { TenantContextSync } from '@/components/auth/tenant-context-sync';
import { getSession, requireSession, requireTenant } from '@/lib/auth/session';
import { getQueryClient } from '@/lib/query-client';
import { apiServerGet } from '@/lib/api-client.server';
import type { AppLocale } from '@/lib/i18n/config';
import type { UserSession, TenantSummary } from '@/types/session';

interface ProtectedLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: AppLocale }>;
}

export default async function ProtectedLayout({ children, params }: ProtectedLayoutProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Step 1 : guard auth
  const session = await getSession();
  if (!session) {
    const headersList = await headers();
    const pathname = headersList.get('x-invoke-path') ?? `/${locale}/dashboard`;
    redirect(`/${locale}/login?redirect=${encodeURIComponent(pathname)}`);
  }

  // Step 2 : guard tenant
  if (!session.tenantId) {
    redirect(`/${locale}/select-tenant`);
  }

  // Step 3 : prefetch initial data
  const queryClient = getQueryClient();

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: ['auth', 'me'],
      queryFn: async () => session,
      staleTime: 5 * 60 * 1000,
    }),
    queryClient.prefetchQuery({
      queryKey: ['tenants', 'current'],
      queryFn: async () => {
        try {
          const data = await apiServerGet<TenantSummary>('/api/v1/tenants/me');
          return data;
        } catch (err) {
          // Soft fail : Tenant indisponible ne bloque pas le rendu, juste warning UI
          return null;
        }
      },
      staleTime: 5 * 60 * 1000,
    }),
  ]);

  const dehydratedState = dehydrate(queryClient);
  const t = await getTranslations({ locale, namespace: 'protected' });

  return (
    <HydrationBoundary state={dehydratedState}>
      <SessionProvider initialSession={session}>
        <TenantContextSync initialTenantId={session.tenantId}>
          <div className="flex min-h-screen w-full" data-broker-layout="protected">
            {/*
             * Placeholder structure. Sprint 16 tache 4.3.3 livrera :
             *   <Sidebar />     -- gauche fixe, collapse mobile sheet
             *   <Topbar />      -- haut sticky, search + notifications + tenant switcher + user menu
             *   <Breadcrumbs /> -- sous topbar, auto-genere depuis pathname
             *
             * Pour cette tache 4.3.1, on garde un layout neutre pour ne pas
             * preempter les choix Sprint 16 tache 4.3.3.
             */}
            <aside
              aria-label={t('aria.sidebar_placeholder')}
              className="hidden w-64 border-r bg-card lg:block"
              data-placeholder="sidebar"
            >
              <div className="px-4 py-6">
                <p className="text-sm font-semibold text-foreground">Skalean Broker</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('placeholder.sidebar_note')}
                </p>
              </div>
            </aside>

            <div className="flex flex-1 flex-col">
              <header
                aria-label={t('aria.topbar_placeholder')}
                className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-6"
                data-placeholder="topbar"
              >
                <p className="text-sm text-muted-foreground">
                  {t('placeholder.topbar_note')}
                </p>
              </header>

              <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
                {children}
              </main>
            </div>
          </div>
        </TenantContextSync>
      </SessionProvider>
    </HydrationBoundary>
  );
}
```

### 6.5 `repo/apps/web-broker/src/components/providers.tsx` (~110 lignes)

```typescript
'use client';

/**
 * Providers wrapper -- Client Component
 * Reference : 00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md (Tache 4.3.1)
 *
 * Chain :
 *   QueryClientProvider
 *     HydrationBoundary (state from RSC)
 *       SessionProvider (user, role, permissions)
 *         TenantContextSync (zustand <-> cookie)
 *           SentryErrorBoundary
 *             children
 *
 * ThemeProvider est dans le root layout (Server Component compatible).
 * Sonner Toaster aussi dans le root layout.
 */
import { useState, useEffect, useRef } from 'react';
import { QueryClientProvider, HydrationBoundary } from '@tanstack/react-query';
import type { DehydratedState } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import * as Sentry from '@sentry/nextjs';

import { getQueryClient } from '@/lib/query-client';
import { SessionProvider } from '@/components/auth/session-provider';
import { TenantContextSync } from '@/components/auth/tenant-context-sync';
import { logger } from '@/lib/logger';
import type { AppLocale } from '@/lib/i18n/config';
import type { UserSession } from '@/types/session';

interface ProvidersProps {
  children: React.ReactNode;
  locale: AppLocale;
  initialSession: UserSession | null;
  initialTenantId: string | null;
  dehydratedState?: DehydratedState;
}

function SentryErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <Sentry.ErrorBoundary
      fallback={({ error, resetError }) => (
        <div
          role="alert"
          className="m-8 rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-destructive"
        >
          <h2 className="text-lg font-semibold">Une erreur est survenue</h2>
          <pre className="mt-2 max-h-40 overflow-auto text-xs">
            {(error as Error)?.message ?? 'Unknown error'}
          </pre>
          <button
            type="button"
            onClick={() => resetError()}
            className="mt-4 rounded-md border border-destructive px-3 py-1 text-sm hover:bg-destructive hover:text-destructive-foreground"
          >
            Reessayer
          </button>
        </div>
      )}
    >
      {children}
    </Sentry.ErrorBoundary>
  );
}

export function Providers({
  children,
  locale,
  initialSession,
  initialTenantId,
  dehydratedState,
}: ProvidersProps) {
  const queryClient = useState(() => getQueryClient())[0];
  const sentryInitialized = useRef(false);

  useEffect(() => {
    if (sentryInitialized.current) return;
    sentryInitialized.current = true;

    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    if (!dsn || process.env.NODE_ENV === 'development') {
      logger.debug({ component: 'Providers' }, 'sentry_skipped_dev');
      return;
    }

    Sentry.init({
      dsn,
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0.0,
      replaysOnErrorSampleRate: 1.0,
      environment: process.env.NODE_ENV,
      release: process.env.NEXT_PUBLIC_APP_VERSION ?? 'unknown',
    });
    Sentry.setTag('app', 'web-broker');
    Sentry.setTag('locale', locale);
  }, [locale]);

  return (
    <QueryClientProvider client={queryClient}>
      <HydrationBoundary state={dehydratedState}>
        <SessionProvider initialSession={initialSession}>
          <TenantContextSync initialTenantId={initialTenantId}>
            <SentryErrorBoundary>{children}</SentryErrorBoundary>
          </TenantContextSync>
        </SessionProvider>
        {process.env.NODE_ENV === 'development' && (
          <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-right" />
        )}
      </HydrationBoundary>
    </QueryClientProvider>
  );
}
```

### 6.6 `repo/apps/web-broker/src/lib/api-client.ts` (~280 lignes)

```typescript
/**
 * API client Axios -- web-broker
 * Reference : 00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md (Tache 4.3.1)
 *
 * Roles :
 *   - Auto-injection Authorization Bearer (depuis cookie cote SSR / zustand cote client)
 *   - Auto-injection x-tenant-id depuis tenant-store (client) ou cookies SSR
 *   - Auto-injection x-trace-id via crypto.randomUUID
 *   - Auto-injection Idempotency-Key sur POST/PUT/PATCH/DELETE (jamais GET)
 *   - Auto-injection Accept-Language depuis next-intl locale runtime
 *   - 401 -> trigger refresh token via /api/auth/refresh (singleton promise dedupe)
 *   - 401 apres refresh fail -> clear cookies + redirect /login
 *   - 5xx -> Sentry.captureException + logger error
 *   - Network error -> typed ApiError (no swallowed)
 *
 * Multi-tenant strict (decision-002) : si tenantId manquant cote client => abort + log warning.
 *
 * Conventions :
 *   - decision-006 NO EMOJI dans logs
 *   - decision-008 NEXT_PUBLIC_API_URL = api.skalean-insurtech.ma (Atlas Cloud) prod
 */
import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
  AxiosError,
} from 'axios';
import * as Sentry from '@sentry/nextjs';

import { useTenantStore } from '@/store/tenant-store';
import { useSessionStore } from '@/store/session-store';
import { generateCryptoId } from '@/lib/crypto-id';
import { logger } from '@/lib/logger';
import type { ApiError, ApiErrorBody } from '@/types/api';

const MUTATION_METHODS = new Set(['post', 'put', 'patch', 'delete']);
const RETRY_STATUS_CODES = new Set([502, 503, 504]);

const baseURL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const tenantHeader = process.env.NEXT_PUBLIC_TENANT_ID_HEADER ?? 'x-tenant-id';
const traceHeader = process.env.NEXT_PUBLIC_TRACE_ID_HEADER ?? 'x-trace-id';
const idempotencyHeader = process.env.NEXT_PUBLIC_IDEMPOTENCY_HEADER ?? 'Idempotency-Key';
const refreshPath = process.env.NEXT_PUBLIC_AUTH_REFRESH_PATH ?? '/api/auth/refresh';
const loginPath = process.env.NEXT_PUBLIC_AUTH_LOGIN_PATH ?? '/login';

let refreshPromise: Promise<boolean> | null = null;

export interface ApiClientOptions {
  baseURL?: string;
  timeout?: number;
  withCredentials?: boolean;
  locale?: string;
}

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

async function refreshAccessToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const response = await fetch(refreshPath, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        logger.warn(
          { component: 'api-client', status: response.status },
          'refresh_token_failed'
        );
        return false;
      }
      logger.debug({ component: 'api-client' }, 'refresh_token_success');
      return true;
    } catch (err) {
      logger.error(
        { component: 'api-client', err: (err as Error).message },
        'refresh_token_network_error'
      );
      return false;
    } finally {
      // Release lock after small delay to coalesce parallel 401s
      setTimeout(() => {
        refreshPromise = null;
      }, 100);
    }
  })();

  return refreshPromise;
}

function buildApiError(error: AxiosError<ApiErrorBody>): ApiError {
  const status = error.response?.status ?? 0;
  const data = error.response?.data;
  return {
    name: 'ApiError',
    message: data?.message ?? error.message ?? 'Unknown API error',
    code: data?.code ?? `HTTP_${status}`,
    status,
    details: data?.details,
    traceId: (error.response?.headers?.[traceHeader] as string) ?? null,
  };
}

export function createApiClient(options: ApiClientOptions = {}): AxiosInstance {
  const instance = axios.create({
    baseURL: options.baseURL ?? baseURL,
    timeout: options.timeout ?? 30_000,
    withCredentials: options.withCredentials ?? true,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  });

  // ---------------- Request interceptor ----------------
  instance.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      const method = (config.method ?? 'get').toLowerCase();

      // x-trace-id : new UUID for each request
      config.headers.set(traceHeader, generateCryptoId());

      // x-tenant-id : from zustand store (client) -- SSR variant uses api-client.server.ts
      if (typeof window !== 'undefined') {
        const tenantId = useTenantStore.getState().tenantId;
        if (tenantId) {
          config.headers.set(tenantHeader, tenantId);
        } else if (!config.url?.includes('/auth/') && !config.url?.includes('/tenants/me')) {
          // Multi-tenant strict : warn if missing for non-auth endpoint
          logger.warn(
            { component: 'api-client', url: config.url, method },
            'tenant_id_missing_warning'
          );
        }
      }

      // Authorization Bearer : best-effort from session store
      if (typeof window !== 'undefined') {
        const accessToken = useSessionStore.getState().session?.accessToken;
        if (accessToken) {
          config.headers.set('Authorization', `Bearer ${accessToken}`);
        }
      }

      // Accept-Language : from options.locale or html lang
      const locale =
        options.locale ??
        (typeof document !== 'undefined' ? document.documentElement.lang : 'fr');
      config.headers.set('Accept-Language', locale);

      // Idempotency-Key on mutations
      if (MUTATION_METHODS.has(method)) {
        if (!config.headers.has(idempotencyHeader)) {
          config.headers.set(idempotencyHeader, generateCryptoId());
        }
      }

      return config;
    },
    (error: AxiosError) => {
      logger.error(
        { component: 'api-client', err: error.message },
        'request_interceptor_error'
      );
      return Promise.reject(error);
    }
  );

  // ---------------- Response interceptor ----------------
  instance.interceptors.response.use(
    (response: AxiosResponse) => response,
    async (error: AxiosError<ApiErrorBody>) => {
      const status = error.response?.status ?? 0;
      const originalConfig = error.config as RetriableConfig | undefined;

      // 401 -> attempt refresh + retry
      if (status === 401 && originalConfig && !originalConfig._retry) {
        originalConfig._retry = true;
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          return instance.request(originalConfig);
        }
        // Refresh failed : redirect to login
        if (typeof window !== 'undefined') {
          const currentLocale = document.documentElement.lang || 'fr';
          const redirect = encodeURIComponent(window.location.pathname + window.location.search);
          window.location.href = `/${currentLocale}${loginPath}?redirect=${redirect}`;
        }
        return Promise.reject(buildApiError(error));
      }

      // 5xx -> Sentry + retry (one attempt)
      if (RETRY_STATUS_CODES.has(status) && originalConfig && !originalConfig._retry) {
        originalConfig._retry = true;
        logger.warn(
          { component: 'api-client', status, url: originalConfig.url },
          'retry_5xx'
        );
        await new Promise((resolve) => setTimeout(resolve, 500));
        return instance.request(originalConfig);
      }

      if (status >= 500) {
        Sentry.captureException(error, {
          tags: { component: 'api-client', status: String(status) },
          extra: {
            url: originalConfig?.url,
            method: originalConfig?.method,
            traceId: error.response?.headers?.[traceHeader],
          },
        });
        logger.error(
          {
            component: 'api-client',
            status,
            url: originalConfig?.url,
            method: originalConfig?.method,
          },
          'server_error_5xx'
        );
      }

      if (status === 403) {
        logger.warn(
          { component: 'api-client', url: originalConfig?.url },
          'forbidden_403'
        );
      }

      return Promise.reject(buildApiError(error));
    }
  );

  return instance;
}

export const apiClient = createApiClient();

// Convenience typed wrappers
export async function apiGet<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const response = await apiClient.get<T>(url, config);
  return response.data;
}

export async function apiPost<T, B = unknown>(
  url: string,
  body?: B,
  config?: AxiosRequestConfig
): Promise<T> {
  const response = await apiClient.post<T>(url, body, config);
  return response.data;
}

export async function apiPatch<T, B = unknown>(
  url: string,
  body?: B,
  config?: AxiosRequestConfig
): Promise<T> {
  const response = await apiClient.patch<T>(url, body, config);
  return response.data;
}

export async function apiDelete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const response = await apiClient.delete<T>(url, config);
  return response.data;
}
```

### 6.7 `repo/apps/web-broker/src/lib/api-client.server.ts` (~85 lignes)

```typescript
import 'server-only';

/**
 * Server-only API client -- uses native fetch (no axios bundle on server side)
 * Reference : 00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md (Tache 4.3.1)
 *
 * Conventions :
 *   - Lit cookies via next/headers (await cookies())
 *   - Lit headers via next/headers (await headers())
 *   - Inject x-tenant-id depuis cookie current_tenant_id
 *   - Inject Authorization Bearer depuis cookie access_token
 *   - Inject Accept-Language depuis cookie NEXT_LOCALE
 *   - Inject x-trace-id new UUID
 *   - Default cache strategy : no-store (toujours frais cote Server Component)
 *     Override via options.next.revalidate ou options.cache si besoin
 */
import { cookies } from 'next/headers';
import { generateCryptoId } from '@/lib/crypto-id';
import { logger } from '@/lib/logger';
import type { ApiError } from '@/types/api';

const baseURL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const tenantHeader = process.env.NEXT_PUBLIC_TENANT_ID_HEADER ?? 'x-tenant-id';
const traceHeader = process.env.NEXT_PUBLIC_TRACE_ID_HEADER ?? 'x-trace-id';

interface ServerFetchOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  searchParams?: Record<string, string | number | undefined>;
}

async function buildHeaders(extra?: HeadersInit): Promise<Headers> {
  const cookieStore = await cookies();
  const headers = new Headers(extra);
  headers.set('Content-Type', 'application/json');
  headers.set('Accept', 'application/json');
  headers.set(traceHeader, generateCryptoId());

  const accessToken = cookieStore.get('access_token')?.value;
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  const tenantId = cookieStore.get('current_tenant_id')?.value;
  if (tenantId) headers.set(tenantHeader, tenantId);

  const locale = cookieStore.get('NEXT_LOCALE')?.value ?? 'fr';
  headers.set('Accept-Language', locale);

  return headers;
}

export async function apiServerFetch<T>(
  path: string,
  options: ServerFetchOptions = {}
): Promise<T> {
  const { body, searchParams, headers: extraHeaders, ...init } = options;
  const headers = await buildHeaders(extraHeaders);

  const url = new URL(path.startsWith('http') ? path : `${baseURL}${path}`);
  if (searchParams) {
    Object.entries(searchParams).forEach(([k, v]) => {
      if (v !== undefined) url.searchParams.set(k, String(v));
    });
  }

  const response = await fetch(url.toString(), {
    ...init,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: init.cache ?? 'no-store',
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const apiErr: ApiError = {
      name: 'ApiError',
      message: errorBody?.message ?? response.statusText,
      code: errorBody?.code ?? `HTTP_${response.status}`,
      status: response.status,
      details: errorBody?.details,
      traceId: response.headers.get(traceHeader),
    };
    logger.error(
      { component: 'api-client.server', status: response.status, path },
      'server_fetch_failed'
    );
    throw apiErr;
  }
  return (await response.json()) as T;
}

export const apiServerGet = <T>(path: string, options?: ServerFetchOptions) =>
  apiServerFetch<T>(path, { ...options, method: 'GET' });
export const apiServerPost = <T>(path: string, body?: unknown, options?: ServerFetchOptions) =>
  apiServerFetch<T>(path, { ...options, method: 'POST', body });
export const apiServerPatch = <T>(path: string, body?: unknown, options?: ServerFetchOptions) =>
  apiServerFetch<T>(path, { ...options, method: 'PATCH', body });
export const apiServerDelete = <T>(path: string, options?: ServerFetchOptions) =>
  apiServerFetch<T>(path, { ...options, method: 'DELETE' });
```

### 6.8 `repo/apps/web-broker/src/lib/jwt.ts` (~80 lignes)

```typescript
/**
 * JWT helpers -- decode SEUL (pas verify signature).
 * Reference : 00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md (Tache 4.3.1)
 *
 * Important : utilise jose.decodeJwt qui ne verifie PAS la signature.
 * La signature est verifiee cote backend NestJS sur chaque requete API (Sprint 5 AuthGuard).
 * Cote frontend on decode juste le payload pour extraire exp (timestamp), sub (user id),
 * role, permissions, tenant_id pour conditional UI.
 *
 * Naming explicite : decodeJwtUnsafe rappelle qu'il n'y a PAS verification signature.
 */
import { decodeJwt as joseDecodeJwt, type JWTPayload } from 'jose';
import { logger } from '@/lib/logger';

export interface SkaleanJwtPayload extends JWTPayload {
  sub: string;
  role: string;
  permissions: string[];
  tenant_id: string | null;
  email?: string;
  display_name?: string;
  preferred_locale?: string;
  mfa_enabled?: boolean;
  exp: number;
  iat: number;
}

const EXPIRY_MARGIN_SEC = 30;

export function decodeJwtUnsafe(token: string | null | undefined): SkaleanJwtPayload | null {
  if (!token) return null;
  try {
    const payload = joseDecodeJwt(token) as SkaleanJwtPayload;
    if (!payload?.sub || !payload?.exp) {
      logger.warn({ component: 'jwt' }, 'jwt_missing_required_fields');
      return null;
    }
    return payload;
  } catch (err) {
    logger.warn(
      { component: 'jwt', err: (err as Error).message },
      'jwt_decode_failed'
    );
    return null;
  }
}

export function isJwtExpired(
  payload: SkaleanJwtPayload | null,
  marginSeconds: number = EXPIRY_MARGIN_SEC
): boolean {
  if (!payload) return true;
  const nowSec = Math.floor(Date.now() / 1000);
  return payload.exp - marginSeconds < nowSec;
}

export function getJwtExpiryDate(payload: SkaleanJwtPayload): Date {
  return new Date(payload.exp * 1000);
}

export function getJwtRemainingSeconds(payload: SkaleanJwtPayload): number {
  const nowSec = Math.floor(Date.now() / 1000);
  return Math.max(0, payload.exp - nowSec);
}

export function jwtHasPermission(payload: SkaleanJwtPayload | null, permission: string): boolean {
  if (!payload?.permissions) return false;
  return payload.permissions.includes(permission);
}

export function jwtHasRole(
  payload: SkaleanJwtPayload | null,
  roles: string | string[]
): boolean {
  if (!payload?.role) return false;
  const list = Array.isArray(roles) ? roles : [roles];
  return list.includes(payload.role);
}
```

### 6.9 `repo/apps/web-broker/src/lib/auth/session.ts` (~95 lignes)

```typescript
import 'server-only';

/**
 * Session helpers Server-side -- web-broker
 * Reference : 00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md (Tache 4.3.1)
 *
 * Helpers utilises dans Server Components / Server Actions / API routes Next.js.
 * Cote client : utiliser hook useSession() depuis components/auth/session-provider.tsx.
 */
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { decodeJwtUnsafe, isJwtExpired, type SkaleanJwtPayload } from '@/lib/jwt';
import type { UserSession } from '@/types/session';
import { logger } from '@/lib/logger';

const COOKIE_ACCESS_TOKEN = 'access_token';
const COOKIE_TENANT_ID = 'current_tenant_id';

function payloadToSession(payload: SkaleanJwtPayload, accessToken: string): UserSession {
  return {
    userId: payload.sub,
    email: payload.email ?? null,
    displayName: payload.display_name ?? null,
    role: payload.role,
    permissions: payload.permissions ?? [],
    tenantId: payload.tenant_id,
    preferredLocale: payload.preferred_locale ?? null,
    mfaEnabled: payload.mfa_enabled ?? false,
    accessToken,
    expiresAt: new Date(payload.exp * 1000).toISOString(),
  };
}

export async function getSession(): Promise<UserSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_ACCESS_TOKEN)?.value;
  if (!token) return null;
  const payload = decodeJwtUnsafe(token);
  if (!payload || isJwtExpired(payload)) {
    return null;
  }
  // Overlay current_tenant_id cookie (peut differ du tenant_id dans JWT si user a switch)
  const cookieTenantId = cookieStore.get(COOKIE_TENANT_ID)?.value ?? null;
  const session = payloadToSession(payload, token);
  if (cookieTenantId) session.tenantId = cookieTenantId;
  return session;
}

export async function requireSession(): Promise<UserSession> {
  const session = await getSession();
  if (!session) {
    logger.warn({ component: 'auth.session' }, 'require_session_failed_redirect_login');
    redirect('/fr/login');
  }
  return session;
}

export async function getCurrentTenantId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_TENANT_ID)?.value ?? null;
}

export async function requireTenant(): Promise<string> {
  const tenantId = await getCurrentTenantId();
  if (!tenantId) {
    logger.warn({ component: 'auth.session' }, 'require_tenant_failed_redirect_select');
    redirect('/fr/select-tenant');
  }
  return tenantId;
}

export async function requireRole(roles: string | string[]): Promise<UserSession> {
  const session = await requireSession();
  const list = Array.isArray(roles) ? roles : [roles];
  if (!list.includes(session.role)) {
    logger.warn(
      { component: 'auth.session', userRole: session.role, requiredRoles: list },
      'require_role_forbidden'
    );
    redirect('/fr/dashboard?error=forbidden');
  }
  return session;
}

export async function requirePermission(permission: string): Promise<UserSession> {
  const session = await requireSession();
  if (!session.permissions.includes(permission)) {
    logger.warn(
      { component: 'auth.session', userId: session.userId, permission },
      'require_permission_forbidden'
    );
    redirect('/fr/dashboard?error=forbidden');
  }
  return session;
}
```

### 6.10 `repo/apps/web-broker/src/lib/auth/cookies.ts` (~70 lignes)

```typescript
import 'server-only';

/**
 * Cookie helpers Server-side -- web-broker
 * Reference : 00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md (Tache 4.3.1)
 *
 * Convention cookies :
 *   - access_token       : httpOnly, secure prod, sameSite lax, path /
 *   - refresh_token      : httpOnly, secure prod, sameSite strict, path /api/auth
 *   - current_tenant_id  : NOT httpOnly (lisible client pour zustand store + tenant switcher UI),
 *                          secure prod, sameSite lax, path /
 *   - NEXT_LOCALE        : NOT httpOnly, sameSite lax, path / (next-intl manage)
 */
import { cookies } from 'next/headers';

const isProd = process.env.NODE_ENV === 'production';

export interface SetAuthCookieOptions {
  maxAge?: number;
}

export async function setAccessTokenCookie(
  token: string,
  options: SetAuthCookieOptions = {}
): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set('access_token', token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: options.maxAge ?? 900, // 15min default
  });
}

export async function setRefreshTokenCookie(
  token: string,
  options: SetAuthCookieOptions = {}
): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set('refresh_token', token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict',
    path: '/api/auth',
    maxAge: options.maxAge ?? 2_592_000, // 30 jours default
  });
}

export async function setTenantIdCookie(tenantId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set('current_tenant_id', tenantId, {
    httpOnly: false, // lisible client pour zustand store + tenant switcher UI
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: 2_592_000, // 30 jours
  });
}

export async function clearAuthCookies(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete('access_token');
  cookieStore.delete({ name: 'refresh_token', path: '/api/auth' });
  cookieStore.delete('current_tenant_id');
}
```

### 6.11 `repo/apps/web-broker/src/lib/i18n/config.ts` (~50 lignes)

```typescript
/**
 * i18n config constants -- web-broker
 * Reference : 00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md (Tache 4.3.1)
 *
 * Decision-009 multilinguisme MA : fr (defaut) / ar-MA (Darija) / ar (classique formel).
 * Pas d'anglais dans web-broker. EN sera ajoute Sprint 17 (customer-portal SEO).
 */
export const SUPPORTED_LOCALES = ['fr', 'ar-MA', 'ar'] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = 'fr';

export const RTL_LOCALES = new Set<AppLocale>(['ar', 'ar-MA']);

export const LOCALE_LABELS: Record<AppLocale, string> = {
  fr: 'Francais',
  'ar-MA': 'Darija marocaine',
  ar: 'Arabe classique',
};

export const LOCALE_NATIVE_LABELS: Record<AppLocale, string> = {
  fr: 'Francais',
  'ar-MA': 'الدارجة المغربية',
  ar: 'العربية',
};

export const LOCALE_DATE_FNS_LOCALES: Record<AppLocale, string> = {
  fr: 'fr',
  'ar-MA': 'ar-MA',
  ar: 'ar',
};

export function getDirection(locale: string): 'ltr' | 'rtl' {
  return RTL_LOCALES.has(locale as AppLocale) ? 'rtl' : 'ltr';
}

export function isSupportedLocale(locale: string): locale is AppLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(locale);
}

export const I18N_NAMESPACES = [
  'meta',
  'home',
  'common',
  'nav',
  'auth',
  'tenant',
  'errors',
  'middleware',
  'protected',
  'dashboard',
  'contacts',
  'companies',
  'deals',
  'polices',
  'broker_queue',
  'sinistres',
  'parametres',
  'profile',
] as const;
```

### 6.12 `repo/apps/web-broker/src/lib/i18n/request.ts` (~75 lignes)

```typescript
/**
 * next-intl request config -- web-broker
 * Reference : 00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md (Tache 4.3.1)
 *
 * Charge dynamiquement les messages JSON par locale.
 * Fallback fr si locale non supportee ou JSON corrompu.
 * Formats centralises (currency MAD, dates Africa/Casablanca).
 */
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';
import { isSupportedLocale, DEFAULT_LOCALE } from './config';
import { logger } from '@/lib/logger';

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !isSupportedLocale(locale)) {
    locale = DEFAULT_LOCALE;
  }

  let messages: Record<string, unknown>;
  try {
    messages = (await import(`@/messages/${locale}.json`)).default;
  } catch (error) {
    logger.error(
      { component: 'i18n.request', locale, err: (error as Error).message },
      'messages_load_failed_fallback_fr'
    );
    if (process.env.NODE_ENV !== 'production') {
      throw new Error(
        `[i18n] Failed to load messages for locale ${locale}: ${(error as Error).message}`
      );
    }
    locale = DEFAULT_LOCALE;
    messages = (await import(`@/messages/${DEFAULT_LOCALE}.json`)).default;
  }

  return {
    locale,
    messages,
    timeZone: 'Africa/Casablanca',
    now: new Date(),
    formats: {
      dateTime: {
        short: { day: 'numeric', month: 'short', year: 'numeric' },
        medium: {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        },
        long: {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          timeZoneName: 'short',
        },
      },
      number: {
        currency: { style: 'currency', currency: 'MAD', maximumFractionDigits: 2 },
        percent: { style: 'percent', maximumFractionDigits: 1 },
        decimal: { style: 'decimal', maximumFractionDigits: 2 },
      },
    },
    onError(error) {
      if (error.code === 'MISSING_MESSAGE') {
        logger.warn(
          { component: 'i18n.request', locale, code: error.code, message: error.message },
          'missing_message_key'
        );
        return;
      }
      logger.error(
        { component: 'i18n.request', locale, code: error.code, message: error.message },
        'i18n_runtime_error'
      );
    },
    getMessageFallback({ namespace, key, error }) {
      const fullKey = namespace ? `${namespace}.${key}` : key;
      if (error.code === 'MISSING_MESSAGE') {
        return process.env.NODE_ENV === 'development' ? `[MISSING: ${fullKey}]` : fullKey;
      }
      return fullKey;
    },
  };
});
```

### 6.13 `repo/apps/web-broker/src/lib/i18n/routing.ts` (~35 lignes)

```typescript
/**
 * next-intl routing config -- web-broker
 * Reference : 00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md (Tache 4.3.1)
 *
 * localePrefix: 'always' : URL toujours prefixee /fr/dashboard, /ar-MA/dashboard, etc.
 * localeDetection: true : middleware detecte locale via Accept-Language + cookie NEXT_LOCALE.
 */
import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';
import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from './config';

export const routing = defineRouting({
  locales: SUPPORTED_LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: 'always',
  localeDetection: true,
  // Sprint 35 : domains config pour broker.skalean-insurtech.ma vs broker-ar.skalean-insurtech.ma
  // Pour Sprint 16, on garde un unique domaine + prefix.
});

export type AppRouting = typeof routing;

export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
```

### 6.14 `repo/apps/web-broker/src/lib/i18n/formats.ts` (~85 lignes)

```typescript
/**
 * Formats helpers locale-aware -- web-broker
 * Reference : 00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md (Tache 4.3.1)
 *
 * Currency MAD systematiquement (decision-009 + conventions).
 * Timezone Africa/Casablanca systematiquement (date-fns-tz).
 * Locale fr / ar-MA / ar pris en charge par date-fns.
 */
import { format as formatDateFns, formatRelative as formatRelativeDateFns } from 'date-fns';
import { fr, arMA, ar } from 'date-fns/locale';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import type { AppLocale } from './config';

const TIMEZONE = 'Africa/Casablanca';

const DATE_FNS_LOCALE_MAP = {
  fr,
  'ar-MA': arMA,
  ar,
} as const;

function getDateFnsLocale(locale: AppLocale) {
  return DATE_FNS_LOCALE_MAP[locale];
}

export function formatCurrency(amount: number, locale: AppLocale): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'MAD',
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatNumber(
  value: number,
  locale: AppLocale,
  options?: Intl.NumberFormatOptions
): string {
  return new Intl.NumberFormat(locale, options).format(value);
}

export function formatPercent(value: number, locale: AppLocale): string {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatDate(
  date: Date | string | number,
  locale: AppLocale,
  formatString = 'dd MMM yyyy'
): string {
  return formatInTimeZone(date, TIMEZONE, formatString, {
    locale: getDateFnsLocale(locale),
  });
}

export function formatDateTime(
  date: Date | string | number,
  locale: AppLocale,
  formatString = 'dd MMM yyyy HH:mm'
): string {
  return formatInTimeZone(date, TIMEZONE, formatString, {
    locale: getDateFnsLocale(locale),
  });
}

export function formatRelative(
  date: Date | string | number,
  baseDate: Date,
  locale: AppLocale
): string {
  const zonedDate = toZonedTime(typeof date === 'string' || typeof date === 'number' ? new Date(date) : date, TIMEZONE);
  const zonedBase = toZonedTime(baseDate, TIMEZONE);
  return formatRelativeDateFns(zonedDate, zonedBase, {
    locale: getDateFnsLocale(locale),
  });
}

export function formatPhoneNumber(phone: string): string {
  // E.164 MA : +212XXXXXXXXX -> +212 6 12 34 56 78 (or +212 5 22 ...)
  const cleaned = phone.replace(/\s/g, '');
  if (cleaned.startsWith('+212') && cleaned.length === 13) {
    return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 5)} ${cleaned.slice(5, 7)} ${cleaned.slice(7, 9)} ${cleaned.slice(9, 11)} ${cleaned.slice(11, 13)}`;
  }
  return phone;
}
```

### 6.15 `repo/apps/web-broker/src/store/session-store.ts` (~75 lignes)

```typescript
/**
 * Session store -- zustand client-side
 * Reference : 00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md (Tache 4.3.1)
 *
 * NOT persisted : recompute from cookie + /api/auth/me at each page load.
 * Permet UI conditional rendering (RBAC) sans appel API a chaque check.
 */
import { create } from 'zustand';
import type { UserSession } from '@/types/session';

interface SessionState {
  session: UserSession | null;
  setSession: (session: UserSession | null) => void;
  clearSession: () => void;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: string | string[]) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  session: null,

  setSession: (session) => set({ session }),

  clearSession: () => set({ session: null }),

  hasPermission: (permission) => {
    const session = get().session;
    return Boolean(session?.permissions.includes(permission));
  },

  hasRole: (role) => {
    const session = get().session;
    if (!session?.role) return false;
    const list = Array.isArray(role) ? role : [role];
    return list.includes(session.role);
  },

  hasAnyPermission: (permissions) => {
    const session = get().session;
    if (!session?.permissions) return false;
    return permissions.some((p) => session.permissions.includes(p));
  },

  hasAllPermissions: (permissions) => {
    const session = get().session;
    if (!session?.permissions) return false;
    return permissions.every((p) => session.permissions.includes(p));
  },
}));
```

### 6.16 `repo/apps/web-broker/src/store/tenant-store.ts` (~85 lignes)

```typescript
/**
 * Tenant store -- zustand persistent (sessionStorage)
 * Reference : 00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md (Tache 4.3.1)
 *
 * Persisted sessionStorage : isole par tab, donc multi-tenant cross-tab safe.
 * Hydrate from cookie current_tenant_id au boot client.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface TenantState {
  tenantId: string | null;
  tenantName: string | null;
  hasHydrated: boolean;
  setTenantId: (id: string, name?: string) => void;
  clearTenant: () => void;
  hydrateFromCookie: (cookieValue: string | null) => void;
  setHasHydrated: (v: boolean) => void;
}

export const useTenantStore = create<TenantState>()(
  persist(
    (set) => ({
      tenantId: null,
      tenantName: null,
      hasHydrated: false,

      setTenantId: (id, name) => set({ tenantId: id, tenantName: name ?? null }),

      clearTenant: () => set({ tenantId: null, tenantName: null }),

      hydrateFromCookie: (cookieValue) => {
        if (cookieValue && cookieValue.length > 0) {
          set({ tenantId: cookieValue });
        }
      },

      setHasHydrated: (v) => set({ hasHydrated: v }),
    }),
    {
      name: 'web-broker:tenant',
      storage: createJSONStorage(() => sessionStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
      partialize: (state) => ({
        tenantId: state.tenantId,
        tenantName: state.tenantName,
      }),
    }
  )
);
```

### 6.17 `repo/apps/web-broker/src/components/auth/session-provider.tsx` (~80 lignes)

```typescript
'use client';

/**
 * SessionProvider -- Client Context wrapping zustand session store
 * Reference : 00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md (Tache 4.3.1)
 *
 * - Init zustand session-store depuis initialSession (passe par Server Component layout)
 * - Auto-refresh user data via TanStack Query polling 5 min (refetchInterval)
 * - Expose hook useSession() pour Client Components downstream
 */
import { createContext, useContext, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSessionStore } from '@/store/session-store';
import { apiGet } from '@/lib/api-client';
import type { UserSession } from '@/types/session';
import { logger } from '@/lib/logger';

interface SessionContextValue {
  session: UserSession | null;
  isLoading: boolean;
  refetch: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

interface SessionProviderProps {
  children: React.ReactNode;
  initialSession: UserSession | null;
}

export function SessionProvider({ children, initialSession }: SessionProviderProps) {
  const setSession = useSessionStore((s) => s.setSession);
  const storeSession = useSessionStore((s) => s.session);

  useEffect(() => {
    if (initialSession && !storeSession) {
      setSession(initialSession);
    }
  }, [initialSession, storeSession, setSession]);

  const query = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      try {
        const data = await apiGet<UserSession>('/api/auth/me');
        setSession(data);
        return data;
      } catch (err) {
        logger.warn(
          { component: 'SessionProvider', err: (err as Error).message },
          'auth_me_refresh_failed'
        );
        throw err;
      }
    },
    enabled: Boolean(initialSession),
    initialData: initialSession ?? undefined,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    retry: 1,
  });

  const value = useMemo<SessionContextValue>(
    () => ({
      session: query.data ?? storeSession,
      isLoading: query.isLoading,
      refetch: () => {
        void query.refetch();
      },
    }),
    [query.data, query.isLoading, query.refetch, storeSession]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error('useSession must be used within SessionProvider');
  }
  return ctx;
}
```

### 6.18 `repo/apps/web-broker/src/components/auth/tenant-context-sync.tsx` (~65 lignes)

```typescript
'use client';

/**
 * TenantContextSync -- sync zustand <-> cookie current_tenant_id
 * Reference : 00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md (Tache 4.3.1)
 *
 * - Au mount : hydrate zustand depuis cookie (passe par initialTenantId prop)
 * - Watch zustand : si tenantId change, write cookie + soft reload pour re-trigger RSC
 *   (parce que les Server Components doivent re-fetch avec le nouveau tenant)
 */
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTenantStore } from '@/store/tenant-store';
import { logger } from '@/lib/logger';

interface TenantContextSyncProps {
  children: React.ReactNode;
  initialTenantId: string | null;
}

export function TenantContextSync({ children, initialTenantId }: TenantContextSyncProps) {
  const router = useRouter();
  const tenantId = useTenantStore((s) => s.tenantId);
  const hydrateFromCookie = useTenantStore((s) => s.hydrateFromCookie);
  const hasHydrated = useTenantStore((s) => s.hasHydrated);
  const lastSyncedRef = useRef<string | null>(null);

  // Hydrate at mount
  useEffect(() => {
    if (initialTenantId && !tenantId) {
      hydrateFromCookie(initialTenantId);
      lastSyncedRef.current = initialTenantId;
    } else if (tenantId) {
      lastSyncedRef.current = tenantId;
    }
  }, [initialTenantId, tenantId, hydrateFromCookie]);

  // Watch tenant changes -> reload to re-trigger Server Components
  useEffect(() => {
    if (!hasHydrated) return;
    if (tenantId && lastSyncedRef.current && tenantId !== lastSyncedRef.current) {
      logger.info(
        { component: 'TenantContextSync', from: lastSyncedRef.current, to: tenantId },
        'tenant_switched_refreshing_rsc'
      );
      lastSyncedRef.current = tenantId;
      // Soft refresh : router.refresh() re-trigge RSC sans hard reload
      router.refresh();
    }
  }, [tenantId, hasHydrated, router]);

  return <>{children}</>;
}
```

### 6.19 `repo/apps/web-broker/src/app/api/auth/refresh/route.ts` (~110 lignes)

```typescript
/**
 * Refresh token API route -- Node runtime explicite
 * Reference : 00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md (Tache 4.3.1)
 *
 * POST /api/auth/refresh
 *
 * Flow :
 *   1. Lit cookie refresh_token (httpOnly)
 *   2. POST backend /auth/refresh avec refresh_token
 *   3. Backend retourne nouveau access_token + new refresh_token (rotation)
 *   4. Set cookies via helpers
 *   5. Retourne 200 + JSON { access_token: '...' } (sans tokens dans body, juste confirmation)
 *
 * Si refresh fail (token expire, revoked) -> clear cookies + 401 + redirect cote client.
 */
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  setAccessTokenCookie,
  setRefreshTokenCookie,
  clearAuthCookies,
} from '@/lib/auth/cookies';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface BackendRefreshResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number; // seconds
  refresh_expires_in: number;
}

export async function POST(request: Request): Promise<NextResponse> {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get('refresh_token')?.value;

  if (!refreshToken) {
    logger.warn({ component: 'api.auth.refresh' }, 'refresh_token_cookie_missing');
    return NextResponse.json(
      { code: 'NO_REFRESH_TOKEN', message: 'Refresh token absent' },
      { status: 401 }
    );
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

  try {
    const response = await fetch(`${apiUrl}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      logger.warn(
        { component: 'api.auth.refresh', status: response.status },
        'backend_refresh_failed'
      );
      await clearAuthCookies();
      return NextResponse.json(
        { code: 'REFRESH_FAILED', message: 'Refresh failed' },
        { status: 401 }
      );
    }

    const data: BackendRefreshResponse = await response.json();

    await Promise.all([
      setAccessTokenCookie(data.access_token, { maxAge: data.expires_in }),
      setRefreshTokenCookie(data.refresh_token, { maxAge: data.refresh_expires_in }),
    ]);

    logger.info({ component: 'api.auth.refresh' }, 'refresh_success');

    return NextResponse.json(
      {
        success: true,
        expires_in: data.expires_in,
      },
      { status: 200 }
    );
  } catch (err) {
    logger.error(
      { component: 'api.auth.refresh', err: (err as Error).message },
      'refresh_unexpected_error'
    );
    await clearAuthCookies();
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Internal error during refresh' },
      { status: 500 }
    );
  }
}
```

### 6.20 `repo/apps/web-broker/src/app/api/auth/signout/route.ts` (~65 lignes)

```typescript
/**
 * Signout API route -- Node runtime
 * Reference : 00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md (Tache 4.3.1)
 *
 * POST /api/auth/signout
 *
 * Flow :
 *   1. Proxy backend /auth/signout (revoke session backend + audit log)
 *   2. Clear cookies access_token + refresh_token + current_tenant_id
 *   3. Retourne 200
 */
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { clearAuthCookies } from '@/lib/auth/cookies';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_request: Request): Promise<NextResponse> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token')?.value;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

  if (accessToken) {
    try {
      await fetch(`${apiUrl}/api/v1/auth/signout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      logger.info({ component: 'api.auth.signout' }, 'backend_signout_success');
    } catch (err) {
      // Best-effort : meme si backend signout fail, on clear cookies cote client
      logger.warn(
        { component: 'api.auth.signout', err: (err as Error).message },
        'backend_signout_failed_continue'
      );
    }
  }

  await clearAuthCookies();
  return NextResponse.json({ success: true }, { status: 200 });
}
```

### 6.21 `repo/apps/web-broker/src/app/api/auth/me/route.ts` (~75 lignes)

```typescript
/**
 * Get current user API route
 * Reference : 00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md (Tache 4.3.1)
 *
 * GET /api/auth/me
 *
 * Retourne UserSession enrichie (proxy backend /auth/me).
 * Cache private 60s pour limiter appels backend mais permettre refresh user data.
 */
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { decodeJwtUnsafe } from '@/lib/jwt';
import { logger } from '@/lib/logger';
import type { UserSession } from '@/types/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request): Promise<NextResponse<UserSession | { error: string }>> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token')?.value;
  const tenantId = cookieStore.get('current_tenant_id')?.value ?? null;

  if (!accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const payload = decodeJwtUnsafe(accessToken);
  if (!payload) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

  try {
    const response = await fetch(`${apiUrl}/api/v1/auth/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(tenantId ? { 'x-tenant-id': tenantId } : {}),
      },
    });
    if (!response.ok) {
      logger.warn(
        { component: 'api.auth.me', status: response.status },
        'backend_me_failed'
      );
      return NextResponse.json({ error: 'Backend error' }, { status: response.status });
    }
    const data = await response.json();
    const session: UserSession = {
      userId: data.id ?? payload.sub,
      email: data.email ?? null,
      displayName: data.display_name ?? null,
      role: data.role ?? payload.role,
      permissions: data.permissions ?? payload.permissions ?? [],
      tenantId: tenantId ?? data.tenant_id ?? null,
      preferredLocale: data.preferred_locale ?? null,
      mfaEnabled: data.mfa_enabled ?? false,
      accessToken,
      expiresAt: new Date(payload.exp * 1000).toISOString(),
    };
    return NextResponse.json(session, {
      status: 200,
      headers: { 'Cache-Control': 'private, max-age=60' },
    });
  } catch (err) {
    logger.error(
      { component: 'api.auth.me', err: (err as Error).message },
      'me_unexpected_error'
    );
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

### 6.22 `repo/apps/web-broker/src/app/api/auth/switch-tenant/route.ts` (~95 lignes)

```typescript
/**
 * Switch tenant API route
 * Reference : 00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md (Tache 4.3.1)
 *
 * POST /api/auth/switch-tenant
 * Body : { tenant_id: string }
 *
 * Flow :
 *   1. Valide user a acces ce tenant (proxy backend /tenants/me)
 *   2. Set cookie current_tenant_id
 *   3. Retourne 200
 */
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { setTenantIdCookie } from '@/lib/auth/cookies';
import { decodeJwtUnsafe, isJwtExpired } from '@/lib/jwt';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  tenant_id: z.string().uuid(),
});

interface BackendTenantMembership {
  id: string;
  name: string;
}

interface BackendTenantsMeResponse {
  memberships: BackendTenantMembership[];
}

export async function POST(request: Request): Promise<NextResponse> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token')?.value;

  if (!accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const payload = decodeJwtUnsafe(accessToken);
  if (!payload || isJwtExpired(payload)) {
    return NextResponse.json({ error: 'Token expired' }, { status: 401 });
  }

  let parsed: z.infer<typeof BodySchema>;
  try {
    const body = await request.json();
    parsed = BodySchema.parse(body);
  } catch (err) {
    logger.warn(
      { component: 'api.auth.switch-tenant', err: (err as Error).message },
      'invalid_body'
    );
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

  try {
    const response = await fetch(`${apiUrl}/api/v1/tenants/me`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      logger.warn(
        { component: 'api.auth.switch-tenant', status: response.status },
        'tenants_me_failed'
      );
      return NextResponse.json({ error: 'Cannot verify tenant access' }, { status: 502 });
    }
    const data: BackendTenantsMeResponse = await response.json();
    const allowed = data.memberships.some((m) => m.id === parsed.tenant_id);
    if (!allowed) {
      logger.warn(
        { component: 'api.auth.switch-tenant', userId: payload.sub, tenantId: parsed.tenant_id },
        'tenant_access_denied'
      );
      return NextResponse.json({ error: 'Access denied to this tenant' }, { status: 403 });
    }

    await setTenantIdCookie(parsed.tenant_id);
    logger.info(
      { component: 'api.auth.switch-tenant', userId: payload.sub, tenantId: parsed.tenant_id },
      'tenant_switched'
    );

    return NextResponse.json({ success: true, tenant_id: parsed.tenant_id }, { status: 200 });
  } catch (err) {
    logger.error(
      { component: 'api.auth.switch-tenant', err: (err as Error).message },
      'switch_tenant_unexpected_error'
    );
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

### 6.23 `repo/apps/web-broker/src/app/api/health/route.ts` (~25 lignes)

```typescript
/**
 * Health check public endpoint
 * Reference : 00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md (Tache 4.3.1)
 *
 * GET /api/health
 * Public (pas d'auth requise) -- utilise par CI smoke + monitoring Atlas Cloud.
 */
import { NextResponse } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    {
      status: 'ok',
      app: 'web-broker',
      version: process.env.NEXT_PUBLIC_APP_VERSION ?? 'dev',
      env: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
    },
    { status: 200 }
  );
}
```

### 6.24 `repo/apps/web-broker/src/messages/fr.json` (extrait pertinent ajoute, ~120 lignes total)

```json
{
  "meta": {
    "title": {
      "default": "Skalean Broker -- Espace courtier",
      "brand": "Skalean Broker"
    },
    "description": "Plateforme de gestion courtage en assurance Skalean InsurTech : contacts, polices, sinistres, commissions."
  },
  "home": {
    "title": "Bienvenue sur Skalean Broker",
    "palette": {
      "primary": "Orange Sofidemy",
      "secondary": "Navy Sofidemy",
      "accent": "Sky Blue",
      "acaps": "ACAPS Teal"
    },
    "placeholder": {
      "banner": "Cette page sera remplacee par le tableau de bord courtier dans le Sprint 17."
    }
  },
  "common": {
    "loading": "Chargement",
    "error": "Une erreur est survenue",
    "save": "Enregistrer",
    "cancel": "Annuler",
    "confirm": "Confirmer",
    "close": "Fermer",
    "back": "Retour",
    "next": "Suivant",
    "previous": "Precedent",
    "search": "Rechercher",
    "filter": "Filtrer",
    "sort": "Trier",
    "refresh": "Rafraichir",
    "export": "Exporter"
  },
  "nav": {
    "dashboard": "Tableau de bord",
    "contacts": "Contacts",
    "companies": "Entreprises",
    "deals": "Affaires",
    "policies": "Polices",
    "claims": "Sinistres",
    "broker_queue": "File de validation",
    "settings": "Parametres",
    "profile": "Profil"
  },
  "auth": {
    "login": "Connexion",
    "logout": "Deconnexion",
    "signin": "Se connecter",
    "signup": "Creer un compte",
    "forgotPassword": "Mot de passe oublie",
    "resetPassword": "Reinitialiser le mot de passe",
    "verifyEmail": "Verifier l'email",
    "verifyMfa": "Verifier le code MFA",
    "selectTenant": "Selectionner le cabinet",
    "aria": {
      "back_home": "Retour a l'accueil"
    },
    "footer": {
      "copyright": "Copyright {year} Skalean InsurTech. Tous droits reserves.",
      "privacy": "Politique de confidentialite",
      "cookies": "Cookies",
      "cndp_notice": "Notice CNDP"
    }
  },
  "tenant": {
    "switcher": {
      "label": "Cabinet courtier",
      "placeholder": "Choisir un cabinet"
    },
    "required": "Selection d'un cabinet requise",
    "access_denied": "Acces refuse a ce cabinet"
  },
  "errors": {
    "network": "Connexion reseau impossible",
    "unauthorized": "Authentification requise",
    "forbidden": "Acces refuse",
    "notFound": "Ressource introuvable",
    "serverError": "Erreur serveur",
    "validation": "Donnees invalides",
    "session_expired": "Votre session a expire. Veuillez vous reconnecter.",
    "refresh_failed": "Impossible de prolonger la session",
    "tenant_required": "Veuillez selectionner un cabinet courtier pour continuer"
  },
  "middleware": {
    "redirect_login": "Redirection vers la page de connexion",
    "redirect_select_tenant": "Redirection vers la selection du cabinet"
  },
  "protected": {
    "aria": {
      "sidebar_placeholder": "Barre laterale (placeholder Sprint 16 tache 4.3.3)",
      "topbar_placeholder": "Barre superieure (placeholder Sprint 16 tache 4.3.3)"
    },
    "placeholder": {
      "sidebar_note": "Navigation principale livree dans le Sprint 16 tache 4.3.3.",
      "topbar_note": "Barre superieure (recherche, notifications, profil) livree dans le Sprint 16 tache 4.3.3."
    }
  }
}
```

### 6.25 `repo/apps/web-broker/src/messages/ar-MA.json` (extrait Darija, ~120 lignes)

```json
{
  "meta": {
    "title": {
      "default": "Skalean Broker -- فضاء السمسار",
      "brand": "Skalean Broker"
    },
    "description": "منصة Skalean InsurTech ديال السماسرة ديال التامين : العملاء، العقود، الحوادث، العمولات."
  },
  "home": {
    "title": "مرحبا بيك فـ Skalean Broker",
    "palette": {
      "primary": "البرتقالي ديال Sofidemy",
      "secondary": "الكحل ديال Sofidemy",
      "accent": "السماوي",
      "acaps": "أخضر ACAPS"
    },
    "placeholder": {
      "banner": "هاد الصفحة غادي تتبدل بـ Dashboard ديال السمسار فـ Sprint 17."
    }
  },
  "common": {
    "loading": "جاري التحميل",
    "error": "وقع شي مشكل",
    "save": "حفظ",
    "cancel": "إلغاء",
    "confirm": "تأكيد",
    "close": "إغلاق",
    "back": "رجوع",
    "next": "التالي",
    "previous": "السابق",
    "search": "بحث",
    "filter": "تصفية",
    "sort": "ترتيب",
    "refresh": "تحديث",
    "export": "تصدير"
  },
  "nav": {
    "dashboard": "لوحة القيادة",
    "contacts": "العملاء",
    "companies": "الشركات",
    "deals": "الصفقات",
    "policies": "العقود",
    "claims": "الحوادث",
    "broker_queue": "لائحة الانتظار",
    "settings": "الإعدادات",
    "profile": "الملف الشخصي"
  },
  "auth": {
    "login": "دخول",
    "logout": "خروج",
    "signin": "تسجيل الدخول",
    "signup": "إنشاء حساب",
    "forgotPassword": "نسيت كلمة السر",
    "resetPassword": "إعادة تعيين كلمة السر",
    "verifyEmail": "تأكيد البريد الإلكتروني",
    "verifyMfa": "تأكيد رمز MFA",
    "selectTenant": "اختار المكتب",
    "aria": {
      "back_home": "الرجوع للرئيسية"
    },
    "footer": {
      "copyright": "حقوق {year} Skalean InsurTech محفوظة.",
      "privacy": "سياسة الخصوصية",
      "cookies": "الكوكيز",
      "cndp_notice": "إشعار CNDP"
    }
  },
  "tenant": {
    "switcher": {
      "label": "مكتب السمسرة",
      "placeholder": "اختار مكتب"
    },
    "required": "خاصك تختار مكتب باش تكمل",
    "access_denied": "ما عندكش الإذن لهاد المكتب"
  },
  "errors": {
    "network": "كاينة مشكلة فـ الشبكة",
    "unauthorized": "خاصك تسجل الدخول",
    "forbidden": "ما عندكش الإذن",
    "notFound": "ما لقيناش هاد الحاجة",
    "serverError": "مشكل فـ السيرفر",
    "validation": "المعطيات غالط",
    "session_expired": "الجلسة ديالك سالات. عاود سجل الدخول.",
    "refresh_failed": "ما قدرناش نمددو الجلسة",
    "tenant_required": "خاصك تختار مكتب السمسرة باش تكمل"
  },
  "middleware": {
    "redirect_login": "نوجهوك لصفحة الدخول",
    "redirect_select_tenant": "نوجهوك لاختيار المكتب"
  },
  "protected": {
    "aria": {
      "sidebar_placeholder": "الشريط الجانبي (مؤقت Sprint 16 4.3.3)",
      "topbar_placeholder": "الشريط العلوي (مؤقت Sprint 16 4.3.3)"
    },
    "placeholder": {
      "sidebar_note": "التنقل غادي يجي فـ Sprint 16 4.3.3.",
      "topbar_note": "الشريط العلوي غادي يجي فـ Sprint 16 4.3.3."
    }
  }
}
```

### 6.26 `repo/apps/web-broker/src/messages/ar.json` (extrait arabe classique, ~120 lignes)

```json
{
  "meta": {
    "title": {
      "default": "سكاليان للوسطاء -- فضاء الوسيط",
      "brand": "سكاليان للوسطاء"
    },
    "description": "منصة سكاليان لإدارة الوساطة في التأمين : جهات الاتصال، العقود، المطالبات، العمولات."
  },
  "home": {
    "title": "مرحباً بكم في منصة سكاليان للوسطاء",
    "palette": {
      "primary": "البرتقالي المؤسسي",
      "secondary": "الأزرق الداكن",
      "accent": "الأزرق السماوي",
      "acaps": "أخضر هيئة المراقبة"
    },
    "placeholder": {
      "banner": "ستُستبدل هذه الصفحة بلوحة قيادة الوسيط في النسخة 17."
    }
  },
  "common": {
    "loading": "جارٍ التحميل",
    "error": "حدث خطأ",
    "save": "حفظ",
    "cancel": "إلغاء",
    "confirm": "تأكيد",
    "close": "إغلاق",
    "back": "رجوع",
    "next": "التالي",
    "previous": "السابق",
    "search": "بحث",
    "filter": "تصفية",
    "sort": "ترتيب",
    "refresh": "تحديث",
    "export": "تصدير"
  },
  "nav": {
    "dashboard": "لوحة القيادة",
    "contacts": "جهات الاتصال",
    "companies": "الشركات",
    "deals": "الصفقات",
    "policies": "العقود",
    "claims": "المطالبات",
    "broker_queue": "قائمة الانتظار",
    "settings": "الإعدادات",
    "profile": "الملف الشخصي"
  },
  "auth": {
    "login": "تسجيل الدخول",
    "logout": "تسجيل الخروج",
    "signin": "الدخول",
    "signup": "إنشاء حساب",
    "forgotPassword": "نسيت كلمة المرور",
    "resetPassword": "إعادة تعيين كلمة المرور",
    "verifyEmail": "التحقق من البريد الإلكتروني",
    "verifyMfa": "التحقق من رمز MFA",
    "selectTenant": "اختيار الوكالة",
    "aria": {
      "back_home": "العودة إلى الصفحة الرئيسية"
    },
    "footer": {
      "copyright": "حقوق {year} سكاليان للتقنية التأمينية محفوظة.",
      "privacy": "سياسة الخصوصية",
      "cookies": "ملفات تعريف الارتباط",
      "cndp_notice": "إشعار CNDP"
    }
  },
  "tenant": {
    "switcher": {
      "label": "وكالة الوساطة",
      "placeholder": "اختر وكالة"
    },
    "required": "يلزم اختيار وكالة للمتابعة",
    "access_denied": "تم رفض الوصول إلى هذه الوكالة"
  },
  "errors": {
    "network": "تعذّر الاتصال بالشبكة",
    "unauthorized": "يلزم التسجيل",
    "forbidden": "الوصول مرفوض",
    "notFound": "العنصر غير موجود",
    "serverError": "خطأ في الخادم",
    "validation": "بيانات غير صالحة",
    "session_expired": "انتهت صلاحية الجلسة. يرجى تسجيل الدخول من جديد.",
    "refresh_failed": "تعذّر تمديد الجلسة",
    "tenant_required": "يرجى اختيار وكالة وساطة للمتابعة"
  },
  "middleware": {
    "redirect_login": "إعادة توجيه إلى صفحة الدخول",
    "redirect_select_tenant": "إعادة توجيه لاختيار الوكالة"
  },
  "protected": {
    "aria": {
      "sidebar_placeholder": "الشريط الجانبي (مؤقت Sprint 16 المهمة 4.3.3)",
      "topbar_placeholder": "الشريط العلوي (مؤقت Sprint 16 المهمة 4.3.3)"
    },
    "placeholder": {
      "sidebar_note": "ستتم إضافة التنقل في النسخة Sprint 16 المهمة 4.3.3.",
      "topbar_note": "سيتم تسليم الشريط العلوي في النسخة Sprint 16 المهمة 4.3.3."
    }
  }
}
```

### 6.27 `repo/apps/web-broker/src/types/session.d.ts` (~60 lignes)

```typescript
/**
 * Session + RBAC types -- web-broker
 * Reference : 00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md (Tache 4.3.1)
 */

export type BrokerRole = 'broker_admin' | 'broker_user' | 'broker_assistant';
export type SuperRole = 'super_admin' | 'tenant_admin';
export type GarageRole = 'garage_admin' | 'garage_operator';
export type AssureRole = 'customer' | 'assure';
export type AnyRole = BrokerRole | SuperRole | GarageRole | AssureRole;

export interface UserSession {
  userId: string;
  email: string | null;
  displayName: string | null;
  role: string; // AnyRole, but server may carry new roles
  permissions: string[];
  tenantId: string | null;
  preferredLocale: string | null;
  mfaEnabled: boolean;
  accessToken: string;
  expiresAt: string; // ISO 8601
}

export interface TenantSummary {
  id: string;
  name: string;
  type: 'broker' | 'garage' | 'insurer' | 'platform';
  brandPrimaryColor?: string;
  brandSecondaryColor?: string;
  defaultLocale: string;
  currency: 'MAD';
  timezone: 'Africa/Casablanca';
}

export interface TenantMembership {
  tenant: TenantSummary;
  role: string;
  permissions: string[];
  joinedAt: string;
}
```

### 6.28 `repo/apps/web-broker/src/types/api.d.ts` (~55 lignes)

```typescript
/**
 * API typed error responses -- web-broker
 * Reference : 00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md (Tache 4.3.1)
 */

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: Record<string, unknown> | unknown[];
  traceId?: string;
}

export interface ApiError extends Error {
  name: 'ApiError';
  code: string;
  message: string;
  status: number;
  details?: Record<string, unknown> | unknown[];
  traceId: string | null;
}

export interface ApiPaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
  };
}

export interface ApiSuccessResponse<T> {
  data: T;
  meta?: {
    traceId?: string;
    timestamp?: string;
  };
}

export type ApiResult<T> = ApiSuccessResponse<T> | ApiErrorBody;
```

### 6.29 `repo/apps/web-broker/src/lib/query-client.ts` (~75 lignes)

```typescript
/**
 * QueryClient singleton -- isomorphic factory
 * Reference : 00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md (Tache 4.3.1)
 *
 * - Cote server : nouvelle instance par requete (eviter cross-request leak)
 * - Cote client : singleton (preserve cache across renders)
 */
import { QueryClient, isServer } from '@tanstack/react-query';
import * as Sentry from '@sentry/nextjs';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5min
        gcTime: 10 * 60 * 1000, // 10min
        retry: (failureCount, error: any) => {
          const status = error?.status ?? 0;
          if (status === 401 || status === 403 || status === 404 || status === 422) return false;
          return failureCount < 3;
        },
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        refetchOnWindowFocus: process.env.NODE_ENV === 'production',
      },
      mutations: {
        onError: (error: any) => {
          Sentry.captureException(error, { tags: { component: 'query-mutation' } });
          logger.error(
            { component: 'query-client', err: error?.message, status: error?.status },
            'mutation_error'
          );
          const status = error?.status ?? 0;
          if (status === 401) return; // login redirect handled by api-client
          if (status >= 500) toast.error('Erreur serveur. Veuillez reessayer.');
          else if (status === 403) toast.error('Acces refuse.');
          else toast.error(error?.message ?? 'Une erreur est survenue');
        },
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

export function getQueryClient(): QueryClient {
  if (isServer) {
    return makeQueryClient();
  }
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}
```

### 6.30 `repo/apps/web-broker/.env.example` (~45 lignes)

```bash
# Skalean InsurTech -- web-broker environment variables
# Reference : 00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md (Tache 4.3.1)
# decision-006 : NO EMOJI
# decision-008 : Atlas Cloud Benguerir (jamais AWS)

# ---- API backend ----
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_APP_URL=http://localhost:3001
NEXT_PUBLIC_APP_NAME=skalean-broker
NEXT_PUBLIC_APP_VERSION=0.1.0

# ---- i18n ----
NEXT_PUBLIC_DEFAULT_LOCALE=fr
NEXT_PUBLIC_SUPPORTED_LOCALES=fr,ar-MA,ar

# ---- Multi-tenant headers ----
NEXT_PUBLIC_TENANT_ID_HEADER=x-tenant-id
NEXT_PUBLIC_TRACE_ID_HEADER=x-trace-id
NEXT_PUBLIC_IDEMPOTENCY_HEADER=Idempotency-Key

# ---- Auth ----
NEXT_PUBLIC_AUTH_REFRESH_PATH=/api/auth/refresh
NEXT_PUBLIC_AUTH_LOGIN_PATH=/login
NEXT_PUBLIC_AUTH_LOGOUT_PATH=/api/auth/signout
NEXT_PUBLIC_SESSION_TTL_SEC=900
NEXT_PUBLIC_REFRESH_TTL_SEC=2592000

# ---- Sentry (CLIENT-SAFE DSN public) ----
NEXT_PUBLIC_SENTRY_DSN=

# ---- Maps (CLIENT-SAFE token restraint par domaine) ----
NEXT_PUBLIC_MAPBOX_TOKEN=

# ---- Feature flags + CDN ----
NEXT_PUBLIC_FEATURE_FLAGS_URL=
NEXT_PUBLIC_CDN_URL=

# ---- Skalean AI Gateway (Sprint 13+ reserve) ----
NEXT_PUBLIC_AI_GATEWAY_URL=

# ---- Dev tooling ----
NEXT_PUBLIC_DEBUG=false
NEXT_PUBLIC_LIGHTHOUSE_PROFILE=mobile
NEXT_PUBLIC_PWA_ENABLED=false

# ---- GTM (CLIENT-SAFE) ----
NEXT_PUBLIC_GTM_ID=

# ---- Atlas Cloud (PRIVATE -- production secret manager ne dois jamais commit) ----
# ATLAS_CLOUD_REGION=bgr
# ATLAS_CLOUD_STORAGE_BUCKET=skalean-prod-broker
```

---

## 7. Tests complets (15-30 ko)

### 7.1 Vitest -- `src/lib/__tests__/jwt.spec.ts` (8 tests, ~180 lignes)

```typescript
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { SignJWT } from 'jose';
import {
  decodeJwtUnsafe,
  isJwtExpired,
  getJwtExpiryDate,
  getJwtRemainingSeconds,
  jwtHasPermission,
  jwtHasRole,
  type SkaleanJwtPayload,
} from '@/lib/jwt';

const SECRET = new TextEncoder().encode('test-secret-32-bytes-minimum-length-ok');

async function makeToken(payload: Partial<SkaleanJwtPayload>, ttlSeconds = 900): Promise<string> {
  const nowSec = Math.floor(Date.now() / 1000);
  const full: SkaleanJwtPayload = {
    sub: 'user-123',
    role: 'broker_admin',
    permissions: ['crm.contacts.read', 'crm.contacts.write'],
    tenant_id: 'tenant-abc',
    exp: nowSec + ttlSeconds,
    iat: nowSec,
    ...payload,
  };
  return new SignJWT(full as any)
    .setProtectedHeader({ alg: 'HS256' })
    .sign(SECRET);
}

describe('jwt helpers', () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-15T10:00:00Z'));
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it('decodeJwtUnsafe returns payload for valid token', async () => {
    const token = await makeToken({});
    const decoded = decodeJwtUnsafe(token);
    expect(decoded).not.toBeNull();
    expect(decoded?.sub).toBe('user-123');
    expect(decoded?.role).toBe('broker_admin');
  });

  it('decodeJwtUnsafe returns null for malformed token', () => {
    expect(decodeJwtUnsafe('not.a.valid.jwt')).toBeNull();
    expect(decodeJwtUnsafe('')).toBeNull();
    expect(decodeJwtUnsafe(null)).toBeNull();
    expect(decodeJwtUnsafe(undefined)).toBeNull();
  });

  it('isJwtExpired returns true for expired token', async () => {
    const token = await makeToken({}, -100); // 100s in past
    const decoded = decodeJwtUnsafe(token);
    expect(isJwtExpired(decoded)).toBe(true);
  });

  it('isJwtExpired returns false for valid token', async () => {
    const token = await makeToken({}, 900);
    const decoded = decodeJwtUnsafe(token);
    expect(isJwtExpired(decoded)).toBe(false);
  });

  it('isJwtExpired applies margin', async () => {
    const token = await makeToken({}, 15); // 15s remaining, margin 30s default
    const decoded = decodeJwtUnsafe(token);
    expect(isJwtExpired(decoded, 30)).toBe(true);
    expect(isJwtExpired(decoded, 5)).toBe(false);
  });

  it('getJwtExpiryDate returns correct Date', async () => {
    const token = await makeToken({}, 900);
    const decoded = decodeJwtUnsafe(token);
    const expiry = getJwtExpiryDate(decoded!);
    expect(expiry.getTime()).toBeGreaterThan(Date.now());
  });

  it('jwtHasPermission detects permissions correctly', async () => {
    const token = await makeToken({
      permissions: ['crm.contacts.read', 'crm.deals.write'],
    });
    const decoded = decodeJwtUnsafe(token);
    expect(jwtHasPermission(decoded, 'crm.contacts.read')).toBe(true);
    expect(jwtHasPermission(decoded, 'crm.contacts.delete')).toBe(false);
    expect(jwtHasPermission(null, 'crm.contacts.read')).toBe(false);
  });

  it('jwtHasRole supports single + array roles', async () => {
    const token = await makeToken({ role: 'broker_user' });
    const decoded = decodeJwtUnsafe(token);
    expect(jwtHasRole(decoded, 'broker_user')).toBe(true);
    expect(jwtHasRole(decoded, ['broker_admin', 'broker_user'])).toBe(true);
    expect(jwtHasRole(decoded, 'broker_admin')).toBe(false);
    expect(jwtHasRole(null, 'broker_admin')).toBe(false);
  });
});
```

### 7.2 Vitest -- `src/lib/__tests__/api-client.spec.ts` (15 tests, ~350 lignes -- extrait pertinent)

```typescript
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import { createApiClient, apiGet, apiPost } from '@/lib/api-client';
import { useTenantStore } from '@/store/tenant-store';
import { useSessionStore } from '@/store/session-store';

describe('api-client interceptors', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    useTenantStore.setState({ tenantId: 'tenant-test-1', tenantName: 'Test Tenant', hasHydrated: true });
    useSessionStore.setState({
      session: {
        userId: 'user-1',
        email: 'test@example.ma',
        displayName: 'Test User',
        role: 'broker_admin',
        permissions: [],
        tenantId: 'tenant-test-1',
        preferredLocale: 'fr',
        mfaEnabled: false,
        accessToken: 'fake-jwt',
        expiresAt: new Date(Date.now() + 900_000).toISOString(),
      },
    });
    Object.defineProperty(document.documentElement, 'lang', { value: 'fr', configurable: true });
  });

  it('injects x-tenant-id from zustand store', async () => {
    const client = createApiClient();
    mock = new MockAdapter(client);
    mock.onGet('/api/v1/test').reply((config) => {
      expect(config.headers!['x-tenant-id']).toBe('tenant-test-1');
      return [200, { ok: true }];
    });
    await client.get('/api/v1/test');
    expect(mock.history.get).toHaveLength(1);
  });

  it('injects x-trace-id UUID v4 format', async () => {
    const client = createApiClient();
    mock = new MockAdapter(client);
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    mock.onGet('/api/v1/test').reply((config) => {
      expect(config.headers!['x-trace-id']).toMatch(uuidRegex);
      return [200, {}];
    });
    await client.get('/api/v1/test');
  });

  it('injects Authorization Bearer from session store', async () => {
    const client = createApiClient();
    mock = new MockAdapter(client);
    mock.onGet('/api/v1/test').reply((config) => {
      expect(config.headers!.Authorization).toBe('Bearer fake-jwt');
      return [200, {}];
    });
    await client.get('/api/v1/test');
  });

  it('injects Idempotency-Key on POST but NOT on GET', async () => {
    const client = createApiClient();
    mock = new MockAdapter(client);
    mock.onPost('/api/v1/test').reply((config) => {
      expect(config.headers!['Idempotency-Key']).toBeDefined();
      return [201, {}];
    });
    mock.onGet('/api/v1/test').reply((config) => {
      expect(config.headers!['Idempotency-Key']).toBeUndefined();
      return [200, {}];
    });
    await client.post('/api/v1/test', { x: 1 });
    await client.get('/api/v1/test');
  });

  it('injects Idempotency-Key on PUT/PATCH/DELETE', async () => {
    const client = createApiClient();
    mock = new MockAdapter(client);
    const seenKeys = new Set<string>();
    mock.onAny('/api/v1/test').reply((config) => {
      const key = config.headers!['Idempotency-Key'];
      if (key && config.method !== 'get') seenKeys.add(String(key));
      return [200, {}];
    });
    await client.put('/api/v1/test', {});
    await client.patch('/api/v1/test', {});
    await client.delete('/api/v1/test');
    expect(seenKeys.size).toBe(3);
  });

  it('injects Accept-Language from document lang', async () => {
    Object.defineProperty(document.documentElement, 'lang', { value: 'ar-MA', configurable: true });
    const client = createApiClient();
    mock = new MockAdapter(client);
    mock.onGet('/api/v1/test').reply((config) => {
      expect(config.headers!['Accept-Language']).toBe('ar-MA');
      return [200, {}];
    });
    await client.get('/api/v1/test');
  });

  it('handles 401 -> attempts refresh + retry', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, expires_in: 900 }),
    } as Response) as Mock;
    const client = createApiClient();
    mock = new MockAdapter(client);
    mock.onGet('/api/v1/protected').replyOnce(401, { code: 'UNAUTHORIZED' });
    mock.onGet('/api/v1/protected').replyOnce(200, { ok: true });
    const result = await client.get('/api/v1/protected');
    expect(result.data.ok).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith('/api/auth/refresh', expect.any(Object));
  });

  it('handles 401 + refresh fail -> redirect login', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ code: 'REFRESH_FAILED' }),
    } as Response) as Mock;
    const locationHref = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { pathname: '/fr/dashboard', search: '', set href(v: string) { locationHref(v); } },
      writable: true,
    });
    const client = createApiClient();
    mock = new MockAdapter(client);
    mock.onGet('/api/v1/protected').reply(401, {});
    await expect(client.get('/api/v1/protected')).rejects.toThrow();
  });

  it('throws ApiError typed on 5xx', async () => {
    const client = createApiClient();
    mock = new MockAdapter(client);
    mock.onGet('/api/v1/test').reply(500, { code: 'INTERNAL', message: 'Server error', traceId: 'trace-xyz' });
    try {
      await client.get('/api/v1/test');
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.name).toBe('ApiError');
      expect(err.status).toBe(500);
      expect(err.code).toBe('INTERNAL');
    }
  });

  it('retries 5xx once before failing', async () => {
    const client = createApiClient();
    mock = new MockAdapter(client);
    let attempts = 0;
    mock.onGet('/api/v1/test').reply(() => {
      attempts += 1;
      if (attempts === 1) return [503, {}];
      return [200, { ok: true }];
    });
    const response = await client.get('/api/v1/test');
    expect(response.data.ok).toBe(true);
    expect(attempts).toBe(2);
  });

  it('does NOT inject tenant-id if missing AND non-auth endpoint warns', async () => {
    useTenantStore.setState({ tenantId: null });
    const warnSpy = vi.fn();
    vi.doMock('@/lib/logger', () => ({ logger: { warn: warnSpy, error: vi.fn(), debug: vi.fn(), info: vi.fn() } }));
    const client = createApiClient();
    mock = new MockAdapter(client);
    mock.onGet('/api/v1/contacts').reply((config) => {
      expect(config.headers!['x-tenant-id']).toBeUndefined();
      return [200, {}];
    });
    await client.get('/api/v1/contacts');
  });

  it('apiGet typed wrapper returns data', async () => {
    const client = createApiClient();
    mock = new MockAdapter(client);
    mock.onGet('/api/v1/contacts').reply(200, { id: '1', name: 'Test' });
    // Use exported singleton -- test simulates with createApiClient pattern
    const result = await client.get('/api/v1/contacts');
    expect(result.data.name).toBe('Test');
  });

  it('apiPost typed wrapper sends body', async () => {
    const client = createApiClient();
    mock = new MockAdapter(client);
    mock.onPost('/api/v1/contacts').reply((config) => {
      const body = JSON.parse(config.data);
      expect(body.name).toBe('New Contact');
      return [201, { id: 'new-1' }];
    });
    const response = await client.post('/api/v1/contacts', { name: 'New Contact' });
    expect(response.data.id).toBe('new-1');
  });

  it('locale override via options passes to Accept-Language', async () => {
    const client = createApiClient({ locale: 'ar' });
    mock = new MockAdapter(client);
    mock.onGet('/api/v1/test').reply((config) => {
      expect(config.headers!['Accept-Language']).toBe('ar');
      return [200, {}];
    });
    await client.get('/api/v1/test');
  });

  it('handles network errors as ApiError', async () => {
    const client = createApiClient();
    mock = new MockAdapter(client);
    mock.onGet('/api/v1/test').networkError();
    await expect(client.get('/api/v1/test')).rejects.toMatchObject({ name: 'ApiError' });
  });
});
```

### 7.3 Vitest -- `src/lib/__tests__/auth/session.spec.ts` (6 tests, ~140 lignes)

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

import { cookies as cookiesMock } from 'next/headers';
import { redirect as redirectMock } from 'next/navigation';
import {
  getSession,
  requireSession,
  getCurrentTenantId,
  requireTenant,
  requireRole,
  requirePermission,
} from '@/lib/auth/session';
import { SignJWT } from 'jose';

async function makeToken(payload: any, ttl = 900): Promise<string> {
  const nowSec = Math.floor(Date.now() / 1000);
  const SECRET = new TextEncoder().encode('test-secret-32-bytes-minimum-length-ok');
  return new SignJWT({ ...payload, exp: nowSec + ttl, iat: nowSec })
    .setProtectedHeader({ alg: 'HS256' })
    .sign(SECRET);
}

function setupCookie(values: Record<string, string | undefined>) {
  (cookiesMock as any).mockResolvedValue({
    get: (name: string) => (values[name] !== undefined ? { value: values[name] } : undefined),
  });
}

describe('auth session helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getSession returns null when no cookie', async () => {
    setupCookie({});
    const session = await getSession();
    expect(session).toBeNull();
  });

  it('getSession returns UserSession when valid token', async () => {
    const token = await makeToken({
      sub: 'user-1',
      role: 'broker_admin',
      permissions: ['crm.contacts.read'],
      tenant_id: 'tenant-1',
      email: 'admin@cabinet.ma',
    });
    setupCookie({ access_token: token, current_tenant_id: 'tenant-1' });
    const session = await getSession();
    expect(session?.userId).toBe('user-1');
    expect(session?.role).toBe('broker_admin');
    expect(session?.tenantId).toBe('tenant-1');
  });

  it('getSession returns null when token expired', async () => {
    const token = await makeToken({ sub: 'user-1', role: 'broker_admin', permissions: [] }, -100);
    setupCookie({ access_token: token });
    const session = await getSession();
    expect(session).toBeNull();
  });

  it('requireSession redirects when no session', async () => {
    setupCookie({});
    await expect(requireSession()).rejects.toThrow('REDIRECT:/fr/login');
    expect(redirectMock).toHaveBeenCalled();
  });

  it('requireRole redirects when role mismatches', async () => {
    const token = await makeToken({
      sub: 'user-1',
      role: 'broker_user',
      permissions: [],
      tenant_id: 'tenant-1',
    });
    setupCookie({ access_token: token, current_tenant_id: 'tenant-1' });
    await expect(requireRole('broker_admin')).rejects.toThrow('REDIRECT:/fr/dashboard?error=forbidden');
  });

  it('requirePermission allows when permission present', async () => {
    const token = await makeToken({
      sub: 'user-1',
      role: 'broker_admin',
      permissions: ['crm.contacts.delete'],
      tenant_id: 'tenant-1',
    });
    setupCookie({ access_token: token, current_tenant_id: 'tenant-1' });
    const session = await requirePermission('crm.contacts.delete');
    expect(session.userId).toBe('user-1');
  });
});
```

### 7.4 Vitest -- `src/lib/__tests__/i18n/config.spec.ts` (5 tests, ~95 lignes)

```typescript
import { describe, it, expect } from 'vitest';
import {
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  RTL_LOCALES,
  getDirection,
  isSupportedLocale,
  LOCALE_LABELS,
  LOCALE_NATIVE_LABELS,
} from '@/lib/i18n/config';

describe('i18n config', () => {
  it('SUPPORTED_LOCALES contains exactly fr, ar-MA, ar', () => {
    expect(SUPPORTED_LOCALES).toEqual(['fr', 'ar-MA', 'ar']);
  });

  it('DEFAULT_LOCALE is fr', () => {
    expect(DEFAULT_LOCALE).toBe('fr');
  });

  it('RTL_LOCALES contains ar and ar-MA', () => {
    expect(RTL_LOCALES.has('ar')).toBe(true);
    expect(RTL_LOCALES.has('ar-MA')).toBe(true);
    expect(RTL_LOCALES.has('fr' as any)).toBe(false);
  });

  it('getDirection returns rtl for ar/ar-MA, ltr for fr/unknown', () => {
    expect(getDirection('ar')).toBe('rtl');
    expect(getDirection('ar-MA')).toBe('rtl');
    expect(getDirection('fr')).toBe('ltr');
    expect(getDirection('en')).toBe('ltr');
    expect(getDirection('de-DE')).toBe('ltr');
  });

  it('isSupportedLocale type guard works', () => {
    expect(isSupportedLocale('fr')).toBe(true);
    expect(isSupportedLocale('ar')).toBe(true);
    expect(isSupportedLocale('ar-MA')).toBe(true);
    expect(isSupportedLocale('en')).toBe(false);
    expect(isSupportedLocale('xx')).toBe(false);
  });

  it('LOCALE_LABELS + LOCALE_NATIVE_LABELS cover all locales without emoji', () => {
    const emojiRegex = /[\u{1F000}-\u{1FFFF}]/u;
    SUPPORTED_LOCALES.forEach((locale) => {
      expect(LOCALE_LABELS[locale]).toBeTruthy();
      expect(LOCALE_NATIVE_LABELS[locale]).toBeTruthy();
      expect(LOCALE_LABELS[locale]).not.toMatch(emojiRegex);
      expect(LOCALE_NATIVE_LABELS[locale]).not.toMatch(emojiRegex);
    });
  });
});
```

### 7.5 Vitest -- `src/__tests__/middleware.spec.ts` (12 tests, ~280 lignes)

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import middleware from '../../middleware';

async function makeJwt(payload: any, ttlSec = 900): Promise<string> {
  const SECRET = new TextEncoder().encode('test-secret-32-bytes-minimum-length-ok');
  const nowSec = Math.floor(Date.now() / 1000);
  return new SignJWT({ ...payload, exp: nowSec + ttlSec, iat: nowSec })
    .setProtectedHeader({ alg: 'HS256' })
    .sign(SECRET);
}

function buildRequest(
  pathname: string,
  cookies: Record<string, string> = {},
  headers: Record<string, string> = {}
): NextRequest {
  const url = new URL(`http://localhost:3001${pathname}`);
  const req = new NextRequest(url, {
    headers: new Headers(headers),
  });
  Object.entries(cookies).forEach(([k, v]) => {
    req.cookies.set(k, v);
  });
  return req;
}

describe('middleware compose', () => {
  it('redirects / to /fr (default locale)', async () => {
    const req = buildRequest('/');
    const res = await middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/fr');
  });

  it('redirects /dashboard (no auth) to /fr/login', async () => {
    const req = buildRequest('/dashboard');
    const res = await middleware(req);
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.headers.get('location')).toMatch(/\/fr\/login/);
  });

  it('redirects /fr/dashboard (no auth cookie) to /fr/login with redirect param', async () => {
    const req = buildRequest('/fr/dashboard');
    const res = await middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/fr/login');
    expect(res.headers.get('location')).toContain('redirect=');
  });

  it('redirects /fr/dashboard (expired token) to /fr/login + clears cookie', async () => {
    const expired = await makeJwt({ sub: 'u', role: 'broker_admin', permissions: [] }, -100);
    const req = buildRequest('/fr/dashboard', { access_token: expired });
    const res = await middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/fr/login');
  });

  it('redirects /fr/dashboard (valid token but no tenant) to /fr/select-tenant', async () => {
    const token = await makeJwt({ sub: 'u', role: 'broker_admin', permissions: [], tenant_id: null });
    const req = buildRequest('/fr/dashboard', { access_token: token });
    const res = await middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/fr/select-tenant');
  });

  it('allows /fr/dashboard with valid token + tenant cookie + injects x-tenant-id', async () => {
    const token = await makeJwt({ sub: 'u', role: 'broker_admin', permissions: [], tenant_id: 'tenant-1' });
    const req = buildRequest('/fr/dashboard', { access_token: token, current_tenant_id: 'tenant-1' });
    const res = await middleware(req);
    expect(res.status).toBeLessThan(300);
    expect(res.headers.get('x-tenant-id')).toBe('tenant-1');
  });

  it('redirects authenticated user from /fr/login to /fr/dashboard', async () => {
    const token = await makeJwt({ sub: 'u', role: 'broker_admin', permissions: [] });
    const req = buildRequest('/fr/login', { access_token: token, current_tenant_id: 'tenant-1' });
    const res = await middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/fr/dashboard');
  });

  it('allows unauthenticated access to /fr/login', async () => {
    const req = buildRequest('/fr/login');
    const res = await middleware(req);
    expect(res.status).toBeLessThan(300);
  });

  it('allows /fr/select-tenant for authenticated user without tenant', async () => {
    const token = await makeJwt({ sub: 'u', role: 'broker_admin', permissions: [] });
    const req = buildRequest('/fr/select-tenant', { access_token: token });
    const res = await middleware(req);
    expect(res.status).toBeLessThan(300);
  });

  it('detects locale from Accept-Language header (ar -> /ar)', async () => {
    const req = buildRequest('/', {}, { 'accept-language': 'ar-MA,ar;q=0.9,fr;q=0.5' });
    const res = await middleware(req);
    expect(res.headers.get('location')).toMatch(/\/(ar|ar-MA)/);
  });

  it('persists NEXT_LOCALE cookie priority over Accept-Language', async () => {
    const req = buildRequest('/', { NEXT_LOCALE: 'ar' }, { 'accept-language': 'fr' });
    const res = await middleware(req);
    expect(res.headers.get('location')).toContain('/ar');
  });

  it('handles malformed cookie access_token gracefully', async () => {
    const req = buildRequest('/fr/dashboard', { access_token: 'not.a.valid.jwt' });
    const res = await middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/fr/login');
  });
});
```

### 7.6 Playwright -- `e2e/01-boot.spec.ts` (4 tests, ~95 lignes)

```typescript
import { test, expect } from '@playwright/test';

test.describe('web-broker boot', () => {
  test('health endpoint responds 200', async ({ request }) => {
    const response = await request.get('http://localhost:3001/api/health');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(body.app).toBe('web-broker');
  });

  test('root redirects to /fr', async ({ page }) => {
    const response = await page.goto('http://localhost:3001/');
    expect(response?.url()).toContain('/fr');
  });

  test('/fr renders with lang=fr dir=ltr', async ({ page }) => {
    await page.goto('http://localhost:3001/fr');
    const html = page.locator('html');
    await expect(html).toHaveAttribute('lang', 'fr');
    await expect(html).toHaveAttribute('dir', 'ltr');
  });

  test('/ar renders with lang=ar dir=rtl', async ({ page }) => {
    await page.goto('http://localhost:3001/ar');
    const html = page.locator('html');
    await expect(html).toHaveAttribute('lang', 'ar');
    await expect(html).toHaveAttribute('dir', 'rtl');
  });

  test('/ar-MA renders with lang=ar-MA dir=rtl', async ({ page }) => {
    await page.goto('http://localhost:3001/ar-MA');
    const html = page.locator('html');
    await expect(html).toHaveAttribute('lang', 'ar-MA');
    await expect(html).toHaveAttribute('dir', 'rtl');
  });
});
```

### 7.7 Playwright -- `e2e/02-middleware-auth.spec.ts` (6 tests, ~165 lignes)

```typescript
import { test, expect } from '@playwright/test';

test.describe('middleware auth guard', () => {
  test('protected route without cookie redirects to login', async ({ page }) => {
    const response = await page.goto('http://localhost:3001/fr/dashboard', { waitUntil: 'commit' });
    expect(response?.url()).toContain('/fr/login');
    expect(response?.url()).toContain('redirect=');
  });

  test('login page does not redirect for unauthenticated', async ({ page }) => {
    await page.goto('http://localhost:3001/fr/login');
    expect(page.url()).toContain('/fr/login');
  });

  test('signup page is reachable', async ({ page }) => {
    // Sprint 16 tache 4.3.2 ajoute la page reelle ; pour cette tache 4.3.1
    // (auth)/layout.tsx accepte tout enfant -> placeholder fait que la route existe
    await page.goto('http://localhost:3001/fr/signup');
    expect(page.url()).toContain('/fr/signup');
  });

  test('contacts route protected', async ({ page }) => {
    const response = await page.goto('http://localhost:3001/fr/contacts');
    expect(response?.url()).toContain('/fr/login');
  });

  test('select-tenant accessible to authenticated user without tenant', async ({ page, context }) => {
    // Inject fake valid JWT cookie (test fixture)
    const nowSec = Math.floor(Date.now() / 1000);
    // Note : real signature unnecessary as middleware uses decodeJwt unsafe.
    // Use a malformed-but-decodable JWT (header.payload.) for the test
    const payload = Buffer.from(
      JSON.stringify({
        sub: 'user-test',
        role: 'broker_admin',
        permissions: [],
        exp: nowSec + 900,
        iat: nowSec,
      })
    )
      .toString('base64url')
      .replace(/=+$/, '');
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' }))
      .toString('base64url')
      .replace(/=+$/, '');
    const token = `${header}.${payload}.`;
    await context.addCookies([
      {
        name: 'access_token',
        value: token,
        domain: 'localhost',
        path: '/',
        httpOnly: false, // test only
      },
    ]);
    await page.goto('http://localhost:3001/fr/select-tenant');
    expect(page.url()).toContain('/fr/select-tenant');
  });

  test('authenticated user on /login redirects to /dashboard', async ({ page, context }) => {
    const nowSec = Math.floor(Date.now() / 1000);
    const payload = Buffer.from(
      JSON.stringify({
        sub: 'user-test',
        role: 'broker_admin',
        permissions: [],
        tenant_id: 'tenant-1',
        exp: nowSec + 900,
        iat: nowSec,
      })
    )
      .toString('base64url')
      .replace(/=+$/, '');
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' }))
      .toString('base64url')
      .replace(/=+$/, '');
    const token = `${header}.${payload}.`;
    await context.addCookies([
      { name: 'access_token', value: token, domain: 'localhost', path: '/' },
      { name: 'current_tenant_id', value: 'tenant-1', domain: 'localhost', path: '/' },
    ]);
    const response = await page.goto('http://localhost:3001/fr/login');
    expect(response?.url()).toContain('/fr/dashboard');
  });
});
```

### 7.8 Playwright -- `e2e/03-tenant-cookie.spec.ts` (4 tests, ~120 lignes)

```typescript
import { test, expect } from '@playwright/test';

test.describe('tenant cookie + locale persist', () => {
  test('NEXT_LOCALE cookie persists locale across navigation', async ({ page, context }) => {
    await page.goto('http://localhost:3001/ar');
    const cookies = await context.cookies();
    const localeCookie = cookies.find((c) => c.name === 'NEXT_LOCALE');
    expect(localeCookie?.value).toBe('ar');
  });

  test('switching locale via URL persists in cookie', async ({ page, context }) => {
    await page.goto('http://localhost:3001/fr');
    await page.goto('http://localhost:3001/ar-MA');
    const cookies = await context.cookies();
    const localeCookie = cookies.find((c) => c.name === 'NEXT_LOCALE');
    expect(localeCookie?.value).toBe('ar-MA');
  });

  test('current_tenant_id cookie readable by client JS (not httpOnly)', async ({ context, page }) => {
    await context.addCookies([
      {
        name: 'current_tenant_id',
        value: 'tenant-abc-123',
        domain: 'localhost',
        path: '/',
        httpOnly: false,
      },
    ]);
    await page.goto('http://localhost:3001/fr');
    const value = await page.evaluate(() => document.cookie);
    expect(value).toContain('current_tenant_id=tenant-abc-123');
  });

  test('health endpoint not affected by middleware', async ({ request }) => {
    const response = await request.get('http://localhost:3001/api/health');
    expect(response.status()).toBe(200);
    // No x-tenant-id required for public health
    expect(response.headers()['x-tenant-id']).toBeUndefined();
  });
});
```

---

## 8. Variables environnement

| Variable | Default | Required | Securite | Description |
|----------|---------|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` | OUI | CLIENT-SAFE | URL backend NestJS Sprint 3 -- prod `https://api.skalean-insurtech.ma` (Atlas Cloud Benguerir) |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3001` | OUI | CLIENT-SAFE | URL canonique app (utilise pour `metadataBase` SEO) |
| `NEXT_PUBLIC_APP_NAME` | `skalean-broker` | OUI | CLIENT-SAFE | Identifiant app pour tags Sentry, logs structures |
| `NEXT_PUBLIC_APP_VERSION` | `0.1.0` | NON | CLIENT-SAFE | Version semver injectee dans health endpoint + Sentry release |
| `NEXT_PUBLIC_DEFAULT_LOCALE` | `fr` | OUI | CLIENT-SAFE | Locale par defaut si Accept-Language non resolu |
| `NEXT_PUBLIC_SUPPORTED_LOCALES` | `fr,ar-MA,ar` | OUI | CLIENT-SAFE | Liste CSV locales supportees |
| `NEXT_PUBLIC_TENANT_ID_HEADER` | `x-tenant-id` | OUI | CLIENT-SAFE | Nom header HTTP propagation tenant (decision-002) |
| `NEXT_PUBLIC_TRACE_ID_HEADER` | `x-trace-id` | NON | CLIENT-SAFE | Nom header HTTP correlation tracing distribue |
| `NEXT_PUBLIC_IDEMPOTENCY_HEADER` | `Idempotency-Key` | NON | CLIENT-SAFE | Nom header HTTP idempotence sur mutations |
| `NEXT_PUBLIC_AUTH_REFRESH_PATH` | `/api/auth/refresh` | OUI | CLIENT-SAFE | Path Next.js API route refresh token |
| `NEXT_PUBLIC_AUTH_LOGIN_PATH` | `/login` | OUI | CLIENT-SAFE | Path page login (suffix apres locale) |
| `NEXT_PUBLIC_AUTH_LOGOUT_PATH` | `/api/auth/signout` | OUI | CLIENT-SAFE | Path Next.js API route signout |
| `NEXT_PUBLIC_SESSION_TTL_SEC` | `900` | NON | CLIENT-SAFE | TTL access_token en secondes (15 min) |
| `NEXT_PUBLIC_REFRESH_TTL_SEC` | `2592000` | NON | CLIENT-SAFE | TTL refresh_token en secondes (30 jours) |
| `NEXT_PUBLIC_SENTRY_DSN` | (vide) | NON dev / OUI prod | CLIENT-SAFE | DSN Sentry public (vide en dev = init skip) |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | (vide) | NON | CLIENT-SAFE TOKEN PUBLIC RESTRICTED | Token Mapbox restraint par domaine (Sprint 16 pas utilise) |
| `NEXT_PUBLIC_FEATURE_FLAGS_URL` | (vide) | NON | CLIENT-SAFE | URL service feature flags (Sprint 27+) |
| `NEXT_PUBLIC_CDN_URL` | (vide) | NON prod / OUI | CLIENT-SAFE | URL CDN Atlas Cloud assets statiques |
| `NEXT_PUBLIC_AI_GATEWAY_URL` | (vide) | NON | CLIENT-SAFE | URL AI Gateway Skalean (Sprint 13+ reserve) |
| `NEXT_PUBLIC_GTM_ID` | (vide) | NON | CLIENT-SAFE | GTM ID (Sprint 17 customer-portal SEO) |
| `NEXT_PUBLIC_DEBUG` | `false` | NON | CLIENT-SAFE | Active logs verbose client |
| `NEXT_PUBLIC_LIGHTHOUSE_PROFILE` | `mobile` | NON | CLIENT-SAFE | Profil Lighthouse CI |
| `NEXT_PUBLIC_PWA_ENABLED` | `false` | NON | CLIENT-SAFE | Active PWA (faux pour web-broker) |
| `ATLAS_CLOUD_REGION` | `bgr` | OUI prod | PRIVATE | Region Atlas Cloud (decision-008 Benguerir) |
| `ATLAS_CLOUD_STORAGE_BUCKET` | (vide) | OUI prod | PRIVATE | Bucket S3 Atlas Cloud assets prives |

Note securite : tout `NEXT_PUBLIC_*` est inline dans le bundle JS client a la build -- JAMAIS y mettre un secret. Variables `PRIVATE` injectees uniquement server-side via secret manager Atlas Cloud.

---

## 9. Commandes shell (install + dev + build + test + lint)

```bash
# ---------- Setup initial ----------
cd repo

# Install deps (workspace pnpm)
pnpm install --frozen-lockfile

# Ajout deps specifiques cette tache (deja dans package.json apres modification L1)
pnpm --filter @insurtech/web-broker add jose@5.9.6 date-fns-tz@4.1.0
pnpm --filter @insurtech/web-broker add -D axios-mock-adapter@2.1.0

# ---------- Developpement local ----------
# Demarrer dev server port 3001 avec Turbopack
pnpm --filter @insurtech/web-broker dev

# Verifier health endpoint
curl -s http://localhost:3001/api/health | jq .

# Verifier locale fr
curl -s -L http://localhost:3001/ -I | head -20

# Verifier middleware redirect non-auth
curl -s -L http://localhost:3001/fr/dashboard -I | head -20

# Verifier locale switch
curl -s -L -H "Accept-Language: ar-MA" http://localhost:3001/ -I | head -20

# ---------- Type check + Lint ----------
pnpm --filter @insurtech/web-broker typecheck
pnpm --filter @insurtech/web-broker lint --max-warnings 0

# ---------- Tests unit Vitest ----------
pnpm --filter @insurtech/web-broker test
pnpm --filter @insurtech/web-broker test:watch
pnpm --filter @insurtech/web-broker test:ui

# Coverage report
pnpm --filter @insurtech/web-broker test --coverage

# Verifier coverage seuil minimum 80%
cat repo/apps/web-broker/coverage/coverage-summary.json | jq '.total.lines.pct'

# ---------- Tests E2E Playwright ----------
# Demarrer backend mock + frontend dev en background (en CI utiliser docker-compose)
pnpm --filter @insurtech/web-broker test:e2e

# Headed pour debug
pnpm --filter @insurtech/web-broker test:e2e:headed

# ---------- Validation i18n ----------
pnpm tsx repo/scripts/validate-i18n-keys.ts --app web-broker

# ---------- Verification no-emoji ----------
bash repo/scripts/check-no-emoji.sh repo/apps/web-broker/

# Manuel grep
grep -rn "console\.log" repo/apps/web-broker/src/ --include="*.ts" --include="*.tsx" | grep -v "__tests__"

# ---------- Build production ----------
pnpm --filter @insurtech/web-broker build
pnpm --filter @insurtech/web-broker start &
sleep 5
curl -s http://localhost:3001/api/health | jq .status

# ---------- Lighthouse CI ----------
pnpm --filter @insurtech/web-broker lh

# ---------- Clean ----------
pnpm --filter @insurtech/web-broker clean

# ---------- Commit (Conventional Commits) ----------
git add repo/apps/web-broker/
git commit -m "feat(sprint-16): bootstrap web-broker app skeleton avec middleware auth tenant i18n

Sprint: 16
Phase: 4
Task: 4.3.1
Refs: B-16 Tache 4.3.1, decision-002, decision-006, decision-008, decision-009

- middleware compose Edge Runtime (i18n + auth + tenant)
- layouts (auth) et (protected) route groups
- api-client refactor avec auto-refresh JWT + Idempotency-Key
- providers chain QueryClient + Session + TenantContextSync
- 4 API routes Next.js (refresh, signout, me, switch-tenant)
- jose 5.9.6 + date-fns-tz 4.1.0 ajoutes
- 25+ tests Vitest + 14 tests Playwright E2E
- 3 locales fr / ar-MA / ar enrichies namespaces auth tenant errors middleware"
```

---

## 10. Criteres validation V1 a V28

### P0 (15 criteres bloquants)

**V1 (P0) -- App demarre sur port 3001**
- Commande : `pnpm --filter @insurtech/web-broker dev`
- Expected : log `ready - started server on 0.0.0.0:3001`, `curl http://localhost:3001/api/health` retourne 200
- Failure mode : port deja occupe (autre process) -> `lsof -i :3001` et kill, ou conflit pnpm-lock -> `pnpm install --force`

**V2 (P0) -- Middleware redirect non-auth vers /login**
- Commande : `curl -sI -L http://localhost:3001/fr/dashboard | grep -i location`
- Expected : ligne `location: /fr/login?redirect=%2Ffr%2Fdashboard`
- Failure mode : middleware bypass (matcher mal configure) -> verifier `config.matcher` dans `middleware.ts`

**V3 (P0) -- Middleware locale detection + redirect URL**
- Commande : `curl -sI -L -H "Accept-Language: ar-MA,ar;q=0.9" http://localhost:3001/ | grep -i location`
- Expected : redirect vers `/ar-MA` ou `/ar`
- Failure mode : detection default fr meme avec Accept-Language ar -> verifier `localePrefix: 'always'` + `localeDetection: true` dans routing.ts

**V4 (P0) -- Cookies tokens + tenant set after login**
- Commande : test E2E `e2e/02-middleware-auth.spec.ts` test "authenticated user on /login redirects to /dashboard"
- Expected : cookie `access_token` httpOnly + cookie `current_tenant_id` non-httpOnly + redirect 307 vers /dashboard
- Failure mode : cookies pas set par API NestJS Sprint 5 -> verifier headers Set-Cookie dans backend response

**V5 (P0) -- x-tenant-id injecte dans requests API**
- Commande : test Vitest `api-client.spec.ts` test "injects x-tenant-id from zustand store"
- Expected : header `x-tenant-id: tenant-test-1` present sur requete axios
- Failure mode : zustand store vide -> verifier `TenantContextSync` hydrate cookie au mount

**V6 (P0) -- Providers wrappers fonctionnent**
- Commande : test E2E navigation /fr -> verifier `useQuery(['session'])` retourne donnees
- Expected : QueryClient initialise, ReactQueryDevtools en dev, ThemeProvider applique class theme
- Failure mode : `useSession must be used within SessionProvider` error -> verifier chain providers dans layout.tsx

**V7 (P0) -- Layouts (auth) et (protected) appliques selon route**
- Commande : test E2E visit /fr/login (auth layout) puis /fr/dashboard (protected layout)
- Expected : /login centered card sans sidebar, /dashboard avec sidebar + topbar placeholder
- Failure mode : route group parentheses mal placees -> verifier `app/[locale]/(auth)/` vs `app/[locale]/(protected)/`

**V8 (P0) -- API route /api/auth/refresh fonctionne**
- Commande : `curl -X POST http://localhost:3001/api/auth/refresh -b "refresh_token=fake"`
- Expected : 401 avec body `{ code: 'REFRESH_FAILED' }` (parce que fake token rejete backend)
- Failure mode : 500 ou redirect HTML -> verifier `export const runtime = 'nodejs'` + `export const dynamic = 'force-dynamic'`

**V9 (P0) -- API route /api/auth/signout clear cookies**
- Commande : `curl -X POST http://localhost:3001/api/auth/signout -b "access_token=fake" -I`
- Expected : headers `Set-Cookie: access_token=; Max-Age=0` + `Set-Cookie: current_tenant_id=; Max-Age=0`
- Failure mode : cookies pas supprimes -> verifier `clearAuthCookies()` appel

**V10 (P0) -- 401 declenche refresh + retry transparent**
- Commande : test Vitest `api-client.spec.ts` test "handles 401 -> attempts refresh + retry"
- Expected : 1 call /api/auth/refresh + 1 retry de la requete originale + reponse 200 finale
- Failure mode : boucle infinie 401 -> verifier `originalConfig._retry = true` flag

**V11 (P0) -- Idempotency-Key UNIQUEMENT sur mutations**
- Commande : test Vitest `api-client.spec.ts` test "injects Idempotency-Key on POST but NOT on GET"
- Expected : POST/PUT/PATCH/DELETE ont le header, GET ne l'a pas
- Failure mode : header sur GET = cache poisoning -> verifier `MUTATION_METHODS.has(method)` check

**V12 (P0) -- 3 locales fr / ar-MA / ar repondent en 200**
- Commande : `curl -sI http://localhost:3001/fr && curl -sI http://localhost:3001/ar-MA && curl -sI http://localhost:3001/ar`
- Expected : 200 OK pour chaque + `Content-Language` header correspondant
- Failure mode : ar-MA non reconnu -> verifier `SUPPORTED_LOCALES` dans `lib/i18n/config.ts`

**V13 (P0) -- dir=rtl sur ar/ar-MA, dir=ltr sur fr**
- Commande : `curl -s http://localhost:3001/ar | grep '<html'`
- Expected : `<html lang="ar" dir="rtl" ...>`
- Failure mode : dir=ltr sur ar -> verifier `getDirection()` dans layout.tsx

**V14 (P0) -- Typecheck 0 erreur**
- Commande : `pnpm --filter @insurtech/web-broker typecheck`
- Expected : exit code 0, `Found 0 errors`
- Failure mode : type errors -> reparer ou ajuster types

**V15 (P0) -- Lint 0 warning (--max-warnings 0)**
- Commande : `pnpm --filter @insurtech/web-broker lint --max-warnings 0`
- Expected : exit code 0
- Failure mode : warnings ESLint -> resoudre ou ajuster `.eslintrc.cjs`

### P1 (8 criteres importants)

**V16 (P1) -- Tests Vitest 100% pass minimum 25 tests**
- Commande : `pnpm --filter @insurtech/web-broker test`
- Expected : `Test Files X passed (X)`, `Tests 25+ passed (25+)`, coverage > 80%
- Failure mode : mocks zustand / next/headers / next/navigation manquants

**V17 (P1) -- Tests Playwright E2E 100% pass minimum 14 tests**
- Commande : `pnpm --filter @insurtech/web-broker test:e2e`
- Expected : tous specs verts en chromium
- Failure mode : webServer pas demarre / port 3001 occupe / Atlas Cloud DNS resolve

**V18 (P1) -- Refresh race condition deduplicated (singleton promise)**
- Commande : test integration injecter 5 requetes parallel 401
- Expected : UN SEUL call /api/auth/refresh (pas 5)
- Failure mode : 5 calls -> verifier `refreshPromise` singleton dans api-client.ts

**V19 (P1) -- Header X-Frame-Options DENY**
- Commande : `curl -sI http://localhost:3001/fr | grep -i x-frame`
- Expected : `X-Frame-Options: DENY`
- Failure mode : header absent -> verifier `next.config.mjs` headers Sprint 4

**V20 (P1) -- CSP header configure**
- Commande : `curl -sI http://localhost:3001/fr | grep -i content-security`
- Expected : header avec `default-src 'self'` + `connect-src 'self' http://localhost:4000 ...`
- Failure mode : CSP manquant ou trop permissif

**V21 (P1) -- Cookies httpOnly access_token**
- Commande : check E2E `context.cookies()` + `httpOnly: true` sur access_token
- Expected : httpOnly true, secure prod, sameSite lax
- Failure mode : httpOnly false -> XSS leak risk

**V22 (P1) -- Sentry init en prod uniquement**
- Commande : grep `Sentry.init` dans `providers.tsx`
- Expected : skip si NODE_ENV development OU dsn vide
- Failure mode : init en dev -> spam DSN gratuit

**V23 (P1) -- Switch tenant valide acces user**
- Commande : test Vitest `switch-tenant/route.ts`
- Expected : 403 si user n'a pas acces au tenant_id demande
- Failure mode : 200 even si pas membership -> securite cassee

### P2 (5 criteres souhaitables)

**V24 (P2) -- Lighthouse Performance >= 70**
- Commande : `pnpm --filter @insurtech/web-broker lh`
- Expected : `categories.performance.score >= 0.70`
- Failure mode : bundle trop gros -> optimizePackageImports `next.config.mjs`

**V25 (P2) -- Lighthouse Accessibility >= 90**
- Expected : `categories.accessibility.score >= 0.90`
- Failure mode : aria-label manquants, contraste insuffisant

**V26 (P2) -- Bundle JS first load < 250 ko gzipped /fr**
- Commande : `pnpm --filter @insurtech/web-broker build` + analyse `.next/analyze`
- Expected : ligne `app/[locale]/page` First Load JS < 250 ko
- Failure mode : import lourd (full lodash) -> tree-shake imports

**V27 (P2) -- Hydration 0 console.error sur boot**
- Commande : test E2E `page.on('console', e => expect(e.type()).not.toBe('error'))`
- Expected : aucun message console error apres navigation
- Failure mode : hydration mismatch -> verifier date/random/locale conditionals SSR

**V28 (P2) -- Coverage Vitest >= 80% sur lib/**
- Commande : `pnpm --filter @insurtech/web-broker test --coverage`
- Expected : `lib/api-client.ts` + `lib/auth/*.ts` + `lib/jwt.ts` couverture > 80%
- Failure mode : branches non testees -> ajouter cas edge

---

## 11. Edge cases EC1 a EC12

**EC1 -- Cookie access_token expire pendant navigation utilisateur**
Scenario : User a 30 sec restantes sur access_token + clique sur lien `/contacts`. Pendant le navigateur fetch RSC, le JWT expire (marge 30s atteinte). Middleware Edge voit JWT expire -> redirect /login -> mais cookie refresh_token est encore valide.
Solution implementee : pour les RSC navigations, le middleware redirige `/login`. Mais on **prefere** pour UX : middleware tente d'abord refresh via fetch `/api/auth/refresh` Edge-compatible (mais Edge ne peut pas fetch internal API route). Mitigation alternative : api-client client-side detecte 401 via fetch RSC failed et trigger refresh + window.location reload.

**EC2 -- Refresh token race avec 5 tabs paralleles**
Scenario : User a 5 tabs ouverts, tous voient access_token expire simultanement, tous declenchent fetch /api/auth/refresh. Backend recoit 5 requetes parallel.
Solution implementee : cote frontend, singleton `refreshPromise` deduplicate dans api-client.ts. Backend Sprint 5 doit deduplicate egalement sur user_id (locking row session).

**EC3 -- Cookie current_tenant_id corrompu (UUID invalide)**
Scenario : User edite manuellement cookie via DevTools, met `current_tenant_id=garbage`. Middleware passe (cookie present), backend NestJS rejette 400 sur `x-tenant-id: garbage`.
Solution implementee : api-client recoit 400, trigger toast erreur + nettoye cookie + redirect /select-tenant. Middleware n'a pas a valider UUID format (defense profondeur backend).

**EC4 -- Multiple tabs avec tenants differents (multi-portefeuille)**
Scenario : Courtier a 2 cabinets, ouvre tab 1 avec cabinet A, tab 2 avec cabinet B. zustand persist sessionStorage isole donc OK par tab. Mais cookie current_tenant_id est SHARED entre tabs (cookie is global per domain).
Solution implementee : sessionStorage zustand prend priorite sur cookie pour les requetes client. Cookie sert juste a initialiser au boot. Si user switch tenant dans tab 1, cookie change, tab 2 zustand reste sur cabinet B. Trade-off accepte : prochaine navigation tab 2 fera reload + lit cookie + voit cabinet A. Documente.

**EC5 -- Locale non supportee dans Accept-Language**
Scenario : Visiteur depuis Allemagne, Accept-Language `de-DE,en;q=0.9`. Aucune locale supportee.
Solution implementee : `detectLocaleFromRequest` fallback `DEFAULT_LOCALE` (fr). Cookie NEXT_LOCALE set a fr. Pas de boucle redirect.

**EC6 -- JWT malforme (corrompu ou tronque)**
Scenario : Erreur reseau ou edit DevTools -> cookie access_token = "abc.def" (pas 3 segments).
Solution implementee : `decodeJwtUnsafe` try/catch retourne null. Middleware traite comme non-authentifie -> redirect /login + clear cookie.

**EC7 -- Backend API down pendant signout**
Scenario : User clique logout, mais backend timeout.
Solution implementee : `signout/route.ts` best-effort -- meme si backend echoue, on clear cookies cote client + retourne 200. User est logout local.

**EC8 -- Edge Runtime limit 1 MB bundle middleware**
Scenario : Si on ajoute trop de logique au middleware (libs lourdes), build fail avec "Middleware exceeded 1 MB limit".
Solution implementee : middleware utilise UNIQUEMENT `jose` (decode JWT) + next-intl middleware. Pas d'axios, pas de date-fns, pas de logger Pino (qui ne fonctionne pas Edge de toute facon). Logger Edge = `console.warn/error` direct.

**EC9 -- Cookie NEXT_LOCALE manquant ET Accept-Language vide**
Scenario : Curl sans headers Accept-Language, pas de cookie.
Solution implementee : fallback `DEFAULT_LOCALE` (fr).

**EC10 -- User authentifie mais tenant_id absent dans JWT**
Scenario : User vient de signup, n'a pas encore selectionne de cabinet.
Solution implementee : middleware redirect `/${locale}/select-tenant`. `(auth)/layout.tsx` accepte la route (ne redirect pas vers /dashboard parce que session.tenantId est null).

**EC11 -- Server Component apiServerGet timeout**
Scenario : Backend NestJS lent (3s+), Server Component `apiServerGet('/api/v1/tenants/me')` timeout.
Solution implementee : `prefetchQuery` dans `(protected)/layout.tsx` soft-fails (return null). UI affiche fallback "Tenant indisponible". Logger error structured.

**EC12 -- next-intl locale switcher cassé avec next/navigation native**
Scenario : Developer (Sprint 16 tache 4.3.13) utilise `useRouter` de `next/navigation` au lieu de `createNavigation(routing)` -> URL change mais locale segment lost.
Solution implementee : `createNavigation` exporte Link, redirect, usePathname, useRouter typed. Doc dans `lib/i18n/routing.ts` indique import obligatoire.

---

## 12. Conformite Maroc

### Loi 09-08 CNDP (Commission Nationale Protection Donnees Personnelles)

Cette tache pose les fondations de la conformite cookies :

1. **Cookies essentiels (techniques)** : `access_token`, `refresh_token`, `current_tenant_id`, `NEXT_LOCALE` sont **necessaires au fonctionnement** de l'application (auth + multi-tenant + i18n). Sous CNDP, ces cookies essentiels ne necessitent **pas** consentement explicite mais doivent etre listes dans la politique cookies (livraison Sprint 16 tache 4.3.13 page `/legal/cookies`).
2. **Cookies analytics + tracking** : Sentry, GTM, Mapbox -- ces cookies necessitent consentement explicite (banner cookie consent livre Sprint 17 customer-portal mais reutilise web-broker). Pour Sprint 16, on charge Sentry UNIQUEMENT en prod ET avec DSN configure.
3. **Droit d'effacement (Art. 7 loi 09-08)** : utilisateur peut demander purge donnees. Endpoint `/api/auth/signout` clear cookies + Sprint 6 livre procedure CNDP purge backend.
4. **Notification breach 72h** : Sentry alerte Sprint 12 (compliance audit) + escalade CNDP automatique via Atlas Cloud Services SOC integration.

### Loi 53-05 (Echanges Electroniques de Donnees Juridiques)

Cookies + tokens contiennent donnees personnelles -> traitement loi 53-05 :
- Chiffrement transit TLS 1.3 obligatoire (configure `next.config.mjs` Sprint 4 headers).
- Cookies `secure: true` en production.
- `sameSite: 'lax'` (anti-CSRF baseline).

### Decret cookies CNDP 2024

Le decret 2.24.X du 2024 (en attente publication officielle Bulletin Officiel) precise :
- Duration max cookies non-essentiels : 13 mois.
- Banner cookie consent obligatoire sites publics (Sprint 17 customer-portal).
- Sites prives B2B (web-broker authentifie) exemptes mais doivent afficher politique cookies.

Cette tache fournit le **lien footer** `/legal/cookies` dans `(auth)/layout.tsx` (la page elle-meme est livree Sprint 16 tache 4.3.13).

### Cloud souverain Atlas Cloud Services Benguerir (decision-008)

- `NEXT_PUBLIC_API_URL` prod = `https://api.skalean-insurtech.ma` (DNS Atlas Cloud Benguerir DC1/DC2).
- `NEXT_PUBLIC_CDN_URL` prod = `https://cdn.skalean-insurtech.ma` (Atlas Cloud Object Storage).
- `next.config.mjs` `images.remotePatterns` exclut tout `*.amazonaws.com`.
- Variables env production injectees par secret manager Atlas Cloud Services (jamais en clair dans repo).
- Tier IV DC2 disponibilite 99.99% -- SLA web-broker base sur cette garantie.

### ACAPS (Autorite Marocaine de Controle des Assurances et de la Prevoyance Sociale)

ACAPS deja client Atlas Cloud Services -- coherence ecosystem facilite audits Programme Emergence. Cette tache ne touche pas directement aux endpoints reglementaires (reporting ACAPS = Sprint 31).

---

## 13. Conventions absolues skalean-insurtech (20 conventions)

1. **Multi-tenant strict** : tout endpoint API recoit `x-tenant-id` header (decision-002). Cette tache automatise injection cote client (zustand) + cote server (cookie). AsyncLocalStorage backend handle (Sprint 6).

2. **Zod validation only** : aucune validation manuelle ou yup/joi. `app/api/auth/switch-tenant/route.ts` utilise `z.object({ tenant_id: z.string().uuid() }).parse(body)`. Toutes mutations formulaires Sprint 16 utilisent zod schemas.

3. **Pino logger (jamais console.log)** : `console.log` interdit en production (decision-006 etendue). Cette tache utilise `logger.info/warn/error/debug` depuis `@/lib/logger`. Console.* tolere uniquement dans tests Vitest.

4. **Argon2id (jamais bcrypt)** : pas applicable cette tache (hashing backend Sprint 5). Mais convention rappelee : aucun usage bcrypt cote serveur.

5. **pnpm only** : `pnpm-workspace.yaml` + `pnpm-lock.yaml` exclusivement. Cette tache n'introduit pas npm/yarn. Scripts utilisent `pnpm --filter @insurtech/web-broker ...`.

6. **TypeScript strict** : `tsconfig.json` strict + noUncheckedIndexedAccess + noImplicitOverride. Aucun `any` non documente. Cette tache type tout (UserSession, ApiError, SkaleanJwtPayload, AppLocale).

7. **RBAC defense profondeur** : UI cache features sans permission (Sprint 16 tache 4.3.12) MAIS backend NestJS toujours valide (Sprint 7 PermissionGuard). Cette tache pose les hooks `useSessionStore.hasPermission`/`hasRole` consume cote UI mais ne se substitue pas a la validation backend.

8. **Kafka events** : pas applicable cette tache (events backend Sprint 5+). Mention rappelee : signals critiques (auth.signin, tenant.switched, session.refreshed) emis Kafka backend.

9. **@insurtech/* imports** : aliases TypeScript `@insurtech/shared-ui/*`, `@insurtech/shared-config/*`, `@insurtech/shared-types/*` (deja Sprint 4). Imports relatifs `../../../` interdits hors meme module. Cette tache utilise `@/lib/...`, `@/components/...`, `@insurtech/shared-ui/components/...`.

10. **NO EMOJI ABSOLU (decision-006)** : zero emoji dans code, JSON messages, commits, logs, tests. Verifie par `scripts/check-no-emoji.sh`. Accents francais + caracteres arabes autorises. CI block PR si emoji detecte.

11. **Idempotency-Key sur mutations** : POST/PUT/PATCH/DELETE seulement. JAMAIS GET (cache poisoning). Cette tache : api-client.ts request interceptor implemente correctement.

12. **Conventional Commits** : `feat(sprint-16): ...`, `fix(...)`, `refactor(...)`, `chore(...)`, `test(...)`. Cette tache commit message conforme + metadata Task/Sprint/Phase/Refs lignes.

13. **Cloud Atlas Maroc Benguerir (decision-008)** : `api.skalean-insurtech.ma`, `cdn.skalean-insurtech.ma`, `s3.bgr.atlascloudservices.ma`. Jamais AWS. Verifie dans `next.config.mjs` `images.remotePatterns`.

14. **Sofidemy brand kit** : couleurs `#E95D2C` (Orange primary), `#1A2730` (Navy secondary), `#B0CEE2` (Sky Blue accent), `#2D5773` (ACAPS Teal). Cette tache n'introduit pas de couleurs (deja `@insurtech/shared-ui/tailwind-preset`). Theme color viewport pour mobile install.

15. **Fonts** : Montserrat (latin), Noto Naskh Arabic (arabe), Geist Mono (code). Cette tache : layout.tsx `next/font/google` charge les 3 avec `display: 'swap'`, `preload: true` pour Montserrat + Noto.

16. **Timezone Africa/Casablanca** : tous dates serialisees / formattees dans ce timezone. Cette tache : `lib/i18n/formats.ts` `formatInTimeZone(date, 'Africa/Casablanca', ...)`. NextIntlClientProvider `timeZone="Africa/Casablanca"`.

17. **Currency MAD (Dirham marocain)** : tous montants affiches en MAD. Cette tache : `lib/i18n/formats.ts` `formatCurrency` utilise `currency: 'MAD'`. NextIntlClientProvider formats.number.currency.

18. **WCAG 2.1 AA** : contraste 4.5:1 textes, ratio 3:1 large texts, focus visible, aria labels, keyboard navigation. Cette tache : `aria-label` sur boutons placeholders. Lighthouse Accessibility >= 90 (V25).

19. **Skalean AI frontier (decision-005)** : pas d'integration AI directe cette tache. `NEXT_PUBLIC_AI_GATEWAY_URL` reservee. Sprint 13+ ajoute hook `useAiGateway()`.

20. **SetUp Sprint 4 base** : cette tache n'introduit AUCUNE deviation du bootstrap Sprint 4. Elle etend uniquement. Si conflit Sprint 4 vs Sprint 16, prefere Sprint 16 (le plus recent) MAIS documente dans CHANGELOG.

---

## 14. Validation pre-commit + GitHub Actions

### Husky pre-commit `.husky/pre-commit` (extrait pertinent)

```bash
#!/usr/bin/env bash
set -e

echo "[pre-commit] running lint-staged"
pnpm exec lint-staged

echo "[pre-commit] running typecheck on changed apps"
pnpm --filter ...[HEAD^1] typecheck

echo "[pre-commit] checking no-emoji policy (decision-006)"
bash repo/scripts/check-no-emoji.sh

echo "[pre-commit] validating i18n keys parity"
pnpm tsx repo/scripts/validate-i18n-keys.ts --app web-broker

echo "[pre-commit] checking no console.log in src/"
COUNT=$(grep -rn "console\.log" repo/apps/web-broker/src/ \
  --include='*.ts' --include='*.tsx' \
  | grep -v "__tests__" \
  | wc -l || true)
if [ "$COUNT" -gt 0 ]; then
  echo "ERROR: console.log found in src/ (use logger from @/lib/logger)"
  grep -rn "console\.log" repo/apps/web-broker/src/ --include='*.ts' --include='*.tsx' | grep -v "__tests__"
  exit 1
fi

echo "[pre-commit] OK"
```

### Github Actions workflow `.github/workflows/ci-web-broker.yml`

```yaml
name: CI web-broker

on:
  pull_request:
    paths:
      - 'repo/apps/web-broker/**'
      - 'repo/packages/shared-ui/**'
      - 'repo/packages/shared-config/**'
      - '.github/workflows/ci-web-broker.yml'
  push:
    branches: [main]
    paths:
      - 'repo/apps/web-broker/**'

concurrency:
  group: ci-web-broker-${{ github.ref }}
  cancel-in-progress: true

jobs:
  validate:
    runs-on: ubuntu-22.04
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: pnpm/action-setup@v4
        with:
          version: 9.15.0

      - uses: actions/setup-node@v4
        with:
          node-version: 22.11.0
          cache: pnpm
          cache-dependency-path: repo/pnpm-lock.yaml

      - name: Install dependencies
        working-directory: repo
        run: pnpm install --frozen-lockfile

      - name: Check no-emoji policy
        working-directory: repo
        run: bash scripts/check-no-emoji.sh apps/web-broker/

      - name: Validate i18n keys parity
        working-directory: repo
        run: pnpm tsx scripts/validate-i18n-keys.ts --app web-broker

      - name: TypeCheck
        working-directory: repo
        run: pnpm --filter @insurtech/web-broker typecheck

      - name: Lint
        working-directory: repo
        run: pnpm --filter @insurtech/web-broker lint --max-warnings 0

      - name: Unit tests Vitest
        working-directory: repo
        run: pnpm --filter @insurtech/web-broker test --coverage

      - name: Coverage gate (>= 80%)
        working-directory: repo
        run: |
          COV=$(jq -r '.total.lines.pct' apps/web-broker/coverage/coverage-summary.json)
          echo "Coverage = $COV"
          awk "BEGIN { exit !($COV >= 80) }"

      - name: Upload coverage
        uses: actions/upload-artifact@v4
        with:
          name: coverage-web-broker
          path: repo/apps/web-broker/coverage/

      - name: Install Playwright
        working-directory: repo/apps/web-broker
        run: pnpm exec playwright install --with-deps chromium

      - name: E2E Playwright
        working-directory: repo
        run: pnpm --filter @insurtech/web-broker test:e2e

      - name: Build production
        working-directory: repo
        run: pnpm --filter @insurtech/web-broker build
        env:
          NEXT_PUBLIC_API_URL: http://localhost:4000
          NEXT_PUBLIC_APP_URL: http://localhost:3001
          NEXT_PUBLIC_APP_NAME: skalean-broker
          NEXT_PUBLIC_DEFAULT_LOCALE: fr
          NEXT_PUBLIC_SUPPORTED_LOCALES: 'fr,ar-MA,ar'

      - name: Lighthouse CI
        working-directory: repo
        run: |
          pnpm --filter @insurtech/web-broker start &
          sleep 10
          pnpm --filter @insurtech/web-broker lh || true
          cat apps/web-broker/.lighthouse/report.json | jq '.categories'
```

---

## 15. Commit message complet

```
feat(sprint-16): bootstrap web-broker app skeleton avec middleware auth tenant i18n

Sprint: 16
Phase: 4
Task: 4.3.1
Effort: 6h
Priority: P0
Refs: B-16 Tache 4.3.1, decision-002, decision-006, decision-008, decision-009

Cette commit livre la fondation applicative web-broker post-bootstrap Sprint 4 :
middleware compose Edge Runtime (locale + auth + tenant guards), 3 layouts
imbriques (root + auth + protected), api-client production-ready avec
auto-refresh JWT transparent + injection automatique x-tenant-id +
Idempotency-Key sur mutations, providers chain complete (QueryClient +
SessionProvider + TenantContextSync + SentryErrorBoundary), 4 API routes
Next.js (refresh, signout, me, switch-tenant), 3 locales enrichies
(fr / ar-MA Darija / ar classique) avec namespaces auth + tenant +
middleware + errors + protected.

Fichiers livres (32 nouveaux + 9 modifies) :
- middleware.ts (compose i18n + auth + tenant)
- src/app/[locale]/layout.tsx (root layout enrichi)
- src/app/[locale]/(auth)/layout.tsx (centered card layout pages publiques)
- src/app/[locale]/(protected)/layout.tsx (guard auth + tenant + RSC prefetch)
- src/app/api/auth/{refresh,signout,me,switch-tenant}/route.ts
- src/app/api/health/route.ts
- src/components/providers.tsx (HydrationBoundary + Sentry)
- src/components/auth/{session-provider,tenant-context-sync}.tsx
- src/lib/api-client.ts (refresh singleton + Idempotency-Key + 401 retry)
- src/lib/api-client.server.ts (server-only fetch with cookies)
- src/lib/jwt.ts (jose decodeJwtUnsafe + isJwtExpired + helpers permissions)
- src/lib/auth/{session,cookies}.ts (Server Component helpers)
- src/lib/i18n/{config,request,routing,formats}.ts
- src/lib/query-client.ts (singleton + retry policy + Sentry on error)
- src/store/{session-store,tenant-store}.ts (zustand stores)
- src/messages/{fr,ar-MA,ar}.json (etendus auth + tenant + middleware)
- src/types/{session,api}.d.ts

Tests (39 nouveaux) :
- 8 tests jwt helpers
- 15 tests api-client interceptors (refresh, retry, Idempotency-Key, etc.)
- 6 tests auth session helpers (Server Components)
- 5 tests i18n config
- 12 tests middleware compose
- 4 tests E2E Playwright boot + locales
- 6 tests E2E Playwright middleware auth guard
- 4 tests E2E Playwright tenant cookie + locale persist

Dependencies ajoutees :
- jose@5.9.6 (Edge-compatible JWT decode)
- date-fns-tz@4.1.0 (timezone Africa/Casablanca)
- axios-mock-adapter@2.1.0 (devDep tests)

Conformite :
- decision-002 multi-tenant strict (header x-tenant-id propage)
- decision-006 NO EMOJI (verifie CI scripts/check-no-emoji.sh)
- decision-008 Atlas Cloud Benguerir (URLs prod skalean-insurtech.ma)
- decision-009 multilinguisme fr / ar-MA / ar + RTL
- Loi 09-08 CNDP : cookies essentiels documentes, refresh_token httpOnly,
  notification breach 72h via Atlas Cloud SOC

Validation V1-V28 : 15 P0 + 8 P1 + 5 P2 criteres -- TOUS PASSED.

Co-authored-by: Saad Belghali Acharki <saad@skalean.ma>
Co-authored-by: Abla Mounjia <abla@skalean.ma>
```

---

## 16. Workflow next step (vers task-4.3.2)

A la sortie de cette tache 4.3.1, l'app web-broker est prete a recevoir les pages metier. La tache suivante **4.3.2** (Pages Auth : login + MFA + signup + recovery) :

- consomme `app/[locale]/(auth)/layout.tsx` livre ici comme container ;
- consomme `lib/api-client.ts` pour POST `/auth/signin`, `/auth/verify-mfa`, `/auth/signup`, `/auth/forgot-password`, `/auth/reset-password` ;
- consomme `app/api/auth/me/route.ts` pour bootstrap session apres signin ;
- consomme `useSession()` hook depuis `SessionProvider` ;
- consomme `lib/i18n/formats.ts` pour `formatPhoneNumber` (signup) ;
- ajoute pages `(auth)/login/page.tsx`, `(auth)/verify-mfa/page.tsx`, `(auth)/signup/page.tsx`, `(auth)/forgot-password/page.tsx`, `(auth)/reset-password/page.tsx`, `(auth)/verify-email/page.tsx`, `(auth)/select-tenant/page.tsx`, `(auth)/email-sent/page.tsx` ;
- supprime les `(auth)/placeholder.tsx` + `(protected)/placeholder.tsx` livres ici (marker files).

**Pre-conditions tache 4.3.2** :
- Cette tache 4.3.1 validee V1-V15 P0 PASSED.
- Backend Sprint 5 endpoints `/auth/signin`, `/auth/verify-mfa`, `/auth/signup`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/verify-email` operationnels.
- Tenant memberships endpoint `/tenants/me` operationnel (Sprint 6).

**Commande demarrage tache 4.3.2** :
```bash
git checkout -b feat/sprint-16-task-4.3.2-auth-pages
# Lire 00-pilotage/prompts-taches/sprint-16-web-broker-app/task-4.3.2-pages-auth-login-mfa-signup-recovery.md
# Implement
pnpm --filter @insurtech/web-broker dev
```

Apres tache 4.3.2 -> tache 4.3.3 (Layout principal Sidebar + Topbar + Tenant Switcher) qui consomme `app/[locale]/(protected)/layout.tsx` livre ici en mode placeholder.

---

## 17. Annexes -- Code patterns supplementaires production-ready

### 17.1 `repo/apps/web-broker/src/app/[locale]/(auth)/placeholder.tsx` (~15 lignes)

```typescript
/**
 * Placeholder marker file -- supprime Sprint 16 tache 4.3.2
 * Reference : 00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md (Tache 4.3.1)
 *
 * Pourquoi : Next.js refuse une route group qui ne contient PAS au moins un
 * page.tsx / layout.tsx dedans. Ce fichier garantit que le route group (auth)
 * existe pendant le Sprint 16 tache 4.3.1 -- Sprint 16 tache 4.3.2 remplit
 * (login/signup/etc.) puis supprime ce placeholder.
 */
export {};
```

### 17.2 `repo/apps/web-broker/src/app/[locale]/(protected)/placeholder.tsx` (~15 lignes)

```typescript
/**
 * Placeholder marker file -- supprime Sprint 16 tache 4.3.4
 * Reference : 00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md (Tache 4.3.1)
 *
 * Pourquoi : voir (auth)/placeholder.tsx. Sprint 16 tache 4.3.4 livre dashboard/
 * et supprime ce marker.
 */
export {};
```

### 17.3 `repo/apps/web-broker/test/fixtures/jwt.ts` (~80 lignes)

```typescript
/**
 * JWT test fixtures -- web-broker
 * Reference : 00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md (Tache 4.3.1)
 *
 * Factory pour generer JWT signe pour tests Vitest + E2E.
 * Cle secret partagee uniquement pour tests (jamais en prod).
 */
import { SignJWT } from 'jose';
import type { SkaleanJwtPayload } from '@/lib/jwt';

const TEST_SECRET = new TextEncoder().encode(
  'test-secret-do-not-use-in-prod-32-bytes-minimum'
);

export interface TestJwtOptions {
  sub?: string;
  role?: string;
  permissions?: string[];
  tenantId?: string | null;
  email?: string;
  displayName?: string;
  preferredLocale?: string;
  mfaEnabled?: boolean;
  ttlSeconds?: number;
  algorithm?: 'HS256' | 'HS384' | 'HS512';
}

export async function buildTestJwt(options: TestJwtOptions = {}): Promise<string> {
  const nowSec = Math.floor(Date.now() / 1000);
  const ttl = options.ttlSeconds ?? 900;
  const payload: SkaleanJwtPayload = {
    sub: options.sub ?? 'user-test-1',
    role: options.role ?? 'broker_admin',
    permissions: options.permissions ?? ['crm.contacts.read', 'crm.deals.read'],
    tenant_id: options.tenantId ?? 'tenant-test-1',
    email: options.email ?? 'admin@cabinet-test.ma',
    display_name: options.displayName ?? 'Admin Test',
    preferred_locale: options.preferredLocale ?? 'fr',
    mfa_enabled: options.mfaEnabled ?? false,
    exp: nowSec + ttl,
    iat: nowSec,
  };
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: options.algorithm ?? 'HS256' })
    .sign(TEST_SECRET);
}

export async function buildExpiredJwt(options: TestJwtOptions = {}): Promise<string> {
  return buildTestJwt({ ...options, ttlSeconds: -100 });
}

export async function buildBrokerAdminJwt(tenantId = 'tenant-test-1'): Promise<string> {
  return buildTestJwt({
    role: 'broker_admin',
    permissions: [
      'crm.contacts.read', 'crm.contacts.write', 'crm.contacts.delete',
      'crm.deals.read', 'crm.deals.write', 'crm.deals.delete',
      'insure.polices.read', 'insure.polices.write',
      'insure.broker.queue.validate',
      'admin.tenant.settings.read', 'admin.tenant.settings.write',
    ],
    tenantId,
  });
}

export async function buildBrokerUserJwt(tenantId = 'tenant-test-1'): Promise<string> {
  return buildTestJwt({
    role: 'broker_user',
    permissions: [
      'crm.contacts.read', 'crm.contacts.write',
      'crm.deals.read', 'crm.deals.write',
      'insure.polices.read',
    ],
    tenantId,
  });
}

export async function buildBrokerAssistantJwt(tenantId = 'tenant-test-1'): Promise<string> {
  return buildTestJwt({
    role: 'broker_assistant',
    permissions: [
      'crm.contacts.read', 'crm.contacts.write',
      'crm.deals.read',
      'insure.polices.read',
    ],
    tenantId,
  });
}
```

### 17.4 `repo/apps/web-broker/test/fixtures/session.ts` (~50 lignes)

```typescript
/**
 * UserSession mock fixtures
 * Reference : 00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md (Tache 4.3.1)
 */
import type { UserSession, TenantSummary, TenantMembership } from '@/types/session';

export function buildMockSession(overrides: Partial<UserSession> = {}): UserSession {
  return {
    userId: 'user-test-1',
    email: 'admin@cabinet-test.ma',
    displayName: 'Admin Test',
    role: 'broker_admin',
    permissions: ['crm.contacts.read', 'crm.deals.read'],
    tenantId: 'tenant-test-1',
    preferredLocale: 'fr',
    mfaEnabled: false,
    accessToken: 'fake.jwt.token',
    expiresAt: new Date(Date.now() + 900_000).toISOString(),
    ...overrides,
  };
}

export function buildMockTenant(overrides: Partial<TenantSummary> = {}): TenantSummary {
  return {
    id: 'tenant-test-1',
    name: 'Cabinet Test Courtage',
    type: 'broker',
    brandPrimaryColor: '#E95D2C',
    brandSecondaryColor: '#1A2730',
    defaultLocale: 'fr',
    currency: 'MAD',
    timezone: 'Africa/Casablanca',
    ...overrides,
  };
}

export function buildMockMemberships(count = 2): TenantMembership[] {
  return Array.from({ length: count }, (_, i) => ({
    tenant: buildMockTenant({
      id: `tenant-test-${i + 1}`,
      name: `Cabinet Test ${i + 1}`,
    }),
    role: 'broker_admin',
    permissions: ['crm.contacts.read'],
    joinedAt: new Date(Date.now() - i * 86_400_000).toISOString(),
  }));
}
```

### 17.5 `repo/apps/web-broker/test/setup.ts` (~50 lignes)

```typescript
/**
 * Vitest setup file
 * Reference : 00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md (Tache 4.3.1)
 *
 * Charge avant chaque suite tests.
 */
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Polyfill TextEncoder/TextDecoder (jsdom default has)
if (typeof globalThis.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  globalThis.TextEncoder = TextEncoder;
  globalThis.TextDecoder = TextDecoder;
}

// Mock matchMedia (next-themes)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
class IntersectionObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn(() => []);
}
(globalThis as any).IntersectionObserver = IntersectionObserverMock;

// Reset stores between tests
beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});
```

### 17.6 `repo/apps/web-broker/vitest.config.ts` (extensions Sprint 16, ~55 lignes)

```typescript
import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    include: [
      'src/**/__tests__/**/*.{spec,test}.{ts,tsx}',
      'src/__tests__/**/*.{spec,test}.{ts,tsx}',
    ],
    exclude: ['e2e/**', 'node_modules', '.next', 'coverage'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'json-summary', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/lib/**/*.{ts,tsx}', 'src/components/**/*.{ts,tsx}', 'src/store/**/*.ts'],
      exclude: [
        'src/**/__tests__/**',
        'src/**/*.d.ts',
        'src/types/**',
        'src/messages/**',
        '**/*.config.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 75,
        branches: 75,
        statements: 80,
      },
    },
    testTimeout: 10_000,
    hookTimeout: 10_000,
    pool: 'forks',
    isolate: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@insurtech/shared-ui': resolve(__dirname, '../../packages/shared-ui/src'),
      '@insurtech/shared-config': resolve(__dirname, '../../packages/shared-config/src'),
      '@insurtech/shared-types': resolve(__dirname, '../../packages/shared-types/src'),
    },
  },
});
```

### 17.7 `repo/apps/web-broker/playwright.config.ts` (extensions, ~75 lignes)

```typescript
import { defineConfig, devices } from '@playwright/test';

const PORT = 3001;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [['html'], ['github'], ['list']]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
    locale: 'fr-MA',
    timezoneId: 'Africa/Casablanca',
    viewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: true,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'chromium-arabic',
      use: {
        ...devices['Desktop Chrome'],
        locale: 'ar-MA',
        extraHTTPHeaders: { 'Accept-Language': 'ar-MA,ar;q=0.9' },
      },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    url: `${baseURL}/api/health`,
    timeout: 60_000,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      NEXT_PUBLIC_API_URL: 'http://localhost:4000',
      NEXT_PUBLIC_APP_URL: baseURL,
      NEXT_PUBLIC_APP_NAME: 'skalean-broker',
      NEXT_PUBLIC_DEFAULT_LOCALE: 'fr',
      NEXT_PUBLIC_SUPPORTED_LOCALES: 'fr,ar-MA,ar',
    },
  },
});
```

### 17.8 `repo/apps/web-broker/package.json` (~95 lignes apres ajout deps)

```json
{
  "name": "@insurtech/web-broker",
  "version": "0.1.0",
  "private": true,
  "description": "Skalean InsurTech -- Portail web courtier (broker.skalean-insurtech.ma)",
  "engines": {
    "node": ">=22.11.0",
    "pnpm": ">=9.15.0"
  },
  "scripts": {
    "dev": "next dev --port 3001 --turbopack",
    "build": "next build",
    "start": "next start --port 3001",
    "lint": "next lint --max-warnings 0",
    "lint:fix": "next lint --fix",
    "typecheck": "tsc --noEmit",
    "test": "vitest run --coverage",
    "test:watch": "vitest",
    "test:ui": "vitest --ui",
    "test:e2e": "playwright test --project=chromium",
    "test:e2e:headed": "playwright test --project=chromium --headed",
    "test:e2e:rtl": "playwright test --project=chromium-arabic",
    "lh": "lighthouse http://localhost:3001/fr --only-categories=performance,accessibility,best-practices,seo --output=json --output-path=./.lighthouse/report.json",
    "validate:i18n": "tsx ../../scripts/validate-i18n-keys.ts --app web-broker",
    "validate:no-emoji": "bash ../../scripts/check-no-emoji.sh ./",
    "clean": "rimraf .next .turbo coverage playwright-report .lighthouse"
  },
  "dependencies": {
    "next": "15.1.0",
    "react": "19.0.0",
    "react-dom": "19.0.0",
    "next-intl": "3.26.3",
    "next-themes": "0.4.4",
    "@tanstack/react-query": "5.62.7",
    "@tanstack/react-query-devtools": "5.62.7",
    "axios": "1.7.9",
    "jose": "5.9.6",
    "zod": "3.24.1",
    "zustand": "5.0.2",
    "@sentry/nextjs": "8.47.0",
    "pino": "9.5.0",
    "clsx": "2.1.1",
    "tailwind-merge": "2.5.5",
    "lucide-react": "0.469.0",
    "sonner": "1.7.1",
    "date-fns": "4.1.0",
    "date-fns-tz": "4.1.0",
    "@insurtech/shared-ui": "workspace:*",
    "@insurtech/shared-config": "workspace:*",
    "@insurtech/shared-types": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "22.10.2",
    "@types/react": "19.0.2",
    "@types/react-dom": "19.0.2",
    "@playwright/test": "1.49.1",
    "vitest": "2.1.8",
    "@vitejs/plugin-react": "4.3.4",
    "@vitest/ui": "2.1.8",
    "@vitest/coverage-v8": "2.1.8",
    "@testing-library/react": "16.1.0",
    "@testing-library/jest-dom": "6.6.3",
    "@testing-library/user-event": "14.5.2",
    "axios-mock-adapter": "2.1.0",
    "jsdom": "25.0.1",
    "tailwindcss": "4.0.0-beta.4",
    "@tailwindcss/postcss": "4.0.0-beta.4",
    "@tailwindcss/typography": "0.5.15",
    "@tailwindcss/forms": "0.5.9",
    "postcss": "8.4.49",
    "autoprefixer": "10.4.20",
    "typescript": "5.7.2",
    "eslint": "9.17.0",
    "eslint-config-next": "15.1.0",
    "@insurtech/eslint-config": "workspace:*",
    "rimraf": "6.0.1",
    "lighthouse": "12.3.0",
    "tsx": "4.19.2"
  }
}
```

### 17.9 `repo/apps/web-broker/src/lib/logger.ts` (extensions Sprint 16, ~75 lignes)

```typescript
/**
 * Logger client+server compat -- Pino-equivalent
 * Reference : 00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md (Tache 4.3.1)
 *
 * Cote server : pino direct.
 * Cote client : pino/browser ou fallback console structured.
 * Cote edge runtime (middleware) : console.* direct (pino non compatible Edge).
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

interface LogContext {
  component?: string;
  userId?: string;
  tenantId?: string;
  traceId?: string;
  [key: string]: unknown;
}

interface Logger {
  debug: (ctx: LogContext, msg: string) => void;
  info: (ctx: LogContext, msg: string) => void;
  warn: (ctx: LogContext, msg: string) => void;
  error: (ctx: LogContext, msg: string) => void;
  fatal: (ctx: LogContext, msg: string) => void;
}

function makeBrowserLogger(): Logger {
  const send = (level: LogLevel, ctx: LogContext, msg: string) => {
    const entry = {
      level,
      msg,
      time: new Date().toISOString(),
      ...ctx,
      app: 'web-broker',
    };
    if (process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_DEBUG === 'true') {
      const consoleFn = level === 'error' || level === 'fatal'
        ? console.error
        : level === 'warn'
          ? console.warn
          : console.info;
      consoleFn.call(console, JSON.stringify(entry));
    }
    // Production : send to Sentry breadcrumb
    if (typeof window !== 'undefined' && (window as any).Sentry) {
      (window as any).Sentry.addBreadcrumb({
        category: ctx.component ?? 'general',
        message: msg,
        level: level === 'fatal' ? 'fatal' : level,
        data: ctx,
      });
    }
  };
  return {
    debug: (ctx, msg) => send('debug', ctx, msg),
    info: (ctx, msg) => send('info', ctx, msg),
    warn: (ctx, msg) => send('warn', ctx, msg),
    error: (ctx, msg) => send('error', ctx, msg),
    fatal: (ctx, msg) => send('fatal', ctx, msg),
  };
}

export const logger: Logger = typeof window === 'undefined'
  ? makeBrowserLogger() // SSR side currently uses same impl (Pino added in instrumentation.ts)
  : makeBrowserLogger();
```

### 17.10 `repo/apps/web-broker/src/lib/crypto-id.ts` (~30 lignes)

```typescript
/**
 * Crypto ID generator -- compat Edge + Browser + Node
 * Reference : 00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md (Tache 4.3.1)
 *
 * Wraps crypto.randomUUID() with polyfill fallback.
 */

export function generateCryptoId(): string {
  // Edge Runtime + Node 19+ + modern browsers
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback : RFC 4122 v4 manual
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
```

### 17.11 Pattern d'usage Server Component routes protegees (exemple Sprint 16 tache 4.3.4)

```typescript
/**
 * Example consumption pattern -- Sprint 16 tache 4.3.4 dashboard page
 * Demontre comment les Server Components consomment les helpers livres ici.
 */
import { requireSession, requireTenant } from '@/lib/auth/session';
import { apiServerGet } from '@/lib/api-client.server';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { AppLocale } from '@/lib/i18n/config';

interface DashboardPageProps {
  params: Promise<{ locale: AppLocale }>;
  searchParams: Promise<{ date_start?: string; date_end?: string }>;
}

export default async function DashboardPage({ params, searchParams }: DashboardPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await requireSession();
  const tenantId = await requireTenant();
  const sp = await searchParams;
  const t = await getTranslations({ locale, namespace: 'dashboard' });

  // Server-side data fetch (utilise cookies + tenant + auth auto-injected)
  const widgets = await apiServerGet<DashboardWidgets>('/api/v1/analytics/dashboard', {
    searchParams: {
      date_start: sp.date_start,
      date_end: sp.date_end,
    },
  });

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <h1 className="text-2xl font-bold">{t('title', { name: session.displayName ?? '' })}</h1>
      {/* widgets render */}
    </div>
  );
}

interface DashboardWidgets {
  revenue: { total: number; series: Array<{ month: string; value: number }> };
  conversion: { lead_count: number; won_count: number };
  polices: { active: number; per_branche: Record<string, number> };
}
```

### 17.12 Pattern d'usage Client Component pages auth (exemple Sprint 16 tache 4.3.2)

```typescript
/**
 * Example consumption pattern -- Sprint 16 tache 4.3.2 login page
 * Demontre comment les Client Components consomment api-client + useSession.
 */
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

import { apiPost } from '@/lib/api-client';
import { useTenantStore } from '@/store/tenant-store';
import { useSessionStore } from '@/store/session-store';
import type { UserSession } from '@/types/session';

const SignInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  remember_me: z.boolean().default(false),
});

type SignInForm = z.infer<typeof SignInSchema>;

interface SignInResponse {
  needs_mfa: boolean;
  mfa_challenge_token?: string;
  session?: UserSession;
  tenants?: Array<{ id: string; name: string }>;
}

export default function LoginPage() {
  const router = useRouter();
  const t = useTranslations('auth');
  const [loading, setLoading] = useState(false);
  const setSession = useSessionStore((s) => s.setSession);
  const setTenantId = useTenantStore((s) => s.setTenantId);

  const form = useForm<SignInForm>({
    resolver: zodResolver(SignInSchema),
    defaultValues: { email: '', password: '', remember_me: false },
  });

  async function onSubmit(values: SignInForm) {
    setLoading(true);
    try {
      const response = await apiPost<SignInResponse, SignInForm>(
        '/api/v1/auth/signin',
        values
      );
      if (response.needs_mfa && response.mfa_challenge_token) {
        sessionStorage.setItem('mfa_challenge_token', response.mfa_challenge_token);
        router.push('/verify-mfa');
        return;
      }
      if (response.session) {
        setSession(response.session);
        if (response.session.tenantId) {
          setTenantId(response.session.tenantId);
        }
      }
      toast.success(t('signin_success'));
      if (response.tenants && response.tenants.length > 1) {
        router.push('/select-tenant');
      } else {
        router.push('/dashboard');
      }
    } catch (err: any) {
      toast.error(err?.message ?? t('signin_error'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      {/* fields */}
    </form>
  );
}
```

### 17.13 Pattern d'usage RBAC UI conditionnel (exemple Sprint 16 tache 4.3.12)

```typescript
/**
 * Example consumption pattern -- Sprint 16 tache 4.3.12 RBAC UI
 * Demontre comment les Client Components verifient permissions via session-store.
 */
'use client';
import { useSession } from '@/components/auth/session-provider';
import { useSessionStore } from '@/store/session-store';

interface HasPermissionProps {
  permission: string | string[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function HasPermission({ permission, fallback = null, children }: HasPermissionProps) {
  const hasAny = useSessionStore((s) => s.hasAnyPermission);
  const hasAll = useSessionStore((s) => s.hasAllPermissions);
  const list = Array.isArray(permission) ? permission : [permission];
  if (!hasAny(list)) return <>{fallback}</>;
  return <>{children}</>;
}

interface HasRoleProps {
  role: string | string[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function HasRole({ role, fallback = null, children }: HasRoleProps) {
  const hasRole = useSessionStore((s) => s.hasRole);
  if (!hasRole(role)) return <>{fallback}</>;
  return <>{children}</>;
}

// Usage example dans une Sidebar (Sprint 16 tache 4.3.3) :
// <HasRole role="broker_admin">
//   <SidebarItem href="/parametres" label="Parametres" />
// </HasRole>
```

### 17.14 Script `repo/scripts/validate-i18n-keys.ts` extensions Sprint 16 (~85 lignes)

```typescript
/**
 * Script CI -- validate i18n keys parity cross locales
 * Reference : 00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md (Tache 4.3.1)
 *
 * Usage : pnpm tsx scripts/validate-i18n-keys.ts --app web-broker
 *
 * Verifie que toutes les cles dans fr.json existent dans ar-MA.json + ar.json.
 * Echoue avec exit 1 si difference detectee.
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const appIndex = args.indexOf('--app');
const app = appIndex >= 0 ? args[appIndex + 1] : 'web-broker';

const messagesDir = resolve(__dirname, `../apps/${app}/src/messages`);
const locales = ['fr', 'ar-MA', 'ar'] as const;

function flattenKeys(obj: any, prefix = ''): string[] {
  const keys: string[] = [];
  for (const k of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
      keys.push(...flattenKeys(obj[k], fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

function checkEmoji(value: string, keyPath: string, locale: string): string[] {
  const emojiRegex = /[\u{1F000}-\u{1FFFF}]|[\u{2600}-\u{27BF}]/u;
  if (emojiRegex.test(value)) {
    return [`[EMOJI] ${locale} key=${keyPath} value="${value}"`];
  }
  return [];
}

let errors: string[] = [];
const allKeys: Record<string, string[]> = {};

for (const locale of locales) {
  const path = join(messagesDir, `${locale}.json`);
  try {
    const content = JSON.parse(readFileSync(path, 'utf-8'));
    allKeys[locale] = flattenKeys(content);
    // Check no-emoji decision-006
    const checkValues = (obj: any, prefix = '') => {
      for (const k of Object.keys(obj)) {
        const fullKey = prefix ? `${prefix}.${k}` : k;
        if (typeof obj[k] === 'string') {
          errors.push(...checkEmoji(obj[k], fullKey, locale));
        } else if (typeof obj[k] === 'object' && obj[k] !== null) {
          checkValues(obj[k], fullKey);
        }
      }
    };
    checkValues(content);
  } catch (err) {
    errors.push(`[PARSE ERROR] ${locale}: ${(err as Error).message}`);
  }
}

const referenceKeys = new Set(allKeys.fr ?? []);
for (const locale of ['ar-MA', 'ar'] as const) {
  const localeKeys = new Set(allKeys[locale] ?? []);
  for (const key of referenceKeys) {
    if (!localeKeys.has(key)) errors.push(`[MISSING KEY] ${locale}: ${key}`);
  }
  for (const key of localeKeys) {
    if (!referenceKeys.has(key)) errors.push(`[EXTRA KEY] ${locale}: ${key}`);
  }
}

if (errors.length > 0) {
  console.error(`i18n validation FAILED -- ${errors.length} errors:`);
  errors.forEach((e) => console.error(`  ${e}`));
  process.exit(1);
}
console.log(`i18n validation OK -- ${app} : ${referenceKeys.size} keys parite verifiee cross fr/ar-MA/ar.`);
```

### 17.15 Script `repo/scripts/check-no-emoji.sh` (~30 lignes)

```bash
#!/usr/bin/env bash
# decision-006 NO EMOJI ABSOLU -- enforcement CI + pre-commit
# Reference : 00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md (Tache 4.3.1)

set -e

TARGET="${1:-.}"

echo "[check-no-emoji] scanning $TARGET"

# Unicode emoji ranges :
#   U+1F000-U+1FFFF (most emoji)
#   U+2600-U+27BF (misc symbols + dingbats)
#   U+1F300-U+1F5FF, U+1F600-U+1F64F, U+1F680-U+1F6FF, U+1F700-U+1F77F
# Allowed : accents francais, caracteres arabes Naskh, ponctuation standard

FOUND=$(grep -rP "[\x{1F000}-\x{1FFFF}\x{2600}-\x{27BF}\x{1F300}-\x{1F77F}]" \
  --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" \
  --include="*.json" --include="*.md" --include="*.mdx" \
  --include="*.yml" --include="*.yaml" --include="*.sh" \
  --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=coverage \
  --exclude-dir=.git --exclude-dir=playwright-report \
  "$TARGET" 2>/dev/null || true)

if [ -n "$FOUND" ]; then
  echo "[check-no-emoji] ERROR -- emoji detected (decision-006 violated) :"
  echo "$FOUND" | head -20
  exit 1
fi

echo "[check-no-emoji] OK -- aucun emoji detecte (decision-006 respectee)"
```

### 17.16 Pieges techniques additionnels (PT16-PT25)

**PT16 -- `redirect()` Next.js 15 throws (n'est pas return)** : `redirect('/login')` jette une `NEXT_REDIRECT` error qui est interceptee par le framework. Si on l'enveloppe dans un `try/catch` generique, on intercepte par erreur. Mitigation : ne JAMAIS try/catch global autour de Server Components qui appellent redirect. Si besoin try/catch local, re-throw si error name === 'NEXT_REDIRECT'.

**PT17 -- middleware Edge Runtime non-deterministe sans `experimental.dynamicIO`** : sans config, Next.js peut cacher la response middleware pour le meme path. Mitigation : ne PAS appeler `NextResponse.next({ headers: ... })` avec un identifiant unique sans aussi forcer dynamic. Pour cette tache, les headers x-tenant-id varient par cookie -> Next.js doit invalider automatique, mais a verifier en CI.

**PT18 -- `await cookies()` dans une fonction sync** : Next.js 15 cookies() est async. Si on oublie await -> retourne Promise<ReadonlyRequestCookies> que TypeScript permet d'utiliser comme objet (any cast) -> runtime undefined.cookie.get. Mitigation : strict TS + ESLint rule `@typescript-eslint/no-floating-promises`.

**PT19 -- Date.now() server VS client decales** : tests Vitest avec `vi.setSystemTime` impacte uniquement le contexte test. Si on mock JWT exp avec une heure precise, le test peut casser si fuseau machine diff. Mitigation : toujours utiliser UTC dans tests (`new Date('2026-05-15T10:00:00Z')`).

**PT20 -- next-intl `getMessages` cote Server peut renvoyer mauvais cache** : Next.js 15 caching defaults `no-store` mais next-intl peut cacher messages en interne. Si on edit fr.json et reload, messages anciens. Mitigation : restart dev server apres edit messages (HMR partial sur JSON).

**PT21 -- `setRequestLocale` obligatoire avant `getTranslations`** : sinon `MISSING_LOCALE` runtime. Convention : premiere ligne apres `await params` dans tout Server Component.

**PT22 -- HydrationBoundary deserialise les Date objects en string** : si on prefetch `{ session: { expiresAt: new Date() }}`, cote client `useQuery` retourne `{ expiresAt: '2026-...' }` (string). Mitigation : normaliser ISO string cote serveur AVANT dehydrate.

**PT23 -- Sentry init double via React Strict Mode dev** : Strict Mode monte 2x les effects. `Sentry.init` 2x = warning. Mitigation : `useRef` flag `sentryInitialized.current = true` apres premier init.

**PT24 -- Cookie `secure: true` echoue en dev http** : si `secure: true` toujours, dev `http://localhost:3001` ne peut pas set cookie. Mitigation : `secure: isProd` (false en dev).

**PT25 -- `dehydrate(queryClient)` ne serialise pas Error objects** : si une query a `error: new Error(...)`, dehydrate met `error: {}`. Mitigation : pour queries qui peuvent fail (apiServerGet), wrap try/catch + return null, jamais throw.

### 17.17 Edge cases supplementaires (EC13-EC20)

**EC13 -- IPv6 cookies par defaut domain** : si user accede `http://[::1]:3001` au lieu de `http://localhost:3001`, cookies set sur localhost ne sont pas vus. Mitigation : middleware accepte les deux + cookie domain auto-detect.

**EC14 -- Cookie size limit 4 KB** : JWT compact peut atteindre 1-2 KB. Si JWT plus refresh + tenant + locale + autres cookies depasse 4 KB par domain, browser drop. Mitigation : JWT minimaliste (juste sub + role + permissions[] court + exp). Permissions complete viennent /auth/me.

**EC15 -- Backend retourne `tenant_id` different de cookie current_tenant_id** : edge case suite a desync. Mitigation : api-client privilegie cookie/zustand. Backend doit valider que x-tenant-id correspond bien a un membership user.

**EC16 -- Refresh token revoked mid-session** : admin revoke session backend. Prochain refresh -> 401. Mitigation : clear cookies + redirect login + toast "Session revoquee".

**EC17 -- User change role pendant session** : admin retire role broker_admin. Cache permissions cote client (zustand) est obsolete. Mitigation : polling `/auth/me` every 5min (SessionProvider refetchInterval) sync permissions. Backend en plus rejette 403 sur action retiree.

**EC18 -- Multi-tab login simultane** : user ouvre 2 onglets sur /login, soumet les 2. Premier succes set cookies, second succes set cookies (avec autre session ID). Race condition. Mitigation : backend Sprint 5 deduplicate ou les 2 sessions co-existent (refresh_token rotation invalide la premiere apres second refresh).

**EC19 -- Cookie SameSite=strict avec OAuth callback** : si Sprint 21+ ajoute OAuth (Google), callback redirect 3rd party -> SameSite=strict perdrait cookies. Mitigation : `sameSite: 'lax'` accepte (deja le cas access_token + tenant_id).

**EC20 -- DNS resolve Atlas Cloud failure prod** : `api.skalean-insurtech.ma` DNS unavailable. App entiere KO. Mitigation : Cloudflare CDN cache + health check endpoint Atlas Cloud SOC alerte + DC2 failover (decision-008 Tier IV).

### 17.18 Mapping endpoints API consommes par cette tache

| Endpoint backend NestJS | Methode | Consume par | Notes |
|--------------------------|---------|--------------|-------|
| `/api/v1/auth/refresh` | POST | `/api/auth/refresh` proxy | Sprint 5 -- rotation refresh_token |
| `/api/v1/auth/signout` | POST | `/api/auth/signout` proxy | Sprint 5 -- revoke session + audit |
| `/api/v1/auth/me` | GET | `/api/auth/me` proxy | Sprint 5 + Sprint 7 -- user + permissions |
| `/api/v1/tenants/me` | GET | `/api/auth/switch-tenant` validation | Sprint 6 -- memberships user |
| `/api/v1/auth/signin` | POST | Sprint 16 tache 4.3.2 (api-client direct) | NOT consume cette tache |
| `/api/v1/auth/signup` | POST | Sprint 16 tache 4.3.2 | NOT consume cette tache |
| `/api/v1/auth/verify-mfa` | POST | Sprint 16 tache 4.3.2 | NOT consume cette tache |

### 17.19 Performance attendue

| Metrique | Cible (dev) | Cible (prod Atlas Cloud) | Failure threshold |
|----------|-------------|---------------------------|-------------------|
| App boot port 3001 | < 8s | < 4s | > 15s = fail |
| First contentful paint /fr | < 1.5s | < 0.8s | > 3s = fail |
| Time to interactive /fr | < 2.5s | < 1.5s | > 5s = fail |
| Middleware execution (Edge) | < 30ms p95 | < 20ms p95 | > 100ms = fail |
| API refresh route | < 200ms p95 | < 100ms p95 | > 500ms = fail |
| Bundle First Load JS /fr | < 250 KB | < 200 KB | > 400 KB = fail |
| Coverage Vitest | >= 80% | >= 85% | < 70% = fail |
| Lighthouse Performance | >= 70 | >= 85 | < 60 = fail |
| Lighthouse Accessibility | >= 90 | >= 95 | < 85 = fail |

### 17.20 Conformite Skalean Brand Sofidemy

Cette tache respecte le brand kit Sofidemy :

- **Palette appliquee** dans `@insurtech/shared-ui/tailwind-preset` (deja Sprint 4) :
  - `--color-primary` = `#E95D2C` (Orange Sofidemy)
  - `--color-secondary` = `#1A2730` (Navy Sofidemy)
  - `--color-accent` = `#B0CEE2` (Sky Blue)
  - `--color-acaps` = `#2D5773` (ACAPS Teal)
- **Theme color viewport** : light `#FFFFFF`, dark `#1A2730` Navy.
- **Toaster Sonner** : `richColors` activate, theme `system` adapte light/dark.
- **Fonts** :
  - `--font-montserrat` corps latin (300-900) -- couleur principale UI.
  - `--font-arabic` Noto Naskh Arabic (400-700) -- corps ar/ar-MA.
  - `--font-mono` Geist Mono -- code (404 pages, debug, code snippets).
- **Logo** : `/icons/skalean-logo.svg` mono Orange (decision-006 -- pas d'emoji, glyphes SVG legibles).

### 17.21 Verification finale "Definition of Done"

- [ ] V1-V15 P0 tous PASSED (15/15)
- [ ] V16-V23 P1 minimum 6/8 PASSED
- [ ] V24-V28 P2 minimum 3/5 PASSED
- [ ] `pnpm --filter @insurtech/web-broker typecheck` -> exit 0
- [ ] `pnpm --filter @insurtech/web-broker lint --max-warnings 0` -> exit 0
- [ ] `pnpm --filter @insurtech/web-broker test` -> 100% pass + coverage > 80%
- [ ] `pnpm --filter @insurtech/web-broker test:e2e` -> 100% pass chromium
- [ ] `bash scripts/check-no-emoji.sh repo/apps/web-broker/` -> exit 0
- [ ] `pnpm tsx scripts/validate-i18n-keys.ts --app web-broker` -> exit 0
- [ ] `pnpm --filter @insurtech/web-broker build` -> production build success
- [ ] PR review approved >= 2 reviewers (CTO Saad + 1 senior fullstack)
- [ ] Merge dans `main` via squash + delete branch
- [ ] Tag commit avec metadata Conventional Commits
- [ ] Update `00-pilotage/runbook/sprint-16-progress.md` -> "Tache 4.3.1 DONE"
- [ ] Notify Slack #skalean-insurtech-dev channel commit hash + V1-V28 summary

---
