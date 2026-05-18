# TACHE 3.1.10 -- Booking CalendarSync OAuth2 (Google + Outlook + Tokens Chiffres AES-GCM)

**Sprint** : 8 (Phase 3 / Sprint 1 dans phase) -- CRM + Booking Foundations
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-08-sprint-08-crm-booking.md` (Tache 3.1.10)
**Phase** : 3 -- Modules Horizontaux Foundation
**Priorite** : P0 (bloque tache 3.1.12 Sync bidir et 3.1.13 iCal feed read-only ; permet aux commerciaux d'integrer leur calendrier perso)
**Effort** : 5h
**Dependances** : Tache 3.1.9 (Appointments), Sprint 5 task 2.1.3 (EncryptionService AES-256-GCM pour tokens), Sprint 1 task 1.1.5 (Redis db=4 reserve pour state PKCE), Sprint 5/6/7 (Auth + Multi-tenant + RBAC)
**Densite cible** : 100-150 ko (auto-suffisant exhaustif)
**AUCUNE EMOJI AUTORISEE**

---

## 1. But

Cette tache 3.1.10 implemente l'infrastructure OAuth2 permettant aux utilisateurs Skalean InsurTech v2.2 de connecter leur calendrier Google Calendar ou Microsoft Outlook a la plateforme, condition prealable pour la synchronisation bi-directionnelle livree tache 3.1.12. Concretement, elle livre la migration TypeORM `1715000000010-BookingCalendarSyncs.ts` creant la table `booking_calendar_syncs` (id, tenant_id, user_id, provider, provider_account_email, access_token_encrypted, refresh_token_encrypted, token_expires_at, scope, status, last_sync_at, metadata), l'entity `BookingCalendarSyncEntity`, le service `CalendarSyncService` exposant six methodes (`initiateOAuth`, `handleOAuthCallback`, `listSyncs`, `disconnect`, `refreshAccessToken`, `getValidAccessToken`), le service `CalendarSyncStateService` Redis db=4 pour stockage PKCE state TTL 10min, les providers `GoogleCalendarProvider` et `OutlookCalendarProvider` encapsulant les SDK googleapis 144.0.0 et microsoft-graph-client 3.0.7, les schemas Zod `InitiateOAuthSchema`, le controller `CalendarSyncController` avec quatre endpoints `/api/v1/booking/calendar-sync/*` proteges Sprint 5/6/7, les helpers crypto pour chiffrer/dechiffrer les tokens via `EncryptionService` Sprint 5 task 2.1.3 (AES-256-GCM avec cle `CALENDAR_TOKENS_ENCRYPTION_KEY` dediee), et les suites de tests (14 unit + 8 E2E + 4 OAuth flow integration tests pour 26 tests total).

L'apport est triple. Premierement, cette tache concretise la separation infrastructure / runtime entre OAuth connection setup (3.1.10) et calendar synchronization runtime (3.1.12). Le decoupage est volontaire pour limiter la complexite : Sprint 8 task 3.1.10 ne livre QUE l'authentification OAuth2 (obtenir et stocker tokens chiffres, refresh quand expired) sans encore syncer les events. Sprint 8 task 3.1.12 livre la couche sync runtime (push appointments Skalean vers provider, pull events provider vers Skalean) qui consomme les tokens stockes par cette tache. Cette separation permet un release incremental : Sprint 8 task 3.1.10 peut etre teste isolement (un commercial peut connecter son Google Calendar et voir le sync apparaitre dans la liste, meme si les events ne se syncent pas encore).

Deuxiemement, cette tache implemente le PKCE (Proof Key for Code Exchange) flow standard OAuth2 RFC 7636 qui protege contre les attaques d'interception du code d'authorization. Le service `initiateOAuth` genere un `code_verifier` (32 bytes random base64url-encoded) et son `code_challenge` (SHA256 du verifier). Le challenge est inclus dans l'URL authorization du provider Google/Outlook. Le verifier est stocke dans Redis db=4 avec TTL 10 minutes, key `oauth_state:{state}` ou state est un random 32 bytes base64url anti-CSRF. Au callback (`handleOAuthCallback(state, code)`), le service recupere le verifier depuis Redis via state, l'envoie au provider avec le code pour echanger contre access_token + refresh_token, supprime l'entry Redis (one-shot usage), chiffre les tokens via EncryptionService, et insert la row dans `booking_calendar_syncs`. Cette rigueur cryptographique est conforme aux exigences OWASP ASVS niveau 3 que Skalean InsurTech vise pour le pentest Sprint 33.

Troisiemement, cette tache chiffre TOUS les tokens OAuth (access_token et refresh_token) au repos dans la base Postgres via `EncryptionService` Sprint 5 task 2.1.3 utilisant AES-256-GCM avec une cle dediee `CALENDAR_TOKENS_ENCRYPTION_KEY` (32 bytes hex, generee au boot via key-rotation policy Sprint 33). Le chiffrement applicatif est defense en profondeur en complement du chiffrement disque Atlas Cloud Services. En cas de breach DB (export `pg_dump` malicieux), les tokens ne sont pas exploitables sans la cle applicative qui reside dans le secret manager (Vault planifie Sprint 33). Cette protection est essentielle car un access_token Google Calendar vol peut permettre a un attaquant d'extraire l'integralite des events calendrier du tenant, donnees potentiellement sensibles (noms clients, sujets RDV, lieux). Le `getValidAccessToken(syncId)` helper expose une methode unique appelee par tous les consumers Sprint 3.1.12 qui retourne automatiquement un token valide (refresh si expired) sans exposer la complexite.

A l'issue de cette tache, le module `@insurtech/booking` exporte `BookingCalendarSyncEntity`, `CalendarSyncService`, `GoogleCalendarProvider`, `OutlookCalendarProvider`. L'app api-skalean expose quatre endpoints `/api/v1/booking/calendar-sync/*`. La commande `pnpm --filter @insurtech/booking test calendar-sync` execute 14 tests unitaires (mock providers). La commande `pnpm --filter api e2e -- --testPathPattern=booking/calendar-sync` execute 8 + 4 = 12 scenarios E2E (mock Google/Outlook responses). Variables d'environnement nouvelles : `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI`, `OUTLOOK_OAUTH_CLIENT_ID`, `OUTLOOK_OAUTH_CLIENT_SECRET`, `OUTLOOK_OAUTH_REDIRECT_URI`, `CALENDAR_TOKENS_ENCRYPTION_KEY` (32 bytes hex), `CALENDAR_SYNC_STATE_TTL_SECONDS` (default 600). Dependances nouvelles : `googleapis@144.0.0`, `@microsoft/microsoft-graph-client@3.0.7`. Total approximativement 2100 lignes de code TypeScript + SQL.

---

## 2. Contexte etendu

### 2.1 Pourquoi cette tache existe

L'integration avec Google Calendar et Microsoft Outlook est une feature systematiquement demandee par les utilisateurs de SaaS B2B en 2024-2026. Selon les sondages Pipedrive et HubSpot, 78 pour cent des commerciaux refusent d'utiliser un CRM qui ne synchronise pas avec leur calendrier personnel. Pour Skalean InsurTech v2.2, ne pas offrir cette integration provoquerait un taux d'abandon utilisateur eleve apres la phase d'onboarding pilote Sprint 35.

Le cas d'usage typique : un commercial broker_user a son agenda professionnel sur Google Calendar (utilisation Gmail professionnel cabinet) ou Outlook (utilisation Office 365 cabinet). Il planifie ses RDV personnels (mediecin, ecole enfants), RDV internes equipe (reunion hebdomadaire), et RDV clients (Skalean appointments). Sans sync, ces trois categories sont disperses entre deux outils (Google Calendar pour perso/interne, Skalean pour clients), generant double-booking frequents (un client planifie a 10h dans Skalean alors qu'une reunion equipe est deja a 10h dans Google). Avec sync bi-directionnel (Sprint 8 task 3.1.12 livre), les Skalean appointments push automatiquement vers Google Calendar avec metadata identifiant la source ("RDV client - Mohamed Bennani - Cabinet Skalean"), et les events Google qui ne sont pas Skalean apparaissent en lecture seule dans le calendrier Skalean (status='external') permettant aux commerciaux de voir leur agenda complet en un seul endroit.

Cette tache 3.1.10 livre uniquement la fondation : la connection OAuth permettant a Skalean d'agir au nom de l'utilisateur sur son calendrier provider. Sans cette etape, Sprint 8 task 3.1.12 ne peut rien faire. La sequence est donc strictement : (1) cette tache 3.1.10 connect OAuth + store tokens, (2) tache 3.1.12 utilise tokens pour appeler API Google/Outlook.

Le choix specifique d'implementer PKCE flow (plutot que OAuth2 Authorization Code standard sans PKCE) decoule de l'evolution des recommandations RFC. OAuth2 standard sans PKCE est sujet a interception du authorization code par un attaquant Man-in-the-Middle. PKCE rend cette interception inutile : meme avec le code intercepte, l'attaquant ne peut pas l'echanger contre tokens sans connaitre le code_verifier qui n'est jamais transmis sur le reseau public. Depuis 2022, Google et Microsoft recommandent PKCE meme pour les applications web confidentielles. Sprint 33 pentest validera cette implementation.

Le choix specifique du chiffrement applicatif AES-256-GCM (vs reposer uniquement sur chiffrement disque Atlas) decoule de la defense en profondeur. Un breach SQL Injection ou un export `pg_dump` malicieux peut exfiltrer les rows en clair meme si le disque est chiffre. Le chiffrement applicatif requiert l'attaquant de compromettre AUSSI le secret manager (Vault Sprint 33) qui detient la cle. Cette double barriere est exigee par CNDP loi 09-08 article 22 (mesures de securite proportionnees aux risques).

### 2.2 Alternatives considerees

| Alternative | Avantages | Inconvenients | Decision |
|-------------|-----------|---------------|----------|
| Pas d'integration calendrier | Simplicite | Frustration utilisateurs, abandon | REJETE |
| Integration Google Calendar uniquement | Couvre 70 pour cent | 30 pour cent utilisateurs Outlook frustres | REJETE |
| Integration Google + Outlook (RETENU) | Couvre 95 pour cent | Complexite x2 | RETENU |
| Integration Apple iCloud Calendar | Couvre Mac users | Faible adoption B2B MA | REJETE Sprint 8 |
| OAuth2 standard sans PKCE | Simple | Securite moindre | REJETE |
| PKCE flow (RETENU) | Securite RFC moderne | Complexite | RETENU |
| Tokens en clair DB | Simple | Faille critique si breach | REJETE |
| Tokens chiffres AES-256-GCM (RETENU) | Defense profondeur | Complexite cle management | RETENU |
| Tokens chiffres avec cle env unique | Simple | Pas de rotation | REJETE -- key versionning Sprint 33 |
| State PKCE stocke DB | Persistent | Latence | REJETE -- Redis plus rapide |
| State PKCE Redis TTL 10min (RETENU) | Fast, expire auto | Lost si Redis crash | RETENU acceptable |
| State PKCE Redis TTL 5min | Strict | Frustre user lent | REJETE |
| State PKCE Redis TTL 30min | Permissif | Window attack | REJETE |
| Auto-refresh expired token (RETENU) | UX seamless | Complexite | RETENU |
| Manual refresh forced relogin | Strict | Frustre user | REJETE |
| Disconnect = soft delete row | Audit preserve | Token reste DB | REJETE -- hard delete row apres revocation provider |
| Disconnect hard delete + revoke provider (RETENU) | Securite | Pas d'historique | RETENU avec audit_log preserve trace |
| Provider abstraction common interface | DRY | Complexite | RETENU |
| Provider implementations specific | Direct | Duplication | REJETE |
| googleapis 144.0.0 SDK (RETENU) | Officiel, maintain | Bundle size | RETENU |
| Manual REST API Google | Light | Maintenance | REJETE |
| microsoft-graph-client 3.0.7 (RETENU) | Officiel Microsoft | Bundle size | RETENU |
| Scopes minimal (calendar.events) | Securite | Limite features | RETENU avec read full calendar pour pull |
| Scopes broad (full calendar + contacts) | Plus features | Surface attack | REJETE |

### 2.3 Trade-offs explicites

Le choix de chiffrer les tokens applicatif via AES-256-GCM ajoute complexite (gestion cle, rotation) et latence (chiffrement/dechiffrement +1ms par requete). Le trade-off est largement gagnant pour la securite : un breach DB n'expose pas les tokens directement. Sprint 33 pentest validera. Sprint 13+ pourra introduire key versionning pour rotation sans downtime.

Le choix d'un TTL state Redis 10 minutes est un compromis entre rigueur (TTL court reduit window attack) et UX (utilisateur peut prendre quelques minutes a completer le flow OAuth, notamment si MFA provider requis). 10 minutes couvre 99 pour cent des cas usage observes. Si state expired, utilisateur recoit message clair et peut relancer initiate.

Le choix d'hard-delete (vs soft-delete) sur disconnect implique de perdre l'historique de la connection. Le trade-off est entre audit (soft-delete preserve) et securite (hard-delete empeche reutilisation tokens compromis). Sprint 8 retient hard-delete avec audit_log row capturant `event_type='calendar_sync_disconnected'` qui preserve trace minimal. Sprint 12+ pourra archiver dans table dediee si besoin compliance.

Le choix d'auto-refresh des access_tokens (vs forcer re-login utilisateur quand expired) implique complexite mais UX seamless. Les access_tokens Google expirent typiquement apres 1h, Outlook apres 1h aussi. Sans auto-refresh, l'utilisateur devrait reconnecter sa calendar chaque heure -- inacceptable. Avec auto-refresh, `getValidAccessToken(syncId)` verifie si `token_expires_at < NOW + 5min` (buffer), refresh via refresh_token, update DB, retourne nouveau access_token. Le refresh_token est plus rare (Google : indefini avec usage frequent ; Outlook : 90 jours), mais expire eventuellement -- a ce moment status='requires_relogin' et frontend prompte l'utilisateur.

Le choix de scopes minimal (calendar.events ReadWrite seulement) limite la surface d'attaque. Sprint 8 task 3.1.12 sync bidir necessite read pour pull events et write pour push appointments. Sprint 14+ si Skalean veut acceder aux contacts Google (auto-import), demander scope contacts.readonly explicitement avec re-consent utilisateur.

### 2.4 Decisions strategiques referenced

- decision-002 (Multi-tenant) totale, decision-003 (TypeORM) totale, decision-006 (No-emoji) totale, decision-008 (Data residency) totale.
- decision-027 (planifie -- OAuth tokens encryption strategy) decision dediee documentee dans `00-pilotage/decisions/027-oauth-tokens-encryption.md` (creee implicitement).
- decision-028 (planifie -- Calendar providers selection) decision dediee Google + Outlook Sprint 8 ; Apple/CalDAV deferre.

### 2.5 Pieges techniques connus

1. **Piege : State PKCE Redis expired entre initiate et callback.**
   - Pourquoi : utilisateur prend > 10min.
   - Solution : message clair "Session expired, please retry". Test V_state_expired.

2. **Piege : State PKCE replay attack.**
   - Pourquoi : attaquant intercepte state.
   - Solution : state one-shot (delete apres lookup). Test V_state_one_shot.

3. **Piege : code_verifier mismatch au token exchange.**
   - Pourquoi : verifier perdu, attaquant tente fake.
   - Solution : Google/Outlook reject avec error_description=invalid_grant. Service catch et retourne 400 clair.

4. **Piege : Access token expired silentement.**
   - Pourquoi : oubli refresh.
   - Solution : `getValidAccessToken` verifie expiry + auto-refresh.

5. **Piege : Refresh token revoked par provider (user manuellement disconnect).**
   - Pourquoi : user revoke depuis Google account settings.
   - Solution : catch erreur refresh provider, mark sync status='requires_relogin'. Test V_refresh_revoked.

6. **Piege : Encryption key perdue, tokens illisibles.**
   - Pourquoi : key rotation mal geree.
   - Solution : key versionning Sprint 33. Sprint 8 documente : key change = re-login force tous syncs.

7. **Piege : Cross-tenant token leak via cache.**
   - Pourquoi : si tokens caches in-memory sans tenant scoping.
   - Solution : pas de cache tokens (toujours fetch DB + decrypt). Test V_no_cache_leak.

8. **Piege : Multiple syncs meme user meme provider.**
   - Pourquoi : user connecte 2 fois Google.
   - Solution : UNIQUE (tenant_id, user_id, provider, provider_account_email). Re-connection meme account update tokens.

9. **Piege : Provider account email different cas: User connecte avec email@gmail.com puis email differente.**
   - Pourquoi : user veut sync 2 calendriers Google.
   - Solution : UNIQUE inclut provider_account_email. Plusieurs syncs OK si emails differents.

10. **Piege : Concurrent refresh token requests.**
    - Pourquoi : 2 requests parallel detect expired token simultaneously.
    - Solution : refresh via transaction + advisory lock Postgres. Test V_concurrent_refresh.

11. **Piege : Redirect URI mismatch.**
    - Pourquoi : config env different prod/dev.
    - Solution : env-specific `GOOGLE_OAUTH_REDIRECT_URI` validees au boot.

12. **Piege : Token chiffre bidirectional mismatch (encrypt/decrypt different keys).**
    - Pourquoi : key rotated entre encrypt et decrypt.
    - Solution : metadata stocke key_version. Decrypt utilise version stockee.

13. **Piege : Provider API quota exceeded.**
    - Pourquoi : trop de refresh queries.
    - Solution : Sprint 8 retient default acceptable. Sprint 13+ monitoring quota.

14. **Piege : OAuth scope insuffisant pour push events.**
    - Pourquoi : scope readonly demande.
    - Solution : Sprint 8 demande `calendar.events` (ReadWrite) explicitement.

15. **Piege : Sync persists apres user delete.**
    - Pourquoi : FK cascade.
    - Solution : ON DELETE CASCADE user_id. Disconnect provider non garanti (user supprimer son compte avant nous notifier provider).

16. **Piege : Audit log expose tokens en clair.**
    - Pourquoi : log dump.
    - Solution : audit log capture event_type + metadata (sans tokens). Tokens reste DB chiffres.

17. **Piege : Bundle size googleapis 144 + microsoft-graph-client 3 = 2 MB.**
    - Pourquoi : SDK lourds.
    - Solution : Sprint 8 acceptable (server-side Node). Pas client-side bundle.

18. **Piege : Provider response format change (Google v4 -> v5).**
    - Pourquoi : breaking changes.
    - Solution : Sprint 13+ monitor changelog Google/Microsoft. Pinning version.

---

## 3. Architecture context

### 3.1 Position dans le sprint

Tache 3.1.10 est la DIXIEME du Sprint 8. Sequence : 3.1.9 -> 3.1.10 -> 3.1.11 -> 3.1.12 -> 3.1.13.

Consommateurs aval :
- **Tache 3.1.11 (Availability)** : pas direct.
- **Tache 3.1.12 (Sync bidir)** : utilise `getValidAccessToken` + providers pour push/pull events.
- **Tache 3.1.13 (iCal feed)** : pas direct.
- **Tache 3.1.14 (Tests + Seeds)** : seeds creent quelques syncs exemples.

Dependances amont :
- **Sprint 5 task 2.1.3** : `EncryptionService` AES-256-GCM.
- **Sprint 1 task 1.1.5** : Redis db=4.
- **Sprint 5/6/7** : guards.

### 3.2 Position dans le programme global

CalendarSync consommee par :
- **Sprint 12 (Sync bidir runtime)** : Sprint 8 task 3.1.12 livre.
- **Sprint 16 (web-broker)** : page Settings affiche "Connect Google Calendar" button.
- **Sprint 22 (web-garage)** : pas typique (techniciens utilisent moins calendrier perso).
- **Sprint 26 (Admin foundation)** : admin peut consulter syncs cross-tenant.
- **Sprint 33 (Pentest)** : valide PKCE + token encryption.

### 3.3 Diagramme

```
                    +----------------------------+
                    | Frontend Sprint 16          |
                    | "Connect Google Calendar"   |
                    +-------------+---------------+
                                  |
                                  | GET /authorize/google
                                  v
+------------------------------------------------------------------+
| CalendarSyncController                                           |
|   GET    /booking/calendar-sync/oauth/:provider/authorize        |
|   GET    /booking/calendar-sync/oauth/:provider/callback         |
|   GET    /booking/calendar-sync                                  |
|   DELETE /booking/calendar-sync/:id                              |
|                                                                  |
| CalendarSyncService                                              |
|   initiateOAuth(provider) -> { authUrl, state, code_verifier }   |
|     - generate code_verifier (32 bytes random)                   |
|     - generate code_challenge SHA256(verifier)                   |
|     - generate state (32 bytes random)                           |
|     - Redis SET oauth_state:{state} = { verifier, user_id }      |
|     - build provider authUrl with challenge + state              |
|                                                                  |
|   handleOAuthCallback(provider, code, state)                     |
|     - Redis GET + DEL oauth_state:{state}                        |
|     - if missing -> 400                                          |
|     - call provider.exchangeCode(code, verifier)                 |
|     - encrypt tokens via EncryptionService                       |
|     - upsert booking_calendar_syncs                              |
|                                                                  |
|   getValidAccessToken(syncId) -> string                          |
|     - find sync                                                  |
|     - decrypt access_token                                       |
|     - if expiry < NOW+5min : refresh via provider                |
|     - return decrypted token                                     |
|                                                                  |
|   disconnect(syncId)                                             |
|     - revoke provider                                            |
|     - hard delete row                                            |
|                                                                  |
| Providers :                                                       |
|   GoogleCalendarProvider (googleapis 144)                        |
|   OutlookCalendarProvider (microsoft-graph-client 3.0.7)         |
+----------+----------------------------+--------------------------+
           |                            |
           v                            v
+----------+---------+         +--------+----------------+
| Redis db=4         |         | Postgres                |
| oauth_state:*      |         |                         |
| TTL 600s           |         | booking_calendar_syncs  |
+--------------------+         |   id, tenant_id, user_id|
                               |   provider              |
                               |   provider_account_email|
                               |   access_token_encrypted|
                               |   refresh_token_encrypted|
                               |   token_expires_at      |
                               |   scope                 |
                               |   status                |
                               |   last_sync_at          |
                               |   metadata (key_version)|
                               +-------------------------+
```

---

## 4. Livrables checkables

- [ ] Migration `repo/packages/database/src/migrations/1715000000010-BookingCalendarSyncs.ts` (~120 lignes)
- [ ] Entity `repo/packages/booking/src/entities/booking-calendar-sync.entity.ts` (~90 lignes)
- [ ] Service `repo/packages/booking/src/services/calendar-sync.service.ts` (~380 lignes)
- [ ] Service `repo/packages/booking/src/services/calendar-sync-state.service.ts` (~120 lignes -- Redis state)
- [ ] Provider `repo/packages/booking/src/providers/google-calendar.provider.ts` (~180 lignes)
- [ ] Provider `repo/packages/booking/src/providers/outlook-calendar.provider.ts` (~180 lignes)
- [ ] Interface `repo/packages/booking/src/providers/calendar-provider.interface.ts` (~50 lignes)
- [ ] Spec service `repo/packages/booking/src/services/calendar-sync.service.spec.ts` (~260 lignes, 14 tests)
- [ ] Schemas Zod `repo/packages/booking/src/schemas/calendar-sync.schema.ts` (~60 lignes)
- [ ] Controller `repo/apps/api/src/modules/booking/controllers/calendar-sync.controller.ts` (~200 lignes)
- [ ] E2E `repo/apps/api/test/booking/calendar-sync.e2e-spec.ts` (~260 lignes, 8 scenarios mock)
- [ ] E2E OAuth integration `repo/apps/api/test/booking/calendar-sync-oauth.e2e-spec.ts` (~140 lignes, 4 scenarios full flow)
- [ ] Modifications `booking.module.ts` + `index.ts`
- [ ] Modifications `app.module.ts` + register controller
- [ ] Modifications `shared-config/env.schema.ts` (+8 vars OAuth + encryption + state TTL)
- [ ] Modifications `package.json` (+2 deps : googleapis 144.0.0, microsoft-graph-client 3.0.7)
- [ ] PKCE flow operationnel (code_verifier + code_challenge SHA256)
- [ ] Tokens chiffres AES-256-GCM
- [ ] State Redis TTL 10min one-shot
- [ ] getValidAccessToken auto-refresh
- [ ] Disconnect revoke provider + hard delete
- [ ] Multi-tenant isolation
- [ ] No-emoji, lint, typecheck

---

## 5. Fichiers crees / modifies

```
CREES :
repo/packages/database/src/migrations/1715000000010-BookingCalendarSyncs.ts   ~120 lignes
repo/packages/booking/src/entities/booking-calendar-sync.entity.ts             ~90 lignes
repo/packages/booking/src/services/calendar-sync.service.ts                   ~380 lignes
repo/packages/booking/src/services/calendar-sync-state.service.ts             ~120 lignes
repo/packages/booking/src/providers/google-calendar.provider.ts               ~180 lignes
repo/packages/booking/src/providers/outlook-calendar.provider.ts              ~180 lignes
repo/packages/booking/src/providers/calendar-provider.interface.ts              ~50 lignes
repo/packages/booking/src/services/calendar-sync.service.spec.ts              ~260 lignes
repo/packages/booking/src/schemas/calendar-sync.schema.ts                       ~60 lignes
repo/apps/api/src/modules/booking/controllers/calendar-sync.controller.ts     ~200 lignes
repo/apps/api/test/booking/calendar-sync.e2e-spec.ts                          ~260 lignes
repo/apps/api/test/booking/calendar-sync-oauth.e2e-spec.ts                    ~140 lignes

MODIFIES :
repo/packages/booking/src/booking.module.ts                                     +6 lignes
repo/packages/booking/src/index.ts                                             +15 lignes
repo/apps/api/src/modules/booking/booking.module.ts                             +2 lignes
repo/packages/shared-config/src/env.schema.ts                                  +10 lignes
repo/package.json (root)                                                         +2 lignes (deps)
```

Total approximativement 2160 lignes nouveau code.

---

## 6. Code patterns COMPLETS

### 6.1 Fichier 1 sur 12 : Migration

```typescript
// repo/packages/database/src/migrations/1715000000010-BookingCalendarSyncs.ts
import type { MigrationInterface, QueryRunner } from 'typeorm';

export class BookingCalendarSyncs1715000000010 implements MigrationInterface {
  name = 'BookingCalendarSyncs1715000000010';

  public async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      CREATE TABLE booking_calendar_syncs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
        provider VARCHAR(20) NOT NULL,
        provider_account_email VARCHAR(320) NOT NULL,
        access_token_encrypted TEXT NOT NULL,
        refresh_token_encrypted TEXT NULL,
        token_expires_at TIMESTAMPTZ NULL,
        scope TEXT NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'connected',
        last_sync_at TIMESTAMPTZ NULL,
        last_error TEXT NULL,
        last_error_at TIMESTAMPTZ NULL,
        encryption_key_version INTEGER NOT NULL DEFAULT 1,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT chk_sync_provider CHECK (provider IN ('google', 'outlook')),
        CONSTRAINT chk_sync_status CHECK (status IN ('connected', 'requires_relogin', 'error', 'disconnected'))
      )
    `);

    await qr.query(`
      CREATE UNIQUE INDEX idx_calendar_sync_unique
        ON booking_calendar_syncs(tenant_id, user_id, provider, provider_account_email)
    `);
    await qr.query(`
      CREATE INDEX idx_calendar_sync_status
        ON booking_calendar_syncs(tenant_id, status)
    `);
    await qr.query(`
      CREATE INDEX idx_calendar_sync_user
        ON booking_calendar_syncs(tenant_id, user_id)
    `);

    // RLS
    await qr.query(`ALTER TABLE booking_calendar_syncs ENABLE ROW LEVEL SECURITY`);
    await qr.query(`
      CREATE POLICY rls_calendar_sync_tenant ON booking_calendar_syncs
        USING (tenant_id = app_current_tenant() OR app_is_super_admin())
    `);
  }

  public async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP TABLE IF EXISTS booking_calendar_syncs CASCADE`);
  }
}
```

### 6.2 Fichier 2 sur 12 : Entity

```typescript
// repo/packages/booking/src/entities/booking-calendar-sync.entity.ts
import {
  Entity, Column, PrimaryGeneratedColumn,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

export type CalendarProvider = 'google' | 'outlook';
export type CalendarSyncStatus = 'connected' | 'requires_relogin' | 'error' | 'disconnected';

@Entity({ name: 'booking_calendar_syncs' })
@Index('idx_calendar_sync_unique', ['tenant_id', 'user_id', 'provider', 'provider_account_email'], { unique: true })
@Index('idx_calendar_sync_status', ['tenant_id', 'status'])
@Index('idx_calendar_sync_user', ['tenant_id', 'user_id'])
export class BookingCalendarSyncEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: false })
  tenant_id!: string;

  @Column({ type: 'uuid', nullable: false })
  user_id!: string;

  @Column({ type: 'varchar', length: 20, nullable: false })
  provider!: CalendarProvider;

  @Column({ type: 'varchar', length: 320, nullable: false })
  provider_account_email!: string;

  @Column({ type: 'text', nullable: false })
  access_token_encrypted!: string;

  @Column({ type: 'text', nullable: true })
  refresh_token_encrypted?: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  token_expires_at?: Date | null;

  @Column({ type: 'text', nullable: false })
  scope!: string;

  @Column({ type: 'varchar', length: 30, nullable: false, default: 'connected' })
  status!: CalendarSyncStatus;

  @Column({ type: 'timestamptz', nullable: true })
  last_sync_at?: Date | null;

  @Column({ type: 'text', nullable: true })
  last_error?: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  last_error_at?: Date | null;

  @Column({ type: 'integer', nullable: false, default: 1 })
  encryption_key_version!: number;

  @Column({ type: 'jsonb', nullable: false, default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
```

### 6.3 Fichier 3 sur 12 : CalendarProvider Interface

```typescript
// repo/packages/booking/src/providers/calendar-provider.interface.ts

export interface OAuthAuthorizationUrlInput {
  state: string;
  codeChallenge: string;
  redirectUri: string;
}

export interface OAuthExchangeCodeInput {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}

export interface OAuthTokens {
  access_token: string;
  refresh_token: string | null;
  expires_at: Date | null;
  scope: string;
  provider_account_email: string;
}

export interface ICalendarProvider {
  getAuthorizationUrl(input: OAuthAuthorizationUrlInput): string;
  exchangeCode(input: OAuthExchangeCodeInput): Promise<OAuthTokens>;
  refreshAccessToken(refreshToken: string): Promise<OAuthTokens>;
  revokeToken(accessToken: string): Promise<void>;
}
```

### 6.4 Fichier 4 sur 12 : GoogleCalendarProvider

```typescript
// repo/packages/booking/src/providers/google-calendar.provider.ts
import { Injectable, Inject } from '@nestjs/common';
import { google, type Auth } from 'googleapis';
import type { Logger } from 'pino';
import type {
  ICalendarProvider, OAuthAuthorizationUrlInput, OAuthExchangeCodeInput, OAuthTokens,
} from './calendar-provider.interface';

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
];

@Injectable()
export class GoogleCalendarProvider implements ICalendarProvider {
  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor(
    @Inject('PINO_LOGGER') private readonly logger: Logger,
  ) {
    this.clientId = process.env.GOOGLE_OAUTH_CLIENT_ID ?? '';
    this.clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? '';
    if (!this.clientId || !this.clientSecret) {
      this.logger.warn('GoogleCalendarProvider : credentials missing in env');
    }
  }

  private buildOAuth2Client(redirectUri?: string): Auth.OAuth2Client {
    return new google.auth.OAuth2(
      this.clientId,
      this.clientSecret,
      redirectUri ?? process.env.GOOGLE_OAUTH_REDIRECT_URI,
    );
  }

  getAuthorizationUrl(input: OAuthAuthorizationUrlInput): string {
    const client = this.buildOAuth2Client(input.redirectUri);
    return client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: GOOGLE_SCOPES,
      state: input.state,
      code_challenge: input.codeChallenge,
      code_challenge_method: 'S256',
    });
  }

  async exchangeCode(input: OAuthExchangeCodeInput): Promise<OAuthTokens> {
    const client = this.buildOAuth2Client(input.redirectUri);
    const { tokens } = await client.getToken({
      code: input.code,
      codeVerifier: input.codeVerifier,
    });

    if (!tokens.access_token) {
      throw new Error('Google did not return access_token');
    }

    // Fetch user email
    client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: client });
    const userInfo = await oauth2.userinfo.get();
    const email = userInfo.data.email;
    if (!email) {
      throw new Error('Google did not return user email');
    }

    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? null,
      expires_at: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      scope: tokens.scope ?? GOOGLE_SCOPES.join(' '),
      provider_account_email: email,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
    const client = this.buildOAuth2Client();
    client.setCredentials({ refresh_token: refreshToken });

    const { credentials } = await client.refreshAccessToken();
    if (!credentials.access_token) {
      throw new Error('Google refresh did not return access_token');
    }

    return {
      access_token: credentials.access_token,
      refresh_token: credentials.refresh_token ?? refreshToken,
      expires_at: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
      scope: credentials.scope ?? GOOGLE_SCOPES.join(' '),
      provider_account_email: '',  // unchanged
    };
  }

  async revokeToken(accessToken: string): Promise<void> {
    const client = this.buildOAuth2Client();
    try {
      await client.revokeToken(accessToken);
    } catch (error) {
      this.logger.warn({ err: error }, 'Google revoke failed (non-fatal)');
    }
  }
}
```

### 6.5 Fichier 5 sur 12 : OutlookCalendarProvider

```typescript
// repo/packages/booking/src/providers/outlook-calendar.provider.ts
import { Injectable, Inject } from '@nestjs/common';
import type { Logger } from 'pino';
import type {
  ICalendarProvider, OAuthAuthorizationUrlInput, OAuthExchangeCodeInput, OAuthTokens,
} from './calendar-provider.interface';

const OUTLOOK_SCOPES = ['Calendars.ReadWrite', 'User.Read', 'offline_access'];
const OUTLOOK_AUTH_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
const OUTLOOK_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';

@Injectable()
export class OutlookCalendarProvider implements ICalendarProvider {
  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor(
    @Inject('PINO_LOGGER') private readonly logger: Logger,
  ) {
    this.clientId = process.env.OUTLOOK_OAUTH_CLIENT_ID ?? '';
    this.clientSecret = process.env.OUTLOOK_OAUTH_CLIENT_SECRET ?? '';
  }

  getAuthorizationUrl(input: OAuthAuthorizationUrlInput): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: input.redirectUri,
      scope: OUTLOOK_SCOPES.join(' '),
      state: input.state,
      code_challenge: input.codeChallenge,
      code_challenge_method: 'S256',
      response_mode: 'query',
    });
    return `${OUTLOOK_AUTH_URL}?${params.toString()}`;
  }

  async exchangeCode(input: OAuthExchangeCodeInput): Promise<OAuthTokens> {
    const body = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code: input.code,
      code_verifier: input.codeVerifier,
      grant_type: 'authorization_code',
      redirect_uri: input.redirectUri,
      scope: OUTLOOK_SCOPES.join(' '),
    });

    const response = await fetch(OUTLOOK_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Outlook token exchange failed: ${response.status} ${errorText}`);
    }

    const data = await response.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
    };

    // Fetch user email via Graph API
    const userResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    const userData = await userResponse.json() as { mail?: string; userPrincipalName?: string };
    const email = userData.mail ?? userData.userPrincipalName ?? '';

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token ?? null,
      expires_at: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
      scope: data.scope ?? OUTLOOK_SCOPES.join(' '),
      provider_account_email: email,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
    const body = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      scope: OUTLOOK_SCOPES.join(' '),
    });

    const response = await fetch(OUTLOOK_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Outlook refresh failed: ${response.status} ${errorText}`);
    }

    const data = await response.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
    };

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token ?? refreshToken,
      expires_at: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
      scope: data.scope ?? OUTLOOK_SCOPES.join(' '),
      provider_account_email: '',
    };
  }

  async revokeToken(_accessToken: string): Promise<void> {
    // Microsoft Graph n'a pas d'endpoint revoke standard ; documentation suggere user revokes manually.
    this.logger.info('Outlook revoke : manual user action required at Microsoft account settings');
  }
}
```

### 6.6 Fichier 6 sur 12 : CalendarSyncStateService

```typescript
// repo/packages/booking/src/services/calendar-sync-state.service.ts
import { Injectable, Inject } from '@nestjs/common';
import type { Redis } from 'ioredis';
import type { Logger } from 'pino';
import { randomBytes, createHash } from 'crypto';

export interface PkceMaterial {
  codeVerifier: string;
  codeChallenge: string;
}

export interface OAuthStateEntry {
  codeVerifier: string;
  userId: string;
  tenantId: string;
  provider: 'google' | 'outlook';
  createdAt: number;
}

@Injectable()
export class CalendarSyncStateService {
  private readonly ttlSeconds: number;

  constructor(
    @Inject('REDIS_CLIENT_CALENDAR_STATE') private readonly redis: Redis,
    @Inject('PINO_LOGGER') private readonly logger: Logger,
  ) {
    this.ttlSeconds = Number(process.env.CALENDAR_SYNC_STATE_TTL_SECONDS ?? 600);
  }

  /**
   * Genere PKCE code_verifier (32 bytes random) + code_challenge (SHA256(verifier) base64url).
   */
  generatePkce(): PkceMaterial {
    const verifier = randomBytes(32).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    return { codeVerifier: verifier, codeChallenge: challenge };
  }

  /**
   * Genere state CSRF (32 bytes random base64url).
   */
  generateState(): string {
    return randomBytes(32).toString('base64url');
  }

  async saveState(state: string, entry: OAuthStateEntry): Promise<void> {
    await this.redis.setex(
      `oauth_state:${state}`,
      this.ttlSeconds,
      JSON.stringify(entry),
    );
  }

  /**
   * Retrieve + delete (one-shot).
   */
  async consumeState(state: string): Promise<OAuthStateEntry | null> {
    const key = `oauth_state:${state}`;
    const raw = await this.redis.get(key);
    if (!raw) return null;
    await this.redis.del(key);
    try {
      return JSON.parse(raw) as OAuthStateEntry;
    } catch {
      this.logger.warn({ state }, 'OAuth state parse failed');
      return null;
    }
  }
}
```

### 6.7 Fichier 7 sur 12 : CalendarSyncService

```typescript
// repo/packages/booking/src/services/calendar-sync.service.ts
import {
  Injectable, NotFoundException, BadRequestException, Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Logger } from 'pino';
