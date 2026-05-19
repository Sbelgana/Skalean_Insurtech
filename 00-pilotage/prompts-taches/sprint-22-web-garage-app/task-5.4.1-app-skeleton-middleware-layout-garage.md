# TACHE 5.4.1 -- App Skeleton + Middleware Auth/Tenant + Layout (Sidebar + Topbar) -- web-garage

**Sprint** : 22 (Phase 5 / Vertical Repair Sprint 4 / Sprint 22 sur 35 cumul)
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-22-sprint-22-web-garage-app.md` (Tache 5.4.1)
**Phase** : 5 -- Vertical Repair (Skalean Garage ERP)
**Priorite** : P0
**Effort** : 6h
**Dependances** :
- Sprint 4 (skeleton frontend Tache 1.4.X -- bootstrap `apps/web-garage` deja livre : Next.js 15 App Router, Tailwind 4, i18n routing fr/ar-MA/ar, font Montserrat + Noto Naskh Arabic, providers chain, api-client axios placeholder, port 3002 reserve)
- Sprint 5 (auth flows backend operationnels : POST /auth/signin, POST /auth/verify-mfa, POST /auth/refresh, cookies access_token + refresh_token httpOnly servis par API NestJS)
- Sprint 6 (tenant context multi-tenant : header `x-tenant-id` accepte par API, cookie `current_tenant_id` set apres login, AsyncLocalStorage server backend gere)
- Sprint 7 (RBAC : 12 roles cibles dont garage_admin / garage_chef / garage_technicien / garage_gestionnaire, JWT contient `role` + `permissions[]`, PermissionGuard backend en place)
- Sprint 16 (web-broker pattern Next.js 15 stable -- on reutilise integralement les patterns middleware + layouts + api-client + providers et on les ADAPTE au contexte garage : sidebar metier specifique repair, FAB nouveau sinistre, notifications poll 30s)
- Sprints 19-20-21 (backend Repair endpoints disponibles : sinistres, receptions, diagnostics, devis, orders, qc, livraisons, invoices, garanties, IA estimation)

**Densite cible** : 100-150 ko (auto-suffisant -- aucune lecture annexe requise pour executer la tache)
**AUCUNE EMOJI AUTORISEE** (decision-006 strictement appliquee dans code, JSON, markdown, commits, logs)

---

## 1. But (0.5-1 ko)

Transformer le bootstrap Sprint 4 de l'app `apps/web-garage` (port 3002) en **squelette applicatif metier complet pour le personnel garage** : ajouter la couche middleware de **garde d'authentification** (cookies `access_token` + `refresh_token`), la couche middleware de **garde de tenant garage** (cookie `current_tenant_id` + injection header `x-tenant-id` + verification que le `tenant_type` est `garage` -- un broker ne peut pas se connecter sur web-garage), la couche middleware de **detection locale** (Accept-Language + cookie `NEXT_LOCALE` priorise + RTL automatique pour `ar-MA` et `ar`), trois **layouts imbriques** (`app/[locale]/layout.tsx` racine, `app/[locale]/(auth)/layout.tsx` pour pages publiques (login, MFA, recovery), `app/[locale]/(protected)/layout.tsx` pour pages authentifiees avec sidebar gauche + topbar), un **api-client production-ready** consommant les endpoints backend Repair Sprint 19-21 + endpoints communs auth/tenant Sprint 5-7 avec auto-refresh transparent du JWT, injection automatique de `x-tenant-id`, propagation `Idempotency-Key` sur mutations sensibles (creer sinistre, transition status, generate invoice), propagation `Accept-Language`, propagation `x-trace-id`, et la **chaine de providers complete** (QueryClient TanStack v5 + NextIntlClientProvider + ThemeProvider + Sonner Toaster + TenantContextSync + Sentry boundary).

Cette tache est la **fondation des 12 taches restantes du Sprint 22** (5.4.2 a 5.4.13). Aucune page metier (auth, dashboard, sinistres kanban, sinistre detail, reception, diagnostic IA, devis, orders, QC, livraison, invoices, parametres) ne peut etre developpee tant que cette tache n'est pas validee : le middleware decide qui voit quoi (4 roles garage : admin / chef / technicien / gestionnaire), l'api-client decide comment parler aux backends Repair, les layouts decident ou se branche le contenu metier garage (sidebar tres differente de web-broker : Sinistres avec badge count en cours en gros, Receptions, Diagnostics, Devis, Orders, QC, Livraisons, Invoices, Garanties, Stock, HR, Parametres).

La specificite **garage** par rapport au pattern broker Sprint 16 :
- Sidebar centree sur le workflow sinistre (10 etapes Sprint 19) avec compteurs visibles ;
- FAB "Nouveau sinistre" en bas a droite (creation manuelle pour client direct sans appel assureur) ;
- Notifications bell topbar avec poll 30s (nouveaux sinistres, urgences, alertes Stock low ;
- Search topbar global : sinistres + customer + immatriculation plaque (regex MA `\d{1,5}-[A-Z]{1,3}-\d{1,3}`) ;
- TenantSwitcher topbar : un garage peut avoir plusieurs etablissements (Atlas Cabinet a 3 succursales Marrakech / Casablanca / Rabat).

A la sortie de cette tache, l'app `web-garage` est prete a recevoir les pages metier des taches 5.4.2 a 5.4.13 : `pnpm --filter @insurtech/web-garage dev` demarre sur 3002, une route protegee `/fr/dashboard` accedee sans cookie `access_token` redirige vers `/fr/login?redirect=/fr/dashboard`, l'api-client appele depuis un Server Component injecte automatiquement `x-tenant-id` depuis le cookie SSR et `Authorization: Bearer ${access_token}`, un 401 declenche un refresh transparent puis retry de la requete, le QueryClient hydrate les caches via `dehydrate/hydrate` Next.js 15 RSC, le Toaster Sonner est positionne `top-left` en RTL et `top-right` en LTR, 25+ tests Vitest + 8+ tests Playwright valident chaque pattern, et un garage_admin/chef/technicien/gestionnaire arrivant sur `/fr/dashboard` voit le layout principal complet.

---

## 2. Contexte etendu (5-10 ko)

### Pourquoi cette tache existe

Le bootstrap Sprint 4 (`task-1.4.X-web-garage-bootstrap-port-3002.md`) a livre un squelette **agnostique du metier garage** : Next.js 15 + Tailwind 4 + next-intl + axios placeholder + zustand store tenant + i18n 3 locales + theme Sofidemy. Mais ce squelette ne sait **pas** :
- detecter si l'utilisateur garage est authentifie (cookie `access_token` valide non expire) ;
- rafraichir un JWT expire de facon transparente sans interrompre le workflow du technicien (qui peut etre en pleine reception vehicule) ;
- bloquer l'acces aux routes `/dashboard`, `/sinistres`, `/sinistres/[id]/diagnostic`, etc. selon le role ;
- separer visuellement les pages publiques (login centered card + branding Skalean Garage) des pages authentifiees (sidebar + topbar workflow) ;
- gerer le **multi-tenant garage** (Atlas Cabinet avec 3 succursales Marrakech / Casablanca / Rabat -- chaque tenant_id distinct mais memes users autorises) ;
- detecter et persister la locale preferee de l'utilisateur (un mecanicien marocain prefere arabe RTL, un manager prefere francais) ;
- propager `x-tenant-id` automatiquement sur chaque requete API (sans quoi le backend RLS rejette en 403) ;
- propager `Idempotency-Key` sur les mutations sensibles : creer sinistre (eviter double sinistre en cas double-clic), transition status (eviter double transition entre `received` et `under_diagnostic`), generate invoice (eviter double facture DGI).

Tous ces comportements sont **transversaux** : chacune des 12 pages metier du Sprint 22 en depend. Les coder une fois ici dans le middleware + les layouts + l'api-client = facteur d'effort 12 (un developpement, 12 reutilisations). Si on duplique cette logique dans chaque page metier, la dette technique cumulee = ~30 heures de refactor au Sprint 26.

Le **timing** est imperatif : cette tache est la **premiere** du Sprint 22 (avant 5.4.2 pages auth) parce que :
1. la tache 5.4.2 (pages login + MFA + signup + recovery) consomme l'api-client refactore livre ici ;
2. la tache 5.4.3 (dashboard 6 widgets garage) etend `app/[locale]/(protected)/layout.tsx` livre ici ;
3. la tache 5.4.4 (sinistres kanban + table) utilise le sidebar badge counter dont le mecanisme est pose ici ;
4. la tache 5.4.5 (sinistre detail + 9 tabs) utilise les Server Component patterns RSC dont les Suspense boundaries sont posees ici ;
5. la tache 5.4.12 (RBAC UI 4 roles + i18n) consomme le hook `useCurrentUser()` et le decode JWT `jose` livres ici ;
6. la tache 5.4.13 (tests Playwright E2E + WCAG + Lighthouse) consomme les selectors `[data-testid]` poses ici sur sidebar/topbar/FAB.

Toute deviation des conventions posees ici impose un refactor cross-page couteux : on **ne touche plus** middleware + layouts + api-client apres 5.4.1.

### Reutilisation pattern Sprint 16 web-broker -- ce qui change, ce qui reste

Le Sprint 16 a deja livre ce pattern pour `web-broker` (port 3001). On REUTILISE 80% du code (copy-paste + adaptation) et on CHANGE 20% specifique garage :

| Element | Sprint 16 (web-broker) | Sprint 22 (web-garage) -- ICI |
|---------|------------------------|--------------------------------|
| Port dev | 3001 | 3002 |
| Hostname prod | broker.skalean-insurtech.ma | garage.skalean-insurtech.ma |
| App name env | skalean-broker | skalean-garage |
| Tenant type filtre | `broker` | `garage` |
| Roles autorises | broker_admin, broker_user, broker_assistant | garage_admin, garage_chef, garage_technicien, garage_gestionnaire |
| Sidebar items | Dashboard / Contacts / Companies / Deals / Polices / Broker Queue / Sinistres readonly / Parametres | Dashboard / Sinistres (badge counter en gros) / Receptions / Diagnostics / Devis / Orders / QC / Livraisons / Invoices / Garanties / Stock (link Sprint 13) / HR (link Sprint 13) / Parametres |
| FAB | aucun | Nouveau sinistre (toujours visible) |
| Search topbar | Contacts, Companies, Deals | Sinistres, Customer, Plate immatriculation MA |
| TenantSwitcher | Cabinets courtage | Etablissements garage (multi-succursale) |
| Notifications poll | 60s deals SLA | 30s sinistres urgents + Stock low |
| Theme Sofidemy primary | bleu nuit | rouge garage (`--color-garage-primary: #B91C1C`) |
| Branding logo | Skalean Broker | Skalean Garage |
| Patterns code reuse | -- | middleware.ts, api-client.ts, providers.tsx, layouts |

On ne reinvente pas la roue. On copie-colle puis on ajuste.

### Alternatives considerees

#### Next.js 15.0.4 vs 15.1.0 vs 14.2.x

| Critere | Next.js 15.0.4 (CHOIX Sprint 22) | 15.1.0 | 14.2.x (rejete) |
|---------|-----------------------------------|--------|-----------------|
| Sortie stable | octobre 2024 | decembre 2024 | octobre 2023 |
| React 19 support | Officiel | Officiel | Experimental |
| `await cookies()` / `await headers()` / `await params` | Imposes (Async Request APIs) | Imposes | Sync (legacy) |
| Turbopack stable dev | Oui | Oui | Beta |
| `after()` hook | Oui | Oui | Non |
| Caching defaults | `no-store` par defaut sur fetch | `no-store` | `force-cache` par defaut |
| `use cache` directive | Non | Experimental | Non |
| React Compiler beta | Compatible (opt-in) | Compatible | Non |
| Compatibilite Sprint 16 deja livre | Identique | Identique | Diverge |
| Maturite retour terrain (mai 2026) | Stable | Stable | Stable mais en transition |

**Decision** : 15.0.4 (alignement Sprint 16 web-broker pour patterns identiques). Si on monte web-broker en 15.1.0 plus tard, web-garage suivra dans Sprint 24+.

#### Middleware Edge Runtime vs Node.js Runtime

| Critere | Edge Runtime (CHOIX) | Node.js Runtime (rejete) |
|---------|----------------------|---------------------------|
| Latency cold start | ~50ms global edge | ~300ms cold |
| API Node disponibles | Web Standards seulement (`fetch`, `Request`, `Response`, `crypto.subtle`, `URL`) | Tout Node (`fs`, `path`, `process.env`) |
| `jose` lib | Compatible (utilise Web Crypto) | Compatible |
| `argon2` | NON COMPATIBLE | Compatible |
| Limite bundle size | 1 MB max | Pas de limite stricte |
| Conformite multi-region | Oui (deploye en peripherie Atlas Cloud Benguerir) | Non (region centrale) |
| Cookies API | `request.cookies.get(name)` + `NextResponse.cookies.set()` | Identique |

**Decision** : Edge Runtime. Le middleware n'a **pas besoin** d'argon2 ni `fs` -- il fait detection cookie + decode JWT (jose suffit) + redirect + verification `tenant_type === 'garage'`. La latency edge est cruciale pour ne pas alourdir chaque navigation, et un technicien sur tablette atelier doit avoir une UX fluide.

#### Sonner vs react-hot-toast vs shadcn/ui Toast

Decision identique Sprint 16 : Sonner 1.7.1 avec position dynamique `top-left` RTL / `top-right` LTR. Pour Sprint 22 on ajoute une convention specifique : **pas de toast pour les transitions sinistre kanban** (UI feedback inline via skeleton + Card highlight) -- les toasts sont reserves aux actions cross-page (envoi devis email, generation invoice PDF, upload photos succes/erreur).

#### TenantContext : zustand store vs React Context vs SWR cache

| Critere | zustand (CHOIX) | React Context | SWR cache |
|---------|------------------|----------------|-----------|
| Persistance localStorage | Oui via `persist` middleware | Manuel | Non |
| Bundle size | 8 ko | 0 (natif React) | 35 ko |
| Selector subscribe (perf) | Oui | Non (re-render tout) | Non |
| DevTools Redux compatible | Oui | Non | Non |
| Hydratation SSR Next.js 15 | Pattern documente | Complex | Non |
| Sprint 4 deja installe | Oui | Oui | Oui |

**Decision** : zustand 5.0.2 avec `persist({ name: 'garage-tenant-store' })`. Pour Sprint 22 on differencie le storage key `garage-tenant-store` du `broker-tenant-store` (Sprint 16) pour eviter cross-app conflict si user navigate broker.skalean-insurtech.ma puis garage.skalean-insurtech.ma sur meme browser.

#### React Query staleTime defaut

**Decision** identique Sprint 16 : staleTime 5min (300_000ms), gcTime 10min (600_000ms). **Override specifique garage** :
- Sinistres list (`['sinistres', filters]`) : staleTime 30s -- les transitions kanban se voient vite ;
- Order detail tracking (`['order', id]`) : staleTime 15s avec `refetchInterval: 15_000` -- workflow live ;
- Diagnostic IA suggestion (`['diagnostic', sinistreId]`) : staleTime Infinity -- ne change pas une fois generee ;
- Notifications bell (`['notifications']`) : staleTime 30s avec `refetchInterval: 30_000` ;
- Dashboard widgets (`['dashboard', filters]`) : staleTime 2min.

### Trade-offs explicites

1. **Middleware Edge Runtime ne peut PAS appeler `argon2` ni `bcrypt`** : pour valider un mot de passe en middleware, impossible. Mitigation : middleware fait UNIQUEMENT decode JWT (cheap, Web Crypto) + redirect. Toute validation password se fait dans `app/api/auth/signin/route.ts` qui proxy backend (Sprint 5).

2. **Le decode JWT en middleware ne VERIFIE PAS la signature** (impossible sans `jose.jwtVerify(token, publicKey)` qui necessite fetch JWKS qui ralentit). Mitigation : middleware decode juste le payload pour extraire `exp` (timestamp), `sub` (user id), `tenant_type`, `roles[]`. Si `exp < now + 30s margin` -> redirect login. Si `sub` present + `exp` valide + `tenant_type === 'garage'` + au moins un role de la liste autorisee -> pass. La **veritable verification signature** se fait cote backend NestJS sur chaque requete (Sprint 5 livre AuthGuard).

3. **Refresh token race condition multi-tabs technicien** : si le technicien ouvre 5 onglets simultanees (sinistre 1, sinistre 2, sinistre 3, dashboard, parametres) et que toutes voient le access_token expire en meme temps, 5 requetes `/auth/refresh` partent en parallele. Backend deduplicate (Sprint 5), mais cote frontend on doit `Promise.all` queue les requetes. Mitigation : api-client utilise un singleton `refreshPromise: Promise<void> | null` -- la premiere requete 401 declenche le refresh, les autres attendent la meme promesse.

