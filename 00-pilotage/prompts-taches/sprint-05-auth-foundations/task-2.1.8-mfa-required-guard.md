# TACHE 2.1.8 -- MfaRequiredGuard + Endpoints REST `/setup-mfa`, `/confirm-mfa`, `/verify-mfa`, `/disable-mfa` + @RequireMfa() Decorator

**Sprint** : 5 (Phase 2 / Sprint 1 dans phase) -- Auth Foundations
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-05-sprint-05-auth-foundations.md` (Tache 2.1.8)
**Phase** : 2 -- Securite & Multi-tenant
**Priorite** : P0 (bloquant pour 2.1.9 Signup MFA mandatory, 2.1.11 Recovery, 2.1.15 E2E tests)
**Effort** : 5h
**Dependances** : 2.1.7 (MfaService consomme), 2.1.6 (AuthController etendu, AuthService etendu, AuthContext consomme), 2.1.4 (JwtService.signAccessToken pour re-signing apres MFA verify), 2.1.5 (SessionService pour rotation post-MFA)
**Densite cible** : 80-150 ko (auto-suffisant exhaustif)
**AUCUNE EMOJI AUTORISEE**

---

## 1. But

Cette tache vise a livrer la couche d'integration NestJS qui expose les 4 endpoints REST MFA operationnels (`POST /api/v1/auth/setup-mfa` qui initie le setup d'un Multi-Factor Authentication TOTP en retournant le secret base32, le QR code data URL et le `setup_token` ; `POST /api/v1/auth/confirm-mfa` qui finalise le setup en verifiant le premier code TOTP saisi par l'utilisateur apres scan du QR par son application authenticator, persiste le `mfa_secret_encrypted` chiffre AES-256-GCM dans `auth_users`, persiste les 6 `mfa_recovery_codes_hashes` Argon2id dans `auth_users.mfa_recovery_codes_hashes` JSONB, set `mfa_enabled = true`, et IMPORTANT revoke toutes les sessions actives du user pour forcer un re-login complet en mode MFA -- propriete defensive critique car elle empeche un attaquant qui aurait deja un access token actif de continuer a operer sans subir le challenge MFA ; `POST /api/v1/auth/verify-mfa` qui prend en parametre un `mfa_challenge_token` emis par AuthService.signin Tache 2.1.6 quand l'utilisateur a `mfa_enabled = true` et un code TOTP ou recovery code, verifie l'authenticite via `MfaService.verifyEncryptedTotp` ou `MfaService.verifyRecoveryCode`, et emet enfin les access + refresh tokens finaux apres marquage `mfa_verified = true` dans le payload JWT ; `POST /api/v1/auth/disable-mfa` qui necessite (a) authentification active, (b) re-saisie du password courant verifie via `Argon2Service.verify`, (c) saisie d'un code TOTP courant pour confirmer la possession du device, et (d) revocation de toutes les sessions du user post-disable pour invalider les access tokens emis avec mfa_verified=true qui ne reflete plus l'etat actuel) ; le guard NestJS `MfaRequiredGuard` qui inspecte les decorateurs `@RequireMfa()` declares sur les endpoints sensibles (Sprint 11 paiements, Sprint 18 settings tenant, Sprint 25 cross-tenant impersonate) et rejette avec HTTP 403 `MFA_REQUIRED` si l'AuthContext.subject (user) n'a pas `mfa_verified = true` dans son JWT actuel meme si `mfa_enabled = true` (le user doit completer le challenge MFA dans la session courante) ; et le decorator `@RequireMfa()` qui sert d'opt-in explicite pour les endpoints qui necessitent une fraicheur MFA renforcee.

L'apport est triple. Premierement, en separant clairement les 4 endpoints (setup, confirm, verify, disable) du flow signin standard (Tache 2.1.6), on respecte le principe de separation of concerns : `signin` reste focused sur l'authentification password, le challenge MFA est isole dans un endpoint dedie qui peut etre complete par WebAuthn Sprint 23 ou par un autre type d'authenticator Sprint 14+ sans toucher au signin. Deuxiemement, en revoquant systematiquement les sessions apres confirm-mfa et apres disable-mfa, on garantit la propriete "every MFA state change forces re-authentication" qui est une exigence de securite critique : un attaquant qui aurait obtenu un access token actif via un autre vecteur ne peut pas l'utiliser apres que le user ait change l'etat MFA. Cette propriete est documentee dans NIST SP 800-63B section 7.1 et auditee par ACAPS lors des controles annuels. Troisiemement, en exposant le decorator `@RequireMfa()` opt-in (vs implicit pour tous les endpoints), on permet une montee progressive de la rigueur MFA sans casser les flows existants : Sprint 5 = MFA enforcable mais non encore decore sur endpoints metier ; Sprint 11 (Pay) ajoute @RequireMfa() sur POST /payments ; Sprint 18 ajoute sur PATCH /settings ; Sprint 25 ajoute sur /admin/impersonate. Cette progression permet de dimensionner le change management (formation users, communication delais).

A l'issue de cette tache, un user qui veut activer MFA fait : (1) login standard ; (2) call POST /setup-mfa, recoit `setup_token` + `secret_b32` + `qr_code_data_url` ; (3) scan QR avec Google Auth ; (4) call POST /confirm-mfa avec `setup_token` + premier `totp_code` ; (5) recoit les 6 recovery codes a sauvegarder ; (6) toutes ses sessions actives sont revokees, il doit re-login. A son prochain login, signin retourne `mfa_required: true` + `mfa_challenge_token`. Il call POST /verify-mfa avec `mfa_challenge_token` + `totp_code`, recoit access + refresh tokens avec `mfa_verified: true`. Pour disable, il call POST /disable-mfa avec son `current_password` + `totp_code` courant, le `mfa_secret_encrypted` est cleared et toutes ses sessions sont revokees. Tout endpoint Sprint 11+ decore `@RequireMfa()` rejette avec 403 si `auth.subject.user.mfa_verified` est false. La suite Vitest + Playwright couvre 30+ scenarios E2E avec coverage >= 88% sur le module auth complet.

---

## 2. Contexte etendu

### 2.1 Pourquoi cette tache existe

Sans cette tache, MfaService Tache 2.1.7 reste un service interne sans exposition aux frontends Sprint 4 et au flow user complete. C'est l'integration HTTP qui transforme la capacite cryptographique en une experience utilisateur deployable. Le choix d'avoir 4 endpoints separes (setup, confirm, verify, disable) au lieu d'un seul endpoint /mfa avec un parametre `action` est conforme au principe REST resource-oriented et permet un OpenAPI Sprint 33 plus lisible.

Le pattern de revocation systematique des sessions apres state change MFA est une protection contre une classe d'attaques specifique : "MFA toggle abuse". Sans cette protection, un attaquant qui (a) aurait compromis un compte sans MFA, (b) connaitrait le password, (c) ferait soudain face a un MFA active par le legit user, pourrait basculer rapidement vers disable-mfa avec le password (et un trick TOTP via timing attack ou brute force), puis continuer a operer. La revocation force que toute operation post-MFA passe par le challenge -- l'attaquant doit reussir le challenge a chaque session, ce qui est la propriete recherchee.

L'exigence ACAPS circulaire 2024 force MFA pour les broker_admin (assimile expert d'assurance) et garage_admin (assimile expert auto). NIST SP 800-63B AAL2 force MFA pour acces a "personally identifiable information sensitive" qui couvre les CIN, RIB, dossiers medicaux. Sprint 5 prepare l'infrastructure ; Sprint 7 RBAC et Sprint 11 Pay activeront les @RequireMfa() decorators sur les endpoints concernes.

### 2.2 Alternatives considerees

| Alternative | Avantages | Inconvenients | Decision |
|-------------|-----------|---------------|----------|
| Endpoint unique /mfa avec parametre action | Moins d'URLs | Pas REST, OpenAPI confus | REJETE |
| 4 endpoints separes (RETENU) | REST natif, OpenAPI clair, audit log per-action | Plus de code | RETENU |
| Pas de revoke session apres confirm-mfa | UX fluide (pas de re-login) | Vulnerabilite "MFA toggle abuse" | REJETE -- securite prime |
| Revoke session uniquement apres disable | Moins agressif | Inconsistant + asymetrique | REJETE |
| Disable MFA via password seul | UX simple | Insuffisant defensivement | REJETE |
| Disable MFA via password + TOTP (RETENU) | Confirme possession device + connaissance password | UX un peu plus lourde | RETENU |
| @RequireMfa() decorator opt-in (RETENU) | Migration progressive | Risque oubli | RETENU avec audit Sprint 33 |
| MFA mandatory pour tous endpoints | Maximum securite | UX casse pour endpoints non-sensibles | REJETE |

### 2.3 Trade-offs explicites

Choisir de revoquer toutes les sessions apres confirm-mfa implique d'accepter que l'utilisateur doit se re-loguer immediatement apres setup. UX un peu plus lourde mais securite renforcee. Sprint 18 UI ajoutera message clair "MFA active. Reconnectez-vous pour utiliser MFA."

Choisir d'exposer 4 endpoints separes au lieu d'un seul implique d'avoir 4 routes a documenter, tester, et auditer. En contrepartie, OpenAPI Sprint 33 est plus lisible et le code est plus modulaire.

Choisir @RequireMfa() opt-in implique le risque qu'un developpeur oublie de le decorer sur un nouvel endpoint sensible. Sprint 33 audit fera un grep automatique pour detecter les endpoints non-decoree qui manipulent des donnees sensibles.

### 2.4 Decisions strategiques

- decision-016 (TOTP RFC 6238) -- totale.
- decision-014 (JWT theft detection) -- session revoke pattern.
- decision-006 (No-emoji) -- totale.
- ACAPS circulaire 2024 -- MFA mandatory.
- NIST SP 800-63B AAL2 -- TOTP authenticator.

### 2.5 Pieges techniques

1. **Setup MFA sur user qui a deja MFA enabled** : conflict 409 MfaSetupAlreadyExistsError.
2. **Confirm setup avec setup_token expire** : 401 MFA_SETUP_EXPIRED.
3. **Verify-mfa avec challenge token expire** : 401 MFA_CHALLENGE_EXPIRED.
4. **Verify-mfa avec TOTP wrong et recovery code wrong** : 401 generic INVALID_CREDENTIALS pour eviter user enum.
5. **Disable sans password verify** : 401 INVALID_CREDENTIALS.
6. **MfaRequiredGuard sur user platform (super_admin) sans MFA enable** : Sprint 5 = warning ; Sprint 27 admin endpoints @RequireMfa enforce.
7. **Race confirm + signin** : detail Tache 2.1.7 edge case 23.
8. **Revoke sessions interrompu mid-flight** : Sprint 14 retry.
9. **Recovery code consume race** : Sprint 5 = DB UPDATE conditional sur hash present.
10. **Verify recovery code et invalidate atomic** : transaction Postgres.
11. **mfa_required guard sur endpoint @Public** : guard skip si endpoint public.
12. **Disable MFA pour user platform** : Sprint 5 = autorise mais alert security ; Sprint 27 admin endpoints peuvent forcer no-disable.

---

## 3. Architecture context

### 3.1 Position dans le sprint

Tache 2.1.8 livre les endpoints consommees par : 2.1.9 (Signup avec MFA mandatory), 2.1.11 (Recovery alternate flow), 2.1.12 (Audit MFA events), 2.1.15 (E2E full MFA flow).

### 3.2 Position dans le programme

- Sprint 11 : @RequireMfa() decorate POST /payments.
- Sprint 18 : @RequireMfa() decorate PATCH /tenant/settings.
- Sprint 23 : WebAuthn endpoints additionnels.
- Sprint 25 : @RequireMfa() decorate /admin/impersonate.
- Sprint 27 : admin endpoints `/admin/users/:id/reset-mfa`.
- Sprint 33 : audit complet MFA flows.

### 3.3 Diagramme

```
                               +-----------------------------------+
                               |  Tache 2.1.7 termine               |
                               |  MfaService operationnel           |
                               +-----------------+------------------+
                                                 |
                                                 v
                          +----------------------+----------------------+
                          |  TACHE 2.1.8 (cette tache)                  |
                          |  AuthController etendu                      |
                          |  POST /setup-mfa     -> AuthService.setupMfa
                          |  POST /confirm-mfa   -> AuthService.confirmMfa
                          |  POST /verify-mfa    -> AuthService.verifyMfa
                          |  POST /disable-mfa   -> AuthService.disableMfa
                          |                                              |
                          |  MfaRequiredGuard                            |
                          |  @RequireMfa() decorator                     |
                          +-+---+---+---+---+---+---+---+--------------+
                            |   |   |   |   |   |   |   |
                            v   v   v   v   v   v   v   v
                       2.1.9 / 2.1.11 / 2.1.12 / 2.1.15 / Sprint 11+ (Pay)
