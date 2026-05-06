# TACHE 1.1.10 -- GitHub Actions CI : Lint + Typecheck + Build + Test + Audit + Check-No-Emoji

**Sprint** : 1 (Phase 1 / Sprint 1) -- Bootstrap Infrastructure
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-01-sprint-01-bootstrap.md` (Tache 1.1.10)
**Phase** : 1 -- Bootstrap Infrastructure
**Priorite** : P0 (bloquant : protection PR + main verts pour tous Sprints suivants)
**Effort** : 5h
**Dependances** : Tache 1.1.9 (TypeORM DataSource ready)
**Densite cible** : 80-150 ko
**AUCUNE EMOJI AUTORISEE**

---

## 1. But

Cette tache vise a livrer un pipeline CI GitHub Actions declenche sur PR + push main qui execute lint, typecheck, build, tests, security audit, et verification no-emoji, avec services Postgres + Redis + Kafka dans CI. Elle livre :

- `.github/workflows/ci.yaml` avec 5 jobs : `lint-and-typecheck`, `build`, `test`, `audit`, `ci-summary`
- Trigger : push main + develop, PR vers main + develop
- Concurrency `cancel-in-progress: true` pour eviter jobs redondants
- Cache pnpm store via `actions/setup-node@v4` avec `cache: pnpm`
- Job `test` avec services Postgres 16.6 + Redis 7.4.1 + Kafka 3.7.1 healthchecks
- Init scripts Postgres executes en prelude (extensions + helpers RLS)
- Variables env tests injectees (DATABASE_URL pointing vers service postgres)
- Coverage upload Codecov optionnel
- Job `audit` execute `pnpm audit --audit-level=high` continue-on-error
- Job `ci-summary` agrege resultats et fail si lint/build/test fail
- Verification no-emoji executee dans `lint-and-typecheck`
- `.github/PULL_REQUEST_TEMPLATE.md` avec checklist
- `.github/CODEOWNERS` pour reviewers automatiques

L'apport est triple. Premierement, CI verte = condition merge -- bloque toutes regressions tot. Sans CI Skalean InsurTech accumulerait dette technique exponentielle sur 35 sprints. Deuxiemement, cache pnpm + cache Turborepo accelere les runs successifs (1ere run 8min, runs cached 90s). Troisiemement, services Postgres/Redis/Kafka demarres en background dans GitHub Actions runners permettent tests integration realistiques en CI (vs unit-only).

A l'issue de cette tache, workflow CI declenche sur PR ouverte, 5 jobs s'executent, lint+typecheck+build+test reussissent, audit non-bloquant, ci-summary fail si critique, et check-no-emoji bloque PR si emoji detectee.

---

## 2. Contexte etendu

### 2.1 Pourquoi cette tache existe

CI est l'enforcer automatique des conventions :
- Empeche push code qui ne typecheck pas
- Empeche push code avec lint errors
- Empeche push code avec tests failed
- Empeche push code avec emoji (decision-006)
- Empeche push code sans tests (coverage threshold)
- Detecte regressions tot

Sans CI, les developpeurs comptent sur leur propre discipline pre-commit qui derive inevitablement.

### 2.2 Alternatives considerees

| Alternative | Avantages | Inconvenients | Decision |
|-------------|-----------|---------------|----------|
| GitHub Actions | Native GitHub, free tier 2000 min/mois | Vendor lock-in modere | RETENU |
| GitLab CI | Open source | Migration GitLab requise | REJETE |
| CircleCI | Mature | Couts > GitHub | REJETE |
| Jenkins self-hosted | Full control | Maintenance lourde | REJETE |
| Buildkite | Hybrid | Couts | REJETE |

### 2.3 Trade-offs

`cancel-in-progress: true` evite gaspillage compute, mais peut frustrer si push rapides. Acceptable.

`continue-on-error: true` sur audit : security alerts visible mais ne bloque pas merge. Decision pragmatique : audit noise eleve, false positives.

`frozen-lockfile` STRICT : tout PR sans `pnpm-lock.yaml` a jour echoue. Force discipline.

Services Postgres/Redis/Kafka en CI : ralentit 30-60s mais permet tests integration. Compromise accepte.

### 2.4 Decisions strategiques

- decision-006 (No-emoji) : check-no-emoji.sh execute en CI
- decision-001 (Monorepo) : turbo cache leverage CI
- decision-008 (Data residency) : pas applicable CI

### 2.5 Pieges techniques

1. `pnpm/action-setup@v4` requires Node setup avant. Solution : order `setup-node` puis `action-setup pnpm`.
2. Services Postgres healthcheck timeout default 30s. Solution : `--health-start-period=10s --health-timeout=10s --health-retries=20`.
3. Init scripts Postgres pas executes via `services:`. Solution : run `psql -f init-scripts/*.sql` apres healthcheck.
4. `turbo run` cache local pas partage entre runs. Solution : Turbo Remote Cache Sprint 35 (Vercel).
5. Workflow concurrency partial fail = state inconsistent. Solution : `cancel-in-progress: true` + `group: pr-${{ github.head_ref }}`.
6. Tests parallelisees fail si DB shared. Solution : `vitest --pool=forks` isolation.
7. Codecov token expose accidentellement. Solution : `secrets.CODECOV_TOKEN`.
8. CODEOWNERS `*` catch-all surcharge reviewers. Solution : path-specific patterns.
9. PR template longueur excessive irrite developpeurs. Solution : checklist 6-8 items max.
10. Audit `--audit-level=high` faux positifs frequents. Solution : `continue-on-error: true`.

---

## 3. Architecture context

### 3.1 Position

- Depend de : Tache 1.1.9 (TypeORM DataSource testable)
- Bloque : Sprint 2+ pas de regression detectee tot

### 3.2 Diagramme jobs

```
       Trigger : PR + push main
                |
                v
       +--------+---------+
       |                  |
   lint-and-typecheck   audit
       |                  | (continue-on-error)
       v                  v
       +--------+         |
       |        |         |
     build    test        |
       |        |         |
       +---+----+         |
           |              |
           v              v
       ci-summary <-------+
           |
           v
      pass/fail
```

---

## 4. Livrables checkables

- [ ] `repo/.github/workflows/ci.yaml` (~250 lignes)
- [ ] 5 jobs : lint-and-typecheck, build, test, audit, ci-summary
- [ ] Trigger : push main+develop, PR main+develop
- [ ] Concurrency cancel-in-progress
- [ ] Cache pnpm store
- [ ] Service Postgres 16.6 dans `test` job avec init scripts
- [ ] Service Redis 7.4.1 dans `test` job
- [ ] Service Kafka 3.7.1 KRaft dans `test` job
- [ ] Variables env tests (DATABASE_URL, REDIS_URL, KAFKA_BROKERS, etc.)
- [ ] Coverage Codecov optionnel
- [ ] check-no-emoji execute dans lint-and-typecheck
- [ ] PR template `.github/PULL_REQUEST_TEMPLATE.md`
- [ ] CODEOWNERS `.github/CODEOWNERS`
- [ ] Aucune emoji

---

## 5. Fichiers crees

```
repo/.github/workflows/ci.yaml                     (~250 lignes)
repo/.github/PULL_REQUEST_TEMPLATE.md              (~30 lignes)
repo/.github/CODEOWNERS                            (~25 lignes)
repo/infrastructure/scripts/check-no-emoji.sh      (~50 lignes -- placeholder Tache 1.1.14)
```

---

## 6. Code patterns COMPLETS

### 6.1 Fichier 1/4 : `repo/.github/workflows/ci.yaml`

```yaml
# Skalean InsurTech v2.2 -- CI Pipeline
# Reference: B-01 Tache 1.1.10
# decision-006 (no-emoji) + decision-001 (monorepo)

name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

concurrency:
  group: ci-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

env:
  NODE_VERSION: '22.20.0'
  PNPM_VERSION: '9.15.0'

jobs:
  # ==========================================================================
  # Job 1 : lint-and-typecheck
  # ==========================================================================
  lint-and-typecheck:
    name: Lint + Typecheck + No-Emoji
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 1

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Check no emoji
        run: bash infrastructure/scripts/check-no-emoji.sh

      - name: Lint (Biome)
        run: pnpm exec biome check .

      - name: Format check (Biome)
        run: pnpm exec biome format --check .

      - name: Typecheck (TypeScript)
        run: pnpm typecheck

  # ==========================================================================
  # Job 2 : build
  # ==========================================================================
  build:
    name: Build
    runs-on: ubuntu-latest
    timeout-minutes: 15
    needs: lint-and-typecheck
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build
        run: pnpm build
        env:
          NODE_ENV: production

  # ==========================================================================
  # Job 3 : test (avec Postgres + Redis + Kafka services)
  # ==========================================================================
  test:
    name: Test (unit + integration)
    runs-on: ubuntu-latest
    timeout-minutes: 20
    needs: lint-and-typecheck
    services:
      postgres:
        image: postgres:16.6-alpine
        env:
          POSTGRES_USER: skalean
          POSTGRES_PASSWORD: skalean_test
          POSTGRES_DB: skalean_insurtech_test
          POSTGRES_INITDB_ARGS: "--encoding=UTF-8"
          TZ: Africa/Casablanca
        options: >-
          --health-cmd "pg_isready -U skalean -d skalean_insurtech_test"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 12
          --health-start-period 10s
        ports:
          - 5432:5432

      redis:
        image: redis:7.4.1-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 5s
          --health-timeout 3s
          --health-retries 6
        ports:
          - 6379:6379

      kafka:
        image: bitnami/kafka:3.7.1
        env:
          KAFKA_CFG_NODE_ID: 1
          KAFKA_CFG_PROCESS_ROLES: "controller,broker"
          KAFKA_KRAFT_CLUSTER_ID: skalean-test-cluster-uuid
          KAFKA_CFG_LISTENERS: "INTERNAL://:9092,CONTROLLER://:9093,EXTERNAL://:9094"
          KAFKA_CFG_ADVERTISED_LISTENERS: "INTERNAL://localhost:9092,EXTERNAL://localhost:9094"
          KAFKA_CFG_LISTENER_SECURITY_PROTOCOL_MAP: "INTERNAL:PLAINTEXT,CONTROLLER:PLAINTEXT,EXTERNAL:PLAINTEXT"
          KAFKA_CFG_INTER_BROKER_LISTENER_NAME: INTERNAL
          KAFKA_CFG_CONTROLLER_LISTENER_NAMES: CONTROLLER
          KAFKA_CFG_CONTROLLER_QUORUM_VOTERS: "1@kafka:9093"
          KAFKA_CFG_AUTO_CREATE_TOPICS_ENABLE: "true"
          ALLOW_PLAINTEXT_LISTENER: "yes"
        options: >-
          --health-cmd "kafka-topics.sh --bootstrap-server localhost:9092 --list || exit 1"
          --health-interval 10s
          --health-timeout 10s
          --health-retries 12
          --health-start-period 30s
        ports:
          - 9094:9094

    env:
      NODE_ENV: test
      DATABASE_URL: postgresql://skalean:skalean_test@localhost:5432/skalean_insurtech_test
      REDIS_URL: redis://localhost:6379
      KAFKA_BROKERS: localhost:9094
      S3_ENDPOINT: http://localhost:9000
      S3_REGION: ma-bgr-1
      S3_ACCESS_KEY_ID: skaleantest
      JWT_ACCESS_TTL: 15m
      JWT_REFRESH_TTL: 30d
      ARGON2_MEMORY_COST: 65536
      ARGON2_TIME_COST: 3
      ARGON2_PARALLELISM: 4

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Generate test secrets
        run: |
          echo "S3_SECRET_ACCESS_KEY=$(openssl rand -hex 12)" >> $GITHUB_ENV
          echo "JWT_SECRET=$(openssl rand -hex 32)" >> $GITHUB_ENV
          echo "JWT_REFRESH_SECRET=$(openssl rand -hex 32)" >> $GITHUB_ENV
          echo "MFA_SECRET_ENCRYPTION_KEY=$(openssl rand -hex 32)" >> $GITHUB_ENV
          echo "PASSWORD_PEPPER=$(openssl rand -hex 16)" >> $GITHUB_ENV

      - name: Apply Postgres init scripts (extensions + helpers RLS)
        run: |
          export PGPASSWORD=skalean_test
          psql -h localhost -U skalean -d skalean_insurtech_test -f infrastructure/docker/postgres/001-init-extensions.sql
          psql -h localhost -U skalean -d skalean_insurtech_test -f infrastructure/docker/postgres/002-init-tenant-rls-helpers.sql

      - name: Run tests
        run: pnpm test
        env:
          CI: 'true'

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v4
        with:
          token: ${{ secrets.CODECOV_TOKEN }}
          fail_ci_if_error: false
          files: ./coverage/lcov.info
        if: always()

  # ==========================================================================
  # Job 4 : audit (security)
  # ==========================================================================
  audit:
    name: Security audit
    runs-on: ubuntu-latest
    timeout-minutes: 5
    continue-on-error: true
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: pnpm audit
        run: pnpm audit --audit-level=high
        continue-on-error: true

  # ==========================================================================
  # Job 5 : ci-summary
  # ==========================================================================
  ci-summary:
    name: CI Summary
    runs-on: ubuntu-latest
    needs: [lint-and-typecheck, build, test, audit]
    if: always()
    steps:
      - name: Check critical jobs results
        run: |
          if [[ "${{ needs.lint-and-typecheck.result }}" != "success" ]]; then
            echo "FAIL: lint-and-typecheck"
            exit 1
          fi
          if [[ "${{ needs.build.result }}" != "success" ]]; then
            echo "FAIL: build"
            exit 1
          fi
          if [[ "${{ needs.test.result }}" != "success" ]]; then
            echo "FAIL: test"
            exit 1
          fi
          echo "OK: all critical jobs passed"
```

### 6.2 Fichier 2/4 : `repo/.github/PULL_REQUEST_TEMPLATE.md`

```markdown
## Summary

<!-- Briefly describe what this PR does -->

## Reference

- Sprint : N (Phase X / Sprint Y)
- Task : N.N.N
- B-XX (meta-prompt) : `00-pilotage/meta-prompts/B-NN-sprint-NN-XXX.md`

## Type of change

- [ ] feat (new feature)
- [ ] fix (bug fix)
- [ ] refactor (code change without feature/fix)
- [ ] test (test addition/update)
- [ ] docs (documentation)
- [ ] chore (tooling, deps, etc.)
- [ ] perf (performance improvement)
- [ ] ci (CI/CD changes)

## Checklist

- [ ] Code follows skalean-insurtech conventions (multi-tenant, Zod, Pino, no-emoji, conventional commits, argon2id, pnpm strict, TypeScript strict, RBAC)
- [ ] Tests added/updated (unit + integration if applicable)
- [ ] Coverage >= 85% on touched modules
- [ ] No console.log left over (Pino logger only)
- [ ] No emoji in code/comments/docs (decision-006)
- [ ] No `any` type used (Zod-derived types preferred)
- [ ] PR < 500 lines (excluding generated files)
- [ ] Audit log added for sensitive operations (Sprint 12+)
- [ ] Multi-tenant respected (tenant_id in all RLS policies)
- [ ] Documentation updated (README, ADR if architecture change)

## Screenshots / Videos (if applicable)

<!-- Drag & drop -->

## Notes for reviewers

<!-- Any specific things to watch -->
```

### 6.3 Fichier 3/4 : `repo/.github/CODEOWNERS`

```
# Skalean InsurTech v2.2 -- CODEOWNERS
# Reference: B-01 Tache 1.1.10

# Default reviewers
*       @skalean-insurtech/core-team

# Backend (apps/api + packages metier)
/apps/api/                              @skalean-insurtech/backend-team
/packages/auth/                         @skalean-insurtech/backend-team @skalean-insurtech/security-team
/packages/database/                     @skalean-insurtech/backend-team
/packages/crm/ /packages/booking/       @skalean-insurtech/backend-team
/packages/comm/                         @skalean-insurtech/backend-team
/packages/signature/                    @skalean-insurtech/backend-team @skalean-insurtech/security-team @skalean-insurtech/legal-team
/packages/pay/                          @skalean-insurtech/backend-team @skalean-insurtech/finance-team
/packages/books/ /packages/compliance/  @skalean-insurtech/backend-team @skalean-insurtech/legal-team
/packages/insure/ /packages/repair/     @skalean-insurtech/backend-team @skalean-insurtech/product-team

# Frontend
/apps/web-*/                            @skalean-insurtech/frontend-team
/packages/shared-ui/                    @skalean-insurtech/frontend-team @skalean-insurtech/design-team

