/**
 * AppService -- metadata service Skalean InsurTech API.
 *
 * Reference : decision-003 (NestJS) + decision-006 (no-emoji).
 * Tache : 1.3.1 (Sprint 3 / Phase 1).
 */
import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  /** Timestamp de demarrage process en ms. */
  private readonly startedAt: number = Date.now();

  /**
   * Retourne metadata service.
   * uptime_seconds est calcule depuis process.uptime() pour precision.
   */
  getInfo(): {
    name: string;
    version: string;
    env: string;
    uptime_seconds: number;
    timestamp: string;
  } {
    return {
      name: process.env['APP_NAME'] ?? 'skalean-insurtech-api',
      version: process.env['APP_VERSION'] ?? '0.1.0',
      env: process.env['NODE_ENV'] ?? 'development',
      uptime_seconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Helper pour tests : retourne le timestamp de demarrage.
   */
  getStartedAt(): number {
    return this.startedAt;
  }
}
