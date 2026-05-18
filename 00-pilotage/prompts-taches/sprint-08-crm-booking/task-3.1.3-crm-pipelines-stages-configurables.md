# TACHE 3.1.3 -- CRM Pipelines + Stages Configurables (par Tenant)

**Sprint** : 8 (Phase 3 / Sprint 1 dans phase) -- CRM + Booking Foundations
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-08-sprint-08-crm-booking.md` (Tache 3.1.3)
**Phase** : 3 -- Modules Horizontaux Foundation
**Priorite** : P0 (bloque tache 3.1.4 Deals qui referencent pipeline_id et stage_id)
**Effort** : 5h
**Dependances** : Tache 3.1.2 complete (pattern controller + service + Zod etabli), Sprint 6 task 2.2.8 (TenantOnboardingService -- modifie ici pour appliquer default pipeline), Sprint 7 task 2.3.X (RBAC permissions `Permission.CRM_PIPELINES_*`), Sprint 2 task 1.2.3 (table `crm_pipelines` existante avec stages JSONB)
**Densite cible** : 100-150 ko (auto-suffisant exhaustif)
**AUCUNE EMOJI AUTORISEE**

---

## 1. But

Cette tache 3.1.3 implemente la gestion des pipelines de vente configurables par tenant ainsi que leurs stages (etapes du processus commercial), avec normalisation du modele de donnees vers deux tables relationnelles separees (`crm_pipelines` et `crm_pipeline_stages`) en remplacement du modele initial Sprint 2 utilisant un champ `stages JSONB` sur `crm_pipelines`. Concretement, elle livre une migration TypeORM qui (a) ajoute une nouvelle table `crm_pipeline_stages` referencant `crm_pipelines.id` via FK, (b) introduit une logique de reorderring deterministe via colonne `position INTEGER`, (c) applique un index unique partiel `WHERE is_default = true` garantissant qu'un seul pipeline default existe par tenant. Elle livre aussi les deux entities TypeORM `CrmPipelineEntity` et `CrmPipelineStageEntity`, le service NestJS `PipelinesService` exposant huit methodes (`create`, `findById`, `findAll`, `update`, `softDelete`, `setDefault`, `reorderStages`, `addStage`, `updateStage`, `deleteStage`), le controller REST avec sept endpoints sous `/api/v1/crm/pipelines/*` proteges par la chaine de guards Sprint 5/6/7, les schemas Zod `CreatePipelineSchema`, `UpdatePipelineSchema`, `CreateStageSchema`, `UpdateStageSchema`, `ReorderStagesSchema`, le helper `DefaultPipelineFactory` produisant le template "Pipeline B2B Standard" avec 6 stages (Lead, Qualifie, Proposition, Negociation, Won, Lost) applique automatiquement au tenant onboarding (modification Sprint 6 task 2.2.8), et les suites de tests unitaires (16 cas) et E2E (12 scenarios).

L'apport est triple. Premierement, cette tache concretise la flexibilite metier qui distingue Skalean InsurTech v2.2 des solutions concurrentes : chaque tenant (cabinet de courtage ou garage auto) peut definir ses propres pipelines refletant son organisation commerciale specifique. Un cabinet specialise sante peut creer "Pipeline Sante Collective" avec stages adaptes (Devis demande, Audit besoins, Proposition, Validation MEF, Souscription, Renouvellement) tandis qu'un cabinet auto utilisera "Pipeline Auto Particuliers" avec stages plus courts (Lead, Devis, Souscription, Won/Lost). Un garage utilisera "Pipeline Carrosserie" different de "Pipeline Mecanique" avec stages distincts. Cette flexibilite est imposee par la realite du marche marocain ou les processus commerciaux varient enormement entre cabinets traditionnels (longs cycles avec 8-10 etapes) et cabinets digitaux (courts cycles 4-5 etapes), et entre courtiers familiaux (informel) et grandes structures (formalises ISO).

Deuxiemement, cette tache introduit le concept de stage `is_terminal` avec sous-categorisation `terminal_type` (`won` ou `lost`), critique pour les analytics Sprint 13 et les forecasts financiers Sprint 13 + Sprint 28. Un stage terminal `won` cloture un deal positivement (commission a percevoir, contrat a executer), tandis qu'un stage terminal `lost` cloture un deal negativement (perte commerciale a analyser, raison a tracer). La distinction permet aux dashboards de calculer correctement les taux de conversion (deals en stage `won` / total deals fermes), les forecasts pondered (somme `amount * probability/100` excluant les terminal `lost`), les KPI commerciaux par commercial (broker_user) ou par equipe. La validation metier impose qu'un pipeline ait au minimum un stage terminal `won` ET un stage terminal `lost` (impossibilite de creer pipeline sans cloture), cette regle est appliquee au niveau service au create/update et verifiee par tests V_validation_terminal.

Troisiemement, cette tache prepare l'experience utilisateur Kanban du frontend Sprint 16 (web-broker app) qui affichera les stages en colonnes drag-and-drop. Les colonnes sont reordonnables, leur position determine l'ordre Kanban gauche-droite, leur couleur (`color` champ hex) personnalise visuellement (vert pour Won, rouge pour Lost, bleu pour stages intermediaires), leur `probability` est consommee comme libelle informatif ("70 pour cent chances de cloture"). La logique reorder via endpoint dedicated `POST /pipelines/:id/reorder-stages` accepte un tableau d'IDs avec leurs nouvelles positions, garantissant atomicite (transaction unique) et coherence (`UNIQUE (pipeline_id, position)` constraint).

A l'issue de cette tache, le module `@insurtech/crm` exporte `CrmPipelineEntity`, `CrmPipelineStageEntity`, `PipelinesService`, schemas Zod associes, helper `DefaultPipelineFactory`. La migration `1715000000003-CrmPipelineStages.ts` ajoute la table `crm_pipeline_stages` avec ses index. Le `TenantOnboardingService` Sprint 6 est modifie pour appeler `pipelinesService.createDefaultPipeline(tenantId)` automatiquement lors du provisionning. La commande `pnpm --filter @insurtech/crm test pipelines` execute 16 tests. La commande `pnpm --filter api e2e -- --testPathPattern=crm/pipelines` execute 12 scenarios E2E. Aucune dependance externe nouvelle. Total approximativement 1850 lignes de code TypeScript + SQL.

---

## 2. Contexte etendu

### 2.1 Pourquoi cette tache existe

Sans pipelines configurables, deux scenarios alternatifs auraient pu etre retenus mais furent rejetes. Le premier scenario serait de hardcoder un pipeline unique dans le code (par exemple "Lead -> Qualified -> Proposal -> Won/Lost") force pour tous les tenants. Cette approche, retenue par certains CRM legacy (Microsoft Dynamics 365 jusqu'a la version 8), resout immediatement la complexite implementation mais frustre les utilisateurs qui veulent customiser. Sur le marche marocain, les cabinets de courtage que Skalean InsurTech a interview en phase pre-projet (12 cabinets representatifs Casablanca, Rabat, Marrakech, Tanger, Agadir) demandent unanimement des pipelines distincts par segment business. Hardcoder reviendrait a forcer des workflows non adaptes, vivre avec des champs vides ou des saisies forces, et perdre l'avantage concurrentiel.

Le second scenario serait de proposer un catalog de pipelines standards (5-10 pipelines pre-conques selon vertical : "Auto Particulier", "Sante Collective", "Multirisques Professionnel", etc.) que les tenants peuvent activer ou desactiver mais sans modifier. Cette approche moyenne reduirait la complexite de configuration mais ne couvrirait pas tous les cas. Un cabinet specialise dans les expatries marocains a l'etranger demande un pipeline "Expatries" specifique avec 3 etapes pre-souscription supplementaires (Identite consulat, Compte bancaire MA, RIB international). Aucun catalog standard ne couvre cela.

L'approche retenue est donc le pipeline + stages totalement configurables par tenant, avec un template default "Pipeline B2B Standard" applique automatiquement au onboarding mais modifiable, supprimable, et complementable. Cette approche maximise la flexibilite et minimise la friction. L'investissement supplementaire en complexite (deux tables, validations cross-stages, reorder logic, migration normalisee) est justifie par l'attractivite commerciale et la differenciation concurrentielle.

Le choix de demarrer par Pipelines AVANT Deals (3.1.4) decoule de la dependance fonctionnelle directe : `crm_deals.pipeline_id` FK obligatoire vers `crm_pipelines.id` et `crm_deals.stage_id` FK obligatoire vers `crm_pipeline_stages.id`. Sans pipelines existants, on ne peut pas creer de deal. Le default pipeline applique au onboarding tenant garantit qu'a tout moment un tenant a au moins un pipeline disponible.

### 2.2 Alternatives considerees

| Alternative | Avantages | Inconvenients | Decision |
|-------------|-----------|---------------|----------|
| Pipeline unique hardcoded en code | Simplicite, performance | Pas de personnalisation, frustration utilisateurs | REJETE |
| Catalog 5-10 pipelines standards (activable/desactivable) | Compromis simple | Ne couvre pas tous les cas (expatries, niches) | REJETE |
| Modele JSONB stages dans crm_pipelines (Sprint 2 schema initial) | Une seule table, schema migration existante deja | Reorder complexe, query stages par status difficile, FK depuis deals impossible (deal.stage_id pointer dans JSONB) | REJETE -- justifie migration normalisation Sprint 8 |
| Modele 2 tables normalise crm_pipelines + crm_pipeline_stages (RETENU) | Reorder via UPDATE position, FK natif depuis deals.stage_id, queries optimisees, integrite referentielle | Migration breaking change vs Sprint 2 schema | RETENU avec migration Sprint 8 ajoutant stage table et migrant data existante |
| Modele 3 tables crm_pipelines + crm_stages (catalog global) + crm_pipeline_stages (assoc) | Reuse stages cross-pipelines | Sur-engineering rare cas reuse | REJETE |
| `is_default` boolean unique avec trigger Postgres | Logique BD-side simplifiee | Postgres triggers difficiles a tester, debug | REJETE |
| `is_default` boolean avec UNIQUE INDEX partial WHERE is_default = true (RETENU) | Postgres natif simple, atomique | Logique application doit gerer transition (set new default, unset old) | RETENU |
| Stage `position INTEGER UNIQUE per pipeline` avec gap (10, 20, 30, ...) | Reorder simple : insert entre 20 et 30 = position 25 | Eventuelle saturation (insert entre 21 et 22 impossible) | REJETE -- on utilise positions consecutives 1, 2, 3, ... + reorder full UPDATE |
| Stage probability `INTEGER 0-100` | Simple | Pas de granularite > 1 pour cent | RETENU -- granularite suffisante pour forecasts business |
| Stage probability `NUMERIC(5,2)` 0.00-100.00 | Granularite < 1 pour cent | Sur-precision inutile, comparaisons float buggy | REJETE |
| Validation cross-stages au niveau DB CHECK constraint complex | Garantit invariant | Difficile a maintenir, error messages cryptiques | REJETE -- validation au niveau service application avec error messages clairs |
| Validation cross-stages au niveau service (RETENU) | Error messages clairs, testable | Une couche application a maintenir | RETENU |
| Suppression hard pipeline cascade DELETE stages + deals | Simple | Catastrophe si erreur | REJETE -- soft-delete + verification deals avant delete |
| Soft-delete pipeline avec verification deals existants (RETENU) | Securise | Logique complexe (active deals, archived deals) | RETENU |
| Default pipeline applique au tenant onboarding via Sprint 6 modification | Auto-applied, garantie disponibilite | Coupling Sprint 8 -> Sprint 6 | RETENU justifie |
| Default pipeline applique a la demande (premier deal cree) | Lazy, decouple | Race conditions, UX imprevisible | REJETE |

### 2.3 Trade-offs explicites

Le choix de la migration breaking change (deplacement stages JSONB -> table separee) implique d'accepter une migration de donnees Sprint 8 plus complexe que les autres taches. La migration doit (a) creer la table `crm_pipeline_stages`, (b) iterer sur les rows `crm_pipelines` existantes et extraire le champ `stages JSONB` pour creer les rows `crm_pipeline_stages` correspondantes, (c) verifier que tous les deals existants pointant vers stages JSON sont remappés vers les nouvelles `stage_id` UUID, (d) supprimer la colonne `stages` de `crm_pipelines`. Pour Sprint 8 dans un environnement frais (pas de production data), cette migration data est triviale (aucune row existante). Mais le pattern doit etre testable au cas ou Sprint 8 livrerait apres une production deja deployee. La tache livre une migration TypeORM complete avec rollback `down()` correct.

Le choix d'imposer au minimum un terminal `won` ET un terminal `lost` au niveau service (validation au create/update) implique de rejeter les pipelines simples a 2 stages "Lead -> Won" ou les pipelines exotiques a 1 seul terminal. Le trade-off est entre flexibilite extreme (laisser le tenant decider) et coherence metier (impossibilite de calculer taux conversion sans terminal `lost`). Sprint 8 retient validation stricte ; un cabinet voulant un pipeline 2 stages doit minimum avoir "Lead -> Won" + "Lost" terminal. Documente dans pieges section.

Le choix de `position INTEGER` consecutif (1, 2, 3, ...) avec reorder full UPDATE (vs gap-based 10, 20, 30 ...) implique qu'un reorder de 5 stages execute 5 UPDATE. Cette charge est negligeable en pratique (typiquement 4-8 stages par pipeline) mais theoriquement O(N) plutot que O(1) du gap-based insert. Sprint 8 retient consecutif pour simplicite et lisibilite (positions 1, 2, 3 plus naturelles que 10, 20, 30 pour le frontend).

Le choix d'appliquer le default pipeline au tenant onboarding (vs lazy au premier deal) implique un couplage Sprint 6 task 2.2.8 (TenantOnboardingService) -> Sprint 8 task 3.1.3 (PipelinesService.createDefaultPipeline). Le couplage est gere par injection : `TenantOnboardingService` recoit `PipelinesService` en dependency injection, l'appelle dans la sequence onboarding (creation tenant -> creation default users -> creation default rooms (3.1.8) -> creation default pipeline (3.1.3)). Le trade-off est entre couplage maitrise (sequence claire au onboarding) et lazy (creation a la demande). Lazy a l'avantage du decoupling mais cree des race conditions (deux requests POST /deals concurrents au tenant frais peuvent creer 2 default pipelines).

Le choix de `terminal_type` enum `'won' | 'lost' | NULL` (vs deux booleans separes `is_won`, `is_lost`) implique un enum a 3 valeurs (incluant NULL). Le trade-off est entre enum strict (3 valeurs claires) et booleans (2 colonnes redondantes potentiellement contradictoires comme `is_won=true AND is_lost=true`). Sprint 8 retient enum + check constraint `(is_terminal = false AND terminal_type IS NULL) OR (is_terminal = true AND terminal_type IN ('won', 'lost'))`.

### 2.4 Decisions strategiques referenced

- **decision-001 (Monorepo)** : pertinence totale.
- **decision-002 (Multi-tenant)** : pertinence totale ; pipelines scoped par tenant.
- **decision-003 (TypeORM)** : pertinence totale ; migration ajoute table normalisee.
- **decision-004 (Kafka)** : pertinence directe ; events `crm.pipeline.created`, `crm.stage.added`, `crm.pipeline.deleted`.
- **decision-006 (No-emoji)** : pertinence totale.
- **decision-008 (Data residency)** : pertinence directe ; pipelines + stages stockes Atlas Cloud Maroc.
- **decision-012 (RBAC catalog)** : pertinence directe ; permissions `Permission.CRM_PIPELINES_*` consommees.
- **decision-020 (planifie -- Default pipeline factory)** : decision dediee documentee dans `00-pilotage/decisions/020-default-pipeline-factory.md` (creee implicitement par cette tache).

### 2.5 Pieges techniques connus

1. **Piege : Concurrent set_default pipeline race condition.**
   - Pourquoi : deux requests `setDefault(pipelineA)` et `setDefault(pipelineB)` simultanes peuvent voir tous les deux "no current default" et essayer d'inserer.
   - Solution : transaction serializable + UPDATE en deux etapes (`UPDATE crm_pipelines SET is_default=false WHERE tenant_id=X` puis `UPDATE crm_pipelines SET is_default=true WHERE id=Y`). UNIQUE INDEX partial gere collision finale. Test V_concurrent_default.

2. **Piege : Reorder stages avec ID inexistant dans le tableau.**
   - Pourquoi : frontend envoie `[{id:"A",position:1},{id:"X-non-existant",position:2}]`, le UPDATE reussit pour A et echoue pour X.
   - Solution : verifier au prealable que tous les IDs existent et appartiennent au pipeline + tenant. Si manquant, throw 400 avant aucun UPDATE. Test V_reorder_invalid.

3. **Piege : Reorder oublie un stage existant.**
   - Pourquoi : pipeline a 5 stages, frontend envoie reorder de 4 IDs seulement -> 1 stage reste avec ancienne position, conflit potentiel UNIQUE.
   - Solution : verifier que le tableau reorder contient EXACTEMENT tous les stages du pipeline (Set comparison). Si manquant, throw 400.

4. **Piege : Delete pipeline avec deals existants en stage `won` archives.**
   - Pourquoi : verification "no deals attached" peut echouer si elle filtre `status='open'` uniquement (ignorant les deals fermes).
   - Solution : verifier "no deals at all" (open + closed). Si tenant veut supprimer pipeline historique, soft-delete cascade non desire ; alternative : provider endpoint `archive` (set inactive boolean) sans verifications.

5. **Piege : Stage avec `is_terminal=true` mais `terminal_type=null`.**
   - Pourquoi : oubli de set terminal_type lors create.
   - Solution : Zod schema cross-field validation : `if (is_terminal) require terminal_type`. CHECK constraint Postgres miroir. Test V_terminal_consistency.

6. **Piege : Pipeline sans stage `won` cree, deal en stage final perdu.**
   - Pourquoi : tenant cree pipeline custom 3 stages "Lead", "Process", "Done" sans terminal type.
   - Solution : validation service create/update : check au moins 1 won + 1 lost. Throw 400 si manquant.

7. **Piege : Position 0 vs position 1 -- hesitation 0-indexed/1-indexed.**
   - Pourquoi : developpeurs habitues 0-indexed, business 1-indexed.
   - Solution : convention strict 1-indexed (position 1 = first stage Kanban left). Documente.

8. **Piege : Default pipeline "Lost" stage avec probability=0 mais frontend affiche "0 pour cent" trompeur.**
   - Pourquoi : probability est information consultative ; pour terminal lost, 0 pour cent est exact.
   - Solution : frontend Sprint 16 affichera "Perdu" texte au lieu de "0 pour cent" pour terminal_type='lost'. Backend stocke probability=0 propre.

9. **Piege : Color hex format inconsistant (#FF0000 vs FF0000 vs rgb(255,0,0)).**
   - Pourquoi : formats multiples possibles.
   - Solution : Zod regex `/^#[0-9A-Fa-f]{6}$/` strict. Normalisation upper-case au save.

10. **Piege : Pipeline name doublon meme tenant rejete UNIQUE.**
    - Pourquoi : UNIQUE (tenant_id, name) garantit unicite.
    - Solution : service catch erreur 23505 et translate en ConflictException. Test V_duplicate_name.

11. **Piege : Default factory cree pipeline avec stages trop nombreux pour cabinets courts cycles.**
    - Pourquoi : 6 stages standard ne match pas tous workflows.
    - Solution : tenant peut modifier le default apres creation (delete stages superflus). Documente dans onboarding flow.

12. **Piege : Probability values incoherentes (Lead=80 pour cent, Won=50 pour cent).**
    - Pourquoi : tenant peut saisir n'importe quoi.
    - Solution : Sprint 8 ne valide pas la coherence ascendante (un Lead a 80 pour cent et Won a 50 pour cent est aberrant mais accepte). Sprint 13 (Analytics) detectera et alertera. Documente.

13. **Piege : Reorder via SET UNIQUE viole transient.**
    - Pourquoi : si on update positions de 5 stages dans une transaction, l'ordre des UPDATE peut creer collision temporaire (stage A position 2 avant que stage B position 2 soit modifie).
    - Solution : strategie 2 phases : (1) set tous positions a position+1000 (eviter collision), (2) set positions cibles. Ou utiliser DEFERRED UNIQUE constraint Postgres. Sprint 8 retient strategie 2 phases simple.

14. **Piege : Stage delete avec deals existants en ce stage.**
    - Pourquoi : stage utilise par 100 deals, suppression casse FK.
    - Solution : check "no deals at this stage" avant delete. Si deals, suggest moveToStage ou archive. Test V_delete_stage_with_deals.

15. **Piege : Tenant qui n'a PAS de default pipeline (cas import legacy).**
    - Pourquoi : tenant migre depuis CRM legacy n'a pas onboarding standard.
    - Solution : endpoint `POST /pipelines/setup-default` que tenant_admin peut appeler manuellement pour creer le default.

16. **Piege : Le default pipeline est supprime, plus de default disponible.**
    - Pourquoi : tenant peut supprimer le default pipeline.
    - Solution : si tentative delete sur default, throw 400 avec message "designez d'abord un autre pipeline default avant suppression". Alternative : auto-promote second pipeline as default.

17. **Piege : Stages reorder change probability ascendante.**
    - Pourquoi : reorder peut placer Won (probability=100) avant Lead (probability=10).
    - Solution : pas de validation Sprint 8 (souplesse). Sprint 13 analytics detectera.

18. **Piege : Pipeline name avec caracteres Unicode arabe.**
    - Pourquoi : tenant marocain peut nommer pipeline en darija "Pipeline Auto Particuliers".
    - Solution : Zod accepte string Unicode (pas regex restrictive ASCII-only). Documente.

---

## 3. Architecture context

### 3.1 Position dans le sprint

Tache 3.1.3 est la TROISIEME du Sprint 8. Sequence : 3.1.1 Companies -> 3.1.2 Contacts -> 3.1.3 Pipelines/Stages -> 3.1.4 Deals -> 3.1.5 Interactions -> 3.1.6 Search -> 3.1.7 Custom Fields -> 3.1.8 Rooms -> 3.1.9 Appointments -> 3.1.10 OAuth -> 3.1.11 Availability -> 3.1.12 Sync bi-dir -> 3.1.13 iCal -> 3.1.14 Tests E2E + Seeds.

Consommateurs aval :
- **Tache 3.1.4 (Deals)** : `crm_deals.pipeline_id` + `crm_deals.stage_id` FK. Service Deals utilise `pipelinesService.findStageById` pour valider transitions stage.
- **Tache 3.1.5 (Interactions)** : pas de dependance directe.
- **Tache 3.1.14 (Tests + Seeds)** : seeds creent pipelines additionnels par tenant.

Dependances amont :
- **Tache 3.1.2** : pattern controller etabli, factory test helpers.
- **Sprint 6 task 2.2.8** : modification pour appliquer default pipeline au onboarding.
- **Sprint 7** : permissions `Permission.CRM_PIPELINES_CREATE/READ/UPDATE/DELETE`.
- **Sprint 2 task 1.2.3** : table `crm_pipelines` initialement avec stages JSONB ; cette tache 3.1.3 normalise via migration breaking.

### 3.2 Position dans le programme global

Pipelines + Stages consommes par :
- **Sprint 13 (Analytics)** : dashboards taux conversion par stage, forecast pondered.
- **Sprint 14-15 (Insure)** : pipelines specifiques produits assurance peuvent etre crees par cabinet.
- **Sprint 16 (web-broker)** : page Kanban consomme stages position + color.
- **Sprint 17 (web-customer-portal)** : prospects auto-attribues pipeline default lead capture.
- **Sprint 26 (Admin foundation)** : admin cross-tenant peut consulter pipelines tenants.
- **Sprint 28 (Admin reports)** : exports incluent breakdown deals par stage.

### 3.3 Diagramme

```
                              +------------------+
                              | Frontend Sprint  |
                              | 16 web-broker    |
                              | Kanban /deals    |
                              +---------+--------+
                                        |
                                        | GET /pipelines + stages
                                        | (cache-fed)
                                        v
+--------------------------------------------------------------+
| ApiNestJS                                                    |
|                                                              |
|  PipelinesController (Sprint 8 task 3.1.3)                   |
|    POST   /api/v1/crm/pipelines                              |
|    GET    /api/v1/crm/pipelines                              |
|    GET    /api/v1/crm/pipelines/:id                          |
|    PATCH  /api/v1/crm/pipelines/:id                          |
|    DELETE /api/v1/crm/pipelines/:id                          |
|    POST   /api/v1/crm/pipelines/:id/set-default              |
|    POST   /api/v1/crm/pipelines/:id/reorder-stages           |
|                                                              |
|  PipelinesService                                            |
|    + DefaultPipelineFactory                                  |
|    + Validation cross-stages (1 won + 1 lost minimum)        |
|                                                              |
|  Consume by :                                                |
|    DealsService (3.1.4) -- validate stage transitions        |
|    TenantOnboardingService (Sprint 6) -- default pipeline    |
+----------+---------------------------------------------------+
           |
           v
+----------+--------------------------+
| Postgres                            |
|                                     |
|  crm_pipelines                      |
|    id, tenant_id, name, description |
|    is_default, active               |
|    UNIQUE (tenant_id, name)         |
|    UNIQUE INDEX WHERE is_default    |
|                                     |
|  crm_pipeline_stages                |
|    id, pipeline_id, name, position  |
|    probability, color               |
|    is_terminal, terminal_type       |
|    UNIQUE (pipeline_id, position)   |
|    CHECK (terminal consistency)     |
+-------------------------------------+
```

---

## 4. Livrables checkables

- [ ] Migration `repo/packages/database/src/migrations/1715000000003-CrmPipelineStages.ts` (~150 lignes)
- [ ] Entity `repo/packages/crm/src/entities/crm-pipeline.entity.ts` (~50 lignes)
- [ ] Entity `repo/packages/crm/src/entities/crm-pipeline-stage.entity.ts` (~65 lignes)
- [ ] Service `repo/packages/crm/src/services/pipelines.service.ts` (~380 lignes)
- [ ] Service spec `repo/packages/crm/src/services/pipelines.service.spec.ts` (~280 lignes, 16 tests)
- [ ] Schemas `repo/packages/crm/src/schemas/pipeline.schema.ts` (~120 lignes)
- [ ] Factory `repo/packages/crm/src/factories/default-pipeline.factory.ts` (~80 lignes)
- [ ] Controller `repo/apps/api/src/modules/crm/controllers/pipelines.controller.ts` (~210 lignes, 7 endpoints)
- [ ] E2E tests `repo/apps/api/test/crm/pipelines.e2e-spec.ts` (~380 lignes, 12 scenarios)
- [ ] Helpers `repo/apps/api/test/fixtures/crm-test-helpers.ts` (modifie : +`createTestPipeline`, `buildPipelineDto`, `truncatePipelines`)
- [ ] Module `repo/packages/crm/src/crm.module.ts` (modifie : +PipelinesService)
- [ ] Module `repo/apps/api/src/modules/crm/crm.module.ts` (modifie : +PipelinesController)
- [ ] Index `repo/packages/crm/src/index.ts` (modifie : +exports)
- [ ] Modification Sprint 6 `repo/packages/auth/src/services/tenant-onboarding.service.ts` (+ appel `pipelinesService.createDefaultPipeline`)
- [ ] Validation : pipeline avec 0 stage rejete 400
- [ ] Validation : pipeline sans terminal won OR lost rejete 400
- [ ] Validation : delete pipeline avec deals -> 409
- [ ] Validation : `is_default` UNIQUE par tenant (un seul)
- [ ] Endpoint `POST /:id/reorder-stages` atomique (transaction)
- [ ] Default factory cree 6 stages standard
- [ ] Tests : 16 unit + 12 E2E
- [ ] Coverage >= 90% pipelines.service.ts
- [ ] Aucune emoji
- [ ] Build + Typecheck + Lint passants

---

## 5. Fichiers crees / modifies

```
CREES :
repo/packages/database/src/migrations/1715000000003-CrmPipelineStages.ts        ~150 lignes
repo/packages/crm/src/entities/crm-pipeline.entity.ts                            ~50 lignes
repo/packages/crm/src/entities/crm-pipeline-stage.entity.ts                      ~65 lignes
repo/packages/crm/src/services/pipelines.service.ts                             ~380 lignes
repo/packages/crm/src/services/pipelines.service.spec.ts                        ~280 lignes
repo/packages/crm/src/schemas/pipeline.schema.ts                                ~120 lignes
repo/packages/crm/src/factories/default-pipeline.factory.ts                      ~80 lignes
repo/apps/api/src/modules/crm/controllers/pipelines.controller.ts               ~210 lignes
repo/apps/api/test/crm/pipelines.e2e-spec.ts                                    ~380 lignes

MODIFIES :
repo/packages/crm/src/crm.module.ts                                              +5 lignes
repo/packages/crm/src/index.ts                                                   +12 lignes
repo/apps/api/src/modules/crm/crm.module.ts                                      +2 lignes
repo/apps/api/test/fixtures/crm-test-helpers.ts                                  +50 lignes
repo/packages/auth/src/services/tenant-onboarding.service.ts                     +5 lignes
```

Total nouveau code : approximativement 1850 lignes.

---

## 6. Code patterns COMPLETS

### 6.1 Fichier 1 sur 9 : `repo/packages/database/src/migrations/1715000000003-CrmPipelineStages.ts`

```typescript
// repo/packages/database/src/migrations/1715000000003-CrmPipelineStages.ts
import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sprint 8 task 3.1.3 -- Normalisation pipelines/stages.
 *
 * Sprint 2 task 1.2.3 a cree `crm_pipelines` avec colonne `stages JSONB`.
 * Cette migration :
 * 1. Cree table separee `crm_pipeline_stages`.
 * 2. Migre data JSON vers rows (foreach pipeline existante, foreach stage in JSON).
 * 3. Supprime colonne `stages JSONB` de `crm_pipelines`.
 * 4. Ajoute UNIQUE INDEX partial WHERE is_default = true.
 * 5. Modifie `crm_deals.stage_id UUID` au lieu de `stage TEXT` (deal table modifie via migration ulterieure ou inclus ici).
 */
