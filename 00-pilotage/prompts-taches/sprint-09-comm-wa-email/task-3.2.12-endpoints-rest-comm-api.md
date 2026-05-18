# TACHE 3.2.12 -- Endpoints REST `/api/v1/comm/*` : Controllers Messages + Templates + Stats + Preferences + Optouts (RBAC + Multi-tenant + Pagination Cursor + Swagger OpenAPI)

**Sprint** : 9 (Phase 3 / Sprint 2 dans phase) -- Communications WhatsApp + Email
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-09-sprint-09-comm-wa-email.md` (Tache 3.2.12)
**Phase** : 3 -- Modules Horizontaux
**Priorite** : P0 (bloquant pour Tache 3.2.13 tests E2E exhaustifs + Sprint 17 Comm vertical consume + Sprint 18 Customer Portal + Sprint 27 Admin UI templates Meta + tous flows utilisateur communications)
**Effort** : 4h
**Dependances** : 3.2.11 (OptoutService consomme par MessageOrchestrator + endpoint public `/api/v1/public/optout/*`), 3.2.10 (DeliveryTrackingService + comm-stats endpoint draft), 3.2.9 (MessageOrchestrator orchestrate routing canal), 3.2.5 (TemplateManager service + workflow Meta), 3.2.1 (entites + schemas Zod), Sprint 7 (RBAC `@RequirePermission` decorator + `RequirePermissionGuard`), Sprint 6 (TenantContext middleware + multi-tenant isolation), Sprint 5 (JwtAuthGuard + AuthUser injection), Sprint 3 (ResponseInterceptor format `{ success, data, meta, errors }` + ZodValidationPipe + IdempotencyMiddleware + RateLimit middleware + ExceptionFilter coherent)
**Densite cible** : 125-140 ko (auto-suffisant exhaustif)
**AUCUNE EMOJI AUTORISEE**

---

## 1. But

Cette tache vise a livrer la couche d'exposition REST complete et operationnelle du module `comm` du programme Skalean InsurTech v2.2 qui implemente l'integralite des endpoints `/api/v1/comm/*` consommes par les frontends Sprint 4 (Operator UI broker), Sprint 18 (Customer Portal assure), Sprint 27 (Admin UI super_admin platform), Sprint 17+ (modules verticaux Comm, Insure, Repair, Books) et les integrations partenaires Sprint 30+. Le perimetre couvre cinq controllers principaux : (a) `messages.controller.ts` exposant `POST /api/v1/comm/messages/send` (envoi unitaire orchestrate via Tache 3.2.9 avec body `{ contactId, templateName, locale?, variables, options? }`), `POST /api/v1/comm/messages/send-batch` (envoi batch jusqu'a 1000 items via array de SendItem), `POST /api/v1/comm/messages/send-broadcast` (campaign marketing async avec filters Sprint 8 CRM + template + reponse 202 Accepted + jobId pour tracking), `GET /api/v1/comm/messages` (liste paginee cursor-based avec filtres `channel | direction | status | contact_id | template_id | date_from | date_to | search`), `GET /api/v1/comm/messages/:id` (detail single message avec multi-tenant isolation strict), `GET /api/v1/comm/messages/:id/timeline` (events ordered sent/queued/delivered/read/failed/clicked/opened depuis Tache 3.2.10), `DELETE /api/v1/comm/messages/:id` (soft-delete super_admin only avec preservation audit CNDP 7 ans Sprint 35) ; (b) `templates.controller.ts` exposant `GET /api/v1/comm/templates` (list paginated multi-tenant), `POST /api/v1/comm/templates` (create draft), `GET /api/v1/comm/templates/:id`, `PUT /api/v1/comm/templates/:id` (update only if status=draft), `DELETE /api/v1/comm/templates/:id` (soft-delete + reject 409 si template in-use referenced par comm_messages), `POST /api/v1/comm/templates/:id/submit` (workflow submit Meta approval via Tache 3.2.5 TemplateManager), `GET /api/v1/comm/templates/meta-status` (sync states approved/rejected/pending depuis Meta Business Platform) ; (c) `comm-stats.controller.ts` exposant `GET /api/v1/comm/stats?period=7d|30d|90d` (aggregates delivery_rate / bounce_rate / open_rate / click_rate via DeliveryTrackingService Tache 3.2.10), `GET /api/v1/comm/stats/by-template` (top templates par engagement), `GET /api/v1/comm/stats/by-channel` (split WhatsApp vs Email) ; (d) `comm-preferences.controller.ts` exposant `GET /api/v1/comm/preferences` (auth user voit ses propres preferences), `PUT /api/v1/comm/preferences` (update preferred_channel + preferred_language + frequency caps), `GET /api/v1/comm/preferences/contact/:id` (admin lookup contact preferences scope tenant) ; (e) `optout.controller.ts` (deja Tache 3.2.11 mais reference + RBAC complet super_admin platform-only).

L'apport est multiple. Premierement, en imposant le format de response standardise `{ success, data, meta, errors }` herite du `ResponseInterceptor` Sprint 3 (Tache 1.3.7) sur 100% des endpoints comm, on garantit qu'aucun consumer frontend ne doit ecrire de parser per-endpoint : un appel `GET /api/v1/comm/messages` retourne `{ success: true, data: [...messages], meta: { pagination: { cursor, hasMore, limit }, tenantId, requestId, traceId, timestamp, version }, errors: [] }`, tandis que `POST /api/v1/comm/messages/send` retourne `{ success: true, data: { messageId, channel, status }, meta: {...}, errors: [] }` -- un seul `extractData<T>(response)` parser pour toutes les ressources. Deuxiemement, en utilisant la pagination cursor base64-encoded `{lastId}_{lastSentAt}` (vs offset-based fragile sur tables qui croissent rapidement comme `comm_messages` qui peut atteindre 10M+ rows pour un broker actif), on garantit une stabilite des pages meme si de nouveaux messages sont inserees entre deux requetes : la cursor encode la position exacte `(sent_at DESC, id DESC)` et le query suivant est `WHERE (sent_at, id) < (cursor.sent_at, cursor.id) ORDER BY sent_at DESC, id DESC LIMIT 20`, perf O(log n) avec index composite vs offset-based O(n) qui doit scanner toutes les rows sautees. Limite max `limit=100`, default `limit=20`. Troisiemement, en imposant le multi-tenant isolation strict via TenantContext middleware (Sprint 6) qui injecte `req.tenant_id` depuis le JWT `tenant_id` claim (verifie + signature checked Sprint 5), tous les queries DB sont automatiquement filtrees par `WHERE tenant_id = $1`, garantissant qu'un broker_admin du tenant A ne peut JAMAIS voir les messages du tenant B (test E2E isolation explicite avec assertion 404 sur cross-tenant access).

Quatriemement, en exposant le RBAC granular avec decorator `@RequirePermission('comm.messages.send')` qui verifie via le `RequirePermissionGuard` Sprint 7 que l'AuthUser a la permission dans son `permissions[]` array (resolu depuis role assignments + role_permissions), on respecte le principle of least privilege : un broker_user peut envoyer des messages individuels mais PAS broadcast (reserve broker_admin), un garage_admin peut consulter les stats de SES contacts mais PAS lister tous les messages du tenant, un super_admin platform peut soft-delete un message pour CNDP article 27 right-to-erasure mais un broker_admin tenant ne peut pas (audit + escalation requise). Cinquiemement, en generant automatiquement la documentation Swagger OpenAPI 3.1 via decorators `@ApiTags`, `@ApiOperation`, `@ApiResponse`, `@ApiBody`, `@ApiQuery`, `@ApiParam` sur 100% des endpoints + types DTO `createZodDto(SendMessageSchema)` qui synchronisent automatiquement Zod vers JSONSchema OpenAPI, on garantit que `/api/v1/docs` (Swagger UI Sprint 3 Tache 1.3.9) decrit precisement chaque endpoint : path, methodes HTTP, params, body schema, responses 200/201/202/400/401/403/404/409/429, exemples curl. Sixiemement, en exposant des filtres riches sur `GET /api/v1/comm/messages` (`channel`, `direction`, `status`, `contact_id`, `template_id`, `date_from`, `date_to`, `search`), les frontends peuvent construire des UIs riches (dashboard timeline contact, compliance audit search, debugging messages failed) sans necessiter de nouveaux endpoints custom. Le `search` utilise l'extension trigram pg_trgm (Sprint 8 CRM) pour matcher to_address + template_name + body_excerpt avec rank.

Septiemement, en supportant l'`Idempotency-Key` header sur `POST /messages/send` (via `IdempotencyMiddleware` Sprint 3 Tache 1.3.5), un meme `Idempotency-Key` sur 2 requetes consecutives retourne la meme response (pas double-send) : le middleware stocke `(tenant_id, key, response)` 24h dans Redis `idempotency:{tenant_id}:{key}`, la 2eme requete avec meme key + meme body hash retourne le cache, request body hash different = 409 Conflict. Huitiemement, en respectant le rate limiting per-tenant 100/min sur `/messages/send` + 10/min sur `/messages/send-broadcast` (via `RateLimitMiddleware` Sprint 3 + key Redis `ratelimit:comm-send:{tenant_id}`), on protege Meta API quotas (80 msg/sec global per phone_number_id) + on prevente abus broker malveillant tentant flood. Neuviemement, le versioning API explicite via prefix `/api/v1/comm/*` + header optionnel `X-API-Version: 1` permet une migration future Sprint 35+ vers `/api/v2/comm/*` (e.g. graphQL ou breaking changes schema) sans casser les consumers Sprint 4-31.

A l'issue de cette tache, l'API est consommable end-to-end : un curl `POST /api/v1/comm/messages/send` avec body `{ contactId: "ct-uuid-...", templateName: "appointment_reminder_24h", variables: { user_name: "Mohamed", appointment_time: "15:00" } }` headers `Authorization: Bearer <jwt>` + `X-Tenant-Id: tn-uuid-...` + `Idempotency-Key: req-abc-123` retourne en moins de 80ms p99 un `201 Created` avec `{ success: true, data: { messageId: "msg-uuid-...", channel: "whatsapp", status: "queued" }, meta: { traceId, requestId, tenantId, timestamp, version }, errors: [] }`, le job BullMQ wa-send (Tache 3.2.8) recoit le message + Meta API send + status update sent->delivered->read via webhook (Tache 3.2.4) + delivery tracking (Tache 3.2.10) + opt-out check (Tache 3.2.11), un curl `GET /api/v1/comm/messages?channel=whatsapp&status=delivered&contact_id=ct-uuid&limit=20` retourne la liste paginee cursor avec timeline events disponibles, Swagger UI `/api/v1/docs` documente 17 endpoints comm, RBAC respecte 9 permissions, multi-tenant isolation 100% assured, 25+ tests E2E couvrant happy paths + edge cases + multi-tenant + RBAC + pagination + Swagger schema validity + Idempotency + RateLimit, coverage Vitest >= 90% sur les 5 controllers + DTOs + module comm.

---

## 2. Contexte etendu

### 2.1 Pourquoi cette tache existe

Le programme Skalean InsurTech v2.2 expose un module communications riche (WhatsApp Cloud API Meta + Email SMTP + 60 templates 3 locales fr/ar-MA/ar avec RTL + BullMQ queues + delivery tracking + opt-out CNDP) implemente Tache 3.2.1 a 3.2.11. Sans une couche d'exposition REST coherente et standardisee, les consumers (frontends + integrations) ne peuvent pas acceder a ces capacites operationnellement. Les Taches precedentes ont livre les services internes (`MessageOrchestrator`, `TemplateManager`, `OptoutService`, `DeliveryTrackingService`, `WhatsAppCloudApiClient`, `EmailService`) mais aucun controller HTTP ne les expose -- seuls les workers BullMQ + webhooks public consomment ces services en interne.

Sans cette tache, six problemes structurels emergent. Premier probleme : les frontends Sprint 4 (Operator UI broker) ne peuvent pas afficher de timeline de messages contact (CRM Sprint 8 contact 360 view), de dashboard envois (broker_admin home), de UI templates management (Sprint 27 admin Meta workflow). Sans `GET /api/v1/comm/messages` filtree par `contact_id`, l'Operator UI ne sait pas comment recuperer les 50 derniers messages d'un assure -- elle devrait taper SQL direct (anti-pattern grave qui violerait multi-tenant isolation + RBAC + audit). Deuxieme probleme : les modules verticaux Sprint 17 (Comm vertical), Sprint 14+ (Insure -- police signed, payment due reminders), Sprint 20+ (Repair -- sinistre acknowledged, devis ready) ne peuvent pas declencher des envois transactionnels sans endpoint REST. La Tache 3.2.9 expose `MessageOrchestrator.sendToContact` au niveau service (intra-NestJS), mais Sprint 17 vertical web frontend (broker workflow) doit traverser l'API HTTP pour orchestrer un envoi -- sans `POST /api/v1/comm/messages/send`, c'est impossible.

Troisieme probleme : le Customer Portal Sprint 18 (assure self-service) doit permettre a l'utilisateur de gerer ses propres preferences communication (preferred_channel WhatsApp vs Email, preferred_language fr/ar-MA/ar, frequency caps). Sans `GET/PUT /api/v1/comm/preferences`, l'assure ne peut pas exercer son droit CNDP article 6 (consentement granular). Quatrieme probleme : la conformite ACAPS et CNDP impose audit log 7 ans sur tous les messages outbound (Sprint 35 raise from 1 year). Sans `DELETE /api/v1/comm/messages/:id` super_admin only avec soft-delete (`deleted_at` flag preserve la row + audit), exercise du right-to-erasure CNDP article 27 est impossible. Cinquieme probleme : les broker_admin doivent pouvoir lancer des campaigns broadcast (e.g. tous les contacts garages "rappel renouvellement assurance" 1 fois/semaine), avec filters Sprint 8 CRM (contacts.tag includes "garage_partner"). Sans `POST /api/v1/comm/messages/send-broadcast` async, le broker doit creer 1000+ jobs API individuel -- impraticable. Sixieme probleme : la documentation API consommable par developpeurs partenaires (Sprint 30+ MCP server proxy) necessite Swagger OpenAPI 3.1 generee depuis le code (pas un Word doc maintenu manuellement). Sans decorators `@ApiTags`, `@ApiOperation`, `@ApiResponse` sur chaque endpoint, le Sprint 30+ partenaires ne savent pas comment integrer.

L'exigence multi-tenant strict est specifique au modele B2B2C Skalean : ~3000 brokers (tenants) gerent chacun leur propre base de contacts + messages. Une fuite cross-tenant (broker A voit messages broker B) serait catastrophique : violation CNDP loi 09-08 article 4 (proportionnalite), perte confiance + class action courtiers, sanction CNDP jusqu'a 300 000 MAD. Mitigation : middleware `TenantContext` (Sprint 6) injecte `req.tenant_id` automatique depuis JWT verifie, tous les services comm utilisent `getCurrentTenantId()` ALS + tous les queries DB filtrent `WHERE tenant_id = $1` (test E2E explicit verifie cross-tenant 404).

L'exigence pagination cursor (vs offset) est imposee par la table `comm_messages` qui croit rapidement : pour un broker actif moyen (~10 000 messages/mois envoyes, ~500/mois recus), 5 ans d'operation = 660 000 rows. Avec offset 50000, Postgres scanne 50000 rows avant de retourner 20 -- temps de query 500ms+. Avec cursor base64(`{lastId}_{lastSentAt}`) + index composite `(tenant_id, sent_at DESC, id DESC)`, le query est O(log n) constant ~5ms quel que soit la page profondeur.

L'exigence RBAC granular (vs role-based monolithique) est imposee par la diversite des actors : un broker_user (commercial junior) doit pouvoir envoyer des messages individuels dans son scope tenant mais PAS broadcast (reserve broker_admin chef d'agence pour decisions strategiques campaigns), PAS soft-delete (reserve super_admin platform pour CNDP exercise), PAS lookup opt-outs platform-wide (super_admin only -- info sensible). Sprint 7 RBAC implemente `permissions[]` array dans User + `@RequirePermission` decorator qui guard verifie. La granularite Skalean : 9 permissions comm distinctes (`comm.messages.send`, `comm.messages.send_broadcast`, `comm.messages.read`, `comm.messages.delete`, `comm.templates.read`, `comm.templates.manage`, `comm.stats.read`, `comm.preferences.manage`, `comm.optouts.read`).

### 2.2 Alternatives considerees

| Alternative | Avantages | Inconvenients | Decision |
|-------------|-----------|---------------|----------|
| Aucun endpoint REST (services internes seulement) | Simple, juste workers consume orchestrator | Frontends Sprint 4-18-27 + verticaux Sprint 17+ ne peuvent pas trigger envois | REJETE -- inacceptable |
| Endpoints REST inline dans modules verticaux (Insure, Repair) | Decouplage par domain | Duplication code, drift formats, RBAC incoherent | REJETE -- module comm centralise |
| GraphQL (vs REST) | Flexibilite query, single endpoint | Apprentissage equipe, ecosysteme NestJS REST plus mature, Sprint 30+ MCP REST | DEFFERE Sprint 30+ MCP eval |
| REST avec format custom per controller | Liberte | Drift formats catastrophique (cf. Sprint 3 Tache 1.3.7) | REJETE -- ResponseInterceptor impose |
| REST avec format `{ data, meta, errors }` (RETENU) | Standard Sprint 3, coherent | Necessite ResponseInterceptor | RETENU |
| Pagination offset (`?page=N&pageSize=20`) | UX intuitive, navigate to page N | Perf O(n) scale 10M rows, instabilite si insert pendant nav | REJETE pour /messages |
| Pagination cursor base64 (RETENU) | O(log n), stable insert during nav | UX moins intuitive (pas de "page 5") | RETENU pour /messages + /templates |
| Pagination keyset simple (param `?after_id=xxx`) | Simple | Pas stable si tri sur sent_at != id | REJETE -- multi-column needed |
| RBAC role-based (broker_admin = full access) | Simple | Pas granular, broker_user veut send sans broadcast | REJETE -- least privilege |
| RBAC permission-based (RETENU) | Granular, future-proof | 9 permissions a maintenir | RETENU |
| Multi-tenant via path param (`/api/v1/tenants/:tenantId/comm/messages`) | Explicit URL | Verbeux, redondant avec JWT, risque manipulation URL | REJETE -- header X-Tenant-Id + JWT claim |
| Multi-tenant via header X-Tenant-Id | Explicit, override possible super_admin | Confusion si JWT.tenant_id != header | DEFFERE -- super_admin uniquement |
| Multi-tenant via JWT claim `tenant_id` (RETENU) | Securise, auto, audit trail | broker_admin peut voir un seul tenant | RETENU |
| Versioning API via path `/api/v1/comm/*` (RETENU) | Explicit, Sprint 30+ partenaires URL stable | Migration v2 = nouvelle path | RETENU |
| Versioning API via header `X-API-Version` | Compact URL | Confusion si oublie | DEFFERE -- override path |
| Send broadcast sync (wait completion 1000 messages) | Simple frontend | Timeout API gateway 30s, UX bloquee | REJETE -- async 202 |
| Send broadcast async 202 + jobId (RETENU) | UX immediate, scalable | Frontend doit poll jobId status | RETENU |
| Idempotency optional (only POST /send) | Eviter double-send | Frontend oublie key | RETENU optional avec doc clear |
| Idempotency required (header obligatoire) | Garanti pas double | Verbeux, casse curl simple | REJETE -- optional with doc |
| Swagger OpenAPI generation manuel | Controle precis | Duplique effort, drift code/doc | REJETE |
| Swagger OpenAPI generation auto via decorators (RETENU) | Code = source verite | Necessite decorateurs sur tous endpoints | RETENU -- @nestjs/swagger + nestjs-zod |

### 2.3 Trade-offs explicites

Choisir le format response standardise `{ success, data, meta, errors }` (vs `data` brut) implique d'accepter ~80 bytes overhead par response (struct meta avec traceId + requestId + tenantId + timestamp + version + pagination optionnelle). Pour 5000 rps comm sur peak (Sprint 22+), ca represente 400 KB/s soit 35 GB/jour de bande passante supplementaire. Mitigation : compression Brotli (Tache 1.3.5) ramene a ~14 GB/jour, acceptable pour un cluster Atlas Cloud Services Benguerir avec 1 Gbps lien. Le gain en lisibilite + debug + uniformite frontend surclasse largement.

Choisir cursor pagination (vs offset) implique d'accepter une UX moins riche (pas de "Aller a page 5" direct). Mitigation : (a) UX moderne stream/infinite-scroll evite besoin "go to page N", (b) cursor encode position exacte + frontend peut afficher "1-20 sur ~10000" via meta.pagination.estimatedTotal (Sprint 14 enrichira), (c) tris alternatifs (`?sort=delivered_at_desc`) supportes via cursor multi-column. Le gain en perf O(log n) vs O(n) est critique a scale 10M+.

Choisir 9 permissions granulars (vs role-based 5 roles) implique d'accepter complexite : chaque endpoint doit declarer `@RequirePermission(...)` correct + Sprint 27 admin UI doit afficher granular UI assignment. Mitigation : (a) Sprint 7 fournit deja 50+ permissions catalog complet + role templates (broker_admin = 30 permissions auto-assigned), (b) test matrix RBAC E2E couvre 9 x 4 roles = 36 scenarios.

Choisir multi-tenant via JWT claim (vs header) implique d'accepter qu'un super_admin platform doit explicitement override avec `X-Tenant-Id` header (pour debugging cross-tenant). Mitigation : middleware `TenantContext` Sprint 6 implement double check : si AuthUser.role=super_admin AND request header X-Tenant-Id present, override ; sinon JWT claim mandate.

Choisir async broadcast 202 + jobId (vs sync) implique d'accepter complexite frontend (poll jobId status). Mitigation : (a) endpoint `GET /api/v1/comm/jobs/:jobId/status` Sprint 14 helper, (b) Sprint 22+ websocket push notification quand job termine, (c) UX broker_admin tolere "Campaign launched. You'll be notified" pattern.

Choisir Idempotency optional (vs required) implique qu'un client neglige risque double-send. Mitigation : documentation Swagger explicit + Sprint 27 admin UI auto-genere Idempotency-Key cote frontend.

Choisir Swagger OpenAPI generation auto (vs manuel) implique d'accepter dependance @nestjs/swagger + nestjs-zod sync. Mitigation : Sprint 3 Tache 1.3.9 deja pose les fondations + tests E2E verifient `/api/v1/docs.json` schema validity (json-schema-to-typescript reverse parse).

### 2.4 Decisions strategiques referenced

- **decision-006 (No-emoji)** : pertinence totale -- aucun emoji dans code + Swagger + responses + logs.
- **decision-007 (Zod runtime)** : pertinence totale -- tous DTOs via `createZodDto(Schema)`.
- **decision-008 (Cloud souverain MA)** : pertinence indirecte -- API hostee Atlas Cloud Services Benguerir Sprint 35.
- **decision-009 (Multi-locale)** : pertinence directe -- endpoint `/preferences` PUT inclut `preferred_language` (fr-MA, ar-MA, ar, en).
- **decision-012 (Multi-tenant strict)** : pertinence totale -- TenantContext middleware sur tous controllers comm.
- **decision-014 (RBAC granular)** : pertinence totale -- @RequirePermission sur 100% endpoints.
- **decision-018 (REST API conventions)** : pertinence totale -- /api/v1/{resource} + verbs HTTP.

### 2.5 Pieges techniques connus

1. **Piege : tenant_id manquant dans header X-Tenant-Id alors que controller multi-tenant.**
   - Pourquoi : si frontend oublie header, query DB sans filter -> retourne 0 row (semble vide) ou crash si NOT NULL constraint.
   - Solution : middleware `TenantContext` Sprint 6 throw 400 BAD_TENANT_HEADER si absent + JWT.tenant_id auto-fallback.

2. **Piege : Cursor pagination invalide base64 corrompu.**
   - Pourquoi : un user manipulate URL ou copie incomplete cursor.
   - Solution : validate Zod `cursor: z.string().base64().optional()` + try/catch decode -> 400 INVALID_CURSOR avec error message "Cursor format invalid".

3. **Piege : Date range filter > 1 year (perf + cost).**
   - Pourquoi : `?date_from=2020-01-01&date_to=2026-05-08` scanne 6 ans messages.
   - Solution : validation Zod max 1 year span + 400 DATE_RANGE_TOO_LARGE. Sprint 35 raise to 7 ans avec materialized view aggregations.

4. **Piege : Search query > 200 chars perf trigram + ReDoS.**
   - Pourquoi : long query ralentit pg_trgm + risque pattern injection.
   - Solution : validation Zod max 200 chars + sanitize special chars regex.

5. **Piege : Send while contact opted-out + skipOptOutCheck=false (default).**
   - Pourquoi : violation CNDP loi 09-08 article 11 (right to opt-out respected).
   - Solution : `MessageOrchestrator` (Tache 3.2.9) verifie + reject `BadRequestException CONTACT_OPTED_OUT` + audit log.

6. **Piege : Broadcast quota tenant exceeded (e.g. 100k messages/mois).**
   - Pourquoi : tenant Free plan envoie 100k messages = depasse cost Mailgun + Meta API budget.
   - Solution : middleware quota check (Sprint 13 Books) -> 429 QUOTA_EXCEEDED avec retry_after header.

7. **Piege : Concurrent template update conflict (2 admins editent simultanement).**
   - Pourquoi : last-write-wins ecrase modifications first-writer.
   - Solution : optimistic lock via `version` column UUID -> If-Match header + 409 OPTIMISTIC_LOCK_CONFLICT si stale.

8. **Piege : Template delete in-use (referenced par comm_messages).**
   - Pourquoi : cascade delete losing audit trail messages.
   - Solution : check FK references count > 0 -> 409 TEMPLATE_IN_USE + force flag uniquement super_admin.

9. **Piege : Stats period=lifetime perf catastrophique.**
   - Pourquoi : aggregate sur 6 ans 100M rows = 30s query.
   - Solution : Sprint 14 materialized view `comm_stats_daily_mv` refresh nightly + pre-aggregate periods.

10. **Piege : OpenAPI Zod -> JSONSchema sync drift.**
    - Pourquoi : Zod schema evolue, OpenAPI schema lag.
    - Solution : `nestjs-zod` librairie auto-convert + tests E2E verify `/api/v1/docs.json` valid OpenAPI 3.1.

11. **Piege : Versioning API v1 -> v2 breaking change.**
    - Pourquoi : Sprint 35+ veut nouveau format response, casserait Sprint 4 frontends.
    - Solution : `/api/v1/comm/*` stable + Sprint 35 fork `/api/v2/comm/*` + deprecation header `Sunset: Tue, 01 Jan 2030 00:00:00 GMT` Sprint 35.

12. **Piege : DELETE soft-delete avec flag `deleted_at` mais query oublie filter `WHERE deleted_at IS NULL`.**
    - Pourquoi : list endpoint retourne deleted rows.
    - Solution : repository methode `findAll` auto-add `WHERE deleted_at IS NULL` + opt-in `findAllIncludingDeleted` pour audit.

13. **Piege : Timeline events out-of-order si Kafka consumer lag.**
    - Pourquoi : delivered event arrive AVANT sent event si parallel processing.
    - Solution : sort by `created_at ASC` + tolerate clock skew 5s.

14. **Piege : Broadcast filters CRM tags non-existants (Sprint 8).**
    - Pourquoi : `?filters.tags=garage_partner` mais tag pas defini dans tenant.
    - Solution : validation Zod cross-ref CRM service + 400 INVALID_TAG.

15. **Piege : Idempotency-Key collision cross-tenant.**
    - Pourquoi : 2 tenants envoient meme key "req-123".
    - Solution : storage Redis key prefix `idempotency:{tenant_id}:{key}` namespaced.

16. **Piege : Rate limit 100/min per tenant pas par user.**
    - Pourquoi : un user spam consume tout quota tenant.
    - Solution : middleware rate-limit double : 100/min/tenant + 30/min/user.

---

## 3. Architecture context

### 3.1 Position dans le sprint

- **Depend de** : 3.2.11 (OptoutService consume + endpoint public reference + RBAC), 3.2.10 (DeliveryTrackingService stats), 3.2.9 (MessageOrchestrator orchestrate routing canal), 3.2.5 (TemplateManager service + workflow Meta), 3.2.1 (entites + schemas Zod), Sprint 7 (RBAC), Sprint 6 (TenantContext), Sprint 5 (JwtAuthGuard), Sprint 3 (ResponseInterceptor + IdempotencyMiddleware + RateLimit + ZodValidationPipe + ExceptionFilter).
- **Bloque** : Tache 3.2.13 (tests E2E exhaustifs 40+ utilisent endpoints), Sprint 17 Comm vertical (consume `POST /messages/send` via HTTP), Sprint 14+ Insure (police signed reminders), Sprint 18 Customer Portal (preferences UI), Sprint 27 Admin UI (templates Meta + stats), Sprint 30+ MCP server proxy (expose endpoints comm partenaires).

### 3.2 Position dans le programme global

- Sprint 4 Frontend Operator UI : consomme `GET /messages` filtree par contact_id pour timeline 360-view + `POST /messages/send` pour reply.
- Sprint 17 Comm vertical : workflows broker (e.g. relance assure pour signature) consomme `POST /messages/send`.
- Sprint 18 Customer Portal : assure self-service consume `GET/PUT /preferences`.
- Sprint 27 Admin UI super_admin : consume `GET/POST /templates` + `POST /templates/:id/submit` workflow Meta + `GET /stats`.
- Sprint 30+ MCP server proxy : expose endpoints comm aux integrations partenaires (B2B SaaS).
- Sprint 35 : potentiellement migration v2 + materialized views stats lifetime.

### 3.3 Diagramme architecture flow request

```
Client (Frontend Sprint 4 / Vertical Sprint 17 / Customer Portal Sprint 18)
    |
    | HTTP POST /api/v1/comm/messages/send
    | Headers: Authorization Bearer <jwt>, X-Tenant-Id, Idempotency-Key (optional)
    | Body: { contactId, templateName, locale?, variables, options? }
    v
[Fastify HTTP server]
    |
    +-- [HelmetMiddleware Sprint 3]                 (security headers)
    +-- [CorsMiddleware Sprint 3]                    (allowed origins)
    +-- [RequestLoggerMiddleware Sprint 3]            (Pino structured)
    +-- [RequestContextMiddleware Sprint 3]           (traceId + requestId ULID)
    +-- [JwtAuthGuard Sprint 5]                       (verify + decode JWT)
    +-- [TenantContextMiddleware Sprint 6]            (extract + AsyncLocalStorage)
    +-- [RateLimitMiddleware Sprint 3]                (Redis 100/min/tenant + 30/min/user)
    +-- [IdempotencyMiddleware Sprint 3]              (check + return cache si match)
    +-- [RequirePermissionGuard Sprint 7]             (verify @RequirePermission decorator)
    +-- [ZodValidationPipe Sprint 3]                  (validate body via createZodDto)
    |
    v
[MessagesController.send()]
    |
    +-- inject AuthUser, TenantContext, dto: SendMessageDto
    +-- audit log start (Sprint 7 AuditService)
    |
    v
[MessageOrchestratorService.sendToContact() Tache 3.2.9]
    |
    +-- Lookup contact (Sprint 8 ContactsService) + multi-tenant filter
    +-- Check opt-out (OptoutService Tache 3.2.11)
    +-- Determine canal (WhatsApp vs Email)
    +-- INSERT comm_messages row status=pending
    +-- Enqueue BullMQ wa-send OR email-send (Tache 3.2.8)
    |
    v
[Returns: { messageId, channel: 'whatsapp', status: 'queued' }]
    |
    v
[ResponseInterceptor Sprint 3 Tache 1.3.7]
    |
    +-- Wrap data in { success, data, meta, errors }
    +-- Inject meta.traceId, meta.requestId, meta.tenantId, meta.timestamp, meta.version
    |
    v
[IdempotencyMiddleware Sprint 3]
    |
    +-- Cache response Redis 24h with key idempotency:{tenant_id}:{idempotency_key}
    |
    v
HTTP 201 Created
{
  success: true,
  data: { messageId: "msg-...", channel: "whatsapp", status: "queued" },
  meta: { traceId, requestId, tenantId, timestamp, version },
  errors: []
}
```

### 3.4 Format response standardise (Sprint 3 Tache 1.3.7)

```typescript
{
  success: boolean,                 // toujours true pour 2xx
  data: T,                          // payload metier
  meta: {
    traceId: string,                // OTEL trace_id
    requestId: string,              // ULID Sprint 3
    tenantId: string,               // ULID tenant context
    timestamp: string,              // ISO 8601 UTC
    version: string,                // process.env.APP_VERSION
    pagination?: {
      cursor: string,               // base64 next cursor
      hasMore: boolean,
      limit: number,
    },
    locale?: string,                // fr-MA / ar-MA / ar / en
  },
  errors: ApiError[]                // toujours [] pour 2xx
}
```

### 3.5 Permissions RBAC catalog (Sprint 7)

| Permission | Description | Roles auto-assigned |
|------------|-------------|---------------------|
| comm.messages.send | Envoi unitaire | broker_admin, broker_user, garage_admin |
| comm.messages.send_broadcast | Envoi broadcast campaign | broker_admin only |
| comm.messages.read | List + detail messages | broker_admin, broker_user |
| comm.messages.delete | Soft-delete CNDP | super_admin only |
| comm.templates.read | List + detail templates | broker_admin |
| comm.templates.manage | Create/Update/Delete/Submit Meta | broker_admin only |
| comm.stats.read | View aggregates stats | broker_admin, garage_admin |
| comm.preferences.manage | Update self preferences | assure (self), broker_admin (in tenant) |
| comm.optouts.read | Lookup platform opt-outs | super_admin platform only -- CNDP |

### 3.6 Pattern pagination cursor base64

```typescript
// Encode
const cursor = Buffer.from(JSON.stringify({
  lastId: 'msg-uuid-...',
  lastSentAt: '2026-05-08T12:34:56.789Z',
})).toString('base64url');

// Decode
const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf-8'));
// { lastId: 'msg-uuid-...', lastSentAt: '...' }

// Query Postgres
SELECT * FROM comm_messages
WHERE tenant_id = $1
  AND deleted_at IS NULL
  AND (sent_at, id) < ($2, $3)
ORDER BY sent_at DESC, id DESC
LIMIT $4 + 1;  -- +1 pour detect hasMore

// Index requis :
CREATE INDEX idx_comm_messages_tenant_sent_at
  ON comm_messages (tenant_id, sent_at DESC, id DESC)
  WHERE deleted_at IS NULL;
```

### 3.7 Pattern filtres messages

```
GET /api/v1/comm/messages?
  channel=whatsapp                   # whatsapp | email | sms | voice
  &direction=outbound                 # inbound | outbound
  &status=delivered                   # pending | queued | sent | delivered | read | failed
  &contact_id=ct-uuid-...
  &template_id=tpl-uuid-...
  &date_from=2026-01-01
  &date_to=2026-05-08
  &search=appointment                 # trigram pg_trgm Sprint 8
  &cursor=eyJsYXN0SWQiOi...           # base64url
  &limit=20                           # default 20, max 100
  &sort=sent_at_desc                  # sent_at_desc | sent_at_asc
```

### 3.8 Pattern Swagger annotations

```typescript
@ApiTags('comm', 'messages')
@ApiOperation({
  summary: 'Send message via WhatsApp or Email',
  description: 'Orchestrates routing per contact preferred_channel (Sprint 8) + opt-out check. Returns 201 with messageId + channel selected.',
})
@ApiBody({ type: SendMessageDto, examples: { whatsapp: { value: { contactId: 'ct-...', templateName: 'appointment_reminder', variables: { user_name: 'Mohamed' } } } } })
@ApiResponse({ status: 201, description: 'Message queued', type: SendMessageResponseDto })
@ApiResponse({ status: 400, description: 'Validation error' })
@ApiResponse({ status: 401, description: 'Unauthorized' })
@ApiResponse({ status: 403, description: 'Forbidden - missing permission comm.messages.send' })
@ApiResponse({ status: 404, description: 'Contact or template not found' })
@ApiResponse({ status: 409, description: 'Idempotency conflict (different body for same key)' })
@ApiResponse({ status: 429, description: 'Rate limit exceeded' })
@RequirePermission('comm.messages.send')
@Post('messages/send')
async send(
  @Body() dto: SendMessageDto,
  @CurrentUser() user: AuthUser,
): Promise<SendMessageResponseDto> { ... }
```

### 3.9 Diagramme structure module comm

```
repo/apps/api/src/modules/comm/
  comm.module.ts                                  # NestJS module register controllers + services
  controllers/
    messages.controller.ts                         # POST /send, /send-batch, /send-broadcast + GET list/detail/timeline + DELETE
    messages.controller.spec.ts                    # 20+ tests unit Vitest
    templates.controller.ts                        # CRUD templates + submit Meta
    templates.controller.spec.ts                   # 12+ tests
    comm-stats.controller.ts                       # GET /stats?period=...
    comm-stats.controller.spec.ts                  # 8+ tests
    comm-preferences.controller.ts                 # GET/PUT /preferences
    comm-preferences.controller.spec.ts            # 8+ tests
    optout.controller.ts                           # reference Tache 3.2.11
  dto/
    messages-dto.ts                                # SendMessageDto, SendBatchDto, SendBroadcastDto, MessagesFiltersDto, TimelineResponseDto
    templates-dto.ts                               # CreateTemplateDto, UpdateTemplateDto, TemplatesFiltersDto, SubmitMetaDto
    stats-dto.ts                                   # StatsResponseDto, StatsByTemplateDto, StatsByChannelDto
    preferences-dto.ts                             # UpdatePreferencesDto
  openapi/
    comm-tags.ts                                   # tags + ApiResponse decorators reuse
test/
  comm/
    messages-controller.e2e-spec.ts                # 25+ E2E avec Supertest + auth + multi-tenant
    templates-controller.e2e-spec.ts               # 12+ E2E
    comm-stats-controller.e2e-spec.ts              # 6+ E2E
    comm-preferences-controller.e2e-spec.ts        # 6+ E2E
    fixtures/comm-test-helpers.ts                   # helpers signin + tenant + send fixtures
```

---

## 4. Livrables checkables (32 livrables)

- [ ] Controller `repo/apps/api/src/modules/comm/controllers/messages.controller.ts` (~280 lignes, 7 routes complete avec RBAC + multi-tenant + Swagger)
- [ ] Tests `repo/apps/api/src/modules/comm/controllers/messages.controller.spec.ts` (~250 lignes, 20+ tests unit Vitest)
- [ ] DTOs `repo/apps/api/src/modules/comm/dto/messages-dto.ts` (~150 lignes Zod via createZodDto)
- [ ] Controller `repo/apps/api/src/modules/comm/controllers/comm-preferences.controller.ts` (~150 lignes)
- [ ] Tests `repo/apps/api/src/modules/comm/controllers/comm-preferences.controller.spec.ts` (~120 lignes, 8+ tests)
- [ ] Controller `repo/apps/api/src/modules/comm/controllers/templates.controller.ts` (~200 lignes complete CRUD + admin Meta)
- [ ] Tests `repo/apps/api/src/modules/comm/controllers/templates.controller.spec.ts` (~150 lignes, 12+ tests)
- [ ] DTOs `repo/apps/api/src/modules/comm/dto/templates-dto.ts` (~120 lignes Zod)
- [ ] Controller `repo/apps/api/src/modules/comm/controllers/comm-stats.controller.ts` (~150 lignes)
- [ ] Tests `repo/apps/api/src/modules/comm/controllers/comm-stats.controller.spec.ts` (~100 lignes, 8+ tests)
- [ ] DTOs `repo/apps/api/src/modules/comm/dto/stats-dto.ts` (~80 lignes Zod stats response)
- [ ] DTOs `repo/apps/api/src/modules/comm/dto/preferences-dto.ts` (~60 lignes)
- [ ] Module `repo/apps/api/src/modules/comm/comm.module.ts` (~120 lignes register tous controllers + services + middleware)
- [ ] Reference `repo/apps/api/src/modules/comm/controllers/optout.controller.ts` (deja Tache 3.2.11 + RBAC complet)
- [ ] Swagger tags `repo/apps/api/src/modules/comm/openapi/comm-tags.ts` (~60 lignes)
- [ ] Tests E2E `repo/apps/api/test/comm/messages-controller.e2e-spec.ts` (~300 lignes, 25+ E2E avec Supertest)
- [ ] Tests E2E `repo/apps/api/test/comm/templates-controller.e2e-spec.ts` (~200 lignes, 12+ E2E)
- [ ] Tests E2E `repo/apps/api/test/comm/comm-preferences-controller.e2e-spec.ts` (~150 lignes, 6+ E2E)
- [ ] Helpers `repo/apps/api/test/comm/fixtures/comm-test-helpers.ts` (~120 lignes signin + tenant fixtures)
- [ ] Variables env : `COMM_BATCH_MAX_SIZE=1000`, `COMM_PAGINATION_DEFAULT_LIMIT=20`, `COMM_PAGINATION_MAX_LIMIT=100`, `COMM_API_RATE_LIMIT_PER_MINUTE=100`
- [ ] Mise a jour `repo/apps/api/src/app.module.ts` -- import CommModule
- [ ] Aucune emoji dans tous fichiers
- [ ] Aucun `console.log` dans tous fichiers
- [ ] Build TypeScript reussit
- [ ] Coverage >= 90% sur module comm controllers + DTOs
- [ ] Tests E2E passent CI (Postgres + Redis services)
- [ ] Swagger OpenAPI 3.1 generation reussie + validity check
- [ ] 17 endpoints documented Swagger
- [ ] 9 permissions RBAC respectees
- [ ] Multi-tenant isolation strict tous endpoints
- [ ] Pagination cursor consistent toutes routes list
- [ ] Idempotency-Key support sur /send + /send-batch + /send-broadcast

---

## 5. Fichiers crees / modifies

```
repo/apps/api/src/modules/comm/controllers/messages.controller.ts                      (~280 lignes / NEW)
repo/apps/api/src/modules/comm/controllers/messages.controller.spec.ts                 (~250 lignes / NEW)
repo/apps/api/src/modules/comm/controllers/comm-preferences.controller.ts              (~150 lignes / NEW)
repo/apps/api/src/modules/comm/controllers/comm-preferences.controller.spec.ts         (~120 lignes / NEW)
repo/apps/api/src/modules/comm/controllers/templates.controller.ts                      (~200 lignes / NEW)
repo/apps/api/src/modules/comm/controllers/templates.controller.spec.ts                (~150 lignes / NEW)
repo/apps/api/src/modules/comm/controllers/comm-stats.controller.ts                     (~150 lignes / NEW)
repo/apps/api/src/modules/comm/controllers/comm-stats.controller.spec.ts                (~100 lignes / NEW)
repo/apps/api/src/modules/comm/controllers/optout.controller.ts                         (REFERENCE Tache 3.2.11)
repo/apps/api/src/modules/comm/dto/messages-dto.ts                                      (~150 lignes / NEW)
repo/apps/api/src/modules/comm/dto/templates-dto.ts                                     (~120 lignes / NEW)
repo/apps/api/src/modules/comm/dto/stats-dto.ts                                         (~80 lignes / NEW)
repo/apps/api/src/modules/comm/dto/preferences-dto.ts                                   (~60 lignes / NEW)
repo/apps/api/src/modules/comm/openapi/comm-tags.ts                                     (~60 lignes / NEW)
repo/apps/api/src/modules/comm/comm.module.ts                                           (~120 lignes / NEW)
repo/apps/api/test/comm/messages-controller.e2e-spec.ts                                 (~300 lignes / NEW)
repo/apps/api/test/comm/templates-controller.e2e-spec.ts                                (~200 lignes / NEW)
repo/apps/api/test/comm/comm-preferences-controller.e2e-spec.ts                         (~150 lignes / NEW)
repo/apps/api/test/comm/fixtures/comm-test-helpers.ts                                    (~120 lignes / NEW)
repo/apps/api/src/app.module.ts                                                          (UPDATE +1 import CommModule)
.env.example                                                                               (UPDATE +4 vars)
```

Total : 19 NEW + 2 UPDATE = 21 fichiers, ~3000 lignes effectives.

---

## 6. Code patterns COMPLETS

### 6.1 Fichier 1/12 : `messages.controller.ts`

Role : controller exposant 7 endpoints messages avec RBAC + multi-tenant + Swagger + Idempotency + RateLimit.

```typescript
/**
 * @insurtech/api/modules/comm/controllers/messages
 *
 * REST endpoints `/api/v1/comm/messages/*` :
 *   POST   /send                    (send unique, body: SendMessageDto)
 *   POST   /send-batch              (batch up to COMM_BATCH_MAX_SIZE=1000)
 *   POST   /send-broadcast          (async broadcast filters Sprint 8 CRM)
 *   GET    /                        (list paginated cursor)
 *   GET    /:id                     (detail)
 *   GET    /:id/timeline            (events sent/delivered/read/clicked)
 *   DELETE /:id                     (soft-delete super_admin only CNDP)
 *
 * Reference :
 *   - Sprint 3 Tache 1.3.7 (ResponseInterceptor format { success, data, meta, errors })
 *   - Sprint 5 (JwtAuthGuard + AuthUser injection)
 *   - Sprint 6 (TenantContext + multi-tenant isolation)
 *   - Sprint 7 (RBAC @RequirePermission)
 *   - Sprint 9 Tache 3.2.9 (MessageOrchestrator)
 *   - Sprint 9 Tache 3.2.10 (DeliveryTracking timeline)
 *   - decision-006 (No-emoji), decision-007 (Zod), decision-014 (RBAC granular)
 */

