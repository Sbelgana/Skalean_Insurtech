// @insurtech/api-client -- typed React Query mutation wrapper.
// Supports POST/PUT/PATCH/DELETE with auto-typed body and response.
// Built-in: invalidation by path pattern, optimistic updates, Sonner toast on error.

import {
  useMutation,
  useQueryClient,
  type UseMutationOptions,
  type UseMutationResult,
} from '@tanstack/react-query';
import { apiClient } from '../client.js';
import type { paths } from '../types.gen.js';

type MutationMethod = 'post' | 'put' | 'patch' | 'delete';

type MutationPaths<M extends MutationMethod> = {
  [K in keyof paths as paths[K] extends Record<M, unknown> ? K : never]: paths[K];
};

type MutationBody<P extends keyof paths, M extends MutationMethod> =
  paths[P] extends Record<M, { requestBody: { content: { 'application/json': infer B } } }> ? B : never;

type MutationResponse<P extends keyof paths, M extends MutationMethod> =
  paths[P] extends Record<M, { responses: { 200: { content: { 'application/json': infer R } } } }>
    ? R
    : paths[P] extends Record<M, { responses: { 201: { content: { 'application/json': infer R } } } }>
      ? R
      : void;

export interface UseApiMutationOptions<P extends keyof paths, M extends MutationMethod>
  extends Omit<
    UseMutationOptions<MutationResponse<P, M>, Error, MutationBody<P, M>>,
    'mutationFn'
  > {
  /**
   * Query keys / path patterns to invalidate after success.
   * Example: invalidates all queries starting with ['api', '/api/v1/policies'].
   */
  invalidateQueries?: readonly (readonly unknown[])[];
  /**
   * Show Sonner toast on error (default true).
   */
  showErrorToast?: boolean;
  /**
   * Show Sonner toast on success.
   */
  successToastMessage?: string;
}

/**
 * Typed mutation hook.
 *
 * @example
 * const createPolicy = useApiMutation('/api/v1/policies', 'post', {
 *   invalidateQueries: [['api', '/api/v1/policies']],
 *   successToastMessage: 'Police creee',
 * });
 * createPolicy.mutate({ name: 'Auto Tiers', tenantId: '...' });
 */
export function useApiMutation<P extends keyof MutationPaths<M>, M extends MutationMethod>(
  path: P,
  method: M,
  options: UseApiMutationOptions<P, M> = {},
): UseMutationResult<MutationResponse<P, M>, Error, MutationBody<P, M>> {
  const queryClient = useQueryClient();
  const {
    invalidateQueries,
    showErrorToast = true,
    successToastMessage,
    onSuccess,
    onError,
    ...rest
  } = options;

  return useMutation<MutationResponse<P, M>, Error, MutationBody<P, M>>({
    mutationFn: async (body) => {
      const methodFn = method.toUpperCase() as 'POST' | 'PUT' | 'PATCH' | 'DELETE';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error, response } = await (apiClient as any)[methodFn](path, {
        body,
      });

      if (error || !response.ok) {
        throw new Error(
          `[api-client] ${methodFn} ${String(path)} failed: ${response.status} ${
            error ? JSON.stringify(error) : response.statusText
          }`,
        );
      }
      return data as MutationResponse<P, M>;
    },
    onSuccess: async (data, variables, context) => {
      if (invalidateQueries) {
        await Promise.all(
          invalidateQueries.map((qk) => queryClient.invalidateQueries({ queryKey: qk })),
        );
      }
      if (successToastMessage && typeof window !== 'undefined') {
        try {
          const { toast } = await import(/* @vite-ignore */ '@insurtech/shared-ui/components/toaster');
          toast.success(successToastMessage);
        } catch {
          // shared-ui toast not available -> silent
        }
      }
      onSuccess?.(data, variables, context);
    },
    onError: async (error, variables, context) => {
      if (showErrorToast && typeof window !== 'undefined') {
        try {
          const { toast } = await import(/* @vite-ignore */ '@insurtech/shared-ui/components/toaster');
          toast.error(error.message);
        } catch {
          // shared-ui toast not available -> silent
        }
      }
      onError?.(error, variables, context);
    },
    ...rest,
  });
}
