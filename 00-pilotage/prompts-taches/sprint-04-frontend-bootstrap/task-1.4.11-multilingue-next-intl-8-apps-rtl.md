# TACHE 1.4.11 -- Multilingue next-intl 8 Apps + RTL

**Sprint** : 4 (Phase 1 / Sprint 4 dans phase, dernier de Phase 1 Bootstrap)
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-04-sprint-04-frontend-bootstrap.md` (Tache 1.4.11, lignes 865-918)
**Phase** : 1 -- Bootstrap
**Priorite** : P0 (cross-cutting, bloquant pour layouts Tache 1.4.14, formulaires Sprint 5+)
**Effort** : 6h
**Dependances** : 1.4.1 (web-broker patron canonique), 1.4.2 a 1.4.7 (7 autres apps bootstrappees), 1.4.8 (shared-ui avec LocaleSwitcher composant), 1.4.10 (shared-maps Mapbox locale awareness)
**Bloque** : 1.4.14 (layouts utilisent `useTranslations`), Sprint 5 (next-auth UI texts), Sprint 8+ (toutes pages metier traduites)
**Densite cible** : 100-150 ko (auto-suffisant exhaustif, aucune lecture annexe necessaire)
**AUCUNE EMOJI AUTORISEE** (decision-006 strictement appliquee)
**Type tache** : Cross-cutting -- touche les 8 apps + 1 package partage (`shared-ui`)

---

## 1. But (0.5-1 ko)

Configurer le **multilinguisme uniforme** sur les 8 applications frontend Next.js 15 du programme Skalean InsurTech avec **trois locales** : `fr` (francais, locale par defaut, langue administrative et bancaire MA), `ar-MA` (Darija marocaine, langue parlee quotidienne mixant arabe et lexique francais), `ar` (arabe classique formel, usage administratif/religieux). Cette tache pose les fondations partagees dans `@insurtech/shared-ui/i18n` (routing, request handler, navigation typee, locales metadata), ajoute le middleware `next-intl` dans chaque app pour la detection automatique (URL > cookie > Accept-Language > defaut `fr`), active le rendu **RTL** (`dir="rtl"` sur `<html>`) pour les locales arabes via un `DirectionProvider`, et fournit les utilitaires de formatage `Intl` (date, nombre, devise MAD, liste, pluralisation arabe 6 formes) consommes par toutes les apps.

A la sortie de cette tache : (1) chaque URL `/fr/*`, `/ar-MA/*`, `/ar/*` repond en 200 sur les 8 apps (24 URLs validees E2E), (2) `<html lang="ar-MA" dir="rtl">` est genere automatiquement cote serveur sans flash de re-direction, (3) les fonts `Montserrat` (latin) et `Noto Naskh Arabic` (arabe) sont chargees via `next/font/google` avec `display: swap` et fallback chain, (4) les helpers `formatDate(date, locale)`, `formatCurrency(amount, locale, 'MAD')`, `formatNumber(n, locale)`, `formatList(items, locale)`, `pluralize(count, locale, messageKey)` sont type-safe et timezone-aware (`Africa/Casablanca` avec gestion DST avril-octobre), (5) le `LocaleSwitcher` change l'URL en preservant `pathname + query + hash` et persiste la preference dans le cookie `NEXT_LOCALE` (365 jours), (6) les types des messages JSON sont auto-generes par `next-intl` pour autocomplete + verification compile-time. Cette tache satisfait `decision-009` (multilinguisme MA obligatoire 3 locales) et WCAG SC 3.1.1 (attribut `lang` mandatoire).

---

## 2. Contexte etendu (5-10 ko)

### Pourquoi cette tache existe

Le marche marocain est **multilingue obligatoire**. La Constitution marocaine (revision 2011, article 5) reconnait l'arabe et le tamazight comme langues officielles, mais la pratique professionnelle InsurTech repose sur trois codes linguistiques distincts :

1. **Francais (`fr`)** : langue de l'administration economique, des banques, des compagnies d'assurances historiques (Wafa Assurance, Saham, RMA), des regulateurs (ACAPS communications mixtes FR/AR). Le francais reste la langue de redaction des contrats d'assurance, des conditions generales, et de la communication formelle B2B avec les courtiers et garages partenaires. **C'est la locale par defaut** des 8 apps Skalean.

2. **Arabe dialectal marocain dit "Darija" (`ar-MA`)** : langue parlee quotidienne par 90 % des Marocains. Particularites : (a) **mix lexical arabe + francais** ("ana ghadi nshouf le dossier dyalek" = "je vais regarder ton dossier"), (b) **transliterations frequentes** ("dashboard" reste souvent "dashboard" en darija ecrite), (c) **registre informel** -- jamais utilisee dans documents officiels. La Darija est ecrite en caracteres arabes (avec direction RTL) ou parfois en alphabet latin avec chiffres ("3" pour ع, "7" pour ح -- non supporte ici, seulement alphabet arabe). C'est la locale **preferee par les utilisateurs finaux mobile** (assures via `web-assure-mobile`, techniciens garage via `web-garage-mobile`).

3. **Arabe classique formel (`ar`)** : registre litteraire et institutionnel, employe pour : documents juridiques (police d'assurance officielle imprimable bilingue FR/AR), correspondance ACAPS (regulateur), formulaires administratifs CIN (Carte d'Identite Nationale), declarations fiscales, contenus religieux (Takaful assurance islamique Sprint 33+). **Jamais utilisee en interface conversationnelle** -- les utilisateurs MA rejettent l'arabe classique en UX (trop formel, percu comme "officiel"). Sa presence dans Skalean est limitee aux : (a) documents PDF generes (polices, certificats), (b) formulaires legaux (consentement RGPD-CNDP), (c) messages d'erreur juridiques, (d) signatures electroniques.

Cette **trichotomie** impose une architecture i18n robuste : trois fichiers `messages/{fr,ar-MA,ar}.json` par app avec strict parite des cles, fallback chain `ar-MA -> ar -> fr` si une cle manque (cas concret : un message technique "Erreur 503 Service Unavailable" est rarement traduit en Darija et tombe vers ar formel par defaut), et **pluralisation differenciee** -- l'arabe gere 6 categories grammaticales (zero, one, two, few, many, other) contre 2 en francais (one, other), exigeant `Intl.PluralRules` cote moteur.

### Choix technique : next-intl 3.26.3

Sprint 1 a deja installe `next-intl@3.26.3` dans le monorepo. Sprint 4 doit **operationnaliser** cette dependance sur les 8 apps. Le choix de next-intl (vs react-i18next, Lingui, FormatJS, i18next-react) repose sur :

| Critere | next-intl 3.26.3 | react-i18next 14.x | Lingui 4.x | FormatJS react-intl |
|---------|------------------|---------------------|------------|----------------------|
| App Router native | Oui (plugin `createNextIntlPlugin`) | Manuel | Manuel | Manuel |
| RSC `getTranslations()` | Oui (server-side) | Non | Non | Non |
| Routing locale-prefixed natif | Oui (`createMiddleware`) | Manuel middleware custom | Manuel | Manuel |
| Detection Accept-Language | Oui (matcher integre) | Plugin | Plugin | Plugin |
| Bundle client gzipped | ~7 ko | ~35 ko (i18next + react-i18next) | ~12 ko | ~28 ko |
| Type safety messages JSON | Oui (auto-genere) | Plugin externe | Macro Babel (slow) | Plugin externe |
| ICU MessageFormat support | Oui (built-in) | Oui | Oui | Oui |
| Pluralisation `Intl.PluralRules` | Oui (delegue native API) | Plugin | Macro | Oui |
| Streaming SSR avec Suspense | Oui | Limite | Limite | Limite |
| Maintained by | Jan Amann (sponsorise Vercel) | i18next team | Tom Trnka (Lingui) | FormatJS team |
| LTS roadmap v4 | Q1 2026 (breaking sur `getRequestConfig` signature) | v15 2025 (smooth) | v5 (smooth) | stable |

**Decision** : next-intl. Choix valide par : (1) integration native RSC + App Router, (2) bundle reduit (7 ko vs 35 ko critique pour PWA mobile garage/assure low-end Android), (3) middleware locale detection avec matcher excluant `/api`, `/_next`, `/static`, (4) types auto-generes depuis JSON pour autocomplete VSCode + erreurs compile.

**Risque assume** : v4 sortira Q1 2026 avec breaking changes (signature `getRequestConfig` recoit objet `{ requestLocale }` au lieu de `{ locale }`). On reste sur v3.26.3 stable jusqu'a Sprint 18 (customer-portal SEO). Migration v3 -> v4 estimee 2h de codemod automatique.

### Choix technique : routing locale-prefixed (vs domain-based)

Trois strategies possibles pour l'URL multilingue :

| Strategie | Exemple URL | Pour | Contre |
|-----------|-------------|------|--------|
| Locale prefix (CHOIX) | `broker.skalean-insurtech.ma/fr/dashboard` | Simple, 1 domaine, SEO multi-locale via hreflang | URL plus longue |
| Domain-based | `broker-fr.skalean-insurtech.ma`, `broker-ar.skalean-insurtech.ma` | Branding clair par locale | 3 sous-domaines x 8 apps = 24 sous-domaines DNS, certs SSL dedupliques |
| Subpath sans prefix par defaut | `broker.skalean-insurtech.ma/dashboard` (fr), `/ar/dashboard` | URL courte FR | localePrefix `as-needed` cree ambiguites SEO + middleware complexe |

**Decision** : `localePrefix: 'always'`. Justifie par : (1) simplicite DNS (1 sous-domaine par app x 8 apps = 8 enregistrements + certs Let's Encrypt unifies), (2) SEO predictible (chaque URL canonique inclut locale), (3) pas d'ambiguite cote middleware, (4) hreflang sitemap tracable.

### Choix technique : 3 locales fixes (pas plus, pas moins en Sprint 4)

Sprint 4 fixe **strictement** trois locales : `fr`, `ar-MA`, `ar`. Reservations futures :
- **Sprint 18 (customer-portal SEO public)** : ajout `en` (anglais) pour expatries et expats francophones marocains. Rationale : `customer-portal` est public (SEO Google), un visiteur marocain expatrie en France/Quebec reach le site en `en` ou `fr-CA`. Locale `en` activera hreflang sitemap supplementaire.
- **Sprint 25+ (claims) ou Sprint 30+** : reservation `tmz-MA` (Tamazight Tifinagh) pour conformite Constitution 2011. Bloque actuellement par : (a) absence de fonts Tifinagh standard sur les browsers mobiles low-end, (b) cout traduction native (~5 traducteurs Tifinagh certifies dans le pays), (c) demande utilisateur faible (estimation < 0,5 % du trafic). Decision dossier IRCAM (Institut Royal de la Culture Amazighe) requise.
- **Sprint 35+ (regional expansion)** : possibilite `ar-MR` (Mauritanie), `ar-DZ` (Algerie variante Darija algerienne), `fr-CA` (Quebec).

Sprint 4 expose donc une **architecture extensible** : tableau `LOCALES` dans `shared-ui/i18n/locales.ts` accepte ajout d'une 4e locale sans changement code (JSON config + nouveau fichier `messages/{nouvelle-locale}.json` par app).

### Trade-offs explicites

1. **Direction RTL via `<html dir="rtl">` server-side** : risque hydration mismatch si le calcul de `dir` differe entre serveur et client. Solution : `dir` est calcule **deterministiquement** depuis le `locale` (route segment `[locale]/` server-resolved), donc identique cote serveur et client. Aucun `useEffect` requis pour cas standard. Le `DirectionProvider` `'use client'` n'est utilise que pour les **changements dynamiques** post-mount (locale switch sans full reload), via `document.documentElement.dir = 'rtl'` apres `useLocale()` hook.

2. **Tailwind 4 RTL utilities** : Tailwind 4 expose nativement `rtl:`, `ltr:` modifiers (ex: `rtl:flex-row-reverse`). Avec `<html dir="rtl">`, ces variants s'activent automatiquement. **Mais** : si certains composants utilisent `ml-4` direct (margin-left), ils ne mirorient pas en RTL. Solution : utiliser `ms-4` (margin-start, logical property) systematiquement -- preset Tailwind 4 expose `ms-*`, `me-*`, `ps-*`, `pe-*`. Linter custom `eslint-plugin-tailwindcss/no-physical-properties` (Sprint 4 deferred a Sprint 16).

3. **Fonts Noto Naskh Arabic poids 400/700 seulement** : Sprint 4 charge 2 poids (regular, bold). Pesee : (a) la font Noto Naskh complete (300/400/600/700/800/900) pese ~1.2 Mo en woff2, (b) `next/font/google` subsetting limite aux glyphes utilises mais arabe = ~280 glyphes minimum, (c) compromis perf : 2 poids = ~280 ko x 2 = 560 ko total. Sprint 18 customer-portal SEO ajoutera Noto Naskh 500 (medium) si requis.

4. **Cookie `NEXT_LOCALE` 365 jours** : preference utilisateur persistante. Pas considere PII (donnee personnelle au sens loi 09-08 CNDP). Pas de banniere consentement requise (cookie strictement necessaire au fonctionnement multilingue, exempt RGPD article 82 directive ePrivacy / equivalent CNDP).

5. **Pluralisation arabe 6 formes vs 2 francais** : `Intl.PluralRules` natif gere automatiquement les categories CLDR. Le format ICU MessageFormat supporte les 6 categories : `{count, plural, =0 {pas de polices} =1 {une police} =2 {deux polices} few {# polices (3-10)} many {# police (11-99)} other {# de polices (100+)}}`. **Risque** : un traducteur non-natif arabe inverse "few" et "many" (regle CLDR : few = 3-10, many = 11-99 mais varie selon variante regionale -- en `ar-MA` Darija c'est plus simple, souvent collapsed vers `other`). Solution : tests `pluralize.spec.ts` avec assertions strictes 0/1/2/3/11/100 traducteur native MA dans loop.

6. **Time zone `Africa/Casablanca` DST** : le Maroc applique le DST (Daylight Saving Time) **inverse** depuis 2018 -- horaire d'ete maintenu sauf pendant le Ramadan (-1h pendant le mois saint). Cette particularite est **nativement** geree par `Intl.DateTimeFormat` avec `timeZone: 'Africa/Casablanca'` (browsers chargent IANA tz database mise a jour). **Mais** : cas limite Ramadan 2026 (mi-fevrier a mi-mars 2026 -- avant Sprint 4 = janvier 2026 = pas concerne immediatement, mais Sprint 8+ devra valider). Documente dans `i18n-strategy.md`.

7. **Dates ambigues `dd/MM/yyyy` vs `MM/dd/yyyy`** : le format `10/01/2026` est ambigu (10 janvier ou 1 octobre). Sprint 4 force **systematiquement** `dd/MM/yyyy` (jour-mois-annee) pour toutes les locales (fr, ar-MA, ar) car convention MA. Pas de format `yyyy-MM-dd` ISO pour affichage (utilisable seulement en input HTML5 `<input type="date">`).

8. **Currency MAD (Dirham Marocain)** : code ISO 4217 = MAD. Symbole = "DH" en francais, "د.م." (Dirham marocain en arabe abrege). `Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' })` produit `"1 234,56 MAD"` (separateurs francais espace + virgule, code ISO en suffixe par defaut). Pour obtenir `"1 234,56 DH"` (preference utilisateur MA), Sprint 4 expose helper `formatCurrency(amount, locale)` qui post-processe le rendu : `.replace('MAD', 'DH').replace('د.م.', 'د.م.')`. Sprint 8 affinera selon retour utilisateurs courtiers.

9. **Numeraux Arabic-Indic optionnels** : l'arabe classique utilise traditionnellement les **chiffres arabo-indiens** (٠١٢٣٤٥٦٧٨٩) au lieu des chiffres latins (0123456789). En MA : le francais utilise toujours latins, l'arabe peut utiliser les deux (selon contexte). `Intl.NumberFormat('ar', { numberingSystem: 'arab' })` produit `١٬٢٣٤٫٥٦` (chiffres arabo-indiens avec separateurs U+066B et U+066C). **Decision** : par defaut, `ar` utilise chiffres latins (compatible avec systemes de paiement, OCR documents, comptabilite). Option `useArabicIndicNumerals: true` exposee dans `formatNumber(amount, locale, options)` pour cas usage specifique (documents PDF formels Sprint 17).

10. **LocaleSwitcher preserve `pathname + query + hash`** : un utilisateur sur `/fr/contacts?page=3#item-12` clique LocaleSwitcher vers `ar-MA`. Resultat attendu : `/ar-MA/contacts?page=3#item-12`. Implementation : `useRouter()` + `usePathname()` + `useSearchParams()` next-intl wrappers. Test E2E: `LocaleSwitcher.spec.tsx`.

11. **Accept-Language header foreigners** : un visiteur en `de-DE` (Allemand) ou `en-US` (Anglais expat) reach `broker.skalean-insurtech.ma/`. Sprint 4 redirige vers `/fr` (locale par defaut) car `en` n'est pas dans la liste supportee Sprint 4. Sprint 18 ajoutera fallback `en-US -> en`. Cas teste E2E.

12. **Generation types TypeScript depuis JSON** : `next-intl` plugin Vite/Next inspecte les fichiers `messages/*.json` et genere automatiquement le type `Messages` consommable via `useTranslations<Messages>()`. **Mais** : si une cle existe en `fr.json` et manque en `ar.json`, `next-intl` au runtime tombe sur `undefined`. Solution preventive : script `scripts/validate-i18n-keys.ts` execute en CI (compare cles cross-locale, exit 1 si divergence). Genere aussi types stricts d'app (`AppMessages` discriminated par `NEXT_PUBLIC_APP_NAME`).

### Decisions strategiques referencees

- **decision-006 (NO EMOJI ABSOLU)** : aucune emoji dans aucun fichier code, JSON messages, README. Linter CI verifie. Caracteres arabes et accents francais autorises.
- **decision-008 (cloud souverain MA Atlas Cloud Benguerir)** : flags SVG des locales servies depuis `/public/flags/{fr,ar-MA,ar}.svg` (assets locaux), pas depuis CDN externe. Sprint 4 evite tout fetch tiers.
- **decision-009 (multilinguisme MA OBLIGATOIRE)** : 3 locales `fr / ar-MA / ar` non negociables. Tamazight Tifinagh `tmz-MA` reservee Sprint 30+ (decision IRCAM dossier). Anglais `en` reserve Sprint 18 (customer-portal public SEO).
- **WCAG SC 3.1.1 (Niveau A)** : attribut `lang` sur `<html>` mandatoire. Implementation via `<html lang={locale} dir={dir}>` server-rendered. Audit `axe-core` automatise Sprint 4 Tache 1.4.16.
- **Loi 09-08 CNDP** : la preference de locale stockee en cookie n'est PAS PII (Personally Identifiable Information). Pas de consentement explicite requis. Documente `i18n-strategy.md`.

### Pieges techniques connus (15 minimum)

1. **Hydration mismatch `dir` attribute** : si le calcul `dir = isRtl(locale) ? 'rtl' : 'ltr'` differe cote serveur (lit cookie raw) et client (lit `useLocale()` hook), React warn "Prop dir did not match". Solution : `dir` calcule UNIQUEMENT depuis `params.locale` (route segment server-resolved par next-intl middleware), jamais depuis cookie cote serveur.

2. **Locale invalide dans URL `/fr-FR/dashboard`** : un utilisateur tape `fr-FR` (au lieu de `fr`) ou `ar-EG` (au lieu de `ar`). Middleware next-intl ne reconnait pas, retourne 404 par defaut. Solution : `notFound()` redirect vers `/fr` ou afficher 404 -- Sprint 4 choisit **404 strict** (page `not-found.tsx` localisee), pas de redirect (evite SEO duplicate).

3. **Cookie `NEXT_LOCALE` SameSite Lax production** : si l'app est embeddable iframe (cas marketing landing pages Sprint 18), `SameSite=Strict` casse cookie. Solution : `SameSite=Lax` + `Secure` HTTPS prod uniquement.

4. **Messages JSON parite cles cross-locale** : developpeur ajoute `auth.login` dans `fr.json` mais oublie `ar.json` et `ar-MA.json`. Build TypeScript passe (next-intl genere types depuis premier locale lu = fr), runtime ar = `MISSING_MESSAGE`. Solution : script CI `validate-i18n-keys.ts` compare cles cross-locale, exit 1 si divergence. Hook pre-commit Husky.

5. **Pluralisation Darija ambigue** : Darija parlee n'a pas de regles de pluralisation strictes (souvent simplifie vs arabe classique). `Intl.PluralRules('ar-MA')` tombe sur regles arabe classique (6 categories). Solution : pour `ar-MA`, considerer collapse `few/many/other` dans une seule categorie via custom plural function helper.

6. **Font Noto Naskh Arabic FOIT** : sans `next/font/google` subsetting, font charge ~1.2 Mo bloquant render arabe. Solution : `next/font/google` `subsets: ['arabic']`, `display: 'swap'`, `preload: true`. Fallback `system-ui-arabic` (Tahoma Linux, Geeza Pro macOS).

7. **Tailwind RTL utilities `me-*`/`ms-*` non supportees Tailwind 3** : Sprint 4 utilise Tailwind 4.0.0-beta.4 qui expose nativement les logical properties. Si downgrade Tailwind 3.4.x (fallback), plugin `tailwindcss-rtl` requis. Documente dans i18n-strategy.

8. **Date format `Intl` browser-dependant** : `Intl.DateTimeFormat('ar-MA').format(new Date())` peut produire format different selon browser (Chrome vs Safari). Solution : passer explicitement `{ year: 'numeric', month: '2-digit', day: '2-digit' }` options pour deterministe.

9. **DST Africa/Casablanca Ramadan 2026** : `Intl.DateTimeFormat` browsers IANA tz database doivent etre a jour. Cas edge : Ramadan 2026 (mi-fev a mi-mar) -1h shift. Tests Sprint 8+ valideront. Sprint 4 documente.

10. **Currency MAD symbole "DH" non standard ISO** : `Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' })` produit "MAD" pas "DH". Solution helper post-process `.replace('MAD', 'DH')`. Risque : si un futur lib parse rendu pour reextraction, cassure.

11. **`useLocale()` dans Server Component** : `useLocale()` est un client hook (depuis next-intl 3.x). En Server Component utiliser `getLocale()` async. Erreur typique : `useLocale is not a function (Server)`. Solution : import asymetrique `import { getLocale } from 'next-intl/server'` (server) vs `import { useLocale } from 'next-intl'` (client).

12. **Server Component `getTranslations` cache per request** : `getTranslations()` cache resultat per request (RSC). Si on appelle dans 5 composants RSC differents = 1 seule lecture JSON. Bon. **Mais** : cache invalide si on switch locale -- pas un probleme car redirect cause re-render serveur complet.

13. **`<NextIntlClientProvider>` wrapping ALL client components** : oubli de wrap = `useTranslations` throws "No locale found". Solution : `[locale]/layout.tsx` toujours wrappe `children` dans `<NextIntlClientProvider>` apres `<NextIntlServerProvider>` implicit.

14. **Messages JSON > 1000 keys per app perf** : a Sprint 17+ chaque app aura ~500-1500 cles. next-intl charge tout le JSON par locale. Solution : Sprint 4 prepare structure namespaced (`auth.*`, `nav.*`, `errors.*`) pour activer Sprint 17 lazy loading per namespace via `useTranslations('auth')` (next-intl extrait subset).

15. **LocaleSwitcher dropdown z-index conflict avec sticky topbar** : le dropdown doit avoir `z-50` minimum. Conflict avec sticky topbar `z-40`. Solution : dropdown `z-[60]` shadcn/ui Popover par defaut. Verifie visuellement.

---

## 3. Architecture context (3-5 ko)

### Position dans Sprint 4

`task-1.4.11` est la **11eme tache cross-cutting** du Sprint 4, executee apres les 10 premieres taches qui ont bootstrappe les apps individuelles :

```
Sprint 4 -- Frontend Bootstrap (16 taches)

[1.4.1 web-broker]  <-- patron canonique
[1.4.2 web-garage]  <-- copie 1.4.1, port 3002
[1.4.3 web-garage-mobile]  <-- copie 1.4.1 + next-pwa, port 3003
[1.4.4 web-insurtech-admin]  <-- copie 1.4.1, port 3000
[1.4.5 web-customer-portal]  <-- copie 1.4.1 + SSG/ISR/SEO, port 3004
[1.4.6 web-assure-portal]  <-- copie 1.4.1, port 3005
[1.4.7 web-assure-mobile]  <-- copie 1.4.1 + next-pwa, port 3006
                |
                v
[1.4.8 shared-ui]  <-- 30+ composants shadcn + LocaleSwitcher
[1.4.9 shared-pwa] [1.4.10 shared-maps]
                |
                v
[1.4.11 i18n cross-cutting]  <--  CETTE TACHE
                |
                v
[1.4.12 turbo + scripts paralleles]
[1.4.13 OpenAPI client gen]
[1.4.14 layouts shared sidebar+topbar]  <-- consomme useTranslations
[1.4.15 placeholder pages + 404/500]    <-- localisees via this task
[1.4.16 E2E + Lighthouse + Storybook]   <-- valide RTL + locales
```

### Position dans le programme

Cette tache est **cross-cutting** et impacte tous les sprints frontend metier suivants :
- **Sprint 5 (Auth)** : pages login/logout localisees, messages d'erreur 401/403 traduits.
- **Sprint 8 (CRM)** : champs formulaires contacts traduits, dates de creation localisees.
- **Sprint 17 (Souscription)** : montants devises MAD locale-aware, dates expiration polices.
- **Sprint 18 (Customer-portal SEO public)** : ajout locale `en`, sitemap.xml hreflang, OpenGraph i18n.
- **Sprint 22 (Sinistres)** : declaration sinistres trilingue, pluralisation arabe pour nombre de pieces jointes.
- **Sprint 27 (Dashboards)** : graphiques Chart.js axes localises (axes dates dd/MM/yyyy fr vs ar).
- **Sprint 31 (Reporting ACAPS)** : exports PDF bilingues FR/AR (page de couverture + tableaux).

### Diagramme ASCII de l'architecture i18n cross-app

```
repo/packages/shared-ui/src/i18n/        # CONFIG PARTAGE (cette tache)
  routing.ts                             # locales, defaultLocale, pathnames
  request.ts                             # getRequestConfig dynamic import
  navigation.ts                          # Link/redirect/usePathname/useRouter wrappers
  locales.ts                             # LocaleConfig metadata fr/ar-MA/ar
  types.ts                               # AppMessages type-safe

repo/packages/shared-ui/src/components/  # COMPOSANTS PARTAGES
  LocaleSwitcher.tsx                     # dropdown selector
  DirectionProvider.tsx                  # 'use client' set documentElement.dir

repo/packages/shared-ui/src/lib/         # HELPERS Intl PARTAGES
  format-date.ts                         # formatDate/Time/RelativeTime/Range
  format-number.ts                       # formatNumber/Currency/Percent/Compact
  format-list.ts                         # Intl.ListFormat
  pluralize.ts                           # Intl.PluralRules helper

repo/apps/{8 apps}/src/                  # CONFIG APP-SPECIFIC
  middleware.ts                          # createMiddleware next-intl
  i18n/request.ts                        # delegue a shared-ui/i18n/request.ts
  messages/{fr,ar-MA,ar}.json            # ~50 keys core par app

repo/docs/architecture/
  i18n-strategy.md                       # documentation strategie

repo/scripts/
  validate-i18n-keys.ts                  # CI parite cles cross-locale
```

### Provider chain rendue (par app)

```
<html lang="fr" dir="ltr" class="...">
  <body>
    <ThemeProvider attribute="class" defaultTheme="system">
      <NextIntlClientProvider locale={locale} messages={messages} timeZone="Africa/Casablanca">
        <DirectionProvider>                         <-- 'use client' sync dir post-mount
          <Providers>
            <QueryClientProvider client={queryClient}>
              {children}                            <-- pages localisees
              <LocaleSwitcher />                    <-- topbar shared
            </QueryClientProvider>
          </Providers>
        </DirectionProvider>
      </NextIntlClientProvider>
    </ThemeProvider>
  </body>
</html>
```

### Flux requete utilisateur

```
1. User reach broker.skalean-insurtech.ma/
2. Middleware next-intl intercepte
3. Verifie URL : pas de prefix locale -> read cookie NEXT_LOCALE
4. Cookie absent -> read Accept-Language header
5. Header "fr-FR,fr;q=0.9" -> matche fr -> redirect 307 /fr/
6. Server Component layout.tsx [locale=fr]
7. getMessages() lit messages/fr.json
8. Render <html lang="fr" dir="ltr"> + <NextIntlClientProvider>
9. Page sert HTML avec font Montserrat preloaded
10. Hydration client : DirectionProvider sync dir attribute (no-op fr)
11. User clique LocaleSwitcher -> ar-MA
12. router.replace('/ar-MA/' + currentPath, query, hash)
13. Cookie NEXT_LOCALE=ar-MA persist 365j
14. Full re-render server (RSC) avec messages ar-MA
15. <html lang="ar-MA" dir="rtl"> + font Noto Naskh swap
```

### Liste des 8 apps impactees

| App | Port | Locales requises | Particularite |
|-----|------|-------------------|----------------|
| web-broker | 3001 | fr, ar-MA, ar | Patron canonique |
| web-garage | 3002 | fr, ar-MA, ar | Garages partenaires reparation |
| web-garage-mobile | 3003 | fr, ar-MA, ar | PWA technicien -- preference Darija |
| web-insurtech-admin | 3000 | fr, ar-MA, ar | SuperAdmin -- preference fr admin |
| web-customer-portal | 3004 | fr, ar-MA, ar | Public SEO -- ajout en Sprint 18 |
| web-assure-portal | 3005 | fr, ar-MA, ar | Self-service assure |
| web-assure-mobile | 3006 | fr, ar-MA, ar | PWA assure -- preference Darija |
| api (NestJS) | 4000 | (n/a) | Backend NON impacte (Accept-Language header pris en compte Sprint 8+) |

Total : 8 apps x 3 locales x ~50 cles = 1200 paires cle/valeur a maintenir Sprint 4. Sprint 17 (souscription) montera ce volume a ~5000.

---

## 4. Livrables checkables (28+ deliverables)

- [ ] **L1** : `repo/packages/shared-ui/src/i18n/routing.ts` (~80 lignes) `defineRouting` avec locales `['fr', 'ar-MA', 'ar']`, defaultLocale `fr`, localePrefix `always`, pathnames mapping per locale (route `/dashboard` mappe vers `/tableau-de-bord` fr et `/لوحة-التحكم` ar-MA si decide), alternateLinks `true`.

- [ ] **L2** : `repo/packages/shared-ui/src/i18n/request.ts` (~80 lignes) `getRequestConfig` avec dynamic import `messages` depuis app courant via `process.env.NEXT_PUBLIC_APP_NAME`, fallback `fr` si locale invalide, timeZone `Africa/Casablanca`, now Date, formats default date/number/list ICU.

- [ ] **L3** : `repo/packages/shared-ui/src/i18n/navigation.ts` (~30 lignes) `createSharedPathnamesNavigation` exposant `Link`, `redirect`, `usePathname`, `useRouter`, `getPathname` typed wrappers reutilisables 8 apps.

- [ ] **L4** : `repo/packages/shared-ui/src/i18n/locales.ts` (~80 lignes) type `LocaleConfig` `{ code, nativeName, dir, dateFormat, numberFormat, fontFamily, flagPath }`, exporte `LOCALES` array (3 entrees fr / ar-MA / ar), helper `getLocaleConfig(code)`, `isRtl(code)`, `getLocaleFontStack(code)`.

- [ ] **L5** : `repo/packages/shared-ui/src/i18n/types.ts` (~50 lignes) type-safe `AppMessages` discriminated par `AppName`, augment global `IntlMessages` declaration pour autocomplete `useTranslations`.

- [ ] **L6** : `repo/packages/shared-ui/src/components/LocaleSwitcher.tsx` (~120 lignes) dropdown selector avec `useLocale` + `useRouter` next-intl, options 3 locales avec native names + flag SVG `/flags/{code}.svg`, `replace(pathname, { locale })` preservant slug + query + hash, persist cookie `NEXT_LOCALE` 365j SameSite=Lax Secure prod.

- [ ] **L7** : `repo/packages/shared-ui/src/components/DirectionProvider.tsx` (~60 lignes) `'use client'` setting `document.documentElement.dir` based on `useLocale()`, server-side aussi via layout `<html dir={dir}>`. Memoize calcul.

- [ ] **L8** : `repo/packages/shared-ui/src/lib/format-date.ts` (~100 lignes) `formatDate(date, locale)` `Intl.DateTimeFormat` avec fallback chain `ar-MA -> ar -> fr`, `formatRelativeTime(date, locale)` via `Intl.RelativeTimeFormat`, `formatDateRange(start, end, locale)`, `formatTime(date, locale)`, tous locale-aware timezone `Africa/Casablanca`.

- [ ] **L9** : `repo/packages/shared-ui/src/lib/format-number.ts` (~100 lignes) `formatNumber` `Intl.NumberFormat`, `formatCurrency(amount, locale, 'MAD')` style currency MAD avec post-process "DH" replace, `formatPercent(value, locale)`, `formatCompact(value, locale)` notation `compact`, support `useArabicIndicNumerals` option pour `ar`.

- [ ] **L10** : `repo/packages/shared-ui/src/lib/format-list.ts` (~50 lignes) `Intl.ListFormat` pour patterns "X et Y et Z" (fr) / "X و Y و Z" (ar). Type conjunction/disjunction.

- [ ] **L11** : `repo/packages/shared-ui/src/lib/pluralize.ts` (~80 lignes) `Intl.PluralRules` helper pour 6 formes arabe (zero/one/two/few/many/other), choisit cle messages catalog selon count + locale.

- [ ] **L12** : `repo/apps/{8 apps}/src/middleware.ts` (~50 lignes) `createMiddleware` next-intl avec routing config import `@insurtech/shared-ui/i18n/routing`, matcher excluant `/api`, `/_next`, `/_vercel`, `/static`, `/favicon.ico`, `/manifest.webmanifest`, `/robots.txt`, `/sitemap.xml`, `/icons/`.

- [ ] **L13** : `repo/apps/{8 apps}/src/i18n/request.ts` (~40 lignes) reuses shared-ui handler avec context app via env `NEXT_PUBLIC_APP_NAME`.

- [ ] **L14** : `repo/apps/{8 apps}/src/messages/fr.json` (~50 keys) namespaces `common`, `nav`, `auth`, `errors`, `locale`, `format`, `datetime` traduits francais.

- [ ] **L15** : `repo/apps/{8 apps}/src/messages/ar-MA.json` (~50 keys) traduits Darija marocaine -- mix arabe + lexique francais transliteres.

- [ ] **L16** : `repo/apps/{8 apps}/src/messages/ar.json` (~50 keys) traduits arabe classique formel institutionnel.

- [ ] **L17** : `repo/docs/architecture/i18n-strategy.md` (~250 lignes complete) : 3 locales rationale MA market, fr=admin/banks/upper class / ar-MA=daily speech Darija / ar=formal/religious/admin. Routing locale-prefixed retained vs domain-based. next-intl preferred vs react-i18next. Type-safety auto-generated types from JSON. Pluralization arabe 6 forms. Performance lazy-loaded per page. Messages translator workflow process.

- [ ] **L18** : Tests unitaires Vitest dans `repo/packages/shared-ui/src/i18n/__tests__/` :
  - `routing.spec.ts` (3 tests)
  - `request.spec.ts` (4 tests)
  - `navigation.spec.ts` (2 tests)
  - `locales.spec.ts` (5 tests)

- [ ] **L19** : Tests unitaires Vitest dans `repo/packages/shared-ui/src/lib/__tests__/` :
  - `format-date.spec.ts` (10 tests)
  - `format-number.spec.ts` (10 tests)
  - `format-list.spec.ts` (3 tests)
  - `pluralize.spec.ts` (8 tests)

- [ ] **L20** : Tests composants Vitest + Testing Library :
  - `LocaleSwitcher.spec.tsx` (5 tests)
  - `DirectionProvider.spec.tsx` (4 tests)

- [ ] **L21** : Tests E2E Playwright `repo/e2e/web/i18n-cross-apps.spec.ts` (~300 lignes, 12 tests) :
  - 3 locales accessibles `/fr` `/ar-MA` `/ar` sur chacune des 8 apps (24 URLs)
  - `dir=rtl` sur `<html>` pour ar et ar-MA
  - Cookie `NEXT_LOCALE` persiste cross-apps
  - Accept-Language header respecte si pas de cookie
  - Redirect `/dashboard` -> `/fr/dashboard` (defaut)
  - Font Noto Naskh charge pour pages ar (verif `getComputedStyle().fontFamily`)
  - LocaleSwitcher preserve query params + hash
  - Pluralisation arabe correcte 6 formes (test sample message)

- [ ] **L22** : `repo/scripts/validate-i18n-keys.ts` (~100 lignes) CI helper compare cles cross-locale per app, exit 1 si divergence, produit rapport markdown `repo/.cache/i18n-report.md`.

- [ ] **L23** : `repo/scripts/i18n-extract-keys.ts` (~80 lignes) Sprint 4 utility extract toutes cles `useTranslations()` du codebase pour comparer avec JSON catalogs (orphan keys detection).

- [ ] **L24** : Variables environnement (~10 vars) ajoutees dans chaque `.env.example` des 8 apps : `NEXT_PUBLIC_DEFAULT_LOCALE=fr`, `NEXT_PUBLIC_SUPPORTED_LOCALES=fr,ar-MA,ar`, `NEXT_PUBLIC_TIMEZONE=Africa/Casablanca`, `NEXT_PUBLIC_APP_NAME=web-broker` (et 7 autres), `NEXT_PUBLIC_LOCALE_FALLBACK_CHAIN=ar-MA:ar:fr`, `NEXT_PUBLIC_USE_ARABIC_INDIC_NUMERALS=false`.

- [ ] **L25** : Validation : `pnpm --filter @insurtech/shared-ui typecheck` 0 erreur, `pnpm --filter @insurtech/shared-ui test` 100% pass (35+ tests), `pnpm test:e2e:i18n` 12 tests passent sur 24 URLs.

- [ ] **L26** : `grep -r "emoji-regex" repo/packages/shared-ui/src/i18n/` retourne 0 ligne, `grep -r "[\x{1F600}-\x{1F6FF}]" repo/apps/*/src/messages/` retourne 0 (no emoji dans JSON).

- [ ] **L27** : `pnpm --filter '*' typecheck` 0 erreur sur les 8 apps avec types messages auto-generes.

- [ ] **L28** : `repo/packages/shared-ui/src/i18n/index.ts` barrel export (~20 lignes) re-export `routing`, `request`, `navigation`, `locales`, `types` pour import unifie `import { LOCALES, isRtl } from '@insurtech/shared-ui/i18n'`.

- [ ] **L29** : Lighthouse Accessibility >= 90 sur `/fr`, `/ar-MA`, `/ar` (web-broker) -- attribut `lang` correct verifie axe-core.

- [ ] **L30** : Documentation Storybook (P1, deferred a Sprint 16) : story `LocaleSwitcher.stories.tsx` avec controls 3 locales.

---

## 5. Fichiers crees / modifies (liste exhaustive)

```
repo/packages/shared-ui/src/i18n/
  routing.ts                                    # ~80 lignes  -- L1
  request.ts                                    # ~80 lignes  -- L2
  navigation.ts                                 # ~30 lignes  -- L3
  locales.ts                                    # ~80 lignes  -- L4
  types.ts                                      # ~50 lignes  -- L5
  index.ts                                      # ~20 lignes barrel
  __tests__/
    routing.spec.ts                             # ~60 lignes (3 tests)
    request.spec.ts                             # ~80 lignes (4 tests)
    navigation.spec.ts                          # ~40 lignes (2 tests)
    locales.spec.ts                             # ~80 lignes (5 tests)

