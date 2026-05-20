// @insurtech/api-client -- main entry point
// Re-exports the configured client, typed React Query hooks, and generated types.

export { apiClient, createApiClient, type ApiClientOptions } from './client.js';
export type { paths, components, operations, webhooks } from './types.gen.js';

export { useApiQuery, type UseApiQueryOptions } from './hooks/useApiQuery.js';
export { useApiMutation, type UseApiMutationOptions } from './hooks/useApiMutation.js';
export {
  useApiInfiniteQuery,
  type UseApiInfiniteQueryOptions,
} from './hooks/useApiInfiniteQuery.js';

export { tenantMiddleware } from './middleware/tenant-middleware.js';
export { authMiddleware, refreshAccessToken } from './middleware/auth-middleware.js';
export {
  idempotencyMiddleware,
  generateIdempotencyKey,
} from './middleware/idempotency-middleware.js';

export * as zodSchemas from './zod-schemas/index.js';
