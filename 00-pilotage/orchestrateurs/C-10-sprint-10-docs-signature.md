# ORCHESTRATEUR SPRINT 10 -- Phase 3 / Sprint 3 : Docs + Signature loi 43-20
# 13 taches sequentielles + verification finale
# AUCUNE EMOJI AUTORISEE

**Version** : v2.2 (Option B detaillee)
**Phase** : 3 -- Modules Horizontaux
**Sprint** : 10 / 35 (cumul) -- Sprint 3 dans Phase 3
**Reference meta-prompt** : `B-10-sprint-10-docs-signature.md`
**Reference verification** : `V-10-sprint-10-verification.md`
**Numerotation taches** : 3.3.1 a 3.3.13
**Effort total** : ~75 heures developpement / 2 semaines
**Apport metier** : Signature loi 43-20 conforme + Barid eSign + ANRT TSA

---

Tu es **Claude Code (ou Cowork)**. Tu dois executer **TOUTES les 13 taches** du Sprint 10 **UNE PAR UNE** dans l'ordre defini ci-dessous, puis lancer la verification automatique du sprint.

**Cet orchestrateur extrait le contenu detaille de chaque tache depuis B-10** -- pour code complet, patterns critiques et tests exhaustifs, lire le meta-prompt B-10 reference dans chaque tache.

---

## OBJECTIF DU SPRINT 10

Sprint 10 (3.3) -- Docs + Signature loi 43-20. Voir B-10-sprint-10-docs-signature.md pour contexte detaille.

---

## STRUCTURE DES FICHIERS

**Prompts des taches** (a executer en sequence) :
```
skalean-insurtech/00-pilotage/prompts-taches/sprint-10-docs-signature/
  task-3.3.1-prompt.md       # Entities Documents + Versions Enrichies
  task-3.3.2-prompt.md       # S3 Client Casablanca + KMS + Multi-Tenant Buckets
  task-3.3.3-prompt.md       # DocumentService (CRUD + Presigned URLs + Retention)
  task-3.3.4-prompt.md       # AccessLogService (Track Who Downloaded What When)
  task-3.3.5-prompt.md       # PdfGeneratorService + 4 Templates Initiaux
  task-3.3.6-prompt.md       # sig_signing_workflows Entity + SigningWorkflowService
  task-3.3.7-prompt.md       # Barid eSign API Client + Workflow Envoi
  task-3.3.8-prompt.md       # Hash SHA-256 + Horodatage Qualifie ANRT
  task-3.3.9-prompt.md       # Webhook Receiver Barid eSign
  task-3.3.10-prompt.md       # sig_audit_trails Immutable + AuditTrailService
  task-3.3.11-prompt.md       # Public Verify Controller (Verification Document via Hash)
  task-3.3.12-prompt.md       # SealedArchiveService (Bucket WORM 10 Ans + 1 Jour)
  task-3.3.13-prompt.md       # Tests E2E Exhaustifs (40+) avec Mocks + Seeds
```

**Verification du sprint** (a lancer APRES toutes les taches) :
```
skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-10-sprint-10-verification.md
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
4. La verification finale V-10 identifiera taches FAIL pour reprise ciblee

### Verification finale automatique

APRES avoir execute les 13 taches et commite chacune :
```bash
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-10-sprint-10-verification.md
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

### Position du Sprint 3 dans la Phase 3

Sprint 10 (3.3) -- **Docs + Signature loi 43-20**.

Voir `B-10-sprint-10-docs-signature.md` (section "POSITION DANS LA PHASE" + "DEPENDANCES") pour contexte detaille des dependances cross-sprints (entrees consommees + sorties produites).

### Modules concernes par cette Phase

@insurtech/crm, @insurtech/booking, @insurtech/comm, @insurtech/docs, @insurtech/signature, @insurtech/pay, @insurtech/books, @insurtech/compliance, @insurtech/analytics, @insurtech/stock, @insurtech/hr

### Apport metier de ce sprint

Signature loi 43-20 conforme + Barid eSign + ANRT TSA

### Decisions strategiques applicables

Cf. `00-pilotage/decisions/`. Decisions cles pour ce sprint : voir B-10 section "Decisions strategiques applicables".

---

## EXECUTION SEQUENTIELLE DES 13 TACHES

