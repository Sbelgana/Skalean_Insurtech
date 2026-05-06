# ORCHESTRATEUR SPRINT 9 -- Phase 3 / Sprint 2 : Comm WhatsApp + Email
# 13 taches sequentielles + verification finale
# AUCUNE EMOJI AUTORISEE

**Version** : v2.2 (Option B detaillee)
**Phase** : 3 -- Modules Horizontaux
**Sprint** : 9 / 35 (cumul) -- Sprint 2 dans Phase 3
**Reference meta-prompt** : `B-09-sprint-09-comm-wa-email.md`
**Reference verification** : `V-09-sprint-09-verification.md`
**Numerotation taches** : 3.2.1 a 3.2.13
**Effort total** : ~75 heures developpement / 2 semaines
**Apport metier** : WhatsApp + Email + 4 locales + templates production

---

Tu es **Claude Code (ou Cowork)**. Tu dois executer **TOUTES les 13 taches** du Sprint 9 **UNE PAR UNE** dans l'ordre defini ci-dessous, puis lancer la verification automatique du sprint.

**Cet orchestrateur extrait le contenu detaille de chaque tache depuis B-09** -- pour code complet, patterns critiques et tests exhaustifs, lire le meta-prompt B-09 reference dans chaque tache.

---

## OBJECTIF DU SPRINT 9

Sprint 9 (3.2) -- Comm WhatsApp + Email. Voir B-09-sprint-09-comm-wa-email.md pour contexte detaille.

---

## STRUCTURE DES FICHIERS

**Prompts des taches** (a executer en sequence) :
```
skalean-insurtech/00-pilotage/prompts-taches/sprint-09-comm-wa-email/
  task-3.2.1-prompt.md       # comm_messages Entity Enrichie + Schemas Zod
  task-3.2.2-prompt.md       # WhatsApp Cloud API Client (Meta v21.0)
  task-3.2.3-prompt.md       # WA Template Renderer + 3 Locales
  task-3.2.4-prompt.md       # WA Webhook Receiver + Signature HMAC Verification
  task-3.2.5-prompt.md       # Template Manager + 20+ Templates Seed
  task-3.2.6-prompt.md       # Email SMTP Client + DKIM/SPF + Mailgun
  task-3.2.7-prompt.md       # Email Template Renderer + RTL ar/ar-MA
  task-3.2.8-prompt.md       # BullMQ Queues + Retry + DLQ
  task-3.2.9-prompt.md       # Message Orchestrator (Routing par preferred_channel)
  task-3.2.10-prompt.md       # Delivery Tracking + Bounces + Alerts
  task-3.2.11-prompt.md       # Opt-out Management CNDP + Endpoint Public
  task-3.2.12-prompt.md       # Endpoints REST /api/v1/comm/*
  task-3.2.13-prompt.md       # Tests E2E Exhaustifs (40+) + Mocks
```

**Verification du sprint** (a lancer APRES toutes les taches) :
```
skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-09-sprint-09-verification.md
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
4. La verification finale V-09 identifiera taches FAIL pour reprise ciblee

### Verification finale automatique

APRES avoir execute les 13 taches et commite chacune :
```bash
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-09-sprint-09-verification.md
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

### Position du Sprint 2 dans la Phase 3

Sprint 9 (3.2) -- **Comm WhatsApp + Email**.

Voir `B-09-sprint-09-comm-wa-email.md` (section "POSITION DANS LA PHASE" + "DEPENDANCES") pour contexte detaille des dependances cross-sprints (entrees consommees + sorties produites).

### Modules concernes par cette Phase

@insurtech/crm, @insurtech/booking, @insurtech/comm, @insurtech/docs, @insurtech/signature, @insurtech/pay, @insurtech/books, @insurtech/compliance, @insurtech/analytics, @insurtech/stock, @insurtech/hr

### Apport metier de ce sprint

WhatsApp + Email + 4 locales + templates production

### Decisions strategiques applicables

Cf. `00-pilotage/decisions/`. Decisions cles pour ce sprint : voir B-09 section "Decisions strategiques applicables".

---

## EXECUTION SEQUENTIELLE DES 13 TACHES

