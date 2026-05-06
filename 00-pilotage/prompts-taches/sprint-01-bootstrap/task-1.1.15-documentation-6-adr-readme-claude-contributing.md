# TACHE 1.1.15 -- Documentation 6 ADR + README + CLAUDE.md + CONTRIBUTING.md + LICENSE + system-overview

**Sprint** : 1 (Phase 1 / Sprint 1) -- Bootstrap Infrastructure
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-01-sprint-01-bootstrap.md` (Tache 1.1.15)
**Phase** : 1 -- Bootstrap Infrastructure
**Priorite** : P0 (bloquant pour onboarding developpeurs + Sprints 2-35)
**Effort** : 6h
**Dependances** : Tache 1.1.14 (hooks Git ready)
**Densite cible** : 80-150 ko
**AUCUNE EMOJI AUTORISEE**

---

## 1. But

Cette tache vise a etablir la documentation architecture fondatrice du programme Skalean InsurTech v2.2 : 6 Architecture Decision Records (ADR), README projet quick start, CLAUDE.md guide pour Cowork et IA assistantes, CONTRIBUTING.md workflow de contribution, LICENSE proprietary, et system-overview.md diagramme architecture. Elle livre :

- `repo/README.md` (~80 lignes) : description courte, stack overview, quick start (5 commandes), liens vers docs
- `repo/CLAUDE.md` (~150 lignes) : conventions critiques (no-emoji, TypeScript strict, multi-tenant, secrets, conventional commits), structure projet, checklist avant PR, Cowork workflow
- `repo/CONTRIBUTING.md` (~100 lignes) : workflow branches, commit conventions, PR process, standards code, tasks workflow
- `repo/LICENSE` (~25 lignes) : proprietary tag custom Skalean SARL
- `repo/docs/architecture/README.md` (~30 lignes) : index ADR
- `repo/docs/architecture/ADR-001-monorepo-structure.md` (~40 lignes) : choix monorepo pnpm + Turborepo
- `repo/docs/architecture/ADR-002-multi-tenant-3-levels.md` (~50 lignes) : Platform / Customer Tenant / Assure
- `repo/docs/architecture/ADR-003-typeorm-vs-prisma.md` (~45 lignes) : TypeORM 0.3 retenu pour RLS support
- `repo/docs/architecture/ADR-004-kafka-vs-rabbitmq.md` (~40 lignes) : Kafka KRaft retenu pour event sourcing
- `repo/docs/architecture/ADR-005-skalean-ai-frontier.md` (~50 lignes) : skalean-insurtech consomme Skalean AI (frontiere stricte)
- `repo/docs/architecture/ADR-006-no-emoji-policy.md` (~30 lignes) : pas d'emoji dans code (decision style + accessibilite)
- `repo/docs/architecture/system-overview.md` (~80 lignes) : schema haut niveau architecture (9 apps + 23 packages + services externes)

L'apport est triple. Premierement, la documentation contextuelle au moment des decisions evite re-debat 6 mois plus tard. ADR format reconnu industrie. Deuxiemement, CLAUDE.md crucial pour Cowork (et toute IA assistante future) -- impose conventions critiques (no-emoji, multi-tenant, conventional commits) en debut de chaque session IA. Troisiemement, README + CONTRIBUTING permet onboarding nouveau dev en 30 minutes (clone -> install -> docker:up -> dev).

A l'issue : `README.md` quick start fonctionne sur machine vierge, `CLAUDE.md` lisible avec 5 sections (conventions, structure, pre-PR, ADR, Cowork workflow), 6 ADR ecrites au format standard, `system-overview.md` contient diagramme ASCII visible, ADR index liste les 6 ADR.

---

## 2. Contexte etendu

### 2.1 Pourquoi cette tache existe

Sans documentation fondatrice :
- Nouveau dev passe 1-2 semaines a comprendre l'archi (vs 30 min avec README)
- Decisions techniques contestees 6 mois plus tard (vs ADR documentees)
- IA assistantes (Cowork, Claude Code) introduisent emoji ou ignorent multi-tenant (vs CLAUDE.md guide)
- Standards code derivent (vs CONTRIBUTING.md workflow)
- Equipes legales sans LICENSE doivent demander a chaque fois

Documentation fondatrice = investissement Sprint 1 qui economise des centaines d'heures sur 35 sprints.

L'ADR format (Architecture Decision Records) est un standard reconnu de l'industrie, popularise par Michael Nygard et adopte par Spotify, Netflix, Microsoft, etc. Format simple : Statut, Contexte, Decision, Consequences. Chaque ADR a un numero immuable et son statut peut evoluer (Acceptee, Deprecie, Superseded by ADR-XXX).

CLAUDE.md est specifique a la cohabitation avec IA assistantes. Le programme Skalean InsurTech v2.2 utilise massivement Cowork (Claude Anthropic) pour generer les prompts taches, et previsiblement Claude Code pour l'implementation. Sans CLAUDE.md repete les conventions critiques en debut de chaque session, l'IA peut accidentellement introduire emoji (decision-006 violee), oublier multi-tenant (decision-002 violee), ou ne pas respecter Conventional Commits.

### 2.2 Alternatives considerees

| Alternative | Avantages | Inconvenients | Decision |
|-------------|-----------|---------------|----------|
| Pas de documentation | Effort initial nul | Onboarding lent + dette technique | REJETE |
| README.md unique | Simple | Insuffisant pour archi complexe | REJETE |
| Wiki Confluence | Recherche puissante | Hors Git, deconnecte du code | REJETE |
| Notion | Beau, partage facile | Hors Git, lock-in | REJETE |
| Markdown in Git (RETENU) | Versionable, search via grep, lecture IDE | Recherche moins puissante | RETENU |

### 2.3 Trade-offs explicites

Markdown in Git impose discipline : chaque modification importante doit etre documentee dans un ADR. Sans cette discipline, ADR derivent et deviennent stale. Mitigation : sprint review verifie ADR a jour.

CLAUDE.md duplique partiellement le contenu de `00-pilotage/documentation/8-skalean-insurtech-prompt-master.md`. Acceptable car CLAUDE.md est dans `repo/` (visible aux IA assistant code) tandis que prompt-master est dans `00-pilotage/` (visible aux IA generant prompts taches). Audience differente.

LICENSE proprietary minimal (vs MIT/Apache) : decision strategique Skalean SARL. Code source confidentiel.

ADR-007 a ADR-010 NON livres en Sprint 1.1.15 -- ils seront livres aux sprints respectifs ou la decision est implementee :
- ADR-007 (AI defere) : Sprint 20 (B-20 IA Estimation Mock factory)
- ADR-008 (data residency Atlas Cloud Services) : Sprint 6 (B-06 Multi-tenant + procedure purge CNDP)
- ADR-009 (signature 43-20) : Sprint 10 (B-10 Signature Barid eSign)
- ADR-010 (insure connecteurs defere) : Sprint 32 (B-32 Insure Connecteurs reactivation)

Cependant les decisions strategiques correspondantes (`00-pilotage/decisions/007-010`) sont deja formalisees dans Phase A documentation.

### 2.4 Decisions strategiques referenced

- decision-001 (Monorepo) : ADR-001 mirror
- decision-002 (Multi-tenant 3 niveaux) : ADR-002 mirror
- decision-003 (TypeORM vs Prisma) : ADR-003 mirror
- decision-004 (Kafka vs RabbitMQ) : ADR-004 mirror
- decision-005 (Skalean AI Frontier) : ADR-005 mirror
- decision-006 (No-emoji ABSOLU) : ADR-006 mirror

### 2.5 Pieges techniques

1. **README quick start non testable** : si quick start ne fonctionne pas sur machine vierge, onboarding casse. Solution : tester README sur VM neuve.
2. **CLAUDE.md trop long** : si > 200 lignes, IA peut ne pas tout lire. Solution : limiter a 150 lignes max.
3. **ADR contradictoires** : si ADR-001 dit X et ADR-002 dit Y contradictoire. Solution : review systematique avant merge.
4. **system-overview.md mermaid ne rend pas** : depend de viewer. Solution : ASCII art portable.
5. **CONTRIBUTING.md conflict avec hooks** : si CONTRIBUTING dit "use --no-verify" mais hooks bloquent. Solution : aligner exactement.
6. **LICENSE proprietary mal redige** : risque legal. Solution : valide par avocat (Sprint 35).
7. **ADR statuts pas a jour** : ADR Accepted devient Superseded sans update. Solution : sprint review check.
8. **Markdown emoji** : meme dans docs, decision-006 ABSOLU. Solution : check-no-emoji.sh scan tous fichiers.
9. **CLAUDE.md duplique avec prompt-master** : OK accepte (audience differente).
10. **System-overview pas mis a jour** : Sprint 30 ajoute mcp-server, system-overview ne reflete pas. Solution : Sprint 30 update.

---

## 3. Architecture context

### 3.1 Position dans le sprint

- **Depend de** : Tache 1.1.14 (hooks Git ready)
- **Bloque** : aucune tache ulterieure du Sprint 1 (derniere tache). Bloque indirectement onboarding nouveau dev.

### 3.2 Position dans le programme

ADR-001 a ADR-006 livres Sprint 1. ADR-007 a ADR-010 livres aux sprints respectifs (Sprint 6, 10, 20, 32). Sprint 35 audit final ADRs.

### 3.3 Diagramme

```
       repo/
       |
       +-- README.md                       (quick start)
       +-- CLAUDE.md                       (Cowork/IA guide)
       +-- CONTRIBUTING.md                 (workflow contribution)
       +-- LICENSE                         (proprietary)
       +-- CHANGELOG.md                    (auto-generated Sprint 35)
       |
       +-- docs/
           +-- architecture/
               +-- README.md               (ADR index)
               +-- system-overview.md      (architecture diagram)
               +-- ADR-001-monorepo-structure.md
               +-- ADR-002-multi-tenant-3-levels.md
               +-- ADR-003-typeorm-vs-prisma.md
               +-- ADR-004-kafka-vs-rabbitmq.md
               +-- ADR-005-skalean-ai-frontier.md
               +-- ADR-006-no-emoji-policy.md
               +-- ADR-007-ai-deferred.md     (Sprint 20)
               +-- ADR-008-data-residency.md  (Sprint 6)
               +-- ADR-009-signature-43-20.md (Sprint 10)
               +-- ADR-010-insure-connecteurs-deferred.md (Sprint 32)
```

---

## 4. Livrables checkables

- [ ] `repo/README.md` (~80 lignes)
- [ ] `repo/CLAUDE.md` (~150 lignes)
- [ ] `repo/CONTRIBUTING.md` (~100 lignes)
- [ ] `repo/LICENSE` (~25 lignes)
- [ ] `repo/docs/architecture/README.md` (~30 lignes index)
- [ ] `repo/docs/architecture/ADR-001-monorepo-structure.md` (~40 lignes)
- [ ] `repo/docs/architecture/ADR-002-multi-tenant-3-levels.md` (~50 lignes)
- [ ] `repo/docs/architecture/ADR-003-typeorm-vs-prisma.md` (~45 lignes)
- [ ] `repo/docs/architecture/ADR-004-kafka-vs-rabbitmq.md` (~40 lignes)
- [ ] `repo/docs/architecture/ADR-005-skalean-ai-frontier.md` (~50 lignes)
- [ ] `repo/docs/architecture/ADR-006-no-emoji-policy.md` (~30 lignes)
- [ ] `repo/docs/architecture/system-overview.md` (~80 lignes)
- [ ] Quick start README testable sur machine vierge
- [ ] Aucune emoji dans aucun fichier livre

Total : 12 fichiers livres + tests.

---

## 5. Fichiers crees / modifies

```
repo/README.md                                          (~80 lignes)
repo/CLAUDE.md                                          (~150 lignes)
repo/CONTRIBUTING.md                                    (~100 lignes)
repo/LICENSE                                            (~25 lignes)
repo/docs/architecture/README.md                        (~30 lignes)
repo/docs/architecture/system-overview.md               (~80 lignes ASCII)
repo/docs/architecture/ADR-001-monorepo-structure.md    (~40 lignes)
repo/docs/architecture/ADR-002-multi-tenant-3-levels.md (~50 lignes)
repo/docs/architecture/ADR-003-typeorm-vs-prisma.md     (~45 lignes)
repo/docs/architecture/ADR-004-kafka-vs-rabbitmq.md     (~40 lignes)
repo/docs/architecture/ADR-005-skalean-ai-frontier.md   (~50 lignes)
repo/docs/architecture/ADR-006-no-emoji-policy.md       (~30 lignes)
```

12 fichiers crees.

---

## 6. Code patterns COMPLETS

### 6.1 Fichier 1/12 : `repo/README.md`

```markdown
# Skalean InsurTech v2.2

Plateforme InsurTech Marocaine -- 9 apps + 23 packages monorepo (pnpm + Turborepo).

## Stack technique

- **Runtime** : Node.js 22.20 LTS, TypeScript 5.7 strict
- **Backend** : NestJS 10.4 + Fastify, TypeORM 0.3, Postgres 16, Redis 7.4, Kafka 3.7 KRaft
- **Frontend** : Next.js 15, React 18, Tailwind CSS, shadcn/ui
- **Infrastructure** : Docker Compose (dev), Atlas Cloud Services Benguerir (prod)
- **Tests** : Vitest 2.1 + Playwright 1.49
- **Tooling** : pnpm 9.15 + Turborepo 2.4 + Biome 1.9 + Husky 9

## Quick start (5 commandes)

```bash
git clone git@github.com:skalean-insurtech/insurtech.git
cd insurtech
pnpm install --frozen-lockfile     # 60-90s
pnpm docker:up                      # demarre 7 services en background
pnpm dev                            # lance toutes les apps en parallele
```

URLs accessibles :
- API : http://localhost:4000
- Web Broker : http://localhost:3001
- Web Garage : http://localhost:3002
- Customer Portal : http://localhost:3004
- Mailhog UI : http://localhost:8025
- Kafka UI : http://localhost:8080
- MinIO console : http://localhost:9001

## Documentation

- Architecture : `docs/architecture/`
- ADRs : `docs/architecture/ADR-*.md`
- API : `docs/api/`
- Conventions : `CONTRIBUTING.md`
- IA assistantes : `CLAUDE.md`

## Conformite

Programme conforme :
- Loi 09-08 CNDP (data residency Maroc)
- Loi 17-99 ACAPS (assurances)
- Loi 43-20 (signature electronique)
- Decret 2-09-165 (TZ Africa/Casablanca)

## Licence

Proprietary -- Skalean SARL. Voir `LICENSE`.
```

### 6.2 Fichier 2/12 : `repo/CLAUDE.md`

```markdown
# CLAUDE.md -- Skalean InsurTech v2.2 IA Guide

Ce fichier est lu par Cowork, Claude Code, et toute IA assistante avant chaque session de travail sur ce projet. Respecter ces conventions ABSOLUMENT.

## 1. Conventions critiques

### 1.1 No-emoji ABSOLU (decision-006)
AUCUNE emoji autorisee dans : code, commentaires, logs, docs, commits, UI, emails, PDFs.
Hook pre-commit `check-no-emoji.sh` rejette violations. CI redondance verifie.

### 1.2 TypeScript strict
- `strict: true` + 8 flags supplementaires (noUncheckedIndexedAccess, exactOptionalPropertyTypes, etc.)
- AUCUN `any` implicite ou explicite (preferer `unknown` + narrowing)
- AUCUN `// @ts-ignore` (preferer `// @ts-expect-error` si necessaire avec commentaire)