import {
  Body, Controller, Delete, Get, Param, ParseUUIDPipe,
  Post, Query, HttpCode, HttpStatus, NotFoundException,
  ForbiddenException, BadRequestException, Logger, UseGuards,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiResponse, ApiBody, ApiQuery, ApiParam,
  ApiBearerAuth, ApiHeader,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@insurtech/auth/guards/jwt-auth.guard';
import { RequirePermission, RequirePermissionGuard } from '@insurtech/auth/rbac';
import { CurrentUser, type AuthUser } from '@insurtech/auth/decorators/current-user.decorator';
import { TenantContext, getCurrentTenantId } from '@insurtech/tenant/context';
import { MessageOrchestratorService } from '@insurtech/comm/services/message-orchestrator.service';
import { MessagesRepositoryService } from '@insurtech/comm/services/messages-repository.service';
import { DeliveryTrackingService } from '@insurtech/comm/services/delivery-tracking.service';
import { AuditService } from '@insurtech/audit/audit.service';
import {
  SendMessageDto, SendMessageResponseDto,
  SendBatchDto, SendBatchResponseDto,
  SendBroadcastDto, SendBroadcastResponseDto,
  MessagesFiltersDto, MessageListResponseDto, MessageDetailDto,
  TimelineResponseDto,
} from '../dto/messages-dto.js';
import { encodeCursor, decodeCursor } from '../utils/cursor.util.js';

@ApiTags('comm', 'messages')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Tenant-Id', required: false, description: 'Override tenant for super_admin only. Default: extracted from JWT.tenant_id claim' })
@UseGuards(JwtAuthGuard, RequirePermissionGuard)
@Controller({ path: 'comm/messages', version: '1' })
export class MessagesController {
  private readonly logger = new Logger(MessagesController.name);

  constructor(
    private readonly orchestrator: MessageOrchestratorService,
    private readonly messagesRepo: MessagesRepositoryService,
    private readonly deliveryTracking: DeliveryTrackingService,
    private readonly audit: AuditService,
  ) {}

  @ApiOperation({
    summary: 'Send message via WhatsApp or Email',
    description: 'Orchestrates canal selection per contact.preferred_channel (Sprint 8) + opt-out check (Tache 3.2.11). Returns 201 with messageId + channel selected. Supports Idempotency-Key header (Sprint 3) for safe retries.',
  })
  @ApiBody({ type: SendMessageDto })
  @ApiResponse({ status: 201, description: 'Message queued', type: SendMessageResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error / contact opted-out / no available channel' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - missing permission comm.messages.send' })
  @ApiResponse({ status: 404, description: 'Contact or template not found' })
  @ApiResponse({ status: 409, description: 'Idempotency-Key conflict (different body for same key)' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded (100/min/tenant)' })
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  @RequirePermission('comm.messages.send')
  @Post('send')
  @HttpCode(HttpStatus.CREATED)
  async send(
    @Body() dto: SendMessageDto,
    @CurrentUser() user: AuthUser,
  ): Promise<SendMessageResponseDto> {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new BadRequestException({ code: 'BAD_TENANT_HEADER', message: 'Tenant context missing' });
    }

    this.logger.log({
      action: 'comm_send_start',
      user_id: user.id,
      tenant_id: tenantId,
      contact_id: dto.contactId,
      template_name: dto.templateName,
    });

    const result = await this.orchestrator.sendToContact(
      dto.contactId,
      dto.templateName,
      dto.variables,
      {
        preferChannel: dto.options?.preferChannel,
        skipOptOutCheck: dto.options?.skipOptOutCheck ?? false,
        correlationId: dto.options?.correlationId,
        locale: dto.locale,
      },
    );

    await this.audit.log({
      tenant_id: tenantId,
      user_id: user.id,
      action: 'comm.messages.send',
      resource_type: 'comm_message',
      resource_id: result.messageId,
      metadata: { channel: result.channel, template: dto.templateName, contact_id: dto.contactId },
    });

    return {
      messageId: result.messageId,
      channel: result.channel,
      status: 'queued',
    };
  }

  @ApiOperation({ summary: 'Send batch messages', description: 'Up to COMM_BATCH_MAX_SIZE=1000 items. Returns enqueued counts.' })
  @ApiBody({ type: SendBatchDto })
  @ApiResponse({ status: 201, description: 'Batch queued', type: SendBatchResponseDto })
  @ApiResponse({ status: 400, description: 'Batch too large or validation error' })
  @RequirePermission('comm.messages.send')
  @Post('send-batch')
  @HttpCode(HttpStatus.CREATED)
  async sendBatch(
    @Body() dto: SendBatchDto,
    @CurrentUser() user: AuthUser,
  ): Promise<SendBatchResponseDto> {
    const tenantId = getCurrentTenantId();
    if (dto.items.length > Number.parseInt(process.env.COMM_BATCH_MAX_SIZE ?? '1000', 10)) {
      throw new BadRequestException({
        code: 'BATCH_TOO_LARGE',
        message: `Max batch size is ${process.env.COMM_BATCH_MAX_SIZE ?? 1000} items`,
        details: { received: dto.items.length, max: 1000 },
      });
    }

    const results: { messageId: string; channel: string; contactId: string; status: string }[] = [];
    const errors: { contactId: string; error: string }[] = [];

    for (const item of dto.items) {
      try {
        const r = await this.orchestrator.sendToContact(
          item.contactId, dto.templateName, item.variables,
          { skipOptOutCheck: false },
        );
        results.push({ ...r, contactId: item.contactId, status: 'queued' });
      } catch (err) {
        errors.push({
          contactId: item.contactId,
          error: err instanceof Error ? err.message : 'unknown',
        });
      }
    }

    await this.audit.log({
      tenant_id: tenantId, user_id: user.id, action: 'comm.messages.send_batch',
      resource_type: 'comm_messages_batch',
      metadata: { template: dto.templateName, success_count: results.length, error_count: errors.length },
    });

    return { enqueued: results.length, errors: errors.length, items: results, failures: errors };
  }

  @ApiOperation({ summary: 'Send broadcast campaign', description: 'Async broadcast with filters (Sprint 8 CRM). Returns 202 Accepted with jobId for tracking.' })
  @ApiBody({ type: SendBroadcastDto })
  @ApiResponse({ status: 202, description: 'Broadcast accepted, async processing', type: SendBroadcastResponseDto })
  @RequirePermission('comm.messages.send_broadcast')
  @Post('send-broadcast')
  @HttpCode(HttpStatus.ACCEPTED)
  async sendBroadcast(
    @Body() dto: SendBroadcastDto,
    @CurrentUser() user: AuthUser,
  ): Promise<SendBroadcastResponseDto> {
    const tenantId = getCurrentTenantId();

    const result = await this.orchestrator.sendBroadcast(
      dto.filters,
      dto.templateName,
      dto.variables,
      { dryRun: dto.dryRun ?? false },
    );

    await this.audit.log({
      tenant_id: tenantId, user_id: user.id, action: 'comm.messages.send_broadcast',
      resource_type: 'comm_broadcast', resource_id: result.jobId,
      metadata: { template: dto.templateName, estimated_recipients: result.estimatedRecipients },
    });

    return {
      jobId: result.jobId,
      estimatedRecipients: result.estimatedRecipients,
      status: 'accepted',
      pollUrl: `/api/v1/comm/jobs/${result.jobId}/status`,
    };
  }

  @ApiOperation({ summary: 'List messages with filters + cursor pagination' })
  @ApiQuery({ name: 'channel', required: false, enum: ['whatsapp', 'email', 'sms', 'voice'] })
  @ApiQuery({ name: 'direction', required: false, enum: ['inbound', 'outbound'] })
  @ApiQuery({ name: 'status', required: false, enum: ['pending', 'queued', 'sent', 'delivered', 'read', 'failed'] })
  @ApiQuery({ name: 'contact_id', required: false })
  @ApiQuery({ name: 'template_id', required: false })
  @ApiQuery({ name: 'date_from', required: false, description: 'ISO 8601' })
  @ApiQuery({ name: 'date_to', required: false, description: 'ISO 8601' })
  @ApiQuery({ name: 'search', required: false, description: 'Trigram search Sprint 8 max 200 chars' })
  @ApiQuery({ name: 'cursor', required: false, description: 'base64url cursor' })
  @ApiQuery({ name: 'limit', required: false, description: 'default 20, max 100' })
  @ApiResponse({ status: 200, description: 'Messages list paginated', type: MessageListResponseDto })
  @RequirePermission('comm.messages.read')
  @Get()
  async list(@Query() filters: MessagesFiltersDto): Promise<MessageListResponseDto> {
    const tenantId = getCurrentTenantId()!;
    const limit = Math.min(filters.limit ?? 20, Number.parseInt(process.env.COMM_PAGINATION_MAX_LIMIT ?? '100', 10));

    let decodedCursor: { lastId: string; lastSentAt: string } | null = null;
    if (filters.cursor) {
      try {
        decodedCursor = decodeCursor(filters.cursor);
      } catch {
        throw new BadRequestException({ code: 'INVALID_CURSOR', message: 'Cursor format invalid' });
      }
    }

    if (filters.dateFrom && filters.dateTo) {
      const from = new Date(filters.dateFrom);
      const to = new Date(filters.dateTo);
      const yearMs = 365 * 24 * 60 * 60 * 1000;
      if (to.getTime() - from.getTime() > yearMs) {
        throw new BadRequestException({
          code: 'DATE_RANGE_TOO_LARGE',
          message: 'Max 1 year span. Sprint 35 will raise to 7 years via materialized view.',
        });
      }
    }

    const rows = await this.messagesRepo.findAllPaginated({
      tenantId,
      channel: filters.channel,
      direction: filters.direction,
      status: filters.status,
      contactId: filters.contactId,
      templateId: filters.templateId,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      search: filters.search,
      cursor: decodedCursor,
      limit: limit + 1,
      sort: filters.sort ?? 'sent_at_desc',
    });

    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit);
    const last = items[items.length - 1];
    const nextCursor = hasMore && last ? encodeCursor({ lastId: last.id, lastSentAt: last.sent_at?.toISOString() ?? last.created_at.toISOString() }) : undefined;

    return {
      items: items.map((m) => ({
        id: m.id, channel: m.channel, direction: m.direction, status: m.status,
        contact_id: m.contact_id, template_name: m.template_name,
        to_address: m.to_address, sent_at: m.sent_at, delivered_at: m.delivered_at,
        read_at: m.read_at, failed_at: m.failed_at, fail_reason: m.fail_reason,
      })),
      pagination: { cursor: nextCursor, hasMore, limit },
    };
  }

  @ApiOperation({ summary: 'Get message detail by ID' })
  @ApiParam({ name: 'id', description: 'Message UUID' })
  @ApiResponse({ status: 200, description: 'Message detail', type: MessageDetailDto })
  @ApiResponse({ status: 404, description: 'Not found or cross-tenant access' })
  @RequirePermission('comm.messages.read')
  @Get(':id')
  async getById(@Param('id', ParseUUIDPipe) id: string): Promise<MessageDetailDto> {
    const tenantId = getCurrentTenantId()!;
    const message = await this.messagesRepo.findByIdAndTenant(id, tenantId);
    if (!message) throw new NotFoundException({ code: 'MESSAGE_NOT_FOUND', message: 'Message not found' });
    return message;
  }

  @ApiOperation({ summary: 'Get message timeline events ordered by created_at ASC' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, description: 'Timeline events', type: TimelineResponseDto })
  @RequirePermission('comm.messages.read')
  @Get(':id/timeline')
  async getTimeline(@Param('id', ParseUUIDPipe) id: string): Promise<TimelineResponseDto> {
    const tenantId = getCurrentTenantId()!;
    const message = await this.messagesRepo.findByIdAndTenant(id, tenantId);
    if (!message) throw new NotFoundException({ code: 'MESSAGE_NOT_FOUND' });
    const events = await this.deliveryTracking.getTimeline(id);
    return { messageId: id, events };
  }

  @ApiOperation({ summary: 'Soft-delete message (CNDP right-to-erasure article 27). super_admin only.' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 204, description: 'Soft-deleted' })
  @ApiResponse({ status: 403, description: 'Forbidden - super_admin only' })
  @RequirePermission('comm.messages.delete')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async softDelete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    const tenantId = getCurrentTenantId()!;
    if (user.role !== 'super_admin') {
      throw new ForbiddenException({ code: 'SUPER_ADMIN_ONLY' });
    }
    const message = await this.messagesRepo.findByIdAndTenant(id, tenantId);
    if (!message) throw new NotFoundException({ code: 'MESSAGE_NOT_FOUND' });

    await this.messagesRepo.softDelete(id, { deletedBy: user.id, reason: 'CNDP_ERASURE' });
    await this.audit.log({
      tenant_id: tenantId, user_id: user.id, action: 'comm.messages.soft_delete',
      resource_type: 'comm_message', resource_id: id,
      metadata: { reason: 'CNDP_ERASURE_ARTICLE_27' },
    });
  }
}
```

### 6.2 Fichier 2/12 : `messages.controller.spec.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { MessagesController } from './messages.controller.js';
import { MessageOrchestratorService } from '@insurtech/comm/services/message-orchestrator.service';
import { MessagesRepositoryService } from '@insurtech/comm/services/messages-repository.service';
import { DeliveryTrackingService } from '@insurtech/comm/services/delivery-tracking.service';
import { AuditService } from '@insurtech/audit/audit.service';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { setCurrentTenantId } from '@insurtech/tenant/context';

