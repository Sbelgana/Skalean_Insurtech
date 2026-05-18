# TACHE 3.1.7 -- CRM Custom Fields Dynamic (JSONB + Zod Runtime Validation per Tenant)

**Sprint** : 8 (Phase 3 / Sprint 1 dans phase) -- CRM + Booking Foundations
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-08-sprint-08-crm-booking.md` (Tache 3.1.7)
**Phase** : 3 -- Modules Horizontaux Foundation
**Priorite** : P1 (extensibilite tenant ; bloquant Sprint 16 broker app pour pages custom fields ; non-bloquant pour Sprint 8 fondations CRM)
**Effort** : 5h
**Dependances** : Tache 3.1.1 (Companies entity custom_fields jsonb), Tache 3.1.2 (Contacts entity custom_fields jsonb), Tache 3.1.4 (Deals entity custom_fields jsonb), Sprint 5/6/7 (Auth + Multi-tenant + RBAC), Sprint 1 task 1.1.5 (Redis db=3 reserve pour custom_fields cache), Sprint 7 task 2.3.1 (permissions ADMIN_CUSTOM_FIELDS_*)
**Densite cible** : 100-150 ko (auto-suffisant exhaustif)
**AUCUNE EMOJI AUTORISEE**

---

## 1. But

Cette tache 3.1.7 implemente le mecanisme de Custom Fields dynamiques permettant a chaque tenant de Skalean InsurTech v2.2 de definir ses propres champs additionnels sur les entites CRM (contacts, companies, deals) sans necessiter de migration DB. Concretement, elle livre la migration TypeORM `1715000000007-CustomFieldDefinitions.ts` creant la table `custom_field_definitions` (tenant_id, entity_type, field_name, field_type, options jsonb, required boolean, position int, active boolean, label_fr, label_ar, label_en, help_text), l'entity `CustomFieldDefinitionEntity`, le service `CustomFieldsService` exposant huit methodes (`defineField`, `updateDefinition`, `deactivateDefinition`, `listDefinitionsByEntity`, `validateCustomFields`, `buildZodSchema`, `enrichEntityWithLabels`, `purgeCache`), le service complementaire `CustomFieldsCacheService` Redis db=3 TTL 5min, le helper `ZodSchemaBuilder` qui genere dynamiquement un Zod schema a partir des definitions (clef de la fonctionnalite : transformer les rows DB en validators Zod runtime), les schemas Zod meta `CreateFieldDefinitionSchema`, `UpdateFieldDefinitionSchema`, `FieldOptionsSchema` (avec sub-schemas selon field_type), le controller admin `AdminCustomFieldsController` exposant cinq endpoints sous `/api/v1/admin/custom-fields/*` accessible uniquement aux roles tenant_admin, broker_admin, garage_admin, super_admin, et l'integration retroactive dans les services CRM (Companies, Contacts, Deals) qui appellent desormais `customFieldsService.validateCustomFields(entityType, customFieldsData)` avant chaque create/update. Sont egalement livrees les suites de tests (16 unit + 12 E2E + 6 integration cross-services pour 34 tests).

L'apport est triple. Premierement, cette tache offre aux tenants une flexibilite operationnelle critique sans contrepartie technique. Sans custom fields, chaque demande tenant pour ajouter un champ specifique (par exemple : "Numero matricule conseiller commercial" pour cabinet Bennani, "Type vehicule prefere" pour garage Atlas, "Reference compte CDG" pour cabinet specialise fonctionnaires) declencherait une migration DB partagee modifiant la table `crm_contacts` ou `crm_companies` pour TOUS les tenants, augmentant la largeur des tables et imposant la coordination cross-tenant pour chaque demande. Le mecanisme custom fields permet a chaque tenant de definir SES propres champs stockes dans la colonne `custom_fields jsonb` deja prevue Sprint 2 (sans modification schema), avec validation Zod runtime garantissant la coherence (un champ defini comme `enum` rejette les valeurs hors enum, un champ `required` rejette le payload sans la valeur). Cette autonomie tenant differencie Skalean InsurTech v2.2 des CRM legacy ou les custom fields necessitent intervention DBA admin Skalean.

Deuxiemement, cette tache introduit un pattern de generation Zod schema runtime, technique avancee TypeScript qui permet de construire programmatiquement un objet Zod a partir de metadata stockes en base. Le helper `ZodSchemaBuilder.buildFromDefinitions(definitions)` itere sur les definitions tenant pour l'entity_type concerne, et construit un `z.object({ ... })` avec les champs et leurs validators inferes : `field_type=string` -> `z.string().min(min_length).max(max_length)`, `field_type=number` -> `z.number().min(min).max(max)`, `field_type=enum` -> `z.enum(options.values)`, `field_type=date` -> `z.string().datetime()`, `field_type=phone` -> validator phone E.164 MA reuse Sprint 8 task 3.1.2, `field_type=email` -> `z.string().email().toLowerCase()`. Le schema genere est cache en memoire (NodeJS Map) per `(tenant_id, entity_type)` couple avec TTL 5min, evitant de regenerer a chaque request. Cette technique permet de transformer la flexibilite metier (custom fields per tenant) en garanties techniques (validation stricte runtime, type safety partielle).

Troisiemement, cette tache enrichit retroactivement les services Companies (Sprint 8 task 3.1.1), Contacts (3.1.2), Deals (3.1.4) en injectant `CustomFieldsService` et en appelant `validateCustomFields(entity_type, dto.custom_fields)` avant chaque create/update. Si validation echoue, l'erreur ZodError est translatee en `BadRequestException` avec details (quel champ, quelle violation). Cette integration retroactive est livree dans cette tache via 3 modifications minimales : `companies.service.ts` +5 lignes, `contacts.service.ts` +5 lignes, `deals.service.ts` +5 lignes. La retroactivite respecte le scope Sprint 8 (les taches precedentes ont volontairement laisse `custom_fields jsonb` non-valide, pour permettre la livraison sequentielle).

A l'issue de cette tache, le module `@insurtech/crm` exporte `CustomFieldDefinitionEntity`, `CustomFieldsService`, `CustomFieldsCacheService`, `ZodSchemaBuilder`, types `FieldType`, `FieldOptions`. L'app api-skalean expose 5 endpoints `/api/v1/admin/custom-fields/*` documentes Swagger. Les commandes `pnpm test custom-fields` execute 16 unit + 6 integration. La commande `pnpm e2e -- --testPathPattern=admin/custom-fields` execute 12 scenarios. Variables d'environnement nouvelles : `CRM_CUSTOM_FIELDS_CACHE_TTL_SECONDS` (default 300 = 5min), `CRM_CUSTOM_FIELDS_MAX_PER_ENTITY` (default 30). Aucune dependance externe nouvelle. Total approximativement 1900 lignes de code TypeScript + SQL.

---

## 2. Contexte etendu

### 2.1 Pourquoi cette tache existe

Le marche du CRM B2B montre depuis 10 ans une demande structurelle pour les custom fields per tenant. Salesforce a livre les Custom Fields des 2002, HubSpot des 2014, Pipedrive des 2015. Cette feature differencie les CRM modernes des CRM legacy 1995-2005 qui imposaient a tous leurs clients un schema fixe. Pour Skalean InsurTech v2.2, ne pas livrer custom fields exposerait a la competition (un cabinet evaluerait Salesforce vs Skalean, verrait l'absence de cette feature, et choisirait l'autre).

Concretement, les besoins tenant pour custom fields sont varies et legitimes :

- **Cabinet de courtage Bennani** (specialise fonctionnaires) : ajouter sur Contacts les champs "Numero matricule fonctionnaire" (string 8-12 chars), "Ministere employeur" (enum 30 ministeres), "Date entree fonction publique" (date), "Niveau hierarchique" (enum A1, A2, B1, B2, C1, C2). Sans ces champs, le cabinet ne peut pas calculer correctement les primes prevoyance qui dependent de l'echelon.
- **Cabinet de courtage Tanger Maritime** (specialise transports maritimes) : ajouter sur Companies les champs "Tonnage flotte" (number kg), "Type de cargo principal" (enum hydrocarbures, conteneurs, vrac), "Pavillon principal" (enum Maroc, Liberia, Panama, Bahamas). Sans ces champs, evaluation du risque maritime impossible.
- **Garage Atlas Casablanca** (specialise SUV/4x4) : ajouter sur Contacts les champs "Modele SUV prefere" (string), "Annee acquisition" (number), "Kilometrage annuel estime" (number), "Type 4x4" (enum 4x4 mecanique, 4x4 electronique, AWD, traction). Sans ces champs, suggestions accessoires sous-optimales.

Ces besoins varient enormement entre tenants (l'enum ministeres du cabinet Bennani n'a aucun sens pour le garage Atlas), justifiant le pattern per-tenant. Hardcoder ces champs dans le schema CRM commun aboutirait a 100+ champs mostly-NULL, polluant la base et complexifiant la query optimization.

Le choix specifique de stocker custom fields dans la colonne `custom_fields jsonb` (vs table separee `entity_custom_field_values` normalise) decoule de la performance lecture : les frontends Sprint 16 chargent la fiche complete d'un contact (champs systeme + custom fields) en une seule query SELECT au lieu d'une query systeme + N queries custom fields. Pour 5000 contacts par tenant typique, ce choix divise par 5 le volume queries. Le trade-off est l'absence d'index sur les valeurs custom fields specifiques (Sprint 8 ne livre pas search par custom field, Sprint 13 Analytics si demande).

Le choix d'introduire les custom fields apres les modules CRM principaux (3.1.1 a 3.1.6) decoule de la sequence : il faut d'abord avoir des entites a customiser. Cette tache 3.1.7 retro-applique la validation aux services existants, ajoute le service de management, et expose les endpoints admin.

### 2.2 Alternatives considerees

| Alternative | Avantages | Inconvenients | Decision |
|-------------|-----------|---------------|----------|
| Schema fixe avec ~30 champs systeme couvrant 80 pour cent des cas | Simplicite | Pollution tables, frustration tenants restants | REJETE |
| Custom fields per tenant via colonne JSONB (RETENU) | Flexibilite, perf lecture | Pas d'index sur custom values | RETENU |
| Custom fields via table normalisee `entity_custom_values` | Indexable, queryable | N queries lecture, complexite | REJETE |
| Custom fields via columns dynamiques (ALTER TABLE per tenant) | Performance perfecte | Ops impossible, breaking changes | REJETE |
| Schema Zod genere code-time (build) | Performance max | Pas dynamique | REJETE |
| Schema Zod genere runtime in-memory cache (RETENU) | Dynamique, performant grace cache | Cache invalidation complexity | RETENU avec TTL 5min |
| Schema Zod genere runtime sans cache | Always fresh | Cout regeneration N requests | REJETE |
| Field types limites a 4 (string/number/boolean/date) | Simple | Couvre pas enum, phone, email | REJETE |
| Field types 7 (string/number/boolean/date/enum/phone/email) (RETENU) | Couvre 90 pour cent cas | Complexite | RETENU |
| Field types 10+ (incl. file, color, geolocation, etc.) | Couvre 100 pour cent | Sur-engineering Sprint 8 | DEFERRABLE Sprint 13+ |
| Validation cross-fields (e.g. champ A < champ B) | Powerful | Complexite | REJETE Sprint 8 |
| i18n labels 3 langues (fr/ar/en) (RETENU) | UX pour utilisateurs MA bilingues | Verbosite definition | RETENU |
| i18n labels via i18next file separe | Decoupling | Difficile pour custom per tenant | REJETE |
| Permission `admin.custom_fields.manage` accessible tenant_admin (RETENU) | Autonomie tenant | Risque erreurs config | RETENU avec audit log |
| Permission reservee super_admin Skalean uniquement | Stabilite max | Frustration tenants | REJETE |
| Field unique cross-tenant (un nom = un champ partout) | Coherence rapports cross-tenant | Coupling tenants | REJETE -- per-tenant strict |
| Soft-delete definition (deactivate vs delete) (RETENU) | Preserve audit historique | Complexite | RETENU avec field active boolean |
| Hard-delete definition cascade purge values | Cleanup | Casse audit | REJETE |
| Cache memory NodeJS Map (RETENU) | Latence zero | Perdu au restart | RETENU avec TTL |
| Cache Redis (RETENU complement) | Persistant cross-instances | Latence reseau | RETENU pour cache definitions list |
| Cache Postgres prepared statements | Natif | Pas dynamique | REJETE |

### 2.3 Trade-offs explicites

Le choix de la colonne `custom_fields jsonb` sans index implique d'accepter qu'on ne peut pas filtrer ni trier sur les custom fields via les endpoints CRM standards (`GET /contacts?custom.matricule=X` n'est pas supporte Sprint 8). Cette limite est acceptable car les use cases principaux sont (a) afficher les custom fields sur la fiche detail, (b) exporter les custom fields dans rapports CSV. Sprint 13 (Analytics) introduira queries jsonb path expressions Postgres pour analytics avancees si demande.

Le choix du cache schemas Zod 5 minutes implique qu'apres modification d'une definition (ajout champ, changement type), les services CRUD continuent d'utiliser l'ancien schema pendant 5 minutes max. Cette stale-ness est acceptable pour les cas standards (tenant_admin ajoute un champ, communique a son equipe, tout le monde l'utilise quelques minutes plus tard). Pour les cas urgents (correction immediate d'une definition buggee), endpoint `POST /admin/custom-fields/purge-cache` est livre permettant invalidation explicite. Le trade-off est entre simplicite (TTL fixe) et reactivite (invalidation events). Sprint 8 retient TTL ; Sprint 13+ pourra introduire pubsub Redis si demande.

Le choix de 7 field types couvre approximativement 90 pour cent des besoins observes pre-projet 12 cabinets MA. Les 10 pour cent restants concernent des cas sophistiques (file upload, color picker, geolocation, signature digitale, date range) qui sont reportes a Sprint 13+ ou requierent integration documents Sprint 10. Le trade-off est entre completion (livrer maintenant tous les types possibles) et pragmatisme (livrer ce qui couvre 90 pour cent et planifier le reste). Sprint 8 retient pragmatisme.

Le choix d'imposer `tenant_id + entity_type + field_name` UNIQUE constraint (un champ name "matricule" ne peut exister qu'une fois par entity_type per tenant) implique de rejeter les duplicates avec message clair. Le trade-off est entre flexibilite (autoriser deux champs `matricule` differents) et coherence (eviter ambiguites JSONB). Sprint 8 retient coherence.

Le choix d'autoriser `tenant_admin` (role local cabinet) a manager les custom fields permet l'autonomie tenant mais introduit risque de mauvaise configuration (un tenant_admin novice peut creer des champs incoherents). Le mecanisme de protection est l'audit log systematique (chaque definition cree/modifie/desactivee genere une row audit_logs traceable) et la possibilite de support Skalean d'inspecter via super_admin endpoint. Sprint 8 retient autonomie tenant ; Sprint 25 (Cross-tenant) pourra introduire validation cross-tenant si Skalean veut imposer des conventions.

### 2.4 Decisions strategiques referenced

- decision-002 (Multi-tenant) totale, decision-003 (TypeORM) totale, decision-006 (No-emoji) totale, decision-008 (Data residency) totale, decision-012 (RBAC) totale.
- decision-025 (planifie -- Custom fields strategy CRM) decision dediee documentee dans `00-pilotage/decisions/025-custom-fields-strategy.md` (creee implicitement par cette tache). Choix JSONB + Zod runtime detaille.

### 2.5 Pieges techniques connus

1. **Piege : ZodSchemaBuilder regenere a chaque request si cache absent.**
   - Pourquoi : iteration sur 30 definitions x build Zod object = 50ms+.
   - Solution : cache Map in-memory keyed `(tenant_id, entity_type)` + TTL 5min. Test V_cache_hit.

2. **Piege : Definition cree mais pas immediatement effective (cache miss).**
   - Pourquoi : cache contient ancienne version.
   - Solution : `defineField` invalide cache automatiquement. Test V_cache_invalidate_on_define.

3. **Piege : Duplicate field_name dans meme tenant + entity_type.**
   - Pourquoi : UNIQUE constraint DB.
   - Solution : service catch erreur 23505 -> ConflictException. Test V_duplicate_name.

4. **Piege : Field renamed entre 2 sessions, custom_fields data anciennes ne valident plus.**
   - Pourquoi : data DB contient `{ ancien_nom: "X" }`, definition exige `nouveau_nom`.
   - Solution : Sprint 8 ne livre PAS migration data automatique. Tenant_admin peut renommer, mais data anciennes restent jsonb (lecture OK, validation rejette si update). Documentation pieges.

5. **Piege : Field deactivate retire champ requis, validation entites existantes echoue.**
   - Pourquoi : entites avec custom_fields contenant l'ancien champ.
   - Solution : deactivate ne supprime pas la definition (active=false), validation skip champs inactifs. Test V_deactivate_safe.

6. **Piege : enum options modifie (ajout valeur), data anciennes valides ne le sont plus.**
   - Pourquoi : valeur supprimee de l'enum, data jsonb contient encore.
   - Solution : Sprint 8 retient strict (rejette data invalide). Sprint 13+ peut introduire migration option.

7. **Piege : phone validator MA differe d'un tenant non-MA (Sprint 14+ extension).**
   - Pourquoi : tenants etrangers tunisiens, etc. (Sprint 14+).
   - Solution : Sprint 8 retient validator MA seulement. Sprint 14 introduira config phone country per tenant.

8. **Piege : Performance generation schema sur 30+ champs.**
   - Pourquoi : 30 z.object props.
   - Solution : test V_perf_30_fields verifie < 20ms.

9. **Piege : Custom field name avec caracteres invalides ($, espaces).**
   - Pourquoi : pollution jsonb key.
   - Solution : Zod regex `/^[a-z][a-z0-9_]{1,49}$/`. Test V_field_name_validation.

10. **Piege : Field name reserves (id, tenant_id, etc.).**
    - Pourquoi : conflit potentiel avec champs systeme.
    - Solution : liste reservee `RESERVED_FIELD_NAMES = ['id', 'tenant_id', 'created_at', ...]`. Test V_reserved.

11. **Piege : Definitions trop nombreuses.**
    - Pourquoi : tenant cree 100+ champs, perf degrade.
    - Solution : limite max 30 per entity_type per tenant. Test V_max_definitions.

12. **Piege : Cache Redis stale apres restart.**
    - Pourquoi : cache memory perdu, Redis garde anciennes valeurs.
    - Solution : Redis cache TTL aussi (5min). Defense en profondeur.

13. **Piege : enum options vide (`[]`).**
    - Pourquoi : tenant cree enum sans valeurs.
    - Solution : Zod min(1) sur options.values. Test V_enum_empty.

14. **Piege : Date format inconsistant (string ISO 8601 vs timestamp).**
    - Pourquoi : utilisateur saisit `2026-05-08`, entity stocke string.
    - Solution : convention strict ISO 8601 string. Documentation.

15. **Piege : Multi-tenant : tenant A peut voir definitions tenant B via super_admin.**
    - Pourquoi : super_admin bypass RLS.
    - Solution : super_admin endpoint dedicated avec audit. Test V_super_admin_audit.

16. **Piege : Cache Redis cross-instances incoherence.**
    - Pourquoi : 2 instances API ont caches memory differents.
    - Solution : Redis comme source de verite ; memory cache locale invalide via Redis pubsub si Sprint 13+.

17. **Piege : Validation custom_fields apres save (ordre incorrect).**
    - Pourquoi : entity sauvee puis validation, integrite cassee.
    - Solution : validation AVANT create/update repository.save(). Test V_validation_before_save.

18. **Piege : Required field manquant dans update partial.**
    - Pourquoi : PATCH ne fournit pas tous champs.
    - Solution : validation update merge avec existing custom_fields, valide merged. Test V_update_partial_required.

---

## 3. Architecture context

### 3.1 Position dans le sprint

Tache 3.1.7 est la SEPTIEME du Sprint 8. Sequence : 3.1.1 -> 3.1.2 -> 3.1.3 -> 3.1.4 -> 3.1.5 -> 3.1.6 -> 3.1.7 -> 3.1.8.

Consommateurs aval :
- **Tache 3.1.8 (Booking Rooms)** : pas direct (custom fields concentre sur CRM).
- **Tache 3.1.14 (Tests + Seeds)** : seeds creent quelques definitions exemples per tenant.

Dependances amont :
- **Tache 3.1.1, 3.1.2, 3.1.4** : entities CRM avec colonne `custom_fields jsonb` deja prevue.
- **Sprint 1 task 1.1.5** : Redis db=3 reserve.
- **Sprint 7 task 2.3.1** : permissions `Permission.ADMIN_CUSTOM_FIELDS_*`.

### 3.2 Position dans le programme global

Custom Fields consommees par :
- **Sprint 13 (Analytics)** : exports CSV incluent custom fields per tenant.
- **Sprint 14-15 (Insure)** : entites Police peuvent reutiliser pattern.
- **Sprint 16 (web-broker)** : frontend page contacts/companies/deals affiche custom fields dynamiquement (rendering form selon definition).
- **Sprint 26 (Admin foundation)** : super_admin peut consulter custom fields tous tenants.
- **Sprint 28 (Admin reports)** : exports DGI/CNDP excluent custom fields confidentiels (configurable).

### 3.3 Diagramme

```
                  +------------------------+
                  | Frontend Sprint 16     |
                  | Page admin             |
                  | "Custom Fields config" |
                  +----------+-------------+
                             |
                             | POST /admin/custom-fields
                             v
+-------------------------------------------------------------------+
| AdminCustomFieldsController                                       |
|   POST   /api/v1/admin/custom-fields                              |
|   GET    /api/v1/admin/custom-fields?entity_type=contact          |
|   PATCH  /api/v1/admin/custom-fields/:id                          |
|   POST   /api/v1/admin/custom-fields/:id/deactivate                |
|   POST   /api/v1/admin/custom-fields/purge-cache                   |
|                                                                    |
| CustomFieldsService                                                |
|   defineField(entity_type, name, type, options)                    |
|   validateCustomFields(entity_type, data) -> ZodError | ok          |
|   buildZodSchema(entity_type) -> ZodObject (cached)                |
|   listDefinitionsByEntity(entity_type)                             |
|                                                                    |
|   ZodSchemaBuilder                                                 |
|     buildFromDefinitions(defs[]) -> z.object({...})                |
|       string -> z.string().min().max()                             |
|       number -> z.number().min().max()                             |
|       boolean -> z.boolean()                                       |
|       date -> z.string().datetime()                                |
|       enum -> z.enum(values)                                       |
|       phone -> custom validator phone E.164 MA                     |
|       email -> z.string().email().toLowerCase()                    |
|                                                                    |
| Cache layer :                                                      |
|   In-memory Map<key, {schema, expiresAt}> -- per process            |
|   Redis db=3 fallback if memory miss -- TTL 5min                   |
+------------+--------------------------------+--------------------+
             |                                |
             v                                v
+------------+----------+         +----------+----------------+
| Postgres              |         | Redis db=3              |
|                       |         |  crm:custom_fields:v1:* |
| custom_field_         |         |  TTL 300s               |
| definitions           |         +-------------------------+
|   id, tenant_id       |
|   entity_type         |
|   field_name UNIQUE   |
|   field_type          |
|   options jsonb       |
|   required, position  |
|   active              |
|   labels fr/ar/en     |
|   help_text           |
+-----------------------+

Integration retroactive avec services CRM :
  CompaniesService.create()  -> customFieldsService.validateCustomFields('company', dto.custom_fields)
  ContactsService.create()   -> validate('contact', ...)
  DealsService.create()      -> validate('deal', ...)
  Idem update().
```

---

## 4. Livrables checkables

- [ ] Migration `repo/packages/database/src/migrations/1715000000007-CustomFieldDefinitions.ts` (~120 lignes)
- [ ] Entity `repo/packages/crm/src/entities/custom-field-definition.entity.ts` (~80 lignes)
- [ ] Service `repo/packages/crm/src/services/custom-fields.service.ts` (~340 lignes)
- [ ] Service `repo/packages/crm/src/services/custom-fields-cache.service.ts` (~140 lignes)
- [ ] Helper `repo/packages/crm/src/helpers/zod-schema-builder.ts` (~200 lignes)
- [ ] Spec service `repo/packages/crm/src/services/custom-fields.service.spec.ts` (~280 lignes, 16 tests)
- [ ] Spec builder `repo/packages/crm/src/helpers/zod-schema-builder.spec.ts` (~180 lignes, 10 tests)
- [ ] Schemas Zod `repo/packages/crm/src/schemas/custom-field.schema.ts` (~150 lignes)
- [ ] Constants `repo/packages/crm/src/constants/field-types.ts` (~50 lignes)
- [ ] Controller `repo/apps/api/src/modules/admin/controllers/admin-custom-fields.controller.ts` (~180 lignes, 5 endpoints)
- [ ] E2E `repo/apps/api/test/admin/custom-fields.e2e-spec.ts` (~340 lignes, 12 scenarios)
- [ ] Integration cross-services `repo/apps/api/test/crm/custom-fields-integration.e2e-spec.ts` (~150 lignes, 6 scenarios)
- [ ] Modifications retro `companies.service.ts`, `contacts.service.ts`, `deals.service.ts` (+5 lignes chacun)
- [ ] Modifications `crm.module.ts`, `index.ts`, `app.module.ts`
- [ ] Migration env `shared-config/env.schema.ts` (+2 vars)
- [ ] 7 field types operationnels : string, number, boolean, date, enum, phone, email
- [ ] i18n labels fr/ar/en sur chaque definition
- [ ] Cache Redis db=3 + memory in-process TTL 5min
- [ ] Validation auto sur CRM CRUD
- [ ] Tests : 16 unit + 10 builder + 12 E2E + 6 integration = 44 tests
- [ ] No-emoji, lint, typecheck

---

## 5. Fichiers crees / modifies

```
CREES :
repo/packages/database/src/migrations/1715000000007-CustomFieldDefinitions.ts ~120 lignes
repo/packages/crm/src/entities/custom-field-definition.entity.ts                ~80 lignes
repo/packages/crm/src/services/custom-fields.service.ts                       ~340 lignes
repo/packages/crm/src/services/custom-fields-cache.service.ts                 ~140 lignes
repo/packages/crm/src/services/custom-fields.service.spec.ts                  ~280 lignes
repo/packages/crm/src/helpers/zod-schema-builder.ts                           ~200 lignes
repo/packages/crm/src/helpers/zod-schema-builder.spec.ts                      ~180 lignes
repo/packages/crm/src/schemas/custom-field.schema.ts                          ~150 lignes
repo/packages/crm/src/constants/field-types.ts                                  ~50 lignes
repo/apps/api/src/modules/admin/controllers/admin-custom-fields.controller.ts ~180 lignes
repo/apps/api/test/admin/custom-fields.e2e-spec.ts                            ~340 lignes
repo/apps/api/test/crm/custom-fields-integration.e2e-spec.ts                  ~150 lignes

MODIFIES :
repo/packages/crm/src/services/companies.service.ts                              +5 lignes (validation hook)
repo/packages/crm/src/services/contacts.service.ts                               +5 lignes
repo/packages/crm/src/services/deals.service.ts                                  +5 lignes
repo/packages/crm/src/crm.module.ts                                              +5 lignes
repo/packages/crm/src/index.ts                                                  +12 lignes
repo/apps/api/src/app.module.ts                                                  +1 ligne (import AdminCustomFieldsModule)
repo/apps/api/src/modules/admin/admin.module.ts                                  +5 lignes (creer ou modifier)
repo/packages/shared-config/src/env.schema.ts                                    +2 lignes
```

Total approximativement 1900 lignes nouveau code.

---

## 6. Code patterns COMPLETS

### 6.1 Fichier 1 sur 12 : Migration

```typescript
// repo/packages/database/src/migrations/1715000000007-CustomFieldDefinitions.ts
import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CustomFieldDefinitions1715000000007 implements MigrationInterface {
  name = 'CustomFieldDefinitions1715000000007';

  public async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      CREATE TABLE custom_field_definitions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
        entity_type VARCHAR(50) NOT NULL,
        field_name VARCHAR(50) NOT NULL,
        field_type VARCHAR(20) NOT NULL,
        options JSONB NOT NULL DEFAULT '{}'::jsonb,
        required BOOLEAN NOT NULL DEFAULT false,
        position INTEGER NOT NULL DEFAULT 1,
        active BOOLEAN NOT NULL DEFAULT true,
        label_fr TEXT NOT NULL,
        label_ar TEXT NULL,
        label_en TEXT NULL,
        help_text TEXT NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ NULL,
        created_by_user_id UUID NULL,
        updated_by_user_id UUID NULL,
        CONSTRAINT chk_cfd_entity_type CHECK (entity_type IN ('contact', 'company', 'deal')),
        CONSTRAINT chk_cfd_field_type CHECK (field_type IN ('string', 'number', 'boolean', 'date', 'enum', 'phone', 'email')),
        CONSTRAINT chk_cfd_field_name_format CHECK (field_name ~ '^[a-z][a-z0-9_]{1,49}$'),
        CONSTRAINT chk_cfd_position CHECK (position >= 1 AND position <= 100)
      )
    `);

    await qr.query(`
      CREATE UNIQUE INDEX idx_cfd_unique
        ON custom_field_definitions(tenant_id, entity_type, field_name)
        WHERE deleted_at IS NULL
    `);
    await qr.query(`
      CREATE INDEX idx_cfd_tenant_entity_active
        ON custom_field_definitions(tenant_id, entity_type, active, position)
        WHERE deleted_at IS NULL
    `);

    // RLS multi-tenant
    await qr.query(`ALTER TABLE custom_field_definitions ENABLE ROW LEVEL SECURITY`);
    await qr.query(`
      CREATE POLICY rls_cfd_tenant ON custom_field_definitions
        USING (tenant_id = app_current_tenant() OR app_is_super_admin())
    `);
  }

  public async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP TABLE IF EXISTS custom_field_definitions CASCADE`);
  }
}
```

### 6.2 Fichier 2 sur 12 : Entity

```typescript
// repo/packages/crm/src/entities/custom-field-definition.entity.ts
import {
  Entity, Column, PrimaryGeneratedColumn,
  CreateDateColumn, UpdateDateColumn, DeleteDateColumn,
  Index,
} from 'typeorm';

export type CustomFieldEntityType = 'contact' | 'company' | 'deal';
export type CustomFieldType = 'string' | 'number' | 'boolean' | 'date' | 'enum' | 'phone' | 'email';

export interface FieldOptions {
  // Pour string :
  min_length?: number;
  max_length?: number;
  pattern?: string;
  // Pour number :
  min?: number;
  max?: number;
  integer?: boolean;
  // Pour enum :
  values?: Array<{ value: string; label_fr: string; label_ar?: string; label_en?: string }>;
  // Pour date :
  min_date?: string;
  max_date?: string;
  // General :
  default_value?: unknown;
}

@Entity({ name: 'custom_field_definitions' })
@Index('idx_cfd_tenant', ['tenant_id'])
@Index('idx_cfd_unique', ['tenant_id', 'entity_type', 'field_name'], { unique: true })
@Index('idx_cfd_tenant_entity_active', ['tenant_id', 'entity_type', 'active', 'position'])
export class CustomFieldDefinitionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: false })
  tenant_id!: string;

  @Column({ type: 'varchar', length: 50, nullable: false })
  entity_type!: CustomFieldEntityType;

  @Column({ type: 'varchar', length: 50, nullable: false })
  field_name!: string;

  @Column({ type: 'varchar', length: 20, nullable: false })
  field_type!: CustomFieldType;

  @Column({ type: 'jsonb', nullable: false, default: () => "'{}'::jsonb" })
  options!: FieldOptions;

  @Column({ type: 'boolean', nullable: false, default: false })
  required!: boolean;

  @Column({ type: 'integer', nullable: false, default: 1 })
  position!: number;

  @Column({ type: 'boolean', nullable: false, default: true })
  active!: boolean;

  @Column({ type: 'text', nullable: false })
  label_fr!: string;

  @Column({ type: 'text', nullable: true })
  label_ar?: string | null;

  @Column({ type: 'text', nullable: true })
  label_en?: string | null;

  @Column({ type: 'text', nullable: true })
  help_text?: string | null;

  @Column({ type: 'jsonb', nullable: false, default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_at?: Date | null;

  @Column({ type: 'uuid', nullable: true })
  created_by_user_id?: string | null;

  @Column({ type: 'uuid', nullable: true })
  updated_by_user_id?: string | null;
}
```

### 6.3 Fichier 3 sur 12 : Constants

```typescript
// repo/packages/crm/src/constants/field-types.ts

export const CUSTOM_FIELD_TYPES = ['string', 'number', 'boolean', 'date', 'enum', 'phone', 'email'] as const;
export type CustomFieldType = typeof CUSTOM_FIELD_TYPES[number];

export const CUSTOM_FIELD_ENTITY_TYPES = ['contact', 'company', 'deal'] as const;
export type CustomFieldEntityType = typeof CUSTOM_FIELD_ENTITY_TYPES[number];

export const RESERVED_FIELD_NAMES = new Set([
  'id', 'tenant_id', 'created_at', 'updated_at', 'deleted_at',
  'created_by_user_id', 'updated_by_user_id', 'metadata', 'custom_fields',
  'first_name', 'last_name', 'full_name', 'email', 'phone_number', 'cin',
  'name', 'legal_name', 'ice', 'rc_number', 'patente', 'if_number',
  'pipeline_id', 'stage_id', 'contact_id', 'company_id', 'owner_user_id',
  'amount', 'currency', 'probability', 'status', 'expected_close_date',
  'won_at', 'lost_at', 'archived_at',
]);

export const MAX_DEFINITIONS_PER_ENTITY = 30;

export function isReservedFieldName(name: string): boolean {
  return RESERVED_FIELD_NAMES.has(name.toLowerCase());
}
```

### 6.4 Fichier 4 sur 12 : Schemas Zod

```typescript
// repo/packages/crm/src/schemas/custom-field.schema.ts
import { z } from 'zod';
import {
  CUSTOM_FIELD_TYPES, CUSTOM_FIELD_ENTITY_TYPES, isReservedFieldName,
} from '../constants/field-types';

const FieldNameSchema = z.string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z][a-z0-9_]{1,49}$/, {
    message: 'field_name : 2-50 chars, [a-z][a-z0-9_]+, lowercase only',
  })
  .refine((v) => !isReservedFieldName(v), {
    message: 'Field name reserve par le systeme',
  });

const EnumValueSchema = z.object({
  value: z.string().trim().min(1).max(50),
  label_fr: z.string().trim().min(1).max(100),
  label_ar: z.string().trim().min(1).max(100).optional(),
  label_en: z.string().trim().min(1).max(100).optional(),
}).strict();

const OptionsStringSchema = z.object({
  min_length: z.number().int().min(0).max(10000).optional(),
  max_length: z.number().int().min(1).max(10000).optional(),
  pattern: z.string().optional(),
  default_value: z.string().optional(),
}).strict().refine(
  (d) => !d.min_length || !d.max_length || d.min_length <= d.max_length,
  { message: 'min_length <= max_length' },
);

const OptionsNumberSchema = z.object({
  min: z.number().optional(),
  max: z.number().optional(),
  integer: z.boolean().optional(),
  default_value: z.number().optional(),
}).strict().refine(
  (d) => d.min === undefined || d.max === undefined || d.min <= d.max,
  { message: 'min <= max' },
);

const OptionsBooleanSchema = z.object({
  default_value: z.boolean().optional(),
}).strict();

const OptionsDateSchema = z.object({
  min_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  max_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  default_value: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).strict();

const OptionsEnumSchema = z.object({
  values: z.array(EnumValueSchema).min(1).max(100),
  default_value: z.string().optional(),
}).strict();

const OptionsPhoneSchema = z.object({
  country: z.literal('MA').default('MA'),
  default_value: z.string().optional(),
}).strict();

const OptionsEmailSchema = z.object({
  default_value: z.string().email().optional(),
}).strict();

export const FieldOptionsSchema = z.union([
  z.object({ field_type: z.literal('string'), options: OptionsStringSchema }),
  z.object({ field_type: z.literal('number'), options: OptionsNumberSchema }),
  z.object({ field_type: z.literal('boolean'), options: OptionsBooleanSchema }),
  z.object({ field_type: z.literal('date'), options: OptionsDateSchema }),
  z.object({ field_type: z.literal('enum'), options: OptionsEnumSchema }),
  z.object({ field_type: z.literal('phone'), options: OptionsPhoneSchema }),
  z.object({ field_type: z.literal('email'), options: OptionsEmailSchema }),
]);

export const CreateFieldDefinitionSchema = z.object({
  entity_type: z.enum(CUSTOM_FIELD_ENTITY_TYPES),
  field_name: FieldNameSchema,
  field_type: z.enum(CUSTOM_FIELD_TYPES),
  options: z.record(z.unknown()).default({}),
  required: z.boolean().default(false),
  position: z.number().int().min(1).max(100).default(1),
  active: z.boolean().default(true),
  label_fr: z.string().trim().min(1).max(100),
  label_ar: z.string().trim().min(1).max(100).optional(),
  label_en: z.string().trim().min(1).max(100).optional(),
  help_text: z.string().trim().max(500).optional(),
  metadata: z.record(z.unknown()).default({}),
}).strict();

export type CreateFieldDefinitionDto = z.infer<typeof CreateFieldDefinitionSchema>;

export const UpdateFieldDefinitionSchema = z.object({
  required: z.boolean().optional(),
  position: z.number().int().min(1).max(100).optional(),
  active: z.boolean().optional(),
  label_fr: z.string().trim().min(1).max(100).optional(),
  label_ar: z.string().trim().min(1).max(100).nullable().optional(),
  label_en: z.string().trim().min(1).max(100).nullable().optional(),
  help_text: z.string().trim().max(500).nullable().optional(),
  options: z.record(z.unknown()).optional(),
}).strict().refine(
  (d) => Object.keys(d).length > 0,
  { message: 'Au moins un champ requis' },
);

export type UpdateFieldDefinitionDto = z.infer<typeof UpdateFieldDefinitionSchema>;
```

### 6.5 Fichier 5 sur 12 : ZodSchemaBuilder

```typescript
// repo/packages/crm/src/helpers/zod-schema-builder.ts
import { z, type ZodTypeAny } from 'zod';
import type { CustomFieldDefinitionEntity, FieldOptions } from '../entities/custom-field-definition.entity';
import { PhoneE164MaValidator } from '../validators/phone-ma.validator';

export class ZodSchemaBuilder {
  /**
   * Genere un schema Zod a partir d'un tableau de definitions actives.
   * Les champs inactifs (active=false) sont ignores.
   * Les champs requis ont .refine pour reject undefined ; les optionnels ont .optional().
   */
  static buildFromDefinitions(definitions: CustomFieldDefinitionEntity[]): z.ZodObject<Record<string, ZodTypeAny>> {
    const shape: Record<string, ZodTypeAny> = {};

    for (const def of definitions) {
      if (!def.active || def.deleted_at) continue;
      let validator = ZodSchemaBuilder.buildFieldValidator(def.field_type, def.options);
      if (!def.required) {
        validator = validator.nullable().optional();
      }
      shape[def.field_name] = validator;
    }

    return z.object(shape).strict();
  }

  static buildFieldValidator(fieldType: string, options: FieldOptions): ZodTypeAny {
    switch (fieldType) {
      case 'string': {
        let v = z.string();
        if (options.min_length !== undefined) v = v.min(options.min_length);
        if (options.max_length !== undefined) v = v.max(options.max_length);
        if (options.pattern) {
          try {
            const re = new RegExp(options.pattern);
            v = v.regex(re);
          } catch {
            // pattern invalide ignore (already validated at definition time)
          }
        }
        return v;
      }
      case 'number': {
        let v = z.number();
        if (options.integer) v = v.int();
        if (options.min !== undefined) v = v.min(options.min);
        if (options.max !== undefined) v = v.max(options.max);
        return v;
      }
      case 'boolean':
        return z.boolean();
      case 'date': {
        let v = z.string().regex(/^\d{4}-\d{2}-\d{2}(T.*)?$/);
        if (options.min_date) {
          v = v.refine((d) => new Date(d) >= new Date(options.min_date as string), {
            message: `date >= ${options.min_date}`,
          });
        }
        if (options.max_date) {
          v = v.refine((d) => new Date(d) <= new Date(options.max_date as string), {
            message: `date <= ${options.max_date}`,
          });
        }
        return v;
      }
      case 'enum': {
        const values = options.values ?? [];
        if (values.length === 0) return z.never();
        const enumValues = values.map((v) => v.value) as [string, ...string[]];
        return z.enum(enumValues);
      }
      case 'phone': {
        return z.string().refine(
          (v) => PhoneE164MaValidator.normalize(v) !== null,
          { message: 'Phone format MA invalide' },
        ).transform((v) => PhoneE164MaValidator.normalize(v) as string);
      }
      case 'email':
        return z.string().email().toLowerCase();
      default:
        return z.unknown();
    }
  }

  /**
   * Validation d'un payload custom_fields.
   * Retourne result discriminated union (succes ou liste erreurs).
   */
  static validate(
    definitions: CustomFieldDefinitionEntity[],
    data: Record<string, unknown>,
  ): { ok: true; data: Record<string, unknown> } | { ok: false; errors: Array<{ field: string; message: string }> } {
    const schema = ZodSchemaBuilder.buildFromDefinitions(definitions);
    const result = schema.safeParse(data);
    if (result.success) {
      return { ok: true, data: result.data };
    }
    const errors = result.error.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    return { ok: false, errors };
  }
}
```

### 6.6 Fichier 6 sur 12 : CustomFieldsCacheService

```typescript
// repo/packages/crm/src/services/custom-fields-cache.service.ts
import { Injectable, Inject } from '@nestjs/common';
import type { Redis } from 'ioredis';
import type { Logger } from 'pino';
import type { CustomFieldDefinitionEntity, CustomFieldEntityType } from '../entities/custom-field-definition.entity';

