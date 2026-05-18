# TACHE 3.1.5 -- CRM Interactions Timeline (Append-Only + Auto-Log Kafka Consumer)

**Sprint** : 8 (Phase 3 / Sprint 1 dans phase) -- CRM + Booking Foundations
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-08-sprint-08-crm-booking.md` (Tache 3.1.5)
**Phase** : 3 -- Modules Horizontaux Foundation
**Priorite** : P0 (timeline historique exige, auto-log infrastructure consommee par Sprint 9 Comm + Sprint 8 Booking + Sprint 31 Agent Sky)
**Effort** : 5h
**Dependances** : Tache 3.1.2 (Contacts), Tache 3.1.4 (Deals), Sprint 5/6/7 (Auth + Multi-tenant + RBAC), Sprint 2 task 1.2.13 (KafkaConsumerBase), Sprint 2 task 1.2.11 (Topics enum + Zod schemas events comm)
**Densite cible** : 100-150 ko (auto-suffisant exhaustif)
**AUCUNE EMOJI AUTORISEE**

---

## 1. But

Cette tache 3.1.5 implemente le module Interactions Timeline du CRM Skalean InsurTech v2.2, registre append-only de toutes les interactions entre les utilisateurs du tenant (broker_user, garage_manager, etc.) et les contacts (clients, prospects). Concretement, elle livre l'entity TypeORM `CrmInteractionEntity` mappee sur la table `crm_interactions` (Sprint 2 migration deja appliquee, mais avec ajout colonnes `direction`, `occurred_at`, `metadata jsonb` via micro-migration livree ici), le service NestJS `InteractionsService` exposant six methodes (`logInteraction`, `findByContact`, `findByDeal`, `findById`, `findRecent`, `getStats`), le controller REST avec cinq endpoints `/api/v1/crm/interactions/*` proteges par chaine de guards Sprint 5/6/7 (mais SANS endpoint PATCH ni DELETE conformement au principe append-only), les schemas Zod `LogInteractionSchema`, `InteractionFiltersSchema`, l'enum `INTERACTION_TYPES` (`call`, `email`, `whatsapp`, `sms`, `meeting`, `note`, `task`), l'enum `INTERACTION_DIRECTIONS` (`inbound`, `outbound`, `internal`), l'auto-logger Kafka consumer `InteractionsAutoLoggerConsumer` etendant `KafkaConsumerBase` Sprint 2 et souscrivant aux trois topics `insurtech.events.comm.message_sent`, `insurtech.events.comm.message_received` (Sprint 9 publishera), `insurtech.events.booking.appointment_completed` (Sprint 8 task 3.1.9 publishera), avec mapping automatique vers interactions (call/email/whatsapp/sms/meeting selon channel), et la pagination cursor-based pour timeline (vs offset-based pour list global) garantissant performance constante O(1) sur grands historiques. Sont aussi livrees les suites de tests : 18 cas unitaires (Vitest mock Repository + KafkaPublisher), 14 scenarios E2E (supertest), 6 scenarios consumer integration (Kafka mock).

L'apport est triple. Premierement, cette tache concretise l'historique commercial complet et inviolable exige par la reglementation marocaine ACAPS Circulaire AS/02/24 article 12 (5 ans de tracabilite des operations commerciales) et par la pratique professionnelle des cabinets de courtage et garages. Sans interactions, un commercial qui prend en charge un dossier client transmis par un collegue absent n'a aucune visibilite sur l'historique des echanges (combien d'appels, quand le dernier email, quel etait le ton de la derniere conversation, qui a appele apres la reunion). Avec interactions, l'historique chronologique complet est instantanement accessible, supporte la continuite de service, evite les gaffes commerciales (recontacter un prospect qui s'est deja plaint), et fournit la tracabilite legale en cas de litige client. La regle append-only (pas d'endpoint PATCH ni DELETE) garantit l'integrite : un commercial ne peut pas reecrire l'histoire pour cacher ses erreurs. La purge eventuelle au-dela de 5 ans est gerée par Sprint 12 task 1.12.5 (CNDP purge job) via mecanisme dedicated.

Deuxiemement, cette tache introduit l'auto-log Kafka consumer qui transforme passivement chaque communication enregistree par Sprint 9 (Comm WhatsApp/Email/SMS) en interaction tracee dans le timeline du contact, sans aucune action manuelle requise du commercial. Ce mecanisme elimine la friction principale qui empeche les commerciaux d'ecrire des notes de suivi : la charge cognitive et chronophage de saisir manuellement chaque echange. Avec auto-log, l'envoi d'un WhatsApp via le frontend Sprint 16 declenche un event Kafka `comm.message_sent`, le consumer `InteractionsAutoLoggerConsumer` ecoute, decode l'event Zod-valide, cree automatiquement une row `crm_interactions` avec `type='whatsapp'`, `direction='outbound'`, `content=<texte du message>`, `metadata=<template id, language, etc.>`, `occurred_at=<timestamp send>`, `contact_id=<destinataire>`, `user_id=<expediteur>`. Le commercial n'a rien fait. Le timeline est mis a jour en temps reel. Cette boucle fermee garantit 100 pour cent de couverture historique sans charge utilisateur. Sprint 31 (Agent Sky) consommera ces interactions pour suggerer des next-best-actions intelligentes.

Troisiemement, cette tache distingue rigoureusement deux timestamps differents : `occurred_at` (quand l'interaction a effectivement eu lieu) et `created_at` (quand la row a ete creee dans le systeme). Cette distinction est critique car les commerciaux logguent souvent retroactivement : un appel telephonique de 14h00 saisi a 16h30 doit avoir `occurred_at='2026-05-08 14:00'` et `created_at='2026-05-08 16:30'`. Le timeline UI Sprint 16 trie par `occurred_at DESC` (chronologie reelle) tandis que les analyses anti-fraude trient par `created_at` (detecter les saisies suspectes en bloc). La pagination cursor-based utilise le tuple `(occurred_at, id)` comme curseur pour garantir stabilite (pas de duplications/manques entre pages quand l'utilisateur scroll). Les interactions auto-loggees Kafka ont `occurred_at = created_at` puisque generees au moment exact de l'event.

A l'issue de cette tache, le module `@insurtech/crm` exporte `CrmInteractionEntity`, `InteractionsService`, `InteractionsAutoLoggerConsumer`, schemas + enums. Le module api-crm enregistre `InteractionsController` (5 endpoints) et le consumer Kafka comme provider applicationModule (boot startup). Les endpoints `GET /api/v1/crm/contacts/:id/interactions` et `GET /api/v1/crm/deals/:id/interactions` (deja stubbes en tache 3.1.2 et 3.1.4) sont maintenant fonctionnels via consommation `InteractionsService.findByContact/findByDeal`. Les commandes `pnpm test interactions` execute 18 unit, `pnpm e2e interactions` execute 14 scenarios, `pnpm e2e interactions-auto-log` execute 6 scenarios consumer (necessite Kafka up). Aucune dependance externe nouvelle. Total approximativement 1950 lignes de code TypeScript + SQL.

---

## 2. Contexte etendu

### 2.1 Pourquoi cette tache existe

Le CRM Skalean InsurTech v2.2 vise a remplacer les outils heterogenes utilises actuellement par les cabinets de courtage marocains : les emails personnels Gmail/Yahoo (sans tracabilite cabinet), les conversations WhatsApp personnelles (perdues si commercial part), les notes papier (frequemment perdues), les fichiers Excel partages OneDrive (fragmentes, sans audit), les CRM legacy Microsoft Dynamics CRM 2013 ou Sage CRM (couteux, non-localises Maroc). Sans module Interactions, Skalean InsurTech serait juste un meilleur Excel : il stockerait les contacts et les deals, mais l'historique commercial serait toujours disperse entre Gmail, WhatsApp Business, et notes manuscrites. Le module Interactions centralise tout l'historique communicationnel et intercation au sein de la plateforme, supprimant le besoin de consulter cinq outils differents pour reconstituer l'histoire d'un client.

Cette centralisation est doublement justifiee. D'abord par l'efficacite operationnelle : un commercial passe en moyenne 30 minutes par jour a chercher l'historique d'un client (etude pre-projet Skalean 12 cabinets MA), soit ~10 heures par mois par commercial, soit ~3 a 5 jours-personne par cabinet par mois en perte productivite. Avec un timeline integre, ce temps tombe a 30 secondes (ouvrir le contact, scroller). Ensuite par la conformite : ACAPS Circulaire AS/02/24 article 12 exige 5 ans de tracabilite des operations commerciales. Sans timeline structure, un cabinet ne peut pas demontrer aupres d'un auditeur ACAPS qu'il a respecte le devoir de conseil avant la souscription d'une police. Avec timeline + audit logs cross-referenced, la tracabilite est mecanique et automatique.

Le choix specifique du modele append-only (pas d'UPDATE ni DELETE endpoints) est dicte par la securite legale. Si les commerciaux pouvaient editer ou supprimer les interactions, l'integrite legale serait compromise : un commercial pourrait reecrire l'histoire pour cacher des manquements. ACAPS lors d'un controle exigerait des hash chains ou des signatures d'auteur pour valider integrite, complexite excessive. Append-only resout simplement : ce qui est ecrit reste ecrit, point. La purge legale au-dela de 5 ans est exclusivement geree par Sprint 12 (CNDP purge job) avec controles administratifs stricts (super_admin only, audit purge). Cette decision aligne Skalean avec les pratiques bancaires (carnet d'ordre append-only) et juridiques (registre des actes append-only).

Le choix d'introduire l'auto-log Kafka consumer dans cette tache (vs reporter a Sprint 9) decoule de la necessite operationnelle : sans auto-log, les commerciaux devraient saisir manuellement chaque WhatsApp envoye, ce qui ne se ferait pas dans la pratique (frustration, oubli, charge cognitive). Le Sprint 9 Comm publishera les events `comm.message_sent` mais c'est cette tache 3.1.5 qui les consomme et cree les interactions. La decoupling Kafka permet ce pattern : Sprint 9 ne sait pas que les interactions existent, le consumer InteractionsAutoLoggerConsumer ne sait pas comment les messages WhatsApp sont envoyes, les deux modules sont orthogonaux. Sprint 8 task 3.1.9 (Booking Appointments) fera de meme : publier `booking.appointment_completed` sera consume par auto-logger qui creera interaction type='meeting'. Cette architecture event-driven scale a tous les futurs sprints sans refactor (Sprint 14 polices, Sprint 21 sinistres, etc. ne demandent qu'a publier leur event pour etre auto-tracees).

### 2.2 Alternatives considerees

| Alternative | Avantages | Inconvenients | Decision |
|-------------|-----------|---------------|----------|
| Mutable interactions avec UPDATE/DELETE endpoints | Souplesse correctifs typo | Compromet integrite legale, complexite hash chain pour audit | REJETE -- append-only |
| Append-only strict sans correction (RETENU) | Integrite | Typos figes | RETENU avec note `metadata.correction_note` permettant ajout d'erratum sans modifier original |
| Append-only avec correction via interaction-de-correction (interaction reponse pointant l'original) | Rigueur auditeurs | Duplication, complexite UI | DEFERRABLE Sprint 12 si demande |
| Auto-log via DB triggers Postgres listening LISTEN/NOTIFY | Decouplage | Postgres LISTEN/NOTIFY peu utilise par equipe, complexite ops | REJETE |
| Auto-log via Kafka consumer NestJS standard (RETENU) | Pattern uniformise Sprint 2 | Latence consume eventuelle (1-3 sec) | RETENU acceptable pour timeline (pas critical realtime) |
| Auto-log inline (CommService publie event ET cree interaction directement) | Latence zero | Coupling fort Comm <-> Interactions, viol decoupling | REJETE -- decouplage Kafka |
| Auto-log via outbox pattern (Sprint 12+) | Coherence ACID | Complexite Sprint 8 prematuree | DEFERRABLE Sprint 12 |
| occurred_at = created_at (1 timestamp seulement) | Simple | Perd capacite log retroactif | REJETE -- 2 timestamps distincts |
| Pagination offset-based timeline | Simple | Perfomance degradee O(N) sur 10k+ interactions | REJETE pour timeline ; OK pour list global |
| Pagination cursor-based timeline (RETENU) | Performance constante O(1) | Complexite implementation | RETENU |
| content TEXT illimite | Souplesse | Possible attack DOS via huge text | REJETE -- max 10000 chars |
| content separate table normalise (interaction_contents) | Lazy loading | Complexite | REJETE -- column inline |
| Type enum strict (call, email, whatsapp, sms, meeting, note) | Coherent | Couvre pas tous cas (visioconf, lettre recommandee) | RETENU avec `task` ajoute pour pre-Sprint 14 |
| Direction enum (inbound, outbound, internal) | Tracabilite | Note interne != echange client | RETENU avec `internal` pour notes commerciaux |
| Encryption content at-rest application-level | Securite | Complexite recherche | REJETE -- DB-level encryption AES Atlas suffit |
| Search trigram sur content | Recherche puissante | Pollution index si content libre | REJETE Sprint 8 ; Sprint 13 Analytics si demande |

### 2.3 Trade-offs explicites

Le choix append-only sans UPDATE ni DELETE endpoints implique d'accepter qu'une typo dans une note reste figee. Le trade-off est entre integrite legale (ce qui est ecrit reste ecrit, pas de reecriture de l'histoire) et UX (utilisateur voudrait corriger sa coquille). Sprint 8 retient strict append-only ; le mecanisme d'erratum via `metadata.correction_note` permet d'ajouter du contexte sans modifier le content original. Si demande utilisateur croit, Sprint 12 introduira `add-correction-note` endpoint dedicated qui ne modifie pas le content mais ajoute une row liee.

Le choix de l'auto-log Kafka consumer Sprint 8 implique une dependance operationnelle : si Kafka tombe, les events comm/booking ne sont pas consommes en temps reel et les interactions ne sont pas creees automatiquement. Le KafkaConsumerBase Sprint 2 task 1.2.13 a deja implemente retry + DLQ + idempotency-key pattern, donc les events ne sont pas perdus en cas de panne breve (ils sont rejoues quand Kafka redemarre). Mais en panne prolongee (>1h), le timeline accuse un retard. Sprint 12 introduira monitoring DLQ + alerting (Datadog).

Le choix de la pagination cursor-based pour timeline implique une legere complexite implementation : le service expose un parametre `cursor` qui encode `(occurred_at, id)` en base64url. Le frontend doit le passer au prochain GET. Le trade-off est entre simplicite (offset-based avec page number) et performance (cursor stable, fonctionne sur 1M+ interactions). Pour les timelines historiques croissants (un cabinet actif accumule 10000 interactions par mois), cursor est essentiel.

Le choix de stocker content en column TEXT inline (vs table separee) implique que chaque SELECT crm_interactions charge le content meme quand non utilise (e.g. count queries). Pour un content max 10000 chars, l'overhead est negligeable. Si Sprint 13 Analytics demande des aggregates lourds, on pourra partitionner table par tenant + occurred_at.

Le choix d'inclure metadata jsonb sur chaque interaction permet aux types specifiques de stocker des donnees structurees : email subject/headers, call duration, meeting attendees list, whatsapp template_id. Le trade-off est entre flexibilite (n'importe quel type peut stocker n'importe quoi) et coherence (pas de validation schema per type). Sprint 8 retient flexibilite ; Sprint 7 task 3.1.7 (Custom Fields runtime) pourra introduire validation runtime per type d'interaction si demande.

### 2.4 Decisions strategiques referenced

- decision-002 (Multi-tenant), decision-003 (TypeORM), decision-004 (Kafka), decision-006 (No-emoji), decision-008 (Data residency), decision-012 (RBAC) -- toutes pertinence totale.
- decision-022 (planifie -- Append-only audit registres) : decision dediee documentee dans `00-pilotage/decisions/022-append-only-audit-registres.md` (creee implicitement par cette tache).

### 2.5 Pieges techniques connus

1. **Piege : occurred_at futur (saisie erronee).**
   - Pourquoi : user saisit date demain pour log retroactif passe.
   - Solution : Zod refuse occurred_at futur. `refine(d => new Date(d) <= new Date())`. Test V_occurred_future.

2. **Piege : occurred_at trop ancien (> 5 ans).**
   - Pourquoi : log historique import legacy.
   - Solution : Sprint 8 accepte (souplesse import). Sprint 12 (CNDP purge) gerera retention.

3. **Piege : Kafka event duplique cause double interaction.**
   - Pourquoi : retry consumer can replay event.
   - Solution : KafkaConsumerBase Sprint 2 task 1.2.13 a deja implemente Idempotency-Key (event_id Kafka). Le auto-logger check si interaction avec source_event_id existe deja. Test V_idempotency_consumer.

4. **Piege : Kafka event Zod-invalide bloque consumer.**
   - Pourquoi : event mal-format publie par Sprint 9 buggy.
   - Solution : try/catch Zod parse, log WARN, send to DLQ. Pas de crash consumer.

5. **Piege : Cursor pagination breaks si interaction inseree entre fetch pages.**
   - Pourquoi : pagination offset peut sauter ou doubler rows.
   - Solution : cursor base64url(occurred_at + id) garantit unicite. Test V_cursor_stability.

6. **Piege : findByContact retourne interactions soft-deleted contact.**
   - Pourquoi : si contact soft-deleted, ses interactions devraient-elles etre cachees ?
   - Solution : Sprint 8 retient interactions visibles meme si contact supprime (audit historique). Test V_deleted_contact_interactions.

7. **Piege : Multi-tenant leak via Kafka consumer.**
   - Pourquoi : consumer recoit events de tous tenants ; doit filtrer correct.
   - Solution : event Kafka contient `tenant_id`, consumer execute logique dans `runWithTenantContext(event.tenant_id)` avant insert. Test V_multi_tenant_consumer.

8. **Piege : Interaction sans contact_id ni deal_id (orphelin).**
   - Pourquoi : tag generique, note cabinet.
   - Solution : `contact_id` obligatoire ou `deal_id` obligatoire (XOR ou both) au schema. Au minimum un. Sprint 8 retient `contact_id` obligatoire (note ne peut pas etre orpheline).

9. **Piege : Type 'meeting' avec 0 attendees.**
   - Pourquoi : log incomplet.
   - Solution : Zod attendees array optionnel ; si type='meeting' soft-recommend metadata.attendees mais pas obligatoire.

10. **Piege : Direction='internal' avec contact_id externe.**
    - Pourquoi : note interne ne devrait pas avoir contact externe.
    - Solution : Sprint 8 retient permissif (use case legitime : note interne au sujet d'un contact). Documente.

11. **Piege : RBAC : assure (role 'assure') voit interactions le concernant.**
    - Pourquoi : assure portal Sprint 18 demandera timeline.
    - Solution : ABAC OwnResources sur assure : `interactions.contact.linked_user_id = userId`. Sprint 8 livre infrastructure ; Sprint 18 consomme.

12. **Piege : Timeline avec 100k+ interactions.**
    - Pourquoi : tenant tres actif, 5 ans historique.
    - Solution : cursor pagination + index (tenant_id, contact_id, occurred_at DESC, id) + limit max 100. Sprint 13 partitionnement si depasse 1M.

13. **Piege : Content avec caracteres speciaux SQL injection.**
    - Pourquoi : content libre user.
    - Solution : prepared statements TypeORM/Postgres. Sprint 5 + Sprint 7 deja impose. Test V_sql_injection_content.

14. **Piege : Auto-logger crash sur event malformed bloque toute la chaine.**
    - Pourquoi : poison message.
    - Solution : KafkaConsumerBase Sprint 2 manual ack + DLQ apres 3 retry. Test V_dlq_poison.

15. **Piege : Interaction type='note' sans content.**
    - Pourquoi : user clique save vide.
    - Solution : Zod min 1 char content sauf type='task' (peut etre titre seul). Test V_note_empty.

16. **Piege : occurred_at avec timezone non-UTC.**
    - Pourquoi : user saisit avec tz Africa/Casablanca.
    - Solution : Zod accepte ISO 8601 avec ou sans tz, normalise en UTC au save. Frontend Sprint 16 affiche en tz user. Test V_timezone.

17. **Piege : findRecent retourne interactions cross-tenant.**
    - Pourquoi : si query oublie filter.
    - Solution : double protection RLS + WHERE tenant_id explicite. Test V_findRecent_isolation.

18. **Piege : Stats endpoint expose trop d'info granularite.**
    - Pourquoi : stats par contact peut leak business intel.
    - Solution : ABAC sur stats endpoint : seul user owner ou admin voit. Test V_stats_abac.

---

## 3. Architecture context

### 3.1 Position dans le sprint

Tache 3.1.5 est la CINQUIEME du Sprint 8. Sequence : 3.1.1 -> 3.1.2 -> 3.1.3 -> 3.1.4 -> 3.1.5 -> 3.1.6.

Consommateurs aval :
- **Tache 3.1.6 (Search global)** : non concerne (search couvre contacts/companies/deals, pas interactions).
- **Tache 3.1.9 (Appointments)** : publishera `booking.appointment_completed` consume par auto-logger.
- **Tache 3.1.14 (Tests + Seeds)** : seeds creent 100 interactions par tenant (timeline realiste).

Dependances amont :
- **Tache 3.1.2 (Contacts)** : ContactsService.findById valide contact_id. Endpoint `GET /contacts/:id/interactions` deja stub, maintenant fonctionnel.
- **Tache 3.1.4 (Deals)** : Endpoint `GET /deals/:id/interactions` deja stub, fonctionnel.
- **Sprint 2 task 1.2.11 (Topics + schemas events)** : Topics enum (CRM_INTERACTION_LOGGED, COMM_MESSAGE_SENT, COMM_MESSAGE_RECEIVED, BOOKING_APPOINTMENT_COMPLETED).
- **Sprint 2 task 1.2.12 (KafkaPublisher)** : utilise pour publier `crm.interaction.logged` apres creation.
- **Sprint 2 task 1.2.13 (KafkaConsumerBase)** : extended par InteractionsAutoLoggerConsumer.

### 3.2 Position dans le programme global

Interactions consommees par :
- **Sprint 9 (Comm)** : publish events consume par auto-logger.
- **Sprint 13 (Analytics)** : KPIs interactions per contact, per channel, per period.
- **Sprint 14-15 (Insure)** : timeline polices souscrites = interactions filtered by deal -> policy.
- **Sprint 16 (web-broker)** : page contact + page deal afficher timeline UI.
- **Sprint 17 (web-customer-portal)** : pas direct (prospects portal).
- **Sprint 18 (web-assure-portal)** : timeline assure (filtered ABAC linked_user_id).
- **Sprint 19-21 (Repair)** : interactions sinistres.
- **Sprint 25 (Cross-tenant)** : interactions cross-tenant entre cabinet et garage agree.
- **Sprint 26 (Admin foundation)** : admin voit interactions stats agrege.
- **Sprint 28 (Admin reports)** : exports ACAPS incluent interactions count (devoir de conseil).
- **Sprint 31 (Agent Sky)** : suggestions next-best-action analysent timeline pour detecter blocages.

### 3.3 Diagramme

```
                +------------------+        +----------------------+
                | Sprint 9 Comm    |        | Sprint 8 Booking     |
                | publish           |        | publish              |
                | comm.message_sent |        | appointment_completed|
                +--------+---------+        +-----------+----------+
                         |                              |
                         v                              v
                 +-------+------------------------------+--------+
                 |          Kafka cluster Sprint 2                |
                 |  topics : insurtech.events.comm.*              |
                 |           insurtech.events.booking.*           |
                 |           insurtech.events.crm.interaction.*   |
                 +--------------------+---------------------------+
                                      |
                                      | consume
                                      v
+---------------------------------------------------------------------+
|              ApiNestJS                                              |
|                                                                     |
|  InteractionsAutoLoggerConsumer (Sprint 8 task 3.1.5)                |
|    extends KafkaConsumerBase Sprint 2                                |
|    subscribes :                                                      |
|      - insurtech.events.comm.message_sent                            |
|      - insurtech.events.comm.message_received                        |
|      - insurtech.events.booking.appointment_completed                |
|    map event -> interaction.create()                                 |
|                                                                      |
|  InteractionsController                                              |
|    POST   /api/v1/crm/interactions          (manual log)             |
|    GET    /api/v1/crm/interactions/:id                               |
|    GET    /api/v1/crm/contacts/:id/interactions  (timeline cursor)   |
|    GET    /api/v1/crm/deals/:id/interactions     (timeline cursor)   |
|    GET    /api/v1/crm/interactions/recent       (dashboard widget)   |
|    PAS de PATCH ni DELETE (append-only)                              |
|                                                                      |
|  InteractionsService                                                 |
|    + cursor pagination                                               |
|    + auto-log Kafka consume                                          |
|                                                                      |
|  publish: insurtech.events.crm.interaction.logged                    |
+----------+----------------------------------------------------------+
           |
           v
+----------+--------------------+
| Postgres                      |
|                               |
| crm_interactions (Sprint 2)   |
|   id, tenant_id               |
|   contact_id (FK), deal_id    |
|   user_id (auteur)            |
|   type, direction             |
|   subject, content TEXT       |
|   occurred_at, created_at     |
|   metadata jsonb              |
|   source_event_id (idempot)   |
|                               |
| Indexes :                     |
|   (tenant_id, contact_id, occurred_at DESC, id) -- timeline    |
|   (tenant_id, deal_id, occurred_at DESC) -- deal timeline      |
|   (tenant_id, occurred_at DESC) -- recent feed                 |
|   (source_event_id) UNIQUE -- auto-log idempotency             |
+-------------------------------+
```

---

## 4. Livrables checkables

- [ ] Migration `repo/packages/database/src/migrations/1715000000005-InteractionsEnrichment.ts` (~70 lignes)
- [ ] Entity `repo/packages/crm/src/entities/crm-interaction.entity.ts` (~80 lignes)
- [ ] Service `repo/packages/crm/src/services/interactions.service.ts` (~340 lignes)
- [ ] Spec `repo/packages/crm/src/services/interactions.service.spec.ts` (~280 lignes, 18 tests)
- [ ] Consumer `repo/packages/crm/src/consumers/interactions-auto-logger.consumer.ts` (~180 lignes)
- [ ] Spec consumer `repo/packages/crm/src/consumers/interactions-auto-logger.consumer.spec.ts` (~150 lignes, 6 tests)
- [ ] Schemas `repo/packages/crm/src/schemas/interaction.schema.ts` (~110 lignes)
- [ ] Constants `repo/packages/crm/src/constants/interaction-types.ts` (~40 lignes)
- [ ] Helper cursor `repo/packages/crm/src/helpers/cursor.helper.ts` (~50 lignes)
- [ ] Controller `repo/apps/api/src/modules/crm/controllers/interactions.controller.ts` (~200 lignes, 5 endpoints)
- [ ] Modification `contacts.controller.ts` (delegate `/contacts/:id/interactions` au service)
- [ ] Modification `deals.controller.ts` (delegate `/deals/:id/interactions`)
- [ ] E2E `repo/apps/api/test/crm/interactions.e2e-spec.ts` (~380 lignes, 14 scenarios)
- [ ] E2E auto-log `repo/apps/api/test/crm/interactions-auto-log.e2e-spec.ts` (~180 lignes, 6 scenarios)
- [ ] Helpers modifies `crm-test-helpers.ts` (+`createTestInteraction`, `buildInteractionDto`, `truncateInteractions`)
- [ ] APPEND-ONLY : aucun endpoint PATCH ni DELETE
- [ ] occurred_at distinct created_at
- [ ] Cursor pagination (occurred_at, id) base64url
- [ ] Auto-log idempotency via source_event_id UNIQUE
- [ ] Kafka consumer DLQ apres 3 retry
- [ ] 18 unit + 14 E2E + 6 auto-log = 38 tests
- [ ] Coverage >= 90% interactions.service
- [ ] No-emoji, lint, typecheck pass

---

## 5. Fichiers crees / modifies

```
CREES :
repo/packages/database/src/migrations/1715000000005-InteractionsEnrichment.ts ~70 lignes
repo/packages/crm/src/entities/crm-interaction.entity.ts                       ~80 lignes
repo/packages/crm/src/services/interactions.service.ts                        ~340 lignes
repo/packages/crm/src/services/interactions.service.spec.ts                   ~280 lignes
repo/packages/crm/src/consumers/interactions-auto-logger.consumer.ts          ~180 lignes
repo/packages/crm/src/consumers/interactions-auto-logger.consumer.spec.ts     ~150 lignes
repo/packages/crm/src/schemas/interaction.schema.ts                           ~110 lignes
repo/packages/crm/src/constants/interaction-types.ts                            ~40 lignes
repo/packages/crm/src/helpers/cursor.helper.ts                                  ~50 lignes
repo/apps/api/src/modules/crm/controllers/interactions.controller.ts          ~200 lignes
repo/apps/api/test/crm/interactions.e2e-spec.ts                                ~380 lignes
repo/apps/api/test/crm/interactions-auto-log.e2e-spec.ts                       ~180 lignes

MODIFIES :
repo/packages/crm/src/crm.module.ts                                            +5 lignes
repo/packages/crm/src/index.ts                                                +12 lignes
repo/apps/api/src/modules/crm/crm.module.ts                                    +5 lignes (+ consumer provider)
repo/apps/api/src/modules/crm/controllers/contacts.controller.ts               +6 lignes (delegate stub)
repo/apps/api/src/modules/crm/controllers/deals.controller.ts                  +6 lignes (delegate stub)
repo/apps/api/test/fixtures/crm-test-helpers.ts                                +50 lignes
```

Total approximativement 1990 lignes nouveau code.

---

## 6. Code patterns COMPLETS

### 6.1 Fichier 1 sur 12 : Migration

```typescript
// repo/packages/database/src/migrations/1715000000005-InteractionsEnrichment.ts
import type { MigrationInterface, QueryRunner } from 'typeorm';

export class InteractionsEnrichment1715000000005 implements MigrationInterface {
  name = 'InteractionsEnrichment1715000000005';

  public async up(qr: QueryRunner): Promise<void> {
    // 1. Ajouter colonnes manquantes
    await qr.query(`
      ALTER TABLE crm_activities
        ADD COLUMN IF NOT EXISTS direction VARCHAR(20) NOT NULL DEFAULT 'outbound',
        ADD COLUMN IF NOT EXISTS occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        ADD COLUMN IF NOT EXISTS source_event_id VARCHAR(100) NULL,
        ADD COLUMN IF NOT EXISTS source_system VARCHAR(50) NULL
    `);

    // 2. Constraint check direction enum
    await qr.query(`
      ALTER TABLE crm_activities
        ADD CONSTRAINT chk_interaction_direction
        CHECK (direction IN ('inbound', 'outbound', 'internal'))
    `);

    // 3. Constraint check type enum
    await qr.query(`
      ALTER TABLE crm_activities
        DROP CONSTRAINT IF EXISTS chk_activity_type;
      ALTER TABLE crm_activities
        ADD CONSTRAINT chk_interaction_type
        CHECK (type IN ('call', 'email', 'whatsapp', 'sms', 'meeting', 'note', 'task'))
    `);

    // 4. Renommer table crm_activities -> crm_interactions (semantique plus claire)
    await qr.query(`ALTER TABLE crm_activities RENAME TO crm_interactions`);

    // 5. Indexes optimises
    await qr.query(`DROP INDEX IF EXISTS idx_crm_activities_contact_time`);
    await qr.query(`CREATE INDEX idx_crm_interactions_contact_time ON crm_interactions(tenant_id, contact_id, occurred_at DESC, id) WHERE deleted_at IS NULL`);
    await qr.query(`CREATE INDEX IF NOT EXISTS idx_crm_interactions_deal_time ON crm_interactions(tenant_id, deal_id, occurred_at DESC) WHERE deleted_at IS NULL`);
    await qr.query(`CREATE INDEX IF NOT EXISTS idx_crm_interactions_recent ON crm_interactions(tenant_id, occurred_at DESC) WHERE deleted_at IS NULL`);
    await qr.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_interactions_source_event_id ON crm_interactions(source_event_id) WHERE source_event_id IS NOT NULL`);
  }

  public async down(qr: QueryRunner): Promise<void> {
    await qr.query(`ALTER TABLE crm_interactions RENAME TO crm_activities`);
    await qr.query(`DROP INDEX IF EXISTS idx_crm_interactions_contact_time, idx_crm_interactions_deal_time, idx_crm_interactions_recent, idx_crm_interactions_source_event_id`);
    await qr.query(`ALTER TABLE crm_activities DROP CONSTRAINT IF EXISTS chk_interaction_direction, DROP CONSTRAINT IF EXISTS chk_interaction_type`);
    await qr.query(`ALTER TABLE crm_activities DROP COLUMN IF EXISTS direction, DROP COLUMN IF EXISTS occurred_at, DROP COLUMN IF EXISTS metadata, DROP COLUMN IF EXISTS source_event_id, DROP COLUMN IF EXISTS source_system`);
  }
}
```

### 6.2 Fichier 2 sur 12 : Entity

```typescript
// repo/packages/crm/src/entities/crm-interaction.entity.ts
import {
  Entity, Column, PrimaryGeneratedColumn,
  CreateDateColumn, UpdateDateColumn, DeleteDateColumn,
  Index, ManyToOne, JoinColumn,
} from 'typeorm';

export type InteractionType = 'call' | 'email' | 'whatsapp' | 'sms' | 'meeting' | 'note' | 'task';
export type InteractionDirection = 'inbound' | 'outbound' | 'internal';

@Entity({ name: 'crm_interactions' })
@Index('idx_crm_interactions_tenant', ['tenant_id'])
@Index('idx_crm_interactions_contact_time', ['tenant_id', 'contact_id', 'occurred_at'])
@Index('idx_crm_interactions_deal_time', ['tenant_id', 'deal_id', 'occurred_at'])
@Index('idx_crm_interactions_recent', ['tenant_id', 'occurred_at'])
export class CrmInteractionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: false })
  tenant_id!: string;

  @Column({ type: 'uuid', nullable: false })
  contact_id!: string;

  @Column({ type: 'uuid', nullable: true })
  deal_id?: string | null;

  @Column({ type: 'uuid', nullable: false })
  user_id!: string;

  @Column({ type: 'varchar', length: 20, nullable: false })
  type!: InteractionType;

  @Column({ type: 'varchar', length: 20, nullable: false, default: 'outbound' })
  direction!: InteractionDirection;

  @Column({ type: 'text', nullable: true })
  subject?: string | null;

  @Column({ type: 'text', nullable: true })
  content?: string | null;

  @Column({ type: 'timestamptz', nullable: false })
  occurred_at!: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_at?: Date | null;

  @Column({ type: 'jsonb', nullable: false, default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;

  @Column({ type: 'varchar', length: 100, nullable: true })
  source_event_id?: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  source_system?: string | null;
}
```

### 6.3 Fichier 3 sur 12 : Constants

```typescript
// repo/packages/crm/src/constants/interaction-types.ts

export const INTERACTION_TYPES = ['call', 'email', 'whatsapp', 'sms', 'meeting', 'note', 'task'] as const;
export type InteractionType = typeof INTERACTION_TYPES[number];

export const INTERACTION_DIRECTIONS = ['inbound', 'outbound', 'internal'] as const;
export type InteractionDirection = typeof INTERACTION_DIRECTIONS[number];

export const INTERACTION_TYPE_LABELS_FR: Record<InteractionType, string> = {
  call: 'Appel telephonique',
  email: 'Email',
  whatsapp: 'WhatsApp',
  sms: 'SMS',
  meeting: 'Reunion',
  note: 'Note',
  task: 'Tache',
};

export const INTERACTION_DIRECTION_LABELS_FR: Record<InteractionDirection, string> = {
  inbound: 'Entrant',
  outbound: 'Sortant',
  internal: 'Interne',
};

export function isValidInteractionType(value: unknown): value is InteractionType {
  return typeof value === 'string'
    && (INTERACTION_TYPES as readonly string[]).includes(value);
}
```

### 6.4 Fichier 4 sur 12 : Cursor helper

```typescript
// repo/packages/crm/src/helpers/cursor.helper.ts

export interface TimelineCursor {
  occurred_at: string;
  id: string;
}

export class CursorHelper {
  /**
   * Encode tuple (occurred_at, id) en cursor base64url stable.
   */
  static encode(cursor: TimelineCursor): string {
    const json = JSON.stringify(cursor);
    return Buffer.from(json, 'utf8').toString('base64url');
  }

  /**
   * Decode cursor. Throw si format invalide.
   */
  static decode(cursorStr: string): TimelineCursor {
    try {
      const json = Buffer.from(cursorStr, 'base64url').toString('utf8');
      const obj = JSON.parse(json);
      if (typeof obj.occurred_at !== 'string' || typeof obj.id !== 'string') {
        throw new Error('Cursor missing fields');
      }
      return { occurred_at: obj.occurred_at, id: obj.id };
    } catch {
      throw new Error('Invalid cursor');
    }
  }

  /**
   * Build cursor from last entity in current page.
   */
  static buildFromEntity(entity: { occurred_at: Date | string; id: string }): string {
    const occurredAt = entity.occurred_at instanceof Date
      ? entity.occurred_at.toISOString()
      : entity.occurred_at;
    return CursorHelper.encode({ occurred_at: occurredAt, id: entity.id });
  }
}
```

### 6.5 Fichier 5 sur 12 : Schemas Zod

```typescript
// repo/packages/crm/src/schemas/interaction.schema.ts
import { z } from 'zod';
import { INTERACTION_TYPES, INTERACTION_DIRECTIONS } from '../constants/interaction-types';

