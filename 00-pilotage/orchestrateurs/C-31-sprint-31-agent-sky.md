# ORCHESTRATEUR SPRINT 31 -- Phase 7 / Sprint 3 : Agent Sky Multilingue (4 langues -- 4 apps)
# 13 taches sequentielles + verification finale
# AUCUNE EMOJI AUTORISEE

**Version** : v2.2 (Option B detaillee)
**Phase** : 7 -- Hardening + Integrations + Pilote
**Sprint** : 31 / 35 (cumul) -- Sprint 3 dans Phase 7
**Reference meta-prompt** : `B-31-sprint-31-agent-sky.md`
**Reference verification** : `V-31-sprint-31-verification.md`
**Numerotation taches** : 7.3.1 a 7.3.12
**Effort total** : ~75 heures developpement / 2 semaines
**Apport metier** : Sky agent multilingue 4 langues 4 apps + voice-to-text

---

Tu es **Claude Code (ou Cowork)**. Tu dois executer **TOUTES les 13 taches** du Sprint 31 **UNE PAR UNE** dans l'ordre defini ci-dessous, puis lancer la verification automatique du sprint.

**Cet orchestrateur extrait le contenu detaille de chaque tache depuis B-31** -- pour code complet, patterns critiques et tests exhaustifs, lire le meta-prompt B-31 reference dans chaque tache.

---

## OBJECTIF DU SPRINT 31

Sprint 31 (7.3) -- Agent Sky Multilingue (4 langues -- 4 apps). Voir B-31-sprint-31-agent-sky.md pour contexte detaille.

---

## STRUCTURE DES FICHIERS

**Prompts des taches** (a executer en sequence) :
```
skalean-insurtech/00-pilotage/prompts-taches/sprint-31-agent-sky/
  task-7.3.1-prompt.md       # Backend Sky Orchestrator + MCP Client
  task-7.3.2-prompt.md       # System Prompts Multilingues Per App
  task-7.3.3-prompt.md       # MCP Tool Calling : Agent Loop
  task-7.3.4-prompt.md       # Conversations Persistance
  task-7.3.5-prompt.md       # Chat Widget UI Shared Package
  task-7.3.6-prompt.md       # Integration web-broker + I18n
  task-7.3.7-prompt.md       # Integration web-garage + Role-Specific Suggestions
  task-7.3.8-prompt.md       # Integration web-customer-portal + Onboarding Adapted
  task-7.3.8b-prompt.md       # Integration web-assure-portal + Suggestions Assure Post-Souscription
  task-7.3.9-prompt.md       # Confirmation Modals Write Tools
  task-7.3.10-prompt.md       # Voice-to-Text + Analytics Dashboard
  task-7.3.11-prompt.md       # Documentation + Onboarding Users + Best Prompts
  task-7.3.12-prompt.md       # Tests E2E + WCAG + Lighthouse
```

**Verification du sprint** (a lancer APRES toutes les taches) :
```
skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-31-sprint-31-verification.md
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
4. La verification finale V-31 identifiera taches FAIL pour reprise ciblee

### Verification finale automatique

APRES avoir execute les 13 taches et commite chacune :
```bash
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-31-sprint-31-verification.md
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

### Position du Sprint 3 dans la Phase 7

Sprint 31 (7.3) -- **Agent Sky Multilingue (4 langues -- 4 apps)**.

Voir `B-31-sprint-31-agent-sky.md` (section "POSITION DANS LA PHASE" + "DEPENDANCES") pour contexte detaille des dependances cross-sprints (entrees consommees + sorties produites).

### Modules concernes par cette Phase

apps/mcp-server, @insurtech/sky, @insurtech/sky-ui, infrastructure (Atlas Cloud Services prod, Cloudflare CDN, K6 chaos)

### Apport metier de ce sprint

Sky agent multilingue 4 langues 4 apps + voice-to-text

### Decisions strategiques applicables

Cf. `00-pilotage/decisions/`. Decisions cles pour ce sprint : voir B-31 section "Decisions strategiques applicables".

---

## EXECUTION SEQUENTIELLE DES 13 TACHES

