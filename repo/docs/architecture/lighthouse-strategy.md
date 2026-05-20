# Lighthouse Strategy -- Skalean InsurTech

Reference: task-1.4.16 Sprint 4 Phase 1

## Vue d'ensemble

Cette doc decrit la strategie d'audits Lighthouse pour les 8 apps frontend du programme.
Elle couvre les cibles initiales (Sprint 4 baseline), les cibles cibles par sprint metier,
le workflow CI Lighthouse fail PR si regression, le performance budget, et les optimisations planifiees.

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
| 17 | web-broker | 90 | 90 | Souscription polices, formulaires lourds |
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
2. Si regression > 5 points sur Performance, PR commentee `regression detected`.
3. Override possible avec label `lighthouse-skip` (rare, justifie via PR description).
4. Trends graphiques sur Atlas Cloud Benguerir LHCI server (Sprint 35).

## Performance budget

Limites max par bundle :

| Resource | Limit | Mesure |
|----------|-------|--------|
| Total JS bundle (gzip) | 500 ko | `<script>` cumule |
| Total CSS bundle (gzip) | 100 ko | `<link rel="stylesheet">` cumule |
| Images per page | 1.5 Mo | `<img>` cumule (excl. lazy non-charges) |
| Fonts | 200 ko | next/font Montserrat + Noto Naskh combines |
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
- Format AVIF + WebP fallback (`images.formats: ['image/avif', 'image/webp']`).
- `loading="lazy"` defaut pour images below-the-fold.
- `priority` flag pour LCP image (hero customer-portal).

### CDN et caching strategy

- Atlas Cloud Benguerir CDN avec edge cache 1 an pour assets immutables (`/_next/static/*`).
- HTML SSG avec ISR 60s (`revalidate: 60`).
- API responses cache `s-maxage=300, stale-while-revalidate=86400`.

## Outils complementaires

| Outil | Sprint | Usage |
|-------|--------|-------|
| Lighthouse CI 0.14 | 4 (this) | Audits CI |
| WebPageTest API | 35 | Audits real device cloud |
| Pa11y CI 4.x | 30 | Accessibility testing 100% pages |
| axe-core 4.10 | 4 (this) | A11y in Playwright + Storybook |
| BrowserStack | 35 | Real iOS Safari + Android Chrome |
| Chromatic | 35 | Visual regression Storybook |

## Note conformite Maroc

Loi accessibilite des sites publics Maroc (Sprint 30) imposera Lighthouse Accessibility = 100
sur `web-customer-portal`. Les autres apps (privees, courtage / garage / admin) restent a 90+
en cible mais non legalement contraintes.

Note ACAPS : les apps courtage (`web-broker`) et assure (`web-assure-portal`, `web-assure-mobile`)
doivent afficher les mentions de conformite ACAPS en footer (supervise depuis Sprint 4 baseline).