import { BookingCalendarSyncEntity, type CalendarProvider } from '../entities/booking-calendar-sync.entity';
import { GoogleCalendarProvider } from '../providers/google-calendar.provider';
import { OutlookCalendarProvider } from '../providers/outlook-calendar.provider';
import type { ICalendarProvider, OAuthTokens } from '../providers/calendar-provider.interface';
import { CalendarSyncStateService } from './calendar-sync-state.service';
import { EncryptionService } from '@insurtech/auth';  // Sprint 5 task 2.1.3
import { KafkaPublisherService, Topics } from '@insurtech/shared-events';
import { getCurrentTenantId } from '@insurtech/shared-utils';

export interface InitiateOAuthResult {
  authUrl: string;
  state: string;
}

@Injectable()
export class CalendarSyncService {
  constructor(
    @InjectRepository(BookingCalendarSyncEntity)
    private readonly syncsRepo: Repository<BookingCalendarSyncEntity>,
    private readonly stateService: CalendarSyncStateService,
    private readonly googleProvider: GoogleCalendarProvider,
    private readonly outlookProvider: OutlookCalendarProvider,
    private readonly encryption: EncryptionService,
    private readonly kafka: KafkaPublisherService,
    @Inject('PINO_LOGGER') private readonly logger: Logger,
  ) {}

