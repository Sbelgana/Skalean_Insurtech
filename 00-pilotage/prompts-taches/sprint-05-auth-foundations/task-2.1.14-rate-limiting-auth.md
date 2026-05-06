# TACHE 2.1.14 -- RateLimit Auth-Specifique : @Throttle Decorators sur Endpoints Sensibles + Custom Tracker IP+Email + Logs Pino

**Sprint** : 5 (Phase 2 / Sprint 1 dans phase) -- Auth Foundations
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-05-sprint-05-auth-foundations.md` (Tache 2.1.14)
**Phase** : 2 -- Securite & Multi-tenant
**Priorite** : P0 (bloquant pour 2.1.15 E2E tests rate limit, defense critique anti-bot et anti-DDoS)
**Effort** : 3h
**Dependances** : 2.1.13 (EmailService), 2.1.6 (AuthController endpoints), 2.1.10 (LockoutService complementaire), Sprint 3 (`@nestjs/throttler` global config), Sprint 5 Tache 2.1.5 (Redis DB 3 RATE_LIMIT)
**Densite cible** : 80-150 ko (auto-suffisant exhaustif)
**AUCUNE EMOJI AUTORISEE**

---

## 1. But

Cette tache vise a livrer la couche de rate limiting auth-specifique du programme Skalean InsurTech v2.2 qui complete la defense en profondeur deja amorcee par LockoutService Tache 2.1.10 (qui se declenche apres 5 tentatives ratees) en ajoutant une protection plus precoce et plus large, conforme aux exigences OWASP Application Security Verification Standard (ASVS) section 11 (Business Logic Security), NIST SP 800-63B section 5.2.2 (Rate Limiting), et ACAPS circulaire 2024 (defense bot et DDoS pour services critiques). Le perimetre couvre : l'application du decorator `@Throttle()` (fourni par `@nestjs/throttler` v6.4.0 deja installe Sprint 3) sur les 9 endpoints auth-sensibles avec des limites differenciees selon la criticite et le pattern de legitimite (POST /signin -- 5 req/min/IP defendant contre brute force passwords, POST /signup -- 3 req/heure/IP defendant contre spam de comptes fake, POST /forgot-password -- 3 req/heure/IP defendant contre spam de reset emails et enumeration, POST /resend-verification -- 3 req/heure/IP defendant contre spam emails verification, POST /reset-password -- 5 req/min/IP defendant contre brute force tokens recovery, POST /refresh -- 30 req/min/IP autorisant les refreshs frequents d'un client legitime qui peut faire plusieurs refresh par minute lors d'un usage intensif, POST /verify-mfa -- 5 req/min/IP defendant contre brute force codes TOTP, POST /setup-mfa -- 3 req/min/user defendant contre tentatives multiples setup, POST /confirm-mfa -- 5 req/min/user) ; un tracker custom `AuthThrottlerStorage` qui combine IP + email pour signin (defense contre le pattern attaquant qui utilise rotation IP via VPN pour maintenir > 5 attempts/min sur un meme email -- avec tracker IP+email, l'attaquant doit rotation BOTH IP et email simultanement, ce qui est exponentiellement plus difficile) ; un override pour les endpoints publics non-sensibles (`/me`, `/sessions`) qui consomment tres peu de ressources et ne necessitent pas de rate limiting agressif au-dela du throttle global Sprint 3 (100 req/min) ; un format d'erreur 429 standardise `{ code: 'RATE_LIMIT_EXCEEDED', message: 'Trop de requetes. Reessayez plus tard.', retry_after_seconds: N }` avec header HTTP `Retry-After: N` conforme RFC 6585 ; et des logs Pino structures `{ action: 'auth_rate_limit_hit', endpoint, ip, user_id, retry_after_seconds }` au niveau warn pour permettre la detection de patterns d'attaque par le SIEM Sprint 33.

L'apport est triple. Premierement, en differenciant les limites par endpoint selon le pattern de legitimite, on minimise les false positives qui frustreraient les utilisateurs legitimes : un courtier qui fait 10 refresh tokens par minute pendant qu'il navigue dans l'application est legitime (les access tokens 15 min expirent souvent quand il switch entre onglets), mais 10 signin par minute est suspect (un user humain ne se connecte pas 10 fois en 60 secondes). Cette granularite par endpoint est essentielle pour preserver l'UX. Deuxiemement, en utilisant un tracker IP+email pour signin, on ferme une faille classique des rate limits IP-only : un attaquant equipe d'un pool de 100 VPN IPs peut faire 5 attempts/min sur chaque IP = 500 attempts/min sur un email cible. Avec IP+email tracker, le pool de 100 VPN ne donne plus 100x boost car le compteur est calcule sur la combinaison -- pour faire 100 attempts/min sur un email, l'attaquant aurait besoin de 100 (IP, email) combinations differentes, et le LockoutService Tache 2.1.10 verrouillerait l'email apres 5 tentatives ratees. Troisiemement, en logguant chaque rate limit hit avec un payload structure consume par le SIEM Sprint 33, on alimente le systeme d'alerte qui peut detecter des patterns coordonnes (par exemple : si 50 IPs differentes hittent /signin en meme temps depuis un meme range AS-Number d'hebergeur cloud connu pour le bot traffic, c'est un signal d'attaque distribuee qui declenche un block CIDR au niveau firewall Sprint 35).

A l'issue de cette tache, l'API rejette avec HTTP 429 toute requete qui depasse les limites configurees (verifiable via test E2E qui fait 6 signin en 1 minute -- la 6e retourne 429), les utilisateurs legitimes peuvent continuer a utiliser l'application normalement (un refresh tous les 14 minutes est OK avec 30/min), les logs warn sont emis pour chaque hit rate limit avec correlation request_id pour trace dans Datadog, le header `Retry-After` est present sur les reponses 429, les endpoints publics non-sensibles (`/me`, `/sessions`) ne sont pas affectes par le rate limit auth-specifique, et la suite Vitest + Playwright couvre 15+ scenarios E2E avec coverage >= 88%.

---

## 2. Contexte etendu

### 2.1 Pourquoi cette tache existe

Sans rate limit auth-specifique, le programme est vulnerable a plusieurs classes d'attaques que LockoutService Tache 2.1.10 ne couvre pas :

(1) **Spam signup** : un attaquant cree massivement des comptes fake (bot signup) pour polluer la base, gonfler les metriques fake, ou tester des emails fuites. LockoutService ne protege pas (signup pas un signin). Rate limit /signup 3/h/IP bloque.

(2) **Spam recovery emails** : un attaquant cible un email connu et fait /forgot-password 1000 fois pour innondaire la victime de mails reset. Sans rate limit, LockoutService ne s'applique pas (forgot pas un signin). Rate limit /forgot-password 3/h bloque.

(3) **Reset token brute force** : un attaquant intercepte un email recovery (via leak Gmail) mais le token a une entropie de 256 bits, brute force impossible. Mais si Sprint 14 reduit l'entropie a 128 bits, il devient possible. Rate limit /reset-password 5/min protege en defense en profondeur.

(4) **DDoS distribuee** : 10000 IPs differentes hittent /signin avec credentials random. Pas de lockout user (chaque user a 5 attempts), pas d'IP lockout (50/IP), mais 10000 x 5 = 50000 attempts/min consomme massivement Argon2 (50000 x 250ms = 12500 seconds CPU/min = 200 cores saturees). Sans rate limit, l'API tombe. Avec rate limit 5/min/IP, l'attaquant doit aussi avoir 10000 IPs ce qui est plus rare.

(5) **MFA brute force** : sans rate limit /verify-mfa, un attaquant qui a vole un challenge_token et le password peut tester 1M combinations TOTP (10^6) en 5 minutes (~3000/sec). Rate limit 5/min limite a 5 attempts par window 30s TOTP = quasi impossible.

L'utilisation de @nestjs/throttler v6.4.0 (deja Sprint 3 setup) evite de reinventer la roue. La biblio supporte Redis storage (cluster Atlas Sprint 35) et custom trackers. Le pattern decorator est conforme aux conventions NestJS.

### 2.2 Alternatives considerees

| Alternative | Avantages | Inconvenients | Decision |
|-------------|-----------|---------------|----------|
| Pas de rate limit auth-specifique (juste global Sprint 3 100/min) | Simple | Vulnerable spam, brute force, DDoS | REJETE |
| Rate limit IP-only | Standard, simple | Bypass via VPN pool | REJETE -- complete par IP+email |
| Rate limit IP+email pour signin (RETENU) | Defense profondeur | Tracker custom complexe | RETENU |
| Rate limit user-id only | Simple | Pas de protection nouveaux users (sans user_id) | REJETE |
| Rate limit Redis-backed (RETENU via @nestjs/throttler) | Distribue, scalable | Dependance Redis | RETENU |
| Rate limit memory-only (express-rate-limit) | Simple, no deps | Pas distribue (multi-instance API) | REJETE |
| Cloudflare WAF rate limit | Geographic, sophistique | Vendor lock-in, sortie data, cost | REJETE Sprint 5, considera Sprint 35 |
| Custom tracker complex (geo + AS + behavior) | Sophistique | Sprint 14 ML detection plutot | DEFFERE |
| @Throttle decorator per endpoint (RETENU) | Granulaire, lisible | Verbeux | RETENU |

### 2.3 Trade-offs

Choisir 5/min/IP pour signin implique d'accepter que dans le rare cas d'un bureau entreprise NAT avec 100+ users derriere meme IP, le 6e signin du meme bureau dans la minute serait bloque. Trade-off acceptable : 5 signins/min depuis meme IP est suspect en pratique (les utilisateurs ne se loguent pas si frequemment). Sprint 14 considera tenant whitelist par CIDR.

Choisir 3/h pour signup et forgot-password implique un trade-off : un user legitime qui fait 3 erreurs (typo email + retry x3) sera bloque la 4e fois pendant 60 minutes. Acceptable car peu frequent. Frontend Sprint 4 affiche message clair "Trop de tentatives, attendez 1 heure ou contactez le support".

Choisir 30/min pour /refresh implique d'autoriser potentiellement un attaquant qui a vole un refresh token de faire 30 refresh/min. Mais le pattern token_family + replay detection Tache 2.1.4 invalide le refresh des le second usage. Donc 30/min est genereux mais securitairement OK.

### 2.4 Decisions strategiques

- decision-006 (No-emoji), decision-008 (Cloud souverain).
- OWASP ASVS section 11 (Business Logic).
- NIST SP 800-63B section 5.2.2.
- ACAPS circulaire 2024 (defense bot/DDoS).

### 2.5 Pieges techniques

1. **X-Forwarded-For spoofing** : reverse proxy doit etre trusted. Sprint 32 nginx config `set_real_ip_from`.
2. **NAT entreprise false positive** : Sprint 14 whitelist CIDR.
3. **Refresh token legit > 30/min** : monitor false positives.
4. **Rate limit pendant test E2E flaky** : reset Redis avant chaque test.
5. **@nestjs/throttler v6 changes from v5** : verifier compat.
6. **Custom tracker race condition** : Lua atomic.
7. **Logs auth_rate_limit_hit volume** : Sprint 33 dashboard pour detection.
8. **TTL window sliding vs fixed** : @nestjs/throttler default sliding.
9. **Memory eviction Redis** : maxmemory-policy preserve rate limit keys (TTL-based, deja short).
10. **Rate limit different per role** : Sprint 14 considera (broker_admin trusted plus genereux).
11. **API key bypass rate limit** : Sprint 31 sky-agent service tokens whitelist.
12. **Rate limit on health endpoints** : Skip via @SkipThrottle().

---

## 3. Architecture context

### 3.1 Position dans le sprint

Tache 2.1.14 livre la protection consommee par : 2.1.6/2.1.7/2.1.8/2.1.9/2.1.11/2.1.12 endpoints AuthController (decorators @Throttle ajoutes), 2.1.15 E2E tests rate limit.

### 3.2 Position dans le programme

- Sprint 14 : per-tenant rate limit override, captcha integration apres N rate limit hits.
- Sprint 31 : sky-agent service tokens whitelist.
- Sprint 33 : SIEM correlation rate limit hits cross-tenants pour detection coordonnee.
- Sprint 35 : Cloudflare WAF integration optionnel pour DDoS niveau reseau.

### 3.3 Diagramme

```
                +-----------------------------------+
                | Tache 2.1.13 termine               |
                +-----------------+------------------+
                                  |
                                  v
              +-------------------+--------------------+
              | TACHE 2.1.14 (cette tache)              |
              | @Throttle decorators on 9 endpoints     |
              | Custom AuthThrottlerGuard with IP+email |
              | tracker for signin                      |
              | Skip on @SkipThrottle endpoints         |
              | Redis DB 3 RATE_LIMIT                   |
              | Logs Pino auth_rate_limit_hit           |
              +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
                | | | | | | | | | | | | | | | |
                v v v v v v v v v v v v v v v v
             AuthController endpoints / Sprint 33 SIEM