Chaque tache ci-dessous indique : metadata (priorite/effort/deps), but extrait de B-31, actions principales (livrables checkables), fichiers cibles, criteres P0, validation et commit.

**Pour code complet, patterns critiques, tests exhaustifs** : lire le prompt tache detaille genere depuis B-31.

---

### Tache 1 / 13 : Backend Sky Orchestrator + MCP Client

**Metadonnees** : P0 | 7h | Depend de : Depend de Sprint 30

**But** : Backend orchestrator Sky : appel Skalean AI conversational API (OpenAI-compatible) + setup MCP client pour tool calling.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-31-agent-sky/task-7.3.1-prompt.md
```

**Actions principales attendues** :
- Service `sky-orchestrator.service.ts` :
- MCP client init :
- Skalean AI conversational format : OpenAI-compatible (function calling)
- Tool calling loop :
- Streaming SSE proxied to chat UI
- Tests : flow + tool calling

**Fichiers cibles principaux** :
  - `repo/packages/sky/`
  - `repo/packages/sky/src/services/sky-orchestrator.service.ts`
  - `repo/packages/sky/src/services/mcp-client.service.ts`
  - `repo/packages/sky/src/services/skalean-ai-conversational.client.ts`
  - `repo/apps/api/src/modules/sky/sky.controller.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Endpoint chat + streaming
  - V2 (P0) : MCP client integration
  - V3 (P0) : Tool calling loop functional

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
git commit -m "feat(sprint-31): backend sky orchestrator + mcp client

Task: 7.3.1
Sprint: 31 (Phase 7 / Sprint 3)
Phase: 7 -- Hardening + Integrations + Pilote
Decisions: see B-31 Tache 7.3.1"
```

---

### Tache 2 / 13 : System Prompts Multilingues Per App

**Metadonnees** : P0 | 5h | Depend de : Depend de 7.3.1

**But** : System prompts adaptes per app + per locale -- Sky comprend contexte business + langue user.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-31-agent-sky/task-7.3.2-prompt.md
```

**Actions principales attendues** :
- System prompts per app (4 apps x 4 locales = 16 prompts) :
- Each prompt includes :
- Locale-specific :
- Service `system-prompts.service.ts` : compose prompt selon app + locale + user role
- Tests : prompts loaded correctly

**Fichiers cibles principaux** :
  - `repo/packages/sky/src/prompts/{web-broker,web-garage,web-customer-portal}-{fr,ar-MA,ar,en}.md`
  - `repo/packages/sky/src/services/system-prompts.service.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 12 prompts disponibles
  - V2 (P0) : Service compose correctement
  - V3 (P0) : Tests 5+ scenarios

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
git commit -m "feat(sprint-31): system prompts multilingues per app

Task: 7.3.2
Sprint: 31 (Phase 7 / Sprint 3)
Phase: 7 -- Hardening + Integrations + Pilote
Decisions: see B-31 Tache 7.3.2"
```

---

### Tache 3 / 13 : MCP Tool Calling : Agent Loop

**Metadonnees** : P0 | 6h | Depend de : Depend de 7.3.2

**But** : Implementation complete agent loop : tool selection + execution + result integration + safety checks.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-31-agent-sky/task-7.3.3-prompt.md
```

**Actions principales attendues** :
- Loop logic Tache 7.3.1 enrichi :
- Safety checks :
- Tool result formatting : succes -> JSON ; error -> `{ error: ..., suggestion: ... }` (Sky comprend context)
- Logging : every tool call attempted + outcome
- Tests : iterations + safety + edge cases

**Fichiers cibles principaux** :
  - `repo/packages/sky/src/services/agent-loop.service.ts`
  - `repo/packages/sky/src/services/tool-permissions.service.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Tool selection automatic
  - V2 (P0) : Whitelist per app + role
  - V3 (P0) : Safety max iterations + timeout

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
git commit -m "feat(sprint-31): mcp tool calling : agent loop