interface CacheEntry {
  definitions: CustomFieldDefinitionEntity[];
  expiresAt: number;
}

@Injectable()
export class CustomFieldsCacheService {
  private readonly memCache = new Map<string, CacheEntry>();
  private readonly ttlMs: number;

  constructor(
    @Inject('REDIS_CLIENT_CUSTOM_FIELDS') private readonly redis: Redis,
    @Inject('PINO_LOGGER') private readonly logger: Logger,
  ) {
    this.ttlMs = Number(process.env.CRM_CUSTOM_FIELDS_CACHE_TTL_SECONDS ?? 300) * 1000;
  }

  private buildKey(tenantId: string, entityType: CustomFieldEntityType): string {
    return `crm:custom_fields:v1:${tenantId}:${entityType}`;
  }

  async get(
    tenantId: string,
    entityType: CustomFieldEntityType,
  ): Promise<CustomFieldDefinitionEntity[] | null> {
    // 1. Memory cache
    const memKey = `${tenantId}:${entityType}`;
    const memEntry = this.memCache.get(memKey);
    if (memEntry && memEntry.expiresAt > Date.now()) {
      return memEntry.definitions;
    }
    if (memEntry) this.memCache.delete(memKey);

    // 2. Redis fallback
    try {
      const raw = await this.redis.get(this.buildKey(tenantId, entityType));
      if (!raw) return null;
      const definitions = JSON.parse(raw) as CustomFieldDefinitionEntity[];
      // Backfill memory
      this.memCache.set(memKey, { definitions, expiresAt: Date.now() + this.ttlMs });
      return definitions;
    } catch (error) {
      this.logger.warn({ err: error, action: 'custom_fields_cache_get_failed' }, 'Cache get failed');
      return null;
    }
  }

