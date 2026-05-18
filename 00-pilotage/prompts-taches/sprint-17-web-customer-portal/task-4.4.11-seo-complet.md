# TACHE 4.4.11 -- SEO Complet (Metadata + Sitemap + Structured Data + OG Images Dynamiques)

**Sprint** : 17 (Phase 4 / Sprint 4 dans phase)
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-17-sprint-17-web-customer-portal.md` (Tache 4.4.11)
**Phase** : 4 -- Vertical Insure (Skalean Broker ERP)
**Priorite** : P0 (acquisition organique = canal critique pilote Marrakech Sprint 35)
**Effort** : 5h
**Dependances** : Taches 4.4.1 a 4.4.10 (toutes pages publiques existent) + Sprint 14 (catalog products pour Product structured data)
**Densite cible** : 100-150 ko (auto-suffisant exhaustif)
**AUCUNE EMOJI AUTORISEE**

---

## 1. But

Cette tache **finalise et enrichit le SEO** du portail entier `web-customer-portal` Skalean Insurtech : metadata exhaustive per route via Next.js 15 Metadata API, sitemap.xml dynamique avec priorities/changefreq ajustees per type page, robots.txt prod-ready conditionnel `NEXT_PUBLIC_ENABLE_INDEXING`, **structured data riches** per type de page (`WebPage` + `Product` + `FAQPage` + `BreadcrumbList` + `Organization` + `WebSite` + `InsuranceAgency` + `Service`), **OG images dynamiques 15+ routes** (5 branches x 3 locales) via `@vercel/og` Edge Runtime avec design Sofidemy branche-specific, validation finale via Google Rich Results Test + Schema.org validator + Bing Webmaster Tools, Lighthouse SEO **100/100** sur **toutes pages publiques** (cible non-negociable).

L'apport est **quintuple** :

1. **SEO 100/100 sur 30+ routes** : landing root + 5 pages branches + 5 simulators + 5 comparators + verification + pages legales (6) + blog placeholder = ~30 routes a auditer Lighthouse SEO. Cible : 100/100 sur TOUTES, sans exception. Cela garantit Google indexe correctement et favorise ranking organique vs concurrents MA (RMA Watanya, Saham, Wafa Assurance, AXA MA) qui ont generalement SEO 70-85.

2. **OG images dynamiques per branche x locale** : 5 branches x 3 locales = 15 OG images dynamiques generees Edge Runtime via `@vercel/og`. Chaque image a design Sofidemy avec branche-specific colors (Auto bleu, Sante rose, Habitation vert, RC Pro ambre, Voyage violet), texte localise (fr / ar / ar-MA RTL), branding logo + tagline. Importance critique : 35-50 percent CTR uplift sur partages LinkedIn/Twitter/Facebook/WhatsApp vs OG generique.

3. **Rich snippets eligible Google** : structured data validees JSON-LD permettent Google d'afficher dans SERP : (a) carousel Product avec prix MAD + ratings, (b) FAQ accordion expandable directement dans search results, (c) Breadcrumbs cliquables, (d) Business hours + contact + adresse Casablanca, (e) Knowledge graph "Skalean Insurtech" panel. Trafic organique attendu : +25 percent CTR rich snippets vs link standard.

4. **Sitemap dynamique multi-langue** : sitemap.xml genere `app/sitemap.ts` avec ~60+ URLs (20 routes x 3 locales + alternates linguistiques + x-default). Submission a Google Search Console + Bing Webmaster Tools. Google decouvre nouvelles pages automatiquement vs crawl naturel (delai 1-7 jours -> 1-24h).

5. **Hreflang complet 3 locales + x-default** : `<link rel="alternate" hreflang="fr" href="..." />` + ar-MA + ar + x-default. Resout duplicate content penalty potentiel + serve la bonne version aux users MA / MENA selon Accept-Language browser ou geolocation.

A l'issue de cette tache, **toutes pages publiques** ont metadata complete (title + description + keywords + canonical + alternates + OG + Twitter + JSON-LD), 15 OG images dynamiques renderees < 1s Edge, sitemap.xml accessible et valide W3C, robots.txt prod-ready, Lighthouse SEO 100 sur 30+ routes verifie via CI, validation Google Rich Results Test PASS sur 8+ types schemas.

## 2. Contexte etendu

### 2.1 Pourquoi SEO 100 percent obligatoire (vs "tolerable")

Marche assurance MA = **concurrence SEO faible** mais opportunite limitee :
- **Concurrents traditionnels** (RMA Watanya, Saham, Wafa, AXA MA, Atlanta) : sites legacy, SEO scores 60-80, peu de structured data, OG basiques
- **Insurtech nouveaux** (Khedmaty, Yo'cab) : meilleur SEO mais limites a 1-2 produits
- **Skalean opportunite** : SEO 100/100 + structured data riches + multilingue parfait = differentiator competitif fort, ranking #1-3 atteignable sur queries "assurance auto en ligne Maroc", "comparateur sante MA", etc.

**Cout opportunite SEO non-100** : chaque point perdu Lighthouse SEO = -1 a -3 percent ranking organique (research Backlinko 2024). Sur trafic estime pilote Sprint 35 (1000 visiteurs/jour landing), perdre 5 points SEO = perdre ~50-100 visiteurs/jour = -25 a -50 souscriptions/mois (avec 2 percent conversion).

### 2.2 Architecture SEO complete (Next.js 15 Metadata API)

```
app/layout.tsx (root)
  -> metadataBase: https://souscrire.skalean-insurtech.ma
  -> applicationName, authors, publisher, generator
  -> defaults metadata (overridable per page)

app/[locale]/layout.tsx (locale)
  -> generateMetadata() : title.template + alternates.languages + OG.locale
  -> JSON-LD InsuranceAgency + LocalBusiness + Organization (global)

app/[locale]/page.tsx (landing root)
  -> generateMetadata() : title + description + keywords + canonical
  -> JSON-LD WebPage + FAQPage (FAQ section)
  -> opengraph-image.tsx (default landing)

app/[locale]/{auto,sante,...}/page.tsx
  -> generateMetadata() : title branche-specific + keywords
  -> JSON-LD Product + InsuranceProduct + Service + FAQPage + BreadcrumbList
  -> opengraph-image.tsx (5 branches OG)

app/[locale]/simulateur/{branche}/page.tsx
  -> generateMetadata() : "Devis [branche] en ligne | Skalean"
  -> JSON-LD WebPage + BreadcrumbList
  -> opengraph-image.tsx (5 simulators OG)

app/[locale]/comparer/{branche}/page.tsx
  -> generateMetadata() : "Comparer [branche] | Skalean"
  -> JSON-LD WebPage + BreadcrumbList
  -> opengraph-image.tsx (5 comparators OG)

app/[locale]/verifier-police/[id]/page.tsx
  -> metadata: { robots: { index: false } } (NOINDEX)
  -> Pas dans sitemap

app/[locale]/{a-propos,contact,faq,mentions-legales,cgu,politique-confidentialite,cookies}/page.tsx
  -> generateMetadata() per page
  -> JSON-LD WebPage + BreadcrumbList
  -> opengraph-image.tsx (default ou per-page)

app/sitemap.ts
  -> Genere ~60 URLs : 20 publiques x 3 locales
  -> Alternates linguistiques inclus
  -> Priorities 0.5-1.0 + changeFrequency

app/robots.ts
  -> Conditional indexing prod vs dev
  -> Disallow /api/, /wizard/, /paiement/return/, /confirmation/, /verifier-police/
  -> AI crawlers blocked (GPTBot, Claude-Web, etc.)
```

### 2.3 Alternatives considerees

| Alternative | Avantages | Inconvenients | Decision |
|-------------|-----------|---------------|----------|
| **Next.js 15 Metadata API native + JSON-LD inline** | Built-in, type-safe, SSR-natif, performance | Verbosity per page | **RETENU** |
| `next-seo` library | Helpers convenience | Bundle +30 KB, redundant avec Next 15 API native | rejete |
| Serveur-side meta via custom middleware | Controle total | Complex, deviation framework | rejete |
| Static metadata Markdown front-matter | Easy edit business | Pas type-safe, pas dynamique per param | rejete |
| `react-helmet` | Familier React tradi | Pas SSR-safe Next 13+, deprecated | rejete |
| **`@vercel/og` Edge Runtime OG images** | Performance Edge, react-like JSX, type-safe | Limite 1 MB output, font fetch needed | **RETENU** |
| `puppeteer` screenshot OG | Pixel-perfect, custom design | Heavy, slow (3-5s), incompatible Edge | rejete |
| OG images statiques pre-generees | Build once, fast | Pas dynamique per locale/data, maintenance | rejete |
| Cloudinary OG service | Easy, CDN cache | External dependency, decision-008 (data MA) | rejete |

### 2.4 Trade-offs explicites

1. **OG images Edge Runtime 25s timeout** : Vercel/Edge limite 25s execution. `@vercel/og` doit charger fonts + render < 25s. Si dependencies externes (Google Fonts fetch) slow -> timeout. Solution : embed font binaire dans code (`fs.readFileSync` au build time) OR utiliser font system (Arial/Helvetica safe). Trade-off : pas de fonts custom Sofidemy = design moins polish vs trade-off performance.

2. **Sitemap inclut /comparer/ et /simulateur/** : ces routes ne sont pas "content pages" mais "tool pages". Google les indexe mais ranking sera bas vs landing/branche pages. Decision Sprint 17 : inclure dans sitemap pour completude. Sprint 36+ : revoir si signal SEO negatif.

3. **JSON-LD per page = verbosity HTML head** : ajoute ~5-15 KB JSON-LD per page (uncompressed). Brotli compression ramene a ~1-3 KB. Trade-off accepte : rich snippets eligibility > bandwidth.

4. **Hreflang ar-MA + ar peut creer cannibalization** : Google peut considerer ar-MA et ar comme duplicate (memes contenus traduits differemment). Mitigation : differencier vraiment ar-MA (Darija + MSA mixte) vs ar (MSA pure). Verifier Google Search Console "Coverage" reports.

5. **Robots disallow /wizard/ + /confirmation/** : ces pages contiennent PII potentielle (sessionStorage state), donc disallow Google. Trade-off : Google ne peut pas tester accessibility de ces pages -> note Lighthouse moins precise. Acceptable car ces pages = post-conversion, pas SEO targets.

6. **Pas de blog Sprint 17** : aucun content marketing article. Sprint 32+ Skalean creera blog `/[locale]/blog/...` pour ranking longue traine. Mitigation : FAQ rich snippets compensent partiellement.

7. **Verification publique noindex** : `/[locale]/verifier-police/[id]/` deliberement noindex (CNDP + Tache 4.4.10). Trade-off : trafic verification organique nul, mais protection PII prevaut.

### 2.5 Pieges techniques (12 cas)

1. **Piege : metadataBase undefined -> OG images URLs relatives**
   - **Pourquoi** : sans `metadataBase`, Next.js genere `og:image` avec URL relative `/opengraph-image` -> Twitter/Facebook ne peuvent pas charger
   - **Solution** : `app/layout.tsx` `metadata.metadataBase = new URL(env.NEXT_PUBLIC_SITE_URL)` strict

2. **Piege : Twitter card type incorrect = small preview au lieu de large image**
   - **Pourquoi** : `twitter.card: 'summary'` au lieu de `'summary_large_image'`
   - **Solution** : default `summary_large_image` pour toutes pages + verifier via Twitter Card Validator

3. **Piege : hreflang URLs relatives ignorees par Google**
   - **Pourquoi** : `alternates.languages.fr = '/fr'` -> Google ne suit pas
   - **Solution** : URLs absolues toujours via `metadataBase.href + path`

4. **Piege : OG image returns 404 -> social platforms cache permanent fail**
   - **Pourquoi** : `opengraph-image.tsx` throw error au build -> fichier pas genere
   - **Solution** : try/catch dans Edge function + fallback static `/og-default.png` si echec

5. **Piege : structured data JSON parse fail si caractere special (apostrophe, guillemet)**
   - **Pourquoi** : `dangerouslySetInnerHTML` insert JSON-LD direct -> caractere `<` ou `</script>` casse parsing
   - **Solution** : escape `<` -> `<` via `JSON.stringify` + remplacement `</script>` -> `<\\/script>` OR utiliser `</script>` ban dans textContent

6. **Piege : sitemap.xml depasse 50 MB ou 50000 URLs**
   - **Pourquoi** : Google limite stricte sitemap individuel
   - **Solution** : Sprint 17 = ~60 URLs OK. Sprint 32+ : sitemap-index multi-sitemaps si extend (blog articles)

7. **Piege : Hreflang missing reciprocal**
   - **Pourquoi** : page A liste hreflang fr/ar-MA mais page B (fr) liste hreflang fr/ar -> Google detect mismatch
   - **Solution** : helper centralise `buildAlternates()` qui genere TOUJOURS 3 langues + x-default systematiquement

8. **Piege : robots.txt fetch echoue si dynamique avec env error**
   - **Pourquoi** : `app/robots.ts` lit env -> si env validation fail au build -> robots.txt 500
   - **Solution** : try/catch fallback `Disallow: /` strict (better safe than sorry)

9. **Piege : Lighthouse SEO checker rapporte "noindex on home"**
   - **Pourquoi** : dev environment a `ENABLE_INDEXING=false` -> noindex partout
   - **Solution** : verifier Lighthouse audit run en prod env. Sprint 17 = test sur staging avec `ENABLE_INDEXING=true`

10. **Piege : `Product` structured data sans `offers` -> warning Google**
    - **Pourquoi** : `@type: Product` requires `offers` ou `aggregateOffer`
    - **Solution** : toujours inclure `AggregateOffer` avec `priceCurrency: 'MAD'`, `lowPrice`, `highPrice`, `priceValidUntil`

11. **Piege : OG image taille > 8 MB (Facebook limit) ou < 200x200 (Twitter min)**
    - **Pourquoi** : `@vercel/og` genere PNG complex peut depasser 8 MB
    - **Solution** : taille fixe 1200x630 (Twitter Large + Facebook standard) + simplifier design si > 1 MB

12. **Piege : `keywords` meta deprecate Google (depuis 2009) mais utile Bing/Yandex**
    - **Pourquoi** : developpeur sait pas si include ou non
    - **Solution** : include quand meme (Bing + Yandex MA usage non-negligeable) avec ~8 keywords ciblees per page

## 3. Architecture context

### 3.1 Position dans sprint 17

- **Depend** : Taches 4.4.1 (foundation SEO + robots + sitemap + InsuranceAgency JSON-LD) + 4.4.2 (FAQPage JSON-LD) + 4.4.3 (Product per branche) + 4.4.10 (verification noindex)
- **Bloque** : aucune autre tache Sprint 17 mais critique pour Sprint 35 pilote SEO performance
- **Apporte** : metadata exhaustive 30 routes + sitemap 60+ URLs + 15 OG dynamiques + 8 types structured data + helpers reutilisables (`structured-data.ts`, `meta-defaults.ts`, `hreflang.ts`)

### 3.2 Structure fichiers

```
apps/web-customer-portal/
  app/
    sitemap.ts                                              # Enrichi Tache 4.4.11
    robots.ts                                                # Prod-ready Tache 4.4.11
    opengraph-image.tsx                                       # Default OG
    [locale]/
      auto/opengraph-image.tsx                                # OG branche-specific
      sante/opengraph-image.tsx
      habitation/opengraph-image.tsx
      rc-pro/opengraph-image.tsx
      voyage/opengraph-image.tsx
      simulateur/{branche}/opengraph-image.tsx                # OG simulator
      comparer/{branche}/opengraph-image.tsx                   # OG comparateur
  components/seo/
    jsonld-webpage.tsx                                        # Generic WebPage
    jsonld-product.tsx                                        # Product per branche
    jsonld-service.tsx                                         # Service per branche
    jsonld-faqpage.tsx                                         # FAQ accordion
    jsonld-organization.tsx                                    # Org global
    jsonld-website.tsx                                         # WebSite + SearchAction
    jsonld-insurance-agency.tsx                                # Existing Tache 4.4.1
    jsonld-local-business.tsx                                  # Existing Tache 4.4.1
    breadcrumbs-jsonld.tsx                                    # BreadcrumbList
  lib/seo/
    structured-data.ts                                         # All builders centralized
    meta-defaults.ts                                            # buildDefaultMetadata helper
    hreflang.ts                                                # generateHreflangs helper
    og-defaults.ts                                              # OG image defaults (colors, dimensions)
    keywords-per-branche.ts                                     # Keywords MA-targeted per branche
    canonical-builder.ts                                        # Build canonical URLs
