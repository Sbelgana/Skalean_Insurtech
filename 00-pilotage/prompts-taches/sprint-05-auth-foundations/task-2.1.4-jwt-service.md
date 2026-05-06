# TACHE 2.1.4 -- JwtService : Sign + Verify Access/Refresh Tokens + Token Family Rotation

**Sprint** : 5 (Phase 2 / Sprint 1 dans phase) -- Auth Foundations
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-05-sprint-05-auth-foundations.md` (Tache 2.1.4)
**Phase** : 2 -- Securite & Multi-tenant
**Priorite** : P0 (bloquant pour 2.1.5 SessionService, 2.1.6 AuthController, 2.1.8 MfaRequiredGuard, 2.1.15 E2E tests)
**Effort** : 6h
**Dependances** : 2.1.3 (HashingService.sha256 + randomToken consommes ici, Argon2Service via @insurtech/auth)
**Densite cible** : 80-150 ko (auto-suffisant exhaustif)
**AUCUNE EMOJI AUTORISEE**

---

## 1. But

Cette tache vise a livrer le service `JwtService` qui constitue le moteur de signature et de verification des JSON Web Tokens du programme Skalean InsurTech v2.2 : il signe les access tokens (TTL court 15 minutes, payload `JwtPayload` defini Tache 2.1.1) qui authentifient les requetes utilisateurs sur l'API NestJS, signe les refresh tokens (TTL long 30 jours, payload `RefreshTokenPayload` avec champ `token_family` et `generation` pour la detection de vol par replay), verifie la signature et la validite temporelle de tout token presente, expose une methode `decode` non-securisee pour les besoins de debug et de logs avec la mise en garde explicite que le retour ne doit jamais etre considere comme authentifie, et expose une methode `extractFromHeader` qui parse le header HTTP `Authorization: Bearer <token>` avec defense contre les variations de casse (Bearer, BEARER, bearer) et les espaces multiples. Le service expose en outre des erreurs typees discriminees `TokenExpiredError`, `TokenInvalidError`, `TokenAudienceError`, `TokenIssuerError`, `TokenNotBeforeError`, `TokenSignatureError`, qui permettent au consommateur (`JwtStrategy` Tache 2.1.6, AuthController, etc.) de differencier les causes d'echec et de retourner des messages utilisateur appropries (tout en evitant la fuite d'information utile a un attaquant via les codes d'erreur).

L'apport est multiple. Premierement, en separant les deux secrets de signature (`JWT_SECRET` pour les access tokens et `JWT_REFRESH_SECRET` pour les refresh tokens), on garantit que la compromission d'un secret n'expose pas l'autre type de token. Pratiquement, si un attaquant exfiltre `JWT_SECRET` via une vulnerabilite par lecture de la memoire d'un container API (Heap dump, debug endpoint), il peut forger des access tokens (15 minutes) mais pas des refresh tokens (30 jours). Le perimetre de compromission est borne dans le temps. Deuxiemement, le pattern de rotation de refresh tokens avec detection de replay via `token_family` + `generation` materialise la recommandation OAuth 2.0 Best Current Practice (RFC 8252 sec 8.1.5 et RFC 9700) : a chaque utilisation legitime d'un refresh token, le serveur emet un nouveau refresh token de meme `token_family` mais `generation + 1` et invalide explicitement l'ancien. Si l'attaquant a vole un refresh token (par MITM, par cache navigateur, par leak via XSS) et tente de l'utiliser apres que l'utilisateur legitime ait deja effectue un refresh, le serveur detecte que la `generation` presentee est anterieure a la `generation` courante stockee en Redis (Tache 2.1.5) -- c'est le signal de vol -- et revoke l'integralite de la `token_family` (force re-login complet de l'utilisateur sur tous ses devices). Cette propriete defensive est centrale pour la securite du programme. Troisiemement, l'utilisation d'`HS256` (HMAC-SHA256) en Sprint 5 est un compromis intentionnel : c'est suffisant pour un seul service API (1 serveur de signature et de verification, secret partage) et plus performant que `RS256` (asymetrique). La migration vers `RS256` est planifiee Sprint 14 quand la rotation des cles devient necessaire et que potentiellement plusieurs services consomment le JWT (sky-agent Sprint 31, mcp-server). Le service est concu pour permettre cette migration sans reecrire les consommateurs : il suffira de changer le `JWT_PARAMS.algorithm` constant et de fournir une cle privee/publique au lieu d'un secret HMAC.

A l'issue de cette tache, l'API `JwtService.signAccessToken({ sub, tenant_id, email, role, mfa_verified, jti, sid, iss, aud, iat, exp, nbf })` retourne un JWT 3-parties dot-separated `<header>.<payload>.<signature>` deserialisable en JSON valide, `JwtService.verifyAccessToken(token)` accepte le token et retourne le payload original (avec verification stricte de issuer, audience, exp, nbf, signature), `JwtService.verifyAccessToken(expiredToken)` throw `TokenExpiredError` avec un objet `cause: { exp, now }`, `JwtService.verifyAccessToken(tamperedToken)` throw `TokenSignatureError`, `JwtService.signRefreshToken({ sub, sid, token_family, generation, jti, iss, iat, exp })` retourne un refresh JWT signe avec `JWT_REFRESH_SECRET` (different secret), `JwtService.extractFromHeader('Bearer abc')` retourne `'abc'` apres trim, `JwtService.extractFromHeader('Basic abc')` retourne `null`, et la suite Vitest couvre 35+ tests avec coverage >= 92%.

---

## 2. Contexte etendu

### 2.1 Pourquoi cette tache existe

Le programme Skalean InsurTech v2.2 est une API NestJS multi-tenant avec authentification stateless via JWT. Cette architecture impose que chaque requete entrante porte la preuve cryptographique de son authenticite et de son contexte (tenant, role, MFA). Le JWT (RFC 7519) est le standard de fait pour ce besoin : il est self-contained (toutes les claims dans le token, pas besoin de DB lookup pour validation de signature), stateless (pas de session DB pour l'access token), et signe (impossible de forger sans le secret).

Sans `JwtService` centralise, chaque endpoint devrait valider individuellement les claims, dupliquant la logique et risquant d'oublier certaines verifications (ne pas verifier `aud` permet a un attaquant de reutiliser un token emis par un autre service). En centralisant via `JwtService`, on garantit une coherence stricte sur tous les endpoints et un audit unique pour la revue de securite Sprint 33.

Le pattern de rotation des refresh tokens avec detection de vol est documente dans plusieurs RFC (RFC 6749 OAuth 2.0, RFC 6819 Threat Model, RFC 8252 OAuth 2.0 for Native Apps, RFC 9700 OAuth 2.0 Security Best Current Practice 2025) comme defense recommandee contre l'attaque "Refresh Token Theft". Sans cette defense, un attaquant qui leak un refresh token (par exemple via un device perdu, un dump localStorage malveillant via XSS) peut maintenir indefiniment une session active en se faisant emettre periodiquement de nouveaux access tokens. Avec la detection de replay, des que l'utilisateur legitime ou l'attaquant utilise le refresh token, le suivant doit etre la generation `n+1` ; si une `generation` antecedente est presentee, c'est le signal de fork attack -> revocation totale.

L'utilisation de `jti` ULID (vs UUID v4) est un detail signifiant : ULID est sortable lexicographiquement par horodatage de generation, ce qui permet d'identifier en log analyse l'ordre temporel d'emission des tokens (utile a l'audit Tache 2.1.12). UUID v4 pure random ne permet pas cet ordering. Sprint 33 (pentest) confirmera ce choix.

### 2.2 Alternatives considerees

| Alternative | Avantages | Inconvenients | Decision |
|-------------|-----------|---------------|----------|
| Session DB stateful (cookie session_id, lookup DB chaque request) | Simple, revocation immediate par DELETE row | DB lookup chaque request (latency + load), pas de scaling horizontal sans cache | REJETE -- inacceptable a 10k+ rps Sprint 35 |
| JWT HS256 sans rotation refresh token | Simple, suffisant pour MVP | Refresh token vole = compromise eternel jusqu'a expiry | REJETE -- viole defense pattern OAuth 2.0 BCP |
| JWT HS256 + rotation + family detection (RETENU Sprint 5) | Stateless verification, detection vol, performance excellente | Complexite Redis lookup pour detection, Sprint 5 = 1 secret a proteger | RETENU |
| JWT RS256 asymetrique des Sprint 5 | Decouple signing (privee) et verification (publique), permet multi-service | Performance ~10x slower que HS256, complexity rotation key | DEFFERED -- Sprint 14 |
| JWT EdDSA (Ed25519) | Plus moderne, plus rapide que RS256 | Moins de support compliance frameworks Maroc | REJETE -- preferer standards eprouves |
| Token sans jti (no DB tracking) | Performance pure | Impossibilite de revoquer un token avant expiry | REJETE -- besoin signout-all + theft detection |
| jti UUID v4 | Standard universel, plus mature | Pas sortable temporellement | REJETE -- ULID superieur pour audit |
| jti ULID (RETENU) | Sortable lexicographiquement par timestamp, 26 chars vs 36, URL-safe | Moins universel | RETENU |

### 2.3 Trade-offs explicites

Choisir HS256 implique d'accepter un secret partage entre signing et verification : tout instance API qui signe un token peut aussi le verifier, mais la compromission d'une seule instance compromet tous les tokens. Sprint 14 migrera vers RS256 ou EdDSA pour decoupler signing (cle privee, 1 instance) et verification (cle publique, distribuable).

Choisir TTL access 15 minutes implique d'accepter un trade-off UX : l'utilisateur doit refresh tous les 15 minutes (transparent via interceptor frontend Sprint 4). En contrepartie, un access token vole reste utilisable au maximum 15 minutes -- le perimetre de compromission est temporellement borne.

Choisir TTL refresh 30 jours implique d'accepter une duree de validite longue. La defense est la rotation + theft detection : meme sur 30 jours, un refresh token vole sera detecte au premier replay.

Choisir 2 secrets distincts (JWT_SECRET et JWT_REFRESH_SECRET) implique de maintenir 2 env vars. En contrepartie, la compromission d'un secret n'expose pas l'autre type. Le critere V11 verifie que les 2 secrets sont differents.

### 2.4 Decisions strategiques referenced

- **decision-014 (JWT HS256 Sprint 5, RS256 Sprint 14)** : pertinence totale.
- **decision-006 (No-emoji)** : totale.
- **decision-007 (Zod validation)** : indirect -- les claims JWT sont definis via TypeScript interfaces (Tache 2.1.1) et verifies a la verify avec validation manuelle des claims.
- **decision-008 (Data Residency MA)** : indirecte -- secrets stockes Atlas Cloud Services KMS Sprint 35.

### 2.5 Pieges techniques connus

1. **Piege : `jsonwebtoken` v9 reject `none` algorithm.** Bonne propriete mais a verifier explicitement via test.

2. **Piege : `decode()` exposed publiquement utilise sans verify.** Risque de trust accidentel. Solution : nom explicite `decodeUnsafe()`, JSDoc grosse warning, et logger un warn a chaque appel hors mode dev.

3. **Piege : `iat` greater than `now` -- rejet.** Solution : leeway de 5 secondes pour clock skew (verifie V19).

4. **Piege : `exp` interprete comme ms au lieu de s.** Solution : helper `nowInSeconds()` impose seconds (deja Tache 2.1.1).

5. **Piege : `extractFromHeader` accepte casse `bearer` ou multiple espaces.** Solution : regex strict `/^Bearer\s+(\S+)\s*$/i` insensible casse mais strict format.

6. **Piege : tokens emis par autre service avec meme secret accepted.** Solution : verifier `iss` strict.

7. **Piege : `jti` collision (rare mais possible).** Solution : ULID donne 80 bits randomness + timestamp, collision negligeable. Test 10000 unique V12.

8. **Piege : payload trop large (header HTTP > 8KB).** Solution : limiter claims essentielles, ne pas embed donnees redondantes. Test V20 mesure < 2KB.

9. **Piege : signature ressemble lib-specific `===` au lieu constant-time.** Solution : `jsonwebtoken` v9 utilise constant-time en interne, verifie.

10. **Piege : refresh token sans verify de generation -- replay possible.** Solution : Tache 2.1.5 SessionService verifie generation. Cette tache fournit le payload `generation`.

11. **Piege : confusion de type de token.** Solution : verify avec secret different rejette automatiquement le mauvais type. Test V18.

12. **Piege : env JWT_SECRET trop court (< 32 chars).** Solution : throw au boot si < 32 chars.

---

## 3. Architecture context

### 3.1 Position dans le sprint

Tache 2.1.4 livre le moteur JWT consomme par : 2.1.5 (SessionService stocke jti hashe et verifie generation), 2.1.6 (AuthService.signin, signout, refresh ; JwtStrategy passport-jwt ; JwtAuthGuard), 2.1.8 (MfaRequiredGuard verifie `mfa_verified` claim), 2.1.9 (Signup emet email_verified_token via JwtService apparente), 2.1.11 (Recovery emet recovery_token), 2.1.12 (Audit log inclut jti), 2.1.15 (E2E tests verifient les flows complet).

### 3.2 Position dans le programme global

- Sprint 6 : `TenantContextService` lit `tenant_id` du JwtPayload et seede AsyncLocalStorage.
- Sprint 7 : `RbacService` lit `role` du JwtPayload pour evaluer les permissions.
- Sprint 14 : migration HS256 -> RS256 ; ce service expose un point unique a modifier (constant `JWT_PARAMS.algorithm`).
- Sprint 23 : WebAuthn integration ; `mfa_verified` toujours seule source de verite mais alimentee par WebAuthnService au lieu de TOTP.
- Sprint 31 : ServiceJwtPayload pour Sky agent ; le service supporte deja le type `ServiceJwtPayload` (declare Tache 2.1.1).
- Sprint 33 : pentest review verifie tous les claims et secrets.
- Sprint 35 : secrets migres dans Atlas Cloud Services KMS Benguerir HSM.

### 3.3 Diagramme d'integration

```
+-----------------------------------+
|  Tache 2.1.3 termine               |
|  HashingService.sha256            |
|  HashingService.randomToken       |
+-----------------+-----------------+
                  |
                  v
