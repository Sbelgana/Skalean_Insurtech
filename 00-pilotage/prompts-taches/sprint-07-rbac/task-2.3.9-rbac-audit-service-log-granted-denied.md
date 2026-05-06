# TACHE 2.3.9 -- RbacAuditService : Log Access Granted + Denied (RBAC + ABAC) avec persistance Postgres + emission Kafka asynchrone + sampling configurable

**Sprint** : 7 (Phase 2 / Sprint 3 dans phase) -- RBAC Granulaire + ABAC Foundation
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-07-sprint-07-rbac.md` (Tache 2.3.9 lignes 1020-1057)
**Phase** : 2 -- Securite & Multi-tenant
**Priorite** : P0 (bloquant pour Tache 2.3.10 PermissionCacheService Redis car les events `auth.role_changed` consommes par le cache invalidation pipeline declenchent un audit log preliminaire ; bloquant pour Tache 2.3.11 admin endpoints introspection RBAC denials qui requete `audit_log` pour reporting per-tenant ; bloquant pour Tache 2.3.12 tests E2E coverage 12 roles qui assert `audit_log` rows after each scenario ; bloquant pour Sprint 8 CRM module qui trace `crm.contacts.read_own` denials ; pour Sprint 11 Docs `docs.documents.read_own` denials ; pour Sprint 14 Insure `insure.policies.cancel` ABAC denials TimeBasedPolicy ; pour Sprint 19 Repair `repair.sinistres.read_assigned` ABAC denials OwnResourcesPolicy ; pour Sprint 22 Observability dashboards Grafana qui consomment metrics Prometheus `rbac_audit_inserts_total`, `rbac_audit_kafka_events_total`, `rbac_audit_kafka_failures_total` ; pour Sprint 26 admin module `admin.audit.read` endpoint qui paginate `audit_log` ; pour Sprint 33 SecOps alerting Slack notification si > 100 denied / hour same user via Kafka consumer `insurtech.events.audit.access_denied` ; pour Sprint 34 SOC ACAPS reporting trimestriel qui agrege denials per role per tenant)
**Effort** : 4h
**Dependances** :
  - Tache 2.3.8 (`AbacGuard` livre + `ResourceLoaderService` + decorator `@AbacResource` ; le Guard appelle `await rbacAudit.logAbacDenied({...})` sync avant `throw ForbiddenException` -- contrat methode existe en signature stub a remplir cette tache).
  - Tache 2.3.7 (`AbacService` retourne `AbacResult { allowed, policy, reason }` consomme par `logAbacDenied` arguments).
  - Tache 2.3.5 (`PermissionGuard` + decorator `@RequirePermission` + `RbacAuditService` injection pattern + `getCurrentContext()` AsyncLocalStorage ; le Guard appelle `await rbacAudit.logAccessGranted` ou `logAccessDenied` selon resultat `rbacService.hasPermission`).
  - Tache 2.3.4 (`RoleGuard` + `AuthRole` type expose).
  - Tache 2.3.3 (`RbacService.hasPermission` retourne `AccessResult` Result-typed).
  - Tache 2.3.1 (`Permission` catalog + `PermissionValue` Zod).
  - Sprint 6 complet (TenantContext propage `userId` / `userRole` / `tenantId` via cls-hooked AsyncLocalStorage ; helper `getCurrentContext()` accessible).
  - Sprint 5 (RedisService disponible, EventEmitter NestJS, Pino logger 9.5.x configure structured JSON).
  - Sprint 4 (DrizzleService + migration runner + types Postgres + RLS helper `app_can_access_tenant`).
  - Sprint 3 (Kafka cluster Redpanda local + `KafkaProducerService` injectable + topic provisioning script + schema registry Confluent compatibility).
  - Sprint 1-2 stack (TypeScript 5.7.3 strict, Vitest 2.1.8, NestJS 10.4.x avec Fastify 4.x adapter, Pino 9.5.x, Zod 3.24.1, reflect-metadata 0.2.x, prom-client 15.x, ioredis 5.4.x, kafkajs 2.2.4, luxon 3.5.x, drizzle-orm 0.36.x, postgres 3.4.x).
**Densite cible** : 100-150 ko (auto-suffisant exhaustif)
**AUCUNE EMOJI AUTORISEE**

---

## 1. But

Cette tache 2.3.9 livre le **service centralise `RbacAuditService`** du programme Skalean InsurTech v2.2 : la brique de **persistance + emission Kafka** de TOUS les evenements d'autorisation produits par la chain de Guards livree dans les taches 2.3.4 (`RoleGuard`), 2.3.5 (`PermissionGuard`) et 2.3.8 (`AbacGuard`). Le service expose trois methodes publiques principales : `logAccessGranted({ userId, tenantId, role, permission, resource, endpoint })` invoquee par `PermissionGuard` apres une evaluation RBAC reussie pour tracer l'octroi d'une permission a un utilisateur sur une ressource donnee, `logAccessDenied({ userId, tenantId, role, permissions, endpoint, reason })` invoquee par `PermissionGuard` ou `RoleGuard` quand l'utilisateur tente d'acceder a une ressource sans la permission base requise (refus RBAC), et `logAbacDenied({ permission, policy, reason, userId, resource })` invoquee par `AbacGuard` quand l'evaluation contextuelle ABAC retourne `allowed=false` (refus contextuel : non-proprietaire, transaction trop ancienne pour refund, transition workflow invalide). Chaque appel produit (a) une **insertion synchrone** dans la table Postgres `audit_log` partitionnee par mois (Sprint 33 setup partitioning) avec colonnes `id` UUID, `tenant_id`, `actor_user_id`, `actor_role`, `action` enum, `resource_type`, `resource_id`, `endpoint`, `outcome` enum (granted / denied / abac_denied / bypass), `policy`, `reason`, `request_context` JSONB (ip, user_agent, request_id, timestamp ISO), `created_at` timestamptz, plus index composites sur `(tenant_id, created_at)`, `(actor_user_id, created_at)`, `(action, created_at)`, `(resource_type, resource_id)` et **(b) une emission asynchrone fire-and-forget** dans le topic Kafka `insurtech.events.audit.access_denied` (et symetriquement `insurtech.events.audit.access_granted` si feature flag `LOG_RBAC_GRANTED=true`) au format JSON avec schema versionne `v1` consommable par les pipelines d'alerting Sprint 33 SecOps + reporting trimestriel ACAPS Sprint 34.

Le **logging granted est optionnel et configurable** via la variable environnement `LOG_RBAC_GRANTED=false` (defaut production : false pour eviter la saturation table audit_log avec millions de rows par jour ; defaut staging/dev : true pour faciliter debugging) et le **sampling probabiliste** `RBAC_AUDIT_SAMPLING_RATE=0.1` permet de conserver 10% des grants en production pour observation statistique sans cout prohibitif (le compteur Prometheus `rbac_audit_granted_sampled_out_total` trace les rows ignorees pour reconciliation). Le **logging denied est TOUJOURS execute** -- aucun sampling -- car les denials sont des events critiques de securite (signal potentiel d'attaque brute-force RBAC, tentative de privilege escalation, leak cross-tenant) qui doivent etre 100% trackes pour alimenter les detection regles SecOps Sprint 33 (alerte Slack si > 100 denied/hour pour le meme `actor_user_id`, alerte page-duty si > 10 denied/min depuis la meme IP). Les `super_admin_platform` actions sont egalement TOUJOURS loggees (pas de sampling, pas de skip granted) car la conformite ACAPS Circulaire 2018/01 article 9 et CNDP loi 09-08 article 18 exigent une tracabilite exhaustive des acces privilegies (Maker/Checker pattern avec audit trail integral).

L'architecture du service combine **trois couches** : (1) la couche `RbacAuditRepository` qui encapsule l'INSERT Postgres via Drizzle ORM avec batching optionnel (`flushBatch` pour 100 rows / 5s window quand le throughput depasse 500 inserts/s en production -- a activer Sprint 22 si necessaire), (2) la couche `RbacAuditKafkaProducer` qui wrappe `KafkaProducerService` Sprint 3 avec idempotency-key (header `Idempotency-Key: {audit_log.id}`), retry exponentiel (3 tentatives, base 100ms, max 1s), dead-letter queue `insurtech.events.audit.dlq` apres echec final, et metrics Prometheus `rbac_audit_kafka_failures_total`, et (3) la couche `RbacAuditSampling` qui evalue probabilistiquement `Math.random() < RBAC_AUDIT_SAMPLING_RATE` pour les grants standard (mais bypass sampling pour `super_admin_platform`, pour les permissions sensibles `*.admin.*` `*.compliance.*` `*.acaps.*` `*.cndp.*`, et pour les outcomes != granted). A l'issue de cette tache, le package `@insurtech/auth/audit` expose `RbacAuditService` consommable via injection NestJS standard `constructor(private readonly rbacAudit: RbacAuditService)` dans tous les Guards Sprint 7 + futurs services Sprint 8+ qui voudraient logger des actions sensibles ad-hoc (ex: `assure.policies.transfer` Sprint 14), 25+ tests Vitest verifient les scenarios granted INSERT, denied INSERT + Kafka, ABAC denied INSERT + Kafka, sampling 10% probabilistic via seeded random, env config flips, Kafka producer error retry + DLQ, idempotency-key stable, multi-tenant RLS isolation, super_admin bypass sampling, et la migration TypeORM `1715000000000-CreateRbacAuditLogTable.ts` cree la table `audit_log` avec ses 4 indexes critiques + politique RLS multi-tenant + commentaires colonnes pour documentation auto-generee.

---

## 2. Contexte etendu

### 2.1 Pourquoi un service centralise plutot que log local par Guard

Trois strategies d'integration audit sont possibles dans une architecture NestJS multi-Guards :

**Strategie A -- Service centralise (RETENUE)** : Un singleton `RbacAuditService` injecte dans chaque Guard, methodes typees par scenario (`logAccessGranted`, `logAccessDenied`, `logAbacDenied`), persistance Postgres + emission Kafka transparente pour les Guards. Avantages : (a) **DRY** -- la logique INSERT + Kafka est ecrite une seule fois, refactor centralise (e.g. ajout colonne `correlation_id` Sprint 22 propagation trace OpenTelemetry) ; (b) **testabilite Guards** -- mock `RbacAuditService` dans tests Guard, plus simple que mock 3 dependences (Drizzle + Kafka + Pino) ; (c) **uniformite format** -- meme schema audit_log row quelle que soit l'origine (RBAC vs ABAC vs role denial) ; (d) **metrics centralisees** -- compteurs Prometheus dans le service plutot que disperses ; (e) **policy enforcement single-point** -- sampling, retention, redaction PII (Sprint 26 implemente regex redaction pour `email`, `phone`) appliques au meme endroit. Inconvenients : (a) couplage Guards au service, mitigated par interface `IRbacAudit` typee dans `@insurtech/auth/contracts` ; (b) singleton risque memory leak si batching mal implemente, mitigated par tests memory leak Vitest + flush periodic sur shutdown.

**Strategie B -- Log local par Guard avec adapter pattern** : Chaque Guard ecrit dans Pino logger (`logger.info({audit: true, ...})`), un service Vector / Fluentbit hors-process consomme stdout JSON et persist Postgres + Kafka. Avantages : (a) decouplage absolu Guards / persistence, (b) failover natif (si Postgres down, logs persistes dans stdout puis rejouees). Inconvenients : (a) **complexite ops** -- necessite stack Vector/Fluentbit configuree, debug logs vs audit logs hard a distinguer ; (b) **latence audit elevee** -- pipe stdout -> agent -> persist peut atteindre 5-30s (inacceptable pour use case alerting realtime denied) ; (c) **format coupling** -- Vector parsers depend sur format JSON exact, refactor casse pipeline downstream ; (d) impossible de `await` la persistance dans le Guard avant `throw ForbiddenException` (compliance ACAPS impose acquittement persist avant response).

**Strategie C -- Event-driven via NestJS EventEmitter** : Guards emettent `AuthorizationDecisionEvent`, des subscribers `@OnEvent` ecoutent et persist DB + Kafka. Avantages : (a) decouplage maximal, (b) extensibilite (nouveaux subscribers Sprint 33 alerting subscribe sans modifier Guards). Inconvenients : (a) **fire-and-forget par default** -- Guards ne peuvent pas await la persistence (compliance issue) ; (b) overhead EventEmitter pas negligeable a 1k req/s ; (c) ordre emission/consommation non garantis multi-tenant si subscribers async lents.

**Choix retenu** : Strategie A (service centralise) avec API typee. La compliance ACAPS impose le sync pour denied (acquittement persistance avant response 403). Le pattern garantit un audit trail incassable. Pour les use cases observabilite (Sprint 22), on emet des Kafka events qui peuvent eux-memes alimenter pipelines event-driven sans coupler le critical path. ADR-026 (`docs/adr/026-rbac-audit-centralized-service.md`) approuve par tech lead + architecte securite + delegue CNDP.

### 2.2 Trade-off : persistance synchrone Postgres vs asynchrone fire-and-forget

L'INSERT `audit_log` row est-il `await` dans la response chain ou fire-and-forget en background ?

| Approche | Description | Avantages | Inconvenients | Adoption |
|----------|-------------|-----------|---------------|----------|
| **Sync await INSERT** | `await rbacAudit.logAccessDenied(...)` avant `throw ForbiddenException` | Garantie persistance avant response client, conforme ACAPS, simple a raisonner | Latence p99 +5-15ms par request, sature Postgres sous charge (pool 100 connections) | RETENU pour denied uniquement |
| **Async fire-and-forget** | `void rbacAudit.logAccessGranted(...)` returns immediately | Latence response inchangee, scalable | Risque perte log si process crash entre call et persist (5ms window) | RETENU pour granted uniquement |
| **Queue Bull async** | Push job Bull, worker async persist | Decouplage total, retry persistant, durable | Complexite infra (Redis Bull queue), latence vs query realtime audit_log delayed (5-30s) | EVALUE pour Sprint 22 si throughput > 5k req/s |
| **Batch INSERT (100 rows / 5s)** | Buffer in-memory, flush periodique | Throughput max Postgres, reduit transactions | Risque perte si crash buffer non flushe, complexite shutdown graceful | EVALUE pour Sprint 22 si throughput > 5k req/s |

**Choix retenu** : (a) `logAccessDenied` et `logAbacDenied` sont **SYNC await INSERT** car compliance ACAPS impose et SecOps doit pouvoir requete `audit_log` immediatement apres incident pour root cause analysis ; (b) `logAccessGranted` est **ASYNC fire-and-forget** avec `void this.repository.insert(row).catch(err => this.logger.error(err))` car perte acceptable (granted = use case attendu, pas un signal critique) ; (c) Kafka emit est TOUJOURS async fire-and-forget avec retry 3x exponentiel + DLQ (le critical path ne doit jamais echouer parce que Kafka est down).

### 2.3 Trade-off : sampling 10% granted en production vs full logging

A 1000 req/s en production sur 100% des grants, on persiste 86 millions de rows/jour, soit ~25 GB/jour de table audit_log non comprime. Le cout de stockage Postgres + retention 7 ans CNDP devient prohibitif (~64 TB de donnees).

| Approche | Volume jour @ 1k req/s | Cout stockage 7 ans | Adoption |
|----------|------------------------|---------------------|----------|
| **Full logging granted + denied** | 86M rows / ~25 GB | ~64 TB | REJETE -- prohibitif |
| **Granted off (only denied)** | ~50k denied/jour / ~15 MB | ~38 GB | Insuffisant -- pas de baseline statistique grants |
| **Granted sampling 10%** | 8.6M granted + 50k denied / ~2.5 GB | ~6.4 TB | RETENU -- balance perf/observability |
| **Granted sampling 1%** | 860k granted + 50k denied / ~270 MB | ~700 GB | EVALUE Sprint 33 si stockage encore eleve |

Le sampling 10% est implemente via `Math.random() < 0.1` evalue **par requete**, mais avec **bypass exceptions** : (a) `super_admin_platform` actions toujours logged (compliance imposee) ; (b) permissions sensibles matchant regex `^(admin|compliance|cndp|acaps|aml)\..*$` toujours logged ; (c) outcome != granted toujours logged ; (d) tenant flag `tenant.audit_full_log = true` (option premium) bypass sampling pour audit complet (Sprint 14 souscrit pour broker Bennani Premium). Le compteur Prometheus `rbac_audit_granted_sampled_out_total{tenant,role}` permet aux dashboards Sprint 22 de reconcilier le volume reel granted vs persiste.

### 2.4 Trade-off : Kafka emit strategy idempotency

Le topic Kafka `insurtech.events.audit.access_denied` doit-il etre **at-least-once** (risque doublons consommateurs) ou **exactly-once** (transactional API plus complexe) ?

**Choix retenu** : `at-least-once` avec **idempotency-key** dans header Kafka `Idempotency-Key: {audit_log.id}` (UUID v4 genere coté service avant INSERT Postgres). Les consommateurs Sprint 33 SecOps + Sprint 34 ACAPS reporting deduplicquent par `Idempotency-Key` avec window 24h dans Redis Set `audit:dedup:{date}`. Avantages : (a) simplicite producer (pas de Kafka transactional API qui complique le scaling) ; (b) deduplication consommateurs deja necessaire pour idempotence application-level ; (c) compatible kafkajs 2.2.4 sans plugin. Tests V11 V12 verifient idempotency-key stable et deduplication consommateurs simulee.

### 2.5 Trade-off : Kafka partition strategy

Le topic `insurtech.events.audit.*` doit etre partitionne sur quelle clef pour garantir l'ordre et la repartition load consommateurs ?

| Strategie | Cle partition | Avantages | Inconvenients |
|-----------|---------------|-----------|---------------|
| **By tenant_id** (RETENUE) | `partitionKey: tenantId` | Ordre garanti par tenant (alerting SecOps detecte sequence chronologique attaque), isolation tenant naturel pour dedicated consumers premium tenants | Hot partition possible si 1 tenant 80% volume (cas Bennani) |
| By user_id | `partitionKey: actor_user_id` | Ordre per user (detection brute force user-level facile) | Cardinality elevee, hash uniformity OK |
| By action | `partitionKey: action` | Consommateurs specialises par action type | Hot partitions garantis (e.g. `read` 90% volume) |
| Round-robin (no key) | null | Repartition uniforme | Aucun ordre garanti |

**Choix retenu** : `tenant_id` car les use cases downstream (alerting per-tenant, ACAPS reporting per-tenant, Maker/Checker traceability per-tenant) requierent ordre intra-tenant. Pour eviter hot partition, le topic est cree avec 12 partitions (= number consommateurs Sprint 33 max). Tests V13 V14 verifient partition assignment.

### 2.6 Pieges techniques connus (10+ pieges critiques)

1. **Piege : audit log row size limit Postgres TOAST overflow.**
   - Pourquoi : Le champ `request_context` JSONB peut contenir un `user-agent` long (> 8 KB) ou un `request_body` (Sprint 22 propose d'inclure body redacte) qui depasse la page Postgres 8 KB et trigger TOAST compression / out-of-line storage. Latence INSERT augmente de 3-10ms.
   - Solution : Schema Zod validation `userAgent.max(2048)`, `requestBody.max(4096)`, troncation avec marker `[TRUNCATED:N_BYTES]`. Test V8 verifie troncation.

2. **Piege : async fire-and-forget granted swallow errors silently.**
   - Pourquoi : `void this.repository.insert(...)` ignore Promise rejection. Si DB down, on perd les logs sans aucun signal.
   - Solution : Wrapper helper `safeAsync(promise, errorContext)` qui catch et increment counter Prometheus `rbac_audit_async_failures_total{method}` + log Pino `error`. Permet detection ops Sprint 22. Test V15.

3. **Piege : Kafka producer flush block process shutdown.**
   - Pourquoi : Au shutdown SIGTERM, kafkajs producer batches en attente bloquent l'evenement `beforeApplicationShutdown`. Container kill -9 apres 30s.
   - Solution : Module `OnModuleDestroy` calls `producer.disconnect({timeout: 5000})`. Test integration V16 simule shutdown.

4. **Piege : audit_log table grows unbounded -> partitioning manuel oublie.**
   - Pourquoi : Sans partitioning, table 25 GB/jour rapidement degenere. Index B-tree sur `created_at` devient lent.
   - Solution : Migration installe `pg_partman` extension Sprint 33, partitioning natif Postgres 14+ par RANGE(created_at) intervalle 1 mois. Cette tache cree la table simple (pas partitioned), Sprint 33 ajoute partitioning. Documentation OBS-015 ticket suit. Tests V17.

5. **Piege : `super_admin_platform` actions oubliees du sampling bypass.**
   - Pourquoi : Si dev oublie le test `if (role === 'super_admin_platform')` dans `RbacAuditSampling.shouldLog`, les actions super admin sont samplees -> compliance ACAPS / CNDP non respectee.
   - Solution : Helper `isPrivilegedRole(role): boolean` exporte depuis `@insurtech/auth/rbac`, test V18 verifie 100 grants super admin -> 100 logged sans sampling.

5b. **Piege : permissions sensibles matchant regex pas detectees.**
   - Pourquoi : Patterns `*.admin.*`, `*.compliance.*` doivent bypass sampling. Si la regex est mal ecrite (ex: missed `.acaps.*`), les compliance reports ratent des entries.
   - Solution : Constante `SENSITIVE_PERMISSION_PATTERNS: RegExp[]` dans `rbac-audit-sampling.ts`, ESLint rule custom `eslint-plugin-skalean/sensitive-perms-coverage` valide synchronization avec catalog `5-roles-permissions.md`. Test V19.

6. **Piege : multi-tenant isolation audit_log via RLS contournee.**
   - Pourquoi : Si l'INSERT est fait avec un superuser bypass RLS (`SET LOCAL bypassrls = on`), un row avec `tenant_id = X` peut etre cree depuis le contexte tenant Y. Pas un risque immediat mais audit deviendrait incoherent.
   - Solution : Repository force `SET LOCAL app.tenant_id = '{tenantId}'` avant chaque INSERT, verifie que `current_setting('app.tenant_id')` matches le `tenant_id` du row. Test V20.

7. **Piege : Postgres INSERT > 1k req/s saturation.**
   - Pourquoi : Sous load test Sprint 33, 1k req/s de denied + 100% sample granted sature pool 100 connections, latence INSERT p99 monte a 200ms.
   - Solution : (a) Connection pool dedie `audit_pool` 20 connections separe du pool app principal, (b) Batching `RbacAuditBatcher` Sprint 22 buffer 100 rows / 5s, (c) Postgres async commit `synchronous_commit = local` pour audit_log uniquement (acceptable risk perte 100ms window vs perf gain 3x). Tests V21 load.

8. **Piege : Kafka topic non provisionne -> producer throws au boot.**
   - Pourquoi : kafkajs producer.send fait `Topic does not exist` si auto-creation desactivee broker Redpanda config production.
   - Solution : Migration script `pnpm kafka:provision` Sprint 3 cree les topics au boot CI/CD, README documente. Test integration V22 verifie topic existence avant send.

9. **Piege : retention 7 ans CNDP -- DELETE rows degrade index.**
   - Pourquoi : DELETE direct sur audit_log apres 7 ans bloat les indexes B-tree, VACUUM FULL necessaire mais lock exclusif table.
   - Solution : Partitioning par mois Sprint 33 + DROP PARTITION ancienne (`audit_log_2026_01` apres 7 ans = 2033_01). Documentation. Cette tache laisse rows croitre sans purge. Test V23 verifie indexes coherents.

10. **Piege : ip_address PII propagation -- CNDP minimization.**
    - Pourquoi : IP est PII selon CNDP (lien identifiant pseudonyme). Le stockage 7 ans est conforme ACAPS mais doit etre justifie. Si IP partagee multi-tenant (proxy entreprise), traitement special.
    - Solution : Colonne `request_context.ip_address` est documentee dans Registre des Traitements CNDP (`docs/cndp/registre-traitements.md` mis-a-jour Sprint 7). Sprint 26 implemente endpoint user `GET /api/v1/me/audit-trail` avec self-redaction. Test V24 verifie IP persistee.

11. **Piege : Idempotency-Key replay attack consommateur Kafka.**
    - Pourquoi : Si un attaquant replay un message Kafka (acces broker compromis), idempotency-key doit empecher double-traitement.
    - Solution : Consommateur Sprint 33 maintient Set Redis `audit:dedup:{YYYYMMDD}` TTL 48h, verifie avant traitement. Test integration V25 simule replay.

12. **Piege : NestJS DI cycle si RbacAuditService depend Guards et inversement.**
    - Pourquoi : `RbacAuditService` ne doit JAMAIS depender des Guards (sinon cycle). Mais Guards depend de `RbacAuditService`.
    - Solution : `RbacAuditService` depend uniquement DrizzleService + KafkaProducerService + Logger + ConfigService. Aucune injection inverse. Test V26 verifie absence cycle.

13. **Piege : `endpoint` field contient query string PII (?email=).**
    - Pourquoi : `req.url` peut contenir `?email=user@example.com` ou tokens. Persistance permanente PII.
    - Solution : Helper `sanitizeEndpoint(url): string` strip query string, garde uniquement path. Test V27.

14. **Piege : `requestId` correlation OpenTelemetry absent dans audit log.**
    - Pourquoi : Sprint 22 ajoute trace-id W3C. Si audit log ne propage pas, impossible de correler audit row avec trace span.
    - Solution : Champ `request_context.request_id` rempli depuis `req.headers['x-request-id']` ou genere UUID v4 fallback. Test V28.

### 2.7 Conformite legale Maroc -- impact RbacAuditService

| Loi / norme | Impact RbacAuditService | Implementation |
|-------------|--------------------------|----------------|
| **CNDP loi 09-08 article 18** | Conservation logs acces 7 ans | `AUDIT_LOG_RETENTION_DAYS=2555` (7 ans), partitioning monthly, DROP partition apres 7 ans Sprint 33 |
| **CNDP loi 09-08 article 7** | Droit acces utilisateur a son trail | Endpoint `GET /api/v1/me/audit-trail` Sprint 26 paginate `audit_log WHERE actor_user_id = ?` |
| **CNDP loi 09-08 article 4** | Minimisation donnees PII | Sanitization endpoint + redaction body Sprint 26 |
| **ACAPS Circulaire 2018/01 article 9** | Audit trail integral transactions assurance | Toutes les actions `insure.policies.*`, `insure.quotes.*`, `pay.*` toujours loggees (no sampling) via SENSITIVE_PERMISSION_PATTERNS |
| **AMC Loi 12-18 article 15** | Tracabilite AML actions | Permissions `compliance.aml_alerts.*` toujours loggees |
| **BAM circulaire 1/G/2007** | Separation des roles audit / operationnel | RbacAuditRepository utilise pool dedie + RLS bypass interdit |
| **Loi 17-99 article 73** | Conservation contrats assurance 10 ans | Out-of-scope audit_log (concerne donnees metier policies, traite Sprint 14) |
| **ANRT decret signature** | Audit signatures electroniques | Out-of-scope (Sprint 11 trace `docs.signatures.*` separement) |

### 2.8 Performance budget RbacAuditService

- `logAccessGranted` async fire-and-forget : pas dans critical path Guard, target throughput 2000 ops/s.
- `logAccessDenied` SYNC : p99 < 15ms (INSERT Postgres ~5ms + Kafka enqueue ~2ms), target throughput 200 ops/s.
- `logAbacDenied` SYNC : p99 < 15ms idem.
- INSERT Postgres p99 < 5ms (pool dedie 20 connexions).
- Kafka producer enqueue p99 < 2ms (acks=1 pour perf, retry async).
- Sampling check (`Math.random() < rate`) : <1us, negligeable.

### 2.9 Failure modes

| Failure | Detection | Handling | Test |
|---------|-----------|----------|------|
| Postgres down INSERT denied | Repository try/catch | Retry 3x exponentiel, fallback log Pino `level=fatal`, increment `rbac_audit_db_failures_total`, NE PAS bloquer 403 (security > availability) | V29 |
| Postgres down INSERT granted | Async catch | Log warn, increment counter, no retry (fire-and-forget) | V30 |
| Kafka broker down | Producer error event | Retry 3x, DLQ in-memory queue (size 1000), eviction LRU si full, log error | V31 |
| Kafka topic missing | Producer error code | Throw at boot via health check, abort startup | V22 |
| Sampling mis-config (rate > 1) | Module init validation | Throw `Error('Invalid sampling rate')` | V32 |
| Idempotency-key collision (UUID v4) | Probabilite 1e-37, ignore | -- | -- |
| Memory leak in-memory queue | Health check interval | Clear queue if > 10000, alert | V33 |

### 2.10 Volumetrie attendue (annee 1)

Estimation production tenant Bennani (1 broker, 30 users, 100 polices/mois) :
- Granted RBAC : ~2000 req/jour (avec sampling 10% = 200 rows audit_log)
- Denied RBAC : ~10 rows/jour
- Denied ABAC : ~5 rows/jour
- Total tenant Bennani an 1 : ~75k rows audit_log, ~22 MB.

Multiplie par 50 tenants (cible end-of-year an 2) : ~3.7M rows / ~1.1 GB. Croissance lineaire jusqu'a Sprint 33 partitioning.

---

## 3. Architecture context

### 3.1 Position dans le sprint

Cette tache 2.3.9 est la 9eme tache du Sprint 7 et la 31eme tache de la Phase 2. Elle :

- **Depend de** : Tache 2.3.8 (`AbacGuard` consume `logAbacDenied` interface), Tache 2.3.5 (`PermissionGuard` consume `logAccessGranted` / `logAccessDenied`), Tache 2.3.4 (`RoleGuard` consume `logAccessDenied`), Tache 2.3.7 (AbacResult typed), Tache 2.3.1 (Permission catalog), Sprint 6 (TenantContext AsyncLocalStorage), Sprint 5 (Pino + EventEmitter), Sprint 4 (DrizzleService + migration runner + RLS helpers), Sprint 3 (KafkaProducerService).
- **Bloque** : Tache 2.3.10 (PermissionCacheService Redis -- les events `auth.role_changed` consommes pour invalidation cache declenchent un audit log preliminaire), Tache 2.3.11 (admin endpoints introspection RBAC denials -- requete `audit_log` table), Tache 2.3.12 (E2E tests assert audit_log rows).
- **Apporte au sprint** : `RbacAuditService` injectable consommable par tous les Guards Sprint 7 + futurs services Sprint 8+ ; table `audit_log` Postgres partitionnable + indexee + RLS-protected ; topics Kafka audit provisionnes ; metrics Prometheus exposees pour Grafana Sprint 22.

### 3.2 Position dans le programme global

- **Sprint 7 Tache 2.3.10-2.3.12** : consomment `RbacAuditService` + `audit_log` table.
- **Sprint 8 CRM** : `ContactsController` traces denials sur `crm.contacts.read_own` ABAC.
- **Sprint 11 Docs** : traces denials `docs.documents.read_own`.
- **Sprint 13 Pay** : traces TimeBased denials `pay.refunds.create` (transaction > 30 jours).
- **Sprint 14 Insure** : traces StatusBased denials `insure.policies.cancel` (police expired).
- **Sprint 19 Repair** : traces OwnResources denials `repair.sinistres.read_assigned`.
- **Sprint 22 Observability** : Grafana dashboards consomment `rbac_audit_inserts_total{outcome}`, `rbac_audit_kafka_failures_total`, `rbac_audit_granted_sampled_out_total`. Alerts PagerDuty si `db_failures > 10/min`.
- **Sprint 26 admin module** : endpoint `GET /api/v1/admin/audit-log` paginate avec filtres `tenant_id`, `actor_user_id`, `action`, `outcome`, `from`, `to`. Endpoint `GET /api/v1/me/audit-trail` self-service utilisateur.
- **Sprint 33 SecOps alerting** : Kafka consumer `insurtech.events.audit.access_denied` analyse fenetre glissante 1h, alert Slack si > 100 denials meme `actor_user_id`. PagerDuty si > 10 denials/min meme IP.
- **Sprint 33 partitioning Postgres** : Migration installe `pg_partman` + partitions monthly RANGE(created_at).
- **Sprint 34 ACAPS reporting** : Rapport trimestriel agrege denials per role per tenant per permission categorie.

### 3.3 Diagramme schema table audit_log (ASCII)

```
+-----------------------------------------------------------+
| audit_log                                                  |
+-----------------------------------------------------------+
| id                  UUID PK         (gen UUIDv4)            |
| tenant_id           UUID NOT NULL   (RLS isolation)         |
| actor_user_id       UUID NULL       (NULL si anonyme)       |
| actor_role          VARCHAR(64)     (auth_role enum)        |
| action              VARCHAR(128)    ('auth.access_granted'  |
|                                      | 'auth.access_denied'  |
|                                      | 'auth.abac_denied'    |
|                                      | 'auth.bypass')        |
| resource_type       VARCHAR(64)     ('crm_contact', 'permission', ...) |
| resource_id         VARCHAR(128) NULL                      |
| endpoint            VARCHAR(512)    ('/api/v1/contacts/:id') |
| outcome             VARCHAR(32)     ('granted'|'denied'|'bypass') |
| policy              VARCHAR(64) NULL ('OwnResourcesPolicy') |
| reason              VARCHAR(128) NULL ('NOT_OWNER')         |
| permissions         TEXT[] NULL     (perms requises)        |
| request_context     JSONB           ({ip, ua, request_id, ts}) |
| created_at          TIMESTAMPTZ DEFAULT now()               |
+-----------------------------------------------------------+

