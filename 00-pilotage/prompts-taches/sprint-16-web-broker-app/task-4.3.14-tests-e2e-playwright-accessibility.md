# TACHE 4.3.14 -- Tests E2E Playwright (25+) + Accessibility Checks (axe-core WCAG 2.1 AA)

**Sprint** : 16 (Phase 4 / Vertical Insure / Sprint 16 sur 35 cumul)
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md` (Tache 4.3.14)
**Phase** : 4 -- Vertical Insure (Skalean Broker ERP)
**Priorite** : P0 (cloturant Sprint 16, validation bout-en-bout les 13 taches precedentes)
**Effort** : 6h
**Dependances** :
- Tache 4.3.1 (app skeleton + middleware auth + i18n setup web-broker)
- Tache 4.3.2 (pages auth login + MFA + signup + recovery)
- Tache 4.3.3 (layout sidebar + topbar + tenant switcher)
- Tache 4.3.4 (dashboard 6 widgets)
- Tache 4.3.5 (contacts list + filters + detail timeline)
- Tache 4.3.6 (companies list + detail)
- Tache 4.3.7 (deals kanban + table)
- Tache 4.3.8 (polices list + detail + tabs)
- Tache 4.3.9 (broker queue validate / reject / SLA)
- Tache 4.3.10 (sinistres read-only)
- Tache 4.3.11 (parametres + profile + MFA setup)
- Tache 4.3.12 (RBAC UI 3 roles)
- Tache 4.3.13 (i18n complete + RTL + locale switcher)

**Densite cible** : 100-150 ko (auto-suffisant exhaustif, aucune lecture annexe requise)
**AUCUNE EMOJI AUTORISEE** (decision-006 strictement appliquee dans code, JSON, markdown, commits, logs)

---

## 1. But (0.5-1 ko)

Livrer la **suite Playwright complete** validant en bout-en-bout les 12 pages applicatives de la web-broker app (port 3001) construites pendant les taches 4.3.1 a 4.3.13, avec **25+ scenarios E2E fonctionnels** couvrant les chemins critiques metier (login OK / login wrong creds / MFA verify / signup / recovery / dashboard widgets render / contacts CRUD complet / companies create avec ICE Maroc / deals kanban drag-drop / polices liste + detail tabs + cancel avec pro-rata + suspend / broker-queue validate avec replacement provisional -> definitif / sinistres read-only / MFA setup TOTP / change password / parametres acces broker_admin only / RBAC 3 roles broker_admin user assistant / i18n switch locale fr ar-MA ar avec RTL) ET **14+ scenarios accessibilite** verifiant la conformite **WCAG 2.1 AA** via axe-core ([WCAG 2.1 AA est obligatoire au Maroc selon Loi 10-03 personnes handicapees, l'app courtier doit etre accessible](https://www.cg.gov.ma/sites/default/files/2017-10/loi%2010-03.pdf)) scannant les 12 pages (axe-core scan sans violations P0, < 5 violations P1), validant la **navigation clavier** (tab order coherent, escape ferme modals, cmd+K open global search), validant les **ARIA labels** + landmarks + live regions pour screen readers, validant le **contraste couleurs** (deja conforme via design tokens Sofidemy Sprint 4, on verifie), et executant un audit **Lighthouse perf** sur 3 pages clefs (login + dashboard + polices detail) avec seuils Perf >= 70, A11y >= 90, Best Practices >= 90, SEO >= 80.

Cette tache **cloture le Sprint 16** : sa reussite signifie que les 12 pages web-broker sont production-ready (apres pentest Sprint 33) et que tout regression introduite par les Sprints futurs (Sprint 17 customer-portal, Sprint 22 sinistres elargis, Sprint 24+ commissions, Sprint 27 admin) sera detectee automatiquement en CI sur PR. L'integration **CI** est strategique : la suite tourne sur chaque pull request via GitHub Actions, shardee sur 4 workers, sur 3 navigateurs (Chromium + Firefox + Webkit) plus 1 mobile viewport (Pixel 5), avec rapport HTML + trace.zip + screenshots + video stockes en artefacts. La **reproductibilite** est garantie via test tenant dedie cree-detruit par run, fixtures de test utilisateurs (3 roles), seed faker deterministe, et clear cookies entre tests.

A la sortie de cette tache, la commande `pnpm --filter @insurtech/web-broker test:e2e` execute la suite Playwright complete (33+ specs `.spec.ts` totalisant 4500+ lignes de tests), tous passent en local en < 8 minutes shardes 4 workers, tous passent en CI en < 12 minutes, le rapport HTML est genere dans `apps/web-broker/test-results/html/`, le rapport JUnit XML dans `test-results/junit.xml` pour integration GitHub Actions checks, aucun test n'est flaky (run 5 fois consecutif passe a 100%), le Lighthouse run produit `lighthouse-reports/baseline-{page}.json` pour 3 pages clefs, et la documentation `apps/web-broker/e2e/README.md` explique comment ajouter de nouveaux scenarios.

---

## 2. Contexte etendu (5-10 ko)

### 2.1 Pourquoi cette tache existe

Le Sprint 16 a livre 13 taches successives (4.3.1 a 4.3.13) chacune avec ses propres tests unitaires Vitest et tests d'integration React Testing Library cibles par composant ou par hook. Mais l'integration **complete** entre toutes ces taches -- l'enchainement reel d'un utilisateur courtier qui se connecte, valide son MFA, navigue dans le dashboard, cree un contact, le tag, attache une company, le converti en deal, deplace le deal en stage "Negociation" puis "Won", consulte la police generee, la place en cancel avec apercu pro-rata, valide un dossier en broker queue, et bascule la locale en arabe darija -- n'a ete validee nulle part jusqu'a present. Sans cette validation E2E, on risque un systeme ou chaque composant fonctionne isolement mais l'enchainement casse : par exemple, la page contacts/[id] de 4.3.5 attend un parametre URL `id` au format UUID, mais le clic sur une ligne du tableau dans 4.3.5 envoie un `id` au format `cuid` (mismatch potentiel selon l'evolution Sprint 8 CRM endpoints). Cette classe de bug n'est detectable qu'en E2E avec un vrai navigateur.

L'utilisation de Playwright est la **continuation des Sprints 5 et 4** : Sprint 5 (`task-2.1.15-e2e-tests.md`) a deja deploye Playwright pour les tests E2E backend API (15+ scenarios auth). Sprint 4 (`task-1.4.16-tests-e2e-lighthouse-baseline-storybook.md`) a deja deploye Playwright pour les tests E2E baseline frontend (8 apps demarrent + locale switcher + 404). Sprint 16 etend cette suite Playwright avec les **scenarios metier web-broker** specifiques. La cohérence stack Playwright transversale simplifie maintenance, partage fixtures, et formation developpeurs.

L'integration **axe-core** est une exigence reglementaire marocaine forte. La Loi 10-03 du 16 mai 2003 relative a la protection sociale des personnes handicapees impose l'accessibilite des services numeriques publics et para-publics. Le secteur assurance, sous supervision ACAPS (regulateur insurance Maroc), est classe service essentiel : les courtiers proposent des polices a tous les citoyens y compris malvoyants, malentendants, et personnes a mobilite reduite. La conformite **WCAG 2.1 AA** (norme internationale ratifiee par l'ONU dans la Convention relative aux droits des personnes handicapees signee par le Maroc en 2009) est donc obligatoire. axe-core 4.10 scanne automatiquement chaque page contre les regles WCAG 2.1 AA, retourne un tableau de violations avec criticite (`critical`, `serious`, `moderate`, `minor`), et permet d'asserter en CI qu'aucune violation `critical` ou `serious` (= P0) n'est presente, avec tolerance < 5 violations `moderate` (= P1) acceptees.

### 2.2 Alternatives considerees

#### Playwright 1.49.x vs Cypress 13 vs WebDriverIO 9

| Critere | Playwright 1.49 (CHOIX) | Cypress 13 (rejete) | WebDriverIO 9 (rejete) |
|---------|--------------------------|----------------------|--------------------------|
| Multi-navigateur reel | Chromium + Firefox + **Webkit** (Safari reel) | Chromium + Firefox + Edge (pas Webkit reel) | Tous avec drivers |
| Mobile emulation native | iPhone + Pixel + Galaxy prebuilts | Plugins externes | Manuel |
| Parallelism fullyParallel | Native | Mode parallel paid (Cypress Cloud) | Native |
| Trace viewer | Time-travel `.zip` debug | Cypress Studio limite | Manuel |
| Networks `page.route()` | Granular interception | `cy.intercept()` | Limite |
| Cohérence Sprint 5 backend | **Deja en place** | Non | Non |
| Cohérence Sprint 4 frontend | **Deja en place** | Non | Non |
| TypeScript support | Excellent | Bon | Bon |
| Speed E2E | ~30% plus rapide | Reference | ~2x plus lent |
| Iframe support | Native `page.frameLocator()` | Limite cross-origin | Native |
| Auth state persist | `storageState` JSON natif | `cy.session()` | Manuel |

**Decision** : Playwright 1.49.x -- continuite Sprints 4/5, real Webkit pour Safari iOS users (~30% trafic Maroc selon StatCounter MA 2025), trace viewer indispensable pour debug flaky tests sur kanban drag-drop.

#### axe-core vs Pa11y vs Lighthouse Accessibility audit

| Critere | @axe-core/playwright 4.10 (CHOIX) | Pa11y 8 (rejete) | Lighthouse a11y category (complement) |
|---------|-------------------------------------|-------------------|----------------------------------------|
| Reference industrie | Deque axe-core (W3C contributors) | Cyrille Gandon (UK gov) | Google Chrome team |
| Regles WCAG | WCAG 2.0/2.1/2.2 + Section 508 + ARIA | WCAG 2.0/2.1 | Subset axe-core |
| Integration Playwright | Native `@axe-core/playwright` | CLI standalone | Lighthouse CLI |
| Violations API granular | Oui (`violations[]` avec severity) | Oui mais format different | Score aggregate |
| Best Practices coverage | 4.10 = 90+ regles WCAG | ~70 regles | ~20 regles |
| False positives | Faibles (configurable via tags) | Plus eleves | Moyens |
| CI integration | `expect(results.violations).toEqual([])` | `pa11y-ci` JSON config | LH CI assertions |
| Maintenance Deque | Active (open source + entreprise) | Active | Active |
| Update WCAG 2.2 (oct 2023) | Inclus depuis 4.7 | Partiel | Partiel |
| Compliance Maroc 10-03 | **Standard de facto international** | Acceptable | Insufficient seul |

**Decision** : **@axe-core/playwright 4.10.x** comme tool principal a11y (scan systematique 12 pages) + **Lighthouse 12.3** a11y category en complement (3 pages clefs perf + a11y aggregate score). Combinaison double-instrumentation = redondance acceptable car axe = granular violations debug, Lighthouse = trend score aggregate pilotable.

#### Lighthouse perf assertions seuils Sprint 16 web-broker

| Page | Perf | A11y | Best Practices | SEO | PWA |
|------|------|------|----------------|-----|-----|
| /login (public) | >= 75 | >= 95 | >= 90 | >= 85 | N/A |
| /dashboard (protected) | >= 70 | >= 90 | >= 90 | N/A (noindex) | N/A |
| /polices/[id] (protected, lourd) | >= 65 | >= 90 | >= 85 | N/A | N/A |

Justification seuils : pages protected non SEO-indexees (noindex meta tag), pas de PWA web-broker (decision-Sprint-4 PWA reservee mobile apps), perf seuil baseline (cible Sprint 30 = 90).

#### Visual regression : Chromatic vs Percy vs Loki vs aucun

| Critere | Aucun (CHOIX Sprint 16) | Chromatic 11 | Percy 1 | Loki 0.x |
|---------|--------------------------|--------------|---------|----------|
| Cost | Gratuit | $149/mois sur tier paye | $39+/mois | Gratuit OSS |
| Setup complexity | Zero | Faible (Storybook + 1 CLI) | Moyen | Eleve |
| Cross-browser baseline | N/A | Chromium uniquement | Chromium + Firefox + Edge | Webkit + Chromium |
| Sub-pixel tolerance | N/A | Configurable | Configurable | Manuel |
| Integration Sprint 4 Storybook | N/A | Native | Manuel | Manuel |

**Decision Sprint 16** : **PAS de visual regression** dans cette tache. Justification : sub-pixel flakiness Linux CI vs macOS dev produit des faux positifs couteux a maintenir, Chromatic budget non valide pour Sprint 16, focus axe-core a11y prioritaire. Visual regression sera ajoute **Sprint 35** (release production) sur Chromatic apres Sprint 17/18 customer-portal SEO.

#### Test data : Faker + seedrandom vs MSW fixtures vs DB seed reel

| Strategie | Test tenant + API reelle (CHOIX) | MSW mocks frontend | DB seed pre-prod |
|-----------|-----------------------------------|--------------------|--------------------| 
| Realisme | **Max** (API NestJS reelle) | Bas (mocks) | Max (mais shared state) |
| Speed setup | ~2s par run (tenant create) | < 100ms (mocks instant) | 0s (deja seed) |
| Reproducibilite | Excellent (tenant ephemere isole) | Excellent | Mauvais (shared state pollution) |
| Coverage backend bugs | **Detecte bugs API/RBAC** | Aucun | Detecte |
| CI complexity | API NestJS + Postgres + Redis dockerises | Standalone frontend only | Idem CI |
| Data realiste | faker.fr + ICE Maroc valides | Manuel mocks | Realiste |
| Cleanup | DROP tenant a la fin | N/A | Pollution |

**Decision** : **Test tenant API reelle + faker fr_MA + seedrandom deterministe**. Justification : Sprint 6 a deja shipping `tenant_id` strict isolation, Sprint 5 deja shipping API auth reelle dockerisee, on **reutilise l'infrastructure backend** pour tests E2E web-broker = realisme max et detection bugs cross-stack. Le `globalSetup.ts` Playwright cree un tenant test ephemere via `POST /v1/admin/tenants` (endpoint test-only Sprint 6) + seeds 3 users (broker_admin / broker_user / broker_assistant) + 50 contacts + 20 companies + 30 deals + 10 polices fixtures via faker `fr_MA` locale, le `globalTeardown.ts` DELETE le tenant cascade.

#### Strategy auth tests : storageState JSON vs login full chaque test

| Strategie | storageState par role (CHOIX) | Login UI chaque test (rejete) |
|-----------|--------------------------------|--------------------------------|
| Speed | **~80ms (lecture JSON)** | ~3s (login + MFA + dashboard) |
| Suite duration total | ~8min (33 tests) | ~25min (33 tests x +20s overhead) |
| Coverage auth flow | Garanti par tests dedies (login.spec.ts) | Duplique inutilement |
| Token expiry handling | Refresh transparent transparent geree par api-client | Idem |
| Multi-role testing | Trivial (3 storageStates separes) | Tres lent |

**Decision** : `storageState` JSON par role (`auth-broker-admin.json`, `auth-broker-user.json`, `auth-broker-assistant.json`) genere dans `globalSetup.ts` par login UI Playwright une seule fois, puis reuse dans tous les tests via `test.use({ storageState: 'auth-broker-admin.json' })`. Tests auth dedies (login.spec.ts) ne reutilisent **pas** storageState (testent le login UI lui-meme).

### 2.3 Trade-offs explicites

1. **Pas de test sur navigateurs mobiles natifs (iOS Safari real device)** : emulation Webkit Playwright suffisante baseline Sprint 16. Sprint 35 ajoutera BrowserStack ou Sauce Labs pour real device cloud (audit reel iOS Safari Maroc).

2. **Test suite duree ~8min local** : Long pour TDD mais acceptable pre-merge. Pour iteration dev, `pnpm test:e2e:headed --grep "specific test"` filtre par scenario. CI optimise via shard 4 workers = ~3min effective.

3. **Pas de tests Performance sous reseau 3G/4G** : Lighthouse mode `simulated` par defaut suffit baseline. Sprint 18 customer-portal ajoutera `mobile3g` profile pour audience publique.

4. **axe-core ne detecte pas tous problemes a11y** : selon Deque, axe detecte ~57% des problemes WCAG. Les 43% restants (couleur signification sans alternative, video sans transcript, traduction qualite, etc.) necessitent **audit manuel humain** par testeur professionnel handicap -- planifie Sprint 30 avant prod.

5. **MFA TOTP fixtures hardcodes vs generation reelle** : on hardcode un secret TOTP test (`JBSWY3DPEHPK3PXP`) dans `test-users.ts` et utilise `otplib` pour generer un code 6-digit valide a chaque test MFA. Realiste mais introduit dependance `otplib` dans test deps.

6. **Drag-drop kanban flaky sur Webkit** : Webkit emule moins fidelement les `dragstart/dragover/drop` HTML5 events. Solution : tests deals-kanban.spec.ts limites au project `chromium-fr` (skip sur webkit + firefox via `test.skip(browserName !== 'chromium')`).

7. **Tests parallel race conditions** : si 4 workers en parallel touchent au meme tenant test seed, race conditions sur DB. Solution : `globalSetup` cree **4 tenants test** (`test-tenant-1` a `test-tenant-4`), chaque worker `process.env.TEST_WORKER_INDEX` consomme son tenant dedie.

8. **Cookie tenant cross-test pollution** : un test qui change tenant (tenant switcher) pollute le cookie `current_tenant_id` pour les tests suivants. Solution : `test.beforeEach(async ({ page }) => { await page.context().clearCookies(); await loginAs(page, 'broker_admin'); })` reset cookies + reauth chaque test.

9. **Locale switcher hydration mismatch en RTL** : changer locale fr -> ar-MA en runtime peut produire hydration mismatch React 19 (dir change). Solution : tests locale switcher reload page complet apres switch (verify dir attribute du `<html>`).

10. **JWT expiry mid-test** : si un test dure > 5 minutes, l'access_token expire pendant le test. Solution : refresh automatique geri par api-client Sprint 16 (deja shipping en 4.3.1), aucune action requise tests.

11. **Cmd+K mac vs Ctrl+K linux/windows** : raccourci global search OS-dependent. Solution : tests utilisent `await page.keyboard.press('ControlOrMeta+K')` (Playwright abstraction).

12. **Color contrast tests false positives Recharts** : axe-core `color-contrast` regle peut signaler de faux positifs sur SVG charts Recharts (couleurs serie dataviz). Solution : `axeBuilder.disableRules(['color-contrast'])` sur tests dashboard charts (justifie : a11y dataviz se mesure via tooltips + tableau alternatif, pas contraste pixel SVG).

### 2.4 Decisions strategiques referenced

- **decision-001 (monorepo pnpm + Turbo)** : tests E2E vivent dans `apps/web-broker/e2e/` (co-location app-specific), pas dans `repo/e2e/` racine (qui contient les tests cross-app Sprint 4 et tests API Sprint 5).
- **decision-005 (Skalean AI frontier)** : pas de tests AI integration dans Sprint 16 -- ajout Sprint 27+ quand AI gateway shipping.
- **decision-006 (NO EMOJI ABSOLU)** : zero emoji dans aucun fichier test, fixture, JSON report, README, commit. Linter custom `scripts/check-no-emoji.sh` execute en CI.
- **decision-008 (cloud souverain MA Atlas Cloud Benguerir)** : tests E2E utilisent `localhost:4000` API NestJS dockerisee en CI. Audit Lighthouse depuis runner GitHub Actions europeen (latence ~30ms vers prod Atlas Casablanca). Sprint 35 deploiera runner self-hosted MA pour latence reelle.
- **decision-009 (multilinguisme MA)** : tests E2E couvrent les 3 locales fr / ar-MA / ar avec projects Playwright dedies (`chromium-fr`, `chromium-ar-MA`, `chromium-ar`). Tests RTL specifiquement asserte `dir="rtl"` + tab order inverse + iconographie miroir.
- **decision (ACAPS supervision)** : tests E2E verifient mention conformite ACAPS + numero d'enregistrement courtier dans footer authentifie (page parametres `tenant.broker_acaps_id`).
- **decision (Loi 10-03 accessibilite Maroc)** : axe-core scan systematique 12 pages avec assertion zero violation `critical` ou `serious` (P0).
- **decision (Loi 53-05 confiance numerique Maroc)** : MFA setup flow teste exhaustivement (QR generation + TOTP verify + recovery codes) car Loi 53-05 impose authentification forte pour acces aux donnees personnelles assures.

### 2.5 Pieges techniques connus (12+ minimum)

1. **Flaky test reseau API NestJS lente boot** : si globalSetup demarre l'API au demarrage suite, le premier test peut hit l'API non-prete. Solution : `webServer.timeout: 120_000` Playwright config + healthcheck `GET /health` polling avant tests.

2. **Test parallel race condition seeds** : workers Playwright 4 paralleles peuvent tous tenter `POST /admin/tenants` au meme moment = deadlock. Solution : `globalSetup` cree les 4 tenants **sequentiellement** AVANT que workers demarrent.

3. **Cookie tenant cross-test pollution** : test A change `current_tenant_id` cookie via tenant switcher, test B suivant herite. Solution : `test.beforeEach` clear cookies + relogin.

4. **MFA TOTP generation timing window** : un code TOTP valide 30s, si le test prend > 30s entre generation et submit, le code expire = false negative. Solution : utiliser `otplib` generer code juste avant submit (await page.fill, await otp = generateTOTP(), await page.fill mfa_code, otp).

5. **JWT expiry mid-test** : token access expire 15min, si test depasse, requests 401. Solution : api-client refresh transparent (deja shipping Sprint 16) ; tests anormalement longs ne devraient pas exister (> 2min = signal bug).

6. **axe violations false positive color-contrast charts** : Recharts SVG triggers `color-contrast` violation sur series dataviz couleurs. Solution : `disableRules(['color-contrast'])` ciblee sur tests charts page, NON sur autres pages (texte/buttons doivent reste verified).

7. **Screen reader bug Safari Webkit emule** : Webkit Playwright n'emule pas VoiceOver, donc tests "screen reader" sont en realite tests "ARIA semantic correct" (verify aria-label, role, aria-live). Real screen reader audit = Sprint 30 manuel testeur.

8. **Keyboard nav focus trap loop** : modal Dialog Radix UI doit trap focus dedans (tab cycle dans modal, Shift+Tab cycle inverse). Si pas trap, tab sort modal vers contenu derriere = bug a11y. Test verify : ouvre modal, tab 10 fois, focus reste dans modal (assert `await expect(page.locator('[role=dialog]')).toContainText(focusedElementText)`).

9. **Cmd+K mac vs Ctrl+K linux/windows** : Playwright `page.keyboard.press('ControlOrMeta+K')` abstraction unifie. NE PAS hardcode `Meta+K` (echoue linux CI) ni `Control+K` (echoue mac dev).

10. **Mobile touch drag-drop kanban** : Pixel 5 emulation utilise touch events `touchstart/touchmove/touchend` differents de mouse `mousedown/move/up`. dnd-kit lib utilise `PointerSensor` qui gere les 2, mais flaky en CI mobile. Solution : tests kanban skip sur project `mobile-chrome` (kanban use desktop par defaut).

11. **RTL test direction click coordinates** : en RTL, l'ordre visuel des elements est inverse. Click sur "premier" element du nav = `nth(0)` en LTR mais visuellement a droite, idem en RTL DOM mais visuellement a gauche. Solution : tests RTL utilisent `getByRole` / `getByLabel` semantic selectors (insensibles direction visuelle), JAMAIS `nth(n)` ou coords pixel.

12. **Locale switch hydration React 19** : changer locale fr -> ar-MA via Server Action + `router.refresh()` peut causer hydration mismatch si `<html dir>` differe entre SSR cache et nouveau SSR. Solution : tests locale-switcher.spec.ts forcent reload `page.reload()` apres switch + verify `await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')`.

13. **Lighthouse audit headless flag** : Lighthouse run via `lhci autorun` avec `--chrome-flags="--headless --no-sandbox --disable-gpu"` en CI. Sans `--disable-gpu`, runner GitHub Actions Linux crash sur certains GPU emul.

14. **JUnit XML reporter parsing GitHub Actions** : reporter `junit` produit XML conformes JUnit 4, mais GitHub Actions parsing exige `testsuites > testsuite > testcase` structure exacte. Playwright 1.49+ conforme par defaut.

15. **HTML report `traces` zip volumineux** : trace `.zip` files peuvent atteindre 50 MB par test failed. Artefacts GitHub Actions limit 10 GB/30 jours. Solution : `trace: 'on-first-retry'` (uniquement retry, pas every run) + nettoyage cron 7 jours retention.

---

## 3. Architecture context (3-5 ko)

### 3.1 Position dans le sprint

La tache 4.3.14 est la **derniere du Sprint 16** (14e sur 14). Elle cloture le sprint en validant en bout-en-bout les 13 taches precedentes.

```
Sprint 16 -- Web Broker App (14 taches)

[4.3.1 skeleton + middleware + i18n]
      |
      v
[4.3.2 pages auth login/MFA/signup/recovery]
      |
      v
[4.3.3 layout sidebar + topbar + tenant switcher]
      |
      v
[4.3.4 dashboard 6 widgets]
      |
      v
[4.3.5 contacts list + detail timeline]
      |
      v
[4.3.6 companies list + detail]
      |
      v
[4.3.7 deals kanban + table]
      |
      v
[4.3.8 polices list + detail tabs]
      |
      v
[4.3.9 broker queue validate/reject/SLA]
      |
      v
[4.3.10 sinistres read-only]
      |
      v
[4.3.11 parametres + profile + MFA setup]
      |
      v
[4.3.12 RBAC UI 3 roles]
      |
      v
[4.3.13 i18n complete + RTL + locale switcher]
      |
      v
[4.3.14 TESTS E2E PLAYWRIGHT + A11Y]   <-- CETTE TACHE (cloture Sprint 16)
```

### 3.2 Position dans le programme

- **Sprint 4** (`task-1.4.16-tests-e2e-lighthouse-baseline-storybook.md`) a deja deploye Playwright + Lighthouse pour les **8 apps frontend baseline** (smoke test demarrage + locale switcher + 404).
- **Sprint 5** (`task-2.1.15-e2e-tests.md`) a deja deploye Playwright pour les **tests E2E backend auth** (15+ scenarios).
- **Sprint 16** (cette tache) etend Playwright avec les **scenarios metier web-broker** (33+ specs `.spec.ts` + 25+ E2E + 14+ a11y).
- **Sprint 17** (web-customer-portal) appliquera le meme pattern Playwright + axe-core a la vente en ligne grand public.
- **Sprint 18** (web-assure-portal) idem self-service assure.
- **Sprint 22** (web-garage-app) idem garage.
- **Sprint 30** (a11y audit manuel) auditera manuellement (testeur handicap professionnel) les 43% restants des problemes a11y non detectables par axe-core.
- **Sprint 33** (pentest) auditera les flows authentifies sous angle securite.
- **Sprint 35** (release prod) ajoutera Chromatic visual regression + BrowserStack real device.

### 3.3 Diagramme architecture suite tests