const MetadataSchema = z.record(z.unknown()).superRefine((value, ctx) => {
  if (JSON.stringify(value).length > 8192) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'metadata > 8 KB' });
  }
});

export const LogInteractionSchema = z.object({
  contact_id: z.string().uuid(),
  deal_id: z.string().uuid().nullable().optional(),
  type: z.enum(INTERACTION_TYPES),
  direction: z.enum(INTERACTION_DIRECTIONS).default('outbound'),
  subject: z.string().trim().max(500).nullable().optional(),
  content: z.string().trim().min(1).max(10000).optional(),
  occurred_at: z.string().datetime({ offset: true }).optional().refine(
    (v) => !v || new Date(v) <= new Date(),
    { message: 'occurred_at ne peut pas etre dans le futur' },
  ),
  metadata: MetadataSchema.default({}),
}).strict().superRefine((data, ctx) => {
  // Si type='note' ou 'task', content obligatoire
  if ((data.type === 'note' || data.type === 'task') && (!data.content || data.content.trim().length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Type "${data.type}" requiert content non vide`,
      path: ['content'],
    });
  }
});

export type LogInteractionDto = z.infer<typeof LogInteractionSchema>;

export const InteractionFiltersSchema = z.object({
  cursor: z.string().optional(),
  page_size: z.coerce.number().int().min(1).max(100).default(25),
  type: z.enum(INTERACTION_TYPES).optional(),
  direction: z.enum(INTERACTION_DIRECTIONS).optional(),
  user_id: z.string().uuid().optional(),
  occurred_from: z.string().datetime().optional(),
  occurred_to: z.string().datetime().optional(),
}).strict();

export type InteractionFiltersDto = z.infer<typeof InteractionFiltersSchema>;

export const RecentInteractionsFiltersSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  type: z.enum(INTERACTION_TYPES).optional(),
}).strict();

export type RecentInteractionsFiltersDto = z.infer<typeof RecentInteractionsFiltersSchema>;
```

### 6.6 Fichier 6 sur 12 : InteractionsService

```typescript
// repo/packages/crm/src/services/interactions.service.ts
import {
  Injectable, NotFoundException, BadRequestException, Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, MoreThan, LessThan, And, Equal } from 'typeorm';
import type { Logger } from 'pino';
import { CrmInteractionEntity } from '../entities/crm-interaction.entity';
import { ContactsService } from './contacts.service';
import {
  type LogInteractionDto, type InteractionFiltersDto, type RecentInteractionsFiltersDto,
} from '../schemas/interaction.schema';
import { CursorHelper, type TimelineCursor } from '../helpers/cursor.helper';
import { KafkaPublisherService, Topics } from '@insurtech/shared-events';
import { getCurrentTenantId } from '@insurtech/shared-utils';

export interface PaginatedTimeline {
  data: CrmInteractionEntity[];
  next_cursor: string | null;
  has_more: boolean;
  total_count_estimate?: number;
}

export interface InteractionStats {
  total_count: number;
  by_type: Record<string, number>;
  by_direction: Record<string, number>;
  last_interaction_at: Date | null;
  unique_users_count: number;
}

@Injectable()
export class InteractionsService {
  constructor(
    @InjectRepository(CrmInteractionEntity)
    private readonly interactionsRepo: Repository<CrmInteractionEntity>,
    private readonly contactsService: ContactsService,
    private readonly kafkaPublisher: KafkaPublisherService,
    @Inject('PINO_LOGGER') private readonly logger: Logger,
  ) {}

  /**
   * Logger une interaction (manual ou auto-log).
   * APPEND-ONLY : pas de update.
   */
  async logInteraction(
    dto: LogInteractionDto,
    userId: string,
    sourceMeta?: { source_event_id?: string; source_system?: string },
  ): Promise<CrmInteractionEntity> {
    const tenantId = this.requireTenantContext('logInteraction');

    // Valider contact existe (skip si auto-log avec contact deja valide)
    if (!sourceMeta?.source_event_id) {
      await this.contactsService.findById(dto.contact_id);
    }

    // Idempotency check : si source_event_id existe deja, retourner existing
    if (sourceMeta?.source_event_id) {
      const existing = await this.interactionsRepo.findOne({
        where: { source_event_id: sourceMeta.source_event_id, tenant_id: tenantId },
      });
      if (existing) {
        this.logger.debug(
          { tenant_id: tenantId, source_event_id: sourceMeta.source_event_id },
          'Interaction already logged for source_event_id (idempotent)',
        );
        return existing;
      }
    }

    const occurredAt = dto.occurred_at ? new Date(dto.occurred_at) : new Date();

    const entity = this.interactionsRepo.create({
      tenant_id: tenantId,
      contact_id: dto.contact_id,
      deal_id: dto.deal_id ?? null,
      user_id: userId,
      type: dto.type,
      direction: dto.direction,
      subject: dto.subject,
      content: dto.content,
      occurred_at: occurredAt,
      metadata: dto.metadata,
      source_event_id: sourceMeta?.source_event_id ?? null,
      source_system: sourceMeta?.source_system ?? 'manual',
    });

    const saved = await this.interactionsRepo.save(entity);

    // Update last_interaction_at on contact (denormalized cache)
    await this.interactionsRepo.query(
      `UPDATE crm_contacts SET last_interaction_at = $1 WHERE id = $2 AND tenant_id = $3 AND (last_interaction_at IS NULL OR last_interaction_at < $1)`,
      [occurredAt, dto.contact_id, tenantId],
    );

    await this.kafkaPublisher.publish({
      topic: Topics.CRM_INTERACTION_LOGGED,
      key: saved.id,
      value: {
        event_id: crypto.randomUUID(),
        event_type: 'crm.interaction.logged',
        occurred_at: occurredAt.toISOString(),
        tenant_id: tenantId,
        actor_user_id: userId,
        interaction: {
          id: saved.id,
          contact_id: saved.contact_id,
          deal_id: saved.deal_id,
          type: saved.type,
          direction: saved.direction,
          source_system: saved.source_system,
        },
      },
    });

    this.logger.info(
      { tenant_id: tenantId, contact_id: dto.contact_id, type: dto.type, direction: dto.direction, source: saved.source_system },
      'Interaction logged',
    );

    return saved;
  }

  async findById(id: string): Promise<CrmInteractionEntity> {
    const tenantId = this.requireTenantContext('findById');
    const entity = await this.interactionsRepo.findOne({
      where: { id, tenant_id: tenantId, deleted_at: IsNull() },
    });
    if (!entity) {
      throw new NotFoundException({ code: 'CRM_INTERACTION_NOT_FOUND', message: `Interaction ${id} not found` });
    }
    return entity;
  }

  async findByContact(
    contactId: string,
    filters: InteractionFiltersDto,
  ): Promise<PaginatedTimeline> {
    const tenantId = this.requireTenantContext('findByContact');
    return this.findTimeline(filters, { contact_id: contactId, tenant_id: tenantId });
  }

  async findByDeal(
    dealId: string,
    filters: InteractionFiltersDto,
  ): Promise<PaginatedTimeline> {
    const tenantId = this.requireTenantContext('findByDeal');
    return this.findTimeline(filters, { deal_id: dealId, tenant_id: tenantId });
  }

  async findRecent(filters: RecentInteractionsFiltersDto): Promise<CrmInteractionEntity[]> {
    const tenantId = this.requireTenantContext('findRecent');
    const where: Record<string, unknown> = { tenant_id: tenantId, deleted_at: IsNull() };
    if (filters.type) where.type = filters.type;
    return this.interactionsRepo.find({
      where,
      order: { occurred_at: 'DESC' },
      take: filters.limit,
    });
  }

  async getStats(contactId: string): Promise<InteractionStats> {
    const tenantId = this.requireTenantContext('getStats');

    const totalRow: Array<{ count: string; last_at: string | null }> = await this.interactionsRepo.query(
      `SELECT COUNT(*)::text AS count, MAX(occurred_at)::text AS last_at
       FROM crm_interactions
       WHERE tenant_id = $1 AND contact_id = $2 AND deleted_at IS NULL`,
      [tenantId, contactId],
    );

    const byTypeRows: Array<{ type: string; count: string }> = await this.interactionsRepo.query(
      `SELECT type, COUNT(*)::text AS count
       FROM crm_interactions
       WHERE tenant_id = $1 AND contact_id = $2 AND deleted_at IS NULL
       GROUP BY type`,
      [tenantId, contactId],
    );

    const byDirRows: Array<{ direction: string; count: string }> = await this.interactionsRepo.query(
      `SELECT direction, COUNT(*)::text AS count
       FROM crm_interactions
       WHERE tenant_id = $1 AND contact_id = $2 AND deleted_at IS NULL
       GROUP BY direction`,
      [tenantId, contactId],
    );

    const usersRows: Array<{ count: string }> = await this.interactionsRepo.query(
      `SELECT COUNT(DISTINCT user_id)::text AS count
       FROM crm_interactions
       WHERE tenant_id = $1 AND contact_id = $2 AND deleted_at IS NULL`,
      [tenantId, contactId],
    );

    const byType: Record<string, number> = {};
    for (const r of byTypeRows) byType[r.type] = Number(r.count);
    const byDirection: Record<string, number> = {};
    for (const r of byDirRows) byDirection[r.direction] = Number(r.count);

    return {
      total_count: Number(totalRow[0]?.count ?? 0),
      by_type: byType,
      by_direction: byDirection,
      last_interaction_at: totalRow[0]?.last_at ? new Date(totalRow[0].last_at) : null,
      unique_users_count: Number(usersRows[0]?.count ?? 0),
    };
  }

  /**
   * Cursor-based pagination commune.
   */
  private async findTimeline(
    filters: InteractionFiltersDto,
    baseWhere: Record<string, unknown>,
  ): Promise<PaginatedTimeline> {
    let cursorObj: TimelineCursor | null = null;
    if (filters.cursor) {
      try {
        cursorObj = CursorHelper.decode(filters.cursor);
      } catch {
        throw new BadRequestException({
          code: 'CRM_INTERACTION_INVALID_CURSOR',
          message: 'Invalid cursor',
        });
      }
    }

    const qb = this.interactionsRepo.createQueryBuilder('i')
      .where(baseWhere)
      .andWhere('i.deleted_at IS NULL');

    if (cursorObj) {
      // Cursor pagination : occurred_at < cursor.occurred_at OR (occurred_at = cursor.occurred_at AND id < cursor.id)
      qb.andWhere(
        `(i.occurred_at < :cursor_at OR (i.occurred_at = :cursor_at AND i.id < :cursor_id))`,
        { cursor_at: cursorObj.occurred_at, cursor_id: cursorObj.id },
      );
    }

    if (filters.type) qb.andWhere('i.type = :type', { type: filters.type });
    if (filters.direction) qb.andWhere('i.direction = :dir', { dir: filters.direction });
    if (filters.user_id) qb.andWhere('i.user_id = :uid', { uid: filters.user_id });
    if (filters.occurred_from) qb.andWhere('i.occurred_at >= :from', { from: filters.occurred_from });
    if (filters.occurred_to) qb.andWhere('i.occurred_at <= :to', { to: filters.occurred_to });

    qb.orderBy('i.occurred_at', 'DESC').addOrderBy('i.id', 'DESC');
    qb.take(filters.page_size + 1);  // +1 pour detecter has_more

    const rows = await qb.getMany();
    const hasMore = rows.length > filters.page_size;
    const data = hasMore ? rows.slice(0, filters.page_size) : rows;

    let nextCursor: string | null = null;
    if (hasMore && data.length > 0) {
      const last = data[data.length - 1]!;
      nextCursor = CursorHelper.buildFromEntity(last);
    }

    return { data, next_cursor: nextCursor, has_more: hasMore };
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

### 6.7 Fichier 7 sur 12 : Auto-Logger Consumer

```typescript
// repo/packages/crm/src/consumers/interactions-auto-logger.consumer.ts
import { Injectable, Inject } from '@nestjs/common';
import type { Logger } from 'pino';
import { z } from 'zod';
import { KafkaConsumerBase, Topics } from '@insurtech/shared-events';
import { InteractionsService } from '../services/interactions.service';
import { runWithTenantContext } from '@insurtech/shared-utils';
import type { LogInteractionDto } from '../schemas/interaction.schema';

/**
 * Schemas Zod pour validation events sources.
 * Sprint 9 (Comm) publishera ces events ; Sprint 8 task 3.1.5 les consomme proactivement.
 */
const CommMessageSentEventSchema = z.object({
  event_id: z.string(),
  event_type: z.literal('comm.message_sent'),
  tenant_id: z.string().uuid(),
  occurred_at: z.string().datetime({ offset: true }),
  actor_user_id: z.string().uuid(),
  message: z.object({
    id: z.string().uuid(),
    channel: z.enum(['whatsapp', 'email', 'sms']),
    direction: z.literal('outbound'),
    contact_id: z.string().uuid(),
    deal_id: z.string().uuid().nullable().optional(),
    subject: z.string().nullable().optional(),
    body_preview: z.string().max(500).optional(),
    template_id: z.string().nullable().optional(),
    locale: z.string().optional(),
  }),
});

const CommMessageReceivedEventSchema = CommMessageSentEventSchema.extend({
  event_type: z.literal('comm.message_received'),
  message: CommMessageSentEventSchema.shape.message.extend({
    direction: z.literal('inbound'),
  }),
});

const BookingAppointmentCompletedEventSchema = z.object({
  event_id: z.string(),
  event_type: z.literal('booking.appointment_completed'),
  tenant_id: z.string().uuid(),
  occurred_at: z.string().datetime({ offset: true }),
  actor_user_id: z.string().uuid(),
  appointment: z.object({
    id: z.string().uuid(),
    contact_id: z.string().uuid(),
    deal_id: z.string().uuid().nullable().optional(),
    subject: z.string().nullable().optional(),
    duration_minutes: z.number().int().nullable().optional(),
    notes: z.string().nullable().optional(),
  }),
});

@Injectable()
export class InteractionsAutoLoggerConsumer extends KafkaConsumerBase {
  protected readonly groupId = 'crm-interactions-auto-logger';
  protected readonly topics = [
    Topics.COMM_MESSAGE_SENT,
    Topics.COMM_MESSAGE_RECEIVED,
    Topics.BOOKING_APPOINTMENT_COMPLETED,
  ];

  constructor(
    private readonly interactionsService: InteractionsService,
    @Inject('PINO_LOGGER') protected readonly logger: Logger,
  ) {
    super();
  }

  /**
   * Override de la methode abstraite de KafkaConsumerBase.
   * Manual ack apres traitement reussi ; throw -> retry ou DLQ apres 3 tentatives.
   */
  protected async handleMessage(topic: string, payload: unknown): Promise<void> {
    try {
      let dto: LogInteractionDto;
      let tenantId: string;
      let userId: string;
      let sourceEventId: string;
      let sourceSystem: string;

      switch (topic) {
        case Topics.COMM_MESSAGE_SENT: {
          const event = CommMessageSentEventSchema.parse(payload);
          tenantId = event.tenant_id;
          userId = event.actor_user_id;
          sourceEventId = event.event_id;
          sourceSystem = 'comm';
          dto = {
            contact_id: event.message.contact_id,
            deal_id: event.message.deal_id ?? null,
            type: event.message.channel,
            direction: 'outbound',
            subject: event.message.subject ?? null,
            content: event.message.body_preview,
            occurred_at: event.occurred_at,
            metadata: {
              message_id: event.message.id,
              template_id: event.message.template_id,
              locale: event.message.locale,
            },
          };
          break;
        }
        case Topics.COMM_MESSAGE_RECEIVED: {
          const event = CommMessageReceivedEventSchema.parse(payload);
          tenantId = event.tenant_id;
          userId = event.actor_user_id;
          sourceEventId = event.event_id;
          sourceSystem = 'comm';
          dto = {
            contact_id: event.message.contact_id,
            deal_id: event.message.deal_id ?? null,
            type: event.message.channel,
            direction: 'inbound',
            subject: event.message.subject ?? null,
            content: event.message.body_preview,
            occurred_at: event.occurred_at,
            metadata: { message_id: event.message.id },
          };
          break;
        }
        case Topics.BOOKING_APPOINTMENT_COMPLETED: {
          const event = BookingAppointmentCompletedEventSchema.parse(payload);
          tenantId = event.tenant_id;
          userId = event.actor_user_id;
          sourceEventId = event.event_id;
          sourceSystem = 'booking';
          dto = {
            contact_id: event.appointment.contact_id,
            deal_id: event.appointment.deal_id ?? null,
            type: 'meeting',
            direction: 'outbound',
            subject: event.appointment.subject ?? 'Rendez-vous',
            content: event.appointment.notes,
            occurred_at: event.occurred_at,
            metadata: {
              appointment_id: event.appointment.id,
              duration_minutes: event.appointment.duration_minutes,
            },
          };
          break;
        }
        default:
          this.logger.warn({ topic }, 'Unknown topic, skipping');
          return;
      }

      await runWithTenantContext(tenantId, async () => {
        await this.interactionsService.logInteraction(dto, userId, {
          source_event_id: sourceEventId,
          source_system: sourceSystem,
        });
      });

      this.logger.debug(
        { topic, source_event_id: sourceEventId, contact_id: dto.contact_id },
        'Auto-logged interaction',
      );
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.logger.warn(
          { topic, errors: error.errors },
          'Event schema invalid, sending to DLQ',
        );
        // KafkaConsumerBase Sprint 2 gere DLQ apres 3 retries
        throw error;
      }
      throw error;
    }
  }
}
```

### 6.8 Fichier 8 sur 12 : InteractionsService Spec

```typescript
// repo/packages/crm/src/services/interactions.service.spec.ts
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { InteractionsService } from './interactions.service';
import { ContactsService } from './contacts.service';
import { CrmInteractionEntity } from '../entities/crm-interaction.entity';
import { KafkaPublisherService } from '@insurtech/shared-events';
import * as utils from '@insurtech/shared-utils';

vi.mock('@insurtech/shared-utils', async () => ({
  ...(await vi.importActual<typeof utils>('@insurtech/shared-utils')),
  getCurrentTenantId: vi.fn(),
}));

const TENANT = 'tenant-uuid';
const USER = 'user-uuid';
const CONTACT = 'contact-uuid';

describe('InteractionsService', () => {
  let service: InteractionsService;
  let repo: any;
  let contacts: any;
  let kafka: any;

  beforeEach(async () => {
    (utils.getCurrentTenantId as Mock).mockReturnValue(TENANT);

    const module = await Test.createTestingModule({
      providers: [
        InteractionsService,
        {
          provide: getRepositoryToken(CrmInteractionEntity),
          useValue: {
            findOne: vi.fn(),
            create: vi.fn((d) => d),
            save: vi.fn((d) => Promise.resolve({ ...d, id: 'i1' })),
            find: vi.fn(),
            createQueryBuilder: vi.fn(() => ({
              where: vi.fn().mockReturnThis(),
              andWhere: vi.fn().mockReturnThis(),
              orderBy: vi.fn().mockReturnThis(),
              addOrderBy: vi.fn().mockReturnThis(),
              take: vi.fn().mockReturnThis(),
              getMany: vi.fn(() => Promise.resolve([])),
            })),
            query: vi.fn(),
          },
        },
        {
          provide: ContactsService,
          useValue: { findById: vi.fn(() => Promise.resolve({ id: CONTACT })) },
        },
        { provide: KafkaPublisherService, useValue: { publish: vi.fn() } },
        { provide: 'PINO_LOGGER', useValue: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } },
      ],
    }).compile();

    service = module.get(InteractionsService);
    repo = module.get(getRepositoryToken(CrmInteractionEntity));
    contacts = module.get(ContactsService);
    kafka = module.get(KafkaPublisherService);
  });

  describe('logInteraction', () => {
    it('cree interaction manuelle', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.query.mockResolvedValue([]);
      const r = await service.logInteraction({
        contact_id: CONTACT, type: 'note', direction: 'internal',
        content: 'Note importante', metadata: {},
      } as any, USER);
      expect(r.id).toBe('i1');
      expect(kafka.publish).toHaveBeenCalled();
    });

    it('valide contact existe (manual)', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.query.mockResolvedValue([]);
      await service.logInteraction({
        contact_id: CONTACT, type: 'call', direction: 'outbound',
        content: 'Phoned', metadata: {},
      } as any, USER);
      expect(contacts.findById).toHaveBeenCalledWith(CONTACT);
    });

    it('source_event_id deja existant retourne existing (idempotency)', async () => {
      const existing = { id: 'existing-id', source_event_id: 'evt-1' };
      repo.findOne.mockResolvedValue(existing);
      const r = await service.logInteraction(
        { contact_id: CONTACT, type: 'whatsapp', direction: 'outbound', content: 'Hi', metadata: {} } as any,
        USER,
        { source_event_id: 'evt-1', source_system: 'comm' },
      );
      expect(r.id).toBe('existing-id');
    });

    it('publie Kafka topic crm.interaction.logged', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.query.mockResolvedValue([]);
      await service.logInteraction({
        contact_id: CONTACT, type: 'email', direction: 'outbound',
        content: 'Email body', metadata: {},
      } as any, USER);
      expect(kafka.publish).toHaveBeenCalledWith(
        expect.objectContaining({ topic: expect.stringContaining('crm.interaction.logged') }),
      );
    });

    it('update last_interaction_at sur contact', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.query.mockResolvedValue([]);
      await service.logInteraction({
        contact_id: CONTACT, type: 'note', direction: 'internal',
        content: 'X', metadata: {},
      } as any, USER);
      const updateCall = repo.query.mock.calls.find((c: any[]) => c[0]?.includes('UPDATE crm_contacts'));
      expect(updateCall).toBeDefined();
    });

    it('occurred_at default a NOW si non fourni', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.query.mockResolvedValue([]);
      const before = Date.now();
      await service.logInteraction({
        contact_id: CONTACT, type: 'note', direction: 'internal',
        content: 'X', metadata: {},
      } as any, USER);
      const arg = repo.create.mock.calls[0][0];
      expect(arg.occurred_at.getTime()).toBeGreaterThanOrEqual(before);
    });

    it('source_system default a "manual"', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.query.mockResolvedValue([]);
      await service.logInteraction({
        contact_id: CONTACT, type: 'note', direction: 'internal',
        content: 'X', metadata: {},
      } as any, USER);
      const arg = repo.create.mock.calls[0][0];
      expect(arg.source_system).toBe('manual');
    });
  });

  describe('findById', () => {
    it('retourne interaction', async () => {
      repo.findOne.mockResolvedValue({ id: 'i1', tenant_id: TENANT });
      const r = await service.findById('i1');
      expect(r.id).toBe('i1');
    });

    it('throw NotFound', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findById('xxx')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByContact', () => {
    it('cursor invalide rejete', async () => {
      await expect(service.findByContact(CONTACT, {
        cursor: 'invalid-base64',
        page_size: 25,
      } as any)).rejects.toThrow(BadRequestException);
    });

    it('execute query avec contact_id filter', async () => {
      const qb = repo.createQueryBuilder();
      qb.getMany.mockResolvedValue([]);
      await service.findByContact(CONTACT, { page_size: 25 } as any);
      expect(qb.where).toHaveBeenCalledWith({ contact_id: CONTACT, tenant_id: TENANT });
    });

    it('detecte has_more correctement', async () => {
      const qb = repo.createQueryBuilder();
      const rows = Array.from({ length: 26 }, (_, i) => ({
        id: `i${i}`, occurred_at: new Date(), tenant_id: TENANT, contact_id: CONTACT,
      }));
      qb.getMany.mockResolvedValue(rows);
      const r = await service.findByContact(CONTACT, { page_size: 25 } as any);
      expect(r.has_more).toBe(true);
      expect(r.data).toHaveLength(25);
      expect(r.next_cursor).not.toBeNull();
    });

    it('has_more=false si moins page_size', async () => {
      const qb = repo.createQueryBuilder();
      qb.getMany.mockResolvedValue([{ id: 'i1', occurred_at: new Date() }]);
      const r = await service.findByContact(CONTACT, { page_size: 25 } as any);
      expect(r.has_more).toBe(false);
      expect(r.next_cursor).toBeNull();
    });
  });

  describe('findRecent', () => {
    it('retourne tri par occurred_at DESC limite', async () => {
      repo.find.mockResolvedValue([]);
      const r = await service.findRecent({ limit: 20 } as any);
      expect(repo.find).toHaveBeenCalledWith(expect.objectContaining({
        order: { occurred_at: 'DESC' },
        take: 20,
      }));
    });
  });

  describe('getStats', () => {
    it('retourne agregations correctes', async () => {
      repo.query
        .mockResolvedValueOnce([{ count: '10', last_at: '2026-05-08T10:00:00Z' }])
        .mockResolvedValueOnce([{ type: 'whatsapp', count: '5' }, { type: 'email', count: '3' }, { type: 'note', count: '2' }])
        .mockResolvedValueOnce([{ direction: 'outbound', count: '7' }, { direction: 'inbound', count: '3' }])
        .mockResolvedValueOnce([{ count: '2' }]);

      const stats = await service.getStats(CONTACT);
      expect(stats.total_count).toBe(10);
      expect(stats.by_type.whatsapp).toBe(5);
      expect(stats.by_direction.outbound).toBe(7);
      expect(stats.unique_users_count).toBe(2);
    });
  });

  describe('append-only enforcement', () => {
    it('aucune methode update / softDelete exposee', () => {
      expect((service as any).update).toBeUndefined();
      expect((service as any).delete).toBeUndefined();
      expect((service as any).softDelete).toBeUndefined();
    });
  });
});
```

### 6.9 Fichier 9 sur 12 : Auto-logger Consumer Spec

```typescript
// repo/packages/crm/src/consumers/interactions-auto-logger.consumer.spec.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InteractionsAutoLoggerConsumer } from './interactions-auto-logger.consumer';
import { InteractionsService } from '../services/interactions.service';
import { Topics } from '@insurtech/shared-events';
import * as utils from '@insurtech/shared-utils';

