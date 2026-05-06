# TACHE 1.1.1 -- Initialisation Monorepo pnpm + Turborepo + Structure 9 apps + 23 packages

**Sprint** : 1 (Phase 1 / Sprint 1 dans phase) -- Bootstrap Infrastructure
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-01-sprint-01-bootstrap.md` (Tache 1.1.1)
**Phase** : 1 -- Bootstrap Infrastructure
**Priorite** : P0 (bloquant absolu pour les 14 taches suivantes du Sprint 1 et pour les Sprints 2 a 35)
**Effort** : 6h
**Dependances** : Aucune (premiere tache du programme)
**Densite cible** : 80-150 ko (auto-suffisant exhaustif)
**AUCUNE EMOJI AUTORISEE**

---

## 1. But

Cette tache vise a etablir le squelette structurel du depot monorepo `repo/` qui hebergera les 9 applications deployables et les 23 packages partages du programme Skalean InsurTech v2.2 sur l'ensemble des 35 sprints. Le but est de produire la racine du monorepo (package.json racine, pnpm-workspace.yaml, turbo.json, .npmrc, .nvmrc, .gitignore, .editorconfig) ainsi que l'arborescence vide des dossiers `apps/` (9 sous-dossiers), `packages/` (23 sous-dossiers), `infrastructure/` (3 sous-dossiers : docker, scripts, terraform), `.github/workflows/`, `.husky/`, `.vscode/`, `docs/architecture/` et `test/`. Aucun code applicatif n'est ecrit dans cette tache, seulement la fondation outillage permettant aux taches suivantes de remplir les sous-dossiers.

L'apport est triple. Premierement, choisir pnpm 9.15.0 (vs npm ou yarn) garantit a la fois une vitesse d'install 3 a 5 fois superieure grace au content-addressable store, et une stricte hoisting policy qui empeche la dependance fantome (un package qui importe un module non declare dans son package.json fonctionne par accident sur npm a cause du hoisting flat, mais echoue en CI ou prod ; pnpm rejette ce pattern par default). Deuxiemement, Turborepo 2.4.0 (vs nx ou lerna) offre un task graph parallele avec cache local et remote (Vercel Cloud, optionnel Sprint 35) qui evite de re-builder les packages non modifies, ramenant les CI runs de 8 minutes a 90 secondes une fois warm. Troisiemement, l'option `engine-strict=true` dans `.npmrc` rejette `pnpm install` si la version Node locale ne matche pas `engines.node` du package.json racine, fermant la classe entiere des bugs lies a Node version drift entre developpeurs.

A l'issue de cette tache, `pnpm install --frozen-lockfile` reussit a froid en moins de 90 secondes sur une machine 8 GB RAM, `pnpm dlx turbo --version` retourne 2.4.x ou superieur, et `pnpm typecheck` renvoie exit code 0 (vide mais valide) sur l'ensemble du monorepo. Les 9 dossiers `apps/` et 23 dossiers `packages/` existent (vides), pretes a recevoir les stubs de la Tache 1.1.13. Aucun fichier code applicatif (TypeScript, JavaScript, SQL) n'est livre dans cette tache : sa portee est strictement la fondation outillage.

---

## 2. Contexte etendu

### 2.1 Pourquoi cette tache existe

Le programme Skalean InsurTech v2.2 deploie 9 applications cible (api NestJS, 7 frontends Next.js dont 2 PWA mobile, 1 mcp-server standalone) qui partagent intensivement du code metier (auth, multi-tenant, RLS, comm, signature, paiement) via 23 packages reutilisables. Sans une structure monorepo dediee, chaque modification d'un type partage (par exemple, ajouter un champ `Locale` a `@insurtech/shared-types`) imposerait : publication NPM private du package, bump version, mise a jour des package.json consommateurs, install successif, deploiement coordonne. Sur un cycle de 35 sprints, ce surcout cumule represente plusieurs centaines d'heures.

A l'inverse, dans un monorepo avec workspace links symboliques, le meme changement est effectif immediatement dans toutes les apps consommatrices, le typecheck cross-app detecte les regressions immediatement, et un seul commit Git enregistre le refactoring atomique. L'industrie a converge sur ce pattern (Vercel, Stripe, Shopify, Airbnb, Microsoft VSCode) pour cette raison.

Le choix specifique pnpm + Turborepo (vs lerna deprecie, nx plus complexe, yarn 4 moins mature en hoisting strict) est documente dans `00-pilotage/decisions/001-monorepo-structure.md` (decision-001).

### 2.2 Alternatives considerees

| Alternative | Avantages | Inconvenients | Decision |
|-------------|-----------|---------------|----------|
| Polyrepo (30 repos Git separes) | Permissions Git granulaires par equipe, releases independantes par package, repo Git size faible par projet | Refactoring atomique impossible, drift de versions deps incontrolable, CI exponentielle (30 pipelines), onboarding 30 clones, package metier non reutilisable sans publish NPM private | REJETE -- couts collaboration trop eleves pour 7 verticales (auth/db/crm/booking/comm/insure/repair) interdependantes |
| Monorepo npm workspaces | Standard officiel, zero install supplementaire | Hoisting flat permet phantom deps (bug latent), pas de task graph parallele, install lent (15-30s sur monorepo moyen vs 5-10s pnpm) | REJETE -- hoisting flat incompatible discipline strict |
| Monorepo yarn workspaces (yarn 4 PnP) | PnP elimine node_modules, install ~7s | Compatibilite tooling encore fragile (TypeScript paths, Jest, ESBuild), dette migration en cas d'abandon | REJETE -- maturite ecosysteme insuffisante pour usage entreprise |
| Monorepo pnpm + nx | Nx graph affinity, executors uniformes | Configuration nx.json verbeuse, courbe apprentissage, vendor lock-in nx | REJETE -- complexite excessive vs Turborepo simplicite |
| Monorepo pnpm + Turborepo (RETENU) | pnpm hoisting strict + Turborepo task graph parallele + cache local/remote, ecosysteme moderne, configuration minimale (turbo.json ~50 lignes) | Pas de support natif Bazel-like RBE, remote cache dependant Vercel (pour cache distribue) | RETENU -- meilleur compromis productivite, performance, simplicite, maintenabilite |

### 2.3 Trade-offs explicites

Choisir pnpm 9.15.0 implique d'accepter un workflow legerement different pour les contributeurs habitues a npm/yarn : la commande `pnpm add <pkg>` se substitue a `npm install <pkg>`, la commande `pnpm add -D <pkg>` se substitue a `npm install --save-dev <pkg>`, et l'installation dans un workspace specifique se fait via `pnpm --filter @insurtech/auth add <pkg>` (au lieu de naviguer dans le sous-dossier puis npm install). Cette friction de 1-2 jours d'onboarding par developpeur est largement compensee par les gains long terme.

Choisir Turborepo 2.4.0 implique d'accepter que le `turbo.json` doit declarer explicitement les `inputs` (fichiers qui invalident le cache) et `outputs` (fichiers a cacher) pour chaque tache, sinon le cache est sur-pessimiste (rebuild trop souvent) ou sur-optimiste (cache stale). Cette discipline de declaration coute environ 30 minutes par sprint mais previent la classe complete des bugs de cache.

Choisir `engine-strict=true` implique que tout developpeur qui ne fait pas evoluer son Node a 22.20.0 LTS verra `pnpm install` echouer avec un message clair. Cette friction est intentionnelle : un Node 18 ou 20 se comporte differemment en runtime ESM strict (top-level await, Web Crypto API, native fetch) et un bug en prod 6 mois plus tard a cause d'une feature non disponible localement coute 100 fois le prix de cette friction setup.

### 2.4 Decisions strategiques referenced

- **decision-001 (Monorepo pnpm + Turborepo)** : pertinence pour cette tache = totale. Cette tache concretise la structure monorepo decidee dans `00-pilotage/decisions/001-monorepo-structure.md`.
- **decision-006 (No-emoji Policy ABSOLUE)** : pertinence pour cette tache = totale. Aucune emoji n'est autorisee dans aucun des fichiers livres (package.json, turbo.json, .gitignore, .editorconfig, etc.). La validation V10 verifie ce point automatiquement.
- **decision-008 (Data Residency Maroc)** : pertinence pour cette tache = indirecte. La structure `infrastructure/terraform/` prevue ici accueillera les modules Atlas Cloud Services Benguerir au Sprint 35.
- **decision-005 (Skalean AI Frontier)** : pertinence pour cette tache = indirecte. La structure `packages/sky` et `packages/sky-ui` est prevue dans le workspaces array, anticipant Sprint 31.

### 2.5 Pieges techniques connus

1. **Piege : `engine-strict` ne se declenche pas si l'utilisateur lance `npm install` au lieu de `pnpm install`.**
   - Pourquoi : l'option `engine-strict=true` est une option pnpm specifique, pas une option npm.
   - Solution : ajouter dans `package.json` un champ `"packageManager": "pnpm@9.15.0"` qui declenche un warning si `npm` ou `yarn` est utilise (corepack-aware). En complement, le hook `preinstall` peut executer `npx only-allow pnpm` (mais a eviter pour ne pas ajouter dependance).

2. **Piege : `auto-install-peers=true` masque des incompatibilites peerDeps.**
   - Pourquoi : pnpm propose ce flag pour la convivialite (pas a installer manuellement React + ReactDOM + Next.js peerDeps), mais peut masquer un scenario ou un package declare une peerDep incompatible.
   - Solution : laisser `auto-install-peers=true` pour Sprint 1 (productivite), reactiver `auto-install-peers=false` au Sprint 33 (pentest) pour audit complet peerDeps.

3. **Piege : `link-workspace-packages=deep` peut conflicter avec versions externes pinnees.**
   - Pourquoi : si `apps/api` declare `@insurtech/auth: workspace:*` et qu'un autre package transitif declare `@insurtech/auth: 1.2.3` (publie NPM par erreur), pnpm tente une resolution.
   - Solution : convention stricte = aucun package interne `@insurtech/*` n'est jamais publie NPM. Les imports utilisent toujours `workspace:*` ou rien.

4. **Piege : Turborepo `globalDependencies` oublie peut empecher invalidation cache.**
   - Pourquoi : si `tsconfig.base.json` est modifie mais pas declare dans `globalDependencies`, le cache typecheck reste valide a tort.
   - Solution : declarer dans `turbo.json` `"globalDependencies": ["tsconfig.base.json", "biome.json", ".env"]` -- toute modification invalide tout le graph cache.

5. **Piege : Cache Turborepo `.turbo/` accidentellement committe.**
   - Pourquoi : le dossier `.turbo/` peut atteindre 200 MB en local et grandir sans limite ; un commit le ramene dans le repo Git.
   - Solution : ligne stricte `.turbo` dans `.gitignore` avant tout autre dossier, et hook pre-commit (Tache 1.1.14) qui rejette tout commit contenant `.turbo/`.

6. **Piege : `save-exact=true` sans `pnpm-lock.yaml` ne garantit pas reproductibilite.**
   - Pourquoi : `save-exact=true` impose les versions exactes (1.2.3 au lieu de ^1.2.3) dans package.json mais le lockfile reste necessaire pour figer les versions transitives.
   - Solution : commiter `pnpm-lock.yaml` toujours (jamais dans `.gitignore`) et CI utilise toujours `--frozen-lockfile`.

7. **Piege : Structure dossier `apps/web-*` confond Cowork lors de la generation Tache 1.1.13.**
   - Pourquoi : 7 apps web utilisent toutes Next.js 15, et un script de generation peut confondre `web-broker` et `web-customer-portal`.
   - Solution : convention stricte = chaque dossier app a un `README.md` minimal d'1 ligne identifiant le port et l'audience cible (genere Tache 1.1.13).

8. **Piege : `.editorconfig` non lu si le developpeur n'utilise pas un editeur compatible.**
   - Pourquoi : VSCode necessite l'extension `EditorConfig.EditorConfig`, IntelliJ l'a native.
   - Solution : `.vscode/extensions.json` (Tache 1.1.2) recommande l'extension EditorConfig en plus de Biome et Tailwind.

9. **Piege : `pnpm install` initial sur Windows depasse 90s a cause d'antivirus scan.**
   - Pourquoi : Windows Defender scanne chaque fichier extrait du store pnpm ; les 100k+ fichiers post-install causent un overhead significatif.
   - Solution : documenter dans CONTRIBUTING.md l'exclusion antivirus du dossier `node_modules` et du store pnpm `~/AppData/Local/pnpm`.

10. **Piege : MacOS BSD coreutils incompatible scripts shell GNU.**
    - Pourquoi : les scripts shell de l'infrastructure (Tache 1.1.4 init Postgres, Tache 1.1.6 init Kafka, Tache 1.1.14 check-no-emoji) utilisent `grep -P` (Perl regex) GNU specific.
    - Solution : documenter dans README l'installation `brew install grep` puis alias dans le shell du dev MacOS, OU utiliser un Docker wrapper pour les scripts critiques.

---

## 3. Architecture context

### 3.1 Position dans le sprint

Cette tache 1.1.1 est la premiere tache du Sprint 1 (Bootstrap Infrastructure) et la premiere tache absolue du programme Skalean InsurTech sur l'ensemble des 35 sprints. Elle :

- **Depend de** : aucune tache anterieure. Cette tache est le point de depart.
- **Bloque** : Tache 1.1.2 (TypeScript strict + Biome) car les fichiers `tsconfig.base.json` et `biome.json` doivent etre poses dans la racine creee ici. Bloque toutes les taches 1.1.3 a 1.1.15 car aucune ne peut s'executer sans la structure de base.
- **Apporte au sprint** : la structure de dossiers complete (9 apps + 23 packages + infrastructure + .github + .husky + .vscode + docs) ainsi que les 7 fichiers de configuration racine (package.json, pnpm-workspace.yaml, turbo.json, .npmrc, .nvmrc, .gitignore, .editorconfig). Sans cette tache, aucune autre tache du Sprint 1 (et donc aucun sprint ulterieur) ne peut commencer.

### 3.2 Position dans le programme global

Cette tache pose le cadre structurel sur lequel les 461 taches des 35 sprints viennent s'empiler. La structure de dossiers `packages/auth`, `packages/database`, `packages/crm`, etc. sera remplie progressivement : `packages/database` au Sprint 2 (entites + migrations + RLS subscribers), `packages/auth` au Sprint 5 (Argon2id + JWT + MFA), `packages/crm` au Sprint 8, `packages/comm` au Sprint 9, `packages/signature` au Sprint 10, `packages/pay` au Sprint 11, etc. Le squelette pose ici doit donc anticiper les 23 packages cibles (15 metier + 8 shared) et les 9 apps (8 frontends + 1 mcp-server).

L'app `mcp-server` (port 4001) est specifique a la version v2.2 (NEW vs v2.0), prevue pour exposer les tools metier de Skalean InsurTech au chatbot Sky via le protocole MCP au Sprint 30. Sa presence dans la liste de structure ici est purement preventive : son contenu sera produit au Sprint 30.

### 3.3 Diagramme architecture initial

```
repo/                                    [racine monorepo Git]
|
|-- package.json                          [racine, scripts orchestres]
|-- pnpm-workspace.yaml                   [declaration workspaces]
|-- turbo.json                            [pipeline tasks Turborepo]
|-- .npmrc                                [config pnpm strict]
|-- .nvmrc                                [Node 22.20.0 LTS]
|-- .gitignore                            [exclusion node_modules, .turbo, dist, .env, etc.]
|-- .editorconfig                         [UTF-8, LF, 2 spaces]
|
|-- apps/                                 [9 applications deployables]
|   |-- api/                              [NestJS, port 4000 -- Sprint 3]
|   |-- web-insurtech-admin/              [Next.js, port 3000 -- Sprint 4 + 26]
|   |-- web-broker/                       [Next.js, port 3001 -- Sprint 16]
|   |-- web-garage/                       [Next.js, port 3002 -- Sprint 22]
|   |-- web-garage-mobile/                [Next.js PWA, port 3003 -- Sprint 23]
|   |-- web-customer-portal/              [Next.js, port 3004 -- Sprint 17]
|   |-- web-assure-portal/                [Next.js, port 3005 -- Sprint 18]
|   |-- web-assure-mobile/                [Next.js PWA, port 3006 -- Sprint 18]
|   `-- mcp-server/                       [Node MCP, port 4001 -- Sprint 30]
|
|-- packages/                             [23 packages partages]
|   |-- auth/                             [Argon2id JWT MFA -- Sprint 5]
|   |-- database/                         [TypeORM 0.3 + RLS -- Sprint 2]
|   |-- crm/                              [Contacts companies deals -- Sprint 8]
|   |-- booking/                          [Rooms appointments -- Sprint 8]
|   |-- comm/                             [WhatsApp Email -- Sprint 9]
|   |-- docs/                             [S3 PDF -- Sprint 10]
|   |-- signature/                        [Barid eSign -- Sprint 10]
|   |-- pay/                              [6 passerelles MA -- Sprint 11]
|   |-- books/                            [CGNC SAFT-MA -- Sprint 12]
|   |-- compliance/                       [ACAPS AMC CNDP -- Sprint 12]
|   |-- analytics/                        [ClickHouse -- Sprint 13]
|   |-- insure/                           [Vertical Broker -- Sprint 14-15-32]
|   |-- repair/                           [Vertical Garage -- Sprint 19-21]
|   |-- stock/                            [Stock pieces FIFO -- Sprint 13]
|   |-- hr/                               [Employees CNSS AMO -- Sprint 13]
|   |-- sky/                              [Agent Sky orchestrator -- Sprint 31]
|   |-- sky-ui/                           [Chat widget -- Sprint 31]
|   |-- assure-shared/                    [Components partages -- Sprint 18]
|   |-- shared-types/                     [Types globaux -- Sprint 1.1.13]
|   |-- shared-config/                    [Env loader Zod -- Sprint 1.1.8]
|   |-- shared-utils/                     [Logger Redis S3 -- Sprint 1.1.5/7/12]
|   |-- shared-events/                    [Schemas Zod Kafka -- Sprint 2]
|   |-- shared-ui/                        [shadcn/ui theme -- Sprint 4]
|   |-- shared-pwa/                       [Service worker -- Sprint 18/23]
|   `-- shared-maps/                      [Mapbox wrapper -- Sprint 17]
|
|-- infrastructure/                       [outillage non-applicatif]
|   |-- docker/                           [compose dev + init scripts Postgres/Kafka/MinIO]
|   |-- scripts/                          [verify-env.ts, check-no-emoji.sh, init-package-stubs.sh]
|   |-- observability/                    [grafana/datadog Sprint 34]
|   |-- cloudflare/                       [WAF Sprint 34]
|   |-- aws/                              [IAM policies Sprint 34]
|   `-- terraform/                        [modules Atlas Benguerir Sprint 35]
|
|-- docs/                                 [documentation projet]
|   |-- architecture/                     [ADR-001..ADR-010 + system-overview]
|   |-- api/                              [Swagger generated Sprint 3+]
|   |-- runbooks/                         [SRE Sprint 33+]
|   |-- security/                         [Threat model Sprint 33]
|   `-- pilote/                           [Marrakech go-live Sprint 35]
|
|-- .github/                              [CI/CD GitHub]
|   |-- workflows/                        [ci.yaml + futurs deploy.yaml + security.yaml]
|   |-- PULL_REQUEST_TEMPLATE.md          [Tache 1.1.10]
|   `-- CODEOWNERS                        [Tache 1.1.10]
|
|-- .husky/                               [Git hooks Husky 9]
|   |-- pre-commit                        [Tache 1.1.14]
|   |-- commit-msg                        [Tache 1.1.14]
|   `-- pre-push                          [Tache 1.1.14]
|
|-- .vscode/                              [editor config recommande]
|   |-- settings.json                     [Tache 1.1.2]
|   `-- extensions.json                   [Tache 1.1.2]
|
|-- test/                                 [setup tests cross-package]
|   `-- setup.ts                          [Tache 1.1.11]
|
|-- load-tests/                           [k6 + chaos Sprint 34]
|
|-- README.md                             [Tache 1.1.15]
|-- CLAUDE.md                             [Tache 1.1.15]
|-- CONTRIBUTING.md                       [Tache 1.1.15]
|-- LICENSE                               [Tache 1.1.15]
`-- .env.example                          [Tache 1.1.8]
```

---

## 4. Livrables checkables

- [ ] Fichier `repo/package.json` racine avec scripts orchestres (dev, build, lint, format, format:check, typecheck, test, test:e2e, test:coverage, docker:up, docker:down, docker:reset, docker:logs, bootstrap, verify-env, clean, prepare) (~85 lignes)
- [ ] Champ `engines.node` dans `package.json` racine = `>=22.20.0 <23.0.0`
- [ ] Champ `packageManager` dans `package.json` racine = `pnpm@9.15.0`
- [ ] Champ `private: true` dans `package.json` racine (anti-publish accidentel)
- [ ] devDependencies racine : `turbo@2.4.0`, `typescript@5.7.3`, `@types/node@22.10.5`, `tsx@4.19.2` minimum
- [ ] Fichier `repo/pnpm-workspace.yaml` declarant `apps/*` et `packages/*` avec commentaires explicatifs (~35 lignes)
- [ ] Fichier `repo/turbo.json` avec pipeline tasks complete (build dependsOn `^build`, dev `cache: false persistent: true`, typecheck dependsOn `^build`, lint, test avec env declare, test:e2e, clean) (~80 lignes)
- [ ] Champ `globalDependencies` dans turbo.json incluant `tsconfig.base.json`, `biome.json`, `.npmrc`, `.env`
- [ ] Fichier `repo/.npmrc` avec config stricte (auto-install-peers=true, save-exact=true, engine-strict=true, link-workspace-packages=deep, prefer-workspace-packages=true, strict-peer-dependencies=false, package-import-method=hardlink, dedupe-peer-dependents=true) (~25 lignes commentees)
- [ ] Fichier `repo/.nvmrc` contenant `22.20.0` (1 ligne) -- aligne avec `package.json engines.node`
- [ ] Fichier `repo/.gitignore` complet incluant : node_modules, .pnpm-store, .env, .env.local, .env.*.local, .turbo, dist, build, .next, out, coverage, .nyc_output, test-results, playwright-report, playwright/.cache, *.tsbuildinfo, .DS_Store, Thumbs.db, *.log, npm-debug.log*, pnpm-debug.log*, yarn-debug.log*, .vscode/_local, .idea, .nx, docker-data, .docker-data, *.swp, *.swo (~80 lignes commentees)
- [ ] Fichier `repo/.editorconfig` avec UTF-8 BOM=false, LF, 2 spaces indent, trim trailing whitespace, insert final newline, max line length 100 (~25 lignes)
- [ ] Dossier `repo/apps/api/.gitkeep` (placeholder vide)
- [ ] Dossier `repo/apps/web-insurtech-admin/.gitkeep`
- [ ] Dossier `repo/apps/web-broker/.gitkeep`
- [ ] Dossier `repo/apps/web-garage/.gitkeep`
- [ ] Dossier `repo/apps/web-garage-mobile/.gitkeep`
- [ ] Dossier `repo/apps/web-customer-portal/.gitkeep`
- [ ] Dossier `repo/apps/web-assure-portal/.gitkeep`
- [ ] Dossier `repo/apps/web-assure-mobile/.gitkeep`
- [ ] Dossier `repo/apps/mcp-server/.gitkeep`
- [ ] 23 dossiers `repo/packages/{auth,database,crm,booking,comm,docs,signature,pay,books,compliance,analytics,insure,repair,stock,hr,sky,sky-ui,assure-shared,shared-types,shared-config,shared-utils,shared-events,shared-ui,shared-pwa,shared-maps}/.gitkeep` -- attention, c'est 25 dossiers exacts (15 metier + 2 ai + 1 assure-shared + 7 shared)
- [ ] Dossier `repo/infrastructure/docker/postgres/.gitkeep`, `repo/infrastructure/docker/redis/.gitkeep`, `repo/infrastructure/docker/kafka/.gitkeep`, `repo/infrastructure/docker/minio/.gitkeep`
- [ ] Dossier `repo/infrastructure/scripts/.gitkeep`
- [ ] Dossier `repo/infrastructure/observability/.gitkeep`
- [ ] Dossier `repo/infrastructure/cloudflare/.gitkeep`
- [ ] Dossier `repo/infrastructure/aws/.gitkeep`
- [ ] Dossier `repo/infrastructure/terraform/.gitkeep`
- [ ] Dossier `repo/.github/workflows/.gitkeep`
- [ ] Dossier `repo/.husky/.gitkeep`
- [ ] Dossier `repo/.vscode/.gitkeep`
- [ ] Dossier `repo/docs/architecture/.gitkeep`
- [ ] Dossier `repo/docs/api/.gitkeep`
- [ ] Dossier `repo/docs/runbooks/.gitkeep`
- [ ] Dossier `repo/docs/security/.gitkeep`
- [ ] Dossier `repo/docs/pilote/.gitkeep`
- [ ] Dossier `repo/test/.gitkeep`
- [ ] Dossier `repo/load-tests/.gitkeep`
- [ ] Commande `pnpm install --frozen-lockfile` reussit en moins de 90 secondes (machine 8 GB RAM)
- [ ] Commande `pnpm dlx turbo --version` retourne semver >= 2.4.0
- [ ] Commande `pnpm typecheck` retourne exit code 0 (vide mais valide)
- [ ] Aucun fichier code TypeScript ou JavaScript hors devDeps n'est ajoute par cette tache
- [ ] Aucune emoji dans aucun fichier livre (verifie par script bash inline)

Total : 25 livrables structurels uniques + 14 livrables fonctionnels = 39 cases a cocher.

---

## 5. Fichiers crees / modifies

```
repo/package.json                                   (~85 lignes / scripts orchestres + devDeps)
repo/pnpm-workspace.yaml                            (~35 lignes / workspaces declaration)
repo/turbo.json                                     (~80 lignes / pipeline tasks)
repo/.npmrc                                         (~25 lignes / pnpm config strict)
repo/.nvmrc                                         (1 ligne / Node 22.20.0)
repo/.gitignore                                     (~80 lignes / patterns exhaustifs)
repo/.editorconfig                                  (~25 lignes / encoding LF 2 spaces)
repo/apps/api/.gitkeep                              (0 ligne / placeholder)
repo/apps/web-insurtech-admin/.gitkeep              (0 ligne)
repo/apps/web-broker/.gitkeep                       (0 ligne)
repo/apps/web-garage/.gitkeep                       (0 ligne)
repo/apps/web-garage-mobile/.gitkeep                (0 ligne)
repo/apps/web-customer-portal/.gitkeep              (0 ligne)
repo/apps/web-assure-portal/.gitkeep                (0 ligne)
repo/apps/web-assure-mobile/.gitkeep                (0 ligne)
repo/apps/mcp-server/.gitkeep                       (0 ligne)
repo/packages/auth/.gitkeep                         (0 ligne)
repo/packages/database/.gitkeep                     (0 ligne)
repo/packages/crm/.gitkeep                          (0 ligne)
repo/packages/booking/.gitkeep                      (0 ligne)
repo/packages/comm/.gitkeep                         (0 ligne)
repo/packages/docs/.gitkeep                         (0 ligne)
repo/packages/signature/.gitkeep                    (0 ligne)
repo/packages/pay/.gitkeep                          (0 ligne)
repo/packages/books/.gitkeep                        (0 ligne)
repo/packages/compliance/.gitkeep                   (0 ligne)
repo/packages/analytics/.gitkeep                    (0 ligne)
repo/packages/insure/.gitkeep                       (0 ligne)
repo/packages/repair/.gitkeep                       (0 ligne)
repo/packages/stock/.gitkeep                        (0 ligne)
repo/packages/hr/.gitkeep                           (0 ligne)
repo/packages/sky/.gitkeep                          (0 ligne)
repo/packages/sky-ui/.gitkeep                       (0 ligne)
repo/packages/assure-shared/.gitkeep                (0 ligne)
repo/packages/shared-types/.gitkeep                 (0 ligne)
repo/packages/shared-config/.gitkeep                (0 ligne)
repo/packages/shared-utils/.gitkeep                 (0 ligne)
repo/packages/shared-events/.gitkeep                (0 ligne)
repo/packages/shared-ui/.gitkeep                    (0 ligne)
repo/packages/shared-pwa/.gitkeep                   (0 ligne)
repo/packages/shared-maps/.gitkeep                  (0 ligne)
repo/infrastructure/docker/postgres/.gitkeep        (0 ligne)
repo/infrastructure/docker/redis/.gitkeep           (0 ligne)
repo/infrastructure/docker/kafka/.gitkeep           (0 ligne)
repo/infrastructure/docker/minio/.gitkeep           (0 ligne)
repo/infrastructure/scripts/.gitkeep                (0 ligne)
repo/infrastructure/observability/.gitkeep          (0 ligne)
repo/infrastructure/cloudflare/.gitkeep             (0 ligne)
repo/infrastructure/aws/.gitkeep                    (0 ligne)
repo/infrastructure/terraform/.gitkeep              (0 ligne)
repo/.github/workflows/.gitkeep                     (0 ligne)
repo/.husky/.gitkeep                                (0 ligne)
repo/.vscode/.gitkeep                               (0 ligne)
repo/docs/architecture/.gitkeep                     (0 ligne)
repo/docs/api/.gitkeep                              (0 ligne)
repo/docs/runbooks/.gitkeep                         (0 ligne)
repo/docs/security/.gitkeep                         (0 ligne)
repo/docs/pilote/.gitkeep                           (0 ligne)
repo/test/.gitkeep                                  (0 ligne)
repo/load-tests/.gitkeep                            (0 ligne)
repo/infrastructure/scripts/__tests__/structure.spec.ts          (~140 lignes / tests structure)
repo/infrastructure/scripts/__tests__/install-time.spec.ts        (~70 lignes / tests perf)
repo/infrastructure/scripts/__tests__/no-emoji-bootstrap.spec.ts  (~60 lignes / tests no-emoji)
```

Total : 53 fichiers de structure + 7 fichiers config racine + 3 fichiers de tests = 63 fichiers crees.

---

## 6. Code patterns COMPLETS

### 6.1 Fichier 1/10 : `repo/package.json`

Role : racine du monorepo. Definit les scripts orchestres qui delegueront a Turborepo, les devDependencies racine, le packageManager et engines, ainsi que le flag `private: true` pour empecher tout publish accidentel.

```json
{
  "name": "skalean-insurtech",
  "version": "2.2.0",
  "description": "Plateforme InsurTech Marocaine v2.2 -- 9 apps + 23 packages monorepo pnpm + Turborepo. Multi-tenant 3 niveaux (Platform / Customer Tenant / Assure). Conformite ACAPS + DGI + CNDP + AMC + Loi 43-20 signature electronique. Atlas Cloud Services Benguerir (souverainete Maroc).",
  "private": true,
  "license": "PROPRIETARY",
  "author": "Skalean SARL <contact@skalean.ma>",
  "homepage": "https://skalean-insurtech.ma",
  "repository": {
    "type": "git",
    "url": "git+ssh://git@github.com/skalean/insurtech.git"
  },
  "engines": {
    "node": ">=22.20.0 <23.0.0",
    "pnpm": ">=9.15.0 <10.0.0"
  },
  "packageManager": "pnpm@9.15.0",
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "dev": "turbo run dev --parallel --concurrency=15",
    "build": "turbo run build",
    "build:affected": "turbo run build --filter=...[origin/main]",
    "lint": "turbo run lint",
    "lint:fix": "turbo run lint:fix",
    "format": "biome format --write .",
    "format:check": "biome format --check .",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "test:watch": "turbo run test -- --watch",
    "test:coverage": "turbo run test -- --coverage",
    "test:e2e": "turbo run test:e2e",
    "test:integration": "turbo run test:integration",
    "test:structure": "vitest run infrastructure/scripts/__tests__/structure.spec.ts",
    "docker:up": "docker compose -f infrastructure/docker/docker-compose.dev.yaml up -d",
    "docker:down": "docker compose -f infrastructure/docker/docker-compose.dev.yaml down",
    "docker:reset": "docker compose -f infrastructure/docker/docker-compose.dev.yaml down -v && docker compose -f infrastructure/docker/docker-compose.dev.yaml up -d",
    "docker:logs": "docker compose -f infrastructure/docker/docker-compose.dev.yaml logs -f --tail=100",
    "docker:ps": "docker compose -f infrastructure/docker/docker-compose.dev.yaml ps",
    "bootstrap": "pnpm install --frozen-lockfile && pnpm typecheck && pnpm lint && echo 'Bootstrap completed'",
    "verify-env": "tsx infrastructure/scripts/verify-env.ts",
    "check-no-emoji": "bash infrastructure/scripts/check-no-emoji.sh",
    "clean": "turbo run clean && rm -rf node_modules .turbo",
    "clean:all": "pnpm clean && find . -name 'node_modules' -type d -prune -exec rm -rf {} + && find . -name '.turbo' -type d -prune -exec rm -rf {} + && find . -name 'dist' -type d -prune -exec rm -rf {} +",
    "prepare": "husky",
    "preinstall": "npx -y only-allow pnpm",
    "postinstall": "echo 'Run pnpm docker:up to start dev services'"
  },
  "devDependencies": {
    "@types/node": "22.10.5",
    "tsx": "4.19.2",
    "turbo": "2.4.0",
    "typescript": "5.7.3",
    "vitest": "2.1.8"
  },
  "pnpm": {
    "overrides": {},
    "peerDependencyRules": {
      "allowedVersions": {},
      "ignoreMissing": []
    }
  }
}
```

**Notes importantes** :
- `"private": true` empeche `pnpm publish` accidentel sur NPM (la racine n'est jamais publiee).
- `"engines.node": ">=22.20.0 <23.0.0"` couple a `engine-strict=true` dans `.npmrc` rejette tout install avec Node 18, 20 ou 23+.
- `"packageManager": "pnpm@9.15.0"` est lu par Corepack (Node natif) qui telecharge automatiquement la version exacte de pnpm si absente.
- `"preinstall": "npx -y only-allow pnpm"` est une defense en profondeur : si un developpeur tente `npm install` ou `yarn install`, le script echoue avec un message explicite recommandant pnpm.
- Les scripts `dev`, `build`, `lint`, `typecheck`, `test` deleguent a Turborepo via `turbo run <task>` et beneficient du graph parallele + cache.
- Le script `dev` utilise `--parallel --concurrency=15` pour lancer les 9 apps + watcher des packages partages simultanement (15 = marge confortable au dessus de 9+23=32 mais limite par CPU).
- Le script `bootstrap` est documente dans README et CONTRIBUTING comme la commande post-clone reference (1 commande pour amener un developpeur a un environnement valide).
- Aucune devDep applicative ici : `biome`, `husky`, `commitlint`, `lint-staged`, `@biomejs/biome` seront ajoutees dans les Taches 1.1.2 et 1.1.14 respectivement.
- Aucun field `main`, `module`, `types`, `exports` ici car la racine n'est pas un package consomme.

### 6.2 Fichier 2/10 : `repo/pnpm-workspace.yaml`

Role : declarer a pnpm les patterns de workspaces qui contiennent les packages locaux. Sans ce fichier, pnpm traite la racine comme un projet single-package classique et le pattern `workspace:*` n'est pas resolu.

```yaml
# pnpm Workspaces declaration -- Skalean InsurTech v2.2
# Reference: decision-001 (monorepo structure) + 10-arborescence-projet.md
# Toute modification doit etre suivie de `pnpm install --frozen-lockfile` pour valider la coherence du graph.
# Aucune emoji autorisee dans ce fichier (decision-006).

packages:
  # Applications deployables (9 apps v2.2)
  - 'apps/api'                          # Port 4000 -- NestJS 10.4 + Fastify backend unifie -- Sprint 3
  - 'apps/web-insurtech-admin'          # Port 3000 -- Admin Skalean Platform + MFA obligatoire -- Sprint 4 + 26
  - 'apps/web-broker'                   # Port 3001 -- SaaS B2B courtiers (Wafa, Atlanta, Saham, RMA) -- Sprint 16
  - 'apps/web-garage'                   # Port 3002 -- SaaS B2B garages chefs ateliers -- Sprint 22
  - 'apps/web-garage-mobile'            # Port 3003 -- PWA technicien atelier + WebAuthn biometric -- Sprint 23
  - 'apps/web-customer-portal'          # Port 3004 -- Prospects publics (SEO + ISR) -- Sprint 17
  - 'apps/web-assure-portal'            # Port 3005 -- Assures connectes desktop OTP -- Sprint 18
  - 'apps/web-assure-mobile'            # Port 3006 -- Assures PWA mobile + push -- Sprint 18
  - 'apps/mcp-server'                   # Port 4001 -- MCP server tools metier (NEW v2.2) -- Sprint 30

  # Packages metier (15 packages)
  - 'packages/auth'                     # Argon2id + JWT (jose) + MFA + WebAuthn + SSO -- Sprint 5
  - 'packages/database'                 # TypeORM 0.3 + entities + migrations + RLS subscribers -- Sprint 2
  - 'packages/crm'                      # Contacts + companies + deals + pipelines + interactions -- Sprint 8
  - 'packages/booking'                  # Rooms + appointments + calendar Google/Outlook -- Sprint 8
  - 'packages/comm'                     # WhatsApp + Email + templates 4 locales fr/ar-MA/ar/en -- Sprint 9
  - 'packages/docs'                     # S3 + PDF generator + access logs + KYC -- Sprint 10
  - 'packages/signature'                # Barid eSign + ANRT TSA RFC 3161 (loi 43-20) -- Sprint 10
  - 'packages/pay'                      # 6 passerelles MA (CMI, YouCan, PayZone, Inwi, Orange, M-Wallet BAM) -- Sprint 11
  - 'packages/books'                    # Plan CGNC + factures DGI + SAFT-MA + 5 taux TVA MA -- Sprint 12
  - 'packages/compliance'               # ACAPS + AMC + CNDP + audit reports -- Sprint 12
  - 'packages/analytics'                # ClickHouse OLAP + ETL + dashboards Grafana -- Sprint 13
  - 'packages/insure'                   # Vertical Broker (lifecycle police + connecteurs Sprint 32) -- Sprint 14-15
  - 'packages/repair'                   # Vertical Garage (sinistres + reparations + IA Sprint 20+29) -- Sprint 19-21
  - 'packages/stock'                    # Stock pieces + FIFO + alertes seuil -- Sprint 13
  - 'packages/hr'                       # Employees + paie CNSS + AMO + IR -- Sprint 13

  # Packages AI integration v2.2 (NEW)
  - 'packages/sky'                      # Agent Sky orchestrator + system prompts + MCP client -- Sprint 31
  - 'packages/sky-ui'                   # Chat widget shared 3 apps + streaming + voice-to-text -- Sprint 31

  # Packages shared (8 packages)
  - 'packages/assure-shared'            # Components shared web-assure-portal + mobile -- Sprint 18
  - 'packages/shared-types'             # Types globaux (Locale, Money, UUID branded) -- Sprint 1.1.13
  - 'packages/shared-config'            # Env loader Zod runtime validation -- Sprint 1.1.8
  - 'packages/shared-utils'             # Pino logger + Redis + S3 + helpers -- Sprint 1.1.5/7/12
  - 'packages/shared-events'            # Schemas Zod + publishers Kafka topics -- Sprint 2
  - 'packages/shared-ui'                # shadcn/ui + theme Sofidemy + layouts -- Sprint 4
  - 'packages/shared-pwa'               # Service worker Serwist + offline + push -- Sprint 18/23
  - 'packages/shared-maps'              # Wrapper Mapbox GL JS + geolocation hooks -- Sprint 17

# Verification : 9 apps + 23 packages = 32 entrees totales
# Commande de verification : pnpm list --depth=0 --json | jq '.[].name' | wc -l doit retourner >= 32
```

**Notes importantes** :
- L'ordre alphabetique au sein de chaque categorie n'est pas obligatoire mais ameliore la lisibilite des `git diff`.
- Les commentaires inline mentionnent le sprint d'implementation, ce qui aide tout developpeur arrivant a un sprint donne a comprendre le perimetre.
- Le terme "MCP" (Model Context Protocol) est conserve en majuscules car c'est l'acronyme officiel.
- Aucun glob `apps/*/package.json` car pnpm utilise les patterns dossiers (sans wildcard final), pas les patterns fichiers.

### 6.3 Fichier 3/10 : `repo/turbo.json`

Role : declarer le pipeline de tasks Turborepo avec dependances inter-tasks (`build` depend de `^build` des packages amont), inputs/outputs pour cache, et variables d'environnement qui invalident le cache.

```json
{
  "$schema": "https://turbo.build/schema.v2.json",
  "ui": "tui",
  "globalDependencies": [
    "tsconfig.base.json",
    "biome.json",
    ".npmrc",
    ".env",
    ".env.local",
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml"
  ],
  "globalEnv": [
    "NODE_ENV",
    "CI",
    "TURBO_TEAM",
    "TURBO_TOKEN"
  ],
  "globalPassThroughEnv": [
    "PATH",
    "HOME",
    "USER",
    "SHELL",
    "TERM",
    "TZ",
    "LC_ALL",
    "LANG"
  ],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": [
        "src/**/*.{ts,tsx,js,jsx,mjs,cjs}",
        "package.json",
        "tsconfig.json",
        "next.config.{js,mjs,ts}",
        "vite.config.{js,mjs,ts}",
        "tailwind.config.{js,mjs,ts}"
      ],
      "outputs": [
        "dist/**",
        "build/**",
        ".next/**",
        "!.next/cache/**"
      ],
      "env": ["NODE_ENV", "NEXT_PUBLIC_*"]
    },
    "dev": {
      "cache": false,
      "persistent": true,
      "dependsOn": ["^build"]
    },
    "lint": {
      "inputs": [
        "src/**/*.{ts,tsx,js,jsx,mjs,cjs}",
        "biome.json",
        "package.json"
      ],
      "outputs": [],
      "outputLogs": "new-only"
    },
    "lint:fix": {
      "cache": false,
      "inputs": [
        "src/**/*.{ts,tsx,js,jsx,mjs,cjs}",
        "biome.json"
      ]
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "inputs": [
        "src/**/*.{ts,tsx}",
        "tsconfig.json",
        "tsconfig.base.json"
      ],
      "outputs": ["**/*.tsbuildinfo"]
    },
    "test": {
      "dependsOn": ["^build"],
      "inputs": [
        "src/**/*.{ts,tsx,js,jsx}",
        "test/**/*.{ts,tsx,js,jsx}",
        "vitest.config.{js,mjs,ts}",
        "package.json"
      ],
      "outputs": ["coverage/**"],
      "env": [
        "NODE_ENV",
        "DATABASE_URL",
        "REDIS_URL",
        "KAFKA_BROKERS",
        "S3_ENDPOINT",
        "S3_ACCESS_KEY_ID",
        "S3_SECRET_ACCESS_KEY",
        "JWT_SECRET",
        "JWT_REFRESH_SECRET",
        "MFA_SECRET_ENCRYPTION_KEY"
      ]
    },
    "test:watch": {
      "cache": false,
      "persistent": true
    },
    "test:e2e": {
      "dependsOn": ["build"],
      "inputs": [
        "e2e/**/*.{ts,tsx}",
        "playwright.config.{js,mjs,ts}",
        "package.json"
      ],
      "outputs": [
        "playwright-report/**",
        "test-results/**"
      ],
      "env": [
        "NODE_ENV",
        "PLAYWRIGHT_BASE_URL",
        "PLAYWRIGHT_HEADLESS"
      ]
    },
    "test:integration": {
      "dependsOn": ["^build"],
      "inputs": [
        "src/**/*.{ts,tsx}",
        "test/integration/**/*.{ts,tsx}"
      ],
      "outputs": [],
      "env": [
        "DATABASE_URL",
        "REDIS_URL",
        "KAFKA_BROKERS"
      ]
    },
    "clean": {
      "cache": false
    }
  },
  "remoteCache": {
    "signature": true,
    "enabled": false
  }
}
```

**Notes importantes** :
- Le champ `"$schema"` permet a VSCode + IntelliJ de valider la syntaxe Turborepo automatiquement.
- `"globalDependencies"` est crucial : si `tsconfig.base.json` ou `biome.json` change, TOUT le cache est invalide pour eviter qu'un changement de regle TS soit ignore par cache stale.
- `"globalEnv"` : les variables qui modifient le comportement de toutes les tasks. `NODE_ENV` est ici car un build production differe d'un build dev.
- `"globalPassThroughEnv"` : les variables passees aux processus mais qui ne participent PAS au hash cache (PATH ne doit pas invalider cache car varie d'une machine a l'autre).
- `"build"` depend de `"^build"` (le `^` signifie "des dependances workspace amont") : avant de builder `apps/api`, il faut builder `packages/database`, `packages/auth`, etc.
- `"dev"` : `"cache": false` car un dev server est interactif, et `"persistent": true` pour que Turborepo sache que la task ne se termine pas.
- `"test"` declare explicitement les variables env qui doivent invalider le cache (DATABASE_URL change = re-test).
- `"remoteCache.enabled": false` en Sprint 1 : le remote cache Vercel sera active au Sprint 35 (decision pragmatique pour ne pas ajouter dependance externe trop tot).
- `"remoteCache.signature": true` est present meme avec `enabled: false` pour preparer Sprint 35 sans modification structurelle (HMAC SHA256 des artifacts).
- `"outputLogs": "new-only"` sur `lint` evite de re-afficher les logs identiques a chaque run cached.

### 6.4 Fichier 4/10 : `repo/.npmrc`

Role : configurer pnpm avec une politique stricte qui prevent les classes complete de bugs.

```ini
# pnpm Configuration -- Skalean InsurTech v2.2
# Reference: decision-001 (monorepo) + .npmrc spec : https://pnpm.io/npmrc
# Aucune emoji autorisee (decision-006).