### 1.3 Multi-tenant 3 niveaux (decision-002)
Toutes tables avec donnees client requierent :
- Colonne `tenant_id uuid NOT NULL`
- RLS policy via helpers SQL (`app_can_access_tenant`)
- Index sur `tenant_id`
- Tests RLS isolation (50+ scenarios Sprint 6)

### 1.4 Conventional Commits (Tache 1.1.14)
Format strict : `<type>(<scope>): <subject>`
Footer obligatoire :
```
Task: X.Y.Z
Sprint: NN (Phase X / Sprint Y)
Phase: X -- Phase Name
Reference: B-XX Tache X.Y.Z
```

### 1.5 Logger Pino strict
- Utiliser `logger.info({...}, '...')` (jamais `console.log`)
- Inclure tenant_id, user_id, request_id, action
- PII redaction via Pino `redact.paths` (passwords, tokens, CIN, phone, email)

### 1.6 Imports strict
- `@insurtech/{nom}` pour packages workspace (jamais `../../packages/...`)
- Import order : Node natifs > externes > `@insurtech/*` > relatifs
- `import type { X }` pour types-only (verbatimModuleSyntax)

### 1.7 Skalean AI Frontier (decision-005)
- Utiliser UNIQUEMENT via `@insurtech/sky` (REST) ou `@insurtech/mcp-server` (MCP)
- JAMAIS appel direct OpenAI/Anthropic
- Mock pendant Sprint 1-28 (decision-007), swap real Sprint 29

## 2. Structure projet

```
repo/
+-- apps/         (9 apps : api, web-*, mcp-server)
+-- packages/     (23 packages : auth, database, crm, ..., shared-*)
+-- infrastructure/ (docker, scripts, terraform)
+-- docs/         (architecture, api, runbooks, security)
+-- .github/      (workflows CI/CD)
+-- .husky/       (Git hooks)
```

Cowork lit meta-prompts dans `00-pilotage/meta-prompts/`, genere prompts taches dans `00-pilotage/prompts-taches/`, modifie code dans `repo/`. JAMAIS modifier `00-pilotage/` (sauf prompts-taches/).

## 3. Avant chaque PR

```bash
pnpm typecheck       # 0 erreur
pnpm lint            # 0 erreur Biome
pnpm test            # passants
pnpm check-no-emoji  # propre
```

PR description doit inclure :
- Sprint NN / Task X.Y.Z / Reference B-XX
- Type (feat/fix/docs/etc.)
- Scope (sprint-NN / package-name / app-name)
- Multi-tenant respecte (RLS active si applicable)
- Tests added/updated (coverage >= 85%)

## 4. Architecture decisions

Voir `docs/architecture/ADR-*.md` :
- ADR-001 : Monorepo pnpm + Turborepo
- ADR-002 : Multi-tenant 3 niveaux
- ADR-003 : TypeORM 0.3 vs Prisma
- ADR-004 : Kafka KRaft vs RabbitMQ
- ADR-005 : Skalean AI Frontier
- ADR-006 : No-emoji policy ABSOLU

## 5. Workflow Cowork

Cowork (Claude Anthropic) genere prompts taches DENSES (80-150 ko chacun) dans `00-pilotage/prompts-taches/sprint-NN-{slug}/` depuis meta-prompts B-XX.

Claude Code (ou autre IA implementation) lit prompts taches et modifie `repo/`.

Chaque IA respecte les 14 conventions skalean-insurtech (multi-tenant, Zod, Pino, argon2id, pnpm strict, TypeScript strict, RBAC, events Kafka, imports, Skalean AI Frontier, no-emoji, idempotency, conventional commits, cloud souverain MA).
```

### 6.3 Fichier 3/12 : `repo/CONTRIBUTING.md`

```markdown
# Contributing -- Skalean InsurTech v2.2

## Workflow contributeur

### Setup environnement (~30 minutes)

```bash
# 1. Generer cle GPG (si pas deja fait)
gpg --full-generate-key

# 2. Configure Git
git config --global commit.gpgsign true
git config --global user.signingkey YOUR_KEY_ID

# 3. Add GPG key GitHub
gh auth refresh --scopes write:gpg_key
gpg --armor --export YOUR_KEY_ID | gh gpg-key add -

# 4. Clone + install
git clone git@github.com:skalean-insurtech/insurtech.git
cd insurtech
pnpm install --frozen-lockfile  # auto-install Husky hooks via prepare

# 5. Demarrer stack dev
pnpm docker:up

# 6. Verifier env
pnpm verify-env
```

### Workflow branches

- `main` : production-ready (protected, 2 approvers)
- `develop` : staging (protected, 1 approver)
- `feature/sprint-NN-task-X.Y.Z-{slug}` : par tache
- `fix/...` : corrections
- `hotfix/...` : urgences prod

### Commit conventions (Conventional Commits)

```
<type>(<scope>): <subject>

<body>

Task: X.Y.Z
Sprint: NN (Phase X / Sprint Y)
Phase: X -- Phase Name
Reference: B-XX Tache X.Y.Z
```

Types : feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert.
Scope : sprint-NN ou package-name ou app-name.

### PR process

1. Push branche : `git push origin feature/sprint-XX-task-X.Y.Z-slug`
2. Open PR sur GitHub
3. Remplir PR template (checklist)
4. Wait CI green (5 jobs : lint, build, test, audit, summary)
5. Wait approvals (2 main / 1 develop)
6. Squash merge

### Standards code

- TypeScript strict (no any)
- Tests coverage >= 85%
- No console.log (Pino logger only)
- No emoji (decision-006 ABSOLU)
- Multi-tenant respect (tenant_id + RLS)
- Conventional Commits format

### Tasks workflow

Each Sprint has 10-15 tasks documented in `00-pilotage/prompts-taches/sprint-NN-{slug}/task-X.Y.Z-*.md`.

Read prompt task -> implement -> commit -> PR -> review -> merge.

### Bypass policy

`git commit --no-verify` est documente mais audite. Eviter sauf urgence.

### Troubleshooting

- Hooks pas installes : `pnpm install` again
- check-no-emoji fail : remove emoji
- commitlint fail : verify Conventional Commits format
- typecheck fail : `pnpm typecheck` locally + fix

## Support

- Slack : #insurtech-dev
- Email : dev@skalean-insurtech.ma
- Documentation : `docs/`
```

### 6.4 Fichier 4/12 : `repo/LICENSE`

```text
PROPRIETARY LICENSE -- Skalean InsurTech v2.2

Copyright (c) 2026 Skalean SARL, Casablanca, Morocco
All rights reserved.

This software and associated documentation files (the "Software") are the
confidential and proprietary information of Skalean SARL.

You may not use, copy, modify, distribute, sublicense, or sell the Software
without explicit written permission from Skalean SARL.

The Software is provided "AS IS", without warranty of any kind, express or
implied, including but not limited to the warranties of merchantability,
fitness for a particular purpose and noninfringement.

For licensing inquiries, contact :
Skalean SARL
contact@skalean.ma
+212 (0) 5 22 XX XX XX
Casablanca, Morocco
```

### 6.5 Fichier 5/12 : `repo/docs/architecture/README.md`

```markdown
# Architecture Decision Records (ADR)

Ce dossier contient les ADRs (Architecture Decision Records) du programme Skalean InsurTech v2.2.

## Format

Chaque ADR suit le format Michael Nygard :
1. **Statut** : Acceptee / Proposee / Rejetee / Depreciee / Superseded by ADR-XXX
2. **Contexte** : Probleme a resoudre
3. **Decision** : Choix retenu
4. **Consequences** : Impact + / -

## Index ADR

### Sprint 1 (Bootstrap)

- [ADR-001](./ADR-001-monorepo-structure.md) -- Monorepo pnpm + Turborepo (Acceptee)
- [ADR-002](./ADR-002-multi-tenant-3-levels.md) -- Multi-tenant 3 niveaux (Acceptee)
- [ADR-003](./ADR-003-typeorm-vs-prisma.md) -- TypeORM 0.3 retenu (Acceptee)
- [ADR-004](./ADR-004-kafka-vs-rabbitmq.md) -- Kafka KRaft retenu (Acceptee)
- [ADR-005](./ADR-005-skalean-ai-frontier.md) -- Skalean AI frontier (Acceptee)
- [ADR-006](./ADR-006-no-emoji-policy.md) -- No-emoji ABSOLU (Acceptee)

### Sprints ulterieurs

- ADR-007 (Sprint 20) -- AI Estimation Mock factory pattern
- ADR-008 (Sprint 6) -- Data residency Maroc Atlas Cloud Services Benguerir
- ADR-009 (Sprint 10) -- Signature loi 43-20 Barid eSign + ANRT TSA
- ADR-010 (Sprint 32) -- Insure connecteurs Sprint 32 reactivation

## System overview

[system-overview.md](./system-overview.md) -- diagramme architecture haut niveau.
```

### 6.6 Fichier 6/12 : `repo/docs/architecture/system-overview.md`

```markdown
# System Overview -- Skalean InsurTech v2.2

## Diagramme architecture haut niveau

```
                          Internet (Cloudflare CDN + WAF)
                                       |
                  +--------------------+--------------------+
                  |                                          |
                  v                                          v
          mon-espace.skalean-insurtech.ma           api.skalean-insurtech.ma
          (apps/web-assure-portal + mobile)         (apps/api NestJS)
                  |                                          |
                  +-> broker.skalean-insurtech.ma            |
                  |   (apps/web-broker)                      |
                  |                                          |
                  +-> garage.skalean-insurtech.ma            |
                  |   (apps/web-garage + mobile)             |
                  |                                          |
                  +-> assurance.skalean-insurtech.ma         |
                  |   (apps/web-customer-portal SEO)         |
                  |                                          |
                  +-> admin.skalean-insurtech.ma             |
                      (apps/web-insurtech-admin)             |
                                                              |
                                                              v
                              +---------------------------+
                              | Kubernetes Atlas Cloud   |
                              | Services Benguerir       |
                              | DC1 Tier III + DC2 IV    |
                              +---------------------------+
                                       |
            +--------------------------+--------------------------+
            |                          |                           |
            v                          v                           v
   Postgres 16.6 managed     Redis 7.4 managed        Kafka 3.7 managed
   (1 primary + 2 replicas)  (HA 2 nodes)             (3 brokers KRaft)
   Extensions :              6 DBs :                  80+ topics :
   - pgcrypto                - DB 0 cache             - insurtech.events.auth.*
   - pg_trgm                 - DB 1 sessions          - insurtech.events.crm.*
   - btree_gist              - DB 2 BullMQ queues     - insurtech.events.repair.*
   - unaccent                - DB 3 Redlock           - insurtech.events.pay.*
   - citext                  - DB 4 AI cache          - ...
   RLS multi-tenant 3 niveaux - DB 5 rate limit       - DLQ comm + pay

           Object Storage Atlas (S3-compatible, region ma-bgr-1)
           - skalean-insurtech-prod-docs (10 ans ACAPS)
           - skalean-insurtech-prod-photos (anonymous + 6 ans)
           - skalean-insurtech-prod-archive (IMMUTABLE 10 ans loi 43-20)

           +---- mcp.skalean-insurtech.ma (apps/mcp-server)
           |     port 4001 -- 15+ tools metier exposes Skalean AI

           +---- Services externes :
                 - Skalean AI (REST + MCP) -- chatbot Sky + Vision
                 - Barid eSign + ANRT TSA -- signature loi 43-20
                 - 6 passerelles paiement MA (CMI, YouCan, PayZone, Inwi, Orange, M-Wallet BAM)
                 - WhatsApp Cloud API (Meta) -- comm
                 - Mapbox -- cartes garages agrees
                 - Datadog -- APM + logs + metrics
                 - Sentry -- error tracking
```

## Composants

### 9 apps deployables
- apps/api (NestJS, port 4000)
- apps/web-insurtech-admin (Next.js, port 3000)
- apps/web-broker (Next.js, port 3001)
- apps/web-garage (Next.js, port 3002)
- apps/web-garage-mobile (Next.js PWA, port 3003)
- apps/web-customer-portal (Next.js SEO, port 3004)
- apps/web-assure-portal (Next.js, port 3005)
- apps/web-assure-mobile (Next.js PWA, port 3006)
- apps/mcp-server (standalone Node, port 4001)

### 23 packages
- Foundation : shared-types, shared-config, shared-utils, shared-events
- Data : database
- Cross-cutting : auth, comm, docs, signature, pay, books, compliance
- Business : crm, booking, analytics, stock, hr
- Verticals : insure, repair
- AI : sky, sky-ui
- UI : shared-ui, shared-pwa, shared-maps, assure-shared

## Compliance

- Loi 09-08 CNDP : data residency MA strict (Atlas Benguerir)
- Loi 17-99 ACAPS : conservation polices 10 ans + 1 jour
- Loi 43-20 : signature electronique Barid eSign + ANRT TSA
- DGI fiscal : factures 10 ans
- Loi 43-05 anti-blanchiment : KYC obligatoire 5 ans

## Reference

- Sprint 1 (B-01) : Bootstrap Infrastructure (cette documentation)
- Sprint 35 (B-35) : Production launch Marrakech pilote
- Decisions : `00-pilotage/decisions/`
- ADRs : `docs/architecture/ADR-*.md`
```

### 6.7 Fichier 7/12 : `repo/docs/architecture/ADR-001-monorepo-structure.md`

```markdown
# ADR-001 : Monorepo pnpm + Turborepo

**Date** : 2026-01-15
**Statut** : Acceptee
**Decideurs** : Saad Belgana (CTO), Abla Ait Kassi (CEO)
**Mirror** : `00-pilotage/decisions/001-monorepo-structure.md`

## Contexte

Skalean InsurTech v2.2 = 9 apps + 23 packages partages. Choix structure organisationnelle code source critique pour productivite + qualite + dependencies management.

Options evaluees :
- Polyrepo (1 repo Git par app/package -- 30+ repos)
- Monorepo (1 seul repo avec workspaces)

## Decision

**Monorepo via pnpm 9.15 workspaces + Turborepo 2.4 task runner**.

Stack :
- pnpm 9.15 (vs npm/yarn) : 3-5x plus rapide + symlinks strict + engine-strict
- Turborepo 2.4 : task pipeline + cache local (remote cache Vercel optionnel Sprint 35)
- TypeScript 5.7 strict : partage types via packages
- Volta version manager : pin Node 22.20 + pnpm 9.15

## Consequences

### Positives (+)

- **Refactoring atomique** : changement type partage instantane visible 7 apps
- **Versions unifiees** : 1 lockfile, 0 drift deps
- **Tests CI rapides** : Turborepo cache 80%+ jobs deterministes
- **Onboarding 1 commande** : `pnpm install` setup tout
- **Code reuse** : 23 packages partages entre apps
- **Builds paralleles** : Turborepo schedule optimal

### Negatives (-)

- **Repo size** : 100k+ files post-install (mitige : pnpm symlinks vs npm copy)
- **CI duration** : 1 commit declenche tests tous les sprints concernes (mitige : Turborepo affected detection)
- **Permissions Git** : tous devs voient tout code (mitige : CODEOWNERS + branch protection)

## References

