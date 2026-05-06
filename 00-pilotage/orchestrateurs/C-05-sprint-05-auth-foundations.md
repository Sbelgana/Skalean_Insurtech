# ORCHESTRATEUR SPRINT 5 -- Phase 2 / Sprint 1 : Auth Foundations (argon2id + JWT + MFA)
# 15 taches sequentielles + verification finale
# AUCUNE EMOJI AUTORISEE

**Version** : v2.2 (Option B detaillee)
**Phase** : 2 -- Securite
**Sprint** : 5 / 35 (cumul) -- Sprint 1 dans Phase 2
**Reference meta-prompt** : `B-05-sprint-05-auth-foundations.md`
**Reference verification** : `V-05-sprint-05-verification.md`
**Numerotation taches** : 2.1.1 a 2.1.15
**Effort total** : ~80 heures developpement / 2 semaines
**Apport metier** : Auth complete (argon2id + JWT + MFA + sessions)

---

Tu es **Claude Code (ou Cowork)**. Tu dois executer **TOUTES les 15 taches** du Sprint 5 **UNE PAR UNE** dans l'ordre defini ci-dessous, puis lancer la verification automatique du sprint.

**Cet orchestrateur extrait le contenu detaille de chaque tache depuis B-05** -- pour code complet, patterns critiques et tests exhaustifs, lire le meta-prompt B-05 reference dans chaque tache.

---

## OBJECTIF DU SPRINT 5

Sprint 5 (2.1) -- Auth Foundations (argon2id + JWT + MFA). Voir B-05-sprint-05-auth-foundations.md pour contexte detaille.

---

## STRUCTURE DES FICHIERS

**Prompts des taches** (a executer en sequence) :
```
skalean-insurtech/00-pilotage/prompts-taches/sprint-05-auth-foundations/
  task-2.1.1-prompt.md       # Init @insurtech/auth Package
  task-2.1.2-prompt.md       # Argon2id Service : Hash + Verify + Password Policies
  task-2.1.3-prompt.md       # Crypto Services : AES-GCM (MFA Secret) + SHA-256 (Refresh Tokens)
  task-2.1.4-prompt.md       # JWT Service : Sign + Verify Access/Refresh + Rotation
  task-2.1.5-prompt.md       # Session Service : Redis Storage + Lookup + Revocation
  task-2.1.6-prompt.md       # AuthModule + AuthController + AuthService + JWT Strategy + JwtAuthGuard
  task-2.1.7-prompt.md       # MFA Service : TOTP RFC 6238 + QR + Recovery Codes
  task-2.1.8-prompt.md       # MFA Required Guard + Endpoints
  task-2.1.9-prompt.md       # Signup Flow + Email Verification
  task-2.1.10-prompt.md       # Lockout Service (Anti Brute Force)
  task-2.1.11-prompt.md       # Account Recovery Service
  task-2.1.12-prompt.md       # Audit Auth Service
  task-2.1.13-prompt.md       # Email Service : Nodemailer + Handlebars
  task-2.1.14-prompt.md       # Rate Limiting Auth-Specifique
  task-2.1.15-prompt.md       # Tests E2E Auth Complets (15+ Scenarios)
```

**Verification du sprint** (a lancer APRES toutes les taches) :
```
skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-05-sprint-05-verification.md
```

**Code source modifie** : `skalean-insurtech/repo/` (jamais 00-pilotage/)

**Decisions strategiques applicables** : voir `00-pilotage/decisions/001-010-*.md`

---

## REGLES D'EXECUTION CRITIQUES

### Execution sequentielle obligatoire

Tu DOIS attendre qu'une tache soit COMPLETEMENT TERMINEE avant de demarrer la suivante :
1. **Lire** le fichier prompt de la tache
2. **Implementer** TOUT le code demande dans `repo/`
3. **Compiler** (`pnpm tsc --noEmit` -- 0 erreur)
4. **Tester** (`pnpm vitest run` -- tous tests PASS)
5. **Linter** (`pnpm lint` -- 0 erreur)
6. **Commit** Conventional Commits (`git add -A && git commit`)
7. **SEULEMENT APRES** le commit, passer a la tache suivante

Raison : les taches ont des **dependances** entre elles. La tache N peut importer du code cree par la tache N-1. Executer en parallele creerait des conflits irreconciliables.

### Si une tache echoue

1. Tente de **reparer l'erreur** (3 tentatives maximum)
2. Si impossible, **note l'erreur** dans le rapport et **passe** a la tache suivante
3. **N'arrete JAMAIS** l'execution du sprint entier -- continue les taches restantes
4. La verification finale V-05 identifiera taches FAIL pour reprise ciblee

### Verification finale automatique

APRES avoir execute les 15 taches et commite chacune :
```bash
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-05-sprint-05-verification.md
```
Puis tu **executes CHAQUE section** du fichier de verification (commandes bash + checks automatiques).

---

## REGLES ABSOLUES skalean-insurtech (a appliquer dans CHAQUE tache)

### Conventions techniques