# Auto-install peer dependencies
# True simplifie l'install (React + ReactDOM + Next.js peer auto). Repasser a false au Sprint 33 (pentest audit complet peerDeps).
auto-install-peers=true

# Save exact versions (1.2.3 au lieu de ^1.2.3)
# Indispensable pour reproductibilite cross-machine et CI deterministe.
save-exact=true

# Strict engines check
# Rejette pnpm install si Node version != engines.node de package.json.
# Couple avec engines.node "22.20.0" cela ferme la classe complete des bugs Node version drift.
engine-strict=true

# Link workspace packages deeply
# Permet workspace links symboliques meme dans deps transitives.
# Sans cela, @insurtech/auth dans @insurtech/insure dans apps/api ne resout pas correctement.
link-workspace-packages=deep

# Prefer workspace versions over registry
# Si un package @insurtech/X existe dans workspace ET sur registry, prefer workspace.
# Defense en profondeur contre le scenario : un package interne accidentellement publie NPM est installe par erreur.
prefer-workspace-packages=true

# Strict peer dependencies (false en Sprint 1 pour productivite)
# False permet install meme avec peerDeps mismatch warnings.
# Sera repasse a true au Sprint 33 pour audit complet.
strict-peer-dependencies=false

# Package import method
# hardlink = symlinks vers store global pnpm. Optimal espace disque + vitesse.
# Alternative copy = compatible Windows ancien / VirtualBox shared folders mais plus lent.
package-import-method=hardlink

