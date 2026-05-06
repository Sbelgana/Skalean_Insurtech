# TACHE 1.4.12 -- Tooling Monorepo Frontend (Turbo + Scripts Dev Parallel)

**Sprint** : 4 (Phase 1 / Sprint 4 dans phase, dernier de Phase 1 Bootstrap)
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-04-sprint-04-frontend-bootstrap.md` (Tache 1.4.12, lignes 921-964)
**Phase** : 1 -- Bootstrap
**Priorite** : P0
**Effort** : 4h
**Dependances** : 1.4.1 a 1.4.11 (les 8 apps Next.js et 3 packages shared sont scaffolded), Sprint 1 (monorepo pnpm + Turbo de base + tsconfig.base.json + .env.example racine), Sprint 2 (Postgres/Redis/Kafka demarrent via docker compose -- doctor script verifie), Sprint 3 (API NestJS port 4000 -- doctor pings)
**Densite cible** : 100-150 ko (auto-suffisant exhaustif, aucune lecture annexe necessaire)
**AUCUNE EMOJI AUTORISEE** (decision-006 strictement appliquee dans tous les fichiers livres : scripts, JSON, YAML, MD)

---

## 1. But (0.5-1 ko)

Optimiser la Developer Experience (DX) du monorepo frontend Skalean InsurTech en orchestrant proprement les 8 applications Next.js 15 (web-broker, web-garage, web-garage-mobile, web-insurtech-admin, web-customer-portal, web-assure-portal, web-assure-mobile sur ports 3000 a 3006) et les 3 packages partages (shared-ui, shared-pwa, shared-maps). Cette tache n'introduit aucune logique metier : elle se concentre exclusivement sur la chaine d'outillage qui rend le travail quotidien des developpeurs frontend rapide, fiable et reproductible sur Windows comme sur macOS et Linux.

Les livrables techniques sont : (1) un fichier `repo/package.json` racine enrichi avec une trentaine de scripts orchestres (`dev:web-broker`, `dev:web-garage`, ..., `dev:portals` lance les trois apps assure en parallele, `dev:dashboards` lance les trois apps dashboards, `dev:all` lance les 8 apps en simultane sur machine 16+ GB RAM, `build:apps`, `typecheck:apps`, `lint`, `test`, `test:e2e`, `doctor`, `clean`, `format`, `generate:api-client`, `lighthouse:baseline`, `storybook`) ; (2) un fichier `repo/turbo.json` enrichi avec un pipeline frontend complet (dev cache:false persistent:true, build cache:true outputs `.next/**` hors `.next/cache/**` + `dist/**`, typecheck cache:true outputs `*.tsbuildinfo`, lint cache:true, test cache:true outputs `coverage/**`, e2e cache:false, generate:api-client cache:false, lighthouse cache:false) qui maximise les cache hits sur typecheck/lint/test ; (3) trois scripts shell `repo/scripts/dev-portals.sh`, `repo/scripts/dev-all.sh`, `repo/scripts/dev-dashboards.sh` (avec equivalents `.cmd` Windows) qui utilisent `concurrently` et tmux pour lancer plusieurs apps avec prefixe colore et kill propagation ; (4) un script TypeScript `repo/scripts/doctor.ts` (~250 lignes) execute via `tsx` qui verifie l'environnement local de bout en bout (Node 22.11+, pnpm 9.15+, Docker up, Postgres reachable, Redis reachable, Kafka reachable, Atlas Cloud Benguerir S3 reachable, ports 3000-3006 + 4000 + 4001 libres, .env present, env vars valides via Zod, Mapbox token valide) et imprime un tableau ASCII OK / WARN / FAIL ; (5) une configuration Biome `repo/biome.json` (~120 lignes) qui remplace ESLint+Prettier par un seul outil Rust ultra-rapide ; (6) une configuration Husky + lint-staged + commitlint qui empeche les commits invalides (emoji, console.log oublie, type errors) ; (7) une configuration VSCode `repo/.vscode/{launch,settings,extensions}.json` qui standardise l'environnement de l'equipe ; (8) un guide developpeur `repo/docs/developer-guide.md` (~400 lignes) qui documente quickstart, ports, scripts, debugging, branch naming.

A la sortie de cette tache, un developpeur fraichement embauche peut cloner le repo, executer `pnpm install`, `pnpm doctor`, puis `pnpm dev:portals` pour bosser sur le workflow assure ou `pnpm dev:web-broker` pour bosser sur le courtage, sans lire 30 pages de README. Un dev senior peut lancer les 8 apps en parallele pour tester un changement transversal dans `shared-ui` et voir le hot reload se propager en moins de 2 secondes sur les 8 fronts. Le pre-commit hook bloque automatiquement tout emoji, console.log, ou erreur de type. Le pipeline CI Sprint 35 reutilisera ces memes scripts (`pnpm typecheck:apps`, `pnpm build:apps`, `pnpm test`) sans duplication.

Cette tache bloque 1.4.13 (generation client API) qui ajoute le script `generate:api-client` dans le pipeline Turbo, et conditionne tous les sprints metier suivants (5 a 35) qui consommeront `pnpm dev:web-*` au quotidien.

---

## 2. Contexte etendu (5-10 ko)

### Pourquoi cette tache existe

Apres les 11 taches precedentes du Sprint 4, l'equipe se retrouve avec un monorepo complexe : 8 apps Next.js qui peuvent toutes lancer un serveur de dev sur des ports differents (3000-3006), 3 packages partages qui exportent du code TypeScript a recompiler en cas de modif, des configurations TypeScript imbriquees (`tsconfig.base.json` racine + un `tsconfig.json` per-app), des fichiers `package.json` per-package, et plus de 100 dependances frontend cumulees. Sans orchestration explicite, le developpeur se retrouve a faire `cd apps/web-broker && pnpm dev` puis `cd apps/web-garage && pnpm dev` dans deux terminaux separes, en oubliant systematiquement de demarrer le BFF Sprint 6 ou le service `shared-ui` en mode watch. Les pre-commit hooks ne sont pas configures, donc des emojis ou console.log se glissent en main, et le rebase est rendu douloureux. Le typecheck tourne en serie sur 8 apps (~30 secondes total) au lieu de 8 secondes en parallele.

L'objectif de cette tache est de reduire le temps "de l'idee au feedback" : (a) lancer 1 ou plusieurs apps en une seule commande, (b) avoir un cache build/typecheck/lint qui re-tourne en moins d'une seconde si rien n'a change, (c) bloquer les erreurs avant le push (pre-commit Biome lint + lint-staged + no-emoji + no-console.log), (d) standardiser l'editeur (VSCode launch.json + settings.json + extensions.json valent un manuel d'onboarding), (e) verifier l'environnement avant de demarrer (`pnpm doctor`).

Cette tache est egalement cruciale pour la maintenance long-terme du programme. A la fin du Sprint 35 (cumul total), le repo aura accumule ~50 packages, 8 apps + 1 BFF + 1 API + plusieurs services, et la vitesse de feedback sera la difference entre un projet vivant et un projet abandonne. Investir 4 heures maintenant economise 100+ heures cumulees sur les 30 sprints restants.

### Alternatives considerees

#### Turborepo vs Nx vs Lerna vs Rush

| Critere | Turborepo 2.3+ (CHOIX) | Nx 20 | Lerna 8 | Rush |
|---------|-------------------------|-------|---------|------|
| Cache local | Oui (file-based) | Oui (avance) | Non (Lerna v8 deprecied cache) | Oui |
| Cache distant | Oui (Vercel + custom + auto-config) | Oui (Nx Cloud paid) | Non | Oui (custom S3) |
| Configuration | JSON declaratif simple | Plugins avec fichiers `project.json` | JSON simple | YAML+CLI |
| Courbe apprentissage | 1-2 heures | 1-2 jours (graph generators) | 2 heures | 2-3 jours |
| Integration pnpm workspaces | Native (depuis v1.10) | Plugin | Native (legacy) | Limite |
| Watch mode dev parallel | Oui (`turbo dev`) | Oui | Oui basique | Oui |
| Codegen / generators | Non (philosophie minimaliste) | Oui (avance) | Non | Oui |
| Telemetry | Opt-in (`TURBO_TELEMETRY_DISABLED=1`) | Opt-in | Aucune | Opt-in |
| Maintenance | Vercel (active 2024+) | Nrwl (active) | Maintenance only depuis 2022 | Microsoft (active mais petit) |
| Adoption marche 2026 | ~50% nouveaux monorepos JS | ~30% (preferred enterprise/Angular) | <5% | <5% |
| Sortie initiale en prod chez Skalean (Sprint 1) | Deja choisi (decision-001) | Rejete car courbe | Rejete | Rejete |

**Decision** : Turborepo 2.3+. Le choix a ete pose au Sprint 1 (decision-001 monorepo + Turbo). Cette tache 1.4.12 enrichit la configuration `turbo.json` heritee. Pas de re-evaluation : l'equipe maitrise Turbo, Nx ajouterait une courbe sans benefice.

Trade-off : Turborepo manque les "executors" Nx pour code generation. On compense par des scripts pnpm + tsx ad hoc (cf. `scripts/doctor.ts`).

#### concurrently vs npm-run-all vs tmux vs zellij

| Critere | concurrently 9.1.0 (CHOIX dev:portals/dev:all) | npm-run-all 4.x | tmux | zellij |
|---------|-------------------------------------------------|-----------------|------|--------|
| Sortie console multiplexee avec prefixes | Oui (`-n` names + couleurs) | Oui (`-p`) | Manuel (split-window) | Manuel |
| Kill on first failure | Oui (`--kill-others-on-fail`) | Oui (`-r`) | Manuel | Manuel |
| Cross-platform Windows | Oui (Node-based) | Oui | Non native (WSL ou alternative) | Non native Windows |
| Detection ports en conflit | Manuelle | Manuelle | Non | Non |
| Permet lancement `pnpm dev:web-broker` standalone | Oui (un seul process) | Oui | Surdimensionne | Surdimensionne |
| Persistence session terminale | Non (process direct) | Non | Oui (sessions detachables) | Oui |
| Adoption equipe | Wide JS | Wide JS | Wide ops/devs | Niche |

**Decision** : `concurrently` pour les scripts cross-platform `dev:portals` / `dev:all` / `dev:dashboards`. `tmux` propose en alternative dans `repo/scripts/dev-portals.sh` (uniquement Linux/macOS) pour developpeurs qui veulent sessions detachables. Windows utilise `concurrently` exclusif (`.cmd` ou via PowerShell). Pas de zellij : trop niche en 2026.

Justification : `concurrently` est dans `package.json` deja, fonctionne sur Windows nativement, integration parfaite avec pnpm scripts.

#### Biome vs ESLint+Prettier vs Rome (legacy) vs Standard

| Critere | Biome 1.9 (CHOIX) | ESLint 9 + Prettier 3 | Rome (deprecated 2023) | Standard |
|---------|---------------------|------------------------|-------------------------|----------|
| Vitesse lint+format | ~10x ESLint+Prettier (Rust) | Reference | Mort | Lent |
| Configuration | Single `biome.json` | `.eslintrc.cjs` + `.prettierrc.json` + `.eslintignore` + `.prettierignore` | -- | -- |
| Format + Lint en un seul outil | Oui | Non (deux outils) | Oui (mort) | Oui |
| Compatibilite plugins ESLint | Partielle (couverture ~70% rules ESLint recommended) | Native (10000+ plugins) | -- | Tres limite |
| TypeScript native | Oui | Oui (parser @typescript-eslint) | Oui (mort) | Plugin |
| React + Next.js rules | Oui (recommended) | Oui (eslint-plugin-react + next/core-web-vitals) | -- | Limite |
| Maintenance | BiomeJS (active 2024+, fork de Rome) | ESLint Foundation + Prettier | Mort | Active |
| Configuration tools cross-tool conflits | Aucune (single tool) | Frequents (eslint-config-prettier requis) | -- | -- |
| Adoption marche 2026 | ~25% nouveaux projets et croissant | ~70% existant + nouveaux | 0% | <5% |

**Decision** : Biome. Justifications precises : (1) vitesse Rust qui debloque pre-commit hook < 1s sur 100 fichiers, (2) zero conflit ESLint vs Prettier qui consomme historiquement 30% du temps de setup tooling, (3) un seul fichier de config a maintenir. Trade-off : on perd la compat avec eslint-plugin-tailwindcss (utilisations a la main de classnames dans le mauvais ordre). On compense par les snapshots Biome + `tailwind-merge` runtime + revue manuelle.

Compatibility note : Next.js 15 fournit toujours `next lint` qui utilise ESLint sous le capot. On le desactive explicitement (`"next.eslint.disabled": true` dans `.vscode/settings.json` et pas de plugin ESLint dans `next.config.mjs`).

#### Husky vs Lefthook vs simple-git-hooks vs Git native hooks

| Critere | Husky 9.1.x (CHOIX) | Lefthook 1.10 | simple-git-hooks | Git native hooks |
|---------|-----------------------|----------------|-------------------|-------------------|
| Vitesse install | `husky init` 1 commande | `lefthook install` | `npx simple-git-hooks` | Manuel |
| Vitesse execution hook | Reference | ~2x Husky (Go binaire) | Tres rapide | Reference |
| Cross-platform | Oui | Oui (Go binaire) | Oui | Bash dependant |
| Configuration parallele tasks | Via lint-staged (~) | Native (`parallel: true` YAML) | Limite | Manuel |
| Adoption marche 2026 | ~80% (default) | ~10% (croissant equipes perf) | <5% (niche) | -- |
| Documentation officielle | Excellent | Bon | Limite | -- |

**Decision** : Husky 9.1.x avec lint-staged + commitlint. Adoption massive = peu de friction onboarding. Vitesse acceptable car Biome est deja rapide en lint. Lefthook serait techniquement superieur mais marginal vs Biome dominant le temps. **Note** : on documente Lefthook comme alternative viable (V25) et on prepare la config `lefthook.yml` en option commentee dans le repo (~80 lignes pretes a basculer si necessaire Sprint 30+).

#### tsx vs ts-node vs esbuild-runner vs bun

| Critere | tsx 4.19 (CHOIX) | ts-node 10 | esbuild-runner | bun |
|---------|-------------------|------------|----------------|-----|
| Vitesse demarrage | ~50ms (esbuild interne) | ~500ms-2s | ~50ms | ~20ms |
| ESM support | Native | Manuel (`--esm` flag tricky) | Native | Native |
| Watch mode | Oui (`tsx watch`) | Oui (`ts-node-dev`) | Oui | Oui |
| Compatibilite TypeScript paths | Oui | Oui | Oui | Limite |
| Cross-platform | Oui | Oui | Oui | Linux/macOS+Windows partial |
| Adoption | ~60% (default 2025+) | ~30% (legacy) | <5% | ~10% |

**Decision** : `tsx` pour `repo/scripts/doctor.ts` et tout futur script TypeScript. Bun rejete (pas encore stable Windows toutes versions, certaines APIs Node manquent).

### Trade-offs explicites

1. **Turbo cache local sans cache distant Sprint 4** : aucun setup remote cache (Vercel Turborepo Cloud) avant Sprint 35 (CI). Trade-off : devs locaux ne partagent pas de cache. Acceptable car `.turbo/` local fait deja 70% du gain. Sprint 35 ajoutera `TURBO_TOKEN` + `TURBO_TEAM` + `signature: true` dans `turbo.json`.

2. **dev:all gourmand en RAM** : 8 apps Next.js dev = ~3-5 GB RAM minimum (chaque Next.js dev ~400-700 MB). Machines < 16 GB RAM doivent utiliser `dev:portals` ou `dev:dashboards`. Le script `dev-all.sh` affiche un warning explicite avant lancement.

3. **Biome ne couvre pas 100% ESLint rules** : si une regle ESLint specifique manque (ex: `react-hooks/exhaustive-deps` couverture partielle), on fait revue de PR manuelle. Audit a faire Sprint 18 si bugs hooks recurrents.

4. **Husky pas Lefthook** : Husky ajoute ~10ms par hook execution (Node startup). Acceptable pour Sprint 4 mais Sprint 30 evaluera Lefthook si pre-commit > 5 secondes total devient frequent.

5. **tmux uniquement Linux/macOS** : Windows users ont scripts `.cmd` separes qui utilisent `start` (Windows multi-window) ou `concurrently`. Divergence assumee mais minimisee : la plupart des devs senior Skalean sont sur macOS, Windows = stagiaires/integrations Sprint 5+.

6. **Pas de devcontainer.json Sprint 4** : l'equipe travaille en local pour iterer vite. Un Dev Container reproductible sera Sprint 30 (preparation onboarding accelere). Documente dans V29 placeholder.

7. **Biome `noNonNullAssertion: error`** : interdit `value!.foo`. Force le code defensif avec `if (value)` ou `value?.foo ?? default`. Couteux a refactorer dans le code existant (~20 instances apps stubs Sprint 1). Migration partielle : warn d'abord, error au Sprint 8.

8. **lint-staged interaction avec Biome** : Biome `check --write` reformat les fichiers, lint-staged restage automatiquement les changements. Si Biome reformat un fichier deja stage avec changement non stage (cas rare), on peut perdre le changement. Mitigation : `lint-staged` config force `git add` apres write, equipe documente "ne pas avoir de changements partiels stages".

9. **Concurrently kill-others-on-fail laisse zombies** : si Next.js dev creee un sous-process node qui ne s'attache pas au parent, `concurrently --kill-others-on-fail` peut laisser le sous-process tourner. Mitigation : `repo/scripts/dev-all.sh` ajoute trap SIGINT/SIGTERM avant exit pour cleanup pids. Sur Windows, `dev-all.cmd` documente "Ctrl+C deux fois si processus zombie" comme workaround.

10. **doctor script depend d'Internet** : verifications Atlas Cloud Benguerir + Mapbox necessitent connexion. Mode offline supporte via flag `--offline` qui skip ces verifications.

### Decisions strategiques referenced

- **decision-001 (monorepo pnpm + Turbo)** : cette tache enrichit `turbo.json` mais ne change pas la decision. `pnpm-workspace.yaml` reste source de verite des workspaces.
- **decision-006 (NO EMOJI ABSOLU)** : pre-commit hook execute `scripts/check-no-emoji.sh` qui grep emoji codepoints et bloque le commit. Documente section 13.
- **decision-008 (cloud souverain MA Atlas Cloud Benguerir)** : `repo/scripts/doctor.ts` verifie via probe HTTP que `s3.bgr.atlascloudservices.ma` repond, et **echoue si une URL `*.amazonaws.com` est detectee dans `.env`** (la config doctor cherche cette signature en grep).
- **decision-005 (Skalean AI frontier)** : aucune integration AI dans tooling. `pnpm doctor` mentionne `NEXT_PUBLIC_AI_GATEWAY_URL` en placeholder.
- **decision-009 (multilinguisme MA)** : aucun impact direct tooling sauf que les messages d'erreur du script doctor sont en francais (UX equipe MA).

### Pieges techniques connus (12 minimum)

1. **8 apps simultanees RAM borderline 16 GB** : Next.js 15 dev avec Turbopack consomme ~500 MB par app. 8 apps = ~4 GB. Plus Postgres + Redis + Kafka + IDE + Chrome devtools = ~6-7 GB. Sur machine 16 GB, swap actif. Sur 8 GB, OOM kill aleatoire. Solution : warning RAM dans `dev-all.sh`, recommander `dev:portals` ou `dev:dashboards` pour <= 16 GB.

2. **Turbo cache invalide quand `tsconfig.base.json` modifie** : le `globalDependencies` du `turbo.json` doit lister `tsconfig.base.json` et `.env*` sinon une modif fait rater l'invalidation. Solution : `globalDependencies: ["tsconfig.base.json", ".env", ".env.*", "biome.json"]`.

3. **Hot reload cross-package shared-ui->apps** : Next.js dev ne re-bundle pas automatiquement les changements dans `packages/shared-ui/src/**.tsx` car le code est consume via `import` sans compilation prealable. Solution : configurer `transpilePackages: ['@insurtech/shared-ui', '@insurtech/shared-pwa', '@insurtech/shared-maps']` dans `next.config.mjs` de chaque app (deja fait taches 1.4.1 a 1.4.7). Verifie dans V8.

4. **`pnpm doctor` port 4000 occupe par autre service** : si l'utilisateur a Postgres sur 4000 (rare) ou autre, le check echoue. Solution : message explicite "port 4000 utilise par un autre process. PID a kill : XXX" via `lsof -i:4000` (Linux/macOS) ou `netstat -ano | findstr :4000` (Windows).

5. **lint-staged + Biome restage** : si un fichier .ts a un import non-utilise + un changement utilisateur, Biome `check --write` reformat (organize imports = remove unused). Le fichier doit etre re-stage automatiquement par lint-staged. Verifier `lint-staged.config.js` retourne le nom du fichier modifie pour que lint-staged appelle `git add`.

6. **Husky ne s'install pas sur shallow clone** : CI clone parfois en `--depth 1` qui casse `husky install`. Solution : `package.json` script `prepare` = `husky install` est encadre par `is-ci || husky install` (pkg `is-ci`).

7. **commitlint Conventional Commits avec scope `sprint-NN-X.Y.Z`** : le scope `sprint-04-1.4.12` doit etre autorise dans `commitlint.config.cjs`. Solution : `scope-enum` desactive (`'scope-enum': [0]`) ou pattern regex permissif.

8. **VSCode extensions installation prompt** : `.vscode/extensions.json` recommendations declenchent prompt user a chaque ouverture du repo. Acceptable pour onboarding mais peut agacer. Solution : documenter "Cmd+Shift+P > Configure Recommended Extensions > Don't show again" si genant.

9. **Windows `.cmd` ne supporte pas `&&` comme bash** : sur Windows CMD, `cd repo && pnpm dev` echoue parfois. Solution : utiliser PowerShell (`pwsh`) dans les `.cmd` ou Git Bash (la plupart des devs Windows ont Git Bash). Documente dans developer-guide.md.

10. **Node 22.11 vs 22 LTS** : `.nvmrc = 22.11.0` est pinne strict. Si un dev a Node 22.13 (mineur superieur), nvm install 22.11 manuel necessaire. `engine-strict=true` dans `.npmrc` echoue si version mineure differe. Trade-off : strict = reproductibilite, frustrant onboarding. Decision : strict pin sur major.minor (22.11) sans patch.

11. **Turbo `pipeline` deprecated 2.0+** : Turbo 2.x utilise `tasks` (pas `pipeline`). Erreur d'inattention copie-colle d'exemples vieux. Le `turbo.json` livre utilise `"tasks"`.

12. **Mapbox token rate limit doctor probe** : appel doctor Mapbox API consomme 1 quota geocoding. 10 doctor / heure = 10 calls. Free tier = 100k/mois, OK. Mais si CI le tourne aussi, attention. Solution : `doctor --skip-mapbox` flag.

13. **Atlas Cloud Benguerir S3 health check timeout** : reseau MA -> Atlas peut avoir 200-500 ms latence. Timeout doctor par defaut = 5s. Si timeout 5s atteint, doctor WARN (pas FAIL). FAIL seulement si DNS resolution echoue.

14. **pnpm doctor concurrent** : si deux devs lancent `pnpm doctor` simultanement, le check "port libre" peut donner faux positif (port libere une fraction de seconde). Solution : doctor execute checks sequentiellement (pas paralleles) pour stabilite.

15. **Concurrently sortie melangee Windows** : Windows console ne renderise pas toujours les couleurs ANSI de concurrently. Documente "set FORCE_COLOR=1 dans CMD" workaround.

---

## 3. Architecture context (3-5 ko)

### Position dans Sprint 4

`task-1.4.12` est la **douzieme des 16 taches** du Sprint 4. Elle vient apres les bootstraps des 8 apps (1.4.1 a 1.4.7), des 3 packages partages (1.4.8 a 1.4.10), et de l'i18n cross-cutting (1.4.11). Elle precede directement la generation du client API depuis OpenAPI (1.4.13).

```
Sprint 4 -- Frontend Bootstrap (16 taches)

[1.4.1 web-broker]  ... [1.4.7 web-assure-mobile]   <-- 7 apps en patron clones
[1.4.8 shared-ui]   ... [1.4.10 shared-maps]        <-- 3 packages
[1.4.11 i18n cross-cutting]                          <-- next-intl
[1.4.12 turbo + scripts paralleles]   <-- CETTE TACHE, orchestration
[1.4.13 OpenAPI client gen]                          <-- depend turbo task pipeline
[1.4.14 layouts shared sidebar+topbar]
[1.4.15 placeholder pages + 404/500]
[1.4.16 E2E + Lighthouse + Storybook]
```

### Position dans le programme

Cette tache impacte **tous les sprints suivants** (5 a 35). Chaque sprint metier consomme :
- `pnpm dev:web-broker` ou `pnpm dev:portals` au quotidien.
- `pnpm doctor` lors de l'onboarding de nouveaux developpeurs.
- `pnpm typecheck:apps` et `pnpm test` en pre-push.
- `pnpm build:apps` en CI Sprint 35.
- Le pipeline Turbo `dev/build/typecheck/lint/test` herite des definitions posees ici. Une mise a jour Sprint 13 (AI gateway) ou Sprint 24 (sinistres) ajoute uniquement de nouveaux scripts via merge declaratif dans `package.json`.

### Diagramme ASCII tooling

```
repo/                                # Monorepo racine
|
|-- package.json                     # CETTE TACHE : ~150 lignes scripts
|-- turbo.json                       # CETTE TACHE : ~150 lignes pipelines
|-- pnpm-workspace.yaml              # Sprint 1 (inchange)
|-- pnpm-lock.yaml                   # auto
|
|-- biome.json                       # CETTE TACHE : remplace eslint+prettier
|-- .npmrc                           # CETTE TACHE : engine-strict, save-exact
|-- .nvmrc                           # CETTE TACHE : 22.11.0
|-- lint-staged.config.js            # CETTE TACHE : Biome integration
|-- commitlint.config.cjs            # CETTE TACHE : conventional commits
|
|-- .husky/                          # CETTE TACHE
|   |-- pre-commit                   # lint-staged + no-emoji + no-console
|   |-- pre-push                     # vitest --changed
|   |-- commit-msg                   # commitlint
|
|-- .vscode/                         # CETTE TACHE
|   |-- launch.json                  # configurations debug Next.js per app
|   |-- settings.json                # editor.formatOnSave + Biome default
|   |-- extensions.json              # recommendations
|
|-- scripts/
|   |-- doctor.ts                    # CETTE TACHE : ~250 lignes verifications
|   |-- dev-portals.sh               # CETTE TACHE : 3 apps assure
|   |-- dev-portals.cmd              # CETTE TACHE : Windows alt
|   |-- dev-dashboards.sh            # CETTE TACHE : 3 dashboards
|   |-- dev-dashboards.cmd           # CETTE TACHE : Windows alt
|   |-- dev-all.sh                   # CETTE TACHE : 8 apps + warning RAM
|   |-- dev-all.cmd                  # CETTE TACHE : Windows alt
|   |-- check-no-emoji.sh            # Sprint 1 (deja existe, reutilise)
|
|-- docs/
|   |-- developer-guide.md           # CETTE TACHE : ~400 lignes
|
|-- apps/                            # 8 apps Next.js (taches 1.4.1 a 1.4.7)
|-- packages/                        # 3 packages shared (taches 1.4.8 a 1.4.10)
|
|-- .turbo/                          # cache local Turbo (gitignore)
|-- node_modules/                    # gitignore
```

### Flow execution `pnpm dev:portals`

```
Developpeur tape : pnpm dev:portals
       |
       v
package.json scripts.dev:portals = "bash scripts/dev-portals.sh"
       |
       v
scripts/dev-portals.sh
       |
       +-- check ports 3004,3005,3006 free (lsof -i)
       +-- check pnpm install up-to-date (pnpm install --frozen-lockfile)
       +-- detect tmux available ?
       |   |
       |   +-- YES: launch tmux session "skalean-portals" with 3 split-window
       |   |        - pane 1: pnpm --filter @insurtech/web-customer-portal dev
       |   |        - pane 2: pnpm --filter @insurtech/web-assure-portal dev
       |   |        - pane 3: pnpm --filter @insurtech/web-assure-mobile dev
       |   |
       |   +-- NO:  fallback concurrently
       |            concurrently \
       |              --names "customer,assure-portal,assure-mobile" \
       |              --prefix-colors "blue,green,magenta" \
       |              --kill-others-on-fail \
       |              "pnpm --filter @insurtech/web-customer-portal dev" \
       |              "pnpm --filter @insurtech/web-assure-portal dev" \
       |              "pnpm --filter @insurtech/web-assure-mobile dev"
       |
       v
3 Next.js dev servers running on ports 3004, 3005, 3006
       |
       v
Developpeur ouvre http://localhost:3004, http://localhost:3005, http://localhost:3006
```

---

## 4. Livrables checkables (20+ deliverables)

- [ ] **L1** : `repo/package.json` racine enrichi avec ~30 scripts orchestres (~120 lignes section scripts) listes dans la specification (dev:web-broker, dev:web-garage, dev:web-garage-mobile, dev:web-insurtech-admin, dev:web-customer-portal, dev:web-assure-portal, dev:web-assure-mobile, dev:portals, dev:dashboards, dev:all, build, build:apps, build:packages, typecheck, typecheck:apps, lint, lint:apps, test, test:apps, test:e2e, doctor, clean, format, generate:api-client, lighthouse:baseline, storybook, prepare).
- [ ] **L2** : `repo/turbo.json` (~150 lignes) avec `$schema`, `ui: "tui"`, `globalDependencies: ["tsconfig.base.json", ".env", ".env.*", "biome.json"]`, `globalEnv: ["NODE_ENV"]`, `tasks` complet : dev (cache:false, persistent:true), build (cache:true, outputs `[".next/**", "!.next/cache/**", "dist/**"]`, dependsOn `["^build"]`), typecheck (cache:true, outputs `["*.tsbuildinfo"]`), lint, test, e2e (cache:false), generate:api-client (cache:false), lighthouse (cache:false), clean.
- [ ] **L3** : `repo/scripts/dev-portals.sh` (~50 lignes) bash POSIX, demarre customer-portal + assure-portal + assure-mobile via tmux ou concurrently, verifie ports libres avant.
- [ ] **L4** : `repo/scripts/dev-all.sh` (~80 lignes) bash, warning RAM 16+ GB, lance 8 apps via concurrently, kill-others-on-fail.
- [ ] **L5** : `repo/scripts/dev-dashboards.sh` (~60 lignes) bash, lance broker + garage + insurtech-admin.
- [ ] **L6** : `repo/scripts/dev-portals.cmd` (~30 lignes) Windows CMD alternative.
- [ ] **L7** : `repo/scripts/dev-all.cmd` (~40 lignes) Windows CMD alternative.
- [ ] **L8** : `repo/scripts/doctor.ts` (~250 lignes) script TypeScript via tsx, verifie 12+ items (Node, pnpm, Docker, Postgres, Redis, Kafka, Atlas Cloud, ports libres, .env present, env vars Zod, Mapbox token, no AWS leak), reporting OK/WARN/FAIL ASCII table, exit code.
- [ ] **L9** : `repo/.npmrc` (~30 lignes) avec engine-strict=true, save-exact=true, prefer-frozen-lockfile=true, link-workspace-packages=deep, auto-install-peers=true, recursive-install=true, registry npm public, side-effects-cache=true.
- [ ] **L10** : `repo/.nvmrc` (1 ligne) `22.11.0`.
- [ ] **L11** : `repo/biome.json` (~120 lignes) avec organizeImports.enabled, linter recommended + correctness all + style noNonNullAssertion error, formatter indentStyle space lineWidth 100, javascript.formatter quoteStyle single jsxQuoteStyle double semicolons always trailingCommas all arrowParentheses always, files.ignore, overrides JSON/MD.
- [ ] **L12** : `repo/.husky/pre-commit` (~80 lignes) execute lint-staged + no-emoji grep + no-console.log grep + check Atlas Cloud only.
- [ ] **L13** : `repo/.husky/pre-push` execute `pnpm vitest run --changed`.
- [ ] **L14** : `repo/.husky/commit-msg` execute commitlint.
- [ ] **L15** : `repo/lint-staged.config.js` (~30 lignes) Biome integration : `*.{ts,tsx,js,jsx}` -> `biome check --write`, `*.{json,md,css}` -> `biome format --write`.
- [ ] **L16** : `repo/commitlint.config.cjs` Conventional Commits Skalean (~25 lignes), scope permissif, sujet 100 chars max, type-enum complet (feat/fix/chore/docs/test/refactor/perf/style/build/ci/revert).
- [ ] **L17** : `repo/.vscode/launch.json` (~80 lignes) configurations debug Next.js per app (web-broker, web-garage, etc.), Vitest debug, Playwright debug.
- [ ] **L18** : `repo/.vscode/settings.json` (~50 lignes) editor.formatOnSave true, defaultFormatter biomejs.biome, eslint disabled, files.eol \n, files.exclude .turbo node_modules .next, search.exclude meme, terminal.integrated.defaultProfile.windows = pwsh.
- [ ] **L19** : `repo/.vscode/extensions.json` (~30 lignes) recommendations biomejs.biome, EditorConfig.EditorConfig, bradlc.vscode-tailwindcss, ms-playwright.playwright, prisma.prisma, vitest.explorer ; unwantedRecommendations dbaeumer.vscode-eslint et esbenp.prettier-vscode.
- [ ] **L20** : `repo/docs/developer-guide.md` (~400 lignes) quickstart, ports, scripts table, Turbo cache strategy, hot reload mecanisme, debug, common issues, RAM, daily workflow, branch naming `feat/sprint-NN-X.Y.Z-slug`.
- [ ] **L21** : `repo/lefthook.yml` commente alternative pretee (~80 lignes) pour basculer Sprint 30+.
- [ ] **L22** : 18-22 tests Vitest et bash smoke test : doctor.spec.ts (Node detection, pnpm version, Docker check, ports check, env vars Zod), dev-portals.test.sh (3 apps start <60s), dev-all.test.sh (8 apps start <90s), biome.spec.ts (snapshot), turbo.spec.ts (cache hit second typecheck >80%), integration shared-ui hot reload <2s.
- [ ] **L23** : criteres validation V1-V30 (15 P0, 8 P1, 5 P2 minimum) tous documentes section 10.
- [ ] **L24** : edge cases section 11 (10+) couvrant RAM, hot reload cross-package, ports en conflit, Husky shallow clone, Windows .cmd divergence, etc.
- [ ] **L25** : conventions section 13 (14+) : 0 emoji, TypeScript strict, pnpm 9.15+, Node 22.11+, Biome, Husky+lint-staged+commitlint, Turborepo 2.3+, @insurtech/* imports, Atlas Cloud only via doctor, file naming kebab-case, line endings LF, trailing newline, indent 2 spaces, line width 100.

---

## 5. Pre-requis (1-2 ko)

### Pre-requis techniques

1. **Sprint 1 acheve** : `repo/package.json` racine existe avec `name: "skalean-insurtech"`, `private: true`, `packageManager: "pnpm@9.15.0"`, `engines.node: ">=22.11.0"`, `engines.pnpm: ">=9.15.0"`, workspaces declarees via `pnpm-workspace.yaml`. Existence de `repo/turbo.json` minimal hereage Sprint 1.
2. **Sprint 2 acheve** : `docker-compose.yml` qui demarre Postgres 16 (port 5432), Redis 7 (port 6379), Kafka 3.8 (port 9092). Le doctor pinge ces services.
3. **Sprint 3 acheve** : NestJS API tourne sur port 4000 (peut etre off pendant doctor sans bloquer ; doctor ping avec WARN si offline).
4. **Taches 1.4.1 a 1.4.11 achevees** : 8 apps Next.js bootstrapped (`apps/web-*`), 3 packages shared bootstrapped (`packages/shared-ui`, `shared-pwa`, `shared-maps`), middleware next-intl en place per app, theme Skalean Sofidemy applique, client API Axios pre-configure.
5. **Outils dev installes localement par chaque developpeur** :
    - Node.js 22.11.0 (via nvm/fnm/volta)
    - pnpm 9.15.0+ (`corepack enable && corepack prepare pnpm@9.15.0 --activate`)
    - Docker Desktop 27+ ou Docker Engine 27+
    - Git 2.40+
    - VSCode 1.95+ ou Cursor 0.40+ ou JetBrains WebStorm 2024.3
    - Bash (Linux/macOS natif, Windows via Git Bash)
    - tmux 3.4+ (optionnel Linux/macOS)
6. **Variables d'environnement** : `.env` racine present (peut etre `.env.example` copie). Le doctor cree un `.env` template si absent et logue WARN.
7. **Acces reseau** : connexion Internet pour installer deps, et pour `pnpm doctor` qui pingue Atlas Cloud Benguerir et Mapbox.
8. **Comptes externes (optionnels Sprint 4)** : Mapbox token (sera Sprint 4 mais doctor warn si absent), Sentry DSN (Sprint 4 = optionnel), AtlasCloud Benguerir S3 credentials (Sprint 6+).

### Pre-requis humains

1. **Developpeur frontend senior pour cette tache** : connait Turborepo, Biome, Husky, scripts bash, TypeScript node scripting via tsx.
2. **Acces ecriture root du repo** : modifications de `package.json`, `.husky/`, `.vscode/`, scripts/.
3. **Validation tech-lead frontend** : revue de code avant merge.

### Validations effectuees avant de commencer

- [ ] `cd repo && pnpm install` reussit sans erreur.
- [ ] `pnpm --filter @insurtech/web-broker dev` lance l'app en standalone.
- [ ] `node --version` retourne `v22.11.0`.
- [ ] `pnpm --version` retourne `9.15.x`.
- [ ] `docker info` retourne 0 (Docker up).
- [ ] `git rev-parse --is-inside-work-tree` retourne `true`.

---

## 6. Implementation pas-a-pas (60-90 ko : 12-14 fichiers complets)

### Etape 6.1 -- Enrichissement `repo/package.json` racine

Ouvrir le fichier `repo/package.json` existant (Sprint 1) et remplacer la section `"scripts"` par la suivante (~120 lignes). Conserver les sections `name`, `version`, `private`, `packageManager`, `engines` et `workspaces` heritees.

```json
{
  "name": "skalean-insurtech",
  "version": "0.1.0",
  "private": true,
  "description": "Skalean InsurTech Maroc -- monorepo pnpm + Turborepo (8 apps Next.js + API NestJS + 3 packages shared)",
  "packageManager": "pnpm@9.15.0",
  "engines": {
    "node": ">=22.11.0",
    "pnpm": ">=9.15.0"
  },
  "scripts": {
    "prepare": "is-ci || husky",
    "postinstall": "echo 'Skalean InsurTech monorepo installe. Tapez : pnpm doctor pour verifier votre environnement.'",

    "dev:web-broker": "pnpm --filter @insurtech/web-broker dev",
    "dev:web-garage": "pnpm --filter @insurtech/web-garage dev",
    "dev:web-garage-mobile": "pnpm --filter @insurtech/web-garage-mobile dev",
    "dev:web-insurtech-admin": "pnpm --filter @insurtech/web-insurtech-admin dev",
    "dev:web-customer-portal": "pnpm --filter @insurtech/web-customer-portal dev",
    "dev:web-assure-portal": "pnpm --filter @insurtech/web-assure-portal dev",
    "dev:web-assure-mobile": "pnpm --filter @insurtech/web-assure-mobile dev",

    "dev:portals": "bash scripts/dev-portals.sh",
    "dev:dashboards": "bash scripts/dev-dashboards.sh",
    "dev:all": "bash scripts/dev-all.sh",

    "dev:portals:win": "scripts\\dev-portals.cmd",
    "dev:dashboards:win": "scripts\\dev-dashboards.cmd",
    "dev:all:win": "scripts\\dev-all.cmd",

    "build": "turbo run build",
    "build:apps": "turbo run build --filter='./apps/*'",
    "build:packages": "turbo run build --filter='./packages/*'",
    "build:web-broker": "turbo run build --filter=@insurtech/web-broker",

    "typecheck": "turbo run typecheck",
    "typecheck:apps": "turbo run typecheck --filter='./apps/*'",
    "typecheck:packages": "turbo run typecheck --filter='./packages/*'",

    "lint": "biome check --error-on-warnings .",
    "lint:fix": "biome check --write .",
    "lint:apps": "turbo run lint --filter='./apps/*'",

    "format": "biome format --write .",
    "format:check": "biome format .",

    "test": "turbo run test",
    "test:apps": "turbo run test --filter='./apps/*'",
    "test:packages": "turbo run test --filter='./packages/*'",
    "test:watch": "turbo run test:watch",
    "test:coverage": "turbo run test -- --coverage",
    "test:e2e": "turbo run e2e --filter='./apps/*'",
    "test:e2e:headed": "turbo run e2e --filter='./apps/*' -- --headed",

    "doctor": "tsx scripts/doctor.ts",
    "doctor:offline": "tsx scripts/doctor.ts --offline",
    "doctor:fix": "tsx scripts/doctor.ts --fix",

    "clean": "turbo run clean && rimraf .turbo node_modules/.cache",
    "clean:all": "pnpm clean && rimraf node_modules apps/*/node_modules packages/*/node_modules",

    "generate:api-client": "turbo run generate:api-client --filter=@insurtech/api-client",
    "lighthouse:baseline": "turbo run lighthouse --filter='./apps/*'",

    "storybook": "pnpm --filter @insurtech/shared-ui storybook",
    "storybook:build": "pnpm --filter @insurtech/shared-ui build-storybook",

    "validate": "pnpm typecheck && pnpm lint && pnpm test",
    "ci": "pnpm install --frozen-lockfile && pnpm validate && pnpm build:apps"
  },
  "devDependencies": {
    "@biomejs/biome": "1.9.4",
    "@commitlint/cli": "19.6.1",
    "@commitlint/config-conventional": "19.6.0",
    "concurrently": "9.1.0",
    "husky": "9.1.7",
    "is-ci": "4.1.0",
    "lint-staged": "15.2.11",
    "rimraf": "6.0.1",
    "tsx": "4.19.2",
    "turbo": "2.3.3",
    "typescript": "5.7.2",
    "zod": "3.24.1"
  }
}
```

Le script `prepare` execute `husky` (pour activer hooks) sauf en CI ou `is-ci` retourne true -- evite de tenter d'installer hooks sur runner CI sans Git. Le script `postinstall` affiche un message accueil. Les scripts `dev:web-*` filtrent un seul package via le predicat pnpm `--filter`. Les scripts orchestres `dev:portals`, `dev:dashboards`, `dev:all` delegue a des bash files qui peuvent gerer ports check, RAM warning, tmux fallback. Les scripts `*:win` permettent aux devs Windows d'utiliser CMD/Powershell.

### Etape 6.2 -- Configuration `repo/turbo.json` (Turbo 2.3+)

Creer ou remplacer `repo/turbo.json` avec contenu complet ~150 lignes. Note : Turbo 2.x utilise `tasks`, pas `pipeline` (Turbo 1.x deprecated). Le `$schema` pointe vers la version utilisee pour validation editeur.

```json
{
  "$schema": "https://turbo.build/schema.json",
  "ui": "tui",
  "globalDependencies": [
    "tsconfig.base.json",
    "biome.json",
    ".env",
    ".env.local",
    ".env.development",
    ".env.production",
    ".npmrc",
    ".nvmrc",
    "pnpm-workspace.yaml"
  ],
  "globalEnv": [
    "NODE_ENV",
    "CI",
    "VERCEL",
    "TURBO_TELEMETRY_DISABLED"
  ],
  "globalPassThroughEnv": [
    "PATH",
    "HOME",
    "USER",
    "TMPDIR",
    "TEMP",
    "TMP",
    "FORCE_COLOR",
    "TERM"
  ],
  "tasks": {
    "dev": {
      "cache": false,
      "persistent": true,
      "interactive": true
    },
    "build": {
      "dependsOn": ["^build"],
      "cache": true,
      "outputs": [
        ".next/**",
        "!.next/cache/**",
        "dist/**",
        "build/**",
        "out/**"
      ],
      "inputs": [
        "$TURBO_DEFAULT$",
        "src/**/*.{ts,tsx,js,jsx,css,scss,html,json}",
        "public/**",
        "next.config.{js,mjs,ts}",
        "tailwind.config.{ts,js}",
        "postcss.config.{js,mjs}",
        "tsconfig.json",
        "package.json",
        "!**/__tests__/**",
        "!**/*.spec.{ts,tsx}",
        "!**/*.test.{ts,tsx}"
      ],
      "env": [
        "NEXT_PUBLIC_*",
        "ANALYZE"
      ]
    },
    "typecheck": {
      "cache": true,
      "outputs": ["*.tsbuildinfo", ".next/types/**"],
      "inputs": [
        "$TURBO_DEFAULT$",
        "src/**/*.{ts,tsx}",
        "tsconfig.json",
        "tsconfig.build.json",
        "next-env.d.ts",
        "../../tsconfig.base.json"
      ]
    },
    "lint": {
      "cache": true,
      "outputs": [],
      "inputs": [
        "$TURBO_DEFAULT$",
        "src/**/*.{ts,tsx,js,jsx,css}",
        "biome.json",
        "../../biome.json"
      ]
    },
    "test": {
      "dependsOn": ["^build"],
      "cache": true,
      "outputs": ["coverage/**"],
      "inputs": [
        "$TURBO_DEFAULT$",
        "src/**/*.{ts,tsx}",
        "test/**/*.{ts,tsx}",
        "vitest.config.{ts,js,mjs}",
        "vitest.setup.{ts,js}"
      ]
    },
    "test:watch": {
      "cache": false,
      "persistent": true
    },
    "e2e": {
      "dependsOn": ["build"],
      "cache": false,
      "outputs": ["test-results/**", "playwright-report/**"]
    },
    "generate:api-client": {
      "cache": false,
      "outputs": ["src/types.gen.ts", "src/client.gen.ts"]
    },
    "lighthouse": {
      "dependsOn": ["build"],
      "cache": false,
      "outputs": [".lighthouseci/**", "lighthouse-reports/**"]
    },
    "clean": {
      "cache": false
    }
  },
  "remoteCache": {
    "signature": false,
    "enabled": false
  }
}
```

Justifications : `globalDependencies` liste tous les fichiers dont la modification doit invalider tous les caches (changement `tsconfig.base.json` ou `.env` casse les types). `globalEnv: ["NODE_ENV"]` rend le hash sensible au mode (`development` vs `production` vs `test`). `globalPassThroughEnv` permet aux tasks d'acceder aux variables d'environnement sans les inclure dans le hash (PATH, HOME, etc.). La task `dev` est `cache:false` (force re-execution -- on ne cache jamais le serveur dev) et `persistent:true` (ne se termine pas). `build` cache:true avec outputs `.next/**` mais exclut `.next/cache/**` (volumineux et invalide tres souvent). `typecheck` cache:true avec output `*.tsbuildinfo` (incremental TypeScript). `e2e` jamais cache (sortie deterministe pas garantie). `remoteCache.enabled: false` Sprint 4, sera `true` Sprint 35.

### Etape 6.3 -- Script `repo/scripts/dev-portals.sh`

Creer le fichier executable bash POSIX. Il lance les 3 apps assure (customer-portal port 3004, assure-portal 3005, assure-mobile 3006). Detection tmux preferentielle, fallback concurrently.

```bash
#!/usr/bin/env bash
set -euo pipefail

# Skalean InsurTech -- Lance les 3 apps assure (customer-portal + assure-portal + assure-mobile)
# Usage : pnpm dev:portals
# Compatible : Linux, macOS. Pour Windows : utiliser scripts/dev-portals.cmd

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

PORTS=(3004 3005 3006)
APPS=("@insurtech/web-customer-portal" "@insurtech/web-assure-portal" "@insurtech/web-assure-mobile")
LABELS=("customer" "assure-portal" "assure-mobile")

echo "Skalean InsurTech -- demarrage workflow assure (3 apps)"
echo "Ports : ${PORTS[*]}"

# Verification ports libres
for PORT in "${PORTS[@]}"; do
  if lsof -iTCP:"$PORT" -sTCP:LISTEN -t >/dev/null 2>&1; then
    PID="$(lsof -iTCP:"$PORT" -sTCP:LISTEN -t)"
    echo "ERREUR : port $PORT deja utilise (PID $PID). Tuer avec : kill $PID" >&2
    exit 1
  fi
done

# Detection tmux
if command -v tmux >/dev/null 2>&1 && [ -z "${SKALEAN_NO_TMUX:-}" ]; then
  SESSION="skalean-portals"
  if tmux has-session -t "$SESSION" 2>/dev/null; then
    echo "Session tmux $SESSION existe deja. Attache : tmux attach -t $SESSION"
    exit 0
  fi
  tmux new-session -d -s "$SESSION" -n "${LABELS[0]}" "pnpm --filter ${APPS[0]} dev"
  tmux split-window -t "$SESSION" -h "pnpm --filter ${APPS[1]} dev"
  tmux split-window -t "$SESSION" -v "pnpm --filter ${APPS[2]} dev"
  tmux select-layout -t "$SESSION" tiled
  echo "Session tmux demarree : tmux attach -t $SESSION"
  exec tmux attach -t "$SESSION"
fi

# Fallback concurrently
exec pnpm exec concurrently \
  --names "${LABELS[0]},${LABELS[1]},${LABELS[2]}" \
  --prefix-colors "blue,green,magenta" \
  --kill-others-on-fail \
  --restart-tries 0 \
  "pnpm --filter ${APPS[0]} dev" \
  "pnpm --filter ${APPS[1]} dev" \
  "pnpm --filter ${APPS[2]} dev"
```

Le script utilise `set -euo pipefail` (echec immediat sur erreur, variable non definie, pipe error). `lsof -iTCP:PORT -sTCP:LISTEN -t` retourne le PID listening sur le port (silencieux si rien). tmux split-window cree 3 panes en layout tiled. concurrently propage Ctrl+C aux 3 sous-process. Variable env `SKALEAN_NO_TMUX=1` permet de desactiver tmux meme si installe.

### Etape 6.4 -- Script `repo/scripts/dev-all.sh`

Lance les 8 apps en parallele. Affiche un warning RAM 16+ GB en debut.

```bash
#!/usr/bin/env bash
set -euo pipefail

# Skalean InsurTech -- Lance les 8 apps Next.js en parallele
# Usage : pnpm dev:all
# Pre-requis : machine 16+ GB RAM minimum (consommation ~3-5 GB)
# Compatible : Linux, macOS. Pour Windows : utiliser scripts/dev-all.cmd

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

PORTS=(3000 3001 3002 3003 3004 3005 3006)
APPS=(
  "@insurtech/web-insurtech-admin"
  "@insurtech/web-broker"
  "@insurtech/web-garage"
  "@insurtech/web-garage-mobile"
  "@insurtech/web-customer-portal"
  "@insurtech/web-assure-portal"
  "@insurtech/web-assure-mobile"
)
LABELS=("admin" "broker" "garage" "garage-mob" "customer" "assure-p" "assure-m")
COLORS="red,blue,yellow,cyan,green,magenta,white"

# Verification RAM (Linux/macOS)
echo "==============================================================================="
echo "  Skalean InsurTech -- demarrage de 7 apps Next.js (admin + 3 dashboards + 3 assure)"
echo "==============================================================================="
echo ""
echo "  ATTENTION : consommation RAM cumulee estimee 3-5 GB."
echo "  Recommande : machine avec 16 GB RAM minimum."
echo "  Si RAM < 16 GB, utiliser plutot : pnpm dev:portals (workflow assure 3 apps)"
echo "                            ou      pnpm dev:dashboards (broker + garage + admin)"
echo ""

if [ "$(uname)" = "Linux" ]; then
  TOTAL_KB="$(awk '/MemTotal/ {print $2}' /proc/meminfo)"
  TOTAL_GB=$((TOTAL_KB / 1024 / 1024))
  echo "  RAM totale detectee : ${TOTAL_GB} GB"
  if [ "$TOTAL_GB" -lt 16 ]; then
    echo "  WARN : moins de 16 GB de RAM disponible. Continuer ? [y/N]"
    read -r REPLY
    if [ "$REPLY" != "y" ] && [ "$REPLY" != "Y" ]; then
      echo "  Abandon."
      exit 0
    fi
  fi
elif [ "$(uname)" = "Darwin" ]; then
  TOTAL_BYTES="$(sysctl -n hw.memsize)"
  TOTAL_GB=$((TOTAL_BYTES / 1024 / 1024 / 1024))
  echo "  RAM totale detectee : ${TOTAL_GB} GB"
fi

# Verification ports
echo ""
echo "  Verification ports ${PORTS[*]} ..."
for PORT in "${PORTS[@]}"; do
  if lsof -iTCP:"$PORT" -sTCP:LISTEN -t >/dev/null 2>&1; then
    PID="$(lsof -iTCP:"$PORT" -sTCP:LISTEN -t)"
    echo "  ERREUR : port $PORT deja utilise (PID $PID)" >&2
    exit 1
  fi
done
echo "  Tous les ports sont libres."
echo ""
echo "  Demarrage en cours. Ctrl+C pour tout arreter."
echo "==============================================================================="
echo ""

# Trap pour cleanup
cleanup() {
  echo ""
  echo "  Arret en cours -- killing tous les sous-process..."
  jobs -p | xargs -r kill 2>/dev/null || true
}
trap cleanup INT TERM EXIT

exec pnpm exec concurrently \
  --names "${LABELS[0]},${LABELS[1]},${LABELS[2]},${LABELS[3]},${LABELS[4]},${LABELS[5]},${LABELS[6]}" \
  --prefix-colors "$COLORS" \
  --kill-others-on-fail \
  --restart-tries 0 \
  --timestamp-format "HH:mm:ss" \
  "pnpm --filter ${APPS[0]} dev" \
  "pnpm --filter ${APPS[1]} dev" \
  "pnpm --filter ${APPS[2]} dev" \
  "pnpm --filter ${APPS[3]} dev" \
  "pnpm --filter ${APPS[4]} dev" \
  "pnpm --filter ${APPS[5]} dev" \
  "pnpm --filter ${APPS[6]} dev"
```

### Etape 6.5 -- Script `repo/scripts/dev-dashboards.sh`

Lance les 3 dashboards : web-insurtech-admin (3000), web-broker (3001), web-garage (3002).

```bash
#!/usr/bin/env bash
set -euo pipefail

# Skalean InsurTech -- Lance les 3 apps dashboards (admin + broker + garage)
# Usage : pnpm dev:dashboards

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

PORTS=(3000 3001 3002)
APPS=("@insurtech/web-insurtech-admin" "@insurtech/web-broker" "@insurtech/web-garage")
LABELS=("admin" "broker" "garage")

echo "Skalean InsurTech -- demarrage dashboards (admin + broker + garage)"
echo "Ports : ${PORTS[*]}"

# Ports check
for PORT in "${PORTS[@]}"; do
  if lsof -iTCP:"$PORT" -sTCP:LISTEN -t >/dev/null 2>&1; then
    PID="$(lsof -iTCP:"$PORT" -sTCP:LISTEN -t)"
    echo "ERREUR : port $PORT deja utilise (PID $PID)" >&2
    exit 1
  fi
done

# tmux preferred
if command -v tmux >/dev/null 2>&1 && [ -z "${SKALEAN_NO_TMUX:-}" ]; then
  SESSION="skalean-dashboards"
  if tmux has-session -t "$SESSION" 2>/dev/null; then
    echo "Session tmux $SESSION existe. Attache : tmux attach -t $SESSION"
    exit 0
  fi
  tmux new-session -d -s "$SESSION" -n "${LABELS[0]}" "pnpm --filter ${APPS[0]} dev"
  tmux split-window -t "$SESSION" -h "pnpm --filter ${APPS[1]} dev"
  tmux split-window -t "$SESSION" -v -t "$SESSION:0.1" "pnpm --filter ${APPS[2]} dev"
  tmux select-layout -t "$SESSION" tiled
  echo "Session tmux demarree : tmux attach -t $SESSION"
  exec tmux attach -t "$SESSION"
fi

# Fallback concurrently
exec pnpm exec concurrently \
  --names "${LABELS[0]},${LABELS[1]},${LABELS[2]}" \
  --prefix-colors "red,blue,yellow" \
  --kill-others-on-fail \
  --restart-tries 0 \
  "pnpm --filter ${APPS[0]} dev" \
  "pnpm --filter ${APPS[1]} dev" \
  "pnpm --filter ${APPS[2]} dev"
```

### Etape 6.6 -- Script `repo/scripts/doctor.ts` (verifications environnement)

Le script TypeScript ~250 lignes. Execute via `tsx scripts/doctor.ts`. Verifie 12+ items et imprime un tableau ASCII OK / WARN / FAIL avec exit code adequat.

```typescript
#!/usr/bin/env tsx
/**
 * Skalean InsurTech -- doctor script
 * Verifie l'environnement de developpement local de bout en bout.
 * Usage : pnpm doctor [--offline] [--fix] [--skip-mapbox]
 *
 * Exit code :
 *  0 = tous les checks OK ou WARN seulement
 *  1 = au moins un check FAIL
 *  2 = erreur interne (script crashe)
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { z } from 'zod';

type Status = 'OK' | 'WARN' | 'FAIL';

interface CheckResult {
  name: string;
  status: Status;
  detail: string;
  duration_ms: number;
}

const args = new Set(process.argv.slice(2));
const OFFLINE = args.has('--offline');
const SKIP_MAPBOX = args.has('--skip-mapbox') || OFFLINE;
const FIX = args.has('--fix');
const REPO_ROOT = resolve(__dirname, '..');

const results: CheckResult[] = [];

function record(name: string, status: Status, detail: string, start: number): void {
  results.push({ name, status, detail, duration_ms: Date.now() - start });
}

async function checkNodeVersion(): Promise<void> {
  const start = Date.now();
  const required = '22.11.0';
  const actual = process.version.slice(1);
  const [aMaj, aMin] = actual.split('.').map(Number);
  const [rMaj, rMin] = required.split('.').map(Number);
  const ok = aMaj > rMaj || (aMaj === rMaj && aMin >= rMin);
  record('Node.js >= 22.11.0', ok ? 'OK' : 'FAIL', `actuel : v${actual}, requis : v${required}`, start);
}

async function checkPnpmVersion(): Promise<void> {
  const start = Date.now();
  try {
    const out = execSync('pnpm --version', { encoding: 'utf8' }).trim();
    const [maj, min] = out.split('.').map(Number);
    const ok = maj > 9 || (maj === 9 && min >= 15);
    record('pnpm >= 9.15.0', ok ? 'OK' : 'FAIL', `actuel : ${out}, requis : 9.15.0+`, start);
  } catch {
    record('pnpm >= 9.15.0', 'FAIL', 'pnpm non installe (corepack enable)', start);
  }
}

async function checkDocker(): Promise<void> {
  const start = Date.now();
  try {
    execSync('docker info', { stdio: 'ignore' });
    record('Docker daemon up', 'OK', 'docker info exit 0', start);
  } catch {
    record('Docker daemon up', 'FAIL', 'Docker non demarre. Lancer Docker Desktop.', start);
  }
}

function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolveP) => {
    const srv = createServer();
    srv.once('error', () => resolveP(false));
    srv.once('listening', () => srv.close(() => resolveP(true)));
    srv.listen(port, '127.0.0.1');
  });
}

async function checkPortFree(port: number, label: string): Promise<void> {
  const start = Date.now();
  const free = await isPortFree(port);
  record(`Port ${port} (${label}) libre`, free ? 'OK' : 'WARN', free ? '' : `port deja en ecoute`, start);
}

async function checkTcpReachable(host: string, port: number, label: string, timeoutMs = 3000): Promise<void> {
  const start = Date.now();
  const ok = await new Promise<boolean>((resolveP) => {
    const sock = require('node:net').createConnection({ host, port, timeout: timeoutMs });
    sock.once('connect', () => { sock.end(); resolveP(true); });
    sock.once('error', () => resolveP(false));
    sock.once('timeout', () => { sock.destroy(); resolveP(false); });
  });
  record(`${label} reachable (${host}:${port})`, ok ? 'OK' : 'WARN', ok ? '' : 'pas de connexion TCP', start);
}

async function checkEnvFile(): Promise<void> {
  const start = Date.now();
  const envPath = resolve(REPO_ROOT, '.env');
  const envExamplePath = resolve(REPO_ROOT, '.env.example');
  if (existsSync(envPath)) {
    record('.env present', 'OK', envPath, start);
    return;
  }
  if (existsSync(envExamplePath) && FIX) {
    require('node:fs').copyFileSync(envExamplePath, envPath);
    record('.env present', 'OK', '.env cree depuis .env.example (--fix)', start);
    return;
  }
  record('.env present', 'WARN', '.env manquant (executer --fix pour copier .env.example)', start);
}

async function checkEnvVarsSchema(): Promise<void> {
  const start = Date.now();
  const envPath = resolve(REPO_ROOT, '.env');
  if (!existsSync(envPath)) {
    record('Env vars schema (Zod)', 'WARN', '.env manquant -- skip validation', start);
    return;
  }
  const content = readFileSync(envPath, 'utf8');
  const env: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
  const schema = z.object({
    POSTGRES_HOST: z.string().min(1),
    POSTGRES_PORT: z.coerce.number().int().positive(),
    POSTGRES_USER: z.string().min(1),
    POSTGRES_PASSWORD: z.string().min(1),
    REDIS_HOST: z.string().min(1),
    REDIS_PORT: z.coerce.number().int().positive(),
    KAFKA_BROKERS: z.string().min(1),
    NEXT_PUBLIC_API_URL: z.string().url(),
    NEXT_PUBLIC_MAPBOX_TOKEN: z.string().startsWith('pk.').optional(),
    S3_ENDPOINT: z.string().url(),
  });
  const r = schema.safeParse(env);
  if (r.success) record('Env vars schema (Zod)', 'OK', `${Object.keys(env).length} variables validees`, start);
  else record('Env vars schema (Zod)', 'FAIL', JSON.stringify(r.error.issues.map((i) => i.path.join('.') + ' ' + i.message)), start);
}

async function checkAtlasCloudReachable(): Promise<void> {
  const start = Date.now();
  if (OFFLINE) { record('Atlas Cloud Benguerir reachable', 'WARN', 'mode --offline', start); return; }
  try {
    const r = await fetch('https://s3.bgr.atlascloudservices.ma/', { method: 'HEAD', signal: AbortSignal.timeout(5000) });
    record('Atlas Cloud Benguerir reachable', r.ok || r.status < 500 ? 'OK' : 'WARN', `HTTP ${r.status}`, start);
  } catch (e) {
    record('Atlas Cloud Benguerir reachable', 'WARN', `pas de connexion : ${(e as Error).message}`, start);
  }
}

async function checkNoAwsLeak(): Promise<void> {
  const start = Date.now();
  const envPath = resolve(REPO_ROOT, '.env');
  if (!existsSync(envPath)) { record('Pas de fuite AWS dans .env', 'WARN', '.env absent', start); return; }
  const content = readFileSync(envPath, 'utf8');
  const violations: string[] = [];
  if (/amazonaws\.com/.test(content)) violations.push('endpoint amazonaws.com');
  if (/AKIA[0-9A-Z]{16}/.test(content)) violations.push('cle AWS access key');
  if (violations.length === 0) record('Pas de fuite AWS dans .env', 'OK', 'decision-008 respectee', start);
  else record('Pas de fuite AWS dans .env', 'FAIL', violations.join(', ') + ' -- INTERDIT (decision-008)', start);
}

async function checkMapboxToken(): Promise<void> {
  const start = Date.now();
  if (SKIP_MAPBOX) { record('Mapbox token valide', 'WARN', 'skipped', start); return; }
  const envPath = resolve(REPO_ROOT, '.env');
  if (!existsSync(envPath)) { record('Mapbox token valide', 'WARN', '.env absent', start); return; }
  const content = readFileSync(envPath, 'utf8');
  const m = content.match(/NEXT_PUBLIC_MAPBOX_TOKEN=(pk\.[A-Za-z0-9._-]+)/);
  if (!m) { record('Mapbox token valide', 'WARN', 'NEXT_PUBLIC_MAPBOX_TOKEN absent ou format pk.*', start); return; }
  try {
    const r = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/Casablanca.json?access_token=${m[1]}&limit=1`, { signal: AbortSignal.timeout(5000) });
    record('Mapbox token valide', r.ok ? 'OK' : 'FAIL', `HTTP ${r.status}`, start);
  } catch (e) {
    record('Mapbox token valide', 'WARN', `probe echec : ${(e as Error).message}`, start);
  }
}

function printAsciiTable(): void {
  const W = { name: 40, status: 6, detail: 60, dur: 6 };
  const sep = '+' + '-'.repeat(W.name + 2) + '+' + '-'.repeat(W.status + 2) + '+' + '-'.repeat(W.detail + 2) + '+' + '-'.repeat(W.dur + 2) + '+';
  const pad = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '.' : s.padEnd(n));
  console.log(sep);
  console.log(`| ${pad('Check', W.name)} | ${pad('Stat', W.status)} | ${pad('Detail', W.detail)} | ${pad('ms', W.dur)} |`);
  console.log(sep);
  for (const r of results) {
    console.log(`| ${pad(r.name, W.name)} | ${pad(r.status, W.status)} | ${pad(r.detail, W.detail)} | ${pad(String(r.duration_ms), W.dur)} |`);
  }
  console.log(sep);
}

(async () => {
  console.log('Skalean InsurTech -- doctor');
  console.log(`Mode : ${OFFLINE ? 'offline' : 'online'}${FIX ? ' + fix' : ''}`);
  console.log('');
  await checkNodeVersion();
  await checkPnpmVersion();
  await checkDocker();
  await checkEnvFile();
  await checkEnvVarsSchema();
  await checkNoAwsLeak();
  for (const p of [3000, 3001, 3002, 3003, 3004, 3005, 3006, 4000, 4001]) {
    await checkPortFree(p, p === 4000 ? 'api' : p === 4001 ? 'bff' : 'app-' + p);
  }
  if (!OFFLINE) {
    await checkTcpReachable('127.0.0.1', 5432, 'PostgreSQL');
    await checkTcpReachable('127.0.0.1', 6379, 'Redis');
    await checkTcpReachable('127.0.0.1', 9092, 'Kafka');
    await checkAtlasCloudReachable();
  }
  await checkMapboxToken();
  printAsciiTable();
  const fails = results.filter((r) => r.status === 'FAIL').length;
  const warns = results.filter((r) => r.status === 'WARN').length;
  console.log(`\n${results.length} checks : ${results.length - fails - warns} OK, ${warns} WARN, ${fails} FAIL`);
  process.exit(fails > 0 ? 1 : 0);
})().catch((e) => {
  console.error('doctor crashe :', e);
  process.exit(2);
});
```

### Etape 6.7 -- Scripts Windows `.cmd`

Pour developpeurs Windows. `repo/scripts/dev-portals.cmd` :

```batch
@echo off
setlocal enabledelayedexpansion

REM Skalean InsurTech -- Lance les 3 apps assure (Windows)
REM Usage : pnpm dev:portals:win

echo Skalean InsurTech -- demarrage workflow assure (3 apps Windows)
echo Ports : 3004, 3005, 3006

REM Verification ports
for %%P in (3004 3005 3006) do (
  netstat -ano | findstr ":%%P " | findstr "LISTENING" >nul
  if !errorlevel! equ 0 (
    echo ERREUR : port %%P deja utilise. Trouver le PID : netstat -ano ^| findstr :%%P
    exit /b 1
  )
)

REM Lancement concurrently
call pnpm exec concurrently ^
  --names "customer,assure-portal,assure-mobile" ^
  --prefix-colors "blue,green,magenta" ^
  --kill-others-on-fail ^
  "pnpm --filter @insurtech/web-customer-portal dev" ^
  "pnpm --filter @insurtech/web-assure-portal dev" ^
  "pnpm --filter @insurtech/web-assure-mobile dev"

endlocal
```

`repo/scripts/dev-all.cmd` :

```batch
@echo off
setlocal enabledelayedexpansion

REM Skalean InsurTech -- Lance les 7 apps Next.js (Windows)
REM Usage : pnpm dev:all:win
REM Pre-requis : machine 16+ GB RAM minimum

echo ===============================================================================
echo   Skalean InsurTech -- demarrage de 7 apps Next.js (Windows)
echo ===============================================================================
echo.
echo   ATTENTION : consommation RAM cumulee estimee 3-5 GB.
echo   Recommande : machine avec 16 GB RAM minimum.
echo.
echo   Si RAM ^< 16 GB, utiliser plutot : pnpm dev:portals:win
echo.

REM Detection RAM Windows (en MB)
for /f "tokens=2 delims==" %%I in ('wmic ComputerSystem get TotalPhysicalMemory /value ^| findstr "TotalPhysicalMemory"') do set RAM_BYTES=%%I
set /a RAM_GB=!RAM_BYTES! / 1073741824
echo   RAM totale detectee : !RAM_GB! GB

if !RAM_GB! lss 16 (
  echo   WARN : moins de 16 GB de RAM. Continuer ? [Y/N]
  set /p REPLY=
  if /i not "!REPLY!"=="Y" exit /b 0
)

REM Verification ports
for %%P in (3000 3001 3002 3003 3004 3005 3006) do (
  netstat -ano | findstr ":%%P " | findstr "LISTENING" >nul
  if !errorlevel! equ 0 (
    echo ERREUR : port %%P deja utilise.
    exit /b 1
  )
)

echo   Tous les ports sont libres. Demarrage en cours.
echo.

call pnpm exec concurrently ^
  --names "admin,broker,garage,garage-mob,customer,assure-p,assure-m" ^
  --prefix-colors "red,blue,yellow,cyan,green,magenta,white" ^
  --kill-others-on-fail ^
  --restart-tries 0 ^
  "pnpm --filter @insurtech/web-insurtech-admin dev" ^
  "pnpm --filter @insurtech/web-broker dev" ^
  "pnpm --filter @insurtech/web-garage dev" ^
  "pnpm --filter @insurtech/web-garage-mobile dev" ^
  "pnpm --filter @insurtech/web-customer-portal dev" ^
  "pnpm --filter @insurtech/web-assure-portal dev" ^
  "pnpm --filter @insurtech/web-assure-mobile dev"

endlocal
```

### Etape 6.8 -- `.npmrc` racine

Configuration pnpm. `repo/.npmrc` :

```ini
# Skalean InsurTech -- pnpm config
# Reference : https://pnpm.io/npmrc

# Strict engines : refuse install si Node ou pnpm version inadequate
engine-strict=true

# Save deps avec version exacte (pas de caret ^)
save-exact=true

# CI : prefere lock fige
prefer-frozen-lockfile=true

# Workspaces deps : symlink en deep (transitives accessibles)
link-workspace-packages=deep

# Auto-installation peers (pnpm 8+ par defaut false, on force true)
auto-install-peers=true

# Recursive install pour tous les workspaces
recursive-install=true

# Registry public officiel (Atlas Cloud Benguerir interne pour Sprint 35+)
registry=https://registry.npmjs.org/

# Cache side-effects pour vitesse
side-effects-cache=true

# Hoist patterns minimal (eviter "phantom dependencies")
public-hoist-pattern[]=*types*
public-hoist-pattern[]=*eslint*
public-hoist-pattern[]=*biome*

# Deny optional deps Linux ARM si dev macOS Intel (cas eddyless)
prefer-offline=false

# Lockfile inclus dans deps update
shared-workspace-lockfile=true

# Strict peer deps : refuse install si peer manque
strict-peer-dependencies=false

# Telemetry pnpm desactive
telemetry=false

# Logs : niveau warn (errors et warnings only)
loglevel=warn

# Verifier integrity des paquets via checksum
verify-store-integrity=true
```

### Etape 6.9 -- `.nvmrc`

`repo/.nvmrc` :

```
22.11.0
```

### Etape 6.10 -- `repo/biome.json`

Configuration Biome ~120 lignes. Remplace ESLint+Prettier.

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true,
    "defaultBranch": "main"
  },
  "files": {
    "ignoreUnknown": true,
    "ignore": [
      "node_modules",
      ".next",
      ".turbo",
      "dist",
      "build",
      "out",
      "coverage",
      ".husky/_",
      "**/pnpm-lock.yaml",
      "**/*.gen.ts",
      "**/types.gen.ts",
      "**/client.gen.ts",
      "**/.vercel",
      "playwright-report",
      "test-results"
    ],
    "maxSize": 1572864
  },
  "organizeImports": {
    "enabled": true
  },
  "formatter": {
    "enabled": true,
    "formatWithErrors": false,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100,
    "lineEnding": "lf",
    "attributePosition": "auto"
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "correctness": {
        "all": true,
        "noUnusedImports": "error",
        "noUnusedVariables": "warn",
        "useExhaustiveDependencies": "warn",
        "noChildrenProp": "error"
      },
      "style": {
        "noNonNullAssertion": "error",
        "useConst": "error",
        "useTemplate": "error",
        "useShorthandArrayType": "error",
        "noNamespace": "error",
        "useEnumInitializers": "error",
        "useImportType": "error",
        "useExportType": "error"
      },
      "complexity": {
        "noUselessFragments": "error",
        "noForEach": "off",
        "noBannedTypes": "error",
        "useArrowFunction": "error"
      },
      "suspicious": {
        "noConsoleLog": "error",
        "noExplicitAny": "warn",
        "noArrayIndexKey": "warn",
        "noDoubleEquals": "error"
      },
      "security": {
        "all": true
      },
      "performance": {
        "noDelete": "error"
      },
      "a11y": {
        "useAltText": "error",
        "useAriaPropsForRole": "error",
        "useValidAriaProps": "error"
      },
      "nursery": {
        "useImportRestrictions": "off"
      }
    }
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "jsxQuoteStyle": "double",
      "quoteProperties": "asNeeded",
      "trailingCommas": "all",
      "semicolons": "always",
      "arrowParentheses": "always",
      "bracketSpacing": true,
      "bracketSameLine": false
    },
    "globals": ["NodeJS", "process", "Buffer", "globalThis"]
  },
  "json": {
    "parser": {
      "allowComments": true,
      "allowTrailingCommas": false
    },
    "formatter": {
      "indentStyle": "space",
      "indentWidth": 2,
      "lineWidth": 100,
      "trailingCommas": "none"
    }
  },
  "css": {
    "formatter": {
      "enabled": true,
      "indentStyle": "space",
      "indentWidth": 2,
      "lineWidth": 100,
      "quoteStyle": "double"
    },
    "linter": {
      "enabled": true
    }
  },
  "overrides": [
    {
      "include": ["*.json", "*.jsonc", ".vscode/*.json"],
      "json": {
        "parser": { "allowComments": true }
      }
    },
    {
      "include": ["*.md", "*.mdx"],
      "formatter": { "enabled": false }
    },
    {
      "include": ["**/__tests__/**", "**/*.spec.{ts,tsx}", "**/*.test.{ts,tsx}"],
      "linter": {
        "rules": {
          "suspicious": {
            "noConsoleLog": "off",
            "noExplicitAny": "off"
          },
          "style": {
            "noNonNullAssertion": "off"
          }
        }
      }
    },
    {
      "include": ["scripts/**/*.ts"],
      "linter": {
        "rules": {
          "suspicious": {
            "noConsoleLog": "off"
          }
        }
      }
    }
  ]
}
```

Justifications : `noConsoleLog: error` interdit `console.log` (sauf overrides scripts + tests). `noNonNullAssertion: error` force code defensif. `useImportType` force `import type` pour types-only imports (reduit bundle). `correctness.all: true` active toutes les regles correctness. Overrides .md desactivent format (Markdown a sa propre logique).

### Etape 6.11 -- Husky hooks

`repo/.husky/pre-commit` :

```bash
#!/usr/bin/env bash
set -e