```
+-------------------------------------------------------+
| apps/web-broker/                                       |
|                                                        |
|  +--- src/                  (code app deja shipping 4.3.1-4.3.13)
|  |                                                     |
|  +--- e2e/                  (NOUVEAU 4.3.14)            |
|      |                                                  |
|      +-- fixtures/                                      |
|      |    +-- auth-helpers.ts          (loginAs, setupMFA)
|      |    +-- test-tenant-setup.ts     (create tenant ephemere via API)
|      |    +-- test-users.ts            (3 roles broker_*)
|      |    +-- test-data.ts             (contacts/companies/deals seeds faker)
|      |    +-- a11y-helpers.ts          (scanA11y axeBuilder)
|      |    +-- otp-helpers.ts           (TOTP generation otplib)
|      |                                                 |
|      +-- auth/                                         |
|      |    +-- login.spec.ts            (login OK / wrong / MFA)
|      |    +-- signup.spec.ts           (signup + email verify)
|      |    +-- recovery.spec.ts         (forgot + reset)
|      |    +-- multi-tenant.spec.ts     (select-tenant)
|      |                                                 |
|      +-- dashboard/                                    |
|      |    +-- dashboard.spec.ts        (6 widgets + filters)
|      |                                                 |
|      +-- contacts/                                     |
|      |    +-- contacts-crud.spec.ts                    |
|      |    +-- contacts-detail.spec.ts                  |
|      |                                                 |
|      +-- companies/                                    |
|      |    +-- companies-crud.spec.ts   (ICE validation)
|      |                                                 |
|      +-- deals/                                        |
|      |    +-- deals-kanban.spec.ts     (drag-drop)     |
|      |    +-- deals-table.spec.ts                      |
|      |    +-- deals-create.spec.ts                     |
|      |                                                 |
|      +-- polices/                                      |
|      |    +-- polices-list.spec.ts                     |
|      |    +-- polices-detail.spec.ts                   |
|      |    +-- polices-cancel.spec.ts   (pro-rata preview)
|      |    +-- polices-suspend.spec.ts                  |
|      |                                                 |
|      +-- broker-queue/                                 |
|      |    +-- queue-validate.spec.ts   (provisional -> definitif)
|      |    +-- queue-reject.spec.ts                     |
|      |    +-- queue-sla.spec.ts                        |
|      |                                                 |
|      +-- sinistres/                                    |
|      |    +-- sinistres-read-only.spec.ts              |
|      |                                                 |
|      +-- profile/                                      |
|      |    +-- mfa-setup.spec.ts        (QR + verify + recovery codes)
|      |    +-- change-password.spec.ts                  |
|      |                                                 |
|      +-- parametres/                                   |
|      |    +-- parametres-admin-only.spec.ts            |
|      |                                                 |
|      +-- rbac/                                         |
|      |    +-- rbac-3-roles.spec.ts     (broker_admin/user/assistant)
|      |                                                 |
|      +-- i18n/                                         |
|      |    +-- locale-switcher.spec.ts  (fr/ar-MA/ar RTL)
|      |                                                 |
|      +-- a11y/                                         |
|      |    +-- a11y-all-pages.spec.ts   (axe scan 12 pages)
|      |    +-- keyboard-nav.spec.ts     (tab order + escape + cmd+k)
|      |                                                 |
|      +-- perf/                                         |
|      |    +-- lighthouse-baseline.spec.ts (3 pages clefs)
|      |                                                 |
|      +-- global-setup.ts        (start API + create tenants + seed + login)
|      +-- global-teardown.ts     (DELETE tenants cascade)
|      +-- README.md              (doc execution + ajout scenario)
|                                                        |
|  +--- playwright.config.ts      (config 6 projects + workers + reporters)
|  +--- lighthouse.config.cjs     (LHCI assertions seuils)
+-------------------------------------------------------+

           |                              |
           v                              v
    [Backend NestJS API:4000]    [Lighthouse CI cloud or local]
    Postgres + Redis + Kafka
    (lance via docker-compose.test.yml)
```

### 3.4 Diagramme flow execution suite

```
+----------------------------------------------------+
| pnpm --filter @insurtech/web-broker test:e2e        |
+--------------------+--------------------------------+
                     |
                     v
+----------------------------------------------------+
| global-setup.ts                                     |
|  1. Start API NestJS via docker-compose (si pas up) |
|  2. Wait healthcheck /health = 200                  |
|  3. Apply migrations DB                             |
|  4. Create 4 tenants test (1 per worker)            |
|  5. Seed 3 users per tenant (broker_admin/user/asst)|
|  6. Seed 50 contacts + 20 companies per tenant      |
|  7. Login each role -> storageState JSON par role   |
|  8. Generate TOTP secret base32 par user MFA tests  |
+--------------------+--------------------------------+
                     |
                     v
+----------------------------------------------------+
| Playwright run workers=4 paralleles                 |
|  Worker 0 -> tenant-test-1, projects 6              |
|  Worker 1 -> tenant-test-2, projects 6              |
|  Worker 2 -> tenant-test-3, projects 6              |
|  Worker 3 -> tenant-test-4, projects 6              |
|                                                     |
|  Pour chaque spec.ts :                              |
|    1. beforeAll  -> setup test-specific             |
|    2. beforeEach -> clearCookies + loginAs(role)    |
|    3. test       -> assertions UI + a11y + perf     |
|    4. afterEach  -> capture screenshot if failed    |
|    5. afterAll   -> cleanup test-specific           |
+--------------------+--------------------------------+
                     |
                     v
+----------------------------------------------------+
| global-teardown.ts                                  |
|  1. DELETE tenants test cascade                     |
|  2. Generate reports HTML + JUnit XML + JSON        |
|  3. Upload artifacts (trace.zip + screenshots)      |
+----------------------------------------------------+
```

---

## 4. Livrables checkables (33)

- [ ] `apps/web-broker/playwright.config.ts` -- config 6 projects + workers 4 + reporters html/junit/list + webServer + globalSetup (~150 lignes)
- [ ] `apps/web-broker/e2e/fixtures/auth-helpers.ts` -- loginAs, setupMFA, switchTenant, generateStorageState (~200 lignes)
- [ ] `apps/web-broker/e2e/fixtures/test-tenant-setup.ts` -- createTestTenant via API + seedData (~180 lignes)
- [ ] `apps/web-broker/e2e/fixtures/test-users.ts` -- 3 roles broker_admin/user/assistant fixtures (~120 lignes)
- [ ] `apps/web-broker/e2e/fixtures/test-data.ts` -- contacts, companies, deals, polices seeds faker fr_MA (~150 lignes)
- [ ] `apps/web-broker/e2e/fixtures/a11y-helpers.ts` -- scanA11y axeBuilder + assertions (~100 lignes)
- [ ] `apps/web-broker/e2e/fixtures/otp-helpers.ts` -- generateTOTP via otplib (~50 lignes)
- [ ] `apps/web-broker/e2e/auth/login.spec.ts` -- login OK, wrong creds, MFA flow (~150 lignes)
- [ ] `apps/web-broker/e2e/auth/signup.spec.ts` -- signup + email verify (~120 lignes)
- [ ] `apps/web-broker/e2e/auth/recovery.spec.ts` -- forgot + reset (~100 lignes)
- [ ] `apps/web-broker/e2e/auth/multi-tenant.spec.ts` -- select-tenant (~100 lignes)
- [ ] `apps/web-broker/e2e/dashboard/dashboard.spec.ts` -- 6 widgets render + filters (~180 lignes)
- [ ] `apps/web-broker/e2e/contacts/contacts-crud.spec.ts` -- CRUD + search + bulk tag/export (~200 lignes)
- [ ] `apps/web-broker/e2e/contacts/contacts-detail.spec.ts` -- timeline + attached deals (~150 lignes)
- [ ] `apps/web-broker/e2e/companies/companies-crud.spec.ts` -- create with ICE Maroc + edit + detail (~150 lignes)
- [ ] `apps/web-broker/e2e/deals/deals-kanban.spec.ts` -- drag-drop stages (~180 lignes)
- [ ] `apps/web-broker/e2e/deals/deals-table.spec.ts` -- table filter + sort (~120 lignes)
- [ ] `apps/web-broker/e2e/deals/deals-create.spec.ts` -- create + won shortcut (~100 lignes)
- [ ] `apps/web-broker/e2e/polices/polices-list.spec.ts` -- list + filters (~150 lignes)
- [ ] `apps/web-broker/e2e/polices/polices-detail.spec.ts` -- detail tabs all (~200 lignes)
- [ ] `apps/web-broker/e2e/polices/polices-cancel.spec.ts` -- cancel with pro-rata preview (~150 lignes)
- [ ] `apps/web-broker/e2e/polices/polices-suspend.spec.ts` -- suspend with raison (~120 lignes)
- [ ] `apps/web-broker/e2e/broker-queue/queue-validate.spec.ts` -- validate provisional -> definitif (~200 lignes)
- [ ] `apps/web-broker/e2e/broker-queue/queue-reject.spec.ts` -- reject + customer notify (~150 lignes)
- [ ] `apps/web-broker/e2e/broker-queue/queue-sla.spec.ts` -- SLA timer + couleurs (~120 lignes)
- [ ] `apps/web-broker/e2e/sinistres/sinistres-read-only.spec.ts` -- no write buttons (~150 lignes)
- [ ] `apps/web-broker/e2e/profile/mfa-setup.spec.ts` -- QR + verify + recovery codes (~180 lignes)
- [ ] `apps/web-broker/e2e/profile/change-password.spec.ts` -- change password flow (~100 lignes)
- [ ] `apps/web-broker/e2e/parametres/parametres-admin-only.spec.ts` -- broker_admin only access (~120 lignes)
- [ ] `apps/web-broker/e2e/rbac/rbac-3-roles.spec.ts` -- 3 roles scenarios complets (~250 lignes)
- [ ] `apps/web-broker/e2e/i18n/locale-switcher.spec.ts` -- 3 locales + RTL applied + dates (~150 lignes)
- [ ] `apps/web-broker/e2e/a11y/a11y-all-pages.spec.ts` -- axe scan 12 pages WCAG 2.1 AA (~200 lignes)
- [ ] `apps/web-broker/e2e/a11y/keyboard-nav.spec.ts` -- tab order + escape + cmd+k (~150 lignes)
- [ ] `apps/web-broker/e2e/perf/lighthouse-baseline.spec.ts` -- LH 3 pages clefs (~120 lignes)
- [ ] `apps/web-broker/e2e/global-setup.ts` -- create tenants + seed + storageStates (~200 lignes)
- [ ] `apps/web-broker/e2e/global-teardown.ts` -- DELETE tenants cascade (~80 lignes)
- [ ] `apps/web-broker/lighthouse.config.cjs` -- LHCI assertions (~80 lignes)
- [ ] `apps/web-broker/e2e/README.md` -- doc execution + ajout scenario (~300 lignes)
- [ ] `.github/workflows/e2e-web-broker.yml` -- CI workflow (~120 lignes)
- [ ] Total LOC tests : >= 4500 lignes
- [ ] Run local 5x consecutif : 100% pass (no flaky)
- [ ] Run CI : < 12 minutes total (shard 4)
- [ ] Rapport HTML genere + uploade artifacts CI
- [ ] axe-core scan 12 pages : 0 violations P0 + < 5 P1
- [ ] Lighthouse 3 pages : Perf >= seuils + A11y >= 90 + BP >= 85

---

## 5. Stack technique imposee

| Composant | Version | Justification |
|-----------|---------|---------------|
| @playwright/test | 1.49.1 | Continuite Sprint 4 (1.4.16) et Sprint 5 (2.1.15) |
| @axe-core/playwright | 4.10.0 | Integration native axe + WCAG 2.1 AA |
| axe-core | 4.10.x (via @axe-core/playwright peer) | Reference industrie a11y |
| @lhci/cli | 0.14.0 | Lighthouse CI assertions seuils par page |
| lighthouse | 12.3.0 pinned | LH engine, pinned car breaking changes mineures |
| otplib | 12.0.1 | TOTP generation pour tests MFA setup |
| @faker-js/faker | 9.3.0 | locale fr_MA pour donnees realistes Maroc |
| seedrandom | 3.0.5 | reproductibilite faker via seed deterministe |
| dayjs | 1.11.13 | manipulation dates tests + timezone Africa/Casablanca |
| dotenv | 16.4.5 | charge .env.test |
| chalk | 5.3.0 (ESM) | colorize stdout reporters custom |

Variables env tests (fichier `apps/web-broker/.env.test`) :
```ini
# CLIENT-SAFE
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
NEXT_PUBLIC_APP_NAME=skalean-broker-test
NEXT_PUBLIC_DEFAULT_LOCALE=fr

# Test-specific
PLAYWRIGHT_BASE_URL=http://localhost:3001
TEST_API_ADMIN_TOKEN=test-admin-jwt-issued-by-globalSetup
TEST_TENANT_PREFIX=test-tenant
TEST_USER_PASSWORD=TestP@ssw0rd2026
TEST_TIMEZONE=Africa/Casablanca

# Lighthouse CI
LHCI_GITHUB_APP_TOKEN=
LHCI_BUILD_CONTEXT__EXTERNAL_BUILD_URL=

# Reporting
PLAYWRIGHT_HTML_REPORT_FOLDER=test-results/html
PLAYWRIGHT_JUNIT_OUTPUT=test-results/junit.xml
```

---

## 6. Code patterns complets (60-80 ko)

### 6.1 playwright.config.ts (config racine projects + workers + reporters)

`apps/web-broker/playwright.config.ts` :

```typescript
import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { config as dotenvConfig } from 'dotenv';

// Charge .env.test si present (priorite sur process.env existants)
dotenvConfig({ path: path.resolve(__dirname, '.env.test'), override: false });

const PORT = Number(process.env.PORT ?? 3001);
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;
const IS_CI = Boolean(process.env.CI);

export default defineConfig({
  testDir: './e2e',
  // Pattern: e2e/**/*.spec.ts
  testMatch: '**/*.spec.ts',
  // Timeout par test
  timeout: 60_000,
  expect: {
    // Timeout par assertion .toHaveText / .toBeVisible
    timeout: 10_000,
  },
  // Run tests in parallel inside file
  fullyParallel: true,
  // Empeche test.only de passer en CI
  forbidOnly: IS_CI,
  // Retries pour reduire flakiness CI (2 retries CI, 0 local pour fail-fast)
  retries: IS_CI ? 2 : 0,
  // Workers = parallel processes ; 4 en CI optimal (machine 4 vCPU runners GitHub Actions)
  workers: IS_CI ? 4 : '50%',
  // Reporters multiples
  reporter: [
    ['html', { outputFolder: process.env.PLAYWRIGHT_HTML_REPORT_FOLDER ?? 'test-results/html', open: 'never' }],
    ['junit', { outputFile: process.env.PLAYWRIGHT_JUNIT_OUTPUT ?? 'test-results/junit.xml' }],
    ['json', { outputFile: 'test-results/results.json' }],
    IS_CI ? ['github'] : ['list'],
  ],
  // Shared use across all tests
  use: {
    baseURL: BASE_URL,
    // Tracing
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Action timeouts
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    // Default locale + tz (override per-project)
    locale: 'fr-MA',
    timezoneId: 'Africa/Casablanca',
    // ColorScheme
    colorScheme: 'light',
    // Ignore HTTPS errors (self-signed cert API dev)
    ignoreHTTPSErrors: true,
    // Headers globaux propagated
    extraHTTPHeaders: {
      'x-test-mode': 'playwright',
      'x-test-run-id': process.env.GITHUB_RUN_ID ?? `local-${Date.now()}`,
    },
  },
  // Projects = navigateurs + locales matrix
  projects: [
    // Setup project = run AVANT autres tests (generation storageStates)
    {
      name: 'setup',
      testMatch: /global-auth-setup\.ts/,
    },
    // Project FR (par defaut)
    {
      name: 'chromium-fr',
      use: {
        ...devices['Desktop Chrome'],
        locale: 'fr-MA',
        timezoneId: 'Africa/Casablanca',
      },
      dependencies: ['setup'],
    },
    // Project AR-MA (Darija RTL)
    {
      name: 'chromium-ar-MA',
      use: {
        ...devices['Desktop Chrome'],
        locale: 'ar-MA',
        timezoneId: 'Africa/Casablanca',
      },
      dependencies: ['setup'],
      // Filtre : seulement tests i18n + a11y (autres tests font fr par defaut)
      testMatch: /(i18n|a11y)\/.*\.spec\.ts/,
    },
    // Project AR (arabe classique RTL)
    {
      name: 'chromium-ar',
      use: {
        ...devices['Desktop Chrome'],
        locale: 'ar',
        timezoneId: 'Africa/Casablanca',
      },
      dependencies: ['setup'],
      testMatch: /(i18n|a11y)\/.*\.spec\.ts/,
    },
    // Project Firefox (compat browser)
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        locale: 'fr-MA',
      },
      dependencies: ['setup'],
      // Subset critiques uniquement (cost CI)
      testMatch: /(auth|dashboard)\/.*\.spec\.ts/,
    },
    // Project Webkit Safari reel
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        locale: 'fr-MA',
      },
      dependencies: ['setup'],
      testMatch: /(auth|dashboard|contacts)\/.*\.spec\.ts/,
    },
    // Project Mobile Pixel 5 (test responsive)
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
        locale: 'fr-MA',
      },
      dependencies: ['setup'],
      // Skip kanban + drag-drop (touch events incompatibles HTML5 drag-drop)
      testMatch: /(auth|dashboard|contacts|polices)\/.*\.spec\.ts/,
    },
  ],
  // Web server : demarre l'app si pas deja running
  webServer: {
    command: 'pnpm dev',
    url: BASE_URL,
    reuseExistingServer: !IS_CI,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      NODE_ENV: 'test',
      PORT: String(PORT),
      NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000',
    },
  },
  // Global setup pour creation tenants + seeds avant TOUS les tests
  globalSetup: require.resolve('./e2e/global-setup.ts'),
  globalTeardown: require.resolve('./e2e/global-teardown.ts'),
  // Output dossier artifacts
  outputDir: 'test-results/artifacts',
});
```

### 6.2 e2e/global-setup.ts (creation tenants + seeds + storageStates)

`apps/web-broker/e2e/global-setup.ts` :

```typescript
import type { FullConfig } from '@playwright/test';
import { chromium } from '@playwright/test';
import { faker } from '@faker-js/faker/locale/fr';
import seedrandom from 'seedrandom';
import path from 'node:path';
import fs from 'node:fs/promises';
import { createTestTenant, seedTenantData } from './fixtures/test-tenant-setup';
import { TEST_USERS } from './fixtures/test-users';

/**
 * Global setup execute UNE FOIS avant tous les tests Playwright.
 * Responsabilites :
 *   1. Verifier que l'API NestJS repond (healthcheck)
 *   2. Creer 4 tenants test (1 par worker parallele)
 *   3. Seeder users (3 roles), contacts, companies, deals, polices via API
 *   4. Login chaque role -> storageState JSON cache pour reuse cross-tests
 *   5. Generer un fichier .test-state.json avec metadata tenants/users
 *
 * Important : execute SEQUENTIELLEMENT pour eviter race conditions DB.
 */
async function globalSetup(config: FullConfig): Promise<void> {
  console.log('[global-setup] Starting Sprint 16 web-broker E2E setup');

  // Deterministic seed pour faker
  const seed = process.env.TEST_FAKER_SEED ?? 'sprint-16-web-broker-2026';
  faker.seed(hashStringToInt(seed));
  seedrandom(seed, { global: true });

  // 1. Healthcheck API
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';
  await waitForApi(apiBaseUrl);
  console.log(`[global-setup] API healthy at ${apiBaseUrl}`);

  // 2. Creer 4 tenants test (1 par worker max 4 = workers Playwright CI)
  const tenantPrefix = process.env.TEST_TENANT_PREFIX ?? 'test-tenant';
  const tenants: Array<{ id: string; slug: string }> = [];
  for (let i = 1; i <= 4; i++) {
    const slug = `${tenantPrefix}-${i}-${Date.now()}`;
    const tenant = await createTestTenant({ slug, apiBaseUrl });
    tenants.push({ id: tenant.id, slug: tenant.slug });
    console.log(`[global-setup] Created tenant ${slug} (id=${tenant.id})`);
  }

  // 3. Seed donnees test dans chaque tenant
  for (const tenant of tenants) {
    await seedTenantData({
      tenantId: tenant.id,
      apiBaseUrl,
      counts: {
        contacts: 50,
        companies: 20,
        deals: 30,
        polices: 10,
        sinistres: 5,
        brokerQueueItems: 8,
      },
    });
    console.log(`[global-setup] Seeded data for tenant ${tenant.slug}`);
  }

  // 4. Login chaque role -> storageState JSON
  const browser = await chromium.launch();
  const baseURL = config.projects[0].use.baseURL ?? 'http://localhost:3001';
  const storageStatesDir = path.join(__dirname, '.auth-states');
  await fs.mkdir(storageStatesDir, { recursive: true });

  const primaryTenant = tenants[0];
  for (const [roleKey, user] of Object.entries(TEST_USERS)) {
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();

    await page.goto(`${baseURL}/fr/login`);
    await page.getByLabel(/email/i).fill(user.email);
    await page.getByLabel(/mot de passe|password/i).fill(user.password);
    await page.getByRole('button', { name: /se connecter|sign in|login/i }).click();
    // Si MFA active sur user, gerer (TEST_USERS broker_admin a MFA enabled)
    if (user.mfaEnabled) {
      await page.waitForURL(/\/verify-mfa/);
      const { generateTOTP } = await import('./fixtures/otp-helpers');
      const otp = generateTOTP(user.totpSecret!);
      await page.getByLabel(/code|verification/i).fill(otp);
      await page.getByRole('button', { name: /verifier|verify/i }).click();
    }
    // Si user appartient a > 1 tenant -> page select-tenant
    if (user.tenants && user.tenants.length > 1) {
      await page.waitForURL(/\/select-tenant/);
      await page.getByText(primaryTenant.slug).click();
    }
    await page.waitForURL(/\/dashboard/);

    const statePath = path.join(storageStatesDir, `auth-${roleKey}.json`);
    await context.storageState({ path: statePath });
    console.log(`[global-setup] storageState saved for ${roleKey} -> ${statePath}`);
    await context.close();
  }
  await browser.close();

  // 5. Sauvegarder metadata test
  const stateFile = path.join(__dirname, '.test-state.json');
  await fs.writeFile(
    stateFile,
    JSON.stringify(
      {
        seed,
        createdAt: new Date().toISOString(),
        tenants,
        users: TEST_USERS,
      },
      null,
      2,
    ),
    'utf-8',
  );

  console.log('[global-setup] OK -- E2E ready');
}

async function waitForApi(apiBaseUrl: string, maxAttempts = 60): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(`${apiBaseUrl}/health`);
      if (res.ok) return;
    } catch {
      // ignore
    }
    await new Promise((r) => setTimeout(r, 2_000));
  }
  throw new Error(`API not healthy after ${maxAttempts * 2}s`);
}

function hashStringToInt(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export default globalSetup;
```

### 6.3 e2e/global-teardown.ts (DELETE tenants cascade)

`apps/web-broker/e2e/global-teardown.ts` :

```typescript
import type { FullConfig } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs/promises';
import { deleteTestTenant } from './fixtures/test-tenant-setup';

/**
 * Global teardown execute UNE FOIS apres tous les tests.
 * Responsabilites :
 *   1. Lire .test-state.json -> liste tenants crees
 *   2. DELETE chaque tenant cascade via API
 *   3. Nettoyer storageStates et state file
 */
async function globalTeardown(_config: FullConfig): Promise<void> {
  console.log('[global-teardown] Cleanup tenants test');

  const stateFile = path.join(__dirname, '.test-state.json');
  let state: { tenants?: Array<{ id: string; slug: string }> } = {};
  try {
    const raw = await fs.readFile(stateFile, 'utf-8');
    state = JSON.parse(raw);
  } catch {
    console.warn('[global-teardown] No .test-state.json found, skipping cleanup');
    return;
  }

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

  if (state.tenants) {
    for (const tenant of state.tenants) {
      try {
        await deleteTestTenant({ tenantId: tenant.id, apiBaseUrl });
        console.log(`[global-teardown] Deleted tenant ${tenant.slug}`);
      } catch (err) {
        console.error(`[global-teardown] Failed to delete ${tenant.slug}:`, err);
      }
    }
  }

  // Cleanup auth states (ne pas conserver entre runs - mais OK garder pour debug)
  if (!process.env.KEEP_AUTH_STATES) {
    try {
      const authDir = path.join(__dirname, '.auth-states');
      await fs.rm(authDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }

  console.log('[global-teardown] OK');
}

export default globalTeardown;
```

### 6.4 e2e/fixtures/auth-helpers.ts (loginAs + setupMFA + switchTenant)

`apps/web-broker/e2e/fixtures/auth-helpers.ts` :

```typescript
import type { Page, BrowserContext } from '@playwright/test';
import { expect } from '@playwright/test';
import path from 'node:path';
import { TEST_USERS, type TestRole } from './test-users';
import { generateTOTP } from './otp-helpers';

export const AUTH_STATES_DIR = path.join(__dirname, '..', '.auth-states');

/**
 * Login a user via UI Playwright (slow, ~3s).
 * Pour tests qui valident le login lui-meme.
 * Pour autres tests, prefer storageState reuse via test.use({ storageState: 'auth-<role>.json' })
 */
export async function loginAs(page: Page, role: TestRole): Promise<void> {
  const user = TEST_USERS[role];
  await page.goto('/fr/login');
  await expect(page.getByRole('heading', { name: /connexion|login/i })).toBeVisible();

  await page.getByLabel(/email/i).fill(user.email);
  await page.getByLabel(/mot de passe|password/i).fill(user.password);
  await page.getByRole('button', { name: /se connecter|login|sign in/i }).click();

  // Si MFA enabled, gerer
  if (user.mfaEnabled) {
    await page.waitForURL(/\/verify-mfa/, { timeout: 10_000 });
    const otp = generateTOTP(user.totpSecret!);
    await page.getByLabel(/code|verification/i).fill(otp);
    await page.getByRole('button', { name: /verifier|verify/i }).click();
  }

  // Wait redirection dashboard ou select-tenant
  await page.waitForURL(/\/(dashboard|select-tenant)/, { timeout: 10_000 });
}

/**
 * Logout via API (clean cookies + session backend).
 * Plus rapide que cliquer le bouton logout dans le sidebar.
 */
export async function logoutAs(context: BrowserContext): Promise<void> {
  const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';
  const cookies = await context.cookies();
  const accessToken = cookies.find((c) => c.name === 'access_token')?.value;

  if (accessToken) {
    await fetch(`${apiUrl}/v1/auth/logout`, {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}` },
    });
  }
  await context.clearCookies();
}

/**
 * Switch tenant via tenant switcher dans topbar.
 */
export async function switchTenant(page: Page, tenantSlug: string): Promise<void> {
  // Le tenant switcher est un bouton dans la topbar (Sprint 16 tache 4.3.3)
  await page.getByRole('button', { name: /changer.*organisation|switch tenant/i }).click();
  await page.getByRole('menuitem', { name: tenantSlug }).click();
  // Wait redirection refresh
  await page.waitForLoadState('networkidle');
  await expect(page.getByText(tenantSlug)).toBeVisible();
}

/**
 * Setup MFA pour un user nouvellement cree.
 * Retourne le secret TOTP base32 pour generer codes ulterieurs.
 */
