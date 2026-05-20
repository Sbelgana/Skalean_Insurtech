/**
 * ThrottlerRateLimitModule -- rate-limit global @nestjs/throttler v6 + Redis.
 *
 * Configuration :
 *   - 100 requetes par fenetre de 60 secondes par IP (sliding window).
 *   - Stockage : Redis DB 5 (RATE_LIMIT_REDIS_DB) -- isole des autres usages.
 *   - Guard global : APP_GUARD = RateLimitGuard (toutes les routes protegees).
 *   - Exemptions : /healthz, /readyz, /docs (RateLimitGuard.shouldSkip()).
 *   - Headers : X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset.
 *   - 429 payload : { error, code: 'RATE_LIMIT', retryAfter, traceId }.
 *
 * Override par route via @Throttle({ default: { ttl: N, limit: M } }).
 * Desactivation par route via @SkipThrottle().
 *
 * Reference : decision-006 (no-emoji) + CNDP loi 09-08 (protection abus API).
 * Tache : 1.3.13 (Sprint 3 / Phase 1).
 */
import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, type ThrottlerModuleOptions } from '@nestjs/throttler';
import Redis from 'ioredis';
import { RATE_LIMIT_REDIS_DB, ThrottlerRedisStorage } from './throttler-redis.storage';
import { RateLimitGuard } from './throttler.guard';

/** Nombre maximal de requetes autorisees par fenetre (100 req/min). */
export const DEFAULT_RATE_LIMIT = 100;

/** Duree de la fenetre glissante en secondes (1 minute). */
export const DEFAULT_WINDOW_SECONDS = 60;

/**
 * Cree un client ioredis isole sur DB 5 pour le rate-limit.
 *
 * Utilise le meme REDIS_URL que le reste de l'application mais avec `db: 5`.
 * lazyConnect: true evite une connexion immediate au boot --
 * la connexion est etablie a la premiere operation Redis.
 */
function buildRateLimitRedisClient(): Redis {
  const raw = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
  const url = new URL(raw);

  return new Redis({
    host: url.hostname || 'localhost',
    port: url.port ? parseInt(url.port, 10) : 6379,
    ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
    db: RATE_LIMIT_REDIS_DB,
    // lazyConnect: true -- connexion differee jusqu'a la premiere operation Redis.
    // Evite un timeout au boot si Redis n'est pas encore disponible.
    lazyConnect: true,
    enableOfflineQueue: true,
    maxRetriesPerRequest: 3,
  });
}

/**
 * Module global de rate-limiting.
 *
 * Importe ThrottlerModule (global via ThrottlerModule lui-meme) et enregistre
 * RateLimitGuard comme APP_GUARD pour proteger toutes les routes.
 *
 * Pas d'export explicite de ThrottlerModule : les decorateurs @Throttle() et
 * @SkipThrottle() sont accessibles globalement via les imports de routes.
 */
@Global()
@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      useFactory: (): ThrottlerModuleOptions => {
        const redisClient = buildRateLimitRedisClient();
        const storage = new ThrottlerRedisStorage(redisClient);

        return {
          storage,
          throttlers: [
            {
              name: 'default',
              ttl: DEFAULT_WINDOW_SECONDS,
              limit: DEFAULT_RATE_LIMIT,
            },
          ],
        };
      },
    }),
  ],
  providers: [
    {
      // APP_GUARD : garde appliquee GLOBALEMENT a toutes les routes.
      // RateLimitGuard etend ThrottlerGuard et recoit ses dependances via DI
      // (THROTTLER_OPTIONS + ThrottlerStorage fournis par ThrottlerModule global).
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
  ],
  // Pas d'export explicite : ThrottlerModule est @Global(), ses providers
  // (THROTTLER_OPTIONS, ThrottlerStorage) sont disponibles dans toute l'application.
  // @Throttle() et @SkipThrottle() sont importables directement depuis @nestjs/throttler.
})
export class ThrottlerRateLimitModule {}
