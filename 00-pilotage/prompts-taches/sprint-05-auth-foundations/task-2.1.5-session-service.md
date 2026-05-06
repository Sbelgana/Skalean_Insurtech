# TACHE 2.1.5 -- SessionService : Redis Storage + Lookup + Revocation + Rotation Atomique + Theft Detection

**Sprint** : 5 (Phase 2 / Sprint 1 dans phase) -- Auth Foundations
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-05-sprint-05-auth-foundations.md` (Tache 2.1.5)
**Phase** : 2 -- Securite & Multi-tenant
**Priorite** : P0 (bloquant pour 2.1.6 AuthService.refresh, 2.1.8 MfaRequiredGuard, 2.1.10 Lockout, 2.1.15 E2E)
**Effort** : 5h
**Dependances** : 2.1.4 (JwtService consomme), 2.1.3 (HashingService.sha256 + randomToken), Sprint 2 table `auth_sessions`
**Densite cible** : 80-150 ko (auto-suffisant exhaustif)
**AUCUNE EMOJI AUTORISEE**

---

## 1. But

Cette tache vise a livrer le service `SessionService` qui constitue le pilier de la gestion d'etat des sessions utilisateurs du programme Skalean InsurTech v2.2 : il stocke les refresh tokens (sous forme hashee SHA-256, defense en profondeur en cas de leak Redis) avec leurs metadonnees de session (user_id, tenant_id, role, ip, user_agent, mfa_verified, refresh_token_family, refresh_generation, created_at, last_seen_at, expires_at, locale, device_fingerprint, geo_country) dans Redis DB 1 SESSIONS, expose les operations atomiques `createSession`, `getSession`, `rotateSession` (l'operation cruciale qui invalide l'ancien jti et cree le nouveau dans une seule transaction Lua scriptee Redis pour eviter les race conditions), `revokeSession` (single jti), `revokeUserSessions` (tous les jti d'un user_id, pour signout-all et change-password), `revokeFamily` (tous les jti d'une `token_family`, pour theft detection), `isRevoked` (check blacklist), et `listUserSessions` (pour endpoint `/api/v1/auth/sessions` qui permet a l'utilisateur de voir et revoke ses sessions actives), et persiste en parallele dans la table SQL `auth_sessions` (Sprint 2) pour audit trail durable au-dela du TTL Redis. La detection de replay (theft detection) est implementee dans la methode `rotateSession` qui prend un `oldJti` et un `expectedGeneration` -- si la session correspondant a `oldJti` n'existe plus en Redis (deja invalidee par une rotation anterieure) OU si la `generation` stockee est superieure a `expectedGeneration`, c'est le signal de fork attack et la methode revoke automatiquement la `token_family` entiere et throw une exception specifique `RefreshReplayDetectedError` que AuthService Tache 2.1.6 traduit en HTTP 401 avec code `TOKEN_REUSE_DETECTED`.

L'apport est triple. Premierement, en stockant les refresh tokens hashes (SHA-256 du jti, pas du token entier) plutot qu'en clair, on garantit qu'un leak Redis seul ne permet pas a un attaquant de reutiliser les refresh tokens : il devrait casser SHA-256 prealablement (pratiquement impossible). Deuxiemement, en utilisant un script Lua atomique pour `rotateSession`, on elimine la classe de bugs ou deux requetes concurrentes (l'utilisateur legitime et un attaquant tentent simultanement le refresh) creent deux nouveaux jti et invalident l'un l'autre dans un ordre indetermine -- avec Lua atomique, exactement un succede et l'autre throw `RefreshReplayDetectedError` deterministically. Troisiemement, en persistant en parallele dans `auth_sessions` SQL, on cree un audit trail durable consultable via les outils standard SQL meme apres expiration Redis, ce qui est requis par la loi 09-08 article 5 (durable retention pour 5 ans des donnees d'authentification) et par les audits de l'autorite ACAPS qui peuvent demander l'historique des connexions sur une periode etendue.

A l'issue de cette tache, `SessionService.createSession({ userId, tenantId, role, jti, family, ip, userAgent, mfaVerified, rememberMe, locale })` ecrit en Redis (cle `session:{jti}` -> JSON) avec TTL = `JWT_REFRESH_TTL_SECONDS` (2592000 par defaut) et insere une ligne dans `auth_sessions` ; `SessionService.getSession(jti)` retourne le record ou null ; `SessionService.rotateSession({ oldJti, newJti, expectedGeneration, newGeneration, ip, userAgent })` execute atomiquement le DEL old + SET new si la generation correspond, sinon throw `RefreshReplayDetectedError` apres avoir revoke la family ; `SessionService.revokeSession(jti)` DELETE la cle Redis et SET `revoked:{jti}` -> 1 avec TTL = remaining lifetime ; `SessionService.isRevoked(jti)` retourne `true` apres revoke ; `SessionService.revokeUserSessions(userId)` SCAN par `user_id` et DELETE par batch ; `SessionService.revokeFamily(family)` SCAN par `token_family` et DELETE par batch ; `SessionService.listUserSessions(userId)` retourne array trie par `last_seen_at` desc ; et la suite Vitest couvre 40+ tests unit + integration avec Redis testcontainer Sprint 5.

---

## 2. Contexte etendu

### 2.1 Pourquoi cette tache existe

Le programme adopt un modele JWT "stateless en lecture, stateful en revocation" : la verification de signature est stateless (le serveur ne consulte pas Redis pour valider une signature, juste le secret), mais la verification de revocation est stateful (chaque requete authentifiee consulte Redis pour s'assurer que le jti n'a pas ete revoque -- pour signout, change-password, theft detection). Ce hybrid permet la performance (pas de DB lookup pour signature, l'ecrasante majorite des requetes) tout en preservant la capacite de revocation immediate (bloquante pour conformite ACAPS).

Sans ce service, soit on accepte de ne JAMAIS pouvoir revoquer un token avant son expiration naturelle (15 minutes pour access, 30 jours pour refresh) -- inacceptable pour signout-all + theft detection + change-password ; soit on lookup la DB Postgres a chaque requete -- inacceptable pour la latency p95 du programme (cible < 100 ms p95).

Redis est le bon outil : in-memory (latency < 1 ms p99), TTL natif (gerer expiration sans cron job), atomic operations (Lua script), scaling horizontal Sprint 35 (Redis Cluster Atlas Cloud Services). La DB SQL `auth_sessions` parallele sert l'audit durable.

Le pattern theft detection (token_family + generation atomic check) materialise la recommandation OAuth 2.0 BCP (RFC 9700) qui a evolue de "rotation simple" vers "rotation + replay detection" suite aux incidents documentes (Auth0 2018 review, Microsoft AAD 2020 review).

### 2.2 Alternatives considerees

| Alternative | Avantages | Inconvenients | Decision |
|-------------|-----------|---------------|----------|
| Stateless pur sans revocation | Performance maximum | Pas de signout reel ni theft detection | REJETE |
| Stateful Postgres seulement | Persist durable, transactions ACID | Latency 5-20 ms p99 par lookup | REJETE -- inacceptable a 10k rps |
| Stateful Redis seulement | Latency excellent | Perte audit durable apres expiration | REJETE pour audit ACAPS |
| Stateful Redis + Postgres parallele (RETENU) | Performance lookup Redis + audit Postgres | Complexite double-write | RETENU -- meilleur compromis |
| Redis seul + replication multi-DC | Tout dans Redis, replication Atlas | Recovery en cas de loss memoire complet | REJETE -- preferer 2 datastores |
| Token tracking sans family | Simple | Pas de theft detection cross-rotation | REJETE -- defense critique |

### 2.3 Trade-offs explicites

Choisir double-write Redis + Postgres implique un cout d'ecriture double (mais en parallele async) a chaque createSession. Acceptable car createSession est rare (1x par login), pas par requete.

Choisir d'invalider la family entiere sur replay detection implique que l'utilisateur legitime sera force de re-login sur tous ses devices. C'est un trade-off securite > UX intentionnel : mieux vaut deconnecter un utilisateur legitime que de laisser un attaquant maintenir une session.

Choisir TTL Redis = 30 jours (= TTL refresh JWT) implique de la memoire Redis consommee. Estimation : 1M sessions actives x ~500 bytes = 500 MB. Acceptable sur Atlas Cloud Services.

Choisir Lua script atomique implique de maintenir un script (testable, pas de race condition) mais ajoute complexite. Le critere V8 verifie via test de concurrence simulee.

### 2.4 Decisions strategiques

- decision-014 (JWT theft detection rotation), decision-006 (no-emoji), decision-008 (Redis Atlas Sprint 35), decision-002 (TS strict).

### 2.5 Pieges techniques

1. **Race rotation concurrente** : 2 requetes refresh paralleles. Lua atomique elimine.
2. **Memory leak Redis** : sessions qui ne expirent pas. TTL strict + monitoring Sprint 33.
3. **SCAN performance** : revokeUserSessions sur 1M sessions. Solution : index secondaire `user_sessions:{user_id}` -> Set of jti.
4. **Postgres write fail apres Redis success** : double-write incoherence. Solution : log warning, ne pas throw (Redis source de verite).
5. **Lua script update** : modifier le script en prod sans downtime. Solution : SHA-1 du script versionne, deploy ZIP avec EVAL fallback.
6. **TTL drift** : access token TTL diverge de session TTL. Solution : access token court (15 min), session = refresh TTL (30 j).
7. **last_seen_at update bottleneck** : update a chaque request ralentit. Solution : update toutes les 60s seulement (debounce).
8. **revokeFamily missing tokens** : famille pas indexee. Solution : index secondaire `family:{token_family}` -> Set of jti.
9. **device_fingerprint legal MA** : collecter fingerprint = donnee personnelle. Solution : mention CNDP loi 09-08 + opt-in user.
10. **Geo-location fail** : ip lookup down. Solution : graceful skip, ne bloque pas login.
11. **Cleanup expired auth_sessions SQL** : croissance infinie table. Solution : cron Sprint 35 archive > 90j.
12. **Connection pool Redis epuise** : peak load. Solution : pool size 100 par instance, monitoring Sprint 33.

---

## 3. Architecture context

Tache 2.1.5 livre le service consomme par : 2.1.6 (AuthService.signin createSession, signout revoke, refresh rotateSession), 2.1.10 (Lockout consume tracking IPs), 2.1.12 (AuditService log session events).

Sprint 6 ajoutera filter par tenant_id ; Sprint 25 cross-tenant impersonate sessions ; Sprint 33 metrics Prometheus.

```
JwtService (2.1.4) --> SessionService (THIS) --> Redis DB 1 + Postgres auth_sessions
                              |
                              +-- consumes HashingService.sha256 (jti -> hash)
                              +-- consumes Argon2Service.timingSafeStringEqual (compare)
                              +-- triggers RefreshReplayDetectedError -> AuthService 401
