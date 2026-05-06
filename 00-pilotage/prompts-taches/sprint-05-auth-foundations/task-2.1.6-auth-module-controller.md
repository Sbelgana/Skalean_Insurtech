# TACHE 2.1.6 -- AuthModule + AuthController + AuthService + JwtStrategy + JwtAuthGuard + @CurrentUser

**Sprint** : 5 (Phase 2 / Sprint 1 dans phase) -- Auth Foundations
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-05-sprint-05-auth-foundations.md` (Tache 2.1.6)
**Phase** : 2 -- Securite & Multi-tenant
**Priorite** : P0 (bloquant pour 2.1.7 MfaService Setup, 2.1.9 Signup, 2.1.11 Recovery, 2.1.15 E2E tests)
**Effort** : 7h
**Dependances** : 2.1.5 (SessionService consomme), 2.1.4 (JwtService), 2.1.3 (HashingService), 2.1.2 (Argon2Service)
**Densite cible** : 80-150 ko (auto-suffisant exhaustif)
**AUCUNE EMOJI AUTORISEE**

---

## 1. But

Cette tache vise a livrer la couche d'integration NestJS complete qui expose les endpoints REST `/api/v1/auth/*` consommes par les 7 frontends Next.js Sprint 4 (web-broker, web-garage, web-garage-mobile, web-insurtech-admin, web-customer-portal, web-assure-portal, web-assure-mobile) et qui orchestrent les services cryptographiques fondationnels poses dans les taches 2.1.2 a 2.1.5 (Argon2Service, JwtService, SessionService, EncryptionService, HashingService) pour materialiser les flows d'authentification operationnels. Le perimetre couvre : un module NestJS `AuthModule` situe dans `repo/apps/api/src/modules/auth/` (distinct du package `@insurtech/auth` qui contient les contrats partages, ce module est specifique a l'application api) qui declare les controllers et providers ; un controller `AuthController` exposant 6 endpoints HTTP (POST `/signin` qui authentifie email + password puis emet access + refresh tokens en mode standard ou retourne `mfa_challenge_token` si MFA enabled ; POST `/signout` qui revoque la session courante ; POST `/signout-all` qui revoque toutes les sessions du user ; POST `/refresh` qui exchange un refresh token valide contre un nouveau couple access + refresh avec rotation et theft detection ; GET `/me` qui retourne le profile de l'utilisateur authentifie ; GET `/sessions` qui liste les sessions actives du user pour permettre le management cross-device) ; un service `AuthService` qui orchestre les services fondationnels ; une strategie Passport `JwtStrategy` qui extrait le bearer token du header Authorization, le verifie via JwtService, le valide via SessionService (rejette si revoque ou expire), et populate `request.auth` avec un `AuthContext` typed ; un guard `JwtAuthGuard` qui chain le PublicEndpointGuard Sprint 3 (skip si endpoint marque `@Public()`) puis execute la strategy ; un decorator `@CurrentAuth()` qui extrait l'`AuthContext` de la request pour injection dans les controllers ; et 6 DTOs Zod-derived pour validation runtime.

L'apport est multiple. Premierement, en consolidant tous les endpoints d'authentification dans un seul controller avec une logique orchestree dans un seul service, on garantit la coherence comportementale -- le flow signin a la meme structure de retour, les memes codes d'erreur HTTP, les memes events Kafka publies, les memes audit logs declenches, sur tous les endpoints. Deuxiemement, en utilisant la strategie Passport JWT (vs implementation custom directe), on beneficie de l'integration native NestJS avec `@nestjs/passport`, du pattern `request.user` standard que les autres frameworks comme Swagger Sprint 33 reconnaissent automatiquement, et de la facilite d'ajouter d'autres strategies (LocalStrategy email/password Sprint 5, GoogleStrategy / AppleStrategy Phase 7+, WebAuthnStrategy Sprint 23). Troisiemement, en extrayant `JwtAuthGuard` du PublicEndpointGuard Sprint 3, on materialise le pattern "default deny + opt-in public" : tout nouvel endpoint cree dans le programme est par defaut authentifie (defense en profondeur contre les oublis), et le developpeur doit explicitement decorer `@Public()` pour autoriser un acces non-authentifie. Cette propriete est verifiee par un test E2E exhaustif Sprint 33 qui parcourt tous les endpoints declares et verifie qu'aucun endpoint protege par defaut n'expose de donnees sensibles sans @Public.

A l'issue de cette tache, l'API expose les 6 endpoints fonctionnels accessible via curl ou les frontends ; le flow `signin -> me -> refresh -> signout` se deroule end-to-end sans erreur ; une tentative `signin` avec mauvais password retourne `401 INVALID_CREDENTIALS` apres 200-500 ms (timing-safe via `Argon2Service.verifyEmptyForTiming` quand le user n'existe pas) ; un compte locke retourne `401 ACCOUNT_LOCKED` avec `retry_after` ; un account avec email non-verifie retourne `401 EMAIL_NOT_VERIFIED` ; un account avec MFA enabled retourne `200 { mfa_required: true, mfa_challenge_token: "..." }` ; un access token expire retourne `401 TOKEN_EXPIRED` (interceptor frontend redirect refresh) ; un refresh replay declenche `401 TOKEN_REUSE_DETECTED` avec family revoke automatique ; et la suite Vitest + Playwright couvre 50+ scenarios E2E avec coverage >= 88% sur le module auth.

---

## 2. Contexte etendu

### 2.1 Pourquoi cette tache existe

L'API skalean-insurtech expose un seul point d'entree HTTP (NestJS sur port 4000 derriere un reverse proxy Sprint 32 nginx Sprint 35 ALB Atlas Cloud Services) pour tous les consommateurs : 7 frontends web Next.js, 1 application MCP server, des bots service-to-service Sprint 31. Sans une couche d'integration AuthModule centralisee, chaque endpoint metier (CRM, Insure, Repair, Books, Comm) devrait dupliquer la logique de verification du token, de chargement de l'utilisateur, de check de revocation, de propagation du tenant_id. Cette duplication est la source #1 des vulnerabilites authentification dans les systemes complexes (cf. OWASP Top 10 A01:2021 Broken Access Control). En centralisant via un guard global `JwtAuthGuard` declenche automatiquement sur chaque request entrante, on garantit que TOUTES les routes du programme sont protegees par defaut.

Le choix d'une separation claire entre le package `@insurtech/auth` (contrats + services fondationnels) et le module `apps/api/.../auth` (controller + service + strategy + guard) materialise le principe de "library vs application" : `@insurtech/auth` est reutilisable par tout autre app du programme (mcp-server Sprint 12, sky-agent Sprint 31), tandis que `apps/api/.../auth` est specifique a l'API REST. Cette structure permet par exemple de creer un futur grpc-server (Sprint 35+) qui consommerait `@insurtech/auth` pour les contrats mais aurait sa propre couche d'integration grpc sans toucher au code REST.

L'integration `@nestjs/passport` + `passport-jwt` est un standard de fait dans l'ecosysteme NestJS depuis 2018. Tous les exemples officiels NestJS d'authentification l'utilisent. Le tooling Swagger Sprint 33 (`@nestjs/swagger`) reconnait automatiquement les routes protegees par `JwtAuthGuard` et genere la documentation OpenAPI avec le scheme bearer correspondant. Reinventer une couche d'integration custom serait du NIH (Not Invented Here) sans benefice mesurable.

Le pattern `@CurrentAuth()` decorator (similar a `@Req()` mais type-safe) est la convention NestJS pour injecter le contexte d'authentification dans les controllers. Il evite le code boilerplate `req.user as AuthenticatedUser` qui leak dans tous les controllers et qui est fragile (si la forme de `request.user` change, tous les controllers doivent etre mis a jour). Avec un decorator centralise, le change est unique.

### 2.2 Alternatives considerees

| Alternative | Avantages | Inconvenients | Decision |
|-------------|-----------|---------------|----------|
| Implementation custom auth sans Passport | Controle total, moins de dependances | Reinventer la roue, perte de l'ecosysteme NestJS, integration Swagger fragile | REJETE -- benefice nul, cout eleve |
| AuthGuard inline dans chaque controller | Apprentissage minimal | Duplication, oublis frequents | REJETE -- propagator d'oublis securite |
| Auth via middleware Express | Standard universel | NestJS lifecycle different (guards apres middleware), perte de l'integration DI | REJETE -- inadapte NestJS |
| Auth via NestJS Guard global + Passport JWT (RETENU) | Pattern NestJS officiel, integration tooling, ecosysteme | Necessite comprehension Passport (apprentissage 2-4h) | RETENU -- standard de fait |
| Express interceptor manuel | Plus simple | Pas de Passport ecosystem | REJETE |
| Auth via decorateur @Authenticated() au lieu de Guard | Plus explicite | Verbeux, oublis | REJETE -- preferer default deny |
| Default allow + @Authenticated() opt-in | Migration plus facile depuis legacy | Catastrophe securite (oublis = leaks) | REJETE absolument |

### 2.3 Trade-offs explicites

Choisir Guard global + Passport JWT impose une dependance a `@nestjs/passport@10.0.3` et `passport-jwt@4.0.1`. Ces deps ont des audits propres et sont maintenues. La latency overhead Passport est ~0.05 ms par requete (negligeable). Le benefice (ecosysteme + Swagger integration + standard) depasse largement.

Choisir `request.auth` (custom) au lieu de `request.user` (passport standard) impose une couche d'adaptation. Mais permet d'utiliser un type discrimine `AuthContext` qui supporte aussi le subject service (Sprint 31 sky-agent) et anonymous (endpoints publics). Le pattern Sprint 5 utilisera `request.auth` pour les controllers metier ; `request.user` reste disponible pour la compatibilite Passport interne.

Choisir 6 endpoints (signin, signout, signout-all, refresh, me, sessions) au lieu de 4 (sans signout-all et sessions) implique 2 endpoints supplementaires a tester. En contrepartie, on couvre les use cases UX critiques : signout-all pour le scenario "j'ai perdu mon laptop, deconnecte-moi partout", et sessions pour permettre a l'utilisateur de voir et gerer ses sessions.

Choisir de retourner `mfa_required: true` au lieu de declencher directement le challenge MFA dans signin implique deux round-trips reseau pour les utilisateurs MFA. En contrepartie, on garde le controller signin focused sur l'authentification password, et on isole le challenge MFA dans un endpoint dedie `/verify-mfa` (Tache 2.1.8) plus lisible et plus testable. Cette separation est conforme au pattern "two-step authentication" recommande par NIST SP 800-63B section 5.1.

### 2.4 Decisions strategiques referenced

- **decision-014 (JWT theft detection rotation)** : pertinence totale ; SessionService.rotateSession appele dans `refresh`.
- **decision-013 (Argon2id)** : pertinence totale ; Argon2Service.verify appele dans `signin`.
- **decision-006 (No-emoji)** : totale.
- **decision-007 (Zod runtime validation)** : totale ; tous les DTOs sont Zod-derived via `nestjs-zod`.
- **decision-008 (Cloud souverain MA)** : indirecte ; tous les datastores (Redis, Postgres) sont sur Atlas Cloud Services Benguerir Sprint 35.
- **decision-002 (TypeScript strict)** : totale.

### 2.5 Pieges techniques

1. **Piege : Guard global non applique sur les endpoints health checks**.
   Solution : `@Public()` decorator sur `/health`, `/ready`, `/metrics`. Verifie test V41.

2. **Piege : `request.user` vs `request.auth` confusion**.
   Solution : convention Sprint 5 -- les controllers metier utilisent `@CurrentAuth()` qui retourne `AuthContext`. `request.user` (passport interne) n'est pas exposed.

3. **Piege : Email lookup case-sensitive vs case-insensitive**.
   Solution : email lowercased au signin via Zod schema (deja Tache 2.1.1) + colonne `auth_users.email citext` Sprint 2 pour case-insensitive.

4. **Piege : Timing attack pour user enumeration**.
   Solution : `Argon2Service.verifyEmptyForTiming()` quand user.findByEmail retourne null. Detail section 6.

5. **Piege : MFA bypass via mfa_required false direct**.
   Solution : payload signin retourne strict `{ access_token, refresh_token, user }` SI MFA disabled, OU `{ mfa_required: true, mfa_challenge_token }` SI MFA enabled. Pas de overlap.

6. **Piege : Refresh sans Authorization header (refresh est public)**.
   Solution : POST /refresh est decore @Public() car le refresh token est dans le body, pas un access JWT.

7. **Piege : Audit log fail bloque la requete**.
   Solution : audit log est fire-and-forget. Tache 2.1.12 detail.

8. **Piege : Kafka publish fail bloque la requete**.
   Solution : publish async, retry queue Sprint 14. Tache 2.1.12 detail.

9. **Piege : Lockout counter pas reset apres signin success**.
   Solution : `LockoutService.recordSuccess(user.id)` apres tokens emis. Tache 2.1.10 detail.

10. **Piege : `last_login_at` update fail apres tokens emis**.
    Solution : update fire-and-forget, ne fail pas la requete.

11. **Piege : User soft-deleted continue a se connecter**.
    Solution : `auth_users.deleted_at IS NOT NULL` -> 401 ACCOUNT_DELETED. Verifie test V37.

12. **Piege : Tenant suspendu, user actif**.
    Solution : check `tenants.suspended_at` Sprint 6 ; Sprint 5 simple = pas de check.

13. **Piege : Rate limit signin par IP+email (DDoS protection)**.
    Solution : Tache 2.1.14 RateLimitGuard. Cette tache prepare le hook.

14. **Piege : Refresh d'un token emis avec ancien JWT_SECRET (rotation Sprint 14)**.
    Solution : Sprint 14 introduira grace period. Sprint 5 = single secret.

15. **Piege : `me` endpoint sensible aux donnees fraiches**.
    Solution : me lit la DB directement (pas le JWT), garantit fresh data apres update profile.

16. **Piege : `sessions` endpoint expose user_agent qui peut etre sensible**.
    Solution : sanitization user_agent (truncate > 200 chars, strip control chars).

17. **Piege : Concurrent refresh deux paralleles un succede l'autre echoue**.
    Solution : Lua atomic Sprint 5 Tache 2.1.5. Le second recoit TOKEN_REUSE_DETECTED ce qui est correct (un attaquant aurait pu fork).

18. **Piege : Session revoke ne se propage pas immediatement aux instances API en parallele**.
    Solution : Redis SET = consistent globalement. Toutes les instances voient la revocation. Sprint 35 Redis cluster avec replication eventually consistent ~10 ms.

---

## 3. Architecture context

### 3.1 Position dans le sprint

Tache 2.1.6 livre la couche d'integration consomee par : 2.1.7 (MFA setup endpoints reutilisent le AuthController structure), 2.1.8 (MfaRequiredGuard depend de JwtStrategy), 2.1.9 (Signup endpoint ajoute au AuthController), 2.1.10 (Lockout consume dans signin flow), 2.1.11 (Recovery endpoints), 2.1.12 (AuditService consume tous les events emis), 2.1.13 (EmailService consume), 2.1.14 (RateLimit guard sur signin), 2.1.15 (E2E tests Playwright).

### 3.2 Position dans le programme global

- Sprint 6 : `TenantGuard` chained avec JwtAuthGuard ; lit `tenant_id` du AuthContext.
- Sprint 7 : `RolesGuard` + `@Roles()` decorator ; lit `role` du AuthContext.
- Sprint 14 : migration HS256 -> RS256 transparent pour AuthController.
- Sprint 23 : WebAuthn endpoints additionnels (`/webauthn/register`, `/webauthn/authenticate`).
- Sprint 25 : impersonate endpoints `/admin/impersonate` consomment AuthService.
- Sprint 31 : sky-agent verifie ServiceJwtPayload via JwtStrategy etendue.
- Sprint 33 : pentest review de tous les endpoints, generation OpenAPI 3.1, audit complet.

### 3.3 Diagramme integration

```
                      +-----------------------------------+
                      |  HTTP Request                      |
                      |  Authorization: Bearer <jwt>      |
                      +-----------------+------------------+
                                        |
                                        v
                  +---------------------+---------------------+
                  |  Global Guard chain                       |
                  |  PublicEndpointGuard (Sprint 3)           |
                  |  -> JwtAuthGuard (THIS TASK)              |
                  |     -> JwtStrategy.validate()             |
                  |        -> JwtService.verifyAccessToken    |
                  |        -> SessionService.ensureValid      |
                  |        -> userRepo.findById               |
                  |        -> populate request.auth           |
                  +-----------------------+-------------------+
                                          |
                                          v
                  +-----------------------+-------------------+
                  |  AuthController (this task)                |
                  |  POST /signin                              |
                  |    -> AuthService.signin                   |
                  |       -> userRepo.findByEmail              |
                  |       -> Argon2Service.verify              |
                  |       -> SessionService.createSession      |
                  |       -> JwtService.signAccessToken/Refresh|
                  |       -> AuditService.logSignin (2.1.12)   |
                  |       -> Kafka publish (2.1.12)            |
                  |       -> return TokenPair + user           |
                  |                                            |
                  |  POST /signout / signout-all               |
                  |  POST /refresh (theft detection)           |
                  |  GET  /me / sessions                       |
                  +--------------------------------------------+
```

---

## 4. Livrables checkables (28 livrables)

- [ ] `repo/apps/api/src/modules/auth/auth.module.ts` -- AuthModule importing PassportModule + AuthService + JwtStrategy + AuthController + connecting to UserRepository (Sprint 2) -- ~70 lignes
- [ ] `repo/apps/api/src/modules/auth/auth.controller.ts` -- 6 endpoints avec decorators OpenAPI Swagger Sprint 33 ready -- ~250 lignes
- [ ] `repo/apps/api/src/modules/auth/auth.service.ts` -- orchestrateur central -- ~400 lignes
- [ ] `repo/apps/api/src/modules/auth/strategies/jwt.strategy.ts` -- Passport strategy -- ~80 lignes
- [ ] `repo/apps/api/src/modules/auth/guards/jwt-auth.guard.ts` -- chained guard -- ~60 lignes
- [ ] `repo/apps/api/src/modules/auth/decorators/current-auth.decorator.ts` -- @CurrentAuth() -- ~30 lignes
- [ ] `repo/apps/api/src/modules/auth/decorators/public.decorator.ts` -- @Public() reuse Sprint 3 -- ~20 lignes
- [ ] `repo/apps/api/src/modules/auth/dto/signin.dto.ts` -- Zod-derived -- ~40 lignes
- [ ] `repo/apps/api/src/modules/auth/dto/signout.dto.ts` -- ~20 lignes
- [ ] `repo/apps/api/src/modules/auth/dto/refresh.dto.ts` -- ~25 lignes
- [ ] `repo/apps/api/src/modules/auth/dto/auth-response.dto.ts` -- TokenPair + UserPublic types -- ~50 lignes
- [ ] `repo/apps/api/src/modules/auth/dto/sessions-list.dto.ts` -- ~40 lignes
- [ ] `repo/apps/api/src/modules/auth/auth.errors.ts` -- ApiAuthError mapping -- ~80 lignes
- [ ] Mise a jour `repo/apps/api/src/app.module.ts` -- import AuthModule, register JwtAuthGuard global -- modification
- [ ] Tests `repo/apps/api/src/modules/auth/auth.controller.spec.ts` -- 12+ tests -- ~250 lignes
- [ ] Tests `repo/apps/api/src/modules/auth/auth.service.spec.ts` -- 25+ tests -- ~450 lignes
- [ ] Tests `repo/apps/api/src/modules/auth/strategies/jwt.strategy.spec.ts` -- 8 tests -- ~150 lignes
- [ ] Tests `repo/apps/api/src/modules/auth/guards/jwt-auth.guard.spec.ts` -- 6 tests -- ~100 lignes
- [ ] Tests `repo/apps/api/src/modules/auth/decorators/current-auth.decorator.spec.ts` -- 4 tests -- ~80 lignes
- [ ] Tests E2E `repo/apps/api/test/auth.e2e-spec.ts` -- 15+ scenarios -- ~400 lignes
- [ ] Mise a jour `repo/apps/api/package.json` (deps `@nestjs/passport@10.0.3`, `passport@0.7.0`, `passport-jwt@4.0.1`)
- [ ] Tous les tests passent
- [ ] Coverage >= 88%
- [ ] Aucune emoji
- [ ] Aucun console.log
- [ ] Aucun any implicite
- [ ] Documentation JSDoc + Swagger decorators sur chaque endpoint
- [ ] Pre-commit hooks passent

---

## 5. Fichiers crees / modifies

```
repo/apps/api/src/modules/auth/auth.module.ts                                 (~70 lignes)
repo/apps/api/src/modules/auth/auth.controller.ts                             (~250 lignes)
repo/apps/api/src/modules/auth/auth.service.ts                                (~400 lignes)
repo/apps/api/src/modules/auth/auth.errors.ts                                 (~80 lignes)
repo/apps/api/src/modules/auth/strategies/jwt.strategy.ts                     (~80 lignes)
repo/apps/api/src/modules/auth/guards/jwt-auth.guard.ts                       (~60 lignes)
repo/apps/api/src/modules/auth/decorators/current-auth.decorator.ts           (~30 lignes)
repo/apps/api/src/modules/auth/decorators/public.decorator.ts                 (~20 lignes)
repo/apps/api/src/modules/auth/dto/signin.dto.ts                              (~40 lignes)
repo/apps/api/src/modules/auth/dto/signout.dto.ts                             (~20 lignes)
repo/apps/api/src/modules/auth/dto/refresh.dto.ts                             (~25 lignes)
repo/apps/api/src/modules/auth/dto/auth-response.dto.ts                       (~50 lignes)
repo/apps/api/src/modules/auth/dto/sessions-list.dto.ts                       (~40 lignes)
repo/apps/api/src/app.module.ts                                                (modifie)
repo/apps/api/package.json                                                     (modifie)
repo/apps/api/src/modules/auth/auth.controller.spec.ts                         (~250 lignes)
repo/apps/api/src/modules/auth/auth.service.spec.ts                            (~450 lignes)
repo/apps/api/src/modules/auth/strategies/jwt.strategy.spec.ts                 (~150 lignes)
repo/apps/api/src/modules/auth/guards/jwt-auth.guard.spec.ts                   (~100 lignes)
repo/apps/api/src/modules/auth/decorators/current-auth.decorator.spec.ts       (~80 lignes)
repo/apps/api/test/auth.e2e-spec.ts                                            (~400 lignes)
```

Total : 21 fichiers, ~3000 lignes effectives.

---

## 6. Code patterns COMPLETS

### 6.1 `auth.errors.ts`

```typescript
/**
 * apps/api/.../auth/auth.errors.ts
 * HTTP-mapped auth errors raised by AuthService.
 */
