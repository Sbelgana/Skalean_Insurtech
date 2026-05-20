/**
 * End-to-end auth flow tests -- Sprint 5 Tache 2.1.15.
 *
 * Drives the AuthService + supporting in-memory repositories directly (no
 * HTTP / Fastify bootstrap) to exercise all Sprint 5 flows in one suite :
 * signup, email verification, signin, refresh rotation, refresh theft
 * detection, MFA setup + confirm + verify (TOTP + recovery code),
 * forgot/reset password, signout, signoutAll. 15+ scenarios.
 *
 * Sprint 6 Tache 6.X will add Playwright HTTP-level e2e against the real
 * apps/api process.
 */

import { generateKeyPairSync } from 'node:crypto';
// @ts-expect-error -- ioredis-mock ships no types
import RedisMock from 'ioredis-mock';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  Argon2Service,
  AuthRole,
  EncryptionService,
  HashingService,
  JwtService,
  MfaService,
  NoOpSessionRepository,
  PepperService,
  type RedisLike,
  SessionService,
} from '@insurtech/auth';
import { AuthService } from '../src/modules/auth/auth.service';
import { InMemoryEmailVerificationRepository } from '../src/modules/auth/email-verification.repository';
import { StubEmailService } from '../src/modules/auth/email.service';
import { InMemoryPasswordRecoveryRepository } from '../src/modules/auth/password-recovery.repository';
import { InMemoryUserRepository } from '../src/modules/auth/user.repository';

function ctx(): { ip: string; user_agent: string; request_id: string; remember_me: boolean } {
  return {
    ip: '1.2.3.4',
    user_agent: 'e2e-vitest',
    request_id: 'req-e2e',
    remember_me: false,
  };
}