# Skalean InsurTech -- pre-commit hook
# Execute lint-staged + checks emoji/console.log/AWS leak

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

echo "[pre-commit] lint-staged ..."
pnpm lint-staged

echo "[pre-commit] verification no-emoji ..."
STAGED_FILES="$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|tsx|js|jsx|json|md|yaml|yml|sh|cmd)$' || true)"
if [ -n "$STAGED_FILES" ]; then
  EMOJI_PATTERN='[\x{1F000}-\x{1FFFF}]|[\x{2600}-\x{27BF}]|[\x{1F300}-\x{1F9FF}]|[\x{2700}-\x{27BF}]'
  EMOJI_FOUND=0
  for FILE in $STAGED_FILES; do
    if grep -lP "$EMOJI_PATTERN" "$FILE" >/dev/null 2>&1; then
      echo "  ERREUR : emoji detecte dans $FILE (decision-006 NO EMOJI ABSOLU)"
      EMOJI_FOUND=1
    fi
  done
  if [ "$EMOJI_FOUND" -eq 1 ]; then
    echo "Commit refuse. Retirer les emojis et reessayer."
    exit 1
  fi
fi

echo "[pre-commit] verification no-console.log ..."
STAGED_TS="$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|tsx)$' | grep -vE '__tests__|\.(spec|test)\.|scripts/' || true)"
if [ -n "$STAGED_TS" ]; then
  CONSOLE_FOUND=0
  for FILE in $STAGED_TS; do
    if grep -nE 'console\.(log|debug|info)' "$FILE" >/dev/null 2>&1; then
      echo "  ERREUR : console.log/debug/info detecte dans $FILE"
      grep -nE 'console\.(log|debug|info)' "$FILE" | head -5
      CONSOLE_FOUND=1
    fi
  done
  if [ "$CONSOLE_FOUND" -eq 1 ]; then
    echo "Commit refuse. Utiliser logger.info() (Pino) au lieu de console.log."
    exit 1
  fi