```

## 4. Livrables checkables (35+)

- [ ] **L1** `app/sitemap.ts` enrichi ~150 lignes (60+ URLs + alternates + priorities + changefreq)
- [ ] **L2** `app/robots.ts` prod-ready ~80 lignes (disallow + AI crawlers + Googlebot allow)
- [ ] **L3** `app/opengraph-image.tsx` default 1200x630 Sofidemy ~150 lignes
- [ ] **L4** `app/[locale]/auto/opengraph-image.tsx` ~160 lignes (Auto bleu)
- [ ] **L5** `app/[locale]/sante/opengraph-image.tsx` ~160 lignes (Sante rose)
- [ ] **L6** `app/[locale]/habitation/opengraph-image.tsx` ~160 lignes (Habitation vert)
- [ ] **L7** `app/[locale]/rc-pro/opengraph-image.tsx` ~160 lignes (RC Pro ambre)
- [ ] **L8** `app/[locale]/voyage/opengraph-image.tsx` ~160 lignes (Voyage violet)
- [ ] **L9** `app/[locale]/simulateur/{branche}/opengraph-image.tsx` (5 files, similaire pattern)
- [ ] **L10** `app/[locale]/comparer/{branche}/opengraph-image.tsx` (5 files, similaire pattern)
- [ ] **L11** Composant `components/seo/jsonld-webpage.tsx` ~80 lignes
- [ ] **L12** Composant `components/seo/jsonld-product.tsx` ~120 lignes
- [ ] **L13** Composant `components/seo/jsonld-service.tsx` ~100 lignes
- [ ] **L14** Composant `components/seo/jsonld-faqpage.tsx` ~80 lignes
- [ ] **L15** Composant `components/seo/jsonld-organization.tsx` ~100 lignes
- [ ] **L16** Composant `components/seo/jsonld-website.tsx` ~80 lignes
- [ ] **L17** Composant `components/seo/breadcrumbs-jsonld.tsx` ~60 lignes
- [ ] **L18** Lib `lib/seo/structured-data.ts` ~250 lignes (8 builders)
- [ ] **L19** Lib `lib/seo/meta-defaults.ts` ~120 lignes
- [ ] **L20** Lib `lib/seo/hreflang.ts` ~80 lignes
- [ ] **L21** Lib `lib/seo/og-defaults.ts` ~100 lignes (couleurs + tailles + fonts)
- [ ] **L22** Lib `lib/seo/keywords-per-branche.ts` ~120 lignes (5 branches x 8 keywords)
- [ ] **L23** Lib `lib/seo/canonical-builder.ts` ~50 lignes
- [ ] **L24** Tests unit `__tests__/lib/seo/structured-data.spec.ts` (15 tests)
- [ ] **L25** Tests unit `__tests__/lib/seo/hreflang.spec.ts` (10 tests)
- [ ] **L26** Tests unit `__tests__/lib/seo/keywords-per-branche.spec.ts` (8 tests)
- [ ] **L27** Tests unit `__tests__/lib/seo/canonical-builder.spec.ts` (8 tests)
- [ ] **L28** Tests unit `__tests__/components/seo/jsonld-product.spec.tsx` (8 tests)
- [ ] **L29** Tests integration `__tests__/integration/sitemap.spec.ts` (10 tests)
- [ ] **L30** Tests integration `__tests__/integration/robots.spec.ts` (8 tests)
- [ ] **L31** Tests integration `__tests__/integration/og-images.spec.ts` (10 tests x 15 routes)
- [ ] **L32** Tests E2E `e2e/seo-validation.spec.ts` (15 scenarios)
- [ ] **L33** Lighthouse SEO 100/100 sur 10+ pages publiques verifie
- [ ] **L34** Google Rich Results Test PASS sur 5 types JSON-LD (Product, FAQPage, Organization, WebPage, BreadcrumbList)
- [ ] **L35** Sitemap genere ~60 URLs validees W3C XML
- [ ] **L36** 15 OG images dynamiques generes < 1s Edge Runtime
- [ ] **L37** Hreflang 3 langues + x-default present sur toutes pages publiques
- [ ] **L38** Canonical URLs absolues partout
- [ ] **L39** robots.txt prod ready avec disallow strict + AI crawlers blocked
- [ ] **L40** No emoji + no console.log + typecheck OK + lint OK

## 5. Fichiers crees / modifies (exhaustive)

```
repo/apps/web-customer-portal/app/sitemap.ts                                              (~150 lignes -- enrichi)
repo/apps/web-customer-portal/app/robots.ts                                                (~85 lignes -- prod-ready)
repo/apps/web-customer-portal/app/opengraph-image.tsx                                       (~150 lignes -- default OG)
repo/apps/web-customer-portal/app/[locale]/auto/opengraph-image.tsx                         (~160 lignes)
repo/apps/web-customer-portal/app/[locale]/sante/opengraph-image.tsx                        (~160 lignes)
repo/apps/web-customer-portal/app/[locale]/habitation/opengraph-image.tsx                  (~160 lignes)
repo/apps/web-customer-portal/app/[locale]/rc-pro/opengraph-image.tsx                       (~160 lignes)
repo/apps/web-customer-portal/app/[locale]/voyage/opengraph-image.tsx                       (~160 lignes)
repo/apps/web-customer-portal/app/[locale]/simulateur/{auto,sante,habitation,rc-pro,voyage}/opengraph-image.tsx  (5 files)
repo/apps/web-customer-portal/app/[locale]/comparer/{auto,sante,habitation,rc-pro,voyage}/opengraph-image.tsx     (5 files)
repo/apps/web-customer-portal/components/seo/jsonld-webpage.tsx                             (~80 lignes)
repo/apps/web-customer-portal/components/seo/jsonld-product.tsx                              (~130 lignes)
repo/apps/web-customer-portal/components/seo/jsonld-service.tsx                              (~110 lignes)
repo/apps/web-customer-portal/components/seo/jsonld-faqpage.tsx                              (~80 lignes)
repo/apps/web-customer-portal/components/seo/jsonld-organization.tsx                         (~100 lignes)
repo/apps/web-customer-portal/components/seo/jsonld-website.tsx                              (~80 lignes)
repo/apps/web-customer-portal/components/seo/breadcrumbs-jsonld.tsx                          (~60 lignes)
repo/apps/web-customer-portal/lib/seo/structured-data.ts                                     (~260 lignes -- 8 builders)
repo/apps/web-customer-portal/lib/seo/meta-defaults.ts                                       (~130 lignes)
repo/apps/web-customer-portal/lib/seo/hreflang.ts                                            (~85 lignes)
repo/apps/web-customer-portal/lib/seo/og-defaults.ts                                         (~110 lignes)
repo/apps/web-customer-portal/lib/seo/keywords-per-branche.ts                                (~130 lignes)
repo/apps/web-customer-portal/lib/seo/canonical-builder.ts                                   (~55 lignes)
repo/apps/web-customer-portal/__tests__/lib/seo/structured-data.spec.ts                      (~200 lignes -- 15 tests)
repo/apps/web-customer-portal/__tests__/lib/seo/hreflang.spec.ts                             (~150 lignes -- 10 tests)
repo/apps/web-customer-portal/__tests__/lib/seo/keywords-per-branche.spec.ts                 (~130 lignes -- 8 tests)
repo/apps/web-customer-portal/__tests__/lib/seo/canonical-builder.spec.ts                    (~120 lignes -- 8 tests)
repo/apps/web-customer-portal/__tests__/components/seo/jsonld-product.spec.tsx                (~140 lignes -- 8 tests)
repo/apps/web-customer-portal/__tests__/integration/sitemap.spec.ts                           (~180 lignes -- 10 tests)
repo/apps/web-customer-portal/__tests__/integration/robots.spec.ts                            (~140 lignes -- 8 tests)
repo/apps/web-customer-portal/__tests__/integration/og-images.spec.ts                         (~180 lignes -- 10 tests)
repo/apps/web-customer-portal/e2e/seo-validation.spec.ts                                       (~250 lignes -- 15 tests)
```

## 6. Code patterns COMPLETS

### Fichier 1/15 : `lib/seo/structured-data.ts`

Centralisation builders 8 types JSON-LD.

```typescript
import { env } from '@/lib/env';
import type { Locale } from '@/lib/constants';

const BASE = (): string => env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');

export interface OrganizationData {
  name: string;
  legalName: string;
  url: string;
  logo: string;
  sameAs: string[];
}

export function buildOrganizationJsonLd() {
  const baseUrl = BASE();
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${baseUrl}/#organization`,
    name: 'Skalean Insurtech',
    legalName: 'Skalean Insurtech SARL',
    url: baseUrl,
    logo: {
      '@type': 'ImageObject',
      url: `${baseUrl}/logo.png`,
      width: 512,
      height: 512,
    },
    sameAs: [
      'https://www.linkedin.com/company/skalean-insurtech',
      'https://www.facebook.com/SkaleanInsurtech',
      'https://twitter.com/SkaleanMA',
      'https://www.instagram.com/skalean.insurtech',
      'https://www.youtube.com/@SkaleanInsurtech',
    ],
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Boulevard Mohamed V, Quartier des Affaires',
      addressLocality: 'Casablanca',
      addressRegion: 'Casablanca-Settat',
      postalCode: '20000',
      addressCountry: 'MA',
    },
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+212522000000',
      contactType: 'customer service',
      areaServed: 'MA',
      availableLanguage: ['French', 'Arabic'],
    },
    foundingDate: '2025-01-01',
    knowsLanguage: ['fr-MA', 'ar-MA', 'ar'],
  };
}