Task: 7.3.3
Sprint: 31 (Phase 7 / Sprint 3)
Phase: 7 -- Hardening + Integrations + Pilote
Decisions: see B-31 Tache 7.3.3"
```

---

### Tache 4 / 13 : Conversations Persistance

**Metadonnees** : P0 | 5h | Depend de : Depend de 7.3.3

**But** : Persister conversations Sky : history per user + retrieval + cleanup retention.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-31-agent-sky/task-7.3.4-prompt.md
```

**Actions principales attendues** :
- Migration : table `sky_conversations` :
- Migration : table `sky_messages` :
- Service `conversations.service.ts` :
- Endpoints :
- Permissions : user can only see own conversations
- Tests

**Fichiers cibles principaux** :
  - `repo/packages/database/src/migrations/{date}-SkyConversations.ts`
  - `repo/packages/database/src/migrations/{date}-SkyMessages.ts`
  - `repo/packages/sky/src/entities/{2 entities}.ts`
  - `repo/packages/sky/src/services/conversations.service.ts`
  - `repo/apps/api/src/modules/sky/conversations.controller.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Conversations persisted
  - V2 (P0) : History retrieval
  - V3 (P0) : Cleanup retention

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
git commit -m "feat(sprint-31): conversations persistance

Task: 7.3.4
Sprint: 31 (Phase 7 / Sprint 3)
Phase: 7 -- Hardening + Integrations + Pilote
Decisions: see B-31 Tache 7.3.4"
```

---

### Tache 5 / 13 : Chat Widget UI Shared Package

**Metadonnees** : P0 | 7h | Depend de : Depend de 7.3.4

**But** : Package shared UI chat widget reutilisable 3 apps : streaming + markdown + history.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-31-agent-sky/task-7.3.5-prompt.md
```

**Actions principales attendues** :
- Package `repo/packages/sky-ui/`
- Component `<SkyChatWidget>` :
- Sub-components :
- Streaming :
- Markdown render : `react-markdown` + code blocks + lists
- Conversation history : load past conversations + switch

**Fichiers cibles principaux** :
  - `repo/packages/sky-ui/`
  - `repo/packages/sky-ui/src/components/sky-chat-widget.tsx`
  - `repo/packages/sky-ui/src/components/{several sub-components}.tsx`
  - `repo/packages/sky-ui/src/hooks/use-sky-chat.ts`
  - `repo/packages/sky-ui/src/styles.css`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Widget integrable
  - V2 (P0) : Streaming display
  - V3 (P0) : Markdown render

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
git commit -m "feat(sprint-31): chat widget ui shared package

Task: 7.3.5
Sprint: 31 (Phase 7 / Sprint 3)
Phase: 7 -- Hardening + Integrations + Pilote
Decisions: see B-31 Tache 7.3.5"
```

---

### Tache 6 / 13 : Integration web-broker + I18n

**Metadonnees** : P0 | 5h | Depend de : Depend de 7.3.5

**But** : Integration `<SkyChatWidget>` dans web-broker (Sprint 16) + i18n fr/ar-MA/ar/en + suggestions specifiques.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-31-agent-sky/task-7.3.6-prompt.md
```

**Actions principales attendues** :
- Integration : import widget dans `app/[locale]/(protected)/layout.tsx` web-broker
- Quick suggestions web-broker :
- I18n suggestions per locale (4 langues)
- RTL ar : widget positionne bottom-left au lieu bottom-right
- Tests integration

**Fichiers cibles principaux** :
  - `repo/apps/web-broker/app/[locale]/(protected)/layout.tsx`
  - `repo/apps/web-broker/messages/{fr,ar-MA,ar,en}.json`
  - `repo/apps/web-broker/components/sky/quick-suggestions-broker.tsx`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Widget integre
  - V2 (P0) : Quick suggestions per locale
  - V3 (P0) : RTL position correct

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
git commit -m "feat(sprint-31): integration web-broker + i18n

Task: 7.3.6
Sprint: 31 (Phase 7 / Sprint 3)
Phase: 7 -- Hardening + Integrations + Pilote
Decisions: see B-31 Tache 7.3.6"
```

---

### Tache 7 / 13 : Integration web-garage + Role-Specific Suggestions

