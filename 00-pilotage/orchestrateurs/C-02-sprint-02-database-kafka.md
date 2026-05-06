# ORCHESTRATEUR SPRINT 2 -- Phase 1 / Sprint 2 : Database + Kafka
# 15 taches sequentielles + verification finale
# AUCUNE EMOJI AUTORISEE

**Version** : v2.2 (Option B detaillee)
**Phase** : 1 -- Bootstrap Infrastructure
**Sprint** : 2 / 35 (cumul) -- Sprint 2 dans Phase 1
**Reference meta-prompt** : `B-02-sprint-02-database-kafka.md`
**Reference verification** : `V-02-sprint-02-verification.md`
**Numerotation taches** : 1.2.1 a 1.2.15
**Effort total** : ~80 heures developpement / 2 semaines
**Apport metier** : Schema 32 tables + 30+ topics Kafka + seeds dev complete

---

Tu es **Claude Code (ou Cowork)**. Tu dois executer **TOUTES les 15 taches** du Sprint 2 **UNE PAR UNE** dans l'ordre defini ci-dessous, puis lancer la verification automatique du sprint.

**Cet orchestrateur extrait le contenu detaille de chaque tache depuis B-02** -- pour code complet, patterns critiques et tests exhaustifs, lire le meta-prompt B-02 reference dans chaque tache.

---

## OBJECTIF DU SPRINT 2

Sprint 2 (1.2) -- Database + Kafka. Voir B-02-sprint-02-database-kafka.md pour contexte detaille.

---

## STRUCTURE DES FICHIERS

**Prompts des taches** (a executer en sequence) :
```
skalean-insurtech/00-pilotage/prompts-taches/sprint-02-database-kafka/
  task-1.2.1-prompt.md       # Enrichir @insurtech/database
  task-1.2.2-prompt.md       # Migration "Initial System" : 5 Tables (Auth + Audit Log) + RLS
  task-1.2.3-prompt.md       # Migration "CRM" : 4 Tables + RLS + Indexes Trigram
  task-1.2.4-prompt.md       # Migration "Booking" : 3 Tables + EXCLUDE Constraint
  task-1.2.5-prompt.md       # Migration "Communications" : 4 Tables
  task-1.2.6-prompt.md       # Migration "Docs + Pay" : 6 Tables
  task-1.2.7-prompt.md       # Migration "Books + Compliance" : 6 Tables
  task-1.2.8-prompt.md       # Migration "Analytics + Stock + HR" : 5 Tables
  task-1.2.9-prompt.md       # TypeORM Subscribers : 3 Transverses
  task-1.2.10-prompt.md       # Topics Kafka Enrichi : 50+ Topics
  task-1.2.11-prompt.md       # Init @insurtech/shared-events : Topics enum + Zod schemas + types
  task-1.2.12-prompt.md       # KafkaPublisher Service NestJS
  task-1.2.13-prompt.md       # KafkaConsumerBase Abstract Class
  task-1.2.14-prompt.md       # Seeds Dev Exhaustifs
  task-1.2.15-prompt.md       # Tests Integration : Migrations + RLS + Kafka End-to-End
```

**Verification du sprint** (a lancer APRES toutes les taches) :
```
skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-02-sprint-02-verification.md
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
4. La verification finale V-02 identifiera taches FAIL pour reprise ciblee

### Verification finale automatique

APRES avoir execute les 15 taches et commite chacune :
```bash
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-02-sprint-02-verification.md
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

## CONTEXTE PHASE 1 -- Bootstrap Infrastructure

### Position du Sprint 2 dans la Phase 1

Sprint 2 (1.2) -- **Database + Kafka**.

Voir `B-02-sprint-02-database-kafka.md` (section "POSITION DANS LA PHASE" + "DEPENDANCES") pour contexte detaille des dependances cross-sprints (entrees consommees + sorties produites).

### Modules concernes par cette Phase

@insurtech/database, @insurtech/shared-config, @insurtech/shared-utils, infrastructure/docker, infrastructure/scripts

### Apport metier de ce sprint

Schema 32 tables + 30+ topics Kafka + seeds dev complete

### Decisions strategiques applicables

Cf. `00-pilotage/decisions/`. Decisions cles pour ce sprint : voir B-02 section "Decisions strategiques applicables".

---

## EXECUTION SEQUENTIELLE DES 15 TACHES

Chaque tache ci-dessous indique : metadata (priorite/effort/deps), but extrait de B-02, actions principales (livrables checkables), fichiers cibles, criteres P0, validation et commit.

**Pour code complet, patterns critiques, tests exhaustifs** : lire le prompt tache detaille genere depuis B-02.

---

### Tache 1 / 15 : Enrichir @insurtech/database

**Metadonnees** : P0 | 6h | Depend de : Depend de Sprint 1