```

---

## 4. Livrables checkables (22)

- [ ] Tracker `repo/apps/api/src/modules/auth/throttler/auth-throttler-storage.service.ts` -- ~120 lignes
- [ ] Guard `repo/apps/api/src/modules/auth/throttler/auth-throttler.guard.ts` -- ~80 lignes (custom tracker logic)
- [ ] Config `repo/apps/api/src/modules/auth/throttler/throttle-options.constant.ts` -- ~50 lignes (constants per endpoint)
- [ ] Mise a jour `auth.controller.ts` : @Throttle decorators sur 9 endpoints -- modification
- [ ] Mise a jour `auth.module.ts` : import ThrottlerModule + register custom guard -- modification
- [ ] Mise a jour `app.module.ts` : configure global ThrottlerGuard -- modification
- [ ] Variables env : RATE_LIMIT_REDIS_DB, etc.
- [ ] Tests `auth-throttler-storage.spec.ts` -- 6 tests -- ~120 lignes
- [ ] Tests `auth-throttler.guard.spec.ts` -- 4 tests -- ~80 lignes
- [ ] Tests E2E `auth-rate-limit.e2e-spec.ts` -- 12 scenarios -- ~300 lignes
- [ ] No-emoji
- [ ] No-console
- [ ] Coverage >= 88%
- [ ] Build TypeScript reussit
- [ ] Documentation JSDoc + Swagger
- [ ] Erreur 429 avec Retry-After header
- [ ] Logs warn sur chaque rate limit hit
- [ ] Skip rate limit pour /me, /sessions, /health
- [ ] Custom tracker IP+email pour /signin
- [ ] Limites differenciees per endpoint
- [ ] Redis distributed storage
- [ ] Tests reproductibles (Redis flush before each test)

---

## 5. Fichiers crees / modifies

```
repo/apps/api/src/modules/auth/throttler/auth-throttler-storage.service.ts        (~120 lignes)
repo/apps/api/src/modules/auth/throttler/auth-throttler.guard.ts                  (~80 lignes)
repo/apps/api/src/modules/auth/throttler/throttle-options.constant.ts             (~50 lignes)
repo/apps/api/src/modules/auth/auth.controller.ts                                 (modifie / +@Throttle decorators)
repo/apps/api/src/modules/auth/auth.module.ts                                     (modifie)
repo/apps/api/src/app.module.ts                                                   (modifie)
.env.example                                                                       (modifie / +RATE_LIMIT vars)
repo/apps/api/src/modules/auth/throttler/auth-throttler-storage.spec.ts            (~120 lignes)
repo/apps/api/src/modules/auth/throttler/auth-throttler.guard.spec.ts              (~80 lignes)
repo/apps/api/test/auth-rate-limit.e2e-spec.ts                                     (~300 lignes)
```

---

## 6. Code patterns COMPLETS

### 6.1 `throttle-options.constant.ts`

```typescript
/**
 * Auth-specific rate limit constants (Tache 2.1.14).
 * Reference : OWASP ASVS section 11, NIST SP 800-63B 5.2.2, ACAPS 2024.
 */

export const THROTTLE_AUTH = {
  signin: {
    short: { ttl: 60_000, limit: 5 },         // 5/minute
    medium: { ttl: 3_600_000, limit: 20 },    // 20/hour
  },
  signup: {
    short: { ttl: 60_000, limit: 1 },         // 1/minute (user thinks before submit)
    medium: { ttl: 3_600_000, limit: 3 },     // 3/hour
  },
  forgotPassword: {
    medium: { ttl: 3_600_000, limit: 3 },     // 3/hour per IP+email
  },
  resendVerification: {
    medium: { ttl: 3_600_000, limit: 3 },     // 3/hour
  },
  resetPassword: {
    short: { ttl: 60_000, limit: 5 },         // 5/minute
  },
  refresh: {
    short: { ttl: 60_000, limit: 30 },        // 30/minute (legitimate frequent)
  },
  verifyMfa: {
    short: { ttl: 60_000, limit: 5 },         // 5/minute defense brute force TOTP
  },
  setupMfa: {
    short: { ttl: 60_000, limit: 3 },
  },
  confirmMfa: {
    short: { ttl: 60_000, limit: 5 },
  },
  disableMfa: {
    short: { ttl: 60_000, limit: 3 },
  },
} as const;

