# TACHE 2.1.10 -- LockoutService : Anti Brute Force Progressif (5 -> 15 -> 60 min) + IP Tracking + Backoff Exponentiel

**Sprint** : 5 (Phase 2 / Sprint 1 dans phase) -- Auth Foundations
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-05-sprint-05-auth-foundations.md` (Tache 2.1.10)
**Phase** : 2 -- Securite & Multi-tenant
**Priorite** : P0 (bloquant pour 2.1.12 audit, 2.1.13 email lockout notification, 2.1.15 E2E)
**Effort** : 4h
**Dependances** : 2.1.9 (signup termine), 2.1.6 (AuthService.signin integration), 2.1.5 (Redis DB 2 LOCKOUTS), 2.1.1 (constants LOCKOUT_TIERS), Sprint 2 (auth_users.failed_login_attempts + locked_until)
**Densite cible** : 80-150 ko (auto-suffisant exhaustif)
**AUCUNE EMOJI AUTORISEE**

---

## 1. But

Cette tache vise a livrer le service `LockoutService` qui constitue la defense de premier rang du programme Skalean InsurTech v2.2 contre les attaques par force brute en ligne (online brute force) sur les credentials utilisateurs. Le perimetre couvre : un service NestJS `@Injectable() LockoutService` qui expose les operations principales `recordFailedAttempt(userId, ip, email)` appelee par `AuthService.signin` (Tache 2.1.6) a chaque echec d'authentification (mauvais password, mauvais TOTP, mauvais recovery code), `recordSuccess(userId, ip)` qui reset les compteurs de tentatives et leve l'eventuel lockout pour ce user, `isLocked(userId)` qui retourne le snapshot lockout courant (locked: boolean, locked_until?: Date, current_tier?: 1|2|3|4, failed_attempts: number) consume par AuthService.signin avant meme la verification password (defense en profondeur : pas de calcul Argon2 inutile sur compte locked), `getIpLockoutStatus(ip)` qui retourne le statut lockout par IP cross-users (50 fails sur 15 min depuis meme IP -> bloquer toutes tentatives signin depuis cette IP pour 1 heure -- defense contre brute force distributed sur multiple users), et `clearLockout(userId, by)` reserved aux admins Sprint 27 qui permet le unlock manuel. La strategie de progression est conforme aux recommandations OWASP Authentication Cheat Sheet 2024 et NIST SP 800-63B section 5.2.2 : Tier 1 = 5 tentatives echouees en 15 minutes -> lock 5 minutes ; Tier 2 = 5 tentatives echouees apres deverouillage Tier 1 -> lock 15 minutes (backoff exponentiel) ; Tier 3 = 5 tentatives echouees apres deverouillage Tier 2 -> lock 1 heure ; Tier 4 = 5 tentatives echouees apres Tier 3 -> lock permanent jusqu'a unlock admin. La fenetre de comptage est sliding (les tentatives anciennes sortent du compte automatiquement apres 15 minutes via TTL Redis), et un succes complet de signin reset entierement le compteur a 0 pour permettre les utilisateurs legitimes qui se trompent occasionnellement.

L'apport est triple. Premierement, en bloquant temporairement les comptes apres 5 tentatives echouees, on transforme une attaque brute force en ligne sur l'espace 12 chars complexe (~10^21 combinaisons) en une attaque insolvable temporellement : meme avec une vitesse de 5 tentatives par 15 min Tier 1, parcourir 1 milliard de combinaisons demande 5.7 millions d'heures ; les Tiers 2-4 augmentent encore la friction. Deuxiemement, en ajoutant le tracking par IP (50 fails / 15 min cross-users), on defend contre l'attaque "credential stuffing distributed" ou un attaquant rejoue les credentials leakes sur des sites tiers en testant des centaines d'emails differents depuis la meme IP : sans IP tracking, chaque user serait tracked individuellement et permettrait au moins 5 tentatives par user, soit potentiellement des milliers de tentatives reussies depuis une IP malveillante. Avec IP tracking, l'attaquant est bloque apres 50 tentatives totales -- friction massive. Troisiemement, en publiant systematiquement des events Kafka `auth.account_locked` sur Tier 2+ (Tier 1 trop frequent serait bruit), on alimente le SIEM Sprint 33 qui correle les patterns inter-tenants pour detecter les campagnes coordonnees.

A l'issue de cette tache, l'API `LockoutService.recordFailedAttempt(user_id, ip, email)` retourne `{ locked: false, attempts_remaining: 4, current_tier: 0 }` apres la 1ere tentative ratee, `{ locked: true, locked_until: ..., current_tier: 1, attempts_remaining: 0 }` apres la 5eme dans la fenetre, `{ locked: true, locked_until: ..., current_tier: 2 }` apres echecs Tier 2 ; `LockoutService.isLocked(user_id)` retourne `{ locked: true, locked_until: '2026-05-06T11:00:00Z', current_tier: 1, retry_after_seconds: 234 }` ; `LockoutService.recordSuccess(user_id, ip)` ramene les compteurs a 0 et clear le lockout ; `LockoutService.getIpLockoutStatus(ip)` retourne le statut IP. Les colonnes Postgres `auth_users.failed_login_attempts` et `auth_users.locked_until` sont mises a jour en parallele Redis (double-write best-effort, Redis source de verite). La suite Vitest couvre 25+ tests + integration tests cross-services.

---

## 2. Contexte etendu

### 2.1 Pourquoi cette tache existe

Sans defense anti-brute-force, le programme est vulnerable a une attaque triviale : un attaquant qui connait un email valide (extrait de leak public ou via signup tester Tache 2.1.9 mais defendu par anti-enum) peut tester massivement des passwords. Avec Argon2id qui prend 250 ms par hash, un attaquant peut tester 4 passwords/seconde sur un account = ~14 millions de tentatives par jour = essai de tout l'espace 8-chars complexe en quelques jours. Lockout transforme cette attaque en irrealisable.

L'attaque distributee (credential stuffing) est encore plus problematique : un attaquant possede une liste de 1M emails+passwords leakes (Have I Been Pwned, datasets darknet 2024-2026) et tente le signin sur Skalean. Statistiquement, 1-3% reussissent (users qui reutilisent passwords cross-sites). Sans rate limiting par IP, l'attaque est massive et ne touche pas le lockout user (chaque user a 5 fresh attempts). Avec IP tracking 50 fails / 15 min, l'attaquant est ralenti drastiquement.

Le pattern progression Tier 1->4 est conforme OWASP : la premiere fois qu'un user fait 5 erreurs, il est probablement legitime (oublie clavier, password autocomplete, etc.) -- 5 min lockout. Si recidive immediate apres deverouillage (Tier 2), suspicion plus forte -- 15 min. Tier 3 = 1 heure. Tier 4 = permanent (intervention admin requise pour debloquer).

### 2.2 Alternatives considerees

| Alternative | Avantages | Inconvenients | Decision |
|-------------|-----------|---------------|----------|
| Lockout fixe 30 min apres 5 fails | Simple | Pas de progression, attaquant patient peut continuer apres 30 min | REJETE |
| Lockout exponentiel par-tier (RETENU) | Progression OWASP | Plus complexe | RETENU |
| Captcha apres 3 fails | Anti-bot effectif | Necessite UX captcha, accessibilite a11y, cost | DEFFERE Sprint 14+ |
| Lockout permanent apres 5 fails | Securite maximum | Casse UX legitime users | REJETE |
| Pas de lockout (juste rate limit IP) | UX fluide | Pas de protection per-user | REJETE |
| Lockout user-only (pas IP) | Simple | Vulnerable distributed attacks | REJETE |
| Lockout user + IP (RETENU) | Defense profondeur | Complexity Redis 2 niveaux | RETENU |
| Notification email a chaque fail | Transparency max | Spam emails legitimate users | REJETE |
| Notification email apres lockout (RETENU) | Equilibre | -- | RETENU |
| Postgres uniquement (pas Redis) | Persistance forte | DB lookup chaque signin = latency | REJETE |
| Redis uniquement | Performance | Perte donnees au restart | REJETE |
| Redis + Postgres mirror (RETENU) | Performance + persistance | Double write | RETENU |

### 2.3 Trade-offs

Choisir 5 tentatives Tier 1 implique d'accepter qu'un user qui se trompe de password 5 fois (potentiellement legitime apres update password sur autre site) est lock 5 min. UX un peu inconfortable mais necessaire. Sprint 18 ajoutera lien "Forgot password" plus visible.

Choisir lock permanent au Tier 4 implique d'accepter cas extreme ou un user legitime cumulerait 20+ erreurs successives. En pratique, ce cas suppose attaque ; legitimes ne depassent pas Tier 1.

Choisir IP tracking 50 fails / 15 min implique de risquer false positives dans bureaux entreprise (NAT, plusieurs users meme IP). Mitigation : 50 est genereux (vs 10) et limite a 1 heure (recoverable). Sprint 14 considera whitelist IP entreprise.

### 2.4 Decisions strategiques

- decision-006 (No-emoji), decision-008 (Atlas Cloud).
- OWASP Authentication Cheat Sheet 2024 -- progression tiers.
- NIST SP 800-63B section 5.2.2 -- rate limiting auth.
- ACAPS -- defense brute force pour operateurs.

### 2.5 Pieges techniques

1. **Lockout pas applique sur compte verifie** : Tache 2.1.6 verifie `isLocked` AVANT verify password.
2. **Counter race 2 fails simultanes** : Redis INCR atomic.
3. **Lockout cleared apres reset password** : Tache 2.1.11 clearLockout.
4. **Time skew Redis vs Postgres** : timestamps en Unix seconds depuis Tache 2.1.1 helpers.
5. **TTL Redis expire pendant lock** : Postgres locked_until source de verite.
6. **IP tracking avec NAT bureau** : false positive possible.
7. **Counter not reset si login partiel (mfa challenge)** : reset uniquement signin complet.
8. **Lockout admin endpoint reserve super_admin** : Sprint 27 RBAC.
9. **Email notification lockout boucle infinie** : queue Tache 2.1.13.
10. **Counter overflow apres 5 lockouts (Tier 4)** : tier capped a 4.
11. **Redis down -> fail open ou fail closed** : choix Sprint 5 = fail closed (refuse signin si Redis down).
12. **Concurrent recordFailedAttempt et clearLockout** : Lua atomic.

---

## 3. Architecture context

### 3.1 Position dans le sprint

Tache 2.1.10 livre le service consomme par : 2.1.6 (AuthService.signin appelle isLocked + recordFailedAttempt + recordSuccess), 2.1.11 (Recovery clearLockout apres reset password), 2.1.12 (Audit log lockout events), 2.1.13 (Email lockout notification), 2.1.15 (E2E).

### 3.2 Position dans le programme

- Sprint 14 : captcha integration apres 3 fails.
- Sprint 27 : admin endpoint /admin/users/:id/unlock.
- Sprint 33 : SIEM correlation across tenants.

### 3.3 Diagramme

```
+-----------------------------------+
| Tache 2.1.9 termine                |
+-----------------+------------------+
                  |
                  v
+-----------------------------------+
| TACHE 2.1.10 (cette tache)         |
| LockoutService                    |
| - recordFailedAttempt(userId,ip)  |
| - recordSuccess(userId,ip)        |
| - isLocked(userId)                |
| - getIpLockoutStatus(ip)          |
| - clearLockout(userId,by)         |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+--+-+-+
  |  |  |  |  |  |  |  |  |  |
  v  v  v  v  v  v  v  v  v  v
