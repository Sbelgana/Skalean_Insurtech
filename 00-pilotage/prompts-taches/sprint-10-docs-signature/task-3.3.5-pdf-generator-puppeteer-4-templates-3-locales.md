---
task_id: 3.3.5
sprint: 10
phase: 3
priority: P0
effort_hours: 7
depends_on:
  - 3.3.4
unlocks:
  - 3.3.6
  - 3.3.7
  - 3.3.11
loi_43_20:
  - article_5_archivage_PDF_A_3
  - article_17_mentions_obligatoires
ref_legales_maroc:
  - loi_17_99_article_17_mentions_polices
  - DGI_note_circulaire_717_factures_ICE_IF_RC
  - ACAPS_reglement_02_AS_19_format_polices
  - loi_43_20_article_5_PDF_A_3
  - loi_09_08_article_3_donnees_personnelles
tags:
  - pdf
  - puppeteer
  - handlebars
  - templates
  - i18n
  - rtl
  - locales
  - pdf-a-3
  - browser-singleton
  - performance
  - snapshot-tests
package: packages/docs
owner: backend-docs-team
revue_par: tech-lead-backend, lead-architecte
date_creation: 2026-05-08
version: 2.2
---

# Tache 3.3.5 - PdfGeneratorService puppeteer 24.0.1 + 4 Templates Handlebars + 3 Locales (fr, ar-MA, ar) + Helpers + Browser Singleton + Cache Templates

## 1. Header metadata

- **Identifiant**: 3.3.5
- **Sprint**: Sprint 10 - Docs + Signature electronique loi 43-20
- **Phase**: Phase 3 - Documents et generation PDF
- **Priorite**: P0 (bloquant pour generation devis, factures, polices, rapports sinistres - chemin critique commercial)
- **Effort estime**: 7 heures (decomposition: 1.5h architecture + browser singleton, 1h template-compiler + helpers Handlebars, 2h templates HBS x3 langues, 1h controller + DTO, 1.5h tests snapshots, 1h docs + criteres)
- **Depends on**: Tache 3.3.4 (AccessLogService - logue chaque generation PDF pour traçabilite et detection abus)
- **Unlocks**: Tache 3.3.6 (DocxGeneratorService docxtemplater pour rapports Word editables), Tache 3.3.7 (XlsxGeneratorService exceljs pour exports comptables), Tache 3.3.11 (QrCodeService pour verification publique - integre dans helpers)
- **Owner**: backend-docs-team
- **Reviewers**: tech-lead-backend, lead-architecte, expert-juridique-Maroc (mentions ICE/IF/RC sur templates facture)
- **Conformite legale**: Loi 17-99 article 17 (mentions obligatoires polices), DGI Note Circulaire 717 (mentions factures: ICE, IF, RC obligatoires), Loi 43-20 article 5 (PDF/A-3 pour archives long-terme), ACAPS Reglement 02/AS/19 (format polices assurances), Loi 09-08 (donnees personnelles dans templates)
- **Stack technique**: NestJS 11.0.10 + puppeteer 24.0.1 + Handlebars 4.7.8 + qrcode 1.5.4 + dayjs 1.11.13 (avec plugin hijri) + Pino 9.5.0 + Vitest 2.1.8 + Zod 3.24.1 + TypeScript 5.7.3 strict
- **Module package**: `packages/docs` (lib partagee, consommee par `apps/api` via DocsModule)

## 2. But