Chaque tache ci-dessous indique : metadata (priorite/effort/deps), but extrait de B-10, actions principales (livrables checkables), fichiers cibles, criteres P0, validation et commit.

**Pour code complet, patterns critiques, tests exhaustifs** : lire le prompt tache detaille genere depuis B-10.

---

### Tache 1 / 13 : Entities Documents + Versions Enrichies

**Metadonnees** : P0 | 4h | Depend de : Depend de Sprint 9

**But** : Enrichir entities `doc_documents` + `doc_versions` (Sprint 2 deja migration) avec types TypeScript complete + schemas Zod CRUD.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-10-docs-signature/task-3.3.1-prompt.md
```

**Actions principales attendues** :
- Entity `repo/packages/docs/src/entities/doc-document.entity.ts`
- Entity `repo/packages/docs/src/entities/doc-version.entity.ts` (append-only)
- Enum `DocumentType` : `'devis' | 'facture' | 'police' | 'avenant' | 'sinistre' | 'kyc' | 'contrat' | 'autre'`
- Enum `DocumentStatus` : `'draft' | 'final' | 'pending_signature' | 'signed' | 'archived'`
- Schemas Zod :
- Computed `retention_until` : auto-calcule selon type document (police signed : 10 ans + 1 jour, devis : 5 ans, etc.)

**Fichiers cibles principaux** :
  - `repo/packages/docs/src/entities/doc-document.entity.ts`
  - `repo/packages/docs/src/entities/doc-version.entity.ts`
  - `repo/packages/docs/src/schemas/document.schema.ts`
  - `repo/packages/docs/src/services/retention-rules.service.ts`
  - `repo/packages/docs/src/types/document-type.enum.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Entity hydrate
  - V2 (P0) : Schema Zod create reject invalid
  - V3 (P0) : Retention rules : police signed = 10 ans + 1 jour

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
git commit -m "feat(sprint-10): entities documents + versions enrichies

Task: 3.3.1
Sprint: 10 (Phase 3 / Sprint 3)
Phase: 3 -- Modules Horizontaux
Decisions: see B-10 Tache 3.3.1"
```

---

### Tache 2 / 13 : S3 Client Casablanca + KMS + Multi-Tenant Buckets

**Metadonnees** : P0 | 6h | Depend de : Depend de 3.3.1

**But** : Etendre `@insurtech/shared-utils/s3` (Sprint 1) avec multi-tenant buckets isolation, KMS encryption (prod), retention policies S3.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-10-docs-signature/task-3.3.2-prompt.md
```

**Actions principales attendues** :
- Service `repo/packages/docs/src/services/s3-multitenant.service.ts`
- Methods :
- Bucket configuration prod :
- Bucket archive separe : `skalean-insurtech-{env}-{tenant_id}-archive` :
- Bucket photos separe : `skalean-insurtech-{env}-{tenant_id}-photos` :
- KMS integration : key per tenant `alias/skalean-insurtech-{env}-{tenant_id}` (Sprint 35 prod)

**Fichiers cibles principaux** :
  - `repo/packages/docs/src/services/s3-multitenant.service.ts`
  - `repo/packages/docs/src/services/s3-multitenant.service.spec.ts`
  - `repo/packages/docs/src/services/bucket-lifecycle.service.ts`
  - `repo/apps/api/src/modules/tenant/services/tenant-onboarding.service.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Bucket cree au tenant onboarding
  - V2 (P0) : Upload + download roundtrip OK
  - V3 (P0) : Multi-tenant isolation : tenant A bucket pas accessible depuis tenant B

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
git commit -m "feat(sprint-10): s3 client casablanca + kms + multi-tenant buckets

Task: 3.3.2
Sprint: 10 (Phase 3 / Sprint 3)
Phase: 3 -- Modules Horizontaux
Decisions: see B-10 Tache 3.3.2"
```

---

### Tache 3 / 13 : DocumentService (CRUD + Presigned URLs + Retention)

**Metadonnees** : P0 | 6h | Depend de : Depend de 3.3.2