  async set(
    tenantId: string,
    entityType: CustomFieldEntityType,
    definitions: CustomFieldDefinitionEntity[],
  ): Promise<void> {
    const memKey = `${tenantId}:${entityType}`;
    this.memCache.set(memKey, { definitions, expiresAt: Date.now() + this.ttlMs });
    try {
      await this.redis.setex(
        this.buildKey(tenantId, entityType),
        Math.floor(this.ttlMs / 1000),
        JSON.stringify(definitions),
      );
    } catch (error) {
      this.logger.warn({ err: error, action: 'custom_fields_cache_set_failed' }, 'Cache set failed (non-fatal)');
    }
  }

  async invalidate(tenantId: string, entityType: CustomFieldEntityType): Promise<void> {
    const memKey = `${tenantId}:${entityType}`;
    this.memCache.delete(memKey);
    try {
      await this.redis.del(this.buildKey(tenantId, entityType));
    } catch (error) {
      this.logger.warn({ err: error, action: 'custom_fields_cache_invalidate_failed' }, 'Cache invalidate failed');
    }
  }

  async invalidateTenant(tenantId: string): Promise<void> {
    for (const k of [...this.memCache.keys()]) {
      if (k.startsWith(`${tenantId}:`)) this.memCache.delete(k);
    }
    try {
      let cursor = '0';
      do {
        const [next, keys] = await this.redis.scan(cursor, 'MATCH', `crm:custom_fields:v1:${tenantId}:*`, 'COUNT', 50);
        cursor = next;
        if (keys.length > 0) await this.redis.del(...keys);
      } while (cursor !== '0');
    } catch (error) {
      this.logger.error({ err: error, tenant_id: tenantId }, 'Cache invalidate tenant failed');
    }
  }
}
```

### 6.7 Fichier 7 sur 12 : CustomFieldsService

```typescript
// repo/packages/crm/src/services/custom-fields.service.ts
import {
  Injectable, NotFoundException, ConflictException,
  BadRequestException, Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import type { Logger } from 'pino';
import { CustomFieldDefinitionEntity, type CustomFieldEntityType } from '../entities/custom-field-definition.entity';
import { CustomFieldsCacheService } from './custom-fields-cache.service';
import { ZodSchemaBuilder } from '../helpers/zod-schema-builder';
import {
  type CreateFieldDefinitionDto, type UpdateFieldDefinitionDto,
} from '../schemas/custom-field.schema';
import { MAX_DEFINITIONS_PER_ENTITY, isReservedFieldName } from '../constants/field-types';
import { KafkaPublisherService, Topics } from '@insurtech/shared-events';
import { getCurrentTenantId } from '@insurtech/shared-utils';

export type ValidationResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; errors: Array<{ field: string; message: string }> };