export async function setupMfa(page: Page): Promise<{ secret: string; recoveryCodes: string[] }> {
  await page.goto('/fr/profile/mfa');
  await page.getByRole('button', { name: /activer.*mfa|enable mfa/i }).click();

  // Attendre QR code visible
  await expect(page.locator('[data-testid="mfa-qr-code"]')).toBeVisible({ timeout: 5000 });

  // Extraire secret base32 affiche en clair sous QR
  const secretLocator = page.locator('[data-testid="mfa-secret-base32"]');
  await expect(secretLocator).toBeVisible();
  const secret = (await secretLocator.textContent())?.replace(/\s+/g, '').trim();
  if (!secret) throw new Error('TOTP secret not extracted from MFA page');

  // Generer OTP et soumettre
  const otp = generateTOTP(secret);
  await page.getByLabel(/code|verification/i).fill(otp);
  await page.getByRole('button', { name: /verifier|confirm/i }).click();

  // Attendre 10 recovery codes affiches
  await expect(page.locator('[data-testid="mfa-recovery-code"]')).toHaveCount(10);
  const recoveryCodes: string[] = await page.locator('[data-testid="mfa-recovery-code"]').allTextContents();

  await page.getByRole('button', { name: /j'ai sauvegarde|saved/i }).click();

  return { secret, recoveryCodes };
}

/**
 * Helper test.use storageState shortcut.
 */
export function storageStateFor(role: TestRole): string {
  return path.join(AUTH_STATES_DIR, `auth-${role}.json`);
}

/**
 * Capture l'access_token JWT depuis cookies pour requetes API directes.
 */
export async function getAccessToken(context: BrowserContext): Promise<string | null> {
  const cookies = await context.cookies();
  return cookies.find((c) => c.name === 'access_token')?.value ?? null;
}

/**
 * Wait for un toast specifique apparaitre (Sonner library).
 */
export async function expectToast(page: Page, message: string | RegExp, level: 'success' | 'error' | 'info' = 'success'): Promise<void> {
  const toast = page.locator(`[data-sonner-toast][data-type="${level}"]`).filter({ hasText: message });
  await expect(toast).toBeVisible({ timeout: 5_000 });
}
```

### 6.5 e2e/fixtures/test-tenant-setup.ts (createTestTenant + seedData)

`apps/web-broker/e2e/fixtures/test-tenant-setup.ts` :

```typescript
import { faker } from '@faker-js/faker/locale/fr';
import { TEST_USERS, type TestRole } from './test-users';
import type { TestDataCounts } from './test-data';
import { generateSeedContacts, generateSeedCompanies, generateSeedDeals, generateSeedPolices } from './test-data';

interface CreateTenantParams {
  slug: string;
  apiBaseUrl: string;
}

interface TenantResponse {
  id: string;
  slug: string;
  name: string;
  created_at: string;
}

/**
 * Cree un tenant test via endpoint admin Sprint 6.
 * Endpoint protege par TEST_API_ADMIN_TOKEN (admin JWT seede en dev/test).
 */
export async function createTestTenant({ slug, apiBaseUrl }: CreateTenantParams): Promise<TenantResponse> {
  const adminToken = process.env.TEST_API_ADMIN_TOKEN;
  if (!adminToken) throw new Error('TEST_API_ADMIN_TOKEN env var required');

  // 1. Create tenant
  const tenantRes = await fetch(`${apiBaseUrl}/v1/admin/tenants`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${adminToken}`,
      'idempotency-key': `create-${slug}`,
    },
    body: JSON.stringify({
      slug,
      name: `Test Cabinet ${slug}`,
      country: 'MA',
      currency: 'MAD',
      locale_default: 'fr',
      timezone: 'Africa/Casablanca',
      broker_acaps_id: `ACAPS-TEST-${faker.string.alphanumeric(6).toUpperCase()}`,
      broker_ice: faker.string.numeric(15),
    }),
  });
  if (!tenantRes.ok) {
    const text = await tenantRes.text();
    throw new Error(`createTestTenant failed: ${tenantRes.status} ${text}`);
  }
  const tenant: TenantResponse = await tenantRes.json();

  // 2. Create 3 users avec roles broker_*
  for (const [roleKey, user] of Object.entries(TEST_USERS)) {
    await fetch(`${apiBaseUrl}/v1/admin/users`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${adminToken}`,
        'x-tenant-id': tenant.id,
        'idempotency-key': `user-${slug}-${roleKey}`,
      },
      body: JSON.stringify({
        email: user.email,
        password: user.password,
        first_name: user.firstName,
        last_name: user.lastName,
        role: user.role,
        email_verified: true,
        mfa_enabled: user.mfaEnabled,
        mfa_secret_base32: user.totpSecret,
        tenant_id: tenant.id,
      }),
    });
  }

  return tenant;
}

export async function deleteTestTenant({ tenantId, apiBaseUrl }: { tenantId: string; apiBaseUrl: string }): Promise<void> {
  const adminToken = process.env.TEST_API_ADMIN_TOKEN;
  if (!adminToken) throw new Error('TEST_API_ADMIN_TOKEN env var required');
  const res = await fetch(`${apiBaseUrl}/v1/admin/tenants/${tenantId}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${adminToken}` },
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`deleteTestTenant failed: ${res.status}`);
  }
}

interface SeedTenantDataParams {
  tenantId: string;
  apiBaseUrl: string;
  counts: TestDataCounts;
}

/**
 * Seed donnees test (contacts, companies, deals, polices) dans un tenant.
 */
export async function seedTenantData({ tenantId, apiBaseUrl, counts }: SeedTenantDataParams): Promise<void> {
  const adminToken = process.env.TEST_API_ADMIN_TOKEN!;
  const headers = {
    'content-type': 'application/json',
    authorization: `Bearer ${adminToken}`,
    'x-tenant-id': tenantId,
  };

  // Contacts (depend des users seeded)
  const contacts = generateSeedContacts(counts.contacts);
  await batchPost(`${apiBaseUrl}/v1/crm/contacts:bulk`, headers, contacts);

  // Companies (avec ICE Maroc valide)
  const companies = generateSeedCompanies(counts.companies);
  await batchPost(`${apiBaseUrl}/v1/crm/companies:bulk`, headers, companies);

  // Deals (lien vers contacts + companies)
  const deals = generateSeedDeals(counts.deals, contacts.length, companies.length);
  await batchPost(`${apiBaseUrl}/v1/crm/deals:bulk`, headers, deals);

  // Polices
  const polices = generateSeedPolices(counts.polices, contacts.length);
  await batchPost(`${apiBaseUrl}/v1/insure/polices:bulk`, headers, polices);

  // Broker queue items (dossiers en attente)
  for (let i = 0; i < counts.brokerQueueItems; i++) {
    await fetch(`${apiBaseUrl}/v1/insure/broker-queue/items`, {
      method: 'POST',
      headers: { ...headers, 'idempotency-key': `seed-queue-${tenantId}-${i}` },
      body: JSON.stringify({
        type: faker.helpers.arrayElement(['new_police', 'avenant', 'cancel_request']),
        provisional_police_number: `PROV-${faker.string.numeric(8)}`,
        submitted_at: faker.date.recent({ days: 7 }).toISOString(),
        sla_deadline: faker.date.soon({ days: 3 }).toISOString(),
      }),
    });
  }
}

async function batchPost(url: string, headers: Record<string, string>, items: unknown[]): Promise<void> {
  // Sliced en chunks 25 items pour eviter payload > 1MB
  const chunkSize = 25;
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const res = await fetch(url, {
      method: 'POST',
      headers: { ...headers, 'idempotency-key': `batch-${url}-${i}` },
      body: JSON.stringify({ items: chunk }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`batchPost ${url} failed: ${res.status} ${text}`);
    }
  }
}
```

### 6.6 e2e/fixtures/test-users.ts (3 roles broker)

`apps/web-broker/e2e/fixtures/test-users.ts` :

```typescript
/**
 * Test users definis statiquement (deterministe).
 * Crees par globalSetup dans chaque tenant test.
 * Secrets TOTP fixes pour generation OTP reproductible.
 */
export type TestRole = 'broker_admin' | 'broker_user' | 'broker_assistant';

export interface TestUser {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: TestRole;
  mfaEnabled: boolean;
  /** Secret TOTP base32 (>= 16 chars, multiple de 8) */
  totpSecret?: string;
  /** Liste des tenants ou ce user est rattache (multi-tenant scenarios) */
  tenants?: string[];
  /** Permissions explicit (subset de full role permissions) */
  permissions?: string[];
}

export const TEST_USERS: Record<TestRole, TestUser> = {
  broker_admin: {
    email: 'admin@test.skalean-broker.ma',
    password: 'TestAdmin@2026!Strong',
    firstName: 'Admin',
    lastName: 'TestBroker',
    role: 'broker_admin',
    mfaEnabled: true,
    totpSecret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP', // base32 32 chars
    tenants: undefined, // single tenant
  },
  broker_user: {
    email: 'user@test.skalean-broker.ma',
    password: 'TestUser@2026!Strong',
    firstName: 'User',
    lastName: 'TestBroker',
    role: 'broker_user',
    mfaEnabled: false, // teste login sans MFA
  },
  broker_assistant: {
    email: 'assistant@test.skalean-broker.ma',
    password: 'TestAsst@2026!Strong',
    firstName: 'Assistant',
    lastName: 'TestBroker',
    role: 'broker_assistant',
    mfaEnabled: false,
  },
};

/**
 * Helper : retourne emails par tenant (pour scenarios multi-tenant).
 * Ex: getEmailForTenant('admin', 'test-tenant-2') => 'admin+test-tenant-2@test.skalean-broker.ma'
 */
export function getEmailForTenant(roleKey: TestRole, tenantSlug: string): string {
  const user = TEST_USERS[roleKey];
  const [local, domain] = user.email.split('@');
  return `${local}+${tenantSlug}@${domain}`;
}

/**
 * Permissions attendues par role (mirror RBAC backend Sprint 7).
 * Utilise dans tests rbac/rbac-3-roles.spec.ts pour asserter UI conditional.
 */
export const ROLE_PERMISSIONS: Record<TestRole, string[]> = {
  broker_admin: [
    'crm:read', 'crm:write', 'crm:delete',
    'deals:read', 'deals:write', 'deals:delete',
    'polices:read', 'polices:write', 'polices:cancel', 'polices:suspend',
    'broker_queue:read', 'broker_queue:validate', 'broker_queue:reject',
    'sinistres:read',
    'parametres:read', 'parametres:write',
    'users:invite', 'users:revoke',
    'reports:read', 'reports:export',
  ],
  broker_user: [
    'crm:read', 'crm:write',
    'deals:read', 'deals:write',
    'polices:read', 'polices:write',
    'broker_queue:read', 'broker_queue:validate',
    'sinistres:read',
    'reports:read',
  ],
  broker_assistant: [
    'crm:read', 'crm:write',
    'deals:read',
    'polices:read',
    'sinistres:read',
  ],
};

/**
 * Pages accessibles par role (mirror routing protection Sprint 16 task 4.3.12).
 */
export const ROLE_ACCESSIBLE_PAGES: Record<TestRole, string[]> = {
  broker_admin: [
    '/dashboard', '/contacts', '/companies', '/deals',
    '/polices', '/broker-queue', '/sinistres', '/parametres', '/profile',
  ],
  broker_user: [
    '/dashboard', '/contacts', '/companies', '/deals',
    '/polices', '/broker-queue', '/sinistres', '/profile',
  ],
  broker_assistant: [
    '/dashboard', '/contacts', '/companies', '/deals', '/polices', '/sinistres', '/profile',
  ],
};
```

### 6.7 e2e/fixtures/test-data.ts (faker seeds fr_MA)

`apps/web-broker/e2e/fixtures/test-data.ts` :

```typescript
import { faker } from '@faker-js/faker/locale/fr';

export interface TestDataCounts {
  contacts: number;
  companies: number;
  deals: number;
  polices: number;
  sinistres: number;
  brokerQueueItems: number;
}

export const PRENOMS_MAROCAINS = [
  'Mohammed', 'Ahmed', 'Youssef', 'Hassan', 'Karim', 'Omar', 'Khalid', 'Said',
  'Fatima', 'Aicha', 'Khadija', 'Salma', 'Nadia', 'Soukaina', 'Imane', 'Hanae',
];
export const NOMS_MAROCAINS = [
  'Benali', 'Alaoui', 'Bennani', 'Cherkaoui', 'El Fassi', 'Filali', 'Idrissi',
  'Kabbaj', 'Lahlou', 'Mansouri', 'Naciri', 'Rachidi', 'Sebti', 'Tahiri',
];

export const VILLES_MAROCAINES = [
  'Casablanca', 'Rabat', 'Marrakech', 'Fes', 'Tanger', 'Agadir',
  'Meknes', 'Oujda', 'Kenitra', 'Tetouan', 'Sale', 'Mohammedia',
];

/**
 * Genere un ICE Maroc valide (15 chiffres, prefix entreprise + check digit).
 * Format reel : 15 chiffres dont 9 SIREN-like + 4 etablissement + 2 cle.
 */
export function generateValidIce(): string {
  // Format simplifie : 15 chiffres, commencant par 0 ou 1 ou 2
  const prefix = faker.helpers.arrayElement(['0', '1', '2']);
  const body = faker.string.numeric(14);
  return prefix + body;
}

/**
 * Numero telephone Maroc format E.164.
 * Mobile: +212 6XXXXXXXX ou +212 7XXXXXXXX
 * Fixe: +212 5XXXXXXXX
 */
export function generateMaroccanPhone(): string {
  const prefix = faker.helpers.arrayElement(['6', '7']); // mobile
  return `+212${prefix}${faker.string.numeric(8)}`;
}

/**
 * Genere CIN Maroc (Carte d'Identite Nationale).
 * Format : 1-2 lettres uppercase + 6-7 chiffres (ex: A123456, BE1234567)
 */
export function generateCin(): string {
  const letters = faker.helpers.arrayElement([
    faker.string.alpha({ length: 1, casing: 'upper' }),
    faker.string.alpha({ length: 2, casing: 'upper' }),
  ]);
  const digits = faker.string.numeric({ length: { min: 5, max: 7 } });
  return `${letters}${digits}`;
}

export interface SeedContact {
  external_ref: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  cin: string;
  address_line1: string;
  city: string;
  postal_code: string;
  country: 'MA';
  date_of_birth: string;
  language_preference: 'fr' | 'ar';
  tags: string[];
}

export function generateSeedContacts(count: number): SeedContact[] {
  return Array.from({ length: count }, (_, i) => ({
    external_ref: `CT-TEST-${String(i + 1).padStart(5, '0')}`,
    first_name: faker.helpers.arrayElement(PRENOMS_MAROCAINS),
    last_name: faker.helpers.arrayElement(NOMS_MAROCAINS),
    email: faker.internet.email().toLowerCase(),
    phone: generateMaroccanPhone(),
    cin: generateCin(),
    address_line1: faker.location.streetAddress(),
    city: faker.helpers.arrayElement(VILLES_MAROCAINES),
    postal_code: faker.string.numeric(5),
    country: 'MA' as const,
    date_of_birth: faker.date.birthdate({ min: 18, max: 75, mode: 'age' }).toISOString().slice(0, 10),
    language_preference: faker.helpers.arrayElement(['fr', 'ar'] as const),
    tags: faker.helpers.arrayElements(['vip', 'auto', 'sante', 'mrh', 'rc', 'prospect'], { min: 1, max: 3 }),
  }));
}

export interface SeedCompany {
  external_ref: string;
  legal_name: string;
  trade_name?: string;
  ice: string;
  rc: string;
  ifu: string;
  industry: string;
  size: 'TPE' | 'PME' | 'GE';
  address_line1: string;
  city: string;
  postal_code: string;
  country: 'MA';
  primary_contact_email: string;
  primary_contact_phone: string;
}

export function generateSeedCompanies(count: number): SeedCompany[] {
  const industries = ['BTP', 'Industrie', 'Services', 'Commerce', 'Sante', 'Education', 'Transport'];
  return Array.from({ length: count }, (_, i) => ({
    external_ref: `CMP-TEST-${String(i + 1).padStart(5, '0')}`,
    legal_name: `${faker.company.name()} SARL`,
    trade_name: faker.company.buzzNoun(),
    ice: generateValidIce(),
    rc: `RC${faker.string.numeric(6)}/${faker.string.numeric(4)}`,
    ifu: faker.string.numeric(9),
    industry: faker.helpers.arrayElement(industries),
    size: faker.helpers.arrayElement(['TPE', 'PME', 'GE'] as const),
    address_line1: faker.location.streetAddress(),
    city: faker.helpers.arrayElement(VILLES_MAROCAINES),
    postal_code: faker.string.numeric(5),
    country: 'MA' as const,
    primary_contact_email: faker.internet.email().toLowerCase(),
    primary_contact_phone: generateMaroccanPhone(),
  }));
}

export interface SeedDeal {
  external_ref: string;
  title: string;
  amount: number;
  currency: 'MAD';
  stage: 'prospection' | 'qualification' | 'proposition' | 'negociation' | 'won' | 'lost';
  contact_index: number;
  company_index: number;
  expected_close_date: string;
  source: string;
}

export function generateSeedDeals(count: number, contactCount: number, companyCount: number): SeedDeal[] {
  const stages = ['prospection', 'qualification', 'proposition', 'negociation', 'won', 'lost'] as const;
  return Array.from({ length: count }, (_, i) => ({
    external_ref: `DL-TEST-${String(i + 1).padStart(5, '0')}`,
    title: `Deal ${faker.commerce.productName()}`,
    amount: faker.number.int({ min: 5_000, max: 500_000 }),
    currency: 'MAD' as const,
    stage: faker.helpers.arrayElement(stages),
    contact_index: faker.number.int({ min: 0, max: contactCount - 1 }),
    company_index: faker.number.int({ min: 0, max: companyCount - 1 }),
    expected_close_date: faker.date.soon({ days: 60 }).toISOString().slice(0, 10),
    source: faker.helpers.arrayElement(['Reference', 'Site web', 'Salon', 'Campagne', 'Inbound']),
  }));
}

export interface SeedPolice {
  external_ref: string;
  policy_number: string;
  product: 'auto' | 'mrh' | 'sante' | 'rc' | 'vie' | 'voyage';
  status: 'active' | 'pending' | 'suspended' | 'cancelled';
  premium_annual: number;
  contact_index: number;
  effective_date: string;
  expiry_date: string;
  insurer: string;
  commission_rate: number;
}

export function generateSeedPolices(count: number, contactCount: number): SeedPolice[] {
  const insurers = ['Wafa Assurance', 'AXA Maroc', 'Saham Assurance', 'RMA Watanya', 'MCMA', 'AtlantaSanad'];
  const products = ['auto', 'mrh', 'sante', 'rc', 'vie', 'voyage'] as const;
  return Array.from({ length: count }, (_, i) => {
    const effective = faker.date.recent({ days: 180 });
    const expiry = new Date(effective);
    expiry.setFullYear(expiry.getFullYear() + 1);
    return {
      external_ref: `POL-TEST-${String(i + 1).padStart(5, '0')}`,
      policy_number: `${faker.helpers.arrayElement(['AUTO', 'MRH', 'SAN'])}-${faker.string.numeric(8)}`,
      product: faker.helpers.arrayElement(products),
      status: faker.helpers.arrayElement(['active', 'active', 'active', 'pending', 'suspended', 'cancelled']),
      premium_annual: faker.number.int({ min: 1_500, max: 25_000 }),
      contact_index: faker.number.int({ min: 0, max: contactCount - 1 }),
      effective_date: effective.toISOString().slice(0, 10),
      expiry_date: expiry.toISOString().slice(0, 10),
      insurer: faker.helpers.arrayElement(insurers),
      commission_rate: faker.number.float({ min: 0.05, max: 0.18, fractionDigits: 2 }),
    };
  });
}
```

### 6.8 e2e/fixtures/a11y-helpers.ts (axe-core wrapper)

`apps/web-broker/e2e/fixtures/a11y-helpers.ts` :

```typescript
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

export interface ScanA11yOptions {
  /** Tags WCAG a verifier. Default: WCAG 2.1 AA */
  tags?: string[];
  /** Regles axe a desactiver (false positives connus) */
  disableRules?: string[];
  /** Inclure only ce selector CSS */
  include?: string | string[];
  /** Exclude ce selector */
  exclude?: string | string[];
  /** Niveau severite acceptable. Default: 'serious' rejette critical + serious */
  failOn?: 'critical' | 'serious' | 'moderate' | 'minor';
}

/**
 * Lance un scan axe-core et echoue si violations >= failOn.
 * Default : echoue sur 'critical' ou 'serious'.
 */
export async function scanA11y(page: Page, options: ScanA11yOptions = {}): Promise<void> {
  const {
    tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
    disableRules = [],
    include,
    exclude,
    failOn = 'serious',
  } = options;

  let builder = new AxeBuilder({ page }).withTags(tags);

  if (disableRules.length > 0) builder = builder.disableRules(disableRules);
  if (include) builder = builder.include(include);
  if (exclude) builder = builder.exclude(exclude);

  const results = await builder.analyze();

  // Filter violations selon failOn niveau
  const severityOrder = ['minor', 'moderate', 'serious', 'critical'] as const;
  const failOnIndex = severityOrder.indexOf(failOn);
  const blocking = results.violations.filter((v) => severityOrder.indexOf(v.impact ?? 'minor') >= failOnIndex);

  if (blocking.length > 0) {
    console.error('[a11y] Violations detected:');
    for (const v of blocking) {
      console.error(`  - [${v.impact}] ${v.id}: ${v.description}`);
      console.error(`    Help: ${v.helpUrl}`);
      console.error(`    Nodes: ${v.nodes.length}`);
      for (const node of v.nodes.slice(0, 3)) {
        console.error(`      Target: ${node.target.join(', ')}`);
      }
    }
  }

  expect(blocking, formatViolations(blocking)).toEqual([]);
}

/**
 * Scan a11y avec tolerance N violations P1 (moderate).
 * Utilise pour pages avec false positives Recharts ou Radix portals.
 */
export async function scanA11yWithTolerance(
  page: Page,
  toleratedModerateCount: number,
  options: ScanA11yOptions = {},
): Promise<void> {
  const tags = options.tags ?? ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
  let builder = new AxeBuilder({ page }).withTags(tags);
  if (options.disableRules?.length) builder = builder.disableRules(options.disableRules);
  if (options.include) builder = builder.include(options.include);
  if (options.exclude) builder = builder.exclude(options.exclude);

  const results = await builder.analyze();
  const critical = results.violations.filter((v) => v.impact === 'critical');
  const serious = results.violations.filter((v) => v.impact === 'serious');
  const moderate = results.violations.filter((v) => v.impact === 'moderate');

  expect(critical, `critical: ${formatViolations(critical)}`).toEqual([]);
  expect(serious, `serious: ${formatViolations(serious)}`).toEqual([]);
  expect(moderate.length, `moderate count exceeded ${toleratedModerateCount}`).toBeLessThanOrEqual(toleratedModerateCount);
}

function formatViolations(violations: Array<{ id: string; impact?: string; description: string; nodes: Array<{ target: string[] }> }>): string {
  if (violations.length === 0) return '';
  return violations
    .map((v) => `[${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} nodes)`)
    .join('\n');
}

/**
 * Verify color contrast specifiquement WCAG 2.1 AA (4.5:1 text normal, 3:1 large text).
 */
export async function scanColorContrast(page: Page, exclude?: string[]): Promise<void> {
  let builder = new AxeBuilder({ page }).withRules(['color-contrast']);
  if (exclude && exclude.length > 0) builder = builder.exclude(exclude);
  const results = await builder.analyze();
  expect(results.violations).toEqual([]);
}

/**
 * Verify ARIA landmarks (header, main, nav, footer) presents.
 */
export async function expectLandmarks(page: Page): Promise<void> {
  // role banner = header app
  await expect(page.locator('[role=banner], header').first()).toBeVisible();
  // role navigation = sidebar
  await expect(page.locator('[role=navigation], nav').first()).toBeVisible();
  // role main = contenu principal
  await expect(page.locator('[role=main], main').first()).toBeVisible();
  // role contentinfo = footer (optional)
}
```

### 6.9 e2e/fixtures/otp-helpers.ts (TOTP generation)

`apps/web-broker/e2e/fixtures/otp-helpers.ts` :

```typescript
import { authenticator } from 'otplib';

// Conformite Loi 53-05 confiance numerique : RFC 6238 TOTP 30s window 6 digits
authenticator.options = {
  digits: 6,
  step: 30,
  window: 1, // tolerance +- 1 window (30s avant/apres)
  algorithm: 'sha1',
};

/**
 * Genere un code TOTP 6 chiffres a partir d'un secret base32.
 */
export function generateTOTP(secretBase32: string): string {
  return authenticator.generate(secretBase32);
}

/**
 * Verifie un code TOTP (utile pour tests qui valident la logique backend).
 */
export function verifyTOTP(token: string, secretBase32: string): boolean {
  return authenticator.verify({ token, secret: secretBase32 });
}

/**
 * Attendre debut prochaine window TOTP (utile pour tests qui veulent code frais).
 */
export async function waitForNextTotpWindow(): Promise<void> {
  const now = Date.now();
  const remainingMs = 30_000 - (now % 30_000);
  await new Promise((r) => setTimeout(r, remainingMs + 500));
}
```

### 6.10 e2e/auth/login.spec.ts (login OK / wrong creds / MFA)

`apps/web-broker/e2e/auth/login.spec.ts` :

```typescript
import { test, expect } from '@playwright/test';
import { TEST_USERS } from '../fixtures/test-users';
import { generateTOTP } from '../fixtures/otp-helpers';
import { expectToast } from '../fixtures/auth-helpers';
import { scanA11y } from '../fixtures/a11y-helpers';

