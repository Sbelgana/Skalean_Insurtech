/**
 * TanStack Query client factory -- web-assure-mobile
 * Reference : task-1.4.7 Sprint 4 Phase 1
 *
 * Cree un QueryClient avec :
 *   - staleTime 30s, gcTime 5min
 *   - Retry exponentiel plafonne a 30s (max 3 tentatives)
 *   - Pas de retry sur 4xx
 *   - Capture Sentry sur erreurs QueryCache/MutationCache
 */
import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';
import * as Sentry from '@sentry/nextjs';
import { toast } from 'sonner';
import { logger } from './logger';

function isAxiosLike(err: unknown): err is { response?: { status?: number } } {
  return typeof err === 'object' && err !== null && 'response' in err;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 300_000,
        retry: (failureCount, error) => {
          if (isAxiosLike(error) && typeof error.response?.status === 'number') {
            if (error.response.status >= 400 && error.response.status < 500) return false;
          }
          return failureCount < 3;
        },
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30_000),
        refetchOnWindowFocus: false,
      },
    },
    queryCache: new QueryCache({
      onError: (error) => {
        logger.error({ err: error }, 'QueryCache error');
        if (isAxiosLike(error) && typeof error.response?.status === 'number') {
          if (error.response.status >= 500) {
            Sentry.captureException(error);
          }
        }
      },
    }),
    mutationCache: new MutationCache({
      onError: (error) => {
        logger.error({ err: error }, 'MutationCache error');
        if (isAxiosLike(error) && typeof error.response?.status === 'number') {
          if (error.response.status >= 500) {
            Sentry.captureException(error);
            toast.error('Erreur serveur. Veuillez reessayer.');
          }
        }
      },
    }),
  });
}