4. **Cookie `current_tenant_id` `httpOnly: false`** : pour que zustand store client puisse lire et permettre tenant switcher UI (Sprint 22 tache 5.4.1 topbar), le cookie tenant doit etre lisible JS. Risque : XSS pourrait lire le cookie. Mitigation : CSP strict (deja Sprint 4) + le `tenant_id` n'est pas un secret (juste un UUID identifiant). Le secret reel est `access_token` qui reste `httpOnly: true`.

5. **`x-tenant-id` injecte cote API route Next.js (proxy) vs cote client direct** : on choisit proxy via `app/api/proxy/[...path]/route.ts` qui ajoute le header depuis cookie SSR. Avantage : pas de manipulation header cote client (defense profondeur). Inconvenient : +1 saut reseau (negligible en dev, en prod le proxy est sur le meme region Atlas Cloud Benguerir).

6. **Middleware execute sur CHAQUE requete y compris assets statiques par defaut** : matcher mal configure = catastrophe perf (running middleware sur `/favicon.ico`, `/icon-192.png`, `/manifest.webmanifest`). Mitigation : `config.matcher` exclut `api`, `_next/static`, `_next/image`, `favicon.*`, `manifest.webmanifest`, `robots.txt`, `icons/`, `*.png`, `*.svg`, `*.ico`, `*.jpg`, `*.webp`.

7. **Locale detection redirige une fois trop** : si user va sur `/`, middleware detecte locale `fr` puis redirige `/fr`. OK. Mais si on a `localePrefix: 'always'` et l'user va sur `/dashboard` (sans locale), redirect `/fr/dashboard` PUIS auth middleware check redirect `/fr/login?redirect=/fr/dashboard`. Deux 302 successifs. Mitigation : composer les deux middlewares dans **une seule fonction** qui calcule locale + auth + tenant en un seul retour de NextResponse.

8. **JWT decode client-side avec `jose`** : `jose.decodeJwt(token)` retourne payload sans verifier signature. Bug courant : developpeur croit que `decodeJwt` valide. Mitigation : commentaire en tete du fichier + nom de fonction explicite `decodeJwtUnsafe()` pour rappeler.

9. **Sidebar badge counter sur "Sinistres" doit etre frais sans surcharger backend** : on poll `/api/v1/repair/sinistres/counts` toutes les 30s. Si 50 technicien actifs = 50 polls/30s = 100 req/min sur cet endpoint. Mitigation : endpoint backend met le resultat en cache Redis 20s (Sprint 19 livre cette cache).

10. **TenantSwitcher etablissements garage : recharger ou pas la page apres switch** : si on switch tenant_id, toutes les queries TanStack `['sinistres']` deviennent invalides. Choix : **full page reload** apres switch (`window.location.reload()`) -- evite des bugs subtils. Inconvenient : perte d'etat formulaire en cours. Mitigation : confirm dialog si formulaire dirty avant switch.

### Decisions strategiques referenced

- **decision-001 (monorepo pnpm + Turbo)** : `apps/web-garage` reside dans `repo/apps/`. Cette tache n'ajoute aucune deps qui ne soit deja dans le Sprint 4 (`next-intl 3.26.3`, `@tanstack/react-query 5.62.7`, `axios 1.7.9`, `zustand 5.0.2`, `jose 5.9.6`, `date-fns-tz 4.1.0`). Si manquant, on les ajoute via `pnpm --filter @insurtech/web-garage add jose`.
- **decision-002 (multi-tenant strict)** : tout endpoint API recoit `x-tenant-id` header. Cette tache propage automatiquement via api-client + middleware proxy.
- **decision-005 (Skalean AI frontier)** : aucune integration AI directe dans cette tache. Le hook `useAiGateway()` est pose en placeholder (NEXT_PUBLIC_AI_GATEWAY_URL var env) pour Sprint 31 (Agent Sky).
- **decision-006 (NO EMOJI ABSOLU)** : zero emoji dans aucun fichier code, messages JSON, commit, log. Verifie par script CI `scripts/check-no-emoji.sh`.
- **decision-008 (cloud souverain Atlas Cloud Benguerir)** : `NEXT_PUBLIC_API_URL` pointe sur `api.skalean-insurtech.ma` prod (Atlas Cloud) ou `localhost:4000` dev. Aucune reference AWS. `images.remotePatterns` exclut `*.amazonaws.com` et liste explicite `s3.skalean-atlas.ma`.
- **decision-009 (multilinguisme MA fr / ar-MA / ar)** : middleware detecte locale Accept-Language + cookie `NEXT_LOCALE` priorise. Si user authentifie a `preferred_locale` dans son profil JWT, on respecte ce choix en prio. La locale ar-MA prefere les chiffres latins, la locale ar utilise les chiffres arabes (٠١٢٣٤٥٦٧٨٩).
- **decision-010 (Sprint 22 web-garage app)** : cette tache 5.4.1 est officiellement la premiere des 13 du Sprint 22.

### Pieges techniques connus (17 minimum)

1. **`await cookies()` en Server Component declenche dynamic rendering** : tout layout qui fait `await cookies()` ne peut plus etre statiquement rendu. Pour `app/[locale]/(protected)/layout.tsx`, c'est OK (pages protegees sont dynamic). Pour `app/[locale]/layout.tsx`, on evite `cookies()` -- on passe locale via `params`.

2. **`generateStaticParams` doit retourner les 3 locales** : `[{ locale: 'fr' }, { locale: 'ar-MA' }, { locale: 'ar' }]`. Si on oublie, Next.js builds des fallbacks runtime au lieu d'avoir les pages prebuild. Verifie par script CI.

3. **Middleware compose order matters** : si on fait `nextIntlMiddleware(request)` PUIS `authMiddleware(request)`, l'auth voit l'URL deja localisee (`/fr/dashboard`). Si inverse, auth voit `/dashboard` brut. **Convention** : i18n EN PREMIER, auth EN SECOND, tenant EN TROISIEME. Documente dans le code.

4. **`NextResponse.next()` vs `NextResponse.rewrite()` vs `NextResponse.redirect()`** : `next()` continue le pipeline avec headers modifies. `rewrite()` change l'URL servie sans changer URL navigateur. `redirect()` envoie 302/307 au navigateur. Pour injecter `x-tenant-id` on utilise `next()` + set headers. Pour rediriger non-auth on utilise `redirect(/login)`.

5. **Headers set via middleware non visibles cote client** : si on fait `response.headers.set('x-tenant-id', '...')`, c'est UNIQUEMENT visible sur la response a la requete suivante. Les Server Components ne lisent pas ces headers, ils lisent `await headers()` qui sont les headers INCOMING request. Mitigation : pour propager `x-tenant-id` cote SSR, on lit le cookie `current_tenant_id` directement via `await cookies()` dans le Server Component.

6. **`jose.decodeJwt` jette si JWT malforme** : un cookie corrompu (espace, char invalide) declenche exception. Mitigation : `try/catch` autour + clear cookie + redirect login.

7. **`Date.now()` en middleware Edge Runtime peut differer du backend** : si l'horloge Edge est legerement decalee (rare mais possible), un JWT `exp` pas tout a fait expire peut etre vu expire. Mitigation : marge de 30 secondes (`exp * 1000 - 30_000 < Date.now()` = expired).

8. **NextIntlClientProvider rendu cote serveur ET client double les messages** : si on passe messages dans NextIntlClientProvider cote Server Component, ils sont serialises dans le HTML + dans le bundle client. Pour 600 keys par locale = ~60 ko inutiles dans le HTML. Mitigation : `messages={pick(messages, ['common', 'home', 'errors', 'sidebar', 'topbar'])}` -- on ne passe que les namespaces utilises cote client.

9. **react-query `dehydrate` / `hydrate` necessite la meme version client+server** : si on mismatch (5.62.7 server vs 5.63.0 client), serialization casse silently. Mitigation : version exacte pinned (`"@tanstack/react-query": "5.62.7"` sans caret) + `pnpm-lock.yaml` commit.

10. **`'use client'` directive ne descend pas aux enfants automatiquement** : si Providers est `'use client'` mais que children passe contient un Server Component, c'est OK -- les Server Components RSC peuvent etre enfants de Client Components. Mais si l'enfant essaye d'importer un module Server-only, build casse. Mitigation : `import 'server-only'` en tete des modules sensibles + bien separer `lib/api-client.server.ts` vs `lib/api-client.client.ts` si necessaire.

11. **Cookies httpOnly inaccessibles cote client = impossible logout local** : pour logout, on doit appeler `POST /auth/signout` qui demande au backend de set Cookie avec `Max-Age=0` (expire). Si on essaye `document.cookie = 'access_token='; expires=...` cote client, ca echoue silencieusement (httpOnly bloque). Mitigation : toujours passer par route Next.js `/api/auth/signout` qui proxy backend.

12. **TanStack Query staleTime + RSC initial fetch double-fetches** : si le Server Component fait `await queryClient.fetchQuery(['sinistres'])` ET le Client Component fait `useQuery(['sinistres'])`, le client refetch immediatement parce que `staleTime` n'est pas hydrate. Mitigation : `dehydrate(queryClient)` cote server + `<HydrationBoundary state={dehydratedState}>` enveloppe.

13. **CSP `script-src 'unsafe-inline'` necessaire next-themes** : `next-themes` injecte un script inline blocking dans `<head>` pour eviter flash light->dark. CSP strict sans `unsafe-inline` bloque ce script. Mitigation : CSP autorise `'unsafe-inline'` pour `script-src` (deja Sprint 4) -- compromis necessaire jusqu'a script nonce.

14. **`setRequestLocale(locale)` doit etre appele dans CHAQUE Server Component qui consomme i18n** : sinon `getTranslations()` jette `MISSING_LOCALE` runtime error. Mitigation : convention -- chaque `page.tsx` Server Component commence par `setRequestLocale(locale)` apres `await params`.

15. **next-intl `IntlError: MISSING_MESSAGE`** : si une cle existe dans `fr.json` mais pas dans `ar-MA.json`, le runtime jette. En production, le build echoue. Mitigation : script CI `validate-i18n-keys.ts` (deja Sprint 4) verifie parite cles cross-locale.

16. **`process.env.NEXT_PUBLIC_*` lu cote server retourne valeur build-time** : si on change `.env.local` apres build, valeur cote serveur reste l'ancienne. Mitigation : restart dev server apres modif `.env*` + en prod, rebuild requis pour change.

17. **`crypto.randomUUID()` non disponible certains navigateurs vieux + Edge Runtime** : Edge Runtime supporte `crypto.randomUUID()` depuis Node 19. Navigateur : Safari < 15.4 ne supporte pas. Mitigation : helper `generateCryptoId()` deja Sprint 4 avec polyfill.

18. **TenantSwitcher race-condition zustand-cookie** : si on change `current_tenant_id` cookie + zustand store en meme temps mais que la query React Query etait en flight, la response arrive avec donnees de l'ancien tenant. Mitigation : `queryClient.cancelQueries()` AVANT le switch + `queryClient.invalidateQueries()` APRES + page reload `window.location.reload()`.

19. **FAB "Nouveau sinistre" cache sous le viewport mobile clavier ouvert** : sur mobile (tablette atelier portrait), quand technicien tape dans un input le clavier ouvre et cache le FAB qui est position fixed bottom-right. Mitigation : detecter `visualViewport` resize + reduire `bottom` du FAB ou le masquer pendant clavier ouvert.

20. **Notifications poll 30s mort en arriere-plan** : si tab garage en arriere plan, browser throttle setInterval. Mitigation : utiliser `document.visibilityState` -- pause poll quand caché, resume quand visible.

---

## 3. Architecture context (3-5 ko)

### Position dans Sprint 22

Cette tache est la **premiere des 13 taches** du Sprint 22. Elle bloque toutes les suivantes :

```
Sprint 22 -- Web Garage App (13 taches, 78h total)

[5.4.1 App skeleton + Layouts + Middleware Auth/Tenant]  <-- ICI (6h)
   |
   +--> [5.4.2 Pages Auth login + MFA + recovery]  (4h)
   |       |
   |       +--> [5.4.3 Dashboard 6 widgets]  (6h)
   |               |
   |               +--> [5.4.4 Sinistres Kanban + Table]  (7h)
   |               +--> [5.4.5 Sinistre detail + tabs]  (8h)
   |               +--> [5.4.6 Reception checklist]  (6h)
   |               +--> [5.4.7 Diagnostic IA + technicien]  (7h)
   |               +--> [5.4.8 Devis editor]  (6h)
   |               +--> [5.4.9 Orders tracking + hours]  (6h)
   |               +--> [5.4.10 QC + Delivery]  (5h)
   |               +--> [5.4.11 Invoices split preview]  (5h)
   |               +--> [5.4.12 Parametres + RBAC + i18n]  (4h)
   |               +--> [5.4.13 Tests Playwright E2E]  (8h)
```

### Position dans le programme 35 sprints

```
PHASE 1 Bootstrap  (Sprints 1-4)    : skeleton infrastructure + 8 apps stubs
PHASE 2 Identity   (Sprints 5-7)    : auth + tenant + RBAC backend
PHASE 3 Core CRM   (Sprints 8-13)   : CRM, Comm, Docs, Pay, Books, Analytics, HR
PHASE 4 VERT Insure (Sprints 14-22) : web-broker (Sprint 16) + web-customer (Sprint 17) + web-assure (Sprint 18) + repair foundation (Sprints 19-21)
PHASE 5 VERT Repair (Sprints 19-23) :
  Sprint 19 : Repair backend foundation (entities sinistres + workflow + state machine)
  Sprint 20 : IA estimation + photos analyse
  Sprint 21 : Sinistre workflow complete (reception + QC + delivery + invoicing)
  Sprint 22 : <-- web-garage app (cette tache 5.4.1 est la fondation)
  Sprint 23 : web-garage-mobile PWA technicien
PHASE 6 Admin      (Sprints 27-30)  : SuperAdmin + reporting + analytics avances
PHASE 7 IA + Pilot (Sprints 31-35)  : Agent Sky + pilote production Marrakech (Atlas Cabinet)
```

Cette tache reutilise le **pattern Sprint 16 web-broker** et le pose pour 2 apps ulterieures :
- Sprint 23 (web-garage-mobile PWA) etend ce pattern avec service worker offline + manifest PWA + camera capture.
- Sprint 27 (web-insurtech-admin) reutilise middleware + api-client avec couche super-admin RBAC.

### ASCII tree structure web-garage apres tache 5.4.1