export type ThrottleScope = keyof typeof THROTTLE_AUTH;
```

### 6.2 `auth-throttler-storage.service.ts`

```typescript
/**
 * Custom Redis-backed throttler storage with IP+email composite tracker for signin.
 *
 * Extends @nestjs/throttler default ThrottlerStorage to allow custom key strategy.
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import type { Redis } from 'ioredis';

@Injectable()
export class AuthThrottlerStorageService implements ThrottlerStorage {
  private readonly logger = new Logger(AuthThrottlerStorageService.name);

  constructor(@Inject('THROTTLER_REDIS') private readonly redis: Redis) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<{ totalHits: number; timeToExpire: number; isBlocked: boolean; timeToBlockExpire: number }> {
    const fullKey = `throttle:${throttlerName}:${key}`;
    const blockedKey = `${fullKey}:blocked`;

    // Check if currently blocked
    const blockedTtl = await this.redis.pttl(blockedKey);
    if (blockedTtl > 0) {
      return {
        totalHits: limit + 1,
        timeToExpire: blockedTtl,
        isBlocked: true,
        timeToBlockExpire: blockedTtl,
      };
    }

    // Increment counter
    const totalHits = await this.redis.incr(fullKey);
    if (totalHits === 1) {
      await this.redis.pexpire(fullKey, ttl);
    }

    const timeToExpire = await this.redis.pttl(fullKey);

    if (totalHits > limit) {
      // Set block key for blockDuration
      if (blockDuration > 0) {
        await this.redis.set(blockedKey, '1', 'PX', blockDuration);
      }
      this.logger.warn({
        action: 'auth_rate_limit_hit',
        throttler: throttlerName,
        key,
        total_hits: totalHits,
        limit,
        time_to_expire_ms: timeToExpire,
      });
      return {
        totalHits,
        timeToExpire,
        isBlocked: true,
        timeToBlockExpire: blockDuration > 0 ? blockDuration : timeToExpire,
      };
    }

    return {
      totalHits,
      timeToExpire,
      isBlocked: false,
      timeToBlockExpire: 0,
    };
  }
}
```

### 6.3 `auth-throttler.guard.ts`

```typescript
/**
 * Custom ThrottlerGuard with IP+email composite tracker for /signin.
 *
 * Other endpoints fall back to IP-only tracker (default).
 */

import { Injectable, type ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';

@Injectable()
export class AuthThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Request): Promise<string> {
    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ?? req.socket?.remoteAddress ?? 'unknown');

    // For /signin endpoint, combine IP with email from body
    const url = req.url ?? '';
    if (url.includes('/auth/signin') || url.includes('/auth/forgot-password') || url.includes('/auth/resend-verification')) {
      const email = (req.body?.email ?? '').toString().trim().toLowerCase();
      if (email) {
        return `${ip}:${email}`;
      }
    }

    return ip;
  }

  protected async throwThrottlingException(context: ExecutionContext): Promise<void> {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();
    const tracker = await this.getTracker(req);
    res.header('Retry-After', '60');
    res.status(429).json({
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please try again later.',
      retry_after_seconds: 60,
      tracker_hash: this.maskTracker(tracker),
    });
  }

  private maskTracker(tracker: string): string {
    // For logs : hash tracker to avoid leaking IP+email
    const [ip, email] = tracker.split(':');
    if (email) {
      const [local, domain] = email.split('@');
      return `${ip}:${local?.[0] ?? '?'}***@${domain ?? '?'}`;
    }
    return ip;
  }
}
```

### 6.4 `auth.controller.ts` (modifications avec @Throttle)

```typescript
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { THROTTLE_AUTH } from './throttler/throttle-options.constant.js';

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  // ... existing constructor

  @Public()
  @Post('signin')
  @Throttle({
    short: THROTTLE_AUTH.signin.short,
    medium: THROTTLE_AUTH.signin.medium,
  })
  @HttpCode(HttpStatus.OK)
  async signin(@Body() body: SigninDto, @Req() req: Request) {
    // ... existing
  }

  @Public()
  @Post('signup')
  @Throttle({
    short: THROTTLE_AUTH.signup.short,
    medium: THROTTLE_AUTH.signup.medium,
  })
  @HttpCode(HttpStatus.OK)
  async signup(@Body() body: SignupDto, @Req() req: Request) {
    // ... existing
  }

  @Public()
  @Post('forgot-password')
  @Throttle({
    medium: THROTTLE_AUTH.forgotPassword.medium,
  })
  async forgotPassword(@Body() body: ForgotPasswordDto, @Req() req: Request) { /* ... */ }

  @Public()
  @Post('resend-verification')
  @Throttle({
    medium: THROTTLE_AUTH.resendVerification.medium,
  })
  async resendVerification(@Body() body: ResendVerificationDto, @Req() req: Request) { /* ... */ }

  @Public()
  @Post('reset-password')
  @Throttle({ short: THROTTLE_AUTH.resetPassword.short })
  async resetPassword(@Body() body: ResetPasswordDto, @Req() req: Request) { /* ... */ }

  @Public()
  @Post('refresh')
  @Throttle({ short: THROTTLE_AUTH.refresh.short })
  async refresh(@Body() body: RefreshDto, @Req() req: Request) { /* ... */ }

  @Public()
  @Post('verify-mfa')
  @Throttle({ short: THROTTLE_AUTH.verifyMfa.short })
  async verifyMfa(@Body() body: VerifyMfaDto, @Req() req: Request) { /* ... */ }

  @Post('setup-mfa')
  @Throttle({ short: THROTTLE_AUTH.setupMfa.short })
  async setupMfa(@CurrentAuth() auth: AuthContext) { /* ... */ }

  @Post('confirm-mfa')
  @Throttle({ short: THROTTLE_AUTH.confirmMfa.short })
  async confirmMfa(@CurrentAuth() auth: AuthContext, @Body() body: ConfirmMfaDto) { /* ... */ }

  @Post('disable-mfa')
  @Throttle({ short: THROTTLE_AUTH.disableMfa.short })
  async disableMfa(@CurrentAuth() auth: AuthContext, @Body() body: DisableMfaDto) { /* ... */ }

  // No throttle on /me and /sessions (light endpoints)
  @Get('me')
  @SkipThrottle()
  async me(@CurrentAuth() auth: AuthContext) { /* ... */ }

  @Get('sessions')
  @SkipThrottle()
  async sessions(@CurrentAuth() auth: AuthContext) { /* ... */ }

  @Post('signout')
  @SkipThrottle()
  async signout(@CurrentAuth() auth: AuthContext) { /* ... */ }
}
```

### 6.5 Mise a jour `auth.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { ThrottlerModule, ThrottlerStorage } from '@nestjs/throttler';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { APP_GUARD } from '@nestjs/core';
import { AuthThrottlerGuard } from './throttler/auth-throttler.guard.js';
import { AuthThrottlerStorageService } from './throttler/auth-throttler-storage.service.js';

@Module({
  imports: [
    AuthSharedModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    UserModule,
    TypeOrmModule.forFeature([AuthEmailVerificationEntity, AuthPasswordRecoveryEntity, AuditLogEntity]),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService, AuthThrottlerStorageService],
      useFactory: (config: ConfigService, storage: AuthThrottlerStorageService) => ({
        throttlers: [
          { name: 'short', ttl: 60_000, limit: 100 },   // global short fallback
          { name: 'medium', ttl: 3_600_000, limit: 1000 }, // global medium fallback
        ],
        storage,
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService, JwtStrategy,
    {
      provide: 'THROTTLER_REDIS',
      inject: [ConfigService],
      useFactory: (config: ConfigService) => new Redis({
        host: config.get<string>('REDIS_HOST') ?? 'localhost',
        port: Number.parseInt(config.get<string>('REDIS_PORT') ?? '6379', 10),
        db: Number.parseInt(config.get<string>('REDIS_RATE_LIMIT_DB') ?? '3', 10),
        password: config.get<string>('REDIS_PASSWORD'),
      }),
    },
    AuthThrottlerStorageService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: MfaRequiredGuard },
    { provide: APP_GUARD, useClass: AuthThrottlerGuard },
    EmailVerificationRepository, PasswordRecoveryRepository, AuditLogRepository,
    EmailService, AuditAuthService,
  ],
  exports: [AuthService, AuditAuthService],
})
export class AuthModule {}
```

---

## 7. Tests complets

### 7.1 Tests `auth-throttler-storage.spec.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import RedisMock from 'ioredis-mock';
import { AuthThrottlerStorageService } from './auth-throttler-storage.service.js';