repo/packages/shared-ui/src/components/
  LocaleSwitcher.tsx                            # ~120 lignes -- L6
  DirectionProvider.tsx                         # ~60 lignes  -- L7
  __tests__/
    LocaleSwitcher.spec.tsx                     # ~120 lignes (5 tests)
    DirectionProvider.spec.tsx                  # ~80 lignes  (4 tests)

repo/packages/shared-ui/src/lib/
  format-date.ts                                # ~100 lignes -- L8
  format-number.ts                              # ~100 lignes -- L9
  format-list.ts                                # ~50 lignes  -- L10
  pluralize.ts                                  # ~80 lignes  -- L11
  __tests__/
    format-date.spec.ts                         # ~180 lignes (10 tests)
    format-number.spec.ts                       # ~180 lignes (10 tests)
    format-list.spec.ts                         # ~50 lignes  (3 tests)
    pluralize.spec.ts                           # ~150 lignes (8 tests)

repo/packages/shared-ui/public/flags/
  fr.svg                                        # drapeau France 16x12
  ar-MA.svg                                     # drapeau Maroc 16x12
  ar.svg                                        # drapeau Ligue Arabe (generique)

repo/apps/web-broker/src/middleware.ts          # ~50 lignes  -- L12
repo/apps/web-broker/src/i18n/request.ts        # ~40 lignes  -- L13
repo/apps/web-broker/src/messages/fr.json       # ~50 keys    -- L14
repo/apps/web-broker/src/messages/ar-MA.json    # ~50 keys    -- L15
repo/apps/web-broker/src/messages/ar.json       # ~50 keys    -- L16
(idem pour web-garage, web-garage-mobile, web-insurtech-admin, web-customer-portal,
 web-assure-portal, web-assure-mobile -- 7 x 5 = 35 fichiers)