**But** : Etendre le package `database` avec structure d'entities, infrastructure migrations, scripts CLI, et helpers transactionnels pour multi-tenant.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-02-database-kafka/task-1.2.1-prompt.md
```

**Actions principales attendues** :
- `repo/packages/database/src/entities/` structure par module : `system/`, `crm/`, `booking/`, `comm/`, `docs/`, `pay/`, `books/`, `compliance/`, `analytics/`
- `repo/packages/database/src/entities/base/base-entity.ts` -- abstract class avec id (UUID gen_random_uuid), tenant_id (uuid), created_at, updated_at, deleted_at (soft delete)
- `repo/packages/database/src/entities/base/auditable-entity.ts` -- extends BaseEntity + created_by, updated_by (uuid users)
- `repo/packages/database/src/migrations/` dossier structure
- `repo/packages/database/src/subscribers/` dossier (peuple Tache 1.2.9)
- `repo/packages/database/src/helpers/with-tenant-context.ts` -- wrapper executant query avec `SET LOCAL app.current_tenant_id`

**Fichiers cibles principaux** :
  - `repo/packages/database/package.json`
  - `repo/packages/database/src/entities/base/base-entity.ts`
  - `repo/packages/database/src/entities/base/auditable-entity.ts`
  - `repo/packages/database/src/entities/base/index.ts`
  - `repo/packages/database/src/entities/{9 dossiers modules}/`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Structure dossiers entities/migrations/subscribers/helpers presente
  - V2 (P0) : `BaseEntity` abstract avec id, tenant_id, timestamps, soft delete
  - V3 (P0) : `AuditableEntity` extends BaseEntity + created_by + updated_by

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
git commit -m "feat(sprint-02): enrichir @insurtech/database

Task: 1.2.1
Sprint: 2 (Phase 1 / Sprint 2)
Phase: 1 -- Bootstrap Infrastructure
Decisions: see B-02 Tache 1.2.1"
```

---

### Tache 2 / 15 : Migration "Initial System" : 5 Tables (Auth + Audit Log) + RLS

**Metadonnees** : P0 | 8h | Depend de : Depend de 1.2.1

**But** : Creer 5 tables fondatrices (auth_tenants, auth_users, auth_tenant_users, auth_sessions, audit_log) avec RLS policies multi-tenant 3 niveaux activees.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-02-database-kafka/task-1.2.2-prompt.md
```

**Actions principales attendues** :
- Migration `1735000000001-InitialSystem.ts` (timestamp + nom)
- Table `auth_tenants` : id (uuid PK), name (text NOT NULL), type (enum 'broker' | 'garage' | 'mixed'), settings (jsonb), created_at, updated_at, deleted_at
- Table `auth_users` : id (uuid PK), tenant_id (uuid FK auth_tenants -- NULL si SuperAdmin platform), email (citext UNIQUE), password_hash (text), display_name, mfa_enabled (bool), mfa_secret_encrypt...
- Table `auth_tenant_users` (jonction many-to-many users x tenants car SuperAdmin peut acceder plusieurs) : tenant_id, user_id, role (text), permissions (jsonb), created_at
- Table `auth_sessions` : id (uuid PK), user_id (FK), tenant_id (FK), refresh_token_hash (text UNIQUE), user_agent (text), ip_address (inet), created_at, expires_at, revoked_at
- Table `audit_log` : id (uuid PK), tenant_id, user_id (NULL si systeme), action (text), resource_type (text), resource_id (uuid), changes (jsonb -- before/after), ip_address (inet), user_agent (text...

**Fichiers cibles principaux** :
  - `repo/packages/database/src/migrations/1735000000001-InitialSystem.ts`
  - `repo/packages/database/src/entities/system/auth-tenant.entity.ts`
  - `repo/packages/database/src/entities/system/auth-user.entity.ts`
  - `repo/packages/database/src/entities/system/auth-tenant-user.entity.ts`
  - `repo/packages/database/src/entities/system/auth-session.entity.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : `pnpm migration:run` reussit sans erreur
  - V2 (P0) : 5 tables creees : `\dt auth_*` + `\dt audit_log`
  - V3 (P0) : RLS active sur 4 tables : `SELECT relname FROM pg_class WHERE relrowsecurity = true`

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
git commit -m "feat(sprint-02): migration initial system : 5 tables (auth + audit log) + rls

Task: 1.2.2
Sprint: 2 (Phase 1 / Sprint 2)
Phase: 1 -- Bootstrap Infrastructure
Decisions: see B-02 Tache 1.2.2"
```

---

### Tache 3 / 15 : Migration "CRM" : 4 Tables + RLS + Indexes Trigram

**Metadonnees** : P0 | 6h | Depend de : Depend de 1.2.2

**But** : Creer les 4 tables CRM (companies, contacts, deals, interactions) avec RLS et indexes trigram pour full-text search.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-02-database-kafka/task-1.2.3-prompt.md
```