- **Multi-tenant** : CHAQUE query DB filtre par `tenant_id` automatique (Subscriber + RLS) + header `x-tenant-id` obligatoire sauf `/api/v1/public/*` et `/api/v1/admin/*`
- **Validation** : Zod uniquement (JAMAIS class-validator)
- **Logger** : Pino via `this.logger` (JAMAIS `console.log`, JAMAIS `new Logger()`)
- **Events** : Kafka sur `insurtech.events.{vertical}.{entity}.{action}` pour chaque action metier
- **RBAC** : `@Roles()` + `RolesGuard` + `TenantGuard` sur chaque endpoint
- **Tests** : Vitest, chaque fichier `.ts` a un fichier `.spec.ts` (coverage >= 85% global, 90% modules critiques)
- **Types** : TypeScript strict, **AUCUN `any` implicite**, `noUncheckedIndexedAccess: true`
- **Hash password** : argon2id (JAMAIS bcrypt, JAMAIS scrypt)
- **JWT** : RS256 + key rotation 90 jours
- **Encryption at rest** : AES-256-GCM (Atlas Cloud Services KMS)
- **Package manager** : pnpm (JAMAIS npm ou yarn)
- **Imports** : `@insurtech/*` pour packages partages
- **Skalean AI** : utilise UNIQUEMENT via `@insurtech/sky` ou MCP client (JAMAIS de duplication LLM/RAG/vector store)
- **AUCUNE EMOJI** dans le code, commentaires ou logs (decision-006 ABSOLUE)
- **Idempotency-Key** : header obligatoire pour mutations + tools MCP write
- **Conventional Commits** : tous commits suivent `<type>(scope): description`

### Conformite InsurTech Maroc (9 lois MA)

- **Audit ACAPS** : chaque ecriture sur `insure_*`, `repair_*`, `pay_*` declenche entree dans `compliance_acaps_audits` (10 ans retention)
- **Donnees Maroc** (loi 09-08 CNDP) : aucune donnee assure/police/sinistre/paiement ne transite hors **Atlas Cloud Services Benguerir** (decision-008 -- DC1 Tier III + DC2 Tier IV)
- **Multilinguisme** : toute communication assure (notifications/emails/WhatsApp/Sky) supporte fr/ar-MA (darija)/ar (classique)/en
- **Conformite loi 43-20** : signatures electroniques utilisent uniquement `@insurtech/signature` (Barid eSign + ANRT TSA RFC 3161 + archivage 10 ans)
- **Conformite loi 17-99 article 9** : droit retract 30j B2C tracable (Sprint 15 cancellation_legal_basis)
- **Conformite loi 9-88** : ecritures comptables CGNC plan + SAFT-MA export DGI
- **Conformite loi 43-05** : AML monitoring + SAR generation AMC
- **TVA MA** : 5 taux (0/7/10/14/20%) -- Sprint 12
- **CNSS** : 4.48% + **AMO** : 2.26% -- Sprint 13 paie
- **BAM** : limit 100k MAD + 3D Secure obligatoire (Sprint 11)
- **Notification breach** : sous 72h CNDP + Atlas Cloud Services SOC

---

## CONTEXTE PHASE 2 -- Securite

### Position du Sprint 1 dans la Phase 2

Sprint 5 (2.1) -- **Auth Foundations (argon2id + JWT + MFA)**.

Voir `B-05-sprint-05-auth-foundations.md` (section "POSITION DANS LA PHASE" + "DEPENDANCES") pour contexte detaille des dependances cross-sprints (entrees consommees + sorties produites).

### Modules concernes par cette Phase

@insurtech/auth, @insurtech/database (RLS), apps/api (Sprint 5+6+7)

### Apport metier de ce sprint

Auth complete (argon2id + JWT + MFA + sessions)

### Decisions strategiques applicables

Cf. `00-pilotage/decisions/`. Decisions cles pour ce sprint : voir B-05 section "Decisions strategiques applicables".

---

## EXECUTION SEQUENTIELLE DES 15 TACHES

Chaque tache ci-dessous indique : metadata (priorite/effort/deps), but extrait de B-05, actions principales (livrables checkables), fichiers cibles, criteres P0, validation et commit.

**Pour code complet, patterns critiques, tests exhaustifs** : lire le prompt tache detaille genere depuis B-05.

---

### Tache 1 / 15 : Init @insurtech/auth Package

**Metadonnees** : P0 | 4h | Depend de : Depend de Sprint 4

**But** : Initialiser le package `@insurtech/auth` avec types TypeScript, schemas Zod, constants, et squelette module NestJS.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-05-auth-foundations/task-2.1.1-prompt.md
```

**Actions principales attendues** :
- Package `repo/packages/auth/` setup (extends Sprint 1 stub)
- `src/types/auth-context.ts` -- interfaces : `AuthContext` (user + tenant + permissions + mfa_verified), `AuthenticatedUser`, `JwtPayload`, `RefreshTokenPayload`
- `src/types/auth-roles.ts` -- enum `AuthRole` avec 12 roles documentes (super_admin_platform, analyst_support, broker_admin, broker_user, broker_assistant, garage_admin, garage_chef, garage_technici...
- `src/schemas/signup.schema.ts` -- Zod schema (email + password + display_name + locale)
- `src/schemas/signin.schema.ts` -- Zod (email + password + remember_me)
- `src/schemas/mfa.schema.ts` -- Zod (totp_code 6 digits + recovery_code optionnel)

**Fichiers cibles principaux** :
  - `repo/packages/auth/package.json`
  - `repo/packages/auth/tsconfig.json`
  - `repo/packages/auth/src/types/auth-context.ts`
  - `repo/packages/auth/src/types/auth-roles.ts`
  - `repo/packages/auth/src/schemas/{5 schemas .ts}`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Package build reussit
  - V2 (P0) : 12 roles enum accessible
  - V3 (P0) : 5 schemas Zod presents et testes

**Validation** :
```bash
cd repo
pnpm tsc --noEmit                    # Typecheck strict
pnpm vitest run --coverage           # Tests unitaires + coverage
pnpm lint                            # Biome lint + format check
cd ..
```

**Commit** :
```bash
git add -A
git commit -m "feat(sprint-05): init @insurtech/auth package

