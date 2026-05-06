# ORCHESTRATEUR SPRINT 8 -- Phase 3 / Sprint 1 : CRM + Booking
# 14 taches sequentielles + verification finale
# AUCUNE EMOJI AUTORISEE

**Version** : v2.2 (Option B detaillee)
**Phase** : 3 -- Modules Horizontaux
**Sprint** : 8 / 35 (cumul) -- Sprint 1 dans Phase 3
**Reference meta-prompt** : `B-08-sprint-08-crm-booking.md`
**Reference verification** : `V-08-sprint-08-verification.md`
**Numerotation taches** : 3.1.1 a 3.1.14
**Effort total** : ~75 heures developpement / 2 semaines
**Apport metier** : CRM + Booking operationnels + integrations calendrier

---

Tu es **Claude Code (ou Cowork)**. Tu dois executer **TOUTES les 14 taches** du Sprint 8 **UNE PAR UNE** dans l'ordre defini ci-dessous, puis lancer la verification automatique du sprint.

**Cet orchestrateur extrait le contenu detaille de chaque tache depuis B-08** -- pour code complet, patterns critiques et tests exhaustifs, lire le meta-prompt B-08 reference dans chaque tache.

---

## OBJECTIF DU SPRINT 8

Sprint 8 (3.1) -- CRM + Booking. Voir B-08-sprint-08-crm-booking.md pour contexte detaille.

---

## STRUCTURE DES FICHIERS

**Prompts des taches** (a executer en sequence) :
```
skalean-insurtech/00-pilotage/prompts-taches/sprint-08-crm-booking/
  task-3.1.1-prompt.md       # CRM Companies (Entity + Service + Endpoints + Search)
  task-3.1.2-prompt.md       # CRM Contacts (Entity + Service + Endpoints + Search + Validators)
  task-3.1.3-prompt.md       # CRM Pipelines + Stages
  task-3.1.4-prompt.md       # CRM Deals (Opportunites + Workflow Stages)
  task-3.1.5-prompt.md       # CRM Interactions (Timeline)
  task-3.1.6-prompt.md       # Full-Text Search pg_trgm Cross-CRM
  task-3.1.7-prompt.md       # Custom Fields Dynamic (JSONB + Zod Runtime)
  task-3.1.8-prompt.md       # Booking Rooms
  task-3.1.9-prompt.md       # Booking Appointments + EXCLUDE Constraint
  task-3.1.10-prompt.md       # Booking CalendarSync (OAuth2 Google + Outlook)
  task-3.1.11-prompt.md       # Availability Service (Slots Libres + Business Hours)
  task-3.1.12-prompt.md       # Calendar Sync Bi-Directionnel Google + Outlook
  task-3.1.13-prompt.md       # iCal Feed Export (Token-Based Public URL)
  task-3.1.14-prompt.md       # Tests E2E Exhaustifs (40+) + Seeds Dev
```

**Verification du sprint** (a lancer APRES toutes les taches) :
```
skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-08-sprint-08-verification.md
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
4. La verification finale V-08 identifiera taches FAIL pour reprise ciblee

### Verification finale automatique

APRES avoir execute les 14 taches et commite chacune :
```bash
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-08-sprint-08-verification.md
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

## CONTEXTE PHASE 3 -- Modules Horizontaux

### Position du Sprint 1 dans la Phase 3

Sprint 8 (3.1) -- **CRM + Booking**.

Voir `B-08-sprint-08-crm-booking.md` (section "POSITION DANS LA PHASE" + "DEPENDANCES") pour contexte detaille des dependances cross-sprints (entrees consommees + sorties produites).

### Modules concernes par cette Phase

@insurtech/crm, @insurtech/booking, @insurtech/comm, @insurtech/docs, @insurtech/signature, @insurtech/pay, @insurtech/books, @insurtech/compliance, @insurtech/analytics, @insurtech/stock, @insurtech/hr

### Apport metier de ce sprint

CRM + Booking operationnels + integrations calendrier

### Decisions strategiques applicables

Cf. `00-pilotage/decisions/`. Decisions cles pour ce sprint : voir B-08 section "Decisions strategiques applicables".

---

## EXECUTION SEQUENTIELLE DES 14 TACHES

Chaque tache ci-dessous indique : metadata (priorite/effort/deps), but extrait de B-08, actions principales (livrables checkables), fichiers cibles, criteres P0, validation et commit.