@Injectable()
export class CustomFieldsService {
  constructor(
    @InjectRepository(CustomFieldDefinitionEntity)
    private readonly defsRepo: Repository<CustomFieldDefinitionEntity>,
    private readonly cache: CustomFieldsCacheService,
    private readonly kafka: KafkaPublisherService,
    @Inject('PINO_LOGGER') private readonly logger: Logger,
  ) {}

  async defineField(dto: CreateFieldDefinitionDto, userId: string): Promise<CustomFieldDefinitionEntity> {
    const tenantId = this.requireTenantContext('defineField');

    if (isReservedFieldName(dto.field_name)) {
      throw new BadRequestException({
        code: 'CRM_CUSTOM_FIELD_RESERVED_NAME',
        message: `Field name "${dto.field_name}" est reserve`,
      });
    }

    // Verifier limite max
    const countRow: Array<{ count: string }> = await this.defsRepo.query(
      `SELECT COUNT(*)::text AS count FROM custom_field_definitions WHERE tenant_id = $1 AND entity_type = $2 AND deleted_at IS NULL`,
      [tenantId, dto.entity_type],
    );
    if (Number(countRow[0]?.count ?? 0) >= MAX_DEFINITIONS_PER_ENTITY) {
      throw new BadRequestException({
        code: 'CRM_CUSTOM_FIELD_MAX_REACHED',
        message: `Max ${MAX_DEFINITIONS_PER_ENTITY} custom fields per ${dto.entity_type}`,
      });
    }

    // Verifier unicite
    const existing = await this.defsRepo.findOne({
      where: {
        tenant_id: tenantId,
        entity_type: dto.entity_type,
        field_name: dto.field_name,
        deleted_at: IsNull(),
      },
    });
    if (existing) {
      throw new ConflictException({
        code: 'CRM_CUSTOM_FIELD_DUPLICATE',
        message: `Field "${dto.field_name}" deja existant pour ${dto.entity_type}`,
        existing_id: existing.id,
      });
    }

    const entity = this.defsRepo.create({
      ...dto,
      tenant_id: tenantId,
      created_by_user_id: userId,
      updated_by_user_id: userId,
    });
    const saved = await this.defsRepo.save(entity);

    await this.cache.invalidate(tenantId, dto.entity_type);

    await this.kafka.publish({
      topic: Topics.CRM_CUSTOM_FIELD_DEFINED,
      key: saved.id,
      value: {
        event_id: crypto.randomUUID(),
        event_type: 'crm.custom_field.defined',
        occurred_at: new Date().toISOString(),
        tenant_id: tenantId,
        actor_user_id: userId,
        definition: {
          id: saved.id,
          entity_type: saved.entity_type,
          field_name: saved.field_name,
          field_type: saved.field_type,
          required: saved.required,
        },
      },
    });

    this.logger.info(
      { tenant_id: tenantId, user_id: userId, entity_type: dto.entity_type, field_name: dto.field_name },
      'Custom field defined',
    );

    return saved;
  }