export class CrmPipelineStages1715000000003 implements MigrationInterface {
  name = 'CrmPipelineStages1715000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Creer table crm_pipeline_stages
    await queryRunner.query(`
      CREATE TABLE crm_pipeline_stages (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        pipeline_id UUID NOT NULL REFERENCES crm_pipelines(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        position INTEGER NOT NULL,
        probability INTEGER NOT NULL DEFAULT 50,
        color VARCHAR(7) NOT NULL DEFAULT '#808080',
        is_terminal BOOLEAN NOT NULL DEFAULT false,
        terminal_type VARCHAR(10) NULL,
        description TEXT NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ NULL,
        CONSTRAINT chk_stage_probability CHECK (probability BETWEEN 0 AND 100),
        CONSTRAINT chk_stage_color CHECK (color ~* '^#[0-9A-F]{6}$'),
        CONSTRAINT chk_stage_terminal_type CHECK (terminal_type IN ('won', 'lost') OR terminal_type IS NULL),
        CONSTRAINT chk_stage_terminal_consistency CHECK (
          (is_terminal = false AND terminal_type IS NULL)
          OR (is_terminal = true AND terminal_type IN ('won', 'lost'))
        ),
        CONSTRAINT chk_stage_position_positive CHECK (position >= 1)
      );
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX idx_crm_pipeline_stages_position
        ON crm_pipeline_stages(pipeline_id, position)
        WHERE deleted_at IS NULL;
    `);
    await queryRunner.query(`
      CREATE INDEX idx_crm_pipeline_stages_pipeline
        ON crm_pipeline_stages(pipeline_id)
        WHERE deleted_at IS NULL;
    `);
    await queryRunner.query(`
      CREATE INDEX idx_crm_pipeline_stages_terminal
        ON crm_pipeline_stages(pipeline_id, is_terminal, terminal_type)
        WHERE deleted_at IS NULL;
    `);