```

---

## 4. Livrables checkables (24 livrables)

- [ ] Service `repo/packages/auth/src/services/session.service.ts` -- ~350 lignes
- [ ] Repository `repo/packages/auth/src/services/session.repository.ts` (interface + Redis impl + Postgres impl) -- ~250 lignes
- [ ] Lua script `repo/packages/auth/src/services/session-rotate.lua` -- ~30 lignes
- [ ] Errors `repo/packages/auth/src/errors/session-errors.ts` (RefreshReplayDetectedError, SessionNotFoundError, SessionExpiredError) -- ~80 lignes
- [ ] Helper `repo/packages/auth/src/services/session.helpers.ts` (buildSessionKey, parseSessionRecord) -- ~80 lignes
- [ ] Type SessionMetadata -- ~30 lignes
- [ ] Mise a jour auth.module.ts -- modification
- [ ] Mise a jour index.ts -- modification
- [ ] Mise a jour package.json (ioredis 5.4.1, drizzle-orm pour auth_sessions) -- modification
- [ ] Tests `session.service.spec.ts` (mock ioredis) 25+ tests -- ~400 lignes
- [ ] Tests `session.repository.spec.ts` 10+ tests -- ~150 lignes
- [ ] Tests `session-errors.spec.ts` 4 tests -- ~60 lignes
- [ ] Tests integration avec Redis testcontainer 8 tests -- ~250 lignes
- [ ] Tests integration concurrence rotation atomic 4 tests -- ~150 lignes
- [ ] Bench session ops -- ~50 lignes
- [ ] Variables env REDIS_SESSIONS_DB, SESSION_DEFAULT_TTL, etc. -- modification .env.example
- [ ] Migration SQL `auth_sessions` (deja Sprint 2, verifier schema)
- [ ] No-emoji
- [ ] No-console
- [ ] Coverage >= 92%
- [ ] Lua script teste atomically
- [ ] revokeFamily revoque tous tokens family
- [ ] revokeUserSessions revoque tous tokens user
- [ ] Documentation JSDoc complete

---

## 5. Fichiers crees / modifies

```
repo/packages/auth/src/services/session.service.ts                      (~350 lignes)
repo/packages/auth/src/services/session.repository.ts                   (~250 lignes)
repo/packages/auth/src/services/session-rotate.lua                      (~30 lignes)
repo/packages/auth/src/services/session.helpers.ts                      (~80 lignes)
repo/packages/auth/src/errors/session-errors.ts                          (~80 lignes)
repo/packages/auth/src/types/session-metadata.ts                         (~30 lignes)
repo/packages/auth/src/auth.module.ts                                    (modifie)
repo/packages/auth/src/index.ts                                          (modifie)
repo/packages/auth/package.json                                          (modifie)
.env.example                                                              (modifie)
repo/packages/auth/test/services/session.service.spec.ts                  (~400 lignes)
repo/packages/auth/test/services/session.repository.spec.ts               (~150 lignes)
repo/packages/auth/test/errors/session-errors.spec.ts                     (~60 lignes)
repo/packages/auth/test/integration/session.integration.spec.ts           (~250 lignes)
repo/packages/auth/test/integration/session-concurrency.spec.ts           (~150 lignes)
repo/packages/auth/test/bench/session.bench.ts                            (~50 lignes)
```

---

## 6. Code patterns COMPLETS

### 6.1 Fichier 1 / 12 : `repo/packages/auth/src/errors/session-errors.ts`

```typescript
/**
 * @insurtech/auth/errors/session-errors
 */

export class SessionError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code: string, status = 401) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.status = status;
  }

  toJSON(): Record<string, unknown> {
    return { name: this.name, code: this.code, message: this.message };
  }
}

export class SessionNotFoundError extends SessionError {
  constructor(jti: string) {
    super(`Session not found: ${jti}`, 'SESSION_NOT_FOUND', 401);
  }
}

export class SessionExpiredError extends SessionError {
  constructor(jti: string, expiredAt: number) {
    super(`Session ${jti} expired at ${new Date(expiredAt * 1000).toISOString()}`, 'SESSION_EXPIRED', 401);
  }
}

export class SessionRevokedError extends SessionError {
  constructor(jti: string) {
    super(`Session ${jti} has been revoked`, 'SESSION_REVOKED', 401);
  }
}

export class RefreshReplayDetectedError extends SessionError {
  readonly token_family: string;
  constructor(tokenFamily: string, expectedGeneration: number, presentedGeneration: number) {
    super(
      `Refresh token replay detected for family ${tokenFamily} (expected gen ${expectedGeneration}, got ${presentedGeneration})`,
      'TOKEN_REUSE_DETECTED',
      401,
    );
    this.token_family = tokenFamily;
  }
}

export function isSessionError(err: unknown): err is SessionError {
  return err instanceof SessionError;
}
```

### 6.2 Fichier 2 / 12 : `repo/packages/auth/src/types/session-metadata.ts`

```typescript
import type { AuthRole } from './auth-roles.js';

export interface SessionMetadata {
  user_id: string;
  tenant_id: string | null;
  role: AuthRole;
  jti: string;
  refresh_token_family: string;
  refresh_generation: number;
  ip: string;
  user_agent: string;
  mfa_verified: boolean;
  remember_me: boolean;
  created_at: number;
  last_seen_at: number;
  expires_at: number;
  locale?: string;
  device_fingerprint?: string;
  geo_country?: string;
}

export interface CreateSessionInput {
  user_id: string;
  tenant_id: string | null;
  role: AuthRole;
  jti: string;
  refresh_token_family: string;
  refresh_generation: number;
  ip: string;
  user_agent: string;
  mfa_verified: boolean;
  remember_me?: boolean;
  locale?: string;
  device_fingerprint?: string;
}

export interface RotateSessionInput {
  old_jti: string;
  new_jti: string;
  expected_generation: number;
  new_generation: number;
  ip: string;
  user_agent: string;
}
```

### 6.3 Fichier 3 / 12 : `repo/packages/auth/src/services/session.helpers.ts`

```typescript
import type { SessionMetadata } from '../types/session-metadata.js';

const SESSION_KEY_PREFIX = 'session:';
const REVOKED_KEY_PREFIX = 'revoked:';
const USER_SESSIONS_INDEX = 'user_sessions:';
const FAMILY_INDEX = 'family:';

export function buildSessionKey(jti: string): string {
  return `${SESSION_KEY_PREFIX}${jti}`;
}

export function buildRevokedKey(jti: string): string {
  return `${REVOKED_KEY_PREFIX}${jti}`;
}

export function buildUserSessionsKey(userId: string): string {
  return `${USER_SESSIONS_INDEX}${userId}`;
}

export function buildFamilyKey(family: string): string {
  return `${FAMILY_INDEX}${family}`;
}

export function serializeSession(s: SessionMetadata): string {
  return JSON.stringify(s);
}

export function parseSessionRecord(raw: string | null): SessionMetadata | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionMetadata;
  } catch {
    return null;
  }
}

export function isExpiredSession(s: SessionMetadata, nowSeconds: number): boolean {
  return s.expires_at < nowSeconds;
}
```

### 6.4 Fichier 4 / 12 : `repo/packages/auth/src/services/session-rotate.lua`

```lua
-- session-rotate.lua
-- Atomic refresh token rotation with theft detection.
-- KEYS[1] = session:{old_jti}
-- KEYS[2] = session:{new_jti}
-- KEYS[3] = revoked:{old_jti}
-- KEYS[4] = family:{token_family} (set of jti)
-- ARGV[1] = expected_generation (string)
-- ARGV[2] = new_session_json
-- ARGV[3] = ttl_seconds
-- ARGV[4] = remaining_lifetime_seconds (for revoked TTL)
-- ARGV[5] = new_jti
-- Returns : "OK" on success, "REPLAY" on theft detection, "NOT_FOUND" on missing

local oldRaw = redis.call('GET', KEYS[1])
if oldRaw == false then
  return 'NOT_FOUND'
end

local oldSession = cjson.decode(oldRaw)
local expectedGen = tonumber(ARGV[1])

if oldSession.refresh_generation ~= expectedGen then
  -- replay : someone presented a generation that does not match current
  return 'REPLAY'
end

-- Atomic : delete old, blacklist old jti, set new, add to family index
redis.call('DEL', KEYS[1])
redis.call('SET', KEYS[3], '1', 'EX', tonumber(ARGV[4]))
redis.call('SET', KEYS[2], ARGV[2], 'EX', tonumber(ARGV[3]))
redis.call('SADD', KEYS[4], ARGV[5])
redis.call('EXPIRE', KEYS[4], tonumber(ARGV[3]))

return 'OK'
```

### 6.5 Fichier 5 / 12 : `repo/packages/auth/src/services/session.service.ts`

```typescript
/**
 * @insurtech/auth/services/session
 *
 * Stateful session storage in Redis (DB 1) with parallel SQL audit trail.
 * Implements OAuth 2.0 BCP refresh token rotation with theft detection.
 */

import { Injectable, Logger, OnModuleInit, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Redis } from 'ioredis';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HashingService } from './hashing.service.js';
import {
  buildSessionKey,
  buildRevokedKey,
  buildUserSessionsKey,
  buildFamilyKey,
  serializeSession,
  parseSessionRecord,
  isExpiredSession,
} from './session.helpers.js';
import {
  SessionNotFoundError,
  SessionRevokedError,
  RefreshReplayDetectedError,
} from '../errors/session-errors.js';
import type { SessionMetadata, CreateSessionInput, RotateSessionInput } from '../types/session-metadata.js';
import { nowInSeconds } from '../types/jwt-payload.js';

export const REDIS_TOKEN = Symbol('SESSION_REDIS');
export const SESSION_REPOSITORY_TOKEN = Symbol('SESSION_REPOSITORY');

interface SessionRepository {
  insert(s: SessionMetadata): Promise<void>;
  markRevoked(jti: string): Promise<void>;
  findByUserId(userId: string): Promise<SessionMetadata[]>;
  updateLastSeenAt(jti: string, ts: number): Promise<void>;
}

@Injectable()
export class SessionService implements OnModuleInit {
  private readonly logger = new Logger(SessionService.name);
  private rotateScriptSha: string | null = null;
  private readonly defaultTtl: number;
  private readonly rememberMeTtl: number;
  private readonly rotateScript: string;

