// @insurtech/api-client -- Idempotency-Key UUIDv7 middleware for mutations
// POST/PUT/PATCH/DELETE: generates a UUIDv7 stored in sessionStorage (TTL 24h).
// On retry of same logical request, same key reused -> backend deduplicates.
// Sprint 14 backend implements strict idempotency check.

import { v7 as uuidv7 } from 'uuid';
import type { Middleware } from 'openapi-fetch';

const STORAGE_KEY_PREFIX = 'insurtech.idempotency.';
const TTL_MS = 24 * 60 * 60 * 1000; // 24h

interface StoredIdempotencyKey {
  key: string;
  timestamp: number;
}

/**
 * Generates a UUIDv7 (time-ordered, monotonic, low collision probability 2^-62).
 */
export function generateIdempotencyKey(): string {
  return uuidv7();
}

function buildStorageKey(method: string, url: string, body: string): string {
  // Hash request signature for stable key reuse on retry
  const signature = `${method.toUpperCase()} ${url} ${body.slice(0, 200)}`;
  return STORAGE_KEY_PREFIX + signature;
}

function readOrCreateKey(method: string, url: string, body: string): string {
  if (typeof sessionStorage === 'undefined') {
    return generateIdempotencyKey();
  }

  const storageKey = buildStorageKey(method, url, body);
  const raw = sessionStorage.getItem(storageKey);

  if (raw) {
    try {
      const parsed = JSON.parse(raw) as StoredIdempotencyKey;
      if (Date.now() - parsed.timestamp < TTL_MS) {
        return parsed.key;
      }
      sessionStorage.removeItem(storageKey);
    } catch {
      sessionStorage.removeItem(storageKey);
    }
  }

  const key = generateIdempotencyKey();
  const stored: StoredIdempotencyKey = { key, timestamp: Date.now() };
  try {
    sessionStorage.setItem(storageKey, JSON.stringify(stored));
  } catch {
    // sessionStorage full or disabled -> still return key without persistence
  }
  return key;
}

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export const idempotencyMiddleware: Middleware = {
  async onRequest({ request }) {
    if (!MUTATION_METHODS.has(request.method.toUpperCase())) {
      return request;
    }
    if (request.headers.has('Idempotency-Key')) {
      return request; // caller provided one -> respect it
    }

    const url = request.url;
    let body = '';
    try {
      const cloned = request.clone();
      body = await cloned.text();
    } catch {
      body = '';
    }

    const key = readOrCreateKey(request.method, url, body);
    request.headers.set('Idempotency-Key', key);
    return request;
  },
};