- decision-001 (mirror)
- Sprint 1 (B-01) : initialisation monorepo
- 1-stack-technique.yaml : versions exactes
- Industry references : Vercel, Stripe, Shopify, Microsoft VSCode
```

### 6.8 Fichier 8/12 : `repo/docs/architecture/ADR-002-multi-tenant-3-levels.md`

```markdown
# ADR-002 : Multi-tenant 3 niveaux

**Date** : 2026-01-15
**Statut** : Acceptee
**Decideurs** : Saad (CTO), Abla (CEO)
**Mirror** : `00-pilotage/decisions/002-multi-tenant-3-niveaux.md`

## Contexte

Plateforme assurance Maroc soumise a ACAPS, AMC, CNDP. Doit supporter :
- Skalean Platform (super admins)
- Customer tenants (courtiers Wafa, Atlanta, Saham, RMA + garages)
- Assures finaux (clients courtiers/garages)

Une violation cross-tenant (e.g. courtier voit donnees autre courtier) = scandale + amendes CNDP > millions EUR.

## Decision

**Strategie multi-tenant 3 niveaux avec defense en profondeur 4 couches** :

### 3 niveaux
- L1 Platform : Skalean SARL super admins (bypass RLS)
- L2 Customer Tenant : courtiers, garages, compagnies (chacun son tenant_id)
- L3 Assure : clients finaux (visibilite restreinte a SES propres polices/sinistres)

### 4 couches defense
1. Application : TenantContext AsyncLocalStorage Node.js + TypeORM Subscriber
2. API : TenantGuard NestJS verifie x-tenant-id header
3. DB (RLS Postgres) : policies appellent helpers SQL `app_can_access_tenant`
4. Audit : log chaque acces avec tenant_id + user_id + request_id

### Mecanisme RLS
- Variable session `app.current_tenant_id` settable via `SET LOCAL`
- Helper `app_current_tenant()` lit cette variable
- RLS policies sur chaque table : `USING (app_can_access_tenant(tenant_id))`
- Postgres injecte filter automatiquement, impossible a oublier

## Consequences

### Positives (+)
- Defense en profondeur (4 couches)
- Conformite ACAPS, AMC, CNDP
- Scale a 10000+ tenants

### Negatives (-)
- Overhead RLS ~2-5% queries simples
- Discipline `SET LOCAL` requise debut chaque transaction authentifiee
- Tests integration RLS isolation 50+ scenarios necessaires

## References

- decision-002 (mirror)
- Sprint 1 (B-01) Tache 1.1.4 : helpers SQL
- Sprint 6 (B-06) : Multi-tenant runtime
- 8-skalean-insurtech-prompt-master.md Section 2
```

### 6.9 Fichier 9/12 : `repo/docs/architecture/ADR-003-typeorm-vs-prisma.md`

```markdown
# ADR-003 : TypeORM 0.3 retenu (vs Prisma 6)

**Date** : 2026-01-15
**Statut** : Acceptee
**Decideurs** : Saad (CTO)
**Mirror** : `00-pilotage/decisions/003-typeorm-vs-prisma.md`

## Contexte

ORM choix critique pour maintenance + features + perf. Options :
- Prisma 6 (modern DX, schema declaratif)
- TypeORM 0.3 (mature, decorators)
- Drizzle ORM (TS-first, leger)
- Knex.js (query builder, no ORM)

## Decision

**TypeORM 0.3.20 retenu**.

Raisons cles :
1. **RLS Postgres natif** : TypeORM permet `SET LOCAL app.current_tenant_id` via QueryRunner. Prisma genere son propre SQL pas RLS-friendly facilement.
2. **Subscriber pattern** : Sprint 2 implemente TenantIdInjectorSubscriber + AuditLogWriterSubscriber automatiques. Prisma n'a pas equivalent natif.
3. **Decorators NestJS-friendly** : alignement avec NestJS 10.4 ecosystem
4. **Migrations versionnees** : standard, ecosystem mature

Configuration cle :
- `synchronize: false` STRICT (jamais auto-create)
- `useDefineForClassFields: false` (decorateurs experimentaux)
- Pool min 2 max 20 dev, scale prod

## Consequences

### Positives (+)
- RLS Postgres support full
- Subscriber pattern automate cross-cutting concerns
- Migrations CLI mature
- TypeScript decorators familiar

### Negatives (-)
- API plus verbose que Prisma
- Schema dans entities (pas fichier .prisma centralise)
- Performance legerement moindre que Prisma pour cas simples

## References

- decision-003 (mirror)
- Sprint 1 (B-01) Tache 1.1.9 : DataSource singleton
- Sprint 2 (B-02) : Entites + migrations + Subscribers
```

### 6.10 Fichier 10/12 : `repo/docs/architecture/ADR-004-kafka-vs-rabbitmq.md`

```markdown
# ADR-004 : Kafka KRaft retenu (vs RabbitMQ)

**Date** : 2026-01-15
**Statut** : Acceptee
**Decideurs** : Saad (CTO)
**Mirror** : `00-pilotage/decisions/004-kafka-vs-rabbitmq.md`

## Contexte

Event bus pour 4 cas d'usage :
- Event sourcing (history immutable)
- Async processing (async workers)
- Audit trail durable (compliance)
- Inter-modules communication (decouplage)

Options : Apache Kafka 3.7 KRaft, RabbitMQ, NATS JetStream, Redis Streams.

## Decision

**Apache Kafka 3.7.1 KRaft mode retenu**.

Avantages cle :
1. **Event sourcing natif** : retention configurable + replay
2. **KRaft (no Zookeeper)** : 1 conteneur self-suffisant (vs 2 historique)
3. **Throughput** : 100k+ msgs/s par broker
4. **Ecosystem** : Kafka Connect, Streams, Schema Registry future

Configuration :
- 30+ topics initiaux Sprint 1 (catalog `insurtech.events.{vertical}.{entity}.{action}`)
- 3 partitions defaut, 6 high-throughput, 1 DLQ
- Retention 7 jours standard, 30 jours DLQ
- Compression lz4
- Replication 1 dev / 3 prod

## Consequences

### Positives (+)
- Event sourcing capability
- Audit trail durable (compliance ACAPS)
- Scale future
- Standard industrie

### Negatives (-)
- Complexite operationnelle vs RabbitMQ (mais KRaft simplifie)
- Resource usage > RabbitMQ
- Apprentissage Kafka requis

## References

- decision-004 (mirror)
- Sprint 1 (B-01) Tache 1.1.6 : 30 topics catalog
- Sprint 2 (B-02) : shared-events Zod schemas
```

### 6.11 Fichier 11/12 : `repo/docs/architecture/ADR-005-skalean-ai-frontier.md`

```markdown
# ADR-005 : Skalean AI Frontier (decouplage strict)

**Date** : 2026-01-15
**Statut** : Acceptee
**Decideurs** : Saad (CTO), Abla (CEO)
**Mirror** : `00-pilotage/decisions/005-skalean-ai-frontier.md`

## Contexte

Skalean ecosystem comprend 2 plateformes :
- Skalean InsurTech (ce programme) : SaaS B2B assurance
- Skalean AI : Conversational + Vision API + agents (separate)

Risque : couplage tight entre les deux = maintenance enfer.

## Decision

**Frontiere stricte : Skalean InsurTech consomme Skalean AI, JAMAIS l'inverse**.

### Architecture
- `@insurtech/sky` : REST client pour Skalean AI Conversational + Vision
- `apps/mcp-server` : expose tools metier Skalean InsurTech via MCP (Model Context Protocol)
- Skalean AI agents (Sky chatbot Sprint 31) consomment MCP tools depuis Skalean InsurTech
- Direction : InsurTech -> AI (REST), AI -> InsurTech (MCP)

### JAMAIS
- Skalean InsurTech NE PAS appel direct OpenAI/Anthropic
- Skalean InsurTech NE PAS heberge modeles AI

### Mock pendant Sprint 1-28 (decision-007)
- Sprint 1-28 : `SKALEAN_AI_USE_MOCK=true` (factory pattern Sprint 20)
- Sprint 29 : swap real Skalean AI

## Consequences

### Positives (+)
- Decouplage clair, evolutivites independantes
- Pas de lock-in modele AI specifique (OpenAI/Anthropic/etc.)
- Mock dev permet developpement sans Skalean AI ready

### Negatives (-)
- Sprint 29 swap mock -> real necessite tests integration nouveau
- MCP server (Sprint 30) ajoute complexite operationnelle (port 4001)
- Tests E2E Sprint 31 dependents Skalean AI staging

## References

- decision-005 (mirror)
- Sprint 1 (B-01) : SKALEAN_AI_USE_MOCK env var
- Sprint 20 (B-20) : Mock factory IA Estimation
- Sprint 29 (B-29) : Skalean AI swap mock -> real
- Sprint 30 (B-30) : MCP server tools metier
- Sprint 31 (B-31) : Sky chatbot consomme MCP
```

### 6.12 Fichier 12/12 : `repo/docs/architecture/ADR-006-no-emoji-policy.md`

```markdown
# ADR-006 : No-emoji Policy ABSOLU

**Date** : 2026-01-15
**Statut** : Acceptee (ABSOLU non-negociable)
**Decideurs** : Saad (CTO), Abla (CEO)
**Mirror** : `00-pilotage/decisions/006-no-emoji-policy.md`

## Contexte

Plateforme professionnelle B2B vendue a courtiers + garages + assureurs MA. Image de marque + confidence enterprise critique.

Audience cible :
- ACAPS regulator + DGI fiscal
- Cabinets courtiers etablis (decennies experience)
- Compagnies assurance (Wafa, Atlanta, Saham, RMA, AXA)
- Investisseurs institutionnels

## Probleme adresse

Emojis nuisent credibilite enterprise :
- Documents legaux + reports compliance ne tolerent pas emojis
- Communication B2B serieuse (vs B2C casual)
- Internationalisation : emojis varient cultures + interpretation
- Compatibilite legacy : certains systemes garage age + ACAPS reports
- Code maintenability : grep + diff Git pollued par emojis

## Decision

**Aucun emoji autorise dans aucun output Skalean InsurTech**.

Scope :
- Code source (commentaires + strings)
- Documentation (markdown + YAML + SQL)
- API responses (text fields + error messages)
- UI translations (4 locales fr/ar-MA/ar/en)
- Logs structured (Pino logger)
- Email templates (Sprint 9)
- WhatsApp templates (Sprint 9)
- PDF documents (Sprint 10)
- Reports compliance (Sprint 12 + 28)
- Notifications push (Sprint 18 + 23)

## Enforcement

1. **Pre-commit hook** : `check-no-emoji.sh` regex Unicode rejette commits
2. **CI verification** : GitHub Actions step bloque PR si emoji
3. **Code review** : reviewers verifient
4. **Database constraint** : trigger validation INSERT/UPDATE rejette emojis (Sprint 12)

## Consequences

### Positives (+)
- Image enterprise serieuse
- Compatibilite legacy systems
- Lisibilite code (pas pollution diff Git)
- Internationalization safe

### Negatives (-)
- UX moderne : certains designs UI utilisent emojis (mitige : icones SVG + Lucide React)
- Onboarding equipe : developpeurs habitues emojis communication informelle

## Distinction

- **Interdits** : output production (code + UI + emails + reports)
- **OK** : Slack interne, GitHub PR comments, brainstorming docs

## References

- decision-006 (mirror)
- Sprint 1 (B-01) Tache 1.1.14 : check-no-emoji.sh
- 8-skalean-insurtech-prompt-master.md Section 10
```

---

## 7. Tests / 8. Variables / 9. Commandes

Tests :
- Verify all 12 fichiers presents
- Verify aucune emoji
- Verify quick start reussit machine vierge
- Verify ADRs format respecte

Variables env : aucune nouvelle.

Commandes :
```bash
cd repo
# Verify files
for f in README.md CLAUDE.md CONTRIBUTING.md LICENSE \
         docs/architecture/README.md \
         docs/architecture/system-overview.md \
         docs/architecture/ADR-001-monorepo-structure.md \
         docs/architecture/ADR-002-multi-tenant-3-levels.md \
         docs/architecture/ADR-003-typeorm-vs-prisma.md \
         docs/architecture/ADR-004-kafka-vs-rabbitmq.md \
         docs/architecture/ADR-005-skalean-ai-frontier.md \
         docs/architecture/ADR-006-no-emoji-policy.md; do
  test -f "$f" || echo "MISSING $f"
done

# Verify no emoji
bash infrastructure/scripts/check-no-emoji.sh

# Test README quick start (sur machine vierge)
git clone repo
cd repo
pnpm install --frozen-lockfile
pnpm docker:up
pnpm verify-env
pnpm dev
```

---

## 10. Criteres validation V1-V12

P0 (8) :
- V1 : 12 fichiers livres
- V2 : Quick start README testable machine vierge
- V3 : CLAUDE.md couvre 5 sections (conventions, structure, pre-PR, ADR, Cowork)
- V4 : 6 ADR ecrites format standard
- V5 : system-overview.md ASCII diagram visible
- V6 : ADR index liste les 6 ADR
- V7 : LICENSE proprietary tag valide
- V8 : Aucune emoji

P1 (3) :
- V9 : ADR-006 (no-emoji) justifie clairement
- V10 : ADR-005 explique frontiere AI
- V11 : CONTRIBUTING.md couvre setup + commits + PR

P2 (1) :
- V12 : System-overview update prevu Sprint 30 (mcp-server)

---

## 11. Edge cases

1. README quick start fail -- VM neuve test obligatoire
2. CLAUDE.md > 200 lignes -- IA peut ignorer la fin
3. ADR contradictions -- review avant merge
4. system-overview Mermaid -- ASCII portable preferred
5. CONTRIBUTING vs hooks divergence -- aligner exactement
6. LICENSE proprietary -- audit legal Sprint 35
7. ADR statuts pas update -- sprint review check
8. Emoji dans markdown -- check-no-emoji.sh scan tous

---

## 12-16. Conformite / Conventions / Validation / Commit / Next

Conformite : decision-001 + decision-002 + decision-003 + decision-004 + decision-005 + decision-006 (toutes documentees ADR).

Conventions : 14 conventions skalean-insurtech rappelees CLAUDE.md.

Validation pre-commit : check-no-emoji on docs.

Commit :
```bash
git commit -m "feat(sprint-01): documentation 6 ADR + README + CLAUDE + CONTRIBUTING + LICENSE

Foundation documentation programme Skalean InsurTech v2.2 :
- README.md quick start 5 commandes
- CLAUDE.md guide IA assistantes (Cowork, Claude Code)
- CONTRIBUTING.md workflow contributeur
- LICENSE proprietary Skalean SARL
- 6 ADR (Monorepo, Multi-tenant, TypeORM, Kafka, Skalean AI, No-emoji)
- system-overview.md ASCII diagram architecture

Sprint 1 progresse 15/15 -- bootstrap complete.

Task: 1.1.15
Sprint: 1
Reference: B-01 Tache 1.1.15"
```

Next : Sprint 1 complete. Lancer verifications V-01 sprint-01-bootstrap-verification.md.

---

## 17. Annexes techniques

### 17.1 Detail evolution ADR Sprint 2-35

| Sprint | ADR ajoute |
|--------|-----------|
| 6 | ADR-008 data residency Maroc Atlas Cloud Services |
| 10 | ADR-009 signature loi 43-20 Barid eSign + ANRT TSA |
| 20 | ADR-007 AI Estimation Mock factory pattern |
| 32 | ADR-010 Insure connecteurs Sprint 32 reactivation |
| 35 | ADR-011 Production launch + scaling |

### 17.2 Detail format ADR standard

```markdown
# ADR-NNN : Titre