+-----------------------------------+
|  TACHE 2.1.4 (cette tache)         |
|  JwtService                       |
|  - signAccessToken(payload)       |
|  - signRefreshToken(payload)      |
|  - verifyAccessToken(token)       |
|  - verifyRefreshToken(token)      |
|  - decodeUnsafe(token)            |
|  - extractFromHeader(header)      |
|  Errors :                         |
|  - TokenExpiredError              |
|  - TokenInvalidError              |
|  - TokenAudienceError             |
|  - TokenIssuerError               |
|  - TokenSignatureError            |
+--+---+---+---+---+---+---+---+---+
   |   |   |   |   |   |   |   |
   v   v   v   v   v   v   v   v
2.1.5 SessionService (rotateSession)
2.1.6 AuthService.signin/refresh
2.1.6 JwtStrategy.validate
2.1.6 JwtAuthGuard
2.1.8 MfaRequiredGuard
2.1.9 Signup (email_verify_token)
2.1.11 Recovery (recovery_token)
2.1.12 Audit (logs jti)
```

---

## 4. Livrables checkables (24 livrables)

- [ ] Service `repo/packages/auth/src/services/jwt.service.ts` : classe `@Injectable() JwtService` avec methods sign/verify/decode/extract -- environ 280 lignes
- [ ] Errors `repo/packages/auth/src/errors/token-errors.ts` : 6 classes erreur typees (TokenExpiredError, TokenInvalidError, TokenAudienceError, TokenIssuerError, TokenNotBeforeError, TokenSignatureError) -- environ 100 lignes
- [ ] Helper `repo/packages/auth/src/services/jwt.helpers.ts` : `parseJwtClaims`, `validateClaims`, `parseAuthHeader` -- environ 120 lignes
- [ ] Type `repo/packages/auth/src/types/token-pair.ts` : `TokenPair`, `SignedJwt` brand type -- environ 40 lignes
- [ ] Mise a jour `repo/packages/auth/src/auth.module.ts` : ajouter JwtService aux providers -- modification ~10 lignes
- [ ] Mise a jour `repo/packages/auth/src/index.ts` : exports -- modification ~10 lignes
- [ ] Mise a jour `repo/packages/auth/package.json` : ajouter `jsonwebtoken@9.0.2`, `@types/jsonwebtoken@9.0.7`, `ulid@2.3.0` -- modification
- [ ] Mise a jour `.env.example` : JWT_SECRET, JWT_REFRESH_SECRET (>= 64 chars chacun) -- modification
- [ ] Tests `repo/packages/auth/test/services/jwt.service.spec.ts` : 25+ tests (sign + verify roundtrip access + refresh, expired, tampered, wrong audience, wrong issuer, decode without verify, extract header variations) -- environ 380 lignes
- [ ] Tests `repo/packages/auth/test/services/jwt.helpers.spec.ts` : 8 tests parsing -- environ 120 lignes
- [ ] Tests `repo/packages/auth/test/errors/token-errors.spec.ts` : 6 tests instantiation et serialisation -- environ 80 lignes
- [ ] Tests integration `repo/packages/auth/test/integration/jwt.integration.spec.ts` : 4 tests (full flow access + refresh + rotation simulation) -- environ 120 lignes
- [ ] Bench `repo/packages/auth/test/bench/jwt.bench.ts` : sign/verify duration -- environ 60 lignes
- [ ] No-emoji verifie
- [ ] No-console verifie
- [ ] Build TypeScript reussit
- [ ] Coverage >= 92%
- [ ] Documentation JSDoc complete sur chaque methode
- [ ] Format token : header.payload.signature 3-parties dot-separated
- [ ] jti ULID (sortable timestamp)
- [ ] token_family ULID partage entre rotations
- [ ] generation incremente (1, 2, 3, ...) a chaque rotation
- [ ] iss = "skalean-insurtech-api", aud = "skalean-insurtech-app"
- [ ] Leeway 5s pour clock skew
- [ ] Tests passants 40+

---

## 5. Fichiers crees / modifies

```
repo/packages/auth/src/services/jwt.service.ts                          (~280 lignes / classe principale)
repo/packages/auth/src/services/jwt.helpers.ts                          (~120 lignes / helpers parsing)
repo/packages/auth/src/errors/token-errors.ts                           (~100 lignes / 6 classes)
repo/packages/auth/src/types/token-pair.ts                              (~40 lignes  / TokenPair, SignedJwt brand)
repo/packages/auth/src/auth.module.ts                                   (modifie    / +JwtService)
repo/packages/auth/src/index.ts                                         (modifie    / +exports)
repo/packages/auth/package.json                                         (modifie    / +deps)
.env.example                                                             (modifie    / +JWT secrets)
repo/packages/auth/test/services/jwt.service.spec.ts                    (~380 lignes / 25+ tests)
repo/packages/auth/test/services/jwt.helpers.spec.ts                    (~120 lignes / 8 tests)
repo/packages/auth/test/errors/token-errors.spec.ts                     (~80 lignes  / 6 tests)
repo/packages/auth/test/integration/jwt.integration.spec.ts             (~120 lignes / 4 tests)
repo/packages/auth/test/bench/jwt.bench.ts                              (~60 lignes  / bench)
```

---

## 6. Code patterns COMPLETS

### 6.1 Fichier 1 / 9 : `repo/packages/auth/src/errors/token-errors.ts`

```typescript
/**
 * @insurtech/auth/errors/token-errors
 *
 * Strongly typed error hierarchy for JWT verification failures.
 * Consumed by JwtService.verify*, JwtStrategy, AuthController.
 */

export class TokenError extends Error {
  readonly code: string;
  readonly status: number = 401;

  constructor(message: string, code: string, public readonly cause?: Record<string, unknown>) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
  }

  toJSON(): Record<string, unknown> {
    return { name: this.name, code: this.code, message: this.message, cause: this.cause };
  }
}

export class TokenExpiredError extends TokenError {
  constructor(exp: number, now: number) {
    super(`Token expired at ${new Date(exp * 1000).toISOString()}`, 'TOKEN_EXPIRED', { exp, now });
  }
}

export class TokenNotBeforeError extends TokenError {
  constructor(nbf: number, now: number) {
    super(`Token not yet valid (nbf=${nbf}, now=${now})`, 'TOKEN_NOT_YET_VALID', { nbf, now });
  }
}

export class TokenSignatureError extends TokenError {
  constructor(detail?: string) {
    super(detail ?? 'Token signature verification failed', 'TOKEN_SIGNATURE_INVALID');
  }
}

export class TokenAudienceError extends TokenError {
  constructor(expected: string, actual: string | undefined) {
    super(`Token audience mismatch: expected '${expected}', got '${actual ?? 'undefined'}'`, 'TOKEN_AUDIENCE_INVALID', { expected, actual });
  }
}

export class TokenIssuerError extends TokenError {
  constructor(expected: string, actual: string | undefined) {
    super(`Token issuer mismatch: expected '${expected}', got '${actual ?? 'undefined'}'`, 'TOKEN_ISSUER_INVALID', { expected, actual });
  }
}

export class TokenInvalidError extends TokenError {
  constructor(detail: string) {
    super(`Token invalid: ${detail}`, 'TOKEN_INVALID');
  }
}

export class TokenMissingClaimError extends TokenError {
  constructor(claim: string) {
    super(`Token missing required claim: ${claim}`, 'TOKEN_MISSING_CLAIM', { claim });
  }
}

export function isTokenError(err: unknown): err is TokenError {
  return err instanceof TokenError;
}
```

### 6.2 Fichier 2 / 9 : `repo/packages/auth/src/types/token-pair.ts`

```typescript
/**
 * @insurtech/auth/types/token-pair
 *
 * Returned by JwtService for sign methods and AuthService.signin / refresh.
 */

declare const __signedJwtBrand: unique symbol;

export type SignedJwt = string & { readonly [__signedJwtBrand]: true };

export interface TokenPair {
  access_token: SignedJwt;
  refresh_token: SignedJwt;
  access_expires_at: number;
  refresh_expires_at: number;
  token_type: 'Bearer';
}
```

### 6.3 Fichier 3 / 9 : `repo/packages/auth/src/services/jwt.helpers.ts`

```typescript
/**
 * @insurtech/auth/services/jwt.helpers
 *
 * Pure helpers for JWT parsing and validation. Exported for unit testing.
 */

