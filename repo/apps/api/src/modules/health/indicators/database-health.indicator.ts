/**
 * DatabaseHealthIndicator -- ping DataSource Postgres via SELECT 1.
 *
 * Timeout configurable (default 2000ms). Si la query depasse le timeout,
 * ou si une erreur survient, throw HealthCheckError (terminus -> 503).
 * Les connection strings sont sanitizes pour eviter le leak PII.
 *
 * Reference : decision-006 (no-emoji) + CNDP (no connection string leak).
 * Tache : 1.3.10 (Sprint 3 / Phase 1).
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  HealthCheckError,
  HealthIndicator,
  type HealthIndicatorResult,
} from '@nestjs/terminus';
import type { DataSource } from '@insurtech/database';
import { DATA_SOURCE_TOKEN } from '../../../database/data-source.provider';

@Injectable()
export class DatabaseHealthIndicator extends HealthIndicator {
  constructor(@Inject(DATA_SOURCE_TOKEN) private readonly dataSource: DataSource) {
    super();
  }

  /**
   * Ping la DB via SELECT 1 avec timeout configurable.
   * @param key - nom du service dans le resultat (ex: 'db')
   * @param timeoutMs - timeout en ms (default: 2000)
   */
  async isHealthy(key: string, timeoutMs: number): Promise<HealthIndicatorResult> {
    const start = Date.now();
    try {
      const pingPromise = this.dataSource.query('SELECT 1 AS healthy');
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`DB ping timeout ${timeoutMs}ms`)),
          timeoutMs,
        ),
      );
      await Promise.race([pingPromise, timeoutPromise]);
      const duration = Date.now() - start;
      return this.getStatus(key, true, { duration_ms: duration });
    } catch (error) {
      const duration = Date.now() - start;
      const message = error instanceof Error ? error.message : String(error);
      throw new HealthCheckError(
        `Database health check failed`,
        this.getStatus(key, false, {
          duration_ms: duration,
          message: this.sanitizeMessage(message),
        }),
      );
    }
  }

  /**
   * Sanitize le message d'erreur pour eviter le leak de connection strings.
   * Masque le pattern postgres://user:pass@host:port/db.
   */
  private sanitizeMessage(msg: string): string {
    return msg.replace(/postgres(?:ql)?:\/\/[^:]+:[^@]+@/gi, 'postgres://[REDACTED]@');
  }
}
