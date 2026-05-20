/**
 * @insurtech/auth/services/session
 *
 * Stateful session storage in Redis (DB 1) with optional SQL audit trail.
 * Implements OAuth 2.0 BCP refresh token rotation with theft detection.
 *
 * Sprint 5 Tache 2.1.5
 */

import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import {
  RefreshReplayDetectedError,
  SessionNotFoundError,
  SessionRevokedError,
} from '../errors/session-errors.js';
import { nowInSeconds } from '../types/jwt-payload.js';
import type {
  CreateSessionInput,
  RotateSessionInput,
  SessionMetadata,
} from '../types/session-metadata.js';
import {
  buildFamilyKey,
  buildRevokedKey,
  buildSessionKey,
  buildUserSessionsKey,
  isExpiredSession,
  parseSessionRecord,
  serializeSession,
} from './session.helpers.js';
import { SESSION_REPOSITORY_TOKEN, type SessionRepository } from './session.repository.js';

export const REDIS_TOKEN = Symbol('SESSION_REDIS');

/**
 * Minimal Redis client interface (ioredis-compatible) -- accepts mocks in tests.
 */
export interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode?: string, duration?: number): Promise<string | null>;
  del(key: string): Promise<number>;
  exists(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  sadd(key: string, ...members: string[]): Promise<number>;
  srem(key: string, ...members: string[]): Promise<number>;
  smembers(key: string): Promise<string[]>;
  eval(script: string, numkeys: number, ...args: (string | number)[]): Promise<unknown>;
  multi(): RedisMulti;
}

export interface RedisMulti {
  set(key: string, value: string, mode?: string, duration?: number): RedisMulti;
  del(key: string): RedisMulti;
  sadd(key: string, ...members: string[]): RedisMulti;
  srem(key: string, ...members: string[]): RedisMulti;
  expire(key: string, seconds: number): RedisMulti;
  exec(): Promise<unknown>;
}

@Injectable()
export class SessionService implements OnModuleInit {
  private readonly logger = new Logger(SessionService.name);
  private readonly defaultTtl: number;
  private readonly rememberMeTtl: number;

  constructor(
    @Inject(REDIS_TOKEN) private readonly redis: RedisLike,
    @Inject(SESSION_REPOSITORY_TOKEN) private readonly repo: SessionRepository,
  ) {
    this.defaultTtl = Number.parseInt(
      process.env['SESSION_DEFAULT_TTL_SECONDS'] ?? '28800',
      10,
    );
    this.rememberMeTtl = Number.parseInt(
      process.env['SESSION_REMEMBER_ME_TTL_SECONDS'] ?? '2592000',
      10,
    );
  }

  onModuleInit(): void {
    this.logger.log({
      action: 'session_service_init',
      default_ttl: this.defaultTtl,
      remember_me_ttl: this.rememberMeTtl,
    });
  }

  /**
   * Creates a session in Redis + writes audit row (best-effort).
   * TTL = remember_me ? rememberMeTtl : defaultTtl.
   */
  async createSession(input: CreateSessionInput): Promise<SessionMetadata> {
    const now = nowInSeconds();
    const ttl = input.remember_me === true ? this.rememberMeTtl : this.defaultTtl;
    const session: SessionMetadata = {
      user_id: input.user_id,
      tenant_id: input.tenant_id,
      role: input.role,
      jti: input.jti,
      refresh_token_family: input.refresh_token_family,
      refresh_generation: input.refresh_generation,
      ip: input.ip,
      user_agent: input.user_agent,
      mfa_verified: input.mfa_verified,
      remember_me: input.remember_me ?? false,
      created_at: now,
      last_seen_at: now,
      expires_at: now + ttl,
      ...(input.locale !== undefined ? { locale: input.locale } : {}),
      ...(input.device_fingerprint !== undefined
        ? { device_fingerprint: input.device_fingerprint }
        : {}),
    };

    const tx = this.redis.multi();
    tx.set(buildSessionKey(session.jti), serializeSession(session), 'EX', ttl);
    tx.sadd(buildUserSessionsKey(session.user_id), session.jti);
    tx.expire(buildUserSessionsKey(session.user_id), ttl);
    tx.sadd(buildFamilyKey(session.refresh_token_family), session.jti);
    tx.expire(buildFamilyKey(session.refresh_token_family), ttl);
    await tx.exec();

    this.repo.insert(session).catch((err: unknown) => {
      this.logger.warn(
        {
          err: err instanceof Error ? err.message : String(err),
          jti: session.jti,
        },
        'session repository insert failed (Redis is source of truth)',
      );
    });

    return session;
  }

  async getSession(jti: string): Promise<SessionMetadata | null> {
    const raw = await this.redis.get(buildSessionKey(jti));
    return parseSessionRecord(raw);
  }

  async ensureValid(jti: string): Promise<SessionMetadata> {
    if (await this.isRevoked(jti)) throw new SessionRevokedError(jti);
    const s = await this.getSession(jti);
    if (!s) throw new SessionNotFoundError(jti);
    if (isExpiredSession(s, nowInSeconds())) throw new SessionRevokedError(jti);
    return s;
  }

  async isRevoked(jti: string): Promise<boolean> {
    return (await this.redis.exists(buildRevokedKey(jti))) === 1;
  }

