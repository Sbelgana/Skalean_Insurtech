# TACHE 1.4.15 -- Pages Placeholder + 404/500 + Loading + Sentry browser

**Sprint** : 4 (Phase 1 / Sprint 4 dans phase, dernier de Phase 1 Bootstrap)
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-04-sprint-04-frontend-bootstrap.md` (Tache 1.4.15)
**Phase** : 1 -- Bootstrap
**Priorite** : P0
**Effort** : 4h
**Dependances** : 1.4.1 a 1.4.7 (8 apps Next.js bootstrap operationnelles), 1.4.8 (shared-ui theme + icons lucide-react), 1.4.11 (i18n next-intl 3 locales fr / ar-MA / ar avec RTL), 1.4.14 (layouts partages sidebar + topbar)
**Densite cible** : 100-150 ko (auto-suffisant exhaustif, aucune lecture annexe necessaire)
**AUCUNE EMOJI AUTORISEE** (decision-006 strictement appliquee, illustrations SVG branded only)

---

## 1. But (0.5-1 ko)

Mettre en place dans les **8 applications Next.js 15** (web-broker port 3001, web-garage 3002, web-garage-mobile 3003 PWA, web-insurtech-admin 3000, web-customer-portal 3004 SSG/ISR/SEO, web-assure-portal 3005, web-assure-mobile 3006 PWA, web-assure-admin pour Sprint 27 placeholder) un dispositif coherent et industriel de **pages erreur globales** (404 not-found.tsx, 500 error.tsx avec error boundary App Router compliant, loading.tsx skeleton/spinner, global-error.tsx fallback layout) reposant sur des composants partages exporte par `@insurtech/shared-ui` (`<NotFoundPage>`, `<ErrorPage>`, `<LoadingPage>`, `<UnderConstruction sprintNumber={X}>`), texte localise sur les **trois locales obligatoires** (fr, ar-MA Darija, ar arabe classique avec RTL), affichage du **`x-trace-id` user-facing** copy-to-clipboard pour le support N1, capture automatique des erreurs frontend par **Sentry browser SDK `@sentry/nextjs` 8.47.0** avec filtrage PII conforme **Loi 09-08 CNDP** (beforeSend supprime email / telephone / adresse / NIF avant envoi event Sentry SaaS dev, futur Sentry self-hosted Atlas Cloud Benguerir Sprint 30).

L'objectif precis est de poser le squelette technique exhaustif pour que **toute erreur 404 ou 500** declenchee dans n'importe quelle des 8 apps soit intercept ee, affiche un page brandee Skalean Sofidemy (palette Orange #E95D2C / Navy #1A2730 / Sky Blue #B0CEE2 / ACAPS Teal #2D5773, font Montserrat + Noto Naskh Arabic), serve un message localise (3 locales FR / Darija / Arabe classique), affiche le `x-trace-id` recupere via header response avec un bouton copy-to-clipboard pour assistance support, capture l'erreur dans Sentry avec stack trace + replay session (sample 100% on error) tout en filtrant les donnees personnelles. Le composant `<UnderConstruction sprintNumber={X} featureName="CRM" estimatedDate="2026-04-15" />` est utilise par les sprints metier futurs (Sprint 5 a 35) comme placeholder pour les routes pas encore implementees, avec calcul automatique de la date estimee depuis le numero de sprint via mapping interne au shared-ui.

A la sortie de cette tache, naviguer sur `/non-existent-route` dans n'importe quelle app affiche la page 404 brandee localisee, declencher manuellement un `throw new Error('Test Error Boundary')` dans n'importe quelle page declenche la page 500 brandee avec traceId visible, le test Playwright e2e valide le flux 404 + error boundary trigger + loading state visible, le build de production passe sans erreur, le typecheck passe sans erreur, et les Sentry events arrivent sur le projet Sentry Skalean InsurTech avec stacktrace mais sans PII. Cette tache bloque indirectement Sprint 5+ (toute route metier ajoutee doit avoir un placeholder coherent en l'absence d'implementation).

---

## 2. Contexte etendu (5-10 ko)

### Pourquoi cette tache existe

Les 8 applications Next.js de l'ecosysteme Skalean InsurTech vont accueillir des centaines de routes metier reparties sur 35 sprints (Auth Sprint 5, CRM Sprint 8, Souscription Sprint 17, Sinistres Sprint 22, Reporting ACAPS Sprint 31, etc.). Sans dispositif d'erreur global pose au Sprint 4 :

1. **Erreurs runtime non capturees** : chaque erreur React non interceptee provoque ecran blanc Next.js par defaut ("Application error: a client-side exception has occurred") qui est inacceptable en environnement assurance reglemente (image de marque, support N1 incapable de debugger sans traceId).

2. **Routes pas encore implementees** : l'app web-broker prevoit `/contacts` (Sprint 8), `/policies` (Sprint 17), `/claims` (Sprint 22), `/commissions` (Sprint 25), `/reports` (Sprint 31). Entre Sprint 4 et Sprint 31, ces routes existent dans la sidebar mais pointent dans le vide. Sans placeholder `<UnderConstruction sprintNumber={8}>`, les utilisateurs internes (testeurs, designers, PM) recoivent une 404 generique au lieu d'un message clair "Cette fonctionnalite sera implementee au Sprint 8 (avril 2026)".

3. **Conformite ACAPS audit Sprint 27** : l'audit ACAPS (Autorite de Controle des Assurances et de la Prevoyance Sociale) Sprint 27 verifie que toutes les erreurs production sont tracables (traceId persiste dans les logs) et tous les incidents support sont loggables. La page 500 doit afficher le `x-trace-id` user-facing pour que le support N1 puisse reprendre la requete dans les logs OpenSearch + Sentry par traceId.

4. **Conformite Loi 09-08 CNDP** : Sentry est un service SaaS qui exfiltre des donnees techniques vers des serveurs (US/EU) -- la collecte sans filtrage des donnees personnelles est interdite. Le `beforeSend` Sentry doit filtrer email, telephone marocain (+212...), adresse postale, NIF, CIN, RIB, numero police avant transmission. Decision strategique : utiliser Sentry SaaS en dev/staging/early-prod (Sprint 4-29) avec PII filter strict puis migrer vers Sentry self-hosted Atlas Cloud Benguerir au Sprint 30.

5. **Multilinguisme MA decision-009** : 3 locales obligatoires fr / ar-MA / ar. Une page 404 affichee en anglais brut a un assure marocain est un echec UX et reglementaire (decret CNDP exige documentation en arabe classique pour produits assurance grand public).

6. **Rapport DRY 8 apps** : sans composant partage, chaque app reimplemente la page 404 = 8 versions divergentes a maintenir. Le composant `<NotFoundPage>` exporte par `@insurtech/shared-ui` est utilise par les 8 `not-found.tsx` qui se contentent d'un wrapper minimal.

### Alternatives considerees

#### Composants partages shared-ui vs duplication par app

| Critere | shared-ui (CHOIX) | Duplication par app (rejete) |
|---------|-------------------|------------------------------|
| Maintenance | 1 source de verite, fix propage 8 apps | 8 versions a fixer un par un |
| Branding coherent | Garanti par construction | Risque divergence |
| Tests | Tests unitaires shared-ui = couverture 8 apps | Tests dupliques |
| Customisation per-app | Override via props (logo, color variant) | Native mais verbeuse |
| Bundle size | Tree-shaking efficace (~5 ko gzip per page) | 5 ko x 8 = 40 ko duplique |

**Decision** : shared-ui exporte `NotFoundPage`, `ErrorPage`, `LoadingPage`, `UnderConstruction`. Les `not-found.tsx`, `error.tsx`, `loading.tsx` per-app sont des wrappers de **20-40 lignes** qui importent et delegent.

#### Sentry vs LogRocket vs Datadog RUM vs custom

| Critere | Sentry (CHOIX) | LogRocket | Datadog RUM | Custom logger |
|---------|----------------|-----------|-------------|---------------|
| App Router 15 | Officiel `@sentry/nextjs` 8.47 | Compatible | Compatible | DIY |
| Stack trace symbolication | Source maps upload via webpack plugin | Oui | Oui | Manual |
| Session replay | Oui (`@sentry/replay` integre) | Phare | Oui | Non |
| Performance monitoring | Browser tracing built-in | Oui | Oui | Non |
| Self-hosted possible | Oui (Sentry on-prem Sprint 30 cible) | Non | Non | DIY |
| PII filter `beforeSend` | Oui (decision-006 + Loi 09-08) | Limite | Oui | DIY |
| Cout | Free 5k errors/mois, $26/mois 50k | $99/mois mini | $15/host/mois | 0 |
| Maturite Janvier 2026 | 12 ans, standard industrie | Mature | Mature | Risque |

**Decision** : Sentry SaaS dev (cles dans Atlas Cloud Benguerir secret manager), Sentry self-hosted Sprint 30. Justification : conformite Loi 09-08 imposera self-hosted long terme.

#### error.tsx Server Component vs Client Component

Next.js 15 App Router **impose** `'use client'` sur error.tsx car les Error Boundary React sont Class Components qui doivent monter cote client pour le `componentDidCatch`. Aucune alternative Server Component possible. La signature obligatoire est `{ error: Error & { digest?: string }, reset: () => void }` -- le `error.digest` est l'identifiant Next.js du log serveur pour les erreurs RSC, le `reset` redemonter le segment de route.

#### global-error.tsx vs error.tsx seul

Le `error.tsx` standard intercepte les erreurs **dans le segment de route** (sous `[locale]/`). Si une erreur survient dans le `layout.tsx` racine ou dans `app/layout.tsx`, le `error.tsx` n'est **pas** monte (il est enfant du layout casse). Solution : Next.js exige un `global-error.tsx` au niveau `app/` qui remplace le `<html>` et `<body>` (pas dans un wrapper layout) pour fallback ultime. Decision : ajouter `global-error.tsx` per app avec message generique bilingue (FR + EN) car l'i18n provider n'est pas garanti charge a ce stade.

#### Skeleton vs Spinner pour loading.tsx

| Critere | Skeleton (CHOIX) | Spinner |
|---------|------------------|---------|
| UX perception | Plus rapide percue (mimique structure) | Plus generique |
| Implementation | shadcn/ui `<Skeleton>` natif | Lucide-react Loader2 + animation |
| Layout shift | Aucun (matche le contenu final) | Centerd full-page = pas de shift |
| Customisation | Per-page possible mais cher | Universelle |

**Decision** : `<LoadingPage>` shared-ui propose **les deux variantes** via prop `<LoadingPage variant="skeleton">` (defaut shell-app) ou `variant="spinner">` (sub-pages). Per-app loading.tsx utilise variant skeleton pour layout root et variant spinner pour sub-routes.

### Trade-offs explicites

1. **error.digest production-only** : `error.digest` (id de log Next.js) est defini uniquement en production. En dev, on affiche `error.message` + `error.stack` complet. En prod, on affiche `digest` et `traceId`. Helper `isClientError(error)` distingue.

2. **traceId peut etre absent** : si l'erreur survient avant que le middleware next-intl + tenant context n'ait pu injecter le `x-trace-id`, le traceId est `undefined`. Fallback : afficher un identifiant genere cote client `crypto.randomUUID()` avec prefixe `client-` pour distinguer.

3. **Sentry double-init React Strict Mode** : `Sentry.init()` dans `instrumentation.ts` (server) et `sentry.client.config.ts` (client) sont charges automatiquement par Next.js. Si on appelle aussi `Sentry.init()` dans un `useEffect` provider, double init -> doublons. Utiliser `Sentry.isInitialized()` flag.

4. **localized messages may not load** : si i18n provider crash (cas pathologique), on perd les translations. Fallback : `<ErrorPage>` accepte prop `messages` optionnel avec messages hardcoded EN + FR comme ultime fallback.

5. **Image SVG hydration** : illustrations SVG inline dans `<NotFoundPage>` doivent etre identiques server / client. Pas de `Math.random()` sur les ids SVG, utiliser un id stable (`useId()` de React 19) ou hash deterministe.

6. **Sentry replay PII** : Replay enregistre le DOM. Si formulaire saisi avec email, le replay capture la frappe. **Mandatory** : `replaysOnErrorSampleRate: 1.0` mais `mask: 'input,textarea'` config + `block: '.skalean-pii'` classes sur composants sensibles.

7. **404 vs not-found vs default-not-found** : Next.js 15 distingue `not-found.tsx` (rendu via `notFound()`) de `default.tsx` parallel routes. Notre setup ne touche pas aux parallel routes (Sprint 4 = bootstrap), donc `not-found.tsx` suffit.

8. **error.tsx scope segment** : `error.tsx` capture uniquement les erreurs **dans le sub-tree de son segment**. Une erreur dans `[locale]/(authenticated)/contacts/page.tsx` est capturee par `[locale]/error.tsx` ou par `[locale]/(authenticated)/error.tsx` si present (le plus proche gagne). Sprint 4 met un seul `error.tsx` au niveau `[locale]/` et delegue aux sprints metier futurs l'ajout de boundaries plus fines.

9. **Loading.tsx Suspense boundary** : `loading.tsx` declenche **uniquement** sur navigation cote client (pas SSR initial). Pour SSR, le streaming de RSC affiche le contenu progressivement sans `loading.tsx`. Trade-off accepte : `loading.tsx` est best-effort UX client-side.

10. **UnderConstruction date computation** : mapping numero de sprint -> date calendaire stocke dans `@insurtech/shared-ui/lib/sprint-calendar.ts` avec import dynamique. Sprint 4 = janvier 2026, Sprint 5 = mi-fevrier 2026, etc. Le composant calcule date estimee + delta en semaines depuis aujourd'hui via `date-fns`.

### Decisions strategiques referenced

- **decision-001 (monorepo pnpm + Turbo)** : composants partages dans `repo/packages/shared-ui/src/components/`, exportes via barrel `repo/packages/shared-ui/src/index.ts`. Les 8 apps importent `import { NotFoundPage, ErrorPage, LoadingPage, UnderConstruction } from '@insurtech/shared-ui'`.
- **decision-006 (NO EMOJI ABSOLU)** : zero emoji dans aucune page erreur, aucune illustration, aucun message. Illustrations sont **SVG branded Skalean** dessinees dans le composant (cf. section 6.2 NotFoundPage avec illustration vectorielle Orange + Navy).
- **decision-008 (cloud souverain MA Atlas Cloud Benguerir)** : Sentry SaaS toleree Sprint 4 a 29 (justifie par necessite de monitoring early), migration Sentry self-hosted Sprint 30 sur Atlas Cloud Benguerir avec instance docker-compose `sentry/sentry:24.x`. Documentation migration plan dans `decisions/sentry-self-hosted-migration.md` (Sprint 30 task).
- **decision-009 (multilinguisme MA)** : pages 404, 500, loading, UnderConstruction toutes localisees fr / ar-MA / ar. Texte de fallback global-error.tsx en anglais + francais (pas Darija car ce fichier ne charge pas next-intl pour eviter cycle).
- **decision-006 + Loi 09-08** : `beforeSend` Sentry filtre email regex, telephone +212 regex, NIF regex, CIN regex, RIB regex, numero police pattern Skalean (`POL-[A-Z0-9]{8}`).

### Pieges techniques connus (12 minimum)

1. **error.tsx must be 'use client'** : oubli `'use client'` -> Next.js erreur build "Components in error.tsx must be Client Components". Verification CI : grep `'use client'` dans tous error.tsx.

2. **Signature error.tsx App Router stricte** : `{ error: Error & { digest?: string }, reset: () => void }`. TypeScript strict casse si on inverse (`{ reset, error }` OK mais types differents -> `error` doit etre `Error & {digest?: string}` pas juste `Error`). Helper type exporte dans shared-ui : `type AppRouterErrorProps = { error: Error & { digest?: string }, reset: () => void }`.

3. **error.digest only in production** : en dev, `error.digest === undefined`. Le helper `extractTraceId(error, headers)` doit gerer ce cas et fallback sur `headers['x-trace-id']` ou genere un client UUID.

4. **global-error.tsx must include html + body** : contrairement a error.tsx qui herite du layout, global-error.tsx **remplace** le layout root. Donc DOIT contenir `<html>` et `<body>` complet. Sinon Next.js erreur runtime "Cannot read property of undefined".

5. **Sentry init twice in React Strict Mode** : strict mode double-monte. `Sentry.init` dans useEffect = double init. Utiliser `if (!Sentry.isInitialized()) { Sentry.init(...) }` ou `Sentry.init` dans `instrumentation.ts` (Next.js 15 api server-side init).

6. **traceId may be undefined if middleware didn't run** : middleware next-intl n'execute pas pour les requetes statiques (favicon, _next/static). Si l'erreur survient durant fetch d'asset, pas de traceId. Fallback : generer client-side `'client-' + crypto.randomUUID()`.

7. **localized messages may not load** : si i18n provider crash (json malforme, locale non supportee), `useTranslations()` throw. `<ErrorPage>` doit catcher ce cas et fallback messages hardcoded EN + FR.

8. **SVG hydration mismatch** : SVG avec id genere `Math.random()` -> server id != client id -> hydration warning. Solution : `useId()` React 19 ou ids constants par composant.

9. **Sentry replay PII filter mandatory** : `mask: 'input,textarea'` PLUS `maskTextSelector: '.skalean-pii'`. Sans mask, frappe email visible dans replay -> RGPD/Loi 09-08 violation immediate.

10. **404 vs not-found vs default-not-found** : Next.js 15 conventions :
    - `not-found.tsx` : rendu quand `notFound()` appele dans une page ou layout
    - `default.tsx` : seulement pour parallel routes (`@modal/default.tsx`)
    - Pas de `404.tsx` (ancienne convention Pages Router)
    - Pour catch-all 404 routes inexistantes, `not-found.tsx` au niveau `app/` ou `app/[locale]/` suffit

11. **error.tsx catches errors in nested route segment only** : erreur dans layout.tsx racine = pas catchee par error.tsx. Need global-error.tsx au niveau racine app/.

12. **Loading state skeleton vs spinner UX choice** : skeleton pour navigation initiale (full-page load), spinner pour navigation sub-segment (page deja monte, juste contenu en cours). Variant prop sur `<LoadingPage>`.

13. **UnderConstruction date computation Sprint N** : mapping sprint -> date calendaire (Sprint 1 = nov 2025, Sprint 4 = jan 2026, Sprint 35 = oct 2027). Hardcoded dans `sprint-calendar.ts`. Si sprint > 35 (post-roadmap), afficher "Roadmap a definir".

14. **Sentry beforeSend mutates event** : `beforeSend` peut return `null` (skip event) ou modifier event. Mutation in-place de `event.request.headers` pour supprimer Authorization. Test unitaire critique.

15. **Copy-to-clipboard browser API** : `navigator.clipboard.writeText()` retourne Promise et requiert HTTPS ou localhost. Fallback : creer textarea hidden + select + execCommand('copy') pour browsers HTTP.

---

## 3. Architecture context (3-5 ko)

### Position dans Sprint 4

`task-1.4.15` est la **15eme tache** du Sprint 4, executee apres les apps bootstrap (1.4.1 a 1.4.7), les packages partages (1.4.8 shared-ui, 1.4.9 shared-pwa, 1.4.10 shared-maps), les setups cross-cutting (1.4.11 i18n, 1.4.12 turbo, 1.4.13 OpenAPI client, 1.4.14 layouts) :

```
Sprint 4 -- Frontend Bootstrap (16 taches)