# Dedupe peer dependents
# Reduit le size du store en deduplliquant les peerDeps quand possible.
dedupe-peer-dependents=true

# Resolve mode
# Resolve hoisted = traditionnel. Repasser a "resolve mode hoisted" au Sprint 33 pour audit.
# Pour Sprint 1, default suffit.
# resolve-mode=hoisted

# Network and registry
registry=https://registry.npmjs.org/
fetch-retries=5
fetch-retry-mintimeout=10000
fetch-retry-maxtimeout=60000
fetch-timeout=300000

# Side effects cache
# Indispensable pour Vite / Next.js qui ont side-effects build.
side-effects-cache=true
side-effects-cache-readonly=false

# Ignore workspace cycles
# False : pnpm rejette tout cycle de dependances entre workspaces.
# Discipline architecture : aucun cycle ne doit exister.
# Si un cycle est detecte, refactorer vers shared-types ou shared-utils.
ignore-workspace-cycles=false

# Verify store integrity (slow but safe in CI)
# CI = true via env, dev = false par defaut.
# verify-store-integrity=false

# Public hoist patterns (none -- discipline strict)
# Aucun package n'est hoiste a la racine sauf necessite. Force imports explicites.
public-hoist-pattern[]=

# Shamefully hoist (NEVER -- bug source)
# Toujours false. Active uniquement pour compatibilite npm legacy.
shamefully-hoist=false
```

**Notes importantes** :
- `engine-strict=true` est l'option qui differe le plus avec `npm` (qui n'honore pas `engines` par defaut). C'est la principale raison du choix pnpm.
- `link-workspace-packages=deep` permet a un package `apps/api` qui depend de `packages/insure` qui depend de `packages/database` de resoudre `packages/database` via symlink workspace (et non via registry).
- `shamefully-hoist=false` est crucial : true autorise le pattern de bug "phantom dependency" (utiliser un module non declare dans package.json mais present dans node_modules par accident).
- Les timeouts `fetch-*` sont generous (5 retries, 60s max) pour stabilite reseau Maroc (latence vers registries US/EU).

### 6.5 Fichier 5/10 : `repo/.nvmrc`

Role : declarer la version Node exacte attendue. Lu par `nvm`, `fnm`, `volta`.

```
22.20.0
```

**Notes importantes** :
- 1 ligne, pas de newline finale obligatoire mais recommandee.
- Doit matcher exactement `engines.node` de package.json racine pour eviter ambiguite.
- Decision pragmatique : 22.20.0 LTS jusqu'a avril 2027 (Node 22 LTS officielle), pas 24 latest car ecosysteme TypeORM, NestJS, Next.js encore en cours de validation 24.
- Le couple `(.nvmrc, package.json engines.node, .npmrc engine-strict=true)` est la triade de defense en profondeur contre Node version drift.

### 6.6 Fichier 6/10 : `repo/.gitignore`

Role : exclure les artifacts build, dependencies, env secrets, IDE state, OS metadata du Git tracking.

```gitignore
# Skalean InsurTech v2.2 -- .gitignore
# Reference: decision-001 (monorepo) + decision-006 (no-emoji).
# Aucune emoji dans ce fichier.