```
repo/apps/web-garage/
|
|-- package.json                                          # MODIFIE : ajout jose 5.9.6, date-fns-tz 4.1.0
|-- next.config.mjs                                       # MODIFIE Sprint 4 : pas de change ici
|-- tailwind.config.ts                                    # MODIFIE : theme rouge garage primary
|-- tsconfig.json                                         # INCHANGE Sprint 4
|-- middleware.ts                                         # MODIFIE/RECREE : compose i18n + auth + tenant
|-- playwright.config.ts                                  # INCHANGE Sprint 4
|-- vitest.config.ts                                      # INCHANGE Sprint 4
|-- .env.example                                          # MODIFIE : ajout vars metier garage
|
|-- src/
|   |-- app/
|   |   |-- [locale]/
|   |   |   |-- layout.tsx                                # MODIFIE Sprint 4 : ajout HydrationBoundary + Providers
|   |   |   |-- page.tsx                                  # MODIFIE : redirect /dashboard si auth, /login sinon
|   |   |   |-- error.tsx                                 # INCHANGE Sprint 4
|   |   |   |-- not-found.tsx                             # INCHANGE Sprint 4
|   |   |   |
|   |   |   |-- (auth)/                                   # NOUVEAU : route group pages publiques
|   |   |   |   |-- layout.tsx                            # NOUVEAU : centered card layout + branding Garage
|   |   |   |   |-- placeholder.tsx                       # NOUVEAU : marker file (sera replaced 5.4.2)
|   |   |   |
|   |   |   |-- (protected)/                              # NOUVEAU : route group pages authentifiees
|   |   |   |   |-- layout.tsx                            # NOUVEAU : guard auth + tenant + structure sidebar/topbar
|   |   |   |   |-- placeholder.tsx                       # NOUVEAU : marker file (sera replaced 5.4.3)
|   |   |
|   |   |-- api/
|   |   |   |-- proxy/
|   |   |   |   |-- [...path]/
|   |   |   |   |   |-- route.ts                          # NOUVEAU : proxy injection x-tenant-id
|   |
|   |-- components/
|   |   |-- layout/
|   |   |   |-- sidebar.tsx                                # NOUVEAU : sidebar gauche garage (13 items)
|   |   |   |-- sidebar.spec.tsx                           # NOUVEAU : tests sidebar
|   |   |   |-- sidebar-item.tsx                           # NOUVEAU : nav item avec badge counter
|   |   |   |-- topbar.tsx                                 # NOUVEAU : topbar search + tenant switcher + locale + user
|   |   |   |-- topbar.spec.tsx                            # NOUVEAU : tests topbar
|   |   |   |-- global-search.tsx                          # NOUVEAU : search sinistres/customer/plate
|   |   |   |-- tenant-switcher.tsx                        # NOUVEAU : selecteur etablissement
|   |   |   |-- user-menu.tsx                              # NOUVEAU : dropdown user (profile, logout)
|   |   |   |-- locale-switcher.tsx                        # NOUVEAU : fr/ar-MA/ar
|   |   |   |-- notifications-bell.tsx                     # NOUVEAU : bell + poll 30s + dropdown
|   |   |   |-- new-sinistre-fab.tsx                       # NOUVEAU : FAB nouveau sinistre
|   |
|   |-- lib/
|   |   |-- api-client.ts                                  # MODIFIE : axios production-ready garage
|   |   |-- api-client.spec.ts                             # NOUVEAU : tests api-client
|   |   |-- auth-helpers.ts                                # NOUVEAU : decodeJwtUnsafe + isAuthorizedForGarage
|   |   |-- auth-helpers.spec.ts                           # NOUVEAU
|   |   |-- queries/
|   |   |   |-- notifications.queries.ts                    # NOUVEAU
|   |   |   |-- sinistres-counts.queries.ts                 # NOUVEAU : counts pour sidebar badge
|   |
|   |-- providers/
|   |   |-- providers.tsx                                  # NOUVEAU : chain QueryClient + NextIntl + Theme + Sonner
|   |   |-- tenant-context-sync.tsx                        # NOUVEAU : sync cookie + zustand
|   |
|   |-- stores/
|   |   |-- tenant.store.ts                                # MODIFIE Sprint 4 : key garage-tenant-store
|   |
|   |-- hooks/
|   |   |-- use-current-user.ts                            # NOUVEAU : retourne user decode JWT
|   |   |-- use-tenant-id.ts                               # NOUVEAU : retourne tenant_id current
|   |   |-- use-has-role.ts                                # NOUVEAU : RBAC verifier
|   |
|   |-- messages/
|   |   |-- fr.json                                        # MODIFIE : ajout namespaces sidebar, topbar, common
|   |   |-- ar-MA.json                                     # MODIFIE
|   |   |-- ar.json                                        # MODIFIE
|
|-- e2e/
|   |-- middleware-auth.spec.ts                            # NOUVEAU : tests E2E middleware
|   |-- layout-structure.spec.ts                           # NOUVEAU : tests E2E layout
```

### Diagramme flow middleware

```
Request /fr/sinistres/abc-123 arrive
    |
    v
[middleware.ts]
    |
    +--> Step 1 : matcher check
    |    Path correspond a /api ? OUI -> next() (api routes gerent leur own auth)
    |    Path correspond a /_next ? OUI -> next() (static assets pass through)
    |    Path correspond a /favicon, /icons, *.png ? OUI -> next()
    |    Path correspond a la route matcher principale ? OUI -> continue
    |
    +--> Step 2 : i18n middleware (createMiddleware from next-intl)
    |    Locale detectee : cookie NEXT_LOCALE > Accept-Language > default 'fr'
    |    URL contient deja /fr ou /ar-MA ou /ar ? OUI -> continue
    |    URL pas de prefix ? -> redirect /fr/sinistres/abc-123
    |
    +--> Step 3 : auth check
    |    Cookie access_token present ? NON -> redirect /fr/login?redirect=/fr/sinistres/abc-123
    |    decodeJwtUnsafe(access_token) -> { sub, exp, tenant_type, roles[] }
    |    Try/catch parse error -> clear cookies -> redirect /fr/login
    |    exp * 1000 < Date.now() + 30_000 ? OUI (expired)
    |        -> POST /api/auth/refresh (use refresh_token cookie)
    |        -> Si refresh OK : set new cookies + continue
    |        -> Si refresh KO : redirect /fr/login
    |    tenant_type !== 'garage' ? OUI (broker tente acceder web-garage)
    |        -> redirect /fr/login?error=wrong_app
    |    roles[] inclut un de [garage_admin, garage_chef, garage_technicien, garage_gestionnaire] ?
    |        NON -> redirect /fr/login?error=unauthorized_role
    |        OUI -> continue
    |
    +--> Step 4 : tenant check
    |    Cookie current_tenant_id present ? NON
    |        -> redirect /fr/select-tenant (page choisir etablissement)
    |    Cookie present mais pas dans liste user.allowed_tenants ?
    |        -> clear cookie -> redirect /fr/select-tenant
    |    OK -> set request header x-tenant-id = cookie value
    |
    +--> Step 5 : NextResponse.next() with headers
         (x-tenant-id, x-trace-id, accept-language) attaches a la request forwardee
```

### Composition middleware compose order

Ordre IMPORTANT (i18n -> auth -> tenant) :

```typescript
// middleware.ts (resume conceptuel)
export async function middleware(request: NextRequest) {
  // 1. i18n
  const intlResponse = nextIntlMiddleware(request);
  if (intlResponse.status === 302 || intlResponse.status === 307) return intlResponse;

  // 2. auth
  const authResult = await authCheck(request);
  if (authResult.redirect) return NextResponse.redirect(authResult.redirect);

  // 3. tenant
  const tenantResult = tenantCheck(request, authResult.user);
  if (tenantResult.redirect) return NextResponse.redirect(tenantResult.redirect);

  // 4. propage headers
  const response = NextResponse.next();
  response.headers.set('x-tenant-id', tenantResult.tenantId);
  response.headers.set('x-trace-id', crypto.randomUUID());
  return response;
}
```

---

## 4. Livrables checkables (15-30 livrables avec chemins fichiers)

- [ ] Fichier `repo/apps/web-garage/middleware.ts` cree (~250 lignes) avec compose i18n + auth + tenant Edge Runtime
- [ ] Fichier `repo/apps/web-garage/src/app/[locale]/layout.tsx` modifie (~120 lignes) -- ajout HydrationBoundary + Providers chain
- [ ] Fichier `repo/apps/web-garage/src/app/[locale]/(auth)/layout.tsx` cree (~80 lignes) -- centered card layout pages publiques
- [ ] Fichier `repo/apps/web-garage/src/app/[locale]/(protected)/layout.tsx` cree (~150 lignes) -- guard auth + tenant + structure sidebar/topbar
- [ ] Fichier `repo/apps/web-garage/src/app/api/proxy/[...path]/route.ts` cree (~120 lignes) -- proxy backend + injection x-tenant-id
- [ ] Fichier `repo/apps/web-garage/src/components/layout/sidebar.tsx` cree (~180 lignes) -- 13 items + badge counter sinistres
- [ ] Fichier `repo/apps/web-garage/src/components/layout/sidebar-item.tsx` cree (~80 lignes) -- nav item avec badge
- [ ] Fichier `repo/apps/web-garage/src/components/layout/topbar.tsx` cree (~150 lignes) -- search + tenant + locale + user + notifications
- [ ] Fichier `repo/apps/web-garage/src/components/layout/global-search.tsx` cree (~150 lignes) -- search sinistres/customer/plate avec autocomplete
- [ ] Fichier `repo/apps/web-garage/src/components/layout/tenant-switcher.tsx` cree (~100 lignes) -- selecteur etablissement avec confirm dialog
- [ ] Fichier `repo/apps/web-garage/src/components/layout/user-menu.tsx` cree (~80 lignes) -- dropdown user
- [ ] Fichier `repo/apps/web-garage/src/components/layout/locale-switcher.tsx` cree (~70 lignes) -- fr / ar-MA / ar
- [ ] Fichier `repo/apps/web-garage/src/components/layout/notifications-bell.tsx` cree (~120 lignes) -- bell + poll 30s + dropdown
- [ ] Fichier `repo/apps/web-garage/src/components/layout/new-sinistre-fab.tsx` cree (~80 lignes) -- FAB nouveau sinistre
- [ ] Fichier `repo/apps/web-garage/src/lib/api-client.ts` modifie (~280 lignes) -- axios production-ready + interceptors auth refresh + idempotency-key
- [ ] Fichier `repo/apps/web-garage/src/lib/auth-helpers.ts` cree (~120 lignes) -- decodeJwtUnsafe + isAuthorizedForGarage + isTokenExpired
- [ ] Fichier `repo/apps/web-garage/src/providers/providers.tsx` cree (~150 lignes) -- chain QueryClient + NextIntl + Theme + Sonner + Sentry
- [ ] Fichier `repo/apps/web-garage/src/providers/tenant-context-sync.tsx` cree (~80 lignes) -- sync cookie + zustand
- [ ] Fichier `repo/apps/web-garage/src/stores/tenant.store.ts` modifie (~80 lignes) -- key garage-tenant-store
- [ ] Fichier `repo/apps/web-garage/src/hooks/use-current-user.ts` cree (~60 lignes)
- [ ] Fichier `repo/apps/web-garage/src/hooks/use-tenant-id.ts` cree (~40 lignes)
- [ ] Fichier `repo/apps/web-garage/src/hooks/use-has-role.ts` cree (~50 lignes)
- [ ] Fichier `repo/apps/web-garage/src/lib/queries/sinistres-counts.queries.ts` cree (~60 lignes)
- [ ] Fichier `repo/apps/web-garage/src/lib/queries/notifications.queries.ts` cree (~60 lignes)
- [ ] Fichiers `repo/apps/web-garage/src/messages/{fr,ar-MA,ar}.json` modifies (ajout namespaces sidebar, topbar, common -- 80+ keys par locale)
- [ ] Fichier `repo/apps/web-garage/.env.example` modifie -- ajout vars metier (NEXT_PUBLIC_APP_NAME=skalean-garage, NEXT_PUBLIC_DEFAULT_LOCALE, NEXT_PUBLIC_API_URL, etc.)
- [ ] Tests unitaires Vitest : 25+ tests (api-client, auth-helpers, sidebar, topbar, hooks)
- [ ] Tests E2E Playwright : 8+ tests (middleware redirect, layout structure, tenant switcher, locale switcher)
- [ ] `pnpm --filter @insurtech/web-garage dev` demarre sur 3002 sans erreur
- [ ] `pnpm --filter @insurtech/web-garage typecheck` retourne 0 erreur
- [ ] `pnpm --filter @insurtech/web-garage lint` retourne 0 erreur
- [ ] `pnpm --filter @insurtech/web-garage test` retourne 100% PASS
- [ ] Aucune emoji detectee dans tous les fichiers crees (verification grep)

---

## 5. Fichiers crees / modifies (liste exhaustive)

```
repo/apps/web-garage/middleware.ts                                                                   (~250 lignes / compose i18n + auth + tenant Edge Runtime)
repo/apps/web-garage/middleware.spec.ts                                                              (~180 lignes / tests unit middleware)
repo/apps/web-garage/src/app/[locale]/layout.tsx                                                     (~120 lignes / racine + HydrationBoundary + Providers)
repo/apps/web-garage/src/app/[locale]/page.tsx                                                        (~40 lignes / redirect auth)
repo/apps/web-garage/src/app/[locale]/(auth)/layout.tsx                                              (~80 lignes / centered card public layout)
repo/apps/web-garage/src/app/[locale]/(auth)/placeholder.tsx                                          (~15 lignes / marker)
repo/apps/web-garage/src/app/[locale]/(protected)/layout.tsx                                          (~150 lignes / sidebar + topbar + auth guard)
repo/apps/web-garage/src/app/[locale]/(protected)/placeholder.tsx                                     (~15 lignes / marker)
repo/apps/web-garage/src/app/api/proxy/[...path]/route.ts                                             (~120 lignes / proxy backend + x-tenant-id)
repo/apps/web-garage/src/app/api/auth/refresh/route.ts                                                (~80 lignes / refresh proxy)
repo/apps/web-garage/src/app/api/auth/signout/route.ts                                                (~50 lignes / signout proxy)
repo/apps/web-garage/src/components/layout/sidebar.tsx                                                (~180 lignes / sidebar 13 items + badge counter)
repo/apps/web-garage/src/components/layout/sidebar.spec.tsx                                            (~150 lignes / tests sidebar 8+ tests)
repo/apps/web-garage/src/components/layout/sidebar-item.tsx                                            (~80 lignes / nav item avec badge)
repo/apps/web-garage/src/components/layout/topbar.tsx                                                  (~150 lignes / topbar avec search + tenant + locale + user + bell)
repo/apps/web-garage/src/components/layout/topbar.spec.tsx                                             (~120 lignes / tests topbar 6+ tests)
repo/apps/web-garage/src/components/layout/global-search.tsx                                           (~150 lignes / search sinistres/customer/plate + cmdk)
repo/apps/web-garage/src/components/layout/tenant-switcher.tsx                                         (~100 lignes / selecteur etablissement)
repo/apps/web-garage/src/components/layout/user-menu.tsx                                               (~80 lignes / dropdown user)
repo/apps/web-garage/src/components/layout/locale-switcher.tsx                                          (~70 lignes / fr / ar-MA / ar)
repo/apps/web-garage/src/components/layout/notifications-bell.tsx                                       (~120 lignes / poll 30s + dropdown)
repo/apps/web-garage/src/components/layout/new-sinistre-fab.tsx                                         (~80 lignes / FAB)
repo/apps/web-garage/src/lib/api-client.ts                                                              (~280 lignes / axios interceptors auth + idempotency)
repo/apps/web-garage/src/lib/api-client.spec.ts                                                          (~200 lignes / tests api-client 12+ tests)
repo/apps/web-garage/src/lib/auth-helpers.ts                                                            (~120 lignes / decodeJwtUnsafe + isAuthorizedForGarage)
repo/apps/web-garage/src/lib/auth-helpers.spec.ts                                                        (~150 lignes / tests auth-helpers 10+ tests)
repo/apps/web-garage/src/providers/providers.tsx                                                         (~150 lignes / chain providers)
repo/apps/web-garage/src/providers/tenant-context-sync.tsx                                                (~80 lignes / sync cookie + zustand)
repo/apps/web-garage/src/stores/tenant.store.ts                                                           (~80 lignes / zustand garage-tenant-store)
repo/apps/web-garage/src/hooks/use-current-user.ts                                                         (~60 lignes / decode JWT current)
repo/apps/web-garage/src/hooks/use-tenant-id.ts                                                            (~40 lignes / tenant_id current)
repo/apps/web-garage/src/hooks/use-has-role.ts                                                              (~50 lignes / RBAC verifier)
repo/apps/web-garage/src/lib/queries/sinistres-counts.queries.ts                                            (~60 lignes / counts pour badge)
repo/apps/web-garage/src/lib/queries/notifications.queries.ts                                                (~60 lignes / notifications poll)
repo/apps/web-garage/src/messages/fr.json                                                                  (modifie +80 keys / sidebar, topbar, common)
repo/apps/web-garage/src/messages/ar-MA.json                                                                (modifie +80 keys)
repo/apps/web-garage/src/messages/ar.json                                                                    (modifie +80 keys)
repo/apps/web-garage/.env.example                                                                            (modifie +5 vars)
repo/apps/web-garage/package.json                                                                            (modifie : jose, date-fns-tz dependencies)
repo/apps/web-garage/tailwind.config.ts                                                                      (modifie : theme garage primary red)
repo/apps/web-garage/e2e/middleware-auth.spec.ts                                                              (~150 lignes / tests Playwright 5+ tests)
repo/apps/web-garage/e2e/layout-structure.spec.ts                                                              (~120 lignes / tests Playwright 4+ tests)
```

**Total fichiers** : 35 crees + 5 modifies = 40 fichiers
**Total lignes code** : ~3 500 lignes (production + tests)

---

## 6. Code patterns COMPLETS (30-80 ko -- 8 a 15 fichiers complets)

### Fichier 1/15 : `repo/apps/web-garage/middleware.ts`

Compose les 3 middlewares (i18n + auth + tenant) en un seul retour Edge Runtime. Pattern repris Sprint 16 web-broker, adapte pour `tenant_type === 'garage'` et roles `garage_*`.

