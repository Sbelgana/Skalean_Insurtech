# CLAUDE.md -- Assurflow v3.0 IA Guide (anciennement Skalean InsurTech v2.2)

Ce fichier est lu par Cowork, Claude Code, et toute IA assistante avant chaque session de travail sur ce projet. Respecter ces conventions ABSOLUMENT.

## v3.0 Foundation (Sprint 7.5a Foundation Migration -- 2026-05-24)

**Rebranding** (decision-011) : Skalean = editeur (societe), Assurflow = produit InsurTech. Marque produit changee ; namespace technique `@insurtech/*` conserve (pas de refactor).

**26 roles utilisateurs** (decision-012) -- extension additive de 12 -> 26 :
- Platform N1 : super_admin_platform + analyst_support (2)
- Tenant Broker N2 : broker_admin / broker_user / broker_assistant (3)
- Tenant Garage N2 : garage_admin / chef / technicien / comptable / commercial / parts_manager (6, +parts_manager v3.0)
- Tenant Carrier N2 : carrier_admin / claims_manager / finance / compliance / expert_manager / partner_manager (6 v3.0)
- Tenant Expert N2 : expert_independent / firm_admin / associate / carrier_internal (4 v3.0, decision-013)
- Tenant Tow N2 : tow_admin / tow_dispatcher / tow_driver (3 v3.0)
- L3 + Public : assure + prospect (2)

**7 cross-tenant authorization types** (decision-012) :
- v2.2 : broker_to_garage_assignment, assure_to_garage_visit, multi_tenant_user_access
- v3.0 : client_to_tower_dispatch, tower_to_garage_delivery, garage_to_expert_request, garage_to_carrier_quote

**130 permissions** dans 24 modules (`Permission = {...} as const` -- jamais enum) :
- 20 modules v2.2 conserves
- 4 modules v3.0 ajoutes : carrier (15 perms), expertise (10), tow (8), parts (7)

**Decisions strategiques formalisees** (15 totales) :
- 001-010 : monorepo, multi-tenant, TypeORM, Kafka, Skalean AI, no-emoji, AI defere, data residency MA, signature 43-20, insure connecteurs defere
- 011 Rebranding Skalean (editeur) / Assurflow (produit InsurTech)
- 012 Ecosystem 6 acteurs (vs 3 v2.2) -- 26 roles / 7 cross-tenant / 130 perms
- 013 Expert acteur central designe par carrier (4 roles, agrement ACAPS, independance vs garage)
- 014 PartsHub Phase 1 module integre verticale Garage (role garage_parts_manager + 7 perms)
- 015 Demo Day 30 juin 2026 scope complet v3.0 (pilote Marrakech, date dure)

**Workflow sinistre v3.0** : assure declare -> broker assigne garage -> tow remorque -> garage devis + PartsHub commande pieces -> carrier designe expert -> expert valide/modifie/rejette devis -> compagnie en CC. 7 cross-tenant types + table `expert_designations` materialisent le flux.

**Conformite v3.0** : nouveaux tenants Carrier + Expert + Tow soumis a residence MA (loi 09-08 CNDP) et chiffrement at rest. Expert ACAPS-licensed, independance materialisee par regle "expert jamais rattache tenant Garage". Carrier porte le risque (loi 17-99). Signature rapport expertise via Barid eSign (loi 43-20).

Reference complete : `00-pilotage/documentation/5-roles-permissions.md` v3.0 + `00-pilotage/decisions/011-*.md` a `015-*.md` + `00-pilotage/meta-prompts/B-7.5a-sprint-7.5a-assurflow-foundation.md`.

---


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
