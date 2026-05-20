# Skalean InsurTech -- Guide Developpeur Frontend

**Version** : 2.2 | **Sprint** : 4 | **Reference** : Task 1.4.12

---

## 1. Quickstart (5 minutes)

```bash
git clone git+ssh://git@github.com/skalean/insurtech.git
cd insurtech/repo
nvm use            # ou fnm use -- lit .nvmrc -> 22.20.0
corepack enable && corepack prepare pnpm@9.15.0 --activate
pnpm install
pnpm doctor        # verifie l'environnement
pnpm dev:web-broker
```

Ouvrir http://localhost:3001 dans le navigateur.

### Pre-requis systeme

| Outil | Version | Installation |
|-------|---------|--------------|
| Node.js | 22.20.0 | nvm / fnm / volta |
| pnpm | 9.15.0+ | corepack enable |
| Docker | 27+ | Docker Desktop |
| Git | 2.40+ | brew install git |
| VSCode | 1.95+ | code.visualstudio.com |
| Bash | 5.x | natif Linux/macOS, Git Bash sur Windows |
| tmux | 3.4+ (optionnel) | brew install tmux |

---

## 2. Ports de developpement

| Port | App / Service | Commande |
|------|---------------|---------|
| 3000 | web-insurtech-admin (SuperAdmin) | pnpm dev:web-insurtech-admin |
| 3001 | web-broker | pnpm dev:web-broker |
| 3002 | web-garage | pnpm dev:web-garage |
| 3003 | web-garage-mobile (PWA) | pnpm dev:web-garage-mobile |
| 3004 | web-customer-portal (SSG + ISR + SEO) | pnpm dev:web-customer-portal |
| 3005 | web-assure-portal | pnpm dev:web-assure-portal |
| 3006 | web-assure-mobile (PWA) | pnpm dev:web-assure-mobile |
| 4000 | api (NestJS backend) | pnpm --filter @insurtech/api dev |
| 4001 | bff (BFF aggregator Sprint 6) | non disponible Sprint 4 |
| 5432 | PostgreSQL | docker compose up |
| 6379 | Redis | docker compose up |
| 9092 | Kafka | docker compose up |
| 9000 | MinIO console | docker compose up |

---

## 3. Scripts reference

### Scripts de developpement

| Script | Description | Usage |
|--------|-------------|-------|
| `pnpm dev:web-broker` | Lance uniquement web-broker :3001 | Travail sur broker |
| `pnpm dev:web-garage` | Lance uniquement web-garage :3002 | Travail sur garage |
| `pnpm dev:web-garage-mobile` | Lance uniquement web-garage-mobile :3003 | PWA garage |
| `pnpm dev:web-insurtech-admin` | Lance uniquement admin :3000 | SuperAdmin |
| `pnpm dev:web-customer-portal` | Lance uniquement customer-portal :3004 | Portail client |
| `pnpm dev:web-assure-portal` | Lance uniquement assure-portal :3005 | Portail assure |
| `pnpm dev:web-assure-mobile` | Lance uniquement assure-mobile :3006 | PWA assure |
| `pnpm dev:portals` | Lance les 3 apps assure (3004, 3005, 3006) | Workflow assure |
| `pnpm dev:dashboards` | Lance admin + broker + garage (3000-3002) | Workflow dashboard |
| `pnpm dev:all` | Lance les 7 apps simultanement | Changement transversal shared-ui |
| `pnpm dev:portals:win` | dev:portals pour Windows CMD | Windows |
| `pnpm dev:all:win` | dev:all pour Windows CMD | Windows |

### Scripts de qualite

| Script | Description |
|--------|-------------|
| `pnpm typecheck` | TypeScript typecheck toutes les apps et packages |
| `pnpm typecheck:apps` | TypeScript typecheck apps seulement |
| `pnpm typecheck:packages` | TypeScript typecheck packages seulement |
| `pnpm lint` | Biome lint + format check |
| `pnpm lint:fix` | Biome lint auto-fix |
| `pnpm format` | Biome format write |
| `pnpm test` | Vitest tous les tests |
| `pnpm test:apps` | Vitest apps seulement |
| `pnpm test:packages` | Vitest packages seulement |
| `pnpm test:e2e` | Playwright E2E |
| `pnpm validate` | typecheck + lint + test (pre-PR) |
| `pnpm ci` | install + validate + build:apps (CI) |

### Scripts utilitaires

