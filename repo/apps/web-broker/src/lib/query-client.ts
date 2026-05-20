/**
 * React Query client -- web-broker
 * Reference : task-1.4.1 Sprint 4 Phase 1
 */
import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';
import * as Sentry from '@sentry/nextjs';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

const isProd = process.env.NODE_ENV === 'production';

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: (failureCount, error) => {
          if (failureCount >= 3) return false;
          const status = (error as { response?: { status?: number } }).response?.status;
          if (status && status >= 400 && status < 500 && status !== 408 && status !== 429) {
            return false;
          }
          return true;
        },
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30_000),
        refetchOnWindowFocus: isProd,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: 1,
        onError: (error) => {
          logger.error({ error }, 'Mutation error');
          Sentry.captureException(error, { tags: { type: 'mutation' } });
        },
      },
    },
    queryCache: new QueryCache({
      onError: (error, query) => {
        logger.error({ queryKey: query.queryKey, error }, 'Query error');
      },
    }),
    mutationCache: new MutationCache({
      onError: (error) => {
        toast.error((error as Error).message ?? 'Mutation failed');
      },
    }),
  });
}