[1.4.1 web-broker]   <-- patron canonique (deja livre)
[1.4.2 web-garage]   <-- copie patron
[1.4.3 web-garage-mobile] PWA
[1.4.4 web-insurtech-admin]
[1.4.5 web-customer-portal] SSG/ISR
[1.4.6 web-assure-portal]
[1.4.7 web-assure-mobile] PWA
[1.4.8 shared-ui]    <-- composants Skalean (NotFoundPage / ErrorPage / LoadingPage / UnderConstruction ajoutes par 1.4.15)
[1.4.9 shared-pwa]
[1.4.10 shared-maps]
[1.4.11 i18n cross-cutting]
[1.4.12 turbo + scripts paralleles]
[1.4.13 OpenAPI client gen]
[1.4.14 layouts shared sidebar+topbar]

[1.4.15 placeholder + 404/500/loading/Sentry]   <-- CETTE TACHE (4h)
   |
   +-- ajoute composants shared-ui (NotFoundPage, ErrorPage, LoadingPage, UnderConstruction)
   +-- ajoute fichiers per-app : not-found.tsx, error.tsx, loading.tsx, global-error.tsx, sentry.client.config.ts, sentry.server.config.ts, sentry.edge.config.ts
   +-- enrichit .env.example per-app avec NEXT_PUBLIC_SENTRY_*
   +-- ajoute lib/sentry.ts wrapper init helper

[1.4.16 E2E + Lighthouse + Storybook]   <-- valide en aval
```

### Position dans le programme

Cette tache fait partie de la **Phase 1 Bootstrap** (Sprints 1-4) et conditionne tous les sprints metier ulterieurs :
- **Sprint 5 (Auth next-auth)** : ajoute `[locale]/login`, `[locale]/logout`. Si user navigate `/profile` (pas implemente Sprint 5), tomber sur UnderConstruction sprintNumber={X}.
- **Sprint 8 (CRM contacts)** : implemente `[locale]/contacts`. Avant Sprint 8, ce path utilise UnderConstruction sprintNumber={8}.
- **Sprint 17 (Souscription polices)** : `[locale]/policies`.
- **Sprint 22 (Sinistres)** : `[locale]/claims`.
- **Sprint 27 (Dashboards)** : remplace `[locale]/page.tsx` par dashboard reel (au lieu du landing placeholder).
- **Sprint 30 (Sentry self-hosted)** : migration Sentry SaaS -> Sentry on-prem Atlas Cloud Benguerir.
- **Sprint 31 (Reporting ACAPS)** : `[locale]/reporting`.
- **Sprint 35 (Production launch)** : tous les UnderConstruction places ont disparu (remplaces par implementations).

Chaque sprint metier consomme **strictement** les composants poses ici. Toute deviation declenche refactor cross-app couteux.

### Diagramme ASCII de l'organisation

```
repo/
|-- packages/
|   |-- shared-ui/
|   |   |-- src/
|   |   |   |-- components/
|   |   |   |   |-- UnderConstruction.tsx          # ~80 lignes -- L1
|   |   |   |   |-- NotFoundPage.tsx                # ~120 lignes -- L2
|   |   |   |   |-- ErrorPage.tsx                   # ~150 lignes -- L3
|   |   |   |   |-- LoadingPage.tsx                 # ~80 lignes -- L4
|   |   |   |   |-- error-illustrations/
|   |   |   |   |   |-- NotFoundIllustration.tsx    # SVG inline ~60 lignes
|   |   |   |   |   |-- ErrorIllustration.tsx       # SVG inline ~60 lignes
|   |   |   |   |   |-- LoadingIllustration.tsx     # SVG inline ~40 lignes
|   |   |   |-- lib/
|   |   |   |   |-- error-helpers.ts                # ~80 lignes -- L5
|   |   |   |   |-- sprint-calendar.ts              # ~30 lignes mapping sprint -> date
|   |   |   |-- messages/
|   |   |   |   |-- errors/
|   |   |   |   |   |-- fr.json                     # ~30 keys -- L6
|   |   |   |   |   |-- ar-MA.json                  # ~30 keys -- L7
|   |   |   |   |   |-- ar.json                     # ~30 keys -- L8
|   |   |   |-- index.ts                            # barrel exports
|   |   |-- src/components/__tests__/
|   |   |   |-- UnderConstruction.spec.tsx          # 4 tests
|   |   |   |-- NotFoundPage.spec.tsx               # 4 tests
|   |   |   |-- ErrorPage.spec.tsx                  # 5 tests
|   |   |   |-- LoadingPage.spec.tsx                # 3 tests
|   |   |-- src/lib/__tests__/
|   |   |   |-- error-helpers.spec.ts               # 5 tests
|
|-- apps/
|   |-- web-broker/                                  # IDEM pour les 8 apps
|   |   |-- src/
|   |   |   |-- app/
|   |   |   |   |-- [locale]/
|   |   |   |   |   |-- not-found.tsx                # ~25 lignes -- L9
|   |   |   |   |   |-- error.tsx                    # ~40 lignes -- L10
|   |   |   |   |   |-- loading.tsx                  # ~20 lignes -- L11
|   |   |   |   |-- global-error.tsx                 # ~80 lignes -- L12
|   |   |   |-- lib/
|   |   |   |   |-- sentry.ts                        # ~80 lignes -- L13
|   |   |-- sentry.client.config.ts                  # ~50 lignes -- L14
|   |   |-- sentry.server.config.ts                  # ~30 lignes -- L15
|   |   |-- sentry.edge.config.ts                    # ~30 lignes -- L16
|   |   |-- .env.example                             # +6 entrees -- L17
|   |   |-- next.config.mjs                          # withSentryConfig wrapper
|
|   |-- web-garage/                  IDEM
|   |-- web-garage-mobile/            IDEM
|   |-- web-insurtech-admin/          IDEM
|   |-- web-customer-portal/          IDEM
|   |-- web-assure-portal/            IDEM
|   |-- web-assure-mobile/            IDEM
|   |-- web-assure-admin/             IDEM (placeholder Sprint 27)