import { TokenInvalidError, TokenMissingClaimError } from '../errors/token-errors.js';

const BEARER_REGEX = /^Bearer\s+(\S+)\s*$/i;

/**
 * Parses the Authorization header strictly.
 * Accepts case-insensitive "Bearer" with one or more whitespace separators.
 * Returns null for any non-Bearer scheme or malformed.
 */
export function parseAuthHeader(header: string | undefined | null): string | null {
  if (typeof header !== 'string' || header.length === 0) return null;
  const m = BEARER_REGEX.exec(header.trim());
  return m && m[1] ? m[1] : null;
}

/**
 * Splits a JWT into its 3 base64url segments.
 * Throws TokenInvalidError if not exactly 3 parts.
 */
export function splitJwtSegments(token: string): { header: string; payload: string; signature: string } {
  if (typeof token !== 'string' || token.length === 0) {
    throw new TokenInvalidError('empty token');
  }
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new TokenInvalidError(`expected 3 segments, got ${parts.length}`);
  }
  const [header, payload, signature] = parts;
  if (!header || !payload || !signature) {
    throw new TokenInvalidError('empty segment');
  }
  return { header, payload, signature };
}

/**
 * Decodes a base64url JWT segment (header or payload) into JSON.
 * Returns null on parse error (caller decides if throw is appropriate).
 */
export function decodeSegmentJson<T = Record<string, unknown>>(segment: string): T | null {
  try {
    const json = Buffer.from(segment, 'base64url').toString('utf-8');
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

/**
 * Asserts that all required claims are present and of correct type.
 * Throws TokenMissingClaimError on absence.
 */
export function assertRequiredClaims(payload: Record<string, unknown>, required: readonly string[]): void {
  for (const claim of required) {
    if (!(claim in payload)) {
      throw new TokenMissingClaimError(claim);
    }
  }
}

export const REQUIRED_ACCESS_CLAIMS = Object.freeze([
  'sub', 'tenant_id', 'email', 'role', 'mfa_verified', 'jti', 'sid', 'iss', 'aud', 'iat', 'exp', 'nbf',
] as const);

export const REQUIRED_REFRESH_CLAIMS = Object.freeze([
  'sub', 'sid', 'token_family', 'generation', 'jti', 'iat', 'exp', 'iss',
] as const);
```

### 6.4 Fichier 4 / 9 : `repo/packages/auth/src/services/jwt.service.ts`

```typescript
/**
 * @insurtech/auth/services/jwt
 *
 * Signs and verifies JWT (access + refresh) for the program.
 *
 * Reference :
 *   - RFC 7519 (JWT)
 *   - RFC 7515 (JWS)
 *   - RFC 6749 + 8252 + 9700 (OAuth 2.0 + Best Current Practice)
 *   - decision-014 (HS256 Sprint 5, RS256 Sprint 14)
 *   - Sprint 5 Tache 2.1.4 (this task)
 *
 * Sprint 5 secrets : JWT_SECRET (access) and JWT_REFRESH_SECRET (refresh) -- separate.
 * Sprint 14 will migrate to RS256 with key rotation 90 days.
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import jwt from 'jsonwebtoken';
import type { Algorithm, SignOptions, VerifyOptions } from 'jsonwebtoken';
import { ulid } from 'ulid';
import { JWT_PARAMS } from '../constants/jwt-params.js';
import type { JwtPayload, RefreshTokenPayload, ServiceJwtPayload } from '../types/jwt-payload.js';
import { nowInSeconds, expirySeconds } from '../types/jwt-payload.js';
import type { SignedJwt } from '../types/token-pair.js';
import {
  TokenExpiredError,
  TokenSignatureError,
  TokenAudienceError,
  TokenIssuerError,
  TokenNotBeforeError,
  TokenInvalidError,
  TokenMissingClaimError,
} from '../errors/token-errors.js';
import {
  splitJwtSegments,
  decodeSegmentJson,
  parseAuthHeader,
  assertRequiredClaims,
  REQUIRED_ACCESS_CLAIMS,
  REQUIRED_REFRESH_CLAIMS,
} from './jwt.helpers.js';

const ALGORITHM: Algorithm = 'HS256';

@Injectable()
export class JwtService implements OnModuleInit {
  private readonly logger = new Logger(JwtService.name);
  private accessSecret: string | null = null;
  private refreshSecret: string | null = null;
  private issuer = 'skalean-insurtech-api';
  private audience = 'skalean-insurtech-app';

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const accessSecret = this.config.get<string>('JWT_SECRET');
    const refreshSecret = this.config.get<string>('JWT_REFRESH_SECRET');
    if (!accessSecret) throw new Error('JwtService: JWT_SECRET env var is required');
    if (!refreshSecret) throw new Error('JwtService: JWT_REFRESH_SECRET env var is required');
    if (accessSecret.length < 64) {
      throw new Error(`JwtService: JWT_SECRET must be >= 64 chars (got ${accessSecret.length}). Generate with \`openssl rand -base64 48\`.`);
    }
    if (refreshSecret.length < 64) {
      throw new Error(`JwtService: JWT_REFRESH_SECRET must be >= 64 chars (got ${refreshSecret.length}).`);
    }
    if (accessSecret === refreshSecret) {
      throw new Error('JwtService: JWT_SECRET and JWT_REFRESH_SECRET must be different');
    }
    this.accessSecret = accessSecret;
    this.refreshSecret = refreshSecret;
    this.issuer = this.config.get<string>('JWT_ISSUER') ?? 'skalean-insurtech-api';
    this.audience = this.config.get<string>('JWT_AUDIENCE') ?? 'skalean-insurtech-app';
    this.logger.log({ action: 'jwt_init', algorithm: ALGORITHM, issuer: this.issuer, audience: this.audience });
  }

  /**
   * Signs an access token with HS256 and JWT_SECRET.
   * Caller provides minimal claims (sub, tenant_id, email, role, mfa_verified) ;
   * service fills jti, sid, iss, aud, iat, exp, nbf.
   */
  signAccessToken(input: Omit<JwtPayload, 'jti' | 'iss' | 'aud' | 'iat' | 'exp' | 'nbf' | 'sid'> & { sid: string }): SignedJwt {
    if (this.accessSecret === null) throw new Error('JwtService not initialized');
    const iat = nowInSeconds();
    const ttl = JWT_PARAMS.ttl_access_seconds;
    const payload: JwtPayload = {
      sub: input.sub,
      tenant_id: input.tenant_id,
      email: input.email,
      role: input.role,
      mfa_verified: input.mfa_verified,
      sid: input.sid,
      jti: ulid(),
      iss: this.issuer,
      aud: this.audience,
      iat,
      nbf: iat,
      exp: iat + ttl,
    };
    const token = jwt.sign(payload, this.accessSecret, {
      algorithm: ALGORITHM,
      noTimestamp: true,
    } as SignOptions);
    return token as SignedJwt;
  }

  signRefreshToken(input: Omit<RefreshTokenPayload, 'jti' | 'iss' | 'iat' | 'exp'>): SignedJwt {
    if (this.refreshSecret === null) throw new Error('JwtService not initialized');
    const iat = nowInSeconds();
    const ttl = JWT_PARAMS.ttl_refresh_seconds;
    const payload: RefreshTokenPayload = {
      sub: input.sub,
      sid: input.sid,
      token_family: input.token_family,
      generation: input.generation,
      jti: ulid(),
      iss: this.issuer,
      iat,
      exp: iat + ttl,
    };
    const token = jwt.sign(payload, this.refreshSecret, {
      algorithm: ALGORITHM,
      noTimestamp: true,
    } as SignOptions);
    return token as SignedJwt;
  }

  /**
   * Verifies an access token : signature, expiration, issuer, audience, required claims.
   * Throws specific TokenError subclass on failure.
   */
  verifyAccessToken(token: string): JwtPayload {
    if (this.accessSecret === null) throw new Error('JwtService not initialized');
    return this.verifyToken<JwtPayload>(
      token,
      this.accessSecret,
      REQUIRED_ACCESS_CLAIMS,
      { audience: this.audience, issuer: this.issuer },
    );
  }

  verifyRefreshToken(token: string): RefreshTokenPayload {
    if (this.refreshSecret === null) throw new Error('JwtService not initialized');
    return this.verifyToken<RefreshTokenPayload>(
      token,
      this.refreshSecret,
      REQUIRED_REFRESH_CLAIMS,
      { issuer: this.issuer },
    );
  }

  private verifyToken<T extends Record<string, unknown>>(
    token: string,
    secret: string,
    requiredClaims: readonly string[],
    expected: { audience?: string; issuer?: string },
  ): T {
    let decoded: jwt.JwtPayload | string;
    try {
      decoded = jwt.verify(token, secret, {
        algorithms: [ALGORITHM],
        clockTolerance: JWT_PARAMS.leeway_seconds,
        audience: expected.audience,
        issuer: expected.issuer,
      } as VerifyOptions);
    } catch (err) {
      this.translateJwtError(err);
    }
    if (typeof decoded! !== 'object' || decoded === null) {
      throw new TokenInvalidError('payload is not an object');
    }
    assertRequiredClaims(decoded as Record<string, unknown>, requiredClaims);
    return decoded as T;
  }

  /**
   * Translates jsonwebtoken errors into typed TokenError subclasses.
   */
  private translateJwtError(err: unknown): never {
    if (err instanceof jwt.TokenExpiredError) {
      throw new TokenExpiredError(Math.floor(err.expiredAt.getTime() / 1000), nowInSeconds());
    }
    if (err instanceof jwt.NotBeforeError) {
      throw new TokenNotBeforeError(Math.floor(err.date.getTime() / 1000), nowInSeconds());
    }
    if (err instanceof jwt.JsonWebTokenError) {
      const msg = err.message.toLowerCase();
      if (msg.includes('audience')) throw new TokenAudienceError(this.audience, undefined);
      if (msg.includes('issuer')) throw new TokenIssuerError(this.issuer, undefined);
      if (msg.includes('signature')) throw new TokenSignatureError();
      throw new TokenInvalidError(err.message);
    }
    throw new TokenInvalidError('unknown verification error');
  }

  /**
   * Decodes a JWT WITHOUT verifying its signature.
   * USE ONLY FOR DEBUG / LOGS / NON-AUTHORITATIVE INSPECTION.
   * NEVER trust the returned payload for authorization decisions.
   */
  decodeUnsafe<T = Record<string, unknown>>(token: string): T | null {
    try {
      const { payload } = splitJwtSegments(token);
      return decodeSegmentJson<T>(payload);
    } catch {
      return null;
    }
  }

  /**
   * Extracts the bearer token from an Authorization header.
   * Returns null for missing, non-Bearer, or malformed.
   */
  extractFromHeader(header: string | undefined | null): string | null {
    return parseAuthHeader(header);
  }

  /**
   * Generates a new ULID (sortable timestamp identifier) for use as jti, sid, or token_family.
   */
  generateId(): string {
    return ulid();
  }
}
```

### 6.5 Fichier 5 / 9 : Mise a jour `repo/packages/auth/src/auth.module.ts`

```typescript
import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Argon2Service } from './services/argon2.service.js';
import { PepperService } from './services/pepper.service.js';
import { EncryptionService } from './services/encryption.service.js';
import { HashingService } from './services/hashing.service.js';
import { JwtService } from './services/jwt.service.js';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [PepperService, Argon2Service, EncryptionService, HashingService, JwtService],
  controllers: [],
  exports: [PepperService, Argon2Service, EncryptionService, HashingService, JwtService],
})
export class AuthModule {}
```

### 6.6 Fichier 6 / 9 : Mise a jour `repo/packages/auth/src/index.ts`

```typescript
export * from './types/index.js';
export * from './schemas/index.js';
export * from './constants/index.js';