    // 2. Migrer data JSONB -> rows (idempotent, geste vide si tenant frais)
    await queryRunner.query(`
      INSERT INTO crm_pipeline_stages (pipeline_id, name, position, probability, color, is_terminal, terminal_type)
      SELECT
        p.id AS pipeline_id,
        COALESCE(s->>'name', 'Stage ' || (idx + 1)) AS name,
        (idx + 1)::INTEGER AS position,
        COALESCE((s->>'probability')::INTEGER, 50) AS probability,
        COALESCE(s->>'color', '#808080') AS color,
        COALESCE((s->>'is_terminal')::BOOLEAN, false) AS is_terminal,
        s->>'terminal_type' AS terminal_type
      FROM crm_pipelines p,
        LATERAL jsonb_array_elements(p.stages) WITH ORDINALITY arr(s, idx)
      WHERE p.stages IS NOT NULL AND jsonb_typeof(p.stages) = 'array';
    `);

    // 3. Ajouter UNIQUE INDEX partial pour is_default
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_crm_pipelines_default;
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX idx_crm_pipelines_default
        ON crm_pipelines(tenant_id)
        WHERE is_default = true AND deleted_at IS NULL;
    `);

    // 4. Renommer colonne stages -> stages_legacy (preserve audit trail) puis drop
    // (en environnement frais Sprint 8, la colonne est deja vide)
    await queryRunner.query(`
      ALTER TABLE crm_pipelines DROP COLUMN IF EXISTS stages;
    `);

    // 5. Ajouter colonne `description` et `active` boolean si pas deja
    await queryRunner.query(`
      ALTER TABLE crm_pipelines
        ADD COLUMN IF NOT EXISTS description TEXT NULL,
        ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;
    `);

    // 6. UNIQUE (tenant_id, name) sur pipelines
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_crm_pipelines_name_unique;
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX idx_crm_pipelines_name_unique
        ON crm_pipelines(tenant_id, name)
        WHERE deleted_at IS NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse : recreer colonne stages JSONB et migrer data inverse
    await queryRunner.query(`
      ALTER TABLE crm_pipelines ADD COLUMN stages JSONB NULL;
    `);
    await queryRunner.query(`
      UPDATE crm_pipelines p SET stages = (
        SELECT jsonb_agg(jsonb_build_object(
          'name', s.name,
          'position', s.position,
          'probability', s.probability,
          'color', s.color,
          'is_terminal', s.is_terminal,
          'terminal_type', s.terminal_type
        ) ORDER BY s.position)
        FROM crm_pipeline_stages s
        WHERE s.pipeline_id = p.id AND s.deleted_at IS NULL
      );
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS crm_pipeline_stages;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_crm_pipelines_default;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_crm_pipelines_name_unique;`);
    await queryRunner.query(`
      ALTER TABLE crm_pipelines
        DROP COLUMN IF EXISTS description,
        DROP COLUMN IF EXISTS active;
    `);
  }
}
```

### 6.2 Fichier 2 sur 9 : `repo/packages/crm/src/entities/crm-pipeline.entity.ts`

```typescript
// repo/packages/crm/src/entities/crm-pipeline.entity.ts
import {
  Entity, Column, PrimaryGeneratedColumn,
  CreateDateColumn, UpdateDateColumn, DeleteDateColumn,
  Index, OneToMany,
} from 'typeorm';
import { CrmPipelineStageEntity } from './crm-pipeline-stage.entity';

@Entity({ name: 'crm_pipelines' })
@Index('idx_crm_pipelines_tenant', ['tenant_id'])
export class CrmPipelineEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: false })
  tenant_id!: string;

  @Column({ type: 'text', nullable: false })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ type: 'boolean', nullable: false, default: false })
  is_default!: boolean;

  @Column({ type: 'boolean', nullable: false, default: true })
  active!: boolean;

  @Column({ type: 'jsonb', nullable: false, default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;

  @OneToMany(() => CrmPipelineStageEntity, (s) => s.pipeline, { cascade: false })
  stages?: CrmPipelineStageEntity[];

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

### 6.3 Fichier 3 sur 9 : `repo/packages/crm/src/entities/crm-pipeline-stage.entity.ts`

```typescript
// repo/packages/crm/src/entities/crm-pipeline-stage.entity.ts
import {
  Entity, Column, PrimaryGeneratedColumn,
  CreateDateColumn, UpdateDateColumn, DeleteDateColumn,
  Index, ManyToOne, JoinColumn,
} from 'typeorm';
import { CrmPipelineEntity } from './crm-pipeline.entity';

export type StageTerminalType = 'won' | 'lost';

@Entity({ name: 'crm_pipeline_stages' })
@Index('idx_crm_pipeline_stages_pipeline', ['pipeline_id'])
@Index('idx_crm_pipeline_stages_position', ['pipeline_id', 'position'], { unique: true })
export class CrmPipelineStageEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: false })
  pipeline_id!: string;

  @ManyToOne(() => CrmPipelineEntity, (p) => p.stages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pipeline_id' })
  pipeline?: CrmPipelineEntity;

  @Column({ type: 'text', nullable: false })
  name!: string;

  @Column({ type: 'integer', nullable: false })
  position!: number;

  @Column({ type: 'integer', nullable: false, default: 50 })
  probability!: number;

  @Column({ type: 'varchar', length: 7, nullable: false, default: '#808080' })
  color!: string;

  @Column({ type: 'boolean', nullable: false, default: false })
  is_terminal!: boolean;

  @Column({ type: 'varchar', length: 10, nullable: true })
  terminal_type?: StageTerminalType | null;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ type: 'jsonb', nullable: false, default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_at?: Date | null;
}
```

### 6.4 Fichier 4 sur 9 : `repo/packages/crm/src/factories/default-pipeline.factory.ts`

```typescript
// repo/packages/crm/src/factories/default-pipeline.factory.ts
import type { CreatePipelineDto } from '../schemas/pipeline.schema';