Task: 2.1.1
Sprint: 5 (Phase 2 / Sprint 1)
Phase: 2 -- Securite
Decisions: see B-05 Tache 2.1.1"
```

---

### Tache 2 / 15 : Argon2id Service : Hash + Verify + Password Policies

**Metadonnees** : P0 | 5h | Depend de : Depend de 2.1.1

**But** : Service NestJS `Argon2Service` avec hash + verify mots de passe utilisant Argon2id (winner Password Hashing Competition 2015), parametres durcis OWASP 2024.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-05-auth-foundations/task-2.1.2-prompt.md
```

**Actions principales attendues** :
- Service `repo/packages/auth/src/services/argon2.service.ts`
- Method `hash(password: string): Promise<string>` -- retourne string format Argon2 standard
- Method `verify(hash: string, password: string): Promise<boolean>` -- comparison constant-time
- Method `needsRehash(hash: string): boolean` -- detect si hash genere avec params plus faibles -> rehash on next login
- Method `validatePolicy(password: string): { valid: boolean; reasons?: string[] }` :
- Banlist chargee depuis `data/banned-passwords.json` au boot (Set in-memory)

**Fichiers cibles principaux** :
  - `repo/packages/auth/src/services/argon2.service.ts`
  - `repo/packages/auth/src/services/argon2.service.spec.ts`
  - `repo/packages/auth/src/data/banned-passwords.json`
  - `repo/packages/auth/package.json`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : `hash(password)` retourne string format Argon2
  - V2 (P0) : `verify(hash, password)` retourne true si match, false sinon
  - V3 (P0) : `verify` constant-time (pas de timing attack)

**Validation** :
```bash
cd repo
pnpm tsc --noEmit                    # Typecheck strict
pnpm vitest run --coverage           # Tests unitaires + coverage
pnpm lint                            # Biome lint + format check
cd ..
```

**Commit** :
```bash
git add -A
git commit -m "feat(sprint-05): argon2id service : hash + verify + password policies

Task: 2.1.2
Sprint: 5 (Phase 2 / Sprint 1)
Phase: 2 -- Securite
Decisions: see B-05 Tache 2.1.2"
```

---

### Tache 3 / 15 : Crypto Services : AES-GCM (MFA Secret) + SHA-256 (Refresh Tokens)

**Metadonnees** : P0 | 5h | Depend de : Depend de 2.1.2

**But** : 2 services crypto utilises plus tard : `EncryptionService` (AES-256-GCM symetrique pour MFA secret stocke en DB) + `HashingService` (SHA-256 hash refresh tokens stockes en Redis).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-05-auth-foundations/task-2.1.3-prompt.md
```

**Actions principales attendues** :
- Service `repo/packages/auth/src/services/encryption.service.ts` (AES-256-GCM)
- Methods : `encrypt(plaintext: string): string` (retourne base64 `iv:ciphertext:authTag`), `decrypt(encrypted: string): string`
- Cle depuis env `MFA_SECRET_ENCRYPTION_KEY` (32 bytes minimum)
- IV genere aleatoire 12 bytes per encryption (NEVER reuse IV with same key)
- AuthTag verifie a decryption (integrite)
- Service `repo/packages/auth/src/services/hashing.service.ts` (SHA-256 + HMAC)

**Fichiers cibles principaux** :
  - `repo/packages/auth/src/services/encryption.service.ts`
  - `repo/packages/auth/src/services/encryption.service.spec.ts`
  - `repo/packages/auth/src/services/hashing.service.ts`
  - `repo/packages/auth/src/services/hashing.service.spec.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : `encrypt(plaintext)` retourne string format `iv:ct:tag`
  - V2 (P0) : `decrypt(encrypt(x))` retourne x
  - V3 (P0) : 2 calls `encrypt(same plaintext)` produisent 2 ciphertexts differents (IV unique)

**Validation** :
```bash
cd repo
pnpm tsc --noEmit                    # Typecheck strict
pnpm vitest run --coverage           # Tests unitaires + coverage
pnpm lint                            # Biome lint + format check
cd ..
```

**Commit** :
```bash
git add -A
git commit -m "feat(sprint-05): crypto services : aes-gcm (mfa secret) + sha-256 (refresh tokens)

Task: 2.1.3
Sprint: 5 (Phase 2 / Sprint 1)
Phase: 2 -- Securite
Decisions: see B-05 Tache 2.1.3"
```

---

### Tache 4 / 15 : JWT Service : Sign + Verify Access/Refresh + Rotation

**Metadonnees** : P0 | 6h | Depend de : Depend de 2.1.3

**But** : Service NestJS pour signer et verifier JWT (access + refresh tokens) avec rotation et detection vol (token family pattern).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-05-auth-foundations/task-2.1.4-prompt.md
```

**Actions principales attendues** :
- Service `repo/packages/auth/src/services/jwt.service.ts`
- Method `signAccessToken(payload: JwtPayload): string` -- TTL 15min, algo HS256
- Method `signRefreshToken(payload: RefreshTokenPayload): string` -- TTL 30 jours, algo HS256, secret different
- Method `verifyAccessToken(token: string): JwtPayload` -- throws si invalide ou expire
- Method `verifyRefreshToken(token: string): RefreshTokenPayload` -- throws si invalide
- Method `decode(token: string): JwtPayload | null` -- decode SANS verifier (pour debug)

**Fichiers cibles principaux** :
  - `repo/packages/auth/src/services/jwt.service.ts`
  - `repo/packages/auth/src/services/jwt.service.spec.ts`
  - `repo/packages/auth/src/errors/token-errors.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : `signAccessToken(payload)` retourne JWT 3 parties dot-separated
  - V2 (P0) : `verifyAccessToken(signedToken)` retourne payload original
  - V3 (P0) : Token expired throw `TokenExpiredError`