INDEX :
  idx_audit_log_tenant_created   (tenant_id, created_at DESC)
  idx_audit_log_user_created     (actor_user_id, created_at DESC)
  idx_audit_log_action_created   (action, created_at DESC)
  idx_audit_log_resource         (resource_type, resource_id)

POLICY RLS :
  CREATE POLICY tenant_iso ON audit_log
    USING (app_can_access_tenant(tenant_id));
```

### 3.4 Diagramme flow logAccessDenied (ASCII)

```
PermissionGuard.canActivate -> denied
       |
       v
  rbacAudit.logAccessDenied({...})       SYNC await
       |
       | 1. Validate input Zod schema
       v
  LogAccessDeniedInput (typed)
       |
       | 2. Build audit_log row
       v
  AuditLogRow {
    id: UUIDv4(),
    tenant_id: ctx.tenantId,
    actor_user_id: ctx.userId,
    actor_role: ctx.role,
    action: 'auth.access_denied',
    resource_type: 'permission',
    endpoint: sanitizeEndpoint(req.url),
    outcome: 'denied',
    permissions: input.permissions,
    request_context: { ip, ua, request_id, timestamp }
  }
       |
       | 3. INSERT Postgres SYNC
       v
  await repository.insert(row)
       |
       | 4. Kafka emit ASYNC fire-and-forget
       v
  void kafkaProducer.send({
    topic: 'insurtech.events.audit.access_denied',
    key: tenantId,
    headers: { 'Idempotency-Key': row.id, 'Schema-Version': 'v1' },
    value: JSON.stringify(eventV1)
  }).catch(err => logger.error(err))
       |
       v
  return void  (Guard then throws ForbiddenException)