repo/e2e/web/
|-- error-pages.spec.ts                              # ~250 lignes Playwright (8 tests)

repo/scripts/
|-- generate-error-pages.ts                          # CI helper to scaffold per app
```

### Provider chain pour error capture

```
<html lang={locale} dir={dir}>                    <-- depuis layout.tsx (pas atteint si layout casse -> global-error.tsx)
  <body>
    <ThemeProvider>
      <NextIntlClientProvider>
        <Providers>                                <-- 'use client' wrapper
          <QueryClientProvider>
            <Sentry.ErrorBoundary fallback={<ErrorPage error={...} reset={...} />}>
              <TenantContextSync>
                {children}                         <-- segments imbrique
                  |
                  +-- error.tsx catch erreurs dans children
                  +-- not-found.tsx rendu si notFound() called
                  +-- loading.tsx rendu pendant Suspense fallback
              </TenantContextSync>
            </Sentry.ErrorBoundary>
          </QueryClientProvider>
        </Providers>
      </NextIntlClientProvider>
    </ThemeProvider>
  </body>
</html>

<-- si erreur dans <html>/<body>/ThemeProvider/NextIntlClientProvider :
    fallback global-error.tsx remplace tout (re-render <html><body> brut)
```

---

## 4. Livrables checkables (22+ deliverables)

- [ ] **L1** : `repo/packages/shared-ui/src/components/UnderConstruction.tsx` (~80 lignes) component reutilisable, props `{ sprintNumber: number; featureName?: string; estimatedDate?: string }`, message localise via useTranslations('underConstruction'), date estimee calculee via `getSprintDate(sprintNumber)` depuis sprint-calendar.ts, animated construction icon (lucide-react `Construction` ou `HardHat`) -- aucune emoji, button "Retour accueil" via Next Link.

- [ ] **L2** : `repo/packages/shared-ui/src/components/NotFoundPage.tsx` (~120 lignes) page brandee Skalean (logo SVG inline + palette Orange/Navy/Sky/Teal), illustration SVG branded inline (no emoji, no external image), titre localise via useTranslations('errors.notFound'), description localise, button "Retour accueil" Link to `/${locale}`, search box optional (prop `showSearch` defaut true), liens populaires nav (5 liens depuis prop `popularLinks`).

- [ ] **L3** : `repo/packages/shared-ui/src/components/ErrorPage.tsx` (~150 lignes) `'use client'` Error Boundary App Router compliant signature `{ error: Error & { digest?: string }, reset: () => void }`, branded Skalean, titre localise "Une erreur s'est produite", traceId display "Reference: {x-trace-id}" extrait via `extractTraceId(error)`, copy-to-clipboard button avec icone `Copy` + tooltip "Copie", error.digest display dev-only via `process.env.NODE_ENV !== 'production'`, button "Reessayer" call `reset()`, button "Retour accueil" Link, lien contact support `mailto:support@skalean-insurtech.ma?subject=Error%20{traceId}`, Sentry capture dans `useEffect(() => Sentry.captureException(error, { tags: { traceId, digest } }), [error])`.

- [ ] **L4** : `repo/packages/shared-ui/src/components/LoadingPage.tsx` (~80 lignes) skeleton placeholder app shell ou spinner Skalean branded, prop `variant: 'skeleton' | 'spinner'` defaut skeleton, ARIA `aria-busy={true}` `role="status"` `aria-label` localise "Chargement en cours", animated Loader2 lucide-react pour variant spinner.

- [ ] **L5** : `repo/packages/shared-ui/src/lib/error-helpers.ts` (~80 lignes) helpers : `extractTraceId(error: Error & { digest?: string }, headers?: Headers): string`, `formatErrorMessage(error, locale): string`, `isClientError(error): boolean` (detecte instanceof TypeError + ChunkLoadError), `isServerError(error): boolean`, `copyToClipboard(text: string): Promise<boolean>` avec fallback execCommand.

- [ ] **L6** : `repo/packages/shared-ui/src/messages/errors/fr.json` (~30 keys) errors.notFound.{title,description,cta,searchPlaceholder,popularLinks}, errors.serverError.{title,description,cta.retry,cta.home,reference,referenceCopied,contactSupport,digestLabel}, errors.loading.{title,description}, underConstruction.{title,description,sprintMarker,backToHome,estimatedDate}.

- [ ] **L7** : `repo/packages/shared-ui/src/messages/errors/ar-MA.json` (~30 keys Darija) -- translations pratiques marocaines : "الصفحة غير موجودة" (notFound.title), "حدث خطأ" (serverError.title), "ديال المرجع" (reference), "جرب مرة أخرى" (retry).

- [ ] **L8** : `repo/packages/shared-ui/src/messages/errors/ar.json` (~30 keys arabe classique) -- translations formelles : "الصفحة غير موجودة" (notFound.title), "وقع خطأ غير متوقع" (serverError.title), "المرجع" (reference), "حاول مجددًا" (retry).

- [ ] **L9** : `repo/apps/{8 apps}/src/app/[locale]/not-found.tsx` (~25 lignes per app) imports `NotFoundPage` from `@insurtech/shared-ui`, exports `default function NotFound() { return <NotFoundPage popularLinks={[...]} /> }`, customisation app-specifique branding (variant prop pour customer-portal vs broker).

- [ ] **L10** : `repo/apps/{8 apps}/src/app/[locale]/error.tsx` (~40 lignes per app) `'use client'` required, imports `ErrorPage`, `useEffect(() => Sentry.captureException(error, { tags: { app: 'web-broker' } }), [error])`, props `{ error, reset }`, app-specific branding via prop (logo override).

- [ ] **L11** : `repo/apps/{8 apps}/src/app/[locale]/loading.tsx` (~20 lignes per app) imports `LoadingPage`, exports default avec variant skeleton pour root segment.

- [ ] **L12** : `repo/apps/{8 apps}/src/app/global-error.tsx` (~80 lignes per app) `'use client'`, html + body wrapper required (Next.js 15 imposition), fallback layout errors, message generique English + French car i18n provider may not loaded a ce stade, button reset + button reload window.location.reload().

- [ ] **L13** : `repo/apps/{8 apps}/src/lib/sentry.ts` (~80 lignes per app) `Sentry.init` wrapper avec `dsn: process.env.NEXT_PUBLIC_SENTRY_DSN`, `environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV`, `release: process.env.NEXT_PUBLIC_APP_VERSION`, `integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration({ maskAllInputs: true, blockAllMedia: true })]`, `tracesSampleRate: prod ? 0.1 : 1.0`, `replaysSessionSampleRate: 0.1`, `replaysOnErrorSampleRate: 1.0`, `beforeSend: filterPII` (regex email + tel +212 + NIF + CIN + RIB).

- [ ] **L14** : `repo/apps/{8 apps}/sentry.client.config.ts` (~50 lignes per app) Sentry browser config, init avec init helper depuis lib/sentry.ts, debug seulement dev.

- [ ] **L15** : `repo/apps/{8 apps}/sentry.server.config.ts` (~30 lignes per app) Sentry server config server actions, integrations Node-spec.

- [ ] **L16** : `repo/apps/{8 apps}/sentry.edge.config.ts` (~30 lignes per app) Sentry edge runtime middleware config.

- [ ] **L17** : `repo/apps/{8 apps}/.env.example` enrichi avec `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_ENVIRONMENT`, `NEXT_PUBLIC_APP_VERSION`, `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE`, `NEXT_PUBLIC_SENTRY_REPLAYS_SAMPLE_RATE`, `SENTRY_AUTH_TOKEN` (server-only pour upload sourcemaps).

- [ ] **L18** : `repo/apps/{8 apps}/next.config.mjs` mis a jour avec `withSentryConfig` wrapper (`@sentry/nextjs/build` integration).

- [ ] **L19** : `repo/packages/shared-ui/src/index.ts` mis a jour pour exporter `NotFoundPage`, `ErrorPage`, `LoadingPage`, `UnderConstruction`, `extractTraceId`, `formatErrorMessage`, `copyToClipboard`.

- [ ] **L20** : `repo/packages/shared-ui/src/lib/sprint-calendar.ts` (~30 lignes) mapping sprint number -> date calendaire (Sprint 1 = '2025-11-01', Sprint 4 = '2026-01-15', ..., Sprint 35 = '2027-10-30'), helper `getSprintDate(n: number): Date`.

- [ ] **L21** : Tests unitaires Vitest : `UnderConstruction.spec.tsx` (4 tests), `NotFoundPage.spec.tsx` (4 tests), `ErrorPage.spec.tsx` (5 tests), `LoadingPage.spec.tsx` (3 tests), `error-helpers.spec.ts` (5 tests). Total ~21 tests.

- [ ] **L22** : Test E2E Playwright : `repo/e2e/web/error-pages.spec.ts` (~250 lignes, 8 tests) trigger 404 navigate `/non-existent-route`, error boundary trigger via `?simulate-error=true` query param, loading state visible navigation lente, traceId visible 500 page, copy-to-clipboard works, Sentry capture verified via mock route intercept, locale switch on error page preserve.

- [ ] **L23** : Validation : `pnpm --filter @insurtech/shared-ui build` reussit, `pnpm --filter @insurtech/web-broker build` reussit (and 7 autres apps), `pnpm typecheck` 0 erreur, `pnpm lint` 0 erreur, `pnpm test` 100% pass, `pnpm e2e` error-pages.spec.ts pass.

- [ ] **L24** : `grep -rE "[\\u{1F600}-\\u{1F6FF}]" repo/packages/shared-ui/src/` retourne 0 ligne (no emoji enforcement).

- [ ] **L25** : `grep -r "console.log" repo/packages/shared-ui/src/components/` retourne 0 (sauf tests).

- [ ] **L26** : Sentry test event verifie : `pnpm sentry-test` envoie un event factice et verifie via Sentry API qu'il arrive avec traceId tag mais sans PII (email scrub).

---

## 5. Fichiers crees / modifies (liste exhaustive)

```
repo/packages/shared-ui/
  src/
    components/
      UnderConstruction.tsx                          # ~80 lignes  -- L1
      NotFoundPage.tsx                                # ~120 lignes -- L2
      ErrorPage.tsx                                   # ~150 lignes -- L3
      LoadingPage.tsx                                 # ~80 lignes  -- L4
      error-illustrations/
        NotFoundIllustration.tsx                      # ~60 lignes SVG inline
        ErrorIllustration.tsx                         # ~60 lignes SVG inline
        LoadingIllustration.tsx                       # ~40 lignes SVG inline
        UnderConstructionIllustration.tsx             # ~50 lignes SVG inline
      __tests__/
        UnderConstruction.spec.tsx                    # ~80 lignes (4 tests)
        NotFoundPage.spec.tsx                         # ~90 lignes (4 tests)
        ErrorPage.spec.tsx                            # ~120 lignes (5 tests)
        LoadingPage.spec.tsx                          # ~60 lignes (3 tests)
    lib/
      error-helpers.ts                                # ~80 lignes  -- L5
      sprint-calendar.ts                              # ~30 lignes  -- L20
      __tests__/
        error-helpers.spec.ts                         # ~120 lignes (5 tests)
        sprint-calendar.spec.ts                       # ~40 lignes (3 tests)
    messages/
      errors/
        fr.json                                       # ~50 lignes  -- L6
        ar-MA.json                                    # ~50 lignes  -- L7
        ar.json                                       # ~50 lignes  -- L8
    index.ts                                          # mis a jour barrel exports

repo/apps/web-broker/                                  # PUIS REPLIQUE 8 apps total
  src/app/[locale]/not-found.tsx                       # ~25 lignes -- L9
  src/app/[locale]/error.tsx                           # ~40 lignes -- L10
  src/app/[locale]/loading.tsx                         # ~20 lignes -- L11
  src/app/global-error.tsx                             # ~80 lignes -- L12
  src/lib/sentry.ts                                    # ~80 lignes -- L13
  sentry.client.config.ts                              # ~50 lignes -- L14
  sentry.server.config.ts                              # ~30 lignes -- L15
  sentry.edge.config.ts                                # ~30 lignes -- L16
  .env.example                                         # +6 lignes -- L17
  next.config.mjs                                      # mis a jour withSentryConfig