2.1.6/2.1.11/2.1.12/2.1.13/Sprint 27
```

---

## 4. Livrables checkables (24)

- [ ] Service `repo/packages/auth/src/services/lockout.service.ts` -- ~300 lignes
- [ ] Helper `repo/packages/auth/src/services/lockout.helpers.ts` -- ~80 lignes
- [ ] Errors `repo/packages/auth/src/errors/lockout-errors.ts` -- ~60 lignes
- [ ] Mise a jour `auth.module.ts` -- modification
- [ ] Mise a jour `index.ts` -- exports
- [ ] Mise a jour `auth.service.ts` (Tache 2.1.6) -- integration in signin -- modification
- [ ] Migration verify auth_users columns failed_login_attempts + locked_until
- [ ] Tests `lockout.service.spec.ts` -- 25+ tests -- ~450 lignes
- [ ] Tests `lockout.helpers.spec.ts` -- 6 tests -- ~80 lignes
- [ ] Tests integration `lockout.integration.spec.ts` -- 5 tests -- ~150 lignes
- [ ] Bench -- ~50 lignes
- [ ] No-emoji
- [ ] No-console
- [ ] Coverage >= 92%
- [ ] Documentation JSDoc complete
- [ ] Build TypeScript reussit
- [ ] Tier progression 1->4 conforme constants Tache 2.1.1
- [ ] Counter reset sur succes
- [ ] IP tracking 50/15min cross-users
- [ ] Backoff exponentiel verifie
- [ ] Lock permanent Tier 4 sans intervention admin
- [ ] Logs structures avec tenant_id si dispo
- [ ] Lua atomic pour recordFailedAttempt
- [ ] Postgres double-write best-effort

---

## 5. Fichiers crees / modifies

```
repo/packages/auth/src/services/lockout.service.ts                    (~300 lignes)
repo/packages/auth/src/services/lockout.helpers.ts                    (~80 lignes)
repo/packages/auth/src/errors/lockout-errors.ts                        (~60 lignes)
repo/packages/auth/src/services/lockout-record.lua                     (~25 lignes)
repo/packages/auth/src/auth.module.ts                                  (modifie)
repo/packages/auth/src/index.ts                                        (modifie)
repo/apps/api/src/modules/auth/auth.service.ts                          (modifie / integration)
repo/packages/auth/test/services/lockout.service.spec.ts                (~450 lignes)
repo/packages/auth/test/services/lockout.helpers.spec.ts                (~80 lignes)
repo/packages/auth/test/integration/lockout.integration.spec.ts         (~150 lignes)
repo/packages/auth/test/bench/lockout.bench.ts                          (~50 lignes)
```

---

## 6. Code patterns COMPLETS

### 6.1 `lockout-errors.ts`

```typescript
export class LockoutError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(message: string, code: string, status = 401) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.status = status;
  }
}

export class AccountLockedError extends LockoutError {
  readonly locked_until: number;
  readonly current_tier: number;
  readonly retry_after_seconds: number;
  constructor(lockedUntil: number, tier: number) {
    const now = Math.floor(Date.now() / 1000);
    const retryAfter = Math.max(lockedUntil - now, 0);
    super(`Account locked. Try again in ${retryAfter}s`, 'ACCOUNT_LOCKED', 401);
    this.locked_until = lockedUntil;
    this.current_tier = tier;
    this.retry_after_seconds = retryAfter;
  }
}

export class IpLockedError extends LockoutError {
  readonly retry_after_seconds: number;
  constructor(retryAfter: number) {
    super(`Too many failed attempts from your IP`, 'IP_LOCKED', 401);
    this.retry_after_seconds = retryAfter;
  }
}

export class AccountPermanentlyLockedError extends LockoutError {
  constructor() {
    super('Account permanently locked. Contact support.', 'ACCOUNT_PERMANENT_LOCK', 401);
  }
}
```

### 6.2 `lockout.helpers.ts`

```typescript
import { LOCKOUT_TIERS } from '../constants/lockout-tiers.js';
import type { LockoutTier } from '../types/lockout.js';

export interface LockoutStateUpdate {
  failed_attempts: number;
  current_tier: LockoutTier | 0;
  locked: boolean;
  locked_until: number | null;
}

/**
 * Computes next tier based on current attempts and prior tier.
 */
export function computeNextTier(currentAttempts: number, currentTier: LockoutTier | 0, maxFailedPerTier = 5): LockoutTier | 0 {
  if (currentAttempts < maxFailedPerTier) return currentTier;
  if (currentTier === 0) return 1;
  if (currentTier === 1) return 2;
  if (currentTier === 2) return 3;
  if (currentTier === 3) return 4;
  return 4; // capped
}

export function lockedUntilForTier(tier: LockoutTier, nowSeconds: number): number {
  const minutes = tier === 1 ? 5 : tier === 2 ? 15 : tier === 3 ? 60 : 0; // tier 4 = permanent
  if (tier === 4) return Number.MAX_SAFE_INTEGER;
  return nowSeconds + minutes * 60;
}

export function buildUserLockoutKey(userId: string): string {
  return `lockout:user:${userId}`;
}

export function buildIpLockoutKey(ip: string): string {
  return `lockout:ip:${ip}`;
}
```

### 6.3 `lockout-record.lua`

```lua
-- KEYS[1] = lockout:user:{userId}
-- KEYS[2] = lockout:ip:{ip}
-- ARGV[1] = max_attempts_per_tier (5)
-- ARGV[2] = ip_max_fails (50)
-- ARGV[3] = ip_window_seconds (900)
-- ARGV[4] = now_seconds
-- ARGV[5] = ip_lock_duration_seconds (3600)

local userKey = KEYS[1]
local ipKey = KEYS[2]
local maxPerTier = tonumber(ARGV[1])
local ipMax = tonumber(ARGV[2])
local now = tonumber(ARGV[4])

-- Increment user attempts
local userAttempts = redis.call('HINCRBY', userKey, 'failed_attempts', 1)
redis.call('HSET', userKey, 'last_attempt_at', now)
redis.call('EXPIRE', userKey, 86400 * 7) -- 7 days

-- Get current tier
local currentTier = tonumber(redis.call('HGET', userKey, 'current_tier') or '0')

-- Increment IP fails
local ipFails = redis.call('INCR', ipKey)
if ipFails == 1 then
  redis.call('EXPIRE', ipKey, tonumber(ARGV[3]))
end

local ipLocked = ipFails >= ipMax
if ipLocked then
  redis.call('SET', ipKey .. ':locked', '1', 'EX', tonumber(ARGV[5]))
end

return {userAttempts, currentTier, ipFails, ipLocked and 1 or 0}
```

### 6.4 `lockout.service.ts`

```typescript
/**
 * @insurtech/auth/services/lockout
 *
 * Anti-brute-force protection with progressive lockout (Tier 1->4) and IP tracking.
 *
 * Reference :
 *   - OWASP Authentication Cheat Sheet 2024
 *   - NIST SP 800-63B section 5.2.2
 *   - ACAPS circulaire 2024 (defense brute force)
 *   - decision-006 (No-emoji)
 */

import { Injectable, Logger, OnModuleInit, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Redis } from 'ioredis';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REDIS_TOKEN } from './session.service.js';
import {
  buildUserLockoutKey, buildIpLockoutKey, computeNextTier, lockedUntilForTier,
} from './lockout.helpers.js';
import { AccountLockedError, IpLockedError, AccountPermanentlyLockedError } from '../errors/lockout-errors.js';
import { nowInSeconds } from '../types/jwt-payload.js';
import type { LockoutTier, LockoutSnapshot, LockoutDecision } from '../types/lockout.js';
import type { UserRepository } from '../../../apps/api/src/modules/user/user.repository.js';

export const USER_REPOSITORY_TOKEN_LOCKOUT = Symbol('USER_REPOSITORY_TOKEN_LOCKOUT');

interface UserRepoLite {
  findById(id: string): Promise<{ id: string; failed_login_attempts?: number; locked_until?: Date | null } | null>;
  update(id: string, patch: { failed_login_attempts?: number; locked_until?: Date | null }): Promise<void>;
}

@Injectable()
export class LockoutService implements OnModuleInit {
  private readonly logger = new Logger(LockoutService.name);
  private readonly maxAttemptsPerTier: number;
  private readonly ipMaxFails: number;
  private readonly ipWindowSeconds: number;
  private readonly ipLockDurationSeconds: number;
  private readonly recordScript: string;
  private recordScriptSha: string | null = null;

  constructor(
    @Inject(REDIS_TOKEN) private readonly redis: Redis,
    @Inject(USER_REPOSITORY_TOKEN_LOCKOUT) private readonly userRepo: UserRepoLite,
    private readonly config: ConfigService,
  ) {
    this.maxAttemptsPerTier = Number.parseInt(this.config.get<string>('LOCKOUT_FAILED_ATTEMPTS_PER_TIER') ?? '5', 10);
    this.ipMaxFails = Number.parseInt(this.config.get<string>('LOCKOUT_IP_MAX_FAILS') ?? '50', 10);
    this.ipWindowSeconds = Number.parseInt(this.config.get<string>('LOCKOUT_IP_WINDOW_SECONDS') ?? '900', 10);
    this.ipLockDurationSeconds = Number.parseInt(this.config.get<string>('LOCKOUT_IP_LOCK_DURATION_SECONDS') ?? '3600', 10);
    const here = dirname(fileURLToPath(import.meta.url));
    this.recordScript = readFileSync(join(here, 'lockout-record.lua'), 'utf-8');
  }

  async onModuleInit(): Promise<void> {
    this.recordScriptSha = (await this.redis.script('LOAD', this.recordScript)) as string;
    this.logger.log({
      action: 'lockout_service_init',
      max_attempts_per_tier: this.maxAttemptsPerTier,
      ip_max_fails: this.ipMaxFails,
      ip_window_seconds: this.ipWindowSeconds,
    });
  }

  /**
   * Records a failed login attempt for a user + IP.
   * Returns the resulting lockout state.
   */
  async recordFailedAttempt(input: { user_id: string; ip: string; email: string }): Promise<LockoutDecision> {
    const now = nowInSeconds();
    const result = await this.redis.eval(
      this.recordScript,
      2,
      buildUserLockoutKey(input.user_id),
      buildIpLockoutKey(input.ip),
      String(this.maxAttemptsPerTier),
      String(this.ipMaxFails),
      String(this.ipWindowSeconds),
      String(now),
      String(this.ipLockDurationSeconds),
    ) as [number, number, number, number];

    const [userAttempts, currentTierRaw, ipFails, ipLocked] = result;
    const currentTier = currentTierRaw as LockoutTier | 0;
    const nextTier = computeNextTier(userAttempts, currentTier, this.maxAttemptsPerTier);

    let lockedUntil: number | null = null;
    if (nextTier !== currentTier && nextTier > 0) {
      lockedUntil = lockedUntilForTier(nextTier as LockoutTier, now);
      // Update user record in Redis
      await this.redis.hset(buildUserLockoutKey(input.user_id), {
        failed_attempts: 0, // reset for next tier
        current_tier: nextTier,
        locked_until: lockedUntil,
      });
      // Mirror to Postgres (fire-and-forget)
      const lockedUntilDate = nextTier === 4 ? new Date('9999-12-31') : new Date(lockedUntil * 1000);
      this.userRepo.update(input.user_id, {
        failed_login_attempts: 0,
        locked_until: lockedUntilDate,
      }).catch((err) => {
        this.logger.warn({ err: err instanceof Error ? err.message : err, user_id: input.user_id }, 'Postgres update failed_login_attempts failed');
      });

      this.logger.warn({
        action: 'account_locked',
        user_id: input.user_id,
        ip: input.ip,
        email: input.email,
        tier: nextTier,
        locked_until: lockedUntil,
      });

      // Tache 2.1.12 audit + Tache 2.1.13 email notification (if tier >= 2)

      return {
        allow: false,
        reason: 'tier_up',
        retry_after_seconds: lockedUntil - now,
      };
    }

    // Mirror attempts count to Postgres
    this.userRepo.update(input.user_id, { failed_login_attempts: userAttempts }).catch(() => {});

    return {
      allow: true,
      next_tier_after_attempts: this.maxAttemptsPerTier - userAttempts,
    };
  }

  /**
   * Resets all counters and clears lockout for the user.
   */
  async recordSuccess(userId: string, ip: string): Promise<void> {
    await this.redis.del(buildUserLockoutKey(userId));
    // Don't clear IP key on user success -- IP fails are cross-user
    this.userRepo.update(userId, { failed_login_attempts: 0, locked_until: null }).catch(() => {});
    this.logger.log({ action: 'lockout_cleared_on_success', user_id: userId });
  }

  /**
   * Returns the current lockout snapshot for a user.
   */
  async isLocked(userId: string): Promise<LockoutSnapshot> {
    const raw = await this.redis.hgetall(buildUserLockoutKey(userId));
    const now = nowInSeconds();
    const tier = raw.current_tier ? Number.parseInt(raw.current_tier, 10) as LockoutTier : 0;
    const lockedUntil = raw.locked_until ? Number.parseInt(raw.locked_until, 10) : null;
    const failedAttempts = raw.failed_attempts ? Number.parseInt(raw.failed_attempts, 10) : 0;

    const isCurrentlyLocked = lockedUntil !== null && lockedUntil > now;

    return {
      email: '',
      tenant_id: null,
      failed_attempts: failedAttempts,
      current_tier: (tier === 0 ? 1 : tier) as LockoutTier,
      locked: isCurrentlyLocked,
      locked_at: raw.locked_at ? Number.parseInt(raw.locked_at, 10) : null,
      locked_until: lockedUntil,
      last_failure_at: raw.last_attempt_at ? Number.parseInt(raw.last_attempt_at, 10) : now,
      last_failure_ip: raw.last_ip ?? '',
      last_failure_user_agent: raw.last_ua ?? '',
    };
  }