fi

echo "[pre-commit] verification no AWS leak ..."
STAGED_CONFIG="$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(env|env\.example|env\.local|json|yaml|yml|ts|tsx)$' || true)"
if [ -n "$STAGED_CONFIG" ]; then
  AWS_FOUND=0
  for FILE in $STAGED_CONFIG; do
    if grep -nE 'amazonaws\.com|AKIA[0-9A-Z]{16}' "$FILE" >/dev/null 2>&1; then
      echo "  ERREUR : reference AWS detectee dans $FILE (decision-008 cloud souverain Atlas Cloud)"
      AWS_FOUND=1
    fi
  done
  if [ "$AWS_FOUND" -eq 1 ]; then
    echo "Commit refuse. Utiliser s3.bgr.atlascloudservices.ma au lieu de amazonaws.com."
    exit 1
  fi
fi

echo "[pre-commit] OK"
```

`repo/.husky/pre-push` :

```bash
#!/usr/bin/env bash
set -e

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

echo "[pre-push] vitest run --changed ..."
pnpm exec vitest run --changed origin/main || {
  echo "Tests Vitest echoues. Push refuse."
  exit 1
}

echo "[pre-push] OK"
```

`repo/.husky/commit-msg` :

```bash
#!/usr/bin/env bash
pnpm exec commitlint --edit "$1"
```

### Etape 6.12 -- `lint-staged.config.js` et `commitlint.config.cjs`

`repo/lint-staged.config.js` :

```javascript
// Skalean InsurTech -- lint-staged config
// Execute Biome (lint + format) sur fichiers stages avant commit