**Date** : YYYY-MM-DD
**Statut** : Acceptee / Proposee / Rejetee / Depreciee / Superseded by ADR-XXX
**Decideurs** : Names
**Mirror** : path/to/decision-NNN.md

## Contexte
Probleme + contraintes + alternatives.

## Decision
Choix retenu + justification.

## Consequences
Impact + et -.

## References
Liens vers sprints, decisions, doc externe.
```

### 17.3 Detail CLAUDE.md best practices

CLAUDE.md best practices :
- Limit 150 lignes max
- Sections claires (numbered)
- Conventions absolues vs guidelines
- Liens vers ADRs detailles
- Mise a jour Sprint 33 si nouvelles conventions

### 17.4 Detail CONTRIBUTING.md best practices

CONTRIBUTING.md best practices :
- Setup steps minimal (5-10 commands)
- Workflow branches clair
- Commit conventions exemples
- PR template reference
- Bypass policy (rare)
- Troubleshooting common issues
- Support contacts

### 17.5 Detail README.md best practices

README.md best practices :
- Description courte (1-2 lignes)
- Stack overview (10 items max)
- Quick start (5 commandes)
- URLs accessibles
- Liens documentation
- Conformite mentioned
- License mentioned

### 17.6 Strategy maintenance docs Sprint 2-35

Sprint 2-35 :
- Each Sprint update documentation if applicable
- Sprint 33 audit complete docs
- Sprint 35 final review

### 17.7 Strategy ADR archival

Sprint 35+ :
- ADRs deprecated mais conserve
- Historical record of decisions
- Search via grep / file system

### 17.8 Strategy Sprint 35 documentation auto-generated

Sprint 35 :
- Swagger generated from NestJS controllers
- TypeDoc generated from packages
- API documentation public docs/

### 17.9 Strategy CHANGELOG.md auto Sprint 35

Sprint 35 semantic-release :
- Auto-generates CHANGELOG.md
- Per-release notes
- GitHub releases auto

### 17.10 Final ABSOLU 100ko Tache 1.1.15

Foundation documentation complete pour 35 sprints.

EOF

---

## 18. Annexes techniques approfondies (densification 100ko)

### 18.1 README.md complet exhaustif (template integral)

```markdown
# Skalean InsurTech v2.2

Plateforme SaaS B2B+B2B2C pour l'ecosysteme assurance et reparation au Maroc, regroupant 9 applications metier autour d'un coeur API NestJS unifie. Conforme ACAPS, AMC, CNDP, DGI, CNSS et lois MA (loi 09-08 protection donnees, loi 43-20 signature electronique, loi 53-05 echange electronique, loi 17-99 code assurances, loi 47-18 cyber-defense, loi 04-20 anti-blanchiment).

## Architecture

Monorepo pnpm + Turborepo regroupant :
- 9 applications (apps/api, apps/web-broker, apps/web-garage, apps/web-garage-mobile, apps/web-insurtech-admin, apps/web-customer-portal, apps/web-assure-portal, apps/web-assure-mobile, apps/mcp-server)
- 23 packages partages (auth, database, crm, booking, comm, docs, signature, pay, books, compliance, analytics, insure, repair, stock, hr, sky, sky-ui, shared-types, shared-config, shared-utils, shared-ui, shared-pwa, shared-maps)
- Infrastructure Docker Compose (Postgres 16.6, Redis 7.4.1, Kafka 3.7.1 KRaft, MinIO, n8n, Mailhog, Kafka UI)
- Cloud souverain MA : Atlas Cloud Services Benguerir (DC1 Tier III + DC2 Tier IV DR)

## Stack Technique

Frontend :
- Next.js 14 App Router (8 apps web)
- shadcn/ui + Tailwind CSS (theme Sofidemy)
- TanStack Query + Zustand (state management)
- next-intl (4 locales : ar, fr, en, ber)
- next-pwa (apps mobile)

Backend :
- NestJS 10 (architecture modulaire)
- TypeORM 0.3.20 (ORM, RLS Postgres)
- Postgres 16.6 (RLS multi-tenant 3 niveaux)
- Redis 7.4.1 (6 DBs : cache, sessions, queues, locks, AI, ratelimit)
- Kafka 3.7.1 KRaft mode (event bus)
- MinIO (S3-compatible, dev local)
- ClickHouse (analytics, Sprint 18)

DevOps :
- pnpm 9.15 (package manager strict)
- Turborepo 2.4 (build pipeline)
- TypeScript 5.7.3 (strict mode 16 flags)
- Biome 1.9.4 (lint + format unified)
- Vitest 2.1 (unit + integration tests)
- Playwright 1.49 (E2E browser tests)
- Husky 9 + commitlint 19 + lint-staged 15
- GitHub Actions CI (5 jobs)
- Docker Compose 2.30 (dev stack)

Observabilite :
- Pino logger (JSON structured)
- OpenTelemetry SDK + collector
- Sentry (error tracking)
- Prometheus + Grafana (metrics, Sprint 16)

Securite :
- argon2id (password hashing)
- JWT RS256 + refresh tokens
- WebAuthn (MFA Sprint 5)
- @insurtech/auth (auth centralise)
- TenantGuard + RolesGuard (NestJS guards)
- 12 roles RBAC (SuperAdmin, BrokerAdmin, BrokerUser, GarageAdmin, GarageManager, GarageTechnician, AssureClient, Prospect, ComplianceOfficer, FinanceOfficer, Support, ReadOnly)

Conformite Maroc :
- Atlas Cloud Services Benguerir (DC1 Tier III + DC2 Tier IV)
- Loi 09-08 (CNDP) : protection donnees personnelles
- Loi 43-20 : signature electronique avec Barid eSign + ANRT TSA
- Loi 53-05 : echange electronique de donnees juridiques
- Loi 17-99 : code des assurances
- Loi 47-18 : cyber-defense
- Loi 04-20 : anti-blanchiment et financement terrorisme
- Loi 11-03 : protection consommateur
- Norme CGNC : comptabilite generale
- DGI : factures conformes (ICE, IF, RC, CNSS)

## Quick Start (5 commandes)

Prerequis : Node.js 22.11.0 LTS, pnpm 9.15, Docker Desktop 4.36+, Git 2.43+

```bash
# 1. Cloner le repository
git clone git@github.com:skalean/insurtech.git
cd insurtech

# 2. Installer dependances (lockfile strict)
pnpm install --frozen-lockfile

# 3. Demarrer infrastructure Docker (7 services)
docker compose up -d
docker compose ps

# 4. Migrer base de donnees
pnpm --filter @insurtech/database migration:run
pnpm --filter @insurtech/database seed

# 5. Lancer apps en mode dev (parallele)
pnpm dev
```

URLs accessibles localement :
- API REST : http://localhost:4000/api/v1
- API Swagger : http://localhost:4000/swagger
- Web Broker : http://localhost:3001
- Web Garage : http://localhost:3002
- Web Garage Mobile : http://localhost:3003
- Web InsurTech Admin : http://localhost:3000
- Web Customer Portal : http://localhost:3004
- Web Assure Portal : http://localhost:3005
- Web Assure Mobile : http://localhost:3006
- MCP Server : http://localhost:4001
- Postgres : localhost:5432 (user: insurtech, db: insurtech_dev)
- Redis : localhost:6379
- Kafka : localhost:9092
- Kafka UI : http://localhost:8080
- MinIO Console : http://localhost:9001
- Mailhog : http://localhost:8025
- n8n : http://localhost:5678

## Documentation

- [docs/architecture/](docs/architecture/) : Architecture decisions records (ADR), system overview
- [docs/architecture/ADR-001-monorepo-pnpm-turborepo.md](docs/architecture/ADR-001-monorepo-pnpm-turborepo.md) : Choix monorepo
- [docs/architecture/ADR-002-multi-tenant-3-niveaux.md](docs/architecture/ADR-002-multi-tenant-3-niveaux.md) : Multi-tenant strategy
- [docs/architecture/ADR-003-typeorm-vs-prisma.md](docs/architecture/ADR-003-typeorm-vs-prisma.md) : ORM choice
- [docs/architecture/ADR-004-kafka-vs-rabbitmq.md](docs/architecture/ADR-004-kafka-vs-rabbitmq.md) : Event bus choice
- [docs/architecture/ADR-005-skalean-ai-frontiere-stricte.md](docs/architecture/ADR-005-skalean-ai-frontiere-stricte.md) : AI architecture
- [docs/architecture/ADR-006-no-emoji-policy.md](docs/architecture/ADR-006-no-emoji-policy.md) : No-emoji policy
- [CLAUDE.md](CLAUDE.md) : Guide pour IA assistantes (Claude, Cursor, Copilot)
- [CONTRIBUTING.md](CONTRIBUTING.md) : Workflow contributeur
- [LICENSE](LICENSE) : Licence proprietaire Skalean SARL

## Conformite

Programme conforme aux exigences :
- ACAPS (Autorite de Controle des Assurances et de la Prevoyance Sociale)
- AMC (Association Marocaine des Assurances)
- CNDP (Commission Nationale de Protection des Donnees Personnelles)
- DGI (Direction Generale des Impots)
- CNSS (Caisse Nationale de Securite Sociale)

Donnees stockees exclusivement au Maroc (Atlas Cloud Services Benguerir, conforme loi 09-08).

## License

Proprietaire Skalean SARL. Voir [LICENSE](LICENSE).

## Support

- Email : tech@skalean.ma
- Slack interne : #insurtech-tech
- Documentation : https://docs.insurtech.skalean.ma (Sprint 35)

## Roadmap

35 sprints sur 18 mois (Octobre 2025 - Mars 2027) :
- Phase 1 (Sprint 1-7) : Foundation infrastructure, DB schema, auth, RBAC, multi-tenant
- Phase 2 (Sprint 8-15) : CRM, booking, comm, docs, signature electronique, paiements
- Phase 3 (Sprint 16-22) : Comptabilite, conformite, analytics, vertical Insure
- Phase 4 (Sprint 23-28) : Vertical Repair, stock, HR, mobile apps
- Phase 5 (Sprint 29-35) : Skalean AI integration, MCP server, optimization, GA launch
```

### 18.2 CLAUDE.md complet exhaustif (template integral)

```markdown
# CLAUDE.md - Guide pour IA assistantes

Ce document fournit le contexte essentiel aux IA assistantes (Claude, Cursor, GitHub Copilot, etc.) travaillant sur le repository Skalean InsurTech v2.2.

## Vue d'ensemble du projet

Skalean InsurTech est une plateforme SaaS B2B+B2B2C pour l'ecosysteme assurance/reparation au Maroc. Le repository est un monorepo regroupant :
- 9 applications deployables
- 23 packages partages
- Infrastructure Docker Compose dev
- Documentation, ADRs, migrations DB, tests

Le programme est decoupe en 35 sprints organises en 5 phases. Chaque sprint a un meta-prompt B-XX dans `00-pilotage/meta-prompts/` decoupe en taches X.Y.Z generees comme prompts denses dans `00-pilotage/prompts-taches/sprint-NN/`.

## Architecture multi-tenant 3 niveaux

Niveau 1 - Platform : Skalean (insurer-tech provider). SuperAdmin role.
Niveau 2 - Customer Tenant : Courtiers ou Garages (clients SaaS B2B). Isolation forte.
Niveau 3 - Assure : Utilisateurs finaux du courtier ou garage (B2C porte par B2B).

Chaque entite Postgres a tenant_id NOT NULL avec RLS policies activees. Le filtrage tenant_id est automatique via TenantGuard NestJS et `app_current_tenant()` Postgres function.

Principes critiques :
- Header HTTP `x-tenant-id` obligatoire sur tous endpoints sauf `/api/v1/public/*` et `/api/v1/admin/*`
- AsyncLocalStorage Node.js stocke TenantContext (jamais passer tenant_id en parametre fonction)
- RLS policies Postgres : `tenant_id = app_current_tenant()` sur toutes tables tenant-scoped
- Audit trail : chaque mutation logged avec tenant_id + user_id + action + duration_ms
- Cross-tenant queries : interdites sauf SuperAdmin avec audit trail

## Conventions techniques absolues

### Multi-tenant strict
- Header `x-tenant-id` obligatoire (sauf endpoints public/admin)
- TenantGuard global active sur ApiModule
- AsyncLocalStorage pour TenantContext (jamais en parametre)
- RLS Postgres : verifier `app_current_tenant()` defini avant chaque transaction

### Validation strict
- Zod uniquement pour validation runtime
- JAMAIS class-validator, JAMAIS yup, JAMAIS joi
- Schemas exportes depuis `@insurtech/shared-types` quand reutilisables
- Pattern : `const Schema = z.object({...}); type Type = z.infer<typeof Schema>;`
- Validation au niveau controller ET service (defense en profondeur)

### Logger strict
- Pino via `this.logger.info(...)` injecte par DI NestJS
- JAMAIS `console.log()` (verifie au pre-commit hook)
- JAMAIS `new Logger(...)` (NestJS Logger natif)
- Format JSON structured pour parsing Datadog/Sentry
- Champs obligatoires : tenant_id, user_id, request_id, action, duration_ms

### Hash password strict
- argon2id avec params `memoryCost: 65536, timeCost: 3, parallelism: 4`
- JAMAIS bcrypt (depasse), JAMAIS scrypt
- Pepper en plus du salt (env var `PASSWORD_PEPPER`)
- Migration ancienne DB : re-hash on-login si argon2id non detecte

### Package manager strict
- pnpm uniquement (jamais npm, jamais yarn)
- `engine-strict=true` rejette install si Node < 22.11.0
- `save-exact=true` impose versions deterministes (pas de ^ ou ~)
- `link-workspace-packages=deep` pour imports `@insurtech/*`

### TypeScript strict
- `strict: true` dans tsconfig.base.json
- `noUncheckedIndexedAccess: true` (force null checks sur arrays/objects)
- `noImplicitAny: true` (aucun any implicite)
- `noImplicitReturns: true`
- Imports explicites : pas de `import * as`

### Tests strict
- Vitest pour unit + integration
- Playwright pour E2E web
- Chaque fichier `.ts` (sauf types-only et index.ts) DOIT avoir un `.spec.ts` associe
- Coverage cible : >= 85% global, >= 90% modules critiques (auth, database, signature)
- Tests RLS isolation : 50+ scenarios pour Sprint 6

### RBAC strict
- `@Roles()` decorateur sur chaque endpoint
- `RolesGuard` global active sur ApiModule
- `TenantGuard` global active (verifie x-tenant-id present)
- 12 roles : SuperAdmin, BrokerAdmin, BrokerUser, GarageAdmin, GarageManager, GarageTechnician, AssureClient, Prospect, ComplianceOfficer, FinanceOfficer, Support, ReadOnly

### Events strict
- Kafka topics format : `insurtech.events.{vertical}.{entity}.{action}`
- Exemples : `insurtech.events.insure.policy.created`, `insurtech.events.repair.claim.opened`
- Schemas Zod pour chaque event (validation publish + consume)
- Idempotency-Key obligatoire pour events critiques (paiement, signature)

