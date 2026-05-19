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
Footer recommande pour taches :
```
Task: X.Y.Z
Reference: B-XX Tache X.Y.Z
```

### 1.5 Logger Pino strict
- Utiliser `logger.info({...}, '...')` (jamais `console.log`)
- Inclure tenant_id, user_id, request_id, action dans les objets de log
- PII redaction via Pino `redact.paths` (passwords, tokens, CIN, phone, email)

### 1.6 Imports strict
- `@insurtech/{nom}` pour packages workspace (jamais `../../packages/...`)
- Import order : Node natifs > externes > `@insurtech/*` > relatifs
- `import type { X }` pour types-only (verbatimModuleSyntax)

### 1.7 Skalean AI Frontier (decision-005)
- Utiliser UNIQUEMENT via `@insurtech/sky` (REST) ou `apps/mcp-server` (MCP)
- JAMAIS appel direct OpenAI/Anthropic depuis InsurTech
- Mock pendant Sprint 1-28 (decision-007), swap real Sprint 29

### 1.8 Secrets + securite
- Jamais de secret en dur dans le code
- Utiliser `loadEnv()` de `@insurtech/shared-config` pour lire vars env
- Passwords : argon2id uniquement (Sprint 5)
- Tokens JWT : jose uniquement (Sprint 5)

## 2. Structure projet

```
repo/
+-- apps/           (9 apps : api port 4000, web-* ports 3000-3006, mcp-server port 4001)
+-- packages/       (23 packages : auth, database, crm, ..., shared-*)
+-- infrastructure/ (docker, scripts, terraform)
+-- docs/           (architecture ADRs, api, runbooks, security)
+-- .github/        (workflows CI/CD, CODEOWNERS, PR template)
+-- .husky/         (Git hooks : pre-commit, commit-msg, pre-push)
```

Cowork lit meta-prompts dans `00-pilotage/meta-prompts/`, genere prompts taches dans `00-pilotage/prompts-taches/`, modifie code dans `repo/`. JAMAIS modifier `00-pilotage/` directement.

## 3. Avant chaque PR

```bash
pnpm typecheck       # 0 erreur
pnpm lint            # 0 erreur Biome
pnpm test            # tous tests passants
pnpm check-no-emoji  # 0 emoji
```

PR description doit inclure :
- Sprint NN / Task X.Y.Z / Reference B-XX
- Type de changement (feat/fix/docs/etc.)
- Scope (sprint-NN / package-name / app-name)
- Multi-tenant respecte (RLS active si applicable)
- Tests ajoutes/mis a jour (coverage >= 85%)

## 4. Architecture decisions

Voir `docs/architecture/ADR-*.md` :
- ADR-001 : Monorepo pnpm + Turborepo
- ADR-002 : Multi-tenant 3 niveaux (Platform / Customer Tenant / Assure)
- ADR-003 : TypeORM 0.3 vs Prisma (TypeORM retenu pour RLS support)
- ADR-004 : Kafka KRaft vs RabbitMQ (Kafka retenu)
- ADR-005 : Skalean AI Frontier (decouplage strict)
- ADR-006 : No-emoji policy ABSOLU

## 5. Workflow Cowork

Cowork (Claude Anthropic) genere prompts taches DENSES (80-150 ko chacun) dans `00-pilotage/prompts-taches/sprint-NN-{slug}/` depuis meta-prompts B-XX.

Claude Code (ou autre IA implementation) lit prompts taches et modifie `repo/`.

Chaque session IA respecte les 14 conventions skalean-insurtech :
1. Multi-tenant (tenant_id + RLS)
2. Zod pour validation inputs
3. Pino pour logs (jamais console.log)
4. argon2id pour passwords
5. pnpm strict (jamais npm/yarn)
6. TypeScript strict (jamais any)
7. RBAC fine-grained
8. Events Kafka pour side effects
9. Imports `@insurtech/*` workspace
10. Skalean AI Frontier via sky/mcp uniquement
11. No-emoji ABSOLU (decision-006)
12. Idempotency operations critiques
13. Conventional Commits format
14. Data residency Maroc (Atlas Cloud Benguerir)