Chaque tache ci-dessous indique : metadata (priorite/effort/deps), but extrait de B-09, actions principales (livrables checkables), fichiers cibles, criteres P0, validation et commit.

**Pour code complet, patterns critiques, tests exhaustifs** : lire le prompt tache detaille genere depuis B-09.

---

### Tache 1 / 13 : comm_messages Entity Enrichie + Schemas Zod

**Metadonnees** : P0 | 4h | Depend de : Depend de Sprint 8

**But** : Enrichir entity `comm_message` (Sprint 2) avec types TypeScript complete + schemas Zod pour CRUD + validation E.164 / email format.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-09-comm-wa-email/task-3.2.1-prompt.md
```

**Actions principales attendues** :
- Entity `repo/packages/comm/src/entities/comm-message.entity.ts` (Sprint 2 deja migration)
- Decorators TypeORM complete : columns + indexes + foreign keys
- Enum types : `Channel ('whatsapp' | 'email' | 'sms' | 'voice')`, `Direction ('inbound' | 'outbound')`, `MessageStatus ('pending' | 'queued' | 'sent' | 'delivered' | 'read' | 'failed')`
- Schemas Zod :
- Validators : phone E.164 (utilise Sprint 8), email RFC 5322
- Service `messages-repository.service.ts` (factory queries reutilisable)

**Fichiers cibles principaux** :
  - `repo/packages/comm/src/entities/comm-message.entity.ts`
  - `repo/packages/comm/src/schemas/message.schema.ts`
  - `repo/packages/comm/src/schemas/webhook.schema.ts`
  - `repo/packages/comm/src/types/channel.enum.ts`
  - `repo/packages/comm/src/services/messages-repository.service.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Entity hydrate correctement
  - V2 (P0) : Send Schema rejette to invalide (pas E.164 ni email)
  - V3 (P0) : Send Schema accept WA template_variables JSONB

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
git commit -m "feat(sprint-09): comm_messages entity enrichie + schemas zod

Task: 3.2.1
Sprint: 9 (Phase 3 / Sprint 2)
Phase: 3 -- Modules Horizontaux
Decisions: see B-09 Tache 3.2.1"
```

---

### Tache 2 / 13 : WhatsApp Cloud API Client (Meta v21.0)

**Metadonnees** : P0 | 6h | Depend de : Depend de 3.2.1

**But** : Client TypeScript pour Meta WhatsApp Business Platform Cloud API v21.0 : send template messages, retrieve message status, get phone number info.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-09-comm-wa-email/task-3.2.2-prompt.md
```

**Actions principales attendues** :
- Service `repo/packages/comm/src/providers/whatsapp/whatsapp-cloud-api.client.ts`
- Methods :
- Configuration via env : `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_API_BASE_URL`
- HTTP client undici (perf > axios)
- Retry logic : 3 tentatives avec backoff exponential 1s/5s/30s sur 5xx errors
- Rate limiting respect : Meta 80 messages/seconde par phone_number_id

**Fichiers cibles principaux** :
  - `repo/packages/comm/src/providers/whatsapp/whatsapp-cloud-api.client.ts`
  - `repo/packages/comm/src/providers/whatsapp/whatsapp-cloud-api.client.spec.ts`
  - `repo/packages/comm/src/providers/whatsapp/types.ts`
  - `repo/packages/comm/src/providers/whatsapp/errors.ts`
  - `repo/packages/comm/src/providers/whatsapp/mock-whatsapp.client.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : `sendTemplate` retourne message_id Meta
  - V2 (P0) : Phone E.164 normalise (sans +)
  - V3 (P0) : Template variables interpolees dans components

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
git commit -m "feat(sprint-09): whatsapp cloud api client (meta v21.0)

Task: 3.2.2
Sprint: 9 (Phase 3 / Sprint 2)
Phase: 3 -- Modules Horizontaux
Decisions: see B-09 Tache 3.2.2"
```

---

### Tache 3 / 13 : WA Template Renderer + 3 Locales

**Metadonnees** : P0 | 5h | Depend de : Depend de 3.2.2

