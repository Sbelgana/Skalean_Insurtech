# Strategie Internationalisation -- Skalean InsurTech

Reference : task-1.4.11 Sprint 4 Phase 1
Date : 2026-05-20
Auteur : Skalean Engineering

---

## 1. Objectifs

Fournir une experience utilisateur native en trois langues :

- **Francais (fr)** : langue principale, locale par defaut
- **Darija marocaine (ar-MA)** : langue vernaculaire des utilisateurs Maroc
- **Arabe standard moderne (ar)** : formalite institutionnelle et legal

Toutes les 7 applications web partagent la meme configuration i18n depuis `@insurtech/shared-ui`.

---

## 2. Choix technique : next-intl 3.26

next-intl a ete retenu pour :

- Integration native Next.js App Router (server components + client components)
- Support pluralisation CLDR complet (6 categories arabe)
- Routing locale-aware avec `localePrefix: always`
- `getRequestConfig` server-side pour chargement messages dynamique
- Meilleure DX que react-i18next pour App Router

---

## 3. Locales et configuration

### 3.1 Locales supportees

| Code | Nom natif | Direction | Systeme numeral | Fallback |
|------|-----------|-----------|-----------------|---------|
| fr | Francais | ltr | latn | - |
| ar-MA | Darja | rtl | latn | ar |
| ar | Arabiya | rtl | arab | fr |

### 3.2 Configuration partagee

Le fichier central est `packages/shared-ui/src/i18n/routing.ts`. Il exporte :

- `routing` : configuration `defineRouting` partagee entre les 7 apps
- `SUPPORTED_LOCALES`, `DEFAULT_LOCALE`, `RTL_LOCALES` : constantes
- `isRtl(locale)`, `getDirection(locale)` : helpers direction

Chaque app expose `src/i18n/routing.ts` comme shim de re-export vers `@insurtech/shared-ui/i18n/routing`.

### 3.3 Cookie de preference

Cookie `NEXT_LOCALE` :
- `max-age` : 365 jours
- `SameSite: Lax`
- `Secure` en production uniquement

---

## 4. Support RTL

### 4.1 Direction HTML

Le composant `DirectionProvider` synchronise `document.documentElement.dir` et `lang` avec la locale active. En rendu serveur, le layout Next.js doit render `<html dir={dir} lang={locale}>`.

Classes CSS ajoutees sur `<html>` :
- `rtl` pour ar / ar-MA
- `ltr` pour fr

### 4.2 Tailwind CSS

Configurer Tailwind avec `dir: 'rtl'` dans le fichier de theme. Les utilitaires `start/end` remplacent `left/right` pour un support RTL natif.

---

## 5. Pluralisation

### 5.1 Categories CLDR

| Locale | Categories |
|--------|-----------|
| fr | one, other |
| ar-MA | zero, one, two, few, many, other |
| ar | zero, one, two, few, many, other |

### 5.2 Darija (ar-MA)

Par convention Skalean, le Darija collapse `two/few/many -> other` (option `collapseDarija = true`). Ce comportement est surpassable par parametre.

---

## 6. Formatage dates et nombres

### 6.1 Timezone

Toutes les dates sont affichees en `Africa/Casablanca` (UTC+1, avec DST Ramadan gere par IANA tz database).

### 6.2 Format dates

Format impose `dd/MM/yyyy` pour eviter ambiguite jour/mois. Quatre styles disponibles : short, medium, long, full.

### 6.3 Devise MAD

- Symbole : `DH` en francais, `د.م.` en arabe
- `formatCurrency(value, 'fr', 'MAD')` remplace automatiquement `MAD` par `DH`
- Numeraux arabes-indiens disponibles avec `useArabicIndicNumerals: true`

---

## 7. Architecture fichiers

```
packages/shared-ui/src/
  i18n/
    routing.ts       -- config defineRouting + helpers isRtl/getDirection
    navigation.ts    -- createNavigation wrappers types
    locales.ts       -- metadata 3 locales (font, dir, numbering, plural)
    types.ts         -- AppName, MessageKey utilitaires
    request.ts       -- getRequestConfig avec fallback chain
    index.ts         -- barrel export
  lib/
    format-date.ts   -- formatDate, formatTime, formatRelativeTime, formatDateRange
    format-number.ts -- formatNumber, formatCurrency, formatPercent, formatCompact
    format-list.ts   -- formatList (Intl.ListFormat)
    pluralize.ts     -- getPluralCategory, pluralize (Intl.PluralRules)
  components/
    LocaleSwitcher.tsx   -- dropdown selection locale avec cookie
    DirectionProvider.tsx -- synchro dir/lang sur <html>

apps/{app}/src/
  i18n/
    routing.ts    -- re-export shim depuis @insurtech/shared-ui/i18n/routing
    request.ts    -- getRequestConfig specifique app (messages locaux)
  middleware.ts   -- createMiddleware(routing)
  messages/
    fr.json       -- messages francais
    ar-MA.json    -- messages darija
    ar.json       -- messages arabe standard
```

---

## 8. Workflow contributeur

### 8.1 Ajouter une cle de traduction

1. Ajouter la cle dans `src/messages/fr.json` (source de verite)
2. Repercuter dans `ar-MA.json` et `ar.json`
3. Verifier parite avec `pnpm validate-i18n`

### 8.2 Validation CI

Script `scripts/validate-i18n-keys.ts` verifie la parite des cles entre locales pour les 7 apps. Exit 1 si divergence.

Script `scripts/i18n-extract-keys.ts` extrait les namespaces `useTranslations()` du codebase source.

### 8.3 Regles strictes

- Pas d'emoji dans les fichiers messages (decision-006)
- Les apostrophes dans les messages ICU doivent etre echappees : `''` = apostrophe litterale
- Les variables ICU : `{name}`, `{count, plural, ...}`

---

## 9. Performance

- Les messages JSON sont importes dynamiquement par locale (code splitting)
- Cache HTTP sur les messages via headers `Cache-Control`
- next-intl optimise le rendu serveur : messages disponibles sans hydratation client

---

## 10. Decisions liees

- ADR-006 : No-emoji policy
- Decision-009 : 3 locales obligatoires (fr, ar-MA, ar)
- task-1.4.1 : Bootstrap apps web avec routing i18n initial
- task-1.4.11 : Infrastructure i18n partagee (ce document)