**But** : Service NestJS metier orchestrant DocumentEntity + S3MultiTenant + KafkaPublisher + AuditLog. CRUD complete + helpers.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-10-docs-signature/task-3.3.3-prompt.md
```

**Actions principales attendues** :
- Service `repo/packages/docs/src/services/document.service.ts`
- Methods :
- Endpoint controller `documents.controller.ts` :
- Multipart parser Fastify `@fastify/multipart`
- Hash SHA-256 compute on upload
- MIME type whitelist : pdf, docx, jpg, jpeg, png (rejette autres pour security)

**Fichiers cibles principaux** :
  - `repo/packages/docs/src/services/document.service.ts`
  - `repo/packages/docs/src/services/document.service.spec.ts`
  - `repo/apps/api/src/modules/docs/controllers/documents.controller.ts`
  - `repo/apps/api/src/modules/docs/dto/document.dto.ts`
  - `repo/apps/api/test/docs/documents.e2e-spec.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : POST upload OK + S3 + DB row
  - V2 (P0) : Hash SHA-256 compute correct (verifier reproductible)
  - V3 (P0) : MIME type non whitelist rejete 400

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
git commit -m "feat(sprint-10): documentservice (crud + presigned urls + retention)

Task: 3.3.3
Sprint: 10 (Phase 3 / Sprint 3)
Phase: 3 -- Modules Horizontaux
Decisions: see B-10 Tache 3.3.3"
```

---

### Tache 4 / 13 : AccessLogService (Track Who Downloaded What When)

**Metadonnees** : P0 | 4h | Depend de : Depend de 3.3.3

**But** : Tracking append-only de tous acces documents (view, download, share) pour audit + compliance + detection abus.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-10-docs-signature/task-3.3.4-prompt.md
```

**Actions principales attendues** :
- Service `repo/packages/docs/src/services/access-log.service.ts`
- Methods :
- Append-only : pas UPDATE / DELETE (table `doc_access_logs` Sprint 2)
- Trigger automatique :
- Endpoint admin : `GET /api/v1/admin/docs/access-logs?document_id=...&user_id=...&date_range=...`
- Detection abus : > 100 downloads / heure same user -> Kafka event `audit.suspicious_access` + alert (Sprint 33)

**Fichiers cibles principaux** :
  - `repo/packages/docs/src/services/access-log.service.ts`
  - `repo/packages/docs/src/services/access-log.service.spec.ts`
  - `repo/apps/api/src/modules/docs/interceptors/log-document-access.interceptor.ts`
  - `repo/apps/api/src/modules/admin/controllers/admin-access-logs.controller.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : View access logged
  - V2 (P0) : Download access logged
  - V3 (P0) : Append-only (pas UPDATE/DELETE)

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
git commit -m "feat(sprint-10): accesslogservice (track who downloaded what when)

Task: 3.3.4
Sprint: 10 (Phase 3 / Sprint 3)
Phase: 3 -- Modules Horizontaux
Decisions: see B-10 Tache 3.3.4"
```

---

### Tache 5 / 13 : PdfGeneratorService + 4 Templates Initiaux

**Metadonnees** : P0 | 7h | Depend de : Depend de 3.3.4

**But** : Service generation PDF via puppeteer (HTML -> PDF) avec 4 templates initiaux : devis, facture, police, sinistre-rapport.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-10-docs-signature/task-3.3.5-prompt.md
```

**Actions principales attendues** :
- Service `repo/packages/docs/src/services/pdf-generator.service.ts`
- Method `generate(templateName, locale, data): Promise<Buffer>` -- retourne PDF buffer
- Method `generateAndSave(templateName, locale, data, metadata): Promise<Document>` -- shortcut : genere + upload S3 + INSERT row
- Templates Handlebars dans `repo/packages/docs/src/templates/{templateName}.hbs` :
- Templates 3 locales (fr / ar-MA / ar) avec RTL support
- Layout shared : header logo Skalean (ou tenant branding) + footer (numero page, date generation)

**Fichiers cibles principaux** :
  - `repo/packages/docs/src/services/pdf-generator.service.ts`
  - `repo/packages/docs/src/services/pdf-generator.service.spec.ts`
  - `repo/packages/docs/src/templates/_layout.hbs`
  - `repo/packages/docs/src/templates/devis.hbs`
  - `repo/packages/docs/src/templates/facture.hbs`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : generate(devis, fr, data) retourne PDF Buffer valide
  - V2 (P0) : 4 templates fonctionnent
  - V3 (P0) : 3 locales fr/ar-MA/ar

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
git commit -m "feat(sprint-10): pdfgeneratorservice + 4 templates initiaux

Task: 3.3.5
Sprint: 10 (Phase 3 / Sprint 3)
Phase: 3 -- Modules Horizontaux
Decisions: see B-10 Tache 3.3.5"
```