**But** : Service rendant les templates WhatsApp avec variables : lookup template DB par nom + locale, parse `{{variables}}`, retourne components Meta API format.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-09-comm-wa-email/task-3.2.3-prompt.md
```

**Actions principales attendues** :
- Service `repo/packages/comm/src/services/wa-template-renderer.service.ts`
- Method `render(templateName, locale, variables): Promise<MetaTemplateComponents>` :
- Method `validateMetaApproved(templateName, locale): boolean` -- check `meta_template_status == 'approved'`
- Method `getRequiredVariables(templateName, locale): string[]` -- retourne liste variables attendues
- Locales : 'fr', 'ar-MA', 'ar' (mapping vers Meta `language_code` : 'fr', 'ar', 'ar') -- ar-MA mappe vers ar avec contenu darija
- Cache Redis 5min par template (eviter re-fetch DB)

**Fichiers cibles principaux** :
  - `repo/packages/comm/src/services/wa-template-renderer.service.ts`
  - `repo/packages/comm/src/services/wa-template-renderer.service.spec.ts`
  - `repo/packages/comm/src/types/meta-template-components.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : `render('appointment_reminder', 'fr', { user_name: 'Mohamed', appointment_time: '15:00' })` retourne components Meta
  - V2 (P0) : Variable manquante throw error explicite
  - V3 (P0) : Variable extra ignoree (pas erreur, juste pas utilisee)

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
git commit -m "feat(sprint-09): wa template renderer + 3 locales

Task: 3.2.3
Sprint: 9 (Phase 3 / Sprint 2)
Phase: 3 -- Modules Horizontaux
Decisions: see B-09 Tache 3.2.3"
```

---

### Tache 4 / 13 : WA Webhook Receiver + Signature HMAC Verification

**Metadonnees** : P0 | 5h | Depend de : Depend de 3.2.3

**But** : Endpoint public `/api/v1/public/webhooks/whatsapp` recevant les webhooks Meta (status updates + incoming messages) avec verification signature HMAC SHA-256.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-09-comm-wa-email/task-3.2.4-prompt.md
```

**Actions principales attendues** :
- Controller `repo/apps/api/src/modules/comm/controllers/wa-webhook.controller.ts`
- Endpoint `GET /api/v1/public/webhooks/whatsapp` (verification challenge initial Meta) :
- Endpoint `POST /api/v1/public/webhooks/whatsapp` (webhook receiver) :
- Service `wa-webhook-processor.service.ts` (Kafka consumer extends KafkaConsumerBase Sprint 2)
- Process webhook async :
- Logs structures : webhook recu + verifie + processed

**Fichiers cibles principaux** :
  - `repo/apps/api/src/modules/comm/controllers/wa-webhook.controller.ts`
  - `repo/apps/api/src/modules/comm/middleware/wa-signature.middleware.ts`
  - `repo/apps/api/src/modules/comm/consumers/wa-webhook-processor.consumer.ts`
  - `repo/apps/api/test/comm/wa-webhook.e2e-spec.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : GET verification : challenge retourne si verify_token match
  - V2 (P0) : POST signature valide : 200 OK + processed
  - V3 (P0) : POST signature invalide : 401 + warn log

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
git commit -m "feat(sprint-09): wa webhook receiver + signature hmac verification

Task: 3.2.4
Sprint: 9 (Phase 3 / Sprint 2)
Phase: 3 -- Modules Horizontaux
Decisions: see B-09 Tache 3.2.4"
```

---

### Tache 5 / 13 : Template Manager + 20+ Templates Seed

**Metadonnees** : P0 | 6h | Depend de : Depend de 3.2.4

**But** : Service CRUD templates + 20+ templates seed pre-ecrits 3 locales pour cas d'usage critiques (auth, booking, insure, repair).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-09-comm-wa-email/task-3.2.5-prompt.md
```

**Actions principales attendues** :
- Service `repo/packages/comm/src/services/template-manager.service.ts`
- Methods : `create`, `findById`, `findByName(tenant, name, locale)`, `update`, `delete`, `submitForApproval`, `markApproved`, `markRejected`
- Endpoints `repo/apps/api/src/modules/comm/controllers/templates.controller.ts` :
- Workflow Meta : draft -> pending_review -> approved/rejected
- Templates seed initiaux par module (20+ templates) :
- Script `repo/infrastructure/scripts/seed-comm-templates.ts`

**Fichiers cibles principaux** :
  - `repo/packages/comm/src/services/template-manager.service.ts`
  - `repo/packages/comm/src/services/template-manager.service.spec.ts`
  - `repo/apps/api/src/modules/comm/controllers/templates.controller.ts`
  - `repo/infrastructure/scripts/seed-comm-templates.ts`
  - `repo/packages/comm/src/templates/seed-data/{20 .json}`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 60+ templates seed crees
  - V2 (P0) : 3 locales par template
  - V3 (P0) : CRUD templates fonctionne

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
git commit -m "feat(sprint-09): template manager + 20+ templates seed

Task: 3.2.5
Sprint: 9 (Phase 3 / Sprint 2)
Phase: 3 -- Modules Horizontaux
Decisions: see B-09 Tache 3.2.5"
```