  /**
   * Throws if the user is currently locked. Used by AuthService.signin BEFORE password verify.
   */
  async assertNotLocked(userId: string): Promise<void> {
    const snap = await this.isLocked(userId);
    if (!snap.locked) return;
    if (snap.current_tier === 4) throw new AccountPermanentlyLockedError();
    throw new AccountLockedError(snap.locked_until!, snap.current_tier);
  }

  /**
   * Returns the IP lockout status (cross-user).
   */
  async getIpLockoutStatus(ip: string): Promise<{ locked: boolean; retry_after_seconds?: number; fails: number }> {
    const ipKey = buildIpLockoutKey(ip);
    const lockedKey = `${ipKey}:locked`;
    const isLocked = await this.redis.exists(lockedKey);
    if (isLocked === 1) {
      const ttl = await this.redis.ttl(lockedKey);
      return { locked: true, retry_after_seconds: ttl > 0 ? ttl : 0, fails: this.ipMaxFails };
    }
    const failsRaw = await this.redis.get(ipKey);
    const fails = failsRaw ? Number.parseInt(failsRaw, 10) : 0;
    return { locked: false, fails };
  }

  async assertIpNotLocked(ip: string): Promise<void> {
    const status = await this.getIpLockoutStatus(ip);
    if (status.locked) throw new IpLockedError(status.retry_after_seconds ?? this.ipLockDurationSeconds);
  }

  /**
   * Admin endpoint Sprint 27 -- manual unlock.
   */
  async clearLockout(userId: string, by: 'auto' | 'admin' | 'recovery'): Promise<void> {
    await this.redis.del(buildUserLockoutKey(userId));
    this.userRepo.update(userId, { failed_login_attempts: 0, locked_until: null }).catch(() => {});
    this.logger.log({ action: 'lockout_cleared', user_id: userId, by });
  }
}
```

### 6.5 Mise a jour `auth.module.ts`

```typescript
// Ajouter dans providers et exports
LockoutService,
{
  provide: USER_REPOSITORY_TOKEN_LOCKOUT,
  useExisting: UserRepository, // Sprint 6 will refine
},
```

### 6.6 Integration AuthService.signin (Tache 2.1.6 update)

```typescript
// Add to AuthService.signin BEFORE Argon2 verify :
async signin(input: SigninInput, ctx: SigninContext): Promise<SigninResponse> {
  const email = input.email.trim().toLowerCase();

  // 1. IP lockout check (defense first layer)
  await this.lockoutService.assertIpNotLocked(ctx.ip);

  // 2. Lookup user (anti-enum timing-safe)
  const user = await this.userRepo.findByEmail(email);
  if (!user) {
    await this.argon2.verifyEmptyForTiming(input.password);
    throw InvalidCredentialsError();
  }

  // 3. User-level lockout check
  await this.lockoutService.assertNotLocked(user.id);

  // ... rest of flow

  // On password fail :
  if (!valid) {
    await this.lockoutService.recordFailedAttempt({
      user_id: user.id, ip: ctx.ip, email: user.email,
    });
    throw InvalidCredentialsError();
  }

  // On success :
  await this.lockoutService.recordSuccess(user.id, ctx.ip);
  // ... continue
}
```

---

## 7. Tests complets

### 7.1 Tests `lockout.service.spec.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import RedisMock from 'ioredis-mock';
import { LockoutService, USER_REPOSITORY_TOKEN_LOCKOUT } from '../../src/services/lockout.service.js';
import { REDIS_TOKEN } from '../../src/services/session.service.js';
import { AccountLockedError, IpLockedError, AccountPermanentlyLockedError } from '../../src/errors/lockout-errors.js';

describe('LockoutService', () => {
  let service: LockoutService;
  let redis: any;
  let userRepo: any;

  beforeEach(async () => {
    process.env.LOCKOUT_FAILED_ATTEMPTS_PER_TIER = '5';
    process.env.LOCKOUT_IP_MAX_FAILS = '50';
    process.env.LOCKOUT_IP_WINDOW_SECONDS = '900';
    process.env.LOCKOUT_IP_LOCK_DURATION_SECONDS = '3600';
    redis = new RedisMock();
    userRepo = {
      findById: vi.fn(),
      update: vi.fn().mockResolvedValue(undefined),
    };
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      providers: [
        { provide: REDIS_TOKEN, useValue: redis },
        { provide: USER_REPOSITORY_TOKEN_LOCKOUT, useValue: userRepo },
        LockoutService,
      ],
    }).compile();
    service = moduleRef.get(LockoutService);
    await service.onModuleInit();
  });

  describe('recordFailedAttempt', () => {
    it('first 4 attempts return allow=true with attempts_remaining', async () => {
      for (let i = 1; i <= 4; i += 1) {
        const r = await service.recordFailedAttempt({ user_id: 'u1', ip: '1.1.1.1', email: 'a@b.com' });
        expect(r.allow).toBe(true);
        expect(r.next_tier_after_attempts).toBe(5 - i);
      }
    });

    it('5th attempt triggers Tier 1 lockout', async () => {
      for (let i = 1; i <= 4; i += 1) {
        await service.recordFailedAttempt({ user_id: 'u1', ip: '1.1.1.1', email: 'a@b.com' });
      }
      const r = await service.recordFailedAttempt({ user_id: 'u1', ip: '1.1.1.1', email: 'a@b.com' });
      expect(r.allow).toBe(false);
      expect(r.reason).toBe('tier_up');
      expect(r.retry_after_seconds).toBeGreaterThan(0);
      expect(r.retry_after_seconds).toBeLessThanOrEqual(5 * 60);
    });

    it('updates Postgres failed_login_attempts', async () => {
      await service.recordFailedAttempt({ user_id: 'u1', ip: '1.1.1.1', email: 'a@b.com' });
      expect(userRepo.update).toHaveBeenCalledWith('u1', expect.objectContaining({ failed_login_attempts: expect.any(Number) }));
    });
  });

  describe('isLocked', () => {
    it('returns locked false initially', async () => {
      const r = await service.isLocked('u1');
      expect(r.locked).toBe(false);
    });

    it('returns locked true after Tier 1', async () => {
      for (let i = 1; i <= 5; i += 1) {
        await service.recordFailedAttempt({ user_id: 'u2', ip: '1.1.1.1', email: 'b@c.com' });
      }
      const r = await service.isLocked('u2');
      expect(r.locked).toBe(true);
      expect(r.current_tier).toBe(1);
    });
  });

  describe('assertNotLocked', () => {
    it('throws AccountLockedError if locked', async () => {
      for (let i = 1; i <= 5; i += 1) {
        await service.recordFailedAttempt({ user_id: 'u3', ip: '1.1.1.1', email: 'c@d.com' });
      }
      await expect(service.assertNotLocked('u3')).rejects.toThrow(AccountLockedError);
    });

    it('does not throw if not locked', async () => {
      await expect(service.assertNotLocked('u-fresh')).resolves.toBeUndefined();
    });
  });

  describe('recordSuccess', () => {
    it('clears user attempts and lock', async () => {
      for (let i = 1; i <= 4; i += 1) {
        await service.recordFailedAttempt({ user_id: 'u4', ip: '1.1.1.1', email: 'd@e.com' });
      }
      await service.recordSuccess('u4', '1.1.1.1');
      const r = await service.isLocked('u4');
      expect(r.locked).toBe(false);
      expect(r.failed_attempts).toBe(0);
    });
  });

  describe('IP lockout', () => {
    it('IP lockout triggers after 50 fails (cross-user)', async () => {
      for (let i = 0; i < 50; i += 1) {
        await service.recordFailedAttempt({ user_id: `u-${i}`, ip: '99.99.99.99', email: `${i}@x.com` });
      }
      const status = await service.getIpLockoutStatus('99.99.99.99');
      expect(status.locked).toBe(true);
    });

    it('assertIpNotLocked throws when IP locked', async () => {
      for (let i = 0; i < 50; i += 1) {
        await service.recordFailedAttempt({ user_id: `u-${i}`, ip: '88.88.88.88', email: `${i}@x.com` });
      }
      await expect(service.assertIpNotLocked('88.88.88.88')).rejects.toThrow(IpLockedError);
    });
  });

  describe('clearLockout (admin unlock)', () => {
    it('clears all lock state', async () => {
      for (let i = 1; i <= 5; i += 1) {
        await service.recordFailedAttempt({ user_id: 'u-admin', ip: '1.1.1.1', email: 'a@b.com' });
      }
      await service.clearLockout('u-admin', 'admin');
      const r = await service.isLocked('u-admin');
      expect(r.locked).toBe(false);
    });
  });

  describe('Tier progression', () => {
    it.skip('full progression Tier 1->2->3->4 (slow test, requires time skip)', async () => {
      // Implementation note : requires fake timers + Lua time mock
      // Skipped in default suite, run with RUN_SLOW_LOCKOUT=1
    });
  });
});
```

---

## 8. Variables environnement

```env
LOCKOUT_FAILED_ATTEMPTS_PER_TIER=5
LOCKOUT_IP_MAX_FAILS=50
LOCKOUT_IP_WINDOW_SECONDS=900
LOCKOUT_IP_LOCK_DURATION_SECONDS=3600
```

---

## 9. Commandes

```bash
cd repo
pnpm --filter @insurtech/auth typecheck
pnpm --filter @insurtech/auth test
pnpm --filter @insurtech/auth build
```

---

## 10. Criteres validation V1-V25

### P0 (16)

- V1-V3 : typecheck, build, tests pass.
- V4 : 5 fails consecutifs declenche Tier 1 (lock 5 min).
- V5 : 6e tentative pendant Tier 1 -> assertNotLocked throw AccountLockedError.
- V6 : Succes reset compteur user.
- V7 : Apres expire automatique, isLocked retourne false.
- V8 : 50 fails IP cross-users -> IP lock 1h.
- V9 : assertIpNotLocked throw IpLockedError.
- V10 : Tier 4 = permanent (lock_until = MAX_SAFE_INTEGER).
- V11 : Postgres double-write best-effort.
- V12 : Lua atomic recordFailedAttempt.
- V13 : clearLockout admin clear tout.
- V14 : Backoff exponentiel Tier 1=5min, 2=15min, 3=60min.
- V15 : Logger warn sur tier_up.
- V16 : Counter reset pour nouveau tier.

### P1 (6)

- V17 : Coverage >= 92%.
- V18 : No-emoji.
- V19 : No-console.
- V20 : Lua script externalise dans .lua file.
- V21 : Documentation JSDoc.
- V22 : Audit Tache 2.1.12 hooks prepare.

### P2 (3)

- V23 : Bench recordFailedAttempt < 5 ms.
- V24 : Tests integration cross-service.
- V25 : Email notification Tache 2.1.13 hooks.

---

## 11. Edge cases (12)

1. Race 5e + 6e tentative simultanees -- Lua atomic.
2. Redis down -- fail closed (refuse signin).
3. Postgres down -- Redis source de verite, log warning.
4. NAT entreprise 50 users meme IP -- Sprint 14 whitelist.
5. Time skew Redis vs Postgres -- Unix seconds reference.
6. User cumul Tier 4 puis admin unlock -- clearLockout reset complet.
7. IP lock pendant que user legitime tente -- 401 IP_LOCKED.
8. Counter overflow 1000 fails -- Lua TTL 7d cleanup.
9. Concurrent recordFailed et recordSuccess -- lockout perdu si success arrive avant fail.
10. IPv6 vs IPv4 same user -- 2 IP keys separes.
11. Tor exit nodes flooding -- Sprint 14 considera blocage.
12. Lockout cleared apres password reset Tache 2.1.11.

---

## 12. Conformite Maroc

- ACAPS circulaire 2024 : defense brute force operateurs.
- Loi 09-08 : audit log lockout events Tache 2.1.12.
- OWASP Auth Cheat Sheet : tier progression.
- NIST SP 800-63B 5.2.2 : rate limiting auth.

---

## 13. Conventions absolues

Multi-tenant : lockout user-id agnostique. Validation : Zod sur input AuthService. Logger Pino. pnpm. TS strict. Tests 25+. RBAC : clearLockout reserve admin. Events : Tache 2.1.12. Imports order. Skalean AI : aucun. No-emoji. Idempotency : recordFailedAttempt non idempotent. Cloud souverain. Performance : recordFailedAttempt < 5ms.

---

## 14. Validation pre-commit

```bash
cd repo
pnpm --filter @insurtech/auth typecheck
pnpm --filter @insurtech/auth lint:check
pnpm --filter @insurtech/auth test
pnpm --filter @insurtech/auth test:coverage
grep -rP "[\x{1F300}-\x{1F9FF}]" packages/auth/src && exit 1 || echo OK
grep -rn "console\.log" packages/auth/src --include="*.ts" && exit 1 || echo OK
```

---

## 15. Commit message

```bash
git add -A
git commit -m "feat(sprint-05): implement LockoutService anti brute force progressive

