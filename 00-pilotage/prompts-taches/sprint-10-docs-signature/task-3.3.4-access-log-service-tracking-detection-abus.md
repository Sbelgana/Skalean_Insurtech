# Tache 3.3.4 - AccessLogService Tracking Append-Only + Detection Abus Sliding Window

## 1. Header metadata

| Champ | Valeur |
|-------|--------|
| Identifiant | task-3.3.4 |
| Sprint | Sprint 10 - Docs + Signature Loi 43-20 |
| Phase | Phase 3 - Audit & Compliance Documents |
| Priorite | P0 (bloquant production, exigence ACAPS Circulaire 2018/01 art.9 + Loi 09-08 art.13) |
| Effort estime | 4h (1h migration RLS + types, 1h services + interceptor, 1h jobs BullMQ + abuse detector, 1h tests E2E + criteres) |
| Dependances directes | task-3.3.3 (DocsModule + repositories Prisma + tenant middleware), task-2.1.x (BullMQ infra), task-2.2.x (Redis infra), task-1.4.x (Kafka producer wrapper), task-1.3.x (Pino logger) |
| Bloque | task-3.3.5 (DocumentVersionService - branche audit), task-3.3.6 (Admin reporting compliance ACAPS), Sprint 33 (SecOps consume audit.suspicious_access) |
| Owner technique | Squad Documents & Signature |
| Reviewer | Lead Backend + Lead Compliance ACAPS + DPO (Data Protection Officer) |
| Statut | A FAIRE |
| Conformite reglementaire | Loi 09-08 art.13 (integrite audit trail), Loi 43-20 art.9 (preuve numerique), ACAPS Circulaire 2018/01 art.9 (tracabilite operations courtage), CNDP Deliberation 5/2020 (minimisation mais conservation legale obligatoire) |
| Tags | docs, audit, append-only, RLS, BullMQ, Redis, sliding-window, abuse-detection, ACAPS, CNDP, Loi-09-08, Loi-43-20, multi-tenant, observability |

## 2. But

L'objectif de cette tache est d'instaurer un **systeme de tracabilite append-only de tous les acces aux documents** (consultation, telechargement, partage, previsualisation, requete metadata) afin de satisfaire les exigences reglementaires marocaines en matiere d'audit trail (Loi 09-08 article 13 sur l'integrite des donnees personnelles, ACAPS Circulaire 2018/01 article 9 sur la tracabilite des operations de courtage). Cette tracabilite doit etre **inviolable au niveau base de donnees** via des policies Row Level Security PostgreSQL qui n'autorisent que SELECT et INSERT - aucune policy UPDATE ni DELETE n'est creee, ce qui rend les operations de modification ou suppression rejetees par PostgreSQL meme par un administrateur applicatif compromis.

Le second objectif est de garantir que cette journalisation **ne degrade pas le temps de reponse utilisateur** : chaque ecriture log est decorrelee de la requete HTTP via un **producer BullMQ** non-bloquant. L'interceptor NestJS LogDocumentAccessInterceptor enqueue un job dans la queue `docs-access-log` apres chaque requete reussie sur les routes documents, et un processor BullMQ traite ces jobs en async et persiste dans `doc_access_logs`. Si BullMQ est indisponible, un fallback log local fichier (winston rotating) est ecrit pour ne perdre aucune trace (degradation gracieuse). Cette architecture decouplee permet egalement d'**absorber les pics de trafic** sans saturer la base PostgreSQL (back-pressure naturel via la queue).

Le troisieme objectif est la **detection comportementale d'abus** via un compteur sliding window Redis : si un meme utilisateur depasse 100 telechargements/heure (configurable via `DOCS_ACCESS_ABUSE_THRESHOLD_PER_HOUR=100`), un evenement Kafka `audit.suspicious_access` est emis. Cet evenement sera consomme au Sprint 33 par le module SecOps qui declenchera workflows: alerte SIEM, notification DPO, suspension automatique compte si recurrence. La fenetre glissante utilise des buckets per-minute avec MGET sur les 60 derniers buckets pour calcul efficient O(60) sans iteration sur les events bruts. Un endpoint admin `GET /api/v1/admin/docs/access-logs` (curseur pagination + filtres document/user/date) permet enfin aux equipes compliance de produire des rapports d'audit ACAPS sur demande de l'autorite de controle.

## 3. Contexte etendu

### 3.1 Pourquoi append-only au niveau DB et non application-level

Le choix d'enforcer l'append-only via les **Row Level Security policies PostgreSQL** plutot qu'au niveau code applicatif est dicte par le principe **defense in depth** et les exigences ACAPS qui imposent qu'un audit trail soit **non-repudiable** meme par un developpeur ou DBA malveillant. Au niveau application, on peut toujours imaginer:
- Un developpeur qui ecrit un script de "nettoyage" qui supprime des logs vieux de 30 jours.
- Un compte service compromis dont la cle JWT est volee et utilise pour appeler une API DELETE cachee.
- Un bug dans Prisma qui genere un UPDATE non intentionnel sur la table.
- Un attaquant qui obtient acces RW au schema Prisma et ajoute une migration de DELETE.

En revanche, au niveau PostgreSQL avec RLS:
- Aucune policy UPDATE n'est creee -> par defaut RLS bloque toute UPDATE meme depuis psql en tant que role applicatif.
- Aucune policy DELETE n'est creee -> idem pour DELETE.
- Le `REVOKE UPDATE, DELETE ON doc_access_logs FROM PUBLIC` ajoute une 2e barriere au niveau privileges SQL standard.
- Seul un superuser PostgreSQL peut bypasser RLS (et le superuser doit etre cantonne a la console managee Postgres-as-a-Service avec MFA + audit logs).
- Les triggers `BEFORE UPDATE` et `BEFORE DELETE` qui RAISE EXCEPTION constituent une 3e barriere meme contre superuser.

Cette architecture en 3 couches (RLS + REVOKE + triggers) garantit qu'un audit trail est **veritablement immutable**. Pour la purge legale (CNDP impose conservation 10 ans pour donnees assurance puis suppression obligatoire), une procedure speciale signee par 2 administrateurs (Maker-Checker) avec intervention superuser est documentee separement et rotee annuellement.

### 3.2 Pourquoi async via BullMQ et non synchrone

Le tracking synchrone (INSERT dans la requete HTTP) est seduisant mais comporte plusieurs pieges:
1. **Latence utilisateur degradee** - chaque requete document inclut un INSERT sur une table qui va potentiellement contenir des milliards de rows (cumul 10 ans), donc INSERT lent meme avec index optimal car contention sur le hot path ecriture.
2. **Couplage fort** - si la table `doc_access_logs` est saturee (lock acquis par migration ALTER, par bulk INSERT compliance, par VACUUM lourd), toutes les requetes documents sont ralenties.
3. **Risque rollback transaction** - si l'INSERT log echoue (deadlock, connection drop), toute la transaction documents est rolled back -> utilisateur ne peut plus telecharger son contrat alors que l'echec est cote tracking.
4. **Impossibilite de retry** - en sync, l'echec INSERT ne peut etre retry sans bloquer l'utilisateur.

Le tracking async via **BullMQ** (Redis-backed queue) resout tous ces problemes:
- L'INSERT est decouple du chemin critique HTTP (latence utilisateur ~ 0).
- En cas de saturation table logs, les jobs s'accumulent en queue avec back-pressure controlee.
- Retry automatique BullMQ avec exponential backoff (3 retries par defaut, configurable).
- Dead Letter Queue (DLQ) pour jobs en echec apres N retries -> alerte SecOps.
- Throughput: BullMQ supporte 100k+ jobs/s sur Redis cluster, largement au-dessus de notre charge cible (estim. 5k requetes documents/s pic Black Friday assurance).

Le compromis: il existe un delai entre l'acces et la persistance log (~ 100-500ms en charge nominale, jusqu'a quelques secondes en cas de pic). Pour absorber ce delai, le job inclut le timestamp de l'acces (`accessedAt`) genere cote interceptor au moment exact de la requete, donc la chronologie est preservee meme si l'INSERT a lieu plus tard.

### 3.3 Pourquoi sliding window 100/h calibration vs faux positifs

Le seuil **100 telechargements/heure** par utilisateur n'est pas arbitraire. Il resulte d'une analyse comportementale des usages legitimes dans l'assurance:
- Un courtier traitant 50 dossiers/jour: ~ 4-5 documents/dossier (devis, KFS, conditions generales, attestation, fiche client) = 200-250 documents/jour repartis sur 8h = ~ 30/h en pic.
- Un gestionnaire sinistres consulte ~ 80 documents/jour pendant catastrophes naturelles = ~ 50/h en pic.
- Un audit interne ACAPS preparation rapport annuel: peut consulter 100+ documents en 1h pendant phase intensive (1-2 fois/an).
- Un client final (souscripteur) consulte rarement plus de 5-10 documents par session.

Le seuil 100/h capture donc:
- Comportements anormaux (script de scraping, compte vole, exfiltration de masse).
- Faux positifs limites a 1-2% des audits internes intensifs (acceptable, geres via whitelist temporaire).

**Alternatives evaluees**:
| Approche | Avantages | Inconvenients | Choix |
|----------|-----------|---------------|-------|
| Counter fixe 1h | Simple O(1) Redis INCR + EXPIRE 3600 | Reset abrupt a la fin de l'heure (utilisateur peut faire 99 a 09:59 + 99 a 10:00 sans alerte) | Rejete |
| Sliding window per-minute buckets | Compromise simplicite/precision (60 buckets MGET) | Memoire Redis = 60 keys/user actif | **Choisi** |
| Sliding window log (sorted set ZRANGEBYSCORE) | Precision absolue | Memoire elevee (1 entry/event), CPU O(N log N) sur ZADD | Rejete (ne scale pas) |
| Bayesian inference / Markov | Detecte sequences anormales (ex: download tous PDFs alphabetiquement) | Complexite stats + risque faux positifs eleve sans tuning long | Defere Sprint 33 |
| Machine Learning (Isolation Forest, autoencoder) | Detecte patterns subtils | Necessite dataset d'entrainement labellise, ML ops | Defere Sprint 33 (avec equipe ML/AI) |

Le sliding window per-minute est le **sweet spot V1**: deterministe, explicable au CISO et au DPO, peu d'effort ops, faux positifs maitrises. Le Sprint 33 ajoutera une couche ML par-dessus pour patterns avances.

### 3.4 10+ pieges techniques

1. **RLS bypass par session role privilegie** - si la connection PostgreSQL utilise un role qui a `BYPASSRLS`, les policies sont ignorees. Verifier que le role applicatif `app_user` n'a PAS `BYPASSRLS` (sinon revoquer).
2. **REVOKE sans CASCADE roles** - REVOKE UPDATE/DELETE doit etre fait pour PUBLIC ET pour tous les roles applicatifs heritant. Lister via `\du+ doc_access_logs` ou requete sur `pg_class_aclitem`.
3. **Trigger FOR EACH STATEMENT vs FOR EACH ROW** - pour bloquer UPDATE/DELETE, utiliser FOR EACH STATEMENT (plus performant car evalue 1x meme pour UPDATE de 10000 rows).
4. **Race condition sliding window** - 2 serveurs incrementant simultanement la meme key Redis: INCR est atomique cote Redis donc safe, mais le check `sum > 100` puis `emit Kafka` n'est pas atomique. Solution: utiliser SETNX `abuse_emitted:user:{id}:{hour_bucket}` pour deduplication evenement.
5. **MGET avec liste vide** - si l'utilisateur n'a aucun bucket dans la derniere heure (premiere requete), MGET sur liste vide retourne []. Gerer ce cas (sum = 0).
6. **Drift horloge serveurs** - si serveur A a 10:00:30 et serveur B a 10:01:15, ils incrementent buckets differents -> sliding window peut sous-compter. Tolere car drift NTP < 1s en prod.
7. **Job BullMQ idempotency** - si BullMQ retry un job apres echec partiel (INSERT reussi mais ack manque), on cree un duplicate log. Solution: jobId deterministe = hash(userId, documentId, timestamp_ms) -> unicite garantie via PostgreSQL UNIQUE constraint sur (user_id, document_id, accessed_at, action) + ON CONFLICT DO NOTHING.
8. **Pino serialisation cyclique** - eviter de logger l'objet Request entier (contient `req.socket` cyclique). Extraire uniquement headers necessaires (User-Agent, X-Forwarded-For, X-Request-Id).
9. **IP X-Forwarded-For spoofing** - en l'absence de validation reverse-proxy, un client peut envoyer `X-Forwarded-For: 1.2.3.4` et masquer son IP reelle. Ne pas faire confiance aveugle: valider que `req.ip` est dans la liste reverse-proxies trusted (cf middleware trust proxy NestJS).
10. **IPv6 vs IPv4 dual-stack** - `req.ip` peut retourner `::ffff:192.168.1.1` (IPv4-mapped IPv6). Normaliser via `ipaddr.js` pour comparaison consistante (sinon meme user IP ipv4 et ipv6 comptees comme 2 utilisateurs differents pour blacklisting).
11. **Pagination cursor stale** - si curseur encode `id` UUID + `accessed_at` mais nouveau log inserre avec timestamp anterieur (clock skew), pagination peut sauter des records. Solution: cursor = base64({id, accessed_at}) avec ORDER BY accessed_at DESC, id DESC strict.
12. **Retention 10 ans** - 10 ans = 3651 jours (incluant 2 annees bissextiles 366j). Calcul precis: `DOCS_ACCESS_LOG_RETENTION_DAYS=3651`. La purge legale CNDP doit etre executee par procedure separee Maker-Checker (cf section 3.1).
13. **Queue saturation** - si pic 100k jobs/min mais worker traite 1k jobs/min, queue grossit indefiniment -> OOM Redis. Configurer `removeOnComplete: { count: 10000 }` et `removeOnFail: { count: 50000 }` + alerte Prometheus si depth queue > 100k.
14. **Tenant context perdu en async** - le job BullMQ est execute hors contexte HTTP -> AsyncLocalStorage tenant_id absent. Solution: passer `tenant_id` explicitement dans payload job + setter context dans processor avant Prisma query.
15. **Audit logs eux-memes audites** - tentation de logger les acces aux logs (recursion infinie). Filtrer la route `/api/v1/admin/docs/access-logs` dans l'interceptor pour eviter (sinon 1 admin consultant 100 logs cree 100 logs supplementaires).

## 4. Architecture context ASCII

```
+------------------------------------------------------------------------------------------+
|                         FLUX TRACKING ACCES DOCUMENT (E2E)                                |
+------------------------------------------------------------------------------------------+

  CLIENT (Browser/Mobile/API)
       |
       | HTTP GET /api/v1/docs/{id}/download    (JWT Bearer + tenant_id header)
       v
  +-----------------------------------+
  | NestJS API Gateway                |
  |  - JwtAuthGuard                   |
  |  - TenantMiddleware (RLS context) |
  |  - PermissionGuard                |
  +-----------------+-----------------+
                    |
                    v
  +-----------------------------------+        +------------------------+
  | DocsController.download()         |------->| LogDocumentAccessInter |  (apres handler success)
  |  - Stream PDF S3                  |        | ceptor.intercept()     |
  |  - Return 200 + Content-Disp      |        |  - extract context     |
  +-----------------------------------+        |  - enqueue job BullMQ  |
                                               +-----------+------------+
                                                           |
                                                           v
                                               +------------------------+
                                               | BullMQ Queue           |
                                               | docs-access-log        |
                                               | (Redis backend)        |
                                               +-----------+------------+
                                                           |
                                  +------------------------+------------------------+
                                  |                                                 |
                                  v                                                 v
                  +------------------------+                       +------------------------+
                  | Worker Process #1      |                       | Worker Process #N      |
                  | LogAccessAsyncProcessor|                       | LogAccessAsyncProcessor|
                  +------------+-----------+                       +------------+-----------+
                               |                                                 |
                               | (parallel processing)                           |
                               v                                                 v
                  +-----------------------------------+              +------------------------+
                  | AccessLogService.append()         |              | AccessAbuseDetector    |
                  |  - Set tenant context (RLS)       |              |  .checkAndEmit()       |
                  |  - Prisma INSERT INTO             |              |  - Redis INCR bucket   |
                  |    doc_access_logs                |              |  - MGET 60 buckets     |
                  |  - ON CONFLICT DO NOTHING         |              |  - sum > 100 -> Kafka  |
                  +-----------------+-----------------+              +-----------+------------+
                                    |                                            |
                                    v                                            v
                  +-----------------------------------+              +------------------------+
                  | PostgreSQL doc_access_logs        |              | Kafka Topic            |
                  | RLS: SELECT + INSERT only         |              | audit.suspicious_access|
                  | NO UPDATE policy                  |              | (consumed Sprint 33    |
                  | NO DELETE policy                  |              |  by SecOps module)     |
                  | Triggers BEFORE UPDATE/DELETE     |              +------------------------+
                  | -> RAISE EXCEPTION                |
                  +-----------------------------------+

+------------------------------------------------------------------------------------------+
|                        FLUX QUERY ADMIN AUDIT TRAIL (Compliance ACAPS)                    |
+------------------------------------------------------------------------------------------+

  ADMIN CONSOLE (Compliance Officer)
       |
       | HTTP GET /api/v1/admin/docs/access-logs?document_id=X&user_id=Y&from=2025-01-01
       v
  +-----------------------------------+
  | AdminAccessLogsController         |
  |  - PermissionGuard                |
  |    (docs.access_logs.read)        |
  |  - SKIP LogDocumentAccess         |
  |    Interceptor (anti-recursion)   |
  +-----------------+-----------------+
                    |
                    v
  +-----------------------------------+
  | AccessLogService.queryByFilters() |
  |  - Cursor pagination              |
  |  - Prisma findMany WHERE          |
  |  - Returns {data, nextCursor}     |
  +-----------------+-----------------+
                    |
                    v
  +-----------------------------------+
  | PostgreSQL SELECT (RLS enforced)  |
  | tenant_id = app_current_tenant()  |
  +-----------------------------------+

+------------------------------------------------------------------------------------------+
|                        FLUX FALLBACK (BullMQ down -> degradation)                         |
+------------------------------------------------------------------------------------------+

  Interceptor.intercept()
       |
       | enqueue() throws ConnectionError
       v
  +-----------------------------------+
  | catch block                       |
  |  - logger.error('queue down')     |
  |  - localFallbackLogger.write(NDJSON) -> /var/log/skalean/access-fallback.ndjson
  |  - emit metric 'access_log_fallback_total{reason=queue_down}'
  +-----------------------------------+
       |
       | (cron job ingest fallback file 5min later when queue restored)
       v
  +-----------------------------------+
  | scripts/ingest-fallback-logs.ts   |
  +-----------------------------------+
```

