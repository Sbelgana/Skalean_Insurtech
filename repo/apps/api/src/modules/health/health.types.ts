/**
 * Types HealthModule -- statuts, constantes, interfaces.
 *
 * Reference : decision-006.
 * Tache : 1.3.10 (Sprint 3 / Phase 1).
 */
import type { HealthCheckResult } from '@nestjs/terminus';

export type HealthStatus = 'up' | 'down';

/** HealthCheckResult etendu avec cache metadata. */
export interface ExtendedHealthCheckResult extends HealthCheckResult {
  cached?: boolean;
  checked_at?: string;
}

/** Options ping indicator. */
export interface IndicatorPingOptions {
  timeout: number;
}

/** Timeouts par default des indicators. */
export const HEALTH_INDICATOR_TIMEOUTS = {
  DATABASE_MS: 2000,
  REDIS_MS: 1000,
  KAFKA_MS: 1500,
} as const;

/** TTL du cache readiness en millisecondes (5s). */
export const READINESS_CACHE_TTL_MS = 5000;