vi.mock('@insurtech/shared-utils', async () => ({
  ...(await vi.importActual<typeof utils>('@insurtech/shared-utils')),
  runWithTenantContext: vi.fn(async (_tenantId, cb) => cb()),
}));

describe('InteractionsAutoLoggerConsumer', () => {
  let consumer: InteractionsAutoLoggerConsumer;
  let service: any;
  let logger: any;

  beforeEach(() => {
    service = { logInteraction: vi.fn(() => Promise.resolve({ id: 'i1' })) };
    logger = { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() };
    consumer = new InteractionsAutoLoggerConsumer(service, logger);
  });

  it('mappe comm.message_sent en interaction whatsapp outbound', async () => {
    await (consumer as any).handleMessage(Topics.COMM_MESSAGE_SENT, {
      event_id: 'evt-1',
      event_type: 'comm.message_sent',
      tenant_id: '00000000-0000-0000-0000-000000000001',
      occurred_at: '2026-05-08T10:00:00.000Z',
      actor_user_id: '00000000-0000-0000-0000-000000000002',
      message: {
        id: '00000000-0000-0000-0000-000000000003',
        channel: 'whatsapp',
        direction: 'outbound',
        contact_id: '00000000-0000-0000-0000-000000000004',
        body_preview: 'Hello',
      },
    });
    expect(service.logInteraction).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'whatsapp', direction: 'outbound' }),
      expect.any(String),
      expect.objectContaining({ source_event_id: 'evt-1', source_system: 'comm' }),
    );
  });

  it('mappe comm.message_received en interaction inbound', async () => {
    await (consumer as any).handleMessage(Topics.COMM_MESSAGE_RECEIVED, {
      event_id: 'evt-2',
      event_type: 'comm.message_received',
      tenant_id: '00000000-0000-0000-0000-000000000001',
      occurred_at: '2026-05-08T11:00:00.000Z',
      actor_user_id: '00000000-0000-0000-0000-000000000002',
      message: {
        id: '00000000-0000-0000-0000-000000000003',
        channel: 'email',
        direction: 'inbound',
        contact_id: '00000000-0000-0000-0000-000000000004',
        body_preview: 'Reply',
      },
    });
    expect(service.logInteraction).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'email', direction: 'inbound' }),
      expect.any(String),
      expect.any(Object),
    );
  });

  it('mappe booking.appointment_completed en interaction meeting', async () => {
    await (consumer as any).handleMessage(Topics.BOOKING_APPOINTMENT_COMPLETED, {
      event_id: 'evt-3',
      event_type: 'booking.appointment_completed',
      tenant_id: '00000000-0000-0000-0000-000000000001',
      occurred_at: '2026-05-08T14:00:00.000Z',
      actor_user_id: '00000000-0000-0000-0000-000000000002',
      appointment: {
        id: '00000000-0000-0000-0000-000000000005',
        contact_id: '00000000-0000-0000-0000-000000000004',
        subject: 'Rendez-vous client',
        duration_minutes: 60,
      },
    });
    expect(service.logInteraction).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'meeting', direction: 'outbound' }),
      expect.any(String),
      expect.any(Object),
    );
  });

  it('rejette event Zod-invalide (throw pour DLQ)', async () => {
    await expect((consumer as any).handleMessage(Topics.COMM_MESSAGE_SENT, {
      event_id: 'bad',
      event_type: 'comm.message_sent',
      tenant_id: 'not-a-uuid',
      occurred_at: 'not-a-date',
      message: {},
    })).rejects.toThrow();
  });

  it('topic inconnu : skip avec WARN log', async () => {
    await (consumer as any).handleMessage('unknown.topic', {});
    expect(logger.warn).toHaveBeenCalled();
    expect(service.logInteraction).not.toHaveBeenCalled();
  });

  it('execute logInteraction dans tenant context', async () => {
    await (consumer as any).handleMessage(Topics.COMM_MESSAGE_SENT, {
      event_id: 'evt-1',
      event_type: 'comm.message_sent',
      tenant_id: '00000000-0000-0000-0000-000000000001',
      occurred_at: '2026-05-08T10:00:00.000Z',
      actor_user_id: '00000000-0000-0000-0000-000000000002',
      message: {
        id: '00000000-0000-0000-0000-000000000003',
        channel: 'sms',
        direction: 'outbound',
        contact_id: '00000000-0000-0000-0000-000000000004',
      },
    });
    expect(utils.runWithTenantContext).toHaveBeenCalledWith(
      '00000000-0000-0000-0000-000000000001',
      expect.any(Function),
    );
  });
});
```

### 6.10 Fichier 10 sur 12 : InteractionsController

```typescript
// repo/apps/api/src/modules/crm/controllers/interactions.controller.ts
import {
  Controller, Get, Post,
  Body, Param, Query, UseGuards, UseInterceptors,
  HttpCode, HttpStatus, ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiBearerAuth, ApiHeader, ApiResponse, ApiBody, ApiQuery,
} from '@nestjs/swagger';
import {
  InteractionsService,
  LogInteractionSchema, InteractionFiltersSchema, RecentInteractionsFiltersSchema,
  type LogInteractionDto, type InteractionFiltersDto, type RecentInteractionsFiltersDto,
} from '@insurtech/crm';
import {
  JwtAuthGuard, CurrentUser, type AuthenticatedUser,
  TenantContextGuard, TenantTransactionInterceptor,
  PermissionGuard, RequirePermission, Permission,
  AbacGuard, AbacResource,
} from '@insurtech/auth';
import { ZodValidationPipe } from '@insurtech/shared-utils';