describe('AuthThrottlerStorageService', () => {
  let service: AuthThrottlerStorageService;
  let redis: any;

  beforeEach(() => {
    redis = new RedisMock();
    service = new AuthThrottlerStorageService(redis);
  });

  it('first hit returns totalHits=1, isBlocked=false', async () => {
    const r = await service.increment('user:test', 60000, 5, 0, 'short');
    expect(r.totalHits).toBe(1);
    expect(r.isBlocked).toBe(false);
  });

  it('5 hits within limit return isBlocked=false', async () => {
    for (let i = 1; i <= 5; i += 1) {
      const r = await service.increment('user:test', 60000, 5, 0, 'short');
      expect(r.isBlocked).toBe(false);
    }
  });

  it('6th hit exceeds limit, isBlocked=true', async () => {
    for (let i = 1; i <= 5; i += 1) {
      await service.increment('user:test', 60000, 5, 0, 'short');
    }
    const r = await service.increment('user:test', 60000, 5, 0, 'short');
    expect(r.isBlocked).toBe(true);
    expect(r.totalHits).toBeGreaterThan(5);
  });

  it('different keys are independent', async () => {
    for (let i = 1; i <= 5; i += 1) {
      await service.increment('user:A', 60000, 5, 0, 'short');
    }
    const r = await service.increment('user:B', 60000, 5, 0, 'short');
    expect(r.isBlocked).toBe(false);
  });

  it('TTL set on first increment', async () => {
    await service.increment('user:ttl', 60000, 5, 0, 'short');
    const ttl = await redis.pttl('throttle:short:user:ttl');
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(60000);
  });

  it('block duration sets blocked key', async () => {
    for (let i = 1; i <= 6; i += 1) {
      await service.increment('user:block', 60000, 5, 30000, 'short');
    }
    const blockedTtl = await redis.pttl('throttle:short:user:block:blocked');
    expect(blockedTtl).toBeGreaterThan(0);
  });
});
```

### 7.2 Tests E2E `auth-rate-limit.e2e-spec.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';

describe('Auth Rate Limit E2E', () => {
  let app: INestApplication;
  let redis: any;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    redis = app.get('THROTTLER_REDIS');
  });

  afterAll(async () => { await app.close(); });

  beforeEach(async () => {
    // Flush rate limit keys before each test
    const keys = await redis.keys('throttle:*');
    if (keys.length > 0) await redis.del(...keys);
  });

  it('signin : 5 attempts within 1 min are allowed, 6th returns 429', async () => {
    for (let i = 1; i <= 5; i += 1) {
      const r = await request(app.getHttpServer())
        .post('/api/v1/auth/signin')
        .set('X-Forwarded-For', '1.1.1.1')
        .send({ email: 'rate-limit-test@example.com', password: 'wrong' });
      expect(r.status).toBe(401); // wrong password but allowed by throttle
    }
    const r6 = await request(app.getHttpServer())
      .post('/api/v1/auth/signin')
      .set('X-Forwarded-For', '1.1.1.1')
      .send({ email: 'rate-limit-test@example.com', password: 'wrong' });
    expect(r6.status).toBe(429);
    expect(r6.body.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(r6.headers['retry-after']).toBeDefined();
    expect(r6.body.retry_after_seconds).toBeGreaterThan(0);
  });

  it('signin : different IPs are tracked independently', async () => {
    for (let i = 1; i <= 5; i += 1) {
      await request(app.getHttpServer())
        .post('/api/v1/auth/signin')
        .set('X-Forwarded-For', '1.1.1.1')
        .send({ email: 'multi-ip@example.com', password: 'wrong' });
    }
    const rOtherIp = await request(app.getHttpServer())
      .post('/api/v1/auth/signin')
      .set('X-Forwarded-For', '2.2.2.2')
      .send({ email: 'multi-ip@example.com', password: 'wrong' });
    expect(rOtherIp.status).toBe(401);
  });

  it('signin : same IP different emails are tracked independently (IP+email composite)', async () => {
    for (let i = 1; i <= 5; i += 1) {
      await request(app.getHttpServer())
        .post('/api/v1/auth/signin')
        .set('X-Forwarded-For', '3.3.3.3')
        .send({ email: 'user-a@example.com', password: 'wrong' });
    }
    const rDifferentEmail = await request(app.getHttpServer())
      .post('/api/v1/auth/signin')
      .set('X-Forwarded-For', '3.3.3.3')
      .send({ email: 'user-b@example.com', password: 'wrong' });
    // With IP+email composite tracker, user-b is independent of user-a
    expect(rDifferentEmail.status).toBe(401);
  });

  it('signup : 1 per minute, 2nd within 1 min returns 429', async () => {
    const ip = '4.4.4.4';
    const r1 = await request(app.getHttpServer())
      .post('/api/v1/auth/signup')
      .set('X-Forwarded-For', ip)
      .send({ email: 'first@example.com', password: 'StrongP@ss123!', display_name: 'F', locale: 'fr-MA', accepted_tos: true });
    expect(r1.status).toBe(200);

    const r2 = await request(app.getHttpServer())
      .post('/api/v1/auth/signup')
      .set('X-Forwarded-For', ip)
      .send({ email: 'second@example.com', password: 'StrongP@ss123!', display_name: 'S', locale: 'fr-MA', accepted_tos: true });
    expect(r2.status).toBe(429);
  });

  it('forgot-password : 3 per hour, 4th returns 429', async () => {
    const ip = '5.5.5.5';
    for (let i = 1; i <= 3; i += 1) {
      await request(app.getHttpServer())
        .post('/api/v1/auth/forgot-password')
        .set('X-Forwarded-For', ip)
        .send({ email: `forgot-${i}@example.com` });
    }
    const r4 = await request(app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .set('X-Forwarded-For', ip)
      .send({ email: 'forgot-4@example.com' });
    expect(r4.status).toBe(429);
  });

  it('refresh : 30/min allowed', async () => {
    const ip = '6.6.6.6';
    let success = 0;
    for (let i = 1; i <= 30; i += 1) {
      const r = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('X-Forwarded-For', ip)
        .send({ refresh_token: 'invalid-but-not-rate-limited' });
      if (r.status !== 429) success += 1;
    }
    expect(success).toBe(30);

    const r31 = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('X-Forwarded-For', ip)
      .send({ refresh_token: 'invalid' });
    expect(r31.status).toBe(429);
  });

  it('me : skip throttle (no rate limit)', async () => {
    const token = await getValidAccessToken();
    let success = 0;
    for (let i = 1; i <= 200; i += 1) {
      const r = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);
      if (r.status === 200) success += 1;
    }
    expect(success).toBe(200);
  });

  it('Retry-After header set on 429', async () => {
    for (let i = 1; i <= 6; i += 1) {
      await request(app.getHttpServer())
        .post('/api/v1/auth/signin')
        .set('X-Forwarded-For', '7.7.7.7')
        .send({ email: 'retry-test@example.com', password: 'wrong' });
    }
    const r = await request(app.getHttpServer())
      .post('/api/v1/auth/signin')
      .set('X-Forwarded-For', '7.7.7.7')
      .send({ email: 'retry-test@example.com', password: 'wrong' });
    expect(r.status).toBe(429);
    expect(r.headers['retry-after']).toBeDefined();
    expect(parseInt(r.headers['retry-after'], 10)).toBeGreaterThan(0);
  });

  it('reset-password : 5 per minute, 6th returns 429', async () => {
    const ip = '8.8.8.8';
    for (let i = 1; i <= 5; i += 1) {
      await request(app.getHttpServer())
        .post('/api/v1/auth/reset-password')
        .set('X-Forwarded-For', ip)
        .send({ token: `bad-token-${i}`, new_password: 'NewStrongP@ss123!' });
    }
    const r6 = await request(app.getHttpServer())
      .post('/api/v1/auth/reset-password')
      .set('X-Forwarded-For', ip)
      .send({ token: 'bad-token-6', new_password: 'NewStrongP@ss123!' });
    expect(r6.status).toBe(429);
  });

  it('verify-mfa : 5 per minute, 6th returns 429', async () => {
    const ip = '9.9.9.9';
    for (let i = 1; i <= 5; i += 1) {
      await request(app.getHttpServer())
        .post('/api/v1/auth/verify-mfa')
        .set('X-Forwarded-For', ip)
        .send({ challenge_token: `bad-${i}`, totp_code: '000000' });
    }
    const r6 = await request(app.getHttpServer())
      .post('/api/v1/auth/verify-mfa')
      .set('X-Forwarded-For', ip)
      .send({ challenge_token: 'bad-6', totp_code: '000000' });
    expect(r6.status).toBe(429);
  });

  it('rate limit window slides : after expiry, counter resets', async () => {
    // This test requires waiting 60+ seconds OR using fake timers
    // Skipped in default suite, run with INTEGRATION_SLOW=1
  });

  it('logs warn emit on rate limit hit', async () => {
    // Verify via log capture mechanism (Pino test transport)
  });

  it('rate limit logs include masked tracker', async () => {
    // Verify log payload structure
  });
});
```

---

## 8. Variables environnement

```env
# Sprint 5 Tache 2.1.14 -- RateLimit auth-specifique
REDIS_RATE_LIMIT_DB=3
RATE_LIMIT_GLOBAL_TTL_MS=60000
RATE_LIMIT_GLOBAL_LIMIT=100
```

---

## 9. Commandes shell

```bash
cd repo
pnpm --filter @insurtech/api typecheck
pnpm --filter @insurtech/api lint:check
pnpm --filter @insurtech/api test
pnpm --filter @insurtech/api test:e2e
pnpm --filter @insurtech/api build
```

---

## 10. Criteres validation V1-V25

### P0 (16)

- V1-V3 : typecheck, build, tests pass.
- V4 : 6e signin / 1 min retourne 429.
- V5 : 4e signup / 1 heure retourne 429.
- V6 : 4e forgot-password / 1 heure retourne 429.
- V7 : 6e reset-password / 1 min retourne 429.
- V8 : 31e refresh / 1 min retourne 429.
- V9 : 6e verify-mfa / 1 min retourne 429.
- V10 : Header Retry-After present sur 429.
- V11 : Body 429 avec code RATE_LIMIT_EXCEEDED + retry_after_seconds.
- V12 : Custom tracker IP+email pour signin.
- V13 : @SkipThrottle sur /me, /sessions, /signout.
- V14 : Logs warn emit avec action 'auth_rate_limit_hit'.
- V15 : Tracker masque dans logs (pas IP+email full).
- V16 : Different IPs tracked independently.

### P1 (6)

- V17 : Coverage >= 88%.
- V18 : No-emoji.
- V19 : No-console.
- V20 : OpenAPI Swagger 429 response documented.
- V21 : E2E tests 12+ scenarios passent.
- V22 : Redis DB 3 isolated from other DBs.

### P2 (3)

- V23 : Sprint 14 captcha hooks prepared.
- V24 : Sprint 14 per-tenant override hooks prepared.
- V25 : Documentation rate limit constants centralisee.

---

## 11. Edge cases (12)

1. **X-Forwarded-For spoof** : Sprint 32 nginx config trusted.
2. **NAT entreprise NAT** : Sprint 14 whitelist CIDR.
3. **Refresh > 30/min legit** : monitor false positives.
4. **Test E2E flaky timing** : flush Redis avant chaque test.
5. **API key bypass** : Sprint 31 sky-agent whitelist.
6. **IPv6 vs IPv4 same user** : tracker different.
7. **Tor multiple exit nodes** : Sprint 33 block list.
8. **Health endpoint /health rate limited** : @SkipThrottle().
9. **Internal services calling auth** : whitelist by service token.
10. **Long polling endpoints** : Sprint 17 considera special handling.
11. **OPTIONS preflight CORS** : skip rate limit (browser).
12. **Static assets** : skip rate limit.

---

## 12. Conformite Maroc

- ACAPS circulaire 2024 : defense bot/DDoS pour services critiques.
- OWASP ASVS section 11 : Business Logic Security.
- NIST SP 800-63B 5.2.2 : Rate Limiting.
- Loi 09-08 article 23 : protection contre access non autorise via brute force.

---

## 13. Conventions absolues

Multi-tenant : tenant_id pas dans tracker (anti-abuse cross-tenant). Validation : indirecte via NestJS. Logger Pino warn. pnpm. TS strict. Tests 15+. Skalean AI : aucun. No-emoji. Idempotency : non applicable (rate limit). Cloud souverain. Performance : Redis lookup < 1ms.

---

## 14. Validation pre-commit

```bash
cd repo
pnpm --filter @insurtech/api typecheck
pnpm --filter @insurtech/api lint:check
pnpm --filter @insurtech/api test
pnpm --filter @insurtech/api test:e2e