/**
 * Factory produisant le pipeline default applique au tenant onboarding.
 *
 * Template "Pipeline B2B Standard" avec 6 stages :
 * 1. Lead          (probability 10, blue)
 * 2. Qualifie      (probability 30, indigo)
 * 3. Proposition   (probability 50, yellow)
 * 4. Negociation   (probability 70, orange)
 * 5. Won (terminal won, probability 100, green)
 * 6. Lost (terminal lost, probability 0, red)
 *
 * Reference : decision-020 (planifie -- Default pipeline factory).
 */
export const DEFAULT_PIPELINE_NAME = 'Pipeline B2B Standard';

export const DEFAULT_PIPELINE_STAGES = [
  { name: 'Lead', position: 1, probability: 10, color: '#3B82F6', is_terminal: false, terminal_type: null },
  { name: 'Qualifie', position: 2, probability: 30, color: '#6366F1', is_terminal: false, terminal_type: null },
  { name: 'Proposition', position: 3, probability: 50, color: '#EAB308', is_terminal: false, terminal_type: null },
  { name: 'Negociation', position: 4, probability: 70, color: '#F97316', is_terminal: false, terminal_type: null },
  { name: 'Won', position: 5, probability: 100, color: '#10B981', is_terminal: true, terminal_type: 'won' as const },
  { name: 'Lost', position: 6, probability: 0, color: '#EF4444', is_terminal: true, terminal_type: 'lost' as const },
] as const;

export class DefaultPipelineFactory {
  static buildDefaultPipelineDto(): CreatePipelineDto {
    return {
      name: DEFAULT_PIPELINE_NAME,
      description: 'Pipeline standard livre par Skalean InsurTech au onboarding tenant. Modifiable.',
      is_default: true,
      active: true,
      stages: DEFAULT_PIPELINE_STAGES.map((s) => ({
        name: s.name,
        position: s.position,
        probability: s.probability,
        color: s.color,
        is_terminal: s.is_terminal,
        terminal_type: s.terminal_type,
        description: null,
      })),
      metadata: { created_by_factory: true, factory_version: 'v1.0' },
    };
  }
}
```

### 6.5 Fichier 5 sur 9 : `repo/packages/crm/src/schemas/pipeline.schema.ts`

```typescript
// repo/packages/crm/src/schemas/pipeline.schema.ts
import { z } from 'zod';

const TERMINAL_TYPES = ['won', 'lost'] as const;
const COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

export const CreateStageSchema = z.object({
  name: z.string().trim().min(1).max(100),
  position: z.number().int().min(1).max(50),
  probability: z.number().int().min(0).max(100).default(50),
  color: z.string().regex(COLOR_REGEX, { message: 'color hex format requis' }).default('#808080'),
  is_terminal: z.boolean().default(false),
  terminal_type: z.enum(TERMINAL_TYPES).nullable().optional(),
  description: z.string().trim().max(500).nullable().optional(),
}).superRefine((data, ctx) => {
  if (data.is_terminal && !data.terminal_type) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'is_terminal=true requiert terminal_type "won" ou "lost"',
      path: ['terminal_type'],
    });
  }
  if (!data.is_terminal && data.terminal_type) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'terminal_type set requiert is_terminal=true',
      path: ['is_terminal'],
    });
  }
});

export type CreateStageDto = z.infer<typeof CreateStageSchema>;

export const CreatePipelineSchema = z.object({
  name: z.string().trim().min(1).max(150),
  description: z.string().trim().max(1000).nullable().optional(),
  is_default: z.boolean().default(false),
  active: z.boolean().default(true),
  metadata: z.record(z.unknown()).default({}),
  stages: z.array(CreateStageSchema).min(2, 'Minimum 2 stages requis'),
}).strict().superRefine((data, ctx) => {
  // Validation : au moins 1 won + 1 lost terminal
  const wonStages = data.stages.filter((s) => s.terminal_type === 'won');
  const lostStages = data.stages.filter((s) => s.terminal_type === 'lost');
  if (wonStages.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Pipeline doit avoir au moins 1 stage terminal "won"',
      path: ['stages'],
    });
  }
  if (lostStages.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Pipeline doit avoir au moins 1 stage terminal "lost"',
      path: ['stages'],
    });
  }
  // Validation : positions uniques
  const positions = data.stages.map((s) => s.position);
  if (new Set(positions).size !== positions.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Stages positions doivent etre uniques',
      path: ['stages'],
    });
  }
  // Validation : noms uniques
  const names = data.stages.map((s) => s.name.toLowerCase());
  if (new Set(names).size !== names.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Stages noms doivent etre uniques (case-insensitive)',
      path: ['stages'],
    });
  }
});

export type CreatePipelineDto = z.infer<typeof CreatePipelineSchema>;

export const UpdatePipelineSchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  active: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
}).strict().refine(
  (d) => Object.keys(d).length > 0,
  { message: 'Au moins un champ requis' },
);

export type UpdatePipelineDto = z.infer<typeof UpdatePipelineSchema>;

export const UpdateStageSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  probability: z.number().int().min(0).max(100).optional(),
  color: z.string().regex(COLOR_REGEX).optional(),
  description: z.string().trim().max(500).nullable().optional(),
}).strict().refine(
  (d) => Object.keys(d).length > 0,
  { message: 'Au moins un champ requis' },
);

export type UpdateStageDto = z.infer<typeof UpdateStageSchema>;

export const ReorderStagesSchema = z.object({
  stages: z.array(z.object({
    id: z.string().uuid(),
    position: z.number().int().min(1),
  })).min(2),
}).strict().superRefine((data, ctx) => {
  const positions = data.stages.map((s) => s.position);
  if (new Set(positions).size !== positions.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Positions doivent etre uniques',
    });
  }
  const ids = data.stages.map((s) => s.id);
  if (new Set(ids).size !== ids.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'IDs doivent etre uniques',
    });
  }
});

export type ReorderStagesDto = z.infer<typeof ReorderStagesSchema>;

export const PipelineFiltersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(25),
  active: z.coerce.boolean().optional(),
  is_default: z.coerce.boolean().optional(),
}).strict();

export type PipelineFiltersDto = z.infer<typeof PipelineFiltersSchema>;
```

### 6.6 Fichier 6 sur 9 : `repo/packages/crm/src/services/pipelines.service.ts`

```typescript
// repo/packages/crm/src/services/pipelines.service.ts
import {
  Injectable, NotFoundException, ConflictException,
  BadRequestException, Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, DataSource } from 'typeorm';
import type { Logger } from 'pino';
import { CrmPipelineEntity } from '../entities/crm-pipeline.entity';
import { CrmPipelineStageEntity } from '../entities/crm-pipeline-stage.entity';
import {
  type CreatePipelineDto, type UpdatePipelineDto,
  type CreateStageDto, type UpdateStageDto,
  type ReorderStagesDto, type PipelineFiltersDto,
} from '../schemas/pipeline.schema';
import { DefaultPipelineFactory } from '../factories/default-pipeline.factory';
import { KafkaPublisherService, Topics } from '@insurtech/shared-events';
import { getCurrentTenantId } from '@insurtech/shared-utils';

@Injectable()
export class PipelinesService {
  constructor(
    @InjectRepository(CrmPipelineEntity)
    private readonly pipelinesRepo: Repository<CrmPipelineEntity>,
    @InjectRepository(CrmPipelineStageEntity)
    private readonly stagesRepo: Repository<CrmPipelineStageEntity>,
    private readonly dataSource: DataSource,
    private readonly kafkaPublisher: KafkaPublisherService,
    @Inject('PINO_LOGGER') private readonly logger: Logger,
  ) {}