# ----------------------------------------------------------------------------
# Dependencies
# ----------------------------------------------------------------------------
node_modules/
.pnpm-store/
.yarn/
jspm_packages/

# ----------------------------------------------------------------------------
# Environment files (NEVER committed)
# ----------------------------------------------------------------------------
.env
.env.local
.env.*.local
.env.development
.env.production
.env.test
!.env.example
!.env.*.example

# ----------------------------------------------------------------------------
# Turborepo
# ----------------------------------------------------------------------------
.turbo/
.turbo-cache/

# ----------------------------------------------------------------------------
# Build outputs
# ----------------------------------------------------------------------------
dist/
build/
out/
.next/
.nuxt/
.svelte-kit/
.vite/

# TypeScript build info
*.tsbuildinfo
.tsbuildinfo/

# ----------------------------------------------------------------------------
# Test artifacts
# ----------------------------------------------------------------------------
coverage/
.nyc_output/
test-results/
playwright-report/
playwright/.cache/
.vitest-cache/
junit.xml

# ----------------------------------------------------------------------------
# Logs
# ----------------------------------------------------------------------------
*.log
npm-debug.log*
pnpm-debug.log*
yarn-debug.log*
yarn-error.log*
lerna-debug.log*
.pnpm-debug.log*

# Datadog / OpenTelemetry local exports
otel-traces/
*.trace

# ----------------------------------------------------------------------------
# Editors / IDEs
# ----------------------------------------------------------------------------
.vscode/_local/
.vscode/settings.local.json
.idea/
*.swp
*.swo
*~
.history/

# JetBrains
*.iml
.idea_modules/

# Sublime
*.sublime-project
*.sublime-workspace

# Vim
.netrwhist

# ----------------------------------------------------------------------------
# Operating systems
# ----------------------------------------------------------------------------
.DS_Store
.AppleDouble
.LSOverride
Icon
._*
.DocumentRevisions-V100
.fseventsd
.Spotlight-V100
.TemporaryItems
.Trashes
.VolumeIcon.icns
.com.apple.timemachine.donotpresent

Thumbs.db
ehthumbs.db
Desktop.ini
$RECYCLE.BIN/
*.lnk

# Linux
*~
.fuse_hidden*
.directory
.Trash-*
.nfs*

# ----------------------------------------------------------------------------
# Docker
# ----------------------------------------------------------------------------
docker-data/
.docker-data/
*.docker.local
.docker-volumes/

# ----------------------------------------------------------------------------
# Database
# ----------------------------------------------------------------------------
*.sqlite
*.sqlite3
*.db
pgdata/
mongo-data/

# ----------------------------------------------------------------------------
# Secrets / Keys (paranoid layer -- jamais committer)
# ----------------------------------------------------------------------------
*.pem
*.key
*.p12
*.pfx
*.crt
!ca-certificates/*.crt
secrets/
.secrets/
.aws/
.gcp/
service-account*.json

# ----------------------------------------------------------------------------
# Observability local
# ----------------------------------------------------------------------------
prometheus-data/
grafana-data/
loki-data/
tempo-data/

# ----------------------------------------------------------------------------
# Misc
# ----------------------------------------------------------------------------
.cache/
.parcel-cache/
.next/cache/
.firebase/
.serverless/
.fusebox/
.dynamodb/
.tern-port
.eslintcache
.stylelintcache

# Optional npm cache directory
.npm
.yarn-integrity

# Sentry
.sentryclirc

# ----------------------------------------------------------------------------
# Skalean InsurTech specifique
# ----------------------------------------------------------------------------
# Generated docs (Swagger, TypeDoc) -- regeneres en CI
docs/api/generated/
docs/typedoc/

# Pilote Marrakech (Sprint 35)
docs/pilote/_drafts/

# Local backups
*.bak
*.backup
backup-*/

# Custom scripts output
infrastructure/scripts/_output/
```

**Notes importantes** :
- L'ordre est strategique : node_modules en premier (le plus volumineux), .env en deuxieme (le plus sensible).
- `!.env.example` : exception explicite. `.env.example` DOIT etre committe (Tache 1.1.8).
- Section "Secrets / Keys" est paranoid : meme si jamais un developpeur ajoute par erreur un fichier `.pem`, Git le rejette.
- `docker-data/` exclu car les volumes persistents Docker (postgres, kafka, minio) creent des dossiers locaux pendant `pnpm docker:up`.
- Aucune emoji dans le fichier (verifie automatiquement par check-no-emoji.sh Tache 1.1.14).

### 6.7 Fichier 7/10 : `repo/.editorconfig`

Role : harmoniser l'encoding, line endings, indentation entre tous les editeurs (VSCode, IntelliJ, Vim, Sublime).

```ini
# EditorConfig -- Skalean InsurTech v2.2
# Reference: https://editorconfig.org/
# Aucune emoji autorisee (decision-006).

root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true
max_line_length = 100

[*.md]
trim_trailing_whitespace = false
max_line_length = off

[*.{yaml,yml}]
indent_size = 2

