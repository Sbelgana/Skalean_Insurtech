# TACHE 3.1.13 -- Booking iCal Feed Export (Token-Based Public URL RFC 5545)

**Sprint** : 8 (Phase 3 / Sprint 1 dans phase) -- CRM + Booking Foundations
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-08-sprint-08-crm-booking.md` (Tache 3.1.13)
**Phase** : 3 -- Modules Horizontaux Foundation
**Priorite** : P1 (alternative legere a OAuth sync tache 3.1.10/3.1.12 ; bloque scenarios Sprint 16 Settings page "Mon URL iCal" + Sprint 17 customer portal partage agenda public)
**Effort** : 4h
**Dependances** : Tache 3.1.9 (Appointments status workflow), Sprint 1 task 1.1.5 (Redis db=6), Sprint 5/6/7 (Auth + Multi-tenant + RBAC), Sprint 3 task 1.3.13 (rate limiting throttler), Sprint 5 task 2.1.X (auth_users entity)
**Densite cible** : 100-150 ko (auto-suffisant exhaustif)
**AUCUNE EMOJI AUTORISEE**

---

## 1. But

Cette tache 3.1.13 implemente l'export feed iCal `.ics` selon RFC 5545 (Internet Calendaring and Scheduling Core Object Specification, IETF septembre 2009 remplacant RFC 2445 de 1998), permettant a un utilisateur Skalean InsurTech v2.2 de subscriber son agenda Skalean depuis n'importe quel client iCal compatible (Google Calendar via "Add by URL", Apple Calendar via "Subscribe to Calendar", Outlook Desktop via "Add Internet Calendars", Outlook.com via "Subscribe from web", Thunderbird Lightning via "Add Network Calendar", Yahoo Calendar via "Other Calendars Add", Proton Calendar, FastMail, Zoho, Zimbra, Lotus Notes, etc.) en tant qu'alternative legere et standard au sync OAuth bi-directionnel livre taches 3.1.10/3.1.12. Concretement livre : migration TypeORM `1715000000013-UserIcalToken.ts` ajoutant `ical_token VARCHAR(64) UNIQUE` + `ical_token_created_at` + `ical_token_last_accessed_at` + `ical_token_access_count` sur `auth_users`, service NestJS `IcalExportService` exposant 6 methodes (`generateFeed`, `regenerateToken`, `revokeToken`, `findByToken`, `getMyToken`, `getStatistics`), service `IcalCacheService` Redis db=6 TTL 5min avec gzip compression > 10 KB, helper `IcalBuilder` via `ical-generator@8.0.1` (escaping automatique RFC), controller REST 2 endpoints (`GET /api/v1/booking/ical/:token.ics` public + `IcalManagementController` avec 4 endpoints auth), schemas Zod minimaux, rate limiter `@Throttle({ default: { limit: 60, ttl: 3600000 } })` per token via stack throttler Sprint 3, audit logger redact token, suites tests 40 cas (14 unit service + 4 cache + 6 builder + 12 E2E + 4 RFC compliance via parser node-ical@0.20.1).

L'apport est triple. Premierement, alternative legere universellement supportee depuis 25 ans (RFC 5545) vs OAuth (5 min setup) : copy-paste URL dans client favori, no MFA, no quota provider. Setup user 30 sec vs 5 min OAuth. Pour cabinet Bennani assistant administratif non-tech refusant OAuth Google (peur "donner acces"), pour cabinet Tanger Maritime IT policy entreprise interdisant OAuth tiers, pour garage Atlas technicien mobile-first Apple Calendar iCloud. Deuxiemement, token authentication legere mais robuste : `crypto.randomBytes(32).toString('base64url')` produit 43-44 chars base64url alphabet `[A-Za-z0-9_-]` avec entropy 256 bits theoriquement impossible bruteforce (2^255 tentatives moyenne, 5.86e64 annees avec rate limit 60/h vs age univers 1.38e10 annees). Mitige par 5 couches : entropy + regenerate immediat + range futur seul + rate limit + audit IP. Sprint 33 pentest validera. Troisiemement, cache Redis aggressif TTL 5min reduit charge backend 80 pour cent : clients iCal polent 5min (Apple Calendar) a 12h (Google), pour cabinet 20 users x 3 clients = 200-500 polls/jour, sans cache 50ms par feed = charge significative. Avec cache 5min, 80 pour cent polls hit Redis < 1ms.

A l'issue : exports `IcalExportService`, `IcalCacheService`, `IcalBuilder` depuis `@insurtech/booking`. API expose 5 endpoints (1 public + 4 auth) Swagger documentes. Tests 40 cas via `pnpm test ical` + `pnpm e2e booking/ical`. Vars env : `ICAL_FEED_CACHE_TTL_SECONDS` (300), `ICAL_FEED_RANGE_DAYS` (90), `ICAL_FEED_RATE_LIMIT_PER_HOUR` (60), `ICAL_FEED_MAX_EVENTS` (500), `ICAL_FEED_GZIP_THRESHOLD_BYTES` (10240), `REDIS_ICAL_DB` (6), `API_BASE_URL`. Deps : `ical-generator@8.0.1` prod + `node-ical@0.20.1` dev. Total ~2200 lignes TypeScript + SQL.

---

## 2. Contexte etendu

### 2.1 Pourquoi cette tache existe

Format iCal (RFC 5545) standard universel echange calendrier 25 ans+. Tous clients majeurs supportent. Pour Skalean InsurTech v2.2, livrer cette feature differencie commercialement vs concurrents historiques (Salesforce feeds iCal depuis 2007, HubSpot 2014, Pipedrive 2015, Cal.com/Calendly natif).

Besoins metier observes pre-projet 12 cabinets + 8 garages MA janvier-avril 2025 :

- **Cabinet Bennani Casablanca assistant administratif (50 ans)** : non-tech, refuse OAuth Google. Feed iCal setup 30 sec Outlook Desktop Office 365 vs OAuth 5 min minimum.
- **Cabinet Tanger Maritime IT policy ISO 27001 + GDPR** : interdit OAuth tiers, requires DSI escalation 1-2 semaines. Feed iCal contourne (URL stable, conforme policies enterprise).
- **Garage Atlas technicien chef mobile-first (35 ans)** : Apple Calendar iPhone iCloud only, pas compte Google professionnel. Subscribe feed iCal via "Other > Add Subscribed Calendar > URL". Setup 45 sec.
- **Cabinet Marrakech specialise expatries** : commerciaux voyagent internationaux. Reseaux instables OAuth refresh tokens expirent silencieusement 90 jours inactivity. Feed iCal stable indefiniment jusqu'a regeneration explicite.

Choix token random base64url 32 bytes (vs JWT signe, vs UUID, vs slug) suit standard de facto industriel : Google Calendar shared links 30-40 chars random, Salesforce feeds 60+ chars random, Office 365 publish-to-web 80+ chars. Aucun JWT (overhead inutile sans logic Bearer auth) ni UUID (entropy 128 bits inferieur). Random base64url URL-safe, compact 43 chars, entropy 256 bits.

Choix range 90 jours futur uniquement : 30j frustre planning trimestriel renouvellements polices Q+1, 365j inutile (qui consulte janvier 2027 en mai 2026), passe expose donnees sensibles descriptions ("RDV annule cause hospitalisation client"). Equilibre 90j couvre planning trimestriel typique cabinets MA, volume < 200 events feed, protege passe.

Choix cache TTL 5min : equilibre freshness UX (stale max 5min acceptable vs poll client 5min-12h) + reduction charge backend (hit ratio 70-80 pour cent steady state).

### 2.2 Alternatives considerees

| Alternative | Avantages | Inconvenients | Decision |
|-------------|-----------|---------------|----------|
| Pas de feed iCal | Simplicite, scope reduit | Frustre users non-OAuth, perte differenciante | REJETE |
| Feed iCal Basic Auth HTTP | Standard HTTP | Popup login chaque sync, cred leak via URL | REJETE |
| Feed iCal Bearer JWT signe HS256 | Crypto verifiable, expiration, revocation blacklist | Tokens 300+ chars, pas supporte tous clients (Apple OK, Outlook refuse), overhead crypto sans gain visible | REJETE |
| Token random 32 bytes base64url stocke clair (RETENU) | URL-safe 43 chars, entropy 256 bits, standard industrie, universellement supporte | Pas verifiable crypto, lookup DB systematique, leak token expose RDV jusqu'a regenerate | RETENU -- equilibre optimal |
| Token UUID v4 | Familier developpeurs, libraries dispo | Entropy 128 bits inferior, pas URL-safe (tirets), 36 chars vs 43 | REJETE |
| Token user-defined slug | Lisible memorable | Devinable, friction cognitive, collisions cross-users | REJETE |
| ical-generator 8.0.1 (RETENU) | RFC 5545 compliant, maintain community, 1M+ DLs npm, escaping auto, types TS | Bundle 50 KB minified | RETENU -- standard |
| Manual iCal string building | Light, zero deps | Erreurs format frequentes, escaping manuel fragile | REJETE |
| icalendar 0.7.1 legacy | Mature 2015 | Plus maintenu 2020+, types absents | REJETE |
| ics 3.7.0 | Light simple | Moins complet, escaping basique | REJETE |
| Range 30 jours | Volume tres faible | Trop court trimestre | REJETE |
| Range 90 jours (RETENU) | Couvre trimestre, volume < 500 events | Pas visibilite annee+ | RETENU |
| Range 180-365 jours | Vue longue | Volume excessif, perf degradee | REJETE |
| Inclure past 30 jours | Voir RDV recents | Privacy concerns descriptions | REJETE |
| Cache TTL 1min | Tres frais | Hit ratio bas 30 pour cent | REJETE |
| Cache TTL 5min (RETENU) | Equilibre 70-80 pour cent hit | Stale max 5min | RETENU |
| Cache TTL 30min/1h | Hit 90+ pour cent | Stale frustre UX | REJETE |
| Cache memory in-process | Latence zero, simple | Pas partage cross-instances, restart perte | REJETE |
| Cache gzip > 10 KB (RETENU) | Reduit memoire Redis 70 pour cent | Overhead compression ~2ms | RETENU |
| Sans cache | Toujours frais | Charge DB 5x, latence 50ms vs 1ms | REJETE |
| Rate limit per IP | Strict scraping | Frustre user mobile+desktop NAT meme IP | REJETE |
| Rate limit per token (RETENU) | Pertinent | Bypass via multi-tokens regenerate | RETENU + audit |
| Limit 30 req/h | Strict | Frustre Apple Calendar 12 polls/h | REJETE |
| Limit 60 req/h (RETENU) | Couvre clients legitimes max | Permet scraper modere | RETENU + alert |
| Inclure status='external' | Vue unifiee | Pollution feed, doublons si user resync OAuth meme | REJETE strict |
| Inclure description complete | Info contexte | Privacy notes confidentielles | RETENU avec truncation 500 |
| Endpoint regenerate idempotent (RETENU) | UX simple | Reset reset reset si bug | RETENU |
| Hard delete revoke (RETENU) | Net immediat | Necessite regen reactiver | RETENU avec audit_log preserve trace |

### 2.3 Trade-offs explicites

Token random sans verification crypto : securite repose entropy 256 bits. Mathematiquement attaquant a besoin 2^255 tentatives moyenne ; avec rate limit 60/h = 5.86e64 annees vs age univers 1.38e10 annees. Risque pratique nul. Seule vuln canal lateral : log URL avec token, screenshot copy-paste, fuite referrer HTTP (mitige Cache-Control). Sprint 8 mitige : redact path logs OpenTelemetry + documentation user.

Endpoint sans auth Bearer HTTPS-only standard : connaitre token = voir RDV. Trade-off UX simple universel (copy-paste URL marche 100 pour cent clients) vs securite stricte (Bearer fail Apple Calendar iOS). UX dominant + compensation entropy + rate + range futur + log access. Sprint 33 pentest validera.

Range 90j futur strict : volume gestion (200-2000 past vs 50-200 futur typical), privacy passe sensible, aligne usage (consulter planifier futur). Historique via UI Skalean direct.

Cache 5min : stale max 5min acceptable face polling 15+ min client. Cas critique force invalidation via endpoint dedicated possible Sprint 13+.

Description truncation 500 chars : protege exposition notes longues confidentielles. Trade-off perte contexte vs privacy. Commerciaux voient notes completes via UI.

Rate limit 60/h per token : couvre Apple 12/h, Google 1/h, Outlook 4/h max legitimes. Scraper systematique declenche 429. Sprint 13+ alerting 5+ tokens-IPs simultanement = coordinated scraping.

Hard delete revoke vs soft delete : securite (empeche reutilisation token compromis) vs audit (preserve trace). Sprint 8 hard delete + audit_log row `previous_token_prefix` (8 chars suffisent identify) preserve audit minimal.

### 2.4 Decisions strategiques referenced

- decision-002 (Multi-tenant 3 niveaux) totale : token authentifie user authentifie tenant via JWT login. Feed scope strict tenant via RLS + `runWithTenantContext`.
- decision-003 (TypeORM 0.3) totale : migration ajoute colonnes auth_users.
- decision-004 (Kafka events) directe : events publies `booking.ical_token.regenerated/revoked` + `booking.ical_feed.accessed`. Consume Sprint 28 analytics.
- decision-006 (No-emoji ABSOLU) totale : aucune emoji feed output ni code.
- decision-008 (Data residency MA) totale : tokens + cache + audit Atlas Cloud Benguerir.
- decision-012 (RBAC catalog) directe : permission `BOOKING_ICAL_MANAGE` consume 4 endpoints auth. Endpoint public skip RBAC.
- decision-031 (planifie -- iCal feed token strategy) decision dediee `00-pilotage/decisions/031-ical-feed-token-strategy.md` (creee implicitement).

### 2.5 Pieges techniques connus

1. Token leak via URL logging Nginx/OpenTelemetry/Datadog. Solution : redact `:token` param spans, log path `[REDACTED]`. Test V_log_redaction.

2. Format mal escape caracteres speciaux (virgules, points-virgules, backslashes, newlines). Solution : ical-generator 8.0.1 escape auto. Fallback manual `.replace(/([\\,;])/g, '\\$1').replace(/\n/g, '\\n')`. Test V_escape node-ical roundtrip.

3. Timezone Africa/Casablanca vs UTC differents clients. Solution : convention strict UTC DTSTART suffix Z. Clients convert local auto.

4. Cache stale apres regenerate token avec ancien cache encore servable. Solution : `regenerateToken` invalide cache ancien ET nouveau. Test V_cache_invalidate.

5. Rate limit bypass via multi-tokens regenerate rapides. Solution : `@Throttle` aussi regenerate endpoint (10/h max). Audit alert 5+ regenerations 24h. Sprint 13+ sophistication.

6. Feed contient appointments cancelled silently. Solution : filter strict `WHERE status IN ('scheduled', 'confirmed')`. Test V_filter.

7. External events status='external' (tache 3.1.12) re-push via feed = doublons. Solution : exclus strict. Test V_no_external.

8. Empty feed provoque erreur clients legacy. Solution : iCal minimal valide RFC. ical-generator produit. Test V_empty_valid.

9. Feed > 1 MB casse clients legacy (Outlook 2010 < 512 KB). Solution : range 90j + MAX_EVENTS 500 cap. Gzip > 10 KB. Test V_size.

10. Caracteres speciaux UTF-8 (apostrophe francais, accents arabe, emoji). Solution : ical-generator UTF-8. Charset declare. decision-006 strip emoji.

11. Concurrent regenerate double-click. Solution : transaction Postgres serializable + UNIQUE catch.

12. Token persiste apres user soft-delete. Solution : `findByToken` filter `deleted_at IS NULL`. Test V_soft_deleted_404.

13. Token base64 legacy padding `+/=`. Solution : strict base64url regex `[A-Za-z0-9_-]{43,44}` sans padding.

14. Cache memory vs Redis incoherence. Solution : Sprint 8 strict Redis-only.

15. iCal UID collision cross-tenants. Solution : UID `{appointment_uuid}@skalean-insurtech.ma` UUID globalement unique. Test V_uid_unique.

16. Client iCal pas refresh apres update. Solution : header `Cache-Control: no-cache, must-revalidate`. Client ultimately controls.

17. MIME-type incorrect rejette feed. Solution : strict `Content-Type: text/calendar; charset=utf-8`.

18. Filename `.ics` extension absente declenche download vs subscribe. Solution : route `/ical/:token.ics` + `Content-Disposition: inline; filename="skalean-calendar.ics"`.

19. Rate limit Redis sharding inconsistance. Solution : single Redis db=6 simple counter @nestjs/throttler.

20. Concurrent generate feed race cache populate. Solution : acceptable Sprint 8 (idempotent dernier wins). Sprint 13+ single-flight si necessaire.

21. Audit log expose token payload. Solution : `token_prefix: token.substring(0, 8)` suffisant identifier.

22. Performance degrade > 1000 appointments range. Solution : LIMIT MAX_EVENTS 500 cap + index `(tenant_id, assigned_user_id, time_range)`.

23. Description > 65535 chars library error. Solution : truncation 500 + suffix indicator avant builder.

24. Room soft-deleted appointment FK orpheline. Solution : query JOIN filter `r.deleted_at IS NULL`. Location = "Salle supprimee" fallback.

25. iCal generator emoji input. Solution : `IcalBuilder.sanitizeText` strip Unicode emoji ranges (decision-006).

---

## 3. Architecture context

### 3.1 Position dans le sprint

Tache 3.1.13 est la 13e du Sprint 8. Sequence : 3.1.12 -> 3.1.13 -> 3.1.14 -> _SUMMARY.

Consommateur aval : 3.1.14 enrichit tests cross-modules.

Dependances amont :
- 3.1.9 (Appointments status workflow) : `AppointmentsService.findAll`.
- Sprint 3 task 1.3.13 (Rate limiting) : `@Throttle` + ThrottlerModule.
- Sprint 1 task 1.1.5 (Redis dbs) : db=6 reserve iCal.
- Sprint 5 task 2.1.X : `auth_users` cible migration.
- Sprint 5/6/7 : guards JwtAuth + TenantContext + Permission.

### 3.2 Position dans le programme global

iCal feed consume par :
- Sprint 14-15 (Insure) : RDV souscriptions polices apparaissent.
- Sprint 16 (web-broker) : page Settings URL feed + regenerate + revoke + stats.
- Sprint 22 (web-garage) : idem.
- Sprint 17 (customer-portal) : non typique.
- Sprint 18 (assure-portal) : assure feed avec ABAC Sprint 18.
- Sprint 26 (Admin) : admin consulte feeds debug.
- Sprint 28 (Admin reports) : statistiques acces.
- Sprint 33 (Pentest) : valide entropy + rate + cache + audit redaction.

### 3.3 Diagramme

```
                     +-----------------------------+
                     | Clients iCal (universels)    |
                     | Apple/Google/Outlook/...    |
                     +--------------+--------------+
                                    |
                                    | GET /booking/ical/{token}.ics
                                    | (poll 5min - 12h)
                                    v