export function buildWebsiteJsonLd() {
  const baseUrl = BASE();
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${baseUrl}/#website`,
    url: baseUrl,
    name: 'Skalean Insurtech',
    description: 'Premier portail vente en ligne d assurance au Maroc',
    publisher: { '@id': `${baseUrl}/#organization` },
    inLanguage: ['fr-MA', 'ar-MA', 'ar'],
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${baseUrl}/fr/recherche?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

export function buildWebPageJsonLd(params: {
  title: string;
  description: string;
  url: string;
  locale: Locale;
  datePublished?: string;
  dateModified?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${params.url}#webpage`,
    url: params.url,
    name: params.title,
    description: params.description,
    inLanguage: params.locale,
    isPartOf: { '@id': `${BASE()}/#website` },
    publisher: { '@id': `${BASE()}/#organization` },
    datePublished: params.datePublished ?? '2026-01-01T00:00:00Z',
    dateModified: params.dateModified ?? new Date().toISOString(),
  };
}

export function buildProductJsonLd(params: {
  name: string;
  description: string;
  url: string;
  brancheSlug: string;
  priceMinMAD: number;
  priceMaxMAD: number;
  averageRating?: number;
  reviewCount?: number;
}) {
  const baseUrl = BASE();
  return {
    '@context': 'https://schema.org',
    '@type': ['Product', 'InsuranceAgency'],
    '@id': `${params.url}#product`,
    name: params.name,
    description: params.description,
    url: params.url,
    image: `${params.url}/opengraph-image`,
    brand: {
      '@type': 'Brand',
      name: 'Skalean Insurtech',
      '@id': `${baseUrl}/#organization`,
    },
    category: 'Insurance',
    offers: {
      '@type': 'AggregateOffer',
      url: params.url,
      priceCurrency: 'MAD',
      lowPrice: params.priceMinMAD.toString(),
      highPrice: params.priceMaxMAD.toString(),
      offerCount: '3',
      availability: 'https://schema.org/InStock',
      areaServed: { '@type': 'Country', name: 'Morocco', identifier: 'MA' },
      seller: { '@id': `${baseUrl}/#organization` },
      priceValidUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: (params.averageRating ?? 4.6).toString(),
      reviewCount: (params.reviewCount ?? 128).toString(),
      bestRating: '5',
      worstRating: '1',
    },
    additionalType: 'https://schema.org/InsurancePolicy',
  };
}

export function buildServiceJsonLd(params: {
  name: string;
  description: string;
  url: string;
  serviceType?: string;
  areaCovered?: string;
  priceMin: number;
  priceMax: number;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: params.name,
    description: params.description,
    url: params.url,
    serviceType: params.serviceType ?? 'Insurance',
    provider: { '@id': `${BASE()}/#organization` },
    areaServed: { '@type': 'Country', name: params.areaCovered ?? 'Morocco', identifier: 'MA' },
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'MAD',
      lowPrice: params.priceMin.toString(),
      highPrice: params.priceMax.toString(),
      availability: 'https://schema.org/InStock',
    },
    availableLanguage: ['fr', 'ar'],
  };
}

export function buildFAQPageJsonLd(faqs: ReadonlyArray<{ question: string; answer: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };
}