```

### 3.5 Diagramme flow Kafka topics (ASCII)

```
+-----------------+      +-------------------------+
| RbacAuditService |---->| Kafka Producer          |
+-----------------+      | acks=1 idempotent=false |
                         +-----------+-------------+
                                     |
              +----------------------+--------------------+
              v                                           v
   +----------------------+                  +----------------------+
   | insurtech.events.    |                  | insurtech.events.    |
   | audit.access_denied  |                  | audit.access_granted |
   | partitions=12        |                  | partitions=12        |
   | retention=7y         |                  | retention=2y         |
   | partition_key=tenant |                  | partition_key=tenant |
   +----+----------+------+                  +----------+-----------+
        |          |                                    |
        v          v                                    v
 Sprint 33   Sprint 34 ACAPS               Sprint 22 observability
 SecOps      reporting trimestriel         Grafana dashboards
 Slack       Aggregations per tenant       Granted volume baseline
 PagerDuty
```

---

## 4. Livrables checkables (25+)

- [ ] L1 -- Service `repo/apps/api/src/modules/auth/services/rbac-audit.service.ts` (~280 lignes) injectable NestJS @Injectable() singleton.
- [ ] L2 -- Methode `logAccessGranted({ userId, tenantId, role, permission, resource, endpoint })` async fire-and-forget INSERT audit_log + Kafka emit (si feature flag).
- [ ] L3 -- Methode `logAccessDenied({ userId, tenantId, role, permissions, endpoint, reason })` SYNC await INSERT audit_log + Kafka emit asynchrone retry.
- [ ] L4 -- Methode `logAbacDenied({ permission, policy, reason, userId, resource })` SYNC await INSERT + Kafka.
- [ ] L5 -- Methode `logSuperAdminBypass({ userId, role, permission, endpoint })` toujours sync log (compliance).
- [ ] L6 -- Entity `repo/apps/api/src/modules/auth/entities/rbac-audit.entity.ts` (~120 lignes) TypeORM avec colonnes complete + 4 indexes composites.
- [ ] L7 -- DTOs Zod `repo/apps/api/src/modules/auth/dto/rbac-audit.dto.ts` (~150 lignes) `LogAccessGrantedInput`, `LogAccessDeniedInput`, `LogAbacDeniedInput`.
- [ ] L8 -- Event schemas `repo/apps/api/src/modules/auth/events/rbac-audit.events.ts` (~120 lignes) Kafka schemas v1 versionnes.
- [ ] L9 -- Producer Kafka `repo/apps/api/src/modules/auth/services/rbac-audit-kafka-producer.ts` (~150 lignes) wrapper avec idempotency-key, retry exponentiel, DLQ in-memory.
- [ ] L10 -- Sampling helper `repo/apps/api/src/modules/auth/services/rbac-audit-sampling.ts` (~80 lignes) `shouldLogGranted(role, permission): boolean` avec bypass exceptions.
- [ ] L11 -- Repository `repo/apps/api/src/modules/auth/repositories/rbac-audit.repository.ts` (~120 lignes) TypeORM custom avec batch insert (Sprint 22 prep) + sanitization endpoint.
- [ ] L12 -- Module `repo/apps/api/src/modules/auth/rbac-audit.module.ts` (~80 lignes) NestJS module + providers + exports.
- [ ] L13 -- Migration `repo/apps/api/src/migrations/1715000000000-CreateRbacAuditLogTable.ts` (~150 lignes) cree table + indexes + RLS policy + commentaires.
- [ ] L14 -- Tests `rbac-audit.service.spec.ts` (~250 lignes) 25+ tests scenarios.
- [ ] L15 -- Tests `rbac-audit-kafka-producer.spec.ts` (~120 lignes).
- [ ] L16 -- Fixtures `rbac-audit-fixtures.ts` (~100 lignes) factory rows + DTO valides.
- [ ] L17 -- Barrel exports `repo/apps/api/src/modules/auth/index.ts` ajoute `RbacAuditService`, `RbacAuditModule`, types.
- [ ] L18 -- Variables environnement `.env.example` ajoute `LOG_RBAC_GRANTED`, `RBAC_AUDIT_SAMPLING_RATE`, `KAFKA_AUDIT_TOPIC_PREFIX`, `KAFKA_AUDIT_RETRY_MAX`, `AUDIT_LOG_RETENTION_DAYS`, `AUDIT_LOG_DB_POOL_SIZE`.
- [ ] L19 -- ConfigService Zod schema mis-a-jour validation env.
- [ ] L20 -- Metrics Prometheus exposes : `rbac_audit_inserts_total{outcome,role}`, `rbac_audit_kafka_events_total{topic}`, `rbac_audit_kafka_failures_total{topic,reason}`, `rbac_audit_granted_sampled_out_total{tenant,role}`, `rbac_audit_db_failures_total{method}`, `rbac_audit_async_failures_total{method}`.
- [ ] L21 -- Documentation README ajoute section `## Audit Trail` avec usage + retention + queries SQL utiles.
- [ ] L22 -- ADR `docs/adr/026-rbac-audit-centralized-service.md` (~50 lignes) decision sync vs async + sampling + Kafka strategy.
- [ ] L23 -- Updates `docs/cndp/registre-traitements.md` ajoute traitement audit_log avec finalite + duree conservation 7 ans + base legale ACAPS.
- [ ] L24 -- Health check `RbacAuditHealthIndicator` (~50 lignes) verify Postgres reachable + Kafka producer connected.
- [ ] L25 -- Tests load script `scripts/load-test-audit.ts` simule 1k req/s denied + 10k granted + verifie INSERT throughput + Kafka delivery rate.
- [ ] L26 -- Lint rule custom (skip si trop ambitieux) `eslint-plugin-skalean/sensitive-perms-coverage` valide SENSITIVE_PERMISSION_PATTERNS avec catalog Permission.
- [ ] L27 -- Conventions absolues skalean-insurtech respectees (TypeScript strict, no any, Zod validation, AUCUNE EMOJI, structured Pino, prom-client metrics).
- [ ] L28 -- Coverage > 95% sur fichiers livres.

---

## 5. Fichiers crees / modifies

```
CREES :
repo/apps/api/src/modules/auth/services/rbac-audit.service.ts            # ~280 lignes
repo/apps/api/src/modules/auth/services/rbac-audit-kafka-producer.ts     # ~150 lignes
repo/apps/api/src/modules/auth/services/rbac-audit-sampling.ts           # ~80 lignes
repo/apps/api/src/modules/auth/repositories/rbac-audit.repository.ts     # ~120 lignes
repo/apps/api/src/modules/auth/entities/rbac-audit.entity.ts             # ~120 lignes
repo/apps/api/src/modules/auth/dto/rbac-audit.dto.ts                     # ~150 lignes
repo/apps/api/src/modules/auth/events/rbac-audit.events.ts               # ~120 lignes
repo/apps/api/src/modules/auth/health/rbac-audit-health.indicator.ts     # ~50 lignes
repo/apps/api/src/modules/auth/rbac-audit.module.ts                      # ~80 lignes
repo/apps/api/src/migrations/1715000000000-CreateRbacAuditLogTable.ts    # ~150 lignes

repo/apps/api/src/modules/auth/services/rbac-audit.service.spec.ts        # ~250 lignes
repo/apps/api/src/modules/auth/services/rbac-audit-kafka-producer.spec.ts # ~120 lignes
repo/apps/api/src/modules/auth/services/rbac-audit-sampling.spec.ts       # ~80 lignes
repo/apps/api/src/modules/auth/__fixtures__/rbac-audit-fixtures.ts        # ~100 lignes

scripts/load-test-audit.ts                                                # ~80 lignes
docs/adr/026-rbac-audit-centralized-service.md                            # ~50 lignes

MODIFIES :
repo/apps/api/src/modules/auth/index.ts                                   # +10 exports barrel
repo/apps/api/src/modules/auth/auth.module.ts                             # +import RbacAuditModule
repo/apps/api/src/config/env.schema.ts                                    # +6 vars Zod
.env.example                                                              # +6 vars commentees
docs/cndp/registre-traitements.md                                         # +section audit_log
README.md                                                                 # +section Audit Trail
```

---

## 6. Code patterns COMPLETS

### 6.1 Fichier `rbac-audit.entity.ts` (TypeORM entity, ~120 lignes)

```typescript
// repo/apps/api/src/modules/auth/entities/rbac-audit.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import type { AuthRole } from '@insurtech/auth/rbac';

/**
 * Audit log entity persisting all RBAC + ABAC authorization decisions.
 *
 * Compliance :
 * - CNDP loi 09-08 article 18 : retention 7 years.
 * - ACAPS Circulaire 2018/01 article 9 : audit trail integral.
 * - Multi-tenant isolation via RLS policy on tenant_id.
 *
 * Sprint 33 will partition this table monthly via pg_partman.
 */
export type AuditAction =
  | 'auth.access_granted'
  | 'auth.access_denied'
  | 'auth.abac_denied'
  | 'auth.bypass';

export type AuditOutcome = 'granted' | 'denied' | 'bypass';

export interface AuditRequestContext {
  ip_address: string | null;
  user_agent: string | null;
  request_id: string;
  timestamp: string; // ISO 8601
}

@Entity({ name: 'audit_log' })
@Index('idx_audit_log_tenant_created', ['tenant_id', 'created_at'])
@Index('idx_audit_log_user_created', ['actor_user_id', 'created_at'])
@Index('idx_audit_log_action_created', ['action', 'created_at'])
@Index('idx_audit_log_resource', ['resource_type', 'resource_id'])
export class RbacAuditLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenant_id!: string;

  @Column({ type: 'uuid', nullable: true })
  actor_user_id!: string | null;

  @Column({ type: 'varchar', length: 64 })
  actor_role!: AuthRole;

  @Column({ type: 'varchar', length: 128 })
  action!: AuditAction;

  @Column({ type: 'varchar', length: 64 })
  resource_type!: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  resource_id!: string | null;

  @Column({ type: 'varchar', length: 512 })
  endpoint!: string;

  @Column({ type: 'varchar', length: 32 })
  outcome!: AuditOutcome;

  @Column({ type: 'varchar', length: 64, nullable: true })
  policy!: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  reason!: string | null;

  @Column({ type: 'text', array: true, nullable: true })
  permissions!: string[] | null;

  @Column({ type: 'jsonb' })
  request_context!: AuditRequestContext;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  created_at!: Date;
}
```

### 6.2 Fichier `rbac-audit.dto.ts` (DTOs Zod, ~150 lignes)

```typescript
// repo/apps/api/src/modules/auth/dto/rbac-audit.dto.ts
import { z } from 'zod';
import { AuthRoleSchema } from '@insurtech/auth/rbac';
import { PermissionValueSchema } from '@insurtech/auth/permissions';

/**
 * Zod input validation DTOs for RbacAuditService methods.
 * All inputs strictly validated to prevent corruption of audit trail.
 */

const UuidSchema = z.string().uuid({ message: 'Invalid UUID format' });

const ResourceRefSchema = z.object({
  type: z.string().min(1).max(64),
  id: z.string().min(1).max(128).optional(),
});

const RequestContextSchema = z.object({
  ip_address: z.string().ip().nullable(),
  user_agent: z.string().max(2048).nullable(),
  request_id: z.string().max(128),
  timestamp: z.string().datetime(),
});

export const LogAccessGrantedInputSchema = z.object({
  userId: UuidSchema,
  tenantId: UuidSchema,
  role: AuthRoleSchema,
  permission: PermissionValueSchema,
  resource: ResourceRefSchema.optional(),
  endpoint: z.string().max(512),
  requestContext: RequestContextSchema,
});

export type LogAccessGrantedInput = z.infer<typeof LogAccessGrantedInputSchema>;

export const LogAccessDeniedInputSchema = z.object({
  userId: UuidSchema.nullable(),
  tenantId: UuidSchema,
  role: AuthRoleSchema,
  permissions: z.array(PermissionValueSchema).min(1),
  endpoint: z.string().max(512),
  reason: z.string().min(1).max(128),
  requestContext: RequestContextSchema,
});

export type LogAccessDeniedInput = z.infer<typeof LogAccessDeniedInputSchema>;

export const LogAbacDeniedInputSchema = z.object({
  userId: UuidSchema,
  tenantId: UuidSchema,
  role: AuthRoleSchema,
  permission: PermissionValueSchema,
  policy: z.string().min(1).max(64),
  reason: z.string().min(1).max(128),
  resource: ResourceRefSchema,
  endpoint: z.string().max(512),
  requestContext: RequestContextSchema,
});

export type LogAbacDeniedInput = z.infer<typeof LogAbacDeniedInputSchema>;

export const LogSuperAdminBypassInputSchema = z.object({
  userId: UuidSchema,
  tenantId: UuidSchema,
  role: AuthRoleSchema,
  permission: PermissionValueSchema,
  endpoint: z.string().max(512),
  requestContext: RequestContextSchema,
});

export type LogSuperAdminBypassInput = z.infer<
  typeof LogSuperAdminBypassInputSchema
>;

/**
 * Helper : sanitize endpoint URL to strip query string PII.
 */
export function sanitizeEndpoint(rawUrl: string): string {
  if (!rawUrl) return '';
  const idx = rawUrl.indexOf('?');
  const path = idx === -1 ? rawUrl : rawUrl.substring(0, idx);
  return path.substring(0, 512);
}

/**
 * Helper : truncate user-agent to safe length to avoid TOAST overflow.
 */
export function truncateUserAgent(ua: string | null | undefined): string | null {
  if (!ua) return null;
  const MAX = 2048;
  if (ua.length <= MAX) return ua;
  return `${ua.substring(0, MAX - 32)}[TRUNCATED:${ua.length}_BYTES]`;
}
```