  async updateDefinition(id: string, dto: UpdateFieldDefinitionDto, userId: string): Promise<CustomFieldDefinitionEntity> {
    const tenantId = this.requireTenantContext('updateDefinition');
    const existing = await this.findById(id);

    Object.assign(existing, dto, { updated_by_user_id: userId });
    const saved = await this.defsRepo.save(existing);

    await this.cache.invalidate(tenantId, existing.entity_type);

    return saved;
  }

  async deactivateDefinition(id: string, userId: string): Promise<CustomFieldDefinitionEntity> {
    const tenantId = this.requireTenantContext('deactivateDefinition');
    const existing = await this.findById(id);

    existing.active = false;
    existing.updated_by_user_id = userId;
    const saved = await this.defsRepo.save(existing);

    await this.cache.invalidate(tenantId, existing.entity_type);

    return saved;
  }

  async findById(id: string): Promise<CustomFieldDefinitionEntity> {
    const tenantId = this.requireTenantContext('findById');
    const def = await this.defsRepo.findOne({
      where: { id, tenant_id: tenantId, deleted_at: IsNull() },
    });
    if (!def) {
      throw new NotFoundException({
        code: 'CRM_CUSTOM_FIELD_NOT_FOUND',
        message: `Custom field ${id} not found`,
      });
    }
    return def;
  }

  async listDefinitionsByEntity(entityType: CustomFieldEntityType): Promise<CustomFieldDefinitionEntity[]> {
    const tenantId = this.requireTenantContext('listDefinitionsByEntity');

    // Cache lookup
    const cached = await this.cache.get(tenantId, entityType);
    if (cached) return cached;

    // DB query
    const defs = await this.defsRepo.find({
      where: { tenant_id: tenantId, entity_type: entityType, deleted_at: IsNull() },
      order: { position: 'ASC', field_name: 'ASC' },
    });

    await this.cache.set(tenantId, entityType, defs);
    return defs;
  }

  /**
   * Methode principale : valide custom_fields data contre definitions tenant.
   * Appele par CompaniesService, ContactsService, DealsService.
   */
  async validateCustomFields(
    entityType: CustomFieldEntityType,
    data: Record<string, unknown> | undefined | null,
  ): Promise<ValidationResult> {
    if (!data || Object.keys(data).length === 0) {
      // Pas de custom fields data : OK si aucune required definition
      const defs = await this.listDefinitionsByEntity(entityType);
      const requiredActive = defs.filter((d) => d.active && d.required);
      if (requiredActive.length > 0) {
        return {
          ok: false,
          errors: requiredActive.map((d) => ({ field: d.field_name, message: 'Required' })),
        };
      }
      return { ok: true, data: {} };
    }

    const defs = await this.listDefinitionsByEntity(entityType);
    return ZodSchemaBuilder.validate(defs, data);
  }

  async purgeCache(): Promise<void> {
    const tenantId = this.requireTenantContext('purgeCache');
    await this.cache.invalidateTenant(tenantId);
  }

  /**
   * Helper consume par services CRM : valide ou throw BadRequestException.
   */
  async assertCustomFieldsValid(
    entityType: CustomFieldEntityType,
    data: Record<string, unknown> | undefined | null,
  ): Promise<void> {
    const result = await this.validateCustomFields(entityType, data);
    if (!result.ok) {
      throw new BadRequestException({
        code: 'CRM_CUSTOM_FIELDS_INVALID',
        message: 'custom_fields validation failed',
        errors: result.errors,
      });
    }
  }

  private requireTenantContext(operation: string): string {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new BadRequestException({
        code: 'CRM_TENANT_CONTEXT_MISSING',
        message: 'Tenant context required',
      });
    }
    return tenantId;
  }
}
```

### 6.8 Fichier 8 sur 12 : ZodSchemaBuilder Spec

```typescript
// repo/packages/crm/src/helpers/zod-schema-builder.spec.ts
import { describe, it, expect } from 'vitest';
import { ZodSchemaBuilder } from './zod-schema-builder';
import type { CustomFieldDefinitionEntity } from '../entities/custom-field-definition.entity';

function makeDef(over: Partial<CustomFieldDefinitionEntity>): CustomFieldDefinitionEntity {
  return {
    id: 'd1', tenant_id: 't1', entity_type: 'contact',
    field_name: 'matricule', field_type: 'string', options: {},
    required: false, position: 1, active: true,
    label_fr: 'Matricule', label_ar: null, label_en: null, help_text: null,
    metadata: {},
    created_at: new Date(), updated_at: new Date(), deleted_at: null,
    created_by_user_id: null, updated_by_user_id: null,
    ...over,
  } as CustomFieldDefinitionEntity;
}

describe('ZodSchemaBuilder', () => {
  describe('buildFromDefinitions', () => {
    it('genere schema empty si aucune definition active', () => {
      const schema = ZodSchemaBuilder.buildFromDefinitions([]);
      const r = schema.parse({});
      expect(r).toEqual({});
    });

    it('ignore definitions inactives', () => {
      const defs = [
        makeDef({ field_name: 'foo', active: false, required: true }),
        makeDef({ field_name: 'bar', active: true }),
      ];
      const schema = ZodSchemaBuilder.buildFromDefinitions(defs);
      const r = schema.parse({});
      expect(r).toEqual({});
    });

    it('valide string avec min/max length', () => {
      const defs = [makeDef({
        field_name: 'matricule', field_type: 'string',
        options: { min_length: 5, max_length: 10 },
      })];
      const schema = ZodSchemaBuilder.buildFromDefinitions(defs);
      expect(() => schema.parse({ matricule: 'abc' })).toThrow();
      expect(() => schema.parse({ matricule: 'abcdefghijk' })).toThrow();
      expect(schema.parse({ matricule: 'abcdef' })).toEqual({ matricule: 'abcdef' });
    });

    it('valide number avec integer + min/max', () => {
      const defs = [makeDef({
        field_name: 'age', field_type: 'number',
        options: { integer: true, min: 18, max: 99 },
      })];
      const schema = ZodSchemaBuilder.buildFromDefinitions(defs);
      expect(() => schema.parse({ age: 17 })).toThrow();
      expect(() => schema.parse({ age: 100 })).toThrow();
      expect(() => schema.parse({ age: 25.5 })).toThrow();
      expect(schema.parse({ age: 30 })).toEqual({ age: 30 });
    });

    it('valide boolean', () => {
      const defs = [makeDef({ field_name: 'is_vip', field_type: 'boolean', options: {} })];
      const schema = ZodSchemaBuilder.buildFromDefinitions(defs);
      expect(schema.parse({ is_vip: true })).toEqual({ is_vip: true });
      expect(() => schema.parse({ is_vip: 'yes' })).toThrow();
    });

    it('valide enum', () => {
      const defs = [makeDef({
        field_name: 'level', field_type: 'enum',
        options: {
          values: [
            { value: 'A', label_fr: 'Niveau A' },
            { value: 'B', label_fr: 'Niveau B' },
          ],
        },
      })];
      const schema = ZodSchemaBuilder.buildFromDefinitions(defs);
      expect(schema.parse({ level: 'A' })).toEqual({ level: 'A' });
      expect(() => schema.parse({ level: 'X' })).toThrow();
    });

    it('valide phone normalise', () => {
      const defs = [makeDef({
        field_name: 'gsm', field_type: 'phone', options: { country: 'MA' },
      })];
      const schema = ZodSchemaBuilder.buildFromDefinitions(defs);
      const r = schema.parse({ gsm: '0612345678' });
      expect(r.gsm).toBe('+212612345678');
    });

    it('valide email lowercase', () => {
      const defs = [makeDef({ field_name: 'mail', field_type: 'email', options: {} })];
      const schema = ZodSchemaBuilder.buildFromDefinitions(defs);
      expect(schema.parse({ mail: 'X@TEST.MA' })).toEqual({ mail: 'x@test.ma' });
    });

    it('valide date ISO', () => {
      const defs = [makeDef({ field_name: 'date_x', field_type: 'date', options: {} })];
      const schema = ZodSchemaBuilder.buildFromDefinitions(defs);
      expect(schema.parse({ date_x: '2026-05-08' })).toEqual({ date_x: '2026-05-08' });
      expect(() => schema.parse({ date_x: 'not-a-date' })).toThrow();
    });

    it('required field rejete si manquant', () => {
      const defs = [makeDef({ field_name: 'matricule', required: true, options: {} })];
      const schema = ZodSchemaBuilder.buildFromDefinitions(defs);
      expect(() => schema.parse({})).toThrow();
    });

    it('strict refuse champs inconnus', () => {
      const defs = [makeDef({ field_name: 'matricule', options: {} })];
      const schema = ZodSchemaBuilder.buildFromDefinitions(defs);
      expect(() => schema.parse({ unknown_field: 'X' })).toThrow();
    });
  });

  describe('validate', () => {
    it('retourne ok=true si valide', () => {
      const defs = [makeDef({ field_name: 'name', field_type: 'string', options: {} })];
      const r = ZodSchemaBuilder.validate(defs, { name: 'Test' });
      expect(r.ok).toBe(true);
    });

    it('retourne ok=false avec erreurs detail', () => {
      const defs = [makeDef({ field_name: 'age', field_type: 'number', required: true, options: {} })];
      const r = ZodSchemaBuilder.validate(defs, {});
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.errors[0].field).toBe('age');
      }
    });
  });
});
```

### 6.9 Fichier 9 sur 12 : CustomFieldsService Spec

```typescript
// repo/packages/crm/src/services/custom-fields.service.spec.ts
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { CustomFieldsService } from './custom-fields.service';
import { CustomFieldsCacheService } from './custom-fields-cache.service';
import { CustomFieldDefinitionEntity } from '../entities/custom-field-definition.entity';
import { KafkaPublisherService } from '@insurtech/shared-events';
import * as utils from '@insurtech/shared-utils';

vi.mock('@insurtech/shared-utils', async () => ({
  ...(await vi.importActual<typeof utils>('@insurtech/shared-utils')),
  getCurrentTenantId: vi.fn(),
}));

const TENANT = 'tenant-uuid';
const USER = 'user-uuid';

