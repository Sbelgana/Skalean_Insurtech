// @insurtech/api-client -- HTTP client factory
// Wraps openapi-fetch with our generated types, middlewares chain, and singleton accessor.
// Documentation: see README.md "Usage" section.

import createClient, { type Client, type Middleware } from 'openapi-fetch';
import type { paths } from './types.gen.js';
import { tenantMiddleware } from './middleware/tenant-middleware.js';
import { authMiddleware } from './middleware/auth-middleware.js';
import { idempotencyMiddleware } from './middleware/idempotency-middleware.js';

export interface ApiClientOptions {
  baseUrl?: string;
  middlewares?: Middleware[];
  fetch?: typeof fetch;
  defaultHeaders?: Record<string, string>;
  /**
   * If true, disables Sentry capture middleware (useful for tests / SSR pre-render).
   * Defaults to false in production, true in development unless NEXT_PUBLIC_SENTRY_DSN set.
   */
  disableSentry?: boolean;
}

const DEFAULT_BASE_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

const FALLBACK_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
  'X-Client-Version': process.env['NEXT_PUBLIC_APP_VERSION'] ?? '0.1.0',
};

/**
 * Creates a typed API client instance.
 * Apps should use the singleton `apiClient` exported below in 99% of cases.
 * Use this factory only when you need a separate client (e.g. testing, second backend).
 */
export function createApiClient(options: ApiClientOptions = {}): Client<paths> {
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
  if (!baseUrl) {
    throw new Error(
      '[api-client] No baseUrl resolved. Set NEXT_PUBLIC_API_URL env var or pass options.baseUrl.',
    );
  }

  const headers = { ...FALLBACK_HEADERS, ...options.defaultHeaders };

  const client = createClient<paths>({
    baseUrl,
    headers,
    fetch: options.fetch ?? globalThis.fetch,
  });

  // Default middleware chain order is meaningful:
  // 1. tenant: must run before auth (multi-tenant routing on backend)
  // 2. auth: bearer + refresh on 401
  // 3. idempotency: only on POST/PUT/PATCH mutations
  // 4. response middlewares from caller (Sentry, custom)
  const defaultMiddlewares: Middleware[] = [
    tenantMiddleware,
    authMiddleware,
    idempotencyMiddleware,
  ];

  // Optional Sentry response middleware (5xx capture)
  if (!options.disableSentry && process.env['NEXT_PUBLIC_SENTRY_DSN']) {
    defaultMiddlewares.push(sentryResponseMiddleware);
  }

  for (const middleware of defaultMiddlewares) {
    client.use(middleware);
  }

  if (options.middlewares) {
    for (const middleware of options.middlewares) {
      client.use(middleware);
    }
  }

  return client;
}

/**
 * Lazy Sentry capture for HTTP 5xx (avoid hard import of Sentry to keep bundle small).
 * Sentry SDK is dynamically imported only on actual 5xx events.
 */
const sentryResponseMiddleware: Middleware = {
  async onResponse({ response, request }) {
    if (response.status >= 500 && response.status < 600) {
      try {
        const Sentry = await import(/* @vite-ignore */ '@sentry/nextjs');
        Sentry.captureException(
          new Error(`API ${response.status} ${request.method} ${request.url}`),
          {
            tags: { source: 'api-client', status: String(response.status) },
          },
        );
      } catch {
        // Sentry not installed -- silent fail
      }
    }
    return response;
  },
};

/**
 * Singleton API client used by the 8 frontend apps.
 * Lazily initialized on first access to allow env vars hydration.
 */
let _apiClient: Client<paths> | null = null;

export const apiClient: Client<paths> = new Proxy({} as Client<paths>, {
  get(_target, prop: string) {
    if (!_apiClient) {
      _apiClient = createApiClient();
    }
    return Reflect.get(_apiClient, prop);
  },
});