### 6.3 Fichier `rbac-audit.events.ts` (Kafka schemas, ~120 lignes)

```typescript
// repo/apps/api/src/modules/auth/events/rbac-audit.events.ts
import { z } from 'zod';

/**
 * Kafka event schemas for audit topics.
 * All events versioned via 'schemaVersion' field + Kafka header 'Schema-Version'.
 *
 * Topics :
 *   - insurtech.events.audit.access_granted   (retention 2y)
 *   - insurtech.events.audit.access_denied    (retention 7y)
 *   - insurtech.events.audit.abac_denied      (retention 7y)
 *
 * Consumed by Sprint 33 SecOps alerting + Sprint 34 ACAPS reporting.
 */

export const KAFKA_AUDIT_TOPICS = {
  ACCESS_GRANTED: 'insurtech.events.audit.access_granted',
  ACCESS_DENIED: 'insurtech.events.audit.access_denied',
  ABAC_DENIED: 'insurtech.events.audit.abac_denied',
  DLQ: 'insurtech.events.audit.dlq',
} as const;

export type KafkaAuditTopic =
  (typeof KAFKA_AUDIT_TOPICS)[keyof typeof KAFKA_AUDIT_TOPICS];

const BaseAuditEventSchema = z.object({
  schemaVersion: z.literal('v1'),
  auditLogId: z.string().uuid(),
  tenantId: z.string().uuid(),
  userId: z.string().uuid().nullable(),
  role: z.string(),
  endpoint: z.string(),
  emittedAt: z.string().datetime(),
});

export const AccessGrantedEventSchema = BaseAuditEventSchema.extend({
  eventType: z.literal('access_granted'),
  permission: z.string(),
  resource: z
    .object({
      type: z.string(),
      id: z.string().optional(),
    })
    .optional(),
});

export type AccessGrantedEvent = z.infer<typeof AccessGrantedEventSchema>;

export const AccessDeniedEventSchema = BaseAuditEventSchema.extend({
  eventType: z.literal('access_denied'),
  permissions: z.array(z.string()).min(1),
  reason: z.string(),
});

export type AccessDeniedEvent = z.infer<typeof AccessDeniedEventSchema>;

export const AbacDeniedEventSchema = BaseAuditEventSchema.extend({
  eventType: z.literal('abac_denied'),
  permission: z.string(),
  policy: z.string(),
  reason: z.string(),
  resource: z.object({
    type: z.string(),
    id: z.string(),
  }),
});

export type AbacDeniedEvent = z.infer<typeof AbacDeniedEventSchema>;

export type AnyAuditEvent =
  | AccessGrantedEvent
  | AccessDeniedEvent
  | AbacDeniedEvent;

/**
 * Kafka headers helper.
 * Idempotency-Key allows downstream consumers to deduplicate replays.
 */
export function buildAuditKafkaHeaders(
  auditLogId: string,
  schemaVersion: 'v1' = 'v1',
): Record<string, string> {
  return {
    'Idempotency-Key': auditLogId,
    'Schema-Version': schemaVersion,
    'Content-Type': 'application/json',
  };
}
```

### 6.4 Fichier `rbac-audit-sampling.ts` (~80 lignes)

```typescript
// repo/apps/api/src/modules/auth/services/rbac-audit-sampling.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthRole } from '@insurtech/auth/rbac';
import type { PermissionValue } from '@insurtech/auth/permissions';

/**
 * Patterns for permissions which MUST always be logged regardless of sampling.
 * Aligned with CNDP / ACAPS / AML compliance requirements.
 */
export const SENSITIVE_PERMISSION_PATTERNS: readonly RegExp[] = [
  /^admin\..*/,
  /^compliance\..*/,
  /^cndp\..*/,
  /^acaps\..*/,
  /^aml\..*/,
  /^cross_tenant\..*/,
  /^sky\.tools\.invoke$/, // Sprint 31 AI tool invocation
] as const;

/**
 * Privileged roles whose actions are always audited (no sampling).
 */
export const PRIVILEGED_ROLES: readonly AuthRole[] = [
  'super_admin_platform',
  'analyst_support',
] as const;

@Injectable()
export class RbacAuditSampling {
  private readonly samplingRate: number;
  private readonly logGrantedEnabled: boolean;

  constructor(private readonly config: ConfigService) {
    const rate = this.config.get<number>('RBAC_AUDIT_SAMPLING_RATE', 0.1);
    if (rate < 0 || rate > 1) {
      throw new Error(
        `Invalid RBAC_AUDIT_SAMPLING_RATE: ${rate}. Must be in [0, 1].`,
      );
    }
    this.samplingRate = rate;
    this.logGrantedEnabled = this.config.get<boolean>(
      'LOG_RBAC_GRANTED',
      false,
    );
  }

  /**
   * Returns true if a granted event should be persisted.
   * - Always true for privileged roles (super_admin, analyst_support).
   * - Always true for sensitive permission patterns.
   * - Otherwise probabilistic based on RBAC_AUDIT_SAMPLING_RATE.
   * - If LOG_RBAC_GRANTED=false, only privileged + sensitive are logged.
   */
  shouldLogGranted(role: AuthRole, permission: PermissionValue): boolean {
    if (PRIVILEGED_ROLES.includes(role)) return true;
    if (SENSITIVE_PERMISSION_PATTERNS.some((re) => re.test(permission))) {
      return true;
    }
    if (!this.logGrantedEnabled) return false;
    return Math.random() < this.samplingRate;
  }

  /**
   * Denied events are ALWAYS logged. Helper kept for API consistency.
   */
  shouldLogDenied(): boolean {
    return true;
  }

  getSamplingRate(): number {
    return this.samplingRate;
  }
}
```

### 6.5 Fichier `rbac-audit-kafka-producer.ts` (~150 lignes)

```typescript
// repo/apps/api/src/modules/auth/services/rbac-audit-kafka-producer.ts
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Producer, CompressionTypes } from 'kafkajs';
import { Counter } from 'prom-client';
import {
  buildAuditKafkaHeaders,
  KAFKA_AUDIT_TOPICS,
  type AnyAuditEvent,
  type KafkaAuditTopic,
} from '../events/rbac-audit.events';

interface KafkaSendArgs {
  topic: KafkaAuditTopic;
  partitionKey: string;
  auditLogId: string;
  event: AnyAuditEvent;
}

@Injectable()
export class RbacAuditKafkaProducer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RbacAuditKafkaProducer.name);
  private readonly producer: Producer;
  private readonly retryMax: number;
  private connected = false;

  private readonly counterEvents = new Counter({
    name: 'rbac_audit_kafka_events_total',
    help: 'Audit events successfully sent to Kafka',
    labelNames: ['topic'],
  });

  private readonly counterFailures = new Counter({
    name: 'rbac_audit_kafka_failures_total',
    help: 'Audit events failing to be sent to Kafka',
    labelNames: ['topic', 'reason'],
  });

  constructor(private readonly config: ConfigService) {
    const brokers = this.config
      .getOrThrow<string>('KAFKA_BROKERS')
      .split(',')
      .map((s) => s.trim());
    this.retryMax = this.config.get<number>('KAFKA_AUDIT_RETRY_MAX', 3);

    const kafka = new Kafka({
      clientId: 'insurtech-api-audit',
      brokers,
      retry: { retries: this.retryMax, initialRetryTime: 100, maxRetryTime: 1000 },
    });

    this.producer = kafka.producer({
      allowAutoTopicCreation: false,
      transactionTimeout: 5000,
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.producer.connect();
      this.connected = true;
      this.logger.log('Kafka audit producer connected');
    } catch (err) {
      this.logger.error('Failed to connect Kafka audit producer', err as Error);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.connected) return;
    try {
      await this.producer.disconnect();
      this.logger.log('Kafka audit producer disconnected');
    } catch (err) {
      this.logger.error('Error disconnecting Kafka audit producer', err as Error);
    }
  }

  /**
   * Fire-and-forget send with internal retry already handled by kafkajs config.
   * Failures bumped to DLQ topic + Prometheus counter, never blocks caller.
   */
  async send(args: KafkaSendArgs): Promise<void> {
    if (!this.connected) {
      this.counterFailures.inc({ topic: args.topic, reason: 'not_connected' });
      return;
    }

    const headers = buildAuditKafkaHeaders(args.auditLogId);

    try {
      await this.producer.send({
        topic: args.topic,
        compression: CompressionTypes.GZIP,
        messages: [
          {
            key: args.partitionKey,
            value: JSON.stringify(args.event),
            headers,
          },
        ],
      });
      this.counterEvents.inc({ topic: args.topic });
    } catch (err) {
      this.counterFailures.inc({
        topic: args.topic,
        reason: (err as Error).name || 'unknown',
      });
      this.logger.warn(
        { auditLogId: args.auditLogId, error: (err as Error).message },
        'Kafka audit send failed, attempting DLQ',
      );
      await this.sendToDlq(args).catch((dlqErr) => {
        this.logger.error(
          { auditLogId: args.auditLogId, dlqErr: (dlqErr as Error).message },
          'DLQ send also failed',
        );
      });
    }
  }

  private async sendToDlq(args: KafkaSendArgs): Promise<void> {
    if (!this.connected) return;
    await this.producer.send({
      topic: KAFKA_AUDIT_TOPICS.DLQ,
      messages: [
        {
          key: args.partitionKey,
          value: JSON.stringify({
            originalTopic: args.topic,
            event: args.event,
            failedAt: new Date().toISOString(),
          }),
          headers: buildAuditKafkaHeaders(args.auditLogId),
        },
      ],
    });
  }

  isConnected(): boolean {
    return this.connected;
  }
}
```

### 6.6 Fichier `rbac-audit.repository.ts` (~120 lignes)

```typescript
// repo/apps/api/src/modules/auth/repositories/rbac-audit.repository.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Counter } from 'prom-client';
import { RbacAuditLogEntity } from '../entities/rbac-audit.entity';
import type { AuditAction, AuditOutcome } from '../entities/rbac-audit.entity';
import type { AuditRequestContext } from '../entities/rbac-audit.entity';

export interface InsertAuditRowArgs {
  id: string;
  tenantId: string;
  actorUserId: string | null;
  actorRole: string;
  action: AuditAction;
  resourceType: string;
  resourceId: string | null;
  endpoint: string;
  outcome: AuditOutcome;
  policy: string | null;
  reason: string | null;
  permissions: string[] | null;
  requestContext: AuditRequestContext;
}

@Injectable()
export class RbacAuditRepository {
  private readonly logger = new Logger(RbacAuditRepository.name);

  private readonly counterInserts = new Counter({
    name: 'rbac_audit_inserts_total',
    help: 'Audit log INSERT operations',
    labelNames: ['outcome', 'role'],
  });

  private readonly counterDbFailures = new Counter({
    name: 'rbac_audit_db_failures_total',
    help: 'Audit log INSERT failures',
    labelNames: ['method'],
  });

  constructor(
    @InjectRepository(RbacAuditLogEntity)
    private readonly repo: Repository<RbacAuditLogEntity>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Insert audit row with explicit RLS tenant guard.
   * Uses SET LOCAL app.tenant_id to ensure RLS isolation even if connection
   * is reused from pool.
   */
  async insertRow(args: InsertAuditRowArgs): Promise<void> {
    try {
      await this.dataSource.transaction(async (manager) => {
        await manager.query(`SET LOCAL app.tenant_id = $1`, [args.tenantId]);
        await manager.insert(RbacAuditLogEntity, {
          id: args.id,
          tenant_id: args.tenantId,
          actor_user_id: args.actorUserId,
          actor_role: args.actorRole as never,
          action: args.action,
          resource_type: args.resourceType,
          resource_id: args.resourceId,
          endpoint: args.endpoint,
          outcome: args.outcome,
          policy: args.policy,
          reason: args.reason,
          permissions: args.permissions,
          request_context: args.requestContext,
        });
      });
      this.counterInserts.inc({ outcome: args.outcome, role: args.actorRole });
    } catch (err) {
      this.counterDbFailures.inc({ method: 'insertRow' });
      this.logger.error(
        { auditLogId: args.id, err: (err as Error).message },
        'Failed to insert audit log row',
      );
      throw err;
    }
  }

  /**
   * Query audit rows by tenant + filters (used by Sprint 26 admin endpoints).
   */
  async findByTenant(
    tenantId: string,
    opts: {
      from?: Date;
      to?: Date;
      actorUserId?: string;
      action?: AuditAction;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<RbacAuditLogEntity[]> {
    const qb = this.repo
      .createQueryBuilder('a')
      .where('a.tenant_id = :tenantId', { tenantId })
      .orderBy('a.created_at', 'DESC')
      .limit(opts.limit ?? 50)
      .offset(opts.offset ?? 0);

    if (opts.from) qb.andWhere('a.created_at >= :from', { from: opts.from });
    if (opts.to) qb.andWhere('a.created_at <= :to', { to: opts.to });
    if (opts.actorUserId) {
      qb.andWhere('a.actor_user_id = :uid', { uid: opts.actorUserId });
    }
    if (opts.action) qb.andWhere('a.action = :action', { action: opts.action });

    return qb.getMany();
  }
}
```

### 6.7 Fichier `rbac-audit.service.ts` (~280 lignes)

