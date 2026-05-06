# META-PROMPT B-08 -- SPRINT 8 CRM + BOOKING

**Version** : v2.2 (Option B)
**Phase** : 3 -- Modules Horizontaux
**Sprint** : 8 / 35 (cumul) -- PREMIER de la Phase 3
**Position** : Premier sprint metier reel apres fondations (Phases 1+2)
**Numerotation taches** : 3.1.1 a 3.1.14
**Effort total** : ~75 heures developpement / 2 semaines
**Priorite** : P0 (premier sprint metier, valide pattern complete)

---

## Objectif Global du Sprint

Implementer **CRM + Booking** comme premier sprint metier reel, validant le **pattern complete** des sprints suivants : controllers + services + entities TypeORM + Zod schemas + multi-tenant + RBAC + ABAC + Kafka events + tests. Les modules CRM et Booking sont **horizontaux** : reutilises par Insure (Phase 4) et Repair (Phase 5) qui referencent contacts CRM et appointments Booking.

A la sortie de ce sprint :
- 4 entites CRM operationnelles : `crm_companies`, `crm_contacts`, `crm_deals`, `crm_interactions`
- 3 entites Booking operationnelles : `booking_rooms`, `booking_appointments`, `booking_calendar_syncs`
- Endpoints REST CRUD complets `/api/v1/crm/*` et `/api/v1/booking/*`
- Full-text search Postgres pg_trgm sur contacts/companies (search rapide < 50ms)
- EXCLUDE constraint validee runtime sur appointments (anti-overlap room)
- Calendar sync Google + Outlook (OAuth2) bi-directionnel
- iCal feed export (token-based, public read-only)
- Custom fields dynamic JSONB (extensibilite sans migration DB)
- Pipelines + stages configurables (deals workflow)
- Timeline interactions par contact (call/email/whatsapp/meeting/note)
- Audit log + Kafka events sur tous CUD operations
- 40+ tests E2E couvrant happy path + edge cases + RBAC + multi-tenant

---

## Frontiere du Sprint

**INCLUS** :
- CRM : Companies + Contacts + Deals + Pipelines + Stages + Interactions
- Custom fields dynamic (JSONB schema validation Zod)
- Full-text search pg_trgm
- Booking : Rooms + Appointments + CalendarSync
- EXCLUDE constraint anti-overlap
- Availability service (slots libres)
- Google Calendar + Outlook sync bi-directionnel
- iCal feed export
- Tests exhaustifs

**EXCLU** (sera ajoute aux sprints suivants) :
- Email/WhatsApp send (Sprint 9 Comm)
- Documents lies aux deals (Sprint 10 Docs)
- Paiements lies aux deals (Sprint 11 Pay)
- Insure-specific quotes/polices (Sprint 14)
- Repair-specific sinistres (Sprint 20)

---

## Lectures Prealables Obligatoires

1. `00-pilotage/documentation/3-schemas-database-PARTIE1.sql` -- 7 tables CRM + Booking
2. `00-pilotage/documentation/4-templates-generation.md` -- Pattern 1 service NestJS
3. `00-pilotage/documentation/5-roles-permissions.md` -- permissions CRM + Booking
4. Sortie Sprint 2 : tables creees + KafkaPublisher
5. Sortie Sprint 3 : API NestJS + transverses
6. Sortie Sprint 5 : auth context (userId)
7. Sortie Sprint 6 : tenant context + SET LOCAL
8. Sortie Sprint 7 : RBAC + ABAC

---

## Stack Imposee (Sprint 8)

| Composant | Version | Notes |
|-----------|---------|-------|
| googleapis | 144.0.0 | Google Calendar API client |
| @microsoft/microsoft-graph-client | 3.0.7 | Outlook Calendar API |
| ical-generator | 8.0.1 | iCal feed export |
| node-ical | 0.20.1 | iCal feed parsing (import) |
| date-fns | 4.1.0 | manipulation dates |
| date-fns-tz | 3.2.0 | timezone Africa/Casablanca |

---

## Vue d'Ensemble des 14 Taches

| # | Tache | Effort | Priorite | Depend de |
|---|-------|--------|----------|-----------|
| 3.1.1 | CRM Companies (entity + service + endpoints + search) | 5h | P0 | Sprint 7 |
| 3.1.2 | CRM Contacts (entity + service + endpoints + search + ICE/CIN validators) | 6h | P0 | 3.1.1 |
| 3.1.3 | CRM Pipelines + Stages (configurables par tenant) | 5h | P0 | 3.1.2 |
| 3.1.4 | CRM Deals (opportunites + workflow stages) | 6h | P0 | 3.1.3 |
| 3.1.5 | CRM Interactions (timeline call/email/whatsapp/meeting/note) | 5h | P0 | 3.1.4 |
| 3.1.6 | Full-text search pg_trgm (cross-CRM contacts + companies + deals) | 4h | P0 | 3.1.5 |
| 3.1.7 | Custom Fields dynamic (JSONB + Zod runtime validation) | 5h | P1 | 3.1.6 |
| 3.1.8 | Booking Rooms (resources reservables + capacity) | 3h | P0 | 3.1.7 |
| 3.1.9 | Booking Appointments + EXCLUDE constraint validation | 6h | P0 | 3.1.8 |
| 3.1.10 | Booking CalendarSync (OAuth2 Google + Outlook + tokens chiffres) | 5h | P0 | 3.1.9 |
| 3.1.11 | Availability Service (slots libres + business hours) | 5h | P0 | 3.1.10 |
| 3.1.12 | Calendar sync bi-directionnel Google + Outlook | 6h | P0 | 3.1.11 |
| 3.1.13 | iCal feed export (token-based public URL) | 4h | P1 | 3.1.12 |
| 3.1.14 | Tests E2E exhaustifs (40+) + seeds dev CRM + Booking | 7h | P0 | 3.1.13 |

**Total** : 72 heures.

---

# DETAIL DES 14 TACHES

---

## Tache 3.1.1 -- CRM Companies (Entity + Service + Endpoints + Search)

**Metadonnees** : Phase 3 / Sprint 8 / P0 / 5h / Depend de Sprint 7

**But** : Premier module metier complet : entity `crm_companies`, service NestJS, endpoints REST CRUD, full-text search trigram. Servira de **template reference** pour modules suivants.

**Contexte** : Companies = entreprises B2B clientes (cabinet courtage / garage). Champs critiques marche MA : ICE (15 chiffres, identifiant fiscal entreprise), RC (Registre Commerce), patente. Sprint 8 valide le pattern complete utilise pour les 60+ autres modules.

**Livrables checkables** :
- [ ] Entity `repo/packages/crm/src/entities/crm-company.entity.ts` (Sprint 2 a deja la migration)
- [ ] Service `repo/packages/crm/src/services/companies.service.ts` :
  - `create(data, userId)` : valide ICE format + creates row + audit + Kafka event
  - `findById(id)` : retourne avec RLS auto (tenant_id filter via `app_current_tenant`)
  - `findAll(filters, pagination)` : list avec filtres (industry, city, search) + tri
  - `update(id, data, userId)` : update + diff in audit_log
  - `softDelete(id, userId)` : set deleted_at + audit
- [ ] Controller `repo/apps/api/src/modules/crm/controllers/companies.controller.ts` :
  - `POST /api/v1/crm/companies` -- create
  - `GET /api/v1/crm/companies` -- list with pagination + search
  - `GET /api/v1/crm/companies/:id` -- get details
  - `PATCH /api/v1/crm/companies/:id` -- update
  - `DELETE /api/v1/crm/companies/:id` -- soft delete
  - `GET /api/v1/crm/companies/:id/contacts` -- list contacts de la company