---

### Tache 6 / 13 : Email SMTP Client + DKIM/SPF + Mailgun

**Metadonnees** : P0 | 5h | Depend de : Depend de 3.2.5

**But** : Email service production-ready avec SMTP (Mailgun ou Sendgrid prod, Mailhog dev), DKIM signing, SPF + DMARC config DNS.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-09-comm-wa-email/task-3.2.6-prompt.md
```

**Actions principales attendues** :
- Service `repo/packages/comm/src/providers/email/email.service.ts` (enrichi Sprint 5)
- Methods :
- Configuration multi-env :
- DKIM signing : private key lue depuis env `EMAIL_DKIM_PRIVATE_KEY` (prod), domain `skalean-insurtech.ma`, selector `default`
- Variables env ajoutees : `EMAIL_PROVIDER` (`mailhog` | `mailgun`), `EMAIL_SMTP_HOST/PORT/USER/PASSWORD`, `EMAIL_FROM_NO_REPLY`, `EMAIL_FROM_SUPPORT`, `EMAIL_DKIM_PRIVATE_KEY`, `EMAIL_DKIM_SELECTOR`
- Headers anti-spam : `List-Unsubscribe` + `List-Unsubscribe-Post: List-Unsubscribe=One-Click` (RFC 8058)

**Fichiers cibles principaux** :
  - `repo/packages/comm/src/providers/email/email.service.ts`
  - `repo/packages/comm/src/providers/email/email.service.spec.ts`
  - `repo/packages/comm/src/providers/email/dkim-signer.helper.ts`
  - `repo/docs/runbooks/email-dns-setup.md`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : send via Mailhog dev OK
  - V2 (P0) : send via Mailgun staging OK (test env)
  - V3 (P0) : DKIM signature appliquee (verifier headers)

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
git commit -m "feat(sprint-09): email smtp client + dkim/spf + mailgun

Task: 3.2.6
Sprint: 9 (Phase 3 / Sprint 2)
Phase: 3 -- Modules Horizontaux
Decisions: see B-09 Tache 3.2.6"
```

---

### Tache 7 / 13 : Email Template Renderer + RTL ar/ar-MA

**Metadonnees** : P0 | 4h | Depend de : Depend de 3.2.6

**But** : Renderer email Handlebars avec layout shared (header + footer Skalean) + RTL automatique pour locales ar/ar-MA.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-09-comm-wa-email/task-3.2.7-prompt.md
```

**Actions principales attendues** :
- Service `repo/packages/comm/src/services/email-template-renderer.service.ts`
- Method `render(templateName, locale, variables): { subject, html, text }`
- Templates Handlebars dans `repo/packages/comm/src/templates/{locale}/{name}.hbs`
- Layout shared `repo/packages/comm/src/templates/_layout.hbs` (header logo Skalean + footer copyright + List-Unsubscribe link)
- CSS inline (compatibility email clients) via library `juice` ou manual
- RTL pour ar/ar-MA : `<html dir="rtl">` + CSS `direction: rtl; text-align: right`

**Fichiers cibles principaux** :
  - `repo/packages/comm/src/services/email-template-renderer.service.ts`
  - `repo/packages/comm/src/services/email-template-renderer.service.spec.ts`
  - `repo/packages/comm/src/templates/_layout.hbs`
  - `repo/packages/comm/src/templates/{fr,ar-MA,ar}/{20 .hbs}`
  - `repo/packages/comm/src/helpers/handlebars-helpers.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : `render('appointment_reminder', 'fr', vars)` retourne subject + html + text
  - V2 (P0) : Locale ar-MA : html avec dir="rtl"
  - V3 (P0) : Variables interpolees correctement

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
git commit -m "feat(sprint-09): email template renderer + rtl ar/ar-ma