vi.mock('@insurtech/tenant/context', () => ({
  getCurrentTenantId: vi.fn(() => 'tn-test-uuid'),
  setCurrentTenantId: vi.fn(),
}));

describe('MessagesController', () => {
  let controller: MessagesController;
  let orchestrator: any;
  let messagesRepo: any;
  let deliveryTracking: any;
  let audit: any;

  const mockUser = { id: 'usr-uuid', role: 'broker_admin', permissions: ['comm.messages.send', 'comm.messages.read', 'comm.messages.send_broadcast'] };

  beforeEach(async () => {
    orchestrator = {
      sendToContact: vi.fn().mockResolvedValue({ messageId: 'msg-uuid-1', channel: 'whatsapp' }),
      sendBroadcast: vi.fn().mockResolvedValue({ jobId: 'job-uuid-1', estimatedRecipients: 250 }),
    };
    messagesRepo = {
      findByIdAndTenant: vi.fn().mockResolvedValue({ id: 'msg-uuid-1', channel: 'whatsapp', tenant_id: 'tn-test-uuid' }),
      findAllPaginated: vi.fn().mockResolvedValue([
        { id: 'msg-1', channel: 'whatsapp', direction: 'outbound', status: 'delivered', sent_at: new Date(), created_at: new Date() },
        { id: 'msg-2', channel: 'email', direction: 'outbound', status: 'sent', sent_at: new Date(), created_at: new Date() },
      ]),
      softDelete: vi.fn().mockResolvedValue(undefined),
    };
    deliveryTracking = {
      getTimeline: vi.fn().mockResolvedValue([
        { event: 'sent', occurred_at: new Date() },
        { event: 'delivered', occurred_at: new Date() },
        { event: 'read', occurred_at: new Date() },
      ]),
    };
    audit = { log: vi.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      controllers: [MessagesController],
      providers: [
        { provide: MessageOrchestratorService, useValue: orchestrator },
        { provide: MessagesRepositoryService, useValue: messagesRepo },
        { provide: DeliveryTrackingService, useValue: deliveryTracking },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    controller = moduleRef.get(MessagesController);
  });

  describe('send', () => {
    it('orchestrates send + returns messageId + channel', async () => {
      const result = await controller.send(
        { contactId: 'ct-1', templateName: 'appointment_reminder', variables: { user_name: 'M' } } as any,
        mockUser as any,
      );
      expect(result).toEqual({ messageId: 'msg-uuid-1', channel: 'whatsapp', status: 'queued' });
      expect(orchestrator.sendToContact).toHaveBeenCalledWith('ct-1', 'appointment_reminder', { user_name: 'M' }, expect.any(Object));
      expect(audit.log).toHaveBeenCalled();
    });

    it('throws BAD_TENANT_HEADER if tenant missing', async () => {
      const ctx = await import('@insurtech/tenant/context');
      (ctx.getCurrentTenantId as any).mockReturnValueOnce(null);
      await expect(controller.send({ contactId: 'c', templateName: 't', variables: {} } as any, mockUser as any))
        .rejects.toThrow(BadRequestException);
    });

    it('forwards options to orchestrator', async () => {
      await controller.send(
        { contactId: 'ct-1', templateName: 't', variables: {}, locale: 'ar-MA', options: { preferChannel: 'email', skipOptOutCheck: false } } as any,
        mockUser as any,
      );
      expect(orchestrator.sendToContact).toHaveBeenCalledWith('ct-1', 't', {}, expect.objectContaining({ preferChannel: 'email', skipOptOutCheck: false, locale: 'ar-MA' }));
    });
  });

  describe('sendBatch', () => {
    it('queues batch up to 1000', async () => {
      const items = Array.from({ length: 5 }, (_, i) => ({ contactId: `ct-${i}`, variables: {} }));
      const result = await controller.sendBatch({ items, templateName: 't' } as any, mockUser as any);
      expect(result.enqueued).toBe(5);
    });

    it('rejects > 1000', async () => {
      const items = Array.from({ length: 1001 }, (_, i) => ({ contactId: `ct-${i}`, variables: {} }));
      await expect(controller.sendBatch({ items, templateName: 't' } as any, mockUser as any))
        .rejects.toThrow(BadRequestException);
    });

    it('captures errors per item', async () => {
      orchestrator.sendToContact.mockRejectedValueOnce(new Error('Contact opted out'));
      const items = [{ contactId: 'ct-1', variables: {} }, { contactId: 'ct-2', variables: {} }];
      const result = await controller.sendBatch({ items, templateName: 't' } as any, mockUser as any);
      expect(result.errors).toBe(1);
      expect(result.enqueued).toBe(1);
    });
  });

  describe('sendBroadcast', () => {
    it('returns 202 jobId + pollUrl', async () => {
      const result = await controller.sendBroadcast(
        { filters: { tags: ['premium'] }, templateName: 'newsletter', variables: {} } as any,
        mockUser as any,
      );
      expect(result.jobId).toBe('job-uuid-1');
      expect(result.estimatedRecipients).toBe(250);
      expect(result.pollUrl).toContain('/api/v1/comm/jobs/');
    });
  });

  describe('list', () => {
    it('returns paginated messages', async () => {
      const result = await controller.list({ limit: 20 } as any);
      expect(result.items).toHaveLength(2);
      expect(result.pagination.limit).toBe(20);
      expect(result.pagination.hasMore).toBe(false);
    });

    it('rejects invalid cursor', async () => {
      await expect(controller.list({ cursor: 'not-base64-!!!' } as any)).rejects.toThrow(BadRequestException);
    });

    it('rejects date range > 1 year', async () => {
      await expect(controller.list({
        dateFrom: '2020-01-01', dateTo: '2026-01-01', limit: 20,
      } as any)).rejects.toThrow(BadRequestException);
    });

    it('caps limit to MAX', async () => {
      process.env.COMM_PAGINATION_MAX_LIMIT = '100';
      await controller.list({ limit: 500 } as any);
      expect(messagesRepo.findAllPaginated).toHaveBeenCalledWith(expect.objectContaining({ limit: 101 }));
    });

    it('detects hasMore when overshoot', async () => {
      messagesRepo.findAllPaginated.mockResolvedValueOnce(Array.from({ length: 21 }, (_, i) => ({
        id: `m-${i}`, channel: 'whatsapp', direction: 'outbound', status: 'sent',
        sent_at: new Date(), created_at: new Date(),
      })));
      const result = await controller.list({ limit: 20 } as any);
      expect(result.items).toHaveLength(20);
      expect(result.pagination.hasMore).toBe(true);
      expect(result.pagination.cursor).toBeDefined();
    });
  });

  describe('getById', () => {
    it('returns message detail when tenant matches', async () => {
      const result = await controller.getById('msg-uuid-1');
      expect(result.id).toBe('msg-uuid-1');
    });

    it('throws 404 when cross-tenant', async () => {
      messagesRepo.findByIdAndTenant.mockResolvedValueOnce(null);
      await expect(controller.getById('msg-uuid-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getTimeline', () => {
    it('returns events ordered', async () => {
      const result = await controller.getTimeline('msg-uuid-1');
      expect(result.events).toHaveLength(3);
      expect(result.events[0].event).toBe('sent');
      expect(result.events[2].event).toBe('read');
    });
  });

  describe('softDelete', () => {
    it('soft-deletes when super_admin', async () => {
      await expect(controller.softDelete('msg-uuid-1', { ...mockUser, role: 'super_admin' } as any)).resolves.toBeUndefined();
      expect(messagesRepo.softDelete).toHaveBeenCalled();
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'comm.messages.soft_delete' }));
    });

    it('forbids non super_admin', async () => {
      await expect(controller.softDelete('msg-uuid-1', mockUser as any)).rejects.toThrow(ForbiddenException);
    });

    it('throws 404 if not found', async () => {
      messagesRepo.findByIdAndTenant.mockResolvedValueOnce(null);
      await expect(controller.softDelete('msg-uuid-1', { ...mockUser, role: 'super_admin' } as any)).rejects.toThrow(NotFoundException);
    });
  });
});
```

### 6.3 Fichier 3/12 : `messages-dto.ts`

```typescript
/**
 * @insurtech/api/modules/comm/dto/messages-dto
 *
 * DTOs Zod-based via createZodDto Sprint 3 + nestjs-zod auto OpenAPI sync.
 */

import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

const SendOptionsSchema = z.object({
  preferChannel: z.enum(['whatsapp', 'email', 'sms']).optional(),
  skipOptOutCheck: z.boolean().optional().default(false),
  correlationId: z.string().max(120).optional(),
}).optional();

const SendMessageSchema = z.object({
  contactId: z.string().uuid(),
  templateName: z.string().min(1).max(120),
  locale: z.enum(['fr', 'fr-MA', 'ar', 'ar-MA', 'en']).optional(),
  variables: z.record(z.unknown()).default({}),
  options: SendOptionsSchema,
});

export class SendMessageDto extends createZodDto(SendMessageSchema) {}

const SendMessageResponseSchema = z.object({
  messageId: z.string().uuid(),
  channel: z.enum(['whatsapp', 'email', 'sms', 'voice']),
  status: z.enum(['queued', 'sent', 'failed']),
});

export class SendMessageResponseDto extends createZodDto(SendMessageResponseSchema) {}

const SendBatchItemSchema = z.object({
  contactId: z.string().uuid(),
  variables: z.record(z.unknown()).default({}),
  locale: z.enum(['fr', 'fr-MA', 'ar', 'ar-MA', 'en']).optional(),
});

const SendBatchSchema = z.object({
  templateName: z.string().min(1).max(120),
  items: z.array(SendBatchItemSchema).min(1).max(1000),
});

export class SendBatchDto extends createZodDto(SendBatchSchema) {}

const SendBatchResponseSchema = z.object({
  enqueued: z.number().int().nonnegative(),
  errors: z.number().int().nonnegative(),
  items: z.array(z.object({
    messageId: z.string().uuid(),
    channel: z.string(),
    contactId: z.string().uuid(),
    status: z.string(),
  })),
  failures: z.array(z.object({ contactId: z.string().uuid(), error: z.string() })),
});

export class SendBatchResponseDto extends createZodDto(SendBatchResponseSchema) {}

const BroadcastFiltersSchema = z.object({
  tags: z.array(z.string()).optional(),
  preferred_channel: z.enum(['whatsapp', 'email', 'sms']).optional(),
  preferred_language: z.enum(['fr', 'fr-MA', 'ar', 'ar-MA', 'en']).optional(),
  region: z.string().optional(),
  city: z.string().optional(),
  hasOptedOut: z.boolean().optional(),
});

const SendBroadcastSchema = z.object({
  templateName: z.string().min(1).max(120),
  filters: BroadcastFiltersSchema,
  variables: z.record(z.unknown()).default({}),
  dryRun: z.boolean().optional().default(false),
});

export class SendBroadcastDto extends createZodDto(SendBroadcastSchema) {}

const SendBroadcastResponseSchema = z.object({
  jobId: z.string(),
  estimatedRecipients: z.number().int().nonnegative(),
  status: z.enum(['accepted', 'rejected']),
  pollUrl: z.string(),
});

export class SendBroadcastResponseDto extends createZodDto(SendBroadcastResponseSchema) {}

const MessagesFiltersSchema = z.object({
  channel: z.enum(['whatsapp', 'email', 'sms', 'voice']).optional(),
  direction: z.enum(['inbound', 'outbound']).optional(),
  status: z.enum(['pending', 'queued', 'sent', 'delivered', 'read', 'failed']).optional(),
  contactId: z.string().uuid().optional(),
  templateId: z.string().uuid().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  search: z.string().max(200).optional(),
  cursor: z.string().max(500).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  sort: z.enum(['sent_at_desc', 'sent_at_asc']).optional().default('sent_at_desc'),
});

export class MessagesFiltersDto extends createZodDto(MessagesFiltersSchema) {}

const MessageItemSchema = z.object({
  id: z.string().uuid(),
  channel: z.string(),
  direction: z.enum(['inbound', 'outbound']),
  status: z.string(),
  contact_id: z.string().uuid().nullable(),
  template_name: z.string().nullable(),
  to_address: z.string(),
  sent_at: z.date().nullable(),
  delivered_at: z.date().nullable(),
  read_at: z.date().nullable(),
  failed_at: z.date().nullable(),
  fail_reason: z.string().nullable(),
});

const MessageListResponseSchema = z.object({
  items: z.array(MessageItemSchema),
  pagination: z.object({
    cursor: z.string().optional(),
    hasMore: z.boolean(),
    limit: z.number().int(),
  }),
});

export class MessageListResponseDto extends createZodDto(MessageListResponseSchema) {}
export class MessageDetailDto extends createZodDto(MessageItemSchema.extend({ template_variables: z.record(z.unknown()).optional() })) {}

const TimelineEventSchema = z.object({
  event: z.enum(['sent', 'queued', 'delivered', 'read', 'failed', 'opened', 'clicked', 'bounced']),
  occurred_at: z.date(),
  details: z.record(z.unknown()).optional(),
});

const TimelineResponseSchema = z.object({
  messageId: z.string().uuid(),
  events: z.array(TimelineEventSchema),
});

export class TimelineResponseDto extends createZodDto(TimelineResponseSchema) {}
```

### 6.4 Fichier 4/12 : `comm-preferences.controller.ts`

```typescript
/**
 * @insurtech/api/modules/comm/controllers/comm-preferences
 *
 * REST endpoints `/api/v1/comm/preferences/*` :
 *   GET /                  (auth user retrieves own)
 *   PUT /                  (auth user updates own)
 *   GET /contact/:id       (admin lookup contact preferences in tenant)
 */

import {
  Body, Controller, Get, Param, ParseUUIDPipe, Put, UseGuards,
  NotFoundException, Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiHeader, ApiBody, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '@insurtech/auth/guards/jwt-auth.guard';
import { RequirePermission, RequirePermissionGuard } from '@insurtech/auth/rbac';
import { CurrentUser, type AuthUser } from '@insurtech/auth/decorators/current-user.decorator';
import { getCurrentTenantId } from '@insurtech/tenant/context';
import { ContactsService } from '@insurtech/crm/services/contacts.service';
import { OptoutService } from '@insurtech/comm/services/optout.service';
import { AuditService } from '@insurtech/audit/audit.service';
import { UpdatePreferencesDto, PreferencesResponseDto } from '../dto/preferences-dto.js';

@ApiTags('comm', 'preferences')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Tenant-Id', required: false })
@UseGuards(JwtAuthGuard, RequirePermissionGuard)
@Controller({ path: 'comm/preferences', version: '1' })
export class CommPreferencesController {
  private readonly logger = new Logger(CommPreferencesController.name);

  constructor(
    private readonly contacts: ContactsService,
    private readonly optoutService: OptoutService,
    private readonly audit: AuditService,
  ) {}

  @ApiOperation({ summary: 'Get current user preferences', description: 'Returns the authenticated user own preferences (preferred_channel, preferred_language, opted_out_channels).' })
  @ApiResponse({ status: 200, description: 'Preferences', type: PreferencesResponseDto })
  @RequirePermission('comm.preferences.manage')
  @Get()
  async getOwn(@CurrentUser() user: AuthUser): Promise<PreferencesResponseDto> {
    const tenantId = getCurrentTenantId()!;
    const contact = user.contactId
      ? await this.contacts.findByIdAndTenant(user.contactId, tenantId)
      : null;

    const optedOutChannels = contact ? await this.optoutService.getOptedOutChannels(contact.id) : [];

    return {
      preferred_channel: contact?.preferred_channel ?? 'email',
      preferred_language: contact?.preferred_language ?? 'fr-MA',
      frequency_caps: contact?.frequency_caps ?? null,
      opted_out_channels: optedOutChannels,
    };
  }

  @ApiOperation({ summary: 'Update current user preferences' })
  @ApiBody({ type: UpdatePreferencesDto })
  @ApiResponse({ status: 200, description: 'Updated preferences', type: PreferencesResponseDto })
  @RequirePermission('comm.preferences.manage')
  @Put()
  async updateOwn(
    @Body() dto: UpdatePreferencesDto,
    @CurrentUser() user: AuthUser,
  ): Promise<PreferencesResponseDto> {
    const tenantId = getCurrentTenantId()!;
    if (!user.contactId) {
      throw new NotFoundException({ code: 'CONTACT_NOT_FOUND', message: 'No contact bound to this user' });
    }

    const updated = await this.contacts.updatePreferences(user.contactId, tenantId, {
      preferred_channel: dto.preferred_channel,
      preferred_language: dto.preferred_language,
      frequency_caps: dto.frequency_caps,
    });

    await this.audit.log({
      tenant_id: tenantId, user_id: user.id, action: 'comm.preferences.update_own',
      resource_type: 'contact', resource_id: user.contactId,
      metadata: { preferred_channel: dto.preferred_channel, preferred_language: dto.preferred_language },
    });

    const optedOutChannels = await this.optoutService.getOptedOutChannels(user.contactId);

    return {
      preferred_channel: updated.preferred_channel,
      preferred_language: updated.preferred_language,
      frequency_caps: updated.frequency_caps,
      opted_out_channels: optedOutChannels,
    };
  }

  @ApiOperation({ summary: 'Admin lookup contact preferences (in tenant scope)' })
  @ApiParam({ name: 'id', description: 'Contact UUID' })
  @ApiResponse({ status: 200, description: 'Preferences', type: PreferencesResponseDto })
  @ApiResponse({ status: 404, description: 'Contact not found in tenant' })
  @RequirePermission('comm.preferences.manage')
  @Get('contact/:id')
  async getByContact(@Param('id', ParseUUIDPipe) contactId: string): Promise<PreferencesResponseDto> {
    const tenantId = getCurrentTenantId()!;
    const contact = await this.contacts.findByIdAndTenant(contactId, tenantId);
    if (!contact) throw new NotFoundException({ code: 'CONTACT_NOT_FOUND' });

    const optedOutChannels = await this.optoutService.getOptedOutChannels(contactId);

    return {
      preferred_channel: contact.preferred_channel ?? 'email',
      preferred_language: contact.preferred_language ?? 'fr-MA',
      frequency_caps: contact.frequency_caps ?? null,
      opted_out_channels: optedOutChannels,
    };
  }
}
```

### 6.5 Fichier 5/12 : `templates.controller.ts`

```typescript
/**
 * @insurtech/api/modules/comm/controllers/templates
 *
 * REST endpoints `/api/v1/comm/templates/*` :
 *   GET    /              (list paginated)
 *   POST   /              (create draft)
 *   GET    /:id           (detail)
 *   PUT    /:id           (update only if status=draft)
 *   DELETE /:id           (soft-delete + reject 409 if in-use)
 *   POST   /:id/submit    (workflow submit Meta approval Tache 3.2.5)
 *   GET    /meta-status   (sync states approved/rejected/pending Meta)
 */

import {
  Body, Controller, Delete, Get, Param, ParseUUIDPipe,
  Post, Put, Query, HttpCode, HttpStatus, UseGuards,
  NotFoundException, ConflictException, BadRequestException, Logger,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiHeader, ApiBody, ApiParam, ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@insurtech/auth/guards/jwt-auth.guard';
import { RequirePermission, RequirePermissionGuard } from '@insurtech/auth/rbac';
import { CurrentUser, type AuthUser } from '@insurtech/auth/decorators/current-user.decorator';
import { getCurrentTenantId } from '@insurtech/tenant/context';
import { TemplateManagerService } from '@insurtech/comm/services/template-manager.service';
import { AuditService } from '@insurtech/audit/audit.service';
import {
  CreateTemplateDto, UpdateTemplateDto, TemplatesFiltersDto,
  TemplateListResponseDto, TemplateDetailDto, MetaStatusResponseDto,
} from '../dto/templates-dto.js';
import { encodeCursor, decodeCursor } from '../utils/cursor.util.js';

@ApiTags('comm', 'templates')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Tenant-Id', required: false })
@UseGuards(JwtAuthGuard, RequirePermissionGuard)
@Controller({ path: 'comm/templates', version: '1' })
export class TemplatesController {
  private readonly logger = new Logger(TemplatesController.name);

  constructor(
    private readonly templateManager: TemplateManagerService,
    private readonly audit: AuditService,
  ) {}

  @ApiOperation({ summary: 'List templates paginated multi-tenant' })
  @ApiQuery({ name: 'name', required: false })
  @ApiQuery({ name: 'language', required: false, enum: ['fr', 'fr-MA', 'ar', 'ar-MA', 'en'] })
  @ApiQuery({ name: 'status', required: false, enum: ['draft', 'pending_review', 'approved', 'rejected', 'archived'] })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({ status: 200, type: TemplateListResponseDto })
  @RequirePermission('comm.templates.read')
  @Get()
  async list(@Query() filters: TemplatesFiltersDto): Promise<TemplateListResponseDto> {
    const tenantId = getCurrentTenantId()!;
    const limit = Math.min(filters.limit ?? 20, 100);
    let decodedCursor: { lastId: string; lastCreatedAt: string } | null = null;
    if (filters.cursor) {
      try { decodedCursor = decodeCursor(filters.cursor); }
      catch { throw new BadRequestException({ code: 'INVALID_CURSOR' }); }
    }

    const rows = await this.templateManager.list({
      tenantId, name: filters.name, language: filters.language, status: filters.status,
      cursor: decodedCursor, limit: limit + 1,
    });
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit);
    const last = items[items.length - 1];
    const cursor = hasMore && last ? encodeCursor({ lastId: last.id, lastCreatedAt: last.created_at.toISOString() }) : undefined;
    return { items, pagination: { cursor, hasMore, limit } };
  }

  @ApiOperation({ summary: 'Create draft template' })
  @ApiBody({ type: CreateTemplateDto })
  @ApiResponse({ status: 201, type: TemplateDetailDto })
  @RequirePermission('comm.templates.manage')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateTemplateDto, @CurrentUser() user: AuthUser): Promise<TemplateDetailDto> {
    const tenantId = getCurrentTenantId()!;
    const created = await this.templateManager.create({ ...dto, tenantId, createdBy: user.id });
    await this.audit.log({
      tenant_id: tenantId, user_id: user.id, action: 'comm.templates.create',
      resource_type: 'comm_template', resource_id: created.id,
      metadata: { name: created.name, language: created.language },
    });
    return created;
  }

  @ApiOperation({ summary: 'Get template detail' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, type: TemplateDetailDto })
  @RequirePermission('comm.templates.read')
  @Get(':id')
  async getById(@Param('id', ParseUUIDPipe) id: string): Promise<TemplateDetailDto> {
    const tenantId = getCurrentTenantId()!;
    const template = await this.templateManager.findByIdAndTenant(id, tenantId);
    if (!template) throw new NotFoundException({ code: 'TEMPLATE_NOT_FOUND' });
    return template;
  }

  @ApiOperation({ summary: 'Update template (only if status=draft)' })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: UpdateTemplateDto })
  @ApiResponse({ status: 200, type: TemplateDetailDto })
  @ApiResponse({ status: 409, description: 'Cannot edit non-draft template' })
  @RequirePermission('comm.templates.manage')
  @Put(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTemplateDto,
    @CurrentUser() user: AuthUser,
  ): Promise<TemplateDetailDto> {
    const tenantId = getCurrentTenantId()!;
    const template = await this.templateManager.findByIdAndTenant(id, tenantId);
    if (!template) throw new NotFoundException({ code: 'TEMPLATE_NOT_FOUND' });
    if (template.status !== 'draft') {
      throw new ConflictException({ code: 'TEMPLATE_NOT_DRAFT', message: 'Only draft templates can be updated' });
    }
    const updated = await this.templateManager.update(id, tenantId, { ...dto, updatedBy: user.id });
    await this.audit.log({
      tenant_id: tenantId, user_id: user.id, action: 'comm.templates.update',
      resource_type: 'comm_template', resource_id: id,
    });
    return updated;
  }

  @ApiOperation({ summary: 'Soft-delete template (reject 409 if referenced by messages)' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 204, description: 'Soft-deleted' })
  @ApiResponse({ status: 409, description: 'Template in use' })
  @RequirePermission('comm.templates.manage')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async softDelete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    const tenantId = getCurrentTenantId()!;
    const inUse = await this.templateManager.countMessagesUsingTemplate(id, tenantId);
    if (inUse > 0) {
      throw new ConflictException({
        code: 'TEMPLATE_IN_USE',
        message: `Template referenced by ${inUse} messages. Archive instead.`,
        details: { in_use_count: inUse },
      });
    }
    await this.templateManager.softDelete(id, tenantId, { deletedBy: user.id });
    await this.audit.log({
      tenant_id: tenantId, user_id: user.id, action: 'comm.templates.delete',
      resource_type: 'comm_template', resource_id: id,
    });
  }

  @ApiOperation({ summary: 'Submit template to Meta for approval (workflow Tache 3.2.5)' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, type: TemplateDetailDto, description: 'Submitted, status=pending_review' })
  @RequirePermission('comm.templates.manage')
  @Post(':id/submit')
  async submitMeta(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<TemplateDetailDto> {
    const tenantId = getCurrentTenantId()!;
    const result = await this.templateManager.submitForApproval(id, tenantId);
    await this.audit.log({
      tenant_id: tenantId, user_id: user.id, action: 'comm.templates.submit_meta',
      resource_type: 'comm_template', resource_id: id,
      metadata: { meta_template_id: result.meta_template_id },
    });
    return result;
  }

  @ApiOperation({ summary: 'Sync Meta states for all templates of tenant' })
  @ApiResponse({ status: 200, type: MetaStatusResponseDto })
  @RequirePermission('comm.templates.manage')
  @Get('meta-status')
  async metaStatus(): Promise<MetaStatusResponseDto> {
    const tenantId = getCurrentTenantId()!;
    const synced = await this.templateManager.syncMetaStatus(tenantId);
    return { synced_count: synced.length, items: synced };
  }
}
```

### 6.6 Fichier 6/12 : `comm-stats.controller.ts`

```typescript
/**
 * @insurtech/api/modules/comm/controllers/comm-stats
 *
 * REST endpoints `/api/v1/comm/stats/*` :
 *   GET /                       (period=7d|30d|90d default 30d)
 *   GET /by-template            (top templates engagement)
 *   GET /by-channel             (split WA/Email)
 */

import {
  Controller, Get, Query, UseGuards, BadRequestException, Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { JwtAuthGuard } from '@insurtech/auth/guards/jwt-auth.guard';
import { RequirePermission, RequirePermissionGuard } from '@insurtech/auth/rbac';
import { getCurrentTenantId } from '@insurtech/tenant/context';
import { DeliveryTrackingService } from '@insurtech/comm/services/delivery-tracking.service';
import {
  StatsResponseDto, StatsByTemplateDto, StatsByChannelDto, StatsFiltersDto,
} from '../dto/stats-dto.js';

@ApiTags('comm', 'stats')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Tenant-Id', required: false })
@UseGuards(JwtAuthGuard, RequirePermissionGuard)
@Controller({ path: 'comm/stats', version: '1' })
export class CommStatsController {
  private readonly logger = new Logger(CommStatsController.name);

  constructor(private readonly deliveryTracking: DeliveryTrackingService) {}

  @ApiOperation({ summary: 'Aggregate stats (delivery_rate, bounce_rate, open_rate, click_rate)' })
  @ApiQuery({ name: 'period', required: false, enum: ['7d', '30d', '90d'] })
  @ApiResponse({ status: 200, type: StatsResponseDto })
  @RequirePermission('comm.stats.read')
  @Get()
  async getStats(@Query() filters: StatsFiltersDto): Promise<StatsResponseDto> {
    const tenantId = getCurrentTenantId()!;
    const period = filters.period ?? '30d';
    const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
    const dateFrom = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const aggregates = await this.deliveryTracking.computeAggregates({ tenantId, dateFrom });
    return {
      period,
      delivery_rate: aggregates.delivery_rate,
      bounce_rate: aggregates.bounce_rate,
      open_rate: aggregates.open_rate,
      click_rate: aggregates.click_rate,
      total_sent: aggregates.total_sent,
      total_delivered: aggregates.total_delivered,
      total_failed: aggregates.total_failed,
      total_opened: aggregates.total_opened,
      total_clicked: aggregates.total_clicked,
      computed_at: new Date(),
    };
  }

  @ApiOperation({ summary: 'Stats by template (top N engagement)' })
  @ApiQuery({ name: 'period', required: false, enum: ['7d', '30d', '90d'] })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({ status: 200, type: StatsByTemplateDto })
  @RequirePermission('comm.stats.read')
  @Get('by-template')
  async byTemplate(
    @Query('period') period?: '7d' | '30d' | '90d',
    @Query('limit') limit?: string,
  ): Promise<StatsByTemplateDto> {
    const tenantId = getCurrentTenantId()!;
    const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
    const dateFrom = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const lim = Math.min(Number.parseInt(limit ?? '10', 10), 50);
    const items = await this.deliveryTracking.statsByTemplate({ tenantId, dateFrom, limit: lim });
    return { period: period ?? '30d', items };
  }

  @ApiOperation({ summary: 'Stats by channel (whatsapp vs email)' })
  @ApiQuery({ name: 'period', required: false, enum: ['7d', '30d', '90d'] })
  @ApiResponse({ status: 200, type: StatsByChannelDto })
  @RequirePermission('comm.stats.read')
  @Get('by-channel')
  async byChannel(@Query('period') period?: '7d' | '30d' | '90d'): Promise<StatsByChannelDto> {
    const tenantId = getCurrentTenantId()!;
    const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
    const dateFrom = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const items = await this.deliveryTracking.statsByChannel({ tenantId, dateFrom });
    return { period: period ?? '30d', items };
  }
}
```

### 6.7 Fichier 7/12 : `optout.controller.ts` (REFERENCE Tache 3.2.11)

```typescript
/**
 * REFERENCE Tache 3.2.11 : optout.controller.ts complete (~150 lignes).
 *
 * Routes :
 *   GET  /api/v1/public/optout/:token         -- HTML page confirm
 *   POST /api/v1/public/optout/one-click      -- RFC 8058 List-Unsubscribe-Post
 *   GET  /api/v1/comm/optouts                 -- super_admin platform list
 *   POST /api/v1/comm/optouts/:contactId      -- admin manual opt-out
 *
 * RBAC ajoute Tache 3.2.12 :
 *   - GET /api/v1/comm/optouts        : @RequirePermission('comm.optouts.read') -> super_admin only (CNDP)
 *   - POST /api/v1/comm/optouts/:id   : @RequirePermission('comm.optouts.manage') -> broker_admin in tenant
 *
 * Securite renforcee Tache 3.2.12 :
 *   - Multi-tenant filter sur GET /optouts (super_admin voit cross-tenant only via audit)
 *   - Public endpoints (GET token + one-click) : no auth, signature JWT only
 */

// Code complet en Tache 3.2.11 (~200 lignes service + controller).
// Cette tache 3.2.12 ajoute uniquement les ApiTags + RBAC decorators sur l admin endpoints.
```

### 6.8 Fichier 8/12 : `templates-dto.ts`

```typescript
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

const TemplateLanguageEnum = z.enum(['fr', 'fr-MA', 'ar', 'ar-MA', 'en']);
const TemplateStatusEnum = z.enum(['draft', 'pending_review', 'approved', 'rejected', 'archived']);

const CreateTemplateSchema = z.object({
  name: z.string().min(1).max(120).regex(/^[a-z0-9_]+$/, 'Snake_case lowercase only'),
  language: TemplateLanguageEnum,
  category: z.enum(['authentication', 'transactional', 'marketing', 'utility']),
  channel: z.enum(['whatsapp', 'email']),
  subject_template: z.string().max(200).optional(),
  body_template: z.string().min(1).max(2048),
  variables_schema: z.record(z.unknown()).optional(),
});

export class CreateTemplateDto extends createZodDto(CreateTemplateSchema) {}

const UpdateTemplateSchema = CreateTemplateSchema.partial().extend({
  expected_version: z.string().optional(),
});

export class UpdateTemplateDto extends createZodDto(UpdateTemplateSchema) {}

const TemplatesFiltersSchema = z.object({
  name: z.string().max(120).optional(),
  language: TemplateLanguageEnum.optional(),
  status: TemplateStatusEnum.optional(),
  category: z.string().optional(),
  cursor: z.string().max(500).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export class TemplatesFiltersDto extends createZodDto(TemplatesFiltersSchema) {}

const TemplateItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  language: TemplateLanguageEnum,
  category: z.string(),
  channel: z.string(),
  status: TemplateStatusEnum,
  subject_template: z.string().nullable(),
  body_template: z.string(),
  meta_template_id: z.string().nullable(),
  meta_template_status: z.string().nullable(),
  created_at: z.date(),
  updated_at: z.date(),
});

export class TemplateDetailDto extends createZodDto(TemplateItemSchema) {}

const TemplateListResponseSchema = z.object({
  items: z.array(TemplateItemSchema),
  pagination: z.object({ cursor: z.string().optional(), hasMore: z.boolean(), limit: z.number().int() }),
});

export class TemplateListResponseDto extends createZodDto(TemplateListResponseSchema) {}

const MetaStatusResponseSchema = z.object({
  synced_count: z.number().int().nonnegative(),
  items: z.array(z.object({
    template_id: z.string().uuid(),
    name: z.string(),
    language: TemplateLanguageEnum,
    meta_template_id: z.string().nullable(),
    previous_status: z.string(),
    current_status: z.string(),
  })),
});

export class MetaStatusResponseDto extends createZodDto(MetaStatusResponseSchema) {}
```

### 6.9 Fichier 9/12 : `stats-dto.ts`

```typescript
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

const StatsFiltersSchema = z.object({
  period: z.enum(['7d', '30d', '90d']).optional().default('30d'),
});

export class StatsFiltersDto extends createZodDto(StatsFiltersSchema) {}

const StatsResponseSchema = z.object({
  period: z.enum(['7d', '30d', '90d']),
  delivery_rate: z.number().min(0).max(1),
  bounce_rate: z.number().min(0).max(1),
  open_rate: z.number().min(0).max(1),
  click_rate: z.number().min(0).max(1),
  total_sent: z.number().int().nonnegative(),
  total_delivered: z.number().int().nonnegative(),
  total_failed: z.number().int().nonnegative(),
  total_opened: z.number().int().nonnegative(),
  total_clicked: z.number().int().nonnegative(),
  computed_at: z.date(),
});

export class StatsResponseDto extends createZodDto(StatsResponseSchema) {}

const StatsByTemplateSchema = z.object({
  period: z.enum(['7d', '30d', '90d']),
  items: z.array(z.object({
    template_name: z.string(),
    total_sent: z.number().int(),
    delivered_rate: z.number().min(0).max(1),
    open_rate: z.number().min(0).max(1),
    click_rate: z.number().min(0).max(1),
  })),
});

export class StatsByTemplateDto extends createZodDto(StatsByTemplateSchema) {}

const StatsByChannelSchema = z.object({
  period: z.enum(['7d', '30d', '90d']),
  items: z.array(z.object({
    channel: z.enum(['whatsapp', 'email', 'sms', 'voice']),
    total_sent: z.number().int(),
    delivered_rate: z.number().min(0).max(1),
    bounce_rate: z.number().min(0).max(1),
    avg_latency_ms: z.number().int().nonnegative(),
  })),
});

export class StatsByChannelDto extends createZodDto(StatsByChannelSchema) {}
```

### 6.10 Fichier 10/12 : `preferences-dto.ts`

```typescript
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

const PreferencesLanguageEnum = z.enum(['fr', 'fr-MA', 'ar', 'ar-MA', 'en']);
const PreferencesChannelEnum = z.enum(['whatsapp', 'email', 'sms']);

const FrequencyCapsSchema = z.object({
  daily_max: z.number().int().min(0).max(50).optional(),
  weekly_max: z.number().int().min(0).max(200).optional(),
  hours_quiet_start: z.number().int().min(0).max(23).optional(),
  hours_quiet_end: z.number().int().min(0).max(23).optional(),
}).optional();

const UpdatePreferencesSchema = z.object({
  preferred_channel: PreferencesChannelEnum.optional(),
  preferred_language: PreferencesLanguageEnum.optional(),
  frequency_caps: FrequencyCapsSchema,
});

export class UpdatePreferencesDto extends createZodDto(UpdatePreferencesSchema) {}

const PreferencesResponseSchema = z.object({
  preferred_channel: PreferencesChannelEnum,
  preferred_language: PreferencesLanguageEnum,
  frequency_caps: FrequencyCapsSchema.nullable(),
  opted_out_channels: z.array(z.enum(['whatsapp', 'email', 'sms', 'voice'])),
});

export class PreferencesResponseDto extends createZodDto(PreferencesResponseSchema) {}
```

### 6.11 Fichier 11/12 : `comm.module.ts`

```typescript
/**
 * @insurtech/api/modules/comm/comm.module
 *
 * NestJS module register all comm controllers + services + middleware.
 *
 * Reference Sprint 9 Taches 3.2.1-3.2.13.
 */

import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { CommModule as CommCoreModule } from '@insurtech/comm';
import { CrmModule } from '@insurtech/crm';
import { AuthModule } from '@insurtech/auth';
import { TenantModule } from '@insurtech/tenant';
import { AuditModule } from '@insurtech/audit';
import { JobsModule } from '@insurtech/jobs';

import { MessagesController } from './controllers/messages.controller.js';
import { TemplatesController } from './controllers/templates.controller.js';
import { CommStatsController } from './controllers/comm-stats.controller.js';
import { CommPreferencesController } from './controllers/comm-preferences.controller.js';
import { OptoutController } from './controllers/optout.controller.js';
import { WaWebhookController } from './controllers/wa-webhook.controller.js';
import { MailgunWebhookController } from './controllers/mailgun-webhook.controller.js';

import { WaSignatureMiddleware } from './middleware/wa-signature.middleware.js';
import { MailgunSignatureMiddleware } from './middleware/mailgun-signature.middleware.js';
import { TenantContextMiddleware } from '@insurtech/tenant/middleware/tenant-context.middleware';
import { IdempotencyMiddleware } from '@insurtech/api/middleware/idempotency.middleware';
import { RateLimitMiddleware } from '@insurtech/api/middleware/rate-limit.middleware';

import { WaSendWorker } from '@insurtech/comm/workers/wa-send.worker';
import { EmailSendWorker } from '@insurtech/comm/workers/email-send.worker';
import { WaWebhookProcessConsumer } from './consumers/wa-webhook-processor.consumer.js';
import { MailgunWebhookProcessConsumer } from './consumers/mailgun-webhook-processor.consumer.js';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({ imports: [ConfigModule], useFactory: (cfg) => ({ secret: cfg.get('JWT_SECRET'), signOptions: { expiresIn: '1h' } }), inject: [ConfigModule.forRoot] }),
    CommCoreModule,
    CrmModule,
    AuthModule,
    TenantModule,
    AuditModule,
    JobsModule,
  ],
  controllers: [
    MessagesController,
    TemplatesController,
    CommStatsController,
    CommPreferencesController,
    OptoutController,
    WaWebhookController,
    MailgunWebhookController,
  ],
  providers: [
    WaSendWorker,
    EmailSendWorker,
    WaWebhookProcessConsumer,
    MailgunWebhookProcessConsumer,
  ],
})
export class CommModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // WA webhook signature : pas auth JWT mais HMAC verification
    consumer
      .apply(WaSignatureMiddleware)
      .forRoutes({ path: 'public/webhooks/whatsapp', method: RequestMethod.POST });

    // Mailgun webhook signature
    consumer
      .apply(MailgunSignatureMiddleware)
      .forRoutes({ path: 'public/webhooks/mailgun', method: RequestMethod.POST });

    // Tenant context (extract X-Tenant-Id or JWT.tenant_id) sur tous endpoints comm prives
    consumer
      .apply(TenantContextMiddleware)
      .exclude(
        { path: 'public/webhooks/whatsapp', method: RequestMethod.ALL },
        { path: 'public/webhooks/mailgun', method: RequestMethod.ALL },
        { path: 'public/optout/:token', method: RequestMethod.ALL },
        { path: 'public/optout/one-click', method: RequestMethod.POST },
      )
      .forRoutes('comm/*');

    // Idempotency middleware sur send endpoints
    consumer
      .apply(IdempotencyMiddleware)
      .forRoutes(
        { path: 'comm/messages/send', method: RequestMethod.POST },
        { path: 'comm/messages/send-batch', method: RequestMethod.POST },
        { path: 'comm/messages/send-broadcast', method: RequestMethod.POST },
      );

    // Rate limit specifique comm 100/min/tenant
    consumer
      .apply(RateLimitMiddleware)
      .forRoutes(
        { path: 'comm/messages/send', method: RequestMethod.POST },
        { path: 'comm/messages/send-batch', method: RequestMethod.POST },
        { path: 'comm/messages/send-broadcast', method: RequestMethod.POST },
      );
  }
}
```

### 6.12 Fichier 12/12 : `comm-tags.ts` + `cursor.util.ts`

```typescript
// repo/apps/api/src/modules/comm/openapi/comm-tags.ts
import { ApiResponse } from '@nestjs/swagger';
import { applyDecorators } from '@nestjs/common';