grep -rP "[\x{1F300}-\x{1F9FF}]" apps/api/src && exit 1 || echo OK
grep -rn "console\.log" apps/api/src --include="*.ts" && exit 1 || echo OK
```

---

## 15. Commit message

```bash
git add -A
git commit -m "feat(sprint-05): implement auth-specific rate limiting with @Throttle decorators

Implements granular rate limiting on 9 auth-sensitive endpoints with
differentiated limits (signin 5/min, signup 3/h, forgot-password 3/h,
refresh 30/min, verify-mfa 5/min, etc.). Custom AuthThrottlerGuard
combines IP+email composite tracker for signin to defend against
distributed brute force via VPN pool. Redis DB 3 backend. Skip
throttle on light endpoints (me, sessions, signout). 429 response
with Retry-After header. Logs warn on rate limit hit for SIEM
correlation Sprint 33.

Livrables :
- AuthThrottlerStorageService (Redis-backed with block duration)
- AuthThrottlerGuard (custom IP+email tracker)
- THROTTLE_AUTH constants (per-endpoint limits)
- @Throttle decorators on 9 auth endpoints
- @SkipThrottle on light endpoints
- 15+ tests (unit + E2E)

Tests : 6 storage + 4 guard + 12 E2E
Coverage : >= 88%

Task: 2.1.14
Sprint: 5 (Phase 2 / Sprint 1)
Reference: B-05 Tache 2.1.14
Decisions: OWASP ASVS 11, NIST SP 800-63B 5.2.2, ACAPS 2024"
```

---

## 16. Workflow next step

Apres commit, passer a `task-2.1.15-e2e-tests.md` qui livrera la suite Playwright E2E exhaustive 15+ scenarios pour valider tous les flows auth en bout-en-bout.

---

## Annexe A. Patterns Sprint 14 captcha apres N rate hits

Sprint 14 ajoutera detection abus + captcha :

```typescript
// Sprint 14 : track rate limit hits per IP cumulative
@Injectable()
export class AbuseDetectionService {
  async onRateLimitHit(ip: string, endpoint: string): Promise<void> {
    const key = `abuse:hits:${ip}`;
    const hits = await this.redis.incr(key);
    if (hits === 1) await this.redis.expire(key, 3600); // 1 hour window

    if (hits >= 10) {
      // Trigger captcha requirement
      await this.redis.set(`abuse:captcha:${ip}`, '1', 'EX', 3600);
    }
    if (hits >= 50) {
      // Trigger temporary firewall block
      await this.firewallService.blockIp(ip, '1 hour');
    }
  }
}
```

## Annexe B. Sprint 33 SIEM correlation

Sprint 33 SecurityIncidentService consume `auth_rate_limit_hit` logs et detecte patterns coordonnes :

```typescript
// Sprint 33 : detect coordinated bot attack
async detectCoordinatedAttack(): Promise<void> {
  const recentHits = await this.queryLogs({
    action: 'auth_rate_limit_hit',
    window: '5 minutes',
  });
  // Group by AS Number (Autonomous System)
  const byAs = groupBy(recentHits, (h) => this.geoIp.lookupAs(h.ip));
  for (const [asNumber, hits] of Object.entries(byAs)) {
    if (hits.length >= 100) {
      // 100+ hits from same AS in 5 min -- bot attack
      await this.firewallService.blockAs(asNumber, '1 hour');
      await this.notifySecurityTeam({
        signal: 'coordinated_bot_attack',
        as_number: asNumber,
        hits_count: hits.length,
      });
    }
  }
}
```

## Annexe C. Performance benchmarks attendus

```
AuthThrottlerStorageService.increment:  median 0.5 ms (p99: 2 ms)  -- Redis INCR
AuthThrottlerGuard.canActivate:         median 0.8 ms (p99: 3 ms)  -- include tracker compute
Total overhead per request:             median 1 ms   (p99: 4 ms)  -- negligible vs Argon2 dominant
```

---

## Annexe D. Sprint 14 captcha integration complete

Sprint 14 introduira reCAPTCHA v3 invisible apres N rate limit hits ou apres N signin failures. Implementation complete anticipee :

```typescript
// Sprint 14 : repo/apps/api/src/modules/security/captcha.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface CaptchaVerificationResult {
  success: boolean;
  score: number;
  action: string;
  hostname: string;
  challenge_ts: string;
  error_codes?: string[];
}

@Injectable()
export class CaptchaService {
  private readonly logger = new Logger(CaptchaService.name);
  private readonly secretKey: string;
  private readonly minScore: number;
  private readonly verifyUrl = 'https://www.google.com/recaptcha/api/siteverify';

  constructor(private readonly config: ConfigService) {
    this.secretKey = this.config.get<string>('RECAPTCHA_SECRET_KEY') ?? '';
    this.minScore = Number.parseFloat(this.config.get<string>('RECAPTCHA_MIN_SCORE') ?? '0.5');
  }