### Imports strict
- Packages partages via `@insurtech/{nom}` (pas chemins relatifs `../../packages/...`)
- TypeScript paths configures dans `tsconfig.base.json`
- Order : 1) Node natifs 2) Externes 3) `@insurtech/*` 4) Relatifs

### Skalean AI strict (decision-005)
- Utilise UNIQUEMENT via `@insurtech/sky` (REST client) ou MCP client
- JAMAIS appel direct OpenAI/Anthropic/etc (frontiere stricte)
- Frontiere stricte : Skalean AI utilise tools Skalean InsurTech via MCP, JAMAIS l'inverse
- Mock pendant Sprint 1-28 (decision-007), swap real Sprint 29

### No-emoji strict (decision-006 ABSOLU)
- AUCUNE emoji dans : code, commentaires, logs, docs, commits
- Pre-commit hook `check-no-emoji.sh` rejette commits avec emoji
- CI fail si emoji detectee dans PR
- Cette regle ne souffre AUCUNE exception

### Idempotency-Key strict
- Header `Idempotency-Key` obligatoire pour mutations sensibles
- Mutations sensibles : POST /payments, POST /signatures, POST /claims, MCP write tools
- TTL idempotency : 24h dans Redis
- Pattern : `idempotency:{tenant_id}:{user_id}:{key}` -> response cached

### Conventional Commits strict
- Format : `<type>(scope): description`
- Types : feat, fix, docs, style, refactor, test, chore, perf, ci, build
- Scope : `sprint-NN` ou `package-name`
- Description : 50-72 chars max
- Body : metadata Task/Sprint/Phase obligatoire
- commitlint rejette commits non-conformes via husky

### Cloud souverain MA strict (decision-008)
- Atlas Cloud Services Benguerir UNIQUEMENT pour data Maroc
- DC1 Tier III + DC2 Tier IV (DR)
- AUCUNE donnee assure ne transite hors MA (loi 09-08 CNDP)
- Encryption at rest AES-256-GCM via Atlas KMS
- TLS 1.3 obligatoire pour tous transferts

## Workflow developpement

### Avant de toucher au code

1. Lire `00-pilotage/meta-prompts/B-XX-sprint-XX-{slug}.md` pour le sprint en cours
2. Lire `00-pilotage/prompts-taches/sprint-XX/task-X.Y.Z-{kebab}.md` pour la tache specifique
3. Verifier que la tache precedente est commitee (eviter dependances casses)
4. Pull latest main avant creation branche

### Branche feature

```bash
git checkout main
git pull --rebase
git checkout -b feature/sprint-NN-task-X.Y.Z-kebab-case
```

### Implementation

1. Suivre fideement le prompt-tache (code patterns, tests, validations)
2. Respecter TOUTES les conventions (multi-tenant, Zod, Pino, argon2id, etc.)
3. Lancer pnpm typecheck + pnpm lint + pnpm test en local
4. Verifier criteres validation V1-VN du prompt-tache

### Commit

```bash
git add -A
git commit -m "feat(sprint-NN): description courte

Body avec contexte si necessaire.

Livrables:
- Livrable 1
- Livrable 2

Tests: X unit + Y integration + Z E2E
Coverage: NN%

Task: X.Y.Z
Sprint: NN (Phase X / Sprint Y)
Phase: X -- Phase Name
Reference: B-NN Tache X.Y.Z"
```

Husky pre-commit verifie :
- TypeScript typecheck
- Biome lint + format
- check-no-emoji.sh
- Tests Vitest sur fichiers modifies

commitlint verifie :
- Format Conventional Commits
- Subject 50-72 chars
- Body present si tache > 50 lignes diff

### Pull Request

- Template `.github/PULL_REQUEST_TEMPLATE.md` rempli
- CI verts (5 jobs : Lint, Typecheck, Test, Build, Security)
- 1 reviewer minimum (2 pour modules critiques : auth, database, signature, pay)
- Squash merge avec commit message conforme

## Troubleshooting commun pour IA

### "Where is X defined?"

1. Search code : `grep -rn "X" repo/ --include="*.ts"`
2. Check packages : `ls packages/`
3. Check apps : `ls apps/`
4. Reference docs : `00-pilotage/meta-prompts/`, `00-pilotage/prompts-taches/`, `00-pilotage/decisions/`

### "Why this convention?"

Reference :
- `decisions/` pour decisions strategiques (decision-001 a decision-024)
- `docs/architecture/ADR-XXX-*.md` pour architecture decisions records

### "Add new feature: tax calculation"

1. Identify package : `@insurtech/books` (CGNC, factures DGI)
2. Read meta-prompt sprint correspondant
3. Generate prompt-tache (si pas deja fait)
4. Implement following patterns existants
5. Add tests Vitest
6. Update CHANGELOG.md (Sprint 35 auto)
7. Commit avec format conventionnel

### "Database migration error"

1. Check current migrations : `ls packages/database/src/migrations/`
2. Verify TypeORM datasource config
3. Reset dev DB : `pnpm --filter @insurtech/database reset`
4. Re-run migration : `pnpm --filter @insurtech/database migration:run`

### "Tests failing locally"

1. Verify Docker stack up : `docker compose ps`
2. Verify env vars : `cp .env.example .env`
3. Verify migrations applied
4. Run specific test : `pnpm vitest run path/to/test.spec.ts`
5. Debug mode : `pnpm vitest --inspect-brk path/to/test.spec.ts`

### "Build errors"

1. Clear caches : `pnpm clean && rm -rf node_modules .turbo`
2. Reinstall : `pnpm install --frozen-lockfile`
3. Typecheck : `pnpm typecheck`
4. Build : `pnpm build`

## Files importants

- `package.json` : root scripts, engines (Node 22.11.0)
- `pnpm-workspace.yaml` : workspaces declaration (9 apps + 23 packages)
- `turbo.json` : Turborepo pipeline (build, test, lint, typecheck, dev)
- `tsconfig.base.json` : TypeScript strict (16 flags)
- `biome.json` : lint + format rules
- `docker-compose.yaml` : 7 services dev stack
- `.env.example` : template env vars (56 vars)
- `.github/workflows/ci.yml` : 5 jobs CI
- `husky/.husky/pre-commit` : pre-commit hooks
- `commitlint.config.ts` : Conventional Commits rules

## Skalean AI integration (Sprint 29+)

L'agent IA Skalean AI est integre via :
1. `@insurtech/sky` package : REST client vers Skalean AI service externe
2. `@insurtech/sky-ui` package : chat widget reutilise par 3 apps (web-broker, web-garage, web-assure-portal)
3. `apps/mcp-server` : MCP tools metier exposes a Skalean AI

Frontiere stricte (decision-005) :
- Skalean AI consomme tools Skalean InsurTech via MCP
- Skalean InsurTech NE consomme PAS Skalean AI directement (sauf via @insurtech/sky)
- Mock pendant Sprint 1-28 (sky-mock package), swap real Sprint 29

## Localisation 4 langues

next-intl : ar (arabe), fr (francais), en (anglais), ber (berbere)
- Fichiers : `apps/web-*/src/i18n/messages/{locale}.json`
- ICU MessageFormat pour pluralization
- RTL support (ar) via `dir="rtl"` automatique

## Conformite Maroc references

Lois MA pertinentes :
- Loi 09-08 (CNDP) : protection donnees personnelles
- Loi 43-20 : signature electronique avec Barid eSign + ANRT TSA
- Loi 53-05 : echange electronique de donnees juridiques
- Loi 17-99 : code des assurances (ACAPS regulator)
- Loi 47-18 : cyber-defense
- Loi 04-20 : anti-blanchiment et financement terrorisme
- Loi 11-03 : protection consommateur
- Norme CGNC : comptabilite generale du Maroc
- DGI : factures conformes (ICE, IF, RC, CNSS)

## Contacts equipe

- Tech Lead : tech@skalean.ma
- Slack : #insurtech-tech
- Architecture : architecture@skalean.ma
- Security : security@skalean.ma
```

### 18.3 CONTRIBUTING.md complet exhaustif (template integral)

```markdown
# Contributing to Skalean InsurTech

Merci de contribuer au programme Skalean InsurTech v2.2. Ce document detaille le workflow contributeur, les conventions a respecter, et le processus de review.

## Avant de commencer

1. Lire [README.md](README.md) pour vue d'ensemble du projet
2. Lire [CLAUDE.md](CLAUDE.md) pour les conventions techniques
3. Lire [docs/architecture/](docs/architecture/) pour comprendre l'architecture
4. Setup local : suivre Quick Start dans README

## Workflow contributeur

### 1. Pull latest main

```bash
git checkout main
git pull --rebase
```

### 2. Identifier la tache

Le programme est decoupe en 35 sprints, chaque sprint en taches X.Y.Z documentees dans `00-pilotage/prompts-taches/sprint-XX/task-X.Y.Z-*.md`.

Pour identifier votre tache :
- Reunion sprint planning hebdo
- Suivi avance dans Linear/Jira (Sprint 35+)
- Checklist `00-pilotage/CHECKLIST-AVANCEE.md`

### 3. Creer branche feature

Naming : `feature/sprint-NN-task-X.Y.Z-kebab-case`

Exemples :
- `feature/sprint-01-task-1.1.5-redis-config`
- `feature/sprint-06-task-6.2.3-rls-policies`
- `feature/sprint-12-task-12.1.1-payment-cmi`

```bash
git checkout -b feature/sprint-01-task-1.1.5-redis-config
```

### 4. Implementer

Suivre le prompt-tache fideement :
- Code patterns fournis (8-15 fichiers complets)
- Tests requis (>= 20 cas)
- Criteres validation V1-VN
- Conventions strictes (multi-tenant, Zod, Pino, argon2id, etc.)

### 5. Tests local

```bash
# Typecheck
pnpm typecheck

# Lint
pnpm lint

# Tests
pnpm test

# Coverage
pnpm test:coverage

# Build
pnpm build

# E2E (si applicable)
pnpm e2e
```

### 6. Commit

Format Conventional Commits :

```bash
git add -A
git commit -m "<type>(scope): description courte

Body avec contexte (optionnel mais recommande).

Livrables:
- Livrable 1
- Livrable 2

Tests: X unit + Y integration + Z E2E
Coverage: NN%

Task: X.Y.Z
Sprint: NN (Phase X / Sprint Y)
Phase: X -- Phase Name
Reference: B-NN Tache X.Y.Z"
```

Types autorises :
- feat : nouvelle fonctionnalite
- fix : bug fix
- docs : documentation
- style : formatting (no code change)
- refactor : refactor sans nouvelle fonctionnalite ou bug fix
- test : ajout/modification tests
- chore : maintenance (deps, config, etc.)
- perf : amelioration performance
- ci : modification CI/CD
- build : modification build system

Scopes :
- `sprint-NN` : tache d'un sprint specifique
- `auth`, `database`, `pay`, etc. : modification d'un package specifique
- `api`, `web-broker`, etc. : modification d'une app specifique

Husky pre-commit verifie automatiquement :
- TypeScript typecheck
- Biome lint + format
- check-no-emoji.sh (decision-006)
- Tests Vitest sur fichiers modifies

commitlint verifie automatiquement :
- Format Conventional Commits
- Subject 50-72 chars
- Body present si tache > 50 lignes diff

Si pre-commit echoue : corriger les erreurs et re-commit. Ne pas utiliser `--no-verify` (interdit).

### 7. Push et Pull Request

```bash
git push -u origin feature/sprint-01-task-1.1.5-redis-config
```

Aller sur GitHub et creer une Pull Request :
- Title : meme format que commit message subject
- Body : remplir le template `.github/PULL_REQUEST_TEMPLATE.md`
- Reviewers : 1 minimum, 2 pour modules critiques (auth, database, signature, pay)
- Labels : `sprint-NN`, `phase-X`, type (feat/fix/docs/...)

### 8. CI verts

5 jobs CI doivent etre verts :
1. Lint (Biome)
2. Typecheck (TypeScript)
3. Test (Vitest unit + integration)
4. Build (Turborepo)
5. Security (npm audit + CodeQL)

Si CI echoue : corriger en local et push.

### 9. Code review

Reviewer verifie :
- Code suit les patterns du prompt-tache
- Conventions respectees (multi-tenant, Zod, Pino, etc.)
- Tests couvrent les cas listes (>= 20 cas)
- Criteres validation V1-VN tous valides
- Documentation a jour si applicable
- Pas de regression sur autres parties du code
- Pas d'emoji dans le code

Reviewer commente directement sur GitHub. Auteur applique corrections et push.

### 10. Merge

Apres approbations + CI verts :
- Squash and merge avec commit message conforme
- Branche feature supprimee automatiquement
- Github Actions deploie en staging si applicable

## Conventions a respecter

Voir [CLAUDE.md](CLAUDE.md) section "Conventions techniques absolues" pour la liste complete.

Resume :
- Multi-tenant strict (header x-tenant-id)
- Validation Zod (jamais class-validator)
- Logger Pino (jamais console.log)
- Hash argon2id (jamais bcrypt)
- pnpm strict (jamais npm/yarn)
- TypeScript strict (16 flags)
- Tests Vitest + Playwright
- RBAC 12 roles
- Events Kafka format `insurtech.events.{vertical}.{entity}.{action}`
- Imports `@insurtech/*` (jamais `../../packages/*`)
- Skalean AI frontiere stricte
- AUCUNE EMOJI (decision-006 ABSOLU)
- Idempotency-Key sur mutations sensibles
- Conventional Commits strict
- Cloud souverain MA Atlas Benguerir

## Quality gates

Coverage cible :
- Global : >= 85%
- Modules critiques (auth, database, signature, pay) : >= 90%

Performance cible :
- Build incremental (Turborepo cache hit) : < 30s
- Tests unitaires : < 60s
- E2E : < 10min
- Install dependencies : < 90s

Lint cible :
- 0 erreur
- 0 warning (sauf exceptions documentees)

## Bypass policy (rare)

Si bypass de pre-commit necessaire :
1. Justifier dans commit message body
2. Tag commit `[BYPASS]`
3. Notification immediate au tech lead

Cas autorises :
- Hotfix critique production (avec PR follow-up dans 24h)
- Migration bloquee par dependance externe (avec ticket Linear)

Cas interdits :
- "Je suis presse"
- "Le hook prend trop de temps"
- "Je vais corriger plus tard"

## Troubleshooting

### Pre-commit hook echoue

```bash
# Voir le hook qui echoue
pnpm typecheck
pnpm lint
.husky/pre-commit

# Si emoji detectee
infrastructure/scripts/check-no-emoji.sh

# Si lint format
pnpm biome check --apply .
```

### Commitlint echoue

```bash
# Tester format
echo "feat(sprint-01): description" | npx commitlint

# Re-write commit
git commit --amend
```

### Branche divergente avec main

```bash
git fetch origin
git rebase origin/main
# Resoudre conflits si necessaire
git push --force-with-lease
```

### Tests integration echouent en local

```bash
# Verifier Docker stack
docker compose ps

# Restart services
docker compose down -v
docker compose up -d
sleep 5

# Re-run migrations
pnpm --filter @insurtech/database migration:run
pnpm --filter @insurtech/database seed
```

## Support

- Slack : #insurtech-tech
- Email tech lead : tech@skalean.ma
- Documentation interne : https://wiki.skalean.ma/insurtech (Sprint 35)

## Code of conduct