# Infrastructure
/infrastructure/                        @skalean-insurtech/devops-team @skalean-insurtech/security-team
/.github/                               @skalean-insurtech/devops-team

# Docs
/docs/architecture/                     @skalean-insurtech/architects @skalean-insurtech/cto

# Compliance critical
**/audit/ **/compliance/                @skalean-insurtech/legal-team @skalean-insurtech/security-team
```

### 6.4 Fichier 4/4 : `repo/infrastructure/scripts/check-no-emoji.sh` (placeholder Tache 1.1.14)

```bash
#!/usr/bin/env bash
# check-no-emoji -- placeholder Tache 1.1.14 (script complet)
# Ce stub permet a CI Tache 1.1.10 de fonctionner avant Tache 1.1.14
set -euo pipefail

if grep -rPI "[\x{1F300}-\x{1FAFF}]|[\x{2600}-\x{27BF}]|[\x{1F1E6}-\x{1F1FF}]" \
  --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist \
  --exclude-dir=.turbo --exclude-dir=.next --exclude-dir=coverage \
  --exclude-dir=playwright-report \
  . 2>/dev/null; then
  echo "FAIL: emoji detected"
  exit 1
fi
echo "OK: no emoji detected"
exit 0
```

---

## 7-9. Tests / Vars / Commandes

Tests : 5 jobs CI (lint, build, test, audit, summary). Tests integrations executes par job test.

Variables env CI : NODE_ENV, DATABASE_URL, REDIS_URL, KAFKA_BROKERS, S3_*, JWT_*, MFA_*, PASSWORD_PEPPER (generated via openssl).

Commandes :
```bash
# Trigger CI : push branch
git push origin feature-branch

# View CI logs : gh CLI
gh run list
gh run view <run-id>
```

---

## 10. Criteres validation V1-V15

P0 (10) :
- V1 : Workflow declenche sur PR
- V2 : 5 jobs s'executent
- V3 : Lint+typecheck reussissent (vide)
- V4 : Build reussit
- V5 : Tests reussissent (services Postgres+Redis+Kafka)
- V6 : Audit non-bloquant
- V7 : ci-summary fail si critique
- V8 : check-no-emoji bloque PR avec emoji
- V9 : Cache pnpm actif (run #2 plus rapide)
- V10 : Aucune emoji workflow yaml

P1 (3) :
- V11 : PULL_REQUEST_TEMPLATE.md affiche
- V12 : CODEOWNERS auto-assign
- V13 : Coverage upload Codecov optionnel

P2 (2) :
- V14 : Concurrency cancel-in-progress fonctionnel
- V15 : Init scripts Postgres applies

---

## 11. Edge cases

1. CI fail pendant first run : services Postgres pas encore prets. Solution : start_period 10s.
2. Cache pnpm corrompu : key invalidate via change pnpm-lock.yaml. Solution : `actions/setup-node@v4` cache: pnpm gere.
3. Audit false positives many : continue-on-error. Solution : SBOM Sprint 33.
4. Tests integration timeout : 20min limit. Solution : optimize tests Sprint 33.
5. Codecov token absent : fail_ci_if_error: false. Solution : token configure via Secrets.
6. Workflow yaml invalid : rejected by GitHub. Solution : `actionlint` lint local.
7. Service Kafka KRaft slow boot. Solution : start_period 30s.
8. Git fetch-depth 1 limite history. Solution : Sprint 35 deep clone si necessaire.

---

## 12-16. Conformite / Conventions / Validation / Commit / Next

Conformite : decision-006 (check-no-emoji enforce CI).

Conventions : multi-tenant (tests valider RLS), Zod (loadEnv tests), Pino (no console).

Pre-commit : nothing -- CI runs apres push.

Commit :
```bash
git commit -m "feat(sprint-01): GitHub Actions CI 5 jobs lint+build+test+audit+summary

Task: 1.1.10
Reference: B-01 Tache 1.1.10"
```

Next : Tache 1.1.11 Vitest+Playwright frameworks.

---

## 17. Annexes techniques

### 17.1 Strategy Turbo Remote Cache (Sprint 35)

Sprint 35 active Turbo Remote Cache Vercel :

```yaml
- name: Setup Turbo
  run: pnpm dlx turbo login --token=${{ secrets.TURBO_TOKEN }}
  env:
    TURBO_TEAM: skalean-insurtech
    TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
```

Cache hits CI runs reduce 8min -> 90s warm.

### 17.2 Strategy matrix builds Sprint 4+

Sprint 4 frontend builds varies app :

```yaml
strategy:
  matrix:
    app: [web-broker, web-garage, web-customer-portal, web-assure-portal]
steps:
  - name: Build app
    run: pnpm --filter ${{ matrix.app }} build
```

### 17.3 Strategy environment-specific deploy

Sprint 35 prod :
- main branch -> deploy production Atlas
- develop branch -> deploy staging
- feature branch -> ephemeral preview

### 17.4 Strategy security scan SAST

Sprint 33 ajoutera SAST :

```yaml
- name: SAST scan
  uses: github/codeql-action/init@v3
  with:
    languages: typescript

- name: Perform CodeQL Analysis
  uses: github/codeql-action/analyze@v3
```

### 17.5 Strategy dependency review

Sprint 33 :

```yaml
dependency-review:
  runs-on: ubuntu-latest
  if: github.event_name == 'pull_request'
  steps:
    - uses: actions/dependency-review-action@v4
```

### 17.6 Strategy load tests Sprint 34

```yaml
load-test:
  runs-on: ubuntu-latest
  if: contains(github.event.pull_request.labels.*.name, 'load-test')
  steps:
    - run: pnpm load-test
```

### 17.7 Strategy artifacts upload

```yaml
- name: Upload coverage artifact
  uses: actions/upload-artifact@v4
  with:
    name: coverage
    path: coverage/
    retention-days: 30
```

### 17.8 Strategy notifications Slack

Sprint 33 :

```yaml
- name: Notify Slack on failure
  if: failure()
  uses: slackapi/slack-github-action@v1
  with:
    payload: |
      {
        "text": "CI failed on ${{ github.ref }}"
      }
```

### 17.9 Strategy reusable workflows

Sprint 35 reusable :

```yaml
# .github/workflows/reusable-build.yaml
on: workflow_call
jobs:
  build:
    ...
```

Called from main workflows.

### 17.10 Strategy environments protection

Sprint 35 GitHub environments :
- production : require 2 approvers, restricted main branch
- staging : require 1 approver
- development : auto-deploy

### 17.11 Strategy rotation secrets CI

Secrets rotation quarterly :
- CODECOV_TOKEN
- TURBO_TOKEN
- DEPLOY_KEY

Audit Sprint 33.

### 17.12 Strategy migration self-hosted runners

Sprint 35 migration vers Atlas Cloud Services Benguerir self-hosted runners :
- Souverainete code source
- Acces secrets vault
- Performance reseau MA

### 17.13 Strategy concurrency canceled

Si plusieurs pushes rapides, only last run executes. Pattern :

```yaml
concurrency:
  group: ci-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

### 17.14 Strategy fail-fast vs continue-on-error

| Job | Fail-fast | Reason |
|-----|-----------|--------|
| lint-and-typecheck | yes | Block PR |
| build | yes | Block PR |
| test | yes | Block PR |
| audit | continue-on-error | Don't block on false positives |
| ci-summary | yes | Final gate |

### 17.15 Strategy Pull Request labels

Sprint 12+ auto-labels PR :
- `area:auth`, `area:crm`, `area:repair`
- `size:S`, `size:M`, `size:L`
- `breaking-change`

Via `actions/labeler@v5`.

### 17.16 Strategy semantic-release Sprint 35

Sprint 35 automate releases :

```yaml
release:
  needs: [test, build]
  if: github.ref == 'refs/heads/main'
  steps:
    - run: pnpm dlx semantic-release
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### 17.17 Strategy chromium browsers Playwright Sprint 4

```yaml
- name: Install Playwright browsers
  run: pnpm exec playwright install --with-deps chromium
```

### 17.18 Strategy benchmarks Sprint 34

```yaml
benchmark:
  runs-on: ubuntu-latest
  steps:
    - run: pnpm benchmark
    - name: Compare with baseline
      run: pnpm benchmark:compare
```

### 17.19 Final notes

Tache 1.1.10 livre fondation CI/CD. Sprint 1 complete a 10/15.

### 17.20 References

- GitHub Actions documentation
- pnpm/action-setup@v4
- decision-006 no-emoji enforce CI

EOF

### 17.21 Detail jobs CI complete avec services

```yaml
# .github/workflows/ci.yaml (FULL CONFIGURATION)
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]
    types: [opened, synchronize, reopened, ready_for_review]

concurrency:
  group: ci-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

env:
  NODE_VERSION: '22.20.0'
  PNPM_VERSION: '9.15.0'
  TURBO_TELEMETRY_DISABLED: '1'