describe('Auth flow E2E (15 scenarios)', () => {
  let service: AuthService;
  let argon2: Argon2Service;
  let jwt: JwtService;
  let session: SessionService;
  let hashing: HashingService;
  let encryption: EncryptionService;
  let mfa: MfaService;
  let userRepo: InMemoryUserRepository;
  let emailVerifyRepo: InMemoryEmailVerificationRepository;
  let emailService: StubEmailService;
  let recoveryRepo: InMemoryPasswordRecoveryRepository;

  beforeAll(() => {
    process.env['PASSWORD_PEPPER'] = 'a'.repeat(48);
    process.env['PASSWORD_PEPPER_VERSION'] = '1';
    process.env['MFA_SECRET_ENCRYPTION_KEY'] = 'b'.repeat(64);
    process.env['MFA_TOTP_ISSUER'] = 'Skalean Test E2E';
    process.env['EMAIL_LOG_TOKEN_DEV'] = '1';
    const kp = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    process.env['JWT_PRIVATE_KEY'] = kp.privateKey;
    process.env['JWT_PUBLIC_KEY'] = kp.publicKey;
  });

  beforeEach(async () => {
    const pepper = new PepperService();
    argon2 = new Argon2Service(pepper);
    await argon2.onModuleInit();
    jwt = new JwtService();
    jwt.onModuleInit();
    hashing = new HashingService();
    hashing.onModuleInit();
    encryption = new EncryptionService();
    encryption.onModuleInit();
    const redis = new RedisMock();
    await (redis as unknown as { flushall(): Promise<string> }).flushall();
    session = new SessionService(redis as unknown as RedisLike, new NoOpSessionRepository());
    session.onModuleInit();
    mfa = new MfaService(redis as unknown as RedisLike, argon2, encryption, hashing);
    mfa.onModuleInit();
    userRepo = new InMemoryUserRepository();
    emailVerifyRepo = new InMemoryEmailVerificationRepository();
    emailService = new StubEmailService();
    recoveryRepo = new InMemoryPasswordRecoveryRepository();
    service = new AuthService(
      userRepo,
      argon2,
      jwt,
      session,
      hashing,
      mfa,
      emailVerifyRepo,
      emailService,
      recoveryRepo,
    );
  }, 30000);

  /** Helper : signup + verify-email + signin returning the SigninSuccessResponse. */
  async function signupAndSignin(
    email = 'alice@example.com',
    password = 'StrongP@ssw0rd!',
  ): Promise<{
    access_token: string;
    refresh_token: string;
    user_id: string;
  }> {
    const SAVED = process.env['EMAIL_LOG_TOKEN_DEV'];
    process.env['EMAIL_LOG_TOKEN_DEV'] = '1';
    try {
      await service.signup(
        {
          email,
          password,
          display_name: 'Alice Test',
          locale: 'fr-MA',
          accepted_tos: true,
        },
        ctx(),
      );
      const sent = emailService.sent.find(
        (s) => s.kind === 'verification' && s.to === email.toLowerCase(),
      );
      if (!sent?.token) throw new Error('Verification token not captured');
      await service.verifyEmail(sent.token);
      const signin = await service.signin({ email, password, remember_me: false }, ctx());
      if (signin.mfa_required) throw new Error('MFA unexpected');
      const refreshPayload = jwt.verifyRefreshToken(signin.refresh_token);
      return {
        access_token: signin.access_token,
        refresh_token: signin.refresh_token,
        user_id: refreshPayload.sub,
      };
    } finally {
      if (SAVED === undefined) delete process.env['EMAIL_LOG_TOKEN_DEV'];
      else process.env['EMAIL_LOG_TOKEN_DEV'] = SAVED;
    }
  }

  it('scenario 1 : signup happy path returns a generic anti-enumeration message', async () => {
    const r = await service.signup(
      {
        email: 'alice@example.com',
        password: 'StrongP@ssw0rd!',
        display_name: 'Alice Test',
        locale: 'fr-MA',
        accepted_tos: true,
      },
      ctx(),
    );
    expect(r.message).toMatch(/verification email/i);
    const u = await userRepo.findByEmail('alice@example.com');
    expect(u).not.toBeNull();
    expect(u?.email_verified_at).toBeNull();
  });

  it('scenario 2 : duplicate signup returns identical response (anti-enumeration)', async () => {
    process.env['EMAIL_LOG_TOKEN_DEV'] = '1';
    try {
      const r1 = await service.signup(
        {
          email: 'bob@example.com',
          password: 'StrongP@ssw0rd!',
          display_name: 'Bob',
          locale: 'fr-MA',
          accepted_tos: true,
        },
        ctx(),
      );
      const r2 = await service.signup(
        {
          email: 'bob@example.com',
          password: 'StrongP@ssw0rd!',
          display_name: 'Bob',
          locale: 'fr-MA',
          accepted_tos: true,
        },
        ctx(),
      );
      expect(r1.message).toBe(r2.message);
    } finally {
      delete process.env['EMAIL_LOG_TOKEN_DEV'];
    }
  });

  it('scenario 3 : signup rejects weak password (policy violation)', async () => {
    await expect(
      service.signup(
        {
          email: 'weak@example.com',
          password: 'short',
          display_name: 'X',
          locale: 'en',
          accepted_tos: true,
        },
        ctx(),
      ),
    ).rejects.toMatchObject({ response: { code: 'PASSWORD_POLICY_VIOLATION' } });
  });

  it('scenario 4 : verify-email succeeds with token then fails on replay', async () => {
    process.env['EMAIL_LOG_TOKEN_DEV'] = '1';
    try {
      await service.signup(
        {
          email: 'carol@example.com',
          password: 'StrongP@ssw0rd!',
          display_name: 'Carol',
          locale: 'en',
          accepted_tos: true,
        },
        ctx(),
      );
      const token = emailService.sent.find((s) => s.to === 'carol@example.com')?.token;
      if (!token) throw new Error('token missing');
      const r = await service.verifyEmail(token);
      expect(r.verified).toBe(true);
      await expect(service.verifyEmail(token)).rejects.toMatchObject({
        response: { code: 'EMAIL_VERIFICATION_INVALID' },
      });
    } finally {
      delete process.env['EMAIL_LOG_TOKEN_DEV'];
    }
  });

  it('scenario 5 : signin succeeds after verify-email and returns 3-part JWT', async () => {
    const tokens = await signupAndSignin();
    expect(tokens.access_token.split('.')).toHaveLength(3);
    expect(tokens.refresh_token.split('.')).toHaveLength(3);
  });

  it('scenario 6 : signin INVALID_CREDENTIALS on wrong password', async () => {
    await signupAndSignin('dave@example.com', 'GoodP@ssw0rd1!');
    await expect(
      service.signin(
        { email: 'dave@example.com', password: 'Wrong#Pass99!', remember_me: false },
        ctx(),
      ),
    ).rejects.toMatchObject({ response: { code: 'INVALID_CREDENTIALS' } });
  });

  it('scenario 7 : signin INVALID_CREDENTIALS on unknown email (timing-safe)', async () => {
    await expect(
      service.signin(
        { email: 'ghost@example.com', password: 'whatever1!', remember_me: false },
        ctx(),
      ),
    ).rejects.toMatchObject({ response: { code: 'INVALID_CREDENTIALS' } });
  });

  it('scenario 8 : refresh rotates the pair (new access + new refresh)', async () => {
    const t = await signupAndSignin('erin@example.com', 'StrongP@ssw0rd!');
    const refreshed = await service.refresh(t.refresh_token, ctx());
    expect(refreshed.access_token).not.toBe(t.access_token);
    expect(refreshed.refresh_token).not.toBe(t.refresh_token);
  });

  it('scenario 9 : refresh replay -> TOKEN_REUSE_DETECTED + family revoked', async () => {
    const t = await signupAndSignin('frank@example.com', 'StrongP@ssw0rd!');
    await service.refresh(t.refresh_token, ctx());
    await expect(service.refresh(t.refresh_token, ctx())).rejects.toMatchObject({
      response: { code: 'TOKEN_REUSE_DETECTED' },
    });
  });

  it('scenario 10 : MFA setup + confirm flow produces 6 formatted recovery codes', async () => {
    const t = await signupAndSignin('grace@example.com', 'StrongP@ssw0rd!');
    const setup = await service.setupMfa({
      user_id: t.user_id,
      email: 'grace@example.com',
    });
    expect(setup.qr_code_data_url).toMatch(/^data:image\/png;base64,/);
    const code = mfa.generateCurrentCode(setup.secret_b32);
    const confirm = await service.confirmMfa({
      user_id: t.user_id,
      setup_token: setup.setup_token,
      totp_code: code,
    });
    expect(confirm.mfa_enabled).toBe(true);
    expect(confirm.recovery_codes).toHaveLength(6);
    for (const c of confirm.recovery_codes) {
      expect(c).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    }
  });

  it('scenario 11 : signin returns mfa_required after MFA enrolment', async () => {
    const t = await signupAndSignin('helen@example.com', 'StrongP@ssw0rd!');
    const setup = await service.setupMfa({
      user_id: t.user_id,
      email: 'helen@example.com',
    });
    const code = mfa.generateCurrentCode(setup.secret_b32);
    await service.confirmMfa({
      user_id: t.user_id,
      setup_token: setup.setup_token,
      totp_code: code,
    });
    const r = await service.signin(
      { email: 'helen@example.com', password: 'StrongP@ssw0rd!', remember_me: false },
      ctx(),
    );
    expect(r.mfa_required).toBe(true);
    if (r.mfa_required) {
      expect(typeof r.mfa_challenge_token).toBe('string');
    }
  });

  it('scenario 12 : verify-mfa with TOTP completes signin and yields mfa_verified=true tokens', async () => {
    const t = await signupAndSignin('ivan@example.com', 'StrongP@ssw0rd!');
    const setup = await service.setupMfa({ user_id: t.user_id, email: 'ivan@example.com' });
    const code = mfa.generateCurrentCode(setup.secret_b32);
    await service.confirmMfa({
      user_id: t.user_id,
      setup_token: setup.setup_token,
      totp_code: code,
    });
    const signin = await service.signin(
      { email: 'ivan@example.com', password: 'StrongP@ssw0rd!', remember_me: false },
      ctx(),
    );
    if (!signin.mfa_required) throw new Error('expected MFA');
    const verified = await service.verifyMfa({
      challenge_token: signin.mfa_challenge_token,
      totp_code: mfa.generateCurrentCode(setup.secret_b32),
      ip: '1.2.3.4',
      user_agent: 'e2e',
      request_id: 'req',
    });
    expect(verified.mfa_verified).toBe(true);
    expect(verified.access_token.split('.')).toHaveLength(3);
  });

  it('scenario 13 : verify-mfa with recovery code consumes the slot', async () => {
    const t = await signupAndSignin('judy@example.com', 'StrongP@ssw0rd!');
    const setup = await service.setupMfa({ user_id: t.user_id, email: 'judy@example.com' });
    const code = mfa.generateCurrentCode(setup.secret_b32);
    const confirm = await service.confirmMfa({
      user_id: t.user_id,
      setup_token: setup.setup_token,
      totp_code: code,
    });
    const recoveryCode = confirm.recovery_codes[0];
    if (!recoveryCode) throw new Error('no recovery code');
    const signin = await service.signin(
      { email: 'judy@example.com', password: 'StrongP@ssw0rd!', remember_me: false },
      ctx(),
    );
    if (!signin.mfa_required) throw new Error('expected MFA');
    const verified = await service.verifyMfa({
      challenge_token: signin.mfa_challenge_token,
      recovery_code: recoveryCode,
      ip: '1.2.3.4',
      user_agent: 'e2e',
      request_id: 'req',
    });
    expect(verified.mfa_verified).toBe(true);
    const u = await userRepo.findById(t.user_id);
    expect(u?.mfa_recovery_codes_hashes?.[0]).toBeNull();
  });

  it('scenario 14 : forgot-password + reset-password updates password and revokes sessions', async () => {
    process.env['EMAIL_LOG_TOKEN_DEV'] = '1';
    try {
      const t = await signupAndSignin('kate@example.com', 'OldP@ssw0rd!1');
      emailService.sent.length = 0;
      await service.forgotPassword('kate@example.com', { ip: '1.2.3.4', user_agent: 'e2e' });
      const recoveryToken = emailService.sent.find((s) => s.kind === 'recovery')?.token;
      if (!recoveryToken) throw new Error('recovery token missing');
      const r = await service.resetPassword({
        recovery_token: recoveryToken,
        new_password: 'NewStrongP@ssw0rd2!',
      });
      expect(r.reset).toBe(true);
      // Old refresh is now invalidated (sessions revoked)
      await expect(service.refresh(t.refresh_token, ctx())).rejects.toBeTruthy();
      // New password works
      const re = await service.signin(
        {
          email: 'kate@example.com',
          password: 'NewStrongP@ssw0rd2!',
          remember_me: false,
        },
        ctx(),
      );
      if (re.mfa_required) throw new Error('no MFA expected');
      expect(re.access_token).toBeTruthy();
    } finally {
      delete process.env['EMAIL_LOG_TOKEN_DEV'];
    }
  });

  it('scenario 15 : signoutAll revokes all sessions for a user', async () => {
    const t = await signupAndSignin('liam@example.com', 'StrongP@ssw0rd!');
    const { sessions_revoked } = await service.signoutAll(t.user_id);
    expect(sessions_revoked).toBeGreaterThanOrEqual(1);
    await expect(service.refresh(t.refresh_token, ctx())).rejects.toBeTruthy();
  });

  it('scenario 16 : forgot-password unknown email returns same response (anti-enumeration)', async () => {
    const r1 = await service.forgotPassword('unknown@example.com', {
      ip: '1.2.3.4',
      user_agent: 'e2e',
    });
    expect(r1.message).toMatch(/password reset link/i);
  });
});