Task: 3.2.7
Sprint: 9 (Phase 3 / Sprint 2)
Phase: 3 -- Modules Horizontaux
Decisions: see B-09 Tache 3.2.7"
```

---

### Tache 8 / 13 : BullMQ Queues + Retry + DLQ

**Metadonnees** : P0 | 5h | Depend de : Depend de 3.2.7

**But** : Queues BullMQ (Sprint 3 JobsModule init) avec workers `wa-send` + `email-send`, retry exponential, DLQ on max retries exceeded.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-09-comm-wa-email/task-3.2.8-prompt.md
```

**Actions principales attendues** :
- Queues definies :
- Workers correspondants :
- Default job options : 3 retries, exponential backoff 1s/5s/30s, removeOnComplete 30 jours, removeOnFail 90 jours
- Concurrency : 10 workers parallele par queue (configurable)
- DLQ : apres 3 echecs, publier vers `insurtech.events.dlq.comm` Kafka topic
- Logs structures : job started/completed/failed/retry avec attempt count

**Fichiers cibles principaux** :
  - `repo/packages/comm/src/workers/wa-send.worker.ts`
  - `repo/packages/comm/src/workers/email-send.worker.ts`
  - `repo/packages/comm/src/workers/wa-webhook-process.worker.ts`
  - `repo/packages/comm/src/workers/email-webhook-process.worker.ts`
  - `repo/packages/comm/src/jobs/types.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Job reussi : message status='sent' + Kafka event
  - V2 (P0) : Job fail transient : retry 3 fois
  - V3 (P0) : 3 echecs : message status='failed' + DLQ event

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
git commit -m "feat(sprint-09): bullmq queues + retry + dlq

Task: 3.2.8
Sprint: 9 (Phase 3 / Sprint 2)
Phase: 3 -- Modules Horizontaux
Decisions: see B-09 Tache 3.2.8"
```

---

### Tache 9 / 13 : Message Orchestrator (Routing par preferred_channel)

**Metadonnees** : P0 | 5h | Depend de : Depend de 3.2.8

**But** : Service centralise orchestrant l'envoi : determine canal optimal (WhatsApp si preferred + opt-in + template Meta approved, sinon Email), enqueue job correspondant.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-09-comm-wa-email/task-3.2.9-prompt.md
```

**Actions principales attendues** :
- Service `repo/packages/comm/src/services/message-orchestrator.service.ts`
- Method `sendToContact(contactId, templateName, variables, options): Promise<{ messageId, channel }>` :
- Method `sendBroadcast(filters, templateName, variables): Promise<{ jobs_enqueued }>` -- pour campaigns marketing (filter contacts)
- Method `sendBatch(items: SendItem[])` -- bulk send (e.g. reminders RDV J-1)
- Permissions : `comm.messages.send`
- Audit log : send initiated

**Fichiers cibles principaux** :
  - `repo/packages/comm/src/services/message-orchestrator.service.ts`
  - `repo/packages/comm/src/services/message-orchestrator.service.spec.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Contact preferred WA + opt-in -> envoie via WA
  - V2 (P0) : Contact preferred WA + opt-out -> fallback email
  - V3 (P0) : Contact sans phone + sans email -> NoAvailableChannelError

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
git commit -m "feat(sprint-09): message orchestrator (routing par preferred_channel)

Task: 3.2.9
Sprint: 9 (Phase 3 / Sprint 2)
Phase: 3 -- Modules Horizontaux
Decisions: see B-09 Tache 3.2.9"
```

---

### Tache 10 / 13 : Delivery Tracking + Bounces + Alerts

**Metadonnees** : P0 | 4h | Depend de : Depend de 3.2.9

**But** : Tracker statuses messages : sent -> delivered -> read (WA only) -> failed/bounced. Alertes si bounce rate > seuil.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-09-comm-wa-email/task-3.2.10-prompt.md
```