**Pour code complet, patterns critiques, tests exhaustifs** : lire le prompt tache detaille genere depuis B-08.

---

### Tache 1 / 14 : CRM Companies (Entity + Service + Endpoints + Search)

**Metadonnees** : P0 | 5h | Depend de : Depend de Sprint 7

**But** : Premier module metier complet : entity `crm_companies`, service NestJS, endpoints REST CRUD, full-text search trigram. Servira de **template reference** pour modules suivants.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-08-crm-booking/task-3.1.1-prompt.md
```

**Actions principales attendues** :
- Entity `repo/packages/crm/src/entities/crm-company.entity.ts` (Sprint 2 a deja la migration)
- Service `repo/packages/crm/src/services/companies.service.ts` :
- Controller `repo/apps/api/src/modules/crm/controllers/companies.controller.ts` :
- Schema Zod : `CreateCompanySchema`, `UpdateCompanySchema`, `CompanyFiltersSchema`
- Permissions appliquees (Sprint 7) : `crm.companies.create`, `crm.companies.read`, `crm.companies.update`, `crm.companies.delete`
- ICE validation : 15 chiffres regex `/^\d{15}$/` + checksum (algorithme officiel MA)

**Fichiers cibles principaux** :
  - `repo/packages/crm/src/entities/crm-company.entity.ts`
  - `repo/packages/crm/src/services/companies.service.ts`
  - `repo/packages/crm/src/services/companies.service.spec.ts`
  - `repo/packages/crm/src/schemas/company.schema.ts`
  - `repo/packages/crm/src/validators/ice.validator.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : POST cree company + audit + Kafka event
  - V2 (P0) : GET liste avec pagination + filtres
  - V3 (P0) : GET /:id retourne details (ABAC : @owner peut read OK)

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
git commit -m "feat(sprint-08): crm companies (entity + service + endpoints + search)

Task: 3.1.1
Sprint: 8 (Phase 3 / Sprint 1)
Phase: 3 -- Modules Horizontaux
Decisions: see B-08 Tache 3.1.1"
```

---

### Tache 2 / 14 : CRM Contacts (Entity + Service + Endpoints + Search + Validators)

**Metadonnees** : P0 | 6h | Depend de : Depend de 3.1.1

**But** : Module Contacts (personnes physiques) avec validators MA (CIN, phone E.164 +212), preferred language/channel.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-08-crm-booking/task-3.1.2-prompt.md
```

**Actions principales attendues** :
- Entity `crm_contact.entity.ts` (Sprint 2 migration deja appliquee)
- Service `contacts.service.ts` (5 methods CRUD + 1 search)
- Controller `contacts.controller.ts` (5 endpoints REST)
- Schemas Zod : `CreateContactSchema`, `UpdateContactSchema`, `ContactFiltersSchema`
- Validators MA :
- Endpoints :

**Fichiers cibles principaux** :
  - `repo/packages/crm/src/entities/crm-contact.entity.ts`
  - `repo/packages/crm/src/services/contacts.service.ts`
  - `repo/packages/crm/src/schemas/contact.schema.ts`
  - `repo/packages/crm/src/validators/cin.validator.ts`
  - `repo/packages/crm/src/validators/phone-ma.validator.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : CRUD complet operationnel
  - V2 (P0) : CIN invalide rejete (3+ scenarios)
  - V3 (P0) : Phone non-E.164 rejete + suggestion normalisation

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
git commit -m "feat(sprint-08): crm contacts (entity + service + endpoints + search + validators)

Task: 3.1.2
Sprint: 8 (Phase 3 / Sprint 1)
Phase: 3 -- Modules Horizontaux
Decisions: see B-08 Tache 3.1.2"
```

---

### Tache 3 / 14 : CRM Pipelines + Stages

**Metadonnees** : P0 | 5h | Depend de : Depend de 3.1.2