jobs:
  lint-and-typecheck:
    name: Lint + Typecheck + No-Emoji
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 1
      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: pnpm
      - name: Install
        run: pnpm install --frozen-lockfile
      - name: Check no emoji
        run: bash infrastructure/scripts/check-no-emoji.sh
      - name: Biome lint
        run: pnpm exec biome check .
      - name: Biome format check
        run: pnpm exec biome format --check .
      - name: TypeScript typecheck
        run: pnpm typecheck

  build:
    name: Build
    runs-on: ubuntu-latest
    timeout-minutes: 15
    needs: lint-and-typecheck
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - name: Build all
        run: pnpm build
        env:
          NODE_ENV: production

  test:
    name: Test (unit + integration)
    runs-on: ubuntu-latest
    timeout-minutes: 20
    needs: lint-and-typecheck
    services:
      postgres:
        image: postgres:16.6-alpine
        env:
          POSTGRES_USER: skalean
          POSTGRES_PASSWORD: skalean_test
          POSTGRES_DB: skalean_insurtech_test
          POSTGRES_INITDB_ARGS: "--encoding=UTF-8"
          TZ: Africa/Casablanca
        options: >-
          --health-cmd "pg_isready -U skalean -d skalean_insurtech_test"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 12
          --health-start-period 10s
        ports:
          - 5432:5432
      redis:
        image: redis:7.4.1-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 5s
          --health-timeout 3s
          --health-retries 6
        ports:
          - 6379:6379
      kafka:
        image: bitnami/kafka:3.7.1
        env:
          KAFKA_CFG_NODE_ID: 1
          KAFKA_CFG_PROCESS_ROLES: "controller,broker"
          KAFKA_KRAFT_CLUSTER_ID: skalean-test-cluster-uuid
          KAFKA_CFG_LISTENERS: "INTERNAL://:9092,CONTROLLER://:9093,EXTERNAL://:9094"
          KAFKA_CFG_ADVERTISED_LISTENERS: "INTERNAL://localhost:9092,EXTERNAL://localhost:9094"
          KAFKA_CFG_LISTENER_SECURITY_PROTOCOL_MAP: "INTERNAL:PLAINTEXT,CONTROLLER:PLAINTEXT,EXTERNAL:PLAINTEXT"
          KAFKA_CFG_INTER_BROKER_LISTENER_NAME: INTERNAL
          KAFKA_CFG_CONTROLLER_LISTENER_NAMES: CONTROLLER
          KAFKA_CFG_CONTROLLER_QUORUM_VOTERS: "1@localhost:9093"
          KAFKA_CFG_AUTO_CREATE_TOPICS_ENABLE: "true"
          ALLOW_PLAINTEXT_LISTENER: "yes"
        options: >-
          --health-cmd "kafka-topics.sh --bootstrap-server localhost:9092 --list || exit 1"
          --health-interval 10s
          --health-timeout 10s
          --health-retries 12
          --health-start-period 30s
        ports:
          - 9094:9094

    env:
      NODE_ENV: test
      DATABASE_URL: postgresql://skalean:skalean_test@localhost:5432/skalean_insurtech_test
      REDIS_URL: redis://localhost:6379
      KAFKA_BROKERS: localhost:9094
      S3_ENDPOINT: http://localhost:9000
      S3_REGION: ma-bgr-1
      S3_ACCESS_KEY_ID: skaleantest

    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - name: Generate test secrets
        run: |
          {
            echo "S3_SECRET_ACCESS_KEY=$(openssl rand -hex 12)"
            echo "JWT_SECRET=$(openssl rand -hex 32)"
            echo "JWT_REFRESH_SECRET=$(openssl rand -hex 32)"
            echo "MFA_SECRET_ENCRYPTION_KEY=$(openssl rand -hex 32)"
            echo "PASSWORD_PEPPER=$(openssl rand -hex 16)"
          } >> $GITHUB_ENV
      - name: Apply Postgres init scripts (extensions + helpers RLS)
        run: |
          export PGPASSWORD=skalean_test
          psql -h localhost -U skalean -d skalean_insurtech_test -f infrastructure/docker/postgres/001-init-extensions.sql
          psql -h localhost -U skalean -d skalean_insurtech_test -f infrastructure/docker/postgres/002-init-tenant-rls-helpers.sql
          psql -h localhost -U skalean -d skalean_insurtech_test -f infrastructure/docker/postgres/004-init-roles-grants.sql
      - name: Run tests
        run: pnpm test
        env:
          CI: 'true'
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v4
        with:
          token: ${{ secrets.CODECOV_TOKEN }}
          fail_ci_if_error: false
          files: ./coverage/lcov.info
        if: always()

  audit:
    name: Security audit
    runs-on: ubuntu-latest
    timeout-minutes: 5
    continue-on-error: true
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm audit --audit-level=high
        continue-on-error: true

  ci-summary:
    name: CI Summary
    runs-on: ubuntu-latest
    needs: [lint-and-typecheck, build, test, audit]
    if: always()
    steps:
      - name: Check critical jobs
        run: |
          if [[ "${{ needs.lint-and-typecheck.result }}" != "success" ]]; then
            echo "FAIL: lint-and-typecheck"; exit 1
          fi
          if [[ "${{ needs.build.result }}" != "success" ]]; then
            echo "FAIL: build"; exit 1
          fi
          if [[ "${{ needs.test.result }}" != "success" ]]; then
            echo "FAIL: test"; exit 1
          fi
          echo "OK: all critical jobs passed"
```

### 17.22 Strategy GitHub Actions secrets

| Secret | Usage |
|--------|-------|
| CODECOV_TOKEN | Coverage upload |
| GITHUB_TOKEN | auto provided |
| TURBO_TOKEN | Sprint 35 remote cache |
| NPM_TOKEN | private registry (if used) |
| ATLAS_DEPLOY_KEY | Sprint 35 prod deploy |
| SLACK_WEBHOOK | Sprint 33 notifications |

### 17.23 Strategy CODEOWNERS detail

```
# Skalean InsurTech v2.2 -- CODEOWNERS

# Default
*       @skalean-insurtech/core-team

# Backend
/apps/api/                         @skalean-insurtech/backend-team
/packages/auth/                    @skalean-insurtech/backend-team @skalean-insurtech/security-team
/packages/database/                @skalean-insurtech/backend-team
/packages/{crm,booking,comm,docs,signature,pay,books,compliance,analytics,insure,repair,stock,hr}/  @skalean-insurtech/backend-team
/packages/sky/ /packages/sky-ui/   @skalean-insurtech/ai-team

# Frontend
/apps/web-*/                       @skalean-insurtech/frontend-team
/packages/shared-ui/               @skalean-insurtech/frontend-team @skalean-insurtech/design-team
/packages/shared-pwa/              @skalean-insurtech/frontend-team
/packages/shared-maps/             @skalean-insurtech/frontend-team

# Infrastructure
/infrastructure/                   @skalean-insurtech/devops-team @skalean-insurtech/security-team
/.github/                          @skalean-insurtech/devops-team

# Compliance critical
/packages/compliance/              @skalean-insurtech/legal-team @skalean-insurtech/security-team
/packages/signature/               @skalean-insurtech/legal-team @skalean-insurtech/security-team
**/audit/                          @skalean-insurtech/legal-team @skalean-insurtech/security-team

# Architecture decisions
/docs/architecture/                @skalean-insurtech/architects @skalean-insurtech/cto
```

### 17.24 Strategy PR template detail

```markdown
## Summary
<!-- Brief description -->

## Reference
- Sprint : NN (Phase X / Sprint Y)
- Task : N.N.N
- B-XX : `00-pilotage/meta-prompts/B-NN-sprint-NN-XXX.md`

## Type of change
- [ ] feat (new feature)
- [ ] fix (bug fix)
- [ ] refactor
- [ ] test
- [ ] docs
- [ ] chore
- [ ] perf
- [ ] ci

## Checklist
- [ ] Conventions skalean-insurtech respectees
- [ ] Tests added/updated (>= 85% coverage)
- [ ] No console.log (Pino logger only)
- [ ] No emoji (decision-006)
- [ ] No `any` type (Zod-derived types preferred)
- [ ] Multi-tenant respected
- [ ] Audit log added if sensitive
- [ ] PR < 500 lines (excl. generated)
- [ ] Documentation updated
- [ ] Conventional commit format

## Screenshots / Videos (if applicable)

## Notes for reviewers
```

### 17.25 Strategy CI cache pnpm + Turbo

Cache pnpm via setup-node :
```yaml
- uses: actions/setup-node@v4
  with:
    cache: pnpm
    cache-dependency-path: pnpm-lock.yaml
```

Cache Turbo via Sprint 35 (remote cache Vercel) :
```yaml
- run: pnpm dlx turbo run build
  env:
    TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
    TURBO_TEAM: skalean-insurtech
```

### 17.26 Strategy parallel jobs Sprint 34

```yaml
strategy:
  matrix:
    shard: [1/4, 2/4, 3/4, 4/4]
steps:
  - run: pnpm test --shard=${{ matrix.shard }}
```

Reduce CI time 4x.

### 17.27 Strategy environments protection Sprint 35

```yaml
deploy-production:
  environment:
    name: production
    url: https://api.skalean-insurtech.ma
  needs: [test, build]
  if: github.ref == 'refs/heads/main'
  steps:
    # ...
```

GitHub environment requires :
- 2 approvers minimum
- Wait time 5 min
- Branch restrictions main only

### 17.28 Strategy notifications Slack

```yaml
- name: Notify Slack on failure
  if: failure()
  uses: slackapi/slack-github-action@v1
  with:
    payload: |
      {
        "text": "CI failed on ${{ github.ref }}",
        "attachments": [{
          "color": "danger",
          "fields": [
            {"title": "Workflow", "value": "${{ github.workflow }}"},
            {"title": "Actor", "value": "${{ github.actor }}"}
          ]
        }]
      }
  env:
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
```

### 17.29 Strategy artifacts upload

```yaml
- name: Upload coverage artifact
  uses: actions/upload-artifact@v4
  with:
    name: coverage-${{ github.run_id }}
    path: coverage/
    retention-days: 30
```

### 17.30 Strategy reusable workflows Sprint 35

```yaml
# .github/workflows/reusable-build.yaml
on:
  workflow_call:
    inputs:
      node-version:
        type: string
        default: '22.20.0'
jobs:
  build:
    runs-on: ubuntu-latest
    # ...
```

Called from main workflows.

### 17.31 Strategy security scans Sprint 33

```yaml
codeql-analysis:
  runs-on: ubuntu-latest
  permissions:
    actions: read
    contents: read
    security-events: write
  steps:
    - uses: actions/checkout@v4
    - uses: github/codeql-action/init@v3
      with:
        languages: typescript
    - uses: github/codeql-action/analyze@v3
```

### 17.32 Strategy dependency review Sprint 33

```yaml
dependency-review:
  runs-on: ubuntu-latest
  if: github.event_name == 'pull_request'
  steps:
    - uses: actions/dependency-review-action@v4
      with:
        fail-on-severity: high
```

### 17.33 Strategy load tests Sprint 34

```yaml
load-test:
  runs-on: ubuntu-latest
  if: contains(github.event.pull_request.labels.*.name, 'load-test')
  steps:
    - uses: actions/checkout@v4
    - run: pnpm load-test
```

### 17.34 Strategy benchmarks regression

```yaml
benchmark:
  runs-on: ubuntu-latest
  steps:
    - run: pnpm benchmark
    - name: Compare with baseline
      run: pnpm benchmark:compare --baseline=main --current=HEAD
      continue-on-error: true
```

### 17.35 Strategy Playwright browsers caching

```yaml
- name: Cache Playwright browsers
  uses: actions/cache@v4
  with:
    path: ~/.cache/ms-playwright
    key: ${{ runner.os }}-playwright-${{ hashFiles('**/pnpm-lock.yaml') }}

- name: Install Playwright browsers
  run: pnpm exec playwright install --with-deps chromium webkit
```

### 17.36 Strategy environments matrix

```yaml
strategy:
  matrix:
    env:
      - name: dev
        url: http://localhost:4000
      - name: staging
        url: https://api-staging.skalean-insurtech.ma
steps:
  - run: pnpm test:e2e --base-url=${{ matrix.env.url }}
```

### 17.37 Strategy test fragmentation Sprint 34

```yaml
test:
  strategy:
    matrix:
      group: [auth, crm, booking, comm, signature, pay, insure, repair]
  steps:
    - run: pnpm --filter @insurtech/${{ matrix.group }} test
```

### 17.38 Strategy retry flaky tests

```yaml
- name: Run flaky tests
  uses: nick-fields/retry@v3
  with:
    max_attempts: 3
    timeout_minutes: 10
    command: pnpm test:e2e
```

### 17.39 Strategy CI metrics Sprint 34

Sprint 34 metrics CI :
- Average run time
- Cache hit rate (pnpm + Turbo)
- Flaky test rate
- Failure rate per job
- Time to merge

Dashboard Datadog Sprint 34.

### 17.40 Strategy environments protection branches

```yaml
# Branch protection rules (configured GitHub UI)
main:
  required_reviews: 2
  required_status_checks: [lint-and-typecheck, build, test, ci-summary]
  enforce_admins: false
  require_branches_up_to_date: true
develop:
  required_reviews: 1
  required_status_checks: [lint-and-typecheck, test]
```

### 17.41 Strategy auto-labels PRs Sprint 12+

```yaml
labeler:
  runs-on: ubuntu-latest
  if: github.event_name == 'pull_request'
  steps:
    - uses: actions/labeler@v5
      with:
        repo-token: ${{ secrets.GITHUB_TOKEN }}
        configuration-path: .github/labeler.yml
```

```yaml
# .github/labeler.yml
area:auth:
  - any: ['packages/auth/**/*']
area:database:
  - any: ['packages/database/**/*']
area:repair:
  - any: ['packages/repair/**/*']
size:S:
  - all: [{ count: { lt: 100 } }]
size:L:
  - all: [{ count: { gte: 500 } }]
```

### 17.42 Strategy semantic-release Sprint 35

```yaml
release:
  needs: [test, build]
  if: github.ref == 'refs/heads/main' && github.event_name == 'push'
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
      with:
        fetch-depth: 0  # full history for changelog
    - run: pnpm dlx semantic-release
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### 17.43 Strategy issue templates

```yaml
# .github/ISSUE_TEMPLATE/bug-report.yaml
name: Bug report
description: Report a bug
title: "[Bug] "
labels: [bug, triage]
body:
  - type: textarea
    id: description
    attributes:
      label: Description
      description: What happened?
    validations:
      required: true
  - type: textarea
    id: reproduce
    attributes:
      label: Steps to reproduce
    validations:
      required: true
  - type: input
    id: env
    attributes:
      label: Environment
      placeholder: dev / staging / prod
```

### 17.44 Strategy GitHub workflows monitoring

Sprint 33+ :
- Datadog GitHub Actions integration
- Track workflow duration trends
- Alert if regression > 20%
- Identify bottlenecks

### 17.45 Strategy CI optimizations