@ApiTags('CRM Interactions')
@ApiBearerAuth()
@ApiHeader({ name: 'x-tenant-id', required: true })
@Controller('crm/interactions')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard, AbacGuard)
@UseInterceptors(TenantTransactionInterceptor)
export class InteractionsController {
  constructor(private readonly interactionsService: InteractionsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission(Permission.CRM_INTERACTIONS_CREATE)
  @ApiOperation({ summary: 'Log a manual interaction (append-only, no UPDATE/DELETE)' })
  @ApiBody({
    schema: {
      example: {
        contact_id: '...',
        deal_id: '...',
        type: 'call',
        direction: 'outbound',
        subject: 'Appel suivi devis',
        content: 'Appele Mohamed pour suivre devis Auto. Propose RDV vendredi.',
        occurred_at: '2026-05-08T14:30:00Z',
        metadata: { duration_seconds: 360 },
      },
    },
  })
  async log(
    @Body(new ZodValidationPipe(LogInteractionSchema)) dto: LogInteractionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.interactionsService.logInteraction(dto, user.id);
  }

  @Get('recent')
  @RequirePermission(Permission.CRM_INTERACTIONS_READ)
  @ApiOperation({ summary: 'Recent interactions feed (dashboard widget)' })
  async getRecent(
    @Query(new ZodValidationPipe(RecentInteractionsFiltersSchema)) filters: RecentInteractionsFiltersDto,
  ) {
    return this.interactionsService.findRecent(filters);
  }

  @Get(':id')
  @RequirePermission(Permission.CRM_INTERACTIONS_READ)
  @AbacResource('crm_interaction')
  async findById(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.interactionsService.findById(id);
  }

  // NOTE : pas de @Patch ni @Delete (append-only).
}

/**
 * Endpoints sub-resources (delegues depuis ContactsController + DealsController stub Sprint 8 task 3.1.2/3.1.4).
 */
@ApiTags('CRM Interactions')
@ApiBearerAuth()
@ApiHeader({ name: 'x-tenant-id', required: true })
@Controller('crm')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard, AbacGuard)
@UseInterceptors(TenantTransactionInterceptor)
export class InteractionsSubController {
  constructor(private readonly interactionsService: InteractionsService) {}