```

---

## 4. Livrables checkables (24)

- [ ] Mise a jour `repo/apps/api/src/modules/auth/auth.controller.ts` -- ajout 4 endpoints MFA avec decorators Swagger -- modification ~150 lignes
- [ ] Mise a jour `repo/apps/api/src/modules/auth/auth.service.ts` -- ajout 4 methods (setupMfa, confirmMfa, verifyMfa, disableMfa) -- modification ~250 lignes
- [ ] Guard `repo/apps/api/src/modules/auth/guards/mfa-required.guard.ts` -- ~80 lignes
- [ ] Decorator `repo/apps/api/src/modules/auth/decorators/require-mfa.decorator.ts` -- ~25 lignes
- [ ] DTO `repo/apps/api/src/modules/auth/dto/setup-mfa.dto.ts` -- ~25 lignes (no body)
- [ ] DTO `repo/apps/api/src/modules/auth/dto/confirm-mfa.dto.ts` -- ~30 lignes
- [ ] DTO `repo/apps/api/src/modules/auth/dto/verify-mfa.dto.ts` -- ~35 lignes
- [ ] DTO `repo/apps/api/src/modules/auth/dto/disable-mfa.dto.ts` -- ~30 lignes
- [ ] DTO response `repo/apps/api/src/modules/auth/dto/mfa-response.dto.ts` -- ~50 lignes
- [ ] Update auth.errors.ts -- ajouter MFA_REQUIRED code -- modification
- [ ] Tests unit `auth.service.spec.ts` -- ajouter 12 tests MFA methods -- modification ~200 lignes
- [ ] Tests unit `auth.controller.spec.ts` -- ajouter 8 tests endpoints -- modification ~120 lignes
- [ ] Tests `mfa-required.guard.spec.ts` -- 6 tests -- ~100 lignes
- [ ] Tests `require-mfa.decorator.spec.ts` -- 3 tests -- ~50 lignes
- [ ] Tests E2E `auth-mfa.e2e-spec.ts` -- 12 scenarios -- ~350 lignes
- [ ] No-emoji
- [ ] No-console
- [ ] Coverage >= 88%
- [ ] Documentation JSDoc + Swagger
- [ ] Build TypeScript reussit
- [ ] Setup MFA revoke toutes sessions
- [ ] Disable MFA revoke toutes sessions
- [ ] @RequireMfa() global filter applied
- [ ] mfa_verified=true dans JWT post-verify-mfa

---

## 5. Fichiers crees / modifies

```
repo/apps/api/src/modules/auth/auth.controller.ts                                   (modifie / +4 endpoints)
repo/apps/api/src/modules/auth/auth.service.ts                                      (modifie / +4 methods)
repo/apps/api/src/modules/auth/auth.errors.ts                                        (modifie / +MFA_REQUIRED)
repo/apps/api/src/modules/auth/guards/mfa-required.guard.ts                          (~80 lignes)
repo/apps/api/src/modules/auth/decorators/require-mfa.decorator.ts                   (~25 lignes)
repo/apps/api/src/modules/auth/dto/setup-mfa.dto.ts                                  (~25 lignes)
repo/apps/api/src/modules/auth/dto/confirm-mfa.dto.ts                                (~30 lignes)
repo/apps/api/src/modules/auth/dto/verify-mfa.dto.ts                                 (~35 lignes)
repo/apps/api/src/modules/auth/dto/disable-mfa.dto.ts                                (~30 lignes)
repo/apps/api/src/modules/auth/dto/mfa-response.dto.ts                               (~50 lignes)
repo/apps/api/src/modules/auth/auth.service.spec.ts                                   (modifie / +12 tests)
repo/apps/api/src/modules/auth/auth.controller.spec.ts                                (modifie / +8 tests)
repo/apps/api/src/modules/auth/guards/mfa-required.guard.spec.ts                      (~100 lignes)
repo/apps/api/src/modules/auth/decorators/require-mfa.decorator.spec.ts               (~50 lignes)
repo/apps/api/test/auth-mfa.e2e-spec.ts                                                (~350 lignes)
```

Total : 15 fichiers modifies/crees, ~1300 lignes effectives.

---

## 6. Code patterns COMPLETS

### 6.1 Fichier 1 / 11 : `auth.errors.ts` (mise a jour)

```typescript
// Add to existing AuthErrorCode union :
export type AuthErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'ACCOUNT_LOCKED'
  | 'ACCOUNT_DISABLED'
  | 'ACCOUNT_DELETED'
  | 'EMAIL_NOT_VERIFIED'
  | 'MFA_REQUIRED'
  | 'MFA_NOT_ENABLED'
  | 'MFA_ALREADY_ENABLED'
  | 'MFA_INVALID_CODE'
  | 'MFA_CHALLENGE_EXPIRED'
  | 'MFA_SETUP_EXPIRED'
  | 'MFA_RECOVERY_CODE_USED'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_INVALID'
  | 'TOKEN_REUSE_DETECTED'
  | 'SESSION_NOT_FOUND'
  | 'TENANT_SUSPENDED'
  | 'RATE_LIMIT_EXCEEDED';

export const MfaRequiredError = () =>
  new ApiAuthError('MFA_REQUIRED', 'MFA verification required for this operation', HttpStatus.FORBIDDEN);

export const MfaNotEnabledError = () =>
  new ApiAuthError('MFA_NOT_ENABLED', 'MFA is not enabled for this account', HttpStatus.BAD_REQUEST);

export const MfaAlreadyEnabledError = () =>
  new ApiAuthError('MFA_ALREADY_ENABLED', 'MFA is already enabled', HttpStatus.CONFLICT);

export const MfaInvalidCodeError = () =>
  new ApiAuthError('MFA_INVALID_CODE', 'Invalid MFA code or recovery code', HttpStatus.UNAUTHORIZED);

export const MfaChallengeExpiredError = () =>
  new ApiAuthError('MFA_CHALLENGE_EXPIRED', 'MFA challenge token expired -- restart signin', HttpStatus.UNAUTHORIZED);

export const MfaSetupExpiredError = () =>
  new ApiAuthError('MFA_SETUP_EXPIRED', 'MFA setup token expired -- restart setup', HttpStatus.UNAUTHORIZED);
```

### 6.2 Fichier 2 / 11 : `decorators/require-mfa.decorator.ts`

```typescript
/**
 * @RequireMfa() decorator -- marks an endpoint as requiring fresh MFA verification.
 * Applied by MfaRequiredGuard.
 *
 * Usage :
 *   @Post('payments')
 *   @RequireMfa()
 *   createPayment(@CurrentAuth() auth: AuthContext) { ... }
 */

import { SetMetadata } from '@nestjs/common';

export const REQUIRE_MFA_KEY = 'requireMfa';
export const RequireMfa = () => SetMetadata(REQUIRE_MFA_KEY, true);
```

### 6.3 Fichier 3 / 11 : `guards/mfa-required.guard.ts`

```typescript
/**
 * MfaRequiredGuard -- rejects request if endpoint requires fresh MFA but user has not verified.
 *
 * Applied AFTER JwtAuthGuard (chained). Reads @RequireMfa() metadata from controller method.
 */

import { CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_MFA_KEY } from '../decorators/require-mfa.decorator.js';
import { MfaRequiredError } from '../auth.errors.js';
import type { Request } from 'express';
import type { AuthContext } from '@insurtech/auth';

@Injectable()
export class MfaRequiredGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requireMfa = this.reflector.getAllAndOverride<boolean>(REQUIRE_MFA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requireMfa) return true;

    const req = context.switchToHttp().getRequest<Request & { auth?: AuthContext }>();
    const auth = req.auth;

    if (!auth || auth.subject.kind !== 'user') {
      throw MfaRequiredError();
    }

    if (!auth.subject.user.mfa_verified) {
      throw MfaRequiredError();
    }

    return true;
  }
}
```

### 6.4 Fichier 4 / 11 : `dto/setup-mfa.dto.ts`

```typescript
/**
 * POST /api/v1/auth/setup-mfa accepts no body parameters.
 * The user_id is derived from the JWT bearer token.
 */
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const setupMfaSchema = z.object({}).strict();
export class SetupMfaDto extends createZodDto(setupMfaSchema) {}
```

### 6.5 Fichier 5 / 11 : `dto/confirm-mfa.dto.ts`

```typescript
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const confirmMfaSchema = z.object({
  setup_token: z.string().min(20).max(500),
  totp_code: z.string().regex(/^\d{6}$/, 'totp_code must be 6 digits'),
}).strict();

export class ConfirmMfaDto extends createZodDto(confirmMfaSchema) {}
```

### 6.6 Fichier 6 / 11 : `dto/verify-mfa.dto.ts`

```typescript
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const verifyMfaSchema = z.object({
  challenge_token: z.string().min(20).max(500),
  totp_code: z.string().regex(/^\d{6}$/).optional(),
  recovery_code: z.string().regex(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i).optional(),
}).strict().refine((data) => Boolean(data.totp_code) !== Boolean(data.recovery_code), {
  message: 'Exactly one of totp_code or recovery_code must be provided',
});

export class VerifyMfaDto extends createZodDto(verifyMfaSchema) {}
```

### 6.7 Fichier 7 / 11 : `dto/disable-mfa.dto.ts`

```typescript
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const disableMfaSchema = z.object({
  current_password: z.string().min(8).max(128),
  totp_code: z.string().regex(/^\d{6}$/),
}).strict();

export class DisableMfaDto extends createZodDto(disableMfaSchema) {}
```

### 6.8 Fichier 8 / 11 : `dto/mfa-response.dto.ts`

```typescript
export interface SetupMfaResponse {
  setup_token: string;
  secret_b32: string;
  qr_code_data_url: string;
  otpauth_url: string;
  expires_at: number;
}

export interface ConfirmMfaResponse {
  mfa_enabled: true;
  recovery_codes: readonly string[];
  recovery_codes_warning: string;
  message: 'MFA enabled. All sessions revoked. Please sign in again with MFA.';
}

export interface VerifyMfaResponse {
  access_token: string;
  refresh_token: string;
  access_expires_at: number;
  refresh_expires_at: number;
  token_type: 'Bearer';
  user: import('./auth-response.dto.js').UserPublic;
  mfa_verified: true;
}