**Validation** :
```bash
cd repo
pnpm tsc --noEmit                    # Typecheck strict
pnpm vitest run --coverage           # Tests unitaires + coverage
pnpm lint                            # Biome lint + format check
cd ..
```

**Commit** :
```bash
git add -A
git commit -m "feat(sprint-05): jwt service : sign + verify access/refresh + rotation

Task: 2.1.4
Sprint: 5 (Phase 2 / Sprint 1)
Phase: 2 -- Securite
Decisions: see B-05 Tache 2.1.4"
```

---

### Tache 5 / 15 : Session Service : Redis Storage + Lookup + Revocation

**Metadonnees** : P0 | 5h | Depend de : Depend de 2.1.4

**But** : Service `SessionService` qui gere les sessions (refresh tokens) en Redis (DB 1 SESSIONS) avec lookup par jti et revocation par jti / by user / by family.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-05-auth-foundations/task-2.1.5-prompt.md
```

**Actions principales attendues** :
- Service `repo/packages/auth/src/services/session.service.ts`
- Method `createSession(userId, refreshTokenJti, family, metadata): Promise<void>` -- stocke en Redis avec TTL = JWT_REFRESH_TTL
- Method `getSession(jti): Promise<SessionRecord | null>` -- lookup
- Method `revokeSession(jti): Promise<void>` -- delete + add to blacklist (TTL = remaining lifetime)
- Method `revokeUserSessions(userId): Promise<void>` -- revoke ALL sessions of a user (logout-everywhere)
- Method `revokeFamily(family): Promise<void>` -- detection vol -> revoke whole family

**Fichiers cibles principaux** :
  - `repo/packages/auth/src/services/session.service.ts`
  - `repo/packages/auth/src/services/session.service.spec.ts`
  - `repo/packages/auth/src/types/session-record.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : `createSession` stocke en Redis + DB
  - V2 (P0) : `getSession(jti)` retourne SessionRecord
  - V3 (P0) : `revokeSession(jti)` : session inaccessible + blacklist set

**Validation** :
```bash
cd repo
pnpm tsc --noEmit                    # Typecheck strict
pnpm vitest run --coverage           # Tests unitaires + coverage
pnpm lint                            # Biome lint + format check
cd ..
```

**Commit** :
```bash
git add -A
git commit -m "feat(sprint-05): session service : redis storage + lookup + revocation

Task: 2.1.5
Sprint: 5 (Phase 2 / Sprint 1)
Phase: 2 -- Securite
Decisions: see B-05 Tache 2.1.5"
```

---

### Tache 6 / 15 : AuthModule + AuthController + AuthService + JWT Strategy + JwtAuthGuard

**Metadonnees** : P0 | 7h | Depend de : Depend de 2.1.5

**But** : Glue NestJS exposant endpoints REST (`/api/v1/auth/*`) qui orchestrent les services (Argon2, JWT, Session) pour signin/signout/refresh/me.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-05-auth-foundations/task-2.1.6-prompt.md
```

**Actions principales attendues** :
- Module `repo/apps/api/src/modules/auth/auth.module.ts` import AuthService + Controller + Strategies
- Controller `auth.controller.ts` avec endpoints :
- Service `auth.service.ts` orchestrant :
- JWT Strategy `jwt.strategy.ts` (passport-jwt) :
- Guard `jwt-auth.guard.ts` extends AuthGuard('jwt') :
- Decorator `@CurrentUser()` extract user depuis request

**Fichiers cibles principaux** :
  - `repo/apps/api/src/modules/auth/auth.module.ts`
  - `repo/apps/api/src/modules/auth/auth.controller.ts`
  - `repo/apps/api/src/modules/auth/auth.service.ts`
  - `repo/apps/api/src/modules/auth/strategies/jwt.strategy.ts`
  - `repo/apps/api/src/modules/auth/guards/jwt-auth.guard.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : POST /signin avec creds valides retourne tokens + user
  - V2 (P0) : POST /signin avec mauvais password retourne 401 INVALID_CREDENTIALS
  - V3 (P0) : POST /signin avec compte locke retourne 401 ACCOUNT_LOCKED

**Validation** :
```bash
cd repo
pnpm tsc --noEmit                    # Typecheck strict
pnpm vitest run --coverage           # Tests unitaires + coverage
pnpm lint                            # Biome lint + format check
cd ..
```

**Commit** :
```bash
git add -A
git commit -m "feat(sprint-05): authmodule + authcontroller + authservice + jwt strategy + jwtaut

Task: 2.1.6
Sprint: 5 (Phase 2 / Sprint 1)
Phase: 2 -- Securite
Decisions: see B-05 Tache 2.1.6"
```

---

### Tache 7 / 15 : MFA Service : TOTP RFC 6238 + QR + Recovery Codes

**Metadonnees** : P0 | 6h | Depend de : Depend de 2.1.6

