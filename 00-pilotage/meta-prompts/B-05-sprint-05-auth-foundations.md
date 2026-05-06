# META-PROMPT B-05 -- SPRINT 5 AUTH FOUNDATIONS

**Version** : v2.2 (Option B)
**Phase** : 2 -- Securite & Multi-tenant
**Sprint** : 5 / 35 (cumul) -- PREMIER de la Phase 2
**Position** : Apres Frontend Bootstrap, debut Phase 2 Securite
**Numerotation taches** : 2.1.1 a 2.1.15
**Effort total** : ~80 heures developpement / 2 semaines
**Priorite** : P0 (bloquant pour tous les sprints metier consommant utilisateur authentifie)

---

## Objectif Global du Sprint

Implementer le **systeme d'authentification complet** : hash mots de passe Argon2id, JWT (access + refresh tokens), MFA TOTP RFC 6238, sessions Redis, signup avec email verification, lockout anti brute force, account recovery, et audit log de toutes les operations auth.

A la sortie de ce sprint :
- Endpoints `/api/v1/auth/{signup,signin,signout,refresh,me,verify-email,setup-mfa,verify-mfa,recover}` operationnels
- Argon2id durci (memory 64MB, time 3, parallelism 4)
- JWT signe HS256 (Sprint 5) avec structure `{ sub, tenant_id, role, mfa_verified, exp }`
- Refresh tokens stockes hashes SHA-256 dans Redis (DB 1 SESSIONS)
- MFA TOTP optionnel/required selon role (super_admin force MFA)
- 6 codes recovery generes a setup MFA
- Lockout : 5 echecs en 15min -> compte locke 30min
- Account recovery via email + secret question
- Tous events auth publies sur Kafka (`insurtech.events.auth.*`)
- Audit log automatique sur toutes operations sensibles
- Tests E2E couvrent 15+ scenarios auth

---

## Frontiere du Sprint

**INCLUS** :
- Package `@insurtech/auth` complet (services + guards + strategies + module NestJS)
- Hash Argon2id
- Crypto utilities (AES-GCM MFA secret, SHA-256 tokens)
- JWT signing + verification + rotation
- Session storage Redis avec revocation
- MFA TOTP setup + verify + recovery codes
- Signup + email verification flow
- Signin avec MFA challenge
- Refresh token flow avec rotation
- Account recovery
- Lockout anti brute force
- Email service (Nodemailer SMTP + templates Handlebars 3 locales)
- Rate limiting auth-specifique
- Tests E2E exhaustifs

**EXCLU** (sera ajoute aux sprints suivants) :
- Multi-tenant context resolution depuis JWT (Sprint 6)
- RBAC permissions (Sprint 7)
- OAuth2 social (Google/Apple) -- pas dans MVP, Phase 7+
- WebAuthn / Passkey -- Phase 7+
- SAML/SSO -- pas dans roadmap initial

---

## Lectures Prealables Obligatoires

1. `00-pilotage/documentation/8-skalean-insurtech-prompt-master.md` -- regles auth + 12 roles + conformite
2. `00-pilotage/documentation/2-variables-environnement.env` -- variables auth (JWT_SECRET, MFA_SECRET_ENCRYPTION_KEY, etc.)
3. `00-pilotage/documentation/4-templates-generation.md` -- pattern 1 service NestJS
4. Sortie Sprint 2 : tables `auth_users`, `auth_sessions`, `auth_tenant_users`, `audit_log`
5. Sortie Sprint 3 : `PublicEndpointGuard`, RequestContext (utilise pour user_id apres auth)

---

## Stack Imposee (Sprint 5)

| Composant | Version | Notes |
|-----------|---------|-------|
| @node-rs/argon2 | 2.0.2 | Argon2id native binding (Rust, ~10x faster vs argon2 npm) |
| jsonwebtoken | 9.0.2 | JWT signing (HS256 Sprint 5, RS256 plus tard) |
| @types/jsonwebtoken | 9.0.7 | types |
| otplib | 12.0.1 | TOTP RFC 6238 |
| qrcode | 1.5.4 | QR generation pour MFA setup |
| nodemailer | 6.9.16 | SMTP client |
| handlebars | 4.7.8 | templates emails |
| crypto-js | 4.2.0 | AES-GCM helpers (alternative : Node crypto natif suffit) |
| @nestjs/passport | 10.0.3 | Passport integration |
| passport | 0.7.0 | strategies |
| passport-jwt | 4.0.1 | JWT strategy |

---

## Vue d'Ensemble des 15 Taches

| # | Tache | Effort | Priorite | Depend de |
|---|-------|--------|----------|-----------|
| 2.1.1 | Init @insurtech/auth package -- types + schemas Zod + constants + module NestJS | 4h | P0 | Sprint 4 |
| 2.1.2 | Argon2id service -- hash + verify + password policies | 5h | P0 | 2.1.1 |
| 2.1.3 | Crypto services -- AES-GCM (MFA secret) + SHA-256 (refresh tokens) | 5h | P0 | 2.1.2 |
| 2.1.4 | JWT service -- sign + verify access/refresh + rotation | 6h | P0 | 2.1.3 |
| 2.1.5 | Session service -- Redis storage + lookup + revocation | 5h | P0 | 2.1.4 |
| 2.1.6 | AuthModule + AuthController + AuthService + JWT Strategy + JwtAuthGuard | 7h | P0 | 2.1.5 |
| 2.1.7 | MFA service -- TOTP RFC 6238 + QR + recovery codes | 6h | P0 | 2.1.6 |
| 2.1.8 | MFA Required Guard + endpoints (`/setup-mfa`, `/verify-mfa`) | 5h | P0 | 2.1.7 |
| 2.1.9 | Signup flow + email verification | 5h | P0 | 2.1.8 |
| 2.1.10 | Lockout service (anti brute force) | 4h | P0 | 2.1.9 |
| 2.1.11 | Account recovery service | 5h | P0 | 2.1.10 |
| 2.1.12 | Audit auth service (publish Kafka events + write audit_log) | 4h | P0 | 2.1.11 |
| 2.1.13 | Email service -- Nodemailer + Handlebars templates 3 locales | 6h | P0 | 2.1.12 |
| 2.1.14 | Rate limiting auth-specifique (5/min login, 3/h signup, 3/h reset) | 3h | P0 | 2.1.13 |
| 2.1.15 | Tests E2E auth complets (15+ scenarios) | 8h | P0 | 2.1.14 |

**Total** : 78 heures.

---

# DETAIL DES 15 TACHES

---

## Tache 2.1.1 -- Init @insurtech/auth Package

**Metadonnees** : Phase 2 / Sprint 5 / P0 / 4h / Depend de Sprint 4

**But** : Initialiser le package `@insurtech/auth` avec types TypeScript, schemas Zod, constants, et squelette module NestJS.

**Contexte** : Centraliser auth en package dedie reutilisable (l'API NestJS l'importe, mais aussi consumers Sprint 12+ qui peuvent valider tokens). Schemas Zod consumes par `shared-events` (events auth) et frontends (formulaires signup/signin).

**Livrables checkables** :
- [ ] Package `repo/packages/auth/` setup (extends Sprint 1 stub)
- [ ] `src/types/auth-context.ts` -- interfaces : `AuthContext` (user + tenant + permissions + mfa_verified), `AuthenticatedUser`, `JwtPayload`, `RefreshTokenPayload`
- [ ] `src/types/auth-roles.ts` -- enum `AuthRole` avec 12 roles documentes (super_admin_platform, analyst_support, broker_admin, broker_user, broker_assistant, garage_admin, garage_chef, garage_technicien, garage_comptable, garage_commercial, assure, prospect)
- [ ] `src/schemas/signup.schema.ts` -- Zod schema (email + password + display_name + locale)
- [ ] `src/schemas/signin.schema.ts` -- Zod (email + password + remember_me)
- [ ] `src/schemas/mfa.schema.ts` -- Zod (totp_code 6 digits + recovery_code optionnel)
- [ ] `src/schemas/refresh.schema.ts` -- Zod (refresh_token)
- [ ] `src/schemas/recovery.schema.ts` -- Zod (email + new_password + recovery_token)
- [ ] `src/constants/password-policy.ts` -- regles : min 12 chars, 1 maj + 1 min + 1 chiffre + 1 special, banlist top 1000 password leakes
- [ ] `src/constants/argon2-params.ts` -- params durcis : memoryCost 65536, timeCost 3, parallelism 4
- [ ] `src/constants/jwt-params.ts` -- algo HS256, ttl access 15min, ttl refresh 30 jours
- [ ] `src/constants/mfa-params.ts` -- TOTP digits 6, period 30s, algorithm SHA-1, recovery_codes_count 6
- [ ] `src/auth.module.ts` -- skeleton module NestJS Global
- [ ] `src/index.ts` reexports
- [ ] Tests unitaires schemas Zod (happy + error path)