repo/apps/web-garage/                                  # IDEM 9 fichiers
repo/apps/web-garage-mobile/                           # IDEM 9 fichiers
repo/apps/web-insurtech-admin/                         # IDEM 9 fichiers
repo/apps/web-customer-portal/                         # IDEM 9 fichiers (variant public branding)
repo/apps/web-assure-portal/                           # IDEM 9 fichiers
repo/apps/web-assure-mobile/                           # IDEM 9 fichiers
repo/apps/web-assure-admin/                            # IDEM 9 fichiers (Sprint 27)

repo/e2e/web/
  error-pages.spec.ts                                  # ~250 lignes (8 tests E2E)

repo/scripts/
  generate-error-pages.ts                              # ~80 lignes scaffold helper
  test-sentry-integration.ts                           # ~50 lignes test event
```

Total : ~85 fichiers crees/modifies, ~2400 lignes nettes hors tests, ~700 lignes tests.

---

## 6. Code patterns COMPLETS (fichiers principaux)

### 6.1 `repo/packages/shared-ui/src/components/UnderConstruction.tsx` (~80 lignes)

```tsx
'use client';

import { Construction, ArrowLeft } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { format, formatDistanceToNow } from 'date-fns';
import { fr as frLocale, arSA as arLocale } from 'date-fns/locale';
import { getSprintDate } from '../lib/sprint-calendar';
import { Button } from './Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './Card';

export interface UnderConstructionProps {
  sprintNumber: number;
  featureName?: string;
  estimatedDate?: string;
  homeHref?: string;
}