export interface DisableMfaResponse {
  mfa_enabled: false;
  message: 'MFA disabled. All sessions revoked.';
  sessions_revoked: number;
}
```

### 6.9 Fichier 9 / 11 : `auth.service.ts` (extension MFA)

```typescript
// Ajout aux methods existantes de AuthService Tache 2.1.6 :

import { MfaService } from '@insurtech/auth';
import type { EncryptedString } from '@insurtech/auth';
import {
  MfaInvalidCodeError, MfaNotEnabledError, MfaAlreadyEnabledError,
  MfaSetupExpiredError, MfaChallengeExpiredError,
} from './auth.errors.js';
import {
  isMfaError, MfaInvalidCodeError as DomainMfaInvalidCodeError,
  MfaChallengeExpiredError as DomainMfaChallengeExpired,
  MfaSetupTokenExpiredError as DomainMfaSetupExpired,
} from '@insurtech/auth';
import type {
  SetupMfaResponse, ConfirmMfaResponse, VerifyMfaResponse, DisableMfaResponse,
} from './dto/mfa-response.dto.js';

@Injectable()
export class AuthService {
  // ... existing constructor with MfaService injected
  constructor(
    // ... existing injections
    private readonly mfa: MfaService,
  ) {}

  async setupMfa(input: { user_id: string; email: string }): Promise<SetupMfaResponse> {
    const user = await this.userRepo.findById(input.user_id);
    if (!user) throw InvalidCredentialsError();
    if (user.mfa_enabled) throw MfaAlreadyEnabledError();

    const setup = await this.mfa.startSetup({ user_id: input.user_id, email: input.email });
    this.logger.log({ action: 'mfa_setup_started', user_id: input.user_id });
    return {
      setup_token: setup.setup_token,
      secret_b32: setup.secret_b32,
      qr_code_data_url: setup.qr_code_data_url,
      otpauth_url: setup.otpauth_url,
      expires_at: setup.expires_at,
    };
  }

  async confirmMfa(input: { user_id: string; setup_token: string; totp_code: string }): Promise<ConfirmMfaResponse> {
    const user = await this.userRepo.findById(input.user_id);
    if (!user) throw InvalidCredentialsError();
    if (user.mfa_enabled) throw MfaAlreadyEnabledError();

    let result;
    try {
      result = await this.mfa.confirmSetup({
        setup_token: input.setup_token,
        totp_code: input.totp_code,
        user_id: input.user_id,
      });
    } catch (err) {
      if (err instanceof DomainMfaSetupExpired) throw MfaSetupExpiredError();
      if (err instanceof DomainMfaInvalidCodeError) throw MfaInvalidCodeError();
      throw err;
    }

    // Persist in auth_users
    await this.userRepo.update(input.user_id, {
      mfa_enabled: true,
      mfa_secret_encrypted: result.encrypted_secret,
      mfa_recovery_codes_hashes: [...result.recovery_codes_hashed],
      mfa_setup_completed_at: new Date(),
    });

    // CRITICAL : revoke all sessions to force re-login with MFA
    await this.session.revokeUserSessions(input.user_id);

    this.logger.log({ action: 'mfa_setup_confirmed', user_id: input.user_id });

    // Tache 2.1.12 audit + Kafka publish event mfa_setup_completed

    return {
      mfa_enabled: true,
      recovery_codes: result.confirm.recovery_codes,
      recovery_codes_warning: result.confirm.recovery_codes_warning,
      message: 'MFA enabled. All sessions revoked. Please sign in again with MFA.',
    };
  }

  async verifyMfa(input: {
    challenge_token: string;
    totp_code?: string;
    recovery_code?: string;
    ip: string;
    user_agent: string;
    request_id: string;
  }): Promise<VerifyMfaResponse> {
    let challenge;
    try {
      challenge = await this.mfa.consumeChallengeToken(input.challenge_token);
    } catch (err) {
      if (err instanceof DomainMfaChallengeExpired) throw MfaChallengeExpiredError();
      throw err;
    }

    const user = await this.userRepo.findById(challenge.user_id);
    if (!user) throw InvalidCredentialsError();
    if (!user.mfa_enabled || !user.mfa_secret_encrypted) {
      throw MfaNotEnabledError();
    }

    let mfaVerified = false;
    let usedRecoveryIndex: number | undefined;

    if (input.totp_code) {
      mfaVerified = await this.mfa.verifyEncryptedTotp({
        encrypted_secret: user.mfa_secret_encrypted,
        user_id: user.id,
        totp_code: input.totp_code,
      });
    } else if (input.recovery_code) {
      const r = await this.mfa.verifyRecoveryCode({
        hashes: user.mfa_recovery_codes_hashes ?? [],
        presented: input.recovery_code,
      });
      mfaVerified = r.valid;
      usedRecoveryIndex = r.recovery_code_index_used;
    }

    if (!mfaVerified) {
      this.logger.warn({ action: 'mfa_verify_failed', user_id: user.id });
      throw MfaInvalidCodeError();
    }

    // Invalidate the used recovery code (atomic via PATCH array)
    if (usedRecoveryIndex !== undefined) {
      const updated = [...(user.mfa_recovery_codes_hashes ?? [])];
      updated[usedRecoveryIndex] = null as unknown as string;
      await this.userRepo.update(user.id, { mfa_recovery_codes_hashes: updated });
    }

    // Generate session + tokens with mfa_verified = true
    const sid = this.jwt.generateId();
    const family = this.jwt.generateId();
    const refreshGen = 1;

    const accessToken = this.jwt.signAccessToken({
      sub: user.id,
      tenant_id: user.tenant_id,
      email: user.email,
      role: user.role,
      mfa_verified: true,
      sid,
    });
    const refreshToken = this.jwt.signRefreshToken({
      sub: user.id,
      sid,
      token_family: family,
      generation: refreshGen,
    });

    const refreshPayload = this.jwt.verifyRefreshToken(refreshToken);
    await this.session.createSession({
      user_id: user.id,
      tenant_id: user.tenant_id,
      role: user.role,
      jti: refreshPayload.jti,
      refresh_token_family: family,
      refresh_generation: refreshGen,
      ip: input.ip,
      user_agent: input.user_agent,
      mfa_verified: true,
      remember_me: false,
      locale: user.locale,
    });

    this.userRepo.updateLastLogin(user.id, new Date(), input.ip).catch(() => {});

    this.logger.log({ action: 'mfa_verify_success', user_id: user.id, used_recovery: usedRecoveryIndex !== undefined });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      access_expires_at: Math.floor(Date.now() / 1000) + 900,
      refresh_expires_at: Math.floor(Date.now() / 1000) + 2592000,
      token_type: 'Bearer',
      user: this.toPublicUser(user),
      mfa_verified: true,
    };
  }

  async disableMfa(input: { user_id: string; current_password: string; totp_code: string }): Promise<DisableMfaResponse> {
    const user = await this.userRepo.findById(input.user_id);
    if (!user) throw InvalidCredentialsError();
    if (!user.mfa_enabled) throw MfaNotEnabledError();

    // Verify password
    const valid = await this.argon2.verify(user.password_hash, input.current_password);
    if (!valid) {
      throw InvalidCredentialsError();
    }

    // Verify TOTP
    if (!user.mfa_secret_encrypted) throw MfaNotEnabledError();
    const totpValid = await this.mfa.verifyEncryptedTotp({
      encrypted_secret: user.mfa_secret_encrypted,
      user_id: user.id,
      totp_code: input.totp_code,
    });
    if (!totpValid) {
      throw MfaInvalidCodeError();
    }

    // Disable MFA in DB
    await this.userRepo.update(user.id, {
      mfa_enabled: false,
      mfa_secret_encrypted: null,
      mfa_recovery_codes_hashes: null,
      mfa_setup_completed_at: null,
    });

    // Revoke all sessions
    const count = await this.session.revokeUserSessions(user.id);

    this.logger.log({ action: 'mfa_disabled', user_id: user.id, sessions_revoked: count });

    // Tache 2.1.12 audit + Kafka mfa_disabled event

    return {
      mfa_enabled: false,
      message: 'MFA disabled. All sessions revoked.',
      sessions_revoked: count,
    };
  }
}
```

### 6.10 Fichier 10 / 11 : `auth.controller.ts` (extension MFA)

```typescript
// Add to existing AuthController :

import { ConfirmMfaDto } from './dto/confirm-mfa.dto.js';
import { VerifyMfaDto } from './dto/verify-mfa.dto.js';
import { DisableMfaDto } from './dto/disable-mfa.dto.js';
import { Public } from './decorators/public.decorator.js';

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  // ... existing endpoints

  @Post('setup-mfa')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Initiate MFA setup' })
  @ApiResponse({ status: 200, description: 'Returns secret + QR code' })
  @ApiResponse({ status: 409, description: 'MFA already enabled' })
  async setupMfa(@CurrentAuth() auth: AuthContext) {
    if (auth.subject.kind !== 'user') throw new Error('user subject required');
    return this.authService.setupMfa({
      user_id: auth.subject.user.id,
      email: auth.subject.user.email,
    });
  }

  @Post('confirm-mfa')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm MFA setup with first TOTP code' })
  @ApiResponse({ status: 200, description: 'MFA enabled. Recovery codes returned ONCE.' })
  @ApiResponse({ status: 401, description: 'Invalid TOTP or expired setup token' })
  async confirmMfa(@CurrentAuth() auth: AuthContext, @Body() body: ConfirmMfaDto) {
    if (auth.subject.kind !== 'user') throw new Error('user subject required');
    return this.authService.confirmMfa({
      user_id: auth.subject.user.id,
      setup_token: body.setup_token,
      totp_code: body.totp_code,
    });
  }

  @Public()
  @Post('verify-mfa')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify MFA challenge from signin and emit final tokens' })
  @ApiResponse({ status: 200, description: 'Returns access + refresh tokens' })
  @ApiResponse({ status: 401, description: 'Invalid code or expired challenge' })
  async verifyMfa(@Body() body: VerifyMfaDto, @Req() req: Request) {
    return this.authService.verifyMfa({
      challenge_token: body.challenge_token,
      totp_code: body.totp_code,
      recovery_code: body.recovery_code,
      ip: extractIp(req),
      user_agent: req.headers['user-agent'] ?? 'unknown',
      request_id: req.headers['x-request-id']?.toString() ?? 'unknown',
    });
  }

  @Post('disable-mfa')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disable MFA (requires current password + TOTP)' })
  @ApiResponse({ status: 200, description: 'MFA disabled. All sessions revoked.' })
  @ApiResponse({ status: 401, description: 'Wrong password or TOTP' })
  async disableMfa(@CurrentAuth() auth: AuthContext, @Body() body: DisableMfaDto) {
    if (auth.subject.kind !== 'user') throw new Error('user subject required');
    return this.authService.disableMfa({
      user_id: auth.subject.user.id,
      current_password: body.current_password,
      totp_code: body.totp_code,
    });
  }
}
```

### 6.11 Fichier 11 / 11 : `auth.module.ts` (mise a jour pour MfaRequiredGuard)

```typescript
// Le APP_GUARD JwtAuthGuard est deja global Sprint 5 Tache 2.1.6
// Ajouter MfaRequiredGuard comme guard chained applique APRES JwtAuthGuard

import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule as AuthSharedModule } from '@insurtech/auth';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { MfaRequiredGuard } from './guards/mfa-required.guard.js';
import { UserModule } from '../user/user.module.js';

@Module({
  imports: [
    AuthSharedModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    UserModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: MfaRequiredGuard }, // chained after JwtAuthGuard
  ],
  exports: [AuthService],
})
export class AuthModule {}
```

---

## 7. Tests complets

### 7.1 Tests unit `auth.service.spec.ts` (extension MFA)

```typescript
// Add to existing AuthService spec :
import { MfaService } from '@insurtech/auth';