```typescript
// repo/apps/api/src/modules/auth/services/rbac-audit.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Counter } from 'prom-client';
import { RbacAuditRepository } from '../repositories/rbac-audit.repository';
import { RbacAuditKafkaProducer } from './rbac-audit-kafka-producer';
import { RbacAuditSampling } from './rbac-audit-sampling';
import {
  KAFKA_AUDIT_TOPICS,
  type AccessDeniedEvent,
  type AccessGrantedEvent,
  type AbacDeniedEvent,
} from '../events/rbac-audit.events';
import {
  LogAccessGrantedInputSchema,
  LogAccessDeniedInputSchema,
  LogAbacDeniedInputSchema,
  LogSuperAdminBypassInputSchema,
  sanitizeEndpoint,
  truncateUserAgent,
  type LogAccessGrantedInput,
  type LogAccessDeniedInput,
  type LogAbacDeniedInput,
  type LogSuperAdminBypassInput,
} from '../dto/rbac-audit.dto';

/**
 * Centralized RBAC + ABAC audit service.
 *
 * Behaviors :
 *   - logAccessGranted : ASYNC fire-and-forget INSERT + Kafka emit (subject to sampling).
 *   - logAccessDenied  : SYNC await INSERT + ASYNC Kafka emit (compliance).
 *   - logAbacDenied    : SYNC await INSERT + ASYNC Kafka emit (compliance).
 *   - logSuperAdminBypass : SYNC await INSERT (always, no sampling).
 *
 * All denials are persisted regardless of sampling configuration.
 * Granted events are sampled (default 10%) unless from privileged role
 * or matching sensitive permission patterns.
 */
@Injectable()
export class RbacAuditService {
  private readonly logger = new Logger(RbacAuditService.name);

  private readonly counterAsyncFailures = new Counter({
    name: 'rbac_audit_async_failures_total',
    help: 'Async audit method failures (granted only)',
    labelNames: ['method'],
  });

  private readonly counterSampledOut = new Counter({
    name: 'rbac_audit_granted_sampled_out_total',
    help: 'Granted events skipped due to sampling',
    labelNames: ['tenant', 'role'],
  });

  constructor(
    private readonly repository: RbacAuditRepository,
    private readonly kafkaProducer: RbacAuditKafkaProducer,
    private readonly sampling: RbacAuditSampling,
  ) {}

  /**
   * Log a successful permission grant. Fire-and-forget.
   * Subject to sampling; bypassed for privileged roles + sensitive perms.
   */
  logAccessGranted(input: LogAccessGrantedInput): void {
    const validated = LogAccessGrantedInputSchema.parse(input);

    if (!this.sampling.shouldLogGranted(validated.role, validated.permission)) {
      this.counterSampledOut.inc({
        tenant: validated.tenantId,
        role: validated.role,
      });
      return;
    }

    const auditLogId = randomUUID();
    const sanitizedEndpoint = sanitizeEndpoint(validated.endpoint);

    void this.persistAndEmitGranted(auditLogId, validated, sanitizedEndpoint).catch(
      (err) => {
        this.counterAsyncFailures.inc({ method: 'logAccessGranted' });
        this.logger.warn(
          { auditLogId, err: (err as Error).message },
          'Async granted audit failed (non-blocking)',
        );
      },
    );
  }

  private async persistAndEmitGranted(
    auditLogId: string,
    input: LogAccessGrantedInput,
    sanitizedEndpoint: string,
  ): Promise<void> {
    await this.repository.insertRow({
      id: auditLogId,
      tenantId: input.tenantId,
      actorUserId: input.userId,
      actorRole: input.role,
      action: 'auth.access_granted',
      resourceType: input.resource?.type ?? 'permission',
      resourceId: input.resource?.id ?? null,
      endpoint: sanitizedEndpoint,
      outcome: 'granted',
      policy: null,
      reason: null,
      permissions: [input.permission],
      requestContext: {
        ...input.requestContext,
        user_agent: truncateUserAgent(input.requestContext.user_agent),
      },
    });

    const event: AccessGrantedEvent = {
      schemaVersion: 'v1',
      eventType: 'access_granted',
      auditLogId,
      tenantId: input.tenantId,
      userId: input.userId,
      role: input.role,
      endpoint: sanitizedEndpoint,
      permission: input.permission,
      resource: input.resource,
      emittedAt: new Date().toISOString(),
    };

    await this.kafkaProducer.send({
      topic: KAFKA_AUDIT_TOPICS.ACCESS_GRANTED,
      partitionKey: input.tenantId,
      auditLogId,
      event,
    });
  }

  /**
   * Log a permission denial (RBAC). SYNC await + Kafka emit async.
   * Always persisted regardless of sampling.
   */
  async logAccessDenied(input: LogAccessDeniedInput): Promise<void> {
    const validated = LogAccessDeniedInputSchema.parse(input);
    const auditLogId = randomUUID();
    const sanitizedEndpoint = sanitizeEndpoint(validated.endpoint);

    await this.repository.insertRow({
      id: auditLogId,
      tenantId: validated.tenantId,
      actorUserId: validated.userId,
      actorRole: validated.role,
      action: 'auth.access_denied',
      resourceType: 'permission',
      resourceId: null,
      endpoint: sanitizedEndpoint,
      outcome: 'denied',
      policy: null,
      reason: validated.reason,
      permissions: validated.permissions,
      requestContext: {
        ...validated.requestContext,
        user_agent: truncateUserAgent(validated.requestContext.user_agent),
      },
    });

    const event: AccessDeniedEvent = {
      schemaVersion: 'v1',
      eventType: 'access_denied',
      auditLogId,
      tenantId: validated.tenantId,
      userId: validated.userId,
      role: validated.role,
      endpoint: sanitizedEndpoint,
      permissions: validated.permissions,
      reason: validated.reason,
      emittedAt: new Date().toISOString(),
    };

    void this.kafkaProducer
      .send({
        topic: KAFKA_AUDIT_TOPICS.ACCESS_DENIED,
        partitionKey: validated.tenantId,
        auditLogId,
        event,
      })
      .catch((err) => {
        this.logger.warn(
          { auditLogId, err: (err as Error).message },
          'Kafka emit denied event failed (DLQ retry attempted)',
        );
      });
  }

  /**
   * Log an ABAC contextual denial. SYNC await + Kafka emit async.
   */
  async logAbacDenied(input: LogAbacDeniedInput): Promise<void> {
    const validated = LogAbacDeniedInputSchema.parse(input);
    const auditLogId = randomUUID();
    const sanitizedEndpoint = sanitizeEndpoint(validated.endpoint);

    await this.repository.insertRow({
      id: auditLogId,
      tenantId: validated.tenantId,
      actorUserId: validated.userId,
      actorRole: validated.role,
      action: 'auth.abac_denied',
      resourceType: validated.resource.type,
      resourceId: validated.resource.id ?? null,
      endpoint: sanitizedEndpoint,
      outcome: 'denied',
      policy: validated.policy,
      reason: validated.reason,
      permissions: [validated.permission],
      requestContext: {
        ...validated.requestContext,
        user_agent: truncateUserAgent(validated.requestContext.user_agent),
      },
    });

    const event: AbacDeniedEvent = {
      schemaVersion: 'v1',
      eventType: 'abac_denied',
      auditLogId,
      tenantId: validated.tenantId,
      userId: validated.userId,
      role: validated.role,
      endpoint: sanitizedEndpoint,
      permission: validated.permission,
      policy: validated.policy,
      reason: validated.reason,
      resource: {
        type: validated.resource.type,
        id: validated.resource.id ?? '',
      },
      emittedAt: new Date().toISOString(),
    };

    void this.kafkaProducer
      .send({
        topic: KAFKA_AUDIT_TOPICS.ABAC_DENIED,
        partitionKey: validated.tenantId,
        auditLogId,
        event,
      })
      .catch((err) => {
        this.logger.warn(
          { auditLogId, err: (err as Error).message },
          'Kafka emit abac_denied event failed',
        );
      });
  }

  /**
   * Log a super_admin / analyst_support bypass. SYNC always, no sampling.
   * Compliance ACAPS / CNDP requires full traceability of privileged access.
   */
  async logSuperAdminBypass(input: LogSuperAdminBypassInput): Promise<void> {
    const validated = LogSuperAdminBypassInputSchema.parse(input);
    const auditLogId = randomUUID();

    await this.repository.insertRow({
      id: auditLogId,
      tenantId: validated.tenantId,
      actorUserId: validated.userId,
      actorRole: validated.role,
      action: 'auth.bypass',
      resourceType: 'permission',
      resourceId: null,
      endpoint: sanitizeEndpoint(validated.endpoint),
      outcome: 'bypass',
      policy: null,
      reason: 'SUPER_ADMIN_BYPASS',
      permissions: [validated.permission],
      requestContext: {
        ...validated.requestContext,
        user_agent: truncateUserAgent(validated.requestContext.user_agent),
      },
    });
  }
}
```

### 6.8 Fichier `rbac-audit.module.ts` (~80 lignes)

```typescript
// repo/apps/api/src/modules/auth/rbac-audit.module.ts
import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';
import { RbacAuditLogEntity } from './entities/rbac-audit.entity';
import { RbacAuditRepository } from './repositories/rbac-audit.repository';
import { RbacAuditService } from './services/rbac-audit.service';
import { RbacAuditKafkaProducer } from './services/rbac-audit-kafka-producer';
import { RbacAuditSampling } from './services/rbac-audit-sampling';
import { RbacAuditHealthIndicator } from './health/rbac-audit-health.indicator';

/**
 * Global module for RBAC audit service.
 * Marked @Global() so all Guards and feature modules across Sprint 8+ can
 * inject RbacAuditService without re-importing.
 */
@Global()
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([RbacAuditLogEntity]),
    TerminusModule,
  ],
  providers: [
    RbacAuditRepository,
    RbacAuditKafkaProducer,
    RbacAuditSampling,
    RbacAuditService,
    RbacAuditHealthIndicator,
  ],
  exports: [
    RbacAuditService,
    RbacAuditRepository,
    RbacAuditHealthIndicator,
  ],
})
export class RbacAuditModule {}
```

### 6.9 Fichier `rbac-audit-health.indicator.ts` (~50 lignes)

```typescript
// repo/apps/api/src/modules/auth/health/rbac-audit-health.indicator.ts
import { Injectable } from '@nestjs/common';
import {
  HealthCheckError,
  HealthIndicator,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { DataSource } from 'typeorm';
import { RbacAuditKafkaProducer } from '../services/rbac-audit-kafka-producer';

@Injectable()
export class RbacAuditHealthIndicator extends HealthIndicator {
  constructor(
    private readonly dataSource: DataSource,
    private readonly kafkaProducer: RbacAuditKafkaProducer,
  ) {
    super();
  }

  async check(key = 'rbac_audit'): Promise<HealthIndicatorResult> {
    const dbOk = this.dataSource.isInitialized;
    const kafkaOk = this.kafkaProducer.isConnected();

    const result = this.getStatus(key, dbOk && kafkaOk, {
      database: dbOk ? 'up' : 'down',
      kafka: kafkaOk ? 'up' : 'down',
    });

    if (!dbOk || !kafkaOk) {
      throw new HealthCheckError('RbacAudit health degraded', result);
    }
    return result;
  }
}
```

### 6.10 Fichier `1715000000000-CreateRbacAuditLogTable.ts` (~150 lignes)

```typescript
// repo/apps/api/src/migrations/1715000000000-CreateRbacAuditLogTable.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration : Create audit_log table with indexes + RLS policy.
 *
 * Compliance :
 *   - CNDP loi 09-08 article 18 (retention 7y).
 *   - ACAPS Circulaire 2018/01 article 9 (audit integral).
 *
 * Sprint 33 will install pg_partman + monthly partitioning.
 */
export class CreateRbacAuditLogTable1715000000000 implements MigrationInterface {
  name = 'CreateRbacAuditLogTable1715000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id       UUID NOT NULL,
        actor_user_id   UUID NULL,
        actor_role      VARCHAR(64) NOT NULL,
        action          VARCHAR(128) NOT NULL,
        resource_type   VARCHAR(64) NOT NULL,
        resource_id     VARCHAR(128) NULL,
        endpoint        VARCHAR(512) NOT NULL,
        outcome         VARCHAR(32) NOT NULL,
        policy          VARCHAR(64) NULL,
        reason          VARCHAR(128) NULL,
        permissions     TEXT[] NULL,
        request_context JSONB NOT NULL,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      COMMENT ON TABLE audit_log IS
        'RBAC + ABAC authorization decisions trail. Retention 7 years (CNDP 09-08 art 18).';
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN audit_log.actor_user_id IS
        'User performing action. NULL for anonymous (prospect public).';
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN audit_log.action IS
        'auth.access_granted | auth.access_denied | auth.abac_denied | auth.bypass';
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN audit_log.outcome IS
        'granted | denied | bypass';
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN audit_log.request_context IS
        'JSON: ip_address, user_agent, request_id, timestamp.';
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_created
        ON audit_log (tenant_id, created_at DESC);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_log_user_created
        ON audit_log (actor_user_id, created_at DESC)
        WHERE actor_user_id IS NOT NULL;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_log_action_created
        ON audit_log (action, created_at DESC);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_log_resource
        ON audit_log (resource_type, resource_id)
        WHERE resource_id IS NOT NULL;
    `);

    // Enable RLS
    await queryRunner.query(`ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`
      CREATE POLICY audit_log_tenant_isolation ON audit_log
        USING (app_can_access_tenant(tenant_id));
    `);
    await queryRunner.query(`
      CREATE POLICY audit_log_insert_tenant_match ON audit_log
        FOR INSERT
        WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));
    `);

    // Validation : action enum-like check constraint
    await queryRunner.query(`
      ALTER TABLE audit_log ADD CONSTRAINT chk_audit_action
        CHECK (action IN (
          'auth.access_granted',
          'auth.access_denied',
          'auth.abac_denied',
          'auth.bypass'
        ));
    `);
    await queryRunner.query(`
      ALTER TABLE audit_log ADD CONSTRAINT chk_audit_outcome
        CHECK (outcome IN ('granted', 'denied', 'bypass'));
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY IF EXISTS audit_log_insert_tenant_match ON audit_log;`);
    await queryRunner.query(`DROP POLICY IF EXISTS audit_log_tenant_isolation ON audit_log;`);
    await queryRunner.query(`ALTER TABLE audit_log DISABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_audit_log_resource;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_audit_log_action_created;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_audit_log_user_created;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_audit_log_tenant_created;`);
    await queryRunner.query(`DROP TABLE IF EXISTS audit_log;`);
  }
}
```

### 6.11 Fichier `rbac-audit-fixtures.ts` (~100 lignes)

```typescript
// repo/apps/api/src/modules/auth/__fixtures__/rbac-audit-fixtures.ts
import { randomUUID } from 'node:crypto';
import type {
  LogAccessGrantedInput,
  LogAccessDeniedInput,
  LogAbacDeniedInput,
  LogSuperAdminBypassInput,
} from '../dto/rbac-audit.dto';

const TENANT_BENNANI = '11111111-1111-1111-1111-111111111111';
const USER_BROKER = '22222222-2222-2222-2222-222222222222';
const USER_SUPER_ADMIN = '33333333-3333-3333-3333-333333333333';

export function makeRequestContext(overrides: Partial<{
  ip_address: string | null;
  user_agent: string | null;
  request_id: string;
  timestamp: string;
}> = {}) {
  return {
    ip_address: '192.168.1.10',
    user_agent: 'Mozilla/5.0 (X11; Linux x86_64) test-agent',
    request_id: randomUUID(),
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

export function makeGrantedInput(
  overrides: Partial<LogAccessGrantedInput> = {},
): LogAccessGrantedInput {
  return {
    userId: USER_BROKER,
    tenantId: TENANT_BENNANI,
    role: 'broker_admin',
    permission: 'crm.contacts.read',
    resource: { type: 'crm_contact', id: randomUUID() },
    endpoint: '/api/v1/crm/contacts',
    requestContext: makeRequestContext(),
    ...overrides,
  };
}

export function makeDeniedInput(
  overrides: Partial<LogAccessDeniedInput> = {},
): LogAccessDeniedInput {
  return {
    userId: USER_BROKER,
    tenantId: TENANT_BENNANI,
    role: 'broker_assistant',
    permissions: ['insure.policies.create'],
    endpoint: '/api/v1/insure/policies',
    reason: 'MISSING_PERMISSION',
    requestContext: makeRequestContext(),
    ...overrides,
  };
}

export function makeAbacDeniedInput(
  overrides: Partial<LogAbacDeniedInput> = {},
): LogAbacDeniedInput {
  return {
    userId: USER_BROKER,
    tenantId: TENANT_BENNANI,
    role: 'assure',
    permission: 'insure.policies.read_own',
    policy: 'OwnResourcesPolicy',
    reason: 'NOT_OWNER',
    resource: { type: 'insure_policy', id: randomUUID() },
    endpoint: '/api/v1/assure/policies/abc',
    requestContext: makeRequestContext(),
    ...overrides,
  };
}

export function makeSuperAdminBypassInput(
  overrides: Partial<LogSuperAdminBypassInput> = {},
): LogSuperAdminBypassInput {
  return {
    userId: USER_SUPER_ADMIN,
    tenantId: TENANT_BENNANI,
    role: 'super_admin_platform',
    permission: 'admin.tenants.suspend',
    endpoint: '/api/v1/admin/tenants/abc/suspend',
    requestContext: makeRequestContext(),
    ...overrides,
  };
}

export const FIXTURE_IDS = {
  TENANT_BENNANI,
  USER_BROKER,
  USER_SUPER_ADMIN,
};
```

### 6.12 Fichier `rbac-audit.service.spec.ts` (~250 lignes, 25+ tests)