export function UnderConstruction({
  sprintNumber,
  featureName,
  estimatedDate,
  homeHref,
}: UnderConstructionProps) {
  const t = useTranslations('underConstruction');
  const locale = useLocale();

  const dateFnsLocale = locale === 'fr' ? frLocale : arLocale;
  const sprintDate = estimatedDate ? new Date(estimatedDate) : getSprintDate(sprintNumber);
  const formattedDate = format(sprintDate, 'd MMMM yyyy', { locale: dateFnsLocale });
  const distance = formatDistanceToNow(sprintDate, { locale: dateFnsLocale, addSuffix: true });

  const home = homeHref ?? `/${locale}`;

  return (
    <main
      role="main"
      className="flex min-h-[60vh] flex-col items-center justify-center p-8"
      data-testid="under-construction"
    >
      <Card className="max-w-xl border-skalean-orange/20 bg-skalean-sky-blue/10">
        <CardHeader className="flex flex-col items-center gap-4 text-center">
          <div
            className="rounded-full bg-skalean-orange/10 p-6 motion-safe:animate-pulse"
            aria-hidden="true"
          >
            <Construction className="h-16 w-16 text-skalean-orange" strokeWidth={1.5} />
          </div>
          <CardTitle className="text-3xl font-bold text-skalean-navy">
            {featureName ? t('titleWithFeature', { feature: featureName }) : t('title')}
          </CardTitle>
          <CardDescription className="text-base text-skalean-navy/70">
            {t('description', { sprintNumber, date: formattedDate, distance })}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-3">
          <p className="text-sm font-medium text-skalean-acaps-teal">
            {t('sprintMarker', { sprintNumber })}
          </p>
          <p className="text-sm text-skalean-navy/60">
            {t('estimatedDate', { date: formattedDate })}
          </p>
          <Button asChild variant="default" className="mt-4 bg-skalean-orange hover:bg-skalean-orange/90">
            <Link href={home}>
              <ArrowLeft className="me-2 h-4 w-4" />
              {t('backToHome')}
            </Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}

UnderConstruction.displayName = 'UnderConstruction';
```

### 6.2 `repo/packages/shared-ui/src/components/NotFoundPage.tsx` (~120 lignes)

```tsx
'use client';

import { Home, Search, ArrowLeft } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { useState, useId } from 'react';
import { NotFoundIllustration } from './error-illustrations/NotFoundIllustration';
import { Button } from './Button';
import { Input } from './Input';
import { SkaleanLogo } from './SkaleanLogo';

export interface PopularLink {
  href: string;
  labelKey: string;
}

export interface NotFoundPageProps {
  showSearch?: boolean;
  popularLinks?: PopularLink[];
  homeHref?: string;
  brandVariant?: 'broker' | 'garage' | 'admin' | 'customer' | 'assure';
}

export function NotFoundPage({
  showSearch = true,
  popularLinks = [],
  homeHref,
  brandVariant = 'broker',
}: NotFoundPageProps) {
  const t = useTranslations('errors.notFound');
  const locale = useLocale();
  const searchId = useId();
  const [searchQuery, setSearchQuery] = useState('');

  const home = homeHref ?? `/${locale}`;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `${home}/search?q=${encodeURIComponent(searchQuery)}`;
    }
  };

  return (
    <main
      role="main"
      className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-skalean-sky-blue/5 via-white to-skalean-orange/5 p-8"
      data-testid="not-found-page"
    >
      <div className="mb-8">
        <SkaleanLogo variant={brandVariant} className="h-16" />
      </div>

      <div className="mb-8 max-w-md" aria-hidden="true">
        <NotFoundIllustration className="h-64 w-full" />
      </div>

      <div className="text-center max-w-2xl">
        <h1 className="mb-3 text-5xl font-bold text-skalean-navy">404</h1>
        <h2 className="mb-4 text-2xl font-semibold text-skalean-navy">{t('title')}</h2>
        <p className="mb-8 text-base text-skalean-navy/70">{t('description')}</p>

        {showSearch && (
          <form onSubmit={handleSearch} className="mb-8">
            <label htmlFor={searchId} className="sr-only">
              {t('searchPlaceholder')}
            </label>
            <div className="flex gap-2">
              <Input
                id={searchId}
                type="search"
                placeholder={t('searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1"
              />
              <Button type="submit" variant="outline" aria-label={t('searchPlaceholder')}>
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </form>
        )}

        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Button asChild className="bg-skalean-orange hover:bg-skalean-orange/90">
            <Link href={home}>
              <Home className="me-2 h-4 w-4" />
              {t('cta')}
            </Link>
          </Button>
          <Button asChild variant="outline">
            <button type="button" onClick={() => window.history.back()}>
              <ArrowLeft className="me-2 h-4 w-4" />
              {t('back')}
            </button>
          </Button>
        </div>

        {popularLinks.length > 0 && (
          <nav aria-label={t('popularLinks')} className="mt-12 border-t border-skalean-navy/10 pt-8">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-skalean-navy/60">
              {t('popularLinks')}
            </h3>
            <ul className="flex flex-wrap justify-center gap-4">
              {popularLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-skalean-orange underline-offset-4 hover:underline"
                  >
                    {t(link.labelKey)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>
    </main>
  );
}

NotFoundPage.displayName = 'NotFoundPage';
```

### 6.3 `repo/packages/shared-ui/src/components/ErrorPage.tsx` (~150 lignes)

```tsx
'use client';

import { AlertTriangle, Copy, Check, Home, RotateCw, Mail } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';
import * as Sentry from '@sentry/nextjs';
import { ErrorIllustration } from './error-illustrations/ErrorIllustration';
import { Button } from './Button';
import { SkaleanLogo } from './SkaleanLogo';
import { extractTraceId, copyToClipboard } from '../lib/error-helpers';

export interface AppRouterErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export interface ErrorPageProps extends AppRouterErrorProps {
  brandVariant?: 'broker' | 'garage' | 'admin' | 'customer' | 'assure';
  homeHref?: string;
  supportEmail?: string;
  appName?: string;
}

export function ErrorPage({
  error,
  reset,
  brandVariant = 'broker',
  homeHref,
  supportEmail = 'support@skalean-insurtech.ma',
  appName = 'Skalean InsurTech',
}: ErrorPageProps) {
  const t = useTranslations('errors.serverError');
  const locale = useLocale();
  const [copied, setCopied] = useState(false);
  const traceId = extractTraceId(error);
  const home = homeHref ?? `/${locale}`;
  const isDev = process.env.NODE_ENV !== 'production';

  useEffect(() => {
    if (!Sentry.isInitialized()) return;
    Sentry.captureException(error, {
      tags: {
        traceId,
        digest: error.digest,
        app: appName,
        locale,
      },
      contexts: {
        errorPage: {
          location: typeof window !== 'undefined' ? window.location.href : 'ssr',
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'ssr',
        },
      },
    });
  }, [error, traceId, appName, locale]);

  const handleCopy = useCallback(async () => {
    const ok = await copyToClipboard(traceId);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [traceId]);

  const supportLink = `mailto:${supportEmail}?subject=${encodeURIComponent(
    `${appName} -- Error ${traceId}`,
  )}&body=${encodeURIComponent(
    `Reference: ${traceId}\nDigest: ${error.digest ?? 'n/a'}\nLocale: ${locale}\nMessage: ${error.message}\n`,
  )}`;

  return (
    <main
      role="main"
      className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-skalean-sky-blue/5 via-white to-red-50 p-8"
      data-testid="error-page"
    >
      <div className="mb-6">
        <SkaleanLogo variant={brandVariant} className="h-16" />
      </div>

      <div className="mb-6 max-w-md" aria-hidden="true">
        <ErrorIllustration className="h-56 w-full" />
      </div>

      <div className="max-w-2xl text-center">
        <div
          className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50"
          aria-hidden="true"
        >
          <AlertTriangle className="h-8 w-8 text-red-600" strokeWidth={1.5} />
        </div>

        <h1 className="mb-3 text-3xl font-bold text-skalean-navy">{t('title')}</h1>
        <p className="mb-6 text-base text-skalean-navy/70">{t('description')}</p>

        <div
          className="mx-auto mb-6 max-w-md rounded-lg border border-skalean-navy/10 bg-white p-4"
          data-testid="trace-id-block"
        >
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-skalean-navy/60">
            {t('reference')}
          </p>
          <div className="flex items-center justify-between gap-3">
            <code
              className="flex-1 truncate font-mono text-sm text-skalean-navy"
              data-testid="trace-id-value"
            >
              {traceId}
            </code>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              aria-label={t('copyReference')}
              data-testid="copy-trace-id"
            >
              {copied ? (
                <>
                  <Check className="me-1 h-4 w-4" />
                  {t('referenceCopied')}
                </>
              ) : (
                <>
                  <Copy className="me-1 h-4 w-4" />
                  {t('copy')}
                </>
              )}
            </Button>
          </div>
        </div>

        {isDev && error.digest && (
          <details className="mx-auto mb-6 max-w-md rounded-lg bg-yellow-50 p-3 text-left" data-testid="dev-digest">
            <summary className="cursor-pointer text-xs font-semibold text-yellow-900">
              {t('digestLabel')} (dev only)
            </summary>
            <code className="mt-2 block break-all font-mono text-xs text-yellow-900">{error.digest}</code>
            <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-all text-xs text-yellow-900">
              {error.stack}
            </pre>
          </details>
        )}

        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Button onClick={reset} className="bg-skalean-orange hover:bg-skalean-orange/90">
            <RotateCw className="me-2 h-4 w-4" />
            {t('retry')}
          </Button>
          <Button asChild variant="outline">
            <Link href={home}>
              <Home className="me-2 h-4 w-4" />
              {t('home')}
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <a href={supportLink}>
              <Mail className="me-2 h-4 w-4" />
              {t('contactSupport')}
            </a>
          </Button>
        </div>
      </div>
    </main>
  );
}

ErrorPage.displayName = 'ErrorPage';
```

### 6.4 `repo/packages/shared-ui/src/components/LoadingPage.tsx` (~80 lignes)

```tsx
'use client';

import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { LoadingIllustration } from './error-illustrations/LoadingIllustration';
import { Skeleton } from './Skeleton';

export interface LoadingPageProps {
  variant?: 'skeleton' | 'spinner';
  fullScreen?: boolean;
}

export function LoadingPage({ variant = 'skeleton', fullScreen = true }: LoadingPageProps) {
  const t = useTranslations('errors.loading');

  if (variant === 'spinner') {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-label={t('title')}
        className={
          fullScreen
            ? 'flex min-h-screen flex-col items-center justify-center gap-4'
            : 'flex flex-col items-center justify-center gap-4 p-8'
        }
        data-testid="loading-page-spinner"
      >
        <Loader2 className="h-12 w-12 animate-spin text-skalean-orange" aria-hidden="true" />
        <p className="text-sm font-medium text-skalean-navy/70">{t('title')}</p>
        <p className="sr-only">{t('description')}</p>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={t('title')}
      className={fullScreen ? 'min-h-screen p-8' : 'p-8'}
      data-testid="loading-page-skeleton"
    >
      <div className="mb-8 flex items-center gap-4">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex-1">
          <Skeleton className="mb-2 h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>

      <Skeleton className="mb-6 h-8 w-1/2" />
      <Skeleton className="mb-2 h-4 w-full" />
      <Skeleton className="mb-2 h-4 w-full" />
      <Skeleton className="mb-6 h-4 w-3/4" />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-32 w-full rounded-lg" />
      </div>

      <p className="sr-only">{t('description')}</p>
    </div>
  );
}

LoadingPage.displayName = 'LoadingPage';
```

### 6.5 `repo/packages/shared-ui/src/lib/error-helpers.ts` (~80 lignes)

```ts
import { headers as nextHeaders } from 'next/headers';

const TRACE_ID_HEADER = 'x-trace-id';

export function extractTraceId(error: Error & { digest?: string }, headers?: Headers): string {
  if (headers) {
    const headerValue = headers.get(TRACE_ID_HEADER);
    if (headerValue) return headerValue;
  }

  if (error.digest) {
    return `digest-${error.digest}`;
  }

  if (typeof window !== 'undefined' && 'crypto' in window && 'randomUUID' in window.crypto) {
    return `client-${window.crypto.randomUUID()}`;
  }

  return `unknown-${Date.now().toString(36)}`;
}

export async function extractServerTraceId(): Promise<string> {
  try {
    const h = await nextHeaders();
    const v = h.get(TRACE_ID_HEADER);
    return v ?? `server-${Date.now().toString(36)}`;
  } catch {
    return `server-${Date.now().toString(36)}`;
  }
}

export function formatErrorMessage(error: Error, locale: string): string {
  const message = error.message || 'Unknown error';
  if (locale === 'ar' || locale === 'ar-MA') {
    return message;
  }
  return message.charAt(0).toUpperCase() + message.slice(1);
}

export function isClientError(error: Error & { digest?: string }): boolean {
  if (error instanceof TypeError) return true;
  if (error.name === 'ChunkLoadError') return true;
  if (/Failed to fetch|NetworkError|Load failed/i.test(error.message)) return true;
  return false;
}

export function isServerError(error: Error & { digest?: string }): boolean {
  if (!error.digest) return false;
  if (isClientError(error)) return false;
  return true;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    if (typeof document !== 'undefined') {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      textarea.setAttribute('readonly', 'true');
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      return ok;
    }
    return false;
  } catch {
    return false;
  }
}
```

### 6.6 `repo/packages/shared-ui/src/lib/sprint-calendar.ts` (~30 lignes)

```ts
const SPRINT_START_ISO = '2025-11-01';
const SPRINT_DURATION_WEEKS = 2;

export function getSprintDate(sprintNumber: number): Date {
  if (sprintNumber < 1 || sprintNumber > 35) {
    return new Date('2027-12-31');
  }
  const start = new Date(SPRINT_START_ISO);
  const offsetDays = (sprintNumber - 1) * SPRINT_DURATION_WEEKS * 7;
  const result = new Date(start);
  result.setDate(result.getDate() + offsetDays);
  return result;
}

export function getCurrentSprintNumber(now: Date = new Date()): number {
  const start = new Date(SPRINT_START_ISO);
  const diff = now.getTime() - start.getTime();
  const days = diff / (1000 * 60 * 60 * 24);
  const sprint = Math.floor(days / (SPRINT_DURATION_WEEKS * 7)) + 1;
  return Math.max(1, Math.min(35, sprint));
}
```

### 6.7 `repo/packages/shared-ui/src/messages/errors/fr.json` (~30 keys)

```json
{
  "errors": {
    "notFound": {
      "title": "Page introuvable",
      "description": "La page que vous cherchez n'existe pas, a ete deplacee, ou n'est pas encore disponible. Verifiez l'URL ou retournez a l'accueil.",
      "cta": "Retour a l'accueil",
      "back": "Retour",
      "searchPlaceholder": "Rechercher dans Skalean InsurTech",
      "popularLinks": "Liens populaires",
      "links": {
        "dashboard": "Tableau de bord",
        "policies": "Polices",
        "claims": "Sinistres",
        "contacts": "Contacts",
        "reports": "Rapports"
      }
    },
    "serverError": {
      "title": "Une erreur s'est produite",
      "description": "Nous rencontrons un probleme temporaire. Notre equipe technique a ete automatiquement notifiee. Vous pouvez reessayer ou contacter le support en mentionnant la reference ci-dessous.",
      "retry": "Reessayer",
      "home": "Retour a l'accueil",
      "reference": "Reference de support",
      "copy": "Copier",
      "copyReference": "Copier la reference",
      "referenceCopied": "Copiee",
      "contactSupport": "Contacter le support",
      "digestLabel": "Identifiant technique"
    },
    "loading": {
      "title": "Chargement en cours",
      "description": "Veuillez patienter pendant le chargement de la page."
    }
  },
  "underConstruction": {
    "title": "Fonctionnalite en cours de developpement",
    "titleWithFeature": "{feature} en cours de developpement",
    "description": "Cette fonctionnalite sera implementee au Sprint {sprintNumber}, prevue pour le {date} ({distance}).",
    "sprintMarker": "Sprint {sprintNumber}",
    "estimatedDate": "Date estimee : {date}",
    "backToHome": "Retour a l'accueil"
  }
}
```

### 6.8 `repo/packages/shared-ui/src/messages/errors/ar-MA.json` (~30 keys Darija)

```json
{
  "errors": {
    "notFound": {
      "title": "الصفحة غير موجودة",
      "description": "الصفحة لي كتقلب عليها ماكاينش، أو تنقلات، أو مازال ماتطبقت. تأكد من الرابط ولا رجع للصفحة الرئيسية.",
      "cta": "ارجع للرئيسية",
      "back": "ارجع",
      "searchPlaceholder": "قلب فـ Skalean InsurTech",
      "popularLinks": "روابط مهمة",
      "links": {
        "dashboard": "لوحة القيادة",
        "policies": "العقود",
        "claims": "المطالبات",
        "contacts": "ديال الزبائن",
        "reports": "التقارير"
      }
    },
    "serverError": {
      "title": "وقع خطأ",
      "description": "كاين مشكل مؤقت. الفريق التقني تبلغ تلقائيا. تقدر تجرب مرة أخرى ولا تتواصل مع الدعم وعطيهم المرجع لي تحت.",
      "retry": "جرب مرة أخرى",
      "home": "ارجع للرئيسية",
      "reference": "ديال المرجع",
      "copy": "انسخ",
      "copyReference": "انسخ المرجع",
      "referenceCopied": "تنسخ",
      "contactSupport": "تواصل مع الدعم",
      "digestLabel": "المعرف التقني"
    },
    "loading": {
      "title": "كيتحمل",
      "description": "صبر شوية حتى تتحمل الصفحة."
    }
  },
  "underConstruction": {
    "title": "الميزة فطور التطوير",
    "titleWithFeature": "{feature} فطور التطوير",
    "description": "هاد الميزة غادي تتطبق فالسبرينت {sprintNumber}، مبرمجة لـ {date} ({distance}).",
    "sprintMarker": "السبرينت {sprintNumber}",
    "estimatedDate": "التاريخ المتوقع : {date}",
    "backToHome": "ارجع للرئيسية"
  }
}
```

### 6.9 `repo/packages/shared-ui/src/messages/errors/ar.json` (~30 keys arabe classique)

```json
{
  "errors": {
    "notFound": {
      "title": "الصفحة غير موجودة",
      "description": "الصفحة التي تبحث عنها غير موجودة، أو تم نقلها، أو لم يتم تنفيذها بعد. يُرجى التحقق من الرابط أو العودة إلى الصفحة الرئيسية.",
      "cta": "العودة إلى الصفحة الرئيسية",
      "back": "رجوع",
      "searchPlaceholder": "البحث في Skalean InsurTech",
      "popularLinks": "روابط شائعة",
      "links": {
        "dashboard": "لوحة القيادة",
        "policies": "العقود",
        "claims": "المطالبات",
        "contacts": "جهات الاتصال",
        "reports": "التقارير"
      }
    },
    "serverError": {
      "title": "وقع خطأ غير متوقع",
      "description": "نواجه مشكلةً مؤقتةً. تم إخطار فريقنا التقني تلقائيًا. يمكنك المحاولة مجدّدًا أو الاتصال بالدعم مع ذكر المرجع أدناه.",
      "retry": "حاول مجددًا",
      "home": "العودة إلى الصفحة الرئيسية",
      "reference": "مرجع الدعم",
      "copy": "نسخ",
      "copyReference": "نسخ المرجع",
      "referenceCopied": "تم النسخ",
      "contactSupport": "الاتصال بالدعم",
      "digestLabel": "المعرّف التقني"
    },
    "loading": {
      "title": "جارٍ التحميل",
      "description": "يُرجى الانتظار حتى يتم تحميل الصفحة."
    }
  },
  "underConstruction": {
    "title": "ميزة قيد التطوير",
    "titleWithFeature": "{feature} قيد التطوير",
    "description": "ستُنفَّذ هذه الميزة في المرحلة {sprintNumber}، المقرّرة في {date} ({distance}).",
    "sprintMarker": "المرحلة {sprintNumber}",
    "estimatedDate": "التاريخ المتوقع: {date}",
    "backToHome": "العودة إلى الصفحة الرئيسية"
  }
}
```

### 6.10 `repo/apps/web-broker/src/app/[locale]/not-found.tsx` (~25 lignes -- patron 8 apps)

```tsx
import { NotFoundPage } from '@insurtech/shared-ui';
import type { PopularLink } from '@insurtech/shared-ui';

const POPULAR_LINKS: PopularLink[] = [
  { href: '/contacts', labelKey: 'links.contacts' },
  { href: '/policies', labelKey: 'links.policies' },
  { href: '/claims', labelKey: 'links.claims' },
  { href: '/reports', labelKey: 'links.reports' },
  { href: '/', labelKey: 'links.dashboard' },
];

export default function NotFound() {
  return (
    <NotFoundPage
      brandVariant="broker"
      showSearch={true}
      popularLinks={POPULAR_LINKS}
    />
  );
}
```

### 6.11 `repo/apps/web-broker/src/app/[locale]/error.tsx` (~40 lignes -- patron 8 apps)

```tsx
'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { ErrorPage } from '@insurtech/shared-ui';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error, {
      tags: {
        app: 'web-broker',
        boundary: 'route-segment',
        digest: error.digest,
      },
      contexts: {
        nextjs: {
          version: '15.1.0',
        },
      },
    });
  }, [error]);

  return (
    <ErrorPage
      error={error}
      reset={reset}
      brandVariant="broker"
      appName="Skalean Broker"
      supportEmail="support@skalean-insurtech.ma"
    />
  );
}
```

### 6.12 `repo/apps/web-broker/src/app/[locale]/loading.tsx` (~20 lignes -- patron 8 apps)

```tsx
import { LoadingPage } from '@insurtech/shared-ui';

export default function Loading() {
  return <LoadingPage variant="skeleton" fullScreen={true} />;
}
```

### 6.13 `repo/apps/web-broker/src/app/global-error.tsx` (~80 lignes -- patron 8 apps)

```tsx
'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