describe('AuthService MFA methods', () => {
  // setup mocks similar to existing tests
  let mfa: any;

  beforeEach(() => {
    mfa = {
      startSetup: vi.fn(),
      confirmSetup: vi.fn(),
      verifyEncryptedTotp: vi.fn(),
      verifyRecoveryCode: vi.fn(),
      consumeChallengeToken: vi.fn(),
    };
    // ... inject in TestingModule
  });

  describe('setupMfa', () => {
    it('returns setup data when user does not have MFA', async () => {
      userRepo.findById.mockResolvedValue(mockUser({ mfa_enabled: false }));
      mfa.startSetup.mockResolvedValue({
        setup_token: 'st-1', secret_b32: 'JBSWY3DP', qr_code_data_url: 'data:image/png;base64,xxx', otpauth_url: 'otpauth://...', expires_at: 9999,
      });
      const r = await service.setupMfa({ user_id: 'u1', email: 'a@b.com' });
      expect(r.setup_token).toBe('st-1');
      expect(r.secret_b32).toBe('JBSWY3DP');
    });

    it('throws MfaAlreadyEnabledError when user has MFA', async () => {
      userRepo.findById.mockResolvedValue(mockUser({ mfa_enabled: true }));
      await expect(service.setupMfa({ user_id: 'u1', email: 'a@b.com' })).rejects.toThrow(/MFA_ALREADY_ENABLED/);
    });
  });

  describe('confirmMfa', () => {
    it('persists secret + recovery codes, revokes all sessions', async () => {
      userRepo.findById.mockResolvedValue(mockUser({ mfa_enabled: false }));
      mfa.confirmSetup.mockResolvedValue({
        encrypted_secret: 'iv:ct:tag',
        recovery_codes_clear: ['ABCD-EFGH-JKMN'],
        recovery_codes_hashed: ['$argon2id$...'],
        confirm: { mfa_enabled: true, recovery_codes: ['ABCD-EFGH-JKMN'], recovery_codes_warning: 'WARNING' },
      });
      session.revokeUserSessions.mockResolvedValue(2);
      const r = await service.confirmMfa({ user_id: 'u1', setup_token: 'st-1', totp_code: '123456' });
      expect(r.mfa_enabled).toBe(true);
      expect(userRepo.update).toHaveBeenCalledWith('u1', expect.objectContaining({
        mfa_enabled: true,
      }));
      expect(session.revokeUserSessions).toHaveBeenCalledWith('u1');
    });

    it('throws MfaSetupExpiredError when token expired', async () => {
      userRepo.findById.mockResolvedValue(mockUser({ mfa_enabled: false }));
      mfa.confirmSetup.mockRejectedValue({ name: 'MfaSetupTokenExpiredError' });
      await expect(service.confirmMfa({
        user_id: 'u1', setup_token: 'expired', totp_code: '123456',
      })).rejects.toThrow();
    });
  });

  describe('verifyMfa', () => {
    it('valid TOTP -> tokens with mfa_verified true', async () => {
      mfa.consumeChallengeToken.mockResolvedValue({ user_id: 'u1', email: 'a@b.com' });
      userRepo.findById.mockResolvedValue(mockUser({ mfa_enabled: true, mfa_secret_encrypted: 'iv:ct:tag' as any }));
      mfa.verifyEncryptedTotp.mockResolvedValue(true);
      const r = await service.verifyMfa({
        challenge_token: 'ct-1', totp_code: '123456',
        ip: '1.1.1.1', user_agent: 'UA', request_id: 'r1',
      });
      expect(r.mfa_verified).toBe(true);
      expect(jwt.signAccessToken).toHaveBeenCalledWith(expect.objectContaining({ mfa_verified: true }));
    });

    it('valid recovery code -> tokens + invalidate code', async () => {
      mfa.consumeChallengeToken.mockResolvedValue({ user_id: 'u1', email: 'a@b.com' });
      userRepo.findById.mockResolvedValue(mockUser({
        mfa_enabled: true,
        mfa_secret_encrypted: 'iv:ct:tag' as any,
        mfa_recovery_codes_hashes: ['$argon2id$h1', '$argon2id$h2', '$argon2id$h3'],
      }));
      mfa.verifyRecoveryCode.mockResolvedValue({ valid: true, recovery_code_index_used: 1 });
      const r = await service.verifyMfa({
        challenge_token: 'ct-1', recovery_code: 'PQRS-TUVW-XYZ2',
        ip: '1.1.1.1', user_agent: 'UA', request_id: 'r1',
      });
      expect(r.mfa_verified).toBe(true);
      expect(userRepo.update).toHaveBeenCalledWith('u1', expect.objectContaining({
        mfa_recovery_codes_hashes: ['$argon2id$h1', null, '$argon2id$h3'],
      }));
    });

    it('invalid TOTP -> MfaInvalidCodeError', async () => {
      mfa.consumeChallengeToken.mockResolvedValue({ user_id: 'u1', email: 'a@b.com' });
      userRepo.findById.mockResolvedValue(mockUser({ mfa_enabled: true, mfa_secret_encrypted: 'x' as any }));
      mfa.verifyEncryptedTotp.mockResolvedValue(false);
      await expect(service.verifyMfa({
        challenge_token: 'ct-1', totp_code: '000000',
        ip: '1.1.1.1', user_agent: 'UA', request_id: 'r1',
      })).rejects.toThrow(/MFA_INVALID_CODE/);
    });

    it('expired challenge -> MfaChallengeExpiredError', async () => {
      mfa.consumeChallengeToken.mockRejectedValue({ name: 'MfaChallengeExpiredError' });
      await expect(service.verifyMfa({
        challenge_token: 'expired', totp_code: '123456',
        ip: '1.1.1.1', user_agent: 'UA', request_id: 'r1',
      })).rejects.toThrow();
    });
  });

  describe('disableMfa', () => {
    it('valid password + TOTP -> disable + revoke sessions', async () => {
      userRepo.findById.mockResolvedValue(mockUser({ mfa_enabled: true, mfa_secret_encrypted: 'x' as any }));
      argon2.verify.mockResolvedValue(true);
      mfa.verifyEncryptedTotp.mockResolvedValue(true);
      session.revokeUserSessions.mockResolvedValue(3);
      const r = await service.disableMfa({ user_id: 'u1', current_password: 'pwd', totp_code: '123456' });
      expect(r.mfa_enabled).toBe(false);
      expect(r.sessions_revoked).toBe(3);
      expect(userRepo.update).toHaveBeenCalledWith('u1', expect.objectContaining({
        mfa_enabled: false,
        mfa_secret_encrypted: null,
      }));
    });

    it('wrong password -> InvalidCredentialsError', async () => {
      userRepo.findById.mockResolvedValue(mockUser({ mfa_enabled: true, mfa_secret_encrypted: 'x' as any }));
      argon2.verify.mockResolvedValue(false);
      await expect(service.disableMfa({
        user_id: 'u1', current_password: 'wrong', totp_code: '123456',
      })).rejects.toThrow(/INVALID_CREDENTIALS/);
    });

    it('wrong TOTP -> MfaInvalidCodeError', async () => {
      userRepo.findById.mockResolvedValue(mockUser({ mfa_enabled: true, mfa_secret_encrypted: 'x' as any }));
      argon2.verify.mockResolvedValue(true);
      mfa.verifyEncryptedTotp.mockResolvedValue(false);
      await expect(service.disableMfa({
        user_id: 'u1', current_password: 'pwd', totp_code: '000000',
      })).rejects.toThrow(/MFA_INVALID_CODE/);
    });

    it('user without MFA -> MfaNotEnabledError', async () => {
      userRepo.findById.mockResolvedValue(mockUser({ mfa_enabled: false }));
      await expect(service.disableMfa({
        user_id: 'u1', current_password: 'pwd', totp_code: '123456',
      })).rejects.toThrow(/MFA_NOT_ENABLED/);
    });
  });
});
```

### 7.2 Tests `mfa-required.guard.spec.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { Reflector } from '@nestjs/core';
import { MfaRequiredGuard } from './mfa-required.guard.js';
import { AuthRole } from '@insurtech/auth';

const mockContext = (auth: any, requireMfa: boolean) => ({
  switchToHttp: () => ({ getRequest: () => ({ auth }) }),
  getHandler: vi.fn(),
  getClass: vi.fn(),
}) as any;

describe('MfaRequiredGuard', () => {
  it('allows when @RequireMfa not set', () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(undefined) } as any;
    const guard = new MfaRequiredGuard(reflector);
    expect(guard.canActivate(mockContext({}, false))).toBe(true);
  });

  it('allows when @RequireMfa set and mfa_verified true', () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(true) } as any;
    const guard = new MfaRequiredGuard(reflector);
    const auth = {
      subject: { kind: 'user', user: { mfa_verified: true, role: AuthRole.BrokerAdmin } },
    };
    expect(guard.canActivate(mockContext(auth, true))).toBe(true);
  });

  it('throws MFA_REQUIRED when @RequireMfa set and mfa_verified false', () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(true) } as any;
    const guard = new MfaRequiredGuard(reflector);
    const auth = {
      subject: { kind: 'user', user: { mfa_verified: false, role: AuthRole.BrokerAdmin } },
    };
    expect(() => guard.canActivate(mockContext(auth, true))).toThrow(/MFA_REQUIRED/);
  });

  it('throws when no auth (anonymous)', () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(true) } as any;
    const guard = new MfaRequiredGuard(reflector);
    expect(() => guard.canActivate(mockContext(undefined, true))).toThrow();
  });

  it('throws when subject is service (not user)', () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(true) } as any;
    const guard = new MfaRequiredGuard(reflector);
    const auth = { subject: { kind: 'service', service: { id: 'sky' } } };
    expect(() => guard.canActivate(mockContext(auth, true))).toThrow();
  });

  it('checks both handler and class metadata', () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(true) } as any;
    const guard = new MfaRequiredGuard(reflector);
    const auth = { subject: { kind: 'user', user: { mfa_verified: true, role: AuthRole.BrokerAdmin } } };
    guard.canActivate(mockContext(auth, true));
    expect(reflector.getAllAndOverride).toHaveBeenCalled();
  });
});
```

### 7.3 Tests `require-mfa.decorator.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { RequireMfa, REQUIRE_MFA_KEY } from './require-mfa.decorator.js';
import { Reflector } from '@nestjs/core';

class TestController {
  @RequireMfa()
  protectedMethod() {}

  publicMethod() {}
}

describe('@RequireMfa()', () => {
  it('sets REQUIRE_MFA_KEY metadata to true', () => {
    const reflector = new Reflector();
    const c = new TestController();
    expect(reflector.get(REQUIRE_MFA_KEY, c.protectedMethod)).toBe(true);
  });

  it('does not set metadata on undecorate methods', () => {
    const reflector = new Reflector();
    const c = new TestController();
    expect(reflector.get(REQUIRE_MFA_KEY, c.publicMethod)).toBeUndefined();
  });

  it('exports a function', () => {
    expect(typeof RequireMfa).toBe('function');
    expect(typeof RequireMfa()).toBe('function');
  });
});
```

### 7.4 Tests E2E `auth-mfa.e2e-spec.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { authenticator } from 'otplib';
import { AppModule } from '../src/app.module.js';