**Pattern critique : structure JwtPayload**

```typescript
// repo/packages/auth/src/types/auth-context.ts
export interface JwtPayload {
  sub: string;              // user_id UUID
  tenant_id: string | null; // null si super_admin platform
  email: string;
  role: AuthRole;
  mfa_verified: boolean;    // true apres verify-mfa
  jti: string;              // JWT ID unique
  iat: number;              // issued at
  exp: number;              // expires
}

export interface RefreshTokenPayload {
  sub: string;              // user_id
  jti: string;              // session_id
  token_family: string;     // pour detection vol refresh token (Sprint 5 pattern Sliding Refresh Token)
}
```

**Fichiers crees / modifies** :
```
repo/packages/auth/package.json                              # enrichi (deps Sprint 5)
repo/packages/auth/tsconfig.json                              # standard
repo/packages/auth/src/types/auth-context.ts                  # ~50 lignes
repo/packages/auth/src/types/auth-roles.ts                    # ~30 lignes (12 roles enum)
repo/packages/auth/src/schemas/{5 schemas .ts}                # ~150 lignes total
repo/packages/auth/src/constants/{4 constants .ts}            # ~80 lignes total
repo/packages/auth/src/auth.module.ts                          # skeleton ~25 lignes
repo/packages/auth/src/index.ts                                # reexports
repo/packages/auth/test/schemas.spec.ts                        # ~80 lignes (tests Zod)
```

**Notes implementation** :
- 12 roles enum strict (vs strings) : permet TypeScript autocompletion + grep
- Password policy regex : `/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[a-zA-Z\d!@#$%^&*]{12,}$/`
- Banlist top 1000 password : fichier JSON `repo/packages/auth/src/data/banned-passwords.json` (chargee Tache 2.1.2)
- Constants centrales facilitent audit (un seul endroit pour params crypto)
- TOTP SHA-1 (vs SHA-256) : compat Google Authenticator + Microsoft Authenticator

**Criteres validation** :
- V1 (P0) : Package build reussit
- V2 (P0) : 12 roles enum accessible
- V3 (P0) : 5 schemas Zod presents et testes
- V4 (P0) : Password policy regex match : "MyP@ss12345" valide, "weak" rejete
- V5 (P0) : Constants Argon2 params >= 65536/3/4
- V6 (P0) : JWT TTL access 15min, refresh 30 jours
- V7 (P1) : Tests Zod 5+ scenarios passent

---

## Tache 2.1.2 -- Argon2id Service : Hash + Verify + Password Policies

**Metadonnees** : Phase 2 / Sprint 5 / P0 / 5h / Depend de 2.1.1

**But** : Service NestJS `Argon2Service` avec hash + verify mots de passe utilisant Argon2id (winner Password Hashing Competition 2015), parametres durcis OWASP 2024.

**Contexte** : Argon2id resiste GPU + ASIC + side-channel attacks. Library `@node-rs/argon2` (Rust binding) ~10x plus rapide que `argon2` npm (pure JS) -- critique car hash est slow par design (anti brute force).

**Livrables checkables** :
- [ ] Service `repo/packages/auth/src/services/argon2.service.ts`
- [ ] Method `hash(password: string): Promise<string>` -- retourne string format Argon2 standard
- [ ] Method `verify(hash: string, password: string): Promise<boolean>` -- comparison constant-time
- [ ] Method `needsRehash(hash: string): boolean` -- detect si hash genere avec params plus faibles -> rehash on next login
- [ ] Method `validatePolicy(password: string): { valid: boolean; reasons?: string[] }` :
  - Min 12 caracteres
  - Au moins 1 majuscule, 1 minuscule, 1 chiffre, 1 special
  - Pas dans banlist top 1000 password leakes
  - Pas similaire a email/display_name (Levenshtein distance > 5)
- [ ] Banlist chargee depuis `data/banned-passwords.json` au boot (Set in-memory)
- [ ] Tests unitaires : hash + verify roundtrip, verify wrong password retourne false, validatePolicy 10+ scenarios
- [ ] Performance : hash duree 200-500ms (acceptable UX, costly attaque brute force)

**Pattern critique : params Argon2 durcis OWASP 2024**

```typescript
// repo/packages/auth/src/services/argon2.service.ts
import argon2 from '@node-rs/argon2';

const PARAMS = {
  algorithm: argon2.Algorithm.Argon2id,  // hybride resistance side-channel
  memoryCost: 65536,                      // 64 MB RAM
  timeCost: 3,                            // 3 iterations
  parallelism: 4,                         // 4 threads
  outputLen: 32,                          // 32 bytes hash
};

async hash(password: string): Promise<string> {
  return argon2.hash(password, PARAMS);
}

async verify(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password);
}
```

**Banlist top 1000 password leakes**

Source : top 1000 du SecLists rockyou ou Have I Been Pwned. Stocke dans `data/banned-passwords.json` (~10 KB). Loaded en Set au boot service. Lookup O(1).

**Fichiers crees / modifies** :
```
repo/packages/auth/src/services/argon2.service.ts                       # ~120 lignes
repo/packages/auth/src/services/argon2.service.spec.ts                  # ~120 lignes (tests exhaustifs)
repo/packages/auth/src/data/banned-passwords.json                        # liste 1000 password leakes
repo/packages/auth/package.json                                          # add : @node-rs/argon2
```

**Notes implementation** :
- `@node-rs/argon2` (Rust binding) est x10 plus rapide qu'`argon2` npm pure JS
- Format hash retourne : `$argon2id$v=19$m=65536,t=3,p=4$<salt>$<hash>` (auto-gere)
- `needsRehash()` permet upgrade params silencieux quand on durcit (next login = rehash automatique)
- Banlist : check apres regex pattern match (eviter "Password123!" qui passe regex mais top liste)
- Levenshtein distance email/displayName : evite "joe@example.com" -> password "joe123"
- Performance test : hash 1000 fois sur dev machine, mediane attendue ~250ms

**Criteres validation** :
- V1 (P0) : `hash(password)` retourne string format Argon2
- V2 (P0) : `verify(hash, password)` retourne true si match, false sinon
- V3 (P0) : `verify` constant-time (pas de timing attack)
- V4 (P0) : `validatePolicy("MyStrongP@ss123")` valide
- V5 (P0) : `validatePolicy("password123")` rejete (trop court, banlist)
- V6 (P0) : `validatePolicy("MyP@ss12345", { email: "myp@ss.com" })` rejete (similar email)
- V7 (P0) : `needsRehash` detect old params
- V8 (P0) : Banlist 1000 password chargee
- V9 (P0) : Hash duree 200-500ms (perf test)
- V10 (P1) : Tests 15+ scenarios passent

---

## Tache 2.1.3 -- Crypto Services : AES-GCM (MFA Secret) + SHA-256 (Refresh Tokens)

**Metadonnees** : Phase 2 / Sprint 5 / P0 / 5h / Depend de 2.1.2

**But** : 2 services crypto utilises plus tard : `EncryptionService` (AES-256-GCM symetrique pour MFA secret stocke en DB) + `HashingService` (SHA-256 hash refresh tokens stockes en Redis).

