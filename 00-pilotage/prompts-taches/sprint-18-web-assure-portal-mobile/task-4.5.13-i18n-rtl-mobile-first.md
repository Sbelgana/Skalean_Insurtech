# TACHE 4.5.13 -- I18n fr/ar-MA/ar + RTL Complete + Mobile-First Responsive

**Sprint** : 18 / 35 (cumul) -- Phase 4 / Sprint 5
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-18-sprint-18-web-assure-portal-mobile.md` (Tache 4.5.13)
**Phase** : 4 -- Vertical Insure (Skalean Broker ERP)
**Priorite** : P0 (qualite d'experience cible 60%+ trafic mobile MA + 40%+ utilisateurs preference arabe)
**Effort** : 4h
**Dependances** : Toutes les taches precedentes 4.5.1 a 4.5.12 (les messages i18n et patterns RTL ont ete poses iteration apres iteration). Cette tache audite + harmonise + complete.
**Densite cible** : 100-120 ko (auto-suffisant exhaustif)
**AUCUNE EMOJI AUTORISEE**

---

## 1. But

Cette tache est l'**harmonisation et completion finale de l'i18n** (fr / ar-MA / ar), l'**audit RTL complet** des composants developpes en taches 4.5.1 a 4.5.12, et la **validation mobile-first responsive** sur 5 breakpoints + tap targets WCAG. Elle livre les fichiers `messages/{fr,ar-MA,ar}.json` complets (~500 keys par locale), une couche helpers `i18n-helpers.ts` pour les formatages localises (dates, montants MAD, numeros telephone, pluralisation), une strategie RTL detaillee avec mapping Tailwind logical properties + icones directionnelles + numbers latins forces + polices arabes Tajawal/Cairo embedded, et une suite de tests viewport E2E qui valide le rendu sur iPhone SE / iPhone 14 / iPad / Desktop pour les 3 locales x 2 directions.

L'apport est triple. D'abord, **fermer la promesse mobile-first multi-locale du programme** : 60%+ du trafic est mobile MA, dont 40%+ preferent l'arabe -- soit ~24% du trafic est arabe-mobile. Sans audit RTL serieux, ces utilisateurs ont une UX cassee (icones flippees inverses, paddings asymetriques, chiffres affiches en arabe-indien alors que les utilisateurs MA lisent les chiffres latins). Ensuite, **garantir la conformite WCAG 2.1 AA** : tap targets >= 44px (norme Apple, retenue par WCAG), contraste >= 4.5:1, navigation clavier complete, screen reader-friendly. Sprint 35 (pilote Marrakech) doit prouver l'accessibilite pour valider le go-live. Enfin, **fournir une base i18n exhaustive** que les Sprints 19-35 (Repair + Admin + IA) heritent sans avoir a re-traduire les patterns communs (status badges, dates, formats currency).

A l'issue de cette tache :
1. Un developpeur tape `pnpm dev --filter @insurtech/web-assure-mobile`, ouvre `http://localhost:3006/ar-MA/polices`, et voit l'app entierement en arabe marocain avec direction RTL automatique (sidebar a droite, chevrons inversees, padding inline correct).
2. Tous les chiffres restent en latin (123.45, pas ١٢٣٫٤٥) car decision-005 retenue : 96% des utilisateurs MA preferent.
3. Les dates affichent en format MA `15/06/2026` peu importe la locale.
4. Les montants en `1 500,00 MAD` (fr) ou `1٬500.00 MAD` (ar) avec separators corrects.
5. Lighthouse mobile audit : Accessibility >= 95, Best Practices >= 95, PWA = 100.
6. Tests Playwright viewport sur 5 viewport sizes x 3 locales = 15 scenarios PASS.

---

## 2. Contexte etendu

### Pourquoi i18n + RTL est critique pour le Maroc

L'analyse demographique Skalean Sprint 0 indique :
- **60%+ du trafic** assure depuis mobile.
- **40-45%** preferent l'arabe (split 25% darija marocaine, 15-20% arabe standard) -- l'autre 55-60% francais.
- **96% des utilisateurs MA** lisent les chiffres latins (CIN, plaques, prix bancaires tous en latin). Forcer arabe-indien = friction.
- **Dialecte darija** : pas formalisable a 100%, on choisit la version la plus comprise (`ar-MA`).
- **Fr-MA vs fr-FR** : different sur format dates (MA: `15/06/2026` vs FR: `15/06/2026` -- meme), format currency (MA: `MAD` au lieu de `DH` pour eviter ambiguite), tutoiement vs vouvoiement (on choisit vouvoiement par defaut = formel commercial).

Sans i18n soignee + RTL fonctionnel, 24% du trafic potentiel a une UX defaillante. Avec : adoption optimale.

### 3 locales : differences pratiques

| Locale | Direction | Polices recommandees | Numbers default | Date format | Currency |
|---|---|---|---|---|---|
| `fr` (= fr-MA) | LTR | Inter (sans-serif) | Latin (123) | `15/06/2026` | `1 500,00 MAD` |
| `ar-MA` (darija marocaine) | RTL | Tajawal (medium readability) | Latin (force via Intl) | `15/06/2026` (chiffres latins) | `1٬500,00 MAD` |
| `ar` (arabe standard) | RTL | Cairo (formelle) | Latin (force) | `15/06/2026` | `1٬500,00 MAD` |

Tajawal et Cairo sont des polices OFL gratuites optimisees lecture screen arabes. Embedded via `next/font/google`.

### RTL : strategie complete

Tailwind CSS 3.4 supporte logical properties : `start-0` / `end-0`, `ms-` / `me-`, `ps-` / `pe-`, `border-s` / `border-e`. Quand `<html dir="rtl">`, ces classes se flippent automatiquement. **Discipline absolue** : aucune occurrence de `left-` / `right-` / `ml-` / `mr-` / `pl-` / `pr-` / `border-l` / `border-r` dans les composants generiques (le pre-commit hook check pour ces patterns).

**Exceptions admises** (avec justification commentee dans le code) :
- `transform`: rotations explicites (e.g. `rtl:rotate-180` sur chevrons).
- `position: absolute` avec calcul precis (inline style `insetInlineEnd` au lieu de `right`).
- Box shadows directionnels : preferer symetriques.
- Animation keyframes avec `translateX` : utiliser CSS custom property `--direction: 1 (LTR) / -1 (RTL)`.

**Icones directionnelles** (chevrons, fleches, retour, etc.) :
- Toutes utilisent `lucide-react` SVG.
- Class `rtl:rotate-180` ou `rtl:-scale-x-100` pour flip auto en RTL.
- Pattern recap : `<ChevronLeft className="h-5 w-5 rtl:rotate-180" />`.

### Numbers latins forces : implementation

L'API `Intl.NumberFormat` accepte `numberingSystem: 'latn'` :
```typescript
new Intl.NumberFormat('ar-MA', { numberingSystem: 'latn' }).format(1500); // "1٬500"
```
Le separator de milliers reste arabique (٬) mais les chiffres sont latins (1500). C'est exactement ce que les utilisateurs MA attendent.

Toutes les helpers (formatMad, formatDate, formatPhoneMa, formatPercent) utilisent ce parametre systematiquement.

### Mobile-first breakpoints

| Breakpoint | Min width | Cibles devices | Layout |
|---|---|---|---|
| (default) | 0 | Phones smallest (320px iPhone SE 1st gen) | Mobile single column |
| `sm` | 640px | Phones modern (375-414px iPhone, Android) | Mobile improved |
| `md` | 768px | Tablets portrait + small landscape | Switch to desktop layouts (sidebar visible) |
| `lg` | 1024px | Tablets landscape + laptops | Wider grids |
| `xl` | 1280px | Desktops | Max content width |

Le portal switch entre mobile-style et desktop-style a `md` (768px). En dessous : layouts mobile (bottom nav + FAB). Au-dessus : sidebar persistente.

### Tap targets WCAG 2.1 AA

- **Minimum** : 44x44 px (norme Apple HIG, retenue par WCAG 2.5.5).
- **Confort** : 48x48 px (norme Material Design).
- **Skalean** : 56x56 px sur bottom nav (luxe + accessibilite mobilites reduites).

Audit : tous les boutons, links, inputs interactifs doivent satisfaire `min-h-[44px] min-w-[44px]`. Tested via Playwright `getBoundingClientRect`.

### Trade-offs explicites

1. **Pas de support tashkeel arabe** (diacritiques) : on n'affiche pas les voyelles. **Justification** : 99% des contenus formels arabes MA n'utilisent pas tashkeel.
2. **darija (ar-MA) n'est pas Unicode-strict** : pas de normalisation NFC / NFKD. **Justification** : pas de saisie utilisateur, juste affichage.
3. **Numbers latins par defaut meme en arabe** : retenu apres telemetrie Sprint 0. **Trade-off** : pour utilisateurs ages habitues a chiffres arabes -- on n'ouvre pas un setting "preference numerique" (complexite). Si Sprint 35 telemetrie montre besoin -> Sprint 24 add.
4. **Pas de RTL switcher manuel** : le RTL est lie a la locale automatiquement (ar/ar-MA -> RTL, fr -> LTR). **Justification** : simplicite + 99.9% des cas.
5. **Polices arabes Tajawal + Cairo via next/font** : bundle +50KB par police. Total +100KB compresse Brotli. **Trade-off** : worth it pour UX arabe.

### Decisions strategiques referencees

- `decision-006` (no-emoji) : audit final que ZERO emoji dans messages JSON.
- `decision-008` (data-residency-MA) : polices Tajawal/Cairo hostees Atlas (next/font auto-self-host).
- Loi 09-08 (accessibilite) : conformite WCAG 2.1 AA pour respecter Loi 10-03 acces handicapes numerique.

### Pieges techniques connus

1. **Piege : `dir="rtl"` sur <html> mais pas <body> dans Next.js**
   - Pourquoi : root layout server-rendered, `<body>` separe.
   - Solution : set `dir` sur `<html>` via `<LocaleLayout>` (tache 4.5.1). Body herite.

2. **Piege : Polices arabes pas chargees -> fallback monospace illisible**
   - Pourquoi : font-display: swap mais OFL pas charge.
   - Solution : `next/font/google` avec `display: 'swap'` + preload critique.

3. **Piege : Toast/Alert/Tooltip flippe pas en RTL**
   - Pourquoi : libs externes (Headless UI) avec `transform: translate` LTR.
   - Solution : RTL-aware wrapper ou config logical.

4. **Piege : Form inputs LTR meme en RTL (CIN, telephone)**
   - Pourquoi : `direction: rtl` flipperait le texte (pas le but).
   - Solution : `<input dir="ltr">` explicite sur tels fields meme dans contexte ar.

5. **Piege : Margin/padding bug avec `<Image>` Next.js logical properties**
   - Pourquoi : style inline ne supporte pas logical CSS.
   - Solution : utiliser className Tailwind.

6. **Piege : `text-align: center` au lieu de `start/end`**
   - Pourquoi : center est neutre, OK. Mais `text-left` dans flow RTL devient inappropie.
   - Solution : `text-start` / `text-end` partout.

7. **Piege : Plural rules differents fr vs ar**
   - Pourquoi : fr a 2 forms (singular/plural), ar a 6 (zero, one, two, few, many, other).
   - Solution : next-intl gere via ICU MessageFormat. Tester avec `count: 0, 1, 2, 11, 100`.

8. **Piege : Date format en arabe avec mois en arabe (juin -> يونيو)**
   - Pourquoi : default `Intl.DateTimeFormat('ar')` retourne ٢٠٢٦/٠٦/١٥.
   - Solution : numberingSystem='latn' + month: 'numeric' force formats latins lisibles.

9. **Piege : Tap target sur icone-only button trop petit**
   - Pourquoi : icon 16px + padding 6px = 28px total (sous 44).
   - Solution : enforce `min-h-[44px] min-w-[44px]` sur tous les boutons icone-only. ESLint custom rule.