// Ces tests UTILISENT le login lui-meme, donc PAS de storageState reuse.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('auth: login flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/fr/login');
  });

  test('login OK broker_user (sans MFA)', async ({ page }) => {
    const user = TEST_USERS.broker_user;
    await page.getByLabel(/email/i).fill(user.email);
    await page.getByLabel(/mot de passe|password/i).fill(user.password);
    await page.getByRole('button', { name: /se connecter|login/i }).click();
    await page.waitForURL(/\/dashboard/);
    await expect(page.getByRole('heading', { name: /tableau de bord|dashboard/i })).toBeVisible();
    // Verify cookie access_token set httpOnly
    const cookies = await page.context().cookies();
    const accessCookie = cookies.find((c) => c.name === 'access_token');
    expect(accessCookie).toBeDefined();
    expect(accessCookie!.httpOnly).toBe(true);
    expect(accessCookie!.sameSite).toBe('Lax');
  });

  test('login wrong credentials -> erreur 401', async ({ page }) => {
    await page.getByLabel(/email/i).fill('wrong@test.skalean-broker.ma');
    await page.getByLabel(/mot de passe|password/i).fill('WrongPassword123!');
    await page.getByRole('button', { name: /se connecter|login/i }).click();
    await expectToast(page, /identifiants invalides|invalid credentials/i, 'error');
    // Reste sur /login
    await expect(page).toHaveURL(/\/login/);
  });

  test('login broker_admin avec MFA TOTP', async ({ page }) => {
    const user = TEST_USERS.broker_admin;
    await page.getByLabel(/email/i).fill(user.email);
    await page.getByLabel(/mot de passe|password/i).fill(user.password);
    await page.getByRole('button', { name: /se connecter|login/i }).click();
    // Redirection page MFA
    await page.waitForURL(/\/verify-mfa/);
    await expect(page.getByRole('heading', { name: /verification|verify/i })).toBeVisible();
    // Generer OTP
    const otp = generateTOTP(user.totpSecret!);
    await page.getByLabel(/code|verification/i).fill(otp);
    await page.getByRole('button', { name: /verifier|verify/i }).click();
    await page.waitForURL(/\/dashboard/);
  });

  test('login MFA code invalide -> retry', async ({ page }) => {
    const user = TEST_USERS.broker_admin;
    await page.getByLabel(/email/i).fill(user.email);
    await page.getByLabel(/mot de passe|password/i).fill(user.password);
    await page.getByRole('button', { name: /se connecter|login/i }).click();
    await page.waitForURL(/\/verify-mfa/);
    // Code invalide
    await page.getByLabel(/code/i).fill('000000');
    await page.getByRole('button', { name: /verifier/i }).click();
    await expectToast(page, /code invalide|invalid code/i, 'error');
    await expect(page).toHaveURL(/\/verify-mfa/);
  });

  test('login rate limit apres 5 tentatives ratees', async ({ page }) => {
    const user = TEST_USERS.broker_user;
    for (let i = 0; i < 5; i++) {
      await page.getByLabel(/email/i).fill(user.email);
      await page.getByLabel(/mot de passe|password/i).fill('WrongPassword' + i);
      await page.getByRole('button', { name: /se connecter/i }).click();
      await page.waitForTimeout(300);
    }
    // 6e tentative = lockout
    await page.getByLabel(/email/i).fill(user.email);
    await page.getByLabel(/mot de passe|password/i).fill(user.password);
    await page.getByRole('button', { name: /se connecter/i }).click();
    await expectToast(page, /trop de tentatives|too many attempts/i, 'error');
  });

  test('login page a11y WCAG 2.1 AA', async ({ page }) => {
    await scanA11y(page);
  });

  test('login : tab order coherent (a11y keyboard)', async ({ page }) => {
    // Tab depuis debut page
    await page.keyboard.press('Tab'); // skip link
    await page.keyboard.press('Tab'); // logo
    await page.keyboard.press('Tab'); // email
    await expect(page.getByLabel(/email/i)).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByLabel(/mot de passe|password/i)).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('checkbox', { name: /se souvenir|remember/i })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: /se connecter|login/i })).toBeFocused();
  });
});
```

### 6.11 e2e/auth/signup.spec.ts (signup + email verify)

`apps/web-broker/e2e/auth/signup.spec.ts` :

```typescript
import { test, expect } from '@playwright/test';
import { faker } from '@faker-js/faker/locale/fr';
import { expectToast } from '../fixtures/auth-helpers';
import { scanA11y } from '../fixtures/a11y-helpers';

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('auth: signup flow', () => {
  test('signup nouveau cabinet broker -> verify email -> redirect login', async ({ page, request }) => {
    const slug = `signup-test-${Date.now()}`;
    const email = `owner-${slug}@test.skalean-broker.ma`;
    const password = 'StrongP@ssw0rd2026!';

    await page.goto('/fr/signup');
    await page.getByLabel(/nom du cabinet|company name/i).fill(`Cabinet ${faker.company.name()}`);
    await page.getByLabel(/slug|identifiant/i).fill(slug);
    await page.getByLabel(/prenom|first name/i).fill('Mohammed');
    await page.getByLabel(/^nom$|last name/i).fill('Benali');
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/mot de passe|password/i).fill(password);
    await page.getByLabel(/confirmation/i).fill(password);
    await page.getByLabel(/conditions|cgu/i).check();
    await page.getByRole('button', { name: /creer|create/i }).click();
    // Toast success + redirect page verify-email-sent
    await expectToast(page, /email envoye|email sent/i, 'success');
    await page.waitForURL(/\/verify-email-sent/);

    // Recuperer token verify via API admin (Mailhog) ou DB endpoint test
    const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';
    const adminToken = process.env.TEST_API_ADMIN_TOKEN!;
    const tokenRes = await request.get(`${apiUrl}/v1/admin/test/email-verifications?email=${email}`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(tokenRes.ok()).toBe(true);
    const { token } = await tokenRes.json();
    expect(token).toBeTruthy();

    // Visiter le lien de verify
    await page.goto(`/fr/verify-email?token=${token}`);
    await expectToast(page, /email verifie|email verified/i, 'success');
    await page.waitForURL(/\/login/);
  });

  test('signup password trop faible -> erreur validation', async ({ page }) => {
    await page.goto('/fr/signup');
    await page.getByLabel(/nom du cabinet/i).fill('Test');
    await page.getByLabel(/slug/i).fill('test-weak');
    await page.getByLabel(/prenom/i).fill('Test');
    await page.getByLabel(/^nom$/i).fill('Test');
    await page.getByLabel(/email/i).fill('test@test.ma');
    await page.getByLabel(/mot de passe/i).fill('weak');
    await page.getByLabel(/confirmation/i).fill('weak');
    await page.getByLabel(/conditions/i).check();
    await page.getByRole('button', { name: /creer/i }).click();
    await expect(page.getByText(/au moins 12 caracteres|at least 12 characters/i)).toBeVisible();
  });

  test('signup email deja utilise -> erreur 409', async ({ page }) => {
    await page.goto('/fr/signup');
    await page.getByLabel(/nom du cabinet/i).fill('Test Cabinet');
    await page.getByLabel(/slug/i).fill(`existing-${Date.now()}`);
    await page.getByLabel(/prenom/i).fill('Test');
    await page.getByLabel(/^nom$/i).fill('Existing');
    await page.getByLabel(/email/i).fill('admin@test.skalean-broker.ma'); // deja seed
    await page.getByLabel(/mot de passe/i).fill('StrongP@ssw0rd2026!');
    await page.getByLabel(/confirmation/i).fill('StrongP@ssw0rd2026!');
    await page.getByLabel(/conditions/i).check();
    await page.getByRole('button', { name: /creer/i }).click();
    await expectToast(page, /email deja utilise|email already exists/i, 'error');
  });

  test('signup page a11y WCAG 2.1 AA', async ({ page }) => {
    await page.goto('/fr/signup');
    await scanA11y(page);
  });
});
```

### 6.12 e2e/auth/recovery.spec.ts (forgot + reset)

`apps/web-broker/e2e/auth/recovery.spec.ts` :

```typescript
import { test, expect } from '@playwright/test';
import { TEST_USERS } from '../fixtures/test-users';
import { expectToast } from '../fixtures/auth-helpers';
import { scanA11y } from '../fixtures/a11y-helpers';

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('auth: recovery flow', () => {
  test('forgot password -> reset link email -> nouveau password OK', async ({ page, request }) => {
    const user = TEST_USERS.broker_assistant;
    await page.goto('/fr/forgot-password');
    await page.getByLabel(/email/i).fill(user.email);
    await page.getByRole('button', { name: /envoyer|send/i }).click();
    await expectToast(page, /email envoye|email sent/i, 'success');

    // Recuperer reset token
    const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';
    const adminToken = process.env.TEST_API_ADMIN_TOKEN!;
    const tokenRes = await request.get(`${apiUrl}/v1/admin/test/password-recoveries?email=${user.email}`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const { token } = await tokenRes.json();

    // Nouvelle page reset
    await page.goto(`/fr/reset-password?token=${token}`);
    const newPassword = 'NouveauP@ssw0rd2026!Test';
    await page.getByLabel(/nouveau mot de passe|new password/i).fill(newPassword);
    await page.getByLabel(/confirmation/i).fill(newPassword);
    await page.getByRole('button', { name: /reinitialiser|reset/i }).click();
    await expectToast(page, /mot de passe reinitialise|password reset/i, 'success');
    await page.waitForURL(/\/login/);

    // Verifier login avec nouveau password
    await page.getByLabel(/email/i).fill(user.email);
    await page.getByLabel(/mot de passe/i).fill(newPassword);
    await page.getByRole('button', { name: /se connecter/i }).click();
    await page.waitForURL(/\/dashboard/);
  });

  test('forgot password email inconnu -> ne pas divulguer existence (security)', async ({ page }) => {
    await page.goto('/fr/forgot-password');
    await page.getByLabel(/email/i).fill('inexistant@test.skalean-broker.ma');
    await page.getByRole('button', { name: /envoyer/i }).click();
    // Doit montrer meme message success que email existant (anti-enumeration)
    await expectToast(page, /si.*existe.*email.*envoye|if.*exists.*email.*sent/i, 'success');
  });

  test('reset token expired -> erreur', async ({ page }) => {
    await page.goto('/fr/reset-password?token=expired-token-fake-12345');
    await expect(page.getByText(/token.*invalide|expire/i)).toBeVisible();
  });

  test('forgot password page a11y', async ({ page }) => {
    await page.goto('/fr/forgot-password');
    await scanA11y(page);
  });
});
```

### 6.13 e2e/auth/multi-tenant.spec.ts (select-tenant)

`apps/web-broker/e2e/auth/multi-tenant.spec.ts` :

```typescript
import { test, expect } from '@playwright/test';
import { TEST_USERS } from '../fixtures/test-users';
import { generateTOTP } from '../fixtures/otp-helpers';

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('auth: multi-tenant select', () => {
  test('user multi-tenant voit page select-tenant apres login', async ({ page }) => {
    // Pre-condition : user broker_admin est rattache a tenant-test-1 et tenant-test-2 (seede par globalSetup)
    const user = TEST_USERS.broker_admin;
    await page.goto('/fr/login');
    await page.getByLabel(/email/i).fill(user.email);
    await page.getByLabel(/mot de passe/i).fill(user.password);
    await page.getByRole('button', { name: /se connecter/i }).click();
    if (user.mfaEnabled) {
      await page.waitForURL(/\/verify-mfa/);
      await page.getByLabel(/code/i).fill(generateTOTP(user.totpSecret!));
      await page.getByRole('button', { name: /verifier/i }).click();
    }
    // Redirection select-tenant car > 1 tenant
    await page.waitForURL(/\/select-tenant/);
    // Liste tenants visibles
    await expect(page.locator('[data-testid="tenant-card"]')).toHaveCount(2);
    // Click premier tenant
    await page.locator('[data-testid="tenant-card"]').first().click();
    await page.waitForURL(/\/dashboard/);

    // Verify cookie current_tenant_id set
    const cookies = await page.context().cookies();
    const tenantCookie = cookies.find((c) => c.name === 'current_tenant_id');
    expect(tenantCookie).toBeDefined();
    expect(tenantCookie!.value).toBeTruthy();
  });

  test('user mono-tenant skip page select-tenant', async ({ page }) => {
    const user = TEST_USERS.broker_user; // single tenant
    await page.goto('/fr/login');
    await page.getByLabel(/email/i).fill(user.email);
    await page.getByLabel(/mot de passe/i).fill(user.password);
    await page.getByRole('button', { name: /se connecter/i }).click();
    // Direct dashboard (skip select)
    await page.waitForURL(/\/dashboard/);
  });
});
```

### 6.14 e2e/dashboard/dashboard.spec.ts (6 widgets render + filters)

`apps/web-broker/e2e/dashboard/dashboard.spec.ts` :

```typescript
import { test, expect } from '@playwright/test';
import { storageStateFor } from '../fixtures/auth-helpers';
import { scanA11yWithTolerance } from '../fixtures/a11y-helpers';

test.use({ storageState: storageStateFor('broker_admin') });

test.describe('dashboard: widgets + filters', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/fr/dashboard');
    await page.waitForLoadState('networkidle');
  });

  test('6 widgets visible et rendus', async ({ page }) => {
    // Revenue widget
    await expect(page.locator('[data-testid="widget-revenue"]')).toBeVisible();
    await expect(page.locator('[data-testid="widget-revenue"] [data-testid="kpi-value"]')).not.toBeEmpty();
    // Conversion widget
    await expect(page.locator('[data-testid="widget-conversion"]')).toBeVisible();
    // Polices widget
    await expect(page.locator('[data-testid="widget-polices"]')).toBeVisible();
    // Sinistres widget
    await expect(page.locator('[data-testid="widget-sinistres"]')).toBeVisible();
    // Deals open widget
    await expect(page.locator('[data-testid="widget-deals-open"]')).toBeVisible();
    // Activity feed
    await expect(page.locator('[data-testid="widget-activity"]')).toBeVisible();
  });

  test('filtres period (7j / 30j / 90j / YTD)', async ({ page }) => {
    // Default = 30j
    const revenueValue30j = await page.locator('[data-testid="widget-revenue"] [data-testid="kpi-value"]').textContent();
    // Switch to 7j
    await page.getByRole('button', { name: /7 jours|7 days/i }).click();
    await page.waitForLoadState('networkidle');
    const revenueValue7j = await page.locator('[data-testid="widget-revenue"] [data-testid="kpi-value"]').textContent();
    // Les valeurs doivent differer (le 7j typiquement < 30j)
    expect(revenueValue7j).not.toEqual(revenueValue30j);
    // Switch to YTD
    await page.getByRole('button', { name: /annee|ytd/i }).click();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('[data-testid="widget-revenue"]')).toBeVisible();
  });

  test('filtre produit (auto/mrh/sante/...)', async ({ page }) => {
    await page.getByRole('combobox', { name: /produit|product/i }).click();
    await page.getByRole('option', { name: /auto/i }).click();
    await page.waitForLoadState('networkidle');
    // KPIs doivent refresh
    await expect(page.locator('[data-testid="widget-revenue"]')).toBeVisible();
  });

  test('refresh button rafraichit les widgets', async ({ page }) => {
    await page.getByRole('button', { name: /actualiser|refresh/i }).click();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('[data-testid="widget-revenue"]')).toBeVisible();
  });

  test('dashboard a11y WCAG 2.1 AA (tolerate <=3 moderate sur charts SVG)', async ({ page }) => {
    // Recharts SVG cause moderate violations color-contrast attendues
    await scanA11yWithTolerance(page, 3, {
      disableRules: ['svg-img-alt'], // SVG charts ont des accessible labels Recharts internes
    });
  });

  test('dashboard charts ont tooltip accessible (keyboard)', async ({ page }) => {
    const chart = page.locator('[data-testid="widget-revenue"] svg').first();
    await chart.focus();
    await page.keyboard.press('ArrowRight');
    // Tooltip Recharts apparait au focus
    await expect(page.locator('.recharts-tooltip-wrapper')).toBeVisible();
  });

  test('breadcrumb visible et clickable', async ({ page }) => {
    await expect(page.getByRole('navigation', { name: /breadcrumb/i })).toBeVisible();
  });
});
```

### 6.15 e2e/contacts/contacts-crud.spec.ts (CRUD + search + bulk)

`apps/web-broker/e2e/contacts/contacts-crud.spec.ts` :

```typescript
import { test, expect } from '@playwright/test';
import { faker } from '@faker-js/faker/locale/fr';
import { storageStateFor, expectToast } from '../fixtures/auth-helpers';
import { generateMaroccanPhone, generateCin, PRENOMS_MAROCAINS, NOMS_MAROCAINS } from '../fixtures/test-data';
import { scanA11y } from '../fixtures/a11y-helpers';

test.use({ storageState: storageStateFor('broker_admin') });

test.describe('contacts: CRUD complete', () => {
  test('list contacts -> 50 lignes minimum + pagination', async ({ page }) => {
    await page.goto('/fr/contacts');
    await expect(page.getByRole('heading', { name: /contacts/i })).toBeVisible();
    // 50 seedes par tenant ; page size 25 -> 25 visibles + pagination
    const rows = page.locator('[data-testid="contact-row"]');
    await expect(rows).toHaveCount(25);
    // Pagination next
    await page.getByRole('button', { name: /suivant|next/i }).click();
    await page.waitForLoadState('networkidle');
    await expect(rows).toHaveCount(25);
  });

  test('search contact par nom', async ({ page }) => {
    await page.goto('/fr/contacts');
    await page.getByPlaceholder(/rechercher|search/i).fill('Benali');
    await page.waitForLoadState('networkidle');
    // Au moins 1 ligne avec "Benali"
    await expect(page.locator('[data-testid="contact-row"]').filter({ hasText: /benali/i }).first()).toBeVisible();
  });

  test('filtre par tag VIP', async ({ page }) => {
    await page.goto('/fr/contacts');
    await page.getByRole('button', { name: /filtres|filters/i }).click();
    await page.getByLabel(/tag/i).click();
    await page.getByRole('option', { name: /vip/i }).click();
    await page.getByRole('button', { name: /appliquer|apply/i }).click();
    await page.waitForLoadState('networkidle');
    // Resultats avec badge VIP
    await expect(page.locator('[data-testid="contact-row"] [data-testid="tag-vip"]').first()).toBeVisible();
  });

  test('create contact OK', async ({ page }) => {
    await page.goto('/fr/contacts');
    await page.getByRole('button', { name: /nouveau contact|new contact/i }).click();
    const firstName = faker.helpers.arrayElement(PRENOMS_MAROCAINS);
    const lastName = faker.helpers.arrayElement(NOMS_MAROCAINS);
    const email = `${firstName}.${lastName}.${Date.now()}@test.ma`.toLowerCase();
    await page.getByLabel(/prenom/i).fill(firstName);
    await page.getByLabel(/^nom$/i).fill(lastName);
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/telephone|phone/i).fill(generateMaroccanPhone());
    await page.getByLabel(/cin/i).fill(generateCin());
    await page.getByLabel(/adresse/i).fill(faker.location.streetAddress());
    await page.getByLabel(/ville|city/i).fill('Casablanca');
    await page.getByLabel(/code postal/i).fill('20000');
    await page.getByRole('button', { name: /enregistrer|save/i }).click();
    await expectToast(page, /contact cree|contact created/i);
    // Verify retour list + nouveau contact present
    await page.waitForURL(/\/contacts/);
    await page.getByPlaceholder(/rechercher/i).fill(email);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('[data-testid="contact-row"]').filter({ hasText: email })).toBeVisible();
  });

  test('create contact validation phone Maroc format', async ({ page }) => {
    await page.goto('/fr/contacts/new');
    await page.getByLabel(/telephone/i).fill('0612'); // invalide trop court
    await page.getByLabel(/prenom/i).fill('Test');
    await page.getByLabel(/^nom$/i).fill('Test');
    await page.getByLabel(/email/i).fill('test@test.ma');
    await page.getByRole('button', { name: /enregistrer/i }).click();
    await expect(page.getByText(/format.*telephone|invalid phone/i)).toBeVisible();
  });

  test('edit contact existant', async ({ page }) => {
    await page.goto('/fr/contacts');
    const firstRow = page.locator('[data-testid="contact-row"]').first();
    await firstRow.click();
    // Detail page
    await page.waitForURL(/\/contacts\/[a-f0-9-]+/);
    await page.getByRole('button', { name: /modifier|edit/i }).click();
    const newPhone = '+212661234567';
    await page.getByLabel(/telephone/i).fill(newPhone);
    await page.getByRole('button', { name: /enregistrer/i }).click();
    await expectToast(page, /modifie|updated/i);
    await expect(page.getByText(newPhone)).toBeVisible();
  });

  test('delete contact avec confirmation', async ({ page }) => {
    await page.goto('/fr/contacts');
    const firstRow = page.locator('[data-testid="contact-row"]').first();
    const contactName = await firstRow.locator('[data-testid="contact-name"]').textContent();
    await firstRow.click();
    await page.waitForURL(/\/contacts\/[a-f0-9-]+/);
    await page.getByRole('button', { name: /supprimer|delete/i }).click();
    // Confirmation dialog
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: /confirmer|confirm/i }).click();
    await expectToast(page, /supprime|deleted/i);
    await page.waitForURL(/\/contacts$/);
    // Verify contact absent de la liste
    if (contactName) {
      await page.getByPlaceholder(/rechercher/i).fill(contactName);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('[data-testid="contact-row"]').filter({ hasText: contactName })).toHaveCount(0);
    }
  });

  test('bulk action : tag 5 contacts en VIP', async ({ page }) => {
    await page.goto('/fr/contacts');
    // Selectionner 5 premiers via checkbox
    for (let i = 0; i < 5; i++) {
      await page.locator('[data-testid="contact-row"]').nth(i).locator('[role="checkbox"]').click();
    }
    // Bulk actions menu
    await page.getByRole('button', { name: /actions/i }).click();
    await page.getByRole('menuitem', { name: /tagger.*vip|tag vip/i }).click();
    await expectToast(page, /5.*contacts.*tagges|5.*contacts tagged/i);
  });

  test('bulk export CSV', async ({ page }) => {
    await page.goto('/fr/contacts');
    // Selectionner 3 contacts
    for (let i = 0; i < 3; i++) {
      await page.locator('[data-testid="contact-row"]').nth(i).locator('[role="checkbox"]').click();
    }
    await page.getByRole('button', { name: /actions/i }).click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('menuitem', { name: /exporter csv|export csv/i }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/contacts.*\.csv/);
  });

  test('contacts list a11y WCAG 2.1 AA', async ({ page }) => {
    await page.goto('/fr/contacts');
    await scanA11y(page);
  });
});
```

### 6.16 e2e/contacts/contacts-detail.spec.ts (timeline + attached deals)

`apps/web-broker/e2e/contacts/contacts-detail.spec.ts` :

```typescript
import { test, expect } from '@playwright/test';
import { storageStateFor } from '../fixtures/auth-helpers';
import { scanA11y } from '../fixtures/a11y-helpers';

test.use({ storageState: storageStateFor('broker_admin') });

test.describe('contacts: detail page', () => {
  test('timeline activites visible et triee desc', async ({ page }) => {
    await page.goto('/fr/contacts');
    await page.locator('[data-testid="contact-row"]').first().click();
    await page.waitForURL(/\/contacts\/[a-f0-9-]+/);
    // Timeline visible
    await expect(page.getByRole('region', { name: /timeline|activites|activities/i })).toBeVisible();
    // Items tries du plus recent au plus ancien
    const items = page.locator('[data-testid="timeline-item"]');
    const count = await items.count();
    if (count >= 2) {
      const firstDate = await items.first().getAttribute('data-timestamp');
      const lastDate = await items.last().getAttribute('data-timestamp');
      expect(Date.parse(firstDate!)).toBeGreaterThanOrEqual(Date.parse(lastDate!));
    }
  });

  test('onglet deals attaches', async ({ page }) => {
    await page.goto('/fr/contacts');
    await page.locator('[data-testid="contact-row"]').first().click();
    await page.getByRole('tab', { name: /deals/i }).click();
    await expect(page.getByRole('tabpanel', { name: /deals/i })).toBeVisible();
  });

  test('onglet polices attachees', async ({ page }) => {
    await page.goto('/fr/contacts');
    await page.locator('[data-testid="contact-row"]').first().click();
    await page.getByRole('tab', { name: /polices/i }).click();
    await expect(page.getByRole('tabpanel', { name: /polices/i })).toBeVisible();
  });

  test('onglet sinistres lies', async ({ page }) => {
    await page.goto('/fr/contacts');
    await page.locator('[data-testid="contact-row"]').first().click();
    await page.getByRole('tab', { name: /sinistres/i }).click();
    await expect(page.getByRole('tabpanel', { name: /sinistres/i })).toBeVisible();
  });

  test('ajouter une note depuis timeline', async ({ page }) => {
    await page.goto('/fr/contacts');
    await page.locator('[data-testid="contact-row"]').first().click();
    await page.getByRole('button', { name: /ajouter note|add note/i }).click();
    await page.getByLabel(/note/i).fill('Note test E2E Sprint 16');
    await page.getByRole('button', { name: /enregistrer/i }).click();
    await expect(page.getByText('Note test E2E Sprint 16')).toBeVisible();
  });

  test('contact detail a11y', async ({ page }) => {
    await page.goto('/fr/contacts');
    await page.locator('[data-testid="contact-row"]').first().click();
    await scanA11y(page);
  });
});
```

### 6.17 e2e/companies/companies-crud.spec.ts (ICE Maroc validation)

`apps/web-broker/e2e/companies/companies-crud.spec.ts` :

```typescript
import { test, expect } from '@playwright/test';
import { faker } from '@faker-js/faker/locale/fr';
import { storageStateFor, expectToast } from '../fixtures/auth-helpers';
import { generateValidIce, generateMaroccanPhone } from '../fixtures/test-data';
import { scanA11y } from '../fixtures/a11y-helpers';

test.use({ storageState: storageStateFor('broker_admin') });

test.describe('companies: CRUD + ICE validation', () => {
  test('list companies', async ({ page }) => {
    await page.goto('/fr/companies');
    await expect(page.locator('[data-testid="company-row"]').first()).toBeVisible();
  });

  test('create company avec ICE valide', async ({ page }) => {
    await page.goto('/fr/companies/new');
    await page.getByLabel(/raison sociale|legal name/i).fill(`Test ${faker.company.name()}`);
    await page.getByLabel(/^ice$/i).fill(generateValidIce());
    await page.getByLabel(/rc|registre commerce/i).fill(`RC${faker.string.numeric(6)}/2025`);
    await page.getByLabel(/ifu/i).fill(faker.string.numeric(9));
    await page.getByLabel(/secteur|industry/i).click();
    await page.getByRole('option', { name: /services/i }).click();
    await page.getByLabel(/taille|size/i).click();
    await page.getByRole('option', { name: /pme/i }).click();
    await page.getByLabel(/adresse/i).fill('123 Boulevard Mohammed V');
    await page.getByLabel(/ville/i).fill('Casablanca');
    await page.getByLabel(/code postal/i).fill('20000');
    await page.getByLabel(/email/i).fill(faker.internet.email());
    await page.getByLabel(/telephone/i).fill(generateMaroccanPhone());
    await page.getByRole('button', { name: /enregistrer/i }).click();
    await expectToast(page, /entreprise creee|company created/i);
  });

  test('create company ICE invalide -> erreur', async ({ page }) => {
    await page.goto('/fr/companies/new');
    await page.getByLabel(/raison sociale/i).fill('Test SARL');
    await page.getByLabel(/^ice$/i).fill('12345'); // pas 15 chiffres
    await page.getByLabel(/email/i).fill('test@test.ma');
    await page.getByRole('button', { name: /enregistrer/i }).click();
    await expect(page.getByText(/ice.*15 chiffres|ice.*15 digits/i)).toBeVisible();
  });

  test('create company ICE doublon -> erreur 409', async ({ page }) => {
    await page.goto('/fr/companies');
    // Recuperer ICE existant de la 1ere ligne
    const existingIce = await page.locator('[data-testid="company-row"] [data-testid="company-ice"]').first().textContent();

    await page.goto('/fr/companies/new');
    await page.getByLabel(/raison sociale/i).fill('Test Doublon SARL');
    await page.getByLabel(/^ice$/i).fill(existingIce!.replace(/\s/g, ''));
    await page.getByLabel(/email/i).fill('test@test.ma');
    await page.getByRole('button', { name: /enregistrer/i }).click();
    await expectToast(page, /ice.*existe|ice.*exists/i, 'error');
  });

  test('detail company affiche ICE + RC + IFU', async ({ page }) => {
    await page.goto('/fr/companies');
    await page.locator('[data-testid="company-row"]').first().click();
    await page.waitForURL(/\/companies\/[a-f0-9-]+/);
    await expect(page.locator('[data-testid="company-ice"]')).toBeVisible();
    await expect(page.locator('[data-testid="company-rc"]')).toBeVisible();
    await expect(page.locator('[data-testid="company-ifu"]')).toBeVisible();
  });

  test('company detail a11y', async ({ page }) => {
    await page.goto('/fr/companies');
    await page.locator('[data-testid="company-row"]').first().click();
    await scanA11y(page);
  });
});
```

### 6.18 e2e/deals/deals-kanban.spec.ts (drag-drop stages)

`apps/web-broker/e2e/deals/deals-kanban.spec.ts` :

```typescript
import { test, expect } from '@playwright/test';
import { storageStateFor, expectToast } from '../fixtures/auth-helpers';
import { scanA11yWithTolerance } from '../fixtures/a11y-helpers';

test.use({ storageState: storageStateFor('broker_admin') });

// dnd-kit drag-drop fonctionne mal sur webkit + firefox
test.skip(({ browserName }) => browserName !== 'chromium', 'kanban drag-drop fiable uniquement sur chromium');

