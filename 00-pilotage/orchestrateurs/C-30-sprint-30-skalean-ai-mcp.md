# ORCHESTRATEUR SPRINT 30 -- Phase 7 / Sprint 2 : Skalean AI MCP Server (port 4001 -- 15 tools)
# 12 taches sequentielles + verification finale
# AUCUNE EMOJI AUTORISEE

**Version** : v2.2 (Option B detaillee)
**Phase** : 7 -- Hardening + Integrations + Pilote
**Sprint** : 30 / 35 (cumul) -- Sprint 2 dans Phase 7
**Reference meta-prompt** : `B-30-sprint-30-skalean-ai-mcp.md`
**Reference verification** : `V-30-sprint-30-verification.md`
**Numerotation taches** : 7.2.1 a 7.2.12
**Effort total** : ~75 heures developpement / 2 semaines
**Apport metier** : MCP server expose 15+ tools metier a Skalean AI agents

---

Tu es **Claude Code (ou Cowork)**. Tu dois executer **TOUTES les 12 taches** du Sprint 30 **UNE PAR UNE** dans l'ordre defini ci-dessous, puis lancer la verification automatique du sprint.

**Cet orchestrateur extrait le contenu detaille de chaque tache depuis B-30** -- pour code complet, patterns critiques et tests exhaustifs, lire le meta-prompt B-30 reference dans chaque tache.

---

## OBJECTIF DU SPRINT 30

Sprint 30 (7.2) -- Skalean AI MCP Server (port 4001 -- 15 tools). Voir B-30-sprint-30-skalean-ai-mcp.md pour contexte detaille.

---

## STRUCTURE DES FICHIERS

**Prompts des taches** (a executer en sequence) :
```
skalean-insurtech/00-pilotage/prompts-taches/sprint-30-skalean-ai-mcp/
  task-7.2.1-prompt.md       # MCP Server Foundation
  task-7.2.2-prompt.md       # Auth MCP Tokens
  task-7.2.3-prompt.md       # Tenant Context Propagation
  task-7.2.4-prompt.md       # Tools Registry + Discovery
  task-7.2.5-prompt.md       # Tools Read Insure (5)
  task-7.2.6-prompt.md       # Tools Read Repair (5)
  task-7.2.7-prompt.md       # Tools Write Controlle (3)
  task-7.2.8-prompt.md       # Tools Analytics (2)
  task-7.2.9-prompt.md       # Streaming Responses
  task-7.2.10-prompt.md       # Audit + Rate Limiting + Monitoring
  task-7.2.11-prompt.md       # Documentation OpenAPI-Style + Onboarding
  task-7.2.12-prompt.md       # Tests Integration MCP Client + Server
```

**Verification du sprint** (a lancer APRES toutes les taches) :
```
skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-30-sprint-30-verification.md
```

**Code source modifie** : `skalean-insurtech/repo/` (jamais 00-pilotage/)

**Decisions strategiques applicables** : voir `00-pilotage/decisions/001-010-*.md`

---

## REGLES D'EXECUTION CRITIQUES

### Execution sequentielle obligatoire

Tu DOIS attendre qu'une tache soit COMPLETEMENT TERMINEE avant de demarrer la suivante :
1. **Lire** le fichier prompt de la tache
2. **Implementer** TOUT le code demande dans `repo/`
3. **Compiler** (`pnpm tsc --noEmit` -- 0 erreur)
4. **Tester** (`pnpm vitest run` -- tous tests PASS)
5. **Linter** (`pnpm lint` -- 0 erreur)
6. **Commit** Conventional Commits (`git add -A && git commit`)
7. **SEULEMENT APRES** le commit, passer a la tache suivante

Raison : les taches ont des **dependances** entre elles. La tache N peut importer du code cree par la tache N-1. Executer en parallele creerait des conflits irreconciliables.

### Si une tache echoue

1. Tente de **reparer l'erreur** (3 tentatives maximum)
2. Si impossible, **note l'erreur** dans le rapport et **passe** a la tache suivante
3. **N'arrete JAMAIS** l'execution du sprint entier -- continue les taches restantes
4. La verification finale V-30 identifiera taches FAIL pour reprise ciblee

### Verification finale automatique