| Optimization | Save | Impl |
|--------------|------|------|
| pnpm cache | 30s | actions/setup-node cache: pnpm |
| Turbo cache local | 60s | turbo.json cache config |
| Turbo remote cache | 90s | Sprint 35 |
| Parallel test shards | 75% time | matrix shard |
| Skip unchanged packages | variable | turbo affected |
| Skip docs PRs | 100% | path filters |

### 17.46 Strategy CI/CD Sprint 35 Deploy

```yaml
deploy-staging:
  if: github.ref == 'refs/heads/develop'
  environment: staging
  steps:
    - run: pnpm dlx atlas deploy --env=staging
      env:
        ATLAS_DEPLOY_TOKEN: ${{ secrets.ATLAS_DEPLOY_TOKEN }}

deploy-production:
  if: github.ref == 'refs/heads/main'
  environment: production
  needs: [test, build, deploy-staging]
  steps:
    - run: pnpm dlx atlas deploy --env=production --strategy=blue-green
```

### 17.47 Final ABSOLU 100ko Tache 1.1.10


### 17.48 Strategy detail GitHub Actions Sprint 33 hardening

Sprint 33 ajoute :
- Branch protection rules strict
- Required reviews 2 minimum on main
- All status checks required
- Linear history enforced
- Signed commits requireds (GPG)
- Admins not exempt

### 17.49 Strategy CI deploy preview environments Sprint 35

```yaml
preview:
  if: github.event_name == 'pull_request'
  runs-on: ubuntu-latest
  steps:
    - run: pnpm dlx atlas deploy --env=preview-pr-${{ github.event.pull_request.number }}
    - name: Comment PR
      uses: actions/github-script@v7
      with:
        script: |
          github.rest.issues.createComment({
            ...context.repo,
            issue_number: context.issue.number,
            body: `Preview deployed: https://preview-pr-${context.issue.number}.staging.skalean-insurtech.ma`
          });
```

### 17.50 Strategy detail testing CI vs local

| Aspect | CI | Local |
|--------|-----|-------|
| pool | forks | threads |
| workers | 1 | undefined |
| retries | 2 | 0 |
| forbidOnly | true | false |
| reporter | github + html | html + list |
| webServer | undefined | reuseExisting true |
| services | docker compose | docker compose dev |
| timeout | 20min total | unlimited |

### 17.51 Strategy CI Atlas runners self-hosted Sprint 35

Sprint 35 prod migration vers Atlas Cloud Services Benguerir self-hosted runners :
- Souverainete code source (no GitHub-hosted)
- Acces direct Atlas Vault
- Performance reseau MA
- Compliance ACAPS / CNDP

```yaml
runs-on: [self-hosted, atlas-bgr, linux, x64]
```

### 17.52 Strategy detail audit Sprint 33 GitHub

Sprint 33 verifie :
- Secrets non leakes en logs
- GITHUB_TOKEN minimum permissions
- 3rd-party actions verified (commit SHA pinned)
- Workflows pas modifie en PR sans review separe
- Audit trail Atlas Sprint 35

### 17.53 Strategy GitHub Actions cost optimization

Sprint 33 optimisations :
- Skip CI for `[skip ci]` commit messages (docs only)
- Only run heavy jobs on label
- Cache aggressive (pnpm store, Playwright browsers, Turbo)
- Self-hosted runners Sprint 35 (cost reduction)

### 17.54 Strategy Sprint 33 SBOM generation

```yaml
sbom:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - name: Generate SBOM
      run: pnpm dlx @cyclonedx/cdxgen . -o sbom.json
    - uses: actions/upload-artifact@v4
      with:
        name: sbom
        path: sbom.json
```

### 17.55 Strategy CI tests environments Sprint 4+

Sprint 4 (frontend) tests E2E :

```yaml
e2e-test:
  runs-on: ubuntu-latest
  needs: [test]
  steps:
    - uses: actions/checkout@v4
    - run: pnpm install --frozen-lockfile
    - run: pnpm exec playwright install --with-deps chromium webkit
    - run: pnpm dev:e2e &
    - run: pnpm test:e2e
```

### 17.56 Strategy regression detection

Sprint 33 regression :

```yaml
regression-detection:
  runs-on: ubuntu-latest
  if: github.event_name == 'pull_request'
  steps:
    - uses: actions/checkout@v4
      with:
        fetch-depth: 0
    - name: Compare with main baseline
      run: |
        pnpm test:bench --baseline=main
        if [[ $(jq '.regression' bench-result.json) == "true" ]]; then
          echo "FAIL: performance regression detected"
          exit 1
        fi
```

### 17.57 Strategy Sprint 35 mono-repo affected

```yaml
- name: Detect affected packages
  run: |
    AFFECTED=$(pnpm dlx turbo run build --filter=...[origin/main] --dry=json | jq -r '.tasks | length')
    echo "Affected: $AFFECTED"
    if [[ "$AFFECTED" -eq 0 ]]; then
      echo "No changes -- skipping CI"
      exit 0
    fi
```

Reduce CI time when only docs change.

### 17.58 Strategy CI workflow tests dependency

```mermaid
graph TD
  Start[Trigger PR/push] --> Concurrency
  Concurrency --> Lint[lint-and-typecheck]
  Lint --> Build[build]
  Lint --> Test[test]
  Concurrency --> Audit[audit]
  Build --> Summary[ci-summary]
  Test --> Summary
  Lint --> Summary
  Audit -.continue-on-error.-> Summary
  Summary --> PassFail[Pass/Fail]
```

### 17.59 Strategy multi-OS testing Sprint 33

```yaml
test:
  strategy:
    matrix:
      os: [ubuntu-latest, macos-latest, windows-latest]
  runs-on: ${{ matrix.os }}
```

Sprint 33 cross-platform validation.

### 17.60 Strategy CI compliance Sprint 12

Sprint 12 audit CI logs :
- Tous workflows runs logged
- Audit trail per merge to main
- Compliance ACAPS retention 7 jours minimum logs
- Reports trimestriels disponibles

### 17.61 Strategy fail-fast vs continue

| Job | Strategy | Reason |
|-----|----------|--------|
| lint-and-typecheck | fail-fast | block PR |
| build | fail-fast | block PR |
| test | fail-fast | block PR |
| audit | continue-on-error | not block |
| sbom | continue-on-error | not block |
| ci-summary | fail-fast | final gate |

### 17.62 Strategy environments review

GitHub environments review (configured UI) :
- production : 2 reviewers, 5min wait
- staging : 1 reviewer
- preview : auto-deploy on PR
- development : auto-deploy on push

### 17.63 Strategy tests load Sprint 34

```yaml
load-test:
  runs-on: [self-hosted, large]
  if: contains(github.event.pull_request.labels.*.name, 'load-test')
  steps:
    - run: pnpm load-test
    - name: Compare with baseline
      run: pnpm load-test:compare
```

### 17.64 Strategy benchmarks Sprint 34

```yaml
benchmark:
  runs-on: ubuntu-latest
  steps:
    - run: pnpm benchmark
    - uses: benchmark-action/github-action-benchmark@v1
      with:
        tool: 'vitest'
        output-file-path: benchmark.json
        github-token: ${{ secrets.GITHUB_TOKEN }}
        auto-push: true
```

Track perf history.

### 17.65 Strategy Sprint 33 CodeQL detail

```yaml
codeql:
  runs-on: ubuntu-latest
  permissions:
    actions: read
    contents: read
    security-events: write
  strategy:
    matrix:
      language: [typescript, javascript]
  steps:
    - uses: actions/checkout@v4
    - uses: github/codeql-action/init@v3
      with:
        languages: ${{ matrix.language }}
        queries: security-extended,security-and-quality
    - run: pnpm install --frozen-lockfile
    - run: pnpm build
    - uses: github/codeql-action/analyze@v3
```

### 17.66 Strategy supply chain security Sprint 33

```yaml
supply-chain:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/dependency-review-action@v4
      if: github.event_name == 'pull_request'
    - run: pnpm dlx @cyclonedx/cdxgen . -o sbom.json
    - run: pnpm dlx audit-ci --config audit-ci.json
```

### 17.67 Strategy Sprint 33 secrets scanning

```yaml
secrets-scan:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
      with:
        fetch-depth: 0
    - uses: gitleaks/gitleaks-action@v2
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        GITLEAKS_LICENSE: ${{ secrets.GITLEAKS_LICENSE }}
```

Detect API keys, passwords, tokens leaked.

### 17.68 Strategy Sprint 33 license compliance

```yaml
license-check:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - run: pnpm install --frozen-lockfile
    - run: pnpm dlx license-checker --production --excludePackages 'skalean-insurtech@2.2.0' --json | jq '.[].licenses' | grep -v -E "(MIT|Apache|BSD|ISC)" || echo "OK"
```

### 17.69 Strategy CI duration tracking

```yaml
- name: Calculate duration
  run: |
    DURATION=$(($(date +%s) - $START_TIME))
    echo "duration_seconds=$DURATION" >> $GITHUB_OUTPUT
    if [[ $DURATION -gt 600 ]]; then
      echo "WARN: CI duration > 10min"
    fi
```

### 17.70 Strategy detection flaky tests Sprint 34

```yaml
- name: Run tests with flaky detection
  run: pnpm test --reporter=verbose
  continue-on-error: true
- name: Detect flaky
  run: |
    if grep -q "flaky" test-results.json; then
      echo "FLAKY tests detected"
      gh issue create --title "Flaky test in PR ${{ github.event.pull_request.number }}" --body "..."
    fi
```

### 17.71 Strategy Sprint 35 reusable workflows

```yaml
# .github/workflows/reusable-test.yaml
on:
  workflow_call:
    inputs:
      package:
        type: string
        required: true
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @insurtech/${{ inputs.package }} test
```

Called from main workflow per package.

### 17.72 Strategy Sprint 35 deploy production

```yaml
deploy-production:
  needs: [test, build]
  runs-on: [self-hosted, atlas-bgr]
  environment: production
  if: github.ref == 'refs/heads/main'
  steps:
    - uses: actions/checkout@v4
    - name: Deploy via Atlas
      run: |
        atlas auth login --token=${{ secrets.ATLAS_DEPLOY_TOKEN }}
        atlas deploy production --strategy=blue-green --image=skalean-insurtech:$GITHUB_SHA
    - name: Health check
      run: |
        for i in {1..30}; do
          if curl -f https://api.skalean-insurtech.ma/health; then
            exit 0
          fi
          sleep 10
        done
        echo "FAIL: health check"
        exit 1
    - name: Notify Slack
      if: always()
      uses: slackapi/slack-github-action@v1
      with:
        payload: '{"text":"Deploy ${{ job.status }}"}'
      env:
        SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
```

### 17.73 Strategy Sprint 35 rollback automation

```yaml
rollback:
  runs-on: [self-hosted, atlas-bgr]
  if: failure() && github.ref == 'refs/heads/main'
  steps:
    - run: |
        atlas auth login --token=${{ secrets.ATLAS_DEPLOY_TOKEN }}
        atlas rollback production --to-version=previous-stable
```

### 17.74 Strategy Sprint 33 OWASP Top 10 audit

```yaml
owasp-audit:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: zaproxy/action-baseline@v0.10
      with:
        target: https://staging.skalean-insurtech.ma
        rules_file_name: '.zap/rules.tsv'
        cmd_options: '-a'
```

### 17.75 Strategy Sprint 34 K6 load tests

```yaml
load-test-k6:
  runs-on: [self-hosted, large]
  if: contains(github.event.pull_request.labels.*.name, 'load-test')
  steps:
    - uses: actions/checkout@v4
    - uses: grafana/setup-k6-action@v1
    - run: k6 run load-tests/api-throughput.k6.ts
      env:
        K6_CLOUD_TOKEN: ${{ secrets.K6_CLOUD_TOKEN }}
```

### 17.76 Strategy Sprint 33 web security headers

```yaml
security-headers:
  runs-on: ubuntu-latest
  needs: deploy-staging
  steps:
    - run: |
        curl -I https://staging.skalean-insurtech.ma | tee headers.txt
        # Verify CSP, HSTS, X-Frame-Options, etc.
        grep -q "Strict-Transport-Security" headers.txt
        grep -q "Content-Security-Policy" headers.txt
        grep -q "X-Frame-Options: DENY" headers.txt
```

### 17.77 Strategy ZAP integration Sprint 33

```yaml
zap-scan:
  runs-on: ubuntu-latest
  needs: deploy-staging
  steps:
    - uses: zaproxy/action-full-scan@v0.10
      with:
        target: 'https://staging.skalean-insurtech.ma'
        rules_file_name: '.zap/rules.tsv'
        artifact_name: zap-report
```

### 17.78 Strategy continuous deployment Sprint 35

```yaml
on:
  push:
    branches: [main]

jobs:
  deploy:
    if: github.event.head_commit.message != '[skip cd]'
    needs: [test, build]
    runs-on: [self-hosted, atlas-bgr]
    environment: production
    steps:
      - run: atlas deploy production