  async verify(token: string, expectedAction: string, remoteIp?: string): Promise<CaptchaVerificationResult> {
    if (!this.secretKey) {
      this.logger.warn('CaptchaService: RECAPTCHA_SECRET_KEY not configured -- bypassing verification');
      return { success: true, score: 1.0, action: expectedAction, hostname: '', challenge_ts: new Date().toISOString() };
    }

    const params = new URLSearchParams({
      secret: this.secretKey,
      response: token,
    });
    if (remoteIp) params.append('remoteip', remoteIp);

    try {
      const response = await fetch(this.verifyUrl, {
        method: 'POST',
        body: params,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      const result = await response.json() as CaptchaVerificationResult;

      if (!result.success) {
        this.logger.warn({
          action: 'captcha_verify_failed',
          error_codes: result.error_codes,
          remote_ip: remoteIp,
        });
        return result;
      }

      if (result.action !== expectedAction) {
        this.logger.warn({
          action: 'captcha_action_mismatch',
          expected: expectedAction,
          actual: result.action,
        });
        return { ...result, success: false };
      }

      if (result.score < this.minScore) {
        this.logger.warn({
          action: 'captcha_low_score',
          score: result.score,
          min_score: this.minScore,
          remote_ip: remoteIp,
        });
        return { ...result, success: false };
      }

      return result;
    } catch (err) {
      this.logger.error({
        err: err instanceof Error ? err.message : String(err),
        action: 'captcha_verify_error',
      });
      return {
        success: false,
        score: 0,
        action: expectedAction,
        hostname: '',
        challenge_ts: new Date().toISOString(),
        error_codes: ['network_error'],
      };
    }
  }
}
```

```typescript
// Sprint 14 : @RequireCaptcha decorator
import { SetMetadata } from '@nestjs/common';

export const REQUIRE_CAPTCHA_KEY = 'requireCaptcha';
export interface RequireCaptchaOptions {
  action: string;
  required: boolean | 'after_rate_limit_hits';
  threshold?: number;
}

export const RequireCaptcha = (options: RequireCaptchaOptions) =>
  SetMetadata(REQUIRE_CAPTCHA_KEY, options);
```

```typescript
// Sprint 14 : CaptchaGuard chained after AuthThrottlerGuard
@Injectable()
export class CaptchaGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly captchaService: CaptchaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.getAllAndOverride<RequireCaptchaOptions>(REQUIRE_CAPTCHA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!options) return true;

    const req = context.switchToHttp().getRequest();
    const captchaToken = req.body?.captcha_token ?? req.headers['x-captcha-token'];

    if (!captchaToken) {
      throw new BadRequestException({ code: 'CAPTCHA_REQUIRED', message: 'Captcha verification required' });
    }

    const ip = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ?? req.socket?.remoteAddress;
    const result = await this.captchaService.verify(captchaToken, options.action, ip);
    if (!result.success) {
      throw new BadRequestException({
        code: 'CAPTCHA_FAILED',
        message: 'Captcha verification failed',
        score: result.score,
      });
    }

    return true;
  }
}
```

Application sur endpoints sensibles Sprint 14 :

```typescript
// Sprint 14 : update auth.controller.ts
@Public()
@Post('signup')
@Throttle({ short: THROTTLE_AUTH.signup.short, medium: THROTTLE_AUTH.signup.medium })
@RequireCaptcha({ action: 'signup', required: true })
@HttpCode(HttpStatus.OK)
async signup(@Body() body: SignupDto, @Req() req: Request) {
  // captcha_token in body or x-captcha-token header verified by CaptchaGuard before controller
  // ... signup logic
}

@Public()
@Post('signin')
@Throttle({ short: THROTTLE_AUTH.signin.short })
@RequireCaptcha({ action: 'signin', required: 'after_rate_limit_hits', threshold: 3 })
@HttpCode(HttpStatus.OK)
async signin(@Body() body: SigninDto, @Req() req: Request) {
  // ...
}
```

## Annexe E. SIEM correlation patterns Sprint 33

Sprint 33 SecurityIncidentService consume les logs `auth_rate_limit_hit` pour detecter patterns coordonnes. Implementation complete anticipee :

```typescript
// Sprint 33 : repo/apps/api/src/modules/security/coordinated-attack-detector.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

interface RateLimitHit {
  endpoint: string;
  ip: string;
  user_id?: string;
  email_masked?: string;
  timestamp: number;
  retry_after_seconds: number;
}

interface AttackSignal {
  signal_type: 'distributed_brute_force' | 'credential_stuffing' | 'tor_swarm' | 'asn_concentration';
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: Record<string, unknown>;
}

@Injectable()
export class CoordinatedAttackDetector {
  private readonly logger = new Logger(CoordinatedAttackDetector.name);
  private readonly recentHits: RateLimitHit[] = [];
  private readonly MAX_BUFFER = 10000;

  constructor(
    private readonly geoIp: GeoIpService,
    private readonly firewallService: FirewallService,
    private readonly cnpdNotification: CnpdNotificationService,
  ) {}

  recordHit(hit: RateLimitHit): void {
    this.recentHits.push(hit);
    while (this.recentHits.length > this.MAX_BUFFER) this.recentHits.shift();
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async analyze(): Promise<void> {
    const now = Date.now();
    const fiveMinAgo = now - 5 * 60 * 1000;
    const recentWindow = this.recentHits.filter((h) => h.timestamp >= fiveMinAgo);

    if (recentWindow.length < 50) return; // not enough volume to suspect coordinated attack

    const signals: AttackSignal[] = [];

    // Pattern 1 : Distributed brute force (many IPs, one endpoint)
    const byEndpoint = this.groupBy(recentWindow, (h) => h.endpoint);
    for (const [endpoint, hits] of Object.entries(byEndpoint)) {
      const uniqueIps = new Set(hits.map((h) => h.ip));
      if (hits.length > 200 && uniqueIps.size > 50) {
        signals.push({
          signal_type: 'distributed_brute_force',
          severity: 'high',
          details: { endpoint, hits_count: hits.length, unique_ips: uniqueIps.size },
        });
      }
    }

    // Pattern 2 : ASN concentration (botnet hosted on cloud provider)
    const asnGroups = await this.groupByAsn(recentWindow);
    for (const [asn, hits] of Object.entries(asnGroups)) {
      if (hits.length > 100 && this.isCloudHostingAsn(asn)) {
        signals.push({
          signal_type: 'asn_concentration',
          severity: 'critical',
          details: { asn, hits_count: hits.length },
        });
        await this.firewallService.blockAsn(asn, 3600);
      }
    }

    // Pattern 3 : Tor swarm (multiple Tor exit nodes)
    const torIps = recentWindow.filter((h) => this.geoIp.isTorExitNode(h.ip));
    if (torIps.length > 30) {
      signals.push({
        signal_type: 'tor_swarm',
        severity: 'high',
        details: { tor_hits_count: torIps.length, unique_exits: new Set(torIps.map((h) => h.ip)).size },
      });
    }

    // Pattern 4 : Credential stuffing (many emails on same endpoint)
    if (byEndpoint['/api/v1/auth/signin']) {
      const signinHits = byEndpoint['/api/v1/auth/signin'];
      const uniqueEmails = new Set(signinHits.map((h) => h.email_masked).filter(Boolean));
      if (uniqueEmails.size > 100 && signinHits.length / uniqueEmails.size > 1.5) {
        signals.push({
          signal_type: 'credential_stuffing',
          severity: 'high',
          details: { unique_emails: uniqueEmails.size, total_attempts: signinHits.length },
        });
      }
    }

    // Trigger alerts
    for (const signal of signals) {
      await this.handleSignal(signal);
    }
  }

  private async handleSignal(signal: AttackSignal): Promise<void> {
    this.logger.warn({
      action: 'coordinated_attack_detected',
      signal: signal.signal_type,
      severity: signal.severity,
      details: signal.details,
    });

    if (signal.severity === 'critical') {
      // Notify security team via PagerDuty
      // Sprint 14 PagerDuty integration
    }

    // Schedule CNDP notification 72h if user data potentially compromised
    if (signal.signal_type === 'credential_stuffing') {
      await this.cnpdNotification.scheduleNotification({
        breach_type: 'credential_stuffing_attempt',
        severity: signal.severity,
        details: signal.details,
      });
    }
  }

  private groupBy<T>(items: T[], keyFn: (item: T) => string): Record<string, T[]> {
    return items.reduce<Record<string, T[]>>((acc, item) => {
      const key = keyFn(item);
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});
  }

  private async groupByAsn(hits: RateLimitHit[]): Promise<Record<string, RateLimitHit[]>> {
    const groups: Record<string, RateLimitHit[]> = {};
    for (const hit of hits) {
      const asn = await this.geoIp.lookupAsn(hit.ip);
      const key = asn ?? 'unknown';
      if (!groups[key]) groups[key] = [];
      groups[key].push(hit);
    }
    return groups;
  }

  private isCloudHostingAsn(asn: string): boolean {
    const cloudAsns = ['AS14618', 'AS16509', 'AS8075', 'AS396982', 'AS14061']; // AWS, Azure, GCP, DigitalOcean, etc.
    return cloudAsns.includes(asn);
  }
}
```

## Annexe F. Cloudflare WAF integration Sprint 35

Sprint 35 evaluera Cloudflare WAF en complement (DDoS protection layer 7) :

```typescript
// Sprint 35 : repo/apps/api/src/modules/security/cloudflare-waf.service.ts
@Injectable()
export class CloudflareWafService {
  private readonly apiBase = 'https://api.cloudflare.com/client/v4';
  private readonly zoneId: string;
  private readonly apiToken: string;

  constructor(config: ConfigService) {
    this.zoneId = config.get<string>('CLOUDFLARE_ZONE_ID') ?? '';
    this.apiToken = config.get<string>('CLOUDFLARE_API_TOKEN') ?? '';
  }

