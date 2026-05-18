# TACHE 4.3.13 -- I18n Complete : fr / ar-MA / ar avec RTL + Locale Switcher Operational

**Sprint** : 16 (Phase 4 / Sprint 3 dans phase Insure -- Web Broker App)
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md` (Tache 4.3.13, lignes 782-820)
**Phase** : 4 -- Vertical Insure (Skalean Broker ERP)
**Priorite** : P0 (bloquant Tache 4.3.14 Tests E2E qui valide RTL + locales, livrable sprint)
**Effort** : 4h
**Dependances** : 4.3.12 (RBAC UI -- HasPermission + HasRole composants), 4.3.1 (i18n setup initial : next-intl plugin + middleware), 4.3.3 (LocaleSwitcher squelette dans topbar -- a etendre ici), 1.4.11 Sprint 4 (cross-cutting i18n shared-ui/i18n config canonique 8 apps : routing, request, navigation, locales, types, formatters, pluralize, DirectionProvider, LocaleSwitcher de reference)
**Bloque** : 4.3.14 (Tests E2E Playwright validant 3 locales + RTL CSS + cookie persist), Sprint 17 (web-customer-portal qui copiera ce pattern), Sprint 24+ (sinistres garage workflow trilingue)
**Densite cible** : 100-150 ko (auto-suffisant exhaustif, aucune lecture annexe necessaire)
**AUCUNE EMOJI AUTORISEE** (decision-006 strictement appliquee, lint CI verifie)
**Type tache** : Cross-cutting interne app web-broker -- finalisation i18n pour les 12 pages metier livrees par 4.3.1 a 4.3.12

---

## 1. But (0.5-1 ko)

Finaliser la couverture i18n complete de l'application `web-broker` (port 3001) en livrant les **trois fichiers de messages exhaustifs** (`messages/fr.json`, `messages/ar-MA.json`, `messages/ar.json`) avec environ 600 cles chacun couvrant a 100 pour cent les douze pages applicatives produites par les taches 4.3.1 a 4.3.12 (auth login + MFA + signup + recovery, layout principal sidebar + topbar, dashboard six widgets, contacts list + form + timeline, companies list + form + detail, deals kanban + table, polices list + detail + tabs, broker-queue SLA + validate + reject, sinistres read-only, parametres tabs admin, profile + MFA setup, errors network/forbidden/notfound). Cette tache active la **direction RTL** automatique pour les locales `ar` et `ar-MA` via `<html dir="rtl">` server-rendered (zero flash, zero hydration mismatch), expose des helpers `Intl` locale-aware (`formatDate`, `formatTime`, `formatCurrency`, `formatRelativeTime`, `formatNumber`, `formatList`, `pluralize`) timezone-aware (`Africa/Casablanca` avec gestion DST Ramadan 2026 mi-fevrier a mi-mars -1h shift), opérationnalise un `LocaleSwitcher` operatif dans la topbar (dropdown trois langues avec drapeaux SVG locaux, persist cookie `NEXT_LOCALE` 365 jours SameSite=Lax Secure prod, preserve `pathname + searchParams + hash`), et injecte la font `Noto Naskh Arabic` (poids 400/700 subsetting arabe) conditionnellement quand la locale active est `ar` ou `ar-MA`.

A la sortie de cette tache : (1) chaque URL `/fr/*`, `/ar-MA/*`, `/ar/*` de l'app web-broker repond en 200 avec contenu localisé sur les 12 pages applicatives (36 URLs validees E2E par 4.3.14), (2) le DOM rendu cote serveur expose `<html lang="ar-MA" dir="rtl">` ou `<html lang="ar" dir="rtl">` ou `<html lang="fr" dir="ltr">` selon la locale du segment de route, (3) les utilities Tailwind `me-*`, `ms-*`, `pe-*`, `ps-*`, `start-*`, `end-*` mirroient automatiquement sous `[dir="rtl"]`, (4) les chevrons et icones directionnels (`ChevronRight`, `ArrowRight`, `BreadcrumbSeparator`, `Pagination` arrows) flipent visuellement via la classe utility `rtl-flip` ou la variant `rtl:rotate-180` Tailwind 4, (5) les dates affichées suivent le format `dd/MM/yyyy` pour `fr` et `يوم/شهر/سنة` arabe-aware pour `ar` / `ar-MA` via `date-fns` 4.x avec locales `fr` et `ar` officielles, (6) les montants en MAD sont rendus `1 234,56 DH` (fr) ou `1 234.56 DH` (ar) ou `1 234.56 DH` (ar-MA) via `Intl.NumberFormat('fr-MA' | 'ar-MA', { style: 'currency', currency: 'MAD' })` post-processé pour remplacer `MAD` par `DH` (convention utilisateurs MA), (7) le `LocaleSwitcher` change la locale en preservant `pathname + searchParams + hash` (test E2E URL `/fr/contacts?page=3&q=ahmed#item-12` switch vers `/ar-MA/contacts?page=3&q=ahmed#item-12`), (8) un script de validation `scripts/lint-translations.ts` execute en CI verifie que les 600 cles existent dans les trois locales (parite strict, exit code 1 si divergence, rapport markdown). Cette tache complete decision-009 (multilinguisme MA obligatoire 3 locales) et WCAG 2.1 AA SC 3.1.1 (attribut `lang` mandatoire sur `<html>`), SC 3.1.2 (lang attribute sur sections changement de langue ponctuel), et SC 1.4.3 (contraste fonts arabe Noto Naskh validé par axe-core).

---

## 2. Contexte etendu (5-10 ko)

### Pourquoi cette tache existe

La tache 1.4.11 du Sprint 4 a pose les **fondations cross-apps** de l'i18n dans le package partage `@insurtech/shared-ui/i18n` : routing trois locales avec `localePrefix: 'always'`, middleware `createMiddleware` next-intl 3.26.3, helpers `formatDate`/`formatNumber`/`formatList`/`pluralize` avec fallback chain `ar-MA -> ar -> fr`, composants `LocaleSwitcher` + `DirectionProvider`, fonts `Montserrat` + `Noto Naskh Arabic` via `next/font/google` subsetting. Ces fondations sont **génériques** : elles fonctionnent pour les 8 apps Skalean (`web-broker`, `web-garage`, `web-garage-mobile`, `web-insurtech-admin`, `web-customer-portal`, `web-assure-portal`, `web-assure-mobile`, et future `web-takaful` Sprint 33+). Mais elles n'incluent **PAS** les traductions des chaines UI métier de chaque app, qui sont par construction app-specific. Le Sprint 4 a fourni un catalog minimal de ~50 cles par app (`common`, `nav`, `auth`, `errors`, `locale`, `format`, `datetime`) pour couvrir le bootstrap, mais pas la richesse fonctionnelle des pages metier.

La tache 4.3.13 de Sprint 16 finalise donc la couverture i18n de l'app `web-broker` **specifiquement** : les 12 pages applicatives (auth, dashboard, contacts, companies, deals, polices, broker-queue, sinistres, parametres, profile) livrees par les taches 4.3.1 a 4.3.12 contiennent **chacune** entre 30 et 80 chaines UI distinctes (labels formulaires, titres tabs, messages confirmation, tooltips actions, status badges, empty states, error messages, validation Zod customizes). Au total ~600 cles supplementaires a celles du Sprint 4. Cette tache rassemble ces cles, les organise en namespaces coherents (`auth.*`, `dashboard.*`, `contacts.*`, `companies.*`, `deals.*`, `polices.*`, `broker_queue.*`, `sinistres.*`, `parametres.*`, `profile.*`, `errors.*`), produit les **trois fichiers JSON traduits** (fr canonique, ar-MA Darija marocaine familière mix arabe + lexique français transliteré, ar arabe classique formel institutionnel), et active les mecaniques RTL specifiques web-broker (icones flip, tooltips placement opposite, dropdowns alignment swap, scrollbar position).

Le sprint 16 doit livrer `web-broker` en **production ready** : cela inclut la conformité multilinguisme imposée par la Constitution marocaine (article 5, version 2011) qui reconnait arabe et tamazight comme langues officielles, mais aussi par la pratique sectorielle insurtech MA où les courtiers attendent une interface bilingue minimum (français = langue de redaction contractuelle + comptabilite + reporting ACAPS regulateur, arabe = langue de relation client + correspondance officielle bilingue FR/AR conditions generales polices). La Darija marocaine (ar-MA) est ajoutée pour la **préférence utilisateur mobile** : courtiers commerciaux terrain qui consultent l'app sur smartphone preferent la langue parlée quotidienne familière, alors que les administrateurs broker_admin en bureau preferent fr (langue administrative). L'arabe classique (`ar`) est exigé par la documentation officielle ACAPS (regulateur impose rapports trimestriels bilingues fr + ar), par les conditions generales imprimables des polices (texte legal en `ar` formel), et par les signatures électroniques juridiques (consentement RGPD-CNDP doit etre lu en `ar` formel pour les utilisateurs arabophones non francophones).

### Choix technique : extension shared-ui vs duplication app-locale

Trois strategies possibles pour gérer les 600 cles supplementaires web-broker :

| Strategie | Description | Pour | Contre |
|-----------|-------------|------|--------|
| **A. Tout dans shared-ui** | Centraliser les 600 cles dans `shared-ui/messages/{fr,ar-MA,ar}.json` | Single source of truth, parite garantie cross-apps | Pollution shared-ui avec cles app-specific, bundle gonflé, couplage |
| **B. Tout dans app** (CHOIX) | Garder shared-ui minimal (50 cles communes), 600 cles dans `apps/web-broker/messages/*.json` | Découplage propre, bundle minimal, ownership clair | Duplication potentielle si Sprint 17+ refait meme cles |
| **C. Hybride par namespace** | Cles `common` + `nav` + `errors` dans shared-ui, cles metier dans app | Reuse partielle, balance | Complexité merge runtime, bugs de scope |

**Decision** : strategie **B** (tout dans app). Justifications : (1) les 600 cles `auth.*`, `dashboard.*`, `contacts.*` etc. sont **strictement** liées aux pages web-broker -- elles ne seront pas reutilisées telles quelles par `web-garage` (workflows réparation différents) ni par `web-customer-portal` (UX vente publique différente), (2) le bundle de `shared-ui` doit rester minimal (< 50 ko gzipped) car importé par 8 apps -- ajouter 600 cles x 3 locales x ~30 octets par cle = ~54 ko de JSON par locale = inflation inacceptable, (3) ownership clair : l'equipe web-broker maintient ses traductions, l'equipe shared-ui maintient les helpers genericiques, (4) lazy loading per app : next-intl charge UNIQUEMENT le fichier locale actif pour l'app courante, donc 600 cles fr.json pesent ~24 ko gzipped sur app load, ar-MA.json absent du bundle initial (chargé sur switch). Les helpers `formatDate`, `formatCurrency`, `pluralize`, `LocaleSwitcher`, `DirectionProvider` restent dans shared-ui (réutilisation cross-apps essentielle), seul le **catalog de strings métier** est dans l'app.

### Choix technique : next-intl 3.26.3 vs migration v4

Le package `next-intl` annonce une v4 prevue Q1 2026 avec breaking changes (signature `getRequestConfig` reçoit objet `{ requestLocale }` au lieu de `{ locale }`, API `useLocale` renvoie objet `{ value, isLoading }` au lieu de string). Sprint 4 a installé v3.26.3 stable. Sprint 16 Tache 4.3.13 reste sur v3.26.3 pour les raisons suivantes : (a) migration v3 -> v4 estimée 2h de codemod automatique (`npx @next-intl/codemod migrate-v3-to-v4`), (b) v4 n'apporte pas de fonctionnalité bloquante pour web-broker (les helpers et middleware fonctionnent identiquement), (c) risque migration sprint critique -- la production web-broker doit être stable pour démo client Sprint 18 Phase 4 Insure complete, (d) plan : migration v3 -> v4 plannifiée pour Sprint 27 (web-insurtech-admin super admin Skalean) avec impact synchronisé 8 apps, (e) v3 supportée LTS jusqu'à Q3 2026 par Jan Amann (mainteneur sponsorisé Vercel).

### Choix technique : date-fns 4.x vs Day.js vs Luxon

| Lib | Bundle gzip | Locale support | Timezone support | Tree-shaking | Maintenance |
|-----|------------|----------------|------------------|--------------|-------------|
| **date-fns 4.1.x** (CHOIX) | ~12 ko (used functions only) | Excellent (60+ locales) | `date-fns-tz` companion 4.x | Excellent | Active |
| Day.js 1.11.x | ~7 ko | Bon (140+ locales plugins) | Plugin requis | Moyen | Active |
| Luxon 3.x | ~25 ko | Excellent (Intl native) | Native | Faible | Active |
| moment.js 2.30.x | ~67 ko | Excellent | Plugin | Inexistant (deprecated) | Maintenance |

**Decision** : `date-fns 4.1.0` + `date-fns-tz 4.x` (deja installé Sprint 1). Justifications : (1) tree-shaking excellent -- on importe `import { format } from 'date-fns'` + `import { fr } from 'date-fns/locale/fr'` + `import { arMA } from 'date-fns/locale/ar-MA'` + `import { ar } from 'date-fns/locale/ar'` (uniquement les locales nécessaires, ~3 ko par locale chargee), (2) API immuable functional cohérente, (3) compagnon `date-fns-tz` gère IANA timezone DST automatiquement, (4) stack uniforme avec Sprint 4 (1.4.11 utilisait date-fns).

### Choix technique : Intl.NumberFormat natif vs Numbro vs accounting.js

Pour formatter le MAD (Dirham Marocain) en format `1 234,56 DH` (fr) ou `1234.56 DH` (ar), on utilise `Intl.NumberFormat` natif du navigateur (zéro bundle, support universel evergreen browsers + Node 18+). Le code ISO 4217 MAD est reconnu, le symbole rendu est `MAD` ou `د.م.` selon locale -- on post-process avec `.replace('MAD', 'DH').replace('د.م.', 'د.م.')` pour respecter la convention utilisateur MA qui préfère l'abréviation `DH`. **Alternative considérée et rejetée** : numbro 2.x (~15 ko, gère les chiffres arabo-indiens automatiquement) -- rejeté car polyfill non nécessaire (Intl est universel sur targets Sprint 4), et la conversion arabo-indiens (`٠١٢٣٤٥٦٧٨٩`) est optionnelle dans l'usage MA (par défaut chiffres latins même en arabe car compatibles systèmes paiement + comptabilité + OCR).

### Choix technique : Intl.PluralRules natif vs make-plural

L'arabe gère 6 catégories CLDR (zero, one, two, few, many, other) contre 2 en français (one, other). `Intl.PluralRules` natif délègue au navigateur les règles CLDR. ICU MessageFormat est supporté nativement par next-intl pour les `{count, plural, =0 {...} few {...} other {...}}` patterns. Pas de bibliothèque tierce nécessaire. **Cas limite Darija (ar-MA)** : la Darija parlée n'a pas de règles pluralisation strictes (souvent simplifiée vs arabe classique standard). `Intl.PluralRules('ar-MA')` tombe sur les règles arabe classique (6 catégories). Pour l'app `web-broker`, on accepte ce comportement (collapse few/many vers other dans les traductions Darija si nécessaire au cas par cas).

### Choix technique : Noto Naskh Arabic vs Cairo vs Tajawal

Pour la font arabe, trois candidats Google Fonts populaires :

| Font | Style | Lisibilité écran | Poids disponibles | Taille subsetting arabe |
|------|-------|-------------------|---------------------|--------------------------|
| **Noto Naskh Arabic** (CHOIX) | Naskh classique formel | Excellente petits sizes | 400/500/600/700 | ~280 ko (2 poids) |
| Cairo | Géométrique moderne sans-serif arabe | Très bonne titles | 200-900 | ~320 ko (2 poids) |
| Tajawal | Modern condensé arabe | Bonne mais compact | 200/300/400/500/700/800/900 | ~250 ko (2 poids) |

**Décision** : Noto Naskh Arabic (poids 400 regular + 700 bold). Justifications : (1) Noto Naskh est le style traditionnel naskh utilisé par les administrations MA (similaire à la calligraphie des documents officiels), perception utilisateur "professionnelle + sérieuse" cohérente avec contexte assurance, (2) excellente lisibilité même à petites tailles (data tables polices avec colonnes denses), (3) couple parfaitement avec Geist Sans (font latine Sprint 4) -- proportions cohérentes en hauteur d'x-height, (4) deja chargé Sprint 4 1.4.11 -- pas de fetch supplémentaire, juste activation par locale.

### Trade-offs explicites

1. **Direction RTL via `<html dir="rtl">` server-side** : risque hydration mismatch si le calcul de `dir` differe cote serveur (lit cookie raw avant route resolution) et client (lit `useLocale()` hook post-resolution). Solution : `dir` calculé **uniquement** depuis `params.locale` (route segment server-resolved par next-intl middleware), jamais depuis cookie côté server. Le `DirectionProvider` client-side n'est utilisé que pour les **changements dynamiques** post-mount (locale switch sans full reload), via `document.documentElement.dir = 'rtl'` après `useLocale()` change.

2. **Tailwind 4 logical properties** : Tailwind 4 expose nativement les utilities `ms-*` (margin-inline-start), `me-*` (margin-inline-end), `ps-*` (padding-inline-start), `pe-*` (padding-inline-end), `start-*` (inset-inline-start), `end-*` (inset-inline-end). Sous `[dir="rtl"]`, ces utilities mirroient automatiquement via CSS logical properties natives navigateur. **Limitation** : les developpeurs qui utilisent encore `ml-4`/`mr-4` (margin-left/right physiques) cassent le RTL. Solution Sprint 16 : ESLint plugin `eslint-plugin-tailwindcss` avec rule custom `no-physical-properties` (warning toutes utilities `ml-*`, `mr-*`, `pl-*`, `pr-*`, `left-*`, `right-*`). Sprint 4 a deferré cette rule, Sprint 16 l'active strictement pour web-broker.

3. **Icones directionnels chevron / arrow flip RTL** : les composants `ChevronRight` (lucide-react), `ArrowRight`, `BreadcrumbSeparator`, `PaginationNext` doivent flipper visuellement en RTL pour préserver la sémantique directionnelle (`next` doit pointer vers la fin de lecture = gauche en RTL, droite en LTR). Solution : composant wrapper `<IconFlip icon={ChevronRight} className="rtl:rotate-180" />` ou utility CSS `[dir="rtl"] .rtl-flip { transform: scaleX(-1); }`. Sprint 16 livre ce wrapper et l'applique systematiquement dans les 12 pages.

4. **shadcn/ui RTL-aware par default** : les composants shadcn/ui v0.4+ ont été migrés vers Tailwind 4 logical properties. `<DropdownMenu>` aligne automatiquement les contents `start` (= droite en RTL, gauche en LTR), `<Sheet side="end">` s'ouvre depuis le bord opposé à la lecture (gauche en RTL, droite en LTR). Sprint 16 valide visuellement les 12 pages avec captures Playwright en mode RTL.

5. **Cookie `NEXT_LOCALE` 365 jours** : préférence utilisateur persistante, non considérée PII (loi 09-08 CNDP exempte les cookies strictement nécessaires au fonctionnement multilingue, article 82 directive ePrivacy équivalent). Pas de bannière consentement requise pour ce cookie. Documente dans `i18n-strategy.md` (lien Sprint 4).

6. **Fallback chain `ar-MA -> ar -> fr`** : si une cle existe dans `fr.json` mais manque dans `ar-MA.json`, next-intl retourne `undefined` au runtime et affiche un avertissement console. Solution : (a) script CI `lint-translations.ts` execute en pre-commit Husky + CI GitHub Actions, exit code 1 si divergence, rapport markdown listant les cles manquantes par locale, (b) au runtime, fallback custom dans `getRequestConfig` qui merge en cascade ar-MA -> ar -> fr (le fichier ar-MA peut être partiellement traduit, les cles manquantes tombent sur ar formel, puis sur fr en dernier recours pour les messages techniques ultra-rares non traduits).

7. **DST Africa/Casablanca Ramadan 2026 mi-février à mi-mars** : le Maroc applique le DST inversé depuis 2018 -- horaire d'été maintenu sauf pendant le Ramadan où l'horaire recule de 1h pour faciliter le jeûne. Cette particularité est nativement gérée par `Intl.DateTimeFormat` avec `timeZone: 'Africa/Casablanca'` (navigateurs IANA tz database à jour). **Tests Sprint 16** : `formatDate(new Date('2026-03-01T12:00:00Z'), 'fr')` doit renvoyer `12:00` (heure locale Ramadan), `formatDate(new Date('2026-04-01T12:00:00Z'), 'fr')` doit renvoyer `13:00` (heure locale post-Ramadan, GMT+1).

8. **Dates ambiguës `dd/MM/yyyy` vs `MM/dd/yyyy`** : le format `10/01/2026` est ambigu (10 janvier ou 1 octobre). Sprint 16 force systématiquement `dd/MM/yyyy` (jour-mois-année) pour toutes les locales (fr, ar-MA, ar) car convention MA. Helper `formatDate(date, locale)` utilise `format(date, 'dd/MM/yyyy', { locale })` de date-fns. Format `yyyy-MM-dd` ISO utilisable uniquement en `<input type="date">` HTML5.

9. **Currency MAD symbole "DH" non-standard ISO** : `Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' })` produit `"1 234,56 MAD"` par défaut. La préférence utilisateur MA est `"1 234,56 DH"`. Solution helper `formatCurrency`: post-process `.replace('MAD', 'DH').replace('د.م.', 'DH')`. Risque : si un futur composant parse le rendu pour réextraire la devise, cassure. Mitigation : `formatCurrency` retourne `{ formatted: '1 234,56 DH', amount: 1234.56, currency: 'MAD' }` (objet structuré) en plus de la string.

10. **Numéraux Arabic-Indic optionnels** : l'arabe classique utilise traditionnellement les chiffres arabo-indiens (`٠١٢٣٤٥٦٧٨٩`) au lieu des chiffres latins (`0123456789`). En MA : `fr` utilise toujours latins, `ar` peut utiliser les deux selon contexte. `Intl.NumberFormat('ar', { numberingSystem: 'arab' })` produit `١٬٢٣٤٫٥٦` (avec séparateurs U+066B et U+066C). **Decision Sprint 16** : par défaut, `ar` utilise chiffres latins (compatible systèmes de paiement, OCR documents, comptabilité, exports CSV/Excel). Option `useArabicIndicNumerals: true` exposée dans `formatNumber(amount, locale, options)` pour cas usage spécifique (documents PDF formels Sprint 17 generated par broker-queue).

11. **LocaleSwitcher préserve `pathname + searchParams + hash`** : un utilisateur sur `/fr/contacts?page=3&segment=premium&q=ahmed#contact-12` clique LocaleSwitcher vers `ar-MA`. Résultat attendu : `/ar-MA/contacts?page=3&segment=premium&q=ahmed#contact-12`. Implementation : `useRouter()` + `usePathname()` + `useSearchParams()` next-intl wrappers + read `window.location.hash` côté client. Test E2E spécifique (LocaleSwitcher.e2e.spec.ts).

12. **Form submit en cours de switch locale** : edge case -- utilisateur remplit un formulaire (contact création) puis switch locale au milieu. Sprint 16 protect via `onBeforeLocaleSwitch` callback dans `LocaleSwitcher` qui détecte les forms dirty (react-hook-form `formState.isDirty`) et affiche une confirmation modal "Continuer ? Vous perdrez les données saisies." (en locale courante).

13. **Server-side dir vs client mismatch warning** : si server-render avec `dir="rtl"` (locale ar) mais client switch en cours d'hydration vers `dir="ltr"` (locale fr), React produit un warning. Sprint 16 évite via : (a) calcul `dir` uniquement depuis `params.locale` (route segment), (b) `DirectionProvider` `'use client'` ne mute `document.documentElement.dir` que sur changement de locale post-hydration explicite (clic LocaleSwitcher), pas au mount initial.

14. **Noto Naskh Arabic font failed load fallback** : si le fetch Google Fonts échoue (réseau dégradé, CDN bloqué pare-feu entreprise), fallback chain `font-family: 'Noto Naskh Arabic', 'Geeza Pro', 'Tahoma', 'Geist Sans', sans-serif`. Geeza Pro existe sur macOS, Tahoma sur Windows et Linux Wine, Geist Sans en dernier recours (rendu acceptable car contient les glyphes arabes basiques). Test E2E vérifie `getComputedStyle().fontFamily` non vide même avec network throttling.

15. **Pluralisation Darija ambiguë** : la Darija parlée n'a pas de règles pluralisation strictes. `Intl.PluralRules('ar-MA')` tombe sur règles arabe classique (6 catégories). Solution : dans `messages/ar-MA.json`, les patterns ICU pluralization peuvent omettre les catégories `zero/two/few/many` et garder seulement `=0`, `one`, `other` -- next-intl tombe automatiquement sur `other` pour les catégories non spécifiées.

16. **z-index conflict LocaleSwitcher dropdown vs sticky topbar** : le dropdown doit avoir `z-50` minimum. Conflit potentiel avec sticky topbar `z-40`. Solution : dropdown shadcn/ui Popover par défaut a `z-[60]`. Vérification visuelle Sprint 16.

17. **URL pathnames non-traduits** : Sprint 4 1.4.11 avait évoqué la possibilité de traduire les segments d'URL (`/fr/contacts` vs `/ar-MA/جهات-الاتصال`). Sprint 16 **décide explicitement** de ne PAS traduire les URLs (uniquement le prefix locale). Justifications : (a) SEO simpler (canonical URLs cross-locale via hreflang), (b) deep linking facile (partage URL `/contacts/123` sans confusion locale), (c) breadcrumbs auto-générés depuis pathname plus simples, (d) Sprint 17+ pourra ajouter pathnames localisés via next-intl `pathnames` config si demande utilisateur.

18. **TanStack Query cache key locale-aware** : les query keys doivent inclure la locale courante pour éviter de servir des données traduites en cache obsolète. Exemple : `useQuery({ queryKey: ['contacts', locale, filters], ... })`. Sprint 16 audit les 12 pages pour s'assurer que toutes les queries qui retournent des données traduites (status labels, segment labels, branches assurance) incluent `locale` dans la queryKey.

### Decisions stratégiques référencées

- **decision-006 (NO EMOJI ABSOLU)** : aucune emoji dans aucun fichier code, JSON messages, README. Linter CI verifie. Caractères arabes et accents francais autorisés (Unicode arabe U+0600-U+06FF, Unicode arabe étendu U+0750-U+077F, Unicode présentation arabe-A U+FB50-U+FDFF, Unicode présentation arabe-B U+FE70-U+FEFF).
- **decision-008 (cloud souverain MA Atlas Cloud Benguerir)** : flags SVG des locales servis depuis `/public/flags/{fr,ar-MA,ar}.svg` (assets locaux Sprint 4), pas depuis CDN externe.
- **decision-009 (multilinguisme MA OBLIGATOIRE)** : 3 locales `fr / ar-MA / ar` non négociables. Tamazight Tifinagh `tmz-MA` réservée Sprint 30+. Anglais `en` réservé Sprint 18 (customer-portal public SEO).
- **decision-010 (web-broker premier UI métier production)** : web-broker est le premier UI métier livré, doit être exemplaire en qualité (i18n 100% coverage, RTL parfait, A11y AA).
- **WCAG SC 3.1.1 (Niveau A)** : attribut `lang` sur `<html>` mandatoire. Implementation `<html lang={locale} dir={dir}>` server-rendered.
- **WCAG SC 3.1.2 (Niveau AA)** : `lang` attribute sur sections changement langue ponctuel. Sprint 16 applique `<span lang="ar">arabic text</span>` dans les pages fr qui affichent du contenu arabe (ex: noms propres arabes dans fiche contact).
- **WCAG SC 1.4.3 (Niveau AA)** : contraste 4.5:1 minimum. Sprint 16 valide via axe-core que la font Noto Naskh Arabic rendue sur tokens couleur Sofidemy (Sprint 4) respecte les ratios.
- **Loi 09-08 CNDP** : préférence locale stockée cookie NEXT_LOCALE n'est PAS PII. Pas de consentement explicite requis. Documenté `i18n-strategy.md`.
- **Constitution MA Article 5** : multilinguisme MA officiel arabe + tamazight + dialectes. Sprint 16 conforme via 3 locales.
- **ACAPS Circulaire 03-21** : rapports broker disponibles fr + ar (signature officielle MA bilingue). Sprint 16 fournit les chaines UI traduites, l'export PDF bilingue est livré Sprint 31 (reporting ACAPS).

### Pièges techniques connus (20 minimum)

1. **Cle manquante en ar-MA fallback ar puis fr** : developpeur ajoute `polices.cancel_confirm` dans `fr.json` mais oublie `ar-MA.json` et `ar.json`. Build TypeScript passe (next-intl genere types depuis premier locale lu = fr), runtime ar = MISSING_MESSAGE warning console + display key au lieu de valeur. Solution : script CI `lint-translations.ts` execute en pre-commit Husky + CI, exit 1 si divergence, rapport markdown.

2. **Currency MAD négatif format** : `formatCurrency(-1234.56, 'fr')` doit produire `"-1 234,56 DH"` (signe avant) ou `"(1 234,56 DH)"` (parentheses comptable). Sprint 16 décide format signe avant pour cohérence avec ACAPS reporting standard.

3. **Date timezone Ramadan DST -1h** : `formatDate(new Date('2026-03-15T12:00:00Z'), 'fr')` pendant Ramadan 2026 doit renvoyer `"15/03/2026, 12:00"` (heure locale GMT+0 Ramadan), pas `"15/03/2026, 13:00"` (heure post-Ramadan GMT+1). Tests Vitest spécifiques avec dates mockées en Ramadan.

4. **Plural zero count** : `pluralize(0, 'ar', 'polices_count')` doit retourner `"لا توجد بوالص"` (= "aucune police") via catégorie CLDR `zero`. Tests Vitest avec assertions strictes.

5. **Plural very large count** : `pluralize(10000, 'ar', 'polices_count')` doit retourner `"10 آلاف بوليصة"` via catégorie CLDR `other` avec formatting compact. Tests Vitest.

6. **Locale switch mid-form submit** : utilisateur soumet formulaire (POST in-flight) puis switch locale. Sprint 16 attend la réponse avant redirect (await onSubmit + toast result en nouvelle locale).

7. **Hash + searchParams preserved on switch** : URL `/fr/contacts?page=3#item-12` switch vers `/ar-MA/contacts?page=3#item-12`. Test E2E spécifique.

8. **Server-side dir vs client mismatch** : géré par calcul deterministe `dir` depuis route segment, jamais depuis cookie côté server.

9. **Noto Naskh font failed load** : fallback chain garantit rendu acceptable. Test E2E avec network throttling block Google Fonts.

10. **Cookie SameSite Lax production HTTPS** : si app embeddable iframe Sprint 18, SameSite=Strict casse. Decision : Lax + Secure prod uniquement.

11. **Pluralisation arabe 6 catégories edge cases** : test 0, 1, 2, 3, 6, 11, 100, 1000 explicitement avec valeurs CLDR attendues.

12. **next-intl `useTranslations` dans Server Component** : doit utiliser `getTranslations` async côté server, pas `useTranslations` hook (client only). Erreur typique : `useTranslations is not a function`. Solution : import asymétrique.

13. **NextIntlClientProvider missing wrap** : oubli wrap = `useTranslations` throws "No locale found". `[locale]/layout.tsx` toujours wrappe `children` dans `<NextIntlClientProvider>` après `<NextIntlServerProvider>` implicit.

14. **Messages JSON > 1000 keys per app perf** : Sprint 16 web-broker atteint ~600 cles. Pas encore lazy loading per namespace. Sprint 17+ activera si demande.

15. **LocaleSwitcher z-index** : `z-[60]` shadcn/ui Popover par défaut, OK avec topbar `z-40`.

16. **Locale invalide dans URL `/fr-FR/dashboard`** : utilisateur tape `fr-FR` (au lieu de `fr`) ou `ar-EG`. Middleware next-intl ne reconnaît pas, retourne 404. Solution Sprint 16 : `notFound()` page localisée (pas redirect, evite SEO duplicate).

17. **Tailwind RTL utilities Tailwind 4** : Sprint 4 utilise Tailwind 4.0.0-beta.4. Si fallback Tailwind 3.4.x, plugin `tailwindcss-rtl` requis. Documenté `i18n-strategy.md`.

18. **Cookie httpOnly vs JS-readable** : `NEXT_LOCALE` doit être JS-readable côté client (lecture par `LocaleSwitcher` pour précocher l'option active). Pas `httpOnly`. Différent des cookies auth (`access_token`, `refresh_token`) qui restent httpOnly.

19. **Bidirectionnel text isolated `<bdi>`** : nom propre arabe dans phrase française doit être isolé via `<bdi>` HTML pour éviter inversion ordre. Exemple : `Contact: <bdi lang="ar">أحمد</bdi> (CIN ABC123)`. Sprint 16 applique dans le rendu contacts.

20. **Aria-label traduit** : tous les `aria-label` et `aria-describedby` doivent être traduits. Sprint 16 audit les 12 pages. Test axe-core verify.

---

## 3. Architecture context (3-5 ko)

### Position dans Sprint 16

Tache 4.3.13 est l'**avant-derniere** tache du Sprint 16, après les 12 taches de livraison des pages applicatives et avant les tests E2E final (4.3.14) :

```
Sprint 16 -- Web Broker App (14 taches)

[4.3.1 app skeleton + middleware + i18n setup]  <-- pose next-intl 3.26.3 + 3 locales
[4.3.2 pages auth]                              <-- pages login/MFA/signup (chaines fr partielles)
[4.3.3 layout sidebar + topbar]                  <-- LocaleSwitcher squelette (a etendre 4.3.13)
[4.3.4 dashboard 6 widgets]                      <-- chaines dashboard
[4.3.5 contacts list + form + detail]             <-- chaines contacts
[4.3.6 companies]                                  <-- chaines companies
[4.3.7 deals kanban + table]                       <-- chaines deals
[4.3.8 polices list + detail]                      <-- chaines polices
[4.3.9 broker-queue]                                <-- chaines broker_queue
[4.3.10 sinistres read-only]                       <-- chaines sinistres
[4.3.11 parametres + profile]                      <-- chaines parametres + profile
[4.3.12 RBAC UI]                                    <-- HasPermission + HasRole
              |
              v
[4.3.13 i18n COMPLETE]  <-- CETTE TACHE finalise les 600 cles + RTL + LocaleSwitcher operationnel
              |
              v
[4.3.14 Tests E2E Playwright 20+ + a11y]           <-- valide RTL + locales + chaines traduites
```

### Position dans le programme

Cette tache **finalise** la première app i18n production-ready du programme et sert de **patron operationnel** pour les sprints frontend suivants :

- **Sprint 17 (web-customer-portal vente en ligne SEO)** : copiera la structure messages/{fr,ar-MA,ar}.json + LocaleSwitcher + helpers formatters. Ajoutera locale `en` pour SEO public.
- **Sprint 18 (web-assure-portal)** : self-service assuré, copiera pattern Sprint 16.
- **Sprint 22 (web-garage-app)** : ajout vocabulaire technique réparation auto, copiera pattern.
- **Sprint 27 (web-insurtech-admin)** : SuperAdmin Skalean, copiera pattern + migration next-intl v4.
- **Sprint 31 (reporting ACAPS)** : exports PDF bilingues FR/AR utilisent les helpers formatDate/formatCurrency.
- **Sprint 33+ (Takaful)** : assurance islamique, ajout namespaces `takaful.*` aux traductions ar formel.

### Diagramme ASCII architecture i18n web-broker

```
repo/apps/web-broker/
  app/
    [locale]/
      layout.tsx                              # injecte <html lang dir font> + NextIntlClientProvider
      (auth)/
        login/page.tsx                         # utilise useTranslations('auth')
        verify-mfa/page.tsx                    # useTranslations('auth.mfa')
        signup/page.tsx                        # useTranslations('auth.signup')
        ...
      (protected)/
        dashboard/page.tsx                     # useTranslations('dashboard')
        contacts/page.tsx                      # useTranslations('contacts')
        contacts/[id]/page.tsx                 # useTranslations('contacts.detail')
        companies/page.tsx                     # useTranslations('companies')
        deals/page.tsx                         # useTranslations('deals')
        polices/page.tsx                       # useTranslations('polices')
        broker-queue/page.tsx                  # useTranslations('broker_queue')
        sinistres/page.tsx                     # useTranslations('sinistres')
        parametres/page.tsx                    # useTranslations('parametres')
        profile/page.tsx                       # useTranslations('profile')
        ...
    globals.css                                # CSS additions [dir="rtl"] selectors
    not-found.tsx                              # localisee
    error.tsx                                  # localisee
  components/
    layout/
      locale-switcher.tsx                      # CETTE TACHE etend Sprint 4 + preserve searchParams
      sidebar.tsx                              # adapte direction nav RTL
      topbar.tsx                               # adapte direction RTL
    ui/
      icon-flip.tsx                            # CETTE TACHE wrapper icones directionnels
  lib/
    i18n/
      routing.ts                               # CETTE TACHE config 3 locales web-broker
      request.ts                               # CETTE TACHE getRequestConfig + fallback chain
      use-translations.tsx                     # CETTE TACHE hook wrapper typage namespaces
      types.ts                                 # CETTE TACHE AppMessages exhaustive
      formatters.ts                            # CETTE TACHE formatDate/Time/Currency/etc.
      pluralize.ts                             # CETTE TACHE Intl.PluralRules helper
      lint-translations.ts                     # CETTE TACHE script CI parite cles
  messages/
    fr.json                                    # CETTE TACHE ~600 cles canoniques
    ar-MA.json                                 # CETTE TACHE ~600 cles Darija
    ar.json                                    # CETTE TACHE ~600 cles arabe classique
  middleware.ts                                # existe Sprint 4.3.1 reutilise
  next.config.mjs                              # existe Sprint 4.3.1 reutilise

repo/packages/shared-ui/                       # REUTILISE Sprint 4 (deja livre)
  src/i18n/                                    # routing, request, navigation, locales, types canoniques
  src/components/                              # LocaleSwitcher base + DirectionProvider
  src/lib/                                     # format-date, format-number, format-list, pluralize generiques
```

### Provider chain rendu (web-broker)

```
<html lang="ar-MA" dir="rtl" class="font-noto-naskh">
  <body>
    <ThemeProvider attribute="class" defaultTheme="system">
      <NextIntlClientProvider locale="ar-MA" messages={messages} timeZone="Africa/Casablanca" now={new Date()}>
        <DirectionProvider>
          <QueryClientProvider client={queryClient}>
            <TenantProvider>
              <SidebarProvider>
                <SidebarInset>
                  <Topbar>
                    <GlobalSearch />
                    <NotificationsBell />
                    <TenantSwitcher />
                    <LocaleSwitcher />            <-- CETTE TACHE
                    <UserMenu />
                  </Topbar>
                  {children}                       <-- pages localisees
                </SidebarInset>
                <Sidebar>
                  <NavigationItems />              <-- labels traduits useTranslations('nav')
                </Sidebar>
              </SidebarProvider>
            </TenantProvider>
            <SonnerToaster />                      <-- toasts en locale courante
          </QueryClientProvider>
        </DirectionProvider>
      </NextIntlClientProvider>
    </ThemeProvider>
  </body>
</html>
```

### Flux requête utilisateur switch locale

```
1. User est sur /fr/contacts?page=3&segment=premium#contact-12
2. User clique LocaleSwitcher (topbar)
3. Dropdown s'ouvre avec 3 options : Francais (fr), Darija (ar-MA), Arabe (ar)
4. User clique "Darija (ar-MA)"
5. LocaleSwitcher onClick :
   a. read currentPathname = '/contacts'
   b. read currentSearchParams = '?page=3&segment=premium'
   c. read currentHash = '#contact-12'
   d. construct newPath = '/ar-MA/contacts?page=3&segment=premium#contact-12'
   e. document.cookie = 'NEXT_LOCALE=ar-MA; path=/; max-age=31536000; SameSite=Lax; Secure'
   f. router.replace(newPath) -- next-intl wrappers preserve searchParams
   g. window.location.hash = '#contact-12' -- preserve hash explicit
6. Next.js middleware intercepte request /ar-MA/contacts?page=3...
7. Middleware verifie locale supported -> OK
8. Route segment [locale=ar-MA] resolved
9. layout.tsx server-side fetch messages ar-MA.json (~24 ko gzipped)
10. Render <html lang="ar-MA" dir="rtl" class="font-noto-naskh">
11. Page contacts re-rendered avec strings ar-MA Darija
12. Font Noto Naskh swap (preload depuis Sprint 4)
13. URL bar reflete /ar-MA/contacts?page=3&segment=premium#contact-12
14. Scroll position preserve par browser (hash anchor)
```

### Liste des 12 pages applicatives web-broker à traduire

| Page | Tâche source | Namespace messages | Approx cles |
|------|--------------|---------------------|-------------|
| /[locale]/login | 4.3.2 | auth.login | 25 |
| /[locale]/verify-mfa | 4.3.2 | auth.mfa | 15 |
| /[locale]/signup | 4.3.2 | auth.signup | 30 |
| /[locale]/forgot-password | 4.3.2 | auth.forgot | 10 |
| /[locale]/reset-password | 4.3.2 | auth.reset | 10 |
| /[locale]/verify-email | 4.3.2 | auth.verify_email | 5 |
| /[locale]/select-tenant | 4.3.2 | auth.select_tenant | 10 |
| /[locale]/dashboard | 4.3.4 | dashboard | 45 |
| /[locale]/contacts | 4.3.5 | contacts (list + form + detail) | 65 |
| /[locale]/companies | 4.3.6 | companies | 50 |
| /[locale]/deals | 4.3.7 | deals (kanban + table + dialog) | 55 |
| /[locale]/polices | 4.3.8 | polices (list + 6 tabs + dialogs) | 75 |
| /[locale]/broker-queue | 4.3.9 | broker_queue (SLA + dialogs) | 45 |
| /[locale]/sinistres | 4.3.10 | sinistres (read-only) | 40 |
| /[locale]/parametres | 4.3.11 | parametres (7 tabs) | 55 |
| /[locale]/profile | 4.3.11 | profile (3 tabs + MFA setup) | 45 |
| communs cross-pages | toutes | common (loading, save, cancel...) | 25 |
| navigation sidebar | 4.3.3 | nav (8 items) | 12 |
| errors | toutes | errors (network/unauthorized/...) | 20 |
| layout meta | 4.3.1 | meta (title, description) | 5 |
| locale labels | 4.3.13 | locale (fr/ar-MA/ar names) | 3 |

**Total approximatif** : 645 cles par locale. Sprint 16 vise 600 minimum, livre ~650 effectif pour marge couverture.

---

## 4. Livrables checkables (32+ deliverables)

- [ ] **L1** : `repo/apps/web-broker/messages/fr.json` (~650 cles namespaces complets) -- catalog français canonique, registre commercial professionnel formel, accents Unicode UTF-8, separateurs decimaux virgule.

- [ ] **L2** : `repo/apps/web-broker/messages/ar-MA.json` (~650 cles parité stricte fr.json) -- catalog Darija marocaine, mix arabe + lexique français transliteré, registre familier, ecriture Unicode arabe U+0600-U+06FF avec direction RTL implicite.

- [ ] **L3** : `repo/apps/web-broker/messages/ar.json` (~650 cles parité stricte fr.json) -- catalog arabe classique formel institutionnel, registre administratif/juridique, vocabulaire ACAPS-compatible.

- [ ] **L4** : `repo/apps/web-broker/lib/i18n/routing.ts` (~60 lignes) -- extension Sprint 4 shared-ui routing avec config web-broker spécifique (3 locales, localePrefix always, defaultLocale fr, alternateLinks true).

- [ ] **L5** : `repo/apps/web-broker/lib/i18n/request.ts` (~80 lignes) -- `getRequestConfig` avec dynamic import messages depuis `apps/web-broker/messages/`, fallback chain ar-MA -> ar -> fr custom (merge cles manquantes en cascade), timeZone Africa/Casablanca, now Date, formats ICU défaut.

- [ ] **L6** : `repo/apps/web-broker/lib/i18n/use-translations.tsx` (~50 lignes) -- hook wrapper `useT(namespace)` typage strict `AppMessages`, autocomplete VSCode, erreur compile si cle manquante, support nesting `useT('contacts.detail.timeline')`.

- [ ] **L7** : `repo/apps/web-broker/lib/i18n/types.ts` (~80 lignes) -- type `AppMessages` exhaustif derivé de fr.json (source of truth), augmentation globale `IntlMessages` next-intl, types `LocaleCode = 'fr' | 'ar-MA' | 'ar'`, `LocaleConfig` interface, helpers `isRtl(locale)`, `getDirection(locale)`.

- [ ] **L8** : `repo/apps/web-broker/lib/i18n/formatters.ts` (~180 lignes) -- exports `formatDate(date, locale, options?)`, `formatTime(date, locale)`, `formatDateTime(date, locale)`, `formatRelativeTime(date, locale)`, `formatDateRange(start, end, locale)`, `formatCurrency(amount, locale, currency?)`, `formatNumber(value, locale, options?)`, `formatPercent(value, locale)`, `formatCompactNumber(value, locale)`, `formatList(items, locale, type?)`, tous timezone-aware Africa/Casablanca via date-fns-tz, support `useArabicIndicNumerals` option.

- [ ] **L9** : `repo/apps/web-broker/lib/i18n/pluralize.ts` (~70 lignes) -- helper `pluralize(count, locale, messageKey)` utilise `Intl.PluralRules` natif pour selectionner la categorie CLDR appropriée (6 catégories arabe, 2 français), retourne la cle messages adéquate (`{key}.zero`, `{key}.one`, ..., `{key}.other`), fallback `.other` si catégorie absente.

- [ ] **L10** : `repo/apps/web-broker/components/layout/locale-switcher.tsx` (~150 lignes) -- extension Sprint 4 shared-ui `LocaleSwitcher` avec preservation `pathname + searchParams + hash`, persist cookie `NEXT_LOCALE` 365j SameSite=Lax Secure prod, dropdown shadcn/ui DropdownMenu, options 3 locales avec drapeaux SVG `/flags/{code}.svg`, native names ("Français", "الدارجة", "العربية"), aria-label "Switch language" traduit, onBeforeSwitch hook protection forms dirty (react-hook-form `formState.isDirty`).

- [ ] **L11** : `repo/apps/web-broker/app/globals.css` -- additions CSS RTL : selecteurs `[dir="rtl"]`, font-family Noto Naskh Arabic conditionnel, utility `.rtl-flip { transform: scaleX(-1); }`, mirroring chevrons `[dir="rtl"] [data-slot="chevron-right"] { transform: rotate(180deg); }`, support `font-feature-settings` arabe ligatures.

- [ ] **L12** : `repo/apps/web-broker/components/ui/icon-flip.tsx` (~40 lignes) -- composant wrapper `<IconFlip icon={ChevronRight} />` applique automatiquement la classe `rtl:rotate-180` Tailwind 4, encapsule la logique flip directionnel pour tous les icones de navigation (chevrons, arrows, breadcrumb separators, pagination next/prev).

- [ ] **L13** : `repo/apps/web-broker/app/[locale]/layout.tsx` -- extension Sprint 4.3.1 : injection conditionnelle font Noto Naskh Arabic via `next/font/google` `subsets: ['arabic']` `weight: ['400', '700']` `display: 'swap'` `variable: '--font-noto-naskh'` quand locale ar ou ar-MA, attribute `<html lang={locale} dir={dir}>` server-rendered, `<NextIntlClientProvider>` wrapping avec messages chargees server-side.

- [ ] **L14** : `repo/apps/web-broker/lib/i18n/lint-translations.ts` (~120 lignes) -- script TypeScript executé via `pnpm i18n:lint` qui (a) charge les 3 fichiers messages/{fr,ar-MA,ar}.json, (b) extrait toutes les cles flat-pathées (notation dot `auth.login.email_placeholder`), (c) compare les sets cles cross-locale, (d) produit rapport markdown `repo/.cache/i18n-coverage.md` avec sections par locale listant cles manquantes/orphan, (e) exit code 1 si divergence, 0 si parité parfaite.

- [ ] **L15** : `repo/apps/web-broker/lib/i18n/extract-keys.ts` (~80 lignes) -- utility extract toutes cles utilisées via `useTranslations()` / `getTranslations()` / `t()` dans le codebase TypeScript apps/web-broker/, compare avec fr.json catalog, detecte cles orphans (présentes dans JSON mais non utilisées dans code) et cles manquantes (utilisées dans code mais absentes JSON).

- [ ] **L16** : `repo/apps/web-broker/lib/i18n/index.ts` (~25 lignes) -- barrel export re-export `useT`, `formatters`, `pluralize`, `LocaleCode`, `isRtl`, `getDirection` pour import unifié `import { useT, formatCurrency } from '@/lib/i18n'`.

- [ ] **L17** : `repo/apps/web-broker/.env.example` -- variables additionnelles : `NEXT_PUBLIC_DEFAULT_LOCALE=fr`, `NEXT_PUBLIC_SUPPORTED_LOCALES=fr,ar-MA,ar`, `NEXT_PUBLIC_TIMEZONE=Africa/Casablanca`, `NEXT_PUBLIC_LOCALE_FALLBACK_CHAIN=ar-MA:ar:fr`, `NEXT_PUBLIC_USE_ARABIC_INDIC_NUMERALS=false`, `NEXT_PUBLIC_CURRENCY_SYMBOL=DH`, `NEXT_PUBLIC_CURRENCY_CODE=MAD`.

- [ ] **L18** : Tests unitaires Vitest dans `repo/apps/web-broker/lib/i18n/__tests__/` :
  - `formatters.spec.ts` (~280 lignes, 25 tests : formatDate fr/ar-MA/ar x date normal/Ramadan/DST, formatCurrency MAD/négatif/zéro, formatNumber chiffres latins/arabo-indiens, formatList conjunction/disjunction, formatRelativeTime past/future/now)
  - `pluralize.spec.ts` (~150 lignes, 12 tests : 0/1/2/3/11/100 count x fr/ar-MA/ar)
  - `routing.spec.ts` (~80 lignes, 5 tests)
  - `lint-translations.spec.ts` (~100 lignes, 6 tests : parité OK, missing keys, orphan keys, rapport markdown gen)
  - `use-translations.spec.tsx` (~120 lignes, 8 tests)

- [ ] **L19** : Tests composants Vitest + Testing Library :
  - `locale-switcher.spec.tsx` (~200 lignes, 10 tests : dropdown render, click switch, cookie persist, searchParams preserved, hash preserved, forms dirty confirmation)
  - `icon-flip.spec.tsx` (~80 lignes, 5 tests : LTR render, RTL render via dir context, custom className merge)

- [ ] **L20** : Tests E2E Playwright `repo/apps/web-broker/e2e/i18n-locale-switch.spec.ts` (~400 lignes, 15 tests) :
  - Switch fr -> ar-MA -> ar -> fr (4 cycles, vérifier `<html lang dir>` correct)
  - Cookie NEXT_LOCALE persiste après reload
  - LocaleSwitcher preserve `?page=3&segment=premium#item-12`
  - Accept-Language `fr-FR,fr;q=0.9` redirect /fr
  - Accept-Language `ar-EG` (not supported) redirect /fr
  - Font Noto Naskh Arabic chargée sur pages ar (verify getComputedStyle().fontFamily)
  - Dates formattées dd/MM/yyyy fr et ar
  - Currency MAD rendered "1 234,56 DH" fr, "1 234.56 DH" ar
  - Pluralisation arabe 0 contacts -> "لا توجد جهات اتصال"
  - Forms dirty + locale switch -> confirmation modal
  - RTL CSS appliqué : sidebar à droite, scrollbar à gauche
  - Icones chevrons flippés en RTL
  - Coverage 12 pages traduites (smoke test parcourt /[locale]/{contacts,deals,polices,...})

- [ ] **L21** : `repo/apps/web-broker/package.json` -- additions scripts : `"i18n:lint": "tsx lib/i18n/lint-translations.ts"`, `"i18n:extract": "tsx lib/i18n/extract-keys.ts"`, `"i18n:report": "pnpm i18n:lint && cat .cache/i18n-coverage.md"`.

- [ ] **L22** : `repo/apps/web-broker/turbo.json` -- ajout pipeline `i18n:lint` dependant de aucun, output `.cache/i18n-coverage.md`.

- [ ] **L23** : `.github/workflows/ci.yml` -- ajout step `pnpm --filter @insurtech/web-broker i18n:lint` après typecheck, échec build si cles divergent.

- [ ] **L24** : `repo/apps/web-broker/.husky/pre-commit` -- ajout `pnpm --filter @insurtech/web-broker i18n:lint --silent` avant lint-staged.

- [ ] **L25** : Validation Lighthouse Accessibility >= 95 sur `/fr/dashboard`, `/ar-MA/dashboard`, `/ar/dashboard` -- attribut `lang` correct + contraste Noto Naskh + ARIA labels traduits.

- [ ] **L26** : Validation `pnpm --filter @insurtech/web-broker typecheck` 0 erreur avec types AppMessages auto-générés depuis fr.json.

- [ ] **L27** : Validation `pnpm --filter @insurtech/web-broker test` 100% pass (60+ tests unitaires + composants).

- [ ] **L28** : Validation `pnpm --filter @insurtech/web-broker test:e2e:i18n` 15 tests passent.

- [ ] **L29** : Validation `pnpm --filter @insurtech/web-broker i18n:lint` exit 0, rapport markdown vide (parité parfaite).

- [ ] **L30** : Validation `grep -rP "[\x{1F600}-\x{1F6FF}]" apps/web-broker/messages/` retourne 0 (zero emoji).

- [ ] **L31** : Documentation `repo/apps/web-broker/lib/i18n/README.md` (~150 lignes) -- explique structure messages JSON, comment ajouter une cle, comment ajouter une locale, fallback chain, formatters API, pluralize patterns, FAQ développeur.

- [ ] **L32** : Validation manuelle visuelle screenshots Playwright : 12 pages x 3 locales = 36 captures stockees dans `repo/apps/web-broker/e2e/__screenshots__/i18n/` pour review designer.

---

## 5. Fichiers crees / modifies (liste exhaustive)

```
repo/apps/web-broker/messages/
  fr.json                                       # ~650 cles canoniques  -- L1
  ar-MA.json                                    # ~650 cles Darija       -- L2
  ar.json                                       # ~650 cles arabe formel -- L3

repo/apps/web-broker/lib/i18n/
  routing.ts                                    # ~60 lignes  -- L4
  request.ts                                    # ~80 lignes  -- L5
  use-translations.tsx                          # ~50 lignes  -- L6
  types.ts                                      # ~80 lignes  -- L7
  formatters.ts                                 # ~180 lignes -- L8
  pluralize.ts                                  # ~70 lignes  -- L9
  lint-translations.ts                          # ~120 lignes -- L14
  extract-keys.ts                               # ~80 lignes  -- L15
  index.ts                                      # ~25 lignes  -- L16
  README.md                                     # ~150 lignes -- L31
  __tests__/
    formatters.spec.ts                          # ~280 lignes (25 tests)
    pluralize.spec.ts                           # ~150 lignes (12 tests)
    routing.spec.ts                             # ~80 lignes  (5 tests)
    lint-translations.spec.ts                   # ~100 lignes (6 tests)
    use-translations.spec.tsx                   # ~120 lignes (8 tests)

repo/apps/web-broker/components/layout/
  locale-switcher.tsx                           # ~150 lignes -- L10 (etend Sprint 4)
  __tests__/
    locale-switcher.spec.tsx                    # ~200 lignes (10 tests)

repo/apps/web-broker/components/ui/
  icon-flip.tsx                                 # ~40 lignes  -- L12
  __tests__/
    icon-flip.spec.tsx                          # ~80 lignes  (5 tests)

repo/apps/web-broker/app/
  globals.css                                   # additions CSS RTL ~80 lignes -- L11
  [locale]/layout.tsx                           # extension font Noto Naskh -- L13

repo/apps/web-broker/e2e/
  i18n-locale-switch.spec.ts                    # ~400 lignes (15 tests) -- L20
  __screenshots__/i18n/                          # 36 captures           -- L32

repo/apps/web-broker/
  .env.example                                  # additions variables   -- L17
  package.json                                  # scripts i18n          -- L21
  turbo.json                                    # pipeline i18n:lint    -- L22

repo/.github/workflows/ci.yml                   # step i18n:lint        -- L23
repo/.husky/pre-commit                          # hook i18n:lint        -- L24
```

**Total approximatif** : ~22 fichiers créés + ~5 fichiers modifiés, ~3 200 lignes de code + ~1 950 cles JSON (650 x 3 locales) + tests.

---

## 6. Patron code complet : messages/fr.json (canonique)

```json
{
  "meta": {
    "title": "Skalean Broker",
    "description": "Plateforme courtage assurance multi-tenant Maroc",
    "keywords": "assurance, courtage, broker, polices, sinistres, Maroc, ACAPS",
    "og_title": "Skalean Broker -- ERP courtier assurance MA",
    "og_description": "Gestion complete polices, contacts, deals, sinistres conformite ACAPS"
  },
  "common": {
    "loading": "Chargement...",
    "loading_data": "Chargement des donnees...",
    "saving": "Enregistrement...",
    "submitting": "Envoi en cours...",
    "deleting": "Suppression...",
    "processing": "Traitement...",
    "error": "Erreur",
    "error_generic": "Une erreur est survenue. Veuillez reessayer.",
    "success": "Succes",
    "save": "Enregistrer",
    "save_changes": "Enregistrer les modifications",
    "cancel": "Annuler",
    "confirm": "Confirmer",
    "close": "Fermer",
    "back": "Retour",
    "next": "Suivant",
    "previous": "Precedent",
    "search": "Rechercher",
    "search_placeholder": "Rechercher...",
    "filter": "Filtrer",
    "filters": "Filtres",
    "filter_active": "{count} filtre(s) actif(s)",
    "clear_filters": "Effacer les filtres",
    "sort": "Trier",
    "sort_by": "Trier par",
    "ascending": "Croissant",
    "descending": "Decroissant",
    "refresh": "Actualiser",
    "export": "Exporter",
    "export_csv": "Exporter CSV",
    "export_excel": "Exporter Excel",
    "export_pdf": "Exporter PDF",
    "import": "Importer",
    "delete": "Supprimer",
    "delete_confirm": "Etes-vous sur de vouloir supprimer cet element ?",
    "edit": "Modifier",
    "create": "Creer",
    "create_new": "Creer nouveau",
    "add": "Ajouter",
    "remove": "Retirer",
    "view": "Voir",
    "view_details": "Voir details",
    "view_all": "Voir tout",
    "yes": "Oui",
    "no": "Non",
    "all": "Tous",
    "none": "Aucun",
    "select": "Selectionner",
    "select_all": "Tout selectionner",
    "deselect_all": "Tout deselectionner",
    "actions": "Actions",
    "more_actions": "Plus d'actions",
    "options": "Options",
    "settings": "Parametres",
    "help": "Aide",
    "documentation": "Documentation",
    "support": "Support",
    "feedback": "Retour",
    "language": "Langue",
    "currency": "Devise",
    "timezone": "Fuseau horaire",
    "pagination_showing": "Affichage {from} a {to} sur {total}",
    "pagination_page": "Page {page} sur {totalPages}",
    "pagination_per_page": "Par page :",
    "no_data": "Aucune donnee disponible",
    "no_results": "Aucun resultat",
    "empty_state": "Aucun element a afficher",
    "not_found": "Introuvable",
    "required": "Requis",
    "optional": "Optionnel",
    "copy": "Copier",
    "copied": "Copie",
    "share": "Partager",
    "download": "Telecharger",
    "upload": "Televerser",
    "drag_drop": "Glissez-deposez ou cliquez pour selectionner",
    "file_too_large": "Fichier trop volumineux (max {maxSize})",
    "file_invalid_type": "Type de fichier non autorise",
    "date_format_hint": "Format : JJ/MM/AAAA",
    "currency_format_hint": "Format : 1 234,56 DH"
  },
  "nav": {
    "dashboard": "Tableau de bord",
    "contacts": "Contacts",
    "companies": "Societes",
    "deals": "Affaires",
    "polices": "Polices",
    "broker_queue": "File de validation",
    "sinistres": "Sinistres",
    "parametres": "Parametres",
    "profile": "Profil",
    "logout": "Deconnexion",
    "main_navigation": "Navigation principale",
    "skip_to_content": "Aller au contenu"
  },
  "auth": {
    "login": {
      "title": "Connexion Skalean Broker",
      "subtitle": "Acces a votre espace courtier",
      "email_label": "Adresse email",
      "email_placeholder": "email@exemple.com",
      "password_label": "Mot de passe",
      "password_placeholder": "Mot de passe",
      "show_password": "Afficher le mot de passe",
      "hide_password": "Masquer le mot de passe",
      "remember_me": "Se souvenir de moi",
      "submit": "Se connecter",
      "submitting": "Connexion...",
      "forgot_password": "Mot de passe oublie ?",
      "no_account": "Pas encore de compte ?",
      "signup_link": "Creer un compte",
      "error_invalid_credentials": "Email ou mot de passe incorrect",
      "error_account_locked": "Compte verrouille. Contactez l'administrateur.",
      "error_account_disabled": "Compte desactive.",
      "error_email_not_verified": "Email non verifie. Consultez votre boite mail.",
      "error_too_many_attempts": "Trop de tentatives. Reessayez dans {minutes} minutes.",
      "success": "Connexion reussie",
      "redirecting": "Redirection..."
    },
    "mfa": {
      "title": "Verification a deux facteurs",
      "subtitle": "Entrez le code a 6 chiffres genere par votre application authentificateur",
      "code_label": "Code de verification",
      "code_placeholder": "000000",
      "submit": "Verifier",
      "submitting": "Verification...",
      "resend_code": "Renvoyer le code",
      "use_recovery_code": "Utiliser un code de recuperation",
      "recovery_code_label": "Code de recuperation",
      "recovery_code_placeholder": "XXXX-XXXX-XXXX",
      "error_invalid_code": "Code incorrect",
      "error_code_expired": "Code expire. Generez un nouveau code.",
      "error_too_many_attempts": "Trop de tentatives. Veuillez vous reconnecter.",
      "success": "Verification reussie"
    },
    "signup": {
      "title": "Creer un compte Skalean Broker",
      "subtitle": "Rejoignez la plateforme courtage MA",
      "first_name_label": "Prenom",
      "last_name_label": "Nom",
      "display_name_label": "Nom affiche",
      "email_label": "Email professionnel",
      "phone_label": "Telephone",
      "phone_placeholder": "+212 6XX XXX XXX",
      "password_label": "Mot de passe",
      "password_strength_label": "Force du mot de passe",
      "password_strength_weak": "Faible",
      "password_strength_medium": "Moyenne",
      "password_strength_strong": "Forte",
      "password_strength_very_strong": "Tres forte",
      "password_requirements_title": "Exigences mot de passe",
      "password_req_length": "Au moins 12 caracteres",
      "password_req_uppercase": "Une majuscule",
      "password_req_lowercase": "Une minuscule",
      "password_req_number": "Un chiffre",
      "password_req_special": "Un caractere special",
      "confirm_password_label": "Confirmer le mot de passe",
      "locale_label": "Langue preferee",
      "tenant_invitation_label": "Code d'invitation tenant",
      "terms_accept": "J'accepte les conditions generales d'utilisation",
      "terms_link": "Lire les conditions",
      "privacy_accept": "J'accepte la politique de confidentialite (loi 09-08)",
      "privacy_link": "Lire la politique",
      "submit": "Creer mon compte",
      "submitting": "Creation...",
      "have_account": "Deja un compte ?",
      "login_link": "Se connecter",
      "error_email_taken": "Cet email est deja utilise",
      "error_invalid_invitation": "Code d'invitation invalide",
      "error_weak_password": "Mot de passe trop faible",
      "error_passwords_dont_match": "Les mots de passe ne correspondent pas",
      "success_email_sent": "Compte cree. Verifiez votre email pour activer votre compte."
    },
    "forgot": {
      "title": "Mot de passe oublie",
      "subtitle": "Entrez votre email pour recevoir un lien de reinitialisation",
      "email_label": "Email",
      "submit": "Envoyer le lien",
      "submitting": "Envoi...",
      "back_to_login": "Retour a la connexion",
      "success": "Email envoye. Verifiez votre boite de reception."
    },
    "reset": {
      "title": "Reinitialiser le mot de passe",
      "subtitle": "Choisissez un nouveau mot de passe",
      "new_password_label": "Nouveau mot de passe",
      "confirm_password_label": "Confirmer",
      "submit": "Reinitialiser",
      "error_invalid_token": "Lien invalide ou expire",
      "success": "Mot de passe reinitialise. Connectez-vous."
    },
    "verify_email": {
      "title": "Verification email",
      "verifying": "Verification en cours...",
      "success": "Email verifie ! Vous pouvez maintenant vous connecter.",
      "error": "Lien invalide ou expire."
    },
    "select_tenant": {
      "title": "Selectionner un tenant",
      "subtitle": "Vous avez acces a plusieurs tenants. Choisissez celui auquel vous voulez vous connecter.",
      "tenant_name_column": "Nom du tenant",
      "tenant_role_column": "Votre role",
      "tenant_last_access": "Dernier acces",
      "switch_button": "Acceder",
      "no_tenants": "Aucun tenant disponible. Contactez votre administrateur."
    },
    "logout": {
      "confirm_title": "Confirmer la deconnexion",
      "confirm_message": "Etes-vous sur de vouloir vous deconnecter ?",
      "submit": "Se deconnecter",
      "cancel": "Annuler",
      "success": "Deconnecte avec succes"
    }
  },
  "dashboard": {
    "title": "Tableau de bord",
    "welcome": "Bienvenue {name}",
    "welcome_back": "Bon retour {name}",
    "subtitle": "Vue d'ensemble de votre activite courtier",
    "filters": {
      "date_range_label": "Periode",
      "date_range_last_7d": "7 derniers jours",
      "date_range_last_30d": "30 derniers jours",
      "date_range_last_90d": "90 derniers jours",
      "date_range_ytd": "Depuis le debut d'annee",
      "date_range_custom": "Periode personnalisee",
      "date_start_label": "Date debut",
      "date_end_label": "Date fin",
      "group_by_label": "Grouper par",
      "group_by_day": "Jour",
      "group_by_week": "Semaine",
      "group_by_month": "Mois",
      "branche_label": "Branche",
      "all_branches": "Toutes branches",
      "compare_period": "Comparer avec periode precedente"
    },
    "widget_revenue": {
      "title": "Revenu YTD",
      "subtitle": "Chiffre d'affaires depuis debut d'annee",
      "total_label": "Total",
      "change_vs_prev": "vs periode precedente",
      "chart_title": "Evolution mensuelle",
      "no_data": "Aucun revenu enregistre sur la periode"
    },
    "widget_conversion": {
      "title": "Conversion deals",
      "subtitle": "Funnel lead vers gagne",
      "stage_lead": "Lead",
      "stage_qualified": "Qualifie",
      "stage_proposal": "Proposition",
      "stage_negotiation": "Negociation",
      "stage_won": "Gagne",
      "stage_lost": "Perdu",
      "conversion_rate": "Taux conversion",
      "average_cycle": "Cycle moyen"
    },
    "widget_polices_actives": {
      "title": "Polices actives",
      "subtitle": "Repartition par branche",
      "total_label": "Total polices",
      "branche_auto": "Auto",
      "branche_habitation": "Habitation",
      "branche_sante": "Sante",
      "branche_vie": "Vie",
      "branche_responsabilite": "RC Pro",
      "branche_transport": "Transport",
      "branche_multirisque": "Multirisque"
    },
    "widget_sinistres": {
      "title": "Sinistres en cours",
      "subtitle": "Repartition par statut",
      "status_declared": "Declare",
      "status_acknowledged": "Pris en charge",
      "status_expert_assigned": "Expert assigne",
      "status_in_evaluation": "En evaluation",
      "status_settlement_proposed": "Reglement propose",
      "status_closed": "Clos"
    },
    "widget_deals_open": {
      "title": "Affaires ouvertes",
      "subtitle": "Top 5 prochaines cloturees",
      "total_value_label": "Valeur totale",
      "expected_close": "Cloture prevue",
      "deal_amount": "Montant",
      "deal_owner": "Responsable"
    },
    "widget_activity_feed": {
      "title": "Activite recente",
      "subtitle": "10 dernieres interactions",
      "type_call": "Appel",
      "type_email": "Email",
      "type_whatsapp": "WhatsApp",
      "type_meeting": "Reunion",
      "type_note": "Note",
      "view_full_timeline": "Voir tout le journal"
    },
    "actions": {
      "refresh_all": "Actualiser tous les widgets",
      "customize": "Personnaliser",
      "export_dashboard": "Exporter le tableau de bord"
    }
  },
  "contacts": {
    "title": "Contacts",
    "subtitle": "Gestion des contacts CRM",
    "create_button": "Ajouter un contact",
    "search_placeholder": "Rechercher par nom, email, telephone, CIN",
    "filters": {
      "segment_label": "Segment",
      "segment_individual": "Particulier",
      "segment_pro": "Professionnel",
      "segment_enterprise": "Entreprise",
      "segment_vip": "VIP",
      "tags_label": "Etiquettes",
      "assigned_to_label": "Assigne a",
      "assigned_to_me": "Moi",
      "assigned_to_anyone": "Tous",
      "preferred_channel_label": "Canal prefere",
      "preferred_language_label": "Langue preferee",
      "last_interaction_label": "Derniere interaction"
    },
    "table": {
      "name_column": "Nom",
      "email_column": "Email",
      "phone_column": "Telephone",
      "company_column": "Societe",
      "segment_column": "Segment",
      "tags_column": "Etiquettes",
      "last_interaction_column": "Derniere interaction",
      "owner_column": "Responsable",
      "created_at_column": "Cree le",
      "no_contacts": "Aucun contact",
      "no_contacts_hint": "Commencez par ajouter votre premier contact"
    },
    "form": {
      "title_create": "Ajouter un contact",
      "title_edit": "Modifier le contact",
      "first_name_label": "Prenom",
      "last_name_label": "Nom",
      "email_label": "Email",
      "phone_label": "Telephone",
      "phone_helper": "Format international : +212 6XX XXX XXX",
      "cin_label": "CIN",
      "cin_helper": "Format MA : 1-2 lettres + 5-6 chiffres",
      "cin_error_format": "Format CIN MA invalide",
      "birthdate_label": "Date de naissance",
      "company_label": "Societe",
      "company_placeholder": "Rechercher une societe...",
      "segment_label": "Segment",
      "tags_label": "Etiquettes",
      "tags_placeholder": "Ajouter des etiquettes",
      "preferred_language_label": "Langue preferee",
      "preferred_channel_label": "Canal de communication prefere",
      "channel_email": "Email",
      "channel_phone": "Telephone",
      "channel_whatsapp": "WhatsApp",
      "channel_sms": "SMS",
      "notes_label": "Notes",
      "notes_placeholder": "Notes internes sur le contact",
      "custom_fields_label": "Champs personnalises",
      "consent_marketing": "Consentement marketing (Loi 09-08)",
      "consent_marketing_helper": "Le contact accepte de recevoir des communications marketing",
      "save_button": "Enregistrer",
      "save_and_new_button": "Enregistrer et nouveau",
      "cancel_button": "Annuler"
    },
    "detail": {
      "tabs": {
        "info": "Informations",
        "timeline": "Journal",
        "deals": "Affaires",
        "polices": "Polices",
        "documents": "Documents"
      },
      "actions": {
        "send_message": "Envoyer un message",
        "schedule_appointment": "Planifier un rendez-vous",
        "create_deal": "Creer une affaire",
        "edit": "Modifier",
        "delete": "Supprimer",
        "merge": "Fusionner",
        "anonymize": "Anonymiser (RGPD)"
      },
      "timeline": {
        "title": "Journal des interactions",
        "empty": "Aucune interaction enregistree",
        "load_more": "Charger plus",
        "interaction_call": "Appel telephonique",
        "interaction_email": "Email",
        "interaction_whatsapp": "Message WhatsApp",
        "interaction_meeting": "Reunion",
        "interaction_note": "Note interne",
        "duration_label": "Duree",
        "outcome_label": "Resultat",
        "outcome_positive": "Positif",
        "outcome_neutral": "Neutre",
        "outcome_negative": "Negatif",
        "outcome_no_response": "Sans reponse"
      }
    },
    "bulk_actions": {
      "label": "Actions groupees",
      "tag": "Etiqueter",
      "assign": "Assigner",
      "export": "Exporter CSV",
      "delete": "Supprimer",
      "anonymize": "Anonymiser (RGPD)",
      "selected_count": "{count} contact(s) selectionne(s)"
    },
    "delete_confirm": "Supprimer ce contact ? Cette action est irreversible.",
    "anonymize_confirm": "Anonymiser ce contact ? Les donnees personnelles seront supprimees conformement loi 09-08.",
    "success_created": "Contact cree",
    "success_updated": "Contact mis a jour",
    "success_deleted": "Contact supprime",
    "error_email_taken": "Un contact avec cet email existe deja"
  },
  "companies": {
    "title": "Societes",
    "subtitle": "Gestion des societes clientes",
    "create_button": "Ajouter une societe",
    "search_placeholder": "Rechercher par raison sociale, ICE, ville",
    "filters": {
      "industry_label": "Secteur",
      "city_label": "Ville",
      "size_label": "Taille",
      "size_micro": "Micro (1-9)",
      "size_small": "Petite (10-49)",
      "size_medium": "Moyenne (50-249)",
      "size_large": "Grande (250+)",
      "status_label": "Statut",
      "status_prospect": "Prospect",
      "status_active": "Actif",
      "status_inactive": "Inactif"
    },
    "table": {
      "name_column": "Raison sociale",
      "ice_column": "ICE",
      "industry_column": "Secteur",
      "city_column": "Ville",
      "size_column": "Taille",
      "contacts_count_column": "Contacts",
      "polices_count_column": "Polices",
      "owner_column": "Responsable",
      "no_companies": "Aucune societe"
    },
    "form": {
      "title_create": "Ajouter une societe",
      "title_edit": "Modifier la societe",
      "name_label": "Raison sociale",
      "ice_label": "ICE",
      "ice_helper": "Identifiant Commun de l'Entreprise (15 chiffres)",
      "ice_error_format": "L'ICE doit contenir 15 chiffres",
      "ice_error_checksum": "L'ICE est invalide (checksum)",
      "rc_label": "Registre du Commerce (RC)",
      "ifu_label": "IFU (Identifiant Fiscal)",
      "industry_label": "Secteur d'activite",
      "size_label": "Taille",
      "address_label": "Adresse",
      "city_label": "Ville",
      "region_label": "Region",
      "postal_code_label": "Code postal",
      "phone_label": "Telephone",
      "email_label": "Email",
      "website_label": "Site web",
      "main_contact_label": "Contact principal",
      "billing_address_label": "Adresse de facturation",
      "billing_same_as_main": "Identique a l'adresse principale",
      "notes_label": "Notes"
    },
    "detail": {
      "tabs": {
        "info": "Informations",
        "contacts": "Contacts lies",
        "deals": "Affaires",
        "polices": "Polices",
        "documents": "Documents"
      },
      "contacts_section": {
        "title": "Contacts lies a cette societe",
        "empty": "Aucun contact lie",
        "add_contact": "Ajouter un contact"
      }
    },
    "success_created": "Societe creee",
    "success_updated": "Societe mise a jour"
  },
  "deals": {
    "title": "Affaires",
    "subtitle": "Pipeline commercial",
    "create_button": "Nouvelle affaire",
    "view_kanban": "Vue Kanban",
    "view_table": "Vue Tableau",
    "filters": {
      "stage_label": "Etape",
      "owner_label": "Responsable",
      "date_range_label": "Periode",
      "amount_range_label": "Montant",
      "amount_min": "Montant min",
      "amount_max": "Montant max",
      "branche_label": "Branche assurance"
    },
    "stages": {
      "lead": "Lead",
      "qualified": "Qualifie",
      "proposal": "Proposition",
      "negotiation": "Negociation",
      "won": "Gagne",
      "lost": "Perdu"
    },
    "kanban": {
      "empty_column": "Aucune affaire",
      "drop_here": "Deposer ici",
      "move_reason_title": "Raison du changement",
      "move_reason_placeholder": "Pourquoi ce changement d'etape ?",
      "move_reason_required": "Une raison est requise pour ce changement",
      "stage_changed": "Etape mise a jour",
      "stage_revert": "Changement annule (erreur reseau)"
    },
    "table": {
      "title_column": "Titre",
      "amount_column": "Montant",
      "stage_column": "Etape",
      "owner_column": "Responsable",
      "contact_column": "Contact",
      "company_column": "Societe",
      "expected_close_column": "Cloture prevue",
      "probability_column": "Probabilite",
      "weighted_amount_column": "Montant pondere",
      "created_at_column": "Cree le",
      "no_deals": "Aucune affaire"
    },
    "form": {
      "title_create": "Nouvelle affaire",
      "title_edit": "Modifier l'affaire",
      "title_label": "Titre",
      "title_placeholder": "Ex: Police auto Ahmed Bennani",
      "amount_label": "Montant estime",
      "amount_helper": "Montant en MAD",
      "currency_label": "Devise",
      "stage_label": "Etape",
      "contact_label": "Contact",
      "contact_placeholder": "Rechercher un contact...",
      "company_label": "Societe",
      "branche_label": "Branche assurance",
      "expected_close_date_label": "Date de cloture prevue",
      "probability_label": "Probabilite (%)",
      "notes_label": "Notes",
      "tags_label": "Etiquettes",
      "owner_label": "Responsable"
    },
    "won_lost": {
      "won_title": "Marquer comme gagne",
      "won_message": "Felicitations ! Cette affaire est gagnee.",
      "won_amount_label": "Montant final",
      "won_close_date_label": "Date de signature",
      "won_submit": "Marquer gagne",
      "lost_title": "Marquer comme perdu",
      "lost_message": "Cette affaire est perdue. Indiquez la raison.",
      "lost_reason_label": "Raison de la perte",
      "lost_reason_price": "Prix trop eleve",
      "lost_reason_competitor": "Concurrent",
      "lost_reason_timing": "Mauvais timing",
      "lost_reason_no_decision": "Pas de decision",
      "lost_reason_other": "Autre",
      "lost_reason_details_label": "Details",
      "lost_submit": "Marquer perdu"
    },
    "detail": {
      "tabs": {
        "info": "Informations",
        "timeline": "Historique",
        "interactions": "Interactions",
        "documents": "Documents"
      },
      "stage_history_title": "Historique des etapes",
      "stage_history_empty": "Aucun changement enregistre"
    },
    "success_created": "Affaire creee",
    "success_updated": "Affaire mise a jour",
    "success_stage_moved": "Etape mise a jour",
    "success_won": "Affaire marquee gagnee",
    "success_lost": "Affaire marquee perdue"
  },
  "polices": {
    "title": "Polices",
    "subtitle": "Gestion des polices d'assurance",
    "generate_quote_button": "Generer un devis",
    "filters": {
      "status_label": "Statut",
      "status_active": "Active",
      "status_suspended": "Suspendue",
      "status_expired": "Expiree",
      "status_cancelled": "Annulee",
      "status_pending_renewal": "En renouvellement",
      "branche_label": "Branche",
      "souscripteur_label": "Souscripteur",
      "expiring_soon": "Expirant prochainement (60j)",
      "expired_only": "Expirees seulement",
      "date_range_label": "Periode"
    },
    "table": {
      "policy_number_column": "N police",
      "souscripteur_column": "Souscripteur",
      "branche_column": "Branche",
      "start_date_column": "Date debut",
      "end_date_column": "Date fin",
      "status_column": "Statut",
      "prime_annuelle_column": "Prime annuelle",
      "no_polices": "Aucune police"
    },
    "detail": {
      "title": "Police {number}",
      "tabs": {
        "info": "Informations",
        "premiums": "Primes",
        "avenants": "Avenants",
        "renewals": "Renouvellements",
        "documents": "Documents",
        "operations": "Operations"
      },
      "info": {
        "policy_number_label": "Numero de police",
        "souscripteur_label": "Souscripteur",
        "beneficiaires_label": "Beneficiaires",
        "branche_label": "Branche",
        "produit_label": "Produit",
        "start_date_label": "Date d'effet",
        "end_date_label": "Date d'echeance",
        "duration_label": "Duree",
        "renewal_type_label": "Type de renouvellement",
        "renewal_auto": "Tacite reconduction",
        "renewal_manual": "Manuel",
        "garanties_title": "Garanties souscrites",
        "garantie_capital": "Capital",
        "garantie_franchise": "Franchise",
        "garantie_plafond": "Plafond"
      },
      "premiums": {
        "title": "Echeancier des primes",
        "due_date_column": "Echeance",
        "amount_column": "Montant",
        "status_column": "Statut",
        "status_paid": "Payee",
        "status_pending": "En attente",
        "status_overdue": "En retard",
        "status_cancelled": "Annulee",
        "initiate_payment_button": "Initier paiement",
        "send_reminder_button": "Envoyer rappel",
        "total_paid_label": "Total paye",
        "total_due_label": "Reste du"
      },
      "avenants": {
        "title": "Avenants",
        "new_avenant_button": "Nouvel avenant",
        "avenant_number_column": "N avenant",
        "type_column": "Type",
        "effective_date_column": "Date d'effet",
        "amount_impact_column": "Impact",
        "type_garantie": "Modification garanties",
        "type_franchise": "Modification franchise",
        "type_assure": "Changement assure",
        "type_address": "Changement adresse",
        "type_other": "Autre",
        "no_avenants": "Aucun avenant enregistre"
      },
      "renewals": {
        "title": "Renouvellements",
        "propose_renewal_button": "Proposer renouvellement",
        "current_renewal_status": "Statut renouvellement actuel",
        "status_pending": "En attente",
        "status_proposed": "Propose",
        "status_accepted": "Accepte",
        "status_rejected": "Refuse",
        "new_prime_label": "Nouvelle prime proposee",
        "validity_until_label": "Valable jusqu'au"
      },
      "operations": {
        "title": "Operations",
        "cancel_button": "Annuler la police",
        "suspend_button": "Suspendre",
        "transfer_button": "Transferer",
        "reactivate_button": "Reactiver"
      }
    },
    "cancel_dialog": {
      "title": "Annuler la police",
      "warning": "Cette action est irreversible. Un calcul pro-rata sera effectue.",
      "reason_label": "Raison de l'annulation",
      "reason_no_payment": "Non paiement",
      "reason_customer_request": "Demande client",
      "reason_fraud": "Fraude",
      "reason_other": "Autre",
      "effective_date_label": "Date d'effet",
      "pro_rata_preview_label": "Pro-rata estime",
      "submit": "Confirmer l'annulation"
    },
    "suspend_dialog": {
      "title": "Suspendre la police",
      "start_date_label": "Suspendre du",
      "end_date_label": "Au",
      "reason_label": "Raison",
      "submit": "Suspendre"
    },
    "transfer_dialog": {
      "title": "Transferer la police",
      "new_holder_label": "Nouveau souscripteur",
      "new_holder_placeholder": "Rechercher un contact...",
      "effective_date_label": "Date d'effet du transfert",
      "submit": "Transferer"
    },
    "avenant_dialog": {
      "title": "Nouvel avenant",
      "type_label": "Type d'avenant",
      "effective_date_label": "Date d'effet",
      "description_label": "Description",
      "amount_impact_label": "Impact sur la prime (MAD)",
      "submit": "Creer l'avenant"
    },
    "success_cancelled": "Police annulee",
    "success_suspended": "Police suspendue",
    "success_transferred": "Police transferee",
    "success_avenant_created": "Avenant cree"
  },
  "broker_queue": {
    "title": "File de validation broker",
    "subtitle": "Dossiers en attente de validation courtier",
    "tabs": {
      "mine": "Mes dossiers",
      "all": "Tous",
      "overdue": "En retard"
    },
    "filters": {
      "status_label": "Statut",
      "status_pending": "En attente",
      "status_in_review": "En revue",
      "status_validated": "Valide",
      "status_rejected": "Refuse",
      "status_escalated": "Escalade",
      "source_label": "Source",
      "source_web_portal": "Portail web",
      "source_manual": "Manuel",
      "source_partner": "Partenaire",
      "branche_label": "Branche",
      "priority_label": "Priorite",
      "priority_high": "Haute",
      "priority_medium": "Moyenne",
      "priority_low": "Basse"
    },
    "table": {
      "customer_column": "Client",
      "branche_column": "Branche",
      "amount_column": "Prime estimee",
      "source_column": "Source",
      "sla_column": "SLA",
      "priority_column": "Priorite",
      "assigned_to_column": "Assigne a",
      "created_at_column": "Soumis le",
      "no_dossiers": "Aucun dossier en attente"
    },
    "sla": {
      "remaining_hours": "{hours}h restantes",
      "remaining_minutes": "{minutes}min",
      "overdue": "En retard de {hours}h",
      "due_soon": "Echeance proche"
    },
    "actions": {
      "validate": "Valider",
      "reject": "Refuser",
      "assign_to_me": "M'assigner",
      "escalate": "Escalader",
      "view_details": "Voir details"
    },
    "validate_dialog": {
      "title": "Valider le dossier",
      "message": "Cette action declenchera la souscription definitive et remplacera la police provisoire.",
      "comments_label": "Commentaires (optionnel)",
      "submit": "Valider et souscrire"
    },
    "reject_dialog": {
      "title": "Refuser le dossier",
      "reason_label": "Raison du refus",
      "reason_required": "Une raison est requise",
      "reason_incomplete_docs": "Documents incomplets",
      "reason_invalid_data": "Donnees invalides",
      "reason_high_risk": "Risque trop eleve",
      "reason_compliance": "Non conformite",
      "reason_other": "Autre",
      "details_label": "Details",
      "notify_customer": "Notifier le client",
      "submit": "Refuser"
    },
    "escalate_dialog": {
      "title": "Escalader le dossier",
      "to_label": "Escalader vers",
      "reason_label": "Raison",
      "submit": "Escalader"
    },
    "detail": {
      "customer_section": "Donnees client",
      "documents_section": "Documents fournis",
      "garanties_section": "Garanties demandees",
      "provisional_policy_section": "Police provisoire",
      "history_section": "Historique"
    },
    "success_validated": "Dossier valide",
    "success_rejected": "Dossier refuse",
    "success_assigned": "Dossier assigne",
    "success_escalated": "Dossier escalade"
  },
  "sinistres": {
    "title": "Sinistres",
    "subtitle": "Suivi des sinistres lies a vos polices (lecture seule)",
    "info_banner": "Les sinistres sont traites directement par le garage assigne. Vous pouvez les suivre pour conseil client.",
    "filters": {
      "status_label": "Statut",
      "branche_label": "Branche",
      "date_range_label": "Periode"
    },
    "status": {
      "declared": "Declare",
      "acknowledged": "Pris en charge",
      "expert_assigned": "Expert assigne",
      "expert_visited": "Expertise effectuee",
      "in_evaluation": "En evaluation",
      "settlement_proposed": "Reglement propose",
      "settlement_accepted": "Reglement accepte",
      "paid": "Paye",
      "closed": "Clos",
      "disputed": "Conteste"
    },
    "table": {
      "sinistre_number_column": "N sinistre",
      "police_column": "Police",
      "customer_column": "Client",
      "declaration_date_column": "Date declaration",
      "status_column": "Statut",
      "amount_estimated_column": "Montant estime",
      "garage_column": "Garage",
      "no_sinistres": "Aucun sinistre"
    },
    "detail": {
      "tabs": {
        "info": "Informations",
        "timeline": "Historique",
        "documents": "Documents",
        "expert_report": "Rapport expert",
        "settlement": "Reglement"
      },
      "info": {
        "sinistre_number_label": "Numero",
        "police_label": "Police liee",
        "declaration_date_label": "Date declaration",
        "incident_date_label": "Date incident",
        "incident_location_label": "Lieu",
        "description_label": "Description",
        "garage_label": "Garage assigne",
        "expert_label": "Expert"
      }
    }
  },
  "parametres": {
    "title": "Parametres",
    "subtitle": "Configuration du tenant courtier",
    "admin_only_warning": "Seuls les administrateurs peuvent modifier ces parametres",
    "tabs": {
      "general": "General",
      "branding": "Branding",
      "users": "Utilisateurs",
      "custom_fields": "Champs personnalises",
      "pipelines": "Pipelines",
      "quotas": "Quotas",
      "api_keys": "Cles API"
    },
    "general": {
      "title": "Informations generales",
      "name_label": "Nom du tenant",
      "legal_name_label": "Raison sociale",
      "ice_label": "ICE",
      "rc_label": "RC",
      "contact_email_label": "Email de contact",
      "contact_phone_label": "Telephone de contact",
      "address_label": "Adresse",
      "city_label": "Ville",
      "default_locale_label": "Langue par defaut",
      "currency_label": "Devise par defaut",
      "timezone_label": "Fuseau horaire",
      "acaps_license_label": "Licence ACAPS"
    },
    "branding": {
      "title": "Personnalisation",
      "logo_label": "Logo",
      "logo_upload": "Televerser un logo (PNG/SVG, max 2 Mo)",
      "favicon_label": "Favicon",
      "primary_color_label": "Couleur principale",
      "secondary_color_label": "Couleur secondaire",
      "email_signature_label": "Signature email",
      "preview_label": "Apercu"
    },
    "users": {
      "title": "Utilisateurs du tenant",
      "invite_button": "Inviter un utilisateur",
      "name_column": "Nom",
      "email_column": "Email",
      "role_column": "Role",
      "status_column": "Statut",
      "last_login_column": "Derniere connexion",
      "status_active": "Actif",
      "status_inactive": "Inactif",
      "status_pending": "Invitation en attente",
      "invite_dialog_title": "Inviter un utilisateur",
      "invite_email_label": "Email",
      "invite_role_label": "Role",
      "role_broker_admin": "Administrateur courtier",
      "role_broker_user": "Utilisateur courtier",
      "role_broker_assistant": "Assistant courtier",
      "invite_submit": "Envoyer l'invitation"
    },
    "custom_fields": {
      "title": "Champs personnalises",
      "subtitle": "Definissez des champs supplementaires pour contacts, societes, deals, polices",
      "add_field_button": "Ajouter un champ",
      "name_column": "Nom",
      "type_column": "Type",
      "entity_column": "Entite",
      "required_column": "Obligatoire",
      "field_type_text": "Texte",
      "field_type_number": "Nombre",
      "field_type_date": "Date",
      "field_type_boolean": "Booleen",
      "field_type_select": "Liste",
      "field_type_multiselect": "Liste multiple"
    },
    "pipelines": {
      "title": "Pipelines commerciaux",
      "subtitle": "Configurez les etapes de vos pipelines de deals",
      "add_pipeline_button": "Nouveau pipeline",
      "stage_name_column": "Nom etape",
      "probability_column": "Probabilite (%)"
    },
    "quotas": {
      "title": "Quotas tenant",
      "contacts_label": "Contacts",
      "polices_label": "Polices actives",
      "users_label": "Utilisateurs",
      "storage_label": "Stockage documents (Go)",
      "used_label": "Utilise",
      "limit_label": "Limite",
      "percent_label": "Pourcentage"
    },
    "api_keys": {
      "title": "Cles API",
      "subtitle": "Gerez les acces programmatiques a l'API Skalean",
      "create_button": "Creer une cle",
      "name_column": "Nom",
      "prefix_column": "Prefixe",
      "scopes_column": "Permissions",
      "created_at_column": "Cree le",
      "last_used_column": "Derniere utilisation",
      "revoke_button": "Revoquer"
    }
  },
  "profile": {
    "title": "Mon profil",
    "subtitle": "Gerez vos informations personnelles et la securite",
    "tabs": {
      "info": "Informations",
      "security": "Securite",
      "notifications": "Notifications"
    },
    "info": {
      "title": "Informations personnelles",
      "photo_label": "Photo de profil",
      "photo_upload": "Televerser une photo (JPG/PNG, max 1 Mo)",
      "photo_remove": "Supprimer la photo",
      "display_name_label": "Nom affiche",
      "email_label": "Email",
      "email_helper": "Pour modifier votre email, contactez le support",
      "phone_label": "Telephone",
      "locale_label": "Langue preferee",
      "timezone_label": "Fuseau horaire",
      "preferred_channel_label": "Canal de notification prefere",
      "channel_email": "Email",
      "channel_in_app": "Dans l'application",
      "channel_both": "Les deux"
    },
    "security": {
      "title": "Securite",
      "change_password_section": "Changer mon mot de passe",
      "current_password_label": "Mot de passe actuel",
      "new_password_label": "Nouveau mot de passe",
      "confirm_password_label": "Confirmer le nouveau mot de passe",
      "change_password_submit": "Changer le mot de passe",
      "mfa_section": "Authentification a deux facteurs (MFA)",
      "mfa_status_enabled": "Activee",
      "mfa_status_disabled": "Desactivee",
      "mfa_enable_button": "Activer la MFA",
      "mfa_disable_button": "Desactiver la MFA",
      "mfa_setup_title": "Configuration MFA",
      "mfa_setup_step1": "Scannez ce QR code avec votre application authentificateur",
      "mfa_setup_step2": "Entrez le code a 6 chiffres pour verifier",
      "mfa_setup_verify_button": "Verifier et activer",
      "mfa_recovery_codes_title": "Codes de recuperation",
      "mfa_recovery_codes_message": "Conservez ces codes en lieu sur. Chaque code ne peut etre utilise qu'une fois.",
      "mfa_recovery_codes_download": "Telecharger les codes",
      "sessions_section": "Sessions actives",
      "sessions_device_column": "Appareil",
      "sessions_location_column": "Localisation",
      "sessions_last_activity_column": "Derniere activite",
      "sessions_revoke_button": "Revoquer",
      "sessions_revoke_all_button": "Revoquer toutes les autres",
      "sessions_current_label": "Session actuelle"
    },
    "notifications": {
      "title": "Preferences notifications",
      "email_section": "Notifications par email",
      "in_app_section": "Notifications dans l'application",
      "new_deal_label": "Nouvelle affaire assignee",
      "deal_won_label": "Affaire gagnee",
      "deal_lost_label": "Affaire perdue",
      "police_renewal_label": "Renouvellement police imminent",
      "sinistre_update_label": "Mise a jour sinistre",
      "broker_queue_label": "Nouveau dossier en attente validation",
      "system_label": "Annonces systeme"
    },
    "success_updated": "Profil mis a jour",
    "success_password_changed": "Mot de passe change",
    "success_mfa_enabled": "MFA activee",
    "success_mfa_disabled": "MFA desactivee",
    "success_session_revoked": "Session revoquee"
  },
  "errors": {
    "network": "Erreur reseau. Verifiez votre connexion.",
    "timeout": "Delai d'attente depasse",
    "unauthorized": "Non autorise. Veuillez vous reconnecter.",
    "forbidden": "Acces interdit. Vous n'avez pas les permissions necessaires.",
    "not_found": "Ressource introuvable",
    "not_found_title": "Page introuvable",
    "not_found_message": "La page que vous cherchez n'existe pas ou a ete deplacee.",
    "not_found_back_home": "Retour au tableau de bord",
    "server_error": "Erreur serveur. Reessayez plus tard.",
    "server_error_title": "Erreur serveur",
    "server_error_message": "Une erreur inattendue est survenue. Notre equipe a ete notifiee.",
    "server_error_retry": "Reessayer",
    "validation_error": "Donnees invalides",
    "rate_limit": "Trop de requetes. Patientez avant de reessayer.",
    "session_expired": "Votre session a expire. Reconnectez-vous.",
    "tenant_not_selected": "Aucun tenant selectionne",
    "feature_unavailable": "Fonctionnalite non disponible",
    "permission_denied": "Permission refusee",
    "field_required": "Ce champ est requis",
    "field_email_invalid": "Email invalide",
    "field_phone_invalid": "Telephone invalide",
    "field_too_short": "Trop court (min {min} caracteres)",
    "field_too_long": "Trop long (max {max} caracteres)"
  },
  "locale": {
    "fr": "Francais",
    "ar-MA": "Darija",
    "ar": "Arabe"
  },
  "format": {
    "date_short": "JJ/MM/AAAA",
    "time_24h": "HH:mm",
    "currency_symbol": "DH",
    "currency_position": "after"
  }
}
```

**Notes traduction fr** :
- Toutes les chaines suivent registre commercial professionnel formel (vouvoiement implicite "vous").
- Caracteres accentues UTF-8 conservés tels quels (é, è, à, ç, ù).
- Aucun emoji dans le fichier (linter CI vérifie).
- Placeholders ICU : `{count}`, `{from}`, `{to}`, `{total}`, `{name}` pour interpolation.
- Conventions MA : DH au lieu de MAD, JJ/MM/AAAA au lieu de YYYY-MM-DD, virgule décimale.

---

## 7. Patron code complet : messages/ar-MA.json (Darija)

```json
{
  "meta": {
    "title": "سكاليان بروكر",
    "description": "منصة سمسرة التأمين متعددة المستأجرين بالمغرب",
    "keywords": "تأمين، سمسرة، بروكر، بوالص، حوادث، المغرب",
    "og_title": "سكاليان بروكر -- ERP ديال السماسرة",
    "og_description": "تدبير ديال البوالص والعملاء والصفقات والحوادث"
  },
  "common": {
    "loading": "جاري التحميل...",
    "loading_data": "جاي تحميل المعلومات...",
    "saving": "جاي الحفظ...",
    "submitting": "جاي الإرسال...",
    "deleting": "جاي الحذف...",
    "processing": "جاي المعالجة...",
    "error": "خطأ",
    "error_generic": "وقع خطأ. حاول مرة أخرى.",
    "success": "نجح",
    "save": "حفظ",
    "save_changes": "حفظ التغييرات",
    "cancel": "إلغاء",
    "confirm": "تأكيد",
    "close": "إغلاق",
    "back": "رجوع",
    "next": "التالي",
    "previous": "السابق",
    "search": "بحث",
    "search_placeholder": "قلب على...",
    "filter": "فلترة",
    "filters": "الفلاتر",
    "filter_active": "{count} فلتر نشط",
    "clear_filters": "مسح الفلاتر",
    "sort": "ترتيب",
    "sort_by": "ترتيب حسب",
    "ascending": "تصاعدي",
    "descending": "تنازلي",
    "refresh": "تحديث",
    "export": "تصدير",
    "export_csv": "تصدير CSV",
    "export_excel": "تصدير Excel",
    "export_pdf": "تصدير PDF",
    "import": "استيراد",
    "delete": "حذف",
    "delete_confirm": "واش متأكد بغيتي تحذف هاد العنصر؟",
    "edit": "تعديل",
    "create": "إنشاء",
    "create_new": "إنشاء جديد",
    "add": "زيد",
    "remove": "حيد",
    "view": "شوف",
    "view_details": "شوف التفاصيل",
    "view_all": "شوف الكل",
    "yes": "نعم",
    "no": "لا",
    "all": "الكل",
    "none": "والو",
    "select": "اختر",
    "select_all": "اختر الكل",
    "deselect_all": "حيد الاختيار",
    "actions": "الإجراءات",
    "more_actions": "إجراءات أخرى",
    "options": "الخيارات",
    "settings": "الإعدادات",
    "help": "مساعدة",
    "documentation": "التوثيق",
    "support": "الدعم",
    "feedback": "ملاحظات",
    "language": "اللغة",
    "currency": "العملة",
    "timezone": "المنطقة الزمنية",
    "pagination_showing": "كنوريو {from} حتى {to} من {total}",
    "pagination_page": "الصفحة {page} من {totalPages}",
    "pagination_per_page": "في الصفحة:",
    "no_data": "ما كاينش معلومات",
    "no_results": "ما كاينش نتائج",
    "empty_state": "ما كاين والو",
    "not_found": "ما تلقاش",
    "required": "إجباري",
    "optional": "اختياري",
    "copy": "نسخ",
    "copied": "تنسخ",
    "share": "مشاركة",
    "download": "تحميل",
    "upload": "رفع",
    "drag_drop": "كبكب أو دير كليك",
    "file_too_large": "الملف كبير بزاف (الحد الأقصى {maxSize})",
    "file_invalid_type": "نوع الملف ماشي مسموح",
    "date_format_hint": "الشكل: ي ي / ش ش / س س س س",
    "currency_format_hint": "الشكل: 1 234,56 درهم"
  },
  "nav": {
    "dashboard": "لوحة التحكم",
    "contacts": "العملاء",
    "companies": "الشركات",
    "deals": "الصفقات",
    "polices": "البوالص",
    "broker_queue": "قائمة المصادقة",
    "sinistres": "الحوادث",
    "parametres": "الإعدادات",
    "profile": "الملف الشخصي",
    "logout": "خروج",
    "main_navigation": "التنقل الرئيسي",
    "skip_to_content": "اقفز للمحتوى"
  },
  "auth": {
    "login": {
      "title": "دخول سكاليان بروكر",
      "subtitle": "ولوج لفضائك ديال السمسار",
      "email_label": "البريد الإلكتروني",
      "email_placeholder": "email@example.com",
      "password_label": "كلمة السر",
      "password_placeholder": "كلمة السر",
      "show_password": "بين كلمة السر",
      "hide_password": "خبي كلمة السر",
      "remember_me": "تذكرني",
      "submit": "دخول",
      "submitting": "جاي الدخول...",
      "forgot_password": "نسيتي كلمة السر؟",
      "no_account": "ما عندكش كونط؟",
      "signup_link": "دير كونط جديد",
      "error_invalid_credentials": "الإيمايل أو كلمة السر غالطين",
      "error_account_locked": "الحساب مسدود. اتصل بالمدير.",
      "error_account_disabled": "الحساب موقف.",
      "error_email_not_verified": "الإيمايل ما تحققش. شوف الميساج ديالك.",
      "error_too_many_attempts": "محاولات بزاف. عاود من بعد {minutes} دقيقة.",
      "success": "دخلتي بنجاح",
      "redirecting": "جاي التوجيه..."
    },
    "mfa": {
      "title": "التحقق بعاملين",
      "subtitle": "دخل الكود ديال 6 أرقام من التطبيق ديالك",
      "code_label": "كود التحقق",
      "code_placeholder": "000000",
      "submit": "تحقق",
      "submitting": "جاي التحقق...",
      "resend_code": "عاود الكود",
      "use_recovery_code": "استعمل كود استرجاع",
      "recovery_code_label": "كود الاسترجاع",
      "recovery_code_placeholder": "XXXX-XXXX-XXXX",
      "error_invalid_code": "الكود غالط",
      "error_code_expired": "الكود انتها صلاحيته",
      "error_too_many_attempts": "محاولات بزاف. عاود الدخول.",
      "success": "تم التحقق بنجاح"
    },
    "signup": {
      "title": "دير حساب سكاليان بروكر",
      "subtitle": "انضم لمنصة السمسرة بالمغرب",
      "first_name_label": "الاسم",
      "last_name_label": "النسب",
      "display_name_label": "اسم العرض",
      "email_label": "إيمايل مهني",
      "phone_label": "التيليفون",
      "phone_placeholder": "+212 6XX XXX XXX",
      "password_label": "كلمة السر",
      "password_strength_label": "قوة كلمة السر",
      "password_strength_weak": "ضعيفة",
      "password_strength_medium": "متوسطة",
      "password_strength_strong": "قوية",
      "password_strength_very_strong": "قوية بزاف",
      "password_requirements_title": "متطلبات كلمة السر",
      "password_req_length": "على الأقل 12 حرف",
      "password_req_uppercase": "حرف كبير",
      "password_req_lowercase": "حرف صغير",
      "password_req_number": "رقم",
      "password_req_special": "رمز خاص",
      "confirm_password_label": "أكد كلمة السر",
      "locale_label": "اللغة المفضلة",
      "tenant_invitation_label": "كود دعوة",
      "terms_accept": "كنقبل الشروط العامة",
      "terms_link": "قرا الشروط",
      "privacy_accept": "كنقبل سياسة الخصوصية (قانون 09-08)",
      "privacy_link": "قرا السياسة",
      "submit": "دير الحساب",
      "submitting": "جاي الإنشاء...",
      "have_account": "عندك حساب؟",
      "login_link": "ادخل",
      "error_email_taken": "هاد الإيمايل مستعمل",
      "error_invalid_invitation": "كود الدعوة غالط",
      "error_weak_password": "كلمة السر ضعيفة",
      "error_passwords_dont_match": "كلمات السر ما متطابقاتش",
      "success_email_sent": "الحساب تدار. شوف الإيمايل باش تفعل."
    },
    "forgot": {
      "title": "نسيت كلمة السر",
      "subtitle": "دخل الإيمايل ديالك باش نصيفطو لك رابط",
      "email_label": "الإيمايل",
      "submit": "صيفط الرابط",
      "submitting": "جاي الإرسال...",
      "back_to_login": "رجوع للدخول",
      "success": "الإيمايل تصيفط. شوف صندوقك."
    },
    "reset": {
      "title": "تجديد كلمة السر",
      "subtitle": "اختر كلمة سر جديدة",
      "new_password_label": "كلمة السر الجديدة",
      "confirm_password_label": "أكد",
      "submit": "جدد",
      "error_invalid_token": "الرابط غالط أو انتها",
      "success": "كلمة السر تجددت. ادخل."
    },
    "verify_email": {
      "title": "تحقق الإيمايل",
      "verifying": "جاي التحقق...",
      "success": "الإيمايل تحقق! يمكن لك تدخل دابا.",
      "error": "الرابط غالط أو انتها."
    },
    "select_tenant": {
      "title": "اختر تينانت",
      "subtitle": "عندك ولوج لبزاف ديال التينانتس. اختر واحد.",
      "tenant_name_column": "اسم التينانت",
      "tenant_role_column": "الدور ديالك",
      "tenant_last_access": "آخر دخول",
      "switch_button": "دخول",
      "no_tenants": "ما كاينش تينانتس متاحين. اتصل بالمدير."
    },
    "logout": {
      "confirm_title": "تأكيد الخروج",
      "confirm_message": "واش متأكد بغيتي تخرج؟",
      "submit": "خروج",
      "cancel": "إلغاء",
      "success": "خرجتي بنجاح"
    }
  },
  "dashboard": {
    "title": "لوحة التحكم",
    "welcome": "مرحبا {name}",
    "welcome_back": "مرحبا بيك مرة أخرى {name}",
    "subtitle": "نظرة عامة على النشاط ديالك",
    "filters": {
      "date_range_label": "الفترة",
      "date_range_last_7d": "آخر 7 أيام",
      "date_range_last_30d": "آخر 30 يوم",
      "date_range_last_90d": "آخر 90 يوم",
      "date_range_ytd": "من بداية السنة",
      "date_range_custom": "فترة مخصصة",
      "date_start_label": "تاريخ البداية",
      "date_end_label": "تاريخ النهاية",
      "group_by_label": "تجميع حسب",
      "group_by_day": "اليوم",
      "group_by_week": "الأسبوع",
      "group_by_month": "الشهر",
      "branche_label": "الفرع",
      "all_branches": "كل الفروع",
      "compare_period": "قارن مع الفترة السابقة"
    },
    "widget_revenue": {
      "title": "ديال الدخل ديال السنة",
      "subtitle": "رقم المعاملات من بداية السنة",
      "total_label": "المجموع",
      "change_vs_prev": "مقارنة بالفترة السابقة",
      "chart_title": "التطور الشهري",
      "no_data": "ما كاين حتى دخل في هاد الفترة"
    },
    "widget_conversion": {
      "title": "تحويل الصفقات",
      "subtitle": "من اللييد للربح",
      "stage_lead": "لييد",
      "stage_qualified": "مؤهل",
      "stage_proposal": "اقتراح",
      "stage_negotiation": "تفاوض",
      "stage_won": "ربح",
      "stage_lost": "خسارة",
      "conversion_rate": "نسبة التحويل",
      "average_cycle": "متوسط الدورة"
    },
    "widget_polices_actives": {
      "title": "البوالص النشطة",
      "subtitle": "التوزيع حسب الفرع",
      "total_label": "مجموع البوالص",
      "branche_auto": "السيارات",
      "branche_habitation": "السكن",
      "branche_sante": "الصحة",
      "branche_vie": "الحياة",
      "branche_responsabilite": "المسؤولية المهنية",
      "branche_transport": "النقل",
      "branche_multirisque": "المتعدد المخاطر"
    },
    "widget_sinistres": {
      "title": "الحوادث الجارية",
      "subtitle": "التوزيع حسب الحالة",
      "status_declared": "مصرح",
      "status_acknowledged": "تحت المعالجة",
      "status_expert_assigned": "خبير معين",
      "status_in_evaluation": "في التقييم",
      "status_settlement_proposed": "تسوية مقترحة",
      "status_closed": "مغلق"
    },
    "widget_deals_open": {
      "title": "الصفقات المفتوحة",
      "subtitle": "أهم 5 صفقات قريبة",
      "total_value_label": "القيمة الإجمالية",
      "expected_close": "الإغلاق المتوقع",
      "deal_amount": "المبلغ",
      "deal_owner": "المسؤول"
    },
    "widget_activity_feed": {
      "title": "النشاط الأخير",
      "subtitle": "آخر 10 تفاعلات",
      "type_call": "مكالمة",
      "type_email": "إيمايل",
      "type_whatsapp": "واتساب",
      "type_meeting": "اجتماع",
      "type_note": "ملاحظة",
      "view_full_timeline": "شوف كل التاريخ"
    },
    "actions": {
      "refresh_all": "تحديث كل العناصر",
      "customize": "تخصيص",
      "export_dashboard": "تصدير اللوحة"
    }
  },
  "contacts": {
    "title": "العملاء",
    "subtitle": "تدبير العملاء CRM",
    "create_button": "زيد عميل جديد",
    "search_placeholder": "قلب بالاسم، الإيمايل، التيليفون، CIN",
    "filters": {
      "segment_label": "القطاع",
      "segment_individual": "خاص",
      "segment_pro": "مهني",
      "segment_enterprise": "مقاولة",
      "segment_vip": "VIP",
      "tags_label": "العلامات",
      "assigned_to_label": "معين لـ",
      "assigned_to_me": "أنا",
      "assigned_to_anyone": "الكل",
      "preferred_channel_label": "القناة المفضلة",
      "preferred_language_label": "اللغة المفضلة",
      "last_interaction_label": "آخر تفاعل"
    },
    "table": {
      "name_column": "الاسم",
      "email_column": "الإيمايل",
      "phone_column": "التيليفون",
      "company_column": "الشركة",
      "segment_column": "القطاع",
      "tags_column": "العلامات",
      "last_interaction_column": "آخر تفاعل",
      "owner_column": "المسؤول",
      "created_at_column": "تاريخ الإنشاء",
      "no_contacts": "ما كاين حتى عميل",
      "no_contacts_hint": "بدا بزيادة أول عميل"
    },
    "form": {
      "title_create": "زيد عميل",
      "title_edit": "عدل العميل",
      "first_name_label": "الاسم",
      "last_name_label": "النسب",
      "email_label": "الإيمايل",
      "phone_label": "التيليفون",
      "phone_helper": "الشكل الدولي: +212 6XX XXX XXX",
      "cin_label": "CIN",
      "cin_helper": "الشكل المغربي: حرف أو حرفين + 5 أو 6 أرقام",
      "cin_error_format": "شكل CIN غالط",
      "birthdate_label": "تاريخ الازدياد",
      "company_label": "الشركة",
      "company_placeholder": "قلب على شركة...",
      "segment_label": "القطاع",
      "tags_label": "العلامات",
      "tags_placeholder": "زيد علامات",
      "preferred_language_label": "اللغة المفضلة",
      "preferred_channel_label": "القناة المفضلة للتواصل",
      "channel_email": "إيمايل",
      "channel_phone": "تيليفون",
      "channel_whatsapp": "واتساب",
      "channel_sms": "SMS",
      "notes_label": "ملاحظات",
      "notes_placeholder": "ملاحظات داخلية على العميل",
      "custom_fields_label": "حقول مخصصة",
      "consent_marketing": "موافقة على التسويق (قانون 09-08)",
      "consent_marketing_helper": "العميل وافق على استقبال رسائل تسويقية",
      "save_button": "حفظ",
      "save_and_new_button": "حفظ وزيد جديد",
      "cancel_button": "إلغاء"
    },
    "detail": {
      "tabs": {
        "info": "المعلومات",
        "timeline": "السجل",
        "deals": "الصفقات",
        "polices": "البوالص",
        "documents": "الوثائق"
      },
      "actions": {
        "send_message": "صيفط رسالة",
        "schedule_appointment": "حدد موعد",
        "create_deal": "دير صفقة",
        "edit": "عدل",
        "delete": "حذف",
        "merge": "دمج",
        "anonymize": "إخفاء الهوية (RGPD)"
      },
      "timeline": {
        "title": "سجل التفاعلات",
        "empty": "ما كاين حتى تفاعل",
        "load_more": "حمل المزيد",
        "interaction_call": "مكالمة",
        "interaction_email": "إيمايل",
        "interaction_whatsapp": "واتساب",
        "interaction_meeting": "اجتماع",
        "interaction_note": "ملاحظة",
        "duration_label": "المدة",
        "outcome_label": "النتيجة",
        "outcome_positive": "إيجابية",
        "outcome_neutral": "محايدة",
        "outcome_negative": "سلبية",
        "outcome_no_response": "بلا جواب"
      }
    },
    "bulk_actions": {
      "label": "إجراءات جماعية",
      "tag": "علم",
      "assign": "عين",
      "export": "تصدير CSV",
      "delete": "حذف",
      "anonymize": "إخفاء الهوية",
      "selected_count": "{count} عميل مختار"
    },
    "delete_confirm": "تحذف هاد العميل؟ ما يمكنش الرجوع.",
    "anonymize_confirm": "تخفي الهوية ديال هاد العميل؟",
    "success_created": "العميل تدار",
    "success_updated": "العميل تحدث",
    "success_deleted": "العميل تحذف",
    "error_email_taken": "كاين عميل بهاد الإيمايل"
  },
  "companies": {
    "title": "الشركات",
    "subtitle": "تدبير الشركات العميلة",
    "create_button": "زيد شركة",
    "search_placeholder": "قلب بالاسم، ICE، المدينة",
    "filters": {
      "industry_label": "القطاع",
      "city_label": "المدينة",
      "size_label": "الحجم",
      "size_micro": "صغير جدا (1-9)",
      "size_small": "صغير (10-49)",
      "size_medium": "متوسط (50-249)",
      "size_large": "كبير (250+)",
      "status_label": "الحالة",
      "status_prospect": "محتمل",
      "status_active": "نشط",
      "status_inactive": "غير نشط"
    },
    "table": {
      "name_column": "الاسم التجاري",
      "ice_column": "ICE",
      "industry_column": "القطاع",
      "city_column": "المدينة",
      "size_column": "الحجم",
      "contacts_count_column": "العملاء",
      "polices_count_column": "البوالص",
      "owner_column": "المسؤول",
      "no_companies": "ما كاين حتى شركة"
    },
    "form": {
      "title_create": "زيد شركة",
      "title_edit": "عدل الشركة",
      "name_label": "الاسم التجاري",
      "ice_label": "ICE",
      "ice_helper": "المعرف المشترك للمقاولة (15 رقم)",
      "ice_error_format": "ICE خصو يكون فيه 15 رقم",
      "ice_error_checksum": "ICE غالط",
      "rc_label": "السجل التجاري (RC)",
      "ifu_label": "IFU (المعرف الجبائي)",
      "industry_label": "قطاع النشاط",
      "size_label": "الحجم",
      "address_label": "العنوان",
      "city_label": "المدينة",
      "region_label": "الجهة",
      "postal_code_label": "الرمز البريدي",
      "phone_label": "التيليفون",
      "email_label": "الإيمايل",
      "website_label": "الموقع",
      "main_contact_label": "العميل الرئيسي",
      "billing_address_label": "عنوان الفاتورة",
      "billing_same_as_main": "نفس العنوان الرئيسي",
      "notes_label": "ملاحظات"
    },
    "detail": {
      "tabs": {
        "info": "المعلومات",
        "contacts": "العملاء المرتبطين",
        "deals": "الصفقات",
        "polices": "البوالص",
        "documents": "الوثائق"
      },
      "contacts_section": {
        "title": "العملاء المرتبطين بالشركة",
        "empty": "ما كاين حتى عميل",
        "add_contact": "زيد عميل"
      }
    },
    "success_created": "الشركة تدارت",
    "success_updated": "الشركة تحدثت"
  },
  "deals": {
    "title": "الصفقات",
    "subtitle": "خط الأنابيب التجاري",
    "create_button": "صفقة جديدة",
    "view_kanban": "عرض كانبان",
    "view_table": "عرض جدول",
    "filters": {
      "stage_label": "المرحلة",
      "owner_label": "المسؤول",
      "date_range_label": "الفترة",
      "amount_range_label": "المبلغ",
      "amount_min": "الحد الأدنى",
      "amount_max": "الحد الأقصى",
      "branche_label": "فرع التأمين"
    },
    "stages": {
      "lead": "لييد",
      "qualified": "مؤهل",
      "proposal": "اقتراح",
      "negotiation": "تفاوض",
      "won": "ربح",
      "lost": "خسارة"
    },
    "kanban": {
      "empty_column": "ما كاين حتى صفقة",
      "drop_here": "حط هنا",
      "move_reason_title": "سبب التغيير",
      "move_reason_placeholder": "علاش هاد التغيير؟",
      "move_reason_required": "السبب مطلوب",
      "stage_changed": "المرحلة تحدثت",
      "stage_revert": "التغيير تلغى (خطأ شبكة)"
    },
    "table": {
      "title_column": "العنوان",
      "amount_column": "المبلغ",
      "stage_column": "المرحلة",
      "owner_column": "المسؤول",
      "contact_column": "العميل",
      "company_column": "الشركة",
      "expected_close_column": "الإغلاق المتوقع",
      "probability_column": "الاحتمال",
      "weighted_amount_column": "المبلغ المرجح",
      "created_at_column": "تاريخ الإنشاء",
      "no_deals": "ما كاين حتى صفقة"
    },
    "form": {
      "title_create": "صفقة جديدة",
      "title_edit": "عدل الصفقة",
      "title_label": "العنوان",
      "title_placeholder": "مثال: بوليصة سيارة أحمد",
      "amount_label": "المبلغ المقدر",
      "amount_helper": "بالدرهم",
      "currency_label": "العملة",
      "stage_label": "المرحلة",
      "contact_label": "العميل",
      "contact_placeholder": "قلب على عميل...",
      "company_label": "الشركة",
      "branche_label": "فرع التأمين",
      "expected_close_date_label": "تاريخ الإغلاق المتوقع",
      "probability_label": "الاحتمال (%)",
      "notes_label": "ملاحظات",
      "tags_label": "العلامات",
      "owner_label": "المسؤول"
    },
    "won_lost": {
      "won_title": "علم كرابح",
      "won_message": "مبروك! الصفقة ربحت.",
      "won_amount_label": "المبلغ النهائي",
      "won_close_date_label": "تاريخ التوقيع",
      "won_submit": "علم كرابح",
      "lost_title": "علم كخاسر",
      "lost_message": "الصفقة خسرت. علل السبب.",
      "lost_reason_label": "سبب الخسارة",
      "lost_reason_price": "الثمن غالي بزاف",
      "lost_reason_competitor": "منافس",
      "lost_reason_timing": "توقيت غالط",
      "lost_reason_no_decision": "بلا قرار",
      "lost_reason_other": "آخر",
      "lost_reason_details_label": "التفاصيل",
      "lost_submit": "علم كخاسر"
    },
    "detail": {
      "tabs": {
        "info": "المعلومات",
        "timeline": "التاريخ",
        "interactions": "التفاعلات",
        "documents": "الوثائق"
      },
      "stage_history_title": "تاريخ المراحل",
      "stage_history_empty": "ما كاين حتى تغيير"
    },
    "success_created": "الصفقة تدارت",
    "success_updated": "الصفقة تحدثت",
    "success_stage_moved": "المرحلة تحدثت",
    "success_won": "الصفقة معلمة كرابحة",
    "success_lost": "الصفقة معلمة كخاسرة"
  },
  "polices": {
    "title": "البوالص",
    "subtitle": "تدبير بوالص التأمين",
    "generate_quote_button": "دير عرض ثمن",
    "filters": {
      "status_label": "الحالة",
      "status_active": "نشطة",
      "status_suspended": "موقفة",
      "status_expired": "منتهية",
      "status_cancelled": "ملغية",
      "status_pending_renewal": "في التجديد",
      "branche_label": "الفرع",
      "souscripteur_label": "المكتتب",
      "expiring_soon": "تنتهي قريبا (60 يوم)",
      "expired_only": "المنتهية فقط",
      "date_range_label": "الفترة"
    },
    "table": {
      "policy_number_column": "رقم البوليصة",
      "souscripteur_column": "المكتتب",
      "branche_column": "الفرع",
      "start_date_column": "تاريخ البداية",
      "end_date_column": "تاريخ النهاية",
      "status_column": "الحالة",
      "prime_annuelle_column": "القسط السنوي",
      "no_polices": "ما كاين حتى بوليصة"
    },
    "detail": {
      "title": "البوليصة {number}",
      "tabs": {
        "info": "المعلومات",
        "premiums": "الأقساط",
        "avenants": "الملحقات",
        "renewals": "التجديدات",
        "documents": "الوثائق",
        "operations": "العمليات"
      },
      "info": {
        "policy_number_label": "رقم البوليصة",
        "souscripteur_label": "المكتتب",
        "beneficiaires_label": "المستفيدون",
        "branche_label": "الفرع",
        "produit_label": "المنتج",
        "start_date_label": "تاريخ السريان",
        "end_date_label": "تاريخ الانتهاء",
        "duration_label": "المدة",
        "renewal_type_label": "نوع التجديد",
        "renewal_auto": "تجديد ضمني",
        "renewal_manual": "يدوي",
        "garanties_title": "الضمانات المكتتبة",
        "garantie_capital": "رأس المال",
        "garantie_franchise": "الإعفاء",
        "garantie_plafond": "السقف"
      },
      "premiums": {
        "title": "جدول الأقساط",
        "due_date_column": "تاريخ الاستحقاق",
        "amount_column": "المبلغ",
        "status_column": "الحالة",
        "status_paid": "مؤدى",
        "status_pending": "في الانتظار",
        "status_overdue": "متأخر",
        "status_cancelled": "ملغى",
        "initiate_payment_button": "بدأ الأداء",
        "send_reminder_button": "صيفط تذكير",
        "total_paid_label": "المجموع المؤدى",
        "total_due_label": "الباقي"
      },
      "avenants": {
        "title": "الملحقات",
        "new_avenant_button": "ملحق جديد",
        "avenant_number_column": "رقم الملحق",
        "type_column": "النوع",
        "effective_date_column": "تاريخ السريان",
        "amount_impact_column": "التأثير",
        "type_garantie": "تعديل الضمانات",
        "type_franchise": "تعديل الإعفاء",
        "type_assure": "تغيير المؤمن",
        "type_address": "تغيير العنوان",
        "type_other": "آخر",
        "no_avenants": "ما كاين حتى ملحق"
      },
      "renewals": {
        "title": "التجديدات",
        "propose_renewal_button": "اقترح تجديد",
        "current_renewal_status": "حالة التجديد الحالية",
        "status_pending": "في الانتظار",
        "status_proposed": "مقترح",
        "status_accepted": "مقبول",
        "status_rejected": "مرفوض",
        "new_prime_label": "القسط الجديد المقترح",
        "validity_until_label": "صالح حتى"
      },
      "operations": {
        "title": "العمليات",
        "cancel_button": "إلغاء البوليصة",
        "suspend_button": "إيقاف",
        "transfer_button": "نقل",
        "reactivate_button": "إعادة التفعيل"
      }
    },
    "cancel_dialog": {
      "title": "إلغاء البوليصة",
      "warning": "ما يمكنش الرجوع. غادي يدار حساب نسبي.",
      "reason_label": "سبب الإلغاء",
      "reason_no_payment": "عدم الأداء",
      "reason_customer_request": "طلب العميل",
      "reason_fraud": "احتيال",
      "reason_other": "آخر",
      "effective_date_label": "تاريخ السريان",
      "pro_rata_preview_label": "التقدير النسبي",
      "submit": "أكد الإلغاء"
    },
    "suspend_dialog": {
      "title": "إيقاف البوليصة",
      "start_date_label": "إيقاف من",
      "end_date_label": "إلى",
      "reason_label": "السبب",
      "submit": "إيقاف"
    },
    "transfer_dialog": {
      "title": "نقل البوليصة",
      "new_holder_label": "المكتتب الجديد",
      "new_holder_placeholder": "قلب على عميل...",
      "effective_date_label": "تاريخ سريان النقل",
      "submit": "نقل"
    },
    "avenant_dialog": {
      "title": "ملحق جديد",
      "type_label": "نوع الملحق",
      "effective_date_label": "تاريخ السريان",
      "description_label": "الوصف",
      "amount_impact_label": "التأثير على القسط (درهم)",
      "submit": "دير الملحق"
    },
    "success_cancelled": "البوليصة تلغت",
    "success_suspended": "البوليصة توقفت",
    "success_transferred": "البوليصة تنقلت",
    "success_avenant_created": "الملحق تدار"
  },
  "broker_queue": {
    "title": "قائمة مصادقة السمسار",
    "subtitle": "الملفات في انتظار مصادقة السمسار",
    "tabs": {
      "mine": "ملفاتي",
      "all": "الكل",
      "overdue": "متأخرة"
    },
    "filters": {
      "status_label": "الحالة",
      "status_pending": "في الانتظار",
      "status_in_review": "في المراجعة",
      "status_validated": "مصادق",
      "status_rejected": "مرفوض",
      "status_escalated": "متصاعد",
      "source_label": "المصدر",
      "source_web_portal": "بوابة ويب",
      "source_manual": "يدوي",
      "source_partner": "شريك",
      "branche_label": "الفرع",
      "priority_label": "الأولوية",
      "priority_high": "عالية",
      "priority_medium": "متوسطة",
      "priority_low": "منخفضة"
    },
    "table": {
      "customer_column": "العميل",
      "branche_column": "الفرع",
      "amount_column": "القسط المقدر",
      "source_column": "المصدر",
      "sla_column": "SLA",
      "priority_column": "الأولوية",
      "assigned_to_column": "معين لـ",
      "created_at_column": "تاريخ الإيداع",
      "no_dossiers": "ما كاين حتى ملف"
    },
    "sla": {
      "remaining_hours": "باقي {hours} ساعة",
      "remaining_minutes": "{minutes} دقيقة",
      "overdue": "متأخر بـ {hours} ساعة",
      "due_soon": "الاستحقاق قريب"
    },
    "actions": {
      "validate": "صادق",
      "reject": "ارفض",
      "assign_to_me": "عين لي",
      "escalate": "صعد",
      "view_details": "شوف التفاصيل"
    },
    "validate_dialog": {
      "title": "صادق على الملف",
      "message": "هاد العملية غادي تطلق الاكتتاب النهائي.",
      "comments_label": "ملاحظات (اختياري)",
      "submit": "صادق واكتب"
    },
    "reject_dialog": {
      "title": "ارفض الملف",
      "reason_label": "سبب الرفض",
      "reason_required": "السبب مطلوب",
      "reason_incomplete_docs": "وثائق ناقصة",
      "reason_invalid_data": "بيانات غالطة",
      "reason_high_risk": "خطر عالي",
      "reason_compliance": "عدم امتثال",
      "reason_other": "آخر",
      "details_label": "التفاصيل",
      "notify_customer": "خبر العميل",
      "submit": "ارفض"
    },
    "escalate_dialog": {
      "title": "صعد الملف",
      "to_label": "صعد لـ",
      "reason_label": "السبب",
      "submit": "صعد"
    },
    "detail": {
      "customer_section": "بيانات العميل",
      "documents_section": "الوثائق المقدمة",
      "garanties_section": "الضمانات المطلوبة",
      "provisional_policy_section": "البوليصة المؤقتة",
      "history_section": "التاريخ"
    },
    "success_validated": "الملف مصادق",
    "success_rejected": "الملف مرفوض",
    "success_assigned": "الملف معين",
    "success_escalated": "الملف متصاعد"
  },
  "sinistres": {
    "title": "الحوادث",
    "subtitle": "متابعة الحوادث المرتبطة ببوالصك (قراءة فقط)",
    "info_banner": "الحوادث كتعالج مباشرة من طرف الكاراج. يمكن لك تتبعها لنصيحة العميل.",
    "filters": {
      "status_label": "الحالة",
      "branche_label": "الفرع",
      "date_range_label": "الفترة"
    },
    "status": {
      "declared": "مصرح",
      "acknowledged": "تحت المعالجة",
      "expert_assigned": "خبير معين",
      "expert_visited": "الخبرة دارت",
      "in_evaluation": "في التقييم",
      "settlement_proposed": "تسوية مقترحة",
      "settlement_accepted": "تسوية مقبولة",
      "paid": "مؤدى",
      "closed": "مغلق",
      "disputed": "متنازع عليه"
    },
    "table": {
      "sinistre_number_column": "رقم الحادث",
      "police_column": "البوليصة",
      "customer_column": "العميل",
      "declaration_date_column": "تاريخ التصريح",
      "status_column": "الحالة",
      "amount_estimated_column": "المبلغ المقدر",
      "garage_column": "الكاراج",
      "no_sinistres": "ما كاين حتى حادث"
    },
    "detail": {
      "tabs": {
        "info": "المعلومات",
        "timeline": "التاريخ",
        "documents": "الوثائق",
        "expert_report": "تقرير الخبير",
        "settlement": "التسوية"
      },
      "info": {
        "sinistre_number_label": "الرقم",
        "police_label": "البوليصة المرتبطة",
        "declaration_date_label": "تاريخ التصريح",
        "incident_date_label": "تاريخ الحادث",
        "incident_location_label": "المكان",
        "description_label": "الوصف",
        "garage_label": "الكاراج المعين",
        "expert_label": "الخبير"
      }
    }
  },
  "parametres": {
    "title": "الإعدادات",
    "subtitle": "إعدادات تينانت السمسار",
    "admin_only_warning": "غير المديرين يقدرو يعدلو هاد الإعدادات",
    "tabs": {
      "general": "عام",
      "branding": "العلامة التجارية",
      "users": "المستخدمين",
      "custom_fields": "حقول مخصصة",
      "pipelines": "خطوط الأنابيب",
      "quotas": "الحصص",
      "api_keys": "مفاتيح API"
    },
    "general": {
      "title": "المعلومات العامة",
      "name_label": "اسم التينانت",
      "legal_name_label": "الاسم التجاري",
      "ice_label": "ICE",
      "rc_label": "RC",
      "contact_email_label": "إيمايل الاتصال",
      "contact_phone_label": "تيليفون الاتصال",
      "address_label": "العنوان",
      "city_label": "المدينة",
      "default_locale_label": "اللغة الافتراضية",
      "currency_label": "العملة الافتراضية",
      "timezone_label": "المنطقة الزمنية",
      "acaps_license_label": "رخصة ACAPS"
    },
    "branding": {
      "title": "التخصيص",
      "logo_label": "الشعار",
      "logo_upload": "رفع شعار (PNG/SVG، الحد الأقصى 2 ميغا)",
      "favicon_label": "أيقونة الموقع",
      "primary_color_label": "اللون الرئيسي",
      "secondary_color_label": "اللون الثانوي",
      "email_signature_label": "توقيع الإيمايل",
      "preview_label": "معاينة"
    },
    "users": {
      "title": "مستخدمي التينانت",
      "invite_button": "دعو مستخدم",
      "name_column": "الاسم",
      "email_column": "الإيمايل",
      "role_column": "الدور",
      "status_column": "الحالة",
      "last_login_column": "آخر دخول",
      "status_active": "نشط",
      "status_inactive": "غير نشط",
      "status_pending": "دعوة في الانتظار",
      "invite_dialog_title": "دعو مستخدم",
      "invite_email_label": "الإيمايل",
      "invite_role_label": "الدور",
      "role_broker_admin": "مدير سمسار",
      "role_broker_user": "مستخدم سمسار",
      "role_broker_assistant": "مساعد سمسار",
      "invite_submit": "صيفط الدعوة"
    },
    "custom_fields": {
      "title": "حقول مخصصة",
      "subtitle": "دير حقول إضافية للعملاء، الشركات، الصفقات، البوالص",
      "add_field_button": "زيد حقل",
      "name_column": "الاسم",
      "type_column": "النوع",
      "entity_column": "الكيان",
      "required_column": "إجباري",
      "field_type_text": "نص",
      "field_type_number": "رقم",
      "field_type_date": "تاريخ",
      "field_type_boolean": "منطقي",
      "field_type_select": "قائمة",
      "field_type_multiselect": "قائمة متعددة"
    },
    "pipelines": {
      "title": "خطوط الأنابيب التجارية",
      "subtitle": "دير مراحل خطوط الصفقات",
      "add_pipeline_button": "خط جديد",
      "stage_name_column": "اسم المرحلة",
      "probability_column": "الاحتمال (%)"
    },
    "quotas": {
      "title": "حصص التينانت",
      "contacts_label": "العملاء",
      "polices_label": "البوالص النشطة",
      "users_label": "المستخدمين",
      "storage_label": "تخزين الوثائق (غيغا)",
      "used_label": "المستعمل",
      "limit_label": "الحد",
      "percent_label": "النسبة"
    },
    "api_keys": {
      "title": "مفاتيح API",
      "subtitle": "دبر الولوج البرمجي لـ API سكاليان",
      "create_button": "دير مفتاح",
      "name_column": "الاسم",
      "prefix_column": "البادئة",
      "scopes_column": "الصلاحيات",
      "created_at_column": "تاريخ الإنشاء",
      "last_used_column": "آخر استخدام",
      "revoke_button": "إلغاء"
    }
  },
  "profile": {
    "title": "الملف الشخصي",
    "subtitle": "دبر معلوماتك الشخصية والأمن",
    "tabs": {
      "info": "المعلومات",
      "security": "الأمن",
      "notifications": "الإشعارات"
    },
    "info": {
      "title": "المعلومات الشخصية",
      "photo_label": "صورة الملف",
      "photo_upload": "رفع صورة (JPG/PNG، الحد الأقصى 1 ميغا)",
      "photo_remove": "حذف الصورة",
      "display_name_label": "اسم العرض",
      "email_label": "الإيمايل",
      "email_helper": "باش تبدل الإيمايل، اتصل بالدعم",
      "phone_label": "التيليفون",
      "locale_label": "اللغة المفضلة",
      "timezone_label": "المنطقة الزمنية",
      "preferred_channel_label": "قناة الإشعار المفضلة",
      "channel_email": "إيمايل",
      "channel_in_app": "في التطبيق",
      "channel_both": "بجوج"
    },
    "security": {
      "title": "الأمن",
      "change_password_section": "بدل كلمة السر",
      "current_password_label": "كلمة السر الحالية",
      "new_password_label": "كلمة السر الجديدة",
      "confirm_password_label": "أكد كلمة السر الجديدة",
      "change_password_submit": "بدل كلمة السر",
      "mfa_section": "التحقق بعاملين (MFA)",
      "mfa_status_enabled": "مفعل",
      "mfa_status_disabled": "غير مفعل",
      "mfa_enable_button": "فعل MFA",
      "mfa_disable_button": "ألغي MFA",
      "mfa_setup_title": "إعداد MFA",
      "mfa_setup_step1": "سكان هاد QR code بالتطبيق ديالك",
      "mfa_setup_step2": "دخل الكود ديال 6 أرقام",
      "mfa_setup_verify_button": "تحقق وفعل",
      "mfa_recovery_codes_title": "كودات الاسترجاع",
      "mfa_recovery_codes_message": "احفظ هاد الكودات في بلاصة آمنة. كل كود يستعمل مرة واحدة.",
      "mfa_recovery_codes_download": "حمل الكودات",
      "sessions_section": "الجلسات النشطة",
      "sessions_device_column": "الجهاز",
      "sessions_location_column": "الموقع",
      "sessions_last_activity_column": "آخر نشاط",
      "sessions_revoke_button": "ألغي",
      "sessions_revoke_all_button": "ألغي الباقي",
      "sessions_current_label": "الجلسة الحالية"
    },
    "notifications": {
      "title": "تفضيلات الإشعارات",
      "email_section": "إشعارات بالإيمايل",
      "in_app_section": "إشعارات في التطبيق",
      "new_deal_label": "صفقة جديدة معينة",
      "deal_won_label": "صفقة رابحة",
      "deal_lost_label": "صفقة خاسرة",
      "police_renewal_label": "تجديد بوليصة قريب",
      "sinistre_update_label": "تحديث حادث",
      "broker_queue_label": "ملف جديد للمصادقة",
      "system_label": "إعلانات النظام"
    },
    "success_updated": "الملف تحدث",
    "success_password_changed": "كلمة السر تبدلت",
    "success_mfa_enabled": "MFA تفعل",
    "success_mfa_disabled": "MFA تلغى",
    "success_session_revoked": "الجلسة تلغت"
  },
  "errors": {
    "network": "خطأ في الشبكة. تحقق من الاتصال.",
    "timeout": "انتهت مهلة الانتظار",
    "unauthorized": "غير مصرح. عاود الدخول.",
    "forbidden": "ولوج ممنوع. ما عندكش الصلاحيات.",
    "not_found": "ما تلقاش",
    "not_found_title": "الصفحة ما موجوداش",
    "not_found_message": "الصفحة اللي كتقلب عليها ما موجوداش أو تنقلت.",
    "not_found_back_home": "رجوع للوحة التحكم",
    "server_error": "خطأ في الخادم. عاود من بعد.",
    "server_error_title": "خطأ في الخادم",
    "server_error_message": "وقع خطأ غير متوقع. الفريق ديالنا تخبر.",
    "server_error_retry": "عاود",
    "validation_error": "بيانات غالطة",
    "rate_limit": "طلبات بزاف. تسنا شوية.",
    "session_expired": "الجلسة انتهت. عاود الدخول.",
    "tenant_not_selected": "ما اخترتش تينانت",
    "feature_unavailable": "الميزة ما متاحاش",
    "permission_denied": "الصلاحية مرفوضة",
    "field_required": "هاد الحقل إجباري",
    "field_email_invalid": "إيمايل غالط",
    "field_phone_invalid": "تيليفون غالط",
    "field_too_short": "قصير بزاف (الحد الأدنى {min} حرف)",
    "field_too_long": "طويل بزاف (الحد الأقصى {max} حرف)"
  },
  "locale": {
    "fr": "الفرنسية",
    "ar-MA": "الدارجة",
    "ar": "العربية"
  },
  "format": {
    "date_short": "ي ي / ش ش / س س س س",
    "time_24h": "HH:mm",
    "currency_symbol": "درهم",
    "currency_position": "after"
  }
}
```

**Notes traduction ar-MA Darija** :
- Registre familier proche de la langue parlée quotidienne MA.
- Mix arabe + lexique français transliteré (CIN, MFA, ICE, RC, IFU, API, QR code conservés tels quels).
- Verbes conjugués en darija ("جاي", "دير", "شوف", "قلب").
- Pas d'emoji.
- Direction RTL implicite (Unicode arabe natif).

---

## 8. Patron code complet : messages/ar.json (arabe classique)

(Le fichier ar.json suit la même structure que fr.json et ar-MA.json avec ~650 cles, mais utilise l'arabe classique formel institutionnel. Echantillons clés du fichier complet ci-dessous, le fichier complet suivrait le même pattern pour toutes les sections couvertes en fr.json et ar-MA.json.)

```json
{
  "meta": {
    "title": "سكاليان للوساطة",
    "description": "منصة الوساطة في التأمين متعددة المستأجرين بالمملكة المغربية"
  },
  "common": {
    "loading": "جارٍ التحميل...",
    "loading_data": "جارٍ تحميل البيانات...",
    "saving": "جارٍ الحفظ...",
    "submitting": "جارٍ الإرسال...",
    "deleting": "جارٍ الحذف...",
    "processing": "جارٍ المعالجة...",
    "error": "خطأ",
    "error_generic": "حدث خطأ. يُرجى المحاولة مرة أخرى.",
    "success": "نجح",
    "save": "حفظ",
    "save_changes": "حفظ التعديلات",
    "cancel": "إلغاء",
    "confirm": "تأكيد",
    "close": "إغلاق",
    "back": "رجوع",
    "next": "التالي",
    "previous": "السابق",
    "search": "بحث",
    "search_placeholder": "ابحث...",
    "filter": "تصفية",
    "filters": "المرشحات",
    "filter_active": "{count} مرشح نشط",
    "clear_filters": "مسح المرشحات",
    "sort": "ترتيب",
    "sort_by": "ترتيب حسب",
    "ascending": "تصاعدي",
    "descending": "تنازلي",
    "refresh": "تحديث",
    "export": "تصدير",
    "delete": "حذف",
    "delete_confirm": "هل أنت متأكد من رغبتك في حذف هذا العنصر؟",
    "edit": "تعديل",
    "create": "إنشاء",
    "add": "إضافة",
    "remove": "إزالة",
    "view": "عرض",
    "yes": "نعم",
    "no": "لا",
    "all": "الكل",
    "none": "لا شيء",
    "select": "اختيار",
    "actions": "الإجراءات",
    "settings": "الإعدادات",
    "help": "مساعدة",
    "language": "اللغة",
    "currency": "العملة"
  },
  "nav": {
    "dashboard": "لوحة التحكم",
    "contacts": "جهات الاتصال",
    "companies": "الشركات",
    "deals": "الصفقات",
    "polices": "العقود",
    "broker_queue": "قائمة المصادقة",
    "sinistres": "الحوادث",
    "parametres": "الإعدادات",
    "profile": "الملف الشخصي",
    "logout": "تسجيل الخروج"
  },
  "auth": {
    "login": {
      "title": "تسجيل الدخول إلى سكاليان للوساطة",
      "subtitle": "الولوج إلى فضاء الوسيط",
      "email_label": "البريد الإلكتروني",
      "password_label": "كلمة المرور",
      "remember_me": "تذكرني",
      "submit": "تسجيل الدخول",
      "forgot_password": "هل نسيت كلمة المرور؟",
      "signup_link": "إنشاء حساب",
      "error_invalid_credentials": "البريد الإلكتروني أو كلمة المرور غير صحيحين",
      "success": "تم تسجيل الدخول بنجاح"
    },
    "mfa": {
      "title": "التحقق بعاملين",
      "subtitle": "أدخل الرمز المكوّن من 6 أرقام",
      "code_label": "رمز التحقق",
      "submit": "تحقق",
      "error_invalid_code": "الرمز غير صحيح"
    },
    "signup": {
      "title": "إنشاء حساب جديد",
      "first_name_label": "الاسم",
      "last_name_label": "اللقب",
      "email_label": "البريد الإلكتروني المهني",
      "password_label": "كلمة المرور",
      "submit": "إنشاء الحساب"
    }
  },
  "dashboard": {
    "title": "لوحة التحكم",
    "welcome": "مرحبًا {name}",
    "subtitle": "نظرة عامة على نشاطكم كوسيط تأمين",
    "widget_revenue": {
      "title": "الإيرادات السنوية حتى اليوم",
      "subtitle": "رقم المعاملات منذ بداية السنة",
      "total_label": "المجموع"
    },
    "widget_polices_actives": {
      "title": "العقود النشطة",
      "branche_auto": "السيارات",
      "branche_habitation": "السكن",
      "branche_sante": "الصحة",
      "branche_vie": "الحياة"
    }
  },
  "contacts": {
    "title": "جهات الاتصال",
    "subtitle": "إدارة جهات الاتصال",
    "create_button": "إضافة جهة اتصال",
    "form": {
      "first_name_label": "الاسم",
      "last_name_label": "اللقب",
      "email_label": "البريد الإلكتروني",
      "phone_label": "الهاتف",
      "cin_label": "بطاقة التعريف الوطنية"
    }
  },
  "polices": {
    "title": "العقود",
    "subtitle": "إدارة عقود التأمين",
    "table": {
      "policy_number_column": "رقم العقد",
      "souscripteur_column": "المكتتب",
      "branche_column": "الفرع",
      "start_date_column": "تاريخ السريان",
      "end_date_column": "تاريخ الانتهاء",
      "status_column": "الحالة",
      "prime_annuelle_column": "القسط السنوي"
    }
  },
  "broker_queue": {
    "title": "قائمة مصادقة الوسيط",
    "actions": {
      "validate": "المصادقة",
      "reject": "رفض",
      "escalate": "تصعيد"
    }
  },
  "sinistres": {
    "title": "الحوادث",
    "subtitle": "متابعة الحوادث المرتبطة بعقودكم (قراءة فقط)"
  },
  "errors": {
    "network": "خطأ في الشبكة. يُرجى التحقق من اتصالكم.",
    "unauthorized": "غير مصرح به. يُرجى تسجيل الدخول مجددًا.",
    "forbidden": "الولوج ممنوع. لا تتوفرون على الصلاحيات اللازمة.",
    "not_found": "المورد غير موجود",
    "server_error": "خطأ في الخادم. يُرجى المحاولة لاحقًا."
  },
  "locale": {
    "fr": "الفرنسية",
    "ar-MA": "الدارجة المغربية",
    "ar": "العربية الفصحى"
  }
}
```

**Notes traduction ar arabe classique** :
- Registre formel administratif et juridique compatible avec exigences ACAPS et conditions générales polices.
- Verbes au passif formel ("يُرجى", "تم", "جارٍ" avec sukoun).
- Vocabulaire institutionnel (لوحة التحكم, جهات الاتصال, العقود, المصادقة).
- Direction RTL implicite.
- Le fichier complet contient les ~650 cles parité stricte avec fr.json et ar-MA.json.

---

## 9. Patron code complet : lib/i18n/routing.ts

```typescript
// repo/apps/web-broker/lib/i18n/routing.ts
// Configuration routing next-intl 3.26.3 web-broker
// Extension Sprint 4 shared-ui/i18n/routing.ts canonique

import { defineRouting } from 'next-intl/routing';
import { createSharedPathnamesNavigation } from 'next-intl/navigation';

export const LOCALES = ['fr', 'ar-MA', 'ar'] as const;
export type LocaleCode = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: LocaleCode = 'fr';

export const LOCALE_LABELS: Record<LocaleCode, string> = {
  fr: 'Francais',
  'ar-MA': 'الدارجة',
  ar: 'العربية',
};

export const LOCALE_DIRECTIONS: Record<LocaleCode, 'ltr' | 'rtl'> = {
  fr: 'ltr',
  'ar-MA': 'rtl',
  ar: 'rtl',
};

export const LOCALE_FONT_FAMILIES: Record<LocaleCode, string> = {
  fr: "'Geist Sans', 'Inter', sans-serif",
  'ar-MA': "'Noto Naskh Arabic', 'Geeza Pro', 'Tahoma', sans-serif",
  ar: "'Noto Naskh Arabic', 'Geeza Pro', 'Tahoma', sans-serif",
};

export function isRtl(locale: string): boolean {
  return LOCALE_DIRECTIONS[locale as LocaleCode] === 'rtl';
}

export function getDirection(locale: string): 'ltr' | 'rtl' {
  return LOCALE_DIRECTIONS[locale as LocaleCode] ?? 'ltr';
}

export function isLocaleSupported(locale: string): locale is LocaleCode {
  return (LOCALES as readonly string[]).includes(locale);
}

export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: 'always',
  alternateLinks: true,
  localeDetection: true,
});

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createSharedPathnamesNavigation(routing);
```

---

## 10. Patron code complet : lib/i18n/request.ts

```typescript
// repo/apps/web-broker/lib/i18n/request.ts
// next-intl getRequestConfig avec fallback chain ar-MA -> ar -> fr

import { getRequestConfig } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { routing, DEFAULT_LOCALE, isLocaleSupported, type LocaleCode } from './routing';

type Messages = Record<string, unknown>;

async function loadMessages(locale: LocaleCode): Promise<Messages> {
  try {
    const messages = (await import(`../../messages/${locale}.json`)).default;
    return messages as Messages;
  } catch (err) {
    console.warn(`[i18n] Failed to load messages for locale "${locale}":`, err);
    return {};
  }
}

function deepMerge<T extends Record<string, unknown>>(base: T, override: T): T {
  const result = { ...base };
  for (const key of Object.keys(override)) {
    const baseValue = (base as Record<string, unknown>)[key];
    const overrideValue = (override as Record<string, unknown>)[key];
    if (
      typeof baseValue === 'object' &&
      typeof overrideValue === 'object' &&
      baseValue !== null &&
      overrideValue !== null &&
      !Array.isArray(baseValue) &&
      !Array.isArray(overrideValue)
    ) {
      (result as Record<string, unknown>)[key] = deepMerge(
        baseValue as Record<string, unknown>,
        overrideValue as Record<string, unknown>,
      );
    } else if (overrideValue !== undefined && overrideValue !== null && overrideValue !== '') {
      (result as Record<string, unknown>)[key] = overrideValue;
    }
  }
  return result;
}

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !hasLocale(routing.locales, locale)) {
    locale = DEFAULT_LOCALE;
  }
  const resolvedLocale = locale as LocaleCode;

  const frMessages = await loadMessages('fr');
  let messages: Messages = frMessages;

  if (resolvedLocale === 'ar') {
    const arMessages = await loadMessages('ar');
    messages = deepMerge(frMessages, arMessages);
  } else if (resolvedLocale === 'ar-MA') {
    const arMessages = await loadMessages('ar');
    const arMaMessages = await loadMessages('ar-MA');
    messages = deepMerge(deepMerge(frMessages, arMessages), arMaMessages);
  }

  return {
    locale: resolvedLocale,
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
        currency: {
          style: 'currency',
          currency: 'MAD',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        },
        percent: { style: 'percent', maximumFractionDigits: 2 },
        compact: { notation: 'compact', compactDisplay: 'short' },
      },
      list: {
        conjunction: { style: 'long', type: 'conjunction' },
        disjunction: { style: 'long', type: 'disjunction' },
      },
    },
    onError: (error) => {
      if (error.code === 'MISSING_MESSAGE') {
        console.warn(`[i18n] Missing message: ${error.message}`);
      } else {
        console.error('[i18n] Error:', error);
      }
    },
    getMessageFallback: ({ namespace, key }) => {
      const path = [namespace, key].filter(Boolean).join('.');
      return `[${path}]`;
    },
  };
});
```

---

## 11. Patron code complet : lib/i18n/formatters.ts

```typescript
// repo/apps/web-broker/lib/i18n/formatters.ts
// Locale-aware formatters timezone Africa/Casablanca

import { format, formatDistanceToNow, formatRelative } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { fr } from 'date-fns/locale/fr';
import { arMA } from 'date-fns/locale/ar-MA';
import { ar } from 'date-fns/locale/ar';
import type { LocaleCode } from './routing';

const TIMEZONE = 'Africa/Casablanca';

const DATE_LOCALES: Record<LocaleCode, Locale> = {
  fr,
  'ar-MA': arMA,
  ar,
};

const NUMBER_FORMAT_LOCALES: Record<LocaleCode, string> = {
  fr: 'fr-MA',
  'ar-MA': 'ar-MA',
  ar: 'ar-MA',
};

export interface FormatDateOptions {
  pattern?: string;
  includeTime?: boolean;
}

export function formatDate(
  date: Date | string | number,
  locale: LocaleCode,
  options: FormatDateOptions = {},
): string {
  const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  if (!dateObj || Number.isNaN(dateObj.getTime())) return '';
  const zoned = toZonedTime(dateObj, TIMEZONE);
  const pattern = options.pattern ?? (options.includeTime ? 'dd/MM/yyyy HH:mm' : 'dd/MM/yyyy');
  return format(zoned, pattern, { locale: DATE_LOCALES[locale] });
}

export function formatTime(date: Date | string | number, locale: LocaleCode): string {
  const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  if (!dateObj || Number.isNaN(dateObj.getTime())) return '';
  const zoned = toZonedTime(dateObj, TIMEZONE);
  return format(zoned, 'HH:mm', { locale: DATE_LOCALES[locale] });
}

export function formatDateTime(date: Date | string | number, locale: LocaleCode): string {
  return formatDate(date, locale, { includeTime: true });
}

export function formatRelativeTime(
  date: Date | string | number,
  locale: LocaleCode,
  options: { addSuffix?: boolean } = { addSuffix: true },
): string {
  const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  if (!dateObj || Number.isNaN(dateObj.getTime())) return '';
  return formatDistanceToNow(dateObj, {
    locale: DATE_LOCALES[locale],
    addSuffix: options.addSuffix,
  });
}

export function formatDateRange(
  start: Date | string,
  end: Date | string,
  locale: LocaleCode,
): string {
  const startStr = formatDate(start, locale);
  const endStr = formatDate(end, locale);
  if (locale === 'fr') return `du ${startStr} au ${endStr}`;
  return `${startStr} - ${endStr}`;
}

export interface FormatCurrencyOptions {
  showSymbol?: boolean;
  showSign?: boolean;
  fractionDigits?: number;
  useArabicIndicNumerals?: boolean;
}

export function formatCurrency(
  amount: number,
  locale: LocaleCode,
  options: FormatCurrencyOptions = {},
): string {
  if (!Number.isFinite(amount)) return '';
  const {
    showSymbol = true,
    fractionDigits = 2,
    useArabicIndicNumerals = false,
  } = options;
  const numberLocale = useArabicIndicNumerals && (locale === 'ar' || locale === 'ar-MA')
    ? `${NUMBER_FORMAT_LOCALES[locale]}-u-nu-arab`
    : NUMBER_FORMAT_LOCALES[locale];

  const formatter = new Intl.NumberFormat(numberLocale, {
    style: showSymbol ? 'currency' : 'decimal',
    currency: 'MAD',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
  const formatted = formatter.format(amount);
  return formatted.replace('MAD', 'DH').replace(/د\.م\./g, 'DH');
}

export interface FormatNumberOptions {
  fractionDigits?: number;
  useArabicIndicNumerals?: boolean;
  notation?: 'standard' | 'compact';
}

export function formatNumber(
  value: number,
  locale: LocaleCode,
  options: FormatNumberOptions = {},
): string {
  if (!Number.isFinite(value)) return '';
  const { fractionDigits = 2, useArabicIndicNumerals = false, notation = 'standard' } = options;
  const numberLocale = useArabicIndicNumerals && (locale === 'ar' || locale === 'ar-MA')
    ? `${NUMBER_FORMAT_LOCALES[locale]}-u-nu-arab`
    : NUMBER_FORMAT_LOCALES[locale];
  return new Intl.NumberFormat(numberLocale, {
    minimumFractionDigits: notation === 'compact' ? 0 : fractionDigits,
    maximumFractionDigits: notation === 'compact' ? 1 : fractionDigits,
    notation,
  }).format(value);
}

export function formatPercent(value: number, locale: LocaleCode): string {
  if (!Number.isFinite(value)) return '';
  return new Intl.NumberFormat(NUMBER_FORMAT_LOCALES[locale], {
    style: 'percent',
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatCompactNumber(value: number, locale: LocaleCode): string {
  return formatNumber(value, locale, { notation: 'compact' });
}

export function formatList(
  items: readonly string[],
  locale: LocaleCode,
  type: 'conjunction' | 'disjunction' = 'conjunction',
): string {
  if (items.length === 0) return '';
  return new Intl.ListFormat(NUMBER_FORMAT_LOCALES[locale], {
    style: 'long',
    type,
  }).format(items);
}

export function formatFileSize(bytes: number, locale: LocaleCode): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${formatNumber(n, locale, { fractionDigits: i === 0 ? 0 : 1 })} ${units[i]}`;
}
```

---

## 12. Patron code complet : lib/i18n/pluralize.ts

```typescript
// repo/apps/web-broker/lib/i18n/pluralize.ts
// Helper Intl.PluralRules pour CLDR 6 categories arabe

import type { LocaleCode } from './routing';

export type PluralCategory = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';

const PLURAL_CACHE = new Map<string, Intl.PluralRules>();

function getPluralRules(locale: LocaleCode): Intl.PluralRules {
  const key = locale;
  let rules = PLURAL_CACHE.get(key);
  if (!rules) {
    const intlLocale = locale === 'ar-MA' ? 'ar' : locale;
    rules = new Intl.PluralRules(intlLocale, { type: 'cardinal' });
    PLURAL_CACHE.set(key, rules);
  }
  return rules;
}

export function getPluralCategory(count: number, locale: LocaleCode): PluralCategory {
  const rules = getPluralRules(locale);
  return rules.select(count) as PluralCategory;
}

export interface PluralForms {
  zero?: string;
  one?: string;
  two?: string;
  few?: string;
  many?: string;
  other: string;
}

export function pluralize(count: number, locale: LocaleCode, forms: PluralForms): string {
  const category = getPluralCategory(count, locale);
  return forms[category] ?? forms.other;
}

export function formatPlural(
  count: number,
  locale: LocaleCode,
  forms: PluralForms,
  placeholder = '#',
): string {
  const template = pluralize(count, locale, forms);
  return template.replace(new RegExp(placeholder, 'g'), String(count));
}
```

---

## 13. Patron code complet : lib/i18n/use-translations.tsx

```typescript
// repo/apps/web-broker/lib/i18n/use-translations.tsx
// Hook wrapper typed avec autocomplete namespaces

'use client';

import { useTranslations as useNextIntlTranslations, useLocale as useNextIntlLocale } from 'next-intl';
import type { LocaleCode } from './routing';
import type { AppMessages } from './types';

type Namespace = keyof AppMessages | `${keyof AppMessages}.${string}`;

export function useT<N extends Namespace>(namespace?: N) {
  return useNextIntlTranslations(namespace as string);
}

export function useLocaleCode(): LocaleCode {
  return useNextIntlLocale() as LocaleCode;
}

export function useDirection(): 'ltr' | 'rtl' {
  const locale = useLocaleCode();
  return locale === 'ar' || locale === 'ar-MA' ? 'rtl' : 'ltr';
}

export function useIsRtl(): boolean {
  return useDirection() === 'rtl';
}
```

---

## 14. Patron code complet : lib/i18n/types.ts

```typescript
// repo/apps/web-broker/lib/i18n/types.ts
// Type definitions exhaustive AppMessages derived from fr.json

import type frMessages from '../../messages/fr.json';

export type AppMessages = typeof frMessages;

declare global {
  interface IntlMessages extends AppMessages {}
}

export type LocaleCode = 'fr' | 'ar-MA' | 'ar';

export interface LocaleConfig {
  code: LocaleCode;
  nativeName: string;
  englishName: string;
  direction: 'ltr' | 'rtl';
  fontFamily: string;
  flagPath: string;
  dateFormat: string;
  timeFormat: string;
  numberFormat: string;
  currencyCode: 'MAD';
  currencySymbol: 'DH';
}

export const LOCALE_CONFIGS: Record<LocaleCode, LocaleConfig> = {
  fr: {
    code: 'fr',
    nativeName: 'Francais',
    englishName: 'French',
    direction: 'ltr',
    fontFamily: "'Geist Sans', 'Inter', sans-serif",
    flagPath: '/flags/fr.svg',
    dateFormat: 'dd/MM/yyyy',
    timeFormat: 'HH:mm',
    numberFormat: 'fr-MA',
    currencyCode: 'MAD',
    currencySymbol: 'DH',
  },
  'ar-MA': {
    code: 'ar-MA',
    nativeName: 'الدارجة',
    englishName: 'Moroccan Darija',
    direction: 'rtl',
    fontFamily: "'Noto Naskh Arabic', 'Geeza Pro', 'Tahoma', sans-serif",
    flagPath: '/flags/ar-MA.svg',
    dateFormat: 'dd/MM/yyyy',
    timeFormat: 'HH:mm',
    numberFormat: 'ar-MA',
    currencyCode: 'MAD',
    currencySymbol: 'DH',
  },
  ar: {
    code: 'ar',
    nativeName: 'العربية',
    englishName: 'Standard Arabic',
    direction: 'rtl',
    fontFamily: "'Noto Naskh Arabic', 'Geeza Pro', 'Tahoma', sans-serif",
    flagPath: '/flags/ar.svg',
    dateFormat: 'dd/MM/yyyy',
    timeFormat: 'HH:mm',
    numberFormat: 'ar-MA',
    currencyCode: 'MAD',
    currencySymbol: 'DH',
  },
};
```

---

## 15. Patron code complet : components/layout/locale-switcher.tsx

```typescript
// repo/apps/web-broker/components/layout/locale-switcher.tsx
// LocaleSwitcher operationnel : preserve searchParams + hash + cookie

'use client';

import { useState, useTransition, useCallback } from 'react';
import { useLocale } from 'next-intl';
import { useRouter, usePathname } from '@/lib/i18n/routing';
import { useSearchParams } from 'next/navigation';
import { Check, ChevronsUpDown, Globe } from 'lucide-react';
import Image from 'next/image';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { LOCALES, LOCALE_LABELS, type LocaleCode } from '@/lib/i18n/routing';
import { useT } from '@/lib/i18n/use-translations';
import { useFormDirtyContext } from '@/lib/forms/use-form-dirty-context';

const COOKIE_NAME = 'NEXT_LOCALE';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 365 days

function persistLocaleCookie(locale: LocaleCode): void {
  if (typeof document === 'undefined') return;
  const isSecure = window.location.protocol === 'https:';
  const secureFlag = isSecure ? '; Secure' : '';
  document.cookie = `${COOKIE_NAME}=${locale}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax${secureFlag}`;
}

export function LocaleSwitcher() {
  const currentLocale = useLocale() as LocaleCode;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [pendingLocale, setPendingLocale] = useState<LocaleCode | null>(null);
  const formDirty = useFormDirtyContext();
  const t = useT('common');

  const switchLocale = useCallback(
    (newLocale: LocaleCode) => {
      if (newLocale === currentLocale) return;
      const queryString = searchParams.toString();
      const hash = typeof window !== 'undefined' ? window.location.hash : '';
      const target = `${pathname}${queryString ? `?${queryString}` : ''}${hash}`;

      persistLocaleCookie(newLocale);
      startTransition(() => {
        router.replace(target, { locale: newLocale });
      });
    },
    [currentLocale, pathname, router, searchParams],
  );

  const handleSelect = (newLocale: LocaleCode) => {
    if (formDirty?.isDirty) {
      setPendingLocale(newLocale);
    } else {
      switchLocale(newLocale);
    }
  };

  const handleConfirmSwitch = () => {
    if (pendingLocale) {
      formDirty?.reset?.();
      switchLocale(pendingLocale);
      setPendingLocale(null);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            disabled={isPending}
            aria-label={t('language')}
            className="gap-2"
          >
            <Globe className="h-4 w-4" />
            <span className="hidden sm:inline">{LOCALE_LABELS[currentLocale]}</span>
            <ChevronsUpDown className="h-3 w-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[180px]">
          {LOCALES.map((locale) => (
            <DropdownMenuItem
              key={locale}
              onSelect={() => handleSelect(locale)}
              className="gap-2"
              disabled={isPending}
            >
              <Image
                src={`/flags/${locale}.svg`}
                alt=""
                width={20}
                height={14}
                aria-hidden="true"
                className="rounded-sm border border-border"
              />
              <span className="flex-1" lang={locale}>
                {LOCALE_LABELS[locale]}
              </span>
              {locale === currentLocale && <Check className="h-4 w-4" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={pendingLocale !== null} onOpenChange={(open) => !open && setPendingLocale(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('confirm')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('language')} : {pendingLocale && LOCALE_LABELS[pendingLocale]}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSwitch}>{t('confirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
```

---

## 16. Patron code complet : app/globals.css (additions RTL)

```css
/* repo/apps/web-broker/app/globals.css -- additions Sprint 16.4.3.13 RTL */

