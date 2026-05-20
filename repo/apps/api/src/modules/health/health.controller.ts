/**
 * HealthController -- /healthz (liveness) + /readyz (readiness).
 *
 * /healthz : toujours 200 OK si process Node alive (anti-cascade K8s).
 * /readyz  : 200 OK si DB+Redis+Kafka up, 503 sinon. Cache 5s.
 *
 * Les deux endpoints sont marques @SkipResponseWrap() pour retourner
 * le format raw (terminus natif) sans { success, data, meta }.
 *
 * Reference : decision-006 + ADR-011 K8s probes.
 * Tache : 1.3.10 (Sprint 3 / Phase 1).
 */
import { Controller, Get, Header } from '@nestjs/common';
import {
  ApiTags,
  ApiOkResponse,
  ApiServiceUnavailableResponse,
  ApiOperation,
} from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  type HealthCheckResult,
} from '@nestjs/terminus';
import { SkipResponseWrap } from '../../response/decorators/skip-response-wrap.decorator';
import { DatabaseHealthIndicator } from './indicators/database-health.indicator';
import { RedisHealthIndicator } from './indicators/redis-health.indicator';
import { KafkaHealthIndicator } from './indicators/kafka-health.indicator';
import { ReadinessCacheService } from './cache/readiness-cache.service';

@ApiTags('Health')
@Controller()
export class HealthController {
  constructor(
    private readonly healthCheckService: HealthCheckService,
    private readonly databaseIndicator: DatabaseHealthIndicator,
    private readonly redisIndicator: RedisHealthIndicator,
    private readonly kafkaIndicator: KafkaHealthIndicator,
    private readonly cache: ReadinessCacheService,
  ) {}

  /**
   * Liveness probe Kubernetes.
   * Retourne toujours 200 OK si le process Node est vivant.
   * Ne verifie AUCUNE dependance externe (anti-cascade failure).
   * K8s livenessProbe.httpGet.path=/healthz interval=10s timeout=3s failureThreshold=3.
   */
  @Get('healthz')
  @SkipResponseWrap()
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate')
  @Header('X-Health-Type', 'liveness')
  @ApiOperation({
    summary: 'Liveness probe (Kubernetes)',
    description:
      'Returns 200 OK if Node process is alive. Does NOT check external dependencies. ' +
      'K8s livenessProbe: httpGet.path=/healthz, interval=10s, timeout=3s, failureThreshold=3.',
  })
  @ApiOkResponse({
    description: 'Process alive',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
      },
    },
  })
  liveness(): { status: 'ok' } {
    return { status: 'ok' };
  }

  /**
   * Readiness probe Kubernetes.
   * Verifie DB (SELECT 1 / 2s) + Redis (PING / 1s) + Kafka (state / 1.5s).
   * Retourne 200 OK si all up, 503 si at least one down.
   * Cache 5s pour eviter pool exhaustion (K8s probe interval 1s).
   * K8s readinessProbe.httpGet.path=/readyz interval=5s timeout=3s failureThreshold=3.
   */
  @Get('readyz')
  @HealthCheck()
  @SkipResponseWrap()
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate')
  @Header('X-Health-Type', 'readiness')
  @ApiOperation({
    summary: 'Readiness probe (Kubernetes)',
    description:
      'Returns 200 if all dependencies (DB+Redis+Kafka) are up, 503 otherwise. ' +
      'Cached 5s. K8s readinessProbe: httpGet.path=/readyz, interval=5s, timeout=3s, failureThreshold=3.',
  })
  @ApiOkResponse({
    description: 'All dependencies up',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        info: {
          type: 'object',
          properties: {
            db: { type: 'object', properties: { status: { type: 'string' } } },
            redis: { type: 'object', properties: { status: { type: 'string' } } },
            kafka: { type: 'object', properties: { status: { type: 'string' } } },
          },
        },
        error: { type: 'object' },
        details: { type: 'object' },
      },
    },
  })
  @ApiServiceUnavailableResponse({ description: 'At least one dependency down' })
  async readiness(): Promise<HealthCheckResult> {
    // Servir depuis le cache si valide (< 5s).
    const cached = this.cache.get();
    if (cached !== null) {
      return cached;
    }

    // Check parallele DB + Redis + Kafka.
    const result = await this.healthCheckService.check([
      () => this.databaseIndicator.isHealthy('db', 2000),
      () => this.redisIndicator.isHealthy('redis', 1000),
      () => this.kafkaIndicator.isHealthy('kafka', 1500),
    ]);

    this.cache.set(result);
    return result;
  }
}