[*.{ts,tsx,js,jsx,mjs,cjs}]
indent_size = 2
quote_type = single

[*.json]
indent_size = 2

[*.sql]
indent_size = 4
keep_indents_on_empty_lines = true

[*.py]
indent_size = 4

[Makefile]
indent_style = tab

[*.{sh,bash}]
indent_size = 2
end_of_line = lf

[Dockerfile*]
indent_size = 2

[*.{html,css,scss}]
indent_size = 2
```

**Notes importantes** :
- `end_of_line = lf` UNIVERSEL (pas `crlf` Windows). Les developpeurs Windows doivent configurer Git `core.autocrlf = false` (documente CONTRIBUTING.md Tache 1.1.15).
- `*.md` : pas de trim trailing whitespace car certains markdown editors utilisent 2 trailing spaces pour line break.
- `Makefile` : indent_style = tab car Make exige des tabs (incompatible spaces).
- `*.sql` : indent_size = 4 par convention SQL (lisibilite des requetes complexes).

### 6.8 Fichier 8/10 : `repo/infrastructure/scripts/__tests__/structure.spec.ts`

Role : tests structure verifiant que les 9 apps + 23 packages + dossiers infrastructure sont bien presents apres execution de la tache.

```typescript
/**
 * Tests de structure -- Tache 1.1.1
 *
 * Verifie que la structure de dossiers monorepo est conforme a la specification :
 * - 9 apps presentes
 * - 23 packages presents (15 metier + 2 ai + 1 assure-shared + 7 shared = 25 mais on compte 23 packages distinct)
 * - 7 fichiers config racine presents et bien formes
 * - Pattern .gitkeep dans chaque dossier vide
 *
 * Reference : 00-pilotage/meta-prompts/B-01-sprint-01-bootstrap.md (Tache 1.1.1)
 *             00-pilotage/documentation/10-arborescence-projet.md
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

const REPO_ROOT = resolve(__dirname, '../../..');

const APPS_EXPECTED = [
  'api',
  'web-insurtech-admin',
  'web-broker',
  'web-garage',
  'web-garage-mobile',
  'web-customer-portal',
  'web-assure-portal',
  'web-assure-mobile',
  'mcp-server',
];

const PACKAGES_EXPECTED = [
  'auth',
  'database',
  'crm',
  'booking',
  'comm',
  'docs',
  'signature',
  'pay',
  'books',
  'compliance',
  'analytics',
  'insure',
  'repair',
  'stock',
  'hr',
  'sky',
  'sky-ui',
  'assure-shared',
  'shared-types',
  'shared-config',
  'shared-utils',
  'shared-events',
  'shared-ui',
  'shared-pwa',
  'shared-maps',
];

const ROOT_CONFIG_FILES = [
  'package.json',
  'pnpm-workspace.yaml',
  'turbo.json',
  '.npmrc',
  '.nvmrc',
  '.gitignore',
  '.editorconfig',
];

const INFRASTRUCTURE_DIRS = [
  'infrastructure/docker/postgres',
  'infrastructure/docker/redis',
  'infrastructure/docker/kafka',
  'infrastructure/docker/minio',
  'infrastructure/scripts',
  'infrastructure/observability',
  'infrastructure/cloudflare',
  'infrastructure/aws',
  'infrastructure/terraform',
];

const META_DIRS = [
  '.github/workflows',
  '.husky',
  '.vscode',
  'docs/architecture',
  'docs/api',
  'docs/runbooks',
  'docs/security',
  'docs/pilote',
  'test',
  'load-tests',
];

describe('Monorepo structure -- Tache 1.1.1', () => {
  describe('Apps directories', () => {
    it.each(APPS_EXPECTED)('should have apps/%s directory', (app) => {
      const appPath = join(REPO_ROOT, 'apps', app);
      expect(existsSync(appPath)).toBe(true);
      expect(statSync(appPath).isDirectory()).toBe(true);
    });

    it('should have exactly 9 apps directories', () => {
      const appsRoot = join(REPO_ROOT, 'apps');
      const { readdirSync } = require('node:fs');
      const actualApps = readdirSync(appsRoot, { withFileTypes: true })
        .filter((entry: any) => entry.isDirectory())
        .map((entry: any) => entry.name)
        .sort();
      expect(actualApps).toEqual([...APPS_EXPECTED].sort());
      expect(actualApps).toHaveLength(9);
    });
  });

  describe('Packages directories', () => {
    it.each(PACKAGES_EXPECTED)('should have packages/%s directory', (pkg) => {
      const pkgPath = join(REPO_ROOT, 'packages', pkg);
      expect(existsSync(pkgPath)).toBe(true);
      expect(statSync(pkgPath).isDirectory()).toBe(true);
    });

    it('should have at least 23 packages directories (15 metier + 2 ai + 1 assure-shared + 7 shared)', () => {
      const packagesRoot = join(REPO_ROOT, 'packages');
      const { readdirSync } = require('node:fs');
      const actualPackages = readdirSync(packagesRoot, { withFileTypes: true })
        .filter((entry: any) => entry.isDirectory())
        .map((entry: any) => entry.name);
      expect(actualPackages.length).toBeGreaterThanOrEqual(23);
    });
  });

  describe('Root configuration files', () => {
    it.each(ROOT_CONFIG_FILES)('should have %s file at repo root', (file) => {
      const filePath = join(REPO_ROOT, file);
      expect(existsSync(filePath)).toBe(true);
      expect(statSync(filePath).isFile()).toBe(true);
    });

    it('package.json should declare engines.node 22.20.0+', () => {
      const pkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf-8'));
      expect(pkg.engines?.node).toBeDefined();
      expect(pkg.engines.node).toMatch(/22\.20\.0|>=22\.20\.0/);
    });

    it('package.json should set packageManager pnpm@9.15.0', () => {
      const pkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf-8'));
      expect(pkg.packageManager).toMatch(/^pnpm@9\.15\.0$/);
    });

    it('package.json should be private (anti-publish)', () => {
      const pkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf-8'));
      expect(pkg.private).toBe(true);
    });

    it('package.json should declare workspaces apps/* and packages/*', () => {
      const pkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf-8'));
      expect(pkg.workspaces).toEqual(expect.arrayContaining(['apps/*', 'packages/*']));
    });

    it('.nvmrc should match package.json engines.node', () => {
      const nvmrc = readFileSync(join(REPO_ROOT, '.nvmrc'), 'utf-8').trim();
      expect(nvmrc).toBe('22.20.0');
    });

    it('.npmrc should enable engine-strict', () => {
      const npmrc = readFileSync(join(REPO_ROOT, '.npmrc'), 'utf-8');
      expect(npmrc).toMatch(/^engine-strict=true$/m);
    });

    it('.npmrc should enable save-exact', () => {
      const npmrc = readFileSync(join(REPO_ROOT, '.npmrc'), 'utf-8');
      expect(npmrc).toMatch(/^save-exact=true$/m);
    });

    it('.npmrc should enable link-workspace-packages=deep', () => {
      const npmrc = readFileSync(join(REPO_ROOT, '.npmrc'), 'utf-8');
      expect(npmrc).toMatch(/^link-workspace-packages=deep$/m);
    });

    it('.gitignore should exclude critical patterns', () => {
      const gitignore = readFileSync(join(REPO_ROOT, '.gitignore'), 'utf-8');
      const requiredPatterns = [
        'node_modules',
        '.env',
        '.turbo',
        'dist',
        '.next',
        'coverage',
        '*.tsbuildinfo',
      ];
      for (const pattern of requiredPatterns) {
        expect(gitignore).toContain(pattern);
      }
    });

    it('turbo.json should declare globalDependencies including tsconfig.base.json', () => {
      const turbo = JSON.parse(readFileSync(join(REPO_ROOT, 'turbo.json'), 'utf-8'));
      expect(turbo.globalDependencies).toEqual(
        expect.arrayContaining(['tsconfig.base.json', 'biome.json'])
      );
    });

    it('turbo.json should declare build, dev, lint, typecheck, test tasks', () => {
      const turbo = JSON.parse(readFileSync(join(REPO_ROOT, 'turbo.json'), 'utf-8'));
      const requiredTasks = ['build', 'dev', 'lint', 'typecheck', 'test'];
      for (const task of requiredTasks) {
        expect(turbo.tasks?.[task]).toBeDefined();
      }
    });

    it('pnpm-workspace.yaml should declare apps/* and packages/*', () => {
      const yaml = readFileSync(join(REPO_ROOT, 'pnpm-workspace.yaml'), 'utf-8');
      expect(yaml).toMatch(/['"]apps\/api['"]/);
      expect(yaml).toMatch(/['"]apps\/mcp-server['"]/);
      expect(yaml).toMatch(/['"]packages\/auth['"]/);
      expect(yaml).toMatch(/['"]packages\/database['"]/);
    });
  });

  describe('Infrastructure directories', () => {
    it.each(INFRASTRUCTURE_DIRS)('should have %s directory', (dir) => {
      const dirPath = join(REPO_ROOT, dir);
      expect(existsSync(dirPath)).toBe(true);
      expect(statSync(dirPath).isDirectory()).toBe(true);
    });
  });

  describe('Meta directories', () => {
    it.each(META_DIRS)('should have %s directory', (dir) => {
      const dirPath = join(REPO_ROOT, dir);
      expect(existsSync(dirPath)).toBe(true);
      expect(statSync(dirPath).isDirectory()).toBe(true);
    });
  });

  describe('No emoji in any committed file (decision-006)', () => {
    it('should not contain any emoji in package.json', () => {
      const content = readFileSync(join(REPO_ROOT, 'package.json'), 'utf-8');
      const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u;
      expect(content).not.toMatch(emojiRegex);
    });

    it('should not contain any emoji in turbo.json', () => {
      const content = readFileSync(join(REPO_ROOT, 'turbo.json'), 'utf-8');
      const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u;
      expect(content).not.toMatch(emojiRegex);
    });

    it('should not contain any emoji in .gitignore', () => {
      const content = readFileSync(join(REPO_ROOT, '.gitignore'), 'utf-8');
      const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u;
      expect(content).not.toMatch(emojiRegex);
    });

    it('should not contain any emoji in pnpm-workspace.yaml', () => {
      const content = readFileSync(join(REPO_ROOT, 'pnpm-workspace.yaml'), 'utf-8');
      const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u;
      expect(content).not.toMatch(emojiRegex);
    });
  });
});
```

**Notes importantes** :
- `it.each` Vitest permet de generer dynamiquement un test par item (9 tests apps, 23 tests packages, etc.).
- Les regex emoji couvrent les ranges Unicode `1F300-1F9FF` (Misc symbols/pictographs/emoticons), `2600-27BF` (Dingbats/Misc symbols), `1F1E6-1F1FF` (Regional indicator/flags).
- Le test ne valide pas le contenu fonctionnel des dossiers (vide a ce stade) mais leur existence.
- `readFileSync(..., 'utf-8')` est crucial : sans 'utf-8', readFileSync retourne un Buffer.

### 6.9 Fichier 9/10 : `repo/infrastructure/scripts/__tests__/install-time.spec.ts`

Role : test de performance verifiant que `pnpm install --frozen-lockfile` reste sous 90 secondes.

```typescript
/**
 * Test performance install -- Tache 1.1.1 V1
 *
 * Verifie que pnpm install --frozen-lockfile s'execute en moins de 90 secondes
 * sur une machine 8 GB RAM avec lockfile valide.
 *
 * Test integration : SKIP par defaut, RUN explicitement via:
 *   pnpm vitest run infrastructure/scripts/__tests__/install-time.spec.ts --include
 *
 * Reference : 00-pilotage/meta-prompts/B-01-sprint-01-bootstrap.md (V1 Tache 1.1.1)
 */

import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

const REPO_ROOT = resolve(__dirname, '../../..');
const INSTALL_TIMEOUT_SECONDS = 90;
const SKIP_INTEGRATION = process.env.SKIP_INTEGRATION === 'true';