**But** : Pipelines configurables par tenant pour deals workflow (e.g. "Pipeline Auto", "Pipeline Sante", "Pipeline Pro Garage") avec stages personnalisables.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-08-crm-booking/task-3.1.3-prompt.md
```

**Actions principales attendues** :
- Migration TypeORM : tables `crm_pipelines` + `crm_pipeline_stages`
- Entity + service + controller pour pipelines (CRUD)
- Entity + service pour stages (managed via pipeline endpoints)
- Endpoints :
- Validation : pipeline doit avoir AU MOINS 2 stages, AU MOINS 1 terminal_type='won', AU MOINS 1 terminal_type='lost'
- Default stages template : "Lead, Qualified, Proposal, Negotiation, Won, Lost" (cree au tenant onboarding Sprint 6 update)

**Fichiers cibles principaux** :
  - `repo/packages/database/src/migrations/{date}-CrmPipelinesStages.ts`
  - `repo/packages/crm/src/entities/crm-pipeline.entity.ts`
  - `repo/packages/crm/src/entities/crm-pipeline-stage.entity.ts`
  - `repo/packages/crm/src/services/pipelines.service.ts`
  - `repo/packages/crm/src/schemas/pipeline.schema.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : POST cree pipeline + stages atomiquement
  - V2 (P0) : GET retourne pipelines avec stages tries par position
  - V3 (P0) : PATCH reorder stages

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
git commit -m "feat(sprint-08): crm pipelines + stages

Task: 3.1.3
Sprint: 8 (Phase 3 / Sprint 1)
Phase: 3 -- Modules Horizontaux
Decisions: see B-08 Tache 3.1.3"
```

---

### Tache 4 / 14 : CRM Deals (Opportunites + Workflow Stages)

**Metadonnees** : P0 | 6h | Depend de : Depend de 3.1.3

**But** : Deals (opportunites commerciales) avec stage tracking, montant, dates, et workflow stage transitions auditees.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-08-crm-booking/task-3.1.4-prompt.md
```

**Actions principales attendues** :
- Entity `crm_deal.entity.ts` (Sprint 2 migration)
- Service `deals.service.ts` :
- Controller :
- Stage transitions audit : event Kafka `deal.stage_changed` avec `old_stage_id, new_stage_id, reason, user_id`
- Validation amount : numeric 15,2 (>= 0)
- Currency MAD default

**Fichiers cibles principaux** :
  - `repo/packages/crm/src/entities/crm-deal.entity.ts`
  - `repo/packages/crm/src/services/deals.service.ts`
  - `repo/packages/crm/src/schemas/deal.schema.ts`
  - `repo/apps/api/src/modules/crm/controllers/deals.controller.ts`
  - `repo/apps/api/test/crm/deals.e2e-spec.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : CRUD complet deals
  - V2 (P0) : moveToStage transition + audit log + Kafka event
  - V3 (P0) : won/lost shortcut + auto-set won_at/lost_at

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
git commit -m "feat(sprint-08): crm deals (opportunites + workflow stages)

Task: 3.1.4
Sprint: 8 (Phase 3 / Sprint 1)
Phase: 3 -- Modules Horizontaux
Decisions: see B-08 Tache 3.1.4"
```

---

### Tache 5 / 14 : CRM Interactions (Timeline)

**Metadonnees** : P0 | 5h | Depend de : Depend de 3.1.4