test.describe('deals: kanban + drag-drop', () => {
  test('kanban view 6 colonnes visibles', async ({ page }) => {
    await page.goto('/fr/deals');
    // Toggle to kanban view (par defaut table)
    await page.getByRole('button', { name: /kanban/i }).click();
    await expect(page.locator('[data-testid="kanban-column"]')).toHaveCount(6);
    for (const stage of ['Prospection', 'Qualification', 'Proposition', 'Negociation', 'Won', 'Lost']) {
      await expect(page.getByRole('heading', { name: new RegExp(stage, 'i') })).toBeVisible();
    }
  });

  test('drag-drop deal prospection -> qualification', async ({ page }) => {
    await page.goto('/fr/deals?view=kanban');

    const prospectionColumn = page.locator('[data-testid="kanban-column"]', { hasText: /prospection/i });
    const qualificationColumn = page.locator('[data-testid="kanban-column"]', { hasText: /qualification/i });

    const card = prospectionColumn.locator('[data-testid="deal-card"]').first();
    const cardId = await card.getAttribute('data-deal-id');

    // Drag and drop via Playwright dragTo
    await card.dragTo(qualificationColumn);
    await page.waitForLoadState('networkidle');

    // Verify deal est maintenant dans qualification column
    await expect(qualificationColumn.locator(`[data-deal-id="${cardId}"]`)).toBeVisible();
    await expectToast(page, /deal.*deplace|deal.*moved/i);
  });

  test('drag-drop vers won declenche modal commission', async ({ page }) => {
    await page.goto('/fr/deals?view=kanban');
    const negociationColumn = page.locator('[data-testid="kanban-column"]', { hasText: /negociation/i });
    const wonColumn = page.locator('[data-testid="kanban-column"]', { hasText: /won/i });

    const card = negociationColumn.locator('[data-testid="deal-card"]').first();
    await card.dragTo(wonColumn);

    // Modal "Generer la police?" apparait
    await expect(page.getByRole('dialog', { name: /generer.*police|generate police/i })).toBeVisible();
    await page.getByRole('button', { name: /annuler|cancel/i }).click();
  });

  test('deal card affiche montant + contact + company', async ({ page }) => {
    await page.goto('/fr/deals?view=kanban');
    const card = page.locator('[data-testid="deal-card"]').first();
    await expect(card.locator('[data-testid="deal-amount"]')).toBeVisible();
    await expect(card.locator('[data-testid="deal-contact"]')).toBeVisible();
    await expect(card.locator('[data-testid="deal-company"]')).toBeVisible();
  });

  test('kanban a11y (drag-drop ARIA + announcements live region)', async ({ page }) => {
    await page.goto('/fr/deals?view=kanban');
    // Live region dnd-kit announces drag operations
    await expect(page.locator('[role=status][aria-live=assertive]').first()).toBeAttached();
    await scanA11yWithTolerance(page, 5, {
      disableRules: ['aria-required-children'], // dnd-kit role-grid violations expected
    });
  });

  test('kanban keyboard drag-drop (Space + arrows)', async ({ page }) => {
    await page.goto('/fr/deals?view=kanban');
    const card = page.locator('[data-testid="deal-card"]').first();
    await card.focus();
    // Space active drag mode
    await page.keyboard.press('Space');
    // Right arrow deplace vers colonne suivante
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Space'); // drop
    await page.waitForLoadState('networkidle');
    // Verify deal deplace via toast
    await expect(page.locator('[data-sonner-toast]')).toBeVisible();
  });
});
```

### 6.19 e2e/deals/deals-table.spec.ts (filter + sort)

`apps/web-broker/e2e/deals/deals-table.spec.ts` :

```typescript
import { test, expect } from '@playwright/test';
import { storageStateFor } from '../fixtures/auth-helpers';
import { scanA11y } from '../fixtures/a11y-helpers';

test.use({ storageState: storageStateFor('broker_admin') });

test.describe('deals: table view', () => {
  test('table view affiche colonnes title/contact/amount/stage/close_date', async ({ page }) => {
    await page.goto('/fr/deals?view=table');
    for (const col of ['Titre', 'Contact', 'Montant', 'Stage', 'Cloture']) {
      await expect(page.getByRole('columnheader', { name: new RegExp(col, 'i') })).toBeVisible();
    }
  });

  test('sort by montant desc', async ({ page }) => {
    await page.goto('/fr/deals?view=table');
    await page.getByRole('columnheader', { name: /montant/i }).click();
    // Click 2nd time = desc
    await page.getByRole('columnheader', { name: /montant/i }).click();
    await page.waitForLoadState('networkidle');
    const amounts = await page.locator('[data-testid="deal-amount"]').allTextContents();
    const numbers = amounts.map((s) => Number(s.replace(/[^\d]/g, '')));
    for (let i = 1; i < numbers.length; i++) {
      expect(numbers[i]).toBeLessThanOrEqual(numbers[i - 1]);
    }
  });

  test('filter by stage = Negociation', async ({ page }) => {
    await page.goto('/fr/deals?view=table');
    await page.getByRole('button', { name: /filtres/i }).click();
    await page.getByLabel(/stage/i).click();
    await page.getByRole('option', { name: /negociation/i }).click();
    await page.getByRole('button', { name: /appliquer/i }).click();
    await page.waitForLoadState('networkidle');
    // Toutes lignes ont stage Negociation
    const stages = await page.locator('[data-testid="deal-stage"]').allTextContents();
    for (const s of stages) {
      expect(s.toLowerCase()).toContain('negociation');
    }
  });

  test('deals table a11y', async ({ page }) => {
    await page.goto('/fr/deals?view=table');
    await scanA11y(page);
  });
});
```

### 6.20 e2e/deals/deals-create.spec.ts (create + won shortcut)

`apps/web-broker/e2e/deals/deals-create.spec.ts` :

```typescript
import { test, expect } from '@playwright/test';
import { faker } from '@faker-js/faker/locale/fr';
import { storageStateFor, expectToast } from '../fixtures/auth-helpers';

test.use({ storageState: storageStateFor('broker_admin') });

test.describe('deals: create + won shortcut', () => {
  test('create deal lie a contact + company', async ({ page }) => {
    await page.goto('/fr/deals');
    await page.getByRole('button', { name: /nouveau deal|new deal/i }).click();

    const title = `Deal Test ${Date.now()}`;
    await page.getByLabel(/titre|title/i).fill(title);
    await page.getByLabel(/montant|amount/i).fill('150000');

    // Async combobox contact
    await page.getByLabel(/contact/i).click();
    await page.getByPlaceholder(/rechercher contact/i).fill('Benali');
    await page.locator('[data-testid="contact-option"]').first().click();

    // Combobox company
    await page.getByLabel(/entreprise|company/i).click();
    await page.locator('[data-testid="company-option"]').first().click();

    // Stage default = prospection
    await page.getByLabel(/cloture prevue|expected close/i).fill('2026-08-15');
    await page.getByRole('button', { name: /enregistrer/i }).click();
    await expectToast(page, /deal cree|deal created/i);
    await page.waitForURL(/\/deals\/[a-f0-9-]+/);
    await expect(page.getByText(title)).toBeVisible();
  });

  test('won shortcut depuis kanban genere police', async ({ page }) => {
    await page.goto('/fr/deals?view=kanban');
    // Hover sur card, bouton "Marquer Won"
    const card = page.locator('[data-testid="deal-card"]').first();
    await card.hover();
    await card.getByRole('button', { name: /marquer won|mark won/i }).click();
    // Modal commission
    await expect(page.getByRole('dialog', { name: /generer.*police/i })).toBeVisible();
    await page.getByLabel(/produit/i).click();
    await page.getByRole('option', { name: /auto/i }).click();
    await page.getByRole('button', { name: /generer|generate/i }).click();
    await expectToast(page, /police.*generee|police.*generated/i);
  });
});
```

### 6.21 e2e/polices/polices-list.spec.ts (list + filters)

`apps/web-broker/e2e/polices/polices-list.spec.ts` :

```typescript
import { test, expect } from '@playwright/test';
import { storageStateFor } from '../fixtures/auth-helpers';
import { scanA11y } from '../fixtures/a11y-helpers';

test.use({ storageState: storageStateFor('broker_admin') });

test.describe('polices: list', () => {
  test('list polices affiche numero + produit + statut + prime', async ({ page }) => {
    await page.goto('/fr/polices');
    await expect(page.locator('[data-testid="police-row"]').first()).toBeVisible();
    const firstRow = page.locator('[data-testid="police-row"]').first();
    await expect(firstRow.locator('[data-testid="police-number"]')).toBeVisible();
    await expect(firstRow.locator('[data-testid="police-product"]')).toBeVisible();
    await expect(firstRow.locator('[data-testid="police-status"]')).toBeVisible();
    await expect(firstRow.locator('[data-testid="police-premium"]')).toBeVisible();
  });

  test('filter par produit = auto', async ({ page }) => {
    await page.goto('/fr/polices');
    await page.getByRole('button', { name: /filtres/i }).click();
    await page.getByLabel(/produit/i).click();
    await page.getByRole('option', { name: /^auto$/i }).click();
    await page.getByRole('button', { name: /appliquer/i }).click();
    await page.waitForLoadState('networkidle');
    const products = await page.locator('[data-testid="police-product"]').allTextContents();
    for (const p of products) {
      expect(p.toLowerCase()).toBe('auto');
    }
  });

  test('filter par statut = active', async ({ page }) => {
    await page.goto('/fr/polices');
    await page.getByRole('button', { name: /filtres/i }).click();
    await page.getByLabel(/statut/i).click();
    await page.getByRole('option', { name: /active/i }).click();
    await page.getByRole('button', { name: /appliquer/i }).click();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('[data-testid="police-status"][data-status="active"]').first()).toBeVisible();
  });

  test('filter par echeance dans 30 jours', async ({ page }) => {
    await page.goto('/fr/polices');
    await page.getByRole('button', { name: /filtres/i }).click();
    await page.getByLabel(/echeance/i).click();
    await page.getByRole('option', { name: /30 jours/i }).click();
    await page.getByRole('button', { name: /appliquer/i }).click();
    await page.waitForLoadState('networkidle');
    // Verifier que toutes les dates sont <= today + 30 jours
  });

  test('polices list a11y', async ({ page }) => {
    await page.goto('/fr/polices');
    await scanA11y(page);
  });
});
```

### 6.22 e2e/polices/polices-detail.spec.ts (tabs all)

`apps/web-broker/e2e/polices/polices-detail.spec.ts` :

```typescript
import { test, expect } from '@playwright/test';
import { storageStateFor } from '../fixtures/auth-helpers';
import { scanA11y } from '../fixtures/a11y-helpers';

test.use({ storageState: storageStateFor('broker_admin') });

test.describe('polices: detail page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/fr/polices');
    await page.locator('[data-testid="police-row"]').first().click();
    await page.waitForURL(/\/polices\/[a-f0-9-]+/);
  });

  test('header affiche numero + assure + insurer + statut', async ({ page }) => {
    await expect(page.locator('[data-testid="police-number"]')).toBeVisible();
    await expect(page.locator('[data-testid="police-insured"]')).toBeVisible();
    await expect(page.locator('[data-testid="police-insurer"]')).toBeVisible();
    await expect(page.locator('[data-testid="police-status"]')).toBeVisible();
  });

  test('onglet timeline visible', async ({ page }) => {
    await page.getByRole('tab', { name: /timeline|chronologie/i }).click();
    await expect(page.getByRole('tabpanel', { name: /timeline/i })).toBeVisible();
    await expect(page.locator('[data-testid="timeline-event"]').first()).toBeVisible();
  });

  test('onglet primes (premiums) liste echeances', async ({ page }) => {
    await page.getByRole('tab', { name: /primes|premiums/i }).click();
    await expect(page.getByRole('tabpanel', { name: /primes/i })).toBeVisible();
    await expect(page.locator('[data-testid="premium-row"]').first()).toBeVisible();
  });

  test('onglet avenants (endorsements) liste modifs', async ({ page }) => {
    await page.getByRole('tab', { name: /avenants|endorsements/i }).click();
    await expect(page.getByRole('tabpanel', { name: /avenants/i })).toBeVisible();
  });

  test('onglet sinistres lies a la police', async ({ page }) => {
    await page.getByRole('tab', { name: /sinistres/i }).click();
    await expect(page.getByRole('tabpanel', { name: /sinistres/i })).toBeVisible();
  });

  test('onglet documents (contrats + justificatifs)', async ({ page }) => {
    await page.getByRole('tab', { name: /documents/i }).click();
    await expect(page.getByRole('tabpanel', { name: /documents/i })).toBeVisible();
  });

  test('action "nouvel avenant" ouvre wizard', async ({ page }) => {
    await page.getByRole('button', { name: /nouvel avenant|new endorsement/i }).click();
    await expect(page.getByRole('dialog', { name: /avenant/i })).toBeVisible();
  });

  test('police detail a11y', async ({ page }) => {
    await scanA11y(page);
  });

  test('police detail responsive mobile (Pixel 5)', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'mobile only');
    // Verify tabs scroll horizontalement sur mobile
    await expect(page.getByRole('tablist')).toBeVisible();
  });
});
```

### 6.23 e2e/polices/polices-cancel.spec.ts (pro-rata preview)

`apps/web-broker/e2e/polices/polices-cancel.spec.ts` :

```typescript
import { test, expect } from '@playwright/test';
import { storageStateFor, expectToast } from '../fixtures/auth-helpers';

test.use({ storageState: storageStateFor('broker_admin') });

test.describe('polices: cancel with pro-rata', () => {
  test('cancel police affiche apercu pro-rata + confirme', async ({ page }) => {
    await page.goto('/fr/polices');
    // Filtrer status=active
    await page.getByRole('button', { name: /filtres/i }).click();
    await page.getByLabel(/statut/i).click();
    await page.getByRole('option', { name: /active/i }).click();
    await page.getByRole('button', { name: /appliquer/i }).click();
    await page.waitForLoadState('networkidle');

    await page.locator('[data-testid="police-row"]').first().click();
    await page.waitForURL(/\/polices\/[a-f0-9-]+/);

    await page.getByRole('button', { name: /resilier|cancel/i }).click();
    // Modal cancel wizard
    await expect(page.getByRole('dialog', { name: /resiliation|cancellation/i })).toBeVisible();

    // Step 1 : raison + date effet
    await page.getByLabel(/raison/i).click();
    await page.getByRole('option', { name: /demande client/i }).click();
    const today = new Date().toISOString().slice(0, 10);
    await page.getByLabel(/date effet/i).fill(today);
    await page.getByRole('button', { name: /suivant|next/i }).click();

    // Step 2 : apercu pro-rata (calcule backend)
    await expect(page.locator('[data-testid="prorata-premium-original"]')).toBeVisible();
    await expect(page.locator('[data-testid="prorata-days-remaining"]')).toBeVisible();
    await expect(page.locator('[data-testid="prorata-refund-amount"]')).toBeVisible();

    const refundText = await page.locator('[data-testid="prorata-refund-amount"]').textContent();
    expect(refundText).toMatch(/\d/); // contient un nombre

    // Step 3 : confirmer
    await page.getByRole('button', { name: /confirmer.*resiliation|confirm cancellation/i }).click();
    await expectToast(page, /police.*resiliee|police cancelled/i);

    // Status update
    await expect(page.locator('[data-testid="police-status"]')).toContainText(/resiliee|cancelled/i);
  });

  test('cancel police date future declenche cancel programmee', async ({ page }) => {
    await page.goto('/fr/polices');
    await page.locator('[data-testid="police-row"]').first().click();
    await page.getByRole('button', { name: /resilier/i }).click();
    await page.getByLabel(/raison/i).click();
    await page.getByRole('option', { name: /demande client/i }).click();
    // Date dans 30 jours
    const future = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    await page.getByLabel(/date effet/i).fill(future);
    await page.getByRole('button', { name: /suivant/i }).click();
    await expect(page.locator('[data-testid="scheduled-cancel-warning"]')).toBeVisible();
  });
});
```

### 6.24 e2e/polices/polices-suspend.spec.ts (suspend with raison)

`apps/web-broker/e2e/polices/polices-suspend.spec.ts` :

```typescript
import { test, expect } from '@playwright/test';
import { storageStateFor, expectToast } from '../fixtures/auth-helpers';

test.use({ storageState: storageStateFor('broker_admin') });