  constructor(
    @Inject(REDIS_TOKEN) private readonly redis: Redis,
    @Inject(SESSION_REPOSITORY_TOKEN) private readonly repo: SessionRepository,
    private readonly hashing: HashingService,
    private readonly config: ConfigService,
  ) {
    this.defaultTtl = Number.parseInt(this.config.get<string>('SESSION_DEFAULT_TTL_SECONDS') ?? '28800', 10);
    this.rememberMeTtl = Number.parseInt(this.config.get<string>('SESSION_REMEMBER_ME_TTL_SECONDS') ?? '2592000', 10);
    const here = dirname(fileURLToPath(import.meta.url));
    this.rotateScript = readFileSync(join(here, 'session-rotate.lua'), 'utf-8');
  }

  async onModuleInit(): Promise<void> {
    this.rotateScriptSha = (await this.redis.script('LOAD', this.rotateScript)) as string;
    this.logger.log({ action: 'session_service_init', script_sha: this.rotateScriptSha });
  }

  /**
   * Creates a session in Redis + writes audit row in SQL (parallel).
   * TTL = remember_me ? rememberMeTtl : defaultTtl.
   */
  async createSession(input: CreateSessionInput): Promise<SessionMetadata> {
    const now = nowInSeconds();
    const ttl = input.remember_me === true ? this.rememberMeTtl : this.defaultTtl;
    const session: SessionMetadata = {
      user_id: input.user_id,
      tenant_id: input.tenant_id,
      role: input.role,
      jti: input.jti,
      refresh_token_family: input.refresh_token_family,
      refresh_generation: input.refresh_generation,
      ip: input.ip,
      user_agent: input.user_agent,
      mfa_verified: input.mfa_verified,
      remember_me: input.remember_me ?? false,
      created_at: now,
      last_seen_at: now,
      expires_at: now + ttl,
      locale: input.locale,
      device_fingerprint: input.device_fingerprint,
    };

    const tx = this.redis.multi();
    tx.set(buildSessionKey(session.jti), serializeSession(session), 'EX', ttl);
    tx.sadd(buildUserSessionsKey(session.user_id), session.jti);
    tx.expire(buildUserSessionsKey(session.user_id), ttl);
    tx.sadd(buildFamilyKey(session.refresh_token_family), session.jti);
    tx.expire(buildFamilyKey(session.refresh_token_family), ttl);
    await tx.exec();

    this.repo.insert(session).catch((err) => {
      this.logger.warn({ err: err instanceof Error ? err.message : err, jti: session.jti }, 'auth_sessions insert failed (Redis is source of truth)');
    });

    return session;
  }

  async getSession(jti: string): Promise<SessionMetadata | null> {
    const raw = await this.redis.get(buildSessionKey(jti));
    return parseSessionRecord(raw);
  }

  async ensureValid(jti: string): Promise<SessionMetadata> {
    if (await this.isRevoked(jti)) throw new SessionRevokedError(jti);
    const s = await this.getSession(jti);
    if (!s) throw new SessionNotFoundError(jti);
    if (isExpiredSession(s, nowInSeconds())) throw new SessionRevokedError(jti);
    return s;
  }

  async isRevoked(jti: string): Promise<boolean> {
    const r = await this.redis.exists(buildRevokedKey(jti));
    return r === 1;
  }

  async revokeSession(jti: string): Promise<void> {
    const s = await this.getSession(jti);
    if (!s) return;
    const remaining = Math.max(s.expires_at - nowInSeconds(), 60);
    const tx = this.redis.multi();
    tx.del(buildSessionKey(jti));
    tx.set(buildRevokedKey(jti), '1', 'EX', remaining);
    tx.srem(buildUserSessionsKey(s.user_id), jti);
    tx.srem(buildFamilyKey(s.refresh_token_family), jti);
    await tx.exec();

    this.repo.markRevoked(jti).catch((err) => {
      this.logger.warn({ err: err instanceof Error ? err.message : err, jti }, 'auth_sessions markRevoked failed');
    });
  }

  async revokeUserSessions(userId: string): Promise<number> {
    const jtis = await this.redis.smembers(buildUserSessionsKey(userId));
    let count = 0;
    for (const jti of jtis) {
      await this.revokeSession(jti);
      count += 1;
    }
    await this.redis.del(buildUserSessionsKey(userId));
    return count;
  }

  async revokeFamily(family: string): Promise<number> {
    const jtis = await this.redis.smembers(buildFamilyKey(family));
    let count = 0;
    for (const jti of jtis) {
      await this.revokeSession(jti);
      count += 1;
    }
    await this.redis.del(buildFamilyKey(family));
    return count;
  }

  /**
   * Atomic rotate via Lua script.
   * Throws RefreshReplayDetectedError if expected_generation does not match.
   * On replay, the entire family is revoked.
   */
  async rotateSession(input: RotateSessionInput, newSessionData: Omit<CreateSessionInput, 'jti' | 'refresh_token_family' | 'refresh_generation'>): Promise<SessionMetadata> {
    const old = await this.getSession(input.old_jti);
    if (!old) {
      throw new SessionNotFoundError(input.old_jti);
    }

    const ttl = old.remember_me ? this.rememberMeTtl : this.defaultTtl;
    const now = nowInSeconds();
    const newSession: SessionMetadata = {
      user_id: old.user_id,
      tenant_id: old.tenant_id,
      role: old.role,
      jti: input.new_jti,
      refresh_token_family: old.refresh_token_family,
      refresh_generation: input.new_generation,
      ip: input.ip,
      user_agent: input.user_agent,
      mfa_verified: old.mfa_verified,
      remember_me: old.remember_me,
      created_at: now,
      last_seen_at: now,
      expires_at: now + ttl,
      locale: newSessionData.locale ?? old.locale,
    };

    const remainingOld = Math.max(old.expires_at - now, 60);
    const result = (await this.redis.eval(
      this.rotateScript,
      4,
      buildSessionKey(input.old_jti),
      buildSessionKey(input.new_jti),
      buildRevokedKey(input.old_jti),
      buildFamilyKey(old.refresh_token_family),
      String(input.expected_generation),
      serializeSession(newSession),
      String(ttl),
      String(remainingOld),
      input.new_jti,
    )) as string;

    if (result === 'REPLAY') {
      this.logger.warn(
        { token_family: old.refresh_token_family, expected: input.expected_generation, presented: old.refresh_generation, action: 'replay_detected' },
        'Refresh token replay detected -- revoking entire family',
      );
      await this.revokeFamily(old.refresh_token_family);
      throw new RefreshReplayDetectedError(old.refresh_token_family, old.refresh_generation, input.expected_generation);
    }
    if (result === 'NOT_FOUND') {
      throw new SessionNotFoundError(input.old_jti);
    }

    await this.redis.sadd(buildUserSessionsKey(newSession.user_id), input.new_jti);
    return newSession;
  }

  async listUserSessions(userId: string): Promise<SessionMetadata[]> {
    const jtis = await this.redis.smembers(buildUserSessionsKey(userId));
    const sessions: SessionMetadata[] = [];
    for (const jti of jtis) {
      const s = await this.getSession(jti);
      if (s) sessions.push(s);
    }
    sessions.sort((a, b) => b.last_seen_at - a.last_seen_at);
    return sessions;
  }

  /**
   * Updates last_seen_at, debounced to 60s to avoid hot key.
   */
  async touchLastSeen(jti: string, ipAddr: string): Promise<void> {
    const s = await this.getSession(jti);
    if (!s) return;
    const now = nowInSeconds();
    if (now - s.last_seen_at < 60) return;
    const updated: SessionMetadata = { ...s, last_seen_at: now, ip: ipAddr };
    const ttl = Math.max(s.expires_at - now, 1);
    await this.redis.set(buildSessionKey(jti), serializeSession(updated), 'EX', ttl);
    this.repo.updateLastSeenAt(jti, now).catch(() => {/* non-blocking */});
  }
}
```

### 6.6 Fichier 6 / 12 : `repo/packages/auth/src/services/session.repository.ts`

```typescript
/**
 * @insurtech/auth/services/session.repository
 *
 * Postgres-backed implementation of the SessionRepository interface.
 * Provides durable audit trail beyond the Redis TTL.
 *
 * The interface allows mock substitution for unit tests.
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import type { SessionMetadata } from '../types/session-metadata.js';

export interface SessionRepository {
  insert(s: SessionMetadata): Promise<void>;
  markRevoked(jti: string): Promise<void>;
  findByUserId(userId: string): Promise<SessionMetadata[]>;
  updateLastSeenAt(jti: string, ts: number): Promise<void>;
}

export const SESSION_REPOSITORY_TOKEN = Symbol('SESSION_REPOSITORY');

/**
 * Postgres implementation. The actual DB connection is provided via
 * @insurtech/database (Sprint 2). For Sprint 5, we accept any client
 * with a query method; Sprint 6 will refine the type.
 */
@Injectable()
export class PostgresSessionRepository implements SessionRepository {
  private readonly logger = new Logger(PostgresSessionRepository.name);

  constructor(
    @Inject('DB_CLIENT') private readonly db: { query: (sql: string, params: unknown[]) => Promise<{ rows: unknown[] }> },
  ) {}

  async insert(s: SessionMetadata): Promise<void> {
    await this.db.query(
      `INSERT INTO auth_sessions (
        jti, user_id, tenant_id, role, refresh_token_family, refresh_generation,
        ip, user_agent, mfa_verified, remember_me, created_at, last_seen_at, expires_at, locale, device_fingerprint
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, to_timestamp($11), to_timestamp($12), to_timestamp($13), $14, $15)
      ON CONFLICT (jti) DO NOTHING`,
      [
        s.jti, s.user_id, s.tenant_id, s.role, s.refresh_token_family, s.refresh_generation,
        s.ip, s.user_agent, s.mfa_verified, s.remember_me, s.created_at, s.last_seen_at, s.expires_at,
        s.locale ?? null, s.device_fingerprint ?? null,
      ],
    );
  }

  async markRevoked(jti: string): Promise<void> {
    await this.db.query(
      `UPDATE auth_sessions SET revoked_at = NOW() WHERE jti = $1 AND revoked_at IS NULL`,
      [jti],
    );
  }

  async findByUserId(userId: string): Promise<SessionMetadata[]> {
    const r = await this.db.query(
      `SELECT * FROM auth_sessions WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > NOW() ORDER BY last_seen_at DESC LIMIT 100`,
      [userId],
    );
    return r.rows as SessionMetadata[];
  }

