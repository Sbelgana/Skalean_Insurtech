/**
 * ThrottlerRedisStorage -- implementation ThrottlerStorage avec Redis (DB 5).
 *
 * Algorithme : fenetre glissante (sliding window) via Redis Sorted Set.
 * Chaque requete est inseree avec un score = timestamp ms.
 * Les entrees plus vieilles que `ttl` secondes sont supprimees avant le comptage.
 *
 * Isolation DB 5 (RATE_LIMIT_REDIS_DB) pour ne pas polluer :
 *   - DB 0 : cache general
 *   - DB 1 : sessions
 *   - DB 2 : queues BullMQ
 *
 * Conforme CNDP loi 09-08 : pas de PII en cle Redis (hash SHA256 applique
 * en amont par ThrottlerGuard via generateKey()).
 *
 * Reference : decision-006 (no-emoji).
 * Tache : 1.3.13 (Sprint 3 / Phase 1).
 */
import type { OnApplicationShutdown } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import type Redis from 'ioredis';

/**
 * Forme de retour de ThrottlerStorage.increment() -- correspond a
 * ThrottlerStorageRecord de @nestjs/throttler (non re-exporte depuis l'index).
 */
interface StorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

/** DB Redis dediee au rate-limit (isolee des autres usages). */
export const RATE_LIMIT_REDIS_DB = 5;

/** Prefix des cles Redis pour les compteurs de fenetre glissante. */
const STORE_KEY_PREFIX = 'throttle';

/** Prefix des cles Redis pour les periodes de blocage. */
const BLOCK_KEY_PREFIX = 'throttle_block';

/**
 * Stockage Redis pour @nestjs/throttler v6.
 *
 * Implements ThrottlerStorage + OnApplicationShutdown pour fermeture propre.
 * Le client Redis est fourni via le constructeur (injection explicite depuis
 * ThrottlerRateLimitModule.useFactory) pour faciliter les tests.
 */
export class ThrottlerRedisStorage implements ThrottlerStorage, OnApplicationShutdown {
  constructor(private readonly redis: Redis) {}

  /**
   * Incremente le compteur de requetes pour la cle donnee.
   *
   * Algorithme sliding window :
   * 1. Verifie si le client est bloque (cle block_key en Redis).
   * 2. Supprime les entrees plus vieilles que la fenetre (ZREMRANGEBYSCORE).
   * 3. Ajoute l'entree courante (ZADD avec score = timestamp ms).
   * 4. Compte toutes les entrees restantes (ZCOUNT).
   * 5. Fixe l'expiration de la cle (PEXPIRE).
   * 6. Si totalHits > limit ET blockDuration > 0 : bloque le client (SET EX).
   *
   * @param key         - Cle hachee par ThrottlerGuard.generateKey() (pas de PII).
   * @param ttl         - Duree de la fenetre en secondes (ex : 60).
   * @param limit       - Nombre maximum de requetes autorisees.
   * @param blockDuration - Duree de blocage en secondes si depasse (0 = pas de blocage).
   * @param throttlerName - Nom du throttler (ex : 'default').
   */
  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<StorageRecord> {
    const now = Date.now();
    const windowMs = ttl * 1000;
    const windowStart = now - windowMs;

    const storeKey = `${STORE_KEY_PREFIX}:${throttlerName}:${key}`;
    const blockKey = `${BLOCK_KEY_PREFIX}:${throttlerName}:${key}`;

    // --- Etape 1 : Verifier si le client est bloque ---
    const blockTtlMs = await this.redis.pttl(blockKey);
    if (blockTtlMs > 0) {
      return {
        totalHits: limit + 1,
        timeToExpire: ttl,
        isBlocked: true,
        timeToBlockExpire: Math.ceil(blockTtlMs / 1000),
      };
    }

    // --- Etapes 2-5 : Sliding window via sorted set ---
    // Le membre est unique : timestamp + random suffix pour eviter les collisions
    // en cas de requetes simultanees (meme timestamp ms).
    const member = `${now}:${Math.random().toString(36).slice(2)}`;

    const results = await this.redis
      .multi()
      .zremrangebyscore(storeKey, 0, windowStart)
      .zadd(storeKey, now, member)
      .zcount(storeKey, '-inf', '+inf')
      .pexpire(storeKey, windowMs)
      .exec();

    // results[2][1] = valeur retournee par ZCOUNT (nombre d'entrees dans la fenetre).
    // Avec noUncheckedIndexedAccess : double optional chaining requis.
    const totalHits = (results?.[2]?.[1] as number | null | undefined) ?? 0;

    // --- Etape 6 : Bloquer si limite depassee avec blockDuration > 0 ---
    if (totalHits > limit && blockDuration > 0) {
      await this.redis.set(blockKey, '1', 'EX', blockDuration);
      return {
        totalHits,
        timeToExpire: ttl,
        isBlocked: true,
        timeToBlockExpire: blockDuration,
      };
    }

    return {
      totalHits,
      timeToExpire: ttl,
      isBlocked: false,
      timeToBlockExpire: 0,
    };
  }

  /**
   * Ferme la connexion Redis proprement au shutdown de l'application.
   * Appele par NestJS lors de app.close() ou SIGTERM/SIGINT.
   */
  async onApplicationShutdown(): Promise<void> {
    await this.redis.quit();
  }
}
