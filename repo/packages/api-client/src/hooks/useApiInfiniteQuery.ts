// @insurtech/api-client -- cursor-based infinite query wrapper.
// Backend convention (Sprint 8 CRM): paginated GET endpoints expose ?cursor= and return { items, nextCursor }.

import {
  useInfiniteQuery,
  type UseInfiniteQueryOptions,
  type UseInfiniteQueryResult,
  type InfiniteData,
} from '@tanstack/react-query';
import { apiClient } from '../client.js';
import type { paths } from '../types.gen.js';

type CursorPagedResponse<T> = {
  items: T[];
  nextCursor: string | null;
};

type GetPaths = {
  [K in keyof paths as paths[K] extends { get: unknown } ? K : never]: paths[K];
};

type PageData<P extends keyof GetPaths> =
  GetPaths[P] extends { get: { responses: { 200: { content: { 'application/json': infer R } } } } }
    ? R
    : never;

export interface UseApiInfiniteQueryOptions<P extends keyof GetPaths>
  extends Omit<
    UseInfiniteQueryOptions<
      PageData<P>,
      Error,
      InfiniteData<PageData<P>>,
      PageData<P>,
      readonly unknown[],
      string | null
    >,
    'queryKey' | 'queryFn' | 'getNextPageParam' | 'initialPageParam'
  > {
  pageSize?: number;
}

export function useApiInfiniteQuery<P extends keyof GetPaths>(
  path: P,
  baseParams: Record<string, unknown>,
  options: UseApiInfiniteQueryOptions<P> = {},
): UseInfiniteQueryResult<InfiniteData<PageData<P>>, Error> {
  const { pageSize = 20, ...rqOptions } = options;
  const queryKey: readonly unknown[] = ['api', path, baseParams, 'infinite'] as const;

  return useInfiniteQuery<
    PageData<P>,
    Error,
    InfiniteData<PageData<P>>,
    readonly unknown[],
    string | null
  >({
    queryKey,
    queryFn: async ({ pageParam, signal }) => {
      const params = {
        ...baseParams,
        query: {
          ...((baseParams as { query?: Record<string, unknown> }).query ?? {}),
          cursor: pageParam ?? undefined,
          limit: pageSize,
        },
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error, response } = await (apiClient as any).GET(path, { params, signal });
      if (error || !response.ok) {
        throw new Error(
          `[api-client] infinite GET ${String(path)} failed: ${response.status}`,
        );
      }
      return data as PageData<P>;
    },
    initialPageParam: null,
    getNextPageParam: (lastPage) => {
      const cursor = (lastPage as unknown as CursorPagedResponse<unknown>).nextCursor;
      // Return undefined (not null) to signal "no more pages" to React Query v5.
      // null ?? undefined = undefined; 'abc' ?? undefined = 'abc'.
      return cursor ?? undefined;
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    ...rqOptions,
  });
}