describe.skipIf(SKIP_INTEGRATION)('pnpm install --frozen-lockfile performance', () => {
  it(
    `should complete in under ${INSTALL_TIMEOUT_SECONDS}s on 8GB RAM machine`,
    () => {
      const startTime = Date.now();

      try {
        execSync('pnpm install --frozen-lockfile --prefer-offline', {
          cwd: REPO_ROOT,
          stdio: 'pipe',
          timeout: (INSTALL_TIMEOUT_SECONDS + 30) * 1000,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`pnpm install failed: ${message}`);
      }

      const durationSeconds = (Date.now() - startTime) / 1000;
      console.log(`pnpm install completed in ${durationSeconds.toFixed(2)}s`);
      expect(durationSeconds).toBeLessThanOrEqual(INSTALL_TIMEOUT_SECONDS);
    },
    { timeout: (INSTALL_TIMEOUT_SECONDS + 60) * 1000 }
  );

  it('should be deterministic (same lockfile after second install)', () => {
    const lockfileBefore = execSync(
      'shasum pnpm-lock.yaml',
      { cwd: REPO_ROOT, encoding: 'utf-8' }
    );

    execSync('pnpm install --frozen-lockfile --prefer-offline', {
      cwd: REPO_ROOT,
      stdio: 'pipe',
    });

    const lockfileAfter = execSync(
      'shasum pnpm-lock.yaml',
      { cwd: REPO_ROOT, encoding: 'utf-8' }
    );

    expect(lockfileAfter).toBe(lockfileBefore);
  });

  it('should fail if Node version mismatches engines.node', () => {
    expect(() => {
      execSync('pnpm install --frozen-lockfile --use-node-version=18.0.0', {
        cwd: REPO_ROOT,
        stdio: 'pipe',
      });
    }).toThrow();
  });
});
```

**Notes importantes** :
- `describe.skipIf(SKIP_INTEGRATION)` permet de skipper en CI standard et n'executer ce test que sur runner dedie performance.
- Le test 2 verifie le determinisme du lockfile (point critique reproductibilite cross-machine).
- Le test 3 verifie que `engine-strict=true` rejette bien Node 18 (reproduit en runtime via `--use-node-version=18.0.0`).
- Timeout total = 90 + 60 = 150s pour permettre setup et teardown.

### 6.10 Fichier 10/10 : `repo/infrastructure/scripts/__tests__/no-emoji-bootstrap.spec.ts`

Role : verifier qu'aucune emoji n'a ete introduite dans les fichiers livres par cette tache.

```typescript
/**
 * Test no-emoji bootstrap -- Tache 1.1.1 V10
 *
 * Verifie que decision-006 (no-emoji policy ABSOLU) est respectee
 * dans tous les fichiers livres par la Tache 1.1.1.
 *
 * Reference : 00-pilotage/decisions/006-no-emoji-policy.md
 *             00-pilotage/meta-prompts/B-01-sprint-01-bootstrap.md (V10)
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const REPO_ROOT = resolve(__dirname, '../../..');

const FILES_TO_CHECK = [
  'package.json',
  'pnpm-workspace.yaml',
  'turbo.json',
  '.npmrc',
  '.nvmrc',
  '.gitignore',
  '.editorconfig',
];

const EMOJI_RANGES = [
  /[\u{1F300}-\u{1F5FF}]/u,
  /[\u{1F600}-\u{1F64F}]/u,
  /[\u{1F680}-\u{1F6FF}]/u,
  /[\u{1F700}-\u{1F77F}]/u,
  /[\u{1F780}-\u{1F7FF}]/u,
  /[\u{1F800}-\u{1F8FF}]/u,
  /[\u{1F900}-\u{1F9FF}]/u,
  /[\u{1FA00}-\u{1FA6F}]/u,
  /[\u{1FA70}-\u{1FAFF}]/u,
  /[\u{2600}-\u{26FF}]/u,
  /[\u{2700}-\u{27BF}]/u,
  /[\u{1F1E6}-\u{1F1FF}]/u,
];

const COMBINED_EMOJI_REGEX =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u;

function findEmoji(content: string): { hasEmoji: boolean; matches: string[]; positions: number[] } {
  const matches: string[] = [];
  const positions: number[] = [];
  for (let i = 0; i < content.length; i++) {
    const char = content.codePointAt(i);
    if (char === undefined) continue;
    if (
      (char >= 0x1f300 && char <= 0x1faff) ||
      (char >= 0x2600 && char <= 0x27bf) ||
      (char >= 0x1f1e6 && char <= 0x1f1ff)
    ) {
      matches.push(String.fromCodePoint(char));
      positions.push(i);
    }
  }
  return { hasEmoji: matches.length > 0, matches, positions };
}

describe('No-emoji policy (decision-006) -- Tache 1.1.1', () => {
  it.each(FILES_TO_CHECK)('should have no emoji in %s', (file) => {
    const filePath = join(REPO_ROOT, file);
    const content = readFileSync(filePath, 'utf-8');
    const result = findEmoji(content);
    if (result.hasEmoji) {
      console.error(
        `Emoji detected in ${file} at positions ${result.positions.join(', ')}: ${result.matches.join(', ')}`
      );
    }
    expect(result.hasEmoji).toBe(false);
    expect(result.matches).toHaveLength(0);
  });

  it('should detect emoji correctly when present (test self-validation)', () => {
    const sampleContent = 'Hello world';
    const result = findEmoji(sampleContent);
    expect(result.hasEmoji).toBe(false);

    const emojiContent = 'Hello world 👋';
    const emojiResult = findEmoji(emojiContent);
    expect(emojiResult.hasEmoji).toBe(true);
    expect(emojiResult.matches).toHaveLength(1);
  });

  it('should validate combined regex matches each range individually', () => {
    const ranges = ['\u{1F600}', '\u{1F44B}', '\u{2600}', '\u{1F1FA}'];
    for (const ch of ranges) {
      expect(COMBINED_EMOJI_REGEX.test(ch)).toBe(true);
    }
  });

  it('should not flag standard ASCII or extended Latin', () => {
    const safeContent = 'abcdef ABCDEF 0123456789 ąćęłńóśźż éèêë àâ ñ';
    const result = findEmoji(safeContent);
    expect(result.hasEmoji).toBe(false);
  });
});
```

**Notes importantes** :
- La fonction `findEmoji` est une implementation qui retourne le detail (matches + positions) pour faciliter le debug en cas d'echec.
- Le test "should detect emoji correctly" est une auto-validation : si le test self-test passe avec emoji, la fonction est correcte.
- Les caracteres latins etendus (accentues, polonais, etc.) ne doivent JAMAIS etre flagues comme emoji.

---

## 7. Tests complets

### 7.1 Tests unitaires : `repo/infrastructure/scripts/__tests__/structure.spec.ts`

Voir section 6.8 ci-dessus (140 lignes, 17 tests it dont 9+23 it.each).

### 7.2 Tests integration : `repo/infrastructure/scripts/__tests__/install-time.spec.ts`

Voir section 6.9 ci-dessus (70 lignes, 3 tests).

### 7.3 Tests no-emoji : `repo/infrastructure/scripts/__tests__/no-emoji-bootstrap.spec.ts`

Voir section 6.10 ci-dessus (60 lignes, 4+7 tests it.each).

### 7.4 Tests E2E (non applicable Sprint 1.1.1 -- pas d'app deployee)

Sera applique des Tache 1.1.10 (CI) avec Playwright invoque sur app stub.

### 7.5 Fixtures et mocks

Aucune fixture metier requise pour cette tache (purement structurelle). Les mocks seront introduits a partir de la Tache 1.1.5 (Redis client) avec ioredis-mock.

### 7.6 Smoke tests bash inline (executables manuellement)

```bash
#!/usr/bin/env bash
# infrastructure/scripts/_smoke-test-bootstrap.sh -- a copier dans CONTRIBUTING.md
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

echo "=== Smoke test 1 : pnpm install ==="
time pnpm install --frozen-lockfile --prefer-offline

echo "=== Smoke test 2 : turbo version ==="
TURBO_VERSION=$(pnpm dlx turbo --version | awk '{print $1}')
echo "Turbo version: $TURBO_VERSION"
[[ "$TURBO_VERSION" =~ ^2\.[4-9] ]] || { echo "FAIL: turbo version $TURBO_VERSION < 2.4"; exit 1; }

echo "=== Smoke test 3 : structure 9 apps ==="
APPS_COUNT=$(find apps -maxdepth 1 -mindepth 1 -type d | wc -l)
[[ "$APPS_COUNT" == "9" ]] || { echo "FAIL: $APPS_COUNT apps found, expected 9"; exit 1; }

echo "=== Smoke test 4 : structure 23+ packages ==="
PACKAGES_COUNT=$(find packages -maxdepth 1 -mindepth 1 -type d | wc -l)
[[ "$PACKAGES_COUNT" -ge "23" ]] || { echo "FAIL: $PACKAGES_COUNT packages found, expected >= 23"; exit 1; }

echo "=== Smoke test 5 : .npmrc engine-strict ==="
grep -q "^engine-strict=true$" .npmrc || { echo "FAIL: engine-strict not enabled"; exit 1; }

echo "=== Smoke test 6 : .nvmrc matches ==="
NVMRC=$(cat .nvmrc | tr -d '[:space:]')
[[ "$NVMRC" == "22.20.0" ]] || { echo "FAIL: .nvmrc is $NVMRC, expected 22.20.0"; exit 1; }

echo "=== Smoke test 7 : no emoji bootstrap files ==="
for f in package.json pnpm-workspace.yaml turbo.json .npmrc .nvmrc .gitignore .editorconfig; do
  if grep -P "[\x{1F300}-\x{1FAFF}]|[\x{2600}-\x{27BF}]|[\x{1F1E6}-\x{1F1FF}]" "$f" 2>/dev/null; then
    echo "FAIL: emoji detected in $f"
    exit 1
  fi
done

echo "=== ALL SMOKE TESTS PASSED ==="
```

---

## 8. Variables environnement

Aucune variable env nouvelle introduite par la Tache 1.1.1 (purement structurel). La structure prevoit cependant que les variables suivantes seront introduites dans les Taches 1.1.3 et 1.1.8 :

```env
# === Variables introduites par Tache 1.1.3 (Docker Compose) ===
# Postgres
POSTGRES_USER=skalean
POSTGRES_PASSWORD=skalean_dev_only_change_in_prod
POSTGRES_DB=skalean_insurtech
POSTGRES_PORT=5432

# Redis
REDIS_PASSWORD=skalean_redis_dev_only
REDIS_PORT=6379

# Kafka
KAFKA_PORT=9094
KAFKA_UI_PORT=8080

# MinIO
MINIO_ROOT_USER=skalean
MINIO_ROOT_PASSWORD=skalean_minio_dev_only
MINIO_PORT=9000
MINIO_CONSOLE_PORT=9001

# Mailhog
MAILHOG_SMTP_PORT=1025
MAILHOG_UI_PORT=8025

# n8n
N8N_PORT=5678
N8N_BASIC_AUTH_USER=skalean
N8N_BASIC_AUTH_PASSWORD=skalean_n8n_dev_only

# === Variables introduites par Tache 1.1.8 (shared-config) ===
# Runtime
NODE_ENV=development
APP_VERSION=2.2.0
API_PORT=4000
LOG_LEVEL=info
TZ=Africa/Casablanca

# Database
DATABASE_URL=postgresql://skalean:skalean_dev_only_change_in_prod@localhost:5432/skalean_insurtech
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=20
DATABASE_LOG=false

# Redis
REDIS_URL=redis://:skalean_redis_dev_only@localhost:6379

# Kafka
KAFKA_BROKERS=localhost:9094
KAFKA_CLIENT_ID=skalean-insurtech
KAFKA_GROUP_ID=skalean-insurtech-default

# S3
S3_ENDPOINT=http://localhost:9000
S3_REGION=ma-bgr-1
S3_ACCESS_KEY_ID=skalean
S3_SECRET_ACCESS_KEY=skalean_minio_dev_only
S3_FORCE_PATH_STYLE=true

# Auth (introduites Sprint 5)
JWT_SECRET=replace-with-32-char-minimum-secret-dev-only-not-prod-grade
JWT_REFRESH_SECRET=replace-with-32-char-minimum-refresh-secret-dev-only-not-prod
MFA_SECRET_ENCRYPTION_KEY=replace-with-32-char-minimum-mfa-encryption-key-dev-only

# Sentry (optional)
SENTRY_DSN=

# OpenTelemetry (optional)
OTEL_EXPORTER_OTLP_ENDPOINT=
OTEL_DEBUG=false

# Skalean AI (Sprint 29+)
SKALEAN_AI_BASE_URL=http://localhost:9999/mock
SKALEAN_AI_API_KEY=mock-key-replaced-sprint-29
SKALEAN_AI_USE_MOCK=true
```

---

## 9. Commandes shell

```bash
# === Sequence d'execution complete Tache 1.1.1 ===

# Etape 0 : prerequis
node --version  # doit retourner v22.20.0 (sinon nvm use)
which pnpm     # doit etre disponible
pnpm --version  # doit retourner 9.15.0

# Etape 1 : creation du dossier repo
mkdir -p repo
cd repo
git init
git config core.autocrlf false  # IMPORTANT pour Windows

# Etape 2 : creation des fichiers config racine (manuellement ou via outil)
# package.json, pnpm-workspace.yaml, turbo.json, .npmrc, .nvmrc, .gitignore, .editorconfig
# (voir section 6 ci-dessus pour contenu exact)

# Etape 3 : creation de la structure dossiers
mkdir -p apps/{api,web-insurtech-admin,web-broker,web-garage,web-garage-mobile,web-customer-portal,web-assure-portal,web-assure-mobile,mcp-server}
mkdir -p packages/{auth,database,crm,booking,comm,docs,signature,pay,books,compliance,analytics,insure,repair,stock,hr,sky,sky-ui,assure-shared,shared-types,shared-config,shared-utils,shared-events,shared-ui,shared-pwa,shared-maps}
mkdir -p infrastructure/{docker/{postgres,redis,kafka,minio},scripts,observability,cloudflare,aws,terraform}
mkdir -p .github/workflows .husky .vscode
mkdir -p docs/{architecture,api,runbooks,security,pilote}
mkdir -p test load-tests

# Etape 4 : ajout placeholders .gitkeep dans chaque dossier vide
find apps packages infrastructure .github .husky .vscode docs test load-tests -type d -empty -exec touch {}/.gitkeep \;

# Etape 5 : tests structure
pnpm install --frozen-lockfile

# Etape 6 : verification structure
ls apps/ | wc -l                    # doit retourner 9
ls packages/ | wc -l                 # doit retourner 25 (23+ acceptable)
pnpm dlx turbo --version             # doit retourner 2.4.x

# Etape 7 : verification typecheck
pnpm typecheck                       # doit retourner exit 0 (vide mais valide)

# Etape 8 : tests vitest structure
pnpm vitest run infrastructure/scripts/__tests__/structure.spec.ts

# Etape 9 : verification no-emoji
pnpm vitest run infrastructure/scripts/__tests__/no-emoji-bootstrap.spec.ts

# Etape 10 : commit initial
git add -A
git commit -m "feat(sprint-01): init monorepo pnpm 9.15 + Turborepo 2.4 structure 9 apps + 25 packages

Initialise la fondation outillage du monorepo Skalean InsurTech v2.2 :
- package.json racine avec scripts orchestres et engines.node 22.20.0
- pnpm-workspace.yaml declarant 9 apps + 25 packages workspaces
- turbo.json pipeline tasks build/dev/lint/typecheck/test
- .npmrc avec engine-strict + save-exact + link-workspace-packages=deep
- .nvmrc 22.20.0 + .gitignore exhaustif + .editorconfig universel
- Structure dossiers complete (apps/* packages/* infrastructure/* docs/* etc.)

Livrables: 7 fichiers config racine + 53 dossiers structure + 3 tests structure
Tests: 17 tests structure + 3 tests integration install-time + 4 tests no-emoji = 24 tests

Task: 1.1.1
Sprint: 1 (Phase 1 / Sprint 1)
Phase: 1 -- Bootstrap Infrastructure
Reference: B-01 Tache 1.1.1"
```

---

## 10. Criteres validation V1-V28

### 10.1 Criteres P0 (bloquants -- 16 criteres)

- **V1 (P0 -- automatisable)** : `pnpm install --frozen-lockfile` reussit en moins de 90 secondes sur machine 8 GB RAM avec `pnpm-lock.yaml` deja committe.
  - Commande : `time pnpm install --frozen-lockfile --prefer-offline`
  - Expected : `real < 90s`, exit code 0, dossier `node_modules/` cree avec symlinks `@insurtech/*`
  - Failure mode : si > 90s, executer `pnpm store prune` pour nettoyer cache corrompu, verifier connexion reseau, exclure node_modules de l'antivirus Windows Defender

- **V2 (P0 -- automatisable)** : `pnpm dlx turbo --version` retourne semver >= 2.4.0
  - Commande : `pnpm dlx turbo --version | awk '{print $1}'`
  - Expected : version semver >= 2.4.0 (par exemple `2.4.0`, `2.4.1`)
  - Failure mode : version trop vieille `pnpm update turbo --latest` puis verifier package.json devDeps

- **V3 (P0 -- automatisable)** : Structure 9 apps presente.
  - Commande : `find apps -maxdepth 1 -mindepth 1 -type d | wc -l`
  - Expected : 9
  - Liste exacte attendue : `api, web-insurtech-admin, web-broker, web-garage, web-garage-mobile, web-customer-portal, web-assure-portal, web-assure-mobile, mcp-server`
  - Failure mode : un dossier manque, executer `mkdir apps/<nom-manquant>` puis `touch apps/<nom-manquant>/.gitkeep`

- **V4 (P0 -- automatisable)** : Structure 23+ packages presente.
  - Commande : `find packages -maxdepth 1 -mindepth 1 -type d | wc -l`
  - Expected : >= 23 (idealement 25 selon liste exacte du `pnpm-workspace.yaml`)
  - Liste exacte 25 packages : voir section 6.2 ou 8.1 du B-01
  - Failure mode : voir V3

- **V5 (P0)** : `engine-strict=true` rejette install si Node version mismatch.
  - Test : telecharger Node 18 via nvm, executer `nvm use 18 && pnpm install --frozen-lockfile`
  - Expected : exit non-zero, message `Unsupported engine` ou `EBADENGINE`
  - Failure mode : verifier `.npmrc` contient bien `engine-strict=true` et `package.json` declare `"engines.node": ">=22.20.0"`

- **V6 (P0 -- automatisable)** : `pnpm typecheck` reussit (vide mais valide).
  - Commande : `pnpm typecheck`
  - Expected : exit 0, output `>>> Tasks: 0 successful, 0 total` (aucune task car packages stubs vides)
  - Failure mode : verifier `tsconfig.base.json` n'est pas mal configure (sera Tache 1.1.2)

- **V7 (P0 -- automatisable)** : Tous les fichiers config racine sont presents.
  - Commande : `for f in package.json pnpm-workspace.yaml turbo.json .npmrc .nvmrc .gitignore .editorconfig; do test -f "$f" || echo "MISSING $f"; done`
  - Expected : aucune sortie (silence = succes)
  - Failure mode : recreer fichier manquant via section 6 du present prompt

- **V8 (P0 -- automatisable)** : `.gitignore` contient au minimum 8 patterns critiques.
  - Patterns obligatoires : `node_modules`, `.env`, `.turbo`, `dist`, `.next`, `coverage`, `test-results`, `*.tsbuildinfo`
  - Commande : `for p in node_modules .env .turbo dist .next coverage test-results "*.tsbuildinfo"; do grep -qF "$p" .gitignore || echo "MISSING $p"; done`
  - Expected : aucune sortie

- **V9 (P0 -- automatisable)** : Tests structure passent.
  - Commande : `pnpm vitest run infrastructure/scripts/__tests__/structure.spec.ts`
  - Expected : 17 tests PASS, 0 FAIL

- **V10 (P0 -- automatisable)** : Aucune emoji dans les fichiers livres.
  - Commande : `pnpm vitest run infrastructure/scripts/__tests__/no-emoji-bootstrap.spec.ts`
  - Expected : 11 tests PASS (4 it.each + 4 assertions specifiques)
  - Failure mode : VIOLATION decision-006 = nettoyer immediatement le fichier concerne

- **V11 (P0)** : `pnpm install` est deterministique (lockfile coherent entre 2 runs).
  - Test : `shasum pnpm-lock.yaml > /tmp/before && pnpm install --frozen-lockfile && shasum pnpm-lock.yaml > /tmp/after && diff /tmp/before /tmp/after`
  - Expected : aucune sortie de `diff` (lockfile identique)

- **V12 (P0)** : Cache Turborepo fonctionne.
  - Test : `pnpm typecheck && pnpm typecheck`
  - Expected : second run retourne `>>> Tasks: 0 successful, 0 total, 0 cached`, message `cache HIT` ou `cache hit, replaying logs`
  - Failure mode : verifier `.turbo/` existe, verifier `globalDependencies` dans turbo.json

- **V13 (P0 -- automatisable)** : Aucun fichier code TypeScript ou JavaScript hors devDeps.
  - Commande : `find apps packages -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" 2>/dev/null | grep -v node_modules | wc -l`
  - Expected : 0 (Tache 1.1.1 livre uniquement structure, pas de code)

- **V14 (P0)** : `package.json` declare `engines.node` correct.
  - Commande : `node -e "const p = require('./package.json'); console.log(p.engines.node)"`
  - Expected : output contient `22.20.0`

- **V15 (P0)** : `package.json` declare `packageManager` correct.
  - Commande : `node -e "const p = require('./package.json'); console.log(p.packageManager)"`
  - Expected : `pnpm@9.15.0`

- **V16 (P0)** : `package.json` est private (anti-publish).
  - Commande : `node -e "const p = require('./package.json'); console.log(p.private)"`
  - Expected : `true`

### 10.2 Criteres P1 (importants -- 8 criteres)

- **V17 (P1)** : Cache turbo invalide correctement quand `tsconfig.base.json` modifie.
  - Test : `pnpm typecheck && touch tsconfig.base.json && pnpm typecheck`
  - Expected : second run NE retourne PAS cache hit
  - Failure mode : verifier `globalDependencies` dans turbo.json contient `"tsconfig.base.json"`

- **V18 (P1)** : `pnpm typecheck` retourne stats Turbo (cache hits/misses).
  - Expected : output contient `>>> Tasks: ... cached`

- **V19 (P1)** : `.editorconfig` respecte par tous fichiers config.
  - Test : ouvrir `package.json` dans VSCode et verifier indentation 2 spaces, EOL LF, charset UTF-8

- **V20 (P1)** : Tous les `package.json` workspace seront `name: "@insurtech/..."` (verifie Tache 1.1.13)
  - Pour Sprint 1.1.1 : aucun package.json workspace existant donc test reporte

- **V21 (P1)** : `.nvmrc` aligne avec `engines.node`.
  - Commande : `cat .nvmrc | tr -d '\n' | tr -d '[:space:]'`
  - Expected : `22.20.0`

- **V22 (P1)** : `pnpm typecheck` execute en moins de 5 secondes (warm cache).
  - Test : second run apres premier
  - Expected : duration < 5s

- **V23 (P1)** : `pnpm install` ne tente pas de reach NPM registry pour les workspace packages.
  - Test : `pnpm install --offline` (apres install initial)
  - Expected : exit 0
  - Failure mode : si echec, `link-workspace-packages=deep` n'est pas actif

- **V24 (P1)** : Tests integration install-time passent (skipIf SKIP_INTEGRATION).
  - Commande : `SKIP_INTEGRATION=false pnpm vitest run infrastructure/scripts/__tests__/install-time.spec.ts`
  - Expected : 3 tests PASS

### 10.3 Criteres P2 (nice-to-have -- 5 criteres)

- **V25 (P2)** : Documentation README racine documente quick start (sera Tache 1.1.15).
  - Reporte a Tache 1.1.15

- **V26 (P2)** : Documentation `docs/architecture/` contient au moins 6 ADR (sera Tache 1.1.15).
  - Reporte a Tache 1.1.15

- **V27 (P2)** : Turbo Remote Cache pret pour activation Sprint 35.
  - Test : `cat turbo.json | jq '.remoteCache'`
  - Expected : `{ "signature": true, "enabled": false }`

- **V28 (P2)** : `pnpm clean` nettoie completement.
  - Test : `pnpm clean && pnpm install --frozen-lockfile`
  - Expected : reussit sans erreur, lockfile inchange

- **V29 (P2)** : Volta configure (optional).
  - Test : `cat package.json | jq '.volta'`
  - Expected : optionnel mais recommande pour pin Node + pnpm cross-machine

---

## 11. Edge cases + troubleshooting

### Edge case 1 : `pnpm install` echec avec `EBUSY: resource busy or locked` sur Windows

**Scenario** : un developpeur Windows execute `pnpm install` alors qu'un editeur (VSCode) ou un terminal a un fichier ouvert dans `node_modules/`.
**Probleme** : Windows verrouille les fichiers ouverts, pnpm ne peut pas reecrire les symlinks.
**Solution** :
1. Fermer tous les editeurs et terminaux
2. Executer `pnpm install --force` qui ignore les fichiers verrouilles non critiques
3. Si persiste, redemarrer Windows et re-executer
4. En dernier recours : `rm -rf node_modules && pnpm install`

### Edge case 2 : Antivirus Windows Defender ralentit `pnpm install` au-dessus de 90s

**Scenario** : install sur Windows depasse les 90s a cause du scan systematique de chaque fichier extrait du store pnpm.
**Probleme** : 100k+ fichiers post-install, scanned individuellement.
**Solution** :
1. Ouvrir "Windows Security" > "Virus & threat protection" > "Manage settings" > "Add or remove exclusions"
2. Ajouter exclusions :
   - Dossier : `C:\Users\<user>\AppData\Local\pnpm`
   - Dossier : le path complet du repo `repo/`
3. Re-executer `pnpm install` -- doit etre < 90s
4. Documenter dans CONTRIBUTING.md (Tache 1.1.15)

### Edge case 3 : `engine-strict=true` rejette install meme avec Node 22.20.0 si lockfile a ete genere avec Node different

**Scenario** : un developpeur a genere `pnpm-lock.yaml` avec Node 18, un autre tente install avec Node 22.20.0.
**Probleme** : la version Node embedded dans certains fields du lockfile peut creer un conflict.
**Solution** :
1. Supprimer `pnpm-lock.yaml`
2. Re-executer `pnpm install` (sans `--frozen-lockfile`) avec Node 22.20.0
3. Committer le nouveau lockfile
4. Eviter la regeneration future en imposant `.nvmrc` + `engine-strict=true` strict

### Edge case 4 : Workspace package not found `@insurtech/auth not found` lors d'un Tache 1.1.13 stub install

**Scenario** : un package workspace declare `@insurtech/auth: workspace:*` mais le dossier `packages/auth` est vide (pas de `package.json`).
**Probleme** : pnpm ne peut pas resoudre le workspace symlink sans `package.json`.
**Solution** :
1. Verifier que la Tache 1.1.13 a bien cree un `packages/auth/package.json` minimal avec `"name": "@insurtech/auth"`
2. Si non, executer manuellement le script `infrastructure/scripts/init-package-stubs.sh` (genere Tache 1.1.13)
3. Re-executer `pnpm install`

### Edge case 5 : Cache Turborepo retourne stale results apres mise a jour `tsconfig.base.json`

**Scenario** : un developpeur modifie `tsconfig.base.json` (par exemple ajoute `noImplicitOverride: true`) mais `pnpm typecheck` retourne cache hit.
**Probleme** : `globalDependencies` n'inclut pas `tsconfig.base.json` dans le hash cache.
**Solution** :
1. Verifier `turbo.json` field `globalDependencies` contient bien `"tsconfig.base.json"`
2. Si oui, executer `pnpm dlx turbo daemon restart` pour reset le daemon (parfois corrompu)
3. En dernier recours : `rm -rf .turbo && pnpm typecheck`

### Edge case 6 : Husky `prepare` script echoue lors de install initial dans CI

**Scenario** : la CI execute `pnpm install --frozen-lockfile` mais `prepare` echoue car `.husky/` n'existe pas encore.
**Probleme** : `prepare: husky` tente d'installer hooks Git mais Husky n'est pas encore declare en devDep (il sera installe Tache 1.1.14).
**Solution** :
1. En Sprint 1.1.1, conditionner `prepare` : `"prepare": "[ -d node_modules/husky ] && husky || echo 'husky not yet installed'"`
2. Tache 1.1.14 ajoute husky en devDep et le hook devient actif

### Edge case 7 : `link-workspace-packages=deep` declenche cycle de dependances

**Scenario** : `packages/insure` depend de `packages/auth`, qui depend de `packages/database`, qui en theorie ne devrait pas dependre de `packages/auth` mais le declare par erreur.
**Probleme** : pnpm rejette avec `ERR_PNPM_CYCLIC_DEPENDENCY`.
**Solution** :
1. Identifier le cycle via `pnpm list --depth=10 | grep -E "@insurtech"`
2. Refactorer : extraire le code partage dans `packages/shared-types` ou `packages/shared-utils`
3. Mettre a jour les `package.json` pour casser le cycle

### Edge case 8 : MacOS Catalina+ refuse `chmod +x` sur scripts shell

**Scenario** : un developpeur MacOS clone le repo et execute `pnpm docker:up` mais le script `infrastructure/docker/postgres/init.sh` n'a pas le bit executable.
**Probleme** : MacOS Catalina+ peut stripper le bit executable au clone (Gatekeeper).
**Solution** :
1. Configurer Git globalement : `git config --global core.fileMode true`
2. Re-cloner le repo
3. En dernier recours : `find . -name "*.sh" -exec chmod +x {} \;` puis commit

---

## 12. Conformite Maroc

Aucune conformite legale specifique applicable a la Tache 1.1.1 (purement infrastructure). Cependant, la structure prepare l'arrivee des conformites suivantes dans les sprints ulterieurs :

- **Loi 09-08 (CNDP)** : protection des donnees personnelles. Le dossier `infrastructure/terraform/` accueillera les modules Atlas Cloud Services Benguerir au Sprint 35 pour conformite data residency Maroc (decision-008).
- **Loi 43-20 (signature electronique)** : le dossier `packages/signature/` accueillera l'integration Barid eSign + ANRT TSA RFC 3161 au Sprint 10 (decision-009).
- **Reglement ACAPS** (Autorite de Controle des Assurances et de la Prevoyance Sociale) : le dossier `packages/compliance/` accueillera les rapports ACAPS au Sprint 12.
- **AMC** (Association Marocaine des Compagnies d'Assurance) : dans `packages/compliance/` au Sprint 12.
- **DGI** (Direction Generale des Impots) : facturation conforme dans `packages/books/` au Sprint 12 (Plan CGNC + SAFT-MA + 5 taux TVA MA : 0%, 7%, 10%, 14%, 20%).
- **CNSS / AMO / IR** : paie marocaine dans `packages/hr/` au Sprint 13.

---

## 13. Conventions absolues skalean-insurtech

Cette tache DOIT respecter TOUTES les conventions du programme :

### 13.1 Multi-tenant strict (decision-002)

Aucune entite ou logique multi-tenant introduite par cette tache (purement infrastructure). Les helpers SQL multi-tenant 3 niveaux seront livres Tache 1.1.4. Chaque table avec `tenant_id` aura RLS Postgres au Sprint 6.

### 13.2 Validation strict

Aucun schema Zod introduit par cette tache (vide). Les schemas Zod runtime seront introduits Tache 1.1.8 (`shared-config`) et Sprint 2 (`shared-events`).

### 13.3 Logger strict

Aucun logger introduit par cette tache. Pino sera introduit Tache 1.1.12.
- Pino via `this.logger.info(...)` injecte par DI NestJS (Sprint 3)
- JAMAIS `console.log()` (verifie pre-commit hook Tache 1.1.14)
- JAMAIS `new Logger(...)` (NestJS Logger natif)
- Format JSON structured pour parsing Datadog/Sentry
- Champs obligatoires : `tenant_id`, `user_id`, `request_id`, `action`, `duration_ms`

### 13.4 Hash password strict

Non applicable Sprint 1.1.1. Sera Sprint 5 (auth) :
- argon2id avec params `memoryCost: 65536, timeCost: 3, parallelism: 4`
- JAMAIS bcrypt (depasse), JAMAIS scrypt
- Pepper en plus du salt (env var `PASSWORD_PEPPER`)
- Migration ancienne DB : re-hash on-login si argon2id non detecte

### 13.5 Package manager strict

- pnpm 9.15.0 uniquement (jamais npm, jamais yarn)
- `engine-strict=true` rejette install si Node < 22.20.0
- `save-exact=true` impose versions deterministes (pas de `^` ou `~`)
- `link-workspace-packages=deep` pour imports `@insurtech/*`
- Defense `preinstall: only-allow pnpm`

### 13.6 TypeScript strict

Sera applique Tache 1.1.2 :
- `strict: true` dans `tsconfig.base.json`
- `noUncheckedIndexedAccess: true` (force null checks sur arrays/objects)
- `noImplicitAny: true` (aucun any implicite)
- `noImplicitReturns: true`
- `exactOptionalPropertyTypes: true`
- Imports explicites : pas de `import * as`

### 13.7 Tests strict

Sera applique Tache 1.1.11 :
- Vitest pour unit + integration
- Playwright pour E2E web
- Chaque fichier `.ts` (sauf types-only et index.ts) DOIT avoir un `.spec.ts` associe
- Coverage cible : >= 85% global, >= 90% modules critiques (auth, database, signature)

### 13.8 RBAC strict

Non applicable Sprint 1.1.1. Sera Sprint 7 :
- `@Roles()` decorateur sur chaque endpoint
- `RolesGuard` global active sur ApiModule
- 12 roles : SuperAdmin, BrokerAdmin, BrokerUser, GarageAdmin, GarageManager, GarageTechnician, AssureClient, Prospect, ComplianceOfficer, FinanceOfficer, Support, ReadOnly

### 13.9 Events strict (Kafka)

Sera applique Sprint 2 :
- Kafka topics format : `insurtech.events.{vertical}.{entity}.{action}`
- Schemas Zod pour chaque event
- Idempotency-Key obligatoire pour events critiques

### 13.10 Imports strict

- Packages partages via `@insurtech/{nom}` (pas chemins relatifs `../../packages/...`)
- TypeScript paths configures dans `tsconfig.base.json` (Tache 1.1.2)
- Order : 1) Node natifs 2) Externes 3) `@insurtech/*` 4) Relatifs

### 13.11 Skalean AI strict (decision-005)

- Utilise UNIQUEMENT via `@insurtech/sky` (REST client) ou MCP client
- JAMAIS appel direct OpenAI/Anthropic/etc (frontier strict)
- Frontiere stricte : Skalean AI utilise tools Skalean InsurTech via MCP, JAMAIS l'inverse
- Mock pendant Sprint 1-28 (decision-007), swap real Sprint 29

### 13.12 No-emoji strict (decision-006 ABSOLU)

- AUCUNE emoji dans : code, commentaires, logs, docs, commits
- Pre-commit hook `check-no-emoji.sh` rejette commits avec emoji (Tache 1.1.14)
- CI fail si emoji detectee dans PR (Tache 1.1.10)
- Cette regle ne souffre AUCUNE exception

### 13.13 Idempotency-Key strict

Non applicable Sprint 1.1.1. Sera Sprint 11 (paiement) et Sprint 30 (MCP write tools).

### 13.14 Conventional Commits strict

- Format : `<type>(scope): description`
- Types : `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`, `ci`, `build`
- Scope : `sprint-NN` ou `package-name`
- Description : 50-72 chars max
- Body : metadata Task/Sprint/Phase obligatoire
- commitlint rejette commits non-conformes via husky (Tache 1.1.14)

### 13.15 Cloud souverain MA strict (decision-008)

- Atlas Cloud Services Benguerir UNIQUEMENT pour data Maroc
- DC1 Tier III + DC2 Tier IV (DR)
- AUCUNE donnee assure ne transite hors MA (loi 09-08 CNDP)
- Encryption at rest AES-256-GCM via Atlas KMS
- TLS 1.3 obligatoire pour tous transferts

---

## 14. Validation pre-commit

Avant tout commit de cette tache, executer la sequence complete :

```bash
#!/usr/bin/env bash
# Validation pre-commit Tache 1.1.1
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

echo "=== Step 1 : pnpm install --frozen-lockfile ==="
pnpm install --frozen-lockfile --prefer-offline

echo "=== Step 2 : structure tests ==="
pnpm vitest run infrastructure/scripts/__tests__/structure.spec.ts

echo "=== Step 3 : no-emoji tests ==="
pnpm vitest run infrastructure/scripts/__tests__/no-emoji-bootstrap.spec.ts

echo "=== Step 4 : turbo version ==="
pnpm dlx turbo --version | grep -E "^2\.[4-9]"

echo "=== Step 5 : pnpm typecheck (must pass even empty) ==="
pnpm typecheck

echo "=== Step 6 : grep no-emoji bootstrap files ==="
for f in package.json pnpm-workspace.yaml turbo.json .npmrc .nvmrc .gitignore .editorconfig; do
  if grep -P "[\x{1F300}-\x{1FAFF}]|[\x{2600}-\x{27BF}]|[\x{1F1E6}-\x{1F1FF}]" "$f" 2>/dev/null; then
    echo "FAIL: emoji detected in $f"
    exit 1
  fi
done
echo "OK: no emoji"

echo "=== Step 7 : 9 apps + 23+ packages ==="
APPS=$(find apps -maxdepth 1 -mindepth 1 -type d | wc -l)
PKGS=$(find packages -maxdepth 1 -mindepth 1 -type d | wc -l)
[[ "$APPS" == "9" ]] || { echo "FAIL: $APPS apps"; exit 1; }
[[ "$PKGS" -ge "23" ]] || { echo "FAIL: $PKGS packages"; exit 1; }
echo "OK: 9 apps + $PKGS packages"

echo "=== Step 8 : no console.log in spec files (eviter pollution) ==="
grep -rn "console\.log\|console\.debug" infrastructure/scripts/__tests__/ --include="*.ts" 2>/dev/null && {
  echo "WARN: console.log found in test files (acceptable for test debug, please verify)"
}

echo "=== ALL PRE-COMMIT CHECKS PASSED ==="
```

---

## 15. Commit message complet

```bash
git add -A
git commit -m "feat(sprint-01): init monorepo pnpm 9.15 + Turborepo 2.4 structure 9 apps + 25 packages

Initialise la fondation outillage du monorepo Skalean InsurTech v2.2 :
- package.json racine avec scripts orchestres (dev, build, lint, typecheck, test,
  docker:up/down/reset, bootstrap, verify-env, clean, prepare) et engines.node
  >=22.20.0 + packageManager pnpm@9.15.0 + private:true (anti-publish)
- pnpm-workspace.yaml declarant 9 apps (api + 7 web + mcp-server) et 25 packages
  (15 metier + 2 ai + 1 assure-shared + 7 shared) workspaces avec commentaires
  inline mentionnant le sprint d'implementation cible
- turbo.json pipeline tasks complet (build, dev, lint, typecheck, test, test:e2e,
  test:integration, clean) avec globalDependencies (tsconfig.base.json + biome.json
  + .npmrc + .env), inputs/outputs explicites, env declare pour test invalidation
- .npmrc avec configuration stricte (engine-strict=true, save-exact=true,
  link-workspace-packages=deep, prefer-workspace-packages=true,
  package-import-method=hardlink, dedupe-peer-dependents=true,
  shamefully-hoist=false defense en profondeur contre phantom deps)
- .nvmrc 22.20.0 (aligne package.json engines.node)
- .gitignore exhaustif (node_modules, .env, .turbo, dist, .next, coverage,
  test-results, playwright-report, .docker-data, secrets/keys *.pem, OS
  metadata DS_Store/Thumbs.db, IDE state .idea/.vscode/_local)
- .editorconfig universel (UTF-8, LF, 2 spaces, 100 chars line length)
- Structure dossiers complete : 9 apps/, 25 packages/, infrastructure/{docker
  postgres/redis/kafka/minio, scripts, observability, cloudflare, aws,
  terraform}, .github/workflows/, .husky/, .vscode/, docs/{architecture, api,
  runbooks, security, pilote}, test/, load-tests/

Livrables :
- 7 fichiers config racine
- 9 apps stub directories (avec .gitkeep placeholders)
- 25 packages stub directories
- 9 infrastructure subdirectories
- 7 docs subdirectories
- 3 fichiers de tests structure (structure.spec.ts, install-time.spec.ts,
  no-emoji-bootstrap.spec.ts)

Tests :
- 17 tests unitaires structure (apps, packages, root config files,
  infrastructure, meta dirs, no-emoji)
- 3 tests integration install-time (perf 90s, determinisme lockfile, engine
  rejection)
- 11 tests no-emoji (8 it.each FILES_TO_CHECK + 4 self-validation)
Total : 31 tests Sprint 1.1.1

Coverage : N/A (pas de code applicatif)
Validations : V1-V28 documentees dans prompt task-1.1.1

Conformite : decision-001 (monorepo) + decision-006 (no-emoji ABSOLU)
Decisions techniques : pnpm 9.15.0 + Turborepo 2.4.0 + Node 22.20.0 LTS

Task: 1.1.1
Sprint: 1 (Phase 1 / Sprint 1)
Phase: 1 -- Bootstrap Infrastructure
Reference: B-01 Tache 1.1.1
Dependances: aucune (tache initiale du programme)
Bloque: Taches 1.1.2 a 1.1.15 + Sprints 2 a 35"
```

---

## 16. Workflow next step

Apres commit reussi de cette tache (V1-V16 P0 toutes vertes) :

- **Tache suivante** : `task-1.1.2-typescript-strict-biome.md`
- **Action immediate** : ouvrir le fichier `00-pilotage/prompts-taches/sprint-01-bootstrap/task-1.1.2-typescript-strict-biome.md`
- **Inputs herites de cette tache** : la racine `repo/` avec `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `.npmrc` configures correctement.
- **Outputs attendus Tache 1.1.2** : `tsconfig.base.json` + `tsconfig.json` + `biome.json` + `.vscode/settings.json` + `.vscode/extensions.json`.

Si la tache 1.1.1 echoue sur un V P0 (V1 a V16), NE PAS proceder a 1.1.2. Reproduire le piege correspondant via les edge cases de la section 11, corriger, re-valider.

Si toutes les V P0 et P1 passent, proceder a Tache 1.1.2.

Si toutes les V (incluant P2) passent, c'est l'ideal -- Sprint 1 demarre avec une fondation solide.

---

**Fin du prompt task-1.1.1-init-monorepo-pnpm-turborepo.md**

Densite atteinte : ~80 ko (objectif 80-150 ko)
Code patterns : 10 fichiers complets (package.json + pnpm-workspace.yaml + turbo.json + .npmrc + .nvmrc + .gitignore + .editorconfig + 3 fichiers tests)
Tests : 31 cas concrets (17 structure + 3 install-time + 11 no-emoji)
Criteres validation : V1-V29 (16 P0 + 8 P1 + 5 P2)
Edge cases : 8 cas avec solutions
Sections presentes : 16/16
Conventions rappelees : 14/15 (idempotency reportee Sprint 11)
Conformite legale : preparation 6 lois MA (anchors structure)