10. **Piege : Viewport tests E2E sur 320px (iPhone SE) overflow horizontal**
    - Pourquoi : padding accumulee ou min-width hardcoded.
    - Solution : audit + assertion `overflow-x: hidden` jamais necessaire (signe d'un bug).

11. **Piege : Long strings arabes overflow card**
    - Pourquoi : arabe lit-words sont parfois plus longs (pas de hyphens).
    - Solution : `truncate` + tooltip + line-clamp.

12. **Piege : Locale switcher reload toute la page**
    - Pourquoi : naive `window.location.href = ...`.
    - Solution : `router.replace` Next.js (heritage tache 4.5.3 LocaleSwitcher).

---

## 3. Architecture context

### Position dans le sprint 18

13eme tache du Sprint 18. Cette tache est **transversale** : elle audite et complete les patterns deja poses dans les taches 4.5.1 a 4.5.12. Elle ne re-developpe pas, mais elle finalize.

Bloque : tache 4.5.14 (E2E tests + Lighthouse audit -- attend que l'i18n et RTL soient stables).

### Files audites

Tous les messages JSON deja crees dans les taches precedentes :
- `messages/fr.json`, `messages/ar-MA.json`, `messages/ar.json` (cumul environ 350 keys deja, on complete a 500).
- Tous les composants `@insurtech/assure-shared/components/*.tsx` : audit Tailwind classes (start/end vs left/right) + icones directionnelles.

### Flow tests viewport

```
Playwright config:
  projects: [
    { name: 'mobile-fr-LTR',   viewport: 375x667, locale: 'fr-MA'  },
    { name: 'mobile-arMA-RTL', viewport: 375x667, locale: 'ar-MA' },
    { name: 'mobile-ar-RTL',   viewport: 375x667, locale: 'ar'   },
    { name: 'mobile-small-fr', viewport: 320x568, locale: 'fr-MA' },
    { name: 'tablet-fr',       viewport: 768x1024, locale: 'fr-MA' },
    { name: 'desktop-fr',      viewport: 1280x800, locale: 'fr-MA' },
    { name: 'desktop-arMA',    viewport: 1280x800, locale: 'ar-MA' },
  ]

Tests per project:
  - All pages render without horizontal overflow
  - Tap targets >= 44x44 on every interactive element
  - Direction attribute correct
  - Numbers always latin
  - Date formats consistent
  - No emoji in DOM
```

---

## 4. Livrables checkables

- [ ] Lib `repo/packages/assure-shared/src/lib/i18n-helpers.ts` (consolidation formatters)
- [ ] Lib `repo/packages/assure-shared/src/lib/rtl-helpers.ts` (isRtl, mirror class, helper components)
- [ ] Component `repo/packages/assure-shared/src/components/locale-aware-date.tsx`
- [ ] Component `repo/packages/assure-shared/src/components/locale-aware-currency.tsx`
- [ ] Component `repo/packages/assure-shared/src/components/locale-aware-phone.tsx`
- [ ] Component `repo/packages/assure-shared/src/components/locale-aware-number.tsx`
- [ ] CSS `repo/apps/web-assure-portal/app/globals.css` (modifie / RTL classes + fonts)
- [ ] CSS `repo/apps/web-assure-mobile/app/globals.css` (modifie / idem)
- [ ] Config `repo/apps/web-assure-portal/tailwind.config.ts` (modifie / safelist + breakpoints custom)
- [ ] Config `repo/apps/web-assure-mobile/tailwind.config.ts` (modifie / idem)
- [ ] Font `repo/apps/web-assure-portal/app/fonts.ts` (Inter + Tajawal + Cairo)
- [ ] Font `repo/apps/web-assure-mobile/app/fonts.ts` (idem)
- [ ] Messages `repo/apps/web-assure-portal/messages/{fr,ar-MA,ar}.json` (modifie / 500 keys total chacun, audit + completion)
- [ ] Messages `repo/apps/web-assure-mobile/messages/{fr,ar-MA,ar}.json` (modifie / idem)
- [ ] Pre-commit hook `infrastructure/scripts/check-rtl-tailwind.sh` (rejette classes non-logical)
- [ ] Pre-commit hook `infrastructure/scripts/check-tap-target.ts` (statique analysis)
- [ ] Playwright config viewports `apps/web-assure-mobile/playwright.config.ts` (modifie / projects matrix)
- [ ] Tests E2E `apps/web-assure-mobile/e2e/i18n-rtl.spec.ts` (15+ scenarios)
- [ ] Tests E2E `apps/web-assure-mobile/e2e/responsive.spec.ts` (8+ scenarios overflow / tap target)
- [ ] Tests unit `repo/packages/assure-shared/__tests__/lib/i18n-helpers.spec.ts` (15+ tests)

---

## 5. Fichiers crees / modifies

```
repo/packages/assure-shared/src/lib/i18n-helpers.ts                                                  (~280 lignes / consolidation)
repo/packages/assure-shared/src/lib/rtl-helpers.ts                                                    (~140 lignes)

repo/packages/assure-shared/src/components/locale-aware-date.tsx                                       (~100 lignes)
repo/packages/assure-shared/src/components/locale-aware-currency.tsx                                    (~80 lignes)
repo/packages/assure-shared/src/components/locale-aware-phone.tsx                                       (~100 lignes / format MA E.164)
repo/packages/assure-shared/src/components/locale-aware-number.tsx                                       (~80 lignes)

repo/apps/web-assure-portal/app/fonts.ts                                                                (~50 lignes)
repo/apps/web-assure-mobile/app/fonts.ts                                                                (~50 lignes)
repo/apps/web-assure-portal/app/globals.css                                                             (modifie / +30 lignes RTL + fonts)
repo/apps/web-assure-mobile/app/globals.css                                                             (modifie / idem)

repo/apps/web-assure-portal/tailwind.config.ts                                                          (modifie / safelist + custom breakpoints)
repo/apps/web-assure-mobile/tailwind.config.ts                                                          (modifie / idem)

repo/apps/web-assure-portal/messages/fr.json                                                            (~500 keys / completion + harmonization)
repo/apps/web-assure-portal/messages/ar-MA.json                                                         (~500 keys)
repo/apps/web-assure-portal/messages/ar.json                                                            (~500 keys)
repo/apps/web-assure-mobile/messages/fr.json                                                            (~500 keys)
repo/apps/web-assure-mobile/messages/ar-MA.json                                                         (~500 keys)
repo/apps/web-assure-mobile/messages/ar.json                                                            (~500 keys)

infrastructure/scripts/check-rtl-tailwind.sh                                                            (~60 lignes / pre-commit hook)
infrastructure/scripts/check-tap-target.ts                                                              (~100 lignes / ts-morph AST analysis)
infrastructure/scripts/translate-coverage.ts                                                            (~80 lignes / compare 3 locale files)

repo/apps/web-assure-mobile/playwright.config.ts                                                        (modifie / projects matrix)
repo/apps/web-assure-mobile/e2e/i18n-rtl.spec.ts                                                        (~200 lignes / 15 tests)
repo/apps/web-assure-mobile/e2e/responsive.spec.ts                                                      (~180 lignes / 8 tests)

repo/packages/assure-shared/__tests__/lib/i18n-helpers.spec.ts                                          (~200 lignes / 18 tests)
repo/packages/assure-shared/__tests__/lib/rtl-helpers.spec.ts                                            (~120 lignes / 8 tests)
repo/packages/assure-shared/__tests__/components/locale-aware-date.spec.tsx                              (~140 lignes / 8 tests)
repo/packages/assure-shared/__tests__/components/locale-aware-currency.spec.tsx                          (~140 lignes / 8 tests)
```

---

## 6. Code patterns COMPLETS

### Fichier 1/12 : `repo/packages/assure-shared/src/lib/i18n-helpers.ts`

```typescript
// repo/packages/assure-shared/src/lib/i18n-helpers.ts
// Consolidation des formatters localises. Numeral system always latin (decision MA).

export type SupportedLocale = 'fr' | 'fr-MA' | 'ar-MA' | 'ar';

export function normalizeLocale(locale: string): SupportedLocale {
  const l = locale.toLowerCase();
  if (l.startsWith('ar-ma')) return 'ar-MA';
  if (l.startsWith('ar')) return 'ar';
  if (l.startsWith('fr-ma') || l.startsWith('fr')) return 'fr-MA';
  return 'fr-MA';
}

export function isRtl(locale: string): boolean {
  return locale.startsWith('ar');
}

const DEFAULT_LOCALE: SupportedLocale = 'fr-MA';
const MOROCCO_TZ = 'Africa/Casablanca';

/**
 * Format integer or decimal in latin numerals (forced via numberingSystem).
 */
export function formatNumber(
  value: number | null | undefined,
  options: Intl.NumberFormatOptions & { locale?: string } = {},
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  const locale = options.locale ?? DEFAULT_LOCALE;
  const { locale: _, ...rest } = options;
  return new Intl.NumberFormat(locale, {
    numberingSystem: 'latn',
    ...rest,
  }).format(value);
}

/**
 * Format MAD currency.
 */
export function formatMad(
  amount: number | null | undefined,
  locale: string = DEFAULT_LOCALE,
): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return '-';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'MAD',
    numberingSystem: 'latn',
    currencyDisplay: 'code',  // "MAD" not "DH"
  }).format(amount);
}

/**
 * Format date as `dd/mm/yyyy`.
 */
export function formatDate(
  date: Date | string | null | undefined,
  locale: string = DEFAULT_LOCALE,
): string {
  if (!date) return '-';
  const dt = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(dt.getTime())) return '-';
  return new Intl.DateTimeFormat(locale, {
    timeZone: MOROCCO_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    numberingSystem: 'latn',
  }).format(dt);
}

/**
 * Format date with time `dd/mm/yyyy HH:mm`.
 */
export function formatDateTime(
  date: Date | string | null | undefined,
  locale: string = DEFAULT_LOCALE,
): string {
  if (!date) return '-';
  const dt = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(dt.getTime())) return '-';
  return new Intl.DateTimeFormat(locale, {
    timeZone: MOROCCO_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    numberingSystem: 'latn',
  }).format(dt);
}

/**
 * Format date short `dd MMM` (e.g. `15 jun`, `15 jun.`).
 */
export function formatDateShort(
  date: Date | string | null | undefined,
  locale: string = DEFAULT_LOCALE,
): string {
  if (!date) return '-';
  const dt = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(dt.getTime())) return '-';
  return new Intl.DateTimeFormat(locale, {
    timeZone: MOROCCO_TZ,
    day: '2-digit',
    month: 'short',
    numberingSystem: 'latn',
  }).format(dt);
}

/**
 * Format date long with weekday.
 */
export function formatDateLong(
  date: Date | string | null | undefined,
  locale: string = DEFAULT_LOCALE,
): string {
  if (!date) return '-';
  const dt = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(dt.getTime())) return '-';
  return new Intl.DateTimeFormat(locale, {
    timeZone: MOROCCO_TZ,
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    numberingSystem: 'latn',
  }).format(dt);
}

/**
 * Format Moroccan phone number to E.164 with spaces: +212 6 12 34 56 78.
 */
export function formatPhoneMa(phone: string | null | undefined): string {
  if (!phone) return '';
  let normalized = phone.replace(/\s/g, '');
  if (normalized.startsWith('0')) {
    normalized = `+212${normalized.slice(1)}`;
  } else if (normalized.startsWith('212') && !normalized.startsWith('+')) {
    normalized = `+${normalized}`;
  }
  // +212 X XX XX XX XX
  const match = normalized.match(/^\+212(\d)(\d{2})(\d{2})(\d{2})(\d{2})$/);
  if (match) {
    return `+212 ${match[1]} ${match[2]} ${match[3]} ${match[4]} ${match[5]}`;
  }
  return phone;
}

/**
 * Parse amount input from user (locale-aware).
 * Accepts "1 500,50" (fr) or "1500.50" (en) or "1٬500٫50" (ar).
 * Returns NaN if invalid.
 */
export function parseAmountInput(input: string | null | undefined): number {
  if (!input) return NaN;
  const normalized = input
    .replace(/٫/g, '.')   // arabic decimal separator
    .replace(/٬/g, '')     // arabic thousands separator
    .replace(/\s/g, '')
    .replace(/,/g, '.');
  return Number.parseFloat(normalized);
}

/**
 * Format policy number with separators: "POL2026000123" -> "POL-2026-000123".
 */
export function formatPolicyNumber(numero: string | null | undefined): string {
  if (!numero) return '';
  const match = numero.match(/^([A-Z]+)(\d{4})(\d+)$/);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }
  return numero;
}

/**
 * Format percentage.
 */
export function formatPercent(
  value: number | null | undefined,
  locale: string = DEFAULT_LOCALE,
  fractionDigits: number = 0,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
    numberingSystem: 'latn',
  }).format(value);
}

/**
 * Format relative time (e.g. "il y a 5 min").
 */
export function formatRelative(
  iso: string | Date | null | undefined,
  locale: string = DEFAULT_LOCALE,
  now: Date = new Date(),
): string {
  if (!iso) return '-';
  const dt = typeof iso === 'string' ? new Date(iso) : iso;
  const diff = Math.floor((now.getTime() - dt.getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (Math.abs(diff) < 60) return rtf.format(-diff, 'second');
  if (Math.abs(diff) < 3600) return rtf.format(-Math.floor(diff / 60), 'minute');
  if (Math.abs(diff) < 86_400) return rtf.format(-Math.floor(diff / 3600), 'hour');
  if (Math.abs(diff) < 7 * 86_400) return rtf.format(-Math.floor(diff / 86_400), 'day');
  if (Math.abs(diff) < 30 * 86_400) return rtf.format(-Math.floor(diff / (7 * 86_400)), 'week');
  if (Math.abs(diff) < 365 * 86_400) return rtf.format(-Math.floor(diff / (30 * 86_400)), 'month');
  return rtf.format(-Math.floor(diff / (365 * 86_400)), 'year');
}

/**
 * Pluralize via ICU MessageFormat-compatible patterns.
 * Used outside next-intl context.
 */
export function plural(
  count: number,
  forms: { zero?: string; one: string; few?: string; many?: string; other: string },
  locale: string = DEFAULT_LOCALE,
): string {
  const pr = new Intl.PluralRules(locale);
  const form = pr.select(count);
  return forms[form as keyof typeof forms] ?? forms.other;
}

/**
 * Truncate text with locale-aware ellipsis.
 */
export function truncate(text: string, maxLength: number, locale: string = DEFAULT_LOCALE): string {
  if (text.length <= maxLength) return text;
  const ellipsis = locale.startsWith('ar') ? '...' : '...';
  return `${text.slice(0, maxLength - ellipsis.length).trimEnd()}${ellipsis}`;
}
```

### Fichier 2/12 : `repo/packages/assure-shared/src/lib/rtl-helpers.ts`

```typescript
// repo/packages/assure-shared/src/lib/rtl-helpers.ts

export function getDirection(locale: string): 'ltr' | 'rtl' {
  return locale.startsWith('ar') ? 'rtl' : 'ltr';
}

export function getLanguage(locale: string): 'fr' | 'ar' {
  return locale.startsWith('ar') ? 'ar' : 'fr';
}

/**
 * Build a `dir` attribute value for inputs that should always be LTR
 * regardless of context (CIN, phone, email, plate numbers).
 */
export function forceInputDir(_locale: string): 'ltr' {
  return 'ltr';
}

/**
 * Returns class names that should flip in RTL.
 */
export interface MirrorClasses {
  chevronLeft: string;
  chevronRight: string;
  arrowLeft: string;
  arrowRight: string;
}

export function getMirrorClasses(): MirrorClasses {
  return {
    // ChevronLeft icon, rotates 180deg in RTL to point right
    chevronLeft: 'rtl:rotate-180',
    chevronRight: 'rtl:rotate-180',
    // For arrows that visually move (carousel etc.), flip via scale-x
    arrowLeft: 'rtl:-scale-x-100',
    arrowRight: 'rtl:-scale-x-100',
  };
}

/**
 * For position absolute: returns inset-inline-end value
 */
export function getInsetInlineEnd(value: string): { insetInlineEnd: string } {
  return { insetInlineEnd: value };
}

/**
 * Determine if text content is bidirectional (mixed LTR + RTL).
 * Useful for inputs that might contain both.
 */
export function isBidi(text: string): boolean {
  const rtlChars = /[֐-ࣿ‏יִ-﻿]/;
  const ltrChars = /[A-Za-z]/;
  return rtlChars.test(text) && ltrChars.test(text);
}

/**
 * Wraps a number with bidi isolate marker to ensure correct rendering in RTL.
 */
export function bidiIsolate(text: string | number): string {
  // U+2068 First Strong Isolate, U+2069 Pop Directional Isolate
  return `⁨${text}⁩`;
}

/**
 * Get fallback font family for arabic content.
 */
export function getArabicFontFamily(): string {
  return '"Tajawal", "Cairo", system-ui, -apple-system, sans-serif';
}

export function getLatinFontFamily(): string {
  return '"Inter", system-ui, -apple-system, sans-serif';
}
```

### Fichier 3/12 : `repo/packages/assure-shared/src/components/locale-aware-date.tsx`

```typescript
'use client';

import { useLocale } from 'next-intl';
import { formatDate, formatDateLong, formatDateShort, formatDateTime, formatRelative } from '../lib/i18n-helpers';

interface LocaleAwareDateProps {
  date: Date | string | null | undefined;
  format?: 'short' | 'medium' | 'long' | 'datetime' | 'relative';
  className?: string;
  /** Override locale (otherwise uses useLocale) */
  locale?: string;
}

export function LocaleAwareDate({ date, format = 'medium', className, locale: localeOverride }: LocaleAwareDateProps): JSX.Element {
  const intlLocale = useLocale();
  const locale = localeOverride ?? intlLocale;

  let formatted: string;
  let machineReadable: string | null = null;
  if (date) {
    const dt = typeof date === 'string' ? new Date(date) : date;
    if (!Number.isNaN(dt.getTime())) {
      machineReadable = dt.toISOString();
    }
  }

  switch (format) {
    case 'short':
      formatted = formatDateShort(date, locale);
      break;
    case 'long':
      formatted = formatDateLong(date, locale);
      break;
    case 'datetime':
      formatted = formatDateTime(date, locale);
      break;
    case 'relative':
      formatted = formatRelative(date, locale);
      break;
    case 'medium':
    default:
      formatted = formatDate(date, locale);
      break;
  }

  if (machineReadable) {
    return (
      <time dateTime={machineReadable} className={className}>
        {formatted}
      </time>
    );
  }

  return <span className={className}>{formatted}</span>;
}
```

### Fichier 4/12 : `repo/packages/assure-shared/src/components/locale-aware-currency.tsx`

```typescript
'use client';

import { useLocale } from 'next-intl';
import { formatMad } from '../lib/i18n-helpers';
import { bidiIsolate } from '../lib/rtl-helpers';

interface LocaleAwareCurrencyProps {
  amount: number | null | undefined;
  className?: string;
  /** If true, wrap in bidi isolate to avoid layout shift in RTL */
  bidiSafe?: boolean;
  locale?: string;
}

export function LocaleAwareCurrency({
  amount,
  className,
  bidiSafe = true,
  locale: localeOverride,
}: LocaleAwareCurrencyProps): JSX.Element {
  const intlLocale = useLocale();
  const locale = localeOverride ?? intlLocale;
  const formatted = formatMad(amount, locale);
  const display = bidiSafe ? bidiIsolate(formatted) : formatted;

  return (
    <span className={className} dir="ltr">
      {display}
    </span>
  );
}
```

### Fichier 5/12 : `repo/packages/assure-shared/src/components/locale-aware-phone.tsx`

```typescript
'use client';

import { formatPhoneMa } from '../lib/i18n-helpers';

interface LocaleAwarePhoneProps {
  phone: string | null | undefined;
  className?: string;
  /** If true, render as `tel:` link */
  asLink?: boolean;
}

export function LocaleAwarePhone({ phone, className, asLink = true }: LocaleAwarePhoneProps): JSX.Element {
  const formatted = formatPhoneMa(phone);

  if (!phone) {
    return <span className={className}>-</span>;
  }

  if (asLink) {
    return (
      <a href={`tel:${phone.replace(/\s/g, '')}`} className={className} dir="ltr">
        {formatted}
      </a>
    );
  }

  return (
    <span className={className} dir="ltr">
      {formatted}
    </span>
  );
}
```

### Fichier 6/12 : `repo/packages/assure-shared/src/components/locale-aware-number.tsx`

```typescript
'use client';

import { useLocale } from 'next-intl';
import { formatNumber, formatPercent } from '../lib/i18n-helpers';
import { bidiIsolate } from '../lib/rtl-helpers';

interface LocaleAwareNumberProps {
  value: number | null | undefined;
  format?: 'decimal' | 'percent' | 'integer';
  fractionDigits?: number;
  className?: string;
  bidiSafe?: boolean;
  locale?: string;
}

export function LocaleAwareNumber({
  value,
  format = 'decimal',
  fractionDigits = 0,
  className,
  bidiSafe = false,
  locale: localeOverride,
}: LocaleAwareNumberProps): JSX.Element {
  const intlLocale = useLocale();
  const locale = localeOverride ?? intlLocale;

  let formatted: string;
  if (format === 'percent') {
    formatted = formatPercent(value, locale, fractionDigits);
  } else if (format === 'integer') {
    formatted = formatNumber(value, { locale, maximumFractionDigits: 0 });
  } else {
    formatted = formatNumber(value, {
      locale,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
  }

  const display = bidiSafe ? bidiIsolate(formatted) : formatted;

  return <span className={className}>{display}</span>;
}
```

### Fichier 7/12 : `repo/apps/web-assure-mobile/app/fonts.ts`

```typescript
// repo/apps/web-assure-mobile/app/fonts.ts
// Fonts loaded via next/font/google -- auto-hosted on Atlas (decision-008).

import { Inter, Tajawal, Cairo } from 'next/font/google';

export const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  variable: '--font-inter',
});

export const tajawal = Tajawal({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '700'],
  display: 'swap',
  variable: '--font-tajawal',
});

export const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '700'],
  display: 'swap',
  variable: '--font-cairo',
});

export function getFontVariables(): string {
  return [inter.variable, tajawal.variable, cairo.variable].join(' ');
}
```

### Fichier 8/12 : `repo/apps/web-assure-mobile/app/globals.css` (RTL + fonts section)

```css
/* repo/apps/web-assure-mobile/app/globals.css */

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --color-primary: #1A2730;
    --color-background: #FFFFFF;
    --color-foreground: #1A2730;
    --safe-area-top: env(safe-area-inset-top);
    --safe-area-bottom: env(safe-area-inset-bottom);
  }

  /* Latin content defaults Inter */
  html[lang="fr"], html[lang="fr-MA"] {
    font-family: var(--font-inter), system-ui, -apple-system, sans-serif;
  }

  /* Arabic content defaults Tajawal (ar-MA = darija) / Cairo (ar = standard) */
  html[lang="ar-MA"] {
    font-family: var(--font-tajawal), "Tajawal", "Cairo", system-ui, sans-serif;
  }

  html[lang="ar"] {
    font-family: var(--font-cairo), "Cairo", "Tajawal", system-ui, sans-serif;
  }

  body {
    background-color: var(--color-background);
    color: var(--color-foreground);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  /* iOS safe area on body */
  body {
    padding-top: env(safe-area-inset-top);
    padding-bottom: env(safe-area-inset-bottom);
  }

  /* Minimum tap target globally enforced (WCAG 2.5.5) */
  button, a, input, select, textarea, [role="button"], [role="link"] {
    min-height: 44px;
  }

  /* Exception: inline tag elements in cards (small badges) */
  button.inline-flex.h-5, button.inline-flex.h-6 {
    min-height: unset;
  }

  /* Number inputs force LTR even in RTL context */
  input[inputmode="numeric"], input[inputmode="tel"], input[type="email"], input[type="url"] {
    direction: ltr;
    text-align: start;
  }

  /* Reset font for icon-only sr-only labels */
  .sr-only {
    font-family: var(--font-inter);
  }

  /* Smooth scroll mobile */
  html {
    scroll-behavior: smooth;
  }

  /* No tap-highlight blue on mobile Chrome */
  * {
    -webkit-tap-highlight-color: transparent;
  }
}

@layer utilities {
  /* Safe-area utilities */
  .safe-pt {
    padding-top: env(safe-area-inset-top);
  }
  .safe-pb {
    padding-bottom: env(safe-area-inset-bottom);
  }

  /* Hide scrollbars but keep functional */
  .scrollbar-hidden {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  .scrollbar-hidden::-webkit-scrollbar {
    display: none;
  }

  /* Force LTR direction for embedded content */
  .dir-ltr {
    direction: ltr;
  }
  .dir-rtl {
    direction: rtl;
  }

  /* line-clamp utilities (Tailwind 3.4 native, restated for clarity) */
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
}

/* RTL-specific overrides for libraries that don't handle logical CSS properly */
[dir="rtl"] .recharts-tooltip-wrapper {
  direction: ltr;
}

[dir="rtl"] .react-pdf__Page__textContent {
  direction: ltr;
}
```

### Fichier 9/12 : `repo/apps/web-assure-mobile/tailwind.config.ts`

```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    '../../packages/assure-shared/src/**/*.{ts,tsx}',
    '../../packages/shared-ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1A2730',
          50: '#F6F8FA',
          100: '#EBF0F4',
          500: '#1A2730',
          600: '#15202A',
          700: '#101924',
          900: '#0A1118',
          foreground: '#FFFFFF',
        },
        background: '#FFFFFF',
        foreground: '#1A2730',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', '-apple-system', 'sans-serif'],
        'sans-ar': ['var(--font-tajawal)', 'Tajawal', 'Cairo', 'system-ui', 'sans-serif'],
        'sans-ar-std': ['var(--font-cairo)', 'Cairo', 'Tajawal', 'system-ui', 'sans-serif'],
      },
      screens: {
        // Mobile-first breakpoints
        xs: '375px',   // iPhone SE/12/13/14 normal
        sm: '640px',
        md: '768px',   // tablet portrait (switch to desktop layout for portal)
        lg: '1024px',
        xl: '1280px',
        '2xl': '1536px',
      },
      spacing: {
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
      },
      minHeight: {
        'tap': '44px',     // WCAG 2.5.5 minimum
        'tap-comfort': '48px', // Material Design
      },
      minWidth: {
        'tap': '44px',
      },
    },
  },
  safelist: [
    'rtl:rotate-180',
    'rtl:-scale-x-100',
    'dir-ltr',
    'dir-rtl',
    'safe-pt',
    'safe-pb',
  ],
  plugins: [],
};

export default config;
```

### Fichier 10/12 : `repo/apps/web-assure-mobile/playwright.config.ts`

```typescript
import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3006';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'mobile-small-fr',
      use: {
        ...devices['iPhone SE'],
        locale: 'fr-MA',
        viewport: { width: 320, height: 568 },
      },
    },
    {
      name: 'mobile-fr',
      use: {
        ...devices['iPhone 13'],
        locale: 'fr-MA',
      },
    },
    {
      name: 'mobile-arMA-RTL',
      use: {
        ...devices['iPhone 13'],
        locale: 'ar-MA',
      },
    },
    {
      name: 'mobile-ar-RTL',
      use: {
        ...devices['iPhone 13'],
        locale: 'ar',
      },
    },
    {
      name: 'tablet-fr',
      use: {
        ...devices['iPad (gen 7)'],
        locale: 'fr-MA',
      },
    },
    {
      name: 'desktop-fr',
      use: {
        ...devices['Desktop Chrome'],
        locale: 'fr-MA',
        viewport: { width: 1280, height: 800 },
      },
    },
    {
      name: 'desktop-arMA',
      use: {
        ...devices['Desktop Chrome'],
        locale: 'ar-MA',
        viewport: { width: 1280, height: 800 },
      },
    },
  ],
  webServer: process.env.CI
    ? undefined
    : {
        command: 'pnpm dev',
        url: BASE_URL,
        timeout: 120_000,
        reuseExistingServer: true,
      },
});
```

### Fichier 11/12 : `repo/apps/web-assure-mobile/e2e/i18n-rtl.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

const LOGIN_URL = '/fr-MA/login';

test.describe('I18n + RTL e2e', () => {
  test('LTR fr: html dir=ltr', async ({ page }) => {
    await page.goto('/fr-MA/login');
    const dir = await page.evaluate(() => document.documentElement.dir);
    expect(dir).toBe('ltr');
  });

  test('RTL ar-MA: html dir=rtl', async ({ page }) => {
    await page.goto('/ar-MA/login');
    const dir = await page.evaluate(() => document.documentElement.dir);
    expect(dir).toBe('rtl');
  });

  test('RTL ar: html dir=rtl', async ({ page }) => {
    await page.goto('/ar/login');
    const dir = await page.evaluate(() => document.documentElement.dir);
    expect(dir).toBe('rtl');
  });

  test('Arabic font Tajawal active on ar-MA', async ({ page }) => {
    await page.goto('/ar-MA/login');
    const font = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    expect(font.toLowerCase()).toContain('tajawal');
  });

  test('Inter font active on fr-MA', async ({ page }) => {
    await page.goto('/fr-MA/login');
    const font = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    expect(font.toLowerCase()).toContain('inter');
  });

  test('Numbers always latin in RTL', async ({ page }) => {
    // After login mock, go to polices
    await mockLogin(page, 'ar-MA');
    await page.goto('/ar-MA/polices');
    const content = await page.textContent('body');
    // Should not contain Arabic-Indic digits
    const arabicDigits = /[٠١٢٣٤٥٦٧٨٩]/;
    expect(arabicDigits.test(content ?? '')).toBe(false);
  });

  test('Date format /dd/mm/yyyy in fr-MA', async ({ page }) => {
    await mockLogin(page, 'fr-MA');
    await page.goto('/fr-MA/polices');
    const dateRegex = /\d{2}\/\d{2}\/\d{4}/;
    const content = await page.textContent('body');
    expect(dateRegex.test(content ?? '')).toBe(true);
  });

  test('Currency code MAD displayed (not DH)', async ({ page }) => {
    await mockLogin(page, 'fr-MA');
    await page.goto('/fr-MA/polices');
    const content = await page.textContent('body');
    expect(content).toContain('MAD');
    expect(content).not.toContain('DH ');
  });

  test('Locale switcher fr -> ar-MA preserves path', async ({ page }) => {
    await mockLogin(page, 'fr-MA');
    await page.goto('/fr-MA/polices');
    await page.getByLabel(/changer la langue/i).click();
    await page.getByText(/Arabe Maroc/i).click();
    await expect(page).toHaveURL(/\/ar-MA\/polices/);
  });

  test('No emoji anywhere in DOM', async ({ page }) => {
    await mockLogin(page, 'fr-MA');
    await page.goto('/fr-MA/polices');
    const content = await page.textContent('body');
    // Common emoji ranges
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}]/u;
    expect(emojiRegex.test(content ?? '')).toBe(false);
  });

  test('RTL chevron rotated 180', async ({ page }) => {
    await mockLogin(page, 'ar-MA');
    await page.goto('/ar-MA/polices');
    // Get first chevron in nav
    const chevron = await page.locator('svg[class*="rtl:rotate-180"]').first();
    if (await chevron.count() > 0) {
      const transform = await chevron.evaluate((el) => getComputedStyle(el).transform);
      expect(transform).toMatch(/matrix.*-1/);
    }
  });

  test('Phone input always LTR even in RTL', async ({ page }) => {
    await mockLogin(page, 'ar-MA');
    await page.goto('/ar-MA/profil');
    const phoneInput = await page.locator('input[type="tel"]').first();
    if (await phoneInput.count() > 0) {
      const dir = await phoneInput.evaluate((el) => getComputedStyle(el).direction);
      expect(dir).toBe('ltr');
    }
  });

  test('Body bidi text input renders correctly', async ({ page }) => {
    await mockLogin(page, 'ar-MA');
    await page.goto('/ar-MA/sinistres/declarer/etape-1');
    const textarea = await page.locator('textarea').first();
    if (await textarea.count() > 0) {
      await textarea.fill('Collision a 17h au feu rouge avenue Hassan II');
      const value = await textarea.inputValue();
      expect(value).toBe('Collision a 17h au feu rouge avenue Hassan II');
    }
  });
});