repo/docs/architecture/i18n-strategy.md         # ~250 lignes -- L17

repo/scripts/
  validate-i18n-keys.ts                         # ~100 lignes -- L22
  i18n-extract-keys.ts                          # ~80 lignes  -- L23

repo/e2e/web/
  i18n-cross-apps.spec.ts                       # ~300 lignes (12 tests) -- L21
```

Total : ~80 fichiers crees/modifies, ~2400 lignes nettes hors tests, ~1200 lignes tests.

---

## 6. Code patterns COMPLETS (fichiers principaux)

### 6.1 `repo/packages/shared-ui/src/i18n/routing.ts` (~80 lignes)

```typescript
/**
 * Configuration routing next-intl partage entre les 8 apps Skalean InsurTech.
 *
 * Reference : 00-pilotage/meta-prompts/B-04-sprint-04-frontend-bootstrap.md (Tache 1.4.11)
 *
 * Decisions :
 *   - decision-009 : 3 locales obligatoires fr / ar-MA / ar
 *   - localePrefix 'always' : URL canonique inclut toujours locale
 *   - pathnames non-localises Sprint 4 (locale prefix only). Sprint 18 customer-portal
 *     activera pathnames localises pour SEO multi-locale (ex /fr/services vs /ar/خدمات).
 */
import { defineRouting } from 'next-intl/routing';