**But** : Service MFA complete : generation secret TOTP + QR code + verify code + 6 recovery codes (one-time use) genere a setup.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-05-auth-foundations/task-2.1.7-prompt.md
```

**Actions principales attendues** :
- Service `repo/packages/auth/src/services/mfa.service.ts`
- Method `generateSecret(): { secret: string, qrCode: string, otpauthUrl: string }` :
- Method `verifyToken(secret: string, token: string): boolean` -- accepte +/- 1 window (60s tolerance clock skew)
- Method `generateRecoveryCodes(count: number = 6): string[]` -- format `XXXX-XXXX-XXXX` (12 chars 36-base)
- Method `hashRecoveryCodes(codes: string[]): string[]` -- argon2 hash chaque code (one-time use)
- Method `verifyRecoveryCode(hashes: string[], code: string): { valid: boolean, indexUsed?: number }` -- compare + indique index utilise pour invalidation

**Fichiers cibles principaux** :
  - `repo/packages/auth/src/services/mfa.service.ts`
  - `repo/packages/auth/src/services/mfa.service.spec.ts`
  - `repo/packages/auth/package.json`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : `generateSecret(email)` retourne `{ secret, qrCode, otpauthUrl }`
  - V2 (P0) : `verifyToken(secret, token)` retourne true si token valide
  - V3 (P0) : Token genere avec autre secret rejete

**Validation** :
```bash
cd repo
pnpm tsc --noEmit                    # Typecheck strict
pnpm vitest run --coverage           # Tests unitaires + coverage
pnpm lint                            # Biome lint + format check
cd ..
```

**Commit** :
```bash
git add -A
git commit -m "feat(sprint-05): mfa service : totp rfc 6238 + qr + recovery codes

Task: 2.1.7
Sprint: 5 (Phase 2 / Sprint 1)
Phase: 2 -- Securite
Decisions: see B-05 Tache 2.1.7"
```

---

### Tache 8 / 15 : MFA Required Guard + Endpoints

**Metadonnees** : P0 | 5h | Depend de : Depend de 2.1.7

**But** : Endpoints `/setup-mfa`, `/verify-mfa`, `/disable-mfa` + Guard `MfaRequiredGuard` qui force MFA pour roles privileges (super_admin_platform).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-05-auth-foundations/task-2.1.8-prompt.md
```

**Actions principales attendues** :
- Endpoints AuthController :
- Guard `MfaRequiredGuard` :
- Decorator `@RequireMfa()` -- explicite force MFA sur endpoint
- Setup MFA workflow :
- Signin avec MFA workflow :
- mfa_challenge_token : JWT TTL 5min, claim `mfa_pending: true`

**Fichiers cibles principaux** :
  - `repo/apps/api/src/modules/auth/auth.controller.ts`
  - `repo/apps/api/src/modules/auth/auth.service.ts`
  - `repo/apps/api/src/modules/auth/guards/mfa-required.guard.ts`
  - `repo/apps/api/src/modules/auth/decorators/require-mfa.decorator.ts`
  - `repo/apps/api/test/auth-mfa.e2e-spec.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : POST /setup-mfa retourne secret + QR + 6 recovery codes
  - V2 (P0) : POST /confirm-mfa avec TOTP valide active mfa_enabled
  - V3 (P0) : Apres confirm-mfa, force re-login (sessions revoked)

**Validation** :
```bash
cd repo
pnpm tsc --noEmit                    # Typecheck strict
pnpm vitest run --coverage           # Tests unitaires + coverage
pnpm lint                            # Biome lint + format check
cd ..
```

**Commit** :
```bash
git add -A
git commit -m "feat(sprint-05): mfa required guard + endpoints

Task: 2.1.8
Sprint: 5 (Phase 2 / Sprint 1)
Phase: 2 -- Securite
Decisions: see B-05 Tache 2.1.8"
```

---

### Tache 9 / 15 : Signup Flow + Email Verification

**Metadonnees** : P0 | 5h | Depend de : Depend de 2.1.8

**But** : Endpoints `/signup` + `/verify-email` + flow complete avec token verification email + double-opt-in.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-05-auth-foundations/task-2.1.9-prompt.md
```

**Actions principales attendues** :
- Endpoint `POST /api/v1/auth/signup` (public) :
- Endpoint `GET /api/v1/auth/verify-email?token=xxx` (public) :
- Endpoint `POST /api/v1/auth/resend-verification` (public, rate limited) :
- Migration TypeORM : table `auth_email_verifications` (id, user_id FK, token_hash UNIQUE, expires_at, created_at)
- Tests E2E : signup + verify-email + signin (ne marche que apres verify) + resend
- Audit log + Kafka events publies

**Fichiers cibles principaux** :
  - `repo/apps/api/src/modules/auth/auth.controller.ts`
  - `repo/apps/api/src/modules/auth/auth.service.ts`
  - `repo/packages/database/src/migrations/{date}-EmailVerifications.ts`
  - `repo/packages/database/src/entities/system/auth-email-verification.entity.ts`
  - `repo/apps/api/test/auth-signup.e2e-spec.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : POST /signup avec data valide cree user (email_verified_at NULL)
  - V2 (P0) : Email verification envoye
  - V3 (P0) : POST /signup email duplique retourne meme reponse (anti-enumeration)

**Validation** :
```bash
cd repo
pnpm tsc --noEmit                    # Typecheck strict
pnpm vitest run --coverage           # Tests unitaires + coverage
pnpm lint                            # Biome lint + format check
cd ..
```

**Commit** :
```bash
git add -A
git commit -m "feat(sprint-05): signup flow + email verification

Task: 2.1.9
Sprint: 5 (Phase 2 / Sprint 1)
Phase: 2 -- Securite
Decisions: see B-05 Tache 2.1.9"
```

---

### Tache 10 / 15 : Lockout Service (Anti Brute Force)

**Metadonnees** : P0 | 4h | Depend de : Depend de 2.1.9

**But** : Compte temporairement bloque apres N tentatives failed login (anti brute force) avec backoff exponential.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-05-auth-foundations/task-2.1.10-prompt.md
```

**Actions principales attendues** :
- Service `repo/packages/auth/src/services/lockout.service.ts`
- Strategy : 5 echecs successifs en 15min -> lock 30min ; reset compteur a chaque succes
- Method `recordFailedAttempt(userId: string, ip: string): Promise<{ locked: boolean, retryAfter?: Date }>`
- Method `recordSuccess(userId: string): Promise<void>` -- reset compteur
- Method `isLocked(userId: string): Promise<{ locked: boolean, retryAfter?: Date }>`
- Stockage : column `auth_users.failed_login_attempts` (int) + `auth_users.locked_until` (timestamptz NULL)