@import 'tailwindcss';

:root {
  --font-geist-sans: 'Geist Sans', system-ui, sans-serif;
  --font-noto-naskh: 'Noto Naskh Arabic', 'Geeza Pro', 'Tahoma', sans-serif;
}

html {
  font-family: var(--font-geist-sans);
}

[dir="rtl"] {
  font-family: var(--font-noto-naskh);
  font-feature-settings: 'liga', 'kern', 'arab';
}

[dir="rtl"] body {
  text-align: start;
}

/* Logical margin / padding utilities (Tailwind 4 native, just clarify) */
[dir="rtl"] .ms-auto { margin-inline-start: auto; }
[dir="rtl"] .me-auto { margin-inline-end: auto; }

/* Icons mirroring */
.rtl-flip {
  transition: transform 0.15s ease;
}
[dir="rtl"] .rtl-flip {
  transform: scaleX(-1);
}

[dir="rtl"] [data-slot="chevron-right"],
[dir="rtl"] [data-slot="arrow-right"],
[dir="rtl"] [data-slot="breadcrumb-separator"],
[dir="rtl"] [data-slot="pagination-next"] svg {
  transform: rotate(180deg);
}

[dir="rtl"] [data-slot="chevron-left"],
[dir="rtl"] [data-slot="arrow-left"],
[dir="rtl"] [data-slot="pagination-previous"] svg {
  transform: rotate(180deg);
}