**Actions principales attendues** :
- Webhooks update `comm_messages.status` :
- Endpoint `POST /api/v1/public/webhooks/mailgun` (similaire WA) avec verification HMAC SHA-256 (signing key Mailgun)
- Service `delivery-tracking.service.ts` :
- Hard bounces : auto-add to opt-out (pas re-essayer, anti-spam reputation)
- Soft bounces : retry par BullMQ
- Alerts :

**Fichiers cibles principaux** :
  - `repo/packages/comm/src/services/delivery-tracking.service.ts`
  - `repo/apps/api/src/modules/comm/controllers/mailgun-webhook.controller.ts`
  - `repo/apps/api/src/modules/comm/middleware/mailgun-signature.middleware.ts`
  - `repo/apps/api/src/modules/comm/controllers/comm-stats.controller.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : WA webhook : status update sent->delivered->read
  - V2 (P0) : Mailgun webhook bounce hard : opt-out auto
  - V3 (P0) : Bounce soft : retry pas opt-out

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
git commit -m "feat(sprint-09): delivery tracking + bounces + alerts

Task: 3.2.10
Sprint: 9 (Phase 3 / Sprint 2)
Phase: 3 -- Modules Horizontaux
Decisions: see B-09 Tache 3.2.10"
```

---

### Tache 11 / 13 : Opt-out Management CNDP + Endpoint Public

**Metadonnees** : P0 | 4h | Depend de : Depend de 3.2.10

**But** : Conformite CNDP loi 09-08 : permettre opt-out facile via lien public dans email/WA, table `comm_optouts`, exclusion automatique a chaque send.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-09-comm-wa-email/task-3.2.11-prompt.md
```

**Actions principales attendues** :
- Service `repo/packages/comm/src/services/optout.service.ts`
- Methods :
- Endpoint public `GET /api/v1/public/optout/:token` :
- Endpoint `POST /api/v1/public/optout/one-click` (RFC 8058 List-Unsubscribe-Post header) :
- Endpoint user dashboard `/api/v1/comm/preferences` (auth required) -- voir + modifier ses opt-outs
- Lien opt-out auto-injecte dans tous emails (footer) + dans templates WA quand pertinent

**Fichiers cibles principaux** :
  - `repo/packages/comm/src/services/optout.service.ts`
  - `repo/packages/comm/src/services/optout.service.spec.ts`
  - `repo/apps/api/src/modules/comm/controllers/optout.controller.ts`
  - `repo/packages/comm/src/templates/{fr,ar-MA,ar}/optout-page.hbs`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Opt-out token genere + URL fonctionne
  - V2 (P0) : One-click endpoint works (POST direct)
  - V3 (P0) : STOP keyword WA detecte + auto-opt-out

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
git commit -m "feat(sprint-09): opt-out management cndp + endpoint public

Task: 3.2.11
Sprint: 9 (Phase 3 / Sprint 2)
Phase: 3 -- Modules Horizontaux
Decisions: see B-09 Tache 3.2.11"
```

---

### Tache 12 / 13 : Endpoints REST /api/v1/comm/*

**Metadonnees** : P0 | 4h | Depend de : Depend de 3.2.11

**But** : Controllers exposant l'API comm (messages list, send, templates, stats) avec format standardise.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-09-comm-wa-email/task-3.2.12-prompt.md
```

**Actions principales attendues** :
- Controller `repo/apps/api/src/modules/comm/controllers/messages.controller.ts` :
- Controller `templates.controller.ts` (Tache 3.2.5)
- Controller `comm-stats.controller.ts` (Tache 3.2.10)
- Controller `optout.controller.ts` (Tache 3.2.11)
- Controller `comm-preferences.controller.ts` (user-facing preferences)
- Permissions : `comm.messages.send/read`, `comm.templates.manage`

**Fichiers cibles principaux** :
  - `repo/apps/api/src/modules/comm/controllers/messages.controller.ts`
  - `repo/apps/api/src/modules/comm/controllers/comm-preferences.controller.ts`
  - `repo/apps/api/src/modules/comm/dto/{several}.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : POST /send orchestrate + retourne messageId
  - V2 (P0) : GET /messages liste avec filtres
  - V3 (P0) : GET /:id/timeline retourne events

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
git commit -m "feat(sprint-09): endpoints rest /api/v1/comm/*