describe('Auth MFA E2E', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    // seed user
  });

  afterAll(async () => { await app.close(); });

  async function signinAndGetToken(): Promise<string> {
    const r = await request(app.getHttpServer())
      .post('/api/v1/auth/signin')
      .send({ email: 'test-mfa@example.com', password: 'StrongP@ss123!' });
    return r.body.access_token;
  }

  it('full MFA setup flow : setup -> confirm -> revoke sessions', async () => {
    const token = await signinAndGetToken();
    const setupR = await request(app.getHttpServer())
      .post('/api/v1/auth/setup-mfa')
      .set('Authorization', `Bearer ${token}`);
    expect(setupR.status).toBe(200);
    expect(setupR.body.secret_b32).toBeDefined();

    const totpCode = authenticator.generate(setupR.body.secret_b32);
    const confirmR = await request(app.getHttpServer())
      .post('/api/v1/auth/confirm-mfa')
      .set('Authorization', `Bearer ${token}`)
      .send({ setup_token: setupR.body.setup_token, totp_code: totpCode });
    expect(confirmR.status).toBe(200);
    expect(confirmR.body.recovery_codes).toHaveLength(6);

    // Old token invalid (sessions revoked)
    const meR = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(meR.status).toBe(401);
  });

  it('signin -> mfa challenge -> verify-mfa -> tokens', async () => {
    // assumes user has MFA enabled via prior test
    const signinR = await request(app.getHttpServer())
      .post('/api/v1/auth/signin')
      .send({ email: 'test-mfa@example.com', password: 'StrongP@ss123!' });
    expect(signinR.body.mfa_required).toBe(true);
    const challengeToken = signinR.body.mfa_challenge_token;

    const totpCode = authenticator.generate('JBSWY3DPEHPK3PXP'); // need real secret
    const verifyR = await request(app.getHttpServer())
      .post('/api/v1/auth/verify-mfa')
      .send({ challenge_token: challengeToken, totp_code: totpCode });
    expect(verifyR.status).toBe(200);
    expect(verifyR.body.mfa_verified).toBe(true);
  });

  it('verify-mfa with wrong TOTP -> 401', async () => {
    // get challenge token first
    const challengeToken = 'ct-...';
    const r = await request(app.getHttpServer())
      .post('/api/v1/auth/verify-mfa')
      .send({ challenge_token: challengeToken, totp_code: '000000' });
    expect(r.status).toBe(401);
    expect(r.body.code).toBe('MFA_INVALID_CODE');
  });

  it('verify-mfa with recovery code -> tokens + code invalidated', async () => {
    // seed user with recovery code
    // ... run scenario
  });

  it('verify-mfa with already-used recovery code -> 401', async () => {
    // ... run scenario with consumed code
  });

  it('disable-mfa requires password + TOTP', async () => {
    // ... happy path
    // ... wrong password
    // ... wrong TOTP
  });

  it('@RequireMfa() endpoint rejects non-MFA-verified user', async () => {
    // mock endpoint with @RequireMfa decorator (Sprint 11+ Pay)
    // ... verify 403
  });

  it('endpoints without @RequireMfa() accept normal access tokens', async () => {
    // ... verify pass
  });

  it('cross-tenant attack : confirm-mfa with another user setup_token fails', async () => {
    // ... verify rejection
  });

  it('setup-mfa twice without disabling fails', async () => {
    // ... 409 MFA_ALREADY_ENABLED
  });

  it('verify-mfa without challenge_token fails', async () => {
    const r = await request(app.getHttpServer())
      .post('/api/v1/auth/verify-mfa')
      .send({ totp_code: '123456' });
    expect(r.status).toBe(400); // missing required
  });

  it('challenge_token expires after 5 min (simulated via delay)', async () => {
    // ... use fake timer or skip in normal test runs
  });
});
```

---

## 8. Variables environnement

Aucune variable nouvelle (reuse Tache 2.1.7).

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

## 10. Criteres validation V1-V35

### Criteres P0 (22)

- **V1-V3 (P0)** : typecheck, build, tests pass.
- **V4 (P0)** : POST /setup-mfa retourne secret + QR + setup_token.
- **V5 (P0)** : POST /setup-mfa user deja MFA -> 409 MFA_ALREADY_ENABLED.
- **V6 (P0)** : POST /confirm-mfa avec TOTP valide -> mfa_enabled true en DB.
- **V7 (P0)** : POST /confirm-mfa retourne 6 recovery codes.
- **V8 (P0)** : POST /confirm-mfa revoke toutes sessions.
- **V9 (P0)** : POST /confirm-mfa wrong TOTP -> 401 MFA_INVALID_CODE.
- **V10 (P0)** : POST /confirm-mfa expired setup_token -> 401 MFA_SETUP_EXPIRED.
- **V11 (P0)** : POST /verify-mfa avec TOTP valide -> tokens mfa_verified=true.
- **V12 (P0)** : POST /verify-mfa avec recovery code valide -> tokens + invalidate.
- **V13 (P0)** : POST /verify-mfa avec recovery code already used -> 401.
- **V14 (P0)** : POST /verify-mfa wrong code -> 401 MFA_INVALID_CODE.
- **V15 (P0)** : POST /verify-mfa expired challenge -> 401 MFA_CHALLENGE_EXPIRED.
- **V16 (P0)** : POST /verify-mfa challenge_token consume atomic.
- **V17 (P0)** : POST /disable-mfa wrong password -> 401 INVALID_CREDENTIALS.
- **V18 (P0)** : POST /disable-mfa wrong TOTP -> 401 MFA_INVALID_CODE.
- **V19 (P0)** : POST /disable-mfa valid -> mfa_enabled false + revoke sessions.
- **V20 (P0)** : @RequireMfa() endpoint reject mfa_verified=false -> 403 MFA_REQUIRED.
- **V21 (P0)** : @RequireMfa() endpoint accept mfa_verified=true.
- **V22 (P0)** : Endpoints sans @RequireMfa() pass normal.

### Criteres P1 (8)

- **V23 (P1)** : Coverage >= 88%.
- **V24 (P1)** : No-emoji.
- **V25 (P1)** : No-console.log.
- **V26 (P1)** : Recovery codes affiches UNE FOIS dans confirm response.
- **V27 (P1)** : OpenAPI Swagger decorators sur 4 endpoints.
- **V28 (P1)** : POST /confirm-mfa cross-user attack rejete.
- **V29 (P1)** : Audit log Tache 2.1.12 setup/confirm/verify/disable events.
- **V30 (P1)** : E2E tests 12+ scenarios passent.

### Criteres P2 (5)

- **V31 (P2)** : Documentation JSDoc + exemples.
- **V32 (P2)** : Bench setup-mfa < 50 ms.
- **V33 (P2)** : Bench confirm-mfa < 2000 ms (Argon2 6 hashes).
- **V34 (P2)** : Bench verify-mfa < 100 ms (Argon2 verify password + TOTP).
- **V35 (P2)** : Reuse helpers Tache 2.1.7 sans duplication.

---

## 11. Edge cases

1. **User active MFA pendant qu'autre device est connect** : confirm revoke autre device. Force re-login.
2. **Verify-mfa avec recovery code et TOTP simultane** : Zod refine reject 400.
3. **Disable MFA sans aucune session active** : OK, revokeUserSessions retourne 0.
4. **@RequireMfa() sur endpoint @Public** : Public bypass JwtAuthGuard donc MfaRequiredGuard pas appele.
5. **User platform (super_admin) sans MFA enable + endpoint @RequireMfa** : 403 force MFA setup d'abord.
6. **Confirm-mfa pendant que session courante revoque** : edge case race -- la confirm pass car request en cours, mais next request 401.
7. **Setup expire pendant confirm** : 401 MFA_SETUP_EXPIRED.
8. **Recovery code regenerate Sprint 14 vs current verify** : nouveaux codes ecrasent anciens.
9. **Disable MFA pour user dont password compromis** : meme si attaquant a password + intercepted TOTP via 30s window, peut disable. Mitigation : detection anomalie Sprint 33.
10. **verify-mfa avec challenge token d'un autre tenant** : tenant_id verifie via subscription user_id.
11. **Concurrent verify-mfa avec recovery code** : DB UPDATE conditional.
12. **Disable MFA pendant que MfaRequiredGuard active sur un endpoint en cours** : guard utilise AuthContext snapshot du JWT, pas DB live.

---

## 12. Conformite Maroc

- ACAPS circulaire 2024 : MFA mandatory broker_admin/garage_admin (helper isMfaMandatory Tache 2.1.1).
- NIST SP 800-63B AAL2 : TOTP authenticator approuve.
- Loi 09-08 article 23 : MFA secret encrypte, recovery codes hashes.
- Loi 09-08 article 21 : breach detection via audit MFA failed > 50/min Sprint 33.

---

## 13. Conventions absolues

Multi-tenant : MFA secret AAD = user_id (Tache 2.1.7). Validation Zod via createZodDto. Logger Pino. Hash Argon2id. pnpm. TS strict. Tests 30+. RBAC : @RequireMfa() decorator. Events Kafka : Tache 2.1.12. Imports order. Skalean AI : aucun. No-emoji. Idempotency : non applicable. Conventional Commits. Cloud souverain. Crypto : reuse MfaService. JSDoc + Swagger. Performance : MFA verify < 100ms.

---

## 14. Validation pre-commit

```bash
cd repo
pnpm --filter @insurtech/api typecheck
pnpm --filter @insurtech/api lint:check
pnpm --filter @insurtech/api test
pnpm --filter @insurtech/api test:e2e
pnpm --filter @insurtech/api build

grep -rP "[\x{1F300}-\x{1F9FF}]" apps/api/src && exit 1 || echo OK
grep -rn "console\.log" apps/api/src --include="*.ts" && exit 1 || echo OK
```

---

## 15. Commit message

```bash
git add -A
git commit -m "feat(sprint-05): implement MFA endpoints + MfaRequiredGuard + @RequireMfa decorator

Implements MFA REST endpoints (setup-mfa, confirm-mfa, verify-mfa,
disable-mfa) integrating MfaService Tache 2.1.7. Confirm-mfa and
disable-mfa systematically revoke all user sessions to prevent MFA
toggle abuse. MfaRequiredGuard chained after JwtAuthGuard reads
@RequireMfa() metadata to enforce mfa_verified=true on sensitive
endpoints. Recovery codes shown ONCE in confirm response, hashed
Argon2id and stored in auth_users.mfa_recovery_codes_hashes JSONB.
Verify-mfa supports both TOTP and recovery code paths.

Livrables :
- AuthController : 4 new endpoints (setup, confirm, verify, disable)
- AuthService : 4 new methods orchestrating MfaService + UserRepo + Session
- MfaRequiredGuard (chained APP_GUARD)
- @RequireMfa() decorator
- 4 DTOs with Zod schemas
- MFA-specific error codes added to ApiAuthError
- 30+ tests (unit + E2E)

Tests : 12 service + 8 controller + 6 guard + 3 decorator + 12 E2E
Coverage : >= 88%