  async revokeSession(jti: string): Promise<void> {
    const s = await this.getSession(jti);
    if (!s) return;
    const remaining = Math.max(s.expires_at - nowInSeconds(), 60);
    const tx = this.redis.multi();
    tx.del(buildSessionKey(jti));
    tx.set(buildRevokedKey(jti), '1', 'EX', remaining);
    tx.srem(buildUserSessionsKey(s.user_id), jti);
    tx.srem(buildFamilyKey(s.refresh_token_family), jti);
    await tx.exec();

    this.repo.markRevoked(jti).catch((err: unknown) => {
      this.logger.warn(
        { err: err instanceof Error ? err.message : String(err), jti },
        'session repository markRevoked failed',
      );
    });
  }

  async revokeUserSessions(userId: string): Promise<number> {
    const jtis = await this.redis.smembers(buildUserSessionsKey(userId));
    for (const jti of jtis) {
      await this.revokeSession(jti);
    }
    await this.redis.del(buildUserSessionsKey(userId));
    return jtis.length;
  }

  async revokeFamily(family: string): Promise<number> {
    const jtis = await this.redis.smembers(buildFamilyKey(family));
    for (const jti of jtis) {
      await this.revokeSession(jti);
    }
    await this.redis.del(buildFamilyKey(family));
    return jtis.length;
  }

  /**
   * Atomic rotate via Redis MULTI/EXEC pipeline. Detects replay by comparing
   * stored refresh_generation to the expected_generation supplied by the caller.
   * On replay, the entire family is revoked.
   *
   * NOTE : Lua-based variant lives at services/session-rotate.lua and is shipped
   * to dist/ for future use (Sprint 6+ may opt in for strict atomicity on
   * cluster setups). Sprint 5 uses MULTI/EXEC for broad client compatibility
   * (incl. ioredis-mock test fixtures).
   */
  async rotateSession(input: RotateSessionInput): Promise<SessionMetadata> {
    const old = await this.getSession(input.old_jti);
    if (!old) {
      throw new SessionNotFoundError(input.old_jti);
    }

    if (old.refresh_generation !== input.expected_generation) {
      this.logger.warn(
        {
          token_family: old.refresh_token_family,
          expected: input.expected_generation,
          presented: old.refresh_generation,
          action: 'replay_detected',
        },
        'Refresh token replay detected -- revoking entire family',
      );
      await this.revokeFamily(old.refresh_token_family);
      throw new RefreshReplayDetectedError(
        old.refresh_token_family,
        old.refresh_generation,
        input.expected_generation,
      );
    }

    const ttl = old.remember_me ? this.rememberMeTtl : this.defaultTtl;
    const now = nowInSeconds();
    const newSession: SessionMetadata = {
      user_id: old.user_id,
      tenant_id: old.tenant_id,
      role: old.role,
      jti: input.new_jti,
      refresh_token_family: old.refresh_token_family,
      refresh_generation: input.new_generation,
      ip: input.ip,
      user_agent: input.user_agent,
      mfa_verified: old.mfa_verified,
      remember_me: old.remember_me,
      created_at: now,
      last_seen_at: now,
      expires_at: now + ttl,
      ...(input.locale ?? old.locale ? { locale: input.locale ?? old.locale } : {}),
    };

    const remainingOld = Math.max(old.expires_at - now, 60);

    const tx = this.redis.multi();
    tx.del(buildSessionKey(input.old_jti));
    tx.set(buildRevokedKey(input.old_jti), '1', 'EX', remainingOld);
    tx.set(buildSessionKey(input.new_jti), serializeSession(newSession), 'EX', ttl);
    tx.sadd(buildFamilyKey(old.refresh_token_family), input.new_jti);
    tx.expire(buildFamilyKey(old.refresh_token_family), ttl);
    tx.srem(buildUserSessionsKey(newSession.user_id), input.old_jti);
    tx.sadd(buildUserSessionsKey(newSession.user_id), input.new_jti);
    tx.expire(buildUserSessionsKey(newSession.user_id), ttl);
    await tx.exec();

    return newSession;
  }

  async listUserSessions(userId: string): Promise<SessionMetadata[]> {
    const jtis = await this.redis.smembers(buildUserSessionsKey(userId));
    const sessions: SessionMetadata[] = [];
    for (const jti of jtis) {
      const s = await this.getSession(jti);
      if (s) sessions.push(s);
    }
    sessions.sort((a, b) => b.last_seen_at - a.last_seen_at);
    return sessions;
  }

  /**
   * Updates last_seen_at, debounced to 60s to avoid hot key.
   */
  async touchLastSeen(jti: string, ipAddr: string): Promise<void> {
    const s = await this.getSession(jti);
    if (!s) return;
    const now = nowInSeconds();
    if (now - s.last_seen_at < 60) return;
    const updated: SessionMetadata = { ...s, last_seen_at: now, ip: ipAddr };
    const ttl = Math.max(s.expires_at - now, 1);
    await this.redis.set(buildSessionKey(jti), serializeSession(updated), 'EX', ttl);
    this.repo.updateLastSeenAt(jti, now).catch(() => {
      /* non-blocking */
    });
  }
}
