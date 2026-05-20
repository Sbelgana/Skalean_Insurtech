/**
 * Tests for AuthService -- direct instantiation (Sprint 1-4 pattern).
 * Sprint 5 Tache 2.1.6.
 */

import { generateKeyPairSync } from 'node:crypto';
// @ts-expect-error -- ioredis-mock ships no types
import RedisMock from 'ioredis-mock';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  Argon2Service,
  AuthRole,
  HashingService,
  JwtService,
  NoOpSessionRepository,
  PepperService,
  SessionService,
  type RedisLike,
} from '@insurtech/auth';
import { AuthService } from './auth.service';
import { InMemoryUserRepository, type AuthUser } from './user.repository';

describe('AuthService', () => {
  let argon2: Argon2Service;
  let jwt: JwtService;
  let session: SessionService;
  let hashing: HashingService;
  let userRepo: InMemoryUserRepository;
  let service: AuthService;
  const SAVED: Record<string, string | undefined> = {};
  const KEYS = [
    'PASSWORD_PEPPER',
    'PASSWORD_PEPPER_VERSION',
    'MFA_SECRET_ENCRYPTION_KEY',
    'JWT_PRIVATE_KEY',
    'JWT_PUBLIC_KEY',
  ];

  beforeAll(async () => {
    for (const k of KEYS) SAVED[k] = process.env[k];
    process.env['PASSWORD_PEPPER'] = 'a'.repeat(48);
    process.env['PASSWORD_PEPPER_VERSION'] = '1';
    process.env['MFA_SECRET_ENCRYPTION_KEY'] = 'b'.repeat(64);
    const kp = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    process.env['JWT_PRIVATE_KEY'] = kp.privateKey;
    process.env['JWT_PUBLIC_KEY'] = kp.publicKey;
  }, 30000);

  afterEach(() => {
    userRepo.clear();
  });

  beforeEach(async () => {
    const pepper = new PepperService();
    argon2 = new Argon2Service(pepper);
    await argon2.onModuleInit();
    jwt = new JwtService();
    jwt.onModuleInit();
    hashing = new HashingService();
    hashing.onModuleInit();
    const redis = new RedisMock();
    await (redis as unknown as { flushall(): Promise<string> }).flushall();
    session = new SessionService(redis as unknown as RedisLike, new NoOpSessionRepository());
    session.onModuleInit();
    userRepo = new InMemoryUserRepository();
    service = new AuthService(userRepo, argon2, jwt, session, hashing);
  }, 30000);

  async function seedUser(overrides: Partial<AuthUser> = {}): Promise<AuthUser> {
    const passwordHash = await argon2.hash('CorrectP@ssw0rd!');
    const u: AuthUser = {
      id: 'user-1',
      email: 'user@example.com',
      display_name: 'User One',
      role: AuthRole.BrokerUser,
      tenant_id: 'tenant-1',
      password_hash: passwordHash,
      email_verified_at: new Date(),
      mfa_enabled: false,
      mfa_secret_encrypted: null,
      is_active: true,
      deleted_at: null,
      locked_until: null,
      failed_login_attempts: 0,
      locale: 'fr-MA',
      created_at: new Date(),
      last_login_at: null,
      last_login_ip: null,
      ...overrides,
    };
    return userRepo.create(u);
  }

  const baseCtx = {
    ip: '1.2.3.4',
    user_agent: 'vitest',
    request_id: 'req-1',
    remember_me: false,
  };

  describe('signin', () => {
    it('returns access + refresh tokens on valid credentials', async () => {
      await seedUser();
      const result = await service.signin(
        { email: 'user@example.com', password: 'CorrectP@ssw0rd!', remember_me: false },
        baseCtx,
      );
      expect(result.mfa_required).toBe(false);
      if (!result.mfa_required) {
        expect(typeof result.access_token).toBe('string');
        expect(result.access_token.split('.')).toHaveLength(3);
        expect(typeof result.refresh_token).toBe('string');
        expect(result.user.email).toBe('user@example.com');
      }
    });

    it('throws INVALID_CREDENTIALS on wrong password', async () => {
      await seedUser();
      await expect(
        service.signin(
          { email: 'user@example.com', password: 'WrongPass1!', remember_me: false },
          baseCtx,
        ),
      ).rejects.toMatchObject({ response: { code: 'INVALID_CREDENTIALS' } });
    });

    it('throws INVALID_CREDENTIALS on unknown email (timing-safe)', async () => {
      await expect(
        service.signin(
          { email: 'ghost@example.com', password: 'whatever1!', remember_me: false },
          baseCtx,
        ),
      ).rejects.toMatchObject({ response: { code: 'INVALID_CREDENTIALS' } });
    });

    it('throws ACCOUNT_LOCKED if locked_until is in the future', async () => {
      await seedUser({ locked_until: new Date(Date.now() + 60_000) });
      await expect(
        service.signin(
          { email: 'user@example.com', password: 'CorrectP@ssw0rd!', remember_me: false },
          baseCtx,
        ),
      ).rejects.toMatchObject({ response: { code: 'ACCOUNT_LOCKED' } });
    });

    it('throws ACCOUNT_DISABLED when is_active=false', async () => {
      await seedUser({ is_active: false });
      await expect(
        service.signin(
          { email: 'user@example.com', password: 'CorrectP@ssw0rd!', remember_me: false },
          baseCtx,
        ),
      ).rejects.toMatchObject({ response: { code: 'ACCOUNT_DISABLED' } });
    });

    it('throws EMAIL_NOT_VERIFIED if email_verified_at is null', async () => {
      await seedUser({ email_verified_at: null });
      await expect(
        service.signin(
          { email: 'user@example.com', password: 'CorrectP@ssw0rd!', remember_me: false },
          baseCtx,
        ),
      ).rejects.toMatchObject({ response: { code: 'EMAIL_NOT_VERIFIED' } });
    });

    it('returns mfa_required=true for users with mfa_enabled', async () => {
      await seedUser({ mfa_enabled: true });
      const result = await service.signin(
        { email: 'user@example.com', password: 'CorrectP@ssw0rd!', remember_me: false },
        baseCtx,
      );
      expect(result.mfa_required).toBe(true);
      if (result.mfa_required) {
        expect(typeof result.mfa_challenge_token).toBe('string');
        expect(result.mfa_challenge_expires_at).toBeGreaterThan(Math.floor(Date.now() / 1000));
      }
    });

    it('returns mfa_required for privileged roles (broker_admin) even without enrol', async () => {
      await seedUser({ role: AuthRole.BrokerAdmin });
      const result = await service.signin(
        { email: 'user@example.com', password: 'CorrectP@ssw0rd!', remember_me: false },
        baseCtx,
      );
      expect(result.mfa_required).toBe(true);
    });
  });

  describe('refresh', () => {
    it('rotates the refresh token (new access + refresh issued)', async () => {
      await seedUser();
      const signinResult = await service.signin(
        { email: 'user@example.com', password: 'CorrectP@ssw0rd!', remember_me: false },
        baseCtx,
      );
      if (signinResult.mfa_required) throw new Error('expected no MFA');
      const refreshed = await service.refresh(signinResult.refresh_token, baseCtx);
      expect(refreshed.access_token).not.toBe(signinResult.access_token);
      expect(refreshed.refresh_token).not.toBe(signinResult.refresh_token);
    });

    it('throws TOKEN_REUSE_DETECTED on replay of old refresh token', async () => {
      await seedUser();
      const signinResult = await service.signin(
        { email: 'user@example.com', password: 'CorrectP@ssw0rd!', remember_me: false },
        baseCtx,
      );
      if (signinResult.mfa_required) throw new Error('expected no MFA');
      await service.refresh(signinResult.refresh_token, baseCtx);
      await expect(service.refresh(signinResult.refresh_token, baseCtx)).rejects.toMatchObject({
        response: { code: 'TOKEN_REUSE_DETECTED' },
      });
    });

    it('throws INVALID_REFRESH_TOKEN on malformed refresh token', async () => {
      await expect(service.refresh('not-a-jwt', baseCtx)).rejects.toMatchObject({
        response: { code: 'INVALID_REFRESH_TOKEN' },
      });
    });
  });

  describe('signout', () => {
    it('revokes the session', async () => {
      await seedUser();
      const signinResult = await service.signin(
        { email: 'user@example.com', password: 'CorrectP@ssw0rd!', remember_me: false },
        baseCtx,
      );
      if (signinResult.mfa_required) throw new Error('expected no MFA');
      const payload = jwt.verifyRefreshToken(signinResult.refresh_token);
      await service.signout(payload.jti);
      expect(await session.isRevoked(payload.jti)).toBe(true);
    });
  });
});