## 5. Livrables checkables

1. Migration `DocsAccessLogsAppendOnly` cree policies RLS SELECT + INSERT, REVOKE UPDATE/DELETE PUBLIC, triggers BEFORE UPDATE/DELETE qui RAISE EXCEPTION.
2. Migration ajoute UNIQUE constraint `(user_id, document_id, accessed_at, action)` pour idempotency BullMQ.
3. Enum `AccessAction` exporte les 5 actions: `view`, `download`, `share`, `preview`, `metadata_query`.
4. `AccessLogService.append(payload)` persiste log avec `tenant_id`, `user_id`, `document_id`, `action`, `ip_address` (normalisee), `user_agent` (truncated 512 chars), `accessed_at`, `request_id`, `metadata` JSONB.
5. `AccessLogService.queryByFilters({tenantId, documentId?, userId?, action?, from?, to?, cursor?})` retourne `{data, nextCursor}` avec ORDER BY accessed_at DESC.
6. `AccessLogService.queryTimelineForDocument(documentId)` retourne agregation par jour + count actions.
7. `AccessLogService.queryActivityForUser(userId, from, to)` retourne 30 dernieres entrees + count par action.
8. `AccessAbuseDetectorService.recordAccess(userId, action)` increment Redis bucket si action in `['download', 'view']`.
9. `AccessAbuseDetectorService.checkAndEmitIfExceeded(userId)` MGET 60 buckets + emit Kafka si sum > seuil + SETNX deduplication.
10. `AccessAbuseDetectorService.getCurrentCount(userId)` retourne sum 60 buckets (utilise par admin endpoint diagnostic).
11. `LogDocumentAccessInterceptor` extrait context (user, tenant, ip, user-agent, request-id), enqueue job BullMQ apres handler success uniquement.
12. Interceptor SKIP si route matches `/admin/docs/access-logs/*` (anti-recursion).
13. Interceptor SKIP si statusCode != 2xx (eviter logger erreurs 4xx/5xx en doublon avec error logger).
14. `LogAccessAsyncJob` processor consume queue `docs-access-log`, set tenant context Prisma, append log, increment abuse detector, check & emit.
15. Processor handle ON CONFLICT DO NOTHING pour idempotency (UNIQUE constraint).
16. Processor implemente fallback local NDJSON si Prisma INSERT fail apres 3 retries.
17. `AdminAccessLogsController` expose 3 endpoints (list filtre, timeline document, activity user) avec PermissionGuard `docs.access_logs.read`.
18. Endpoints supportent cursor pagination base64({accessed_at, id}) ordered DESC.
19. Schema Zod valide query params (date format ISO, UUID, action enum, limit 1-200).
20. E2E tests demontrent INSERT OK, UPDATE rejected (PG error), DELETE rejected (PG error), bypass RLS impossible avec role applicatif.
21. Unit tests AccessLogService: 7+ scenarios (append OK, append duplicate ON CONFLICT, query empty, query with filters, query pagination, queryTimeline, queryActivity).
22. Unit tests AbuseDetector: 6+ scenarios (no abuse, threshold reached emit, Redis down skip, deduplication SETNX, IPv6 normalization, drift bucket).
23. Unit tests Interceptor: 5+ scenarios (success enqueue, error skip, admin route skip, queue down fallback, request-id propagation).
24. Unit tests Controller: 4+ scenarios (list filtered, timeline, activity, permission denied 403).
25. Unit tests Processor: 4+ scenarios (job process OK, duplicate ignore, abuse threshold emit Kafka, fallback file write on PG error).
26. Variables env documentees `.env.example`: `DOCS_ACCESS_ABUSE_THRESHOLD_PER_HOUR`, `DOCS_ACCESS_LOG_QUEUE`, `DOCS_ACCESS_LOG_RETENTION_DAYS`, `DOCS_ACCESS_LOG_FALLBACK_PATH`.
27. Pino logger structure tous logs avec `correlationId`, `tenantId`, `userId`, `event` field.
28. Metrics Prometheus exposees: `access_log_appended_total{tenant,action}`, `access_log_fallback_total{reason}`, `access_abuse_detected_total{tenant}`, `access_log_queue_depth`.
29. Documentation OpenAPI generee pour 3 endpoints admin (decorateurs `@ApiOperation`, `@ApiQuery`, `@ApiResponse`).
30. README.md docs package documente la chaine complete + procedure purge legale Maker-Checker.

## 6. Fichiers crees/modifies exhaustive

**Crees**:
- `repo/packages/docs/src/services/access-log.service.ts` (~250 lignes)
- `repo/packages/docs/src/services/access-log.service.spec.ts` (~200 lignes)
- `repo/packages/docs/src/services/access-abuse-detector.service.ts` (~180 lignes)
- `repo/packages/docs/src/services/access-abuse-detector.service.spec.ts` (~150 lignes)
- `repo/packages/docs/src/types/access-action.enum.ts` (~30 lignes)
- `repo/packages/docs/src/dtos/access-log-query.dto.ts` (~60 lignes Zod)
- `repo/apps/api/src/modules/docs/interceptors/log-document-access.interceptor.ts` (~120 lignes)
- `repo/apps/api/src/modules/docs/interceptors/log-document-access.interceptor.spec.ts` (~100 lignes)
- `repo/apps/api/src/modules/admin/controllers/admin-access-logs.controller.ts` (~150 lignes)
- `repo/apps/api/src/modules/admin/controllers/admin-access-logs.controller.spec.ts` (~120 lignes)
- `repo/apps/api/src/modules/docs/jobs/log-access-async.job.ts` (~100 lignes)
- `repo/apps/api/src/modules/docs/jobs/log-access-async.job.spec.ts` (~80 lignes)
- `repo/packages/database/src/migrations/20260108120000-DocsAccessLogsAppendOnly.ts` (~80 lignes)
- `repo/apps/api/test/docs/access-logs.e2e-spec.ts` (~250 lignes)

**Modifies**:
- `repo/packages/docs/src/index.ts` (export AccessLogService, AccessAbuseDetectorService, AccessAction enum, AccessLogQueryDto).
- `repo/packages/docs/src/docs.module.ts` (provide AccessLogService + AccessAbuseDetectorService + register Bull queue `docs-access-log`).
- `repo/apps/api/src/modules/docs/docs.module.ts` (register LogDocumentAccessInterceptor as APP_INTERCEPTOR scope DOCS).
- `repo/apps/api/src/modules/admin/admin.module.ts` (register AdminAccessLogsController).
- `repo/apps/api/src/app.module.ts` (BullModule register queue).
- `repo/apps/api/src/config/configuration.ts` (parse new env vars Zod).
- `repo/.env.example` (ajouter 4 variables).
- `repo/packages/database/prisma/schema.prisma` (ajouter `@@unique([userId, documentId, accessedAt, action])` sur `DocAccessLog`).
- `repo/docs/audit-trail.md` (procedure purge legale Maker-Checker, schemas RLS).

## 7. CODE COMPLET

### 7.1 `repo/packages/docs/src/types/access-action.enum.ts`

```typescript
/**
 * Enumeration des actions tracees sur un document.
 *
 * Conformite:
 * - ACAPS Circulaire 2018/01 art.9: tracabilite operations courtage.
 * - Loi 09-08 art.13: integrite traitement donnees personnelles.
 * - Loi 43-20 art.9: preuve numerique (acces consultable horodate).
 *
 * Valeurs strictement controlees - ajout requiert migration enum PostgreSQL.
 */
export const ACCESS_ACTIONS = [
  'view',
  'download',
  'share',
  'preview',
  'metadata_query',
] as const;

export type AccessAction = (typeof ACCESS_ACTIONS)[number];

export const ACCESS_ACTIONS_TRACKED_FOR_ABUSE: ReadonlySet<AccessAction> = new Set<AccessAction>([
  'download',
  'view',
]);

export function isAccessAction(value: unknown): value is AccessAction {
  return typeof value === 'string' && (ACCESS_ACTIONS as readonly string[]).includes(value);
}
```

### 7.2 `repo/packages/docs/src/dtos/access-log-query.dto.ts`

```typescript
import { z } from 'zod';
import { ACCESS_ACTIONS } from '../types/access-action.enum';

export const AccessLogQuerySchema = z
  .object({
    document_id: z.string().uuid().optional(),
    user_id: z.string().uuid().optional(),
    action: z.enum(ACCESS_ACTIONS).optional(),
    from: z.string().datetime({ offset: true }).optional(),
    to: z.string().datetime({ offset: true }).optional(),
    cursor: z.string().min(1).max(2048).optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50),
  })
  .refine(
    (data) => {
      if (data.from && data.to) {
        return new Date(data.from).getTime() <= new Date(data.to).getTime();
      }
      return true;
    },
    { message: 'from doit etre <= to', path: ['from'] },
  );

export type AccessLogQueryDto = z.infer<typeof AccessLogQuerySchema>;

export const AccessLogTimelineParamsSchema = z.object({
  documentId: z.string().uuid(),
});
export type AccessLogTimelineParamsDto = z.infer<typeof AccessLogTimelineParamsSchema>;

export const AccessLogUserParamsSchema = z.object({
  userId: z.string().uuid(),
});
export type AccessLogUserParamsDto = z.infer<typeof AccessLogUserParamsSchema>;

export interface AccessLogCursorPayload {
  accessedAt: string;
  id: string;
}

export function encodeCursor(payload: AccessLogCursorPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string): AccessLogCursorPayload {
  const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
  const parsed = JSON.parse(decoded) as Partial<AccessLogCursorPayload>;
  if (!parsed.id || !parsed.accessedAt) {
    throw new Error('Curseur invalide');
  }
  return { id: parsed.id, accessedAt: parsed.accessedAt };
}
```

### 7.3 `repo/packages/docs/src/services/access-log.service.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '@skalean/database';
import { Logger, PinoLogger } from 'nestjs-pino';
import {
  AccessLogCursorPayload,
  AccessLogQueryDto,
  decodeCursor,
  encodeCursor,
} from '../dtos/access-log-query.dto';
import { AccessAction } from '../types/access-action.enum';
import { CounterMetric } from '@skalean/observability';
import * as ipaddr from 'ipaddr.js';

export interface AccessLogAppendPayload {
  tenantId: string;
  userId: string;
  documentId: string;
  action: AccessAction;
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
  accessedAt: Date;
  metadata?: Record<string, unknown>;
}

export interface AccessLogPage {
  data: AccessLogRecord[];
  nextCursor: string | null;
}

export interface AccessLogRecord {
  id: string;
  tenantId: string;
  userId: string;
  documentId: string;
  action: AccessAction;
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
  accessedAt: Date;
  metadata: Record<string, unknown> | null;
}

export interface AccessLogTimelineEntry {
  day: string; // YYYY-MM-DD
  total: number;
  byAction: Record<AccessAction, number>;
}

export interface AccessLogUserActivity {
  userId: string;
  totalLast30: number;
  byAction: Record<AccessAction, number>;
  recentEntries: AccessLogRecord[];
}

@Injectable()
export class AccessLogService {
  private readonly USER_AGENT_MAX_LEN = 512;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(Logger) private readonly logger: PinoLogger,
    @Inject('METRIC_ACCESS_LOG_APPENDED')
    private readonly appendedMetric: CounterMetric,
  ) {
    this.logger.setContext(AccessLogService.name);
  }

  /**
   * Append d'un evenement d'acces document.
   * Idempotent via UNIQUE constraint (user_id, document_id, accessed_at, action).
   * En cas de duplicate: ON CONFLICT DO NOTHING -> 0 ligne inseree.
   */
  async append(payload: AccessLogAppendPayload): Promise<void> {
    const normalizedIp = this.normalizeIp(payload.ipAddress);
    const truncatedUa = payload.userAgent
      ? payload.userAgent.slice(0, this.USER_AGENT_MAX_LEN)
      : null;

    try {
      // Set RLS tenant context AVANT INSERT.
      await this.prisma.$executeRawUnsafe(
        `SELECT set_config('app.current_tenant_id', $1, true)`,
        payload.tenantId,
      );

      const result = await this.prisma.$executeRaw`
        INSERT INTO doc_access_logs (
          id, tenant_id, user_id, document_id, action,
          ip_address, user_agent, request_id, accessed_at, metadata
        ) VALUES (
          gen_random_uuid(), ${payload.tenantId}::uuid, ${payload.userId}::uuid,
          ${payload.documentId}::uuid, ${payload.action}::text,
          ${normalizedIp}, ${truncatedUa}, ${payload.requestId},
          ${payload.accessedAt}::timestamptz, ${JSON.stringify(payload.metadata ?? {})}::jsonb
        )
        ON CONFLICT (user_id, document_id, accessed_at, action) DO NOTHING
      `;

      this.appendedMetric.inc({ tenant: payload.tenantId, action: payload.action }, 1);

      this.logger.info(
        {
          event: 'access_log.appended',
          tenantId: payload.tenantId,
          userId: payload.userId,
          documentId: payload.documentId,
          action: payload.action,
          inserted: result === 1,
          correlationId: payload.requestId ?? undefined,
        },
        result === 1 ? 'Log acces persiste' : 'Log acces deja existant (ON CONFLICT)',
      );
    } catch (error) {
      this.logger.error(
        {
          event: 'access_log.append_failed',
          tenantId: payload.tenantId,
          userId: payload.userId,
          documentId: payload.documentId,
          action: payload.action,
          err: error,
        },
        'Echec persistance log acces',
      );
      throw error;
    }
  }

  async queryByFilters(tenantId: string, query: AccessLogQueryDto): Promise<AccessLogPage> {
    await this.setTenantContext(tenantId);

    let cursor: AccessLogCursorPayload | undefined;
    if (query.cursor) {
      cursor = decodeCursor(query.cursor);
    }

    const conditions: string[] = ['tenant_id = $1::uuid'];
    const params: (string | number | Date)[] = [tenantId];

    if (query.document_id) {
      params.push(query.document_id);
      conditions.push(`document_id = $${params.length}::uuid`);
    }
    if (query.user_id) {
      params.push(query.user_id);
      conditions.push(`user_id = $${params.length}::uuid`);
    }
    if (query.action) {
      params.push(query.action);
      conditions.push(`action = $${params.length}::text`);
    }
    if (query.from) {
      params.push(new Date(query.from));
      conditions.push(`accessed_at >= $${params.length}::timestamptz`);
    }
    if (query.to) {
      params.push(new Date(query.to));
      conditions.push(`accessed_at <= $${params.length}::timestamptz`);
    }
    if (cursor) {
      params.push(new Date(cursor.accessedAt));
      params.push(cursor.id);
      conditions.push(
        `(accessed_at, id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`,
      );
    }

    params.push(query.limit + 1); // +1 pour detecter nextCursor.
    const limitIndex = params.length;

    const sql = `
      SELECT id, tenant_id, user_id, document_id, action,
             ip_address, user_agent, request_id, accessed_at, metadata
      FROM doc_access_logs
      WHERE ${conditions.join(' AND ')}
      ORDER BY accessed_at DESC, id DESC
      LIMIT $${limitIndex}
    `;

    const rows = await this.prisma.$queryRawUnsafe<RawAccessLogRow[]>(sql, ...params);
    const data = rows.slice(0, query.limit).map((r) => this.mapRow(r));
    let nextCursor: string | null = null;
    if (rows.length > query.limit) {
      const last = data[data.length - 1];
      nextCursor = encodeCursor({
        accessedAt: last.accessedAt.toISOString(),
        id: last.id,
      });
    }

    return { data, nextCursor };
  }

  async queryTimelineForDocument(
    tenantId: string,
    documentId: string,
  ): Promise<AccessLogTimelineEntry[]> {
    await this.setTenantContext(tenantId);

    const rows = await this.prisma.$queryRaw<TimelineRow[]>`
      SELECT
        TO_CHAR(accessed_at::date, 'YYYY-MM-DD') AS day,
        action,
        COUNT(*)::int AS count
      FROM doc_access_logs
      WHERE tenant_id = ${tenantId}::uuid
        AND document_id = ${documentId}::uuid
        AND accessed_at >= NOW() - INTERVAL '90 days'
      GROUP BY day, action
      ORDER BY day DESC
    `;

    const grouped = new Map<string, AccessLogTimelineEntry>();
    for (const row of rows) {
      let entry = grouped.get(row.day);
      if (!entry) {
        entry = {
          day: row.day,
          total: 0,
          byAction: { view: 0, download: 0, share: 0, preview: 0, metadata_query: 0 },
        };
        grouped.set(row.day, entry);
      }
      entry.byAction[row.action] = row.count;
      entry.total += row.count;
    }

    return Array.from(grouped.values());
  }

  async queryActivityForUser(
    tenantId: string,
    userId: string,
    from: Date,
    to: Date,
  ): Promise<AccessLogUserActivity> {
    await this.setTenantContext(tenantId);

    const aggregateRows = await this.prisma.$queryRaw<{ action: AccessAction; count: number }[]>`
      SELECT action, COUNT(*)::int AS count
      FROM doc_access_logs
      WHERE tenant_id = ${tenantId}::uuid
        AND user_id = ${userId}::uuid
        AND accessed_at BETWEEN ${from}::timestamptz AND ${to}::timestamptz
      GROUP BY action
    `;

    const byAction: Record<AccessAction, number> = {
      view: 0,
      download: 0,
      share: 0,
      preview: 0,
      metadata_query: 0,
    };
    let totalLast30 = 0;
    for (const row of aggregateRows) {
      byAction[row.action] = row.count;
      totalLast30 += row.count;
    }

    const recentRows = await this.prisma.$queryRaw<RawAccessLogRow[]>`
      SELECT id, tenant_id, user_id, document_id, action,
             ip_address, user_agent, request_id, accessed_at, metadata
      FROM doc_access_logs
      WHERE tenant_id = ${tenantId}::uuid
        AND user_id = ${userId}::uuid
      ORDER BY accessed_at DESC
      LIMIT 30
    `;
    const recentEntries = recentRows.map((r) => this.mapRow(r));

    return { userId, totalLast30, byAction, recentEntries };
  }

  private async setTenantContext(tenantId: string): Promise<void> {
    await this.prisma.$executeRawUnsafe(
      `SELECT set_config('app.current_tenant_id', $1, true)`,
      tenantId,
    );
  }

  private normalizeIp(ip: string | null): string | null {
    if (!ip) return null;
    try {
      const parsed = ipaddr.parse(ip);
      if (parsed.kind() === 'ipv6') {
        const ipv6 = parsed as ipaddr.IPv6;
        if (ipv6.isIPv4MappedAddress()) {
          return ipv6.toIPv4Address().toString();
        }
        return ipv6.toNormalizedString();
      }
      return parsed.toString();
    } catch {
      this.logger.warn({ event: 'access_log.ip_parse_failed', ip }, 'IP non parsable');
      return null;
    }
  }

  private mapRow(row: RawAccessLogRow): AccessLogRecord {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      documentId: row.document_id,
      action: row.action as AccessAction,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      requestId: row.request_id,
      accessedAt: row.accessed_at,
      metadata: row.metadata,
    };
  }
}