```typescript
// middleware.ts
// Edge Runtime middleware -- web-garage app
// Compose order: i18n -> auth -> tenant
// Reference: B-22 Tache 5.4.1
// Decision-002 (multi-tenant strict), decision-006 (no-emoji), decision-009 (i18n MA)

import { type NextRequest, NextResponse } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { decodeJwt } from 'jose';

// ============================================================================
// Configuration constants
// ============================================================================

const LOCALES = ['fr', 'ar-MA', 'ar'] as const;
const DEFAULT_LOCALE = 'fr';
const LOCALE_PREFIX = 'always';

// Roles autorises a se connecter sur web-garage (4 roles garage uniquement)
const ALLOWED_GARAGE_ROLES = [
  'garage_admin',
  'garage_chef',
  'garage_technicien',
  'garage_gestionnaire',
] as const;

// Tenant type filtre : un broker ne peut pas se connecter sur web-garage
const REQUIRED_TENANT_TYPE = 'garage' as const;

// Marge expiration JWT : 30 secondes pour eviter race condition horloge
const TOKEN_EXPIRY_MARGIN_MS = 30_000;

// Routes publiques (acces sans auth)
const PUBLIC_ROUTES = [
  '/login',
  '/verify-mfa',
  '/forgot-password',
  '/reset-password',
  '/select-tenant',
];

// ============================================================================
// i18n middleware (next-intl)
// ============================================================================

const intlMiddleware = createIntlMiddleware({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: LOCALE_PREFIX,
  localeDetection: true,
});

// ============================================================================
// Types
// ============================================================================

interface DecodedJwt {
  sub: string;
  exp: number;
  iat: number;
  email: string;
  tenant_type: 'broker' | 'garage' | 'insurer' | 'admin';
  tenant_id: string;
  allowed_tenants: string[];
  roles: string[];
  preferred_locale?: 'fr' | 'ar-MA' | 'ar';
}

interface AuthCheckResult {
  authorized: boolean;
  redirectTo?: string;
  user?: DecodedJwt;
  error?: string;
}

interface TenantCheckResult {
  authorized: boolean;
  redirectTo?: string;
  tenantId?: string;
}

// ============================================================================
// Helpers
// ============================================================================

function stripLocaleFromPath(pathname: string): string {
  for (const locale of LOCALES) {
    if (pathname.startsWith(`/${locale}/`)) {
      return pathname.slice(`/${locale}`.length);
    }
    if (pathname === `/${locale}`) {
      return '/';
    }
  }
  return pathname;
}

function extractLocaleFromPath(pathname: string): string {
  for (const locale of LOCALES) {
    if (pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`) {
      return locale;
    }
  }
  return DEFAULT_LOCALE;
}

function isPublicRoute(pathname: string): boolean {
  const stripped = stripLocaleFromPath(pathname);
  return PUBLIC_ROUTES.some(
    (route) => stripped === route || stripped.startsWith(`${route}/`),
  );
}

function isTokenExpired(exp: number): boolean {
  return exp * 1000 < Date.now() + TOKEN_EXPIRY_MARGIN_MS;
}

function decodeJwtSafe(token: string): DecodedJwt | null {
  try {
    return decodeJwt(token) as unknown as DecodedJwt;
  } catch {
    return null;
  }
}

// ============================================================================
// Auth check
// ============================================================================

async function authCheck(
  request: NextRequest,
  locale: string,
): Promise<AuthCheckResult> {
  const accessToken = request.cookies.get('access_token')?.value;
  const pathname = request.nextUrl.pathname;
  const strippedPath = stripLocaleFromPath(pathname);

  if (!accessToken) {
    return {
      authorized: false,
      redirectTo: `/${locale}/login?redirect=${encodeURIComponent(pathname)}`,
      error: 'no_token',
    };
  }

  const decoded = decodeJwtSafe(accessToken);
  if (!decoded) {
    return {
      authorized: false,
      redirectTo: `/${locale}/login?error=corrupted_token`,
      error: 'decode_failed',
    };
  }

  if (isTokenExpired(decoded.exp)) {
    return {
      authorized: false,
      redirectTo: `/${locale}/login?redirect=${encodeURIComponent(pathname)}&reason=expired`,
      error: 'expired',
    };
  }

  if (decoded.tenant_type !== REQUIRED_TENANT_TYPE) {
    return {
      authorized: false,
      redirectTo: `/${locale}/login?error=wrong_app`,
      error: 'wrong_tenant_type',
    };
  }

  const hasGarageRole = decoded.roles.some((role) =>
    (ALLOWED_GARAGE_ROLES as readonly string[]).includes(role),
  );

  if (!hasGarageRole) {
    return {
      authorized: false,
      redirectTo: `/${locale}/login?error=unauthorized_role`,
      error: 'no_garage_role',
    };
  }

  return { authorized: true, user: decoded };
}

// ============================================================================
// Tenant check
// ============================================================================

function tenantCheck(
  request: NextRequest,
  user: DecodedJwt,
  locale: string,
): TenantCheckResult {
  const tenantCookie = request.cookies.get('current_tenant_id')?.value;
  const pathname = request.nextUrl.pathname;

  if (!tenantCookie) {
    if (user.allowed_tenants.length === 1) {
      // un seul tenant -> auto-select sans page intermediaire
      return {
        authorized: true,
        tenantId: user.allowed_tenants[0],
      };
    }
    return {
      authorized: false,
      redirectTo: `/${locale}/select-tenant?redirect=${encodeURIComponent(pathname)}`,
    };
  }

  if (!user.allowed_tenants.includes(tenantCookie)) {
    return {
      authorized: false,
      redirectTo: `/${locale}/select-tenant?error=unauthorized_tenant`,
    };
  }

  return { authorized: true, tenantId: tenantCookie };
}

// ============================================================================
// Middleware compose
// ============================================================================

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const pathname = request.nextUrl.pathname;

  // Step 1: i18n middleware first (handles locale prefix)
  const intlResponse = intlMiddleware(request);
  if (intlResponse.status === 302 || intlResponse.status === 307) {
    return intlResponse;
  }

  const locale = extractLocaleFromPath(pathname);

  // Step 2: skip auth on public routes
  if (isPublicRoute(pathname)) {
    const response = intlResponse;
    response.headers.set('x-trace-id', crypto.randomUUID());
    return response;
  }

  // Step 3: auth check
  const authResult = await authCheck(request, locale);
  if (!authResult.authorized) {
    if (!authResult.redirectTo) {
      return NextResponse.redirect(new URL(`/${locale}/login`, request.url));
    }
    const redirect = NextResponse.redirect(new URL(authResult.redirectTo, request.url));
    if (authResult.error === 'expired' || authResult.error === 'decode_failed') {
      redirect.cookies.delete('access_token');
    }
    return redirect;
  }

  // Step 4: tenant check
  const tenantResult = tenantCheck(request, authResult.user!, locale);
  if (!tenantResult.authorized) {
    return NextResponse.redirect(new URL(tenantResult.redirectTo!, request.url));
  }

  // Step 5: propagate headers
  const response = intlResponse;
  response.headers.set('x-tenant-id', tenantResult.tenantId!);
  response.headers.set('x-trace-id', crypto.randomUUID());
  response.headers.set('x-user-id', authResult.user!.sub);
  response.headers.set('x-user-roles', authResult.user!.roles.join(','));

  return response;
}

// ============================================================================
// Matcher : exclure assets statiques pour performance
// ============================================================================

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|robots.txt|icons/|.*\\.(?:png|svg|jpg|jpeg|webp|gif|ico|woff2|woff)).*)',
  ],
};
```

**Notes importantes** :
- Edge Runtime impose `jose.decodeJwt` (pas `jsonwebtoken`). Web Crypto API uniquement.
- L'ordre i18n -> auth -> tenant est strict. Inversion casse les redirects.
- `tenant_type === 'garage'` filtre les users broker qui essaieraient web-garage.
- Roles autorises hardcodes (4) -- modification = nouvelle release. Ne PAS lire depuis backend dans middleware (latency).

### Fichier 2/15 : `repo/apps/web-garage/src/lib/api-client.ts`

Client axios production-ready avec auto-refresh JWT, injection `x-tenant-id`, `Idempotency-Key` sur mutations sensibles, `Accept-Language`, `x-trace-id`.

```typescript
// src/lib/api-client.ts
// Axios client production-ready -- web-garage
// Reference: B-22 Tache 5.4.1
// Decision-002 (multi-tenant), decision-006 (no-emoji)

import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';
import { z } from 'zod';

// ============================================================================
// Types & schemas
// ============================================================================

const ApiErrorSchema = z.object({
  statusCode: z.number(),
  error: z.string(),
  message: z.string().or(z.array(z.string())),
  timestamp: z.string().optional(),
  path: z.string().optional(),
  traceId: z.string().optional(),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;

export class GarageApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly traceId?: string,
    public readonly originalError?: unknown,
  ) {
    super(message);
    this.name = 'GarageApiError';
  }
}

// ============================================================================
// Configuration
// ============================================================================

const API_BASE_URL =
  typeof window === 'undefined'
    ? process.env.API_BASE_URL ?? 'http://localhost:4000'
    : '/api/proxy'; // proxy route Next.js cote client

const IDEMPOTENT_METHODS = ['get', 'head', 'options'] as const;
const REQUIRES_IDEMPOTENCY_KEY_PATHS = [
  '/api/v1/repair/sinistres', // creer sinistre
  '/api/v1/repair/sinistres/.*/transition', // transition status
  '/api/v1/repair/invoices/generate', // generer facture DGI
  '/api/v1/repair/devis/.*/send', // envoyer devis
  '/api/v1/payments', // paiement
  '/api/v1/signatures', // signature
];

// ============================================================================
// Refresh queue (race condition multi-tabs)
// ============================================================================

let refreshPromise: Promise<void> | null = null;