+--------------------------------------------------------------+
| API NestJS                                                   |
|                                                              |
| IcalController (PUBLIC, NO JwtAuthGuard)                     |
|   GET :token.ics @Throttle 60/h per token                    |
|   Response Content-Type text/calendar charset=utf-8           |
|              Content-Disposition inline filename=...ics       |
|              Cache-Control no-cache must-revalidate           |
|                                                              |
| IcalManagementController (JwtAuthGuard + permission)         |
|   GET me/token                                               |
|   POST regenerate @Throttle 10/day                           |
|   DELETE revoke                                              |
|   GET me/statistics                                          |
|                                                              |
| IcalExportService                                            |
|   generateFeed :                                              |
|     validate format -> cache get -> findByToken              |
|     -> runWithTenantContext -> query 90j scheduled+confirmed |
|     -> IcalBuilder.build -> cache set gzip > 10 KB           |
|     -> async recordAccess + Kafka publish                    |
|   regenerateToken : invalidate ancien + randomBytes(32)      |
|     base64url + UPDATE + Kafka publish                       |
|   revokeToken : hard delete + invalidate + Kafka publish     |
|   getMyToken : read + URL + stats                            |
|   findByToken : filter deleted_at NULL                       |
|   getStatistics : aggregate counts                           |
|                                                              |
| IcalCacheService (Redis db=6)                                |
|   get/set/invalidate/exists                                  |
|   gzip si > GZIP_THRESHOLD_BYTES (prefix z:/u:)              |
|                                                              |
| IcalBuilder (ical-generator 8.0.1)                           |
|   build(input) RFC 5545 string                                |
|   UID {appointment_id}@skalean-insurtech.ma                   |
|   strict UTC DTSTART/DTEND suffix Z                          |
|   truncate description 500 chars                              |
|   sanitize emoji strip decision-006                          |
+--------+------------------------------+----------------------+
         |                              |
         v                              v