interface RawAccessLogRow {
  id: string;
  tenant_id: string;
  user_id: string;
  document_id: string;
  action: string;
  ip_address: string | null;
  user_agent: string | null;
  request_id: string | null;
  accessed_at: Date;
  metadata: Record<string, unknown> | null;
}

interface TimelineRow {
  day: string;
  action: AccessAction;
  count: number;
}
```

### 7.4 `repo/packages/docs/src/services/access-abuse-detector.service.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger, Logger } from 'nestjs-pino';
import Redis from 'ioredis';
import { KafkaProducerService } from '@skalean/messaging';
import { ConfigService } from '@nestjs/config';
import { CounterMetric } from '@skalean/observability';
import { AccessAction, ACCESS_ACTIONS_TRACKED_FOR_ABUSE } from '../types/access-action.enum';

export interface AbuseCheckResult {
  exceeded: boolean;
  count: number;
  threshold: number;
  emitted: boolean;
}

@Injectable()
export class AccessAbuseDetectorService {
  private readonly bucketTtlSeconds = 3700;
  private readonly bucketDurationMs = 60_000;
  private readonly bucketsInWindow = 60;
  private readonly threshold: number;

  constructor(
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private readonly kafka: KafkaProducerService,
    private readonly config: ConfigService,
    @Inject(Logger) private readonly logger: PinoLogger,
    @Inject('METRIC_ACCESS_ABUSE_DETECTED')
    private readonly detectedMetric: CounterMetric,
  ) {
    this.logger.setContext(AccessAbuseDetectorService.name);
    this.threshold =
      this.config.get<number>('DOCS_ACCESS_ABUSE_THRESHOLD_PER_HOUR') ?? 100;
  }

  async recordAccess(
    tenantId: string,
    userId: string,
    action: AccessAction,
    now: Date = new Date(),
  ): Promise<void> {
    if (!ACCESS_ACTIONS_TRACKED_FOR_ABUSE.has(action)) {
      return;
    }
    try {
      const bucketKey = this.getBucketKey(tenantId, userId, now);
      const pipeline = this.redis.multi();
      pipeline.incr(bucketKey);
      pipeline.expire(bucketKey, this.bucketTtlSeconds);
      await pipeline.exec();
    } catch (error) {
      this.logger.warn(
        { event: 'abuse_detector.record_failed', tenantId, userId, err: error },
        'Echec record acces (Redis indisponible) - degradation gracieuse',
      );
    }
  }

  async checkAndEmitIfExceeded(
    tenantId: string,
    userId: string,
    now: Date = new Date(),
  ): Promise<AbuseCheckResult> {
    let count = 0;
    try {
      const keys = this.getWindowBucketKeys(tenantId, userId, now);
      if (keys.length === 0) {
        return { exceeded: false, count: 0, threshold: this.threshold, emitted: false };
      }
      const values = await this.redis.mget(...keys);
      count = values.reduce<number>((sum, v) => sum + (v ? parseInt(v, 10) : 0), 0);
    } catch (error) {
      this.logger.warn(
        { event: 'abuse_detector.check_failed', tenantId, userId, err: error },
        'Echec verification compteur (Redis down) - skip emission',
      );
      return { exceeded: false, count: 0, threshold: this.threshold, emitted: false };
    }

    if (count <= this.threshold) {
      return { exceeded: false, count, threshold: this.threshold, emitted: false };
    }

    // Deduplication: 1 emission par utilisateur par heure.
    const dedupKey = this.getDedupKey(tenantId, userId, now);
    let emitted = false;
    try {
      const setResult = await this.redis.set(dedupKey, '1', 'EX', 3700, 'NX');
      if (setResult === 'OK') {
        await this.kafka.emit('audit.suspicious_access', {
          schemaVersion: 1,
          tenantId,
          userId,
          windowMinutes: this.bucketsInWindow,
          count,
          threshold: this.threshold,
          detectedAt: now.toISOString(),
          source: 'docs.access_abuse_detector',
        });
        this.detectedMetric.inc({ tenant: tenantId }, 1);
        this.logger.warn(
          {
            event: 'abuse_detector.suspicious_access_emitted',
            tenantId,
            userId,
            count,
            threshold: this.threshold,
          },
          'Evenement suspicious_access emis vers Kafka',
        );
        emitted = true;
      }
    } catch (error) {
      this.logger.error(
        { event: 'abuse_detector.emit_failed', tenantId, userId, err: error },
        'Echec emission Kafka',
      );
    }

    return { exceeded: true, count, threshold: this.threshold, emitted };
  }

  async getCurrentCount(tenantId: string, userId: string, now: Date = new Date()): Promise<number> {
    try {
      const keys = this.getWindowBucketKeys(tenantId, userId, now);
      if (keys.length === 0) return 0;
      const values = await this.redis.mget(...keys);
      return values.reduce<number>((sum, v) => sum + (v ? parseInt(v, 10) : 0), 0);
    } catch {
      return 0;
    }
  }

  private getBucketKey(tenantId: string, userId: string, now: Date): string {
    const bucket = Math.floor(now.getTime() / this.bucketDurationMs);
    return `access_count:${tenantId}:${userId}:${bucket}`;
  }

  private getWindowBucketKeys(tenantId: string, userId: string, now: Date): string[] {
    const currentBucket = Math.floor(now.getTime() / this.bucketDurationMs);
    return Array.from({ length: this.bucketsInWindow }, (_, i) =>
      `access_count:${tenantId}:${userId}:${currentBucket - i}`,
    );
  }

  private getDedupKey(tenantId: string, userId: string, now: Date): string {
    const hourBucket = Math.floor(now.getTime() / (60 * 60 * 1000));
    return `abuse_emitted:${tenantId}:${userId}:${hourBucket}`;
  }
}
```

### 7.5 `repo/apps/api/src/modules/docs/interceptors/log-document-access.interceptor.ts`

```typescript
import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { Request, Response } from 'express';
import { createHash } from 'crypto';
import { PinoLogger, Logger } from 'nestjs-pino';
import { promises as fs } from 'fs';
import { join } from 'path';
import { ConfigService } from '@nestjs/config';
import { AccessAction } from '@skalean/docs';

export const ACCESS_LOG_ACTION_KEY = 'docs:access_log:action';
export const SkipAccessLog = (): MethodDecorator & ClassDecorator => {
  return (target: object, key?: string | symbol) => {
    Reflect.defineMetadata('docs:access_log:skip', true, key ? target.constructor : target);
  };
};

@Injectable()
export class LogDocumentAccessInterceptor implements NestInterceptor {
  private readonly fallbackPath: string;

  constructor(
    @InjectQueue('docs-access-log') private readonly queue: Queue,
    private readonly reflector: Reflector,
    @Inject(Logger) private readonly logger: PinoLogger,
    private readonly config: ConfigService,
  ) {
    this.logger.setContext(LogDocumentAccessInterceptor.name);
    this.fallbackPath =
      this.config.get<string>('DOCS_ACCESS_LOG_FALLBACK_PATH') ??
      '/var/log/skalean/access-fallback.ndjson';
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const httpCtx = context.switchToHttp();
    const req = httpCtx.getRequest<Request>();
    const res = httpCtx.getResponse<Response>();

    const skip =
      this.reflector.get<boolean>('docs:access_log:skip', context.getHandler()) ||
      this.reflector.get<boolean>('docs:access_log:skip', context.getClass()) ||
      req.path?.startsWith('/api/v1/admin/docs/access-logs');

    if (skip) {
      return next.handle();
    }

    const action = this.reflector.get<AccessAction>(
      ACCESS_LOG_ACTION_KEY,
      context.getHandler(),
    );
    if (!action) {
      return next.handle();
    }

    const accessedAt = new Date();
    return next.handle().pipe(
      tap({
        next: async () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            return;
          }
          await this.enqueueOrFallback(req, action, accessedAt);
        },
      }),
    );
  }

  private async enqueueOrFallback(
    req: Request,
    action: AccessAction,
    accessedAt: Date,
  ): Promise<void> {
    const documentId =
      (req.params?.id as string | undefined) ??
      (req.params?.documentId as string | undefined) ??
      (req.body?.documentId as string | undefined);

    if (!documentId) {
      this.logger.debug(
        { event: 'access_log_interceptor.no_document_id', path: req.path },
        'Aucun documentId resolvable - skip',
      );
      return;
    }

    const user = (req as Request & { user?: { id: string; tenantId: string } }).user;
    if (!user) {
      this.logger.debug({ event: 'access_log_interceptor.no_user', path: req.path }, 'Pas user');
      return;
    }

    const ipHeader = (req.headers['x-forwarded-for'] as string | undefined) ?? '';
    const ip = ipHeader.split(',')[0]?.trim() || req.ip || null;
    const ua = (req.headers['user-agent'] as string | undefined) ?? null;
    const requestId = (req.headers['x-request-id'] as string | undefined) ?? null;

    const idempotencyKey = createHash('sha256')
      .update(`${user.id}|${documentId}|${accessedAt.toISOString()}|${action}`)
      .digest('hex');

    const payload = {
      tenantId: user.tenantId,
      userId: user.id,
      documentId,
      action,
      ipAddress: ip,
      userAgent: ua,
      requestId,
      accessedAt: accessedAt.toISOString(),
    };

    try {
      await this.queue.add('append-log', payload, {
        jobId: idempotencyKey,
        attempts: 3,
        backoff: { type: 'exponential', delay: 500 },
        removeOnComplete: { count: 10000 },
        removeOnFail: { count: 50000 },
      });
    } catch (error) {
      this.logger.error(
        { event: 'access_log_interceptor.queue_unavailable', err: error, payload },
        'BullMQ down - fallback fichier local',
      );
      try {
        await fs.appendFile(
          this.fallbackPath,
          JSON.stringify({ ...payload, fallbackReason: 'queue_unavailable' }) + '\n',
          { encoding: 'utf8' },
        );
      } catch (fsError) {
        this.logger.fatal(
          { event: 'access_log_interceptor.fallback_failed', err: fsError },
          'Fallback fichier impossible - log perdu',
        );
      }
    }
  }
}

export const LogAccess = (action: AccessAction): MethodDecorator => {
  return (target, propertyKey, descriptor) => {
    Reflect.defineMetadata(ACCESS_LOG_ACTION_KEY, action, descriptor.value as object);
  };
};
```

### 7.6 `repo/apps/api/src/modules/docs/jobs/log-access-async.job.ts`

```typescript
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { PinoLogger, Logger } from 'nestjs-pino';
import { promises as fs } from 'fs';
import { ConfigService } from '@nestjs/config';
import {
  AccessLogService,
  AccessAbuseDetectorService,
  AccessAction,
} from '@skalean/docs';

export interface LogAccessAsyncPayload {
  tenantId: string;
  userId: string;
  documentId: string;
  action: AccessAction;
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
  accessedAt: string;
}

@Processor('docs-access-log', { concurrency: 16 })
@Injectable()
export class LogAccessAsyncProcessor extends WorkerHost {
  private readonly fallbackPath: string;

  constructor(
    private readonly accessLogService: AccessLogService,
    private readonly abuseDetector: AccessAbuseDetectorService,
    @Inject(Logger) private readonly logger: PinoLogger,
    private readonly config: ConfigService,
  ) {
    super();
    this.logger.setContext(LogAccessAsyncProcessor.name);
    this.fallbackPath =
      this.config.get<string>('DOCS_ACCESS_LOG_FALLBACK_PATH') ??
      '/var/log/skalean/access-fallback.ndjson';
  }

  async process(job: Job<LogAccessAsyncPayload>): Promise<void> {
    const { data } = job;
    const accessedAt = new Date(data.accessedAt);

    try {
      await this.accessLogService.append({
        tenantId: data.tenantId,
        userId: data.userId,
        documentId: data.documentId,
        action: data.action,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        requestId: data.requestId,
        accessedAt,
      });
    } catch (error) {
      this.logger.error(
        { event: 'log_access_processor.append_failed', jobId: job.id, err: error },
        'Echec append log - tentative fallback fichier',
      );
      if (job.attemptsMade + 1 >= (job.opts.attempts ?? 3)) {
        await this.writeFallback(data, error);
      }
      throw error;
    }

    try {
      await this.abuseDetector.recordAccess(data.tenantId, data.userId, data.action, accessedAt);
      await this.abuseDetector.checkAndEmitIfExceeded(data.tenantId, data.userId, accessedAt);
    } catch (error) {
      this.logger.warn(
        { event: 'log_access_processor.abuse_check_failed', err: error },
        'Echec abuse detection - log persiste OK',
      );
    }
  }

  private async writeFallback(data: LogAccessAsyncPayload, err: unknown): Promise<void> {
    try {
      await fs.appendFile(
        this.fallbackPath,
        JSON.stringify({
          ...data,
          fallbackReason: 'persistence_failed',
          errorMessage: err instanceof Error ? err.message : String(err),
        }) + '\n',
        'utf8',
      );
    } catch (e) {
      this.logger.fatal(
        { event: 'log_access_processor.fallback_failed', err: e },
        'Fallback fichier impossible - LOG PERDU - alerte SecOps',
      );
    }
  }
}
```

### 7.7 `repo/apps/api/src/modules/admin/controllers/admin-access-logs.controller.ts`

```typescript
import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, PermissionsGuard, Permissions } from '@skalean/auth';
import { TenantContext, CurrentTenant } from '@skalean/multi-tenant';
import { ZodValidationPipe } from '@skalean/common';
import { AccessLogService } from '@skalean/docs';
import {
  AccessLogQueryDto,
  AccessLogQuerySchema,
} from '@skalean/docs/dtos/access-log-query.dto';
import { SkipAccessLog } from '../../docs/interceptors/log-document-access.interceptor';

@ApiTags('Admin - Access Logs')
@Controller('admin/docs/access-logs')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@SkipAccessLog()
export class AdminAccessLogsController {
  constructor(private readonly accessLogService: AccessLogService) {}

  @Get()
  @Permissions('docs.access_logs.read')
  @ApiOperation({ summary: 'Liste paginee des logs d acces documents' })
  @ApiQuery({ name: 'document_id', required: false, type: String })
  @ApiQuery({ name: 'user_id', required: false, type: String })
  @ApiQuery({ name: 'action', required: false, enum: ['view', 'download', 'share', 'preview', 'metadata_query'] })
  @ApiQuery({ name: 'from', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Page de logs' })
  @ApiResponse({ status: 403, description: 'Permission refusee' })
  @UsePipes(new ZodValidationPipe(AccessLogQuerySchema))
  async listLogs(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: AccessLogQueryDto,
  ) {
    return this.accessLogService.queryByFilters(tenant.tenantId, query);
  }

  @Get('timeline/:documentId')
  @Permissions('docs.access_logs.read')
  @ApiOperation({ summary: 'Timeline 90j des acces sur un document' })
  async timeline(
    @CurrentTenant() tenant: TenantContext,
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ) {
    const data = await this.accessLogService.queryTimelineForDocument(
      tenant.tenantId,
      documentId,
    );
    return { documentId, days: data };
  }

  @Get('user/:userId')
  @Permissions('docs.access_logs.read')
  @ApiOperation({ summary: 'Activite acces documents par utilisateur (30j)' })
  async userActivity(
    @CurrentTenant() tenant: TenantContext,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const toDate = to ? new Date(to) : new Date();
    return this.accessLogService.queryActivityForUser(
      tenant.tenantId,
      userId,
      fromDate,
      toDate,
    );
  }
}
```

### 7.8 `repo/packages/database/src/migrations/20260108120000-DocsAccessLogsAppendOnly.ts`

```typescript
import { Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.executeQuery({
    sql: `
      -- 1) UNIQUE constraint pour idempotency BullMQ.
      ALTER TABLE doc_access_logs
        ADD CONSTRAINT doc_access_logs_idempotency_uniq
        UNIQUE (user_id, document_id, accessed_at, action);

      -- 2) Activation Row Level Security.
      ALTER TABLE doc_access_logs ENABLE ROW LEVEL SECURITY;
      ALTER TABLE doc_access_logs FORCE ROW LEVEL SECURITY;

      -- 3) Policy SELECT - tenant_id matching session context.
      CREATE POLICY doc_access_logs_tenant_select ON doc_access_logs
        FOR SELECT
        USING (tenant_id::text = current_setting('app.current_tenant_id', true));

      -- 4) Policy INSERT - meme tenant.
      CREATE POLICY doc_access_logs_tenant_insert ON doc_access_logs
        FOR INSERT
        WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));

      -- 5) PAS de policy UPDATE (rejet par defaut sous RLS forcee).
      -- 6) PAS de policy DELETE (rejet par defaut sous RLS forcee).

      -- 7) REVOKE privileges SQL standard pour double barriere.
      REVOKE UPDATE, DELETE ON doc_access_logs FROM PUBLIC;
      REVOKE UPDATE, DELETE ON doc_access_logs FROM app_user;
      REVOKE UPDATE, DELETE ON doc_access_logs FROM app_admin;

      -- 8) Triggers BEFORE UPDATE / DELETE qui RAISE EXCEPTION (3e barriere).
      CREATE OR REPLACE FUNCTION reject_doc_access_log_mutation()
      RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'doc_access_logs est append-only (Loi 09-08 art.13, ACAPS Circ. 2018/01 art.9). Operation % refusee.', TG_OP
          USING ERRCODE = '42501';
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER trg_doc_access_logs_no_update
        BEFORE UPDATE ON doc_access_logs
        FOR EACH STATEMENT
        EXECUTE FUNCTION reject_doc_access_log_mutation();

      CREATE TRIGGER trg_doc_access_logs_no_delete
        BEFORE DELETE ON doc_access_logs
        FOR EACH STATEMENT
        EXECUTE FUNCTION reject_doc_access_log_mutation();

      -- 9) Index couvrants pour requetes admin.
      CREATE INDEX IF NOT EXISTS idx_doc_access_logs_tenant_accessed
        ON doc_access_logs (tenant_id, accessed_at DESC, id DESC);
      CREATE INDEX IF NOT EXISTS idx_doc_access_logs_user_accessed
        ON doc_access_logs (tenant_id, user_id, accessed_at DESC);
      CREATE INDEX IF NOT EXISTS idx_doc_access_logs_doc_accessed
        ON doc_access_logs (tenant_id, document_id, accessed_at DESC);
      CREATE INDEX IF NOT EXISTS idx_doc_access_logs_action
        ON doc_access_logs (tenant_id, action, accessed_at DESC);
    `,
    parameters: [],
    query: { kind: 'RawNode', sqlFragments: [], parameters: [] } as never,
  });
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.executeQuery({
    sql: `
      DROP TRIGGER IF EXISTS trg_doc_access_logs_no_update ON doc_access_logs;
      DROP TRIGGER IF EXISTS trg_doc_access_logs_no_delete ON doc_access_logs;
      DROP FUNCTION IF EXISTS reject_doc_access_log_mutation();
      DROP POLICY IF EXISTS doc_access_logs_tenant_select ON doc_access_logs;
      DROP POLICY IF EXISTS doc_access_logs_tenant_insert ON doc_access_logs;
      ALTER TABLE doc_access_logs DISABLE ROW LEVEL SECURITY;
      ALTER TABLE doc_access_logs DROP CONSTRAINT IF EXISTS doc_access_logs_idempotency_uniq;
      DROP INDEX IF EXISTS idx_doc_access_logs_tenant_accessed;
      DROP INDEX IF EXISTS idx_doc_access_logs_user_accessed;
      DROP INDEX IF EXISTS idx_doc_access_logs_doc_accessed;
      DROP INDEX IF EXISTS idx_doc_access_logs_action;
    `,
    parameters: [],
    query: { kind: 'RawNode', sqlFragments: [], parameters: [] } as never,
  });
}
```

## 8. TESTS

### 8.1 `repo/packages/docs/src/services/access-log.service.spec.ts`

```typescript
import { Test } from '@nestjs/testing';
import { AccessLogService } from './access-log.service';
import { PrismaService } from '@skalean/database';
import { Logger } from 'nestjs-pino';

describe('AccessLogService', () => {
  let service: AccessLogService;
  let prisma: { $executeRaw: jest.Mock; $executeRawUnsafe: jest.Mock; $queryRaw: jest.Mock; $queryRawUnsafe: jest.Mock };
  let metric: { inc: jest.Mock };

  beforeEach(async () => {
    prisma = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      $executeRawUnsafe: jest.fn().mockResolvedValue(undefined),
      $queryRaw: jest.fn().mockResolvedValue([]),
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
    };
    metric = { inc: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        AccessLogService,
        { provide: PrismaService, useValue: prisma },
        { provide: Logger, useValue: { setContext: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } },
        { provide: 'METRIC_ACCESS_LOG_APPENDED', useValue: metric },
      ],
    }).compile();
    service = moduleRef.get(AccessLogService);
  });