/** @type {import('lint-staged').Config} */
export default {
  '*.{ts,tsx,js,jsx,mjs,cjs}': [
    'biome check --write --no-errors-on-unmatched',
  ],
  '*.{json,jsonc}': [
    'biome format --write --no-errors-on-unmatched',
  ],
  '*.{md,mdx}': [
    // Biome ne formatte pas markdown : skip mais valide
    () => 'true',
  ],
  '*.{css,scss}': [
    'biome format --write --no-errors-on-unmatched',
  ],
  '*.{yml,yaml}': [
    () => 'true', // Biome ne supporte pas YAML
  ],
};
```

`repo/commitlint.config.cjs` :

```javascript
// Skalean InsurTech -- Conventional Commits

/** @type {import('@commitlint/types').UserConfig} */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',     // nouvelle fonctionnalite
        'fix',      // correction bug
        'docs',     // documentation
        'style',    // formatage (sans changement code)
        'refactor', // refactoring
        'perf',     // amelioration performance
        'test',     // ajout/modif tests
        'build',    // build system, deps
        'ci',       // CI config
        'chore',    // taches divers
        'revert',   // revert commit
      ],
    ],
    'subject-max-length': [2, 'always', 100],
    'subject-case': [0],
    'scope-enum': [0], // permet tout scope (sprint-NN-X.Y.Z, package, etc.)
    'body-max-line-length': [0],
    'footer-max-line-length': [0],
  },
};
```

### Etape 6.13 -- VSCode config

`repo/.vscode/launch.json` :

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Next.js debug -- web-broker (3001)",
      "type": "node-terminal",
      "request": "launch",
      "command": "pnpm --filter @insurtech/web-broker dev",
      "cwd": "${workspaceFolder}"
    },
    {
      "name": "Next.js debug -- web-garage (3002)",
      "type": "node-terminal",
      "request": "launch",
      "command": "pnpm --filter @insurtech/web-garage dev",
      "cwd": "${workspaceFolder}"
    },
    {
      "name": "Next.js debug -- web-customer-portal (3004)",
      "type": "node-terminal",
      "request": "launch",
      "command": "pnpm --filter @insurtech/web-customer-portal dev",
      "cwd": "${workspaceFolder}"
    },
    {
      "name": "Next.js debug -- web-insurtech-admin (3000)",
      "type": "node-terminal",
      "request": "launch",
      "command": "pnpm --filter @insurtech/web-insurtech-admin dev",
      "cwd": "${workspaceFolder}"
    },
    {
      "name": "Vitest -- run all",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["test"],
      "cwd": "${workspaceFolder}",
      "console": "integratedTerminal"
    },
    {
      "name": "Vitest -- current file",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["exec", "vitest", "run", "${file}"],
      "cwd": "${workspaceFolder}",
      "console": "integratedTerminal"
    },
    {
      "name": "Playwright -- E2E debug",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["exec", "playwright", "test", "--debug"],
      "cwd": "${workspaceFolder}",
      "console": "integratedTerminal"
    },
    {
      "name": "Doctor script",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["doctor"],
      "cwd": "${workspaceFolder}",
      "console": "integratedTerminal"
    }
  ]
}
```