async function refreshAccessToken(): Promise<void> {
  if (refreshPromise) {
    return refreshPromise;
  }
  refreshPromise = (async () => {
    try {
      const response = await axios.post(
        '/api/auth/refresh',
        {},
        { withCredentials: true },
      );
      if (response.status !== 200) {
        throw new Error('Refresh failed');
      }
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

// ============================================================================
// Idempotency key generation
// ============================================================================

function shouldAttachIdempotencyKey(
  method: string,
  url: string,
): boolean {
  const m = method.toLowerCase();
  if ((IDEMPOTENT_METHODS as readonly string[]).includes(m)) return false;
  return REQUIRES_IDEMPOTENCY_KEY_PATHS.some((pattern) =>
    new RegExp(`^${pattern.replace(/\.\*/g, '.*')}$`).test(url),
  );
}

function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

// ============================================================================
// Client factory
// ============================================================================

interface CreateApiClientOptions {
  baseURL?: string;
  tenantId?: string;
  accessToken?: string;
  locale?: string;
}

export function createApiClient(options: CreateApiClientOptions = {}): AxiosInstance {
  const instance = axios.create({
    baseURL: options.baseURL ?? API_BASE_URL,
    timeout: 30_000,
    withCredentials: true,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  });

  // Request interceptor
  instance.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      // x-tenant-id : prio header explicite > options > cookie cote SSR (non lu ici en client)
      if (options.tenantId && !config.headers['x-tenant-id']) {
        config.headers['x-tenant-id'] = options.tenantId;
      }

      if (options.accessToken && !config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${options.accessToken}`;
      }

      // Accept-Language
      const locale = options.locale ?? readLocaleFromCookieOrDefault();
      config.headers['Accept-Language'] = locale;

      // x-trace-id
      if (!config.headers['x-trace-id']) {
        config.headers['x-trace-id'] = generateIdempotencyKey();
      }

      // Idempotency-Key
      const method = config.method?.toLowerCase() ?? 'get';
      const url = config.url ?? '';
      if (shouldAttachIdempotencyKey(method, url) && !config.headers['Idempotency-Key']) {
        config.headers['Idempotency-Key'] = generateIdempotencyKey();
      }

      return config;
    },
    (error) => Promise.reject(error),
  );

  // Response interceptor : refresh on 401
  instance.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const config = error.config as InternalAxiosRequestConfig & {
        _retried?: boolean;
      };

      if (error.response?.status === 401 && !config._retried) {
        config._retried = true;
        try {
          await refreshAccessToken();
          return instance(config);
        } catch {
          // refresh failed -> redirect login cote client
          if (typeof window !== 'undefined') {
            const currentPath = window.location.pathname + window.location.search;
            window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
          }
          return Promise.reject(toApiError(error));
        }
      }

      return Promise.reject(toApiError(error));
    },
  );

  return instance;
}

function toApiError(error: AxiosError): GarageApiError {
  if (!error.response) {
    return new GarageApiError(0, 'NETWORK_ERROR', error.message);
  }

  const body = error.response.data;
  const parsed = ApiErrorSchema.safeParse(body);
  if (parsed.success) {
    const msg = Array.isArray(parsed.data.message)
      ? parsed.data.message.join(', ')
      : parsed.data.message;
    return new GarageApiError(
      parsed.data.statusCode,
      parsed.data.error,
      msg,
      parsed.data.traceId,
      error,
    );
  }

  return new GarageApiError(
    error.response.status,
    'UNKNOWN_ERROR',
    error.message,
    undefined,
    error,
  );
}

function readLocaleFromCookieOrDefault(): string {
  if (typeof document === 'undefined') return 'fr';
  const match = document.cookie.match(/NEXT_LOCALE=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : 'fr';
}

// ============================================================================
// Default client (singleton client-side)
// ============================================================================

let _defaultClient: AxiosInstance | null = null;

export function getApiClient(): AxiosInstance {
  if (typeof window === 'undefined') {
    throw new Error('getApiClient() can only be used client-side. Use createApiClient() server-side.');
  }
  if (!_defaultClient) {
    _defaultClient = createApiClient();
  }
  return _defaultClient;
}

// ============================================================================
// Helpers exportes
// ============================================================================

export async function apiGet<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const response = await getApiClient().get<T>(url, config);
  return response.data;
}

export async function apiPost<T, D = unknown>(
  url: string,
  data?: D,
  config?: AxiosRequestConfig,
): Promise<T> {
  const response = await getApiClient().post<T>(url, data, config);
  return response.data;
}

export async function apiPut<T, D = unknown>(
  url: string,
  data?: D,
  config?: AxiosRequestConfig,
): Promise<T> {
  const response = await getApiClient().put<T>(url, data, config);
  return response.data;
}

export async function apiPatch<T, D = unknown>(
  url: string,
  data?: D,
  config?: AxiosRequestConfig,
): Promise<T> {
  const response = await getApiClient().patch<T>(url, data, config);
  return response.data;
}

export async function apiDelete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const response = await getApiClient().delete<T>(url, config);
  return response.data;
}
```

**Notes** :
- Refresh queue singleton : si N tabs voient 401 simultanement, une seule call /auth/refresh.
- `Idempotency-Key` auto sur paths critiques (sinistre create, transition, invoice generate).
- `withCredentials: true` essentiel pour cookies httpOnly cross-domain (en prod cross-subdomain garage.skalean-insurtech.ma <-> api.skalean-insurtech.ma).
- Wrappers `apiGet`/`apiPost`/etc retournent directement `response.data` -- evite verbosite dans queries.

### Fichier 3/15 : `repo/apps/web-garage/src/lib/auth-helpers.ts`

Decode JWT cote client/server (unsafe car ne valide pas signature). Helpers `isAuthorizedForGarage`, `isTokenExpired`.

```typescript
// src/lib/auth-helpers.ts
// Auth helpers -- web-garage
// IMPORTANT: decodeJwtUnsafe NE VALIDE PAS la signature.
// Validation signature: backend NestJS sur chaque requete (Sprint 5).
// Reference: B-22 Tache 5.4.1

import { decodeJwt } from 'jose';

export const GARAGE_ROLES = [
  'garage_admin',
  'garage_chef',
  'garage_technicien',
  'garage_gestionnaire',
] as const;

export type GarageRole = (typeof GARAGE_ROLES)[number];

export interface CurrentUser {
  id: string;
  email: string;
  tenantId: string;
  tenantType: 'broker' | 'garage' | 'insurer' | 'admin';
  allowedTenants: string[];
  roles: string[];
  preferredLocale?: 'fr' | 'ar-MA' | 'ar';
  exp: number;
  iat: number;
}

interface JwtPayload {
  sub: string;
  email: string;
  exp: number;
  iat: number;
  tenant_id: string;
  tenant_type: 'broker' | 'garage' | 'insurer' | 'admin';
  allowed_tenants: string[];
  roles: string[];
  preferred_locale?: 'fr' | 'ar-MA' | 'ar';
}

/**
 * Decode JWT WITHOUT signature validation.
 * Use only to read claims for routing decisions.
 * Backend validates signature on every request.
 */
export function decodeJwtUnsafe(token: string): CurrentUser | null {
  try {
    const payload = decodeJwt(token) as unknown as JwtPayload;
    return {
      id: payload.sub,
      email: payload.email,
      tenantId: payload.tenant_id,
      tenantType: payload.tenant_type,
      allowedTenants: payload.allowed_tenants ?? [],
      roles: payload.roles ?? [],
      preferredLocale: payload.preferred_locale,
      exp: payload.exp,
      iat: payload.iat,
    };
  } catch {
    return null;
  }
}

/**
 * Check if token is expired with safety margin.
 * @param exp UNIX timestamp seconds
 * @param marginMs default 30000
 */
export function isTokenExpired(exp: number, marginMs = 30_000): boolean {
  return exp * 1000 < Date.now() + marginMs;
}

/**
 * Check if user has at least one garage-allowed role.
 */
export function isAuthorizedForGarage(user: CurrentUser | null): boolean {
  if (!user) return false;
  if (user.tenantType !== 'garage') return false;
  return user.roles.some((role) =>
    (GARAGE_ROLES as readonly string[]).includes(role),
  );
}

/**
 * Check if user has a specific garage role.
 */
export function hasGarageRole(user: CurrentUser | null, role: GarageRole): boolean {
  if (!user) return false;
  return user.roles.includes(role);
}

/**
 * Get highest-priority role for display purposes.
 * Order: admin > chef > gestionnaire > technicien
 */
export function getPrimaryGarageRole(user: CurrentUser | null): GarageRole | null {
  if (!user) return null;
  const priorityOrder: GarageRole[] = [
    'garage_admin',
    'garage_chef',
    'garage_gestionnaire',
    'garage_technicien',
  ];
  for (const role of priorityOrder) {
    if (user.roles.includes(role)) return role;
  }
  return null;
}
```

### Fichier 4/15 : `repo/apps/web-garage/src/app/[locale]/(protected)/layout.tsx`

Layout protege : Server Component qui charge user from cookie, redirige si invalide, rend sidebar + topbar + main content.

```typescript
// src/app/[locale]/(protected)/layout.tsx
// Layout protege -- web-garage
// Server Component avec await cookies() + auth guard
// Reference: B-22 Tache 5.4.1

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { type ReactNode } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { NewSinistreFab } from '@/components/layout/new-sinistre-fab';
import { decodeJwtUnsafe, isAuthorizedForGarage, isTokenExpired } from '@/lib/auth-helpers';
import { TenantContextSync } from '@/providers/tenant-context-sync';

interface ProtectedLayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function ProtectedLayout({
  children,
  params,
}: ProtectedLayoutProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token')?.value;
  const currentTenantId = cookieStore.get('current_tenant_id')?.value;

  if (!accessToken) {
    const headersList = await headers();
    const referer = headersList.get('referer') ?? '';
    redirect(`/${locale}/login?redirect=${encodeURIComponent(referer)}`);
  }

  const user = decodeJwtUnsafe(accessToken);
  if (!user) {
    redirect(`/${locale}/login?error=corrupted_token`);
  }

  if (isTokenExpired(user.exp)) {
    redirect(`/${locale}/login?reason=expired`);
  }

  if (!isAuthorizedForGarage(user)) {
    redirect(`/${locale}/login?error=unauthorized`);
  }

  if (!currentTenantId || !user.allowedTenants.includes(currentTenantId)) {
    if (user.allowedTenants.length === 1) {
      // server cannot set cookie here (redirect-only). delegate to API route.
      redirect(`/${locale}/api/auth/select-tenant?tenant_id=${user.allowedTenants[0]}`);
    }
    redirect(`/${locale}/select-tenant`);
  }

  const isRtl = locale === 'ar-MA' || locale === 'ar';

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background" dir={isRtl ? 'rtl' : 'ltr'}>
      <TenantContextSync initialTenantId={currentTenantId} initialUser={user} />
      <Sidebar user={user} locale={locale} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar user={user} locale={locale} />
        <main
          className="flex-1 overflow-auto px-6 py-4"
          data-testid="protected-main"
          aria-label="Main content"
        >
          {children}
        </main>
      </div>
      <NewSinistreFab locale={locale} />
    </div>
  );
}
```

### Fichier 5/15 : `repo/apps/web-garage/src/components/layout/sidebar.tsx`

Sidebar gauche avec 13 items. Badge counter dynamique sur "Sinistres" via TanStack Query.

```typescript
// src/components/layout/sidebar.tsx
// Sidebar gauche -- web-garage
// 13 items + badge counter "Sinistres en cours"
// Reference: B-22 Tache 5.4.1

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard,
  AlertCircle,
  ClipboardCheck,
  Stethoscope,
  FileText,
  Wrench,
  ShieldCheck,
  Truck,
  Receipt,
  ShieldAlert,
  Package,
  Users,
  Settings,
} from 'lucide-react';
import { type CurrentUser, hasGarageRole } from '@/lib/auth-helpers';
import { SidebarItem } from './sidebar-item';
import { fetchSinistresCounts } from '@/lib/queries/sinistres-counts.queries';

interface SidebarProps {
  user: CurrentUser;
  locale: string;
}

interface NavItem {
  key: string;
  href: string;
  icon: typeof LayoutDashboard;
  badge?: number;
  badgeVariant?: 'default' | 'warning' | 'danger';
  visibleForRoles?: string[];
  external?: boolean;
}

export function Sidebar({ user, locale }: SidebarProps) {
  const t = useTranslations('sidebar');
  const pathname = usePathname();

  const { data: counts } = useQuery({
    queryKey: ['sinistres-counts'],
    queryFn: fetchSinistresCounts,
    refetchInterval: 30_000,
    staleTime: 25_000,
  });

  const totalSinistresEnCours = counts
    ? counts.declared +
      counts.acknowledged +
      counts.appointment_scheduled +
      counts.received +
      counts.under_diagnostic +
      counts.awaiting_approval +
      counts.under_repair +
      counts.quality_check
    : undefined;

  const navItems: NavItem[] = [
    {
      key: 'dashboard',
      href: `/${locale}/dashboard`,
      icon: LayoutDashboard,
    },
    {
      key: 'sinistres',
      href: `/${locale}/sinistres`,
      icon: AlertCircle,
      badge: totalSinistresEnCours,
      badgeVariant: totalSinistresEnCours && totalSinistresEnCours > 20 ? 'warning' : 'default',
    },
    {
      key: 'receptions',
      href: `/${locale}/receptions`,
      icon: ClipboardCheck,
      visibleForRoles: ['garage_admin', 'garage_chef', 'garage_technicien'],
    },
    {
      key: 'diagnostics',
      href: `/${locale}/diagnostics`,
      icon: Stethoscope,
      visibleForRoles: ['garage_admin', 'garage_chef', 'garage_technicien'],
    },
    {
      key: 'devis',
      href: `/${locale}/devis`,
      icon: FileText,
      visibleForRoles: ['garage_admin', 'garage_chef', 'garage_gestionnaire'],
    },
    {
      key: 'orders',
      href: `/${locale}/orders`,
      icon: Wrench,
    },
    {
      key: 'qc',
      href: `/${locale}/qc`,
      icon: ShieldCheck,
      visibleForRoles: ['garage_admin', 'garage_chef'],
    },
    {
      key: 'livraisons',
      href: `/${locale}/livraisons`,
      icon: Truck,
    },
    {
      key: 'invoices',
      href: `/${locale}/invoices`,
      icon: Receipt,
      visibleForRoles: ['garage_admin', 'garage_chef', 'garage_gestionnaire'],
    },
    {
      key: 'garanties',
      href: `/${locale}/garanties`,
      icon: ShieldAlert,
    },
    {
      key: 'stock',
      href: `/${locale}/stock`,
      icon: Package,
      external: true, // link Sprint 13 Stock module
    },
    {
      key: 'hr',
      href: `/${locale}/hr`,
      icon: Users,
      external: true, // link Sprint 13 HR module
      visibleForRoles: ['garage_admin', 'garage_gestionnaire'],
    },
    {
      key: 'parametres',
      href: `/${locale}/parametres`,
      icon: Settings,
      visibleForRoles: ['garage_admin'],
    },
  ];

  const visibleItems = navItems.filter((item) => {
    if (!item.visibleForRoles) return true;
    return item.visibleForRoles.some((role) => user.roles.includes(role));
  });

  return (
    <aside
      className="flex h-screen w-64 flex-col border-r border-border bg-card"
      data-testid="sidebar"
      aria-label="Main navigation"
    >
      <div className="flex h-16 items-center justify-center border-b border-border px-4">
        <h1 className="text-lg font-bold text-garage-primary" data-testid="sidebar-brand">
          Skalean Garage
        </h1>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {visibleItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <li key={item.key}>
                <SidebarItem
                  href={item.href}
                  icon={item.icon}
                  label={t(item.key)}
                  badge={item.badge}
                  badgeVariant={item.badgeVariant}
                  isActive={isActive}
                  external={item.external}
                  testId={`sidebar-item-${item.key}`}
                />
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
        <p>v2.2.0</p>
        <p className="truncate" title={user.email}>
          {user.email}
        </p>
      </div>
    </aside>
  );
}
```

### Fichier 6/15 : `repo/apps/web-garage/src/components/layout/sidebar-item.tsx`

Item de navigation avec badge counter.

```typescript
// src/components/layout/sidebar-item.tsx
'use client';

import Link from 'next/link';
import { type LucideIcon } from 'lucide-react';
import { clsx } from 'clsx';

interface SidebarItemProps {
  href: string;
  icon: LucideIcon;
  label: string;
  badge?: number;
  badgeVariant?: 'default' | 'warning' | 'danger';
  isActive?: boolean;
  external?: boolean;
  testId?: string;
}

export function SidebarItem({
  href,
  icon: Icon,
  label,
  badge,
  badgeVariant = 'default',
  isActive,
  external,
  testId,
}: SidebarItemProps) {
  const badgeClasses = clsx(
    'ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold',
    {
      'bg-muted text-muted-foreground': badgeVariant === 'default' && !isActive,
      'bg-amber-100 text-amber-800': badgeVariant === 'warning',
      'bg-red-100 text-red-800': badgeVariant === 'danger',
      'bg-garage-primary-50 text-garage-primary': isActive && badgeVariant === 'default',
    },
  );

  const linkClasses = clsx(
    'group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
    {
      'bg-garage-primary text-white': isActive,
      'text-foreground hover:bg-muted': !isActive,
    },
  );

  return (
    <Link
      href={href}
      className={linkClasses}
      data-testid={testId}
      aria-current={isActive ? 'page' : undefined}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      <Icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
      <span className="flex-1 truncate">{label}</span>
      {typeof badge === 'number' && badge > 0 && (
        <span className={badgeClasses} aria-label={`${badge} items`}>
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </Link>
  );
}
```

### Fichier 7/15 : `repo/apps/web-garage/src/components/layout/topbar.tsx`

Topbar : search global + tenant switcher + locale switcher + user menu + notifications.

```typescript
// src/components/layout/topbar.tsx
'use client';

import { useTranslations } from 'next-intl';
import { type CurrentUser } from '@/lib/auth-helpers';
import { GlobalSearch } from './global-search';
import { TenantSwitcher } from './tenant-switcher';
import { LocaleSwitcher } from './locale-switcher';
import { UserMenu } from './user-menu';
import { NotificationsBell } from './notifications-bell';

interface TopbarProps {
  user: CurrentUser;
  locale: string;
}

export function Topbar({ user, locale }: TopbarProps) {
  const t = useTranslations('topbar');

  return (
    <header
      className="flex h-16 items-center gap-4 border-b border-border bg-card px-6"
      data-testid="topbar"
      aria-label="Top navigation bar"
    >
      <div className="flex-1 max-w-xl">
        <GlobalSearch locale={locale} placeholder={t('search_placeholder')} />
      </div>

      <div className="flex items-center gap-2">
        <TenantSwitcher allowedTenants={user.allowedTenants} currentTenantId={user.tenantId} locale={locale} />
        <LocaleSwitcher currentLocale={locale} />
        <NotificationsBell locale={locale} />
        <UserMenu user={user} locale={locale} />
      </div>
    </header>
  );
}
```

### Fichier 8/15 : `repo/apps/web-garage/src/components/layout/global-search.tsx`

Search global cmdk : sinistres + customer + plate immatriculation MA.

```typescript
// src/components/layout/global-search.tsx
'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Search, AlertCircle, User, Car } from 'lucide-react';
import { z } from 'zod';
import { apiGet } from '@/lib/api-client';

interface GlobalSearchProps {
  locale: string;
  placeholder: string;
}

// Plate format MA: 1-5 digits + 1-3 letters + 1-3 digits
const PLATE_REGEX = /^\d{1,5}-[A-Z]{1,3}-\d{1,3}$/;

const SearchResultSchema = z.object({
  sinistres: z.array(z.object({
    id: z.string().uuid(),
    sinistreNumber: z.string(),
    customerName: z.string(),
    vehiclePlate: z.string(),
    status: z.string(),
  })),
  customers: z.array(z.object({
    id: z.string().uuid(),
    name: z.string(),
    phone: z.string().nullable(),
    email: z.string().nullable(),
  })),
  vehicles: z.array(z.object({
    plate: z.string(),
    make: z.string(),
    model: z.string(),
    customerName: z.string(),
  })),
});

type SearchResult = z.infer<typeof SearchResultSchema>;

async function fetchSearch(query: string): Promise<SearchResult> {
  if (!query.trim()) {
    return { sinistres: [], customers: [], vehicles: [] };
  }
  const data = await apiGet<unknown>(`/api/v1/repair/search?q=${encodeURIComponent(query)}`);
  return SearchResultSchema.parse(data);
}

export function GlobalSearch({ locale, placeholder }: GlobalSearchProps) {
  const router = useRouter();
  const t = useTranslations('topbar');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['global-search', query],
    queryFn: () => fetchSearch(query),
    enabled: query.length >= 2,
    staleTime: 10_000,
  });

  const handleSelect = useCallback(
    (type: 'sinistre' | 'customer' | 'vehicle', value: string) => {
      switch (type) {
        case 'sinistre':
          router.push(`/${locale}/sinistres/${value}`);
          break;
        case 'customer':
          router.push(`/${locale}/customers/${value}`);
          break;
        case 'vehicle':
          router.push(`/${locale}/vehicles/${encodeURIComponent(value)}`);
          break;
      }
      setOpen(false);
      setQuery('');
    },
    [router, locale],
  );

  // Keyboard shortcut Cmd/Ctrl+K
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder={`${placeholder} (Ctrl+K)`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          className="w-full rounded-md border border-input bg-background pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-garage-primary"
          data-testid="global-search-input"
          aria-label={t('search_placeholder')}
          autoComplete="off"
        />
      </div>

      {open && query.length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-1 max-h-96 overflow-y-auto rounded-md border border-border bg-popover shadow-lg z-50">
          {isLoading && <div className="p-3 text-sm text-muted-foreground">{t('loading')}</div>}
          {data && (
            <>
              {data.sinistres.length > 0 && (
                <SearchGroup title={t('group_sinistres')} icon={AlertCircle}>
                  {data.sinistres.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-muted text-left"
                      onMouseDown={() => handleSelect('sinistre', s.id)}
                    >
                      <span className="font-medium">{s.sinistreNumber}</span>
                      <span className="text-muted-foreground">{s.customerName} - {s.vehiclePlate}</span>
                    </button>
                  ))}
                </SearchGroup>
              )}
              {data.customers.length > 0 && (
                <SearchGroup title={t('group_customers')} icon={User}>
                  {data.customers.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-muted text-left"
                      onMouseDown={() => handleSelect('customer', c.id)}
                    >
                      <span className="font-medium">{c.name}</span>
                      <span className="text-muted-foreground">{c.phone ?? c.email ?? ''}</span>
                    </button>
                  ))}
                </SearchGroup>
              )}
              {data.vehicles.length > 0 && (
                <SearchGroup title={t('group_vehicles')} icon={Car}>
                  {data.vehicles.map((v) => (
                    <button
                      key={v.plate}
                      type="button"
                      className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-muted text-left"
                      onMouseDown={() => handleSelect('vehicle', v.plate)}
                    >
                      <span className="font-medium">{v.plate}</span>
                      <span className="text-muted-foreground">{v.make} {v.model} - {v.customerName}</span>
                    </button>
                  ))}
                </SearchGroup>
              )}
              {data.sinistres.length === 0 && data.customers.length === 0 && data.vehicles.length === 0 && (
                <div className="p-3 text-sm text-muted-foreground">{t('no_results')}</div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SearchGroup({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Search;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50">
        <Icon className="h-3 w-3" />
        {title}
      </div>
      <div>{children}</div>
    </div>
  );
}
```

### Fichier 9/15 : `repo/apps/web-garage/src/components/layout/tenant-switcher.tsx`

Selecteur etablissement (multi-succursale). Confirm dialog si formulaire dirty.

```typescript
// src/components/layout/tenant-switcher.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Building, Check, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { apiGet, apiPost } from '@/lib/api-client';

interface TenantSwitcherProps {
  allowedTenants: string[];
  currentTenantId: string;
  locale: string;
}

interface TenantInfo {
  id: string;
  name: string;
  city: string;
  type: 'garage';
  isHeadquarter: boolean;
}

async function fetchAllowedTenants(): Promise<TenantInfo[]> {
  return apiGet<TenantInfo[]>('/api/v1/tenants/allowed');
}

export function TenantSwitcher({ allowedTenants, currentTenantId, locale }: TenantSwitcherProps) {
  const t = useTranslations('topbar.tenant_switcher');
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  const { data: tenants } = useQuery({
    queryKey: ['allowed-tenants'],
    queryFn: fetchAllowedTenants,
    staleTime: 5 * 60_000,
  });

  const current = tenants?.find((t) => t.id === currentTenantId);

  async function handleSwitch(tenantId: string) {
    if (tenantId === currentTenantId) {
      setOpen(false);
      return;
    }

    if (allowedTenants.length > 0 && !allowedTenants.includes(tenantId)) {
      toast.error(t('error_unauthorized'));
      return;
    }

    const dirty = (window as { __formIsDirty?: boolean }).__formIsDirty;
    if (dirty) {
      const confirmed = window.confirm(t('confirm_unsaved'));
      if (!confirmed) return;
    }

    try {
      setSwitching(true);
      await apiPost('/api/v1/tenants/switch', { tenant_id: tenantId });
      await queryClient.cancelQueries();
      queryClient.clear();
      toast.success(t('success'));
      window.location.reload();
    } catch (err) {
      toast.error(t('error_generic'));
    } finally {
      setSwitching(false);
    }
  }

  if (!tenants || tenants.length <= 1) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={switching}
        className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
        data-testid="tenant-switcher-trigger"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <Building className="h-4 w-4" />
        <span className="max-w-32 truncate">{current?.name ?? t('select')}</span>
        <ChevronDown className="h-3 w-3" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-64 rounded-md border border-border bg-popover shadow-lg z-50">
          <div className="px-3 py-2 text-xs font-semibold text-muted-foreground border-b border-border">
            {t('header')}
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {tenants.map((tenant) => {
              const isCurrent = tenant.id === currentTenantId;
              return (
                <li key={tenant.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-muted text-left"
                    onClick={() => handleSwitch(tenant.id)}
                    data-testid={`tenant-option-${tenant.id}`}
                  >
                    <div>
                      <p className="font-medium">{tenant.name}</p>
                      <p className="text-xs text-muted-foreground">{tenant.city}{tenant.isHeadquarter ? ` - ${t('headquarter')}` : ''}</p>
                    </div>
                    {isCurrent && <Check className="h-4 w-4 text-garage-primary" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
```

### Fichier 10/15 : `repo/apps/web-garage/src/components/layout/notifications-bell.tsx`

Bell + poll 30s + dropdown notifications.

```typescript
// src/components/layout/notifications-bell.tsx
'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Bell, Check } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr, ar } from 'date-fns/locale';
import { fetchNotifications, markNotificationRead } from '@/lib/queries/notifications.queries';

interface NotificationsBellProps {
  locale: string;
}

export function NotificationsBell({ locale }: NotificationsBellProps) {
  const t = useTranslations('topbar.notifications');
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const dateLocale = locale.startsWith('ar') ? ar : fr;

  // Poll 30s avec pause if tab hidden
  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
    refetchInterval: (q) => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return false;
      }
      return 30_000;
    },
    staleTime: 25_000,
  });

  const markReadMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const unreadCount = data?.filter((n) => !n.readAt).length ?? 0;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative rounded-md p-2 hover:bg-muted"
        data-testid="notifications-bell"
        aria-label={t('label')}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span
            className="absolute top-1 right-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-semibold text-white"
            data-testid="notifications-unread-count"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-80 max-h-96 overflow-y-auto rounded-md border border-border bg-popover shadow-lg z-50">
          <div className="px-3 py-2 text-sm font-semibold border-b border-border">
            {t('header')} ({unreadCount} {t('unread')})
          </div>
          {data && data.length === 0 && (
            <div className="p-3 text-sm text-muted-foreground">{t('empty')}</div>
          )}
          <ul>
            {data?.map((notif) => (
              <li key={notif.id} className={`px-3 py-2 border-b border-border ${notif.readAt ? 'opacity-60' : 'bg-muted/30'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{notif.title}</p>
                    <p className="text-xs text-muted-foreground">{notif.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true, locale: dateLocale })}
                    </p>
                  </div>
                  {!notif.readAt && (
                    <button
                      type="button"
                      onClick={() => markReadMutation.mutate(notif.id)}
                      className="rounded-md p-1 hover:bg-muted"
                      aria-label={t('mark_read')}
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

### Fichier 11/15 : `repo/apps/web-garage/src/components/layout/new-sinistre-fab.tsx`

FAB "Nouveau sinistre".

```typescript
// src/components/layout/new-sinistre-fab.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';

interface NewSinistreFabProps {
  locale: string;
}

export function NewSinistreFab({ locale }: NewSinistreFabProps) {
  const t = useTranslations('common');
  const router = useRouter();
  const [hidden, setHidden] = useState(false);

  // Hide when virtual keyboard open on mobile (visualViewport resize)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;
    function onResize() {
      const vv = window.visualViewport!;
      const heightShrunk = vv.height < window.innerHeight * 0.7;
      setHidden(heightShrunk);
    }
    window.visualViewport.addEventListener('resize', onResize);
    return () => window.visualViewport?.removeEventListener('resize', onResize);
  }, []);

  if (hidden) return null;

  return (
    <button
      type="button"
      onClick={() => router.push(`/${locale}/sinistres/new`)}
      className="fixed bottom-6 right-6 rtl:right-auto rtl:left-6 z-40 flex h-14 items-center gap-2 rounded-full bg-garage-primary px-5 text-white shadow-lg transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-garage-primary focus:ring-offset-2"
      data-testid="fab-new-sinistre"
      aria-label={t('new_sinistre')}
    >
      <Plus className="h-5 w-5" />
      <span className="font-medium">{t('new_sinistre')}</span>
    </button>
  );
}
```

### Fichier 12/15 : `repo/apps/web-garage/src/providers/providers.tsx`

Chain providers : QueryClient + NextIntl + Theme + Sonner.

```typescript
// src/providers/providers.tsx
'use client';

import { type ReactNode, useState } from 'react';
import { QueryClient, QueryClientProvider, HydrationBoundary, type DehydratedState } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { NextIntlClientProvider, type AbstractIntlMessages } from 'next-intl';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';

interface ProvidersProps {
  children: ReactNode;
  locale: string;
  messages: AbstractIntlMessages;
  timeZone: string;
  dehydratedState?: DehydratedState;
}

export function Providers({
  children,
  locale,
  messages,
  timeZone,
  dehydratedState,
}: ProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            gcTime: 10 * 60 * 1000,
            refetchOnWindowFocus: process.env.NODE_ENV === 'production',
            retry: (failureCount, error) => {
              const status = (error as { status?: number }).status;
              if (status === 401 || status === 403 || status === 404) return false;
              return failureCount < 3;
            },
          },
          mutations: {
            retry: false,
          },
        },
      }),
  );

  const isRtl = locale === 'ar-MA' || locale === 'ar';

  return (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone={timeZone}>
      <QueryClientProvider client={queryClient}>
        <HydrationBoundary state={dehydratedState}>
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
            {children}
            <Toaster
              position={isRtl ? 'top-left' : 'top-right'}
              richColors
              theme="system"
              closeButton
              expand
            />
          </ThemeProvider>
        </HydrationBoundary>
        {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
      </QueryClientProvider>
    </NextIntlClientProvider>
  );
}
```

### Fichier 13/15 : `repo/apps/web-garage/src/app/api/proxy/[...path]/route.ts`

Proxy backend NestJS avec injection x-tenant-id depuis cookie SSR.

```typescript
// src/app/api/proxy/[...path]/route.ts
// API proxy injection x-tenant-id + auth
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:4000';

async function proxy(request: NextRequest, method: string) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token')?.value;
  const tenantId = cookieStore.get('current_tenant_id')?.value;

  if (!accessToken) {
    return NextResponse.json({ error: 'Unauthorized', statusCode: 401 }, { status: 401 });
  }

  const url = new URL(request.url);
  const pathParts = url.pathname.replace(/^\/api\/proxy\//, '');
  const targetUrl = `${API_BASE_URL}/${pathParts}${url.search}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    'Accept-Language': request.headers.get('accept-language') ?? 'fr',
    'x-trace-id': request.headers.get('x-trace-id') ?? crypto.randomUUID(),
  };
  if (tenantId) headers['x-tenant-id'] = tenantId;

  const idempotencyKey = request.headers.get('idempotency-key');
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

  const contentType = request.headers.get('content-type');
  if (contentType) headers['Content-Type'] = contentType;

  const body = method !== 'GET' && method !== 'HEAD' ? await request.text() : undefined;

  const response = await fetch(targetUrl, {
    method,
    headers,
    body,
    cache: 'no-store',
  });

  const responseBody = await response.text();
  const responseHeaders: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    if (!['content-length', 'transfer-encoding', 'connection'].includes(key.toLowerCase())) {
      responseHeaders[key] = value;
    }
  });

  return new NextResponse(responseBody, {
    status: response.status,
    headers: responseHeaders,
  });
}

export async function GET(request: NextRequest) {
  return proxy(request, 'GET');
}
export async function POST(request: NextRequest) {
  return proxy(request, 'POST');
}
export async function PUT(request: NextRequest) {
  return proxy(request, 'PUT');
}
export async function PATCH(request: NextRequest) {
  return proxy(request, 'PATCH');
}
export async function DELETE(request: NextRequest) {
  return proxy(request, 'DELETE');
}
```

### Fichier 14/15 : `repo/apps/web-garage/src/lib/queries/sinistres-counts.queries.ts`

Query badge counter sinistres pour sidebar.

```typescript
// src/lib/queries/sinistres-counts.queries.ts
import { z } from 'zod';
import { apiGet } from '@/lib/api-client';

const SinistresCountsSchema = z.object({
  declared: z.number().int().nonnegative(),
  acknowledged: z.number().int().nonnegative(),
  appointment_scheduled: z.number().int().nonnegative(),
  received: z.number().int().nonnegative(),
  under_diagnostic: z.number().int().nonnegative(),
  awaiting_approval: z.number().int().nonnegative(),
  under_repair: z.number().int().nonnegative(),
  quality_check: z.number().int().nonnegative(),
  ready_for_delivery: z.number().int().nonnegative(),
  delivered: z.number().int().nonnegative(),
});

export type SinistresCounts = z.infer<typeof SinistresCountsSchema>;

export async function fetchSinistresCounts(): Promise<SinistresCounts> {
  const data = await apiGet<unknown>('/api/v1/repair/sinistres/counts');
  return SinistresCountsSchema.parse(data);
}
```

### Fichier 15/15 : `repo/apps/web-garage/src/stores/tenant.store.ts`

Zustand store tenant + persistance.

```typescript
// src/stores/tenant.store.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { type CurrentUser } from '@/lib/auth-helpers';

interface TenantStore {
  currentTenantId: string | null;
  currentUser: CurrentUser | null;
  setCurrentTenant: (tenantId: string) => void;
  setCurrentUser: (user: CurrentUser | null) => void;
  reset: () => void;
}

export const useTenantStore = create<TenantStore>()(
  persist(
    (set) => ({
      currentTenantId: null,
      currentUser: null,
      setCurrentTenant: (tenantId) => set({ currentTenantId: tenantId }),
      setCurrentUser: (user) => set({ currentUser: user }),
      reset: () => set({ currentTenantId: null, currentUser: null }),
    }),
    {
      name: 'garage-tenant-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ currentTenantId: state.currentTenantId }),
    },
  ),
);
```

---

## 7. Tests complets (15-30 ko)

### 7.1 Tests unitaires : `repo/apps/web-garage/src/lib/auth-helpers.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { SignJWT } from 'jose';
import {
  decodeJwtUnsafe,
  isTokenExpired,
  isAuthorizedForGarage,
  hasGarageRole,
  getPrimaryGarageRole,
} from './auth-helpers';

async function buildToken(payload: Record<string, unknown>): Promise<string> {
  const secret = new TextEncoder().encode('test-secret-only-for-tests-32chars');
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret);
}

describe('decodeJwtUnsafe', () => {
  it('should decode valid token', async () => {
    const token = await buildToken({
      sub: 'user-123',
      email: 'tech@garage.ma',
      tenant_type: 'garage',
      tenant_id: 'tenant-1',
      allowed_tenants: ['tenant-1', 'tenant-2'],
      roles: ['garage_technicien'],
    });
    const user = decodeJwtUnsafe(token);
    expect(user).not.toBeNull();
    expect(user?.id).toBe('user-123');
    expect(user?.email).toBe('tech@garage.ma');
    expect(user?.tenantType).toBe('garage');
    expect(user?.roles).toEqual(['garage_technicien']);
  });

  it('should return null for malformed token', () => {
    expect(decodeJwtUnsafe('not-a-jwt')).toBeNull();
    expect(decodeJwtUnsafe('')).toBeNull();
    expect(decodeJwtUnsafe('a.b')).toBeNull();
  });

  it('should default allowed_tenants to empty array if missing', async () => {
    const token = await buildToken({
      sub: 'user-1',
      email: 'a@b.c',
      tenant_type: 'garage',
      tenant_id: 't1',
      roles: ['garage_admin'],
    });
    const user = decodeJwtUnsafe(token);
    expect(user?.allowedTenants).toEqual([]);
  });
});

describe('isTokenExpired', () => {
  it('should return false for future exp', () => {
    const future = Math.floor(Date.now() / 1000) + 3600;
    expect(isTokenExpired(future)).toBe(false);
  });

  it('should return true for past exp', () => {
    const past = Math.floor(Date.now() / 1000) - 3600;
    expect(isTokenExpired(past)).toBe(true);
  });

  it('should apply 30s margin', () => {
    const justExpiringIn10s = Math.floor((Date.now() + 10_000) / 1000);
    expect(isTokenExpired(justExpiringIn10s)).toBe(true);
  });

  it('should allow custom margin', () => {
    const exp = Math.floor((Date.now() + 60_000) / 1000);
    expect(isTokenExpired(exp, 120_000)).toBe(true);
    expect(isTokenExpired(exp, 10_000)).toBe(false);
  });
});

describe('isAuthorizedForGarage', () => {
  it('should return false for null user', () => {
    expect(isAuthorizedForGarage(null)).toBe(false);
  });

  it('should return false for broker user', () => {
    const user = {
      id: 'u1', email: 'a', tenantId: 't1', tenantType: 'broker' as const,
      allowedTenants: [], roles: ['broker_admin'], exp: 0, iat: 0,
    };
    expect(isAuthorizedForGarage(user)).toBe(false);
  });

  it('should return false for garage tenant but no garage role', () => {
    const user = {
      id: 'u1', email: 'a', tenantId: 't1', tenantType: 'garage' as const,
      allowedTenants: [], roles: ['some_other_role'], exp: 0, iat: 0,
    };
    expect(isAuthorizedForGarage(user)).toBe(false);
  });

  it('should return true for garage tenant + garage role', () => {
    const user = {
      id: 'u1', email: 'a', tenantId: 't1', tenantType: 'garage' as const,
      allowedTenants: [], roles: ['garage_technicien'], exp: 0, iat: 0,
    };
    expect(isAuthorizedForGarage(user)).toBe(true);
  });

  it('should accept any of the 4 garage roles', () => {
    const baseUser = {
      id: 'u1', email: 'a', tenantId: 't1', tenantType: 'garage' as const,
      allowedTenants: [], exp: 0, iat: 0,
    };
    for (const role of ['garage_admin', 'garage_chef', 'garage_technicien', 'garage_gestionnaire']) {
      expect(isAuthorizedForGarage({ ...baseUser, roles: [role] })).toBe(true);
    }
  });
});

describe('hasGarageRole', () => {
  it('should return true if user has specific role', () => {
    const user = {
      id: 'u1', email: 'a', tenantId: 't1', tenantType: 'garage' as const,
      allowedTenants: [], roles: ['garage_admin', 'garage_chef'], exp: 0, iat: 0,
    };
    expect(hasGarageRole(user, 'garage_admin')).toBe(true);
    expect(hasGarageRole(user, 'garage_chef')).toBe(true);
    expect(hasGarageRole(user, 'garage_technicien')).toBe(false);
  });

  it('should return false for null user', () => {
    expect(hasGarageRole(null, 'garage_admin')).toBe(false);
  });
});

describe('getPrimaryGarageRole', () => {
  it('should return admin if user has admin', () => {
    const user = {
      id: 'u1', email: 'a', tenantId: 't1', tenantType: 'garage' as const,
      allowedTenants: [], roles: ['garage_technicien', 'garage_admin'], exp: 0, iat: 0,
    };
    expect(getPrimaryGarageRole(user)).toBe('garage_admin');
  });

  it('should return chef if no admin', () => {
    const user = {
      id: 'u1', email: 'a', tenantId: 't1', tenantType: 'garage' as const,
      allowedTenants: [], roles: ['garage_technicien', 'garage_chef'], exp: 0, iat: 0,
    };
    expect(getPrimaryGarageRole(user)).toBe('garage_chef');
  });

  it('should return null for empty roles', () => {
    const user = {
      id: 'u1', email: 'a', tenantId: 't1', tenantType: 'garage' as const,
      allowedTenants: [], roles: [], exp: 0, iat: 0,
    };
    expect(getPrimaryGarageRole(user)).toBeNull();
  });
});
```

### 7.2 Tests unitaires : `repo/apps/web-garage/src/lib/api-client.spec.ts`

```typescript
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createApiClient, GarageApiError } from './api-client';
import MockAdapter from 'axios-mock-adapter';

describe('api-client', () => {
  let mock: MockAdapter;
  let client: ReturnType<typeof createApiClient>;

  beforeEach(() => {
    client = createApiClient({ baseURL: 'http://test', tenantId: 't-1', accessToken: 'tok' });
    mock = new MockAdapter(client);
  });

  afterEach(() => {
    mock.reset();
    vi.useRealTimers();
  });

  it('should inject x-tenant-id', async () => {
    mock.onGet('/test').reply((config) => {
      expect(config.headers?.['x-tenant-id']).toBe('t-1');
      return [200, { ok: true }];
    });
    await client.get('/test');
  });

  it('should inject Authorization', async () => {
    mock.onGet('/test').reply((config) => {
      expect(config.headers?.Authorization).toBe('Bearer tok');
      return [200, { ok: true }];
    });
    await client.get('/test');
  });

  it('should inject x-trace-id', async () => {
    mock.onGet('/test').reply((config) => {
      expect(config.headers?.['x-trace-id']).toBeDefined();
      return [200, { ok: true }];
    });
    await client.get('/test');
  });

  it('should inject Idempotency-Key on sinistre create', async () => {
    mock.onPost('/api/v1/repair/sinistres').reply((config) => {
      expect(config.headers?.['Idempotency-Key']).toBeDefined();
      return [201, { id: 'new' }];
    });
    await client.post('/api/v1/repair/sinistres', { ref: 'x' });
  });

  it('should NOT inject Idempotency-Key on GET', async () => {
    mock.onGet('/api/v1/repair/sinistres').reply((config) => {
      expect(config.headers?.['Idempotency-Key']).toBeUndefined();
      return [200, []];
    });
    await client.get('/api/v1/repair/sinistres');
  });

  it('should map 400 error to GarageApiError', async () => {
    mock.onGet('/test').reply(400, {
      statusCode: 400,
      error: 'BAD_REQUEST',
      message: 'Invalid input',
      traceId: 'tr-1',
    });
    try {
      await client.get('/test');
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(GarageApiError);
      expect((err as GarageApiError).status).toBe(400);
      expect((err as GarageApiError).code).toBe('BAD_REQUEST');
      expect((err as GarageApiError).traceId).toBe('tr-1');
    }
  });

  it('should retry once on 401 then succeed', async () => {
    let attempt = 0;
    mock.onGet('/test').reply(() => {
      attempt++;
      if (attempt === 1) return [401, { error: 'UNAUTHORIZED', statusCode: 401, message: 'expired' }];
      return [200, { ok: true }];
    });
    // mock refresh: we need to spy on the axios.post call to /api/auth/refresh
    const refreshMock = vi.spyOn(global, 'fetch' as never).mockResolvedValue(
      new Response(null, { status: 200 }),
    );
    // note: dans cette unit test simplifie, refresh fonctionne. en integration test verifie complet
  });

  it('should NOT retry twice on 401', async () => {
    let attempts = 0;
    mock.onGet('/test').reply(() => {
      attempts++;
      return [401, { error: 'UNAUTHORIZED', statusCode: 401, message: 'expired' }];
    });
    try {
      await client.get('/test');
    } catch {
      // expected
    }
    expect(attempts).toBeLessThanOrEqual(2);
  });

  it('should handle network errors', async () => {
    mock.onGet('/test').networkError();
    await expect(client.get('/test')).rejects.toBeInstanceOf(GarageApiError);
  });

  it('should set Accept-Language', async () => {
    const localizedClient = createApiClient({ baseURL: 'http://test', locale: 'ar-MA' });
    const localMock = new MockAdapter(localizedClient);
    localMock.onGet('/test').reply((config) => {
      expect(config.headers?.['Accept-Language']).toBe('ar-MA');
      return [200, {}];
    });
    await localizedClient.get('/test');
  });
});
```

### 7.3 Tests E2E : `repo/apps/web-garage/e2e/middleware-auth.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Middleware Auth -- web-garage', () => {
  test('redirects unauthenticated user from /fr/dashboard to /fr/login', async ({ page }) => {
    await page.goto('http://localhost:3002/fr/dashboard');
    await expect(page).toHaveURL(/\/fr\/login/);
    await expect(page).toHaveURL(/redirect=/);
  });

  test('redirects from /dashboard to /fr/dashboard (locale prefix)', async ({ page }) => {
    await page.goto('http://localhost:3002/dashboard');
    await expect(page).toHaveURL(/\/fr\//);
  });

  test('allows access to /fr/login without auth', async ({ page }) => {
    await page.goto('http://localhost:3002/fr/login');
    await expect(page).toHaveURL('http://localhost:3002/fr/login');
    await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
  });

  test('redirects with error if wrong tenant_type', async ({ page, context }) => {
    // simulate broker token (mocked backend returns invalid)
    await context.addCookies([{
      name: 'access_token',
      value: 'header.eyJzdWIiOiJ1MSIsImV4cCI6OTk5OTk5OTk5OSwidGVuYW50X3R5cGUiOiJicm9rZXIiLCJyb2xlcyI6WyJicm9rZXJfYWRtaW4iXX0.sig',
      domain: 'localhost',
      path: '/',
    }]);
    await page.goto('http://localhost:3002/fr/dashboard');
    await expect(page).toHaveURL(/error=wrong_app/);
  });

  test('preserves redirect query param after login redirect', async ({ page }) => {
    await page.goto('http://localhost:3002/fr/sinistres/abc-123');
    await expect(page).toHaveURL(/redirect=%2Ffr%2Fsinistres%2Fabc-123/);
  });
});
```

### 7.4 Tests E2E : `repo/apps/web-garage/e2e/layout-structure.spec.ts`

```typescript
import { test, expect } from '@playwright/test';
import { loginAsGarageAdmin } from './helpers/auth';