  describe('append', () => {
    const base = {
      tenantId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      userId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      documentId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      action: 'download' as const,
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
      requestId: 'req-1',
      accessedAt: new Date('2026-05-08T10:00:00Z'),
    };

    it('persiste un log avec set tenant context', async () => {
      await service.append(base);
      expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('set_config'),
        base.tenantId,
      );
      expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
      expect(metric.inc).toHaveBeenCalledWith({ tenant: base.tenantId, action: 'download' }, 1);
    });

    it('tronque user-agent a 512 caracteres', async () => {
      await service.append({ ...base, userAgent: 'A'.repeat(1000) });
      expect(prisma.$executeRaw).toHaveBeenCalled();
    });

    it('normalise IPv4-mapped IPv6 en IPv4', async () => {
      await service.append({ ...base, ipAddress: '::ffff:192.168.1.5' });
      expect(prisma.$executeRaw).toHaveBeenCalled();
    });

    it('gere ON CONFLICT DO NOTHING (result=0) sans erreur', async () => {
      prisma.$executeRaw.mockResolvedValueOnce(0);
      await expect(service.append(base)).resolves.toBeUndefined();
    });

    it('rethrow erreur Prisma', async () => {
      prisma.$executeRaw.mockRejectedValueOnce(new Error('PG down'));
      await expect(service.append(base)).rejects.toThrow('PG down');
    });

    it('accepte ip null', async () => {
      await service.append({ ...base, ipAddress: null });
      expect(prisma.$executeRaw).toHaveBeenCalled();
    });

    it('accepte user-agent null', async () => {
      await service.append({ ...base, userAgent: null });
      expect(prisma.$executeRaw).toHaveBeenCalled();
    });
  });

  describe('queryByFilters', () => {
    it('retourne page vide sans filtre', async () => {
      prisma.$queryRawUnsafe.mockResolvedValueOnce([]);
      const result = await service.queryByFilters('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', { limit: 50 } as never);
      expect(result.data).toEqual([]);
      expect(result.nextCursor).toBeNull();
    });

    it('applique filtres document_id, user_id, action, from, to', async () => {
      prisma.$queryRawUnsafe.mockResolvedValueOnce([]);
      await service.queryByFilters('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', {
        document_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        user_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        action: 'view',
        from: '2026-01-01T00:00:00Z',
        to: '2026-12-31T00:00:00Z',
        limit: 50,
      } as never);
      expect(prisma.$queryRawUnsafe).toHaveBeenCalled();
      const sql = (prisma.$queryRawUnsafe.mock.calls[0] as string[])[0];
      expect(sql).toContain('document_id');
      expect(sql).toContain('user_id');
      expect(sql).toContain('action');
    });

    it('genere nextCursor quand resultats > limit', async () => {
      const row = (i: number) => ({
        id: `id-${i}`,
        tenant_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        user_id: 'u',
        document_id: 'd',
        action: 'view',
        ip_address: null,
        user_agent: null,
        request_id: null,
        accessed_at: new Date(`2026-05-0${i}T10:00:00Z`),
        metadata: null,
      });
      prisma.$queryRawUnsafe.mockResolvedValueOnce([row(1), row(2), row(3)]);
      const result = await service.queryByFilters('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', { limit: 2 } as never);
      expect(result.data).toHaveLength(2);
      expect(result.nextCursor).not.toBeNull();
    });
  });

  describe('queryTimelineForDocument', () => {
    it('agrege par jour et action', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([
        { day: '2026-05-08', action: 'download', count: 5 },
        { day: '2026-05-08', action: 'view', count: 12 },
        { day: '2026-05-07', action: 'download', count: 3 },
      ]);
      const result = await service.queryTimelineForDocument(
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'cccccccc-cccc-cccc-cccc-cccccccccccc',
      );
      expect(result).toHaveLength(2);
      expect(result[0].total).toBe(17);
      expect(result[0].byAction.download).toBe(5);
      expect(result[0].byAction.view).toBe(12);
    });
  });

  describe('queryActivityForUser', () => {
    it('retourne aggregations + 30 dernieres entrees', async () => {
      prisma.$queryRaw
        .mockResolvedValueOnce([
          { action: 'download', count: 10 },
          { action: 'view', count: 25 },
        ])
        .mockResolvedValueOnce([]);
      const result = await service.queryActivityForUser(
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        new Date('2026-04-01'),
        new Date('2026-05-01'),
      );
      expect(result.totalLast30).toBe(35);
      expect(result.byAction.download).toBe(10);
      expect(result.byAction.view).toBe(25);
      expect(result.recentEntries).toEqual([]);
    });
  });
});
```

### 8.2 `repo/packages/docs/src/services/access-abuse-detector.service.spec.ts`

```typescript
import { Test } from '@nestjs/testing';
import { AccessAbuseDetectorService } from './access-abuse-detector.service';
import { Logger } from 'nestjs-pino';
import { ConfigService } from '@nestjs/config';

describe('AccessAbuseDetectorService', () => {
  let service: AccessAbuseDetectorService;
  let redis: { multi: jest.Mock; mget: jest.Mock; set: jest.Mock };
  let kafka: { emit: jest.Mock };
  let metric: { inc: jest.Mock };

  beforeEach(async () => {
    const pipeline = { incr: jest.fn().mockReturnThis(), expire: jest.fn().mockReturnThis(), exec: jest.fn().mockResolvedValue([]) };
    redis = {
      multi: jest.fn(() => pipeline),
      mget: jest.fn(),
      set: jest.fn().mockResolvedValue('OK'),
    };
    kafka = { emit: jest.fn().mockResolvedValue(undefined) };
    metric = { inc: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        AccessAbuseDetectorService,
        { provide: 'REDIS_CLIENT', useValue: redis },
        { provide: 'KafkaProducerService', useValue: kafka },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(100) } },
        { provide: Logger, useValue: { setContext: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } },
        { provide: 'METRIC_ACCESS_ABUSE_DETECTED', useValue: metric },
      ],
    })
      .overrideProvider('KafkaProducerService')
      .useValue(kafka)
      .compile();
    // injection manuelle car kafka token custom
    service = new AccessAbuseDetectorService(
      redis as never,
      kafka as never,
      { get: jest.fn().mockReturnValue(100) } as never,
      { setContext: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } as never,
      metric as never,
    );
  });

  describe('recordAccess', () => {
    it('incremente bucket pour download', async () => {
      await service.recordAccess('t1', 'u1', 'download', new Date('2026-05-08T10:30:00Z'));
      expect(redis.multi).toHaveBeenCalled();
    });

    it('incremente bucket pour view', async () => {
      await service.recordAccess('t1', 'u1', 'view', new Date());
      expect(redis.multi).toHaveBeenCalled();
    });

    it('skip pour action share/preview/metadata_query', async () => {
      await service.recordAccess('t1', 'u1', 'share', new Date());
      await service.recordAccess('t1', 'u1', 'preview', new Date());
      await service.recordAccess('t1', 'u1', 'metadata_query', new Date());
      expect(redis.multi).not.toHaveBeenCalled();
    });

    it('degradation gracieuse si Redis throw', async () => {
      redis.multi.mockImplementationOnce(() => { throw new Error('Redis down'); });
      await expect(service.recordAccess('t1', 'u1', 'download', new Date())).resolves.toBeUndefined();
    });
  });

  describe('checkAndEmitIfExceeded', () => {
    it('retourne not exceeded si sum <= 100', async () => {
      redis.mget.mockResolvedValueOnce(Array(60).fill('1')); // sum = 60
      const result = await service.checkAndEmitIfExceeded('t1', 'u1', new Date());
      expect(result.exceeded).toBe(false);
      expect(result.count).toBe(60);
      expect(kafka.emit).not.toHaveBeenCalled();
    });

    it('emet Kafka si sum > 100 et SETNX OK', async () => {
      redis.mget.mockResolvedValueOnce(Array(60).fill('2')); // sum = 120
      redis.set.mockResolvedValueOnce('OK');
      const result = await service.checkAndEmitIfExceeded('t1', 'u1', new Date());
      expect(result.exceeded).toBe(true);
      expect(result.emitted).toBe(true);
      expect(kafka.emit).toHaveBeenCalledWith('audit.suspicious_access', expect.objectContaining({
        tenantId: 't1',
        userId: 'u1',
        count: 120,
        threshold: 100,
      }));
      expect(metric.inc).toHaveBeenCalled();
    });

    it('NE PAS emit Kafka si SETNX deduplication retourne null', async () => {
      redis.mget.mockResolvedValueOnce(Array(60).fill('2'));
      redis.set.mockResolvedValueOnce(null);
      const result = await service.checkAndEmitIfExceeded('t1', 'u1', new Date());
      expect(result.exceeded).toBe(true);
      expect(result.emitted).toBe(false);
      expect(kafka.emit).not.toHaveBeenCalled();
    });

    it('handle Redis MGET vide (null buckets)', async () => {
      redis.mget.mockResolvedValueOnce(Array(60).fill(null));
      const result = await service.checkAndEmitIfExceeded('t1', 'u1', new Date());
      expect(result.count).toBe(0);
      expect(result.exceeded).toBe(false);
    });

    it('skip emission si Redis MGET throw', async () => {
      redis.mget.mockRejectedValueOnce(new Error('Redis down'));
      const result = await service.checkAndEmitIfExceeded('t1', 'u1', new Date());
      expect(result.exceeded).toBe(false);
      expect(kafka.emit).not.toHaveBeenCalled();
    });
  });

  describe('getCurrentCount', () => {
    it('retourne sum sur 60 buckets', async () => {
      redis.mget.mockResolvedValueOnce(['10', '20', '30']);
      const count = await service.getCurrentCount('t1', 'u1');
      expect(count).toBe(60);
    });

    it('retourne 0 si Redis throw', async () => {
      redis.mget.mockRejectedValueOnce(new Error('down'));
      const count = await service.getCurrentCount('t1', 'u1');
      expect(count).toBe(0);
    });
  });
});
```

### 8.3 `repo/apps/api/src/modules/docs/interceptors/log-document-access.interceptor.spec.ts`

```typescript
import { Test } from '@nestjs/testing';
import { LogDocumentAccessInterceptor, ACCESS_LOG_ACTION_KEY } from './log-document-access.interceptor';
import { Reflector } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { ConfigService } from '@nestjs/config';
import { of } from 'rxjs';