export const COMM_TAGS = {
  messages: { name: 'comm-messages', description: 'Send + list + timeline messages WhatsApp / Email Sprint 9' },
  templates: { name: 'comm-templates', description: 'CRUD templates + workflow Meta approval' },
  stats: { name: 'comm-stats', description: 'Aggregates delivery / bounce / open / click rates' },
  preferences: { name: 'comm-preferences', description: 'User self preferences + admin contact lookup' },
  optouts: { name: 'comm-optouts', description: 'CNDP loi 09-08 opt-out management' },
};

export function CommonApiResponses(): MethodDecorator {
  return applyDecorators(
    ApiResponse({ status: 400, description: 'Validation error / cursor invalid / date range too large' }),
    ApiResponse({ status: 401, description: 'Unauthorized - missing or invalid JWT' }),
    ApiResponse({ status: 403, description: 'Forbidden - missing required permission' }),
    ApiResponse({ status: 404, description: 'Not found or cross-tenant isolation' }),
    ApiResponse({ status: 429, description: 'Rate limit exceeded' }),
    ApiResponse({ status: 500, description: 'Internal server error' }),
  );
}

// repo/apps/api/src/modules/comm/utils/cursor.util.ts
export function encodeCursor(data: Record<string, string>): string {
  return Buffer.from(JSON.stringify(data)).toString('base64url');
}