**Metadonnees** : P0 | 5h | Depend de : Depend de 7.3.6

**But** : Integration web-garage (Sprint 22) + suggestions per role garage.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-31-agent-sky/task-7.3.7-prompt.md
```

**Actions principales attendues** :
- Integration : import widget web-garage layout
- Quick suggestions per role :
- Service detection role + suggestions appropriate
- I18n
- Tests

**Fichiers cibles principaux** :
  - `repo/apps/web-garage/app/[locale]/(protected)/layout.tsx`
  - `repo/apps/web-garage/messages/{fr,ar-MA,ar,en}.json`
  - `repo/apps/web-garage/components/sky/quick-suggestions-garage.tsx`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Widget integre 4 roles
  - V2 (P0) : Suggestions per role
  - V3 (P0) : Tests 5+ scenarios

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
git commit -m "feat(sprint-31): integration web-garage + role-specific suggestions

Task: 7.3.7
Sprint: 31 (Phase 7 / Sprint 3)
Phase: 7 -- Hardening + Integrations + Pilote
Decisions: see B-31 Tache 7.3.7"
```

---

### Tache 8 / 13 : Integration web-customer-portal + Onboarding Adapted

**Metadonnees** : P0 | 5h | Depend de : Depend de 7.3.7

**But** : Integration web-customer-portal (Sprint 17) + tone friendly + onboarding adapted assure.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-31-agent-sky/task-7.3.8-prompt.md
```

**Actions principales attendues** :
- Integration widget web-customer-portal
- Tone customer-friendly (less technical jargon)
- Quick suggestions :
- Onboarding first-time : popup welcome "Bonjour ! Je suis Sky..." (close-able)
- Restrictions tools : seulement read tools customer-relevant + book_appointment
- I18n + RTL

**Fichiers cibles principaux** :
  - `repo/apps/web-customer-portal/app/[locale]/layout.tsx`
  - `repo/apps/web-customer-portal/messages/{fr,ar-MA,ar,en}.json`
  - `repo/apps/web-customer-portal/components/sky/onboarding-popup.tsx`
  - `repo/apps/web-customer-portal/components/sky/quick-suggestions-customer.tsx`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Widget integre customer
  - V2 (P0) : Tools whitelist customer-context
  - V3 (P0) : Onboarding popup

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
git commit -m "feat(sprint-31): integration web-customer-portal + onboarding adapted

Task: 7.3.8
Sprint: 31 (Phase 7 / Sprint 3)
Phase: 7 -- Hardening + Integrations + Pilote
Decisions: see B-31 Tache 7.3.8"
```

---

### Tache 9 / 13 : Integration web-assure-portal + Suggestions Assure Post-Souscription

**Metadonnees** : P0 | 4h | Depend de : Depend de 7.3.8

**But** : Integration `<SkyChatWidget>` dans web-assure-portal (Sprint 18 desktop) + suggestions assure context (post-souscription self-service) + tools whitelist limit.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-31-agent-sky/task-7.3.8b-prompt.md
```

**Actions principales attendues** :
- Integration : import widget dans `app/[locale]/(protected)/layout.tsx` web-assure-portal
- System prompt assure-context (4 locales fr/ar-MA/ar/en) :
- Quick suggestions web-assure-portal (4 par locale) :
- Tools whitelist assure-context (read-only sur ses propres data) :
- Onboarding popup : "Bienvenue ! Sky vous aide a gerer votre espace assure. Posez vos questions"
- Tests E2E 5+ scenarios

**Fichiers cibles principaux** :
  - `repo/apps/web-assure-portal/app/[locale]/(protected)/layout.tsx`
  - `repo/apps/web-assure-portal/messages/{fr,ar-MA,ar,en}.json`
  - `repo/apps/web-assure-portal/components/sky/quick-suggestions-assure.tsx`
  - `repo/packages/sky/src/prompts/web-assure-portal-{fr,ar-MA,ar,en}.md`
  - `repo/packages/sky/src/tools-whitelist/web-assure-portal.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Widget integre web-assure-portal layout
  - V2 (P0) : Tools whitelist assure-context (read-only own resources)
  - V3 (P0) : Onboarding popup

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
git commit -m "feat(sprint-31): integration web-assure-portal + suggestions assure post-souscript