+--------+---------+         +----------+----------+
| Postgres        |         | Redis db=6          |
| auth_users      |         | ical_feed:{token}   |
|   ical_token    |         | TTL 300s            |
|   UNIQUE        |         | compressed gzip > 10K|
|   index partial |         +---------------------+
|   created_at    |
|   last_accessed |
|   access_count  |
+-----------------+
```

---

## 4. Livrables checkables

- [ ] Migration `1715000000013-UserIcalToken.ts` (~60 lignes) : colonnes ical_token + created_at + last_accessed_at + access_count + UNIQUE index partial
- [ ] Service `ical-export.service.ts` (~340 lignes, 6 methodes)
- [ ] Service `ical-cache.service.ts` (~140 lignes avec gzip)
- [ ] Helper `ical-builder.ts` (~170 lignes ical-generator wrapper + truncation + escaping + sanitize emoji)
- [ ] Spec `ical-export.service.spec.ts` (~280 lignes, 14 tests)
- [ ] Spec `ical-cache.service.spec.ts` (~120 lignes, 4 tests)
- [ ] Spec `ical-builder.spec.ts` (~150 lignes, 6 tests)
- [ ] Schemas `ical.schema.ts` (~50 lignes)
- [ ] Controller public `ical.controller.ts` (~80 lignes)
- [ ] Controller management `ical-management.controller.ts` (~120 lignes)
- [ ] E2E `ical.e2e-spec.ts` (~320 lignes, 12 scenarios)
- [ ] E2E `ical-rfc-compliance.e2e-spec.ts` (~160 lignes, 4 scenarios node-ical)
- [ ] Modifications `booking.module.ts` + `index.ts` + `app.module.ts`
- [ ] Modifications `package.json` (+ical-generator 8.0.1 + node-ical 0.20.1 dev)
- [ ] Modifications `shared-config/env.schema.ts` (+7 vars ICAL_FEED_*)
- [ ] Modifications OpenTelemetry Sprint 3 task 1.3.4 : redact `:token` path param
- [ ] Token random 32 bytes base64url entropy 256 bits
- [ ] Cache Redis db=6 TTL 5min gzip > 10 KB
- [ ] Rate limit public 60 req/h + regenerate 10/day via @Throttle
- [ ] Feed RFC 5545 parseable par node-ical
- [ ] Range 90 jours futur uniquement
- [ ] Filter strict status `scheduled|confirmed` (exclus cancelled/no_show/completed/external)
- [ ] Description truncation 500 chars + suffix indicator
- [ ] UID `{uuid}@skalean-insurtech.ma` globalement unique
- [ ] Content-Type/Disposition/Cache-Control headers corrects
- [ ] Kafka events publies : `ical_feed.accessed`, `ical_token.regenerated`, `ical_token.revoked`
- [ ] Audit log redact token path
- [ ] Tests : 40 (14 unit + 4 cache + 6 builder + 12 E2E + 4 RFC)
- [ ] Performance : cache hit < 5ms, miss < 100ms p95 sur 100 appointments
- [ ] Multi-tenant isolation via runWithTenantContext
- [ ] No-emoji decision-006, lint, typecheck

---

## 5. Fichiers crees / modifies

```
CREES :
repo/packages/database/src/migrations/1715000000013-UserIcalToken.ts            ~60 lignes
repo/packages/booking/src/services/ical-export.service.ts                      ~340 lignes
repo/packages/booking/src/services/ical-cache.service.ts                       ~140 lignes
repo/packages/booking/src/services/ical-export.service.spec.ts                 ~280 lignes
repo/packages/booking/src/services/ical-cache.service.spec.ts                  ~120 lignes
repo/packages/booking/src/helpers/ical-builder.ts                              ~170 lignes
repo/packages/booking/src/helpers/ical-builder.spec.ts                         ~150 lignes
repo/packages/booking/src/schemas/ical.schema.ts                                 ~50 lignes
repo/apps/api/src/modules/booking/controllers/ical.controller.ts                ~80 lignes
repo/apps/api/src/modules/booking/controllers/ical-management.controller.ts   ~120 lignes
repo/apps/api/test/booking/ical.e2e-spec.ts                                    ~320 lignes
repo/apps/api/test/booking/ical-rfc-compliance.e2e-spec.ts                     ~160 lignes
repo/00-pilotage/decisions/031-ical-feed-token-strategy.md                    ~150 lignes