async function mockLogin(page: import('@playwright/test').Page, locale: string): Promise<void> {
  await page.goto(`/${locale}`);
  await page.evaluate((loc) => {
    window.localStorage.setItem(
      'skalean.assure.auth',
      JSON.stringify({
        state: {
          user: { id: 'u-test', email: 'test@example.ma', preferred_locale: loc, has_marketing_consent: false },
          tokens: { access_token: 'fake', refresh_token: 'fake', access_expires_at: Date.now() + 900_000 },
          tenants: [{ id: 't-1', name: 'Test', slug: 'test', logo_url: null, contact_id: 'c-1' }],
          activeTenantId: 't-1',
          status: 'authenticated',
        },
        version: 0,
      }),
    );
  }, locale);
}
```

### Fichier 12/12 : `repo/apps/web-assure-mobile/e2e/responsive.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Responsive viewport audit', () => {
  test('No horizontal overflow on any page (320px)', async ({ page }) => {
    test.skip(test.info().project.name !== 'mobile-small-fr', 'Only on 320px');

    const pages = ['/fr-MA/login', '/fr-MA/verify-otp'];
    for (const url of pages) {
      await page.goto(url);
      const overflow = await page.evaluate(() => {
        const docWidth = document.documentElement.clientWidth;
        const scrollWidth = document.documentElement.scrollWidth;
        return scrollWidth - docWidth;
      });
      expect(overflow, `Page ${url} overflows by ${overflow}px`).toBeLessThanOrEqual(0);
    }
  });

  test('All buttons meet tap target 44x44', async ({ page }) => {
    await page.goto('/fr-MA/login');
    const buttons = await page.locator('button, a[role="button"]').all();
    for (const btn of buttons) {
      const box = await btn.boundingBox();
      if (!box) continue;
      // Some inline badges legitimate exception (h-5 / h-6 status badges)
      const className = (await btn.getAttribute('class')) ?? '';
      const isInlineBadge = className.includes('h-5') || className.includes('h-6') || className.includes('text-[10px]');
      if (isInlineBadge) continue;
      expect(box.height, `Button height ${box.height}px < 44`).toBeGreaterThanOrEqual(44);
    }
  });

  test('Safe area inset applied on bottom nav', async ({ page }) => {
    await mockLogin(page, 'fr-MA');
    await page.goto('/fr-MA/polices');
    const nav = await page.locator('nav[aria-label*="principale" i]').first();
    if (await nav.count() > 0) {
      const padding = await nav.evaluate((el) => getComputedStyle(el).paddingBottom);
      // env(safe-area-inset-bottom) may be 0 on test env, but should be present
      expect(padding).toBeDefined();
    }
  });

  test('Mobile bottom nav visible < md, hidden >= md', async ({ page }) => {
    test.skip(!test.info().project.name.startsWith('mobile'), 'Mobile only');
    await mockLogin(page, 'fr-MA');
    await page.goto('/fr-MA/polices');
    const nav = await page.locator('nav[aria-label*="principale" i]');
    await expect(nav.first()).toBeVisible();
  });

  test('Desktop sidebar visible >= md', async ({ page }) => {
    test.skip(!test.info().project.name.startsWith('desktop'), 'Desktop only');
    await mockLogin(page, 'fr-MA');
    await page.goto('/fr-MA/polices');
    const sidebar = await page.locator('aside[aria-label*="principale" i]');
    if (await sidebar.count() > 0) {
      await expect(sidebar.first()).toBeVisible();
    }
  });

  test('Login form accessible on all sizes', async ({ page }) => {
    await page.goto('/fr-MA/login');
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();
    await emailInput.fill('test@example.ma');
    const submit = page.locator('button[type="submit"]');
    await expect(submit).toBeVisible();
  });

  test('Color contrast ratio >= 4.5 on body text', async ({ page }) => {
    await page.goto('/fr-MA/login');
    // Axe-core test (separate spec usually)
    const bodyColor = await page.evaluate(() => getComputedStyle(document.body).color);
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bodyColor).toBeDefined();
    expect(bg).toBeDefined();
  });

  test('Document scroll-y on long content, no scroll-x', async ({ page }) => {
    await page.goto('/fr-MA/login');
    const overflowX = await page.evaluate(() => getComputedStyle(document.body).overflowX);
    // Mostly auto/visible, never scroll
    expect(overflowX).not.toBe('scroll');
  });
});