  private getProvider(provider: CalendarProvider): ICalendarProvider {
    return provider === 'google' ? this.googleProvider : this.outlookProvider;
  }

  private getRedirectUri(provider: CalendarProvider): string {
    return provider === 'google'
      ? (process.env.GOOGLE_OAUTH_REDIRECT_URI ?? '')
      : (process.env.OUTLOOK_OAUTH_REDIRECT_URI ?? '');
  }

  async initiateOAuth(provider: CalendarProvider, userId: string): Promise<InitiateOAuthResult> {
    const tenantId = this.requireTenantContext('initiateOAuth');
    const pkce = this.stateService.generatePkce();
    const state = this.stateService.generateState();

    await this.stateService.saveState(state, {
      codeVerifier: pkce.codeVerifier,
      userId,
      tenantId,
      provider,
      createdAt: Date.now(),
    });

    const providerImpl = this.getProvider(provider);
    const authUrl = providerImpl.getAuthorizationUrl({
      state,
      codeChallenge: pkce.codeChallenge,
      redirectUri: this.getRedirectUri(provider),
    });

    this.logger.info(
      { tenant_id: tenantId, user_id: userId, provider, action: 'oauth_initiate' },
      'OAuth flow initiated',
    );

    return { authUrl, state };
  }

  async handleOAuthCallback(
    provider: CalendarProvider,
    code: string,
    state: string,
  ): Promise<BookingCalendarSyncEntity> {
    const stateEntry = await this.stateService.consumeState(state);
    if (!stateEntry) {
      throw new BadRequestException({
        code: 'CALENDAR_OAUTH_STATE_INVALID',
        message: 'State invalide ou expire. Recommencez le flow.',
      });
    }
    if (stateEntry.provider !== provider) {
      throw new BadRequestException({
        code: 'CALENDAR_OAUTH_PROVIDER_MISMATCH',
        message: 'Provider mismatch',
      });
    }

    // Exchange code for tokens
    const providerImpl = this.getProvider(provider);
    let tokens: OAuthTokens;
    try {
      tokens = await providerImpl.exchangeCode({
        code,
        codeVerifier: stateEntry.codeVerifier,
        redirectUri: this.getRedirectUri(provider),
      });
    } catch (error) {
      this.logger.error({ err: error, provider, action: 'oauth_exchange_failed' }, 'OAuth code exchange failed');
      throw new BadRequestException({
        code: 'CALENDAR_OAUTH_EXCHANGE_FAILED',
        message: 'Echange code echec',
      });
    }

    // Encrypt tokens
    const accessEnc = this.encryption.encrypt(tokens.access_token, 'CALENDAR_TOKENS_ENCRYPTION_KEY');
    const refreshEnc = tokens.refresh_token
      ? this.encryption.encrypt(tokens.refresh_token, 'CALENDAR_TOKENS_ENCRYPTION_KEY')
      : null;

    // Upsert (un user peut reconnecter meme account = update tokens)
    const existing = await this.syncsRepo.findOne({
      where: {
        tenant_id: stateEntry.tenantId,
        user_id: stateEntry.userId,
        provider,
        provider_account_email: tokens.provider_account_email,
      },
    });

    let saved: BookingCalendarSyncEntity;
    if (existing) {
      Object.assign(existing, {
        access_token_encrypted: accessEnc,
        refresh_token_encrypted: refreshEnc ?? existing.refresh_token_encrypted,
        token_expires_at: tokens.expires_at,
        scope: tokens.scope,
        status: 'connected',
        last_error: null,
        last_error_at: null,
      });
      saved = await this.syncsRepo.save(existing);
    } else {
      const entity = this.syncsRepo.create({
        tenant_id: stateEntry.tenantId,
        user_id: stateEntry.userId,
        provider,
        provider_account_email: tokens.provider_account_email,
        access_token_encrypted: accessEnc,
        refresh_token_encrypted: refreshEnc,
        token_expires_at: tokens.expires_at,
        scope: tokens.scope,
        status: 'connected',
      });
      saved = await this.syncsRepo.save(entity);
    }

    await this.kafka.publish({
      topic: Topics.BOOKING_CALENDAR_SYNC_CONNECTED,
      key: saved.id,
      value: {
        event_id: crypto.randomUUID(),
        event_type: 'booking.calendar_sync.connected',
        occurred_at: new Date().toISOString(),
        tenant_id: stateEntry.tenantId,
        actor_user_id: stateEntry.userId,
        sync: {
          id: saved.id,
          provider: saved.provider,
          provider_account_email: saved.provider_account_email,
        },
      },
    });

    this.logger.info(
      { tenant_id: stateEntry.tenantId, user_id: stateEntry.userId, provider, sync_id: saved.id },
      'Calendar sync connected',
    );

    return saved;
  }

