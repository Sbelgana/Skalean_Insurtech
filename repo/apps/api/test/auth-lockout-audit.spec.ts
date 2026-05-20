/**
 * Sprint 5 closure -- integration tests for LockoutService + AuditAuthService
 * wired into AuthService.signin.
 *
 * Verifies :
 *   - 5 wrong-password attempts trigger tier 1 lock (5 min)
 *   - Locked account rejects 6th attempt with ACCOUNT_LOCKED
 *   - Each signin attempt produces an audit event (success / failed / locked)
 *   - successful signin clears the failed counter
 */

import { generateKeyPairSync } from 'node:crypto';
// @ts-expect-error -- ioredis-mock ships no types
import RedisMock from 'ioredis-mock';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  Argon2Service,
  AuthEventKind,
  AuthRole,
  EncryptionService,
  HashingService,
  JwtService,
  LockoutService,
  MfaService,
  NoOpSessionRepository,
  PepperService,
  type RedisHashLike,
  type RedisLike,
  SessionService,
} from '@insurtech/auth';
import { AuditAuthService, PinoAuditPublisher } from '../src/modules/auth/audit-auth.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { InMemoryEmailVerificationRepository } from '../src/modules/auth/email-verification.repository';
import { StubEmailService } from '../src/modules/auth/email.service';
import { InMemoryPasswordRecoveryRepository } from '../src/modules/auth/password-recovery.repository';
import { InMemoryUserRepository, type AuthUser } from '../src/modules/auth/user.repository';