```typescript
// repo/apps/api/src/modules/auth/services/rbac-audit.service.spec.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { RbacAuditService } from './rbac-audit.service';
import { RbacAuditSampling } from './rbac-audit-sampling';
import { RbacAuditRepository } from '../repositories/rbac-audit.repository';
import { RbacAuditKafkaProducer } from './rbac-audit-kafka-producer';
import {
  makeGrantedInput,
  makeDeniedInput,
  makeAbacDeniedInput,
  makeSuperAdminBypassInput,
} from '../__fixtures__/rbac-audit-fixtures';

const mockRepository = {
  insertRow: vi.fn(async () => undefined),
  findByTenant: vi.fn(),
} as unknown as RbacAuditRepository;

const mockKafkaProducer = {
  send: vi.fn(async () => undefined),
  isConnected: vi.fn(() => true),
} as unknown as RbacAuditKafkaProducer;

function buildSampling(rate: number, logGranted: boolean): RbacAuditSampling {
  const config = {
    get: vi.fn((key: string, def?: unknown) => {
      if (key === 'RBAC_AUDIT_SAMPLING_RATE') return rate;
      if (key === 'LOG_RBAC_GRANTED') return logGranted;
      return def;
    }),
  } as unknown as ConfigService;
  return new RbacAuditSampling(config);
}

describe('RbacAuditService', () => {
  let service: RbacAuditService;
  let sampling: RbacAuditSampling;

  beforeEach(() => {
    vi.clearAllMocks();
    sampling = buildSampling(1.0, true); // log everything by default
    service = new RbacAuditService(mockRepository, mockKafkaProducer, sampling);
  });

  // -- logAccessGranted --
  describe('logAccessGranted', () => {
    it('V1 inserts audit_log row when LOG_RBAC_GRANTED=true and sampled', async () => {
      service.logAccessGranted(makeGrantedInput());
      await new Promise((r) => setTimeout(r, 5));
      expect(mockRepository.insertRow).toHaveBeenCalledTimes(1);
    });

    it('V2 emits Kafka event access_granted', async () => {
      service.logAccessGranted(makeGrantedInput());
      await new Promise((r) => setTimeout(r, 5));
      expect(mockKafkaProducer.send).toHaveBeenCalledTimes(1);
      const args = (mockKafkaProducer.send as any).mock.calls[0][0];
      expect(args.topic).toBe('insurtech.events.audit.access_granted');
      expect(args.event.eventType).toBe('access_granted');
    });

    it('V3 skips persistence when LOG_RBAC_GRANTED=false and not privileged', async () => {
      sampling = buildSampling(0.0, false);
      service = new RbacAuditService(mockRepository, mockKafkaProducer, sampling);
      service.logAccessGranted(makeGrantedInput());
      await new Promise((r) => setTimeout(r, 5));
      expect(mockRepository.insertRow).not.toHaveBeenCalled();
    });

    it('V4 always persists for super_admin_platform regardless of sampling', async () => {
      sampling = buildSampling(0.0, false);
      service = new RbacAuditService(mockRepository, mockKafkaProducer, sampling);
      service.logAccessGranted(
        makeGrantedInput({ role: 'super_admin_platform', permission: 'admin.tenants.suspend' }),
      );
      await new Promise((r) => setTimeout(r, 5));
      expect(mockRepository.insertRow).toHaveBeenCalledTimes(1);
    });

    it('V5 always persists for sensitive permission patterns (compliance.*)', async () => {
      sampling = buildSampling(0.0, false);
      service = new RbacAuditService(mockRepository, mockKafkaProducer, sampling);
      service.logAccessGranted(
        makeGrantedInput({ permission: 'compliance.acaps_reports.generate' }),
      );
      await new Promise((r) => setTimeout(r, 5));
      expect(mockRepository.insertRow).toHaveBeenCalledTimes(1);
    });

    it('V6 sampling 10% statistically yields ~10% over 1000 calls', async () => {
      sampling = buildSampling(0.1, true);
      service = new RbacAuditService(mockRepository, mockKafkaProducer, sampling);
      for (let i = 0; i < 1000; i++) {
        service.logAccessGranted(makeGrantedInput());
      }
      await new Promise((r) => setTimeout(r, 50));
      const calls = (mockRepository.insertRow as any).mock.calls.length;
      expect(calls).toBeGreaterThan(50);
      expect(calls).toBeLessThan(200);
    });

    it('V7 fire-and-forget swallows DB errors without throwing', async () => {
      (mockRepository.insertRow as any).mockRejectedValueOnce(new Error('DB down'));
      expect(() => service.logAccessGranted(makeGrantedInput())).not.toThrow();
      await new Promise((r) => setTimeout(r, 10));
    });

    it('V8 invalid input throws Zod error synchronously', () => {
      expect(() =>
        service.logAccessGranted({ ...makeGrantedInput(), userId: 'not-a-uuid' as any }),
      ).toThrow();
    });
  });

  // -- logAccessDenied --
  describe('logAccessDenied', () => {
    it('V9 SYNC awaits INSERT before resolving', async () => {
      await service.logAccessDenied(makeDeniedInput());
      expect(mockRepository.insertRow).toHaveBeenCalledTimes(1);
    });

    it('V10 emits Kafka event access_denied async', async () => {
      await service.logAccessDenied(makeDeniedInput());
      await new Promise((r) => setTimeout(r, 5));
      expect(mockKafkaProducer.send).toHaveBeenCalledTimes(1);
      const args = (mockKafkaProducer.send as any).mock.calls[0][0];
      expect(args.topic).toBe('insurtech.events.audit.access_denied');
    });

    it('V11 partition key is tenantId', async () => {
      await service.logAccessDenied(makeDeniedInput());
      const args = (mockKafkaProducer.send as any).mock.calls[0][0];
      expect(args.partitionKey).toBe(args.event.tenantId);
    });

    it('V12 idempotency key matches auditLogId', async () => {
      await service.logAccessDenied(makeDeniedInput());
      const args = (mockKafkaProducer.send as any).mock.calls[0][0];
      expect(args.auditLogId).toBe(args.event.auditLogId);
    });

    it('V13 always persists denied even if sampling rate=0', async () => {
      sampling = buildSampling(0.0, false);
      service = new RbacAuditService(mockRepository, mockKafkaProducer, sampling);
      await service.logAccessDenied(makeDeniedInput());
      expect(mockRepository.insertRow).toHaveBeenCalledTimes(1);
    });

    it('V14 throws if INSERT fails (sync compliance)', async () => {
      (mockRepository.insertRow as any).mockRejectedValueOnce(new Error('DB down'));
      await expect(service.logAccessDenied(makeDeniedInput())).rejects.toThrow('DB down');
    });

    it('V15 Kafka emit failure does NOT block resolution', async () => {
      (mockKafkaProducer.send as any).mockRejectedValueOnce(new Error('Kafka down'));
      await expect(service.logAccessDenied(makeDeniedInput())).resolves.toBeUndefined();
    });

    it('V16 sanitizes endpoint query string', async () => {
      await service.logAccessDenied(
        makeDeniedInput({ endpoint: '/api/v1/contacts?email=x@y.com&token=secret' }),
      );
      const row = (mockRepository.insertRow as any).mock.calls[0][0];
      expect(row.endpoint).toBe('/api/v1/contacts');
    });
  });

  // -- logAbacDenied --
  describe('logAbacDenied', () => {
    it('V17 inserts row with policy + reason', async () => {
      await service.logAbacDenied(makeAbacDeniedInput());
      const row = (mockRepository.insertRow as any).mock.calls[0][0];
      expect(row.policy).toBe('OwnResourcesPolicy');
      expect(row.reason).toBe('NOT_OWNER');
      expect(row.action).toBe('auth.abac_denied');
    });

    it('V18 emits Kafka event abac_denied with resource', async () => {
      await service.logAbacDenied(makeAbacDeniedInput());
      const args = (mockKafkaProducer.send as any).mock.calls[0][0];
      expect(args.topic).toBe('insurtech.events.audit.abac_denied');
      expect(args.event.resource.type).toBe('insure_policy');
    });

    it('V19 propagates resource_id correctly', async () => {
      const input = makeAbacDeniedInput();
      await service.logAbacDenied(input);
      const row = (mockRepository.insertRow as any).mock.calls[0][0];
      expect(row.resourceId).toBe(input.resource.id);
    });

    it('V20 truncates oversized user_agent', async () => {
      await service.logAbacDenied(
        makeAbacDeniedInput({
          requestContext: {
            ip_address: '1.2.3.4',
            user_agent: 'A'.repeat(5000),
            request_id: 'req-1',
            timestamp: new Date().toISOString(),
          },
        }),
      );
      const row = (mockRepository.insertRow as any).mock.calls[0][0];
      expect(row.requestContext.user_agent.length).toBeLessThanOrEqual(2048);
      expect(row.requestContext.user_agent).toContain('[TRUNCATED:');
    });
  });

  // -- logSuperAdminBypass --
  describe('logSuperAdminBypass', () => {
    it('V21 inserts row with action=auth.bypass and outcome=bypass', async () => {
      await service.logSuperAdminBypass(makeSuperAdminBypassInput());
      const row = (mockRepository.insertRow as any).mock.calls[0][0];
      expect(row.action).toBe('auth.bypass');
      expect(row.outcome).toBe('bypass');
      expect(row.reason).toBe('SUPER_ADMIN_BYPASS');
    });

    it('V22 always logged ignoring sampling', async () => {
      sampling = buildSampling(0.0, false);
      service = new RbacAuditService(mockRepository, mockKafkaProducer, sampling);
      await service.logSuperAdminBypass(makeSuperAdminBypassInput());
      expect(mockRepository.insertRow).toHaveBeenCalledTimes(1);
    });
  });

  // -- Edge cases --
  describe('edge cases', () => {
    it('V23 invalid sampling rate throws at module init', () => {
      expect(() => buildSampling(1.5, true)).toThrow('Invalid RBAC_AUDIT_SAMPLING_RATE');
      expect(() => buildSampling(-0.1, true)).toThrow('Invalid RBAC_AUDIT_SAMPLING_RATE');
    });

    it('V24 nullable userId accepted in denied (anonymous)', async () => {
      await service.logAccessDenied(makeDeniedInput({ userId: null }));
      const row = (mockRepository.insertRow as any).mock.calls[0][0];
      expect(row.actorUserId).toBeNull();
    });

    it('V25 multiple permissions persisted as TEXT[] array', async () => {
      await service.logAccessDenied(
        makeDeniedInput({ permissions: ['insure.policies.create', 'insure.policies.read'] }),
      );
      const row = (mockRepository.insertRow as any).mock.calls[0][0];
      expect(row.permissions).toEqual([
        'insure.policies.create',
        'insure.policies.read',
      ]);
    });

    it('V26 generates unique auditLogId per call', async () => {
      await service.logAccessDenied(makeDeniedInput());
      await service.logAccessDenied(makeDeniedInput());
      const id1 = (mockRepository.insertRow as any).mock.calls[0][0].id;
      const id2 = (mockRepository.insertRow as any).mock.calls[1][0].id;
      expect(id1).not.toBe(id2);
    });

    it('V27 schemaVersion is v1 in all events', async () => {
      await service.logAccessDenied(makeDeniedInput());
      await service.logAbacDenied(makeAbacDeniedInput());
      const events = (mockKafkaProducer.send as any).mock.calls.map((c: any) => c[0].event);
      events.forEach((e: any) => expect(e.schemaVersion).toBe('v1'));
    });
  });
});
```

### 6.13 Fichier `rbac-audit-kafka-producer.spec.ts` (~120 lignes)

```typescript
// repo/apps/api/src/modules/auth/services/rbac-audit-kafka-producer.spec.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { RbacAuditKafkaProducer } from './rbac-audit-kafka-producer';
import { KAFKA_AUDIT_TOPICS } from '../events/rbac-audit.events';

const sendMock = vi.fn();
const connectMock = vi.fn();
const disconnectMock = vi.fn();

vi.mock('kafkajs', () => ({
  Kafka: vi.fn(() => ({
    producer: () => ({
      send: sendMock,
      connect: connectMock,
      disconnect: disconnectMock,
    }),
  })),
  CompressionTypes: { GZIP: 1 },
}));

function buildConfig(): ConfigService {
  return {
    get: vi.fn((k: string, def?: unknown) => {
      if (k === 'KAFKA_AUDIT_RETRY_MAX') return 3;
      return def;
    }),
    getOrThrow: vi.fn((k: string) => {
      if (k === 'KAFKA_BROKERS') return 'localhost:9092';
      throw new Error(`missing: ${k}`);
    }),
  } as unknown as ConfigService;
}

describe('RbacAuditKafkaProducer', () => {
  let producer: RbacAuditKafkaProducer;

  beforeEach(async () => {
    vi.clearAllMocks();
    sendMock.mockResolvedValue(undefined);
    connectMock.mockResolvedValue(undefined);
    disconnectMock.mockResolvedValue(undefined);
    producer = new RbacAuditKafkaProducer(buildConfig());
    await producer.onModuleInit();
  });

  it('K1 connects on module init', () => {
    expect(connectMock).toHaveBeenCalledTimes(1);
    expect(producer.isConnected()).toBe(true);
  });

  it('K2 sends event with correct topic + key + headers', async () => {
    await producer.send({
      topic: KAFKA_AUDIT_TOPICS.ACCESS_DENIED,
      partitionKey: 'tenant-1',
      auditLogId: 'audit-1',
      event: { schemaVersion: 'v1' } as any,
    });
    expect(sendMock).toHaveBeenCalledTimes(1);
    const call = sendMock.mock.calls[0][0];
    expect(call.topic).toBe('insurtech.events.audit.access_denied');
    expect(call.messages[0].key).toBe('tenant-1');
    expect(call.messages[0].headers['Idempotency-Key']).toBe('audit-1');
    expect(call.messages[0].headers['Schema-Version']).toBe('v1');
  });

  it('K3 falls back to DLQ on send failure', async () => {
    sendMock
      .mockRejectedValueOnce(new Error('broker down'))
      .mockResolvedValueOnce(undefined);
    await producer.send({
      topic: KAFKA_AUDIT_TOPICS.ACCESS_DENIED,
      partitionKey: 't1',
      auditLogId: 'a1',
      event: { schemaVersion: 'v1' } as any,
    });
    expect(sendMock).toHaveBeenCalledTimes(2);
    expect(sendMock.mock.calls[1][0].topic).toBe(KAFKA_AUDIT_TOPICS.DLQ);
  });

  it('K4 does not throw when DLQ also fails', async () => {
    sendMock.mockRejectedValue(new Error('all down'));
    await expect(
      producer.send({
        topic: KAFKA_AUDIT_TOPICS.ACCESS_DENIED,
        partitionKey: 't1',
        auditLogId: 'a1',
        event: { schemaVersion: 'v1' } as any,
      }),
    ).resolves.toBeUndefined();
  });

  it('K5 disconnects gracefully on module destroy', async () => {
    await producer.onModuleDestroy();
    expect(disconnectMock).toHaveBeenCalledTimes(1);
  });

  it('K6 send is no-op if not connected', async () => {
    const newProd = new RbacAuditKafkaProducer(buildConfig());
    // Skip onModuleInit
    await newProd.send({
      topic: KAFKA_AUDIT_TOPICS.ACCESS_DENIED,
      partitionKey: 't1',
      auditLogId: 'a1',
      event: { schemaVersion: 'v1' } as any,
    });
    expect(sendMock).not.toHaveBeenCalled();
  });
});
```

### 6.14 Fichier `rbac-audit-sampling.spec.ts` (~80 lignes)