**Fichiers cibles principaux** :
  - `repo/packages/auth/src/services/lockout.service.ts`
  - `repo/packages/auth/src/services/lockout.service.spec.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 5 fails consecutifs -> lock 30min
  - V2 (P0) : 6e tentative pendant lock rejette + retourne retryAfter
  - V3 (P0) : Succes reset compteur

**Validation** :
```bash
cd repo
pnpm tsc --noEmit                    # Typecheck strict
pnpm vitest run --coverage           # Tests unitaires + coverage
pnpm lint                            # Biome lint + format check
cd ..
```

**Commit** :
```bash
git add -A
git commit -m "feat(sprint-05): lockout service (anti brute force)

Task: 2.1.10
Sprint: 5 (Phase 2 / Sprint 1)
Phase: 2 -- Securite
Decisions: see B-05 Tache 2.1.10"
```

---

### Tache 11 / 15 : Account Recovery Service

**Metadonnees** : P0 | 5h | Depend de : Depend de 2.1.10

**But** : Flow complete account recovery : forgot password + reset password via email token.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-05-auth-foundations/task-2.1.11-prompt.md
```

**Actions principales attendues** :
- Endpoint `POST /api/v1/auth/forgot-password` (public, rate limited) :
- Endpoint `POST /api/v1/auth/reset-password` (public) :
- Migration TypeORM table `auth_password_recoveries` (id, user_id, token_hash UNIQUE, expires_at, used_at, created_at)
- TTL token recovery : 1 heure (vs 24h email verify -- recovery plus sensible)
- One-time use : `used_at` set apres reset, token invalide ensuite
- Notification email user APRES password change (alerte si pas lui)

**Fichiers cibles principaux** :
  - `repo/apps/api/src/modules/auth/auth.controller.ts`
  - `repo/apps/api/src/modules/auth/auth.service.ts`
  - `repo/packages/database/src/migrations/{date}-PasswordRecoveries.ts`
  - `repo/packages/database/src/entities/system/auth-password-recovery.entity.ts`
  - `repo/apps/api/test/auth-recovery.e2e-spec.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : POST /forgot-password avec email valide envoie email
  - V2 (P0) : POST /forgot-password email inexistant retourne meme reponse
  - V3 (P0) : POST /reset-password token valide + new password reset

**Validation** :
```bash
cd repo
pnpm tsc --noEmit                    # Typecheck strict
pnpm vitest run --coverage           # Tests unitaires + coverage
pnpm lint                            # Biome lint + format check
cd ..
```

**Commit** :
```bash
git add -A
git commit -m "feat(sprint-05): account recovery service

Task: 2.1.11
Sprint: 5 (Phase 2 / Sprint 1)
Phase: 2 -- Securite
Decisions: see B-05 Tache 2.1.11"
```

---

### Tache 12 / 15 : Audit Auth Service

**Metadonnees** : P0 | 4h | Depend de : Depend de 2.1.11

**But** : Service centralise pour logger toutes operations auth dans `audit_log` + publier events Kafka.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-05-auth-foundations/task-2.1.12-prompt.md
```

**Actions principales attendues** :
- Service `repo/apps/api/src/modules/auth/services/audit-auth.service.ts`
- Methods correspondant aux events :
- Chaque method : INSERT row dans audit_log (via subscriber Sprint 2 ou direct) + publish event Kafka correspondant
- Trace ID + correlation ID propages depuis RequestContext (Sprint 3)
- Resource details : user_id, action, IP, UA, method
- Tests : verifier audit_log row + Kafka publish pour chaque method

**Fichiers cibles principaux** :
  - `repo/apps/api/src/modules/auth/services/audit-auth.service.ts`
  - `repo/apps/api/src/modules/auth/services/audit-auth.service.spec.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 9 methods presents
  - V2 (P0) : `logSignin` cree row audit_log
  - V3 (P0) : `logSignin` publish Kafka event

**Validation** :
```bash
cd repo
pnpm tsc --noEmit                    # Typecheck strict
pnpm vitest run --coverage           # Tests unitaires + coverage
pnpm lint                            # Biome lint + format check
cd ..
```

**Commit** :
```bash
git add -A
git commit -m "feat(sprint-05): audit auth service

Task: 2.1.12
Sprint: 5 (Phase 2 / Sprint 1)
Phase: 2 -- Securite
Decisions: see B-05 Tache 2.1.12"
```

---

### Tache 13 / 15 : Email Service : Nodemailer + Handlebars

**Metadonnees** : P0 | 6h | Depend de : Depend de 2.1.12

**But** : Service email NestJS avec templates Handlebars 3 locales (fr / ar-MA / ar) pour emails auth + futurs emails metier.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-05-auth-foundations/task-2.1.13-prompt.md
```

**Actions principales attendues** :
- Service `repo/packages/comm/src/services/email.service.ts` (package comm Sprint 9 anticipe)
- Method `send(to: string, template: string, locale: string, vars: Record<string, unknown>): Promise<void>`
- Templates Handlebars dans `repo/packages/comm/src/templates/{locale}/{template}.hbs` :
- Layout shared `repo/packages/comm/src/templates/_layout.hbs` (header + footer + branding Skalean)
- Nodemailer transport : SMTP (mailhog dev, Mailgun/Sendgrid prod)
- Variables env : `EMAIL_SMTP_HOST/PORT/USER/PASSWORD`, `EMAIL_FROM_NO_REPLY`