MODIFIES :
repo/packages/booking/src/booking.module.ts                                      +6 lignes
repo/packages/booking/src/index.ts                                              +10 lignes
repo/apps/api/src/modules/booking/booking.module.ts                              +3 lignes
repo/packages/booking/package.json                                                +2 lignes
repo/apps/api/src/modules/observability/otel-config.ts                          +5 lignes
repo/packages/shared-config/src/env.schema.ts                                    +7 lignes
```

Total ~2200 lignes.

---

## 6. Code patterns COMPLETS

### 6.1 Fichier 1 sur 11 : Migration

```typescript
// repo/packages/database/src/migrations/1715000000013-UserIcalToken.ts
import type { MigrationInterface, QueryRunner } from 'typeorm';

export class UserIcalToken1715000000013 implements MigrationInterface {
  name = 'UserIcalToken1715000000013';

  public async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      ALTER TABLE auth_users
        ADD COLUMN IF NOT EXISTS ical_token VARCHAR(64) NULL,
        ADD COLUMN IF NOT EXISTS ical_token_created_at TIMESTAMPTZ NULL,
        ADD COLUMN IF NOT EXISTS ical_token_last_accessed_at TIMESTAMPTZ NULL,
        ADD COLUMN IF NOT EXISTS ical_token_access_count INTEGER NOT NULL DEFAULT 0
    `);
    await qr.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_users_ical_token
        ON auth_users(ical_token) WHERE ical_token IS NOT NULL
    `);
    await qr.query(`
      COMMENT ON COLUMN auth_users.ical_token IS
        'Random 32 bytes base64url. UNIQUE when set. Sprint 8 task 3.1.13.'
    `);
  }

  public async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP INDEX IF EXISTS idx_auth_users_ical_token`);
    await qr.query(`
      ALTER TABLE auth_users
        DROP COLUMN IF EXISTS ical_token,
        DROP COLUMN IF EXISTS ical_token_created_at,
        DROP COLUMN IF EXISTS ical_token_last_accessed_at,
        DROP COLUMN IF EXISTS ical_token_access_count
    `);
  }
}
```

### 6.2 Fichier 2 sur 11 : IcalBuilder

```typescript
// repo/packages/booking/src/helpers/ical-builder.ts
import ical, { ICalCalendarMethod, type ICalCalendar, ICalEventStatus } from 'ical-generator';
import type { BookingAppointmentEntity } from '../entities/booking-appointment.entity';
import { TimeRangeHelper } from './time-range.helper';

const DESCRIPTION_MAX_LENGTH = 500;
const TRUNCATION_SUFFIX = '... [tronque dans iCal feed - consulter app Skalean InsurTech]';

export interface IcalBuildInput {
  appointments: BookingAppointmentEntity[];
  calendarName: string;
  calendarDescription?: string;
}

export class IcalBuilder {
  static build(input: IcalBuildInput): string {
    const cal: ICalCalendar = ical({
      name: input.calendarName,
      description: input.calendarDescription,
      prodId: '-//Skalean InsurTech//Booking Feed v1//FR',
      method: ICalCalendarMethod.PUBLISH,
      timezone: 'UTC',
      ttl: 60 * 60,
    });

    for (const appt of input.appointments) {
      try {
        const range = TimeRangeHelper.parseTimeRange(appt.time_range);
        cal.createEvent({
          id: `${appt.id}@skalean-insurtech.ma`,
          summary: IcalBuilder.sanitizeText(appt.subject ?? 'RDV Skalean'),
          description: IcalBuilder.buildDescription(appt),
          location: IcalBuilder.buildLocation(appt),
          start: range.start,
          end: range.end,
          status: IcalBuilder.mapStatus(appt.status),
          created: appt.created_at,
          lastModified: appt.updated_at,
          url: `https://app.skalean-insurtech.ma/booking/appointments/${appt.id}`,
        });
      } catch {
        continue;  // skip malformed time_range
      }
    }

    return cal.toString();
  }

  static buildEmpty(calendarName: string): string {
    return ical({
      name: calendarName,
      prodId: '-//Skalean InsurTech//Booking Feed v1//FR',
      method: ICalCalendarMethod.PUBLISH,
      timezone: 'UTC',
    }).toString();
  }

  private static buildDescription(appt: BookingAppointmentEntity): string {
    const parts: string[] = [];
    if (appt.description) parts.push(appt.description);
    parts.push('--');
    parts.push('Skalean InsurTech');
    if (appt.metadata?.contact_name && typeof appt.metadata.contact_name === 'string') {
      parts.push(`Contact: ${appt.metadata.contact_name}`);
    }
    if (appt.metadata?.deal_title && typeof appt.metadata.deal_title === 'string') {
      parts.push(`Deal: ${appt.metadata.deal_title}`);
    }
    let full = parts.join('\n\n');
    if (full.length > DESCRIPTION_MAX_LENGTH) {
      full = full.substring(0, DESCRIPTION_MAX_LENGTH - TRUNCATION_SUFFIX.length) + TRUNCATION_SUFFIX;
    }
    return IcalBuilder.sanitizeText(full);
  }

  private static buildLocation(appt: BookingAppointmentEntity): string | undefined {
    const room = (appt as { room?: { name?: string; location?: string; deleted_at?: Date | null } }).room;
    if (!room) return undefined;
    if (room.deleted_at) return 'Salle supprimee';
    const parts: string[] = [];
    if (room.name) parts.push(room.name);
    if (room.location) parts.push(room.location);
    return parts.length > 0 ? parts.join(' - ') : undefined;
  }

  private static mapStatus(status: string): ICalEventStatus {
    switch (status) {
      case 'scheduled': return ICalEventStatus.TENTATIVE;
      case 'confirmed': return ICalEventStatus.CONFIRMED;
      default: return ICalEventStatus.CONFIRMED;
    }
  }

  private static sanitizeText(text: string): string {
    if (!text) return '';
    let sanitized = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    sanitized = sanitized.replace(/[\u{1F300}-\u{1F9FF}]/gu, '');
    sanitized = sanitized.replace(/[\u{2600}-\u{27BF}]/gu, '');
    return sanitized;
  }
}
```

### 6.3 Fichier 3 sur 11 : IcalCacheService

```typescript
// repo/packages/booking/src/services/ical-cache.service.ts
import { Injectable, Inject } from '@nestjs/common';
import type { Redis } from 'ioredis';
import type { Logger } from 'pino';
import { gzipSync, gunzipSync } from 'zlib';

@Injectable()
export class IcalCacheService {
  private readonly ttlSeconds: number;
  private readonly gzipThresholdBytes: number;
  private static readonly UNCOMPRESSED_PREFIX = 'u:';
  private static readonly COMPRESSED_PREFIX = 'z:';

  constructor(
    @Inject('REDIS_CLIENT_ICAL') private readonly redis: Redis,
    @Inject('PINO_LOGGER') private readonly logger: Logger,
  ) {
    this.ttlSeconds = Number(process.env.ICAL_FEED_CACHE_TTL_SECONDS ?? 300);
    this.gzipThresholdBytes = Number(process.env.ICAL_FEED_GZIP_THRESHOLD_BYTES ?? 10240);
  }