```typescript
// repo/apps/api/src/modules/auth/services/rbac-audit-sampling.spec.ts
import { describe, it, expect, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import {
  RbacAuditSampling,
  PRIVILEGED_ROLES,
  SENSITIVE_PERMISSION_PATTERNS,
} from './rbac-audit-sampling';

function build(rate: number, logGranted: boolean): RbacAuditSampling {
  const cfg = {
    get: vi.fn((k: string, d?: unknown) => {
      if (k === 'RBAC_AUDIT_SAMPLING_RATE') return rate;
      if (k === 'LOG_RBAC_GRANTED') return logGranted;
      return d;
    }),
  } as unknown as ConfigService;
  return new RbacAuditSampling(cfg);
}

describe('RbacAuditSampling', () => {
  it('S1 throws on invalid sampling rate > 1', () => {
    expect(() => build(1.5, true)).toThrow();
  });

  it('S2 throws on negative sampling rate', () => {
    expect(() => build(-0.5, true)).toThrow();
  });

  it('S3 always returns true for super_admin_platform', () => {
    const s = build(0.0, false);
    expect(s.shouldLogGranted('super_admin_platform' as any, 'crm.contacts.read')).toBe(true);
  });

  it('S4 always returns true for analyst_support', () => {
    const s = build(0.0, false);
    expect(s.shouldLogGranted('analyst_support' as any, 'crm.contacts.read')).toBe(true);
  });

  it('S5 always returns true for compliance.* permissions', () => {
    const s = build(0.0, false);
    expect(s.shouldLogGranted('broker_admin' as any, 'compliance.acaps_reports.generate')).toBe(true);
  });

  it('S6 always returns true for admin.* permissions', () => {
    const s = build(0.0, false);
    expect(s.shouldLogGranted('broker_admin' as any, 'admin.tenants.suspend')).toBe(true);
  });

  it('S7 returns false when LOG_RBAC_GRANTED=false and not privileged', () => {
    const s = build(1.0, false);
    expect(s.shouldLogGranted('broker_user' as any, 'crm.contacts.read')).toBe(false);
  });

  it('S8 sampling 100% returns true always when log enabled', () => {
    const s = build(1.0, true);
    for (let i = 0; i < 100; i++) {
      expect(s.shouldLogGranted('broker_user' as any, 'crm.contacts.read')).toBe(true);
    }
  });

  it('S9 sampling 0% returns false always when log enabled (no privileged)', () => {
    const s = build(0.0, true);
    expect(s.shouldLogGranted('broker_user' as any, 'crm.contacts.read')).toBe(false);
  });

  it('S10 shouldLogDenied always returns true', () => {
    const s = build(0.0, false);
    expect(s.shouldLogDenied()).toBe(true);
  });

  it('S11 PRIVILEGED_ROLES exposes both expected roles', () => {
    expect(PRIVILEGED_ROLES).toContain('super_admin_platform');
    expect(PRIVILEGED_ROLES).toContain('analyst_support');
  });

  it('S12 SENSITIVE_PERMISSION_PATTERNS covers required prefixes', () => {
    const required = ['admin.', 'compliance.', 'cndp.', 'acaps.', 'aml.', 'cross_tenant.'];
    required.forEach((prefix) => {
      const matched = SENSITIVE_PERMISSION_PATTERNS.some((re) =>
        re.test(`${prefix}foo.bar`),
      );
      expect(matched).toBe(true);
    });
  });
});
```

### 6.15 Fichier `index.ts` (barrel exports, addition)

```typescript
// repo/apps/api/src/modules/auth/index.ts (additions)
export { RbacAuditModule } from './rbac-audit.module';
export { RbacAuditService } from './services/rbac-audit.service';
export { RbacAuditSampling } from './services/rbac-audit-sampling';
export { RbacAuditRepository } from './repositories/rbac-audit.repository';
export { RbacAuditKafkaProducer } from './services/rbac-audit-kafka-producer';
export { RbacAuditHealthIndicator } from './health/rbac-audit-health.indicator';
export { RbacAuditLogEntity } from './entities/rbac-audit.entity';
export type {
  AuditAction,
  AuditOutcome,
  AuditRequestContext,
} from './entities/rbac-audit.entity';
export type {
  LogAccessGrantedInput,
  LogAccessDeniedInput,
  LogAbacDeniedInput,
  LogSuperAdminBypassInput,
} from './dto/rbac-audit.dto';
export {
  KAFKA_AUDIT_TOPICS,
  type AccessGrantedEvent,
  type AccessDeniedEvent,
  type AbacDeniedEvent,
  type AnyAuditEvent,
} from './events/rbac-audit.events';
```

---

## 7. Tests complets (recap 25+ scenarios)

| ID | Fichier | Scenario | Type |
|----|---------|----------|------|
| V1 | rbac-audit.service.spec.ts | logAccessGranted INSERT row | Unit |
| V2 | rbac-audit.service.spec.ts | Kafka event access_granted | Unit |
| V3 | rbac-audit.service.spec.ts | Skip si LOG_RBAC_GRANTED=false | Unit |
| V4 | rbac-audit.service.spec.ts | Always logged super_admin | Unit |
| V5 | rbac-audit.service.spec.ts | Always logged compliance.* | Unit |
| V6 | rbac-audit.service.spec.ts | Sampling 10% statistique | Unit prob |
| V7 | rbac-audit.service.spec.ts | Async swallow error granted | Unit |
| V8 | rbac-audit.service.spec.ts | Zod validation throw | Unit |
| V9 | rbac-audit.service.spec.ts | logAccessDenied SYNC await | Unit |
| V10 | rbac-audit.service.spec.ts | Kafka event access_denied | Unit |
| V11 | rbac-audit.service.spec.ts | Partition key tenantId | Unit |
| V12 | rbac-audit.service.spec.ts | Idempotency-Key match auditLogId | Unit |
| V13 | rbac-audit.service.spec.ts | Denied always logged | Unit |
| V14 | rbac-audit.service.spec.ts | Throws if INSERT fails sync | Unit |
| V15 | rbac-audit.service.spec.ts | Kafka emit fail no block | Unit |
| V16 | rbac-audit.service.spec.ts | Sanitize endpoint query | Unit |
| V17 | rbac-audit.service.spec.ts | logAbacDenied policy + reason | Unit |
| V18 | rbac-audit.service.spec.ts | Kafka abac_denied resource | Unit |
| V19 | rbac-audit.service.spec.ts | resource_id propagated | Unit |
| V20 | rbac-audit.service.spec.ts | Truncate user_agent | Unit |
| V21 | rbac-audit.service.spec.ts | logSuperAdminBypass action=bypass | Unit |
| V22 | rbac-audit.service.spec.ts | Bypass always logged | Unit |
| V23 | rbac-audit.service.spec.ts | Sampling rate validation throw | Unit |
| V24 | rbac-audit.service.spec.ts | Nullable userId denied | Unit |
| V25 | rbac-audit.service.spec.ts | Multiple permissions array | Unit |
| V26 | rbac-audit.service.spec.ts | Unique auditLogId per call | Unit |
| V27 | rbac-audit.service.spec.ts | schemaVersion v1 events | Unit |
| K1-K6 | rbac-audit-kafka-producer.spec.ts | Producer connect/send/DLQ | Unit |
| S1-S12 | rbac-audit-sampling.spec.ts | Sampling logic | Unit |

Au total : **45+ tests** (27 service + 6 producer + 12 sampling).

Run :

```bash
pnpm --filter @insurtech/api test --filter "rbac-audit"
pnpm --filter @insurtech/api test:cov --filter "rbac-audit"
# coverage > 95% requis sur les fichiers livres
```

---

## 8. Variables environnement

Ajouter dans `repo/apps/api/.env.example` :

```env
# === RBAC Audit ===
# Si true, persist tous les grants RBAC (forte volumetrie). Defaut prod : false.
LOG_RBAC_GRANTED=false

# Sampling rate des grants logges (0.0 a 1.0). Bypass pour super_admin + sensitive.
RBAC_AUDIT_SAMPLING_RATE=0.1

# Kafka topic prefix (resolved en .access_granted / .access_denied / .abac_denied / .dlq)
KAFKA_AUDIT_TOPIC_PREFIX=insurtech.events.audit

# Nombre de retries kafkajs pour publier les events audit
KAFKA_AUDIT_RETRY_MAX=3

# Retention CNDP loi 09-08 article 18 : 7 ans = 2555 jours
AUDIT_LOG_RETENTION_DAYS=2555

# Pool connections Postgres dedie pour audit (separe du pool app)
AUDIT_LOG_DB_POOL_SIZE=20
```

Validation Zod dans `repo/apps/api/src/config/env.schema.ts` :

```typescript
LOG_RBAC_GRANTED: z.coerce.boolean().default(false),
RBAC_AUDIT_SAMPLING_RATE: z.coerce.number().min(0).max(1).default(0.1),
KAFKA_AUDIT_TOPIC_PREFIX: z.string().default('insurtech.events.audit'),
KAFKA_AUDIT_RETRY_MAX: z.coerce.number().int().min(0).max(10).default(3),
AUDIT_LOG_RETENTION_DAYS: z.coerce.number().int().min(1).default(2555),
AUDIT_LOG_DB_POOL_SIZE: z.coerce.number().int().min(1).max(100).default(20),
```

---

## 9. Commandes shell

```bash
# Installation deps (si pas deja fait par taches anterieures)
cd repo/apps/api
pnpm add kafkajs@2.2.4 prom-client@15
pnpm add -D @types/node

# Generer la migration TypeORM
pnpm typeorm:migration:generate src/migrations/CreateRbacAuditLogTable

# Apply migration
pnpm typeorm:migration:run

# Provisionner les Kafka topics
pnpm kafka:provision insurtech.events.audit.access_granted --partitions 12 --retention-ms 63072000000
pnpm kafka:provision insurtech.events.audit.access_denied --partitions 12 --retention-ms 220752000000
pnpm kafka:provision insurtech.events.audit.abac_denied --partitions 12 --retention-ms 220752000000
pnpm kafka:provision insurtech.events.audit.dlq --partitions 3 --retention-ms 2592000000

# Tests unitaires + coverage
pnpm test --filter "rbac-audit"
pnpm test:cov --filter "rbac-audit"

# Tests integration (DB + Kafka reels via testcontainers)
pnpm test:integration --filter "rbac-audit"

# Load test (verifie throughput INSERT)
pnpm tsx scripts/load-test-audit.ts --rate 1000 --duration 60

# Lint
pnpm lint --filter @insurtech/api
pnpm typecheck --filter @insurtech/api

# Verification audit_log table
psql -h localhost -U postgres -d insurtech -c "\d+ audit_log"
psql -h localhost -U postgres -d insurtech -c "SELECT COUNT(*), outcome FROM audit_log GROUP BY outcome;"

# Consume Kafka topic verification
docker exec -it redpanda-1 rpk topic consume insurtech.events.audit.access_denied --num 5

# Health check
curl http://localhost:3000/health/rbac_audit
```

---

## 10. Criteres validation V1-V30 (verifiables)

| ID | Critere | Commande verification | Cible |
|----|---------|------------------------|-------|
| V1 | logAccessGranted INSERT audit_log row | `pnpm test V1 && psql -c "SELECT 1 FROM audit_log WHERE action='auth.access_granted' LIMIT 1"` | Pass + 1 row |
| V2 | logAccessDenied INSERT + Kafka event | `pnpm test V2 V10` | Pass |
| V3 | Granted logging configurable env | Set `LOG_RBAC_GRANTED=false`, run 100 grants, verify 0 row in audit_log | 0 rows non-privileged |
| V4 | Denied toujours logged | Set sampling=0.0, run 10 denials, verify 10 rows | 10 rows |
| V5 | Tests 6+ scenarios passent | `pnpm test --filter "rbac-audit"` | 45+ tests pass |
| V6 | Sampling 10% statistique | `pnpm test V6` | 50 < calls < 200 |
| V7 | Super admin bypass sampling | `pnpm test V4 V21 V22` | All pass |
| V8 | Sensitive perms bypass sampling | `pnpm test V5` | Pass |
| V9 | INSERT performance < 5ms p99 | `pnpm tsx scripts/load-test-audit.ts --rate 200` puis check Postgres `pg_stat_statements` | p99 < 5ms |
| V10 | Kafka event delivered with idempotency key | `rpk topic consume insurtech.events.audit.access_denied -n 1` -> headers contain Idempotency-Key | Header present |
| V11 | Audit_log RLS isolation tenant | Connect tenant A, INSERT row tenant B -> rejected | RLS reject |
| V12 | Partition key = tenant_id | `pnpm test V11` | Pass |
| V13 | Schema event v1 versioned | `pnpm test V27` | Pass |
| V14 | Endpoint sanitization strip query | `pnpm test V16` | Pass |
| V15 | User-agent truncation < 2048 | `pnpm test V20` | Pass |
| V16 | Async granted swallow errors | `pnpm test V7` | Pass |
| V17 | Sync denied throws on DB fail | `pnpm test V14` | Pass |
| V18 | Kafka DLQ on send failure | `pnpm test K3` | Pass |
| V19 | Health check endpoint healthy | `curl localhost:3000/health/rbac_audit` -> `{ "status": "ok" }` | Status ok |
| V20 | Migration up + down idempotent | `pnpm typeorm:migration:run && pnpm typeorm:migration:revert` | No error |
| V21 | INSERT performance load test 1k req/s | `pnpm tsx scripts/load-test-audit.ts --rate 1000 --duration 60` | INSERT p99 < 10ms |
| V22 | Coverage > 95% files | `pnpm test:cov --filter rbac-audit` | Coverage >= 95% |
| V23 | Lint pass no errors | `pnpm lint --filter @insurtech/api` | Exit 0 |
| V24 | Typecheck pass strict | `pnpm typecheck --filter @insurtech/api` | Exit 0 |
| V25 | Metrics Prometheus exposees | `curl localhost:9464/metrics \| grep rbac_audit` | Found 6 counters |
| V26 | Kafka topics provisionnes | `rpk topic list \| grep insurtech.events.audit` | 4 topics |
| V27 | Audit row contains request_id correlation | INSERT row, SELECT request_context->>'request_id' | UUID returned |
| V28 | NestJS DI no cycle | `pnpm start --filter api` | Boot without circular DI error |
| V29 | Sampling unit tests S1-S12 pass | `pnpm test --filter rbac-audit-sampling` | 12 pass |
| V30 | E2E denial -> audit_log row -> Kafka consume | E2E test Sprint 7 Tache 2.3.12 | Row + event present |

---

## 11. Edge cases (12+)

1. **Audit log async fire-and-forget vs await coherence** : `logAccessGranted` est void return ; le caller (Guard) ne doit pas await pour ne pas bloquer le critical path. Mitigation : helper `safeAsync` capture errors + Prometheus counter, jamais throw vers caller.

2. **Kafka producer down** : `RbacAuditKafkaProducer.isConnected = false` -> `send` est no-op + counter `rbac_audit_kafka_failures_total{reason="not_connected"}` increment. Persistence Postgres continue. Sprint 22 alert PagerDuty si `not_connected > 1min`.

3. **Audit_log table grows unbounded** : Sprint 33 installe pg_partman + monthly partitioning + DROP partition apres 7 ans. Cette tache delivers la table simple (non-partitioned).

4. **Super_admin actions toujours logged sans sampling** : Test V4 V22 + helper `isPrivilegedRole` exporte. ESLint rule custom `eslint-plugin-skalean/sensitive-perms-coverage`.

5. **Multi-tenant isolation audit_log via RLS** : Migration enable RLS + `tenant_iso` policy USING + `audit_log_insert_tenant_match` policy WITH CHECK. Repository `SET LOCAL app.tenant_id` pre-insert.

6. **Kafka topic partition by tenant_id pour ordering** : `partitionKey = tenantId` dans `kafkaProducer.send`. Sprint 33 SecOps consumer voit ordre chronologique intra-tenant garanti.

7. **Idempotency-Key replay** : Header `Idempotency-Key: {auditLogId}` attache a chaque message. Consumers Sprint 33 + Sprint 34 maintain Redis Set `audit:dedup:{YYYYMMDD}` TTL 48h.

8. **Postgres INSERT > 1k req/s saturation** : Pool dedie 20 connexions (`AUDIT_LOG_DB_POOL_SIZE=20`). Sprint 22 ajoute batching Bull queue si necessaire. `synchronous_commit=local` per-table option Sprint 22.

