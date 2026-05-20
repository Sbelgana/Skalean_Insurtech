/**
 * HealthModule -- expose /healthz (liveness) et /readyz (readiness) K8s probes.
 *
 * Liveness : HealthController.liveness() -- process check.
 * Readiness : HealthController.readiness() -- DB + Redis + Kafka check.
 * Cache : ReadinessCacheService -- LRU 5s pour /readyz.
 *
 * Indicators injectent les providers DB/Redis/Kafka depuis leurs modules
 * respectifs (DatabaseModule, RedisModule, KafkaModule -- @Global()).
 *
 * Reference : decision-006 + decision-003 + ADR-011 K8s probes.
 * Tache : 1.3.10 (Sprint 3 / Phase 1).
 */
import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { DatabaseHealthIndicator } from './indicators/database-health.indicator';
import { RedisHealthIndicator } from './indicators/redis-health.indicator';
import { KafkaHealthIndicator } from './indicators/kafka-health.indicator';
import { ReadinessCacheService } from './cache/readiness-cache.service';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [
    DatabaseHealthIndicator,
    RedisHealthIndicator,
    KafkaHealthIndicator,
    ReadinessCacheService,
  ],
  exports: [DatabaseHealthIndicator, RedisHealthIndicator, KafkaHealthIndicator],
})
export class HealthModule {}