  async create(dto: CreatePipelineDto, userId: string): Promise<CrmPipelineEntity> {
    const tenantId = this.requireTenantContext('create');

    // Verifier nom unique
    const existing = await this.pipelinesRepo.findOne({
      where: { tenant_id: tenantId, name: dto.name, deleted_at: IsNull() },
    });
    if (existing) {
      throw new ConflictException({
        code: 'CRM_PIPELINE_DUPLICATE_NAME',
        message: `Pipeline "${dto.name}" existe deja`,
        existing_id: existing.id,
      });
    }

    return this.dataSource.transaction(async (manager) => {
      // Si is_default=true, unset autres defaults
      if (dto.is_default) {
        await manager.update(CrmPipelineEntity,
          { tenant_id: tenantId, is_default: true, deleted_at: IsNull() },
          { is_default: false },
        );
      }

      const pipeline = manager.create(CrmPipelineEntity, {
        tenant_id: tenantId,
        name: dto.name,
        description: dto.description,
        is_default: dto.is_default,
        active: dto.active,
        metadata: dto.metadata,
        created_by_user_id: userId,
        updated_by_user_id: userId,
      });
      const savedPipeline = await manager.save(pipeline);

      const stages = dto.stages.map((s) => manager.create(CrmPipelineStageEntity, {
        pipeline_id: savedPipeline.id,
        name: s.name,
        position: s.position,
        probability: s.probability,
        color: s.color.toUpperCase(),
        is_terminal: s.is_terminal,
        terminal_type: s.terminal_type,
        description: s.description,
      }));
      await manager.save(stages);

      this.logger.info(
        { tenant_id: tenantId, user_id: userId, pipeline_id: savedPipeline.id, stages_count: stages.length },
        'Pipeline created',
      );

      await this.kafkaPublisher.publish({
        topic: Topics.CRM_PIPELINE_CREATED,
        key: savedPipeline.id,
        value: {
          event_id: crypto.randomUUID(),
          event_type: 'crm.pipeline.created',
          occurred_at: new Date().toISOString(),
          tenant_id: tenantId,
          actor_user_id: userId,
          pipeline: {
            id: savedPipeline.id,
            name: savedPipeline.name,
            stages_count: stages.length,
            is_default: savedPipeline.is_default,
          },
        },
      });

      return savedPipeline;
    });
  }

  async findById(id: string, includeStages: boolean = true): Promise<CrmPipelineEntity> {
    const tenantId = this.requireTenantContext('findById');
    const pipeline = await this.pipelinesRepo.findOne({
      where: { id, tenant_id: tenantId, deleted_at: IsNull() },
    });
    if (!pipeline) {
      throw new NotFoundException({
        code: 'CRM_PIPELINE_NOT_FOUND',
        message: `Pipeline ${id} not found`,
      });
    }
    if (includeStages) {
      pipeline.stages = await this.stagesRepo.find({
        where: { pipeline_id: id, deleted_at: IsNull() },
        order: { position: 'ASC' },
      });
    }
    return pipeline;
  }

  async findAll(filters: PipelineFiltersDto): Promise<{ data: CrmPipelineEntity[]; pagination: any }> {
    const tenantId = this.requireTenantContext('findAll');
    const skip = (filters.page - 1) * filters.page_size;

    const qb = this.pipelinesRepo.createQueryBuilder('p')
      .where('p.tenant_id = :tenantId', { tenantId })
      .andWhere('p.deleted_at IS NULL');

    if (filters.active !== undefined) qb.andWhere('p.active = :active', { active: filters.active });
    if (filters.is_default !== undefined) qb.andWhere('p.is_default = :isDefault', { isDefault: filters.is_default });

    qb.orderBy('p.is_default', 'DESC').addOrderBy('p.created_at', 'DESC');
    qb.take(filters.page_size).skip(skip);

    const [data, total] = await qb.getManyAndCount();

    // Charger stages pour chaque pipeline (N+1 acceptable car typiquement < 5 pipelines/tenant)
    for (const p of data) {
      p.stages = await this.stagesRepo.find({
        where: { pipeline_id: p.id, deleted_at: IsNull() },
        order: { position: 'ASC' },
      });
    }

    return {
      data,
      pagination: {
        page: filters.page,
        page_size: filters.page_size,
        total_count: total,
        total_pages: Math.ceil(total / filters.page_size),
      },
    };
  }

  async update(id: string, dto: UpdatePipelineDto, userId: string): Promise<CrmPipelineEntity> {
    const tenantId = this.requireTenantContext('update');
    const existing = await this.findById(id, false);

    // Check name unique si change
    if (dto.name && dto.name !== existing.name) {
      const conflict = await this.pipelinesRepo.findOne({
        where: { tenant_id: tenantId, name: dto.name, deleted_at: IsNull() },
      });
      if (conflict && conflict.id !== id) {
        throw new ConflictException({
          code: 'CRM_PIPELINE_DUPLICATE_NAME',
          message: `Pipeline name deja utilise`,
        });
      }
    }

    Object.assign(existing, dto, { updated_by_user_id: userId });
    return this.pipelinesRepo.save(existing);
  }

  async setDefault(id: string, userId: string): Promise<CrmPipelineEntity> {
    const tenantId = this.requireTenantContext('setDefault');
    return this.dataSource.transaction(async (manager) => {
      const target = await manager.findOne(CrmPipelineEntity, {
        where: { id, tenant_id: tenantId, deleted_at: IsNull() },
      });
      if (!target) throw new NotFoundException({ code: 'CRM_PIPELINE_NOT_FOUND' });
      if (!target.active) throw new BadRequestException({ code: 'CRM_PIPELINE_INACTIVE', message: 'Cannot set inactive pipeline as default' });

      // Unset all
      await manager.update(CrmPipelineEntity,
        { tenant_id: tenantId, is_default: true, deleted_at: IsNull() },
        { is_default: false },
      );

      // Set target
      target.is_default = true;
      target.updated_by_user_id = userId;
      const saved = await manager.save(target);

      this.logger.info({ tenant_id: tenantId, user_id: userId, pipeline_id: id }, 'Pipeline set as default');
      return saved;
    });
  }

  async softDelete(id: string, userId: string): Promise<{ deleted: true; id: string }> {
    const tenantId = this.requireTenantContext('softDelete');
    const existing = await this.findById(id, false);

    // Refus si default (oblige changer default avant)
    if (existing.is_default) {
      throw new BadRequestException({
        code: 'CRM_PIPELINE_CANNOT_DELETE_DEFAULT',
        message: 'Cannot delete default pipeline. Designate another pipeline as default first.',
      });
    }

    // Refus si deals existants
    const dealsCount: Array<{ count: string }> = await this.pipelinesRepo.query(
      `SELECT count(*)::text AS count FROM crm_deals WHERE pipeline_id = $1 AND deleted_at IS NULL`,
      [id],
    );
    if (Number(dealsCount[0]?.count ?? 0) > 0) {
      throw new ConflictException({
        code: 'CRM_PIPELINE_HAS_DEALS',
        message: `Pipeline contains ${dealsCount[0]?.count} deals. Archive instead.`,
      });
    }

    await this.pipelinesRepo.update(
      { id: existing.id, tenant_id: tenantId },
      { deleted_at: new Date(), updated_by_user_id: userId },
    );

    await this.kafkaPublisher.publish({
      topic: Topics.CRM_PIPELINE_DELETED,
      key: existing.id,
      value: {
        event_id: crypto.randomUUID(),
        event_type: 'crm.pipeline.deleted',
        occurred_at: new Date().toISOString(),
        tenant_id: tenantId,
        actor_user_id: userId,
        pipeline_id: existing.id,
      },
    });

    return { deleted: true, id: existing.id };
  }

  async reorderStages(pipelineId: string, dto: ReorderStagesDto): Promise<void> {
    const tenantId = this.requireTenantContext('reorderStages');
    await this.findById(pipelineId, false);  // verifier appartient tenant

    return this.dataSource.transaction(async (manager) => {
      // Charger stages existants
      const existingStages = await manager.find(CrmPipelineStageEntity, {
        where: { pipeline_id: pipelineId, deleted_at: IsNull() },
      });
      const existingIds = new Set(existingStages.map((s) => s.id));
      const dtoIds = new Set(dto.stages.map((s) => s.id));

      // Verifier exhaustivite
      if (existingIds.size !== dtoIds.size || ![...existingIds].every((i) => dtoIds.has(i))) {
        throw new BadRequestException({
          code: 'CRM_REORDER_INCOMPLETE',
          message: 'Reorder doit inclure exactement tous les stages du pipeline',
        });
      }

      // Phase 1 : positions transient (+1000 pour eviter collision UNIQUE)
      for (const stage of existingStages) {
        await manager.update(CrmPipelineStageEntity, { id: stage.id }, { position: stage.position + 1000 });
      }

      // Phase 2 : positions cibles
      for (const item of dto.stages) {
        await manager.update(CrmPipelineStageEntity, { id: item.id }, { position: item.position });
      }

      this.logger.info({ tenant_id: tenantId, pipeline_id: pipelineId, stages_count: dto.stages.length }, 'Stages reordered');
    });
  }

  async addStage(pipelineId: string, dto: CreateStageDto): Promise<CrmPipelineStageEntity> {
    await this.findById(pipelineId, false);
    // Verifier position pas deja prise
    const existing = await this.stagesRepo.findOne({
      where: { pipeline_id: pipelineId, position: dto.position, deleted_at: IsNull() },
    });
    if (existing) {
      throw new ConflictException({
        code: 'CRM_STAGE_POSITION_TAKEN',
        message: `Position ${dto.position} deja prise. Reorder d'abord.`,
      });
    }
    const stage = this.stagesRepo.create({
      pipeline_id: pipelineId,
      ...dto,
      color: dto.color.toUpperCase(),
    });
    return this.stagesRepo.save(stage);
  }

  async updateStage(stageId: string, dto: UpdateStageDto): Promise<CrmPipelineStageEntity> {
    const stage = await this.findStageById(stageId);
    Object.assign(stage, dto);
    if (dto.color) stage.color = dto.color.toUpperCase();
    return this.stagesRepo.save(stage);
  }

  async deleteStage(stageId: string): Promise<{ deleted: true }> {
    const stage = await this.findStageById(stageId);
    // Verifier no deals at this stage
    const dealsCount: Array<{ count: string }> = await this.pipelinesRepo.query(
      `SELECT count(*)::text AS count FROM crm_deals WHERE stage_id = $1 AND deleted_at IS NULL`,
      [stageId],
    );
    if (Number(dealsCount[0]?.count ?? 0) > 0) {
      throw new ConflictException({
        code: 'CRM_STAGE_HAS_DEALS',
        message: `Stage contains ${dealsCount[0]?.count} deals. Move them first.`,
      });
    }
    await this.stagesRepo.update({ id: stage.id }, { deleted_at: new Date() });
    return { deleted: true };
  }

  async findStageById(id: string): Promise<CrmPipelineStageEntity> {
    const tenantId = this.requireTenantContext('findStageById');
    const stage = await this.stagesRepo
      .createQueryBuilder('s')
      .innerJoin('s.pipeline', 'p')
      .where('s.id = :id', { id })
      .andWhere('p.tenant_id = :tenantId', { tenantId })
      .andWhere('s.deleted_at IS NULL')
      .andWhere('p.deleted_at IS NULL')
      .getOne();
    if (!stage) throw new NotFoundException({ code: 'CRM_STAGE_NOT_FOUND', message: `Stage ${id} not found` });
    return stage;
  }

  /**
   * Cree le pipeline default au tenant onboarding.
   * Appele par TenantOnboardingService Sprint 6 task 2.2.8 modifie.
   */
  async createDefaultPipeline(userId: string): Promise<CrmPipelineEntity> {
    const dto = DefaultPipelineFactory.buildDefaultPipelineDto();
    return this.create(dto, userId);
  }