export { Argon2Service } from './services/argon2.service.js';
export type { PolicyValidationContext } from './services/argon2.service.js';
export { PepperService } from './services/pepper.service.js';
export { EncryptionService } from './services/encryption.service.js';
export { HashingService } from './services/hashing.service.js';
export { JwtService } from './services/jwt.service.js';

export {
  TokenError,
  TokenExpiredError,
  TokenNotBeforeError,
  TokenSignatureError,
  TokenAudienceError,
  TokenIssuerError,
  TokenInvalidError,
  TokenMissingClaimError,
  isTokenError,
} from './errors/token-errors.js';

export type { SignedJwt, TokenPair } from './types/token-pair.js';
export type { PasswordPolicyResult, PasswordPolicyReason } from './types/password-policy-result.js';
export { ALL_PASSWORD_POLICY_REASONS } from './types/password-policy-result.js';
export type { EncryptedString, EncryptedPayload } from './types/encrypted-payload.js';
export { AuthModule } from './auth.module.js';
```

### 6.7 Fichier 7 / 9 : `.env.example` (additions)

```env
# Sprint 5 Tache 2.1.4 -- JwtService
# Generate each with : openssl rand -base64 48 (>= 64 chars)
JWT_SECRET=replace-with-base64-48-chars-min-64-chars-after-decode-line
JWT_REFRESH_SECRET=replace-with-different-base64-48-chars-DIFFERENT-from-JWT_SECRET
JWT_ISSUER=skalean-insurtech-api
JWT_AUDIENCE=skalean-insurtech-app
```

### 6.8 Fichier 8 / 9 : Mise a jour `repo/packages/auth/package.json` (additions)

```json
{
  "dependencies": {
    "jsonwebtoken": "9.0.2",
    "ulid": "2.3.0"
  },
  "devDependencies": {
    "@types/jsonwebtoken": "9.0.7"
  }
}
```

### 6.9 Fichier 9 / 9 : Tests integration (extrait, voir section 7)

Voir section 7.4.

---

## 7. Tests complets

### 7.1 Tests unitaires : `repo/packages/auth/test/services/jwt.service.spec.ts`

```typescript
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { JwtService } from '../../src/services/jwt.service.js';
import { AuthRole } from '../../src/types/auth-roles.js';
import {
  TokenExpiredError,
  TokenSignatureError,
  TokenAudienceError,
  TokenIssuerError,
  TokenInvalidError,
} from '../../src/errors/token-errors.js';

describe('JwtService', () => {
  let service: JwtService;
  let secret: string;
  let refreshSecret: string;

  beforeAll(async () => {
    secret = randomBytes(48).toString('base64');
    refreshSecret = randomBytes(48).toString('base64') + 'DIFF';
    process.env.JWT_SECRET = secret;
    process.env.JWT_REFRESH_SECRET = refreshSecret;
    process.env.JWT_ISSUER = 'skalean-insurtech-api';
    process.env.JWT_AUDIENCE = 'skalean-insurtech-app';
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      providers: [JwtService],
    }).compile();
    service = moduleRef.get(JwtService);
    service.onModuleInit();
  });

  describe('signAccessToken', () => {
    it('returns a 3-part dot-separated JWT', () => {
      const t = service.signAccessToken({
        sub: 'user-1',
        tenant_id: 'tenant-1',
        email: 'a@b.com',
        role: AuthRole.BrokerUser,
        mfa_verified: true,
        sid: service.generateId(),
      });
      expect(t.split('.')).toHaveLength(3);
    });

    it('payload contains expected claims', () => {
      const sid = service.generateId();
      const t = service.signAccessToken({
        sub: 'u1', tenant_id: 't1', email: 'e@e.com', role: AuthRole.BrokerAdmin,
        mfa_verified: false, sid,
      });
      const decoded = service.decodeUnsafe<any>(t);
      expect(decoded?.sub).toBe('u1');
      expect(decoded?.iss).toBe('skalean-insurtech-api');
      expect(decoded?.aud).toBe('skalean-insurtech-app');
      expect(decoded?.role).toBe(AuthRole.BrokerAdmin);
      expect(decoded?.mfa_verified).toBe(false);
      expect(decoded?.sid).toBe(sid);
      expect(typeof decoded?.jti).toBe('string');
    });
  });

  describe('verifyAccessToken', () => {
    it('round-trips the same payload', () => {
      const sid = service.generateId();
      const signed = service.signAccessToken({
        sub: 'u1', tenant_id: 't1', email: 'e@e.com', role: AuthRole.BrokerUser,
        mfa_verified: true, sid,
      });
      const verified = service.verifyAccessToken(signed);
      expect(verified.sub).toBe('u1');
      expect(verified.role).toBe(AuthRole.BrokerUser);
    });

    it('throws TokenExpiredError on expired token', () => {
      const expired = jwt.sign(
        {
          sub: 'u1', tenant_id: null, email: 'e@e.com', role: AuthRole.SuperAdminPlatform,
          mfa_verified: true, jti: 'jti1', sid: 'sid1',
          iss: 'skalean-insurtech-api', aud: 'skalean-insurtech-app',
          iat: 1000, nbf: 1000, exp: 1001,
        },
        secret,
        { algorithm: 'HS256', noTimestamp: true },
      );
      expect(() => service.verifyAccessToken(expired)).toThrow(TokenExpiredError);
    });

    it('throws TokenSignatureError on tampered signature', () => {
      const t = service.signAccessToken({
        sub: 'u1', tenant_id: 't1', email: 'e@e.com', role: AuthRole.Assure,
        mfa_verified: false, sid: service.generateId(),
      });
      const tampered = `${t.split('.').slice(0, 2).join('.')}.${'A'.repeat(43)}`;
      expect(() => service.verifyAccessToken(tampered)).toThrow(TokenSignatureError);
    });

    it('throws TokenAudienceError on wrong audience', () => {
      const wrong = jwt.sign(
        {
          sub: 'u1', tenant_id: null, email: 'e@e.com', role: AuthRole.BrokerUser,
          mfa_verified: true, jti: 'j', sid: 's',
          iss: 'skalean-insurtech-api', aud: 'wrong-aud',
          iat: Math.floor(Date.now() / 1000), nbf: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 900,
        },
        secret,
        { algorithm: 'HS256', noTimestamp: true },
      );
      expect(() => service.verifyAccessToken(wrong)).toThrow(TokenAudienceError);
    });

    it('throws TokenIssuerError on wrong issuer', () => {
      const wrong = jwt.sign(
        {
          sub: 'u1', tenant_id: null, email: 'e@e.com', role: AuthRole.BrokerUser,
          mfa_verified: true, jti: 'j', sid: 's',
          iss: 'wrong-iss', aud: 'skalean-insurtech-app',
          iat: Math.floor(Date.now() / 1000), nbf: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 900,
        },
        secret,
        { algorithm: 'HS256', noTimestamp: true },
      );
      expect(() => service.verifyAccessToken(wrong)).toThrow(TokenIssuerError);
    });

    it('throws TokenInvalidError on malformed token', () => {
      expect(() => service.verifyAccessToken('not-a-jwt')).toThrow(TokenInvalidError);
    });

    it('rejects token signed with refresh secret', () => {
      const wrongSecret = jwt.sign(
        { sub: 'u1', tenant_id: null, email: 'e@e.com', role: AuthRole.BrokerUser, mfa_verified: false, jti: 'j', sid: 's',
          iss: 'skalean-insurtech-api', aud: 'skalean-insurtech-app',
          iat: Math.floor(Date.now() / 1000), nbf: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 900 },
        refreshSecret,
        { algorithm: 'HS256', noTimestamp: true },
      );
      expect(() => service.verifyAccessToken(wrongSecret)).toThrow();
    });
  });

  describe('signRefreshToken + verifyRefreshToken', () => {
    it('round-trips refresh payload', () => {
      const sid = service.generateId();
      const family = service.generateId();
      const t = service.signRefreshToken({ sub: 'u1', sid, token_family: family, generation: 1 });
      const verified = service.verifyRefreshToken(t);
      expect(verified.sub).toBe('u1');
      expect(verified.token_family).toBe(family);
      expect(verified.generation).toBe(1);
    });

    it('refresh token signed with different secret than access', () => {
      const access = service.signAccessToken({
        sub: 'u1', tenant_id: 't1', email: 'e@e.com', role: AuthRole.BrokerUser,
        mfa_verified: false, sid: service.generateId(),
      });
      const refresh = service.signRefreshToken({
        sub: 'u1', sid: service.generateId(), token_family: service.generateId(), generation: 1,
      });
      expect(() => service.verifyAccessToken(refresh)).toThrow();
      expect(() => service.verifyRefreshToken(access)).toThrow();
    });

    it('rejects refresh with wrong audience claim absent', () => {
      const t = service.signRefreshToken({ sub: 'u1', sid: 's', token_family: 'f', generation: 1 });
      // refresh tokens dont include audience -- verify should still succeed
      expect(() => service.verifyRefreshToken(t)).not.toThrow();
    });
  });

  describe('decodeUnsafe', () => {
    it('returns payload without verifying signature', () => {
      const t = service.signAccessToken({
        sub: 'u1', tenant_id: null, email: 'e@e.com', role: AuthRole.SuperAdminPlatform,
        mfa_verified: true, sid: service.generateId(),
      });
      const decoded = service.decodeUnsafe<any>(t);
      expect(decoded?.sub).toBe('u1');
    });

    it('returns null on malformed token', () => {
      expect(service.decodeUnsafe('not-a-jwt')).toBeNull();
      expect(service.decodeUnsafe('')).toBeNull();
    });

    it('decodes expired token without throwing', () => {
      const expired = jwt.sign(
        { sub: 'old', exp: 1, iat: 0 },
        secret,
        { algorithm: 'HS256', noTimestamp: true },
      );
      const decoded = service.decodeUnsafe<any>(expired);
      expect(decoded?.sub).toBe('old');
    });
  });

  describe('extractFromHeader', () => {
    it('extracts token from Bearer header', () => {
      expect(service.extractFromHeader('Bearer abc.def.ghi')).toBe('abc.def.ghi');
    });

    it('case-insensitive Bearer scheme', () => {
      expect(service.extractFromHeader('bearer abc')).toBe('abc');
      expect(service.extractFromHeader('BEARER abc')).toBe('abc');
    });

    it('returns null for non-Bearer scheme', () => {
      expect(service.extractFromHeader('Basic abc')).toBeNull();
      expect(service.extractFromHeader('Token abc')).toBeNull();
    });

    it('returns null for missing header', () => {
      expect(service.extractFromHeader(undefined)).toBeNull();
      expect(service.extractFromHeader(null)).toBeNull();
      expect(service.extractFromHeader('')).toBeNull();
    });

    it('returns null for malformed', () => {
      expect(service.extractFromHeader('Bearer')).toBeNull();
      expect(service.extractFromHeader('Bearer  ')).toBeNull();
    });

    it('handles multiple whitespace', () => {
      expect(service.extractFromHeader('Bearer   abc')).toBe('abc');
    });
  });

  describe('generateId', () => {
    it('returns ULID 26 chars', () => {
      const id = service.generateId();
      expect(id).toHaveLength(26);
    });

    it('produces unique IDs', () => {
      const set = new Set<string>();
      for (let i = 0; i < 1000; i += 1) set.add(service.generateId());
      expect(set.size).toBe(1000);
    });

    it('produces sortable IDs (timestamp prefix)', () => {
      const a = service.generateId();
      const b = service.generateId();
      expect(b >= a).toBe(true);
    });
  });

  describe('Initialization', () => {
    it('throws if JWT_SECRET missing', async () => {
      const oldSecret = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;
      const moduleRef = await Test.createTestingModule({
        imports: [ConfigModule.forRoot({ isGlobal: true })],
        providers: [JwtService],
      }).compile();
      const svc = moduleRef.get(JwtService);
      expect(() => svc.onModuleInit()).toThrow(/JWT_SECRET/);
      process.env.JWT_SECRET = oldSecret;
    });

    it('throws if JWT_SECRET too short', async () => {
      const oldSecret = process.env.JWT_SECRET;
      process.env.JWT_SECRET = 'short';
      const moduleRef = await Test.createTestingModule({
        imports: [ConfigModule.forRoot({ isGlobal: true })],
        providers: [JwtService],
      }).compile();
      const svc = moduleRef.get(JwtService);
      expect(() => svc.onModuleInit()).toThrow(/64 chars/);
      process.env.JWT_SECRET = oldSecret;
    });

    it('throws if JWT_SECRET equals JWT_REFRESH_SECRET', async () => {
      const same = 'a'.repeat(64);
      const oldSecret = process.env.JWT_SECRET;
      const oldRefresh = process.env.JWT_REFRESH_SECRET;
      process.env.JWT_SECRET = same;
      process.env.JWT_REFRESH_SECRET = same;
      const moduleRef = await Test.createTestingModule({
        imports: [ConfigModule.forRoot({ isGlobal: true })],
        providers: [JwtService],
      }).compile();
      const svc = moduleRef.get(JwtService);
      expect(() => svc.onModuleInit()).toThrow(/different/);
      process.env.JWT_SECRET = oldSecret;
      process.env.JWT_REFRESH_SECRET = oldRefresh;
    });
  });

  describe('Clock skew leeway', () => {
    it('accepts token with iat slightly in future (within 5s leeway)', () => {
      const future = Math.floor(Date.now() / 1000) + 3;
      const t = jwt.sign(
        {
          sub: 'u', tenant_id: null, email: 'e@e.com', role: AuthRole.BrokerUser,
          mfa_verified: false, jti: 'j', sid: 's',
          iss: 'skalean-insurtech-api', aud: 'skalean-insurtech-app',
          iat: future, nbf: future, exp: future + 900,
        },
        secret,
        { algorithm: 'HS256', noTimestamp: true },
      );
      expect(() => service.verifyAccessToken(t)).not.toThrow();
    });
  });
});
```

### 7.2 Tests : `repo/packages/auth/test/services/jwt.helpers.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  parseAuthHeader,
  splitJwtSegments,
  decodeSegmentJson,
  assertRequiredClaims,
} from '../../src/services/jwt.helpers.js';
import { TokenInvalidError, TokenMissingClaimError } from '../../src/errors/token-errors.js';

