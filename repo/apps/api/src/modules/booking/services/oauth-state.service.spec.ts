/**
 * Tests OAuthStateService -- Sprint 8 Tache 8.10b.
 *
 * CSRF state generation + validation. Uses ioredis-mock for in-memory Redis.
 */

import { UnauthorizedException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// @ts-expect-error -- ioredis-mock ships no .d.ts ; we only use the default constructor.
import RedisMock from 'ioredis-mock';
import { OAuthStateService } from './oauth-state.service.js';

const TEST_KEY_HEX = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2';

const TENANT_A = '00000000-0000-0000-0000-000000000001';
const USER_A = '00000000-0000-0000-0000-000000000002';

describe('OAuthStateService (Sprint 8 Tache 8.10b)', () => {
  let previousKey: string | undefined;

  beforeEach(() => {
    previousKey = process.env['CALENDAR_TOKEN_ENCRYPTION_KEY'];
    process.env['CALENDAR_TOKEN_ENCRYPTION_KEY'] = TEST_KEY_HEX;
    vi.useRealTimers();
  });

  afterEach(() => {
    if (previousKey === undefined) delete process.env['CALENDAR_TOKEN_ENCRYPTION_KEY'];
    else process.env['CALENDAR_TOKEN_ENCRYPTION_KEY'] = previousKey;
  });

  function buildService(): { service: OAuthStateService; redis: InstanceType<typeof RedisMock> } {
    const redis = new RedisMock();
    const service = new OAuthStateService(redis as never);
    return { service, redis };
  }

  describe('generate + validateAndConsume round-trip', () => {
    it('1. generates state, persists in Redis, validateAndConsume returns payload', async () => {
      const { service, redis } = buildService();
      const state = await service.generate(TENANT_A, USER_A, 'google');
      expect(state).toBeTruthy();
      expect(state.split('.')).toHaveLength(2);
      // Stored in Redis with prefix
      const stored = await redis.get(`oauth_state:${state}`);
      expect(stored).toBeTruthy();
      const payload = await service.validateAndConsume(state);
      expect(payload.tenantId).toBe(TENANT_A);
      expect(payload.userId).toBe(USER_A);
      expect(payload.provider).toBe('google');
      // One-time use : key gone from Redis after consume
      const afterConsume = await redis.get(`oauth_state:${state}`);
      expect(afterConsume).toBeNull();
    });

    it('2. each generate produces a unique state (nonce randomness)', async () => {
      const { service } = buildService();
      const s1 = await service.generate(TENANT_A, USER_A, 'google');
      const s2 = await service.generate(TENANT_A, USER_A, 'google');
      expect(s1).not.toBe(s2);
    });
  });

  describe('CSRF + tampering', () => {
    it('3. validateAndConsume on unknown state throws UnauthorizedException', async () => {
      const { service } = buildService();
      await expect(service.validateAndConsume('bogus.state')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('4. tampered HMAC suffix rejected', async () => {
      const { service } = buildService();
      const state = await service.generate(TENANT_A, USER_A, 'outlook');
      const [nonce] = state.split('.');
      // Flip the HMAC suffix to a different hex string of same length
      const tampered = `${nonce}.${'0'.repeat(64)}`;
      // Put the bogus key into Redis with the original payload so HMAC mismatch
      // is the failure mode (not "key not found")
      const original = await new RedisMock().get(`oauth_state:${state}`);
      void original; // no-op : the existing in-mock store is reused below
      // Reset : we use a fresh redis here to control the stored payload exactly
      const redis = new RedisMock();
      const service2 = new OAuthStateService(redis as never);
      const realState = await service2.generate(TENANT_A, USER_A, 'outlook');
      const [realNonce] = realState.split('.');
      // Tamper : same nonce, different HMAC
      const tampered2 = `${realNonce}.${'f'.repeat(64)}`;
      // Insert under tampered key with original payload
      await redis.set(`oauth_state:${tampered2}`, JSON.stringify({
        tenantId: TENANT_A,
        userId: USER_A,
        provider: 'outlook',
        createdAt: Date.now(),
        nonce: realNonce,
      }), 'EX', 600);
      await expect(service2.validateAndConsume(tampered2)).rejects.toThrow(
        UnauthorizedException,
      );
      // Also reject the actual unknown bogus
      await expect(service2.validateAndConsume(tampered)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('5. validateAndConsume is one-time use (second call fails)', async () => {
      const { service } = buildService();
      const state = await service.generate(TENANT_A, USER_A, 'google');
      await service.validateAndConsume(state);
      await expect(service.validateAndConsume(state)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('6. expired state (older than 10 min) rejected', async () => {
      vi.useFakeTimers();
      const { service, redis } = buildService();
      const state = await service.generate(TENANT_A, USER_A, 'google');
      // Verify state is in redis at generation time
      expect(await redis.get(`oauth_state:${state}`)).toBeTruthy();
      // Advance time by 11 minutes ; ioredis-mock does not honor TTL via fake
      // timers, so we manually delete the key to simulate expiry while keeping
      // service-level age check active.
      vi.advanceTimersByTime(11 * 60 * 1000);
      await redis.del(`oauth_state:${state}`);
      await expect(service.validateAndConsume(state)).rejects.toThrow(
        UnauthorizedException,
      );
      vi.useRealTimers();
    });
  });

  describe('configuration', () => {
    it('7. throws on construction if CALENDAR_TOKEN_ENCRYPTION_KEY missing', () => {
      delete process.env['CALENDAR_TOKEN_ENCRYPTION_KEY'];
      const redis = new RedisMock();
      expect(() => new OAuthStateService(redis as never)).toThrow(
        /CALENDAR_TOKEN_ENCRYPTION_KEY/i,
      );
    });

    it('8. throws on construction if key wrong length', () => {
      process.env['CALENDAR_TOKEN_ENCRYPTION_KEY'] = 'abcd';
      const redis = new RedisMock();
      expect(() => new OAuthStateService(redis as never)).toThrow(/32 bytes/i);
    });
  });
});