| Script | Description |
|--------|-------------|
| `pnpm doctor` | Verifie l'environnement local |
| `pnpm doctor:offline` | Doctor sans verifications reseau |
| `pnpm doctor:fix` | Doctor + cree .env si absent |
| `pnpm build` | Build tous les packages et apps |
| `pnpm build:apps` | Build apps seulement |
| `pnpm clean` | Nettoie dist + .turbo cache |
| `pnpm clean:all` | Nettoie tout dont node_modules |
| `pnpm storybook` | Lance Storybook shared-ui |
| `pnpm generate:api-client` | Regenere client TypeScript depuis OpenAPI |
| `pnpm lighthouse:baseline` | Mesure Lighthouse toutes les apps |

### Scripts Docker

| Script | Description |
|--------|-------------|
| `pnpm docker:up` | Demarre Postgres + Redis + Kafka + MinIO |
| `pnpm docker:down` | Arrete les services |
| `pnpm docker:reset` | Reset complet avec suppression volumes |
| `pnpm docker:logs` | Suivi logs en temps reel |
| `pnpm docker:ps` | Status des containers |

---

## 4. Turbo cache strategy

### Comment Turbo calcule un cache hit

```
hash = SHA1(
  globalDependencies files content (tsconfig.base.json, biome.json, .env, .npmrc, ...)
  + inputs files content (src/**/*.ts, tsconfig.json, ...)
  + globalEnv values (NODE_ENV, CI, ...)
  + task definition (cache, outputs, dependsOn)
  + Turbo version
  + Node version
)
```

Si `hash` correspond a une entree dans `.turbo/cache/`, la task est skipee et les outputs sont restaures.

### Tasks et leurs caches

| Task | Cache | Outputs | Invalide si |
|------|-------|---------|-------------|
| `dev` | Non (cache:false) | - | Jamais cached |
| `build` | Oui | .next/**, dist/**, build/** | Modif src/**, tsconfig, next.config |
| `typecheck` | Oui | *.tsbuildinfo | Modif src/**/*.ts, tsconfig |
| `lint` | Oui | - | Modif src/**, biome.json |
| `test` | Oui | coverage/** | Modif src/**, vitest.config |
| `e2e` | Non (cache:false) | playwright-report/** | Jamais cached |
| `generate:api-client` | Non (cache:false) | src/types.gen.ts | Jamais cached |

### Forcer une re-execution

```bash
pnpm turbo run typecheck --force         # ignore le cache
pnpm turbo run build --filter=@insurtech/web-broker --force
rm -rf .turbo && pnpm build             # reset cache complet
```

---

## 5. Hot reload cross-package

### Mecanisme

Chaque app Next.js a `transpilePackages: ['@insurtech/shared-ui', '@insurtech/shared-pwa']` dans `next.config.mjs`. Next.js lit les fichiers sources TypeScript directement (pas le dist compilé), donc une modification dans `packages/shared-ui/src/` declenche automatiquement le HMR.

### Temps de reload attendus

| Changement | Temps reload |
|-----------|-------------|
| Modif composant React shared-ui | 100-500 ms |
| Ajout nouvelle exportation index.ts | 500-2000 ms (rebuild module graph) |
| Modif CSS theme.css | 50-200 ms (CSS module HMR) |
| Modif i18n/routing.ts | 500-1500 ms |

### Problemes courants

Si le hot reload ne se propage pas :

```bash
# 1. Verifier que transpilePackages est configure
grep -r "transpilePackages" apps/*/next.config.mjs

# 2. Redemarrer le serveur dev
# Ctrl+C puis pnpm dev:web-broker

# 3. Reset cache Next.js
rm -rf apps/web-broker/.next && pnpm dev:web-broker
```

---

## 6. Debugging avec VSCode

### Configurations disponibles (.vscode/launch.json)

1. **Next.js debug -- web-broker (3001)** : lance web-broker via node-terminal
2. **Next.js debug -- web-garage (3002)** : lance web-garage
3. **Next.js debug -- web-customer-portal (3004)** : lance customer-portal
4. **Next.js debug -- web-insurtech-admin (3000)** : lance admin
5. **Vitest -- run all** : execute tous les tests
6. **Vitest -- current file** : execute vitest sur le fichier ouvert
7. **Playwright -- E2E debug** : lance playwright en mode debug
8. **Doctor script** : execute pnpm doctor

### Breakpoints Server Components

Les breakpoints dans les Server Components (fichiers sans `'use client'`) fonctionnent cote Node. Ceux dans les Client Components requierent Chrome DevTools (F12).

### Acceder aux logs Next.js

```bash
# Terminal 1 : logs serveur
pnpm dev:web-broker 2>&1 | tee /tmp/broker.log

# Terminal 2 : suivre logs
tail -f /tmp/broker.log | grep -E "error|warn|GET|POST"
```

---

## 7. Common issues

### Port deja utilise

```bash
# Trouver le PID
lsof -iTCP:3001 -sTCP:LISTEN -t

