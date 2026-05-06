# TACHE 2.1.9 -- Signup Flow + Email Verification : Endpoints `/signup`, `/verify-email`, `/resend-verification` + Migration `auth_email_verifications`

**Sprint** : 5 (Phase 2 / Sprint 1 dans phase) -- Auth Foundations
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-05-sprint-05-auth-foundations.md` (Tache 2.1.9)
**Phase** : 2 -- Securite & Multi-tenant
**Priorite** : P0 (bloquant pour 2.1.13 EmailService consume signup, 2.1.15 E2E full lifecycle, Sprint 6 onboarding tenant)
**Effort** : 5h
**Dependances** : 2.1.8 (AuthController etendu), 2.1.6 (AuthService base), 2.1.2 (Argon2Service.hash + validatePolicy), 2.1.3 (HashingService.randomToken + sha256), Sprint 2 (table auth_users)
**Densite cible** : 80-150 ko (auto-suffisant exhaustif)
**AUCUNE EMOJI AUTORISEE**

---

## 1. But

Cette tache vise a livrer le flow d'inscription complet (signup) du programme Skalean InsurTech v2.2 avec verification d'email obligatoire double-opt-in conforme aux exigences RGPD/loi 09-08 article 7 (consentement libre, specifique, eclaire, univoque) et anti-spam best practices industrie 2024-2026. Le perimetre couvre : un endpoint public `POST /api/v1/auth/signup` qui accepte un payload `{ email, password, display_name, locale, accepted_tos, requested_role?, invitation_token? }` (validation Zod via `signupSchema` definie Tache 2.1.1), valide la politique mot de passe via `Argon2Service.validatePolicy` avec contexte email + display_name pour detecter les similarites, hash le mot de passe via `Argon2Service.hash` avec pepper, cree la ligne `auth_users` avec `email_verified_at = NULL` et `is_active = true`, genere un token de verification email cryptographiquement aleatoire 32 bytes via `HashingService.randomToken(32)` qui retourne ~43 caracteres base64url, hash ce token via `HashingService.sha256` avant stockage (defense en profondeur si la table fuite) dans la table `auth_email_verifications` (id UUID PK, user_id FK, token_hash UNIQUE NOT NULL, expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL, consumed_at TIMESTAMPTZ NULL) avec TTL 24 heures, declenche l'envoi d'un email de verification via `EmailService.sendVerification(email, locale, token)` (Tache 2.1.13 implementera l'envoi reel via Nodemailer + templates Handlebars 4 locales) et retourne au client `{ message: 'Verification email sent' }` SANS retourner d'access tokens (le user doit verifier son email avant de pouvoir signin) ; un endpoint public `GET /api/v1/auth/verify-email?token=xxx` qui hash le token presente, lookup la table par hash, verifie non expire et non consumed, met a jour `auth_users.email_verified_at = NOW()` + `auth_email_verifications.consumed_at = NOW()`, publie l'event Kafka `auth.email_verified`, et retourne un redirect HTTP 302 vers `https://{frontend_url}/auth/email-verified?status=success` pour permettre un click direct depuis le mail (UX standard) ; un endpoint public `POST /api/v1/auth/resend-verification` qui accepte `{ email }`, recherche un user non encore verifie, supprime les tokens precedents non consumed (defense contre token accumulation), genere un nouveau token, et envoie un nouvel email -- avec rate limiting strict 3 par heure par email (Tache 2.1.14) pour eviter le spam et l'enumeration ; et la migration TypeORM/Drizzle Sprint 5 qui cree la table `auth_email_verifications` si Sprint 2 ne l'avait pas deja prevue.

L'apport est multiple. Premierement, en imposant la verification d'email avant signin (`auth_users.email_verified_at = NULL` -> AuthService.signin throw `EmailNotVerifiedError`), on garantit que (a) l'adresse email est valide et controlee par l'utilisateur (vs typos qui creent des comptes orphelins inaccessibles), (b) le user a explicitement consenti a la creation de compte (loi 09-08 article 7), (c) l'email est utilisable pour les flows ulterieurs (recovery, MFA challenge fallback, notifications). Deuxiemement, en hashant les tokens de verification SHA-256 avant stockage DB, on protege contre un leak DB seul : un attaquant qui exfiltre la table `auth_email_verifications` ne peut pas verifier des emails arbitrairement car il n'a pas les tokens originaux (entropy 256 bits = brute force impossible). Troisiemement, en repondant identiquement (`{ message: 'Verification email sent' }`) au signup avec email deja existant et au signup avec nouveau email, on previent l'enumeration d'utilisateurs : un attaquant qui tente `POST /signup` avec une liste d'emails ne peut pas distinguer les comptes existants des nouveaux comptes (defense critique contre les attaques credential stuffing en aval). Quatriemement, en generant un token random 32 bytes avec entropie 256 bits, on garantit que la probabilite de collision est negligeable meme a 1 milliard de tokens emis (born d'anniversaire = 2^128).

A l'issue de cette tache, l'API expose le flow signup operationnel : (1) user POST /signup avec email + password + display_name + locale + accepted_tos -> reponse `{ message: 'Verification email sent' }` ; (2) email arrive avec lien `https://api.skalean.ma/api/v1/auth/verify-email?token=xxx` ; (3) user click, GET /verify-email -> `auth_users.email_verified_at = NOW()` + redirect vers `/auth/email-verified` ; (4) user POST /signin avec email + password -> tokens emis (vs 401 EMAIL_NOT_VERIFIED si pas verifie). Anti-enumeration : tentative signup avec email existant retourne meme reponse. Resend rate limited 3/h. Token expire 24h. La suite Vitest + Playwright couvre 25+ scenarios E2E.

---

## 2. Contexte etendu

### 2.1 Pourquoi cette tache existe

Sans flow signup complet, le programme ne peut pas onboarder de nouveaux utilisateurs. Les utilisateurs existants Sprint 2 (seeds via migrations) sont insuffisants pour une production : il faut permettre aux courtiers de creer leur compte, aux assures de s'inscrire, aux garages de s'enrôler. La verification email est une exigence non-negociable pour : (a) loi 09-08 consentement explicite, (b) NIST SP 800-63B Identity Assurance Level 2 (IAL2) qui exige un canal de communication verifie, (c) prevention spam compte fakes qui polluent la base, (d) UX -- l'email est le canal recovery principal Sprint 2.1.11.