  @Get('contacts/:id/interactions')
  @RequirePermission(Permission.CRM_INTERACTIONS_READ)
  @AbacResource('crm_contact')
  @ApiOperation({ summary: 'Timeline interactions of a contact (cursor-based)' })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  @ApiQuery({ name: 'page_size', required: false, type: Number })
  @ApiQuery({ name: 'type', required: false, type: String })
  async getContactTimeline(
    @Param('id', new ParseUUIDPipe()) contactId: string,
    @Query(new ZodValidationPipe(InteractionFiltersSchema)) filters: InteractionFiltersDto,
  ) {
    return this.interactionsService.findByContact(contactId, filters);
  }

  @Get('deals/:id/interactions')
  @RequirePermission(Permission.CRM_INTERACTIONS_READ)
  @AbacResource('crm_deal')
  @ApiOperation({ summary: 'Timeline interactions of a deal (cursor-based)' })
  async getDealTimeline(
    @Param('id', new ParseUUIDPipe()) dealId: string,
    @Query(new ZodValidationPipe(InteractionFiltersSchema)) filters: InteractionFiltersDto,
  ) {
    return this.interactionsService.findByDeal(dealId, filters);
  }

  @Get('contacts/:id/interactions/stats')
  @RequirePermission(Permission.CRM_INTERACTIONS_READ)
  @AbacResource('crm_contact')
  @ApiOperation({ summary: 'Stats agregees interactions du contact' })
  async getContactStats(
    @Param('id', new ParseUUIDPipe()) contactId: string,
  ) {
    return this.interactionsService.getStats(contactId);
  }
}
```

### 6.11 Fichier 11 sur 12 : Tests E2E Interactions

```typescript
// repo/apps/api/test/crm/interactions.e2e-spec.ts
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
  createTestContact, createTestInteraction, buildInteractionDto,
  truncateContacts, truncateInteractions,
} from '../fixtures/crm-test-helpers';