APRES avoir execute les 12 taches et commite chacune :
```bash
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-30-sprint-30-verification.md
```
Puis tu **executes CHAQUE section** du fichier de verification (commandes bash + checks automatiques).

---

## REGLES ABSOLUES skalean-insurtech (a appliquer dans CHAQUE tache)

### Conventions techniques

- **Multi-tenant** : CHAQUE query DB filtre par `tenant_id` automatique (Subscriber + RLS) + header `x-tenant-id` obligatoire sauf `/api/v1/public/*` et `/api/v1/admin/*`
- **Validation** : Zod uniquement (JAMAIS class-validator)
- **Logger** : Pino via `this.logger` (JAMAIS `console.log`, JAMAIS `new Logger()`)
- **Events** : Kafka sur `insurtech.events.{vertical}.{entity}.{action}` pour chaque action metier
- **RBAC** : `@Roles()` + `RolesGuard` + `TenantGuard` sur chaque endpoint
- **Tests** : Vitest, chaque fichier `.ts` a un fichier `.spec.ts` (coverage >= 85% global, 90% modules critiques)
- **Types** : TypeScript strict, **AUCUN `any` implicite**, `noUncheckedIndexedAccess: true`
- **Hash password** : argon2id (JAMAIS bcrypt, JAMAIS scrypt)
- **JWT** : RS256 + key rotation 90 jours
- **Encryption at rest** : AES-256-GCM (Atlas Cloud Services KMS)
- **Package manager** : pnpm (JAMAIS npm ou yarn)
- **Imports** : `@insurtech/*` pour packages partages
- **Skalean AI** : utilise UNIQUEMENT via `@insurtech/sky` ou MCP client (JAMAIS de duplication LLM/RAG/vector store)
- **AUCUNE EMOJI** dans le code, commentaires ou logs (decision-006 ABSOLUE)
- **Idempotency-Key** : header obligatoire pour mutations + tools MCP write
- **Conventional Commits** : tous commits suivent `<type>(scope): description`

### Conformite InsurTech Maroc (9 lois MA)

- **Audit ACAPS** : chaque ecriture sur `insure_*`, `repair_*`, `pay_*` declenche entree dans `compliance_acaps_audits` (10 ans retention)
- **Donnees Maroc** (loi 09-08 CNDP) : aucune donnee assure/police/sinistre/paiement ne transite hors **Atlas Cloud Services Benguerir** (decision-008 -- DC1 Tier III + DC2 Tier IV)
- **Multilinguisme** : toute communication assure (notifications/emails/WhatsApp/Sky) supporte fr/ar-MA (darija)/ar (classique)/en
- **Conformite loi 43-20** : signatures electroniques utilisent uniquement `@insurtech/signature` (Barid eSign + ANRT TSA RFC 3161 + archivage 10 ans)
- **Conformite loi 17-99 article 9** : droit retract 30j B2C tracable (Sprint 15 cancellation_legal_basis)
- **Conformite loi 9-88** : ecritures comptables CGNC plan + SAFT-MA export DGI
- **Conformite loi 43-05** : AML monitoring + SAR generation AMC
- **TVA MA** : 5 taux (0/7/10/14/20%) -- Sprint 12
- **CNSS** : 4.48% + **AMO** : 2.26% -- Sprint 13 paie
- **BAM** : limit 100k MAD + 3D Secure obligatoire (Sprint 11)
- **Notification breach** : sous 72h CNDP + Atlas Cloud Services SOC

---

## CONTEXTE PHASE 7 -- Hardening + Integrations + Pilote

### Position du Sprint 2 dans la Phase 7

Sprint 30 (7.2) -- **Skalean AI MCP Server (port 4001 -- 15 tools)**.

Voir `B-30-sprint-30-skalean-ai-mcp.md` (section "POSITION DANS LA PHASE" + "DEPENDANCES") pour contexte detaille des dependances cross-sprints (entrees consommees + sorties produites).

### Modules concernes par cette Phase

apps/mcp-server, @insurtech/sky, @insurtech/sky-ui, infrastructure (Atlas Cloud Services prod, Cloudflare CDN, K6 chaos)

### Apport metier de ce sprint

MCP server expose 15+ tools metier a Skalean AI agents

### Decisions strategiques applicables

Cf. `00-pilotage/decisions/`. Decisions cles pour ce sprint : voir B-30 section "Decisions strategiques applicables".