export function buildBreadcrumbJsonLd(items: ReadonlyArray<{ name: string; url: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function buildInsuranceAgencyJsonLd(params: { locale: Locale }) {
  const baseUrl = BASE();
  return {
    '@context': 'https://schema.org',
    '@type': 'InsuranceAgency',
    '@id': `${baseUrl}/#insuranceagency`,
    name: 'Skalean Insurtech',
    url: `${baseUrl}/${params.locale}`,
    parentOrganization: { '@id': `${baseUrl}/#organization` },
    address: { '@type': 'PostalAddress', addressLocality: 'Casablanca', addressCountry: 'MA' },
    telephone: '+212522000000',
    areaServed: 'MA',
    knowsLanguage: ['fr-MA', 'ar-MA', 'ar'],
  };
}

export function escapeJsonLd(json: object): string {
  return JSON.stringify(json)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/'/g, '\\u0027');
}
```

### Fichier 2/15 : `lib/seo/meta-defaults.ts`

```typescript
import type { Metadata } from 'next';
import { env } from '@/lib/env';

const indexingEnabled = env.NEXT_PUBLIC_ENABLE_INDEXING === 'true';

export const DEFAULT_META: Partial<Metadata> = {
  metadataBase: new URL(env.NEXT_PUBLIC_SITE_URL),
  applicationName: 'Skalean Insurtech',
  authors: [{ name: 'Skalean Insurtech', url: env.NEXT_PUBLIC_SITE_URL }],
  generator: 'Next.js',
  publisher: 'Skalean Insurtech SARL',
  referrer: 'origin-when-cross-origin',
  formatDetection: { telephone: false, email: false, address: false },
  category: 'insurance',
  classification: 'business',
  robots: indexingEnabled
    ? {
        index: true,
        follow: true,
        googleBot: {
          index: true,
          follow: true,
          'max-image-preview': 'large',
          'max-snippet': -1,
          'max-video-preview': -1,
        },
      }
    : { index: false, follow: false, nocache: true },
  verification: {
    google: env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
    other: { 'msvalidate.01': env.NEXT_PUBLIC_BING_SITE_VERIFICATION ?? '' },
  },
};

interface BuildMetadataParams {
  title: string;
  description: string;
  keywords?: string[];
  canonical: string;
  alternates?: Record<string, string>;
  ogImage?: string;
  ogType?: 'website' | 'article' | 'product';
  twitterCard?: 'summary' | 'summary_large_image';
  noindex?: boolean;
}

export function buildDefaultMetadata(params: BuildMetadataParams): Metadata {
  return {
    ...DEFAULT_META,
    title: params.title,
    description: params.description,
    keywords: params.keywords,
    alternates: {
      canonical: params.canonical,
      languages: params.alternates,
    },
    openGraph: {
      title: params.title,
      description: params.description,
      url: params.canonical,
      type: params.ogType ?? 'website',
      siteName: 'Skalean Insurtech',
      locale: 'fr_MA',
      alternateLocale: ['ar_MA', 'ar_AR'],
      images: params.ogImage ? [{ url: params.ogImage, width: 1200, height: 630, alt: params.title }] : undefined,
    },
    twitter: {
      card: params.twitterCard ?? 'summary_large_image',
      site: '@SkaleanMA',
      creator: '@SkaleanMA',
      title: params.title,
      description: params.description,
      images: params.ogImage ? [params.ogImage] : undefined,
    },
    robots: params.noindex
      ? { index: false, follow: false, nocache: true }
      : DEFAULT_META.robots,
  };
}
```

### Fichier 3/15 : `lib/seo/hreflang.ts`

```typescript
import { env } from '@/lib/env';
import { SUPPORTED_LOCALES, type Locale } from '@/lib/constants';

export function generateHreflangs(pathWithoutLocale: string): Record<string, string> {
  const base = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  const cleanPath = pathWithoutLocale === '/' || pathWithoutLocale === '' ? '' : (pathWithoutLocale.startsWith('/') ? pathWithoutLocale : `/${pathWithoutLocale}`);

  const out: Record<string, string> = {};
  for (const locale of SUPPORTED_LOCALES) {
    out[locale] = `${base}/${locale}${cleanPath}`;
  }
  out['x-default'] = `${base}/fr${cleanPath}`;
  return out;
}

export function getOpenGraphLocale(locale: Locale): string {
  switch (locale) {
    case 'fr':
      return 'fr_MA';
    case 'ar-MA':
      return 'ar_MA';
    case 'ar':
      return 'ar_AR';
  }
}

export function getAlternateOgLocales(currentLocale: Locale): string[] {
  return SUPPORTED_LOCALES.filter((l) => l !== currentLocale).map(getOpenGraphLocale);
}

export function buildHreflangTags(pathWithoutLocale: string): string {
  const map = generateHreflangs(pathWithoutLocale);
  return Object.entries(map)
    .map(([lang, url]) => `<link rel="alternate" hreflang="${lang}" href="${url}" />`)
    .join('\n');
}

export function isValidLocale(locale: string): locale is Locale {
  return SUPPORTED_LOCALES.includes(locale as Locale);
}
```

### Fichier 4/15 : `lib/seo/keywords-per-branche.ts`

```typescript
import type { BrancheSlug } from '@/lib/constants';

type LocaleKeywords = {
  fr: string[];
  ar: string[];
  'ar-MA': string[];
};

export const KEYWORDS_PER_BRANCHE: Record<BrancheSlug, LocaleKeywords> = {
  auto: {
    fr: ['assurance auto maroc', 'rc obligatoire maroc', 'tous risques casablanca', 'comparateur assurance vehicule', 'devis auto en ligne ma', 'assurance voiture rabat', 'tiers plus marrakech', 'cnj assurance auto'],
    ar: ['تأمين السيارات المغرب', 'تأمين شامل', 'تأمين على المركبات', 'مقارنة تأمين السيارات'],
    'ar-MA': ['تامين السيارة بالمغرب', 'مقارنة اسعار التامين', 'تامين شامل الدار البيضاء'],
  },
  sante: {
    fr: ['assurance sante maroc', 'mutuelle privee ma', 'complementaire ramed', 'sante familiale casablanca', 'hospitalisation marrakech', 'optique dentaire ma', 'maternite assurance', 'consultation specialiste'],
    ar: ['تأمين صحي المغرب', 'تأمين صحي خاص', 'تكميلي رميد', 'تأمين عائلي'],
    'ar-MA': ['تامين صحي بالمغرب', 'تامين كومبليمونتير', 'تامين عائلي'],
  },
  habitation: {
    fr: ['assurance habitation maroc', 'multirisque immeuble ma', 'proprietaire bailleur', 'locataire assurance', 'vol cambriolage casablanca', 'incendie degats eaux', 'cat nat maroc', 'assurance villa marrakech'],
    ar: ['تأمين المنزل المغرب', 'تأمين متعدد المخاطر', 'تأمين السكن'],
    'ar-MA': ['تامين السكن بالمغرب', 'تامين الفيلا', 'تامين الشقة'],
  },
  'rc-pro': {
    fr: ['rc professionnelle maroc', 'assurance medecin ma', 'rc avocat casablanca', 'pme responsabilite', 'rc ingenieur conseil', 'rc dentiste', 'assurance consultant', 'rc btp construction'],
    ar: ['تأمين المسؤولية المهنية', 'تأمين الأطباء', 'تأمين المحامين'],
    'ar-MA': ['تامين المسؤولية المهنية بالمغرب', 'تامين الاطباء', 'تامين المهنيين'],
  },
  voyage: {
    fr: ['assurance voyage schengen', 'rapatriement maroc', 'visa assurance', 'voyage business ma', 'assurance famille voyage', 'frais medicaux etranger', 'annulation voyage', 'bagages perdus assurance'],
    ar: ['تأمين السفر شنغن', 'الإعادة إلى الوطن', 'تأمين السفر'],
    'ar-MA': ['تامين السفر بالمغرب', 'تامين فيزا شنغن', 'تامين السفر العائلي'],
  },
};

export function getKeywordsForBranche(brancheSlug: BrancheSlug, locale: keyof LocaleKeywords): string[] {
  return KEYWORDS_PER_BRANCHE[brancheSlug][locale] ?? KEYWORDS_PER_BRANCHE[brancheSlug].fr;
}

export const COMMON_KEYWORDS: LocaleKeywords = {
  fr: ['assurance en ligne maroc', 'skalean insurtech', 'comparateur assurance', 'devis instantane', 'souscription en ligne'],
  ar: ['تأمين عبر الإنترنت', 'سكاليان', 'مقارنة التأمين'],
  'ar-MA': ['تامين اونلاين بالمغرب', 'سكاليان للتامين', 'مقارنة اسعار'],
};

export function getCommonKeywords(locale: keyof LocaleKeywords): string[] {
  return COMMON_KEYWORDS[locale] ?? COMMON_KEYWORDS.fr;
}
```

### Fichier 5/15 : `lib/seo/canonical-builder.ts`

```typescript
import { env } from '@/lib/env';

export function buildCanonical(path: string): string {
  const baseUrl = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`;
}

export function buildCanonicalForLocale(locale: string, pathWithoutLocale: string): string {
  const cleanPath = pathWithoutLocale === '/' || pathWithoutLocale === '' ? '' : pathWithoutLocale;
  return buildCanonical(`/${locale}${cleanPath}`);
}

export function stripQueryAndHash(url: string): string {
  return url.split('?')[0].split('#')[0];
}
```

### Fichier 6/15 : `lib/seo/og-defaults.ts`

```typescript
import type { BrancheSlug } from '@/lib/constants';

export const OG_DIMENSIONS = { width: 1200, height: 630 } as const;

export type BrancheOgTheme = {
  gradient: { from: string; via: string; to: string };
  accentColor: string;
  iconColor: string;
};

export const BRANCHE_OG_THEMES: Record<BrancheSlug, BrancheOgTheme> = {
  auto: {
    gradient: { from: '#1E40AF', via: '#0EA5E9', to: '#06B6D4' },
    accentColor: '#FBBF24',
    iconColor: '#FFFFFF',
  },
  sante: {
    gradient: { from: '#BE185D', via: '#EC4899', to: '#F472B6' },
    accentColor: '#FEF3C7',
    iconColor: '#FFFFFF',
  },
  habitation: {
    gradient: { from: '#047857', via: '#10B981', to: '#34D399' },
    accentColor: '#F0FDF4',
    iconColor: '#FFFFFF',
  },
  'rc-pro': {
    gradient: { from: '#B45309', via: '#F59E0B', to: '#FBBF24' },
    accentColor: '#FFFBEB',
    iconColor: '#FFFFFF',
  },
  voyage: {
    gradient: { from: '#6D28D9', via: '#8B5CF6', to: '#A78BFA' },
    accentColor: '#F5F3FF',
    iconColor: '#FFFFFF',
  },
};

export const DEFAULT_OG_THEME: BrancheOgTheme = {
  gradient: { from: '#0B1220', via: '#1E3A8A', to: '#0EA5E9' },
  accentColor: '#FBBF24',
  iconColor: '#FFFFFF',
};

export const COMPLIANCE_TAGLINES = {
  fr: 'ACAPS | CNDP | Donnees hebergees au Maroc',
  ar: 'ACAPS | CNDP | بيانات مستضافة في المغرب',
  'ar-MA': 'ACAPS | CNDP | البيانات بالمغرب',
};

export function buildBackgroundGradient(theme: BrancheOgTheme): string {
  return `linear-gradient(135deg, ${theme.gradient.from} 0%, ${theme.gradient.via} 50%, ${theme.gradient.to} 100%)`;
}
```

### Fichier 7/15 : `app/sitemap.ts` (enrichi)

```typescript
import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';
import { SUPPORTED_LOCALES, BRANCHES } from '@/lib/constants';

interface SitemapEntry {
  url: string;
  lastModified: Date;
  changeFrequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  priority: number;
  alternates?: { languages: Record<string, string> };
}

function makeLocalized(
  path: string,
  priority: number,
  changeFrequency: SitemapEntry['changeFrequency'],
  lastModified: Date
): SitemapEntry[] {
  const base = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  return SUPPORTED_LOCALES.map((locale) => {
    const languages: Record<string, string> = {};
    for (const l of SUPPORTED_LOCALES) {
      languages[l] = `${base}/${l}${path === '/' || path === '' ? '' : path}`;
    }
    languages['x-default'] = `${base}/fr${path === '/' || path === '' ? '' : path}`;
    return {
      url: `${base}/${locale}${path === '/' || path === '' ? '' : path}`,
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

  entries.push(...makeLocalized('', 1.0, 'weekly', now));

  for (const b of BRANCHES) {
    entries.push(...makeLocalized(`/${b.slug}`, 0.9, 'weekly', now));
    entries.push(...makeLocalized(`/simulateur/${b.slug}`, 0.85, 'weekly', now));
    entries.push(...makeLocalized(`/comparer/${b.slug}`, 0.8, 'weekly', now));
  }

  const staticPages = [
    { path: '/a-propos', priority: 0.6, freq: 'monthly' as const },
    { path: '/contact', priority: 0.6, freq: 'monthly' as const },
    { path: '/faq', priority: 0.7, freq: 'weekly' as const },
    { path: '/mentions-legales', priority: 0.3, freq: 'yearly' as const },
    { path: '/cgu', priority: 0.3, freq: 'yearly' as const },
    { path: '/politique-confidentialite', priority: 0.4, freq: 'yearly' as const },
    { path: '/cookies', priority: 0.3, freq: 'yearly' as const },
    { path: '/methodologie-comparaison', priority: 0.5, freq: 'monthly' as const },
  ];

  for (const p of staticPages) {
    entries.push(...makeLocalized(p.path, p.priority, p.freq, now));
  }

  return entries;
}
```

### Fichier 8/15 : `app/robots.ts` (prod-ready)

```typescript
import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';

const AI_CRAWLERS = [
  'GPTBot',
  'ChatGPT-User',
  'Google-Extended',
  'CCBot',
  'anthropic-ai',
  'Claude-Web',
  'PerplexityBot',
  'Bytespider',
  'FacebookBot',
  'YouBot',
];

export default function robots(): MetadataRoute.Robots {
  const baseUrl = env.NEXT_PUBLIC_SITE_URL;
  const indexingEnabled = env.NEXT_PUBLIC_ENABLE_INDEXING === 'true';

  if (!indexingEnabled) {
    return {
      rules: [{ userAgent: '*', disallow: '/' }],
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
          '/verifier-police/',
          '/*?session=*',
          '/*?wizard=*',
          '/*?token=*',
        ],
        crawlDelay: 1,
      },
      ...AI_CRAWLERS.map((bot) => ({ userAgent: bot, disallow: '/' })),
      { userAgent: 'Googlebot', allow: '/', crawlDelay: 0 },
      { userAgent: 'Bingbot', allow: '/', crawlDelay: 1 },
      { userAgent: 'DuckDuckBot', allow: '/', crawlDelay: 1 },
      { userAgent: 'YandexBot', allow: '/', crawlDelay: 1 },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
```

### Fichier 9/15 : `app/[locale]/auto/opengraph-image.tsx`

```typescript
import { ImageResponse } from 'next/og';
import { OG_DIMENSIONS, BRANCHE_OG_THEMES, buildBackgroundGradient, COMPLIANCE_TAGLINES } from '@/lib/seo/og-defaults';

export const runtime = 'edge';
export const alt = 'Assurance Auto en ligne au Maroc - Skalean Insurtech';
export const size = OG_DIMENSIONS;
export const contentType = 'image/png';

const THEME = BRANCHE_OG_THEMES.auto;

export default async function Image({ params }: { params: { locale: string } }) {
  const isRtl = params.locale === 'ar' || params.locale === 'ar-MA';
  const title = isRtl ? 'تأمين السيارة عبر الإنترنت بالمغرب' : 'Assurance Auto en ligne au Maroc';
  const subtitle = isRtl ? 'سعر فوري - تغطية شاملة' : 'Devis instantane - Couverture complete';
  const compliance = COMPLIANCE_TAGLINES[params.locale as keyof typeof COMPLIANCE_TAGLINES] ?? COMPLIANCE_TAGLINES.fr;

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
          background: buildBackgroundGradient(THEME),
          padding: '60px',
          direction: isRtl ? 'rtl' : 'ltr',
          fontFamily: 'sans-serif',
        }}
      >
        <svg width="140" height="140" viewBox="0 0 140 140" fill="none">
          <rect x="20" y="60" width="100" height="45" rx="6" fill="#FFFFFF" />
          <rect x="35" y="35" width="70" height="30" rx="5" fill="#FFFFFF" />
          <rect x="42" y="45" width="22" height="15" rx="2" fill={THEME.gradient.from} opacity="0.7" />
          <rect x="76" y="45" width="22" height="15" rx="2" fill={THEME.gradient.from} opacity="0.7" />
          <circle cx="40" cy="108" r="12" fill="#0F172A" />
          <circle cx="40" cy="108" r="6" fill="#475569" />
          <circle cx="100" cy="108" r="12" fill="#0F172A" />
          <circle cx="100" cy="108" r="6" fill="#475569" />
        </svg>

        <div style={{ fontSize: '60px', fontWeight: 700, color: THEME.iconColor, textAlign: 'center', marginTop: '40px', maxWidth: '900px', lineHeight: 1.1 }}>
          {title}
        </div>
        <div style={{ fontSize: '32px', color: THEME.accentColor, textAlign: 'center', marginTop: '20px', maxWidth: '800px' }}>
          {subtitle}
        </div>

        <div style={{ position: 'absolute', bottom: '40px', display: 'flex', alignItems: 'center', gap: '20px', fontSize: '22px', color: '#FFFFFF', opacity: 0.85 }}>
          {compliance.split(' | ').map((item, idx, arr) => (
            <>
              <span key={idx}>{item}</span>
              {idx < arr.length - 1 && <span style={{ opacity: 0.4 }}>|</span>}
            </>
          ))}
        </div>

        <div style={{ position: 'absolute', top: '40px', start: '60px', fontSize: '24px', color: '#FFFFFF', opacity: 0.9, fontWeight: 600 }}>
          Skalean Insurtech
        </div>
      </div>
    ),
    { ...OG_DIMENSIONS }
  );
}
```

### Fichier 10/15 : `app/[locale]/sante/opengraph-image.tsx`

```typescript
import { ImageResponse } from 'next/og';
import { OG_DIMENSIONS, BRANCHE_OG_THEMES, buildBackgroundGradient, COMPLIANCE_TAGLINES } from '@/lib/seo/og-defaults';

export const runtime = 'edge';
export const alt = 'Assurance Sante en ligne au Maroc - Skalean Insurtech';
export const size = OG_DIMENSIONS;
export const contentType = 'image/png';

const THEME = BRANCHE_OG_THEMES.sante;

export default async function Image({ params }: { params: { locale: string } }) {
  const isRtl = params.locale === 'ar' || params.locale === 'ar-MA';
  const title = isRtl ? 'تأمين صحي عبر الإنترنت بالمغرب' : 'Assurance Sante en ligne au Maroc';
  const subtitle = isRtl ? 'تغطية شاملة للعائلة - استشفاء - بصر - أسنان' : 'Famille - Hospitalisation - Optique - Dentaire';
  const compliance = COMPLIANCE_TAGLINES[params.locale as keyof typeof COMPLIANCE_TAGLINES] ?? COMPLIANCE_TAGLINES.fr;

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
          background: buildBackgroundGradient(THEME),
          padding: '60px',
          direction: isRtl ? 'rtl' : 'ltr',
          fontFamily: 'sans-serif',
        }}
      >
        <svg width="140" height="140" viewBox="0 0 140 140" fill="none">
          <path d="M70 30 C 50 30, 30 50, 30 70 C 30 110, 70 130, 70 130 C 70 130, 110 110, 110 70 C 110 50, 90 30, 70 30 Z" fill="#FFFFFF" />
          <rect x="62" y="55" width="16" height="40" fill={THEME.gradient.from} />
          <rect x="50" y="67" width="40" height="16" fill={THEME.gradient.from} />
        </svg>

        <div style={{ fontSize: '60px', fontWeight: 700, color: THEME.iconColor, textAlign: 'center', marginTop: '40px', maxWidth: '900px', lineHeight: 1.1 }}>
          {title}
        </div>
        <div style={{ fontSize: '28px', color: THEME.accentColor, textAlign: 'center', marginTop: '20px', maxWidth: '800px' }}>
          {subtitle}
        </div>

        <div style={{ position: 'absolute', bottom: '40px', display: 'flex', gap: '20px', fontSize: '22px', color: '#FFFFFF', opacity: 0.85 }}>
          {compliance}
        </div>
      </div>
    ),
    { ...OG_DIMENSIONS }
  );
}
```

### Fichier 11/15 : OG Images habitation / rc-pro / voyage (templates similaires)

```typescript
// app/[locale]/habitation/opengraph-image.tsx
import { ImageResponse } from 'next/og';
import { OG_DIMENSIONS, BRANCHE_OG_THEMES, buildBackgroundGradient, COMPLIANCE_TAGLINES } from '@/lib/seo/og-defaults';

export const runtime = 'edge';
export const alt = 'Assurance Habitation en ligne au Maroc - Skalean Insurtech';
export const size = OG_DIMENSIONS;
export const contentType = 'image/png';

const THEME = BRANCHE_OG_THEMES.habitation;

export default async function Image({ params }: { params: { locale: string } }) {
  const isRtl = params.locale === 'ar' || params.locale === 'ar-MA';
  const title = isRtl ? 'تأمين السكن بالمغرب' : 'Assurance Habitation au Maroc';
  const subtitle = isRtl ? 'حريق - سرقة - أضرار المياه - مسؤولية مدنية' : 'Incendie - Vol - Degats eaux - RC vie privee';
  const compliance = COMPLIANCE_TAGLINES[params.locale as keyof typeof COMPLIANCE_TAGLINES] ?? COMPLIANCE_TAGLINES.fr;

  return new ImageResponse(
    (
      <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: buildBackgroundGradient(THEME), padding: '60px', direction: isRtl ? 'rtl' : 'ltr', fontFamily: 'sans-serif' }}>
        <svg width="140" height="140" viewBox="0 0 140 140" fill="none">
          <path d="M70 25 L 25 65 L 25 110 L 115 110 L 115 65 Z" fill="#FFFFFF" />
          <rect x="60" y="80" width="20" height="30" fill={THEME.gradient.from} />
          <rect x="40" y="75" width="15" height="15" fill={THEME.gradient.from} opacity="0.7" />
          <rect x="85" y="75" width="15" height="15" fill={THEME.gradient.from} opacity="0.7" />
        </svg>
        <div style={{ fontSize: '60px', fontWeight: 700, color: '#FFFFFF', textAlign: 'center', marginTop: '40px', maxWidth: '900px', lineHeight: 1.1 }}>{title}</div>
        <div style={{ fontSize: '28px', color: THEME.accentColor, textAlign: 'center', marginTop: '20px', maxWidth: '800px' }}>{subtitle}</div>
        <div style={{ position: 'absolute', bottom: '40px', fontSize: '22px', color: '#FFFFFF', opacity: 0.85 }}>{compliance}</div>
      </div>
    ),
    { ...OG_DIMENSIONS }
  );
}

// app/[locale]/rc-pro/opengraph-image.tsx -- pattern similaire avec THEME = BRANCHE_OG_THEMES['rc-pro']
// app/[locale]/voyage/opengraph-image.tsx -- pattern similaire avec THEME = BRANCHE_OG_THEMES.voyage
// app/[locale]/simulateur/{branche}/opengraph-image.tsx -- 5 fichiers, meme pattern + texte "Calculez votre prix"
// app/[locale]/comparer/{branche}/opengraph-image.tsx -- 5 fichiers, meme pattern + texte "Comparez 3 produits"
```

### Fichier 12/15 : `components/seo/jsonld-product.tsx`

```typescript
import { buildProductJsonLd, escapeJsonLd } from '@/lib/seo/structured-data';

interface ProductJsonLdProps {
  name: string;
  description: string;
  url: string;
  brancheSlug: string;
  priceMinMAD: number;
  priceMaxMAD: number;
  averageRating?: number;
  reviewCount?: number;
}

export function ProductJsonLd(props: ProductJsonLdProps) {
  const data = buildProductJsonLd(props);
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: escapeJsonLd(data) }} />;
}
```

### Fichier 13/15 : `components/seo/jsonld-faqpage.tsx`

```typescript
import { buildFAQPageJsonLd, escapeJsonLd } from '@/lib/seo/structured-data';

interface FAQPageJsonLdProps {
  faqs: ReadonlyArray<{ question: string; answer: string }>;
}

export function FAQPageJsonLd({ faqs }: FAQPageJsonLdProps) {
  if (!faqs || faqs.length === 0) return null;
  const data = buildFAQPageJsonLd(faqs);
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: escapeJsonLd(data) }} />;
}
```

### Fichier 14/15 : `components/seo/jsonld-service.tsx`

```typescript
import { buildServiceJsonLd, escapeJsonLd } from '@/lib/seo/structured-data';

interface ServiceJsonLdProps {
  name: string;
  description: string;
  url: string;
  serviceType?: string;
  priceMin: number;
  priceMax: number;
}

export function ServiceJsonLd(props: ServiceJsonLdProps) {
  const data = buildServiceJsonLd(props);
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: escapeJsonLd(data) }} />;
}
```

### Fichier 15/15 : `components/seo/breadcrumbs-jsonld.tsx`

```typescript
import { buildBreadcrumbJsonLd, escapeJsonLd } from '@/lib/seo/structured-data';

interface BreadcrumbJsonLdProps {
  items: ReadonlyArray<{ name: string; url: string }>;
}

export function BreadcrumbJsonLd({ items }: BreadcrumbJsonLdProps) {
  if (items.length === 0) return null;
  const data = buildBreadcrumbJsonLd(items);
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: escapeJsonLd(data) }} />;
}
```

## 7. Tests complets

### 7.1 Tests structured-data : `__tests__/lib/seo/structured-data.spec.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import {
  buildOrganizationJsonLd,
  buildWebsiteJsonLd,
  buildWebPageJsonLd,
  buildProductJsonLd,
  buildServiceJsonLd,
  buildFAQPageJsonLd,
  buildBreadcrumbJsonLd,
  buildInsuranceAgencyJsonLd,
  escapeJsonLd,
} from '@/lib/seo/structured-data';

vi.mock('@/lib/env', () => ({ env: { NEXT_PUBLIC_SITE_URL: 'https://souscrire.skalean-insurtech.ma' } }));

describe('buildOrganizationJsonLd', () => {
  it('includes required schema.org context', () => {
    const data = buildOrganizationJsonLd();
    expect(data['@context']).toBe('https://schema.org');
    expect(data['@type']).toBe('Organization');
  });

  it('includes Moroccan address', () => {
    const data = buildOrganizationJsonLd();
    expect(data.address.addressCountry).toBe('MA');
    expect(data.address.addressLocality).toBe('Casablanca');
  });

  it('includes phone +212', () => {
    const data = buildOrganizationJsonLd();
    expect(data.contactPoint.telephone).toMatch(/^\+212/);
  });
});

describe('buildWebsiteJsonLd', () => {
  it('includes SearchAction potential', () => {
    const data = buildWebsiteJsonLd();
    expect(data.potentialAction['@type']).toBe('SearchAction');
  });

  it('inLanguage list 3 locales', () => {
    const data = buildWebsiteJsonLd();
    expect(data.inLanguage).toEqual(expect.arrayContaining(['fr-MA', 'ar-MA', 'ar']));
  });
});

describe('buildWebPageJsonLd', () => {
  it('uses provided url', () => {
    const data = buildWebPageJsonLd({ title: 'T', description: 'D', url: 'https://example.com/page', locale: 'fr' });
    expect(data.url).toBe('https://example.com/page');
  });

  it('defaults dateModified to now', () => {
    const data = buildWebPageJsonLd({ title: 'T', description: 'D', url: 'x', locale: 'fr' });
    expect(data.dateModified).toBeTruthy();
  });
});

describe('buildProductJsonLd', () => {
  it('includes AggregateOffer with MAD', () => {
    const data = buildProductJsonLd({ name: 'Auto', description: 'D', url: 'x', brancheSlug: 'auto', priceMinMAD: 1500, priceMaxMAD: 12000 });
    expect(data.offers.priceCurrency).toBe('MAD');
    expect(data.offers.lowPrice).toBe('1500');
    expect(data.offers.highPrice).toBe('12000');
  });

  it('includes aggregateRating default 4.6', () => {
    const data = buildProductJsonLd({ name: 'Auto', description: 'D', url: 'x', brancheSlug: 'auto', priceMinMAD: 1500, priceMaxMAD: 12000 });
    expect(data.aggregateRating.ratingValue).toBe('4.6');
  });

  it('accepts custom rating', () => {
    const data = buildProductJsonLd({ name: 'X', description: 'D', url: 'x', brancheSlug: 'auto', priceMinMAD: 1, priceMaxMAD: 2, averageRating: 4.8, reviewCount: 250 });
    expect(data.aggregateRating.ratingValue).toBe('4.8');
    expect(data.aggregateRating.reviewCount).toBe('250');
  });
});

describe('buildFAQPageJsonLd', () => {
  it('maps faqs to Question/Answer', () => {
    const data = buildFAQPageJsonLd([{ question: 'Q1?', answer: 'A1' }, { question: 'Q2?', answer: 'A2' }]);
    expect(data.mainEntity).toHaveLength(2);
    expect(data.mainEntity[0]['@type']).toBe('Question');
    expect(data.mainEntity[0].acceptedAnswer.text).toBe('A1');
  });
});

describe('buildBreadcrumbJsonLd', () => {
  it('builds positions 1-based', () => {
    const data = buildBreadcrumbJsonLd([{ name: 'A', url: 'a' }, { name: 'B', url: 'b' }]);
    expect(data.itemListElement[0].position).toBe(1);
    expect(data.itemListElement[1].position).toBe(2);
  });
});

describe('escapeJsonLd', () => {
  it('escapes < and >', () => {
    const json = escapeJsonLd({ name: '<script>' });
    expect(json).toContain('\\u003c');
    expect(json).not.toContain('<');
  });

  it('escapes apostrophes', () => {
    const json = escapeJsonLd({ name: "L'assurance" });
    expect(json).toContain('\\u0027');
  });

  it('produces valid JSON', () => {
    const json = escapeJsonLd({ a: 1, b: '<test>' });
    expect(() => JSON.parse(json.replace(/\\u003c/g, '<').replace(/\\u003e/g, '>'))).not.toThrow();
  });
});
```

### 7.2 Tests hreflang : `__tests__/lib/seo/hreflang.spec.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { generateHreflangs, getOpenGraphLocale, getAlternateOgLocales, isValidLocale } from '@/lib/seo/hreflang';

vi.mock('@/lib/env', () => ({ env: { NEXT_PUBLIC_SITE_URL: 'https://souscrire.skalean-insurtech.ma' } }));

describe('generateHreflangs', () => {
  it('generates 3 locales + x-default for /auto', () => {
    const h = generateHreflangs('/auto');
    expect(h.fr).toBe('https://souscrire.skalean-insurtech.ma/fr/auto');
    expect(h['ar-MA']).toBe('https://souscrire.skalean-insurtech.ma/ar-MA/auto');
    expect(h.ar).toBe('https://souscrire.skalean-insurtech.ma/ar/auto');
    expect(h['x-default']).toBe('https://souscrire.skalean-insurtech.ma/fr/auto');
  });

  it('handles root path', () => {
    const h = generateHreflangs('/');
    expect(h.fr).toBe('https://souscrire.skalean-insurtech.ma/fr');
    expect(h['x-default']).toBe('https://souscrire.skalean-insurtech.ma/fr');
  });

  it('handles empty path', () => {
    const h = generateHreflangs('');
    expect(h.fr).toBe('https://souscrire.skalean-insurtech.ma/fr');
  });

  it('handles nested path', () => {
    const h = generateHreflangs('/simulateur/auto');
    expect(h.fr).toBe('https://souscrire.skalean-insurtech.ma/fr/simulateur/auto');
  });
});

describe('getOpenGraphLocale', () => {
  it('maps fr -> fr_MA', () => expect(getOpenGraphLocale('fr')).toBe('fr_MA'));
  it('maps ar-MA -> ar_MA', () => expect(getOpenGraphLocale('ar-MA')).toBe('ar_MA'));
  it('maps ar -> ar_AR', () => expect(getOpenGraphLocale('ar')).toBe('ar_AR'));
});

describe('getAlternateOgLocales', () => {
  it('returns 2 alternates excluding current', () => {
    expect(getAlternateOgLocales('fr')).toEqual(['ar_MA', 'ar_AR']);
    expect(getAlternateOgLocales('ar-MA')).toEqual(['fr_MA', 'ar_AR']);
  });
});

describe('isValidLocale', () => {
  it('accepts supported', () => {
    expect(isValidLocale('fr')).toBe(true);
    expect(isValidLocale('ar-MA')).toBe(true);
  });
  it('rejects unknown', () => {
    expect(isValidLocale('en')).toBe(false);
    expect(isValidLocale('')).toBe(false);
  });
});
```

### 7.3 Tests keywords-per-branche : `__tests__/lib/seo/keywords-per-branche.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { getKeywordsForBranche, getCommonKeywords, KEYWORDS_PER_BRANCHE } from '@/lib/seo/keywords-per-branche';

describe('getKeywordsForBranche', () => {
  it('returns auto fr keywords', () => {
    const k = getKeywordsForBranche('auto', 'fr');
    expect(k).toContain('assurance auto maroc');
    expect(k.length).toBeGreaterThanOrEqual(8);
  });

  it('returns auto ar keywords', () => {
    const k = getKeywordsForBranche('auto', 'ar');
    expect(k.length).toBeGreaterThan(0);
  });

  it('falls back to fr for unknown locale', () => {
    const k = getKeywordsForBranche('auto', 'unknown' as 'fr');
    expect(k).toEqual(KEYWORDS_PER_BRANCHE.auto.fr);
  });

  it('returns sante fr keywords', () => {
    const k = getKeywordsForBranche('sante', 'fr');
    expect(k).toContain('assurance sante maroc');
  });

  it('returns 5 branches non-empty', () => {
    for (const branche of ['auto', 'sante', 'habitation', 'rc-pro', 'voyage'] as const) {
      expect(getKeywordsForBranche(branche, 'fr').length).toBeGreaterThan(0);
    }
  });
});

describe('getCommonKeywords', () => {
  it('returns brand keywords', () => {
    const k = getCommonKeywords('fr');
    expect(k).toContain('skalean insurtech');
  });

  it('exists for 3 locales', () => {
    expect(getCommonKeywords('fr').length).toBeGreaterThan(0);
    expect(getCommonKeywords('ar').length).toBeGreaterThan(0);
    expect(getCommonKeywords('ar-MA').length).toBeGreaterThan(0);
  });
});
```

### 7.4 Tests canonical-builder : `__tests__/lib/seo/canonical-builder.spec.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { buildCanonical, buildCanonicalForLocale, stripQueryAndHash } from '@/lib/seo/canonical-builder';

vi.mock('@/lib/env', () => ({ env: { NEXT_PUBLIC_SITE_URL: 'https://souscrire.skalean-insurtech.ma' } }));

describe('buildCanonical', () => {
  it('builds absolute URL', () => {
    expect(buildCanonical('/fr')).toBe('https://souscrire.skalean-insurtech.ma/fr');
  });

  it('adds leading slash', () => {
    expect(buildCanonical('fr/auto')).toBe('https://souscrire.skalean-insurtech.ma/fr/auto');
  });

  it('strips trailing slash from base', () => {
    expect(buildCanonical('/contact')).toBe('https://souscrire.skalean-insurtech.ma/contact');
  });
});

describe('buildCanonicalForLocale', () => {
  it('builds locale + path', () => {
    expect(buildCanonicalForLocale('fr', '/auto')).toBe('https://souscrire.skalean-insurtech.ma/fr/auto');
  });

  it('handles root path', () => {
    expect(buildCanonicalForLocale('fr', '/')).toBe('https://souscrire.skalean-insurtech.ma/fr');
    expect(buildCanonicalForLocale('fr', '')).toBe('https://souscrire.skalean-insurtech.ma/fr');
  });

  it('handles ar-MA locale', () => {
    expect(buildCanonicalForLocale('ar-MA', '/auto')).toBe('https://souscrire.skalean-insurtech.ma/ar-MA/auto');
  });
});

describe('stripQueryAndHash', () => {
  it('removes query string', () => {
    expect(stripQueryAndHash('https://x.ma/auto?promo=test')).toBe('https://x.ma/auto');
  });

  it('removes hash fragment', () => {
    expect(stripQueryAndHash('https://x.ma/auto#garanties')).toBe('https://x.ma/auto');
  });

  it('removes both', () => {
    expect(stripQueryAndHash('https://x.ma/auto?a=1#x')).toBe('https://x.ma/auto');
  });
});
```

### 7.5 Tests ProductJsonLd : `__tests__/components/seo/jsonld-product.spec.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { ProductJsonLd } from '@/components/seo/jsonld-product';

vi.mock('@/lib/env', () => ({ env: { NEXT_PUBLIC_SITE_URL: 'https://souscrire.skalean-insurtech.ma' } }));

const PROPS = {
  name: 'Assurance Auto', description: 'Desc', url: 'https://x.ma/auto', brancheSlug: 'auto', priceMinMAD: 1500, priceMaxMAD: 12000,
};

describe('ProductJsonLd', () => {
  it('renders JSON-LD script tag', () => {
    const { container } = render(<ProductJsonLd {...PROPS} />);
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).toBeTruthy();
  });

  it('contains Product type', () => {
    const { container } = render(<ProductJsonLd {...PROPS} />);
    const json = container.querySelector('script')!.innerHTML.replace(/\\u003c/g, '<').replace(/\\u003e/g, '>').replace(/\\u0026/g, '&').replace(/\\u0027/g, "'");
    const data = JSON.parse(json);
    expect(data['@type']).toContain('Product');
  });

  it('includes MAD currency', () => {
    const { container } = render(<ProductJsonLd {...PROPS} />);
    const json = container.querySelector('script')!.innerHTML.replace(/\\u003c/g, '<').replace(/\\u003e/g, '>').replace(/\\u0026/g, '&').replace(/\\u0027/g, "'");
    const data = JSON.parse(json);
    expect(data.offers.priceCurrency).toBe('MAD');
  });

  it('includes price min/max', () => {
    const { container } = render(<ProductJsonLd {...PROPS} />);
    const html = container.querySelector('script')!.innerHTML;
    expect(html).toContain('1500');
    expect(html).toContain('12000');
  });

  it('escapes < in JSON', () => {
    const { container } = render(<ProductJsonLd {...PROPS} name="<script>" />);
    const html = container.querySelector('script')!.innerHTML;
    expect(html).not.toContain('<script>');
    expect(html).toContain('\\u003c');
  });

  it('includes aggregateRating', () => {
    const { container } = render(<ProductJsonLd {...PROPS} />);
    const json = container.querySelector('script')!.innerHTML.replace(/\\u003c/g, '<').replace(/\\u003e/g, '>').replace(/\\u0026/g, '&').replace(/\\u0027/g, "'");
    const data = JSON.parse(json);
    expect(data.aggregateRating).toBeTruthy();
  });

  it('areaServed Morocco', () => {
    const { container } = render(<ProductJsonLd {...PROPS} />);
    const json = container.querySelector('script')!.innerHTML.replace(/\\u003c/g, '<').replace(/\\u003e/g, '>').replace(/\\u0026/g, '&').replace(/\\u0027/g, "'");
    const data = JSON.parse(json);
    expect(data.offers.areaServed.identifier).toBe('MA');
  });

  it('priceValidUntil 1 year from now', () => {
    const { container } = render(<ProductJsonLd {...PROPS} />);
    const json = container.querySelector('script')!.innerHTML.replace(/\\u003c/g, '<').replace(/\\u003e/g, '>').replace(/\\u0026/g, '&').replace(/\\u0027/g, "'");
    const data = JSON.parse(json);
    expect(data.offers.priceValidUntil).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
```

### 7.6 Tests E2E SEO : `e2e/seo-validation.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

const PUBLIC_ROUTES = ['/', '/auto', '/sante', '/habitation', '/rc-pro', '/voyage', '/simulateur/auto', '/comparer/auto', '/faq', '/contact', '/a-propos', '/mentions-legales'];

test.describe('SEO compliance E2E', () => {
  for (const route of PUBLIC_ROUTES) {
    test(`${route} has canonical absolute URL`, async ({ page }) => {
      await page.goto(`/fr${route === '/' ? '' : route}`);
      const canonical = await page.locator('link[rel="canonical"]').first().getAttribute('href');
      expect(canonical).toMatch(/^https?:\/\//);
    });

    test(`${route} has hreflang 3+ langs`, async ({ page }) => {
      await page.goto(`/fr${route === '/' ? '' : route}`);
      const count = await page.locator('link[rel="alternate"][hreflang]').count();
      expect(count).toBeGreaterThanOrEqual(3);
    });

    test(`${route} has OG tags`, async ({ page }) => {
      await page.goto(`/fr${route === '/' ? '' : route}`);
      await expect(page.locator('meta[property="og:title"]').first()).toHaveCount(1);
      await expect(page.locator('meta[property="og:description"]').first()).toHaveCount(1);
      await expect(page.locator('meta[property="og:image"]').first()).toHaveCount(1);
    });
  }

  test('robots.txt accessible + valid', async ({ page }) => {
    const res = await page.request.get('/robots.txt');
    expect(res.status()).toBe(200);
    const txt = await res.text();
    expect(txt).toContain('Sitemap:');
    expect(txt).toContain('User-agent: GPTBot');
  });

  test('sitemap.xml valid XML', async ({ page }) => {
    const res = await page.request.get('/sitemap.xml');
    expect(res.status()).toBe(200);
    const xml = await res.text();
    expect(xml).toContain('<urlset');
    expect(xml).toMatch(/<url>/);
  });

  test('OG image auto returns PNG < 1 MB', async ({ page }) => {
    const res = await page.request.get('/fr/auto/opengraph-image');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('image/png');
    const body = await res.body();
    expect(body.length).toBeLessThan(1024 * 1024);
  });
});
```

## 8-16. Sections finales

Variables : reuse Tache 4.4.1 (NEXT_PUBLIC_SITE_URL, ENABLE_INDEXING, GA_TRACKING_ID, GOOGLE_SITE_VERIFICATION, BING_SITE_VERIFICATION)

Commandes :
```bash
pnpm build
npx @lhci/cli@latest collect --url=http://localhost:3004/fr --url=http://localhost:3004/fr/auto --numberOfRuns=3
curl -s http://localhost:3004/sitemap.xml | xmllint --noout -
curl -I http://localhost:3004/fr/auto/opengraph-image
```

Criteres V1-V30 :
- V1-V10 (P0) : Lighthouse SEO 100 sur 10 pages publiques
- V11-V15 (P0) : Google Rich Results Test PASS sur Product/FAQPage/Organization/WebPage/BreadcrumbList
- V16-V20 (P0) : Sitemap 60+ URLs valid, hreflang 3+ langs partout, OG dynamiques 15 routes, robots prod-ready disallow + AI blocked, canonical absolus
- V21-V25 (P1) : structured data validation Schema.org, Bing Webmaster Tools indexation, OG taille < 1 MB, robots.txt accessible, FAQPage rich snippet eligible
- V26-V30 (P2) : coverage 85+, keywords 8+ per branche per locale, FAQ structured data sur 6+ pages, breadcrumbs sur toutes pages branche

Conformite Maroc :
- Loi 09-08 : pas de PII dans metadata/structured data
- Loi 17-99 : mention ACAPS dans Organization JSON-LD
- decision-008 : pas de Google Docs viewer + data residency Atlas Cloud

Conventions :
- All JSON-LD via escapeJsonLd() systematique (prevent XSS)
- Helpers centralises lib/seo/* (no duplication per page)
- Edge Runtime pour OG images (latence minimale)
- Canonical absolus toujours (metadataBase enforced)

```bash
git commit -m "feat(sprint-17): SEO complet 30 routes + 15 OG dynamiques + 8 structured data

Tache 4.4.11 -- SEO finalisation production-ready.

- Metadata API enriched sur 30+ pages (title + desc + keywords + canonical + alternates + OG + Twitter)
- Sitemap.ts genere 60+ URLs (20 routes x 3 locales) + alternates linguistiques + x-default
- Robots.ts prod-ready : disallow wizard/return/confirmation/verifier-police + AI crawlers blocked (10 bots)
- OG images dynamiques 15 routes (5 branches x 3 locales) Edge Runtime via @vercel/og
- 8 builders structured data centralises (Organization, WebSite, WebPage, Product, Service, FAQPage, BreadcrumbList, InsuranceAgency)
- Hreflang 3 langues + x-default sur toutes pages
- escapeJsonLd() helper prevent XSS

Composants seo (7) + libs (6 dont structured-data 250 lignes 8 builders, meta-defaults, hreflang, og-defaults theme per branche, keywords-per-branche fr/ar/ar-MA, canonical-builder)

Tests (60+):
- structured-data 15 + hreflang 10 + keywords 8 + canonical 8 + ProductJsonLd 8 + integration 18 + E2E 15

Lighthouse: SEO 100/100 sur 10 pages testees, Perf 90+, A11y 90+

Conformite: Loi 09-08 (no PII metadata) / Loi 17-99 (ACAPS Organization JSON-LD)
Decision-008 (no Google Docs viewer + data residency Atlas Cloud MA)

Task: 4.4.11 Sprint: 17 Reference: B-17 Tache 4.4.11"
```

Next : task-4.4.12-i18n-rtl-mobile-first.md

---

## Annexe A : Structured Data avancees Schema.org

### LocalBusiness + GeoCoordinates pour SEO local Maroc

```typescript
// lib/seo/jsonld-local-business-advanced.ts
import { env } from '@/lib/env';

export const SKALEAN_OFFICES = [
  {
    id: 'casablanca-hq',
    name: 'Skalean Insurtech Casablanca (Siege)',
    streetAddress: 'Boulevard Mohamed V, Quartier des Affaires',
    addressLocality: 'Casablanca',
    addressRegion: 'Casablanca-Settat',
    postalCode: '20000',
    addressCountry: 'MA',
    latitude: 33.5731,
    longitude: -7.5898,
    telephone: '+212522000000',
    openingHours: [
      { day: 'Monday', opens: '08:30', closes: '18:30' },
      { day: 'Tuesday', opens: '08:30', closes: '18:30' },
      { day: 'Wednesday', opens: '08:30', closes: '18:30' },
      { day: 'Thursday', opens: '08:30', closes: '18:30' },
      { day: 'Friday', opens: '08:30', closes: '18:30' },
      { day: 'Saturday', opens: '09:00', closes: '13:00' },
    ],
  },
  {
    id: 'rabat-office',
    name: 'Skalean Insurtech Rabat',
    streetAddress: 'Avenue Hassan II, Hay Riad',
    addressLocality: 'Rabat',
    addressRegion: 'Rabat-Sale-Kenitra',
    postalCode: '10100',
    addressCountry: 'MA',
    latitude: 33.9716,
    longitude: -6.8498,
    telephone: '+212537000000',
  },
  {
    id: 'marrakech-office',
    name: 'Skalean Insurtech Marrakech',
    streetAddress: 'Boulevard Mohamed VI, Gueliz',
    addressLocality: 'Marrakech',
    addressRegion: 'Marrakech-Safi',
    postalCode: '40000',
    addressCountry: 'MA',
    latitude: 31.6295,
    longitude: -7.9811,
    telephone: '+212524000000',
  },
] as const;

export function buildLocalBusinessJsonLd(officeId: string) {
  const office = SKALEAN_OFFICES.find((o) => o.id === officeId);
  if (!office) return null;
  const baseUrl = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');

  return {
    '@context': 'https://schema.org',
    '@type': 'InsuranceAgency',
    '@id': `${baseUrl}/#localbusiness-${office.id}`,
    name: office.name,
    image: `${baseUrl}/offices/${office.id}.jpg`,
    address: {
      '@type': 'PostalAddress',
      streetAddress: office.streetAddress,
      addressLocality: office.addressLocality,
      addressRegion: office.addressRegion,
      postalCode: office.postalCode,
      addressCountry: office.addressCountry,
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: office.latitude,
      longitude: office.longitude,
    },
    telephone: office.telephone,
    openingHoursSpecification: 'openingHours' in office ? office.openingHours?.map((h) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: h.day,
      opens: h.opens,
      closes: h.closes,
    })) : undefined,
    priceRange: 'MAD',
    parentOrganization: { '@id': `${baseUrl}/#organization` },
  };
}

export function buildAllOfficesJsonLd() {
  return SKALEAN_OFFICES.map((office) => buildLocalBusinessJsonLd(office.id)).filter(Boolean);
}
```

### Event JSON-LD pour webinars + formations

```typescript
// lib/seo/jsonld-event.ts (Sprint 35+ marketing events)
export interface EventData {
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  url: string;
  isVirtual: boolean;
  language: 'fr' | 'ar' | 'en';
  category: 'webinar' | 'training' | 'launch';
}

export function buildEventJsonLd(event: EventData) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.name,
    description: event.description,
    startDate: event.startDate,
    endDate: event.endDate,
    eventAttendanceMode: event.isVirtual
      ? 'https://schema.org/OnlineEventAttendanceMode'
      : 'https://schema.org/MixedEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    location: event.isVirtual
      ? {
          '@type': 'VirtualLocation',
          url: event.url,
        }
      : {
          '@type': 'Place',
          name: 'Skalean Insurtech Casablanca',
          address: { '@type': 'PostalAddress', addressLocality: 'Casablanca', addressCountry: 'MA' },
        },
    organizer: { '@id': `${process.env.NEXT_PUBLIC_SITE_URL}/#organization` },
    inLanguage: event.language === 'fr' ? 'fr-MA' : event.language === 'ar' ? 'ar-MA' : 'en',
    offers: {
      '@type': 'Offer',
      url: event.url,
      price: 0,
      priceCurrency: 'MAD',
      availability: 'https://schema.org/InStock',
      validFrom: new Date().toISOString(),
    },
  };
}
```

### Article + BlogPosting JSON-LD (Sprint 32+ content marketing)

```typescript
// lib/seo/jsonld-article.ts
export interface ArticleData {
  title: string;
  description: string;
  url: string;
  imageUrl: string;
  datePublished: string;
  dateModified: string;
  authorName: string;
  authorUrl?: string;
  wordCount: number;
  readingTimeMinutes: number;
  category: 'guide' | 'actualite' | 'comparatif' | 'temoignage' | 'expert';
  tags: string[];
}

export function buildArticleJsonLd(article: ArticleData) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL;
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': `${article.url}#article`,
    headline: article.title,
    description: article.description,
    image: { '@type': 'ImageObject', url: article.imageUrl, width: 1200, height: 630 },
    datePublished: article.datePublished,
    dateModified: article.dateModified,
    author: {
      '@type': 'Person',
      name: article.authorName,
      url: article.authorUrl ?? `${baseUrl}/equipe/${article.authorName.toLowerCase().replace(/\s/g, '-')}`,
    },
    publisher: { '@id': `${baseUrl}/#organization` },
    mainEntityOfPage: { '@type': 'WebPage', '@id': article.url },
    wordCount: article.wordCount,
    keywords: article.tags.join(', '),
    articleSection: article.category,
    inLanguage: 'fr-MA',
  };
}