- Respect mutuel
- Communication constructive
- Pas de critique personnelle
- Focus sur le code, pas sur l'auteur
- Aide aux nouveaux contributeurs
- Documentation a jour
- Tests obligatoires
- Pas d'emoji (decision-006)
```

### 18.4 ADR-001 Monorepo pnpm + Turborepo (template integral)

```markdown
# ADR-001 : Monorepo pnpm + Turborepo

Date : 2026-01-15
Statut : Accepted (decision-001)
Auteurs : Tech Lead, Architecture Team

## Contexte

Le programme Skalean InsurTech v2.2 regroupe 9 applications metier (8 web + 1 MCP server) qui partagent largement du code (packages auth, database, crm, etc.) et 23 packages partages (16 metier + 7 shared). La question de l'organisation du code se pose : multi-repo, monorepo, hybride ?

Contraintes :
- Equipe 8-12 developpeurs sur 18 mois
- 35 sprints de developpement, refactoring inevitable
- Code partage majeur entre apps (jusqu'a 70% pour certains)
- Necessite tests integration cross-package
- Necessite versioning coherent
- Conformite et tracabilite forte (regulateur ACAPS)

## Decision

**Adopter un monorepo avec pnpm 9.15 + Turborepo 2.4.**

Structure :
```
repo/
  apps/             (9 apps deployables)
  packages/         (23 packages partages)
  infrastructure/   (Docker, Terraform, scripts)
  docs/             (architecture, ADR, system overview)
  00-pilotage/      (meta-prompts, prompts-taches, decisions)
  package.json      (root scripts, engines)
  pnpm-workspace.yaml
  turbo.json
```

## Alternatives considerees

### Alternative 1 : Multi-repo (1 repo par app + 1 repo par package partage)

Avantages :
- Permissions fines par repo
- Builds independents
- Versioning explicite via npm publish

Inconvenients :
- 32 repos a maintenir (9 apps + 23 packages)
- Refactoring cross-package = N PRs (cauchemar)
- Tests integration impossibles (cross-repo)
- Synchronisation versions manuelle (drift garanti)
- Tooling repete (CI, lint, format) par repo

Decision : REJETE (overhead massif pour equipe 8-12)

### Alternative 2 : Monorepo Lerna + Yarn workspaces

Avantages :
- Mature
- Communaute large

Inconvenients :
- Lerna en maintenance mode (deprecie 2022, repris par Nrwl 2023)
- Yarn workspaces moins performant que pnpm sur grosses installs
- Hoisting peut creer phantom dependencies
- Pas de cache local efficace

Decision : REJETE (Lerna obsolete)

### Alternative 3 : Monorepo Nx

Avantages :
- Tooling integre tres puissant
- Generators / executors
- Cache distribue
- Affected commands

Inconvenients :
- Lock-in fort (architecture Nx specifique)
- Courbe apprentissage haute
- Configurations verboses
- Surcout pour equipe 8-12

Decision : REJETE (overkill)

### Alternative 4 : Monorepo pnpm + Turborepo (RETENU)

Avantages :
- pnpm 3-5x plus rapide que npm/yarn (symlinks)
- Strict node_modules (pas de phantom dependencies)
- Workspaces natives
- Turborepo : cache local + remote (Sprint 35)
- Parallel execution avec dependencies graph
- Pipeline definitions declaratives
- Adopte par Vercel, Netlify, Microsoft

Inconvenients :
- pnpm strict mode peut surprendre (manque de hoisting)
- Turborepo Remote Cache est SaaS (Vercel) -> alternative auto-hosted

Decision : RETENU (excellent rapport puissance/simplicite)

## Trade-offs explicites

- Adoption pnpm strict : peut casser deps qui dependent de phantom deps. Solution : pnpm hoist-pattern config.
- Turborepo Remote Cache : SaaS Vercel, OK pour equipe car gratuit jusqu'a 50 GB. Alternative : turborepo-remote-cache self-hosted en cas de migration.
- Monorepo geant : risque de slowdown CI. Solution : turbo affected commands + sharding tests.

## Consequences

Positives :
- Refactoring cross-package facile (PR unique)
- Tests integration possibles (memes versions deps)
- Tooling unifie (1 lint config, 1 format config, 1 typecheck config)
- Versioning coherent (pas de drift)
- Onboarding nouveaux devs simplifie

Negatives :
- Repository large (~500K lignes de code estime fin programme)
- CI builds peuvent etre lents si pas de cache (mitige par Turbo cache)
- Permissions GitHub uniformes (pas de fine-grained par dossier sans CODEOWNERS)

## Implementation

Sprint 1 - Tache 1.1.1 : Init monorepo pnpm + Turborepo

Fichiers cles :
- `package.json` : root scripts (dev, build, lint, typecheck, test)
- `pnpm-workspace.yaml` : declaration workspaces
- `turbo.json` : pipeline (build, dev, lint, typecheck, test, e2e, clean)
- `.npmrc` : engine-strict, save-exact, link-workspace-packages

## References

- pnpm docs : https://pnpm.io/
- Turborepo docs : https://turbo.build/repo/docs
- Vercel monorepo guide : https://vercel.com/blog/turborepo-1-0
```

### 18.5 ADR-002 Multi-tenant 3 niveaux (template integral)

```markdown
# ADR-002 : Multi-tenant 3 niveaux

Date : 2026-01-15
Statut : Accepted (decision-002)
Auteurs : Architecture Team, Security Team

## Contexte

Skalean InsurTech sert 3 types d'utilisateurs distincts :
- Skalean (provider) : SuperAdmin, vue globale
- Customer Tenants : courtiers et garages (clients SaaS B2B)
- Assures : utilisateurs finaux du courtier ou garage (B2C porte par B2B)

Chaque niveau a des besoins isolation differents :
- Niveau 1 : voit tous les tenants (mais audit trail)
- Niveau 2 : ne voit QUE son tenant (isolation forte)
- Niveau 3 : ne voit QUE ses propres donnees (RBAC fin)

Volumes attendus fin programme :
- 50-100 customer tenants
- 10K-50K assures
- 1M-10M lignes Postgres tenant-scoped

Conformite :
- Loi 09-08 CNDP : isolation forte des donnees personnelles
- ACAPS : audit trail accessible
- ISO 27001 : segregation logique des donnees

## Decision

**Adopter un modele multi-tenant 3 niveaux avec :**
1. Une seule base Postgres (shared database)
2. Schemas table avec colonne `tenant_id UUID NOT NULL`
3. RLS Postgres (Row-Level Security) policies activees
4. Filtrage automatique via `app_current_tenant()` Postgres function
5. Header HTTP `x-tenant-id` obligatoire (sauf endpoints public/admin)
6. NestJS TenantGuard global active
7. AsyncLocalStorage Node.js pour TenantContext (jamais en parametre fonction)

## Alternatives considerees

### Alternative 1 : Database-per-tenant

Avantages :
- Isolation maximale (DBs separees)
- Pas de risque cross-tenant leak
- Migration tenant-specific possible

Inconvenients :
- 100 DBs a gerer fin programme = ops nightmare
- Backup/restore complexe
- Cross-tenant queries impossibles (admin)
- Cout infrastructure x100
- Connection pooling complique

Decision : REJETE (operationally untenable)

### Alternative 2 : Schema-per-tenant (Postgres schemas)

Avantages :
- Isolation logique forte
- Migrations tenant-scopable
- Backup tenant-specific

Inconvenients :
- 100 schemas avec memes tables = duplication
- Cross-tenant queries via UNION ALL = lent
- Migrations a repercuter sur N schemas
- Tooling ORM moins mature

Decision : REJETE (overhead operationnel)

### Alternative 3 : Shared schema + tenant_id (RETENU)

Avantages :
- 1 seule DB, 1 seul schema
- Cross-tenant queries faciles (admin SuperAdmin)
- Migrations simples
- Tooling ORM mature
- Performance avec index sur tenant_id

Inconvenients :
- Risque oubli filtrage tenant_id (mitigated par RLS + TenantGuard)
- Index sur tenant_id obligatoire (mitigated par convention)
- Risque cross-tenant leak (mitigated par RLS strict + tests 50+ scenarios)

Decision : RETENU

## Implementation

### Postgres RLS

Chaque table tenant-scoped a :
- Colonne `tenant_id UUID NOT NULL`
- Index `(tenant_id, ...)` pour performance
- RLS enabled : `ALTER TABLE x ENABLE ROW LEVEL SECURITY;`
- Policy : `CREATE POLICY tenant_isolation ON x USING (tenant_id = app_current_tenant());`

Function `app_current_tenant()` lit la session var `app.current_tenant`.

### NestJS

TenantGuard middleware global :
1. Lit header `x-tenant-id`
2. Valide UUID format
3. Verifie tenant existe et user a acces
4. Set session var Postgres `SET LOCAL app.current_tenant = '<uuid>'`
5. Inject TenantContext dans AsyncLocalStorage

Toutes queries TypeORM heritent automatiquement du filtre RLS.

### Frontend

Apps web ajoutent header `x-tenant-id` automatiquement via Axios interceptor :
- Lecture cookie `tenant_id` (set apres login)
- Header HTTP sur chaque requete
- Si 403 tenant invalide : redirect login

## Trade-offs explicites

- Performance : index sur tenant_id obligatoire (vs database-per-tenant pas besoin). Mitigated par convention + lint rule.
- Risque cross-tenant : si oubli RLS sur nouvelle table = leak. Mitigated par tests 50+ scenarios Sprint 6 + CI lint check.
- Cross-tenant operations (admin) : autorisees pour SuperAdmin avec audit trail obligatoire.

## Tests obligatoires Sprint 6

50+ scenarios isolation RLS :
- User A tenant X ne peut pas lire data tenant Y (SELECT)
- User A tenant X ne peut pas modifier data tenant Y (UPDATE)
- User A tenant X ne peut pas supprimer data tenant Y (DELETE)
- User A tenant X ne peut pas creer data avec tenant_id = Y (INSERT)
- SuperAdmin peut lire data tenant X et Y avec audit trail
- ...

## References

- Multi-tenant architecture (Saas) : https://docs.aws.amazon.com/wellarchitected/latest/saas-lens/multi-tenancy.html
- Postgres RLS : https://www.postgresql.org/docs/16/ddl-rowsecurity.html
- decision-002 : 00-pilotage/decisions/002-multi-tenant-3-niveaux.md
```

### 18.6 ADR-003 TypeORM 0.3 vs Prisma (template integral)

```markdown
# ADR-003 : TypeORM 0.3 vs Prisma

Date : 2026-01-15
Statut : Accepted (decision-003)
Auteurs : Backend Team, Architecture Team

## Contexte

Le programme necessite un ORM TypeScript pour Postgres 16.6 avec :
- Support RLS (Row-Level Security) Postgres
- Migrations versionnees
- Repository pattern compatible NestJS
- Connection pooling
- Transactions
- Multi-tenant friendly
- Performance pour 1M-10M lignes

## Decision

**Utiliser TypeORM 0.3.20 (et NON Prisma).**

## Alternatives considerees

### Alternative 1 : Prisma 5

Avantages :
- DX excellent (autocomplete genere)
- Migrations declaratives
- Schema unique (schema.prisma)
- Tooling moderne

Inconvenients :
- Pas de support natif RLS Postgres (issue 5128 ouverte depuis 2021)
- Pas de transactions interactives avec savepoints
- Genere queries pas optimisees (over-fetching frequent)
- Generated types lourds (build slower)
- Pas de Repository pattern natif (custom needed)

Decision : REJETE (RLS deal-breaker)

### Alternative 2 : TypeORM 0.3 (RETENU)

Avantages :
- Support natif RLS via QueryRunner SET LOCAL
- Repository pattern natif (compatible NestJS)
- Transactions interactives avec savepoints
- DataMapper et ActiveRecord
- Migrations versionnees
- Subscribers / lifecycle hooks
- Multi-tenant friendly avec connection per request

Inconvenients :
- DX inferieur a Prisma
- Decorators experimental (TS reflect-metadata)
- Documentation parfois desuete
- Quelques bugs connus (mitigated par version 0.3.20+)

Decision : RETENU

### Alternative 3 : Drizzle ORM

Avantages :
- TypeScript-first
- Pas de runtime overhead
- Performance excellente

Inconvenients :
- Trop jeune (lib 2023)
- Communaute limitee
- Pas mature pour multi-tenant

Decision : REJETE (immaturity)

### Alternative 4 : Knex.js + Objection.js

Avantages :
- Mature
- Query builder puissant
- Models classes

Inconvenients :
- Pas vraiment ORM (more query builder)
- Repository pattern manuel
- TypeScript secondaire

Decision : REJETE (manque ORM features)

## Trade-offs explicites

- DX inferieur a Prisma : compense par templates code et conventions strictes.
- Decorators experimental : OK car NestJS depend de meme.
- Migration scripts manuels : OK car versionnage explicite preferred.

## Implementation

### Sprint 1 - Tache 1.1.9 : DataSource singleton

```typescript
import { DataSource } from 'typeorm';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT, 10),
  username: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  entities: [/* ... */],
  migrations: ['dist/migrations/*.js'],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false,
});
```

### Sprint 4 - Tache 4.X.Y : Repository tenant-aware

```typescript
import { Injectable } from '@nestjs/common';
import { Repository, EntityManager } from 'typeorm';
import { TenantContext } from '@insurtech/shared-utils';

@Injectable()
export class TenantAwareRepository<T> {
  constructor(
    private readonly manager: EntityManager,
    private readonly entity: new () => T,
  ) {}

  async findAll(): Promise<T[]> {
    const tenantId = TenantContext.getTenantId();
    return this.manager.transaction(async (txManager) => {
      await txManager.query(`SET LOCAL app.current_tenant = '${tenantId}'`);
      return txManager.find(this.entity);
    });
  }
}
```

## References

- TypeORM docs : https://typeorm.io/
- Prisma RLS issue : https://github.com/prisma/prisma/issues/5128
- decision-003 : 00-pilotage/decisions/003-typeorm-vs-prisma.md
```

### 18.7 ADR-004 Kafka vs RabbitMQ (template integral)

```markdown
# ADR-004 : Kafka vs RabbitMQ

Date : 2026-01-15
Statut : Accepted (decision-004)
Auteurs : Architecture Team, Backend Team

## Contexte

Le programme necessite un event bus pour :
- Communication async entre apps (api, mcp-server, web-*)
- Audit trail (events stocke X jours)
- Event sourcing partiel (pour signature, paiement)
- Streaming pour Skalean AI (Sprint 29+)
- Notifications WhatsApp + Email batch
- Webhooks compliance ACAPS

Volumes attendus fin programme :
- 1M-10M events/jour
- Burst 1K events/sec
- Retention 30 jours minimum

## Decision

**Utiliser Apache Kafka 3.7.1 en mode KRaft (sans Zookeeper).**

## Alternatives considerees

### Alternative 1 : RabbitMQ 3

Avantages :
- Mature
- Routing flexible (exchanges, queues, bindings)
- Faible latence (< 1ms)
- Management UI excellent

Inconvenients :
- Pas vraiment event sourcing (queues = consumed once)
- Replay events impossible nativement
- Storage limite (disque local)
- Throughput limite (10K msg/s typique)
- Pas de partitioning natif

Decision : REJETE (event sourcing limite)

### Alternative 2 : NATS JetStream

Avantages :
- Lightweight
- Performance excellente
- Streams + KV store

Inconvenients :
- Communaute plus petite que Kafka
- Tooling moins mature
- Pas autant d'integrations

Decision : REJETE (moins mature ecosysteme)

### Alternative 3 : AWS SNS + SQS

Avantages :
- Managed (no ops)
- Scalable

Inconvenients :
- Vendor lock-in AWS
- Cost a scale
- Pas conforme cloud souverain MA (decision-008)
- Pas event sourcing natif

Decision : REJETE (vendor lock-in + non-conforme MA)

### Alternative 4 : Apache Kafka 3.7 KRaft (RETENU)

Avantages :
- Event sourcing natif (logs persistant)
- Replay events (offset reset)
- Throughput massif (1M msg/s par broker)
- Partitioning natif
- Retention configurable (heures a infini)
- Communaute large
- Tooling mature (Kafka UI, Confluent Control Center)
- KRaft mode : pas de Zookeeper (simplification ops)

Inconvenients :
- Latence superieure a RabbitMQ (5-10ms typique)
- Plus complex que RabbitMQ
- Storage requirements important (disque + retention)

Decision : RETENU

## Trade-offs explicites

- Latence 5-10ms : OK car nos use cases ne sont pas latency-critical.
- Complexity : compensee par tooling (Kafka UI) + conventions strictes.
- Storage : prevu 100 GB par broker, 3 brokers = 300 GB total.

## Naming convention topics

Format : `insurtech.events.{vertical}.{entity}.{action}`

Exemples :
- `insurtech.events.platform.tenant.created`
- `insurtech.events.auth.user.logged_in`
- `insurtech.events.insure.policy.created`
- `insurtech.events.insure.claim.opened`
- `insurtech.events.repair.workorder.created`
- `insurtech.events.pay.payment.captured`
- `insurtech.events.signature.document.signed`
- `insurtech.events.compliance.audit.logged`

Total topics initial Sprint 1 : 32 topics catalogues (voir task-1.1.6).

## Schemas events

Chaque event a un schema Zod export depuis `@insurtech/shared-types/events/{vertical}/{entity}.ts` :

```typescript
import { z } from 'zod';

export const PolicyCreatedEventSchema = z.object({
  event_id: z.string().uuid(),
  event_type: z.literal('insurtech.events.insure.policy.created'),
  event_version: z.literal(1),
  occurred_at: z.string().datetime(),
  tenant_id: z.string().uuid(),
  user_id: z.string().uuid(),
  payload: z.object({
    policy_id: z.string().uuid(),
    insurer_id: z.string().uuid(),
    assure_id: z.string().uuid(),
    product_type: z.enum(['auto', 'home', 'health', 'life']),
    premium_mad: z.number().positive(),
    effective_date: z.string().date(),
  }),
});
```

## References

- Kafka docs : https://kafka.apache.org/documentation/
- KRaft mode : https://kafka.apache.org/documentation/#kraft
- decision-004 : 00-pilotage/decisions/004-kafka-vs-rabbitmq.md
```

### 18.8 ADR-005 Skalean AI Frontiere stricte (template integral)

```markdown
# ADR-005 : Skalean AI Frontiere stricte

Date : 2026-01-15
Statut : Accepted (decision-005)
Auteurs : AI Team, Architecture Team

## Contexte

Le programme prevoit l'integration de Skalean AI (agent IA proprietaire) a partir du Sprint 29 :
- Agent conversationnel pour courtiers et garages
- Tools metier exposes via MCP (Model Context Protocol)
- Acces RBAC fin (12 roles)
- Conformite donnees Maroc

Question architecturale : comment Skalean AI s'integre avec Skalean InsurTech ?

## Decision

**Adopter une frontiere stricte entre les 2 systemes :**

1. Skalean AI consomme tools Skalean InsurTech via MCP (lecture/ecriture autorisees)
2. Skalean InsurTech NE consomme PAS Skalean AI directement
3. Exception : `@insurtech/sky` package = REST client wrapper (single point of access)
4. Mock pendant Sprint 1-28, swap real Sprint 29

## Alternatives considerees

### Alternative 1 : Bidirectionnelle libre

Avantages :
- Flexibilite maximale
- Latence reduite

Inconvenients :
- Couplage fort
- Risque deadlock
- Difficile a tester
- Difficile a auditer (qui appelle qui ?)

Decision : REJETE (couplage)

### Alternative 2 : Frontiere stricte (RETENU)

Avantages :
- Couplage faible
- Audit trail clair (Skalean AI -> InsurTech via MCP)
- Testabilite (mock package sky-mock)
- Securite : InsurTech valide chaque call MCP via RBAC
- Evolution independante des 2 systemes

Inconvenients :
- Latence superieure (REST overhead)
- Code wrapper a maintenir (@insurtech/sky)

Decision : RETENU

## Implementation

### Package @insurtech/sky

Single point of access pour appeler Skalean AI :

```typescript
import axios from 'axios';

export class SkyClient {
  constructor(private readonly baseUrl: string, private readonly apiKey: string) {}

  async chat(input: ChatInput): Promise<ChatResponse> {
    const { data } = await axios.post(
      `${this.baseUrl}/api/v1/chat`,
      input,
      { headers: { 'Authorization': `Bearer ${this.apiKey}` } }
    );
    return data;
  }
}
```

### Package @insurtech/sky-mock (Sprint 1-28)

Mock complet pour tests :

```typescript
export class SkyMockClient implements ISkyClient {
  async chat(input: ChatInput): Promise<ChatResponse> {
    return {
      message: 'Mock response',
      tools_used: [],
      tokens: 100,
    };
  }
}
```

### MCP Server (apps/mcp-server)

Expose tools metier a Skalean AI :

```typescript
import { Server } from '@modelcontextprotocol/sdk/server';

const server = new Server({ name: 'insurtech-mcp', version: '1.0.0' });

server.tool('search_policies', {
  description: 'Search insurance policies for tenant',
  inputSchema: { /* Zod schema */ },
  handler: async (input) => {
    // RBAC check, RLS scope, return policies
  },
});
```

### Sprint 29 swap mock -> real

`@insurtech/sky-mock` -> `@insurtech/sky` (real REST client).

## Trade-offs explicites

- Latence superieure : OK car nos use cases ne sont pas latency-critical.
- Code wrapper : OK car single point of change si Skalean AI evolve.
- Mock Sprint 1-28 : OK car permet de developper InsurTech sans dependance Skalean AI.

## References

- Model Context Protocol : https://modelcontextprotocol.io/
- decision-005 : 00-pilotage/decisions/005-skalean-ai-frontiere-stricte.md
```

### 18.9 ADR-006 No-emoji policy (template integral)

```markdown
# ADR-006 : No-emoji policy

Date : 2026-01-15
Statut : Accepted (decision-006 ABSOLU)
Auteurs : Tech Lead, Compliance Team

## Contexte

Les emojis dans le code source posent plusieurs problemes :
- Encodage UTF-8 multi-byte peut casser tools moins matures
- Recherche grep complique
- Lisibilite reduite dans terminaux non-emoji-aware (CI logs)
- Rendering inconsistent (different fonts, OS, terminals)
- Ambiguous semantics (smile = success ? joy ? sarcasm ?)
- Outils legacy ACAPS / DGI ne supportent pas emojis dans rapports
- Conformite : audit trail doit etre lisible sans tools modernes

## Decision

**AUCUNE EMOJI dans le code, commentaires, logs, docs, commits, PR descriptions.**

Cette regle est ABSOLUE et ne souffre AUCUNE exception.

## Alternatives considerees

### Alternative 1 : Emojis libres

Avantages :
- Modern, friendly
- Quick visual scanning

Inconvenients :
- Tous ceux listes contexte

Decision : REJETE

### Alternative 2 : Emojis autorises uniquement docs

Avantages :
- Compromis

Inconvenients :
- Frontiere floue (un commentaire est-il du code ou du doc ?)
- Risque drift

Decision : REJETE (frontiere floue)

### Alternative 3 : ZERO emoji partout (RETENU)

Avantages :
- Regle simple, sans ambiguite
- Code propre et lisible partout
- Conformite outils legacy
- Audit trail lisible terminal
- Pre-commit hook simple

Inconvenients :
- Style moins moderne
- Onboarding nouveaux devs surprise

Decision : RETENU

## Implementation

### Pre-commit hook

`infrastructure/scripts/check-no-emoji.sh` :

```bash
#!/bin/bash
set -e

FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|tsx|js|jsx|md|json|yaml|yml|sh)$' || true)

if [ -z "$FILES" ]; then
  exit 0
fi

EMOJI_FOUND=$(echo "$FILES" | xargs grep -lP "[\x{1F300}-\x{1F9FF}]|[\x{2600}-\x{27BF}]|[\x{2300}-\x{23FF}]|[\x{1F000}-\x{1F02F}]|[\x{1F0A0}-\x{1F0FF}]|[\x{1F100}-\x{1F1FF}]|[\x{1F200}-\x{1F2FF}]" 2>/dev/null || true)

if [ -n "$EMOJI_FOUND" ]; then
  echo "ERROR: emoji detectee dans les fichiers suivants (decision-006 ABSOLU) :"
  echo "$EMOJI_FOUND"
  echo ""
  echo "Removed required avant commit."
  exit 1
fi

exit 0
```

### CI verification

`.github/workflows/ci.yml` job `lint-no-emoji` :

```yaml
lint-no-emoji:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - run: bash infrastructure/scripts/check-no-emoji.sh-all
```

### Bypass policy

AUCUNE exception. Cette regle est ABSOLUE.

Si un cas extreme apparait : escalader au tech lead pour evaluer modification ADR (pas bypass).

## Trade-offs explicites

- Style moins moderne : OK car professionnalisme prime.
- Onboarding nouveaux devs : documente dans CLAUDE.md + CONTRIBUTING.md.

## References

- decision-006 : 00-pilotage/decisions/006-no-emoji-policy.md
- Pre-commit hook : infrastructure/scripts/check-no-emoji.sh
```

### 18.10 docs/architecture/system-overview.md (diagram ASCII complet)

```markdown
# System Overview - Skalean InsurTech v2.2

Architecture globale du systeme (fin programme, Sprint 35).

## Diagramme haut niveau

```
                                        ATLAS CLOUD SERVICES BENGUERIR (MA)
                                        DC1 Tier III + DC2 Tier IV (DR)
                                        Loi 09-08 CNDP / Loi 47-18 Cyber-defense
                                        =========================================

                                                    [HTTPS / TLS 1.3]
                                                            |
                                                            v
                            +-------------------------------+-------------------------------+
                            |                                                               |
                            v                                                               v
                  [CLOUDFRONT / EDGE CDN]                                       [APP LOAD BALANCER]
                            |                                                               |
                            v                                                               v
            +-------+-------+-------+-------+                              +----------------+----------------+
            |       |       |       |       |                              |                                 |
            v       v       v       v       v                              v                                 v
        [WEB    [WEB    [WEB    [WEB    [WEB                          [API NESTJS              [MCP SERVER
        BROKER  GARAGE  ADMIN   CUSTOM  ASSURE                       UNIFIE 4000]              4001]
        3001]   3002+]  3000]   PORTAL  PORTAL                            |                       ^
                                3004]   3005+]                            |                       |
                                                                          v                       |
                                                                +---------+---------+             |
                                                                |                   |             |
                                                                v                   v             |
                                                      [POSTGRES 16.6]       [REDIS 7.4.1]        |
                                                      RLS 3 niveaux         6 DBs                 |
                                                      tenant_id RLS         (cache, sessions,     |
                                                      Atlas KMS             queues, locks,        |
                                                      AES-256-GCM           AI, ratelimit)        |
                                                                                                   |
                                                                +-------------------+              |
                                                                |                   |              |
                                                                v                   v              |
                                                       [KAFKA 3.7.1 KRaft]     [MINIO S3]          |
                                                       insurtech.events.*      docs, attachments   |
                                                       32 topics initiaux                          |
                                                                                                   |
                                                                +-------------------+              |
                                                                |                   |              |
                                                                v                   v              |
                                                       [CLICKHOUSE 24]       [N8N WORKFLOWS]       |
                                                       analytics              (Sprint 35+)         |
                                                       (Sprint 18+)                                |
                                                                                                   |
                                                                                                   v
                                                                                          [SKALEAN AI]
                                                                                          (externe)
                                                                                          consomme tools
                                                                                          via MCP


            INTEGRATIONS EXTERNES
            =====================
            - CMI (paiement carte bancaire MA)
            - YouCan (paiement)
            - PayZone (paiement)
            - Inwi (mobile money)
            - Orange Money
            - M-Wallet BAM (mobile money)
            - Barid eSign (signature electronique)
            - ANRT TSA (timestamp authority)
            - WhatsApp Business API
            - SendGrid (email)
            - Twilio (SMS fallback)
            - Mapbox (cartes)
            - ACAPS API (regulator reporting Sprint 22)
            - DGI portail (factures Sprint 19)
            - CNSS portail (paie Sprint 25)


            FRONTIERE STRICTE SKALEAN AI (decision-005)
            ============================================
            Skalean AI -> Skalean InsurTech : OUI (via MCP)
            Skalean InsurTech -> Skalean AI : NON (sauf via @insurtech/sky)
```

## Composants principaux

### Apps web (8)

- **web-broker** (port 3001) : SaaS B2B courtiers
- **web-garage** (port 3002) : SaaS B2B garages (desktop)
- **web-garage-mobile** (port 3003) : PWA technicien atelier
- **web-insurtech-admin** (port 3000) : Admin Skalean
- **web-customer-portal** (port 3004) : Prospects (SEO)
- **web-assure-portal** (port 3005) : Assures desktop
- **web-assure-mobile** (port 3006) : PWA assure mobile

### API NestJS (port 4000)

Architecture modulaire :
- AuthModule : authentification, RBAC, MFA
- TenantModule : multi-tenant 3 niveaux
- CrmModule : contacts, companies, deals
- BookingModule : rooms, appointments, calendar
- CommModule : WhatsApp, Email, 4 locales
- DocsModule : S3, PDF, access logs
- SignatureModule : Barid eSign, ANRT TSA
- PayModule : 6 passerelles MA
- BooksModule : CGNC, factures DGI
- ComplianceModule : ACAPS, AMC, CNDP
- AnalyticsModule : ClickHouse, dashboards
- InsureModule : vertical Broker
- RepairModule : vertical Garage
- StockModule : pieces FIFO
- HrModule : employees, paie CNSS/AMO

### MCP Server (port 4001)

Expose tools metier a Skalean AI :
- search_policies, create_policy
- search_claims, create_claim
- search_workorders, update_workorder_status
- get_invoice, list_invoices
- ... (50+ tools fin programme)

### Database Postgres 16.6

5 extensions activees :
- uuid-ossp (UUID generation)
- pgcrypto (encryption)
- pg_trgm (full-text search)
- pg_stat_statements (query monitoring)
- ltree (hierarchical data)

RLS multi-tenant 3 niveaux :
- Niveau 1 (Platform) : SuperAdmin
- Niveau 2 (Customer Tenant) : Brokers et Garages
- Niveau 3 (Assure) : Utilisateurs finaux

### Redis 7.4.1

6 DBs strategy :
- DB 0 : cache (TTL 5min-1h)
- DB 1 : sessions (TTL 24h)
- DB 2 : queues BullMQ (jobs async)
- DB 3 : locks distributed (Redlock)
- DB 4 : AI cache (Skalean AI responses)
- DB 5 : ratelimit (per tenant + global)

### Kafka 3.7.1 KRaft

3 brokers en production, partitioning par tenant_id pour isolation :
- 32 topics initiaux Sprint 1 (catalogue dans task-1.1.6)
- Schemas Zod pour chaque event
- Idempotency-Key pour events critiques
- Retention 30 jours (audit trail)

### MinIO (dev) / S3 Atlas Cloud Services (prod)

Buckets :
- documents : docs assures, contrats, factures
- avatars : photos profil
- attachments : pieces jointes claims
- exports : rapports generes

### ClickHouse 24 (Sprint 18+)

Analytics :
- Events Kafka -> ClickHouse via consumer
- Dashboards Sprint 22 (Grafana + custom)
- Reporting ACAPS Sprint 22
```


### 18.11 Strategie evolution documentation Sprint 2-35

Sprint 2 : ADRs additionnels
- ADR-007 : Stratégie cache Redis 6 DBs
- ADR-008 : Choix MinIO local + S3 Atlas Cloud Services prod

Sprint 5 : ADRs auth
- ADR-009 : MFA WebAuthn vs TOTP
- ADR-010 : Refresh token rotation strategy

Sprint 6 : ADRs RLS
- ADR-011 : Multi-tenant RLS performance trade-offs
- ADR-012 : Audit trail design (Kafka + Postgres)

Sprint 12 : ADRs payments
- ADR-013 : 6 passerelles MA selection criteria
- ADR-014 : Idempotency strategy webhook payments

Sprint 18 : ADRs analytics
- ADR-015 : ClickHouse vs TimescaleDB
- ADR-016 : Stream processing Kafka -> ClickHouse

Sprint 22 : ADRs compliance
- ADR-017 : ACAPS reporting strategy
- ADR-018 : Data retention 7 ans audit

Sprint 29 : ADRs Skalean AI
- ADR-019 : MCP tools authorization strategy
- ADR-020 : Token budget management Skalean AI

### 18.12 Convention naming ADR detaillee

Pattern : `ADR-NNN-{kebab-case-titre-court}.md`

Numerotation :
- 001-006 : Sprint 1
- 007-099 : Sprint 2-35
- 100+ : Post-launch (maintenance)

Statuts :
- Proposed : draft, in review
- Accepted : adopted, implemented
- Deprecated : remplaced par autre ADR
- Superseded : reference vers ADR successor

Template ADR :
```markdown
# ADR-NNN : Titre court

Date : YYYY-MM-DD
Statut : Proposed | Accepted | Deprecated | Superseded
Auteurs : Team

## Contexte
Pourquoi cette decision est necessaire ?

## Decision
Quelle decision est prise ?

## Alternatives considerees
Liste alternatives + pros/cons + raison rejet/adoption

## Trade-offs explicites
Ce que cette decision coute

## Consequences
Positives + negatives

## Implementation
Comment c'est implemente ? Sprint, taches

## References
Liens externes + decisions strategiques associees
```

### 18.13 Convention CLAUDE.md vs CONTRIBUTING.md

CLAUDE.md :
- Audience : IA assistantes (Claude, Cursor, Copilot)
- Contenu : conventions techniques, patterns code, architecture overview, troubleshooting
- Maintenance : tech lead, sync apres chaque sprint si conventions evoluent

CONTRIBUTING.md :
- Audience : developpeurs humains
- Contenu : workflow contributeur, processus PR, code review, troubleshooting humain
- Maintenance : tech lead, sync apres chaque retro sprint

Frontiere :
- Conventions techniques -> CLAUDE.md
- Workflow + process humain -> CONTRIBUTING.md
- Both : mention briefly, link to other for details

### 18.14 Strategie versionning docs

Documentation versionnee dans le code (git) :
- README.md, CLAUDE.md, CONTRIBUTING.md : sync avec code
- ADRs : append-only (pas de modification, seulement Deprecated/Superseded)
- system-overview.md : update apres changement architecture majeur

Pas de doc tooling externe Sprint 1-34 (pas de Confluence, pas de Notion, etc.).

Sprint 35 : optional integration Mintlify ou Docusaurus pour docs.insurtech.skalean.ma.

### 18.15 Commandes verification documentation

```bash
# Verifier ADRs presents
ls docs/architecture/ADR-*.md | wc -l
# Expected : 6 (Sprint 1) + N (sprints suivants)

# Verifier README.md complet
wc -l README.md
# Expected : >= 80 lignes

# Verifier CLAUDE.md complet
wc -l CLAUDE.md
# Expected : >= 150 lignes

# Verifier CONTRIBUTING.md complet
wc -l CONTRIBUTING.md
# Expected : >= 100 lignes

# Verifier LICENSE present
[ -f LICENSE ] && echo "OK" || echo "MISSING"

# Verifier no-emoji dans docs
grep -rP "[\x{1F300}-\x{1F9FF}]|[\x{2600}-\x{27BF}]" README.md CLAUDE.md CONTRIBUTING.md docs/ && echo "FAIL" || echo "OK"

# Verifier liens internes valides
grep -oE '\[.*?\]\(.*?\)' README.md | grep -oE '\([^)]+\)' | tr -d '()' | while read url; do
  if [[ "$url" == http* ]]; then
    continue
  fi
  if [ ! -f "$url" ]; then
    echo "BROKEN LINK: $url"
  fi
done

# Verifier ADR template respecte
for adr in docs/architecture/ADR-*.md; do
  for section in "## Contexte" "## Decision" "## Alternatives considerees" "## Implementation"; do
    if ! grep -q "$section" "$adr"; then
      echo "MISSING SECTION '$section' IN $adr"
    fi
  done
done
```

### 18.16 Edge cases documentation

#### Edge case 1 : Conflit terminologie ADR vs decision

Probleme : ADRs sont architecture decisions records, mais decisions/ folder contient decisions strategiques (decision-001 a decision-024).

Solution :
- ADRs (docs/architecture/) : decisions techniques implementees (architecture, tools)
- decisions/ (00-pilotage/decisions/) : decisions strategiques business + technique
- Cross-reference : ADR-001 reference decision-001, et inverse

#### Edge case 2 : Update ADR apres adoption

Probleme : ADR Accepted ne doit pas etre modifie. Mais que faire si decision change ?

Solution :
- Creer nouvel ADR (par exemple ADR-007) avec statut Accepted
- Marquer ancien ADR (ADR-001) avec statut Superseded by ADR-007
- Pas de modification du contenu de l'ancien ADR

#### Edge case 3 : Documentation IA assistantes vs humains

Probleme : convention divergente entre CLAUDE.md (IA) et CONTRIBUTING.md (humains) ?

Solution :
- Single source of truth : CLAUDE.md pour conventions techniques
- CONTRIBUTING.md reference CLAUDE.md pour conventions
- Pas de duplication (DRY)

#### Edge case 4 : Loi 09-08 mentions

Probleme : loi 09-08 doit etre mentionne dans plusieurs docs ?

Solution :
- Mention briefly dans README.md (section Conformite)
- Detail complet dans docs/legal/loi-09-08-cndp.md (Sprint 6+)
- Cross-reference depuis docs concernees

#### Edge case 5 : Mise a jour apres refactoring

Probleme : refactoring majeur change architecture, system-overview.md outdated

Solution :
- Update system-overview.md dans la PR refactoring
- Si change architecture decision : nouveau ADR avec Superseded sur ancien
- CI lint check : si docs/architecture/ pas modifie quand src/ majeur change, warning

### 18.17 Roadmap evolution

Sprint 1 :
- README.md (basics)
- CLAUDE.md (conventions)
- CONTRIBUTING.md (workflow)
- LICENSE
- 6 ADRs initial
- system-overview.md

Sprint 5 (apres auth) :
- ADR-009, ADR-010 (auth)
- docs/security/auth-overview.md

Sprint 6 (apres RLS) :
- ADR-011, ADR-012 (RLS)
- docs/security/rls-multi-tenant.md
- docs/security/audit-trail.md

Sprint 12 (apres payments) :
- ADR-013, ADR-014 (payments)
- docs/integrations/payment-gateways-ma.md

Sprint 18 (apres analytics) :
- ADR-015, ADR-016 (analytics)
- docs/data/clickhouse-schema.md

Sprint 22 (apres compliance) :
- ADR-017, ADR-018 (compliance)
- docs/legal/loi-09-08-cndp.md
- docs/legal/loi-43-20-signature.md
- docs/legal/loi-17-99-assurances.md
- docs/integrations/acaps-reporting.md

Sprint 29 (apres Skalean AI) :
- ADR-019, ADR-020 (Skalean AI)
- docs/ai/mcp-tools-catalog.md
- docs/ai/skalean-ai-integration.md

Sprint 33 :
- Audit complet documentation
- Update tous documents si gaps detectes

Sprint 35 :
- Documentation publique sur docs.insurtech.skalean.ma
- Mintlify ou Docusaurus
- Search engine + versioning
- Public ADRs (subset)

### 18.18 Maintenance documentation

Frequence :
- README.md : update apres chaque sprint si nouvelles capacites
- CLAUDE.md : update apres chaque sprint si conventions evoluent
- CONTRIBUTING.md : update apres chaque retro sprint
- ADRs : append-only, jamais modify (Superseded mecanisme)
- system-overview.md : update apres changement architecture majeur

Owner : Tech lead Sprint 1-7, puis Architecture Team Sprint 8+.

Process :
- PR documentation isolated (label `docs`)
- Review tech lead + 1 architecte
- Pas de CI block sur erreurs grammar (warning seulement)

### 18.19 Conformite documentation Maroc

Loi 09-08 CNDP :
- Mention dans README.md
- Detail complet dans docs/legal/loi-09-08-cndp.md (Sprint 6+)
- ADR-002 reference

Loi 43-20 signature :
- Mention dans README.md
- Detail complet dans docs/legal/loi-43-20-signature.md (Sprint 11+)

Loi 17-99 assurances :
- Mention dans README.md
- Detail complet dans docs/legal/loi-17-99-assurances.md (Sprint 22+)

ACAPS :
- README mention
- ADR-017 reference
- docs/integrations/acaps-reporting.md (Sprint 22+)

DGI :
- README mention
- docs/integrations/dgi-factures.md (Sprint 19+)

CNSS :
- README mention
- docs/integrations/cnss-paie.md (Sprint 25+)

### 18.20 Strategie multi-langue documentation

Sprint 1-34 :
- Documentation interne en francais uniquement
- Code/commentaires en anglais

Sprint 35 :
- Documentation publique :
  - docs.insurtech.skalean.ma : francais + anglais + arabe (3 langues)
  - Berbere : optional (si demand business)

### 18.21 Strategie searchability documentation

Sprint 1-34 :
- Search via grep + IDE
- Cross-references explicites entre fichiers

Sprint 35 :
- Mintlify search (full-text)
- Tags et categories

### 18.22 Strategie examples code dans docs

Sprint 1 :
- Examples brefs dans CLAUDE.md (sections critiques)
- Examples complets dans prompts-taches/ (auto-suffisants)

Sprint 35 :
- Examples runnable dans docs publique
- Stackblitz / CodeSandbox embed

### 18.23 Documentation traceabilite ACAPS

ACAPS reporting Sprint 22 :
- Audit trail Kafka events 30 jours retention
- Archive Postgres 7 ans (loi 17-99)
- Export ACAPS format CSV / XML
- Documents generes : docs/integrations/acaps-reporting.md
- Process compliance : Sprint 22+

### 18.24 Documentation contractuelle SaaS

Sprint 32 :
- CGV (Conditions Generales de Vente) : docs/legal/cgv.md
- CGU (Conditions Generales Utilisation) : docs/legal/cgu.md
- Politique confidentialite : docs/legal/privacy.md
- DPA (Data Processing Agreement) : docs/legal/dpa.md (loi 09-08)

### 18.25 Formats documentation strategique

Sprint 1-7 :
- Markdown uniquement
- Hosted dans repo

Sprint 8-22 :
- Markdown + diagrammes ASCII / Mermaid
- Encore dans repo

Sprint 22-35 :
- Markdown + diagrammes Mermaid + Excalidraw
- Hosted dans repo + future docs.insurtech.skalean.ma

### 18.26 Index complet documentation cible Sprint 35

```
docs/
  architecture/
    README.md (ADR index)
    system-overview.md
    ADR-001-monorepo.md
    ...
    ADR-020-skalean-ai-token-budget.md
  legal/
    loi-09-08-cndp.md
    loi-43-20-signature.md
    loi-17-99-assurances.md
    cgv.md
    cgu.md
    privacy.md
    dpa.md
  security/
    auth-overview.md
    rls-multi-tenant.md
    audit-trail.md
    threat-model.md
  integrations/
    payment-gateways-ma.md
    barid-esign.md
    anrt-tsa.md
    whatsapp-business-api.md
    acaps-reporting.md
    dgi-factures.md
    cnss-paie.md
    skalean-ai-mcp.md
  data/
    clickhouse-schema.md
    postgres-schema.md
    kafka-topics-catalog.md
    redis-keyspace.md
  api/
    swagger.yaml (auto-generated)
    rest-api-overview.md
  ai/
    mcp-tools-catalog.md
    skalean-ai-integration.md
    sky-package-usage.md
  operations/
    deployment-guide.md
    rollback-strategy.md
    monitoring-grafana.md
    incidents-playbook.md
    backup-restore.md
  user-guides/
    broker-quickstart.md
    garage-quickstart.md
    assure-mobile-guide.md
```

Total documentation : ~50 fichiers fin programme.

### 18.27 Conventions strictes documentation final

- Markdown CommonMark strict
- Headings hierarchy : H1 (titre), H2 (sections), H3 (sous-sections), H4+ rare
- Lists : bullets simples ou numbered
- Code blocks : language tag (typescript, bash, sql, yaml, json)
- Tables : alignment specified si pertinent
- Links : descriptive text (pas "click here")
- AUCUNE EMOJI (decision-006 ABSOLU)
- Cross-references : fichiers (relative paths)
- TOC : optional, pour fichiers > 200 lignes

### 18.28 Conformite GDPR + Loi 09-08 documentation

Documentation des traitements donnees personnelles :
- DPA (Data Processing Agreement) : docs/legal/dpa.md
- Privacy Policy : docs/legal/privacy.md
- Cookie Policy : docs/legal/cookies.md (Sprint 33)
- Data Retention : docs/legal/retention-policy.md (Sprint 22)

Process internal :
- DPIA (Data Protection Impact Assessment) : Sprint 33
- Notification CNDP : Sprint 33 (avant launch)

### 18.29 Strategie review documentation

Pre-launch (Sprint 33) :
- Review tech lead
- Review architecture team
- Review compliance team
- Review legal team

Public release (Sprint 35) :
- Review marketing
- Review product
- User testing 5 personas
- Iteration apres feedback

### 18.30 Final ABSOLU 100ko Tache 1.1.15

Foundation documentation complete pour 35 sprints.
12 fichiers documentation crees Sprint 1.
6 ADRs initiaux (extensible 100+).
Structure prevoit 50+ fichiers fin programme.
Conformite Maroc native (lois mentionnees).
AUCUNE EMOJI (decision-006).
Cross-references explicites.
Templates pour ADRs futurs.

