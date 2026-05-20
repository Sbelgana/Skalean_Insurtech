// @insurtech/api-client -- typed React Query wrapper around GET requests.
// Type magic: extracts the response type from generated `paths` based on the path argument.
// Compilation error if path does not exist or query/path params shape mismatch.

import { useQuery, type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';
import { apiClient } from '../client.js';
import type { paths } from '../types.gen.js';

/**
 * Helper: extracts the GET response 200 body type for a given path.
 */
type GetPaths = {
  [K in keyof paths as paths[K] extends { get: unknown } ? K : never]: paths[K];
};

type GetResponse<P extends keyof GetPaths> =
  GetPaths[P] extends { get: { responses: { 200: { content: { 'application/json': infer R } } } } }
    ? R
    : never;

type GetParams<P extends keyof GetPaths> =
  GetPaths[P] extends { get: { parameters: infer Params } } ? Params : Record<string, never>;

export interface UseApiQueryOptions<P extends keyof GetPaths>
  extends Omit<
    UseQueryOptions<GetResponse<P>, Error, GetResponse<P>, readonly unknown[]>,
    'queryKey' | 'queryFn'
  > {
  /**
   * Custom queryKey suffix (appended after default ['api', path, params]).
   * Useful for distinguishing queries with same path but different runtime contexts.
   */
  extraKey?: readonly unknown[];
}

/**
 * Typed React Query hook for GET endpoints.
 *
 * @example
 * const { data, isLoading } = useApiQuery('/api/v1/policies/{id}', {
 *   params: { path: { id: policyId } }
 * });
 * // data is typed as PolicyDto inferred from OpenAPI schema
 */
export function useApiQuery<P extends keyof GetPaths>(
  path: P,
  params: GetParams<P>,
  options: UseApiQueryOptions<P> = {},
): UseQueryResult<GetResponse<P>, Error> {
  const { extraKey = [], ...rqOptions } = options;

  const queryKey: readonly unknown[] = ['api', path, params, ...extraKey] as const;

  return useQuery<GetResponse<P>, Error>({
    queryKey,
    queryFn: async ({ signal }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error, response } = await (apiClient as any).GET(path, {
        params,
        signal,
      });
      if (error || !response.ok) {
        throw new Error(
          `[api-client] GET ${String(path)} failed: ${response.status} ${
            error ? JSON.stringify(error) : response.statusText
          }`,
        );
      }
      return data as GetResponse<P>;
    },
    staleTime: 60_000, // 1 min default, overridable
    gcTime: 5 * 60_000, // 5 min default
    retry: (failureCount, error) => {
      // do not retry on 4xx (client errors)
      const message = error.message;
      if (/40[0-9]/.test(message)) return false;
      return failureCount < 3;
    },
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
    ...rqOptions,
  });
}