- [ ] Schema Zod : `CreateCompanySchema`, `UpdateCompanySchema`, `CompanyFiltersSchema`
- [ ] Permissions appliquees (Sprint 7) : `crm.companies.create`, `crm.companies.read`, `crm.companies.update`, `crm.companies.delete`
- [ ] ICE validation : 15 chiffres regex `/^\d{15}$/` + checksum (algorithme officiel MA)
- [ ] Pagination : page (default 1) + pageSize (default 25, max 100)
- [ ] Tri : created_at DESC default
- [ ] Search query : trigram similarity sur name + ICE (utilise GIN index Sprint 2)
- [ ] Audit log automatique sur tous CUD (subscriber Sprint 2)
- [ ] Kafka events : `crm.company_created`, `crm.company_updated`, `crm.company_deleted`
- [ ] Tests integration : CRUD complet + RBAC reject + multi-tenant isolation

**Pattern critique : controller standard reutilise pour tous modules**

```typescript
// repo/apps/api/src/modules/crm/controllers/companies.controller.ts
@Controller('crm/companies')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
@ApiTags('CRM Companies')
export class CompaniesController {
  constructor(private companiesService: CompaniesService) {}

  @Post()
  @RequirePermission(Permission.CRM_COMPANIES_CREATE)
  @ApiOperation({ summary: 'Create company' })
  async create(
    @Body(new ZodValidationPipe(CreateCompanySchema)) dto: CreateCompanyDto,
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.companiesService.create(dto, tenantId, user.id);
  }

  @Get()
  @RequirePermission(Permission.CRM_COMPANIES_READ)
  async list(
    @Query(new ZodValidationPipe(CompanyFiltersSchema)) filters: CompanyFiltersDto,
    @TenantId() tenantId: string,
  ) {
    return this.companiesService.findAll(filters, tenantId);
  }

  @Get(':id')
  @RequirePermission(Permission.CRM_COMPANIES_READ)
  @AbacResource('crm_company')  // Sprint 7 : check ownership pour read_own
  async getById(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.companiesService.findById(id, tenantId);
  }

  @Patch(':id')
  @RequirePermission(Permission.CRM_COMPANIES_UPDATE)
  @AbacResource('crm_company')
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateCompanySchema)) dto: UpdateCompanyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.companiesService.update(id, dto, user.id);
  }

  @Delete(':id')
  @RequirePermission(Permission.CRM_COMPANIES_DELETE)
  @AbacResource('crm_company')
  async delete(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.companiesService.softDelete(id, user.id);
  }
}
```

**Fichiers crees / modifies** :
```
repo/packages/crm/src/entities/crm-company.entity.ts                 # ~50 lignes (TypeORM + Zod)
repo/packages/crm/src/services/companies.service.ts                   # ~200 lignes
repo/packages/crm/src/services/companies.service.spec.ts              # ~150 lignes
repo/packages/crm/src/schemas/company.schema.ts                       # ~40 lignes (Zod)
repo/packages/crm/src/validators/ice.validator.ts                      # ~60 lignes (ICE checksum MA)
repo/packages/crm/src/validators/ice.validator.spec.ts                  # ~50 lignes
repo/apps/api/src/modules/crm/controllers/companies.controller.ts      # ~120 lignes
repo/apps/api/src/modules/crm/crm.module.ts                            # init CRM module
repo/apps/api/test/crm/companies.e2e-spec.ts                            # tests E2E
```

**Notes implementation** :
- Service utilise `EntityManager` injecte via `TenantTransactionInterceptor` Sprint 6 (SET LOCAL deja done)
- ICE validator : algorithme checksum officiel + position pays + position activite (extensible)
- Search trigram : `WHERE name % $1 OR ice ILIKE $1 OR similarity(name, $1) > 0.3` (utilise GIN index Sprint 2)
- Pattern controller chain Guards : `JwtAuthGuard` (Sprint 5) + `TenantContextGuard` (Sprint 6) + `PermissionGuard` (Sprint 7) + `@AbacResource()` ABAC granular
- Service publish event KafkaPublisher Sprint 2 : `Topics.CRM_COMPANY_CREATED`
- Soft delete (vs hard delete) : preserve audit + foreign keys references

**Criteres validation** :
- V1 (P0) : POST cree company + audit + Kafka event
- V2 (P0) : GET liste avec pagination + filtres
- V3 (P0) : GET /:id retourne details (ABAC : @owner peut read OK)
- V4 (P0) : PATCH update + diff in audit
- V5 (P0) : DELETE soft delete (deleted_at set)
- V6 (P0) : ICE invalide (14 ou 16 chiffres) rejete 400
- V7 (P0) : ICE checksum invalide rejete 400
- V8 (P0) : Search trigram performant (< 50ms sur 10k rows)
- V9 (P0) : Multi-tenant : tenant A ne voit pas tenant B
- V10 (P0) : RBAC : sans permission -> 403
- V11 (P1) : Tests E2E 8+ scenarios passent

---

## Tache 3.1.2 -- CRM Contacts (Entity + Service + Endpoints + Search + Validators)

**Metadonnees** : Phase 3 / Sprint 8 / P0 / 6h / Depend de 3.1.1

**But** : Module Contacts (personnes physiques) avec validators MA (CIN, phone E.164 +212), preferred language/channel.

**Livrables checkables** :
- [ ] Entity `crm_contact.entity.ts` (Sprint 2 migration deja appliquee)
- [ ] Service `contacts.service.ts` (5 methods CRUD + 1 search)
- [ ] Controller `contacts.controller.ts` (5 endpoints REST)
- [ ] Schemas Zod : `CreateContactSchema`, `UpdateContactSchema`, `ContactFiltersSchema`
- [ ] Validators MA :
  - CIN : regex `/^[A-Z]{1,2}\d{6,8}$/` (1-2 lettres prefecture + 6-8 chiffres)
  - Phone E.164 : `+212` + (6 ou 7) + 8 chiffres -- 13 chars total ou 14 (mobile vs fixe)
  - Email citext (case-insensitive deja Sprint 2 column type)
- [ ] Endpoints :
  - `POST /api/v1/crm/contacts`
  - `GET /api/v1/crm/contacts` (filtres : company_id, segment, tags, search)
  - `GET /api/v1/crm/contacts/:id` (avec relations company + interactions count)
  - `PATCH /api/v1/crm/contacts/:id`
  - `DELETE /api/v1/crm/contacts/:id`
  - `GET /api/v1/crm/contacts/:id/interactions` (lie a Tache 3.1.5)
  - `GET /api/v1/crm/contacts/:id/deals` (lie a Tache 3.1.4)
- [ ] Permissions : `crm.contacts.create/read/update/delete` + `crm.contacts.read_own` (ABAC)
- [ ] Champ `preferred_language` : enum `'fr' | 'ar-MA' | 'ar'` (utilise Sprint 9 Comm pour template selection)
- [ ] Champ `preferred_channel` : enum `'whatsapp' | 'email' | 'sms' | 'voice'` (utilise Sprint 9 Comm pour routing)
- [ ] UNIQUE constraint `(tenant_id, cin)` deja Sprint 2 -- tester duplicate rejection
- [ ] Audit + Kafka events
- [ ] Tests integration

**Fichiers crees / modifies** :
```
repo/packages/crm/src/entities/crm-contact.entity.ts                  # ~60 lignes
repo/packages/crm/src/services/contacts.service.ts                     # ~220 lignes
repo/packages/crm/src/schemas/contact.schema.ts                        # ~50 lignes
repo/packages/crm/src/validators/cin.validator.ts                       # ~40 lignes
repo/packages/crm/src/validators/phone-ma.validator.ts                  # ~50 lignes
repo/apps/api/src/modules/crm/controllers/contacts.controller.ts        # ~150 lignes
repo/apps/api/test/crm/contacts.e2e-spec.ts                              # ~150 lignes
```