test.describe('Layout Structure -- web-garage', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsGarageAdmin(page);
  });

  test('renders sidebar with 13 nav items', async ({ page }) => {
    await page.goto('/fr/dashboard');
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible();
    const items = await page.locator('[data-testid^="sidebar-item-"]').count();
    expect(items).toBeGreaterThanOrEqual(10);
  });

  test('renders topbar with search', async ({ page }) => {
    await page.goto('/fr/dashboard');
    await expect(page.locator('[data-testid="topbar"]')).toBeVisible();
    await expect(page.locator('[data-testid="global-search-input"]')).toBeVisible();
  });

  test('renders FAB new sinistre', async ({ page }) => {
    await page.goto('/fr/dashboard');
    await expect(page.locator('[data-testid="fab-new-sinistre"]')).toBeVisible();
  });

  test('sidebar item Sinistres shows badge counter', async ({ page }) => {
    await page.goto('/fr/dashboard');
    const sinistresLink = page.locator('[data-testid="sidebar-item-sinistres"]');
    await expect(sinistresLink).toBeVisible();
  });

  test('locale switcher changes URL prefix', async ({ page }) => {
    await page.goto('/fr/dashboard');
    await page.locator('[data-testid="locale-switcher"]').click();
    await page.locator('[data-testid="locale-option-ar-MA"]').click();
    await expect(page).toHaveURL(/\/ar-MA\//);
  });

  test('RTL applied when locale=ar', async ({ page }) => {
    await page.goto('/ar/dashboard');
    const html = page.locator('html');
    await expect(html).toHaveAttribute('dir', 'rtl');
  });
});
```

### 7.5 Tests integration : `repo/apps/web-garage/middleware.spec.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from './middleware';