  private buildKey(token: string): string { return `ical_feed:${token}`; }

  async get(token: string): Promise<string | null> {
    try {
      const raw = await this.redis.get(this.buildKey(token));
      if (!raw) return null;
      if (raw.startsWith(IcalCacheService.COMPRESSED_PREFIX)) {
        const compressed = Buffer.from(raw.substring(2), 'base64');
        return gunzipSync(compressed).toString('utf8');
      }
      if (raw.startsWith(IcalCacheService.UNCOMPRESSED_PREFIX)) {
        return raw.substring(2);
      }
      return raw;
    } catch (error) {
      this.logger.warn({ err: error, action: 'ical_cache_get_failed' }, 'Cache get failed');
      return null;
    }
  }

  async set(token: string, content: string): Promise<void> {
    try {
      const sizeBytes = Buffer.byteLength(content, 'utf8');
      let stored: string;
      if (sizeBytes >= this.gzipThresholdBytes) {
        const compressed = gzipSync(content);
        stored = IcalCacheService.COMPRESSED_PREFIX + compressed.toString('base64');
      } else {
        stored = IcalCacheService.UNCOMPRESSED_PREFIX + content;
      }
      await this.redis.setex(this.buildKey(token), this.ttlSeconds, stored);
    } catch (error) {
      this.logger.warn({ err: error, action: 'ical_cache_set_failed' }, 'Cache set failed');
    }
  }

  async invalidate(token: string): Promise<void> {
    try {
      await this.redis.del(this.buildKey(token));
    } catch (error) {
      this.logger.warn({ err: error }, 'Cache invalidate failed');
    }
  }

  async exists(token: string): Promise<boolean> {
    try {
      return (await this.redis.exists(this.buildKey(token))) === 1;
    } catch { return false; }
  }
}
```

### 6.4 Fichier 4 sur 11 : IcalExportService

Service principal 6 methodes : `generateFeed(token)` valide format regex strict, cache lookup, findByToken filter deleted_at NULL, runWithTenantContext, query appointments LIMIT 500 filter status scheduled+confirmed range 90j, IcalBuilder.build, cache set, async recordAccess + Kafka publish event ical_feed.accessed. `regenerateToken(userId, tenantId)` fetch ancien, cache invalidate, randomBytes(32).toString('base64url'), UPDATE auth_users, Kafka publish ical_token.regenerated. `revokeToken(userId, tenantId)` fetch + invalidate + UPDATE clear + Kafka publish ical_token.revoked. `findByToken(token)` raw query filter deleted_at NULL. `getMyToken(userId, tenantId)` read + URL build + stats. `getStatistics(userId, tenantId)` aggregate counts. Regex strict `TOKEN_REGEX = /^[A-Za-z0-9_-]{43,44}$/`. Token prefix dans logs (8 chars), jamais full token.

### 6.5 Fichier 5 sur 11 : Schemas Zod

```typescript
import { z } from 'zod';
export const IcalTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43,44}$/);
export const RegenerateTokenSchema = z.object({}).strict();
export const RevokeTokenSchema = z.object({}).strict();
```

### 6.6 Fichier 6 sur 11 : IcalController public

```typescript
@ApiTags('Booking iCal Feed (Public)')
@Controller('booking/ical')
export class IcalController {
  constructor(private readonly icalService: IcalExportService) {}

  @Get(':token.ics')
  @Throttle({ default: { limit: 60, ttl: 3600000 } })
  async getFeed(@Param('token') token: string, @Res() res: Response): Promise<void> {
    const content = await this.icalService.generateFeed(token);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="skalean-calendar.ics"');
    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    res.send(content);
  }
}
```

### 6.7 Fichier 7 sur 11 : IcalManagementController auth

```typescript
@ApiTags('Booking iCal Feed (Management)')
@ApiBearerAuth()
@Controller('booking/ical')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
@UseInterceptors(TenantTransactionInterceptor)
export class IcalManagementController {
  constructor(private readonly icalService: IcalExportService) {}

  @Get('me/token')
  @RequirePermission(Permission.BOOKING_ICAL_MANAGE)
  async getMyToken(@CurrentUser() user: AuthenticatedUser) {
    return this.icalService.getMyToken(user.id, user.tenantId);
  }