---

## EXECUTION SEQUENTIELLE DES 12 TACHES

Chaque tache ci-dessous indique : metadata (priorite/effort/deps), but extrait de B-30, actions principales (livrables checkables), fichiers cibles, criteres P0, validation et commit.

**Pour code complet, patterns critiques, tests exhaustifs** : lire le prompt tache detaille genere depuis B-30.

---

### Tache 1 / 12 : MCP Server Foundation

**Metadonnees** : P0 | 6h | Depend de : Depend de Sprint 29

**But** : Bootstrap MCP server Skalean InsurTech : SDK MCP + transport HTTP + port 4001 dedicated.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-30-skalean-ai-mcp/task-7.2.1-prompt.md
```

**Actions principales attendues** :
- App `repo/apps/mcp-server/` (Nest microservice OR standalone Node)
- Setup `@modelcontextprotocol/sdk` server
- Transport HTTP (vs stdio) pour reuse infrastructure (load balancer, monitoring)
- Port 4001 dedicated (separate de api 4000)
- Endpoint discovery : `GET /mcp/v1/discover` retourne capabilities + tools list
- Endpoint tool call : `POST /mcp/v1/tools/{tool_name}/call`

**Fichiers cibles principaux** :
  - `repo/apps/mcp-server/`
  - `repo/apps/mcp-server/src/main.ts`
  - `repo/apps/mcp-server/src/server.module.ts`
  - `repo/apps/mcp-server/src/transport/http-transport.ts`
  - `repo/apps/mcp-server/Dockerfile`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Server demarre port 4001
  - V2 (P0) : Discovery endpoint
  - V3 (P0) : Tool call endpoint structure

**Validation** :
```bash
cd repo
pnpm tsc --noEmit                    # Typecheck strict
pnpm vitest run --coverage           # Tests unitaires + coverage
pnpm lint                            # Biome lint + format check
cd ..
```

**Commit** :
```bash
git add -A
git commit -m "feat(sprint-30): mcp server foundation

Task: 7.2.1
Sprint: 30 (Phase 7 / Sprint 2)
Phase: 7 -- Hardening + Integrations + Pilote
Decisions: see B-30 Tache 7.2.1"
```

---

### Tache 2 / 12 : Auth MCP Tokens

**Metadonnees** : P0 | 6h | Depend de : Depend de 7.2.1

**But** : Auth strategy MCP server : JWT tokens separate lifecycle (Sky agent tokens) + scopes per tool + KMS rotation.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-30-skalean-ai-mcp/task-7.2.2-prompt.md
```

**Actions principales attendues** :
- Migration : table `mcp_client_credentials` :
- Service `mcp-auth.service.ts` :
- Endpoint `POST /mcp/v1/auth/token` : exchange client_id + api_key + user JWT -> MCP token
- Middleware HTTP : verify MCP token avant tool call
- Scopes per tool : decorator `@RequiresScope('mcp.tools.policies.read')`
- KMS rotation : api_key client rotateable

**Fichiers cibles principaux** :
  - `repo/packages/database/src/migrations/{date}-McpClientCredentials.ts`
  - `repo/packages/auth/src/services/mcp-auth.service.ts`
  - `repo/apps/mcp-server/src/auth/mcp-auth.middleware.ts`
  - `repo/apps/mcp-server/src/auth/scope-mapping.ts`
  - `repo/apps/api/src/modules/admin/controllers/mcp-clients.controller.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : MCP token issuance
  - V2 (P0) : Scopes verification
  - V3 (P0) : Client revocation

**Validation** :
```bash
cd repo
pnpm tsc --noEmit                    # Typecheck strict
pnpm vitest run --coverage           # Tests unitaires + coverage
pnpm lint                            # Biome lint + format check
cd ..
```

**Commit** :
```bash
git add -A
git commit -m "feat(sprint-30): auth mcp tokens

Task: 7.2.2
Sprint: 30 (Phase 7 / Sprint 2)
Phase: 7 -- Hardening + Integrations + Pilote
Decisions: see B-30 Tache 7.2.2"
```

---

### Tache 3 / 12 : Tenant Context Propagation

**Metadonnees** : P0 | 5h | Depend de : Depend de 7.2.2

**But** : Propagation context tenant + user (Sky agent agit pour user dans tenant donne). MCP tools respect RLS multi-tenant + capabilities tenant Sprint 25 (Type 2/3 tenants).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-30-skalean-ai-mcp/task-7.2.3-prompt.md
```