Task: 7.3.8b
Sprint: 31 (Phase 7 / Sprint 3)
Phase: 7 -- Hardening + Integrations + Pilote
Decisions: see B-31 Tache 7.3.8b"
```

---

### Tache 10 / 13 : Confirmation Modals Write Tools

**Metadonnees** : P0 | 5h | Depend de : Depend de 7.3.8

**But** : Modal confirmation user avant Sky execute write tools (book_appointment, create_quote_draft, send_communication).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-31-agent-sky/task-7.3.9-prompt.md
```

**Actions principales attendues** :
- Quand Sky propose tool write : intercepter dans agent loop -> stream event `requires_confirmation`
- Frontend display modal :
- Si confirme : send confirm event back to backend -> agent execute tool
- Si cancel : agent receives cancel + responds appropriately
- Idempotency-Key generated client-side : eviter double execution si user double-tap
- Audit : confirmation/cancellation logged

**Fichiers cibles principaux** :
  - `repo/packages/sky-ui/src/components/confirmation-modal.tsx`
  - `repo/packages/sky-ui/src/hooks/use-sky-chat.ts`
  - `repo/packages/sky/src/services/agent-loop.service.ts`
  - `repo/apps/api/src/modules/sky/sky.controller.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Modal display
  - V2 (P0) : Confirm/Cancel flow
  - V3 (P0) : Idempotency Key

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
git commit -m "feat(sprint-31): confirmation modals write tools

Task: 7.3.9
Sprint: 31 (Phase 7 / Sprint 3)
Phase: 7 -- Hardening + Integrations + Pilote
Decisions: see B-31 Tache 7.3.9"
```

---

### Tache 11 / 13 : Voice-to-Text + Analytics Dashboard

**Metadonnees** : P0 | 6h | Depend de : Depend de 7.3.9

**But** : Voice-to-text input (Web Speech API) + analytics dashboard Sky usage.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-31-agent-sky/task-7.3.10-prompt.md
```

**Actions principales attendues** :
- Voice-to-text :
- Analytics dashboard `/ai-monitoring/sky-conversations` (super_admin) :
- **ETL ClickHouse Sky analytics (Sprint 13 ETL pattern)** :
- Migration : table `sky_satisfaction_ratings` (conversation_id, rating 1-5, feedback, rated_at)
- Tests : ETL polling + ClickHouse queries + dashboard render

**Fichiers cibles principaux** :
  - `repo/packages/sky-ui/src/components/voice-input-button.tsx`
  - `repo/packages/database/src/migrations/{date}-SkySatisfactionRatings.ts`
  - `repo/packages/sky/src/services/sky-analytics.service.ts`
  - `repo/apps/web-insurtech-admin/app/[locale]/(protected)/ai-monitoring/sky-conversations/page.tsx`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Voice-to-text fr/ar
  - V2 (P0) : Fallback typing
  - V3 (P0) : Analytics dashboard

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
git commit -m "feat(sprint-31): voice-to-text + analytics dashboard

Task: 7.3.10
Sprint: 31 (Phase 7 / Sprint 3)
Phase: 7 -- Hardening + Integrations + Pilote
Decisions: see B-31 Tache 7.3.10"
```

---

### Tache 12 / 13 : Documentation + Onboarding Users + Best Prompts

**Metadonnees** : P0 | 4h | Depend de : Depend de 7.3.10

**But** : Documentation Sky + onboarding guide users + catalog best prompts.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-31-agent-sky/task-7.3.11-prompt.md
```

**Actions principales attendues** :
- Documents :

**Fichiers cibles principaux** :
  - `repo/docs/sky-architecture.md`
  - `repo/docs/sky-user-guide-{broker,garage,customer}.md`
  - `repo/docs/sky-best-prompts-catalog.md`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 5 documents complets
  - V2 (P0) : Prompts catalog 4 langues
  - V3 (P0) : User-friendly guides

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
git commit -m "feat(sprint-31): documentation + onboarding users + best prompts

Task: 7.3.11
Sprint: 31 (Phase 7 / Sprint 3)
Phase: 7 -- Hardening + Integrations + Pilote
Decisions: see B-31 Tache 7.3.11"
```