describe('CustomFieldsService', () => {
  let service: CustomFieldsService;
  let repo: any;
  let cache: any;
  let kafka: any;

  beforeEach(async () => {
    (utils.getCurrentTenantId as Mock).mockReturnValue(TENANT);

    const m = await Test.createTestingModule({
      providers: [
        CustomFieldsService,
        {
          provide: getRepositoryToken(CustomFieldDefinitionEntity),
          useValue: {
            findOne: vi.fn(),
            create: vi.fn((d) => d),
            save: vi.fn((d) => Promise.resolve({ ...d, id: 'd1' })),
            find: vi.fn(),
            query: vi.fn(),
          },
        },
        {
          provide: CustomFieldsCacheService,
          useValue: {
            get: vi.fn(() => Promise.resolve(null)),
            set: vi.fn(),
            invalidate: vi.fn(),
            invalidateTenant: vi.fn(),
          },
        },
        { provide: KafkaPublisherService, useValue: { publish: vi.fn() } },
        { provide: 'PINO_LOGGER', useValue: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } },
      ],
    }).compile();

    service = m.get(CustomFieldsService);
    repo = m.get(getRepositoryToken(CustomFieldDefinitionEntity));
    cache = m.get(CustomFieldsCacheService);
    kafka = m.get(KafkaPublisherService);
  });

  describe('defineField', () => {
    it('cree definition et invalide cache', async () => {
      repo.query.mockResolvedValue([{ count: '0' }]);
      repo.findOne.mockResolvedValue(null);
      const r = await service.defineField({
        entity_type: 'contact', field_name: 'matricule', field_type: 'string',
        options: {}, required: false, position: 1, active: true,
        label_fr: 'Matricule', metadata: {},
      } as any, USER);
      expect(r.id).toBe('d1');
      expect(cache.invalidate).toHaveBeenCalledWith(TENANT, 'contact');
      expect(kafka.publish).toHaveBeenCalled();
    });

    it('rejette field name reserve', async () => {
      await expect(service.defineField({
        entity_type: 'contact', field_name: 'id',
        field_type: 'string', options: {},
        required: false, position: 1, active: true,
        label_fr: 'ID', metadata: {},
      } as any, USER)).rejects.toThrow(BadRequestException);
    });

    it('rejette duplicate', async () => {
      repo.query.mockResolvedValue([{ count: '0' }]);
      repo.findOne.mockResolvedValue({ id: 'existing', field_name: 'matricule' });
      await expect(service.defineField({
        entity_type: 'contact', field_name: 'matricule', field_type: 'string',
        options: {}, required: false, position: 1, active: true,
        label_fr: 'X', metadata: {},
      } as any, USER)).rejects.toThrow(ConflictException);
    });

    it('rejette si max atteint', async () => {
      repo.query.mockResolvedValue([{ count: '30' }]);
      await expect(service.defineField({
        entity_type: 'contact', field_name: 'newfield', field_type: 'string',
        options: {}, required: false, position: 1, active: true,
        label_fr: 'X', metadata: {},
      } as any, USER)).rejects.toThrow(BadRequestException);
    });
  });

  describe('listDefinitionsByEntity', () => {
    it('cache hit retourne sans DB', async () => {
      cache.get.mockResolvedValue([{ id: 'd1' }]);
      const r = await service.listDefinitionsByEntity('contact');
      expect(r).toHaveLength(1);
      expect(repo.find).not.toHaveBeenCalled();
    });

    it('cache miss query DB et populate cache', async () => {
      cache.get.mockResolvedValue(null);
      repo.find.mockResolvedValue([{ id: 'd1' }]);
      await service.listDefinitionsByEntity('contact');
      expect(repo.find).toHaveBeenCalled();
      expect(cache.set).toHaveBeenCalled();
    });
  });

  describe('validateCustomFields', () => {
    it('retourne ok si pas de required avec data vide', async () => {
      cache.get.mockResolvedValue([
        { id: 'd1', field_name: 'opt', field_type: 'string', active: true, required: false, options: {} },
      ]);
      const r = await service.validateCustomFields('contact', {});
      expect(r.ok).toBe(true);
    });

    it('retourne erreurs si required manquant', async () => {
      cache.get.mockResolvedValue([
        { id: 'd1', field_name: 'mat', field_type: 'string', active: true, required: true, options: {}, deleted_at: null },
      ]);
      const r = await service.validateCustomFields('contact', {});
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors[0].field).toBe('mat');
    });

    it('valide enum value valide', async () => {
      cache.get.mockResolvedValue([
        {
          id: 'd1', field_name: 'level', field_type: 'enum',
          active: true, required: false, deleted_at: null,
          options: { values: [{ value: 'A', label_fr: 'A' }, { value: 'B', label_fr: 'B' }] },
        },
      ]);
      const r = await service.validateCustomFields('contact', { level: 'A' });
      expect(r.ok).toBe(true);
    });

    it('rejette enum value hors liste', async () => {
      cache.get.mockResolvedValue([
        {
          id: 'd1', field_name: 'level', field_type: 'enum',
          active: true, required: true, deleted_at: null,
          options: { values: [{ value: 'A', label_fr: 'A' }] },
        },
      ]);
      const r = await service.validateCustomFields('contact', { level: 'X' });
      expect(r.ok).toBe(false);
    });
  });

  describe('assertCustomFieldsValid', () => {
    it('throw si invalide', async () => {
      cache.get.mockResolvedValue([
        { id: 'd1', field_name: 'mat', field_type: 'string', active: true, required: true, options: {}, deleted_at: null },
      ]);
      await expect(service.assertCustomFieldsValid('contact', {})).rejects.toThrow(BadRequestException);
    });

    it('OK si valide', async () => {
      cache.get.mockResolvedValue([]);
      await expect(service.assertCustomFieldsValid('contact', {})).resolves.not.toThrow();
    });
  });

  describe('updateDefinition / deactivateDefinition', () => {
    it('updateDefinition met a jour + invalide cache', async () => {
      repo.findOne.mockResolvedValue({ id: 'd1', tenant_id: TENANT, entity_type: 'contact', deleted_at: null });
      await service.updateDefinition('d1', { required: true } as any, USER);
      expect(cache.invalidate).toHaveBeenCalled();
    });

    it('deactivateDefinition set active=false', async () => {
      repo.findOne.mockResolvedValue({ id: 'd1', tenant_id: TENANT, entity_type: 'contact', active: true, deleted_at: null });
      const r = await service.deactivateDefinition('d1', USER);
      expect(r.active).toBe(false);
    });
  });

  describe('purgeCache', () => {
    it('appelle invalidateTenant', async () => {
      await service.purgeCache();
      expect(cache.invalidateTenant).toHaveBeenCalledWith(TENANT);
    });
  });
});
```

### 6.10 Fichier 10 sur 12 : Controller admin

```typescript
// repo/apps/api/src/modules/admin/controllers/admin-custom-fields.controller.ts
import {
  Controller, Get, Post, Patch, Body, Param, Query, UseGuards, UseInterceptors,
  HttpCode, HttpStatus, ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiBearerAuth, ApiHeader, ApiBody, ApiResponse,
} from '@nestjs/swagger';
import { z } from 'zod';
import {
  CustomFieldsService,
  CreateFieldDefinitionSchema, UpdateFieldDefinitionSchema,
  type CreateFieldDefinitionDto, type UpdateFieldDefinitionDto,
  CUSTOM_FIELD_ENTITY_TYPES,
} from '@insurtech/crm';
import {
  JwtAuthGuard, CurrentUser, type AuthenticatedUser,
  TenantContextGuard, TenantTransactionInterceptor,
  PermissionGuard, RequirePermission, Permission,
} from '@insurtech/auth';
import { ZodValidationPipe } from '@insurtech/shared-utils';

const ListFiltersSchema = z.object({
  entity_type: z.enum(CUSTOM_FIELD_ENTITY_TYPES),
  include_inactive: z.coerce.boolean().optional().default(false),
}).strict();

@ApiTags('Admin Custom Fields')
@ApiBearerAuth()
@ApiHeader({ name: 'x-tenant-id', required: true })
@Controller('admin/custom-fields')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
@UseInterceptors(TenantTransactionInterceptor)
export class AdminCustomFieldsController {
  constructor(private readonly customFieldsService: CustomFieldsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission(Permission.ADMIN_CUSTOM_FIELDS_MANAGE)
  @ApiOperation({ summary: 'Define a new custom field for tenant entity' })
  @ApiBody({
    schema: {
      example: {
        entity_type: 'contact',
        field_name: 'matricule',
        field_type: 'string',
        options: { min_length: 5, max_length: 12 },
        required: false,
        position: 1,
        active: true,
        label_fr: 'Matricule',
        label_ar: 'رقم التسجيل',
        label_en: 'Registration ID',
        help_text: 'Identifiant interne du contact',
      },
    },
  })
  @ApiResponse({ status: 201 })
  @ApiResponse({ status: 400, description: 'field_name reserve OR limite atteinte OR validation' })
  @ApiResponse({ status: 409, description: 'Duplicate' })
  async define(
    @Body(new ZodValidationPipe(CreateFieldDefinitionSchema)) dto: CreateFieldDefinitionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.customFieldsService.defineField(dto, user.id);
  }

  @Get()
  @RequirePermission(Permission.ADMIN_CUSTOM_FIELDS_MANAGE)
  @ApiOperation({ summary: 'List custom field definitions for an entity_type' })
  async list(
    @Query(new ZodValidationPipe(ListFiltersSchema)) filters: z.infer<typeof ListFiltersSchema>,
  ) {
    const defs = await this.customFieldsService.listDefinitionsByEntity(filters.entity_type);
    if (filters.include_inactive) return defs;
    return defs.filter((d) => d.active);
  }

  @Get(':id')
  @RequirePermission(Permission.ADMIN_CUSTOM_FIELDS_MANAGE)
  async findById(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.customFieldsService.findById(id);
  }

  @Patch(':id')
  @RequirePermission(Permission.ADMIN_CUSTOM_FIELDS_MANAGE)
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(UpdateFieldDefinitionSchema)) dto: UpdateFieldDefinitionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.customFieldsService.updateDefinition(id, dto, user.id);
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(Permission.ADMIN_CUSTOM_FIELDS_MANAGE)
  @ApiOperation({ summary: 'Deactivate definition (soft, preserves audit + data)' })
  async deactivate(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.customFieldsService.deactivateDefinition(id, user.id);
  }

  @Post('purge-cache')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(Permission.ADMIN_CUSTOM_FIELDS_MANAGE)
  @ApiOperation({ summary: 'Purge cache definitions for tenant (after bulk changes)' })
  async purgeCache() {
    await this.customFieldsService.purgeCache();
    return { purged: true };
  }
}
```

### 6.11 Fichier 11 sur 12 : E2E custom-fields

```typescript
// repo/apps/api/test/admin/custom-fields.e2e-spec.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import {
  createTestTenant, createTestUser, loginAndGetJwt,
} from '../fixtures/auth-test-helpers';

async function truncateDefs(ds: DataSource, tenantId: string) {
  await ds.query(`DELETE FROM custom_field_definitions WHERE tenant_id = $1`, [tenantId]);
}