import { HttpException, HttpStatus } from '@nestjs/common';

export type AuthErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'ACCOUNT_LOCKED'
  | 'ACCOUNT_DISABLED'
  | 'ACCOUNT_DELETED'
  | 'EMAIL_NOT_VERIFIED'
  | 'MFA_REQUIRED'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_INVALID'
  | 'TOKEN_REUSE_DETECTED'
  | 'SESSION_NOT_FOUND'
  | 'TENANT_SUSPENDED'
  | 'RATE_LIMIT_EXCEEDED';

export class ApiAuthError extends HttpException {
  readonly code: AuthErrorCode;
  readonly extra?: Record<string, unknown>;

  constructor(code: AuthErrorCode, message: string, status = HttpStatus.UNAUTHORIZED, extra?: Record<string, unknown>) {
    super({ code, message, ...(extra ?? {}) }, status);
    this.code = code;
    this.extra = extra;
  }
}

export const InvalidCredentialsError = () =>
  new ApiAuthError('INVALID_CREDENTIALS', 'Invalid email or password');

export const AccountLockedError = (lockedUntil: Date) =>
  new ApiAuthError('ACCOUNT_LOCKED', 'Account locked due to too many failed attempts', HttpStatus.UNAUTHORIZED, {
    locked_until: lockedUntil.toISOString(),
    retry_after_seconds: Math.max(Math.floor((lockedUntil.getTime() - Date.now()) / 1000), 0),
  });