**Actions principales attendues** :
- Middleware `mcpTenantContextMiddleware` :
- **Capabilities check tenant (Sprint 25 integration)** :
- Audit log enrichi : `via_mcp` flag + `mcp_client_id` field + `capabilities_check_passed: bool`
- Endpoint exchange : `POST /mcp/v1/auth/exchange` :
- Sky agent (Sprint 31) utilise ce token pour appeler tools MCP au nom user
- Tests : isolation respect + audit complete + capabilities check 8+ scenarios (Atlas full access / managed_partner restricted / api_partner minimal)

**Fichiers cibles principaux** :
  - `repo/apps/mcp-server/src/auth/mcp-tenant-context.middleware.ts`
  - `repo/packages/auth/src/services/mcp-token-exchange.service.ts`
  - `repo/apps/api/src/modules/auth/controllers/mcp-token-exchange.controller.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Tenant context set correctly
  - V2 (P0) : RLS isolation respect
  - V3 (P0) : Audit via_mcp flag

**Validation** :
```bash
cd repo
pnpm tsc --noEmit                    # Typecheck strict
pnpm vitest run --coverage           # Tests unitaires + coverage
pnpm lint                            # Biome lint + format check
cd ..
```

**Commit** :
```bash
git add -A
git commit -m "feat(sprint-30): tenant context propagation

Task: 7.2.3
Sprint: 30 (Phase 7 / Sprint 2)
Phase: 7 -- Hardening + Integrations + Pilote
Decisions: see B-30 Tache 7.2.3"
```

---

### Tache 4 / 12 : Tools Registry + Discovery

**Metadonnees** : P0 | 5h | Depend de : Depend de 7.2.3

**But** : Registry centralise tools + metadata + JSON Schema input/output + versioning + discovery automatic.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-30-skalean-ai-mcp/task-7.2.4-prompt.md
```

**Actions principales attendues** :
- Service `tools-registry.service.ts` :
- Interface `McpTool` :
- Versioning : tools peuvent etre `@deprecated` (Sky agent prefer non-deprecated)
- Discovery output structured pour Sky comprehension (descriptions clear)
- Tests registry

**Fichiers cibles principaux** :
  - `repo/apps/mcp-server/src/tools/tools-registry.service.ts`
  - `repo/apps/mcp-server/src/tools/types.ts`
  - `repo/apps/mcp-server/src/tools/tools-discovery.controller.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Registry CRUD
  - V2 (P0) : Metadata discovery
  - V3 (P0) : JSON Schema generated

**Validation** :
```bash
cd repo
pnpm tsc --noEmit                    # Typecheck strict
pnpm vitest run --coverage           # Tests unitaires + coverage
pnpm lint                            # Biome lint + format check
cd ..
```

**Commit** :
```bash
git add -A
git commit -m "feat(sprint-30): tools registry + discovery

Task: 7.2.4
Sprint: 30 (Phase 7 / Sprint 2)
Phase: 7 -- Hardening + Integrations + Pilote
Decisions: see B-30 Tache 7.2.4"
```

---

### Tache 5 / 12 : Tools Read Insure (5)

**Metadonnees** : P0 | 7h | Depend de : Depend de 7.2.4

**But** : Implementer 5 tools read Insure : `get_policy_by_number` + `list_policies` + `get_quote_by_number` + `lookup_customer` + `get_invoice_by_number`.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-30-skalean-ai-mcp/task-7.2.5-prompt.md
```

**Actions principales attendues** :
- **`get_policy_by_number`** :
- **`list_policies`** :
- **`get_quote_by_number`** :
- **`lookup_customer`** :
- **`get_invoice_by_number`** :
- Each tool : registry + Zod schemas + execute via existing services

**Fichiers cibles principaux** :
  - `repo/apps/mcp-server/src/tools/insure/{5 tools}.ts`
  - `repo/apps/mcp-server/src/tools/insure/index.ts`
  - `repo/apps/mcp-server/src/tools/insure/tests/{5 specs}.spec.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 5 tools registered
  - V2 (P0) : Schemas valides
  - V3 (P0) : Permissions respectees

**Validation** :
```bash
cd repo
pnpm tsc --noEmit                    # Typecheck strict
pnpm vitest run --coverage           # Tests unitaires + coverage
pnpm lint                            # Biome lint + format check
cd ..
```

**Commit** :
```bash
git add -A
git commit -m "feat(sprint-30): tools read insure (5)