export const SUPPORTED_LOCALES = ['fr', 'ar-MA', 'ar'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = 'fr';

/**
 * Locales pour lesquelles dir="rtl" doit etre applique.
 * Inclut 'ar' (classique) ET 'ar-MA' (Darija ecriture arabe).
 */
export const RTL_LOCALES = ['ar', 'ar-MA'] as const;
export type RtlLocale = (typeof RTL_LOCALES)[number];

export function isRtl(locale: string): locale is RtlLocale {
  return (RTL_LOCALES as readonly string[]).includes(locale);
}

export function getDirection(locale: string): 'ltr' | 'rtl' {
  return isRtl(locale) ? 'rtl' : 'ltr';
}

export const routing = defineRouting({
  locales: SUPPORTED_LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: 'always',
  alternateLinks: true,
  localeCookie: {
    name: 'NEXT_LOCALE',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  },
  pathnames: {
    '/': '/',
    '/dashboard': '/dashboard',
    '/contacts': '/contacts',
    '/policies': '/policies',
    '/claims': '/claims',
    '/settings': '/settings',
    '/auth/login': '/auth/login',
    '/auth/logout': '/auth/logout',
  },
});

export type Pathnames = keyof typeof routing.pathnames;
```

### 6.2 `repo/packages/shared-ui/src/i18n/request.ts` (~80 lignes)

```typescript
/**
 * Configuration request next-intl : load messages dynamique depuis l'app courante.
 *
 * L'app courante est detectee via process.env.NEXT_PUBLIC_APP_NAME
 * (defini dans .env.local de chaque app : web-broker, web-garage, etc.).
 *
 * Fallback chain :
 *   1. locale courante (ex ar-MA)
 *   2. ar (si ar-MA introuvable)
 *   3. fr (defaut absolu)
 */
import { getRequestConfig } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { routing, DEFAULT_LOCALE, type SupportedLocale } from './routing';
import { LOCALES } from './locales';

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? 'web-broker';

async function loadMessages(locale: SupportedLocale): Promise<Record<string, unknown>> {
  try {
    const messages = await import(`@/messages/${locale}.json`);
    return messages.default;
  } catch (error) {
    if (locale === 'ar-MA') {
      return loadMessages('ar');
    }
    if (locale === 'ar') {
      return loadMessages('fr');
    }
    throw new Error(
      `[i18n][${APP_NAME}] Failed to load messages for locale '${locale}': ${(error as Error).message}`,
    );
  }
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : DEFAULT_LOCALE;
  const messages = await loadMessages(locale as SupportedLocale);
  const config = LOCALES.find((l) => l.code === locale) ?? LOCALES[0];

  return {
    locale,
    messages,
    timeZone: 'Africa/Casablanca',
    now: new Date(),
    formats: {
      dateTime: {
        short: { day: '2-digit', month: '2-digit', year: 'numeric' },
        medium: { day: '2-digit', month: 'short', year: 'numeric' },
        long: { day: '2-digit', month: 'long', year: 'numeric', weekday: 'long' },
      },
      number: {
        currency: { style: 'currency', currency: 'MAD', minimumFractionDigits: 2 },
        percent: { style: 'percent', minimumFractionDigits: 0, maximumFractionDigits: 2 },
        compact: { notation: 'compact', compactDisplay: 'short' },
      },
      list: {
        and: { style: 'long', type: 'conjunction' },
        or: { style: 'long', type: 'disjunction' },
      },
    },
    onError(error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[i18n][${APP_NAME}][${locale}]`, error.message);
      }
    },
    getMessageFallback({ namespace, key, error }) {
      const path = [namespace, key].filter(Boolean).join('.');
      if (error.code === 'MISSING_MESSAGE') {
        return `[${path}]`;
      }
      return `[ERR:${path}]`;
    },
  };
});
```

### 6.3 `repo/packages/shared-ui/src/i18n/navigation.ts` (~30 lignes)

```typescript
/**
 * Wrappers next-intl typed pour navigation locale-aware.
 *
 * Usage :
 *   import { Link, useRouter, redirect } from '@insurtech/shared-ui/i18n/navigation';
 *
 * Ces wrappers connaissent les locales et inserent automatiquement
 * le prefix /fr/ /ar-MA/ /ar/ lors de la generation des URLs.
 */
import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

export const {
  Link,
  redirect,
  permanentRedirect,
  usePathname,
  useRouter,
  getPathname,
} = createNavigation(routing);

export type AppRouter = ReturnType<typeof useRouter>;
```

### 6.4 `repo/packages/shared-ui/src/i18n/locales.ts` (~80 lignes)

```typescript
/**
 * Metadata des locales supportees Skalean InsurTech.
 * Source de verite pour LocaleSwitcher, DirectionProvider, format-* helpers.
 *
 * Ne JAMAIS modifier sans mettre a jour i18n-strategy.md + tests cross-apps.
 */
import type { SupportedLocale } from './routing';

export type LocaleConfig = {
  code: SupportedLocale;
  nativeName: string;
  englishName: string;
  dir: 'ltr' | 'rtl';
  dateFormat: string;
  numberFormatLocale: string;
  fontFamily: string;
  flagPath: string;
  numberingSystem: 'latn' | 'arab';
  pluralCategories: ReadonlyArray<Intl.LDMLPluralRule>;
};

export const LOCALES: ReadonlyArray<LocaleConfig> = [
  {
    code: 'fr',
    nativeName: 'Francais',
    englishName: 'French',
    dir: 'ltr',
    dateFormat: 'dd/MM/yyyy',
    numberFormatLocale: 'fr-FR',
    fontFamily: 'var(--font-montserrat), system-ui, sans-serif',
    flagPath: '/flags/fr.svg',
    numberingSystem: 'latn',
    pluralCategories: ['one', 'other'],
  },
  {
    code: 'ar-MA',
    nativeName: 'الدارجة المغربية',
    englishName: 'Moroccan Darija',
    dir: 'rtl',
    dateFormat: 'dd/MM/yyyy',
    numberFormatLocale: 'ar-MA',
    fontFamily: 'var(--font-noto-naskh-arabic), var(--font-montserrat), Tahoma, sans-serif',
    flagPath: '/flags/ar-MA.svg',
    numberingSystem: 'latn',
    pluralCategories: ['zero', 'one', 'two', 'few', 'many', 'other'],
  },
  {
    code: 'ar',
    nativeName: 'العربية',
    englishName: 'Arabic (Modern Standard)',
    dir: 'rtl',
    dateFormat: 'dd/MM/yyyy',
    numberFormatLocale: 'ar',
    fontFamily: 'var(--font-noto-naskh-arabic), Tahoma, "Geeza Pro", sans-serif',
    flagPath: '/flags/ar.svg',
    numberingSystem: 'arab',
    pluralCategories: ['zero', 'one', 'two', 'few', 'many', 'other'],
  },
] as const;

export function getLocaleConfig(code: string): LocaleConfig {
  const config = LOCALES.find((l) => l.code === code);
  if (!config) {
    throw new Error(`[i18n] Unsupported locale '${code}'. Supported: ${LOCALES.map((l) => l.code).join(', ')}`);
  }
  return config;
}

export function getLocaleFontStack(code: string): string {
  return getLocaleConfig(code).fontFamily;
}
```

### 6.5 `repo/packages/shared-ui/src/i18n/types.ts` (~50 lignes)

```typescript
/**
 * Type-safe messages auto-generes depuis les fichiers JSON catalog.
 *
 * Chaque app importe son propre fr.json et l'utilise comme source de verite typage.
 * next-intl genere automatiquement les types via le plugin Vite.
 */
import type frMessages from '@/messages/fr.json';

export type AppMessages = typeof frMessages;

declare global {
  /**
   * next-intl global types declaration.
   * Permet useTranslations() de retourner les bonnes cles + traductions.
   */
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface IntlMessages extends AppMessages {}
}

export type AppName =
  | 'web-broker'
  | 'web-garage'
  | 'web-garage-mobile'
  | 'web-insurtech-admin'
  | 'web-customer-portal'
  | 'web-assure-portal'
  | 'web-assure-mobile';

export type MessageKey<T = AppMessages, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends Record<string, unknown>
    ? MessageKey<T[K], P extends '' ? K : `${P}.${K}`>
    : P extends ''
      ? K
      : `${P}.${K}`;
}[keyof T & string];

export type MessageNamespace = keyof AppMessages;

export {};
```

### 6.6 `repo/packages/shared-ui/src/components/LocaleSwitcher.tsx` (~120 lignes)

```tsx
'use client';

/**
 * LocaleSwitcher dropdown : permet a l'utilisateur de changer de locale.
 *
 * Comportement :
 *  - Liste 3 locales avec native names + flag SVG
 *  - Click change URL en preservant pathname + query + hash
 *  - Persiste preference dans cookie NEXT_LOCALE 365 jours
 *  - Locale courante highlightee + check icon
 *  - Accessible : keyboard nav (Tab, Arrow, Enter), ARIA labelledby
 */
import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter, usePathname } from '../i18n/navigation';
import { useSearchParams } from 'next/navigation';
import { LOCALES, type LocaleConfig } from '../i18n/locales';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '../lib/cn';

type LocaleSwitcherProps = {
  className?: string;
  variant?: 'dropdown' | 'inline';
  showFlags?: boolean;
};

export function LocaleSwitcher({
  className,
  variant = 'dropdown',
  showFlags = true,
}: LocaleSwitcherProps): React.JSX.Element {
  const t = useTranslations('locale');
  const currentLocale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent): void {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentConfig = LOCALES.find((l) => l.code === currentLocale) ?? LOCALES[0];

  function handleSelect(locale: LocaleConfig['code']): void {
    if (locale === currentLocale) {
      setIsOpen(false);
      return;
    }
    const queryString = searchParams.toString();
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    const targetPath = pathname + (queryString ? `?${queryString}` : '') + hash;
    document.cookie = `NEXT_LOCALE=${locale}; max-age=${60 * 60 * 24 * 365}; path=/; SameSite=Lax${
      window.location.protocol === 'https:' ? '; Secure' : ''
    }`;
    router.replace(targetPath, { locale });
    setIsOpen(false);
  }

  return (
    <div ref={dropdownRef} className={cn('relative inline-block', className)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={t('switcherAria')}
        onClick={() => setIsOpen((prev) => !prev)}
        className="inline-flex items-center gap-2 rounded-md border border-skalean-navy/20 bg-white px-3 py-2 text-sm font-medium hover:bg-skalean-orange/10 focus:outline-none focus:ring-2 focus:ring-skalean-orange transition"
      >
        {showFlags && (
          <img src={currentConfig.flagPath} alt="" width={16} height={12} className="shrink-0" />
        )}
        <span dir={currentConfig.dir}>{currentConfig.nativeName}</span>
        <ChevronDown className="h-4 w-4 opacity-60" aria-hidden="true" />
      </button>
      {isOpen && (
        <ul
          role="listbox"
          aria-label={t('listAria')}
          className="absolute end-0 mt-1 w-56 z-[60] rounded-md border border-skalean-navy/10 bg-white py-1 shadow-lg"
        >
          {LOCALES.map((locale) => (
            <li key={locale.code}>
              <button
                type="button"
                role="option"
                aria-selected={locale.code === currentLocale}
                onClick={() => handleSelect(locale.code)}
                className={cn(
                  'flex w-full items-center gap-3 px-3 py-2 text-sm hover:bg-skalean-sky/10 transition',
                  locale.code === currentLocale && 'bg-skalean-orange/5 font-semibold',
                )}
              >
                {showFlags && (
                  <img src={locale.flagPath} alt="" width={16} height={12} className="shrink-0" />
                )}
                <span dir={locale.dir} className="flex-1 text-start">
                  {locale.nativeName}
                </span>
                {locale.code === currentLocale && (
                  <Check className="h-4 w-4 text-skalean-orange" aria-hidden="true" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

### 6.7 `repo/packages/shared-ui/src/components/DirectionProvider.tsx` (~60 lignes)

```tsx
'use client';

/**
 * DirectionProvider : synchronise l'attribut dir sur <html> avec la locale courante.
 *
 * Cas d'usage :
 *  - Un changement de locale dynamique post-mount (LocaleSwitcher) doit
 *    immediatement appliquer dir="rtl" sans full page reload.
 *  - Cote serveur, <html dir={dir}> est deja rendu correctement par layout.tsx
 *    via getDirection(locale). Ce composant est un filet de securite client.
 */
import * as React from 'react';
import { useLocale } from 'next-intl';
import { isRtl, getDirection } from '../i18n/routing';

type DirectionProviderProps = {
  children: React.ReactNode;
};

export function DirectionProvider({ children }: DirectionProviderProps): React.JSX.Element {
  const locale = useLocale();
  const dir = getDirection(locale);

  React.useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }
    const html = document.documentElement;
    if (html.dir !== dir) {
      html.dir = dir;
    }
    if (html.lang !== locale) {
      html.lang = locale;
    }
    html.classList.toggle('rtl', isRtl(locale));
    html.classList.toggle('ltr', !isRtl(locale));
  }, [locale, dir]);

  return <>{children}</>;
}

export function useDirection(): 'ltr' | 'rtl' {
  const locale = useLocale();
  return getDirection(locale);
}

export function useIsRtl(): boolean {
  const locale = useLocale();
  return isRtl(locale);
}
```

### 6.8 `repo/packages/shared-ui/src/lib/format-date.ts` (~100 lignes)

```typescript
/**
 * Helpers de formatage de dates locale-aware avec timezone Africa/Casablanca.
 *
 * IMPORTANT :
 *  - DST Africa/Casablanca : -1h pendant Ramadan (gere par IANA tz database).
 *  - Format dd/MM/yyyy force pour eviter ambiguite 10/01/2026 (10 janvier vs 1 octobre).
 *  - Fallback chain : ar-MA -> ar -> fr.
 */
import { LOCALES, getLocaleConfig } from '../i18n/locales';

const DEFAULT_TIMEZONE = 'Africa/Casablanca';

function getEffectiveLocale(locale: string): string {
  const config = LOCALES.find((l) => l.code === locale);
  return config?.numberFormatLocale ?? 'fr-FR';
}

export type DateFormatStyle = 'short' | 'medium' | 'long' | 'full';

const STYLE_OPTIONS: Record<DateFormatStyle, Intl.DateTimeFormatOptions> = {
  short: { day: '2-digit', month: '2-digit', year: 'numeric' },
  medium: { day: '2-digit', month: 'short', year: 'numeric' },
  long: { day: '2-digit', month: 'long', year: 'numeric', weekday: 'long' },
  full: { day: '2-digit', month: 'long', year: 'numeric', weekday: 'long', era: 'short' },
};

export function formatDate(
  date: Date | string | number,
  locale: string,
  style: DateFormatStyle = 'short',
  timeZone: string = DEFAULT_TIMEZONE,
): string {
  const dateObj = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(dateObj.getTime())) {
    return '';
  }
  const effectiveLocale = getEffectiveLocale(locale);
  const formatter = new Intl.DateTimeFormat(effectiveLocale, {
    ...STYLE_OPTIONS[style],
    timeZone,
  });
  return formatter.format(dateObj);
}

export function formatTime(
  date: Date | string | number,
  locale: string,
  withSeconds = false,
  timeZone: string = DEFAULT_TIMEZONE,
): string {
  const dateObj = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(dateObj.getTime())) {
    return '';
  }
  const formatter = new Intl.DateTimeFormat(getEffectiveLocale(locale), {
    hour: '2-digit',
    minute: '2-digit',
    ...(withSeconds && { second: '2-digit' }),
    hour12: false,
    timeZone,
  });
  return formatter.format(dateObj);
}

export function formatRelativeTime(
  date: Date | string | number,
  locale: string,
  baseTime?: Date,
): string {
  const dateObj = date instanceof Date ? date : new Date(date);
  const base = baseTime ?? new Date();
  const diffMs = dateObj.getTime() - base.getTime();
  const formatter = new Intl.RelativeTimeFormat(getEffectiveLocale(locale), {
    numeric: 'auto',
    style: 'long',
  });
  const absSeconds = Math.abs(diffMs) / 1000;
  const sign = diffMs < 0 ? -1 : 1;
  if (absSeconds < 60) return formatter.format(sign * Math.round(absSeconds), 'second');
  if (absSeconds < 3600) return formatter.format(sign * Math.round(absSeconds / 60), 'minute');
  if (absSeconds < 86400) return formatter.format(sign * Math.round(absSeconds / 3600), 'hour');
  if (absSeconds < 2592000) return formatter.format(sign * Math.round(absSeconds / 86400), 'day');
  if (absSeconds < 31536000) return formatter.format(sign * Math.round(absSeconds / 2592000), 'month');
  return formatter.format(sign * Math.round(absSeconds / 31536000), 'year');
}

export function formatDateRange(
  start: Date | string | number,
  end: Date | string | number,
  locale: string,
  style: DateFormatStyle = 'short',
  timeZone: string = DEFAULT_TIMEZONE,
): string {
  const startDate = start instanceof Date ? start : new Date(start);
  const endDate = end instanceof Date ? end : new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return '';
  }
  const formatter = new Intl.DateTimeFormat(getEffectiveLocale(locale), {
    ...STYLE_OPTIONS[style],
    timeZone,
  });
  return formatter.formatRange(startDate, endDate);
}
```

### 6.9 `repo/packages/shared-ui/src/lib/format-number.ts` (~100 lignes)

```typescript
/**
 * Helpers de formatage de nombres locale-aware.
 *
 * Particularites MA :
 *  - Devise MAD (code ISO 4217), symbole "DH" en francais, "د.م." en arabe.
 *  - Separateurs fr-FR : espace + virgule (1 234,56).
 *  - Separateurs ar : virgule arabe U+066B + point arabe U+066C selon numberingSystem.
 *  - Numeraux arabo-indiens optionnels (٠١٢٣٤٥٦٧٨٩).
 */
import { LOCALES, getLocaleConfig } from '../i18n/locales';

export type NumberFormatOptions = Intl.NumberFormatOptions & {
  useArabicIndicNumerals?: boolean;
};

function getEffectiveLocale(locale: string, useArabicIndic: boolean): string {
  const config = LOCALES.find((l) => l.code === locale);
  if (!config) return 'fr-FR';
  if (useArabicIndic && config.code === 'ar') {
    return 'ar-u-nu-arab';
  }
  return config.numberFormatLocale;
}