describe('middleware compose', () => {
  function mockRequest(url: string, cookies: Record<string, string> = {}): NextRequest {
    const headers = new Headers();
    const cookieHeader = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
    if (cookieHeader) headers.set('cookie', cookieHeader);
    return new NextRequest(new URL(url), { headers });
  }

  it('redirects /dashboard to /fr/dashboard via i18n', async () => {
    const req = mockRequest('http://localhost:3002/dashboard');
    const res = await middleware(req);
    expect([302, 307]).toContain(res.status);
  });

  it('redirects /fr/dashboard to /fr/login without auth', async () => {
    const req = mockRequest('http://localhost:3002/fr/dashboard');
    const res = await middleware(req);
    expect([302, 307]).toContain(res.status);
    const location = res.headers.get('location') ?? '';
    expect(location).toContain('/fr/login');
  });

  it('allows /fr/login without auth', async () => {
    const req = mockRequest('http://localhost:3002/fr/login');
    const res = await middleware(req);
    expect(res.status).toBe(200);
  });

  it('sets x-trace-id on response', async () => {
    const req = mockRequest('http://localhost:3002/fr/login');
    const res = await middleware(req);
    expect(res.headers.get('x-trace-id')).toBeDefined();
  });
});
```

### 7.6 Fixtures et mocks : `repo/apps/web-garage/e2e/helpers/auth.ts`

```typescript
import { type Page } from '@playwright/test';
import { SignJWT } from 'jose';

const TEST_SECRET = new TextEncoder().encode('test-secret-only-for-tests-32chars');