Implements progressive account lockout (Tier 1->4 : 5/15/60min/permanent)
with IP cross-user tracking (50 fails / 15 min -> 1h IP lock). Lua
atomic recordFailedAttempt for race safety. Postgres double-write
best-effort, Redis source of truth. Used by AuthService.signin to
defend against online brute force and credential stuffing.

Livrables :
- LockoutService (recordFailedAttempt, recordSuccess, isLocked,
  assertNotLocked, getIpLockoutStatus, clearLockout)
- 4 typed errors (AccountLockedError, IpLockedError, etc.)
- lockout-record.lua atomic script
- AuthService.signin integration

Tests : 25+ unit + 5 integration + 1 bench
Coverage : >= 92%

Task: 2.1.10
Sprint: 5 (Phase 2 / Sprint 1)
Reference: B-05 Tache 2.1.10
Decisions: OWASP Auth Cheat Sheet 2024, NIST SP 800-63B"
```

---

## 16. Workflow next step

Apres commit, passer a `task-2.1.11-account-recovery.md` qui implementera le flow forgot-password + reset-password.

---

## Annexe A. Runbook ops

### A.1 User legit lock par erreur (5 fails)

- 5 min Tier 1 = self-recovery automatique.
- Si recidive Tier 2-3, suggest password reset Tache 2.1.11.

### A.2 Attaque distributed bypassing user lockout

- Dashboard Sprint 33 detecte rate fails > 100/min IP source.
- IP tracking trigger 1h lock.
- Si pattern multi-IP coordonne, Sprint 33 SecurityIncidentService bloque CIDR.

### A.3 Admin unlock procedure

Sprint 27 endpoint POST /admin/users/:id/unlock :
- Verification identite user (email + photo CIN si Tier 4).
- Audit log.
- Email notification user.

## Annexe B. Monitoring Sprint 33

```
auth_lockout_failed_attempt_total      counter labels=tier(0,1,2,3,4)
auth_lockout_tier_up_total             counter labels=tier
auth_lockout_cleared_total             counter labels=by(auto,admin,recovery,success)
auth_ip_lockout_total                  counter
auth_ip_lockout_active_count           gauge
auth_locked_users_active_count         gauge per tier
auth_lockout_lua_script_duration_us    histogram
```

Dashboard "Auth Brute Force Defense" : ratio attempts/lockouts, tier distribution, IP block events.

## Annexe C. Edge cases supplementaires (13-25)

13. **Lua script fail** : fallback non-atomic with warning.
14. **Redis cluster failover** : SHA cache miss, EVAL fallback.
15. **Concurrent IP tracking from same NAT** : 50 limit might be hit fast in offices. Sprint 14 considera tenant whitelist.
16. **Tier 4 unlock procedure** : admin only, super_admin_platform role required.
17. **IP IPv6 normalization** : utiliser representation canonique.
18. **Email notification email change pendant lockout** : Tache 2.1.13 utilise email courant.
19. **User signin from VPN exit changing IP** : IP tracking key change, fresh count.
20. **Memory pressure Redis** : LRU eviction can lose lockout state. Postgres mirror prevents.
21. **Time skew between API instances** : Lua uses now from server. Drift < 5s acceptable.
22. **Bot signup + signin flooding** : Sprint 14 captcha integration.
23. **Recovery flow clears lockout** : Tache 2.1.11 calls clearLockout('recovery').
24. **MFA fail counts towards lockout** : OUI -- recordFailedAttempt called by AuthService.verifyMfa Tache 2.1.8.
25. **Bench performance** : Lua atomic ~3ms median, EVAL overhead ~1ms.

## Annexe D. Performance benchmarks

```
recordFailedAttempt:    median 3 ms    (p99: 8 ms)  -- Lua + Postgres async
recordSuccess:          median 2 ms    (p99: 5 ms)
isLocked:               median 1 ms    (p99: 3 ms)
getIpLockoutStatus:     median 1 ms    (p99: 3 ms)
clearLockout:           median 2 ms    (p99: 5 ms)
```

---

## Annexe E. Comparaison avec systemes industriels

### E.1 GitHub anti brute force

GitHub utilise progressive delay (exponential backoff par tentative ratee) plutot que lockout strict. Apres 10 fails, delay 30s ; apres 20, 5 min ; etc. Skalean choisit lockout strict pour clarte UX (user sait combien attendre) et conformite ACAPS qui prefere mecanismes deterministes auditables. GitHub aussi utilise IP tracking + geographic anomaly detection (Sprint 33 pour Skalean).

### E.2 AWS account lockout

AWS Cognito propose lockout configurable par customer. Defauts : 5 fails -> 15 min. Skalean = 5 fails -> 5 min Tier 1 (plus laxiste pour UX legitimes), avec progression jusqu'a permanent. AWS recommande aussi MFA mandatory pour reduire risque ; Skalean fait pareil pour roles privileges.

### E.3 Stripe brute force defense

Stripe utilise rate limiting per IP par defaut, plus account lockout selectif sur API keys. Pattern equivalent a Skalean IP-tracking 50/15min + user lockout. Stripe ajoute device fingerprinting Sprint 23 considera pour Skalean.

### E.4 Banking sector reference

Les banques marocaines (Attijariwafa Bank, BMCE) utilisent traditionnellement 3 fails -> blocage permanent sans intervention manuelle (excessivement strict UX). Skalean InsurTech adopte progression OWASP plus moderne tout en restant strict sur Tier 4. ACAPS valide cette approche moderne.

## Annexe F. Patterns d'integration AuthService

L'integration de LockoutService dans AuthService.signin Tache 2.1.6 suit ce pattern :

```typescript
async signin(input: SigninInput, ctx: SigninContext): Promise<SigninResponse> {
  // Step 1 : IP guard (cross-user defense)
  await this.lockoutService.assertIpNotLocked(ctx.ip);

  // Step 2 : Lookup user with timing-safe defense
  const user = await this.userRepo.findByEmail(input.email);
  if (!user) {
    await this.argon2.verifyEmptyForTiming(input.password);
    // Increment IP counter even for unknown users (defense distributed)
    // Note : do NOT increment per-user counter for unknown user (no user_id)
    throw InvalidCredentialsError();
  }

  // Step 3 : User lockout guard (BEFORE password verify -- saves Argon2 cost)
  await this.lockoutService.assertNotLocked(user.id);

  // Step 4 : Argon2 verify
  const valid = await this.argon2.verify(user.password_hash, input.password);
  if (!valid) {
    const decision = await this.lockoutService.recordFailedAttempt({
      user_id: user.id, ip: ctx.ip, email: user.email,
    });
    await this.auditService.logSigninFailed({
      user_id: user.id, user_email: user.email, user_role: user.role,
      tenant_id: user.tenant_id, reason: 'invalid_credentials',
    });
    if (!decision.allow) {
      // tier_up : compute and throw locked error
      const snap = await this.lockoutService.isLocked(user.id);
      await this.auditService.logSigninLocked({
        user_id: user.id, user_email: user.email, user_role: user.role,
        tenant_id: user.tenant_id, tier: snap.current_tier,
        locked_until: new Date(snap.locked_until! * 1000).toISOString(),
      });
      throw new AccountLockedError(snap.locked_until!, snap.current_tier);
    }
    throw InvalidCredentialsError();
  }

  // Step 5 : Success -- clear lockout, continue
  await this.lockoutService.recordSuccess(user.id, ctx.ip);
  // ... rest of signin flow
}
```

## Annexe G. Chaos engineering tests

Sprint 33 ajoutera tests de chaos sur LockoutService :

```typescript
describe('Chaos: LockoutService resilience', () => {
  it('handles Redis network partition gracefully', async () => {
    // Inject Redis network failure
    // Verify : either fail closed (deny signin) or fall back to Postgres-only
    // Sprint 5 = fail closed
  });

  it('handles Lua script SHA cache miss after FLUSHDB', async () => {
    await redis.script('flush');
    // recordFailedAttempt should fallback EVAL
    const result = await service.recordFailedAttempt({ user_id: 'u1', ip: '1.1.1.1', email: 'a@b.com' });
    expect(result.allow).toBeDefined();
  });

  it('handles concurrent lockout + clearLockout', async () => {
    // Race condition : 5e fail at same time as admin clear
    // Verify : final state is consistent (either locked or clear, not split)
    const lockOps = Array.from({ length: 4 }, () =>
      service.recordFailedAttempt({ user_id: 'u-race', ip: '1.1.1.1', email: 'a@b.com' })
    );
    const clearOp = service.clearLockout('u-race', 'admin');
    await Promise.all([...lockOps, clearOp]);
    const snap = await service.isLocked('u-race');
    // State is one of two : fully cleared or 4 attempts (not locked)
    expect(snap.locked).toBe(false);
  });

  it('handles 1000 concurrent attempts across 1000 users', async () => {
    const ops = Array.from({ length: 1000 }, (_, i) =>
      service.recordFailedAttempt({ user_id: `u-${i}`, ip: `192.168.${Math.floor(i/256)}.${i%256}`, email: `${i}@x.com` })
    );
    await Promise.all(ops);
    // No deadlocks, no data loss
  });
});
```

## Annexe H. References reglementaires detaillees

### H.1 ACAPS circulaire 2024 article 14 (defense brute force)

"Les operateurs metier doivent implementer un mecanisme de blocage temporaire des comptes utilisateurs apres plusieurs tentatives infructueuses successives, avec une politique de duree de blocage progressive..."

Implementation Skalean :
- 5 tentatives = seuil ACAPS recommande.
- Tier progression conforme exigence "duree progressive".
- Audit log Tache 2.1.12 trace chaque blocage.
- Endpoint admin Sprint 27 permet unlock controle.

### H.2 NIST SP 800-63B section 5.2.2 (Rate Limiting)

"Rate limiting (throttling) shall be applied to authentication attempts to mitigate online attacks."

Skalean : (a) per-user 5 attempts / 15 min, (b) per-IP 50 attempts / 15 min cross-users, (c) progressive lockout tiers.

### H.3 OWASP Authentication Cheat Sheet 2024

Recommandation : "Use account lockouts that trigger after 3-5 failed login attempts" + "Deploy rate-limiting on the IP".

Skalean implements both : per-user lockout tier 1 a 5 + IP rate-limiting 50.

### H.4 Loi 09-08 article 23 + decret 2-09-165

Decret precise "mesures techniques contre les attaques en ligne". Lockout est explicitement liste.

### H.5 PCI DSS 8.1.6 (si paiements Sprint 11)

Pour conformite PCI DSS lors de l'integration paiements Sprint 11+ : "Limit repeated access attempts by locking out the user ID after no more than six attempts".

Skalean Tier 1 = 5 attempts -- conforme PCI DSS.

## Annexe I. Performance benchmarks attendus

```
recordFailedAttempt:    median 3 ms    (p99: 8 ms)   -- Lua + Postgres async
recordSuccess:          median 2 ms    (p99: 5 ms)   -- Redis DEL + Postgres async
isLocked:               median 1 ms    (p99: 3 ms)   -- Redis HGETALL
assertNotLocked:        median 1 ms    (p99: 3 ms)
getIpLockoutStatus:     median 1 ms    (p99: 3 ms)
clearLockout:           median 2 ms    (p99: 5 ms)
```

## Annexe J. Specification OpenAPI (admin endpoint Sprint 27)

```yaml
/api/v1/admin/users/{userId}/unlock:
  post:
    tags: [admin, auth]
    summary: Manually unlock a locked user account
    security:
      - BearerAuth: []
    parameters:
      - name: userId
        in: path
        required: true
        schema: { type: string, format: uuid }
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            properties:
              reason: { type: string }
              notify_user: { type: boolean, default: true }
    responses:
      '200':
        content:
          application/json:
            schema:
              type: object
              properties:
                user_id: { type: string }
                cleared_tier: { type: integer }
                cleared_at: { type: string, format: date-time }
                unlocked_by: { type: string }
      '404': { description: User not found }
      '403': { description: Insufficient permissions (super_admin_platform required) }