export function decodeCursor<T = Record<string, string>>(cursor: string): T {
  const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf-8'));
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Invalid cursor format');
  }
  return parsed as T;
}
```

---

## 7. Tests E2E exhaustifs

### 7.1 Tests `messages-controller.e2e-spec.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { Test } from '@nestjs/testing';
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { AppModule } from '../../src/app.module.js';
import {
  signinTestUser, createTestTenant, createTestContact, createTestTemplate,
  cleanupTestTenant, makeAuthHeader,
} from './fixtures/comm-test-helpers.js';

describe('MessagesController (E2E)', () => {
  let app: NestFastifyApplication;
  let tenantA: { id: string; jwt: string; userId: string };
  let tenantB: { id: string; jwt: string; userId: string };
  let contactA: { id: string };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => { await app.close(); });

  beforeEach(async () => {
    tenantA = await createTestTenant({ name: 'Broker Test A' });
    tenantB = await createTestTenant({ name: 'Broker Test B' });
    contactA = await createTestContact(tenantA.id, { phone: '+212612345678', preferred_channel: 'whatsapp', preferred_language: 'fr-MA' });
    await createTestTemplate(tenantA.id, { name: 'appointment_reminder', language: 'fr-MA', status: 'approved', meta_template_status: 'approved' });
  });

  describe('POST /api/v1/comm/messages/send', () => {
    it('orchestrates send + returns messageId + channel', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/comm/messages/send')
        .set(makeAuthHeader(tenantA))
        .send({
          contactId: contactA.id, templateName: 'appointment_reminder',
          variables: { user_name: 'Mohamed', appointment_time: '15:00' },
        });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        success: true,
        data: { messageId: expect.any(String), channel: 'whatsapp', status: 'queued' },
        meta: { traceId: expect.any(String), requestId: expect.any(String), tenantId: tenantA.id },
        errors: [],
      });
    });

    it('returns 403 without permission', async () => {
      const restrictedUser = await signinTestUser({ tenantId: tenantA.id, role: 'viewer', permissions: ['comm.messages.read'] });
      const res = await request(app.getHttpServer())
        .post('/api/v1/comm/messages/send')
        .set('Authorization', `Bearer ${restrictedUser.jwt}`)
        .set('X-Tenant-Id', tenantA.id)
        .send({ contactId: contactA.id, templateName: 'appointment_reminder', variables: {} });
      expect(res.status).toBe(403);
      expect(res.body.errors[0].code).toBe('PERMISSION_DENIED');
    });

    it('returns 400 without tenant header', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/comm/messages/send')
        .set('Authorization', `Bearer ${tenantA.jwt}`)
        .send({ contactId: contactA.id, templateName: 'appointment_reminder', variables: {} });
      expect(res.status).toBe(400);
      expect(res.body.errors[0].code).toBe('BAD_TENANT_HEADER');
    });

    it('returns 404 for cross-tenant contact', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/comm/messages/send')
        .set(makeAuthHeader(tenantB))
        .send({ contactId: contactA.id, templateName: 'appointment_reminder', variables: {} });
      expect(res.status).toBe(404);
    });

    it('respects Idempotency-Key (Sprint 3)', async () => {
      const idemKey = 'idem-test-123';
      const res1 = await request(app.getHttpServer())
        .post('/api/v1/comm/messages/send')
        .set(makeAuthHeader(tenantA))
        .set('Idempotency-Key', idemKey)
        .send({ contactId: contactA.id, templateName: 'appointment_reminder', variables: {} });

      const res2 = await request(app.getHttpServer())
        .post('/api/v1/comm/messages/send')
        .set(makeAuthHeader(tenantA))
        .set('Idempotency-Key', idemKey)
        .send({ contactId: contactA.id, templateName: 'appointment_reminder', variables: {} });

      expect(res1.body.data.messageId).toBe(res2.body.data.messageId);
    });

    it('returns 409 if Idempotency-Key with different body', async () => {
      const idemKey = 'idem-conflict-1';
      await request(app.getHttpServer())
        .post('/api/v1/comm/messages/send')
        .set(makeAuthHeader(tenantA))
        .set('Idempotency-Key', idemKey)
        .send({ contactId: contactA.id, templateName: 'appointment_reminder', variables: {} });

      const res = await request(app.getHttpServer())
        .post('/api/v1/comm/messages/send')
        .set(makeAuthHeader(tenantA))
        .set('Idempotency-Key', idemKey)
        .send({ contactId: contactA.id, templateName: 'different_template', variables: {} });

      expect(res.status).toBe(409);
    });

    it('validates Zod schema', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/comm/messages/send')
        .set(makeAuthHeader(tenantA))
        .send({ contactId: 'not-uuid', templateName: '', variables: {} });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /send-batch', () => {
    it('queues 5 items', async () => {
      const items = Array.from({ length: 5 }, (_, i) => ({ contactId: contactA.id, variables: { i } }));
      const res = await request(app.getHttpServer())
        .post('/api/v1/comm/messages/send-batch')
        .set(makeAuthHeader(tenantA))
        .send({ templateName: 'appointment_reminder', items });
      expect(res.status).toBe(201);
      expect(res.body.data.enqueued).toBe(5);
    });

    it('rejects > 1000 items', async () => {
      const items = Array.from({ length: 1001 }, () => ({ contactId: contactA.id, variables: {} }));
      const res = await request(app.getHttpServer())
        .post('/api/v1/comm/messages/send-batch')
        .set(makeAuthHeader(tenantA))
        .send({ templateName: 'appointment_reminder', items });
      expect(res.status).toBe(400);
      expect(res.body.errors[0].code).toBe('BATCH_TOO_LARGE');
    });
  });

  describe('POST /send-broadcast', () => {
    it('returns 202 + jobId + pollUrl (broker_admin only)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/comm/messages/send-broadcast')
        .set(makeAuthHeader(tenantA))
        .send({
          templateName: 'appointment_reminder',
          filters: { tags: ['premium'] },
          variables: {},
        });
      expect(res.status).toBe(202);
      expect(res.body.data).toMatchObject({
        jobId: expect.any(String),
        estimatedRecipients: expect.any(Number),
        status: 'accepted',
        pollUrl: expect.stringContaining('/api/v1/comm/jobs/'),
      });
    });

    it('returns 403 for broker_user without send_broadcast', async () => {
      const userJunior = await signinTestUser({ tenantId: tenantA.id, role: 'broker_user', permissions: ['comm.messages.send'] });
      const res = await request(app.getHttpServer())
        .post('/api/v1/comm/messages/send-broadcast')
        .set('Authorization', `Bearer ${userJunior.jwt}`)
        .set('X-Tenant-Id', tenantA.id)
        .send({ templateName: 'x', filters: {}, variables: {} });
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/v1/comm/messages', () => {
    it('lists messages filtered by channel + status', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/comm/messages?channel=whatsapp&status=delivered&limit=20')
        .set(makeAuthHeader(tenantA));
      expect(res.status).toBe(200);
      expect(res.body.meta.pagination).toMatchObject({ hasMore: expect.any(Boolean), limit: 20 });
    });

    it('paginates with cursor', async () => {
      const res1 = await request(app.getHttpServer())
        .get('/api/v1/comm/messages?limit=5')
        .set(makeAuthHeader(tenantA));
      if (res1.body.meta.pagination.hasMore) {
        const cursor = res1.body.meta.pagination.cursor;
        const res2 = await request(app.getHttpServer())
          .get(`/api/v1/comm/messages?limit=5&cursor=${cursor}`)
          .set(makeAuthHeader(tenantA));
        expect(res2.status).toBe(200);
        const ids1 = res1.body.data.map((m: any) => m.id);
        const ids2 = res2.body.data.map((m: any) => m.id);
        expect(ids1.some((id: string) => ids2.includes(id))).toBe(false);
      }
    });

    it('rejects invalid cursor base64', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/comm/messages?cursor=NOT_BASE64_!!!')
        .set(makeAuthHeader(tenantA));
      expect(res.status).toBe(400);
      expect(res.body.errors[0].code).toBe('INVALID_CURSOR');
    });

    it('rejects date range > 1 year', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/comm/messages?date_from=2020-01-01&date_to=2026-01-01')
        .set(makeAuthHeader(tenantA));
      expect(res.status).toBe(400);
      expect(res.body.errors[0].code).toBe('DATE_RANGE_TOO_LARGE');
    });

    it('rejects search > 200 chars', async () => {
      const longSearch = 'x'.repeat(201);
      const res = await request(app.getHttpServer())
        .get(`/api/v1/comm/messages?search=${encodeURIComponent(longSearch)}`)
        .set(makeAuthHeader(tenantA));
      expect(res.status).toBe(400);
    });

    it('isolates multi-tenant strict', async () => {
      // tenantA messages dont leak to tenantB
      const res = await request(app.getHttpServer())
        .get('/api/v1/comm/messages')
        .set(makeAuthHeader(tenantB));
      const ids = res.body.data.map((m: any) => m.id);
      // sanity : no message from tenantA
      expect(ids).toEqual([]);
    });
  });

  describe('GET /:id', () => {
    it('returns 404 if cross-tenant', async () => {
      const sendRes = await request(app.getHttpServer())
        .post('/api/v1/comm/messages/send')
        .set(makeAuthHeader(tenantA))
        .send({ contactId: contactA.id, templateName: 'appointment_reminder', variables: {} });
      const messageId = sendRes.body.data.messageId;

      const res = await request(app.getHttpServer())
        .get(`/api/v1/comm/messages/${messageId}`)
        .set(makeAuthHeader(tenantB));
      expect(res.status).toBe(404);
    });
  });

  describe('GET /:id/timeline', () => {
    it('returns events ordered ASC', async () => {
      const sendRes = await request(app.getHttpServer())
        .post('/api/v1/comm/messages/send')
        .set(makeAuthHeader(tenantA))
        .send({ contactId: contactA.id, templateName: 'appointment_reminder', variables: {} });
      const messageId = sendRes.body.data.messageId;

      const res = await request(app.getHttpServer())
        .get(`/api/v1/comm/messages/${messageId}/timeline`)
        .set(makeAuthHeader(tenantA));
      expect(res.status).toBe(200);
      expect(res.body.data.events).toEqual(expect.any(Array));
    });
  });

  describe('DELETE /:id', () => {
    it('forbids non super_admin', async () => {
      const sendRes = await request(app.getHttpServer())
        .post('/api/v1/comm/messages/send')
        .set(makeAuthHeader(tenantA))
        .send({ contactId: contactA.id, templateName: 'appointment_reminder', variables: {} });
      const messageId = sendRes.body.data.messageId;

      const res = await request(app.getHttpServer())
        .delete(`/api/v1/comm/messages/${messageId}`)
        .set(makeAuthHeader(tenantA));
      expect(res.status).toBe(403);
    });

    it('soft-deletes preserves audit when super_admin', async () => {
      const superAdmin = await signinTestUser({ tenantId: tenantA.id, role: 'super_admin', permissions: ['comm.messages.delete'] });
      const sendRes = await request(app.getHttpServer())
        .post('/api/v1/comm/messages/send')
        .set(makeAuthHeader(tenantA))
        .send({ contactId: contactA.id, templateName: 'appointment_reminder', variables: {} });
      const messageId = sendRes.body.data.messageId;

      const res = await request(app.getHttpServer())
        .delete(`/api/v1/comm/messages/${messageId}`)
        .set('Authorization', `Bearer ${superAdmin.jwt}`)
        .set('X-Tenant-Id', tenantA.id);
      expect(res.status).toBe(204);

      // Subsequent GET retourne 404
      const get = await request(app.getHttpServer())
        .get(`/api/v1/comm/messages/${messageId}`)
        .set(makeAuthHeader(tenantA));
      expect(get.status).toBe(404);
    });
  });

  describe('Rate limit', () => {
    it('respects 100/min/tenant on /send', async () => {
      // Best effort -- 105 send rapid + last 5 rejected 429
      let success = 0; let rateLimited = 0;
      for (let i = 0; i < 105; i++) {
        const r = await request(app.getHttpServer())
          .post('/api/v1/comm/messages/send')
          .set(makeAuthHeader(tenantA))
          .send({ contactId: contactA.id, templateName: 'appointment_reminder', variables: {} });
        if (r.status === 201) success++;
        else if (r.status === 429) rateLimited++;
      }
      expect(rateLimited).toBeGreaterThan(0);
    }, 30000);
  });
});
```

### 7.2 Tests `templates-controller.e2e-spec.ts` (12+ tests)

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { Test } from '@nestjs/testing';
import { NestFastifyApplication, FastifyAdapter } from '@nestjs/platform-fastify';
import { AppModule } from '../../src/app.module.js';
import { signinTestUser, createTestTenant, createTestTemplate, makeAuthHeader } from './fixtures/comm-test-helpers.js';

describe('TemplatesController (E2E)', () => {
  let app: NestFastifyApplication;
  let tenantA: { id: string; jwt: string };

  beforeAll(async () => {
    const m = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = m.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });
  afterAll(async () => { await app.close(); });
  beforeEach(async () => { tenantA = await createTestTenant({ name: 'Test' }); });

  it('GET /templates list paginated multi-tenant', async () => {
    await createTestTemplate(tenantA.id, { name: 'tpl1', language: 'fr-MA', status: 'approved' });
    await createTestTemplate(tenantA.id, { name: 'tpl2', language: 'ar-MA', status: 'draft' });
    const res = await request(app.getHttpServer()).get('/api/v1/comm/templates').set(makeAuthHeader(tenantA));
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
  });

  it('POST /templates creates draft', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/comm/templates')
      .set(makeAuthHeader(tenantA))
      .send({
        name: 'new_template_draft', language: 'fr-MA', category: 'transactional',
        channel: 'whatsapp', body_template: 'Hello {{user_name}}',
      });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('draft');
  });

  it('PUT /templates/:id only if draft', async () => {
    const tpl = await createTestTemplate(tenantA.id, { status: 'approved' });
    const res = await request(app.getHttpServer())
      .put(`/api/v1/comm/templates/${tpl.id}`)
      .set(makeAuthHeader(tenantA))
      .send({ body_template: 'Updated' });
    expect(res.status).toBe(409);
    expect(res.body.errors[0].code).toBe('TEMPLATE_NOT_DRAFT');
  });

  it('POST /:id/submit -> Meta workflow', async () => {
    const tpl = await createTestTemplate(tenantA.id, { status: 'draft' });
    const res = await request(app.getHttpServer())
      .post(`/api/v1/comm/templates/${tpl.id}/submit`)
      .set(makeAuthHeader(tenantA));
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('pending_review');
  });

  it('DELETE /:id rejects 409 if in-use', async () => {
    const tpl = await createTestTemplate(tenantA.id, { status: 'approved', in_use_count: 5 });
    const res = await request(app.getHttpServer())
      .delete(`/api/v1/comm/templates/${tpl.id}`)
      .set(makeAuthHeader(tenantA));
    expect(res.status).toBe(409);
    expect(res.body.errors[0].code).toBe('TEMPLATE_IN_USE');
  });

  it('GET /meta-status syncs', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/comm/templates/meta-status')
      .set(makeAuthHeader(tenantA));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('synced_count');
  });
});
```