export const EmailNotVerifiedError = () =>
  new ApiAuthError('EMAIL_NOT_VERIFIED', 'Email address has not been verified');

export const AccountDisabledError = () =>
  new ApiAuthError('ACCOUNT_DISABLED', 'Account has been disabled');

export const AccountDeletedError = () =>
  new ApiAuthError('ACCOUNT_DELETED', 'Account has been deleted');

export const TokenReuseDetectedError = () =>
  new ApiAuthError('TOKEN_REUSE_DETECTED', 'Refresh token replay detected -- all sessions revoked');
```

### 6.2 `dto/signin.dto.ts`

```typescript
import { createZodDto } from 'nestjs-zod';
import { signinSchema } from '@insurtech/auth';

export class SigninDto extends createZodDto(signinSchema) {}
```

### 6.3 `dto/refresh.dto.ts`

```typescript
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const refreshDtoSchema = z.object({
  refresh_token: z.string().min(20).max(2000),
}).strict();

export class RefreshDto extends createZodDto(refreshDtoSchema) {}
```

### 6.4 `dto/signout.dto.ts`

```typescript
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const signoutDtoSchema = z.object({
  all_devices: z.boolean().optional().default(false),
}).strict();

export class SignoutDto extends createZodDto(signoutDtoSchema) {}
```

### 6.5 `dto/auth-response.dto.ts`

```typescript
import { z } from 'zod';
import type { AuthRole } from '@insurtech/auth';

export interface UserPublic {
  id: string;
  email: string;
  display_name: string;
  role: AuthRole;
  tenant_id: string | null;
  email_verified: boolean;
  mfa_enabled: boolean;
  locale: 'fr-MA' | 'ar-MA' | 'en' | 'fr-FR';
  created_at: string;
  last_login_at: string | null;
}

export interface SigninSuccessResponse {
  access_token: string;
  refresh_token: string;
  access_expires_at: number;
  refresh_expires_at: number;
  token_type: 'Bearer';
  user: UserPublic;
  mfa_required: false;
}

export interface SigninMfaRequiredResponse {
  mfa_required: true;
  mfa_challenge_token: string;
  mfa_challenge_expires_at: number;
}

export type SigninResponse = SigninSuccessResponse | SigninMfaRequiredResponse;

export interface RefreshResponse {
  access_token: string;
  refresh_token: string;
  access_expires_at: number;
  refresh_expires_at: number;
  token_type: 'Bearer';
}
```

### 6.6 `decorators/public.decorator.ts`

```typescript
import { SetMetadata } from '@nestjs/common';

/**
 * Marks an endpoint as public (no auth required).
 * Read by JwtAuthGuard via Reflector.
 */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

### 6.7 `decorators/current-auth.decorator.ts`

```typescript
import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthContext } from '@insurtech/auth';

/**
 * @CurrentAuth() decorator -- extracts AuthContext from request.
 * Must be used inside a route protected by JwtAuthGuard.
 */
export const CurrentAuth = createParamDecorator((data: unknown, ctx: ExecutionContext): AuthContext => {
  const req = ctx.switchToHttp().getRequest();
  if (!req.auth) {
    throw new Error('CurrentAuth: request.auth is missing -- ensure route is protected by JwtAuthGuard');
  }
  return req.auth as AuthContext;
});
```