---

### Tache 13 / 13 : Tests E2E + WCAG + Lighthouse

**Metadonnees** : P0 | 9h | Depend de : Depend de 7.3.11

**But** : Suite tests E2E + WCAG + Lighthouse pour 3 apps integrations.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-31-agent-sky/task-7.3.12-prompt.md
```

**Actions principales attendues** :
- Sky widget integre 3 apps (3)
- Streaming response display (1)
- Tool calling read flow (3 tools tested) (3)
- Confirmation modal write tool (2)
- Voice-to-text input (1)
- Conversation history retrieve (1)

**Fichiers cibles principaux** :
  - `repo/apps/web-broker/e2e/sky/{several specs}.spec.ts`
  - `repo/apps/web-garage/e2e/sky/{several specs}.spec.ts`
  - `repo/apps/web-customer-portal/e2e/sky/{several specs}.spec.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 15+ tests passent 3 apps
  - V2 (P0) : WCAG AA
  - V3 (P0) : Lighthouse green

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
git commit -m "feat(sprint-31): tests e2e + wcag + lighthouse

Task: 7.3.12
Sprint: 31 (Phase 7 / Sprint 3)
Phase: 7 -- Hardening + Integrations + Pilote
Decisions: see B-31 Tache 7.3.12"
```

---


## VERIFICATION DU SPRINT 31

Une fois les 13 taches terminees et commitees, **lancer la verification automatique** :

```bash
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-31-sprint-31-verification.md
```

Le fichier de verification V-31 contient :

- **Criteres P0 bloquants** : compilation TypeScript / tests Vitest / Biome lint / no-emoji / conventional commits
- **Criteres P1 avertissements** : couverture >= 85% / dependencies coherentes / docs API / metriques performance
- **Criteres P2 notes** : coverage >= 90% modules critiques / lighthouse score / accessibility
- **Auto-reparation** pour criteres recuperables (e.g. relance tests flaky)
- **Generation automatique** du rapport `sprint31-verify-report.md`
- **Calcul score global** + statut GO / GO CONDITIONNEL / NO-GO

**Score minimum requis pour GO** : >= 95% (sprint termine, GO Sprint suivant)
**Score minimum pour GO CONDITIONNEL** : 85-94% (hot fix requis, retard <= 1 semaine)
**En dessous de 85%** : NO-GO, **reprise sprint requise** (escalation Saad/Abla decision)

Apres execution, lire le rapport :

```bash
cat skalean-insurtech/sprint31-verify-report.md
```

Si statut **GO** ou **GO CONDITIONNEL**, executer le commit de cloture :

```bash
git add skalean-insurtech/sprint31-verify-report.md
git commit -m "chore(sprint-31): close sprint 31 with verification report

- Score global : {SCORE}%
- Statut : {GO|GO CONDITIONNEL}
- Phase : 7 (Hardening + Integrations + Pilote)
- Sprint : 31 (Phase 7 / Sprint 3)
- Apport : Sky agent multilingue 4 langues 4 apps + voice-to-text
- Tests E2E cumules : {N}+

Sprint 31 completed -- handoff to Sprint 32."
```

---

## RESUME DU WORKFLOW

```
[Demarrage Sprint 31]
   |
   v
[Tache 7.3.1: Backend Sky Orchestrator + MCP Client]
   | -> compile -> tests -> commit
   v
[Tache 7.3.2: System Prompts Multilingues Per App]
   | -> compile -> tests -> commit
   v
[Tache 7.3.3: MCP Tool Calling : Agent Loop]
   | -> compile -> tests -> commit
   v
[Tache 7.3.4: Conversations Persistance]
   | -> compile -> tests -> commit
   v
[Tache 7.3.5: Chat Widget UI Shared Package]
   | -> compile -> tests -> commit
   v