### 7.3 Tests `comm-preferences-controller.e2e-spec.ts` (6+ tests)

```typescript
import { describe, it, expect } from 'vitest';
import request from 'supertest';
// boilerplate identique...

describe('CommPreferencesController (E2E)', () => {
  it('GET /preferences user retrieves own', async () => {
    /* ... */
  });

  it('PUT /preferences user updates own', async () => {
    /* ... */
  });

  it('GET /preferences/contact/:id admin lookup', async () => {
    /* ... */
  });

  it('rejects cross-tenant contact lookup', async () => {
    /* ... */
  });
});
```

### 7.4 Helpers `comm-test-helpers.ts`

```typescript
import { Pool } from 'pg';
import { sign } from 'jsonwebtoken';
import { ulid } from 'ulid';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function createTestTenant(opts: { name: string }): Promise<{ id: string; jwt: string; userId: string }> {
  const tenantId = `tn-${ulid()}`;
  const userId = `usr-${ulid()}`;
  await pool.query('INSERT INTO tenants (id, name) VALUES ($1, $2)', [tenantId, opts.name]);
  await pool.query(
    `INSERT INTO users (id, tenant_id, email, role, permissions) VALUES ($1, $2, $3, $4, $5)`,
    [userId, tenantId, `test-${tenantId}@skalean.test`, 'broker_admin',
     ['comm.messages.send', 'comm.messages.send_broadcast', 'comm.messages.read',
      'comm.templates.read', 'comm.templates.manage', 'comm.stats.read', 'comm.preferences.manage']],
  );
  const jwt = sign({ sub: userId, tenant_id: tenantId, role: 'broker_admin' }, process.env.JWT_SECRET ?? 'test-secret', { expiresIn: '1h' });
  return { id: tenantId, jwt, userId };
}

export async function createTestContact(tenantId: string, fields: Record<string, unknown>): Promise<{ id: string }> {
  const contactId = `ct-${ulid()}`;
  await pool.query(
    `INSERT INTO contacts (id, tenant_id, phone, email, preferred_channel, preferred_language)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [contactId, tenantId, fields.phone, fields.email ?? null, fields.preferred_channel ?? 'email', fields.preferred_language ?? 'fr-MA'],
  );
  return { id: contactId };
}