**Contexte** : MFA secret (TOTP shared secret) est stocke en DB chiffre AES-GCM (au cas DB leak, attacker n'a pas TOTP). Refresh tokens sont hashes SHA-256 avant stockage Redis (au cas Redis leak, tokens pas reutilisables).

**Livrables checkables** :
- [ ] Service `repo/packages/auth/src/services/encryption.service.ts` (AES-256-GCM)
- [ ] Methods : `encrypt(plaintext: string): string` (retourne base64 `iv:ciphertext:authTag`), `decrypt(encrypted: string): string`
- [ ] Cle depuis env `MFA_SECRET_ENCRYPTION_KEY` (32 bytes minimum)
- [ ] IV genere aleatoire 12 bytes per encryption (NEVER reuse IV with same key)
- [ ] AuthTag verifie a decryption (integrite)
- [ ] Service `repo/packages/auth/src/services/hashing.service.ts` (SHA-256 + HMAC)
- [ ] Methods : `sha256(input: string): string` (hex digest), `hmacSha256(input: string, key: string): string` (pour signing webhooks Sprint 9+)
- [ ] Methods : `randomToken(length: number = 32): string` (crypto.randomBytes -> base64url)
- [ ] Tests unitaires : roundtrip encrypt/decrypt, IV unique per call, tampered ciphertext fails decryption (authTag invalid)

**Pattern critique : AES-GCM Node natif**

```typescript
// repo/packages/auth/src/services/encryption.service.ts
import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { loadEnv } from '@insurtech/shared-config';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;       // GCM standard
const AUTH_TAG_LENGTH = 16;

@Injectable()
export class EncryptionService {
  private key: Buffer;

  constructor() {
    const env = loadEnv();
    if (env.MFA_SECRET_ENCRYPTION_KEY.length < 32) {
      throw new Error('MFA_SECRET_ENCRYPTION_KEY must be at least 32 chars');
    }
    this.key = Buffer.from(env.MFA_SECRET_ENCRYPTION_KEY.slice(0, 32), 'utf-8');
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('base64url')}:${ciphertext.toString('base64url')}:${authTag.toString('base64url')}`;
  }

  decrypt(encrypted: string): string {
    const [ivB64, ctB64, tagB64] = encrypted.split(':');
    const iv = Buffer.from(ivB64, 'base64url');
    const ciphertext = Buffer.from(ctB64, 'base64url');
    const authTag = Buffer.from(tagB64, 'base64url');
    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf-8');
  }
}
```

**Fichiers crees / modifies** :
```
repo/packages/auth/src/services/encryption.service.ts                # ~100 lignes
repo/packages/auth/src/services/encryption.service.spec.ts           # ~80 lignes
repo/packages/auth/src/services/hashing.service.ts                    # ~60 lignes
repo/packages/auth/src/services/hashing.service.spec.ts               # ~70 lignes
```

**Notes implementation** :
- AES-256-GCM : authenticated encryption (confidentiality + integrity)
- IV (Initialization Vector) random per call : reuse meme IV+key catastrophique securite
- AuthTag 16 bytes : integrite verifiee a decryption (cipher tampered -> exception)
- SHA-256 vs Argon2 pour refresh tokens : tokens deja random 32 bytes (haute entropie), pas besoin slow hash
- HMAC-SHA-256 utile pour webhook signature verification (Sprint 9+ Meta)
- `randomToken()` utilise crypto.randomBytes (CSPRNG, pas Math.random)
- base64url (vs base64) : URL-safe (no `+`, `/`, `=` padding) -- utile pour tokens dans URLs

**Criteres validation** :
- V1 (P0) : `encrypt(plaintext)` retourne string format `iv:ct:tag`
- V2 (P0) : `decrypt(encrypt(x))` retourne x
- V3 (P0) : 2 calls `encrypt(same plaintext)` produisent 2 ciphertexts differents (IV unique)
- V4 (P0) : Tampered ciphertext fail decryption (authTag invalid)
- V5 (P0) : Throw si key < 32 chars
- V6 (P0) : `sha256(input)` retourne hex 64 chars deterministe
- V7 (P0) : `hmacSha256(input, key)` retourne hex 64 chars
- V8 (P0) : `randomToken(32)` retourne base64url string ~43 chars
- V9 (P0) : 2 calls `randomToken()` produisent strings differents (CSPRNG)
- V10 (P1) : Tests 12+ scenarios passent

---

## Tache 2.1.4 -- JWT Service : Sign + Verify Access/Refresh + Rotation

**Metadonnees** : Phase 2 / Sprint 5 / P0 / 6h / Depend de 2.1.3

**But** : Service NestJS pour signer et verifier JWT (access + refresh tokens) avec rotation et detection vol (token family pattern).

**Contexte** : Pattern industry-standard : access token short-lived (15min), refresh token long-lived (30 jours) + ROTATION (chaque refresh genere nouveau couple, ancien refresh devient invalide). Detection vol : si meme refresh token reutilise, toute la family revoked.

**Livrables checkables** :
- [ ] Service `repo/packages/auth/src/services/jwt.service.ts`
- [ ] Method `signAccessToken(payload: JwtPayload): string` -- TTL 15min, algo HS256
- [ ] Method `signRefreshToken(payload: RefreshTokenPayload): string` -- TTL 30 jours, algo HS256, secret different
- [ ] Method `verifyAccessToken(token: string): JwtPayload` -- throws si invalide ou expire
- [ ] Method `verifyRefreshToken(token: string): RefreshTokenPayload` -- throws si invalide
- [ ] Method `decode(token: string): JwtPayload | null` -- decode SANS verifier (pour debug)
- [ ] Method `extractFromHeader(authHeader: string | undefined): string | null` -- parse `Bearer <token>`
- [ ] Field `jti` (JWT ID) genere ULID -- utilise pour blacklist + session lookup
- [ ] Field `token_family` sur refresh tokens : ULID partage entre tous tokens d'une session, change a chaque rotation
- [ ] Standard claims : `iss` (issuer 'skalean-insurtech'), `aud` (audience 'skalean-insurtech-api'), `nbf` (not before), `iat`, `exp`
- [ ] Error types specifiques : `TokenExpiredError`, `TokenInvalidError`, `TokenAudienceError`
- [ ] Tests unitaires : sign + verify roundtrip, expired token rejected, tampered token rejected, decode without verify

**Pattern critique : token family pour detection vol**

Quand utilisateur fait login -> genere `family_id_1` + `refresh_token_1`. Au refresh -> genere `refresh_token_2` (meme `family_id_1`), invalide `refresh_token_1`. Si attacker capture `refresh_token_1` et tente de l'utiliser apres legit user a deja refresh -> detection vol -> revoke TOUTE la family (force re-login partout).

```typescript
// Pattern : RefreshTokenPayload
{
  sub: 'user-uuid',
  jti: 'ULID-of-this-token',           // unique per token
  token_family: 'ULID-shared-family',   // shared across rotations
  iat, exp,
}
```

Service `SessionService` (Tache 2.1.5) implemente la logique detection vol via Redis lookup family.

**Fichiers crees / modifies** :
```
repo/packages/auth/src/services/jwt.service.ts                  # ~150 lignes
repo/packages/auth/src/services/jwt.service.spec.ts             # ~150 lignes (tests exhaustifs)
repo/packages/auth/src/errors/token-errors.ts                    # ~40 lignes (error classes)
```

**Notes implementation** :
- HS256 (vs RS256) : suffisant Sprint 5 (1 server). Migration RS256 Phase 7 pour scaling multi-servers
- 2 secrets distincts : JWT_SECRET (access) + JWT_REFRESH_SECRET (refresh) -- compromise un n'expose pas l'autre
- Audience claim : verifie tokens emis pour CETTE API (eviter reutilisation cross-services)
- `jti` ULID : sortable, utile audit timeline
- `token_family` : pattern OAuth2 RFC 6819 detection token theft
- Decode without verify : utile debug logs (log token contents) -- mais NEVER trust ces values

**Criteres validation** :
- V1 (P0) : `signAccessToken(payload)` retourne JWT 3 parties dot-separated
- V2 (P0) : `verifyAccessToken(signedToken)` retourne payload original
- V3 (P0) : Token expired throw `TokenExpiredError`
- V4 (P0) : Token tampered (signature) throw `TokenInvalidError`
- V5 (P0) : Token wrong audience throw `TokenAudienceError`
- V6 (P0) : Refresh token signe avec REFRESH_SECRET (different access)
- V7 (P0) : `extractFromHeader('Bearer xxx')` retourne 'xxx'
- V8 (P0) : `extractFromHeader('Basic xxx')` retourne null
- V9 (P0) : `decode(token)` retourne payload meme si expire
- V10 (P0) : Tests 15+ scenarios passent

---

## Tache 2.1.5 -- Session Service : Redis Storage + Lookup + Revocation

**Metadonnees** : Phase 2 / Sprint 5 / P0 / 5h / Depend de 2.1.4

**But** : Service `SessionService` qui gere les sessions (refresh tokens) en Redis (DB 1 SESSIONS) avec lookup par jti et revocation par jti / by user / by family.

**Livrables checkables** :
- [ ] Service `repo/packages/auth/src/services/session.service.ts`
- [ ] Method `createSession(userId, refreshTokenJti, family, metadata): Promise<void>` -- stocke en Redis avec TTL = JWT_REFRESH_TTL
- [ ] Method `getSession(jti): Promise<SessionRecord | null>` -- lookup
- [ ] Method `revokeSession(jti): Promise<void>` -- delete + add to blacklist (TTL = remaining lifetime)
- [ ] Method `revokeUserSessions(userId): Promise<void>` -- revoke ALL sessions of a user (logout-everywhere)
- [ ] Method `revokeFamily(family): Promise<void>` -- detection vol -> revoke whole family
- [ ] Method `rotateSession(oldJti, newJti, family): Promise<void>` -- atomique : revoke old + create new
- [ ] Method `isRevoked(jti): Promise<boolean>` -- check blacklist
- [ ] Method `listUserSessions(userId): Promise<SessionRecord[]>` -- pour endpoint `/api/v1/auth/sessions`
- [ ] SessionRecord stocke : userId, jti, family, createdAt, ipAddress, userAgent, lastActivity
- [ ] Aussi persiste dans table `auth_sessions` (Sprint 2) hash refresh_token_hash (SHA-256) pour audit
- [ ] Logs structures : session created, revoked, family revoked
- [ ] Tests : create + lookup + revoke + rotate flow + family revoke

**Pattern critique : detection vol via family**

```typescript
async refresh(refreshToken: string, ip: string, ua: string): Promise<TokenPair> {
  const payload = this.jwt.verifyRefreshToken(refreshToken);
  const session = await this.sessionService.getSession(payload.jti);

  if (!session) {
    // jti deja revoque -> attacker reutilise ancien token apres rotation legit
    // -> revoke whole family pour invalider tout
    await this.sessionService.revokeFamily(payload.token_family);
    throw new UnauthorizedException({ code: 'TOKEN_REUSE_DETECTED' });
  }

  // Rotation : new tokens, same family
  const newJti = ulid();
  const newAccessToken = this.jwt.signAccessToken({ sub: payload.sub, ... });
  const newRefreshToken = this.jwt.signRefreshToken({ sub, jti: newJti, token_family: payload.token_family });

  await this.sessionService.rotateSession(payload.jti, newJti, payload.token_family);

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
}
```

**Fichiers crees / modifies** :
```
repo/packages/auth/src/services/session.service.ts                 # ~180 lignes
repo/packages/auth/src/services/session.service.spec.ts             # ~150 lignes
repo/packages/auth/src/types/session-record.ts                       # ~20 lignes
```

**Notes implementation** :
- Redis DB 1 (SESSIONS) -- isolation des autres DBs
- Cle Redis : `session:{jti}` -> SessionRecord JSON
- Cle blacklist : `revoked:{jti}` -> '1' avec TTL = remaining lifetime
- `revokeUserSessions` : SCAN keys `session:*` filter par userId (pas optimal scaling, Phase 7 ajoutera index)
- `revokeFamily` : SCAN keys family member, batch DELETE
- Pattern Lua script pour atomicite `rotateSession` (eviter race condition)
- `auth_sessions` table DB : audit trail (qui s'est connecte quand depuis quelle IP)
- `lastActivity` updated chaque request authentifiee -- detection sessions zombies

**Criteres validation** :
- V1 (P0) : `createSession` stocke en Redis + DB
- V2 (P0) : `getSession(jti)` retourne SessionRecord
- V3 (P0) : `revokeSession(jti)` : session inaccessible + blacklist set
- V4 (P0) : `isRevoked(jti)` retourne true apres revoke
- V5 (P0) : `revokeFamily` : tous tokens family inaccessibles
- V6 (P0) : `rotateSession` atomic (test : kill server in between fails clean)
- V7 (P0) : TTL Redis = JWT_REFRESH_TTL (30 jours)
- V8 (P0) : `revokeUserSessions(userId)` revoke tous tokens user
- V9 (P0) : `listUserSessions(userId)` retourne array
- V10 (P1) : Tests 15+ scenarios passent

---

## Tache 2.1.6 -- AuthModule + AuthController + AuthService + JWT Strategy + JwtAuthGuard

**Metadonnees** : Phase 2 / Sprint 5 / P0 / 7h / Depend de 2.1.5

**But** : Glue NestJS exposant endpoints REST (`/api/v1/auth/*`) qui orchestrent les services (Argon2, JWT, Session) pour signin/signout/refresh/me.

**Livrables checkables** :
- [ ] Module `repo/apps/api/src/modules/auth/auth.module.ts` import AuthService + Controller + Strategies
- [ ] Controller `auth.controller.ts` avec endpoints :
  - `POST /api/v1/auth/signin` (body : SigninSchema) -> retourne tokens + user (sans password_hash)
  - `POST /api/v1/auth/signout` (auth required) -> revoke session courante
  - `POST /api/v1/auth/signout-all` (auth required) -> revoke ALL user sessions
  - `POST /api/v1/auth/refresh` (body : refreshToken) -> nouveau couple tokens (avec rotation)
  - `GET /api/v1/auth/me` (auth required) -> retourne profile user authentifie
  - `GET /api/v1/auth/sessions` (auth required) -> liste sessions actives user
- [ ] Service `auth.service.ts` orchestrant :
  - `signin(email, password, ip, ua)` : lookup user + verify password + check locked + check email_verified + create session + sign tokens
  - `signout(jti)` : revoke session
  - `refresh(refreshToken, ip, ua)` : rotation + detection vol
  - `me(userId)` : retourne user data
- [ ] JWT Strategy `jwt.strategy.ts` (passport-jwt) :
  - extracts JWT from `Authorization: Bearer ...` header
  - verifie avec JwtService
  - check session non revoquee
  - return validated user pour injection dans request
- [ ] Guard `jwt-auth.guard.ts` extends AuthGuard('jwt') :
  - check `@Public()` decorator (skip si public)
  - sinon execute JWT strategy
- [ ] Decorator `@CurrentUser()` extract user depuis request
- [ ] Tous endpoints retournent format standardise `{ data, meta }` (Sprint 3)
- [ ] Audit log automatique sur signin/signout/refresh (Tache 2.1.12)
- [ ] Events Kafka publies (Sprint 2 KafkaPublisher)
- [ ] Tests E2E couvrant flow signin -> me -> refresh -> signout

**Pattern critique : signin flow complet**

```typescript
// repo/apps/api/src/modules/auth/auth.service.ts
async signin(email: string, password: string, ip: string, ua: string): Promise<SigninResult> {
  // 1. Lookup user
  const user = await this.userRepo.findOne({ where: { email: email.toLowerCase() } });
  if (!user) {
    throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS' });
  }

  // 2. Check locked (anti brute force, Tache 2.1.10)
  if (user.locked_until && user.locked_until > new Date()) {
    throw new UnauthorizedException({ code: 'ACCOUNT_LOCKED', retry_after: user.locked_until });
  }

  // 3. Verify password
  const valid = await this.argon2.verify(user.password_hash, password);
  if (!valid) {
    await this.lockoutService.recordFailedAttempt(user.id, ip);
    throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS' });
  }

  // 4. Reset lockout counter
  await this.lockoutService.recordSuccess(user.id);

  // 5. Check email verified
  if (!user.email_verified_at) {
    throw new UnauthorizedException({ code: 'EMAIL_NOT_VERIFIED' });
  }

  // 6. Check MFA required (Tache 2.1.7)
  if (user.mfa_enabled) {
    // Return partial token requiring MFA verify
    return { needs_mfa: true, mfa_challenge_token: this.signMfaChallengeToken(user.id) };
  }

  // 7. Generate tokens
  const family = ulid();
  const accessJti = ulid();
  const refreshJti = ulid();
  const accessToken = this.jwt.signAccessToken({ sub: user.id, ... });
  const refreshToken = this.jwt.signRefreshToken({ sub: user.id, jti: refreshJti, token_family: family });

  // 8. Create session
  await this.sessionService.createSession(user.id, refreshJti, family, { ip, ua });

  // 9. Update last_login_at
  await this.userRepo.update(user.id, { last_login_at: new Date() });

  // 10. Audit + Kafka event
  await this.auditAuthService.logSignin(user.id, ip, ua, 'password');
  await this.kafkaPublisher.publish(Topics.AUTH_USER_SIGNED_IN, { ... });

  return { accessToken, refreshToken, user: this.sanitizeUser(user) };
}
```

**Fichiers crees / modifies** :
```
repo/apps/api/src/modules/auth/auth.module.ts                    # ~50 lignes
repo/apps/api/src/modules/auth/auth.controller.ts                # ~150 lignes (6 endpoints)
repo/apps/api/src/modules/auth/auth.service.ts                    # ~250 lignes
repo/apps/api/src/modules/auth/strategies/jwt.strategy.ts         # ~60 lignes
repo/apps/api/src/modules/auth/guards/jwt-auth.guard.ts           # ~40 lignes
repo/apps/api/src/modules/auth/decorators/current-user.decorator.ts # ~15 lignes
repo/apps/api/src/modules/auth/dto/{6 dtos}.ts                     # using createZodDto
repo/apps/api/test/auth.e2e-spec.ts                                # tests E2E
```

**Notes implementation** :
- `JwtAuthGuard` heritant de PublicEndpointGuard Sprint 3 (chained guards)
- `@CurrentUser()` decorator usage : `me(@CurrentUser() user: AuthenticatedUser) { return user; }`
- `sanitizeUser()` enleve password_hash, mfa_secret_encrypted avant return
- Ip + UserAgent injectes dans audit + session pour tracability
- Email lowercase normalise (case-insensitive lookup -- coherent avec citext DB Sprint 2)
- AuditAuthService Tache 2.1.12 (publish Kafka + insert audit_log)
- `mfa_challenge_token` : JWT court-vivant 5min permettant verifier MFA dans next call

**Criteres validation** :
- V1 (P0) : POST /signin avec creds valides retourne tokens + user
- V2 (P0) : POST /signin avec mauvais password retourne 401 INVALID_CREDENTIALS
- V3 (P0) : POST /signin avec compte locke retourne 401 ACCOUNT_LOCKED
- V4 (P0) : POST /signin sans email verifie retourne 401 EMAIL_NOT_VERIFIED
- V5 (P0) : POST /signin avec MFA enabled retourne `needs_mfa: true`
- V6 (P0) : GET /me avec valid token retourne user
- V7 (P0) : GET /me sans token retourne 401
- V8 (P0) : POST /refresh retourne nouveaux tokens + invalide ancien
- V9 (P0) : POST /signout revoke session
- V10 (P0) : POST /signout-all revoke toutes sessions user
- V11 (P0) : Audit log + Kafka event sur signin/signout/refresh
- V12 (P1) : Tests E2E 15+ scenarios passent

---

## Tache 2.1.7 -- MFA Service : TOTP RFC 6238 + QR + Recovery Codes

**Metadonnees** : Phase 2 / Sprint 5 / P0 / 6h / Depend de 2.1.6

**But** : Service MFA complete : generation secret TOTP + QR code + verify code + 6 recovery codes (one-time use) genere a setup.

**Livrables checkables** :
- [ ] Service `repo/packages/auth/src/services/mfa.service.ts`
- [ ] Method `generateSecret(): { secret: string, qrCode: string, otpauthUrl: string }` :
  - Genere secret base32 32 chars (otplib)
  - Construit otpauth URL : `otpauth://totp/skalean-insurtech:{email}?secret={secret}&issuer=skalean-insurtech`
  - Genere QR code data URL (qrcode library)
- [ ] Method `verifyToken(secret: string, token: string): boolean` -- accepte +/- 1 window (60s tolerance clock skew)
- [ ] Method `generateRecoveryCodes(count: number = 6): string[]` -- format `XXXX-XXXX-XXXX` (12 chars 36-base)
- [ ] Method `hashRecoveryCodes(codes: string[]): string[]` -- argon2 hash chaque code (one-time use)
- [ ] Method `verifyRecoveryCode(hashes: string[], code: string): { valid: boolean, indexUsed?: number }` -- compare + indique index utilise pour invalidation
- [ ] Tests unitaires : generate + verify TOTP, accept window +/-1, recovery codes format, recovery code one-time use

**Pattern critique : TOTP avec otplib**

```typescript
import { authenticator } from 'otplib';
import qrcode from 'qrcode';

authenticator.options = {
  algorithm: 'sha1',  // compat Google Authenticator
  digits: 6,
  step: 30,
  window: 1,           // accept +/- 1 step (30s tolerance)
};

generateSecret(email: string): { secret: string; qrCode: string; otpauthUrl: string } {
  const secret = authenticator.generateSecret(20); // 32 base32 chars
  const otpauthUrl = authenticator.keyuri(email, 'skalean-insurtech', secret);
  const qrCode = await qrcode.toDataURL(otpauthUrl); // data:image/png;base64,...
  return { secret, qrCode, otpauthUrl };
}

verifyToken(secret: string, token: string): boolean {
  return authenticator.verify({ token, secret });
}
```

**Recovery codes pattern** :

Format `XXXX-XXXX-XXXX` (4 chars random base36 x 3 groups, separateur tiret pour readability). Stockes en DB hashes argon2 dans column `auth_users.recovery_codes_hashed jsonb` (array de 6 hashes). A chaque verify recovery, marquer code comme `used` (set hash = null dans array).

**Fichiers crees / modifies** :
```
repo/packages/auth/src/services/mfa.service.ts                  # ~150 lignes
repo/packages/auth/src/services/mfa.service.spec.ts             # ~150 lignes (tests TOTP + recovery)
repo/packages/auth/package.json                                  # add : otplib, qrcode
```

**Notes implementation** :
- TOTP SHA-1 (vs SHA-256) : compat tous authenticators majeurs
- Window +/-1 : tolere 30-90s clock skew (utilisateur prend temps a saisir)
- otpauth URL format RFC 6238 standard : compat Google Auth, Microsoft, 1Password, etc.
- QR code data URL : envoye au frontend `<img src="data:image/png;base64,...">`
- Recovery codes hashed Argon2 (vs SHA-256) : memes raisons que password (anti GPU)
- One-time use : recovery code valide 1 fois, ensuite hash remplace par null (preserve index)
- Backup : utilisateur encourage a download recovery codes (PDF Sprint 12)

**Criteres validation** :
- V1 (P0) : `generateSecret(email)` retourne `{ secret, qrCode, otpauthUrl }`
- V2 (P0) : `verifyToken(secret, token)` retourne true si token valide
- V3 (P0) : Token genere avec autre secret rejete
- V4 (P0) : Token expire (>30s+30s) rejete
- V5 (P0) : Window +/-1 accept token current ou previous step
- V6 (P0) : `generateRecoveryCodes()` retourne 6 strings format `XXXX-XXXX-XXXX`
- V7 (P0) : Codes recovery hashes Argon2 (longueur ~95 chars)
- V8 (P0) : `verifyRecoveryCode(hashes, code)` retourne `{ valid, indexUsed }`
- V9 (P0) : Code recovery already used rejete
- V10 (P0) : QR code data URL valide (parse-able)

---

## Tache 2.1.8 -- MFA Required Guard + Endpoints

**Metadonnees** : Phase 2 / Sprint 5 / P0 / 5h / Depend de 2.1.7

**But** : Endpoints `/setup-mfa`, `/verify-mfa`, `/disable-mfa` + Guard `MfaRequiredGuard` qui force MFA pour roles privileges (super_admin_platform).

**Livrables checkables** :
- [ ] Endpoints AuthController :
  - `POST /api/v1/auth/setup-mfa` (auth required) -> retourne `{ secret, qrCode, recovery_codes }` (recovery codes seul moment montres en clair)
  - `POST /api/v1/auth/confirm-mfa` (auth required, body `totp_code`) -> verify code initial + active mfa_enabled
  - `POST /api/v1/auth/verify-mfa` (mfa_challenge_token + body `totp_code` ou `recovery_code`) -> retourne tokens finaux
  - `POST /api/v1/auth/disable-mfa` (auth + current password) -> desactive MFA
- [ ] Guard `MfaRequiredGuard` :
  - check decorator `@RequireMfa()` ou role super_admin_platform
  - si user.mfa_verified false -> rejette 403 `MFA_REQUIRED`
- [ ] Decorator `@RequireMfa()` -- explicite force MFA sur endpoint
- [ ] Setup MFA workflow :
  1. User authentifie -> POST /setup-mfa
  2. Frontend recoit { secret, qrCode, recovery_codes } -- montre a user
  3. User scanne QR + saisit premier TOTP code
  4. POST /confirm-mfa { totp_code } -> verifie + active mfa_enabled = true en DB
  5. recovery_codes_hashed sauvegarde
  6. Force re-login (revoke sessions) pour forcer MFA flow
- [ ] Signin avec MFA workflow :
  1. POST /signin -> retourne `{ needs_mfa: true, mfa_challenge_token }` si user.mfa_enabled
  2. Frontend prompt user pour TOTP
  3. POST /verify-mfa { mfa_challenge_token, totp_code } -> retourne tokens finaux
  4. Si TOTP fail mais recovery_code provided -> verify recovery + invalidate code
- [ ] mfa_challenge_token : JWT TTL 5min, claim `mfa_pending: true`
- [ ] Audit log + Kafka events sur setup, confirm, verify, disable
- [ ] Tests E2E couvrent workflows complets

**Fichiers crees / modifies** :
```
repo/apps/api/src/modules/auth/auth.controller.ts             # update : 4 endpoints MFA
repo/apps/api/src/modules/auth/auth.service.ts                 # update : 4 methods MFA
repo/apps/api/src/modules/auth/guards/mfa-required.guard.ts    # ~50 lignes
repo/apps/api/src/modules/auth/decorators/require-mfa.decorator.ts # ~10 lignes
repo/apps/api/test/auth-mfa.e2e-spec.ts                        # tests E2E MFA
```

**Notes implementation** :
- Recovery codes affiches CLAIR uniquement a setup -- jamais ensuite (only hashed stocke)
- Force re-login apres setup MFA -- assure user ait teste MFA flow avant verrou complet
- mfa_challenge_token court-vivant (5min) -- evite challenge stale
- Disable MFA require current password -- protege contre attaque session vole
- Roles forcing MFA : super_admin_platform, broker_admin (configurable Sprint 6+)

**Criteres validation** :
- V1 (P0) : POST /setup-mfa retourne secret + QR + 6 recovery codes
- V2 (P0) : POST /confirm-mfa avec TOTP valide active mfa_enabled
- V3 (P0) : Apres confirm-mfa, force re-login (sessions revoked)
- V4 (P0) : POST /signin avec mfa_enabled retourne needs_mfa
- V5 (P0) : POST /verify-mfa avec TOTP valide retourne tokens
- V6 (P0) : POST /verify-mfa avec recovery code valide retourne tokens + invalide code
- V7 (P0) : Recovery code already used rejete
- V8 (P0) : POST /disable-mfa sans password rejete
- V9 (P0) : MfaRequiredGuard bloque endpoint @RequireMfa() si mfa_verified false
- V10 (P1) : Tests E2E 10+ scenarios

---

## Tache 2.1.9 -- Signup Flow + Email Verification

**Metadonnees** : Phase 2 / Sprint 5 / P0 / 5h / Depend de 2.1.8

**But** : Endpoints `/signup` + `/verify-email` + flow complete avec token verification email + double-opt-in.

**Livrables checkables** :
- [ ] Endpoint `POST /api/v1/auth/signup` (public) :
  - body : SignupSchema (email + password + display_name + locale + tenant_invite_token NULL)
  - Validation password policy (Tache 2.1.2)
  - Verify email pas deja existant
  - Create user en DB (email_verified_at NULL)
  - Generate verification token (random 32 bytes base64url)
  - Store hash token + expiry 24h dans `auth_email_verifications` table (Sprint 5 ajoute table simple)
  - Send email verification (Tache 2.1.13)
  - Return `{ message: 'Verify email sent' }` sans tokens
- [ ] Endpoint `GET /api/v1/auth/verify-email?token=xxx` (public) :
  - Lookup token hash dans table
  - Verify pas expire
  - Mark user email_verified_at = NOW
  - Delete verification token
  - Audit log + event Kafka
  - Redirect `https://{frontend_url}/auth/email-verified`
- [ ] Endpoint `POST /api/v1/auth/resend-verification` (public, rate limited) :
  - body : email
  - Re-send if user exists et pas encore verified
- [ ] Migration TypeORM : table `auth_email_verifications` (id, user_id FK, token_hash UNIQUE, expires_at, created_at)
- [ ] Tests E2E : signup + verify-email + signin (ne marche que apres verify) + resend
- [ ] Audit log + Kafka events publies

**Pattern critique : token verification email**

```typescript
async signup(dto: SignupDto): Promise<{ message: string }> {
  // Validate password
  const policy = this.argon2.validatePolicy(dto.password, { email: dto.email });
  if (!policy.valid) {
    throw new BadRequestException({ code: 'PASSWORD_POLICY', reasons: policy.reasons });
  }

  // Check email unique
  const existing = await this.userRepo.findOne({ where: { email: dto.email.toLowerCase() } });
  if (existing) {
    // Anti enumeration : meme reponse que succes
    return { message: 'Verification email sent' };
  }

  // Hash password
  const passwordHash = await this.argon2.hash(dto.password);

  // Create user (email_verified_at NULL)
  const user = await this.userRepo.save({
    email: dto.email.toLowerCase(),
    password_hash: passwordHash,
    display_name: dto.display_name,
    tenant_id: null,  // sera assigne par invite Sprint 6
    email_verified_at: null,
  });

  // Generate token
  const token = this.hashing.randomToken(32);
  const tokenHash = this.hashing.sha256(token);

  await this.emailVerificationRepo.save({
    user_id: user.id,
    token_hash: tokenHash,
    expires_at: addHours(new Date(), 24),
  });

  // Send email
  await this.emailService.sendVerification(user.email, user.locale, token);

  // Audit + event
  await this.auditAuthService.logSignup(user.id);
  await this.kafkaPublisher.publish(Topics.AUTH_USER_SIGNED_UP, { user_id: user.id });

  return { message: 'Verification email sent' };
}
```

**Fichiers crees / modifies** :
```
repo/apps/api/src/modules/auth/auth.controller.ts             # update : 3 endpoints
repo/apps/api/src/modules/auth/auth.service.ts                 # update : 3 methods
repo/packages/database/src/migrations/{date}-EmailVerifications.ts # migration table
repo/packages/database/src/entities/system/auth-email-verification.entity.ts
repo/apps/api/test/auth-signup.e2e-spec.ts                     # tests E2E
```

**Notes implementation** :
- Anti enumeration : signup avec email existant retourne meme reponse que succes (pas de leak "user exists")
- Token random 32 bytes : entropie suffisante (256 bits)
- Token hash SHA-256 : meme philo que refresh tokens (Redis leak protege)
- Token TTL 24h : balance UX vs securite
- Verify email GET (pas POST) : permet click direct depuis email
- Redirect frontend apres verify : meilleure UX que JSON response
- Locale stocke sur user pour future emails localises

**Criteres validation** :
- V1 (P0) : POST /signup avec data valide cree user (email_verified_at NULL)
- V2 (P0) : Email verification envoye
- V3 (P0) : POST /signup email duplique retourne meme reponse (anti-enumeration)
- V4 (P0) : POST /signup password faible rejete avec reasons
- V5 (P0) : GET /verify-email?token=valid mark verified + redirect
- V6 (P0) : GET /verify-email?token=expired rejete
- V7 (P0) : GET /verify-email?token=invalid rejete
- V8 (P0) : POST /signin sans email verified retourne 401 EMAIL_NOT_VERIFIED
- V9 (P0) : POST /resend-verification rate limited (3/h)
- V10 (P1) : Audit log + Kafka events emit

---

## Tache 2.1.10 -- Lockout Service (Anti Brute Force)

**Metadonnees** : Phase 2 / Sprint 5 / P0 / 4h / Depend de 2.1.9

**But** : Compte temporairement bloque apres N tentatives failed login (anti brute force) avec backoff exponential.

**Livrables checkables** :
- [ ] Service `repo/packages/auth/src/services/lockout.service.ts`
- [ ] Strategy : 5 echecs successifs en 15min -> lock 30min ; reset compteur a chaque succes
- [ ] Method `recordFailedAttempt(userId: string, ip: string): Promise<{ locked: boolean, retryAfter?: Date }>`
- [ ] Method `recordSuccess(userId: string): Promise<void>` -- reset compteur
- [ ] Method `isLocked(userId: string): Promise<{ locked: boolean, retryAfter?: Date }>`
- [ ] Stockage : column `auth_users.failed_login_attempts` (int) + `auth_users.locked_until` (timestamptz NULL)
- [ ] Aussi tracking par IP : Redis key `lockout:ip:{ip}` -> int count (TTL 15min) -- bloque 50 fails meme IP cross-users
- [ ] Backoff exponential : lock 1 = 30min, lock 2 = 1h, lock 3 = 4h, lock 4+ = 24h
- [ ] Counter reset apres succes ET apres lockout expire
- [ ] Audit log : event `auth.account_locked` publie
- [ ] Email notification a user lorsque lock (Tache 2.1.13)
- [ ] Endpoint admin `POST /api/v1/admin/users/:id/unlock` (Sprint 27 admin)
- [ ] Tests : 5 fails -> lock, 6e tentative pendant lock rejected, succes apres lock expire OK

**Fichiers crees / modifies** :
```
repo/packages/auth/src/services/lockout.service.ts                # ~120 lignes
repo/packages/auth/src/services/lockout.service.spec.ts           # ~120 lignes
```

**Notes implementation** :
- Lockout par user-id ET par ip pour defense profondeur
- IP tracking aide cas attacker brute force across multiples users
- Backoff exponential : decourage attacker meme apres unlock automatique
- Audit log + email notification : transparency vers user
- Pas de "captcha" en MVP : peut etre ajoute Phase 7 si necessaire

**Criteres validation** :
- V1 (P0) : 5 fails consecutifs -> lock 30min
- V2 (P0) : 6e tentative pendant lock rejette + retourne retryAfter
- V3 (P0) : Succes reset compteur
- V4 (P0) : Apres 30min, lock expire automatique
- V5 (P0) : Counter par IP : 50 fails IP -> block IP 1h
- V6 (P0) : Backoff exponential : 2eme lock 1h, 3eme lock 4h
- V7 (P0) : Audit + Kafka events
- V8 (P0) : Email notification envoye user
- V9 (P1) : Tests 10+ scenarios

---

## Tache 2.1.11 -- Account Recovery Service

**Metadonnees** : Phase 2 / Sprint 5 / P0 / 5h / Depend de 2.1.10

**But** : Flow complete account recovery : forgot password + reset password via email token.

**Livrables checkables** :
- [ ] Endpoint `POST /api/v1/auth/forgot-password` (public, rate limited) :
  - body : email
  - Si user exists, generate recovery token (32 bytes random) + send email
  - Anti enumeration : meme reponse meme si user n'existe pas
- [ ] Endpoint `POST /api/v1/auth/reset-password` (public) :
  - body : token + new_password
  - Verify token (hash + non expire)
  - Validate new password policy
  - Hash + update user.password_hash
  - Revoke ALL user sessions (force re-login partout)
  - Delete recovery token
  - Send confirmation email
- [ ] Migration TypeORM table `auth_password_recoveries` (id, user_id, token_hash UNIQUE, expires_at, used_at, created_at)
- [ ] TTL token recovery : 1 heure (vs 24h email verify -- recovery plus sensible)
- [ ] One-time use : `used_at` set apres reset, token invalide ensuite
- [ ] Notification email user APRES password change (alerte si pas lui)
- [ ] Audit log + Kafka events
- [ ] Tests E2E : forgot + reset complet

**Fichiers crees / modifies** :
```
repo/apps/api/src/modules/auth/auth.controller.ts             # update : 2 endpoints
repo/apps/api/src/modules/auth/auth.service.ts                 # update : 2 methods
repo/packages/database/src/migrations/{date}-PasswordRecoveries.ts # migration
repo/packages/database/src/entities/system/auth-password-recovery.entity.ts
repo/apps/api/test/auth-recovery.e2e-spec.ts                   # tests E2E
```

**Notes implementation** :
- Anti enumeration : "If account exists, email sent" meme si user n'existe pas
- TTL 1h : balance entre user UX et securite
- One-time use prevent token reuse meme si email leak
- Revoke all sessions critical : assure re-login de tous devices
- Email confirmation post-reset : detection precoce si compromission

**Criteres validation** :
- V1 (P0) : POST /forgot-password avec email valide envoie email
- V2 (P0) : POST /forgot-password email inexistant retourne meme reponse
- V3 (P0) : POST /reset-password token valide + new password reset
- V4 (P0) : Token expired (>1h) rejete
- V5 (P0) : Token already used rejete
- V6 (P0) : Apres reset : toutes sessions revoked
- V7 (P0) : Apres reset : email confirmation envoye
- V8 (P0) : Tests E2E full flow

---

## Tache 2.1.12 -- Audit Auth Service

**Metadonnees** : Phase 2 / Sprint 5 / P0 / 4h / Depend de 2.1.11

**But** : Service centralise pour logger toutes operations auth dans `audit_log` + publier events Kafka.

**Livrables checkables** :
- [ ] Service `repo/apps/api/src/modules/auth/services/audit-auth.service.ts`
- [ ] Methods correspondant aux events :
  - `logSignup(userId, ip, ua)`
  - `logSignin(userId, ip, ua, method: 'password' | 'mfa' | 'recovery')`
  - `logSignout(userId, sessionId)`
  - `logPasswordChanged(userId)`
  - `logMfaSetup(userId)`
  - `logMfaDisabled(userId)`
  - `logAccountLocked(userId, reason)`
  - `logAccountUnlocked(userId, by: 'auto' | 'admin')`
  - `logRoleChanged(userId, oldRole, newRole)` -- utilise Sprint 7
- [ ] Chaque method : INSERT row dans audit_log (via subscriber Sprint 2 ou direct) + publish event Kafka correspondant
- [ ] Trace ID + correlation ID propages depuis RequestContext (Sprint 3)
- [ ] Resource details : user_id, action, IP, UA, method
- [ ] Tests : verifier audit_log row + Kafka publish pour chaque method

**Fichiers crees / modifies** :
```
repo/apps/api/src/modules/auth/services/audit-auth.service.ts      # ~180 lignes (9 methods)
repo/apps/api/src/modules/auth/services/audit-auth.service.spec.ts # ~150 lignes
```

**Notes implementation** :
- Service injecte AuditLog repo + KafkaPublisher
- Chaque event auth a un schema Zod dans `shared-events` (Sprint 2 anticipe)
- audit_log entries : action='auth.signin', resource_type='auth_user', resource_id=userId, changes={ method, ip, ua }
- Kafka topic correspondent : `insurtech.events.auth.user_signed_in`, etc.
- Idempotency : audit log permet replay (si Kafka publish fail, retry safe)

**Criteres validation** :
- V1 (P0) : 9 methods presents
- V2 (P0) : `logSignin` cree row audit_log
- V3 (P0) : `logSignin` publish Kafka event
- V4 (P0) : Trace ID present dans audit_log + Kafka envelope
- V5 (P0) : Tests 9+ scenarios passent

---

## Tache 2.1.13 -- Email Service : Nodemailer + Handlebars

**Metadonnees** : Phase 2 / Sprint 5 / P0 / 6h / Depend de 2.1.12

**But** : Service email NestJS avec templates Handlebars 3 locales (fr / ar-MA / ar) pour emails auth + futurs emails metier.

**Livrables checkables** :
- [ ] Service `repo/packages/comm/src/services/email.service.ts` (package comm Sprint 9 anticipe)
- [ ] Method `send(to: string, template: string, locale: string, vars: Record<string, unknown>): Promise<void>`
- [ ] Templates Handlebars dans `repo/packages/comm/src/templates/{locale}/{template}.hbs` :
  - `verify-email.hbs` (fr / ar-MA / ar)
  - `password-reset.hbs`
  - `password-changed.hbs`
  - `account-locked.hbs`
  - `mfa-enabled.hbs`
- [ ] Layout shared `repo/packages/comm/src/templates/_layout.hbs` (header + footer + branding Skalean)
- [ ] Nodemailer transport : SMTP (mailhog dev, Mailgun/Sendgrid prod)
- [ ] Variables env : `EMAIL_SMTP_HOST/PORT/USER/PASSWORD`, `EMAIL_FROM_NO_REPLY`
- [ ] Subjects par locale + template
- [ ] Email format : HTML + text fallback (multipart)
- [ ] Tests : send + verify recu via Mailhog API REST
- [ ] Anti spam : DKIM + SPF documente (config DNS Sprint 35)

**Templates structure** :

```
repo/packages/comm/src/templates/
  _layout.hbs                    # base layout
  fr/
    verify-email.hbs             # "Verifiez votre email Skalean Insurtech"
    password-reset.hbs           # "Reinitialisez votre mot de passe"
    password-changed.hbs
    account-locked.hbs
    mfa-enabled.hbs
  ar-MA/                          # darija
    verify-email.hbs             # "وكد ايميلك ديال سكاليان"
    ...
  ar/                             # arabe classique
    verify-email.hbs             # "تأكيد بريدك الإلكتروني"
    ...
```

**Fichiers crees / modifies** :
```
repo/packages/comm/src/services/email.service.ts               # ~120 lignes
repo/packages/comm/src/services/email.service.spec.ts          # ~80 lignes
repo/packages/comm/src/templates/_layout.hbs                    # ~80 lignes
repo/packages/comm/src/templates/{fr,ar-MA,ar}/{5 templates}.hbs # ~30 lignes chacun
repo/packages/comm/package.json                                  # add : nodemailer, handlebars, @types/nodemailer
```

**Notes implementation** :
- Templates compiles a la demande (cache compiled)
- Layout shared evite duplication header/footer
- HTML + plain text via Nodemailer multipart
- ar-MA (darija) ecrit avec lettres arabes mais expressions familier MA
- ar (classique) formel
- fr cible francophones MA + diaspora
- Layout RTL pour ar/ar-MA (CSS direction:rtl)
- Tests dev : Mailhog API `GET http://localhost:8025/api/v2/messages` retourne emails capturees

**Criteres validation** :
- V1 (P0) : `send(to, 'verify-email', 'fr', vars)` envoie email
- V2 (P0) : Email recu visible dans Mailhog
- V3 (P0) : Templates 5 emails x 3 locales = 15 templates
- V4 (P0) : Layout Skalean applique (header/footer)
- V5 (P0) : Multipart : HTML + plain text
- V6 (P0) : Variables Handlebars interpolees
- V7 (P0) : RTL applique pour ar / ar-MA
- V8 (P1) : Tests 5+ scenarios passent

---

## Tache 2.1.14 -- Rate Limiting Auth-Specifique

**Metadonnees** : Phase 2 / Sprint 5 / P0 / 3h / Depend de 2.1.13

**But** : Override rate limiting global Sprint 3 sur endpoints auth-sensibles (signin, signup, forgot-password, resend-verification).

**Livrables checkables** :
- [ ] `@Throttle()` decorator applied per endpoint :
  - `POST /signin` : 5 req / minute / IP (anti brute force)
  - `POST /signup` : 3 req / heure / IP (anti spam)
  - `POST /forgot-password` : 3 req / heure / IP (anti spam reset emails)
  - `POST /resend-verification` : 3 req / heure / IP
  - `POST /refresh` : 30 req / minute / IP (legitimate frequent refresh OK)
  - `POST /verify-mfa` : 5 req / minute / IP
- [ ] Custom tracker : par IP + email (combo) pour signin -- evite attacker brute force 1 user x N IPs
- [ ] Skip rate limit pour endpoints publics non-sensibles (`/me`, `/sessions`)
- [ ] Erreur 429 retourne format standard + Retry-After
- [ ] Logs Pino : auth rate limit hit (level warn) + IP + user_id si dispo
- [ ] Tests : 6e signin meme minute -> 429, reset apres 60s

**Fichiers crees / modifies** :
```
repo/apps/api/src/modules/auth/auth.controller.ts                 # update : @Throttle decorators
repo/apps/api/src/modules/auth/throttler/auth-throttler.config.ts  # custom tracker
```

**Criteres validation** :
- V1 (P0) : 5 signin / minute OK, 6e -> 429
- V2 (P0) : 3 signup / heure OK, 4e -> 429
- V3 (P0) : 3 forgot-password / heure OK, 4e -> 429
- V4 (P0) : Refresh 30/min permis (legit cas frequents)
- V5 (P0) : Retry-After header retourne
- V6 (P0) : Logs warn emit
- V7 (P0) : Tests E2E rate limit auth

---

## Tache 2.1.15 -- Tests E2E Auth Complets (15+ Scenarios)

**Metadonnees** : Phase 2 / Sprint 5 / P0 / 8h / Depend de 2.1.14

**But** : Suite tests E2E Playwright validant tous les flows auth en bout-en-bout.

**Livrables checkables** :
- [ ] Suite tests `repo/e2e/api/auth/` (project api Playwright)
- [ ] Test 1 : `signup-happy-path.spec.ts` -- signup + verify-email + signin -> tokens recus
- [ ] Test 2 : `signup-password-policy.spec.ts` -- weak password rejected
- [ ] Test 3 : `signup-duplicate-email.spec.ts` -- meme reponse anti-enumeration
- [ ] Test 4 : `signin-invalid-credentials.spec.ts` -- mauvais password 401
- [ ] Test 5 : `signin-account-locked.spec.ts` -- 5 fails -> lock
- [ ] Test 6 : `signin-email-not-verified.spec.ts` -- avant verify -> 401
- [ ] Test 7 : `mfa-setup-flow.spec.ts` -- setup + confirm + signin avec TOTP
- [ ] Test 8 : `mfa-recovery-code.spec.ts` -- signin avec recovery code one-time
- [ ] Test 9 : `password-reset-flow.spec.ts` -- forgot + reset + signin avec new password
- [ ] Test 10 : `refresh-token-rotation.spec.ts` -- refresh + ancien token invalide
- [ ] Test 11 : `refresh-token-reuse-detection.spec.ts` -- reuse old refresh -> revoke family
- [ ] Test 12 : `signout-all.spec.ts` -- signout-all + tous tokens user invalides
- [ ] Test 13 : `rate-limiting-signin.spec.ts` -- 6 signin / min -> 429
- [ ] Test 14 : `me-endpoint.spec.ts` -- GET /me valid + invalid token
- [ ] Test 15 : `sessions-list.spec.ts` -- liste sessions actives apres multi-login
- [ ] Tests utilisent Mailhog API pour verifier emails recus
- [ ] Tests utilisent Redis directement pour verifier sessions
- [ ] Coverage : tous endpoints auth testes par au moins 1 scenario
- [ ] Tests passent localement + CI

**Fichiers crees / modifies** :
```
repo/e2e/api/auth/{15 .spec.ts}                                  # ~80 lignes chacun
repo/e2e/api/auth/fixtures/auth-helpers.ts                        # helpers (createTestUser, etc.)
repo/e2e/api/auth/fixtures/mailhog-client.ts                       # client Mailhog API
```

**Notes implementation** :
- Helpers : `createTestUser({ withMfa: true })`, `getEmailFromMailhog(email)` factorise setup
- Mailhog API : `GET http://localhost:8025/api/v2/messages` filter par To
- Reset DB before each test : TRUNCATE auth_users + auth_sessions + Redis FLUSHDB
- Tests parallel safe : chaque test cree user unique (UUID dans email)

**Criteres validation** :
- V1 (P0) : 15 tests presents
- V2 (P0) : Tous tests passent localement
- V3 (P0) : Tous tests passent CI
- V4 (P0) : Mailhog integration fonctionne
- V5 (P0) : Coverage : tous endpoints auth testes
- V6 (P1) : Reproducibility : run 5 fois consecutif passe

---

## Sortie du Sprint 5

A la fin de l'execution des 15 taches :

```
Authentication system fully operational :
  - 9 endpoints REST (/signup, /signin, /signout, /signout-all, /refresh, /me, /sessions, /verify-email, /resend-verification, /forgot-password, /reset-password, /setup-mfa, /confirm-mfa, /verify-mfa, /disable-mfa)
  - Argon2id durci OWASP 2024
  - JWT HS256 + rotation + family detection vol
  - MFA TOTP RFC 6238 + 6 recovery codes
  - Email verification + password reset + account recovery
  - Lockout 5 fails -> 30min, backoff exponential
  - Rate limiting auth-specific
  - Email service Nodemailer + 15 templates 3 locales

Events Kafka publies :
  - auth.user_signed_up, signed_in, signed_out
  - auth.password_changed, mfa_setup, mfa_disabled
  - auth.account_locked, role_changed

Audit log :
  - Toute operation auth tracee
  - retention 7 ans

Tests :
  - 15+ tests E2E exhaustifs
```

**Sprint 6 demarre avec** :
- User authentifie identifie via JWT
- AuthContext disponible dans RequestContext (utilise pour tenant resolution)
- 12 roles enum disponible (Sprint 7 RBAC enrichira permissions)

---

## Specifications Format Tache (pour Generation par Cowork)

Cowork genere `task-2.1.X-*.md` dans `00-pilotage/prompts-taches/sprint-05-auth-foundations/` selon format Option B : Metadonnees / But / Contexte / Livrables / Fichiers / Notes / Criteres.

**Patterns code inline conserves** : JwtPayload structure, params Argon2 OWASP, AES-GCM encrypt/decrypt, refresh token family detection, signin flow orchestration, MFA TOTP setup, signup flow.

**Reference complete** : `00-pilotage/documentation/8-skalean-insurtech-prompt-master.md` couvre les 12 roles + matrice permissions (Sprint 7 implementera RBAC).

---

**Fin du meta-prompt B-05 v2.2 format Option B.**