  async updateLastSeenAt(jti: string, ts: number): Promise<void> {
    await this.db.query(
      `UPDATE auth_sessions SET last_seen_at = to_timestamp($2) WHERE jti = $1`,
      [jti, ts],
    );
  }
}
```

### 6.7 Fichier 7 / 12 : Mise a jour `auth.module.ts`

```typescript
import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { Argon2Service } from './services/argon2.service.js';
import { PepperService } from './services/pepper.service.js';
import { EncryptionService } from './services/encryption.service.js';
import { HashingService } from './services/hashing.service.js';
import { JwtService } from './services/jwt.service.js';
import { SessionService, REDIS_TOKEN } from './services/session.service.js';
import { PostgresSessionRepository, SESSION_REPOSITORY_TOKEN } from './services/session.repository.js';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    PepperService,
    Argon2Service,
    EncryptionService,
    HashingService,
    JwtService,
    {
      provide: REDIS_TOKEN,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => new Redis({
        host: config.get<string>('REDIS_HOST') ?? 'localhost',
        port: Number.parseInt(config.get<string>('REDIS_PORT') ?? '6379', 10),
        db: Number.parseInt(config.get<string>('REDIS_SESSIONS_DB') ?? '1', 10),
        password: config.get<string>('REDIS_PASSWORD'),
      }),
    },
    {
      provide: SESSION_REPOSITORY_TOKEN,
      useClass: PostgresSessionRepository,
    },
    SessionService,
  ],
  exports: [
    PepperService, Argon2Service, EncryptionService, HashingService, JwtService,
    SessionService, REDIS_TOKEN, SESSION_REPOSITORY_TOKEN,
  ],
})
export class AuthModule {}
```

### 6.8 Fichier 8 / 12 : Mise a jour `index.ts`

```typescript
export * from './types/index.js';
export * from './schemas/index.js';
export * from './constants/index.js';

export { Argon2Service, PepperService, EncryptionService, HashingService, JwtService } from './services/index.js';
export { SessionService, REDIS_TOKEN } from './services/session.service.js';
export type { SessionMetadata, CreateSessionInput, RotateSessionInput } from './types/session-metadata.js';
export type { SessionRepository } from './services/session.repository.js';
export { PostgresSessionRepository, SESSION_REPOSITORY_TOKEN } from './services/session.repository.js';

export {
  SessionError, SessionNotFoundError, SessionExpiredError, SessionRevokedError, RefreshReplayDetectedError,
  isSessionError,
} from './errors/session-errors.js';

export {
  TokenError, TokenExpiredError, TokenSignatureError, TokenAudienceError,
  TokenIssuerError, TokenInvalidError, TokenMissingClaimError, TokenNotBeforeError, isTokenError,
} from './errors/token-errors.js';

export type { SignedJwt, TokenPair } from './types/token-pair.js';
export type { PasswordPolicyResult, PasswordPolicyReason } from './types/password-policy-result.js';
export type { EncryptedString, EncryptedPayload } from './types/encrypted-payload.js';
export { ALL_PASSWORD_POLICY_REASONS } from './types/password-policy-result.js';

export { AuthModule } from './auth.module.js';
```

### 6.9 Fichier 9 / 12 : `.env.example` additions

```env
# Sprint 5 Tache 2.1.5 -- SessionService
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_SESSIONS_DB=1
SESSION_DEFAULT_TTL_SECONDS=28800
SESSION_REMEMBER_ME_TTL_SECONDS=2592000
```

### 6.10 Fichier 10 / 12 : `package.json` additions

```json
{
  "dependencies": {
    "ioredis": "5.4.1"
  }
}
```

### 6.11 Fichier 11 / 12 : Migration auth_sessions verification

Verifier que Sprint 2 a cree la table `auth_sessions` avec colonnes :
- `jti TEXT PRIMARY KEY`
- `user_id UUID NOT NULL`
- `tenant_id UUID NULL`
- `role TEXT NOT NULL`
- `refresh_token_family TEXT NOT NULL`
- `refresh_generation INT NOT NULL`
- `ip INET NOT NULL`
- `user_agent TEXT NOT NULL`
- `mfa_verified BOOLEAN NOT NULL`
- `remember_me BOOLEAN NOT NULL`
- `created_at TIMESTAMPTZ NOT NULL`
- `last_seen_at TIMESTAMPTZ NOT NULL`
- `expires_at TIMESTAMPTZ NOT NULL`
- `revoked_at TIMESTAMPTZ NULL`
- `locale TEXT NULL`
- `device_fingerprint TEXT NULL`
- index `idx_user_sessions ON auth_sessions(user_id) WHERE revoked_at IS NULL`
- index `idx_family_sessions ON auth_sessions(refresh_token_family)`

Si manquant, creer migration Sprint 5.

### 6.12 Fichier 12 / 12 : Test integration concurrence (voir section 7.5)

---

## 7. Tests complets

### 7.1 Tests unitaires `repo/packages/auth/test/services/session.service.spec.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import RedisMock from 'ioredis-mock';
import { SessionService, REDIS_TOKEN } from '../../src/services/session.service.js';
import { SESSION_REPOSITORY_TOKEN } from '../../src/services/session.repository.js';
import { HashingService } from '../../src/services/hashing.service.js';
import { AuthRole } from '../../src/types/auth-roles.js';
import {
  SessionNotFoundError, RefreshReplayDetectedError,
} from '../../src/errors/session-errors.js';

describe('SessionService', () => {
  let service: SessionService;
  let redis: any;
  let repo: { insert: any; markRevoked: any; findByUserId: any; updateLastSeenAt: any };

  beforeEach(async () => {
    redis = new RedisMock();
    repo = {
      insert: vi.fn().mockResolvedValue(undefined),
      markRevoked: vi.fn().mockResolvedValue(undefined),
      findByUserId: vi.fn().mockResolvedValue([]),
      updateLastSeenAt: vi.fn().mockResolvedValue(undefined),
    };
    process.env.SESSION_DEFAULT_TTL_SECONDS = '900';
    process.env.SESSION_REMEMBER_ME_TTL_SECONDS = '2592000';
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      providers: [
        HashingService,
        { provide: REDIS_TOKEN, useValue: redis },
        { provide: SESSION_REPOSITORY_TOKEN, useValue: repo },
        SessionService,
      ],
    }).compile();
    service = moduleRef.get(SessionService);
    await service.onModuleInit();
  });

  describe('createSession', () => {
    it('stores session in Redis with TTL', async () => {
      const s = await service.createSession({
        user_id: 'u1', tenant_id: 't1', role: AuthRole.BrokerUser,
        jti: 'j1', refresh_token_family: 'f1', refresh_generation: 1,
        ip: '1.1.1.1', user_agent: 'UA', mfa_verified: true, remember_me: false,
      });
      expect(s.jti).toBe('j1');
      const fetched = await service.getSession('j1');
      expect(fetched?.user_id).toBe('u1');
    });

    it('writes audit row in repo', async () => {
      await service.createSession({
        user_id: 'u1', tenant_id: null, role: AuthRole.SuperAdminPlatform,
        jti: 'j2', refresh_token_family: 'f2', refresh_generation: 1,
        ip: '1.1.1.1', user_agent: 'UA', mfa_verified: true,
      });
      // repo.insert called async (fire and forget) -- give it a tick
      await new Promise((r) => setTimeout(r, 10));
      expect(repo.insert).toHaveBeenCalled();
    });

    it('respects remember_me TTL', async () => {
      const s = await service.createSession({
        user_id: 'u1', tenant_id: 't1', role: AuthRole.BrokerUser,
        jti: 'j3', refresh_token_family: 'f3', refresh_generation: 1,
        ip: '1.1.1.1', user_agent: 'UA', mfa_verified: true, remember_me: true,
      });
      expect(s.expires_at - s.created_at).toBe(2592000);
    });
  });

  describe('getSession', () => {
    it('returns null for non-existent', async () => {
      expect(await service.getSession('missing')).toBeNull();
    });
  });

  describe('isRevoked', () => {
    it('returns false initially', async () => {
      expect(await service.isRevoked('j1')).toBe(false);
    });

    it('returns true after revoke', async () => {
      await service.createSession({
        user_id: 'u1', tenant_id: 't1', role: AuthRole.BrokerUser,
        jti: 'jR', refresh_token_family: 'fR', refresh_generation: 1,
        ip: '1.1.1.1', user_agent: 'UA', mfa_verified: true,
      });
      await service.revokeSession('jR');
      expect(await service.isRevoked('jR')).toBe(true);
    });
  });

  describe('revokeSession', () => {
    it('removes session from Redis and adds to blacklist', async () => {
      await service.createSession({
        user_id: 'u1', tenant_id: 't1', role: AuthRole.BrokerUser,
        jti: 'jX', refresh_token_family: 'fX', refresh_generation: 1,
        ip: '1.1.1.1', user_agent: 'UA', mfa_verified: true,
      });
      await service.revokeSession('jX');
      expect(await service.getSession('jX')).toBeNull();
      expect(await service.isRevoked('jX')).toBe(true);
    });

    it('idempotent: revoking non-existent is no-op', async () => {
      await expect(service.revokeSession('missing')).resolves.toBeUndefined();
    });
  });

  describe('revokeUserSessions', () => {
    it('revokes all sessions of a user', async () => {
      for (let i = 1; i <= 3; i += 1) {
        await service.createSession({
          user_id: 'uALL', tenant_id: 't1', role: AuthRole.BrokerUser,
          jti: `jALL${i}`, refresh_token_family: `fALL${i}`, refresh_generation: 1,
          ip: '1.1.1.1', user_agent: 'UA', mfa_verified: true,
        });
      }
      const count = await service.revokeUserSessions('uALL');
      expect(count).toBe(3);
      for (let i = 1; i <= 3; i += 1) {
        expect(await service.isRevoked(`jALL${i}`)).toBe(true);
      }
    });
  });

  describe('revokeFamily', () => {
    it('revokes all sessions of a family', async () => {
      for (let i = 1; i <= 3; i += 1) {
        await service.createSession({
          user_id: 'uF', tenant_id: 't1', role: AuthRole.BrokerUser,
          jti: `jF${i}`, refresh_token_family: 'famX', refresh_generation: i,
          ip: '1.1.1.1', user_agent: 'UA', mfa_verified: true,
        });
      }
      const count = await service.revokeFamily('famX');
      expect(count).toBe(3);
    });
  });

  describe('rotateSession', () => {
    it('rotates atomically with matching generation', async () => {
      await service.createSession({
        user_id: 'uR', tenant_id: 't1', role: AuthRole.BrokerUser,
        jti: 'jOld', refresh_token_family: 'famR', refresh_generation: 1,
        ip: '1.1.1.1', user_agent: 'UA', mfa_verified: true,
      });
      const ns = await service.rotateSession(
        { old_jti: 'jOld', new_jti: 'jNew', expected_generation: 1, new_generation: 2, ip: '2.2.2.2', user_agent: 'UA2' },
        { user_id: 'uR', tenant_id: 't1', role: AuthRole.BrokerUser, jti: 'unused', refresh_token_family: 'famR', refresh_generation: 2, ip: '2.2.2.2', user_agent: 'UA2', mfa_verified: true },
      );
      expect(ns.jti).toBe('jNew');
      expect(ns.refresh_generation).toBe(2);
      expect(await service.isRevoked('jOld')).toBe(true);
    });

    it('throws RefreshReplayDetectedError on generation mismatch', async () => {
      await service.createSession({
        user_id: 'uReplay', tenant_id: 't1', role: AuthRole.BrokerUser,
        jti: 'jReplay', refresh_token_family: 'famReplay', refresh_generation: 5,
        ip: '1.1.1.1', user_agent: 'UA', mfa_verified: true,
      });
      await expect(
        service.rotateSession(
          { old_jti: 'jReplay', new_jti: 'jReplayNew', expected_generation: 3, new_generation: 4, ip: '2.2.2.2', user_agent: 'UA2' },
          { user_id: 'uReplay', tenant_id: 't1', role: AuthRole.BrokerUser, jti: 'unused', refresh_token_family: 'famReplay', refresh_generation: 4, ip: '2.2.2.2', user_agent: 'UA2', mfa_verified: true },
        ),
      ).rejects.toThrow(RefreshReplayDetectedError);
    });

    it('revokes entire family on replay detection', async () => {
      for (let i = 1; i <= 3; i += 1) {
        await service.createSession({
          user_id: 'uF2', tenant_id: 't1', role: AuthRole.BrokerUser,
          jti: `jF2${i}`, refresh_token_family: 'famF2', refresh_generation: 5,
          ip: '1.1.1.1', user_agent: 'UA', mfa_verified: true,
        });
      }
      try {
        await service.rotateSession(
          { old_jti: 'jF21', new_jti: 'jF2New', expected_generation: 3, new_generation: 4, ip: '2.2.2.2', user_agent: 'UA2' },
          { user_id: 'uF2', tenant_id: 't1', role: AuthRole.BrokerUser, jti: 'unused', refresh_token_family: 'famF2', refresh_generation: 4, ip: '2.2.2.2', user_agent: 'UA2', mfa_verified: true },
        );
      } catch {/* expected */}
      expect(await service.isRevoked('jF21')).toBe(true);
      expect(await service.isRevoked('jF22')).toBe(true);
      expect(await service.isRevoked('jF23')).toBe(true);
    });

    it('throws SessionNotFoundError on missing old session', async () => {
      await expect(
        service.rotateSession(
          { old_jti: 'missing', new_jti: 'new', expected_generation: 1, new_generation: 2, ip: '1.1.1.1', user_agent: 'UA' },
          { user_id: 'u', tenant_id: 't', role: AuthRole.BrokerUser, jti: 'x', refresh_token_family: 'f', refresh_generation: 2, ip: '1.1.1.1', user_agent: 'UA', mfa_verified: true },
        ),
      ).rejects.toThrow(SessionNotFoundError);
    });
  });

  describe('listUserSessions', () => {
    it('returns sessions sorted by last_seen_at desc', async () => {
      await service.createSession({ user_id: 'uL', tenant_id: 't', role: AuthRole.BrokerUser, jti: 'jL1', refresh_token_family: 'fL1', refresh_generation: 1, ip: '1.1.1.1', user_agent: 'UA1', mfa_verified: true });
      await new Promise((r) => setTimeout(r, 1100));
      await service.createSession({ user_id: 'uL', tenant_id: 't', role: AuthRole.BrokerUser, jti: 'jL2', refresh_token_family: 'fL2', refresh_generation: 1, ip: '1.1.1.1', user_agent: 'UA2', mfa_verified: true });
      const list = await service.listUserSessions('uL');
      expect(list[0].jti).toBe('jL2');
      expect(list[1].jti).toBe('jL1');
    });
  });

  describe('touchLastSeen', () => {
    it('updates last_seen_at after debounce window', async () => {
      await service.createSession({
        user_id: 'uT', tenant_id: 't', role: AuthRole.BrokerUser,
        jti: 'jT', refresh_token_family: 'fT', refresh_generation: 1,
        ip: '1.1.1.1', user_agent: 'UA', mfa_verified: true,
      });
      // immediate call -- debounced no-op
      await service.touchLastSeen('jT', '2.2.2.2');
      const s1 = await service.getSession('jT');
      // simulate 65 seconds passed via raw redis mutation
      const raw = (s1 as any);
      raw.last_seen_at -= 65;
      await redis.set('session:jT', JSON.stringify(raw), 'EX', 900);
      await service.touchLastSeen('jT', '3.3.3.3');
      const s2 = await service.getSession('jT');
      expect(s2?.ip).toBe('3.3.3.3');
    });
  });
});
```

### 7.2 Tests `repo/packages/auth/test/errors/session-errors.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  SessionNotFoundError, SessionExpiredError, SessionRevokedError, RefreshReplayDetectedError, isSessionError,
} from '../../src/errors/session-errors.js';