### 6.8 `strategies/jwt.strategy.ts`

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import type { Request } from 'express';
import {
  JwtService, SessionService, type JwtPayload, type AuthContext,
  TokenError, SessionRevokedError, SessionNotFoundError,
} from '@insurtech/auth';
import { ConfigService } from '@nestjs/config';
import type { UserRepository } from '../../user/user.repository.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly jwtService: JwtService,
    private readonly sessionService: SessionService,
    private readonly userRepository: UserRepository,
    config: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') ?? 'placeholder',
      issuer: config.get<string>('JWT_ISSUER') ?? 'skalean-insurtech-api',
      audience: config.get<string>('JWT_AUDIENCE') ?? 'skalean-insurtech-app',
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: JwtPayload): Promise<AuthContext> {
    try {
      // Re-verify via JwtService for consistency with rest of program (passport may not check all claims)
      const token = ExtractJwt.fromAuthHeaderAsBearerToken()(req as unknown as Request);
      if (!token) throw new UnauthorizedException('Missing token');

      // Check session not revoked / expired
      await this.sessionService.ensureValid(payload.sid);

      // Load user from DB (fresh data)
      const user = await this.userRepository.findById(payload.sub);
      if (!user) throw new UnauthorizedException('User not found');
      if (user.deleted_at !== null) throw new UnauthorizedException('Account deleted');
      if (!user.is_active) throw new UnauthorizedException('Account disabled');

      const auth: AuthContext = {
        subject: {
          kind: 'user',
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            display_name: user.display_name,
            tenant_id: user.tenant_id,
            mfa_enabled: user.mfa_enabled,
            mfa_verified: payload.mfa_verified,
            email_verified: user.email_verified_at !== null,
            locale: user.locale,
            created_at: user.created_at.toISOString(),
          },
          session_id: payload.sid,
          jwt_id: payload.jti,
        },
        ip: (req.headers['x-forwarded-for']?.toString().split(',')[0] ?? req.socket?.remoteAddress ?? 'unknown'),
        user_agent: req.headers['user-agent'] ?? 'unknown',
        request_id: (req.headers['x-request-id']?.toString() ?? 'unknown'),
        authenticated_at: Math.floor(Date.now() / 1000),
      };

      // Mutate request.auth (NestJS passport convention)
      (req as unknown as { auth: AuthContext }).auth = auth;

      // Touch last_seen_at (debounced)
      this.sessionService.touchLastSeen(payload.sid, auth.ip).catch(() => {/* non-blocking */});

      return auth;
    } catch (err) {
      if (err instanceof TokenError || err instanceof SessionRevokedError || err instanceof SessionNotFoundError) {
        throw new UnauthorizedException(err.message);
      }
      throw err;
    }
  }
}
```

### 6.9 `guards/jwt-auth.guard.ts`

```typescript
import { Injectable, type ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }
}
```

### 6.10 `auth.service.ts`

```typescript
/**
 * apps/api/.../auth/auth.service.ts
 * Orchestrator service for authentication flows.
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  Argon2Service, JwtService, SessionService, HashingService,
  type SignedJwt, type AuthRole, isMfaMandatory, type SigninInput,
  RefreshReplayDetectedError, TokenError,
} from '@insurtech/auth';
import { JWT_PARAMS } from '@insurtech/auth';
import { UserRepository, type AuthUser } from '../user/user.repository.js';
import {
  InvalidCredentialsError, AccountLockedError, AccountDisabledError,
  AccountDeletedError, EmailNotVerifiedError, TokenReuseDetectedError, ApiAuthError,
} from './auth.errors.js';
import type {
  SigninResponse, SigninSuccessResponse, SigninMfaRequiredResponse,
  RefreshResponse, UserPublic,
} from './dto/auth-response.dto.js';

interface SigninContext {
  ip: string;
  user_agent: string;
  request_id: string;
  remember_me: boolean;
  locale?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly userRepo: UserRepository,
    private readonly argon2: Argon2Service,
    private readonly jwt: JwtService,
    private readonly session: SessionService,
    private readonly hashing: HashingService,
    // Sprint 5 Tache 2.1.10 will inject LockoutService
    // Sprint 5 Tache 2.1.12 will inject AuditAuthService
  ) {}

  async signin(input: SigninInput, ctx: SigninContext): Promise<SigninResponse> {
    const email = input.email.trim().toLowerCase();
    this.logger.log({ action: 'signin_attempt', email, ip: ctx.ip });

    // 1. Lookup user (case-insensitive email)
    const user = await this.userRepo.findByEmail(email);

    // 2. Defend against timing user enumeration
    if (!user) {
      await this.argon2.verifyEmptyForTiming(input.password);
      throw InvalidCredentialsError();
    }

    // 3. Defense : check account state
    if (user.deleted_at !== null) {
      throw AccountDeletedError();
    }
    if (!user.is_active) {
      throw AccountDisabledError();
    }

    // 4. Check lockout (Tache 2.1.10 will integrate LockoutService here)
    if (user.locked_until !== null && user.locked_until > new Date()) {
      throw AccountLockedError(user.locked_until);
    }

    // 5. Verify password
    const valid = await this.argon2.verify(user.password_hash, input.password);
    if (!valid) {
      // Tache 2.1.10 LockoutService.recordFailedAttempt(user.id, ctx.ip);
      this.logger.warn({ action: 'signin_failed_wrong_password', user_id: user.id, ip: ctx.ip });
      throw InvalidCredentialsError();
    }

    // 6. Check email verified
    if (user.email_verified_at === null) {
      throw EmailNotVerifiedError();
    }

    // 7. Check MFA required
    if (user.mfa_enabled || isMfaMandatory(user.role)) {
      const mfaChallengeToken = this.hashing.randomToken(32);
      // Tache 2.1.7 will store this in Redis with TTL 5min and link to user_id
      this.logger.log({ action: 'signin_mfa_required', user_id: user.id });
      const mfaChallengeExpiresAt = Math.floor(Date.now() / 1000) + 300;
      const response: SigninMfaRequiredResponse = {
        mfa_required: true,
        mfa_challenge_token: mfaChallengeToken,
        mfa_challenge_expires_at: mfaChallengeExpiresAt,
      };
      return response;
    }

    // 8. Generate session + tokens
    const sid = this.jwt.generateId();
    const family = this.jwt.generateId();
    const refreshGen = 1;

    const accessToken = this.jwt.signAccessToken({
      sub: user.id,
      tenant_id: user.tenant_id,
      email: user.email,
      role: user.role,
      mfa_verified: false,
      sid,
    });
    const refreshToken = this.jwt.signRefreshToken({
      sub: user.id,
      sid,
      token_family: family,
      generation: refreshGen,
    });

    // Decode to get jti (the actual unique id for the session record)
    const refreshPayload = this.jwt.verifyRefreshToken(refreshToken);

    await this.session.createSession({
      user_id: user.id,
      tenant_id: user.tenant_id,
      role: user.role,
      jti: refreshPayload.jti,
      refresh_token_family: family,
      refresh_generation: refreshGen,
      ip: ctx.ip,
      user_agent: ctx.user_agent,
      mfa_verified: false,
      remember_me: ctx.remember_me,
      locale: ctx.locale,
    });

    // 9. Update last_login_at (fire-and-forget)
    this.userRepo.updateLastLogin(user.id, new Date(), ctx.ip).catch((err) => {
      this.logger.warn({ err: err instanceof Error ? err.message : err, user_id: user.id }, 'updateLastLogin failed');
    });

    // Tache 2.1.10 LockoutService.recordSuccess(user.id);
    // Tache 2.1.12 AuditAuthService.logSignin(...) + Kafka publish

    this.logger.log({ action: 'signin_success', user_id: user.id, sid });

    const accessExpiresAt = Math.floor(Date.now() / 1000) + JWT_PARAMS.ttl_access_seconds;
    const refreshExpiresAt = Math.floor(Date.now() / 1000) + JWT_PARAMS.ttl_refresh_seconds;

    const response: SigninSuccessResponse = {
      mfa_required: false,
      access_token: accessToken,
      refresh_token: refreshToken,
      access_expires_at: accessExpiresAt,
      refresh_expires_at: refreshExpiresAt,
      token_type: 'Bearer',
      user: this.toPublicUser(user),
    };
    return response;
  }

  async signout(sid: string): Promise<void> {
    await this.session.revokeSession(sid);
    this.logger.log({ action: 'signout', sid });
    // Tache 2.1.12 AuditAuthService.logSignout
  }

  async signoutAll(userId: string): Promise<{ sessions_revoked: number }> {
    const count = await this.session.revokeUserSessions(userId);
    this.logger.log({ action: 'signout_all', user_id: userId, count });
    return { sessions_revoked: count };
  }

  async refresh(refreshToken: string, ctx: SigninContext): Promise<RefreshResponse> {
    let payload;
    try {
      payload = this.jwt.verifyRefreshToken(refreshToken);
    } catch (err) {
      if (err instanceof TokenError) {
        throw new ApiAuthError('TOKEN_INVALID', err.message);
      }
      throw err;
    }

    const newJti = this.jwt.generateId();
    const newGeneration = payload.generation + 1;

    let newSession;
    try {
      newSession = await this.session.rotateSession(
        {
          old_jti: payload.jti,
          new_jti: newJti,
          expected_generation: payload.generation,
          new_generation: newGeneration,
          ip: ctx.ip,
          user_agent: ctx.user_agent,
        },
        {
          user_id: payload.sub,
          tenant_id: null,
          role: 'broker_user' as AuthRole, // overridden by old session
          jti: newJti,
          refresh_token_family: payload.token_family,
          refresh_generation: newGeneration,
          ip: ctx.ip,
          user_agent: ctx.user_agent,
          mfa_verified: false,
        },
      );
    } catch (err) {
      if (err instanceof RefreshReplayDetectedError) {
        // Tache 2.1.12 AuditAuthService.logReplayDetected
        throw TokenReuseDetectedError();
      }
      throw err;
    }

    // Refresh user data (mfa_verified can change)
    const user = await this.userRepo.findById(payload.sub);
    if (!user) throw InvalidCredentialsError();

    // Sign new tokens
    const newAccessToken = this.jwt.signAccessToken({
      sub: user.id,
      tenant_id: user.tenant_id,
      email: user.email,
      role: user.role,
      mfa_verified: newSession.mfa_verified,
      sid: newSession.jti,
    });
    const newRefreshTokenSigned = this.jwt.signRefreshToken({
      sub: user.id,
      sid: newSession.jti,
      token_family: newSession.refresh_token_family,
      generation: newGeneration,
    });

    // Tache 2.1.12 AuditAuthService.logRefresh
    this.logger.log({ action: 'refresh_success', user_id: user.id, family: payload.token_family, generation: newGeneration });

    const accessExpiresAt = Math.floor(Date.now() / 1000) + JWT_PARAMS.ttl_access_seconds;
    const refreshExpiresAt = Math.floor(Date.now() / 1000) + JWT_PARAMS.ttl_refresh_seconds;

    return {
      access_token: newAccessToken,
      refresh_token: newRefreshTokenSigned,
      access_expires_at: accessExpiresAt,
      refresh_expires_at: refreshExpiresAt,
      token_type: 'Bearer',
    };
  }

  async getMe(userId: string): Promise<UserPublic> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw InvalidCredentialsError();
    return this.toPublicUser(user);
  }

  async listSessions(userId: string) {
    const sessions = await this.session.listUserSessions(userId);
    return sessions.map((s) => ({
      session_id: s.jti,
      ip: s.ip,
      user_agent: s.user_agent.slice(0, 200),
      mfa_verified: s.mfa_verified,
      created_at: new Date(s.created_at * 1000).toISOString(),
      last_seen_at: new Date(s.last_seen_at * 1000).toISOString(),
      expires_at: new Date(s.expires_at * 1000).toISOString(),
      remember_me: s.remember_me,
    }));
  }

  async revokeSpecificSession(userId: string, sid: string): Promise<void> {
    const session = await this.session.getSession(sid);
    if (!session || session.user_id !== userId) {
      throw new ApiAuthError('SESSION_NOT_FOUND', 'Session not found');
    }
    await this.session.revokeSession(sid);
  }

  private toPublicUser(user: AuthUser): UserPublic {
    return {
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      role: user.role,
      tenant_id: user.tenant_id,
      email_verified: user.email_verified_at !== null,
      mfa_enabled: user.mfa_enabled,
      locale: user.locale,
      created_at: user.created_at.toISOString(),
      last_login_at: user.last_login_at?.toISOString() ?? null,
    };
  }
}
```

### 6.11 `auth.controller.ts`

```typescript
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthService } from './auth.service.js';
import { Public } from './decorators/public.decorator.js';
import { CurrentAuth } from './decorators/current-auth.decorator.js';
import { SigninDto } from './dto/signin.dto.js';
import { RefreshDto } from './dto/refresh.dto.js';
import { SignoutDto } from './dto/signout.dto.js';
import type { AuthContext } from '@insurtech/auth';

function extractIp(req: Request): string {
  const xff = req.headers['x-forwarded-for'];
  const ip = (Array.isArray(xff) ? xff[0] : xff?.split(',')[0]) ?? req.socket?.remoteAddress ?? 'unknown';
  return ip.trim();
}

function extractRequestId(req: Request): string {
  return req.headers['x-request-id']?.toString() ?? 'unknown';
}

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('signin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate with email and password. Returns tokens or MFA challenge.' })
  @ApiResponse({ status: 200, description: 'Authentication successful (or MFA challenge required)' })
  @ApiResponse({ status: 401, description: 'Invalid credentials, account locked, or email not verified' })
  async signin(@Body() body: SigninDto, @Req() req: Request) {
    return this.authService.signin(
      { email: body.email, password: body.password, remember_me: body.remember_me },
      {
        ip: extractIp(req),
        user_agent: req.headers['user-agent'] ?? 'unknown',
        request_id: extractRequestId(req),
        remember_me: body.remember_me ?? false,
      },
    );
  }

  @Post('signout')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Sign out current session' })
  async signout(@CurrentAuth() auth: AuthContext) {
    if (auth.subject.kind !== 'user') return;
    await this.authService.signout(auth.subject.session_id);
  }

  @Post('signout-all')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign out all sessions for the current user (cross-device)' })
  async signoutAll(@CurrentAuth() auth: AuthContext) {
    if (auth.subject.kind !== 'user') return { sessions_revoked: 0 };
    return this.authService.signoutAll(auth.subject.user.id);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange refresh token for new access + refresh tokens (rotation)' })
  @ApiResponse({ status: 401, description: 'Token invalid, expired, or replay detected' })
  async refresh(@Body() body: RefreshDto, @Req() req: Request) {
    return this.authService.refresh(body.refresh_token, {
      ip: extractIp(req),
      user_agent: req.headers['user-agent'] ?? 'unknown',
      request_id: extractRequestId(req),
      remember_me: false,
    });
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  async me(@CurrentAuth() auth: AuthContext) {
    if (auth.subject.kind !== 'user') {
      throw new Error('me endpoint requires user subject');
    }
    return this.authService.getMe(auth.subject.user.id);
  }

  @Get('sessions')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List active sessions of current user' })
  async sessions(@CurrentAuth() auth: AuthContext) {
    if (auth.subject.kind !== 'user') return [];
    return this.authService.listSessions(auth.subject.user.id);
  }

  @Delete('sessions/:sid')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke a specific session of the current user' })
  async revokeSession(@CurrentAuth() auth: AuthContext, @Param('sid') sid: string) {
    if (auth.subject.kind !== 'user') return;
    await this.authService.revokeSpecificSession(auth.subject.user.id, sid);
  }
}
```

### 6.12 `auth.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule as AuthSharedModule } from '@insurtech/auth';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { UserModule } from '../user/user.module.js';

@Module({
  imports: [
    AuthSharedModule, // exports Argon2Service, JwtService, SessionService, etc.
    PassportModule.register({ defaultStrategy: 'jwt' }),
    UserModule, // provides UserRepository
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    {
      provide: APP_GUARD, // global guard
      useClass: JwtAuthGuard,
    },
  ],
  exports: [AuthService],
})
export class AuthModule {}
```

---

## 7. Tests complets

### 7.1 `auth.service.spec.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { AuthService } from './auth.service.js';
import {
  Argon2Service, JwtService, SessionService, HashingService,
  AuthRole, RefreshReplayDetectedError, TokenInvalidError,
} from '@insurtech/auth';
import { UserRepository, type AuthUser } from '../user/user.repository.js';
import { ApiAuthError } from './auth.errors.js';

const mockUser = (overrides: Partial<AuthUser> = {}): AuthUser => ({
  id: 'u1',
  email: 'a@b.com',
  display_name: 'Aicha',
  role: AuthRole.BrokerUser,
  tenant_id: 't1',
  password_hash: '$argon2id$v=19$m=65536,t=3,p=4$...',
  email_verified_at: new Date('2026-01-01'),
  mfa_enabled: false,
  locked_until: null,
  is_active: true,
  deleted_at: null,
  locale: 'fr-MA',
  created_at: new Date('2026-01-01'),
  last_login_at: null,
  ...overrides,
} as AuthUser);

describe('AuthService', () => {
  let service: AuthService;
  let userRepo: any;
  let argon2: any;
  let jwt: any;
  let session: any;
  let hashing: any;

  beforeEach(async () => {
    userRepo = {
      findByEmail: vi.fn(),
      findById: vi.fn(),
      updateLastLogin: vi.fn().mockResolvedValue(undefined),
    };
    argon2 = {
      verify: vi.fn(),
      verifyEmptyForTiming: vi.fn().mockResolvedValue(false),
    };
    jwt = {
      generateId: vi.fn(() => `id-${Math.random()}`),
      signAccessToken: vi.fn(() => 'access.token.x'),
      signRefreshToken: vi.fn(() => 'refresh.token.x'),
      verifyRefreshToken: vi.fn((t: string) => ({
        sub: 'u1', sid: 's1', token_family: 'fam1', generation: 1, jti: 'j1',
        iss: 'skalean-insurtech-api', iat: 1000, exp: 9999,
      })),
    };
    session = {
      createSession: vi.fn().mockResolvedValue({}),
      rotateSession: vi.fn(),
      revokeSession: vi.fn(),
      revokeUserSessions: vi.fn(),
      listUserSessions: vi.fn().mockResolvedValue([]),
      ensureValid: vi.fn(),
      getSession: vi.fn(),
    };
    hashing = {
      randomToken: vi.fn(() => 'tk-' + Math.random()),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserRepository, useValue: userRepo },
        { provide: Argon2Service, useValue: argon2 },
        { provide: JwtService, useValue: jwt },
        { provide: SessionService, useValue: session },
        { provide: HashingService, useValue: hashing },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
  });

  describe('signin', () => {
    it('returns tokens on valid credentials no MFA', async () => {
      userRepo.findByEmail.mockResolvedValue(mockUser());
      argon2.verify.mockResolvedValue(true);
      const r = await service.signin(
        { email: 'a@b.com', password: 'pwd' } as any,
        { ip: '1.1.1.1', user_agent: 'UA', request_id: 'r1', remember_me: false },
      );
      expect(r).toMatchObject({ mfa_required: false, access_token: 'access.token.x' });
    });

    it('returns mfa_required when MFA enabled', async () => {
      userRepo.findByEmail.mockResolvedValue(mockUser({ mfa_enabled: true }));
      argon2.verify.mockResolvedValue(true);
      const r = await service.signin(
        { email: 'a@b.com', password: 'pwd' } as any,
        { ip: '1.1.1.1', user_agent: 'UA', request_id: 'r1', remember_me: false },
      );
      expect(r).toMatchObject({ mfa_required: true });
    });

    it('throws InvalidCredentials when user not found (with timing defense)', async () => {
      userRepo.findByEmail.mockResolvedValue(null);
      await expect(service.signin(
        { email: 'a@b.com', password: 'pwd' } as any,
        { ip: '1.1.1.1', user_agent: 'UA', request_id: 'r1', remember_me: false },
      )).rejects.toThrow(/INVALID_CREDENTIALS/);
      expect(argon2.verifyEmptyForTiming).toHaveBeenCalled();
    });

    it('throws InvalidCredentials when password wrong', async () => {
      userRepo.findByEmail.mockResolvedValue(mockUser());
      argon2.verify.mockResolvedValue(false);
      await expect(service.signin(
        { email: 'a@b.com', password: 'pwd' } as any,
        { ip: '1.1.1.1', user_agent: 'UA', request_id: 'r1', remember_me: false },
      )).rejects.toThrow(/INVALID_CREDENTIALS/);
    });

    it('throws AccountLocked when locked_until in future', async () => {
      userRepo.findByEmail.mockResolvedValue(mockUser({ locked_until: new Date(Date.now() + 60000) }));
      await expect(service.signin(
        { email: 'a@b.com', password: 'pwd' } as any,
        { ip: '1.1.1.1', user_agent: 'UA', request_id: 'r1', remember_me: false },
      )).rejects.toThrow(/ACCOUNT_LOCKED/);
    });

    it('throws AccountDeleted when deleted_at not null', async () => {
      userRepo.findByEmail.mockResolvedValue(mockUser({ deleted_at: new Date() }));
      await expect(service.signin(
        { email: 'a@b.com', password: 'pwd' } as any,
        { ip: '1.1.1.1', user_agent: 'UA', request_id: 'r1', remember_me: false },
      )).rejects.toThrow(/ACCOUNT_DELETED/);
    });

    it('throws AccountDisabled when is_active false', async () => {
      userRepo.findByEmail.mockResolvedValue(mockUser({ is_active: false }));
      await expect(service.signin(
        { email: 'a@b.com', password: 'pwd' } as any,
        { ip: '1.1.1.1', user_agent: 'UA', request_id: 'r1', remember_me: false },
      )).rejects.toThrow(/ACCOUNT_DISABLED/);
    });

    it('throws EmailNotVerified when email_verified_at null', async () => {
      userRepo.findByEmail.mockResolvedValue(mockUser({ email_verified_at: null }));
      argon2.verify.mockResolvedValue(true);
      await expect(service.signin(
        { email: 'a@b.com', password: 'pwd' } as any,
        { ip: '1.1.1.1', user_agent: 'UA', request_id: 'r1', remember_me: false },
      )).rejects.toThrow(/EMAIL_NOT_VERIFIED/);
    });

    it('forces MFA challenge for broker_admin even without mfa_enabled', async () => {
      userRepo.findByEmail.mockResolvedValue(mockUser({ role: AuthRole.BrokerAdmin, mfa_enabled: false }));
      argon2.verify.mockResolvedValue(true);
      const r = await service.signin(
        { email: 'a@b.com', password: 'pwd' } as any,
        { ip: '1.1.1.1', user_agent: 'UA', request_id: 'r1', remember_me: false },
      );
      expect((r as any).mfa_required).toBe(true);
    });

    it('lowercase email before lookup', async () => {
      userRepo.findByEmail.mockResolvedValue(mockUser());
      argon2.verify.mockResolvedValue(true);
      await service.signin(
        { email: 'A@B.COM', password: 'pwd' } as any,
        { ip: '1.1.1.1', user_agent: 'UA', request_id: 'r1', remember_me: false },
      );
      expect(userRepo.findByEmail).toHaveBeenCalledWith('a@b.com');
    });
  });

  describe('signout', () => {
    it('revokes session', async () => {
      await service.signout('s1');
      expect(session.revokeSession).toHaveBeenCalledWith('s1');
    });
  });

  describe('signoutAll', () => {
    it('revokes all user sessions', async () => {
      session.revokeUserSessions.mockResolvedValue(3);
      const r = await service.signoutAll('u1');
      expect(r).toEqual({ sessions_revoked: 3 });
    });
  });

  describe('refresh', () => {
    it('rotates and returns new tokens', async () => {
      session.rotateSession.mockResolvedValue({
        user_id: 'u1', tenant_id: 't1', role: AuthRole.BrokerUser,
        jti: 'newJti', refresh_token_family: 'fam1', refresh_generation: 2,
        ip: '1.1.1.1', user_agent: 'UA', mfa_verified: false, remember_me: false,
        created_at: 1000, last_seen_at: 1000, expires_at: 9999,
      });
      userRepo.findById.mockResolvedValue(mockUser());

      const r = await service.refresh('refresh.token.x', {
        ip: '1.1.1.1', user_agent: 'UA', request_id: 'r1', remember_me: false,
      });
      expect(r.access_token).toBe('access.token.x');
      expect(r.refresh_token).toBe('refresh.token.x');
    });

    it('throws TokenReuseDetected on replay', async () => {
      session.rotateSession.mockRejectedValue(new RefreshReplayDetectedError('fam', 1, 5));
      userRepo.findById.mockResolvedValue(mockUser());
      await expect(service.refresh('refresh.token.x', {
        ip: '1.1.1.1', user_agent: 'UA', request_id: 'r1', remember_me: false,
      })).rejects.toThrow(/TOKEN_REUSE_DETECTED/);
    });

    it('throws TokenInvalid when refresh signature invalid', async () => {
      jwt.verifyRefreshToken.mockImplementation(() => {
        throw new TokenInvalidError('bad signature');
      });
      await expect(service.refresh('bad.token', {
        ip: '1.1.1.1', user_agent: 'UA', request_id: 'r1', remember_me: false,
      })).rejects.toThrow(/TOKEN_INVALID/);
    });
  });

  describe('getMe', () => {
    it('returns public user profile', async () => {
      userRepo.findById.mockResolvedValue(mockUser());
      const r = await service.getMe('u1');
      expect(r.id).toBe('u1');
      expect(r).not.toHaveProperty('password_hash');
    });

    it('throws when user not found', async () => {
      userRepo.findById.mockResolvedValue(null);
      await expect(service.getMe('u1')).rejects.toThrow(/INVALID_CREDENTIALS/);
    });
  });

  describe('listSessions', () => {
    it('truncates user_agent to 200 chars', async () => {
      session.listUserSessions.mockResolvedValue([{
        user_id: 'u1', tenant_id: 't1', role: AuthRole.BrokerUser, jti: 'j1',
        refresh_token_family: 'f1', refresh_generation: 1,
        ip: '1.1.1.1', user_agent: 'X'.repeat(500), mfa_verified: false, remember_me: false,
        created_at: 1000, last_seen_at: 1000, expires_at: 9999,
      }]);
      const r = await service.listSessions('u1');
      expect(r[0].user_agent.length).toBeLessThanOrEqual(200);
    });
  });
});
```

### 7.2 `auth.controller.spec.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import type { AuthContext } from '@insurtech/auth';
import { AuthRole } from '@insurtech/auth';

const mockAuth: AuthContext = {
  subject: {
    kind: 'user',
    user: {
      id: 'u1', email: 'a@b.com', display_name: 'A',
      role: AuthRole.BrokerUser, tenant_id: 't1',
      mfa_enabled: false, mfa_verified: false, email_verified: true,
      locale: 'fr-MA', created_at: '2026-01-01T00:00:00Z',
    },
    session_id: 's1',
    jwt_id: 'j1',
  },
  ip: '1.1.1.1',
  user_agent: 'UA',
  request_id: 'r1',
  authenticated_at: 1000,
};

describe('AuthController', () => {
  let controller: AuthController;
  let service: any;

  beforeEach(async () => {
    service = {
      signin: vi.fn(),
      signout: vi.fn(),
      signoutAll: vi.fn(),
      refresh: vi.fn(),
      getMe: vi.fn(),
      listSessions: vi.fn(),
      revokeSpecificSession: vi.fn(),
    };
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: service }],
    }).compile();
    controller = moduleRef.get(AuthController);
  });

  it('signin delegates to AuthService', async () => {
    service.signin.mockResolvedValue({ mfa_required: false });
    const req = { headers: { 'user-agent': 'UA', 'x-request-id': 'r1' }, socket: { remoteAddress: '1.1.1.1' } } as any;
    await controller.signin({ email: 'a@b.com', password: 'p' } as any, req);
    expect(service.signin).toHaveBeenCalled();
  });

  it('signout calls revokeSession', async () => {
    await controller.signout(mockAuth);
    expect(service.signout).toHaveBeenCalledWith('s1');
  });

  it('signoutAll calls revokeUserSessions', async () => {
    service.signoutAll.mockResolvedValue({ sessions_revoked: 3 });
    const r = await controller.signoutAll(mockAuth);
    expect(r).toEqual({ sessions_revoked: 3 });
  });

  it('me returns user profile', async () => {
    service.getMe.mockResolvedValue({ id: 'u1' });
    const r = await controller.me(mockAuth);
    expect(r).toEqual({ id: 'u1' });
  });

  it('sessions returns list', async () => {
    service.listSessions.mockResolvedValue([]);
    const r = await controller.sessions(mockAuth);
    expect(r).toEqual([]);
  });

  it('refresh delegates with body and context', async () => {
    service.refresh.mockResolvedValue({ access_token: 'a' });
    const req = { headers: { 'user-agent': 'UA' }, socket: { remoteAddress: '1.1.1.1' } } as any;
    await controller.refresh({ refresh_token: 'r' } as any, req);
    expect(service.refresh).toHaveBeenCalledWith('r', expect.any(Object));
  });

  it('revokeSession delegates', async () => {
    await controller.revokeSession(mockAuth, 'sx');
    expect(service.revokeSpecificSession).toHaveBeenCalledWith('u1', 'sx');
  });
});
```

### 7.3 `jwt.strategy.spec.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { JwtStrategy } from './jwt.strategy.js';
import { JwtService, SessionService, AuthRole } from '@insurtech/auth';
import { UserRepository } from '../../user/user.repository.js';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let userRepo: any;
  let jwtService: any;
  let sessionService: any;

  beforeEach(async () => {
    process.env.JWT_SECRET = randomBytes(48).toString('base64');
    process.env.JWT_REFRESH_SECRET = randomBytes(48).toString('base64');
    userRepo = { findById: vi.fn() };
    jwtService = {};
    sessionService = {
      ensureValid: vi.fn(),
      touchLastSeen: vi.fn().mockResolvedValue(undefined),
    };
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      providers: [
        JwtStrategy,
        { provide: JwtService, useValue: jwtService },
        { provide: SessionService, useValue: sessionService },
        { provide: UserRepository, useValue: userRepo },
      ],
    }).compile();
    strategy = moduleRef.get(JwtStrategy);
  });

  it('validates and returns AuthContext', async () => {
    userRepo.findById.mockResolvedValue({
      id: 'u1', email: 'a@b.com', display_name: 'A',
      role: AuthRole.BrokerUser, tenant_id: 't1',
      mfa_enabled: false, email_verified_at: new Date(),
      is_active: true, deleted_at: null, locale: 'fr-MA',
      created_at: new Date(),
    });
    sessionService.ensureValid.mockResolvedValue({ jti: 's1' });

    const req = {
      headers: { authorization: 'Bearer a.b.c', 'user-agent': 'UA', 'x-request-id': 'r1' },
      socket: { remoteAddress: '1.1.1.1' },
    } as any;

    const auth = await strategy.validate(req, {
      sub: 'u1', tenant_id: 't1', email: 'a@b.com', role: AuthRole.BrokerUser,
      mfa_verified: false, jti: 'j1', sid: 's1',
      iss: 'skalean-insurtech-api', aud: 'skalean-insurtech-app',
      iat: 1000, exp: 9999, nbf: 1000,
    });
    expect(auth.subject.kind).toBe('user');
  });

  it('throws when user not found', async () => {
    userRepo.findById.mockResolvedValue(null);
    sessionService.ensureValid.mockResolvedValue({});
    await expect(strategy.validate(
      { headers: {} } as any,
      { sub: 'u1', tenant_id: null, email: 'x', role: AuthRole.BrokerUser, mfa_verified: false, jti: 'j1', sid: 's1', iss: '', aud: '', iat: 1, exp: 1, nbf: 1 },
    )).rejects.toThrow();
  });

  it('throws when session revoked', async () => {
    userRepo.findById.mockResolvedValue({ id: 'u1' });
    sessionService.ensureValid.mockRejectedValue(new Error('revoked'));
    await expect(strategy.validate(
      { headers: {} } as any,
      { sub: 'u1', tenant_id: null, email: 'x', role: AuthRole.BrokerUser, mfa_verified: false, jti: 'j1', sid: 's1', iss: '', aud: '', iat: 1, exp: 1, nbf: 1 },
    )).rejects.toThrow();
  });

  it('throws when account deleted', async () => {
    userRepo.findById.mockResolvedValue({
      id: 'u1', deleted_at: new Date(), is_active: true, email: 'x', display_name: 'X',
      role: AuthRole.BrokerUser, tenant_id: null, mfa_enabled: false,
      email_verified_at: new Date(), locale: 'fr-MA', created_at: new Date(),
    });
    sessionService.ensureValid.mockResolvedValue({});
    await expect(strategy.validate(
      { headers: {} } as any,
      { sub: 'u1', tenant_id: null, email: 'x', role: AuthRole.BrokerUser, mfa_verified: false, jti: 'j1', sid: 's1', iss: '', aud: '', iat: 1, exp: 1, nbf: 1 },
    )).rejects.toThrow();
  });

  it('throws when account disabled', async () => {
    userRepo.findById.mockResolvedValue({
      id: 'u1', deleted_at: null, is_active: false, email: 'x', display_name: 'X',
      role: AuthRole.BrokerUser, tenant_id: null, mfa_enabled: false,
      email_verified_at: new Date(), locale: 'fr-MA', created_at: new Date(),
    });
    sessionService.ensureValid.mockResolvedValue({});
    await expect(strategy.validate(
      { headers: {} } as any,
      { sub: 'u1', tenant_id: null, email: 'x', role: AuthRole.BrokerUser, mfa_verified: false, jti: 'j1', sid: 's1', iss: '', aud: '', iat: 1, exp: 1, nbf: 1 },
    )).rejects.toThrow();
  });
});
```

### 7.4 `jwt-auth.guard.spec.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard.js';

describe('JwtAuthGuard', () => {
  it('returns true for @Public routes', () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(true) } as any;
    const guard = new JwtAuthGuard(reflector);
    const ctx = { getHandler: vi.fn(), getClass: vi.fn() } as any;
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('delegates to passport AuthGuard for protected routes', () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(false) } as any;
    const guard = new JwtAuthGuard(reflector);
    const ctx = { getHandler: vi.fn(), getClass: vi.fn(), switchToHttp: () => ({ getRequest: () => ({}) }) } as any;
    // canActivate from AuthGuard returns Observable / Promise / boolean -- skip exact assertion
    const r = guard.canActivate(ctx);
    expect(r).toBeDefined();
  });
});
```

### 7.5 E2E `auth.e2e-spec.ts` (extrait)

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
// ... module bootstrap with test DB Postgres + ioredis-mock

describe('Auth E2E', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();

    // Seed user
    // ... insert into auth_users via repository
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /auth/signin returns tokens', async () => {
    const r = await request(app.getHttpServer())
      .post('/api/v1/auth/signin')
      .send({ email: 'test@example.com', password: 'StrongP@ss123!' });
    expect(r.status).toBe(200);
    expect(r.body.access_token).toBeDefined();
    expect(r.body.refresh_token).toBeDefined();
  });

  it('POST /auth/signin with wrong password returns 401', async () => {
    const r = await request(app.getHttpServer())
      .post('/api/v1/auth/signin')
      .send({ email: 'test@example.com', password: 'wrong' });
    expect(r.status).toBe(401);
    expect(r.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('GET /auth/me requires Bearer token', async () => {
    const r = await request(app.getHttpServer()).get('/api/v1/auth/me');
    expect(r.status).toBe(401);
  });

  it('GET /auth/me with valid token returns user', async () => {
    const signin = await request(app.getHttpServer())
      .post('/api/v1/auth/signin')
      .send({ email: 'test@example.com', password: 'StrongP@ss123!' });
    const token = signin.body.access_token;
    const r = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(r.status).toBe(200);
    expect(r.body.email).toBe('test@example.com');
  });

  it('POST /auth/refresh rotates tokens', async () => {
    const signin = await request(app.getHttpServer())
      .post('/api/v1/auth/signin')
      .send({ email: 'test@example.com', password: 'StrongP@ss123!' });
    const r = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refresh_token: signin.body.refresh_token });
    expect(r.status).toBe(200);
    expect(r.body.refresh_token).not.toBe(signin.body.refresh_token);
  });

  it('POST /auth/refresh replay attack revokes family', async () => {
    const signin = await request(app.getHttpServer())
      .post('/api/v1/auth/signin')
      .send({ email: 'test@example.com', password: 'StrongP@ss123!' });
    const oldRefresh = signin.body.refresh_token;

    // Legit refresh
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refresh_token: oldRefresh });

    // Attacker replays
    const r = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refresh_token: oldRefresh });
    expect(r.status).toBe(401);
    expect(r.body.code).toBe('TOKEN_REUSE_DETECTED');
  });

  it('POST /auth/signout revokes current session', async () => {
    const signin = await request(app.getHttpServer())
      .post('/api/v1/auth/signin')
      .send({ email: 'test@example.com', password: 'StrongP@ss123!' });
    const token = signin.body.access_token;
    const signoutR = await request(app.getHttpServer())
      .post('/api/v1/auth/signout')
      .set('Authorization', `Bearer ${token}`);
    expect(signoutR.status).toBe(204);

    // Try to use old token
    const meR = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(meR.status).toBe(401);
  });

  it('GET /auth/sessions lists active sessions', async () => {
    const signin = await request(app.getHttpServer())
      .post('/api/v1/auth/signin')
      .send({ email: 'test@example.com', password: 'StrongP@ss123!' });
    const token = signin.body.access_token;
    const r = await request(app.getHttpServer())
      .get('/api/v1/auth/sessions')
      .set('Authorization', `Bearer ${token}`);
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body)).toBe(true);
  });
});
```

---

## 8. Variables environnement

Aucune variable nouvelle introduite par cette tache (toutes deja Sprint 5 Tache 2.1.4 pour JWT, Tache 2.1.5 pour Redis, Tache 2.1.2 pour pepper). Les imports utilisent `JWT_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ISSUER`, `JWT_AUDIENCE`, `REDIS_*`, `PASSWORD_PEPPER`, `MFA_SECRET_ENCRYPTION_KEY`.

---

## 9. Commandes shell

```bash
cd repo
pnpm --filter @insurtech/api add @nestjs/passport@10.0.3 passport@0.7.0 passport-jwt@4.0.1
pnpm --filter @insurtech/api add -D @types/passport-jwt@4.0.1 supertest@7.0.0 @types/supertest@6.0.2
pnpm --filter @insurtech/api typecheck
pnpm --filter @insurtech/api test
pnpm --filter @insurtech/api test:e2e
pnpm --filter @insurtech/api build
```

---

## 10. Criteres validation V1-V42

### Criteres P0 (bloquants -- 24)

- **V1-V3 (P0)** : typecheck, build, test pass.
- **V4 (P0)** : POST /signin avec creds valides retourne 200 + tokens.
- **V5 (P0)** : POST /signin mauvais password retourne 401 INVALID_CREDENTIALS.
- **V6 (P0)** : POST /signin user inexistant retourne 401 INVALID_CREDENTIALS (timing-safe).
- **V7 (P0)** : POST /signin compte locke retourne 401 ACCOUNT_LOCKED + retry_after.
- **V8 (P0)** : POST /signin email non-verifie retourne 401 EMAIL_NOT_VERIFIED.
- **V9 (P0)** : POST /signin compte deleted retourne 401 ACCOUNT_DELETED.
- **V10 (P0)** : POST /signin compte disabled retourne 401 ACCOUNT_DISABLED.
- **V11 (P0)** : POST /signin user MFA-enabled retourne mfa_required true.
- **V12 (P0)** : POST /signin broker_admin force MFA meme si mfa_enabled false.
- **V13 (P0)** : POST /signout revoke session courante (token devient invalide).
- **V14 (P0)** : POST /signout-all revoke toutes sessions du user.
- **V15 (P0)** : POST /refresh rotate -> nouveau couple, ancien refresh invalide.
- **V16 (P0)** : POST /refresh replay -> 401 TOKEN_REUSE_DETECTED + family revoke.
- **V17 (P0)** : POST /refresh sans refresh_token retourne 400 (Zod).
- **V18 (P0)** : GET /me sans token retourne 401.
- **V19 (P0)** : GET /me avec token valide retourne user (sans password_hash).
- **V20 (P0)** : GET /sessions retourne array sessions actives.
- **V21 (P0)** : DELETE /sessions/:sid revoque la session specifique.
- **V22 (P0)** : DELETE /sessions/:sid d'un autre user retourne 401.
- **V23 (P0)** : Email lowercase au signin (case-insensitive lookup).
- **V24 (P0)** : @Public() endpoint contourne JwtAuthGuard.

### Criteres P1 (importants -- 12)

- **V25 (P1)** : @CurrentAuth() decorator retourne AuthContext typed.
- **V26 (P1)** : `request.auth` populate par JwtStrategy.
- **V27 (P1)** : `last_login_at` update apres signin success (fire-and-forget).
- **V28 (P1)** : `last_seen_at` touch au request authentifie (debounced 60s).
- **V29 (P1)** : Logger n'imprime jamais password ni hash entier.
- **V30 (P1)** : OpenAPI Swagger decorators presents sur chaque endpoint.
- **V31 (P1)** : Coverage >= 88%.
- **V32 (P1)** : Aucune emoji.
- **V33 (P1)** : Aucun console.log.
- **V34 (P1)** : Aucun any implicite.
- **V35 (P1)** : Tests E2E 15+ scenarios passent.
- **V36 (P1)** : User_agent truncate a 200 chars dans /sessions.

### Criteres P2 (nice-to-have -- 6)

- **V37 (P2)** : Health endpoint /health public sans auth.
- **V38 (P2)** : Bench signin < 600 ms (Argon2 dominate).
- **V39 (P2)** : Bench me < 5 ms (Redis + DB lookup).
- **V40 (P2)** : Documentation JSDoc complete.
- **V41 (P2)** : Tests E2E avec ioredis-mock + Postgres testcontainer.
- **V42 (P2)** : Audit log Tache 2.1.12 declenche pour signin/signout/refresh.

---

## 11. Edge cases

1. **Race signin/signout** : signin emet token, signout immediatement -- token deja invalide. OK.
2. **Race signout/signout-all** : OK, idempotent.
3. **Refresh apres signout-all** : 401 TOKEN_REUSE ou SESSION_NOT_FOUND. OK.
4. **Signin avec email contenant '+' (alias gmail)** : OK, regex EMAIL accepte.
5. **Signin password 128 chars exactement** : OK, regex max 128.
6. **Signin password 129 chars** : Zod reject 400.
7. **Refresh avec refresh_token expire** : 401 TOKEN_EXPIRED.
8. **Concurrent refresh 2 paralleles** : 1 succede 1 fail TOKEN_REUSE. OK.
9. **Signin avec remember_me true** : session TTL 30 jours.
10. **GET /me apres user delete (deleted_at set)** : JwtStrategy.validate throw 401.
11. **GET /me apres tenant suspendu** : Sprint 5 = pas de check. Sprint 6 ajoutera.
12. **Multiple Authorization headers** : nginx concatene -- parseAuthHeader retourne null. 401.
13. **Token avec wrong issuer** : passport-jwt reject. 401 TOKEN_ISSUER_INVALID.
14. **Token avec wrong audience** : passport-jwt reject. 401 TOKEN_AUDIENCE_INVALID.
15. **Connection Redis lost durant signin** : sessionService.createSession throw. Signin throw 503.

---

## 12. Conformite Maroc

- **Loi 09-08 article 23** : password jamais en clair dans logs. argon2id verification + pepper.
- **Loi 09-08 article 21** : breach 72h CNDP via TOKEN_REUSE_DETECTED Kafka event Sprint 18 SecurityIncidentService.
- **ACAPS circulaire 2024** : MFA mandatory pour broker_admin, garage_admin, super_admin_platform, analyst_support (helper isMfaMandatory). Tache 2.1.7 enrolle MFA des signup.
- **Bank Al-Maghrib 2014/G/4** : encryption at rest Sprint 35 Atlas KMS.

---

## 13. Conventions absolues

Multi-tenant : tenant_id propage via AuthContext. Validation : Zod via createZodDto. Logger Pino NestJS. Hash : argon2id via Argon2Service injecte. pnpm. TS strict. Tests 50+. RBAC : role dans AuthContext, RolesGuard Sprint 7. Events : Tache 2.1.12 publish via AuditAuthService. Imports order. Skalean AI : aucun. No-emoji. Idempotency-Key : Sprint 5 Tache 2.1.9 ajoutera sur /signup. Conventional Commits. Cloud souverain. Crypto : reuse services existants. JSDoc + Swagger. Performance : signin 200-600ms, me < 5ms.

---

## 14. Validation pre-commit

```bash
cd repo
pnpm --filter @insurtech/api typecheck
pnpm --filter @insurtech/api lint:check
pnpm --filter @insurtech/api test
pnpm --filter @insurtech/api test:e2e
pnpm --filter @insurtech/api test:coverage
pnpm --filter @insurtech/api build

grep -rP "[\x{1F300}-\x{1F9FF}]" apps/api/src && exit 1 || echo OK
grep -rn "console\.log" apps/api/src --include="*.ts" && exit 1 || echo OK
```

---

## 15. Commit message

```bash
git add -A
git commit -m "feat(sprint-05): implement AuthModule + Controller + Service + JwtStrategy + Guard

Implements the NestJS integration layer for authentication endpoints :
AuthModule with global JwtAuthGuard (default deny + @Public opt-in),
AuthController with 6 endpoints (signin, signout, signout-all,
refresh, me, sessions, delete-session), AuthService orchestrating
Argon2 + Jwt + Session services from @insurtech/auth, JwtStrategy
populating request.auth with AuthContext typed subject, @CurrentAuth
decorator, and 6 Zod-derived DTOs. Theft detection in refresh via
SessionService.rotateSession atomic. Timing-safe user enumeration
defense via Argon2Service.verifyEmptyForTiming.

Livrables :
- AuthModule, AuthController (6 endpoints), AuthService
- JwtStrategy (passport-jwt), JwtAuthGuard (chained PublicEndpointGuard)
- @CurrentAuth(), @Public() decorators
- 6 DTOs with createZodDto from @insurtech/auth schemas
- Custom errors with HTTP mapping (ApiAuthError + helpers)
- 50+ tests (unit + E2E with supertest)
- OpenAPI Swagger annotations on each endpoint

Tests : 25 service + 12 controller + 8 strategy + 6 guard + 4 decorator + 15 E2E
Coverage : >= 88%

Task: 2.1.6
Sprint: 5 (Phase 2 / Sprint 1)
Phase: 2 -- Securite & Multi-tenant
Reference: B-05 Tache 2.1.6"
```

---

## 16. Workflow next step

Apres commit, passer a `task-2.1.7-mfa-service.md` qui implementera le `MfaService` complet (TOTP RFC 6238 + QR generation + recovery codes) et les endpoints `/api/v1/auth/setup-mfa`, `/verify-mfa`, `/disable-mfa`.

---

## Annexe A. UserRepository contract

Cette tache consomme un `UserRepository` qui n'est pas detaille ici (Sprint 2 a livre une version basique, Sprint 6 va l'enrichir avec multi-tenant). Pour permettre a Claude Code de progresser sans dependance bloquante, voici le contrat minimal attendu :

```typescript
// repo/apps/api/src/modules/user/user.repository.ts
import { Injectable } from '@nestjs/common';
import type { AuthRole } from '@insurtech/auth';

export interface AuthUser {
  id: string;
  email: string;
  display_name: string;
  role: AuthRole;
  tenant_id: string | null;
  password_hash: string;
  password_pepper_version: number;
  email_verified_at: Date | null;
  mfa_enabled: boolean;
  mfa_secret_encrypted: string | null;
  mfa_recovery_codes_hashes: string[];
  is_active: boolean;
  deleted_at: Date | null;
  locked_until: Date | null;
  failed_login_attempts: number;
  last_login_at: Date | null;
  last_login_ip: string | null;
  locale: 'fr-MA' | 'ar-MA' | 'en' | 'fr-FR';
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class UserRepository {
  // Sprint 2 / Sprint 6 implementations not detailed here
  async findByEmail(email: string): Promise<AuthUser | null> { throw new Error('Sprint 2 implementation'); }
  async findById(id: string): Promise<AuthUser | null> { throw new Error('Sprint 2 implementation'); }
  async updateLastLogin(id: string, at: Date, ip: string): Promise<void> { throw new Error('Sprint 2 implementation'); }
  async update(id: string, patch: Partial<AuthUser>): Promise<void> { throw new Error('Sprint 2 implementation'); }
  async create(input: Omit<AuthUser, 'id' | 'created_at' | 'updated_at'>): Promise<AuthUser> { throw new Error('Sprint 2 implementation'); }
}
```

Le module `UserModule` est suppose deja exister (Sprint 2). Si Sprint 5 detecte qu'il n'existe pas encore, creer un stub minimal `repo/apps/api/src/modules/user/user.module.ts` exportant `UserRepository` puis faire un TODO comment pointant vers Sprint 6 pour l'implementation drizzle.

## Annexe B. Runbook operationnel signin

### B.1 Procedure d'incident "signin failure rate spike"

Si le dashboard "Auth Health" Sprint 33 detecte un spike de signin failures (rate > 30% sur 5 minutes), c'est potentiellement (a) attaque credential stuffing, (b) bug deploiement, (c) Argon2 service down.

Investigation : (1) check ratio par error code -- INVALID_CREDENTIALS dominant suggere attaque ou deploiement password rules ; ACCOUNT_LOCKED dominant suggere attaque locks accounts ; EMAIL_NOT_VERIFIED dominant suggere bug onboarding flow. (2) check les IPs sources -- si concentree, blocage Sprint 14 rate limit IP. (3) check correlation avec deploiement recent -- rollback si necessaire. (4) check metriques Argon2 (`argon2_verify_duration_ms`, `argon2_verify_total{result="error"}`) pour detecter bug crypto.

Mitigation : Si attaque distribuee : activer captcha Sprint 18 sur signin endpoint. Si attaque IP unique : firewall block. Si bug deploiement : rollback. Si Argon2 down : restart pod, investigate memory pressure.

### B.2 Procedure de bug "user can't signin after password change"

Scenario : un utilisateur change son password puis ne peut plus se connecter avec le nouveau.

Investigation : (1) check audit log Tache 2.1.12 pour confirmer le password change a ete enregistre ; (2) check via `psql` que `auth_users.password_hash` a ete mis a jour ; (3) check si Argon2Service.hash a ete utilise (vs bcrypt par accident) ; (4) check si pepper applique correctement ; (5) check si la session courante a ete revoquee correctement (signout-all attendu apres password change Tache 2.1.11).

Solution : 9/10 cas, l'utilisateur saisit le nouveau password incorrectement (capslock, autocomplete navigateur saved old). Demander de verifier. Si bug code, rollback urgent.

### B.3 Procedure d'audit ACAPS "demande historique signin user X"

ACAPS peut demander l'historique des signin d'un user X sur 12 derniers mois. Procedure :

(1) Query `audit_log WHERE event_kind IN ('signin_success', 'signin_failed', 'signin_locked') AND user_id = X AND occurred_at >= NOW() - INTERVAL '12 months' ORDER BY occurred_at`. (2) Si > 90 jours, completer avec `auth_sessions_archive` (cold storage Sprint 35). (3) Exporter en CSV signe via `pnpm acaps-export-signin-history --user-id X --start 2025-05-06 --end 2026-05-06 --output /tmp/X.csv.gpg`. (4) Le DPO Sprint 18 valide le contenu (anonymisation eventuelle des IPs si demande couvre une periode pre-CNDP-compliance). (5) Transmission ACAPS via canal officiel (jamais email). (6) Log de la transmission dans `audit_log` (event `acaps_disclosure`).

## Annexe C. Edge cases supplementaires (16-30)

### Edge case 16 : Reverse proxy strip Authorization header

Scenario : un reverse proxy mal configure (nginx, AWS ALB) strip ou modifie le header Authorization.
Probleme : passport-jwt ne trouve pas le token, retourne 401.
Solution : Sprint 32 documenter dans le Dockerfile + nginx.conf que `proxy_set_header Authorization $http_authorization` doit etre present. Verifie via test E2E qui passe a travers le reverse proxy.

### Edge case 17 : `signin` avec password contenant null byte

Scenario : password = `"valid\0pass"`.
Probleme : certains parsers downstream traitent `\0` comme terminateur. Bug potentiel.
Solution : Zod regex password rejette null byte (`/^...$/` avec class explicit characters). Verifie test V25.

### Edge case 18 : `refresh` sans body `refresh_token`

Scenario : client mal code envoie POST /refresh body vide.
Probleme : Zod refresh.dto.ts rejette avec 400 BAD_REQUEST.
Solution : NestJS ZodValidationPipe global Sprint 3 catch. Test V17.

### Edge case 19 : `me` retourne donnees stale apres update profile

Scenario : user update display_name via Sprint 6 endpoint, puis appel /me.
Probleme : `me` lit la DB directement via UserRepository.findById, donc retourne donnees fresh. OK.

### Edge case 20 : `signout` deconnecte alors que JWT toujours valide signature-wise

Scenario : signout revoke session, mais l'access token reste signature-valide jusqu'a son exp (15 min).
Probleme : si l'attaquant a vole l'access token, il continue a l'utiliser jusqu'a expiry meme apres signout.
Solution : c'est connu et accepte trade-off (15 min max compromis). Sprint 14 considera blacklist access tokens (couteux Redis si beaucoup d'access tokens). Sprint 5 = limitation.

### Edge case 21 : Concurrent signout multiple devices

Scenario : user clique signout-all sur device A, simultanement device B fait une requete authentifiee.
Probleme : la requete B peut reussir car son token verify avant que SessionService.revokeUserSessions complete.
Solution : la requete B reussit -- comportement attendu (revocation eventually consistent). Sprint 35 multi-DC peut amplifier ce delay (~10s). Document.

### Edge case 22 : Refresh sur compte deleted entre signin et refresh

Scenario : user signin, admin delete account, user fait refresh.
Probleme : refresh flow (cette tache) verifie compte via UserRepository.findById dans `refresh` -> retourne null -> InvalidCredentialsError.
Solution : OK, verifie dans le code section 6.10.

### Edge case 23 : Tenant deleted apres signin actif

Scenario : tenant_id du user devient invalide.
Probleme : Sprint 6 gerera via TenantGuard. Sprint 5 = limitation acceptee.

### Edge case 24 : Locale change pendant la session

Scenario : user change locale fr-MA -> ar-MA via /me PATCH endpoint.
Probleme : access token contient toujours l'ancienne locale dans le payload.
Solution : la locale dans JWT est informative ; pour i18n, frontend lit `locale` from /me endpoint (fresh DB). La locale dans JWT n'est pas utilisee par les endpoints. Sprint 18 confirme.

### Edge case 25 : Heure systeme decalee de 30 secondes

Scenario : NTP drift sur instance API.
Probleme : tokens emis avec exp legerement futur, autres instances rejettent.
Solution : leeway 5s deja gere. Si drift > 5s, alerte Sprint 33. Cluster NTP synchronisation imperative.

### Edge case 26 : Cookie session vs JWT bearer

Scenario : Sprint 4 frontend utilise httpOnly cookie pour stocker le refresh token.
Probleme : refresh token dans cookie nec doit etre extrait differemment.
Solution : Sprint 5 cible API stateless avec Bearer header. Frontend Sprint 4 stocke en httpOnly cookie SameSite=Strict mais envoie en body au refresh endpoint. /signin response recoit refresh dans body, frontend le set en cookie via Set-Cookie response header.

### Edge case 27 : Mass signin via bot avec emails sequentiels

Scenario : attaquant tente signin avec emails `user1@victim.com`, `user2@victim.com`, ... pour enumeration.
Probleme : `verifyEmptyForTiming` defend timing, mais la latence est mesurable.
Solution : Tache 2.1.14 RateLimit par IP. Sprint 14 ajoutera CAPTCHA apres 3 echecs IP.

### Edge case 28 : Memory pressure pendant signin (Argon2 64MB)

Scenario : 100 signins concurrents = 6.4 GB d'allocation ephemerale.
Probleme : container OOM si limit insuffisante.
Solution : Sprint 32 dimensionne limit 8 GB par pod, max 5 pods en peak. Rate limit Tache 2.1.14 borne a 5 signins/min/IP+email.

### Edge case 29 : Race entre signin et MFA setup

Scenario : user signin (mfa_enabled false), avant signin complete, admin force MFA mandatory.
Probleme : signin retourne tokens sans MFA challenge.
Solution : la query est read at signin start ; eventually consistent. Acceptable.

### Edge case 30 : Sessions zombies (Redis sans Postgres ou inverse)

Scenario : Postgres insert fail (timeout) mais Redis OK.
Probleme : session active en Redis sans audit row.
Solution : audit log Sprint 5 Tache 2.1.12 utilise Kafka events (pas Postgres direct). `auth_sessions` Postgres = audit double-write best-effort. La source de verite Redis garantit le flow auth fonctionne. Sprint 33 monitore le drift.

## Annexe D. Monitoring Sprint 33

### D.1 Metriques Prometheus

```
auth_signin_total                       counter labels=result(success|invalid_creds|locked|email_not_verified|deleted|disabled|mfa_required), tenant_id (top 50)
auth_signin_duration_ms                 histogram
auth_refresh_total                      counter labels=result(success|replay|invalid|expired)
auth_refresh_duration_ms                histogram
auth_signout_total                      counter labels=type(single|all|specific)
auth_me_duration_ms                     histogram
auth_sessions_listed_total              counter

auth_jwt_strategy_validate_total        counter labels=result(success|user_not_found|deleted|disabled|session_revoked)
auth_jwt_strategy_duration_ms           histogram

auth_lockout_check_total                counter
auth_password_verify_duration_ms        histogram (Argon2 dominate)

auth_global_guard_skipped_total         counter labels=path -- detection si trop de routes @Public
```

### D.2 Dashboards et alertes

Dashboard "Auth Operations" :
- Panel signin volume + success rate par tenant
- Panel refresh rotations + replay detections (alerte P0 si > 50/min)
- Panel signout types
- Panel /me latency p99 (target < 50 ms)
- Panel /sessions latency p99
- Panel JwtStrategy validate latency p99 (cumul avec session ensureValid + DB findById)

Alertes P0 :
- `auth_signin_total{result="invalid_creds"}` rate > 30% sur 5 min -> attaque potentielle
- `auth_refresh_total{result="replay"}` rate > 50/min -> theft attack
- `auth_jwt_strategy_validate_total{result="user_not_found"}` rate > 1/min -> race condition ou attack

### D.3 OpenTelemetry tracing

Sprint 33 ajoute spans distributed tracing :
- span `auth.signin` parent
  - span `userRepository.findByEmail`
  - span `argon2.verify` (long, dominant)
  - span `sessionService.createSession`
    - span `redis.SET`
    - span `postgres.INSERT` (async, parallel)
  - span `jwt.signAccessToken`
  - span `jwt.signRefreshToken`
  - span `userRepository.updateLastLogin` (fire-and-forget)
  - span `auditService.logSignin` (Tache 2.1.12)

Permet d'identifier les bottlenecks par span.

## Annexe E. Frontend integration patterns (Sprint 4 reference)

### E.1 Storage strategy

Sprint 4 documente que les frontends Next.js stockent les tokens ainsi :
- Access token : memoire JavaScript (jamais persist) -- expire en 15 min
- Refresh token : httpOnly cookie SameSite=Strict, secure, path=/api/v1/auth/refresh -- 30 jours
- User profile (cache /me) : sessionStorage ou Zustand store -- refresh on focus

Cette strategie minimise l'exposition XSS (httpOnly cookie inaccessible JS) tout en permettant le bearer Authorization header pour les requetes API.

### E.2 Refresh flow client-side

Le client intercepte les 401 access token expired, declenche silentiously POST /refresh, retry la requete originale. Si refresh echoue (replay detected, refresh expire), redirect /login.

```typescript
// Sprint 4 frontend pseudo-code
const apiClient = axios.create({ baseURL: '/api/v1' });
apiClient.interceptors.response.use(undefined, async (error) => {
  if (error.response?.status === 401 && error.response.data.code === 'TOKEN_EXPIRED') {
    try {
      const r = await axios.post('/api/v1/auth/refresh');
      authStore.setAccessToken(r.data.access_token);
      error.config.headers.Authorization = `Bearer ${r.data.access_token}`;
      return apiClient.request(error.config);
    } catch (refreshErr) {
      authStore.clear();
      router.push('/login');
      throw refreshErr;
    }
  }
  throw error;
});
```

### E.3 MFA flow client-side

Si signin retourne `mfa_required: true`, frontend redirect /verify-mfa avec le `mfa_challenge_token`. User saisit code TOTP, frontend POST /verify-mfa, recupere les tokens finaux.

## Annexe F. Performance benchmarks attendus

```
POST /signin (avec Argon2 verify):       median 280 ms  (p99: 450 ms) -- Argon2 dominate
POST /signin (user not found):           median 280 ms  (p99: 450 ms) -- timing-safe identique
POST /refresh:                           median 8 ms    (p99: 25 ms)
POST /signout:                           median 4 ms    (p99: 12 ms)
POST /signout-all (avg 3 sessions):      median 12 ms   (p99: 35 ms)
GET /me:                                 median 5 ms    (p99: 15 ms)
GET /sessions:                           median 6 ms    (p99: 18 ms)
JwtAuthGuard + JwtStrategy.validate:     median 2.5 ms  (p99: 8 ms)  -- cumul Redis + DB lookup
```

Latency cible Sprint 35 production p99 : signin < 500 ms, refresh < 30 ms, me < 20 ms.

## Annexe G. Tests E2E supplementaires

### G.1 Tests de locking + recovery

Tache 2.1.10 (Lockout) et 2.1.11 (Recovery) ajouteront leurs tests E2E. Cette tache prepare les hooks dans signin (commentaires `// Tache 2.1.10 LockoutService`).

### G.2 Tests de MFA flow

Tache 2.1.7 + 2.1.8 ajouteront tests E2E `/setup-mfa`, `/verify-mfa`, `/disable-mfa`. Cette tache fournit le `mfa_required: true` response que les tests Tache 2.1.8 valideront.

### G.3 Tests de signup -> verify-email -> signin

Tache 2.1.9 ajoutera le flow signup. Cette tache (signin) consomme l'`email_verified_at` produit par Tache 2.1.9.

### G.4 Tests cross-tenant isolation

Sprint 6 ajoutera : un user de tenant A ne peut pas /me sur tenant B (TenantGuard verifie). Cette tache pose les bases (tenant_id dans AuthContext).

## Annexe H. Specification OpenAPI 3.1 (extrait Sprint 33)

```yaml
paths:
  /api/v1/auth/signin:
    post:
      tags: [auth]
      summary: Authenticate with email and password
      security: []  # public endpoint
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/SigninDto' }
      responses:
        '200':
          description: Authentication successful or MFA challenge required
          content:
            application/json:
              schema:
                oneOf:
                  - $ref: '#/components/schemas/SigninSuccessResponse'
                  - $ref: '#/components/schemas/SigninMfaRequiredResponse'
        '401': { $ref: '#/components/responses/Unauthorized' }
        '429': { $ref: '#/components/responses/RateLimited' }

  /api/v1/auth/refresh:
    post:
      tags: [auth]
      summary: Exchange refresh token for new tokens (rotation)
      security: []  # public endpoint -- refresh token in body
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/RefreshDto' }
      responses:
        '200':
          description: Tokens rotated successfully
          content:
            application/json:
              schema: { $ref: '#/components/schemas/RefreshResponse' }
        '401':
          description: Token invalid, expired, or replay detected
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/AuthError'
                  - properties:
                      code:
                        type: string
                        enum: [TOKEN_EXPIRED, TOKEN_INVALID, TOKEN_REUSE_DETECTED]

  /api/v1/auth/signout:
    post:
      tags: [auth]
      summary: Sign out current session
      security:
        - BearerAuth: []
      responses:
        '204': { description: Session revoked }
        '401': { $ref: '#/components/responses/Unauthorized' }

  /api/v1/auth/signout-all:
    post:
      tags: [auth]
      summary: Sign out all sessions for current user
      security:
        - BearerAuth: []
      responses:
        '200':
          description: Sessions revoked count
          content:
            application/json:
              schema:
                type: object
                properties:
                  sessions_revoked: { type: integer }

  /api/v1/auth/me:
    get:
      tags: [auth]
      summary: Get current authenticated user profile
      security:
        - BearerAuth: []
      responses:
        '200':
          content:
            application/json:
              schema: { $ref: '#/components/schemas/UserPublic' }

  /api/v1/auth/sessions:
    get:
      tags: [auth]
      summary: List active sessions for current user
      security:
        - BearerAuth: []
      responses:
        '200':
          content:
            application/json:
              schema:
                type: array
                items: { $ref: '#/components/schemas/SessionPublic' }
```

---

**Fin du prompt task-2.1.6-auth-module-controller.md.**