  @Post('regenerate')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 86400000 } })
  @RequirePermission(Permission.BOOKING_ICAL_MANAGE)
  async regenerate(@CurrentUser() user: AuthenticatedUser) {
    return this.icalService.regenerateToken(user.id, user.tenantId);
  }

  @Delete('revoke')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(Permission.BOOKING_ICAL_MANAGE)
  async revoke(@CurrentUser() user: AuthenticatedUser) {
    return this.icalService.revokeToken(user.id, user.tenantId);
  }

  @Get('me/statistics')
  @RequirePermission(Permission.BOOKING_ICAL_MANAGE)
  async getStatistics(@CurrentUser() user: AuthenticatedUser) {
    return this.icalService.getStatistics(user.id, user.tenantId);
  }
}
```

### 6.8 Fichiers 8-11 : Tests + integrations

**Spec service (14 tests)** : token short rejete BadRequest, caracteres invalides BadRequest, inexistant NotFound, cache hit retourne, miss + generate + populate cache, Kafka event publie miss, feed valid 0 appointments, record access async non-blocking, regenerate format base64url 43-44 chars, regenerate Kafka publie, NotFound user absent, regenerate meme si null, entropy distinctes 2 regenerations, revoke hard delete + invalidate, revoke Kafka publie, getMyToken null absent, getMyToken token + url + stats, getStatistics struct.

**Spec cache (4 tests)** : set+get small uncompressed prefix u:, set+get large gzip prefix z:, get null absent, invalidate DEL key.

**Spec builder (6 tests)** : structure RFC valide BEGIN/END VCALENDAR + PRODID + VERSION + METHOD, UID format @skalean-insurtech.ma, skip malformed time_range silent, description truncation 500 + suffix, location room.name + room.location, strict UTC DTSTART:YYYYMMDDTHHMMSSZ pas DTSTART;TZID, emoji strip decision-006, escape RFC special chars.

**E2E (12 tests)** : management regenerate format base64url, GET me/token null initial, GET me/token apres regenerate, DELETE revoke clear, public GET feed headers Content-Type+Disposition+Cache-Control, feed appointments confirmed futurs UID match, exclus cancelled, token invalide 404, format invalide 400, regenerate invalide ancien, access count incremente, GET me/statistics struct.

**E2E RFC compliance (4 tests via node-ical@0.20.1)** : empty feed parseable, feed avec events parseable + extract uid+summary+start+end+status TENTATIVE/CONFIRMED, structure BEGIN/END VCALENDAR balanced, PRODID+VERSION 2.0+METHOD PUBLISH obligatoires.

---

## 7. Tests complets

40 tests total : 14 unit service + 4 cache + 6 builder + 12 E2E management/public + 4 RFC compliance.

---

## 8. Variables environnement

```env
ICAL_FEED_CACHE_TTL_SECONDS=300
ICAL_FEED_RANGE_DAYS=90
ICAL_FEED_RATE_LIMIT_PER_HOUR=60
ICAL_FEED_MAX_EVENTS=500
ICAL_FEED_GZIP_THRESHOLD_BYTES=10240
REDIS_ICAL_DB=6
API_BASE_URL=https://api.skalean-insurtech.ma
```

---

## 9. Commandes shell

```bash
cd repo
pnpm add ical-generator@8.0.1 --filter @insurtech/booking
pnpm add -D node-ical@0.20.1 --filter api
pnpm --filter @insurtech/database migrate:run
psql $DATABASE_URL -c "\\d auth_users" | grep -i ical_token
pnpm --filter @insurtech/booking typecheck
pnpm --filter @insurtech/booking test ical
pnpm --filter api e2e -- --testPathPattern="booking/ical"
JWT=$(curl -s -X POST localhost:4000/api/v1/auth/login -H "Content-Type: application/json" -d '{"email":"...","password":"..."}' | jq -r .data.access_token)
TOKEN=$(curl -s -X POST localhost:4000/api/v1/booking/ical/regenerate -H "Authorization: Bearer $JWT" -H "x-tenant-id: $TENANT" | jq -r .data.token)
curl "localhost:4000/api/v1/booking/ical/${TOKEN}.ics"
curl -s "localhost:4000/api/v1/booking/ical/${TOKEN}.ics" | node -e "const ical = require('node-ical'); const text = require('fs').readFileSync(0, 'utf8'); const parsed = ical.parseICS(text); console.log('Events:', Object.values(parsed).filter(v => v.type === 'VEVENT').length);"
redis-cli -n 6 KEYS "ical_feed:*"
for i in {1..70}; do curl -s -o /dev/null -w "%{http_code} " "localhost:4000/api/v1/booking/ical/${TOKEN}.ics"; done
git add -A && git commit -m "feat(sprint-08): booking ical feed export token-based RFC 5545"
```

---

## 10. Criteres validation V1-V32

### Criteres P0 (20)

V1 Migration colonnes ical_token + created_at + last_accessed_at + access_count + UNIQUE index partial.
V2 typecheck exit 0.
V3 40 tests PASS (14 unit + 4 cache + 6 builder + 12 E2E + 4 RFC).
V4 GET /ical/:token.ics retourne feed RFC 5545 parseable node-ical.
V5 Token format strict `[A-Za-z0-9_-]{43,44}`.
V6 Entropy 256 bits theorique (statistique 100 generations distinctes).
V7 Regenerate revoke ancien + invalide cache.
V8 Revoke hard delete + invalide cache.
V9 Feed scheduled+confirmed futurs uniquement.
V10 Feed exclut cancelled, no_show, completed, external.
V11 Cache Redis db=6 TTL 5min.
V12 Gzip compression > 10 KB.
V13 Rate limit 60/h public (61eme -> 429).
V14 Rate limit 10/day regenerate.
V15 Content-Type text/calendar; charset=utf-8.
V16 Content-Disposition inline filename="skalean-calendar.ics".
V17 Cache-Control no-cache, must-revalidate.
V18 Multi-tenant isolation via runWithTenantContext.
V19 Permission BOOKING_ICAL_MANAGE consume 4 endpoints auth.
V20 Endpoint public skip RBAC (token-auth implicite).

### Criteres P1 (8)

V21 Range 90 jours futur strict.
V22 UID format `{uuid}@skalean-insurtech.ma` global unique.
V23 Description truncation 500 chars + suffix.
V24 Kafka events : `ical_feed.accessed`, `ical_token.regenerated`, `ical_token.revoked`.
V25 OpenTelemetry redact `:token` path param.
V26 Access count incremente sur public GET.
V27 Last_accessed_at update sur public GET.
V28 Cache hit ratio > 70 pour cent steady state.

### Criteres P2 (4)

V29 No-emoji decision-006.
V30 Lint 0 erreur 0 warning.
V31 Swagger 5 endpoints + examples.
V32 Coverage ical-export.service >= 92%.

---

## 11. Edge cases + troubleshooting (18 cas)

1. **Feed 0 events** : valide RFC minimal sans VEVENT. `IcalBuilder.buildEmpty()`.
2. **Regenerate idempotent double-click** : 2 tokens distincts, second invalide premier. Transaction atomicite.
3. **Appointment apres cache set** : apparait apres expiry 5min max. Sprint 13+ pubsub si critique.
4. **Scraping 200 polls/h** : 429 apres 60eme. Sprint 13+ alerting 5+ tokens-IPs.
5. **Token leak via logs** : OpenTelemetry redact `[REDACTED]` Sprint 3 task 1.3.4.
6. **Concurrent regenerate cross-instances** : serializable transaction + UNIQUE.
7. **User soft-delete** : `findByToken` filter `deleted_at NULL`. 404.
8. **Token base64 padding `=`** : regex rejete. Force base64url sans.
9. **UTF-8 caracteres speciaux** : charset utf-8 declare. ical-generator handle.
10. **Description > 500 chars** : truncated + suffix `... [tronque dans iCal feed]`.
11. **Description emoji** : `IcalBuilder.sanitizeText` strip Unicode emoji ranges.
12. **Room soft-deleted** : Location = "Salle supprimee" fallback.
13. **Performance 500 appointments** : LIMIT cap. Generation < 100ms p95.
14. **Multi-tenant email reuse** : token UNIQUE globalement, RLS isolations.
15. **Redis OOM** : try/catch + log WARN + degrade gracefully (regenere chaque req).
16. **Network timeout** : client iCal retry next poll. Sprint 13+ circuit breaker.
17. **Regenerate rate limit frenetic** : @Throttle 10/day enforce.
18. **Multi-IP same token** : Apple + Outlook + Google polls simultanes. Limit per-token (pas IP).

---

## 12. Conformite Maroc detaillee

**Loi 09-08 (CNDP)**

- Article 4 (licite + loyal + transparent) : generation feed authorisee user via regenerate explicit. RLS Postgres + assigned_user_id filter. Couvert CGU.
- Article 5 (pertinent + non excessif) : expose subjects + dates + locations + descriptions truncate 500. Pas phone/email clients, pas montants deals, pas notes commercial detaillees.
- Article 9 (droit a l'effacement) : revoke endpoint immediat efface (cache + DB). Soft-delete user automatic revoke via filter.
- Article 12 (categories particulieres) : aucune donnee sensible. Sprint 14 polices sante introduira si necessaire.
- Article 22 (mesures securite) : token entropy 256 + rate limit 60/h + cache + filter strict + audit log + path redact. Multi-tenant RLS. AES-256-GCM disk Atlas. TLS 1.3.
- Article 32 (tracabilite) : audit_logs capture regenerate/revoke/access. Retention 5 ans. Sprint 28 admin reports export.

**Decret 2-09-165**

- Article 18 (information personne) : CGU + UI Settings Sprint 16 disclaimer "URL feed expose vos RDV. Partagez discretement."
- Article 22 (securite technique) : mesures detaillees ci-dessus.

**ACAPS Circulaire AS/02/24**

Audit_logs forensique disponible si litige. Retention 5 ans conforme.

**Loi 17-99 (Code Assurances)**

Sprint 14 polices sync events souscriptions vers feed automatic.

**Decision-008 (Data residency)**

Token + cache + audit Atlas Cloud Benguerir MA. Pas transfert hors MA.

**OWASP ASVS Niveau 3 (cible Sprint 33 pentest)**

- V2.1 Authentication : entropy 256 bits >> 64 bits minimum.
- V2.2 Session management : revocable explicitement.
- V3.3 Session expiry : manual revocation only (acceptable user-bound).
- V4 Access control : token + RLS multi-tenant + range futur + status filter.
- V5 Validation : regex strict + Zod amont.
- V7 Cryptography : crypto.randomBytes Node.js cryptographic PRNG.
- V8 Data protection : token clair acceptable (ressource public once known). Cache + logs redacted.
- V12 API : rate limit 60/h. Audit log redact.
- V13 Logging : audit_logs capture IP + user-agent.

---

## 13. Conventions absolues skalean-insurtech (14 categories rappelees)

Multi-tenant strict (header x-tenant-id + RLS + AsyncLocalStorage). Validation Zod (jamais class-validator). Logger Pino structure (jamais console.log). Hash password argon2id (non concerne). Package manager pnpm engine-strict Node >= 22.11.0. TypeScript strict noUncheckedIndexedAccess noImplicitAny noImplicitReturns. Tests Vitest unit + Playwright E2E coverage 92+. RBAC @RequirePermission + 12 roles + 85+ permissions. Events Kafka topics `insurtech.events.booking.ical_*`. Imports `@insurtech/*` pas chemins relatifs. Skalean AI via package (non concerne). No-emoji decision-006 ABSOLU. Idempotency-Key (non requis token reuse idempotent). Conventional Commits `feat(sprint-08): description`. Cloud souverain MA Atlas Cloud Services Benguerir AES-256-GCM TLS 1.3.

---

## 14. Validation pre-commit

```bash
cd repo
pnpm --filter @insurtech/booking typecheck
pnpm --filter @insurtech/booking lint
pnpm --filter @insurtech/booking test
pnpm --filter api e2e -- --testPathPattern="booking/ical"
grep -rP "[\x{1F300}-\x{1F9FF}]|[\x{2600}-\x{27BF}]" packages/booking/src apps/api/src/modules/booking/controllers/ical*.ts apps/api/test/booking/ical*.ts --include="*.ts" --include="*.md" && exit 1 || echo OK
grep -rn "this.logger.*\${token}" packages/booking/src --include="*.ts" && exit 1 || echo OK
grep -rn "TOKEN_REGEX" packages/booking/src --include="*.ts"
```

---

## 15. Commit message complet

```bash
git add -A
git commit -m "feat(sprint-08): booking ical feed export token-based RFC 5545

Alternative legere a OAuth sync (taches 3.1.10/3.1.12). Feed RFC 5545 via ical-generator 8.0.1
avec escaping automatique + truncation description 500 chars. Token random 32 bytes base64url
stocke auth_users.ical_token UNIQUE (entropy 256 bits). Endpoint public token-based +
4 endpoints auth (regenerate/revoke/me/token/statistics). Cache Redis db=6 TTL 5min avec gzip
compression > 10 KB. Rate limit 60 req/h per token (public) + 10/day regenerate (auth) via @Throttle.

Livrables:
- Migration auth_users.ical_token + created_at + last_accessed_at + access_count + UNIQUE index partial
- IcalExportService (6 methods) + IcalCacheService (gzip) + IcalBuilder (RFC 5545 via ical-generator 8.0.1)
- IcalController public + IcalManagementController auth (5 endpoints REST)
- 40 tests : 14 unit service + 4 cache + 6 builder + 12 E2E + 4 RFC compliance (node-ical parser roundtrip)
- Audit log redaction Sprint 3 task 1.3.4 modification (token path param)
- Decision document 031-ical-feed-token-strategy.md

Conformite: CNDP loi 09-08 articles 4/5/9/12/22/32, OWASP ASVS Niveau 3 V2.1+V12 (entropy + rate limit)
Coverage: 92%
Performance: cache hit < 5ms, cache miss < 100ms p95 sur 100 appointments

Task: 3.1.13 / Sprint: 8 / Reference: B-08 Tache 3.1.13"
```

---

## 16. Workflow next step

Apres commit :
- Verifier migration : `psql $DATABASE_URL -c "\\d auth_users" | grep ical_token` retourne 4 lignes.
- Verifier tests E2E + RFC : `pnpm --filter api e2e -- --testPathPattern="booking/ical"` retourne 16 PASS.
- Smoke manuel : login user, regenerate token, subscribe URL dans Apple Calendar / Google Calendar, verifier events.
- Update `_SUMMARY.md` Sprint 8 : tache 3.1.13 status = complete.
- Passer a `task-3.1.14-tests-e2e-exhaustifs-seeds-dev.md` (cloture Sprint 8).

---

**Fin task-3.1.13-booking-ical-feed-export-token-based.md (etat propre coherent).**

Densite : ~55 ko (limite outil Write effective)
Code patterns : 11 fichiers references (2 complets + 9 condenses interfaces + signatures)
Tests : 40 cas (14 unit service + 4 cache + 6 builder + 12 E2E + 4 RFC compliance)
Criteres validation : V1-V32 (20 P0 + 8 P1 + 4 P2)
Edge cases : 18 detailles
Conventions absolues : 14 categories rappelees
Conformite MA : Loi 09-08 6 articles + decret 2-09-165 + ACAPS + decision-008 + OWASP ASVS L3

---

## ANNEXE A -- RFC 5545 iCalendar Specification Mapping Skalean

### A.1 Properties RFC 5545 obligatoires + optionnelles supportees

RFC 5545 (Internet Calendaring and Scheduling Core Object Specification, IETF septembre 2009) definit la structure standard pour echanger des informations calendrier entre systemes heterogenes. Le format est utilise universellement depuis 1998 (RFC 2445 original) et est supporte par tous les clients calendrier modernes (Google Calendar, Apple Calendar, Outlook, Thunderbird, Proton, FastMail, Yahoo, Zoho, Zimbra, Lotus Notes, etc.). Skalean InsurTech v2.2 produit des feeds RFC 5545-compliant pour assurer la compatibilite maximale.

#### A.1.1 Properties VCALENDAR (container)

| Property | Obligatoire | Skalean value | Notes |
|----------|-------------|---------------|-------|
| BEGIN:VCALENDAR | Oui | Toujours present | Start marker |
| END:VCALENDAR | Oui | Toujours present | End marker |
| VERSION | Oui | `2.0` | RFC 5545 version |
| PRODID | Oui | `-//Skalean InsurTech//Booking Feed v1//FR` | Product identifier |
| METHOD | Recommande | `PUBLISH` | One-way push |
| NAME | Optionnel | `Skalean - {email}` | X-WR-CALNAME |
| DESCRIPTION | Optionnel | `Vos RDV Skalean InsurTech...` | X-WR-CALDESC |
| TIMEZONE | Recommande | `UTC` (strict) | Skalean UTC seulement |
| TTL | Optionnel | `PT1H` (1 heure) | Refresh hint client |

#### A.1.2 Properties VEVENT (per appointment)

| Property | Obligatoire | Skalean value | Notes |
|----------|-------------|---------------|-------|
| BEGIN:VEVENT | Oui | Per appointment | |
| END:VEVENT | Oui | Per appointment | |
| UID | Oui | `{appointment_uuid}@skalean-insurtech.ma` | Globalement unique |
| DTSTAMP | Oui | UTC ISO timestamp | Last modification |
| DTSTART | Oui | UTC `YYYYMMDDTHHMMSSZ` | Strict UTC |
| DTEND | Oui (si pas DURATION) | UTC `YYYYMMDDTHHMMSSZ` | |
| SUMMARY | Recommande | Appointment subject | Truncate emoji decision-006 |
| DESCRIPTION | Optionnel | Truncate 500 chars + suffix | Escape RFC special chars |
| LOCATION | Optionnel | Room name + location | Fallback "Salle supprimee" |
| STATUS | Optionnel | TENTATIVE \| CONFIRMED | Skalean scheduled -> TENTATIVE |
| URL | Optionnel | `https://app.skalean-insurtech.ma/...` | Click-through |
| CREATED | Optionnel | UTC ISO | Audit |
| LAST-MODIFIED | Optionnel | UTC ISO | Audit |
| CLASS | Optionnel | `PUBLIC` | Visibility (default public) |

#### A.1.3 Properties Skalean N'utilise PAS (volontairement)

- ATTENDEE : pas inclus pour privacy (expose contact info clients)
- ORGANIZER : pas inclus pour simplicite (1 organizer = user)
- RRULE / RDATE / EXDATE : recurring events pas supportes Sprint 8 (Sprint 13+ possible)
- ALARM / VALARM : alarmes/reminders pas inclus (frontend client gere)
- ATTACH : attachments pas supportes
- CATEGORIES : pas utilise
- GEO : pas utilise (location text suffit)
- RESOURCES : pas inclus
- PRIORITY : pas inclus (tous appointments egal)

### A.2 Escaping RFC 5545 caracteres speciaux

RFC 5545 section 3.3.11 (TEXT) impose escaping :

| Char | Escape | Exemple |
|------|--------|---------|
| `\` | `\\` | `Path: c:\\users` |
| `;` | `\;` | `RDV; suite 2` |
| `,` | `\,` | `Mohamed, Karima` |
| `\n` (newline) | `\n` (literal 2 chars) | `Line1\nLine2` |

ical-generator 8.0.1 library escape automatiquement. Test V_escape via parser node-ical roundtrip valide format.

### A.3 Folding lignes longues (RFC 5545 section 3.1)

RFC 5545 impose qu'aucune ligne ne depasse 75 octets. Les lignes plus longues doivent etre "folded" : continuer sur ligne suivante avec espace prefixe. ical-generator gere automatiquement.

Exemple description longue :

```
DESCRIPTION:Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eius
 mod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim ven
 iam quis nostrud exercitation ullamco laboris.
```

Les 2 espaces de continuation sont normaux et conformes. Test V_folding via node-ical parser handle correct.

## ANNEXE B -- Client iCal Compatibility Matrix Detaillee

### B.1 Frequences de poll par client iCal majeurs

| Client | Default poll | Configurable | Min poll | Note version |
|--------|--------------|--------------|----------|-------------|
| Apple Calendar iOS (15+) | 5-15 min auto | Oui | 5 min | Adaptive based on usage |
| Apple Calendar macOS (Ventura+) | 5 min | Oui | 5 min | Background refresh permission required |
| Google Calendar Web | 12 hours | Non standalone | N/A | Background fetch limited |
| Google Calendar Android | 12-24 hours | Non | N/A | Sync settings global |
| Microsoft Outlook 2019+ Desktop | 15 min | Oui via Send/Receive Groups | 1 min | Group Policy override possible |
| Microsoft Outlook Web Access | 60 min | Non standalone | N/A | Microsoft 365 controled |
| Outlook Mobile iOS/Android | 30-60 min | Oui | 15 min | Push notification fallback |
| Thunderbird Lightning | 30 min | Oui | 5 min | Configurable per calendar |
| Proton Calendar | 60 min | Non | N/A | New product, limited config |
| FastMail Calendar | 60 min | Oui | 30 min | Server-side scheduled |
| Yahoo Calendar | 24 hours | Non | N/A | Limited maintenance |
| Zoho Calendar | 30 min | Oui | 15 min | Business product |
| Zimbra | 60 min | Oui via prefs | 30 min | Open source self-hosted |

Skalean rate limit 60 req/h couvre tous ces clients legitimes meme avec multi-device (laptop + mobile = 2 polls/15min Apple = 8/h max).

### B.2 Features iCal supportees par client

| Feature | Apple | Google | Outlook | Thunderbird | Proton |
|---------|-------|--------|---------|-------------|--------|
| VEVENT basic | Oui | Oui | Oui | Oui | Oui |
| UID stable | Oui | Oui | Oui | Oui | Oui |
| STATUS (TENTATIVE/CONFIRMED) | Oui | Oui | Oui | Oui | Partiel |
| LOCATION | Oui | Oui | Oui | Oui | Oui |
| DESCRIPTION longue | Oui | Tronque 8KB | Oui | Oui | Oui |
| URL clickable | Oui | Oui | Oui | Oui | Oui |
| ALARM/VALARM | Oui | Limite | Oui | Oui | Oui |
| Recurring RRULE | Oui | Oui | Oui | Oui | Oui |
| Timezone TZID | Oui | Oui | Oui | Oui | Limite |
| UTF-8 charset | Oui | Oui | Oui | Oui | Oui |
| Folding 75 chars | Tolerant | Strict | Tolerant | Tolerant | Strict |

Skalean Sprint 8 utilise sous-ensemble compatible 100 pour cent clients : VEVENT + UID + STATUS + LOCATION + DESCRIPTION + URL + UTC strict. Pas de RRULE (Sprint 13+).

### B.3 Erreurs frequentes clients legacy

| Client legacy | Erreur frequente | Mitigation Skalean |
|---------------|------------------|--------------------|
| Outlook 2010 Windows | Refuse feed > 512 KB | MAX_EVENTS=500 cap |
| Outlook 2007 | UTF-8 mal-gere certains chars | sanitizeText strip control chars |
| Apple Calendar iOS 12- | Refuse PRODID non-Apple | PRODID Skalean conforme RFC |
| Thunderbird Lightning < 60 | Crash recurring sans DTSTART | Pas de RRULE Sprint 8 |
| Lotus Notes | Refuse status sans VALUE | Skalean inclut STATUS uppercase RFC |
| Outlook for Mac < 2016 | Limite events feed 200 | MAX_EVENTS 500 mais Sprint 8 typical < 50 |

## ANNEXE C -- Security Threat Model Detaille

### C.1 STRIDE analysis Sprint 33 pentest cible

| Threat | Description | Skalean mitigation Sprint 8 | Residual risk |
|--------|-------------|---------------------------|--------------|
| **S**poofing identity | Attaquant utilise token vole pour acceder feed | Token entropy 256 bits inguessable + rate limit + audit IP | Low (require physical token leak) |
| **T**ampering data | Modifier feed transit | TLS 1.3 mandatory + Content-Type integrity | Very low |
| **R**epudiation | User nie avoir cree token | Audit_logs capture regenerate + revoke avec actor_user_id + IP + timestamp | None (forensic complet) |
| **I**nformation disclosure | Token leak via logs/screenshot | OpenTelemetry redact + documentation user partage discret + sensitive description truncation 500 | Medium (depend user behavior) |
| **D**enial of Service | Scraping massif epuise quota DB/Redis | Rate limit 60/h + cache 5min absorbe 80% + WAF Sprint 33 | Low |
| **E**levation of privilege | Token revele identite user pour autre acces | Token uniquement read feed (no write), pas de session/JWT derived | None (compartimente) |

### C.2 Attack scenarios + countermeasures

**Scenario 1 : Token bruteforce attack**
- Attaquant tente 1M tokens random pour matcher.
- Avec 256 bits entropy : probabilite collision = 2^256 = 1.16e77 espace, vs ~6e9 humains mondialement, vs 2^32 = 4.3e9 secondes en 136 ans.
- Mathematiquement impossible meme avec 10^9 tentatives/seconde sur 100 ans.
- Mitigation : rate limit 60/h limite bruteforce a 525,000/an max. Inadequat pour attaque.
- Sprint 33 pentest validera entropy effective via crypto.randomBytes Node.js (CSPRNG).

**Scenario 2 : Token interception via reseau non-securise**
- User connecte feed Apple Calendar sur cafe WiFi public.
- Attaquant network sniffer capture URL HTTPS (header decrypte si MITM cert installed).
- Mitigation : HTTPS strict + HSTS preload + certificate pinning Apple iOS native + Skalean HSTS header.
- Residual : si user accept fake CA, token compromis. Documentation user training.

**Scenario 3 : Token leak via copy-paste accidentel**
- User screenshot URL pour partage IT support.
- Mitigation : revoke endpoint immediate + audit log detection IP changes patterns.
- Sprint 13+ alerting si IP geolocalisation different > 1000km dans 1h.

**Scenario 4 : Insider threat (DBA Skalean)**
- DBA exporte auth_users + obtient tokens cleartext.
- Mitigation : RLS Postgres (DBA voit avec sudo only) + audit DBA queries Sprint 12 + chiffrement disque AES Atlas.
- Residual : root access DB = total compromission. Sprint 33 audit access controls.

**Scenario 5 : Cross-tenant token reuse**
- Attaquant tenant A obtient token user tenant B (social engineering).
- Mitigation : RLS + runWithTenantContext scope strict tenant + UNIQUE token cross-tenant.
- Residual : Si token valide, attaquant voit feed B. Multi-tenant isolation respect.

**Scenario 6 : Replay attack post-revocation**
- Cache 5min permet replay token revoque pendant ~5min apres revocation.
- Mitigation : revoke invalide cache immediatement + DB UPDATE clear token.
- Residual : Sprint 8 acceptable. Sprint 13+ pubsub invalidation cross-instances.

### C.3 OWASP Top 10 2021 mapping

| OWASP risk | Applicable | Skalean mitigation |
|------------|-----------|--------------------|
| A01 Broken Access Control | Oui | RLS + RBAC + ABAC + tenant context |
| A02 Cryptographic Failures | Oui | Token CSPRNG + TLS 1.3 + AES-256-GCM tokens chiffres calendar (3.1.10) |
| A03 Injection | Oui | Zod validation + Postgres prepared statements + token regex strict |
| A04 Insecure Design | Partiel | Threat model documente + Sprint 33 pentest review |
| A05 Security Misconfiguration | Oui | Helmet + CORS + CSP headers Sprint 1 task 1.1.X |
| A06 Vulnerable Components | Oui | Dependabot + Snyk Sprint 1 task 1.1.10 + pinning versions |
| A07 Identification/Authentication Failures | Oui | Token entropy + rate limit + audit |
| A08 Software/Data Integrity Failures | Oui | Audit_logs + Kafka events tamper-evident |
| A09 Security Logging Failures | Oui | Pino structure + OpenTelemetry + redact tokens |
| A10 SSRF | Pas applicable | Pas de fetch externe sur user input ical endpoint |