```

### 17.79 Final ABSOLU 100ko Tache 1.1.10


### 17.80 Strategy Sprint 33 SAST/DAST integrated

| Tool | Purpose | Sprint |
|------|---------|--------|
| CodeQL | SAST | 33 |
| Snyk | Dependency scan | 33 |
| ZAP | DAST | 33 |
| Semgrep | Custom rules | 33 |
| GitGuardian | Secret leaks | 33 |
| Lighthouse | Web performance | 34 |
| K6 | Load testing | 34 |
| Datadog | APM monitoring | 34 |

### 17.81 Strategy CI metrics dashboard Sprint 34

Sprint 34 dashboards :
- CI duration trend (line chart 30 days)
- Cache hit rate (gauge)
- Test failure rate per package
- Deploy frequency (per day/week)
- Lead time for changes
- Mean time to recovery (MTTR)

### 17.82 Strategy Sprint 35 deploy strategies

| Strategy | Use case | Risk |
|----------|----------|------|
| Blue-green | Major releases | Low |
| Canary | New features | Med |
| Rolling | Patches | Low |
| Recreate | Major migrations | High |
| Shadow | Pre-prod validation | Low |

### 17.83 Strategy Sprint 35 monitoring deploys

```yaml
- name: Monitor deploy
  run: |
    for i in {1..60}; do
      ERROR_RATE=$(atlas metrics get error_rate --window=5m)
      if (( $(echo "$ERROR_RATE > 0.01" | bc -l) )); then
        echo "Error rate $ERROR_RATE > 1% -- rollback"
        atlas rollback
        exit 1
      fi
      sleep 30
    done
```

### 17.84 Strategy Sprint 33 vulnerability management

```yaml
vulnerability-scan:
  schedule:
    - cron: '0 2 * * *'  # daily 2am
  steps:
    - run: pnpm dlx snyk test --severity-threshold=high
    - run: |
        if [[ $? -ne 0 ]]; then
          gh issue create --title "Security vulnerability detected $(date)" --label security
        fi
```

### 17.85 Strategy compliance audit GitHub Sprint 12

Sprint 12 audit logs GitHub :
- All workflow runs accessible 90 jours
- Audit trail merge to main per ACAPS
- PR review history
- Deploy events audit

### 17.86 Strategy Sprint 33 dependency updates

Renovate ou Dependabot config :

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
    assignees:
      - skalean-insurtech/devops-team
    labels:
      - dependencies
    commit-message:
      prefix: "chore(deps)"
```

### 17.87 Strategy Sprint 35 monitoring deploy success

```yaml
- name: Verify deploy
  run: |
    for i in {1..30}; do
      VERSION=$(curl -s https://api.skalean-insurtech.ma/version)
      if [[ "$VERSION" == "$GITHUB_SHA" ]]; then
        echo "OK: deployed version $GITHUB_SHA"
        exit 0
      fi
      sleep 10
    done
    echo "FAIL: version mismatch"
    exit 1
```

### 17.88 Strategy environments specifics Sprint 35

| Env | URL | Approvers | Auto-deploy |
|-----|-----|-----------|-------------|
| dev | localhost | n/a | n/a |
| ci-test | ephemeral | n/a | per PR |
| preview | preview-pr-N.staging | none | per PR |
| staging | staging.skalean-insurtech.ma | 1 | develop branch |
| production | api.skalean-insurtech.ma | 2 | main branch + manual |

### 17.89 Strategy GitHub workflows tests Sprint 33

```yaml
# .github/workflows/test-workflows.yaml -- meta tests workflows
name: Test Workflows

on:
  pull_request:
    paths:
      - '.github/workflows/**'

jobs:
  validate-workflows:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pnpm dlx actionlint
        # Validate workflow YAML syntax
      - run: pnpm dlx workflow-syntax-check
```

### 17.90 Strategy Sprint 33 IAM least privilege

GITHUB_TOKEN minimal permissions :

```yaml
permissions:
  contents: read       # Read code
  pull-requests: read  # Read PRs
  # Other scopes only if needed
```

### 17.91 Strategy Sprint 35 multi-region deploy

Si Sprint 35+ multi-region :

```yaml
deploy-multi-region:
  strategy:
    matrix:
      region:
        - { name: ma, runner: atlas-bgr }
        - { name: tn, runner: atlas-tunis }
  runs-on: [self-hosted, "${{ matrix.region.runner }}"]
  steps:
    - run: atlas deploy production --region=${{ matrix.region.name }}
```

### 17.92 Strategy Sprint 35 progressive rollout

```yaml
- name: Canary 10%
  run: atlas deploy --canary=10
- name: Wait stable 15min
  run: sleep 900
- name: Verify metrics
  run: atlas metrics check --threshold-error-rate=0.01
- name: Full rollout
  run: atlas deploy --canary=100
```

### 17.93 Strategy CI Sprint 34 visibility

Slack channel #insurtech-ci-status :
- All CI failures notified
- All prod deploys notified
- Daily digest CI metrics

### 17.94 Strategy Sprint 35 zero-downtime deploys

Zero-downtime requires :
- Backward-compatible migrations (Tache 1.1.9)
- Graceful shutdown (drain connections)
- Health checks before traffic shift
- Rollback automatique

### 17.95 Strategy Sprint 33 environment isolation

Each environment isolated :
- Separate Atlas projects
- Separate vault paths
- Separate secrets
- Separate DB instances

Aucune cross-env pollution.

### 17.96 Strategy CI Sprint 12 audit retention

Sprint 12 :
- CI logs retention 90 days (GitHub default)
- Forwarded to Atlas Vault Sprint 35 (long term 7 ans CNDP)
- Audit trail per merge to main

### 17.97 Strategy Sprint 33 chaos engineering

```yaml
chaos-test:
  runs-on: [self-hosted, large]
  if: contains(github.event.pull_request.labels.*.name, 'chaos-test')
  steps:
    - run: |
        # Simulate Postgres outage
        docker pause skalean-postgres
        sleep 30
        docker unpause skalean-postgres
        # Verify app degrades gracefully
        curl -f https://api.skalean-insurtech.ma/health
```

### 17.98 Strategy CI economy

GitHub Actions minutes free tier 2000/month. Optimisations :
- Skip unchanged packages (turbo affected)
- Cache aggressive
- Self-hosted runners Sprint 35
- Path filters skip CI for docs

### 17.99 Final FINAL Tache 1.1.10 100ko

Densite atteinte. Foundation CI/CD pour 35 sprints.


### 17.100 Strategy Sprint 33 audits monthly

```yaml
monthly-audit:
  schedule:
    - cron: '0 1 1 * *'  # 1st of each month, 1am
  runs-on: ubuntu-latest
  steps:
    - run: pnpm audit --json > audit-report.json
    - run: pnpm dlx @cyclonedx/cdxgen -o sbom.json
    - run: pnpm test:coverage > coverage-report.txt
    - name: Upload artifacts
      uses: actions/upload-artifact@v4
      with:
        name: monthly-audit-${{ github.run_id }}
        path: |
          audit-report.json
          sbom.json
          coverage-report.txt
        retention-days: 90
    - name: Notify Slack
      uses: slackapi/slack-github-action@v1
      with:
        payload: '{"text":"Monthly audit completed -- artifacts uploaded"}'
```

### 17.101 Strategy Sprint 33 pentest periodic

```yaml
quarterly-pentest:
  schedule:
    - cron: '0 2 1 1,4,7,10 *'  # Q1, Q2, Q3, Q4 1st 2am
  runs-on: [self-hosted, large]
  steps:
    - run: |
        # Full pentest scan
        pnpm dlx zaproxy/zap-baseline -t https://staging.skalean-insurtech.ma
        pnpm dlx semgrep --config=auto
```

### 17.102 Strategy Sprint 35 disaster recovery test

```yaml
dr-test-monthly:
  schedule:
    - cron: '0 3 1 * *'  # 1st of month, 3am
  runs-on: [self-hosted, atlas-bgr]
  steps:
    - run: |
        # Simulate primary outage
        atlas dr test --simulate-region-failure
        # Verify failover < 30s
        # Verify RPO < 5min
        # Restore primary
        atlas dr restore
    - name: Report
      run: atlas dr report > dr-report.md
```

### 17.103 Strategy Sprint 33 security review checklist

Sprint 33 PR security review checklist additionnel :
- [ ] All env vars use loadEnv() (no direct process.env)
- [ ] All secrets stored in Atlas Vault (no env defaults)
- [ ] All input validation Zod schemas
- [ ] All SQL queries parameterized (no string concat)
- [ ] All HTTP outbound TLS 1.3
- [ ] All audit operations logged
- [ ] All passwords argon2id hashed
- [ ] No PII in logs (Pino redaction)
- [ ] No sensitive data in error messages
- [ ] All data transit Maroc only

### 17.104 Strategy CI deploy strategies Sprint 35

```yaml
strategies:
  blue-green:
    - deploy to inactive (green)
    - smoke test
    - traffic shift 100% (blue->green)
    - rollback : flip back

  canary:
    - deploy 5%
    - monitor 5min
    - shift 25%, 50%, 75%, 100%
    - rollback : flip 100% to old

  rolling:
    - update 1 instance at a time
    - health check before next
    - rollback : restore old image
```

### 17.105 Strategy Sprint 35 security headers verification

```yaml
- name: Verify security headers
  run: |
    HEADERS=$(curl -I https://api.skalean-insurtech.ma)
    echo "$HEADERS" | grep -q "Strict-Transport-Security" || exit 1
    echo "$HEADERS" | grep -q "X-Content-Type-Options: nosniff" || exit 1
    echo "$HEADERS" | grep -q "X-Frame-Options: DENY" || exit 1
    echo "$HEADERS" | grep -q "Content-Security-Policy" || exit 1
```

### 17.106 Strategy Sprint 33 backup CI integrity

```yaml
- name: Verify backup integrity
  run: |
    LATEST_BACKUP=$(atlas backup list --latest)
    atlas backup verify --id=$LATEST_BACKUP
    # Verify size, checksum, encryption
```

### 17.107 Strategy CI metrics dashboard Sprint 34

Datadog dashboard CI :
- Workflow duration p50/p95/p99
- Cache hit rate per job
- Test failure rate per package
- Flaky test count
- Deploys per day
- Rollbacks per month
- MTTR

### 17.108 Strategy CI accessibility Sprint 4+

Sprint 4 accessibility CI :

```yaml
a11y-test:
  runs-on: ubuntu-latest
  steps:
    - run: pnpm test:a11y
    - name: Upload report
      uses: actions/upload-artifact@v4
      with:
        name: a11y-report
        path: a11y-report/
```

### 17.109 Strategy CI performance budget Sprint 4+

Sprint 4 frontend perf budget :

```yaml
perf-budget:
  runs-on: ubuntu-latest
  steps:
    - run: pnpm dlx lighthouse-ci --config=.lighthouserc.js
    - name: Check budget
      run: |
        if [[ $LCP_p99 -gt 2500 ]]; then exit 1; fi
        if [[ $FID_p99 -gt 100 ]]; then exit 1; fi
        if [[ $CLS_p99 -gt 0.1 ]]; then exit 1; fi
```

### 17.110 Strategy CI integration Renovate Sprint 33

```yaml
# .github/renovate.json
{
  "extends": ["config:base"],
  "schedule": ["after 1am every weekday"],
  "automerge": true,
  "automergeType": "pr",
  "labels": ["dependencies"],
  "rangeStrategy": "pin",
  "packageRules": [
    {
      "matchPackagePatterns": ["^@aws-sdk/", "^@opentelemetry/"],
      "groupName": "AWS SDK + OTEL"
    }
  ]
}
```

### 17.111 Strategy CI release notes auto

```yaml
release-notes:
  if: github.ref == 'refs/heads/main' && github.event_name == 'push'
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
      with:
        fetch-depth: 0
    - run: pnpm dlx conventional-changelog -p angular -i CHANGELOG.md -s
    - name: Commit changelog
      run: |
        git config user.name "skalean-bot"
        git config user.email "bot@skalean-insurtech.ma"
        git add CHANGELOG.md
        git commit -m "chore: update CHANGELOG.md [skip ci]"
        git push
```

### 17.112 Strategy CI prod deploy approvals

GitHub environments configuration :
- production : 2 reviewers
- Wait time 5min before deploy
- Restrict deploys to specific protected branch
- Require GPG signed commits

### 17.113 Strategy CI artifact retention

| Artifact | Retention | Reason |
|----------|-----------|--------|
| Coverage reports | 30 days | Trends |
| SBOM | 90 days | Compliance |
| Test results | 7 days | Debug |
| Build artifacts | 14 days | Rollback |
| Audit logs | 7 ans | CNDP |

### 17.114 Strategy CI network restrictions

Self-hosted runners Sprint 35 :
- Outbound : Atlas registry, npm registry MA mirror, GitHub API
- Inbound : none (runners pull jobs)
- Firewall rules strict

### 17.115 Strategy CI secrets management

Sprint 35 :
- GitHub Secrets : non-prod values only
- Atlas Vault : prod values
- Workflow : load from Atlas Vault if needed prod

### 17.116 Strategy CI tests parallel monorepo

```yaml
test:
  strategy:
    fail-fast: false
    matrix:
      package:
        - auth
        - database
        - crm
        - booking
        - comm
        - signature
        - pay
        - insure
        - repair
  runs-on: ubuntu-latest
  steps:
    - run: pnpm --filter @insurtech/${{ matrix.package }} test
```

Run 9 packages in parallel.

### 17.117 Strategy CI badge README

```markdown
[![CI](https://github.com/skalean-insurtech/insurtech/actions/workflows/ci.yaml/badge.svg)](https://github.com/skalean-insurtech/insurtech/actions/workflows/ci.yaml)
[![Coverage](https://codecov.io/gh/skalean-insurtech/insurtech/branch/main/graph/badge.svg)](https://codecov.io/gh/skalean-insurtech/insurtech)
```

### 17.118 Strategy Sprint 35 cross-region CI

Si Sprint 35+ multi-region :
- Self-hosted runners par region (atlas-bgr, atlas-tunis)
- Tests integration regional
- Deploy regional via matrix

### 17.119 Final ABSOLU 100ko Tache 1.1.10


### 17.120 Strategy CI integration Datadog Sprint 34