# Tuer le process
lsof -iTCP:3001 -sTCP:LISTEN -t | xargs kill

# Windows
netstat -ano | findstr :3001
taskkill /PID <PID> /F
```

### pnpm install lent ou echouant

```bash
pnpm store prune         # nettoie le store global
pnpm install --shamefully-hoist  # si resolution echoue
```

### TypeScript paths non resolus

```bash
pnpm typecheck --force   # force rebuild tsbuildinfo
rm -rf **/dist           # si packages non compiles
pnpm build:packages      # recompile les packages
```

### Cache Turbo desynchronise

```bash
rm -rf .turbo
pnpm clean
pnpm build
```

### Husky hook ne s'execute pas

```bash
pnpm prepare             # re-installe hooks
chmod +x .husky/*        # sur Linux/macOS
```

### Erreurs TypeScript apres merge

```bash
pnpm install --frozen-lockfile  # si lockfile mis a jour
pnpm typecheck:apps             # verifier toutes les apps
```

---

## 8. RAM management -- 7 apps simultanees

### Consommation estimee

| Configuration | RAM estimee | Recommande pour |
|--------------|-------------|-----------------|
| 1 app (ex: web-broker) | 400-700 MB | Developpement sur une app |
| dev:portals (3 apps) | 1.2-2 GB | Workflow assure |
| dev:dashboards (3 apps) | 1.2-2 GB | Workflow dashboard |
| dev:all (7 apps) | 3-5 GB | Tests changements transversaux |

### Seuils RAM machine

| RAM machine | Recommandation |
|------------|----------------|
| 8 GB | 1-2 apps maximum, dev:portals interdit |
| 16 GB | dev:portals ou dev:dashboards, dev:all risque |
| 32 GB | dev:all confortable, tout dev possible |

### Surveillance macOS

```bash
# Verifier memory pressure
memory_pressure

# Voir consommation par process
ps aux | grep -E "node|next" | awk '{sum += $4} END {print sum "% CPU"}'
```

---

## 9. Daily workflow

### Matin

```bash
git pull origin main
pnpm install                    # si pnpm-lock.yaml a change
pnpm doctor                     # verifier l'environnement
pnpm dev:web-broker             # lancer l'app cible
```

### Pendant le developpement

```bash
# Verifier les types en temps reel (dans un second terminal)
pnpm typecheck:apps --watch    # ou turbo watch typecheck

# Verifier lint sur fichiers modifies
pnpm lint:fix                  # auto-fix via Biome
```

### Avant le push

```bash
pnpm typecheck:apps            # 0 erreur TypeScript
pnpm lint:fix                  # corrige le lint automatiquement
pnpm test                      # tous les tests passent
git push                       # pre-push hook re-execute vitest --changed
```

---

## 10. Branch naming convention

```
feat/sprint-NN-X.Y.Z-slug        -- nouvelle feature
fix/sprint-NN-X.Y.Z-slug         -- bug fix
chore/sprint-NN-X.Y.Z-slug       -- refacto/build/ci
docs/sprint-NN-X.Y.Z-slug        -- documentation
test/sprint-NN-X.Y.Z-slug        -- tests
```

**Exemples :**

```
feat/sprint-04-1.4.12-tooling-monorepo
fix/sprint-05-1.5.3-auth-jwt-expiry
chore/sprint-04-1.4.11-i18n-shared-ui
```

**Regles :**
- Kebab-case uniquement
- Slug : max 50 chars, descriptif
- NN = numero sprint sur 2 chiffres (01-35)
- X.Y.Z = numero de tache si applicable

---

## 11. Conventional Commits

Format : `<type>(<scope>): <subject>`

**Types autorises :**

| Type | Usage |
|------|-------|
| feat | Nouvelle fonctionnalite |
| fix | Correction bug |
| docs | Documentation |
| style | Formatage (sans changement code) |
| refactor | Refactoring |
| perf | Amelioration performance |
| test | Ajout/modif tests |
| build | Build system, deps |
| ci | CI/CD |
| chore | Taches diverses |
| revert | Revert commit |

**Exemples valides :**

```
feat(sprint-04-1.4.12): add doctor script with Atlas Cloud probe
fix(web-broker): fix RTL layout shift in sidebar nav
chore(turbo): add generate:api-client and lighthouse tasks
docs(developer-guide): document hot reload mechanism
test(shared-ui): add i18n routing unit tests
build(deps): bump turbo to 2.4.0
```

**Footer recommande :**

```
feat(sprint-04-1.4.12): add Turbo scripts and doctor tooling

Task: 1.4.12
Reference: B-04 Tache 1.4.12
```

---

## 12. Pre-commit hooks

### Hooks Husky actifs

| Hook | Declencheur | Actions |
|------|-------------|---------|
| pre-commit | git commit | lint-staged + check emoji + check console.log + check AWS leak |
| commit-msg | git commit -m | commitlint (Conventional Commits) |
| pre-push | git push | pnpm typecheck |

### Ce que pre-commit verifie

1. **lint-staged** : Biome check --write sur les fichiers stages
2. **no-emoji** : grep pattern emoji dans fichiers .ts/.tsx/.json etc. (decision-006)
3. **no-console.log** : interdit console.log/debug/info dans .ts/.tsx hors tests
4. **no-AWS-leak** : interdit amazonaws.com et cles AKIA* (decision-008)

### Bypass d'urgence (JAMAIS en main)

```bash
git commit --no-verify -m "chore: emergency hotfix"  # bypass tous les hooks
```

---

## 13. Variables d'environnement

### Structure .env racine

```bash
# Copier depuis .env.example si absent
cp .env.example .env

# Valider via doctor
pnpm doctor:fix
```

### Variables requises (validees par Zod dans doctor)

| Variable | Exemple | Requis |
|---------|---------|--------|
| POSTGRES_HOST | localhost | Oui |
| POSTGRES_PORT | 5432 | Oui |
| POSTGRES_USER | skalean | Oui |
| POSTGRES_PASSWORD | secret | Oui |
| REDIS_HOST | localhost | Oui |
| REDIS_PORT | 6379 | Oui |
| KAFKA_BROKERS | localhost:9092 | Oui |
| NEXT_PUBLIC_API_URL | http://localhost:4000 | Oui |
| S3_ENDPOINT | https://s3.bgr.atlascloudservices.ma | Oui |
| NEXT_PUBLIC_MAPBOX_TOKEN | pk.eyJ... | Optionnel |

### Regles cloud souverain (decision-008)

- S3_ENDPOINT DOIT pointer vers `s3.bgr.atlascloudservices.ma`
- JAMAIS de reference a `amazonaws.com`
- JAMAIS de cle AKIA* dans .env
- Le hook pre-commit bloque tout commit violant ces regles

---

## 14. Packages partages

### @insurtech/shared-ui

Composants React reutilisables entre toutes les apps.

**Exports principaux :**

```typescript
import { Button, Input, Select } from '@insurtech/shared-ui';
import { DirectionProvider, useIsRtl } from '@insurtech/shared-ui';
import { routing, DEFAULT_LOCALE } from '@insurtech/shared-ui/i18n/routing';
import { Link, useRouter } from '@insurtech/shared-ui/i18n/navigation';
import { formatDate, formatNumber } from '@insurtech/shared-ui';
```

**Storybook :**

```bash
pnpm storybook  # http://localhost:6006
```

### @insurtech/shared-pwa

Hooks et composants pour apps PWA (web-garage-mobile, web-assure-mobile).

### @insurtech/shared-maps

Wrapper Mapbox GL JS pour les apps avec cartographie.

---

## 15. Decisions architecture relevantes

| Decision | Impact DX |
|---------|-----------|
| decision-001 (pnpm + Turbo) | Commandes `pnpm dev:*`, cache build |
| decision-006 (NO EMOJI) | Pre-commit hook bloque les emojis |
| decision-008 (Atlas Cloud) | Doctor verifie absence AWS, pre-commit bloque |
| decision-009 (multilinguisme MA) | 3 locales fr/ar-MA/ar, RTL pour arabe |

---

## 16. Lefthook (alternative a Husky)

Le fichier `lefthook.yml` est commit mais inactif. Husky est utilise.

**Avantages Lefthook :** execution parallelisee des hooks (2x Husky), binaire Go sans Node.

**Pour basculer Sprint 30+ :**

```bash
npm uninstall husky lint-staged
npm install lefthook --save-dev
lefthook install
rm -rf .husky
```

---

## 17. Troubleshooting avance

### Vitest fails avec "cannot find module"

```bash
pnpm build:packages  # recompile les packages shared
```

### Next.js "Module not found: @insurtech/shared-ui"

```bash
# Verifier que transpilePackages est configure dans next.config.mjs
# Verifier que pnpm install a cree les symlinks
ls node_modules/@insurtech/
```

### Turbo "task not found"

```bash
# Verifier turbo.json contient la task
cat turbo.json | grep -A5 '"tasks"'
```

### Biome erreurs massives apres mise a jour

```bash
pnpm lint:fix  # auto-fix tous les fichiers
```

### Kafka ne demarre pas

```bash
pnpm docker:reset  # reset complet avec volumes
```

---

*Ce guide est maintenu par l'equipe Skalean. Sprint 4 Task 1.4.12.*
*Prochaine revue : Sprint 8 (ajout auth flows et RBAC).*