export async function createTestTemplate(tenantId: string, fields: Record<string, unknown>): Promise<{ id: string }> {
  const tplId = `tpl-${ulid()}`;
  await pool.query(
    `INSERT INTO comm_templates (id, tenant_id, name, language, category, channel, status, body_template, meta_template_status)
     VALUES ($1, $2, $3, $4, 'transactional', 'whatsapp', $5, 'Hello {{user_name}}', $6)`,
    [tplId, tenantId, fields.name ?? `tpl_${ulid().slice(0, 6)}`, fields.language ?? 'fr-MA', fields.status ?? 'draft', fields.meta_template_status ?? null],
  );
  return { id: tplId };
}

export async function signinTestUser(opts: { tenantId: string; role: string; permissions: string[] }): Promise<{ jwt: string; id: string }> {
  const userId = `usr-${ulid()}`;
  await pool.query(
    `INSERT INTO users (id, tenant_id, email, role, permissions) VALUES ($1, $2, $3, $4, $5)`,
    [userId, opts.tenantId, `${opts.role}-${userId}@test`, opts.role, opts.permissions],
  );
  const jwt = sign({ sub: userId, tenant_id: opts.tenantId, role: opts.role }, process.env.JWT_SECRET ?? 'test-secret', { expiresIn: '1h' });
  return { id: userId, jwt };
}

export function makeAuthHeader(t: { id: string; jwt: string }): Record<string, string> {
  return { Authorization: `Bearer ${t.jwt}`, 'X-Tenant-Id': t.id };
}

export async function cleanupTestTenant(tenantId: string): Promise<void> {
  await pool.query('DELETE FROM comm_messages WHERE tenant_id = $1', [tenantId]);
  await pool.query('DELETE FROM comm_templates WHERE tenant_id = $1', [tenantId]);
  await pool.query('DELETE FROM contacts WHERE tenant_id = $1', [tenantId]);
  await pool.query('DELETE FROM users WHERE tenant_id = $1', [tenantId]);
  await pool.query('DELETE FROM tenants WHERE id = $1', [tenantId]);
}
```

---

## 8. Variables environnement

```env
# Sprint 9 Tache 3.2.12 -- Endpoints REST comm

COMM_BATCH_MAX_SIZE=1000                              # Max items POST /send-batch
COMM_PAGINATION_DEFAULT_LIMIT=20                       # default limit GET /messages
COMM_PAGINATION_MAX_LIMIT=100                          # cap limit anti-abuse
COMM_API_RATE_LIMIT_PER_MINUTE=100                     # 100/min/tenant on /send

# Heritages Sprint 3
APP_VERSION=0.9.0                                       # version inject in meta
JWT_SECRET=<minimum-256-bits-secret>
REDIS_URL=redis://localhost:6379                        # Idempotency + RateLimit storage

# Heritages Sprint 9 (deja Taches precedentes)
WHATSAPP_PHONE_NUMBER_ID=                               # Tache 3.2.2
EMAIL_PROVIDER=mailhog                                  # Tache 3.2.6 (mailhog | mailgun)
COMM_KAFKA_TOPIC_DLQ=insurtech.events.dlq.comm         # Tache 3.2.8
```

---

## 9. Commandes shell

```bash
cd repo
pnpm --filter @insurtech/api add nestjs-zod@3.0.0
pnpm --filter @insurtech/api typecheck
pnpm --filter @insurtech/api lint:check
pnpm --filter @insurtech/api test -- comm
pnpm --filter @insurtech/api test:e2e -- comm
pnpm --filter @insurtech/api build