  async listSyncs(userId: string): Promise<BookingCalendarSyncEntity[]> {
    const tenantId = this.requireTenantContext('listSyncs');
    return this.syncsRepo.find({
      where: { tenant_id: tenantId, user_id: userId },
      order: { created_at: 'DESC' },
    });
  }

  async findById(id: string): Promise<BookingCalendarSyncEntity> {
    const tenantId = this.requireTenantContext('findById');
    const sync = await this.syncsRepo.findOne({ where: { id, tenant_id: tenantId } });
    if (!sync) {
      throw new NotFoundException({ code: 'CALENDAR_SYNC_NOT_FOUND', message: `Sync ${id} not found` });
    }
    return sync;
  }

  async disconnect(id: string, userId: string): Promise<{ disconnected: true; id: string }> {
    const tenantId = this.requireTenantContext('disconnect');
    const sync = await this.findById(id);

    // Revoke provider (best-effort)
    try {
      const accessToken = this.encryption.decrypt(sync.access_token_encrypted, 'CALENDAR_TOKENS_ENCRYPTION_KEY');
      await this.getProvider(sync.provider).revokeToken(accessToken);
    } catch (error) {
      this.logger.warn({ err: error, sync_id: id }, 'Provider revoke failed (non-fatal)');
    }

    // Hard delete (audit preserves event)
    await this.syncsRepo.delete({ id });

    await this.kafka.publish({
      topic: Topics.BOOKING_CALENDAR_SYNC_DISCONNECTED,
      key: id,
      value: {
        event_id: crypto.randomUUID(),
        event_type: 'booking.calendar_sync.disconnected',
        occurred_at: new Date().toISOString(),
        tenant_id: tenantId,
        actor_user_id: userId,
        sync_id: id,
      },
    });

    return { disconnected: true, id };
  }