---

### Tache 6 / 13 : sig_signing_workflows Entity + SigningWorkflowService

**Metadonnees** : P0 | 7h | Depend de : Depend de 3.3.5

**But** : Migration table `sig_signing_workflows` + service orchestrating workflow signature : initiate -> send to signer -> wait -> complete -> archive.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-10-docs-signature/task-3.3.6-prompt.md
```

**Actions principales attendues** :
- Migration TypeORM : table `sig_signing_workflows` :
- Entity correspondante
- Service `repo/packages/signature/src/services/signing-workflow.service.ts` :
- Endpoints controller :
- Signers structure : `[{ name, email, phone, role: 'signer' | 'approver', order: 1 }]`
- expires_at : default 7 jours, configurable

**Fichiers cibles principaux** :
  - `repo/packages/database/src/migrations/{date}-SigningWorkflows.ts`
  - `repo/packages/signature/src/entities/sig-signing-workflow.entity.ts`
  - `repo/packages/signature/src/services/signing-workflow.service.ts`
  - `repo/packages/signature/src/services/signing-workflow.service.spec.ts`
  - `repo/apps/api/src/modules/signature/controllers/workflows.controller.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Migration creee
  - V2 (P0) : createWorkflow stocke signers JSONB
  - V3 (P0) : Status transitions valides only

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
git commit -m "feat(sprint-10): sig_signing_workflows entity + signingworkflowservice

Task: 3.3.6
Sprint: 10 (Phase 3 / Sprint 3)
Phase: 3 -- Modules Horizontaux
Decisions: see B-10 Tache 3.3.6"
```

---

### Tache 7 / 13 : Barid eSign API Client + Workflow Envoi

**Metadonnees** : P0 | 6h | Depend de : Depend de 3.3.6

**But** : Client Barid eSign integration : workflow envoi document avec signers + tracking + completion callback.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-10-docs-signature/task-3.3.7-prompt.md
```

**Actions principales attendues** :
- Service `repo/packages/signature/src/providers/barid-esign/barid-esign.client.ts`
- Methods :
- Authentification : API key bearer (env `BARID_ESIGN_API_KEY`)
- HTTP client undici avec retry exponential
- Error handling : `BaridUnavailableError`, `BaridInvalidSignerError`, `BaridSignatureExpiredError`
- Mock client `MockBaridEsignClient` pour tests

**Fichiers cibles principaux** :
  - `repo/packages/signature/src/providers/barid-esign/barid-esign.client.ts`
  - `repo/packages/signature/src/providers/barid-esign/barid-esign.client.spec.ts`
  - `repo/packages/signature/src/providers/barid-esign/types.ts`
  - `repo/packages/signature/src/providers/barid-esign/errors.ts`
  - `repo/packages/signature/src/providers/barid-esign/mock-barid.client.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : createSignatureRequest reussi (mock retourne workflow_id)
  - V2 (P0) : Signers structure correcte
  - V3 (P0) : Signature type qualified utilise

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
git commit -m "feat(sprint-10): barid esign api client + workflow envoi

Task: 3.3.7
Sprint: 10 (Phase 3 / Sprint 3)
Phase: 3 -- Modules Horizontaux
Decisions: see B-10 Tache 3.3.7"
```

---

### Tache 8 / 13 : Hash SHA-256 + Horodatage Qualifie ANRT

**Metadonnees** : P0 | 4h | Depend de : Depend de 3.3.7