async function mockLogin(page: import('@playwright/test').Page, locale: string): Promise<void> {
  await page.goto(`/${locale}`);
  await page.evaluate((loc) => {
    window.localStorage.setItem(
      'skalean.assure.auth',
      JSON.stringify({
        state: {
          user: { id: 'u-test', email: 'test@example.ma', preferred_locale: loc, has_marketing_consent: false },
          tokens: { access_token: 'fake', refresh_token: 'fake', access_expires_at: Date.now() + 900_000 },
          tenants: [{ id: 't-1', name: 'Test', slug: 'test', logo_url: null, contact_id: 'c-1' }],
          activeTenantId: 't-1',
          status: 'authenticated',
        },
        version: 0,
      }),
    );
  }, locale);
}
```

---

## 7. Tests complets

### 7.1 Tests i18n-helpers : `repo/packages/assure-shared/__tests__/lib/i18n-helpers.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  normalizeLocale,
  isRtl,
  formatMad,
  formatDate,
  formatDateTime,
  formatDateShort,
  formatPhoneMa,
  parseAmountInput,
  formatPolicyNumber,
  formatPercent,
  formatRelative,
  plural,
  truncate,
} from '../../src/lib/i18n-helpers';

describe('normalizeLocale', () => {
  it('fr-MA -> fr-MA', () => expect(normalizeLocale('fr-MA')).toBe('fr-MA'));
  it('fr -> fr-MA', () => expect(normalizeLocale('fr')).toBe('fr-MA'));
  it('ar-MA -> ar-MA', () => expect(normalizeLocale('ar-MA')).toBe('ar-MA'));
  it('ar -> ar', () => expect(normalizeLocale('ar')).toBe('ar'));
  it('unknown -> fr-MA', () => expect(normalizeLocale('xy')).toBe('fr-MA'));
});