Task: 3.2.12
Sprint: 9 (Phase 3 / Sprint 2)
Phase: 3 -- Modules Horizontaux
Decisions: see B-09 Tache 3.2.12"
```

---

### Tache 13 / 13 : Tests E2E Exhaustifs (40+) + Mocks

**Metadonnees** : P0 | 8h | Depend de : Depend de 3.2.12

**But** : Suite tests E2E avec Mailhog + mock Meta API + tests integration BullMQ workers.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-09-comm-wa-email/task-3.2.13-prompt.md
```

**Actions principales attendues** :
- Send WA template happy path : POST /send -> WA queued -> mock Meta returns ok -> message status='sent'
- Send Email happy path : POST /send -> email queued -> Mailhog received
- Routing : preferred_channel='whatsapp' + opt-in -> WA used
- Routing : preferred_channel='whatsapp' + opt-out -> fallback email
- Routing : no available channel -> 400
- WA webhook signature valid : status updated

**Fichiers cibles principaux** :
  - `repo/apps/api/test/comm/{40+ specs}.e2e-spec.ts`
  - `repo/apps/api/test/comm/fixtures/comm-test-helpers.ts`
  - `repo/apps/api/test/comm/fixtures/mock-meta-server.ts`
  - `repo/apps/api/test/comm/fixtures/mailhog-client.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 40+ tests passent
  - V2 (P0) : Tests passent CI
  - V3 (P0) : Mocks Meta + Mailhog fonctionnent

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
git commit -m "feat(sprint-09): tests e2e exhaustifs (40+) + mocks

Task: 3.2.13
Sprint: 9 (Phase 3 / Sprint 2)
Phase: 3 -- Modules Horizontaux
Decisions: see B-09 Tache 3.2.13"
```

---


## VERIFICATION DU SPRINT 9

Une fois les 13 taches terminees et commitees, **lancer la verification automatique** :

```bash
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-09-sprint-09-verification.md
```

Le fichier de verification V-09 contient :

- **Criteres P0 bloquants** : compilation TypeScript / tests Vitest / Biome lint / no-emoji / conventional commits
- **Criteres P1 avertissements** : couverture >= 85% / dependencies coherentes / docs API / metriques performance
- **Criteres P2 notes** : coverage >= 90% modules critiques / lighthouse score / accessibility
- **Auto-reparation** pour criteres recuperables (e.g. relance tests flaky)
- **Generation automatique** du rapport `sprint09-verify-report.md`
- **Calcul score global** + statut GO / GO CONDITIONNEL / NO-GO

**Score minimum requis pour GO** : >= 95% (sprint termine, GO Sprint suivant)
**Score minimum pour GO CONDITIONNEL** : 85-94% (hot fix requis, retard <= 1 semaine)
**En dessous de 85%** : NO-GO, **reprise sprint requise** (escalation Saad/Abla decision)

Apres execution, lire le rapport :

```bash
cat skalean-insurtech/sprint09-verify-report.md
```

Si statut **GO** ou **GO CONDITIONNEL**, executer le commit de cloture :

```bash
git add skalean-insurtech/sprint09-verify-report.md
git commit -m "chore(sprint-09): close sprint 9 with verification report

- Score global : {SCORE}%
- Statut : {GO|GO CONDITIONNEL}
- Phase : 3 (Modules Horizontaux)
- Sprint : 9 (Phase 3 / Sprint 2)
- Apport : WhatsApp + Email + 4 locales + templates production
- Tests E2E cumules : {N}+

Sprint 9 completed -- handoff to Sprint 10."
```

---

## RESUME DU WORKFLOW