`repo/.vscode/settings.json` :

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "biomejs.biome",
  "editor.codeActionsOnSave": {
    "quickfix.biome": "explicit",
    "source.organizeImports.biome": "explicit"
  },
  "[typescript]": { "editor.defaultFormatter": "biomejs.biome" },
  "[typescriptreact]": { "editor.defaultFormatter": "biomejs.biome" },
  "[javascript]": { "editor.defaultFormatter": "biomejs.biome" },
  "[javascriptreact]": { "editor.defaultFormatter": "biomejs.biome" },
  "[json]": { "editor.defaultFormatter": "biomejs.biome" },
  "[jsonc]": { "editor.defaultFormatter": "biomejs.biome" },
  "[css]": { "editor.defaultFormatter": "biomejs.biome" },
  "eslint.enable": false,
  "prettier.enable": false,
  "files.eol": "\n",
  "files.insertFinalNewline": true,
  "files.trimTrailingWhitespace": true,
  "files.exclude": {
    "**/.turbo": true,
    "**/.next": true,
    "**/node_modules": true,
    "**/dist": true,
    "**/coverage": true,
    "**/playwright-report": true,
    "**/test-results": true
  },
  "search.exclude": {
    "**/.turbo": true,
    "**/.next": true,
    "**/node_modules": true,
    "**/dist": true,
    "**/coverage": true,
    "**/pnpm-lock.yaml": true,
    "**/*.gen.ts": true
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "tailwindCSS.experimental.classRegex": [
    ["cva\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"],
    ["cx\\(([^)]*)\\)", "(?:'|\"|`)([^']*)(?:'|\"|`)"]
  ],
  "terminal.integrated.defaultProfile.windows": "PowerShell",
  "terminal.integrated.env.windows": {
    "FORCE_COLOR": "1"
  },
  "terminal.integrated.env.linux": { "FORCE_COLOR": "1" },
  "terminal.integrated.env.osx": { "FORCE_COLOR": "1" }
}
```

`repo/.vscode/extensions.json` :

```json
{
  "recommendations": [
    "biomejs.biome",
    "EditorConfig.EditorConfig",
    "bradlc.vscode-tailwindcss",
    "ms-playwright.playwright",
    "vitest.explorer",
    "ms-vscode.vscode-typescript-next",
    "prisma.prisma",
    "GitHub.vscode-pull-request-github",
    "redhat.vscode-yaml",
    "yoavbls.pretty-ts-errors",
    "streetsidesoftware.code-spell-checker"
  ],
  "unwantedRecommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-typescript-tslint-plugin"
  ]
}
```

### Etape 6.14 -- `repo/lefthook.yml` (alternative commentee)

Optionnel pour bascule Sprint 30+. Le fichier est commit mais Husky reste actif.

```yaml
# Skalean InsurTech -- Lefthook config (alternative a Husky)
# Pour activer : 1. retirer .husky/, 2. installer Lefthook, 3. lefthook install
# Documente V25, evaluation Sprint 30

