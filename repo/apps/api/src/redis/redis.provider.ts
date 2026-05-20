/**
 * Provider factory pour redisClient ioredis.
 *
 * Cree un client ioredis connecte depuis REDIS_URL.
 * Retourne le client apres confirmation de la connexion (event 'ready').
 *
 * Reference : decision-006 (no-emoji).
 * Tache : 1.3.2 (Sprint 3 / Phase 1).
 */
import type { Provider } from '@nestjs/common';
import Redis from 'ioredis';

export const REDIS_CLIENT_TOKEN = 'REDIS_CLIENT';

export const redisProvider: Provider = {
  provide: REDIS_CLIENT_TOKEN,
  useFactory: async (): Promise<Redis> => {
    const url = process.env['REDIS_URL'] ?? 'redis://localhost:6379';

    const client = new Redis(url, {
      lazyConnect: false,
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      retryStrategy: (times: number) => {
        // Retry max 10 fois, backoff exponentiel 100ms -> 2000ms
        if (times > 10) return null;
        return Math.min(times * 100, 2000);
      },
      reconnectOnError: (err: Error) => {
        const targetErrors = ['READONLY', 'ETIMEDOUT', 'ECONNRESET'];
        return targetErrors.some((e) => err.message.includes(e));
      },
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        client.disconnect();
        reject(new Error('Redis connection timeout after 5000ms'));
      }, 5000);

      client.once('ready', () => {
        clearTimeout(timeout);
        resolve();
      });

      client.once('error', (err: Error) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    return client;
  },
};