9. **PII in user_agent truncation** : `truncateUserAgent` helper limit 2048 + marker `[TRUNCATED:N_BYTES]`. Sprint 26 redaction PII patterns supplementaires.

10. **PII in endpoint query string** : `sanitizeEndpoint` strip `?...` + max length 512.

11. **NULL actor_user_id pour anonyme (prospect)** : Schema `actor_user_id UUID NULL` + Zod `.nullable()`. Index partial `WHERE actor_user_id IS NOT NULL` evite bloat.

12. **Boot order : RbacAuditModule loaded BEFORE Guards modules** : `@Global()` decorator garantit dispo partout. AuthModule importe RbacAuditModule explicitement.

13. **Test flaky V6 sampling probabilistic** : Test verifie band 50-200 sur 1000 calls (3 sigma autour 100). Si flaky observed > 1%, augmenter sample size a 10000.

14. **Migration 1715000000000 conflit timestamp** : Verifier qu'aucune autre migration Sprint 7 n'utilise ce timestamp. Bump vers 1715000000001 si conflit.

15. **Memory leak in DLQ in-memory queue** : DLQ implementation actuelle delegate au topic Kafka DLQ (`insurtech.events.audit.dlq`). Pas de in-memory queue dans cette V1. Sprint 22 ajoute LRU Map size 1000 fallback.

---

## 12. Conformite Maroc detaillee

### 12.1 CNDP Loi 09-08

- **Article 18** -- Conservation des donnees : `AUDIT_LOG_RETENTION_DAYS=2555` (7 ans). Sprint 33 partitioning + DROP automatique apres expiration.
- **Article 7** -- Droit acces : Sprint 26 endpoint `GET /api/v1/me/audit-trail` paginate `audit_log WHERE actor_user_id = ?`.
- **Article 4** -- Minimisation : `sanitizeEndpoint` + `truncateUserAgent` + Sprint 26 PII redaction patterns. Sampling 10% reduit volume non-essentiel.
- **Article 6** -- Loyaute : Mise a jour `docs/cndp/registre-traitements.md` declare le traitement audit_log avec finalite (securite + compliance) + base legale (obligation legale ACAPS art 9 + interet legitime art 7).
- **Article 12** -- Securite : Multi-tenant RLS isolation + chiffrement at-rest (Postgres pgcrypto) + chiffrement in-transit (TLS Postgres 13+).

### 12.2 ACAPS Circulaire 2018/01

- **Article 9** -- Audit trail integral des operations d'assurance : Toutes les actions matchant patterns `insure.*`, `pay.*`, `repair.*` toujours loggees (incluses dans SENSITIVE_PERMISSION_PATTERNS via Sprint 14+ ajouts).
- **Maker/Checker** : audit trail capture `actor_user_id` + `actor_role` + `endpoint` + `permissions` + `request_context.timestamp` permettant reconstruction qui-a-fait-quoi-quand.
- **Conservation 10 ans contrats** : Hors-scope audit_log (concerne donnees metier policies, table separee). Audit_log retention 7 ans CNDP suffit pour audit trail.

### 12.3 AMC Loi 12-18 (AML)

- **Article 15** -- Tracabilite actions AML : Permissions `compliance.aml_alerts.*` + `cross_tenant.*` toujours loggees via SENSITIVE_PERMISSION_PATTERNS.
- **Article 18** -- Reporting Bank Al-Maghrib : Sprint 34 generates trimestriel rapport agrege denials AML pattern depuis `audit_log` + `pay_transactions` jointures.

### 12.4 BAM Circulaire 1/G/2007

- **Separation des roles audit / operationnel** : `audit_log_pool` Postgres connection separee. RLS bypass interdit (pas de superuser writes). Sprint 26 admin endpoint `admin.audit.read` permission distincte de `admin.tenants.*`.

### 12.5 ANRT Decret signature electronique

- Out-of-scope direct (Sprint 11 trace `docs.signatures.*` separement). Mais `audit_log` capture les denials de revocation de signature `docs.signatures.revoke_within_24h` ABAC TimeBased.

### 12.6 Loi 17-99 Code des assurances

- **Article 73** -- Conservation contrats 10 ans : Hors-scope audit_log.
- **Article 274** -- Reclamations clients : Endpoint Sprint 26 `GET /api/v1/me/audit-trail` permet a l'assure de consulter son historique d'acces.

### 12.7 RGPD (extra-territorial UE)

Bien que skalean-insurtech soit un produit Maroc, les courtiers tenants peuvent gerer assures europeens (binational, expat). Le pattern audit_log + retention 7 ans est compatible RGPD article 30 (registre traitements) + article 32 (securite).

---

## 13. Conventions absolues skalean-insurtech

- **AUCUNE EMOJI** dans code, tests, comments, logs, errors, documentation.
- **TypeScript strict mode** : `strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitOverride: true`. Pas de `any` (utiliser `unknown` + narrowing). Pas de `@ts-ignore` (utiliser `@ts-expect-error` avec commentaire raison).
- **Zod validation** TOUS les inputs externes (DTOs, env, payloads Kafka). Schemas exporte avec types `z.infer`.
- **Pino structured logging** JSON : `logger.info({ auditLogId, tenantId, userId }, 'message')`. Pas de `console.log`.
- **prom-client metrics** : 1 Counter / Gauge / Histogram par concept business. Naming `<domain>_<entity>_<action>_<unit>` snake_case (e.g. `rbac_audit_inserts_total`).
- **NestJS @Injectable() singleton** par defaut. Dependency injection via constructor. `@Global()` modules signales ADR.
- **Error handling** : Custom errors avec code (`AUDIT_INSERT_FAILED`, `KAFKA_BROKER_DOWN`). Pas de `throw new Error('string')` direct dans services -- utilise typed exceptions NestJS.
- **Async/await** uniquement, pas de `.then()` chains. Promises top-level wrappees `void this.foo().catch(err => ...)`.
- **Tests Vitest 2.1.8** : `describe / it / expect` + `vi` mocks. Fixtures factory pattern. Coverage > 95% sur fichiers livres.
- **Imports explicites** : `import { foo } from 'package'` -- pas de `import *`. Type imports `import type { Foo }`.
- **No emojis** in commit messages, branch names, PR descriptions, ADR titles.
- **i18n** : Erreurs user-facing en FR-MA / AR-MA / FR-FR / EN, mais audit_log `reason` en code SCREAMING_SNAKE_CASE technique (ex: `MISSING_PERMISSION`, `NOT_OWNER`, `WORKFLOW_TRANSITION_INVALID`).
- **Nommage** : `RbacAuditService` PascalCase classe. `logAccessGranted` camelCase method. `AUDIT_LOG_RETENTION_DAYS` SCREAMING env. `audit_log` snake_case table SQL. `rbac-audit.service.ts` kebab-case fichier.
- **File header** : Tous fichiers TS commencent par chemin `// repo/apps/api/src/...` + JSDoc bloc decrivant rôle.
- **Multi-tenant** : Toujours filtrer / verifier `tenant_id`. Jamais query Postgres sans contexte tenant (sauf super admin avec audit complet).
- **Conformite ACAPS / CNDP** : Documente dans le code via `// Compliance: CNDP loi 09-08 art 18` au-dessus des champs / methodes concernes.

---

## 14. Validation pre-commit

```bash
# 1. Lint zero error
pnpm lint --filter @insurtech/api
# Exit code 0 attendu

# 2. Typecheck strict
pnpm typecheck --filter @insurtech/api
# Exit code 0 attendu

# 3. Tests unitaires
pnpm test --filter "rbac-audit"
# 45+ tests pass

# 4. Coverage
pnpm test:cov --filter "rbac-audit"
# Coverage statements/branches/functions/lines > 95%

# 5. Migration up + down
pnpm typeorm:migration:run
pnpm typeorm:migration:revert
pnpm typeorm:migration:run

# 6. Boot integration (Postgres + Kafka up)
docker-compose up -d postgres redpanda
pnpm start --filter api
# Verifier logs : "Kafka audit producer connected" + "Nest application successfully started"
curl http://localhost:3000/health/rbac_audit
# {"status":"ok","info":{"rbac_audit":{"status":"up","database":"up","kafka":"up"}}}

# 7. Verification metrics Prometheus
curl http://localhost:9464/metrics | grep "^rbac_audit"
# Presence : rbac_audit_inserts_total, rbac_audit_kafka_events_total, rbac_audit_kafka_failures_total,
#            rbac_audit_granted_sampled_out_total, rbac_audit_db_failures_total, rbac_audit_async_failures_total

# 8. Verification CNDP registre
grep "audit_log" docs/cndp/registre-traitements.md
# Section presente

# 9. ADR present
test -f docs/adr/026-rbac-audit-centralized-service.md
# Exit 0

# 10. .env.example a jour
grep "LOG_RBAC_GRANTED" .env.example
grep "RBAC_AUDIT_SAMPLING_RATE" .env.example
grep "AUDIT_LOG_RETENTION_DAYS" .env.example
# Tous presents
```

---

## 15. Commit message

```
feat(auth): RbacAuditService log RBAC + ABAC granted/denied (Sprint 7 / Tache 2.3.9)

Centralized audit service persisting all RBAC + ABAC authorization
decisions in Postgres audit_log table + emitting Kafka events for
downstream alerting (Sprint 33) and ACAPS quarterly reporting (Sprint 34).

Methods :
- logAccessGranted({userId, tenantId, role, permission, resource, endpoint})
  Async fire-and-forget INSERT + Kafka emit. Subject to sampling
  (RBAC_AUDIT_SAMPLING_RATE=0.1 default). Bypass for super_admin_platform,
  analyst_support, and sensitive permission patterns (admin.*, compliance.*,
  cndp.*, acaps.*, aml.*, cross_tenant.*).
- logAccessDenied({userId, tenantId, role, permissions, endpoint, reason})
  SYNC await INSERT + async Kafka emit. Always persisted regardless of
  sampling (compliance ACAPS art 9, CNDP loi 09-08 art 18).
- logAbacDenied({permission, policy, reason, userId, resource})
  SYNC await INSERT + async Kafka emit with policy + resource context.
- logSuperAdminBypass({...}) Always persisted (compliance privileged access).

Postgres audit_log table :
- 14 columns : id, tenant_id, actor_user_id, actor_role, action,
  resource_type, resource_id, endpoint, outcome, policy, reason,
  permissions[], request_context jsonb, created_at.
- 4 composite indexes : (tenant_id,created_at), (actor_user_id,created_at),
  (action,created_at), (resource_type,resource_id).
- RLS multi-tenant isolation : audit_log_tenant_isolation policy USING
  app_can_access_tenant + audit_log_insert_tenant_match WITH CHECK.
- CHECK constraints on action and outcome enums.
- Sprint 33 will add pg_partman monthly partitioning.

Kafka topics :
- insurtech.events.audit.access_granted (12 partitions, retention 2y)
- insurtech.events.audit.access_denied (12 partitions, retention 7y)
- insurtech.events.audit.abac_denied (12 partitions, retention 7y)
- insurtech.events.audit.dlq (3 partitions, retention 30d)
- Partition key = tenant_id (intra-tenant ordering for SecOps detection).
- Headers : Idempotency-Key (UUID auditLogId) + Schema-Version (v1).
- At-least-once delivery + downstream consumer dedup via Redis Set.

Files :
- repo/apps/api/src/modules/auth/services/rbac-audit.service.ts (~280 LOC)
- repo/apps/api/src/modules/auth/services/rbac-audit-kafka-producer.ts (~150)
- repo/apps/api/src/modules/auth/services/rbac-audit-sampling.ts (~80)
- repo/apps/api/src/modules/auth/repositories/rbac-audit.repository.ts (~120)
- repo/apps/api/src/modules/auth/entities/rbac-audit.entity.ts (~120)
- repo/apps/api/src/modules/auth/dto/rbac-audit.dto.ts (~150)
- repo/apps/api/src/modules/auth/events/rbac-audit.events.ts (~120)
- repo/apps/api/src/modules/auth/health/rbac-audit-health.indicator.ts (~50)
- repo/apps/api/src/modules/auth/rbac-audit.module.ts (~80)
- repo/apps/api/src/migrations/1715000000000-CreateRbacAuditLogTable.ts (~150)
- 3 spec files (45+ tests, coverage > 95%) + fixtures + load-test script.

Env :
- LOG_RBAC_GRANTED=false (prod default).
- RBAC_AUDIT_SAMPLING_RATE=0.1.
- KAFKA_AUDIT_TOPIC_PREFIX=insurtech.events.audit.
- KAFKA_AUDIT_RETRY_MAX=3.
- AUDIT_LOG_RETENTION_DAYS=2555 (7 years CNDP).
- AUDIT_LOG_DB_POOL_SIZE=20.

Compliance :
- CNDP loi 09-08 article 18 (retention 7y) : AUDIT_LOG_RETENTION_DAYS.
- CNDP loi 09-08 article 7 (droit acces) : prepa Sprint 26 self-service.
- ACAPS Circulaire 2018/01 article 9 : audit integral via SENSITIVE_PERMISSION_PATTERNS.
- AMC loi 12-18 article 15 : compliance.aml.* always logged.
- BAM circulaire 1/G/2007 : pool DB dedie + RLS bypass interdit.
- Registre traitements CNDP mis a jour.

ADR : docs/adr/026-rbac-audit-centralized-service.md

Refs : Sprint 7 Tache 2.3.9, depend Tache 2.3.8 AbacGuard.
Bloque : Tache 2.3.10 PermissionCacheService, Tache 2.3.11 admin
introspection, Tache 2.3.12 E2E tests 12 roles, Sprint 33 SecOps
alerting consumer, Sprint 34 ACAPS reporting trimestriel.
```

---

## 16. Workflow next step

Apres validation et merge de cette tache 2.3.9, passer a :

**Tache 2.3.10 -- PermissionCacheService Redis**

- Fichier prompt : `00-pilotage/prompts-taches/sprint-07-rbac/task-2.3.10-permission-cache-service-redis.md`
- Reference meta-prompt : `B-07-sprint-07-rbac.md` lignes 1059-1095
- Effort : 4h
- Priorite : P1
- Depend de : Tache 2.3.9 (cette tache) car les events `auth.role_changed` consommes par le pipeline d'invalidation cache declenchent un appel `RbacAuditService.logAccessGranted` ou `logAccessDenied` preliminaire pour tracer le changement.

But Tache 2.3.10 :
- Cache Redis pour permissions effectives par role + ABAC results.
- `getEffectivePermissions(role: AuthRole): Promise<Set<Permission>>` -- TTL 5min.
- `invalidateRole(role: AuthRole): Promise<void>` -- delete cache entry.
- `invalidateAll(): Promise<void>` -- nuclear option.
- Cache key `rbac:effective:{role}` -> JSON array permissions.
- Cache ABAC results optional `abac:{userId}:{permission}:{resourceType}:{resourceId}` -> result, TTL 1min.
- Listen events `rbac.matrix_updated`, `auth.role_changed` -> invalidate.
- Logs cache hit/miss + Prometheus counters.
- Tests : cache works + invalidation propagates + race condition concurrent invalidation.

Apres 2.3.10 viendra :
- Tache 2.3.11 admin introspection RBAC denials endpoints.
- Tache 2.3.12 E2E tests coverage 12 roles x 85 permissions.

---

## 17. References complementaires

- Meta-prompt sprint : `00-pilotage/meta-prompts/B-07-sprint-07-rbac.md`
- Documentation roles : `00-pilotage/documentation/5-roles-permissions.md`
- Tache precedente : `00-pilotage/prompts-taches/sprint-07-rbac/task-2.3.8-abac-guard-resource-decorator-loader.md`
- Tache suivante : `00-pilotage/prompts-taches/sprint-07-rbac/task-2.3.10-permission-cache-service-redis.md`
- ADR : `docs/adr/026-rbac-audit-centralized-service.md` (livre cette tache)
- Registre CNDP : `docs/cndp/registre-traitements.md` (mis a jour cette tache)

**Fin de la tache 2.3.9**