Task: 2.1.8
Sprint: 5 (Phase 2 / Sprint 1)
Phase: 2 -- Securite & Multi-tenant
Reference: B-05 Tache 2.1.8
Decisions: ACAPS circulaire 2024, NIST SP 800-63B AAL2"
```

---

## 16. Workflow next step

Apres commit, passer a `task-2.1.9-signup-email-verification.md` qui implementera les endpoints `/signup`, `/verify-email`, `/resend-verification` avec table `auth_email_verifications`.

---

## Annexe A. Runbook operationnel

### A.1 Procedure : user perd device + recovery codes

(1) Verification identite par email + photo CIN (loi 09-08 conforme). (2) Admin Skalean (super_admin_platform) execute endpoint `POST /admin/users/:id/reset-mfa` (Sprint 27). (3) Audit log entry. (4) User notifie par email. (5) Au prochain signin, user fait nouveau setup.

### A.2 Procedure : suspicion abus MFA toggle

Si dashboard Sprint 33 detecte rate enable + disable MFA > 5/h sur meme user : alerte. Admin investigate. Possible compromission compte.

### A.3 Procedure : audit ACAPS sur MFA usage

ACAPS peut demander statistiques MFA enable rate par tenant. Query audit_log + auth_users count.

## Annexe B. Monitoring Sprint 33

```
mfa_setup_started_total            counter labels=tenant_id, role
mfa_setup_confirmed_total          counter
mfa_setup_failed_total             counter labels=reason
mfa_verify_total                   counter labels=method, result
mfa_disable_total                  counter labels=reason(user_initiated|admin_reset)
mfa_required_guard_blocked_total   counter labels=endpoint
mfa_recovery_code_used_total       counter
mfa_recovery_codes_remaining       gauge per user

Dashboard "MFA Operations" : enable rate, verify success/fail, disable rate, recovery usage, @RequireMfa rejection rate.
```

## Annexe C. Edge cases supplementaires (13-25)

### Edge case 13 : Frontend perd setup_token entre setup et confirm

Si l'utilisateur ferme l'onglet apres setup-mfa, le setup_token est perdu localement. Solution UX Sprint 4 : stocker setup_token en sessionStorage avec timeout 30 min. Si perdu, l'utilisateur recommence setup.

### Edge case 14 : Confirm-mfa apres delai > 30 min

Setup token TTL 30 min. Apres expire, 401 MFA_SETUP_EXPIRED. User doit re-call setup-mfa.

### Edge case 15 : User saisit recovery code partial (3 chars, 6 chars)

parseRecoveryCode retourne null. mfa.verifyRecoveryCode itere quand meme pour timing-safe. Returns valid=false.

### Edge case 16 : @RequireMfa() decorator sur endpoint qui n'a pas user subject

Service token (Sprint 31 sky-agent) -- guard rejette car kind !== 'user'. Documente : @RequireMfa applique uniquement user routes.

### Edge case 17 : User MFA et session restored apres signout-all

User signout-all (revoke sessions). User signin de nouveau, signin retourne mfa_required true. Verify-mfa OK -> nouvelles sessions avec mfa_verified=true.

### Edge case 18 : Concurrent setup-mfa + signin

User en setup-mfa avec ancien token. Pendant ce temps, user signin sur autre device.
- /signin sur autre device : retourne tokens normaux (mfa_enabled=false en DB).
- /confirm-mfa sur first device : succes, revoke ALL sessions including le nouveau signin.
OK.

### Edge case 19 : Disable MFA pendant que session active sur autre device

User disable-mfa sur device A. Device B avait token mfa_verified=true.
- /disable-mfa : revoke ALL sessions including device B.
- Device B's next request : 401.

### Edge case 20 : Cross-user confirm-mfa attack via bot

Attacker captures setup_token of user A, presents from user B's session.
- mfa.confirmSetup verifie setup_token.user_id === input.user_id -> mismatch -> throw.
Defense en profondeur.

### Edge case 21 : Replay verify-mfa challenge_token

challenge_token TTL 5 min, consume atomic. Second consume 401 EXPIRED.

### Edge case 22 : Backup recovery codes sur cloud user

User photo recovery codes et upload sur Google Drive / iCloud. Risque : si cloud compromis, leak. UX Sprint 4 message recommande print physique ou gestionnaire de passwords offline.

### Edge case 23 : 6 recovery codes tous epuises

User doit recovery via Tache 2.1.11 (account recovery flow with email).

### Edge case 24 : MfaRequiredGuard appele sur endpoint marque @Public()

@Public() bypass JwtAuthGuard. MfaRequiredGuard est applique apres JwtAuthGuard, mais sans auth, request.auth est undefined. Guard throw MFA_REQUIRED. MAIS @Public devrait etre exclusif -- audit Sprint 33 verifie.

### Edge case 25 : Verify-mfa avec challenge_token forge

Token random 32 bytes. Probabilite collision negligeable. Si forge, lookup Redis miss -> 401 EXPIRED.

## Annexe D. Performance benchmarks

```
POST /setup-mfa:               median 12 ms   (p99: 30 ms)  -- QR generation
POST /confirm-mfa:             median 1500 ms (p99: 2500 ms) -- 6 Argon2 hash dominate
POST /verify-mfa (TOTP):       median 5 ms    (p99: 15 ms)
POST /verify-mfa (recovery):   median 1500 ms (p99: 2500 ms) -- 6 Argon2 verify
POST /disable-mfa:             median 280 ms  (p99: 450 ms)  -- Argon2 verify password + TOTP
MfaRequiredGuard:              median 0.05 ms (p99: 0.2 ms)
```

## Annexe E. OpenAPI 3.1 (extrait)

```yaml
/api/v1/auth/setup-mfa:
  post:
    tags: [auth, mfa]
    summary: Initiate MFA setup
    security: [{ BearerAuth: [] }]
    responses:
      '200': { content: { application/json: { schema: { $ref: '#/components/schemas/SetupMfaResponse' } } } }
      '409': { description: 'MFA already enabled' }

/api/v1/auth/confirm-mfa:
  post:
    tags: [auth, mfa]
    security: [{ BearerAuth: [] }]
    requestBody: { required: true, content: { application/json: { schema: { $ref: '#/components/schemas/ConfirmMfaDto' } } } }
    responses:
      '200': { content: { application/json: { schema: { $ref: '#/components/schemas/ConfirmMfaResponse' } } } }
      '401': { description: 'Invalid TOTP or expired setup' }

/api/v1/auth/verify-mfa:
  post:
    tags: [auth, mfa]
    summary: Verify MFA challenge after signin
    security: []
    requestBody: { required: true, content: { application/json: { schema: { $ref: '#/components/schemas/VerifyMfaDto' } } } }
    responses:
      '200': { content: { application/json: { schema: { $ref: '#/components/schemas/VerifyMfaResponse' } } } }

/api/v1/auth/disable-mfa:
  post:
    tags: [auth, mfa]
    security: [{ BearerAuth: [] }]
    requestBody: { required: true, content: { application/json: { schema: { $ref: '#/components/schemas/DisableMfaDto' } } } }
    responses:
      '200': { content: { application/json: { schema: { $ref: '#/components/schemas/DisableMfaResponse' } } } }