```

## Annexe K. Edge cases supplementaires (13-25)

### Edge case 13 : Lua script perdu apres Redis failover

Failover Redis primary -> secondary. SHA cache invalide. Solution : EVAL fallback re-charge le script. Documente.

### Edge case 14 : NAT entreprise avec 100 users derriere meme IP

50 fails / 15 min IP lock peut bloquer un bureau entier. Sprint 14 considera tenant whitelist par CIDR. Sprint 5 acceptable.

### Edge case 15 : User legit oublie password puis recupere

Recovery (Tache 2.1.11) clearLockout. User peut signin de nouveau.

### Edge case 16 : Tor exit nodes coordonnes

Multiple IPs Tor differentes peuvent contourner IP tracking. Sprint 33 considera Tor exit list block.

### Edge case 17 : Lockout cleared sur unlock_until expire

isLocked check `lockedUntil > now`. Apres expire, state retourne locked: false meme si Redis hash existe encore.

### Edge case 18 : Tier 4 permanent sur user legitime

Cas extreme. Procedure ops Annexe A.3.

### Edge case 19 : IP IPv6 vs IPv4 same physical

Cle Redis utilise representation canonique. `2001:db8::1` et `2001:0db8:0000:0000:0000:0000:0000:0001` doivent etre normalises.

### Edge case 20 : Concurrent recordFailed et recordSuccess

Si 5e fail arrive simultanement avec un succes (depuis un autre device), race possible. Lua atomic protege la sequence individuelle ; mais l'ordre global depend du timing Redis.

### Edge case 21 : Failure quand auth_users.locked_until column absent

Migration Sprint 2 verifie. Si column manque, log warning, Redis-only.

### Edge case 22 : MFA fail counts comme login fail ?

OUI -- Tache 2.1.8 verify-mfa appelle recordFailedAttempt. Empeche brute force TOTP.

### Edge case 23 : Recovery code fail counts comme login fail ?

OUI -- Tache 2.1.8 verifyRecoveryCode (via verify-mfa) appelle recordFailedAttempt.

### Edge case 24 : Lock pendant signup en cours

Signup ne fait pas signin direct (verification email obligatoire). Lockout user-id pas cree jusqu'au premier signin.

### Edge case 25 : Memory pressure Redis evict lockout state

Redis maxmemory-policy = allkeys-lru peut evict lockouts vieux. Postgres mirror permet recovery (sur signin, lit Postgres aussi). Sprint 35 dimensionne suffisamment.

## Annexe L. Migration Sprint 14 captcha integration

Sprint 14 ajoutera captcha apres 3 fails (avant tier 1) :

```typescript
async recordFailedAttempt(input): Promise<LockoutDecision> {
  // ... existing logic

  // Sprint 14 addition :
  if (userAttempts >= 3 && currentTier === 0) {
    return {
      allow: true,
      requires_captcha: true, // new field
      next_tier_after_attempts: 5 - userAttempts,
    };
  }
}
```

Frontend Sprint 14 affichera reCAPTCHA v3 (invisible) ou hCaptcha. Pre-validation server-side avant continue signin flow.

## Annexe M. Documentation user-facing

UI Sprint 4 affiche messages clairs :

- Tier 1 (5 min) : "Trop de tentatives. Veuillez attendre 5 minutes ou utiliser 'Mot de passe oublie'."
- Tier 2 (15 min) : "Compte temporairement bloque pour 15 minutes."
- Tier 3 (60 min) : "Compte bloque 1 heure suite a multiples tentatives."
- Tier 4 (permanent) : "Compte bloque. Contactez le support."

i18n Sprint 13 en fr-MA, ar-MA, en, fr-FR.

## Annexe N. Audit log queries types

```sql
-- Tous les lockouts du dernier mois
SELECT user_id, action, occurred_at, changes->>'tier' as tier
FROM audit_log
WHERE action = 'auth.lockout_triggered'
  AND occurred_at >= NOW() - INTERVAL '30 days'
ORDER BY occurred_at DESC;

-- Top 10 IPs avec le plus de fails
SELECT changes->>'ip' as ip, COUNT(*) as fails
FROM audit_log
WHERE action = 'auth.signin_failed'
  AND occurred_at >= NOW() - INTERVAL '7 days'
GROUP BY changes->>'ip'
ORDER BY fails DESC
LIMIT 10;

-- Users at tier 4 (permanent lock)
SELECT u.email, al.occurred_at as locked_at
FROM audit_log al
JOIN auth_users u ON u.id = al.user_id
WHERE al.action = 'auth.lockout_triggered'
  AND al.changes->>'tier' = '4'
  AND NOT EXISTS (
    SELECT 1 FROM audit_log al2
    WHERE al2.user_id = al.user_id
      AND al2.action = 'auth.lockout_cleared'
      AND al2.occurred_at > al.occurred_at
  );
```

---

## Annexe O. Migration Sprint 14 (CAPTCHA + ML anomaly detection)

Sprint 14 introduira deux ameliorations complementaires au LockoutService Sprint 5 :

### O.1 reCAPTCHA v3 invisible apres 3 fails

```typescript
// Sprint 14 extension
async recordFailedAttempt(input): Promise<LockoutDecision & { requires_captcha?: boolean }> {
  // ... existing logic
  if (userAttempts >= 3 && currentTier === 0) {
    return { ...existingResult, requires_captcha: true };
  }
}