**Fichiers cibles principaux** :
  - `repo/packages/comm/src/services/email.service.ts`
  - `repo/packages/comm/src/services/email.service.spec.ts`
  - `repo/packages/comm/src/templates/_layout.hbs`
  - `repo/packages/comm/src/templates/{fr,ar-MA,ar}/{5 templates}.hbs`
  - `repo/packages/comm/package.json`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : `send(to, 'verify-email', 'fr', vars)` envoie email
  - V2 (P0) : Email recu visible dans Mailhog
  - V3 (P0) : Templates 5 emails x 3 locales = 15 templates

**Validation** :
```bash
cd repo
pnpm tsc --noEmit                    # Typecheck strict
pnpm vitest run --coverage           # Tests unitaires + coverage
pnpm lint                            # Biome lint + format check
cd ..
```

**Commit** :
```bash
git add -A
git commit -m "feat(sprint-05): email service : nodemailer + handlebars

Task: 2.1.13
Sprint: 5 (Phase 2 / Sprint 1)
Phase: 2 -- Securite
Decisions: see B-05 Tache 2.1.13"
```

---

### Tache 14 / 15 : Rate Limiting Auth-Specifique

**Metadonnees** : P0 | 3h | Depend de : Depend de 2.1.13

**But** : Override rate limiting global Sprint 3 sur endpoints auth-sensibles (signin, signup, forgot-password, resend-verification).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-05-auth-foundations/task-2.1.14-prompt.md
```

**Actions principales attendues** :
- `@Throttle()` decorator applied per endpoint :
- Custom tracker : par IP + email (combo) pour signin -- evite attacker brute force 1 user x N IPs
- Skip rate limit pour endpoints publics non-sensibles (`/me`, `/sessions`)
- Erreur 429 retourne format standard + Retry-After
- Logs Pino : auth rate limit hit (level warn) + IP + user_id si dispo
- Tests : 6e signin meme minute -> 429, reset apres 60s

**Fichiers cibles principaux** :
  - `repo/apps/api/src/modules/auth/auth.controller.ts`
  - `repo/apps/api/src/modules/auth/throttler/auth-throttler.config.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 5 signin / minute OK, 6e -> 429
  - V2 (P0) : 3 signup / heure OK, 4e -> 429
  - V3 (P0) : 3 forgot-password / heure OK, 4e -> 429

**Validation** :
```bash
cd repo
pnpm tsc --noEmit                    # Typecheck strict
pnpm vitest run --coverage           # Tests unitaires + coverage
pnpm lint                            # Biome lint + format check
cd ..
```

**Commit** :
```bash
git add -A
git commit -m "feat(sprint-05): rate limiting auth-specifique

Task: 2.1.14
Sprint: 5 (Phase 2 / Sprint 1)
Phase: 2 -- Securite
Decisions: see B-05 Tache 2.1.14"
```

---

### Tache 15 / 15 : Tests E2E Auth Complets (15+ Scenarios)

**Metadonnees** : P0 | 8h | Depend de : Depend de 2.1.14

**But** : Suite tests E2E Playwright validant tous les flows auth en bout-en-bout.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-05-auth-foundations/task-2.1.15-prompt.md
```

**Actions principales attendues** :
- Suite tests `repo/e2e/api/auth/` (project api Playwright)
- Test 1 : `signup-happy-path.spec.ts` -- signup + verify-email + signin -> tokens recus
- Test 2 : `signup-password-policy.spec.ts` -- weak password rejected
- Test 3 : `signup-duplicate-email.spec.ts` -- meme reponse anti-enumeration
- Test 4 : `signin-invalid-credentials.spec.ts` -- mauvais password 401
- Test 5 : `signin-account-locked.spec.ts` -- 5 fails -> lock

**Fichiers cibles principaux** :
  - `repo/e2e/api/auth/{15 .spec.ts}`
  - `repo/e2e/api/auth/fixtures/auth-helpers.ts`
  - `repo/e2e/api/auth/fixtures/mailhog-client.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 15 tests presents
  - V2 (P0) : Tous tests passent localement
  - V3 (P0) : Tous tests passent CI

**Validation** :
```bash
cd repo
pnpm tsc --noEmit                    # Typecheck strict
pnpm vitest run --coverage           # Tests unitaires + coverage
pnpm lint                            # Biome lint + format check
cd ..
```

**Commit** :
```bash
git add -A
git commit -m "feat(sprint-05): tests e2e auth complets (15+ scenarios)

Task: 2.1.15
Sprint: 5 (Phase 2 / Sprint 1)
Phase: 2 -- Securite
Decisions: see B-05 Tache 2.1.15"
```

---


## VERIFICATION DU SPRINT 5

Une fois les 15 taches terminees et commitees, **lancer la verification automatique** :

```bash
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-05-sprint-05-verification.md
```

Le fichier de verification V-05 contient :

- **Criteres P0 bloquants** : compilation TypeScript / tests Vitest / Biome lint / no-emoji / conventional commits
- **Criteres P1 avertissements** : couverture >= 85% / dependencies coherentes / docs API / metriques performance
- **Criteres P2 notes** : coverage >= 90% modules critiques / lighthouse score / accessibility
- **Auto-reparation** pour criteres recuperables (e.g. relance tests flaky)
- **Generation automatique** du rapport `sprint05-verify-report.md`
- **Calcul score global** + statut GO / GO CONDITIONNEL / NO-GO

**Score minimum requis pour GO** : >= 95% (sprint termine, GO Sprint suivant)
**Score minimum pour GO CONDITIONNEL** : 85-94% (hot fix requis, retard <= 1 semaine)
**En dessous de 85%** : NO-GO, **reprise sprint requise** (escalation Saad/Abla decision)