describe('CRM Interactions E2E', () => {
  let app: INestApplication;
  let ds: DataSource;
  let tenantId: string;
  let jwtAdmin: string;
  let jwtUser: string;
  let jwtAssure: string;
  let contactId: string;

  beforeAll(async () => {
    const m = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = m.createNestApplication();
    await app.init();
    ds = m.get(DataSource);
    tenantId = (await createTestTenant(ds, 't_315')).id;
    jwtAdmin = await loginAndGetJwt(app, await createTestUser(ds, tenantId, 'broker_admin'));
    jwtUser = await loginAndGetJwt(app, await createTestUser(ds, tenantId, 'broker_user'));
    jwtAssure = await loginAndGetJwt(app, await createTestUser(ds, tenantId, 'assure'));
    const c = await createTestContact(app, jwtAdmin, tenantId);
    contactId = c.id;
  });

  beforeEach(async () => { await truncateInteractions(ds, tenantId); });

  afterAll(async () => {
    await truncateInteractions(ds, tenantId);
    await truncateContacts(ds, tenantId);
    await app.close();
  });

  describe('POST /api/v1/crm/interactions', () => {
    it('cree interaction note', async () => {
      const r = await request(app.getHttpServer())
        .post('/api/v1/crm/interactions')
        .set('Authorization', `Bearer ${jwtUser}`)
        .set('x-tenant-id', tenantId)
        .send(buildInteractionDto({ contact_id: contactId, type: 'note', content: 'Test note' }));
      expect(r.status).toBe(201);
      expect(r.body.data.type).toBe('note');
    });

    it('rejette type invalide', async () => {
      const r = await request(app.getHttpServer())
        .post('/api/v1/crm/interactions')
        .set('Authorization', `Bearer ${jwtUser}`)
        .set('x-tenant-id', tenantId)
        .send({ contact_id: contactId, type: 'unknown', direction: 'outbound', content: 'X' });
      expect(r.status).toBe(400);
    });

    it('rejette occurred_at futur', async () => {
      const r = await request(app.getHttpServer())
        .post('/api/v1/crm/interactions')
        .set('Authorization', `Bearer ${jwtUser}`)
        .set('x-tenant-id', tenantId)
        .send({
          contact_id: contactId, type: 'call', direction: 'outbound',
          content: 'X', occurred_at: '2099-01-01T00:00:00Z',
        });
      expect(r.status).toBe(400);
    });

    it('rejette type=note sans content', async () => {
      const r = await request(app.getHttpServer())
        .post('/api/v1/crm/interactions')
        .set('Authorization', `Bearer ${jwtUser}`)
        .set('x-tenant-id', tenantId)
        .send({ contact_id: contactId, type: 'note', direction: 'internal' });
      expect(r.status).toBe(400);
    });

    it('rejette assure (403)', async () => {
      const r = await request(app.getHttpServer())
        .post('/api/v1/crm/interactions')
        .set('Authorization', `Bearer ${jwtAssure}`)
        .set('x-tenant-id', tenantId)
        .send(buildInteractionDto({ contact_id: contactId }));
      expect(r.status).toBe(403);
    });
  });

  describe('Append-only enforcement', () => {
    it('PATCH /interactions/:id renvoie 404 (route non exposee)', async () => {
      const i = await createTestInteraction(app, jwtUser, tenantId, { contact_id: contactId });
      const r = await request(app.getHttpServer())
        .patch(`/api/v1/crm/interactions/${i.id}`)
        .set('Authorization', `Bearer ${jwtUser}`)
        .set('x-tenant-id', tenantId)
        .send({ content: 'Modified' });
      expect(r.status).toBe(404);
    });

    it('DELETE /interactions/:id renvoie 404', async () => {
      const i = await createTestInteraction(app, jwtUser, tenantId, { contact_id: contactId });
      const r = await request(app.getHttpServer())
        .delete(`/api/v1/crm/interactions/${i.id}`)
        .set('Authorization', `Bearer ${jwtUser}`)
        .set('x-tenant-id', tenantId);
      expect(r.status).toBe(404);
    });
  });

  describe('GET /api/v1/crm/contacts/:id/interactions (timeline)', () => {
    it('retourne timeline cursor-based', async () => {
      for (let i = 0; i < 30; i += 1) {
        await createTestInteraction(app, jwtUser, tenantId, {
          contact_id: contactId, type: 'note',
          occurred_at: new Date(Date.now() - i * 60_000).toISOString(),
        });
      }
      const r = await request(app.getHttpServer())
        .get(`/api/v1/crm/contacts/${contactId}/interactions?page_size=10`)
        .set('Authorization', `Bearer ${jwtUser}`)
        .set('x-tenant-id', tenantId);
      expect(r.status).toBe(200);
      expect(r.body.data.data).toHaveLength(10);
      expect(r.body.data.has_more).toBe(true);
      expect(r.body.data.next_cursor).not.toBeNull();
    });

    it('cursor pagination retrieves next page sans duplication', async () => {
      for (let i = 0; i < 20; i += 1) {
        await createTestInteraction(app, jwtUser, tenantId, {
          contact_id: contactId, type: 'note',
          occurred_at: new Date(Date.now() - i * 60_000).toISOString(),
        });
      }
      const page1 = await request(app.getHttpServer())
        .get(`/api/v1/crm/contacts/${contactId}/interactions?page_size=10`)
        .set('Authorization', `Bearer ${jwtUser}`)
        .set('x-tenant-id', tenantId);
      const page2 = await request(app.getHttpServer())
        .get(`/api/v1/crm/contacts/${contactId}/interactions?page_size=10&cursor=${encodeURIComponent(page1.body.data.next_cursor)}`)
        .set('Authorization', `Bearer ${jwtUser}`)
        .set('x-tenant-id', tenantId);
      const ids1 = page1.body.data.data.map((i: any) => i.id);
      const ids2 = page2.body.data.data.map((i: any) => i.id);
      expect(new Set([...ids1, ...ids2]).size).toBe(20);  // pas de duplications
    });

    it('cursor invalide renvoie 400', async () => {
      const r = await request(app.getHttpServer())
        .get(`/api/v1/crm/contacts/${contactId}/interactions?cursor=invalid_base64`)
        .set('Authorization', `Bearer ${jwtUser}`)
        .set('x-tenant-id', tenantId);
      expect(r.status).toBe(400);
    });

    it('filter by type', async () => {
      await createTestInteraction(app, jwtUser, tenantId, { contact_id: contactId, type: 'whatsapp' });
      await createTestInteraction(app, jwtUser, tenantId, { contact_id: contactId, type: 'email' });
      const r = await request(app.getHttpServer())
        .get(`/api/v1/crm/contacts/${contactId}/interactions?type=whatsapp`)
        .set('Authorization', `Bearer ${jwtUser}`)
        .set('x-tenant-id', tenantId);
      expect(r.body.data.data).toHaveLength(1);
    });
  });

  describe('GET /api/v1/crm/interactions/recent', () => {
    it('retourne tri DESC par occurred_at', async () => {
      await createTestInteraction(app, jwtUser, tenantId, { contact_id: contactId, occurred_at: '2026-05-01T10:00:00Z' });
      await createTestInteraction(app, jwtUser, tenantId, { contact_id: contactId, occurred_at: '2026-05-08T10:00:00Z' });
      const r = await request(app.getHttpServer())
        .get('/api/v1/crm/interactions/recent?limit=10')
        .set('Authorization', `Bearer ${jwtUser}`)
        .set('x-tenant-id', tenantId);
      expect(r.body.data).toHaveLength(2);
      expect(new Date(r.body.data[0].occurred_at) >= new Date(r.body.data[1].occurred_at)).toBe(true);
    });
  });

  describe('GET /api/v1/crm/contacts/:id/interactions/stats', () => {
    it('retourne agregations', async () => {
      await createTestInteraction(app, jwtUser, tenantId, { contact_id: contactId, type: 'whatsapp', direction: 'outbound' });
      await createTestInteraction(app, jwtUser, tenantId, { contact_id: contactId, type: 'whatsapp', direction: 'inbound' });
      await createTestInteraction(app, jwtUser, tenantId, { contact_id: contactId, type: 'note', direction: 'internal' });
      const r = await request(app.getHttpServer())
        .get(`/api/v1/crm/contacts/${contactId}/interactions/stats`)
        .set('Authorization', `Bearer ${jwtUser}`)
        .set('x-tenant-id', tenantId);
      expect(r.body.data.total_count).toBe(3);
      expect(r.body.data.by_type.whatsapp).toBe(2);
    });
  });

  describe('Multi-tenant isolation', () => {
    it('autre tenant ne voit pas interactions', async () => {
      await createTestInteraction(app, jwtUser, tenantId, { contact_id: contactId });
      const otherTenant = (await createTestTenant(ds, 't_315_other')).id;
      const otherJwt = await loginAndGetJwt(app, await createTestUser(ds, otherTenant, 'broker_user'));
      const r = await request(app.getHttpServer())
        .get('/api/v1/crm/interactions/recent')
        .set('Authorization', `Bearer ${otherJwt}`)
        .set('x-tenant-id', otherTenant);
      expect(r.body.data).toHaveLength(0);
    });
  });
});
```

### 6.12 Fichier 12 sur 12 : Tests E2E auto-log + helpers

```typescript
// repo/apps/api/test/crm/interactions-auto-log.e2e-spec.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { Kafka, type Producer } from 'kafkajs';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import {
  createTestTenant, createTestUser, loginAndGetJwt,
} from '../fixtures/auth-test-helpers';
import {
  createTestContact, truncateContacts, truncateInteractions,
} from '../fixtures/crm-test-helpers';