**But** : Apres signature complete, applique horodatage qualifie ANRT (Time Stamping Authority RFC 3161) sur hash document signe, prouvant date precise + integrite.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-10-docs-signature/task-3.3.8-prompt.md
```

**Actions principales attendues** :
- Service `repo/packages/signature/src/services/timestamp-anrt.service.ts`
- Method `applyTimestamp(documentBuffer): Promise<{ timestamp_token, applied_at, tsa_certificate }>` -- request TSA ANRT, retourne token RFC 3161
- Method `verifyTimestamp(token, documentBuffer): Promise<{ valid, applied_at, tsa_info }>` -- verify token + match document hash
- HTTP client TSA : URL `env.ANRT_TIMESTAMP_TSA_URL`, mTLS auth (client cert + key)
- Storage : column `sig_signing_workflows.tsa_timestamp_token` (text -- base64 RFC 3161 token), `tsa_applied_at` (timestamptz)
- Hash document : SHA-256 du PDF signe (apres Barid signature, avant archive)

**Fichiers cibles principaux** :
  - `repo/packages/signature/src/services/timestamp-anrt.service.ts`
  - `repo/packages/signature/src/services/timestamp-anrt.service.spec.ts`
  - `repo/packages/database/src/migrations/{date}-AddTsaTimestampColumns.ts`
  - `repo/packages/signature/package.json`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : applyTimestamp retourne token + applied_at
  - V2 (P0) : verifyTimestamp valid token retourne genTime correct
  - V3 (P0) : verifyTimestamp tampered document retourne invalid

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
git commit -m "feat(sprint-10): hash sha-256 + horodatage qualifie anrt

Task: 3.3.8
Sprint: 10 (Phase 3 / Sprint 3)
Phase: 3 -- Modules Horizontaux
Decisions: see B-10 Tache 3.3.8"
```

---

### Tache 9 / 13 : Webhook Receiver Barid eSign

**Metadonnees** : P0 | 5h | Depend de : Depend de 3.3.8

**But** : Endpoint public recevant webhooks Barid eSign (signature complete, declined, expired) + signature HMAC verification + apply horodatage ANRT + transition workflow.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-10-docs-signature/task-3.3.9-prompt.md
```

**Actions principales attendues** :
- Controller `repo/apps/api/src/modules/signature/controllers/barid-webhook.controller.ts`
- Endpoint `POST /api/v1/public/webhooks/barid-esign` (public, signature verification)
- Verify HMAC SHA-256 signature header `X-Barid-Signature` (env `BARID_ESIGN_WEBHOOK_SECRET`)
- Idempotency : `comm_webhooks_received` pattern (Sprint 9) + idempotency_key
- Process events :
- Process async via Kafka consumer (return 200 OK immediate to Barid)

**Fichiers cibles principaux** :
  - `repo/apps/api/src/modules/signature/controllers/barid-webhook.controller.ts`
  - `repo/apps/api/src/modules/signature/middleware/barid-signature.middleware.ts`
  - `repo/apps/api/src/modules/signature/consumers/barid-webhook-processor.consumer.ts`
  - `repo/apps/api/test/signature/barid-webhook.e2e-spec.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Webhook signature_completed processed
  - V2 (P0) : ANRT timestamp applique apres Barid completion
  - V3 (P0) : Workflow status updated

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
git commit -m "feat(sprint-10): webhook receiver barid esign

Task: 3.3.9
Sprint: 10 (Phase 3 / Sprint 3)
Phase: 3 -- Modules Horizontaux
Decisions: see B-10 Tache 3.3.9"
```

---

### Tache 10 / 13 : sig_audit_trails Immutable + AuditTrailService

**Metadonnees** : P0 | 4h | Depend de : Depend de 3.3.9

**But** : Migration table append-only `sig_audit_trails` + service log toutes etapes signature : viewed, signed, declined, etc. Preuve juridique loi 43-20.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-10-docs-signature/task-3.3.10-prompt.md
```

**Actions principales attendues** :
- Migration TypeORM : table `sig_audit_trails` :
- Service `repo/packages/signature/src/services/audit-trail.service.ts`
- Methods :
- RLS active : tenant isolation
- No UPDATE policy, NO DELETE policy : append-only enforced DB-level
- Endpoint `GET /api/v1/signature/workflows/:id/audit-trail` (download PDF)