  async createRateLimitRule(input: {
    description: string;
    expression: string;
    action: 'block' | 'managed_challenge' | 'js_challenge';
    threshold: number;
    period_seconds: number;
  }): Promise<{ rule_id: string }> {
    const response = await fetch(`${this.apiBase}/zones/${this.zoneId}/rulesets`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        kind: 'zone',
        phase: 'http_ratelimit',
        rules: [{
          description: input.description,
          expression: input.expression,
          action: input.action,
          ratelimit: {
            characteristics: ['ip.src'],
            period: input.period_seconds,
            requests_per_period: input.threshold,
            mitigation_timeout: 600,
          },
        }],
      }),
    });
    const result = await response.json();
    return { rule_id: result.result.id };
  }

  async blockIp(ip: string, reason: string, duration_seconds: number): Promise<void> {
    await fetch(`${this.apiBase}/user/firewall/access_rules/rules`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mode: 'block',
        configuration: { target: 'ip', value: ip },
        notes: reason,
      }),
    });
  }
}
```

Pre-configured rules Cloudflare via Terraform Sprint 35 :

```hcl
# infrastructure/terraform/cloudflare/waf-rules.tf
resource "cloudflare_ruleset" "auth_rate_limit" {
  zone_id = var.cloudflare_zone_id
  name    = "Skalean InsurTech Auth Rate Limiting"
  kind    = "zone"
  phase   = "http_ratelimit"

  rules {
    description = "Block excessive signin attempts at edge"
    expression  = "(http.request.uri.path eq \"/api/v1/auth/signin\" and http.request.method eq \"POST\")"
    action      = "block"
    ratelimit {
      characteristics            = ["ip.src", "http.request.headers[\"x-forwarded-for\"][0]"]
      period                     = 60
      requests_per_period        = 10
      mitigation_timeout         = 300
    }
  }

  rules {
    description = "Challenge suspicious signup attempts"
    expression  = "(http.request.uri.path eq \"/api/v1/auth/signup\" and http.request.method eq \"POST\")"
    action      = "managed_challenge"
    ratelimit {
      characteristics            = ["ip.src"]
      period                     = 3600
      requests_per_period        = 5
    }
  }
}
```

## Annexe G. Admin endpoints rate limit management Sprint 27

Sprint 27 ajoutera des endpoints admin pour gerer les rate limits :

```typescript
// Sprint 27 : repo/apps/api/src/modules/admin/rate-limit/admin-rate-limit.controller.ts
import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { RequireMfa } from '../../auth/decorators/require-mfa.decorator.js';
import { CurrentAuth } from '../../auth/decorators/current-auth.decorator.js';
import { AuthRole } from '@insurtech/auth';
import type { AuthContext } from '@insurtech/auth';
import { AuthThrottlerStorageService } from '../../auth/throttler/auth-throttler-storage.service.js';

const clearRateLimitSchema = z.object({
  reason: z.string().min(10).max(500),
  ticket_id: z.string().regex(/^[A-Z]{2,5}-\d{4,8}$/).optional(),
}).strict();
class ClearRateLimitDto extends createZodDto(clearRateLimitSchema) {}

@ApiTags('admin', 'rate-limit')
@Controller({ path: 'admin/rate-limit', version: '1' })
export class AdminRateLimitController {
  constructor(private readonly throttlerStorage: AuthThrottlerStorageService) {}

  @Get('status')
  @ApiBearerAuth()
  @Roles(AuthRole.SuperAdminPlatform, AuthRole.AnalystSupport)
  @ApiOperation({ summary: 'Query current rate limit state by IP, email, or endpoint' })
  async getStatus(
    @Query('ip') ip?: string,
    @Query('email') email?: string,
    @Query('endpoint') endpoint?: string,
  ) {
    return this.throttlerStorage.getStateForFilter({ ip, email, endpoint });
  }

  @Post('ip/:ip/clear')
  @ApiBearerAuth()
  @Roles(AuthRole.SuperAdminPlatform)
  @RequireMfa()
  @ApiOperation({ summary: 'Clear rate limit for a specific IP' })
  async clearForIp(
    @CurrentAuth() admin: AuthContext,
    @Param('ip') ip: string,
    @Body() body: ClearRateLimitDto,
  ) {
    if (admin.subject.kind !== 'user') throw new Error();
    await this.throttlerStorage.clearKey(`${ip}*`);
    return {
      ip, cleared_at: new Date().toISOString(),
      cleared_by: admin.subject.user.id,
      reason: body.reason,
      ticket_id: body.ticket_id ?? null,
    };
  }

  @Post('email/:email/clear')
  @ApiBearerAuth()
  @Roles(AuthRole.SuperAdminPlatform)
  @RequireMfa()
  async clearForEmail(
    @CurrentAuth() admin: AuthContext,
    @Param('email') email: string,
    @Body() body: ClearRateLimitDto,
  ) {
    if (admin.subject.kind !== 'user') throw new Error();
    await this.throttlerStorage.clearKey(`*:${email.toLowerCase()}*`);
    return { email, cleared_at: new Date().toISOString(), cleared_by: admin.subject.user.id, reason: body.reason };
  }

  @Get('top-violators')
  @ApiBearerAuth()
  @Roles(AuthRole.SuperAdminPlatform, AuthRole.AnalystSupport)
  @ApiOperation({ summary: 'List IPs with most rate limit hits in last hour' })
  async getTopViolators(@Query('limit') limit = 20) {
    return this.throttlerStorage.getTopViolators(Number.parseInt(String(limit), 10));
  }
}
```

## Annexe H. Geographic rate limiting Sprint 33

Sprint 33 ajoutera un layer de rate limiting geographique pour proteger contre les attaques depuis pays a haut risque :

```typescript
// Sprint 33 : repo/apps/api/src/modules/auth/throttler/geo-throttler.guard.ts
import { Injectable, type ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { GeoIpService } from '../../security/geo-ip.service.js';

@Injectable()
export class GeoThrottlerGuard extends ThrottlerGuard {
  constructor(
    options: any,
    storageService: any,
    reflector: any,
    private readonly geoIp: GeoIpService,
  ) {
    super(options, storageService, reflector);
  }

  protected async getTracker(req: any): Promise<string> {
    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ?? req.socket?.remoteAddress ?? 'unknown');

    // For high-risk countries, apply stricter limit by adding country prefix
    const country = await this.geoIp.lookupCountry(ip);
    const highRiskCountries = process.env.HIGH_RISK_COUNTRIES?.split(',') ?? [];
    if (country && highRiskCountries.includes(country)) {
      return `risk:${country}:${ip}`;
    }
    return ip;
  }

  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ?? req.socket?.remoteAddress);

    // Whitelist Skalean office IPs
    const whitelist = process.env.RATE_LIMIT_WHITELIST_IPS?.split(',') ?? [];
    if (whitelist.includes(ip)) return true;

    // Skip for trusted CDN
    const cfRay = req.headers['cf-ray'];
    if (cfRay && this.isTrustedCloudflare(req)) return false; // proceed but use real IP

    return false;
  }

  private isTrustedCloudflare(req: any): boolean {
    const cfConnectingIp = req.headers['cf-connecting-ip'];
    return Boolean(cfConnectingIp);
  }
}
```

## Annexe I. Per-tenant rate limit overrides Sprint 14

Sprint 14 permettra aux tenants enterprise de personnaliser les limites :

```typescript
// Sprint 14 : repo/apps/api/src/modules/auth/throttler/tenant-throttle-config.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { TenantThrottleConfigEntity } from '@insurtech/database';

interface TenantThrottleConfig {
  tenant_id: string;
  signin_per_minute: number;
  signup_per_hour: number;
  refresh_per_minute: number;
  forgot_password_per_hour: number;
  whitelist_cidrs: string[];
}

@Injectable()
export class TenantThrottleConfigService {
  private readonly logger = new Logger(TenantThrottleConfigService.name);
  private readonly cache = new Map<string, TenantThrottleConfig>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000;
  private readonly cacheTimestamps = new Map<string, number>();

  constructor(
    @InjectRepository(TenantThrottleConfigEntity)
    private readonly repo: Repository<TenantThrottleConfigEntity>,
  ) {}

  async getConfigForTenant(tenantId: string): Promise<TenantThrottleConfig | null> {
    const cached = this.cache.get(tenantId);
    const cachedAt = this.cacheTimestamps.get(tenantId);
    if (cached && cachedAt && Date.now() - cachedAt < this.CACHE_TTL_MS) return cached;

    const row = await this.repo.findOne({ where: { tenant_id: tenantId } });
    if (!row) return null;

    const config: TenantThrottleConfig = {
      tenant_id: row.tenant_id,
      signin_per_minute: row.signin_per_minute,
      signup_per_hour: row.signup_per_hour,
      refresh_per_minute: row.refresh_per_minute,
      forgot_password_per_hour: row.forgot_password_per_hour,
      whitelist_cidrs: row.whitelist_cidrs ?? [],
    };
    this.cache.set(tenantId, config);
    this.cacheTimestamps.set(tenantId, Date.now());
    return config;
  }