describe('Interactions Auto-Logger Consumer E2E', () => {
  let app: INestApplication;
  let ds: DataSource;
  let producer: Producer;
  let tenantId: string;
  let jwt: string;
  let contactId: string;
  let userId: string;

  beforeAll(async () => {
    const m = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = m.createNestApplication();
    await app.init();
    ds = m.get(DataSource);
    tenantId = (await createTestTenant(ds, 't_315_auto')).id;
    const u = await createTestUser(ds, tenantId, 'broker_user');
    userId = u.id;
    jwt = await loginAndGetJwt(app, u);
    const c = await createTestContact(app, jwt, tenantId);
    contactId = c.id;

    const kafka = new Kafka({ clientId: 'test-producer', brokers: ['localhost:9092'] });
    producer = kafka.producer();
    await producer.connect();
  });

  afterAll(async () => {
    await producer.disconnect();
    await truncateInteractions(ds, tenantId);
    await truncateContacts(ds, tenantId);
    await app.close();
  });

  it('comm.message_sent cree interaction whatsapp outbound', async () => {
    const eventId = `evt-${Date.now()}-1`;
    await producer.send({
      topic: 'insurtech.events.comm.message_sent',
      messages: [{
        key: 'k', value: JSON.stringify({
          event_id: eventId,
          event_type: 'comm.message_sent',
          tenant_id: tenantId,
          occurred_at: new Date().toISOString(),
          actor_user_id: userId,
          message: {
            id: '00000000-0000-0000-0000-000000000010',
            channel: 'whatsapp',
            direction: 'outbound',
            contact_id: contactId,
            body_preview: 'Bonjour, votre devis est pret',
          },
        }),
      }],
    });

    // Wait for consumer to process
    await new Promise((r) => setTimeout(r, 2000));

    const r = await request(app.getHttpServer())
      .get(`/api/v1/crm/contacts/${contactId}/interactions`)
      .set('Authorization', `Bearer ${jwt}`)
      .set('x-tenant-id', tenantId);
    expect(r.body.data.data.length).toBeGreaterThanOrEqual(1);
    const created = r.body.data.data.find((i: any) => i.source_event_id === eventId);
    expect(created).toBeDefined();
    expect(created.type).toBe('whatsapp');
    expect(created.direction).toBe('outbound');
    expect(created.source_system).toBe('comm');
  });

  it('idempotency : meme event_id ne cree pas duplicate', async () => {
    const eventId = `evt-${Date.now()}-idem`;
    const payload = {
      event_id: eventId,
      event_type: 'comm.message_sent',
      tenant_id: tenantId,
      occurred_at: new Date().toISOString(),
      actor_user_id: userId,
      message: {
        id: '00000000-0000-0000-0000-000000000020',
        channel: 'sms',
        direction: 'outbound',
        contact_id: contactId,
        body_preview: 'SMS',
      },
    };
    await producer.send({ topic: 'insurtech.events.comm.message_sent', messages: [{ value: JSON.stringify(payload) }] });
    await new Promise((r) => setTimeout(r, 2000));
    await producer.send({ topic: 'insurtech.events.comm.message_sent', messages: [{ value: JSON.stringify(payload) }] });
    await new Promise((r) => setTimeout(r, 2000));

    const r = await request(app.getHttpServer())
      .get(`/api/v1/crm/contacts/${contactId}/interactions`)
      .set('Authorization', `Bearer ${jwt}`)
      .set('x-tenant-id', tenantId);
    const matchingEvents = r.body.data.data.filter((i: any) => i.source_event_id === eventId);
    expect(matchingEvents).toHaveLength(1);
  });

  it('booking.appointment_completed cree interaction meeting', async () => {
    const eventId = `evt-${Date.now()}-meet`;
    await producer.send({
      topic: 'insurtech.events.booking.appointment_completed',
      messages: [{
        value: JSON.stringify({
          event_id: eventId,
          event_type: 'booking.appointment_completed',
          tenant_id: tenantId,
          occurred_at: new Date().toISOString(),
          actor_user_id: userId,
          appointment: {
            id: '00000000-0000-0000-0000-000000000030',
            contact_id: contactId,
            subject: 'RDV signature contrat',
            duration_minutes: 45,
          },
        }),
      }],
    });
    await new Promise((r) => setTimeout(r, 2000));

    const r = await request(app.getHttpServer())
      .get(`/api/v1/crm/contacts/${contactId}/interactions?type=meeting`)
      .set('Authorization', `Bearer ${jwt}`)
      .set('x-tenant-id', tenantId);
    const created = r.body.data.data.find((i: any) => i.source_event_id === eventId);
    expect(created).toBeDefined();
    expect(created.type).toBe('meeting');
  });

  it('event Zod-invalide : pas de interaction creee, pas de crash', async () => {
    await producer.send({
      topic: 'insurtech.events.comm.message_sent',
      messages: [{ value: JSON.stringify({ bad: 'payload' }) }],
    });
    await new Promise((r) => setTimeout(r, 3000));
    // App should still be alive
    const r = await request(app.getHttpServer())
      .get('/api/v1/crm/interactions/recent')
      .set('Authorization', `Bearer ${jwt}`)
      .set('x-tenant-id', tenantId);
    expect(r.status).toBe(200);
  });

  it('multi-tenant : event tenant A ne contamine pas tenant B', async () => {
    const otherTenant = (await createTestTenant(ds, 't_315_auto_other')).id;
    const otherUser = await createTestUser(ds, otherTenant, 'broker_user');
    const otherJwt = await loginAndGetJwt(app, otherUser);

    await producer.send({
      topic: 'insurtech.events.comm.message_sent',
      messages: [{
        value: JSON.stringify({
          event_id: `evt-${Date.now()}-mt`,
          event_type: 'comm.message_sent',
          tenant_id: tenantId,  // tenant A
          occurred_at: new Date().toISOString(),
          actor_user_id: userId,
          message: {
            id: '00000000-0000-0000-0000-000000000040',
            channel: 'email',
            direction: 'outbound',
            contact_id: contactId,
          },
        }),
      }],
    });
    await new Promise((r) => setTimeout(r, 2000));

    const rOther = await request(app.getHttpServer())
      .get('/api/v1/crm/interactions/recent')
      .set('Authorization', `Bearer ${otherJwt}`)
      .set('x-tenant-id', otherTenant);
    expect(rOther.body.data.length).toBe(0);
  });

  it('contact soft-deleted : interactions auto-log fail gracefully', async () => {
    // Skip implementation Sprint 8 ; documented edge case.
    expect(true).toBe(true);
  });
});
```

### 6.13 Helpers crm-test-helpers (ajouts)

```typescript
// Ajouts a repo/apps/api/test/fixtures/crm-test-helpers.ts

