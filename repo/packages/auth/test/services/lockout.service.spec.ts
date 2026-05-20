/**
 * Tests for @insurtech/auth/services/lockout.service
 * Sprint 5 Tache 2.1.10
 */

import RedisMock from 'ioredis-mock';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  AccountLockedError,
  AccountPermanentlyLockedError,
} from '../../src/errors/lockout-errors.js';
import { LockoutService, type RedisHashLike } from '../../src/services/lockout.service.js';

describe('LockoutService', () => {
  let svc: LockoutService;
  let redis: RedisHashLike;

  beforeEach(async () => {
    const mock = new RedisMock();
    await (mock as unknown as { flushall(): Promise<string> }).flushall();
    redis = mock as unknown as RedisHashLike;
    svc = new LockoutService(redis);
    svc.onModuleInit();
  });

  describe('recordFailedAttempt', () => {
    it('allows first attempts, decrements remaining', async () => {
      const r = await svc.recordFailedAttempt({
        user_id: 'u1',
        ip: '1.2.3.4',
        email: 'a@b.co',
      });
      expect(r.allow).toBe(true);
      expect(r.next_tier_after_attempts).toBe(4);
    });

    it('locks at tier 1 after 5 failures (5 min)', async () => {
      const fn = (): Promise<unknown> =>
        svc.recordFailedAttempt({ user_id: 'u1', ip: '1.2.3.4', email: 'a@b.co' });
      await fn();
      await fn();
      await fn();
      await fn();
      await expect(fn()).rejects.toBeInstanceOf(AccountLockedError);
    });

    it('escalates to tier 2 after another 5 failures', async () => {
      const fn = (): Promise<unknown> =>
        svc.recordFailedAttempt({ user_id: 'u2', ip: '1.2.3.4', email: 'b@b.co' });
      for (let i = 0; i < 4; i += 1) await fn();
      try {
        await fn();
      } catch {
        // tier 1 reached
      }
      for (let i = 0; i < 4; i += 1) await fn();
      let lastError: unknown;
      try {
        await fn();
      } catch (err) {
        lastError = err;
      }
      expect(lastError).toBeInstanceOf(AccountLockedError);
      if (lastError instanceof AccountLockedError) {
        expect(lastError.current_tier).toBe(2);
      }
    });

    it('throws AccountPermanentlyLockedError after 20 cumulative failures', async () => {
      const fn = (): Promise<unknown> =>
        svc.recordFailedAttempt({ user_id: 'u3', ip: '1.2.3.4', email: 'c@b.co' });
      // 4 tier transitions x 5 failures = 20 failures
      let permanentLock = false;
      for (let i = 0; i < 30; i += 1) {
        try {
          await fn();
        } catch (err) {
          if (err instanceof AccountPermanentlyLockedError) {
            permanentLock = true;
            break;
          }
        }
      }
      expect(permanentLock).toBe(true);
    });
  });

  describe('recordSuccess', () => {
    it('resets failed_attempts counter', async () => {
      await svc.recordFailedAttempt({ user_id: 'u1', ip: '1.2.3.4', email: 'a@b.co' });
      await svc.recordFailedAttempt({ user_id: 'u1', ip: '1.2.3.4', email: 'a@b.co' });
      await svc.recordSuccess('u1');
      const r = await svc.recordFailedAttempt({
        user_id: 'u1',
        ip: '1.2.3.4',
        email: 'a@b.co',
      });
      expect(r.allow).toBe(true);
      expect(r.next_tier_after_attempts).toBe(4);
    });
  });

  describe('assertNotLocked', () => {
    it('passes when not locked', async () => {
      await expect(svc.assertNotLocked('u1')).resolves.toBeUndefined();
    });

    it('throws when locked', async () => {
      const fn = (): Promise<unknown> =>
        svc.recordFailedAttempt({ user_id: 'u1', ip: '1.2.3.4', email: 'a@b.co' });
      for (let i = 0; i < 5; i += 1) {
        try {
          await fn();
        } catch {
          // ignore
        }
      }
      await expect(svc.assertNotLocked('u1')).rejects.toBeInstanceOf(AccountLockedError);
    });
  });

  describe('clearLockout', () => {
    it('clears tier and locked_until', async () => {
      const fn = (): Promise<unknown> =>
        svc.recordFailedAttempt({ user_id: 'u1', ip: '1.2.3.4', email: 'a@b.co' });
      for (let i = 0; i < 5; i += 1) {
        try {
          await fn();
        } catch {
          // ignore
        }
      }
      await svc.clearLockout('u1');
      await expect(svc.assertNotLocked('u1')).resolves.toBeUndefined();
    });
  });

  describe('getState', () => {
    it('returns current snapshot', async () => {
      await svc.recordFailedAttempt({ user_id: 'u1', ip: '1.2.3.4', email: 'a@b.co' });
      const s = await svc.getState('u1');
      expect(s.failed_attempts).toBe(1);
      expect(s.current_tier).toBe(0);
    });
  });
});
