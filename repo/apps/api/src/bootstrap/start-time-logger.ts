/**
 * Boot time logger -- mesure duree boot et alerte si > 5s.
 *
 * SLA Skalean InsurTech v2.2 : boot < 5s sur machine 16GB RAM.
 * Si > 5s, log warning pour investigation (cold start trop long impacte
 * deploiements blue-green : delai entre kill ancien pod + ready nouveau).
 *
 * Reference : decision-003 (NestJS) + decision-006 (no-emoji).
 * Tache : 1.3.1 (Sprint 3 / Phase 1).
 */
import type { LoggerService } from '@nestjs/common';

/** Seuil au-dela duquel un warning est emis (ms). */
export const BOOT_TIME_WARNING_THRESHOLD_MS = 5000;

/**
 * Calcule la duree depuis bootStart et log warning si > seuil.
 * Retourne la duree en ms (entier).
 */
export function measureBootTime(bootStart: bigint, logger: LoggerService): number {
  const bootEnd = process.hrtime.bigint();
  const durationNs = Number(bootEnd - bootStart);
  const durationMs = Math.round(durationNs / 1_000_000);

  if (durationMs > BOOT_TIME_WARNING_THRESHOLD_MS) {
    logger.warn?.(
      `Boot time exceeded threshold: ${durationMs}ms > ${BOOT_TIME_WARNING_THRESHOLD_MS}ms. ` +
        'Investigate cold start optimization (OTEL exporters, DB connections, module init).',
    );
  }

  return durationMs;
}

/**
 * Retourne le seuil de warning pour les tests.
 */
export function getBootTimeWarningThresholdMs(): number {
  return BOOT_TIME_WARNING_THRESHOLD_MS;
}