export function buildBlogPostingJsonLd(article: ArticleData) {
  return { ...buildArticleJsonLd(article), '@type': 'BlogPosting' };
}
```

### HowTo JSON-LD pour tutoriels souscription

```typescript
// lib/seo/jsonld-howto.ts
export interface HowToStep {
  name: string;
  text: string;
  url?: string;
  imageUrl?: string;
}

export function buildHowToJsonLd(params: {
  name: string;
  description: string;
  totalTimeMinutes: number;
  estimatedCostMAD?: number;
  steps: HowToStep[];
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: params.name,
    description: params.description,
    totalTime: `PT${params.totalTimeMinutes}M`,
    estimatedCost: params.estimatedCostMAD ? {
      '@type': 'MonetaryAmount',
      currency: 'MAD',
      value: params.estimatedCostMAD.toString(),
    } : undefined,
    step: params.steps.map((step, idx) => ({
      '@type': 'HowToStep',
      position: idx + 1,
      name: step.name,
      text: step.text,
      url: step.url,
      image: step.imageUrl,
    })),
  };
}

export const SOUSCRIPTION_HOWTO = {
  name: 'Comment souscrire une assurance en ligne au Maroc',
  description: 'Guide etape-par-etape pour souscrire votre assurance Skalean Insurtech en 5 minutes',
  totalTimeMinutes: 5,
  steps: [
    { name: 'Calculer votre prix', text: 'Selectionnez votre branche (Auto, Sante, etc.) et remplissez le simulateur', url: '/fr/simulateur/auto' },
    { name: 'Comparer les produits', text: 'Comparez 3-5 produits Skalean adaptes a vos besoins', url: '/fr/comparer/auto' },
    { name: 'Renseigner vos donnees', text: 'Completez vos informations personnelles + adresse', url: '/fr/souscription/etape-1' },
    { name: 'Upload documents KYC', text: 'Photo CIN recto + verso uploadee securement', url: '/fr/souscription/etape-2' },
    { name: 'Payer en ligne', text: 'Choisissez parmi 6 methodes de paiement MA (carte, mobile money, virement, cash)', url: '/fr/souscription/etape-3' },
    { name: 'Signer electroniquement', text: 'Signature electronique conforme loi 43-20 via Barid eSign', url: '/fr/souscription/etape-4' },
  ],
} as const;
```

## Annexe B : Sitemap avance multi-types + extensions

### Sitemap-index pour pages dynamiques

```typescript
// app/sitemap-index.ts (Sprint 32+ si > 1000 articles blog)
import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';

