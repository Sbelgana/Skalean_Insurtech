/**
 * RedisModule -- module global qui re-expose redisClient ioredis via DI NestJS.
 *
 * Cree un client ioredis depuis REDIS_URL et l'expose via DI.
 * onModuleDestroy appelle client.quit() pour fermeture propre.
 *
 * Reference : decision-003 (NestJS) + decision-006 (no-emoji).
 * Tache : 1.3.2 (Sprint 3 / Phase 1).
 */
import { Module, Global, type OnModuleDestroy, Inject } from '@nestjs/common';
import { redisProvider, REDIS_CLIENT_TOKEN } from './redis.provider';
import type Redis from 'ioredis';

@Global()
@Module({
  providers: [redisProvider],
  exports: [REDIS_CLIENT_TOKEN],
})
export class RedisModule implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT_TOKEN) private readonly redis: Redis) {}

  async onModuleDestroy(): Promise<void> {
    if (this.redis.status !== 'end') {
      await this.redis.quit();
    }
  }
}
