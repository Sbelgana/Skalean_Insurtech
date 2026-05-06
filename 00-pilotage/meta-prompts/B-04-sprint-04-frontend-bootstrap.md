# META-PROMPT B-04 -- SPRINT 4 FRONTEND BOOTSTRAP

**Version** : v2.2 (Option B)
**Phase** : 1 -- Bootstrap
**Sprint** : 4 / 35 (cumul) -- DERNIER de la Phase 1
**Position** : Apres API NestJS, fin Phase 1 Bootstrap
**Numerotation taches** : 1.4.1 a 1.4.16 (16 taches car 8 apps + 3 packages shared)
**Effort total** : ~90 heures developpement / 2 semaines
**Priorite** : P0 (bloquant pour tous les sprints frontend metier)

---

## Objectif Global du Sprint

Etablir le squelette des **8 applications frontend Next.js 15** (4 du plan original v1.0 + 3 nouvelles v2.0 + 1 admin) avec multilingue (FR / Darija / Arabe classique RTL), 3 packages shared (UI / PWA / Maps), et toolings communs (Tailwind 4 + shadcn/ui + theme Skalean Sofidemy + React Query + Axios).

A la sortie de ce sprint :
- 8 apps Next.js 15 demarrent avec `pnpm dev` (ports 3000-3006)
- Multilingue operationnel : 3 locales fr / ar-MA (Darija) / ar (classique avec RTL)
- Theme Skalean Sofidemy applique (palette Orange #E95D2C, Navy #1A2730, Sky Blue #B0CEE2, ACAPS Teal #2D5773, Montserrat font)
- 30+ composants shadcn/ui dans `shared-ui` package
- 2 PWA configurees (web-garage-mobile + web-assure-mobile) avec service worker offline
- Mapbox GL JS wrapper dans `shared-maps`
- Client API Axios avec interceptors auto-injection (x-tenant-id, x-trace-id, Authorization)
- Generation client TypeScript depuis OpenAPI Swagger
- React Query (TanStack v5) configure
- Layouts partages : sidebar + topbar per app type
- Pages placeholder + 404/500
- Tests Playwright passent (chromium + mobile-safari)
- Lighthouse baseline mesuree (cible Sprint 18 : >= 95 perf customer-portal SEO)

---

## Frontiere du Sprint

**INCLUS** :
- 8 apps Next.js 15 stubs (pages placeholder, layouts, navigation)
- Multilingue 3 locales avec RTL pour ar
- 3 packages shared : UI, PWA, Maps
- Theme Skalean Sofidemy (palette + Montserrat)
- shadcn/ui setup + 30+ composants
- Tailwind 4 config
- React Query + Axios + interceptors
- Generation OpenAPI client TypeScript
- PWA setup pour 2 apps mobile
- Service worker + offline strategy basique
- Layouts partages
- Pages 404/500
- Tests E2E Playwright + Lighthouse baseline

**EXCLU** (sera ajoute aux sprints suivants) :
- Logique metier (chaque sprint metier ajoute ses pages : Auth Sprint 5, CRM Sprint 8, etc.)
- next-auth integration JWT (Sprint 5)
- Forms metier (Sprint 8+)
- Pages SEO + content public (Sprint 18 Customer Portal)
- Comparateur assurance (Sprint 18)
- App declaration sinistre client (Sprint 25)
- Dashboards admin (Sprint 27)

---

## Lectures Prealables Obligatoires

1. `00-pilotage/documentation/8-skalean-insurtech-prompt-master.md` -- regles transverses (no-emoji, multilingue, ports apps)
2. `00-pilotage/documentation/1-stack-technique.yaml` -- versions exactes Next.js, Tailwind, shadcn
3. `00-pilotage/documentation/6-metriques-validation.md` -- cibles Lighthouse + accessibility
4. Sortie Sprint 1 : structure 8 apps stubs, packages shared-ui/shared-pwa/shared-maps stubs
5. Sortie Sprint 3 : API NestJS sur :4000 avec Swagger /docs-json (utilise pour generation client)

---

## Stack Imposee (Sprint 4)

| Composant | Version | Notes |
|-----------|---------|-------|
| Next.js | 15.1.0 | App Router, RSC, Server Actions |
| React | 19.0.0 | Server Components |
| Tailwind CSS | 4.0.0-beta.4 | nouveaux Oxide engine + CSS variables natives |
| shadcn/ui | latest | composants compose |
| next-intl | 3.26.3 | i18n (fr / ar-MA / ar avec RTL) |
| @tanstack/react-query | 5.62.7 | server state management |
| @tanstack/react-query-devtools | 5.62.7 | devtools dev |
| axios | 1.7.9 | HTTP client |
| @hookform/resolvers | 3.9.1 | form validation Zod |
| react-hook-form | 7.54.2 | forms |
| zod | 3.24.1 | schemas (deja Sprint 1) |
| zustand | 5.0.2 | client state management |
| openapi-typescript | 7.4.4 | generation client depuis Swagger |
| openapi-fetch | 0.13.4 | client API depuis OpenAPI types |
| mapbox-gl | 3.8.0 | cartes |
| next-pwa | 5.6.0 | service worker config (alternative : Workbox custom) |
| lucide-react | 0.469.0 | icones |
| clsx + tailwind-merge | 2.1.1 | className helpers |
| Storybook | 8.4.7 | preview shared-ui (P1) |

**Fonts** :
- Montserrat 300/400/600/700/800/900 (latin + arabic) -- texte principal
- Noto Naskh Arabic 400/700 -- fallback arabe classique
- Geist Mono 400 -- code/numbers

---

## Vue d'Ensemble des 16 Taches

| # | Tache | Effort | Priorite | App / Package |
|---|-------|--------|----------|---------------|
| 1.4.1 | web-broker bootstrap (port 3001) | 5h | P0 | App courtage |
| 1.4.2 | web-garage bootstrap (port 3002) | 5h | P0 | App garage |
| 1.4.3 | web-garage-mobile bootstrap (port 3003 PWA) | 5h | P0 | App technicien mobile |
| 1.4.4 | web-insurtech-admin bootstrap (port 3000) | 5h | P0 | App SuperAdmin |
| 1.4.5 | web-customer-portal bootstrap (port 3004 SSG + ISR + SEO) -- NEW v2.0 | 6h | P0 | Site public + comparateur |
| 1.4.6 | web-assure-portal bootstrap (port 3005) -- NEW v2.0 | 5h | P0 | Self-service assure |
| 1.4.7 | web-assure-mobile bootstrap (port 3006 PWA) -- NEW v2.0 | 5h | P0 | Mobile assure (sinistres) |
| 1.4.8 | Package shared-ui -- theme + 30+ composants shadcn | 8h | P0 | Package partage |
| 1.4.9 | Package shared-pwa -- hooks PWA install/offline/SW -- NEW v2.0 | 6h | P0 | Package partage |
| 1.4.10 | Package shared-maps -- wrapper Mapbox GL JS -- NEW v2.0 | 5h | P0 | Package partage |
| 1.4.11 | Multilingue next-intl 8 apps + RTL | 6h | P0 | Cross-cutting |
| 1.4.12 | Tooling monorepo frontend (Turbo, scripts dev parallel) | 4h | P0 | Cross-cutting |
| 1.4.13 | Generation client API TypeScript depuis OpenAPI | 4h | P0 | Cross-cutting |
| 1.4.14 | Layouts partages (sidebar + topbar) par type app | 6h | P0 | Cross-cutting |
| 1.4.15 | Pages placeholder + 404/500 | 4h | P0 | Cross-cutting |
| 1.4.16 | Tests E2E + Lighthouse baseline + Storybook (P1) | 7h | P0/P1 | Cross-cutting |

**Total** : 86 heures.

---

# DETAIL DES 16 TACHES

---

## Tache 1.4.1 -- web-broker Bootstrap (Port 3001)

**Metadonnees** : Phase 1 / Sprint 4 / P0 / 5h / Depend de Sprint 3

**But** : Initialiser l'app `web-broker` (utilisee par cabinet courtier : commerciaux, broker_admin) sur port 3001 avec Next.js 15 App Router, multilingue, theme Skalean.

**Contexte** : Domaine prod : `broker.skalean-insurtech.ma`. Utilisateurs : courtiers (broker_admin, broker_user, broker_commercial). Workflow principaux : recherche contacts, souscription polices (Sprint 17), gestion sinistres (Sprint 22), commissions (Sprint 17).

**Livrables checkables** :
- [ ] `repo/apps/web-broker/package.json` enrichi (deps : next, react, next-intl, @tanstack/react-query, axios, etc.)
- [ ] `repo/apps/web-broker/next.config.mjs` configure : i18n routing, images domains (S3 buckets dev + prod), experimental.serverActions
- [ ] `repo/apps/web-broker/tsconfig.json` extends base + paths `@/*` -> `./src/*`
- [ ] `repo/apps/web-broker/tailwind.config.ts` extends `@insurtech/shared-ui/tailwind-preset`
- [ ] `repo/apps/web-broker/src/app/[locale]/layout.tsx` -- root layout avec NextIntlClientProvider + ReactQueryProvider + theme ThemeProvider
- [ ] `repo/apps/web-broker/src/app/[locale]/page.tsx` -- landing placeholder (sera dashboard Sprint 17)
- [ ] `repo/apps/web-broker/src/middleware.ts` -- next-intl middleware (locale detection + redirect)
- [ ] `repo/apps/web-broker/src/messages/{fr,ar-MA,ar}.json` -- traductions placeholder (~30 keys core)
- [ ] `repo/apps/web-broker/src/lib/api-client.ts` -- Axios instance avec interceptors auto (x-tenant-id, x-trace-id, Authorization)
- [ ] `repo/apps/web-broker/src/lib/query-client.ts` -- React Query default config (staleTime 30s, gcTime 5min, retry 3)
- [ ] `repo/apps/web-broker/.env.example` documente : NEXT_PUBLIC_API_URL, NEXT_PUBLIC_SENTRY_DSN, NEXT_PUBLIC_MAPBOX_TOKEN
- [ ] `repo/apps/web-broker/public/favicon.svg` + `public/icons/` (192/512 PWA)
- [ ] `pnpm --filter @insurtech/web-broker dev` demarre sur port 3001
- [ ] Page `/fr` et `/ar` accessibles, theme Skalean visible

**Pattern critique : structure app router localise**

```
repo/apps/web-broker/src/app/
  [locale]/
    layout.tsx              # NextIntlClientProvider + ReactQueryProvider
    page.tsx                # landing placeholder
    error.tsx               # error boundary (Tache 1.4.15)
    not-found.tsx           # 404 (Tache 1.4.15)
  api/
    auth/                   # next-auth routes (Sprint 5)
  globals.css               # Tailwind imports + theme variables
  favicon.ico
```

**Pattern critique : next.config.mjs structure**

```javascript
// repo/apps/web-broker/next.config.mjs
import createNextIntlPlugin from 'next-intl/plugin';
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: { bodySizeLimit: '10mb' },
    optimizePackageImports: ['lucide-react'],
  },
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost', port: '9000' },  // MinIO dev
      { protocol: 'https', hostname: 's3.bgr.atlascloudservices.ma' },     // Atlas Cloud Services Benguerir prod (decision-008)
      { protocol: 'https', hostname: 'api.skalean-insurtech.ma' },
    ],
  },
  async rewrites() {
    return [
      // Proxy API en dev (eviter CORS)
      { source: '/api/v1/:path*', destination: `${process.env.NEXT_PUBLIC_API_URL}/api/v1/:path*` },
    ];
  },
};

export default withNextIntl(nextConfig);
```

**Pattern critique : API client interceptors**

```typescript
// repo/apps/web-broker/src/lib/api-client.ts
import axios from 'axios';
import { getCurrentTenantId, getCurrentTraceId } from '@insurtech/shared-ui/context';

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  timeout: 30_000,
});

apiClient.interceptors.request.use((config) => {
  // Inject headers automatically
  const tenantId = getCurrentTenantId();
  if (tenantId) config.headers['x-tenant-id'] = tenantId;
  config.headers['x-trace-id'] = getCurrentTraceId();
  // Sprint 5: also Authorization Bearer JWT
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Sprint 5: refresh token logic on 401
    return Promise.reject(error);
  }
);
```

**Fichiers crees / modifies** :
```
repo/apps/web-broker/package.json                        # ~50 lignes
repo/apps/web-broker/next.config.mjs                     # ~40 lignes
repo/apps/web-broker/tsconfig.json
repo/apps/web-broker/tailwind.config.ts                  # extends preset
repo/apps/web-broker/src/app/[locale]/layout.tsx         # ~70 lignes
repo/apps/web-broker/src/app/[locale]/page.tsx           # ~30 lignes (placeholder)
repo/apps/web-broker/src/app/globals.css                 # ~15 lignes (@import tailwind)
repo/apps/web-broker/src/middleware.ts                   # ~10 lignes (next-intl)
repo/apps/web-broker/src/i18n/request.ts                 # ~25 lignes (locale loader)
repo/apps/web-broker/src/messages/fr.json                # ~30 keys
repo/apps/web-broker/src/messages/ar-MA.json             # ~30 keys
repo/apps/web-broker/src/messages/ar.json                # ~30 keys
repo/apps/web-broker/src/lib/api-client.ts               # ~60 lignes
repo/apps/web-broker/src/lib/query-client.ts             # ~30 lignes
repo/apps/web-broker/src/components/providers.tsx        # ~50 lignes (orchestre QueryClient + Theme + Locale)
repo/apps/web-broker/.env.example                        # variables NEXT_PUBLIC_*
repo/apps/web-broker/public/favicon.svg
```

**Notes implementation** :
- App Router (pas Pages Router) -- decision v2.0 : RSC + Server Actions
- Locale routing : `/fr/dashboard`, `/ar-MA/dashboard`, `/ar/dashboard`
- next-intl middleware redirect default `/dashboard` -> `/fr/dashboard`
- Tailwind preset partage : evite duplication config 8x
- API client utilise `getCurrentTenantId()` (zustand store partage Tache 1.4.11)
- React Query DevTools en dev only
- Images Mapbox externe : ajouter `api.mapbox.com` dans remotePatterns si tiles directes
- Rewrites API : `/api/v1/*` proxy vers backend NestJS (eviter CORS dev)

**Criteres validation** :
- V1 (P0) : `pnpm --filter @insurtech/web-broker dev` demarre port 3001
- V2 (P0) : `http://localhost:3001/fr` accessible, theme Skalean visible
- V3 (P0) : `http://localhost:3001/ar` retourne page RTL
- V4 (P0) : `http://localhost:3001/` redirect vers `/fr/`
- V5 (P0) : Console : pas d'erreur Next.js 15
- V6 (P0) : Build prod reussit (`pnpm --filter @insurtech/web-broker build`)
- V7 (P0) : API client interceptors injectent x-tenant-id + x-trace-id
- V8 (P1) : Lighthouse home Performance > 80 (baseline, cible Sprint 17 = 90)

---

## Tache 1.4.2 -- web-garage Bootstrap (Port 3002)

**Metadonnees** : Phase 1 / Sprint 4 / P0 / 5h / Depend de 1.4.1

**But** : Initialiser app `web-garage` (utilisee par garage_chef + comptable + commercial garage) sur port 3002. Reutilise patterns Tache 1.4.1.

**Contexte** : Domaine prod `garage.skalean-insurtech.ma`. Utilisateurs : chef d'atelier, comptable, commercial. Workflow : sinistres entrants (Sprint 22), devis-factures (Sprint 23), gestion stock-HR (Sprint 13).

**Livrables checkables** :
- [ ] Meme structure que web-broker (layout, middleware, providers) en differenciant content
- [ ] Theme variant : ajout d'accent visuel garage (icone outil dans logo)
- [ ] Messages : focus vocabulaire garage (sinistre, devis, atelier, technicien)
- [ ] `next.config.mjs` similaire avec port specifique
- [ ] Demarrage `pnpm dev` sur port 3002
- [ ] Pages placeholder operationnelles avec navigation 3 locales

**Differences vs web-broker** :
- Logo + favicon variant (icone garage)
- Messages traductions vocabulaire garage
- Port 3002

**Fichiers crees / modifies** :
```
repo/apps/web-garage/                          # meme structure que web-broker
  package.json + next.config.mjs (port 3002)
  src/app/[locale]/layout.tsx
  src/app/[locale]/page.tsx
  src/lib/api-client.ts
  src/messages/{fr,ar-MA,ar}.json (vocabulaire garage)
```

**Criteres validation** :
- V1 (P0) : Demarre port 3002
- V2 (P0) : 3 locales accessibles
- V3 (P0) : Theme Skalean variant garage applique
- V4 (P0) : Build prod reussit
- V5 (P1) : Vocabulaire garage dans messages (sinistre, devis, atelier)

---

## Tache 1.4.3 -- web-garage-mobile Bootstrap (Port 3003 -- PWA)

**Metadonnees** : Phase 1 / Sprint 4 / P0 / 5h / Depend de 1.4.2

**But** : App **PWA** pour technicien garage en atelier (port 3003) avec service worker, offline support, install prompt, notifications push (Sprint 9 enrichira).

**Contexte** : Domaine prod `garage-app.skalean-insurtech.ma`. Utilisateurs : technicien (mecanicien, tolier, peintre). Cas d'usage : voir liste taches du jour, scanner VIN vehicule, prendre photos sinistre, signer ordre de travail. Mobile-first (telephones bas/moyen de gamme MA).

**Livrables checkables** :
- [ ] Bootstrap similaire web-broker
- [ ] PWA configure via `next-pwa` ou Workbox custom (depend choix Tache 1.4.9)
- [ ] `public/manifest.webmanifest` : name, short_name, theme_color (#E95D2C Skalean Orange), background_color, icons (192, 512), start_url, scope, display: 'standalone', orientation: 'portrait'
- [ ] Service worker configure (precache + runtime cache)
- [ ] Strategie offline : NetworkFirst pour API, CacheFirst pour assets statiques, StaleWhileRevalidate pour images
- [ ] Install prompt customise (hook `useInstallPrompt` depuis `shared-pwa`)
- [ ] Banniere offline detectable (hook `useOnlineStatus`)
- [ ] Viewport mobile-first : `<meta viewport="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover">`
- [ ] Theme color status bar mobile : `<meta name="theme-color" content="#E95D2C">`
- [ ] PWA installable : criteres Lighthouse PWA passent
- [ ] Demarrage port 3003
- [ ] Lighthouse PWA > 90 baseline (cible Sprint 24 : >= 95)

**Pattern critique : manifest.webmanifest**

```json
{
  "name": "Skalean Garage Mobile",
  "short_name": "Skalean Garage",
  "description": "Application mobile pour technicien garage",
  "start_url": "/fr",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait",
  "theme_color": "#E95D2C",
  "background_color": "#1A2730",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-maskable-192.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable" }
  ],
  "categories": ["productivity", "business"],
  "lang": "fr-MA"
}
```

**Fichiers crees / modifies** :
```
repo/apps/web-garage-mobile/                                        # structure complete
  package.json + next.config.mjs (port 3003 + PWA config)
  public/manifest.webmanifest
  public/icons/ (192, 512, maskable)
  public/sw.js (genere par next-pwa ou custom)
  src/app/[locale]/layout.tsx (avec viewport + theme color)
  src/components/PwaInstallBanner.tsx (~60 lignes)
  src/components/OfflineBanner.tsx (~30 lignes)
```

**Notes implementation** :
- next-pwa wraps Next.js avec Workbox -- option simple
- Alternative : `serwist` (Workbox v7 reframed for Next 15) -- plus moderne
- Service worker desactive en dev (active uniquement build prod) sauf override
- Pre-cache : page placeholder + assets critiques
- Runtime cache API : NetworkFirst avec timeout 5s -> fallback cache
- Install prompt : ne s'affiche que si critere PWA passe (Lighthouse audit)

**Criteres validation** :
- V1 (P0) : Demarre port 3003
- V2 (P0) : Manifest valide (chrome://manifest)
- V3 (P0) : Service worker enregistre (DevTools > Application > Service Workers)
- V4 (P0) : Install prompt declenche (chrome devtools "Install" button visible)
- V5 (P0) : Mode offline fonctionnel : page placeholder accessible meme deconnecte
- V6 (P0) : Lighthouse PWA score > 90
- V7 (P0) : Theme color #E95D2C applique status bar mobile
- V8 (P1) : Hook useInstallPrompt + useOnlineStatus utilisables

---

## Tache 1.4.4 -- web-insurtech-admin Bootstrap (Port 3000)

**Metadonnees** : Phase 1 / Sprint 4 / P0 / 5h / Depend de 1.4.3

**But** : App SuperAdmin platform (port 3000) pour Skalean Inc. -- gestion tenants, monitoring, reports cross-tenant.

**Contexte** : Domaine prod `admin.skalean-insurtech.ma`. Utilisateurs : super_admin_platform, analyst_support, reporting_officer (3 roles platform). Cas d'usage : ajouter/suspendre tenants (Sprint 28), monitoring cross-tenant (Sprint 27), reports compliance (Sprint 29). Acces tres restreint (super admin uniquement).

**Livrables checkables** :
- [ ] Bootstrap similaire avec port 3000
- [ ] Theme variant admin : couleur primary plus institutionelle (Navy #1A2730 dominant vs Orange #E95D2C secondaire)
- [ ] Layout differencie : sidebar admin avec sections "Tenants", "Monitoring", "Reports", "Compliance"
- [ ] Auth gate strict (Sprint 5 implementera : verifier role super_admin_platform avant rendre layout)
- [ ] Pages placeholder : `/dashboard` (overview), `/tenants` (Sprint 28), `/reports` (Sprint 29)
- [ ] Locale defaut FR (admin Skalean Maroc -- pas de localisation arabe necessaire mais possible)
- [ ] Build prod reussit
- [ ] Demarrage port 3000

**Fichiers crees / modifies** :
```
repo/apps/web-insurtech-admin/
  package.json + next.config.mjs (port 3000)
  src/app/[locale]/layout.tsx (sidebar admin)
  src/app/[locale]/dashboard/page.tsx
  src/app/[locale]/tenants/page.tsx (placeholder)
  src/app/[locale]/reports/page.tsx (placeholder)
  src/components/AdminSidebar.tsx (~80 lignes)
  src/messages/fr.json (vocabulaire admin)
```

**Notes implementation** :
- Layout admin different : sidebar dense + topbar minimal
- Pas de menu mobile hamburger (admin utilise desktop principalement)
- Theme : usage Navy + Orange en accent uniquement
- Pages stubs avec breadcrumb pour navigation future

**Criteres validation** :
- V1 (P0) : Demarre port 3000
- V2 (P0) : Theme admin variant (Navy dominant) applique
- V3 (P0) : Sidebar admin avec sections placeholder
- V4 (P0) : Build prod reussit
- V5 (P1) : Locale FR par defaut

---

## Tache 1.4.5 -- web-customer-portal Bootstrap (Port 3004 -- NEW v2.0 SSG + ISR + SEO)

**Metadonnees** : Phase 1 / Sprint 4 / P0 / 6h / Depend de 1.4.4

**But** : App publique SEO (port 3004) -- site marketing + comparateur assurance + souscription en ligne. Cible : prospects / assures futurs.

**Contexte** : Domaine prod `assurance.skalean-insurtech.ma`. App **publique** (pas d'auth pour la plupart des pages) avec SEO maximal (SSG pour pages statiques, ISR pour produits assurance qui changent peu). Cas d'usage : page accueil, comparateur 5 assureurs, simulation devis (Sprint 18), creation compte assure, souscription en ligne. **Lighthouse Performance cible >= 95** (Sprint 18 valide).

**Livrables checkables** :
- [ ] Bootstrap avec port 3004
- [ ] Configuration **SSG** : pages statiques `/about`, `/products`, `/contact` build-time
- [ ] Configuration **ISR** : pages produits `/products/[slug]` revalidate every 1 hour (`revalidate: 3600`)
- [ ] **Sitemap.xml** auto-genere via `next-sitemap` ou custom
- [ ] **robots.txt** configure (allow all, except `/admin/*`, `/api/*`)
- [ ] **Open Graph tags** + Twitter Card metadata sur chaque page
- [ ] **JSON-LD** structured data (Organization, Product, FAQPage) -- Sprint 18 enrichira
- [ ] **Hreflang tags** pour multilingue : `<link rel="alternate" hreflang="fr-MA" href="..." />`
- [ ] Pages placeholder publiques :
  - `/[locale]/` (home)
  - `/[locale]/products` (catalog)
  - `/[locale]/about`
  - `/[locale]/contact`
  - `/[locale]/auto` (specifique assurance auto -- Sprint 18 implemente)
  - `/[locale]/habitation`
  - `/[locale]/sante`
- [ ] **No layout sidebar** (different des autres apps) : layout marketing avec header + footer
- [ ] Optimisation : images WebP/AVIF, lazy loading, prefetching links
- [ ] Lighthouse Performance baseline > 80 (cible Sprint 18 >= 95)
- [ ] Demarrage port 3004

**Fichiers crees / modifies** :
```
repo/apps/web-customer-portal/
  package.json + next.config.mjs (port 3004 + ISR config)
  next-sitemap.config.js (sitemap.xml generation)
  public/robots.txt
  src/app/[locale]/layout.tsx (header + footer marketing)
  src/app/[locale]/page.tsx (home placeholder)
  src/app/[locale]/products/page.tsx (catalog placeholder)
  src/app/[locale]/about/page.tsx
  src/app/[locale]/contact/page.tsx
  src/app/[locale]/auto/page.tsx (placeholder Sprint 18)
  src/app/sitemap.ts (Next.js 15 dynamic sitemap)
  src/components/marketing/Header.tsx
  src/components/marketing/Footer.tsx
  src/lib/seo.ts (helpers Open Graph + JSON-LD)
```

**Notes implementation** :
- SSG : `generateStaticParams()` pour `/[locale]/products/[slug]` route
- ISR : `export const revalidate = 3600;` (Next.js 15)
- Open Graph : `metadata.openGraph` configurable per page
- Hreflang : `metadata.alternates.languages` Next.js 15 native
- robots.txt : permettre robots.txt accessible meme en dev
- next-sitemap config : exclude `/admin/*`, generate index.xml + sitemap-pages.xml + sitemap-products.xml
- Performance critique : Sprint 18 ajoutera Critical CSS inlining + font preload

**Criteres validation** :
- V1 (P0) : Demarre port 3004
- V2 (P0) : SSG : `pnpm build` genere pages statiques
- V3 (P0) : ISR configure (`revalidate: 3600`)
- V4 (P0) : sitemap.xml accessible `/sitemap.xml`
- V5 (P0) : robots.txt accessible
- V6 (P0) : Open Graph tags presents (test : meta scraper)
- V7 (P0) : Hreflang tags sur pages localisees
- V8 (P0) : Lighthouse Performance > 80 baseline
- V9 (P1) : SEO score Lighthouse > 90
- V10 (P1) : Accessibility score > 90

---

## Tache 1.4.6 -- web-assure-portal Bootstrap (Port 3005 -- NEW v2.0)

**Metadonnees** : Phase 1 / Sprint 4 / P0 / 5h / Depend de 1.4.5

**But** : Self-service portail assure (port 3005) -- voir polices, declarer sinistre, paiement, profil.

**Contexte** : Domaine prod `mon-espace.skalean-insurtech.ma`. Utilisateurs : assure_user (L3 multi-tenant). Cas d'usage : login + voir mes polices, voir historique sinistres, declarer un sinistre (workflow Sprint 19), payer prime, modifier profil. Acces L3 (filtrage par assure_user_id sur RLS).

**Livrables checkables** :
- [ ] Bootstrap avec port 3005
- [ ] Theme variant assure : palette plus douce (Sky Blue #B0CEE2 dominant pour reassurer assure)
- [ ] Layout self-service : topbar simple + content centre (pas de sidebar dense)
- [ ] Pages placeholder :
  - `/[locale]/` (dashboard mes polices)
  - `/[locale]/polices` (liste)
  - `/[locale]/polices/[id]` (detail)
  - `/[locale]/sinistres` (mes sinistres)
  - `/[locale]/profil` (info perso)
  - `/[locale]/paiements` (historique)
- [ ] Auth gate (Sprint 5 implementera : redirect si pas auth, check role assure_user)
- [ ] Build prod reussit
- [ ] Demarrage port 3005

**Notes implementation** :
- UX simplifiee (vs web-broker dense) : assure non-tech, gros boutons, langage clair
- Mobile responsive : assure peut consulter desktop + mobile (vs web-assure-mobile pour declaration sinistre dediee)
- Pas de PWA (web-assure-mobile est dedie sinistre mobile)

**Criteres validation** :
- V1 (P0) : Demarre port 3005
- V2 (P0) : Theme variant assure (Sky Blue dominant)
- V3 (P0) : Pages placeholder accessibles
- V4 (P0) : Layout self-service (pas de sidebar dense)
- V5 (P0) : Build prod reussit

---

## Tache 1.4.7 -- web-assure-mobile Bootstrap (Port 3006 -- NEW v2.0 PWA)

**Metadonnees** : Phase 1 / Sprint 4 / P0 / 5h / Depend de 1.4.6

**But** : App PWA mobile dediee assure pour **declarer un sinistre depuis le smartphone** (port 3006). Workflow optimise mobile-first : photos, geolocation, signature.

**Contexte** : Domaine prod `mon-espace-mobile.skalean-insurtech.ma`. Utilisateurs : assure_user. Cas d'usage critique Sprint 25 : assure declare un sinistre via 6 etapes (info, photos, lieu, blesses, temoins, signature). PWA car experience native-like sur mobile (camera, GPS, install home screen).

**Livrables checkables** :
- [ ] Bootstrap PWA similaire web-garage-mobile (Tache 1.4.3) avec port 3006
- [ ] Manifest.webmanifest avec theme assure (Sky Blue + Orange accent)
- [ ] Service worker offline : declaration sinistre offline-first (Sprint 25 implementera Pouchdb sync)
- [ ] Permissions navigator : Camera (photos), Geolocation (lieu accident)
- [ ] Pages placeholder :
  - `/[locale]/` (dashboard mobile)
  - `/[locale]/declarer-sinistre` (placeholder workflow Sprint 25)
  - `/[locale]/mes-sinistres`
  - `/[locale]/profil`
- [ ] Theme color #2D5773 (ACAPS Teal) status bar (rappelle conformite)
- [ ] Lighthouse PWA > 90 baseline
- [ ] Demarrage port 3006

**Fichiers crees / modifies** :
```
repo/apps/web-assure-mobile/
  package.json + next.config.mjs (port 3006 + PWA config)
  public/manifest.webmanifest (theme assure)
  public/icons/ (192, 512, maskable)
  src/app/[locale]/layout.tsx (mobile-first layout)
  src/app/[locale]/declarer-sinistre/page.tsx (placeholder Sprint 25)
  src/components/PwaInstallBanner.tsx (reuse shared-pwa)
```

**Notes implementation** :
- Permissions Camera + Geolocation declarees mais demandees on-demand (UX)
- Service worker pre-cache UI declaration sinistre (workflow critique offline)
- Layout mobile-first : header minimal + bottom navigation tabs
- Sprint 25 implementera offline-first avec PouchDB pour synchronization

**Criteres validation** :
- V1 (P0) : Demarre port 3006
- V2 (P0) : Manifest valide
- V3 (P0) : Service worker enregistre
- V4 (P0) : Lighthouse PWA > 90
- V5 (P0) : Theme color ACAPS Teal status bar
- V6 (P1) : Page declarer-sinistre placeholder accessible

---

## Tache 1.4.8 -- Package shared-ui : Theme + 30+ Composants shadcn

**Metadonnees** : Phase 1 / Sprint 4 / P0 / 8h / Depend de 1.4.7

**But** : Package `@insurtech/shared-ui` exposant theme Skalean Sofidemy + 30+ composants shadcn/ui personnalises + Tailwind preset partage.

**Contexte** : Centraliser composants UI evite duplication 8x (1 par app). Theme Skalean documenter palette Sofidemy (Orange #E95D2C, Navy #1A2730, Sky Blue #B0CEE2, ACAPS Teal #2D5773) + Montserrat font + spacing system.

**Livrables checkables** :
- [ ] Package `repo/packages/shared-ui/` setup
- [ ] `tailwind-preset.ts` exporte preset Tailwind avec theme Skalean (extends config Tailwind 4)
- [ ] Variables CSS theme : `--color-primary` (Orange), `--color-secondary` (Navy), `--color-accent` (Sky Blue), `--color-acaps` (Teal), font-family Montserrat
- [ ] Mode dark configure (CSS variables `:root[data-theme="dark"]`)
- [ ] Mode RTL : utilities Tailwind `rtl:*` configurees
- [ ] **30+ composants shadcn/ui customises** :
  - Layout : Card, Container, Stack, Grid (4)
  - Form : Input, Textarea, Select, Combobox, DatePicker, Checkbox, RadioGroup, Switch, Slider (9)
  - Action : Button, IconButton, ButtonGroup, DropdownMenu (4)
  - Feedback : Alert, Toast (Sonner integration), Dialog, AlertDialog, Drawer, Skeleton, Spinner, Progress (8)
  - Navigation : Tabs, Breadcrumb, Pagination, Sidebar, NavLink (5)
  - Data Display : Table, DataTable, Badge, Avatar, Tooltip, Popover (6)
- [ ] Component `<ThemeProvider>` qui inject CSS variables + detect locale (RTL si ar)
- [ ] Component `<LocaleSwitcher>` change locale
- [ ] Hook `useTheme()` retourne dark/light + setter
- [ ] Hook `useDirection()` retourne ltr/rtl base sur locale
- [ ] Storybook setup pour preview composants (P1, Tache 1.4.16)
- [ ] Documentation : `repo/packages/shared-ui/README.md` decrit usage + theme tokens
- [ ] Tests visuels : screenshot tests basiques

**Pattern critique : theme Skalean Sofidemy CSS variables**

```css
/* repo/packages/shared-ui/src/styles/theme.css */
:root {
  /* Sofidemy palette */
  --color-primary: 233 93 44;          /* #E95D2C Orange Skalean */
  --color-primary-foreground: 255 255 255;
  --color-secondary: 26 39 48;          /* #1A2730 Navy Dark */
  --color-secondary-foreground: 255 255 255;
  --color-accent: 176 206 226;          /* #B0CEE2 Sky Blue */
  --color-accent-foreground: 26 39 48;
  --color-acaps: 45 87 115;             /* #2D5773 ACAPS Teal */
  --color-acaps-foreground: 255 255 255;

  /* Status colors */
  --color-success: 34 197 94;
  --color-warning: 234 179 8;
  --color-error: 239 68 68;
  --color-info: 59 130 246;

  /* Surfaces */
  --color-background: 255 255 255;
  --color-foreground: 17 24 39;
  --color-muted: 243 244 246;

  /* Typography */
  --font-sans: 'Montserrat', 'Noto Sans Arabic', sans-serif;
  --font-mono: 'Geist Mono', monospace;

  /* Radius */
  --radius: 0.5rem;
}

:root[data-theme="dark"] {
  --color-background: 17 24 39;
  --color-foreground: 243 244 246;
  /* ... overrides */
}
```

Tailwind preset utilise ces variables via `bg-primary`, `text-foreground`, etc.

**Fichiers crees / modifies** :
```
repo/packages/shared-ui/
  package.json + tsconfig.json
  src/index.ts (re-exports)
  src/styles/theme.css (CSS variables)
  src/styles/fonts.css (Montserrat + Noto Naskh Arabic)
  tailwind-preset.ts (~150 lignes)
  src/components/{30+ components}.tsx
  src/components/ThemeProvider.tsx
  src/components/LocaleSwitcher.tsx
  src/hooks/useTheme.ts
  src/hooks/useDirection.ts
  src/lib/cn.ts (clsx + tailwind-merge helper)
  src/lib/context.ts (Zustand store global pour tenant_id, trace_id)
  README.md
```

**Notes implementation** :
- shadcn/ui pas un package npm mais code copy-paste -- on customise + maintient nous-memes
- CSS variables RGB (vs hex) pour permettre opacity Tailwind (`bg-primary/50`)
- Mode dark : CSS variables override sur `[data-theme="dark"]`
- Mode RTL : Tailwind 4 utilities `rtl:flex-row-reverse` etc.
- ThemeProvider lit `next-themes` (lib) pour persistance preference
- Zustand store global : tenant_id (set apres login Sprint 5), trace_id (set par middleware)

**Criteres validation** :
- V1 (P0) : Package build reussit
- V2 (P0) : Tailwind preset utilisable depuis 8 apps
- V3 (P0) : Theme CSS variables Skalean appliquees
- V4 (P0) : 30+ composants shadcn presents et fonctionnels
- V5 (P0) : Mode dark fonctionnel
- V6 (P0) : Mode RTL fonctionnel pour ar
- V7 (P0) : ThemeProvider + LocaleSwitcher operationnels
- V8 (P1) : Storybook setup (Tache 1.4.16)
- V9 (P1) : Documentation README complete

---

## Tache 1.4.9 -- Package shared-pwa : Hooks PWA Install/Offline/SW (NEW v2.0)

**Metadonnees** : Phase 1 / Sprint 4 / P0 / 6h / Depend de 1.4.8

**But** : Package `@insurtech/shared-pwa` exposant hooks reutilisables pour les 2 apps PWA (web-garage-mobile + web-assure-mobile).

**Livrables checkables** :
- [ ] Package `repo/packages/shared-pwa/` setup
- [ ] Hook `useInstallPrompt()` -- expose `{ canInstall, prompt, dismiss }` capture event `beforeinstallprompt`
- [ ] Hook `useOnlineStatus()` -- retourne `{ isOnline }` ecoute `online`/`offline` events
- [ ] Hook `useServiceWorker()` -- expose `{ registration, update, status }` (idle/installing/installed/activating/active)
- [ ] Hook `usePushSubscription()` -- gere abonnement push notification (Sprint 9 enrichira)
- [ ] Helper `registerServiceWorker(swPath)` -- enregistre SW + ecoute updates
- [ ] Component `<PwaInstallBanner>` reutilisable
- [ ] Component `<OfflineBanner>` qui affiche "Mode hors ligne" si offline
- [ ] Component `<UpdateAvailableBanner>` qui propose recharger si nouvelle version SW disponible
- [ ] Service worker template `sw-template.js` -- precache + runtime cache strategies
- [ ] Strategie offline configurable :
  - NetworkFirst pour API calls (`/api/*`)
  - CacheFirst pour static assets (images, fonts)
  - StaleWhileRevalidate pour pages
- [ ] Documentation : `README.md` integration dans next.config.mjs
- [ ] Tests : hooks tested via @testing-library/react

**Fichiers crees / modifies** :
```
repo/packages/shared-pwa/
  package.json + tsconfig.json
  src/index.ts
  src/hooks/useInstallPrompt.ts (~60 lignes)
  src/hooks/useOnlineStatus.ts (~30 lignes)
  src/hooks/useServiceWorker.ts (~80 lignes)
  src/hooks/usePushSubscription.ts (~50 lignes)
  src/lib/register-sw.ts
  src/components/PwaInstallBanner.tsx (~70 lignes)
  src/components/OfflineBanner.tsx (~30 lignes)
  src/components/UpdateAvailableBanner.tsx (~40 lignes)
  src/sw-template.js (template service worker)
  README.md
```

**Notes implementation** :
- `beforeinstallprompt` capture : evenement deferred -- conserve pour replay manuel
- iOS Safari ne supporte pas `beforeinstallprompt` (instructions specifiques pour Add to Home Screen)
- Service worker template : utilise Workbox (via next-pwa) ou custom selon Tache 1.4.3 choix
- Push notification : preparation Sprint 9 (envoi notification cross-app)
- Update banner : ecoute `controllerchange` event SW pour detecter nouvelle version

**Criteres validation** :
- V1 (P0) : Package build reussit
- V2 (P0) : `useInstallPrompt()` utilisable, retourne `canInstall: true` apres event capture
- V3 (P0) : `useOnlineStatus()` retourne online/offline correct
- V4 (P0) : `useServiceWorker()` expose registration
- V5 (P0) : `<PwaInstallBanner>` rendable
- V6 (P0) : Strategies offline documentees
- V7 (P1) : Tests hooks passent
- V8 (P1) : iOS Safari fallback documente

---

## Tache 1.4.10 -- Package shared-maps : Wrapper Mapbox GL JS (NEW v2.0)

**Metadonnees** : Phase 1 / Sprint 4 / P0 / 5h / Depend de 1.4.9

**But** : Package `@insurtech/shared-maps` wrapping Mapbox GL JS pour cartes interactives (geolocation sinistres Sprint 25, recherche garages Sprint 8 booking, etc.).

**Contexte** : Mapbox vs Google Maps : meilleur prix MA (Google geocoding tres cher), meilleur support styles custom. Token public dev / prod via env `NEXT_PUBLIC_MAPBOX_TOKEN`.

**Livrables checkables** :
- [ ] Package `repo/packages/shared-maps/` setup
- [ ] Component `<Map>` React wrapper Mapbox GL JS
- [ ] Component `<Marker>` -- marker simple
- [ ] Component `<MarkerCluster>` -- clustering pour grandes listes
- [ ] Component `<UserLocationMarker>` -- position user via Geolocation API
- [ ] Component `<SearchBox>` -- autocomplete adresse via Mapbox Geocoding API
- [ ] Hook `useGeolocation()` -- expose position + watch
- [ ] Hook `useReverseGeocoding(lat, lng)` -- adresse depuis coords
- [ ] Hook `useDirections(from, to)` -- itineraire via Mapbox Directions API
- [ ] Style custom Skalean : monochrome avec accents Orange + Sky Blue
- [ ] Support locale : labels carte en FR/AR selon locale
- [ ] RTL support (interface pas la carte elle-meme)
- [ ] Documentation : usage + token configuration
- [ ] Tests : composants rendable, hooks testes

**Pattern critique : Map component**

```typescript
// repo/packages/shared-maps/src/components/Map.tsx
'use client';
import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';

interface MapProps {
  center?: [number, number];
  zoom?: number;
  style?: string;
  children?: React.ReactNode;
  onLoad?: (map: mapboxgl.Map) => void;
}

export function Map({ center = [-7.5898, 33.5731], zoom = 11, ...props }: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: props.style ?? 'mapbox://styles/skalean/...',  // Sprint 8 implementera style custom
      center, zoom,
    });
    map.on('load', () => props.onLoad?.(map));
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  return <div ref={containerRef} className="w-full h-full" />;
}
```

Default center : Casablanca (-7.5898, 33.5731). Default zoom : 11 (vue ville).

**Fichiers crees / modifies** :
```
repo/packages/shared-maps/
  package.json + tsconfig.json
  src/index.ts
  src/components/Map.tsx (~80 lignes)
  src/components/Marker.tsx (~40 lignes)
  src/components/MarkerCluster.tsx (~70 lignes)
  src/components/UserLocationMarker.tsx (~40 lignes)
  src/components/SearchBox.tsx (~60 lignes)
  src/hooks/useGeolocation.ts (~50 lignes)
  src/hooks/useReverseGeocoding.ts (~30 lignes)
  src/hooks/useDirections.ts (~50 lignes)
  src/styles/skalean-style.json (style Mapbox custom -- generation Mapbox Studio)
  README.md
```

**Notes implementation** :
- 'use client' obligatoire (Mapbox GL JS browser-only)
- Token public Mapbox : OK exposer NEXT_PUBLIC_* (vs token secret backend pour servers tiles si custom)
- Style custom : `mapbox://styles/skalean/<id>` cree manuellement dans Mapbox Studio (Sprint 8 finalise)
- Default center Casablanca : capitale economique MA
- Marker cluster : utilise `mapbox-gl-supercluster` pour > 50 markers
- Geocoding API : 100k requests/mois gratuit (suffisant Phase 1)

**Criteres validation** :
- V1 (P0) : Package build reussit
- V2 (P0) : `<Map>` rendable avec center default Casablanca
- V3 (P0) : `<Marker>` ajoute marker
- V4 (P0) : `useGeolocation()` retourne position
- V5 (P0) : `useReverseGeocoding()` retourne adresse
- V6 (P0) : `<SearchBox>` autocomplete fonctionnel
- V7 (P1) : Style custom Skalean applique
- V8 (P1) : Marker cluster rend si > 50 markers

---

## Tache 1.4.11 -- Multilingue next-intl 8 Apps + RTL

**Metadonnees** : Phase 1 / Sprint 4 / P0 / 6h / Depend de 1.4.10

**But** : Configuration multilingue uniforme pour les 8 apps : 3 locales (`fr`, `ar-MA`, `ar`) avec routing, detection, RTL pour `ar`.

**Contexte** : Marche MA multilingue : francais (administration, banques, classes superieures), darija (langue parlee quotidienne), arabe classique (officialite, religious). Routing locale-prefixed (vs domain-based) pour simplicite.

**Livrables checkables** :
- [ ] next-intl config commun dans `@insurtech/shared-ui` ou dossier `repo/i18n/` partage
- [ ] 3 locales : `fr` (default), `ar-MA` (Darija), `ar` (Arabe classique)
- [ ] Routing locale-prefixed : `/fr/dashboard`, `/ar-MA/dashboard`, `/ar/dashboard`
- [ ] Middleware next-intl detecte locale depuis : URL > cookie > Accept-Language header > default `fr`
- [ ] Direction auto : `dir="rtl"` sur `<html>` si locale `ar` ou `ar-MA`
- [ ] Tailwind RTL utilities actives (`rtl:flex-row-reverse`, etc.)
- [ ] Fonts : Montserrat pour `fr`, Noto Naskh Arabic pour `ar` + `ar-MA`
- [ ] Date/number formatting : utilise `Intl` API native (date-fns/format pour cas avances Sprint 8)
- [ ] Locale switcher component (deja shared-ui Tache 1.4.8) integre dans layouts
- [ ] Messages catalog skeleton par app : `repo/apps/{app}/src/messages/{fr,ar-MA,ar}.json` (~30-50 keys core par app)
- [ ] Pluralization rules pour ar (regle 6 categories : zero/one/two/few/many/other)
- [ ] Documentation : `repo/docs/architecture/i18n-strategy.md`

**Fichiers crees / modifies** :
```
repo/packages/shared-ui/src/i18n/                     # config partage
  routing.ts (locales, defaultLocale, pathnames)
  request.ts (loadMessages depuis dossier app courant)
repo/apps/{8 apps}/src/middleware.ts                  # next-intl middleware
repo/apps/{8 apps}/src/i18n/request.ts                # config app-specific
repo/apps/{8 apps}/src/messages/{fr,ar-MA,ar}.json    # 3 fichiers per app
repo/docs/architecture/i18n-strategy.md
```

**Notes implementation** :
- `ar-MA` (Darija) : technique = arabe ecrit avec quelques mots francais melanges, pas formel
- `ar` (Classique) : arabe formel administratif/juridique
- Mauvaise pratique : utiliser `ar` pour tout -- les utilisateurs MA preferent FR ou Darija (jamais arabe classique sauf documents officiels)
- next-intl preferable a react-i18next (App Router native + RSC support)
- Type-safety : `next-intl` genere types depuis JSON catalog (autocomplete + verif compile)
- Pluralization arabe : 6 forms vs 2 en francais -- traducteur natif requis
- Performance : messages catalogues lazy-loaded per page (next-intl handles)

**Criteres validation** :
- V1 (P0) : 3 locales accessibles sur les 8 apps : `/fr`, `/ar-MA`, `/ar`
- V2 (P0) : `dir="rtl"` automatique sur `<html>` si ar
- V3 (P0) : Middleware redirect `/dashboard` -> `/fr/dashboard`
- V4 (P0) : Cookie locale persiste preference
- V5 (P0) : Accept-Language header respecte si pas de cookie
- V6 (P0) : Tailwind RTL utilities actives
- V7 (P0) : Fonts arabes chargees correctement (Noto Naskh Arabic)
- V8 (P0) : Messages chargees pour la locale (test : changer locale -> texte change)
- V9 (P1) : Date format respecte locale (10/01/2026 fr vs 2026/01/10 ar)
- V10 (P1) : Pluralization arabe geree (test : 0, 1, 2, 3, 11, 100 messages)

---

## Tache 1.4.12 -- Tooling Monorepo Frontend (Turbo + Scripts Dev Parallel)

**Metadonnees** : Phase 1 / Sprint 4 / P0 / 4h / Depend de 1.4.11

**But** : Optimiser la DX monorepo frontend : scripts orchestres pour demarrer 1 ou plusieurs apps, Turborepo cache build, format lint unifie.

**Livrables checkables** :
- [ ] Scripts root `package.json` :
  - `pnpm dev:web-broker` -- 1 app
  - `pnpm dev:all` -- toutes les 8 apps en parallel (utilise tmux ou concurrently)
  - `pnpm dev:portals` -- customer-portal + assure-portal + assure-mobile (workflow assure)
  - `pnpm build:apps` -- build toutes les apps
  - `pnpm typecheck:apps` -- typecheck monorepo
- [ ] `turbo.json` enrichi : pipeline `dev` cache:false, `build` cache:true, depend de `^build`
- [ ] Variables env partage : fichier `.env.local` racine charge par toutes les apps
- [ ] Hot reload cross-package : modification dans `shared-ui` declenche reload des apps
- [ ] Build prod monorepo : `pnpm build:apps` sequentiel ou parallel selon Turbo config
- [ ] Doctor script : `pnpm doctor` verifie node version, pnpm version, docker up, env vars valides
- [ ] Documentation : `repo/docs/developer-guide.md` decrit workflows dev usuels

**Fichiers crees / modifies** :
```
repo/package.json                              # update : scripts dev:* + build:* + doctor
repo/turbo.json                                # update : pipeline frontend
repo/scripts/dev-portals.sh                    # demarre 3 apps assure
repo/scripts/dev-all.sh                        # demarre 8 apps (warning RAM)
repo/scripts/doctor.ts                         # verification env developement
repo/docs/developer-guide.md
```

**Notes implementation** :
- 8 apps simultanees : ~3-5 GB RAM -- pas pour machine basse (advised dev:portals workflow par feature)
- Turbo cache : seulement build prod (dev cache:false sinon hot reload casse)
- Hot reload cross-package : nécessite `tsc --watch` ou compilation a-la-volee dans shared-ui
- `pnpm doctor` : check Node 22.11+, pnpm 9.15+, Docker up, .env present, ports libres

**Criteres validation** :
- V1 (P0) : `pnpm dev:web-broker` demarre 1 app
- V2 (P0) : `pnpm dev:portals` demarre 3 apps
- V3 (P0) : Modification dans shared-ui hot-reload les 8 apps
- V4 (P0) : `pnpm build:apps` reussit
- V5 (P0) : `pnpm doctor` verifie environnement
- V6 (P1) : `pnpm dev:all` fonctionne sur machine 16+ GB RAM

---

## Tache 1.4.13 -- Generation Client API TypeScript depuis OpenAPI

**Metadonnees** : Phase 1 / Sprint 4 / P0 / 4h / Depend de 1.4.12

**But** : Generer automatiquement un client TypeScript typed depuis le Swagger OpenAPI de l'API NestJS (Sprint 3) pour eviter drift types frontend/backend.

**Livrables checkables** :
- [ ] Setup `openapi-typescript` + `openapi-fetch` dans monorepo
- [ ] Script `pnpm generate:api-client` qui :
  - fetch `http://localhost:4000/docs-json` (Swagger JSON)
  - genere types TypeScript dans `repo/packages/api-client/src/types.gen.ts`
  - genere client typed dans `repo/packages/api-client/src/client.ts`
- [ ] Package `@insurtech/api-client` exposant client + types
- [ ] Hook React Query helpers : `useApiQuery()`, `useApiMutation()` typed
- [ ] Integration dans 8 apps : remplace direct axios calls par client typed
- [ ] Validation runtime via Zod schema (auto-derive depuis OpenAPI ou manual Sprint 5+)
- [ ] CI : `generate:api-client` execute automatiquement sur changement Swagger (post-merge)
- [ ] Versionnage : artifacts generated commited dans repo (vs build-time generation) pour DX dev sans backend up
- [ ] Documentation : utilisation client + workflow regeneration

**Fichiers crees / modifies** :
```
repo/packages/api-client/
  package.json + tsconfig.json
  src/types.gen.ts (genere -- ~10000 lignes apres Sprint 5+)
  src/client.ts (~50 lignes)
  src/hooks/useApiQuery.ts (~40 lignes)
  src/hooks/useApiMutation.ts (~40 lignes)
  src/index.ts
  README.md
repo/scripts/generate-api-client.ts (~80 lignes)
repo/package.json (add script generate:api-client)
```

**Notes implementation** :
- openapi-typescript : tool maintenu, output stable
- openapi-fetch : alternative legere a axios (fetch-based, type-safe)
- Generation runtime vs build : on commite genere -- DX prime sans backend up
- Workflow : modifie API NestJS -> rebuild Swagger -> regenere client -> commit
- Sprint 5+ ajoutera schemas Zod runtime validation aussi (Pour validation cote frontend)

**Criteres validation** :
- V1 (P0) : `pnpm generate:api-client` reussit
- V2 (P0) : Types generes : test TypeScript autocomplete sur endpoint `/api/v1/auth/login`
- V3 (P0) : Hook `useApiQuery` typed retourne data correctement
- V4 (P0) : Erreur compilation si endpoint inexistant
- V5 (P0) : Documentation workflow regeneration claire
- V6 (P1) : Tests integration : appel API reel via client genere

---

## Tache 1.4.14 -- Layouts Partages (Sidebar + Topbar) Par Type App

**Metadonnees** : Phase 1 / Sprint 4 / P0 / 6h / Depend de 1.4.13

**But** : Layouts partages dans `shared-ui` adaptes par type d'app : dashboard (broker, garage, admin), self-service (assure-portal), mobile (garage-mobile, assure-mobile), public (customer-portal).

**Livrables checkables** :
- [ ] `<DashboardLayout>` avec Sidebar (collapsible) + Topbar + content area + Footer
  - Sidebar : navigation principale + role-based items (filtree par permissions Sprint 7)
  - Topbar : breadcrumb + LocaleSwitcher + UserMenu + NotificationBell + ThemeToggle
- [ ] `<SelfServiceLayout>` topbar simple + content centre + footer minimal (sans sidebar)
- [ ] `<MobileLayout>` topbar minimal + bottom navigation tabs (4 tabs typique) + content + safe area iOS
- [ ] `<PublicLayout>` header marketing + content + footer marketing complet
- [ ] Components reutilisables :
  - `<Sidebar>` avec items groupes (sections)
  - `<Topbar>` configurable (titre + actions)
  - `<BottomTabs>` mobile (4-5 tabs)
  - `<UserMenu>` (avatar + dropdown logout)
  - `<NotificationBell>` (placeholder Sprint 9)
  - `<Breadcrumb>` (auto depuis pathname)
- [ ] Responsive : tous layouts mobile-first, breakpoints tailwind (sm 640, md 768, lg 1024, xl 1280)
- [ ] Sidebar drawer mobile (caches par defaut < md, hamburger icon pour ouvrir)
- [ ] Hook `useSidebarOpen()` partage state sidebar collapsed/open
- [ ] Documentation : `repo/packages/shared-ui/README.md` decrit chaque layout + props

**Fichiers crees / modifies** :
```
repo/packages/shared-ui/src/layouts/
  DashboardLayout.tsx (~120 lignes)
  SelfServiceLayout.tsx (~80 lignes)
  MobileLayout.tsx (~100 lignes)
  PublicLayout.tsx (~80 lignes)
repo/packages/shared-ui/src/components/
  Sidebar.tsx (~150 lignes)
  Topbar.tsx (~100 lignes)
  BottomTabs.tsx (~80 lignes)
  UserMenu.tsx (~60 lignes)
  Breadcrumb.tsx (~50 lignes)
repo/packages/shared-ui/src/hooks/
  useSidebarOpen.ts (~25 lignes - zustand store)
```

**Notes implementation** :
- Layouts NextJS : utilise `app/[locale]/layout.tsx` route segment
- Sidebar items configurables via prop `<Sidebar items={...}>` (chaque app definit sa nav)
- BottomTabs typically 4-5 tabs max (UX mobile)
- Safe area iOS : `padding-top: env(safe-area-inset-top)` pour notch
- LocaleSwitcher integration : update URL + cookie + reload locale messages
- ThemeToggle : utilise `next-themes` lib (dark/light/system)

**Criteres validation** :
- V1 (P0) : `<DashboardLayout>` rendable avec sidebar + topbar
- V2 (P0) : `<SelfServiceLayout>` rendable
- V3 (P0) : `<MobileLayout>` rendable avec BottomTabs
- V4 (P0) : `<PublicLayout>` rendable
- V5 (P0) : Sidebar responsive (drawer mobile, collapse desktop)
- V6 (P0) : Bottom tabs visible uniquement < md
- V7 (P0) : Hook useSidebarOpen partage state
- V8 (P1) : Layouts utilises dans 8 apps stubs
- V9 (P1) : Safe area iOS appliquee MobileLayout

---

## Tache 1.4.15 -- Pages Placeholder + 404/500

**Metadonnees** : Phase 1 / Sprint 4 / P0 / 4h / Depend de 1.4.14

**But** : Pages placeholder coherent dans 8 apps + pages erreur globales (404, 500) avec branding Skalean.

**Livrables checkables** :
- [ ] Page 404 : `repo/apps/{8 apps}/src/app/[locale]/not-found.tsx` -- branding Skalean + bouton "retour accueil"
- [ ] Page 500 : `repo/apps/{8 apps}/src/app/[locale]/error.tsx` -- error boundary App Router + display traceId pour support
- [ ] Page Loading : `repo/apps/{8 apps}/src/app/[locale]/loading.tsx` -- skeleton ou spinner Skalean
- [ ] Pages placeholder accessibles dans navigation sidebar avec marker "Sprint X" indiquant ou implementer
- [ ] Component `<UnderConstruction sprintNumber={X}>` reutilisable
- [ ] Pages 404 + 500 utilisent layout (PublicLayout pour customer-portal, autres avec layout default)
- [ ] Texte erreur localise (3 locales)
- [ ] Sentry capture sur 500 (Sprint 12 backend, Sprint 4 frontend ajoute Sentry SDK browser)
- [ ] Tests : trigger 404 + 500 + verifier rendering

**Fichiers crees / modifies** :
```
repo/apps/{8 apps}/src/app/[locale]/not-found.tsx       # ~40 lignes
repo/apps/{8 apps}/src/app/[locale]/error.tsx           # ~60 lignes
repo/apps/{8 apps}/src/app/[locale]/loading.tsx         # ~20 lignes
repo/packages/shared-ui/src/components/UnderConstruction.tsx (~30 lignes)
```

**Notes implementation** :
- Next.js 15 : `error.tsx` doit etre `'use client'` + recevoir `error: Error & { digest?: string }`
- Display traceId user-facing pour reporting bug (`x-trace-id` recupere via context)
- 404 reutilisable (1 file partage via shared-ui ?) : non, chaque app peut customiser branding
- Sentry browser SDK : init dans layout client component

**Criteres validation** :
- V1 (P0) : 404 page rendable + branded
- V2 (P0) : 500 page error boundary fonctionnel (test : throw Error)
- V3 (P0) : Loading page rendable
- V4 (P0) : Texte localise 3 locales
- V5 (P0) : traceId visible sur page 500
- V6 (P1) : Sentry capture 500 frontend

---

## Tache 1.4.16 -- Tests E2E + Lighthouse Baseline + Storybook (P1)

**Metadonnees** : Phase 1 / Sprint 4 / P0/P1 / 7h / Depend de 1.4.15

**But** : Suite tests E2E Playwright validant les 8 apps demarrent + Lighthouse baseline + Storybook setup pour shared-ui.

**Livrables checkables** :

**Tests E2E (P0)** :
- [ ] `repo/e2e/web/{8 apps}.spec.ts` -- 1 spec par app
- [ ] Pour chaque app : test home page rendable, locale switcher fonctionne (fr/ar), 404 trigger fonctionne, theme dark/light toggle (si applicable)
- [ ] Test mobile-safari (iPhone 14) sur 2 PWA apps : install banner visible, offline mode OK
- [ ] Test chromium sur 6 desktop apps : layout responsive verifie 320px / 768px / 1280px
- [ ] Tous tests passent en CI

**Lighthouse baseline (P0)** :
- [ ] `repo/scripts/lighthouse-baseline.ts` execute Lighthouse sur les 8 apps (audit chacune)
- [ ] Output : `repo/lighthouse-reports/baseline-{app}.json`
- [ ] Cibles initiales (Sprint 4 = baseline, ajustement Sprint suivants) :
  - Performance >= 70 (cible Sprint 17 broker = 90, Sprint 18 customer-portal = 95)
  - Accessibility >= 90
  - Best Practices >= 90
  - SEO >= 90 (cible Sprint 18 customer-portal = 100)
  - PWA >= 90 (apps mobile uniquement)
- [ ] Documentation : `repo/docs/architecture/lighthouse-strategy.md` decrit cibles + workflow

**Storybook (P1)** :
- [ ] `repo/packages/shared-ui/.storybook/` setup Storybook 8.4
- [ ] Stories pour 30+ composants shadcn (Button, Input, Card, Dialog, etc.)
- [ ] Theme switcher (light/dark) + Locale switcher (fr/ar) dans toolbar Storybook
- [ ] Deploy local : `pnpm --filter @insurtech/shared-ui storybook` accessible :6006
- [ ] Documentation usage par developpeurs

**Fichiers crees / modifies** :
```
repo/e2e/web/web-broker.spec.ts                          # ~50 lignes
repo/e2e/web/web-garage.spec.ts                          # ~50 lignes
... (8 specs apps)
repo/e2e/mobile/web-garage-mobile.spec.ts                # ~60 lignes
repo/e2e/mobile/web-assure-mobile.spec.ts                # ~60 lignes
repo/scripts/lighthouse-baseline.ts                       # ~100 lignes
repo/lighthouse-reports/                                  # output (gitignore)
repo/docs/architecture/lighthouse-strategy.md
repo/packages/shared-ui/.storybook/main.ts
repo/packages/shared-ui/.storybook/preview.tsx
repo/packages/shared-ui/src/components/{30+}.stories.tsx  # une story par composant
```

**Notes implementation** :
- Tests E2E utilisent project Playwright `chromium` (desktop) ou `mobile-safari` (PWA mobile)
- Lighthouse via `lighthouse-ci` ou Chrome DevTools API
- Storybook 8 + Vite (vs Webpack legacy) plus rapide
- Stories : utilise CSF v3 (Component Story Format)

**Criteres validation** :
- V1 (P0) : 8 specs E2E desktop passent
- V2 (P0) : 2 specs E2E mobile passent
- V3 (P0) : Lighthouse baseline genere pour 8 apps
- V4 (P0) : Performance >= 70 partout
- V5 (P0) : Accessibility >= 90 partout
- V6 (P0) : PWA score >= 90 sur 2 apps mobile
- V7 (P1) : Storybook setup + 30+ stories presents
- V8 (P1) : Storybook accessible :6006
- V9 (P1) : Theme + Locale switchers Storybook fonctionnels

---

## Sortie du Sprint 4 (et Phase 1 Bootstrap)

A la fin de l'execution des 16 taches :

```
Frontend Skalean Insurtech operationnel :

8 apps Next.js 15 demarrant sur leurs ports :
  3000 web-insurtech-admin (SuperAdmin)
  3001 web-broker (cabinet courtage)
  3002 web-garage (garage)
  3003 web-garage-mobile (PWA technicien)
  3004 web-customer-portal (NEW v2.0 - SEO + ISR)
  3005 web-assure-portal (NEW v2.0 - self-service)
  3006 web-assure-mobile (NEW v2.0 - PWA declaration sinistre)

3 packages shared :
  shared-ui (theme Skalean Sofidemy + 30+ composants)
  shared-pwa (hooks PWA install/offline/SW)
  shared-maps (wrapper Mapbox GL JS)

Tooling :
  Multilingue 3 locales fr / ar-MA / ar avec RTL
  React Query + Axios + interceptors auto
  API client TypeScript genere depuis OpenAPI
  Tailwind 4 + shadcn/ui personnalise
  Tests E2E + Lighthouse baseline + Storybook (P1)
```

**Phase 1 Bootstrap COMPLETE** apres Sprint 4 :
- Sprint 1 : Infrastructure (monorepo, Docker, Postgres+RLS, Kafka, MinIO)
- Sprint 2 : Database (32 tables PARTIE1, 7 migrations, subscribers, Kafka producer/consumer base)
- Sprint 3 : API NestJS (Fastify, observability, validation, format unifie, 19 modules stubs)
- Sprint 4 : Frontend (8 apps Next.js, multilingue, theme, PWA, Mapbox)

**Phase 2 (Sprints 5-7) demarre avec** :
- Stack technique complete et testee
- API + Frontend prets a recevoir les modules metier
- Securite (Auth Sprint 5, Multi-tenant Sprint 6, RBAC Sprint 7) sera la fondation Phase 3+

---

## Specifications Format Tache (pour Generation par Cowork)

Quand Cowork genere les fichiers `task-1.4.X-*.md` dans `00-pilotage/prompts-taches/sprint-04-frontend-bootstrap/`, suivre format Option B : Metadonnees / But / Contexte / Livrables checkables / Fichiers crees / Notes implementation / Criteres validation V1-V10.

**Patterns code inline conserves** : structure App Router localise, next.config.mjs i18n+rewrites, API Axios interceptors, manifest.webmanifest PWA, theme Skalean CSS variables, Map component Mapbox.

**Reference complete** : `00-pilotage/documentation/6-metriques-validation.md` Lighthouse cibles, brand kit Sofidemy v3.0 colors/fonts, ports apps mapping.

---

**Fin du meta-prompt B-04 v2.2 format Option B.**