# Validation OpenAPI
pnpm --filter @insurtech/api start &
sleep 5
curl -s http://localhost:4000/api/v1/docs.json | jq '.paths | keys' | grep comm
```

---

## 10. Criteres validation V1-V32

### P0 (22)

- V1 : typecheck + build + tests pass.
- V2 : `POST /messages/send` orchestrate + retourne `{ messageId, channel, status: 'queued' }` 201.
- V3 : `POST /send` sans permission `comm.messages.send` -> 403 PERMISSION_DENIED.
- V4 : `POST /send` sans tenant header / JWT -> 400 BAD_TENANT_HEADER.
- V5 : `POST /send-batch` 1000 items max accepte.
- V6 : `POST /send-batch` > 1000 -> 400 BATCH_TOO_LARGE.
- V7 : `POST /send-broadcast` -> 202 Accepted + jobId + pollUrl.
- V8 : `POST /send-broadcast` permission `comm.messages.send_broadcast` only.
- V9 : `GET /messages` liste filtree channel + status.
- V10 : `GET /messages` pagination cursor base64 (encode + decode round-trip).
- V11 : `GET /messages` cursor invalide -> 400 INVALID_CURSOR.
- V12 : `GET /messages` date range > 1 year -> 400 DATE_RANGE_TOO_LARGE.
- V13 : `GET /messages` search > 200 chars -> 400.
- V14 : `GET /messages/:id` 404 si cross-tenant (multi-tenant isolation).
- V15 : `GET /:id/timeline` retourne events ordered ASC.
- V16 : `DELETE /:id` super_admin only -> 204 + soft-delete.
- V17 : `DELETE /:id` non-super_admin -> 403.
- V18 : `DELETE /:id` audit log preserve 7 ans (Sprint 35 retention).
- V19 : `GET /templates` liste paginated multi-tenant.
- V20 : `POST /templates` create draft + audit.
- V21 : `POST /templates/:id/submit` Meta API call + status pending_review.
- V22 : `PUT /templates/:id` only if draft -> sinon 409 TEMPLATE_NOT_DRAFT.

### P1 (8)

- V23 : `DELETE /templates/:id` reject 409 TEMPLATE_IN_USE if referenced.
- V24 : `GET /stats?period=30d` aggregates correct.
- V25 : `GET /stats/by-template` top engagement.
- V26 : `GET /stats/by-channel` whatsapp + email split.
- V27 : `GET /preferences` user retrieves own.
- V28 : `PUT /preferences` update own + audit.
- V29 : Multi-tenant isolation strict tous endpoints (cross-tenant 404 verifie test).
- V30 : RBAC respect 9 permissions (test matrix 9 x 4 roles couverte).

### P2 (4)

- V31 : Pagination cursor consistent toutes routes (messages + templates).
- V32 : Swagger `/api/v1/docs` accessible + 17 endpoints comm documentes + valide JSONSchema.
- V33 : Idempotency-Key support /send + collision body diff -> 409 (Sprint 3).
- V34 : Rate limit 100/min/tenant respect /send (Sprint 3 + RateLimitMiddleware).

---

## 11. Edge cases (16)

1. **Tenant header missing** : 400 BAD_TENANT_HEADER + clear error message via ExceptionFilter Sprint 3.
2. **Cursor invalide base64 corrompu** : decode try/catch -> 400 INVALID_CURSOR.
3. **Date range > 1 year** : validation Zod + Sprint 35 raise to 7 ans via materialized view.
4. **Search query > 200 chars** : validation Zod max + 400.
5. **Send while opted-out skipOptOutCheck=false** : MessageOrchestrator (Tache 3.2.9) reject CONTACT_OPTED_OUT.
6. **Broadcast quota tenant exceeded** : middleware quota Sprint 13 -> 429 + retry_after header.
7. **Concurrent template update conflict** : optimistic lock version + If-Match header -> 409 OPTIMISTIC_LOCK.
8. **Template delete in-use** : count FK references -> 409 TEMPLATE_IN_USE.
9. **Stats period=lifetime** : Sprint 14 materialized view `comm_stats_daily_mv` refresh nightly.
10. **OpenAPI Zod -> JSONSchema sync drift** : nestjs-zod auto-convert + tests E2E `/api/v1/docs.json` valid OpenAPI 3.1.
11. **Versioning API v1 vs v2** : prefix `/api/v1/comm/*` stable Sprint 35 fork v2 + Sunset header.
12. **DELETE soft preserve audit 7 ans** : flag `deleted_at` + repository auto-filter `WHERE deleted_at IS NULL`.
13. **Timeline events out-of-order** : sort `created_at ASC` + tolerate clock skew 5s.
14. **Broadcast filters tags non-existants** : Zod cross-ref CRM service Sprint 8 + 400 INVALID_TAG.
15. **Idempotency-Key collision cross-tenant** : Redis namespace `idempotency:{tenant_id}:{key}`.
16. **Rate limit per-tenant + per-user** : double check 100/min/tenant + 30/min/user.

---

## 12. Conformite Maroc

- **Loi 09-08 article 4 (proportionnalite)** : multi-tenant isolation strict empeche fuite cross-tenant. Test E2E 404 explicit.
- **Loi 09-08 article 11 (right to opt-out)** : MessageOrchestrator (Tache 3.2.9) check OptoutService (Tache 3.2.11) avant send.
- **Loi 09-08 article 27 (right to erasure)** : `DELETE /api/v1/comm/messages/:id` super_admin only + soft-delete preserve audit.
- **Loi 09-08 article 28 (breach notification 72h)** : audit log toutes actions PII via AuditService Sprint 7.
- **ACAPS circulaire 2024 (audit trail messages outbound 7 ans)** : retention `comm_messages.deleted_at` + audit log Sprint 35 raise 7 ans.
- **CNDP article 6 (consent granular)** : `GET/PUT /api/v1/comm/preferences` permet user self-service preferred_channel + opted_out_channels.
- **super_admin actions endpoints** : audit complet Sprint 7 + escalation requise pour DELETE.

---

## 13. Conventions absolues (16)

1. **Multi-tenant** : `tenant_id` injecte via TenantContext middleware + auto-filter tous queries DB.
2. **Validation** : Zod via `createZodDto(Schema)` 100% endpoints inputs.
3. **Logger Pino structured** : `action`, `user_id`, `tenant_id`, `resource_id`, `metadata`. Aucun token / PII en clair.
4. **pnpm** workspaces.
5. **TypeScript strict** : `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`.
6. **Tests 25+ E2E** + 20+ unit + helpers fixtures shared.
7. **Skalean AI** : aucun usage IA dans cette tache (defere Sprint 30+).
8. **No-emoji** : zero dans code + Swagger + responses + logs + commits.
9. **Idempotency** : optional Idempotency-Key header sur POST /send + /send-batch + /send-broadcast (Sprint 3).
10. **Cloud souverain** : API hostee Atlas Cloud Services Benguerir Sprint 35.
11. **Crypto** : aucun direct (HMAC dans WaSignatureMiddleware reference Tache 3.2.4).
12. **JSDoc** : sur tous controllers + DTOs + helpers.
13. **Performance** : send < 80ms p99 (orchestrator + DB insert + queue enqueue). List < 50ms p99.
14. **OpenAPI 3.1** : auto-generation via nestjs-zod + decorators @ApiTags/@ApiOperation/@ApiResponse 100%.
15. **RBAC** : @RequirePermission decorator 100% endpoints prives.
16. **Versioning** : prefix `/api/v1/comm/*` stable + futures `/api/v2` Sprint 35.

---

## 14. Validation pre-commit

```bash
cd repo
pnpm --filter @insurtech/api typecheck
pnpm --filter @insurtech/api lint:check
pnpm --filter @insurtech/api test -- comm
pnpm --filter @insurtech/api test:e2e -- comm
pnpm --filter @insurtech/api test:coverage -- comm

grep -rP "[\x{1F300}-\x{1F9FF}]" apps/api/src/modules/comm && exit 1 || echo "OK no-emoji"
grep -rn "console\.log" apps/api/src/modules/comm --include="*.ts" && exit 1 || echo "OK no-console"

# Verify all endpoints documented OpenAPI
pnpm --filter @insurtech/api start &
SERVER_PID=$!
sleep 5
COMM_PATHS=$(curl -s http://localhost:4000/api/v1/docs.json | jq -r '.paths | keys[] | select(test("/comm/"))' | wc -l)
[ "$COMM_PATHS" -ge "17" ] && echo "OK $COMM_PATHS endpoints comm documented" || (echo "MISSING endpoints - found $COMM_PATHS expected >=17" && kill $SERVER_PID && exit 1)
kill $SERVER_PID

# Verify RBAC
grep -rE "@RequirePermission\(" apps/api/src/modules/comm/controllers | wc -l
```

---

## 15. Commit message

```bash
git add -A
git commit -m "feat(sprint-09): implement REST endpoints /api/v1/comm/* with RBAC + multi-tenant + cursor pagination + Swagger

Implements 17 REST endpoints exposing comm module (messages, templates,
stats, preferences, optouts) with format response standardise Sprint 3
{ success, data, meta, errors }, multi-tenant isolation strict via
TenantContext middleware Sprint 6, RBAC granular @RequirePermission
Sprint 7 (9 permissions: send, send_broadcast, read, delete, templates.read,
templates.manage, stats.read, preferences.manage, optouts.read), pagination
cursor base64 (vs offset O(n)), filtres riches (channel, direction, status,
contact_id, template_id, date_range, search trigram Sprint 8), Idempotency-Key
support Sprint 3, rate limit 100/min/tenant Sprint 3, OpenAPI Swagger 3.1
auto-generation via nestjs-zod + @ApiTags/@ApiOperation/@ApiResponse 100%.

Endpoints :
  POST   /api/v1/comm/messages/send                 (orchestrate)
  POST   /api/v1/comm/messages/send-batch           (max 1000)
  POST   /api/v1/comm/messages/send-broadcast       (async 202)
  GET    /api/v1/comm/messages                      (cursor + filters)
  GET    /api/v1/comm/messages/:id
  GET    /api/v1/comm/messages/:id/timeline
  DELETE /api/v1/comm/messages/:id                  (super_admin CNDP)
  GET    /api/v1/comm/templates
  POST   /api/v1/comm/templates
  GET    /api/v1/comm/templates/:id
  PUT    /api/v1/comm/templates/:id                 (only draft)
  DELETE /api/v1/comm/templates/:id                 (409 if in-use)
  POST   /api/v1/comm/templates/:id/submit          (Meta workflow)
  GET    /api/v1/comm/templates/meta-status
  GET    /api/v1/comm/stats?period=7d|30d|90d
  GET    /api/v1/comm/stats/by-template
  GET    /api/v1/comm/stats/by-channel
  GET    /api/v1/comm/preferences
  PUT    /api/v1/comm/preferences
  GET    /api/v1/comm/preferences/contact/:id

Livrables :
- 5 controllers (~980 lignes)
- 4 DTOs Zod (~400 lignes)
- comm.module.ts (~120 lignes register all + middleware)
- 25+ tests E2E Supertest + 35+ tests unit Vitest

Tests : 25 messages E2E + 12 templates E2E + 6 preferences E2E + 8 stats unit + 50+ unit total
Coverage : >= 90%

Conformite : Loi 09-08 art 4/11/27/28, ACAPS audit trail 7 ans, CNDP consent granular

Task: 3.2.12
Sprint: 9 (Phase 3 / Sprint 2)
Reference: B-09 Tache 3.2.12
Decisions: decision-006 (no-emoji), decision-007 (Zod), decision-012 (multi-tenant), decision-014 (RBAC)"
```

---

## 16. Workflow next step

Apres commit, passer a `task-3.2.13-tests-e2e-mocks-meta-mailhog.md` qui implementera la suite tests E2E exhaustifs 40+ couvrant l'integralite du module comm Sprint 9 : routing par preferred_channel, fallback opt-out, WA webhook signature + idempotency, STOP keyword auto opt-out, Mailgun bounce hard auto opt-out, template rendering 3 locales RTL, worker retry transient errors + DLQ apres 3 echecs, opt-out one-click + token URL, stats aggregates correct, RBAC matrix 9 permissions x 4 roles, multi-tenant isolation strict, Mailhog integration verify delivered, mock Meta API server (nock) intercept HTTP + simulate errors (rate limit 80/sec, invalid template, phone not opted-in). Tests CI Postgres + Redis + Kafka services.

---

## Annexe A. Format response standardise (rappel Sprint 3 Tache 1.3.7)

```typescript
// 2xx success
{
  success: true,
  data: T,
  meta: {
    traceId: string,                  // OTEL
    requestId: string,                // ULID Sprint 3
    tenantId: string,                 // ULID
    timestamp: string,                // ISO 8601 UTC
    version: string,                  // process.env.APP_VERSION
    pagination?: { cursor: string, hasMore: boolean, limit: number },
    locale?: string,
  },
  errors: []
}

// 4xx/5xx error (ExceptionFilter Sprint 3 Tache 1.3.8)
{
  success: false,
  data: null,
  meta: { traceId, requestId, tenantId, timestamp, version },
  errors: [
    {
      code: 'BAD_TENANT_HEADER' | 'INVALID_CURSOR' | 'PERMISSION_DENIED' | 'TEMPLATE_NOT_DRAFT' | ...,
      message: 'human readable',
      field?: 'contactId',
      details?: { ... },
    }
  ]
}
```

---

## Annexe B. Pagination cursor encoding details

```typescript
// repo/apps/api/src/modules/comm/utils/cursor.util.ts

/**
 * Encode cursor base64url depuis lastId + lastSentAt.
 * Format JSON serialized + base64url-safe.
 *
 * Index Postgres :
 *   CREATE INDEX idx_comm_messages_tenant_sent_at
 *     ON comm_messages (tenant_id, sent_at DESC, id DESC)
 *     WHERE deleted_at IS NULL;
 *
 * Query :
 *   SELECT * FROM comm_messages
 *   WHERE tenant_id = $1 AND deleted_at IS NULL
 *     AND (sent_at, id) < ($cursor.sent_at, $cursor.id)
 *   ORDER BY sent_at DESC, id DESC LIMIT 21;
 */

export function encodeCursor(data: Record<string, string>): string {
  return Buffer.from(JSON.stringify(data)).toString('base64url');
}

export function decodeCursor<T = Record<string, string>>(cursor: string): T {
  if (!cursor || cursor.length > 500) throw new Error('Cursor too long');
  const decoded = Buffer.from(cursor, 'base64url').toString('utf-8');
  const parsed = JSON.parse(decoded);
  if (typeof parsed !== 'object' || parsed === null) throw new Error('Invalid cursor');
  return parsed as T;
}
```

---

## Annexe C. RBAC matrix tests (9 permissions x 4 roles = 36 scenarios)

| Endpoint | Permission | broker_admin | broker_user | garage_admin | super_admin |
|----------|------------|--------------|-------------|--------------|-------------|
| POST /send | comm.messages.send | OK | OK | OK | OK |
| POST /send-batch | comm.messages.send | OK | OK | OK | OK |
| POST /send-broadcast | comm.messages.send_broadcast | OK | 403 | 403 | OK |
| GET /messages | comm.messages.read | OK | OK | 403 | OK |
| GET /:id | comm.messages.read | OK | OK | 403 | OK |
| GET /:id/timeline | comm.messages.read | OK | OK | 403 | OK |
| DELETE /:id | comm.messages.delete | 403 | 403 | 403 | OK |
| GET /templates | comm.templates.read | OK | 403 | 403 | OK |
| POST /templates | comm.templates.manage | OK | 403 | 403 | OK |
| GET /stats | comm.stats.read | OK | 403 | OK | OK |
| GET /preferences | comm.preferences.manage | OK | OK | OK | OK |
| GET /optouts | comm.optouts.read | 403 | 403 | 403 | OK |

Tests E2E couvre les 36 cells via fixture `signinTestUser({ permissions: [...] })` + parametrize.

---

## Annexe D. Performance benchmarks attendus

```
POST /messages/send (orchestrator + DB insert + queue):  median 35 ms  (p99: 80 ms)
POST /messages/send-batch (1000 items async):              median 200 ms (p99: 500 ms)
POST /messages/send-broadcast (async 202):                 median 15 ms  (p99: 40 ms)
GET /messages (cursor first page, limit 20):              median 8 ms   (p99: 25 ms)
GET /messages (cursor page 50, limit 20):                  median 8 ms   (p99: 25 ms)  -- O(log n) constant
GET /messages/:id (single + multi-tenant):                 median 4 ms   (p99: 12 ms)
GET /:id/timeline (events agg):                            median 12 ms  (p99: 30 ms)
DELETE /:id (super_admin soft-delete):                     median 10 ms  (p99: 25 ms)
GET /templates (paginated):                                median 8 ms   (p99: 20 ms)
POST /templates (create draft):                            median 15 ms  (p99: 35 ms)
GET /stats?period=30d (with mat view Sprint 14):           median 30 ms  (p99: 80 ms)
GET /stats?period=lifetime (without mat view):              median 800 ms (p99: 3000 ms)  -- TODO Sprint 14
```

---

## Annexe E. Sprint 17+ consumers consume pattern

```typescript
// Sprint 17 Comm vertical : workflow broker relance assure
// repo/apps/api/src/modules/insure/workflows/relance-signature.workflow.ts

@Injectable()
export class RelanceSignatureWorkflow {
  constructor(private readonly httpClient: HttpService) {}

  async sendRelance(policeId: string, contactId: string, brokerJwt: string, tenantId: string): Promise<void> {
    // Sprint 17 cross-domain via HTTP API (pas direct service call)
    // pour assurer audit + rate limit + RBAC consistent
    const response = await this.httpClient.post(
      `${process.env.API_BASE_URL}/api/v1/comm/messages/send`,
      {
        contactId,
        templateName: 'police_relance_signature_24h',
        variables: { police_number: policeId },
      },
      {
        headers: {
          Authorization: `Bearer ${brokerJwt}`,
          'X-Tenant-Id': tenantId,
          'Idempotency-Key': `relance-${policeId}-${new Date().toISOString().slice(0, 10)}`,
        },
      },
    );
    // response.data.messageId tracking
  }
}
```

---

## Annexe F. Sprint 27 Admin UI templates Meta workflow

```typescript
// Sprint 27 Frontend : pseudo-code
const submitToMeta = async (templateId: string) => {
  const res = await api.post(`/api/v1/comm/templates/${templateId}/submit`);
  toast.success(`Template submitted to Meta. Status: ${res.data.status}. Approval ETA: 24-48h.`);
};

// Polling status sync
const syncMeta = async () => {
  const res = await api.get('/api/v1/comm/templates/meta-status');
  toast.info(`Synced ${res.data.synced_count} templates. ${res.data.items.filter(i => i.current_status === 'approved').length} newly approved.`);
};
```

---

## Annexe G. Migration v2 plan Sprint 35

```typescript
// Sprint 35 fork /api/v2/comm/* :
//   - Breaking change : pagination format meta.page_info { startCursor, endCursor, hasNextPage, hasPreviousPage }
//   - Breaking change : timestamps Africa/Casablanca (vs UTC v1)
//   - New : GraphQL subgraph optional
//   - Deprecation v1 :
//       Header response : Sunset: Tue, 01 Jan 2030 00:00:00 GMT
//       Header response : Deprecation: Wed, 01 Jan 2027 00:00:00 GMT
//       Documentation migration guide
//   - Breaking change : RBAC permissions renamed comm.* -> communications.*
//   - Materialized views obligatoires pour /stats (perf scale 100M+ rows)
```

---

## Annexe H. OpenAPI Swagger generation pattern (nestjs-zod)

```typescript
// repo/apps/api/src/main.ts (extrait pertinent Sprint 3 Tache 1.3.9)

import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { patchNestjsSwagger } from 'nestjs-zod';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
  patchNestjsSwagger();  // sync Zod -> JSONSchema OpenAPI

  const config = new DocumentBuilder()
    .setTitle('Skalean InsurTech API')
    .setDescription('Insurance + Repair platform Morocco -- v0.9.0')
    .setVersion('1.0.0')
    .addBearerAuth()
    .addServer(process.env.API_BASE_URL ?? 'http://localhost:4000')
    .addTag('comm-messages', 'Send + list + timeline messages WhatsApp / Email Sprint 9')
    .addTag('comm-templates', 'CRUD templates + workflow Meta approval')
    .addTag('comm-stats', 'Aggregates delivery / bounce / open / click rates')
    .addTag('comm-preferences', 'User self preferences + admin contact lookup')
    .addTag('comm-optouts', 'CNDP loi 09-08 opt-out management')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('/api/v1/docs', app, document);

  // Expose JSON for tooling (curl, openapi-generator, etc.)
  app.getHttpAdapter().get('/api/v1/docs.json', (_req, res) => res.send(document));
}
```

---

**Fin du prompt Tache 3.2.12 v2.2 format Option B Skalean InsurTech.**

Densite atteinte : ~135 ko (auto-suffisant exhaustif).
Lignes effectives code : ~3000 reparties sur 19 fichiers + 2 UPDATE.
Tests : 25+ E2E + 35+ unit + helpers fixtures.
Coverage cible : >= 90%.
17 endpoints REST exposes /api/v1/comm/*.
9 permissions RBAC granular.
Multi-tenant isolation strict 100%.
Pagination cursor base64.
Swagger OpenAPI 3.1 auto-generation.
Idempotency-Key + Rate limit Sprint 3.
Conformite Loi 09-08 + ACAPS + CNDP article 4/6/11/27/28.