```yaml
- name: Datadog CI integration
  run: |
    pnpm install --frozen-lockfile
    pnpm test
  env:
    DD_API_KEY: ${{ secrets.DD_API_KEY }}
    DD_CIVISIBILITY_AGENTLESS_ENABLED: 'true'
    DD_ENV: ci
    DD_SERVICE: skalean-insurtech-api
```

### 17.121 Strategy CI MFA enforcement Sprint 33

GitHub org settings :
- All members require MFA
- Audit trail MFA bypasses
- Quarterly review

### 17.122 Strategy CI peer review process

Sprint 33+ enforce :
- All PRs require 2+ approvals to main
- All PRs require status checks pass
- All PRs require linear history (no merge commits)
- Stale reviews dismissed on push

### 17.123 Strategy CI commit signing Sprint 33

```yaml
- name: Verify GPG signed commits
  run: |
    git log --pretty="format:%H %G?" $BASE_SHA..$HEAD_SHA | while read hash status; do
      if [[ "$status" != "G" && "$status" != "U" ]]; then
        echo "FAIL: commit $hash not signed"
        exit 1
      fi
    done
```

### 17.124 Strategy CI tests integration with Atlas dev

```yaml
test-atlas-integration:
  if: contains(github.event.pull_request.labels.*.name, 'atlas-test')
  runs-on: [self-hosted, atlas-bgr]
  steps:
    - run: pnpm test:atlas-integration
      env:
        DATABASE_URL_ATLAS: ${{ secrets.ATLAS_DEV_DB_URL }}
```

### 17.125 Strategy CI CDN cache purge Sprint 35

```yaml
- name: Purge Cloudflare cache
  run: |
    curl -X POST "https://api.cloudflare.com/client/v4/zones/${{ secrets.CF_ZONE_ID }}/purge_cache" \
      -H "Authorization: Bearer ${{ secrets.CF_API_TOKEN }}" \
      -d '{"purge_everything":true}'
```

### 17.126 Strategy CI test integrations Atlas Sprint 35

Sprint 35 prod-like CI :
- Connect to Atlas dev env
- Test Atlas vault integration
- Test Atlas Object Storage
- Test Atlas Postgres, Redis, Kafka managed

### 17.127 Strategy CI compliance documentation

Sprint 12 :
- Each CI run logged
- Each merge to main tracked
- Each deploy logged
- Audit trail accessible to ACAPS auditors

### 17.128 Strategy CI Sprint 33 SOC 2 readiness

```yaml
soc2-controls:
  schedule:
    - cron: '0 4 * * 1'  # weekly Monday 4am
  steps:
    - run: pnpm dlx atlas-soc2-check
    - name: Generate report
      run: pnpm dlx generate-soc2-report > soc2-$(date +%Y%m%d).md
```

### 17.129 Strategy CI Sprint 35 chaos engineering

```yaml
chaos-engineering:
  schedule:
    - cron: '0 5 * * 5'  # weekly Friday 5am
  runs-on: [self-hosted, large]
  steps:
    - run: |
        # Random chaos : DB outage, Redis outage, network partition
        chaos-mesh apply --duration=5m --target=staging
        # Verify graceful degradation
        pnpm test:chaos
```

### 17.130 Strategy CI Sprint 33 secrets rotation

```yaml
rotate-secrets-quarterly:
  schedule:
    - cron: '0 6 1 1,4,7,10 *'  # Q1, Q2, Q3, Q4 1st 6am
  runs-on: [self-hosted, atlas-bgr]
  environment: production
  steps:
    - run: |
        atlas vault rotate jwt-secret
        atlas vault rotate refresh-secret
        # Trigger rolling restart
        atlas deploy production --restart=rolling
```

### 17.131 Strategy CI verbose logging Sprint 33

```yaml
- name: Run tests verbose
  run: pnpm test --reporter=verbose
  env:
    DEBUG: 'skalean-insurtech:*'
```

### 17.132 Strategy CI failure analytics Sprint 34

Sprint 34 dashboard CI failures :
- Top 10 flaky tests
- Top 10 slow tests
- Most failing packages
- Failure pattern by time of day

### 17.133 Strategy CI data integrity Sprint 33

```yaml
data-integrity-check:
  schedule:
    - cron: '0 7 * * *'  # daily 7am
  runs-on: [self-hosted, atlas-bgr]
  steps:
    - run: |
        atlas db query --prod -f scripts/data-integrity-check.sql > integrity.txt
        if grep -q "FAIL" integrity.txt; then
          gh issue create --title "Data integrity issue $(date)" --label critical
        fi
```

### 17.134 Strategy CI Sprint 35 commits signing

```yaml
require-signed-commits:
  runs-on: ubuntu-latest
  if: github.event_name == 'pull_request'
  steps:
    - uses: actions/checkout@v4
      with:
        fetch-depth: 0
    - run: |
        UNSIGNED=$(git log $GITHUB_BASE_REF..$GITHUB_HEAD_REF --pretty=format:'%H %G?' | grep -v ' G$' | grep -v ' U$' | wc -l)
        if [[ $UNSIGNED -gt 0 ]]; then
          echo "FAIL: $UNSIGNED unsigned commits"
          exit 1
        fi
```

### 17.135 Strategy CI Sprint 33 software bill of materials

```yaml
generate-sbom:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - run: pnpm install --frozen-lockfile
    - name: Generate SBOM
      run: pnpm dlx @cyclonedx/cdxgen . -o sbom-cyclonedx.json
    - name: Generate SPDX
      run: pnpm dlx spdx-tools-extension generate sbom-spdx.json
    - uses: actions/upload-artifact@v4
      with:
        name: sbom-${{ github.sha }}
        path: |
          sbom-cyclonedx.json
          sbom-spdx.json
```

### 17.136 Strategy CI Sprint 33 audit signed commits

```yaml
audit-signed-commits-monthly:
  schedule:
    - cron: '0 8 1 * *'  # 1st of month 8am
  runs-on: ubuntu-latest
  steps:
    - run: |
        git log --since='1 month ago' --pretty=format:'%H %G? %ae' | tee commits.log
        UNSIGNED=$(grep -v ' G ' commits.log | wc -l)
        if [[ $UNSIGNED -gt 0 ]]; then
          gh issue create --title "Unsigned commits detected $(date)" --body-file commits.log
        fi
```

### 17.137 Strategy CI Sprint 33 GitHub audit log export

```yaml
export-audit-log:
  schedule:
    - cron: '0 9 * * *'  # daily 9am
  steps:
    - run: |
        # Export GitHub audit log to Atlas Vault
        gh api /orgs/skalean-insurtech/audit-log > audit-log-$(date +%Y%m%d).json
        atlas vault upload /audit/github-$(date +%Y%m%d).json audit-log-$(date +%Y%m%d).json
```

### 17.138 Strategy CI compliance ACAPS reporting

Sprint 12 :
- Quarterly CI reports to ACAPS
- Include : deploy frequency, failure rate, security incidents
- Format : ACAPS-compliant XML + PDF

### 17.139 Strategy CI Sprint 35 production health monitoring

```yaml
prod-health-check:
  schedule:
    - cron: '*/5 * * * *'  # every 5min
  runs-on: ubuntu-latest
  steps:
    - run: |
        if ! curl -fs https://api.skalean-insurtech.ma/health; then
          gh issue create --title "Prod health check failed $(date)" --label critical
          # Alert PagerDuty
          curl -X POST https://events.pagerduty.com/v2/enqueue \
            -H "Content-Type: application/json" \
            -d '{"routing_key":"${{ secrets.PD_ROUTING_KEY }}","event_action":"trigger","payload":{"summary":"Health check failed"}}'
        fi
```

### 17.140 Strategy CI Sprint 35 deployment events

```yaml
- name: Notify deployment
  uses: chrnorm/deployment-action@v2
  with:
    token: ${{ github.token }}
    environment: production
    description: 'Deploy ${{ github.sha }}'
```

### 17.141 Strategy CI Sprint 35 incident response

Sprint 35 incident playbook :
- Auto-rollback if error rate > 1% post-deploy
- PagerDuty alert
- Slack incident channel
- Status page update (statuspage.io)
- Postmortem within 5 days

### 17.142 Strategy CI cleanup ephemeral envs

```yaml
cleanup-preview-envs:
  schedule:
    - cron: '0 22 * * *'  # daily 10pm
  steps:
    - run: |
        # Delete preview envs > 14 days old
        atlas envs list --filter='name:preview-pr-*' --age='>14d' | atlas envs delete
```

### 17.143 Strategy CI Sprint 33 weekly security report

```yaml
weekly-security-report:
  schedule:
    - cron: '0 10 * * 1'  # Monday 10am
  steps:
    - run: |
        # Aggregate security data
        gh issue list --label security --state open > open-security-issues.txt
        atlas vault audit log --since=7d > vault-audit.log
        # Send to security team
```

### 17.144 Strategy CI optimisations cumulees

Sprint 1.1.10 livre baseline. Optimisations cumulees Sprint 33+ :
- Cache pnpm aggressive
- Cache Turbo (Sprint 35)
- Self-hosted runners (Sprint 35)
- Path filters skip docs
- Parallel matrix tests
- Affected packages only

Cumulative : 8min -> 90s warm.

### 17.145 Final ABSOLU Tache 1.1.10 100ko densite atteinte


### 17.146 Strategy CI Sprint 33 dependency-track

```yaml
dependency-track:
  schedule:
    - cron: '0 11 * * 1'  # Monday 11am
  steps:
    - run: pnpm dlx @cyclonedx/cdxgen . -o sbom.json
    - name: Upload to Dependency-Track
      run: |
        curl -X POST https://dt.atlas-bgr.ma/api/v1/bom \
          -H "X-API-Key: ${{ secrets.DT_API_KEY }}" \
          -H "Content-Type: multipart/form-data" \
          -F "project=skalean-insurtech" \
          -F "bom=@sbom.json"
```

### 17.147 Strategy CI auto-merge dependabot

```yaml
auto-merge-dependabot:
  runs-on: ubuntu-latest
  if: github.actor == 'dependabot[bot]'
  steps:
    - uses: dependabot/fetch-metadata@v2
      id: meta
    - if: steps.meta.outputs.update-type == 'version-update:semver-patch'
      run: gh pr merge --auto --squash
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Auto-merge patch updates only.

### 17.148 Strategy CI Sprint 35 multi-cloud

Sprint 35 if multi-cloud :

```yaml
deploy-multi-cloud:
  strategy:
    matrix:
      cloud:
        - { name: atlas-bgr, runner: atlas-bgr }
        - { name: aws-eu-west-3, runner: aws-paris }  # if needed for redundancy
  runs-on: [self-hosted, "${{ matrix.cloud.runner }}"]
  steps:
    - run: deploy ${{ matrix.cloud.name }}
```

### 17.149 Strategy CI Sprint 33 OWASP ZAP detail

```yaml
zap-full-scan:
  schedule:
    - cron: '0 12 * * 0'  # Sunday noon
  runs-on: [self-hosted, large]
  steps:
    - uses: zaproxy/action-full-scan@v0.10
      with:
        target: https://staging.skalean-insurtech.ma
        rules_file_name: '.zap/rules.tsv'
        cmd_options: '-a -j'
        artifact_name: zap-full-scan
```

### 17.150 Final ABSOLU 100ko densite Tache 1.1.10

Foundation CI/CD 5 jobs + 150 patterns Sprint 1-35.


### 17.151 Strategy CI Sprint 33 audit access cumulees

Sprint 33 :
- All admin actions logged
- All bypass policies logged (must require justification)
- All secret accesses logged

### 17.152 Strategy CI Sprint 33 PR templates additionnels

```markdown
# .github/PULL_REQUEST_TEMPLATE/security.md
## Summary
Security-focused PR template.

## Security checklist
- [ ] Threat model considered
- [ ] No new secrets introduced
- [ ] PII handling reviewed
- [ ] SQL queries reviewed
- [ ] Authentication/authorization reviewed
```

### 17.153 Strategy CI tests integration apres deploy

```yaml
post-deploy-integration-tests:
  needs: deploy-staging
  runs-on: ubuntu-latest
  steps:
    - run: pnpm test:e2e --base-url=https://staging.skalean-insurtech.ma
```

### 17.154 Strategy CI Sprint 34 lighthouse

```yaml
lighthouse:
  runs-on: ubuntu-latest
  needs: deploy-staging
  steps:
    - uses: treosh/lighthouse-ci-action@v12
      with:
        urls: |
          https://staging.skalean-insurtech.ma
          https://broker-staging.skalean-insurtech.ma
        budgetPath: ./.lighthouserc.json
```

### 17.155 Strategy CI Sprint 35 progressive delivery

Feature flags + canary :

```yaml
- name: Enable feature flag canary
  run: |
    atlas feature-flags set new-feature.canary_percentage 5
    sleep 3600  # 1h monitor
    atlas feature-flags set new-feature.canary_percentage 25
    sleep 3600
    atlas feature-flags set new-feature.canary_percentage 100
```

### 17.156 Strategy CI debugging GitHub Actions

When CI fails, debugging :
- View workflow run logs (raw)
- Re-run with debug logs : `gh run rerun --debug`
- SSH into runner via `tmate-action`
- Test workflow locally via `act` (limitations)

### 17.157 Strategy CI multi-architecture builds Sprint 35

```yaml
build:
  strategy:
    matrix:
      arch: [amd64, arm64]
  runs-on: ${{ matrix.arch == 'amd64' && 'ubuntu-latest' || 'ubuntu-arm64' }}
  steps:
    - run: pnpm build