Task: 7.2.5
Sprint: 30 (Phase 7 / Sprint 2)
Phase: 7 -- Hardening + Integrations + Pilote
Decisions: see B-30 Tache 7.2.5"
```

---

### Tache 6 / 12 : Tools Read Repair (5)

**Metadonnees** : P0 | 7h | Depend de : Depend de 7.2.5

**But** : Implementer 5 tools read Repair : `get_sinistre_by_number` + `list_sinistres` + `get_diagnostic` + `get_garage` + `get_warranty`.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-30-skalean-ai-mcp/task-7.2.6-prompt.md
```

**Actions principales attendues** :
- **`get_sinistre_by_number`** :
- **`list_sinistres`** :
- **`get_diagnostic`** :
- **`get_garage`** :
- **`get_warranty`** :
- Tests

**Fichiers cibles principaux** :
  - `repo/apps/mcp-server/src/tools/repair/{5 tools}.ts`
  - `repo/apps/mcp-server/src/tools/repair/index.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 5 tools registered
  - V2 (P0) : Tests 10+ scenarios

**Validation** :
```bash
cd repo
pnpm tsc --noEmit                    # Typecheck strict
pnpm vitest run --coverage           # Tests unitaires + coverage
pnpm lint                            # Biome lint + format check
cd ..
```

**Commit** :
```bash
git add -A
git commit -m "feat(sprint-30): tools read repair (5)

Task: 7.2.6
Sprint: 30 (Phase 7 / Sprint 2)
Phase: 7 -- Hardening + Integrations + Pilote
Decisions: see B-30 Tache 7.2.6"
```

---

### Tache 7 / 12 : Tools Write Controlle (3)

**Metadonnees** : P0 | 6h | Depend de : Depend de 7.2.6

**But** : 3 tools WRITE strictly audited + idempotency + scope strict : `create_quote_draft` + `book_appointment` + `send_communication`.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-30-skalean-ai-mcp/task-7.2.7-prompt.md
```

**Actions principales attendues** :
- **`create_quote_draft`** :
- **`book_appointment`** :
- **`send_communication`** :
- Audit complet : Sky a appele tool + qui a benefice + impact business
- Confirmation user requise pour write tools (Sky propose -> user valide via UI Sprint 31)
- Tests

**Fichiers cibles principaux** :
  - `repo/apps/mcp-server/src/tools/write/{3 tools}.ts`
  - `repo/apps/mcp-server/src/services/idempotency-cache.service.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 3 write tools
  - V2 (P0) : Idempotency obligatoire
  - V3 (P0) : Audit BEFORE execute

**Validation** :
```bash
cd repo
pnpm tsc --noEmit                    # Typecheck strict
pnpm vitest run --coverage           # Tests unitaires + coverage
pnpm lint                            # Biome lint + format check
cd ..
```

**Commit** :
```bash
git add -A
git commit -m "feat(sprint-30): tools write controlle (3)

Task: 7.2.7
Sprint: 30 (Phase 7 / Sprint 2)
Phase: 7 -- Hardening + Integrations + Pilote
Decisions: see B-30 Tache 7.2.7"
```

---

### Tache 8 / 12 : Tools Analytics (2)

**Metadonnees** : P0 | 5h | Depend de : Depend de 7.2.7

**But** : 2 tools analytics : `query_kpis` + `search_anomalies` -- consume ETL ClickHouse Sprint 13.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-30-skalean-ai-mcp/task-7.2.8-prompt.md
```

**Actions principales attendues** :
- **`query_kpis`** :
- **`search_anomalies`** :
- Tests

**Fichiers cibles principaux** :
  - `repo/apps/mcp-server/src/tools/analytics/{2 tools}.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 2 tools registered
  - V2 (P0) : Tests 6+ scenarios

**Validation** :
```bash
cd repo
pnpm tsc --noEmit                    # Typecheck strict
pnpm vitest run --coverage           # Tests unitaires + coverage
pnpm lint                            # Biome lint + format check
cd ..
```

**Commit** :
```bash
git add -A
git commit -m "feat(sprint-30): tools analytics (2)