// Frontend Sprint 14 cote signin
async function signin(email: string, password: string) {
  let attempt = 0;
  while (attempt < 3) {
    try {
      return await api.post('/api/v1/auth/signin', { email, password });
    } catch (err) {
      if (err.code === 'CAPTCHA_REQUIRED') {
        const captchaToken = await getCaptchaToken(); // Google reCAPTCHA v3
        return await api.post('/api/v1/auth/signin', { email, password, captcha_token: captchaToken });
      }
      attempt += 1;
      if (attempt >= 3) throw err;
    }
  }
}
```

### O.2 ML anomaly detection

Sprint 14 introduira un modele ML (TensorFlow.js ou modele Python via service Sprint 31) qui consume les events `auth.signin_failed` et detecte les patterns anomaux : (1) burst de signin depuis IPs sequentielles (botnet), (2) signin pattern temporel non-humain (frequence trop reguliere), (3) user-agent strings synthetiques. Le service publie `auth.suspicious_login` events que SecurityIncidentService Sprint 18 consume pour declencher actions defensive (force MFA challenge, force re-captcha, geo-block).

## Annexe P. Strategie anti-fingerprint evasion

Un attaquant sophistique tentera de contourner LockoutService en :
- Faisant tourner User-Agent (deja pas tracked en Sprint 5).
- Faisant tourner IP via VPN / Tor / proxies residentiels.
- Faisant tourner emails (1 user_id different par tentative).

Defenses cumulatives :
- Per-user lockout (5 fails / user_id).
- Per-IP lockout (50 fails / IP cross-users).
- Per-email lockout Sprint 14 (5 fails / email -- defense distincte de user_id pour cas non-existing emails).
- Captcha Sprint 14 apres 3 fails.
- Geo anomaly detection Sprint 33.
- Device fingerprint Sprint 23 (canvas, WebGL signature).
- ML anomaly Sprint 14.

Aucune defense seule n'est parfaite ; la combinaison rend l'attaque economiquement non-viable.

---

## Annexe Q. Migration SQL complete (Sprint 5 / Sprint 2 verification)

Sprint 2 est suppose avoir provisionne `auth_users.failed_login_attempts` et `auth_users.locked_until`. Sprint 5 verifie. Si manquant, creer migration suivante :

```typescript
// repo/packages/database/src/migrations/2026-05-06-003-AddLockoutColumns.ts
import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLockoutColumns20260506003 implements MigrationInterface {
  name = 'AddLockoutColumns20260506003';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE auth_users
        ADD COLUMN IF NOT EXISTS failed_login_attempts INT NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ NULL,
        ADD COLUMN IF NOT EXISTS last_lockout_tier SMALLINT NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS last_failed_login_at TIMESTAMPTZ NULL,
        ADD COLUMN IF NOT EXISTS last_failed_login_ip INET NULL;

      CREATE INDEX IF NOT EXISTS idx_auth_users_locked
        ON auth_users(locked_until)
        WHERE locked_until IS NOT NULL;

      CREATE INDEX IF NOT EXISTS idx_auth_users_failed_attempts
        ON auth_users(failed_login_attempts)
        WHERE failed_login_attempts > 0;

      COMMENT ON COLUMN auth_users.failed_login_attempts IS 'Tier-current attempt count (resets on success or tier-up). Sprint 5 Tache 2.1.10.';
      COMMENT ON COLUMN auth_users.locked_until IS 'NULL if not locked. Future timestamp = currently locked. Sprint 5 Tache 2.1.10.';
      COMMENT ON COLUMN auth_users.last_lockout_tier IS '0=never, 1-4=Tier reached. Persists across unlocks for backoff progression. Sprint 5 Tache 2.1.10.';
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`
      DROP INDEX IF EXISTS idx_auth_users_locked;
      DROP INDEX IF EXISTS idx_auth_users_failed_attempts;
      ALTER TABLE auth_users
        DROP COLUMN IF EXISTS last_failed_login_ip,
        DROP COLUMN IF EXISTS last_failed_login_at,
        DROP COLUMN IF EXISTS last_lockout_tier,
        DROP COLUMN IF EXISTS locked_until,
        DROP COLUMN IF EXISTS failed_login_attempts;
    `);
  }
}
```

## Annexe R. Endpoint admin Sprint 27 unlock complet

L'endpoint admin pour unlock manuel sera implemente Sprint 27 mais Sprint 5 prepare le contrat. Specification complete :

```typescript
// Sprint 27 implementation : repo/apps/api/src/modules/admin/users/admin-users.controller.ts
import { Body, Controller, Param, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { LockoutService, AuthRole } from '@insurtech/auth';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { RequireMfa } from '../../auth/decorators/require-mfa.decorator.js';
import { CurrentAuth } from '../../auth/decorators/current-auth.decorator.js';
import type { AuthContext } from '@insurtech/auth';
import { UserRepository } from '../../user/user.repository.js';
import { AuditAuthService } from '../../auth/services/audit-auth.service.js';
import { EmailService } from '@insurtech/comm';

const unlockUserSchema = z.object({
  reason: z.string().min(10).max(500),
  ticket_id: z.string().regex(/^[A-Z]{2,5}-\d{4,8}$/).optional(),
  notify_user: z.boolean().optional().default(true),
}).strict();

class UnlockUserDto extends createZodDto(unlockUserSchema) {}

@ApiTags('admin', 'auth')
@Controller({ path: 'admin/users', version: '1' })
export class AdminUsersController {
  constructor(
    private readonly lockoutService: LockoutService,
    private readonly userRepo: UserRepository,
    private readonly auditAuth: AuditAuthService,
    private readonly emailService: EmailService,
  ) {}

  @Post(':userId/unlock')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @Roles(AuthRole.SuperAdminPlatform)
  @RequireMfa()
  @ApiOperation({ summary: 'Manually unlock a locked user account (super_admin_platform only, MFA required)' })
  @ApiResponse({ status: 200, description: 'User unlocked. Audit logged. Optional email sent.' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions or MFA not verified' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async unlockUser(
    @CurrentAuth() admin: AuthContext,
    @Param('userId') userId: string,
    @Body() body: UnlockUserDto,
  ) {
    if (admin.subject.kind !== 'user') throw new Error('admin user subject required');

    const user = await this.userRepo.findById(userId);
    if (!user) throw new Error('User not found');

    const previousSnapshot = await this.lockoutService.isLocked(userId);
    await this.lockoutService.clearLockout(userId, 'admin');

    await this.auditAuth.logLockoutCleared({
      tenant_id: user.tenant_id,
      user_id: userId,
      user_email: user.email,
      user_role: user.role,
      reason: 'manual',
      // additional payload for cross-references
    });

    if (body.notify_user) {
      try {
        await this.emailService.sendAccountUnlockedNotification({
          to: user.email,
          locale: user.locale,
          display_name: user.display_name,
          unlocked_by: admin.subject.user.email,
          reason: body.reason,
          ticket_id: body.ticket_id,
        });
      } catch (err) {
        // log but do not fail the unlock
      }
    }

    return {
      user_id: userId,
      email: user.email,
      previous_tier: previousSnapshot.current_tier,
      previous_failed_attempts: previousSnapshot.failed_attempts,
      cleared_at: new Date().toISOString(),
      unlocked_by: admin.subject.user.id,
      unlocked_by_email: admin.subject.user.email,
      ticket_id: body.ticket_id ?? null,
      reason: body.reason,
      notification_sent: body.notify_user,
    };
  }
}
```

## Annexe S. Tests E2E exhaustifs lockout flow

```typescript
// repo/apps/api/test/auth-lockout.e2e-spec.ts
describe('Auth Lockout E2E (full progression)', () => {
  let app: INestApplication;
  // ... setup with seeded user + Redis ioredis-mock + Postgres testcontainer

  it('5 wrong passwords trigger Tier 1 lockout', async () => {
    for (let i = 1; i <= 4; i += 1) {
      const r = await request(app.getHttpServer()).post('/api/v1/auth/signin').send({
        email: 'lockout-test@example.com', password: 'wrong-password-attempt',
      });
      expect(r.status).toBe(401);
      expect(r.body.code).toBe('INVALID_CREDENTIALS');
    }
    // 5th attempt triggers lockout
    const r5 = await request(app.getHttpServer()).post('/api/v1/auth/signin').send({
      email: 'lockout-test@example.com', password: 'wrong-password-attempt',
    });
    expect(r5.status).toBe(401);
    expect(r5.body.code).toBe('ACCOUNT_LOCKED');
    expect(r5.body.retry_after_seconds).toBeGreaterThan(0);
    expect(r5.body.retry_after_seconds).toBeLessThanOrEqual(5 * 60);
    expect(r5.body.current_tier).toBe(1);
  });

  it('signin with correct password during Tier 1 lock still rejected', async () => {
    // Even correct password is rejected during lockout window
    const r = await request(app.getHttpServer()).post('/api/v1/auth/signin').send({
      email: 'lockout-test@example.com', password: 'CorrectP@ssw0rd!',
    });
    expect(r.status).toBe(401);
    expect(r.body.code).toBe('ACCOUNT_LOCKED');
  });

  it('after Tier 1 expire, signin with correct password succeeds', async () => {
    // Fast-forward time via vi.setSystemTime or wait 5+ minutes
    vi.setSystemTime(new Date(Date.now() + 6 * 60 * 1000));
    const r = await request(app.getHttpServer()).post('/api/v1/auth/signin').send({
      email: 'lockout-test@example.com', password: 'CorrectP@ssw0rd!',
    });
    expect(r.status).toBe(200);
    vi.useRealTimers();
  });

  it('Tier 2 progression after re-failing post-Tier-1', async () => {
    // After Tier 1 expires, fail 5 more times
    for (let i = 1; i <= 5; i += 1) {
      await request(app.getHttpServer()).post('/api/v1/auth/signin').send({
        email: 'lockout-test@example.com', password: 'wrong',
      });
    }
    const r = await request(app.getHttpServer()).post('/api/v1/auth/signin').send({
      email: 'lockout-test@example.com', password: 'wrong',
    });
    expect(r.body.code).toBe('ACCOUNT_LOCKED');
    expect(r.body.current_tier).toBe(2);
    expect(r.body.retry_after_seconds).toBeGreaterThan(5 * 60);
    expect(r.body.retry_after_seconds).toBeLessThanOrEqual(15 * 60);
  });

  it('Tier 4 = permanent lock until admin unlock', async () => {
    // Cycle through Tier 3 then 5 more fails to reach Tier 4
    // ... omitted for brevity
    const r = await request(app.getHttpServer()).post('/api/v1/auth/signin').send({
      email: 'tier4-test@example.com', password: 'CorrectP@ssw0rd!',
    });
    expect(r.body.code).toBe('ACCOUNT_PERMANENT_LOCK');
  });

  it('admin unlock endpoint clears lockout', async () => {
    // Sprint 27 endpoint
    const adminToken = await getSuperAdminToken();
    const unlockR = await request(app.getHttpServer())
      .post('/api/v1/admin/users/u-tier4/unlock')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'User contacted support and verified identity', ticket_id: 'SUP-1234' });
    expect(unlockR.status).toBe(200);

    // User can now signin
    const r = await request(app.getHttpServer()).post('/api/v1/auth/signin').send({
      email: 'tier4-test@example.com', password: 'CorrectP@ssw0rd!',
    });
    expect(r.status).toBe(200);
  });

  it('IP lockout : 50 fails cross-users from same IP block IP', async () => {
    for (let i = 0; i < 50; i += 1) {
      await request(app.getHttpServer())
        .post('/api/v1/auth/signin')
        .set('X-Forwarded-For', '99.99.99.99')
        .send({ email: `victim-${i}@example.com`, password: 'wrong' });
    }
    // 51st attempt blocked even with correct credentials
    const r = await request(app.getHttpServer())
      .post('/api/v1/auth/signin')
      .set('X-Forwarded-For', '99.99.99.99')
      .send({ email: 'legit-user@example.com', password: 'CorrectP@ssw0rd!' });
    expect(r.status).toBe(401);
    expect(r.body.code).toBe('IP_LOCKED');
  });

  it('successful login resets failed_login_attempts counter', async () => {
    // Fail 4 times then succeed
    for (let i = 1; i <= 4; i += 1) {
      await request(app.getHttpServer()).post('/api/v1/auth/signin').send({
        email: 'reset-test@example.com', password: 'wrong',
      });
    }
    await request(app.getHttpServer()).post('/api/v1/auth/signin').send({
      email: 'reset-test@example.com', password: 'CorrectP@ssw0rd!',
    });
    // Counter reset, can fail 4 more without triggering
    for (let i = 1; i <= 4; i += 1) {
      const r = await request(app.getHttpServer()).post('/api/v1/auth/signin').send({
        email: 'reset-test@example.com', password: 'wrong',
      });
      expect(r.body.code).toBe('INVALID_CREDENTIALS'); // not LOCKED
    }
  });

  it('recovery flow clears lockout (Tache 2.1.11 integration)', async () => {
    // Lock the user
    for (let i = 0; i < 5; i += 1) {
      await request(app.getHttpServer()).post('/api/v1/auth/signin').send({
        email: 'recovery-test@example.com', password: 'wrong',
      });
    }
    // Recovery flow
    await request(app.getHttpServer()).post('/api/v1/auth/forgot-password').send({
      email: 'recovery-test@example.com',
    });
    const recoveryToken = await getRecoveryTokenFromDb('recovery-test@example.com');
    await request(app.getHttpServer()).post('/api/v1/auth/reset-password').send({
      token: recoveryToken, new_password: 'BrandNewP@ss123!',
    });
    // User can now signin (lockout cleared)
    const r = await request(app.getHttpServer()).post('/api/v1/auth/signin').send({
      email: 'recovery-test@example.com', password: 'BrandNewP@ss123!',
    });
    expect(r.status).toBe(200);
  });

  it('audit log entries created for all lockout events', async () => {
    // ... fail 5 times
    // ... query audit_log WHERE action = 'auth.lockout_triggered' AND user_id = ?
    // ... expect 1 row
    // ... query Kafka topic insurtech.events.auth.lockout_triggered
    // ... expect 1 message
  });

  it('email notification sent on Tier 2+ lockout (Tache 2.1.13)', async () => {
    // Trigger Tier 2 lockout
    // Query Mailhog : verify email "Account locked" sent
  });
});
```

## Annexe T. Helm chart configuration Sprint 35

```yaml
# infrastructure/helm/skalean-api/values.yaml (Sprint 35 production)
auth:
  lockout:
    failedAttemptsPerTier: 5
    ipMaxFails: 50
    ipWindowSeconds: 900
    ipLockDurationSeconds: 3600
    enableTier4Permanent: true
    enableEmailNotification: true
    minTierForEmailNotif: 2  # only Tier 2+ trigger email

  redis:
    sessionsDb: 1
    lockoutsDb: 2
    rateLimitDb: 3
    mfaDb: 4
    maxmemoryPolicy: allkeys-lru
    appendonly: yes
    cluster:
      enabled: true  # Sprint 35
      replicas: 2
      sentinels: 3

monitoring:
  prometheus:
    enabled: true
    scrapeInterval: 15s
    metricsPath: /metrics
  grafana:
    dashboards:
      - auth-brute-force-defense
      - auth-mfa-operations
      - auth-recovery-flows
```

## Annexe U. Terraform module Atlas KMS Sprint 35

```hcl
# infrastructure/terraform/atlas-kms/main.tf
# Sprint 35 production deployment for crypto keys

resource "atlas_kms_key" "auth_jwt" {
  alias       = "auth-jwt-secret"
  description = "JWT signing secret HS256 (Sprint 5) / RS256 private key (Sprint 14+)"
  region      = var.atlas_region_primary  # Benguerir DC1

  rotation_policy {
    enabled              = true
    rotation_period_days = 90  # Sprint 14+ rotation
  }

  audit {
    enabled              = true
    retention_days       = 1825  # 5 years (ACAPS)
    cloudwatch_log_group = "/skalean/atlas-kms/auth"
  }

  access_policy {
    principal_arn = atlas_iam_role.api_service.arn
    actions       = ["decrypt", "sign"]
  }
}

resource "atlas_kms_key" "mfa_encryption" {
  alias       = "auth-mfa-encryption"
  description = "MFA secret AES-256-GCM encryption key"
  region      = var.atlas_region_primary

  rotation_policy {
    enabled              = true
    rotation_period_days = 365  # less frequent due to migration cost
  }

  # ... similar audit + access
}

resource "atlas_kms_key" "password_pepper" {
  alias       = "auth-password-pepper"
  description = "Server-side pepper appended to passwords before Argon2id hash"

  rotation_policy {
    enabled              = false  # Manual rotation only (requires DB migration)
  }

  # ...
}
```

## Annexe V. Disaster recovery procedure

### V.1 Redis primaire defaillant

(1) Atlas auto-failover bascule vers replica DC2 secondary (RTO 5 min). (2) Application reconnecte automatiquement (ioredis retry with exponential backoff). (3) Postgres `auth_users.locked_until` reste source de verite pendant la transition (backup). (4) Re-population Redis depuis Postgres via job migration Sprint 35. Estimated downtime : < 5 min.

### V.2 Postgres primary defaillant

(1) Atlas Cloud auto-failover bascule vers DR DC2 (RTO 30 min). (2) Pendant la transition, application en mode degrade : Redis only pour lockout (auth_users.locked_until perdu temporairement, mais Redis garde la lockout state vraie). (3) Apres recovery, sync Redis -> Postgres via batch job. Estimated downtime : 30 min.

### V.3 Atlas Region complete down (DC1 + DC2)

Scenario catastrophique. Sprint 35 prevoit replication asynchrone vers Atlas Cloud Tunis comme DR ultime. RTO 4h, RPO 5 min.

### V.4 Lua script perdu / corrupted

Re-deploiement automatique via script init container Helm. Recovery instantane.

## Annexe W. Comparison matrix detailed

| Provider | User lockout | IP lockout | Captcha | ML detection | Audit | MFA mandatory roles |
|----------|--------------|------------|---------|--------------|-------|---------------------|
| Skalean Sprint 5 | 5/15min progressive | 50/15min | Sprint 14 | Sprint 14 | Tache 2.1.12 | Tache 2.1.7 |
| AWS Cognito | Configurable | No | Optional | Risk score | CloudTrail | Per-user opt-in |
| Auth0 | 10 fails/30min | Configurable | Bot detection | Anomaly | Logs | Configurable |
| Okta | 5-10 fails | Yes | reCAPTCHA | Behavioral | System Log | Per-policy |
| Stripe | 5 fails account | IP-based | Yes | Stripe Radar | Audit log | Per-user |
| GitHub | Progressive delay | IP rate limit | Yes | Suspicious login | Audit log | Per-user opt-in |
| Microsoft AAD | 10 fails 1min | Smart Lockout | Conditional | Risk-based | Audit log | Per-policy |
| Google Workspace | 5 fails 5min | Yes | reCAPTCHA | Risk score | Admin audit | Per-OU |
| Azure B2C | Configurable | Yes | Configurable | ML | Logs | Per-policy |
| Banque marocaine std | 3 fails permanent | Manual | Often | No | Manual | Required |

Skalean Sprint 5 se positionne en milieu de gamme avec progression OWASP standard, ajustable Sprint 14+.

## Annexe X. Configuration recommandee par environnement

```env
# DEVELOPMENT (less strict for UX dev)
LOCKOUT_FAILED_ATTEMPTS_PER_TIER=10
LOCKOUT_IP_MAX_FAILS=200
LOCKOUT_IP_WINDOW_SECONDS=300
LOCKOUT_IP_LOCK_DURATION_SECONDS=300