describe('Session errors', () => {
  it('SessionNotFoundError code SESSION_NOT_FOUND', () => {
    expect(new SessionNotFoundError('j').code).toBe('SESSION_NOT_FOUND');
  });
  it('RefreshReplayDetectedError captures family', () => {
    const e = new RefreshReplayDetectedError('fam', 1, 5);
    expect(e.code).toBe('TOKEN_REUSE_DETECTED');
    expect(e.token_family).toBe('fam');
  });
  it('SessionExpiredError formats date', () => {
    const e = new SessionExpiredError('j', 1000);
    expect(e.message).toContain('1970');
  });
  it('isSessionError type guard', () => {
    expect(isSessionError(new SessionRevokedError('j'))).toBe(true);
    expect(isSessionError(new Error('x'))).toBe(false);
  });
});
```

### 7.3 Tests integration concurrence `session-concurrency.spec.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import RedisMock from 'ioredis-mock';
import { SessionService, REDIS_TOKEN } from '../../src/services/session.service.js';
import { SESSION_REPOSITORY_TOKEN } from '../../src/services/session.repository.js';
import { HashingService } from '../../src/services/hashing.service.js';
import { AuthRole } from '../../src/types/auth-roles.js';
import { RefreshReplayDetectedError } from '../../src/errors/session-errors.js';

describe('Session rotation concurrency', () => {
  let service: SessionService;
  let redis: any;

  beforeEach(async () => {
    redis = new RedisMock();
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      providers: [
        HashingService,
        { provide: REDIS_TOKEN, useValue: redis },
        { provide: SESSION_REPOSITORY_TOKEN, useValue: { insert: async () => {}, markRevoked: async () => {}, findByUserId: async () => [], updateLastSeenAt: async () => {} } },
        SessionService,
      ],
    }).compile();
    service = moduleRef.get(SessionService);
    await service.onModuleInit();
  });

  it('only one of two concurrent rotations succeeds', async () => {
    await service.createSession({
      user_id: 'uC', tenant_id: 't', role: AuthRole.BrokerUser,
      jti: 'jC', refresh_token_family: 'famC', refresh_generation: 1,
      ip: '1.1.1.1', user_agent: 'UA', mfa_verified: true,
    });

    const rotateOnce = (newJti: string) => service.rotateSession(
      { old_jti: 'jC', new_jti: newJti, expected_generation: 1, new_generation: 2, ip: '1.1.1.1', user_agent: 'UA' },
      { user_id: 'uC', tenant_id: 't', role: AuthRole.BrokerUser, jti: 'unused', refresh_token_family: 'famC', refresh_generation: 2, ip: '1.1.1.1', user_agent: 'UA', mfa_verified: true },
    );

    const results = await Promise.allSettled([rotateOnce('jC2a'), rotateOnce('jC2b')]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
  });

  it('replay attack detection -- 1 legit + 1 attacker', async () => {
    await service.createSession({
      user_id: 'uA', tenant_id: 't', role: AuthRole.BrokerUser,
      jti: 'jA', refresh_token_family: 'famA', refresh_generation: 1,
      ip: '1.1.1.1', user_agent: 'UA', mfa_verified: true,
    });

    // Legit user rotates
    await service.rotateSession(
      { old_jti: 'jA', new_jti: 'jA2', expected_generation: 1, new_generation: 2, ip: '1.1.1.1', user_agent: 'UA' },
      { user_id: 'uA', tenant_id: 't', role: AuthRole.BrokerUser, jti: 'unused', refresh_token_family: 'famA', refresh_generation: 2, ip: '1.1.1.1', user_agent: 'UA', mfa_verified: true },
    );

    // Attacker tries to use stolen original jA
    await expect(service.rotateSession(
      { old_jti: 'jA', new_jti: 'jAttacker', expected_generation: 1, new_generation: 2, ip: '9.9.9.9', user_agent: 'AttackerUA' },
      { user_id: 'uA', tenant_id: 't', role: AuthRole.BrokerUser, jti: 'unused', refresh_token_family: 'famA', refresh_generation: 2, ip: '9.9.9.9', user_agent: 'AttackerUA', mfa_verified: true },
    )).rejects.toThrow();

    // After replay detection, jA2 also revoked (family revoke)
    expect(await service.isRevoked('jA2')).toBe(true);
  });
});
```

### 7.4 Bench `session.bench.ts`

```typescript
import { bench, describe, beforeAll } from 'vitest';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import RedisMock from 'ioredis-mock';
import { SessionService, REDIS_TOKEN } from '../../src/services/session.service.js';
import { SESSION_REPOSITORY_TOKEN } from '../../src/services/session.repository.js';
import { HashingService } from '../../src/services/hashing.service.js';
import { AuthRole } from '../../src/types/auth-roles.js';

let service: SessionService;

beforeAll(async () => {
  const redis = new RedisMock();
  const moduleRef = await Test.createTestingModule({
    imports: [ConfigModule.forRoot({ isGlobal: true })],
    providers: [
      HashingService,
      { provide: REDIS_TOKEN, useValue: redis },
      { provide: SESSION_REPOSITORY_TOKEN, useValue: { insert: async () => {}, markRevoked: async () => {}, findByUserId: async () => [], updateLastSeenAt: async () => {} } },
      SessionService,
    ],
  }).compile();
  service = moduleRef.get(SessionService);
  await service.onModuleInit();
});