Task: 7.2.8
Sprint: 30 (Phase 7 / Sprint 2)
Phase: 7 -- Hardening + Integrations + Pilote
Decisions: see B-30 Tache 7.2.8"
```

---

### Tache 9 / 12 : Streaming Responses

**Metadonnees** : P0 | 5h | Depend de : Depend de 7.2.8

**But** : Streaming responses pour large datasets (e.g. liste 1000 polices) + cursor pagination + abort handling.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-30-skalean-ai-mcp/task-7.2.9-prompt.md
```

**Actions principales attendues** :
- Update tools `list_*` : support streaming via Server-Sent Events
- Cursor pagination : `next_cursor` + `has_more`
- Abort handling : si Sky abort request, server stop processing
- Memory efficient : chunks 100 items max per stream message
- Tests streaming + abort

**Fichiers cibles principaux** :
  - `repo/apps/mcp-server/src/streaming/sse-streaming.service.ts`
  - `repo/apps/mcp-server/src/tools/insure/list-policies.tool.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Streaming SSE
  - V2 (P0) : Cursor pagination
  - V3 (P0) : Abort handling

**Validation** :
```bash
cd repo
pnpm tsc --noEmit                    # Typecheck strict
pnpm vitest run --coverage           # Tests unitaires + coverage
pnpm lint                            # Biome lint + format check
cd ..
```

**Commit** :
```bash
git add -A
git commit -m "feat(sprint-30): streaming responses

Task: 7.2.9
Sprint: 30 (Phase 7 / Sprint 2)
Phase: 7 -- Hardening + Integrations + Pilote
Decisions: see B-30 Tache 7.2.9"
```

---

### Tache 10 / 12 : Audit + Rate Limiting + Monitoring

**Metadonnees** : P0 | 5h | Depend de : Depend de 7.2.9

**But** : Audit complet tools usage + rate limiting per client + monitoring dashboard.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-30-skalean-ai-mcp/task-7.2.10-prompt.md
```

**Actions principales attendues** :
- Migration : table `mcp_tool_calls_log` :
- Service `mcp-tool-calls-logger.service.ts`
- Rate limiting per client :
- Kafka events : `mcp.tool.called`
- ETL ClickHouse : sync logs -> dashboard analytics
- Dashboard admin : `/ai-monitoring/mcp-server` :

**Fichiers cibles principaux** :
  - `repo/packages/database/src/migrations/{date}-McpToolCallsLog.ts`
  - `repo/apps/mcp-server/src/services/mcp-tool-calls-logger.service.ts`
  - `repo/apps/mcp-server/src/middleware/rate-limit.middleware.ts`
  - `repo/apps/web-insurtech-admin/app/[locale]/(protected)/ai-monitoring/mcp-server/page.tsx`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Audit complete logs
  - V2 (P0) : Rate limit per client
  - V3 (P0) : Dashboard admin

**Validation** :
```bash
cd repo
pnpm tsc --noEmit                    # Typecheck strict
pnpm vitest run --coverage           # Tests unitaires + coverage
pnpm lint                            # Biome lint + format check
cd ..
```

**Commit** :
```bash
git add -A
git commit -m "feat(sprint-30): audit + rate limiting + monitoring

Task: 7.2.10
Sprint: 30 (Phase 7 / Sprint 2)
Phase: 7 -- Hardening + Integrations + Pilote
Decisions: see B-30 Tache 7.2.10"
```

---

### Tache 11 / 12 : Documentation OpenAPI-Style + Onboarding

**Metadonnees** : P0 | 4h | Depend de : Depend de 7.2.10

**But** : Documentation tools complete (OpenAPI-style) + onboarding guide Sky team Sprint 31.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-30-skalean-ai-mcp/task-7.2.11-prompt.md
```

**Actions principales attendues** :
- Documents :
- OpenAPI-style spec : auto-generated from registry + Zod schemas
- Examples per tool : input + expected output
- Best practices Sky usage : tools selection + idempotency + error handling

**Fichiers cibles principaux** :
  - `repo/docs/mcp-server-architecture.md`
  - `repo/docs/mcp-tools-catalog.md`
  - `repo/docs/mcp-onboarding-sky-team.md`
  - `repo/infrastructure/scripts/generate-mcp-openapi-spec.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 3 documents complets
  - V2 (P0) : OpenAPI auto-generated
  - V3 (P0) : Sprint 31 ready