**Notes implementation** :
- CIN format MA : `[Prefix lettres][6-8 chiffres]` (e.g. `A123456`, `BB1234567`)
- Phone E.164 : strict format `+212` (pas `00212` ou `0`) -- normalisation a l'input
- Computed column `full_name` (deja Sprint 2) auto-mis a jour : `first_name || ' ' || last_name`
- preferred_language par defaut 'fr' si non specifie (audience principale MA bilingue)
- preferred_channel : utilise Sprint 9 pour decider whatsapp vs email
- Search trigram : `full_name`, `email`, `phone`, `cin`

**Criteres validation** :
- V1 (P0) : CRUD complet operationnel
- V2 (P0) : CIN invalide rejete (3+ scenarios)
- V3 (P0) : Phone non-E.164 rejete + suggestion normalisation
- V4 (P0) : UNIQUE (tenant_id, cin) actif (duplicate rejected)
- V5 (P0) : Search trigram < 50ms sur 10k contacts
- V6 (P0) : Computed full_name auto-update
- V7 (P0) : preferred_language enum stricte
- V8 (P0) : Multi-tenant + RBAC + ABAC actifs
- V9 (P0) : Audit + Kafka
- V10 (P1) : Tests 12+ scenarios

---

## Tache 3.1.3 -- CRM Pipelines + Stages

**Metadonnees** : Phase 3 / Sprint 8 / P0 / 5h / Depend de 3.1.2

**But** : Pipelines configurables par tenant pour deals workflow (e.g. "Pipeline Auto", "Pipeline Sante", "Pipeline Pro Garage") avec stages personnalisables.

**Contexte** : Chaque tenant peut avoir plusieurs pipelines selon segments business. Stages = colonnes Kanban (lead -> qualified -> proposal -> negotiation -> won/lost). Configurable evite hardcoder workflow specifique.

**Livrables checkables** :
- [ ] Migration TypeORM : tables `crm_pipelines` + `crm_pipeline_stages`
  - `crm_pipelines` : id, tenant_id, name, description, is_default (bool), active (bool), created_at, updated_at
  - `crm_pipeline_stages` : id, pipeline_id, name, position (int), probability (numeric 0-100, % chance closure), color (text hex), is_terminal (bool -- won/lost), terminal_type (enum 'won' | 'lost' | NULL), created_at, updated_at
- [ ] Entity + service + controller pour pipelines (CRUD)
- [ ] Entity + service pour stages (managed via pipeline endpoints)
- [ ] Endpoints :
  - `POST /api/v1/crm/pipelines` (create avec stages array)
  - `GET /api/v1/crm/pipelines` (list, default first)
  - `GET /api/v1/crm/pipelines/:id` (avec stages)
  - `PATCH /api/v1/crm/pipelines/:id` (update + reorder stages)
  - `DELETE /api/v1/crm/pipelines/:id` (refuse si default OR si deals existants)
- [ ] Validation : pipeline doit avoir AU MOINS 2 stages, AU MOINS 1 terminal_type='won', AU MOINS 1 terminal_type='lost'
- [ ] Default stages template : "Lead, Qualified, Proposal, Negotiation, Won, Lost" (cree au tenant onboarding Sprint 6 update)
- [ ] Position stages : reorder via API (drag-drop frontend Sprint 17)
- [ ] Tests : create pipeline avec stages, reorder, delete bloque si deals

**Fichiers crees / modifies** :
```
repo/packages/database/src/migrations/{date}-CrmPipelinesStages.ts       # ~80 lignes
repo/packages/crm/src/entities/crm-pipeline.entity.ts                     # ~30 lignes
repo/packages/crm/src/entities/crm-pipeline-stage.entity.ts               # ~35 lignes
repo/packages/crm/src/services/pipelines.service.ts                       # ~200 lignes
repo/packages/crm/src/schemas/pipeline.schema.ts                          # ~50 lignes
repo/apps/api/src/modules/crm/controllers/pipelines.controller.ts         # ~120 lignes
repo/apps/api/test/crm/pipelines.e2e-spec.ts                                # ~120 lignes
```

**Notes implementation** :
- `is_default` : un seul pipeline default par tenant (UNIQUE partial : `WHERE is_default = true`)
- `position` : managed automatique au create + reorder API
- `is_terminal` : final stages (won/lost) -- deals dans terminal stages = closed
- `probability` : utilise pour forecast (deals weighted by probability)
- Default stages template appliquee au tenant onboarding -- update Sprint 6 onboarding service
- Delete pipeline avec deals : 409 Conflict + suggest archive vs delete

**Criteres validation** :
- V1 (P0) : POST cree pipeline + stages atomiquement
- V2 (P0) : GET retourne pipelines avec stages tries par position
- V3 (P0) : PATCH reorder stages
- V4 (P0) : Validation : pipeline sans terminal won OR lost rejete
- V5 (P0) : DELETE refuse si deals existants
- V6 (P0) : `is_default` UNIQUE par tenant
- V7 (P0) : Tests 8+ scenarios

---

## Tache 3.1.4 -- CRM Deals (Opportunites + Workflow Stages)

**Metadonnees** : Phase 3 / Sprint 8 / P0 / 6h / Depend de 3.1.3

**But** : Deals (opportunites commerciales) avec stage tracking, montant, dates, et workflow stage transitions auditees.

**Livrables checkables** :
- [ ] Entity `crm_deal.entity.ts` (Sprint 2 migration)
- [ ] Service `deals.service.ts` :
  - CRUD + `moveToStage(dealId, newStageId, reason)` -- transitions auditees
  - `won(dealId, reason)` + `lost(dealId, reason)` -- shortcuts pour terminal stages
  - `archive(dealId)` (Phase 7+ pour terminal cleanup)
- [ ] Controller :
  - `POST /api/v1/crm/deals` (create avec contact_id obligatoire)
  - `GET /api/v1/crm/deals` (filtres : contact_id, company_id, stage_id, owner_user_id, status, amount_range)
  - `GET /api/v1/crm/deals/:id`
  - `PATCH /api/v1/crm/deals/:id` (update general)
  - `POST /api/v1/crm/deals/:id/move-stage` (body : stage_id, reason)
  - `POST /api/v1/crm/deals/:id/won` (body : reason)
  - `POST /api/v1/crm/deals/:id/lost` (body : reason)
  - `DELETE /api/v1/crm/deals/:id` (soft delete)
  - `GET /api/v1/crm/deals/forecast` (aggregate weighted by probability)
- [ ] Stage transitions audit : event Kafka `deal.stage_changed` avec `old_stage_id, new_stage_id, reason, user_id`
- [ ] Validation amount : numeric 15,2 (>= 0)
- [ ] Currency MAD default
- [ ] expected_close_date : futur ou aujourd'hui
- [ ] won_at / lost_at : auto-set quand transition terminal
- [ ] Permissions : `crm.deals.create/read/update/delete/move_stage`
- [ ] Tests : create + transitions + won/lost + forecast

**Fichiers crees / modifies** :
```
repo/packages/crm/src/entities/crm-deal.entity.ts                      # ~50 lignes
repo/packages/crm/src/services/deals.service.ts                         # ~250 lignes (+ moveToStage logic)
repo/packages/crm/src/schemas/deal.schema.ts                            # ~50 lignes
repo/apps/api/src/modules/crm/controllers/deals.controller.ts          # ~180 lignes
repo/apps/api/test/crm/deals.e2e-spec.ts                                 # ~150 lignes
```