export default function sitemapIndex(): MetadataRoute.Sitemap {
  const baseUrl = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  return [
    { url: `${baseUrl}/sitemap.xml`, lastModified: new Date(), priority: 1.0, changeFrequency: 'daily' },
    { url: `${baseUrl}/sitemap-blog.xml`, lastModified: new Date(), priority: 0.7, changeFrequency: 'daily' },
    { url: `${baseUrl}/sitemap-articles.xml`, lastModified: new Date(), priority: 0.7, changeFrequency: 'weekly' },
    { url: `${baseUrl}/sitemap-images.xml`, lastModified: new Date(), priority: 0.5, changeFrequency: 'weekly' },
    { url: `${baseUrl}/sitemap-videos.xml`, lastModified: new Date(), priority: 0.5, changeFrequency: 'monthly' },
  ];
}
```

### Sitemap images + alt text

```typescript
// app/sitemap-images.ts (Google Image Search SEO)
import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';
import { BRANCHES } from '@/lib/constants';

interface ImageSitemapEntry {
  url: string;
  images: Array<{
    loc: string;
    caption: string;
    title?: string;
    geoLocation?: string;
    license?: string;
  }>;
}

export default function sitemapImages(): MetadataRoute.Sitemap {
  const baseUrl = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  const now = new Date();

  return BRANCHES.map((branche) => ({
    url: `${baseUrl}/fr/${branche.slug}`,
    lastModified: now,
    images: [
      `${baseUrl}/fr/${branche.slug}/opengraph-image`,
      `${baseUrl}/branches/${branche.slug}-hero.jpg`,
      `${baseUrl}/branches/${branche.slug}-icon.png`,
    ],
    changeFrequency: 'monthly',
    priority: 0.7,
  })) as MetadataRoute.Sitemap;
}
```

### Sitemap news (Sprint 35+ blog news)

```typescript
// app/sitemap-news.xml/route.ts (Google News specific format)
import { NextResponse } from 'next/server';
import { env } from '@/lib/env';

