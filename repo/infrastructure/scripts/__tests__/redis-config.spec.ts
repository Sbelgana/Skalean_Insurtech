import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../..');

describe('Redis configuration files -- Tache 1.1.5', () => {
  describe('redis-clients.ts module structure', () => {
    let content: string;

    beforeAll(() => {
      content = readFileSync(
        join(REPO_ROOT, 'packages/shared-utils/src/redis/redis-clients.ts'),
        'utf-8',
      );
    });

    it('should export REDIS_DB with 6 DBs', () => {
      expect(content).toMatch(/CACHE:\s*0/);
      expect(content).toMatch(/SESSIONS:\s*1/);
      expect(content).toMatch(/QUEUES:\s*2/);
      expect(content).toMatch(/LOCKS:\s*3/);
      expect(content).toMatch(/AI_CACHE:\s*4/);
      expect(content).toMatch(/RATE_LIMIT:\s*5/);
    });

    it('should export createRedisClient', () => {
      expect(content).toMatch(/export function createRedisClient/);
    });

    it('should export getRedisClient', () => {
      expect(content).toMatch(/export function getRedisClient/);
    });

    it('should export closeAllRedisClients', () => {
      expect(content).toMatch(/export async function closeAllRedisClients/);
    });

    it('should have retry strategy with max 10 retries', () => {
      expect(content).toMatch(/times\s*>\s*10/);
    });

    it('should reconnect on transient errors', () => {
      expect(content).toMatch(/READONLY|ETIMEDOUT|ECONNRESET/);
    });
  });

  describe('cache-strategy.md documentation', () => {
    let doc: string;

    beforeAll(() => {
      doc = readFileSync(join(REPO_ROOT, 'docs/architecture/cache-strategy.md'), 'utf-8');
    });

    it('should document 6 DBs', () => {
      expect(doc).toMatch(/REDIS_DB\.CACHE/);
      expect(doc).toMatch(/REDIS_DB\.SESSIONS/);
      expect(doc).toMatch(/REDIS_DB\.QUEUES/);
      expect(doc).toMatch(/REDIS_DB\.LOCKS/);
      expect(doc).toMatch(/REDIS_DB\.AI_CACHE/);
      expect(doc).toMatch(/REDIS_DB\.RATE_LIMIT/);
    });

    it('should document key naming convention', () => {
      expect(doc).toMatch(/\{module\}:\{entity\}:\{tenant_id\}/);
    });

    it('should not contain emoji', () => {
      const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u;
      expect(doc).not.toMatch(emojiRegex);
    });
  });

  describe('package.json deps', () => {
    let pkg: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };

    beforeAll(() => {
      pkg = JSON.parse(
        readFileSync(join(REPO_ROOT, 'packages/shared-utils/package.json'), 'utf-8'),
      ) as typeof pkg;
    });

    it('should pin ioredis@5.4.2', () => {
      expect(pkg.dependencies?.['ioredis']).toBe('5.4.2');
    });

    it('should pin ioredis-mock@8.9.0 in devDeps', () => {
      expect(pkg.devDependencies?.['ioredis-mock']).toBe('8.9.0');
    });
  });
});