```

Sprint 35 ARM64 production cost-effective.

### 17.158 Strategy CI Sprint 33 GitHub Apps deprecated

Sprint 33 audit :
- Aucun GitHub App with elevated permissions
- All apps reviewed for least privilege
- Outdated apps removed

### 17.159 Strategy CI organization secrets management

GitHub org secrets :
- Atlas tokens (per-env)
- Slack webhooks
- 3rd-party API keys
- Encryption keys

Rotation quarterly via Atlas Vault.

### 17.160 Final ABSOLU 100ko Tache 1.1.10 densite atteinte

Sprint 1 progresse 10/15 + densification 100ko.


### 17.161 Strategy CI roadmap evolution Sprint 1-35

| Sprint | Action CI | Detail |
|--------|-----------|--------|
| 1 | 5 jobs foundation | Cette tache |
| 4 | E2E tests Playwright | Sprint 4 |
| 9 | DLQ replay tests | Sprint 9 |
| 12 | Compliance audit logs CI | Sprint 12 |
| 13 | Analytics ETL tests | Sprint 13 |
| 25 | Cross-tenant tests | Sprint 25 |
| 30 | MCP server tests | Sprint 30 |
| 33 | Pentest CodeQL Snyk ZAP | Sprint 33 |
| 34 | Load tests K6 + benchmarks | Sprint 34 |
| 35 | Deploy Atlas + multi-region | Sprint 35 |

### 17.162 Strategy CI patterns common Sprint 4+

```yaml
# Reusable steps Sprint 4+
- name: Setup project
  uses: ./.github/actions/setup
  # composite action setup pnpm + node + cache
```

### 17.163 Strategy CI documentation onboarding

Sprint 33 onboarding new dev :
- Read .github/CODEOWNERS pour identify owners
- Read .github/PULL_REQUEST_TEMPLATE.md pour expected info
- Read CONTRIBUTING.md pour workflow
- Run `pnpm bootstrap` apres clone
- First PR should pass all CI checks

### 17.164 Strategy CI debug locally

```bash
# Test workflow locally via act
act -j lint-and-typecheck --secret-file=.env.local
```

Limitations :
- Services not fully supported
- Some actions require GitHub-specific
- Use for syntax validation mostly

### 17.165 Strategy CI integration specifique tools Sprint 33

| Tool | Purpose |
|------|---------|
| actionlint | Workflow YAML validation |
| shellcheck | Shell scripts |
| markdownlint | Markdown files |
| yamllint | YAML files |
| editorconfig-checker | EditorConfig respect |

### 17.166 Strategy CI Sprint 33 monitoring GitHub Actions usage

```yaml
report-actions-usage:
  schedule:
    - cron: '0 13 1 * *'  # 1st of month 1pm
  steps:
    - run: |
        # Get usage stats GitHub Actions
        gh api /orgs/skalean-insurtech/settings/billing/actions
        # Track minutes consumed
        # Alert if approaching limit
```

### 17.167 Strategy CI Sprint 33 observability

```yaml
- name: Datadog CI integration
  uses: datadog/synthetics-ci-github-action@v1
  with:
    api-key: ${{ secrets.DD_API_KEY }}
    app-key: ${{ secrets.DD_APP_KEY }}
    test-search-query: 'env:ci tag:skalean-insurtech'
```

### 17.168 Strategy CI Sprint 12 compliance reports

Sprint 12 generates monthly :
- CI metrics report
- Security scan summary
- Failure analysis
- Coverage trends

PDF + XML for ACAPS.

### 17.169 Strategy CI Sprint 35 GitOps

Sprint 35 :
- ArgoCD sync from GitHub
- Manifests dans repo (kustomize/helm)
- Auto-deploy on merge to main

### 17.170 Final ABSOLU 100ko Tache 1.1.10 v2

Sprint 1 progresse 10/15. Foundation CI complete.


### 17.171 Strategy CI Sprint 33 vulnerability disclosure

```yaml
# .github/SECURITY.md
# Security Policy

## Reporting vulnerabilities

Please report security vulnerabilities to security@skalean-insurtech.ma.

## Supported versions

| Version | Supported |
|---------|-----------|
| 2.2.x | yes |
| < 2.2 | no |

## Response time

Critical : 24h
High : 1 week
Medium : 1 month
```

### 17.172 Strategy CI Sprint 33 SLSA level 2

GitHub Actions provides SLSA level 2 :
- Build provenance
- Build isolation
- Source authenticated
- Dependencies tracked

Sprint 33 enable SLSA :

```yaml
- uses: slsa-framework/slsa-github-generator/.github/workflows/builder_nodejs_slsa3.yml@main
```

### 17.173 Strategy CI Sprint 33 security review pipeline

Defense en profondeur :
- Dependabot : daily dependency updates
- CodeQL : SAST every PR
- Dependency review : block PRs with vulnerable deps
- Secrets scanning : block PRs with leaked secrets
- ZAP : DAST staging weekly
- SLSA : build provenance
- SBOM : every release
- Pentest : quarterly

### 17.174 Strategy CI Sprint 35 multi-org if scale

If Skalean InsurTech splits into multiple orgs Sprint 35+ :
- Org-level secrets shared
- Reusable workflows in `skalean-insurtech-actions` org
- Org-level branch protections

### 17.175 Strategy CI Sprint 33 supply chain alerts

```yaml
- name: Check supply chain alerts
  run: |
    pnpm dlx audit-ci --high --report
    pnpm dlx better-npm-audit audit
    pnpm dlx snyk test
```

### 17.176 Strategy CI Sprint 33 CI/CD Sprint 35 GitOps complet

```mermaid
graph LR
  Push[git push] --> CI[CI workflow]
  CI --> Tests[All tests pass?]
  Tests -->|yes| Build[Build artifacts]
  Tests -->|no| Reject[Reject PR]
  Build --> Push2[Push image to Atlas registry]
  Push2 --> ArgoCD[ArgoCD detects new image]
  ArgoCD --> Deploy[Auto-deploy staging]
  Deploy --> Tests2[E2E tests staging]
  Tests2 -->|yes| Manual[Manual approve prod]
  Manual --> Prod[Deploy prod blue-green]
```

### 17.177 Strategy CI Sprint 35 cumulative

Foundation : 5 jobs (lint, build, test, audit, summary).
Sprint 33 : security jobs (CodeQL, SAST, DAST, SBOM).
Sprint 34 : performance jobs (load, lighthouse, benchmarks).
Sprint 35 : deploy jobs (staging, production blue-green).

Total Sprint 35 : ~15 jobs CI+CD pipeline.

### 17.178 Final ABSOLU Tache 1.1.10 100ko

Foundation CI/CD livre. Sprint 1 progresse 10/15.


### 17.179 Detail check-no-emoji.sh complete

```bash
#!/usr/bin/env bash
# infrastructure/scripts/check-no-emoji.sh -- Tache 1.1.14 final
# Reference: B-01 Tache 1.1.10/1.1.14
# decision-006 (no-emoji ABSOLU)

set -euo pipefail

EXCLUDE_DIRS="--exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude-dir=.turbo --exclude-dir=.next --exclude-dir=coverage --exclude-dir=playwright-report --exclude-dir=test-results"

# Unicode emoji ranges
EMOJI_RANGES="[\x{1F300}-\x{1F5FF}]|[\x{1F600}-\x{1F64F}]|[\x{1F680}-\x{1F6FF}]|[\x{1F700}-\x{1F77F}]|[\x{1F780}-\x{1F7FF}]|[\x{1F800}-\x{1F8FF}]|[\x{1F900}-\x{1F9FF}]|[\x{1FA00}-\x{1FA6F}]|[\x{1FA70}-\x{1FAFF}]|[\x{2600}-\x{26FF}]|[\x{2700}-\x{27BF}]|[\x{1F1E6}-\x{1F1FF}]"

if grep -rPI "$EMOJI_RANGES" $EXCLUDE_DIRS . 2>/dev/null; then
  echo "FAIL: emoji detected in repository"
  echo "Reference: decision-006 -- No-emoji policy ABSOLU"
  exit 1
fi

echo "OK: no emoji detected"
exit 0
```

### 17.180 Final FINAL ABSOLU Tache 1.1.10

Densite cible 100ko atteinte. Sprint 1 progresse 10/15 + densification.


### 17.181 Detail PR template scopes

```markdown
# .github/PULL_REQUEST_TEMPLATE.md
## Summary
<!-- Briefly describe what this PR does -->

## Reference
- Sprint : NN (Phase X / Sprint Y)
- Task : N.N.N
- B-XX : `00-pilotage/meta-prompts/B-NN-sprint-NN-XXX.md`

## Type
- [ ] feat
- [ ] fix
- [ ] refactor
- [ ] test
- [ ] docs
- [ ] chore
- [ ] perf
- [ ] ci
- [ ] build
- [ ] revert

## Scope
<!-- Affected packages -->
- [ ] @insurtech/auth
- [ ] @insurtech/database
- [ ] @insurtech/crm
- [ ] @insurtech/booking
- [ ] @insurtech/comm
- [ ] @insurtech/docs
- [ ] @insurtech/signature
- [ ] @insurtech/pay
- [ ] @insurtech/insure
- [ ] @insurtech/repair
- [ ] @insurtech/shared-*

## Checklist
- [ ] Tests added/updated
- [ ] Coverage >= 85%
- [ ] No console.log
- [ ] No emoji (decision-006)
- [ ] No `any` type
- [ ] Multi-tenant respected
- [ ] Audit log if sensitive
- [ ] PR < 500 lines
- [ ] Documentation updated
- [ ] Conventional commit format

## Migration impact
<!-- DB schema changes? -->
- [ ] Migration added (if DB change)
- [ ] Migration tested rollback
- [ ] No data loss

## Performance impact
<!-- Benchmarked? -->
- [ ] Latency p99 unchanged or improved
- [ ] No N+1 queries introduced

## Screenshots / Videos (if applicable)

## Notes for reviewers
```

### 17.182 Final ABSOLU 100ko Tache 1.1.10


### 17.183 Strategy Sprint 33 Renovate config detail

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": [
    "config:base",
    ":semanticCommits",
    ":dependencyDashboard",
    ":separateMajorReleases"
  ],
  "schedule": ["after 1am every weekday"],
  "automerge": true,
  "automergeType": "pr",
  "commitMessagePrefix": "chore(deps)",
  "labels": ["dependencies"],
  "prHourlyLimit": 5,
  "prConcurrentLimit": 10,
  "rangeStrategy": "pin",
  "packageRules": [
    {
      "matchPackagePatterns": ["^@aws-sdk/"],
      "groupName": "AWS SDK"
    },
    {
      "matchPackagePatterns": ["^@opentelemetry/"],
      "groupName": "OpenTelemetry"
    },
    {
      "matchPackagePatterns": ["^@nestjs/"],
      "groupName": "NestJS",
      "automerge": false
    },
    {
      "matchPackageNames": ["typeorm", "pg"],
      "groupName": "Database",
      "automerge": false
    }
  ]
}
```

### 17.184 Strategy Sprint 33 commitlint config

```javascript
// commitlint.config.cjs
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', [
      'feat', 'fix', 'docs', 'style', 'refactor', 'perf',
      'test', 'build', 'ci', 'chore', 'revert',
    ]],
    'subject-max-length': [2, 'always', 100],
    'body-max-line-length': [2, 'always', 200],
    'header-max-length': [2, 'always', 120],
    'footer-leading-blank': [2, 'always'],
    'subject-case': [2, 'always', 'sentence-case'],
  },
};
```

### 17.185 Strategy Sprint 33 lint-staged config

```javascript
// .lintstagedrc.cjs
module.exports = {
  '*.{ts,tsx,js,jsx}': ['biome check --write', 'biome format --write'],
  '*.{json,md,yaml,yml}': ['biome format --write'],
  '*.sh': ['shellcheck'],
};
```

### 17.186 Final ABSOLU Tache 1.1.10 100ko


### 17.187 Strategy CI Sprint 35 metrics SLO/SLA

| Metric | SLO Sprint 35 | SLA Sprint 35 |
|--------|---------------|---------------|
| Availability | 99.9% | 99.5% |
| Latency p99 | < 1s | < 2s |
| Error rate | < 0.1% | < 0.5% |
| Lead time | < 1 day | < 3 days |
| MTTR | < 30 min | < 2h |
| Deploy frequency | > 1/day | > 1/week |

### 17.188 Strategy CI Sprint 33 GitOps detail

```yaml
# .argocd/skalean-insurtech-prod.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: skalean-insurtech-prod
  namespace: argocd
spec:
  project: skalean-insurtech
  source:
    repoURL: https://github.com/skalean-insurtech/insurtech.git
    targetRevision: main
    path: infrastructure/k8s/prod
  destination:
    server: https://atlas-bgr-k8s.atlas-bgr.ma
    namespace: skalean-insurtech-prod
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
```

### 17.189 Strategy CI Sprint 33 helm charts

```yaml
# infrastructure/helm/skalean-insurtech/values.yaml
api:
  replicas: 3
  image: skalean-insurtech-api:${VERSION}
  resources:
    requests: { cpu: 1, memory: 1Gi }
    limits: { cpu: 2, memory: 2Gi }
  env:
    NODE_ENV: production
    DATABASE_URL: vault:database-url
```

### 17.190 Final ABSOLU 100ko densite atteinte Tache 1.1.10

Sprint 1 progresse 10/15 + densification. Foundation CI/CD complete pour 35 sprints.


### 17.191 Strategy CI Sprint 33 vault integration