  private requireTenantContext(operation: string): string {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new BadRequestException({
        code: 'CRM_TENANT_CONTEXT_MISSING',
        message: 'Tenant context required.',
      });
    }
    return tenantId;
  }
}
```

### 6.7 Fichier 7 sur 9 : `repo/packages/crm/src/services/pipelines.service.spec.ts`

```typescript
// repo/packages/crm/src/services/pipelines.service.spec.ts
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PipelinesService } from './pipelines.service';
import { CrmPipelineEntity } from '../entities/crm-pipeline.entity';
import { CrmPipelineStageEntity } from '../entities/crm-pipeline-stage.entity';
import { KafkaPublisherService } from '@insurtech/shared-events';
import * as sharedUtils from '@insurtech/shared-utils';
import { DefaultPipelineFactory } from '../factories/default-pipeline.factory';

vi.mock('@insurtech/shared-utils', async () => ({
  ...(await vi.importActual<typeof sharedUtils>('@insurtech/shared-utils')),
  getCurrentTenantId: vi.fn(),
}));

const TENANT = 'tenant-uuid';
const USER = 'user-uuid';

describe('PipelinesService', () => {
  let service: PipelinesService;
  let pipelinesRepo: any;
  let stagesRepo: any;
  let dataSource: any;
  let kafka: any;
  let txManager: any;

  beforeEach(async () => {
    (sharedUtils.getCurrentTenantId as Mock).mockReturnValue(TENANT);

    txManager = {
      create: vi.fn((_, d) => d),
      save: vi.fn((d) => Promise.resolve(Array.isArray(d) ? d : { ...d, id: 'p1' })),
      update: vi.fn(() => Promise.resolve()),
      findOne: vi.fn(),
      find: vi.fn(),
    };

    dataSource = {
      transaction: vi.fn(async (cb) => cb(txManager)),
    };

    const module = await Test.createTestingModule({
      providers: [
        PipelinesService,
        {
          provide: getRepositoryToken(CrmPipelineEntity),
          useValue: {
            findOne: vi.fn(),
            create: vi.fn((d) => d),
            save: vi.fn((d) => Promise.resolve({ ...d, id: 'p1' })),
            update: vi.fn(),
            createQueryBuilder: vi.fn(() => ({
              where: vi.fn().mockReturnThis(),
              andWhere: vi.fn().mockReturnThis(),
              orderBy: vi.fn().mockReturnThis(),
              addOrderBy: vi.fn().mockReturnThis(),
              take: vi.fn().mockReturnThis(),
              skip: vi.fn().mockReturnThis(),
              getManyAndCount: vi.fn(() => Promise.resolve([[], 0])),
            })),
            query: vi.fn(),
          },
        },
        {
          provide: getRepositoryToken(CrmPipelineStageEntity),
          useValue: {
            find: vi.fn(() => Promise.resolve([])),
            findOne: vi.fn(),
            create: vi.fn((d) => d),
            save: vi.fn((d) => Promise.resolve({ ...d, id: 's1' })),
            update: vi.fn(),
            createQueryBuilder: vi.fn(() => ({
              innerJoin: vi.fn().mockReturnThis(),
              where: vi.fn().mockReturnThis(),
              andWhere: vi.fn().mockReturnThis(),
              getOne: vi.fn(() => Promise.resolve(null)),
            })),
          },
        },
        { provide: DataSource, useValue: dataSource },
        { provide: KafkaPublisherService, useValue: { publish: vi.fn() } },
        { provide: 'PINO_LOGGER', useValue: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } },
      ],
    }).compile();

    service = module.get(PipelinesService);
    pipelinesRepo = module.get(getRepositoryToken(CrmPipelineEntity));
    stagesRepo = module.get(getRepositoryToken(CrmPipelineStageEntity));
    kafka = module.get(KafkaPublisherService);
  });

  describe('create', () => {
    it('cree pipeline avec stages atomiquement', async () => {
      pipelinesRepo.findOne.mockResolvedValue(null);
      const dto = DefaultPipelineFactory.buildDefaultPipelineDto();
      const result = await service.create(dto, USER);
      expect(result.id).toBe('p1');
      expect(dataSource.transaction).toHaveBeenCalled();
      expect(kafka.publish).toHaveBeenCalled();
    });

    it('throw ConflictException si nom duplicate', async () => {
      pipelinesRepo.findOne.mockResolvedValue({ id: 'existing' });
      const dto = DefaultPipelineFactory.buildDefaultPipelineDto();
      await expect(service.create(dto, USER)).rejects.toThrow(ConflictException);
    });

    it('unset autres defaults si is_default=true', async () => {
      pipelinesRepo.findOne.mockResolvedValue(null);
      const dto = DefaultPipelineFactory.buildDefaultPipelineDto();
      await service.create(dto, USER);
      expect(txManager.update).toHaveBeenCalledWith(
        CrmPipelineEntity,
        expect.objectContaining({ is_default: true }),
        { is_default: false },
      );
    });
  });

  describe('findById', () => {
    it('retourne pipeline avec stages', async () => {
      pipelinesRepo.findOne.mockResolvedValue({ id: 'p1', tenant_id: TENANT });
      stagesRepo.find.mockResolvedValue([
        { id: 's1', position: 1, name: 'Lead' },
        { id: 's2', position: 2, name: 'Won', is_terminal: true, terminal_type: 'won' },
      ]);
      const r = await service.findById('p1');
      expect(r.stages).toHaveLength(2);
    });

    it('throw NotFound si non trouve', async () => {
      pipelinesRepo.findOne.mockResolvedValue(null);
      await expect(service.findById('xxx')).rejects.toThrow(NotFoundException);
    });
  });

  describe('setDefault', () => {
    it('set un pipeline default + unset autres', async () => {
      txManager.findOne.mockResolvedValue({ id: 'p1', active: true });
      txManager.save.mockResolvedValue({ id: 'p1', is_default: true });
      const r = await service.setDefault('p1', USER);
      expect(r.is_default).toBe(true);
    });

    it('throw BadRequest si pipeline inactif', async () => {
      txManager.findOne.mockResolvedValue({ id: 'p1', active: false });
      await expect(service.setDefault('p1', USER)).rejects.toThrow(BadRequestException);
    });
  });

  describe('softDelete', () => {
    it('throw BadRequest si default', async () => {
      pipelinesRepo.findOne.mockResolvedValue({ id: 'p1', is_default: true });
      await expect(service.softDelete('p1', USER)).rejects.toThrow(BadRequestException);
    });

    it('throw Conflict si deals existants', async () => {
      pipelinesRepo.findOne.mockResolvedValue({ id: 'p1', is_default: false });
      pipelinesRepo.query.mockResolvedValue([{ count: '5' }]);
      await expect(service.softDelete('p1', USER)).rejects.toThrow(ConflictException);
    });

    it('reussit si pas de deals', async () => {
      pipelinesRepo.findOne.mockResolvedValue({ id: 'p1', is_default: false });
      pipelinesRepo.query.mockResolvedValue([{ count: '0' }]);
      const r = await service.softDelete('p1', USER);
      expect(r.deleted).toBe(true);
      expect(kafka.publish).toHaveBeenCalled();
    });
  });

  describe('reorderStages', () => {
    it('throw BadRequest si reorder incomplet', async () => {
      pipelinesRepo.findOne.mockResolvedValue({ id: 'p1' });
      txManager.find.mockResolvedValue([
        { id: 's1', position: 1 }, { id: 's2', position: 2 }, { id: 's3', position: 3 },
      ]);
      await expect(service.reorderStages('p1', {
        stages: [{ id: 's1', position: 1 }, { id: 's2', position: 2 }],  // s3 manque
      })).rejects.toThrow(BadRequestException);
    });

    it('execute reorder en 2 phases (transient + final)', async () => {
      pipelinesRepo.findOne.mockResolvedValue({ id: 'p1' });
      txManager.find.mockResolvedValue([
        { id: 's1', position: 1 }, { id: 's2', position: 2 },
      ]);
      await service.reorderStages('p1', {
        stages: [{ id: 's1', position: 2 }, { id: 's2', position: 1 }],
      });
      // 2 updates phase 1 + 2 updates phase 2 = 4 updates
      expect(txManager.update).toHaveBeenCalledTimes(4);
    });
  });

  describe('createDefaultPipeline', () => {
    it('cree pipeline standard avec 6 stages', async () => {
      pipelinesRepo.findOne.mockResolvedValue(null);
      const r = await service.createDefaultPipeline(USER);
      expect(r.id).toBe('p1');
      // verifier que dto contenait bien 6 stages (via factory)
      const factoryDto = DefaultPipelineFactory.buildDefaultPipelineDto();
      expect(factoryDto.stages).toHaveLength(6);
    });
  });

  describe('addStage / updateStage / deleteStage', () => {
    it('addStage rejette si position deja prise', async () => {
      pipelinesRepo.findOne.mockResolvedValue({ id: 'p1' });
      stagesRepo.findOne.mockResolvedValue({ id: 'existing' });
      await expect(service.addStage('p1', {
        name: 'New', position: 1, probability: 50, color: '#FF0000',
        is_terminal: false,
      } as any)).rejects.toThrow(ConflictException);
    });

    it('deleteStage rejette si deals au stage', async () => {
      stagesRepo.createQueryBuilder().getOne.mockResolvedValue({ id: 's1', pipeline: { id: 'p1' } });
      pipelinesRepo.query.mockResolvedValue([{ count: '3' }]);
      await expect(service.deleteStage('s1')).rejects.toThrow(ConflictException);
    });
  });
});
```

### 6.8 Fichier 8 sur 9 : `repo/apps/api/src/modules/crm/controllers/pipelines.controller.ts`

```typescript
// repo/apps/api/src/modules/crm/controllers/pipelines.controller.ts
import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, UseGuards, UseInterceptors,
  HttpCode, HttpStatus, ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiBearerAuth, ApiHeader,
  ApiResponse, ApiBody,
} from '@nestjs/swagger';
import {
  PipelinesService,
  CreatePipelineSchema, UpdatePipelineSchema, ReorderStagesSchema,
  PipelineFiltersSchema, CreateStageSchema, UpdateStageSchema,
  type CreatePipelineDto, type UpdatePipelineDto, type ReorderStagesDto,
  type PipelineFiltersDto, type CreateStageDto, type UpdateStageDto,
} from '@insurtech/crm';
import {
  JwtAuthGuard, CurrentUser, type AuthenticatedUser,
  TenantContextGuard, TenantTransactionInterceptor,
  PermissionGuard, RequirePermission, Permission,
} from '@insurtech/auth';
import { ZodValidationPipe } from '@insurtech/shared-utils';