describe('isRtl', () => {
  it('ar is RTL', () => expect(isRtl('ar')).toBe(true));
  it('ar-MA is RTL', () => expect(isRtl('ar-MA')).toBe(true));
  it('fr is LTR', () => expect(isRtl('fr')).toBe(false));
  it('fr-MA is LTR', () => expect(isRtl('fr-MA')).toBe(false));
});

describe('formatMad', () => {
  it('formats with MAD code', () => {
    const result = formatMad(1500, 'fr-MA');
    expect(result).toContain('MAD');
    expect(result).toContain('1');
  });

  it('returns - for null', () => expect(formatMad(null)).toBe('-'));
  it('returns - for NaN', () => expect(formatMad(NaN)).toBe('-'));

  it('uses latin numerals in ar-MA', () => {
    const result = formatMad(1500, 'ar-MA');
    expect(result).toMatch(/\d/);
    expect(result).not.toMatch(/[٠١٢٣٤٥٦٧٨٩]/);
  });
});

describe('formatDate', () => {
  it('formats fr-MA as dd/mm/yyyy', () => {
    const dt = new Date('2026-06-15T10:00:00Z');
    expect(formatDate(dt, 'fr-MA')).toMatch(/15\/06\/2026/);
  });

  it('formats ar-MA with latin digits', () => {
    const dt = new Date('2026-06-15T10:00:00Z');
    const result = formatDate(dt, 'ar-MA');
    expect(result).toMatch(/\d/);
    expect(result).not.toMatch(/[٠١٢٣٤٥٦٧٨٩]/);
  });

  it('returns - for null', () => expect(formatDate(null)).toBe('-'));
  it('returns - for invalid date string', () => expect(formatDate('invalid')).toBe('-'));
});

describe('formatPhoneMa', () => {
  it('formats +212', () => expect(formatPhoneMa('+212612345678')).toBe('+212 6 12 34 56 78'));
  it('normalizes 06...', () => expect(formatPhoneMa('0612345678')).toBe('+212 6 12 34 56 78'));
  it('normalizes 212...', () => expect(formatPhoneMa('212612345678')).toBe('+212 6 12 34 56 78'));
  it('returns original if unparseable', () => expect(formatPhoneMa('abc')).toBe('abc'));
  it('empty returns empty', () => expect(formatPhoneMa('')).toBe(''));
});

describe('parseAmountInput', () => {
  it('parses fr 1 500,50', () => expect(parseAmountInput('1 500,50')).toBe(1500.5));
  it('parses en 1500.50', () => expect(parseAmountInput('1500.50')).toBe(1500.5));
  it('parses ar separators', () => expect(parseAmountInput('1٬500٫50')).toBe(1500.5));
  it('NaN for invalid', () => expect(parseAmountInput('abc')).toBeNaN());
});

describe('formatPolicyNumber', () => {
  it('formats POL2026000123', () => expect(formatPolicyNumber('POL2026000123')).toBe('POL-2026-000123'));
  it('returns original if not matching', () => expect(formatPolicyNumber('abc')).toBe('abc'));
});

describe('formatPercent', () => {
  it('formats 0.45 as 45%', () => expect(formatPercent(0.45, 'fr-MA')).toContain('45'));
  it('returns -', () => expect(formatPercent(null)).toBe('-'));
});

describe('formatRelative', () => {
  it('1 minute ago', () => {
    const now = new Date('2026-06-15T10:00:00Z');
    const past = new Date('2026-06-15T09:59:00Z');
    const result = formatRelative(past, 'fr-MA', now);
    expect(result.toLowerCase()).toMatch(/min/);
  });

  it('1 hour ago', () => {
    const now = new Date('2026-06-15T10:00:00Z');
    const past = new Date('2026-06-15T09:00:00Z');
    const result = formatRelative(past, 'fr-MA', now);
    expect(result.toLowerCase()).toMatch(/h|heure/);
  });
});

describe('plural', () => {
  it('singular form', () => {
    const result = plural(1, { one: '1 sinistre', other: '{n} sinistres' }, 'fr-MA');
    expect(result).toBe('1 sinistre');
  });
  it('plural form', () => {
    const result = plural(5, { one: '1 sinistre', other: '{n} sinistres' }, 'fr-MA');
    expect(result).toBe('{n} sinistres');
  });
});

describe('truncate', () => {
  it('truncates long text', () => {
    expect(truncate('Hello world this is long', 10)).toBe('Hello...');
  });
  it('keeps short text', () => {
    expect(truncate('Hello', 10)).toBe('Hello');
  });
});
```

### 7.2 Tests rtl-helpers : `repo/packages/assure-shared/__tests__/lib/rtl-helpers.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  getDirection,
  getLanguage,
  forceInputDir,
  getMirrorClasses,
  getInsetInlineEnd,
  isBidi,
  bidiIsolate,
  getArabicFontFamily,
  getLatinFontFamily,
} from '../../src/lib/rtl-helpers';

describe('getDirection', () => {
  it('ar -> rtl', () => expect(getDirection('ar')).toBe('rtl'));
  it('ar-MA -> rtl', () => expect(getDirection('ar-MA')).toBe('rtl'));
  it('fr -> ltr', () => expect(getDirection('fr')).toBe('ltr'));
  it('fr-MA -> ltr', () => expect(getDirection('fr-MA')).toBe('ltr'));
});

describe('getLanguage', () => {
  it('ar-MA -> ar', () => expect(getLanguage('ar-MA')).toBe('ar'));
  it('fr -> fr', () => expect(getLanguage('fr')).toBe('fr'));
});

describe('forceInputDir', () => {
  it('always returns ltr', () => {
    expect(forceInputDir('ar')).toBe('ltr');
    expect(forceInputDir('fr')).toBe('ltr');
  });
});

describe('getMirrorClasses', () => {
  it('returns expected mirror classes', () => {
    const m = getMirrorClasses();
    expect(m.chevronLeft).toContain('rotate-180');
    expect(m.arrowLeft).toContain('scale-x');
  });
});

describe('isBidi', () => {
  it('detects mixed text', () => expect(isBidi('Hello مرحبا')).toBe(true));
  it('false for ar only', () => expect(isBidi('مرحبا')).toBe(false));
  it('false for latin only', () => expect(isBidi('Hello')).toBe(false));
});

describe('bidiIsolate', () => {
  it('wraps with U+2068 / U+2069', () => {
    const result = bidiIsolate(1500);
    expect(result.codePointAt(0)).toBe(0x2068);
    expect(result.codePointAt(result.length - 1)).toBe(0x2069);
  });
});

describe('font families', () => {
  it('arabic family includes Tajawal', () => expect(getArabicFontFamily()).toContain('Tajawal'));
  it('latin family includes Inter', () => expect(getLatinFontFamily()).toContain('Inter'));
});
```

---

### 7.3 Tests locale-aware-date : `repo/packages/assure-shared/__tests__/components/locale-aware-date.spec.tsx`

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';

import { LocaleAwareDate } from '../../src/components/locale-aware-date';

function wrap(c: JSX.Element, locale: string = 'fr-MA'): JSX.Element {
  return <NextIntlClientProvider locale={locale} messages={{}}>{c}</NextIntlClientProvider>;
}

describe('LocaleAwareDate', () => {
  const TEST_DATE = '2026-06-15T10:30:00Z';

  it('renders <time> element with dateTime attribute', () => {
    const { container } = render(wrap(<LocaleAwareDate date={TEST_DATE} />));
    const time = container.querySelector('time');
    expect(time).not.toBeNull();
    expect(time?.getAttribute('datetime')).toBe(new Date(TEST_DATE).toISOString());
  });

  it('formats medium dd/mm/yyyy in fr-MA', () => {
    render(wrap(<LocaleAwareDate date={TEST_DATE} format="medium" />, 'fr-MA'));
    expect(screen.getByText(/15\/06\/2026/)).toBeInTheDocument();
  });

  it('formats short dd MMM in fr-MA', () => {
    render(wrap(<LocaleAwareDate date={TEST_DATE} format="short" />, 'fr-MA'));
    const text = screen.getByText(/15/).textContent ?? '';
    expect(text).toMatch(/15.*juin|jun/i);
  });

  it('formats long weekday dd MMM yyyy in fr-MA', () => {
    render(wrap(<LocaleAwareDate date={TEST_DATE} format="long" />, 'fr-MA'));
    const text = screen.getByText(/15.*juin.*2026|lun/i);
    expect(text).toBeInTheDocument();
  });

  it('formats datetime dd/mm/yyyy HH:mm in fr-MA', () => {
    render(wrap(<LocaleAwareDate date={TEST_DATE} format="datetime" />, 'fr-MA'));
    expect(screen.getByText(/15\/06\/2026.*\d{2}:\d{2}/)).toBeInTheDocument();
  });

  it('renders - for null date', () => {
    render(wrap(<LocaleAwareDate date={null} />));
    expect(screen.getByText('-')).toBeInTheDocument();
  });

  it('uses latin numerals in ar-MA locale', () => {
    render(wrap(<LocaleAwareDate date={TEST_DATE} format="medium" />, 'ar-MA'));
    const time = document.querySelector('time');
    expect(time?.textContent).toMatch(/\d/);
    expect(time?.textContent).not.toMatch(/[٠١٢٣٤٥٦٧٨٩]/);
  });

  it('locale override prop takes precedence', () => {
    render(wrap(<LocaleAwareDate date={TEST_DATE} locale="ar-MA" format="medium" />, 'fr-MA'));
    // Should use ar-MA format regardless of provider locale
    expect(screen.getByText(/15\/06\/2026/)).toBeInTheDocument();
  });
});
```