  async upsertConfig(input: TenantThrottleConfig): Promise<void> {
    await this.repo.upsert(
      {
        tenant_id: input.tenant_id,
        signin_per_minute: input.signin_per_minute,
        signup_per_hour: input.signup_per_hour,
        refresh_per_minute: input.refresh_per_minute,
        forgot_password_per_hour: input.forgot_password_per_hour,
        whitelist_cidrs: input.whitelist_cidrs,
      },
      ['tenant_id'],
    );
    this.cache.delete(input.tenant_id);
    this.cacheTimestamps.delete(input.tenant_id);
  }
}
```

Migration Sprint 14 :

```typescript
// Sprint 14 : migration CreateTenantThrottleConfig
export class CreateTenantThrottleConfig20260901 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE tenant_throttle_config (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
        signin_per_minute INT NOT NULL DEFAULT 5,
        signup_per_hour INT NOT NULL DEFAULT 3,
        refresh_per_minute INT NOT NULL DEFAULT 30,
        forgot_password_per_hour INT NOT NULL DEFAULT 3,
        whitelist_cidrs JSONB NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX idx_tenant_throttle_config_tenant ON tenant_throttle_config(tenant_id);
    `);
  }
}
```

## Annexe J. Tests E2E exhaustifs supplementaires

Tests E2E supplementaires pour valider les patterns avances :

```typescript
// Tests E2E supplementaires pour rate limiting

describe('Rate limit IP whitelist (Sprint 14)', () => {
  it('whitelisted IP bypass rate limits', async ({ baseURL }) => {
    // Configure RATE_LIMIT_WHITELIST_IPS=10.0.0.5 in env
    const api = await request.newContext({
      baseURL,
      extraHTTPHeaders: { 'X-Forwarded-For': '10.0.0.5' },
    });

    // 100 requests in 1 minute should all succeed (no rate limit)
    let successCount = 0;
    for (let i = 0; i < 100; i += 1) {
      const r = await api.post('/api/v1/auth/signin', {
        data: { email: 'whitelist-test@example.com', password: 'wrong' },
      });
      if (r.status() !== 429) successCount += 1;
    }
    expect(successCount).toBe(100);

    await api.dispose();
  });
});

describe('Rate limit + lockout integration', () => {
  it('5 fails trigger lockout, 6th rate-limited returns 429 (not 401)', async ({ baseURL }) => {
    const api = await request.newContext({
      baseURL,
      extraHTTPHeaders: { 'X-Forwarded-For': '11.11.11.11' },
    });

    // 5 fails -> lockout AND rate limit close
    for (let i = 1; i <= 5; i += 1) {
      await api.post('/api/v1/auth/signin', {
        data: { email: 'integration-test@example.com', password: 'wrong' },
      });
    }
    const r6 = await api.post('/api/v1/auth/signin', {
      data: { email: 'integration-test@example.com', password: 'wrong' },
    });
    // Either 429 (rate limit) or 401 (lockout) -- both are valid defenses
    expect([429, 401]).toContain(r6.status());
    await api.dispose();
  });
});

describe('Rate limit CORS preflight', () => {
  it('OPTIONS preflight does not consume rate limit', async ({ baseURL }) => {
    const api = await request.newContext({
      baseURL,
      extraHTTPHeaders: { 'X-Forwarded-For': '12.12.12.12' },
    });

    // 100 OPTIONS preflight
    for (let i = 0; i < 100; i += 1) {
      await api.fetch('/api/v1/auth/signin', {
        method: 'OPTIONS',
        headers: { 'Origin': 'https://app.skalean.ma', 'Access-Control-Request-Method': 'POST' },
      });
    }

    // Now POST signin should still work
    const r = await api.post('/api/v1/auth/signin', {
      data: { email: 'cors-test@example.com', password: 'wrong' },
    });
    expect(r.status()).toBe(401); // not 429
    await api.dispose();
  });
});

describe('Rate limit per-tenant override (Sprint 14)', () => {
  it('tenant with custom signin_per_minute=10 allows 10 signins', async ({ baseURL }) => {
    // Sprint 14 : seed tenant_throttle_config for tenant T1 with signin_per_minute=10
    // Make 10 signins from T1 -- all should succeed
    // 11th should 429
  });
});
```

## Annexe K. Monitoring complete Prometheus + Grafana

```promql
# Volume rate limit hits par endpoint
rate(auth_rate_limit_hits_total[5m]) by (endpoint)

# Distribution par status
sum(rate(http_requests_total{path=~"/api/v1/auth/.*"}[5m])) by (status)

# Top IPs avec hits (Sprint 33)
topk(10, sum(rate(auth_rate_limit_hits_total[1h])) by (ip))

# Signin success rate
sum(rate(http_requests_total{path="/api/v1/auth/signin", status="200"}[5m]))
/ sum(rate(http_requests_total{path="/api/v1/auth/signin"}[5m]))
```

Dashboard Grafana "Auth Rate Limit Operations" :
- Panel 1 "Volume" : timeseries hits per endpoint per minute.
- Panel 2 "Top violators" : table top 20 IPs with most hits last hour.
- Panel 3 "ASN concentration" : pie chart hits by ASN (detect botnet).
- Panel 4 "Geographic distribution" : map hits by country (detect anomalies).
- Panel 5 "Rate limit success vs hits" : ratio rate-limited / total requests.
- Panel 6 "Sprint 14 captcha activations" : counter captcha checks.

Alertes P0 routees vers PagerDuty :
- `rate(auth_rate_limit_hits_total[5m]) > 100` per endpoint -> attaque potentielle.
- `topk(1, ...)` IP violator > 1000 hits/h -> bot.
- ASN with > 500 hits/h -> botnet.
- Captcha failure rate > 50% -> reCAPTCHA service down ou attaque sophistiquee.

## Annexe L. References reglementaires complete

### L.1 OWASP ASVS section 11 (Business Logic Security)

V11.1.1 : "Verify the application will only process business logic flows for the same user in sequential step order and without skipping steps."

Implementation : rate limit garantit qu'un attaquant ne peut pas paralleliser une attaque pour bypass des etapes. Per-endpoint limits force le throttling sequentiel.

V11.1.4 : "Verify the application has anti-automation controls to protect against excessive calls."

Implementation : @Throttle decorators sur tous endpoints sensibles + Sprint 14 captcha + Sprint 33 ML detection.

### L.2 NIST SP 800-63B section 5.2.2 (Rate Limiting)

"To support the auditing process, mechanisms shall be in place to log unsuccessful authentication attempts. The information collected SHALL include details on the type of failed authentication attempt, the IP address(es) attempting authentication, the time, and any additional information that may be useful in identifying anomalies."

Implementation : Tache 2.1.12 logRateLimitHit + Tache 2.1.14 Pino warn logs + Sprint 33 SIEM correlation.

### L.3 ACAPS circulaire 2024 article 14

"Les operateurs metier doivent implementer un mecanisme de defense contre les tentatives multiples de connexion infructueuses, incluant rate limiting et blocage progressif."

Implementation Sprint 5 : LockoutService Tache 2.1.10 + Rate Limiting Tache 2.1.14 = defense en profondeur.

### L.4 Loi 09-08 article 23

"Toute personne dispose du droit a la securite des donnees."

Le rate limiting est un control essentiel pour la securite des donnees -- empeche que les attaques massive consommnent les ressources de validation des donnees personnelles.

### L.5 PCI DSS 8.1.6 (futur Sprint 11+ Pay)

PCI DSS 8.1.6 limite a 6 attempts max avant lockout. Skalean Tier 1 = 5 -- conforme. Rate limit signin 5/min/IP complete.

## Annexe M. Test E2E avec Cloudflare WAF mock Sprint 35

```typescript
// Sprint 35 test : verify Cloudflare WAF rate limit at edge
describe('Cloudflare WAF integration (Sprint 35)', () => {
  it('15 signin attempts in 60s blocked by Cloudflare before reaching origin', async ({ baseURL }) => {
    // This test runs against staging environment with Cloudflare WAF enabled
    // 10 attempts allowed by CF WAF, 11+ blocked at edge
    let blockedAtEdge = 0;
    for (let i = 0; i < 15; i += 1) {
      const r = await fetch(baseURL + '/api/v1/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'cf-test@example.com', password: 'wrong' }),
      });
      if (r.status === 429 && r.headers.get('cf-cache-status')) {
        blockedAtEdge += 1;
      }
    }
    expect(blockedAtEdge).toBeGreaterThanOrEqual(5);
  });
});
```

---

**Fin du prompt task-2.1.14-rate-limiting-auth.md.**