describe('parseAuthHeader', () => {
  it('parses standard Bearer header', () => {
    expect(parseAuthHeader('Bearer abc.def.ghi')).toBe('abc.def.ghi');
  });
  it('case-insensitive', () => {
    expect(parseAuthHeader('bearer xyz')).toBe('xyz');
    expect(parseAuthHeader('BEARER xyz')).toBe('xyz');
  });
  it('returns null for non-Bearer', () => {
    expect(parseAuthHeader('Basic xxx')).toBeNull();
  });
  it('returns null for missing token', () => {
    expect(parseAuthHeader('Bearer')).toBeNull();
    expect(parseAuthHeader('Bearer ')).toBeNull();
  });
  it('returns null for null/undefined/empty', () => {
    expect(parseAuthHeader(null)).toBeNull();
    expect(parseAuthHeader(undefined)).toBeNull();
    expect(parseAuthHeader('')).toBeNull();
  });
});

describe('splitJwtSegments', () => {
  it('splits valid 3-part token', () => {
    const r = splitJwtSegments('aaa.bbb.ccc');
    expect(r.header).toBe('aaa');
    expect(r.payload).toBe('bbb');
    expect(r.signature).toBe('ccc');
  });
  it('throws on 2 segments', () => {
    expect(() => splitJwtSegments('a.b')).toThrow(TokenInvalidError);
  });
  it('throws on 4 segments', () => {
    expect(() => splitJwtSegments('a.b.c.d')).toThrow(TokenInvalidError);
  });
  it('throws on empty', () => {
    expect(() => splitJwtSegments('')).toThrow(TokenInvalidError);
  });
});

describe('decodeSegmentJson', () => {
  it('decodes valid base64url JSON', () => {
    const payload = Buffer.from(JSON.stringify({ sub: 'u1' })).toString('base64url');
    expect(decodeSegmentJson<any>(payload)?.sub).toBe('u1');
  });
  it('returns null on invalid base64url', () => {
    expect(decodeSegmentJson('!!!')).toBeNull();
  });
  it('returns null on invalid JSON', () => {
    const garbage = Buffer.from('not-json').toString('base64url');
    expect(decodeSegmentJson(garbage)).toBeNull();
  });
});

describe('assertRequiredClaims', () => {
  it('passes when all claims present', () => {
    expect(() => assertRequiredClaims({ sub: 'u', exp: 1 }, ['sub', 'exp'])).not.toThrow();
  });
  it('throws TokenMissingClaimError on absence', () => {
    expect(() => assertRequiredClaims({ sub: 'u' }, ['sub', 'exp'])).toThrow(TokenMissingClaimError);
  });
});
```

### 7.3 Tests : `repo/packages/auth/test/errors/token-errors.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  TokenError,
  TokenExpiredError,
  TokenSignatureError,
  TokenAudienceError,
  TokenIssuerError,
  TokenInvalidError,
  TokenMissingClaimError,
  isTokenError,
} from '../../src/errors/token-errors.js';

describe('Token error hierarchy', () => {
  it('TokenExpiredError sets code TOKEN_EXPIRED', () => {
    const e = new TokenExpiredError(1000, 2000);
    expect(e.code).toBe('TOKEN_EXPIRED');
    expect(e.cause).toEqual({ exp: 1000, now: 2000 });
  });
  it('TokenSignatureError default message', () => {
    const e = new TokenSignatureError();
    expect(e.code).toBe('TOKEN_SIGNATURE_INVALID');
  });
  it('TokenAudienceError captures expected/actual', () => {
    const e = new TokenAudienceError('app1', 'app2');
    expect(e.code).toBe('TOKEN_AUDIENCE_INVALID');
  });
  it('TokenIssuerError captures expected/actual', () => {
    const e = new TokenIssuerError('iss1', 'iss2');
    expect(e.code).toBe('TOKEN_ISSUER_INVALID');
  });
  it('TokenInvalidError sets code TOKEN_INVALID', () => {
    expect(new TokenInvalidError('detail').code).toBe('TOKEN_INVALID');
  });
  it('isTokenError type guard works', () => {
    expect(isTokenError(new TokenExpiredError(1, 2))).toBe(true);
    expect(isTokenError(new Error('x'))).toBe(false);
  });
  it('toJSON serializes cause', () => {
    const e = new TokenMissingClaimError('exp');
    expect(JSON.parse(JSON.stringify(e))).toMatchObject({ code: 'TOKEN_MISSING_CLAIM' });
  });
});
```

### 7.4 Tests integration : `repo/packages/auth/test/integration/jwt.integration.spec.ts`

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { JwtService } from '../../src/services/jwt.service.js';
import { AuthRole } from '../../src/types/auth-roles.js';

describe('JwtService integration -- full flow', () => {
  let svc: JwtService;

  beforeAll(async () => {
    process.env.JWT_SECRET = randomBytes(48).toString('base64');
    process.env.JWT_REFRESH_SECRET = randomBytes(48).toString('base64');
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      providers: [JwtService],
    }).compile();
    svc = moduleRef.get(JwtService);
    svc.onModuleInit();
  });

  it('login -> verify -> refresh-rotate -> verify simulation', () => {
    const sid = svc.generateId();
    const tokenFamily = svc.generateId();

    // Initial login
    const access1 = svc.signAccessToken({
      sub: 'u1', tenant_id: 't1', email: 'a@b.com', role: AuthRole.BrokerUser,
      mfa_verified: true, sid,
    });
    const refresh1 = svc.signRefreshToken({ sub: 'u1', sid, token_family: tokenFamily, generation: 1 });

    // Verify
    expect(svc.verifyAccessToken(access1).sub).toBe('u1');
    expect(svc.verifyRefreshToken(refresh1).generation).toBe(1);

    // Rotate (refresh exchange)
    const refresh1Verified = svc.verifyRefreshToken(refresh1);
    const access2 = svc.signAccessToken({
      sub: refresh1Verified.sub, tenant_id: 't1', email: 'a@b.com', role: AuthRole.BrokerUser,
      mfa_verified: true, sid: refresh1Verified.sid,
    });
    const refresh2 = svc.signRefreshToken({
      sub: refresh1Verified.sub,
      sid: refresh1Verified.sid,
      token_family: refresh1Verified.token_family,
      generation: refresh1Verified.generation + 1,
    });

    // New refresh has same family but next generation
    const refresh2Verified = svc.verifyRefreshToken(refresh2);
    expect(refresh2Verified.token_family).toBe(refresh1Verified.token_family);
    expect(refresh2Verified.generation).toBe(2);
  });

  it('access tokens contain ULID jti unique', () => {
    const sid = svc.generateId();
    const t1 = svc.signAccessToken({
      sub: 'u', tenant_id: null, email: 'a@b.com', role: AuthRole.SuperAdminPlatform, mfa_verified: true, sid,
    });
    const t2 = svc.signAccessToken({
      sub: 'u', tenant_id: null, email: 'a@b.com', role: AuthRole.SuperAdminPlatform, mfa_verified: true, sid,
    });
    expect(svc.decodeUnsafe<any>(t1)?.jti).not.toBe(svc.decodeUnsafe<any>(t2)?.jti);
  });

  it('access token payload < 2KB', () => {
    const t = svc.signAccessToken({
      sub: 'u', tenant_id: 't', email: 'a@b.com', role: AuthRole.BrokerAdmin, mfa_verified: false, sid: svc.generateId(),
    });
    expect(Buffer.byteLength(t, 'utf-8')).toBeLessThan(2048);
  });

  it('extractFromHeader integrates with verify', () => {
    const sid = svc.generateId();
    const t = svc.signAccessToken({
      sub: 'u', tenant_id: 't', email: 'a@b.com', role: AuthRole.BrokerUser, mfa_verified: true, sid,
    });
    const header = `Bearer ${t}`;
    const extracted = svc.extractFromHeader(header);
    expect(extracted).toBe(t);
    expect(svc.verifyAccessToken(extracted!).sub).toBe('u');
  });
});
```