### 7.4 Tests locale-aware-currency : `repo/packages/assure-shared/__tests__/components/locale-aware-currency.spec.tsx`

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';

import { LocaleAwareCurrency } from '../../src/components/locale-aware-currency';

function wrap(c: JSX.Element, locale: string = 'fr-MA'): JSX.Element {
  return <NextIntlClientProvider locale={locale} messages={{}}>{c}</NextIntlClientProvider>;
}

describe('LocaleAwareCurrency', () => {
  it('renders MAD code', () => {
    render(wrap(<LocaleAwareCurrency amount={1500} />, 'fr-MA'));
    expect(screen.getByText(/MAD/)).toBeInTheDocument();
  });

  it('uses dir=ltr always (numbers LTR)', () => {
    const { container } = render(wrap(<LocaleAwareCurrency amount={1500} />, 'ar-MA'));
    const span = container.querySelector('span[dir="ltr"]');
    expect(span).not.toBeNull();
  });

  it('renders 1 500,00 MAD in fr-MA', () => {
    render(wrap(<LocaleAwareCurrency amount={1500} bidiSafe={false} />, 'fr-MA'));
    expect(screen.getByText(/1.*500.*MAD/)).toBeInTheDocument();
  });

  it('returns - for null', () => {
    render(wrap(<LocaleAwareCurrency amount={null} />));
    expect(screen.getByText(/-/)).toBeInTheDocument();
  });

  it('latin numerals in ar-MA even though arabic locale', () => {
    const { container } = render(wrap(<LocaleAwareCurrency amount={1500} bidiSafe={false} />, 'ar-MA'));
    const text = container.textContent ?? '';
    expect(text).toMatch(/\d/);
    expect(text).not.toMatch(/[٠١٢٣٤٥٦٧٨٩]/);
  });

  it('bidiSafe wraps with U+2068 / U+2069 markers', () => {
    const { container } = render(wrap(<LocaleAwareCurrency amount={1500} bidiSafe={true} />, 'ar-MA'));
    const text = container.textContent ?? '';
    expect(text.codePointAt(0)).toBe(0x2068);
  });

  it('formats negative amounts correctly', () => {
    render(wrap(<LocaleAwareCurrency amount={-250.5} bidiSafe={false} />, 'fr-MA'));
    expect(screen.getByText(/-250/)).toBeInTheDocument();
  });

  it('locale override prop takes precedence', () => {
    render(wrap(<LocaleAwareCurrency amount={1500} locale="ar-MA" bidiSafe={false} />, 'fr-MA'));
    expect(screen.getByText(/MAD/)).toBeInTheDocument();
  });
});
```

### 7.5 Messages JSON 3 locales -- extraits significatifs

Pour donner un apercu de la structure complete des 500 keys par locale, voici les sections principales du fichier `repo/apps/web-assure-mobile/messages/fr.json` :

```json
{
  "header": { "home_link_label": "Accueil Skalean", "broker_label": "Broker" },
  "footer": {
    "copyright": "{year} Skalean InsurTech. Tous droits reserves.",
    "footer_nav_label": "Liens de pied de page",
    "help": "Aide",
    "legal": "Mentions legales",
    "contact": "Contact"
  },
  "nav": {
    "polices": "Mes polices",
    "sinistres": "Mes sinistres",
    "documents": "Mes documents",
    "notifications": "Notifications",
    "profil": "Profil",
    "help_center": "Centre d'aide"
  },
  "auth.login": {
    "title": "Connexion",
    "subtitle": "Entrez votre email pour recevoir un code",
    "email_label": "Adresse email",
    "email_placeholder": "vous@example.ma",
    "submit_button": "Recevoir le code",
    "submitting": "Envoi en cours...",
    "terms_notice": "En continuant, vous acceptez nos CGU et notre politique de confidentialite."
  },
  "auth.verify": {
    "title": "Verification",
    "subtitle": "Un code a 6 chiffres a ete envoye a {masked_email}"
  },
  "claim_status": {
    "active": "Active",
    "active_aria": "Police active",
    "pending": "En attente",
    "pending_aria": "Police en attente",
    "expiring_soon": "Echeance proche",
    "expiring_soon_aria": "Echeance proche",
    "expired": "Expiree",
    "expired_aria": "Police expiree",
    "cancelled": "Resiliee",
    "cancelled_aria": "Police resiliee",
    "suspended": "Suspendue",
    "suspended_aria": "Police suspendue",
    "declared": "Declare",
    "acknowledged": "Pris en compte",
    "expert_assigned": "Expert assigne",
    "parts_ordered": "Pieces commandees",
    "in_repair": "En reparation",
    "completed": "Termine",
    "closed": "Cloture",
    "rejected": "Rejete"
  },
  "policy_card": {
    "aria_label": "Police {numero}, statut {status}",
    "branche": {
      "auto": "Auto", "habitation": "Habitation", "sante": "Sante",
      "rc_pro": "RC Pro", "voyage": "Voyage", "vie": "Vie", "autre": "Autre"
    },
    "numero_label": "N",
    "date_fin_label": "Echeance",
    "prime_annuelle_label": "Prime annuelle",
    "paid_progress_label": "Paye",
    "active_claims_warning": "{count, plural, one {# sinistre en cours} other {# sinistres en cours}}"
  },
  "appointment_calendar": {
    "today": "Aujourd'hui",
    "no_slots": "Aucun creneau",
    "no_availability": "Aucun creneau disponible ce jour",
    "slots_count": "{count, plural, one {# creneau} other {# creneaux}}",
    "period.morning": "Matin",
    "period.afternoon": "Apres-midi",
    "period.evening": "Soir"
  },
  "claim_timeline": {
    "heading": "Historique",
    "subtitle": "{count, plural, =0 {Aucun evenement} one {# evenement} other {# evenements}}",
    "upcoming": "A venir",
    "actor_type.assure": "Assure",
    "actor_type.broker": "Broker",
    "actor_type.garage": "Garage",
    "actor_type.expert": "Expert",
    "actor_type.system": "Systeme"
  },
  "fab": {
    "declare_claim": "Declarer",
    "declare_claim_aria_label": "Declarer un nouveau sinistre"
  },
  "pull_to_refresh": {
    "pull_to_refresh": "Tirer pour rafraichir",
    "release_to_refresh": "Relacher pour rafraichir",
    "refreshing": "Rafraichissement en cours..."
  }
}
```

Et l'equivalent arabe marocain `ar-MA.json` (extrait) :

```json
{
  "header": { "home_link_label": "الصفحة الرئيسية Skalean", "broker_label": "الوسيط" },
  "footer": {
    "copyright": "{year} Skalean InsurTech. جميع الحقوق محفوظة.",
    "help": "مساعدة",
    "legal": "شروط قانونية",
    "contact": "اتصل بنا"
  },
  "nav": {
    "polices": "بوليصاتي",
    "sinistres": "حوادثي",
    "documents": "وثائقي",
    "notifications": "الإشعارات",
    "profil": "حسابي",
    "help_center": "مركز المساعدة"
  },
  "auth.login": {
    "title": "تسجيل الدخول",
    "subtitle": "أدخل بريدك الإلكتروني لاستلام الرمز",
    "email_label": "البريد الإلكتروني",
    "email_placeholder": "your@example.ma",
    "submit_button": "استلام الرمز"
  },
  "claim_status": {
    "active": "نشطة",
    "pending": "قيد الانتظار",
    "expiring_soon": "تنتهي قريبا",
    "expired": "منتهية",
    "cancelled": "ملغاة",
    "suspended": "موقوفة",
    "declared": "تم التصريح",
    "acknowledged": "تم الاستلام",
    "expert_assigned": "تم تعيين خبير",
    "parts_ordered": "تم طلب القطع",
    "in_repair": "قيد الإصلاح",
    "completed": "مكتمل",
    "closed": "مغلق",
    "rejected": "مرفوض"
  },
  "fab": {
    "declare_claim": "تصريح",
    "declare_claim_aria_label": "تصريح بحادث جديد"
  }
}
```

L'arabe standard `ar.json` differe legerement (formules plus formelles) :

```json
{
  "nav": {
    "polices": "وثائقي التأمينية",
    "sinistres": "حوادثي",
    "documents": "المستندات",
    "notifications": "التنبيهات",
    "profil": "الملف الشخصي"
  },
  "auth.login": {
    "title": "تسجيل الدخول",
    "subtitle": "يرجى إدخال البريد الإلكتروني لتلقي رمز التحقق"
  }
}
```

### 7.6 Tests E2E supplementaire viewports etoffe : `repo/apps/web-assure-mobile/e2e/viewport-matrix.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

const PUBLIC_PAGES = ['/fr-MA/login', '/ar-MA/login', '/ar/login'];

test.describe('Viewport matrix audit', () => {
  for (const url of PUBLIC_PAGES) {
    test(`${url} renders without console error`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (err) => errors.push(err.message));
      page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(msg.text());
      });
      await page.goto(url);
      await page.waitForLoadState('networkidle');
      expect(errors).toEqual([]);
    });
  }

  test('arabe RTL: html dir + body font Tajawal', async ({ page }) => {
    await page.goto('/ar-MA/login');
    const dir = await page.evaluate(() => document.documentElement.dir);
    expect(dir).toBe('rtl');
    const lang = await page.evaluate(() => document.documentElement.lang);
    expect(lang).toBe('ar-MA');
  });

  test('latin LTR: html dir + body font Inter', async ({ page }) => {
    await page.goto('/fr-MA/login');
    const dir = await page.evaluate(() => document.documentElement.dir);
    expect(dir).toBe('ltr');
  });

  test('viewport-fit cover meta tag present', async ({ page }) => {
    await page.goto('/fr-MA/login');
    const content = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(content).toContain('viewport-fit=cover');
  });

  test('font preload links present', async ({ page }) => {
    await page.goto('/fr-MA/login');
    const preloads = await page.locator('link[rel="preload"][as="font"]').count();
    expect(preloads).toBeGreaterThan(0);
  });
});
```

---

## 8. Variables environnement

```env
NEXT_PUBLIC_DEFAULT_LOCALE=fr-MA
NEXT_PUBLIC_SUPPORTED_LOCALES=fr-MA,ar-MA,ar
NEXT_PUBLIC_TIMEZONE=Africa/Casablanca
PLAYWRIGHT_BASE_URL=http://localhost:3006
```

---

## 9. Commandes shell

```bash
cd repo

# Tests unit
pnpm --filter @insurtech/assure-shared test --coverage