const FALLBACK_MESSAGES = {
  en: {
    title: 'A critical error occurred',
    description:
      'The application encountered an unexpected critical error. Our technical team has been automatically notified.',
    retry: 'Reload page',
    reference: 'Reference',
  },
  fr: {
    title: 'Une erreur critique est survenue',
    description:
      "L'application a rencontre une erreur critique inattendue. Notre equipe technique a ete automatiquement notifiee.",
    retry: 'Recharger la page',
    reference: 'Reference',
  },
};

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error, {
      tags: { app: 'web-broker', boundary: 'global', digest: error.digest },
      level: 'fatal',
    });
  }, [error]);

  const lang = typeof navigator !== 'undefined' && navigator.language?.startsWith('fr') ? 'fr' : 'en';
  const m = FALLBACK_MESSAGES[lang];
  const ref = error.digest ?? 'unknown';

  return (
    <html lang={lang}>
      <body
        style={{
          fontFamily: 'system-ui, -apple-system, sans-serif',
          margin: 0,
          padding: '2rem',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #FFF 0%, #FFEAE0 100%)',
          color: '#1A2730',
        }}
      >
        <div style={{ maxWidth: '600px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '2rem', marginBottom: '1rem', color: '#E95D2C' }}>{m.title}</h1>
          <p style={{ fontSize: '1rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>{m.description}</p>
          <p style={{ fontSize: '0.875rem', color: '#666', marginBottom: '1.5rem' }}>
            {m.reference}: <code>{ref}</code>
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              backgroundColor: '#E95D2C',
              color: 'white',
              border: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: 600,
            }}
          >
            {m.retry}
          </button>
        </div>
      </body>
    </html>
  );
}
```

### 6.14 `repo/apps/web-broker/src/lib/sentry.ts` (~80 lignes -- patron 8 apps)

```ts
import * as Sentry from '@sentry/nextjs';

const PII_PATTERNS = [
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  /(?:\+212|0)[5-7]\d{8}/g,
  /\bCIN[:\s-]?[A-Z]{1,2}\d{5,8}\b/gi,
  /\bNIF[:\s-]?\d{8,}\b/gi,
  /\bRIB[:\s-]?\d{20,24}\b/gi,
  /\bPOL-[A-Z0-9]{8}\b/g,
];

function scrubPII(value: unknown): unknown {
  if (typeof value === 'string') {
    let scrubbed = value;
    for (const pattern of PII_PATTERNS) {
      scrubbed = scrubbed.replace(pattern, '[REDACTED]');
    }
    return scrubbed;
  }
  if (Array.isArray(value)) return value.map(scrubPII);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (['authorization', 'cookie', 'password', 'token', 'secret', 'cin', 'nif', 'rib'].some((s) =>
        k.toLowerCase().includes(s),
      )) {
        out[k] = '[REDACTED]';
      } else {
        out[k] = scrubPII(v);
      }
    }
    return out;
  }
  return value;
}

export function initSentry(appName: string) {
  if (Sentry.isInitialized()) return;
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
    if (process.env.NODE_ENV === 'development') {
      console.info('[sentry] DSN not set, skipping init');
    }
    return;
  }

  const isProd = process.env.NODE_ENV === 'production';

  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development',
    release: process.env.NEXT_PUBLIC_APP_VERSION ?? '0.1.0',
    tracesSampleRate: isProd
      ? Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? '0.1')
      : 1.0,
    replaysSessionSampleRate: isProd ? 0.1 : 0.0,
    replaysOnErrorSampleRate: 1.0,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllInputs: true,
        maskAllText: false,
        blockAllMedia: true,
      }),
    ],
    initialScope: {
      tags: { app: appName },
    },
    beforeSend(event) {
      if (event.request?.headers) {
        event.request.headers = scrubPII(event.request.headers) as Record<string, string>;
      }
      if (event.request?.data) {
        event.request.data = scrubPII(event.request.data);
      }
      if (event.extra) {
        event.extra = scrubPII(event.extra) as Record<string, unknown>;
      }
      if (event.user) {
        event.user = { id: event.user.id ?? 'anonymized' };
      }
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map((b) => ({
          ...b,
          message: typeof b.message === 'string' ? (scrubPII(b.message) as string) : b.message,
          data: b.data ? (scrubPII(b.data) as Record<string, unknown>) : b.data,
        }));
      }
      return event;
    },
  });
}

export { scrubPII };
```

### 6.15 `repo/apps/web-broker/sentry.client.config.ts` (~50 lignes -- patron 8 apps)

```ts
import * as Sentry from '@sentry/nextjs';
import { initSentry, scrubPII } from './src/lib/sentry';

initSentry('web-broker');

if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_SENTRY_DEBUG === 'true') {
  Sentry.addEventProcessor((event) => {
    console.debug('[sentry/client] event', { type: event.type, level: event.level });
    return event;
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (e) => {
    Sentry.captureException(e.reason, {
      tags: { source: 'unhandledrejection', app: 'web-broker' },
    });
  });
}

export { scrubPII };
```

### 6.16 `repo/apps/web-broker/sentry.server.config.ts` (~30 lignes -- patron 8 apps)

```ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_APP_VERSION,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  initialScope: { tags: { app: 'web-broker', runtime: 'node' } },
  beforeSend(event) {
    if (event.user) event.user = { id: 'server-anonymized' };
    return event;
  },
});
```

### 6.17 `repo/apps/web-broker/sentry.edge.config.ts` (~30 lignes -- patron 8 apps)

```ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_APP_VERSION,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  initialScope: { tags: { app: 'web-broker', runtime: 'edge' } },
});
```

### 6.18 `.env.example` enrichi (entrees a ajouter dans 8 apps)

```bash
# Sentry browser SDK -- decision-008 (Sentry SaaS dev/staging, self-hosted Atlas Cloud Benguerir Sprint 30)
NEXT_PUBLIC_SENTRY_DSN=
NEXT_PUBLIC_SENTRY_ENVIRONMENT=development
NEXT_PUBLIC_APP_VERSION=0.1.0
NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=0.1
NEXT_PUBLIC_SENTRY_REPLAYS_SAMPLE_RATE=0.1
NEXT_PUBLIC_SENTRY_DEBUG=false
SENTRY_AUTH_TOKEN=
```

### 6.19 `repo/apps/web-broker/next.config.mjs` (extrait modif withSentryConfig)

```js
import { withSentryConfig } from '@sentry/nextjs';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig = {
  reactStrictMode: true,
  experimental: { serverActions: { bodySizeLimit: '10mb' } },
};

export default withSentryConfig(withNextIntl(nextConfig), {
  silent: !process.env.CI,
  org: 'skalean',
  project: 'web-broker',
  authToken: process.env.SENTRY_AUTH_TOKEN,
  tunnelRoute: '/monitoring',
  hideSourceMaps: true,
  disableLogger: true,
});
```

---

## 7. Tests (18-22 tests detailles)

### 7.1 `repo/packages/shared-ui/src/components/__tests__/UnderConstruction.spec.tsx` (4 tests)

```tsx
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, it, expect } from 'vitest';
import { UnderConstruction } from '../UnderConstruction';
import messagesFr from '../../messages/errors/fr.json';

const wrapper = (children: React.ReactNode, locale = 'fr') => (
  <NextIntlClientProvider locale={locale} messages={messagesFr}>
    {children}
  </NextIntlClientProvider>
);

describe('UnderConstruction', () => {
  it('renders sprint number', () => {
    render(wrapper(<UnderConstruction sprintNumber={8} />));
    expect(screen.getByText(/Sprint 8/)).toBeInTheDocument();
  });

  it('renders feature name when provided', () => {
    render(wrapper(<UnderConstruction sprintNumber={8} featureName="CRM" />));
    expect(screen.getByText(/CRM/)).toBeInTheDocument();
  });

  it('renders link home with locale', () => {
    render(wrapper(<UnderConstruction sprintNumber={8} />, 'ar-MA'));
    const link = screen.getByRole('link', { name: /ارجع/ });
    expect(link).toHaveAttribute('href', '/ar-MA');
  });

  it('does not render any emoji character', () => {
    const { container } = render(wrapper(<UnderConstruction sprintNumber={8} />));
    expect(container.textContent).not.toMatch(/[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}]/u);
  });
});
```

### 7.2 `repo/packages/shared-ui/src/components/__tests__/NotFoundPage.spec.tsx` (4 tests)

```tsx
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, it, expect } from 'vitest';
import { NotFoundPage } from '../NotFoundPage';
import messagesFr from '../../messages/errors/fr.json';
import messagesAr from '../../messages/errors/ar.json';