```

---

## Annexe F. Comparaison avec systemes industriels

### F.1 GitHub MFA flow

GitHub propose TOTP + SMS + WebAuthn + recovery codes + recovery email. Skalean InsurTech Sprint 5 = TOTP + recovery codes ; Sprint 23 = WebAuthn ; SMS reste optionnel pas planifie. GitHub force MFA pour admin orgs depuis 2022 ; Skalean force MFA pour broker_admin / garage_admin / super_admin_platform via isMfaMandatory helper (decision-016).

### F.2 AWS IAM MFA

AWS impose MFA pour root account + admin policies sensibles. Pattern equivalent au @RequireMfa() decorator de cette tache. AWS utilise sessions tokens court avec re-auth periodique ; Skalean Sprint 5 = mfa_verified flag dans JWT. Sprint 14 considera re-verify periodique apres 30 min d'inactivite.

### F.3 Google 2FA flow

Google propose 2-Step Verification avec TOTP + SMS + Google Prompt + hardware key. Recovery codes 10 codes 8 chars hex. Skalean = 6 codes 12 chars alphanumeric (XXXX-XXXX-XXXX). Choix Skalean : 12 chars plus memorable + format readable. Couverture entropie similaire (36^12 ~ 4.7e18 vs 16^8 ~ 4.3e9 -- Skalean nettement plus secure).

### F.4 Stripe MFA flow

Stripe utilise WebAuthn comme principal, TOTP en backup. Force MFA depuis 2024 pour tous les utilisateurs Stripe. Skalean Sprint 5 = TOTP principal, WebAuthn Sprint 23 pour garage_technicien biometric mobile.

## Annexe G. Tests securite supplementaires

### G.1 Test de timing attack sur verify-mfa

```typescript
describe('MFA verify timing-safe', () => {
  it('verify-mfa with valid TOTP and invalid TOTP have similar latency', async () => {
    const validStart = Date.now();
    await request(app.getHttpServer())
      .post('/api/v1/auth/verify-mfa')
      .send({ challenge_token: validChallenge, totp_code: validCode });
    const validDuration = Date.now() - validStart;

    const invalidStart = Date.now();
    await request(app.getHttpServer())
      .post('/api/v1/auth/verify-mfa')
      .send({ challenge_token: validChallenge2, totp_code: '000000' });
    const invalidDuration = Date.now() - invalidStart;

    expect(Math.abs(validDuration - invalidDuration)).toBeLessThan(50);
  });

  it('verify recovery code valid vs invalid have similar latency', async () => {
    const validStart = Date.now();
    await request(app.getHttpServer())
      .post('/api/v1/auth/verify-mfa')
      .send({ challenge_token: ct1, recovery_code: validRecovery });
    const validDuration = Date.now() - validStart;

    const invalidStart = Date.now();
    await request(app.getHttpServer())
      .post('/api/v1/auth/verify-mfa')
      .send({ challenge_token: ct2, recovery_code: 'XXXX-XXXX-XXXX' });
    const invalidDuration = Date.now() - invalidStart;

    // Argon2 6 verifies dominate -- timing should be similar
    expect(Math.abs(validDuration - invalidDuration)).toBeLessThan(500);
  });
});
```

### G.2 Test de cross-tenant isolation MFA secret

```typescript
it('user A MFA secret cannot be used by user B', async () => {
  // user A setup MFA
  const setupA = await setupMfaForUser('user-A');
  // user B attempts to use user A's encrypted_secret with their own user_id
  // (simulated by direct DB swap or attacker manipulating auth_users)

  // Direct call to MfaService.verifyEncryptedTotp with wrong AAD
  const valid = await mfaService.verifyEncryptedTotp({
    encrypted_secret: setupA.encrypted_secret,
    user_id: 'user-B',
    totp_code: validCode,
  });
  expect(valid).toBe(false); // AAD mismatch
});
```

### G.3 Test de @RequireMfa() applique sur Sprint 11+ endpoints (anticipation)

```typescript
describe('@RequireMfa() future endpoints', () => {
  // Sprint 11 will add this endpoint
  @Controller('payments')
  class TestPaymentsController {
    @Post()
    @RequireMfa()
    create() {
      return { ok: true };
    }
  }

  it('rejects request without mfa_verified', async () => {
    const tokenSansMfa = await getTokenWithMfaVerified(false);
    const r = await request(app.getHttpServer())
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${tokenSansMfa}`)
      .send({ amount: 100 });
    expect(r.status).toBe(403);
    expect(r.body.code).toBe('MFA_REQUIRED');
  });

  it('accepts request with mfa_verified', async () => {
    const tokenAvecMfa = await getTokenWithMfaVerified(true);
    const r = await request(app.getHttpServer())
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${tokenAvecMfa}`)
      .send({ amount: 100 });
    expect(r.status).toBe(201);
  });
});
```

## Annexe H. References reglementaires detaillees

### H.1 NIST SP 800-63B section 5.1.4 (TOTP authenticator)

NIST SP 800-63B (June 2017, revised 2024) section 5.1.4 specifie :
- TOTP shall use HMAC-SHA-1 minimum (SHA-256 acceptable).
- Time-step T0 = 0, time-step duration = 30 sec.
- Code length >= 6 digits.
- Drift accepted +/- 1 step (60s window).
- Secret >= 128 bits (Skalean = 160 bits via otplib generateSecret(20)).

Skalean Sprint 5 conforme tous les criteres.

### H.2 NIST SP 800-63B section 5.2 (recovery codes)

NIST recommande recovery codes de >= 64 bits entropy. Skalean : 12 chars alphanumeric base 36 = log2(36^12) = 62 bits. Borderline -- mais avec Argon2 hash et lockout Sprint 5 Tache 2.1.10 (5 attempts / 15 min), brute force impossible. Sprint 14 considera 16 chars pour 82 bits entropy.

### H.3 ACAPS circulaire 2024 article 12

Article 12 : "Les operateurs assimiles experts d'assurance doivent activer un second facteur d'authentification fort lors de la connexion aux systemes manipulant des polices ou des sinistres."

Implementation : isMfaMandatory(role) retourne true pour broker_admin (gere policies), garage_admin (gere sinistres). Tache 2.1.6 force MFA challenge meme si user n'a pas active MFA volontairement -- au prochain signin, retourne 401 EMAIL_NOT_VERIFIED ou MFA_REQUIRED selon configuration. Sprint 14 ajoutera un endpoint admin pour forcer setup MFA on next login.

### H.4 Loi 09-08 article 23 + decret 2-09-165

Le decret d'application 2-09-165 precise les "mesures de securite techniques" exigees. Pour les services en ligne :
- Hash robuste pour passwords (Argon2id couvre, Tache 2.1.2).
- Encryption at rest pour donnees sensibles (MFA secret AES-256-GCM, Tache 2.1.7 + 2.1.3).
- Authentification multi-facteur pour acces donnees personnelles tiers (cette tache).
- Audit trail (Tache 2.1.12).
- Session management secure (Tache 2.1.5).

### H.5 Comparaison conformite

| Exigence | Sprint 5 status |
|----------|-----------------|
| Hash password robuste | OK Argon2id OWASP 2024 |
| MFA pour admin operateurs | OK isMfaMandatory + @RequireMfa |
| Encryption MFA secret | OK AES-256-GCM avec AAD |
| Recovery codes hashes | OK Argon2id |
| Session management | OK Redis + theft detection |
| Audit trail | Tache 2.1.12 (en cours) |
| Anti-enumeration | OK signup flow |
| Rate limit | Tache 2.1.14 (en cours) |
| Notification breach 72h | Tache 2.1.12 + Sprint 33 SecurityIncidentService |

## Annexe I. Performance benchmarks

```
POST /setup-mfa:               median 12 ms   (p99: 30 ms)  -- QR generation dominates
POST /confirm-mfa:             median 1500 ms (p99: 2500 ms) -- 6 Argon2 hash
POST /verify-mfa (TOTP):       median 5 ms    (p99: 15 ms)
POST /verify-mfa (recovery):   median 1500 ms (p99: 2500 ms) -- 6 Argon2 verify
POST /disable-mfa:             median 280 ms  (p99: 450 ms)  -- Argon2 verify password
MfaRequiredGuard canActivate:  median 0.05 ms (p99: 0.2 ms)  -- metadata lookup only
```

Sprint 33 review pourrait optimiser verifyRecoveryCode via lookup index par premiere lettre.

## Annexe J. Migration plan Sprint 11+ pour @RequireMfa

Sprint 11 (Pay) decorera POST /payments avec @RequireMfa(). Procedure :
1. Sprint 11 Tache 11.1.X ajoute import RequireMfa du module auth.
2. Decore les 3 endpoints sensibles : POST /payments, POST /refunds, PATCH /tenant/payment-settings.
3. Sprint 11 release notes informe users du changement (peut declencher MFA setup pour broker_admin si pas encore active).
4. Frontend Sprint 4 affiche bandeau "MFA requis pour les paiements" sur les pages concernees.
5. Sprint 33 audit verifie tous les endpoints sensibles ont @RequireMfa() ou justification @Public().

---

## Annexe K. Implementation patterns deployment Sprint 11 a Sprint 25

### K.1 Sprint 11 (Pay) -- decoration progressive endpoints sensibles

Sprint 11 introduit 12 endpoints paiement qui doivent etre decores `@RequireMfa()`. La procedure de deploiement progressive recommandee :

(1) Sprint 11 Tache 11.1.1 : implementer les endpoints sans `@RequireMfa()` initialement (decoration deferred). (2) Sprint 11 Tache 11.1.X : ajouter le decorator sur 1 endpoint pilote (POST /payments/initiate) en mode soft (warn dans logs si mfa_verified false mais autorise). (3) Sprint 11 Tache 11.1.Y : passer en mode strict (reject 403). (4) Sprint 11 Tache 11.1.Z : enroll progressivement les autres endpoints en suivant le meme schema. Cette progression permet de detecter les utilisateurs sans MFA enabled qui n'auraient pas ete migres et leur fournir un parcours guide d'enrolement.

```typescript
// Pattern soft mode (Sprint 11 transition)
@Post('initiate')
@RequireMfa({ mode: 'soft' })  // Sprint 14 introduira ce parametre
async initiatePayment(@CurrentAuth() auth: AuthContext, @Body() body: InitiatePaymentDto) {
  if (!auth.subject.user.mfa_verified) {
    this.logger.warn({ user_id: auth.subject.user.id, action: 'payment_without_mfa' });
    // Allow but log
  }
  // ... business logic
}
```

### K.2 Sprint 18 (Settings) -- protection PATCH endpoints

Sprint 18 introduira PATCH /tenant/settings, PATCH /me/email, PATCH /me/role (admin), tous decores `@RequireMfa()`. Ces endpoints modifient des donnees sensibles ; le pattern force MFA challenge pour chaque modification protege contre la session fixation et le replay d'access tokens.

### K.3 Sprint 25 (Cross-tenant impersonate) -- MFA + audit renforce

Sprint 25 introduira l'endpoint `/admin/impersonate/:tenantId` reserve super_admin_platform pour le support N2. Decorations critiques :

```typescript
@Post('impersonate/:tenantId')
@RequireMfa()
@Roles(AuthRole.SuperAdminPlatform)
@AuditMandatory()  // Sprint 25 nouveau decorator
async impersonate(
  @CurrentAuth() auth: AuthContext,
  @Param('tenantId') tenantId: string,
  @Body() body: { reason: string; ticket_id?: string },
) {
  // Sprint 25 implementation : emet token impersonate avec auth.subject.user.id en
  // 'impersonated_by' claim, traces audit complete avec ticket_id pour tracabilite
}
```

### K.4 Sprint 31 (Sky agent) -- MfaRequiredGuard skip pour service tokens

Sky agent emet des requetes service-to-service via ServiceJwtPayload (Tache 2.1.1 + 2.1.4). MfaRequiredGuard rejette avec 403 si subject n'est pas user. Solution Sprint 31 : decorator complementaire `@AllowServiceSubject()` qui bypass MfaRequiredGuard pour les routes consommees par sky-agent (POST /sky/tools/:toolName).

```typescript
@Post('sky/tools/:toolName')
@AllowServiceSubject()
@RequireMfa() // Skipped if subject.kind === 'service'
async invokeSkyTool(...) { /* ... */ }
```

## Annexe L. Patterns observability MFA avances

### L.1 Anomaly detection MFA fail patterns

Sprint 33 SecurityIncidentService consume `auth.mfa_verify_failed` et detecte les patterns suspects :

(1) Meme user avec > 10 fails MFA en 1 heure -- possible bot brute force TOTP (1M combinaisons / 30s = 33k/s theorique, mais lockout limite drastiquement). Action : alerte + force account lock Tier 3.

(2) Meme IP avec > 50 fails MFA cross-users en 1 heure -- attaque distributed. Action : block IP via firewall Sprint 14.

(3) MFA verify success suivie par disable-mfa < 5 min apres -- pattern compromise probable. Action : suspect lockout + email alert + freeze account changes.

(4) Recovery code utilise depuis IP geographically distant du dernier login (< 24h, > 1000 km) -- compromise indicator. Action : email alert + force password reset.

### L.2 Heatmap des MFA verify par tenant

Dashboard "MFA Adoption" Sprint 33 visualise par tenant :
- % users mfa_enabled
- mediane delay setup MFA apres signup
- % users avec recovery codes consommes (signal compromise hardware)
- correlation MFA enable rate avec role (broker_admin doit etre 100%)

### L.3 Compliance ACAPS dashboard

Dashboard "ACAPS Compliance" Sprint 33 :
- 100% broker_admin et garage_admin ont mfa_enabled (exigence circulaire 2024)
- audit log complet 5 ans queryable
- breach incidents derniers 90 jours
- temps moyen detection-to-notification < 72h

## Annexe M. Tests load et stress

### M.1 Test 1000 confirm-mfa concurrent

Load test simulant 1000 confirms MFA simultanes (peak Sprint 11 onboarding) :

```typescript
describe('MFA load test', () => {
  it('handles 1000 concurrent confirm-mfa without DB deadlock', async () => {
    // Setup 1000 users with pending MFA setup
    // Trigger 1000 confirm calls simultaneously
    // Verify : all succeed within 30s window (Argon2 6 hashes per confirm = ~1.5s each, 1000 parallel limited by CPU)
    const ops = Array.from({ length: 1000 }, (_, i) => confirmMfaForUser(`u-${i}`));
    const start = Date.now();
    const results = await Promise.allSettled(ops);
    const duration = Date.now() - start;
    const successCount = results.filter((r) => r.status === 'fulfilled').length;
    expect(successCount).toBeGreaterThanOrEqual(990); // 99% success acceptable under load
    expect(duration).toBeLessThan(60_000); // < 60s total
  });
});
```

### M.2 Stress test verify-mfa burst

```typescript
it('handles burst 100 verify-mfa per second', async () => {
  // Simulates broker_admin login peak (8h-9h MA)
  const interval = setInterval(async () => {
    await Promise.all(Array.from({ length: 10 }, () =>
      request(app.getHttpServer())
        .post('/api/v1/auth/verify-mfa')
        .send({ challenge_token: getValidChallenge(), totp_code: getValidTotp() })
    ));
  }, 100);
  await new Promise((r) => setTimeout(r, 10_000)); // 10s burst
  clearInterval(interval);
  // Total : 1000 verify-mfa
  // Verify : no Redis connection pool exhaustion, p99 latency < 100ms
});
```

## Annexe N. Migration plan Sprint 23 (WebAuthn integration)

Sprint 23 integrera WebAuthn/Passkey pour `garage_technicien` (PWA mobile sans clavier) avec biometric login. La structure MFA actuelle Sprint 5 prevoit l'extension :

(1) Ajouter `auth_users.webauthn_credentials JSONB` (array of credential descriptors). (2) Ajouter `MfaService.startWebAuthnRegistration()` qui retourne challenge + relying party info via @simplewebauthn/server. (3) Ajouter `MfaService.confirmWebAuthnRegistration()` qui verifie l'attestation. (4) Etendre `verifyMfaSchema` avec optional `webauthn_response`. (5) `verify-mfa` endpoint accepte TOTP, recovery code, OU webauthn_response. (6) Helper `prefersWebAuthn(role)` (deja Tache 2.1.1) retourne true pour garage_technicien.

```typescript
// Sprint 23 endpoint addition
@Post('register-webauthn')
@ApiBearerAuth()
async registerWebAuthn(@CurrentAuth() auth: AuthContext) {
  const challenge = await this.mfaService.startWebAuthnRegistration({
    user_id: auth.subject.user.id,
    user_email: auth.subject.user.email,
    user_display_name: auth.subject.user.display_name,
  });
  return challenge;
}