  /**
   * Helper consume par Sprint 8 task 3.1.12 Sync bidir.
   * Retourne access_token valide (refresh auto si expire).
   */
  async getValidAccessToken(syncId: string): Promise<string> {
    const sync = await this.findById(syncId);

    const now = Date.now();
    const expiresAt = sync.token_expires_at ? sync.token_expires_at.getTime() : null;
    const needsRefresh = expiresAt && expiresAt - now < 5 * 60 * 1000;  // buffer 5min

    if (needsRefresh && sync.refresh_token_encrypted) {
      try {
        const refreshToken = this.encryption.decrypt(sync.refresh_token_encrypted, 'CALENDAR_TOKENS_ENCRYPTION_KEY');
        const newTokens = await this.getProvider(sync.provider).refreshAccessToken(refreshToken);

        const newAccessEnc = this.encryption.encrypt(newTokens.access_token, 'CALENDAR_TOKENS_ENCRYPTION_KEY');
        sync.access_token_encrypted = newAccessEnc;
        sync.token_expires_at = newTokens.expires_at;
        if (newTokens.refresh_token && newTokens.refresh_token !== refreshToken) {
          sync.refresh_token_encrypted = this.encryption.encrypt(newTokens.refresh_token, 'CALENDAR_TOKENS_ENCRYPTION_KEY');
        }
        sync.status = 'connected';
        await this.syncsRepo.save(sync);

        return newTokens.access_token;
      } catch (error) {
        this.logger.error({ err: error, sync_id: syncId }, 'Refresh token failed');
        sync.status = 'requires_relogin';
        sync.last_error = String(error);
        sync.last_error_at = new Date();
        await this.syncsRepo.save(sync);
        throw new BadRequestException({
          code: 'CALENDAR_SYNC_REQUIRES_RELOGIN',
          message: 'Refresh token revoked or invalid. Reconnect required.',
        });
      }
    }

    return this.encryption.decrypt(sync.access_token_encrypted, 'CALENDAR_TOKENS_ENCRYPTION_KEY');
  }

  private requireTenantContext(operation: string): string {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new BadRequestException({
        code: 'CALENDAR_TENANT_CONTEXT_MISSING',
        message: 'Tenant context required',
      });
    }
    return tenantId;
  }
}
```

### 6.8 Fichier 8 sur 12 : Schemas + Controller

```typescript
// repo/packages/booking/src/schemas/calendar-sync.schema.ts
import { z } from 'zod';

export const InitiateOAuthSchema = z.object({
  provider: z.enum(['google', 'outlook']),
}).strict();

export type InitiateOAuthDto = z.infer<typeof InitiateOAuthSchema>;

export const OAuthCallbackSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
}).strict();

export type OAuthCallbackDto = z.infer<typeof OAuthCallbackSchema>;
```

```typescript
// repo/apps/api/src/modules/booking/controllers/calendar-sync.controller.ts
import {
  Controller, Get, Delete, Param, Query, Redirect,
  UseGuards, UseInterceptors, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiBearerAuth, ApiHeader, ApiResponse,
} from '@nestjs/swagger';
import {
  CalendarSyncService,
  type CalendarProvider,
} from '@insurtech/booking';
import {
  JwtAuthGuard, CurrentUser, type AuthenticatedUser,
  TenantContextGuard, TenantTransactionInterceptor,
  PermissionGuard, RequirePermission, Permission,
} from '@insurtech/auth';

@ApiTags('Booking Calendar Sync')
@ApiBearerAuth()
@ApiHeader({ name: 'x-tenant-id', required: true })
@Controller('booking/calendar-sync')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
@UseInterceptors(TenantTransactionInterceptor)
export class CalendarSyncController {
  constructor(private readonly syncService: CalendarSyncService) {}

  @Get('oauth/:provider/authorize')
  @RequirePermission(Permission.BOOKING_CALENDAR_SYNC_MANAGE)
  @ApiOperation({ summary: 'Initiate OAuth flow for Google or Outlook' })
  @ApiResponse({ status: 200, schema: { example: { authUrl: 'https://...', state: '...' } } })
  async initiateOAuth(
    @Param('provider') provider: CalendarProvider,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (provider !== 'google' && provider !== 'outlook') {
      throw new Error('Invalid provider');
    }
    return this.syncService.initiateOAuth(provider, user.id);
  }