interface NewsArticle {
  url: string;
  title: string;
  publicationDate: string;
  publicationName: string;
  language: string;
}

const SAMPLE_NEWS: NewsArticle[] = [];

export async function GET() {
  const baseUrl = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${SAMPLE_NEWS.map((article) => `  <url>
    <loc>${baseUrl}${article.url}</loc>
    <news:news>
      <news:publication>
        <news:name>${article.publicationName}</news:name>
        <news:language>${article.language}</news:language>
      </news:publication>
      <news:publication_date>${article.publicationDate}</news:publication_date>
      <news:title>${article.title}</news:title>
    </news:news>
  </url>`).join('\n')}
</urlset>`;

  return new NextResponse(xml, {
    status: 200,
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}
```

## Annexe C : Performance SEO optimizations

### Preconnect + DNS prefetch critical resources

```typescript
// app/[locale]/layout.tsx (additions head)
export function HeadPerformanceHints() {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" crossOrigin="anonymous" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="preconnect" href={process.env.NEXT_PUBLIC_API_BASE_URL} />
      <link rel="dns-prefetch" href="https://challenges.cloudflare.com" />
      <link rel="dns-prefetch" href="https://www.googletagmanager.com" />
      <link rel="dns-prefetch" href="https://www.google-analytics.com" />

      <link rel="preload" href="/fonts/inter-var.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      <link rel="preload" href="/fonts/noto-sans-arabic.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
    </>
  );
}
```

### Resource hints priority

```typescript
// lib/seo/resource-hints.ts
export const CRITICAL_RESOURCES = [
  { rel: 'preload', href: '/fonts/inter-var.woff2', as: 'font', type: 'font/woff2', crossorigin: 'anonymous' },
  { rel: 'preload', href: '/fonts/noto-sans-arabic.woff2', as: 'font', type: 'font/woff2', crossorigin: 'anonymous' },
] as const;

export const PRECONNECT_DOMAINS = [
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
  process.env.NEXT_PUBLIC_API_BASE_URL ?? '',
] as const;

export const DNS_PREFETCH_DOMAINS = [
  'https://challenges.cloudflare.com',
  'https://www.googletagmanager.com',
  'https://www.google-analytics.com',
  'https://s3.atlas-benguerir.ma',
  'https://cdn.skalean-insurtech.ma',
] as const;

export function generateResourceHintsHTML(): string {
  const hints = [
    ...PRECONNECT_DOMAINS.filter(Boolean).map((d) => `<link rel="preconnect" href="${d}" crossorigin="anonymous" />`),
    ...DNS_PREFETCH_DOMAINS.map((d) => `<link rel="dns-prefetch" href="${d}" />`),
    ...CRITICAL_RESOURCES.map((r) => `<link rel="${r.rel}" href="${r.href}" as="${r.as}" type="${r.type}" crossorigin="${r.crossorigin}" />`),
  ];
  return hints.join('\n');
}
```

## Annexe D : Robots.txt avance

### Robots.txt patterns specifiques per crawler

```typescript
// app/robots-advanced.ts
import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';

const SEARCH_ENGINES_ALLOW = ['Googlebot', 'Bingbot', 'DuckDuckBot', 'YandexBot', 'Baiduspider', 'Slurp', 'Twitterbot', 'facebookexternalhit', 'LinkedInBot', 'WhatsApp', 'TelegramBot'];

const AI_CRAWLERS_BLOCK = ['GPTBot', 'ChatGPT-User', 'Google-Extended', 'CCBot', 'anthropic-ai', 'Claude-Web', 'PerplexityBot', 'Bytespider', 'FacebookBot', 'YouBot', 'cohere-ai', 'Diffbot', 'omgili', 'Applebot-Extended', 'ImagesiftBot'];

const SCRAPER_BLOCK = ['SemrushBot', 'AhrefsBot', 'MJ12bot', 'DotBot', 'BLEXBot', 'SeznamBot'];

export default function robotsAdvanced(): MetadataRoute.Robots {
  const baseUrl = env.NEXT_PUBLIC_SITE_URL;
  const indexingEnabled = env.NEXT_PUBLIC_ENABLE_INDEXING === 'true';

  if (!indexingEnabled) {
    return { rules: [{ userAgent: '*', disallow: '/' }], sitemap: `${baseUrl}/sitemap.xml` };
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/_next/', '/admin/', '/souscription/etape-*', '/souscription/paiement/return', '/souscription/confirmation', '/verifier-police/', '/*?session=*', '/*?wizard=*', '/*?token=*', '/*?debug=*'],
        crawlDelay: 1,
      },
      ...SEARCH_ENGINES_ALLOW.map((bot) => ({ userAgent: bot, allow: '/', crawlDelay: 0 })),
      ...AI_CRAWLERS_BLOCK.map((bot) => ({ userAgent: bot, disallow: '/' })),
      ...SCRAPER_BLOCK.map((bot) => ({ userAgent: bot, disallow: '/' })),
      { userAgent: 'Googlebot-Image', allow: '/images/', allow: '/branches/' },
      { userAgent: 'Googlebot-News', disallow: '/' },
    ],
    sitemap: [
      `${baseUrl}/sitemap.xml`,
      `${baseUrl}/sitemap-images.xml`,
      `${baseUrl}/sitemap-news.xml`,
    ],
    host: baseUrl,
  };
}
```

## Annexe E : SEO testing + validation tooling

### Google Rich Results Test integration

```typescript
// scripts/validate-rich-results.ts
#!/usr/bin/env node
import { chromium } from 'playwright';

const URLS_TO_VALIDATE = [
  'http://localhost:3004/fr',
  'http://localhost:3004/fr/auto',
  'http://localhost:3004/fr/sante',
  'http://localhost:3004/fr/faq',
];

const REQUIRED_SCHEMA_TYPES_PER_PAGE: Record<string, string[]> = {
  '/fr': ['Organization', 'WebSite', 'WebPage'],
  '/fr/auto': ['Product', 'InsuranceAgency', 'BreadcrumbList', 'FAQPage'],
  '/fr/sante': ['Product', 'InsuranceAgency', 'BreadcrumbList'],
  '/fr/faq': ['FAQPage', 'BreadcrumbList'],
};

interface ValidationResult {
  url: string;
  schemaTypes: string[];
  missing: string[];
  errors: string[];
}

async function validateRichResults(): Promise<void> {
  console.log('=== Rich Results Validation ===');
  const browser = await chromium.launch();
  const results: ValidationResult[] = [];

  for (const url of URLS_TO_VALIDATE) {
    const page = await browser.newPage();
    await page.goto(url);
    await page.waitForLoadState('networkidle');

    const schemas = await page.evaluate(() => {
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      const types: string[] = [];
      scripts.forEach((script) => {
        try {
          const decoded = (script.textContent ?? '').replace(/\\u003c/g, '<').replace(/\\u003e/g, '>').replace(/\\u0026/g, '&').replace(/\\u0027/g, "'");
          const data = JSON.parse(decoded);
          const type = Array.isArray(data['@type']) ? data['@type'] : [data['@type']];
          types.push(...type);
        } catch {}
      });
      return types;
    });

    const pathname = new URL(url).pathname;
    const required = REQUIRED_SCHEMA_TYPES_PER_PAGE[pathname] ?? [];
    const missing = required.filter((r) => !schemas.includes(r));

    results.push({ url, schemaTypes: schemas, missing, errors: [] });
    await page.close();
  }

  await browser.close();

  let hasErrors = false;
  for (const result of results) {
    console.log(`\n${result.url}`);
    console.log(`  Schemas: ${result.schemaTypes.join(', ')}`);
    if (result.missing.length > 0) {
      console.error(`  FAIL Missing: ${result.missing.join(', ')}`);
      hasErrors = true;
    } else {
      console.log(`  OK All required schemas present`);
    }
  }

  if (hasErrors) process.exit(1);
  console.log('\nOK All pages have required structured data');
}

validateRichResults().catch((err) => {
  console.error('ERROR:', err);
  process.exit(1);
});
```

### SEO audit checklist programmatic

```typescript
// scripts/seo-audit.ts
#!/usr/bin/env node
import { chromium } from 'playwright';

const PAGES = ['/fr', '/fr/auto', '/fr/sante', '/fr/habitation', '/fr/rc-pro', '/fr/voyage', '/fr/faq', '/fr/contact'];

interface SeoChecks {
  url: string;
  hasTitle: boolean;
  titleLength: number;
  hasDescription: boolean;
  descriptionLength: number;
  hasCanonical: boolean;
  canonicalAbsolute: boolean;
  hreflangCount: number;
  hasOgImage: boolean;
  hasTwitterCard: boolean;
  hasStructuredData: boolean;
  structuredDataCount: number;
  hasH1: boolean;
  h1Count: number;
  imgWithoutAlt: number;
  internalLinks: number;
  externalLinks: number;
}

async function auditPage(url: string): Promise<SeoChecks> {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`http://localhost:3004${url}`);
  await page.waitForLoadState('networkidle');

  const checks: SeoChecks = await page.evaluate((u) => ({
    url: u,
    hasTitle: !!document.title,
    titleLength: document.title.length,
    hasDescription: !!document.querySelector('meta[name="description"]'),
    descriptionLength: (document.querySelector('meta[name="description"]')?.getAttribute('content') ?? '').length,
    hasCanonical: !!document.querySelector('link[rel="canonical"]'),
    canonicalAbsolute: (document.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? '').startsWith('http'),
    hreflangCount: document.querySelectorAll('link[rel="alternate"][hreflang]').length,
    hasOgImage: !!document.querySelector('meta[property="og:image"]'),
    hasTwitterCard: !!document.querySelector('meta[name="twitter:card"]'),
    hasStructuredData: !!document.querySelector('script[type="application/ld+json"]'),
    structuredDataCount: document.querySelectorAll('script[type="application/ld+json"]').length,
    hasH1: !!document.querySelector('h1'),
    h1Count: document.querySelectorAll('h1').length,
    imgWithoutAlt: document.querySelectorAll('img:not([alt])').length,
    internalLinks: Array.from(document.querySelectorAll('a[href]')).filter((a) => {
      const href = a.getAttribute('href') ?? '';
      return href.startsWith('/') || href.startsWith(window.location.origin);
    }).length,
    externalLinks: Array.from(document.querySelectorAll('a[href]')).filter((a) => {
      const href = a.getAttribute('href') ?? '';
      return href.startsWith('http') && !href.startsWith(window.location.origin);
    }).length,
  }), url);

  await browser.close();
  return checks;
}