describe('Admin Custom Fields E2E', () => {
  let app: INestApplication;
  let ds: DataSource;
  let tenantId: string;
  let jwtAdmin: string;
  let jwtBrokerUser: string;

  beforeAll(async () => {
    const m = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = m.createNestApplication();
    await app.init();
    ds = m.get(DataSource);
    tenantId = (await createTestTenant(ds, 't_317')).id;
    jwtAdmin = await loginAndGetJwt(app, await createTestUser(ds, tenantId, 'broker_admin'));
    jwtBrokerUser = await loginAndGetJwt(app, await createTestUser(ds, tenantId, 'broker_user'));
  });

  beforeEach(async () => { await truncateDefs(ds, tenantId); });

  afterAll(async () => {
    await truncateDefs(ds, tenantId);
    await app.close();
  });

  it('cree definition string (admin)', async () => {
    const r = await request(app.getHttpServer())
      .post('/api/v1/admin/custom-fields')
      .set('Authorization', `Bearer ${jwtAdmin}`)
      .set('x-tenant-id', tenantId)
      .send({
        entity_type: 'contact',
        field_name: 'matricule',
        field_type: 'string',
        options: { min_length: 3, max_length: 20 },
        required: false,
        position: 1,
        active: true,
        label_fr: 'Matricule',
      });
    expect(r.status).toBe(201);
    expect(r.body.data.field_name).toBe('matricule');
  });

  it('cree definition enum avec values', async () => {
    const r = await request(app.getHttpServer())
      .post('/api/v1/admin/custom-fields')
      .set('Authorization', `Bearer ${jwtAdmin}`)
      .set('x-tenant-id', tenantId)
      .send({
        entity_type: 'company',
        field_name: 'taille_segment',
        field_type: 'enum',
        options: {
          values: [
            { value: 'small', label_fr: 'Petit' },
            { value: 'medium', label_fr: 'Moyen' },
            { value: 'large', label_fr: 'Grand' },
          ],
        },
        required: false,
        position: 1,
        label_fr: 'Taille segment',
      });
    expect(r.status).toBe(201);
  });

  it('rejette field_name reserve', async () => {
    const r = await request(app.getHttpServer())
      .post('/api/v1/admin/custom-fields')
      .set('Authorization', `Bearer ${jwtAdmin}`)
      .set('x-tenant-id', tenantId)
      .send({
        entity_type: 'contact', field_name: 'id', field_type: 'string',
        options: {}, position: 1, label_fr: 'ID',
      });
    expect(r.status).toBe(400);
  });

  it('rejette field_name format invalide', async () => {
    const r = await request(app.getHttpServer())
      .post('/api/v1/admin/custom-fields')
      .set('Authorization', `Bearer ${jwtAdmin}`)
      .set('x-tenant-id', tenantId)
      .send({
        entity_type: 'contact', field_name: 'INVALID NAME', field_type: 'string',
        options: {}, position: 1, label_fr: 'X',
      });
    expect(r.status).toBe(400);
  });

  it('rejette duplicate (tenant + entity + name)', async () => {
    const payload = {
      entity_type: 'contact', field_name: 'matricule', field_type: 'string',
      options: {}, position: 1, label_fr: 'Matricule',
    };
    await request(app.getHttpServer()).post('/api/v1/admin/custom-fields').set('Authorization', `Bearer ${jwtAdmin}`).set('x-tenant-id', tenantId).send(payload);
    const r = await request(app.getHttpServer())
      .post('/api/v1/admin/custom-fields')
      .set('Authorization', `Bearer ${jwtAdmin}`)
      .set('x-tenant-id', tenantId)
      .send(payload);
    expect(r.status).toBe(409);
  });

  it('rejette broker_user (no permission)', async () => {
    const r = await request(app.getHttpServer())
      .post('/api/v1/admin/custom-fields')
      .set('Authorization', `Bearer ${jwtBrokerUser}`)
      .set('x-tenant-id', tenantId)
      .send({
        entity_type: 'contact', field_name: 'matricule', field_type: 'string',
        options: {}, position: 1, label_fr: 'X',
      });
    expect(r.status).toBe(403);
  });

  it('liste definitions filtre active', async () => {
    await request(app.getHttpServer()).post('/api/v1/admin/custom-fields').set('Authorization', `Bearer ${jwtAdmin}`).set('x-tenant-id', tenantId)
      .send({ entity_type: 'contact', field_name: 'a', field_type: 'string', options: {}, position: 1, label_fr: 'A' });
    await request(app.getHttpServer()).post('/api/v1/admin/custom-fields').set('Authorization', `Bearer ${jwtAdmin}`).set('x-tenant-id', tenantId)
      .send({ entity_type: 'contact', field_name: 'b', field_type: 'string', options: {}, position: 2, label_fr: 'B' });

    const r = await request(app.getHttpServer())
      .get('/api/v1/admin/custom-fields?entity_type=contact')
      .set('Authorization', `Bearer ${jwtAdmin}`)
      .set('x-tenant-id', tenantId);
    expect(r.status).toBe(200);
    expect(r.body.data).toHaveLength(2);
  });

  it('PATCH met a jour required', async () => {
    const c = await request(app.getHttpServer()).post('/api/v1/admin/custom-fields').set('Authorization', `Bearer ${jwtAdmin}`).set('x-tenant-id', tenantId)
      .send({ entity_type: 'contact', field_name: 'mat', field_type: 'string', options: {}, position: 1, label_fr: 'M' });
    const r = await request(app.getHttpServer())
      .patch(`/api/v1/admin/custom-fields/${c.body.data.id}`)
      .set('Authorization', `Bearer ${jwtAdmin}`)
      .set('x-tenant-id', tenantId)
      .send({ required: true });
    expect(r.body.data.required).toBe(true);
  });

  it('deactivate set active=false', async () => {
    const c = await request(app.getHttpServer()).post('/api/v1/admin/custom-fields').set('Authorization', `Bearer ${jwtAdmin}`).set('x-tenant-id', tenantId)
      .send({ entity_type: 'contact', field_name: 'mat', field_type: 'string', options: {}, position: 1, label_fr: 'M' });
    const r = await request(app.getHttpServer())
      .post(`/api/v1/admin/custom-fields/${c.body.data.id}/deactivate`)
      .set('Authorization', `Bearer ${jwtAdmin}`)
      .set('x-tenant-id', tenantId);
    expect(r.body.data.active).toBe(false);
  });

  it('purge-cache reussit', async () => {
    const r = await request(app.getHttpServer())
      .post('/api/v1/admin/custom-fields/purge-cache')
      .set('Authorization', `Bearer ${jwtAdmin}`)
      .set('x-tenant-id', tenantId);
    expect(r.status).toBe(200);
  });

  it('multi-tenant isolation', async () => {
    const otherTenant = (await createTestTenant(ds, 't_317_other')).id;
    const otherJwt = await loginAndGetJwt(app, await createTestUser(ds, otherTenant, 'broker_admin'));

    await request(app.getHttpServer()).post('/api/v1/admin/custom-fields').set('Authorization', `Bearer ${jwtAdmin}`).set('x-tenant-id', tenantId)
      .send({ entity_type: 'contact', field_name: 'mat', field_type: 'string', options: {}, position: 1, label_fr: 'M' });

    const r = await request(app.getHttpServer())
      .get('/api/v1/admin/custom-fields?entity_type=contact')
      .set('Authorization', `Bearer ${otherJwt}`)
      .set('x-tenant-id', otherTenant);
    expect(r.body.data).toHaveLength(0);
  });

  it('limite max 30 atteinte rejete', async () => {
    for (let i = 0; i < 30; i += 1) {
      await request(app.getHttpServer()).post('/api/v1/admin/custom-fields').set('Authorization', `Bearer ${jwtAdmin}`).set('x-tenant-id', tenantId)
        .send({ entity_type: 'contact', field_name: `field${i}`, field_type: 'string', options: {}, position: i + 1, label_fr: `F${i}` });
    }
    const r = await request(app.getHttpServer()).post('/api/v1/admin/custom-fields').set('Authorization', `Bearer ${jwtAdmin}`).set('x-tenant-id', tenantId)
      .send({ entity_type: 'contact', field_name: 'extra', field_type: 'string', options: {}, position: 31, label_fr: 'X' });
    expect(r.status).toBe(400);
  });

  it('field_type enum sans values rejete', async () => {
    const r = await request(app.getHttpServer())
      .post('/api/v1/admin/custom-fields')
      .set('Authorization', `Bearer ${jwtAdmin}`)
      .set('x-tenant-id', tenantId)
      .send({
        entity_type: 'contact', field_name: 'lvl', field_type: 'enum',
        options: { values: [] }, position: 1, label_fr: 'L',
      });
    expect(r.status).toBe(400);
  });
});
```

### 6.12 Fichier 12 sur 12 : Integration test cross-services

```typescript
// repo/apps/api/test/crm/custom-fields-integration.e2e-spec.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import {
  createTestTenant, createTestUser, loginAndGetJwt,
} from '../fixtures/auth-test-helpers';
import {
  createTestContact, createTestCompany, truncateContacts, truncateCompanies,
} from '../fixtures/crm-test-helpers';

describe('Custom Fields Integration with CRM Services', () => {
  let app: INestApplication;
  let ds: DataSource;
  let tenantId: string;
  let jwt: string;

  beforeAll(async () => {
    const m = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = m.createNestApplication();
    await app.init();
    ds = m.get(DataSource);
    tenantId = (await createTestTenant(ds, 't_317_int')).id;
    jwt = await loginAndGetJwt(app, await createTestUser(ds, tenantId, 'broker_admin'));

    // Define some custom fields
    await request(app.getHttpServer()).post('/api/v1/admin/custom-fields').set('Authorization', `Bearer ${jwt}`).set('x-tenant-id', tenantId)
      .send({ entity_type: 'contact', field_name: 'matricule', field_type: 'string', options: { min_length: 3, max_length: 20 }, required: true, position: 1, label_fr: 'Matricule' });
    await request(app.getHttpServer()).post('/api/v1/admin/custom-fields').set('Authorization', `Bearer ${jwt}`).set('x-tenant-id', tenantId)
      .send({ entity_type: 'contact', field_name: 'level', field_type: 'enum', options: { values: [{ value: 'A', label_fr: 'A' }, { value: 'B', label_fr: 'B' }] }, position: 2, label_fr: 'Niveau' });
  });

  afterAll(async () => {
    await ds.query(`DELETE FROM custom_field_definitions WHERE tenant_id = $1`, [tenantId]);
    await truncateContacts(ds, tenantId);
    await app.close();
  });

  it('contact create avec custom_fields valides reussit', async () => {
    const r = await request(app.getHttpServer())
      .post('/api/v1/crm/contacts')
      .set('Authorization', `Bearer ${jwt}`)
      .set('x-tenant-id', tenantId)
      .send({
        first_name: 'Mohamed', last_name: 'Bennani',
        country_code: 'MA', preferred_locale: 'fr',
        custom_fields: { matricule: 'ABC123', level: 'A' },
      });
    expect(r.status).toBe(201);
    expect(r.body.data.custom_fields.matricule).toBe('ABC123');
  });

  it('contact create sans matricule (required) rejete 400', async () => {
    const r = await request(app.getHttpServer())
      .post('/api/v1/crm/contacts')
      .set('Authorization', `Bearer ${jwt}`)
      .set('x-tenant-id', tenantId)
      .send({
        first_name: 'X', last_name: 'Y',
        country_code: 'MA', preferred_locale: 'fr',
        custom_fields: {},
      });
    expect(r.status).toBe(400);
    expect(r.body.error.message).toMatch(/custom_fields/i);
  });

  it('contact create avec level invalide rejete', async () => {
    const r = await request(app.getHttpServer())
      .post('/api/v1/crm/contacts')
      .set('Authorization', `Bearer ${jwt}`)
      .set('x-tenant-id', tenantId)
      .send({
        first_name: 'X', last_name: 'Y',
        country_code: 'MA', preferred_locale: 'fr',
        custom_fields: { matricule: 'ABC', level: 'X_invalid' },
      });
    expect(r.status).toBe(400);
  });

  it('contact create avec field inconnu rejete (strict)', async () => {
    const r = await request(app.getHttpServer())
      .post('/api/v1/crm/contacts')
      .set('Authorization', `Bearer ${jwt}`)
      .set('x-tenant-id', tenantId)
      .send({
        first_name: 'X', last_name: 'Y',
        country_code: 'MA', preferred_locale: 'fr',
        custom_fields: { matricule: 'ABC', unknown_field: 'X' },
      });
    expect(r.status).toBe(400);
  });

  it('PATCH contact update custom_fields valides', async () => {
    const c = await createTestContact(app, jwt, tenantId, {});
    // First add required matricule
    await request(app.getHttpServer())
      .patch(`/api/v1/crm/contacts/${c.id}`)
      .set('Authorization', `Bearer ${jwt}`)
      .set('x-tenant-id', tenantId)
      .send({ custom_fields: { matricule: 'XYZ789', level: 'B' } });
    const r = await request(app.getHttpServer())
      .get(`/api/v1/crm/contacts/${c.id}`)
      .set('Authorization', `Bearer ${jwt}`)
      .set('x-tenant-id', tenantId);
    expect(r.body.data.custom_fields.level).toBe('B');
  });

  it('definition deactivee : data anciennes preservees, nouvelles non requises', async () => {
    // Creer contact avec matricule
    await request(app.getHttpServer()).post('/api/v1/crm/contacts').set('Authorization', `Bearer ${jwt}`).set('x-tenant-id', tenantId)
      .send({ first_name: 'A', last_name: 'B', country_code: 'MA', preferred_locale: 'fr', custom_fields: { matricule: 'OLD123' } });

    // Trouver et deactiver matricule
    const list = await request(app.getHttpServer()).get('/api/v1/admin/custom-fields?entity_type=contact').set('Authorization', `Bearer ${jwt}`).set('x-tenant-id', tenantId);
    const matricule = list.body.data.find((d: any) => d.field_name === 'matricule');
    await request(app.getHttpServer())
      .post(`/api/v1/admin/custom-fields/${matricule.id}/deactivate`)
      .set('Authorization', `Bearer ${jwt}`)
      .set('x-tenant-id', tenantId);

    // Purge cache pour forcer rechargement
    await request(app.getHttpServer()).post('/api/v1/admin/custom-fields/purge-cache').set('Authorization', `Bearer ${jwt}`).set('x-tenant-id', tenantId);

    // Create contact sans matricule maintenant OK
    const r = await request(app.getHttpServer())
      .post('/api/v1/crm/contacts')
      .set('Authorization', `Bearer ${jwt}`)
      .set('x-tenant-id', tenantId)
      .send({ first_name: 'X', last_name: 'Y', country_code: 'MA', preferred_locale: 'fr', custom_fields: {} });
    expect(r.status).toBe(201);
  });
});
```

### 6.13 Modifications retro services CRM

```typescript
// AVANT (extrait packages/crm/src/services/contacts.service.ts)
async create(dto: CreateContactDto, userId: string): Promise<CrmContactEntity> {
  const tenantId = this.requireTenantContext('create');
  // ... validation contact, create, save, kafka ...
}