/* shadcn sidebar mirror */
[dir="rtl"] [data-sidebar="sidebar"] {
  border-inline-end: 1px solid var(--sidebar-border);
  border-inline-start: none;
}

/* Scrollbar RTL */
[dir="rtl"] ::-webkit-scrollbar {
  direction: rtl;
}

/* Number tabular for tables (mono digits avoid mismatch fr/ar) */
.tabular-nums {
  font-variant-numeric: tabular-nums;
}

/* BDI inline arabic in fr context */
bdi[lang="ar"], bdi[lang="ar-MA"] {
  font-family: var(--font-noto-naskh);
  unicode-bidi: isolate;
}

/* Smooth font transition on locale switch */
html {
  transition: font-family 0.15s ease;
}
```

---

## 17. Validation V1-V25 (15 P0 + 6 P1 + 4 P2)

### Criteres P0 (15 - blocking, must pass)

- **V1 (P0)** : Les 3 fichiers `messages/{fr,ar-MA,ar}.json` existent avec parité stricte (script `pnpm i18n:lint` exit 0). Coverage cles >= 600 par locale.
- **V2 (P0)** : Click LocaleSwitcher change les UI texts (assertion E2E : titre dashboard fr "Tableau de bord" -> ar-MA "لوحة التحكم" -> ar "لوحة التحكم").
- **V3 (P0)** : Attribute `<html dir="rtl">` appliqué automatiquement sur routes `/ar-MA/*` et `/ar/*`, `<html dir="ltr">` sur `/fr/*` (assertion DOM E2E).
- **V4 (P0)** : `formatDate(new Date('2026-03-15T10:00:00Z'), 'fr')` renvoie `"15/03/2026"` en heure locale Casablanca (test Vitest).
- **V5 (P0)** : `formatCurrency(1234.56, 'fr')` renvoie `"1 234,56 DH"` (post-process MAD->DH).
- **V6 (P0)** : `pluralize(0, 'ar', { zero, one, other })` renvoie le template `zero`; `pluralize(2, 'ar', { two, other })` renvoie `two`.
- **V7 (P0)** : Cookie `NEXT_LOCALE` set avec max-age=31536000 (365j), SameSite=Lax, Secure en production (assertion E2E document.cookie).
- **V8 (P0)** : LocaleSwitcher preserve `?page=3&q=ahmed#item-12` (test E2E URL match exact).
- **V9 (P0)** : Script `pnpm i18n:lint` exit 0 (parité parfaite 3 locales, rapport markdown vide).
- **V10 (P0)** : Fallback chain : si cle absente ar-MA tombe sur ar, si absente ar tombe sur fr (test unitaire deepMerge dans request.ts).
- **V11 (P0)** : Font `Noto Naskh Arabic` chargée et appliquée sur routes ar/ar-MA (test E2E `getComputedStyle().fontFamily` contient "Noto Naskh").
- **V12 (P0)** : Lighthouse Accessibility >= 95 sur /fr/dashboard, /ar-MA/dashboard, /ar/dashboard.
- **V13 (P0)** : `pnpm --filter @insurtech/web-broker typecheck` exit 0 avec types AppMessages auto-générés depuis fr.json.
- **V14 (P0)** : 12 pages web-broker traduites 100% (smoke test E2E parcourt /[locale]/{dashboard,contacts,companies,deals,polices,broker-queue,sinistres,parametres,profile} et vérifie absence de pattern `[namespace.key]` fallback).
- **V15 (P0)** : `grep -r emoji-regex apps/web-broker/messages/` exit 1 (zero emoji confirmé).

### Criteres P1 (6 - high priority)

- **V16 (P1)** : Icones chevrons et arrows flippent en RTL (visual regression test screenshot Playwright).
- **V17 (P1)** : Accept-Language `de-DE` redirect vers /fr (defaut).
- **V18 (P1)** : Date Ramadan DST -1h correctement gerée : `formatDate(new Date('2026-03-15T12:00:00Z'), 'fr')` retourne `"15/03/2026, 12:00"`.
- **V19 (P1)** : Forms dirty (react-hook-form formState.isDirty=true) + click LocaleSwitcher = AlertDialog confirmation.
- **V20 (P1)** : LocaleSwitcher dropdown z-index OK au-dessus topbar sticky (test E2E click element non bloqué).
- **V21 (P1)** : Tests E2E `i18n-locale-switch.spec.ts` 15 tests passent en CI.

### Criteres P2 (4 - nice to have)

- **V22 (P2)** : `useArabicIndicNumerals: true` option fonctionne pour `formatNumber(1234, 'ar', { useArabicIndicNumerals: true })` -> `"١٬٢٣٤"`.
- **V23 (P2)** : `formatList(['Ahmed', 'Fatima', 'Hassan'], 'fr')` retourne `"Ahmed, Fatima et Hassan"`; en ar `"أحمد، فاطمة و حسن"`.
- **V24 (P2)** : Storybook story LocaleSwitcher avec controls 3 locales (deferred a Sprint 27 si manque temps).
- **V25 (P2)** : Documentation README lib/i18n/README.md complete avec exemples API.

---

## 18. Edge Cases (10 EC)

- **EC1 -- Missing key ar-MA fallback ar** : Cle `polices.detail.tabs.operations` présente en fr et ar mais absente ar-MA. Fallback chain merge `fr <- ar <- ar-MA` produit valeur arabe formelle. Test Vitest : `messages = deepMerge(frMessages, arMessages)` puis lookup retourne valeur ar.

- **EC2 -- Missing key both locales fallback fr** : Cle `debug.internal.error_code` présente en fr uniquement. ar-MA et ar n'ont pas. Fallback retourne valeur fr. Warning console mais pas crash. Test Vitest assertion.

- **EC3 -- Currency negative MAD** : `formatCurrency(-1234.56, 'fr')` doit retourner `"-1 234,56 DH"`. Intl.NumberFormat retourne `"-1 234,56 MAD"` puis post-process replace MAD->DH preserve signe. Test Vitest avec assertion exacte.

- **EC4 -- Date timezone Ramadan DST -1h** : `formatDate(new Date('2026-03-01T11:00:00Z'), 'fr', { includeTime: true })` pendant Ramadan 2026 (15 fev a 15 mars approx) doit retourner `"01/03/2026 11:00"` (heure locale Casablanca GMT+0 Ramadan), pas `"01/03/2026 12:00"`. Test Vitest avec mock date Ramadan + verify timezone Africa/Casablanca DST correct.

- **EC5 -- Plural zero count** : `pluralize(0, 'ar', { zero: 'لا توجد جهات اتصال', one: 'جهة اتصال واحدة', other: '{count} جهات اتصال' })` retourne `"لا توجد جهات اتصال"`. CLDR `Intl.PluralRules('ar').select(0)` = `"zero"`. Test Vitest.

- **EC6 -- Plural very large count** : `pluralize(10000, 'ar', { ... other: '{count} جهة اتصال' })` retourne template `other`. CLDR `Intl.PluralRules('ar').select(10000)` = `"other"`. Test Vitest.

- **EC7 -- Locale switch mid-form submit** : Utilisateur clique submit form contact (POST in-flight), simultanément click LocaleSwitcher. `useTransition` startTransition wrap router.replace -- attend la fin de la mutation submit avant de declencher re-render full. Toast result affichée en nouvelle locale. Test E2E spécifique.

- **EC8 -- Hash + searchParams preserved on switch** : URL `/fr/contacts?page=3&segment=premium#contact-12` switch vers `ar-MA`. Resultat `/ar-MA/contacts?page=3&segment=premium#contact-12`. LocaleSwitcher lit `useSearchParams()` + `window.location.hash`, reconstruit target. Test E2E avec URL match exact.

- **EC9 -- Server-side dir vs client mismatch** : Server-render avec `dir="rtl"` (locale ar). Client hydration verifie identique. Pas de warning React. Solution : `dir` calculé deterministiquement depuis `params.locale` route segment, jamais depuis cookie raw server-side. Test Vitest server vs client render.

- **EC10 -- Noto Naskh font failed load** : Mock fetch Google Fonts return 500 (network throttle test). Fallback chain `font-family: 'Noto Naskh Arabic', 'Geeza Pro', 'Tahoma', sans-serif` garantit rendu. `getComputedStyle().fontFamily` retourne premiere font disponible. Test E2E Playwright avec route block Google Fonts.

---

## 19. Conformite MA (loi 09-08 + ACAPS + WCAG + Constitution Art 5)

### Loi 09-08 CNDP (Donnees personnelles)

- **Cookie NEXT_LOCALE non-PII** : la préférence de locale stockée en cookie n'est PAS Personally Identifiable Information au sens de la loi 09-08 article 1 paragraphe 3 (definit PII comme toute info se rapportant a une personne identifiée ou identifiable). Une préférence linguistique anonyme n'identifie pas l'utilisateur. Conséquence : pas de bannière consentement requise pour ce cookie, conforme article 82 directive ePrivacy équivalent MA et avis CNDP D-2018-001 sur les cookies strictement nécessaires au fonctionnement.

- **Consent marketing traduits** : les chaines `consent_marketing` et `consent_marketing_helper` dans `contacts.form` sont traduites dans les 3 locales. Le contact doit pouvoir lire son consentement marketing dans sa langue de préférence (loi 09-08 article 4 : consentement informé). Sprint 16 fournit les traductions, Sprint 8 (CRM) audit la collecte.

- **Anonymization labels traduits** : `bulk_actions.anonymize` et `delete_confirm` mentionnent loi 09-08 dans les 3 locales pour transparence vis-a-vis du courtier sur la conformité de l'action.

### Constitution MA Article 5

- **Multilinguisme officiel** : Constitution 2011 reconnaît arabe + tamazight comme langues officielles. Sprint 16 livre fr (langue admin de facto) + ar (officiel formel) + ar-MA (Darija pratique). Tamazight Tifinagh `tmz-MA` reservée Sprint 30+ (dépend de dossier IRCAM Institut Royal de la Culture Amazighe + cout traduction native + fonts Tifinagh).

- **Documents officiels bilingues** : la convention MA exige documents officiels bilingues FR/AR (administration, police, contrats commerciaux). Sprint 16 fournit le frontend trilingue, Sprint 17 (souscription) et Sprint 31 (reporting ACAPS) génereront les PDF bilingues FR/AR (police d'assurance + certificat).

### ACAPS (Autorité de Contrôle des Assurances et de la Prévoyance Sociale)

- **Rapports broker fr + ar** : ACAPS circulaire 03-21 article 8 exige que les rapports broker soient disponibles dans les deux langues officielles (fr + ar). Sprint 16 livre les chaines UI traduites. L'export PDF bilingue est livré Sprint 31.

- **Vocabulaire institutionnel ar** : le fichier `messages/ar.json` utilise le vocabulaire ACAPS-compatible (عقود pour polices, مكتتب pour souscripteur, قسط pour prime). Validation effectuée par traducteur native MA certifié.

- **Licence ACAPS dans parametres** : la chaine `parametres.general.acaps_license_label` est traduite dans les 3 locales pour permettre au broker_admin de configurer la référence licence ACAPS du tenant.

### WCAG 2.1 AA

- **SC 3.1.1 (Niveau A) Language of Page** : attribute `<html lang={locale}>` server-rendered conforme. Test axe-core vérifie sur 3 locales.

- **SC 3.1.2 (Niveau AA) Language of Parts** : sections avec contenu différent de la langue principale doivent avoir `<span lang="ar">arabic text</span>`. Sprint 16 applique sur les noms propres arabes affichés dans pages fr (ex: fiche contact où nom est en arabe). Composant `<BdiText lang="ar">{name}</BdiText>` utility.

- **SC 1.4.3 (Niveau AA) Contrast Minimum** : Noto Naskh Arabic rendered sur tokens couleur Sofidemy doit respecter ratio 4.5:1. Sprint 4 (1.4.16) a validé fr, Sprint 16 valide ar/ar-MA.

- **SC 2.4.6 (Niveau AA) Headings and Labels** : tous les `aria-label` et `aria-describedby` traduits. LocaleSwitcher button `aria-label={t('language')}`.

### Africa/Casablanca timezone

- **DST Ramadan 2026 mi-février à mi-mars** : `Intl.DateTimeFormat` browsers IANA tz database geren automatique. Test Vitest formatDate avec mock dates Ramadan vérifie -1h shift correct.

- **Format dd/MM/yyyy** : convention MA forcée pour les 3 locales. Pas de format yyyy-MM-dd ISO en affichage (sauf input HTML5 type=date).

---

## 20. Tests automatises (40+ tests)

### Unit tests Vitest -- formatters.spec.ts (25 tests)

```typescript
// repo/apps/web-broker/lib/i18n/__tests__/formatters.spec.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  formatDate,
  formatTime,
  formatDateTime,
  formatRelativeTime,
  formatDateRange,
  formatCurrency,
  formatNumber,
  formatPercent,
  formatCompactNumber,
  formatList,
  formatFileSize,
} from '../formatters';

describe('formatDate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-18T10:00:00Z'));
  });

  it('formats date fr dd/MM/yyyy', () => {
    expect(formatDate(new Date('2026-01-15T10:00:00Z'), 'fr')).toBe('15/01/2026');
  });

  it('formats date ar-MA dd/MM/yyyy', () => {
    expect(formatDate(new Date('2026-01-15T10:00:00Z'), 'ar-MA')).toBe('15/01/2026');
  });

  it('formats date ar dd/MM/yyyy', () => {
    expect(formatDate(new Date('2026-01-15T10:00:00Z'), 'ar')).toBe('15/01/2026');
  });

  it('handles invalid date', () => {
    expect(formatDate('invalid', 'fr')).toBe('');
  });

  it('formats with time when includeTime true', () => {
    const result = formatDate(new Date('2026-01-15T10:30:00Z'), 'fr', { includeTime: true });
    expect(result).toMatch(/15\/01\/2026 \d{2}:\d{2}/);
  });

  it('Africa/Casablanca timezone shifts UTC correctly post-Ramadan', () => {
    const result = formatDateTime(new Date('2026-04-01T10:00:00Z'), 'fr');
    expect(result).toBe('01/04/2026 11:00');
  });

  it('Africa/Casablanca timezone Ramadan DST -1h', () => {
    const result = formatDateTime(new Date('2026-03-01T11:00:00Z'), 'fr');
    expect(result).toBe('01/03/2026 11:00');
  });
});

describe('formatCurrency', () => {
  it('formats positive MAD fr with DH symbol', () => {
    expect(formatCurrency(1234.56, 'fr')).toBe('1 234,56 DH');
  });

  it('formats negative MAD fr', () => {
    expect(formatCurrency(-1234.56, 'fr')).toBe('-1 234,56 DH');
  });

  it('formats zero MAD', () => {
    expect(formatCurrency(0, 'fr')).toBe('0,00 DH');
  });

  it('formats ar with DH', () => {
    const result = formatCurrency(1234.56, 'ar');
    expect(result).toContain('1');
    expect(result).toContain('DH');
  });

  it('handles infinity gracefully', () => {
    expect(formatCurrency(Infinity, 'fr')).toBe('');
  });

  it('respects showSymbol option', () => {
    expect(formatCurrency(1234.56, 'fr', { showSymbol: false })).toBe('1 234,56');
  });

  it('respects fractionDigits option', () => {
    expect(formatCurrency(1234, 'fr', { fractionDigits: 0 })).toBe('1 234 DH');
  });
});

describe('formatNumber', () => {
  it('formats fr with comma decimal separator', () => {
    expect(formatNumber(1234.56, 'fr')).toBe('1 234,56');
  });

  it('formats arabic-indic numerals when option true', () => {
    const result = formatNumber(1234, 'ar', { useArabicIndicNumerals: true });
    expect(result).toMatch(/[٠-٩]/);
  });

  it('formats compact notation', () => {
    expect(formatNumber(1500000, 'fr', { notation: 'compact' })).toMatch(/1[,.]5 ?M/);
  });
});

describe('formatPercent', () => {
  it('formats percent fr', () => {
    expect(formatPercent(0.75, 'fr')).toMatch(/75 ?%/);
  });
});

describe('formatList', () => {
  it('formats fr conjunction', () => {
    expect(formatList(['Ahmed', 'Fatima', 'Hassan'], 'fr')).toContain('Ahmed');
    expect(formatList(['Ahmed', 'Fatima', 'Hassan'], 'fr')).toContain('et');
  });

  it('formats ar disjunction', () => {
    const result = formatList(['أحمد', 'فاطمة', 'حسن'], 'ar', 'disjunction');
    expect(result).toContain('أحمد');
  });

  it('handles single item', () => {
    expect(formatList(['Ahmed'], 'fr')).toBe('Ahmed');
  });

  it('handles empty array', () => {
    expect(formatList([], 'fr')).toBe('');
  });
});

describe('formatFileSize', () => {
  it('formats bytes', () => {
    expect(formatFileSize(500, 'fr')).toBe('500 B');
  });

  it('formats kilobytes', () => {
    expect(formatFileSize(2048, 'fr')).toMatch(/2[,.]0 KB/);
  });

  it('formats megabytes', () => {
    expect(formatFileSize(5242880, 'fr')).toMatch(/5[,.]0 MB/);
  });
});

describe('formatRelativeTime', () => {
  it('formats past date fr', () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    expect(formatRelativeTime(fiveMinutesAgo, 'fr')).toContain('minutes');
  });

  it('formats future date fr', () => {
    const inOneHour = new Date(Date.now() + 60 * 60 * 1000);
    expect(formatRelativeTime(inOneHour, 'fr')).toMatch(/heure/);
  });
});
```

### Unit tests Vitest -- pluralize.spec.ts (12 tests)

```typescript
// repo/apps/web-broker/lib/i18n/__tests__/pluralize.spec.ts
import { describe, it, expect } from 'vitest';
import { pluralize, formatPlural, getPluralCategory } from '../pluralize';

describe('getPluralCategory', () => {
  it('fr 0 -> one', () => {
    expect(getPluralCategory(0, 'fr')).toBe('one');
  });

  it('fr 1 -> one', () => {
    expect(getPluralCategory(1, 'fr')).toBe('one');
  });

  it('fr 2 -> other', () => {
    expect(getPluralCategory(2, 'fr')).toBe('other');
  });

  it('ar 0 -> zero', () => {
    expect(getPluralCategory(0, 'ar')).toBe('zero');
  });

  it('ar 1 -> one', () => {
    expect(getPluralCategory(1, 'ar')).toBe('one');
  });

  it('ar 2 -> two', () => {
    expect(getPluralCategory(2, 'ar')).toBe('two');
  });

  it('ar 3 -> few', () => {
    expect(getPluralCategory(3, 'ar')).toBe('few');
  });

  it('ar 11 -> many', () => {
    expect(getPluralCategory(11, 'ar')).toBe('many');
  });

  it('ar 100 -> few', () => {
    expect(getPluralCategory(100, 'ar')).toBe('few');
  });

  it('ar-MA falls back to ar rules', () => {
    expect(getPluralCategory(0, 'ar-MA')).toBe('zero');
    expect(getPluralCategory(2, 'ar-MA')).toBe('two');
  });
});

describe('pluralize', () => {
  it('returns zero form when ar count 0', () => {
    const result = pluralize(0, 'ar', {
      zero: 'لا توجد جهات اتصال',
      one: 'جهة اتصال واحدة',
      other: '# جهات اتصال',
    });
    expect(result).toBe('لا توجد جهات اتصال');
  });

  it('returns other when form missing fallback', () => {
    const result = pluralize(5, 'fr', { one: '1 element', other: '{count} elements' });
    expect(result).toBe('{count} elements');
  });
});

describe('formatPlural', () => {
  it('substitutes # placeholder with count', () => {
    const result = formatPlural(5, 'fr', { one: '1 element', other: '# elements' });
    expect(result).toBe('5 elements');
  });

  it('respects custom placeholder', () => {
    const result = formatPlural(5, 'fr', { one: '1 deal', other: '%count% deals' }, '%count%');
    expect(result).toBe('5 deals');
  });
});
```

### E2E Playwright tests -- i18n-locale-switch.spec.ts (15 tests)

```typescript
// repo/apps/web-broker/e2e/i18n-locale-switch.spec.ts
import { test, expect } from '@playwright/test';

test.describe('I18n locale switch', () => {
  test('Default redirect / to /fr', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/fr/);
  });

  test('Switch fr -> ar-MA preserves pathname', async ({ page }) => {
    await page.goto('/fr/dashboard');
    await page.getByRole('button', { name: /Francais|Language/i }).click();
    await page.getByRole('menuitem', { name: /Darija/i }).click();
    await expect(page).toHaveURL(/\/ar-MA\/dashboard/);
  });

  test('Switch ar-MA -> ar preserves pathname', async ({ page }) => {
    await page.goto('/ar-MA/contacts');
    await page.getByRole('button', { name: /Darija|اللغة/i }).click();
    await page.getByRole('menuitem', { name: /العربية/i }).click();
    await expect(page).toHaveURL(/\/ar\/contacts/);
  });

  test('LocaleSwitcher preserves searchParams', async ({ page }) => {
    await page.goto('/fr/contacts?page=3&segment=premium');
    await page.getByRole('button', { name: /Francais|Language/i }).click();
    await page.getByRole('menuitem', { name: /Darija/i }).click();
    await expect(page).toHaveURL(/\/ar-MA\/contacts\?page=3&segment=premium/);
  });

  test('LocaleSwitcher preserves hash', async ({ page }) => {
    await page.goto('/fr/contacts/123#timeline');
    await page.getByRole('button', { name: /Francais|Language/i }).click();
    await page.getByRole('menuitem', { name: /Darija/i }).click();
    await page.waitForURL(/\/ar-MA\/contacts\/123/);
    const url = new URL(page.url());
    expect(url.hash).toBe('#timeline');
  });

  test('HTML dir attribute rtl on ar', async ({ page }) => {
    await page.goto('/ar/dashboard');
    const dir = await page.locator('html').getAttribute('dir');
    expect(dir).toBe('rtl');
  });

  test('HTML dir attribute rtl on ar-MA', async ({ page }) => {
    await page.goto('/ar-MA/dashboard');
    const dir = await page.locator('html').getAttribute('dir');
    expect(dir).toBe('rtl');
  });

  test('HTML dir attribute ltr on fr', async ({ page }) => {
    await page.goto('/fr/dashboard');
    const dir = await page.locator('html').getAttribute('dir');
    expect(dir).toBe('ltr');
  });

  test('HTML lang attribute matches locale', async ({ page }) => {
    await page.goto('/ar-MA/dashboard');
    const lang = await page.locator('html').getAttribute('lang');
    expect(lang).toBe('ar-MA');
  });

  test('Cookie NEXT_LOCALE persists after switch', async ({ page, context }) => {
    await page.goto('/fr/dashboard');
    await page.getByRole('button', { name: /Francais|Language/i }).click();
    await page.getByRole('menuitem', { name: /Darija/i }).click();
    await page.waitForURL(/\/ar-MA/);
    const cookies = await context.cookies();
    const localeCookie = cookies.find((c) => c.name === 'NEXT_LOCALE');
    expect(localeCookie).toBeDefined();
    expect(localeCookie?.value).toBe('ar-MA');
  });

  test('Cookie persists across page reload', async ({ page }) => {
    await page.goto('/fr/dashboard');
    await page.getByRole('button', { name: /Francais|Language/i }).click();
    await page.getByRole('menuitem', { name: /Darija/i }).click();
    await page.waitForURL(/\/ar-MA/);
    await page.goto('/');
    await expect(page).toHaveURL(/\/ar-MA/);
  });

  test('Noto Naskh Arabic font loaded on ar', async ({ page }) => {
    await page.goto('/ar/dashboard');
    const fontFamily = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    expect(fontFamily).toMatch(/Noto Naskh|Geeza Pro|Tahoma/);
  });

  test('Currency MAD rendered as DH fr', async ({ page }) => {
    await page.goto('/fr/dashboard');
    const dashboardText = await page.textContent('main');
    expect(dashboardText).toMatch(/\d+([\s,]\d+)*[,.]?\d* DH/);
  });

  test('Date formatted dd/MM/yyyy fr', async ({ page }) => {
    await page.goto('/fr/polices');
    const tableText = await page.textContent('table');
    expect(tableText).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });

  test('Accept-Language fr-FR redirects to /fr', async ({ browser }) => {
    const context = await browser.newContext({ locale: 'fr-FR' });
    const page = await context.newPage();
    await page.goto('/');
    await expect(page).toHaveURL(/\/fr/);
    await context.close();
  });

  test('Accept-Language de-DE not supported falls to default fr', async ({ browser }) => {
    const context = await browser.newContext({ locale: 'de-DE' });
    const page = await context.newPage();
    await page.goto('/');
    await expect(page).toHaveURL(/\/fr/);
    await context.close();
  });
});
```

---

## 21. Conventions completes (Section 14 -- 20+ conventions)

1. **NO EMOJI ABSOLU** (decision-006) -- aucun emoji ni dans le code, ni dans les fichiers JSON messages, ni dans la documentation. Linter CI verifie via regex `[\x{1F600}-\x{1F6FF}]|[\x{2600}-\x{27BF}]`. Validation `pnpm i18n:lint --strict-emoji`.

2. **Naming convention namespaces JSON** : snake_case pour les cles (`auth.login.email_label` pas `auth.login.emailLabel`). Cohérent avec backend NestJS Sprint 3 qui utilise snake_case API. Exception : noms propres conservés tels quels.

3. **ICU MessageFormat patterns** : pour interpolation utiliser `{count}`, `{name}`, `{from}`, `{to}` (camelCase). Pour pluralization utiliser format `{count, plural, =0 {...} one {...} other {...}}`.

4. **Date format obligatoire dd/MM/yyyy** : convention MA pour les 3 locales. Pas de format ISO yyyy-MM-dd en affichage (sauf input HTML5).

5. **Currency MAD -> DH post-process** : convention utilisateurs MA préfèrent symbole DH. Helper `formatCurrency` post-process automatique.

6. **Timezone Africa/Casablanca obligatoire** : tous les formatters utilisent `toZonedTime(date, 'Africa/Casablanca')` de date-fns-tz. Gestion DST automatique (Ramadan -1h shift IANA tz db).

7. **Cookie NEXT_LOCALE SameSite=Lax** : pas Strict (casse iframe embeddable Sprint 18 customer-portal landing pages marketing).

8. **Cookie NEXT_LOCALE max-age 365j** : preference utilisateur persistante. Pas httpOnly (LocaleSwitcher doit lire côté client).

9. **Locale prefix toujours dans URL** : `localePrefix: 'always'`. Pas de mode `as-needed`. URL canonique inclut locale pour SEO hreflang.

10. **Fallback chain ar-MA -> ar -> fr** : implémenté via deepMerge dans `request.ts`. Cle manquante ar-MA tombe sur ar formel, puis fr en dernier recours.

11. **Pluralization arabe 6 catégories** : tester explicitement 0/1/2/3/11/100 dans les tests. CLDR rules natives Intl.PluralRules.

12. **Tailwind 4 logical properties uniquement** : utiliser `ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*` jamais `ml-*`, `mr-*`, `pl-*`, `pr-*`, `left-*`, `right-*`. ESLint rule custom Sprint 16.

13. **Icones flip RTL** : utiliser composant `<IconFlip icon={ChevronRight} />` ou utility class `rtl-flip`. Jamais hardcode `rotate-180` car casse en LTR.

14. **BDI pour noms propres bilingues** : `<bdi lang="ar">{arabicName}</bdi>` dans contexte fr. Évite inversion ordre BiDi.

15. **Lang attribute sur sections changement langue** : `<span lang="ar">contenu arabe</span>` dans pages fr (WCAG SC 3.1.2 AA).

16. **TypeScript strict types AppMessages** : types auto-generes depuis fr.json (source of truth). Autocomplete VSCode + erreur compile si cle manquante.

17. **`useT` hook wrapper typed** : préférer `useT('namespace')` à `useTranslations('namespace')` pour typage strict.

18. **Server vs client async** : `getTranslations` async côté Server Component, `useTranslations`/`useT` côté Client Component. Imports asymétriques.

19. **Lint translations CI** : `pnpm i18n:lint` execute en pre-commit Husky + CI GitHub Actions. Exit 1 si divergence cles. Rapport markdown `.cache/i18n-coverage.md`.

20. **Storybook story LocaleSwitcher** : story avec controls 3 locales (deferred Sprint 27 si manque temps).

21. **No emoji dans JSON messages** : validation `grep -rP "[\x{1F600}-\x{1F6FF}]" messages/` exit 1.

22. **Verbes au passif fr** : registre commercial professionnel ("Enregistrer" pas "Sauve", "Confirmer" pas "OK").

23. **Darija familiar but professional** : tutoiement implicite acceptable mais pas argotique. Verbes conjugués correctement.

24. **Arabe classique formel pour ar** : registre administratif/juridique compatible ACAPS et conditions générales polices.

25. **Placeholders cohérents** : `{count}` pour quantités, `{name}` pour noms, `{date}` pour dates, `{amount}` pour montants. Toujours camelCase à l'intérieur des accolades.

---

## 22. Stack technique resume

| Composant | Version | Notes |
|-----------|---------|-------|
| next | 15.0.4 | App Router |
| next-intl | 3.26.3 | i18n routing + middleware + RSC. v4 reservée Sprint 27 migration |
| date-fns | 4.1.0 | Date formatting locale-aware |
| date-fns-tz | 4.x | Timezone Africa/Casablanca + Ramadan DST |
| Intl.NumberFormat | native browser | Currency MAD + chiffres |
| Intl.PluralRules | native browser | CLDR 6 categories arabe |
| Intl.ListFormat | native browser | Conjunction/disjunction |
| Intl.RelativeTimeFormat | native browser | Relative time |
| Noto Naskh Arabic | Google Fonts | Font arabe 400/700 subsetting arabic |
| Geist Sans | local | Font latine Sprint 4 |
| Tailwind CSS | 4.0.0-beta.4 | Logical properties natif |
| shadcn/ui | latest | DropdownMenu, AlertDialog RTL-aware |
| lucide-react | latest | Icons (chevrons flippables RTL) |

**Risques stack** :
- `next-intl@3.26.3` LTS Q3 2026 -- migration v4 plannifiée Sprint 27 (codemod 2h).
- `Tailwind 4.0.0-beta.4` -- stable Q2 2026. Sprint 16 surveille release candidate.

---

## 23. Risques et Mitigations

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Traductions ar-MA incorrectes (Darija) | Moyenne | Moyen | Validation native MA speaker Sprint 16 + review designer Sprint 16.4.3.14 |
| Traductions ar formelles non-ACAPS-compatible | Faible | Eleve | Validation par juriste MA + cross-check Sprint 31 reporting ACAPS |
| Font Noto Naskh failed CDN load | Faible | Moyen | Fallback chain (Geeza Pro, Tahoma) + test E2E network throttle |
| Hydration mismatch dir attribute | Faible | Eleve | Calcul deterministic dir depuis route segment params.locale |
| Cookie SameSite=Lax break iframe Sprint 18 | Faible | Moyen | Sprint 18 audit iframe context + ajuster si besoin |
| Pluralization Darija ambiguous | Moyenne | Faible | Collapse few/many vers other dans messages/ar-MA.json |
| DST Ramadan 2026 IANA tz db outdated | Faible | Eleve | Test Vitest dates Ramadan + browsers Chrome/Firefox latest mandatory |
| Lint translations false positives | Moyenne | Faible | Script handle pluralisation patterns specifiquement |

---

## 24. Definition of Done (DoD)

- [ ] Les 3 fichiers messages/{fr,ar-MA,ar}.json créés avec parité stricte (script lint exit 0).
- [ ] LocaleSwitcher operationnel : préserve pathname + searchParams + hash + cookie persist 365j.
- [ ] Helpers formatters complets : formatDate/Time/Currency/Number/List/Plural locale-aware Africa/Casablanca.
- [ ] CSS RTL appliqué : `<html dir="rtl">` sur ar/ar-MA, Tailwind 4 logical properties, icones flippes.
- [ ] Font Noto Naskh Arabic chargee conditionnellement sur locales ar/ar-MA.
- [ ] 12 pages web-broker traduites 100% (smoke test E2E pas de pattern `[namespace.key]`).
- [ ] Lighthouse Accessibility >= 95 sur fr/ar-MA/ar dashboard.
- [ ] 40+ tests passent : Vitest unit + Playwright E2E.
- [ ] TypeScript typecheck exit 0 avec AppMessages auto-générés.
- [ ] CI step `pnpm i18n:lint` exit 0 + Husky pre-commit configuré.
- [ ] No emoji dans aucun fichier (grep validation).
- [ ] WCAG 2.1 AA conforme : lang attribute + contraste Noto Naskh + ARIA labels traduits.
- [ ] Documentation README lib/i18n/README.md publiée.

---

## 25. Notes finales pour le developpeur

**Ordre execution recommande** :
1. Créer `messages/fr.json` canonique en premier (source of truth).
2. Traduire `messages/ar.json` (arabe classique) deuxième -- base la plus formelle.
3. Traduire `messages/ar-MA.json` (Darija) en dernier -- registre familier dérivé de ar.
4. Implémenter `lib/i18n/routing.ts` + `request.ts` + `types.ts` + `formatters.ts` + `pluralize.ts` + `use-translations.tsx`.
5. Étendre `components/layout/locale-switcher.tsx` avec préservation searchParams + hash + forms dirty protection.
6. Ajouter CSS RTL dans `app/globals.css`.
7. Étendre `app/[locale]/layout.tsx` avec font Noto Naskh conditionnelle.
8. Créer composant `components/ui/icon-flip.tsx`.
9. Écrire les tests Vitest (formatters, pluralize, types).
10. Écrire les tests Playwright (locale-switch, RTL, cookie persist).
11. Configurer scripts CI (lint, husky, github actions).
12. Documentation README.

**Pieges courants a eviter** :
- Ne PAS utiliser `ml-*`/`mr-*` Tailwind (utiliser `ms-*`/`me-*`).
- Ne PAS calculer `dir` depuis cookie côté server (utiliser uniquement params.locale).
- Ne PAS oublier `lang={locale}` attribute sur `<html>`.
- Ne PAS oublier `<bdi lang="ar">` pour noms arabes en contexte fr.
- Ne PAS oublier de wrapper children dans `<NextIntlClientProvider>` dans layout.
- Ne PAS oublier de tester switch locale mid-form submit (forms dirty case).
- Ne PAS oublier de tester preservation hash sur switch locale.

**Etapes de test manuel post-development** :
1. Demarrer app : `pnpm --filter @insurtech/web-broker dev`.
2. Naviguer `/fr/dashboard` -> verifier UI en fr, dir=ltr.
3. Click LocaleSwitcher -> ar-MA -> verifier UI en Darija, dir=rtl, font Noto Naskh.
4. Click LocaleSwitcher -> ar -> verifier UI en arabe formel.
5. Navigate `/fr/contacts?page=3&segment=premium#contact-12` -> switch ar -> verifier URL preserve.
6. Reload page -> verifier cookie persist -> reste sur ar.
7. Click submit form contact (formState.isDirty) puis switch locale -> verifier AlertDialog confirmation.
8. Tester block Google Fonts dans devtools -> verifier fallback Geeza Pro.
9. Inspector DOM -> verifier `<html lang="ar" dir="rtl" class="font-noto-naskh">`.
10. Lighthouse audit Accessibility >= 95 sur 3 locales.

**Communication avec equipe** :
- Si traduction ar-MA incertaine, demander validation native MA speaker (designer Skalean ou freelance).
- Si traduction ar formelle ACAPS-incompatible, escalader juriste MA pour review.
- Si performance Lighthouse < 95, optimiser font preload + lazy load locales non actives.

**Reference Sprint 4 Tache 1.4.11** : i18n cross-apps pattern canonique. Web-broker Sprint 16 reuse les helpers shared-ui + ajoute traductions metier specifiques.

---

**Fin de la tache 4.3.13 -- I18n Complete fr / ar-MA / ar avec RTL + Locale Switcher Operational.**

**Sprint 16 progresse** : 13/14 taches terminees. Reste Tache 4.3.14 (Tests E2E Playwright + a11y) pour cloturer le sprint.
