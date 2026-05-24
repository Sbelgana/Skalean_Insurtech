/**
 * OAuthStateService -- Sprint 8 Tache 8.10b.
 *
 * CSRF state protection for OAuth2 authorization flow.
 *
 * Flow :
 *   1. `initiateConnection` -> generate state = HMAC-SHA256(tenantId + userId +
 *      provider + timestamp + nonce, master key). Persist payload in Redis
 *      under key `oauth_state:{state}` with 10-minute TTL. Embed state in
 *      authorization URL.
 *   2. OAuth callback -> `validateAndConsume(state)` reads + deletes the Redis
 *      key (one-time use). Returns the persisted payload or throws.
 *
 * Why this matters : CSRF prevention. Without state, an attacker could trick
 * a logged-in user into completing an OAuth callback that links the attacker's
 * Google account to the victim's Skalean session.
 *
 * Reference : RFC 6749 section 10.12 ; B-08 Tache 3.2.5.
 */

import { createHmac, randomBytes } from 'node:crypto';
import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT_TOKEN } from '../../../redis/redis.provider.js';
import type { CalendarProviderName } from '../config/oauth-calendar.config.js';

const STATE_TTL_SECONDS = 10 * 60; // 10 minutes
const REDIS_PREFIX = 'oauth_state:';

export interface OAuthStatePayload {
  readonly tenantId: string;
  readonly userId: string;
  readonly provider: CalendarProviderName;
  readonly createdAt: number; // unix ms
  readonly nonce: string;
}

export const OAUTH_STATE_ERROR_CODES = {
  INVALID_STATE: 'OAUTH_STATE_INVALID',
  EXPIRED_STATE: 'OAUTH_STATE_EXPIRED',
  MISSING_KEY: 'OAUTH_STATE_MISSING_KEY',
} as const;

@Injectable()
export class OAuthStateService {
  private readonly logger = new Logger(OAuthStateService.name);
  private readonly hmacKey: Buffer;

  constructor(@Inject(REDIS_CLIENT_TOKEN) private readonly redis: Redis) {
    // Reuse the calendar token encryption key as HMAC master key. Same
    // confidentiality + integrity requirements.
    const hex = process.env['CALENDAR_TOKEN_ENCRYPTION_KEY'];
    if (!hex) {
      throw new Error(
        'OAuthStateService : CALENDAR_TOKEN_ENCRYPTION_KEY must be set (used as HMAC key for OAuth state).',
      );
    }
    this.hmacKey = Buffer.from(hex, 'hex');
    if (this.hmacKey.length !== 32) {
      throw new Error(
        'CALENDAR_TOKEN_ENCRYPTION_KEY must be 32 bytes (64 hex chars).',
      );
    }
  }

  /**
   * Generates a fresh state token, persists the payload in Redis with TTL,
   * returns the opaque state string for inclusion in the OAuth URL.
   */
  async generate(
    tenantId: string,
    userId: string,
    provider: CalendarProviderName,
  ): Promise<string> {
    const nonce = randomBytes(16).toString('hex');
    const createdAt = Date.now();
    const payload: OAuthStatePayload = { tenantId, userId, provider, createdAt, nonce };

    // State = HMAC over the serialized payload (deterministic given payload).
    // Embedding HMAC in the state lets the callback also verify integrity
    // before even touching Redis -- defense in depth.
    const payloadStr = JSON.stringify(payload);
    const hmac = createHmac('sha256', this.hmacKey)
      .update(payloadStr)
      .digest('hex');
    const state = `${nonce}.${hmac}`;

    await this.redis.set(
      `${REDIS_PREFIX}${state}`,
      payloadStr,
      'EX',
      STATE_TTL_SECONDS,
    );
    this.logger.log(
      `oauth_state_generated tenant=${tenantId} user=${userId} provider=${provider} ttl=${STATE_TTL_SECONDS}s`,
    );
    return state;
  }

  /**
   * Validates `state` against Redis + HMAC + TTL. Deletes the entry on
   * success (one-time use). Throws UnauthorizedException on any failure.
   */
  async validateAndConsume(state: string): Promise<OAuthStatePayload> {
    const key = `${REDIS_PREFIX}${state}`;
    const payloadStr = await this.redis.get(key);
    if (!payloadStr) {
      this.logger.warn(
        `oauth_state_validation_failed reason=not_found_or_expired state=${state.slice(0, 16)}...`,
      );
      throw new UnauthorizedException({
        code: OAUTH_STATE_ERROR_CODES.INVALID_STATE,
        message: 'Invalid or expired OAuth state',
      });
    }
    // Delete BEFORE parsing -- one-time use guarantee even if parse fails.
    await this.redis.del(key);

    let payload: OAuthStatePayload;
    try {
      payload = JSON.parse(payloadStr);
    } catch {
      this.logger.warn(`oauth_state_corrupt state=${state.slice(0, 16)}...`);
      throw new UnauthorizedException({
        code: OAUTH_STATE_ERROR_CODES.INVALID_STATE,
        message: 'Corrupt OAuth state payload',
      });
    }

    // Verify HMAC : the second part of state must match HMAC(payloadStr).
    const parts = state.split('.');
    const providedHmac = parts[1];
    const expectedHmac = createHmac('sha256', this.hmacKey)
      .update(payloadStr)
      .digest('hex');
    if (providedHmac !== expectedHmac) {
      this.logger.warn(`oauth_state_hmac_mismatch state=${state.slice(0, 16)}...`);
      throw new UnauthorizedException({
        code: OAUTH_STATE_ERROR_CODES.INVALID_STATE,
        message: 'OAuth state HMAC mismatch (possible tampering)',
      });
    }

    // TTL sanity (Redis TTL would have expired but be defensive)
    if (Date.now() - payload.createdAt > STATE_TTL_SECONDS * 1000) {
      this.logger.warn(
        `oauth_state_expired state=${state.slice(0, 16)}... age_ms=${Date.now() - payload.createdAt}`,
      );
      throw new UnauthorizedException({
        code: OAUTH_STATE_ERROR_CODES.EXPIRED_STATE,
        message: 'OAuth state expired',
      });
    }

    this.logger.log(
      `oauth_state_consumed tenant=${payload.tenantId} user=${payload.userId} provider=${payload.provider}`,
    );
    return payload;
  }
}