**Fichiers cibles principaux** :
  - `repo/packages/database/src/migrations/{date}-SigAuditTrails.ts`
  - `repo/packages/signature/src/entities/sig-audit-trail.entity.ts`
  - `repo/packages/signature/src/services/audit-trail.service.ts`
  - `repo/packages/docs/src/templates/audit-trail.hbs`
  - `repo/apps/api/test/signature/audit-trail.e2e-spec.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Table cree append-only
  - V2 (P0) : INSERT events fonctionne
  - V3 (P0) : UPDATE / DELETE rejetes (no policy)

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
git commit -m "feat(sprint-10): sig_audit_trails immutable + audittrailservice

Task: 3.3.10
Sprint: 10 (Phase 3 / Sprint 3)
Phase: 3 -- Modules Horizontaux
Decisions: see B-10 Tache 3.3.10"
```

---

### Tache 11 / 13 : Public Verify Controller (Verification Document via Hash)

**Metadonnees** : P0 | 4h | Depend de : Depend de 3.3.10

**But** : Endpoint public permettant a qui que ce soit (juge, controleur ACAPS, client) verifier un document signe : "ce hash correspond-t-il a un document Skalean signe legitimement ?"

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-10-docs-signature/task-3.3.11-prompt.md
```

**Actions principales attendues** :
- Controller `repo/apps/api/src/modules/signature/controllers/public-verify.controller.ts`
- Endpoint `GET /api/v1/public/verify-doc/:hash` (public, no auth, rate limited 60/h per IP) :
- Response data publique :
- Page HTML simple : `GET /verify/:hash` retourne HTML simple avec details (alternative JSON)
- Audit log : verifications tracked (qui scan + quand)
- Detection abus : > 100 verif / IP / heure -> rate limit + Kafka event

**Fichiers cibles principaux** :
  - `repo/apps/api/src/modules/signature/controllers/public-verify.controller.ts`
  - `repo/packages/docs/src/templates/verify-page.hbs`
  - `repo/apps/api/test/signature/public-verify.e2e-spec.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : GET hash valide retourne details
  - V2 (P0) : GET hash invalide retourne 404
  - V3 (P0) : Document signed status retourne signing details

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
git commit -m "feat(sprint-10): public verify controller (verification document via hash)

Task: 3.3.11
Sprint: 10 (Phase 3 / Sprint 3)
Phase: 3 -- Modules Horizontaux
Decisions: see B-10 Tache 3.3.11"
```

---

### Tache 12 / 13 : SealedArchiveService (Bucket WORM 10 Ans + 1 Jour)

**Metadonnees** : P0 | 5h | Depend de : Depend de 3.3.11

**But** : Apres signature complete + ANRT timestamp, archive document dans bucket S3 dedie `*-archive` avec Object Lock COMPLIANCE mode (immutable 10 ans + 1 jour).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-10-docs-signature/task-3.3.12-prompt.md
```

**Actions principales attendues** :
- Service `repo/packages/signature/src/services/sealed-archive.service.ts`
- Method `archive(workflowId): Promise<{ archive_url, archive_hash, locked_until }>` :
- Migration TypeORM : table `sig_archives` (id, tenant_id, workflow_id, archive_bucket, archive_key, archive_sha256, locked_until, manifest_json, created_at)
- Bucket archive S3 (Tache 3.3.2 deja prepare) : Object Lock COMPLIANCE
- Methods auxiliaires :
- Trigger via Kafka event `signature.workflow_completed` -> consumer

**Fichiers cibles principaux** :
  - `repo/packages/signature/src/services/sealed-archive.service.ts`
  - `repo/packages/database/src/migrations/{date}-SigArchives.ts`
  - `repo/packages/signature/src/entities/sig-archive.entity.ts`
  - `repo/apps/api/src/modules/signature/consumers/archive-on-completion.consumer.ts`
  - `repo/apps/api/test/signature/sealed-archive.e2e-spec.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : archive() reussit + bucket archive contient document
  - V2 (P0) : Object Lock locked_until = signed_at + 10 ans + 1 jour
  - V3 (P0) : Tentative DELETE archive object rejete (Object Lock)

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
git commit -m "feat(sprint-10): sealedarchiveservice (bucket worm 10 ans + 1 jour)

Task: 3.3.12
Sprint: 10 (Phase 3 / Sprint 3)
Phase: 3 -- Modules Horizontaux
Decisions: see B-10 Tache 3.3.12"
```

---

### Tache 13 / 13 : Tests E2E Exhaustifs (40+) avec Mocks + Seeds