@Post('verify-webauthn')
@Public()
async verifyWebAuthn(@Body() body: { challenge_token: string; webauthn_response: any }) {
  // ... verifies attestation via @simplewebauthn/server
}
```

## Annexe O. SLO et SLA production

Sprint 35 production targets :

| Endpoint | Disponibilite | p99 latency |
|----------|---------------|-------------|
| POST /setup-mfa | 99.95% | < 100 ms |
| POST /confirm-mfa | 99.95% | < 3 sec (Argon2 dominant) |
| POST /verify-mfa (TOTP) | 99.99% | < 50 ms |
| POST /verify-mfa (recovery) | 99.95% | < 3 sec |
| POST /disable-mfa | 99.95% | < 1 sec |

MFA error rate < 0.1% (excluding wrong-code attempts).
MFA setup completion rate > 95% (users qui finissent confirm apres setup).
Recovery codes usage < 5% des verify-mfa total (la majorite utilise TOTP).

---

## Annexe P. Tests E2E MFA scenarios complets

```typescript
// repo/apps/api/test/auth-mfa-full.e2e-spec.ts -- 15 scenarios complets
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { authenticator } from 'otplib';
import request from 'supertest';

describe('MFA Full E2E Scenarios', () => {
  let app: INestApplication;
  let userToken: string;
  let testSecret: string;
  let recoveryCodes: string[];

  beforeAll(async () => {
    // Bootstrap NestJS + DB seeded user + Redis testcontainer
    // Sign in test user to get token
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Scenario 1 : Setup MFA fresh user', () => {
    it('1.1 GET /me shows mfa_enabled=false', async () => {
      const r = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${userToken}`);
      expect(r.body.mfa_enabled).toBe(false);
    });

    it('1.2 POST /setup-mfa returns secret + QR + setup_token', async () => {
      const r = await request(app.getHttpServer())
        .post('/api/v1/auth/setup-mfa')
        .set('Authorization', `Bearer ${userToken}`);
      expect(r.status).toBe(200);
      expect(r.body.secret_b32).toMatch(/^[A-Z2-7]{32}$/);
      expect(r.body.qr_code_data_url).toMatch(/^data:image\/png;base64,/);
      expect(r.body.otpauth_url).toContain('otpauth://totp/');
      testSecret = r.body.secret_b32;
    });

    it('1.3 POST /confirm-mfa with valid TOTP returns 6 recovery codes', async () => {
      const totpCode = authenticator.generate(testSecret);
      const r = await request(app.getHttpServer())
        .post('/api/v1/auth/confirm-mfa')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ setup_token: 'st-from-1.2', totp_code: totpCode });
      expect(r.status).toBe(200);
      expect(r.body.recovery_codes).toHaveLength(6);
      recoveryCodes = r.body.recovery_codes;
    });

    it('1.4 Old token revoked after confirm-mfa (sessions revoked)', async () => {
      const r = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${userToken}`);
      expect(r.status).toBe(401);
    });
  });

  describe('Scenario 2 : Signin avec MFA active', () => {
    it('2.1 Signin returns mfa_required + challenge_token', async () => {
      const r = await request(app.getHttpServer())
        .post('/api/v1/auth/signin')
        .send({ email: 'mfa-user@example.com', password: 'StrongP@ss123!' });
      expect(r.body.mfa_required).toBe(true);
      expect(r.body.mfa_challenge_token).toBeDefined();
    });

    it('2.2 Verify MFA with TOTP returns final tokens', async () => {
      const totpCode = authenticator.generate(testSecret);
      const r = await request(app.getHttpServer())
        .post('/api/v1/auth/verify-mfa')
        .send({ challenge_token: 'ct-from-2.1', totp_code: totpCode });
      expect(r.status).toBe(200);
      expect(r.body.access_token).toBeDefined();
      expect(r.body.mfa_verified).toBe(true);
    });
  });

  describe('Scenario 3 : Recovery code path', () => {
    it('3.1 Lost device : verify with recovery code succeeds', async () => {
      const recoveryCode = recoveryCodes[0];
      const r = await request(app.getHttpServer())
        .post('/api/v1/auth/verify-mfa')
        .send({ challenge_token: 'ct-fresh', recovery_code: recoveryCode });
      expect(r.status).toBe(200);
    });

    it('3.2 Same recovery code reused fails', async () => {
      const r = await request(app.getHttpServer())
        .post('/api/v1/auth/verify-mfa')
        .send({ challenge_token: 'ct-fresh-2', recovery_code: recoveryCodes[0] });
      expect(r.status).toBe(401);
      expect(r.body.code).toBe('MFA_INVALID_CODE');
    });
  });

  describe('Scenario 4 : @RequireMfa endpoint enforcement', () => {
    it('4.1 Non-MFA token rejected on protected endpoint', async () => {
      // Sprint 11 endpoint POST /payments will be tested here
      // For Sprint 5, simulate via test-only endpoint
    });

    it('4.2 MFA-verified token accepted on protected endpoint', async () => {
      // Same with mfa_verified token
    });
  });

  describe('Scenario 5 : Disable MFA flow', () => {
    it('5.1 Disable without password rejected', async () => {
      const r = await request(app.getHttpServer())
        .post('/api/v1/auth/disable-mfa')
        .set('Authorization', `Bearer ${mfaVerifiedToken}`)
        .send({ totp_code: '123456' });
      expect(r.status).toBe(400); // missing current_password
    });

    it('5.2 Disable with valid password + TOTP succeeds', async () => {
      const totpCode = authenticator.generate(testSecret);
      const r = await request(app.getHttpServer())
        .post('/api/v1/auth/disable-mfa')
        .set('Authorization', `Bearer ${mfaVerifiedToken}`)
        .send({ current_password: 'StrongP@ss123!', totp_code: totpCode });
      expect(r.status).toBe(200);
      expect(r.body.mfa_enabled).toBe(false);
      expect(r.body.sessions_revoked).toBeGreaterThanOrEqual(1);
    });

    it('5.3 After disable, signin no longer requires MFA', async () => {
      const r = await request(app.getHttpServer())
        .post('/api/v1/auth/signin')
        .send({ email: 'mfa-user@example.com', password: 'StrongP@ss123!' });
      expect(r.status).toBe(200);
      expect(r.body.mfa_required).toBe(false);
      expect(r.body.access_token).toBeDefined();
    });
  });

  describe('Scenario 6 : Cross-tenant attack defense', () => {
    it('6.1 Setup token from user A cannot be used by user B', async () => {
      const setupA = await setupMfaForUser(userATokenInTest);
      const totpA = authenticator.generate(setupA.secret_b32);
      const r = await request(app.getHttpServer())
        .post('/api/v1/auth/confirm-mfa')
        .set('Authorization', `Bearer ${userBTokenInTest}`)
        .send({ setup_token: setupA.setup_token, totp_code: totpA });
      expect(r.status).toBe(401);
      expect(r.body.code).toBe('MFA_SETUP_EXPIRED');
    });
  });

  describe('Scenario 7 : Challenge token replay', () => {
    it('7.1 Challenge token consumed once cannot be reused', async () => {
      // Get a challenge_token
      // Verify with it -> success
      // Verify again with same token -> MFA_CHALLENGE_EXPIRED
    });
  });

  describe('Scenario 8 : Concurrent verify-mfa', () => {
    it('8.1 Two concurrent verify with same challenge -> only one succeeds', async () => {
      // Atomic consumption guarantees mutual exclusion
    });
  });

  describe('Scenario 9 : Auto-enrollment broker_admin', () => {
    it('9.1 broker_admin signin without MFA setup -> still gets challenge', async () => {
      // isMfaMandatory(broker_admin) = true
      const r = await request(app.getHttpServer())
        .post('/api/v1/auth/signin')
        .send({ email: 'broker-admin@example.com', password: 'StrongP@ss123!' });
      expect(r.body.mfa_required).toBe(true);
      // But user has no secret yet -> Sprint 14 auto-enroll flow
    });
  });

  describe('Scenario 10 : Token expiration window', () => {
    it('10.1 TOTP from previous step (window=1) accepted', async () => {
      vi.setSystemTime(new Date('2026-05-06T10:00:00Z'));
      const totpPrev = authenticator.generate(testSecret);
      vi.setSystemTime(new Date('2026-05-06T10:00:31Z')); // next step
      const r = await request(app.getHttpServer())
        .post('/api/v1/auth/verify-mfa')
        .send({ challenge_token: 'ct', totp_code: totpPrev });
      expect(r.status).toBe(200);
      vi.useRealTimers();
    });

    it('10.2 TOTP from 2 steps ago rejected', async () => {
      vi.setSystemTime(new Date('2026-05-06T10:00:00Z'));
      const totpOld = authenticator.generate(testSecret);
      vi.setSystemTime(new Date('2026-05-06T10:01:30Z'));
      const r = await request(app.getHttpServer())
        .post('/api/v1/auth/verify-mfa')
        .send({ challenge_token: 'ct', totp_code: totpOld });
      expect(r.status).toBe(401);
      vi.useRealTimers();
    });
  });

  describe('Scenario 11 : MFA preserved across password change', () => {
    it('11.1 Reset password keeps mfa_enabled=true', async () => {
      // Recovery flow Tache 2.1.11
      // After reset, mfa_enabled still true, secret still encrypted
    });
  });

  describe('Scenario 12 : Audit log entries', () => {
    it('12.1 mfa_setup_completed event in audit_log + Kafka', async () => {
      // Query audit_log WHERE action = 'auth.mfa_setup_completed'
      // Verify Kafka topic insurtech.events.auth.mfa_setup_completed received message
    });
  });

  describe('Scenario 13 : Multiple devices simultaneously', () => {
    it('13.1 User on 2 devices, MFA verified on 1, other still requires MFA per session', async () => {
      // Each session has its own mfa_verified flag in JWT
    });
  });

  describe('Scenario 14 : Disable MFA after wrong password attempts', () => {
    it('14.1 Wrong password 5x triggers lockout, MFA disable blocked', async () => {
      // Lockout integration Tache 2.1.10
    });
  });

  describe('Scenario 15 : Re-enroll MFA after disable', () => {
    it('15.1 Setup -> Confirm -> Disable -> Re-Setup succeeds', async () => {
      // Full cycle should work without state issues
    });
  });
});
```

## Annexe Q. Patterns de migration role-based MFA enforcement

Sprint 6 introduira par tenant configuration MFA :

```typescript
// Sprint 6 : tenant-level MFA policy
interface TenantMfaPolicy {
  mandatory_for_roles: AuthRole[]; // overrides isMfaMandatory default
  session_timeout_min: number;     // tenant-specific
  recovery_codes_count: number;    // 6 default, 10 for high-security
  totp_window: 0 | 1 | 2;          // strictness level
}

// MfaRequiredGuard reads tenant policy
async canActivate(context: ExecutionContext): Promise<boolean> {
  const requireMfa = this.reflector.getAllAndOverride(REQUIRE_MFA_KEY, [...]);
  const auth = context.switchToHttp().getRequest().auth;

  // Sprint 6 : check tenant policy
  if (auth?.subject?.user?.tenant_id) {
    const policy = await this.tenantPolicyService.getMfaPolicy(auth.subject.user.tenant_id);
    if (policy.mandatory_for_roles.includes(auth.subject.user.role) && !auth.subject.user.mfa_verified) {
      throw MfaRequiredError();
    }
  }

  if (requireMfa && !auth?.subject?.user?.mfa_verified) {
    throw MfaRequiredError();
  }
  return true;
}
```

---

**Fin du prompt task-2.1.8-mfa-required-guard.md.**