**Actions principales attendues** :
- Migration `1735000000002-CRM.ts`
- Table `crm_companies` : id, tenant_id (FK), name, industry, ice (text -- Identifiant Commun de l'Entreprise MA, format 15 chiffres), rc (text -- Registre Commerce), patente, address, city, country,...
- Table `crm_contacts` : id, tenant_id (FK), company_id (FK NULL si independant), first_name, last_name, full_name (computed), email (citext), phone, cin (text -- Carte Identite Nationale, format 6 c...
- Table `crm_deals` : id, tenant_id (FK), contact_id (FK), company_id (FK NULL), title, stage (enum 'lead' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost'), amount_dirham (numeric 15,2), ...
- Table `crm_interactions` : id, tenant_id (FK), contact_id (FK), deal_id (FK NULL), type (enum 'call' | 'email' | 'whatsapp' | 'meeting' | 'note'), direction (enum 'inbound' | 'outbound'), subject, ...
- RLS active sur 4 tables (toutes ont tenant_id)

**Fichiers cibles principaux** :
  - `repo/packages/database/src/migrations/1735000000002-CRM.ts`
  - `repo/packages/database/src/entities/crm/crm-company.entity.ts`
  - `repo/packages/database/src/entities/crm/crm-contact.entity.ts`
  - `repo/packages/database/src/entities/crm/crm-deal.entity.ts`
  - `repo/packages/database/src/entities/crm/crm-interaction.entity.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Migration up reussit
  - V2 (P0) : 4 tables creees avec colonnes specifiees
  - V3 (P0) : RLS active sur les 4 tables

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
git commit -m "feat(sprint-02): migration crm : 4 tables + rls + indexes trigram

Task: 1.2.3
Sprint: 2 (Phase 1 / Sprint 2)
Phase: 1 -- Bootstrap Infrastructure
Decisions: see B-02 Tache 1.2.3"
```

---

### Tache 4 / 15 : Migration "Booking" : 3 Tables + EXCLUDE Constraint

**Metadonnees** : P0 | 5h | Depend de : Depend de 1.2.3

**But** : Creer 3 tables Booking (rooms, appointments, calendar_syncs) avec contrainte EXCLUDE Postgres anti-overlap pour eviter double-booking.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-02-database-kafka/task-1.2.4-prompt.md
```

**Actions principales attendues** :
- Migration `1735000000003-Booking.ts`
- Table `booking_rooms` : id, tenant_id (FK), name, capacity (int), location (text), color (text -- hex), active (bool default true), created_at, updated_at, deleted_at
- Table `booking_appointments` : id, tenant_id (FK), room_id (FK), contact_id (FK crm_contacts), assigned_user_id (FK auth_users), title, description, time_range (tstzrange -- type Postgres), status ...
- Table `booking_calendar_syncs` : id, tenant_id (FK), user_id (FK), provider (enum 'google' | 'outlook' | 'caldav'), provider_account_id, access_token_encrypted, refresh_token_encrypted, last_sync_a...
- **EXCLUDE constraint** sur `booking_appointments` : pas deux RDV meme room avec time_range overlap
- RLS active sur 3 tables

**Fichiers cibles principaux** :
  - `repo/packages/database/src/migrations/1735000000003-Booking.ts`
  - `repo/packages/database/src/entities/booking/booking-room.entity.ts`
  - `repo/packages/database/src/entities/booking/booking-appointment.entity.ts`
  - `repo/packages/database/src/entities/booking/booking-calendar-sync.entity.ts`
  - `repo/packages/database/src/entities/booking/index.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Migration up reussit, tables creees
  - V2 (P0) : EXCLUDE constraint actif : `\d booking_appointments` montre `EXCLUDE USING GIST`
  - V3 (P0) : Test anti-overlap : INSERT 2 RDV meme room time chevauchant -> 2eme rejete

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
git commit -m "feat(sprint-02): migration booking : 3 tables + exclude constraint

Task: 1.2.4
Sprint: 2 (Phase 1 / Sprint 2)
Phase: 1 -- Bootstrap Infrastructure
Decisions: see B-02 Tache 1.2.4"
```

---

### Tache 5 / 15 : Migration "Communications" : 4 Tables

**Metadonnees** : P0 | 5h | Depend de : Depend de 1.2.4

**But** : Creer 4 tables (messages, templates, opt-outs, webhooks_received) supportant WhatsApp + Email + SMS multilingue (fr / ar-MA / ar).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-02-database-kafka/task-1.2.5-prompt.md
```

**Actions principales attendues** :
- Migration `1735000000004-Communications.ts`
- Table `comm_messages` : id, tenant_id (FK), contact_id (FK NULL si broadcast), channel (enum 'whatsapp' | 'email' | 'sms' | 'voice'), direction (enum 'inbound' | 'outbound'), to_address (text -- em...
- Table `comm_templates` : id, tenant_id (FK), name, channel (enum), category (enum 'marketing' | 'transactional' | 'reminder'), language (enum 'fr' | 'ar-MA' | 'ar'), subject_template (NULL si SMS/W...
- Table `comm_optouts` : id, tenant_id (FK), contact_id (FK), channel (enum), optout_at, reason (text NULL), created_by_contact (bool -- user a click unsubscribe vs admin a opt-out)
- Table `comm_webhooks_received` : id, tenant_id (NULL si webhook public not yet routed), provider (text), event_type (text), payload (jsonb), signature_valid (bool), processed_at, processed_status (...
- RLS active sur comm_messages, comm_templates, comm_optouts (tenant_id present)

**Fichiers cibles principaux** :
  - `repo/packages/database/src/migrations/1735000000004-Communications.ts`
  - `repo/packages/database/src/entities/comm/comm-message.entity.ts`
  - `repo/packages/database/src/entities/comm/comm-template.entity.ts`
  - `repo/packages/database/src/entities/comm/comm-optout.entity.ts`
  - `repo/packages/database/src/entities/comm/comm-webhook-received.entity.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Migration up reussit
  - V2 (P0) : 4 tables creees
  - V3 (P0) : RLS active sur 3 tables (pas webhooks_received)

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
git commit -m "feat(sprint-02): migration communications : 4 tables

Task: 1.2.5
Sprint: 2 (Phase 1 / Sprint 2)
Phase: 1 -- Bootstrap Infrastructure
Decisions: see B-02 Tache 1.2.5"
```

---

### Tache 6 / 15 : Migration "Docs + Pay" : 6 Tables

**Metadonnees** : P0 | 6h | Depend de : Depend de 1.2.5

**But** : Creer 3 tables Docs (documents, versions, access logs) + 3 tables Pay (transactions, methods, reconciliation).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-02-database-kafka/task-1.2.6-prompt.md
```

**Actions principales attendues** :
- Table `doc_documents` : id, tenant_id (FK), type (enum 'police' | 'devis' | 'facture' | 'sinistre' | 'kyc' | 'contrat' | 'autre'), title, description, related_resource_type, related_resource_id (uu...
- Table `doc_versions` : id, document_id (FK), version_number (int), s3_key, size_bytes, sha256, change_summary, created_by, created_at -- **append-only**
- Table `doc_access_logs` : id, document_id (FK), user_id (FK auth_users NULL si anonymous via presigned URL), action (enum 'view' | 'download' | 'share'), ip_address, user_agent, created_at -- **app...
- Table `pay_methods` : id, tenant_id (FK), name, provider (enum 'cmi' | 'youcan' | 'payzone' | 'm_wallet_inwi' | 'm_wallet_orange' | 'm_wallet_iam' | 'cash' | 'cheque' | 'virement'), config_encrypte...
- Table `pay_transactions` : id, tenant_id (FK), pay_method_id (FK), related_resource_type, related_resource_id, amount_dirham (numeric 15,2), currency (default 'MAD'), status (enum 'initiated' | 'pe...
- Table `pay_reconciliation` : id, tenant_id (FK), transaction_id (FK), bank_statement_ref, reconciled_at, reconciled_by, status (enum 'matched' | 'unmatched' | 'discrepancy'), discrepancy_amount, no...

**Fichiers cibles principaux** :
  - `repo/packages/database/src/migrations/1735000000005-DocsPayments.ts`
  - `repo/packages/database/src/entities/docs/{3 entities}.ts`
  - `repo/packages/database/src/entities/pay/{3 entities}.ts`
  - `repo/packages/database/src/entities/{docs,pay}/index.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Migration up reussit, 6 tables creees
  - V2 (P0) : RLS active sur 6 tables
  - V3 (P0) : UNIQUE (document_id, version_number) actif

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
git commit -m "feat(sprint-02): migration docs + pay : 6 tables

Task: 1.2.6
Sprint: 2 (Phase 1 / Sprint 2)
Phase: 1 -- Bootstrap Infrastructure
Decisions: see B-02 Tache 1.2.6"
```

---

### Tache 7 / 15 : Migration "Books + Compliance" : 6 Tables

**Metadonnees** : P0 | 6h | Depend de : Depend de 1.2.6

**But** : Creer 3 tables Books (factures, comptes, ecritures) + 3 tables Compliance (audits, declarations ACAPS, retention).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-02-database-kafka/task-1.2.7-prompt.md
```

**Actions principales attendues** :
- Table `books_invoices` : id, tenant_id (FK), invoice_number (text -- format YYYY-NNNNN), type (enum 'invoice' | 'credit_note' | 'proforma'), customer_name, customer_ice, customer_address, issue_dat...
- Table `books_invoice_lines` : id, invoice_id (FK), description, quantity, unit_price_ht, total_ht, tva_rate, sort_order
- Table `books_accounts` : id, tenant_id (FK), account_number (text -- plan comptable MA), name, type (enum 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'), parent_account_id (FK NULL self-...
- Table `compliance_acaps_reports` : id, tenant_id (FK), period_start, period_end, report_type (enum 'monthly_production' | 'quarterly_sinistralite' | 'annual_solvency'), status (enum 'draft' | 'subm...
- Table `compliance_data_retention_policies` : id, tenant_id (FK), resource_type (text), retention_days (int), legal_basis (text -- ex 'ACAPS Article 12 retention 7 ans'), created_at, updated_at
- Table `compliance_consent_logs` : id, tenant_id (FK), contact_id (FK), consent_type (enum 'cnic_processing' | 'data_marketing' | 'data_third_party'), consent_given (bool), consent_method (enum 'web...

**Fichiers cibles principaux** :
  - `repo/packages/database/src/migrations/1735000000006-BooksCompliance.ts`
  - `repo/packages/database/src/entities/books/{3 entities}.ts`
  - `repo/packages/database/src/entities/compliance/{3 entities}.ts`
  - `repo/packages/database/src/entities/{books,compliance}/index.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Migration up reussit, 6 tables creees
  - V2 (P0) : RLS active sur 6 tables
  - V3 (P0) : UNIQUE (tenant_id, invoice_number) actif

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
git commit -m "feat(sprint-02): migration books + compliance : 6 tables

Task: 1.2.7
Sprint: 2 (Phase 1 / Sprint 2)
Phase: 1 -- Bootstrap Infrastructure
Decisions: see B-02 Tache 1.2.7"
```

---

### Tache 8 / 15 : Migration "Analytics + Stock + HR" : 5 Tables

**Metadonnees** : P0 | 5h | Depend de : Depend de 1.2.7

**But** : Creer 5 tables (analytics_events, stock_items, stock_movements, hr_employees, hr_attendance).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-02-database-kafka/task-1.2.8-prompt.md
```

**Actions principales attendues** :
- Table `analytics_events` : id, tenant_id (FK), event_name (text -- ex 'police_souscrite', 'sinistre_declare'), user_id (FK NULL), session_id, properties (jsonb), occurred_at, created_at -- **append...
- Table `stock_items` : id, tenant_id (FK), sku (text -- code interne), name, description, category, unit (enum 'unit' | 'liter' | 'kg' | 'meter'), unit_price_ht (numeric 15,2), tva_rate, current_qua...
- Table `stock_movements` : id, tenant_id (FK), item_id (FK), movement_type (enum 'in' | 'out' | 'adjustment' | 'inventory'), quantity (numeric 15,3 -- positive in/out direction in type), unit_price_...
- Table `hr_employees` : id, tenant_id (FK), user_id (FK auth_users NULL si pas d'acces app), full_name, role (enum 'mecanicien' | 'tolier' | 'peintre' | 'chef_atelier' | 'expert' | 'comptable' | 'co...
- Table `hr_attendance` : id, tenant_id (FK), employee_id (FK), check_in_at (timestamptz), check_out_at (timestamptz NULL), break_minutes (int default 0), notes, created_at -- **append-only**
- RLS active sur 5 tables

**Fichiers cibles principaux** :
  - `repo/packages/database/src/migrations/1735000000007-AnalyticsStockHR.ts`
  - `repo/packages/database/src/entities/analytics/analytics-event.entity.ts`
  - `repo/packages/database/src/entities/stock/{2 entities}.ts`
  - `repo/packages/database/src/entities/hr/{2 entities}.ts`
  - `repo/packages/database/src/entities/{analytics,stock,hr}/index.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Migration up reussit, 5 tables creees
  - V2 (P0) : RLS active
  - V3 (P0) : UNIQUE constraints actifs (sku, employee_number)

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
git commit -m "feat(sprint-02): migration analytics + stock + hr : 5 tables

Task: 1.2.8
Sprint: 2 (Phase 1 / Sprint 2)
Phase: 1 -- Bootstrap Infrastructure
Decisions: see B-02 Tache 1.2.8"
```

---

### Tache 9 / 15 : TypeORM Subscribers : 3 Transverses

**Metadonnees** : P0 | 5h | Depend de : Depend de 1.2.8

**But** : Implementer 3 subscribers TypeORM globaux qui s'executent automatiquement sur tous les events DB : injection tenant_id, ecriture audit log, gestion timestamps.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-02-database-kafka/task-1.2.9-prompt.md
```

**Actions principales attendues** :
- `repo/packages/database/src/subscribers/tenant-id-injector.subscriber.ts`
- Implements `EntitySubscriberInterface` TypeORM
- Hook `beforeInsert(event)` : si entity etend BaseEntity et tenant_id manquant, lit `app_current_tenant()` via query SQL et injecte
- Throw error si tenant_id manquant ET pas de current_tenant set ET pas super admin (mode strict)
- Whitelist tables systeme exemptees : `auth_tenants`, `audit_log` (gerees specifiquement)
- `repo/packages/database/src/subscribers/audit-log-writer.subscriber.ts`

**Fichiers cibles principaux** :
  - `repo/packages/database/src/subscribers/tenant-id-injector.subscriber.ts`
  - `repo/packages/database/src/subscribers/audit-log-writer.subscriber.ts`
  - `repo/packages/database/src/subscribers/timestamps-injector.subscriber.ts`
  - `repo/packages/database/src/subscribers/index.ts`
  - `repo/packages/database/src/subscribers/audit-log-writer.spec.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 3 subscribers enregistres dans DataSource
  - V2 (P0) : INSERT sans tenant context throw error (sauf super admin)
  - V3 (P0) : INSERT avec tenant context auto-injecte tenant_id

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
git commit -m "feat(sprint-02): typeorm subscribers : 3 transverses

Task: 1.2.9
Sprint: 2 (Phase 1 / Sprint 2)
Phase: 1 -- Bootstrap Infrastructure
Decisions: see B-02 Tache 1.2.9"
```

---

### Tache 10 / 15 : Topics Kafka Enrichi : 50+ Topics

**Metadonnees** : P0 | 4h | Depend de : Depend de 1.2.9

**But** : Etendre le script `init-topics.sh` Sprint 1 (30 topics) pour atteindre 50+ topics couvrant tous les events documentes Sprint 2 et Sprints futurs (anticipation).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-02-database-kafka/task-1.2.10-prompt.md
```

**Actions principales attendues** :
- Script `repo/infrastructure/docker/kafka/init-topics.sh` enrichi
- Topics Auth (7) -- deja Sprint 1
- Topics CRM (5) -- deja Sprint 1, ajouter `interaction_email_received` (6 part)
- Topics Booking (3) -- deja Sprint 1
- Topics Comm (3) -- deja Sprint 1, ajouter : `template_created`, `template_approved`, `template_rejected`, `optout_recorded`, `webhook_received` (6 part)
- Topics Pay (4) -- deja Sprint 1, ajouter : `reconciliation_matched`, `reconciliation_discrepancy`

**Fichiers cibles principaux** :
  - `repo/infrastructure/docker/kafka/init-topics.sh`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Script execute sans erreur (incluant re-execution)
  - V2 (P0) : Total topics >= 50
  - V3 (P0) : Naming convention respectee

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
git commit -m "feat(sprint-02): topics kafka enrichi : 50+ topics

Task: 1.2.10
Sprint: 2 (Phase 1 / Sprint 2)
Phase: 1 -- Bootstrap Infrastructure
Decisions: see B-02 Tache 1.2.10"
```

---

### Tache 11 / 15 : Init @insurtech/shared-events : Topics enum + Zod schemas + types

**Metadonnees** : P0 | 6h | Depend de : Depend de 1.2.10

**But** : Centraliser les noms topics, schemas Zod des events, types TypeScript inferes, et helpers (build event id, etc.) dans un package partage par tous les producteurs et consommateurs.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-02-database-kafka/task-1.2.11-prompt.md
```

**Actions principales attendues** :
- Package `repo/packages/shared-events/` avec `package.json`, `tsconfig.json`, `src/`
- `src/topics.ts` exposant enum `Topics` avec tous les topics (50+)
- `src/schemas/auth/` -- 7 schemas Zod (un par event auth)
- `src/schemas/crm/` -- 6 schemas Zod
- `src/schemas/booking/` -- 3 schemas Zod
- `src/schemas/comm/` -- 8 schemas Zod

**Fichiers cibles principaux** :
  - `repo/packages/shared-events/package.json`
  - `repo/packages/shared-events/tsconfig.json`
  - `repo/packages/shared-events/src/topics.ts`
  - `repo/packages/shared-events/src/types/event-envelope.ts`
  - `repo/packages/shared-events/src/schemas/{12 dossiers}/{50+ schemas .schema.ts}`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Package build reussit
  - V2 (P0) : `Topics` enum exporte 50+ valeurs
  - V3 (P0) : 50+ schemas Zod presents et valides

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
git commit -m "feat(sprint-02): init @insurtech/shared-events : topics enum + zod schemas + types

Task: 1.2.11
Sprint: 2 (Phase 1 / Sprint 2)
Phase: 1 -- Bootstrap Infrastructure
Decisions: see B-02 Tache 1.2.11"
```

---

### Tache 12 / 15 : KafkaPublisher Service NestJS

**Metadonnees** : P0 | 5h | Depend de : Depend de 1.2.11

**But** : Service NestJS reutilisable publiant events vers Kafka avec validation Zod automatique, idempotency, retry exponential, et circuit breaker.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-02-database-kafka/task-1.2.12-prompt.md
```

**Actions principales attendues** :
- Service NestJS `repo/packages/shared-events/src/publisher/kafka-publisher.service.ts`
- Methode `publish<T>(topic: Topics, payload: T, options?: PublishOptions): Promise<void>`
- Validation Zod automatique avant envoi : si payload invalide, throw `InvalidEventError`
- Construction enveloppe : event_id (ULID), event_name (depuis topic mapping), event_version (depuis schema), occurred_at (NOW), tenant_id (depuis context si dispo), correlation_id (depuis context si...
- Idempotency : `event_id` unique permet deduplication consumers (key = ULID)
- Partition key : `tenant_id` pour preserver ordering per-tenant

**Fichiers cibles principaux** :
  - `repo/packages/shared-events/src/publisher/kafka-publisher.service.ts`
  - `repo/packages/shared-events/src/publisher/kafka-publisher.module.ts`
  - `repo/packages/shared-events/src/publisher/errors.ts`
  - `repo/packages/shared-events/src/publisher/kafka-publisher.service.spec.ts`
  - `repo/packages/shared-events/package.json`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Service publie evenement vers Kafka reel (test integration)
  - V2 (P0) : Payload invalide rejete par Zod avant envoi
  - V3 (P0) : event_id genere (ULID valide)

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
git commit -m "feat(sprint-02): kafkapublisher service nestjs

Task: 1.2.12
Sprint: 2 (Phase 1 / Sprint 2)
Phase: 1 -- Bootstrap Infrastructure
Decisions: see B-02 Tache 1.2.12"
```

---

### Tache 13 / 15 : KafkaConsumerBase Abstract Class

**Metadonnees** : P0 | 6h | Depend de : Depend de 1.2.12

**But** : Classe abstraite NestJS reutilisable pour ecrire consumers Kafka avec manual ack, validation Zod automatique, retry exponential, DLQ, et idempotency check.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-02-database-kafka/task-1.2.13-prompt.md
```

**Actions principales attendues** :
- Classe abstraite `repo/packages/shared-events/src/consumer/kafka-consumer.base.ts`
- Method abstract `handle(payload: T, envelope: EventEnvelope<T>): Promise<void>` -- override par consumer concret
- Method abstract `getTopic(): Topics` -- override pour declarer topic ecoute
- Method abstract `getGroupId(): string` -- override pour group consumer (e.g. `notifications-handler`)
- Hook `onMessage(message)` : parse JSON + validate Zod + idempotency check + appel `handle()` + ack
- Manual ack : `eachMessage` avec `commitOffsetsIfNecessary` apres succes

**Fichiers cibles principaux** :
  - `repo/packages/shared-events/src/consumer/kafka-consumer.base.ts`
  - `repo/packages/shared-events/src/consumer/kafka-consumer.module.ts`
  - `repo/packages/database/src/migrations/1735000000008-ConsumerProcessedEvents.ts`
  - `repo/packages/database/src/entities/system/consumer-processed-event.entity.ts`
  - `repo/packages/shared-events/src/consumer/kafka-consumer.base.spec.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Classe abstraite compile
  - V2 (P0) : Subclass simple fonctionne (test : consumer concret recoit message)
  - V3 (P0) : Validation Zod amont -- payload invalide pas envoye a `handle()`

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
git commit -m "feat(sprint-02): kafkaconsumerbase abstract class

Task: 1.2.13
Sprint: 2 (Phase 1 / Sprint 2)
Phase: 1 -- Bootstrap Infrastructure
Decisions: see B-02 Tache 1.2.13"
```

---

### Tache 14 / 15 : Seeds Dev Exhaustifs

**Metadonnees** : P0 | 4h | Depend de : Depend de 1.2.13

**But** : Script TypeScript peuplant la DB dev avec donnees realistes pour faciliter dev/demo : 5 assureurs MA + 1 cabinet courtier + 1 garage + 50 contacts + 20 polices fictives.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-02-database-kafka/task-1.2.14-prompt.md
```

**Actions principales attendues** :
- `repo/infrastructure/scripts/seed-dev.ts` (executable via `pnpm seeds:run`)
- `repo/infrastructure/scripts/seed-reset.ts` (TRUNCATE all tables, reset ID sequences via `pnpm seeds:reset`)
- Seed 1 : tenant Skalean Platform (super admin)
- Seed 2 : 1 tenant cabinet courtier "Cabinet Bennani Assurance" (Casablanca)
- Seed 3 : 1 tenant garage "Garage Atlas Auto" (Marrakech)
- Seed 4 : 5 utilisateurs role mix : 1 super_admin_platform, 1 broker_admin (Bennani), 1 broker_user (Bennani), 1 garage_chef (Atlas), 1 garage_technicien (Atlas)

**Fichiers cibles principaux** :
  - `repo/infrastructure/scripts/seed-dev.ts`
  - `repo/infrastructure/scripts/seed-reset.ts`
  - `repo/infrastructure/scripts/seed-data/`
  - `├── assureurs-ma.json`
  - `├── produits-assurance.json`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : `pnpm seeds:run` reussit en < 30s
  - V2 (P0) : 50 contacts crees (30 Bennani + 20 Atlas)
  - V3 (P0) : 20 deals crees, mix stages

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
git commit -m "feat(sprint-02): seeds dev exhaustifs

Task: 1.2.14
Sprint: 2 (Phase 1 / Sprint 2)
Phase: 1 -- Bootstrap Infrastructure
Decisions: see B-02 Tache 1.2.14"
```

---

### Tache 15 / 15 : Tests Integration : Migrations + RLS + Kafka End-to-End

**Metadonnees** : P0 | 5h | Depend de : Depend de 1.2.14

**But** : Battery de tests integration validant que tout le Sprint 2 fonctionne end-to-end : migrations reversibles, RLS bloque cross-tenant, subscribers actifs, Kafka pub/sub round-trip.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-02-database-kafka/task-1.2.15-prompt.md
```

**Actions principales attendues** :
- Suite tests `repo/packages/database/test/integration/`
- Test 1 : `migrations.spec.ts` -- toutes 8 migrations up + down + up reussissent sequentiellement
- Test 2 : `rls-multi-tenant.spec.ts` -- INSERT contact tenant A puis SELECT tenant B retourne 0 rows (verifie pour les 32 tables)
- Test 3 : `rls-super-admin.spec.ts` -- super admin bypass RLS (voit cross-tenant)
- Test 4 : `subscribers-tenant-id.spec.ts` -- INSERT sans tenant context throw error, INSERT avec context auto-injecte
- Test 5 : `subscribers-audit-log.spec.ts` -- UPDATE auth_user genere row dans audit_log avec diff fields

**Fichiers cibles principaux** :
  - `repo/packages/database/test/integration/migrations.spec.ts`
  - `repo/packages/database/test/integration/rls-multi-tenant.spec.ts`
  - `repo/packages/database/test/integration/rls-super-admin.spec.ts`
  - `repo/packages/database/test/integration/subscribers-tenant-id.spec.ts`
  - `repo/packages/database/test/integration/subscribers-audit-log.spec.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Tous 10 tests integration passent localement (`pnpm test`)
  - V2 (P0) : Tous tests passent en CI (services PG + Kafka + Redis)
  - V3 (P0) : Migrations up/down/up reussit

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
git commit -m "feat(sprint-02): tests integration : migrations + rls + kafka end-to-end

Task: 1.2.15
Sprint: 2 (Phase 1 / Sprint 2)
Phase: 1 -- Bootstrap Infrastructure
Decisions: see B-02 Tache 1.2.15"
```

---


## VERIFICATION DU SPRINT 2

Une fois les 15 taches terminees et commitees, **lancer la verification automatique** :

```bash
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-02-sprint-02-verification.md
```

Le fichier de verification V-02 contient :

- **Criteres P0 bloquants** : compilation TypeScript / tests Vitest / Biome lint / no-emoji / conventional commits
- **Criteres P1 avertissements** : couverture >= 85% / dependencies coherentes / docs API / metriques performance
- **Criteres P2 notes** : coverage >= 90% modules critiques / lighthouse score / accessibility
- **Auto-reparation** pour criteres recuperables (e.g. relance tests flaky)
- **Generation automatique** du rapport `sprint02-verify-report.md`
- **Calcul score global** + statut GO / GO CONDITIONNEL / NO-GO

**Score minimum requis pour GO** : >= 95% (sprint termine, GO Sprint suivant)
**Score minimum pour GO CONDITIONNEL** : 85-94% (hot fix requis, retard <= 1 semaine)
**En dessous de 85%** : NO-GO, **reprise sprint requise** (escalation Saad/Abla decision)

Apres execution, lire le rapport :

```bash
cat skalean-insurtech/sprint02-verify-report.md
```

Si statut **GO** ou **GO CONDITIONNEL**, executer le commit de cloture :

```bash
git add skalean-insurtech/sprint02-verify-report.md
git commit -m "chore(sprint-02): close sprint 2 with verification report

- Score global : {SCORE}%
- Statut : {GO|GO CONDITIONNEL}
- Phase : 1 (Bootstrap Infrastructure)
- Sprint : 2 (Phase 1 / Sprint 2)
- Apport : Schema 32 tables + 30+ topics Kafka + seeds dev complete
- Tests E2E cumules : {N}+

Sprint 2 completed -- handoff to Sprint 3."
```

---

## RESUME DU WORKFLOW

```
[Demarrage Sprint 2]
   |
   v
[Tache 1.2.1: Enrichir @insurtech/database]
   | -> compile -> tests -> commit
   v
[Tache 1.2.2: Migration "Initial System" : 5 Tables (Auth + Audit Log]
   | -> compile -> tests -> commit
   v
[Tache 1.2.3: Migration "CRM" : 4 Tables + RLS + Indexes Trigram]
   | -> compile -> tests -> commit
   v
[Tache 1.2.4: Migration "Booking" : 3 Tables + EXCLUDE Constraint]
   | -> compile -> tests -> commit
   v
[Tache 1.2.5: Migration "Communications" : 4 Tables]
   | -> compile -> tests -> commit
   v
[Tache 1.2.6: Migration "Docs + Pay" : 6 Tables]
   | -> compile -> tests -> commit
   v
[Tache 1.2.7: Migration "Books + Compliance" : 6 Tables]
   | -> compile -> tests -> commit
   v
[Tache 1.2.8: Migration "Analytics + Stock + HR" : 5 Tables]
   | -> compile -> tests -> commit
   v
[Tache 1.2.9: TypeORM Subscribers : 3 Transverses]
   | -> compile -> tests -> commit
   v
[Tache 1.2.10: Topics Kafka Enrichi : 50+ Topics]
   | -> compile -> tests -> commit
   v
[Tache 1.2.11: Init @insurtech/shared-events : Topics enum + Zod schem]
   | -> compile -> tests -> commit
   v
[Tache 1.2.12: KafkaPublisher Service NestJS]
   | -> compile -> tests -> commit
   v
[Tache 1.2.13: KafkaConsumerBase Abstract Class]
   | -> compile -> tests -> commit
   v
[Tache 1.2.14: Seeds Dev Exhaustifs]
   | -> compile -> tests -> commit
   v
[Tache 1.2.15: Tests Integration : Migrations + RLS + Kafka End-to-End]
   | -> compile -> tests -> commit
   v
[Verification automatique sprint 2 -- V-02]
   |
   v
[Rapport sprint02-verify-report.md]
   |
   v
[Score >= 95%] -> GO -> commit cloture sprint -> Sprint suivant
[Score 85-94%] -> GO CONDITIONNEL -> hot fix puis cloture
[Score < 85%]  -> NO-GO -> reprise sprint
```

**Duree totale estimee** : 80 heures (5h par tache moyenne -- 2 devs FTE en parallele).

**Modules skalean-insurtech affectes** : @insurtech/database, @insurtech/shared-config, @insurtech/shared-utils, infrastructure/docker, infrastructure/scripts

**Apport metier principal** : Schema 32 tables + 30+ topics Kafka + seeds dev complete.

**Prerequis Sprint 3** : Sprint 2 GO complet (score >= 95% verification automatique V-02).

**Sprint suivant** : Sprint 3.

---

## COMMANDES DE LANCEMENT

### Prerequis Sprint 1 (verification GO)

```bash
# Verifier Sprint 1 GO
ls skalean-insurtech/sprint01-verify-report.md
grep '^Statut.*GO' skalean-insurtech/sprint01-verify-report.md
```

### Lancement Sprint 2 (Cowork lit cet orchestrateur)

```bash
# Cowork command (claude-code or cowork CLI) :
claude-code \
  --orchestrator skalean-insurtech/00-pilotage/meta-prompts/phase-C-orchestration/C-02-sprint-02-database-kafka.md \
  --reference-prompt skalean-insurtech/00-pilotage/meta-prompts/phase-B-tasks/B-02-sprint-02-database-kafka.md \
  --verification skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-02-sprint-02-verification.md
```

### Suivi temps reel execution

```bash
# Tail le log Cowork
tail -f skalean-insurtech/cowork-sprint-02.log

# Verifier progression commits
git log --oneline --since="2 weeks ago" -- repo/ | grep "Sprint: 2"
```

### Apres completion -- verifier rapport

```bash
cat skalean-insurtech/sprint02-verify-report.md
```

---

## NOTES IMPORTANTES POUR COWORK

1. **Lire d'abord B-02** complet avant generation prompts taches (contexte critique)
2. **Generer les 15 prompts taches** dans `00-pilotage/prompts-taches/sprint-02-*/` AVANT de commencer execution
3. **Toujours respecter l'ordre** des taches (dependances explicites)
4. **Commit chaque tache separement** (granularite Git pour rollback facile)
5. **NE JAMAIS modifier `00-pilotage/`** -- uniquement `repo/`
6. **En cas de doute**, escalader Saad/Abla via Slack `#insurtech-dev` plutot que faire choix arbitraire
7. **Documentation continue** : si tu prends une decision technique, ajouter ADR dans `repo/docs/architecture/`

---

**Fin de l'orchestrateur C-02 v2.2 detaille -- Sprint 2 (1.2) Database + Kafka.**

**Total taches detaillees** : 15 | **Effort cumul** : ~80h | **Apport** : Schema 32 tables + 30+ topics Kafka + seeds dev complete
