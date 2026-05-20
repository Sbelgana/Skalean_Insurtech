/**
 * @insurtech/auth/services/lockout
 *
 * Anti-brute-force protection with progressive lockout (Tier 1->4) and IP tracking.
 * Sprint 5 Tache 2.1.10.
 *
 * Reference :
 *   - OWASP Authentication Cheat Sheet 2024
 *   - NIST SP 800-63B section 5.2.2
 *   - ACAPS circulaire 2024 (brute-force defense)
 */

import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import {
  AccountLockedError,
  AccountPermanentlyLockedError,
} from '../errors/lockout-errors.js';
import type { LockoutDecision, LockoutTier } from '../types/lockout.js';
import { nowInSeconds } from '../types/jwt-payload.js';
import {
  buildIpLockoutKey,
  buildUserLockoutKey,
  computeNextTier,
  lockedUntilForTier,
} from './lockout.helpers.js';
import { REDIS_TOKEN, type RedisLike } from './session.service.js';

/**
 * Minimal interface for the Redis hash operations LockoutService needs.
 * Compatible with ioredis and ioredis-mock.
 */
export interface RedisHashLike extends RedisLike {
  hincrby(key: string, field: string, increment: number): Promise<number>;
  hget(key: string, field: string): Promise<string | null>;
  hset(key: string, ...args: (string | number)[]): Promise<number>;
  hgetall(key: string): Promise<Record<string, string>>;
  incr(key: string): Promise<number>;
}

@Injectable()
export class LockoutService implements OnModuleInit {
  private readonly logger = new Logger(LockoutService.name);
  private readonly maxAttemptsPerTier: number;
  private readonly ipMaxFails: number;
  private readonly ipWindowSeconds: number;
  /** Reserved for a future "IP lock" feature (Sprint 6+). Currently unused. */
  readonly ipLockDurationSeconds: number;
  private readonly userKeyTtlSeconds = 7 * 24 * 60 * 60;

  constructor(@Inject(REDIS_TOKEN) private readonly redis: RedisHashLike) {
    this.maxAttemptsPerTier = Number.parseInt(
      process.env['LOCKOUT_FAILED_ATTEMPTS_PER_TIER'] ?? '5',
      10,
    );
    this.ipMaxFails = Number.parseInt(process.env['LOCKOUT_IP_MAX_FAILS'] ?? '50', 10);
    this.ipWindowSeconds = Number.parseInt(
      process.env['LOCKOUT_IP_WINDOW_SECONDS'] ?? '900',
      10,
    );
    this.ipLockDurationSeconds = Number.parseInt(
      process.env['LOCKOUT_IP_LOCK_DURATION_SECONDS'] ?? '3600',
      10,
    );
  }

  onModuleInit(): void {
    this.logger.log({
      action: 'lockout_service_init',
      max_attempts_per_tier: this.maxAttemptsPerTier,
      ip_max_fails: this.ipMaxFails,
    });
  }

  /**
   * Records a failed login attempt for (user, ip).
   * Returns a LockoutDecision indicating whether to allow the next attempt.
   * Throws AccountLockedError/AccountPermanentlyLockedError when the resulting state locks.
   */
  async recordFailedAttempt(input: {
    user_id: string;
    ip: string;
    email: string;
  }): Promise<LockoutDecision> {
    const now = nowInSeconds();
    const userKey = buildUserLockoutKey(input.user_id);
    const ipKey = buildIpLockoutKey(input.ip);

    const userAttempts = await this.redis.hincrby(userKey, 'failed_attempts', 1);
    await this.redis.hset(userKey, 'last_attempt_at', String(now));
    await this.redis.expire(userKey, this.userKeyTtlSeconds);

    const currentTierRaw = await this.redis.hget(userKey, 'current_tier');
    const currentTier = (currentTierRaw ? Number(currentTierRaw) : 0) as LockoutTier | 0;

    const ipFails = await this.redis.incr(ipKey);
    if (ipFails === 1) {
      await this.redis.expire(ipKey, this.ipWindowSeconds);
    }

    const nextTier = computeNextTier(userAttempts, currentTier, this.maxAttemptsPerTier);
    if (nextTier !== currentTier && nextTier > 0) {
      const lockedUntil = lockedUntilForTier(nextTier as LockoutTier, now);
      await this.redis.hset(
        userKey,
        'failed_attempts',
        '0',
        'current_tier',
        String(nextTier),
        'locked_until',
        String(lockedUntil),
      );

      this.logger.warn({
        action: 'account_locked',
        user_id: input.user_id,
        ip: input.ip,
        email: input.email,
        tier: nextTier,
        locked_until: lockedUntil,
      });

      if (nextTier === 4) {
        throw new AccountPermanentlyLockedError();
      }
      throw new AccountLockedError(lockedUntil, nextTier);
    }

    return {
      allow: true,
      next_tier_after_attempts: this.maxAttemptsPerTier - userAttempts,
    };
  }

  /**
   * Resets attempt counter on successful login. Keeps the tier history.
   */
  async recordSuccess(userId: string): Promise<void> {
    const key = buildUserLockoutKey(userId);
    await this.redis.hset(key, 'failed_attempts', '0', 'locked_until', '');
    this.logger.log({ action: 'lockout_reset_on_success', user_id: userId });
  }

  /**
   * Checks whether the user is currently locked. Throws if so.
   * Returns the snapshot otherwise.
   */
  async assertNotLocked(userId: string): Promise<void> {
    const key = buildUserLockoutKey(userId);
    const lockedUntilRaw = await this.redis.hget(key, 'locked_until');
    const tierRaw = await this.redis.hget(key, 'current_tier');
    if (!lockedUntilRaw || lockedUntilRaw === '0' || lockedUntilRaw === '') return;
    const lockedUntil = Number(lockedUntilRaw);
    const tier = (tierRaw ? Number(tierRaw) : 0) as LockoutTier | 0;
    if (tier === 4) throw new AccountPermanentlyLockedError();
    if (lockedUntil > nowInSeconds()) {
      throw new AccountLockedError(lockedUntil, tier);
    }
  }

  /** Manually clears a lockout (admin / recovery flow). */
  async clearLockout(userId: string): Promise<void> {
    const key = buildUserLockoutKey(userId);
    await this.redis.hset(
      key,
      'failed_attempts',
      '0',
      'current_tier',
      '0',
      'locked_until',
      '',
    );
    this.logger.log({ action: 'lockout_cleared_manual', user_id: userId });
  }

  /** Returns current state for the user (snapshot). */
  async getState(userId: string): Promise<{
    failed_attempts: number;
    current_tier: LockoutTier | 0;
    locked_until: number | null;
  }> {
    const key = buildUserLockoutKey(userId);
    const all = await this.redis.hgetall(key);
    const lockedUntilRaw = all['locked_until'];
    return {
      failed_attempts: Number(all['failed_attempts'] ?? '0'),
      current_tier: (Number(all['current_tier'] ?? '0') as LockoutTier | 0),
      locked_until: lockedUntilRaw && lockedUntilRaw !== '' ? Number(lockedUntilRaw) : null,
    };
  }
}