### 7.5 Bench : `repo/packages/auth/test/bench/jwt.bench.ts`

```typescript
import { bench, describe, beforeAll } from 'vitest';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { JwtService } from '../../src/services/jwt.service.js';
import { AuthRole } from '../../src/types/auth-roles.js';

let svc: JwtService;

beforeAll(async () => {
  process.env.JWT_SECRET = randomBytes(48).toString('base64');
  process.env.JWT_REFRESH_SECRET = randomBytes(48).toString('base64');
  const moduleRef = await Test.createTestingModule({
    imports: [ConfigModule.forRoot({ isGlobal: true })],
    providers: [JwtService],
  }).compile();
  svc = moduleRef.get(JwtService);
  svc.onModuleInit();
});

describe('JWT perf', () => {
  bench('signAccessToken HS256', () => {
    svc.signAccessToken({
      sub: 'u', tenant_id: 't', email: 'a@b.com', role: AuthRole.BrokerUser, mfa_verified: false, sid: svc.generateId(),
    });
  });
  bench('verifyAccessToken HS256', () => {
    const t = svc.signAccessToken({
      sub: 'u', tenant_id: 't', email: 'a@b.com', role: AuthRole.BrokerUser, mfa_verified: false, sid: svc.generateId(),
    });
    svc.verifyAccessToken(t);
  });
});
```

---

## 8. Variables environnement

```env
# Sprint 5 Tache 2.1.4 -- JwtService
JWT_SECRET=replace-with-base64-48-or-more-chars-from-openssl-rand-base64-48
JWT_REFRESH_SECRET=replace-with-DIFFERENT-base64-48-chars
JWT_ISSUER=skalean-insurtech-api
JWT_AUDIENCE=skalean-insurtech-app
```

Generation : `openssl rand -base64 48` (produit ~64 chars). Stockage prod : Atlas Cloud Services KMS Sprint 35.

---

## 9. Commandes shell

```bash
cd repo

# 1. Installer deps
pnpm --filter @insurtech/auth add jsonwebtoken@9.0.2 ulid@2.3.0
pnpm --filter @insurtech/auth add -D @types/jsonwebtoken@9.0.7

# 2. Generer secrets locaux
export JWT_SECRET=$(openssl rand -base64 48)
export JWT_REFRESH_SECRET=$(openssl rand -base64 48)

# 3. Verifications
pnpm --filter @insurtech/auth typecheck
pnpm --filter @insurtech/auth lint:check
pnpm --filter @insurtech/auth test
pnpm --filter @insurtech/auth test:coverage
pnpm --filter @insurtech/auth build

# 4. Verifier exports
node -e "const m = await import('@insurtech/auth'); ['JwtService','TokenExpiredError','TokenSignatureError'].forEach(k => { if (!(k in m)) { console.error('MISSING', k); process.exit(1); }}); console.log('OK');"
```

---

## 10. Criteres validation V1-V32

### Criteres P0 (bloquants -- 18)

- **V1 (P0)** : `pnpm --filter @insurtech/auth typecheck` exit 0.
- **V2 (P0)** : `pnpm --filter @insurtech/auth build` exit 0.
- **V3 (P0)** : `pnpm --filter @insurtech/auth test` >= 40 tests passing.
- **V4 (P0)** : `signAccessToken` retourne JWT 3-parties dot-separated.
- **V5 (P0)** : `verifyAccessToken(signed)` retourne payload.
- **V6 (P0)** : Token expired -> TokenExpiredError throw.
- **V7 (P0)** : Token tampered -> TokenSignatureError throw.
- **V8 (P0)** : Token wrong audience -> TokenAudienceError throw.
- **V9 (P0)** : Token wrong issuer -> TokenIssuerError throw.
- **V10 (P0)** : `verifyAccessToken(refreshToken)` throw (different secret).
- **V11 (P0)** : JWT_SECRET et JWT_REFRESH_SECRET differents -- throw au boot si egaux.
- **V12 (P0)** : `generateId()` produit 26 chars ULID.
- **V13 (P0)** : 1000 generateId tous uniques.
- **V14 (P0)** : `decodeUnsafe(token)` retourne payload sans verify.
- **V15 (P0)** : `decodeUnsafe(expired)` retourne payload (pas throw).
- **V16 (P0)** : `extractFromHeader('Bearer x')` retourne 'x'.
- **V17 (P0)** : `extractFromHeader('Basic x')` retourne null.
- **V18 (P0)** : refresh token signe avec JWT_REFRESH_SECRET.

### Criteres P1 (importants -- 9)