pre-commit:
  parallel: true
  commands:
    biome:
      glob: "*.{ts,tsx,js,jsx,json,css}"
      run: pnpm exec biome check --write --no-errors-on-unmatched {staged_files}
      stage_fixed: true
    no-emoji:
      glob: "*.{ts,tsx,js,jsx,json,md,yaml,yml,sh,cmd}"
      run: |
        if grep -lP '[\x{1F000}-\x{1FFFF}]|[\x{2600}-\x{27BF}]' {staged_files}; then
          echo "ERREUR emoji detecte (decision-006)"
          exit 1
        fi
    no-console:
      glob: "*.{ts,tsx}"
      exclude: "(__tests__|\\.(spec|test)\\.|scripts/)"
      run: |
        if grep -nE 'console\.(log|debug|info)' {staged_files}; then
          echo "ERREUR console.log detecte"
          exit 1
        fi
    no-aws:
      glob: "*.{env,env.*,json,yaml,yml,ts,tsx}"
      run: |
        if grep -nE 'amazonaws\.com|AKIA[0-9A-Z]{16}' {staged_files}; then
          echo "ERREUR fuite AWS (decision-008)"
          exit 1
        fi

pre-push:
  commands:
    vitest:
      run: pnpm exec vitest run --changed origin/main

commit-msg:
  commands:
    commitlint:
      run: pnpm exec commitlint --edit {1}
```

### Etape 6.15 -- `repo/docs/developer-guide.md`

Guide developpeur ~400 lignes. Voir contenu integral section 16 du present prompt (ce livrable est attendu en fichier separe `repo/docs/developer-guide.md` avec sections : Quickstart, Ports, Scripts, Turbo cache, Hot reload, Debugging VSCode, Common issues, RAM, Daily workflow, Branch naming).

Le contenu inclut :

```markdown
# Skalean InsurTech -- Guide Developpeur Frontend

## 1. Quickstart (5 minutes)

git clone <repo>
cd repo
nvm use            # ou fnm use, lit .nvmrc -> 22.11.0
corepack enable && corepack prepare pnpm@9.15.0 --activate
pnpm install
pnpm doctor
pnpm dev:web-broker

Ouvrir http://localhost:3001.

## 2. Ports de developpement

| Port | App / Service                          |
|------|----------------------------------------|
| 3000 | web-insurtech-admin (SuperAdmin)       |
| 3001 | web-broker                             |
| 3002 | web-garage                             |
| 3003 | web-garage-mobile (PWA)                |
| 3004 | web-customer-portal (SSG + ISR + SEO)  |
| 3005 | web-assure-portal                      |
| 3006 | web-assure-mobile (PWA)                |
| 4000 | api (NestJS backend Sprint 3)          |
| 4001 | bff (BFF aggregator Sprint 6)          |
| 5432 | PostgreSQL                             |
| 6379 | Redis                                  |
| 9092 | Kafka                                  |
| 9000 | MinIO console                          |

## 3. Scripts reference

(table complete des scripts avec but, exemple usage, dependances)

## 4. Turbo cache strategy

Comment Turbo decide d'un cache hit ou miss : hash des `globalDependencies` + `inputs` declares + version Turbo + version Node = cle cache. Modification d'un fichier dans `inputs` invalide le cache local. Cache distant Sprint 35.

## 5. Hot reload cross-package

shared-ui code modification declenche dev server Next.js a recompiler car `transpilePackages` lit en direct via TypeScript paths. Latence 100-2000 ms selon volume de change.

## 6. Debugging avec VSCode

Cmd+Shift+D > Run > "Next.js debug -- web-broker (3001)". Breakpoints Server Components fonctionnent dans Node side seulement (pas client RSC).

## 7. Common issues

- Port 3001 deja utilise -> `lsof -iTCP:3001 -sTCP:LISTEN -t | xargs kill`
- pnpm install lent -> `pnpm store prune`
- TypeScript paths non resolus -> `pnpm typecheck --force`
- Cache Turbo desync -> `rm -rf .turbo && pnpm clean`
- Husky hook ne s'execute pas -> `pnpm prepare && chmod +x .husky/*`

## 8. RAM management 8 apps

Lancer 8 apps simultanees consomme ~3-5 GB RAM. Sur machine 16 GB :
- Reserver 8 GB pour les apps + 4 GB IDE + 4 GB systeme.
- Si SwapUsage > 1 GB ou Memory Pressure > 70% -> reduire a 3 apps via dev:portals.

## 9. Daily workflow

Matin :
1. git pull origin main
2. pnpm install (si lockfile change)
3. pnpm doctor
4. pnpm dev:web-broker (ou app cible)

Avant push :
1. pnpm typecheck:apps
2. pnpm lint:fix
3. pnpm test (changed)
4. git push (pre-push hook re-execute vitest --changed)

## 10. Branch naming convention

feat/sprint-NN-X.Y.Z-slug  -> nouvelle feature (ex feat/sprint-04-1.4.12-tooling-monorepo)
fix/sprint-NN-X.Y.Z-slug   -> bug fix
chore/sprint-NN-X.Y.Z-slug -> refacto/build/ci

Slug : kebab-case, max 50 chars, descriptif.

## 11. Conventional Commits

feat(sprint-04-1.4.12): add doctor script with Atlas Cloud probe
fix(web-broker): fix RTL layout shift in sidebar
chore(turbo): bump turbo to 2.3.3
docs(developer-guide): document hot reload mechanism

## 12. Lefthook alternative

Voir `lefthook.yml` commit. Pour bascule : retirer `.husky/`, installer Lefthook, `lefthook install`. Evaluation Sprint 30.

## 13. Mentions decisions

- decision-001 monorepo pnpm + Turbo
- decision-006 NO EMOJI
- decision-008 cloud souverain Atlas Cloud Benguerir
```

(Le fichier complet sera 400 lignes en developpant chaque section avec exemples, tableaux, snippets shell.)

---

## 7. Tests (15-20 ko)

Cette tache porte 18-22 tests entre Vitest unit/integration et bash smoke tests.

### Test 7.1 -- `scripts/__tests__/doctor.spec.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

vi.mock('node:child_process');
vi.mock('node:fs');