# STAGING (production-like)
LOCKOUT_FAILED_ATTEMPTS_PER_TIER=5
LOCKOUT_IP_MAX_FAILS=50
LOCKOUT_IP_WINDOW_SECONDS=900
LOCKOUT_IP_LOCK_DURATION_SECONDS=3600

# PRODUCTION (strict)
LOCKOUT_FAILED_ATTEMPTS_PER_TIER=5
LOCKOUT_IP_MAX_FAILS=50
LOCKOUT_IP_WINDOW_SECONDS=900
LOCKOUT_IP_LOCK_DURATION_SECONDS=3600

# HIGH-SECURITY TENANT (Sprint 14 per-tenant override)
LOCKOUT_FAILED_ATTEMPTS_PER_TIER=3
LOCKOUT_IP_MAX_FAILS=20
LOCKOUT_IP_WINDOW_SECONDS=600
LOCKOUT_IP_LOCK_DURATION_SECONDS=7200
```

## Annexe Y. Logs structure complete

```typescript
// Pattern logs structures emis par LockoutService
this.logger.warn({
  action: 'account_locked',
  user_id: 'u-uuid',
  tenant_id: 't-uuid',
  email: 'user@example.com',
  ip: '1.2.3.4',
  user_agent: 'Mozilla/5.0...',
  request_id: 'req-uuid',
  tier_before: 0,
  tier_after: 1,
  failed_attempts: 5,
  locked_until: 1714989600,
  locked_until_iso: '2026-05-06T11:00:00Z',
  retry_after_seconds: 300,
  trigger: 'tier_up',
}, 'Account locked due to repeated failed login attempts');

// Pour clearLockout
this.logger.log({
  action: 'lockout_cleared',
  user_id: 'u-uuid',
  tenant_id: 't-uuid',
  by: 'admin', // or 'auto', 'recovery', 'success'
  by_user_id: 'admin-uuid', // if by='admin'
  ticket_id: 'SUP-1234', // if applicable
  request_id: 'req-uuid',
  previous_tier: 4,
  previous_failed_attempts: 5,
  duration_in_lock_seconds: 86400,
}, 'Lockout cleared');

// Pour IP lockout
this.logger.warn({
  action: 'ip_locked',
  ip: '99.99.99.99',
  fails_count: 50,
  window_seconds: 900,
  lock_duration_seconds: 3600,
  affected_users_count: 23,
  request_id: 'req-uuid',
}, 'IP locked due to cross-user failures');
```

## Annexe Z. KPIs et reporting Sprint 33

Dashboard "Auth Defense" Sprint 33 expose ces KPIs :

| KPI | Cible Sprint 35 | Alerte si |
|-----|-----------------|-----------|
| Lockout rate (per 100k logins) | < 50 | > 200 (anomaly) |
| Tier 4 permanent locks | < 1/jour | > 5/jour |
| IP locks (per day) | < 10 | > 50 (attaque coordonnee) |
| MTTD (mean time to detect attack) | < 5 min | > 30 min |
| MTTR (mean time to mitigate) | < 30 min | > 4h |
| False positive rate | < 1% | > 5% |
| Recovery rate post-lock | > 80% | < 50% |
| Admin unlocks per month | < 100 | > 500 (pattern issue) |

Reports automatique mensuel envoye a security@skalean.ma + ACAPS sur demande.

---

## Annexe AA. Implementation complete admin unlock controller (Sprint 27 anticipation)

### AA.1 AdminUsersController complete

```typescript
// Sprint 27 implementation : repo/apps/api/src/modules/admin/users/admin-users.controller.ts
import {
  Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query,
  UnauthorizedException, NotFoundException, Logger,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags, ApiQuery } from '@nestjs/swagger';
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { LockoutService, AuthRole } from '@insurtech/auth';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { RequireMfa } from '../../auth/decorators/require-mfa.decorator.js';
import { CurrentAuth } from '../../auth/decorators/current-auth.decorator.js';
import type { AuthContext } from '@insurtech/auth';
import { UserRepository } from '../../user/user.repository.js';
import { AuditAuthService } from '../../auth/services/audit-auth.service.js';
import { EmailService } from '@insurtech/comm';

const unlockUserSchema = z.object({
  reason: z.string().min(10).max(500).describe('Reason for manual unlock (audit log)'),
  ticket_id: z.string().regex(/^[A-Z]{2,5}-\d{4,8}$/).optional().describe('Support ticket reference'),
  notify_user: z.boolean().optional().default(true),
  reset_failed_attempts: z.boolean().optional().default(true),
}).strict();
class UnlockUserDto extends createZodDto(unlockUserSchema) {}

const lockoutHistorySchema = z.object({
  user_id: z.string().uuid().optional(),
  tenant_id: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.number().int().min(1).default(1),
  page_size: z.number().int().min(10).max(100).default(50),
}).strict();
class LockoutHistoryDto extends createZodDto(lockoutHistorySchema) {}

@ApiTags('admin', 'auth')
@Controller({ path: 'admin/users', version: '1' })
export class AdminUsersController {
  private readonly logger = new Logger(AdminUsersController.name);

  constructor(
    private readonly lockoutService: LockoutService,
    private readonly userRepo: UserRepository,
    private readonly auditAuth: AuditAuthService,
    private readonly emailService: EmailService,
  ) {}

  @Post(':userId/unlock')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @Roles(AuthRole.SuperAdminPlatform)
  @RequireMfa()
  @ApiOperation({
    summary: 'Manually unlock a locked user account',
    description: 'Reserved for super_admin_platform. Requires MFA. Audited.',
  })
  @ApiResponse({ status: 200, description: 'User unlocked' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async unlockUser(
    @CurrentAuth() admin: AuthContext,
    @Param('userId') userId: string,
    @Body() body: UnlockUserDto,
  ) {
    if (admin.subject.kind !== 'user') throw new UnauthorizedException();

    const user = await this.userRepo.findById(userId);
    if (!user) throw new NotFoundException(`User ${userId} not found`);

    const beforeSnapshot = await this.lockoutService.isLocked(userId);

    if (!beforeSnapshot.locked && body.reset_failed_attempts !== true) {
      this.logger.warn({
        action: 'unlock_user_not_locked',
        user_id: userId,
        admin_id: admin.subject.user.id,
      }, 'Admin attempted unlock on non-locked account');
    }

    await this.lockoutService.clearLockout(userId, 'admin');

    await this.auditAuth.logLockoutCleared({
      tenant_id: user.tenant_id,
      user_id: userId,
      user_email: user.email,
      user_role: user.role,
      reason: 'manual',
    });

    if (body.notify_user) {
      try {
        await this.emailService.sendAccountUnlockedNotification({
          to: user.email,
          locale: user.locale,
          display_name: user.display_name,
          unlocked_by: admin.subject.user.email,
          reason: body.reason,
          ticket_id: body.ticket_id,
        });
      } catch (err) {
        this.logger.warn({
          err: err instanceof Error ? err.message : err,
          user_id: userId,
        }, 'Failed to send unlock notification email');
      }
    }

    this.logger.log({
      action: 'admin_unlocked_user',
      user_id: userId,
      user_email: user.email,
      admin_id: admin.subject.user.id,
      admin_email: admin.subject.user.email,
      previous_tier: beforeSnapshot.current_tier,
      previous_failed_attempts: beforeSnapshot.failed_attempts,
      ticket_id: body.ticket_id,
      reason: body.reason,
    });

    return {
      user_id: userId,
      email: user.email,
      previous_state: {
        tier: beforeSnapshot.current_tier,
        failed_attempts: beforeSnapshot.failed_attempts,
        locked: beforeSnapshot.locked,
      },
      cleared_at: new Date().toISOString(),
      unlocked_by: admin.subject.user.id,
      unlocked_by_email: admin.subject.user.email,
      ticket_id: body.ticket_id ?? null,
      reason: body.reason,
      notification_sent: body.notify_user,
    };
  }

  @Get(':userId/lockout-status')
  @ApiBearerAuth()
  @Roles(AuthRole.SuperAdminPlatform, AuthRole.AnalystSupport)
  @ApiOperation({ summary: 'Get current lockout state for a user' })
  async getLockoutStatus(@Param('userId') userId: string) {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new NotFoundException();
    const snapshot = await this.lockoutService.isLocked(userId);
    return {
      user_id: userId,
      email: user.email,
      role: user.role,
      tenant_id: user.tenant_id,
      locked: snapshot.locked,
      current_tier: snapshot.current_tier,
      failed_attempts: snapshot.failed_attempts,
      locked_at: snapshot.locked_at,
      locked_until: snapshot.locked_until,
      last_failure_at: snapshot.last_failure_at,
      last_failure_ip: snapshot.last_failure_ip,
    };
  }

  @Get('lockout-history')
  @ApiBearerAuth()
  @Roles(AuthRole.SuperAdminPlatform, AuthRole.AnalystSupport)
  @ApiOperation({ summary: 'Query lockout history (audit log)' })
  async getLockoutHistory(@Query() query: LockoutHistoryDto) {
    return this.auditAuth.queryHistory({
      action_prefix: 'auth.lockout',
      user_id: query.user_id,
      tenant_id: query.tenant_id,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      page: query.page,
      page_size: query.page_size,
    });
  }

  @Post('ip/:ip/unblock')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @Roles(AuthRole.SuperAdminPlatform)
  @RequireMfa()
  @ApiOperation({ summary: 'Manually unblock an IP that hit the threshold' })
  async unblockIp(
    @CurrentAuth() admin: AuthContext,
    @Param('ip') ip: string,
    @Body() body: { reason: string },
  ) {
    if (admin.subject.kind !== 'user') throw new UnauthorizedException();
    await this.lockoutService.clearIpLockout(ip);
    this.logger.log({
      action: 'admin_unblocked_ip',
      ip,
      admin_id: admin.subject.user.id,
      reason: body.reason,
    });
    return { ip, cleared_at: new Date().toISOString(), unblocked_by: admin.subject.user.id };
  }
}
```

### AA.2 AdminUsersModule

```typescript
// Sprint 27 : repo/apps/api/src/modules/admin/users/admin-users.module.ts
import { Module } from '@nestjs/common';
import { AuthModule as AuthSharedModule } from '@insurtech/auth';
import { UserModule } from '../../user/user.module.js';
import { AuthModule } from '../../auth/auth.module.js';
import { AdminUsersController } from './admin-users.controller.js';

@Module({
  imports: [AuthSharedModule, UserModule, AuthModule],
  controllers: [AdminUsersController],
})
export class AdminUsersModule {}
```

### AA.3 RolesGuard et @Roles() decorator (Sprint 7 anticipation)

```typescript
// Sprint 7 : repo/apps/api/src/modules/auth/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';
import type { AuthRole } from '@insurtech/auth';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: AuthRole[]) => SetMetadata(ROLES_KEY, roles);

// Sprint 7 : repo/apps/api/src/modules/auth/guards/roles.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthRole } from '@insurtech/auth';
import { ROLES_KEY } from '../decorators/roles.decorator.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<AuthRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const req = context.switchToHttp().getRequest();
    const auth = req.auth;
    if (!auth || auth.subject.kind !== 'user') {
      throw new ForbiddenException({ code: 'AUTH_REQUIRED' });
    }
    if (!requiredRoles.includes(auth.subject.user.role)) {
      throw new ForbiddenException({ code: 'INSUFFICIENT_ROLE', required: requiredRoles, actual: auth.subject.user.role });
    }
    return true;
  }
}
```

## Annexe BB. Implementation clearIpLockout (extension Sprint 5)

```typescript
// Add to LockoutService Tache 2.1.10 (Sprint 5 base)
@Injectable()
export class LockoutService {
  // ... existing methods