[Tache 7.3.6: Integration web-broker + I18n]
   | -> compile -> tests -> commit
   v
[Tache 7.3.7: Integration web-garage + Role-Specific Suggestions]
   | -> compile -> tests -> commit
   v
[Tache 7.3.8: Integration web-customer-portal + Onboarding Adapted]
   | -> compile -> tests -> commit
   v
[Tache 7.3.8b: Integration web-assure-portal + Suggestions Assure Post]
   | -> compile -> tests -> commit
   v
[Tache 7.3.9: Confirmation Modals Write Tools]
   | -> compile -> tests -> commit
   v
[Tache 7.3.10: Voice-to-Text + Analytics Dashboard]
   | -> compile -> tests -> commit
   v
[Tache 7.3.11: Documentation + Onboarding Users + Best Prompts]
   | -> compile -> tests -> commit
   v
[Tache 7.3.12: Tests E2E + WCAG + Lighthouse]
   | -> compile -> tests -> commit
   v
[Verification automatique sprint 31 -- V-31]
   |
   v
[Rapport sprint31-verify-report.md]
   |
   v
[Score >= 95%] -> GO -> commit cloture sprint -> Sprint suivant
[Score 85-94%] -> GO CONDITIONNEL -> hot fix puis cloture
[Score < 85%]  -> NO-GO -> reprise sprint
```

**Duree totale estimee** : 75 heures (5h par tache moyenne -- 2 devs FTE en parallele).

**Modules skalean-insurtech affectes** : apps/mcp-server, @insurtech/sky, @insurtech/sky-ui, infrastructure (Atlas Cloud Services prod, Cloudflare CDN, K6 chaos)

**Apport metier principal** : Sky agent multilingue 4 langues 4 apps + voice-to-text.

**Prerequis Sprint 32** : Sprint 31 GO complet (score >= 95% verification automatique V-31).

**Sprint suivant** : Sprint 32.

---

## COMMANDES DE LANCEMENT

### Prerequis Sprint 30 (verification GO)

```bash
# Verifier Sprint 30 GO
ls skalean-insurtech/sprint30-verify-report.md
grep '^Statut.*GO' skalean-insurtech/sprint30-verify-report.md
```

### Lancement Sprint 31 (Cowork lit cet orchestrateur)

```bash
# Cowork command (claude-code or cowork CLI) :
claude-code \
  --orchestrator skalean-insurtech/00-pilotage/meta-prompts/phase-C-orchestration/C-31-sprint-31-agent-sky.md \
  --reference-prompt skalean-insurtech/00-pilotage/meta-prompts/phase-B-tasks/B-31-sprint-31-agent-sky.md \
  --verification skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-31-sprint-31-verification.md
```

### Suivi temps reel execution

```bash
# Tail le log Cowork
tail -f skalean-insurtech/cowork-sprint-31.log

# Verifier progression commits
git log --oneline --since="2 weeks ago" -- repo/ | grep "Sprint: 31"
```

### Apres completion -- verifier rapport

```bash
cat skalean-insurtech/sprint31-verify-report.md
```

---

## NOTES IMPORTANTES POUR COWORK

1. **Lire d'abord B-31** complet avant generation prompts taches (contexte critique)
2. **Generer les 13 prompts taches** dans `00-pilotage/prompts-taches/sprint-31-*/` AVANT de commencer execution
3. **Toujours respecter l'ordre** des taches (dependances explicites)
4. **Commit chaque tache separement** (granularite Git pour rollback facile)
5. **NE JAMAIS modifier `00-pilotage/`** -- uniquement `repo/`
6. **En cas de doute**, escalader Saad/Abla via Slack `#insurtech-dev` plutot que faire choix arbitraire
7. **Documentation continue** : si tu prends une decision technique, ajouter ADR dans `repo/docs/architecture/`

---

**Fin de l'orchestrateur C-31 v2.2 detaille -- Sprint 31 (7.3) Agent Sky Multilingue (4 langues -- 4 apps).**

**Total taches detaillees** : 13 | **Effort cumul** : ~75h | **Apport** : Sky agent multilingue 4 langues 4 apps + voice-to-text