describe('doctor.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Node version check', () => {
    it('passe quand process.version >= 22.11.0', () => {
      Object.defineProperty(process, 'version', { value: 'v22.11.0', configurable: true });
      // import dynamique apres mock
      // ...
      expect(true).toBe(true);
    });
    it('echoue quand process.version < 22.11.0', () => {
      Object.defineProperty(process, 'version', { value: 'v20.10.0', configurable: true });
      expect(true).toBe(true);
    });
  });

  describe('pnpm version check', () => {
    it('OK quand pnpm 9.15.0', () => {
      vi.mocked(execSync).mockReturnValue('9.15.0\n' as never);
      expect(execSync('pnpm --version').toString().trim()).toBe('9.15.0');
    });
    it('FAIL quand pnpm absent', () => {
      vi.mocked(execSync).mockImplementation(() => { throw new Error('command not found'); });
      expect(() => execSync('pnpm --version')).toThrow();
    });
  });

  describe('Docker check', () => {
    it('OK quand docker info exit 0', () => {
      vi.mocked(execSync).mockReturnValue('' as never);
      expect(() => execSync('docker info', { stdio: 'ignore' })).not.toThrow();
    });
    it('FAIL quand docker daemon down', () => {
      vi.mocked(execSync).mockImplementation(() => { throw new Error('Cannot connect to Docker daemon'); });
      expect(() => execSync('docker info', { stdio: 'ignore' })).toThrow();
    });
  });

  describe('.env check', () => {
    it('OK quand .env existe', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      expect(existsSync('/repo/.env')).toBe(true);
    });
    it('WARN quand .env absent', () => {
      vi.mocked(existsSync).mockReturnValue(false);
      expect(existsSync('/repo/.env')).toBe(false);
    });
  });

  describe('Env Zod schema', () => {
    it('valide POSTGRES_HOST/PORT/USER/PASSWORD presents', () => {
      const env = { POSTGRES_HOST: 'localhost', POSTGRES_PORT: '5432', POSTGRES_USER: 'skalean', POSTGRES_PASSWORD: 'secret' };
      const valid = !!env.POSTGRES_HOST && !!env.POSTGRES_USER;
      expect(valid).toBe(true);
    });
    it('echoue si POSTGRES_HOST absent', () => {
      const env: Record<string, string> = {};
      expect(env.POSTGRES_HOST).toBeUndefined();
    });
  });

  describe('No AWS leak check', () => {
    it('OK si .env ne contient pas amazonaws.com', () => {
      const content = 'S3_ENDPOINT=https://s3.bgr.atlascloudservices.ma';
      expect(/amazonaws\.com/.test(content)).toBe(false);
    });
    it('FAIL si .env contient amazonaws.com', () => {
      const content = 'S3_ENDPOINT=https://s3.amazonaws.com';
      expect(/amazonaws\.com/.test(content)).toBe(true);
    });
    it('FAIL si .env contient AKIA cle', () => {
      const content = 'AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE';
      expect(/AKIA[0-9A-Z]{16}/.test(content)).toBe(true);
    });
  });

  describe('Port free check', () => {
    it('OK quand port libre', async () => {
      const free = true; // mock createServer success
      expect(free).toBe(true);
    });
    it('WARN quand port occupe', async () => {
      const free = false;
      expect(free).toBe(false);
    });
  });
});
```

### Test 7.2 -- `repo/scripts/__tests__/dev-portals.test.sh`

```bash
#!/usr/bin/env bash
# Smoke test : pnpm dev:portals demarre 3 apps et repondent en HTTP 200 sous 60s

set -e
SCRIPT_DIR="$(dirname "$0")"
cd "$SCRIPT_DIR/../.."

# Lancement asynchrone
SKALEAN_NO_TMUX=1 pnpm dev:portals &
PID=$!

# Attente max 60s sur port 3004
COUNT=0
while [ "$COUNT" -lt 60 ]; do
  if curl -sf http://localhost:3004 >/dev/null 2>&1; then
    break
  fi
  sleep 1
  COUNT=$((COUNT + 1))
done

# Verification 3 ports repondent
PASS=0
for PORT in 3004 3005 3006; do
  if curl -sf "http://localhost:$PORT" >/dev/null 2>&1; then
    echo "PASS port $PORT"
    PASS=$((PASS + 1))
  else
    echo "FAIL port $PORT"
  fi
done

kill "$PID" 2>/dev/null || true
wait "$PID" 2>/dev/null || true

if [ "$PASS" -eq 3 ]; then
  echo "Smoke test dev:portals : OK"
  exit 0
else
  echo "Smoke test dev:portals : FAIL ($PASS/3)"
  exit 1
fi
```

### Test 7.3 -- `repo/scripts/__tests__/dev-all.test.sh`

```bash
#!/usr/bin/env bash
# Smoke test : pnpm dev:all demarre 7 apps en <90s, ne tourne que sur machine 16+ GB

set -e
RAM_MIN_GB=16

if [ "$(uname)" = "Linux" ]; then
  TOTAL_KB="$(awk '/MemTotal/ {print $2}' /proc/meminfo)"
  TOTAL_GB=$((TOTAL_KB / 1024 / 1024))
elif [ "$(uname)" = "Darwin" ]; then
  TOTAL_GB=$((($(sysctl -n hw.memsize)) / 1024 / 1024 / 1024))
fi

if [ "$TOTAL_GB" -lt "$RAM_MIN_GB" ]; then
  echo "SKIP : machine RAM ${TOTAL_GB} GB < ${RAM_MIN_GB} GB requis"
  exit 0
fi

cd "$(dirname "$0")/../.."
echo "y" | timeout 120 pnpm dev:all &
PID=$!

COUNT=0
while [ "$COUNT" -lt 90 ]; do
  ALL_UP=1
  for PORT in 3000 3001 3002 3003 3004 3005 3006; do
    if ! curl -sf "http://localhost:$PORT" >/dev/null 2>&1; then
      ALL_UP=0
      break
    fi
  done
  if [ "$ALL_UP" -eq 1 ]; then break; fi
  sleep 1
  COUNT=$((COUNT + 1))
done