L'anti-enumeration est une defense critique. Sans elle, un attaquant qui veut tester si `target@example.com` est inscrit fait `POST /signup` ; si reponse "user exists" -> oui, sinon -> non. Le user enumere obtient une liste de comptes valides qu'il peut ensuite cibler (credential stuffing avec passwords leakes d'autres sites). L'OWASP A07:2021 Identification and Authentication Failures classe cette attaque comme tres frequente.

Le pattern double-opt-in (signup -> email verification -> activation) est l'industry standard depuis 2010. Tous les majeurs (Google, Microsoft, AWS, Stripe) l'utilisent. Single-opt-in (compte actif immediatement apres signup) est utilise par les services low-stake (newsletters) mais inadapte pour un systeme financier comme Skalean InsurTech.

### 2.2 Alternatives considerees

| Alternative | Avantages | Inconvenients | Decision |
|-------------|-----------|---------------|----------|
| Single opt-in (active sans verify) | UX rapide | Spam fakes, no email validation, viole loi 09-08 | REJETE |
| Double opt-in via email link (RETENU) | Standard, eprouve | UX un peu plus lourde | RETENU |
| Triple opt-in (email + sms) | Securite max | UX trop lourde, cout SMS | REJETE Sprint 5 ; Sprint 14 considere SMS optionnel |
| Magic link signin (no password) | UX moderne | Pas conforme exigences ACAPS qui prefere password + MFA | REJETE |
| Token reply-it (envoi 6 digit dans email) | UX similaire SMS OTP | Email moins secure que TOTP | REJETE |
| Token URL-embedded (RETENU) | Standard, click direct | Token visible URL, partager URL = compromis | RETENU avec TTL 24h |
| Token court 8 chars | Memorable | Brute force possible | REJETE (entropy faible) |
| Token long 32 bytes (RETENU) | Entropie 256 bits, brute force impossible | Long URL | RETENU |
| Anti-enumeration : meme reponse signup | Defense user enum | UX confuse pour user qui essaie reset password | RETENU avec UX message explicit Sprint 4 |
| Anti-enumeration : reponse differente | UX clair | Vulnerabilite enumeration | REJETE |
| Pre-fill tenant_id depuis invitation_token | Onboarding broker B2B | Sprint 6 implementera | DEFFERE |
| Email verification GET vs POST | Click direct depuis email | GET non idempotent peut declencher 2x sur preview | RETENU GET avec consumed_at one-shot |

### 2.3 Trade-offs explicites

Choisir un token TTL 24h implique d'accepter qu'un user qui prend 30h pour cliquer doit demander un nouveau token. Trade-off UX/securite : 24h est suffisant pour la majorite des users (98% cliquent dans les 6h selon les stats industrie). Sprint 14 considera prolonger a 7 jours avec confirmation supplementaire.

Choisir GET pour /verify-email implique d'accepter que les preview engines (gmail preview, slack preview) peuvent declencher la verification automatiquement avant que le user ne clique reellement. Mitigation : le token est consumed_at one-shot, donc le second click (legitime user) trouvera token consumed_at -> reponse "already verified". Frontend Sprint 4 detecte ce cas et redirect vers signin avec message "Email already verified".

Choisir d'inclure le token entier dans l'URL (vs token court + lookup) implique d'accepter URLs de ~70 caracteres. Acceptable. Alternative : token court id avec lookup en DB. Mais ajout de la couche complexite sans benefice.

Choisir de hash le token avant stockage DB implique de doubler les operations crypto (sha256 au signup + sha256 au verify). En contrepartie, defense en profondeur. SHA-256 est rapide (~1 us), pas un bottleneck.

### 2.4 Decisions strategiques

- decision-007 (Zod runtime) -- totale.
- decision-013 (Argon2id) -- password hash.
- decision-006 (No-emoji) -- totale.
- decision-008 (Cloud souverain) -- table Atlas DB.
- Loi 09-08 article 7 -- consentement explicite via accepted_tos.
- NIST SP 800-63B IAL2 -- email verification.
- OWASP A07:2021 -- anti-enumeration.

### 2.5 Pieges techniques

1. **Race signup duplicate email.** 2 signups simultanes avec meme email -> premier OK, second contraint UNIQUE -> exception. Solution : transaction Postgres + ON CONFLICT.
2. **Token collision ULID hyper-rare** : entropy 256 bits -> negligeable.
3. **Email avec '+' alias gmail** : email `user+tag@gmail.com` valide (Zod regex Tache 2.1.1).
4. **Email lowercase normalization** : email lowercased au signup (case-insensitive lookup auth_users.email citext Sprint 2).
5. **Token URL encoding** : random base64url ne contient pas `+/=`, URL-safe nativement.
6. **Email send fail apres user create** : transaction Postgres rollback si EmailService throw ; sinon user en limbo. Solution : retry queue Sprint 14 ; Sprint 5 = log error + user manual resend.
7. **Verify-email idempotency** : token consumed_at one-shot ; second call retourne "already verified" sans error.
8. **Resend trop rapide** : rate limit Tache 2.1.14 = 3/h.
9. **Email injection via display_name** : Zod regex display_name autorise uniquement letters + spaces + hyphens.
10. **Token leak via URL referrer** : email client peut transmettre referrer. Mitigation : token TTL 24h + one-shot.
11. **Verify-email avec token deja consumed** : second click ou preview engine -> retourne "already verified".
12. **Locale invalide** : Zod enum reject 400.
13. **accepted_tos = false** : Zod literal(true) reject 400.
14. **Concurrent verify-email** : DB UPDATE conditional.
15. **Storage token_hash collision (impossible mais defense)** : UNIQUE constraint.

---

## 3. Architecture context

### 3.1 Position dans le sprint

Tache 2.1.9 livre les endpoints consommees par : 2.1.11 (Recovery flow utilise verify-email pattern), 2.1.13 (EmailService implementera sendVerification), 2.1.14 (RateLimit applique sur signup + resend), 2.1.15 (E2E full signup -> verify -> signin -> me).

### 3.2 Position dans le programme

- Sprint 6 : invitation_token consume dans signup pour assigner tenant_id automatiquement.
- Sprint 7 : RBAC permission `users.create` requis pour signup admin.
- Sprint 13 : Email templates personnalises par tenant.
- Sprint 33 : pentest review signup flow + anti-enumeration validation.

### 3.3 Diagramme

```
                     +-----------------------------------+
                     |  Tache 2.1.8 termine               |
                     |  AuthController etendu MFA         |
                     +-----------------+------------------+
                                       |
                                       v
                  +--------------------+----------------------+
                  |  TACHE 2.1.9 (cette tache)                 |
                  |  AuthController extended                   |
                  |  POST /signup        (public)              |
                  |  GET  /verify-email  (public, redirect)    |
                  |  POST /resend-verification (public)        |
                  |                                            |
                  |  AuthService extended                      |
                  |  - signup()                                |
                  |  - verifyEmail()                           |
                  |  - resendVerification()                    |
                  |                                            |
                  |  EmailVerificationRepository (new)         |
                  |  table auth_email_verifications            |
                  +--+----+----+----+----+--------------------+
                     |    |    |    |    |
                     v    v    v    v    v
                  2.1.11 / 2.1.13 / 2.1.14 / 2.1.15 / Sprint 6 onboarding
```

---

## 4. Livrables checkables (24)

- [ ] Mise a jour `repo/apps/api/src/modules/auth/auth.controller.ts` -- ajout 3 endpoints -- modification ~80 lignes
- [ ] Mise a jour `repo/apps/api/src/modules/auth/auth.service.ts` -- ajout 3 methods + helpers -- modification ~250 lignes
- [ ] Repository `repo/apps/api/src/modules/auth/email-verification.repository.ts` -- ~150 lignes
- [ ] DTO `repo/apps/api/src/modules/auth/dto/signup-response.dto.ts` -- ~30 lignes
- [ ] DTO `repo/apps/api/src/modules/auth/dto/resend-verification.dto.ts` -- ~25 lignes
- [ ] Update auth.errors.ts -- EmailVerificationError, EmailVerificationExpiredError, AccountAlreadyVerifiedError -- modification
- [ ] Migration `repo/packages/database/src/migrations/{date}-CreateAuthEmailVerifications.ts` -- ~50 lignes
- [ ] Entity `repo/packages/database/src/entities/system/auth-email-verification.entity.ts` -- ~50 lignes
- [ ] Mise a jour `repo/apps/api/src/modules/auth/auth.module.ts` -- import repository -- modification
- [ ] Service stub `repo/packages/comm/src/email.service.ts` (Tache 2.1.13 implementera) -- interface -- ~30 lignes
- [ ] Tests unit `auth.service.spec.ts` -- ajout 12 tests -- modification ~250 lignes
- [ ] Tests unit `auth.controller.spec.ts` -- ajout 6 tests -- modification ~120 lignes
- [ ] Tests `email-verification.repository.spec.ts` -- 6 tests -- ~120 lignes
- [ ] Tests E2E `auth-signup.e2e-spec.ts` -- 12 scenarios -- ~350 lignes
- [ ] No-emoji
- [ ] No-console
- [ ] Coverage >= 88%
- [ ] Documentation JSDoc + Swagger
- [ ] Build TypeScript reussit
- [ ] Anti-enumeration : meme reponse signup duplique
- [ ] Token TTL 24h
- [ ] Redirect 302 verify-email
- [ ] Resend rate limit 3/h prepare (Tache 2.1.14)
- [ ] Migration cree table avec indexes

---

## 5. Fichiers crees / modifies

```
repo/apps/api/src/modules/auth/auth.controller.ts                                 (modifie / +3 endpoints)
repo/apps/api/src/modules/auth/auth.service.ts                                    (modifie / +3 methods)
repo/apps/api/src/modules/auth/email-verification.repository.ts                   (~150 lignes)
repo/apps/api/src/modules/auth/dto/signup-response.dto.ts                          (~30 lignes)
repo/apps/api/src/modules/auth/dto/resend-verification.dto.ts                      (~25 lignes)
repo/apps/api/src/modules/auth/auth.errors.ts                                      (modifie)
repo/packages/database/src/migrations/{date}-CreateAuthEmailVerifications.ts        (~50 lignes)
repo/packages/database/src/entities/system/auth-email-verification.entity.ts        (~50 lignes)
repo/apps/api/src/modules/auth/auth.module.ts                                      (modifie)
repo/packages/comm/src/email.service.ts                                            (~30 lignes / stub interface)
repo/apps/api/src/modules/auth/auth.service.spec.ts                                 (modifie)
repo/apps/api/src/modules/auth/auth.controller.spec.ts                              (modifie)
repo/apps/api/src/modules/auth/email-verification.repository.spec.ts                (~120 lignes)
repo/apps/api/test/auth-signup.e2e-spec.ts                                          (~350 lignes)
```

---

## 6. Code patterns COMPLETS

### 6.1 Migration `CreateAuthEmailVerifications`

```typescript
// repo/packages/database/src/migrations/2026-05-06-001-CreateAuthEmailVerifications.ts
import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuthEmailVerifications20260506001 implements MigrationInterface {
  name = 'CreateAuthEmailVerifications20260506001';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE auth_email_verifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL UNIQUE,
        purpose TEXT NOT NULL DEFAULT 'signup' CHECK (purpose IN ('signup', 'change_email', 'resend')),
        expires_at TIMESTAMPTZ NOT NULL,
        consumed_at TIMESTAMPTZ NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ip_at_creation INET NULL,
        user_agent_at_creation TEXT NULL
      );
      CREATE INDEX idx_auth_email_verifications_user_id ON auth_email_verifications(user_id);
      CREATE INDEX idx_auth_email_verifications_expires ON auth_email_verifications(expires_at) WHERE consumed_at IS NULL;
      CREATE INDEX idx_auth_email_verifications_user_pending ON auth_email_verifications(user_id) WHERE consumed_at IS NULL AND expires_at > NOW();
      COMMENT ON TABLE auth_email_verifications IS 'Email verification tokens (Sprint 5 Tache 2.1.9). Token stored hashed SHA-256 for defense in depth.';
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE IF EXISTS auth_email_verifications;');
  }
}
```

### 6.2 Entity

```typescript
// repo/packages/database/src/entities/system/auth-email-verification.entity.ts
import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { AuthUserEntity } from './auth-user.entity.js';

@Entity({ name: 'auth_email_verifications' })
@Index(['user_id'])
export class AuthEmailVerificationEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  user_id!: string;

  @ManyToOne(() => AuthUserEntity)
  @JoinColumn({ name: 'user_id' })
  user!: AuthUserEntity;

  @Column('text', { unique: true })
  token_hash!: string;

  @Column('text', { default: 'signup' })
  purpose!: 'signup' | 'change_email' | 'resend';

  @Column('timestamptz')
  expires_at!: Date;

  @Column('timestamptz', { nullable: true })
  consumed_at!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @Column('inet', { nullable: true })
  ip_at_creation!: string | null;

  @Column('text', { nullable: true })
  user_agent_at_creation!: string | null;
}
```

### 6.3 Repository

```typescript
// repo/apps/api/src/modules/auth/email-verification.repository.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { LessThan, MoreThan } from 'typeorm';
import { AuthEmailVerificationEntity } from '@insurtech/database';

export interface CreateVerificationInput {
  user_id: string;
  token_hash: string;
  purpose: 'signup' | 'change_email' | 'resend';
  expires_at: Date;
  ip_at_creation?: string;
  user_agent_at_creation?: string;
}

@Injectable()
export class EmailVerificationRepository {
  constructor(
    @InjectRepository(AuthEmailVerificationEntity)
    private readonly repo: Repository<AuthEmailVerificationEntity>,
  ) {}

  async create(input: CreateVerificationInput): Promise<AuthEmailVerificationEntity> {
    const entity = this.repo.create({
      user_id: input.user_id,
      token_hash: input.token_hash,
      purpose: input.purpose,
      expires_at: input.expires_at,
      ip_at_creation: input.ip_at_creation ?? null,
      user_agent_at_creation: input.user_agent_at_creation ?? null,
    });
    return this.repo.save(entity);
  }

  async findActiveByTokenHash(tokenHash: string): Promise<AuthEmailVerificationEntity | null> {
    return this.repo.findOne({
      where: {
        token_hash: tokenHash,
        consumed_at: null as unknown as Date,
        expires_at: MoreThan(new Date()),
      },
    });
  }

  async findByTokenHash(tokenHash: string): Promise<AuthEmailVerificationEntity | null> {
    return this.repo.findOne({ where: { token_hash: tokenHash } });
  }

  async markConsumed(id: string): Promise<void> {
    await this.repo.update(id, { consumed_at: new Date() });
  }

  async deleteUnconsumedForUser(userId: string): Promise<number> {
    const r = await this.repo.delete({ user_id: userId, consumed_at: null as unknown as Date });
    return r.affected ?? 0;
  }

  async cleanupExpired(): Promise<number> {
    const r = await this.repo.delete({ expires_at: LessThan(new Date()) });
    return r.affected ?? 0;
  }
}
```

### 6.4 Email service stub

```typescript
// repo/packages/comm/src/email.service.ts (stub Sprint 5 -- Tache 2.1.13 implementera)
import { Injectable, Logger } from '@nestjs/common';

export interface SendVerificationInput {
  to: string;
  locale: 'fr-MA' | 'ar-MA' | 'en' | 'fr-FR';
  token: string;
  display_name: string;
}

export interface SendRecoveryInput {
  to: string;
  locale: 'fr-MA' | 'ar-MA' | 'en' | 'fr-FR';
  token: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  async sendVerification(input: SendVerificationInput): Promise<void> {
    this.logger.log({
      action: 'send_verification_stub',
      to: input.to,
      locale: input.locale,
      // do not log token in production
    });
    // Tache 2.1.13 implementation : Nodemailer + Handlebars
  }

  async sendRecovery(input: SendRecoveryInput): Promise<void> {
    this.logger.log({ action: 'send_recovery_stub', to: input.to, locale: input.locale });
  }
}
```

### 6.5 Auth errors update

```typescript
// auth.errors.ts additions
export const EmailVerificationExpiredError = () =>
  new ApiAuthError('EMAIL_VERIFICATION_EXPIRED', 'Email verification token expired. Request a new one.', HttpStatus.GONE);

export const EmailVerificationInvalidError = () =>
  new ApiAuthError('EMAIL_VERIFICATION_INVALID', 'Email verification token invalid or already used.', HttpStatus.GONE);

export const AccountAlreadyVerifiedError = () =>
  new ApiAuthError('EMAIL_ALREADY_VERIFIED', 'Email is already verified', HttpStatus.OK);
```

### 6.6 AuthService extensions

```typescript
import { addHours } from 'date-fns';
import { EmailVerificationRepository } from './email-verification.repository.js';
import { EmailService } from '@insurtech/comm';
import type { SignupInput } from '@insurtech/auth';

@Injectable()
export class AuthService {
  // existing constructor + injections...
  constructor(
    // ... existing
    private readonly emailVerifyRepo: EmailVerificationRepository,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Creates a new user (email_verified_at NULL) and sends verification email.
   * Anti-enumeration : returns the same response whether email exists or not.
   */
  async signup(input: SignupInput, ctx: { ip: string; user_agent: string; request_id: string }): Promise<{ message: string }> {
    const email = input.email.trim().toLowerCase();

    // Validate password policy with context (defense against email-similar password)
    const policy = this.argon2.validatePolicy(input.password, {
      email,
      display_name: input.display_name,
    });
    if (!policy.valid) {
      throw new ApiAuthError(
        'PASSWORD_POLICY_VIOLATION',
        'Password does not meet the policy',
        HttpStatus.BAD_REQUEST,
        { reasons: policy.reasons },
      );
    }

    // Anti-enumeration : check if email exists, but always return same response
    const existing = await this.userRepo.findByEmail(email);
    if (existing) {
      this.logger.log({ action: 'signup_duplicate_attempt', email, ip: ctx.ip });
      // Do NOT leak that user exists. Return same response as success.
      return { message: 'If your email is not yet registered, a verification email has been sent.' };
    }

    // Hash password
    const passwordHash = await this.argon2.hash(input.password);

    // Create user
    const user = await this.userRepo.create({
      email,
      display_name: input.display_name,
      role: input.requested_role ?? 'prospect',
      tenant_id: null, // Sprint 6 will resolve via invitation_token
      password_hash: passwordHash,
      password_pepper_version: 1,
      email_verified_at: null,
      mfa_enabled: false,
      mfa_secret_encrypted: null,
      mfa_recovery_codes_hashes: [],
      is_active: true,
      deleted_at: null,
      locked_until: null,
      failed_login_attempts: 0,
      last_login_at: null,
      last_login_ip: null,
      locale: input.locale,
    } as any);

    // Generate verification token (32 bytes -> ~43 chars base64url)
    const token = this.hashing.randomToken(32);
    const tokenHash = this.hashing.sha256(token);
    const expiresAt = addHours(new Date(), 24);

    await this.emailVerifyRepo.create({
      user_id: user.id,
      token_hash: tokenHash,
      purpose: 'signup',
      expires_at: expiresAt,
      ip_at_creation: ctx.ip,
      user_agent_at_creation: ctx.user_agent,
    });

    // Send email (fire-and-forget but with retry queue Sprint 14)
    try {
      await this.emailService.sendVerification({
        to: user.email,
        locale: user.locale,
        token,
        display_name: user.display_name,
      });
    } catch (err) {
      this.logger.error({
        err: err instanceof Error ? err.message : err,
        user_id: user.id,
        action: 'signup_email_send_failed',
      }, 'Failed to send verification email');
      // Do NOT throw -- user is created, can use /resend-verification
    }

    // Tache 2.1.12 audit + Kafka publish event 'auth.signup_completed'
    this.logger.log({ action: 'signup_completed', user_id: user.id, email });

    return { message: 'If your email is not yet registered, a verification email has been sent.' };
  }

  /**
   * Verifies an email via the token in the URL.
   * Returns redirect-friendly result.
   */
  async verifyEmail(token: string): Promise<{
    status: 'success' | 'already_verified' | 'expired' | 'invalid';
    redirect_url: string;
  }> {
    if (!token || typeof token !== 'string' || token.length < 20) {
      return { status: 'invalid', redirect_url: this.buildVerifyEmailRedirect('invalid') };
    }

    const tokenHash = this.hashing.sha256(token);

    // First check if token exists (any status)
    const record = await this.emailVerifyRepo.findByTokenHash(tokenHash);
    if (!record) {
      return { status: 'invalid', redirect_url: this.buildVerifyEmailRedirect('invalid') };
    }
    if (record.consumed_at !== null) {
      return { status: 'already_verified', redirect_url: this.buildVerifyEmailRedirect('already_verified') };
    }
    if (record.expires_at < new Date()) {
      return { status: 'expired', redirect_url: this.buildVerifyEmailRedirect('expired') };
    }

    // Atomic update : mark verified
    await this.userRepo.update(record.user_id, { email_verified_at: new Date() });
    await this.emailVerifyRepo.markConsumed(record.id);

    // Tache 2.1.12 audit + Kafka 'auth.email_verified'
    this.logger.log({ action: 'email_verified', user_id: record.user_id });

    return { status: 'success', redirect_url: this.buildVerifyEmailRedirect('success') };
  }

  /**
   * Resends a verification email if the user exists and is not yet verified.
   * Anti-enumeration : same response regardless.
   * Rate limit Tache 2.1.14 : 3 per hour per email.
   */
  async resendVerification(input: { email: string; ip: string; user_agent: string }): Promise<{ message: string }> {
    const email = input.email.trim().toLowerCase();
    const user = await this.userRepo.findByEmail(email);

    if (!user || user.email_verified_at !== null) {
      // Same response regardless
      this.logger.log({ action: 'resend_anti_enum', email, ip: input.ip });
      return { message: 'If your email exists and is unverified, a new verification email has been sent.' };
    }

    // Cleanup unconsumed previous tokens
    await this.emailVerifyRepo.deleteUnconsumedForUser(user.id);

    // Generate new token
    const token = this.hashing.randomToken(32);
    const tokenHash = this.hashing.sha256(token);
    const expiresAt = addHours(new Date(), 24);

    await this.emailVerifyRepo.create({
      user_id: user.id,
      token_hash: tokenHash,
      purpose: 'resend',
      expires_at: expiresAt,
      ip_at_creation: input.ip,
      user_agent_at_creation: input.user_agent,
    });

    try {
      await this.emailService.sendVerification({
        to: user.email,
        locale: user.locale,
        token,
        display_name: user.display_name,
      });
    } catch (err) {
      this.logger.error({ err: err instanceof Error ? err.message : err, user_id: user.id }, 'resend email send failed');
    }

    return { message: 'If your email exists and is unverified, a new verification email has been sent.' };
  }

  private buildVerifyEmailRedirect(status: string): string {
    const baseUrl = process.env.FRONTEND_BASE_URL ?? 'https://app.skalean.ma';
    return `${baseUrl}/auth/email-verified?status=${encodeURIComponent(status)}`;
  }
}
```

### 6.7 AuthController extensions

```typescript
import { Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { signupSchema } from '@insurtech/auth';

export class SignupDto extends createZodDto(signupSchema) {}

const resendVerificationSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
}).strict();
export class ResendVerificationDto extends createZodDto(resendVerificationSchema) {}

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  // ... existing

  @Public()
  @Post('signup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create new account with email verification' })
  @ApiResponse({ status: 200, description: 'Verification email sent (anti-enumeration : same response if email exists)' })
  @ApiResponse({ status: 400, description: 'Password policy violation' })
  async signup(@Body() body: SignupDto, @Req() req: Request) {
    return this.authService.signup(body, {
      ip: extractIp(req),
      user_agent: req.headers['user-agent'] ?? 'unknown',
      request_id: req.headers['x-request-id']?.toString() ?? 'unknown',
    });
  }

  @Public()
  @Get('verify-email')
  @ApiOperation({ summary: 'Verify email via token in URL (click from email)' })
  @ApiResponse({ status: 302, description: 'Redirect to frontend with status' })
  async verifyEmail(@Query('token') token: string, @Res() res: Response) {
    const result = await this.authService.verifyEmail(token);
    return res.redirect(302, result.redirect_url);
  }

  @Public()
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend verification email (rate-limited 3/h)' })
  @ApiResponse({ status: 200, description: 'Email sent if eligible (anti-enumeration)' })
  async resendVerification(@Body() body: ResendVerificationDto, @Req() req: Request) {
    return this.authService.resendVerification({
      email: body.email,
      ip: extractIp(req),
      user_agent: req.headers['user-agent'] ?? 'unknown',
    });
  }
}
```

### 6.8 AuthModule update

```typescript
// repo/apps/api/src/modules/auth/auth.module.ts
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthEmailVerificationEntity } from '@insurtech/database';
import { EmailVerificationRepository } from './email-verification.repository.js';
import { EmailService } from '@insurtech/comm';

@Module({
  imports: [
    AuthSharedModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    UserModule,
    TypeOrmModule.forFeature([AuthEmailVerificationEntity]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: MfaRequiredGuard },
    EmailVerificationRepository,
    EmailService, // Tache 2.1.13 implementera vraie version
  ],
  exports: [AuthService],
})
export class AuthModule {}
```

---

## 7. Tests complets

### 7.1 Tests unit `auth.service.spec.ts` (extension signup)

```typescript
describe('AuthService signup methods', () => {
  let emailVerifyRepo: any;
  let emailService: any;

  beforeEach(() => {
    emailVerifyRepo = {
      create: vi.fn().mockResolvedValue({ id: 'ev1' }),
      findActiveByTokenHash: vi.fn(),
      findByTokenHash: vi.fn(),
      markConsumed: vi.fn(),
      deleteUnconsumedForUser: vi.fn().mockResolvedValue(0),
    };
    emailService = {
      sendVerification: vi.fn().mockResolvedValue(undefined),
      sendRecovery: vi.fn().mockResolvedValue(undefined),
    };
    // inject in TestingModule
  });

  describe('signup', () => {
    it('creates user with email_verified_at null', async () => {
      userRepo.findByEmail.mockResolvedValue(null);
      argon2.validatePolicy.mockReturnValue({ valid: true });
      argon2.hash.mockResolvedValue('$argon2id$xxx');
      userRepo.create.mockResolvedValue({ id: 'u1', email: 'a@b.com', locale: 'fr-MA', display_name: 'A' });

      const r = await service.signup(
        {
          email: 'a@b.com', password: 'StrongP@ss123!', display_name: 'A',
          locale: 'fr-MA', accepted_tos: true,
        } as any,
        { ip: '1.1.1.1', user_agent: 'UA', request_id: 'r1' },
      );
      expect(r.message).toContain('verification');
      expect(userRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        email_verified_at: null,
      }));
      expect(emailVerifyRepo.create).toHaveBeenCalled();
      expect(emailService.sendVerification).toHaveBeenCalled();
    });

    it('anti-enumeration : same response for duplicate email', async () => {
      userRepo.findByEmail.mockResolvedValue(mockUser({ email: 'a@b.com' }));
      const r = await service.signup(
        {
          email: 'a@b.com', password: 'StrongP@ss123!', display_name: 'A',
          locale: 'fr-MA', accepted_tos: true,
        } as any,
        { ip: '1.1.1.1', user_agent: 'UA', request_id: 'r1' },
      );
      expect(r.message).toContain('verification');
      // create NOT called
      expect(userRepo.create).not.toHaveBeenCalled();
    });

    it('rejects weak password with reasons', async () => {
      userRepo.findByEmail.mockResolvedValue(null);
      argon2.validatePolicy.mockReturnValue({ valid: false, reasons: ['too_short', 'banned'] });
      await expect(service.signup(
        { email: 'a@b.com', password: 'short', display_name: 'A', locale: 'fr-MA', accepted_tos: true } as any,
        { ip: '1.1.1.1', user_agent: 'UA', request_id: 'r1' },
      )).rejects.toThrow(/PASSWORD_POLICY/);
    });

    it('lowercases email before lookup and create', async () => {
      userRepo.findByEmail.mockResolvedValue(null);
      argon2.validatePolicy.mockReturnValue({ valid: true });
      argon2.hash.mockResolvedValue('hash');
      userRepo.create.mockResolvedValue({ id: 'u1', email: 'a@b.com', locale: 'fr-MA', display_name: 'A' });

      await service.signup(
        { email: 'A@B.COM', password: 'StrongP@ss123!', display_name: 'A', locale: 'fr-MA', accepted_tos: true } as any,
        { ip: '1.1.1.1', user_agent: 'UA', request_id: 'r1' },
      );
      expect(userRepo.findByEmail).toHaveBeenCalledWith('a@b.com');
    });

    it('does not throw if email send fails', async () => {
      userRepo.findByEmail.mockResolvedValue(null);
      argon2.validatePolicy.mockReturnValue({ valid: true });
      argon2.hash.mockResolvedValue('hash');
      userRepo.create.mockResolvedValue({ id: 'u1', email: 'a@b.com', locale: 'fr-MA', display_name: 'A' });
      emailService.sendVerification.mockRejectedValue(new Error('SMTP down'));

      const r = await service.signup(
        { email: 'a@b.com', password: 'StrongP@ss123!', display_name: 'A', locale: 'fr-MA', accepted_tos: true } as any,
        { ip: '1.1.1.1', user_agent: 'UA', request_id: 'r1' },
      );
      expect(r.message).toBeDefined();
    });
  });

  describe('verifyEmail', () => {
    it('marks email_verified_at NOW for valid token', async () => {
      const token = 'a'.repeat(43);
      hashing.sha256.mockReturnValue('hash');
      emailVerifyRepo.findByTokenHash.mockResolvedValue({
        id: 'ev1', user_id: 'u1', consumed_at: null, expires_at: new Date(Date.now() + 86400000),
      });
      const r = await service.verifyEmail(token);
      expect(r.status).toBe('success');
      expect(userRepo.update).toHaveBeenCalledWith('u1', expect.objectContaining({ email_verified_at: expect.any(Date) }));
      expect(emailVerifyRepo.markConsumed).toHaveBeenCalledWith('ev1');
    });

    it('returns already_verified for consumed token', async () => {
      const token = 'a'.repeat(43);
      emailVerifyRepo.findByTokenHash.mockResolvedValue({
        id: 'ev1', user_id: 'u1', consumed_at: new Date(), expires_at: new Date(Date.now() + 86400000),
      });
      const r = await service.verifyEmail(token);
      expect(r.status).toBe('already_verified');
    });

    it('returns expired for expired token', async () => {
      const token = 'a'.repeat(43);
      emailVerifyRepo.findByTokenHash.mockResolvedValue({
        id: 'ev1', user_id: 'u1', consumed_at: null, expires_at: new Date(Date.now() - 1000),
      });
      const r = await service.verifyEmail(token);
      expect(r.status).toBe('expired');
    });

    it('returns invalid for unknown token', async () => {
      emailVerifyRepo.findByTokenHash.mockResolvedValue(null);
      const r = await service.verifyEmail('a'.repeat(43));
      expect(r.status).toBe('invalid');
    });

    it('returns invalid for malformed token', async () => {
      const r = await service.verifyEmail('short');
      expect(r.status).toBe('invalid');
    });
  });

  describe('resendVerification', () => {
    it('sends new email if user unverified', async () => {
      userRepo.findByEmail.mockResolvedValue(mockUser({ email_verified_at: null }));
      const r = await service.resendVerification({ email: 'a@b.com', ip: '1.1.1.1', user_agent: 'UA' });
      expect(emailVerifyRepo.deleteUnconsumedForUser).toHaveBeenCalled();
      expect(emailVerifyRepo.create).toHaveBeenCalled();
      expect(emailService.sendVerification).toHaveBeenCalled();
    });

    it('anti-enum : same response for already verified', async () => {
      userRepo.findByEmail.mockResolvedValue(mockUser({ email_verified_at: new Date() }));
      const r = await service.resendVerification({ email: 'a@b.com', ip: '1.1.1.1', user_agent: 'UA' });
      expect(r.message).toBeDefined();
      expect(emailService.sendVerification).not.toHaveBeenCalled();
    });

    it('anti-enum : same response for unknown email', async () => {
      userRepo.findByEmail.mockResolvedValue(null);
      const r = await service.resendVerification({ email: 'unknown@b.com', ip: '1.1.1.1', user_agent: 'UA' });
      expect(r.message).toBeDefined();
      expect(emailService.sendVerification).not.toHaveBeenCalled();
    });
  });
});
```

### 7.2 Tests E2E `auth-signup.e2e-spec.ts`

```typescript
describe('Auth Signup E2E', () => {
  let app: INestApplication;

  // ... setup similar

  it('POST /signup creates user (email_verified_at null)', async () => {
    const r = await request(app.getHttpServer())
      .post('/api/v1/auth/signup')
      .send({
        email: 'newuser@example.com',
        password: 'StrongP@ss123!',
        display_name: 'New User',
        locale: 'fr-MA',
        accepted_tos: true,
      });
    expect(r.status).toBe(200);
    expect(r.body.message).toContain('verification');
  });

  it('POST /signup duplicate email returns same message (anti-enum)', async () => {
    await request(app.getHttpServer()).post('/api/v1/auth/signup').send({
      email: 'duplicate@example.com', password: 'StrongP@ss123!', display_name: 'D', locale: 'fr-MA', accepted_tos: true,
    });
    const r = await request(app.getHttpServer()).post('/api/v1/auth/signup').send({
      email: 'duplicate@example.com', password: 'StrongP@ss123!', display_name: 'D', locale: 'fr-MA', accepted_tos: true,
    });
    expect(r.status).toBe(200);
    expect(r.body.message).toContain('verification');
  });

  it('POST /signup weak password returns 400', async () => {
    const r = await request(app.getHttpServer()).post('/api/v1/auth/signup').send({
      email: 'weak@example.com', password: 'short', display_name: 'D', locale: 'fr-MA', accepted_tos: true,
    });
    expect(r.status).toBe(400);
  });

  it('POST /signup without accepted_tos returns 400', async () => {
    const r = await request(app.getHttpServer()).post('/api/v1/auth/signup').send({
      email: 'tos@example.com', password: 'StrongP@ss123!', display_name: 'D', locale: 'fr-MA', accepted_tos: false,
    });
    expect(r.status).toBe(400);
  });

  it('POST /signup email lowercased', async () => {
    const r = await request(app.getHttpServer()).post('/api/v1/auth/signup').send({
      email: 'CASE@EXAMPLE.COM', password: 'StrongP@ss123!', display_name: 'C', locale: 'fr-MA', accepted_tos: true,
    });
    expect(r.status).toBe(200);
    // verify in DB email is 'case@example.com'
  });

  it('POST /signin without email_verified returns 401 EMAIL_NOT_VERIFIED', async () => {
    await request(app.getHttpServer()).post('/api/v1/auth/signup').send({
      email: 'unver@example.com', password: 'StrongP@ss123!', display_name: 'U', locale: 'fr-MA', accepted_tos: true,
    });
    const r = await request(app.getHttpServer()).post('/api/v1/auth/signin').send({
      email: 'unver@example.com', password: 'StrongP@ss123!',
    });
    expect(r.status).toBe(401);
    expect(r.body.code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('GET /verify-email with valid token redirects success', async () => {
    // Get token from test seed or DB
    const token = 'valid-token-from-seed';
    const r = await request(app.getHttpServer()).get(`/api/v1/auth/verify-email?token=${token}`);
    expect(r.status).toBe(302);
    expect(r.headers.location).toContain('status=success');
  });

  it('GET /verify-email with already consumed token redirects already_verified', async () => {
    const token = 'consumed-token';
    const r = await request(app.getHttpServer()).get(`/api/v1/auth/verify-email?token=${token}`);
    expect(r.headers.location).toContain('status=already_verified');
  });

  it('GET /verify-email with expired token redirects expired', async () => {
    const token = 'expired-token';
    const r = await request(app.getHttpServer()).get(`/api/v1/auth/verify-email?token=${token}`);
    expect(r.headers.location).toContain('status=expired');
  });

  it('GET /verify-email with invalid token redirects invalid', async () => {
    const r = await request(app.getHttpServer()).get('/api/v1/auth/verify-email?token=garbage');
    expect(r.headers.location).toContain('status=invalid');
  });

  it('Full flow : signup -> verify-email -> signin', async () => {
    // signup
    await request(app.getHttpServer()).post('/api/v1/auth/signup').send({
      email: 'flow@example.com', password: 'StrongP@ss123!', display_name: 'F', locale: 'fr-MA', accepted_tos: true,
    });
    // simulate getting token from email (DB query in test)
    const token = await getVerificationTokenFromDb('flow@example.com');
    // verify
    await request(app.getHttpServer()).get(`/api/v1/auth/verify-email?token=${token}`);
    // signin
    const signinR = await request(app.getHttpServer()).post('/api/v1/auth/signin').send({
      email: 'flow@example.com', password: 'StrongP@ss123!',
    });
    expect(signinR.status).toBe(200);
    expect(signinR.body.access_token).toBeDefined();
  });

  it('POST /resend-verification sends new email', async () => {
    // signup first
    await request(app.getHttpServer()).post('/api/v1/auth/signup').send({
      email: 'resend@example.com', password: 'StrongP@ss123!', display_name: 'R', locale: 'fr-MA', accepted_tos: true,
    });
    const r = await request(app.getHttpServer()).post('/api/v1/auth/resend-verification').send({
      email: 'resend@example.com',
    });
    expect(r.status).toBe(200);
  });

  it('POST /resend-verification anti-enum for verified user', async () => {
    const r = await request(app.getHttpServer()).post('/api/v1/auth/resend-verification').send({
      email: 'already-verified@example.com',
    });
    expect(r.status).toBe(200); // same response
  });
});

async function getVerificationTokenFromDb(email: string): Promise<string> {
  // Helper for test
  return 'mocked';
}
```

---

## 8. Variables environnement

```env
FRONTEND_BASE_URL=https://app.skalean.ma
EMAIL_VERIFICATION_TTL_HOURS=24
SIGNUP_DEFAULT_ROLE=prospect
```

---

## 9. Commandes shell

```bash
cd repo
pnpm --filter @insurtech/api typecheck
pnpm --filter @insurtech/api lint:check
pnpm --filter @insurtech/api test
pnpm --filter @insurtech/api test:e2e
pnpm --filter @insurtech/database migrate:run
pnpm --filter @insurtech/api build
```

---

## 10. Criteres validation V1-V32

### Criteres P0 (22)

- **V1-V3** : typecheck, build, tests pass.
- **V4** : POST /signup cree user email_verified_at null.
- **V5** : POST /signup duplicate retourne meme message.
- **V6** : POST /signup weak password 400 PASSWORD_POLICY_VIOLATION.
- **V7** : POST /signup without accepted_tos 400.
- **V8** : POST /signup email lowercased.
- **V9** : POST /signup envoie email verification.
- **V10** : POST /signup token hash store en DB (pas clear).
- **V11** : POST /signup token TTL 24h.
- **V12** : POST /signin user non-verifie retourne 401 EMAIL_NOT_VERIFIED.
- **V13** : GET /verify-email valid token mark verified + redirect 302.
- **V14** : GET /verify-email already consumed retourne already_verified.
- **V15** : GET /verify-email expired retourne expired.
- **V16** : GET /verify-email invalid retourne invalid.
- **V17** : GET /verify-email atomic UPDATE auth_users + markConsumed.
- **V18** : POST /resend-verification deletes previous unconsumed.
- **V19** : POST /resend-verification anti-enum si email unknown.
- **V20** : POST /resend-verification anti-enum si user verified.
- **V21** : Migration cree table avec indexes.
- **V22** : Token entropie 256 bits (32 bytes random).

### Criteres P1 (7)

- **V23** : Coverage >= 88%.
- **V24** : No-emoji.
- **V25** : No-console.
- **V26** : OpenAPI Swagger sur 3 endpoints.
- **V27** : Email send fail not block signup.
- **V28** : Audit log Tache 2.1.12 events emit.
- **V29** : E2E tests 12+ scenarios.

### Criteres P2 (3)

- **V30** : Bench signup < 600 ms.
- **V31** : Cleanup expired job hook prepare.
- **V32** : Documentation JSDoc complete.

---

## 11. Edge cases

1. **Token presente avec wrong format** : sha256 hash diff -> findByTokenHash returns null -> invalid.
2. **2 verify-email simultaneously avec meme token** : DB UPDATE conditional, premier OK, second already_verified.
3. **User cree puis tenant_id assigne Sprint 6** : null OK initial, Sprint 6 update.
4. **Email contenant Unicode (homograph)** : Zod EMAIL_REGEX ASCII-only reject.
5. **Token expire pendant URL transit (mail delay)** : 24h marge suffisante.
6. **User signup puis delete account avant verify** : token orphelin, FK CASCADE supprime.
7. **Resend flood** : Tache 2.1.14 rate limit 3/h.
8. **Signup avec invitation_token Sprint 6** : DEFFERE.
9. **Cleanup expired tokens** : Sprint 35 job archive.
10. **Email bounce / undeliverable** : Tache 2.1.13 EmailService gere ; user non notifie ; resend manuel via UI.
11. **CORS sur verify-email redirect** : redirect 302 cross-origin OK.
12. **User signup en arabe (locale ar-MA)** : Zod accepte ; email Tache 2.1.13 envoie template ar-MA.

---

## 12. Conformite Maroc

- Loi 09-08 article 7 : consentement explicite via accepted_tos = true.
- Loi 09-08 article 23 : email tokens hashes SHA-256.
- ACAPS : double-opt-in obligatoire pour services financiers.
- NIST SP 800-63B IAL2 : email verification.
- OWASP A07:2021 : anti-enumeration.
- RGPD article 6.1.a : base legale = consentement (accepted_tos).

---

## 13. Conventions absolues

Multi-tenant : tenant_id null Sprint 5 (Sprint 6 invitation_token resolve). Validation Zod via signupSchema. Logger Pino. Hash Argon2id. pnpm. TS strict. Tests 25+. RBAC : signup creates prospect role default. Events : Tache 2.1.12 publish. Imports order. Skalean AI : aucun. No-emoji. Idempotency : non applicable (signup non idempotent intentionnellement). Conventional Commits. Cloud souverain. Crypto : reuse HashingService. JSDoc + Swagger. Performance : signup < 600ms (Argon2 dominate).

---

## 14. Validation pre-commit

```bash
cd repo
pnpm --filter @insurtech/api typecheck
pnpm --filter @insurtech/api lint:check
pnpm --filter @insurtech/api test
pnpm --filter @insurtech/api test:e2e
pnpm --filter @insurtech/database migrate:run

grep -rP "[\x{1F300}-\x{1F9FF}]" apps/api/src && exit 1 || echo OK
grep -rn "console\.log" apps/api/src --include="*.ts" && exit 1 || echo OK
```

---

## 15. Commit message

```bash
git add -A
git commit -m "feat(sprint-05): implement signup flow + email verification + resend

Implements account creation with mandatory double-opt-in email
verification : POST /signup creates user with email_verified_at null,
generates token random 32 bytes hashed SHA-256 stored in
auth_email_verifications table TTL 24h, sends verification email via
EmailService stub Tache 2.1.13. GET /verify-email validates token,
sets email_verified_at, marks consumed, redirects 302 to frontend
with status. POST /resend-verification deletes unconsumed previous
tokens and sends new. Anti-enumeration : same response for duplicate
signup or resend on verified/unknown email.

Livrables :
- AuthController : 3 new endpoints (signup, verify-email, resend)
- AuthService : 3 new methods + private buildVerifyEmailRedirect
- EmailVerificationRepository (TypeORM)
- AuthEmailVerificationEntity
- Migration CreateAuthEmailVerifications with indexes
- EmailService stub interface (Tache 2.1.13 implementation)
- 25+ tests

Tests : 12 service + 6 controller + 6 repository + 12 E2E
Coverage : >= 88%

Task: 2.1.9
Sprint: 5 (Phase 2 / Sprint 1)
Phase: 2 -- Securite & Multi-tenant
Reference: B-05 Tache 2.1.9
Decisions: Loi 09-08 article 7, NIST SP 800-63B IAL2, OWASP A07:2021"
```

---

## 16. Workflow next step

Apres commit, passer a `task-2.1.10-lockout-service.md` qui implementera le `LockoutService` anti brute force avec progression 5 -> 15 -> 60 min puis permanent + tracking par user_id et IP.

---

## Annexe A. Runbook operationnel

### A.1 Procedure : user dit ne pas avoir recu email verification

1. Verifier dans dashboard EmailService si email a ete envoye (status 'sent', 'bounced', 'rejected').
2. Si bounced : email invalide -> user doit recommencer signup avec correct email.
3. Si sent mais user dit non recu : check spam folder, check filtres entreprise.
4. Suggerer /resend-verification.
5. Si echec persistant : admin support via formulaire (Sprint 18).

### A.2 Cleanup batch table auth_email_verifications

Sprint 35 cron job nightly :
```sql
DELETE FROM auth_email_verifications
WHERE expires_at < NOW() - INTERVAL '7 days'
   OR (consumed_at IS NOT NULL AND consumed_at < NOW() - INTERVAL '90 days');
```

### A.3 Procedure : suspicion enumeration via signup

Dashboard Sprint 33 detecte rate signup > 100/min depuis meme IP : bloquer IP via Sprint 14 firewall + alerter.

## Annexe B. Monitoring Sprint 33

```
auth_signup_total                     counter labels=tenant_id, locale, role
auth_signup_duration_ms               histogram
auth_signup_anti_enum_total           counter -- duplicate emails caught
auth_email_verify_total               counter labels=status(success|already_verified|expired|invalid)
auth_email_verify_duration_ms         histogram
auth_resend_verification_total        counter labels=eligible(true|false)
auth_email_verifications_count        gauge -- table size
auth_email_verifications_pending      gauge -- consumed_at NULL count
```

## Annexe C. Edge cases supplementaires (13-25)

### Edge case 13 : Email avec apostrophe ('reilly@example.com)

Zod EMAIL_REGEX RFC 5321 simplified accepte ; lookup case-insensitive citext OK.

### Edge case 14 : Display_name avec accent (Aicha, Mohamed)

Zod regex `/^[\p{L}\p{N} '.\-]+$/u` accepte unicode letters.

### Edge case 15 : Token URL avec & ou = (deja base64url, no special chars)

Pas de problem.

### Edge case 16 : User signup avec password = email

Argon2 validatePolicy `contains_email_local` reject.

### Edge case 17 : Multiple resend en parallele

deleteUnconsumedForUser puis create. Race possible : 2 creates simultanes -> UNIQUE constraint sur token_hash garantit pas de doublon (random tokens different).

### Edge case 18 : Verify-email URL contient query params parasites

`?token=xxx&utm_source=email` : Zod ne parse que token via @Query.

### Edge case 19 : Token leak via browser history

Once consumed, URL inutile. Defense en profondeur : TTL 24h + one-shot.

### Edge case 20 : User en attente verification puis change email Sprint 6

Sprint 6 change-email flow ecrasera tokens precedents.

### Edge case 21 : Tenant_id null cause issues Sprint 6 endpoints

Sprint 6 ajoutera invitation_token resolve dans signup. Sprint 5 = prospect role par defaut, tenant_id null OK.

### Edge case 22 : Email service down pendant 4h

Users qui signup : verification email pas envoye. Solution : Sprint 14 retry queue avec exponential backoff. Sprint 5 = log error, user manual /resend.

### Edge case 23 : Signup avec emoji dans display_name

Zod regex unicode letters n'inclut pas emoji. Reject.

### Edge case 24 : Race signup + delete account immediate

Edge case impossible Sprint 5 (pas de delete endpoint). Sprint 7 Pay add.

### Edge case 25 : User changes locale apres signup

PATCH /me locale Sprint 6 update auth_users.locale. Email ulterieur (recovery, etc.) utilise nouvelle locale.

## Annexe D. Performance benchmarks

```
POST /signup:                  median 320 ms  (p99: 500 ms) -- Argon2 hash dominate
GET /verify-email:             median 8 ms    (p99: 25 ms)  -- DB lookup + 2 UPDATEs
POST /resend-verification:     median 320 ms  (p99: 500 ms) -- depends emailService
```

## Annexe E. OpenAPI 3.1

```yaml
/api/v1/auth/signup:
  post:
    tags: [auth]
    summary: Create new account with email verification
    security: []
    requestBody:
      required: true
      content:
        application/json:
          schema: { $ref: '#/components/schemas/SignupDto' }
    responses:
      '200':
        description: Verification email sent
        content:
          application/json:
            schema:
              type: object
              properties: { message: { type: string } }
      '400':
        description: Password policy violation

/api/v1/auth/verify-email:
  get:
    tags: [auth]
    summary: Verify email via token (click from email)
    security: []
    parameters:
      - in: query
        name: token
        required: true
        schema: { type: string }
    responses:
      '302':
        description: Redirect to frontend with status
        headers:
          Location:
            schema: { type: string }

/api/v1/auth/resend-verification:
  post:
    tags: [auth]
    security: []
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            required: [email]
            properties:
              email: { type: string, format: email }
    responses:
      '200':
        description: Email sent if eligible (anti-enumeration)
```

---

## Annexe F. Comparaison avec systemes industriels

### F.1 Stripe signup flow

Stripe a un signup en 2 etapes : (1) email + password, (2) verification email avec token TTL 30 jours, (3) onboarding KYC apres verification. Skalean InsurTech Sprint 5 implemente etapes 1-2 ; KYC = Sprint 11 Pay onboarding. Le pattern token-in-URL est le meme. Stripe utilise des tokens JWT signes (vs random). Skalean choix random + hash : moins de payload, plus simple, meme niveau de securite avec TTL court 24h.

### F.2 Auth0 signup flow

Auth0 propose configurable double-opt-in. Le defaut est single-opt-in pour reduire UX friction. Skalean force double-opt-in (loi 09-08 + ACAPS). Auth0 utilise tokens 64 chars hex (256 bits) -- meme entropy que Skalean.

### F.3 AWS Cognito signup flow

AWS Cognito utilise SMS OTP par defaut + email verification optionnel. Skalean inverse : email obligatoire, SMS option future Sprint 14+. Choix justifie : SMS OTP attaques SIM swap au Maroc, email plus controle.

### F.4 Adopting industry pattern : message generic anti-enum

Le wording de retour "If your email is not yet registered, a verification email has been sent." est calque sur le wording standard 2024 de la majorite des plateformes (GitLab, Atlassian, GitHub). Cette neutralite linguistique est intentionnelle pour rester anti-enum.

## Annexe G. Tests supplementaires

### G.1 Test de charge concurrent signup

```typescript
describe('Signup load test', () => {
  it('handles 100 concurrent signups without DB deadlock', async () => {
    const ops = Array.from({ length: 100 }, (_, i) => request(app.getHttpServer())
      .post('/api/v1/auth/signup')
      .send({
        email: `load-${i}@example.com`,
        password: 'StrongP@ss123!',
        display_name: `User ${i}`,
        locale: 'fr-MA',
        accepted_tos: true,
      }));
    const results = await Promise.all(ops);
    const successCount = results.filter((r) => r.status === 200).length;
    expect(successCount).toBeGreaterThanOrEqual(95); // tolerate few transient failures
  });
});
```

### G.2 Test de regression sur l'anti-enumeration

Verifier que la latency de signup duplique est comparable a signup nouveau (eviter le timing leak) :

```typescript
it('signup duplicate latency comparable to new signup (timing-safe)', async () => {
  // Pre-create user
  await request(app.getHttpServer()).post('/api/v1/auth/signup').send({
    email: 'preexisting@example.com', password: 'P@ssword12345!', display_name: 'P', locale: 'fr-MA', accepted_tos: true,
  });

  const newStart = Date.now();
  await request(app.getHttpServer()).post('/api/v1/auth/signup').send({
    email: 'fresh-new@example.com', password: 'P@ssword12345!', display_name: 'F', locale: 'fr-MA', accepted_tos: true,
  });
  const newDuration = Date.now() - newStart;

  const dupStart = Date.now();
  await request(app.getHttpServer()).post('/api/v1/auth/signup').send({
    email: 'preexisting@example.com', password: 'P@ssword12345!', display_name: 'D', locale: 'fr-MA', accepted_tos: true,
  });
  const dupDuration = Date.now() - dupStart;

  // Both should be on same order of magnitude (Argon2 dominate)
  expect(Math.abs(newDuration - dupDuration)).toBeLessThan(200);
});
```

### G.3 Test de coherence multi-locale

```typescript
it('signup with each supported locale fr-MA/ar-MA/en/fr-FR', async () => {
  const locales: Array<'fr-MA' | 'ar-MA' | 'en' | 'fr-FR'> = ['fr-MA', 'ar-MA', 'en', 'fr-FR'];
  for (const locale of locales) {
    const r = await request(app.getHttpServer()).post('/api/v1/auth/signup').send({
      email: `${locale}-test@example.com`,
      password: 'StrongP@ss123!',
      display_name: 'Test',
      locale,
      accepted_tos: true,
    });
    expect(r.status).toBe(200);
  }
});

it('signup with unsupported locale returns 400', async () => {
  const r = await request(app.getHttpServer()).post('/api/v1/auth/signup').send({
    email: 'es-test@example.com', password: 'StrongP@ss123!', display_name: 'T', locale: 'es-ES' as any, accepted_tos: true,
  });
  expect(r.status).toBe(400);
});
```

### G.4 Test de securite : rate limit anti-enumeration

```typescript
it('rate limited signup blocks brute-force enumeration', async () => {
  // Attempt 20 signups from same IP rapidly
  const ops = Array.from({ length: 20 }, (_, i) => request(app.getHttpServer())
    .post('/api/v1/auth/signup')
    .set('X-Forwarded-For', '1.2.3.4') // simulate same IP
    .send({
      email: `enum-${i}@example.com`, password: 'StrongP@ss123!', display_name: 'E', locale: 'fr-MA', accepted_tos: true,
    }));
  const results = await Promise.all(ops);
  const rateLimited = results.filter((r) => r.status === 429);
  expect(rateLimited.length).toBeGreaterThan(0); // at least one should be rate-limited (Tache 2.1.14)
});
```

## Annexe H. References reglementaires detaillees

### H.1 Loi 09-08 article 7 (consentement)

Article 7 paragraphe 1 : "Le traitement des donnees personnelles ne peut etre effectue que si la personne concernee a manifeste son consentement libre, specifique, eclaire et univoque."

Implementation Skalean InsurTech v2.2 :
- "Libre" : signup volontaire, pas force.
- "Specifique" : accepted_tos checkbox lie aux Conditions Generales d'Utilisation accessibles via lien dans signup page Sprint 4.
- "Eclaire" : page CGU detaille les traitements (auth, sessions, MFA, audit, communications, paiements).
- "Univoque" : checkbox `accepted_tos: true` LITERAL (Zod refuse `accepted_tos: 'oui'` ou `accepted_tos: 1`).

### H.2 Loi 09-08 article 5 (proportionnalite)

Article 5 : "Les donnees doivent etre adequates, pertinentes et non excessives au regard des finalites pour lesquelles elles sont collectees."

Implementation : signup collecte SEULEMENT email, password, display_name, locale. Pas de date de naissance, pas de CIN, pas d'adresse. Le minimum necessaire pour creer un compte. Donnees additionnelles (CIN pour KYC) collectees Sprint 11 Pay onboarding sur consentement explicite separe.

### H.3 Loi 09-08 article 9 (droit a l'information)

Article 9 : "Information de la personne sur l'identite du responsable du traitement, finalites, destinataires, droits."

Implementation : signup page Sprint 4 affiche obligatoirement :
- Identite responsable : "Skalean SARL, RC Casablanca XXXX"
- Finalites : authentification, gestion compte, communications service.
- Destinataires : Skalean staff, partenaires assureurs (broker uniquement), CNDP sur demande legitime.
- Droits : acces, rectification, opposition, effacement, portabilite (RGPD article 13-22 transposes).

### H.4 ACAPS circulaire 2024 sur les operateurs

ACAPS impose pour les courtiers et garages-experts assimiles : (a) verification email obligatoire avant activation compte (couvert ici), (b) conservation logs auth 5 ans (couvert Tache 2.1.5 + 2.1.12 + Sprint 35), (c) MFA mandatory pour admin (couvert Tache 2.1.7 + 2.1.8), (d) reset password procedure verifiable (couvert Tache 2.1.11), (e) traçabilite des modifications role/permissions (couvert Sprint 7 + 2.1.12).

### H.5 RGPD article 25 (privacy by design)

Le programme Skalean InsurTech v2.2 applique le principe de privacy by design pour le signup :
- Minimisation des donnees (pas de champs optionnels intrusifs).
- Default secure (email_verified_at NULL force verification).
- Hash tokens en DB (defense en profondeur).
- TTL court 24h (limite la fenetre d'attaque).
- Anti-enumeration (protege la confidentialite de la liste users).

## Annexe I. Performance benchmarks attendus

```
POST /signup (Argon2 hash dominate):       median 320 ms (p99: 500 ms)
GET /verify-email (DB lookup + 2 UPDATE):  median 8 ms   (p99: 25 ms)
POST /resend-verification:                 median 320 ms (p99: 500 ms)
emailVerifyRepo.findByTokenHash:           median 1 ms   (p99: 5 ms)
emailVerifyRepo.markConsumed (1 UPDATE):   median 0.8 ms (p99: 3 ms)
auth_email_verifications.cleanup batch:    ~10 ms per 1000 rows
```

## Annexe J. SLO et SLA

Pour Sprint 35 production :
- Signup endpoint SLO 99.9% disponibilite, p99 < 1 sec.
- Verify-email SLO 99.99% disponibilite, p99 < 50 ms.
- Email delivery SLO 99% delivery dans 5 min via SendGrid Transactional (Sprint 13).
- Token expire never honored : 100% (one-shot consumption).

---

## Annexe K. Implementation patterns frontend Sprint 4

### K.1 Page signup typique (Next.js)

```typescript
// app/auth/signup/page.tsx
'use client';
import { useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { signupSchema } from '@insurtech/auth';

export default function SignupPage() {
  const [submitted, setSubmitted] = useState(false);
  const { register, handleSubmit, formState: { errors }, watch } = useForm({
    resolver: zodResolver(signupSchema),
    defaultValues: { locale: 'fr-MA' },
  });
  const password = watch('password');

  async function onSubmit(data: any) {
    try {
      await api.post('/api/v1/auth/signup', data);
      setSubmitted(true);
    } catch (err: any) {
      if (err.code === 'PASSWORD_POLICY_VIOLATION') {
        // Show field-level errors based on err.cause.reasons
        showPasswordPolicyErrors(err.cause.reasons);
      }
    }
  }

  if (submitted) {
    return (
      <div>
        <h1>Inscription en cours</h1>
        <p>Si l'email saisi correspond a un compte non encore cree, un message de verification a ete envoye.</p>
        <p>Verifiez votre boite (et le dossier spam) puis cliquez sur le lien de confirmation.</p>
        <p>Le lien est valide 24 heures.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('email')} type="email" required />
      <input {...register('password')} type="password" required />
      <PasswordStrengthIndicator value={password} />
      <input {...register('display_name')} type="text" required />
      <select {...register('locale')}>
        <option value="fr-MA">Francais (Maroc)</option>
        <option value="ar-MA">العربية (المغرب)</option>
        <option value="fr-FR">Francais (France)</option>
        <option value="en">English</option>
      </select>
      <label>
        <input {...register('accepted_tos')} type="checkbox" required />
        J'accepte les <a href="/legal/cgu">CGU</a> et la <a href="/legal/privacy">politique de confidentialite</a>
      </label>
      <button type="submit">Creer mon compte</button>
    </form>
  );
}
```

### K.2 Page verify-email-success (post-redirect)

```typescript
// app/auth/email-verified/page.tsx
'use client';
import { useSearchParams } from 'next/navigation';

export default function EmailVerifiedPage() {
  const params = useSearchParams();
  const status = params.get('status');

  if (status === 'success') {
    return (
      <div>
        <h1>Email verifie</h1>
        <p>Votre email a ete verifie avec succes. Vous pouvez maintenant vous connecter.</p>
        <a href="/auth/signin">Se connecter</a>
      </div>
    );
  }
  if (status === 'already_verified') {
    return (
      <div>
        <h1>Email deja verifie</h1>
        <p>Cet email est deja verifie. Connectez-vous.</p>
        <a href="/auth/signin">Se connecter</a>
      </div>
    );
  }
  if (status === 'expired') {
    return (
      <div>
        <h1>Lien expire</h1>
        <p>Le lien de verification a expire (validite 24h). Demandez un nouveau lien.</p>
        <ResendVerificationForm />
      </div>
    );
  }
  return (
    <div>
      <h1>Lien invalide</h1>
      <p>Le lien de verification est invalide. Verifiez l'URL ou demandez un nouveau lien.</p>
      <ResendVerificationForm />
    </div>
  );
}
```

### K.3 ResendVerificationForm

```typescript
function ResendVerificationForm() {
  const [submitted, setSubmitted] = useState(false);
  async function onSubmit(email: string) {
    await api.post('/api/v1/auth/resend-verification', { email });
    setSubmitted(true);
  }
  // ... form input
}
```

## Annexe L. Tests securite supplementaires

### L.1 Test homograph attack defense

```typescript
it('rejects email with cyrillic homograph (looks like ASCII)', async () => {
  const cyrillicE = 'е'; // U+0435 (Cyrillic), looks like ASCII 'e' (U+0065)
  const r = await request(app.getHttpServer()).post('/api/v1/auth/signup').send({
    email: `us${cyrillicE}r@example.com`,
    password: 'StrongP@ss123!',
    display_name: 'Test',
    locale: 'fr-MA',
    accepted_tos: true,
  });
  expect(r.status).toBe(400);
});
```

### L.2 Test injection XSS via display_name

```typescript
it('rejects display_name with HTML/script tags', async () => {
  const r = await request(app.getHttpServer()).post('/api/v1/auth/signup').send({
    email: 'xss@example.com',
    password: 'StrongP@ss123!',
    display_name: '<script>alert(1)</script>',
    locale: 'fr-MA',
    accepted_tos: true,
  });
  expect(r.status).toBe(400);
});
```

### L.3 Test SQL injection via email

```typescript
it('rejects SQL injection patterns in email field', async () => {
  const r = await request(app.getHttpServer()).post('/api/v1/auth/signup').send({
    email: "'; DROP TABLE auth_users; --@example.com",
    password: 'StrongP@ss123!',
    display_name: 'Test',
    locale: 'fr-MA',
    accepted_tos: true,
  });
  expect(r.status).toBe(400);
  // Defense en profondeur : Zod email regex + parametrized queries
});
```

## Annexe M. Cleanup batch script Sprint 35

```typescript
// repo/apps/api/src/jobs/cleanup-email-verifications.ts (Sprint 35)
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class CleanupEmailVerificationsJob {
  constructor(private readonly emailVerifyRepo: EmailVerificationRepository) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM, { timeZone: 'Africa/Casablanca' })
  async cleanup() {
    const expiredCount = await this.emailVerifyRepo.cleanupExpired();
    const consumedCount = await this.emailVerifyRepo.cleanupConsumed(); // > 90 days
    this.logger.log({
      action: 'cleanup_email_verifications',
      expired_deleted: expiredCount,
      consumed_archived: consumedCount,
    });
  }
}
```

## Annexe N. SLO et SLA production

Sprint 35 production targets :

| Endpoint | Disponibilite | p99 latency | Notes |
|----------|---------------|-------------|-------|
| POST /signup | 99.9% | < 1 sec | Argon2 hash + email send dominant |
| GET /verify-email | 99.99% | < 100 ms | DB lookup + 2 UPDATE |
| POST /resend-verification | 99.9% | < 1 sec | Similar to signup |

Email delivery rate (Tache 2.1.13) > 99% in 5 min via SendGrid.
Anti-enum response time variance < 200 ms (timing-safe).
Token expire never honored : 100%.

---

## Annexe O. Email verification template implementation complete

Tache 2.1.13 implementera l'envoi reel via Nodemailer + Handlebars. Sprint 5 stub. Specifications complete des templates :

### O.1 Template fr-MA verify-email.hbs

```handlebars
{{!-- repo/packages/comm/src/templates/fr-MA/verify-email.hbs --}}
<!DOCTYPE html>
<html lang="fr-MA" dir="ltr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verifiez votre email Skalean InsurTech</title>
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; }
    .header { background: #1d4ed8; color: white; padding: 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 30px 20px; background: #f9fafb; }
    .button { display: inline-block; padding: 14px 32px; background: #1d4ed8; color: white !important; text-decoration: none; border-radius: 6px; font-weight: 600; }
    .footer { font-size: 11px; color: #6b7280; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb; }
    .url-fallback { word-break: break-all; font-size: 12px; color: #6b7280; padding: 10px; background: #f3f4f6; border-radius: 4px; margin-top: 20px; }
    .icon { font-size: 48px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Skalean InsurTech</h1>
  </div>
  <div class="content">
    <h2 style="color: #1d4ed8;">Bonjour {{display_name}},</h2>

    <p>Merci pour votre inscription sur Skalean InsurTech, la plateforme integree de gestion d'assurance et de reparations automobiles au Maroc.</p>

    <p><strong>Pour activer votre compte, veuillez confirmer votre adresse email :</strong></p>

    <p style="text-align: center; margin: 30px 0;">
      <a href="{{verify_url}}" class="button">Verifier mon email</a>
    </p>

    <p style="color: #6b7280; font-size: 14px;">
      Le lien est valide pendant <strong>24 heures</strong>. Apres cela, vous devrez demander un nouveau lien depuis la page de connexion.
    </p>

    <div class="url-fallback">
      Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br>
      <a href="{{verify_url}}">{{verify_url}}</a>
    </div>

    <p style="margin-top: 30px; color: #6b7280; font-size: 13px;">
      Si vous n'etes pas a l'origine de cette inscription, ignorez cet email. Aucun compte ne sera cree sans verification.
    </p>
  </div>
  <div class="footer">
    <p>Skalean SARL, RC Casablanca XXXX</p>
    <p>Cet email a ete envoye automatiquement, ne pas repondre.</p>
    <p><a href="https://app.skalean.ma/legal/privacy">Politique de confidentialite</a> | <a href="https://app.skalean.ma/legal/cgu">CGU</a></p>
  </div>
</body>
</html>
```

### O.2 Template ar-MA verify-email.hbs (RTL)

```handlebars
{{!-- repo/packages/comm/src/templates/ar-MA/verify-email.hbs --}}
<!DOCTYPE html>
<html lang="ar-MA" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>وكد ايميلك ديال Skalean InsurTech</title>
  <style>
    body { font-family: 'Tajawal', 'Helvetica Neue', Arial, sans-serif; direction: rtl; text-align: right; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; }
    .header { background: #1d4ed8; color: white; padding: 20px; text-align: center; }
    .button { display: inline-block; padding: 14px 32px; background: #1d4ed8; color: white !important; text-decoration: none; border-radius: 6px; font-weight: 600; }
    .footer { font-size: 11px; color: #6b7280; padding: 20px; text-align: center; }
    .url-fallback { word-break: break-all; font-size: 12px; color: #6b7280; padding: 10px; background: #f3f4f6; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Skalean InsurTech</h1>
  </div>
  <div class="content">
    <h2>السلام {{display_name}},</h2>
    <p>شكرا على التسجيل ديالك في Skalean InsurTech، المنصة المتكاملة لتدبير التامين وتصليح السيارات في المغرب.</p>
    <p><strong>باش تفعل الحساب ديالك، عافاك وكد عنوان الايميل :</strong></p>
    <p style="text-align: center; margin: 30px 0;">
      <a href="{{verify_url}}" class="button">وكد الايميل</a>
    </p>
    <p style="color: #6b7280; font-size: 14px;">
      اللينك صالح <strong>24 ساعة</strong>. من بعد، خاصك تطلب لينك جديد من صفحة الدخول.
    </p>
    <div class="url-fallback">
      الا ما خدماتش الزر، نسخ هاد اللينك :<br>
      <a href="{{verify_url}}">{{verify_url}}</a>
    </div>
    <p style="margin-top: 30px; color: #6b7280; font-size: 13px;">
      الا ما درتيش هاد التسجيل، عافاك تجاهل هاد الايميل. الحساب ما غايتفعل حتى يتم التحقق.
    </p>
  </div>
  <div class="footer">
    <p>Skalean SARL، RC الدار البيضاء XXXX</p>
    <p>هاد الايميل تصيفط اوتوماتيكيا، ماتجاوبش عليه.</p>
  </div>
</body>
</html>
```

### O.3 Template en + fr-FR

Templates equivalents adaptes au public anglophone et francophone metropolitain. Structure identique, vocabulaire localise.

## Annexe P. Tests de coherence integration

```typescript
// repo/apps/api/test/auth-signup-coherence.spec.ts
describe('Signup integration coherence with downstream tasks', () => {
  it('signup -> verify-email -> signin -> me returns coherent user data', async () => {
    // Step 1 : signup
    const signupR = await request(app.getHttpServer()).post('/api/v1/auth/signup').send({
      email: 'coherence@example.com',
      password: 'StrongP@ss123!',
      display_name: 'Coherence Test',
      locale: 'fr-MA',
      accepted_tos: true,
    });
    expect(signupR.status).toBe(200);

    // Step 2 : verify-email
    const token = await getEmailVerificationTokenFromDb('coherence@example.com');
    const verifyR = await request(app.getHttpServer()).get(`/api/v1/auth/verify-email?token=${token}`);
    expect(verifyR.status).toBe(302);
    expect(verifyR.headers.location).toContain('status=success');

    // Step 3 : signin
    const signinR = await request(app.getHttpServer()).post('/api/v1/auth/signin').send({
      email: 'coherence@example.com', password: 'StrongP@ss123!',
    });
    expect(signinR.status).toBe(200);
    expect(signinR.body.user.email).toBe('coherence@example.com');
    expect(signinR.body.user.display_name).toBe('Coherence Test');
    expect(signinR.body.user.locale).toBe('fr-MA');
    expect(signinR.body.user.email_verified).toBe(true);

    // Step 4 : me
    const meR = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${signinR.body.access_token}`);
    expect(meR.body.email).toBe('coherence@example.com');
    expect(meR.body.email_verified).toBe(true);
    expect(meR.body.last_login_at).toBeDefined();
  });

  it('signup creates audit_log entry visible to ACAPS report', async () => {
    await request(app.getHttpServer()).post('/api/v1/auth/signup').send({
      email: 'audit-coherence@example.com', password: 'StrongP@ss123!', display_name: 'A', locale: 'fr-MA', accepted_tos: true,
    });

    // Query audit_log
    const auditR = await db.query(
      "SELECT * FROM audit_log WHERE action IN ('auth.signup_started', 'auth.signup_completed') AND user_email = $1",
      ['audit-coherence@example.com'],
    );
    expect(auditR.rows.length).toBeGreaterThanOrEqual(1);
  });

  it('signup with broker_admin role triggers MFA setup requirement on signin', async () => {
    // Sprint 6 + Sprint 14 : invitation_token assigns role broker_admin
    // For Sprint 5 : prospect default role
    // Test with admin-created broker_admin :
    await createUserViaAdminApi({
      email: 'broker-admin-test@example.com',
      role: AuthRole.BrokerAdmin,
      tenant_id: 't-test',
    });

    // Verify email manually
    await markEmailVerified('broker-admin-test@example.com');

    const signinR = await request(app.getHttpServer()).post('/api/v1/auth/signin').send({
      email: 'broker-admin-test@example.com', password: 'StrongP@ss123!',
    });
    expect(signinR.body.mfa_required).toBe(true); // isMfaMandatory(broker_admin) = true
  });

  it('signup creates Kafka event consumable by analytics Sprint 22', async () => {
    // Setup Kafka consumer in test
    // Trigger signup
    // Wait for event delivery
    // Assert event payload structure
  });
});
```

## Annexe Q. Anti-spam et anti-abuse heuristics

### Q.1 Detection bot signup

Sprint 14 ajoutera ces heuristiques dans signup :

```typescript
// Sprint 14 SignupAbuseDetector
async detectAbuse(input: SignupInput, ctx: SigninContext): Promise<{ allow: boolean; reason?: string }> {
  // Heuristic 1 : timing humain
  // Si user remplit le formulaire en < 2 secondes, c'est un bot
  if (ctx.form_filled_duration_ms < 2000) {
    return { allow: false, reason: 'too_fast' };
  }

  // Heuristic 2 : email pattern bot
  // *@guerillamail.com, *@10minutemail.com, *@tempmail.org -> blocklist
  const blockedDomains = ['guerillamail.com', '10minutemail.com', 'tempmail.org', 'mailinator.com'];
  if (blockedDomains.some((d) => input.email.endsWith(`@${d}`))) {
    return { allow: false, reason: 'disposable_email' };
  }

  // Heuristic 3 : IP reputation
  const ipScore = await this.ipReputationService.getScore(ctx.ip);
  if (ipScore < 30) {
    return { allow: false, reason: 'low_ip_reputation' };
  }

  // Heuristic 4 : User-Agent suspect
  if (ctx.user_agent.includes('curl') || ctx.user_agent.includes('python-requests')) {
    return { allow: false, reason: 'automated_user_agent' };
  }

  return { allow: true };
}
```

### Q.2 Honeypot field

Frontend Sprint 4 ajoute un champ cache (CSS display:none) :

```html
<input type="text" name="phone" autocomplete="off" tabindex="-1" style="position: absolute; left: -9999px;" />
```

Si rempli (par bot scanner formulaire), reject signup. Defense subtile et efficace contre bots simples.

### Q.3 reCAPTCHA v3 integration Sprint 14

```typescript
// Sprint 14 signup avec captcha
async signup(input: SignupInputWithCaptcha, ctx: SigninContext) {
  // Verify captcha first
  const captchaScore = await this.captchaService.verify(input.captcha_token);
  if (captchaScore < 0.5) {
    throw new ApiAuthError('CAPTCHA_FAILED', 'Suspected bot activity', HttpStatus.BAD_REQUEST);
  }
  // ... continue normal signup flow
}
```

## Annexe R. Metrics Prometheus complete

```typescript
// repo/apps/api/src/modules/auth/metrics/signup.metrics.ts
import { Counter, Histogram, Gauge } from 'prom-client';