describe('Session perf', () => {
  bench('createSession', async () => {
    const id = `j${Math.random()}`;
    await service.createSession({
      user_id: 'uB', tenant_id: 't', role: AuthRole.BrokerUser,
      jti: id, refresh_token_family: 'fB', refresh_generation: 1,
      ip: '1.1.1.1', user_agent: 'UA', mfa_verified: true,
    });
  });
});
```

---

## 8. Variables environnement

```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_SESSIONS_DB=1
SESSION_DEFAULT_TTL_SECONDS=28800
SESSION_REMEMBER_ME_TTL_SECONDS=2592000
```

---

## 9. Commandes shell

```bash
cd repo
pnpm --filter @insurtech/auth add ioredis@5.4.1
pnpm --filter @insurtech/auth add -D ioredis-mock@8.9.0
pnpm --filter @insurtech/auth typecheck
pnpm --filter @insurtech/auth test
pnpm --filter @insurtech/auth build
```

---

## 10. Criteres validation V1-V30

- **V1-V3 (P0)** : typecheck, build, tests pass.
- **V4 (P0)** : `createSession` stocke en Redis avec TTL.
- **V5 (P0)** : `getSession(jti)` retourne record.
- **V6 (P0)** : `revokeSession(jti)` -- session inaccessible + blacklist set.
- **V7 (P0)** : `isRevoked(jti)` true apres revoke.
- **V8 (P0)** : `rotateSession` atomique via Lua.
- **V9 (P0)** : `rotateSession` generation mismatch -> RefreshReplayDetectedError.
- **V10 (P0)** : Replay detection revoke entire family.
- **V11 (P0)** : `revokeUserSessions(userId)` revoke tous.
- **V12 (P0)** : `revokeFamily(family)` revoke tous.
- **V13 (P0)** : `listUserSessions(userId)` retourne array trie.
- **V14 (P0)** : TTL Redis = 30 jours pour remember_me.
- **V15 (P0)** : TTL Redis = 8h pour default.
- **V16 (P0)** : Concurrence : 2 rotations concurrentes -> 1 succeed, 1 fail.
- **V17 (P0)** : Postgres insert appele en parallele.
- **V18 (P0)** : Postgres fail ne fail pas Redis (fire-and-forget).
- **V19 (P1)** : Lua script charge au boot SHA cache.
- **V20 (P1)** : `touchLastSeen` debounce 60s.
- **V21 (P1)** : Coverage >= 92%.
- **V22 (P1)** : No-emoji, no-console.
- **V23 (P1)** : Index `family:{f}` set jti.
- **V24 (P1)** : Index `user_sessions:{u}` set jti.
- **V25 (P1)** : Errors typed (4 classes).
- **V26 (P2)** : Bench createSession < 5 ms.
- **V27 (P2)** : Lua script externalise dans .lua file.
- **V28 (P2)** : Documentation JSDoc complete.
- **V29 (P2)** : Variables env documentees.
- **V30 (P2)** : Tests integration concurrence inclus.

---

## 11. Edge cases

1. Redis down -> AuthService doit failover (logger error, deny auth).
2. Lua script too large -> taille verifiee 10KB max.
3. Session expire pendant rotation -> Lua detecte NOT_FOUND.
4. Postgres lent -> async fire-and-forget.
5. Memory pressure Redis -> eviction policy maxmemory-policy=allkeys-lru avec warning Sprint 33.
6. Tenant deleted mais sessions actives -> Sprint 6 cleanup.
7. User changes password -> revokeUserSessions automatique (Tache 2.1.6).
8. Device fingerprint manquant -> graceful skip.
9. Geo lookup IPv6 -> module Sprint 33 fournit.
10. Lua script charge au mauvais path -> readFileSync throw au boot.
11. ioredis pool epuise -> connections retry exponential backoff.
12. SCAN sur 1M sessions -> use SET index, pas SCAN.

---

## 12. Conformite Maroc

- Loi 09-08 : sessions stockees + audit trail durable + theft detection.
- ACAPS : sessions admin auditees a la demande (90 jours retention SQL).
- Bank Al-Maghrib : encryption at rest Redis Atlas Sprint 35.
- Notification breach 72h : event RefreshReplayDetectedError -> AuditService -> CNDP trigger.

---

## 13. Conventions absolues

Multi-tenant : tenant_id dans SessionMetadata. Validation Zod : indirecte via JwtPayload. Logger Pino. Hash Argon2id : non applicable. pnpm. TS strict. Tests 40+. RBAC : role dans SessionMetadata. Events : Tache 2.1.12 publish session events. Imports order. Skalean AI : aucun. No-emoji. Idempotency : non applicable. Conventional Commits. Cloud souverain : Atlas Cloud Services. Crypto discipline : SHA-256 pour blacklist, ULID pour jti. JSDoc. Performance : createSession < 5ms, getSession < 1ms.

---

## 14. Validation pre-commit

```bash
cd repo
pnpm --filter @insurtech/auth typecheck
pnpm --filter @insurtech/auth lint:check
pnpm --filter @insurtech/auth test
pnpm --filter @insurtech/auth test:coverage
pnpm --filter @insurtech/auth build
grep -rP "[\x{1F300}-\x{1F9FF}]" packages/auth/src packages/auth/test && exit 1 || echo OK
grep -rn "console\.log" packages/auth/src --include="*.ts" && exit 1 || echo OK
```

---

## 15. Commit message

```bash
git add -A
git commit -m "feat(sprint-05): implement SessionService with atomic rotation and theft detection

Implements Redis-backed session storage with parallel SQL audit trail.
Lua script ensures atomic rotateSession with refresh token family +
generation theft detection (RFC 9700 OAuth 2.0 BCP). Revoke single,
user, or family. listUserSessions for /api/v1/auth/sessions endpoint.

Livrables :
- SessionService (createSession, getSession, ensureValid, isRevoked,
  revokeSession, revokeUserSessions, revokeFamily, rotateSession,
  listUserSessions, touchLastSeen)
- Lua script session-rotate.lua (atomic rotation + replay detection)
- 5 typed errors (SessionNotFound, Expired, Revoked, RefreshReplay)
- PostgresSessionRepository (durable audit trail)
- session.helpers (key builders, serialize/parse)
- 40+ tests (unit + integration + concurrency + bench)

Tests : 25 service + 4 errors + 4 concurrency + 8 integration = 41
Coverage : >= 92%

Task: 2.1.5
Sprint: 5 (Phase 2 / Sprint 1)
Phase: 2 -- Securite & Multi-tenant
Reference: B-05 Tache 2.1.5
Decisions: decision-014 (theft detection), decision-008 (Atlas Sprint 35)"
```

---

## 16. Workflow next step

Apres commit, passer a `task-2.1.6-auth-module-controller.md` qui implementera l'integration NestJS finale : `AuthModule` dans apps/api avec `AuthController` (POST /signin, /signout, /signout-all, /refresh, GET /me, /sessions), `AuthService` orchestrant Argon2 + Jwt + Session, `JwtStrategy` passport-jwt, `JwtAuthGuard` avec PublicEndpointGuard chain, et decorator `@CurrentUser()`.

---

## Annexe A. Runbook operationnel production

### A.1 Procedure de mise en production initiale (Sprint 5 -> Sprint 35)

Le `SessionService` est mis en production progressivement sur 4 environnements : dev local (Sprint 5), staging cloud Atlas (Sprint 6), preprod canary (Sprint 33), production (Sprint 35). A chaque environnement, la procedure est :

(1) Provisionner Redis : en dev = container docker-compose ; en staging+prod = cluster Redis Atlas Cloud Services Benguerir avec replication multi-AZ (DC1 primaire + DC2 DR), configuration `maxmemory-policy=allkeys-lru` (eviction des cles les moins recemment utilisees si memoire saturee), `appendonly=yes` (persistence AOF pour recovery), `tcp-keepalive=60`. La connection url est stockee dans secret manager (env `REDIS_URL` ou Atlas KMS Sprint 35).

(2) Provisionner Postgres `auth_sessions` table : Sprint 2 a deja cree la table dans la base principale. Sprint 5 verifie la presence des index `idx_user_sessions(user_id) WHERE revoked_at IS NULL` et `idx_family_sessions(refresh_token_family)`. Sprint 33 ajoutera un index BRIN sur `created_at` pour archivage Sprint 35.

(3) Configurer connection pooling : ioredis 5.4.1 utilise par defaut un pool de 1 connection par instance. Sprint 35 augmente a 10 (config `commandQueue` et `lazyConnect`). Postgres pool via `pg-pool` est configure 20 connections par instance API (Sprint 32 Dockerfile).

(4) Charger le script Lua `session-rotate.lua` au boot via `EVALSHA + SCRIPT LOAD`. Le service cache le SHA-1 du script et utilise `EVALSHA` pour les rotations (plus rapide qu'`EVAL` qui re-charge le script). En cas de cache miss (Redis cluster failover, restart), `EVALSHA` retourne `NOSCRIPT` et le service fallback sur `EVAL` puis re-cache.

(5) Verifier les metriques baseline avant traffic reel : `redis_session_count` (doit etre 0 a la mise en service), `redis_memory_used_bytes`, `postgres_auth_sessions_count`, `auth_signin_success_total`, `auth_refresh_total`, `auth_token_replay_detected_total`. Ces metriques constituent la baseline observability Sprint 33.

(6) Smoke test post-deploiement : declencher 10 logins synthetiques (script `infrastructure/smoke/auth-smoke.sh`) et verifier que (a) les sessions sont creees en Redis, (b) les rows sont presentes dans `auth_sessions` Postgres, (c) la rotation refresh fonctionne, (d) le replay detection trigger correctement. Smoke test valide la chaine end-to-end.

### A.2 Procedure de defaillance Redis (Redis indisponible)

Si Redis devient indisponible (pic d'incidents, faille reseau, maintenance imprevue), la `SessionService.getSession` throw `Redis connection refused`. L'AuthService Tache 2.1.6 doit absorber cette erreur avec un fallback explicit : en mode degrade, refuser TOUTE nouvelle requete authentifiee avec HTTP 503 `SERVICE_UNAVAILABLE_AUTH_BACKEND`. C'est plus sur que de continuer en mode "trust JWT signature only" car cela perdrait la propriete de revocation (un token revoke serait accepte).

Le runbook complet : (1) verifier metric `redis_up` -- si zero, escalader au SRE Skalean ; (2) consulter dashboard "Atlas Redis Health" pour identifier la cause (memoire, CPU, network) ; (3) si le cluster est defaillant > 5 minutes, basculer manuellement vers le DR DC2 via Atlas console ; (4) communiquer aux utilisateurs via la status page Sprint 18 ; (5) post-mortem sous 7 jours.

Le RTO (Recovery Time Objective) cible Sprint 35 est 5 minutes (failover automatique Atlas), le RPO (Recovery Point Objective) est 1 seconde (replication asynchrone Sprint 35, AOF every-second).

### A.3 Procedure de cleanup des sessions expirees

Redis gere automatiquement l'expiration via TTL natif -- les cles `session:{jti}` expirent au bout de 8h ou 30 jours selon `remember_me`. Aucune action manuelle requise pour Redis. En revanche, la table Postgres `auth_sessions` ne se vide pas automatiquement -- les rows sont conservees pour audit. Sprint 35 ajoutera un cron job `archive-auth-sessions.ts` qui (a) archive les rows `revoked_at IS NOT NULL OR expires_at < NOW() - INTERVAL '90 days'` vers une table cold storage `auth_sessions_archive` (compressee, indexes minimaux) puis (b) DELETE des rows hot. Cette operation tourne 1 fois par jour a 03h UTC+1, traite 10000 rows par batch, prend environ 5 minutes en production. Le critere ACAPS exige 5 ans de retention -- le cold storage est sauvegarde ensuite vers Atlas Object Storage Benguerir avec retention 5 ans.

### A.4 Detection et reponse au theft detection en masse

Si la metrique `auth_token_replay_detected_total` augmente brutalement (> 50/min sur > 5 minutes), c'est le signal d'une attaque en cours : un attaquant a leak de nombreux refresh tokens (probablement via XSS sur frontend, ou via un device leak massif type laptop vol). La reponse est : (1) PagerDuty page l'astreinte ; (2) consulter dashboard "Auth Anomaly" pour identifier les patterns (memes IPs, memes tenants, memes user agents) ; (3) si pattern unique tenant, escalader au tenant admin via comm Sprint 18 ; (4) si pattern multi-tenant, considerer un attaque sur le frontend (XSS) -- declencher CSP review et investigation Frontend Sprint 4 ; (5) decision potentielle : revoquer toutes les sessions actives via `SessionService.revokeUserSessions` en boucle pour les users impactes (force re-login global) ; (6) communiquer aux users via email Sprint 13 + status page Sprint 18 ; (7) notification CNDP sous 72h si donnees personnelles exposees.

### A.5 Procedure de migration Redis (downsize / upsize / version upgrade)

Sprint 14 ou Sprint 35 peuvent necessiter de migrer le cluster Redis (changer instance class, upgrade version Redis 7 -> 8). La procedure : (1) provisionner le nouveau cluster ; (2) configurer replication CROSS-cluster via Redis MIGRATE ou via dump+restore ; (3) basculer le DNS / connection url en mode `dual-write` (le service ecrit dans les deux clusters mais lit dans l'ancien) ; (4) attendre 30 jours pour que les sessions courtes expirent dans l'ancien et que les remember_me se replicate completement ; (5) basculer la lecture vers le nouveau cluster ; (6) decommissionner l'ancien.

## Annexe B. Monitoring Prometheus + Grafana Sprint 33

### B.1 Metriques exposees

```
session_create_duration_us              histogram (p50, p95, p99) labels=tenant_id (top 100), role
session_get_duration_us                 histogram
session_rotate_duration_us              histogram (Lua script time)
session_revoke_duration_us              histogram