**Metadonnees** : P0 | 8h | Depend de : Depend de 3.3.12

**But** : Suite tests E2E avec mock Barid eSign + mock ANRT TSA + tests integration full workflow signature.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-10-docs-signature/task-3.3.13-prompt.md
```

**Actions principales attendues** :
- Documents : upload + download + versions + RBAC + multi-tenant (8 tests)
- PDF generation : 4 templates x 3 locales = 12 outputs verifies (snapshot tests)
- S3 multi-tenant : isolation, presigned URLs TTL, lifecycle (4 tests)
- Access logs : log download, detection abus (3 tests)
- Signing workflow : create + send + status + cancel (5 tests)
- Barid eSign : create signature request mock + status (3 tests)

**Fichiers cibles principaux** :
  - `repo/apps/api/test/docs/{20 specs}.e2e-spec.ts`
  - `repo/apps/api/test/signature/{20 specs}.e2e-spec.ts`
  - `repo/apps/api/test/fixtures/mock-barid-server.ts`
  - `repo/apps/api/test/fixtures/mock-anrt-tsa.ts`
  - `repo/infrastructure/scripts/seed-docs-signature.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 40+ tests passent
  - V2 (P0) : Tests passent CI
  - V3 (P0) : Mocks complets fonctionnels

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
git commit -m "feat(sprint-10): tests e2e exhaustifs (40+) avec mocks + seeds

Task: 3.3.13
Sprint: 10 (Phase 3 / Sprint 3)
Phase: 3 -- Modules Horizontaux
Decisions: see B-10 Tache 3.3.13"
```

---


## VERIFICATION DU SPRINT 10

Une fois les 13 taches terminees et commitees, **lancer la verification automatique** :

```bash
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-10-sprint-10-verification.md
```

Le fichier de verification V-10 contient :

- **Criteres P0 bloquants** : compilation TypeScript / tests Vitest / Biome lint / no-emoji / conventional commits
- **Criteres P1 avertissements** : couverture >= 85% / dependencies coherentes / docs API / metriques performance
- **Criteres P2 notes** : coverage >= 90% modules critiques / lighthouse score / accessibility
- **Auto-reparation** pour criteres recuperables (e.g. relance tests flaky)
- **Generation automatique** du rapport `sprint10-verify-report.md`
- **Calcul score global** + statut GO / GO CONDITIONNEL / NO-GO

**Score minimum requis pour GO** : >= 95% (sprint termine, GO Sprint suivant)
**Score minimum pour GO CONDITIONNEL** : 85-94% (hot fix requis, retard <= 1 semaine)
**En dessous de 85%** : NO-GO, **reprise sprint requise** (escalation Saad/Abla decision)

Apres execution, lire le rapport :

```bash
cat skalean-insurtech/sprint10-verify-report.md
```

Si statut **GO** ou **GO CONDITIONNEL**, executer le commit de cloture :

```bash
git add skalean-insurtech/sprint10-verify-report.md
git commit -m "chore(sprint-10): close sprint 10 with verification report

- Score global : {SCORE}%
- Statut : {GO|GO CONDITIONNEL}
- Phase : 3 (Modules Horizontaux)
- Sprint : 10 (Phase 3 / Sprint 3)
- Apport : Signature loi 43-20 conforme + Barid eSign + ANRT TSA
- Tests E2E cumules : {N}+

Sprint 10 completed -- handoff to Sprint 11."
```

---

## RESUME DU WORKFLOW

```
[Demarrage Sprint 10]
   |
   v
[Tache 3.3.1: Entities Documents + Versions Enrichies]
   | -> compile -> tests -> commit
   v
[Tache 3.3.2: S3 Client Casablanca + KMS + Multi-Tenant Buckets]
   | -> compile -> tests -> commit
   v
[Tache 3.3.3: DocumentService (CRUD + Presigned URLs + Retention)]
   | -> compile -> tests -> commit
   v
[Tache 3.3.4: AccessLogService (Track Who Downloaded What When)]
   | -> compile -> tests -> commit
   v
[Tache 3.3.5: PdfGeneratorService + 4 Templates Initiaux]
   | -> compile -> tests -> commit
   v