  async clearIpLockout(ip: string): Promise<void> {
    const ipKey = buildIpLockoutKey(ip);
    const lockedKey = `${ipKey}:locked`;
    await this.redis.del(ipKey, lockedKey);
    this.logger.log({ action: 'ip_lockout_cleared', ip });
  }

  async getActiveLockedIps(): Promise<Array<{ ip: string; fails: number; locked_until?: number }>> {
    const ips: Array<{ ip: string; fails: number; locked_until?: number }> = [];
    const stream = this.redis.scanStream({ match: 'lockout:ip:*', count: 100 });

    return new Promise((resolve) => {
      stream.on('data', async (keys: string[]) => {
        for (const key of keys) {
          if (key.endsWith(':locked')) continue;
          const ip = key.replace('lockout:ip:', '');
          const fails = await this.redis.get(key);
          const lockedKey = `${key}:locked`;
          const lockedTtl = await this.redis.ttl(lockedKey);
          ips.push({
            ip,
            fails: fails ? Number.parseInt(fails, 10) : 0,
            locked_until: lockedTtl > 0 ? Math.floor(Date.now() / 1000) + lockedTtl : undefined,
          });
        }
      });
      stream.on('end', () => resolve(ips));
    });
  }

  async getLockedUsersCount(): Promise<{ total: number; by_tier: Record<number, number> }> {
    const stream = this.redis.scanStream({ match: 'lockout:user:*', count: 100 });
    const result = { total: 0, by_tier: { 1: 0, 2: 0, 3: 0, 4: 0 } as Record<number, number> };
    return new Promise((resolve) => {
      stream.on('data', async (keys: string[]) => {
        for (const key of keys) {
          const tierStr = await this.redis.hget(key, 'current_tier');
          const lockedUntil = await this.redis.hget(key, 'locked_until');
          if (lockedUntil && Number.parseInt(lockedUntil, 10) > Math.floor(Date.now() / 1000)) {
            result.total += 1;
            const tier = tierStr ? Number.parseInt(tierStr, 10) : 1;
            result.by_tier[tier] = (result.by_tier[tier] ?? 0) + 1;
          }
        }
      });
      stream.on('end', () => resolve(result));
    });
  }
}
```

## Annexe CC. Tests integration AdminUsersController (Sprint 27)

```typescript
describe('AdminUsersController E2E (Sprint 27 anticipation)', () => {
  let app: INestApplication;
  let superAdminToken: string;
  let analystToken: string;
  let regularUserToken: string;

  beforeAll(async () => {
    // Setup with seeded users
    superAdminToken = await getMfaVerifiedToken('super_admin@skalean.ma', AuthRole.SuperAdminPlatform);
    analystToken = await getMfaVerifiedToken('analyst@skalean.ma', AuthRole.AnalystSupport);
    regularUserToken = await getToken('broker@example.com', AuthRole.BrokerUser);
  });

  describe('POST /admin/users/:userId/unlock', () => {
    it('super_admin can unlock user', async () => {
      // Lock the user first
      const targetUser = 'u-target-uuid';
      for (let i = 0; i < 5; i += 1) {
        await request(app.getHttpServer()).post('/api/v1/auth/signin').send({
          email: 'target@example.com', password: 'wrong',
        });
      }

      const r = await request(app.getHttpServer())
        .post(`/api/v1/admin/users/${targetUser}/unlock`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ reason: 'User contacted support and verified identity', ticket_id: 'SUP-1234' });
      expect(r.status).toBe(200);
      expect(r.body.previous_state.locked).toBe(true);
      expect(r.body.previous_state.tier).toBeGreaterThanOrEqual(1);
    });

    it('analyst_support cannot unlock (insufficient role)', async () => {
      const r = await request(app.getHttpServer())
        .post('/api/v1/admin/users/u-target-uuid/unlock')
        .set('Authorization', `Bearer ${analystToken}`)
        .send({ reason: 'attempted analyst unlock' });
      expect(r.status).toBe(403);
      expect(r.body.code).toBe('INSUFFICIENT_ROLE');
    });

    it('regular user cannot unlock', async () => {
      const r = await request(app.getHttpServer())
        .post('/api/v1/admin/users/u-target-uuid/unlock')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({ reason: 'unauthorized attempt' });
      expect(r.status).toBe(403);
    });

    it('non-MFA-verified super_admin cannot unlock', async () => {
      const nonMfaToken = await getNonMfaToken('super_admin@skalean.ma');
      const r = await request(app.getHttpServer())
        .post('/api/v1/admin/users/u-target-uuid/unlock')
        .set('Authorization', `Bearer ${nonMfaToken}`)
        .send({ reason: 'no MFA' });
      expect(r.status).toBe(403);
      expect(r.body.code).toBe('MFA_REQUIRED');
    });

    it('unlock non-existent user returns 404', async () => {
      const r = await request(app.getHttpServer())
        .post('/api/v1/admin/users/non-existent-uuid/unlock')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ reason: 'test' });
      expect(r.status).toBe(404);
    });

    it('unlock with reason too short rejected', async () => {
      const r = await request(app.getHttpServer())
        .post('/api/v1/admin/users/u-target-uuid/unlock')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ reason: 'short' });
      expect(r.status).toBe(400);
    });

    it('audit log entry created on unlock', async () => {
      // Trigger unlock + query audit_log
      // Expect 'auth.lockout_cleared' row with by='manual'
    });

    it('Kafka event published on unlock', async () => {
      // Test consumer receives lockout_cleared event
    });

    it('email notification sent if notify_user=true', async () => {
      // Mailhog query
    });

    it('email NOT sent if notify_user=false', async () => {
      // Verify no email
    });
  });

  describe('GET /admin/users/:userId/lockout-status', () => {
    it('returns current lockout snapshot', async () => {
      const r = await request(app.getHttpServer())
        .get('/api/v1/admin/users/u-target/lockout-status')
        .set('Authorization', `Bearer ${superAdminToken}`);
      expect(r.body).toHaveProperty('locked');
      expect(r.body).toHaveProperty('current_tier');
      expect(r.body).toHaveProperty('failed_attempts');
    });

    it('analyst_support can read (read-only role)', async () => {
      const r = await request(app.getHttpServer())
        .get('/api/v1/admin/users/u-target/lockout-status')
        .set('Authorization', `Bearer ${analystToken}`);
      expect(r.status).toBe(200);
    });
  });

  describe('GET /admin/users/lockout-history', () => {
    it('returns paginated lockout history', async () => {
      const r = await request(app.getHttpServer())
        .get('/api/v1/admin/users/lockout-history?page=1&page_size=20')
        .set('Authorization', `Bearer ${superAdminToken}`);
      expect(r.body.items).toBeInstanceOf(Array);
      expect(r.body.total).toBeGreaterThanOrEqual(0);
    });

    it('filter by tenant_id works', async () => {
      const r = await request(app.getHttpServer())
        .get('/api/v1/admin/users/lockout-history?tenant_id=t-uuid')
        .set('Authorization', `Bearer ${superAdminToken}`);
      expect(r.status).toBe(200);
    });
  });

  describe('POST /admin/users/ip/:ip/unblock', () => {
    it('super_admin can unblock IP', async () => {
      // Trigger IP lock first (50 fails)
      const ip = '99.99.99.99';
      // ... 50 fails
      const r = await request(app.getHttpServer())
        .post(`/api/v1/admin/users/ip/${ip}/unblock`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ reason: 'False positive - corporate NAT' });
      expect(r.status).toBe(200);
    });
  });
});
```

## Annexe DD. Migration plan complete vers Atlas Cloud Sprint 35

### DD.1 Provisioning Atlas Redis cluster

```hcl
# infrastructure/terraform/atlas/redis-lockouts.tf
resource "atlas_redis_cluster" "lockouts" {
  cluster_id      = "skalean-lockouts-prod"
  region          = "ma-benguerir-1"  # DC1 primary
  dr_region       = "ma-tunis-1"      # DR
  node_type       = "atlas.redis.r2.large"
  num_replicas    = 2
  num_shards      = 3

  config {
    maxmemory_policy = "allkeys-lru"
    appendonly       = "yes"
    save             = "900 1 300 10 60 10000"
    timeout          = 300
    tcp_keepalive    = 60
  }

  security {
    encryption_at_rest = true
    encryption_at_rest_kms_key = atlas_kms_key.redis_encryption.arn
    tls_required       = true
    auth_token         = atlas_secret.redis_auth_token.arn
  }

  backup {
    enabled                = true
    retention_days         = 30
    backup_window          = "02:00-04:00"
    cross_region_replicate = true
  }

  monitoring {
    cloudwatch_logs_enabled = true
    detailed_metrics        = true
  }

  tags = {
    project     = "skalean-insurtech"
    environment = "production"
    sprint      = "5"
    component   = "lockout-service"
  }
}

resource "atlas_kms_key" "redis_encryption" {
  alias       = "redis-lockouts-encryption"
  description = "Encryption at rest for lockouts Redis cluster"
  region      = "ma-benguerir-1"

  rotation_policy {
    enabled              = true
    rotation_period_days = 365
  }

  audit {
    enabled       = true
    retention_days = 1825
  }
}
```

### DD.2 Postgres schema sync verification job

```typescript
// infrastructure/scripts/verify-lockout-columns.ts (Sprint 5 verification)
import { Pool } from 'pg';

async function verifyLockoutColumns() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  const requiredColumns = [
    'failed_login_attempts',
    'locked_until',
    'last_lockout_tier',
    'last_failed_login_at',
    'last_failed_login_ip',
  ];

  const result = await pool.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'auth_users'
      AND column_name = ANY($1)
  `, [requiredColumns]);

  const existingColumns = new Set(result.rows.map((r) => r.column_name));
  const missing = requiredColumns.filter((c) => !existingColumns.has(c));

  if (missing.length > 0) {
    console.error(`Missing columns in auth_users: ${missing.join(', ')}`);
    console.error(`Run migration : pnpm --filter @insurtech/database migrate:run`);
    process.exit(1);
  }

  // Verify indexes
  const indexResult = await pool.query(`
    SELECT indexname FROM pg_indexes WHERE tablename = 'auth_users'
  `);
  const indexes = new Set(indexResult.rows.map((r) => r.indexname));
  if (!indexes.has('idx_auth_users_locked')) {
    console.warn('Index idx_auth_users_locked missing -- performance degraded');
  }

  console.log('All lockout columns and indexes present');
  await pool.end();
}

verifyLockoutColumns().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

### DD.3 Performance baseline measurement script

```typescript
// infrastructure/scripts/lockout-bench.ts (Sprint 5 production validation)
import { performance } from 'node:perf_hooks';
import Redis from 'ioredis';
import { LockoutService } from '@insurtech/auth';

async function benchmarkLockout() {
  const redis = new Redis(process.env.REDIS_URL!);
  const lockoutService = createLockoutService(redis); // factory

  console.log('Lockout Service Benchmarks');
  console.log('==========================');

  // Bench recordFailedAttempt
  let totalDuration = 0;
  const iterations = 1000;
  for (let i = 0; i < iterations; i += 1) {
    const start = performance.now();
    await lockoutService.recordFailedAttempt({
      user_id: `bench-user-${i}`,
      ip: `192.168.${Math.floor(i / 256)}.${i % 256}`,
      email: `bench-${i}@example.com`,
    });
    totalDuration += performance.now() - start;
  }
  console.log(`recordFailedAttempt: ${(totalDuration / iterations).toFixed(2)} ms median`);

  // Bench isLocked
  totalDuration = 0;
  for (let i = 0; i < iterations; i += 1) {
    const start = performance.now();
    await lockoutService.isLocked(`bench-user-${i}`);
    totalDuration += performance.now() - start;
  }
  console.log(`isLocked: ${(totalDuration / iterations).toFixed(2)} ms median`);

  // Cleanup
  for (let i = 0; i < iterations; i += 1) {
    await redis.del(`lockout:user:bench-user-${i}`);
  }
  await redis.quit();
}

benchmarkLockout().catch(console.error);
```

---

**Fin du prompt task-2.1.10-lockout-service.md.**