export const signupTotal = new Counter({
  name: 'auth_signup_total',
  help: 'Total signups initiated',
  labelNames: ['locale', 'role', 'result'],
});

export const signupDuration = new Histogram({
  name: 'auth_signup_duration_ms',
  help: 'Signup operation duration',
  buckets: [10, 50, 100, 200, 500, 1000, 2000, 5000],
});

export const signupAntiEnum = new Counter({
  name: 'auth_signup_anti_enum_total',
  help: 'Duplicate email attempts caught by anti-enum',
});

export const emailVerifyTotal = new Counter({
  name: 'auth_email_verify_total',
  help: 'Email verification attempts',
  labelNames: ['status'],
});

export const emailVerifyDuration = new Histogram({
  name: 'auth_email_verify_duration_ms',
  help: 'Email verify operation duration',
  buckets: [1, 5, 10, 50, 100, 500],
});

export const resendVerificationTotal = new Counter({
  name: 'auth_resend_verification_total',
  help: 'Resend verification attempts',
  labelNames: ['eligible'],
});

export const emailVerificationsPending = new Gauge({
  name: 'auth_email_verifications_pending',
  help: 'Number of unconsumed email verification tokens',
});

export const passwordPolicyViolationsTotal = new Counter({
  name: 'auth_password_policy_violations_total',
  help: 'Password policy violations on signup',
  labelNames: ['reason'],
});
```

Dashboard Grafana "Signup Operations" Sprint 33 :
- Panel "Volume" : signup rate per minute, broken by role + locale.
- Panel "Conversion funnel" : signup -> verify -> first signin (drop rate).
- Panel "Anti-spam" : anti-enum count, captcha block count, ipblock count.
- Panel "Errors" : password policy violations breakdown.

## Annexe S. Cleanup batch script Sprint 35

```typescript
// repo/apps/api/src/jobs/cleanup-email-verifications.ts (Sprint 35)
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EmailVerificationRepository } from '../modules/auth/email-verification.repository.js';

@Injectable()
export class CleanupEmailVerificationsJob {
  private readonly logger = new Logger(CleanupEmailVerificationsJob.name);

  constructor(private readonly emailVerifyRepo: EmailVerificationRepository) {}

  // Run every day at 3 AM Casablanca time
  @Cron('0 3 * * *', { timeZone: 'Africa/Casablanca' })
  async cleanup() {
    const start = Date.now();
    try {
      const expiredCount = await this.emailVerifyRepo.cleanupExpired();
      const consumedOldCount = await this.emailVerifyRepo.cleanupConsumedOlderThan(90);

      this.logger.log({
        action: 'cleanup_email_verifications',
        expired_deleted: expiredCount,
        consumed_archived: consumedOldCount,
        duration_ms: Date.now() - start,
      });
    } catch (err) {
      this.logger.error({
        err: err instanceof Error ? err.message : err,
        duration_ms: Date.now() - start,
      }, 'cleanup_email_verifications_failed');
    }
  }
}
```

---

**Fin du prompt task-2.1.9-signup-email-verification.md.**
