/**
 * RedisHealthIndicator -- ping ioredis client via PING.
 *
 * Verifie redis.status === 'ready' avant PING pour detecter
 * les etats transitoires (connecting, reconnecting).
 * Timeout configurable (default 1000ms).
 *
 * Reference : decision-006 (no-emoji).
 * Tache : 1.3.10 (Sprint 3 / Phase 1).
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  HealthCheckError,
  HealthIndicator,
  type HealthIndicatorResult,
} from '@nestjs/terminus';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT_TOKEN } from '../../../redis/redis.provider';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(@Inject(REDIS_CLIENT_TOKEN) private readonly redis: Redis) {
    super();
  }

  /**
   * Ping Redis via PING. Verifie statut + reponse PONG + timeout.
   * @param key - nom du service dans le resultat (ex: 'redis')
   * @param timeoutMs - timeout en ms (default: 1000)
   */
  async isHealthy(key: string, timeoutMs: number): Promise<HealthIndicatorResult> {
    const start = Date.now();
    try {
      // Verifier status avant PING (evite une attente inutile)
      if (this.redis.status !== 'ready') {
        throw new Error(`Redis not ready (status: ${this.redis.status})`);
      }

      const pingPromise = this.redis.ping();
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Redis PING timeout ${timeoutMs}ms`)),
          timeoutMs,
        ),
      );
      const result = await Promise.race([pingPromise, timeoutPromise]);

      if (result !== 'PONG') {
        throw new Error(`Redis returned unexpected response: ${result}`);
      }

      const duration = Date.now() - start;
      return this.getStatus(key, true, { duration_ms: duration });
    } catch (error) {
      const duration = Date.now() - start;
      const message = error instanceof Error ? error.message : String(error);
      throw new HealthCheckError(
        `Redis health check failed`,
        this.getStatus(key, false, {
          duration_ms: duration,
          message: this.sanitizeMessage(message),
        }),
      );
    }
  }

  /**
   * Sanitize le message d'erreur pour eviter le leak d'URL Redis.
   */
  private sanitizeMessage(msg: string): string {
    return msg.replace(/redis(?:s)?:\/\/[^:]+:[^@]+@/gi, 'redis://[REDACTED]@');
  }
}