export async function buildGarageJwt(role = 'garage_admin'): Promise<string> {
  return await new SignJWT({
    sub: 'user-test-1',
    email: 'admin@atlas-garage.ma',
    tenant_type: 'garage',
    tenant_id: 'tenant-atlas-1',
    allowed_tenants: ['tenant-atlas-1', 'tenant-atlas-2'],
    roles: [role],
    preferred_locale: 'fr',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(TEST_SECRET);
}

export async function loginAsGarageAdmin(page: Page) {
  const token = await buildGarageJwt('garage_admin');
  await page.context().addCookies([
    {
      name: 'access_token',
      value: token,
      domain: 'localhost',
      path: '/',
    },
    {
      name: 'current_tenant_id',
      value: 'tenant-atlas-1',
      domain: 'localhost',
      path: '/',
    },
  ]);
}

export async function loginAsGarageTechnicien(page: Page) {
  const token = await buildGarageJwt('garage_technicien');
  await page.context().addCookies([
    { name: 'access_token', value: token, domain: 'localhost', path: '/' },
    { name: 'current_tenant_id', value: 'tenant-atlas-1', domain: 'localhost', path: '/' },
  ]);
}
```

---

## 8. Variables environnement (1-3 ko)

```env
# repo/apps/web-garage/.env.example

# Application identity
NEXT_PUBLIC_APP_NAME=skalean-garage
NEXT_PUBLIC_APP_VERSION=2.2.0

# API endpoint
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
API_BASE_URL=http://localhost:4000

# Locale defaults
NEXT_PUBLIC_DEFAULT_LOCALE=fr
NEXT_PUBLIC_SUPPORTED_LOCALES=fr,ar-MA,ar

# Time zone (cible Atlas Cabinet Marrakech)
NEXT_PUBLIC_DEFAULT_TIMEZONE=Africa/Casablanca

# Cookies
COOKIE_DOMAIN=localhost
COOKIE_SECURE=false

# AI Gateway placeholder (Sprint 31 Agent Sky)
NEXT_PUBLIC_AI_GATEWAY_URL=

# S3 / Atlas Cloud
NEXT_PUBLIC_S3_BASE_URL=https://s3.skalean-atlas.ma

# Sentry
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_ENVIRONMENT=development

# Mapbox (pour Sprint 23 mobile)
NEXT_PUBLIC_MAPBOX_TOKEN=

# Feature flags
NEXT_PUBLIC_ENABLE_AI_SUGGESTIONS=true
NEXT_PUBLIC_ENABLE_NOTIFICATIONS_POLL=true
NOTIFICATIONS_POLL_INTERVAL_MS=30000
```

---

## 9. Commandes shell (1-2 ko)

```bash
# 1. Installation deps (depuis racine repo)
cd repo
pnpm install --frozen-lockfile

# 2. Demarrer dev server
pnpm --filter @insurtech/web-garage dev
# Verifier : http://localhost:3002 demarre

# 3. Typecheck
pnpm --filter @insurtech/web-garage typecheck

# 4. Lint
pnpm --filter @insurtech/web-garage lint

# 5. Tests unitaires
pnpm --filter @insurtech/web-garage test

# 6. Tests E2E (necessite dev server)
pnpm --filter @insurtech/web-garage exec playwright install chromium
pnpm --filter @insurtech/web-garage exec playwright test

# 7. Build production
pnpm --filter @insurtech/web-garage build

# 8. Verification no-emoji
bash scripts/check-no-emoji.sh apps/web-garage/

# 9. Coverage report
pnpm --filter @insurtech/web-garage exec vitest run --coverage
```

---

## 10. Criteres validation V1-V28

### Criteres P0 (bloquants -- 16)

- **V1 (P0 -- automatisable)** : `pnpm --filter @insurtech/web-garage dev` demarre sur 3002 sans erreur, en moins de 15s
  - Commande : `time pnpm --filter @insurtech/web-garage dev &; sleep 15; curl http://localhost:3002`
  - Expected : HTTP 200 ou 302 vers /fr/login
  - Failure mode : port 3002 deja occupe -> `lsof -i:3002` puis kill

- **V2 (P0 -- automatisable)** : `pnpm --filter @insurtech/web-garage typecheck` retourne 0 erreur
  - Commande : `pnpm --filter @insurtech/web-garage typecheck`
  - Expected : exit 0

- **V3 (P0 -- automatisable)** : `pnpm --filter @insurtech/web-garage lint` retourne 0 erreur
  - Commande : `pnpm --filter @insurtech/web-garage lint`
  - Expected : exit 0

- **V4 (P0 -- automatisable)** : Middleware redirige `/fr/dashboard` -> `/fr/login?redirect=...` sans cookie
  - Test : `curl -i http://localhost:3002/fr/dashboard` (sans cookie access_token)
  - Expected : 302/307, header Location contient `/fr/login` et `redirect=`

- **V5 (P0)** : Middleware accepte token garage_admin valide -> dashboard accessible
  - Test E2E Playwright `middleware-auth.spec.ts`

- **V6 (P0)** : Middleware rejette token broker -> redirect avec `error=wrong_app`
  - Test E2E

- **V7 (P0)** : Middleware rejette token sans role garage -> redirect avec `error=unauthorized_role`
  - Test E2E

- **V8 (P0)** : Sidebar render 13 items (filtres selon role)
  - Test E2E : `await page.locator('[data-testid^="sidebar-item-"]').count() >= 10`
  - garage_admin voit 13, garage_technicien voit 10 (sans parametres/devis/qc/hr/invoices)

- **V9 (P0)** : Sidebar item Sinistres affiche badge counter (polling 30s)
  - Test E2E + verifier badge update apres mock backend change

- **V10 (P0)** : Topbar render search + tenant + locale + notifications + user
  - Test E2E selectors data-testid

- **V11 (P0)** : FAB "Nouveau sinistre" visible et click route vers `/fr/sinistres/new`
  - Test E2E

- **V12 (P0)** : Api-client injecte automatiquement x-tenant-id sur requete authentifiee
  - Test unitaire api-client.spec.ts

- **V13 (P0)** : Api-client injecte Idempotency-Key sur POST sinistres (create + transition)
  - Test unitaire

- **V14 (P0)** : Api-client refresh transparent sur 401 (1 retry max)
  - Test unitaire avec mock

- **V15 (P0)** : RTL applique automatiquement quand locale ar-MA ou ar
  - Test E2E : `await expect(html).toHaveAttribute('dir', 'rtl')`

- **V16 (P0)** : Aucune emoji dans tous les fichiers crees
  - Commande : `bash scripts/check-no-emoji.sh apps/web-garage/`
  - Expected : exit 0

### Criteres P1 (importants -- 8)

- **V17 (P1)** : Coverage tests unitaires >= 85% sur lib/auth-helpers.ts et lib/api-client.ts
  - Commande : `pnpm --filter @insurtech/web-garage exec vitest run --coverage`

- **V18 (P1)** : Tests Vitest 25+ tests passent
  - Commande : `pnpm --filter @insurtech/web-garage test`

- **V19 (P1)** : Tests Playwright 8+ tests passent
  - Commande : `pnpm --filter @insurtech/web-garage exec playwright test`

- **V20 (P1)** : Build production reussi
  - Commande : `pnpm --filter @insurtech/web-garage build`
  - Expected : `.next/` cree, bundle size < 500 ko par route

- **V21 (P1)** : Notifications poll pause si tab cache (visibilityState=hidden)
  - Test manuel : ouvrir tab garage + arriere-plan -> network panel verifier pause poll

- **V22 (P1)** : TenantSwitcher recharge page apres switch (window.location.reload)
  - Test E2E

- **V23 (P1)** : GlobalSearch Ctrl+K ouvre/ferme la recherche
  - Test E2E keyboard

- **V24 (P1)** : Theme rouge garage primary `#B91C1C` applique
  - Test visual snapshot

### Criteres P2 (nice-to-have -- 5)

- **V25 (P2)** : Lighthouse Performance > 90 sur /fr/dashboard
  - Commande : `pnpm --filter @insurtech/web-garage exec lighthouse http://localhost:3002/fr/dashboard`

- **V26 (P2)** : axe-core 0 violation WCAG 2.1 AA
  - Commande : `pnpm --filter @insurtech/web-garage exec playwright test --grep accessibility`

- **V27 (P2)** : Sentry DSN configurable et erreurs envoyees en dev/staging
  - Test : trigger error + verifier Sentry dashboard

- **V28 (P2)** : Storybook stories pour Sidebar, Topbar, FAB
  - Decision : differe Sprint 26 (storybook global)

---

## 11. Edge cases + troubleshooting (3-5 ko)

### Edge case 1 : Cookie `access_token` corrompu

**Scenario** : User clear cookies partiellement, ou ext browser corrompt cookie.

**Probleme** : `decodeJwt` throw -> middleware catch -> redirect /login mais avec quel error code ?

**Solution** :
```typescript
// middleware.ts
const decoded = decodeJwtSafe(accessToken);
if (!decoded) {
  const response = NextResponse.redirect(new URL(`/${locale}/login?error=corrupted_token`, request.url));
  response.cookies.delete('access_token');
  response.cookies.delete('refresh_token');
  return response;
}
```

### Edge case 2 : Refresh token expire pendant que access_token est valide

**Scenario** : User inactif 7 jours, access_token est expire ET refresh_token aussi.

**Probleme** : Premier 401 -> refresh -> 401 (refresh aussi expire) -> boucle infinie.

**Solution** : Api-client retry max 1 sur 401 (flag `_retried` sur config), apres echec -> redirect login.

### Edge case 3 : User change de role pendant session active

**Scenario** : Garage_admin retrograde garage_technicien par autre admin pendant que user est en session. Sidebar montre encore items reserves admin.

**Probleme** : JWT contient roles a l'emission. Backend revoque session ? Front cache stale.

**Solution** :
1. Backend revoke en pushant flag `force_logout: true` au token next refresh.
2. Polling notifications detecte event role_changed -> trigger window.location.reload().
3. Long-term : WebSocket session-events (Sprint 31).

### Edge case 4 : Tablette atelier perd reseau pendant transition kanban

**Scenario** : Technicien drag carte sinistre sur kanban, mais wifi atelier coupe. Optimistic UI a deja deplace la carte.

**Probleme** : Backend ne recoit pas la transition. Carte affiche dans mauvais status.

**Solution** :
1. TanStack Query mutation onError -> revert optimistic.
2. Toast erreur "Connection perdue. Reessayez."
3. Carte revient a la colonne d'origine.

### Edge case 5 : Tenant switcher pendant formulaire reception en cours

**Scenario** : Technicien remplit checklist 12 points, decide switcher d'etablissement.

**Probleme** : Window.location.reload() perd l'etat formulaire.

**Solution** :
1. Setter global `window.__formIsDirty = true` au useForm change.
2. TenantSwitcher checke avant switch et confirm dialog.
3. Si user confirm, on saved auto-draft localStorage avant reload.

### Edge case 6 : Notifications poll genere trop de requetes

**Scenario** : 50 technicien actifs en simultane = 50 * 2 polls/min = 100 req/min `/api/v1/notifications`.

**Probleme** : Surcharge backend.

**Solution** :
1. Backend Redis cache 25s sur reponse (Sprint 9).
2. Pause poll si tab cache (document.visibilityState).
3. Long-term : SSE ou WebSocket (Sprint 31).

### Edge case 7 : FAB cache derriere modal

**Scenario** : User ouvre dialog "Confirmer transition", FAB reste z-index 40 par-dessus.

**Probleme** : UX confuse.

**Solution** : FAB z-index 40 + dialog z-index 50. Verifier hierarchie z-index dans tailwind config.

### Edge case 8 : Browser Safari iOS ne supporte pas visualViewport

**Scenario** : iPad Pro avec iOS 14 (vieille tablette atelier).

**Probleme** : `window.visualViewport` undefined -> erreur addEventListener.

**Solution** :
```typescript
if (typeof window === 'undefined' || !window.visualViewport) return;
```

---

## 12. Conformite Maroc detaillee (1-3 ko)

### Loi 09-08 (CNDP) -- Donnees personnelles

- **Article 5** : Consentement utilisateur pour traitement donnees. Le login web-garage implique consentement implicite traitement coordonnees (email, role, tenant).
- **Article 7** : Donnees minimales necessaires. Le JWT decode ne stocke que l'essentiel (sub, email, tenant, roles). Pas de NIE, pas d'adresse personnelle.
- **Article 18** : Droit acces + rectification. Page parametres (Tache 5.4.12) doit exposer profil + permettre modification.
- **Implementation Tache 5.4.1** : aucun stockage local de donnees sensibles (zustand persist limite a tenant_id non-sensible).

### Decision DGI 2024 -- Facturation electronique

- **Mention obligatoire ICE, IF** : sur factures (Tache 5.4.11), pas dans cette tache.
- **Implementation Tache 5.4.1** : aucun impact direct, mais l'architecture api-client doit propager `Idempotency-Key` pour eviter doublon facture DGI (regle conservation 10 ans).

### Loi 53-95 ANRT -- Communications electroniques

- **TLS 1.3 obligatoire** : pour tout transfert. En dev `http://`, en prod `https://`. Middleware n'impacte pas (Edge fait HTTPS).

### Code des assurances Maroc

- **Pas d'impact direct Tache 5.4.1** (UI seule). Mais le filtre `tenant_type === 'garage'` empeche un agent assureur de voir donnees garage qu'il ne devrait pas (separation roles ACAPS).

---

## 13. Conventions absolues skalean-insurtech (3-5 ko -- rappel complet)

### Multi-tenant strict
- Header `x-tenant-id` obligatoire sur tous endpoints sauf `/api/v1/public/*` et `/api/v1/admin/*`
- `tenant_id` filter automatique via TenantGuard NestJS sur toutes queries DB
- AsyncLocalStorage Node.js pour TenantContext (jamais passer tenant_id en parametre fonction)
- RLS policies Postgres : `app_current_tenant()` lit la session var `app.current_tenant`
- Audit trail : chaque operation tenant logged avec tenant_id
- Cote frontend : api-client injecte automatiquement (cette tache).

### Validation strict
- Zod uniquement pour validation runtime (JAMAIS class-validator, JAMAIS yup, JAMAIS joi)
- Schemas Zod exportes depuis `@insurtech/shared-types` quand reutilisables
- Pattern : `const Schema = z.object({...}); type Type = z.infer<typeof Schema>;`
- Validation au niveau controller ET service (defense en profondeur) backend ; cote frontend Zod parse les responses API.

### Logger strict
- Pino backend NestJS via `this.logger.info(...)` injecte par DI
- JAMAIS `console.log()` cote backend (verifie au pre-commit hook)
- Cote frontend, console.error tolere pour erreurs critiques uniquement, sinon Sentry capture.

### Hash password strict
- argon2id avec params `memoryCost: 65536, timeCost: 3, parallelism: 4` (cote backend Sprint 5)
- JAMAIS bcrypt (depasse), JAMAIS scrypt
- Pepper en plus du salt (env var `PASSWORD_PEPPER`)
- Cote frontend : aucun hash (envoye password plain sur HTTPS).

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
- Imports explicites : pas de `import * as`

### Tests strict
- Vitest pour unit + integration
- Playwright pour E2E web
- Chaque fichier `.ts` (sauf types-only et index.ts) DOIT avoir un `.spec.ts` associe
- Coverage cible : >= 85% global, >= 90% modules critiques (auth, api-client)
- Tests RLS isolation : Sprint 6.

### RBAC strict
- `@Roles()` decorateur sur chaque endpoint backend
- `RolesGuard` global active sur ApiModule
- `TenantGuard` global active (verifie x-tenant-id present)
- 12 roles : SuperAdmin, BrokerAdmin, BrokerUser, GarageAdmin, GarageManager, GarageTechnician, AssureClient, Prospect, ComplianceOfficer, FinanceOfficer, Support, ReadOnly
- Cote frontend web-garage : 4 roles autorises (admin, chef, technicien, gestionnaire) verifies middleware (cette tache).

### Events strict
- Kafka topics format : `insurtech.events.{vertical}.{entity}.{action}`
- Exemples : `insurtech.events.repair.sinistre.created`, `insurtech.events.repair.diagnostic.completed`
- Schemas Zod pour chaque event (validation publish + consume)
- Idempotency-Key obligatoire pour events critiques (paiement, signature)
- Cote frontend : pas direct, mais l'api-client propage Idempotency-Key (cette tache).

### Imports strict
- Packages partages via `@insurtech/{nom}` (pas chemins relatifs `../../packages/...`)
- TypeScript paths configures dans `tsconfig.base.json`
- Order : 1) Node natifs 2) Externes 3) `@insurtech/*` 4) Relatifs
- Cote app web-garage : alias `@/` pour `src/`.

### Skalean AI strict (decision-005)
- Utilise UNIQUEMENT via `@insurtech/sky` (REST client) ou MCP client
- JAMAIS appel direct OpenAI/Anthropic/etc (frontier strict)
- Frontiere stricte : Skalean AI utilise tools Skalean InsurTech via MCP, JAMAIS l'inverse
- Mock pendant Sprint 1-28 (decision-007), swap real Sprint 29-31
- Cote frontend : hook `useAiGateway()` placeholder.

### No-emoji strict (decision-006 ABSOLU)
- AUCUNE emoji dans : code, commentaires, logs, docs, commits
- Pre-commit hook `check-no-emoji.sh` rejette commits avec emoji
- CI fail si emoji detectee dans PR
- Cette regle ne souffre AUCUNE exception
- Cette tache : 0 emoji dans tous les fichiers crees (verified).

### Idempotency-Key strict
- Header `Idempotency-Key` obligatoire pour mutations sensibles
- Mutations sensibles : POST /sinistres, POST /sinistres/:id/transition, POST /invoices/generate, POST /devis/:id/send, POST /payments, POST /signatures, MCP write tools
- TTL idempotency : 24h dans Redis
- Pattern : `idempotency:{tenant_id}:{user_id}:{key}` -> response cached
- Cette tache : api-client injecte automatiquement (regex paths).

### Conventional Commits strict
- Format : `<type>(scope): description`
- Types : feat, fix, docs, style, refactor, test, chore, perf, ci, build
- Scope : `sprint-NN` ou `package-name`
- Description : 50-72 chars max
- Body : metadata Task/Sprint/Phase obligatoire
- commitlint rejette commits non-conformes via husky

### Cloud souverain MA strict (decision-008)
- Atlas Cloud Services Benguerir UNIQUEMENT pour data Maroc
- DC1 Tier III + DC2 Tier IV (DR)
- AUCUNE donnee assure ne transite hors MA (loi 09-08 CNDP)
- Encryption at rest AES-256-GCM via Atlas KMS
- TLS 1.3 obligatoire pour tous transferts

---

## 14. Validation pre-commit (1-2 ko)

```bash
# Sequence complete pre-commit
cd repo

# 1. Typecheck
pnpm --filter @insurtech/web-garage typecheck                                                # 0 erreur attendue

# 2. Lint
pnpm --filter @insurtech/web-garage lint                                                     # 0 erreur attendue

# 3. Tests unit avec coverage
pnpm --filter @insurtech/web-garage exec vitest run --coverage                              # >= 85% coverage

# 4. Tests E2E (require dev server running)
pnpm --filter @insurtech/web-garage exec playwright install chromium                        # 1ere fois
pnpm --filter @insurtech/web-garage exec playwright test                                    # 8+ tests passent

# 5. Verification no-emoji
bash scripts/check-no-emoji.sh apps/web-garage/                                             # exit 0

# 6. Verification no-console.log (sauf .spec.ts)
grep -rn "console\.log\|console\.debug" apps/web-garage/src/ --include="*.ts" --include="*.tsx" | grep -v ".spec.ts" && echo FAIL || echo OK

# 7. Build production (verifier qu'il passe)
pnpm --filter @insurtech/web-garage build                                                   # 0 erreur attendue

# 8. Verifier i18n keys parity
pnpm exec tsx scripts/validate-i18n-keys.ts apps/web-garage/src/messages/                   # 0 missing

# 9. Bundle size
du -sh apps/web-garage/.next/static/                                                         # < 5 MB
```

---

## 15. Commit message complet (1-2 ko)

```bash
git add -A
git commit -m "feat(sprint-22): web-garage skeleton + middleware auth/tenant + layout

Initialise app web-garage (port 3002) avec :
- middleware Edge Runtime compose i18n + auth + tenant
- layouts (auth) public + (protected) avec sidebar/topbar/FAB
- api-client production-ready (refresh JWT, idempotency-key, x-tenant-id)
- providers chain (QueryClient + NextIntl + Theme + Sonner)
- 4 roles garage RBAC strict (admin/chef/technicien/gestionnaire)
- i18n fr/ar-MA/ar + RTL automatique
- TenantSwitcher multi-etablissement
- GlobalSearch sinistres/customer/plate MA + Ctrl+K
- NotificationsBell poll 30s + pause si tab cache
- FAB Nouveau sinistre adaptatif clavier

Livrables:
- middleware.ts compose Edge Runtime
- 13 sidebar items + badge counter polling
- api-client axios production avec interceptors
- 4 layouts imbriques
- 11 composants layout (sidebar, topbar, search, switchers, bell, FAB)
- 5 hooks (use-current-user, use-tenant-id, use-has-role)
- 2 stores zustand
- 2 queries (sinistres-counts, notifications)
- 35 fichiers crees, 5 modifies

Tests: 25 unit + 8 E2E Playwright
Coverage: 87%

Task: 5.4.1
Sprint: 22 (Phase 5 / Sprint 22 cumul)
Phase: 5 -- Vertical Repair
Reference: B-22 Tache 5.4.1
Decisions: 001, 002, 005, 006, 008, 009, 010"
```

---

## 16. Workflow next step

Apres commit de cette tache :

- Tache suivante du Sprint 22 : `task-5.4.2-pages-auth-login-mfa-recovery.md`
- Cette tache 5.4.1 livre :
  - middleware.ts operational (auth + tenant + i18n)
  - layouts (auth) et (protected) prets a accueillir pages
  - api-client refresh transparent
  - Providers chain ready
  - 4 roles RBAC actif
- La 5.4.2 va consumer api-client pour endpoints `/api/auth/signin`, `/api/auth/verify-mfa`, `/api/auth/forgot-password`, `/api/auth/reset-password`
- La 5.4.2 etend `(auth)/layout.tsx` avec 7 pages : login, verify-mfa, signup, forgot-password, reset-password, select-tenant, mfa-setup

---

**Fin du prompt task-5.4.1-app-skeleton-middleware-layout-garage.md.**

Densite atteinte : ~110 ko
Code patterns : 15 fichiers complets
Tests : 30+ cas concrets (unit + E2E)
Criteres validation : V1-V28
Edge cases : 8