[Tache 3.3.6: sig_signing_workflows Entity + SigningWorkflowService]
   | -> compile -> tests -> commit
   v
[Tache 3.3.7: Barid eSign API Client + Workflow Envoi]
   | -> compile -> tests -> commit
   v
[Tache 3.3.8: Hash SHA-256 + Horodatage Qualifie ANRT]
   | -> compile -> tests -> commit
   v
[Tache 3.3.9: Webhook Receiver Barid eSign]
   | -> compile -> tests -> commit
   v
[Tache 3.3.10: sig_audit_trails Immutable + AuditTrailService]
   | -> compile -> tests -> commit
   v
[Tache 3.3.11: Public Verify Controller (Verification Document via Has]
   | -> compile -> tests -> commit
   v
[Tache 3.3.12: SealedArchiveService (Bucket WORM 10 Ans + 1 Jour)]
   | -> compile -> tests -> commit
   v
[Tache 3.3.13: Tests E2E Exhaustifs (40+) avec Mocks + Seeds]
   | -> compile -> tests -> commit
   v
[Verification automatique sprint 10 -- V-10]
   |
   v
[Rapport sprint10-verify-report.md]
   |
   v
[Score >= 95%] -> GO -> commit cloture sprint -> Sprint suivant
[Score 85-94%] -> GO CONDITIONNEL -> hot fix puis cloture
[Score < 85%]  -> NO-GO -> reprise sprint
```

**Duree totale estimee** : 75 heures (5h par tache moyenne -- 2 devs FTE en parallele).

**Modules skalean-insurtech affectes** : @insurtech/crm, @insurtech/booking, @insurtech/comm, @insurtech/docs, @insurtech/signature, @insurtech/pay, @insurtech/books, @insurtech/compliance, @insurtech/analytics, @insurtech/stock, @insurtech/hr

**Apport metier principal** : Signature loi 43-20 conforme + Barid eSign + ANRT TSA.

**Prerequis Sprint 11** : Sprint 10 GO complet (score >= 95% verification automatique V-10).

**Sprint suivant** : Sprint 11.

---

## COMMANDES DE LANCEMENT

### Prerequis Sprint 9 (verification GO)

```bash
# Verifier Sprint 9 GO
ls skalean-insurtech/sprint09-verify-report.md
grep '^Statut.*GO' skalean-insurtech/sprint09-verify-report.md
```

### Lancement Sprint 10 (Cowork lit cet orchestrateur)

```bash
# Cowork command (claude-code or cowork CLI) :
claude-code \
  --orchestrator skalean-insurtech/00-pilotage/meta-prompts/phase-C-orchestration/C-10-sprint-10-docs-signature.md \
  --reference-prompt skalean-insurtech/00-pilotage/meta-prompts/phase-B-tasks/B-10-sprint-10-docs-signature.md \
  --verification skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-10-sprint-10-verification.md
```

### Suivi temps reel execution

```bash
# Tail le log Cowork
tail -f skalean-insurtech/cowork-sprint-10.log

# Verifier progression commits
git log --oneline --since="2 weeks ago" -- repo/ | grep "Sprint: 10"
```

### Apres completion -- verifier rapport

```bash
cat skalean-insurtech/sprint10-verify-report.md
```

---

## NOTES IMPORTANTES POUR COWORK

1. **Lire d'abord B-10** complet avant generation prompts taches (contexte critique)
2. **Generer les 13 prompts taches** dans `00-pilotage/prompts-taches/sprint-10-*/` AVANT de commencer execution
3. **Toujours respecter l'ordre** des taches (dependances explicites)
4. **Commit chaque tache separement** (granularite Git pour rollback facile)
5. **NE JAMAIS modifier `00-pilotage/`** -- uniquement `repo/`
6. **En cas de doute**, escalader Saad/Abla via Slack `#insurtech-dev` plutot que faire choix arbitraire
7. **Documentation continue** : si tu prends une decision technique, ajouter ADR dans `repo/docs/architecture/`

---

**Fin de l'orchestrateur C-10 v2.2 detaille -- Sprint 10 (3.3) Docs + Signature loi 43-20.**

**Total taches detaillees** : 13 | **Effort cumul** : ~75h | **Apport** : Signature loi 43-20 conforme + Barid eSign + ANRT TSA