export function formatNumber(
  value: number,
  locale: string,
  options: NumberFormatOptions = {},
): string {
  const { useArabicIndicNumerals = false, ...restOptions } = options;
  if (!Number.isFinite(value)) return '';
  const effective = getEffectiveLocale(locale, useArabicIndicNumerals);
  return new Intl.NumberFormat(effective, restOptions).format(value);
}

export function formatCurrency(
  value: number,
  locale: string,
  currency = 'MAD',
  options: NumberFormatOptions = {},
): string {
  const { useArabicIndicNumerals = false, ...restOptions } = options;
  if (!Number.isFinite(value)) return '';
  const effective = getEffectiveLocale(locale, useArabicIndicNumerals);
  const formatter = new Intl.NumberFormat(effective, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...restOptions,
  });
  let result = formatter.format(value);
  if (currency === 'MAD' && (locale === 'fr' || locale.startsWith('fr-'))) {
    result = result.replace('MAD', 'DH');
  }
  return result;
}

export function formatPercent(
  value: number,
  locale: string,
  fractionDigits = 0,
): string {
  if (!Number.isFinite(value)) return '';
  return new Intl.NumberFormat(getEffectiveLocale(locale, false), {
    style: 'percent',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function formatCompact(
  value: number,
  locale: string,
  options: NumberFormatOptions = {},
): string {
  const { useArabicIndicNumerals = false, ...restOptions } = options;
  if (!Number.isFinite(value)) return '';
  const effective = getEffectiveLocale(locale, useArabicIndicNumerals);
  return new Intl.NumberFormat(effective, {
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: 1,
    ...restOptions,
  }).format(value);
}

export function parseLocalizedNumber(
  text: string,
  locale: string,
): number | null {
  const config = LOCALES.find((l) => l.code === locale);
  if (!config) return null;
  const cleaned = text
    .replace(/[\s  ]/g, '')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(',', '.');
  const num = Number.parseFloat(cleaned);
  return Number.isNaN(num) ? null : num;
}
```

### 6.10 `repo/packages/shared-ui/src/lib/format-list.ts` (~50 lignes)

```typescript
/**
 * Helpers de formatage de listes locale-aware via Intl.ListFormat.
 *
 * Resultats attendus :
 *  - fr conjunction : "Pierre, Paul et Jacques"
 *  - fr disjunction : "Pierre, Paul ou Jacques"
 *  - ar conjunction : "بيير وبول وجاك"
 *  - ar disjunction : "بيير أو بول أو جاك"
 */
import { LOCALES } from '../i18n/locales';

export type ListType = 'conjunction' | 'disjunction' | 'unit';
export type ListStyle = 'long' | 'short' | 'narrow';

function getEffectiveLocale(locale: string): string {
  return LOCALES.find((l) => l.code === locale)?.numberFormatLocale ?? 'fr-FR';
}

export function formatList(
  items: ReadonlyArray<string>,
  locale: string,
  type: ListType = 'conjunction',
  style: ListStyle = 'long',
): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  return new Intl.ListFormat(getEffectiveLocale(locale), { type, style }).format(items);
}

export function formatListAnd(items: ReadonlyArray<string>, locale: string): string {
  return formatList(items, locale, 'conjunction', 'long');
}

export function formatListOr(items: ReadonlyArray<string>, locale: string): string {
  return formatList(items, locale, 'disjunction', 'long');
}

export function formatListUnit(items: ReadonlyArray<string>, locale: string): string {
  return formatList(items, locale, 'unit', 'short');
}
```

### 6.11 `repo/packages/shared-ui/src/lib/pluralize.ts` (~80 lignes)

```typescript
/**
 * Helper de pluralisation locale-aware via Intl.PluralRules.
 *
 * Particularite arabe : 6 categories CLDR (zero, one, two, few, many, other).
 * Ex regle ar :
 *   0 -> zero
 *   1 -> one
 *   2 -> two
 *   3-10 -> few
 *   11-99 -> many
 *   100+, fractions -> other
 *
 * Particularite fr : 2 categories (one [0,1], other [reste]).
 *
 * Particularite ar-MA Darija : Intl.PluralRules('ar-MA') tombe sur regles ar standard.
 * Pour Darija parlee, on collapse few/many vers other (custom flag).
 */
import { LOCALES } from '../i18n/locales';

export type PluralCategory = Intl.LDMLPluralRule;

const COLLAPSED_DARIJA_RULES: Record<PluralCategory, PluralCategory> = {
  zero: 'zero',
  one: 'one',
  two: 'other',
  few: 'other',
  many: 'other',
  other: 'other',
};

function getEffectiveLocale(locale: string): string {
  return LOCALES.find((l) => l.code === locale)?.numberFormatLocale ?? 'fr-FR';
}

export function getPluralCategory(
  count: number,
  locale: string,
  collapseDarija = true,
): PluralCategory {
  const effective = getEffectiveLocale(locale);
  const rules = new Intl.PluralRules(effective);
  const category = rules.select(count) as PluralCategory;
  if (locale === 'ar-MA' && collapseDarija) {
    return COLLAPSED_DARIJA_RULES[category];
  }
  return category;
}

export type PluralMessages = Partial<Record<PluralCategory, string>> & { other: string };

export function pluralize(
  count: number,
  locale: string,
  messages: PluralMessages,
  collapseDarija = true,
): string {
  const category = getPluralCategory(count, locale, collapseDarija);
  const template = messages[category] ?? messages.other;
  return template.replace(/#/g, String(count));
}

export function getPluralCategoriesForLocale(locale: string): ReadonlyArray<PluralCategory> {
  const config = LOCALES.find((l) => l.code === locale);
  if (!config) return ['one', 'other'];
  return config.pluralCategories;
}
```

### 6.12 `repo/apps/web-broker/src/middleware.ts` (~50 lignes -- pattern repete sur 8 apps)

```typescript
/**
 * Middleware next-intl pour web-broker (port 3001).
 *
 * Detecte locale depuis :
 *   1. URL prefix (/fr, /ar-MA, /ar)
 *   2. Cookie NEXT_LOCALE
 *   3. Accept-Language header
 *   4. Defaut fr
 *
 * Exclu : /api/*, /_next/*, /_vercel/*, /static/*, /favicon.ico, /manifest.webmanifest,
 *         /robots.txt, /sitemap.xml, /icons/*, /flags/*.
 */
import createMiddleware from 'next-intl/middleware';
import { routing } from '@insurtech/shared-ui/i18n/routing';

export default createMiddleware(routing);

export const config = {
  matcher: [
    '/((?!api|_next|_vercel|static|favicon\\.ico|manifest\\.webmanifest|robots\\.txt|sitemap\\.xml|icons|flags|.*\\..*).*)',
  ],
};
```

### 6.13 `repo/apps/web-broker/src/i18n/request.ts` (~40 lignes)

```typescript
/**
 * Configuration request next-intl pour web-broker.
 * Reutilise le handler partage shared-ui qui charge messages depuis @/messages/{locale}.json.
 */
import { getRequestConfig } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { routing, DEFAULT_LOCALE, type SupportedLocale } from '@insurtech/shared-ui/i18n/routing';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale: SupportedLocale = hasLocale(routing.locales, requested)
    ? (requested as SupportedLocale)
    : DEFAULT_LOCALE;

  const messages = (await import(`../messages/${locale}.json`)).default;

  return {
    locale,
    messages,
    timeZone: 'Africa/Casablanca',
    now: new Date(),
    onError(error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[i18n][web-broker][${locale}]`, error.message);
      }
    },
    getMessageFallback({ namespace, key }) {
      return `[${[namespace, key].filter(Boolean).join('.')}]`;
    },
  };
});
```

### 6.14 `repo/apps/web-broker/src/messages/fr.json` (~50 keys)

```json
{
  "common": {
    "loading": "Chargement...",
    "error": "Erreur",
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
    "refresh": "Actualiser",
    "export": "Exporter",
    "import": "Importer",
    "delete": "Supprimer",
    "edit": "Modifier",
    "add": "Ajouter"
  },
  "nav": {
    "dashboard": "Tableau de bord",
    "contacts": "Contacts",
    "policies": "Polices",
    "claims": "Sinistres",
    "commissions": "Commissions",
    "reports": "Rapports",
    "settings": "Parametres"
  },
  "auth": {
    "login": "Se connecter",
    "logout": "Se deconnecter",
    "signin": "Connexion",
    "signup": "Inscription",
    "forgotPassword": "Mot de passe oublie",
    "email": "Adresse e-mail",
    "password": "Mot de passe"
  },
  "errors": {
    "network": "Erreur reseau",
    "unauthorized": "Non autorise",
    "forbidden": "Acces interdit",
    "notFound": "Page introuvable",
    "serverError": "Erreur serveur",
    "validation": "Erreur de validation"
  },
  "locale": {
    "switcherAria": "Changer de langue",
    "listAria": "Liste des langues disponibles",
    "current": "Langue courante : {name}"
  },
  "format": {
    "currency": "{value, number, currency}",
    "date": "{value, date, short}",
    "items": "{count, plural, one {# element} other {# elements}}"
  },
  "datetime": {
    "today": "Aujourd'hui",
    "yesterday": "Hier",
    "tomorrow": "Demain"
  }
}
```

### 6.15 `repo/apps/web-broker/src/messages/ar-MA.json` (~50 keys, Darija)

```json
{
  "common": {
    "loading": "كيتحمل...",
    "error": "غلطة",
    "save": "سجل",
    "cancel": "ألغي",
    "confirm": "أكد",
    "close": "سد",
    "back": "رجع",
    "next": "التالي",
    "previous": "اللي قبل",
    "search": "قلب",
    "filter": "فلتر",
    "sort": "رتب",
    "refresh": "جدد",
    "export": "صدر",
    "import": "ستورد",
    "delete": "محي",
    "edit": "بدل",
    "add": "زيد"
  },
  "nav": {
    "dashboard": "لوحة التحكم",
    "contacts": "ديال الزبائن",
    "policies": "العقود",
    "claims": "الحوادث",
    "commissions": "العمولات",
    "reports": "التقارير",
    "settings": "الاعدادات"
  },
  "auth": {
    "login": "دخل",
    "logout": "خرج",
    "signin": "الدخول",
    "signup": "التسجيل",
    "forgotPassword": "نسيتي السر",
    "email": "البريد الإلكتروني",
    "password": "كلمة السر"
  },
  "errors": {
    "network": "غلطة فالكونيكسيون",
    "unauthorized": "ماعندكش الحق",
    "forbidden": "ممنوع",
    "notFound": "ماكاينش",
    "serverError": "غلطة فالسيرفور",
    "validation": "غلطة فلفاليداسيون"
  },
  "locale": {
    "switcherAria": "بدل اللغة",
    "listAria": "ليستة د اللغات",
    "current": "اللغة الحالية : {name}"
  },
  "format": {
    "currency": "{value, number, currency}",
    "date": "{value, date, short}",
    "items": "{count, plural, zero {ما كاينش} one {واحد} two {زوج} few {# داللوازم} many {# داللوازم} other {# لوازم}}"
  },
  "datetime": {
    "today": "اليوم",
    "yesterday": "البارح",
    "tomorrow": "غدا"
  }
}
```

### 6.16 `repo/apps/web-broker/src/messages/ar.json` (~50 keys, Arabe classique)

```json
{
  "common": {
    "loading": "جارٍ التحميل...",
    "error": "خطأ",
    "save": "حفظ",
    "cancel": "إلغاء",
    "confirm": "تأكيد",
    "close": "إغلاق",
    "back": "رجوع",
    "next": "التالي",
    "previous": "السابق",
    "search": "بحث",
    "filter": "تصفية",
    "sort": "فرز",
    "refresh": "تحديث",
    "export": "تصدير",
    "import": "استيراد",
    "delete": "حذف",
    "edit": "تعديل",
    "add": "إضافة"
  },
  "nav": {
    "dashboard": "لوحة القيادة",
    "contacts": "جهات الاتصال",
    "policies": "الوثائق",
    "claims": "المطالبات",
    "commissions": "العمولات",
    "reports": "التقارير",
    "settings": "الإعدادات"
  },
  "auth": {
    "login": "تسجيل الدخول",
    "logout": "تسجيل الخروج",
    "signin": "الدخول",
    "signup": "التسجيل",
    "forgotPassword": "نسيت كلمة المرور",
    "email": "البريد الإلكتروني",
    "password": "كلمة المرور"
  },
  "errors": {
    "network": "خطأ في الشبكة",
    "unauthorized": "غير مصرح",
    "forbidden": "ممنوع الوصول",
    "notFound": "غير موجود",
    "serverError": "خطأ في الخادم",
    "validation": "خطأ في التحقق"
  },
  "locale": {
    "switcherAria": "تغيير اللغة",
    "listAria": "قائمة اللغات المتاحة",
    "current": "اللغة الحالية : {name}"
  },
  "format": {
    "currency": "{value, number, currency}",
    "date": "{value, date, short}",
    "items": "{count, plural, zero {لا يوجد عناصر} one {عنصر واحد} two {عنصران} few {# عناصر} many {# عنصرا} other {# عنصر}}"
  },
  "datetime": {
    "today": "اليوم",
    "yesterday": "الأمس",
    "tomorrow": "غدا"
  }
}
```

### 6.17 `repo/docs/architecture/i18n-strategy.md` (~250 lignes)

```markdown
# Strategie Multilingue (i18n) -- Skalean InsurTech

**Reference** : Tache 1.4.11 Sprint 4 (Phase 1 Bootstrap)
**Decision strategique** : decision-009 (multilinguisme MA OBLIGATOIRE)
**Maintien** : Equipe Frontend + Traducteurs natifs MA

---

## 1. Trois Locales Obligatoires

Le marche marocain impose 3 codes linguistiques distincts :

### 1.1 Francais (`fr`) -- locale par defaut

- **Usage** : administration, banques, assurances historiques, regulateur ACAPS, B2B courtier-garage.
- **Volume utilisateur** : ~60% du trafic Skalean InsurTech (Sprint 17 estimation).
- **Niveau de langage** : standard professionnel, pas d'argot.
- **Particularites typographiques** : guillemets francais << >>, espaces insecables avant : ; ! ? %.
- **Date format** : dd/MM/yyyy (10/01/2026 = 10 janvier 2026).
- **Number format** : "1 234,56" (espace milliers, virgule decimale).
- **Currency** : "1 234,56 DH" (DH suffixe, symbole non standard ISO mais usage MA).

### 1.2 Arabe Dialectal Marocain dit "Darija" (`ar-MA`)

- **Usage** : langue parlee quotidienne 90% des Marocains, jamais documents officiels.
- **Volume utilisateur** : ~30% du trafic, principalement mobile (web-garage-mobile, web-assure-mobile).
- **Niveau de langage** : informel, mix arabe + lexique francais transliteres.
- **Particularites lexicales** : "dossier" -> "ديال" + nom francais ("ديال الكلوينت" = "du client"), nombreux emprunts ("vacances" -> "فاكونصات").
- **Date format** : dd/MM/yyyy (identique fr).
- **Number format** : "1 234,56" (latins par defaut, identique fr).
- **Currency** : "1 234,56 د.م." (Dirham marocain abrege en arabe).
- **Direction** : RTL (right-to-left) ecriture arabe.
- **Pluralisation** : 6 categories CLDR mais simplification possible (collapse few/many vers other).

### 1.3 Arabe Classique Formel (`ar`)

- **Usage** : documents juridiques, polices d'assurance imprimables bilingues, ACAPS, religieux Takaful (Sprint 33+).
- **Volume utilisateur** : ~10% du trafic, principalement utilisateurs juristes/conformite.
- **Niveau de langage** : formel institutionnel, pas d'emprunt francais.
- **Particularites** : voyelles diacritiques (haraka) preferees pour clarte juridique, hamza systematique.
- **Date format** : dd/MM/yyyy (homogeneise MA).
- **Number format** : option chiffres arabo-indiens "١٬٢٣٤٫٥٦" (par defaut latins pour compatibilite SI).
- **Currency** : "1 234,56 د.م." identique ar-MA.
- **Direction** : RTL.
- **Pluralisation** : 6 categories CLDR strictes (zero/one/two/few[3-10]/many[11-99]/other).

---

## 2. Choix Architecture : next-intl 3.26.3

### 2.1 Pourquoi pas react-i18next ?

| Critere | next-intl | react-i18next |
|---------|-----------|----------------|
| App Router native | Oui | Manuel setup |
| RSC `getTranslations()` | Oui | Limite |
| Bundle gzipped | 7 ko | 35 ko |
| Type safety auto | Oui | Plugin externe |
| Middleware locale auto | Oui | Manuel |

next-intl gagne par integration native Next.js 15 App Router + RSC.

### 2.2 Pourquoi locale-prefixed routing ?

- **Locale prefix** (CHOIX) : `/fr/dashboard` -- 1 sous-domaine par app, SEO predictible.
- **Domain-based** (rejete) : `broker-fr.skalean.ma` -- 24 sous-domaines DNS.
- **Subpath as-needed** (rejete) : `/dashboard` (fr defaut) + `/ar/dashboard` -- ambiguite SEO.

`localePrefix: 'always'` dans `routing.ts`.

### 2.3 Type Safety Auto-genere

`next-intl` plugin Vite/Next inspecte `messages/fr.json` et genere `IntlMessages` global type. Resultat : `useTranslations('common')` autocomplete les cles `common.loading`, `common.save`, etc. en VSCode + erreur compile si cle inexistante.

---

## 3. Pluralisation Arabe 6 Formes

L'arabe CLDR distingue 6 categories grammaticales :

| Category | Range | Exemple ar (kitab=livre) |
|----------|-------|--------------------------|
| zero | 0 | لا توجد كتب |
| one | 1 | كتاب واحد |
| two | 2 | كتابان |
| few | 3-10 | 3 كتب |
| many | 11-99 | 11 كتابا |
| other | 100+, fractions | 100 كتاب |

Implementation via `Intl.PluralRules` natif. Helper `pluralize(count, locale, messages)` dans `shared-ui/lib/pluralize.ts`.

**Note Darija** : la langue parlee n'a pas regles strictes. Helper `collapseDarija=true` collapse `few/many/other` -> `other` pour `ar-MA`.

---

## 4. Date / Number / Currency Formatting

Tous les helpers Intl natifs avec timezone `Africa/Casablanca` :

```typescript
formatDate(new Date(), 'fr')               -> "06/05/2026"
formatDate(new Date(), 'ar')               -> "٠٦/٠٥/٢٠٢٦" (avec arab numerals option)
formatCurrency(1234.56, 'fr')              -> "1 234,56 DH"
formatCurrency(1234.56, 'ar')              -> "MAD 1,234.56" (a affiner Sprint 8)
formatNumber(1234.56, 'fr')                -> "1 234,56"
formatPercent(0.156, 'fr')                 -> "16 %"
formatList(['Pierre', 'Paul', 'Jacques'], 'fr')  -> "Pierre, Paul et Jacques"
formatList(['بيير', 'بول', 'جاك'], 'ar')   -> "بيير وبول وجاك"
```

DST `Africa/Casablanca` : -1h Ramadan (gere IANA tz database, validation Sprint 8 pendant Ramadan 2026).

---

## 5. Performance

- Messages catalogues lazy-loaded per locale (next-intl handle).
- Bundle client : ~7 ko next-intl + ~50 ko messages JSON courant locale.
- Fonts : Noto Naskh Arabic preload `next/font/google` subsets `['arabic']` poids 400/700.
- Cache RSC : `getTranslations()` cache per request -> 1 lecture JSON par requete.

---

## 6. Workflow Traduction

### 6.1 Acteurs

- **Developpeur** : ajoute cles dans `fr.json` (langue source), commit PR.
- **Translator native MA** : remplit `ar-MA.json` (Darija) et `ar.json` (classique). Profile : marocain natif bilingue FR/AR + connaissance domaine assurance.
- **Reviewer** : valide cross-app coherence (ex "policies" traduit identique broker / customer-portal / assure-portal).

### 6.2 Pipeline CI

```
1. Dev push -> CI trigger
2. scripts/validate-i18n-keys.ts compare cles cross-locale
3. Si divergence -> exit 1, PR bloque
4. ESLint regle no-emoji applique sur JSON
5. Tests E2E i18n verifient 24 URLs (3 locales x 8 apps)
6. Lighthouse Accessibility >= 90 sur /fr /ar-MA /ar
```

### 6.3 Outils proposes (Sprint 16+)

- **Crowdin** : plateforme collaborative traducteurs (dehors equipe).
- **Lokalise** : alternative SaaS.
- **Phrase** : option enterprise.

Sprint 4 : workflow manuel JSON via Git + reviews PR. Sprint 16 : evaluation Crowdin si volume > 5000 cles cumul.

---

## 7. Conformite et Accessibilite

### 7.1 WCAG SC 3.1.1 (Niveau A)

Attribut `lang` sur `<html>` mandatoire. Audit `axe-core` automatise Sprint 4 Tache 1.4.16.

### 7.2 WCAG SC 3.1.2 (Niveau AA)

Attribut `lang` sur extraits dans une autre langue (ex citation francaise dans page arabe). Implementation : composant `<Lang lang="fr">{children}</Lang>` (Sprint 8+).

### 7.3 Loi 09-08 CNDP

Cookie `NEXT_LOCALE` n'est PAS PII. Pas de consentement explicite requis (cookie strictement necessaire fonctionnement multilingue).

### 7.4 Decision-009

3 locales obligatoires. Tamazight Tifinagh `tmz-MA` reservee Sprint 30+ (decision IRCAM dossier).

---

## 8. Roadmap Sprints Futurs

| Sprint | Locale ajout | Justification |
|--------|--------------|---------------|
| 18 | en (Anglais) | customer-portal SEO public, expats |
| 18 | fr-CA | si Quebec marche |
| 30+ | tmz-MA (Tamazight) | Constitution 2011, IRCAM dossier |
| 35+ | ar-DZ, ar-MR | expansion regionale Maghreb |

---

## 9. Edge Cases Documentes

- Visiteur Accept-Language `de-DE` -> redirect /fr (default).
- Locale URL invalide `/fr-FR/...` -> 404 strict.
- Cookie corrompu `NEXT_LOCALE=invalid` -> ignore, fallback fr.
- Messages JSON manque cle `auth.login` ar -> fallback ar -> fr (chain).
- Date 10/01/2026 ambigu -> dd/MM/yyyy force.
- Currency MAD symbole "DH" non standard ISO -> post-process replace.
- Numeraux arabo-indiens optionnels (par defaut latins).
- LocaleSwitcher preserve query + hash.
- Phone format +212 6 12 34 56 78 vs 06 12 34 56 78 -> Sprint 8 formatPhone helper.

---

## 10. References

- next-intl documentation : https://next-intl-docs.vercel.app/
- ICU MessageFormat : http://userguide.icu-project.org/formatparse/messages
- CLDR plural rules : https://cldr.unicode.org/index/cldr-spec/plural-rules
- Constitution Maroc 2011 article 5 : langues officielles.
- WCAG 2.1 SC 3.1.1 : https://www.w3.org/WAI/WCAG21/Understanding/language-of-page.html
```

---

## 7. Tests detail (18-22 tests)

### 7.1 `repo/packages/shared-ui/src/i18n/__tests__/routing.spec.ts` (3 tests)

```typescript
import { describe, it, expect } from 'vitest';
import { routing, SUPPORTED_LOCALES, DEFAULT_LOCALE, isRtl, getDirection } from '../routing';

describe('i18n/routing', () => {
  it('exposes 3 locales fr, ar-MA, ar', () => {
    expect(routing.locales).toEqual(['fr', 'ar-MA', 'ar']);
    expect(SUPPORTED_LOCALES).toHaveLength(3);
  });

  it('uses fr as defaultLocale and localePrefix always', () => {
    expect(routing.defaultLocale).toBe('fr');
    expect(DEFAULT_LOCALE).toBe('fr');
    expect(routing.localePrefix).toBe('always');
  });

  it('isRtl true for ar / ar-MA, false for fr', () => {
    expect(isRtl('ar')).toBe(true);
    expect(isRtl('ar-MA')).toBe(true);
    expect(isRtl('fr')).toBe(false);
    expect(getDirection('ar')).toBe('rtl');
    expect(getDirection('fr')).toBe('ltr');
  });
});
```

### 7.2 `repo/packages/shared-ui/src/lib/__tests__/format-date.spec.ts` (10 tests)

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatDate, formatTime, formatRelativeTime, formatDateRange } from '../format-date';

describe('format-date', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-06T10:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('formats date dd/MM/yyyy in fr', () => {
    const result = formatDate(new Date('2026-05-06'), 'fr', 'short');
    expect(result).toMatch(/06\/05\/2026/);
  });

  it('formats date with ar locale (RTL output)', () => {
    const result = formatDate(new Date('2026-05-06'), 'ar', 'short');
    expect(result).toBeTruthy();
    expect(result.length).toBeGreaterThan(0);
  });

  it('formats date with ar-MA locale fallback chain', () => {
    const result = formatDate(new Date('2026-05-06'), 'ar-MA', 'short');
    expect(result).toBeTruthy();
  });

  it('respects timezone Africa/Casablanca (UTC+1)', () => {
    const utc = new Date('2026-05-06T23:30:00Z');
    const result = formatTime(utc, 'fr');
    expect(result).toBe('00:30');
  });

  it('handles DST Casablanca summer (UTC+1 vs UTC+0)', () => {
    const summer = new Date('2026-07-15T12:00:00Z');
    const winter = new Date('2026-12-15T12:00:00Z');
    const sFmt = formatTime(summer, 'fr');
    const wFmt = formatTime(winter, 'fr');
    expect(sFmt).toBeTruthy();
    expect(wFmt).toBeTruthy();
  });

  it('formats time with seconds option', () => {
    const date = new Date('2026-05-06T14:30:45Z');
    const result = formatTime(date, 'fr', true);
    expect(result).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });

  it('formats relative time "yesterday" in fr', () => {
    const yesterday = new Date('2026-05-05T10:00:00Z');
    const result = formatRelativeTime(yesterday, 'fr');
    expect(result).toMatch(/hier|jour/i);
  });

  it('formats date range fr', () => {
    const start = new Date('2026-05-01');
    const end = new Date('2026-05-31');
    const result = formatDateRange(start, end, 'fr', 'short');
    expect(result).toContain('05/2026');
  });

  it('returns empty string for invalid date', () => {
    const result = formatDate('not-a-date' as any, 'fr');
    expect(result).toBe('');
  });

  it('formats long date with weekday in fr', () => {
    const date = new Date('2026-05-06T12:00:00Z');
    const result = formatDate(date, 'fr', 'long');
    expect(result).toMatch(/mercredi/i);
  });
});
```

### 7.3 `repo/packages/shared-ui/src/lib/__tests__/format-number.spec.ts` (10 tests)

```typescript
import { describe, it, expect } from 'vitest';
import { formatNumber, formatCurrency, formatPercent, formatCompact, parseLocalizedNumber } from '../format-number';

describe('format-number', () => {
  it('formats number 1234.56 fr with espace + virgule', () => {
    const result = formatNumber(1234.56, 'fr', { minimumFractionDigits: 2 });
    expect(result.replace(/ | /g, ' ')).toBe('1 234,56');
  });

  it('formats currency MAD in fr replaces MAD with DH', () => {
    const result = formatCurrency(1234.56, 'fr', 'MAD');
    expect(result).toContain('DH');
    expect(result).not.toContain('MAD');
  });

  it('formats currency MAD in ar keeps native', () => {
    const result = formatCurrency(1234.56, 'ar', 'MAD');
    expect(result).toBeTruthy();
  });

  it('formats currency with arabic-indic numerals option', () => {
    const result = formatCurrency(1234.56, 'ar', 'MAD', { useArabicIndicNumerals: true });
    expect(result).toMatch(/[٠-٩]/);
  });

  it('formats percent fr "15 %"', () => {
    const result = formatPercent(0.15, 'fr');
    expect(result.replace(/ | /g, ' ')).toMatch(/15\s?%/);
  });

  it('formats percent with fractionDigits', () => {
    const result = formatPercent(0.156, 'fr', 2);
    expect(result.replace(/ | /g, ' ')).toMatch(/15,60\s?%/);
  });

  it('formats compact 1500000 -> 1,5 M fr', () => {
    const result = formatCompact(1500000, 'fr');
    expect(result).toMatch(/1[,.]?5\s?M/i);
  });

  it('returns empty for non-finite values', () => {
    expect(formatNumber(NaN, 'fr')).toBe('');
    expect(formatCurrency(Infinity, 'fr')).toBe('');
  });

  it('parses localized number "1 234,56" fr -> 1234.56', () => {
    const result = parseLocalizedNumber('1 234,56', 'fr');
    expect(result).toBe(1234.56);
  });

  it('parses arabic-indic "١٠٠٠" -> 1000', () => {
    const result = parseLocalizedNumber('١٠٠٠', 'ar');
    expect(result).toBe(1000);
  });
});
```

### 7.4 `repo/packages/shared-ui/src/lib/__tests__/pluralize.spec.ts` (8 tests)

```typescript
import { describe, it, expect } from 'vitest';
import { getPluralCategory, pluralize, getPluralCategoriesForLocale } from '../pluralize';

describe('pluralize', () => {
  it('arabic 0 -> zero', () => {
    expect(getPluralCategory(0, 'ar', false)).toBe('zero');
  });

  it('arabic 1 -> one', () => {
    expect(getPluralCategory(1, 'ar', false)).toBe('one');
  });

  it('arabic 2 -> two', () => {
    expect(getPluralCategory(2, 'ar', false)).toBe('two');
  });

  it('arabic 3 -> few', () => {
    expect(getPluralCategory(3, 'ar', false)).toBe('few');
  });

  it('arabic 11 -> many', () => {
    expect(getPluralCategory(11, 'ar', false)).toBe('many');
  });

  it('arabic 100 -> other', () => {
    expect(getPluralCategory(100, 'ar', false)).toBe('other');
  });

  it('darija collapse few/many to other', () => {
    expect(getPluralCategory(5, 'ar-MA', true)).toBe('other');
    expect(getPluralCategory(11, 'ar-MA', true)).toBe('other');
  });

  it('pluralize replaces # with count', () => {
    const result = pluralize(5, 'ar', {
      zero: 'لا شيء',
      one: 'واحد',
      two: 'اثنان',
      few: '# قليل',
      many: '# كثير',
      other: '# اشياء',
    }, false);
    expect(result).toBe('5 قليل');
  });
});
```

### 7.5 `repo/packages/shared-ui/src/components/__tests__/LocaleSwitcher.spec.tsx` (5 tests)

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LocaleSwitcher } from '../LocaleSwitcher';
import { NextIntlClientProvider } from 'next-intl';

const messages = { locale: { switcherAria: 'Changer langue', listAria: 'Liste langues' } };

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('page=3'),
}));
vi.mock('../../i18n/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => '/contacts',
}));

describe('LocaleSwitcher', () => {
  function wrap(locale = 'fr') {
    return (
      <NextIntlClientProvider locale={locale} messages={messages} timeZone="Africa/Casablanca">
        <LocaleSwitcher />
      </NextIntlClientProvider>
    );
  }

  it('renders current locale native name', () => {
    render(wrap('fr'));
    expect(screen.getByText('Francais')).toBeDefined();
  });

  it('opens dropdown on click', () => {
    render(wrap('fr'));
    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(screen.getByRole('listbox')).toBeDefined();
  });

  it('renders 3 locale options when open', () => {
    render(wrap('fr'));
    fireEvent.click(screen.getByRole('button'));
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(3);
  });

  it('marks current locale as selected', () => {
    render(wrap('ar-MA'));
    fireEvent.click(screen.getByRole('button'));
    const arMA = screen.getByRole('option', { selected: true });
    expect(arMA).toBeDefined();
  });

  it('persists cookie NEXT_LOCALE on locale change', () => {
    render(wrap('fr'));
    fireEvent.click(screen.getByRole('button'));
    const arMA = screen.getAllByRole('option')[1];
    fireEvent.click(arMA);
    expect(document.cookie).toContain('NEXT_LOCALE=ar-MA');
  });
});
```

### 7.6 `repo/packages/shared-ui/src/components/__tests__/DirectionProvider.spec.tsx` (4 tests)

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { DirectionProvider, useDirection, useIsRtl } from '../DirectionProvider';
import { NextIntlClientProvider } from 'next-intl';

describe('DirectionProvider', () => {
  function wrap(locale: string, children: React.ReactNode) {
    return (
      <NextIntlClientProvider locale={locale} messages={{}} timeZone="Africa/Casablanca">
        <DirectionProvider>{children}</DirectionProvider>
      </NextIntlClientProvider>
    );
  }

  it('sets dir=rtl for ar', () => {
    render(wrap('ar', <div>Test</div>));
    expect(document.documentElement.dir).toBe('rtl');
  });

  it('sets dir=rtl for ar-MA', () => {
    render(wrap('ar-MA', <div>Test</div>));
    expect(document.documentElement.dir).toBe('rtl');
  });

  it('sets dir=ltr for fr', () => {
    render(wrap('fr', <div>Test</div>));
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('toggles class rtl/ltr on html', () => {
    render(wrap('ar', <div>Test</div>));
    expect(document.documentElement.classList.contains('rtl')).toBe(true);
    expect(document.documentElement.classList.contains('ltr')).toBe(false);
  });
});
```

### 7.7 Tests E2E Playwright `repo/e2e/web/i18n-cross-apps.spec.ts` (12 tests, 24 URLs)

```typescript
import { test, expect } from '@playwright/test';

const APPS = [
  { name: 'web-broker', port: 3001 },
  { name: 'web-garage', port: 3002 },
  { name: 'web-garage-mobile', port: 3003 },
  { name: 'web-insurtech-admin', port: 3000 },
  { name: 'web-customer-portal', port: 3004 },
  { name: 'web-assure-portal', port: 3005 },
  { name: 'web-assure-mobile', port: 3006 },
];

const LOCALES = ['fr', 'ar-MA', 'ar'];

for (const app of APPS) {
  for (const locale of LOCALES) {
    test(`${app.name}: /${locale} returns 200 with correct lang`, async ({ page }) => {
      const response = await page.goto(`http://localhost:${app.port}/${locale}`);
      expect(response?.status()).toBe(200);
      const lang = await page.locator('html').getAttribute('lang');
      expect(lang).toBe(locale);
    });
  }
}

test('dir=rtl auto for ar pages', async ({ page }) => {
  await page.goto('http://localhost:3001/ar');
  const dir = await page.locator('html').getAttribute('dir');
  expect(dir).toBe('rtl');
});

test('dir=rtl auto for ar-MA pages', async ({ page }) => {
  await page.goto('http://localhost:3001/ar-MA');
  const dir = await page.locator('html').getAttribute('dir');
  expect(dir).toBe('rtl');
});

test('dir=ltr for fr', async ({ page }) => {
  await page.goto('http://localhost:3001/fr');
  const dir = await page.locator('html').getAttribute('dir');
  expect(dir).toBe('ltr');
});

test('redirect /dashboard -> /fr/dashboard (default)', async ({ page }) => {
  const response = await page.goto('http://localhost:3001/dashboard');
  expect(page.url()).toContain('/fr/');
});

test('cookie NEXT_LOCALE persists across navigation', async ({ page, context }) => {
  await page.goto('http://localhost:3001/ar-MA');
  const cookies = await context.cookies();
  expect(cookies.find((c) => c.name === 'NEXT_LOCALE')?.value).toBe('ar-MA');
  await page.goto('http://localhost:3001/');
  expect(page.url()).toContain('/ar-MA');
});

test('Accept-Language header respected when no cookie', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'ar-MA' });
  const page = await context.newPage();
  await page.goto('http://localhost:3001/');
  expect(page.url()).toContain('/ar-MA');
  await context.close();
});

test('Noto Naskh font loads for ar pages', async ({ page }) => {
  await page.goto('http://localhost:3001/ar');
  const fontFamily = await page.locator('body').evaluate((el) => getComputedStyle(el).fontFamily);
  expect(fontFamily.toLowerCase()).toContain('noto');
});

test('LocaleSwitcher preserves query + hash', async ({ page }) => {
  await page.goto('http://localhost:3001/fr/contacts?page=3#item-12');
  await page.click('[aria-haspopup="listbox"]');
  await page.click('[role="option"]:has-text("الدارجة")');
  await page.waitForURL(/\/ar-MA\//);
  expect(page.url()).toContain('?page=3');
  expect(page.url()).toContain('#item-12');
});
```

---

## 8. Variables environnement

Ajoute dans chaque `.env.example` des 8 apps :

```bash
# ===== I18N (Tache 1.4.11) =====
# Decision-009 multilinguisme MA OBLIGATOIRE 3 locales

# Locale par defaut (fallback final)
NEXT_PUBLIC_DEFAULT_LOCALE=fr

# Locales supportees (CSV, ordre = preference)
NEXT_PUBLIC_SUPPORTED_LOCALES=fr,ar-MA,ar

# Timezone IANA pour Intl.DateTimeFormat
NEXT_PUBLIC_TIMEZONE=Africa/Casablanca

# Nom de l'app courante (utilise par shared-ui/i18n/request.ts)
# Valeur differente par app : web-broker, web-garage, web-garage-mobile,
# web-insurtech-admin, web-customer-portal, web-assure-portal, web-assure-mobile
NEXT_PUBLIC_APP_NAME=web-broker

# Chaine de fallback messages (CSV ordere)
NEXT_PUBLIC_LOCALE_FALLBACK_CHAIN=ar-MA:ar:fr

# Activer chiffres arabo-indiens pour ar (par defaut latins)
NEXT_PUBLIC_USE_ARABIC_INDIC_NUMERALS=false

# Cookie locale config
NEXT_PUBLIC_LOCALE_COOKIE_NAME=NEXT_LOCALE
NEXT_PUBLIC_LOCALE_COOKIE_MAX_AGE=31536000

# Locale RTL list (CSV)
NEXT_PUBLIC_RTL_LOCALES=ar,ar-MA

# Reservation Sprint 18 customer-portal
# NEXT_PUBLIC_LOCALE_EN_ENABLED=false
```

Documentation : voir `repo/docs/architecture/i18n-strategy.md` section 8.

---

## 9. Validation locale (commands)

```bash
# Typecheck shared-ui i18n
pnpm --filter @insurtech/shared-ui typecheck

# Tests unitaires shared-ui (35+ tests)
pnpm --filter @insurtech/shared-ui test

# Validation parite cles cross-locale (CI helper)
pnpm tsx repo/scripts/validate-i18n-keys.ts

# Extract orphan keys
pnpm tsx repo/scripts/i18n-extract-keys.ts

# Demarrer 8 apps en parallele (Turbo)
pnpm dev

# Tests E2E 24 URLs
pnpm exec playwright test repo/e2e/web/i18n-cross-apps.spec.ts

# Tests Lighthouse Accessibility >= 90 sur fr/ar-MA/ar (web-broker)
pnpm --filter @insurtech/web-broker lh -- --url http://localhost:3001/fr
pnpm --filter @insurtech/web-broker lh -- --url http://localhost:3001/ar-MA
pnpm --filter @insurtech/web-broker lh -- --url http://localhost:3001/ar

# Verification no emoji dans messages JSON
grep -rE "[\xF0\x9F\x98-\xF0\x9F\x99]" repo/apps/*/src/messages/ && exit 1 || echo "OK no emoji"

# Build production 8 apps
pnpm build
```

---

## 10. Criteres validation V1-V30 (28+ criteres)

### P0 (15+ bloquants release Sprint 4)

- **V1 (P0)** : 3 locales accessibles sur les 8 apps -- 24 URLs `/fr` `/ar-MA` `/ar` x 7 + admin = 24 URLs HTTP 200.
- **V2 (P0)** : `dir="rtl"` automatique sur `<html>` quand locale ar ou ar-MA, server-side (pas de flash).
- **V3 (P0)** : Middleware redirige `/dashboard` -> `/fr/dashboard` (locale par defaut applique).
- **V4 (P0)** : Cookie `NEXT_LOCALE` persiste preference 365 jours, SameSite=Lax, Secure prod.
- **V5 (P0)** : Accept-Language header respecte si pas de cookie (`fr-FR` -> `/fr`, `ar-MA,ar;q=0.9` -> `/ar-MA`).
- **V6 (P0)** : Tailwind RTL utilities operationnelles (`rtl:flex-row-reverse`, `me-4`, `ms-4`, `pe-2`, `ps-2`).
- **V7 (P0)** : Font Noto Naskh Arabic chargee pour pages ar/ar-MA via `next/font/google` subsets `arabic`, fallback chain Geeza Pro / Tahoma / sans-serif.
- **V8 (P0)** : Messages JSON charges per locale, changement locale -> texte change (test E2E click LocaleSwitcher).
- **V9 (P0)** : Pluralisation arabe 6 formes correcte (test 0/1/2/3/11/100 categorie attendue).
- **V10 (P0)** : Date format `dd/MM/yyyy` en fr et ar-MA, `dd/MM/yyyy` arabe avec option arabo-indien dispo.
- **V11 (P0)** : Currency MAD locale-aware : fr "1 234,56 DH", ar "1,234.56 د.م.".
- **V12 (P0)** : LocaleSwitcher change URL en preservant pathname + query + hash.
- **V13 (P0)** : Types messages auto-generes par next-intl, `useTranslations()` autocomplete VSCode + erreur compile si cle inexistante.
- **V14 (P0)** : `decision-006` NO EMOJI : `grep -rE "[\xF0\x9F]" repo/apps/*/src/messages/` retourne 0 ligne.
- **V15 (P0)** : `pnpm typecheck` 0 erreur, `pnpm lint` 0 erreur sur les 8 apps + shared-ui.

### P1 (8+ enrichissement Sprint 4)

- **V16 (P1)** : Font fallback chain documente et applique : `Noto Naskh Arabic -> Geist Mono (numeros) -> Tahoma -> sans-serif`.
- **V17 (P1)** : Routing locale-prefixed `always` -- aucune URL sans prefix accessible (sauf rewrites explicites).
- **V18 (P1)** : Time zone `Africa/Casablanca` applique partout, DST 2h gere natif via IANA tz database (test `formatTime` UTC->local).
- **V19 (P1)** : `Intl.ListFormat` "et/ou" patterns operationnel (fr `et`/`ou`, ar `و`/`أو`).
- **V20 (P1)** : `Intl.RelativeTimeFormat` operationnel (`hier`, `dans 2 jours`, `il y a 1 an`).
- **V21 (P1)** : DST 2h April-October MA documente dans i18n-strategy.md, validation Sprint 6 enrichie.
- **V22 (P1)** : Hijri calendar placeholder reserve Sprint 25+ (Takaful islamique), pas active Sprint 4.
- **V23 (P1)** : `parseLocalizedNumber` parse "1 234,56" et "١٠٠٠" arabe.

### P2 (5+ amelioration future)

- **V24 (P2)** : Alternate hreflang sitemap genere Sprint 18 (customer-portal SEO public).
- **V25 (P2)** : Mauritania `ar-MR` documente diff vs `ar-MA` (Sprint 35+).
- **V26 (P2)** : Algerian Darija `ar-DZ` reservation Sprint 35+.
- **V27 (P2)** : `fr-CA` (Quebec) fallback chain `fr-CA -> fr` Sprint 35+.
- **V28 (P2)** : `en` (Anglais) reserve Sprint 18 customer-portal SEO public.
- **V29 (P2)** : `tmz-MA` (Tamazight Tifinagh) reserve Sprint 30+ decision IRCAM dossier.
- **V30 (P2)** : Storybook `LocaleSwitcher.stories.tsx` Sprint 16+ (deferred si Sprint 4 capacite).

---

## 11. Edge cases et risques (10+)

1. **Darija definition stricte** : `ar-MA` = arabe ecrit (caracteres arabes) avec mots francais transliteres en arabe. **JAMAIS** alphabet latin avec chiffres ("3" = ع, "7" = ح). Sprint 4 force ecriture arabe pure.

2. **ar formel jamais usage quotidien MA** : utilisateurs MA rejettent `ar` pure en interface conversationnelle. Reserved : documents juridiques (police d'assurance officielle imprimable PDF), correspondance ACAPS, Takaful religieux. Sprint 4 expose les 3 locales mais documentation guide vers `fr` ou `ar-MA` pour UX.

3. **Pluralisation arabe 6 formes vs 2 fr** : `Intl.PluralRules('ar')` traite 6 categories CLDR (zero/one/two/few/many/other). Risque : traducteur non-natif inverse `few` (3-10) et `many` (11-99). Tests `pluralize.spec.ts` 8 assertions strictes.

4. **next-intl genere types depuis JSON premier locale lu** : si `fr.json` a une cle absente de `ar.json`, types compile passent (genres depuis fr) mais runtime ar = `MISSING_MESSAGE`. Solution : `scripts/validate-i18n-keys.ts` CI verifie parite stricte cross-locale, hook pre-commit Husky.

5. **Performance messages JSON > 1500 cles per app Sprint 17+** : next-intl charge tout le JSON courant locale (~50 ko Sprint 4, ~150 ko Sprint 17). Solution : structure namespaced (`auth.*`, `nav.*`) pour activer Sprint 17 lazy loading per namespace via `useTranslations('auth')`.

6. **Time zone Africa/Casablanca DST 2h** : Maroc applique DST inverse depuis 2018 -- horaire d'ete maintenu sauf pendant Ramadan (-1h). Cas edge Ramadan 2026 (mi-fevrier mi-mars). Geneere natif IANA tz database. Validation Sprint 6 pendant Ramadan reel.

7. **Date format ambigu `10/01/2026`** : 10 janvier ou 1 octobre ? Sprint 4 force **systematiquement** `dd/MM/yyyy` (jour-mois-annee) toutes locales. Documentation explicite. Pas de format `yyyy-MM-dd` ISO pour affichage (utilisable seulement `<input type="date">`).

8. **Currency MAD code ISO 4217 vs symbole "DH"** : `Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' })` produit "MAD". Helper `formatCurrency` post-process replace "MAD" -> "DH" pour fr (preference utilisateur MA). Pour ar : "د.م." (Dirham marocain abrege arabe).

9. **Locale fallback chain ar-MA -> ar -> fr** : si une cle manque en `ar-MA.json`, charge `ar.json`. Si manque encore, `fr.json`. Implemente dans `request.ts` via try/catch dynamic import.

10. **Phone format MA `+212` vs `0X`** : numero 06 12 34 56 78 (national) vs +212 6 12 34 56 78 (international). Sprint 4 documente. Sprint 8 ajoutera helper `formatPhone(number, locale)` (libphonenumber-js).

11. **LocaleSwitcher preserve query params + hash** : URL `/fr/contacts?page=3#item-12` -> click switcher ar-MA -> `/ar-MA/contacts?page=3#item-12`. Implementation `useSearchParams() + window.location.hash`. Test E2E.

12. **Accept-Language `en-US` foreigner** : visiteur expat anglais sur web-broker dev/staging. Fallback `/fr` (defaut). Sprint 18 ajoutera `en` pour customer-portal.

13. **Hydration mismatch `dir`** : `dir` calcule UNIQUEMENT depuis `params.locale` route segment server-resolved. Aucun cookie/localStorage cote serveur (pas de mismatch).

14. **Cookie corrompu `NEXT_LOCALE=invalid`** : middleware ignore (locale non reconnue), fallback `fr`. Test middleware.

15. **Locale URL invalide `/fr-FR/...`** : middleware ne reconnait pas `fr-FR` (que `fr`, `ar-MA`, `ar`). Sprint 4 retourne 404 strict (`not-found.tsx`). Pas de redirect (evite SEO duplicate).

---

## 12. Conformite Maroc (Loi 09-08 CNDP, decision-009, WCAG)

### 12.1 Loi 09-08 CNDP (donnees personnelles)

**Cookie `NEXT_LOCALE`** :
- **Type** : preference utilisateur (locale UI)
- **PII (donnee personnelle)** : NON
- **Justification** : la preference de langue n'est pas une donnee identifiante. Equivalent europeen : RGPD article 82 directive ePrivacy considere les cookies "strictement necessaires au fonctionnement du service" exempts de consentement.
- **Retention** : 365 jours (renouvelement glissant a chaque visite).
- **Documentation utilisateur** : section `i18n-strategy.md` paragraphe 7.3, plus precisee Sprint 18 customer-portal banniere cookies (autres cookies analytics/marketing requierent consentement explicite).
- **Pas de banniere consentement requise pour ce cookie specifique**.

### 12.2 Decision-009 multilinguisme MA OBLIGATOIRE

**Justifications legales et culturelles** :
- **Constitution Maroc 2011** article 5 : arabe et tamazight langues officielles. Francais langue de fait dans economie et education superieure.
- **Loi 30-04** Charte Nationale d'Education : multilinguisme obligatoire institutions.
- **Dahir 5-10-1996** revise 2011 : reservation tamazight (Tifinagh) Sprint 30+ decision IRCAM dossier formel.
- **3 locales Sprint 4 = STRICT MINIMUM** : `fr` (admin/banks/upper class), `ar-MA` (daily speech Darija), `ar` (formal/religious/administrative documents).
- **Reservation `tmz-MA` Sprint 30+** : Tamazight Tifinagh non active Sprint 4 par : (a) absence fonts standardisees mobile low-end Android, (b) cout traduction (~5 traducteurs Tifinagh certifies pays), (c) demande utilisateur < 0.5% trafic.
- **Reservation `en` Sprint 18** : Anglais pour customer-portal public SEO (expats, tourisme medical assurance).

### 12.3 WCAG SC 3.1.1 (Niveau A) -- Language of Page

**Mandatoire** : attribut `lang` sur `<html>`. Implementation server-rendered `<html lang={locale}>`. Audit `axe-core` automatise Sprint 4 Tache 1.4.16 verifie 100% pages.

### 12.4 WCAG SC 3.1.2 (Niveau AA) -- Language of Parts

Reserve Sprint 8 : composant `<Lang lang="fr">{children}</Lang>` pour citations francaise dans page arabe.

### 12.5 ACAPS (regulateur assurance MA)

ACAPS communique mixte FR/AR. Polices imprimables Sprint 17 generees en bilingue FR/AR (page de couverture arabe + corps francais ou inverse selon souhait courtier).

---

## 13. Conventions (14 conventions complete liste)

1. **NO EMOJI ABSOLU** (decision-006) : aucune emoji dans aucun fichier code, JSON messages, README, commit. Linter custom CI verifie. Caracteres arabes et accents francais autorises.

2. **TypeScript strict** : `tsconfig.base.json` avec `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`. Aucun `any` dans i18n code.

3. **Type-safe messages from JSON catalog** : `next-intl` plugin auto-genere types depuis `messages/fr.json` (langue source). `IntlMessages` global type augmente.

4. **next-intl 3.26.3 strict** : pas react-i18next, pas i18next, pas Lingui, pas FormatJS react-intl. Verrou version `pnpm-lock.yaml` strict.

5. **Routing locale-prefixed `always`** : pas domain-based, pas as-needed. URL canonique inclut toujours locale `/fr/dashboard`.

6. **Cookie `NEXT_LOCALE` 365 jours** : SameSite=Lax, Secure HTTPS prod, HttpOnly false (lu cote client par LocaleSwitcher).

7. **3 locales Sprint 4 strict** : `fr` (default), `ar-MA` (Darija), `ar` (classique avec RTL). Aucune autre locale active.

8. **Time zone `Africa/Casablanca`** pour TOUT formatage date/time (Intl.DateTimeFormat options.timeZone).

9. **Pluralisation arabe 6 formes via `Intl.PluralRules`** : zero/one/two/few/many/other. Helper `pluralize()` dans `shared-ui/lib/pluralize.ts`.

10. **Currency MAD via `Intl.NumberFormat` style currency** : code ISO 4217 = MAD, post-process "MAD" -> "DH" pour fr.

11. **Date format `dd/MM/yyyy` force** : aucune ambiguite, applique toutes locales fr/ar-MA/ar.

12. **Logical Tailwind utilities** : `ms-*`, `me-*`, `ps-*`, `pe-*` (margin/padding-start/end) pour RTL-safe. Eviter `ml-*`, `mr-*` direct.

13. **Fonts via `next/font/google` subsets** : Montserrat `subsets: ['latin']`, Noto Naskh Arabic `subsets: ['arabic']`, `display: 'swap'`, `preload: true`.

14. **Validation cross-locale CI** : `scripts/validate-i18n-keys.ts` execute hook pre-commit + CI obligatoire. Exit 1 si parite cles cross-locale brisee.

---

## 14. Risques connus

| Risque | Impact | Mitigation Sprint 4 | Trigger Sprint suivant |
|--------|--------|----------------------|-------------------------|
| Traducteur native MA indisponible | Messages ar-MA pauvres ou faux | Sprint 4 utilise traducteur stub interne, valide par 1 reviewer MA | Sprint 8 onboard Crowdin si > 5000 cles |
| `Intl.PluralRules('ar-MA')` tombe sur regles ar | Pluralisation Darija incorrecte | Helper `collapseDarija=true` collapse few/many vers other | Sprint 17 valide avec utilisateurs reels |
| Browser ancien sans `Intl.ListFormat` | Render fallback "X, Y, Z" sans "et" | Polyfill `intl-formatjs/intl-listformat` chargement conditionnel | Sprint 18 customer-portal SEO public si support IE11 requis (improbable) |
| DST Africa/Casablanca Ramadan 2026 | Affichage horaire decale | Tests Sprint 6 pendant Ramadan reel | Sprint 8 enrichit DST handling |
| Tailwind 4 beta `me-*`/`ms-*` non stable | Styles RTL casses | Fallback Tailwind 3.4 avec plugin `tailwindcss-rtl` | Sprint 5 valide stabilite |
| Cookie `NEXT_LOCALE` corrompu | User stuck mauvaise locale | Middleware fallback `fr`, ignore cookie invalide | -- |
| Hydration mismatch `dir` | Console warning React | `dir` server-resolved depuis route segment, pas cookie | -- |
| Messages JSON > 200 ko per locale | Bundle client gonfle | Sprint 17 lazy loading per namespace | Sprint 17 |
| Type messages auto-genere desync | Build casse | CI hook `validate-i18n-keys.ts` pre-commit | -- |
| Storybook LocaleSwitcher.stories | Pas teste isolement | Deferred Sprint 16 | Sprint 16 |

---

## 15. Definition of Done

- [ ] `repo/packages/shared-ui/src/i18n/` 5 fichiers crees (routing, request, navigation, locales, types)
- [ ] `repo/packages/shared-ui/src/components/` LocaleSwitcher + DirectionProvider crees
- [ ] `repo/packages/shared-ui/src/lib/` 4 helpers crees (format-date, format-number, format-list, pluralize)
- [ ] `repo/apps/{8 apps}/src/middleware.ts` cree (8 fichiers identiques)
- [ ] `repo/apps/{8 apps}/src/i18n/request.ts` cree (8 fichiers identiques)
- [ ] `repo/apps/{8 apps}/src/messages/{fr,ar-MA,ar}.json` crees (24 fichiers, ~50 cles chacun)
- [ ] `repo/docs/architecture/i18n-strategy.md` cree (~250 lignes)
- [ ] `repo/scripts/validate-i18n-keys.ts` cree
- [ ] `repo/scripts/i18n-extract-keys.ts` cree
- [ ] Tests unitaires Vitest 35+ tests passent (`pnpm --filter @insurtech/shared-ui test`)
- [ ] Tests E2E Playwright 12 tests passent sur 24 URLs (`pnpm exec playwright test repo/e2e/web/i18n-cross-apps.spec.ts`)
- [ ] `pnpm typecheck` 0 erreur sur 8 apps + shared-ui
- [ ] `pnpm lint` 0 erreur sur 8 apps + shared-ui
- [ ] `pnpm build` reussit sur 8 apps
- [ ] `grep -rE "[\xF0\x9F]" repo/apps/*/src/messages/` retourne 0 ligne (no emoji)
- [ ] Lighthouse Accessibility >= 90 sur `/fr` `/ar-MA` `/ar` (web-broker)
- [ ] Variables environnement `.env.example` ajoutees dans 8 apps
- [ ] Documentation revisee par 1 traducteur natif MA (ar-MA + ar)
- [ ] PR review approuvee par 1 frontend lead + 1 traducteur MA
- [ ] V1-V15 tous P0 valides
- [ ] V16-V23 tous P1 valides ou trace-d Sprint 6+
- [ ] V24-V30 P2 documentes pour sprints futurs

---

## 16. Sources et references

### 16.1 Documentation officielle

- next-intl : https://next-intl-docs.vercel.app/
- next-intl App Router : https://next-intl-docs.vercel.app/docs/getting-started/app-router
- next-intl `getRequestConfig` : https://next-intl-docs.vercel.app/docs/usage/configuration
- ICU MessageFormat : http://userguide.icu-project.org/formatparse/messages
- CLDR Plural Rules : https://cldr.unicode.org/index/cldr-spec/plural-rules
- Intl.DateTimeFormat : https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat
- Intl.NumberFormat : https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat
- Intl.RelativeTimeFormat : https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/RelativeTimeFormat
- Intl.ListFormat : https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/ListFormat
- Intl.PluralRules : https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/PluralRules
- Tailwind 4 RTL : https://tailwindcss.com/docs/configuring-direction
- WCAG 2.1 SC 3.1.1 : https://www.w3.org/WAI/WCAG21/Understanding/language-of-page.html
- WCAG 2.1 SC 3.1.2 : https://www.w3.org/WAI/WCAG21/Understanding/language-of-parts.html

### 16.2 Documentation interne

- `00-pilotage/meta-prompts/B-04-sprint-04-frontend-bootstrap.md` Tache 1.4.11 lignes 865-918
- `00-pilotage/documentation/8-skalean-insurtech-prompt-master.md` regles transverses no-emoji multilingue
- `00-pilotage/documentation/1-stack-technique.yaml` versions next-intl 3.26.3
- `00-pilotage/decisions/decision-006.md` NO EMOJI ABSOLU
- `00-pilotage/decisions/decision-009.md` multilinguisme MA OBLIGATOIRE 3 locales
- `00-pilotage/prompts-taches/sprint-04-frontend-bootstrap/task-1.4.1-web-broker-bootstrap-port-3001.md` patron canonique
- `00-pilotage/prompts-taches/sprint-04-frontend-bootstrap/task-1.4.8-package-shared-ui.md` LocaleSwitcher composant Sprint 4

### 16.3 References reglementaires Maroc

- Loi 09-08 CNDP donnees personnelles
- Constitution Maroc 2011 article 5 langues officielles
- Loi 30-04 Charte Nationale Education multilinguisme
- Dahir 5-10-1996 langue officielle berbere reservation
- IRCAM Institut Royal Culture Amazighe Tifinagh
- ACAPS regulateur assurance communications mixte FR/AR

### 16.4 Outils externe (Sprint 16+)

- Crowdin : https://crowdin.com (collaboration traducteurs)
- Lokalise : https://lokalise.com (alternative SaaS)
- Phrase : https://phrase.com (option enterprise)

---

## 17. Notes finales / handoff Sprint suivant

### 17.1 Sprint 5 (Auth) inputs requis

- Pages `/fr/auth/login`, `/ar-MA/auth/login`, `/ar/auth/login` consommeront `useTranslations('auth')`.
- Formulaires login traduits dans `messages/{locale}.json` namespace `auth.*`.
- Messages erreurs 401/403 dans `errors.*`.

### 17.2 Sprint 8 (CRM) extensions

- Composant `<Lang lang="fr">` pour citations francaise dans page arabe (WCAG SC 3.1.2).
- Helper `formatPhone(number, locale)` Maroc `+212` vs `0X`.
- Validation Ramadan 2026 DST Africa/Casablanca (mi-fevrier mi-mars).

### 17.3 Sprint 17 (Souscription) extensions

- Lazy loading messages per namespace (`useTranslations('policies')` charge subset).
- Currency MAD post-process raffine selon retours utilisateurs.
- Polices PDF imprimables bilingues FR/AR.

### 17.4 Sprint 18 (Customer-portal SEO public) extensions

- Ajout locale `en` (Anglais).
- Sitemap.xml hreflang multi-locale.
- OpenGraph i18n meta tags.
- Banniere cookies analytics/marketing (CNDP consentement).

### 17.5 Sprint 30+ extensions

- Locale `tmz-MA` (Tamazight Tifinagh) decision IRCAM dossier.
- Hijri calendar option Sprint 25 Takaful islamique.
- Locale regionales `ar-DZ` (Algerie), `ar-MR` (Mauritanie) si expansion regionale.

### 17.6 Maintenance continue

- Hook pre-commit Husky `validate-i18n-keys.ts` actif des Sprint 4.
- Reviewer traducteur natif MA obligatoire sur PR touchant `messages/*.json`.
- Outil Crowdin/Lokalise evalue Sprint 16 si volume cles > 5000.

---

**Fin de la tache 1.4.11**

**Effort total estime** : 6h
- 1h conception + lecture meta-prompt + decisions
- 2h implementation shared-ui i18n + components + lib helpers
- 1h propagation 8 apps middleware + request + messages JSON
- 1h tests unitaires + E2E
- 1h documentation i18n-strategy.md + review

**Prochaine tache** : 1.4.12 Tooling monorepo frontend (Turbo, scripts dev parallel) -- 4h, P0.