// APRES Sprint 8 task 3.1.7
async create(dto: CreateContactDto, userId: string): Promise<CrmContactEntity> {
  const tenantId = this.requireTenantContext('create');

  // Validation custom_fields (Sprint 8 task 3.1.7)
  const customFields = (dto as any).custom_fields ?? {};
  await this.customFieldsService.assertCustomFieldsValid('contact', customFields);

  // ... rest unchanged ...
}

// Inject dependency :
// constructor(... private readonly customFieldsService: CustomFieldsService) {}
```

Identique pour `companies.service.ts` (entity_type='company') et `deals.service.ts` (entity_type='deal').

---

## 7. Tests complets

16 unit (6.9) + 10 builder (6.8) + 12 E2E (6.11) + 6 integration (6.12) = 44 tests total.

---

## 8. Variables environnement

```env
# === CRM Custom Fields (Sprint 8 task 3.1.7) ===
CRM_CUSTOM_FIELDS_CACHE_TTL_SECONDS=300
CRM_CUSTOM_FIELDS_MAX_PER_ENTITY=30

# Redis db dedicated
REDIS_CUSTOM_FIELDS_DB=3
```

---

## 9. Commandes shell

```bash
cd repo

# 1. Migration
pnpm --filter @insurtech/database migrate:run
psql $DATABASE_URL -c "\d+ custom_field_definitions"

# 2. Tests
pnpm --filter @insurtech/crm typecheck
pnpm --filter @insurtech/crm test custom-fields zod-schema-builder
pnpm --filter api e2e -- --testPathPattern="(admin/custom-fields|crm/custom-fields)"

# 3. Smoke API
JWT=...
curl -X POST localhost:4000/api/v1/admin/custom-fields \
  -H "Authorization: Bearer $JWT" \
  -H "x-tenant-id: $TENANT" \
  -d '{"entity_type":"contact","field_name":"matricule","field_type":"string","options":{"min_length":3,"max_length":20},"required":false,"position":1,"label_fr":"Matricule"}'

# 4. Verifier cache Redis db=3
redis-cli -n 3 KEYS "crm:custom_fields:*"

# 5. Commit
git add -A
git commit -m "feat(sprint-08): crm custom fields dynamic jsonb + zod runtime

Task: 3.1.7
Sprint: 8 (Phase 3)
Reference: B-08 Tache 3.1.7"
```

---

## 10. Criteres validation V1-V25

### Criteres P0 (15)

- **V1 (P0)** : Migration cree table `custom_field_definitions` avec UNIQUE (tenant_id, entity_type, field_name)
- **V2 (P0)** : typecheck exit 0
- **V3 (P0)** : Tests 16 unit + 10 builder + 12 E2E + 6 integration = 44 PASS
- **V4 (P0)** : POST /admin/custom-fields cree definition + Kafka event + invalide cache
- **V5 (P0)** : 7 field types fonctionnels (string, number, boolean, date, enum, phone, email)
- **V6 (P0)** : Field name reserve rejete 400
- **V7 (P0)** : Field name format invalide (`UPPER`, espaces) rejete 400
- **V8 (P0)** : Duplicate (tenant + entity + field_name) rejete 409
- **V9 (P0)** : Limite max 30 par entity_type respectee
- **V10 (P0)** : i18n labels fr/ar/en
- **V11 (P0)** : Validation custom_fields integree dans CompaniesService.create + ContactsService.create + DealsService.create
- **V12 (P0)** : custom_fields invalides rejete 400 sur create entites
- **V13 (P0)** : RBAC : assure / broker_user -> 403
- **V14 (P0)** : Multi-tenant isolation
- **V15 (P0)** : enum sans values rejete

### Criteres P1 (7)

- **V16 (P1)** : Cache memory + Redis db=3 TTL 5min
- **V17 (P1)** : Cache hit retourne sans DB query
- **V18 (P1)** : Cache invalide sur define / update / deactivate
- **V19 (P1)** : Performance ZodSchemaBuilder.buildFromDefinitions < 20ms sur 30 fields
- **V20 (P1)** : Deactivate preserve audit (active=false vs delete)
- **V21 (P1)** : Coverage custom-fields.service >= 90%
- **V22 (P1)** : purge-cache endpoint operationnel

### Criteres P2 (3)

- **V23 (P2)** : No-emoji
- **V24 (P2)** : Lint 0 erreur
- **V25 (P2)** : Swagger 5 endpoints + examples

---

## 11. Edge cases + troubleshooting

### Edge case 1 : Definition modifie type apres data existante
**Scenario** : tenant_admin change field_type string -> number, data string existante.
**Solution** : Sprint 8 acceptable (pas de migration auto). Documentation : data restent jsonb mais validation Zod rejette futures lectures/updates si exigent type.

### Edge case 2 : Cache memory perdu au redemarrage instance
**Scenario** : crash instance, cache memory vide.
**Solution** : Redis db=3 persistent, recharge automatique au prochain access. Documente.

### Edge case 3 : 2 instances API avec caches memory differents
**Scenario** : instance A invalide cache memory locale, instance B garde stale.
**Solution** : Sprint 8 acceptable (TTL 5min synchronise eventuellement). Sprint 13+ pubsub Redis si critique.

### Edge case 4 : Field renamed (impossible par design)
**Scenario** : tenant veut renommer matricule -> id_employee.
**Solution** : pas supporte (UNIQUE constraint). Tenant doit deactiver ancien + creer nouveau. Documentation.

### Edge case 5 : data custom_fields contient field deactive
**Scenario** : entity stocke `{ matricule: 'X' }` mais definition matricule deactivee.
**Solution** : ZodSchemaBuilder ignore inactives. Validation passe pour data sans matricule. data avec matricule strict() rejette. Documente.

### Edge case 6 : enum option label arabe RTL
**Scenario** : tenant saisit label_ar avec caracteres arabes RTL.
**Solution** : Zod accepte unicode. Postgres TEXT supporte UTF-8. Test V_arabic_label.

### Edge case 7 : Performance avec 30 fields x 1000 entities (validation batch)
**Scenario** : import bulk 1000 contacts.
**Solution** : schema cache evite re-build. Validation par entity ~5ms. 1000 entities ~5s acceptable.

### Edge case 8 : Required field manquant dans PATCH partial
**Scenario** : entity existant avec matricule, PATCH custom_fields={} sans matricule.
**Solution** : Sprint 8 retient strict (PATCH custom_fields ecrit complete). Documentation. Frontend Sprint 16 doit fournir tous required.

### Edge case 9 : Limite Postgres jsonb 268MB par row
**Scenario** : custom_fields stocke 1MB de data.
**Solution** : Sprint 8 metadata schema 8 KB max via Zod refine. custom_fields meme limite via wrapping.

### Edge case 10 : Field name internationalise ('matrícula' avec accent)
**Scenario** : tenant veut saisir field_name avec accents.
**Solution** : regex `/^[a-z][a-z0-9_]+$/` rejette. Documentation. Tenant doit utiliser ASCII pour cle, label_fr pour affichage accent.

---

## 12. Conformite Maroc detaillee

### Loi 09-08 (CNDP)

Custom fields peuvent contenir donnees personnelles supplementaires (ex: matricule fonctionnaire, numero passeport). Tenant_admin doit declarer ces traitements a CNDP. Sprint 12 (Compliance) livrera workflow declaration auto.

### ACAPS Circulaire AS/02/24

Audit trail des modifications de definitions = exigence tracabilite. Audit_logs systematique.

### Loi 17-99 (Code Assurances)

Pas direct.

---

## 13. Conventions absolues skalean-insurtech

(Identique tache 3.1.1 -- 14 categories rappelees integralement.)

---

## 14. Validation pre-commit

```bash
cd repo
pnpm --filter @insurtech/crm typecheck
pnpm --filter @insurtech/crm lint
pnpm --filter @insurtech/crm test
pnpm --filter api e2e -- --testPathPattern="custom-fields"
grep -rP "[\x{1F300}-\x{1F9FF}]" packages/crm/src --include="*.ts" && exit 1 || echo OK
```

---

## 15. Commit message complet

```bash
git add -A
git commit -m "feat(sprint-08): crm custom fields dynamic jsonb + zod runtime per tenant

Permet tenant_admin de definir champs custom per entity_type (contact|company|deal)
sans migration DB. Validation runtime via Zod schema genere depuis definitions.
Cache Redis db=3 + memory in-process TTL 5min.

Livrables:
- Migration custom_field_definitions table avec UNIQUE + RLS
- packages/crm : CustomFieldsService + CustomFieldsCacheService + ZodSchemaBuilder
- 7 field types : string, number, boolean, date, enum, phone, email
- i18n labels fr/ar/en
- apps/api : AdminCustomFieldsController (5 endpoints)
- Integration retro CompaniesService + ContactsService + DealsService validation hooks
- 44 tests : 16 unit + 10 builder + 12 E2E + 6 integration

Conformite MA: Loi 09-08 CNDP (custom fields = donnees personnelles potentielles)
Coverage: 92%

Task: 3.1.7
Sprint: 8 (Phase 3)
Reference: B-08 Tache 3.1.7"
```

---

## 16. Workflow next step

Apres commit :
- Migration `pnpm migrate:run` reussit
- Tests E2E PASS
- Swagger expose `/api/v1/admin/custom-fields/*`
- Mettre a jour `_SUMMARY.md` tache 3.1.7 = complete
- Passer a `task-3.1.8-booking-rooms-resources-reservables.md` (premier module Booking) qui livrera entites Rooms reservables.

---

**Fin du prompt task-3.1.7-crm-custom-fields-jsonb-zod-runtime.md**

Densite : approximativement 100 ko
Code patterns : 12 fichiers (~1900 lignes)
Tests : 44 cas (16 unit + 10 builder + 12 E2E + 6 integration)
Criteres : V1-V25 (15 P0 + 7 P1 + 3 P2)
Edge cases : 10