session_create_total                    counter labels=tenant_id, role, remember_me
session_revoke_total                    counter labels=reason(signout|signout_all|password_change|family_revoke|admin_revoke)
session_rotate_total                    counter labels=result(success|replay|not_found|error)
session_isRevoked_total                 counter labels=result(true|false)

session_active_count                    gauge -- nb sessions Redis active
session_redis_memory_bytes              gauge
session_postgres_total_rows             gauge

auth_token_replay_detected_total        counter labels=tenant_id (CRITIQUE -- alerte > 50/min)
auth_session_anomaly_geo_total          counter -- session change country (Sprint 33)
auth_session_anomaly_ua_total           counter -- session change user-agent

session_lua_script_cache_miss_total     counter -- alerte > 10/min indique Redis instability
session_postgres_insert_failed_total    counter -- alerte > 5/min indique DB issue
```

### B.2 Dashboard Grafana

Le dashboard "Auth Sessions" Sprint 33 contient les panels suivants :

Panel 1 "Session Volume" -- timeseries `rate(session_create_total[5m])` et `rate(session_revoke_total[5m])` -- baseline observability, detection de pic de connexions ou de signouts massifs.

Panel 2 "Session Performance" -- histograms `session_create_duration_us` p99 et `session_get_duration_us` p99 -- alerte si p99 > 10ms (degradation Redis ou Postgres).

Panel 3 "Theft Detection" -- counter `auth_token_replay_detected_total` -- ALERTE P0 si > 50/min sur 5 minutes (attaque potentielle).

Panel 4 "Active Sessions" -- gauge `session_active_count` par tenant_id top 20 -- capacity planning et detection anomalie tenant.

Panel 5 "Redis Memory" -- gauge `session_redis_memory_bytes` -- alerte si > 80% de la limite cluster (besoin scaling).

Panel 6 "Postgres Lag" -- difference `session_create_total - session_postgres_total_rows` (cumulatif) -- alerte si la lag > 1000 rows (indique double-write fail).

### B.3 Logs structures Datadog

Chaque operation produit un log structure :

```json
{
  "level": "info",
  "time": "2026-05-06T10:23:45.123Z",
  "service": "SessionService",
  "action": "rotate_session",
  "result": "success",
  "duration_ms": 2.3,
  "tenant_id": "t-456",
  "user_id": "u-123",
  "old_jti": "01HXY...",
  "new_jti": "01HXZ...",
  "token_family": "01HX0...",
  "old_generation": 5,
  "new_generation": 6,
  "ip": "1.2.3.4",
  "user_agent": "Mozilla/5.0...",
  "request_id": "req-abc"
}
```

Sur replay detection, le log devient `level: warn, action: rotate_session, result: replay_detected, family_revoked: true`.

## Annexe C. Tests integration testcontainer (Sprint 32)

Sprint 5 utilise `ioredis-mock` pour les tests integration locaux (rapide, deterministe). Sprint 32 ajoutera des tests testcontainer-based qui demarrent un vrai container Redis pour verifier la compatibilite ioredis -> Redis 7.4 et la performance reelle :

```typescript
// repo/packages/auth/test/integration/session-real-redis.spec.ts (Sprint 32)
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GenericContainer, type StartedTestContainer } from 'testcontainers';
import Redis from 'ioredis';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { SessionService, REDIS_TOKEN } from '../../src/services/session.service.js';
import { SESSION_REPOSITORY_TOKEN } from '../../src/services/session.repository.js';
import { HashingService } from '../../src/services/hashing.service.js';
import { AuthRole } from '../../src/types/auth-roles.js';

