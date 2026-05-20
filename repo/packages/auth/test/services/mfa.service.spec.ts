/**
 * Tests for @insurtech/auth/services/mfa.service
 * Sprint 5 Tache 2.1.7
 */

import RedisMock from 'ioredis-mock';
import { authenticator } from 'otplib';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Argon2Service } from '../../src/services/argon2.service.js';
import { EncryptionService } from '../../src/services/encryption.service.js';
import { HashingService } from '../../src/services/hashing.service.js';
import { MfaService } from '../../src/services/mfa.service.js';
import { PepperService } from '../../src/services/pepper.service.js';
import type { RedisLike } from '../../src/services/session.service.js';
import {
  MfaChallengeExpiredError,
  MfaInvalidCodeError,
  MfaSetupTokenExpiredError,
} from '../../src/errors/mfa-errors.js';

describe('MfaService', () => {
  let svc: MfaService;
  let argon2: Argon2Service;
  let encryption: EncryptionService;
  let hashing: HashingService;
  let redis: RedisLike;

  beforeAll(() => {
    process.env['PASSWORD_PEPPER'] = 'a'.repeat(48);
    process.env['PASSWORD_PEPPER_VERSION'] = '1';
    process.env['MFA_SECRET_ENCRYPTION_KEY'] = 'b'.repeat(64);
    process.env['MFA_TOTP_ISSUER'] = 'Skalean Test';
  });

  beforeEach(async () => {
    const pepper = new PepperService();
    argon2 = new Argon2Service(pepper);
    await argon2.onModuleInit();
    encryption = new EncryptionService();
    encryption.onModuleInit();
    hashing = new HashingService();
    hashing.onModuleInit();
    const mock = new RedisMock();
    await (mock as unknown as { flushall(): Promise<string> }).flushall();
    redis = mock as unknown as RedisLike;
    svc = new MfaService(redis, argon2, encryption, hashing);
    svc.onModuleInit();
  }, 30000);

  describe('startSetup', () => {
    it('returns secret_b32 + qr data url + otpauth url + setup_token', async () => {
      const r = await svc.startSetup({ user_id: 'u1', email: 'u1@example.com' });
      expect(typeof r.secret_b32).toBe('string');
      expect(r.secret_b32.length).toBeGreaterThanOrEqual(32);
      expect(r.qr_code_data_url).toMatch(/^data:image\/png;base64,/);
      expect(r.otpauth_url).toMatch(/^otpauth:\/\/totp\//);
      expect(typeof r.setup_token).toBe('string');
      expect(r.expires_at).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });
  });

  describe('confirmSetup', () => {
    it('confirms a valid TOTP code and returns encrypted secret + recovery codes', async () => {
      const setup = await svc.startSetup({ user_id: 'u1', email: 'u1@example.com' });
      const code = svc.generateCurrentCode(setup.secret_b32);
      const result = await svc.confirmSetup({
        setup_token: setup.setup_token,
        totp_code: code,
        user_id: 'u1',
      });
      expect(result.confirm.mfa_enabled).toBe(true);
      expect(result.recovery_codes_clear).toHaveLength(6);
      expect(result.recovery_codes_hashed).toHaveLength(6);
      for (const c of result.recovery_codes_clear) {
        expect(c).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
      }
      expect(result.encrypted_secret).toContain(':');
    });

    it('throws MfaInvalidCodeError on wrong code', async () => {
      const setup = await svc.startSetup({ user_id: 'u1', email: 'u1@example.com' });
      await expect(
        svc.confirmSetup({ setup_token: setup.setup_token, totp_code: '000000', user_id: 'u1' }),
      ).rejects.toBeInstanceOf(MfaInvalidCodeError);
    });

    it('throws MfaSetupTokenExpiredError on unknown setup_token', async () => {
      await expect(
        svc.confirmSetup({ setup_token: 'unknown', totp_code: '123456', user_id: 'u1' }),
      ).rejects.toBeInstanceOf(MfaSetupTokenExpiredError);
    });

    it('throws MfaSetupTokenExpiredError on user mismatch', async () => {
      const setup = await svc.startSetup({ user_id: 'u1', email: 'u1@example.com' });
      const code = svc.generateCurrentCode(setup.secret_b32);
      await expect(
        svc.confirmSetup({ setup_token: setup.setup_token, totp_code: code, user_id: 'u2' }),
      ).rejects.toBeInstanceOf(MfaSetupTokenExpiredError);
    });
  });

  describe('verifyEncryptedTotp', () => {
    it('verifies a fresh code against encrypted secret', async () => {
      const setup = await svc.startSetup({ user_id: 'u1', email: 'u1@example.com' });
      const code = svc.generateCurrentCode(setup.secret_b32);
      const confirmed = await svc.confirmSetup({
        setup_token: setup.setup_token,
        totp_code: code,
        user_id: 'u1',
      });
      const newCode = svc.generateCurrentCode(setup.secret_b32);
      const ok = await svc.verifyEncryptedTotp({
        encrypted_secret: confirmed.encrypted_secret,
        user_id: 'u1',
        totp_code: newCode,
      });
      expect(ok).toBe(true);
    });

    it('returns false for wrong AAD (different user_id)', async () => {
      const setup = await svc.startSetup({ user_id: 'u1', email: 'u1@example.com' });
      const code = svc.generateCurrentCode(setup.secret_b32);
      const confirmed = await svc.confirmSetup({
        setup_token: setup.setup_token,
        totp_code: code,
        user_id: 'u1',
      });
      const ok = await svc.verifyEncryptedTotp({
        encrypted_secret: confirmed.encrypted_secret,
        user_id: 'u2',
        totp_code: svc.generateCurrentCode(setup.secret_b32),
      });
      expect(ok).toBe(false);
    });
  });

  describe('verifyTotpCode (clear secret)', () => {
    it('verifies a freshly generated code', () => {
      const secret = authenticator.generateSecret(20);
      const code = svc.generateCurrentCode(secret);
      expect(svc.verifyTotpCode(secret, code)).toBe(true);
    });

    it('rejects malformed code', () => {
      const secret = authenticator.generateSecret(20);
      expect(svc.verifyTotpCode(secret, 'abc')).toBe(false);
    });

    it('rejects code generated with another secret', () => {
      const secret1 = authenticator.generateSecret(20);
      const secret2 = authenticator.generateSecret(20);
      const code = svc.generateCurrentCode(secret1);
      expect(svc.verifyTotpCode(secret2, code)).toBe(false);
    });
  });

  describe('challenge tokens', () => {
    it('creates + consumes a challenge token', async () => {
      const t = await svc.createChallengeToken({ user_id: 'u1', email: 'u1@example.com' });
      const consumed = await svc.consumeChallengeToken(t.token);
      expect(consumed.user_id).toBe('u1');
      expect(consumed.email).toBe('u1@example.com');
    });

    it('throws MfaChallengeExpiredError on second consume', async () => {
      const t = await svc.createChallengeToken({ user_id: 'u1', email: 'u1@example.com' });
      await svc.consumeChallengeToken(t.token);
      await expect(svc.consumeChallengeToken(t.token)).rejects.toBeInstanceOf(
        MfaChallengeExpiredError,
      );
    });

    it('throws on unknown token', async () => {
      await expect(svc.consumeChallengeToken('nope')).rejects.toBeInstanceOf(
        MfaChallengeExpiredError,
      );
    });
  });

  describe('verifyRecoveryCode', () => {
    it('returns valid=true with index on matching code', async () => {
      const codes = ['ABCD-1234-EFGH', 'XYZW-5678-IJKL'];
      const hashes = await Promise.all(codes.map((c) => argon2.hash(c)));
      const r = await svc.verifyRecoveryCode({ hashes, presented: 'xyzw-5678-ijkl' });
      expect(r.valid).toBe(true);
      expect(r.recovery_code_index_used).toBe(1);
      expect(r.used_recovery_code).toBe(true);
    });

    it('returns valid=false for malformed presented', async () => {
      const codes = ['ABCD-1234-EFGH'];
      const hashes = await Promise.all(codes.map((c) => argon2.hash(c)));
      const r = await svc.verifyRecoveryCode({ hashes, presented: 'not-a-code' });
      expect(r.valid).toBe(false);
    });

    it('skips null hashes (already used)', async () => {
      const codes = ['ABCD-1234-EFGH'];
      const realHash = await argon2.hash(codes[0] ?? '');
      const r = await svc.verifyRecoveryCode({
        hashes: [null, realHash],
        presented: 'ABCD1234EFGH',
      });
      expect(r.valid).toBe(true);
      expect(r.recovery_code_index_used).toBe(1);
    });
  });
});