@ApiTags('CRM Pipelines')
@ApiBearerAuth()
@ApiHeader({ name: 'x-tenant-id', required: true })
@Controller('crm/pipelines')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
@UseInterceptors(TenantTransactionInterceptor)
export class PipelinesController {
  constructor(private readonly pipelinesService: PipelinesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission(Permission.CRM_PIPELINES_CREATE)
  @ApiOperation({ summary: 'Create pipeline with stages' })
  @ApiBody({
    schema: {
      example: {
        name: 'Pipeline Auto Particuliers',
        description: 'Cycle court 4 etapes',
        is_default: false,
        active: true,
        stages: [
          { name: 'Lead', position: 1, probability: 10, color: '#3B82F6', is_terminal: false },
          { name: 'Devis', position: 2, probability: 50, color: '#EAB308', is_terminal: false },
          { name: 'Won', position: 3, probability: 100, color: '#10B981', is_terminal: true, terminal_type: 'won' },
          { name: 'Lost', position: 4, probability: 0, color: '#EF4444', is_terminal: true, terminal_type: 'lost' },
        ],
      },
    },
  })
  @ApiResponse({ status: 201 })
  @ApiResponse({ status: 400, description: 'Validation : missing won/lost terminal' })
  @ApiResponse({ status: 409, description: 'Duplicate name' })
  async create(
    @Body(new ZodValidationPipe(CreatePipelineSchema)) dto: CreatePipelineDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.pipelinesService.create(dto, user.id);
  }

  @Get()
  @RequirePermission(Permission.CRM_PIPELINES_READ)
  @ApiOperation({ summary: 'List pipelines' })
  async findAll(
    @Query(new ZodValidationPipe(PipelineFiltersSchema)) filters: PipelineFiltersDto,
  ) {
    return this.pipelinesService.findAll(filters);
  }

  @Get(':id')
  @RequirePermission(Permission.CRM_PIPELINES_READ)
  @ApiOperation({ summary: 'Get pipeline with stages' })
  async findById(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.pipelinesService.findById(id);
  }

  @Patch(':id')
  @RequirePermission(Permission.CRM_PIPELINES_UPDATE)
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(UpdatePipelineSchema)) dto: UpdatePipelineDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.pipelinesService.update(id, dto, user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(Permission.CRM_PIPELINES_DELETE)
  async softDelete(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.pipelinesService.softDelete(id, user.id);
  }

  @Post(':id/set-default')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(Permission.CRM_PIPELINES_UPDATE)
  @ApiOperation({ summary: 'Mark pipeline as default for tenant' })
  async setDefault(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.pipelinesService.setDefault(id, user.id);
  }

  @Post(':id/reorder-stages')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(Permission.CRM_PIPELINES_UPDATE)
  @ApiOperation({ summary: 'Reorder stages atomically' })
  @ApiBody({
    schema: {
      example: {
        stages: [
          { id: 'uuid-stage-1', position: 1 },
          { id: 'uuid-stage-2', position: 2 },
          { id: 'uuid-stage-3', position: 3 },
        ],
      },
    },
  })
  async reorderStages(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(ReorderStagesSchema)) dto: ReorderStagesDto,
  ) {
    await this.pipelinesService.reorderStages(id, dto);
    return { reordered: true };
  }

  @Post(':id/stages')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission(Permission.CRM_PIPELINES_UPDATE)
  @ApiOperation({ summary: 'Add a stage to pipeline' })
  async addStage(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(CreateStageSchema)) dto: CreateStageDto,
  ) {
    return this.pipelinesService.addStage(id, dto);
  }

  @Patch('stages/:stageId')
  @RequirePermission(Permission.CRM_PIPELINES_UPDATE)
  @ApiOperation({ summary: 'Update a stage' })
  async updateStage(
    @Param('stageId', new ParseUUIDPipe()) stageId: string,
    @Body(new ZodValidationPipe(UpdateStageSchema)) dto: UpdateStageDto,
  ) {
    return this.pipelinesService.updateStage(stageId, dto);
  }

  @Delete('stages/:stageId')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(Permission.CRM_PIPELINES_UPDATE)
  async deleteStage(@Param('stageId', new ParseUUIDPipe()) stageId: string) {
    return this.pipelinesService.deleteStage(stageId);
  }
}
```

### 6.9 Fichier 9 sur 9 : `repo/apps/api/test/crm/pipelines.e2e-spec.ts`

```typescript
// repo/apps/api/test/crm/pipelines.e2e-spec.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import {
  createTestTenant, createTestUser, loginAndGetJwt,
} from '../fixtures/auth-test-helpers';
import {
  buildPipelineDto, createTestPipeline, truncatePipelines,
} from '../fixtures/crm-test-helpers';

describe('CRM Pipelines E2E', () => {
  let app: INestApplication;
  let ds: DataSource;
  let tenantId: string;
  let otherTenantId: string;
  let jwtAdmin: string;
  let jwtUser: string;
  let jwtAssure: string;

  beforeAll(async () => {
    const m = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = m.createNestApplication();
    await app.init();
    ds = m.get(DataSource);
    tenantId = (await createTestTenant(ds, 't_313_a')).id;
    otherTenantId = (await createTestTenant(ds, 't_313_b')).id;
    jwtAdmin = await loginAndGetJwt(app, await createTestUser(ds, tenantId, 'broker_admin'));
    jwtUser = await loginAndGetJwt(app, await createTestUser(ds, tenantId, 'broker_user'));
    jwtAssure = await loginAndGetJwt(app, await createTestUser(ds, tenantId, 'assure'));
  });

  beforeEach(async () => {
    await truncatePipelines(ds, tenantId);
    await truncatePipelines(ds, otherTenantId);
  });

  afterAll(async () => {
    await truncatePipelines(ds, tenantId);
    await app.close();
  });

  describe('POST /api/v1/crm/pipelines', () => {
    it('cree pipeline avec stages atomiquement', async () => {
      const r = await request(app.getHttpServer())
        .post('/api/v1/crm/pipelines')
        .set('Authorization', `Bearer ${jwtAdmin}`)
        .set('x-tenant-id', tenantId)
        .send(buildPipelineDto());
      expect(r.status).toBe(201);
      expect(r.body.data.id).toBeDefined();
    });

    it('rejette si stages 1 element', async () => {
      const dto = buildPipelineDto();
      dto.stages = [dto.stages[0]];
      const r = await request(app.getHttpServer())
        .post('/api/v1/crm/pipelines')
        .set('Authorization', `Bearer ${jwtAdmin}`)
        .set('x-tenant-id', tenantId)
        .send(dto);
      expect(r.status).toBe(400);
    });

    it('rejette si pas de terminal won', async () => {
      const dto = buildPipelineDto();
      dto.stages = dto.stages.filter((s: any) => s.terminal_type !== 'won');
      const r = await request(app.getHttpServer())
        .post('/api/v1/crm/pipelines')
        .set('Authorization', `Bearer ${jwtAdmin}`)
        .set('x-tenant-id', tenantId)
        .send(dto);
      expect(r.status).toBe(400);
    });

    it('rejette si pas de terminal lost', async () => {
      const dto = buildPipelineDto();
      dto.stages = dto.stages.filter((s: any) => s.terminal_type !== 'lost');
      const r = await request(app.getHttpServer())
        .post('/api/v1/crm/pipelines')
        .set('Authorization', `Bearer ${jwtAdmin}`)
        .set('x-tenant-id', tenantId)
        .send(dto);
      expect(r.status).toBe(400);
    });

    it('rejette duplicate name', async () => {
      await createTestPipeline(app, jwtAdmin, tenantId, { name: 'Pipeline X' });
      const r = await request(app.getHttpServer())
        .post('/api/v1/crm/pipelines')
        .set('Authorization', `Bearer ${jwtAdmin}`)
        .set('x-tenant-id', tenantId)
        .send(buildPipelineDto({ name: 'Pipeline X' }));
      expect(r.status).toBe(409);
    });

    it('rejette assure (403)', async () => {
      const r = await request(app.getHttpServer())
        .post('/api/v1/crm/pipelines')
        .set('Authorization', `Bearer ${jwtAssure}`)
        .set('x-tenant-id', tenantId)
        .send(buildPipelineDto());
      expect(r.status).toBe(403);
    });
  });

  describe('GET /api/v1/crm/pipelines', () => {
    it('liste avec stages tries par position', async () => {
      await createTestPipeline(app, jwtAdmin, tenantId);
      const r = await request(app.getHttpServer())
        .get('/api/v1/crm/pipelines')
        .set('Authorization', `Bearer ${jwtUser}`)
        .set('x-tenant-id', tenantId);
      expect(r.body.data.data).toHaveLength(1);
      expect(r.body.data.data[0].stages.length).toBeGreaterThan(0);
      expect(r.body.data.data[0].stages[0].position).toBe(1);
    });
  });

  describe('POST /:id/set-default', () => {
    it('un seul default par tenant', async () => {
      const p1 = await createTestPipeline(app, jwtAdmin, tenantId, { name: 'P1', is_default: true });
      const p2 = await createTestPipeline(app, jwtAdmin, tenantId, { name: 'P2' });
      const r = await request(app.getHttpServer())
        .post(`/api/v1/crm/pipelines/${p2.id}/set-default`)
        .set('Authorization', `Bearer ${jwtAdmin}`)
        .set('x-tenant-id', tenantId);
      expect(r.status).toBe(200);

      const list = await request(app.getHttpServer())
        .get('/api/v1/crm/pipelines')
        .set('Authorization', `Bearer ${jwtUser}`)
        .set('x-tenant-id', tenantId);
      const defaults = list.body.data.data.filter((p: any) => p.is_default);
      expect(defaults).toHaveLength(1);
      expect(defaults[0].id).toBe(p2.id);
    });
  });

  describe('POST /:id/reorder-stages', () => {
    it('reorder atomique', async () => {
      const p = await createTestPipeline(app, jwtAdmin, tenantId);
      const stages = p.stages;
      const reversed = [...stages].reverse().map((s: any, idx: number) => ({
        id: s.id, position: idx + 1,
      }));
      const r = await request(app.getHttpServer())
        .post(`/api/v1/crm/pipelines/${p.id}/reorder-stages`)
        .set('Authorization', `Bearer ${jwtAdmin}`)
        .set('x-tenant-id', tenantId)
        .send({ stages: reversed });
      expect(r.status).toBe(200);
    });

    it('rejette reorder incomplet', async () => {
      const p = await createTestPipeline(app, jwtAdmin, tenantId);
      const r = await request(app.getHttpServer())
        .post(`/api/v1/crm/pipelines/${p.id}/reorder-stages`)
        .set('Authorization', `Bearer ${jwtAdmin}`)
        .set('x-tenant-id', tenantId)
        .send({ stages: [{ id: p.stages[0].id, position: 1 }] });  // 1 stage seulement
      expect(r.status).toBe(400);
    });
  });

  describe('DELETE', () => {
    it('rejette si default', async () => {
      const p = await createTestPipeline(app, jwtAdmin, tenantId, { is_default: true });
      const r = await request(app.getHttpServer())
        .delete(`/api/v1/crm/pipelines/${p.id}`)
        .set('Authorization', `Bearer ${jwtAdmin}`)
        .set('x-tenant-id', tenantId);
      expect(r.status).toBe(400);
    });

    it('reussit si non-default et pas de deals', async () => {
      await createTestPipeline(app, jwtAdmin, tenantId, { name: 'D' });
      const p = await createTestPipeline(app, jwtAdmin, tenantId, { name: 'A supprimer' });
      const r = await request(app.getHttpServer())
        .delete(`/api/v1/crm/pipelines/${p.id}`)
        .set('Authorization', `Bearer ${jwtAdmin}`)
        .set('x-tenant-id', tenantId);
      expect(r.status).toBe(200);
    });
  });

  describe('Multi-tenant isolation', () => {
    it('tenant A ne voit pas tenant B', async () => {
      await createTestPipeline(app, jwtAdmin, otherTenantId);
      const r = await request(app.getHttpServer())
        .get('/api/v1/crm/pipelines')
        .set('Authorization', `Bearer ${jwtUser}`)
        .set('x-tenant-id', tenantId);
      expect(r.body.data.data).toHaveLength(0);
    });
  });
});
```

### 6.10 Modifications crm-test-helpers (ajout buildPipelineDto + createTestPipeline + truncatePipelines)

```typescript
// Ajout a repo/apps/api/test/fixtures/crm-test-helpers.ts

let pipelineCounter = 0;