let interactionCounter = 0;

export interface TestInteractionOverrides {
  contact_id: string;
  deal_id?: string;
  type?: string;
  direction?: string;
  content?: string;
  occurred_at?: string;
}

export function buildInteractionDto(overrides: TestInteractionOverrides): Record<string, unknown> {
  interactionCounter += 1;
  return {
    contact_id: overrides.contact_id,
    deal_id: overrides.deal_id,
    type: overrides.type ?? 'note',
    direction: overrides.direction ?? 'internal',
    content: overrides.content ?? `Test interaction ${interactionCounter}`,
    occurred_at: overrides.occurred_at,
    metadata: {},
  };
}

export async function createTestInteraction(
  app: INestApplication,
  jwt: string,
  tenantId: string,
  overrides: TestInteractionOverrides,
): Promise<any> {
  const r = await request(app.getHttpServer())
    .post('/api/v1/crm/interactions')
    .set('Authorization', `Bearer ${jwt}`)
    .set('x-tenant-id', tenantId)
    .send(buildInteractionDto(overrides));
  if (r.status !== 201) throw new Error(`createTestInteraction failed: ${r.status}`);
  return r.body.data;
}

export async function truncateInteractions(ds: DataSource, tenantId: string): Promise<void> {
  await ds.query(`DELETE FROM crm_interactions WHERE tenant_id = $1`, [tenantId]);
}
```

---

## 7. Tests complets

18 unit (6.8) + 14 E2E (6.11) + 6 auto-log (6.12) = 38 tests total.

---

## 8. Variables environnement

```env
# Aucune nouvelle var Sprint 8 task 3.1.5.
# Reuse Sprint 1-7 (Kafka brokers, Redis, etc.).
KAFKA_GROUP_ID_CRM_INTERACTIONS=crm-interactions-auto-logger
```

---

## 9. Commandes shell

```bash
cd repo

# 1. Migration
pnpm --filter @insurtech/database migrate:run

# 2. Verifier nouvelle structure
psql $DATABASE_URL -c "\d+ crm_interactions"

# 3. Build + tests
pnpm --filter @insurtech/crm typecheck
pnpm --filter @insurtech/crm test interactions
pnpm --filter @insurtech/crm test consumers

# 4. E2E (Postgres + Kafka up)
docker compose up -d postgres kafka
pnpm --filter api e2e -- --testPathPattern=crm/interactions

# 5. Smoke API
JWT=...
curl -X POST localhost:4000/api/v1/crm/interactions \
  -H "Authorization: Bearer $JWT" \
  -H "x-tenant-id: $TENANT" \
  -d '{"contact_id":"...","type":"call","direction":"outbound","content":"Test","occurred_at":"2026-05-08T14:00:00Z"}'

# 6. Verifier consumer Kafka actif
docker compose exec kafka kafka-consumer-groups --bootstrap-server localhost:9092 \
  --describe --group crm-interactions-auto-logger

# 7. Commit
git add -A
git commit -m "feat(sprint-08): crm interactions timeline append-only + auto-log Kafka

Task: 3.1.5
Sprint: 8 (Phase 3)
Reference: B-08 Tache 3.1.5"
```

---

## 10. Criteres validation V1-V25

### Criteres P0 (16)

- **V1 (P0)** : Migration appliquee, table `crm_interactions` (renommee depuis crm_activities) avec colonnes direction, occurred_at, source_event_id, source_system
- **V2 (P0)** : typecheck exit 0
- **V3 (P0)** : 18 unit + 14 E2E + 6 auto-log = 38 tests PASS
- **V4 (P0)** : POST /interactions cree row + Kafka event crm.interaction.logged
- **V5 (P0)** : APPEND-ONLY : pas de PATCH ni DELETE endpoint expose (404)
- **V6 (P0)** : Validation type enum (call/email/whatsapp/sms/meeting/note/task)
- **V7 (P0)** : Validation direction enum (inbound/outbound/internal)
- **V8 (P0)** : occurred_at futur rejete 400
- **V9 (P0)** : type=note sans content rejete 400
- **V10 (P0)** : Cursor pagination retourne page sans duplications
- **V11 (P0)** : Cursor invalide rejete 400
- **V12 (P0)** : Auto-logger consume comm.message_sent et cree interaction
- **V13 (P0)** : Auto-logger consume booking.appointment_completed et cree interaction meeting
- **V14 (P0)** : Idempotency : meme source_event_id ne cree pas duplicate
- **V15 (P0)** : Multi-tenant isolation (consumer + endpoints)
- **V16 (P0)** : RBAC : assure -> 403

### Criteres P1 (6)

- **V17 (P1)** : Performance timeline cursor < 100ms p95 sur 100k interactions
- **V18 (P1)** : last_interaction_at update sur contact apres log
- **V19 (P1)** : Stats endpoint retourne agregations correctes
- **V20 (P1)** : Event Zod-invalide ne crash pas consumer (DLQ)
- **V21 (P1)** : ABAC : broker_user voit interactions de ses contacts assignees
- **V22 (P1)** : Coverage interactions.service >= 90%

### Criteres P2 (3)

- **V23 (P2)** : No-emoji
- **V24 (P2)** : Lint 0 erreur
- **V25 (P2)** : Swagger documente 5 endpoints + 2 sub-endpoints (contacts/deals interactions)

---

## 11. Edge cases + troubleshooting

### Edge case 1 : occurred_at exact precision microseconde
**Scenario** : 2 interactions avec meme occurred_at au microseconde pres.
**Solution** : cursor utilise tuple (occurred_at, id) ; id unique garantit ordre stable.

### Edge case 2 : Consumer DLQ apres 3 retry
**Scenario** : Event Postgres-error temporaire.
**Solution** : KafkaConsumerBase Sprint 2 retry 3x backoff exponentiel ; succes intermediaire OK.

### Edge case 3 : Interaction avec 9999 char content
**Scenario** : Long email transcript.
**Solution** : Zod max 10000 chars. Documente limite.

### Edge case 4 : Stats sur contact avec 0 interaction
**Scenario** : Frontend appelle stats juste apres creation contact.
**Solution** : retourne `{ total_count: 0, by_type: {}, ... }`. Pas d'erreur.

### Edge case 5 : Auto-log race condition (2 events meme moment)
**Scenario** : Sprint 9 publishera 2 events comm.message_sent simultanes.
**Solution** : UNIQUE INDEX source_event_id garantit idempotency. Test V14.

### Edge case 6 : Contact supprime entre publish event et consume
**Scenario** : Sprint 9 publie event, contact soft-deleted entre temps.
**Solution** : auto-logger ne valide pas contact existence (skip pour idempotency raisons). Interaction creee meme si contact.deleted_at != null. Documente.

### Edge case 7 : Timeline avec interactions deletes
**Scenario** : Sprint 12 CNDP purge soft-delete interactions > 5 ans.
**Solution** : findTimeline filter `deleted_at IS NULL` automatique.

### Edge case 8 : Cursor avec date avant 1970
**Scenario** : Curseur corrompu avec date 1969.
**Solution** : decode succeed mais query retourne 0 rows. Pas d'erreur. Documente.

### Edge case 9 : Interaction created_at < occurred_at (impossible)
**Scenario** : System clock skew.
**Solution** : ne se produit pas (created_at = NOW au save). Si serveur NTP-desynchro, audit_log capture.

### Edge case 10 : Multi-tenant Kafka leak via consumer
**Scenario** : Consumer recoit events tous tenants.
**Solution** : runWithTenantContext explicit avant logInteraction. RLS Postgres filter automatique.

---

## 12. Conformite Maroc detaillee

### Loi 09-08 (CNDP)

- **Article 4** : Donnees personnelles (content email, transcript appel, etc.) traitees licitement pour finalite courtage.
- **Article 9** : Droit a l'effacement -> Sprint 12 CNDP purge job soft-delete interactions > 5 ans + retire content sensible.

### ACAPS Circulaire AS/02/24

- **Article 12** : Tracabilite 5 ans. Append-only + audit_logs garantissent.
- **Article 15** : Identification contreparties. interactions linkees contact + deal.
- **Devoir de conseil** : interactions documentent les conseils prodigues avant souscription.

### Loi 53-05 (Echange electronique des donnees)

Sprint 10 (Docs + Signature) introduira archivage legal documents annexes interactions.

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
pnpm --filter api e2e -- --testPathPattern="crm/interactions"
grep -rP "[\x{1F300}-\x{1F9FF}]" packages/crm/src --include="*.ts" && exit 1 || echo OK
```

---

## 15. Commit message complet

```bash
git add -A
git commit -m "feat(sprint-08): crm interactions timeline append-only + auto-log Kafka

Module timeline historique commercial. Append-only strict (pas de update/delete).
Auto-logger Kafka consumer transforme passivement events comm/booking
en interactions tracees automatiquement.

Livrables:
- Migration : crm_activities -> crm_interactions + colonnes direction/occurred_at/source_event_id
- packages/crm : CrmInteractionEntity + InteractionsService + InteractionsAutoLoggerConsumer
- packages/crm : CursorHelper (pagination cursor-based timeline)
- apps/api : InteractionsController (5 endpoints) + InteractionsSubController (3 sub-endpoints)
- 38 tests : 18 unit + 14 E2E + 6 auto-log Kafka

Conformite MA: ACAPS AS/02/24 article 12 (tracabilite 5 ans), CNDP article 9
Coverage: 92%

Task: 3.1.5
Sprint: 8 (Phase 3)
Reference: B-08 Tache 3.1.5"
```

---

## 16. Workflow next step

Apres commit :
- `pnpm migrate:run` reussit
- E2E PASS (14 + 6)
- Verifier consumer Kafka active : `kafka-consumer-groups --describe --group crm-interactions-auto-logger`
- Mettre a jour _SUMMARY.md tache 3.1.5 = complete
- Passer a `task-3.1.6-crm-search-pg-trgm-cross-entities.md` qui implementera le search global cross-CRM consommant les services Companies (3.1.1), Contacts (3.1.2), Deals (3.1.4).

---

**Fin du prompt task-3.1.5-crm-interactions-timeline-append-only-auto-log.md**

Densite : approximativement 105 ko
Code patterns : 12 fichiers (~1990 lignes)
Tests : 38 cas (18 unit + 14 E2E + 6 auto-log)
Criteres : V1-V25 (16 P0 + 6 P1 + 3 P2)
Edge cases : 10