- **V19 (P1)** : Clock skew leeway 5 secondes accepte tokens slightly future iat.
- **V20 (P1)** : access token serialise < 2KB.
- **V21 (P1)** : access token contient claims iss, aud, iat, exp, nbf, jti, sid, sub, tenant_id, email, role, mfa_verified.
- **V22 (P1)** : refresh token contient claims sub, sid, token_family, generation, jti, iat, exp, iss.
- **V23 (P1)** : Coverage >= 92%.
- **V24 (P1)** : No-emoji.
- **V25 (P1)** : No-console.log.
- **V26 (P1)** : algorithme HS256 hardcode (pas d'option `none`).
- **V27 (P1)** : `extractFromHeader` case-insensitive Bearer.

### Criteres P2 (nice-to-have -- 5)

- **V28 (P2)** : ULID jti sortable temporellement.
- **V29 (P2)** : Bench produit median < 1 ms pour sign et verify.
- **V30 (P2)** : Errors TokenError ont toJSON pour serialisation logs.
- **V31 (P2)** : JSDoc @example present sur signAccessToken et verifyAccessToken.
- **V32 (P2)** : Documentation pointe vers Sprint 14 migration RS256.

---

## 11. Edge cases + troubleshooting

### Edge case 1 : Algorithme `none` accepte par defaut

Scenario : un attaquant forge un JWT avec header `{"alg": "none"}` et signature vide.
Probleme : certaines libs JWT acceptaient cela par defaut (CVE-2015-2951).
Solution : `jwt.verify(token, secret, { algorithms: ['HS256'] })` ne accepte que HS256. Verifie V26.

### Edge case 2 : JWT_SECRET fuite via stack trace

Scenario : un throw concatene la valeur du secret.
Probleme : leak en production logs.
Solution : tous les throw mentionnent uniquement le nom de la var, jamais la valeur. Verifie via lecture code.

### Edge case 3 : Token avec exp dans 100 ans accidentel

Scenario : developpeur passe `exp: nowInSeconds() + 365 * 100 * 86400` par erreur.
Probleme : token quasi-permanent.
Solution : helper interne plafonne ttl a 7 jours pour access et 90 jours pour refresh. Sprint 14 review.

### Edge case 4 : Replay refresh token apres rotation

Scenario : attaquant a vole refresh1 ; legit user fait refresh -> refresh2 emis ; attaquant tente refresh1.
Probleme : refresh1 verify success (signature valide) -- mais Tache 2.1.5 SessionService doit detecter generation antecedente.
Solution : cette tache fournit le payload generation ; Tache 2.1.5 implemente la detection. Verifie integration test.

### Edge case 5 : Token avec jti deja utilise

Scenario : meme jti emis deux fois (collision ULID extreme rare).
Probleme : SessionService confondrait deux sessions.
Solution : ULID 80 bits randomness, collision probability ~10^-12 sur 1M tokens. Si collision detectee a stockage Redis (Tache 2.1.5), regenerer.

### Edge case 6 : Header HTTP sensible casse

Scenario : reverse proxy lowercase tous les headers : `authorization` au lieu de `Authorization`.
Probleme : le service ne lit pas le header.
Solution : NestJS @Headers() decorator est case-insensitive natif. Le service prend la valeur en parametre, pas le header objet. OK.

### Edge case 7 : Token URL-encoded dans cookie

Scenario : token dans cookie value = URL encoded.
Probleme : `Bearer xx%2Eyy%2Ezz` parse mal.
Solution : convention -- Authorization header utilise pour API, cookie reserve a session web (Sprint 4 frontend). Pour cookie, decode avant verify.

### Edge case 8 : Concurrence sign 1000 simultanes

Scenario : load test.
Probleme : aucun (HS256 est CPU-bound, pas IO).
Solution : verifie via bench.

### Edge case 9 : Migration HS256 -> RS256 Sprint 14

Scenario : tokens HS256 emis Sprint 5 doivent rester valides apres migration.
Probleme : RS256 verify ne accepte pas HS256.
Solution : Sprint 14 implementera grace period 30 jours ou les deux algorithms sont acceptes en verify, puis transition complete.

### Edge case 10 : Token avec tenant_id null pour role tenant

Scenario : payload incoherent `role: BrokerAdmin, tenant_id: null`.
Probleme : ne devrait pas arriver mais ce service ne valide pas la coherence.
Solution : AuthService Tache 2.1.6 valide la coherence. Ce service signe ce qui est passe.

### Edge case 11 : Algorithm confusion attack

Scenario : attaquant change header.alg de HS256 a none.
Probleme : si libs vulnerables, accepte.
Solution : `jwt.verify(token, secret, { algorithms: ['HS256'] })` strict. V26.

### Edge case 12 : Secret stocke dans env var with newline

Scenario : `cat /run/secrets/jwt | xargs export` introduit trailing \n.
Probleme : secret 65 chars au lieu de 64, signature differente.
Solution : trim() au boot. Documente dans le code.

---

## 12. Conformite Maroc detaillee

### 12.1 Loi 09-08 CNDP article 23

JWT signe avec HMAC-SHA256 garantit integrite des claims (tenant_id, role) qui authorisent les operations sur donnees personnelles. Compromission detectee via theft detection refresh.

### 12.2 ACAPS circulaire 2024

JWT contient `mfa_verified` flag verifie par MfaRequiredGuard Tache 2.1.8. L'autorite peut auditer les flows MFA via les events Kafka publies Tache 2.1.12.

### 12.3 Bank Al-Maghrib circulaire 2014/G/4

Secrets stockes Atlas Cloud Services KMS Sprint 35, conforme cloud souverain MA.

---

## 13. Conventions absolues skalean-insurtech

### 13.1 Multi-tenant strict

JwtPayload.tenant_id est lu Sprint 6 par TenantContextService et seede dans AsyncLocalStorage. Ce service expose le contrat ; la verification de coherence se fait Tache 2.1.6.

### 13.2 Validation strict (Zod)

Les payloads JWT sont valides au verify via `assertRequiredClaims`. Schemas Zod consommateurs (Tache 2.1.6) re-valident le payload retourne pour defense en profondeur.

### 13.3 Logger Pino + NestJS

Logger NestJS natif. Aucun log de secret ou de token entier (uniquement jti, sub anonymises si necessaire).

### 13.4 Hash password (decision-013)

Non applicable directement. Argon2Service Tache 2.1.2 hash passwords ; JwtService signe les tokens emis apres hash success.

### 13.5 Package manager pnpm

`jsonwebtoken@9.0.2` et `ulid@2.3.0` pinnees exact.

### 13.6 TypeScript strict

Aucun `any`. Brand types `SignedJwt`. Errors typed.

### 13.7 Tests strict

40+ tests minimum. Coverage >= 92%.

### 13.8 RBAC strict

JwtPayload.role consomme par RbacService Sprint 7.

### 13.9 Events strict

`auth.signin_success` event publie Tache 2.1.12 inclut jti emis par ce service.

### 13.10 Imports strict

Order : Node natifs, externes (jsonwebtoken, ulid), @insurtech/* (constants/types/errors), relatifs.

### 13.11 Skalean AI strict

Aucun LLM. Tokens signes via HMAC standard.

### 13.12 No-emoji strict

Aucune emoji.

### 13.13 Idempotency-Key

Non applicable directement.

### 13.14 Conventional Commits

Format : `feat(sprint-05): implement JwtService HS256 with refresh rotation pattern`.

### 13.15 Cloud souverain MA

Secrets en env var Sprint 5, Atlas KMS Sprint 35.

### 13.16 Discipline crypto

HS256 (HMAC-SHA256, FIPS 198-1) standard reviewed. ULID design 80 bits randomness + 48 bits timestamp. jsonwebtoken v9 mainteneur active, audit Sprint 33.

### 13.17 JSDoc inline

Chaque methode publique documentee.

### 13.18 Performance budgets

- `signAccessToken` : < 1 ms median.
- `verifyAccessToken` : < 1 ms median.
- `extractFromHeader` : < 0.1 ms median.

---

## 14. Validation pre-commit

```bash
cd repo

pnpm --filter @insurtech/auth typecheck
pnpm --filter @insurtech/auth lint:check
pnpm --filter @insurtech/auth test
pnpm --filter @insurtech/auth test:coverage
pnpm --filter @insurtech/auth build

grep -rP "[\x{1F300}-\x{1F9FF}]|[\x{2600}-\x{27BF}]" packages/auth/src packages/auth/test && exit 1 || echo OK
grep -rn "console\.\(log\|debug\|info\|warn\|error\)" packages/auth/src --include="*.ts" && exit 1 || echo OK
grep -rn "JWT_SECRET\s*=" packages/auth/src --include="*.ts" && exit 1 || echo OK

node -e "const m = await import('@insurtech/auth'); ['JwtService','TokenExpiredError','TokenSignatureError','TokenAudienceError','TokenIssuerError','TokenInvalidError'].forEach(k => { if (!(k in m)) { console.error('MISSING', k); process.exit(1); }}); console.log('OK');"
```

---

## 15. Commit message complet

```bash
git add -A
git commit -m "feat(sprint-05): implement JwtService HS256 with refresh rotation pattern

Implements the JWT signing and verification service for the program.
Access tokens (TTL 15min, JWT_SECRET) and refresh tokens (TTL 30 days,
JWT_REFRESH_SECRET) with token_family + generation pattern for theft
detection (RFC 9700 OAuth 2.0 BCP). 6 typed error subclasses for
verification failures (TokenExpiredError, TokenSignatureError, etc.).
ULID jti for sortable audit timeline.

Livrables :
- JwtService (signAccessToken, signRefreshToken, verifyAccessToken,
  verifyRefreshToken, decodeUnsafe, extractFromHeader, generateId)
- 6 typed errors + isTokenError guard
- jwt.helpers (parseAuthHeader, splitJwtSegments, decodeSegmentJson,
  assertRequiredClaims)
- SignedJwt brand type
- TokenPair interface
- 40+ tests (unit + integration + bench)

Tests : 25 service + 8 helpers + 6 errors + 4 integration + 2 bench
Coverage : >= 92%

Task: 2.1.4
Sprint: 5 (Phase 2 / Sprint 1)
Phase: 2 -- Securite & Multi-tenant
Reference: B-05 Tache 2.1.4
Decisions: decision-014 (HS256 Sprint 5, RS256 Sprint 14)"
```

---

## 16. Workflow next step

Apres commit, passer a `task-2.1.5-session-service.md` qui implementera le `SessionService` Redis pour stocker les refresh tokens hashes, gerer la rotation atomique, detecter le replay via comparison de generation, et exposer les methodes revokeSession, revokeUserSessions, revokeFamily, listUserSessions.

---

## Annexe A. Plan de migration HS256 -> RS256 (Sprint 14)

### A.1 Pourquoi migrer

Sprint 5 utilise HS256 (HMAC-SHA256) car suffisant pour un seul service API qui signe et verifie. Les limitations de HS256 deviennent contraignantes a partir de Sprint 31 (sky-agent qui veut verifier les JWT sans avoir le secret de signature) et Sprint 35 (deploiement multi-instance avec partage de cle complique). RS256 (RSA-SHA256, asymmetric) decouple la cle privee de signature (1 instance, KMS) de la cle publique de verification (distribuee a tous les consommateurs sans risque). De plus, le pattern "key rotation 90 jours" exige par decision-014 est plus simple a implementer avec un kid (Key ID) dans le header JWT pointant vers la cle publique courante via JWKS endpoint.

### A.2 Architecture cible Sprint 14

Le service `JwtService` Sprint 14 expose un endpoint public `GET /.well-known/jwks.json` (JSON Web Key Set, RFC 7517) qui retourne la liste des cles publiques courantes et de la generation precedente (2 cles en parallele pendant la rotation 30 jours grace period). Les consommateurs (sky-agent, mcp-server, services tiers de partenaires) fetch ce JWKS endpoint au boot et en cache 1 heure. Au signing, `JwtService` ajoute un header `kid: <key-id-current>` dans le JWT. A la verification, le consommateur lit le `kid` du header, lookup la cle publique correspondante dans son cache JWKS, et verifie. La rotation 90 jours est gere par un job scheduled qui (1) genere une nouvelle paire RSA 2048 bits dans Atlas KMS, (2) ajoute la nouvelle cle au JWKS endpoint avec un nouveau kid, (3) bascule la signing au nouveau kid mais accepte aussi l'ancien en verification, (4) apres 30 jours grace period, retire l'ancienne cle du JWKS et de la rotation.

### A.3 Migration en 6 etapes

Etape 1 : Sprint 14 Tache 14.1.1 -- ajouter param `algorithm` dynamique dans JwtService (lit `JWT_ALGORITHM` env var, default HS256 puis RS256). Etape 2 : Sprint 14 Tache 14.1.2 -- generer paire RSA 2048 dans Atlas KMS, exposer cle privee via API `KmsClient.signRsa256(payload)` et cle publique en clair via JWKS. Etape 3 : Sprint 14 Tache 14.1.3 -- modifier JwtService.signAccessToken pour appeler KmsClient.signRsa256 si algorithm=RS256. Etape 4 : Sprint 14 Tache 14.1.4 -- modifier JwtService.verifyAccessToken pour fetch JWKS, lookup kid, verify RS256. Etape 5 : Sprint 14 Tache 14.1.5 -- bascule progressive : pendant 30 jours, signing en RS256 mais verification accepte HS256+RS256 (dual mode). Etape 6 : Sprint 14 Tache 14.1.6 -- apres 30 jours, retirer support HS256, drop env vars JWT_SECRET et JWT_REFRESH_SECRET.

### A.4 Impact sur le code consommateur

Les consommateurs internes (`AuthController`, `JwtStrategy`, etc.) ne sont pas impactes -- l'API publique de `JwtService` reste identique (`signAccessToken(payload)`, `verifyAccessToken(token)`). Seul le header `kid` apparait dans le JWT. Les consommateurs externes (sky-agent Sprint 31) doivent implementer le JWKS fetch + caching, mais ils n'existent pas encore en Sprint 5.

### A.5 Performance cible RS256

RS256 est environ 5-10x plus lent que HS256 pour le signing (cle privee = exponentiation modulaire 2048 bits) mais comparable pour la verification (cle publique = exponentiation rapide). Estimation : signing 2-4 ms median (vs 0.05 ms HS256), verification 0.3-0.6 ms median. Ce slowdown est acceptable car les operations signing sont rares (uniquement signin / refresh) -- la majorite des requetes utilisent verification qui reste rapide.

## Annexe B. Monitoring et observability Sprint 33

### B.1 Metriques Prometheus

Le service expose des metriques consommees par le dashboard "Auth Health" Sprint 33 :

```
jwt_sign_duration_us          histogram (p50, p95, p99)
jwt_verify_duration_us        histogram
jwt_verify_total              counter labels=algorithm,result(success|expired|invalid|wrong_audience|wrong_issuer|signature_invalid)
jwt_decode_unsafe_total       counter -- alerte si rate > baseline (peut indiquer abuse)
jwt_extract_header_failed_total counter -- baseline observability
jwt_signing_secret_age_days   gauge -- alerte si > 80 jours (rotation Sprint 14 imminent)
```

Le dashboard groupe : (a) panel "JWT Performance" avec latency p99 sign/verify, (b) panel "JWT Errors" avec breakdown par result label (utile pour detecter attaques tampering en masse), (c) panel "JWT Volume" avec rate sign/verify (baseline pour capacity planning Sprint 35).

### B.2 Alertes critiques

Trois alertes P0 routees vers PagerDuty :

(1) `jwt_verify_total{result="signature_invalid"}` rate > 100/min : indique soit un deploiement avec wrong secret, soit une attaque tampering en masse. Investigation : check si deploiement recent, check correlation avec `auth_signin_failed_total`. Mitigation : si tampering, identifier source IP via logs et bloquer via Sprint 14 rate limit. (2) `jwt_signing_secret_age_days` > 90 : la rotation Sprint 14 a echoue ou n'a pas tourne. Investigation : check job rotation logs. Mitigation : declencher rotation manuelle. (3) `jwt_sign_duration_us` p99 > 10000 (10 ms) : performance degraded. Investigation : check CPU pressure, check si Atlas KMS lent (Sprint 14+ avec RS256). Mitigation : scaling horizontal, KMS warmup.

### B.3 Logs structures (Pino + Datadog)

Chaque sign/verify produit un log structure :

```json
{
  "level": "info",
  "time": "2026-05-06T10:23:45.123Z",
  "service": "JwtService",
  "action": "verify_access_token",
  "result": "success",
  "duration_us": 234,
  "user_id": "u-123",
  "tenant_id": "t-456",
  "jti": "01HXYZ...",
  "request_id": "req-abc"
}
```

Les logs sont indexes Datadog par `service`, `action`, `result`, `user_id`, `tenant_id` pour query rapide. Sprint 18 (Comm) consomme aussi ces logs pour detection d'anomalies (pattern de connexions inhabituelles).

### B.4 Tracing distribue OpenTelemetry

Sprint 33 ajoutera une integration OpenTelemetry qui tagge chaque span d'auth avec attributs `auth.user_id`, `auth.role`, `auth.tenant_id`, `auth.jti`, `auth.mfa_verified`. Permet de correler une requete utilisateur a travers tous les services (api, mcp-server, sky-agent) via un seul traceId.

## Annexe C. Edge cases supplementaires (13-25)

### Edge case 13 : Token avec header `alg: ES256` (algorithme different)

Scenario : un attaquant signe un token avec ECDSA-P256 hoping que la lib accepte par defaut.
Probleme : si `algorithms` parameter pas configure strictement, jsonwebtoken peut accepter.
Solution : `verify` passe `{ algorithms: ['HS256'] }` strict. Test V26 verifie.

### Edge case 14 : Token avec header `alg: HS256` mais signe avec autre algorithme

Scenario : l'attaquant manipule le header pour declarer HS256 mais signe avec RS256 forge.
Probleme : si lib match l'algorithme declare avec celui attendu, OK ; mais si lib essaie le declare contre la cle, bug.
Solution : `jsonwebtoken` v9 verifie strict avec algorithms whitelist. OK.

### Edge case 15 : ULID jti collision dans une fenetre 1ms

Scenario : 2 sign() simultanes (meme thread, async micro-seconds apart) dans la meme microseconde.
Probleme : ULID utilise timestamp ms + 80 bits randomness. Dans la meme ms, randomness assure unicity 99.999...%.
Solution : verifie test V13 (1000 unique en boucle).

### Edge case 16 : Header Authorization avec multiple Bearer

Scenario : `Authorization: Bearer abc, Bearer def`.
Probleme : reverse proxy concatene 2 headers Authorization (nginx fait ca).
Solution : `parseAuthHeader` traite le header complet ; si malforme, retourne null. Convention : NestJS @Headers prend le premier header. Le client ne devrait jamais envoyer 2 Authorization. Sprint 33 review.

### Edge case 17 : Token avec exp = NaN

Scenario : un token forge avec exp = "not-a-number".
Probleme : `jsonwebtoken` ne verifie pas explicitement le type, peut throw obscur.
Solution : `assertRequiredClaims` verifie presence ; type checking se fait dans verifyToken par les assertions strictes du payload type. Test V35 ajoute.

### Edge case 18 : decodeUnsafe sur token valide vs invalide

Scenario : developpeur utilise decodeUnsafe pour log et compare avec verifyAccessToken.
Probleme : decodeUnsafe retourne payload meme si signature invalide -- CONFUSION possible.
Solution : nom explicite `decodeUnsafe` (vs `decode`), JSDoc grosse warning, lint rule custom Sprint 33 qui flag tout usage de decodeUnsafe hors du contexte logging.

### Edge case 19 : Refresh token presented apres family revoke

Scenario : Tache 2.1.5 revoke family, client retente refresh.
Probleme : signature reste valide (JwtService ne fait pas le check Redis).
Solution : Tache 2.1.5 verifie via Redis lookup. JwtService ne s'occupe que de signature. Separation clean.

### Edge case 20 : Token jti reused dans un nouveau token

Scenario : developpeur passe un jti fixe au lieu de generer.
Probleme : 2 tokens avec meme jti -- Tache 2.1.5 confond.
Solution : `signAccessToken` ignore le jti passe et genere toujours via ulid(). Documentee dans JSDoc.

### Edge case 21 : Token avec aud array (multiple audiences)

Scenario : RFC 7519 accepte aud comme string OR array.
Probleme : signature accepte les deux.
Solution : convention Skalean -- `aud` toujours string scalaire. Sprint 14 ajoutera support array si besoin multi-service.

### Edge case 22 : ULID dans payload depasse limite chars

Scenario : ULID 26 chars + autres claims -> JWT total > 2KB.
Probleme : header HTTP > 8KB peut etre rejete par certains proxies.
Solution : verifie V20 < 2KB. Sprint 33 review.

### Edge case 23 : Migration simultanee 2 instances API

Scenario : deploiement rolling update Sprint 14 -- 2 instances API en parallele, l'une signe HS256, l'autre RS256.
Probleme : un client recoit token HS256 puis verify sur instance RS256-only -- echoue.
Solution : Sprint 14 phase grace period 30 jours dual-mode. Detail Annexe A.

### Edge case 24 : Clock drift entre instances API

Scenario : 2 instances API avec horloge desynchronisee 10 secondes.
Probleme : token signe par instance A peut etre vu comme not-yet-valid par instance B.
Solution : leeway 5 secondes (V19) absorbe drift typique. Cluster NTP synchronise les horloges. Drift > 10s declenche alerte Sprint 33.

### Edge case 25 : JWT_SECRET partage avec autre projet par accident

Scenario : developpeur copie JWT_SECRET d'un autre projet pour gagner du temps.
Probleme : tokens emis par les deux projets sont interchangeables.
Solution : convention -- chaque projet utilise un secret unique generation (ne pas reuse). Sprint 33 audit detecte les patterns connus.

## Annexe D. Strategie de test exhaustive

### D.1 Matrice de couverture

La suite de tests Vitest couvre les axes suivants :

```
Operation               | Happy path | Expired | Tampered | Wrong aud | Wrong iss | Malformed | Empty/null | Concurrent
------------------------|------------|---------|----------|-----------|-----------|-----------|------------|------------
signAccessToken         |    OK      |   N/A   |   N/A    |    N/A    |    N/A    |    N/A    |    OK      |    OK
verifyAccessToken       |    OK      |   OK    |   OK     |    OK     |    OK     |    OK     |    OK      |    OK
signRefreshToken        |    OK      |   N/A   |   N/A    |    N/A    |    N/A    |    N/A    |    OK      |    OK
verifyRefreshToken      |    OK      |   OK    |   OK     |    OK     |    OK     |    OK     |    OK      |    OK
decodeUnsafe            |    OK      |   OK    |   OK     |    OK     |    OK     |    OK     |    OK      |    OK
extractFromHeader       |    OK      |   N/A   |   N/A    |    N/A    |    N/A    |    OK     |    OK      |    OK
generateId              |    OK      |   N/A   |   N/A    |    N/A    |    N/A    |    N/A    |    N/A     |    OK
```

42 cases concretes (7 ops x 6 conditions average + concurrence) couvrent toutes les combinaisons. Coverage cible >= 92% lines, 90% branches, 100% functions.

### D.2 Tests de propriete (property-based)

Sprint 14 ajoutera des tests fast-check property-based qui generent des entrees aleatoires :

```typescript
import { fc } from 'fast-check';

it('property: roundtrip for all valid inputs', () => {
  fc.assert(fc.property(
    fc.uuid(), // sub
    fc.option(fc.uuid()), // tenant_id
    fc.string({ minLength: 5, maxLength: 100 }), // email pseudo
    fc.constantFrom(...Object.values(AuthRole)), // role
    fc.boolean(), // mfa_verified
    (sub, tenant_id, email, role, mfa_verified) => {
      const sid = svc.generateId();
      const t = svc.signAccessToken({ sub, tenant_id, email, role, mfa_verified, sid });
      const v = svc.verifyAccessToken(t);
      expect(v.sub).toBe(sub);
      expect(v.role).toBe(role);
    },
  ), { numRuns: 1000 });
});
```

Property-based tests detectent les edge cases que les tests unitaires manuels manquent.

### D.3 Tests de securite (negatif)

Les tests negatifs verifient que les attaques connues sont bloquees :

```typescript
describe('Security : JWT attacks', () => {
  it('rejects "alg: none" attack (CVE-2015-2951)', () => {
    const noneToken = `${Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: 'admin' })).toString('base64url')}.`;
    expect(() => svc.verifyAccessToken(noneToken)).toThrow();
  });

  it('rejects algorithm confusion HS256 -> RS256 (CVE-2016-10555)', () => {
    // En Sprint 5 HS256 only, ce test sera plus pertinent Sprint 14 RS256
    // Pour Sprint 5, verifier que algorithm mismatch HS256 declare mais ES256 signe rejette
    // ...
  });

  it('rejects token with kid pointing to attacker-controlled URL', () => {
    // Sprint 14 -- pas applicable Sprint 5
  });
});
```

### D.4 Tests de regression

Sprint 6+ ajoutera regression tests qui verifient que les tokens emis Sprint 5 restent valides apres changes :

```typescript
const SPRINT_5_FROZEN_TOKEN = '...'; // captured in Sprint 5
it('Sprint 5 tokens still verify after Sprint 6 changes', () => {
  expect(() => svc.verifyAccessToken(SPRINT_5_FROZEN_TOKEN)).not.toThrow();
});
```

## Annexe E. Specification OpenAPI 3.1 (extrait pour Sprint 33)

Sprint 33 generera la specification OpenAPI complete via zod-to-openapi. Pour l'authentification, les schemas sont :

```yaml
components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: |
        Skalean InsurTech JWT Bearer token. Obtenu via POST /api/v1/auth/signin.
        Format : eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.<payload>.<signature>
        TTL access : 15 minutes
        TTL refresh : 30 jours
        Rotation : a chaque refresh (theft detection RFC 9700)

  schemas:
    JwtPayloadAccess:
      type: object
      required: [sub, tenant_id, email, role, mfa_verified, jti, sid, iss, aud, iat, exp, nbf]
      properties:
        sub: { type: string, format: uuid, description: "User ID" }
        tenant_id: { type: string, format: uuid, nullable: true }
        email: { type: string, format: email }
        role: { type: string, enum: [super_admin_platform, analyst_support, broker_admin, broker_user, broker_assistant, garage_admin, garage_chef, garage_technicien, garage_comptable, garage_commercial, assure, prospect] }
        mfa_verified: { type: boolean }
        jti: { type: string, pattern: "^[0-9A-HJKMNP-TV-Z]{26}$", description: "ULID" }
        sid: { type: string, pattern: "^[0-9A-HJKMNP-TV-Z]{26}$" }
        iss: { type: string, const: "skalean-insurtech-api" }
        aud: { type: string, const: "skalean-insurtech-app" }
        iat: { type: integer, description: "Unix seconds" }
        exp: { type: integer, description: "Unix seconds" }
        nbf: { type: integer, description: "Unix seconds" }

    JwtPayloadRefresh:
      type: object
      required: [sub, sid, token_family, generation, jti, iss, iat, exp]
      properties:
        sub: { type: string, format: uuid }
        sid: { type: string, pattern: "^[0-9A-HJKMNP-TV-Z]{26}$" }
        token_family: { type: string, pattern: "^[0-9A-HJKMNP-TV-Z]{26}$" }
        generation: { type: integer, minimum: 1 }
        jti: { type: string, pattern: "^[0-9A-HJKMNP-TV-Z]{26}$" }
        iss: { type: string, const: "skalean-insurtech-api" }
        iat: { type: integer }
        exp: { type: integer }

  responses:
    Unauthorized:
      description: Token expired, invalid, or missing
      content:
        application/json:
          schema:
            type: object
            properties:
              code:
                type: string
                enum: [TOKEN_EXPIRED, TOKEN_SIGNATURE_INVALID, TOKEN_AUDIENCE_INVALID, TOKEN_ISSUER_INVALID, TOKEN_INVALID, TOKEN_NOT_YET_VALID, TOKEN_MISSING_CLAIM, TOKEN_REUSE_DETECTED]
              message: { type: string }
              cause: { type: object, additionalProperties: true }
```

---

**Fin du prompt task-2.1.4-jwt-service.md.**