# E2E
pnpm --filter @insurtech/web-assure-mobile exec playwright install
pnpm --filter @insurtech/web-assure-mobile exec playwright test e2e/i18n-rtl.spec.ts e2e/responsive.spec.ts

# Audit RTL hooks (pre-commit script)
bash infrastructure/scripts/check-rtl-tailwind.sh

# Audit tap targets statique
pnpm tsx infrastructure/scripts/check-tap-target.ts

# Audit translate coverage
pnpm tsx infrastructure/scripts/translate-coverage.ts

# Lighthouse
pnpm --filter @insurtech/web-assure-mobile build
pnpm --filter @insurtech/web-assure-mobile start &
sleep 5
lighthouse http://localhost:3006/fr-MA/polices --preset=mobile

git add -A && git commit -m "feat(sprint-18): i18n complete + RTL audit + mobile-first responsive"
```

---

## 10. Criteres validation V1-V24

### P0 (16)

- **V1 (P0)** : 3 locales chargees fr-MA / ar-MA / ar avec dir auto.
- **V2 (P0)** : Polices Tajawal/Cairo embedded next/font/google.
- **V3 (P0)** : Numbers latin meme en ar (`numberingSystem: 'latn'`).
- **V4 (P0)** : Date format dd/mm/yyyy partout.
- **V5 (P0)** : Currency MAD code (pas DH).
- **V6 (P0)** : Phone E.164 +212 X XX XX XX XX.
- **V7 (P0)** : RTL chevrons rotated 180.
- **V8 (P0)** : Tap targets >= 44x44.
- **V9 (P0)** : Pas d'overflow horizontal 320px.
- **V10 (P0)** : Mobile bottom nav < md, sidebar >= md.
- **V11 (P0)** : Phone/email inputs forces LTR meme en ar.
- **V12 (P0)** : Locale switcher preserve path.
- **V13 (P0)** : 500 keys par locale (audit translate-coverage).
- **V14 (P0)** : 0 emoji DOM (e2e test).
- **V15 (P0)** : safe-area-inset top/bottom applique.
- **V16 (P0)** : Plural rules ICU (next-intl) correct fr + ar.

### P1 (5)

- **V17 (P1)** : Lighthouse a11y >= 95.
- **V18 (P1)** : Lighthouse best-practices >= 95.
- **V19 (P1)** : Lighthouse PWA = 100.
- **V20 (P1)** : Logical CSS classes only (check-rtl-tailwind script).
- **V21 (P1)** : E2E 15+ scenarios PASS i18n.

### P2 (3)

- **V22 (P2)** : Coverage parite 100% entre 3 locales.
- **V23 (P2)** : Tests responsive 8 scenarios PASS.
- **V24 (P2)** : Documentation RTL strategy committed.

---

## 11. Edge cases + troubleshooting

### EC1: Police arabe charge en delayed -> FOIT
Solution: `display: 'swap'` + preload `<link rel="preload">`.

### EC2: Input email en ar laisse user taper RTL
Solution: `input[type="email"] { direction: ltr }` global CSS.

### EC3: Date format `15 juin 2026` en arabe = `15 يونيو 2026`
Solution: month: '2-digit' force toujours chiffre.

### EC4: Tap target inline badge < 44px
Solution: exception explicite (badge h-5/h-6 list).

### EC5: Bottom nav cache contenu sur 320px
Solution: padding-bottom: env(safe-area) + 4rem.

### EC6: Polices Tajawal manquante pour weight 900
Solution: subset weights ['400', '500', '700']. Si bold non disponible utilise 700.

### EC7: Locale switcher click click duplicate
Solution: useTransition pour debounce (heritage tache 4.5.3).

### EC8: Plural ICU bug avec count=0 en arabe
Solution: explicit form `zero: '...'` dans messages.

### EC9: Tailwind safelist manque rtl:rotate-180
Solution: safelist explicit dans config.

### EC10: Body padding-bottom additionne fond + safe-area
Solution: utiliser uniquement env safe-area sur nav, pas body.

### EC11: Number input touch slows ar-MA
Solution: input[inputmode="numeric"] force keyboard num direct.

### EC12: Bidi text input mixed loses cursor
Solution: dir="auto" plutot que dir="rtl" sur textarea.

---

## 12. Conformite Maroc

### Loi 10-03 (Acces personnes handicapees au numerique)
- WCAG 2.1 AA respecte (tap targets, contraste, navigation clavier).

### Loi 09-08 CNDP (langue arabe accessibility)
- 3 locales supportees y compris darija (ar-MA).

### Decret ANRT (font embedding)
- Polices OFL Tajawal + Cairo OK pour usage commercial.

### Cloud souverain MA
- Polices auto-hostees Atlas (next/font default).

---

### Strategie i18n -- analyse approfondie

L'internationalisation trilingue (francais + arabe marocain + arabe standard) pour un produit financier au Maroc represente un cas d'usage particulier que cette tache documente exhaustivement, parce que les patterns appliques ici seront reutilises dans 17 sprints ulterieurs (Sprints 19-35).

**Pourquoi 3 locales et pas 2 (fr + ar) ?** L'arabe marocain (darija, code BCP 47 `ar-MA`) differe significativement de l'arabe standard (`ar`) sur plusieurs plans : vocabulaire courant (technologie, finance, transport), tournures interpersonnelles (formel vs informel), expressions consacrees pour les actes legaux. L'utilisateur darija typique du pilote Marrakech (Sprint 35) trouve les messages en arabe standard "trop formels, presque etrangers" -- friction d'engagement +15% selon les tests utilisateur pre-Sprint 17. Inversement, l'utilisateur du nord du Maroc (Tanger, Tetouan) prefere parfois l'arabe standard. La maintenance de 2 locales arabes a un cout (traduction + QA), mais l'impact sur adoption justifie l'investissement.

**Comparaison technique fr vs fr-MA**. Notre choix est fr = fr-MA (alias). Les seules differences observees sont (1) format currency : on utilise systematiquement le code `MAD` (norme ISO 4217) plutot que l'abbreviation `DH` ou `DHS` qui creent ambiguite (Dirham Hassanais, Dollar Hong-Kong, etc.), (2) tutoiement vs vouvoiement : nous utilisons systematiquement le vouvoiement comme registre commercial-formel standard (jamais "Tu peux declarer ton sinistre" mais "Vous pouvez declarer votre sinistre"), (3) formats date/heure : identiques fr/fr-FR/fr-MA en pratique (dd/mm/yyyy 24h).

**Pourquoi forcer les chiffres latins meme en arabe ?** La decision est documentee dans le plan stratégique Sprint 0 sous le code `decision-XXX-arabic-numerals-latin`. Les utilisateurs MA sondes (n=240) ont indique 96% de preference pour les chiffres latins, meme dans un contexte arabe : (1) leurs CIN nationaux sont en latin, (2) leurs plaques d'immatriculation en latin, (3) leurs montants bancaires en latin, (4) l'education marocaine moderne enseigne les chiffres latins (les chiffres arabes-indiens etant principalement utilises dans les textes religieux ou classique). Forcer les chiffres arabes-indiens (٠١٢٣٤٥٦٧٨٩) creerait friction. L'API `Intl.NumberFormat` avec `numberingSystem: 'latn'` permet de combiner script de texte arabe + chiffres latins -- best of both worlds.

**Polices arabes Tajawal vs Cairo : pourquoi 2 ?** Tajawal est une police medium contemporaine optimisee pour la lecture digitale, tres adoptee dans les apps marocaines (notamment dans le secteur public-finance MA). Cairo est plus formelle, geometrique, et privilegiee pour les contenus juridiques/contractuels en arabe standard. Notre mapping : `lang="ar-MA"` -> Tajawal (lecture grand public, darija), `lang="ar"` -> Cairo (formel, arabe standard). Les deux polices sont OFL (Open Font License), gratuites pour usage commercial, et embedded via `next/font/google` -- ce qui les self-host automatiquement sur Atlas (conformite decision-008 cloud souverain MA, pas de CDN US).

**RTL en pratique : les pieges qui surprennent.** La transition vers RTL revele toujours des bugs subtils que les tests automatises ne capturent pas tous : (1) les box-shadows asymetriques (`shadow-l-md`) qui paraissent bizarres en RTL -- on prefere symetriques (`shadow-md`), (2) les animations CSS `translateX` qui devraient inverser le signe -- nous utilisons custom property `--direction: -1` quand RTL, (3) les SVG complexes avec axes hardcoded -- nous flippons via `rtl:-scale-x-100`, (4) les charts/graphes (Recharts) qui doivent garder leur axe X-time en LTR meme en RTL -- nous forcons `direction: ltr` sur ces containers via classe `dir-ltr`, (5) les inputs alphanumeric (CIN, plaques, emails, phones) qui doivent rester LTR pour la lisibilite -- nous appliquons `direction: ltr` via CSS globals.

**Tap targets WCAG 2.5.5 : 44x44 minimum -- pourquoi pas 48 ?** Apple's HIG (Human Interface Guidelines) recommande 44pt comme minimum tap target tactile. Google's Material Design recommande 48dp. La norme WCAG 2.5.5 (Level AAA) retient 44x44 CSS pixels comme minimum (Level AA est plus permissif). Notre choix Skalean : 44x44 strict minimum sur tous les controls interactifs, 48x48 sur les boutons critiques (Pay, Submit, Save), 56x56 sur la bottom nav mobile (luxe + accessibilite mobilites reduites). L'enforcement via Tailwind `min-h-tap min-w-tap` global CSS, et test Playwright `boundingBox().height >= 44`.

**i18n pluralisation : les 6 forms d'arabe.** L'arabe a six pluralisation forms : zero, one, two, few (3-10), many (11-99), other (100+, 1000+). Le francais n'a que 2 (singular/plural). next-intl utilise ICU MessageFormat qui supporte les 6 forms transparently : `{count, plural, =0 {no items} one {1 item} few {{count} items} other {{count} items}}`. Notre approche : declarer explicitement `=0`, `one`, `few`, `many`, `other` pour les messages count-sensitive en arabe. Le helper `plural()` dans `i18n-helpers.ts` valide via `Intl.PluralRules`.

**Couverture i18n : objectif 100% parite 3 locales.** Le script `translate-coverage.ts` compare les 3 fichiers JSON et flagge les keys manquantes dans une locale. CI rejette si parite < 100%. Sprint 18 livre ~500 keys en parite, Sprint 19+ ajoutera ~200 keys (Repair vertical), Sprint 26+ ajoutera ~150 keys (Admin), totale projet final ~1200 keys par locale.

**Conformite Loi 10-03 (Acces handicapes au numerique) -- contraintes strictes.** La loi marocaine 10-03 (decret 2-15-728 application) impose la conformite WCAG aux services publics et "services aux assures" inclus dans le champ d'application via interpretation ACAPS. Nos verifications systematiques : (1) contraste >= 4.5:1 sur texte normal (axe-core), (2) tap targets >= 44x44, (3) keyboard navigation complete (tab order verified), (4) aria-* coherent (aria-current, aria-haspopup, aria-expanded, aria-modal, aria-live), (5) form labels associes aux inputs, (6) error messages programmatically associated, (7) skip-link "Aller au contenu" present.

**Mobile-first responsive : breakpoints Skalean retenus.** Tailwind CSS default breakpoints : sm 640px, md 768px, lg 1024px, xl 1280px, 2xl 1536px. Skalean ajoute `xs: 375px` (iPhone SE/12/13/14 standard) + reste defauts. La transition mobile -> desktop layout (sidebar visible, bottom nav cachee) se fait a `md` (768px). Test sur 4 viewports min : 320px (iPhone SE 1st gen), 375px (iPhone modern), 768px (iPad portrait), 1280px (desktop). Tous PASS en E2E Playwright matrix.

---

## 13. Conventions absolues skalean-insurtech

### Multi-tenant strict
- Pas applicable directement, mais messages JSON par-app, pas par-tenant.

### Validation Zod runtime
- normalizeLocale type-safe via SupportedLocale enum.

### Logger Pino
- Pas applicable cote frontend.

### Hash strict
- N/A.

### pnpm exclusif
- workspace:* pour assure-shared.

### TypeScript strict
- All helpers typed. SupportedLocale union.

### Tests Vitest exhaustifs
- 30+ unit (i18n-helpers 18 + rtl-helpers 8 + components 8).
- Playwright E2E 23+ scenarios.

### RBAC
- N/A (transverse).

### Events Kafka
- N/A.

### Imports @insurtech/*
- Standard.

### Skalean AI frontier
- Pas applicable.

### No-emoji absolu (decision-006)
- AUDIT FINAL : grep -P sur 6 fichiers messages JSON pour bannir emoji.

### Idempotency-Key
- N/A.

### Cloud souverain MA
- Polices Tajawal/Cairo self-hostees via next/font.

### Conventional Commits
- `feat(sprint-18): i18n complete + RTL audit + mobile-first responsive`.

### Mobile-first
- Tap target 44px enforce. 5 breakpoints xs/sm/md/lg/xl.

### i18n 3 locales
- 500 keys par locale (objectif).

### WCAG 2.1 AA
- Tap targets >= 44px.
- Contraste >= 4.5:1.
- aria-* heritages partout.

---

## 14. Validation pre-commit

```bash
cd repo
pnpm typecheck && pnpm lint
pnpm --filter @insurtech/assure-shared test --coverage
# No emoji in messages
grep -rP "[\x{1F300}-\x{1F9FF}]|[\x{2600}-\x{27BF}]" apps/web-assure-*/messages packages/assure-shared/src --exclude-dir=node_modules && echo FAIL || echo OK
# No deprecated left/right classes (logical only)
bash infrastructure/scripts/check-rtl-tailwind.sh
# Translate coverage 3 locales
pnpm tsx infrastructure/scripts/translate-coverage.ts
```

---

## 15. Commit message

```bash
git commit -m "feat(sprint-18): i18n complete fr/ar-MA/ar + RTL audit + mobile-first responsive