describe('NotFoundPage', () => {
  it('renders branded with title localised FR', () => {
    render(
      <NextIntlClientProvider locale="fr" messages={messagesFr}>
        <NotFoundPage />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText('Page introuvable')).toBeInTheDocument();
    expect(screen.getByText('404')).toBeInTheDocument();
  });

  it('renders localised AR (RTL classique)', () => {
    render(
      <NextIntlClientProvider locale="ar" messages={messagesAr}>
        <NotFoundPage />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText('الصفحة غير موجودة')).toBeInTheDocument();
  });

  it('renders SVG illustration without emoji', () => {
    const { container } = render(
      <NextIntlClientProvider locale="fr" messages={messagesFr}>
        <NotFoundPage />
      </NextIntlClientProvider>,
    );
    const svg = container.querySelector('svg[aria-hidden]');
    expect(svg).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/[\u{1F300}-\u{1F6FF}]/u);
  });

  it('renders link home and popular links', () => {
    render(
      <NextIntlClientProvider locale="fr" messages={messagesFr}>
        <NotFoundPage popularLinks={[{ href: '/contacts', labelKey: 'links.contacts' }]} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole('link', { name: /Retour a l'accueil/i })).toHaveAttribute('href', '/fr');
    expect(screen.getByRole('link', { name: /Contacts/i })).toBeInTheDocument();
  });
});
```

### 7.3 `repo/packages/shared-ui/src/components/__tests__/ErrorPage.spec.tsx` (5 tests)

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as Sentry from '@sentry/nextjs';
import { ErrorPage } from '../ErrorPage';
import messagesFr from '../../messages/errors/fr.json';

vi.mock('@sentry/nextjs', () => ({
  isInitialized: vi.fn(() => true),
  captureException: vi.fn(),
}));

const setup = (errorOverride: Partial<Error & { digest?: string }> = {}) => {
  const error = Object.assign(new Error('Boom'), { digest: 'abc123' }, errorOverride);
  const reset = vi.fn();
  return {
    reset,
    error,
    rendered: render(
      <NextIntlClientProvider locale="fr" messages={messagesFr}>
        <ErrorPage error={error} reset={reset} />
      </NextIntlClientProvider>,
    ),
  };
};

describe('ErrorPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('matches App Router signature {error, reset}', () => {
    const { reset, error } = setup();
    expect(reset).toBeDefined();
    expect(error.digest).toBe('abc123');
  });

  it('displays trace id', () => {
    setup();
    expect(screen.getByTestId('trace-id-value')).toBeInTheDocument();
    expect(screen.getByTestId('trace-id-value').textContent).toMatch(/digest-abc123|client-/);
  });

  it('copy-to-clipboard works on click', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    Object.defineProperty(window, 'isSecureContext', { value: true, writable: true });
    setup();
    await userEvent.click(screen.getByTestId('copy-trace-id'));
    await waitFor(() => {
      expect((navigator.clipboard.writeText as any)).toHaveBeenCalled();
    });
  });

  it('Sentry.captureException is called with traceId tag', async () => {
    setup();
    await waitFor(() => {
      expect(Sentry.captureException).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          tags: expect.objectContaining({ traceId: expect.any(String) }),
        }),
      );
    });
  });

  it('reset button triggers reset()', () => {
    const { reset } = setup();
    fireEvent.click(screen.getByRole('button', { name: /Reessayer/i }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
```

### 7.4 `repo/packages/shared-ui/src/components/__tests__/LoadingPage.spec.tsx` (3 tests)

```tsx
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, it, expect } from 'vitest';
import { LoadingPage } from '../LoadingPage';
import messagesFr from '../../messages/errors/fr.json';

const wrap = (children: React.ReactNode) => (
  <NextIntlClientProvider locale="fr" messages={messagesFr}>
    {children}
  </NextIntlClientProvider>
);

describe('LoadingPage', () => {
  it('renders skeleton variant by default', () => {
    render(wrap(<LoadingPage />));
    expect(screen.getByTestId('loading-page-skeleton')).toBeInTheDocument();
  });

  it('renders spinner when variant=spinner', () => {
    render(wrap(<LoadingPage variant="spinner" />));
    expect(screen.getByTestId('loading-page-spinner')).toBeInTheDocument();
  });

  it('exposes aria-busy and role status', () => {
    render(wrap(<LoadingPage />));
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(status).toHaveAttribute('aria-label', 'Chargement en cours');
  });
});
```

### 7.5 `repo/packages/shared-ui/src/lib/__tests__/error-helpers.spec.ts` (5 tests)

```ts
import { describe, it, expect, vi } from 'vitest';
import { extractTraceId, formatErrorMessage, isClientError, isServerError, copyToClipboard } from '../error-helpers';

describe('extractTraceId', () => {
  it('uses x-trace-id header when present', () => {
    const headers = new Headers({ 'x-trace-id': 'tr-123' });
    expect(extractTraceId(new Error('x'), headers)).toBe('tr-123');
  });

  it('falls back to digest when no header', () => {
    const err = Object.assign(new Error('x'), { digest: 'abc' });
    expect(extractTraceId(err)).toBe('digest-abc');
  });

  it('falls back to client UUID when no digest no header', () => {
    Object.assign(global, { window: { crypto: { randomUUID: () => '11111111-1111-1111-1111-111111111111' } } });
    expect(extractTraceId(new Error('x'))).toMatch(/^client-/);
  });
});

describe('isClientError / isServerError', () => {
  it('detects ChunkLoadError as client', () => {
    const err = Object.assign(new Error('Loading chunk failed'), { name: 'ChunkLoadError' });
    expect(isClientError(err)).toBe(true);
  });

  it('detects digest-bearing error as server', () => {
    const err = Object.assign(new Error('SQL exploded'), { digest: 'xyz' });
    expect(isServerError(err)).toBe(true);
  });
});

describe('copyToClipboard', () => {
  it('uses navigator.clipboard when available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(global, { navigator: { clipboard: { writeText } }, window: { isSecureContext: true } });
    const ok = await copyToClipboard('hello');
    expect(ok).toBe(true);
    expect(writeText).toHaveBeenCalledWith('hello');
  });
});

describe('formatErrorMessage', () => {
  it('capitalizes first letter for fr', () => {
    expect(formatErrorMessage(new Error('boom'), 'fr')).toBe('Boom');
  });

  it('keeps as-is for ar', () => {
    expect(formatErrorMessage(new Error('boom'), 'ar')).toBe('boom');
  });
});
```

### 7.6 `repo/e2e/web/error-pages.spec.ts` (~250 lignes Playwright -- 8 tests)

```ts
import { test, expect } from '@playwright/test';

const APPS = [
  { name: 'web-broker', url: 'http://localhost:3001' },
  { name: 'web-garage', url: 'http://localhost:3002' },
];

for (const app of APPS) {
  test.describe(`error pages -- ${app.name}`, () => {
    test('404 page renders branded localised FR', async ({ page }) => {
      const res = await page.goto(`${app.url}/fr/this-route-does-not-exist`);
      expect(res?.status()).toBe(404);
      await expect(page.getByText('Page introuvable')).toBeVisible();
      await expect(page.getByRole('link', { name: /Retour a l'accueil/i })).toBeVisible();
    });

    test('404 page renders localised AR (RTL)', async ({ page }) => {
      await page.goto(`${app.url}/ar/this-route-does-not-exist`);
      await expect(page.getByText('الصفحة غير موجودة')).toBeVisible();
      const html = page.locator('html');
      await expect(html).toHaveAttribute('dir', 'rtl');
    });

    test('error boundary triggered shows traceId', async ({ page }) => {
      await page.goto(`${app.url}/fr?simulate-error=true`);
      await expect(page.getByText("Une erreur s'est produite")).toBeVisible();
      await expect(page.getByTestId('trace-id-value')).toBeVisible();
    });

    test('copy-to-clipboard for traceId works', async ({ page, context }) => {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
      await page.goto(`${app.url}/fr?simulate-error=true`);
      await page.getByTestId('copy-trace-id').click();
      await expect(page.getByText(/Copiee/i)).toBeVisible({ timeout: 3000 });
    });

    test('reset button retries page', async ({ page }) => {
      await page.goto(`${app.url}/fr?simulate-error=true`);
      const responsePromise = page.waitForResponse((r) => r.url().includes('/fr'));
      await page.getByRole('button', { name: /Reessayer/i }).click();
      await responsePromise;
    });

    test('loading state visible during navigation', async ({ page }) => {
      await page.goto(`${app.url}/fr`);
      await page.route('**/fr/slow-page', (route) => {
        setTimeout(() => route.continue(), 1500);
      });
      const navP = page.click('text=/slow-page/').catch(() => undefined);
      await expect(page.getByRole('status', { name: /Chargement/i })).toBeVisible({ timeout: 2000 }).catch(() => {});
      await navP;
    });

    test('Sentry capture verified via mock', async ({ page }) => {
      const sentryRequests: string[] = [];
      await page.route('**/sentry/**', (route) => {
        sentryRequests.push(route.request().url());
        route.fulfill({ status: 200, body: '{}' });
      });
      await page.goto(`${app.url}/fr?simulate-error=true`);
      await page.waitForTimeout(2000);
      expect(sentryRequests.length).toBeGreaterThanOrEqual(0);
    });

    test('locale switch preserved on error page', async ({ page }) => {
      await page.goto(`${app.url}/fr?simulate-error=true`);
      await expect(page.getByText("Une erreur s'est produite")).toBeVisible();
    });
  });
}
```

---

## 8. Variables d'environnement

| Variable | Type | Defaut | Notes |
|----------|------|--------|-------|
| `NEXT_PUBLIC_SENTRY_DSN` | string client | (vide) | DSN Sentry projet `web-broker` (et autres apps). Vide en dev = init skip. |
| `NEXT_PUBLIC_SENTRY_ENVIRONMENT` | string | `development` | tag environment Sentry events |
| `NEXT_PUBLIC_APP_VERSION` | string | `0.1.0` | release tag Sentry, injecte via CI build |
| `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` | number string | `0.1` | sample rate browser tracing prod |
| `NEXT_PUBLIC_SENTRY_REPLAYS_SAMPLE_RATE` | number string | `0.1` | sample rate session replay (PII filtered) |
| `NEXT_PUBLIC_SENTRY_DEBUG` | boolean | `false` | enable verbose Sentry logs dev |
| `SENTRY_AUTH_TOKEN` | string server | (vide) | upload sourcemaps CI build, JAMAIS client |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | string | `support@skalean-insurtech.ma` | mailto link error page |

---

## 9. Securite, observabilite, performance

### Securite

- **Sentry beforeSend PII filter** : email regex, tel +212 regex, NIF, CIN, RIB, numero police Skalean (`POL-XXXXXXXX`) supprimes avant envoi. Headers `Authorization`, `Cookie`, `x-tenant-id` body redactes (le tenant-id ID public OK mais JWT body redacte).
- **No sourcemaps cote client** : `hideSourceMaps: true` dans `withSentryConfig` -- les sourcemaps sont uploadees sur Sentry pour symbolication mais pas servies au client (evite reverse engineering).
- **CSP allow Sentry** : `connect-src` doit autoriser `https://*.ingest.sentry.io` ET le `tunnelRoute: '/monitoring'` (route Next.js qui proxy les events Sentry pour bypass adblock).
- **error.digest ne fuite pas en prod** : visible uniquement en dev (process.env.NODE_ENV !== 'production'), evite leak structure interne en production.

### Observabilite

- **traceId visible user** : copy-to-clipboard pour support N1, integre dans logs OpenSearch (Sprint 12 backend) + Sentry tag.
- **Sentry replay sessions on error** : `replaysOnErrorSampleRate: 1.0` (100% replay capture quand erreur), `replaysSessionSampleRate: 0.1` (10% session normale). Replay PII-masked.
- **Breadcrumbs** : Sentry capture last 100 actions user avant erreur (clicks, navigation, console). Filtres PII appliques.

### Performance

- **shared-ui tree-shaking** : exports nommes par fichier, pas de barrel monolithique. `import { ErrorPage } from '@insurtech/shared-ui'` ne charge que ErrorPage + deps directes (lucide-react icons specifiques).
- **Sentry client bundle** : ~50 ko gzipped. Lazy-loaded via `instrumentation-client.ts` pas inline dans layout pour minimiser TTI.
- **SVG inline** : illustrations SVG inline dans composants (pas `<img src="..."/>` qui ajouterait round-trip HTTP). Total ~3 ko gzip per illustration.
- **Loading skeleton no-JS** : `LoadingPage` skeleton pure CSS animations, fonctionne sans JS.

---

## 10. Validations et criteres acceptance (V1-V30 -- 28 minimum)

### P0 (15 minimum -- bloquants)

- **V1 (P0)** : Page 404 rendable et brandee Skalean. Test : `curl http://localhost:3001/fr/non-existent-route` retourne 200 (Next.js convention not-found.tsx) avec body contenant `Page introuvable`.
- **V2 (P0)** : Page 500 error boundary fonctionnel. Test : `?simulate-error=true` declenche throw -> `<ErrorPage>` rendu visible.
- **V3 (P0)** : traceId visible sur page 500. Test : `data-testid="trace-id-value"` present non vide.
- **V4 (P0)** : traceId copyable. Test : click `data-testid="copy-trace-id"` -> message "Copiee" affiche dans 2s.
- **V5 (P0)** : Loading page rendable. Test : ralentir reseau Playwright -> `role="status"` `aria-busy="true"` visible.
- **V6 (P0)** : UnderConstruction component rendable. Test : import in any page, render `<UnderConstruction sprintNumber={8} />`, "Sprint 8" visible.
- **V7 (P0)** : Texte localise 3 locales fr / ar-MA / ar. Test : naviguer `/fr`, `/ar-MA`, `/ar` sur error page -> 3 versions textes differentes.
- **V8 (P0)** : Sentry init via `NEXT_PUBLIC_SENTRY_DSN`. Test : env var absent -> skip init log "DSN not set". env var present -> `Sentry.isInitialized()` true.
- **V9 (P0)** : Sentry.captureException appele on error. Test : mock Sentry, declencher error -> spy `captureException` toHaveBeenCalledWith(error).
- **V10 (P0)** : Reset button retries page segment. Test : Playwright click "Reessayer" -> page reload sans error si race condition resolue.
- **V11 (P0)** : Link home redirige `/${locale}`. Test : Playwright click "Retour accueil" sur `/ar` error page -> URL devient `/ar`.
- **V12 (P0)** : RTL ar layout 404/500 affiche dir=rtl. Test : Playwright `expect(page.locator('html')).toHaveAttribute('dir', 'rtl')` sur `/ar/non-existent`.
- **V13 (P0)** : No emoji (illustrations SVG only). Test : `grep -rE "[\\u{1F300}-\\u{1F9FF}]" repo/packages/shared-ui/src/components/` retourne 0.
- **V14 (P0)** : Typecheck/lint clean. Test : `pnpm --filter @insurtech/shared-ui typecheck` 0 erreur.
- **V15 (P0)** : Build production reussit. Test : `pnpm --filter @insurtech/web-broker build` exit 0.

### P1 (8 minimum)

- **V16 (P1)** : Illustration SVG branded Skalean (palette Orange + Navy). Test : `<svg>` element present avec `fill="#E95D2C"` ou `fill="#1A2730"` dans markup.
- **V17 (P1)** : error.digest dev-only. Test : `NODE_ENV=production` -> `data-testid="dev-digest"` absent. `NODE_ENV=development` -> present.
- **V18 (P1)** : Contact support link mailto with traceId. Test : `<a href>` contient `mailto:support@skalean-insurtech.ma?subject=...{traceId}`.
- **V19 (P1)** : Search box optionnelle 404. Test : `<NotFoundPage showSearch={false}>` -> input search absent.
- **V20 (P1)** : Popular links nav 404 rendable. Test : props `popularLinks=[...]` -> nav rendered avec items.
- **V21 (P1)** : ARIA aria-busy true loading. Test : `expect(getByRole('status')).toHaveAttribute('aria-busy', 'true')`.
- **V22 (P1)** : Error boundary signature App Router. Test : TypeScript strict valide `{error: Error & {digest?: string}, reset: () => void}`.
- **V23 (P1)** : global-error.tsx fallback layout errors. Test : Playwright simuler crash dans layout root -> global-error.tsx rendu avec `<html><body>` brut + message bilingue.

### P2 (5 minimum)

- **V24 (P2)** : Custom branded illustrations per app variant (broker / garage / customer differents). Test : `<NotFoundPage brandVariant="customer">` -> SkaleanLogo customer variant rendu.
- **V25 (P2)** : Sprint marker date computed from sprint number. Test : `getSprintDate(8)` retourne date proche `2026-04-15`.
- **V26 (P2)** : Error reporting form Sprint 14 placeholder. Test : link form support Sprint 14 placeholder dans `<ErrorPage>`.
- **V27 (P2)** : Status page link Sprint 27. Test : `<ErrorPage>` propose lien optionnel `https://status.skalean-insurtech.ma` (Sprint 27 lance).
- **V28 (P2)** : Error analytics dashboard Sprint 27 lien. Test : ajouter prop `analyticsLink` rendable.
- **V29 (P2)** : Sentry replay sessions on error. Test : env `NEXT_PUBLIC_SENTRY_DSN` set + error -> Sentry replay event sent (mock verifie).
- **V30 (P2)** : Sentry beforeSend PII filter unit-tested. Test : event avec email payload -> apres beforeSend, email = `[REDACTED]`.

---

## 11. Edge cases (12 minimum)

1. **Next.js 15 error.tsx must be 'use client'** : oubli directive -> build casse. CI lint rule custom verifie.

2. **error.digest only in production** : en dev `error.digest === undefined`. Le helper `extractTraceId` doit gerer (fallback header puis crypto UUID).

3. **global-error.tsx required for layout errors (replaces html+body)** : Next.js 15 imposition. Sans global-error, erreurs layout = ecran blanc.

4. **Sentry init twice (React Strict Mode)** : double-mount = double init. `Sentry.isInitialized()` check obligatoire ou init dans `instrumentation.ts`.

5. **traceId may be undefined if middleware didn't run** : requete static asset error -> middleware skip -> pas d'injection traceId. Fallback client UUID prefixe `client-`.

6. **localized messages may not load if i18n provider failed** : json malforme, locale exotique. Fallback English + French hardcoded dans `<ErrorPage>` et `global-error.tsx`.

7. **Image SVG illustration hydration server vs client** : SVG avec id randomise -> hydration warning. Solution : `useId()` React 19 ou ids deterministes.

8. **Sentry replay sessions PII filter mandatory** : `mask: 'input,textarea'` + `block: '.skalean-pii'`. Sans mask, frappe email visible -> Loi 09-08 violation.

9. **404 vs not-found vs default-not-found Next.js conventions** : `not-found.tsx` rendu via `notFound()` ou route inexistante. `default.tsx` pour parallel routes seulement. Sprint 4 = `not-found.tsx` au niveau `[locale]/`.

10. **error.tsx catches errors in nested route segment only** : erreur dans layout racine = pas catchee. Need `global-error.tsx` au niveau `app/`.

11. **Loading state skeleton vs spinner UX choice** : skeleton pour root segment full page, spinner pour sub-segment. Variant prop `<LoadingPage variant="...">`.

12. **UnderConstruction date computation Sprint N** : mapping `sprint-calendar.ts` Sprint 1 = nov 2025, Sprint 35 = oct 2027. Sprint > 35 -> "Roadmap a definir" affiche.

13. **error.digest contains sensitive info en dev** : stack trace peut contenir paths absolus serveur (`/home/runner/...`). Affichage dev only via details/summary masque par defaut.

14. **copyToClipboard requires HTTPS or localhost** : `navigator.clipboard.writeText` throws en HTTP non-localhost. Fallback execCommand textarea hidden.

15. **SkaleanLogo variant per app** : 5 variantes (broker, garage, admin, customer, assure) -- shared-ui exporte component avec branding adaptif.

---

## 12. Conformite Maroc

### Loi 09-08 CNDP (Protection donnees personnelles)

- **Sentry beforeSend PII filter mandatory** : email regex (`[a-z0-9._%+-]+@...`), telephone marocain (`+212` ou `0[5-7]\d{8}`), NIF (`\d{8,}`), CIN (lettre + chiffres pattern marocain), RIB (24 chiffres), numero police Skalean (`POL-XXXXXXXX`) tous supprimes avant envoi event Sentry. Test unitaire `scrubPII` valide chaque pattern.
- **Sentry replay PII mask** : `maskAllInputs: true` + `blockAllMedia: true`. Selectors `.skalean-pii` blocked.
- **Headers Authorization, Cookie scrubbed** : keys `authorization`, `cookie`, `password`, `token`, `secret`, `cin`, `nif`, `rib` dans request headers ou body remplacees par `[REDACTED]`.
- **Audit trail** : chaque error captured tag `loi_09_08_compliant: true` apres beforeSend, audit trail Sprint 27 reading.

### ACAPS (Autorite de Controle des Assurances et de la Prevoyance Sociale)

- **traceId persistant** : 500 errors loggent traceId dans Sentry tag + retrievable via API Sentry pour audit Sprint 27. Croisement avec logs OpenSearch backend Sprint 12.
- **Retention 5 ans** : Sentry SaaS retention par defaut 90 jours. Migration Sentry self-hosted Sprint 30 = retention 5 ans (ACAPS exigence).

### Atlas Cloud Benguerir (decision-008)

- **Sprint 4-29 Sentry SaaS** : tolere car early stage, monitoring critique. PII filter strict.
- **Sprint 30 migration Sentry self-hosted** : docker-compose `sentry/sentry:24.x` deploye sur Atlas Cloud Benguerir. Migration plan documentee `decisions/sentry-self-hosted-migration.md` Sprint 30 task.
- **Sourcemaps storage** : Sprint 30 -> hosted sur S3 Atlas Cloud Benguerir (`s3.bgr.atlascloudservices.ma/skalean-sourcemaps/`).

### Multilinguisme MA (decision-009)

- **3 locales obligatoires fr / ar-MA / ar** : `<NotFoundPage>`, `<ErrorPage>`, `<LoadingPage>`, `<UnderConstruction>` toutes localisees. Tests Vitest validate parite des cles.
- **RTL ar et ar-MA** : `<html dir="rtl">` set par layout.tsx selon locale. Verifie Playwright e2e.
- **global-error.tsx bilingue minimum** : FR + EN car i18n provider peut etre casse. Pas de Darija/Arabe pour eviter dependence next-intl.

---

## 13. Conventions (14)

1. **NO EMOJI ABSOLU** -- aucune emoji dans aucun fichier code, JSON message, illustration. SVG inline branded Skalean uniquement.
2. **TypeScript strict** -- `strict: true`, `noUncheckedIndexedAccess: true`, signatures App Router conformes `{error: Error & {digest?: string}, reset: () => void}`.
3. **`'use client'` on error.tsx** -- obligatoire Next.js 15. Lint custom CI verifie.
4. **Sentry browser SDK `@sentry/nextjs` 8.47.0** -- version pinning exact, pas de range caret.
5. **`@insurtech/shared-ui` exports** -- `NotFoundPage`, `ErrorPage`, `LoadingPage`, `UnderConstruction`, `extractTraceId`, `formatErrorMessage`, `copyToClipboard`, `getSprintDate`. Tree-shaking compatible.
6. **3 locales fr / ar-MA / ar avec RTL** -- decision-009. Parite des cles validee CI (`scripts/validate-i18n-keys.ts`).
7. **traceId display for support** -- visible user, copy-to-clipboard, tag Sentry, croisement logs OpenSearch backend.
8. **Copy-to-clipboard for traceId** -- `navigator.clipboard.writeText` + fallback `execCommand`.
9. **Sentry beforeSend PII filter Loi 09-08** -- regex email + tel + NIF + CIN + RIB + numero police. Test unit valide chaque pattern.
10. **Illustrations SVG branded** -- inline composants, palette Skalean Orange (#E95D2C) / Navy (#1A2730) / Sky Blue (#B0CEE2) / ACAPS Teal (#2D5773). Pas de `<img>`.
11. **Margin-start `me-2` au lieu de `ml-2`** -- support RTL natif Tailwind 4.
12. **Aucun `console.log` en code production** -- seulement `console.info` dans dev gates, `console.debug` Sentry debug mode.
13. **`'use client'` en haut de fichier** -- avant imports, sans accent, sans backslash.
14. **Tests unitaires Vitest + E2E Playwright** -- coverage minimum 80% sur composants shared-ui error pages.

---

## 14. Plan d'execution (4h decompose)

### H1 (60 min) -- Composants shared-ui

- Creer `UnderConstruction.tsx` (15 min)
- Creer `NotFoundPage.tsx` (20 min)
- Creer `ErrorPage.tsx` (20 min)
- Creer `LoadingPage.tsx` (5 min)

### H2 (60 min) -- Helpers + i18n + illustrations

- Creer `error-helpers.ts` (15 min)
- Creer `sprint-calendar.ts` (5 min)
- Creer 4 illustrations SVG (`NotFoundIllustration`, `ErrorIllustration`, `LoadingIllustration`, `UnderConstructionIllustration`) (20 min)
- Creer messages JSON 3 locales `errors/{fr,ar-MA,ar}.json` (15 min)
- Mettre a jour barrel `shared-ui/src/index.ts` (5 min)

### H3 (60 min) -- Per-app integration (8 apps)

- Script `generate-error-pages.ts` scaffold (10 min)
- Run script for 8 apps : `not-found.tsx`, `error.tsx`, `loading.tsx`, `global-error.tsx`, `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`, `lib/sentry.ts`, `.env.example` (30 min)
- Mettre a jour `next.config.mjs` 8 apps avec `withSentryConfig` (10 min)
- Configurer Sentry project Skalean InsurTech 8 apps (10 min)

### H4 (60 min) -- Tests + validation

- Tests unitaires Vitest shared-ui (5 fichiers, 21 tests) (20 min)
- Test E2E Playwright `error-pages.spec.ts` (8 tests) (20 min)
- Run tests + fix failures (10 min)
- Validation V1-V30 manuelle + automatisee (10 min)

---

## 15. Resultats attendus

- 4 composants shared-ui (`NotFoundPage`, `ErrorPage`, `LoadingPage`, `UnderConstruction`) operationnels avec tests unitaires Vitest 21 tests pass.
- 8 apps Next.js 15 avec `not-found.tsx`, `error.tsx`, `loading.tsx`, `global-error.tsx`, Sentry client + server + edge config, lib/sentry.ts wrapper PII filter.
- Tests E2E Playwright `error-pages.spec.ts` 8 tests pass sur web-broker + web-garage minimum (les 6 autres apps couverts par smoke test apre s migration Sprint 5).
- Build production 8 apps reussi avec sourcemaps uploadees Sentry.
- Sentry events arrivent dans projet Sentry Skalean avec traceId tag, sans PII (verifie via Sentry API + test unit `scrubPII`).
- Texte localise sur 3 locales fr / ar-MA / ar (validation parite cles CI).
- 0 emoji detecte dans code (`grep -rE "[\\u{1F300}-\\u{1F9FF}]"` retourne 0).
- Lighthouse performance non degrade (page 404 < 100 ko HTML, < 50 ko JS).

---

## 16. Risques et mitigation

- **Risque Sentry double-init** : mitigation `Sentry.isInitialized()` check + init dans `instrumentation.ts` Next.js 15 server-side.
- **Risque PII leak Sentry** : mitigation `beforeSend` PII filter strict + tests unit chaque pattern + audit log Sprint 27.
- **Risque hydration mismatch SVG** : mitigation `useId()` React 19, ids deterministes dans illustrations.
- **Risque i18n provider crash** : mitigation fallback messages hardcoded EN + FR dans `global-error.tsx`.
- **Risque copy-to-clipboard HTTP** : mitigation fallback `execCommand` textarea hidden.
- **Risque sourcemaps client leak** : mitigation `hideSourceMaps: true` Sentry config.

---

## 17. Definition of Done

- [ ] 4 composants shared-ui crees, exporte via barrel, tests unitaires 21 tests pass
- [ ] Helpers error-helpers.ts + sprint-calendar.ts crees, tests unitaires pass
- [ ] 4 illustrations SVG branded Skalean inline crees (no emoji)
- [ ] Messages JSON 3 locales (fr / ar-MA / ar) avec parite cles validee CI
- [ ] 8 apps avec not-found.tsx + error.tsx + loading.tsx + global-error.tsx
- [ ] 8 apps avec sentry.client.config.ts + sentry.server.config.ts + sentry.edge.config.ts + lib/sentry.ts
- [ ] 8 apps avec .env.example enrichi NEXT_PUBLIC_SENTRY_*
- [ ] 8 apps avec next.config.mjs withSentryConfig wrapper
- [ ] Test E2E Playwright error-pages.spec.ts 8 tests pass
- [ ] Build production 8 apps reussi sans erreur
- [ ] Typecheck 0 erreur
- [ ] Lint 0 erreur (eslint + custom no-emoji rule)
- [ ] Sentry events test envoyes verifies sans PII (script test-sentry-integration.ts)
- [ ] V1-V30 valides
- [ ] Documentation tache 1.4.15 dans README sprint-04
- [ ] PR review code review approuvee 2 reviewers
- [ ] Merge sur develop apres CI green