```
[Demarrage Sprint 9]
   |
   v
[Tache 3.2.1: comm_messages Entity Enrichie + Schemas Zod]
   | -> compile -> tests -> commit
   v
[Tache 3.2.2: WhatsApp Cloud API Client (Meta v21.0)]
   | -> compile -> tests -> commit
   v
[Tache 3.2.3: WA Template Renderer + 3 Locales]
   | -> compile -> tests -> commit
   v
[Tache 3.2.4: WA Webhook Receiver + Signature HMAC Verification]
   | -> compile -> tests -> commit
   v
[Tache 3.2.5: Template Manager + 20+ Templates Seed]
   | -> compile -> tests -> commit
   v
[Tache 3.2.6: Email SMTP Client + DKIM/SPF + Mailgun]
   | -> compile -> tests -> commit
   v
[Tache 3.2.7: Email Template Renderer + RTL ar/ar-MA]
   | -> compile -> tests -> commit
   v
[Tache 3.2.8: BullMQ Queues + Retry + DLQ]
   | -> compile -> tests -> commit
   v
[Tache 3.2.9: Message Orchestrator (Routing par preferred_channel)]
   | -> compile -> tests -> commit
   v
[Tache 3.2.10: Delivery Tracking + Bounces + Alerts]
   | -> compile -> tests -> commit
   v
[Tache 3.2.11: Opt-out Management CNDP + Endpoint Public]
   | -> compile -> tests -> commit
   v
[Tache 3.2.12: Endpoints REST /api/v1/comm/*]
   | -> compile -> tests -> commit
   v
[Tache 3.2.13: Tests E2E Exhaustifs (40+) + Mocks]
   | -> compile -> tests -> commit
   v
[Verification automatique sprint 9 -- V-09]
   |
   v
[Rapport sprint09-verify-report.md]
   |
   v
[Score >= 95%] -> GO -> commit cloture sprint -> Sprint suivant
[Score 85-94%] -> GO CONDITIONNEL -> hot fix puis cloture
[Score < 85%]  -> NO-GO -> reprise sprint
```

**Duree totale estimee** : 75 heures (5h par tache moyenne -- 2 devs FTE en parallele).

**Modules skalean-insurtech affectes** : @insurtech/crm, @insurtech/booking, @insurtech/comm, @insurtech/docs, @insurtech/signature, @insurtech/pay, @insurtech/books, @insurtech/compliance, @insurtech/analytics, @insurtech/stock, @insurtech/hr

**Apport metier principal** : WhatsApp + Email + 4 locales + templates production.

**Prerequis Sprint 10** : Sprint 9 GO complet (score >= 95% verification automatique V-09).

**Sprint suivant** : Sprint 10.

---

## COMMANDES DE LANCEMENT

### Prerequis Sprint 8 (verification GO)

```bash
# Verifier Sprint 8 GO
ls skalean-insurtech/sprint08-verify-report.md
grep '^Statut.*GO' skalean-insurtech/sprint08-verify-report.md
```

### Lancement Sprint 9 (Cowork lit cet orchestrateur)

```bash
# Cowork command (claude-code or cowork CLI) :
claude-code \
  --orchestrator skalean-insurtech/00-pilotage/meta-prompts/phase-C-orchestration/C-09-sprint-09-comm-wa-email.md \
  --reference-prompt skalean-insurtech/00-pilotage/meta-prompts/phase-B-tasks/B-09-sprint-09-comm-wa-email.md \
  --verification skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-09-sprint-09-verification.md
```

### Suivi temps reel execution

```bash
# Tail le log Cowork
tail -f skalean-insurtech/cowork-sprint-09.log

# Verifier progression commits
git log --oneline --since="2 weeks ago" -- repo/ | grep "Sprint: 9"
```

### Apres completion -- verifier rapport

```bash
cat skalean-insurtech/sprint09-verify-report.md
```

---

## NOTES IMPORTANTES POUR COWORK

1. **Lire d'abord B-09** complet avant generation prompts taches (contexte critique)
2. **Generer les 13 prompts taches** dans `00-pilotage/prompts-taches/sprint-09-*/` AVANT de commencer execution
3. **Toujours respecter l'ordre** des taches (dependances explicites)
4. **Commit chaque tache separement** (granularite Git pour rollback facile)
5. **NE JAMAIS modifier `00-pilotage/`** -- uniquement `repo/`
6. **En cas de doute**, escalader Saad/Abla via Slack `#insurtech-dev` plutot que faire choix arbitraire
7. **Documentation continue** : si tu prends une decision technique, ajouter ADR dans `repo/docs/architecture/`

---

**Fin de l'orchestrateur C-09 v2.2 detaille -- Sprint 9 (3.2) Comm WhatsApp + Email.**

**Total taches detaillees** : 13 | **Effort cumul** : ~75h | **Apport** : WhatsApp + Email + 4 locales + templates production