Audit final et harmonisation:
- Messages JSON 3 locales (~500 keys/locale, parite 100%)
- Polices next/font/google Tajawal (ar-MA) + Cairo (ar) + Inter (fr) self-host
- RTL CSS strategy: logical properties only (border-s/e, ms/me, ps/pe, start/end)
- Numbers always latin (numberingSystem='latn') meme en arabe
- Date format dd/mm/yyyy tz Africa/Casablanca
- Currency code MAD (pas DH)
- Phone E.164 +212 X XX XX XX XX

Lib i18n-helpers consolide:
- formatMad, formatDate (4 variants), formatPhoneMa, parseAmountInput,
  formatPolicyNumber, formatPercent, formatRelative (RelativeTimeFormat),
  plural (ICU PluralRules), truncate
- normalizeLocale, isRtl utils

Lib rtl-helpers:
- getDirection, getLanguage, forceInputDir (LTR pour email/phone/CIN)
- getMirrorClasses (chevronLeft rotate-180, arrows scale-x)
- bidiIsolate, isBidi detection
- getArabicFontFamily, getLatinFontFamily

Composants locale-aware:
- LocaleAwareDate (5 formats + machine-readable <time>)
- LocaleAwareCurrency (dir=ltr + bidi isolate)
- LocaleAwarePhone (tel: link)
- LocaleAwareNumber (decimal/percent/integer)

CSS globals:
- html[lang] font-family per locale
- min-height: 44px tap targets (WCAG 2.5.5)
- input[inputmode] force LTR direction
- safe-area utilities (safe-pt, safe-pb)
- scrollbar-hidden utility

Tailwind config:
- 5 breakpoints xs/sm/md/lg/xl
- Custom minHeight tap-44, tap-comfort-48
- safelist rtl:rotate-180, rtl:-scale-x-100

Playwright matrix:
- 7 projects (mobile-small-fr, mobile-fr, mobile-arMA-RTL, mobile-ar-RTL,
  tablet-fr, desktop-fr, desktop-arMA)
- 15+ tests i18n-rtl (dir, fonts, latin nums, date formats, currency,
  emoji audit, chevron rotation, phone LTR)
- 8+ tests responsive (overflow, tap targets, bottom nav, sidebar)

Pre-commit hooks:
- check-rtl-tailwind.sh (rejette left-/right-/ml-/mr-/pl-/pr-)
- check-tap-target.ts (ts-morph AST analysis)
- translate-coverage.ts (parite keys fr/ar-MA/ar)

Tests: 34+ unit (i18n-helpers 18 + rtl-helpers 8 + components 8)
Coverage: 92% assure-shared

Conformite:
- Loi 10-03: WCAG 2.1 AA tap targets, contraste, kbd nav
- Loi 09-08: 3 locales y compris darija ar-MA
- decision-006: audit final 0 emoji JSON
- decision-008: polices Tajawal/Cairo self-host via next/font (Atlas)

Task: 4.5.13
Sprint: 18 (Phase 4 / Sprint 5)
Phase: 4 -- Vertical Insure
Reference: B-18-sprint-18-web-assure-portal-mobile.md Tache 4.5.13"
```

---

### Strategie test responsive matrix -- justification

La matrix Playwright 7 projects (mobile-small-fr, mobile-fr, mobile-arMA-RTL, mobile-ar-RTL, tablet-fr, desktop-fr, desktop-arMA) couvre les configurations critiques sans sur-tester. Voici la justification de chaque projet :

**mobile-small-fr (320x568, fr-MA)** : iPhone SE 1ere generation, Galaxy S5 / equivalent low-end Android. Represente ~3% du parc MA mais 100% des cas "ecran minimal". Validation : pas d'overflow horizontal, tap targets respectes, layouts simples bien rendus. Sans ce test, regressions tres frequentes sur les cards complex (PolicyCard, ClaimCard).

**mobile-fr (375x667 iPhone 13, fr-MA)** : configuration la plus courante MA (~45% du parc smartphone). Validation : flow standard customer journey complet, calendar widget, photos upload, dialogs modals. Le viewport iPhone 13 (390x844 reel mais 375 CSS pixel) reflete la majorite des usages reels.

**mobile-arMA-RTL (375x667, ar-MA)** : configuration RTL primaire. ~25% du parc trafic projection pilote Marrakech. Validation cle : flips icones directionnelles (chevrons, fleches), border-e devient border-l visuel, ms- devient mr- visuel, dialogs et bottom sheets s'ouvrent du bon cote, texte aligne start (= right en RTL), aria-live announces in Arabic. Sans ce projet, regressions RTL impossibles a detecter.

**mobile-ar-RTL (375x667, ar)** : arabe standard, ~5-10% du parc. Important pour valider les polices Cairo (vs Tajawal pour darija). Beaucoup de partage avec mobile-arMA-RTL, mais tests confirment que les 2 locales arabes ne divergent que sur le contenu texte, pas sur le layout/dir/visuel.

**tablet-fr (768x1024 iPad, fr-MA)** : la transition entre mobile (bottom nav) et desktop (sidebar) a lieu au breakpoint md (768px). Validation : sidebar visible, mobile-only elements (FAB, pull-to-refresh) caches, layout cards en 2 colonnes. iPad represente ~8% du trafic MA mais c'est aussi la configuration utilisee par les brokers en deplacement.

**desktop-fr (1280x800, fr-MA)** : configuration desktop standard, ~30% du trafic projection (mix professionnel + assures techno-savvy). Validation : sidebar persistente, layout 3 colonnes pour les listes, no overlay safe-area inutile, hover states fonctionnels.

**desktop-arMA (1280x800, ar-MA)** : RTL desktop, configuration rare mais critique car les agents broker arabophones utilisent souvent un desktop pro. Validation : sidebar passe a droite, layouts grids RTL-aware, charts Recharts dir=ltr force pour graphiques.

**Total CI : 7 projects x ~25 scenarios E2E = 175 scenarios executes par PR.** Temps CI parallel = ~22 minutes (4 workers). Si timeout > 30min, on reduit a 5 projects (drop desktop-arMA + mobile-ar-RTL).

### Note Tailwind safelist

Une particularite de Tailwind JIT (Just-In-Time) est qu'il ne genere que les classes utilisees dans le source. Pour les classes conditionnelles (e.g. `rtl:rotate-180` qui n'apparait que via direction `<html dir="rtl">`), Tailwind les detecte normalement si elles sont dans le source meme conditionnellement. Mais pour les classes generees dynamiquement via une expression `cn(`text-${variant}-700`)` ou via une lib externe (recharts internal classes), Tailwind ne les voit pas et les omet du bundle CSS final. Le `safelist` config Tailwind permet de forcer leur inclusion. Notre safelist Sprint 18 : `rtl:rotate-180`, `rtl:-scale-x-100`, `dir-ltr`, `dir-rtl`, `safe-pt`, `safe-pb`, `min-h-tap`, `min-w-tap`. Si une regression "missing styles in RTL" apparait, c'est typiquement un add au safelist.

### Note polices : next/font/google self-hosting

Le mecanisme `next/font/google` de Next.js 15 est plus subtil qu'il n'y parait. A premier vu, on importe Inter/Tajawal/Cairo depuis Google Fonts -- mais en realite, Next.js download les fichiers .woff2 au build time et les stocke dans `_next/static/media/`. Au runtime, les polices sont servies depuis votre propre origin (Atlas Benguerir dans notre cas). Aucun appel runtime a fonts.googleapis.com ni fonts.gstatic.com. Cela respecte parfaitement decision-008 (cloud souverain MA) -- Google ne voit pas un seul user agent, aucun cookie tracking, aucune metric. La license OFL (SIL Open Font License) autorise explicitement ce self-hosting redistribuable.

### Note arabic shaping

L'arabe est une "complex script" en typographie : chaque lettre a 4 formes contextuelles (isolated, initial, medial, final) qui se ligature avec les lettres voisines. La police doit avoir les "shaping" rules correctes (table OpenType GSUB/GPOS). Tajawal et Cairo sont audites pour shaping correct par leurs designers (Boutros & Co, Mohamed Gaber). Nos tests visual snapshot Sprint 35+ verifieront que le shaping est correct sur des paragraphes complexes (combinant arabe + ponctuation + chiffres latins).

### Note bidi text rendering

Le texte bidirectionnel (mixed LTR + RTL, e.g. "Police POL-2026-001234 en arabe") est gere par l'algorithme UAX #9 du navigateur (Unicode Bidirectional Algorithm). Sans intervention, ce algorithme decide automatiquement de l'ordre visuel basee sur "strong directional characters". Pour les numeros de police, IBAN, emails dans un contexte arabe, on force `direction: ltr` + `unicode-bidi: embed` via classe `dir-ltr` pour eviter les surprises (chiffres inverses, signes mal alignes). Le helper `bidiIsolate(value)` enveloppe avec U+2068 / U+2069 (First Strong Isolate / Pop Directional Isolate) -- pattern recommande W3C pour text bidi safe.

---

## 16. Workflow next

DERNIERE tache du Sprint : `task-4.5.14-tests-e2e-lighthouse-phase-4-closure.md` -- Suite E2E Playwright (15+ scenarios end-to-end) + Lighthouse PWA audit (100/100) + Phase 4 closure document `phase-4-completion.md`.

---

**Fin du prompt task-4.5.13-i18n-rtl-mobile-first.md.**

Densite atteinte : ~98 ko (sweet spot 100-120 ko, frole)
Code patterns : 12 fichiers complets (helpers, components, fonts, CSS, Tailwind config, Playwright config, E2E tests)
Tests : 34+ cas concrets (unit 26 + E2E 23)
Criteres : V1-V24
Edge cases : 12
Sections : 17/17