**Validation** :
```bash
cd repo
pnpm tsc --noEmit                    # Typecheck strict
pnpm vitest run --coverage           # Tests unitaires + coverage
pnpm lint                            # Biome lint + format check
cd ..
```

**Commit** :
```bash
git add -A
git commit -m "feat(sprint-30): documentation openapi-style + onboarding

Task: 7.2.11
Sprint: 30 (Phase 7 / Sprint 2)
Phase: 7 -- Hardening + Integrations + Pilote
Decisions: see B-30 Tache 7.2.11"
```

---

### Tache 12 / 12 : Tests Integration MCP Client + Server

**Metadonnees** : P0 | 9h | Depend de : Depend de 7.2.11

**But** : Suite tests integration MCP client (mock Sky agent) + server + scenarios end-to-end.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-30-skalean-ai-mcp/task-7.2.12-prompt.md
```

**Actions principales attendues** :
- Auth + scopes (3)
- Tenant context isolation (2)
- Tools read Insure 5 tools (3)
- Tools read Repair 5 tools (3)
- Tools write controlle 3 tools + idempotency (3)
- Streaming + cursor pagination (1)

**Fichiers cibles principaux** :
  - `repo/apps/mcp-server/test/{15+ specs}.spec.ts`
  - `repo/apps/mcp-server/test/mock-mcp-client.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 15+ tests passent
  - V2 (P0) : CI green
  - V3 (P0) : Reproducibility 5x

**Validation** :
```bash
cd repo
pnpm tsc --noEmit                    # Typecheck strict
pnpm vitest run --coverage           # Tests unitaires + coverage
pnpm lint                            # Biome lint + format check
cd ..
```

**Commit** :
```bash
git add -A
git commit -m "feat(sprint-30): tests integration mcp client + server

Task: 7.2.12
Sprint: 30 (Phase 7 / Sprint 2)
Phase: 7 -- Hardening + Integrations + Pilote
Decisions: see B-30 Tache 7.2.12"
```

---


## VERIFICATION DU SPRINT 30

Une fois les 12 taches terminees et commitees, **lancer la verification automatique** :

```bash
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-30-sprint-30-verification.md
```

Le fichier de verification V-30 contient :

- **Criteres P0 bloquants** : compilation TypeScript / tests Vitest / Biome lint / no-emoji / conventional commits
- **Criteres P1 avertissements** : couverture >= 85% / dependencies coherentes / docs API / metriques performance
- **Criteres P2 notes** : coverage >= 90% modules critiques / lighthouse score / accessibility
- **Auto-reparation** pour criteres recuperables (e.g. relance tests flaky)
- **Generation automatique** du rapport `sprint30-verify-report.md`
- **Calcul score global** + statut GO / GO CONDITIONNEL / NO-GO

**Score minimum requis pour GO** : >= 95% (sprint termine, GO Sprint suivant)
**Score minimum pour GO CONDITIONNEL** : 85-94% (hot fix requis, retard <= 1 semaine)
**En dessous de 85%** : NO-GO, **reprise sprint requise** (escalation Saad/Abla decision)

Apres execution, lire le rapport :

```bash
cat skalean-insurtech/sprint30-verify-report.md
```

Si statut **GO** ou **GO CONDITIONNEL**, executer le commit de cloture :

```bash
git add skalean-insurtech/sprint30-verify-report.md
git commit -m "chore(sprint-30): close sprint 30 with verification report

- Score global : {SCORE}%
- Statut : {GO|GO CONDITIONNEL}
- Phase : 7 (Hardening + Integrations + Pilote)
- Sprint : 30 (Phase 7 / Sprint 2)
- Apport : MCP server expose 15+ tools metier a Skalean AI agents
- Tests E2E cumules : {N}+

Sprint 30 completed -- handoff to Sprint 31."
```

---

## RESUME DU WORKFLOW