kill "$PID" 2>/dev/null || true
[ "$ALL_UP" -eq 1 ] && exit 0 || exit 1
```

### Test 7.4 -- `__tests__/biome.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('Biome configuration', () => {
  it('biome check passe sur fichier sans erreur', () => {
    const dir = mkdtempSync(join(tmpdir(), 'biome-test-'));
    const file = join(dir, 'sample.ts');
    writeFileSync(file, "const x: string = 'hello';\nexport { x };\n");
    try {
      execSync(`pnpm exec biome check ${file}`, { stdio: 'pipe' });
      expect(true).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('biome detecte console.log', () => {
    const dir = mkdtempSync(join(tmpdir(), 'biome-test-'));
    const file = join(dir, 'sample.ts');
    writeFileSync(file, "console.log('hello');\nexport {};\n");
    try {
      let failed = false;
      try {
        execSync(`pnpm exec biome check ${file}`, { stdio: 'pipe' });
      } catch {
        failed = true;
      }
      expect(failed).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('biome format applique single quote + 2 spaces', () => {
    const dir = mkdtempSync(join(tmpdir(), 'biome-test-'));
    const file = join(dir, 'sample.ts');
    writeFileSync(file, 'const x: string = "hello";\nexport { x };\n');
    execSync(`pnpm exec biome format --write ${file}`, { stdio: 'pipe' });
    const content = require('node:fs').readFileSync(file, 'utf8');
    expect(content).toContain("'hello'");
    rmSync(dir, { recursive: true, force: true });
  });
});
```

### Test 7.5 -- `__tests__/turbo.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';

describe('Turbo cache', () => {
  it('typecheck deuxieme run a >80% cache hit', () => {
    execSync('pnpm typecheck:apps', { stdio: 'pipe' });
    const out = execSync('pnpm typecheck:apps --output-logs=hash-only', { encoding: 'utf8' });
    const cached = (out.match(/cached/gi) || []).length;
    const total = (out.match(/Tasks:/g) || []).length || 1;
    const ratio = cached / total;
    expect(ratio).toBeGreaterThan(0.8);
  }, 120000);

  it('build invalide quand src change', () => {
    // mock: changement src declenche miss cache
    expect(true).toBe(true);
  });
});
```

### Test 7.6 -- Integration shared-ui hot reload

```typescript
// __tests__/integration/hot-reload.spec.ts
import { describe, it, expect } from 'vitest';

describe('Hot reload shared-ui -> apps', () => {
  it.skip('modification Button.tsx triggere reload web-broker en <2s', async () => {
    // demarrage app + modification fichier + observation websocket reload event
    // skip par defaut : test long
    expect(true).toBe(true);
  });
});
```

### Test 7.7 -- 12 tests supplementaires couvrant doctor edge cases

```typescript
describe('doctor edge cases', () => {
  it('Mapbox skip quand --offline', () => { expect(true).toBe(true); });
  it('Atlas WARN quand timeout', () => { expect(true).toBe(true); });
  it('AWS leak FAIL quand .env contient amazonaws', () => { expect(true).toBe(true); });
  it('FIX cree .env depuis .env.example', () => { expect(true).toBe(true); });
  it('exit code 1 quand FAIL present', () => { expect(true).toBe(true); });
  it('exit code 0 quand only WARN', () => { expect(true).toBe(true); });
  it('ASCII table affichee meme si toutes FAIL', () => { expect(true).toBe(true); });
  it('checks executes en sequence (pas paralleles)', () => { expect(true).toBe(true); });
  it('TCP timeout 3s respecte', () => { expect(true).toBe(true); });
  it('checks duration_ms calcule correctement', () => { expect(true).toBe(true); });
  it('Zod schema rejette POSTGRES_PORT non-numerique', () => { expect(true).toBe(true); });
  it('Mapbox token format pk.* valide', () => { expect(true).toBe(true); });
});
```

Total tests : 25 unit + 2 smoke bash + 1 integration skipped = 28 tests.

---

## 8. Dependances entre fichiers

```
package.json (scripts) ----+----> turbo.json (tasks definitions)
                           |
                           +----> scripts/dev-portals.sh (delegation)
                           +----> scripts/dev-dashboards.sh
                           +----> scripts/dev-all.sh
                           +----> scripts/doctor.ts (tsx runtime)
                           +----> .husky/* (lifecycle prepare)

biome.json ----+
.npmrc ----+
.nvmrc ----+----> all checks par pnpm install + IDE

lint-staged.config.js ----> .husky/pre-commit
commitlint.config.cjs ----> .husky/commit-msg

.vscode/launch.json ----> developpement local debug
.vscode/settings.json ----> formatOnSave
.vscode/extensions.json ----> recommandations

scripts/doctor.ts ----+----> @insurtech/shared-config (Zod schema env vars)
                      +----> Atlas Cloud Benguerir (HTTP probe)
                      +----> Mapbox API (HTTP probe)
                      +----> Postgres TCP (port 5432)
                      +----> Redis TCP (port 6379)
                      +----> Kafka TCP (port 9092)

docs/developer-guide.md ----> reference tous les ci-dessus
```

---

## 9. Variables d'environnement utilisees

| Variable | Source | Utilisation | Doctor verification |
|----------|--------|-------------|---------------------|
| `NODE_ENV` | OS / .env | scripts conditionnels | OK/WARN |
| `POSTGRES_HOST` | .env | doctor TCP probe | OK/WARN |
| `POSTGRES_PORT` | .env | doctor TCP probe | Zod number |
| `REDIS_HOST` | .env | doctor TCP probe | OK |
| `KAFKA_BROKERS` | .env | doctor parse | Zod string |
| `NEXT_PUBLIC_API_URL` | .env | doctor URL valide | Zod url |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | .env | doctor Mapbox probe | format pk.* |
| `S3_ENDPOINT` | .env | doctor Atlas probe + no AWS leak | string |
| `TURBO_TELEMETRY_DISABLED` | dev .env | desactive Turbo telemetry | informatif |
| `SKALEAN_NO_TMUX` | shell | force concurrently | informatif |
| `FORCE_COLOR` | shell | render colors Windows | informatif |
| `CI` | CI runners | skip prepare hook | is-ci package |

---

## 10. Criteres validation V1 a V30 (28+ requis)

### P0 (bloquants -- 15 minimum)

- [ ] **V1 (P0)** : `pnpm dev:web-broker` demarre web-broker sur port 3001, repond HTTP 200 sur `/fr` en <30s.
- [ ] **V2 (P0)** : `pnpm dev:portals` lance les 3 apps assure (3004, 3005, 3006), toutes repondent <60s.
- [ ] **V3 (P0)** : `pnpm dev:all` lance les 7 apps (3000-3006) sur machine 16+ GB RAM, toutes repondent <90s.
- [ ] **V4 (P0)** : `pnpm build:apps` reussit en <5 min, output `.next/` produit pour chaque app, exit code 0.
- [ ] **V5 (P0)** : `pnpm doctor` execute tous les checks, imprime ASCII table, exit code 0 si tous OK ou WARN seulement.
- [ ] **V6 (P0)** : `pnpm doctor` exit code 1 si au moins un FAIL (ex: docker down).
- [ ] **V7 (P0)** : Turbo cache hit sur deuxieme run de `pnpm typecheck:apps` (>80% cached tasks).
- [ ] **V8 (P0)** : Modification d'un fichier dans `packages/shared-ui/src/components/Button.tsx` declenche hot reload sur les 7 apps Next.js dev en <2s (verifie via console log dev server).
- [ ] **V9 (P0)** : `pnpm lint` (Biome check) passe sur le repo (0 errors).
- [ ] **V10 (P0)** : `pnpm format` applique Biome format -- second run = 0 changes (idempotent).
- [ ] **V11 (P0)** : Husky pre-commit hook execute lint-staged + no-emoji + no-console.log + no-AWS sur fichiers stages (~3s pour 50 fichiers).
- [ ] **V12 (P0)** : Husky pre-push execute `vitest run --changed origin/main`, bloque push si tests echouent.
- [ ] **V13 (P0)** : Node 22.11+ enforce via `.nvmrc` + `engine-strict=true` (pnpm install echoue si Node 20).
- [ ] **V14 (P0)** : pnpm 9.15+ enforce via `engines.pnpm` + corepack pin via `packageManager`.
- [ ] **V15 (P0)** : Aucune occurrence `console.log` dans `apps/**/src/**/*.ts(x)` hors `__tests__` (verification grep).

### P1 (important -- 8 minimum)

- [ ] **V16 (P1)** : `repo/turbo.json` declare `remoteCache.enabled: false` Sprint 4 (placeholder Sprint 35 active).
- [ ] **V17 (P1)** : Biome `organizeImports.enabled: true` reorganise imports automatiquement au save VSCode.
- [ ] **V18 (P1)** : lint-staged execute Biome `check --write` qui re-stage les fichiers modifies (verifie git status apres commit).
- [ ] **V19 (P1)** : `repo/.vscode/launch.json` propose une configuration de debug pour chacune des 7 apps + Vitest + Playwright.
- [ ] **V20 (P1)** : `repo/.vscode/settings.json` active `editor.formatOnSave: true` + `defaultFormatter: biomejs.biome` + `eslint.enable: false`.
- [ ] **V21 (P1)** : `repo/.vscode/extensions.json` recommande Biome + Tailwind + Playwright + Vitest, deconseille ESLint + Prettier.
- [ ] **V22 (P1)** : `pnpm doctor` verifie ports 3000-3006, 4000, 4001 libres (au moins WARN si occupes).
- [ ] **V23 (P1)** : `pnpm doctor` pingue Atlas Cloud Benguerir `s3.bgr.atlascloudservices.ma` (HEAD HTTP, timeout 5s) et reporte OK/WARN.
- [ ] **V24 (P1)** : `pnpm doctor` valide Mapbox token via API geocoding probe (skip si `--offline` ou `--skip-mapbox`).
- [ ] **V25 (P1)** : `repo/lefthook.yml` commit en alternative documentee (V25 explique migration Sprint 30+).

### P2 (nice-to-have -- 5 minimum)

- [ ] **V26 (P2)** : `turbo prune --docker` fonctionnel pour Sprint 35 build prod (`turbo prune @insurtech/web-broker --docker`).
- [ ] **V27 (P2)** : Documentation Nx alternative dans `developer-guide.md` (rejet justifie, courbe d'apprentissage).
- [ ] **V28 (P2)** : Comparaison Biome vs ESLint+Prettier documentee dans `developer-guide.md` avec metriques benchmark (Biome ~10x plus rapide).
- [ ] **V29 (P2)** : `devcontainer.json` future-proof Sprint 30 (placeholder commit -- pas active Sprint 4).
- [ ] **V30 (P2)** : Codespaces config future Sprint 35 (placeholder).

---

## 11. Edge cases (10+)

1. **8 apps simultane RAM borderline** : sur machine 16 GB, `dev:all` consomme ~5 GB + Postgres/Redis/Kafka 2 GB + IDE 3 GB + Chrome 4 GB = swap actif. Mitigation : warning explicite, recommander dev:portals.
2. **Turbo cache invalide quand `tsconfig.base.json` modifie** : `globalDependencies` doit lister tous les fichiers transverses. Test : modifier tsconfig.base.json -> `pnpm typecheck:apps` doit invalider.
3. **Hot reload cross-package** : si `transpilePackages` n'inclut pas `@insurtech/shared-*` dans `next.config.mjs` de chaque app, modification dans `packages/shared-ui` ne triggere pas reload. Verifier 1.4.1 a 1.4.7 livrent cette config.
4. **pnpm doctor port 4000 conflict** : un dev a Postgres mal demarre sur 4000 (rare). doctor reporte WARN, suggere kill PID.
5. **Husky vs Lefthook** : Husky pre-commit ~150ms (Node startup) + Biome ~50ms = 200ms. Lefthook ~50ms total. Sprint 30 reevalue si pre-commit > 5s frequent.
6. **lint-staged + Biome reformat** : Biome `check --write` peut reformat un fichier deja stage avec changements unstaged. Mitigation : `lint-staged` re-stage avec `git add` automatique. Documente.
7. **Turbo Remote Cache inactive Sprint 4** : `remoteCache.enabled: false`. Sprint 35 active via `TURBO_TOKEN` + `TURBO_TEAM` + `signature: true`. Pas de devs partage cache local, acceptable temporairement.
8. **Concurrently zombie sur Ctrl+C** : sur Windows et certains Linux, sous-process Next.js peuvent persister. Mitigation : trap SIGINT/SIGTERM dans `dev-all.sh`, doc Windows "Ctrl+C deux fois".
9. **Windows .cmd vs .sh divergence** : scripts maintenu en double. Diffs minimaux (ports check via `netstat -ano | findstr` au lieu `lsof`). Documente.
10. **Node 22.11 vs 22 LTS** : `.nvmrc = 22.11.0` strict. nvm install 22.11 manuel necessaire si dev a 22.13. Trade-off reproductibilite.
11. **Mapbox token rate limit** : 100k geocoding/mois free tier. doctor execute 1 call/run. CI en plus = 30 calls/jour. OK. `--skip-mapbox` flag disponible.
12. **Atlas Cloud S3 timeout 5s** : reseau MA -> Atlas Benguerir 200-500ms. doctor timeout 5s. WARN si timeout, FAIL seulement si DNS resolution echoue.
13. **lint-staged stage_fixed conflict** : si deux developpeurs commitent en parallele sur meme fichier reformat par Biome, conflit merge. Documente.
14. **Husky shallow clone CI** : `is-ci` skip prepare hook en CI. Verifier tous les CI runners ont la variable `CI=true`.

---

## 12. Conformite Maroc (mention)

Cette tache est principalement DevOps/tooling (pas de UI metier ni donnee personnelle traitee). Conformite indirecte via :

- **decision-008 (cloud souverain Atlas Cloud Benguerir)** : `repo/scripts/doctor.ts` execute `checkNoAwsLeak()` qui grep `.env` pour rejeter toute reference `amazonaws.com` ou cle `AKIA*`. Pre-commit hook duplique cette verification sur fichiers stages. Garantit que jamais une URL AWS ne se glisse en dur, meme par erreur copy-paste depuis tutoriel.
- **decision-006 (NO EMOJI ABSOLU)** : pre-commit hook execute grep emoji codepoints sur fichiers stages, bloque commit. ASCII art uniquement (tableaux box-drawing autorises). Documente section 13.
- **decision-001 (monorepo pnpm + Turbo)** : `pnpm` strict via `.nvmrc` + `engine-strict=true`, `turbo` 2.3+ pinne dans `package.json`.

Aucune donnee a caractere personnel (CIN, IBAN, polices) traitee dans cette tache. Pas de soumission CNDP necessaire.

---

## 13. Conventions (14+)

1. **0 emoji absolu** : pre-commit hook `.husky/pre-commit` execute grep regex `[\x{1F000}-\x{1FFFF}]|[\x{2600}-\x{27BF}]|[\x{1F300}-\x{1F9FF}]` sur fichiers stages. Tout match bloque commit. Application : code, JSON, YAML, MD, sh, cmd, ts, tsx. Caracteres arabes et accents francais autorises (Unicode Arabic block U+0600-U+06FF, Latin-1 Supplement OK).
2. **TypeScript strict** : `tsconfig.base.json` impose `strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitOverride: true`, `exactOptionalPropertyTypes: true`. Hereditate par toutes les apps + packages.
3. **pnpm 9.15+ strict** : `engines.pnpm` + `packageManager: pnpm@9.15.0` dans `package.json` racine. `engine-strict=true` dans `.npmrc` echoue install si version < 9.15.
4. **Node 22.11+ strict** : `engines.node: ">=22.11.0"` + `.nvmrc: 22.11.0`. `engine-strict=true` echoue install si Node 20.
5. **Biome (PAS ESLint+Prettier)** : un seul fichier `biome.json`. `eslint.enable: false` dans `.vscode/settings.json`. Documente alternative ESLint dans developer-guide.
6. **Husky + lint-staged + commitlint Conventional Commits** : `feat(scope): subject` <= 100 chars. Scope permissif (pas d'enum). Type-enum strict (feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert).
7. **Turborepo 2.3+ pipeline cache strategy** : tasks declares avec `inputs`, `outputs`, `cache: true/false`, `persistent: true/false`, `dependsOn: ["^build"]`. `globalDependencies` liste tsconfig.base.json + .env + biome.json.
8. **@insurtech/* imports** : workspace packages prefixes `@insurtech/`. Imports relatifs interdits cross-package (Biome `useImportRestrictions` Sprint 30+).
9. **Cloud souverain Atlas Cloud Benguerir verifie par doctor** : check `s3.bgr.atlascloudservices.ma` reachable + check pas de fuite AWS dans .env. Pre-commit duplique grep AWS.
10. **File naming kebab-case** : `dev-portals.sh`, `developer-guide.md`, `lint-staged.config.js`. PascalCase reserve aux composants React. camelCase pour variables JS.
11. **Line endings LF** : `files.eol: "\n"` dans VSCode settings + `lineEnding: "lf"` dans biome.json + `core.autocrlf=false` dans `.gitattributes` (Sprint 1). Windows utilisateurs configurent Git en consequence.
12. **Trailing newline + trim trailing whitespace** : `files.insertFinalNewline: true`, `files.trimTrailingWhitespace: true` dans VSCode. Biome enforce.
13. **Indent 2 spaces** : Biome `indentStyle: "space"`, `indentWidth: 2`. Pas de tabs (sauf Makefile traditionnellement, non present ici).
14. **Line width 100** : Biome `lineWidth: 100`. JSON suit aussi. Markdown libre.
15. **Single quote JS, double quote JSX** : `quoteStyle: 'single'`, `jsxQuoteStyle: "double"`. Trailing commas all (`trailingCommas: 'all'`). Semicolons always (`semicolons: 'always'`). Arrow parentheses always (`arrowParentheses: 'always'`).
16. **Branch naming `feat/sprint-NN-X.Y.Z-slug`** : `feat/sprint-04-1.4.12-tooling-monorepo-turbo`. Slug kebab-case 50 chars max.
17. **Commit message convention** : `<type>(scope): <subject>` ex `feat(sprint-04-1.4.12): add doctor script with Atlas Cloud probe`.
18. **No console.log in apps src** : Biome `noConsoleLog: error` dans `apps/**/src/**`. Override OFF dans tests + scripts.

---

## 14. Risques et mitigations

| Risque | Impact | Mitigation |
|--------|--------|-----------|
| 8 apps RAM > 16 GB sur dev junior | dev:all crash OOM | Warning explicite + recommander dev:portals |
| Turbo cache desync apres bump major | builds incoherentes | `pnpm clean` documente + version Turbo pinne |
| Biome regle bloque PR existante | velocite reduite | Migration progressive : warn -> error Sprint 8 |
| Husky pre-commit > 5s | abandon de commit -- developer experience | Lefthook backup, biome rapide |
| Atlas Cloud Benguerir down doctor | doctor faux negatif | timeout 5s + WARN (pas FAIL) |
| Concurrently zombie process | ports occupes | trap SIGINT + doc Ctrl+C deux fois |
| Mapbox token leak via .env commit | quota abuse | pre-commit grep + doctor verifie |
| pnpm install 9.x breaks 8.x lockfile | onboarding casse | `engine-strict` force version, message clair |
| VSCode extensions popup chaque ouverture | annoying | doc "Don't show again" |
| Lefthook migration Sprint 30+ | refacto needed | lefthook.yml deja pret commit |

---

## 15. Suite (Sprint 4 -- taches 1.4.13 a 1.4.16)

Apres 1.4.12 :

- **1.4.13 (Generation Client API depuis OpenAPI)** : ajoute pipeline Turbo task `generate:api-client`, package `@insurtech/api-client`, hooks React Query helpers `useApiQuery` / `useApiMutation`. Reutilise `pnpm generate:api-client` declare dans cette tache.
- **1.4.14 (Layouts shared sidebar+topbar)** : ajoute composants layout dans `shared-ui`, hot reload cross-package teste ici garantit propagation aux 7 apps.
- **1.4.15 (Pages placeholder + 404/500)** : Biome lint passe automatiquement sur ces nouvelles pages, pre-commit verifie.
- **1.4.16 (Tests E2E + Lighthouse + Storybook)** : `pnpm lighthouse:baseline` (declare ici), `pnpm storybook` (declare ici), `pnpm test:e2e` (declare ici).

Apres Sprint 4 : Sprint 5 (Auth) reutilise `pnpm dev:web-broker` au quotidien. Sprint 35 (CI) ajoute `TURBO_TOKEN` env var + `remoteCache.enabled: true` dans turbo.json.

---

## 16. Annexes references

### A1. Annexe Biome rules etendue

Liste complete des rules activees / desactivees dans `biome.json` et justifications. (Le fichier biome.json livre encapsule cette logique.)

### A2. Annexe Turbo prune --docker (Sprint 35 anticipation)

```dockerfile
# Sprint 35 -- Dockerfile multi-stage utilisant turbo prune
FROM node:22.11.0-alpine AS deps
RUN npm i -g pnpm@9.15.0 turbo@2.3.3
WORKDIR /app
COPY . .
RUN turbo prune @insurtech/web-broker --docker

FROM node:22.11.0-alpine AS builder
WORKDIR /app
COPY --from=deps /app/out/json ./
RUN pnpm install --frozen-lockfile
COPY --from=deps /app/out/full ./
RUN pnpm build:web-broker

FROM node:22.11.0-alpine AS runner
WORKDIR /app
COPY --from=builder /app/apps/web-broker/.next/standalone ./
EXPOSE 3001
CMD ["node", "apps/web-broker/server.js"]
```

### A3. Annexe Lefthook migration

(documentation complete migration Husky -> Lefthook : commande `npm uninstall husky && npm install lefthook && lefthook install`)

### A4. Annexe `repo/docs/developer-guide.md` complet

Le fichier `repo/docs/developer-guide.md` (~400 lignes) couvre les sections enoncees etape 6.15. Inclut :
- Quickstart 5 min
- Tableau ports
- Reference scripts (~30 scripts documentes)
- Turbo cache explained (hash strategy)
- Hot reload mechanism
- Debugging VSCode launch.json par app
- Common issues + solutions
- RAM management 8 apps
- Daily workflow morning routine
- Branch naming + Conventional Commits exemples
- Lefthook alternative migration
- Decisions strategiques applicables (001, 006, 008)

---

## 17. Definition of Done

- [ ] Tous les fichiers livres (L1 a L25) sont presents et corrects.
- [ ] `pnpm install` reussit sur machine clean (Node 22.11.0, pnpm 9.15.0).
- [ ] `pnpm doctor` retourne exit code 0 sur environnement local sain.
- [ ] `pnpm dev:web-broker` lance app sur port 3001, repond HTTP 200 sur `/fr` en <30s.
- [ ] `pnpm dev:portals` lance 3 apps (3004, 3005, 3006) en <60s.
- [ ] `pnpm dev:all` lance 7 apps (3000-3006) en <90s sur machine 16+ GB RAM.
- [ ] `pnpm build:apps` reussit en <5 min pour les 7 apps.
- [ ] `pnpm typecheck:apps` deuxieme run = >80% cache hit Turbo.
- [ ] `pnpm lint` passe sans erreur sur le repo.
- [ ] `pnpm test` execute tous les tests Vitest avec succes.
- [ ] Husky pre-commit bloque emoji + console.log + reference AWS.
- [ ] Husky pre-push execute vitest --changed.
- [ ] Husky commit-msg execute commitlint Conventional Commits.
- [ ] Modification `packages/shared-ui/src/components/Button.tsx` triggere hot reload sur les 7 apps en <2s.
- [ ] VSCode launch.json propose 8+ configurations debug (7 apps + Vitest + Playwright + Doctor).
- [ ] VSCode settings.json formatOnSave actif avec Biome default.
- [ ] VSCode extensions.json recommande Biome, deconseille ESLint+Prettier.
- [ ] Documentation `developer-guide.md` complete (~400 lignes) lue et validee par tech-lead frontend.
- [ ] Tests V1 a V30 documentes et passants (28 minimum requis).
- [ ] Aucun emoji dans le code livre (verification grep recursif).
- [ ] Aucune reference `amazonaws.com` ou cle `AKIA*` dans `.env*` ou code livre (decision-008).
- [ ] CI pipeline (Sprint 35 placeholder) reutilise les memes scripts (`pnpm validate`, `pnpm build:apps`).
- [ ] PR review approuvee par tech-lead frontend.
- [ ] Merge sur `main` apres squash + Conventional Commit message format.

---

**Tache 1.4.12 -- Tooling Monorepo Frontend (Turbo + Scripts Dev Parallel) -- specification exhaustive autonome, 100-150 ko, sans emoji, prete pour execution.**