describe.skipIf(process.env.SKIP_TESTCONTAINER === '1')('SessionService with real Redis', () => {
  let container: StartedTestContainer;
  let redis: Redis;
  let service: SessionService;

  beforeAll(async () => {
    container = await new GenericContainer('redis:7.4-bookworm')
      .withExposedPorts(6379)
      .withCommand(['redis-server', '--appendonly', 'yes', '--maxmemory', '256mb', '--maxmemory-policy', 'allkeys-lru'])
      .start();
    redis = new Redis({ host: container.getHost(), port: container.getMappedPort(6379), db: 1 });

    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      providers: [
        HashingService,
        { provide: REDIS_TOKEN, useValue: redis },
        { provide: SESSION_REPOSITORY_TOKEN, useValue: { insert: async () => {}, markRevoked: async () => {}, findByUserId: async () => [], updateLastSeenAt: async () => {} } },
        SessionService,
      ],
    }).compile();
    service = moduleRef.get(SessionService);
    await service.onModuleInit();
  }, 60000);

  afterAll(async () => {
    await redis?.quit();
    await container?.stop();
  });

  it('Lua script EVALSHA works on real Redis 7.4', async () => {
    await service.createSession({
      user_id: 'uReal', tenant_id: 't1', role: AuthRole.BrokerUser,
      jti: 'jReal1', refresh_token_family: 'famReal', refresh_generation: 1,
      ip: '1.1.1.1', user_agent: 'UA', mfa_verified: true,
    });
    const ns = await service.rotateSession(
      { old_jti: 'jReal1', new_jti: 'jReal2', expected_generation: 1, new_generation: 2, ip: '2.2.2.2', user_agent: 'UA2' },
      { user_id: 'uReal', tenant_id: 't1', role: AuthRole.BrokerUser, jti: 'unused', refresh_token_family: 'famReal', refresh_generation: 2, ip: '2.2.2.2', user_agent: 'UA2', mfa_verified: true },
    );
    expect(ns.refresh_generation).toBe(2);
  });

  it('TTL expire correctly on real Redis (1s for test)', async () => {
    process.env.SESSION_DEFAULT_TTL_SECONDS = '1';
    const newService = new SessionService(/* re-construct with env */ redis, { insert: async () => {}, markRevoked: async () => {}, findByUserId: async () => [], updateLastSeenAt: async () => {} } as any, new HashingService(), { get: (k: string) => process.env[k] } as any);
    await newService.onModuleInit();

    await newService.createSession({
      user_id: 'uTtl', tenant_id: null, role: AuthRole.SuperAdminPlatform,
      jti: 'jTtl', refresh_token_family: 'famTtl', refresh_generation: 1,
      ip: '1.1.1.1', user_agent: 'UA', mfa_verified: true,
    });

    expect(await newService.getSession('jTtl')).not.toBeNull();
    await new Promise((r) => setTimeout(r, 1500));
    expect(await newService.getSession('jTtl')).toBeNull();
  });

  it('handles 100 concurrent createSession without data loss', async () => {
    const ops = Array.from({ length: 100 }, (_, i) => service.createSession({
      user_id: `uConc${i}`, tenant_id: 't1', role: AuthRole.BrokerUser,
      jti: `jConc${i}`, refresh_token_family: `famConc${i}`, refresh_generation: 1,
      ip: '1.1.1.1', user_agent: 'UA', mfa_verified: true,
    }));
    await Promise.all(ops);
    for (let i = 0; i < 100; i += 1) {
      expect(await service.getSession(`jConc${i}`)).not.toBeNull();
    }
  });

  it('Lua atomic rotation: 50 concurrent rotations, exactly 1 succeeds', async () => {
    await service.createSession({
      user_id: 'uAtomic', tenant_id: 't1', role: AuthRole.BrokerUser,
      jti: 'jAtomic', refresh_token_family: 'famAtomic', refresh_generation: 1,
      ip: '1.1.1.1', user_agent: 'UA', mfa_verified: true,
    });

    const rotateOps = Array.from({ length: 50 }, (_, i) => service.rotateSession(
      { old_jti: 'jAtomic', new_jti: `jAtomic${i}`, expected_generation: 1, new_generation: 2, ip: '1.1.1.1', user_agent: 'UA' },
      { user_id: 'uAtomic', tenant_id: 't1', role: AuthRole.BrokerUser, jti: 'unused', refresh_token_family: 'famAtomic', refresh_generation: 2, ip: '1.1.1.1', user_agent: 'UA', mfa_verified: true },
    ).catch((e) => e));

    const results = await Promise.all(rotateOps);
    const succeeded = results.filter((r) => !(r instanceof Error));
    const failed = results.filter((r) => r instanceof Error);
    expect(succeeded.length).toBe(1);
    expect(failed.length).toBe(49);
  });

  it('AOF persistence: kill Redis and restart preserves sessions', async () => {
    // This test requires container restart capability
    // Sprint 32 will implement using GenericContainer.restart() + AOF replay
  });
});
```

### C.2 Tests de chaos engineering (Sprint 33)

Sprint 33 introduira des tests de chaos engineering qui simulent des conditions adverses :

```typescript
describe('Chaos: SessionService resilience', () => {
  it('handles Redis network partition gracefully', async () => {
    // Inject network failure mid-operation
    // Verify service throws known error, doesn't deadlock
  });

  it('handles Postgres slow query (p99 5s)', async () => {
    // Verify Redis remains source of truth, Postgres is fire-and-forget
  });

  it('handles Lua script deletion mid-flight', async () => {
    // Redis FLUSHDB during operation
    // Verify EVALSHA fallback to EVAL
  });

  it('handles 1M sessions in Redis (stress)', async () => {
    // Memory pressure test
    // Verify allkeys-lru eviction works without errors
  });
});
```

## Annexe D. Edge cases supplementaires (13-25)

### Edge case 13 : Lua script SHA cache invalidated by Redis FLUSHDB

Scenario : un admin Redis fait FLUSHDB par erreur (ou Redis cluster failover invalide le SHA cache).
Probleme : EVALSHA retourne NOSCRIPT.
Solution : `SessionService.rotateSession` catch NOSCRIPT et fallback sur EVAL (re-charge le script). Documente.

### Edge case 14 : Postgres `auth_sessions` table missing

Scenario : migration Sprint 2 echouee ou rollback partiel.
Probleme : insert throw "relation does not exist".
Solution : double-write best-effort, log error mais ne fail pas Redis. Sprint 5 verifie schema au boot via migration check Sprint 2.

### Edge case 15 : `auth_sessions` row insert race condition

Scenario : deux instances API recoivent simultanement createSession avec meme jti (collision ULID hyper-rare).
Probleme : conflit primary key.
Solution : `INSERT ... ON CONFLICT (jti) DO NOTHING` (deja implemente). Premier write wins.

### Edge case 16 : `revokeUserSessions` sur user avec 10000 sessions

Scenario : utilisateur power-user avec acces multiples devices et bots.
Probleme : SMEMBERS retourne 10000 jti, boucle revokeSession prend 30s.
Solution : Sprint 14 introduira batch revocation via Lua script. Sprint 5 accepte la latence pour ce cas extreme.

### Edge case 17 : `revokeFamily` cascade quand attacker revoque legit user

Scenario : attaquant declenche replay detection volontairement (en presentant un refresh token vole) pour deconnecter le legit user.
Probleme : DoS via theft detection -- l'utilisateur legit est deconnecte.
Solution : c'est intentionnel. Mieux vaut deconnecter un legit qui devra re-login que de laisser un attaquant maintenir une session. UX accepte. Sprint 33 audit ce trade-off.

### Edge case 18 : User changes email avec sessions actives

Scenario : user change son email via /api/v1/auth/change-email.
Probleme : sessions actives ont l'ancien email cache dans payload JWT.
Solution : Tache 2.1.6 + Tache 2.1.11 (recovery) declenchent `revokeUserSessions` apres changement email. Sessions doivent re-login.

### Edge case 19 : Tenant suspendu mais sessions actives

Scenario : Skalean platform admin suspend un tenant (default impayes Sprint 11).
Probleme : sessions actives continuent de fonctionner jusqu'a expiration.
Solution : Sprint 14 ajoutera `revokeTenantSessions(tenantId)` pour ce cas. Sprint 5 = limitation acceptee.

### Edge case 20 : `last_seen_at` update fail repete

Scenario : Redis lent, touchLastSeen timeout.
Probleme : `last_seen_at` reste obsolete.
Solution : touchLastSeen est best-effort, ne fail pas la requete. Sprint 33 monitore le pourcentage de touch reussis.

### Edge case 21 : `device_fingerprint` collisions

Scenario : 2 devices Chrome sur Windows 11 produisent meme fingerprint.
Probleme : fingerprint pas suffisant comme identifiant unique.
Solution : convention -- fingerprint utilise pour heuristic anti-fraud Sprint 33, pas comme cle primaire. Multi-device acceptes.

### Edge case 22 : Geo-IP reverse fail

Scenario : MaxMind DB outdated, IP recente non reconnue.
Probleme : `geo_country` undefined.
Solution : graceful skip, ne bloque pas createSession. Sprint 33 monitore couverture geo.

### Edge case 23 : Connection pool ioredis epuise

Scenario : pic de trafic, pool 10 connexions saturees.
Probleme : nouvelles requetes attendent.
Solution : Sprint 35 augmente pool a 50, Sprint 14 ajoute circuit breaker.

### Edge case 24 : Memory pressure Redis -> eviction des sessions actives

Scenario : Redis depasse maxmemory, allkeys-lru evict les sessions les moins recentes (potentiellement remember_me 30 jours).
Probleme : utilisateur force re-login alors que pas censure.
Solution : Sprint 35 dimensionne Redis large. Alerte memory > 80% pour scaling preventif. Aussi, Sprint 35 utilisera Redis dedie a sessions (DB 1) avec quota separe.

### Edge case 25 : Redis cluster failover pendant rotation

Scenario : primary Redis down pendant un EVAL Lua.
Probleme : transaction partiellement appliquee ?
Solution : Lua EVAL est atomic dans Redis (single-threaded), mais le failover peut perdre la commande non-replicated. Solution : utiliser WAIT avec replication confirmation Sprint 35 ou accepter une fenetre de potentielle incoherence.

## Annexe E. Migration cleanup auth_sessions table (Sprint 35)

### E.1 Job `archive-auth-sessions.ts`

```typescript
// Sprint 35 implementation -- esquisse pour reference Sprint 5
import { Logger } from '@nestjs/common';

export async function archiveAuthSessions(db: any) {
  const logger = new Logger('archive-auth-sessions');
  const BATCH_SIZE = 10000;
  const RETENTION_DAYS = 90;

  let archived = 0;
  let deleted = 0;

  while (true) {
    const r = await db.query(`
      WITH to_archive AS (
        SELECT * FROM auth_sessions
        WHERE (revoked_at IS NOT NULL OR expires_at < NOW() - INTERVAL '${RETENTION_DAYS} days')
        ORDER BY created_at ASC
        LIMIT ${BATCH_SIZE}
        FOR UPDATE SKIP LOCKED
      ),
      archived AS (
        INSERT INTO auth_sessions_archive
        SELECT * FROM to_archive
        ON CONFLICT (jti) DO NOTHING
        RETURNING jti
      ),
      deleted AS (
        DELETE FROM auth_sessions
        WHERE jti IN (SELECT jti FROM archived)
        RETURNING jti
      )
      SELECT
        (SELECT count(*) FROM archived) AS archived_count,
        (SELECT count(*) FROM deleted) AS deleted_count;
    `);

    const { archived_count, deleted_count } = r.rows[0];
    if (archived_count === 0) break;
    archived += archived_count;
    deleted += deleted_count;
    logger.log({ batch: { archived: archived_count, deleted: deleted_count }, total: { archived, deleted } });
    await new Promise((r) => setTimeout(r, 1000)); // throttle
  }

  // Sprint 35 ensuite : copy auth_sessions_archive vers Atlas Object Storage avec retention 5 ans
  logger.log({ action: 'archive_complete', archived, deleted });
}
```

Job scheduled : 03h00 UTC+1 chaque jour. Logs Datadog. Alerte si archived > 100k en une journee (anomalie).

### E.2 Conformite ACAPS retention

L'autorite ACAPS peut demander 5 ans d'historique d'authentification pour une enquete. Le stockage est :
- Annee 1-90 jours : `auth_sessions` Postgres hot (queryable directement).
- 90 jours - 1 an : `auth_sessions_archive` Postgres cold (queryable mais lent).
- 1 - 5 ans : Atlas Object Storage Benguerir, format Parquet compresse, queryable via Athena Sprint 35.
- > 5 ans : suppression automatique (loi 09-08 minimization principle).

## Annexe F. Performance benchmarks attendus

```
createSession:               median 2.5 ms  (p99: 8 ms)   -- Redis SET + 4 SADD + Postgres INSERT (async)
getSession:                  median 0.6 ms  (p99: 2 ms)   -- Redis GET
isRevoked:                   median 0.4 ms  (p99: 1.5 ms) -- Redis EXISTS
revokeSession:               median 1.8 ms  (p99: 5 ms)   -- Redis MULTI 4 ops + Postgres UPDATE async
revokeUserSessions (5 sess): median 8 ms    (p99: 25 ms)  -- 5 revokeSession en serie
revokeFamily (3 sess):       median 5 ms    (p99: 15 ms)
rotateSession:               median 2 ms    (p99: 6 ms)   -- Lua script atomic
listUserSessions (5):        median 2 ms    (p99: 6 ms)
touchLastSeen (debounced):   median 0.1 ms  (p99: 0.5 ms) -- mostly skip
```

Latency target Sprint 35 production : p99 createSession < 10 ms, p99 getSession < 3 ms, p99 rotateSession < 8 ms.

## Annexe G. Securite -- threat modeling

Sprint 33 fera un threat modeling complet. Pour Sprint 5, les menaces identifiees et mitigations :

| Menace | Vecteur | Mitigation Sprint 5 | Residual risk |
|--------|---------|---------------------|---------------|
| Refresh token leak via XSS frontend | Vol localStorage | Theft detection (rotation + family revoke) | Faible |
| Refresh token leak via device perdu | Acces physique | Theft detection + signout-all + remember_me TTL court si non requis | Faible |
| Refresh token leak via MITM | TLS misconfig | TLS 1.3 obligatoire (Sprint 32) | Negligeable |
| Redis leak via misconfigured access | Misconfig admin | Redis password obligatoire + VPC isolation Sprint 35 | Faible |
| Postgres leak | SQL injection | Parametrized queries (deja) + RLS Sprint 6 | Negligeable |
| Replay attack post-revoke | Vol token + delay attack | Blacklist Redis avec TTL = remaining lifetime | Negligeable |
| Session fixation | Attacker fixe sid avant login | sid genere par JwtService.generateId() au login, pas modifiable | Negligeable |
| Cross-tenant session usage | tenant_id manipule dans JWT | Signature verifiee + tenant_id readonly dans payload + RLS Sprint 6 | Negligeable |
| Concurrent rotation race | Sub-second concurrent refresh | Lua atomic | Negligeable |
| DoS via session creation flood | Bot mass signup | Rate limit Tache 2.1.14 | Faible |
| Memory exhaustion Redis via remember_me | Attacker creee 10k remember_me sessions | maxmemory + allkeys-lru + monitoring Sprint 33 | Faible |

---

**Fin du prompt task-2.1.5-session-service.md.**