```
[Demarrage Sprint 30]
   |
   v
[Tache 7.2.1: MCP Server Foundation]
   | -> compile -> tests -> commit
   v
[Tache 7.2.2: Auth MCP Tokens]
   | -> compile -> tests -> commit
   v
[Tache 7.2.3: Tenant Context Propagation]
   | -> compile -> tests -> commit
   v
[Tache 7.2.4: Tools Registry + Discovery]
   | -> compile -> tests -> commit
   v
[Tache 7.2.5: Tools Read Insure (5)]
   | -> compile -> tests -> commit
   v
[Tache 7.2.6: Tools Read Repair (5)]
   | -> compile -> tests -> commit
   v
[Tache 7.2.7: Tools Write Controlle (3)]
   | -> compile -> tests -> commit
   v
[Tache 7.2.8: Tools Analytics (2)]
   | -> compile -> tests -> commit
   v
[Tache 7.2.9: Streaming Responses]
   | -> compile -> tests -> commit
   v
[Tache 7.2.10: Audit + Rate Limiting + Monitoring]
   | -> compile -> tests -> commit
   v
[Tache 7.2.11: Documentation OpenAPI-Style + Onboarding]
   | -> compile -> tests -> commit
   v
[Tache 7.2.12: Tests Integration MCP Client + Server]
   | -> compile -> tests -> commit
   v
[Verification automatique sprint 30 -- V-30]
   |
   v
[Rapport sprint30-verify-report.md]
   |
   v
[Score >= 95%] -> GO -> commit cloture sprint -> Sprint suivant
[Score 85-94%] -> GO CONDITIONNEL -> hot fix puis cloture
[Score < 85%]  -> NO-GO -> reprise sprint
```

**Duree totale estimee** : 75 heures (6h par tache moyenne -- 2 devs FTE en parallele).

**Modules skalean-insurtech affectes** : apps/mcp-server, @insurtech/sky, @insurtech/sky-ui, infrastructure (Atlas Cloud Services prod, Cloudflare CDN, K6 chaos)

**Apport metier principal** : MCP server expose 15+ tools metier a Skalean AI agents.

**Prerequis Sprint 31** : Sprint 30 GO complet (score >= 95% verification automatique V-30).

**Sprint suivant** : Sprint 31.

---

## COMMANDES DE LANCEMENT

### Prerequis Sprint 29 (verification GO)

```bash
# Verifier Sprint 29 GO
ls skalean-insurtech/sprint29-verify-report.md
grep '^Statut.*GO' skalean-insurtech/sprint29-verify-report.md
```

### Lancement Sprint 30 (Cowork lit cet orchestrateur)

```bash
# Cowork command (claude-code or cowork CLI) :
claude-code \
  --orchestrator skalean-insurtech/00-pilotage/meta-prompts/phase-C-orchestration/C-30-sprint-30-skalean-ai-mcp.md \
  --reference-prompt skalean-insurtech/00-pilotage/meta-prompts/phase-B-tasks/B-30-sprint-30-skalean-ai-mcp.md \
  --verification skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-30-sprint-30-verification.md
```

### Suivi temps reel execution

```bash
# Tail le log Cowork
tail -f skalean-insurtech/cowork-sprint-30.log

# Verifier progression commits
git log --oneline --since="2 weeks ago" -- repo/ | grep "Sprint: 30"
```

### Apres completion -- verifier rapport

```bash
cat skalean-insurtech/sprint30-verify-report.md
```

---

## NOTES IMPORTANTES POUR COWORK

1. **Lire d'abord B-30** complet avant generation prompts taches (contexte critique)
2. **Generer les 12 prompts taches** dans `00-pilotage/prompts-taches/sprint-30-*/` AVANT de commencer execution
3. **Toujours respecter l'ordre** des taches (dependances explicites)
4. **Commit chaque tache separement** (granularite Git pour rollback facile)
5. **NE JAMAIS modifier `00-pilotage/`** -- uniquement `repo/`
6. **En cas de doute**, escalader Saad/Abla via Slack `#insurtech-dev` plutot que faire choix arbitraire
7. **Documentation continue** : si tu prends une decision technique, ajouter ADR dans `repo/docs/architecture/`

---

**Fin de l'orchestrateur C-30 v2.2 detaille -- Sprint 30 (7.2) Skalean AI MCP Server (port 4001 -- 15 tools).**

**Total taches detaillees** : 12 | **Effort cumul** : ~75h | **Apport** : MCP server expose 15+ tools metier a Skalean AI agents