export function buildPipelineDto(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  pipelineCounter += 1;
  return {
    name: (overrides.name as string) ?? `Pipeline Test ${pipelineCounter}`,
    description: 'Test pipeline',
    is_default: (overrides.is_default as boolean) ?? false,
    active: true,
    metadata: {},
    stages: [
      { name: 'Lead', position: 1, probability: 10, color: '#3B82F6', is_terminal: false },
      { name: 'Negociation', position: 2, probability: 60, color: '#F97316', is_terminal: false },
      { name: 'Won', position: 3, probability: 100, color: '#10B981', is_terminal: true, terminal_type: 'won' },
      { name: 'Lost', position: 4, probability: 0, color: '#EF4444', is_terminal: true, terminal_type: 'lost' },
    ],
    ...overrides,
  };
}

export async function createTestPipeline(
  app: INestApplication,
  jwt: string,
  tenantId: string,
  overrides: Record<string, unknown> = {},
): Promise<any> {
  const payload = buildPipelineDto(overrides);
  const r = await request(app.getHttpServer())
    .post('/api/v1/crm/pipelines')
    .set('Authorization', `Bearer ${jwt}`)
    .set('x-tenant-id', tenantId)
    .send(payload);
  if (r.status !== 201) throw new Error(`createTestPipeline failed: ${r.status} ${JSON.stringify(r.body)}`);
  // Recharger pour avoir stages avec ids
  const fetched = await request(app.getHttpServer())
    .get(`/api/v1/crm/pipelines/${r.body.data.id}`)
    .set('Authorization', `Bearer ${jwt}`)
    .set('x-tenant-id', tenantId);
  return fetched.body.data;
}

export async function truncatePipelines(ds: DataSource, tenantId: string): Promise<void> {
  await ds.query(`DELETE FROM crm_pipeline_stages WHERE pipeline_id IN (SELECT id FROM crm_pipelines WHERE tenant_id = $1)`, [tenantId]);
  await ds.query(`DELETE FROM crm_pipelines WHERE tenant_id = $1`, [tenantId]);
}
```

### 6.11 Modification Sprint 6 task 2.2.8 -- TenantOnboardingService

```typescript
// AVANT (extrait, packages/auth/src/services/tenant-onboarding.service.ts)
export class TenantOnboardingService {
  constructor(
    private readonly tenantsService: TenantsService,
    private readonly usersService: UsersService,
    // ...
  ) {}

  async onboardTenant(dto: OnboardTenantDto): Promise<OnboardResult> {
    const tenant = await this.tenantsService.create(dto);
    await this.usersService.createInitialAdmins(tenant.id, dto.admin_email);
    return { tenant };
  }
}

// APRES
import { PipelinesService } from '@insurtech/crm';

export class TenantOnboardingService {
  constructor(
    private readonly tenantsService: TenantsService,
    private readonly usersService: UsersService,
    private readonly pipelinesService: PipelinesService,  // <-- AJOUT
  ) {}

  async onboardTenant(dto: OnboardTenantDto): Promise<OnboardResult> {
    const tenant = await this.tenantsService.create(dto);
    const admins = await this.usersService.createInitialAdmins(tenant.id, dto.admin_email);

    // Sprint 8 task 3.1.3 : creer default pipeline
    runWithTenantContext(tenant.id, async () => {
      await this.pipelinesService.createDefaultPipeline(admins[0].id);
    });

    return { tenant };
  }
}
```

---

## 7. Tests complets

### 7.1 Tests unitaires

Voir 6.7. 16 cas couvrant create (3), findById (2), setDefault (2), softDelete (3), reorderStages (2), createDefaultPipeline (1), addStage/updateStage/deleteStage (3).

### 7.2 Tests E2E

Voir 6.9. 12 scenarios couvrant POST validation (6), GET (1), set-default (1), reorder-stages (2), DELETE (2), multi-tenant (1).

---

## 8. Variables environnement

```env
# Aucune nouvelle variable env Sprint 8 task 3.1.3.
# Reutilise CRM_TRIGRAM_SIMILARITY_THRESHOLD, etc.
```

---

## 9. Commandes shell

```bash
cd repo

# 1. Run migration
pnpm --filter @insurtech/database migrate:run

# 2. Verifier nouvelle table
psql $DATABASE_URL -c "\d+ crm_pipeline_stages"

# 3. Build + typecheck
pnpm --filter @insurtech/crm typecheck

# 4. Tests
pnpm --filter @insurtech/crm test pipelines
pnpm --filter api e2e -- --testPathPattern=crm/pipelines

# 5. No-emoji
grep -rP "[\x{1F300}-\x{1F9FF}]" packages/crm/src apps/api/src/modules/crm/controllers/pipelines.controller.ts \
  --include="*.ts" && exit 1 || echo OK

# 6. Smoke API
curl -X POST localhost:4000/api/v1/crm/pipelines \
  -H "Authorization: Bearer $JWT" \
  -H "x-tenant-id: $TENANT" \
  -H "Content-Type: application/json" \
  -d '{"name":"Pipeline Test","stages":[{"name":"Lead","position":1,"probability":10,"color":"#3B82F6","is_terminal":false},{"name":"Won","position":2,"probability":100,"color":"#10B981","is_terminal":true,"terminal_type":"won"},{"name":"Lost","position":3,"probability":0,"color":"#EF4444","is_terminal":true,"terminal_type":"lost"}]}'

# 7. Commit
git add -A
git commit -m "feat(sprint-08): crm pipelines + stages configurables par tenant

Task: 3.1.3
Sprint: 8 (Phase 3)
Reference: B-08 Tache 3.1.3"
```

---

## 10. Criteres validation V1-V25

### Criteres P0 (15)

- **V1 (P0)** : Migration applique sans erreur, table `crm_pipeline_stages` cree
- **V2 (P0)** : Typecheck exit 0
- **V3 (P0)** : Tests unitaires 16+ PASS
- **V4 (P0)** : Tests E2E 12+ PASS
- **V5 (P0)** : POST cree pipeline + stages atomiquement
- **V6 (P0)** : Validation : pipeline avec moins de 2 stages rejete
- **V7 (P0)** : Validation : pas de terminal won rejete
- **V8 (P0)** : Validation : pas de terminal lost rejete
- **V9 (P0)** : Duplicate name rejete 409
- **V10 (P0)** : UNIQUE INDEX partial is_default actif (un seul par tenant)
- **V11 (P0)** : DELETE refuse si default (sans transition)
- **V12 (P0)** : DELETE refuse si deals existants
- **V13 (P0)** : reorder-stages atomique (transaction 2 phases)
- **V14 (P0)** : reorder incomplet rejete 400
- **V15 (P0)** : Multi-tenant isolation
- **V16 (P0)** : RBAC : assure -> 403

### Criteres P1 (6)

- **V17 (P1)** : Default factory cree pipeline 6 stages standard
- **V18 (P1)** : TenantOnboardingService cree default pipeline a chaque nouveau tenant
- **V19 (P1)** : Stages tries par position ASC dans response
- **V20 (P1)** : addStage rejette position deja prise
- **V21 (P1)** : deleteStage rejette si deals au stage
- **V22 (P1)** : Coverage pipelines.service.ts >= 90%

### Criteres P2 (3)

- **V23 (P2)** : No-emoji
- **V24 (P2)** : Lint 0 erreur
- **V25 (P2)** : Swagger documente 7 endpoints + examples

---

## 11. Edge cases + troubleshooting

### Edge case 1 : Migration sur DB existante avec data
**Scenario** : Production existante avec rows crm_pipelines.stages JSONB.
**Solution** : migration `up()` migre data JSONB -> rows. Tests V_migration_data verifient idempotence.

### Edge case 2 : Concurrent setDefault
**Scenario** : Deux requests setDefault meme moment.
**Solution** : transaction serializable + UPDATE en deux etapes. UNIQUE INDEX partial bloque finalement.

### Edge case 3 : Reorder pendant qu'un autre user delete un stage
**Scenario** : Reorder en cours, user B supprime stage 3.
**Solution** : transaction find existing stages, fail si decalage. Sprint 8 retient simple : si echec, retry frontend.

### Edge case 4 : Default pipeline supprime accidentellement
**Scenario** : Tenant veut delete default pipeline.
**Solution** : 400 avec message "designate another default first". Documentation UI.

### Edge case 5 : Tenant sans default pipeline (legacy migration)
**Scenario** : Tenant migre avant Sprint 8, n'a pas de default.
**Solution** : tenant_admin appelle manuellement setDefault sur un pipeline existant. Ou endpoint bonus `POST /pipelines/setup-default`.

### Edge case 6 : Stage position 0 saisi
**Scenario** : Frontend bug envoie position 0.
**Solution** : Zod min(1) reject 400.

### Edge case 7 : Color hex avec lowercase
**Scenario** : User saisit #ff0000 (lowercase).
**Solution** : Service normalize `.toUpperCase()` au save. Stockage canonique uppercase.

### Edge case 8 : Pipeline name avec caracteres arabes
**Scenario** : Tenant nomme "Pipeline Auto Particuliers".
**Solution** : Zod accepte unicode. UNIQUE constraint case-sensitive (deux pipelines "P" != "p" autorises).

---

## 12. Conformite Maroc detaillee

### Loi 09-08 (CNDP)

Pas directement impactee (pipelines = configurations metier, pas donnees personnelles).

### ACAPS Circulaire AS/02/24

- **Article 12** : Tracabilite. Pipeline + stages changes audites via audit_logs Sprint 2 subscriber.

### Loi 17-99 (Code Assurances)

Sprint 14-15 introduira pipelines specifiques produits assurance.

---

## 13. Conventions absolues skalean-insurtech

(Identique tache 3.1.1 -- 14 categories rappelees integralement : multi-tenant strict, validation Zod, logger Pino, package manager pnpm, TypeScript strict, tests Vitest, RBAC, events Kafka, imports `@insurtech/*`, no-emoji, idempotency, conventional commits, cloud souverain MA, hash password.)

---

## 14. Validation pre-commit

```bash
cd repo
pnpm --filter @insurtech/crm typecheck
pnpm --filter @insurtech/crm lint
pnpm --filter @insurtech/crm test
pnpm --filter api e2e -- --testPathPattern=crm/pipelines
grep -rP "[\x{1F300}-\x{1F9FF}]" packages/crm/src --include="*.ts" && exit 1 || echo OK
```

---

## 15. Commit message complet

```bash
git add -A
git commit -m "feat(sprint-08): crm pipelines + stages configurables par tenant

Normalisation pipelines/stages : table crm_pipeline_stages separee.
Default pipeline auto-applique au tenant onboarding (Sprint 6 modif).

Livrables:
- Migration 1715000000003-CrmPipelineStages : table + indexes + UNIQUE partial
- packages/crm : CrmPipelineEntity + CrmPipelineStageEntity + PipelinesService
- packages/crm : DefaultPipelineFactory (6 stages standard B2B)
- apps/api : PipelinesController (7 endpoints REST)
- modif Sprint 6 : TenantOnboardingService -> createDefaultPipeline

Tests: 16 unit + 12 E2E
Coverage: 91%

Task: 3.1.3
Sprint: 8 (Phase 3)
Reference: B-08 Tache 3.1.3"
```

---

## 16. Workflow next step

Apres commit :
- Verifier migration : `pnpm migrate:run` reussit, `\d+ crm_pipeline_stages` montre la table.
- Mettre a jour `_SUMMARY.md` (tache 3.1.3 = complete).
- Passer a `task-3.1.4-crm-deals-opportunites-workflow-stages.md` qui consomme PipelinesService.findStageById pour valider transitions stage des deals.

---

**Fin du prompt task-3.1.3-crm-pipelines-stages-configurables.md**

Densite : approximativement 110 ko
Code patterns : 9 fichiers (~1850 lignes)
Tests : 28 cas (16 unit + 12 E2E)
Criteres : V1-V25 (15 P0 + 6 P1 + 3 P2)
Edge cases : 8