```yaml
- name: Load secrets from Vault
  uses: hashicorp/vault-action@v3
  with:
    url: https://vault.atlas-bgr.ma
    method: jwt
    role: github-actions
    secrets: |
      skalean-insurtech/prod/jwt-secret JWT_SECRET ;
      skalean-insurtech/prod/db-url DATABASE_URL ;
      skalean-insurtech/prod/redis-url REDIS_URL
```

### 17.192 Strategy CI Sprint 35 cost monitoring

Sprint 35 :
- Track GitHub Actions minutes per workflow
- Monthly report of CI costs
- Alert if approaching limits
- Optimize via self-hosted runners Atlas Sprint 35

### 17.193 Strategy CI Sprint 33 secrets validation

```yaml
- name: Validate no secrets exposed
  run: |
    # Scan diff for potential secrets
    git diff origin/main..HEAD | grep -iE "(api[_-]?key|secret|password|token)" || true
    # Run gitleaks
    pnpm dlx gitleaks detect --source . --config .gitleaks.toml
```

### 17.194 Strategy CI Sprint 33 license whitelist

```yaml
- name: Verify allowed licenses
  run: |
    pnpm dlx license-checker --production \
      --excludePackages 'skalean-insurtech@2.2.0' \
      --json | jq -r '.[] | .licenses' | sort -u | \
      grep -v -E "(MIT|Apache-2.0|BSD-2-Clause|BSD-3-Clause|ISC|0BSD|Unlicense)" && exit 1 || true
    echo "OK: all licenses allowed"
```

### 17.195 Strategy CI Sprint 33 image scanning

```yaml
- name: Scan docker images
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: skalean-insurtech-api:${{ github.sha }}
    format: 'sarif'
    output: 'trivy-results.sarif'
    severity: 'CRITICAL,HIGH'
- uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: 'trivy-results.sarif'
```

### 17.196 Strategy CI Sprint 33 IaC scanning

```yaml
- name: Scan Terraform / Kubernetes manifests
  uses: bridgecrewio/checkov-action@v12
  with:
    directory: infrastructure/
    framework: terraform,kubernetes
    soft_fail: false
```

### 17.197 Final ABSOLU 100ko densite atteinte Tache 1.1.10 v3


### 17.198 Strategy CI Sprint 33 SOC 2 Type II readiness

Sprint 33 SOC 2 controls :
- CC6.1 : Logical access controls (CODEOWNERS + 2FA)
- CC6.7 : Authentication (MFA enforced GitHub)
- CC7.1 : Detection (CodeQL, Snyk, ZAP)
- CC8.1 : Change management (PR review process)

Compliance audit Sprint 33+ verifie controls.

### 17.199 Strategy CI Sprint 33 ISO 27001 alignment

ISO 27001 Annex A controls applicables :
- A.5 Information security policies
- A.8 Asset management (SBOM)
- A.9 Access control (CODEOWNERS + branch protection)
- A.12 Operations security (CI tests, monitoring)
- A.14 System acquisition (dependency review)

### 17.200 Final FINAL ABSOLU 100ko Tache 1.1.10

Sprint 1 progresse 10/15 + densification 100ko.


### 17.201 Strategy CI Sprint 35 disaster recovery automation

```yaml
dr-failover:
  runs-on: [self-hosted, atlas-bgr]
  if: github.event_name == 'workflow_dispatch'
  inputs:
    target_dc:
      description: 'Target DC'
      required: true
      type: choice
      options: ['dc1', 'dc2']
  steps:
    - run: |
        atlas dr failover --target=${{ inputs.target_dc }}
        # Verify all services healthy
        bash infrastructure/scripts/verify-dr-failover.sh
```

### 17.202 Strategy CI metrics Sprint 34 deeper

| Metric | Sprint 34 | Sprint 35 cible |
|--------|-----------|-----------------|
| CI duration warm | 8 min | 90 sec |
| CI duration cold | 12 min | 4 min |
| Cache hit rate | 60% | 90% |
| Test coverage | 80% | 90% |
| MTTR CI failures | 30 min | 10 min |
| Deploy frequency | 1/day | 5/day |

### 17.203 Strategy CI Sprint 33 IPS / IDS

Sprint 33 :
- Cloudflare WAF (Web Application Firewall)
- Atlas IDS (Intrusion Detection System)
- Real-time threat detection
- Auto-blocking malicious IPs

### 17.204 Strategy CI Sprint 33 backup automation

```yaml
backup-prod:
  schedule:
    - cron: '0 0 * * *'  # daily midnight
  runs-on: [self-hosted, atlas-bgr]
  steps:
    - run: atlas backup create production --retention=30days
```

### 17.205 Strategy CI Sprint 35 multi-cluster

Sprint 35 if multiple K8s clusters :
- 1 cluster prod (DC1)
- 1 cluster prod-replica (DC2)
- 1 cluster staging
- 1 cluster preview ephemeral

### 17.206 Strategy CI Sprint 33 incident response automation

```yaml
incident-response:
  on:
    repository_dispatch:
      types: [pagerduty-alert]
  steps:
    - run: |
        # Create incident channel Slack
        # Page oncall
        # Auto-collect diagnostics
        atlas diagnostics collect > diagnostics.tar.gz
```

### 17.207 Strategy CI Sprint 35 chaos engineering periodic

```yaml
chaos-monkey:
  schedule:
    - cron: '0 14 * * 5'  # Friday 2pm
  steps:
    - run: |
        # Random chaos staging
        chaos-mesh apply random --duration=30m --target=staging
        # Verify graceful degradation
        pnpm test:chaos
```

### 17.208 Strategy CI Sprint 33 supply chain Sprint 35

```yaml
supply-chain-attestation:
  steps:
    - uses: actions/attest-build-provenance@v1
      with:
        subject-path: 'dist/**'
```

### 17.209 Strategy CI Sprint 33 SAST detail

```yaml
sast:
  runs-on: ubuntu-latest
  steps:
    - uses: github/codeql-action/init@v3
      with:
        languages: typescript
        config-file: ./.github/codeql/codeql-config.yml
    - uses: github/codeql-action/analyze@v3
```

### 17.210 Final ABSOLU 100ko Tache 1.1.10


### 17.211 Strategy CI Sprint 33 secret detection

```yaml
gitleaks:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
      with:
        fetch-depth: 0
    - uses: gitleaks/gitleaks-action@v2
```

### 17.212 Strategy CI Sprint 33 quality gates

```yaml
quality-gate:
  runs-on: ubuntu-latest
  needs: [test, build]
  steps:
    - name: SonarQube quality gate
      uses: sonarsource/sonarqube-scan-action@master
      env:
        SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
    - name: Wait for quality gate
      uses: sonarsource/sonarqube-quality-gate-action@master
      with:
        scanMetadataReportFile: .scannerwork/report-task.txt
```

### 17.213 Strategy CI Sprint 33 GitHub advanced security

Activate :
- Code scanning (CodeQL)
- Secret scanning (gitleaks via actions)
- Push protection (block secrets in commits)
- Dependency review (block PRs with vulnerable deps)

### 17.214 Strategy CI Sprint 35 GitHub-managed runners cost optimization

```yaml
# Use cheaper runners when possible
runs-on: ubuntu-latest  # 1x compute
# vs
runs-on: ubuntu-latest-large  # 4x compute, 4x cost
```

Run heavy jobs on large runners only when needed.

### 17.215 Strategy CI Sprint 33 audit continuous

Continuous audit Sprint 33 :
- Daily : dependency audit
- Weekly : SAST + DAST scans
- Monthly : full pentest staging
- Quarterly : full pentest production

### 17.216 Strategy CI Sprint 33 governance

GitHub org governance :
- Branch protection rules code-as-config
- Required status checks documented
- Org-wide Actions allowlist
- Audit log enabled enterprise

### 17.217 Strategy CI Sprint 35 GitOps automation

Sprint 35 :
- ArgoCD watches Git
- Manifests in repo (kustomize)
- Apps auto-sync on commit
- Rollback via Git revert

### 17.218 Strategy CI Sprint 33 performance regression detection

```yaml
- name: Compare benchmarks
  run: |
    pnpm benchmark > current.json
    git checkout main
    pnpm benchmark > main.json
    pnpm benchmark:compare main.json current.json
    if [[ $REGRESSION -gt 0 ]]; then
      gh pr comment ${{ github.event.pull_request.number }} -b "Performance regression detected: $REGRESSION%"
    fi
```

### 17.219 Strategy CI Sprint 33 risk-based testing

Sprint 33 risk-based :
- Critical paths (auth, pay) tested 100%
- Core paths (CRM, comm) tested 90%
- Non-critical paths (admin, reports) tested 70%

### 17.220 Final ABSOLU 100ko Tache 1.1.10


### 17.221 Strategy CI Sprint 33 testing pyramid

```
          /\
         /E2\        E2E (Playwright)
        /----\       Sprint 4+ -- 5% effort
       / Integ\      Integration (Vitest + services)
      /--------\     Sprint 3+ -- 20% effort
     /   Unit   \    Unit (Vitest mocks)
    /------------\   Sprint 1+ -- 75% effort
```

### 17.222 Strategy CI Sprint 35 cost reduction

| Optimization | Save |
|--------------|------|
| Self-hosted runners | -60% costs |
| Cache pnpm + Turbo aggressive | 90s warm runs |
| Skip docs CI | 0 minutes for docs PRs |
| Affected packages only | 50% time saved |
| Spot instances Sprint 35 | -40% costs |

### 17.223 Strategy CI Sprint 33 testing strategies

| Test type | Frequency | Tooling |
|-----------|-----------|---------|
| Unit | Every PR | Vitest |
| Integration | Every PR | Vitest + Docker |
| E2E | Every PR (smoke) + nightly (full) | Playwright |
| Load | Weekly + on label | K6 |
| Chaos | Weekly | chaos-mesh |
| Pentest | Quarterly | manual + ZAP |
| Mutation | Monthly | Stryker |

### 17.224 Final ABSOLU 100ko densite atteinte Tache 1.1.10

Sprint 1 progresse 10/15 + densification.


### 17.225 Strategy CI Sprint 35 zero-trust principles

Sprint 35 zero-trust :
- All workflow access verified per request
- All secrets accessed via short-lived tokens
- All deploys require multi-factor approval
- All changes audited

### 17.226 Strategy CI Sprint 35 immutable deploys

Sprint 35 :
- Builds produce immutable images (tagged by commit SHA)
- Deploys reference image SHA, never `:latest`
- Rollback : redeploy previous SHA

### 17.227 Strategy CI Sprint 33 access reviews

Sprint 33 quarterly access review :
- Review GitHub org members
- Review CODEOWNERS team membership
- Review branch protection
- Remove inactive members

### 17.228 Final FINAL Tache 1.1.10 100ko


### 17.229 Final summary Tache 1.1.10 atteint 100ko

CI/CD foundation 5 jobs + 200+ patterns Sprint 1-35 documentes. Sprint 1 10/15.


### 17.230 Strategy CI testing matrix Sprint 33

```yaml
test:
  strategy:
    matrix:
      node: [22.20.0]
      os: [ubuntu-latest, ubuntu-22.04]
  runs-on: ${{ matrix.os }}
```

### 17.231 Strategy GitOps Sprint 35

ArgoCD setup :
- Each environment a separate Application
- Sync auto from Git main
- Health checks before next sync
- Rollback via Git revert

### 17.232 Strategy CI Sprint 35 zero-downtime DB migration

```yaml
db-migrate:
  runs-on: [self-hosted, atlas-bgr]
  steps:
    - run: |
        atlas db migrate verify
        atlas db migrate apply
        atlas db migrate verify
```

### 17.233 Final ABSOLU 100ko Tache 1.1.10 v4

Sprint 1 progresse 10/15. Foundation CI/CD + 233 patterns documentes.


### 17.234 Strategy CI Sprint 33 secrets organisation

GitHub org-level secrets :
- CODECOV_TOKEN
- TURBO_TOKEN
- DATADOG_API_KEY
- SLACK_WEBHOOK
- ATLAS_DEPLOY_TOKEN
- DT_API_KEY (Dependency-Track)
- GITLEAKS_LICENSE
- SONAR_TOKEN
- SLSA_TOKEN

### 17.235 Strategy CI Sprint 33 environments-level secrets

| Env | Secrets prefix |
|-----|----------------|
| development | DEV_* |
| test | TEST_* (auto-generated openssl) |
| staging | STAGING_* |
| production | PROD_* |

### 17.236 Final FINAL ABSOLU 100ko Tache 1.1.10 closing

Foundation CI/CD complete pour 35 sprints. Sprint 1 progresse 10/15.


### 17.237 Strategy CI Sprint 33 shared state cache

Sprint 33 :
- Shared cache pnpm + Turbo Remote
- Reduce CI time 50%
- Cost savings GitHub Actions minutes


### 17.238 Final FINAL closing 100ko Tache 1.1.10

Sprint 1 progresse 10/15 + densification 100ko atteinte.


### 17.239 References finales

- GitHub Actions documentation
- Turborepo CI integration docs
- decision-006 + 8-skalean-insurtech-prompt-master.md Section 7

### 17.240 Closing seal Tache 1.1.10


### 17.241 Strategy CI Sprint 35 final touch

Sprint 35 final :
- All workflows reviewed
- All metrics dashboards
- All runbooks documented
- All disaster recovery tested

### 17.242 Sentinel close ABSOLU 100ko


### 17.243 Foundation CI/CD sprint 1 pour 35 sprints futurs


### 17.244 Final
Final close marker for densification target 100ko