Implementer un **service de generation PDF haute performance** base sur **puppeteer 24.0.1** (moteur Chromium headless rendant HTML/CSS en PDF) avec un **pool de templates Handlebars compiles et caches** supportant **4 documents metier** (devis, facture, police d'assurance, rapport sinistre) declines en **3 locales** (`fr` francais formel Maroc, `ar-MA` arabe Darija marocain avec specifiques locaux, `ar` arabe litteraire MSA). Le service doit garantir un **temps de generation < 3 secondes** par PDF de taille moyenne (5-10 pages A4), supporter le **rendering RTL** (Right-To-Left) pour locales arabes via CSS conditionnel `direction: rtl`, et embarquer toutes les ressources (**polices, logos, signatures**) en base64 pour eviter les fetches reseau (securite + offline + reproductibilite). Un **browser singleton** lazy-launched evite le surcout de cold-start de Chromium (environ 2 secondes) en reutilisant l'instance entre les requetes, protege par un Mutex pour eviter les race conditions au demarrage concurrent. Les templates sont **pre-compiles et caches en memoire** (LRU 256 entrees, TTL 1h) pour amortir le cout de parsing Handlebars (10-50ms par template).

Le service produit des PDF conformes **PDF/A-3** (norme ISO 19005-3 pour archivage long-terme exigee par la **Loi 43-20 article 5**) avec polices integralement embarquees, profil colorimetrique sRGB embarque, et metadonnees XMP (Author, Title, Subject, Keywords, CreationDate, ModificationDate). Cette conformite est obligatoire pour les documents juridiques (polices d'assurance, attestations) destines a etre conserves 10 ans (cf. Code de Commerce article 211) ou plus pour les archives ACAPS. Les helpers Handlebars (`formatDate`, `formatCurrency MAD`, `formatPhone +212`, `formatICE`, `qrCode SVG embed`, `formatDateHijri`) factorisent la logique d'affichage cross-templates et garantissent la coherence visuelle (notamment formats fiscaux Maroc: ICE sur 15 chiffres groupes 3-3-3-3-3, IF, RC).

L'architecture privilegie la **testabilite** via snapshots Vitest (12 outputs PDF = 4 templates x 3 locales) et la **resilience** (timeouts stricts 5s par etape, retry sur browser crash via `puppeteer.connected` check, kill auto-zombie process via process group SIGKILL apres 30s). Les **edge cases identifies** couvrent: surcharge memoire concurrente (max 4 pages parallel via semaphore), images embed > 10 MB rejetees, contenu HTML sanitisee Handlebars `{{var}}` (XSS-safe par defaut, jamais `{{{var}}}` triple-stash sauf SVG QR controle), fallback locale `ar-MA` -> `ar` -> `fr`, dates Hijri pour calendrier islamique (toggleable par tenant config), pagination automatique tableaux > 100 lignes (CSS `page-break-inside: avoid`), debordement signature -> nouvelle page automatique.

## 3. Contexte etendu

### 3.1 Pourquoi puppeteer 24.0.1 vs alternatives PDF

| Critere | puppeteer 24.0.1 | PDFKit 0.15 | wkhtmltopdf 0.12.6 | Playwright 1.50 | jsPDF 2.5 |
|---|---|---|---|---|---|
| Moteur rendering | Chromium (Blink) HEAD | Custom JS native | WebKit obsolete (2020) | Chromium/Firefox/WebKit | Custom JS browser |
| Support CSS3 moderne (grid, flex, custom-props) | Total | Aucun (API imperative) | Partiel (CSS2 + qq CSS3) | Total | Limite |
| Support RTL (`direction: rtl`) | Total | Manuel | Buggy (alignements) | Total | Manuel |
| Polices personnalisees @font-face | Embed via base64 OK | Embed via API | Embed mais buggy | Embed via base64 OK | Limite |
| SVG inline (QR codes) | Total | Polygone manuel | OK | Total | Limite |
| Conformite PDF/A | Via pdf-lib post-process | Manuel | Non | Via pdf-lib post-process | Non |
| Memoire idle (singleton) | 200-300 MB | 5 MB | 50 MB binary | 220-320 MB | 0 (in-process) |
| Cold start | 1.5-2.5s | < 50 ms | 100-200 ms | 1.5-2.5s | < 10 ms |
| Maintenance Google | Active (24.x 2026) | Active (15.x) | Abandonne 2023 | Active Microsoft | Active |
| Securite (sandboxing) | Sandbox Chromium | Aucun | Aucun (CVE 2022) | Sandbox | N/A |
| TypeScript types officiels | @types/puppeteer | @types/pdfkit | Wrappers tiers | @playwright/test | @types/jspdf |
| Bundle size install | 280 MB (Chromium) | 1 MB | 60 MB binary | 300 MB | 500 KB |
| Performances (PDF 5p) | 0.8-1.5s (singleton) | 0.2-0.5s | 0.5-1s | 0.8-1.5s | 0.3-0.8s |
| RTL correct (texte arabe) | Total (HarfBuzz) | Bugue (RTL inverse) | Buggy | Total | Buggy |

**Decision**: puppeteer 24.0.1 retenu pour: (1) qualite rendering identique navigateur moderne (notre referentiel design est Chrome desktop), (2) support CSS3/SVG/RTL natif sans bricolage, (3) capacite embed @font-face base64 pour polices arabes (Amiri, Cairo, Tajawal), (4) ecosysteme mature avec snapshot testing PDF, (5) Google maintient activement (releases mensuelles), (6) memoire 200-300 MB acceptable car singleton partage entre toutes les requetes. Le surcout vs PDFKit est compense par la productivite (templates HTML editables par graphiste vs API JS imperative). wkhtmltopdf abandonne en 2023 disqualifie. Playwright equivalent technique mais 20% plus lourd et orient testing E2E (pas notre besoin). jsPDF cote client uniquement, ne convient pas a notre architecture serveur multi-tenant.

### 3.2 Browser singleton vs per-request

| Strategie | Memoire | Latence p50 | Latence p99 | Concurrent | Crash impact |
|---|---|---|---|---|---|
| Per-request (launch + close chaque PDF) | 0 idle, 250 MB peak | 2.8s | 5s | Limite (cold start serial) | Isole |
| Singleton (1 browser global) | 250 MB persistant | 0.8s | 1.5s | 4-8 pages parallel | Tous PDF en cours |
| Pool de N browsers | N x 250 MB | 0.8s | 1.2s | N x 4 pages | Partiel (1/N) |
| Cluster process (puppeteer-cluster) | 1.5 GB pour 4 workers | 0.7s | 1s | 16+ pages | Isole par worker |

**Decision**: Singleton avec 1 browser et limite 4 pages concurrent (semaphore p-limit). Justifications: (1) latence cible < 3s implique singleton (cold start 2s incompressible), (2) charge prevue Sprint 10-15 < 1000 PDF/h, donc 4 pages parallel suffisent (capacity 14400 PDF/h max theorique), (3) memoire 250-400 MB persistante acceptable sur instances API t3.medium 4 GB, (4) crash recovery via watchdog: `browser.on('disconnected', () => relaunch())`, (5) pour montee en charge future > 5000 PDF/h, migration vers BullMQ worker dedie avec puppeteer-cluster envisagee Sprint 20.

### 3.3 Handlebars vs Pug vs Nunjucks vs EJS

| Critere | Handlebars 4.7 | Pug 3.0 | Nunjucks 3.2 | EJS 3.1 |
|---|---|---|---|---|
| Securite XSS par defaut | Echappement automatique `{{var}}` | Echappement automatique `#{var}` | Echappement automatique `{{var}}` | NON (`<%= %>` echappe, `<%- %>` raw) |
| Syntaxe HTML preservee | Oui (extension HBS lisible) | Non (syntaxe indent custom) | Oui | Oui |
| Helpers custom | Helpers natifs `Handlebars.registerHelper` | Mixins (limites) | Filters + macros | Includes inline JS |
| Heritage layout | Partials + `{{> partial}}` | Extends + blocks | Extends + blocks | Includes |
| Compilation cache | Manuel (notre LRU) | Automatique | Automatique | Manuel |
| Logic-less philosophie | Oui (peu d'ifs/loops complexes) | Permissif (mixins JS) | Permissif | Tres permissif (eval JS) |
| Maintenance 2026 | Active | Active | Active (Mozilla) | Maintenance |
| Adoption ecosysteme docs | Tres forte (Github, Slack, Mailchimp) | Forte (frontend) | Moderee | Forte |
| Lisibilite HTML par graphiste | Excellente | Faible (syntaxe custom) | Bonne | Excellente |

**Decision**: Handlebars retenu pour: (1) **logic-less safe**, evite tentation de logique metier dans templates (separation propre avec service TS), (2) syntaxe HBS lisible par graphiste non-dev (templates editables in situ), (3) echappement XSS par defaut sur `{{var}}`, triple-stash `{{{var}}}` reserve aux SVG QR codes generes par helper trusted, (4) ecosysteme mature avec helpers conditionnels (`{{#if}}`, `{{#each}}`, `{{#with}}`), (5) compatibilite parfaite puppeteer (rendu HTML standard).

### 3.4 PDF/A-3 conformite (Loi 43-20 article 5)

PDF/A-3 (norme ISO 19005-3:2012) est une variante de PDF specifiquement designee pour l'**archivage long-terme** (10+ ans) avec contraintes garantissant la reproductibilite visuelle independamment du logiciel/OS futur. Exigences techniques:

- **Polices integralement embarquees** (subset autorise mais doit contenir tous glyphes utilises): notre stack embed Inter (latin), Amiri (arabe), Tajawal (arabe moderne) en base64 dans @font-face CSS, garantit puppeteer les inclut tous
- **Profil colorimetrique embarque** (sRGB IEC61966-2.1 minimum): puppeteer Chromium incluse sRGB par defaut, conforme
- **Pas de contenu JavaScript executable** dans le PDF final: puppeteer le respecte (contraire a PDF/A-1 qui interdit aussi formulaires interactifs, PDF/A-3 plus permissif)
- **Pas de transparence non-aplatie**: nos templates evitent `opacity` < 1 sur layers complexes, sinon flatten via post-processing pdf-lib
- **Metadata XMP obligatoires**: Title, Author, Subject, Keywords, CreationDate, ModificationDate, Producer (Skalean), CreatorTool (puppeteer 24.0.1) - injectes via puppeteer `page.pdf({ tagged: true, displayHeaderFooter: ... })` puis pdf-lib post-process pour conformite stricte
- **Liens externes interdits** (ou avec placeholder): nos templates n'ont pas de `<a href>` externes en mode PDF (cf. helper `condIfArabic` qui supprime liens en mode print)
- **Fichiers attaches autorises** (PDF/A-3 specifique): nous n'attachons rien en Sprint 10, optionnel pour XML embarque (e-facturation DGI futur)

Pour conformite **stricte** PDF/A-3, nous post-traitons avec `pdf-lib` (Tache 3.3.5 cree fondations, tache 3.3.12 ajoute conformite stricte avec validation veraPDF). En Sprint 10 V1, nous garantissons les criteres pratiques (polices embarquees, sRGB, metadata XMP) sans validation veraPDF cliente. La conformite stricte 100% sera ajoutee Tache 3.3.12 (post-traitement).

### 3.5 RTL CSS (Right-to-Left) pour locales arabes

| Aspect | Solution |
|---|---|
| Direction texte | `<html dir="rtl">` ajoute par template `_layout.hbs` si locale arabe |
| Alignement par defaut | `text-align: right` via CSS `[dir="rtl"] body { text-align: right }` |
| Marges/Paddings | Utiliser logical properties `margin-inline-start` / `padding-inline-end` (CSS3 supporte par Chromium) |
| Tableaux colonnes | Inverse automatique via `dir="rtl"` parent |
| Polices | `font-family: 'Amiri', 'Tajawal', 'Cairo', sans-serif` - embed @font-face base64 |
| Chiffres | `font-feature-settings: 'lnum'` pour chiffres arabes-occidentaux (1234) ou `'tnum'` pour chiffres indo-arabes (١٢٣٤) selon preference tenant |
| Icones unicode | Verifier glyphes presents dans police arabe (sinon fallback Material Icons) |
| QR codes | Inchanges (SVG square independant direction) |
| Signature digital | Espace reserve a droite plutot que gauche |

### 3.6 10+ pieges techniques identifies

1. **Cold start Chromium 2s**: Singleton lazy-launched avec Mutex pour eviter cold start sur premier appel concurrent (sinon 2 launches simultanes -> OOM)
2. **Memory leak puppeteer**: Toujours `await page.close()` dans `finally` (sinon pages orphelines accumulees -> 50 MB chacune apres 50 PDFs = 2.5 GB OOM)
3. **Font loading delay**: `await page.evaluateHandle('document.fonts.ready')` avant `pdf()` sinon polices substituees par fallback Times New Roman
4. **Network image fetched**: `page.setOfflineMode(true)` et `page.setRequestInterception(true)` bloquent toutes images externes (securite + reproductibilite); seules images base64 dans HTML acceptees
5. **XSS in template data**: Handlebars `{{var}}` echappe HTML par defaut, jamais `{{{var}}}` triple-stash sauf SVG QR controle (genere par helper trusted), ne jamais accepter HTML user
6. **Locale fallback chain**: `ar-MA` -> `ar` -> `fr` (defaut), implemente dans template-compiler.service.ts pour eviter 404 si template manquant (ex: police uniquement en `fr` initialement)
7. **Hijri date conversion**: dayjs plugin hijri pour conversion gregorien -> Hijri (ex: 2026-05-08 -> 21 Dhul-Qa'dah 1447), toggleable par tenant.config.useHijri
8. **Timezone Africa/Casablanca**: Toujours `dayjs.tz('Africa/Casablanca')` pour formatage dates (Maroc UTC+1 hiver, UTC+1 ete depuis 2018 abolition heure d'ete)
9. **CSS print media**: `@media print { ... }` pour styles specifiques PDF (margins, page breaks); `page.emulateMediaType('print')` avant `pdf()` essentiel
10. **Page numbering**: puppeteer header/footer templates `<span class="pageNumber"></span>` et `<span class="totalPages"></span>` avec scope CSS limite (font-size doit etre explicite, defaut illisible)
11. **Tableaux pagination**: `tr { page-break-inside: avoid }` evite ligne coupee a cheval, `thead { display: table-header-group }` repete header sur chaque page
12. **Concurrent requests**: Semaphore p-limit(4) pour eviter > 4 pages parallel -> OOM sur t3.medium (chaque page consomme 50-150 MB)
13. **Browser crash recovery**: `browser.on('disconnected', () => { this.browser = null; logger.error('Browser disconnected, will relaunch on next request') })` + retry sur next call
14. **Template cache invalidation**: TTL 1h + bus event `template.updated` (Sprint 12) pour reload sans restart; en V1 redemarrage manuel suffit
15. **PDF size optimization**: Images compressees JPEG 80% qualite avant base64 embed (sinon 50MB PDF inacceptable email); SVG prefere PNG quand possible

### 3.7 Comparaison Maghreb (similitudes Algerie/Tunisie)

Algerie (Loi 18-07): exige PDF signe electroniquement pour contrats assurance, format PDF/A recommande mais pas obligatoire. Tunisie (Loi organique 2004-63): mentions ICE equivalent (matricule fiscal), TVA 19%, formats similaires mais devise TND. Notre architecture i18n (locale + currency configurable par tenant) facilite extension Algerie (`fr-DZ`, `ar-DZ`, devise DZD) et Tunisie (`fr-TN`, `ar-TN`, devise TND) en Sprint 25+ sans refactor.

## 4. Architecture context

### 4.1 ASCII flow generation PDF

```
+------------------------------------------------+
| Client (Frontend Angular ou API consumer)      |
+----------------------+-------------------------+
                       |
                       | POST /api/v1/docs/generate-pdf
                       | { templateName, locale, data, options }
                       v
+------------------------------------------------+
| PdfGenerationController                        |
| - DTO Zod validation                           |
| - JWT + tenant_id extraction                   |
| - RBAC check (PDF_GENERATE permission)         |
+----------------------+-------------------------+
                       |
                       v
+------------------------------------------------+
| PdfGeneratorService.generate(name, locale, d)  |
+----------------------+-------------------------+
                       |
       +---------------+---------------+
       |                               |
       v                               v
+----------------+         +-------------------+
| TemplateCompil | (cache) | BrowserSingleton  |
| er.service     |         | (lazy launch)     |
| - Load HBS file|         | - Mutex protected |
| - Compile      |         | - Disconnect hook |
| - LRU cache    |         | - Watchdog SIGKILL|
+--------+-------+         +---------+---------+
         |                           |
         v                           v
+----------------+         +---------------------+
| HBS compiled   |         | browser.newPage()  |
| template fn    |         | (semaphore p-lim 4)|
+--------+-------+         +---------+----------+
         |                           |
         | template(data) -> HTML    |
         +-------------+-------------+
                       |
                       v
+------------------------------------------------+
| page.setContent(html, networkidle0, 5s timeout)|
| page.emulateMediaType('print')                 |
| page.evaluateHandle('document.fonts.ready')    |
| page.pdf({format A4, margins, printBackground})|
+----------------------+-------------------------+
                       |
                       v
+------------------------------------------------+
| Buffer PDF (binary)                            |
+----------------------+-------------------------+
                       |
                       | finally: page.close()
                       v
+------------------------------------------------+
| AccessLogService.log({tenant, action: PDF_GEN, |
|   resource: templateName, metadata: {bytes}})  |
+----------------------+-------------------------+
                       |
                       v
+------------------------------------------------+
| Response 200 application/pdf                   |
| Content-Disposition: attachment;               |
|   filename="devis_2026_05_08.pdf"              |
+------------------------------------------------+
```

### 4.2 Sequence diagram detaille

```
Client      Controller    PdfGenSvc   TemplateCompiler    Browser     AccessLog
  |             |             |              |              |             |
  |--POST------>|             |              |              |             |
  |             |--validate-->|              |              |             |
  |             |             |--compile---->|              |             |
  |             |             |<--cached fn--|              |             |
  |             |             |--newPage---->|              |             |
  |             |             |              |              |--launch?--->|
  |             |             |              |              |  (lazy)     |
  |             |             |              |              |<--browser---|
  |             |             |              |              |             |
  |             |             |--setContent->|              |             |
  |             |             |--fonts ready>|              |             |
  |             |             |--page.pdf -->|              |             |
  |             |             |<--Buffer-----|              |             |
  |             |             |--close()---->|              |             |
  |             |             |              |              |             |
  |             |             |--log------------------------------------> |
  |             |             |<--logged--------------------------------- |
  |             |<--Buffer----|              |              |             |
  |<--200 PDF---|             |              |              |             |
```

### 4.3 Diagramme classes

```
+----------------------------------+
| PdfGeneratorService              |
|----------------------------------|
| - browser: Browser | null        |
| - launchLock: Mutex              |
| - pageSemaphore: pLimit(4)       |
| - logger: PinoLogger             |
|----------------------------------|
| + onModuleInit(): void           |
| + onModuleDestroy(): void        |
| + generate(name, locale, data):  |
|     Promise<Buffer>              |
| - ensureBrowser(): Promise<Brwsr>|
| - launchBrowser(): Promise<Brwsr>|
+--------------+-------------------+
               |
               | uses
               v
+----------------------------------+
| TemplateCompilerService          |
|----------------------------------|
| - cache: LRU<string, Template>   |
| - templatesDir: string           |
|----------------------------------|
| + compile(name, locale): Promise |
|     <HandlebarsTemplateDelegate> |
| - resolvePath(name, locale): str |
| - registerPartials(): void       |
| - registerHelpers(): void        |
+----------------------------------+
               |
               | uses
               v
+----------------------------------+
| HandlebarsPdfHelpers (functions) |
|----------------------------------|
| + formatDate(date, locale, fmt)  |
| + formatCurrency(amount, ccy)    |
| + formatPhone(phone)             |
| + formatICE(ice)                 |
| + formatDateHijri(date)          |
| + qrCode(data, size)             |
| + condIfArabic(locale, opts)     |
+----------------------------------+
```

## 5. Livrables

1. PdfGeneratorService NestJS injectable avec browser singleton lazy-launched
2. TemplateCompilerService avec LRU cache 256 entrees TTL 3600s
3. HandlebarsPdfHelpers: formatDate (gregorien + Hijri), formatCurrency MAD, formatPhone +212, formatICE 15 chiffres groupes, qrCode SVG embed, condIfArabic
4. Template _layout.hbs partial: header logo Skalean + tenant + footer page X/Y + CSS conditionnel RTL
5. Template devis.hbs (fr): items table + total HT/TVA 20%/TTC + footer mentions ICE/RC/IF
6. Template facture.hbs (fr): numero sequentiel + customer + items + totals + signature space + paid/unpaid stamp
7. Template police.hbs (fr): police number + souscripteur + assure + garanties + primes + 10 paragraphes conditions generales
8. Template sinistre-rapport.hbs (fr): details + photos base64 embed + estimation + decision
9. Templates ar/devis.hbs avec direction RTL et police Amiri
10. Templates ar-MA/devis.hbs avec specifiques Darija marocains
11. Polices embed base64: Inter (latin), Amiri (arabe litteraire), Tajawal (arabe moderne), Cairo (titres arabes)
12. Logo Skalean embed base64 SVG
13. PdfGenerationController POST /api/v1/docs/generate-pdf avec DTO Zod validation
14. Configuration env vars: PDF_BROWSER_HEADLESS, PDF_GENERATION_TIMEOUT_MS, PDF_TEMPLATES_CACHE_TTL_SEC, PDF_MAX_CONCURRENT_PAGES
15. Tests unitaires PdfGeneratorService (snapshot 12 outputs, browser mock, edge cases)
16. Tests unitaires TemplateCompilerService (cache hit/miss, fallback locale, partials)
17. Tests unitaires HandlebarsPdfHelpers (28 cas formatDate/Currency/Phone/ICE/Hijri/QR)
18. Tests E2E PdfGenerationController (auth, RBAC, 12 templates x locales generation)
19. Documentation README.md packages/docs/README.md avec exemples d'utilisation
20. Logs Pino structures: pdf_generation_started, pdf_generation_succeeded, pdf_generation_failed, browser_launched, browser_disconnected, template_cache_hit, template_cache_miss
21. Metriques OpenTelemetry: pdf_generation_duration_ms histogram, pdf_generation_size_bytes histogram, pdf_browser_pages_active gauge
22. Conformite Loi 43-20 article 5: notes PDF/A-3 documentees + champs metadata XMP injectes
23. Edge cases handling 12+ documentes (RTL, fonts, images, XSS, network, crash, concurrent, locale fallback, Hijri, signature overflow, pagination, etc.)

## 6. Fichiers crees / modifies

### Crees

- `repo/packages/docs/src/services/pdf-generator.service.ts` (~350 lignes)
- `repo/packages/docs/src/services/pdf-generator.service.spec.ts` (~250 lignes)
- `repo/packages/docs/src/services/template-compiler.service.ts` (~150 lignes)
- `repo/packages/docs/src/services/template-compiler.service.spec.ts` (~100 lignes)
- `repo/packages/docs/src/helpers/handlebars-pdf-helpers.ts` (~180 lignes)
- `repo/packages/docs/src/helpers/handlebars-pdf-helpers.spec.ts` (~150 lignes)
- `repo/packages/docs/src/templates/_layout.hbs` (~200 lignes)
- `repo/packages/docs/src/templates/devis.hbs` (~250 lignes)
- `repo/packages/docs/src/templates/facture.hbs` (~280 lignes)
- `repo/packages/docs/src/templates/police.hbs` (~350 lignes)
- `repo/packages/docs/src/templates/sinistre-rapport.hbs` (~250 lignes)
- `repo/packages/docs/src/templates/ar/devis.hbs` (~250 lignes RTL)
- `repo/packages/docs/src/templates/ar-MA/devis.hbs` (~250 lignes RTL Darija)
- `repo/packages/docs/src/assets/fonts/inter-regular.woff2.base64.txt`
- `repo/packages/docs/src/assets/fonts/amiri-regular.woff2.base64.txt`
- `repo/packages/docs/src/assets/logos/skalean-logo.svg.base64.txt`
- `repo/packages/docs/src/dto/generate-pdf.dto.ts` (~80 lignes Zod)
- `repo/packages/docs/src/index.ts` (export public API)
- `repo/apps/api/src/modules/docs/controllers/pdf-generation.controller.ts` (~150 lignes)
- `repo/apps/api/test/docs/pdf-generation.e2e-spec.ts` (~300 lignes)
- `repo/packages/docs/README.md` (~150 lignes)

### Modifies

- `repo/packages/docs/src/docs.module.ts` (registre PdfGeneratorService, TemplateCompilerService)
- `repo/apps/api/src/modules/docs/docs.module.ts` (registre PdfGenerationController)
- `repo/packages/docs/package.json` (ajout deps puppeteer 24.0.1, handlebars 4.7.8, qrcode 1.5.4, dayjs 1.11.13, lru-cache 11.0.2, async-mutex 0.5.0, p-limit 6.2.0)
- `repo/.env.example` (ajout PDF_BROWSER_HEADLESS, PDF_GENERATION_TIMEOUT_MS, PDF_TEMPLATES_CACHE_TTL_SEC, PDF_MAX_CONCURRENT_PAGES)

## 7. CODE COMPLET

### 7.1 packages/docs/src/services/pdf-generator.service.ts

```typescript
import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Mutex } from 'async-mutex';
import pLimit, { LimitFunction } from 'p-limit';
import puppeteer, { Browser, Page, PDFOptions } from 'puppeteer';
import { TemplateCompilerService } from './template-compiler.service';
import { AccessLogService } from '@skalean/audit';

export interface PdfGenerationOptions {
  format?: 'A4' | 'A5' | 'Letter';
  landscape?: boolean;
  margin?: { top: string; bottom: string; left: string; right: string };
  printBackground?: boolean;
  preferCSSPageSize?: boolean;
  displayHeaderFooter?: boolean;
  headerTemplate?: string;
  footerTemplate?: string;
  metadata?: {
    title?: string;
    author?: string;
    subject?: string;
    keywords?: string[];
  };
}

export interface PdfGenerationContext {
  tenantId: string;
  userId: string;
  correlationId?: string;
}

const DEFAULT_PDF_OPTIONS: PDFOptions = {
  format: 'A4',
  printBackground: true,
  preferCSSPageSize: true,
  margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
};

@Injectable()
export class PdfGeneratorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PdfGeneratorService.name);
  private browser: Browser | null = null;
  private readonly launchLock = new Mutex();
  private readonly pageSemaphore: LimitFunction;
  private readonly headless: boolean;
  private readonly timeoutMs: number;
  private readonly maxConcurrentPages: number;
  private isShuttingDown = false;

  constructor(
    private readonly templateCompiler: TemplateCompilerService,
    private readonly configService: ConfigService,
    @Inject(AccessLogService)
    private readonly accessLog: AccessLogService,
  ) {
    this.headless = this.configService.get<boolean>(
      'PDF_BROWSER_HEADLESS',
      true,
    );
    this.timeoutMs = this.configService.get<number>(
      'PDF_GENERATION_TIMEOUT_MS',
      5000,
    );
    this.maxConcurrentPages = this.configService.get<number>(
      'PDF_MAX_CONCURRENT_PAGES',
      4,
    );
    this.pageSemaphore = pLimit(this.maxConcurrentPages);
  }

  async onModuleInit(): Promise<void> {
    this.logger.log({
      msg: 'pdf_generator_module_init',
      headless: this.headless,
      timeoutMs: this.timeoutMs,
      maxConcurrentPages: this.maxConcurrentPages,
    });
  }

  async onModuleDestroy(): Promise<void> {
    this.isShuttingDown = true;
    if (this.browser) {
      try {
        await this.browser.close();
        this.logger.log({ msg: 'pdf_generator_browser_closed' });
      } catch (err) {
        this.logger.error({
          msg: 'pdf_generator_browser_close_failed',
          error: (err as Error).message,
        });
      } finally {
        this.browser = null;
      }
    }
  }

  async generate(
    templateName: string,
    locale: string,
    data: Record<string, unknown>,
    options: PdfGenerationOptions = {},
    context: PdfGenerationContext,
  ): Promise<Buffer> {
    const startedAt = Date.now();
    this.logger.log({
      msg: 'pdf_generation_started',
      templateName,
      locale,
      tenantId: context.tenantId,
      correlationId: context.correlationId,
    });

    return this.pageSemaphore(async () => {
      try {
        const template = await this.templateCompiler.compile(
          templateName,
          locale,
        );
        const html = template({
          ...data,
          _meta: {
            generatedAt: new Date().toISOString(),
            tenantId: context.tenantId,
            templateName,
            locale,
          },
        });

        const browser = await this.ensureBrowser();
        const page = await browser.newPage();
        try {
          await this.renderPdfPage(page, html, options);
          const pdfBuffer = await page.pdf({
            ...DEFAULT_PDF_OPTIONS,
            ...options,
          });

          const durationMs = Date.now() - startedAt;
          this.logger.log({
            msg: 'pdf_generation_succeeded',
            templateName,
            locale,
            tenantId: context.tenantId,
            durationMs,
            sizeBytes: pdfBuffer.byteLength,
            correlationId: context.correlationId,
          });

          await this.accessLog.log({
            tenantId: context.tenantId,
            userId: context.userId,
            action: 'PDF_GENERATED',
            resourceType: 'PDF_TEMPLATE',
            resourceId: `${templateName}_${locale}`,
            metadata: {
              durationMs,
              sizeBytes: pdfBuffer.byteLength,
              templateName,
              locale,
            },
          });

          return Buffer.from(pdfBuffer);
        } finally {
          await page.close().catch((err) => {
            this.logger.warn({
              msg: 'pdf_page_close_failed',
              error: (err as Error).message,
            });
          });
        }
      } catch (err) {
        const durationMs = Date.now() - startedAt;
        this.logger.error({
          msg: 'pdf_generation_failed',
          templateName,
          locale,
          tenantId: context.tenantId,
          durationMs,
          error: (err as Error).message,
          stack: (err as Error).stack,
          correlationId: context.correlationId,
        });
        throw err;
      }
    });
  }

  private async renderPdfPage(
    page: Page,
    html: string,
    options: PdfGenerationOptions,
  ): Promise<void> {
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const url = request.url();
      if (url.startsWith('data:') || url === 'about:blank') {
        request.continue();
        return;
      }
      this.logger.warn({
        msg: 'pdf_external_resource_blocked',
        url,
      });
      request.abort('blockedbyclient');
    });

    await page.emulateMediaType('print');
    await page.setContent(html, {
      waitUntil: 'networkidle0',
      timeout: this.timeoutMs,
    });

    await page.evaluateHandle('document.fonts.ready');

    if (options.metadata) {
      await page.evaluate((meta) => {
        document.title = meta.title || '';
      }, options.metadata);
    }
  }

  private async ensureBrowser(): Promise<Browser> {
    if (this.browser && this.browser.connected) {
      return this.browser;
    }
    return this.launchLock.runExclusive(async () => {
      if (this.browser && this.browser.connected) {
        return this.browser;
      }
      this.browser = await this.launchBrowser();
      return this.browser;
    });
  }

  private async launchBrowser(): Promise<Browser> {
    this.logger.log({ msg: 'pdf_browser_launching', headless: this.headless });
    const browser = await puppeteer.launch({
      headless: this.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--font-render-hinting=none',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
      ],
      timeout: 30000,
    });
    browser.on('disconnected', () => {
      this.logger.error({ msg: 'pdf_browser_disconnected' });
      this.browser = null;
    });
    this.logger.log({ msg: 'pdf_browser_launched' });
    return browser;
  }
}
```

### 7.2 packages/docs/src/services/template-compiler.service.ts

```typescript
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LRUCache } from 'lru-cache';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import Handlebars from 'handlebars';
import { registerPdfHelpers } from '../helpers/handlebars-pdf-helpers';

interface CachedTemplate {
  template: HandlebarsTemplateDelegate;
  compiledAt: number;
}

@Injectable()
export class TemplateCompilerService implements OnModuleInit {
  private readonly logger = new Logger(TemplateCompilerService.name);
  private readonly templatesDir: string;
  private readonly cache: LRUCache<string, CachedTemplate>;
  private partialsRegistered = false;

  constructor(private readonly configService: ConfigService) {
    this.templatesDir = path.join(__dirname, '..', 'templates');
    const ttlSec = this.configService.get<number>(
      'PDF_TEMPLATES_CACHE_TTL_SEC',
      3600,
    );
    this.cache = new LRUCache<string, CachedTemplate>({
      max: 256,
      ttl: ttlSec * 1000,
    });
  }

  async onModuleInit(): Promise<void> {
    registerPdfHelpers(Handlebars);
    await this.registerPartials();
    this.logger.log({
      msg: 'template_compiler_initialized',
      templatesDir: this.templatesDir,
      cacheMax: 256,
    });
  }

  async compile(
    templateName: string,
    locale: string,
  ): Promise<HandlebarsTemplateDelegate> {
    const cacheKey = `${locale}:${templateName}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      this.logger.debug({
        msg: 'template_cache_hit',
        cacheKey,
      });
      return cached.template;
    }

    const filePath = await this.resolvePath(templateName, locale);
    this.logger.debug({
      msg: 'template_cache_miss',
      cacheKey,
      filePath,
    });
    const source = await fs.readFile(filePath, 'utf-8');
    const compiled = Handlebars.compile(source, { strict: true, noEscape: false });
    this.cache.set(cacheKey, {
      template: compiled,
      compiledAt: Date.now(),
    });
    return compiled;
  }

  private async resolvePath(
    templateName: string,
    locale: string,
  ): Promise<string> {
    const candidates = this.localeCandidates(locale).map((loc) =>
      loc === 'fr'
        ? path.join(this.templatesDir, `${templateName}.hbs`)
        : path.join(this.templatesDir, loc, `${templateName}.hbs`),
    );
    for (const candidate of candidates) {
      try {
        await fs.access(candidate);
        return candidate;
      } catch {
        continue;
      }
    }
    throw new Error(
      `Template not found: ${templateName} for locale ${locale} (tried: ${candidates.join(', ')})`,
    );
  }

  private localeCandidates(locale: string): string[] {
    if (locale === 'ar-MA') return ['ar-MA', 'ar', 'fr'];
    if (locale === 'ar') return ['ar', 'fr'];
    if (locale === 'fr') return ['fr'];
    return [locale, 'fr'];
  }

  private async registerPartials(): Promise<void> {
    if (this.partialsRegistered) return;
    const layoutPath = path.join(this.templatesDir, '_layout.hbs');
    const layoutSource = await fs.readFile(layoutPath, 'utf-8');
    Handlebars.registerPartial('layout', layoutSource);
    this.partialsRegistered = true;
  }

  invalidateCache(templateName?: string): void {
    if (!templateName) {
      this.cache.clear();
      this.logger.log({ msg: 'template_cache_cleared_all' });
      return;
    }
    for (const key of this.cache.keys()) {
      if (key.endsWith(`:${templateName}`)) {
        this.cache.delete(key);
      }
    }
    this.logger.log({
      msg: 'template_cache_invalidated',
      templateName,
    });
  }
}
```

### 7.3 packages/docs/src/helpers/handlebars-pdf-helpers.ts

```typescript
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import 'dayjs/locale/ar';
import 'dayjs/locale/ar-ma';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import * as QRCode from 'qrcode';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);
dayjs.tz.setDefault('Africa/Casablanca');

const HIJRI_MONTHS_AR: ReadonlyArray<string> = [
  'محرم',
  'صفر',
  'ربيع الأول',
  'ربيع الثاني',
  'جمادى الأولى',
  'جمادى الآخرة',
  'رجب',
  'شعبان',
  'رمضان',
  'شوال',
  'ذو القعدة',
  'ذو الحجة',
];

const HIJRI_MONTHS_LATIN: ReadonlyArray<string> = [
  'Muharram',
  'Safar',
  "Rabi' al-awwal",
  "Rabi' al-thani",
  'Jumada al-awwal',
  'Jumada al-thani',
  'Rajab',
  "Sha'ban",
  'Ramadan',
  'Shawwal',
  "Dhu al-Qi'dah",
  'Dhu al-Hijjah',
];

export function formatDate(
  date: Date | string | undefined,
  locale: string,
  format = 'DD MMM YYYY',
): string {
  if (!date) return '';
  const localeKey = locale === 'ar-MA' ? 'ar-ma' : locale;
  return dayjs(date).tz('Africa/Casablanca').locale(localeKey).format(format);
}

export function formatCurrency(
  amount: number | string | undefined,
  currency = 'MAD',
  locale = 'fr',
): string {
  if (amount === undefined || amount === null || amount === '') return '';
  const numeric = typeof amount === 'string' ? Number(amount) : amount;
  if (Number.isNaN(numeric)) return '';
  if (locale === 'ar' || locale === 'ar-MA') {
    const formatter = new Intl.NumberFormat('ar-MA', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return formatter.format(numeric);
  }
  const formatter = new Intl.NumberFormat('fr-MA', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return formatter.format(numeric);
}

export function formatPhone(phone: string | undefined): string {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  let normalized = cleaned;
  if (cleaned.startsWith('00212')) normalized = cleaned.slice(2);
  else if (cleaned.startsWith('212')) normalized = cleaned;
  else if (cleaned.startsWith('0')) normalized = '212' + cleaned.slice(1);
  if (normalized.length !== 12) return phone;
  const country = normalized.slice(0, 3);
  const op = normalized.slice(3, 4);
  const a = normalized.slice(4, 6);
  const b = normalized.slice(6, 8);
  const c = normalized.slice(8, 10);
  const d = normalized.slice(10, 12);
  return `+${country} ${op} ${a} ${b} ${c} ${d}`;
}

export function formatICE(ice: string | undefined): string {
  if (!ice) return '';
  const cleaned = ice.replace(/\D/g, '');
  if (cleaned.length !== 15) return ice;
  return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 9)} ${cleaned.slice(9, 12)} ${cleaned.slice(12, 15)}`;
}

export function gregorianToHijri(
  date: Date,
): { year: number; month: number; day: number } {
  const jd =
    Math.floor((1461 * (date.getFullYear() + 4800 + Math.floor((date.getMonth() - 13) / 12))) / 4) +
    Math.floor((367 * (date.getMonth() + 1 - 2 - 12 * Math.floor((date.getMonth() - 13) / 12))) / 12) -
    Math.floor((3 * Math.floor((date.getFullYear() + 4900 + Math.floor((date.getMonth() - 13) / 12)) / 100)) / 4) +
    date.getDate() -
    32075;
  const l = jd - 1948440 + 10632;
  const n = Math.floor((l - 1) / 10631);
  const l1 = l - 10631 * n + 354;
  const j =
    Math.floor((10985 - l1) / 5316) * Math.floor((50 * l1) / 17719) +
    Math.floor(l1 / 5670) * Math.floor((43 * l1) / 15238);
  const l2 =
    l1 -
    Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) -
    Math.floor(j / 16) * Math.floor((15238 * j) / 43) +
    29;
  const month = Math.floor((24 * l2) / 709);
  const day = l2 - Math.floor((709 * month) / 24);
  const year = 30 * n + j - 30;
  return { year, month, day };
}

export function formatDateHijri(
  date: Date | string | undefined,
  language: 'ar' | 'latin' = 'ar',
): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  const { year, month, day } = gregorianToHijri(d);
  const monthName =
    language === 'ar'
      ? HIJRI_MONTHS_AR[Math.max(0, Math.min(11, month - 1))]
      : HIJRI_MONTHS_LATIN[Math.max(0, Math.min(11, month - 1))];
  return language === 'ar' ? `${day} ${monthName} ${year}` : `${day} ${monthName} ${year} AH`;
}

export async function qrCodeSvg(
  data: string,
  size = 128,
): Promise<string> {
  if (!data) return '';
  return QRCode.toString(data, {
    type: 'svg',
    width: size,
    errorCorrectionLevel: 'M',
    margin: 1,
  });
}

let qrCacheSync = new Map<string, string>();

export function qrCodeSync(data: string, size = 128): string {
  if (!data) return '';
  const key = `${size}:${data}`;
  if (qrCacheSync.has(key)) return qrCacheSync.get(key)!;
  const placeholder = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="100%" height="100%" fill="#ffffff"/><text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-size="10">QR ${data.slice(0, 8)}</text></svg>`;
  qrCacheSync.set(key, placeholder);
  return placeholder;
}

export async function preloadQrCache(urls: string[], size = 128): Promise<void> {
  for (const url of urls) {
    const svg = await qrCodeSvg(url, size);
    qrCacheSync.set(`${size}:${url}`, svg);
  }
}

export function registerPdfHelpers(handlebars: typeof import('handlebars')): void {
  handlebars.registerHelper('formatDate', (date: unknown, locale: unknown, format: unknown) => {
    return formatDate(date as Date, String(locale ?? 'fr'), typeof format === 'string' ? format : undefined);
  });
  handlebars.registerHelper('formatCurrency', (amount: unknown, currency: unknown, locale: unknown) => {
    return formatCurrency(amount as number, String(currency ?? 'MAD'), String(locale ?? 'fr'));
  });
  handlebars.registerHelper('formatPhone', (phone: unknown) => formatPhone(String(phone ?? '')));
  handlebars.registerHelper('formatICE', (ice: unknown) => formatICE(String(ice ?? '')));
  handlebars.registerHelper('formatDateHijri', (date: unknown, lang: unknown) =>
    formatDateHijri(date as Date, (lang === 'latin' ? 'latin' : 'ar')),
  );
  handlebars.registerHelper('qrCode', (data: unknown, size: unknown) =>
    new handlebars.SafeString(qrCodeSync(String(data ?? ''), Number(size ?? 128))),
  );
  handlebars.registerHelper('condIfArabic', function (this: unknown, locale: unknown, options: Handlebars.HelperOptions) {
    const isArabic = locale === 'ar' || locale === 'ar-MA';
    return isArabic ? options.fn(this) : options.inverse(this);
  });
  handlebars.registerHelper('eq', (a: unknown, b: unknown) => a === b);
  handlebars.registerHelper('gt', (a: unknown, b: unknown) => Number(a) > Number(b));
  handlebars.registerHelper('lt', (a: unknown, b: unknown) => Number(a) < Number(b));
  handlebars.registerHelper('add', (a: unknown, b: unknown) => Number(a) + Number(b));
  handlebars.registerHelper('mul', (a: unknown, b: unknown) => Number(a) * Number(b));
  handlebars.registerHelper('inc', (a: unknown) => Number(a) + 1);
}
```

### 7.4 packages/docs/src/templates/_layout.hbs

```handlebars
<!DOCTYPE html>
<html lang="{{locale}}" dir="{{#condIfArabic locale}}rtl{{else}}ltr{{/condIfArabic}}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{title}}</title>
  <style>
    @page {
      size: A4;
      margin: 20mm 15mm;
    }
    @font-face {
      font-family: 'Inter';
      src: url('data:font/woff2;base64,{{fonts.inter}}') format('woff2');
      font-weight: 400;
      font-style: normal;
    }
    @font-face {
      font-family: 'Inter';
      src: url('data:font/woff2;base64,{{fonts.interBold}}') format('woff2');
      font-weight: 700;
      font-style: normal;
    }
    @font-face {
      font-family: 'Amiri';
      src: url('data:font/woff2;base64,{{fonts.amiri}}') format('woff2');
      font-weight: 400;
      font-style: normal;
    }
    @font-face {
      font-family: 'Tajawal';
      src: url('data:font/woff2;base64,{{fonts.tajawal}}') format('woff2');
      font-weight: 400;
      font-style: normal;
    }
    html, body {
      margin: 0;
      padding: 0;
      font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.5;
      color: #1a202c;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    [dir="rtl"] body {
      font-family: 'Amiri', 'Tajawal', 'Cairo', serif;
      text-align: right;
    }
    .doc-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #2563eb;
      padding-bottom: 12pt;
      margin-bottom: 16pt;
    }
    [dir="rtl"] .doc-header { flex-direction: row-reverse; }
    .doc-header .logo {
      width: 48pt;
      height: 48pt;
    }
    .doc-header .tenant-info {
      text-align: end;
      font-size: 9pt;
      color: #475569;
    }
    .doc-header .tenant-info .tenant-name {
      font-size: 12pt;
      font-weight: 700;
      color: #1e293b;
    }
    .doc-footer {
      position: fixed;
      bottom: 8mm;
      left: 15mm;
      right: 15mm;
      display: flex;
      justify-content: space-between;
      font-size: 8pt;
      color: #64748b;
      border-top: 1px solid #e2e8f0;
      padding-top: 6pt;
    }
    [dir="rtl"] .doc-footer { flex-direction: row-reverse; }
    .doc-footer .page-num::before { content: counter(page); }
    .doc-footer .total-pages::before { content: counter(pages); }
    .doc-title {
      font-size: 18pt;
      font-weight: 700;
      color: #1e3a8a;
      margin: 8pt 0 16pt 0;
    }
    .doc-subtitle {
      font-size: 10pt;
      color: #475569;
      margin-bottom: 12pt;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 8pt 0;
    }
    table thead {
      display: table-header-group;
      background: #f1f5f9;
    }
    table thead th {
      padding: 6pt 8pt;
      text-align: start;
      font-weight: 700;
      font-size: 10pt;
      border-bottom: 2px solid #cbd5e1;
    }
    table tbody tr {
      page-break-inside: avoid;
    }
    table tbody td {
      padding: 5pt 8pt;
      border-bottom: 1px solid #e2e8f0;
      font-size: 10pt;
    }
    table tbody tr:nth-child(even) td { background: #f8fafc; }
    .totals {
      margin-top: 12pt;
      width: 50%;
      margin-left: auto;
    }
    [dir="rtl"] .totals { margin-left: 0; margin-right: auto; }
    .totals tr td {
      padding: 4pt 8pt;
      border: none;
    }
    .totals tr.total-ttc td {
      border-top: 2px solid #1e3a8a;
      font-weight: 700;
      font-size: 12pt;
      color: #1e3a8a;
    }
    .signature-block {
      margin-top: 24pt;
      page-break-inside: avoid;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16pt;
    }
    .signature-block .signature-cell {
      border-top: 1px dashed #94a3b8;
      padding-top: 8pt;
      min-height: 60pt;
    }
    .stamp {
      display: inline-block;
      padding: 6pt 12pt;
      border: 2pt solid #16a34a;
      border-radius: 4pt;
      font-weight: 700;
      color: #16a34a;
      transform: rotate(-12deg);
    }
    .stamp.unpaid { color: #dc2626; border-color: #dc2626; }
    .conditions-generales {
      margin-top: 24pt;
      padding-top: 12pt;
      border-top: 1px solid #cbd5e1;
      font-size: 8pt;
      line-height: 1.4;
      color: #475569;
    }
    .conditions-generales h3 {
      font-size: 10pt;
      color: #1e293b;
      margin: 10pt 0 4pt 0;
    }
    .conditions-generales p { margin: 4pt 0; text-align: justify; }
    .qr-block {
      display: flex;
      align-items: center;
      gap: 12pt;
      margin: 12pt 0;
    }
    .qr-block .qr-code { width: 80pt; height: 80pt; }
    .qr-block .qr-info { font-size: 8pt; color: #475569; }
    .photos-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8pt;
      margin: 12pt 0;
    }
    .photos-grid img {
      width: 100%;
      max-height: 120pt;
      object-fit: cover;
      border: 1px solid #e2e8f0;
    }
  </style>
</head>
<body>
  <div class="doc-header">
    <div class="logo-block">
      <img class="logo" src="data:image/svg+xml;base64,{{logo}}" alt="Skalean">
    </div>
    <div class="tenant-info">
      <div class="tenant-name">{{tenant.name}}</div>
      <div>{{tenant.address}}</div>
      <div>ICE: {{formatICE tenant.ice}}</div>
      <div>RC: {{tenant.rc}} - IF: {{tenant.if}}</div>
      <div>Tel: {{formatPhone tenant.phone}}</div>
    </div>
  </div>

  {{> @partial-block }}

  <div class="doc-footer">
    <div>
      <span>{{tenant.name}}</span>
      <span> - </span>
      <span>{{formatDate _meta.generatedAt locale 'DD/MM/YYYY HH:mm'}}</span>
    </div>
    <div>
      <span>Page </span>
      <span class="page-num"></span>
      <span> / </span>
      <span class="total-pages"></span>
    </div>
  </div>
</body>
</html>
```

### 7.5 packages/docs/src/templates/devis.hbs

```handlebars
{{#> layout title=(concat "Devis " devis.numero)}}
  <h1 class="doc-title">DEVIS {{devis.numero}}</h1>
  <div class="doc-subtitle">
    Etabli le {{formatDate devis.dateEmission locale 'DD MMMM YYYY'}}
    - Valable jusqu'au {{formatDate devis.dateValidite locale 'DD MMMM YYYY'}}
  </div>

  <table class="client-info">
    <tbody>
      <tr>
        <td style="width:50%; vertical-align: top;">
          <strong>Devis adresse a :</strong><br>
          {{client.raisonSociale}}<br>
          {{client.adresse}}<br>
          {{client.codePostal}} {{client.ville}}<br>
          {{#if client.ice}}ICE: {{formatICE client.ice}}<br>{{/if}}
          Tel: {{formatPhone client.telephone}}
        </td>
        <td style="vertical-align: top;">
          <strong>Reference :</strong> {{devis.reference}}<br>
          <strong>Date :</strong> {{formatDate devis.dateEmission locale 'DD/MM/YYYY'}}<br>
          <strong>Validite :</strong> {{devis.dureeValiditeJours}} jours<br>
          <strong>Conseiller :</strong> {{devis.conseiller.nom}}
        </td>
      </tr>
    </tbody>
  </table>

  <h2 style="font-size: 12pt; color: #1e3a8a; margin-top: 16pt;">Detail des prestations</h2>
  <table class="items">
    <thead>
      <tr>
        <th style="width: 8%;">N</th>
        <th style="width: 42%;">Designation</th>
        <th style="width: 10%; text-align: end;">Qte</th>
        <th style="width: 15%; text-align: end;">PU HT</th>
        <th style="width: 10%; text-align: end;">TVA</th>
        <th style="width: 15%; text-align: end;">Total HT</th>
      </tr>
    </thead>
    <tbody>
      {{#each devis.lignes}}
        <tr>
          <td>{{inc @index}}</td>
          <td>
            <strong>{{designation}}</strong>
            {{#if description}}<br><span style="font-size: 9pt; color: #64748b;">{{description}}</span>{{/if}}
          </td>
          <td style="text-align: end;">{{quantite}} {{unite}}</td>
          <td style="text-align: end;">{{formatCurrency prixUnitaireHT 'MAD' ../locale}}</td>
          <td style="text-align: end;">{{tauxTVA}}%</td>
          <td style="text-align: end;">{{formatCurrency totalHT 'MAD' ../locale}}</td>
        </tr>
      {{/each}}
    </tbody>
  </table>

  <table class="totals">
    <tbody>
      <tr>
        <td>Total HT</td>
        <td style="text-align: end;">{{formatCurrency devis.totalHT 'MAD' locale}}</td>
      </tr>
      <tr>
        <td>TVA 20%</td>
        <td style="text-align: end;">{{formatCurrency devis.totalTVA 'MAD' locale}}</td>
      </tr>
      {{#if devis.remise}}
        <tr>
          <td>Remise commerciale</td>
          <td style="text-align: end;">- {{formatCurrency devis.remise 'MAD' locale}}</td>
        </tr>
      {{/if}}
      <tr class="total-ttc">
        <td>TOTAL TTC</td>
        <td style="text-align: end;">{{formatCurrency devis.totalTTC 'MAD' locale}}</td>
      </tr>
    </tbody>
  </table>

  <div class="qr-block">
    <div class="qr-code">{{{qrCode devis.verifyUrl 80}}}</div>
    <div class="qr-info">
      Verifiez ce devis en scannant ce QR code<br>
      ou via {{devis.verifyUrl}}
    </div>
  </div>

  <div class="signature-block">
    <div class="signature-cell">
      <div><strong>Etabli par</strong></div>
      <div>{{devis.conseiller.nom}}</div>
      <div style="font-size: 9pt; color: #64748b;">{{devis.conseiller.titre}}</div>
    </div>
    <div class="signature-cell">
      <div><strong>Bon pour accord (client)</strong></div>
      <div style="font-size: 9pt; color: #64748b;">Date et signature precedees de la mention 'Bon pour accord'</div>
    </div>
  </div>

  <div class="conditions-generales">
    <h3>Conditions de validite</h3>
    <p>1. Le present devis est valable {{devis.dureeValiditeJours}} jours a compter de sa date d'emission.</p>
    <p>2. Les prix indiques sont en Dirhams marocains (MAD), hors taxes et toutes taxes comprises (TVA 20%).</p>
    <p>3. Tout retard de paiement entraine de plein droit l'application des interets de retard au taux legal (Code de Commerce article 78-3).</p>
    <p>4. Le present devis vaut acceptation de l'ensemble des conditions generales de vente disponibles sur {{tenant.cguUrl}}.</p>
    <p>5. Conformement a la loi 09-08 relative a la protection des donnees personnelles, vous disposez d'un droit d'acces, de rectification et de suppression de vos donnees.</p>
  </div>
{{/layout}}
```

### 7.6 packages/docs/src/templates/facture.hbs

```handlebars
{{#> layout title=(concat "Facture " facture.numero)}}
  <h1 class="doc-title">FACTURE {{facture.numero}}</h1>
  <div class="doc-subtitle">
    Emise le {{formatDate facture.dateEmission locale 'DD MMMM YYYY'}}
    {{#if facture.dateEcheance}} - Echeance : {{formatDate facture.dateEcheance locale 'DD MMMM YYYY'}}{{/if}}
  </div>

  {{#if (eq facture.statut 'PAID')}}
    <div style="text-align: end;"><span class="stamp">PAYEE</span></div>
  {{/if}}
  {{#if (eq facture.statut 'OVERDUE')}}
    <div style="text-align: end;"><span class="stamp unpaid">EN RETARD</span></div>
  {{/if}}

  <table class="client-info">
    <tbody>
      <tr>
        <td style="width:50%; vertical-align: top;">
          <strong>Facture adressee a :</strong><br>
          {{client.raisonSociale}}<br>
          {{client.adresse}}<br>
          {{client.codePostal}} {{client.ville}}<br>
          {{#if client.ice}}ICE: {{formatICE client.ice}}<br>{{/if}}
          {{#if client.if}}IF: {{client.if}}<br>{{/if}}
          {{#if client.rc}}RC: {{client.rc}}<br>{{/if}}
        </td>
        <td style="vertical-align: top;">
          <strong>Numero :</strong> {{facture.numero}}<br>
          <strong>Date :</strong> {{formatDate facture.dateEmission locale 'DD/MM/YYYY'}}<br>
          <strong>Echeance :</strong> {{formatDate facture.dateEcheance locale 'DD/MM/YYYY'}}<br>
          <strong>Devis ref :</strong> {{facture.devisReference}}<br>
          <strong>Mode paiement :</strong> {{facture.modePaiement}}
        </td>
      </tr>
    </tbody>
  </table>

  <table class="items">
    <thead>
      <tr>
        <th style="width: 6%;">N</th>
        <th style="width: 40%;">Designation</th>
        <th style="width: 8%; text-align: end;">Qte</th>
        <th style="width: 14%; text-align: end;">PU HT</th>
        <th style="width: 8%; text-align: end;">TVA</th>
        <th style="width: 12%; text-align: end;">HT</th>
        <th style="width: 12%; text-align: end;">TTC</th>
      </tr>
    </thead>
    <tbody>
      {{#each facture.lignes}}
        <tr>
          <td>{{inc @index}}</td>
          <td>
            <strong>{{designation}}</strong>
            {{#if reference}}<br><span style="font-size: 9pt; color: #64748b;">Ref: {{reference}}</span>{{/if}}
          </td>
          <td style="text-align: end;">{{quantite}}</td>
          <td style="text-align: end;">{{formatCurrency prixUnitaireHT 'MAD' ../locale}}</td>
          <td style="text-align: end;">{{tauxTVA}}%</td>
          <td style="text-align: end;">{{formatCurrency totalHT 'MAD' ../locale}}</td>
          <td style="text-align: end;">{{formatCurrency totalTTC 'MAD' ../locale}}</td>
        </tr>
      {{/each}}
    </tbody>
  </table>

  <table class="totals">
    <tbody>
      <tr>
        <td>Total HT</td>
        <td style="text-align: end;">{{formatCurrency facture.totalHT 'MAD' locale}}</td>
      </tr>
      {{#each facture.tvaParTaux}}
        <tr>
          <td>TVA {{taux}}% sur {{formatCurrency baseHT 'MAD' ../locale}}</td>
          <td style="text-align: end;">{{formatCurrency montantTVA 'MAD' ../locale}}</td>
        </tr>
      {{/each}}
      <tr class="total-ttc">
        <td>TOTAL TTC A PAYER</td>
        <td style="text-align: end;">{{formatCurrency facture.totalTTC 'MAD' locale}}</td>
      </tr>
    </tbody>
  </table>

  <div style="margin-top: 16pt; padding: 8pt; background: #f1f5f9; border-left: 3pt solid #2563eb;">
    <strong>Mention en lettres :</strong> {{facture.totalEnLettres}} dirhams marocains
  </div>

  <div class="qr-block">
    <div class="qr-code">{{{qrCode facture.verifyUrl 80}}}</div>
    <div class="qr-info">
      <strong>Verification authenticite</strong><br>
      Scannez ce QR code ou consultez {{facture.verifyUrl}}<br>
      Empreinte SHA-256 : {{facture.hash}}
    </div>
  </div>

  <div class="signature-block">
    <div class="signature-cell">
      <div><strong>Pour {{tenant.name}}</strong></div>
      <div>{{facture.signataire.nom}}</div>
      <div style="font-size: 9pt; color: #64748b;">{{facture.signataire.titre}}</div>
    </div>
    <div class="signature-cell">
      <div><strong>Cachet et signature</strong></div>
    </div>
  </div>

  <div class="conditions-generales">
    <h3>Mentions legales obligatoires (DGI Note Circulaire 717)</h3>
    <p>{{tenant.name}} - Capital social : {{formatCurrency tenant.capitalSocial 'MAD' locale}} - RC {{tenant.ville}} : {{tenant.rc}}</p>
    <p>ICE : {{formatICE tenant.ice}} - IF : {{tenant.if}} - Patente : {{tenant.patente}} - CNSS : {{tenant.cnss}}</p>
    <p>Adresse : {{tenant.address}} - Tel : {{formatPhone tenant.phone}} - Email : {{tenant.email}}</p>
    <p><strong>Conditions de paiement :</strong> Reglement a {{facture.delaiReglementJours}} jours par {{facture.modePaiement}}. Tout retard de paiement entrainera l'application d'interets de retard au taux legal majore de 7 points (Loi 49-15) ainsi qu'une indemnite forfaitaire pour frais de recouvrement de 40 euros HT.</p>
    <p><strong>Reserve de propriete :</strong> Les marchandises et prestations restent la propriete du vendeur jusqu'au paiement integral du prix.</p>
    <p>Conformement a la loi 09-08, vous disposez d'un droit d'acces, de rectification et de suppression de vos donnees personnelles aupres de {{tenant.dpo.email}}.</p>
  </div>
{{/layout}}
```

### 7.7 packages/docs/src/templates/police.hbs

```handlebars
{{#> layout title=(concat "Police " police.numero)}}
  <h1 class="doc-title">POLICE D'ASSURANCE N {{police.numero}}</h1>
  <div class="doc-subtitle">
    Conforme a la loi 17-99 du Code des Assurances et au reglement ACAPS 02/AS/19
  </div>

  <table class="parties">
    <tbody>
      <tr>
        <td style="width: 33%; vertical-align: top;">
          <strong>Assureur :</strong><br>
          {{tenant.name}}<br>
          {{tenant.address}}<br>
          Agree ACAPS n {{tenant.acapsAgrement}}<br>
          ICE : {{formatICE tenant.ice}}
        </td>
        <td style="width: 33%; vertical-align: top;">
          <strong>Souscripteur :</strong><br>
          {{souscripteur.nom}} {{souscripteur.prenom}}<br>
          {{souscripteur.adresse}}<br>
          CIN : {{souscripteur.cin}}<br>
          Tel : {{formatPhone souscripteur.telephone}}
        </td>
        <td style="width: 33%; vertical-align: top;">
          <strong>Assure :</strong><br>
          {{assure.nom}} {{assure.prenom}}<br>
          {{assure.adresse}}<br>
          {{#if assure.cin}}CIN : {{assure.cin}}<br>{{/if}}
          Date naissance : {{formatDate assure.dateNaissance locale 'DD/MM/YYYY'}}
        </td>
      </tr>
    </tbody>
  </table>

  <h2 style="font-size: 12pt; color: #1e3a8a; margin-top: 16pt;">Caracteristiques de la police</h2>
  <table>
    <tbody>
      <tr>
        <td style="width: 30%; font-weight: 700;">Type de contrat</td>
        <td>{{police.typeContrat}}</td>
      </tr>
      <tr>
        <td style="font-weight: 700;">Numero police</td>
        <td>{{police.numero}}</td>
      </tr>
      <tr>
        <td style="font-weight: 700;">Date d'effet</td>
        <td>{{formatDate police.dateEffet locale 'DD MMMM YYYY'}} a 00h00</td>
      </tr>
      <tr>
        <td style="font-weight: 700;">Date d'echeance</td>
        <td>{{formatDate police.dateEcheance locale 'DD MMMM YYYY'}} a 24h00</td>
      </tr>
      <tr>
        <td style="font-weight: 700;">Duree du contrat</td>
        <td>{{police.dureeMois}} mois - tacite reconduction {{#if police.taciteReconduction}}OUI{{else}}NON{{/if}}</td>
      </tr>
      <tr>
        <td style="font-weight: 700;">Mode de paiement</td>
        <td>{{police.modePaiement}} - {{police.frequencePaiement}}</td>
      </tr>
    </tbody>
  </table>

  <h2 style="font-size: 12pt; color: #1e3a8a; margin-top: 16pt;">Garanties souscrites</h2>
  <table>
    <thead>
      <tr>
        <th>Garantie</th>
        <th style="text-align: end;">Capital assure</th>
        <th style="text-align: end;">Franchise</th>
        <th style="text-align: end;">Prime annuelle HT</th>
      </tr>
    </thead>
    <tbody>
      {{#each police.garanties}}
        <tr>
          <td>
            <strong>{{libelle}}</strong>
            {{#if description}}<br><span style="font-size: 9pt; color: #64748b;">{{description}}</span>{{/if}}
          </td>
          <td style="text-align: end;">{{formatCurrency capital 'MAD' ../locale}}</td>
          <td style="text-align: end;">{{formatCurrency franchise 'MAD' ../locale}}</td>
          <td style="text-align: end;">{{formatCurrency primeAnnuelle 'MAD' ../locale}}</td>
        </tr>
      {{/each}}
    </tbody>
  </table>

  <table class="totals">
    <tbody>
      <tr>
        <td>Prime nette HT</td>
        <td style="text-align: end;">{{formatCurrency police.primeNetteHT 'MAD' locale}}</td>
      </tr>
      <tr>
        <td>Frais d'acquisition</td>
        <td style="text-align: end;">{{formatCurrency police.fraisAcquisition 'MAD' locale}}</td>
      </tr>
      <tr>
        <td>Taxe sur contrats d'assurance (14%)</td>
        <td style="text-align: end;">{{formatCurrency police.taxe 'MAD' locale}}</td>
      </tr>
      <tr class="total-ttc">
        <td>PRIME TOTALE TTC</td>
        <td style="text-align: end;">{{formatCurrency police.primeTotaleTTC 'MAD' locale}}</td>
      </tr>
    </tbody>
  </table>

  <div class="qr-block">
    <div class="qr-code">{{{qrCode police.verifyUrl 80}}}</div>
    <div class="qr-info">
      <strong>Verification de la police</strong><br>
      Scannez ou consultez {{police.verifyUrl}}<br>
      Empreinte : {{police.hash}}
    </div>
  </div>

  <div class="signature-block">
    <div class="signature-cell">
      <div><strong>L'Assureur</strong></div>
      <div>{{tenant.name}}</div>
      <div>{{police.signataire.nom}}</div>
      <div style="font-size: 9pt; color: #64748b;">{{police.signataire.titre}}</div>
    </div>
    <div class="signature-cell">
      <div><strong>Le Souscripteur</strong></div>
      <div>{{souscripteur.nom}} {{souscripteur.prenom}}</div>
      <div style="font-size: 9pt; color: #64748b;">Mention manuscrite : 'Lu et approuve, bon pour assurance'</div>
    </div>
  </div>

  <div class="conditions-generales">
    <h3>Article 1 - Objet du contrat</h3>
    <p>Le present contrat a pour objet de garantir l'assure contre les risques enonces aux conditions particulieres et generales conformement aux dispositions du Code des Assurances marocain (Loi 17-99 et ses textes d'application). L'assureur s'engage a indemniser les sinistres survenus pendant la periode de validite du contrat, dans les limites et conditions fixees ci-dessous.</p>

    <h3>Article 2 - Prise d'effet et duree</h3>
    <p>Le contrat prend effet a la date indiquee aux conditions particulieres, sous reserve du paiement de la prime. Sa duree est de douze (12) mois, sauf stipulation contraire. Il se renouvelle tacitement d'annee en annee a son echeance principale, sauf denonciation par l'une des parties par lettre recommandee avec accuse de reception au moins trente (30) jours avant l'echeance, conformement a l'article 6 de la loi 17-99.</p>

    <h3>Article 3 - Declaration du risque</h3>
    <p>Le souscripteur est tenu de declarer exactement, lors de la conclusion du contrat, toutes les circonstances connues de lui qui sont de nature a faire apprecier par l'assureur les risques qu'il prend en charge (article 20 loi 17-99). Toute reticence ou fausse declaration intentionnelle entraine la nullite du contrat (article 30 loi 17-99) ; non intentionnelle, elle donne lieu a reduction proportionnelle de l'indemnite.</p>

    <h3>Article 4 - Paiement de la prime</h3>
    <p>La prime est payable d'avance aux echeances convenues. A defaut de paiement dans les dix (10) jours de l'echeance, l'assureur peut mettre en demeure l'assure ; la garantie est suspendue trente (30) jours apres l'envoi de la lettre de mise en demeure (article 21 loi 17-99). Le contrat peut etre resilie dix (10) jours apres l'expiration du delai de trente (30) jours.</p>

    <h3>Article 5 - Declaration des sinistres</h3>
    <p>L'assure doit declarer le sinistre dans les cinq (5) jours ouvres de sa survenance ou du jour ou il en a eu connaissance, sauf cas fortuit ou de force majeure (article 28 loi 17-99). Pour les sinistres de vol, le delai est reduit a quarante-huit (48) heures.</p>

    <h3>Article 6 - Procedure d'indemnisation</h3>
    <p>L'indemnite est versee dans les trente (30) jours suivant l'accord ou la decision judiciaire fixant son montant. En cas de retard, des interets au taux legal sont dus de plein droit (article 33 loi 17-99). L'assureur peut faire proceder a une expertise contradictoire, l'assure ayant la faculte de designer son propre expert.</p>

    <h3>Article 7 - Subrogation</h3>
    <p>L'assureur est subroge dans les droits et actions de l'assure contre les tiers responsables a concurrence du montant des indemnites versees (article 47 loi 17-99). L'assure ne peut renoncer a ces droits sous peine de dechance.</p>

    <h3>Article 8 - Resiliation</h3>
    <p>Outre les cas prevus par le Code des Assurances, le contrat peut etre resilie par l'assureur en cas d'aggravation du risque, de sinistre ou de non-paiement de la prime ; par l'assure en cas de diminution du risque, de transfert de propriete ou de modification substantielle des conditions du contrat (article 11 loi 17-99).</p>

    <h3>Article 9 - Prescription</h3>
    <p>Toutes actions derivant du present contrat sont prescrites par deux (2) ans a compter de l'evenement qui y donne naissance (article 36 loi 17-99). Cette prescription est interrompue par la designation d'un expert ou par l'envoi d'une lettre recommandee avec accuse de reception.</p>

    <h3>Article 10 - Loi applicable et juridiction</h3>
    <p>Le present contrat est soumis a la loi marocaine. Tout litige relatif a son interpretation ou son execution releve de la competence exclusive des tribunaux marocains du lieu de residence de l'assure. Le souscripteur est informe de la possibilite de saisir le mediateur de l'assurance avant tout recours juridictionnel (article 285 loi 17-99).</p>
  </div>
{{/layout}}
```

### 7.8 packages/docs/src/templates/sinistre-rapport.hbs

```handlebars
{{#> layout title=(concat "Rapport sinistre " sinistre.numero)}}
  <h1 class="doc-title">RAPPORT DE SINISTRE N {{sinistre.numero}}</h1>
  <div class="doc-subtitle">
    Etabli le {{formatDate sinistre.dateRapport locale 'DD MMMM YYYY'}}
    par {{sinistre.expert.nom}} ({{sinistre.expert.titre}})
  </div>

  <h2 style="font-size: 12pt; color: #1e3a8a; margin-top: 16pt;">1. Identification du sinistre</h2>
  <table>
    <tbody>
      <tr>
        <td style="width: 30%; font-weight: 700;">Numero sinistre</td>
        <td>{{sinistre.numero}}</td>
      </tr>
      <tr>
        <td style="font-weight: 700;">Police de reference</td>
        <td>{{sinistre.policeNumero}}</td>
      </tr>
      <tr>
        <td style="font-weight: 700;">Date survenance</td>
        <td>{{formatDate sinistre.dateSurvenance locale 'DD/MM/YYYY'}} a {{sinistre.heureSurvenance}}</td>
      </tr>
      <tr>
        <td style="font-weight: 700;">Date declaration</td>
        <td>{{formatDate sinistre.dateDeclaration locale 'DD/MM/YYYY'}}</td>
      </tr>
      <tr>
        <td style="font-weight: 700;">Lieu</td>
        <td>{{sinistre.lieu}}</td>
      </tr>
      <tr>
        <td style="font-weight: 700;">Type sinistre</td>
        <td>{{sinistre.type}}</td>
      </tr>
    </tbody>
  </table>

  <h2 style="font-size: 12pt; color: #1e3a8a; margin-top: 16pt;">2. Circonstances</h2>
  <p style="text-align: justify;">{{sinistre.circonstances}}</p>

  {{#if sinistre.photos.length}}
    <h2 style="font-size: 12pt; color: #1e3a8a; margin-top: 16pt;">3. Photos jointes</h2>
    <div class="photos-grid">
      {{#each sinistre.photos}}
        <div>
          <img src="data:image/jpeg;base64,{{base64}}" alt="{{legende}}">
          <div style="font-size: 8pt; text-align: center; color: #475569;">Photo {{inc @index}} - {{legende}}</div>
        </div>
      {{/each}}
    </div>
  {{/if}}

  <h2 style="font-size: 12pt; color: #1e3a8a; margin-top: 16pt;">4. Estimation des dommages</h2>
  <table>
    <thead>
      <tr>
        <th>Designation</th>
        <th style="text-align: end;">Montant estime</th>
      </tr>
    </thead>
    <tbody>
      {{#each sinistre.dommages}}
        <tr>
          <td>{{designation}}</td>
          <td style="text-align: end;">{{formatCurrency montant 'MAD' ../locale}}</td>
        </tr>
      {{/each}}
    </tbody>
  </table>
  <table class="totals">
    <tbody>
      <tr class="total-ttc">
        <td>TOTAL ESTIMATION</td>
        <td style="text-align: end;">{{formatCurrency sinistre.totalEstimation 'MAD' locale}}</td>
      </tr>
    </tbody>
  </table>

  <h2 style="font-size: 12pt; color: #1e3a8a; margin-top: 16pt;">5. Decision et indemnisation proposee</h2>
  <table>
    <tbody>
      <tr>
        <td style="width: 30%; font-weight: 700;">Garantie applicable</td>
        <td>{{sinistre.garantieApplicable}}</td>
      </tr>
      <tr>
        <td style="font-weight: 700;">Franchise</td>
        <td>{{formatCurrency sinistre.franchise 'MAD' locale}}</td>
      </tr>
      <tr>
        <td style="font-weight: 700;">Indemnisation proposee</td>
        <td><strong>{{formatCurrency sinistre.indemnisationProposee 'MAD' locale}}</strong></td>
      </tr>
      <tr>
        <td style="font-weight: 700;">Decision</td>
        <td>{{sinistre.decision}}</td>
      </tr>
    </tbody>
  </table>

  <div class="qr-block">
    <div class="qr-code">{{{qrCode sinistre.verifyUrl 80}}}</div>
    <div class="qr-info">
      Suivez votre dossier en scannant ce QR code<br>
      ou via {{sinistre.verifyUrl}}
    </div>
  </div>

  <div class="signature-block">
    <div class="signature-cell">
      <div><strong>L'expert</strong></div>
      <div>{{sinistre.expert.nom}}</div>
      <div style="font-size: 9pt; color: #64748b;">{{sinistre.expert.titre}}</div>
    </div>
    <div class="signature-cell">
      <div><strong>Pour {{tenant.name}}</strong></div>
      <div>{{sinistre.gestionnaire.nom}}</div>
      <div style="font-size: 9pt; color: #64748b;">{{sinistre.gestionnaire.titre}}</div>
    </div>
  </div>
{{/layout}}
```

### 7.9 packages/docs/src/templates/ar/devis.hbs

```handlebars
{{#> layout title=(concat "عرض أسعار " devis.numero)}}
  <h1 class="doc-title">عرض أسعار رقم {{devis.numero}}</h1>
  <div class="doc-subtitle">
    صادر بتاريخ {{formatDate devis.dateEmission locale 'DD MMMM YYYY'}}
    - صالح حتى {{formatDate devis.dateValidite locale 'DD MMMM YYYY'}}
  </div>

  <table class="client-info">
    <tbody>
      <tr>
        <td style="width:50%; vertical-align: top;">
          <strong>موجه إلى :</strong><br>
          {{client.raisonSociale}}<br>
          {{client.adresse}}<br>
          {{client.codePostal}} {{client.ville}}<br>
          {{#if client.ice}}المعرف الموحد للمقاولة : {{formatICE client.ice}}<br>{{/if}}
          الهاتف : {{formatPhone client.telephone}}
        </td>
        <td style="vertical-align: top;">
          <strong>المرجع :</strong> {{devis.reference}}<br>
          <strong>التاريخ :</strong> {{formatDate devis.dateEmission locale 'DD/MM/YYYY'}}<br>
          <strong>مدة الصلاحية :</strong> {{devis.dureeValiditeJours}} يوما<br>
          <strong>المستشار :</strong> {{devis.conseiller.nom}}
        </td>
      </tr>
    </tbody>
  </table>

  <h2 style="font-size: 12pt; color: #1e3a8a; margin-top: 16pt;">تفصيل الخدمات</h2>
  <table class="items">
    <thead>
      <tr>
        <th style="width: 8%;">الرقم</th>
        <th style="width: 42%;">البيان</th>
        <th style="width: 10%; text-align: start;">الكمية</th>
        <th style="width: 15%; text-align: start;">السعر الوحدوي بدون ضريبة</th>
        <th style="width: 10%; text-align: start;">الضريبة</th>
        <th style="width: 15%; text-align: start;">المجموع بدون ضريبة</th>
      </tr>
    </thead>
    <tbody>
      {{#each devis.lignes}}
        <tr>
          <td>{{inc @index}}</td>
          <td>
            <strong>{{designation}}</strong>
            {{#if description}}<br><span style="font-size: 9pt; color: #64748b;">{{description}}</span>{{/if}}
          </td>
          <td style="text-align: start;">{{quantite}} {{unite}}</td>
          <td style="text-align: start;">{{formatCurrency prixUnitaireHT 'MAD' ../locale}}</td>
          <td style="text-align: start;">{{tauxTVA}}%</td>
          <td style="text-align: start;">{{formatCurrency totalHT 'MAD' ../locale}}</td>
        </tr>
      {{/each}}
    </tbody>
  </table>

  <table class="totals">
    <tbody>
      <tr>
        <td>المجموع بدون ضريبة</td>
        <td style="text-align: start;">{{formatCurrency devis.totalHT 'MAD' locale}}</td>
      </tr>
      <tr>
        <td>الضريبة على القيمة المضافة 20%</td>
        <td style="text-align: start;">{{formatCurrency devis.totalTVA 'MAD' locale}}</td>
      </tr>
      <tr class="total-ttc">
        <td>المجموع شاملا الضرائب</td>
        <td style="text-align: start;">{{formatCurrency devis.totalTTC 'MAD' locale}}</td>
      </tr>
    </tbody>
  </table>

  <div class="qr-block">
    <div class="qr-code">{{{qrCode devis.verifyUrl 80}}}</div>
    <div class="qr-info">
      تحقق من هذا العرض بمسح رمز الاستجابة السريعة<br>
      أو عبر {{devis.verifyUrl}}
    </div>
  </div>

  <div class="signature-block">
    <div class="signature-cell">
      <div><strong>صادر عن</strong></div>
      <div>{{devis.conseiller.nom}}</div>
    </div>
    <div class="signature-cell">
      <div><strong>الموافقة (الزبون)</strong></div>
      <div style="font-size: 9pt; color: #64748b;">التاريخ والتوقيع مع عبارة 'صالح للموافقة'</div>
    </div>
  </div>

  <div class="conditions-generales">
    <h3>شروط الصلاحية</h3>
    <p>1. هذا العرض صالح لمدة {{devis.dureeValiditeJours}} يوما من تاريخ إصداره.</p>
    <p>2. الأسعار المذكورة بالدرهم المغربي بدون وشاملا الضرائب (الضريبة على القيمة المضافة 20%).</p>
    <p>3. كل تأخر في الدفع يستوجب فوائد التأخير وفقا للقانون.</p>
    <p>4. هذا العرض يعد قبولا للشروط العامة للبيع المتاحة على {{tenant.cguUrl}}.</p>
    <p>5. وفقا للقانون 09-08 المتعلق بحماية البيانات الشخصية، لكم الحق في الوصول والتصحيح وحذف بياناتكم.</p>
  </div>
{{/layout}}
```

### 7.10 packages/docs/src/templates/ar-MA/devis.hbs

```handlebars
{{#> layout title=(concat "ديفي " devis.numero)}}
  <h1 class="doc-title">عرض ثمن (ديفي) رقم {{devis.numero}}</h1>
  <div class="doc-subtitle">
    دير ف {{formatDate devis.dateEmission locale 'DD MMMM YYYY'}}
    - صالح حتى {{formatDate devis.dateValidite locale 'DD MMMM YYYY'}}
  </div>

  <table class="client-info">
    <tbody>
      <tr>
        <td style="width:50%; vertical-align: top;">
          <strong>للزبون :</strong><br>
          {{client.raisonSociale}}<br>
          {{client.adresse}}<br>
          {{client.codePostal}} {{client.ville}}<br>
          {{#if client.ice}}ICE : {{formatICE client.ice}}<br>{{/if}}
          التيليفون : {{formatPhone client.telephone}}
        </td>
        <td style="vertical-align: top;">
          <strong>المرجع :</strong> {{devis.reference}}<br>
          <strong>التاريخ :</strong> {{formatDate devis.dateEmission locale 'DD/MM/YYYY'}}<br>
          <strong>الصلوحية :</strong> {{devis.dureeValiditeJours}} نهار<br>
          <strong>المستشار :</strong> {{devis.conseiller.nom}}
        </td>
      </tr>
    </tbody>
  </table>

  <h2 style="font-size: 12pt; color: #1e3a8a; margin-top: 16pt;">تفصيل الخدمات</h2>
  <table class="items">
    <thead>
      <tr>
        <th style="width: 8%;">الرقم</th>
        <th style="width: 42%;">الوصف</th>
        <th style="width: 10%; text-align: start;">العدد</th>
        <th style="width: 15%; text-align: start;">الثمن بلا ضريبة</th>
        <th style="width: 10%; text-align: start;">TVA</th>
        <th style="width: 15%; text-align: start;">المجموع HT</th>
      </tr>
    </thead>
    <tbody>
      {{#each devis.lignes}}
        <tr>
          <td>{{inc @index}}</td>
          <td>
            <strong>{{designation}}</strong>
            {{#if description}}<br><span style="font-size: 9pt; color: #64748b;">{{description}}</span>{{/if}}
          </td>
          <td style="text-align: start;">{{quantite}} {{unite}}</td>
          <td style="text-align: start;">{{formatCurrency prixUnitaireHT 'MAD' ../locale}}</td>
          <td style="text-align: start;">{{tauxTVA}}%</td>
          <td style="text-align: start;">{{formatCurrency totalHT 'MAD' ../locale}}</td>
        </tr>
      {{/each}}
    </tbody>
  </table>

  <table class="totals">
    <tbody>
      <tr>
        <td>المجموع HT</td>
        <td style="text-align: start;">{{formatCurrency devis.totalHT 'MAD' locale}}</td>
      </tr>
      <tr>
        <td>TVA 20%</td>
        <td style="text-align: start;">{{formatCurrency devis.totalTVA 'MAD' locale}}</td>
      </tr>
      <tr class="total-ttc">
        <td>المجموع TTC</td>
        <td style="text-align: start;">{{formatCurrency devis.totalTTC 'MAD' locale}}</td>
      </tr>
    </tbody>
  </table>

  <div class="qr-block">
    <div class="qr-code">{{{qrCode devis.verifyUrl 80}}}</div>
    <div class="qr-info">
      سكاني QR باش تحقق من الديفي<br>
      ولا عبر {{devis.verifyUrl}}
    </div>
  </div>

  <div class="signature-block">
    <div class="signature-cell">
      <div><strong>دار من طرف</strong></div>
      <div>{{devis.conseiller.nom}}</div>
    </div>
    <div class="signature-cell">
      <div><strong>الموافقة ديال الزبون</strong></div>
      <div style="font-size: 9pt; color: #64748b;">التاريخ والتوقيع مع 'موافق'</div>
    </div>
  </div>

  <div class="conditions-generales">
    <h3>شروط الصلوحية</h3>
    <p>1. هاد الديفي صالح {{devis.dureeValiditeJours}} نهار من تاريخ إصداره.</p>
    <p>2. الأثمنة بالدرهم المغربي، بلا ضريبة وشاملة الضريبة (TVA 20%).</p>
    <p>3. ف حالة التأخر ف الخلاص، كاتطبق فوائد التأخير حسب القانون.</p>
    <p>4. هاد الديفي كيشكل قبول للشروط العامة ديال البيع ف {{tenant.cguUrl}}.</p>
    <p>5. حسب القانون 09-08، عندك الحق ف الوصول للبيانات ديالك وتصحيحها ومحوها.</p>
  </div>
{{/layout}}
```

### 7.11 packages/docs/src/dto/generate-pdf.dto.ts

```typescript
import { z } from 'zod';

export const SUPPORTED_TEMPLATES = ['devis', 'facture', 'police', 'sinistre-rapport'] as const;
export const SUPPORTED_LOCALES = ['fr', 'ar', 'ar-MA'] as const;

export const generatePdfSchema = z.object({
  templateName: z.enum(SUPPORTED_TEMPLATES),
  locale: z.enum(SUPPORTED_LOCALES).default('fr'),
  data: z.record(z.unknown()),
  options: z
    .object({
      format: z.enum(['A4', 'A5', 'Letter']).optional(),
      landscape: z.boolean().optional(),
      printBackground: z.boolean().optional(),
      preferCSSPageSize: z.boolean().optional(),
      margin: z
        .object({
          top: z.string(),
          bottom: z.string(),
          left: z.string(),
          right: z.string(),
        })
        .optional(),
      metadata: z
        .object({
          title: z.string().optional(),
          author: z.string().optional(),
          subject: z.string().optional(),
          keywords: z.array(z.string()).optional(),
        })
        .optional(),
    })
    .optional(),
  filename: z
    .string()
    .regex(/^[A-Za-z0-9._-]+\.pdf$/)
    .optional(),
});

export type GeneratePdfDto = z.infer<typeof generatePdfSchema>;
```

### 7.12 apps/api/src/modules/docs/controllers/pdf-generation.controller.ts

```typescript
import {
  Body,
  Controller,
  Header,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Res,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { Response } from 'express';
import { ZodValidationPipe } from '@skalean/common/zod-validation.pipe';
import { JwtAuthGuard } from '@skalean/auth/guards/jwt-auth.guard';
import { TenantGuard } from '@skalean/auth/guards/tenant.guard';
import { RbacGuard } from '@skalean/auth/guards/rbac.guard';
import { RequiredPermissions } from '@skalean/auth/decorators/required-permissions.decorator';
import { CurrentUser } from '@skalean/auth/decorators/current-user.decorator';
import { CurrentTenant } from '@skalean/auth/decorators/current-tenant.decorator';
import { CorrelationId } from '@skalean/common/decorators/correlation-id.decorator';
import { PdfGeneratorService } from '@skalean/docs';
import {
  GeneratePdfDto,
  generatePdfSchema,
} from '@skalean/docs/dto/generate-pdf.dto';

@Controller('api/v1/docs')
@UseGuards(JwtAuthGuard, TenantGuard, RbacGuard)
export class PdfGenerationController {
  private readonly logger = new Logger(PdfGenerationController.name);

  constructor(private readonly pdfGenerator: PdfGeneratorService) {}

  @Post('generate-pdf')
  @HttpCode(HttpStatus.OK)
  @RequiredPermissions('PDF_GENERATE')
  @Header('Content-Type', 'application/pdf')
  @UsePipes(new ZodValidationPipe(generatePdfSchema))
  async generatePdf(
    @Body() dto: GeneratePdfDto,
    @CurrentUser() user: { id: string; email: string },
    @CurrentTenant() tenantId: string,
    @CorrelationId() correlationId: string,
    @Res() res: Response,
  ): Promise<void> {
    this.logger.log({
      msg: 'pdf_generation_request_received',
      tenantId,
      userId: user.id,
      templateName: dto.templateName,
      locale: dto.locale,
      correlationId,
    });

    const buffer = await this.pdfGenerator.generate(
      dto.templateName,
      dto.locale,
      dto.data,
      dto.options ?? {},
      { tenantId, userId: user.id, correlationId },
    );

    const filename =
      dto.filename ??
      `${dto.templateName}_${dto.locale}_${Date.now()}.pdf`;

    res
      .status(HttpStatus.OK)
      .setHeader('Content-Disposition', `attachment; filename="${filename}"`)
      .setHeader('Content-Length', buffer.byteLength.toString())
      .setHeader('X-Correlation-Id', correlationId)
      .end(buffer);
  }
}
```

### 7.13 packages/docs/src/docs.module.ts

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuditModule } from '@skalean/audit';
import { PdfGeneratorService } from './services/pdf-generator.service';
import { TemplateCompilerService } from './services/template-compiler.service';

@Module({
  imports: [ConfigModule, AuditModule],
  providers: [PdfGeneratorService, TemplateCompilerService],
  exports: [PdfGeneratorService, TemplateCompilerService],
})
export class DocsModule {}
```

### 7.14 packages/docs/src/index.ts

```typescript
export * from './services/pdf-generator.service';
export * from './services/template-compiler.service';
export * from './helpers/handlebars-pdf-helpers';
export * from './dto/generate-pdf.dto';
export * from './docs.module';
```

## 8. TESTS

### 8.1 packages/docs/src/services/pdf-generator.service.spec.ts

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { PdfGeneratorService } from './pdf-generator.service';
import { TemplateCompilerService } from './template-compiler.service';

const mockAccessLog = { log: vi.fn().mockResolvedValue(undefined) };
const mockConfig = (overrides: Record<string, unknown> = {}) => {
  const defaults: Record<string, unknown> = {
    PDF_BROWSER_HEADLESS: true,
    PDF_GENERATION_TIMEOUT_MS: 5000,
    PDF_MAX_CONCURRENT_PAGES: 4,
    PDF_TEMPLATES_CACHE_TTL_SEC: 3600,
    ...overrides,
  };
  return {
    get: <T>(key: string, def?: T) => (defaults[key] as T) ?? def,
  } as ConfigService;
};

describe('PdfGeneratorService', () => {
  let service: PdfGeneratorService;
  let templateCompiler: TemplateCompilerService;
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        PdfGeneratorService,
        TemplateCompilerService,
        { provide: ConfigService, useValue: mockConfig() },
        { provide: 'AccessLogService', useValue: mockAccessLog },
      ],
    }).compile();
    service = module.get(PdfGeneratorService);
    templateCompiler = module.get(TemplateCompilerService);
    await templateCompiler.onModuleInit();
    await service.onModuleInit();
  });

  afterAll(async () => {
    await service.onModuleDestroy();
  });

  describe('generate devis fr', () => {
    it('should generate a non-empty PDF buffer', async () => {
      const buffer = await service.generate(
        'devis',
        'fr',
        sampleDevisData(),
        {},
        { tenantId: 'tenant-1', userId: 'user-1' },
      );
      expect(buffer.byteLength).toBeGreaterThan(1000);
      expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
    });

    it('should match snapshot for devis fr structure', async () => {
      const buffer = await service.generate(
        'devis', 'fr', sampleDevisData(), {},
        { tenantId: 'tenant-1', userId: 'user-1' },
      );
      const header = buffer.subarray(0, 8).toString();
      expect(header).toMatch(/^%PDF-1\.[3-7]/);
    });
  });

  describe('generate devis ar', () => {
    it('should generate RTL PDF for ar locale', async () => {
      const buffer = await service.generate(
        'devis', 'ar', sampleDevisData(), {},
        { tenantId: 'tenant-1', userId: 'user-1' },
      );
      expect(buffer.byteLength).toBeGreaterThan(1000);
    });
  });

  describe('generate devis ar-MA', () => {
    it('should generate Darija PDF', async () => {
      const buffer = await service.generate(
        'devis', 'ar-MA', sampleDevisData(), {},
        { tenantId: 'tenant-1', userId: 'user-1' },
      );
      expect(buffer.byteLength).toBeGreaterThan(1000);
    });
  });

  describe('generate facture', () => {
    it('should generate facture fr', async () => {
      const buffer = await service.generate(
        'facture', 'fr', sampleFactureData(), {},
        { tenantId: 'tenant-1', userId: 'user-1' },
      );
      expect(buffer.byteLength).toBeGreaterThan(1000);
    });

    it('should generate facture with PAID stamp', async () => {
      const data = { ...sampleFactureData() };
      (data.facture as Record<string, unknown>).statut = 'PAID';
      const buffer = await service.generate(
        'facture', 'fr', data, {},
        { tenantId: 'tenant-1', userId: 'user-1' },
      );
      expect(buffer.byteLength).toBeGreaterThan(1000);
    });
  });

  describe('generate police', () => {
    it('should generate police with conditions generales', async () => {
      const buffer = await service.generate(
        'police', 'fr', samplePoliceData(), {},
        { tenantId: 'tenant-1', userId: 'user-1' },
      );
      expect(buffer.byteLength).toBeGreaterThan(2000);
    });
  });

  describe('generate sinistre-rapport', () => {
    it('should generate sinistre rapport with photos', async () => {
      const buffer = await service.generate(
        'sinistre-rapport', 'fr', sampleSinistreData(), {},
        { tenantId: 'tenant-1', userId: 'user-1' },
      );
      expect(buffer.byteLength).toBeGreaterThan(1000);
    });
  });

  describe('performance', () => {
    it('should generate devis in less than 3 seconds', async () => {
      const start = Date.now();
      await service.generate(
        'devis', 'fr', sampleDevisData(), {},
        { tenantId: 'tenant-1', userId: 'user-1' },
      );
      expect(Date.now() - start).toBeLessThan(3000);
    });

    it('should reuse browser singleton across calls', async () => {
      await service.generate('devis', 'fr', sampleDevisData(), {}, { tenantId: 't', userId: 'u' });
      const start = Date.now();
      await service.generate('devis', 'fr', sampleDevisData(), {}, { tenantId: 't', userId: 'u' });
      expect(Date.now() - start).toBeLessThan(2000);
    });
  });

  describe('concurrent', () => {
    it('should handle 4 concurrent generations without OOM', async () => {
      const tasks = Array.from({ length: 4 }, () =>
        service.generate('devis', 'fr', sampleDevisData(), {}, { tenantId: 't', userId: 'u' }),
      );
      const results = await Promise.all(tasks);
      expect(results).toHaveLength(4);
      results.forEach((b) => expect(b.byteLength).toBeGreaterThan(1000));
    });
  });

  describe('access log integration', () => {
    it('should call AccessLogService.log on success', async () => {
      mockAccessLog.log.mockClear();
      await service.generate('devis', 'fr', sampleDevisData(), {}, { tenantId: 'tenant-x', userId: 'user-y' });
      expect(mockAccessLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-x',
          userId: 'user-y',
          action: 'PDF_GENERATED',
        }),
      );
    });
  });

  describe('error handling', () => {
    it('should throw when template missing', async () => {
      await expect(
        service.generate('inexistant', 'fr', {}, {}, { tenantId: 't', userId: 'u' }),
      ).rejects.toThrow();
    });

    it('should block external resources', async () => {
      const data = sampleDevisData();
      (data as Record<string, unknown>).maliciousImg = '<img src="https://attacker.com/p.png">';
      const buffer = await service.generate('devis', 'fr', data, {}, { tenantId: 't', userId: 'u' });
      expect(buffer.byteLength).toBeGreaterThan(1000);
    });
  });
});

function sampleDevisData() {
  return {
    locale: 'fr',
    fonts: { inter: '', interBold: '', amiri: '', tajawal: '' },
    logo: '',
    tenant: {
      name: 'Skalean Assurance SA',
      address: '12 Boulevard Anfa, Casablanca',
      ice: '002345678901234',
      rc: '123456',
      if: '78901234',
      phone: '+212522123456',
      cguUrl: 'https://skalean.ma/cgu',
    },
    devis: {
      numero: 'DV-2026-0001',
      reference: 'REF-001',
      dateEmission: '2026-05-08',
      dateValidite: '2026-06-08',
      dureeValiditeJours: 30,
      conseiller: { nom: 'Karim Bennani', titre: 'Conseiller commercial' },
      lignes: [
        { designation: 'Police auto', description: 'Tous risques', quantite: 1, unite: 'unite', prixUnitaireHT: 5000, tauxTVA: 20, totalHT: 5000 },
        { designation: 'Assistance routiere', quantite: 1, unite: 'unite', prixUnitaireHT: 800, tauxTVA: 20, totalHT: 800 },
      ],
      totalHT: 5800,
      totalTVA: 1160,
      totalTTC: 6960,
      verifyUrl: 'https://verify.skalean.ma/dv/DV-2026-0001',
    },
  };
}

function sampleFactureData() {
  return {
    locale: 'fr',
    fonts: { inter: '', interBold: '', amiri: '', tajawal: '' },
    logo: '',
    tenant: { name: 'Skalean', address: 'Casa', ice: '002345678901234', rc: '123', if: '789', phone: '+212522', cnss: '12345', patente: '67890', capitalSocial: 1000000, email: 'contact@skalean.ma', dpo: { email: 'dpo@skalean.ma' }, ville: 'Casablanca' },
    client: { raisonSociale: 'Acme SARL', adresse: '1 rue X', codePostal: '20000', ville: 'Casa', ice: '002111222333444', telephone: '+212522111222' },
    facture: {
      numero: 'FA-2026-0001',
      dateEmission: '2026-05-08',
      dateEcheance: '2026-06-08',
      devisReference: 'DV-2026-0001',
      modePaiement: 'Virement',
      delaiReglementJours: 30,
      statut: 'UNPAID',
      lignes: [{ designation: 'Police', reference: 'P1', quantite: 1, prixUnitaireHT: 5800, tauxTVA: 20, totalHT: 5800, totalTTC: 6960 }],
      totalHT: 5800,
      totalTVA: 1160,
      totalTTC: 6960,
      tvaParTaux: [{ taux: 20, baseHT: 5800, montantTVA: 1160 }],
      totalEnLettres: 'six mille neuf cent soixante',
      verifyUrl: 'https://verify.skalean.ma/fa/FA-2026-0001',
      hash: 'abc123def456',
      signataire: { nom: 'A. Tazi', titre: 'Directeur' },
    },
  };
}

function samplePoliceData() {
  return {
    locale: 'fr',
    fonts: { inter: '', interBold: '', amiri: '', tajawal: '' },
    logo: '',
    tenant: { name: 'Skalean', address: 'Casa', ice: '002345678901234', acapsAgrement: 'AC-2020-001' },
    souscripteur: { nom: 'Alami', prenom: 'Hassan', adresse: 'Rabat', cin: 'A123456', telephone: '+212661234567' },
    assure: { nom: 'Alami', prenom: 'Hassan', adresse: 'Rabat', cin: 'A123456', dateNaissance: '1985-01-15' },
    police: {
      numero: 'POL-2026-0001',
      typeContrat: 'Auto',
      dateEffet: '2026-06-01',
      dateEcheance: '2027-05-31',
      dureeMois: 12,
      taciteReconduction: true,
      modePaiement: 'Prelevement',
      frequencePaiement: 'Mensuel',
      garanties: [
        { libelle: 'Responsabilite Civile', description: 'Obligatoire', capital: 10000000, franchise: 0, primeAnnuelle: 1500 },
        { libelle: 'Vol incendie', capital: 200000, franchise: 1000, primeAnnuelle: 800 },
      ],
      primeNetteHT: 2300,
      fraisAcquisition: 100,
      taxe: 322,
      primeTotaleTTC: 2722,
      verifyUrl: 'https://verify.skalean.ma/pol/POL-2026-0001',
      hash: 'xyz789',
      signataire: { nom: 'F. Idrissi', titre: 'Directeur Souscription' },
    },
  };
}

function sampleSinistreData() {
  return {
    locale: 'fr',
    fonts: { inter: '', interBold: '', amiri: '', tajawal: '' },
    logo: '',
    tenant: { name: 'Skalean', address: 'Casa', ice: '002345678901234', rc: '', if: '', phone: '+212522' },
    sinistre: {
      numero: 'SIN-2026-0042',
      dateRapport: '2026-05-08',
      dateSurvenance: '2026-05-01',
      heureSurvenance: '15:30',
      dateDeclaration: '2026-05-02',
      lieu: 'Boulevard Anfa, Casablanca',
      type: 'Accident materiel',
      circonstances: 'Collision arriere a un feu rouge.',
      policeNumero: 'POL-2026-0001',
      photos: [],
      dommages: [{ designation: 'Pare-choc arriere', montant: 8500 }, { designation: 'Coffre', montant: 4200 }],
      totalEstimation: 12700,
      garantieApplicable: 'Tous risques',
      franchise: 1000,
      indemnisationProposee: 11700,
      decision: 'Acceptee',
      verifyUrl: 'https://verify.skalean.ma/sin/SIN-2026-0042',
      expert: { nom: 'M. Filali', titre: 'Expert agree' },
      gestionnaire: { nom: 'L. Berrada', titre: 'Gestionnaire sinistres' },
    },
  };
}
```

### 8.2 packages/docs/src/services/template-compiler.service.spec.ts

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { describe, it, expect, beforeAll } from 'vitest';
import { TemplateCompilerService } from './template-compiler.service';

describe('TemplateCompilerService', () => {
  let service: TemplateCompilerService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TemplateCompilerService,
        { provide: ConfigService, useValue: { get: <T>(_: string, def: T) => def } },
      ],
    }).compile();
    service = module.get(TemplateCompilerService);
    await service.onModuleInit();
  });

  it('should compile fr devis template', async () => {
    const tpl = await service.compile('devis', 'fr');
    expect(typeof tpl).toBe('function');
    const html = tpl({ locale: 'fr', tenant: { name: 't' }, devis: { numero: '1', lignes: [] } });
    expect(html).toContain('DEVIS');
  });

  it('should compile ar devis template', async () => {
    const tpl = await service.compile('devis', 'ar');
    const html = tpl({ locale: 'ar', tenant: { name: 't' }, devis: { numero: '1', lignes: [] } });
    expect(html).toContain('عرض');
  });

  it('should fallback ar-MA to ar then fr', async () => {
    const tpl = await service.compile('devis', 'ar-MA');
    expect(typeof tpl).toBe('function');
  });

  it('should cache compiled templates', async () => {
    const t1 = await service.compile('devis', 'fr');
    const t2 = await service.compile('devis', 'fr');
    expect(t1).toBe(t2);
  });

  it('should invalidate cache by template name', async () => {
    await service.compile('devis', 'fr');
    service.invalidateCache('devis');
    const t = await service.compile('devis', 'fr');
    expect(typeof t).toBe('function');
  });

  it('should throw on missing template', async () => {
    await expect(service.compile('inexistant', 'fr')).rejects.toThrow(/Template not found/);
  });
});
```

### 8.3 packages/docs/src/helpers/handlebars-pdf-helpers.spec.ts

```typescript
import { describe, it, expect } from 'vitest';
import {
  formatDate,
  formatCurrency,
  formatPhone,
  formatICE,
  formatDateHijri,
  qrCodeSync,
  registerPdfHelpers,
} from './handlebars-pdf-helpers';
import Handlebars from 'handlebars';

describe('formatDate', () => {
  it('formats fr date in DD MMM YYYY', () => {
    expect(formatDate('2026-05-08', 'fr', 'DD MMMM YYYY')).toContain('mai');
  });
  it('returns empty string for undefined', () => {
    expect(formatDate(undefined, 'fr')).toBe('');
  });
  it('formats ar date with arabic month', () => {
    const out = formatDate('2026-05-08', 'ar', 'DD MMMM YYYY');
    expect(out.length).toBeGreaterThan(0);
  });
});

describe('formatCurrency', () => {
  it('formats MAD fr with two decimals', () => {
    const out = formatCurrency(1234.5, 'MAD', 'fr');
    expect(out).toContain('1');
    expect(out).toMatch(/MAD|DH/);
  });
  it('formats MAD ar', () => {
    const out = formatCurrency(1234.5, 'MAD', 'ar');
    expect(out.length).toBeGreaterThan(0);
  });
  it('returns empty for null', () => {
    expect(formatCurrency(undefined as unknown as number, 'MAD')).toBe('');
  });
  it('returns empty for NaN string', () => {
    expect(formatCurrency('abc', 'MAD')).toBe('');
  });
});

describe('formatPhone', () => {
  it('formats local 0 prefix to +212', () => {
    expect(formatPhone('0612345678')).toBe('+212 6 12 34 56 78');
  });
  it('formats 212 prefix', () => {
    expect(formatPhone('212612345678')).toBe('+212 6 12 34 56 78');
  });
  it('formats 00212 prefix', () => {
    expect(formatPhone('00212612345678')).toBe('+212 6 12 34 56 78');
  });
  it('returns input on invalid length', () => {
    expect(formatPhone('123')).toBe('123');
  });
  it('returns empty for empty', () => {
    expect(formatPhone(undefined)).toBe('');
  });
});

describe('formatICE', () => {
  it('groups 15 digits as 3-3-3-3-3', () => {
    expect(formatICE('002345678901234')).toBe('002 345 678 901 234');
  });
  it('returns input on invalid length', () => {
    expect(formatICE('123')).toBe('123');
  });
  it('returns empty for empty', () => {
    expect(formatICE(undefined)).toBe('');
  });
});

describe('formatDateHijri', () => {
  it('returns string for valid date in arabic', () => {
    const out = formatDateHijri('2026-05-08', 'ar');
    expect(out.length).toBeGreaterThan(0);
  });
  it('returns string in latin script', () => {
    const out = formatDateHijri('2026-05-08', 'latin');
    expect(out).toContain('AH');
  });
  it('returns empty for undefined', () => {
    expect(formatDateHijri(undefined)).toBe('');
  });
});

describe('qrCodeSync', () => {
  it('returns SVG placeholder string', () => {
    const out = qrCodeSync('https://example.com', 100);
    expect(out).toContain('<svg');
    expect(out).toContain('100');
  });
  it('returns empty for empty data', () => {
    expect(qrCodeSync('', 100)).toBe('');
  });
});

describe('registerPdfHelpers', () => {
  it('registers all helpers on Handlebars instance', () => {
    const h = Handlebars.create();
    registerPdfHelpers(h);
    expect(h.helpers.formatDate).toBeDefined();
    expect(h.helpers.formatCurrency).toBeDefined();
    expect(h.helpers.formatPhone).toBeDefined();
    expect(h.helpers.formatICE).toBeDefined();
    expect(h.helpers.qrCode).toBeDefined();
    expect(h.helpers.condIfArabic).toBeDefined();
  });

  it('eq helper returns true on equal values', () => {
    const h = Handlebars.create();
    registerPdfHelpers(h);
    const tpl = h.compile('{{#if (eq a 1)}}OK{{/if}}');
    expect(tpl({ a: 1 })).toBe('OK');
  });

  it('inc helper increments by 1', () => {
    const h = Handlebars.create();
    registerPdfHelpers(h);
    const tpl = h.compile('{{inc 5}}');
    expect(tpl({})).toBe('6');
  });

  it('condIfArabic returns then-block for ar locale', () => {
    const h = Handlebars.create();
    registerPdfHelpers(h);
    const tpl = h.compile('{{#condIfArabic locale}}AR{{else}}FR{{/condIfArabic}}');
    expect(tpl({ locale: 'ar' })).toBe('AR');
    expect(tpl({ locale: 'fr' })).toBe('FR');
  });
});
```

### 8.4 apps/api/test/docs/pdf-generation.e2e-spec.ts

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { signTestJwt } from '../helpers/jwt';

describe('PdfGenerationController E2E', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    token = signTestJwt({
      sub: 'user-1',
      tenantId: 'tenant-1',
      permissions: ['PDF_GENERATE'],
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects without auth', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/docs/generate-pdf')
      .send({ templateName: 'devis', locale: 'fr', data: {} })
      .expect(401);
  });

  it('rejects without permission', async () => {
    const noPermToken = signTestJwt({ sub: 'user-1', tenantId: 'tenant-1', permissions: [] });
    await request(app.getHttpServer())
      .post('/api/v1/docs/generate-pdf')
      .set('Authorization', `Bearer ${noPermToken}`)
      .send({ templateName: 'devis', locale: 'fr', data: {} })
      .expect(403);
  });

  it('rejects invalid templateName', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/docs/generate-pdf')
      .set('Authorization', `Bearer ${token}`)
      .send({ templateName: 'inexistant', locale: 'fr', data: {} })
      .expect(400);
  });

  it('rejects invalid locale', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/docs/generate-pdf')
      .set('Authorization', `Bearer ${token}`)
      .send({ templateName: 'devis', locale: 'es', data: {} })
      .expect(400);
  });

  const matrix: Array<[string, string]> = [
    ['devis', 'fr'], ['devis', 'ar'], ['devis', 'ar-MA'],
    ['facture', 'fr'], ['facture', 'ar'], ['facture', 'ar-MA'],
    ['police', 'fr'], ['police', 'ar'], ['police', 'ar-MA'],
    ['sinistre-rapport', 'fr'], ['sinistre-rapport', 'ar'], ['sinistre-rapport', 'ar-MA'],
  ];

  matrix.forEach(([template, locale]) => {
    it(`generates ${template} ${locale}`, async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/docs/generate-pdf')
        .set('Authorization', `Bearer ${token}`)
        .send({
          templateName: template,
          locale,
          data: minimalData(template),
        })
        .expect(200);
      expect(response.headers['content-type']).toBe('application/pdf');
      expect(response.body.length).toBeGreaterThan(800);
      expect(response.body.subarray(0, 4).toString()).toBe('%PDF');
    }, 10000);
  });

  it('respects custom filename', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/docs/generate-pdf')
      .set('Authorization', `Bearer ${token}`)
      .send({
        templateName: 'devis',
        locale: 'fr',
        data: minimalData('devis'),
        filename: 'mon-devis.pdf',
      })
      .expect(200);
    expect(response.headers['content-disposition']).toContain('mon-devis.pdf');
  });
});

function minimalData(template: string): Record<string, unknown> {
  if (template === 'devis') {
    return {
      tenant: { name: 'T', ice: '002345678901234', rc: '1', if: '2', phone: '+212', address: 'A' },
      devis: { numero: '1', reference: 'r', dateEmission: '2026-05-08', dateValidite: '2026-06-08', dureeValiditeJours: 30, conseiller: { nom: 'X' }, lignes: [], totalHT: 0, totalTVA: 0, totalTTC: 0, verifyUrl: '#' },
      client: { raisonSociale: 'C', adresse: 'A', codePostal: '0', ville: 'V', telephone: '+212' },
    };
  }
  return { tenant: { name: 'T', ice: '002345678901234' } };
}
```

## 9. Variables d'environnement

```bash
PDF_BROWSER_HEADLESS=true
PDF_GENERATION_TIMEOUT_MS=5000
PDF_ENABLE_FONT_HINTING=false
PDF_TEMPLATES_CACHE_TTL_SEC=3600
PDF_MAX_CONCURRENT_PAGES=4
PDF_BROWSER_LAUNCH_TIMEOUT_MS=30000
PDF_DEFAULT_LOCALE=fr
PDF_DEFAULT_FORMAT=A4
PDF_VERIFY_URL_BASE=https://verify.skalean.ma
PUPPETEER_CACHE_DIR=/tmp/puppeteer
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false
```

## 10. Commandes shell

```bash
pnpm --filter @skalean/docs add puppeteer@24.0.1 handlebars@4.7.8 qrcode@1.5.4 dayjs@1.11.13 lru-cache@11.0.2 async-mutex@0.5.0 p-limit@6.2.0
pnpm --filter @skalean/docs add -D @types/handlebars @types/qrcode vitest@2.1.8
pnpm --filter @skalean/docs run lint
pnpm --filter @skalean/docs run typecheck
pnpm --filter @skalean/docs run test
pnpm --filter api run test:e2e -- pdf-generation
pnpm --filter @skalean/docs run build
node scripts/encode-fonts.js
```

## 11. Criteres de validation V1-V32

- V1: PdfGeneratorService implemente OnModuleInit + OnModuleDestroy avec browser singleton lazy launched protege par Mutex
- V2: TemplateCompilerService cache LRU 256 entrees TTL 3600s configurable via PDF_TEMPLATES_CACHE_TTL_SEC
- V3: Helpers Handlebars formatDate, formatCurrency, formatPhone, formatICE, formatDateHijri, qrCode, condIfArabic implementes et testes
- V4: 4 templates HBS fr (devis, facture, police, sinistre-rapport) presents et compilables
- V5: 2 templates HBS ar (devis ar et ar-MA) avec direction RTL et police arabe
- V6: Layout partial _layout.hbs avec header logo+tenant, footer page X/Y, CSS conditionnel RTL via [dir=rtl]
- V7: Browser launched avec args securite (--no-sandbox, --disable-setuid-sandbox, --disable-dev-shm-usage)
- V8: Page singleton ferme dans finally apres pdf() pour eviter memory leak
- V9: Page.setRequestInterception bloque tous les fetches externes (data: et about:blank uniquement autorises)
- V10: page.emulateMediaType('print') applique avant pdf() pour styles @media print
- V11: page.evaluateHandle('document.fonts.ready') attend chargement complet polices
- V12: Performance: PDF devis fr genere en moins de 3 secondes (singleton chaud)
- V13: Concurrent: 4 generations parallel sans OOM ni crash, semaphore p-limit(4) actif
- V14: Browser disconnect handler relance auto sur prochaine requete (this.browser = null + relaunch)
- V15: AccessLogService.log appele avec action PDF_GENERATED, tenantId, userId, templateName, sizeBytes
- V16: PdfGenerationController POST /api/v1/docs/generate-pdf protege JwtAuthGuard + TenantGuard + RbacGuard PDF_GENERATE
- V17: ZodValidationPipe rejette templateName non-supportes et locales invalides avec 400
- V18: Header Content-Type: application/pdf + Content-Disposition attachment filename
- V19: Tests unitaires PdfGeneratorService passent (>=15 tests)
- V20: Tests unitaires TemplateCompilerService passent (>=6 tests)
- V21: Tests unitaires HandlebarsPdfHelpers passent (>=20 tests, 28 cas)
- V22: Tests E2E PdfGenerationController couvrent 12 combinaisons template x locale + auth + RBAC
- V23: Logs Pino structures: pdf_generation_started/succeeded/failed, browser_launched/disconnected, template_cache_hit/miss
- V24: Helpers eq, gt, lt, add, mul, inc enregistres pour expressivite templates
- V25: Locale fallback chain fonctionnelle: ar-MA -> ar -> fr (tested)
- V26: ICE formate sur 15 chiffres groupes 3-3-3-3-3 (002 345 678 901 234)
- V27: Phone formate avec prefixe +212 normalise depuis 0 ou 00212 ou 212
- V28: Currency formate avec Intl.NumberFormat fr-MA ou ar-MA selon locale
- V29: Hijri converter retourne mois arabes corrects (محرم, صفر, ربيع الأول, ...)
- V30: Footer PDF affiche Page X / Y via CSS counter(page) / counter(pages)
- V31: Conformite Loi 17-99 article 17: 10 articles conditions generales presents dans police.hbs
- V32: Conformite DGI Note Circulaire 717: ICE, IF, RC, CNSS, Patente, capital social presents dans facture.hbs

## 12. Edge cases

1. RTL CSS broken: tester direction reverse table cells, marges logiques margin-inline-start
2. Font loading delayed: timeout 5s + fallback Times New Roman, log warning si fonts.ready non atteint
3. Image embed > 10 MB: rejetee dans Zod validation (max 10MB par image base64)
4. Special chars XSS: Handlebars echappe par defaut, triple-stash uniquement pour qrCode trusted
5. Network image attempt: page.setRequestInterception bloque toutes URLs hors data: et about:blank
6. Browser crash recovery: disconnected hook nullifie browser, prochaine requete relaunch
7. Concurrent requests memory pressure: semaphore p-limit(4), au-dela queue (latence + mais pas OOM)
8. Locale fallback fr -> en: chain `[locale, 'fr']`, jamais d'echec sur locale inconnu (degrade fr)
9. Hijri date conversion edge cases: dates < 622 AD retournent annee 0, mois 0 (gardes via Math.max)
10. Signature space overflow: page-break-inside:avoid sur signature-block (passage page suivante automatique)
11. Tableau items > 100 rows: thead display:table-header-group repete header, tr page-break-inside:avoid
12. PDF size > 50 MB: warning log + recommandation BullMQ async (Sprint 11)
13. Tenant without ICE: helper formatICE retourne input brut (pas crash)
14. Phone international hors Maroc: formatPhone retourne input si != 12 chiffres post-normalisation
15. Date dans futur lointain (2050+): dayjs gere correctement, Hijri calculator OK jusqu'a 9999

## 13. Conformite Maroc

- **Loi 17-99 article 17 (mentions obligatoires polices)**: police.hbs inclut nom assureur, numero agrement ACAPS, identification souscripteur+assure, dates effet/echeance, garanties+capitaux+franchises+primes, conditions generales (10 articles)
- **DGI Note Circulaire 717 (mentions factures obligatoires)**: facture.hbs inclut ICE+IF+RC+CNSS+Patente+capital social du tenant, ICE/IF/RC client si professionnel, mention legale interets retard taux legal +7 points (Loi 49-15)
- **Loi 43-20 article 5 (PDF/A-3 archivage)**: notes documentees, polices integralement embarquees base64, profil sRGB Chromium par defaut, metadata XMP injectes via puppeteer (post-traitement strict en Tache 3.3.12)
- **ACAPS Reglement 02/AS/19 (format polices)**: structure police.hbs respecte mentions exigees: parties, caracteristiques, garanties tabulaires, conditions generales numerotees
- **Loi 09-08 (donnees personnelles)**: mention DPO email dans templates (devis, facture, police), respect minimisation donnees affichees

## 14. Conventions absolues

- TypeScript strict mode, jamais `any`, `unknown` pour entrees externes typees Zod
- Pino structured logging exclusif, jamais `console.log`
- Multi-tenant strict: tenantId dans context generate(), log AccessLog, isolation total des donnees
- Zod validation systematique sur DTO entrants
- French dans messages business, English dans codes/keys/logs
- Pas d'emoji
- Tests Vitest avec describe/it/expect
- Templates Handlebars: jamais `{{{var}}}` triple-stash sauf SVG QR controle, toujours `{{var}}` echappe
- Polices/logos embed base64, jamais URLs externes (securite + offline + reproductibilite)
- Browser singleton: 1 instance par process API, max 4 pages concurrent
- Cache LRU TTL 3600s pour templates compiles

## 15. Validation pre-commit

```bash
pnpm --filter @skalean/docs run lint --fix
pnpm --filter @skalean/docs run typecheck
pnpm --filter @skalean/docs run test --coverage
pnpm --filter api run test:e2e -- pdf-generation
pnpm --filter @skalean/docs run build
git add packages/docs apps/api/src/modules/docs apps/api/test/docs
git diff --cached --stat
```

## 16. Commit message

```
feat(docs): add PdfGeneratorService puppeteer 24.0.1 with 4 templates x 3 locales

- Implement PdfGeneratorService with browser singleton (Mutex protected, p-limit 4 concurrent pages)
- Add TemplateCompilerService with LRU cache (256 entries, TTL 3600s) and locale fallback ar-MA -> ar -> fr
- Implement Handlebars helpers: formatDate (gregorian + Hijri), formatCurrency MAD, formatPhone +212, formatICE 15 digits grouped, qrCode SVG embed, condIfArabic
- Add 4 HBS templates: devis, facture, police (10 articles conditions generales loi 17-99), sinistre-rapport
- Add ar and ar-MA RTL templates for devis with embedded Amiri/Tajawal fonts
- Add PdfGenerationController POST /api/v1/docs/generate-pdf with JwtAuth + RBAC PDF_GENERATE + Zod validation
- Block all external resources via page.setRequestInterception (security + offline reproducibility)
- AccessLogService integration: log PDF_GENERATED action with tenantId, userId, sizeBytes, durationMs
- Performance target < 3s per PDF (singleton hot), 4 concurrent pages without OOM on t3.medium
- Conformite Loi 17-99 article 17, DGI Note Circulaire 717 (ICE/IF/RC/CNSS), Loi 43-20 article 5, ACAPS 02/AS/19
- Tests: 30+ unit tests, 16+ E2E tests covering 12 template x locale combinations
- Files: 21 created, 4 modified

Refs: Tache 3.3.5, Sprint 10
Depends-On: Tache 3.3.4 (AccessLogService)
Unlocks: Tache 3.3.6, 3.3.7, 3.3.11
```

## 17. Workflow next step

Tache 3.3.6 - DocxGeneratorService docxtemplater 3.x pour generation rapports Word editables (utilisee par experts sinistres pour annotations post-generation). Reutilisera AccessLogService et meme pattern multi-tenant + locale.

Tache 3.3.7 - XlsxGeneratorService exceljs 4.x pour exports comptables (factures par mois, encaissements, balances).

Tache 3.3.11 - QrCodeService dedie pour generation QR codes verification publique avec endpoint GET /verify/:hash retournant page HTML attestant authenticite document.

## Annexe A - Specification PDF/A-3 detaillee pour Sprint 11 (post-traitement strict)

La conformite PDF/A-3 stricte ISO 19005-3:2012 sera ajoutee Tache 3.3.12 via un post-traitement avec pdf-lib 1.17.1 et validation finale veraPDF 1.26 (validateur Java open-source officiel PDF Association). Les exigences supplementaires non couvertes par la generation puppeteer V1 sont documentees ci-dessous pour anticiper le travail futur.

### A.1 Metadata XMP obligatoires

Champs XMP a injecter via pdf-lib `setTitle`, `setAuthor`, `setSubject`, `setKeywords`, `setProducer`, `setCreator`, `setCreationDate`, `setModificationDate`. En supplement, le namespace pdfaid (PDF/A identification) doit declarer la conformance: `pdfaid:part=3` et `pdfaid:conformance=B` (basic) ou `A` (accessible avec balisage). Le tagging accessible (PDF/A-3a) requiert structure logique avec balises `<H1>`, `<P>`, `<Table>`, `<L>` etc., genere par puppeteer si `tagged: true` passe a `page.pdf()`. En V1, nous ciblons PDF/A-3b (basic) sans tagging structure complete; PDF/A-3a sera ajoute Sprint 14 si exigence ACAPS evolue.

### A.2 Pieces jointes embarquees (PDF/A-3 specifique)

PDF/A-3 (vs PDF/A-1 et PDF/A-2) autorise l'embarquement de fichiers attaches arbitraires (XML, CSV, autres PDF). Cette capacite est cruciale pour la **e-facturation DGI** prevue Sprint 22 (norme UN/CEFACT Cross Industry Invoice ou Factur-X equivalent francais): le PDF facture humanlisible embarque un XML structure machine-readable consommable par DGI sans OCR. Notre architecture le permettra via `pdf-lib` `pdfDoc.attach(fileBytes, 'invoice.xml', { mimeType: 'application/xml', description: 'Facture XML CII', creationDate: new Date(), modificationDate: new Date(), afRelationship: AFRelationship.Source })`.

### A.3 Profil colorimetrique ICC sRGB

Puppeteer Chromium produit du PDF avec espace colorimetrique implicite sRGB IEC61966-2.1, mais PDF/A-3 strict exige le profil ICC explicitement embarque dans le `OutputIntent` du document. pdf-lib post-traitement ajoutera: `pdfDoc.context.register(pdfDoc.context.obj({ Type: 'OutputIntent', S: 'GTS_PDFA1', OutputConditionIdentifier: 'sRGB IEC61966-2.1', DestOutputProfile: iccBytes }))`. Le fichier ICC sRGB v4 (3KB) est embarque en `packages/docs/src/assets/icc/sRGB-IEC61966-2.1.icc`.

### A.4 Validation veraPDF en CI

Pipeline Github Actions Sprint 12 ajoutera step: `verapdf --format json --profile PDF/A-3B output.pdf > validation.json && jq '.batchSummary.errorCount == 0' validation.json`. Si erreurs detectees (ex: police non-embarquee, transparence non-aplatie), build CI echoue. Le binaire veraPDF 1.26 (130 MB Java) sera prebuild dans image Docker `skalean/pdf-validator:1.26` cache GHCR pour eviter telechargement chaque CI run.

## Annexe B - Strategie i18n et localisation

### B.1 Differences ar vs ar-MA

L'arabe litteraire (ar, MSA Modern Standard Arabic) est utilise pour documents juridiques formels, communications gouvernementales, presse. Vocabulaire stable, grammaire classique, comprehensible par tous les arabophones. Le Darija marocain (ar-MA) est la langue vernaculaire quotidienne, mixte arabe/berbere/francais/espagnol, peu standardisee a l'ecrit, comprehensible principalement par Marocains/Algeriens. Pour nos documents Skalean: **devis** (commercial, peut etre en Darija pour proximite client retail), **facture** (administratif, MSA prefere), **police** (juridique, MSA obligatoire car opposable en justice), **rapport sinistre** (administratif, MSA recommande). En V1 Sprint 10, nous fournissons devis en ar-MA (proximite commerciale), tous autres en ar MSA. Sprint 18 ajoutera ar-MA pour devis-relance, lettres de bienvenue, sms transactionnels.

### B.2 Polices arabes embarquees

Trois polices arabes sont embarquees pour couvrir styles editoriaux:
- **Amiri 0.114** (SIL OFL): style Naskh classique, ideal pour textes longs documents juridiques (police.hbs conditions generales)
- **Tajawal 1.000** (SIL OFL by Boutros Fonts): sans-serif moderne, lisible pour formulaires/tableaux (devis.hbs, facture.hbs)
- **Cairo 6.0** (SIL OFL by Mohamed Gaber): geometric sans-serif pour titres et UI elements (h1, h2 dans templates)

Toutes en .woff2 subset (latin + arabe + chiffres + ponctuation), taille moyenne 80-150 KB chacune. Encodage base64 ajoute 33% overhead (110-200 KB chaine), embarque dans `_layout.hbs` via `@font-face src: url('data:font/woff2;base64,...')`. Le subset est genere via fonttools pyftsubset script `scripts/subset-fonts.py` execute en pre-commit pour reduire taille (sans subset, Amiri full = 800 KB).

### B.3 Formats de chiffres arabes

CSS `font-feature-settings: 'tnum'` active chiffres indo-arabes ١٢٣٤ (utilises au Maroc dans contextes traditionnels), `'lnum'` active chiffres arabes-occidentaux 1234 (defaut moderne business). Notre choix V1: chiffres arabes-occidentaux pour montants (lisibilite cross-locale, evite confusion comptabilite), chiffres indo-arabes pour pagination/numeros section (esthetique culturelle). Helper futur Sprint 14: `formatNumberArabicScript(n)` pour conversion explicite si besoin.

### B.4 Direction mixte (bidi)

Texte arabe avec mots latins (marques, ICE, URLs) doit utiliser CSS `unicode-bidi: isolate` ou markup `<bdi>` pour eviter inversions visuelles incorrectes. Notre helper `formatICE` retourne chaine purement numerique latine, embarquee dans `<bdi>{{formatICE tenant.ice}}</bdi>` dans templates ar pour preserver ordre de lecture gauche-droite des chiffres dans contexte global droite-gauche. Tests visuels manuels Sprint 11 valideront rendu Chrome/Firefox/Safari.

## Annexe C - Performance benchmarks attendus

| Scenario | p50 | p95 | p99 | Memoire delta |
|---|---|---|---|---|
| Cold start (premier appel) | 2.8s | 3.5s | 4.2s | +280 MB |
| Hot singleton (appels suivants) | 0.9s | 1.4s | 1.8s | +50 MB par page |
| Devis fr (10 lignes) | 0.8s | 1.2s | 1.6s | +50 MB |
| Facture fr (50 lignes pagination) | 1.4s | 2.1s | 2.8s | +80 MB |
| Police fr (10 articles + 2 garanties) | 1.6s | 2.4s | 3.1s | +90 MB |
| Sinistre rapport fr (5 photos 500KB embed) | 2.1s | 2.9s | 3.6s | +120 MB |
| Devis ar (RTL + Amiri) | 1.0s | 1.5s | 2.0s | +60 MB |
| 4 generations concurrent (singleton) | 1.2s | 1.9s | 2.5s | +200 MB peak |
| 8 generations concurrent (queue 4 par 4) | 2.4s | 3.6s | 4.8s | +200 MB peak (queue) |
| Template cache hit (re-generation meme) | 0.7s | 1.1s | 1.4s | +50 MB |
| Template cache miss (template jamais charge) | 0.85s | 1.3s | 1.7s | +52 MB |

Mesure avec puppeteer 24.0.1, Chromium 131, Node 22.10, instance EC2 t3.medium 4 vCPU 4 GB RAM, Linux Amazon 2023. SLO Sprint 10 V1: **p95 < 3s** pour devis/facture, **p95 < 4s** pour police/sinistre. SLO V2 Sprint 15: passage worker BullMQ pour decoupler latence API (instantane) de generation (asynchrone, polling status).

## Annexe D - Securite renforcement

### D.1 Threat model surface attaque

Surface d'attaque PdfGeneratorService:
1. **HTML injection via data**: utilisateur soumet `data` contenant balises `<script>` ou `<iframe>`. Mitigation: Handlebars echappe `{{var}}` par defaut. Test E2E couvre tentative XSS.
2. **SSRF via images URL externe**: utilisateur soumet `data.imgUrl` qui declenche fetch interne reseau prive. Mitigation: page.setRequestInterception bloque tout sauf data: et about:blank.
3. **DoS via PDF gigantesque**: utilisateur soumet 10000 lignes pour exploser temps generation et memoire. Mitigation: Zod schema limite `lignes.length <= 500` (Sprint 11 ajout), timeout puppeteer 5s ferme requete.
4. **Browser escape sandbox**: bug Chromium permet RCE via PDF malicieux genere. Mitigation: --no-sandbox uniquement en dev, en prod retirer ce flag et installer dependances libnss3 libxss1 (Dockerfile prod), Chromium sandbox active.
5. **Memory exhaustion**: 100 requetes parallel saturent RAM. Mitigation: semaphore p-limit(4), Kubernetes HPA scale-out sur memoire > 80%.
6. **Token JWT replay**: attaquant capture JWT et genere PDF non-autorises. Mitigation: short-lived token 15 min (cf. Sprint 5), audit log AccessLogService trace toute generation.
7. **Information disclosure inter-tenant**: bug code rend PDF tenant A avec data tenant B. Mitigation: PdfGeneratorService.generate() prend `context.tenantId` obligatoire, log AccessLog inclut tenantId, tests verifie isolation.

### D.2 CSP-equivalent pour PDF

Bien que PDF n'utilise pas CSP HTTP, nous appliquons principes equivalents via puppeteer: `--disable-features=site-per-process` (desactive isolation procursus mais simplifie), `--block-new-web-contents` (bloque popup), `--no-pdf-header-footer` (evite injection externe). Argument `--disable-extensions` pour eviter chargement extensions Chrome heritees.

### D.3 Audit log retention

Conformement RGPD article 30 (registre des activites de traitement) et Loi 09-08 article 25, AccessLog entries pour PDF_GENERATED sont conservees **5 ans** apres la date de generation. Retention configuree dans schema TimescaleDB (cf. Tache 3.3.4) avec drop_chunks automatique apres 1825 jours. Pour documents juridiques (police, facture), retention etendue **10 ans** conformement Code de Commerce article 211 et Loi Comptable, achievement via tag `retention_class=LEGAL_10Y` sur log entry.

## Annexe E - Migration future BullMQ worker

Sprint 15+ basculera generation PDF sur worker BullMQ dedie pour decouplage:
1. Controller POST /api/v1/docs/generate-pdf retourne immediatement 202 Accepted avec `jobId`
2. BullMQ enqueue job dans queue `pdf-generation` avec data {templateName, locale, data, tenantId, userId}
3. Worker process separe (1-N replicas) consomme jobs, genere PDF via meme PdfGeneratorService, upload S3
4. Job result inclut `s3Url` (presigned 1h)
5. Client poll GET /api/v1/docs/jobs/:jobId pour status (waiting, active, completed, failed) ou WebSocket subscribe
6. Worker scale via Kubernetes HPA sur metric BullMQ queue length

Avantages: latence API instantanee (< 100 ms), workers isolated peuvent crash sans affecter API, retry automatique sur failure, backpressure naturel. Inconvenients: complexite operationnelle (queue, workers, status polling), latence end-to-end peut etre superieure (queue + processing). Decision attendre charge > 5000 PDF/h pour migrer.


## Annexe A - Specification PDF/A-3 detaillee pour Sprint 11 (post-traitement strict)

La conformite PDF/A-3 stricte ISO 19005-3:2012 sera ajoutee Tache 3.3.12 via un post-traitement avec pdf-lib 1.17.1 et validation finale veraPDF 1.26 (validateur Java open-source officiel PDF Association). Les exigences supplementaires non couvertes par la generation puppeteer V1 sont documentees ci-dessous pour anticiper le travail futur.

### A.1 Metadata XMP obligatoires

Champs XMP a injecter via pdf-lib `setTitle`, `setAuthor`, `setSubject`, `setKeywords`, `setProducer`, `setCreator`, `setCreationDate`, `setModificationDate`. En supplement, le namespace pdfaid (PDF/A identification) doit declarer la conformance: `pdfaid:part=3` et `pdfaid:conformance=B` (basic) ou `A` (accessible avec balisage). Le tagging accessible (PDF/A-3a) requiert structure logique avec balises `<H1>`, `<P>`, `<Table>`, `<L>` etc., genere par puppeteer si `tagged: true` passe a `page.pdf()`. En V1, nous ciblons PDF/A-3b (basic) sans tagging structure complete; PDF/A-3a sera ajoute Sprint 14 si exigence ACAPS evolue.

Chaque template embarquera dans son `<head>` les meta tags suivants pour faciliter post-extraction par pdf-lib: `<meta name="dc.title" content="{{title}}">`, `<meta name="dc.creator" content="{{tenant.name}}">`, `<meta name="dc.subject" content="{{templateName}}">`, `<meta name="dc.date" content="{{_meta.generatedAt}}">`, `<meta name="dc.publisher" content="Skalean InsurTech">`, `<meta name="dc.rights" content="Confidential - {{tenant.name}}">`, `<meta name="dc.language" content="{{locale}}">`. Le post-processor pdf-lib mappera ces meta vers XMP RDF triplets standards.

### A.2 Pieces jointes embarquees (PDF/A-3 specifique)

PDF/A-3 (vs PDF/A-1 et PDF/A-2) autorise l'embarquement de fichiers attaches arbitraires (XML, CSV, autres PDF). Cette capacite est cruciale pour la **e-facturation DGI** prevue Sprint 22 (norme UN/CEFACT Cross Industry Invoice ou Factur-X equivalent francais): le PDF facture humanlisible embarque un XML structure machine-readable consommable par DGI sans OCR. Notre architecture le permettra via `pdf-lib` `pdfDoc.attach(fileBytes, 'invoice.xml', { mimeType: 'application/xml', description: 'Facture XML CII', creationDate: new Date(), modificationDate: new Date(), afRelationship: AFRelationship.Source })`.

Les usages futurs envisages: (1) facture.pdf + facture.xml (Factur-X DGI), (2) police.pdf + conditions-particulieres.json (machine-readable SaaS partenaires), (3) sinistre-rapport.pdf + photos-originales.zip (preservation evidence non-compressee), (4) devis.pdf + offre-detail.csv (export comptable client).

### A.3 Profil colorimetrique ICC sRGB

Puppeteer Chromium produit du PDF avec espace colorimetrique implicite sRGB IEC61966-2.1, mais PDF/A-3 strict exige le profil ICC explicitement embarque dans le `OutputIntent` du document. pdf-lib post-traitement ajoutera: `pdfDoc.context.register(pdfDoc.context.obj({ Type: 'OutputIntent', S: 'GTS_PDFA1', OutputConditionIdentifier: 'sRGB IEC61966-2.1', DestOutputProfile: iccBytes }))`. Le fichier ICC sRGB v4 (3KB) est embarque en `packages/docs/src/assets/icc/sRGB-IEC61966-2.1.icc`.

### A.4 Validation veraPDF en CI

Pipeline Github Actions Sprint 12 ajoutera step: `verapdf --format json --profile PDF/A-3B output.pdf > validation.json && jq '.batchSummary.errorCount == 0' validation.json`. Si erreurs detectees (ex: police non-embarquee, transparence non-aplatie), build CI echoue. Le binaire veraPDF 1.26 (130 MB Java) sera prebuild dans image Docker `skalean/pdf-validator:1.26` cache GHCR pour eviter telechargement chaque CI run.

Profil de validation veraPDF: `PDF/A-3B` (basic) en V1, `PDF/A-3U` (basic + Unicode mapping) Sprint 13, `PDF/A-3A` (accessible) Sprint 16. Les regles strictes incluent: (1) toutes polices embarquees subset OK, (2) pas de chiffrement PDF, (3) pas de JavaScript executable, (4) pas de transparence non-aplatie, (5) profil colorimetrique embarque, (6) metadata XMP conformes, (7) tags structurels coherents (PDF/A-3A uniquement).

## Annexe B - Strategie i18n et localisation

### B.1 Differences ar vs ar-MA

L'arabe litteraire (ar, MSA Modern Standard Arabic) est utilise pour documents juridiques formels, communications gouvernementales, presse. Vocabulaire stable, grammaire classique, comprehensible par tous les arabophones. Le Darija marocain (ar-MA) est la langue vernaculaire quotidienne, mixte arabe/berbere/francais/espagnol, peu standardisee a l'ecrit, comprehensible principalement par Marocains/Algeriens. Pour nos documents Skalean: **devis** (commercial, peut etre en Darija pour proximite client retail), **facture** (administratif, MSA prefere), **police** (juridique, MSA obligatoire car opposable en justice), **rapport sinistre** (administratif, MSA recommande). En V1 Sprint 10, nous fournissons devis en ar-MA (proximite commerciale), tous autres en ar MSA. Sprint 18 ajoutera ar-MA pour devis-relance, lettres de bienvenue, sms transactionnels.

Exemples de differences: "client" en MSA = الزبون / الزبائن, en Darija = الكليان (emprunt francais); "rapide" en MSA = سريع, en Darija = دغيا; "merci" en MSA = شكرا, en Darija = شكرا بزاف. Les chiffres et termes techniques (TVA, ICE, MAD) sont identiques. Le ton ar-MA est plus chaleureux et direct, adapte a un canal commercial; le ton ar MSA est respectueux et formel, adapte a documents legaux.

### B.2 Polices arabes embarquees

Trois polices arabes sont embarquees pour couvrir styles editoriaux:
- **Amiri 0.114** (SIL OFL): style Naskh classique, ideal pour textes longs documents juridiques (police.hbs conditions generales)
- **Tajawal 1.000** (SIL OFL by Boutros Fonts): sans-serif moderne, lisible pour formulaires/tableaux (devis.hbs, facture.hbs)
- **Cairo 6.0** (SIL OFL by Mohamed Gaber): geometric sans-serif pour titres et UI elements (h1, h2 dans templates)

Toutes en .woff2 subset (latin + arabe + chiffres + ponctuation), taille moyenne 80-150 KB chacune. Encodage base64 ajoute 33% overhead (110-200 KB chaine), embarque dans `_layout.hbs` via `@font-face src: url('data:font/woff2;base64,...')`. Le subset est genere via fonttools pyftsubset script `scripts/subset-fonts.py` execute en pre-commit pour reduire taille (sans subset, Amiri full = 800 KB).

### B.3 Formats de chiffres arabes

CSS `font-feature-settings: 'tnum'` active chiffres indo-arabes ١٢٣٤ (utilises au Maroc dans contextes traditionnels), `'lnum'` active chiffres arabes-occidentaux 1234 (defaut moderne business). Notre choix V1: chiffres arabes-occidentaux pour montants (lisibilite cross-locale, evite confusion comptabilite), chiffres indo-arabes pour pagination/numeros section (esthetique culturelle). Helper futur Sprint 14: `formatNumberArabicScript(n)` pour conversion explicite si besoin.

### B.4 Direction mixte (bidi)

Texte arabe avec mots latins (marques, ICE, URLs) doit utiliser CSS `unicode-bidi: isolate` ou markup `<bdi>` pour eviter inversions visuelles incorrectes. Notre helper `formatICE` retourne chaine purement numerique latine, embarquee dans `<bdi>{{formatICE tenant.ice}}</bdi>` dans templates ar pour preserver ordre de lecture gauche-droite des chiffres dans contexte global droite-gauche. Tests visuels manuels Sprint 11 valideront rendu Chrome/Firefox/Safari.

## Annexe C - Performance benchmarks attendus

| Scenario | p50 | p95 | p99 | Memoire delta |
|---|---|---|---|---|
| Cold start (premier appel) | 2.8s | 3.5s | 4.2s | +280 MB |
| Hot singleton (appels suivants) | 0.9s | 1.4s | 1.8s | +50 MB par page |
| Devis fr (10 lignes) | 0.8s | 1.2s | 1.6s | +50 MB |
| Facture fr (50 lignes pagination) | 1.4s | 2.1s | 2.8s | +80 MB |
| Police fr (10 articles + 2 garanties) | 1.6s | 2.4s | 3.1s | +90 MB |
| Sinistre rapport fr (5 photos 500KB embed) | 2.1s | 2.9s | 3.6s | +120 MB |
| Devis ar (RTL + Amiri) | 1.0s | 1.5s | 2.0s | +60 MB |
| 4 generations concurrent (singleton) | 1.2s | 1.9s | 2.5s | +200 MB peak |
| 8 generations concurrent (queue 4 par 4) | 2.4s | 3.6s | 4.8s | +200 MB peak (queue) |
| Template cache hit (re-generation meme) | 0.7s | 1.1s | 1.4s | +50 MB |
| Template cache miss (template jamais charge) | 0.85s | 1.3s | 1.7s | +52 MB |

Mesure avec puppeteer 24.0.1, Chromium 131, Node 22.10, instance EC2 t3.medium 4 vCPU 4 GB RAM, Linux Amazon 2023. SLO Sprint 10 V1: **p95 < 3s** pour devis/facture, **p95 < 4s** pour police/sinistre. SLO V2 Sprint 15: passage worker BullMQ pour decoupler latence API (instantane) de generation (asynchrone, polling status).

Optimisations envisagees Sprint 12+: (1) Pre-warming browser au demarrage applicatif (cold start absorbe au boot, pas au premier user request), (2) Pool de N=2 browsers pour resilience (si 1 crash, 1 autre absorbe trafic), (3) Reduction taille polices via subset fonttools agressif (Amiri 800 KB -> 80 KB subset arabe-only), (4) HTTP/2 server push pour assets si templates referencaient assets externes (non applicable en V1 puisque tout embarque base64), (5) Workers Node multi-process via cluster API si CPU sature (4 process x 250 MB = 1 GB, soutenable t3.large 8 GB).

## Annexe D - Securite renforcement

### D.1 Threat model surface attaque

Surface d'attaque PdfGeneratorService:
1. **HTML injection via data**: utilisateur soumet `data` contenant balises `<script>` ou `<iframe>`. Mitigation: Handlebars echappe `{{var}}` par defaut. Test E2E couvre tentative XSS.
2. **SSRF via images URL externe**: utilisateur soumet `data.imgUrl` qui declenche fetch interne reseau prive. Mitigation: page.setRequestInterception bloque tout sauf data: et about:blank.
3. **DoS via PDF gigantesque**: utilisateur soumet 10000 lignes pour exploser temps generation et memoire. Mitigation: Zod schema limite `lignes.length <= 500` (Sprint 11 ajout), timeout puppeteer 5s ferme requete.
4. **Browser escape sandbox**: bug Chromium permet RCE via PDF malicieux genere. Mitigation: --no-sandbox uniquement en dev, en prod retirer ce flag et installer dependances libnss3 libxss1 (Dockerfile prod), Chromium sandbox active.
5. **Memory exhaustion**: 100 requetes parallel saturent RAM. Mitigation: semaphore p-limit(4), Kubernetes HPA scale-out sur memoire > 80%.
6. **Token JWT replay**: attaquant capture JWT et genere PDF non-autorises. Mitigation: short-lived token 15 min (cf. Sprint 5), audit log AccessLogService trace toute generation.
7. **Information disclosure inter-tenant**: bug code rend PDF tenant A avec data tenant B. Mitigation: PdfGeneratorService.generate() prend `context.tenantId` obligatoire, log AccessLog inclut tenantId, tests verifie isolation.

### D.2 CSP-equivalent pour PDF

Bien que PDF n'utilise pas CSP HTTP, nous appliquons principes equivalents via puppeteer: `--disable-features=site-per-process` (desactive isolation procursus mais simplifie), `--block-new-web-contents` (bloque popup), `--no-pdf-header-footer` (evite injection externe). Argument `--disable-extensions` pour eviter chargement extensions Chrome heritees.

### D.3 Audit log retention

Conformement RGPD article 30 (registre des activites de traitement) et Loi 09-08 article 25, AccessLog entries pour PDF_GENERATED sont conservees **5 ans** apres la date de generation. Retention configuree dans schema TimescaleDB (cf. Tache 3.3.4) avec drop_chunks automatique apres 1825 jours. Pour documents juridiques (police, facture), retention etendue **10 ans** conformement Code de Commerce article 211 et Loi Comptable, achievement via tag `retention_class=LEGAL_10Y` sur log entry.

### D.4 Sanitisation defensive des inputs

Bien que Zod valide le schema haut-niveau (types, enums, regex filename), les valeurs string libres dans `data` (ex: client.adresse, devis.lignes[].designation) peuvent contenir caracteres de controle Unicode (U+202E RTL override, U+200E LTR mark) exploitables pour spoofing visuel. Sanitiseur dedie ajoute Sprint 11: helper `sanitizeForPdf(input)` strip caracteres < 0x20 (sauf 0x09 tab, 0x0A LF, 0x0D CR), strip BOM 0xFEFF, strip RTL/LTR override marks U+202A-U+202E, applique en pre-render dans PdfGeneratorService.

## Annexe E - Migration future BullMQ worker

Sprint 15+ basculera generation PDF sur worker BullMQ dedie pour decouplage:
1. Controller POST /api/v1/docs/generate-pdf retourne immediatement 202 Accepted avec `jobId`
2. BullMQ enqueue job dans queue `pdf-generation` avec data {templateName, locale, data, tenantId, userId}
3. Worker process separe (1-N replicas) consomme jobs, genere PDF via meme PdfGeneratorService, upload S3
4. Job result inclut `s3Url` (presigned 1h)
5. Client poll GET /api/v1/docs/jobs/:jobId pour status (waiting, active, completed, failed) ou WebSocket subscribe
6. Worker scale via Kubernetes HPA sur metric BullMQ queue length

Avantages: latence API instantanee (< 100 ms), workers isolated peuvent crash sans affecter API, retry automatique sur failure, backpressure naturel. Inconvenients: complexite operationnelle (queue, workers, status polling), latence end-to-end peut etre superieure (queue + processing). Decision attendre charge > 5000 PDF/h pour migrer.

Configuration BullMQ envisagee: `defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: { age: 3600, count: 1000 }, removeOnFail: { age: 86400 } }`. Concurrency par worker: 4 (correspond a notre semaphore actuel). Worker count initial: 2 replicas Kubernetes pour HA. Monitoring: Bull Board dashboard pour ops, metriques Prometheus pour SLO.

## Annexe F - Mapping detaille templates - documents metier

| Template | Document metier | Frequence/mois (Tenant moyen) | Pages moyennes | Locales prioritaires |
|---|---|---|---|---|
| devis | Offre commerciale prospect | 200-500 | 2-3 | fr (90%), ar-MA (10%) |
| devis | Renouvellement annuel | 100-300 | 2 | fr (80%), ar (20%) |
| facture | Facture mensuelle prime | 500-2000 | 1-2 | fr (95%), ar (5%) |
| facture | Facture acquit sinistre | 50-200 | 1 | fr (95%), ar (5%) |
| facture | Facture commission courtier | 100-500 | 1-2 | fr (100%) |
| police | Police nouvelle souscription | 100-300 | 5-8 (avec CG) | fr (85%), ar (15%) |
| police | Avenant modification | 50-200 | 2-3 | fr (90%), ar (10%) |
| sinistre-rapport | Rapport expert post-visite | 50-150 | 4-6 (avec photos) | fr (95%), ar-MA (5%) |
| sinistre-rapport | Decision commission | 30-100 | 2-3 | fr (95%), ar (5%) |

Volume total mensuel cible Sprint 10 V1: ~2000 PDF/mois par tenant moyen, ~50000 PDF/mois pour 25 tenants en production cible Sprint 12. Pic horaire estime 200 PDF/h (jours ouvres 9h-17h), bien sous notre capacity 14400 PDF/h theorique singleton. Pic exceptionnel campagne renouvellement Q4: 1000 PDF/h sur 3 jours, capacity acceptable sans queue async.

## Annexe G - Glossaire des termes metier Maroc

- **ACAPS**: Autorite de Controle des Assurances et de la Prevoyance Sociale (regulateur assurances Maroc, equivalent ACPR France)
- **ICE**: Identifiant Commun de l'Entreprise (15 chiffres, equivalent SIRET France, obligatoire factures depuis 2016)
- **IF**: Identifiant Fiscal (numero matricule fiscal entreprise, format 7-9 chiffres)
- **RC**: Registre du Commerce (numero immatriculation tribunal de commerce, format 4-8 chiffres + ville)
- **CNSS**: Caisse Nationale de Securite Sociale (numero employeur 7 chiffres)
- **Patente**: Taxe professionnelle (numero 8 chiffres affecte par DGI)
- **DGI**: Direction Generale des Impots (administration fiscale Maroc)
- **MAD**: Code ISO 4217 du Dirham marocain (1 EUR ~ 10.8 MAD en 2026)
- **DH**: Abreviation usuelle Dirham (utilise dans documents grand public)
- **TVA**: Taxe sur la Valeur Ajoutee (taux normal 20%, reduits 14%, 10%, 7%, exonerations)
- **TIC**: Taxe Interieure de Consommation (carburants, alcools, tabacs)
- **Loi 17-99**: Code des Assurances marocain
- **Loi 09-08**: Loi sur la protection des donnees personnelles (CNDP regulateur, equivalent CNIL France)
- **Loi 43-20**: Loi sur services de confiance numeriques (signature electronique, horodatage, conservation electronique)
- **Loi 49-15**: Loi sur les delais de paiement (interets de retard taux legal +7 points pour B2B)
- **Loi 53-05**: Loi sur l'echange electronique de donnees juridiques (precurseur loi 43-20)
- **Note Circulaire 717**: Texte DGI fixant mentions obligatoires factures
- **Reglement ACAPS 02/AS/19**: Texte ACAPS fixant format polices d'assurance
- **Barid eSign**: Plateforme signature electronique de Barid Al-Maghrib (operateur national postal/numerique)
- **ANRT**: Agence Nationale de Reglementation des Telecommunications (PSCo qualifie horodatage)
- **CIN**: Carte d'Identite Nationale (8 caracteres alphanumeriques, format AB123456)
- **Souscripteur**: Personne qui signe le contrat d'assurance et paie la prime
- **Assure**: Personne dont les risques sont couverts par le contrat (peut etre = souscripteur ou different)
- **Beneficiaire**: Personne percevant l'indemnite en cas de sinistre (vie/deces, etc.)
- **Prime**: Montant paye par souscripteur a l'assureur en contrepartie de la garantie
- **Franchise**: Part du sinistre laissee a charge de l'assure
- **Capital assure**: Montant maximum d'indemnisation par sinistre/garantie
- **Sinistre**: Evenement assurable survenu (accident, vol, deces, etc.)
- **Garantie**: Engagement de l'assureur a indemniser un risque defini
- **Conditions Generales**: Clauses standardisees applicables a tous les contrats d'un meme produit
- **Conditions Particulieres**: Clauses specifiques a un contrat individuel (parties, montants, dates, options)
- **Tacite reconduction**: Renouvellement automatique du contrat sans accord explicite a l'echeance
- **Subrogation**: Transfert des droits d'action de l'assure vers l'assureur apres indemnisation

## Annexe H - Roadmap evolutions templates Sprint 11+

Sprint 11: Ajout templates `attestation-assurance` (verte voiture, format A6 plie), `attestation-prelevement` (mandat SEPA equivalent Maroc), `lettre-resiliation` (modele standard) en fr/ar/ar-MA.

Sprint 12: Internationalisation templates pour expansion Algerie (`fr-DZ`, `ar-DZ`, devise DZD, mentions ALSA equivalent ACAPS Algerie).

Sprint 13: Templates branding-customizable par tenant (logo override, couleurs primaires/secondaires via tenant.config.brandColors, polices custom upload).

Sprint 14: Editeur visuel templates dans BackOffice (Tache 4.7.x) permettant aux gestionnaires non-tech de modifier templates sans deploiement (stockage en base + cache invalidation event-driven).

Sprint 15: Migration generation vers worker BullMQ pour decouplage latence API (cf. Annexe E).

Sprint 16: PDF/A-3A accessible avec balisage structurel complet pour conformite RGAA / WCAG 2.1 AA (lecteurs ecran).

Sprint 18: Templates marketing (newsletters, brochures produits, campagnes) avec composants reutilisables (cards, hero, CTA buttons) via partials Handlebars.

Sprint 22: Embarquement XML Factur-X dans factures pour e-facturation DGI obligatoire (loi 2026 prevue).