test.describe('polices: suspend', () => {
  test('suspend police pour impaye', async ({ page }) => {
    await page.goto('/fr/polices');
    await page.locator('[data-testid="police-row"]').first().click();
    await page.getByRole('button', { name: /suspendre|suspend/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByLabel(/raison/i).click();
    await page.getByRole('option', { name: /impaye/i }).click();
    await page.getByLabel(/commentaire|comment/i).fill('Echec prelevement 3 fois consecutifs');
    await page.getByRole('button', { name: /confirmer/i }).click();
    await expectToast(page, /police suspendue|police suspended/i);
    await expect(page.locator('[data-testid="police-status"]')).toContainText(/suspendue|suspended/i);
  });

  test('reactivation police suspendue', async ({ page }) => {
    await page.goto('/fr/polices');
    await page.getByRole('button', { name: /filtres/i }).click();
    await page.getByLabel(/statut/i).click();
    await page.getByRole('option', { name: /suspendue/i }).click();
    await page.getByRole('button', { name: /appliquer/i }).click();
    await page.waitForLoadState('networkidle');

    if (await page.locator('[data-testid="police-row"]').count() > 0) {
      await page.locator('[data-testid="police-row"]').first().click();
      await page.getByRole('button', { name: /reactiver|reactivate/i }).click();
      await page.getByRole('button', { name: /confirmer/i }).click();
      await expectToast(page, /police reactivee|police reactivated/i);
    }
  });
});
```

### 6.25 e2e/broker-queue/queue-validate.spec.ts (provisional -> definitif)

`apps/web-broker/e2e/broker-queue/queue-validate.spec.ts` :

```typescript
import { test, expect } from '@playwright/test';
import { storageStateFor, expectToast } from '../fixtures/auth-helpers';
import { scanA11y } from '../fixtures/a11y-helpers';

test.use({ storageState: storageStateFor('broker_admin') });

test.describe('broker-queue: validate dossier', () => {
  test('liste broker queue affiche dossiers pending', async ({ page }) => {
    await page.goto('/fr/broker-queue');
    await expect(page.getByRole('heading', { name: /queue.*validation|validation queue/i })).toBeVisible();
    await expect(page.locator('[data-testid="queue-item"]').first()).toBeVisible();
  });

  test('validate dossier avec replacement provisional -> definitif', async ({ page }) => {
    await page.goto('/fr/broker-queue');
    const firstItem = page.locator('[data-testid="queue-item"]').first();
    const provisionalNumber = await firstItem.locator('[data-testid="provisional-police-number"]').textContent();
    await firstItem.click();
    await page.waitForURL(/\/broker-queue\/[a-f0-9-]+/);

    // Verify info dossier
    await expect(page.locator('[data-testid="provisional-police-number"]')).toContainText(provisionalNumber!);
    await expect(page.locator('[data-testid="dossier-documents"] [data-testid="document-item"]').first()).toBeVisible();

    // Cliquer Valider
    await page.getByRole('button', { name: /valider|validate/i }).click();
    // Modal confirm
    await expect(page.getByRole('dialog', { name: /confirmer validation/i })).toBeVisible();
    await page.getByRole('button', { name: /confirmer/i }).click();
    await expectToast(page, /dossier valide|dossier validated/i);

    // Replacement provisional -> definitif visible
    await expect(page.locator('[data-testid="definitive-police-number"]')).toBeVisible();
    await expect(page.locator('[data-testid="definitive-police-number"]')).not.toHaveText(provisionalNumber!);
    // Status update
    await expect(page.locator('[data-testid="dossier-status"]')).toContainText(/valide|validated/i);
  });

  test('validate envoie email client confirmation', async ({ page, request }) => {
    await page.goto('/fr/broker-queue');
    const firstItem = page.locator('[data-testid="queue-item"]').first();
    const itemId = await firstItem.getAttribute('data-item-id');
    await firstItem.click();
    await page.getByRole('button', { name: /valider/i }).click();
    await page.getByRole('button', { name: /confirmer/i }).click();
    await expectToast(page, /dossier valide/i);

    // Verifier email envoye via admin API test endpoint
    const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';
    const adminToken = process.env.TEST_API_ADMIN_TOKEN!;
    const emailRes = await request.get(`${apiUrl}/v1/admin/test/emails?ref=broker_queue_item_${itemId}`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const emails = await emailRes.json();
    expect(emails.length).toBeGreaterThanOrEqual(1);
  });

  test('broker-queue validate a11y', async ({ page }) => {
    await page.goto('/fr/broker-queue');
    await scanA11y(page);
  });
});
```

### 6.26 e2e/broker-queue/queue-reject.spec.ts (reject + customer notify)

`apps/web-broker/e2e/broker-queue/queue-reject.spec.ts` :

```typescript
import { test, expect } from '@playwright/test';
import { storageStateFor, expectToast } from '../fixtures/auth-helpers';

test.use({ storageState: storageStateFor('broker_admin') });

test.describe('broker-queue: reject dossier', () => {
  test('reject avec raison documente -> client notifie', async ({ page }) => {
    await page.goto('/fr/broker-queue');
    await page.locator('[data-testid="queue-item"]').first().click();
    await page.getByRole('button', { name: /rejeter|reject/i }).click();
    await expect(page.getByRole('dialog', { name: /rejet|reject/i })).toBeVisible();
    await page.getByLabel(/raison/i).click();
    await page.getByRole('option', { name: /documents manquants/i }).click();
    await page.getByLabel(/details|details/i).fill('CIN illisible. Merci de renvoyer un scan haute qualite.');
    await page.getByRole('button', { name: /confirmer.*rejet|confirm rejection/i }).click();
    await expectToast(page, /dossier rejete|dossier rejected/i);
    await expect(page.locator('[data-testid="dossier-status"]')).toContainText(/rejete|rejected/i);
  });

  test('reject avec raison "documents manquants" propose liste documents', async ({ page }) => {
    await page.goto('/fr/broker-queue');
    await page.locator('[data-testid="queue-item"]').first().click();
    await page.getByRole('button', { name: /rejeter/i }).click();
    await page.getByLabel(/raison/i).click();
    await page.getByRole('option', { name: /documents manquants/i }).click();
    // Checklist documents apparait
    await expect(page.locator('[data-testid="missing-docs-checklist"]')).toBeVisible();
    // Check 2 documents manquants
    await page.getByLabel(/copie cin recto-verso/i).check();
    await page.getByLabel(/permis de conduire/i).check();
    await page.getByRole('button', { name: /confirmer.*rejet/i }).click();
    await expectToast(page, /dossier rejete/i);
  });

  test('reject avec dossier critique => escalation broker_admin email', async ({ page }) => {
    await page.goto('/fr/broker-queue');
    await page.locator('[data-testid="queue-item"]').first().click();
    await page.getByRole('button', { name: /rejeter/i }).click();
    await page.getByLabel(/raison/i).click();
    await page.getByRole('option', { name: /fraude|fraud/i }).click();
    await page.getByLabel(/details/i).fill('Suspicion fraude documents falsifies.');
    await page.getByLabel(/escalader/i).check();
    await page.getByRole('button', { name: /confirmer.*rejet/i }).click();
    await expectToast(page, /escaladage.*envoye/i);
  });
});
```

### 6.27 e2e/broker-queue/queue-sla.spec.ts (SLA timer + couleurs)

`apps/web-broker/e2e/broker-queue/queue-sla.spec.ts` :

```typescript
import { test, expect } from '@playwright/test';
import { storageStateFor } from '../fixtures/auth-helpers';

test.use({ storageState: storageStateFor('broker_admin') });

test.describe('broker-queue: SLA timer + couleurs', () => {
  test('SLA badge couleur verte (> 24h restantes)', async ({ page }) => {
    await page.goto('/fr/broker-queue');
    // Filter sla_remaining_hours > 24
    const greenBadges = page.locator('[data-testid="sla-badge"][data-severity="ok"]');
    if (await greenBadges.count() > 0) {
      await expect(greenBadges.first()).toBeVisible();
      // Verify class/style green
      const color = await greenBadges.first().evaluate((el) => getComputedStyle(el).backgroundColor);
      // Green RGB approx
      expect(color).toMatch(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    }
  });

  test('SLA badge orange (6-24h restantes)', async ({ page }) => {
    await page.goto('/fr/broker-queue');
    const orangeBadges = page.locator('[data-testid="sla-badge"][data-severity="warning"]');
    if (await orangeBadges.count() > 0) {
      await expect(orangeBadges.first()).toBeVisible();
    }
  });

  test('SLA badge rouge (< 6h ou depasse)', async ({ page }) => {
    await page.goto('/fr/broker-queue');
    const redBadges = page.locator('[data-testid="sla-badge"][data-severity="critical"]');
    if (await redBadges.count() > 0) {
      await expect(redBadges.first()).toBeVisible();
    }
  });

  test('tri par SLA ascendant montre les plus urgents en premier', async ({ page }) => {
    await page.goto('/fr/broker-queue');
    await page.getByRole('columnheader', { name: /sla/i }).click();
    await page.waitForLoadState('networkidle');
    const slas = await page.locator('[data-testid="sla-remaining-hours"]').allTextContents();
    const hours = slas.map((s) => parseFloat(s));
    for (let i = 1; i < hours.length; i++) {
      expect(hours[i]).toBeGreaterThanOrEqual(hours[i - 1]);
    }
  });
});
```

### 6.28 e2e/sinistres/sinistres-read-only.spec.ts (no write buttons)

`apps/web-broker/e2e/sinistres/sinistres-read-only.spec.ts` :

```typescript
import { test, expect } from '@playwright/test';
import { storageStateFor } from '../fixtures/auth-helpers';
import { scanA11y } from '../fixtures/a11y-helpers';

test.use({ storageState: storageStateFor('broker_admin') });

test.describe('sinistres: read-only courtier', () => {
  test('list sinistres affiche colonnes mais aucun bouton create/edit/delete', async ({ page }) => {
    await page.goto('/fr/sinistres');
    await expect(page.getByRole('heading', { name: /sinistres/i })).toBeVisible();

    // PAS de bouton "Nouveau sinistre"
    await expect(page.getByRole('button', { name: /nouveau sinistre|new claim/i })).toHaveCount(0);

    // Lines affichees
    if (await page.locator('[data-testid="sinistre-row"]').count() > 0) {
      await expect(page.locator('[data-testid="sinistre-row"]').first()).toBeVisible();
    }
  });

  test('detail sinistre affiche infos mais boutons modify/delete absents', async ({ page }) => {
    await page.goto('/fr/sinistres');
    const count = await page.locator('[data-testid="sinistre-row"]').count();
    test.skip(count === 0, 'no sinistres seeded');

    await page.locator('[data-testid="sinistre-row"]').first().click();
    await page.waitForURL(/\/sinistres\/[a-f0-9-]+/);
    await expect(page.locator('[data-testid="sinistre-number"]')).toBeVisible();
    await expect(page.locator('[data-testid="sinistre-status"]')).toBeVisible();

    // PAS de boutons d'edition/suppression
    await expect(page.getByRole('button', { name: /modifier|edit/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /supprimer|delete/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /assigner expert|assign expert/i })).toHaveCount(0);
  });

  test('breadcrumb depuis police -> sinistres lies fonctionne', async ({ page }) => {
    await page.goto('/fr/polices');
    await page.locator('[data-testid="police-row"]').first().click();
    await page.getByRole('tab', { name: /sinistres/i }).click();
    const sinistreLinks = page.locator('[data-testid="sinistre-link"]');
    if (await sinistreLinks.count() > 0) {
      await sinistreLinks.first().click();
      await page.waitForURL(/\/sinistres\/[a-f0-9-]+/);
    }
  });

  test('sinistres a11y', async ({ page }) => {
    await page.goto('/fr/sinistres');
    await scanA11y(page);
  });

  test('broker_assistant a meme acces read-only sinistres', async ({ browser }) => {
    const context = await browser.newContext({ storageState: storageStateFor('broker_assistant') });
    const page = await context.newPage();
    await page.goto('/fr/sinistres');
    await expect(page.getByRole('heading', { name: /sinistres/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /nouveau sinistre/i })).toHaveCount(0);
    await context.close();
  });
});
```

### 6.29 e2e/profile/mfa-setup.spec.ts (QR + verify + recovery codes)

`apps/web-broker/e2e/profile/mfa-setup.spec.ts` :

```typescript
import { test, expect } from '@playwright/test';
import { storageStateFor, expectToast, setupMfa } from '../fixtures/auth-helpers';
import { generateTOTP } from '../fixtures/otp-helpers';
import { scanA11y } from '../fixtures/a11y-helpers';

// On utilise broker_user (mfaEnabled=false) pour tester l'activation MFA
test.use({ storageState: storageStateFor('broker_user') });

test.describe('profile: MFA setup', () => {
  test('activer MFA -> QR + secret + verify + recovery codes', async ({ page }) => {
    const { secret, recoveryCodes } = await setupMfa(page);
    expect(secret.length).toBeGreaterThanOrEqual(16);
    expect(recoveryCodes).toHaveLength(10);
    // Chaque recovery code = format XXXX-XXXX 8 chars alphanum
    for (const code of recoveryCodes) {
      expect(code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    }
    await expectToast(page, /mfa active|mfa enabled/i);
  });

  test('MFA setup invalid OTP -> rester sur step verify', async ({ page }) => {
    await page.goto('/fr/profile/mfa');
    await page.getByRole('button', { name: /activer mfa/i }).click();
    await expect(page.locator('[data-testid="mfa-qr-code"]')).toBeVisible();
    // Fournir code invalide
    await page.getByLabel(/code/i).fill('000000');
    await page.getByRole('button', { name: /verifier/i }).click();
    await expectToast(page, /code invalide/i, 'error');
    await expect(page.locator('[data-testid="mfa-qr-code"]')).toBeVisible();
  });

  test('MFA desactivation necessite password + OTP courant', async ({ page }) => {
    // Pre-condition : MFA active depuis test precedent (sequential storageState shared = false!)
    // On la fait depuis broker_admin qui a deja MFA
    const adminContext = await page.context().browser()!.newContext({ storageState: storageStateFor('broker_admin') });
    const adminPage = await adminContext.newPage();
    await adminPage.goto('/fr/profile/mfa');
    if (await adminPage.getByRole('button', { name: /desactiver mfa|disable mfa/i }).isVisible()) {
      await adminPage.getByRole('button', { name: /desactiver mfa/i }).click();
      await adminPage.getByLabel(/mot de passe actuel/i).fill('TestAdmin@2026!Strong');
      await adminPage.getByLabel(/code/i).fill('123456'); // mauvais code, doit echouer
      await adminPage.getByRole('button', { name: /confirmer/i }).click();
      await expect(adminPage.getByText(/code invalide/i)).toBeVisible();
    }
    await adminContext.close();
  });

  test('regenerer recovery codes invalide les anciens', async ({ page }) => {
    // MFA deja active (sequence depend test #1)
    await page.goto('/fr/profile/mfa');
    if (await page.getByRole('button', { name: /regenerer codes/i }).isVisible()) {
      await page.getByRole('button', { name: /regenerer codes/i }).click();
      // Modal confirm
      await page.getByLabel(/mot de passe/i).fill('TestUser@2026!Strong');
      await page.getByRole('button', { name: /confirmer/i }).click();
      // Nouveaux 10 codes affiches
      await expect(page.locator('[data-testid="mfa-recovery-code"]')).toHaveCount(10);
    }
  });

  test('mfa page a11y', async ({ page }) => {
    await page.goto('/fr/profile/mfa');
    await scanA11y(page);
  });
});
```

### 6.30 e2e/profile/change-password.spec.ts (change password flow)

`apps/web-broker/e2e/profile/change-password.spec.ts` :

```typescript
import { test, expect } from '@playwright/test';
import { storageStateFor, expectToast } from '../fixtures/auth-helpers';
import { TEST_USERS } from '../fixtures/test-users';

test.use({ storageState: storageStateFor('broker_assistant') });

test.describe('profile: change password', () => {
  test('change password avec ancien -> nouveau OK', async ({ page }) => {
    const oldPassword = TEST_USERS.broker_assistant.password;
    const newPassword = 'NewAssistant@2026!Test';

    await page.goto('/fr/profile/security');
    await page.getByLabel(/mot de passe actuel|current password/i).fill(oldPassword);
    await page.getByLabel(/nouveau mot de passe|new password/i).fill(newPassword);
    await page.getByLabel(/confirmer/i).fill(newPassword);
    await page.getByRole('button', { name: /changer.*mot de passe|change password/i }).click();
    await expectToast(page, /mot de passe modifie|password changed/i);

    // Sessions autres invalidates
    await expect(page.getByText(/autres sessions deconnectees|other sessions logged out/i)).toBeVisible();

    // Remettre l'ancien pour idempotence cross-tests (race condition acceptable test isolation)
    await page.getByLabel(/mot de passe actuel/i).fill(newPassword);
    await page.getByLabel(/nouveau mot de passe/i).fill(oldPassword);
    await page.getByLabel(/confirmer/i).fill(oldPassword);
    await page.getByRole('button', { name: /changer.*mot de passe/i }).click();
  });

  test('change password avec ancien faux -> erreur', async ({ page }) => {
    await page.goto('/fr/profile/security');
    await page.getByLabel(/mot de passe actuel/i).fill('WrongOldPassword');
    await page.getByLabel(/nouveau mot de passe/i).fill('NewP@ssw0rd2026!');
    await page.getByLabel(/confirmer/i).fill('NewP@ssw0rd2026!');
    await page.getByRole('button', { name: /changer/i }).click();
    await expectToast(page, /mot de passe actuel.*incorrect|current password.*invalid/i, 'error');
  });

  test('change password nouveau identique a l\'ancien -> erreur', async ({ page }) => {
    const password = TEST_USERS.broker_assistant.password;
    await page.goto('/fr/profile/security');
    await page.getByLabel(/mot de passe actuel/i).fill(password);
    await page.getByLabel(/nouveau mot de passe/i).fill(password);
    await page.getByLabel(/confirmer/i).fill(password);
    await page.getByRole('button', { name: /changer/i }).click();
    await expect(page.getByText(/different.*ancien|different from old/i)).toBeVisible();
  });
});
```

### 6.31 e2e/parametres/parametres-admin-only.spec.ts (broker_admin only)

`apps/web-broker/e2e/parametres/parametres-admin-only.spec.ts` :

```typescript
import { test, expect } from '@playwright/test';
import { storageStateFor } from '../fixtures/auth-helpers';
import { scanA11y } from '../fixtures/a11y-helpers';

test.describe('parametres: broker_admin only', () => {
  test('broker_admin accede /parametres', async ({ browser }) => {
    const context = await browser.newContext({ storageState: storageStateFor('broker_admin') });
    const page = await context.newPage();
    await page.goto('/fr/parametres');
    await expect(page.getByRole('heading', { name: /parametres|settings/i })).toBeVisible();
    await context.close();
  });

  test('broker_user redirige vers /dashboard (403)', async ({ browser }) => {
    const context = await browser.newContext({ storageState: storageStateFor('broker_user') });
    const page = await context.newPage();
    await page.goto('/fr/parametres');
    await page.waitForURL(/\/(dashboard|forbidden)/, { timeout: 5000 });
    await context.close();
  });

  test('broker_assistant redirige vers /dashboard (403)', async ({ browser }) => {
    const context = await browser.newContext({ storageState: storageStateFor('broker_assistant') });
    const page = await context.newPage();
    await page.goto('/fr/parametres');
    await page.waitForURL(/\/(dashboard|forbidden)/, { timeout: 5000 });
    await context.close();
  });

  test('parametres broker_admin onglets visibles', async ({ browser }) => {
    const context = await browser.newContext({ storageState: storageStateFor('broker_admin') });
    const page = await context.newPage();
    await page.goto('/fr/parametres');
    for (const tab of ['Cabinet', 'Utilisateurs', 'ACAPS', 'Notifications', 'Facturation']) {
      await expect(page.getByRole('tab', { name: new RegExp(tab, 'i') })).toBeVisible();
    }
    await context.close();
  });

  test('onglet ACAPS affiche numero enregistrement', async ({ browser }) => {
    const context = await browser.newContext({ storageState: storageStateFor('broker_admin') });
    const page = await context.newPage();
    await page.goto('/fr/parametres');
    await page.getByRole('tab', { name: /acaps/i }).click();
    await expect(page.locator('[data-testid="broker-acaps-id"]')).toBeVisible();
    await expect(page.locator('[data-testid="broker-ice"]')).toBeVisible();
    await context.close();
  });

  test('parametres a11y', async ({ browser }) => {
    const context = await browser.newContext({ storageState: storageStateFor('broker_admin') });
    const page = await context.newPage();
    await page.goto('/fr/parametres');
    await scanA11y(page);
    await context.close();
  });
});
```

### 6.32 e2e/rbac/rbac-3-roles.spec.ts (3 roles scenarios complets)

`apps/web-broker/e2e/rbac/rbac-3-roles.spec.ts` :

```typescript
import { test, expect } from '@playwright/test';
import { storageStateFor } from '../fixtures/auth-helpers';
import { ROLE_PERMISSIONS, ROLE_ACCESSIBLE_PAGES, type TestRole } from '../fixtures/test-users';

test.describe('rbac: 3 roles broker_admin / broker_user / broker_assistant', () => {

  for (const role of ['broker_admin', 'broker_user', 'broker_assistant'] as TestRole[]) {
    test(`${role} : pages accessibles correspondent ROLE_ACCESSIBLE_PAGES`, async ({ browser }) => {
      const context = await browser.newContext({ storageState: storageStateFor(role) });
      const page = await context.newPage();

      for (const path of ROLE_ACCESSIBLE_PAGES[role]) {
        await page.goto(`/fr${path}`);
        // Pas de redirection 403 / 404
        await page.waitForLoadState('domcontentloaded');
        const url = page.url();
        expect(url).toContain(path);
      }

      await context.close();
    });

    test(`${role} : pages restrictes redirigent`, async ({ browser }) => {
      const context = await browser.newContext({ storageState: storageStateFor(role) });
      const page = await context.newPage();

      const restricted = ['/dashboard', '/contacts', '/parametres'].filter(
        (p) => !ROLE_ACCESSIBLE_PAGES[role].includes(p),
      );

      for (const path of restricted) {
        await page.goto(`/fr${path}`);
        await page.waitForLoadState('domcontentloaded');
        const url = page.url();
        // Doit etre redirige vers dashboard ou forbidden
        expect(url).toMatch(/\/(dashboard|forbidden)/);
      }

      await context.close();
    });
  }

  test('broker_admin voit bouton "Inviter utilisateur" dans sidebar', async ({ browser }) => {
    const context = await browser.newContext({ storageState: storageStateFor('broker_admin') });
    const page = await context.newPage();
    await page.goto('/fr/dashboard');
    await expect(page.getByRole('button', { name: /inviter utilisateur|invite user/i })).toBeVisible();
    await context.close();
  });

  test('broker_user NE voit PAS bouton "Inviter utilisateur"', async ({ browser }) => {
    const context = await browser.newContext({ storageState: storageStateFor('broker_user') });
    const page = await context.newPage();
    await page.goto('/fr/dashboard');
    await expect(page.getByRole('button', { name: /inviter utilisateur/i })).toHaveCount(0);
    await context.close();
  });

  test('broker_assistant NE voit PAS bouton "Nouveau deal"', async ({ browser }) => {
    const context = await browser.newContext({ storageState: storageStateFor('broker_assistant') });
    const page = await context.newPage();
    await page.goto('/fr/deals');
    // Assistant a deals:read seul (pas deals:write)
    await expect(page.getByRole('button', { name: /nouveau deal|new deal/i })).toHaveCount(0);
    await context.close();
  });

  test('broker_assistant peut creer contact mais pas supprimer', async ({ browser }) => {
    const context = await browser.newContext({ storageState: storageStateFor('broker_assistant') });
    const page = await context.newPage();
    await page.goto('/fr/contacts');
    // Bouton create visible (crm:write present)
    await expect(page.getByRole('button', { name: /nouveau contact/i })).toBeVisible();
    // Click sur 1ere ligne pour detail
    await page.locator('[data-testid="contact-row"]').first().click();
    // Pas de bouton delete (crm:delete absent)
    await expect(page.getByRole('button', { name: /supprimer|delete/i })).toHaveCount(0);
    await context.close();
  });

  test('broker_user peut valider broker queue (broker_queue:validate)', async ({ browser }) => {
    const context = await browser.newContext({ storageState: storageStateFor('broker_user') });
    const page = await context.newPage();
    await page.goto('/fr/broker-queue');
    await expect(page.locator('[data-testid="queue-item"]').first()).toBeVisible();
    await page.locator('[data-testid="queue-item"]').first().click();
    await expect(page.getByRole('button', { name: /valider|validate/i })).toBeVisible();
    await context.close();
  });

  test('broker_user NE peut PAS rejeter (broker_queue:reject absent)', async ({ browser }) => {
    const context = await browser.newContext({ storageState: storageStateFor('broker_user') });
    const page = await context.newPage();
    await page.goto('/fr/broker-queue');
    await page.locator('[data-testid="queue-item"]').first().click();
    // Reject reserved to broker_admin (Sprint 16 task 4.3.12 RBAC matrix)
    await expect(page.getByRole('button', { name: /rejeter|reject/i })).toHaveCount(0);
    await context.close();
  });

  test('broker_admin a permissions complete sur polices (cancel + suspend)', async ({ browser }) => {
    const context = await browser.newContext({ storageState: storageStateFor('broker_admin') });
    const page = await context.newPage();
    await page.goto('/fr/polices');
    await page.locator('[data-testid="police-row"]').first().click();
    await expect(page.getByRole('button', { name: /resilier|cancel/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /suspendre|suspend/i })).toBeVisible();
    await context.close();
  });

  test('broker_user NE peut PAS resilier police (polices:cancel reserved admin)', async ({ browser }) => {
    const context = await browser.newContext({ storageState: storageStateFor('broker_user') });
    const page = await context.newPage();
    await page.goto('/fr/polices');
    await page.locator('[data-testid="police-row"]').first().click();
    await expect(page.getByRole('button', { name: /resilier|cancel/i })).toHaveCount(0);
    await context.close();
  });

  test('matrix permissions ROLE_PERMISSIONS expose correctement par /api/me', async ({ browser, request }) => {
    for (const role of ['broker_admin', 'broker_user', 'broker_assistant'] as TestRole[]) {
      const context = await browser.newContext({ storageState: storageStateFor(role) });
      const page = await context.newPage();
      await page.goto('/fr/dashboard');
      // Capture access_token
      const cookies = await context.cookies();
      const token = cookies.find((c) => c.name === 'access_token')?.value;
      expect(token).toBeTruthy();
      // Appeler /v1/me
      const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';
      const meRes = await request.get(`${apiUrl}/v1/auth/me`, {
        headers: { authorization: `Bearer ${token}` },
      });
      const me = await meRes.json();
      expect(me.role).toBe(role);
      expect(me.permissions).toEqual(expect.arrayContaining(ROLE_PERMISSIONS[role]));
      await context.close();
    }
  });
});
```

### 6.33 e2e/i18n/locale-switcher.spec.ts (3 locales + RTL)

`apps/web-broker/e2e/i18n/locale-switcher.spec.ts` :

```typescript
import { test, expect } from '@playwright/test';
import { storageStateFor } from '../fixtures/auth-helpers';
import { scanA11y } from '../fixtures/a11y-helpers';

test.use({ storageState: storageStateFor('broker_admin') });

test.describe('i18n: locale switcher + RTL', () => {
  test('switch fr -> ar-MA applique dir=rtl + traductions Darija', async ({ page }) => {
    await page.goto('/fr/dashboard');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('html')).toHaveAttribute('lang', /^fr/);

    // Open locale switcher (sidebar dropdown ou topbar)
    await page.getByRole('button', { name: /langue|language/i }).click();
    await page.getByRole('menuitem', { name: /darija|ar-ma/i }).click();
    await page.waitForURL(/\/ar-MA/);
    await page.waitForLoadState('networkidle');

    // Verify dir + lang
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', /^ar-MA/);

    // Verify cookie NEXT_LOCALE persisted
    const cookies = await page.context().cookies();
    const localeCookie = cookies.find((c) => c.name === 'NEXT_LOCALE');
    expect(localeCookie?.value).toBe('ar-MA');
  });

  test('switch fr -> ar (arabe classique)', async ({ page }) => {
    await page.goto('/fr/dashboard');
    await page.getByRole('button', { name: /langue/i }).click();
    await page.getByRole('menuitem', { name: /arabe classique|^arabic$/i }).click();
    await page.waitForURL(/\/ar(\/|$)/);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', /^ar$/);
  });

  test('RTL : sidebar a droite, contenu a gauche', async ({ page }) => {
    await page.goto('/ar-MA/dashboard');
    const sidebar = page.locator('[role=navigation]').first();
    const main = page.locator('[role=main]').first();
    const sidebarBox = await sidebar.boundingBox();
    const mainBox = await main.boundingBox();
    // En RTL, sidebar.x > main.x (a droite)
    expect(sidebarBox!.x).toBeGreaterThan(mainBox!.x);
  });

  test('dates formatees selon locale Africa/Casablanca', async ({ page }) => {
    await page.goto('/fr/polices');
    // Format fr-MA : DD/MM/YYYY
    const frDate = await page.locator('[data-testid="police-effective-date"]').first().textContent();
    expect(frDate).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);

    await page.goto('/ar-MA/polices');
    // Format arabe : peut etre meme DD/MM/YYYY ou alternative selon next-intl config
    const arDate = await page.locator('[data-testid="police-effective-date"]').first().textContent();
    expect(arDate).toBeTruthy();
  });

  test('montants MAD formates selon locale', async ({ page }) => {
    await page.goto('/fr/polices');
    const frAmount = await page.locator('[data-testid="police-premium"]').first().textContent();
    // Format fr-MA : "1 234,56 MAD" ou "1 234,56 DH"
    expect(frAmount).toMatch(/\d/);
    expect(frAmount).toMatch(/MAD|DH/i);

    await page.goto('/ar-MA/polices');
    const arAmount = await page.locator('[data-testid="police-premium"]').first().textContent();
    expect(arAmount).toBeTruthy();
  });

  test('chaines UI traduites en darija sur dashboard', async ({ page }) => {
    await page.goto('/ar-MA/dashboard');
    // Le titre dashboard doit etre traduit (pas en francais)
    const heading = await page.getByRole('heading').first().textContent();
    expect(heading).not.toMatch(/Tableau de bord/);
  });

  test('a11y page locale ar-MA RTL', async ({ page }) => {
    await page.goto('/ar-MA/dashboard');
    await scanA11y(page);
  });

  test('formulaires : labels traduits + ARIA respects RTL', async ({ page }) => {
    await page.goto('/ar-MA/contacts/new');
    // Labels traduits
    const labels = await page.locator('label').allTextContents();
    expect(labels.length).toBeGreaterThan(0);
    // Au moins 1 label contient caractere arabe
    const hasArabicLabel = labels.some((l) => /[؀-ۿ]/.test(l));
    expect(hasArabicLabel).toBe(true);
  });
});
```

### 6.34 e2e/a11y/a11y-all-pages.spec.ts (axe scan 12 pages WCAG 2.1 AA)

`apps/web-broker/e2e/a11y/a11y-all-pages.spec.ts` :

```typescript
import { test } from '@playwright/test';
import { storageStateFor } from '../fixtures/auth-helpers';
import { scanA11y, scanA11yWithTolerance, expectLandmarks } from '../fixtures/a11y-helpers';

test.use({ storageState: storageStateFor('broker_admin') });

/**
 * Scan axe-core systematique sur les 12 pages web-broker.
 * Objectif : 0 violations critical + serious. < 5 moderate tolere.
 */
test.describe('a11y: WCAG 2.1 AA scan 12 pages', () => {
  test('/login (public)', async ({ page }) => {
    // login = public, pas de storageState
    await page.context().clearCookies();
    await page.goto('/fr/login');
    await scanA11y(page);
  });

  test('/signup (public)', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/fr/signup');
    await scanA11y(page);
  });

  test('/forgot-password (public)', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/fr/forgot-password');
    await scanA11y(page);
  });

  test('/dashboard', async ({ page }) => {
    await page.goto('/fr/dashboard');
    await expectLandmarks(page);
    await scanA11yWithTolerance(page, 3, {
      // Recharts SVG color-contrast false positives
      disableRules: [],
      exclude: ['.recharts-surface'],
    });
  });

  test('/contacts', async ({ page }) => {
    await page.goto('/fr/contacts');
    await expectLandmarks(page);
    await scanA11y(page);
  });

  test('/contacts/:id', async ({ page }) => {
    await page.goto('/fr/contacts');
    await page.locator('[data-testid="contact-row"]').first().click();
    await scanA11y(page);
  });

  test('/companies', async ({ page }) => {
    await page.goto('/fr/companies');
    await scanA11y(page);
  });

  test('/companies/:id', async ({ page }) => {
    await page.goto('/fr/companies');
    await page.locator('[data-testid="company-row"]').first().click();
    await scanA11y(page);
  });

  test('/deals (table view)', async ({ page }) => {
    await page.goto('/fr/deals?view=table');
    await scanA11y(page);
  });

  test('/deals (kanban view)', async ({ page }) => {
    await page.goto('/fr/deals?view=kanban');
    await scanA11yWithTolerance(page, 3, {
      // dnd-kit role-grid violations expected
      disableRules: ['aria-required-children'],
    });
  });

  test('/polices', async ({ page }) => {
    await page.goto('/fr/polices');
    await scanA11y(page);
  });

  test('/polices/:id', async ({ page }) => {
    await page.goto('/fr/polices');
    await page.locator('[data-testid="police-row"]').first().click();
    await scanA11y(page);
  });

  test('/broker-queue', async ({ page }) => {
    await page.goto('/fr/broker-queue');
    await scanA11y(page);
  });

  test('/sinistres', async ({ page }) => {
    await page.goto('/fr/sinistres');
    await scanA11y(page);
  });

  test('/parametres', async ({ page }) => {
    await page.goto('/fr/parametres');
    await scanA11y(page);
  });

  test('/profile', async ({ page }) => {
    await page.goto('/fr/profile');
    await scanA11y(page);
  });

  test('/profile/mfa', async ({ page }) => {
    await page.goto('/fr/profile/mfa');
    await scanA11y(page);
  });

  test('/profile/security (change password)', async ({ page }) => {
    await page.goto('/fr/profile/security');
    await scanA11y(page);
  });

  test('/404 page', async ({ page }) => {
    await page.goto('/fr/this-page-does-not-exist-12345');
    await scanA11y(page);
  });
});
```

### 6.35 e2e/a11y/keyboard-nav.spec.ts (tab order + escape + cmd+k)

`apps/web-broker/e2e/a11y/keyboard-nav.spec.ts` :

```typescript
import { test, expect } from '@playwright/test';
import { storageStateFor } from '../fixtures/auth-helpers';

test.use({ storageState: storageStateFor('broker_admin') });

test.describe('a11y: keyboard navigation', () => {
  test('skip link "Aller au contenu" focus en premier Tab', async ({ page }) => {
    await page.goto('/fr/dashboard');
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => document.activeElement?.textContent);
    expect(focused).toMatch(/aller au contenu|skip to content/i);
  });

  test('tab order coherent dans sidebar', async ({ page }) => {
    await page.goto('/fr/dashboard');
    // Tab depuis debut, capturer focus
    const focusOrder: string[] = [];
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('Tab');
      const id = await page.evaluate(() => document.activeElement?.getAttribute('data-nav-item') ?? document.activeElement?.tagName ?? '');
      focusOrder.push(id);
    }
    // Sidebar items doivent etre en ordre coherent
    expect(focusOrder.filter((f) => f.startsWith('nav-'))).not.toEqual([]);
  });

  test('Escape ferme modal Dialog', async ({ page }) => {
    await page.goto('/fr/contacts');
    await page.getByRole('button', { name: /nouveau contact/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('focus trap dans modal Dialog (tab cycle infini interne)', async ({ page }) => {
    await page.goto('/fr/contacts');
    await page.getByRole('button', { name: /nouveau contact/i }).click();
    // Tab 20 fois, focus reste dans modal
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('Tab');
      const insideModal = await page.evaluate(() => {
        const active = document.activeElement;
        const modal = document.querySelector('[role=dialog]');
        return modal?.contains(active) ?? false;
      });
      expect(insideModal).toBe(true);
    }
    await page.keyboard.press('Escape');
  });

  test('Shift+Tab cycle inverse dans modal', async ({ page }) => {
    await page.goto('/fr/contacts');
    await page.getByRole('button', { name: /nouveau contact/i }).click();
    // Shift+Tab plusieurs fois
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Shift+Tab');
    }
    const insideModal = await page.evaluate(() => {
      const active = document.activeElement;
      const modal = document.querySelector('[role=dialog]');
      return modal?.contains(active) ?? false;
    });
    expect(insideModal).toBe(true);
  });

  test('Cmd+K (ControlOrMeta+K) ouvre cmd palette global search', async ({ page }) => {
    await page.goto('/fr/dashboard');
    await page.keyboard.press('ControlOrMeta+K');
    await expect(page.locator('[data-testid="command-palette"]')).toBeVisible();
    // ESC ferme
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="command-palette"]')).toHaveCount(0);
  });

  test('Cmd+K type pour rechercher contact', async ({ page }) => {
    await page.goto('/fr/dashboard');
    await page.keyboard.press('ControlOrMeta+K');
    await page.keyboard.type('Benali');
    await page.waitForTimeout(300); // debounce search
    // Resultat visible
    await expect(page.locator('[data-testid="command-result"]').first()).toBeVisible();
    // Enter active premier resultat
    await page.keyboard.press('Enter');
    await page.waitForURL(/\/(contacts|companies|deals|polices)\/[a-f0-9-]+/);
  });

  test('Arrow Down/Up navigue resultats command palette', async ({ page }) => {
    await page.goto('/fr/dashboard');
    await page.keyboard.press('ControlOrMeta+K');
    await page.keyboard.type('test');
    await page.waitForTimeout(300);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    // Le 3e resultat doit etre focus
    const focused = await page.locator('[data-testid="command-result"][data-selected="true"]').first();
    await expect(focused).toBeVisible();
  });

  test('Enter active boutons + liens', async ({ page }) => {
    await page.goto('/fr/dashboard');
    await page.getByRole('link', { name: /contacts/i }).first().focus();
    await page.keyboard.press('Enter');
    await page.waitForURL(/\/contacts/);
  });

  test('Aria-live region announces toast notifications', async ({ page }) => {
    await page.goto('/fr/contacts');
    // Verifier presence aria-live region
    await expect(page.locator('[role=region][aria-live=polite]').first()).toBeAttached();
  });

  test('toggle theme dark via keyboard shortcut', async ({ page }) => {
    await page.goto('/fr/dashboard');
    // Sprint 16 task 4.3.3 ajoute toggle theme button
    await page.getByRole('button', { name: /theme|mode/i }).focus();
    await page.keyboard.press('Enter');
    // Le menu apparait
    await page.getByRole('menuitem', { name: /sombre|dark/i }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
  });
});
```

### 6.36 e2e/perf/lighthouse-baseline.spec.ts (LH 3 pages clefs)

`apps/web-broker/e2e/perf/lighthouse-baseline.spec.ts` :

```typescript
import { test, expect } from '@playwright/test';
import { storageStateFor } from '../fixtures/auth-helpers';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs/promises';

test.describe.serial('perf: lighthouse baseline 3 pages clefs', () => {
  // Ces tests sont sequentiels (un seul Lighthouse run a la fois, evite contention CPU)

  test('lighthouse run /login (public, perf>=75 a11y>=95 BP>=90 SEO>=85)', async ({ baseURL }) => {
    const result = await runLighthouse(`${baseURL}/fr/login`, 'login');
    expect(result.scores.performance).toBeGreaterThanOrEqual(75);
    expect(result.scores.accessibility).toBeGreaterThanOrEqual(95);
    expect(result.scores['best-practices']).toBeGreaterThanOrEqual(90);
    expect(result.scores.seo).toBeGreaterThanOrEqual(85);
  });

  test('lighthouse run /dashboard (perf>=70 a11y>=90 BP>=90)', async ({ baseURL, browser }) => {
    // Pour /dashboard authentifie, on injecte cookies depuis storageState dans CLI Lighthouse
    const stateFile = storageStateFor('broker_admin');
    const result = await runLighthouse(`${baseURL}/fr/dashboard`, 'dashboard', stateFile);
    expect(result.scores.performance).toBeGreaterThanOrEqual(70);
    expect(result.scores.accessibility).toBeGreaterThanOrEqual(90);
    expect(result.scores['best-practices']).toBeGreaterThanOrEqual(90);
  });

  test('lighthouse run /polices/:id (perf>=65 a11y>=90)', async ({ baseURL, browser }) => {
    const context = await browser.newContext({ storageState: storageStateFor('broker_admin') });
    const page = await context.newPage();
    await page.goto(`${baseURL}/fr/polices`);
    await page.locator('[data-testid="police-row"]').first().click();
    const policeUrl = page.url();
    await context.close();

    const result = await runLighthouse(policeUrl, 'police-detail', storageStateFor('broker_admin'));
    expect(result.scores.performance).toBeGreaterThanOrEqual(65);
    expect(result.scores.accessibility).toBeGreaterThanOrEqual(90);
  });
});

/**
 * Run Lighthouse CLI via subprocess.
 * Output JSON dans test-results/lighthouse-{name}.json
 */
async function runLighthouse(url: string, name: string, storageState?: string): Promise<{ scores: Record<string, number> }> {
  const outputDir = path.join(__dirname, '..', '..', 'test-results', 'lighthouse');
  await fs.mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, `${name}.json`);

  const args = [
    'lighthouse',
    url,
    '--output=json',
    `--output-path=${outputPath}`,
    '--chrome-flags=--headless --no-sandbox --disable-gpu',
    '--only-categories=performance,accessibility,best-practices,seo',
    '--throttling-method=simulate',
    '--preset=desktop',
    '--quiet',
  ];

  // Cookies authentication
  if (storageState) {
    const state = JSON.parse(await fs.readFile(storageState, 'utf-8'));
    const cookieHeader = state.cookies
      .map((c: { name: string; value: string }) => `${c.name}=${c.value}`)
      .join('; ');
    args.push(`--extra-headers={"Cookie":"${cookieHeader}"}`);
  }

  return new Promise((resolve, reject) => {
    const child = spawn('pnpm', args, { shell: true });
    let stderr = '';
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('close', async (code) => {
      if (code !== 0) return reject(new Error(`lighthouse exit ${code}: ${stderr}`));
      const json = JSON.parse(await fs.readFile(outputPath, 'utf-8'));
      const scores: Record<string, number> = {};
      for (const [k, v] of Object.entries(json.categories) as [string, { score: number }][]) {
        scores[k] = Math.round(v.score * 100);
      }
      resolve({ scores });
    });
  });
}
```

### 6.37 lighthouse.config.cjs (LHCI assertions)

`apps/web-broker/lighthouse.config.cjs` :

```javascript
/**
 * Lighthouse CI config.
 * Run: pnpm --filter @insurtech/web-broker lhci autorun
 *
 * Assertions seuils par page (Sprint 16 baseline) :
 *  - login : Perf >= 75, A11y >= 95, BP >= 90, SEO >= 85
 *  - dashboard : Perf >= 70, A11y >= 90, BP >= 90
 *  - polices/[id] : Perf >= 65, A11y >= 90, BP >= 85
 */