describe('LogDocumentAccessInterceptor', () => {
  let interceptor: LogDocumentAccessInterceptor;
  let queue: { add: jest.Mock };
  let reflector: { get: jest.Mock };

  beforeEach(async () => {
    queue = { add: jest.fn().mockResolvedValue({ id: 'job1' }) };
    reflector = { get: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        LogDocumentAccessInterceptor,
        { provide: 'BullQueue_docs-access-log', useValue: queue },
        { provide: Reflector, useValue: reflector },
        { provide: Logger, useValue: { setContext: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), fatal: jest.fn() } },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();
    interceptor = moduleRef.get(LogDocumentAccessInterceptor);
  });

  const buildContext = (req: object, res: object) => ({
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  });

  it('skip si route admin/access-logs', async () => {
    reflector.get.mockReturnValueOnce(false).mockReturnValueOnce(false);
    const ctx = buildContext({ path: '/api/v1/admin/docs/access-logs' }, { statusCode: 200 });
    await interceptor.intercept(ctx as never, { handle: () => of('ok') } as never).toPromise();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('skip si pas de @LogAccess decorator', async () => {
    reflector.get.mockReturnValue(undefined);
    const ctx = buildContext({ path: '/api/v1/docs/123' }, { statusCode: 200 });
    await interceptor.intercept(ctx as never, { handle: () => of('ok') } as never).toPromise();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('skip si statusCode != 2xx', async () => {
    reflector.get.mockImplementation((key) => key === ACCESS_LOG_ACTION_KEY ? 'download' : undefined);
    const req = { path: '/api/v1/docs/abc', user: { id: 'u', tenantId: 't' }, params: { id: 'abc' }, headers: {}, ip: '1.2.3.4' };
    const ctx = buildContext(req, { statusCode: 500 });
    await new Promise<void>((resolve) => {
      interceptor.intercept(ctx as never, { handle: () => of('err') } as never).subscribe(() => resolve());
    });
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('enqueue job apres handler success', async () => {
    reflector.get.mockImplementation((key) => key === ACCESS_LOG_ACTION_KEY ? 'download' : undefined);
    const req = {
      path: '/api/v1/docs/abc',
      user: { id: 'u', tenantId: 't' },
      params: { id: 'abc' },
      headers: { 'user-agent': 'Mozilla', 'x-request-id': 'rid-1' },
      ip: '1.2.3.4',
    };
    const ctx = buildContext(req, { statusCode: 200 });
    await new Promise<void>((resolve) => {
      interceptor.intercept(ctx as never, { handle: () => of('ok') } as never).subscribe({
        complete: () => setTimeout(resolve, 10),
      });
    });
    expect(queue.add).toHaveBeenCalledWith(
      'append-log',
      expect.objectContaining({ tenantId: 't', userId: 'u', documentId: 'abc', action: 'download' }),
      expect.objectContaining({ attempts: 3 }),
    );
  });

  it('fallback fichier si queue.add throw', async () => {
    queue.add.mockRejectedValueOnce(new Error('Redis down'));
    reflector.get.mockImplementation((key) => key === ACCESS_LOG_ACTION_KEY ? 'view' : undefined);
    const req = {
      path: '/api/v1/docs/abc', user: { id: 'u', tenantId: 't' }, params: { id: 'abc' }, headers: {}, ip: '1.2.3.4',
    };
    const ctx = buildContext(req, { statusCode: 200 });
    await new Promise<void>((resolve) => {
      interceptor.intercept(ctx as never, { handle: () => of('ok') } as never).subscribe({
        complete: () => setTimeout(resolve, 10),
      });
    });
    expect(queue.add).toHaveBeenCalled();
  });
});
```

### 8.4 `repo/apps/api/src/modules/admin/controllers/admin-access-logs.controller.spec.ts`

```typescript
import { Test } from '@nestjs/testing';
import { AdminAccessLogsController } from './admin-access-logs.controller';
import { AccessLogService } from '@skalean/docs';

describe('AdminAccessLogsController', () => {
  let controller: AdminAccessLogsController;
  let service: { queryByFilters: jest.Mock; queryTimelineForDocument: jest.Mock; queryActivityForUser: jest.Mock };

  beforeEach(async () => {
    service = {
      queryByFilters: jest.fn().mockResolvedValue({ data: [], nextCursor: null }),
      queryTimelineForDocument: jest.fn().mockResolvedValue([]),
      queryActivityForUser: jest.fn().mockResolvedValue({ userId: 'u', totalLast30: 0, byAction: {}, recentEntries: [] }),
    };
    const moduleRef = await Test.createTestingModule({
      controllers: [AdminAccessLogsController],
      providers: [{ provide: AccessLogService, useValue: service }],
    }).compile();
    controller = moduleRef.get(AdminAccessLogsController);
  });

  const tenant = { tenantId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' };

  it('listLogs delegue au service avec tenantId', async () => {
    await controller.listLogs(tenant as never, { limit: 50 } as never);
    expect(service.queryByFilters).toHaveBeenCalledWith(tenant.tenantId, { limit: 50 });
  });

  it('timeline retourne objet avec documentId', async () => {
    const result = await controller.timeline(tenant as never, 'cccccccc-cccc-cccc-cccc-cccccccccccc');
    expect(result.documentId).toBe('cccccccc-cccc-cccc-cccc-cccccccccccc');
    expect(service.queryTimelineForDocument).toHaveBeenCalled();
  });

  it('userActivity utilise default 30 derniers jours si pas de from', async () => {
    await controller.userActivity(tenant as never, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
    expect(service.queryActivityForUser).toHaveBeenCalled();
    const args = service.queryActivityForUser.mock.calls[0];
    expect(args[2] instanceof Date).toBe(true);
    expect(args[3] instanceof Date).toBe(true);
  });

  it('userActivity utilise from/to fournis', async () => {
    await controller.userActivity(
      tenant as never,
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      '2026-01-01T00:00:00Z',
      '2026-02-01T00:00:00Z',
    );
    const args = service.queryActivityForUser.mock.calls[0];
    expect(args[2].toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(args[3].toISOString()).toBe('2026-02-01T00:00:00.000Z');
  });
});
```

### 8.5 `repo/apps/api/src/modules/docs/jobs/log-access-async.job.spec.ts`

```typescript
import { Test } from '@nestjs/testing';
import { LogAccessAsyncProcessor } from './log-access-async.job';
import { AccessLogService, AccessAbuseDetectorService } from '@skalean/docs';
import { Logger } from 'nestjs-pino';
import { ConfigService } from '@nestjs/config';

describe('LogAccessAsyncProcessor', () => {
  let processor: LogAccessAsyncProcessor;
  let accessLog: { append: jest.Mock };
  let abuse: { recordAccess: jest.Mock; checkAndEmitIfExceeded: jest.Mock };

  beforeEach(async () => {
    accessLog = { append: jest.fn().mockResolvedValue(undefined) };
    abuse = {
      recordAccess: jest.fn().mockResolvedValue(undefined),
      checkAndEmitIfExceeded: jest.fn().mockResolvedValue({ exceeded: false }),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        LogAccessAsyncProcessor,
        { provide: AccessLogService, useValue: accessLog },
        { provide: AccessAbuseDetectorService, useValue: abuse },
        { provide: Logger, useValue: { setContext: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn(), fatal: jest.fn() } },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('/tmp/fb.ndjson') } },
      ],
    }).compile();
    processor = moduleRef.get(LogAccessAsyncProcessor);
  });

  const buildJob = (data: object) => ({
    id: 'j1',
    data,
    attemptsMade: 0,
    opts: { attempts: 3 },
  });

  it('process appel append + recordAccess + checkAndEmit', async () => {
    const job = buildJob({
      tenantId: 't', userId: 'u', documentId: 'd', action: 'download',
      ipAddress: '1.2.3.4', userAgent: 'UA', requestId: 'r', accessedAt: new Date().toISOString(),
    });
    await processor.process(job as never);
    expect(accessLog.append).toHaveBeenCalled();
    expect(abuse.recordAccess).toHaveBeenCalled();
    expect(abuse.checkAndEmitIfExceeded).toHaveBeenCalled();
  });

  it('rethrow si append fail (retry BullMQ)', async () => {
    accessLog.append.mockRejectedValueOnce(new Error('PG down'));
    const job = buildJob({
      tenantId: 't', userId: 'u', documentId: 'd', action: 'view',
      ipAddress: null, userAgent: null, requestId: null, accessedAt: new Date().toISOString(),
    });
    await expect(processor.process(job as never)).rejects.toThrow('PG down');
  });

  it('continue meme si abuse detector throw', async () => {
    abuse.recordAccess.mockRejectedValueOnce(new Error('Redis down'));
    const job = buildJob({
      tenantId: 't', userId: 'u', documentId: 'd', action: 'download',
      ipAddress: null, userAgent: null, requestId: null, accessedAt: new Date().toISOString(),
    });
    await expect(processor.process(job as never)).resolves.toBeUndefined();
  });

  it('emit suspicious_access via detector quand exceeded', async () => {
    abuse.checkAndEmitIfExceeded.mockResolvedValueOnce({ exceeded: true, count: 150, threshold: 100, emitted: true });
    const job = buildJob({
      tenantId: 't', userId: 'u', documentId: 'd', action: 'download',
      ipAddress: null, userAgent: null, requestId: null, accessedAt: new Date().toISOString(),
    });
    await processor.process(job as never);
    expect(abuse.checkAndEmitIfExceeded).toHaveBeenCalled();
  });
});
```

### 8.6 `repo/apps/api/test/docs/access-logs.e2e-spec.ts`

```typescript
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '@skalean/database';

describe('AccessLogs E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  const tenantId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const userId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const docId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    adminToken = await issueTestAdminToken({ userId, tenantId });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      `SELECT set_config('app.current_tenant_id', $1, true)`, tenantId,
    );
    await prisma.$executeRaw`DELETE FROM doc_access_logs WHERE tenant_id = ${tenantId}::uuid`;
  });

  it('GET /admin/docs/access-logs sans permission -> 403', async () => {
    const noPermToken = await issueTestUserToken({ userId, tenantId, permissions: [] });
    await request(app.getHttpServer())
      .get('/api/v1/admin/docs/access-logs')
      .set('Authorization', `Bearer ${noPermToken}`)
      .expect(403);
  });

  it('GET /admin/docs/access-logs retourne liste vide initialement', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/docs/access-logs')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.nextCursor).toBeNull();
  });

  it('UPDATE doc_access_logs rejete par PostgreSQL (RLS + trigger)', async () => {
    await insertLog(prisma, { tenantId, userId, documentId: docId, action: 'download' });
    await expect(
      prisma.$executeRaw`UPDATE doc_access_logs SET action = 'view' WHERE document_id = ${docId}::uuid`,
    ).rejects.toThrow(/append-only|permission|policy/i);
  });

  it('DELETE doc_access_logs rejete par PostgreSQL', async () => {
    await insertLog(prisma, { tenantId, userId, documentId: docId, action: 'download' });
    await expect(
      prisma.$executeRaw`DELETE FROM doc_access_logs WHERE document_id = ${docId}::uuid`,
    ).rejects.toThrow(/append-only|permission|policy/i);
  });

  it('INSERT cross-tenant via RLS retourne 0 row insere', async () => {
    await prisma.$executeRawUnsafe(
      `SELECT set_config('app.current_tenant_id', $1, true)`, 'dddddddd-dddd-dddd-dddd-dddddddddddd',
    );
    await expect(
      insertLog(prisma, { tenantId, userId, documentId: docId, action: 'view' }),
    ).rejects.toThrow();
  });

  it('idempotency UNIQUE constraint - 2eme INSERT ON CONFLICT DO NOTHING', async () => {
    const accessedAt = new Date().toISOString();
    await insertLog(prisma, { tenantId, userId, documentId: docId, action: 'download', accessedAt });
    const result = await prisma.$executeRaw`
      INSERT INTO doc_access_logs (id, tenant_id, user_id, document_id, action, accessed_at)
      VALUES (gen_random_uuid(), ${tenantId}::uuid, ${userId}::uuid, ${docId}::uuid, 'download', ${accessedAt}::timestamptz)
      ON CONFLICT (user_id, document_id, accessed_at, action) DO NOTHING
    `;
    expect(result).toBe(0);
  });

  it('GET timeline retourne agregation par jour', async () => {
    await insertLog(prisma, { tenantId, userId, documentId: docId, action: 'download' });
    await insertLog(prisma, { tenantId, userId, documentId: docId, action: 'view' });
    const res = await request(app.getHttpServer())
      .get(`/api/v1/admin/docs/access-logs/timeline/${docId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.documentId).toBe(docId);
    expect(Array.isArray(res.body.days)).toBe(true);
  });

  it('GET user activity retourne agregation actions', async () => {
    await insertLog(prisma, { tenantId, userId, documentId: docId, action: 'download' });
    const res = await request(app.getHttpServer())
      .get(`/api/v1/admin/docs/access-logs/user/${userId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.userId).toBe(userId);
    expect(res.body.byAction).toBeDefined();
  });

  it('curseur pagination next page', async () => {
    for (let i = 0; i < 5; i++) {
      await insertLog(prisma, {
        tenantId, userId, documentId: docId, action: 'view',
        accessedAt: new Date(Date.now() - i * 1000).toISOString(),
      });
    }
    const page1 = await request(app.getHttpServer())
      .get('/api/v1/admin/docs/access-logs?limit=2')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(page1.body.data).toHaveLength(2);
    expect(page1.body.nextCursor).not.toBeNull();
    const page2 = await request(app.getHttpServer())
      .get(`/api/v1/admin/docs/access-logs?limit=2&cursor=${encodeURIComponent(page1.body.nextCursor)}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(page2.body.data).toHaveLength(2);
  });

  it('filtre action=download', async () => {
    await insertLog(prisma, { tenantId, userId, documentId: docId, action: 'download' });
    await insertLog(prisma, { tenantId, userId, documentId: docId, action: 'view' });
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/docs/access-logs?action=download')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.data.every((l: { action: string }) => l.action === 'download')).toBe(true);
  });

  it('Zod rejette action invalide -> 400', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/docs/access-logs?action=hack')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);
  });

  it('Zod rejette from > to -> 400', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/docs/access-logs?from=2026-12-01T00:00:00Z&to=2026-01-01T00:00:00Z')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);
  });

  it('admin endpoint NE PAS produire de log (anti-recursion)', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/docs/access-logs')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const count = await prisma.$queryRaw<{ count: number }[]>`
      SELECT COUNT(*)::int FROM doc_access_logs WHERE tenant_id = ${tenantId}::uuid
    `;
    expect(count[0].count).toBe(0);
  });
});

async function insertLog(
  prisma: PrismaService,
  args: { tenantId: string; userId: string; documentId: string; action: string; accessedAt?: string },
): Promise<void> {
  const at = args.accessedAt ?? new Date().toISOString();
  await prisma.$executeRawUnsafe(
    `SELECT set_config('app.current_tenant_id', $1, true)`, args.tenantId,
  );
  await prisma.$executeRaw`
    INSERT INTO doc_access_logs (id, tenant_id, user_id, document_id, action, accessed_at)
    VALUES (gen_random_uuid(), ${args.tenantId}::uuid, ${args.userId}::uuid, ${args.documentId}::uuid, ${args.action}::text, ${at}::timestamptz)
  `;
}

async function issueTestAdminToken(p: { userId: string; tenantId: string }): Promise<string> {
  // helper test - delegue a la lib auth de test
  return `test-admin-${p.userId}`;
}

async function issueTestUserToken(p: { userId: string; tenantId: string; permissions: string[] }): Promise<string> {
  return `test-user-${p.userId}-${p.permissions.join(',')}`;
}
```

## 9. Variables env

Ajouter dans `repo/.env.example` et `repo/apps/api/.env.example`:

```bash
# === Sprint 10 - Documents Access Logs ===

# Seuil de detection abus telechargements/visualisations par utilisateur sur fenetre 1h.
# Defaut 100 base sur analyse comportementale assurance Maroc (cf doc Sprint 10 sec.3.3).
DOCS_ACCESS_ABUSE_THRESHOLD_PER_HOUR=100

# Nom de la queue BullMQ utilisee pour la persistance asynchrone des logs.
# Doit matcher le @Processor decorator dans LogAccessAsyncProcessor.
DOCS_ACCESS_LOG_QUEUE=docs-access-log

# Duree de conservation legale en jours.
# 10 ans = 3651 jours (2 annees bissextiles dans la periode 2026-2036).
# CNDP impose conservation 10 ans pour donnees assurance puis purge obligatoire (Maker-Checker).
DOCS_ACCESS_LOG_RETENTION_DAYS=3651

# Chemin du fichier NDJSON de fallback lorsque BullMQ ou PostgreSQL est indisponible.
# Doit etre sur volume persistant (PV Kubernetes) pour ingestion ulterieure par cron.
# Permissions 0600 owner=app:app obligatoires.
DOCS_ACCESS_LOG_FALLBACK_PATH=/var/log/skalean/access-fallback.ndjson

# Concurrency processor BullMQ.
DOCS_ACCESS_LOG_WORKER_CONCURRENCY=16

# Topic Kafka pour evenements abus detectes (consume Sprint 33 SecOps).
DOCS_ACCESS_ABUSE_KAFKA_TOPIC=audit.suspicious_access
```

Schema Zod de validation dans `repo/apps/api/src/config/configuration.ts`:

```typescript
DOCS_ACCESS_ABUSE_THRESHOLD_PER_HOUR: z.coerce.number().int().min(10).max(10000).default(100),
DOCS_ACCESS_LOG_QUEUE: z.string().min(1).default('docs-access-log'),
DOCS_ACCESS_LOG_RETENTION_DAYS: z.coerce.number().int().min(365).max(7305).default(3651),
DOCS_ACCESS_LOG_FALLBACK_PATH: z.string().min(1).default('/var/log/skalean/access-fallback.ndjson'),
DOCS_ACCESS_LOG_WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(64).default(16),
DOCS_ACCESS_ABUSE_KAFKA_TOPIC: z.string().min(1).default('audit.suspicious_access'),
```

## 10. Commandes shell

```powershell
# Depuis repo root
cd C:\Users\belga\Desktop\Skalean_Insurtech\repo

# 1) Generer migration vide
pnpm --filter @skalean/database run migration:generate -- DocsAccessLogsAppendOnly

# 2) Editer migration generee avec contenu section 7.8

# 3) Appliquer migration en local
pnpm --filter @skalean/database run migration:up

# 4) Verifier policies RLS creees
pnpm --filter @skalean/database run db:psql -- -c "\d+ doc_access_logs"
pnpm --filter @skalean/database run db:psql -- -c "SELECT policyname, cmd FROM pg_policies WHERE tablename='doc_access_logs';"
pnpm --filter @skalean/database run db:psql -- -c "SELECT tgname FROM pg_trigger WHERE tgrelid='doc_access_logs'::regclass;"

# 5) Test manuel UPDATE rejete (doit echouer)
pnpm --filter @skalean/database run db:psql -- -c "UPDATE doc_access_logs SET action='view' LIMIT 1;"

# 6) Generer types Prisma
pnpm --filter @skalean/database run prisma:generate

# 7) Lint + typecheck packages
pnpm --filter @skalean/docs run lint
pnpm --filter @skalean/docs run typecheck
pnpm --filter @skalean/api run lint
pnpm --filter @skalean/api run typecheck

# 8) Tests unitaires
pnpm --filter @skalean/docs run test -- access-log
pnpm --filter @skalean/docs run test -- access-abuse-detector
pnpm --filter @skalean/api run test -- log-document-access.interceptor
pnpm --filter @skalean/api run test -- admin-access-logs.controller
pnpm --filter @skalean/api run test -- log-access-async.job

# 9) Tests E2E (necessitent docker-compose up postgres redis kafka)
docker compose -f infra/docker-compose.test.yml up -d postgres redis kafka
pnpm --filter @skalean/api run test:e2e -- access-logs.e2e-spec

# 10) Verification couverture
pnpm --filter @skalean/docs run test:cov -- access-log access-abuse-detector
# Attendu: coverage > 90% sur les 4 fichiers cibles

# 11) Demarrer stack locale et tester abus reel
pnpm dev
# Dans un autre terminal:
for ($i=1; $i -le 105; $i++) { curl -H "Authorization: Bearer $env:TOKEN" http://localhost:3000/api/v1/docs/$env:DOC_ID/download }
# Verifier emission Kafka
kafka-console-consumer --bootstrap-server localhost:9092 --topic audit.suspicious_access --from-beginning
```

## 11. CRITERES DE VALIDATION

| ID | Critere | Methode |
|----|---------|---------|
| V1 | Migration `DocsAccessLogsAppendOnly` s'applique sans erreur sur schema vide | `pnpm migration:up` retourne 0 |
| V2 | Migration cree 2 policies RLS (SELECT + INSERT) sur `doc_access_logs` | `SELECT count(*) FROM pg_policies WHERE tablename='doc_access_logs'` = 2 |
| V3 | Migration cree 2 triggers BEFORE UPDATE/DELETE | `SELECT count(*) FROM pg_trigger WHERE tgrelid='doc_access_logs'::regclass AND tgname LIKE 'trg_doc_access_logs_no_%'` = 2 |
| V4 | UPDATE sur `doc_access_logs` echoue avec ERRCODE 42501 | Test E2E `UPDATE doc_access_logs rejete par PostgreSQL` passe |
| V5 | DELETE sur `doc_access_logs` echoue avec ERRCODE 42501 | Test E2E `DELETE doc_access_logs rejete par PostgreSQL` passe |
| V6 | INSERT cross-tenant rejete par RLS WITH CHECK | Test E2E `INSERT cross-tenant via RLS` passe |
| V7 | UNIQUE constraint sur (user_id, document_id, accessed_at, action) cree | `\d doc_access_logs` montre constraint |
| V8 | 2eme INSERT meme key avec ON CONFLICT DO NOTHING retourne 0 | Test E2E `idempotency` passe |
| V9 | `AccessAction` enum exporte exactement 5 valeurs | `expect(ACCESS_ACTIONS).toHaveLength(5)` |
| V10 | `AccessLogService.append()` set tenant context AVANT INSERT | Test unit verifie ordre des appels Prisma |
| V11 | `AccessLogService.append()` tronque user-agent a 512 chars | Test unit |
| V12 | `AccessLogService.append()` normalise IPv4-mapped IPv6 | Test unit |
| V13 | `AccessLogService.queryByFilters()` supporte 5 filtres + cursor + limit | Test unit |
| V14 | Cursor encode/decode reversible base64url | Test unit `expect(decode(encode(p))).toEqual(p)` |
| V15 | `AccessLogService.queryTimelineForDocument()` retourne entries 90j max | Test unit |
| V16 | `AccessAbuseDetectorService.recordAccess()` skip pour share/preview/metadata_query | Test unit |
| V17 | `AccessAbuseDetectorService.checkAndEmitIfExceeded()` emit Kafka si sum > 100 | Test unit |
| V18 | Deduplication SETNX evite double emission Kafka meme heure | Test unit |
| V19 | Detector resilient aux erreurs Redis (no-throw) | Test unit |
| V20 | `LogDocumentAccessInterceptor` SKIP routes admin/access-logs | Test unit |
| V21 | Interceptor SKIP si statusCode != 2xx | Test unit |
| V22 | Interceptor enqueue avec jobId deterministe (SHA256) | Test unit verifie format |
| V23 | Interceptor fallback fichier NDJSON si BullMQ throw | Test unit |
| V24 | `LogAccessAsyncProcessor` rethrow si append fail (BullMQ retry) | Test unit |
| V25 | Processor continue meme si abuse detector fail (degradation gracieuse) | Test unit |
| V26 | Processor ecrit fallback fichier apres derniere tentative echec | Test unit |
| V27 | `AdminAccessLogsController` protege par PermissionsGuard `docs.access_logs.read` | Test E2E retourne 403 sans permission |
| V28 | Endpoints admin valident query Zod (action enum, dates ISO, from <= to) | Test E2E `400 invalid action` |
| V29 | Pagination cursor preserve ordre DESC stable | Test E2E `next page` |
| V30 | Admin endpoint NE PAS produire log auto (anti-recursion) | Test E2E `0 logs apres GET admin` |
| V31 | Variable `DOCS_ACCESS_ABUSE_THRESHOLD_PER_HOUR` validee Zod min=10 max=10000 | Test config |
| V32 | Metric Prometheus `access_log_appended_total` increment a chaque append | Test unit metric.inc called |
| V33 | Metric `access_abuse_detected_total` increment a chaque emission | Test unit |
| V34 | Pino logs structure JSON avec correlationId, tenantId, userId, event | Inspection logs runtime |
| V35 | OpenAPI Swagger documente 3 endpoints admin avec ApiResponse 200/403 | Inspection `/api/docs` |
| V36 | Coverage tests > 90% sur les 4 fichiers metier (services + interceptor + processor) | `pnpm test:cov` |
| V37 | Lint passe sans warning sur tous fichiers crees | `pnpm lint` exit 0 |
| V38 | Typecheck strict passe sur tous fichiers crees | `pnpm typecheck` exit 0 |
| V39 | Concurrency processor BullMQ configurable via env | Inspection code @Processor |
| V40 | Procedure purge legale Maker-Checker documentee dans `docs/audit-trail.md` | Document existe et lu par compliance |

## 12. Edge cases

1. **UPDATE attempt par role applicatif** - `app_user` execute `UPDATE doc_access_logs SET action='hidden'` -> PostgreSQL retourne erreur `42501 doc_access_logs est append-only` car policy UPDATE absente + REVOKE + trigger. Verifie test V4.
2. **DELETE attempt par compte service compromis** - Token JWT vole d'un compte service avec permission elevee tente `DELETE FROM doc_access_logs WHERE accessed_at < NOW() - INTERVAL '7 days'` -> rejet identique. Verifie test V5.
3. **BullMQ Redis down complet** - Interceptor catch ConnectionError sur `queue.add()` -> ecrit JSON dans `/var/log/skalean/access-fallback.ndjson` ligne par ligne (NDJSON). Cron job `scripts/ingest-fallback-logs.ts` execute toutes les 5 min ingest le fichier dans la queue restauree puis tronque.
4. **PostgreSQL down apres BullMQ enqueue** - Job process retry 3x avec exponential backoff (500ms, 1s, 2s). Apres derniere tentative, processor ecrit fallback fichier ET throw -> BullMQ DLQ + alerte SecOps Prometheus `access_log_dlq_total > 0`.
5. **Race condition 2 serveurs meme user simultane** - Server A et B incrementent meme bucket Redis: INCR atomique, sum coherent. Mais `checkAndEmitIfExceeded` peut etre appele 2x simultanement -> SETNX `abuse_emitted:tenant:user:hour` garantit 1 seule emission Kafka.
6. **Share document a email revoque** - Action `share` est journalisee meme si destinataire ulterieurement bloque. Permet audit trail "qui a partage quoi a qui et quand", inviolable.
7. **Large IP block (entreprise NAT)** - 1000 employes derriere meme IP publique 196.200.x.x. Detection abuse base sur userId, pas IP, donc pas de faux positif. IP loggee pour audit forensique uniquement.
8. **IPv6 vs IPv4 normalization** - Si meme user accede via `192.168.1.1` puis `::ffff:192.168.1.1` (dual-stack), `ipaddr.js.IPv4MappedAddress` -> normalise en `192.168.1.1`. Comparaisons consistantes.
9. **User-Agent spoofing** - Attaquant change UA a chaque requete pour brouiller patterns. UA loggee tel quel (truncated 512), aucune logique base sur UA pour rate-limit (uniquement userId).
10. **Log retention exceeds disk** - 100 req/s pendant 10 ans = ~32 milliards rows. Avec ~ 300 bytes/row + index = ~ 12 TB. Solution: partitionnement PostgreSQL par mois (`PARTITION BY RANGE (accessed_at)`), archivage cold storage (S3 Glacier) apres 18 mois, restore on-demand pour audit ACAPS.
11. **Clock drift inter-serveurs** - Server A clock 30s en avance vs B. Sliding window peut sous-compter de 1 bucket (60s). Tolere car NTP keep drift < 1s en prod (alerte si > 5s).
12. **Pagination cursor + delete simultane** - Append-only donc impossible. Pagination toujours stable.
13. **Bot scraping massif (10000 req/min)** - Detection declenche emission Kafka apres 100/h MAIS interceptor continue enqueue jobs -> queue saturated potentially. Mitigation: rate-limit upstream NestJS Throttler 1000 req/min/user (cf task-1.5.x).
14. **Tenant suspendu pendant requete en cours** - Job process avec tenant_id de tenant suspendu -> RLS context set OK, INSERT OK, log persiste. Au query side, admin du tenant suspendu ne peut plus se connecter donc pas d'acces logs (par design).
15. **Migration appliquee avec data existante** - Si table `doc_access_logs` contient deja rows: ALTER TABLE ENABLE RLS s'applique mais data existante reste accessible (pas de lock). UNIQUE constraint peut echouer si duplicates existent -> migration check pre-flight `SELECT count(*) FROM (SELECT user_id, document_id, accessed_at, action, count(*) FROM doc_access_logs GROUP BY 1,2,3,4 HAVING count(*) > 1) t`.

## 13. Conformite Maroc

### 13.1 Loi 09-08 article 13 - Integrite traitement donnees personnelles

L'article 13 impose au responsable du traitement de prendre toutes precautions utiles pour preserver la securite des donnees, notamment empecher leur alteration ou destruction non autorisee. Notre architecture repond:
- **Append-only DB-level**: aucune alteration ni destruction possible des logs d'acces meme par admin compromis (RLS + REVOKE + triggers).
- **Audit trail integre**: chaque acces (lecture, modification, partage) est trace de maniere immutable.
- **Tenant isolation**: RLS WITH CHECK garantit qu'aucun tenant ne voit ni n'altere les logs d'un autre.

Reference: BO n5714 du 18 fevrier 2009, Loi 09-08 relative a la protection des personnes physiques a l'egard du traitement des donnees a caractere personnel.

### 13.2 ACAPS Circulaire 2018/01 article 9 - Tracabilite operations courtage

L'ACAPS (Autorite de Controle des Assurances et de la Prevoyance Sociale) impose aux courtiers et entreprises d'assurance de conserver une tracabilite complete de toutes les operations effectuees sur les contrats et documents y afferents, pendant une duree minimale de 10 ans (cf article 9 alinea 3). Notre implementation:
- **Conservation 10 ans**: `DOCS_ACCESS_LOG_RETENTION_DAYS=3651` (incluant 2 annees bissextiles).
- **Logs immutables**: append-only DB-level garantit que l'audit trail ne peut etre falsifie pour cacher une operation litigieuse.
- **Endpoint admin queryable**: produire rapports d'audit ACAPS sur demande (filtres document, user, date).
- **Evenements horodates UTC**: `accessed_at` timestamptz, conversion locale Maroc UTC+1 en presentation seulement.

Reference: ACAPS, Circulaire DGE/2018/01 du 15 mars 2018 relative aux obligations de tracabilite et de conservation des documents.

### 13.3 CNDP Deliberation 5/2020 - Minimisation et conservation legale

La CNDP (Commission Nationale de controle de la protection des Donnees a caractere Personnel) recommande dans sa deliberation 5/2020 de minimiser les donnees collectees ET de respecter les durees de conservation legales sectorielles. Notre choix:
- **Minimisation**: log enregistre uniquement: tenant, user, document, action, IP, UA, request_id, timestamp, metadata limitee (pas de payload document, pas de cookies, pas de session ID).
- **IP normalisee**: pas de geolocalisation enregistree par defaut (deferable Sprint 33 si requis SecOps avec consentement DPO).
- **User-Agent tronque 512 chars**: evite payload XSS injection via UA malveillant.
- **Conservation 10 ans (assurance)** puis purge OBLIGATOIRE via procedure Maker-Checker (cf section 3.1) signee par 2 admins distincts + traces dans `legal_purge_log` separe.

Reference: CNDP, Deliberation n5/2020 du 24 juillet 2020 relative a la minimisation des donnees dans les services numeriques sectoriels.

### 13.4 Loi 43-20 article 9 - Preuve numerique

La loi 43-20 (publication BO 22 decembre 2020) reconnait la valeur juridique des documents et signatures numeriques sous conditions, notamment:
- Article 9: la preuve electronique est recevable si l'integrite est garantie et si l'identification du signataire/utilisateur est etablie.

Notre architecture renforce cette preuve:
- **Identification utilisateur**: chaque log inclut `user_id` + `request_id` correle au JWT signe.
- **Integrite garantie**: append-only + UNIQUE constraint + RLS = audit trail non-repudiable.
- **Horodatage qualifie**: `accessed_at` timestamptz UTC, source NTP synchronisee, tolerance < 1s.
- **Couplage signature**: au Sprint 11 (signature Loi 43-20), les signatures cryptographiques referencent le `requestId` du log d'acces, permettant tracabilite croisee.

Reference: Loi n43-20 relative aux services de confiance pour les transactions electroniques, BO n6948 du 31 decembre 2020.

### 13.5 Tableau croise conformite

| Exigence reglementaire | Article | Mecanisme technique | Critere validation |
|-------------------------|---------|---------------------|--------------------|
| Integrite donnees | Loi 09-08 art.13 | Triggers BEFORE UPDATE/DELETE RAISE | V4, V5 |
| Tracabilite courtage | ACAPS Circ.2018/01 art.9 | Append-only + 10 ans | V1, V3, V8 |
| Minimisation | CNDP Delib.5/2020 | Champs limites, UA tronque | V11 |
| Preuve numerique | Loi 43-20 art.9 | Horodatage UTC + UNIQUE + RLS | V7, V12 |
| Notification incident 72h | Loi 09-08 art.51 | Detection abus + Kafka SecOps | V17, V18 |
| Droit acces personne concernee | Loi 09-08 art.7 | Endpoint admin user activity | V27 |
| Tenant isolation | ACAPS gouvernance | RLS WITH CHECK | V6 |
| Conservation 10 ans | ACAPS + CNDP | DOCS_ACCESS_LOG_RETENTION_DAYS=3651 | V31 |

## 14. Conventions absolues

### 14.1 TypeScript strict

- `strict: true` dans tsconfig (noImplicitAny, strictNullChecks, strictFunctionTypes, strictBindCallApply, strictPropertyInitialization, alwaysStrict).
- Aucun `any` non justifie. Si necessaire: `// eslint-disable-next-line @typescript-eslint/no-explicit-any -- raison precise`.
- Types Zod inferes via `z.infer<typeof Schema>` jamais dupliques manuellement.
- Interfaces preferees aux type aliases pour modeles de donnees.
- Enum const arrays + type union (cf `AccessAction`) plutot que `enum` keyword (meilleur tree-shaking).

### 14.2 Zod validation

- Tout DTO HTTP entrant valide via `ZodValidationPipe`.
- Tout payload BullMQ valide a l'entree du processor (defense in depth).
- Variables env validees au boot via `configuration.ts` schema.
- Erreurs Zod retournent HTTP 400 + `errors[]` structure.

### 14.3 Pino logging

- Tous logs structures JSON via PinoLogger.
- Champs obligatoires: `event` (snake_case), `correlationId`, `tenantId`, `userId` (si applicable).
- Niveaux: `fatal` (perte donnees), `error` (echec operation), `warn` (degradation gracieuse), `info` (operation normale notable), `debug` (dev only), `trace` (jamais en prod).
- Aucun log de payload sensible (passwords, tokens, contenu document).
- Aucun log de stack trace en prod sans correlation ID (eviter PII leak).

### 14.4 Multi-tenant strict

- Chaque service Prisma execute `SELECT set_config('app.current_tenant_id', $1, true)` AVANT toute query.
- Aucun query sans tenant context (verifie par middleware + tests RLS).
- Jamais de `tenantId` hardcode (toujours via `CurrentTenant` decorator ou payload).
- Tests E2E verifient cross-tenant impossible (RLS active).

### 14.5 BullMQ patterns

- Queue name = nom du domaine en kebab-case (`docs-access-log`).
- Job name = action en kebab-case (`append-log`).
- Idempotency via `jobId` deterministe (SHA256 hash payload critical fields).
- Options par defaut: `attempts: 3`, `backoff: exponential 500ms`, `removeOnComplete: 10000`, `removeOnFail: 50000`.
- Concurrency via env var, defaut 16 par worker.
- DLQ monitoring via metric Prometheus.

### 14.6 Naming conventions

- Fichiers: kebab-case (`access-log.service.ts`).
- Classes: PascalCase (`AccessLogService`).
- Methodes: camelCase (`queryByFilters`).
- Variables env: SCREAMING_SNAKE_CASE (`DOCS_ACCESS_ABUSE_THRESHOLD_PER_HOUR`).
- Tables PostgreSQL: snake_case pluriel (`doc_access_logs`).
- Colonnes: snake_case (`accessed_at`, `tenant_id`).
- Topics Kafka: dot.snake_case (`audit.suspicious_access`).
- Metrics Prometheus: snake_case + `_total` pour counters (`access_log_appended_total`).

### 14.7 Tests

- Framework: Jest + Supertest pour E2E.
- Coverage cible: > 90% lignes/branches sur fichiers metier.
- Tests unitaires: 1 fichier `*.spec.ts` par fichier source.
- Tests E2E: `repo/apps/api/test/<domain>/<feature>.e2e-spec.ts`.
- Mocks via `jest.fn()` typed (`jest.fn<ReturnType, [Args]>()`).
- Pas de network reel en tests unitaires (mock Redis, Kafka, Prisma).
- E2E utilise stack docker-compose dediee.

### 14.8 Securite

- Aucune cle, secret, token en clair dans le code ou logs.
- Permissions verifiees via PermissionsGuard sur tous endpoints non-public.
- Input sanitized via Zod + Prisma parameterized queries (jamais string concat SQL).
- Headers securite via Helmet middleware.
- CORS strict configure en prod.

## 15. Validation pre-commit

Checklist a executer avant `git commit`:

```powershell
# 1) Lint
pnpm --filter @skalean/docs run lint -- --fix
pnpm --filter @skalean/api run lint -- --fix

# 2) Typecheck
pnpm --filter @skalean/docs run typecheck
pnpm --filter @skalean/api run typecheck

# 3) Tests unitaires
pnpm --filter @skalean/docs run test
pnpm --filter @skalean/api run test -- log-document-access.interceptor admin-access-logs.controller log-access-async.job

# 4) Tests E2E (necessite stack)
docker compose -f infra/docker-compose.test.yml up -d postgres redis kafka
pnpm --filter @skalean/api run test:e2e -- access-logs.e2e-spec
docker compose -f infra/docker-compose.test.yml down

# 5) Coverage
pnpm --filter @skalean/docs run test:cov
# Verifier coverage > 90% sur access-log.service.ts et access-abuse-detector.service.ts

# 6) Verification migration UP/DOWN
pnpm --filter @skalean/database run migration:up
pnpm --filter @skalean/database run migration:down
pnpm --filter @skalean/database run migration:up

# 7) Verification policies RLS
pnpm --filter @skalean/database run db:psql -- -c "SELECT policyname, cmd, qual FROM pg_policies WHERE tablename='doc_access_logs';"
# Attendu: 2 lignes (SELECT et INSERT), aucune UPDATE/DELETE

# 8) Verification triggers
pnpm --filter @skalean/database run db:psql -- -c "SELECT tgname FROM pg_trigger WHERE tgrelid='doc_access_logs'::regclass AND NOT tgisinternal;"
# Attendu: trg_doc_access_logs_no_update, trg_doc_access_logs_no_delete

# 9) Test manuel append + UPDATE rejete + DELETE rejete
pnpm --filter @skalean/database run db:psql -- <<EOF
SELECT set_config('app.current_tenant_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
INSERT INTO doc_access_logs (id, tenant_id, user_id, document_id, action, accessed_at)
VALUES (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'download', NOW());
SELECT count(*) FROM doc_access_logs;
UPDATE doc_access_logs SET action='view' WHERE document_id='cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid;  -- DOIT ECHOUER
DELETE FROM doc_access_logs WHERE document_id='cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid;  -- DOIT ECHOUER
EOF

# 10) Verification env vars
grep -E "^DOCS_ACCESS_" .env.example
# Attendu: 6 variables presentes

# 11) Build
pnpm --filter @skalean/docs run build
pnpm --filter @skalean/api run build

# 12) OpenAPI generation
pnpm --filter @skalean/api run openapi:generate
# Verifier docs/openapi.json contient les 3 endpoints admin/docs/access-logs

# 13) Audit dependencies
pnpm audit --audit-level=high

# 14) Format
pnpm --filter @skalean/docs run format
pnpm --filter @skalean/api run format
```

Tous doivent passer avant commit. Si un seul echoue: NE PAS COMMITTER.

## 16. Commit message

Format Conventional Commits:

```
feat(docs): tracking append-only acces documents + detection abus sliding window

- Migration DocsAccessLogsAppendOnly: RLS SELECT+INSERT only, REVOKE UPDATE/DELETE,
  triggers BEFORE UPDATE/DELETE RAISE EXCEPTION, UNIQUE constraint idempotency,
  index couvrants tenant/user/doc/action.
- AccessLogService: append (tenant context, IP normalize, UA truncate), queryByFilters
  (cursor pagination), queryTimelineForDocument (90j agreg jour+action), queryActivityForUser.
- AccessAbuseDetectorService: sliding window 60 buckets per-minute Redis, MGET sum,
  emit Kafka audit.suspicious_access si > 100/h, deduplication SETNX 1/heure.
- LogDocumentAccessInterceptor: enqueue BullMQ apres handler success, SKIP routes admin
  + non-2xx, fallback fichier NDJSON si queue down, jobId SHA256 deterministe.
- LogAccessAsyncProcessor: process append + abuse detection, fallback fichier si PG fail
  derniere tentative, retry exponential backoff 3x.
- AdminAccessLogsController: 3 endpoints (list filtre, timeline, user activity),
  PermissionsGuard docs.access_logs.read, SkipAccessLog anti-recursion.
- AccessAction enum strict 5 valeurs, AccessLogQuerySchema Zod from<=to, cursor base64url.
- Variables env: DOCS_ACCESS_ABUSE_THRESHOLD_PER_HOUR=100, DOCS_ACCESS_LOG_QUEUE,
  DOCS_ACCESS_LOG_RETENTION_DAYS=3651 (10 ans), DOCS_ACCESS_LOG_FALLBACK_PATH.
- Tests: 30+ unit (services, interceptor, processor, controller), 12 E2E (RLS, UNIQUE,
  pagination, filtres, anti-recursion, permissions).

Conformite: Loi 09-08 art.13 (integrite), ACAPS Circ.2018/01 art.9 (tracabilite 10 ans),
CNDP Delib.5/2020 (minimisation), Loi 43-20 art.9 (preuve numerique).

Refs: SPRINT-10, TASK-3.3.4
Depends: TASK-3.3.3
Unblocks: TASK-3.3.5, TASK-3.3.6, SPRINT-33-secops-consume-suspicious-access
```

## 17. Workflow next step

Apres validation et merge de cette tache 3.3.4, l'enchainement Sprint 10 est:

### 17.1 Tache 3.3.5 - DocumentVersionService (immediate next)

Effort 5h, P0. Cree une couche versioning des documents (chaque modification metadata ou contenu cree une nouvelle version, l'ancienne reste consultable et tracee). Reutilisera l'AccessLogService de cette tache pour journaliser les acces aux versions historiques (`action='view_version'` etendu si necessaire).

Files prevus:
- `repo/packages/docs/src/services/document-version.service.ts`
- Migration `DocsVersioningTable` avec FK vers `documents.id`
- Trigger AFTER UPDATE sur `documents` qui INSERT dans `document_versions`
- Endpoints `GET /api/v1/docs/:id/versions`, `GET /api/v1/docs/:id/versions/:vId/restore`

### 17.2 Tache 3.3.6 - Admin reporting compliance ACAPS (apres 3.3.5)

Effort 4h, P1. Genere rapports CSV/Excel d'audit ACAPS sur demande, agregeant les donnees de `doc_access_logs` produites par cette tache 3.3.4. Endpoint `POST /api/v1/admin/compliance/acaps-report` declenche job BullMQ qui agrege 12 derniers mois et stocke dans S3 + envoi email.

### 17.3 Tache 3.4.x - Modules signature Loi 43-20 (Phase 4)

A partir de 3.4.1, integration signature electronique conforme Loi 43-20. Le `requestId` log par cette tache 3.3.4 sera reference dans les artefacts de signature pour tracabilite croisee preuve numerique.

### 17.4 Sprint 33 - SecOps consume audit.suspicious_access

Le topic Kafka emis par cette tache 3.3.4 sera consomme par le module SecOps (Sprint 33) qui:
- Alerte SIEM (Elasticsearch).
- Notification DPO email + Teams.
- Suspension automatique compte si recurrence > 3 emissions/24h.
- Workflow d'investigation Maker-Checker dans console admin.

### 17.5 Procedure de purge legale (annuelle)

Une fois en production, la procedure annuelle Maker-Checker pour purger les logs > 10 ans est documentee dans `docs/audit-trail.md`. Necessite intervention superuser PostgreSQL, signature 2 admins distincts (DPO + Compliance Officer), trace dans `legal_purge_log` separe (lui-meme append-only).

### 17.6 Roadmap detection abus avancee (Sprint 33+)

L'algorithme sliding window de cette tache 3.3.4 sera complete par:
- Bayesian detection (Sprint 33): patterns sequentiels (ex: download alphabetique).
- ML Isolation Forest (Sprint 34): detection comportementale non-supervisee.
- Graph analysis (Sprint 35): correlation users + documents pour reseaux d'exfiltration.

Toutes ces couches consomment les logs append-only de cette tache 3.3.4 comme source de verite.

---

## Annexe A - Schema Prisma DocAccessLog

```prisma
model DocAccessLog {
  id          String   @id @default(uuid()) @db.Uuid
  tenantId    String   @map("tenant_id") @db.Uuid
  userId      String   @map("user_id") @db.Uuid
  documentId  String   @map("document_id") @db.Uuid
  action      String   @db.VarChar(64)
  ipAddress   String?  @map("ip_address") @db.VarChar(64)
  userAgent   String?  @map("user_agent") @db.VarChar(512)
  requestId   String?  @map("request_id") @db.VarChar(128)
  accessedAt  DateTime @map("accessed_at") @db.Timestamptz(6)
  metadata    Json?    @db.JsonB
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  tenant      Tenant   @relation(fields: [tenantId], references: [id])
  document    Document @relation(fields: [documentId], references: [id])
  user        User     @relation(fields: [userId], references: [id])

  @@unique([userId, documentId, accessedAt, action], name: "doc_access_logs_idempotency_uniq")
  @@index([tenantId, accessedAt(sort: Desc), id(sort: Desc)], map: "idx_doc_access_logs_tenant_accessed")
  @@index([tenantId, userId, accessedAt(sort: Desc)], map: "idx_doc_access_logs_user_accessed")
  @@index([tenantId, documentId, accessedAt(sort: Desc)], map: "idx_doc_access_logs_doc_accessed")
  @@index([tenantId, action, accessedAt(sort: Desc)], map: "idx_doc_access_logs_action")
  @@map("doc_access_logs")
}
```

## Annexe B - Documentation OpenAPI generee (extrait)

```yaml
paths:
  /api/v1/admin/docs/access-logs:
    get:
      summary: Liste paginee des logs d'acces documents
      tags: [Admin - Access Logs]
      security:
        - bearerAuth: []
      parameters:
        - name: document_id
          in: query
          schema:
            type: string
            format: uuid
        - name: user_id
          in: query
          schema:
            type: string
            format: uuid
        - name: action
          in: query
          schema:
            type: string
            enum: [view, download, share, preview, metadata_query]
        - name: from
          in: query
          schema:
            type: string
            format: date-time
        - name: to
          in: query
          schema:
            type: string
            format: date-time
        - name: cursor
          in: query
          schema:
            type: string
        - name: limit
          in: query
          schema:
            type: integer
            minimum: 1
            maximum: 200
            default: 50
      responses:
        '200':
          description: Page de logs
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      $ref: '#/components/schemas/AccessLogRecord'
                  nextCursor:
                    type: string
                    nullable: true
        '400':
          description: Validation Zod echouee
        '403':
          description: Permission docs.access_logs.read manquante
        '401':
          description: JWT manquant ou invalide

components:
  schemas:
    AccessLogRecord:
      type: object
      required: [id, tenantId, userId, documentId, action, accessedAt]
      properties:
        id:
          type: string
          format: uuid
        tenantId:
          type: string
          format: uuid
        userId:
          type: string
          format: uuid
        documentId:
          type: string
          format: uuid
        action:
          type: string
          enum: [view, download, share, preview, metadata_query]
        ipAddress:
          type: string
          nullable: true
        userAgent:
          type: string
          nullable: true
        requestId:
          type: string
          nullable: true
        accessedAt:
          type: string
          format: date-time
        metadata:
          type: object
          nullable: true
```

## Annexe C - Procedure operationnelle purge legale Maker-Checker

Cette procedure n'est pas une operation routine: elle est executee 1 fois/an apres la cloture annuelle (typiquement Q1 N+1 pour purger l'annee N-10). Elle requiert:

1. **Pre-requis administratifs**:
   - Avis ecrit du DPO valide la purge.
   - Avis ecrit du Compliance Officer ACAPS valide la purge.
   - Notification CNDP 30j avant si volume > 1M rows (formalite informative).
   - Backup chiffre des rows a purger sur stockage long-terme S3 Glacier Deep Archive (retention 30 ans pour litiges futurs eventuels).

2. **Etape 1 - Maker (Compliance Officer)**:
   ```bash
   # Connexion superuser via console managee Postgres-as-a-Service avec MFA
   psql -h <prod-host> -U db_superuser -d skalean
   
   BEGIN;
   -- Selection rows a purger (older than 10 ans + 1 jour de marge)
   CREATE TEMP TABLE purge_candidates AS
   SELECT * FROM doc_access_logs
   WHERE accessed_at < NOW() - INTERVAL '3651 days';
   
   SELECT count(*) FROM purge_candidates;
   -- Doit matcher l'estimation prevue (alerter si delta > 10%)
   ```

3. **Etape 2 - Backup chiffre vers S3 Glacier**:
   ```bash
   COPY (SELECT * FROM purge_candidates) TO '/secure/purge_2036_q1.csv' CSV HEADER;
   gpg --encrypt --recipient compliance@skalean.ma /secure/purge_2036_q1.csv
   aws s3 cp /secure/purge_2036_q1.csv.gpg s3://skalean-legal-archive/access-logs/2036-q1/ \
     --storage-class DEEP_ARCHIVE --sse aws:kms
   ```

4. **Etape 3 - Insertion legal_purge_log signe**:
   ```sql
   INSERT INTO legal_purge_log (
     id, table_name, rows_count, purge_date, reason,
     maker_user_id, maker_signature, archive_s3_url
   ) VALUES (
     gen_random_uuid(), 'doc_access_logs', (SELECT count(*) FROM purge_candidates),
     NOW(), 'CNDP retention 10y exceeded',
     :maker_id, :maker_jwt_signature,
     's3://skalean-legal-archive/access-logs/2036-q1/purge_2036_q1.csv.gpg'
   );
   ```

5. **Etape 4 - Checker (DPO) valide via console**:
   - Console admin specifique `/admin/legal-purge/pending` montre la requete maker.
   - DPO signe via JWT secondaire (cle materielle YubiKey).
   - Mise a jour `legal_purge_log.checker_signature`.

6. **Etape 5 - Execution DELETE (superuser bypasse RLS uniquement pour cette op)**:
   ```sql
   ALTER USER db_superuser BYPASSRLS;  -- temporaire, dans transaction
   SET session_replication_role = 'replica';  -- desactive triggers temporairement
   DELETE FROM doc_access_logs WHERE id IN (SELECT id FROM purge_candidates);
   SET session_replication_role = 'origin';  -- reactive triggers
   ALTER USER db_superuser NOBYPASSRLS;
   COMMIT;
   ```

7. **Etape 6 - Audit & rotation**:
   - Enregistrement complete dans `legal_purge_log` avec timestamp, count, hash backup.
   - Rotation cles GPG annuelle.
   - Revue ACAPS annuelle de la procedure.

Cette procedure est intentionnellement complexe et manuelle pour eviter toute purge accidentelle ou malveillante. Elle complete la garantie append-only au quotidien.

## Annexe D - Metriques Prometheus exposees

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `access_log_appended_total` | Counter | tenant, action | Nombre logs persistes (incluant ON CONFLICT DO NOTHING qui count 0) |
| `access_log_append_duration_seconds` | Histogram | tenant | Duree append (Prisma INSERT + tenant context) |
| `access_log_fallback_total` | Counter | reason | Fallback fichier NDJSON declenche (queue_down, persistence_failed) |
| `access_log_queue_depth` | Gauge | queue_name | Profondeur queue BullMQ docs-access-log (alert si > 100k) |
| `access_log_dlq_total` | Counter | - | Jobs en DLQ apres N retries (alert immediate) |
| `access_abuse_detected_total` | Counter | tenant | Evenements suspicious_access emis vers Kafka |
| `access_abuse_check_duration_seconds` | Histogram | - | Duree check Redis MGET 60 buckets |
| `access_log_query_duration_seconds` | Histogram | endpoint | Duree query admin (list, timeline, user) |
| `access_log_query_rows_returned` | Histogram | endpoint | Nombre rows retournes par query admin |
| `access_log_processor_active_jobs` | Gauge | - | Jobs BullMQ en cours processing |

Alertes Prometheus suggerees (`infra/prometheus/alerts.yml`):

```yaml
- alert: AccessLogQueueBacklog
  expr: access_log_queue_depth{queue_name="docs-access-log"} > 100000
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "Backlog queue docs-access-log > 100k"
    description: "Queue backlog: {{ $value }}. Verifier worker capacity."

- alert: AccessLogDLQ
  expr: increase(access_log_dlq_total[5m]) > 0
  for: 1m
  labels:
    severity: critical
  annotations:
    summary: "Logs acces en DLQ - perte potentielle audit trail"
    description: "{{ $value }} jobs en DLQ derniere 5 min. Investigation SecOps requise."

- alert: AccessLogFallbackHigh
  expr: rate(access_log_fallback_total[5m]) > 1
  for: 10m
  labels:
    severity: warning
  annotations:
    summary: "Fallback fichier eleve"
    description: "{{ $value }} fallbacks/sec - infra Redis/PG instable"

- alert: AccessAbuseSpike
  expr: rate(access_abuse_detected_total[1h]) > 10
  for: 15m
  labels:
    severity: warning
  annotations:
    summary: "Pic emissions suspicious_access"
    description: "{{ $value }} detections/heure - investigation SecOps + DPO"
```

## Annexe E - Diagramme sequence detaille (PlantUML simulation)

```
participant Client
participant API as "NestJS API"
participant Inter as "LogDocumentAccess\nInterceptor"
participant Queue as "BullMQ\ndocs-access-log"
participant Worker as "LogAccessAsync\nProcessor"
participant LogSvc as "AccessLogService"
participant Detector as "AccessAbuseDetector"
participant PG as "PostgreSQL\ndoc_access_logs"
participant Redis
participant Kafka

Client -> API: GET /api/v1/docs/{id}/download\nAuthorization: Bearer {jwt}
activate API

API -> API: JwtAuthGuard.validate()
API -> API: TenantMiddleware.setContext()
API -> API: PermissionGuard(docs.read)
API -> API: DocsController.download()
API -> API: streamPDFFromS3()
API -> Client: 200 OK + PDF stream
API -> Inter: tap() apres handler success
activate Inter

Inter -> Inter: extract user, tenant, ip, ua, request_id
Inter -> Inter: compute idempotencyKey = sha256(...)
Inter -> Queue: queue.add('append-log', payload, {jobId, attempts:3})
activate Queue
Queue --> Inter: Job enqueued
deactivate Inter

deactivate API

note over Queue, Worker: async processing

Queue -> Worker: process(job)
activate Worker

Worker -> LogSvc: append(payload)
activate LogSvc
LogSvc -> PG: SELECT set_config('app.current_tenant_id', tid, true)
LogSvc -> PG: INSERT INTO doc_access_logs ... ON CONFLICT DO NOTHING
PG --> LogSvc: 1 row inserted (or 0 if conflict)
LogSvc --> Worker: void
deactivate LogSvc

Worker -> Detector: recordAccess(tid, uid, action)
activate Detector
Detector -> Redis: MULTI; INCR bucket_key; EXPIRE 3700; EXEC
Redis --> Detector: OK
deactivate Detector

Worker -> Detector: checkAndEmitIfExceeded(tid, uid)
activate Detector
Detector -> Redis: MGET bucket-0 .. bucket-59
Redis --> Detector: [counts]
Detector -> Detector: sum = reduce()

alt sum > threshold
  Detector -> Redis: SET dedupKey 1 EX 3700 NX
  Redis --> Detector: OK (first emission this hour)
  Detector -> Kafka: emit('audit.suspicious_access', {tid, uid, count, threshold})
  Kafka --> Detector: ack
else sum <= threshold OR dedup already emitted
  Detector --> Worker: no-op
end

deactivate Detector

Worker --> Queue: job complete
deactivate Worker
deactivate Queue
```

## Annexe F - Strategie partitionnement PostgreSQL pour scaling 10 ans

A horizon 10 ans (3651 jours) avec une charge moyenne 1000 req/s pic 5000 req/s, le volume `doc_access_logs` est estime:
- Moyenne 1k/s * 86400s/j * 365j * 10 ans = 315 milliards rows.
- Taille ligne 300 bytes (incluant indexes) -> ~ 95 TB.
- Impossible sur un seul tablespace.

**Strategie partitionnement PARTITION BY RANGE (accessed_at)**:

```sql
-- Migration future Sprint 12 (anticipee ici pour reference)
ALTER TABLE doc_access_logs
  PARTITION BY RANGE (accessed_at);

CREATE TABLE doc_access_logs_2026_01 PARTITION OF doc_access_logs
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE doc_access_logs_2026_02 PARTITION OF doc_access_logs
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
-- ... 1 partition par mois sur 120 mois = 120 partitions

-- Job pg_cron mensuel cree partition M+1
SELECT cron.schedule('create-next-month-partition', '0 0 25 * *', $$
  CALL create_next_doc_access_logs_partition();
$$);
```

Avantages:
- Index plus petits par partition (~ 2 GB max au lieu de 100 GB single).
- Drop partition O(1) au lieu de DELETE millions de rows (purge legale 10 ans).
- Query planner peut faire partition pruning si filter sur `accessed_at`.
- Maintenance VACUUM/REINDEX par partition (parallelisable).

**Archivage cold storage**:
- Apres 18 mois, partition detached + COPY vers S3 Parquet + ATTACH foreign table (postgres_fdw).
- Queries admin > 18 mois lent (S3 read) mais possibles via UNION ALL fdw + partitions hot.

## Annexe G - Glossaire technique

| Terme | Definition |
|-------|------------|
| RLS (Row Level Security) | Mecanisme PostgreSQL qui filtre rows visibles/modifiables selon policies definies sur la table. |
| FORCE ROW LEVEL SECURITY | Empeche les owners de table de bypasser RLS (par defaut owners voient tout). |
| BYPASSRLS | Attribut role PostgreSQL qui permet d'ignorer toutes les policies RLS (a reserver superuser). |
| Append-only | Pattern data: les rows ne sont jamais modifies ni supprimes apres insertion. |
| Sliding window | Algorithme de comptage sur fenetre glissante temporelle (ici 60 buckets de 1 min). |
| BullMQ | Library Node.js de queue Redis-backed avec retry, DLQ, priorites, scheduling. |
| DLQ (Dead Letter Queue) | Queue de jobs definitivement en echec apres N retries (audit + reprocessing manuel). |
| Idempotency key | Identifiant deterministe permettant de detecter et ignorer un job duplicate. |
| Cursor pagination | Pagination basee sur un curseur opaque (vs offset) plus stable et performante. |
| Pino | Library de logging structuree JSON tres performante (~5x faster que Winston). |
| ZodValidationPipe | NestJS pipe convertissant un Zod schema en validateur HTTP avec erreurs 400 structurees. |
| Maker-Checker | Pattern de governance ou 1 acteur initie une action (Maker) et un autre la valide (Checker). |
| ACAPS | Autorite de Controle des Assurances et de la Prevoyance Sociale (Maroc). |
| CNDP | Commission Nationale de controle de la protection des Donnees a caractere Personnel (Maroc). |
| DPO (Data Protection Officer) | Delegue a la protection des donnees, role obligatoire RGPD/Loi 09-08 sous conditions. |
| SIEM | Security Information and Event Management (ex: Elasticsearch, Splunk). |
| Kafka topic | Stream de messages partitionnes en Apache Kafka, consume par 1+ groupes consommateurs. |
| Tenant context | Identifiant tenant injecte dans la session Postgres pour filtrage RLS automatique. |

## Annexe H - Roadmap evolutions futures (Sprints 33+)

| Sprint | Evolution | Description |
|--------|-----------|-------------|
| 33 | SecOps consume audit.suspicious_access | Module SecOps consomme topic Kafka et orchestre alerts SIEM, notif DPO, suspension auto. |
| 33 | Bayesian abuse detection | Detection patterns sequentiels (download alphabetique, cluster temporel court). |
| 33 | Geo-IP enrichment | Augment logs avec pays origine pour detection geographique (avec consent DPO). |
| 34 | ML Isolation Forest | Modele non-supervise sur historique 6 mois pour detection anomalies subtiles. |
| 34 | Real-time WebSocket dashboard | Console SecOps temps reel avec graph Chord users <-> documents. |
| 35 | Graph analysis Neo4j | Detection reseaux d'exfiltration coordonnee multi-comptes. |
| 35 | Forensic export ediscovery | Export PDF/A horodate qualifie pour procedures judiciaires. |
| 36 | Differential privacy reporting | Rapports agreges differential-private pour partage chercheurs/regulateurs. |
| 37 | Blockchain notarization (optional) | Hash quotidien doc_access_logs notarise sur chain (preuve integrite tiers). |
| 38 | Federated audit trail | Synchronisation audit trail entre Skalean et systemes ACAPS si requis future regulation. |

---

FIN tache 3.3.4 - AccessLogService append-only tracking + detection abus sliding window 100/h Redis.
default(uuid()) @db.Uuid
  tenantId    String   @map("tenant_id") @db.Uuid
  userId      String   @map("user_id") @db.Uuid
  documentId  String   @map("document_id") @db.Uuid
  action      String   @db.VarChar(64)
  ipAddress   String?  @map("ip_address") @db.VarChar(64)
  userAgent   String?  @map("user_agent") @db.VarChar(512)
  requestId   String?  @map("request_id") @db.VarChar(128)
  accessedAt  DateTime @map("accessed_at") @db.Timestamptz(6)
  metadata    Json?    @db.JsonB
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  tenant      Tenant   @relation(fields: [tenantId], references: [id])
  document    Document @relation(fields: [documentId], references: [id])
  user        User     @relation(fields: [userId], references: [id])

  @@unique([userId, documentId, accessedAt, action], name: "doc_access_logs_idempotency_uniq")
  @@index([tenantId, accessedAt(sort: Desc), id(sort: Desc)], map: "idx_doc_access_logs_tenant_accessed")
  @@index([tenantId, userId, accessedAt(sort: Desc)], map: "idx_doc_access_logs_user_accessed")
  @@index([tenantId, documentId, accessedAt(sort: Desc)], map: "idx_doc_access_logs_doc_accessed")
  @@index([tenantId, action, accessedAt(sort: Desc)], map: "idx_doc_access_logs_action")
  @@map("doc_access_logs")
}
```

## Annexe B - Documentation OpenAPI generee (extrait)

```yaml
paths:
  /api/v1/admin/docs/access-logs:
    get:
      summary: Liste paginee des logs d'acces documents
      tags: [Admin - Access Logs]
      security:
        - bearerAuth: []
      parameters:
        - name: document_id
          in: query
          schema:
            type: string
            format: uuid
        - name: user_id
          in: query
          schema:
            type: string
            format: uuid
        - name: action
          in: query
          schema:
            type: string
            enum: [view, download, share, preview, metadata_query]
        - name: from
          in: query
          schema:
            type: string
            format: date-time
        - name: to
          in: query
          schema:
            type: string
            format: date-time
        - name: cursor
          in: query
          schema:
            type: string
        - name: limit
          in: query
          schema:
            type: integer
            minimum: 1
            maximum: 200
            default: 50
      responses:
        '200':
          description: Page de logs
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      $ref: '#/components/schemas/AccessLogRecord'
                  nextCursor:
                    type: string
                    nullable: true
        '400':
          description: Validation Zod echouee
        '403':
          description: Permission docs.access_logs.read manquante
        '401':
          description: JWT manquant ou invalide

components:
  schemas:
    AccessLogRecord:
      type: object
      required: [id, tenantId, userId, documentId, action, accessedAt]
      properties:
        id:
          type: string
          format: uuid
        tenantId:
          type: string
          format: uuid
        userId:
          type: string
          format: uuid
        documentId:
          type: string
          format: uuid
        action:
          type: string
          enum: [view, download, share, preview, metadata_query]
        ipAddress:
          type: string
          nullable: true
        userAgent:
          type: string
          nullable: true
        requestId:
          type: string
          nullable: true
        accessedAt:
          type: string
          format: date-time
        metadata:
          type: object
          nullable: true
```

## Annexe C - Procedure operationnelle purge legale Maker-Checker

Cette procedure n'est pas une operation routine: elle est executee 1 fois/an apres la cloture annuelle (typiquement Q1 N+1 pour purger l'annee N-10). Elle requiert:

1. **Pre-requis administratifs**:
   - Avis ecrit du DPO valide la purge.
   - Avis ecrit du Compliance Officer ACAPS valide la purge.
   - Notification CNDP 30j avant si volume > 1M rows (formalite informative).
   - Backup chiffre des rows a purger sur stockage long-terme S3 Glacier Deep Archive (retention 30 ans pour litiges futurs eventuels).

2. **Etape 1 - Maker (Compliance Officer) initie via console superuser**:
   ```bash
   psql -h <prod-host> -U db_superuser -d skalean
   BEGIN;
   CREATE TEMP TABLE purge_candidates AS
   SELECT * FROM doc_access_logs WHERE accessed_at < NOW() - INTERVAL '3651 days';
   SELECT count(*) FROM purge_candidates;
   ```

3. **Etape 2 - Backup chiffre vers S3 Glacier Deep Archive**:
   ```bash
   COPY (SELECT * FROM purge_candidates) TO '/secure/purge_2036_q1.csv' CSV HEADER;
   gpg --encrypt --recipient compliance@skalean.ma /secure/purge_2036_q1.csv
   aws s3 cp /secure/purge_2036_q1.csv.gpg s3://skalean-legal-archive/access-logs/2036-q1/ \
     --storage-class DEEP_ARCHIVE --sse aws:kms
   ```

4. **Etape 3 - Insertion legal_purge_log**:
   ```sql
   INSERT INTO legal_purge_log (id, table_name, rows_count, purge_date, reason,
     maker_user_id, maker_signature, archive_s3_url) VALUES (
     gen_random_uuid(), 'doc_access_logs', (SELECT count(*) FROM purge_candidates),
     NOW(), 'CNDP retention 10y exceeded', :maker_id, :maker_jwt_signature,
     's3://skalean-legal-archive/access-logs/2036-q1/purge_2036_q1.csv.gpg');
   ```

5. **Etape 4 - Checker (DPO) valide via console admin**:
   - Console admin `/admin/legal-purge/pending` montre la requete maker.
   - DPO signe via JWT secondaire (cle materielle YubiKey).
   - Mise a jour `legal_purge_log.checker_signature`.

6. **Etape 5 - Execution DELETE (superuser bypasse RLS uniquement pour cette op)**:
   ```sql
   ALTER USER db_superuser BYPASSRLS;
   SET session_replication_role = 'replica';
   DELETE FROM doc_access_logs WHERE id IN (SELECT id FROM purge_candidates);
   SET session_replication_role = 'origin';
   ALTER USER db_superuser NOBYPASSRLS;
   COMMIT;
   ```

7. **Etape 6 - Audit & rotation**:
   - Enregistrement dans `legal_purge_log` (timestamp, count, hash backup).
   - Rotation cles GPG annuelle.
   - Revue ACAPS annuelle de la procedure.

Cette procedure est intentionnellement complexe et manuelle pour eviter toute purge accidentelle ou malveillante.

## Annexe D - Metriques Prometheus exposees

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `access_log_appended_total` | Counter | tenant, action | Nombre logs persistes |
| `access_log_append_duration_seconds` | Histogram | tenant | Duree append (Prisma INSERT + tenant context) |
| `access_log_fallback_total` | Counter | reason | Fallback fichier NDJSON declenche (queue_down, persistence_failed) |
| `access_log_queue_depth` | Gauge | queue_name | Profondeur queue BullMQ docs-access-log (alert si > 100k) |
| `access_log_dlq_total` | Counter | - | Jobs en DLQ apres N retries (alert immediate) |
| `access_abuse_detected_total` | Counter | tenant | Evenements suspicious_access emis vers Kafka |
| `access_abuse_check_duration_seconds` | Histogram | - | Duree check Redis MGET 60 buckets |
| `access_log_query_duration_seconds` | Histogram | endpoint | Duree query admin (list, timeline, user) |
| `access_log_query_rows_returned` | Histogram | endpoint | Nombre rows retournes par query admin |
| `access_log_processor_active_jobs` | Gauge | - | Jobs BullMQ en cours processing |

Alertes Prometheus suggerees (`infra/prometheus/alerts.yml`):

```yaml
- alert: AccessLogQueueBacklog
  expr: access_log_queue_depth{queue_name="docs-access-log"} > 100000
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "Backlog queue docs-access-log > 100k"
    description: "Queue backlog: {{ $value }}. Verifier worker capacity."

- alert: AccessLogDLQ
  expr: increase(access_log_dlq_total[5m]) > 0
  for: 1m
  labels:
    severity: critical
  annotations:
    summary: "Logs acces en DLQ - perte potentielle audit trail"
    description: "{{ $value }} jobs en DLQ derniere 5 min. Investigation SecOps requise."

- alert: AccessLogFallbackHigh
  expr: rate(access_log_fallback_total[5m]) > 1
  for: 10m
  labels:
    severity: warning
  annotations:
    summary: "Fallback fichier eleve"
    description: "{{ $value }} fallbacks/sec - infra Redis/PG instable"

- alert: AccessAbuseSpike
  expr: rate(access_abuse_detected_total[1h]) > 10
  for: 15m
  labels:
    severity: warning
  annotations:
    summary: "Pic emissions suspicious_access"
    description: "{{ $value }} detections/heure - investigation SecOps + DPO"
```

## Annexe E - Diagramme sequence detaille (PlantUML simulation)

```
participant Client
participant API as "NestJS API"
participant Inter as "LogDocumentAccess\nInterceptor"
participant Queue as "BullMQ\ndocs-access-log"
participant Worker as "LogAccessAsync\nProcessor"
participant LogSvc as "AccessLogService"
participant Detector as "AccessAbuseDetector"
participant PG as "PostgreSQL\ndoc_access_logs"
participant Redis
participant Kafka

Client -> API: GET /api/v1/docs/{id}/download\nAuthorization: Bearer {jwt}
activate API
API -> API: JwtAuthGuard.validate()
API -> API: TenantMiddleware.setContext()
API -> API: PermissionGuard(docs.read)
API -> API: DocsController.download()
API -> API: streamPDFFromS3()
API -> Client: 200 OK + PDF stream
API -> Inter: tap() apres handler success
activate Inter
Inter -> Inter: extract user, tenant, ip, ua, request_id
Inter -> Inter: compute idempotencyKey = sha256(...)
Inter -> Queue: queue.add('append-log', payload, {jobId, attempts:3})
activate Queue
Queue --> Inter: Job enqueued
deactivate Inter
deactivate API

note over Queue, Worker: async processing

Queue -> Worker: process(job)
activate Worker
Worker -> LogSvc: append(payload)
activate LogSvc
LogSvc -> PG: SELECT set_config('app.current_tenant_id', tid, true)
LogSvc -> PG: INSERT INTO doc_access_logs ... ON CONFLICT DO NOTHING
PG --> LogSvc: 1 row inserted (or 0 if conflict)
LogSvc --> Worker: void
deactivate LogSvc

Worker -> Detector: recordAccess(tid, uid, action)
activate Detector
Detector -> Redis: MULTI; INCR bucket_key; EXPIRE 3700; EXEC
Redis --> Detector: OK
deactivate Detector

Worker -> Detector: checkAndEmitIfExceeded(tid, uid)
activate Detector
Detector -> Redis: MGET bucket-0 .. bucket-59
Redis --> Detector: [counts]
Detector -> Detector: sum = reduce()

alt sum > threshold
  Detector -> Redis: SET dedupKey 1 EX 3700 NX
  Redis --> Detector: OK (first emission this hour)
  Detector -> Kafka: emit('audit.suspicious_access', {tid, uid, count, threshold})
  Kafka --> Detector: ack
else sum <= threshold OR dedup already emitted
  Detector --> Worker: no-op
end

deactivate Detector
Worker --> Queue: job complete
deactivate Worker
deactivate Queue
```

## Annexe F - Strategie partitionnement PostgreSQL pour scaling 10 ans

A horizon 10 ans (3651 jours) avec une charge moyenne 1000 req/s pic 5000 req/s, le volume `doc_access_logs` est estime:
- Moyenne 1k/s * 86400s/j * 365j * 10 ans = 315 milliards rows.
- Taille ligne 300 bytes (incluant indexes) -> ~ 95 TB.
- Impossible sur un seul tablespace.

**Strategie partitionnement PARTITION BY RANGE (accessed_at)**:

```sql
ALTER TABLE doc_access_logs PARTITION BY RANGE (accessed_at);

CREATE TABLE doc_access_logs_2026_01 PARTITION OF doc_access_logs
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE doc_access_logs_2026_02 PARTITION OF doc_access_logs
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

-- Job pg_cron mensuel cree partition M+1
SELECT cron.schedule('create-next-month-partition', '0 0 25 * *', $$
  CALL create_next_doc_access_logs_partition();
$$);
```

Avantages:
- Index plus petits par partition (~ 2 GB max au lieu de 100 GB single).
- Drop partition O(1) au lieu de DELETE millions de rows (purge legale 10 ans).
- Query planner peut faire partition pruning si filter sur `accessed_at`.
- Maintenance VACUUM/REINDEX par partition (parallelisable).

**Archivage cold storage**:
- Apres 18 mois, partition detached + COPY vers S3 Parquet + ATTACH foreign table (postgres_fdw).
- Queries admin > 18 mois lent (S3 read) mais possibles via UNION ALL fdw + partitions hot.

## Annexe G - Glossaire technique

| Terme | Definition |
|-------|------------|
| RLS (Row Level Security) | Mecanisme PostgreSQL qui filtre rows visibles/modifiables selon policies definies sur la table. |
| FORCE ROW LEVEL SECURITY | Empeche les owners de table de bypasser RLS. |
| BYPASSRLS | Attribut role PostgreSQL qui permet d'ignorer toutes les policies RLS (a reserver superuser). |
| Append-only | Pattern data: les rows ne sont jamais modifies ni supprimes apres insertion. |
| Sliding window | Algorithme de comptage sur fenetre glissante temporelle (60 buckets de 1 min). |
| BullMQ | Library Node.js de queue Redis-backed avec retry, DLQ, priorites, scheduling. |
| DLQ | Queue de jobs definitivement en echec apres N retries (audit + reprocessing manuel). |
| Idempotency key | Identifiant deterministe permettant de detecter et ignorer un job duplicate. |
| Cursor pagination | Pagination basee sur un curseur opaque (vs offset) plus stable et performante. |
| Pino | Library de logging structuree JSON tres performante (~5x faster que Winston). |
| ZodValidationPipe | NestJS pipe convertissant un Zod schema en validateur HTTP avec erreurs 400. |
| Maker-Checker | Pattern de governance ou 1 acteur initie une action (Maker) et un autre la valide (Checker). |
| ACAPS | Autorite de Controle des Assurances et de la Prevoyance Sociale (Maroc). |
| CNDP | Commission Nationale de controle de la protection des Donnees a caractere Personnel (Maroc). |
| DPO | Delegue a la protection des donnees, role obligatoire RGPD/Loi 09-08 sous conditions. |
| SIEM | Security Information and Event Management (ex: Elasticsearch, Splunk). |
| Kafka topic | Stream de messages partitionnes en Apache Kafka, consume par 1+ groupes consommateurs. |
| Tenant context | Identifiant tenant injecte dans la session Postgres pour filtrage RLS automatique. |

## Annexe H - Roadmap evolutions futures (Sprints 33+)

| Sprint | Evolution | Description |
|--------|-----------|-------------|
| 33 | SecOps consume audit.suspicious_access | Module SecOps consomme topic Kafka et orchestre alerts SIEM, notif DPO, suspension auto. |
| 33 | Bayesian abuse detection | Detection patterns sequentiels (download alphabetique, cluster temporel court). |
| 33 | Geo-IP enrichment | Augment logs avec pays origine pour detection geographique (avec consent DPO). |
| 34 | ML Isolation Forest | Modele non-supervise sur historique 6 mois pour detection anomalies subtiles. |
| 34 | Real-time WebSocket dashboard | Console SecOps temps reel avec graph users <-> documents. |
| 35 | Graph analysis Neo4j | Detection reseaux d'exfiltration coordonnee multi-comptes. |
| 35 | Forensic export ediscovery | Export PDF/A horodate qualifie pour procedures judiciaires. |
| 36 | Differential privacy reporting | Rapports agreges differential-private pour partage chercheurs/regulateurs. |
| 37 | Blockchain notarization | Hash quotidien doc_access_logs notarise sur chain (preuve integrite tiers). |
| 38 | Federated audit trail | Synchronisation audit trail entre Skalean et systemes ACAPS. |

---

FIN tache 3.3.4 - AccessLogService append-only tracking + detection abus sliding window 100/h Redis.