describe('AuthService LockoutService + AuditAuthService integration', () => {
  let service: AuthService;
  let argon2: Argon2Service;
  let userRepo: InMemoryUserRepository;
  let publisher: PinoAuditPublisher;

  beforeAll(() => {
    process.env['PASSWORD_PEPPER'] = 'a'.repeat(48);
    process.env['PASSWORD_PEPPER_VERSION'] = '1';
    process.env['MFA_SECRET_ENCRYPTION_KEY'] = 'b'.repeat(64);
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
    const jwt = new JwtService();
    jwt.onModuleInit();
    const hashing = new HashingService();
    hashing.onModuleInit();
    const encryption = new EncryptionService();
    encryption.onModuleInit();
    const redis = new RedisMock();
    await (redis as unknown as { flushall(): Promise<string> }).flushall();
    const session = new SessionService(redis as unknown as RedisLike, new NoOpSessionRepository());
    session.onModuleInit();
    const mfa = new MfaService(redis as unknown as RedisLike, argon2, encryption, hashing);
    mfa.onModuleInit();
    userRepo = new InMemoryUserRepository();
    const emailVerifyRepo = new InMemoryEmailVerificationRepository();
    const emailService = new StubEmailService();
    const recoveryRepo = new InMemoryPasswordRecoveryRepository();
    const lockout = new LockoutService(redis as unknown as RedisHashLike);
    lockout.onModuleInit();
    publisher = new PinoAuditPublisher();
    const audit = new AuditAuthService(publisher);
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
      lockout,
      audit,
    );
  }, 30000);

  async function seedUser(): Promise<AuthUser> {
    const passwordHash = await argon2.hash('CorrectP@ssw0rd!');
    return userRepo.create({
      id: 'u-lockout',
      email: 'lockout@example.com',
      display_name: 'Lockout Test',
      role: AuthRole.BrokerUser,
      tenant_id: 't1',
      password_hash: passwordHash,
      email_verified_at: new Date(),
      mfa_enabled: false,
      mfa_secret_encrypted: null,
      mfa_recovery_codes_hashes: null,
      mfa_setup_completed_at: null,
      is_active: true,
      deleted_at: null,
      locked_until: null,
      failed_login_attempts: 0,
      locale: 'fr-MA',
      created_at: new Date(),
      last_login_at: null,
      last_login_ip: null,
    });
  }

  const ctx = {
    ip: '1.2.3.4',
    user_agent: 'vitest',
    request_id: 'req-1',
    remember_me: false,
  };

  it('5 wrong-password attempts trigger ACCOUNT_LOCKED on the 5th (tier 1 = 5min)', async () => {
    await seedUser();
    const fn = (): Promise<unknown> =>
      service.signin(
        { email: 'lockout@example.com', password: 'Wrong#Pass99!', remember_me: false },
        ctx,
      );
    // Attempts 1..4 should return INVALID_CREDENTIALS
    for (let i = 0; i < 4; i += 1) {
      await expect(fn()).rejects.toMatchObject({ response: { code: 'INVALID_CREDENTIALS' } });
    }
    // 5th attempt triggers lockout : LockoutService throws AccountLockedError
    // which auth.service.translateLockoutError converts to ApiAuthError ACCOUNT_LOCKED
    await expect(fn()).rejects.toMatchObject({ response: { code: 'ACCOUNT_LOCKED' } });
  });

  it('locked account rejects with ACCOUNT_LOCKED on subsequent attempts', async () => {
    await seedUser();
    const fn = (): Promise<unknown> =>
      service.signin(
        { email: 'lockout@example.com', password: 'Wrong#Pass99!', remember_me: false },
        ctx,
      );
    for (let i = 0; i < 5; i += 1) {
      try {
        await fn();
      } catch {
        // ignore -- we want to reach locked state
      }
    }
    // Now even the correct password should fail because account is locked
    await expect(
      service.signin(
        { email: 'lockout@example.com', password: 'CorrectP@ssw0rd!', remember_me: false },
        ctx,
      ),
    ).rejects.toMatchObject({ response: { code: 'ACCOUNT_LOCKED' } });
  });

  it('successful signin publishes signin_success audit event', async () => {
    await seedUser();
    await service.signin(
      { email: 'lockout@example.com', password: 'CorrectP@ssw0rd!', remember_me: false },
      ctx,
    );
    const successEvents = publisher.published.filter(
      (e) => e.event_kind === AuthEventKind.SigninSuccess,
    );
    expect(successEvents.length).toBeGreaterThanOrEqual(1);
    expect(successEvents[0]?.user_email).toBe('lockout@example.com');
    expect(successEvents[0]?.ip).toBe('1.2.3.4');
  });

  it('failed signin publishes signin_failed audit event with reason', async () => {
    await seedUser();
    await expect(
      service.signin(
        { email: 'lockout@example.com', password: 'Wrong#Pass99!', remember_me: false },
        ctx,
      ),
    ).rejects.toBeTruthy();
    const failedEvents = publisher.published.filter(
      (e) => e.event_kind === AuthEventKind.SigninFailed,
    );
    expect(failedEvents.length).toBeGreaterThanOrEqual(1);
    expect((failedEvents[0]?.payload as { reason: string }).reason).toBe('invalid_credentials');
  });

  it('signup publishes signup_completed audit event', async () => {
    await service.signup(
      {
        email: 'audit-signup@example.com',
        password: 'StrongP@ssw0rd!',
        display_name: 'Audit Signup',
        locale: 'fr-MA',
        accepted_tos: true,
      },
      { ip: '1.2.3.4', user_agent: 'vitest', request_id: 'req-1' },
    );
    const completed = publisher.published.filter(
      (e) => e.event_kind === AuthEventKind.SignupCompleted,
    );
    expect(completed.length).toBeGreaterThanOrEqual(1);
    expect((completed[0]?.payload as { email: string }).email).toBe('audit-signup@example.com');
  });

  it('successful signin after a few failures resets the lockout counter', async () => {
    await seedUser();
    // 3 failed attempts (not enough to lock)
    for (let i = 0; i < 3; i += 1) {
      try {
        await service.signin(
          { email: 'lockout@example.com', password: 'Wrong#Pass99!', remember_me: false },
          ctx,
        );
      } catch {
        // ignore
      }
    }
    // Successful signin
    const r = await service.signin(
      { email: 'lockout@example.com', password: 'CorrectP@ssw0rd!', remember_me: false },
      ctx,
    );
    expect(r.mfa_required).toBe(false);
    // Subsequent 4 failed attempts should NOT trigger a lock (counter was reset)
    for (let i = 0; i < 4; i += 1) {
      await expect(
        service.signin(
          { email: 'lockout@example.com', password: 'Wrong#Pass99!', remember_me: false },
          ctx,
        ),
      ).rejects.toMatchObject({ response: { code: 'INVALID_CREDENTIALS' } });
    }
  });
});