**Notes implementation** :
- moveToStage : verifier stage_id appartient au pipeline du deal (consistency)
- won/lost : transitions vers terminal stage du pipeline + auto-set won_at/lost_at
- ABAC OwnResourcesPolicy sur `read_own` / `update_own` : owner_user_id check
- Forecast : `SELECT SUM(amount * probability/100) WHERE status='open' GROUP BY stage`
- Audit log + Kafka : critical pour analytics Sprint 13 (taux conversion)

**Criteres validation** :
- V1 (P0) : CRUD complet deals
- V2 (P0) : moveToStage transition + audit log + Kafka event
- V3 (P0) : won/lost shortcut + auto-set won_at/lost_at
- V4 (P0) : Stage transition vers stage hors pipeline rejete
- V5 (P0) : Forecast agrege correct
- V6 (P0) : ABAC : non-owner read_own deny
- V7 (P0) : Validation amount >= 0
- V8 (P0) : Filtres + pagination
- V9 (P1) : Tests 12+ scenarios

---

## Tache 3.1.5 -- CRM Interactions (Timeline)

**Metadonnees** : Phase 3 / Sprint 8 / P0 / 5h / Depend de 3.1.4

**But** : Log toutes les interactions (call, email, whatsapp, meeting, note) avec un contact pour timeline historique. Append-only (pas d'update).

**Livrables checkables** :
- [ ] Entity `crm_interaction.entity.ts` (Sprint 2 migration)
- [ ] Service `interactions.service.ts` :
  - `logInteraction(contactId, type, direction, content, metadata)` -- append-only
  - `findByContact(contactId, filters, pagination)` -- timeline ordered DESC
  - `findByDeal(dealId, ...)` -- interactions liees a un deal
- [ ] Controller :
  - `POST /api/v1/crm/interactions` (manual log)
  - `GET /api/v1/crm/contacts/:contactId/interactions` (timeline)
  - `GET /api/v1/crm/deals/:dealId/interactions`
  - PAS de PATCH ou DELETE (append-only)
- [ ] Auto-log : event Kafka listeners qui auto-creent interactions :
  - `comm.message_sent` -> auto-log interaction type='whatsapp' ou 'email' direction='outbound'
  - `comm.message_received` (Sprint 9) -> auto-log direction='inbound'
  - `booking.appointment_completed` -> auto-log type='meeting'
- [ ] Type enum : `'call' | 'email' | 'whatsapp' | 'sms' | 'meeting' | 'note'`
- [ ] Direction enum : `'inbound' | 'outbound'`
- [ ] occurred_at vs created_at : occurred_at = quand interaction (peut etre passe), created_at = quand log
- [ ] Permissions : `crm.interactions.create/read`
- [ ] Tests : auto-log via Kafka, timeline contact, RBAC

**Fichiers crees / modifies** :
```
repo/packages/crm/src/entities/crm-interaction.entity.ts                  # ~40 lignes
repo/packages/crm/src/services/interactions.service.ts                     # ~150 lignes
repo/packages/crm/src/services/interactions-auto-logger.consumer.ts        # ~100 lignes (Kafka consumer)
repo/packages/crm/src/schemas/interaction.schema.ts                        # ~30 lignes
repo/apps/api/src/modules/crm/controllers/interactions.controller.ts      # ~80 lignes
repo/apps/api/test/crm/interactions.e2e-spec.ts                             # ~120 lignes
```

**Notes implementation** :
- Append-only : pas de UPDATE / DELETE policies (pas d'endpoints meme)
- Auto-logger consumer : extends KafkaConsumerBase Sprint 2
- Timeline : pagination cursor-based (created_at + id) pour permettre infinite scroll frontend
- Content : free-form text (peut contenir extrait email, transcript call, summary meeting)
- Metadata jsonb : structured data type-specific (ex: email subject, call duration, etc.)

**Criteres validation** :
- V1 (P0) : POST manual log fonctionne
- V2 (P0) : GET timeline contact retourne interactions DESC
- V3 (P0) : Auto-log via event Kafka comm.message_sent
- V4 (P0) : Pas de PATCH/DELETE (append-only enforced)
- V5 (P0) : Pagination cursor-based
- V6 (P0) : occurred_at != created_at supporte (log past)
- V7 (P0) : Multi-tenant + RBAC
- V8 (P1) : Tests 8+ scenarios

---

## Tache 3.1.6 -- Full-Text Search pg_trgm Cross-CRM

**Metadonnees** : Phase 3 / Sprint 8 / P0 / 4h / Depend de 3.1.5

**But** : Endpoint search global cross-entities (contacts + companies + deals) utilisant pg_trgm trigram similarity, performant < 100ms.

**Livrables checkables** :
- [ ] Service `repo/packages/crm/src/services/crm-search.service.ts`
- [ ] Endpoint `GET /api/v1/crm/search?q=...&types=contacts,companies,deals&limit=20`
- [ ] UNION query Postgres optimise :
  ```sql
  SELECT 'contact' AS type, id, full_name AS title, similarity(full_name, $1) AS score
  FROM crm_contacts WHERE full_name % $1 ...
  UNION ALL
  SELECT 'company' AS type, id, name AS title, ...
  UNION ALL
  SELECT 'deal' AS type, id, title, ...
  ORDER BY score DESC LIMIT 20
  ```
- [ ] Threshold similarity : 0.3 default (configurable via param)
- [ ] Result format : `{ data: [{ type, id, title, score, ...details }] }`
- [ ] Performance cible : < 100ms sur 10k contacts + 1k companies + 5k deals
- [ ] Permissions : utilise les permissions existantes (filtre par RBAC apres query)
- [ ] Tests : performance + relevance (search "Mohamed" trouve contacts pertinents)

**Pattern critique : query trigram UNION**

```sql
-- Exemple query realisable depuis service NestJS (sanitization Zod amont)
WITH contacts_match AS (
  SELECT 'contact' AS type, id::text, full_name AS title,
         similarity(full_name, $1) AS score,
         email, phone, company_id
  FROM crm_contacts
  WHERE deleted_at IS NULL AND full_name % $1
  ORDER BY score DESC LIMIT 10
),
companies_match AS (
  SELECT 'company' AS type, id::text, name AS title,
         similarity(name, $1) AS score,
         ice, industry, NULL AS company_id
  FROM crm_companies
  WHERE deleted_at IS NULL AND name % $1
  ORDER BY score DESC LIMIT 10
),
deals_match AS (
  SELECT 'deal' AS type, id::text, title,
         similarity(title, $1) AS score,
         contact_id, amount_dirham::text, NULL
  FROM crm_deals
  WHERE deleted_at IS NULL AND title % $1
  ORDER BY score DESC LIMIT 10
)
SELECT * FROM contacts_match
UNION ALL SELECT * FROM companies_match
UNION ALL SELECT * FROM deals_match
ORDER BY score DESC LIMIT 20;
```

**Fichiers crees / modifies** :
```
repo/packages/crm/src/services/crm-search.service.ts                  # ~150 lignes
repo/packages/crm/src/schemas/search.schema.ts                         # ~30 lignes
repo/apps/api/src/modules/crm/controllers/search.controller.ts        # ~50 lignes
repo/apps/api/test/crm/search.e2e-spec.ts                              # ~100 lignes (perf tests)
```

**Notes implementation** :
- pg_trgm GIN indexes deja Sprint 2 -- utilises automatiquement
- RLS auto-applique : tenant filter implicit (tenant context Sprint 6)
- Operateur `%` : trigram match (vs `ILIKE` plus lent)
- `similarity()` retourne score 0-1 pour ranking
- Limit per type AVANT UNION (eviter chargement excessif)
- Cache Redis 30s sur queries frequentes (Phase 7+ optimization)

**Criteres validation** :
- V1 (P0) : GET /search?q=Mohamed retourne resultats trigram
- V2 (P0) : Resultats triees par score DESC
- V3 (P0) : Filtre `types=contacts,companies` exclut deals
- V4 (P0) : Performance < 100ms sur dataset realiste (test perf)
- V5 (P0) : Multi-tenant : tenant A pas de leak tenant B
- V6 (P0) : Threshold similarity configurable
- V7 (P1) : Tests 6+ scenarios

---

## Tache 3.1.7 -- Custom Fields Dynamic (JSONB + Zod Runtime)

**Metadonnees** : Phase 3 / Sprint 8 / P1 / 5h / Depend de 3.1.6

**But** : Support custom fields configurables par tenant sans migration DB : champ JSONB + schema Zod stocke en DB pour validation runtime.

**Contexte** : Permettre tenants ajouter leurs propres champs (e.g. broker veut champ "matricule conseiller", garage veut champ "type vehicule prefere"). Sans migration = agile.

**Livrables checkables** :
- [ ] Migration : table `custom_field_definitions` (id, tenant_id, entity_type, field_name, field_type, zod_schema_json, required, position, created_at)
- [ ] Service `repo/packages/crm/src/services/custom-fields.service.ts` :
  - `defineField(entity_type, field_name, type, options)` -- create definition
  - `validateCustomFields(entity_type, customFieldsData): Result` -- validate vs schemas
  - `listDefinitionsByEntity(tenant_id, entity_type)` -- list custom fields applicables
- [ ] Field types : `'string' | 'number' | 'boolean' | 'date' | 'enum' | 'phone' | 'email'`
- [ ] Endpoints :
  - `POST /api/v1/admin/custom-fields/definitions` (admin only)
  - `GET /api/v1/admin/custom-fields/definitions?entity_type=contact`
  - `PATCH .../definitions/:id`
  - `DELETE .../definitions/:id`
- [ ] Tables CRM (contacts, companies, deals) ont colonne `custom_fields jsonb` (deja prevu Sprint 2)
- [ ] Service custom_fields integre dans CRUD CRM : valide custom fields a chaque create/update
- [ ] Schema Zod genere dynamiquement depuis definitions
- [ ] Permissions : `admin.custom_fields.manage`
- [ ] Tests : define field, validate data, reject invalid, integration CRUD CRM

**Fichiers crees / modifies** :
```
repo/packages/database/src/migrations/{date}-CustomFieldsDefinitions.ts        # ~60 lignes
repo/packages/crm/src/services/custom-fields.service.ts                         # ~200 lignes
repo/packages/crm/src/services/custom-fields.service.spec.ts                    # ~150 lignes
repo/packages/crm/src/entities/custom-field-definition.entity.ts                # ~35 lignes
repo/apps/api/src/modules/admin/controllers/admin-custom-fields.controller.ts   # ~120 lignes
```

**Notes implementation** :
- Schema Zod genere dynamique : Zod object avec proprietes selon definitions (ex: `z.object({ matricule: z.string().min(3) })`)
- Cache Redis : definitions per tenant per entity_type (5min TTL)
- Validation a 2 niveaux : Sprint 6/7 schema (champs systeme) + Sprint 8 custom_fields (extension)
- Storage JSONB : `crm_contacts.custom_fields = { matricule: "X123", type_vehicule: "SUV" }`
- Search custom_fields : utiliser `jsonb_path_exists` ou `@@` operator (Phase 7+ enrichissement)

**Criteres validation** :
- V1 (P1) : Define custom field reussit
- V2 (P1) : Validate data contre schema dynamique OK
- V3 (P1) : Validate invalid data rejete avec details
- V4 (P1) : CRUD CRM integre validation custom fields
- V5 (P1) : Required field manquant rejete
- V6 (P1) : Field types 7 supportes
- V7 (P1) : Tests 10+ scenarios

---

## Tache 3.1.8 -- Booking Rooms

**Metadonnees** : Phase 3 / Sprint 8 / P0 / 3h / Depend de 3.1.7

**But** : Module simple Rooms : ressources reservables (salle 1 cabinet, baie atelier garage).

**Livrables checkables** :
- [ ] Entity `booking_room.entity.ts` (Sprint 2 migration)
- [ ] Service `rooms.service.ts` (CRUD basique)
- [ ] Controller `rooms.controller.ts` (5 endpoints CRUD)
- [ ] Schema Zod
- [ ] Permissions : `booking.rooms.create/read/update/delete`
- [ ] Champs critiques : name, capacity (int >= 1), location (text), color (hex), active (bool)
- [ ] Active flag : permet desactiver room sans delete (preservant historique appointments)
- [ ] Default rooms creees au tenant onboarding (Sprint 6 update) : "Salle principale" pour broker, "Baie 1, 2, 3" pour garage
- [ ] Tests : CRUD + active toggle

**Fichiers crees / modifies** :
```
repo/packages/booking/src/entities/booking-room.entity.ts            # ~30 lignes
repo/packages/booking/src/services/rooms.service.ts                   # ~120 lignes
repo/packages/booking/src/schemas/room.schema.ts                      # ~25 lignes
repo/apps/api/src/modules/booking/controllers/rooms.controller.ts    # ~80 lignes
repo/apps/api/test/booking/rooms.e2e-spec.ts                            # ~80 lignes
```

**Criteres validation** :
- V1 (P0) : CRUD complete
- V2 (P0) : Active flag fonctionne (rooms inactives pas listees par defaut)
- V3 (P0) : Default rooms appliquees au onboarding
- V4 (P0) : Multi-tenant + RBAC
- V5 (P1) : Tests 5+ scenarios

---

## Tache 3.1.9 -- Booking Appointments + EXCLUDE Constraint

**Metadonnees** : Phase 3 / Sprint 8 / P0 / 6h / Depend de 3.1.8

**But** : Appointments avec validation EXCLUDE constraint (anti-overlap room) appliquee runtime + status workflow.

**Contexte critique** : Sprint 2 a deja cree EXCLUDE constraint Postgres. Sprint 8 ajoute la couche service qui gere les conflicts proprement (vs raw DB error).

**Livrables checkables** :
- [ ] Entity `booking_appointment.entity.ts`
- [ ] Service `appointments.service.ts` :
  - `create(data)` : verifie disponibilite room avant INSERT (eviter erreur DB), capture EXCLUDE violation si race condition
  - `findById`, `findAll(filters, pagination)`, `update(id, data)` : update gere overlap aussi
  - `cancel(id, reason)` : status='cancelled' + raison
  - `complete(id)` : status='completed'
  - `markNoShow(id)` : status='no_show'
- [ ] Controller :
  - `POST /api/v1/booking/appointments`
  - `GET /api/v1/booking/appointments` (filtres : room_id, contact_id, assigned_user_id, date_range, status)
  - `GET /api/v1/booking/appointments/:id`
  - `PATCH /api/v1/booking/appointments/:id`
  - `POST /api/v1/booking/appointments/:id/cancel` (body: reason)
  - `POST /api/v1/booking/appointments/:id/complete`
  - `POST /api/v1/booking/appointments/:id/mark-no-show`
  - `DELETE /api/v1/booking/appointments/:id` (soft delete)
- [ ] Schema Zod : valide time_range start < end, end - start >= 15min, < 8h
- [ ] Catch EXCLUDE constraint violation : retourne 409 Conflict avec details (existing appointment)
- [ ] Status workflow : `scheduled -> confirmed -> completed` OR `cancelled` OR `no_show`
- [ ] Reminder : Sprint 9 enrichira (envoi WA/email rappel 24h avant)
- [ ] Permissions + ABAC sur read_own (assignee)
- [ ] Audit + Kafka events `appointment_scheduled`, `appointment_cancelled`, `appointment_completed`
- [ ] Tests : create overlap rejete (409), valid create OK, transitions valides

**Pattern critique : tstzrange manipulation TypeORM**

TypeORM 0.3 ne supporte pas tstzrange nativement. Workaround :

```typescript
// Entity : utilise raw column type
@Column('tstzrange')
time_range!: string;  // format '[2026-05-15 14:00, 2026-05-15 15:00)'

// Service : conversion helpers
private buildTimeRange(start: Date, end: Date): string {
  return `[${start.toISOString()},${end.toISOString()})`;
}

private parseTimeRange(range: string): { start: Date; end: Date } {
  const match = range.match(/^[\[\(]([^,]+),([^)]+)[\)\]]$/);
  if (!match) throw new Error('Invalid range');
  return { start: new Date(match[1]), end: new Date(match[2]) };
}
```

**Fichiers crees / modifies** :
```
repo/packages/booking/src/entities/booking-appointment.entity.ts            # ~50 lignes
repo/packages/booking/src/services/appointments.service.ts                   # ~280 lignes
repo/packages/booking/src/schemas/appointment.schema.ts                      # ~50 lignes
repo/packages/booking/src/helpers/time-range.helper.ts                       # ~40 lignes
repo/apps/api/src/modules/booking/controllers/appointments.controller.ts    # ~180 lignes
repo/apps/api/test/booking/appointments.e2e-spec.ts                           # ~200 lignes
```

**Notes implementation** :
- EXCLUDE constraint validation : DB derniere ligne defense, mais service verifie avant pour error message UX
- Race condition : 2 INSERTs paralleles -> DB rejette le 2eme via EXCLUDE -> service catch + retourne 409
- Reminder pre-15min : pas Sprint 8 (Sprint 9 Comm + jobs BullMQ)
- Cancel reason mandatory : tracability (frequent reasons : no_response, conflicting, customer_request)
- ABAC OwnResources : assigned_user_id check pour broker_user

**Criteres validation** :
- V1 (P0) : POST cree appointment
- V2 (P0) : POST overlap meme room rejete 409 avec details existing
- V3 (P0) : POST 2 RDV meme room times non-overlapping OK
- V4 (P0) : POST RDV chevauchant si premier `cancelled` OK (WHERE clause EXCLUDE)
- V5 (P0) : Cancel + reason audit log
- V6 (P0) : Complete transition statu
- V7 (P0) : Filters : date_range, status, room
- V8 (P0) : ABAC : assigned_user_id check
- V9 (P0) : Audit + Kafka events
- V10 (P1) : Tests 15+ scenarios

---

## Tache 3.1.10 -- Booking CalendarSync (OAuth2 Google + Outlook)

**Metadonnees** : Phase 3 / Sprint 8 / P0 / 5h / Depend de 3.1.9

**But** : Setup OAuth2 flow Google Calendar + Microsoft Outlook + stockage tokens chiffres.

**Livrables checkables** :
- [ ] Service `repo/packages/booking/src/services/calendar-sync.service.ts`
- [ ] Methods :
  - `initiateOAuth(provider: 'google' | 'outlook'): { authUrl, state }` -- PKCE flow
  - `handleOAuthCallback(provider, code, state): Promise<CalendarSync>` -- exchange + store
  - `disconnect(syncId)` -- revoke + delete tokens
  - `refreshAccessToken(syncId)` -- auto-refresh expired tokens
  - `getValidAccessToken(syncId)` -- helper retourne token valide (refresh si expire)
- [ ] OAuth scopes :
  - Google : `https://www.googleapis.com/auth/calendar.events` + `calendar.readonly` (read primary calendar)
  - Outlook : `Calendars.ReadWrite`
- [ ] Tokens encrypted via EncryptionService Sprint 5 (AES-GCM)
- [ ] Endpoints :
  - `GET /api/v1/booking/calendar-sync/oauth/:provider/authorize` -- redirect to provider
  - `GET /api/v1/booking/calendar-sync/oauth/:provider/callback` -- callback handler
  - `GET /api/v1/booking/calendar-sync` -- list user's syncs
  - `DELETE /api/v1/booking/calendar-sync/:id` -- disconnect
- [ ] State PKCE : random 32 bytes, stored Redis 10min, validated on callback (CSRF protection)
- [ ] Sprint 8 livre infrastructure ; sync bi-directionnel runtime = Tache 3.1.12
- [ ] Tests : OAuth flow happy path, state mismatch reject, token refresh

**Fichiers crees / modifies** :
```
repo/packages/booking/src/services/calendar-sync.service.ts                 # ~250 lignes
repo/packages/booking/src/services/calendar-sync.service.spec.ts             # ~200 lignes
repo/packages/booking/src/providers/google-calendar.provider.ts              # ~150 lignes
repo/packages/booking/src/providers/outlook-calendar.provider.ts             # ~150 lignes
repo/apps/api/src/modules/booking/controllers/calendar-sync.controller.ts    # ~150 lignes
repo/apps/api/test/booking/calendar-sync.e2e-spec.ts                          # ~150 lignes
```

**Notes implementation** :
- PKCE (Proof Key for Code Exchange) : protection contre attack interception code OAuth2
- googleapis : library officielle Google
- microsoft-graph-client : library officielle Microsoft
- access_token TTL ~1h Google, ~1h Outlook (auto-refresh via refresh_token)
- Encryption tokens : meme cle MFA_SECRET_ENCRYPTION_KEY (ou cle dediee CALENDAR_TOKENS_KEY)
- Variables env requises : `GOOGLE_OAUTH_CLIENT_ID/SECRET`, `OUTLOOK_OAUTH_CLIENT_ID/SECRET`
- State Redis 10min : suffisant pour user complete OAuth flow

**Criteres validation** :
- V1 (P0) : OAuth initiate retourne authUrl + state
- V2 (P0) : Callback exchange code + store tokens chiffres
- V3 (P0) : State mismatch rejete (CSRF protection)
- V4 (P0) : refreshAccessToken renouvelle expire
- V5 (P0) : Disconnect : delete + revoke chez provider
- V6 (P0) : Tokens stockes encrypted (jamais plain)
- V7 (P0) : Tests E2E happy path 8+ scenarios

---

## Tache 3.1.11 -- Availability Service (Slots Libres + Business Hours)

**Metadonnees** : Phase 3 / Sprint 8 / P0 / 5h / Depend de 3.1.10

**But** : Endpoint retournant slots libres pour reservation (e.g. "show me available slots Monday 14h-17h") -- considere appointments existants + business hours + days off.

**Livrables checkables** :
- [ ] Service `repo/packages/booking/src/services/availability.service.ts`
- [ ] Method `findAvailableSlots(roomId, dateRange, durationMinutes): Slot[]`
- [ ] Business hours per tenant : settings `tenant.settings.business_hours = { mon: '09:00-18:00', sat: '09:00-13:00', sun: 'closed' }`
- [ ] Days off : holidays nationaux MA (1er Mai, fin ramadan, etc.) configurable
- [ ] Slot duration : configurable per request (e.g. 30min, 1h)
- [ ] Buffer time : 15min default entre slots (configurable)
- [ ] Considere appointments status='scheduled' OR 'confirmed' (pas cancelled/no_show)
- [ ] Endpoint :
  - `GET /api/v1/booking/availability?room_id=...&start=...&end=...&duration=60`
- [ ] Response : `{ slots: [{ start, end, duration_minutes }] }`
- [ ] Performance : < 200ms pour 1 mois de plage
- [ ] Permissions : `booking.appointments.read` (peut voir disponibilites)
- [ ] Tests : slots libres correct, exclude existing, business hours respect, holiday exclude

**Pattern critique : algorithm find slots**

```typescript
async findAvailableSlots(
  roomId: string,
  dateStart: Date,
  dateEnd: Date,
  durationMinutes: number,
  bufferMinutes: number = 15,
): Promise<Slot[]> {
  const tenantId = getCurrentTenantId()!;
  const tenant = await this.tenantValidation.getTenantById(tenantId);
  const businessHours = tenant.settings.business_hours;
  const holidays = await this.holidaysService.getHolidays(dateStart, dateEnd, 'MA');

  // 1. Existing appointments dans range
  const existingAppts = await this.appointmentsRepo.find({
    where: {
      room_id: roomId,
      status: In(['scheduled', 'confirmed']),
      // tstzrange overlap dateStart-dateEnd
    },
  });

  // 2. Generate slots candidates : iterate jours dans range
  const slots: Slot[] = [];
  let cursor = startOfDay(dateStart);
  while (cursor < dateEnd) {
    const dayName = format(cursor, 'EEEE').toLowerCase();
    const hours = businessHours[dayName];
    if (hours === 'closed' || holidays.includes(format(cursor, 'yyyy-MM-dd'))) {
      cursor = addDays(cursor, 1);
      continue;
    }
    // Parse "09:00-18:00"
    const [openTime, closeTime] = hours.split('-');
    let slotStart = setHourMinute(cursor, openTime);
    const dayEnd = setHourMinute(cursor, closeTime);

    while (addMinutes(slotStart, durationMinutes) <= dayEnd) {
      const slotEnd = addMinutes(slotStart, durationMinutes);
      // Check no overlap with existing
      const overlaps = existingAppts.some(appt =>
        rangesOverlap(slotStart, slotEnd, appt.startTime, appt.endTime)
      );
      if (!overlaps) {
        slots.push({ start: slotStart, end: slotEnd, duration_minutes: durationMinutes });
      }
      slotStart = addMinutes(slotStart, durationMinutes + bufferMinutes);
    }
    cursor = addDays(cursor, 1);
  }
  return slots;
}
```

**Fichiers crees / modifies** :
```
repo/packages/booking/src/services/availability.service.ts                # ~250 lignes
repo/packages/booking/src/services/availability.service.spec.ts            # ~200 lignes
repo/packages/booking/src/services/holidays.service.ts                      # ~80 lignes (holidays MA)
repo/packages/booking/src/data/holidays-ma.json                              # holidays nationaux MA
repo/apps/api/src/modules/booking/controllers/availability.controller.ts    # ~80 lignes
```

**Notes implementation** :
- Holidays MA : pas tous fixes (eid, ramadan dependant calendrier hijri) -- utiliser API ou data file mis a jour annuellement
- Business hours par defaut : `{ mon-fri: '09:00-18:00', sat: '09:00-13:00', sun: 'closed' }`
- Performance : queries DB optimisees + cache holidays Redis 24h
- date-fns + date-fns-tz : critical pour gestion timezone Africa/Casablanca + DST
- Sprint 8 livre infrastructure ; UI consumer Sprint 17/19

**Criteres validation** :
- V1 (P0) : Slots libres correct (exclude existing)
- V2 (P0) : Business hours respectees
- V3 (P0) : Holidays MA exclus
- V4 (P0) : Buffer 15min entre slots
- V5 (P0) : Performance < 200ms 1 mois range
- V6 (P0) : Multi-tenant settings respect
- V7 (P0) : Tests 10+ scenarios

---

## Tache 3.1.12 -- Calendar Sync Bi-Directionnel Google + Outlook

**Metadonnees** : Phase 3 / Sprint 8 / P0 / 6h / Depend de 3.1.11

**But** : Sync bi-directionnel : appointments Skalean -> calendar provider AND calendar provider events -> Skalean (read-only).

**Livrables checkables** :
- [ ] Service `repo/packages/booking/src/services/calendar-sync-bidirectional.service.ts`
- [ ] Methods :
  - `pushAppointment(appointmentId)` -- create event provider apres appointment cree
  - `updateAppointmentInProvider(appointmentId)` -- update apres modif
  - `deleteAppointmentFromProvider(appointmentId)` -- delete apres cancel
  - `pullEventsFromProvider(syncId, dateRange)` -- import events provider en read-only
- [ ] Trigger via Kafka events : `booking.appointment_scheduled` -> push, `appointment_updated` -> update, `appointment_cancelled` -> delete
- [ ] Storage mapping : table `booking_calendar_event_mappings` (appointment_id, sync_id, provider_event_id, last_synced_at)
- [ ] Conflict resolution : skalean is source of truth (provider event modifie -> override avec skalean)
- [ ] Pull events : import provider events as read-only "external" appointments (status='external')
- [ ] Sync schedule : BullMQ cron job 5min interval pull events
- [ ] Idempotency : provider_event_id unique mapping evite duplicates
- [ ] Logs : sync success/failure + duration
- [ ] Tests : create skalean appointment -> appears in provider, modifier provider -> override sur next sync, delete cycle

**Fichiers crees / modifies** :
```
repo/packages/booking/src/services/calendar-sync-bidirectional.service.ts        # ~300 lignes
repo/packages/booking/src/jobs/calendar-pull-events.job.ts                        # ~80 lignes (BullMQ)
repo/packages/database/src/migrations/{date}-CalendarEventMappings.ts             # ~40 lignes
repo/packages/database/src/entities/booking/calendar-event-mapping.entity.ts      # ~30 lignes
repo/apps/api/test/booking/calendar-sync-bidirectional.e2e-spec.ts                # tests (mock providers)
```

**Notes implementation** :
- Source of truth : skalean (eviter conflits multi-edits)
- Pull events read-only : visualisation seulement, user ne peut pas editer dans skalean
- Cron 5min : balance freshness vs API quota Google/Microsoft
- Idempotency mapping : retry safe si Kafka event duplicate
- Tests integration : mock Google/Outlook API responses

**Criteres validation** :
- V1 (P0) : Create appointment skalean -> push provider OK
- V2 (P0) : Update -> sync provider
- V3 (P0) : Cancel -> delete provider event
- V4 (P0) : Pull events provider -> appears in skalean (status='external')
- V5 (P0) : Mapping idempotent (no duplicate)
- V6 (P0) : Conflict : skalean override
- V7 (P0) : Cron job execute every 5min
- V8 (P1) : Tests 8+ scenarios

---

## Tache 3.1.13 -- iCal Feed Export (Token-Based Public URL)

**Metadonnees** : Phase 3 / Sprint 8 / P1 / 4h / Depend de 3.1.12

**But** : Export feed iCal `.ics` accessible via URL token-based : utilisateur peut subscriber depuis Google/Outlook/Apple Calendar pour vue read-only de ses appointments Skalean.

**Livrables checkables** :
- [ ] Service `repo/packages/booking/src/services/ical-export.service.ts`
- [ ] Method `generateFeed(userId, tenantId): string` -- retourne string iCal valide
- [ ] Endpoint `GET /api/v1/booking/ical/:token` (public, no auth, token validation)
- [ ] Token : random 32 bytes base64url, stocke dans `auth_users.ical_token` (UNIQUE)
- [ ] Endpoint `POST /api/v1/booking/ical/regenerate` (auth required) -- regenerate token (revoke ancien)
- [ ] Feed inclut appointments futurs (jusqu'a 90 jours dans futur)
- [ ] Format ical-generator : titre = appointment.title, description = appointment.description + contact info, location = room.name, start/end = times
- [ ] Caching Redis 5min (eviter regenerate a chaque polling)
- [ ] Permissions : aucune (public via token)
- [ ] Tests : token valide retourne ics valide, token invalide 404, regenerate revoke ancien

**Fichiers crees / modifies** :
```
repo/packages/booking/src/services/ical-export.service.ts                  # ~150 lignes
repo/apps/api/src/modules/booking/controllers/ical.controller.ts           # ~80 lignes
repo/apps/api/test/booking/ical-feed.e2e-spec.ts                           # ~80 lignes
```

**Notes implementation** :
- ical-generator library : produit format RFC 5545 valide
- Token URL pattern : `https://api.skalean-insurtech.ma/api/v1/booking/ical/{token}.ics` -- extension critical Apple Calendar
- Cache 5min : balance freshness (calendar refresh ~15min Google) vs perf
- Rate limit feed endpoint : 60 req/h per token (eviter abuse)
- Sprint 8 livre, frontend integration affichage URL Sprint 17

**Criteres validation** :
- V1 (P1) : GET /ical/:token retourne ics valide
- V2 (P1) : Format RFC 5545 (parse-able par Google Calendar)
- V3 (P1) : Token invalide 404
- V4 (P1) : Regenerate revoke ancien token
- V5 (P1) : Cache Redis 5min actif
- V6 (P1) : Rate limit 60/h actif
- V7 (P1) : Tests 6+ scenarios

---

## Tache 3.1.14 -- Tests E2E Exhaustifs (40+) + Seeds Dev

**Metadonnees** : Phase 3 / Sprint 8 / P0 / 7h / Depend de 3.1.13

**But** : Suite tests E2E couvrant CRM + Booking complet + seeds dev avec data realiste.

**Livrables checkables** :

**Tests E2E (40+ scenarios)** :
- [ ] CRM Companies : 5 tests (CRUD happy + ICE invalid + RBAC reject + multi-tenant + search)
- [ ] CRM Contacts : 8 tests (CRUD + CIN + phone E.164 + UNIQUE cin + search trigram + ABAC + preferred_language + interactions count)
- [ ] CRM Pipelines + Stages : 4 tests (create avec stages, reorder, validation terminal stages, delete reject if deals)
- [ ] CRM Deals : 6 tests (CRUD + moveStage + won + lost + forecast + ABAC owner)
- [ ] CRM Interactions : 4 tests (manual log, auto-log via Kafka, timeline, append-only)
- [ ] CRM Search : 3 tests (cross-entity, performance, multi-tenant)
- [ ] Custom Fields : 3 tests (define, validate, integrate CRUD)
- [ ] Booking Rooms : 3 tests (CRUD + active + default rooms onboarding)
- [ ] Booking Appointments : 6 tests (create + EXCLUDE overlap reject + cancel reason + complete + filters + ABAC)
- [ ] Booking CalendarSync : 4 tests (OAuth Google flow, OAuth Outlook flow, refresh token, disconnect)
- [ ] Booking Availability : 3 tests (slots correct, business hours, holidays)
- [ ] Booking Sync Bi-directional : 4 tests (push, pull, update, mapping)
- [ ] iCal Feed : 2 tests (valid feed, regenerate)

**Seeds dev** :
- [ ] Script `repo/infrastructure/scripts/seed-crm-booking.ts`
- [ ] Tenants existants : Cabinet Bennani + Garage Atlas (Sprint 7 RBAC seeds)
- [ ] CRM Companies : 10 (5 par tenant) -- entreprises clients
- [ ] CRM Contacts : 50 (30 Bennani + 20 Atlas) avec faker locale fr_MA
- [ ] CRM Pipelines : 2 par tenant (Pipeline Auto + Pipeline Sante pour broker, Pipeline Pro pour garage)
- [ ] CRM Stages : 6 par pipeline (lead, qualified, proposal, negotiation, won, lost)
- [ ] CRM Deals : 30 (mix stages, mix won/lost/open)
- [ ] CRM Interactions : 100 (timeline realiste 6 derniers mois)
- [ ] Booking Rooms : 3 par tenant
- [ ] Booking Appointments : 50 (passes + futurs)
- [ ] Performance : seed complet < 60s

**Fichiers crees / modifies** :
```
repo/apps/api/test/crm/{several specs}.e2e-spec.ts                              # ~30 fichiers
repo/apps/api/test/booking/{several specs}.e2e-spec.ts                          # ~12 fichiers
repo/infrastructure/scripts/seed-crm-booking.ts                                  # ~400 lignes
repo/apps/api/test/fixtures/crm-test-helpers.ts                                  # helpers
```

**Notes implementation** :
- Setup test : reuse seeds users RBAC (Sprint 7)
- Helpers : `createTestCompany(tenantId)`, `createTestContact(tenantId, companyId)`, etc.
- Faker fr_MA : noms maghrebins, ICE valides, phone +212 valides
- Performance test : measure < seuils (search < 50ms, availability < 200ms)
- CI : tests passent avec services Postgres + Redis + Kafka

**Criteres validation** :
- V1 (P0) : 40+ tests passent localement
- V2 (P0) : Tests passent CI
- V3 (P0) : Seeds creent data realiste
- V4 (P0) : Reproducibility : 5 runs OK
- V5 (P0) : Performance benchmarks respectes
- V6 (P0) : Coverage : tous endpoints testes
- V7 (P0) : Tests integration RBAC + multi-tenant
- V8 (P1) : Documentation seeds dans runbook

---

## Sortie du Sprint 8

A la fin de l'execution des 14 taches :

```
CRM module fully operational :
  - 4 entities : companies (ICE) + contacts (CIN, phone +212, preferred_lang/channel) + deals + interactions
  - Pipelines + Stages configurables par tenant
  - Custom fields dynamic (JSONB + Zod runtime)
  - Full-text search pg_trgm cross-entity (< 100ms)
  - 25+ endpoints REST CRUD
  - Auto-log interactions via Kafka events comm

Booking module fully operational :
  - Rooms + Appointments + CalendarSync
  - EXCLUDE constraint enforced runtime
  - Availability service avec business hours + holidays MA
  - OAuth2 Google + Outlook + tokens chiffres AES-GCM
  - Sync bi-directionnel via Kafka events + cron BullMQ
  - iCal feed export token-based

Pattern complete validated :
  - controllers + services + entities + Zod + RBAC + ABAC + multi-tenant + audit + Kafka events + tests
  - Reutilise par tous sprints metier suivants

40+ tests E2E passants
Seeds dev exhaustifs : 50 contacts + 30 deals + 100 interactions + 50 appointments
```

**Sprint 9 demarre avec** :
- CRM contacts existants -> peuvent recevoir messages WhatsApp/Email
- Auto-log interactions Kafka deja en place (Sprint 9 publishe events comm)
- Pattern controller standard etabli

---

## Specifications Format Tache (pour Generation par Cowork)

Cowork genere `task-3.1.X-*.md` dans `00-pilotage/prompts-taches/sprint-08-crm-booking/`.

**Patterns code inline conserves** : controller standard reutilise, query trigram UNION, tstzrange manipulation TypeORM, find available slots algorithm.

**Reference complete** : `00-pilotage/documentation/3-schemas-database-PARTIE1.sql` lignes 200-400 = tables CRM + Booking exact.

---

**Fin du meta-prompt B-08 v2.2 format Option B.**
