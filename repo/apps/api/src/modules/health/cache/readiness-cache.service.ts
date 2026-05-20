/**
 * ReadinessCacheService -- LRU cache 5s pour /readyz.
 *
 * Evite le flood des pools DB/Redis/Kafka par les probes Kubernetes (interval 1s).
 * Cache invalide automatiquement apres 5s ou sur SIGTERM (markShuttingDown).
 *
 * Reference : decision-006.
 * Tache : 1.3.10 (Sprint 3 / Phase 1).
 */
import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import type { HealthCheckResult } from '@nestjs/terminus';
import { READINESS_CACHE_TTL_MS } from '../health.types';

@Injectable()
export class ReadinessCacheService implements OnModuleDestroy {
  private cachedResult: HealthCheckResult | null = null;
  private cachedAt: number | null = null;
  private isShuttingDown = false;

  /**
   * Recupere le cached result si valide (< 5s et pas en cours de shutdown).
   * Retourne null si expired, vide, ou shutdown en cours.
   */
  get(): HealthCheckResult | null {
    if (this.isShuttingDown) {
      // Pendant shutdown : force re-check qui retournera 503 aux probes K8s.
      return null;
    }
    if (!this.cachedResult || this.cachedAt === null) return null;
    const age = Date.now() - this.cachedAt;
    if (age > READINESS_CACHE_TTL_MS) {
      this.invalidate();
      return null;
    }
    return this.cachedResult;
  }

  /**
   * Stocke un nouveau result avec timestamp.
   */
  set(result: HealthCheckResult): void {
    this.cachedResult = result;
    this.cachedAt = Date.now();
  }

  /**
   * Invalide le cache (force re-check au prochain appel).
   */
  invalidate(): void {
    this.cachedResult = null;
    this.cachedAt = null;
  }

  /**
   * Marque le service en cours de shutdown.
   * Les probes /readyz retourneront 503 (pod retire du LB K8s).
   */
  markShuttingDown(): void {
    this.isShuttingDown = true;
    this.invalidate();
  }

  /**
   * Reset complet pour les tests.
   */
  reset(): void {
    this.cachedResult = null;
    this.cachedAt = null;
    this.isShuttingDown = false;
  }

  /**
   * Retourne l'age du cache en ms (null si vide).
   * Utile pour debug et tests.
   */
  getAge(): number | null {
    if (this.cachedAt === null) return null;
    return Date.now() - this.cachedAt;
  }

  /**
   * Sur destroy NestJS (SIGTERM -> app.close()), marque shutdown.
   */
  onModuleDestroy(): void {
    this.markShuttingDown();
  }
}