**But** : Log toutes les interactions (call, email, whatsapp, meeting, note) avec un contact pour timeline historique. Append-only (pas d'update).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-08-crm-booking/task-3.1.5-prompt.md
```

**Actions principales attendues** :
- Entity `crm_interaction.entity.ts` (Sprint 2 migration)
- Service `interactions.service.ts` :
- Controller :
- Auto-log : event Kafka listeners qui auto-creent interactions :
- Type enum : `'call' | 'email' | 'whatsapp' | 'sms' | 'meeting' | 'note'`
- Direction enum : `'inbound' | 'outbound'`

**Fichiers cibles principaux** :
  - `repo/packages/crm/src/entities/crm-interaction.entity.ts`
  - `repo/packages/crm/src/services/interactions.service.ts`
  - `repo/packages/crm/src/services/interactions-auto-logger.consumer.ts`
  - `repo/packages/crm/src/schemas/interaction.schema.ts`
  - `repo/apps/api/src/modules/crm/controllers/interactions.controller.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : POST manual log fonctionne
  - V2 (P0) : GET timeline contact retourne interactions DESC
  - V3 (P0) : Auto-log via event Kafka comm.message_sent

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
git commit -m "feat(sprint-08): crm interactions (timeline)

Task: 3.1.5
Sprint: 8 (Phase 3 / Sprint 1)
Phase: 3 -- Modules Horizontaux
Decisions: see B-08 Tache 3.1.5"
```

---

### Tache 6 / 14 : Full-Text Search pg_trgm Cross-CRM

**Metadonnees** : P0 | 4h | Depend de : Depend de 3.1.5

**But** : Endpoint search global cross-entities (contacts + companies + deals) utilisant pg_trgm trigram similarity, performant < 100ms.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-08-crm-booking/task-3.1.6-prompt.md
```

**Actions principales attendues** :
- Service `repo/packages/crm/src/services/crm-search.service.ts`
- Endpoint `GET /api/v1/crm/search?q=...&types=contacts,companies,deals&limit=20`
- UNION query Postgres optimise :
- Threshold similarity : 0.3 default (configurable via param)
- Result format : `{ data: [{ type, id, title, score, ...details }] }`
- Performance cible : < 100ms sur 10k contacts + 1k companies + 5k deals

**Fichiers cibles principaux** :
  - `repo/packages/crm/src/services/crm-search.service.ts`
  - `repo/packages/crm/src/schemas/search.schema.ts`
  - `repo/apps/api/src/modules/crm/controllers/search.controller.ts`
  - `repo/apps/api/test/crm/search.e2e-spec.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : GET /search?q=Mohamed retourne resultats trigram
  - V2 (P0) : Resultats triees par score DESC
  - V3 (P0) : Filtre `types=contacts,companies` exclut deals

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
git commit -m "feat(sprint-08): full-text search pg_trgm cross-crm

Task: 3.1.6
Sprint: 8 (Phase 3 / Sprint 1)
Phase: 3 -- Modules Horizontaux
Decisions: see B-08 Tache 3.1.6"
```

---

### Tache 7 / 14 : Custom Fields Dynamic (JSONB + Zod Runtime)

**Metadonnees** : P1 | 5h | Depend de : Depend de 3.1.6

**But** : Support custom fields configurables par tenant sans migration DB : champ JSONB + schema Zod stocke en DB pour validation runtime.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-08-crm-booking/task-3.1.7-prompt.md
```

**Actions principales attendues** :
- Migration : table `custom_field_definitions` (id, tenant_id, entity_type, field_name, field_type, zod_schema_json, required, position, created_at)
- Service `repo/packages/crm/src/services/custom-fields.service.ts` :
- Field types : `'string' | 'number' | 'boolean' | 'date' | 'enum' | 'phone' | 'email'`
- Endpoints :
- Tables CRM (contacts, companies, deals) ont colonne `custom_fields jsonb` (deja prevu Sprint 2)
- Service custom_fields integre dans CRUD CRM : valide custom fields a chaque create/update

**Fichiers cibles principaux** :
  - `repo/packages/database/src/migrations/{date}-CustomFieldsDefinitions.ts`
  - `repo/packages/crm/src/services/custom-fields.service.ts`
  - `repo/packages/crm/src/services/custom-fields.service.spec.ts`
  - `repo/packages/crm/src/entities/custom-field-definition.entity.ts`
  - `repo/apps/api/src/modules/admin/controllers/admin-custom-fields.controller.ts`

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
git commit -m "feat(sprint-08): custom fields dynamic (jsonb + zod runtime)

Task: 3.1.7
Sprint: 8 (Phase 3 / Sprint 1)
Phase: 3 -- Modules Horizontaux
Decisions: see B-08 Tache 3.1.7"
```

---

### Tache 8 / 14 : Booking Rooms

**Metadonnees** : P0 | 3h | Depend de : Depend de 3.1.7

**But** : Module simple Rooms : ressources reservables (salle 1 cabinet, baie atelier garage).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-08-crm-booking/task-3.1.8-prompt.md
```

**Actions principales attendues** :
- Entity `booking_room.entity.ts` (Sprint 2 migration)
- Service `rooms.service.ts` (CRUD basique)
- Controller `rooms.controller.ts` (5 endpoints CRUD)
- Schema Zod
- Permissions : `booking.rooms.create/read/update/delete`
- Champs critiques : name, capacity (int >= 1), location (text), color (hex), active (bool)

**Fichiers cibles principaux** :
  - `repo/packages/booking/src/entities/booking-room.entity.ts`
  - `repo/packages/booking/src/services/rooms.service.ts`
  - `repo/packages/booking/src/schemas/room.schema.ts`
  - `repo/apps/api/src/modules/booking/controllers/rooms.controller.ts`
  - `repo/apps/api/test/booking/rooms.e2e-spec.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : CRUD complete
  - V2 (P0) : Active flag fonctionne (rooms inactives pas listees par defaut)
  - V3 (P0) : Default rooms appliquees au onboarding

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
git commit -m "feat(sprint-08): booking rooms

Task: 3.1.8
Sprint: 8 (Phase 3 / Sprint 1)
Phase: 3 -- Modules Horizontaux
Decisions: see B-08 Tache 3.1.8"
```

---

### Tache 9 / 14 : Booking Appointments + EXCLUDE Constraint

**Metadonnees** : P0 | 6h | Depend de : Depend de 3.1.8

**But** : Appointments avec validation EXCLUDE constraint (anti-overlap room) appliquee runtime + status workflow.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-08-crm-booking/task-3.1.9-prompt.md
```

**Actions principales attendues** :
- Entity `booking_appointment.entity.ts`
- Service `appointments.service.ts` :
- Controller :
- Schema Zod : valide time_range start < end, end - start >= 15min, < 8h
- Catch EXCLUDE constraint violation : retourne 409 Conflict avec details (existing appointment)
- Status workflow : `scheduled -> confirmed -> completed` OR `cancelled` OR `no_show`

**Fichiers cibles principaux** :
  - `repo/packages/booking/src/entities/booking-appointment.entity.ts`
  - `repo/packages/booking/src/services/appointments.service.ts`
  - `repo/packages/booking/src/schemas/appointment.schema.ts`
  - `repo/packages/booking/src/helpers/time-range.helper.ts`
  - `repo/apps/api/src/modules/booking/controllers/appointments.controller.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : POST cree appointment
  - V2 (P0) : POST overlap meme room rejete 409 avec details existing
  - V3 (P0) : POST 2 RDV meme room times non-overlapping OK

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
git commit -m "feat(sprint-08): booking appointments + exclude constraint

Task: 3.1.9
Sprint: 8 (Phase 3 / Sprint 1)
Phase: 3 -- Modules Horizontaux
Decisions: see B-08 Tache 3.1.9"
```

---

### Tache 10 / 14 : Booking CalendarSync (OAuth2 Google + Outlook)

**Metadonnees** : P0 | 5h | Depend de : Depend de 3.1.9

**But** : Setup OAuth2 flow Google Calendar + Microsoft Outlook + stockage tokens chiffres.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-08-crm-booking/task-3.1.10-prompt.md
```

**Actions principales attendues** :
- Service `repo/packages/booking/src/services/calendar-sync.service.ts`
- Methods :
- OAuth scopes :
- Tokens encrypted via EncryptionService Sprint 5 (AES-GCM)
- Endpoints :
- State PKCE : random 32 bytes, stored Redis 10min, validated on callback (CSRF protection)

**Fichiers cibles principaux** :
  - `repo/packages/booking/src/services/calendar-sync.service.ts`
  - `repo/packages/booking/src/services/calendar-sync.service.spec.ts`
  - `repo/packages/booking/src/providers/google-calendar.provider.ts`
  - `repo/packages/booking/src/providers/outlook-calendar.provider.ts`
  - `repo/apps/api/src/modules/booking/controllers/calendar-sync.controller.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : OAuth initiate retourne authUrl + state
  - V2 (P0) : Callback exchange code + store tokens chiffres
  - V3 (P0) : State mismatch rejete (CSRF protection)

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
git commit -m "feat(sprint-08): booking calendarsync (oauth2 google + outlook)

Task: 3.1.10
Sprint: 8 (Phase 3 / Sprint 1)
Phase: 3 -- Modules Horizontaux
Decisions: see B-08 Tache 3.1.10"
```

---

### Tache 11 / 14 : Availability Service (Slots Libres + Business Hours)

**Metadonnees** : P0 | 5h | Depend de : Depend de 3.1.10

**But** : Endpoint retournant slots libres pour reservation (e.g. "show me available slots Monday 14h-17h") -- considere appointments existants + business hours + days off.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-08-crm-booking/task-3.1.11-prompt.md
```

**Actions principales attendues** :
- Service `repo/packages/booking/src/services/availability.service.ts`
- Method `findAvailableSlots(roomId, dateRange, durationMinutes): Slot[]`
- Business hours per tenant : settings `tenant.settings.business_hours = { mon: '09:00-18:00', sat: '09:00-13:00', sun: 'closed' }`
- Days off : holidays nationaux MA (1er Mai, fin ramadan, etc.) configurable
- Slot duration : configurable per request (e.g. 30min, 1h)
- Buffer time : 15min default entre slots (configurable)

**Fichiers cibles principaux** :
  - `repo/packages/booking/src/services/availability.service.ts`
  - `repo/packages/booking/src/services/availability.service.spec.ts`
  - `repo/packages/booking/src/services/holidays.service.ts`
  - `repo/packages/booking/src/data/holidays-ma.json`
  - `repo/apps/api/src/modules/booking/controllers/availability.controller.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Slots libres correct (exclude existing)
  - V2 (P0) : Business hours respectees
  - V3 (P0) : Holidays MA exclus

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
git commit -m "feat(sprint-08): availability service (slots libres + business hours)

Task: 3.1.11
Sprint: 8 (Phase 3 / Sprint 1)
Phase: 3 -- Modules Horizontaux
Decisions: see B-08 Tache 3.1.11"
```

---

### Tache 12 / 14 : Calendar Sync Bi-Directionnel Google + Outlook

**Metadonnees** : P0 | 6h | Depend de : Depend de 3.1.11

**But** : Sync bi-directionnel : appointments Skalean -> calendar provider AND calendar provider events -> Skalean (read-only).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-08-crm-booking/task-3.1.12-prompt.md
```

**Actions principales attendues** :
- Service `repo/packages/booking/src/services/calendar-sync-bidirectional.service.ts`
- Methods :
- Trigger via Kafka events : `booking.appointment_scheduled` -> push, `appointment_updated` -> update, `appointment_cancelled` -> delete
- Storage mapping : table `booking_calendar_event_mappings` (appointment_id, sync_id, provider_event_id, last_synced_at)
- Conflict resolution : skalean is source of truth (provider event modifie -> override avec skalean)
- Pull events : import provider events as read-only "external" appointments (status='external')

**Fichiers cibles principaux** :
  - `repo/packages/booking/src/services/calendar-sync-bidirectional.service.ts`
  - `repo/packages/booking/src/jobs/calendar-pull-events.job.ts`
  - `repo/packages/database/src/migrations/{date}-CalendarEventMappings.ts`
  - `repo/packages/database/src/entities/booking/calendar-event-mapping.entity.ts`
  - `repo/apps/api/test/booking/calendar-sync-bidirectional.e2e-spec.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Create appointment skalean -> push provider OK
  - V2 (P0) : Update -> sync provider
  - V3 (P0) : Cancel -> delete provider event

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
git commit -m "feat(sprint-08): calendar sync bi-directionnel google + outlook

Task: 3.1.12
Sprint: 8 (Phase 3 / Sprint 1)
Phase: 3 -- Modules Horizontaux
Decisions: see B-08 Tache 3.1.12"
```

---

### Tache 13 / 14 : iCal Feed Export (Token-Based Public URL)

**Metadonnees** : P1 | 4h | Depend de : Depend de 3.1.12

**But** : Export feed iCal `.ics` accessible via URL token-based : utilisateur peut subscriber depuis Google/Outlook/Apple Calendar pour vue read-only de ses appointments Skalean.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-08-crm-booking/task-3.1.13-prompt.md
```

**Actions principales attendues** :
- Service `repo/packages/booking/src/services/ical-export.service.ts`
- Method `generateFeed(userId, tenantId): string` -- retourne string iCal valide
- Endpoint `GET /api/v1/booking/ical/:token` (public, no auth, token validation)
- Token : random 32 bytes base64url, stocke dans `auth_users.ical_token` (UNIQUE)
- Endpoint `POST /api/v1/booking/ical/regenerate` (auth required) -- regenerate token (revoke ancien)
- Feed inclut appointments futurs (jusqu'a 90 jours dans futur)

**Fichiers cibles principaux** :
  - `repo/packages/booking/src/services/ical-export.service.ts`
  - `repo/apps/api/src/modules/booking/controllers/ical.controller.ts`
  - `repo/apps/api/test/booking/ical-feed.e2e-spec.ts`

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
git commit -m "feat(sprint-08): ical feed export (token-based public url)

Task: 3.1.13
Sprint: 8 (Phase 3 / Sprint 1)
Phase: 3 -- Modules Horizontaux
Decisions: see B-08 Tache 3.1.13"
```

---

### Tache 14 / 14 : Tests E2E Exhaustifs (40+) + Seeds Dev

**Metadonnees** : P0 | 7h | Depend de : Depend de 3.1.13

**But** : Suite tests E2E couvrant CRM + Booking complet + seeds dev avec data realiste.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-08-crm-booking/task-3.1.14-prompt.md
```

**Actions principales attendues** :
- CRM Companies : 5 tests (CRUD happy + ICE invalid + RBAC reject + multi-tenant + search)
- CRM Contacts : 8 tests (CRUD + CIN + phone E.164 + UNIQUE cin + search trigram + ABAC + preferred_language + interactions count)
- CRM Pipelines + Stages : 4 tests (create avec stages, reorder, validation terminal stages, delete reject if deals)
- CRM Deals : 6 tests (CRUD + moveStage + won + lost + forecast + ABAC owner)
- CRM Interactions : 4 tests (manual log, auto-log via Kafka, timeline, append-only)
- CRM Search : 3 tests (cross-entity, performance, multi-tenant)

**Fichiers cibles principaux** :
  - `repo/apps/api/test/crm/{several specs}.e2e-spec.ts`
  - `repo/apps/api/test/booking/{several specs}.e2e-spec.ts`
  - `repo/infrastructure/scripts/seed-crm-booking.ts`
  - `repo/apps/api/test/fixtures/crm-test-helpers.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 40+ tests passent localement
  - V2 (P0) : Tests passent CI
  - V3 (P0) : Seeds creent data realiste

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
git commit -m "feat(sprint-08): tests e2e exhaustifs (40+) + seeds dev

Task: 3.1.14
Sprint: 8 (Phase 3 / Sprint 1)
Phase: 3 -- Modules Horizontaux
Decisions: see B-08 Tache 3.1.14"
```

---


## VERIFICATION DU SPRINT 8

Une fois les 14 taches terminees et commitees, **lancer la verification automatique** :

```bash
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-08-sprint-08-verification.md
```

Le fichier de verification V-08 contient :

- **Criteres P0 bloquants** : compilation TypeScript / tests Vitest / Biome lint / no-emoji / conventional commits
- **Criteres P1 avertissements** : couverture >= 85% / dependencies coherentes / docs API / metriques performance
- **Criteres P2 notes** : coverage >= 90% modules critiques / lighthouse score / accessibility
- **Auto-reparation** pour criteres recuperables (e.g. relance tests flaky)
- **Generation automatique** du rapport `sprint08-verify-report.md`
- **Calcul score global** + statut GO / GO CONDITIONNEL / NO-GO

**Score minimum requis pour GO** : >= 95% (sprint termine, GO Sprint suivant)
**Score minimum pour GO CONDITIONNEL** : 85-94% (hot fix requis, retard <= 1 semaine)
**En dessous de 85%** : NO-GO, **reprise sprint requise** (escalation Saad/Abla decision)

Apres execution, lire le rapport :

```bash
cat skalean-insurtech/sprint08-verify-report.md
```

Si statut **GO** ou **GO CONDITIONNEL**, executer le commit de cloture :

```bash
git add skalean-insurtech/sprint08-verify-report.md
git commit -m "chore(sprint-08): close sprint 8 with verification report

- Score global : {SCORE}%
- Statut : {GO|GO CONDITIONNEL}
- Phase : 3 (Modules Horizontaux)
- Sprint : 8 (Phase 3 / Sprint 1)
- Apport : CRM + Booking operationnels + integrations calendrier
- Tests E2E cumules : {N}+

Sprint 8 completed -- handoff to Sprint 9."
```

---

## RESUME DU WORKFLOW

```
[Demarrage Sprint 8]
   |
   v
[Tache 3.1.1: CRM Companies (Entity + Service + Endpoints + Search)]
   | -> compile -> tests -> commit
   v
[Tache 3.1.2: CRM Contacts (Entity + Service + Endpoints + Search + V]
   | -> compile -> tests -> commit
   v
[Tache 3.1.3: CRM Pipelines + Stages]
   | -> compile -> tests -> commit
   v
[Tache 3.1.4: CRM Deals (Opportunites + Workflow Stages)]
   | -> compile -> tests -> commit
   v
[Tache 3.1.5: CRM Interactions (Timeline)]
   | -> compile -> tests -> commit
   v
[Tache 3.1.6: Full-Text Search pg_trgm Cross-CRM]
   | -> compile -> tests -> commit
   v
[Tache 3.1.7: Custom Fields Dynamic (JSONB + Zod Runtime)]
   | -> compile -> tests -> commit
   v
[Tache 3.1.8: Booking Rooms]
   | -> compile -> tests -> commit
   v
[Tache 3.1.9: Booking Appointments + EXCLUDE Constraint]
   | -> compile -> tests -> commit
   v
[Tache 3.1.10: Booking CalendarSync (OAuth2 Google + Outlook)]
   | -> compile -> tests -> commit
   v
[Tache 3.1.11: Availability Service (Slots Libres + Business Hours)]
   | -> compile -> tests -> commit
   v
[Tache 3.1.12: Calendar Sync Bi-Directionnel Google + Outlook]
   | -> compile -> tests -> commit
   v
[Tache 3.1.13: iCal Feed Export (Token-Based Public URL)]
   | -> compile -> tests -> commit
   v
[Tache 3.1.14: Tests E2E Exhaustifs (40+) + Seeds Dev]
   | -> compile -> tests -> commit
   v
[Verification automatique sprint 8 -- V-08]
   |
   v
[Rapport sprint08-verify-report.md]
   |
   v
[Score >= 95%] -> GO -> commit cloture sprint -> Sprint suivant
[Score 85-94%] -> GO CONDITIONNEL -> hot fix puis cloture
[Score < 85%]  -> NO-GO -> reprise sprint
```

**Duree totale estimee** : 75 heures (5h par tache moyenne -- 2 devs FTE en parallele).

**Modules skalean-insurtech affectes** : @insurtech/crm, @insurtech/booking, @insurtech/comm, @insurtech/docs, @insurtech/signature, @insurtech/pay, @insurtech/books, @insurtech/compliance, @insurtech/analytics, @insurtech/stock, @insurtech/hr

**Apport metier principal** : CRM + Booking operationnels + integrations calendrier.

**Prerequis Sprint 9** : Sprint 8 GO complet (score >= 95% verification automatique V-08).

**Sprint suivant** : Sprint 9.

---

## COMMANDES DE LANCEMENT

### Prerequis Sprint 7 (verification GO)

```bash
# Verifier Sprint 7 GO
ls skalean-insurtech/sprint07-verify-report.md
grep '^Statut.*GO' skalean-insurtech/sprint07-verify-report.md
```

### Lancement Sprint 8 (Cowork lit cet orchestrateur)

```bash
# Cowork command (claude-code or cowork CLI) :
claude-code \
  --orchestrator skalean-insurtech/00-pilotage/meta-prompts/phase-C-orchestration/C-08-sprint-08-crm-booking.md \
  --reference-prompt skalean-insurtech/00-pilotage/meta-prompts/phase-B-tasks/B-08-sprint-08-crm-booking.md \
  --verification skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-08-sprint-08-verification.md
```

### Suivi temps reel execution

```bash
# Tail le log Cowork
tail -f skalean-insurtech/cowork-sprint-08.log

# Verifier progression commits
git log --oneline --since="2 weeks ago" -- repo/ | grep "Sprint: 8"
```

### Apres completion -- verifier rapport

```bash
cat skalean-insurtech/sprint08-verify-report.md
```

---

## NOTES IMPORTANTES POUR COWORK

1. **Lire d'abord B-08** complet avant generation prompts taches (contexte critique)
2. **Generer les 14 prompts taches** dans `00-pilotage/prompts-taches/sprint-08-*/` AVANT de commencer execution
3. **Toujours respecter l'ordre** des taches (dependances explicites)
4. **Commit chaque tache separement** (granularite Git pour rollback facile)
5. **NE JAMAIS modifier `00-pilotage/`** -- uniquement `repo/`
6. **En cas de doute**, escalader Saad/Abla via Slack `#insurtech-dev` plutot que faire choix arbitraire
7. **Documentation continue** : si tu prends une decision technique, ajouter ADR dans `repo/docs/architecture/`

---

**Fin de l'orchestrateur C-08 v2.2 detaille -- Sprint 8 (3.1) CRM + Booking.**

**Total taches detaillees** : 14 | **Effort cumul** : ~75h | **Apport** : CRM + Booking operationnels + integrations calendrier