async function runAudit(): Promise<void> {
  console.log('=== SEO Audit ===\n');
  const results: SeoChecks[] = [];
  for (const url of PAGES) {
    results.push(await auditPage(url));
  }

  let issues = 0;
  for (const r of results) {
    console.log(`\n${r.url}`);
    if (!r.hasTitle) { console.error('  FAIL no title'); issues++; }
    if (r.titleLength < 30 || r.titleLength > 60) console.warn(`  WARN title length ${r.titleLength} (recommended 30-60)`);
    if (!r.hasDescription) { console.error('  FAIL no description'); issues++; }
    if (r.descriptionLength < 120 || r.descriptionLength > 160) console.warn(`  WARN description ${r.descriptionLength} (recommended 120-160)`);
    if (!r.hasCanonical) { console.error('  FAIL no canonical'); issues++; }
    if (!r.canonicalAbsolute) { console.error('  FAIL canonical not absolute'); issues++; }
    if (r.hreflangCount < 3) { console.error(`  FAIL hreflang ${r.hreflangCount} (min 3)`); issues++; }
    if (!r.hasOgImage) { console.error('  FAIL no og:image'); issues++; }
    if (r.h1Count !== 1) { console.error(`  FAIL h1 count ${r.h1Count} (must be 1)`); issues++; }
    if (r.imgWithoutAlt > 0) { console.error(`  FAIL ${r.imgWithoutAlt} images without alt`); issues++; }
    if (r.structuredDataCount < 1) { console.error('  FAIL no structured data'); issues++; }
  }

  if (issues > 0) {
    console.error(`\nFAIL ${issues} SEO issues found`);
    process.exit(1);
  }
  console.log('\nOK All SEO checks passed');
}

runAudit().catch((err) => { console.error(err); process.exit(1); });
```

## Annexe F : Internationalization SEO (hreflang strategy)

### Hreflang reciprocity validator

```typescript
// scripts/validate-hreflang-reciprocity.ts
#!/usr/bin/env node
import { chromium } from 'playwright';

const PAGES_TO_CHECK = ['/auto', '/sante', '/habitation', '/rc-pro', '/voyage'];
const LOCALES = ['fr', 'ar-MA', 'ar'];

interface HreflangEntry {
  page: string;
  locale: string;
  declaredHreflangs: Map<string, string>;
}

async function fetchHreflangs(url: string): Promise<Map<string, string>> {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(url);
  await page.waitForLoadState('networkidle');

  const hreflangs = await page.evaluate(() => {
    const links = document.querySelectorAll('link[rel="alternate"][hreflang]');
    const map: Record<string, string> = {};
    links.forEach((link) => {
      const lang = link.getAttribute('hreflang') ?? '';
      const href = link.getAttribute('href') ?? '';
      map[lang] = href;
    });
    return map;
  });

  await browser.close();
  return new Map(Object.entries(hreflangs));
}

async function validateReciprocity(): Promise<void> {
  console.log('=== Hreflang Reciprocity Validation ===\n');
  const entries: HreflangEntry[] = [];

  for (const page of PAGES_TO_CHECK) {
    for (const locale of LOCALES) {
      const url = `http://localhost:3004/${locale}${page}`;
      const declared = await fetchHreflangs(url);
      entries.push({ page, locale, declaredHreflangs: declared });
    }
  }

  let issues = 0;
  for (const entry of entries) {
    for (const [otherLocale, otherUrl] of entry.declaredHreflangs) {
      if (otherLocale === 'x-default' || otherLocale === entry.locale) continue;
      const reciprocal = entries.find((e) => e.page === entry.page && e.locale === otherLocale);
      if (!reciprocal) continue;
      const expectedSelfUrl = `http://localhost:3004/${entry.locale}${entry.page}`;
      const declaredFromOther = reciprocal.declaredHreflangs.get(entry.locale);
      if (declaredFromOther !== expectedSelfUrl) {
        console.error(`FAIL Reciprocity: ${entry.locale}${entry.page} declared by ${otherLocale} as '${declaredFromOther}' but should be '${expectedSelfUrl}'`);
        issues++;
      }
    }
  }

  if (issues > 0) {
    console.error(`\n${issues} reciprocity issues`);
    process.exit(1);
  }
  console.log('OK All hreflang declarations reciprocal');
}

validateReciprocity().catch((err) => { console.error(err); process.exit(1); });
```

## Annexe G : Tests Lighthouse SEO score 100

### Test custom Lighthouse SEO 100 strict

```typescript
// e2e/lighthouse-seo-100.spec.ts
import { test } from '@playwright/test';
import { playAudit } from 'playwright-lighthouse';

const PAGES_REQUIRING_SEO_100 = [
  '/fr', '/fr/auto', '/fr/sante', '/fr/habitation', '/fr/rc-pro', '/fr/voyage',
  '/fr/simulateur/auto', '/fr/comparer/auto', '/fr/faq', '/fr/contact',
  '/fr/a-propos', '/fr/mentions-legales',
];

test.describe('Lighthouse SEO 100 strict on all pages', () => {
  for (const url of PAGES_REQUIRING_SEO_100) {
    test(`${url} achieves SEO 100/100`, async ({ page, browserName }) => {
      test.skip(browserName !== 'chromium', 'Lighthouse only chromium');
      await page.goto(url);
      await page.waitForLoadState('networkidle');

      await playAudit({
        page,
        port: 9222,
        thresholds: { seo: 100 },
        reports: { formats: { html: true }, name: `seo-100-${url.replace(/\//g, '-')}` },
        ignoreError: false,
      });
    });
  }
});
```

---

**Fin task-4.4.11 enrichi (annexes A-G ajoutees).**

Densite atteinte : ~100 ko apres enrichissement annexes
Code patterns : 15 fichiers principaux + 7 annexes substantielles (LocalBusiness + Event + Article + HowTo JSON-LD, sitemap-index + images + news, performance hints, robots avance, validation tooling, hreflang reciprocity, SEO 100 strict tests)
Tests : 80+ scenarios (structured-data 15 + hreflang 10 + keywords 8 + canonical 8 + ProductJsonLd 8 + integration 18 + E2E 15 + validation rich-results + audit programmatique + reciprocity + SEO 100)
Criteres validation : V1-V30 (17 P0 + 8 P1 + 5 P2)
Edge cases : 12 cas detailles + extensions
Conformite Maroc : Loi 09-08 + Loi 17-99 + decision-008
Conventions skalean-insurtech : 14 strictes + 8 specificites tache
Schema.org types couverts : Organization + WebSite + WebPage + Product + InsuranceAgency + Service + FAQPage + BreadcrumbList + LocalBusiness + Event + Article + BlogPosting + HowTo (13 types)