Apres execution, lire le rapport :

```bash
cat skalean-insurtech/sprint05-verify-report.md
```

Si statut **GO** ou **GO CONDITIONNEL**, executer le commit de cloture :

```bash
git add skalean-insurtech/sprint05-verify-report.md
git commit -m "chore(sprint-05): close sprint 5 with verification report

- Score global : {SCORE}%
- Statut : {GO|GO CONDITIONNEL}
- Phase : 2 (Securite)
- Sprint : 5 (Phase 2 / Sprint 1)
- Apport : Auth complete (argon2id + JWT + MFA + sessions)
- Tests E2E cumules : {N}+

Sprint 5 completed -- handoff to Sprint 6."
```

---

## RESUME DU WORKFLOW

```
[Demarrage Sprint 5]
   |
   v
[Tache 2.1.1: Init @insurtech/auth Package]
   | -> compile -> tests -> commit
   v
[Tache 2.1.2: Argon2id Service : Hash + Verify + Password Policies]
   | -> compile -> tests -> commit
   v
[Tache 2.1.3: Crypto Services : AES-GCM (MFA Secret) + SHA-256 (Refre]
   | -> compile -> tests -> commit
   v
[Tache 2.1.4: JWT Service : Sign + Verify Access/Refresh + Rotation]
   | -> compile -> tests -> commit
   v
[Tache 2.1.5: Session Service : Redis Storage + Lookup + Revocation]
   | -> compile -> tests -> commit
   v
[Tache 2.1.6: AuthModule + AuthController + AuthService + JWT Strateg]
   | -> compile -> tests -> commit
   v
[Tache 2.1.7: MFA Service : TOTP RFC 6238 + QR + Recovery Codes]
   | -> compile -> tests -> commit
   v
[Tache 2.1.8: MFA Required Guard + Endpoints]
   | -> compile -> tests -> commit
   v
[Tache 2.1.9: Signup Flow + Email Verification]
   | -> compile -> tests -> commit
   v
[Tache 2.1.10: Lockout Service (Anti Brute Force)]
   | -> compile -> tests -> commit
   v
[Tache 2.1.11: Account Recovery Service]
   | -> compile -> tests -> commit
   v
[Tache 2.1.12: Audit Auth Service]
   | -> compile -> tests -> commit
   v
[Tache 2.1.13: Email Service : Nodemailer + Handlebars]
   | -> compile -> tests -> commit
   v
[Tache 2.1.14: Rate Limiting Auth-Specifique]
   | -> compile -> tests -> commit
   v
[Tache 2.1.15: Tests E2E Auth Complets (15+ Scenarios)]
   | -> compile -> tests -> commit
   v
[Verification automatique sprint 5 -- V-05]
   |
   v
[Rapport sprint05-verify-report.md]
   |
   v
[Score >= 95%] -> GO -> commit cloture sprint -> Sprint suivant
[Score 85-94%] -> GO CONDITIONNEL -> hot fix puis cloture
[Score < 85%]  -> NO-GO -> reprise sprint
```

**Duree totale estimee** : 80 heures (5h par tache moyenne -- 2 devs FTE en parallele).

**Modules skalean-insurtech affectes** : @insurtech/auth, @insurtech/database (RLS), apps/api (Sprint 5+6+7)

**Apport metier principal** : Auth complete (argon2id + JWT + MFA + sessions).

**Prerequis Sprint 6** : Sprint 5 GO complet (score >= 95% verification automatique V-05).

**Sprint suivant** : Sprint 6.

---

## COMMANDES DE LANCEMENT

### Prerequis Sprint 4 (verification GO)

```bash
# Verifier Sprint 4 GO
ls skalean-insurtech/sprint04-verify-report.md
grep '^Statut.*GO' skalean-insurtech/sprint04-verify-report.md
```

### Lancement Sprint 5 (Cowork lit cet orchestrateur)

```bash
# Cowork command (claude-code or cowork CLI) :
claude-code \
  --orchestrator skalean-insurtech/00-pilotage/meta-prompts/phase-C-orchestration/C-05-sprint-05-auth-foundations.md \
  --reference-prompt skalean-insurtech/00-pilotage/meta-prompts/phase-B-tasks/B-05-sprint-05-auth-foundations.md \
  --verification skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-05-sprint-05-verification.md
```

### Suivi temps reel execution

```bash
# Tail le log Cowork
tail -f skalean-insurtech/cowork-sprint-05.log

# Verifier progression commits
git log --oneline --since="2 weeks ago" -- repo/ | grep "Sprint: 5"
```

### Apres completion -- verifier rapport

```bash
cat skalean-insurtech/sprint05-verify-report.md
```

---

## NOTES IMPORTANTES POUR COWORK

1. **Lire d'abord B-05** complet avant generation prompts taches (contexte critique)
2. **Generer les 15 prompts taches** dans `00-pilotage/prompts-taches/sprint-05-*/` AVANT de commencer execution
3. **Toujours respecter l'ordre** des taches (dependances explicites)
4. **Commit chaque tache separement** (granularite Git pour rollback facile)
5. **NE JAMAIS modifier `00-pilotage/`** -- uniquement `repo/`
6. **En cas de doute**, escalader Saad/Abla via Slack `#insurtech-dev` plutot que faire choix arbitraire
7. **Documentation continue** : si tu prends une decision technique, ajouter ADR dans `repo/docs/architecture/`

---

**Fin de l'orchestrateur C-05 v2.2 detaille -- Sprint 5 (2.1) Auth Foundations (argon2id + JWT + MFA).**

**Total taches detaillees** : 15 | **Effort cumul** : ~80h | **Apport** : Auth complete (argon2id + JWT + MFA + sessions)