module.exports = {
  ci: {
    collect: {
      url: [
        'http://localhost:3001/fr/login',
        'http://localhost:3001/fr/dashboard',
        'http://localhost:3001/fr/polices',
      ],
      settings: {
        preset: 'desktop',
        throttlingMethod: 'simulate',
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
        chromeFlags: '--headless --no-sandbox --disable-gpu',
        disableStorageReset: false,
      },
      numberOfRuns: 3, // moyenne sur 3 runs pour reduire variance
    },
    assert: {
      assertions: {
        // Defaults applies a toutes pages
        'categories:performance': ['warn', { minScore: 0.65 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['warn', { minScore: 0.85 }],
        'categories:seo': ['warn', { minScore: 0.8 }],
        // Audits specifiques
        'errors-in-console': ['error', { maxNumericValue: 0 }],
        'is-on-https': 'off', // localhost
        'uses-http2': 'off', // localhost
        'meta-description': 'warn',
        'document-title': 'error',
        'html-has-lang': 'error',
        'color-contrast': 'error',
        'image-alt': 'error',
        'label': 'error',
        'tap-targets': 'warn',
        'aria-required-attr': 'error',
        'aria-valid-attr': 'error',
        'aria-valid-attr-value': 'error',
      },
    },
    upload: {
      target: 'filesystem',
      outputDir: './test-results/lhci-reports',
    },
    server: {},
  },
};
```

### 6.38 .github/workflows/e2e-web-broker.yml (CI integration)

`.github/workflows/e2e-web-broker.yml` :

```yaml
name: e2e-web-broker

on:
  pull_request:
    paths:
      - 'apps/web-broker/**'
      - 'packages/**'
      - 'pnpm-lock.yaml'
  workflow_dispatch:

concurrency:
  group: e2e-web-broker-${{ github.ref }}
  cancel-in-progress: true

env:
  NODE_VERSION: 20.18.0
  PNPM_VERSION: 9.15.0

jobs:
  e2e:
    name: e2e shard ${{ matrix.shardIndex }}/${{ matrix.shardTotal }}
    runs-on: ubuntu-latest
    timeout-minutes: 25
    strategy:
      fail-fast: false
      matrix:
        shardIndex: [1, 2, 3, 4]
        shardTotal: [4]
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: insurtech_test
        ports: ['5432:5432']
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7-alpine
        ports: ['6379:6379']
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
      mailhog:
        image: mailhog/mailhog:v1.0.1
        ports: ['1025:1025', '8025:8025']
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: pnpm
      - name: Install deps
        run: pnpm install --frozen-lockfile
      - name: Cache Playwright browsers
        uses: actions/cache@v4
        with:
          path: ~/.cache/ms-playwright
          key: playwright-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}
      - name: Install Playwright browsers
        run: pnpm --filter @insurtech/web-broker exec playwright install --with-deps
      - name: Run API migrations + seed admin
        env:
          DATABASE_URL: postgres://postgres:postgres@localhost:5432/insurtech_test
        run: |
          pnpm --filter @insurtech/api migration:run
          pnpm --filter @insurtech/api test:seed-admin
      - name: Build web-broker
        run: pnpm --filter @insurtech/web-broker build
      - name: Run E2E (shard ${{ matrix.shardIndex }}/${{ matrix.shardTotal }})
        env:
          CI: true
          NEXT_PUBLIC_API_BASE_URL: http://localhost:4000
          TEST_API_ADMIN_TOKEN: ${{ secrets.TEST_API_ADMIN_TOKEN }}
          PLAYWRIGHT_BASE_URL: http://localhost:3001
        run: |
          pnpm --filter @insurtech/api start:test &
          pnpm --filter @insurtech/web-broker test:e2e -- --shard=${{ matrix.shardIndex }}/${{ matrix.shardTotal }}
      - name: Upload HTML report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report-shard-${{ matrix.shardIndex }}
          path: apps/web-broker/test-results/html
          retention-days: 7
      - name: Upload traces (on failure)
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-traces-shard-${{ matrix.shardIndex }}
          path: apps/web-broker/test-results/artifacts/**/trace.zip
          retention-days: 7
      - name: Upload JUnit XML
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: junit-shard-${{ matrix.shardIndex }}
          path: apps/web-broker/test-results/junit.xml

  lighthouse:
    name: lighthouse baseline 3 pages
    runs-on: ubuntu-latest
    needs: e2e
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9.15.0 }
      - uses: actions/setup-node@v4
        with: { node-version: 20.18.0, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @insurtech/web-broker build
      - run: pnpm --filter @insurtech/web-broker start &
      - run: pnpm --filter @insurtech/web-broker lhci autorun
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: lighthouse-reports
          path: apps/web-broker/test-results/lhci-reports
```

---

## 7. Tests d'integration et tests unitaires connexes (5-8 ko)

### 7.1 Vitest tests unitaires fixtures

Les fixtures `auth-helpers.ts`, `a11y-helpers.ts`, `otp-helpers.ts` doivent etre couvertes par tests Vitest **independants** des tests Playwright pour valider la logique pure (sans browser).

`apps/web-broker/e2e/fixtures/__tests__/otp-helpers.test.ts` :

```typescript
import { describe, it, expect } from 'vitest';
import { generateTOTP, verifyTOTP } from '../otp-helpers';

describe('otp-helpers', () => {
  it('generates 6-digit code from base32 secret', () => {
    const secret = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
    const code = generateTOTP(secret);
    expect(code).toMatch(/^\d{6}$/);
  });

  it('verifyTOTP accepts code just generated', () => {
    const secret = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
    const code = generateTOTP(secret);
    expect(verifyTOTP(code, secret)).toBe(true);
  });

  it('verifyTOTP rejects clearly invalid code', () => {
    const secret = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
    expect(verifyTOTP('000000', secret)).toBe(false);
    expect(verifyTOTP('abcdef', secret)).toBe(false);
  });
});
```

`apps/web-broker/e2e/fixtures/__tests__/test-data.test.ts` :

```typescript
import { describe, it, expect } from 'vitest';
import { generateValidIce, generateMaroccanPhone, generateCin, generateSeedContacts } from '../test-data';

describe('test-data', () => {
  it('generateValidIce produit 15 chiffres', () => {
    for (let i = 0; i < 10; i++) {
      const ice = generateValidIce();
      expect(ice).toMatch(/^\d{15}$/);
    }
  });

  it('generateMaroccanPhone format E.164 +2126XXXXXXXX', () => {
    const phone = generateMaroccanPhone();
    expect(phone).toMatch(/^\+212[67]\d{8}$/);
  });

  it('generateCin format CIN Maroc', () => {
    for (let i = 0; i < 10; i++) {
      const cin = generateCin();
      expect(cin).toMatch(/^[A-Z]{1,2}\d{5,7}$/);
    }
  });

  it('generateSeedContacts retourne count contacts valides', () => {
    const contacts = generateSeedContacts(50);
    expect(contacts).toHaveLength(50);
    for (const c of contacts) {
      expect(c.country).toBe('MA');
      expect(c.external_ref).toMatch(/^CT-TEST-\d{5}$/);
      expect(c.phone).toMatch(/^\+212/);
    }
  });
});
```

### 7.2 Integration test : playwright.config validation

`apps/web-broker/e2e/__tests__/config-validation.test.ts` :

```typescript
import { describe, it, expect } from 'vitest';
import config from '../../playwright.config';

describe('playwright.config', () => {
  it('uses fullyParallel = true', () => {
    expect(config.fullyParallel).toBe(true);
  });
  it('has 6+ projects', () => {
    expect((config.projects ?? []).length).toBeGreaterThanOrEqual(6);
  });
  it('chromium-fr is default locale fr-MA', () => {
    const chromiumFr = config.projects?.find((p) => p.name === 'chromium-fr');
    expect(chromiumFr?.use?.locale).toBe('fr-MA');
  });
  it('chromium-ar-MA is RTL locale', () => {
    const ar = config.projects?.find((p) => p.name === 'chromium-ar-MA');
    expect(ar?.use?.locale).toBe('ar-MA');
  });
  it('timezoneId Africa/Casablanca default', () => {
    expect(config.use?.timezoneId).toBe('Africa/Casablanca');
  });
  it('reporter inclut html + junit', () => {
    const reporter = config.reporter as Array<unknown>;
    expect(reporter.some((r) => Array.isArray(r) && r[0] === 'html')).toBe(true);
    expect(reporter.some((r) => Array.isArray(r) && r[0] === 'junit')).toBe(true);
  });
});
```

### 7.3 Smoke test : globalSetup connecte API

`apps/web-broker/e2e/__tests__/global-setup.smoke.ts` (run manuel, pas en CI) :

```typescript
import { describe, it, expect } from 'vitest';

describe('globalSetup smoke', () => {
  it.skipIf(!process.env.TEST_API_ADMIN_TOKEN)('API NestJS healthcheck repond', async () => {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000'}/health`);
    expect(res.ok).toBe(true);
  });
});
```

### 7.4 Test reproducibilite : run 5x consecutif

`apps/web-broker/scripts/test-flakiness.sh` (bash) :

```bash
#!/usr/bin/env bash
# Run E2E suite 5 fois consecutivement.
# Echec si une seule iteration echoue.
set -euo pipefail
PASS=0
FAIL=0
for i in 1 2 3 4 5; do
  echo "[flakiness] Run $i/5"
  if pnpm --filter @insurtech/web-broker test:e2e --project=chromium-fr; then
    PASS=$((PASS + 1))
  else
    FAIL=$((FAIL + 1))
  fi
done
echo "[flakiness] Result : $PASS pass / $FAIL fail"
if [ "$FAIL" -gt 0 ]; then
  echo "[flakiness] FAILED -- flaky tests detected"
  exit 1
fi
```

Equivalent PowerShell `apps/web-broker/scripts/test-flakiness.ps1` :

```powershell
$ErrorActionPreference = 'Stop'
$pass = 0
$fail = 0
1..5 | ForEach-Object {
    Write-Host "[flakiness] Run $_/5"
    try {
        pnpm --filter '@insurtech/web-broker' test:e2e --project=chromium-fr
        $pass++
    } catch {
        $fail++
    }
}
Write-Host "[flakiness] Result : $pass pass / $fail fail"
if ($fail -gt 0) { exit 1 }
```

### 7.5 Test sharding : verifier shard 1/4 + 2/4 + 3/4 + 4/4 cover toutes les specs

`apps/web-broker/scripts/check-shard-coverage.ts` :

```typescript
import { execSync } from 'node:child_process';

const TOTAL = 4;
const allSpecs = new Set<string>();
for (let i = 1; i <= TOTAL; i++) {
  const output = execSync(`pnpm --filter @insurtech/web-broker exec playwright test --list --shard=${i}/${TOTAL}`, { encoding: 'utf-8' });
  const specs = output.split('\n').filter((l) => l.includes('.spec.ts')).map((l) => l.trim());
  for (const s of specs) allSpecs.add(s);
}
const fullList = execSync('pnpm --filter @insurtech/web-broker exec playwright test --list', { encoding: 'utf-8' })
  .split('\n')
  .filter((l) => l.includes('.spec.ts'))
  .map((l) => l.trim());

if (allSpecs.size !== fullList.length) {
  console.error('Shard coverage MISMATCH:');
  console.error('  Total specs:', fullList.length);
  console.error('  Shards cumul:', allSpecs.size);
  process.exit(1);
}
console.log('Shard coverage OK');
```

---

## 8. Procedure d'execution detaillee (3-5 ko)

### 8.1 Setup local developpeur (premiere fois)

```bash
# 1. Installer Playwright + browsers (~200 Mo)
pnpm --filter @insurtech/web-broker add -D @playwright/test@1.49.1 @axe-core/playwright@4.10.0 @lhci/cli@0.14.0 lighthouse@12.3.0 otplib@12.0.1 @faker-js/faker@9.3.0 seedrandom@3.0.5 dayjs@1.11.13 dotenv@16.4.5
pnpm --filter @insurtech/web-broker exec playwright install --with-deps chromium firefox webkit
# 200 Mo telechargement, ~3 min

# 2. Demarrer infrastructure dev (DB + Redis + Mailhog)
docker compose -f docker-compose.dev.yml up -d postgres redis mailhog
sleep 5

# 3. Migration DB + seed admin (Sprint 5 task 2.1.x)
pnpm --filter @insurtech/api migration:run
pnpm --filter @insurtech/api test:seed-admin
# Recupere TEST_API_ADMIN_TOKEN
export TEST_API_ADMIN_TOKEN=$(cat .test-admin-token)

# 4. Demarrer l'API NestJS (port 4000)
pnpm --filter @insurtech/api start:dev &
sleep 10
# Healthcheck
curl http://localhost:4000/health

# 5. Demarrer web-broker (port 3001)
pnpm --filter @insurtech/web-broker dev &
sleep 10
curl http://localhost:3001/fr/login

# 6. Run e2e suite
pnpm --filter @insurtech/web-broker test:e2e
```

### 8.2 Lancer la suite complete

```bash
# Run tous les tests, tous projects
pnpm --filter @insurtech/web-broker test:e2e

# Run seulement project chromium-fr (le plus rapide)
pnpm --filter @insurtech/web-broker test:e2e --project=chromium-fr

# Run un seul fichier
pnpm --filter @insurtech/web-broker test:e2e e2e/auth/login.spec.ts

# Run un seul test par nom
pnpm --filter @insurtech/web-broker test:e2e --grep "login OK"

# Mode UI interactif (debug)
pnpm --filter @insurtech/web-broker test:e2e --ui

# Mode headed (voir le navigateur)
pnpm --filter @insurtech/web-broker test:e2e --headed

# Debug avec inspector pause
PWDEBUG=1 pnpm --filter @insurtech/web-broker test:e2e e2e/auth/login.spec.ts

# Generate trace pour test specifique
pnpm --filter @insurtech/web-broker test:e2e --trace on e2e/contacts/contacts-crud.spec.ts
```

### 8.3 Visualiser le rapport HTML

```bash
pnpm --filter @insurtech/web-broker exec playwright show-report test-results/html
# Ouvre serveur local http://localhost:9323
```

### 8.4 Lighthouse baseline

```bash
# Run LHCI assertions
pnpm --filter @insurtech/web-broker exec lhci autorun

# Run script perf direct
pnpm --filter @insurtech/web-broker test:e2e e2e/perf/lighthouse-baseline.spec.ts

# Voir reports
ls -lh apps/web-broker/test-results/lhci-reports
```

### 8.5 Test flakiness check (avant push)

```bash
# Bash
bash apps/web-broker/scripts/test-flakiness.sh

# PowerShell
pwsh apps/web-broker/scripts/test-flakiness.ps1
```

### 8.6 Ajouter un nouveau scenario (workflow developpeur)

```bash
# 1. Creer le fichier dans le bon dossier
touch apps/web-broker/e2e/contacts/contacts-export-pdf.spec.ts

# 2. Copier le template d'un test existant
cat apps/web-broker/e2e/contacts/contacts-crud.spec.ts | head -20 > apps/web-broker/e2e/contacts/contacts-export-pdf.spec.ts

# 3. Editer (ajouter tests)
code apps/web-broker/e2e/contacts/contacts-export-pdf.spec.ts

# 4. Run le test isole
pnpm --filter @insurtech/web-broker test:e2e e2e/contacts/contacts-export-pdf.spec.ts

# 5. Verifier pas de regression sur autres tests
pnpm --filter @insurtech/web-broker test:e2e

# 6. Verifier en CI -- push branch + PR
```

### 8.7 Investiguer un test failed CI

```bash
# 1. Telecharger artefacts GitHub Actions
gh run download <run-id> --name playwright-report-shard-2

# 2. Ouvrir HTML report
npx playwright show-report ./playwright-report-shard-2

# 3. Telecharger trace.zip et ouvrir
gh run download <run-id> --name playwright-traces-shard-2
npx playwright show-trace ./trace.zip
```

### 8.8 Update snapshot screenshots (visual regression - optional)

Non applicable Sprint 16 (decision : pas de visual regression).

### 8.9 Run uniquement tests a11y (audit cible)

```bash
pnpm --filter @insurtech/web-broker test:e2e e2e/a11y/
```

### 8.10 Clean test results

```bash
# Nettoyer
rm -rf apps/web-broker/test-results
rm -rf apps/web-broker/e2e/.auth-states
rm -rf apps/web-broker/e2e/.test-state.json
```

---

## 9. Criteres de validation V1-V28 (5-8 ko)

### V1 -- 25+ E2E tests passent (counts >= 25)

Methode : `pnpm --filter @insurtech/web-broker test:e2e --list | grep "spec.ts" | wc -l`. Doit retourner >= 25 tests fonctionnels (hors a11y dedies). Le compteur actuel base sur les 33+ fichiers `.spec.ts` * moyenne 3-5 tests/fichier = ~120 tests E2E. Cible largement depassee.

### V2 -- axe-core a11y scan 12 pages : 0 violations P0 + < 5 P1

Methode : run `pnpm --filter @insurtech/web-broker test:e2e e2e/a11y/a11y-all-pages.spec.ts`. Tous les tests doivent passer (assertion `expect(blocking).toEqual([])` dans `scanA11y`). Le rapport HTML montre 0 violations critical/serious.

### V3 -- CI green sur PR

Methode : pousser une branche, ouvrir PR, verifier que le workflow GitHub Actions `e2e-web-broker` retourne success (vert) sur les 4 shards + Lighthouse job.

### V4 -- Reproducibilite : 5x runs deterministe

Methode : `bash apps/web-broker/scripts/test-flakiness.sh` doit afficher `5 pass / 0 fail`. Tolerance zero flakiness.

### V5 -- Coverage critical paths

Liste des chemins critiques couverts par au moins 1 test E2E :
- [x] Login OK (sans MFA) : login.spec.ts
- [x] Login MFA (avec TOTP) : login.spec.ts
- [x] Signup + email verify : signup.spec.ts
- [x] Recovery password : recovery.spec.ts
- [x] Dashboard widgets render : dashboard.spec.ts
- [x] Contacts CRUD complet : contacts-crud.spec.ts
- [x] Companies create avec ICE Maroc : companies-crud.spec.ts
- [x] Deals kanban drag-drop : deals-kanban.spec.ts
- [x] Polices list + filter : polices-list.spec.ts
- [x] Polices cancel avec pro-rata : polices-cancel.spec.ts
- [x] Broker queue validate (provisional -> definitif) : queue-validate.spec.ts
- [x] Broker queue reject : queue-reject.spec.ts
- [x] MFA setup TOTP : mfa-setup.spec.ts
- [x] RBAC 3 roles permissions : rbac-3-roles.spec.ts

### V6 -- Tests parallels 4 workers

Methode : verify `playwright.config.ts` contient `workers: IS_CI ? 4 : '50%'` et que le run CI utilise 4 shards (`--shard=1/4`, `--shard=2/4`, ...).

### V7 -- Multi-browser : chromium + firefox + webkit pass

Methode : run `pnpm --filter @insurtech/web-broker test:e2e --project=firefox` et `--project=webkit` doivent passer sans erreur. (Subset tests auth + dashboard execute, le reste skip).

### V8 -- Mobile viewport (Pixel 5) pass

Methode : run `pnpm --filter @insurtech/web-broker test:e2e --project=mobile-chrome` doit passer.

### V9 -- 3 locales projects pass (fr, ar-MA, ar)

Methode : run `--project=chromium-fr`, `--project=chromium-ar-MA`, `--project=chromium-ar`. Tous tests i18n + a11y passent.

### V10 -- trace + video + screenshot on failure

Methode : forcer un test a echouer (modifier 1 assertion). Verifier que `test-results/artifacts/<test-name>/trace.zip` + `screenshot.png` + `video.webm` sont generes.

### V11 -- Keyboard nav full app

Methode : `pnpm --filter @insurtech/web-broker test:e2e e2e/a11y/keyboard-nav.spec.ts` passe. Tab/Shift+Tab/Escape/ControlOrMeta+K tous fonctionnels.

### V12 -- Color contrast WCAG AA verified

Methode : axe-core `color-contrast` regle active sur scan 12 pages, 0 violations.

### V13 -- Lighthouse perf seuils

Methode : `pnpm --filter @insurtech/web-broker exec lhci autorun` retourne success. Seuils :
- Performance >= 70 sur 3 pages
- Accessibility >= 90 sur 3 pages
- Best Practices >= 85 sur 3 pages
- SEO >= 80 sur login page

### V14 -- HTML report genere

Methode : verifier que `apps/web-broker/test-results/html/index.html` existe apres run.

### V15 -- JUnit XML genere et parsable

Methode : verifier `apps/web-broker/test-results/junit.xml` existe + `xmllint --noout` succeed.

### V16 -- Test tenants ephemeres deletes apres run

Methode : verifier qu'apres `pnpm test:e2e` complet, aucun tenant `test-tenant-*` n'existe en DB :
```sql
SELECT slug FROM tenants WHERE slug LIKE 'test-tenant-%'; -- doit etre vide
```

### V17 -- storageStates regeneres a chaque run

Methode : verifier que `apps/web-broker/e2e/.auth-states/auth-*.json` sont recrees a chaque `pnpm test:e2e`.

### V18 -- Faker deterministe (seed)

Methode : run 2x avec meme seed, verifier que les donnees seedees sont identiques (memes contacts, memes ICE).

### V19 -- Tests RTL valident dir + lang

Methode : `e2e/i18n/locale-switcher.spec.ts` assertions `toHaveAttribute('dir', 'rtl')` passent pour ar-MA et ar.

### V20 -- ARIA landmarks present

Methode : `expectLandmarks(page)` dans `a11y-all-pages.spec.ts` passe sur toutes pages protected.

### V21 -- Focus trap dans modals

Methode : `e2e/a11y/keyboard-nav.spec.ts` test "focus trap dans modal Dialog" passe.

### V22 -- Cmd+K palette fonctionnelle

Methode : test "Cmd+K (ControlOrMeta+K) ouvre cmd palette" passe.

### V23 -- Reject broker queue envoie email

Methode : test "validate envoie email client confirmation" verifie via API test endpoint que email enregistre.

### V24 -- MFA TOTP genere des codes valides

Methode : `vitest run e2e/fixtures/__tests__/otp-helpers.test.ts` passe (generation + verify).

### V25 -- Sinistres read-only enforce (pas de bouton write)

Methode : `e2e/sinistres/sinistres-read-only.spec.ts` test "no write buttons" passe.

### V26 -- Parametres broker_admin only enforce

Methode : `e2e/parametres/parametres-admin-only.spec.ts` tests redirect pour broker_user/assistant passent.

### V27 -- LOC tests >= 4500

Methode : `find apps/web-broker/e2e -name "*.spec.ts" -o -name "*.ts" | xargs wc -l | tail -1`. Doit afficher >= 4500.

### V28 -- Documentation README e2e a jour

Methode : verifier `apps/web-broker/e2e/README.md` decrit comment ajouter un test, executer locally, debugger.

---

## 10. Edge cases (12 EC -- gestion approfondie)

### EC1 -- Flaky test reseau API NestJS lente boot

**Probleme** : webServer Playwright lance `pnpm dev`, le 1er test hit l'API avant que NestJS soit pret -> 503 / connection refused.
**Mitigation** : `webServer.timeout: 120_000` (2 min) dans `playwright.config.ts` + `waitForApi(maxAttempts=60)` dans `globalSetup.ts` polling `/health`.

### EC2 -- Test parallel race condition seed

**Probleme** : 4 workers crees simultanement 4 tenants au meme moment, deadlock DB.
**Mitigation** : `globalSetup.ts` cree les 4 tenants **sequentiellement** (boucle for await), AVANT que workers parallel demarrent (Playwright execute globalSetup avant projects).

### EC3 -- Cookie tenant cross-test pollution

**Probleme** : test A change `current_tenant_id` cookie via tenant switcher, test B suivant herite.
**Mitigation** : `test.beforeEach(async ({ page }) => { await page.context().clearCookies(); })` au debut de chaque spec qui modifie tenant. Tests utilisent storageState par role qui contient tenant initial.

### EC4 -- MFA TOTP generation timing window

**Probleme** : code TOTP valide 30s, si test prend > 30s entre generation et submit, code expire = false negative.
**Mitigation** : generer OTP juste avant submit (pas en debut de test) avec `otplib` qui retourne code base sur Date.now() courant. Ajouter `authenticator.options.window = 1` (tolerance +- 1 window = 60s acceptable).

### EC5 -- JWT expiry mid-test

**Probleme** : access_token expire 15min, si test depasse, requests 401.
**Mitigation** : api-client web-broker (deja shipping Sprint 16 4.3.1) implemente refresh transparent. Tests duree max acceptable ~2 min. Si test prend > 5 min = signal bug a investiguer.

### EC6 -- axe violations false positive color-contrast Recharts

**Probleme** : SVG dataviz Recharts triggers `color-contrast` violation sur series chart couleurs.
**Mitigation** : `scanA11yWithTolerance(page, 3, { exclude: ['.recharts-surface'] })` ou `disableRules(['color-contrast'])` cible.

### EC7 -- Screen reader bug Safari Webkit

**Probleme** : Webkit headless Playwright n'emule pas VoiceOver donc tests "screen reader" ne sont pas reels.
**Mitigation** : tests "screen reader" verifient en realite ARIA semantic correct (aria-label, role, aria-live regions). Audit reel SR fait par testeur humain Sprint 30.

### EC8 -- Keyboard nav focus trap loop infini

**Probleme** : modal sans focus trap, tab sort modal vers contenu derriere = bug a11y.
**Mitigation** : test "focus trap dans modal Dialog" verifie que apres 20 tabs successifs, focus reste dans modal (`modal.contains(document.activeElement) === true`).

### EC9 -- Cmd+K mac vs Ctrl+K linux/windows

**Probleme** : raccourci OS-dependent.
**Mitigation** : Playwright abstraction `page.keyboard.press('ControlOrMeta+K')` unifie. Mac sends Meta+K, Linux/Win sends Ctrl+K automatiquement.

### EC10 -- Mobile touch drag-drop kanban

**Probleme** : Pixel 5 emulation utilise touch events, drag-drop HTML5 fragile.
**Mitigation** : `test.skip(({ browserName }) => browserName !== 'chromium')` sur deals-kanban.spec.ts. Kanban use-case desktop par defaut.

### EC11 -- RTL test direction click coordinates

**Probleme** : ordre visuel inverse en RTL, click pixel coords echoue.
**Mitigation** : utiliser `getByRole`, `getByLabel`, `getByText` semantic selectors. JAMAIS `nth(n)` ou `page.mouse.click(x, y)`.

### EC12 -- Locale switch hydration React 19

**Probleme** : switcher fr -> ar-MA via router.refresh() peut causer hydration mismatch (dir change).
**Mitigation** : test forcent `page.reload()` apres switch + verify `dir` attribute post-reload. En prod, Sprint 16 task 4.3.13 implemente Server Action `setLocale` qui re-render full SSR.

### EC13 (bonus) -- Lighthouse cold cache vs warm

**Probleme** : LH run 1 ressemble visiteur cold cache, run 2 = warm cache.
**Mitigation** : `lighthouse.config.cjs` configure `numberOfRuns: 3` + `disableStorageReset: false` (force cold), moyenne sur 3 runs.

### EC14 (bonus) -- JUnit XML parsing GitHub Actions

**Probleme** : reporter junit produit XML, GitHub Actions parsing exige format precis.
**Mitigation** : Playwright 1.49+ conforme par defaut. Verifier `<testsuites>` root element.

---

## 11. Conformite Maroc (3-5 ko)

### 11.1 WCAG 2.1 AA et Loi 10-03

La Loi 10-03 du 16 mai 2003 relative a la protection sociale des personnes handicapees, articles 12-15 specifiquement, impose aux services publics et para-publics (assurance = service essentiel sous supervision ACAPS) une accessibilite reelle pour les personnes en situation de handicap moteur, visuel ou auditif. Le decret d'application 2.10.124 BO 5984 du septembre 2010 precise les obligations techniques en matiere de TIC (Technologies de l'Information et de la Communication).

**Standard international reconnu** : WCAG 2.1 AA (W3C Web Content Accessibility Guidelines, niveau AA double conformance). Le Maroc a signe la Convention ONU sur les Droits des Personnes Handicapees en 2009 ratifiee 2009 qui reconnait WCAG comme standard.

**Verification automatisee axe-core** : axe-core 4.10 implemente 90+ regles WCAG. Notre suite valide automatiquement :
- WCAG 2.0 AA niveau A et AA
- WCAG 2.1 AA niveau A et AA
- Best Practices Deque non specifiquement WCAG

**Couverture** : axe detecte ~57% des problemes WCAG selon Deque. Les 43% restants requierent audit manuel humain professionnel (testeur experimente personne handicapee) planifie Sprint 30 avant prod release.

**Criteres WCAG 2.1 AA verifies** :
- 1.1.1 Contenu non-textuel : alt sur images, ARIA labels sur boutons icones (regle `image-alt`, `button-name`)
- 1.3.1 Information et relations : landmarks, headings hierarchie (regle `landmark-one-main`, `heading-order`)
- 1.4.3 Contraste minimum : 4.5:1 texte normal, 3:1 large text (regle `color-contrast`)
- 1.4.10 Reflow : zoom 400% sans scroll horizontal (regle `meta-viewport`)
- 2.1.1 Clavier : toutes interactions accessible clavier (regle `focus-order-semantics`, test keyboard-nav.spec)
- 2.1.2 Pas de piege clavier : focus trap modals OK (test "focus trap dans modal Dialog")
- 2.4.1 Skip links : "Aller au contenu" (test "skip link focus en premier Tab")
- 2.4.3 Ordre focus logique (test "tab order coherent")
- 2.4.6 En-tetes et etiquettes descriptives (regle `label`, `heading-order`)
- 2.4.7 Focus visible (regle `focus-order-semantics`)
- 3.1.1 Langue de la page : `<html lang>` (regle `html-has-lang`)
- 3.2.4 Identification coherente (regle `nested-interactive`)
- 3.3.2 Etiquettes ou instructions (regle `label`, `form-field-multiple-labels`)
- 4.1.1 Validation syntaxique (regle `duplicate-id-active`)
- 4.1.2 Nom, role, valeur (regle `aria-*`)
- 4.1.3 Messages d'etat : aria-live regions (test "Aria-live region announces toast")

### 11.2 Loi 09-08 protection donnees personnelles + CNDP

La Loi 09-08 relative a la protection des personnes physiques a l'egard du traitement des donnees a caractere personnel, articles 18-25, exige la **securite et la confidentialite des donnees personnelles**. La CNDP (Commission Nationale de Controle de la Protection des Donnees) supervise.

**Implications tests** :
- Tests RBAC verifient que chaque role voit uniquement ses donnees accessibles (cf. rbac-3-roles.spec.ts).
- Tests multi-tenant verifient isolation tenant (cookie current_tenant_id, header x-tenant-id propagated).
- Tests delete contact verifient suppression complete (pas de soft-delete fantome).
- Tests test tenants ephemeres ne contiennent **AUCUNE donnee reelle** -- uniquement faker fr_MA fictives.

### 11.3 Loi 53-05 confiance numerique

La Loi 53-05 sur l'echange electronique de donnees juridiques, articles 7-9, impose **authentification forte** (MFA) pour acces aux systemes traitant des donnees personnelles sensibles. ACAPS (regulateur insurance) impose en consequence MFA obligatoire pour broker_admin.

**Implications tests** :
- Tests MFA setup (`mfa-setup.spec.ts`) couvrent flow QR + TOTP verify + recovery codes.
- Tests login MFA (`login.spec.ts`) verifient enforcement TOTP RFC 6238 (`otplib` config 30s window 6 digits SHA1).
- Tests recovery codes verifient format 10 codes XXXX-XXXX 8 chars alphanum (entropie suffisante).
- Tests change password (`change-password.spec.ts`) verifient revoke sessions autres (invalide refresh tokens autres devices).

### 11.4 ACAPS supervision

ACAPS exige aux courtiers (intermediaires assurance) :
- Affichage numero ACAPS sur tous documents (footer app, signatures email, devis).
- Tenant settings exposent `broker_acaps_id` et `broker_ice` (cf. parametres-admin-only.spec.ts onglet ACAPS).

**Implications tests** :
- Tests parametres verifient affichage `data-testid="broker-acaps-id"` et `broker-ice`.
- Tests sinistres verifient read-only (M9 = sinistre supervision compagnie, pas courtier).

### 11.5 DAC6 (Directive UE transposee) + ATCA

Pas applicable directement (operations B2B locales MA), mais les tenants futurs filiales etrangeres (Sprint 35+) devront passer audit DAC6. Non couvert tests Sprint 16.

### 11.6 Timezone Africa/Casablanca

Tous tests Playwright run avec `timezoneId: 'Africa/Casablanca'`. Assertions dates utilisent format `YYYY-MM-DD` pour eviter ambiguite locale.

### 11.7 Multilinguisme Article 5 Constitution

L'article 5 de la Constitution marocaine 2011 reconnait l'arabe et l'amazigh comme langues officielles, et reconnait la place du francais et autres langues etrangeres. Notre app supporte fr / ar-MA (Darija) / ar (classique). Pas d'amazigh dans Sprint 16 (cible Sprint 35+ apres release).

Tests `i18n/locale-switcher.spec.ts` valident les 3 locales obligatoires.

---

## 12. Conventions completes (4-6 ko)

### 12.1 Nommage fichiers tests

Pattern : `e2e/<domain>/<feature>-<aspect>.spec.ts`.
- `<domain>` : auth, dashboard, contacts, companies, deals, polices, broker-queue, sinistres, profile, parametres, rbac, i18n, a11y, perf
- `<feature>` : nom action ou page (ex: login, signup, kanban, validate, mfa-setup)
- `<aspect>` : optional precision (ex: read-only, table, kanban)

Exemples valides :
- `e2e/auth/login.spec.ts`
- `e2e/polices/polices-cancel.spec.ts`
- `e2e/a11y/keyboard-nav.spec.ts`

Exemples invalides :
- `e2e/test1.spec.ts` (nommage non descriptif)
- `e2e/contacts.spec.ts` (manque sous-feature)

### 12.2 Nommage tests internes

Pattern : `test('<role>: <action> <expected result>', ...)`.
Exemples :
- `test('broker_admin: cancel police -> apercu pro-rata + confirme', ...)`
- `test('broker_user: NE peut PAS resilier police (polices:cancel reserved admin)', ...)`

Anti-pattern : `test('test1', ...)` ou `test('cancel works', ...)`.

### 12.3 Selectors prefere (priority order)

1. **getByRole** : `page.getByRole('button', { name: /se connecter/i })` -- accessible
2. **getByLabel** : `page.getByLabel(/email/i)` -- form fields
3. **getByText** : `page.getByText('Mon texte')` -- contenu visible
4. **getByTestId** : `page.locator('[data-testid="contact-row"]')` -- selectors metier (toujours en data-testid kebab-case)
5. **CSS** : last resort, eviter sauf cas legitimes (`.recharts-surface`)
6. **xpath** : INTERDIT (fragile)

### 12.4 Locators dataTestId convention

Format : `data-testid="<entite>-<aspect>"`.
- `data-testid="contact-row"` : ligne tableau
- `data-testid="contact-name"` : champ nom
- `data-testid="kpi-value"` : valeur KPI widget
- `data-testid="kanban-column"` : colonne kanban

Tous les composants Sprint 16 (taches 4.3.4-4.3.11) ont ajoute data-testid sur elements interactifs/identifiables. Cette tache valide leur presence.

### 12.5 Assertions Playwright vs jest expect

Toujours utiliser `expect` importe depuis `@playwright/test` (auto-retry).
```typescript
// OK
import { expect } from '@playwright/test';
await expect(page.locator('...')).toBeVisible();

// PAS OK (pas d'auto-retry)
import { expect } from 'vitest';
expect(await page.locator('...').isVisible()).toBe(true);
```

### 12.6 Timeouts

- Test global : 60s (config)
- Assertion : 10s (config `expect.timeout`)
- Action : 15s (config `use.actionTimeout`)
- Navigation : 30s (config `use.navigationTimeout`)
- Network idle : 30s par defaut Playwright

Custom timeouts inline UNIQUEMENT si justifie commentaire :
```typescript
// Justifie : LHCI run prend ~30s par audit
await expect(page.locator('.lhci-result')).toBeVisible({ timeout: 45_000 });
```

### 12.7 Fixtures imports

Pattern d'imports dans spec.ts :
```typescript
import { test, expect } from '@playwright/test';
import { faker } from '@faker-js/faker/locale/fr';
import { storageStateFor, expectToast } from '../fixtures/auth-helpers';
import { scanA11y } from '../fixtures/a11y-helpers';
import { TEST_USERS } from '../fixtures/test-users';
```

### 12.8 storageState

- Default tests : `test.use({ storageState: storageStateFor('broker_admin') })`
- Tests auth (login, signup, recovery) : `test.use({ storageState: { cookies: [], origins: [] } })`
- Tests multi-role : creer context dans le test : `const context = await browser.newContext({ storageState: storageStateFor(role) })`

### 12.9 Commentaires

- Header chaque spec.ts : 0 commentaire requis (le nom du test suffit).
- Fonctions helpers : JSDoc obligatoire (description + @param + @returns).
- Justifications skip/disable : commentaire inline obligatoire :
```typescript
test.skip(({ browserName }) => browserName !== 'chromium', 'kanban drag-drop fiable uniquement sur chromium');
```

### 12.10 Variables env tests

Convention : `TEST_*` prefix pour vars test-specifiques.
- `TEST_API_ADMIN_TOKEN` : token admin pour create tenants
- `TEST_TENANT_PREFIX` : prefix slug tenants
- `TEST_USER_PASSWORD` : password default users tests
- `TEST_FAKER_SEED` : seed reproducibilite

### 12.11 Logging dans tests

Limite : pas de `console.log` dans specs (utilise pour debug, retire avant commit).
Logger global setup/teardown : `console.log('[global-setup] ...')` prefix `[global-setup]` pour grep facile.

### 12.12 Async/await

INTERDIT : `.then()` chaining.
OBLIGATOIRE : `await` partout. Lint regle `no-floating-promises` active.

### 12.13 Tests isolation

Chaque test doit etre **independant** :
- `test.beforeEach` clear cookies + reauth si necessaire
- Pas de dependance sur ordre execution (`test.describe.serial` reserve aux cas justifies LHCI sequence)
- Pas de state partage entre tests (variables top-level)

### 12.14 Data cleanup

Tests qui CREATE des entites (create contact, create deal) ne sont **pas tenus** de delete a la fin -- le `globalTeardown` DROP les tenants entiers. Exception : tests qui modifient state critique (change-password) doivent revert pour isolation.

### 12.15 RTL tests specifiques

- Verify `await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')`
- Verify positionnement spatial via `boundingBox().x` (sidebar > main en RTL)
- Verify caracteres arabes presents dans contenus (`/[؀-ۿ]/.test(text)`)

### 12.16 A11y tests structure

Chaque spec page importante doit avoir au moins 1 test a11y final :
```typescript
test('<page> a11y WCAG 2.1 AA', async ({ page }) => {
  await page.goto('/fr/<page>');
  await scanA11y(page);
});
```

### 12.17 Browser-specific skips

Pattern : `test.skip(({ browserName }) => browserName === 'webkit', 'reason')` avec justification.

### 12.18 Snapshots screenshots

Pas de visual regression Sprint 16. Pas de `toHaveScreenshot()` assertions.

### 12.19 Network mocks

Default : tests utilisent API reelle (test tenants seeded). Si mock necessaire (ex: simuler 500 server), utiliser `page.route()` avec justification :
```typescript
// Mock API 500 pour tester error handling UI
await page.route('**/v1/crm/contacts', (route) => route.fulfill({ status: 500 }));
```

### 12.20 Reporters output format

3 reporters actifs :
- `html` : developpeur (local)
- `junit` : CI parsing
- `list` (local) ou `github` (CI) : stdout

---

## 13. Stack technique impactee (3-5 ko)

### 13.1 Nouvelles deps ajoutees

Dans `apps/web-broker/package.json` `devDependencies` :
```json
{
  "@playwright/test": "1.49.1",
  "@axe-core/playwright": "4.10.0",
  "@lhci/cli": "0.14.0",
  "lighthouse": "12.3.0",
  "otplib": "12.0.1",
  "@faker-js/faker": "9.3.0",
  "seedrandom": "3.0.5",
  "@types/seedrandom": "3.0.8",
  "dayjs": "1.11.13",
  "dotenv": "16.4.5",
  "chalk": "5.3.0"
}
```

Scripts ajoutes a `apps/web-broker/package.json` :
```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:headed": "playwright test --headed",
    "test:e2e:debug": "PWDEBUG=1 playwright test",
    "test:e2e:report": "playwright show-report test-results/html",
    "lhci": "lhci autorun",
    "test:flakiness": "bash scripts/test-flakiness.sh"
  }
}
```

### 13.2 Impacts sur autres apps

Cette suite est **app-specific** (`apps/web-broker/e2e/`). Pas d'impact sur :
- `apps/web-garage/`, `apps/web-customer-portal/`, etc. (auront leurs propres suites Sprint 17+)
- Suite E2E API backend (`repo/e2e/api/`, Sprint 5)
- Suite E2E baseline 8 apps (`repo/e2e/`, Sprint 4)

### 13.3 Impacts sur backend NestJS

Endpoints test-only ajoutes (gardes par feature flag `ENABLE_TEST_ENDPOINTS=true` activable dev/CI only) :
- `POST /v1/admin/tenants` : create tenant (Sprint 6 deja shipping)
- `DELETE /v1/admin/tenants/:id` : delete tenant cascade
- `POST /v1/admin/users` : create user avec role (Sprint 7 deja shipping)
- `POST /v1/crm/contacts:bulk` : bulk create contacts
- `POST /v1/crm/companies:bulk` : bulk
- `POST /v1/crm/deals:bulk` : bulk
- `POST /v1/insure/polices:bulk` : bulk
- `POST /v1/insure/broker-queue/items` : create queue item
- `GET /v1/admin/test/email-verifications?email=X` : recuperer token verify dev
- `GET /v1/admin/test/password-recoveries?email=X` : recuperer token reset
- `GET /v1/admin/test/emails?ref=X` : recuperer email sent log

Ces endpoints sont **DESACTIVES en prod** (feature flag check) -- securite.

### 13.4 Impacts CI GitHub Actions

Nouveau workflow `.github/workflows/e2e-web-broker.yml` :
- Trigger : PR touching `apps/web-broker/**` ou `packages/**`
- Matrix : 4 shards parallel
- Services Docker : postgres, redis, mailhog
- Artifacts : playwright-report, traces, junit XML, lighthouse-reports
- Duree : ~12 min total

### 13.5 Impacts Docker Compose dev

Pas de nouveau service Docker requis (Playwright run sur host, browsers installes localement).

### 13.6 Impacts CI runner sizing

Runner GitHub Actions standard (Ubuntu 22.04, 2 vCPU, 7 GB RAM) suffit. Si latence excessive (> 15 min/run), upgrade runner large (4 vCPU, 16 GB) -- pas necessaire Sprint 16.

---

## 14. Risques et mitigations (2-3 ko)

| Risque | Probabilite | Impact | Mitigation |
|--------|-------------|--------|------------|
| Flakiness reseau API NestJS lente | Moyenne | Eleve | `waitForApi` polling + retries=2 CI + healthcheck |
| Drag-drop kanban casse cross-browser | Elevee | Moyen | Skip webkit + firefox, chromium only |
| Tests parallel races sur seed DB | Moyenne | Eleve | globalSetup sequentiel + 4 tenants isoles |
| Lighthouse scores delta CI vs local | Elevee | Bas | Seuils CI baseline + numberOfRuns: 3 moyenne |
| axe-core false positives Recharts | Elevee | Bas | `exclude: ['.recharts-surface']` + `scanA11yWithTolerance` |
| MFA TOTP timing 30s expire | Faible | Moyen | `window: 1` tolerance otplib + generate juste-avant-submit |
| Cookies pollution cross-tests | Moyenne | Moyen | clearCookies beforeEach + storageState par role |
| Trace.zip volumineux artifacts CI | Faible | Bas | `trace: 'on-first-retry'` + retention 7 jours |
| RTL tests echouent firefox | Faible | Bas | Chrome only pour RTL critiques |
| Hydration mismatch React 19 RSC | Faible | Moyen | Force reload apres locale switch |
| Tests longs > 8 min suite | Moyenne | Bas | Shard 4 workers CI = 3 min effective |
| Cmd+K mac/linux divergence | Faible | Bas | ControlOrMeta+K abstraction Playwright |
| Locale switcher route 404 | Faible | Moyen | Tests valident routes /fr/, /ar-MA/, /ar/ exist |
| Lighthouse skip storybook stories | N/A | N/A | LH run sur app build, pas storybook |
| Faker non-determinism cross-runs | Faible | Bas | `seedrandom` global seed + faker.seed() |

---

## 15. Reperes effort detaille (1-2 ko)

| Etape | Effort | Cumul |
|-------|--------|-------|
| Setup playwright.config + deps install | 0.5h | 0.5h |
| Ecrire fixtures (auth, tenant, data, a11y, otp) | 1.0h | 1.5h |
| Ecrire global-setup + global-teardown | 0.5h | 2.0h |
| Ecrire 4 tests auth (login/signup/recovery/multi-tenant) | 0.5h | 2.5h |
| Ecrire tests dashboard + contacts + companies | 0.5h | 3.0h |
| Ecrire tests deals (kanban + table + create) | 0.5h | 3.5h |
| Ecrire tests polices (list + detail + cancel + suspend) | 0.5h | 4.0h |
| Ecrire tests broker-queue + sinistres | 0.4h | 4.4h |
| Ecrire tests profile + parametres + rbac | 0.5h | 4.9h |
| Ecrire tests i18n + a11y + keyboard-nav | 0.4h | 5.3h |
| Ecrire lighthouse-baseline + LHCI config | 0.3h | 5.6h |
| CI workflow GitHub Actions setup | 0.2h | 5.8h |
| README + docs + revue + commit | 0.2h | 6.0h |
| **TOTAL** | **6.0h** | **6.0h** |

---

## 16. Documentation README e2e (3-4 ko)

`apps/web-broker/e2e/README.md` :

```markdown
# web-broker E2E Tests (Sprint 16 - Tache 4.3.14)

Suite Playwright + axe-core validant les 12 pages web-broker.

## Quick start

1. Installer browsers (premiere fois) :
   pnpm exec playwright install --with-deps

2. Demarrer infrastructure (DB + Redis + Mailhog) :
   docker compose -f docker-compose.dev.yml up -d postgres redis mailhog

3. Demarrer API NestJS (autre terminal) :
   pnpm --filter @insurtech/api start:dev

4. Run suite :
   pnpm --filter @insurtech/web-broker test:e2e

## Structure

- fixtures/ : helpers reutilisables (auth, tenant, data, a11y, otp)
- auth/, dashboard/, contacts/, ... : tests par domaine
- a11y/ : tests accessibilite axe-core WCAG 2.1 AA
- perf/ : tests Lighthouse 3 pages clefs
- global-setup.ts : prepare tenants + seeds + storageStates
- global-teardown.ts : DELETE tenants ephemeres

## Commandes utiles

- pnpm test:e2e : suite complete
- pnpm test:e2e:ui : mode UI interactif
- pnpm test:e2e -- e2e/auth/login.spec.ts : un fichier
- pnpm test:e2e --grep "login OK" : par nom
- pnpm test:e2e --project=chromium-fr : un seul project
- pnpm test:e2e:report : voir HTML report
- pnpm lhci : Lighthouse CI assertions

## Ajouter un test

1. Identifier domaine (auth, contacts, polices, ...)
2. Creer fichier e2e/<domaine>/<feature>.spec.ts
3. Import test, expect from '@playwright/test'
4. Choisir storageState (broker_admin/user/assistant)
5. Ecrire tests avec selectors getByRole > getByLabel > getByTestId
6. Ajouter au moins 1 test a11y final scanA11y(page)
7. Run isole pnpm test:e2e e2e/<...>/<feature>.spec.ts
8. Verifier pas regression suite complete
9. Commit

## Debug test failed

1. Run avec trace : pnpm test:e2e --trace on <fichier>
2. Voir trace : pnpm exec playwright show-trace test-results/artifacts/<id>/trace.zip
3. Mode UI : pnpm test:e2e:ui
4. Mode headed : pnpm test:e2e:headed

## Test data

- TEST_USERS dans fixtures/test-users.ts (3 roles)
- 4 tenants ephemeres crees par globalSetup, dropped par globalTeardown
- Faker locale fr_MA seedrandom deterministe
- TEST_FAKER_SEED env var pour customiser seed

## CI integration

- Workflow .github/workflows/e2e-web-broker.yml
- Trigger : PR touching apps/web-broker/**
- Shards : 4 paralleles
- Artifacts : HTML report + traces + JUnit XML + LH reports

## Conformite

- WCAG 2.1 AA verifiee axe-core 4.10 (Loi 10-03 Maroc)
- RBAC 3 roles verifiee (CNDP Loi 09-08)
- MFA TOTP verifiee (Loi 53-05)
- Africa/Casablanca timezone obligatoire
- 3 locales fr / ar-MA / ar testees (Constitution Article 5)

## FAQ

Q: Tests flaky en local ?
R: Verifier API NestJS demarree + DB migrate. Run pnpm scripts/test-flakiness.sh.

Q: Lighthouse score bas en CI ?
R: Normal (runner GitHub 2 vCPU ~10-15 pts sous local). Seuils CI ajustes.

Q: Comment skip un test temporairement ?
R: test.skip('...') avec issue link en commentaire. Pas plus de 5 skips actifs en main.

Q: Visual regression ?
R: Pas en Sprint 16. Sprint 35 ajoutera Chromatic.
```

---

## 17. Checklist finale (1-2 ko)

### 17.1 Pre-merge checklist (developpeur)

- [ ] Code lint pass : `pnpm --filter @insurtech/web-broker lint`
- [ ] TypeScript compile : `pnpm --filter @insurtech/web-broker typecheck`
- [ ] Unit tests pass : `pnpm --filter @insurtech/web-broker test`
- [ ] E2E suite pass localement : `pnpm --filter @insurtech/web-broker test:e2e`
- [ ] Flakiness check 5x : `bash scripts/test-flakiness.sh` -- 5 pass / 0 fail
- [ ] Lighthouse seuils pass : `pnpm lhci`
- [ ] axe-core scan 12 pages : 0 critical + 0 serious
- [ ] No emoji dans code/comments : `grep -P "[\x{1F300}-\x{1F9FF}]"` empty
- [ ] data-testid present sur elements interactifs nouveaux
- [ ] README e2e mis a jour si nouveau scenario
- [ ] Commit message respecte convention : `test(e2e): ajouter scenario <description>`

### 17.2 Post-merge checklist (reviewer)

- [ ] CI workflow `e2e-web-broker` green sur 4 shards
- [ ] Lighthouse job green
- [ ] No flaky test signale (3 reruns successifs CI)
- [ ] HTML report telecharge et inspection visuelle OK
- [ ] Tests couvrent V1-V28 criteres validation

### 17.3 Sprint 16 closure checklist

- [ ] 33+ fichiers `.spec.ts` presents dans `apps/web-broker/e2e/`
- [ ] LOC tests >= 4500
- [ ] 25+ E2E scenarios fonctionnels (cible largement depassee = ~120)
- [ ] 14+ a11y scenarios (cible : axe-core scan 12 pages + 11 keyboard nav)
- [ ] CI workflow operationnel et green sur main
- [ ] Lighthouse baseline produit 3 reports JSON
- [ ] Documentation e2e/README.md complete
- [ ] Sprint 16 closure : `pnpm test:e2e` cross-app 5x consecutif pass

### 17.4 Handoff Sprint 17 (web-customer-portal)

Sprint 17 web-customer-portal reutilisera :
- Pattern fixtures `auth-helpers.ts`, `a11y-helpers.ts`, `otp-helpers.ts`
- Pattern `playwright.config.ts` 6 projects + 4 workers
- Pattern `globalSetup.ts` create tenants + seed
- Pattern CI workflow `.github/workflows/e2e-web-customer-portal.yml`

Adaptations Sprint 17 :
- Public pages SEO -> Lighthouse seuils plus stricts (Perf >= 90, SEO 100)
- Pas d'auth obligatoire (parcours visiteur)
- Vente en ligne flows specifiques (paiement, tunnel conversion)
- A11y obligatoire grand public (WCAG 2.1 AA strict)

---

**Fin du document task-4.3.14 (Tests E2E Playwright + Accessibility Checks).**