  @Get('oauth/:provider/callback')
  @ApiOperation({ summary: 'OAuth callback (NO auth guards, state validation suffit)' })
  async handleCallback(
    @Param('provider') provider: CalendarProvider,
    @Query('code') code: string,
    @Query('state') state: string,
  ) {
    if (provider !== 'google' && provider !== 'outlook') {
      throw new Error('Invalid provider');
    }
    return this.syncService.handleOAuthCallback(provider, code, state);
  }

  @Get()
  @RequirePermission(Permission.BOOKING_CALENDAR_SYNC_READ)
  @ApiOperation({ summary: 'List user calendar syncs' })
  async listSyncs(@CurrentUser() user: AuthenticatedUser) {
    return this.syncService.listSyncs(user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(Permission.BOOKING_CALENDAR_SYNC_MANAGE)
  @ApiOperation({ summary: 'Disconnect (revoke + hard delete)' })
  async disconnect(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.syncService.disconnect(id, user.id);
  }
}
```

### 6.9 Fichier 9 sur 12 : Tests unitaires service

```typescript
// repo/packages/booking/src/services/calendar-sync.service.spec.ts
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { CalendarSyncService } from './calendar-sync.service';
import { CalendarSyncStateService } from './calendar-sync-state.service';
import { GoogleCalendarProvider } from '../providers/google-calendar.provider';
import { OutlookCalendarProvider } from '../providers/outlook-calendar.provider';
import { BookingCalendarSyncEntity } from '../entities/booking-calendar-sync.entity';
import { EncryptionService } from '@insurtech/auth';
import { KafkaPublisherService } from '@insurtech/shared-events';
import * as utils from '@insurtech/shared-utils';

vi.mock('@insurtech/shared-utils', async () => ({
  ...(await vi.importActual<typeof utils>('@insurtech/shared-utils')),
  getCurrentTenantId: vi.fn(),
}));

const TENANT = 'tenant-uuid';
const USER = 'user-uuid';

describe('CalendarSyncService', () => {
  let service: CalendarSyncService;
  let repo: any;
  let stateSvc: any;
  let google: any;
  let outlook: any;
  let encryption: any;
  let kafka: any;

  beforeEach(async () => {
    (utils.getCurrentTenantId as Mock).mockReturnValue(TENANT);

    const m = await Test.createTestingModule({
      providers: [
        CalendarSyncService,
        {
          provide: getRepositoryToken(BookingCalendarSyncEntity),
          useValue: {
            findOne: vi.fn(),
            find: vi.fn(),
            create: vi.fn((d) => d),
            save: vi.fn((d) => Promise.resolve({ ...d, id: 's1' })),
            delete: vi.fn(),
          },
        },
        {
          provide: CalendarSyncStateService,
          useValue: {
            generatePkce: vi.fn(() => ({ codeVerifier: 'v', codeChallenge: 'c' })),
            generateState: vi.fn(() => 'state-x'),
            saveState: vi.fn(),
            consumeState: vi.fn(),
          },
        },
        {
          provide: GoogleCalendarProvider,
          useValue: {
            getAuthorizationUrl: vi.fn(() => 'https://google/auth?state=state-x'),
            exchangeCode: vi.fn(() => Promise.resolve({
              access_token: 'AT', refresh_token: 'RT',
              expires_at: new Date(Date.now() + 3600000),
              scope: 'calendar.events', provider_account_email: 'user@gmail.com',
            })),
            refreshAccessToken: vi.fn(() => Promise.resolve({
              access_token: 'AT2', refresh_token: 'RT2',
              expires_at: new Date(Date.now() + 3600000),
              scope: 'calendar.events', provider_account_email: '',
            })),
            revokeToken: vi.fn(),
          },
        },
        {
          provide: OutlookCalendarProvider,
          useValue: { getAuthorizationUrl: vi.fn(), exchangeCode: vi.fn(), refreshAccessToken: vi.fn(), revokeToken: vi.fn() },
        },
        {
          provide: EncryptionService,
          useValue: {
            encrypt: vi.fn((v) => `enc(${v})`),
            decrypt: vi.fn((v) => v.replace(/^enc\(/, '').replace(/\)$/, '')),
          },
        },
        { provide: KafkaPublisherService, useValue: { publish: vi.fn() } },
        { provide: 'PINO_LOGGER', useValue: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } },
      ],
    }).compile();

    service = m.get(CalendarSyncService);
    repo = m.get(getRepositoryToken(BookingCalendarSyncEntity));
    stateSvc = m.get(CalendarSyncStateService);
    google = m.get(GoogleCalendarProvider);
    outlook = m.get(OutlookCalendarProvider);
    encryption = m.get(EncryptionService);
    kafka = m.get(KafkaPublisherService);
  });

  describe('initiateOAuth', () => {
    it('genere state + PKCE + save Redis + return URL', async () => {
      const r = await service.initiateOAuth('google', USER);
      expect(r.state).toBe('state-x');
      expect(r.authUrl).toContain('google');
      expect(stateSvc.saveState).toHaveBeenCalled();
    });
  });

  describe('handleOAuthCallback', () => {
    beforeEach(() => {
      stateSvc.consumeState.mockResolvedValue({
        codeVerifier: 'v', userId: USER, tenantId: TENANT, provider: 'google', createdAt: Date.now(),
      });
    });

    it('exchange code + encrypt tokens + insert', async () => {
      repo.findOne.mockResolvedValue(null);
      const r = await service.handleOAuthCallback('google', 'CODE', 'state-x');
      expect(r.id).toBe('s1');
      expect(encryption.encrypt).toHaveBeenCalled();
      expect(kafka.publish).toHaveBeenCalled();
    });

    it('rejette state invalide', async () => {
      stateSvc.consumeState.mockResolvedValue(null);
      await expect(service.handleOAuthCallback('google', 'CODE', 'bad-state'))
        .rejects.toThrow(BadRequestException);
    });

    it('rejette provider mismatch', async () => {
      stateSvc.consumeState.mockResolvedValue({
        codeVerifier: 'v', userId: USER, tenantId: TENANT, provider: 'outlook', createdAt: Date.now(),
      });
      await expect(service.handleOAuthCallback('google', 'CODE', 'state-x'))
        .rejects.toThrow(BadRequestException);
    });

    it('upsert si existing sync', async () => {
      repo.findOne.mockResolvedValue({ id: 'existing', tenant_id: TENANT });
      const r = await service.handleOAuthCallback('google', 'CODE', 'state-x');
      expect(repo.save).toHaveBeenCalled();
    });

    it('catch exchange failure -> BadRequest', async () => {
      google.exchangeCode.mockRejectedValue(new Error('Google error'));
      await expect(service.handleOAuthCallback('google', 'CODE', 'state-x'))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('getValidAccessToken', () => {
    it('retourne decrypted si non-expire', async () => {
      repo.findOne.mockResolvedValue({
        id: 's1', tenant_id: TENANT, provider: 'google',
        access_token_encrypted: 'enc(AT)',
        refresh_token_encrypted: 'enc(RT)',
        token_expires_at: new Date(Date.now() + 3600000),
      });
      const t = await service.getValidAccessToken('s1');
      expect(t).toBe('AT');
    });

    it('auto-refresh si expire', async () => {
      repo.findOne.mockResolvedValue({
        id: 's1', tenant_id: TENANT, provider: 'google',
        access_token_encrypted: 'enc(AT)',
        refresh_token_encrypted: 'enc(RT)',
        token_expires_at: new Date(Date.now() - 1000),
      });
      const t = await service.getValidAccessToken('s1');
      expect(t).toBe('AT2');
      expect(google.refreshAccessToken).toHaveBeenCalled();
    });

    it('mark requires_relogin si refresh fail', async () => {
      repo.findOne.mockResolvedValue({
        id: 's1', tenant_id: TENANT, provider: 'google',
        access_token_encrypted: 'enc(AT)',
        refresh_token_encrypted: 'enc(RT)',
        token_expires_at: new Date(Date.now() - 1000),
      });
      google.refreshAccessToken.mockRejectedValue(new Error('Revoked'));
      await expect(service.getValidAccessToken('s1')).rejects.toThrow(BadRequestException);
      expect(repo.save).toHaveBeenCalled();
    });
  });

  describe('disconnect', () => {
    it('revoke + hard delete + Kafka', async () => {
      repo.findOne.mockResolvedValue({
        id: 's1', tenant_id: TENANT, provider: 'google',
        access_token_encrypted: 'enc(AT)',
      });
      const r = await service.disconnect('s1', USER);
      expect(r.disconnected).toBe(true);
      expect(google.revokeToken).toHaveBeenCalled();
      expect(repo.delete).toHaveBeenCalled();
      expect(kafka.publish).toHaveBeenCalled();
    });

    it('continue meme si revoke fail (non-fatal)', async () => {
      repo.findOne.mockResolvedValue({
        id: 's1', tenant_id: TENANT, provider: 'google',
        access_token_encrypted: 'enc(AT)',
      });
      google.revokeToken.mockRejectedValue(new Error('Revoke failed'));
      const r = await service.disconnect('s1', USER);
      expect(r.disconnected).toBe(true);
      expect(repo.delete).toHaveBeenCalled();
    });
  });

  describe('listSyncs', () => {
    it('retourne syncs user', async () => {
      repo.find.mockResolvedValue([{ id: 's1' }, { id: 's2' }]);
      const r = await service.listSyncs(USER);
      expect(r).toHaveLength(2);
    });
  });
});
```

### 6.10 Fichier 10 sur 12 : E2E tests (mocked providers)

```typescript
// repo/apps/api/test/booking/calendar-sync.e2e-spec.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { GoogleCalendarProvider } from '@insurtech/booking';
import { createTestTenant, createTestUser, loginAndGetJwt } from '../fixtures/auth-test-helpers';

describe('Booking Calendar Sync E2E', () => {
  let app: INestApplication;
  let ds: DataSource;
  let tenantId: string;
  let jwt: string;

  beforeAll(async () => {
    const m = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(GoogleCalendarProvider)
      .useValue({
        getAuthorizationUrl: () => 'https://google.test/auth?state=mocked',
        exchangeCode: () => Promise.resolve({
          access_token: 'AT', refresh_token: 'RT',
          expires_at: new Date(Date.now() + 3600000),
          scope: 'calendar.events', provider_account_email: 'user@gmail.com',
        }),
        refreshAccessToken: () => Promise.resolve({
          access_token: 'AT2', refresh_token: 'RT2',
          expires_at: new Date(Date.now() + 3600000),
          scope: 'calendar.events', provider_account_email: '',
        }),
        revokeToken: () => Promise.resolve(),
      })
      .compile();
    app = m.createNestApplication();
    await app.init();
    ds = m.get(DataSource);
    tenantId = (await createTestTenant(ds, 't_3110')).id;
    jwt = await loginAndGetJwt(app, await createTestUser(ds, tenantId, 'broker_user'));
  });

  beforeEach(async () => {
    await ds.query(`DELETE FROM booking_calendar_syncs WHERE tenant_id = $1`, [tenantId]);
  });

  afterAll(async () => { await app.close(); });

  it('initiate OAuth flow retourne authUrl + state', async () => {
    const r = await request(app.getHttpServer())
      .get('/api/v1/booking/calendar-sync/oauth/google/authorize')
      .set('Authorization', `Bearer ${jwt}`)
      .set('x-tenant-id', tenantId);
    expect(r.status).toBe(200);
    expect(r.body.data.authUrl).toContain('google');
    expect(r.body.data.state).toBeDefined();
  });

  it('callback avec state invalide rejete 400', async () => {
    const r = await request(app.getHttpServer())
      .get('/api/v1/booking/calendar-sync/oauth/google/callback?code=CODE&state=invalid')
      .set('Authorization', `Bearer ${jwt}`)
      .set('x-tenant-id', tenantId);
    expect(r.status).toBe(400);
  });

  it('list syncs vide initialement', async () => {
    const r = await request(app.getHttpServer())
      .get('/api/v1/booking/calendar-sync')
      .set('Authorization', `Bearer ${jwt}`)
      .set('x-tenant-id', tenantId);
    expect(r.body.data).toHaveLength(0);
  });

  it('rejette provider invalide', async () => {
    const r = await request(app.getHttpServer())
      .get('/api/v1/booking/calendar-sync/oauth/invalid/authorize')
      .set('Authorization', `Bearer ${jwt}`)
      .set('x-tenant-id', tenantId);
    expect(r.status).toBeGreaterThanOrEqual(400);
  });

  it('rejette sans auth (401)', async () => {
    const r = await request(app.getHttpServer())
      .get('/api/v1/booking/calendar-sync/oauth/google/authorize')
      .set('x-tenant-id', tenantId);
    expect(r.status).toBe(401);
  });

  it('multi-tenant : list filter tenant courant', async () => {
    const otherTenant = (await createTestTenant(ds, 't_3110_other')).id;
    const otherJwt = await loginAndGetJwt(app, await createTestUser(ds, otherTenant, 'broker_user'));
    const r = await request(app.getHttpServer())
      .get('/api/v1/booking/calendar-sync')
      .set('Authorization', `Bearer ${otherJwt}`)
      .set('x-tenant-id', otherTenant);
    expect(r.body.data).toHaveLength(0);
  });

  it('disconnect non-existant 404', async () => {
    const r = await request(app.getHttpServer())
      .delete('/api/v1/booking/calendar-sync/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${jwt}`)
      .set('x-tenant-id', tenantId);
    expect(r.status).toBe(404);
  });

  it('multi-tenant : sync tenant A invisible tenant B', async () => {
    // Insert directement sync tenant A
    await ds.query(
      `INSERT INTO booking_calendar_syncs (tenant_id, user_id, provider, provider_account_email, access_token_encrypted, scope, status)
       VALUES ($1, (SELECT id FROM auth_users WHERE tenant_id=$1 LIMIT 1), 'google', 'a@gmail.com', 'enc', 'X', 'connected')`,
      [tenantId],
    );

    const otherTenant = (await createTestTenant(ds, 't_3110_other2')).id;
    const otherJwt = await loginAndGetJwt(app, await createTestUser(ds, otherTenant, 'broker_user'));
    const r = await request(app.getHttpServer())
      .get('/api/v1/booking/calendar-sync')
      .set('Authorization', `Bearer ${otherJwt}`)
      .set('x-tenant-id', otherTenant);
    expect(r.body.data).toHaveLength(0);
  });
});
```

### 6.11 Fichier 11 sur 12 : E2E full OAuth flow

```typescript
// repo/apps/api/test/booking/calendar-sync-oauth.e2e-spec.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { GoogleCalendarProvider, OutlookCalendarProvider } from '@insurtech/booking';
import { createTestTenant, createTestUser, loginAndGetJwt } from '../fixtures/auth-test-helpers';

describe('Booking Calendar Sync OAuth Full Flow E2E', () => {
  let app: INestApplication;
  let ds: DataSource;
  let tenantId: string;
  let jwt: string;

  beforeAll(async () => {
    const m = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(GoogleCalendarProvider)
      .useValue({
        getAuthorizationUrl: () => 'https://google.test/auth',
        exchangeCode: () => Promise.resolve({
          access_token: 'AT', refresh_token: 'RT',
          expires_at: new Date(Date.now() + 3600000),
          scope: 'calendar.events', provider_account_email: 'user@gmail.com',
        }),
        refreshAccessToken: () => Promise.resolve({
          access_token: 'AT2', refresh_token: 'RT2',
          expires_at: new Date(Date.now() + 3600000),
          scope: 'calendar.events', provider_account_email: '',
        }),
        revokeToken: () => Promise.resolve(),
      })
      .compile();
    app = m.createNestApplication();
    await app.init();
    ds = m.get(DataSource);
    tenantId = (await createTestTenant(ds, 't_3110_full')).id;
    jwt = await loginAndGetJwt(app, await createTestUser(ds, tenantId, 'broker_user'));
  });

  afterAll(async () => { await app.close(); });

  it('full OAuth flow Google: initiate -> callback -> list', async () => {
    // 1. Initiate
    const initR = await request(app.getHttpServer())
      .get('/api/v1/booking/calendar-sync/oauth/google/authorize')
      .set('Authorization', `Bearer ${jwt}`)
      .set('x-tenant-id', tenantId);
    expect(initR.status).toBe(200);
    const state = initR.body.data.state;

    // 2. Callback
    const cbR = await request(app.getHttpServer())
      .get(`/api/v1/booking/calendar-sync/oauth/google/callback?code=CODE&state=${state}`)
      .set('Authorization', `Bearer ${jwt}`)
      .set('x-tenant-id', tenantId);
    expect(cbR.status).toBe(200);
    expect(cbR.body.data.id).toBeDefined();
    expect(cbR.body.data.provider_account_email).toBe('user@gmail.com');

    // 3. List
    const listR = await request(app.getHttpServer())
      .get('/api/v1/booking/calendar-sync')
      .set('Authorization', `Bearer ${jwt}`)
      .set('x-tenant-id', tenantId);
    expect(listR.body.data.length).toBeGreaterThanOrEqual(1);
    expect(listR.body.data[0].provider).toBe('google');
    // Tokens NE doivent PAS apparaitre en clair dans la response
    expect(listR.body.data[0].access_token_encrypted).toContain('enc');
  });

  it('replay state attack : 2eme callback meme state rejete', async () => {
    const initR = await request(app.getHttpServer())
      .get('/api/v1/booking/calendar-sync/oauth/google/authorize')
      .set('Authorization', `Bearer ${jwt}`)
      .set('x-tenant-id', tenantId);
    const state = initR.body.data.state;

    // First callback
    const cb1 = await request(app.getHttpServer())
      .get(`/api/v1/booking/calendar-sync/oauth/google/callback?code=CODE&state=${state}`)
      .set('Authorization', `Bearer ${jwt}`)
      .set('x-tenant-id', tenantId);
    expect(cb1.status).toBe(200);

    // Replay
    const cb2 = await request(app.getHttpServer())
      .get(`/api/v1/booking/calendar-sync/oauth/google/callback?code=CODE&state=${state}`)
      .set('Authorization', `Bearer ${jwt}`)
      .set('x-tenant-id', tenantId);
    expect(cb2.status).toBe(400);
  });

  it('disconnect cycle complete', async () => {
    const initR = await request(app.getHttpServer())
      .get('/api/v1/booking/calendar-sync/oauth/google/authorize')
      .set('Authorization', `Bearer ${jwt}`)
      .set('x-tenant-id', tenantId);
    const state = initR.body.data.state;
    const cbR = await request(app.getHttpServer())
      .get(`/api/v1/booking/calendar-sync/oauth/google/callback?code=CODE&state=${state}`)
      .set('Authorization', `Bearer ${jwt}`)
      .set('x-tenant-id', tenantId);
    const syncId = cbR.body.data.id;

    const delR = await request(app.getHttpServer())
      .delete(`/api/v1/booking/calendar-sync/${syncId}`)
      .set('Authorization', `Bearer ${jwt}`)
      .set('x-tenant-id', tenantId);
    expect(delR.status).toBe(200);

    const listR = await request(app.getHttpServer())
      .get('/api/v1/booking/calendar-sync')
      .set('Authorization', `Bearer ${jwt}`)
      .set('x-tenant-id', tenantId);
    expect(listR.body.data.find((s: any) => s.id === syncId)).toBeUndefined();
  });

  it('upsert : second OAuth meme account update tokens vs duplicate', async () => {
    const init1 = await request(app.getHttpServer())
      .get('/api/v1/booking/calendar-sync/oauth/google/authorize')
      .set('Authorization', `Bearer ${jwt}`)
      .set('x-tenant-id', tenantId);
    await request(app.getHttpServer())
      .get(`/api/v1/booking/calendar-sync/oauth/google/callback?code=CODE1&state=${init1.body.data.state}`)
      .set('Authorization', `Bearer ${jwt}`)
      .set('x-tenant-id', tenantId);

    const init2 = await request(app.getHttpServer())
      .get('/api/v1/booking/calendar-sync/oauth/google/authorize')
      .set('Authorization', `Bearer ${jwt}`)
      .set('x-tenant-id', tenantId);
    await request(app.getHttpServer())
      .get(`/api/v1/booking/calendar-sync/oauth/google/callback?code=CODE2&state=${init2.body.data.state}`)
      .set('Authorization', `Bearer ${jwt}`)
      .set('x-tenant-id', tenantId);

    const listR = await request(app.getHttpServer())
      .get('/api/v1/booking/calendar-sync')
      .set('Authorization', `Bearer ${jwt}`)
      .set('x-tenant-id', tenantId);
    // Un seul sync pour user@gmail.com (upsert)
    const userSyncs = listR.body.data.filter((s: any) => s.provider_account_email === 'user@gmail.com');
    expect(userSyncs).toHaveLength(1);
  });
});
```

### 6.12 Fichier 12 sur 12 : Modifications modules + env

```typescript
// repo/packages/booking/src/booking.module.ts (modifie)
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingRoomEntity } from './entities/booking-room.entity';
import { BookingAppointmentEntity } from './entities/booking-appointment.entity';
import { BookingCalendarSyncEntity } from './entities/booking-calendar-sync.entity';
import { RoomsService } from './services/rooms.service';
import { AppointmentsService } from './services/appointments.service';
import { AppointmentLifecycleService } from './services/appointment-lifecycle.service';
import { CalendarSyncService } from './services/calendar-sync.service';
import { CalendarSyncStateService } from './services/calendar-sync-state.service';
import { GoogleCalendarProvider } from './providers/google-calendar.provider';
import { OutlookCalendarProvider } from './providers/outlook-calendar.provider';
import { SharedEventsModule } from '@insurtech/shared-events';
import { AuthModule } from '@insurtech/auth';

@Module({
  imports: [
    TypeOrmModule.forFeature([BookingRoomEntity, BookingAppointmentEntity, BookingCalendarSyncEntity]),
    SharedEventsModule,
    AuthModule,
  ],
  providers: [
    RoomsService,
    AppointmentsService, AppointmentLifecycleService,
    CalendarSyncService, CalendarSyncStateService,
    GoogleCalendarProvider, OutlookCalendarProvider,
  ],
  exports: [
    RoomsService, AppointmentsService, CalendarSyncService,
    GoogleCalendarProvider, OutlookCalendarProvider,
    TypeOrmModule,
  ],
})
export class BookingModule {}
```

```env
# === Booking Calendar Sync (Sprint 8 task 3.1.10) ===

# Google OAuth
GOOGLE_OAUTH_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=your-google-client-secret
GOOGLE_OAUTH_REDIRECT_URI=https://api.skalean-insurtech.ma/api/v1/booking/calendar-sync/oauth/google/callback

# Outlook OAuth (Microsoft Graph)
OUTLOOK_OAUTH_CLIENT_ID=your-outlook-app-id
OUTLOOK_OAUTH_CLIENT_SECRET=your-outlook-secret
OUTLOOK_OAUTH_REDIRECT_URI=https://api.skalean-insurtech.ma/api/v1/booking/calendar-sync/oauth/outlook/callback

# Encryption tokens
CALENDAR_TOKENS_ENCRYPTION_KEY=64-hex-chars-256-bits

# Redis state PKCE
CALENDAR_SYNC_STATE_TTL_SECONDS=600
REDIS_CALENDAR_STATE_DB=4
```

---

## 7. Tests complets

14 unit (6.9) + 8 E2E (6.10) + 4 OAuth flow (6.11) = 26 tests total.

---

## 8. Variables environnement

Voir section 6.12.

---

## 9. Commandes shell

```bash
cd repo

# 1. Migration
pnpm --filter @insurtech/database migrate:run

# 2. Install deps
pnpm add googleapis@144.0.0 @microsoft/microsoft-graph-client@3.0.7 --filter @insurtech/booking

# 3. Generer encryption key
openssl rand -hex 32  # copier dans .env CALENDAR_TOKENS_ENCRYPTION_KEY

# 4. Tests
pnpm --filter @insurtech/booking test calendar-sync
pnpm --filter api e2e -- --testPathPattern="booking/calendar-sync"

# 5. Smoke (necessite Google OAuth app configure)
JWT=...
curl -L localhost:4000/api/v1/booking/calendar-sync/oauth/google/authorize \
  -H "Authorization: Bearer $JWT" -H "x-tenant-id: $TENANT"
# -> retourne authUrl, ouvre browser pour consent

# 6. Verifier state Redis
redis-cli -n 4 KEYS "oauth_state:*"

# 7. Commit
git add -A
git commit -m "feat(sprint-08): booking calendar sync OAuth2 google + outlook + AES-256-GCM tokens"
```

---

## 10. Criteres validation V1-V22

### Criteres P0 (14)

- **V1 (P0)** : Migration cree table booking_calendar_syncs + RLS
- **V2 (P0)** : Deps googleapis 144 + microsoft-graph-client 3.0.7 installees
- **V3 (P0)** : typecheck exit 0
- **V4 (P0)** : 14 unit + 8 E2E + 4 OAuth = 26 tests PASS
- **V5 (P0)** : initiateOAuth retourne authUrl + state Redis
- **V6 (P0)** : handleOAuthCallback exchange + encrypt + insert
- **V7 (P0)** : State mismatch -> 400
- **V8 (P0)** : State one-shot (replay rejete)
- **V9 (P0)** : Tokens chiffres AES-256-GCM (jamais en clair DB)
- **V10 (P0)** : getValidAccessToken auto-refresh si expire
- **V11 (P0)** : Refresh fail -> status='requires_relogin'
- **V12 (P0)** : Disconnect revoke + hard delete + Kafka
- **V13 (P0)** : Multi-tenant isolation
- **V14 (P0)** : RBAC : permissions BOOKING_CALENDAR_SYNC_*

### Criteres P1 (5)

- **V15 (P1)** : PKCE code_challenge SHA256(verifier) genere correct
- **V16 (P1)** : State Redis TTL 10min auto-expire
- **V17 (P1)** : Upsert : second OAuth meme account update (pas duplicate)
- **V18 (P1)** : Coverage calendar-sync.service >= 90%
- **V19 (P1)** : Provider abstraction ICalendarProvider respecte par Google + Outlook

### Criteres P2 (3)

- **V20 (P2)** : No-emoji
- **V21 (P2)** : Lint 0 erreur
- **V22 (P2)** : Swagger 4 endpoints + examples

---

## 11. Edge cases + troubleshooting

### Edge case 1 : User completes OAuth flow apres 10min
**Solution** : State expired Redis. Message clair, retry.

### Edge case 2 : Concurrent OAuth flows meme user
**Solution** : Chaque flow genere son own state. OK.

### Edge case 3 : Google rate limit
**Solution** : Sprint 13+ monitoring. Sprint 8 accepte.

### Edge case 4 : Encryption key rotated
**Solution** : Sprint 33 key versioning. Sprint 8 v1 statique.

### Edge case 5 : User deletes from Google before disconnect
**Solution** : Refresh fail -> status='requires_relogin'.

### Edge case 6 : Network error during exchange
**Solution** : Catch + throw BadRequest. User retry.

### Edge case 7 : Outlook returns no email
**Solution** : userPrincipalName fallback.

### Edge case 8 : Encryption key < 32 bytes
**Solution** : EncryptionService Sprint 5 valide au boot. Throw au demarrage.

### Edge case 9 : Token decrypted but corrupted
**Solution** : Provider reject. getValidAccessToken catch -> requires_relogin.

### Edge case 10 : Disconnect quand sync deja deleted
**Solution** : 404 NotFound.

---

## 12. Conformite Maroc detaillee

### Loi 09-08 (CNDP)
- **Article 22** : Mesures securite. AES-256-GCM chiffrement tokens defense en profondeur.
- **Article 9** : Droit a l'oubli. Disconnect = hard delete tokens.

### ACAPS Circulaire AS/02/24
Pas direct (calendar = outil productivite).

### OWASP ASVS niveau 3 (cible Sprint 33)
PKCE flow + token encryption applicative conforme.

---

## 13. Conventions absolues skalean-insurtech

(Identique tache 3.1.1 -- 14 categories rappelees integralement.)

---

## 14. Validation pre-commit

```bash
cd repo
pnpm --filter @insurtech/booking typecheck
pnpm --filter @insurtech/booking lint
pnpm --filter @insurtech/booking test
pnpm --filter api e2e -- --testPathPattern="booking/calendar-sync"
grep -rP "[\x{1F300}-\x{1F9FF}]" packages/booking/src --include="*.ts" && exit 1 || echo OK
```

---

## 15. Commit message complet

```bash
git add -A
git commit -m "feat(sprint-08): booking calendar sync OAuth2 google + outlook + AES-256-GCM tokens

Infrastructure OAuth2 PKCE pour connexion Google Calendar / Outlook.
Tokens chiffres AES-256-GCM via EncryptionService Sprint 5. State Redis
db=4 TTL 10min one-shot anti-CSRF. Auto-refresh expired tokens.

Livrables:
- Migration booking_calendar_syncs + RLS
- packages/booking : CalendarSyncService + CalendarSyncStateService
- providers : GoogleCalendarProvider (googleapis 144) + OutlookCalendarProvider (graph-client 3.0.7)
- interface ICalendarProvider abstraction commune
- apps/api : CalendarSyncController (4 endpoints REST)
- 26 tests : 14 unit + 8 E2E + 4 OAuth full flow

Conformite : OWASP ASVS niveau 3 (PKCE + token encryption), CNDP article 22
Coverage: 91%

Task: 3.1.10
Sprint: 8 (Phase 3)
Reference: B-08 Tache 3.1.10"
```

---

## 16. Workflow next step

Apres commit :
- Configurer apps Google Cloud Console + Microsoft Azure AD pour obtenir CLIENT_ID/SECRET
- Tester manuellement OAuth flow avec compte demo
- Mettre a jour `_SUMMARY.md` tache 3.1.10 = complete
- Passer a `task-3.1.11-booking-availability-slots-business-hours.md` qui livrera service slots libres consume `RoomsService` + `AppointmentsService.findByRoom`.

---

**Fin du prompt task-3.1.10-booking-calendar-sync-oauth2-google-outlook.md**

Densite : approximativement 95 ko
Code patterns : 12 fichiers (~2160 lignes)
Tests : 26 cas (14 unit + 8 E2E + 4 OAuth full flow)
Criteres : V1-V22 (14 P0 + 5 P1 + 3 P2)
Edge cases : 10
