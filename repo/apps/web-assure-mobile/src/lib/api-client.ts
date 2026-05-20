/**
 * Axios API client -- web-assure-mobile
 * Reference : task-1.4.7 Sprint 4 Phase 1
 *
 * Intercepteurs :
 *   - x-tenant-id depuis useAssureTenantStore (Zustand)
 *   - x-trace-id UUID v4 par requete
 *   - Idempotency-Key sur POST/PUT/PATCH/DELETE
 *   - Authorization Bearer depuis sessionStorage
 *   - Capture Sentry sur 5xx
 */
import axios from 'axios';
import * as Sentry from '@sentry/nextjs';
import { useAssureTenantStore } from '@/store/assure-tenant-store';
import { generateId } from './crypto-id';
import { logger } from './logger';

const MUTATION_METHODS = new Set(['post', 'put', 'patch', 'delete']);

export function createApiClient(options?: { baseURL?: string }) {
  const client = axios.create({
    baseURL: options?.baseURL ?? (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'),
    timeout: 15_000,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  });

  // Request interceptor
  client.interceptors.request.use((config) => {
    const tenantId = useAssureTenantStore.getState().tenantId;
    if (tenantId) {
      config.headers['x-tenant-id'] = tenantId;
    }

    config.headers['x-trace-id'] = generateId();

    const method = (config.method ?? '').toLowerCase();
    if (MUTATION_METHODS.has(method)) {
      config.headers['Idempotency-Key'] = generateId();
    }

    if (typeof sessionStorage !== 'undefined') {
      const token = sessionStorage.getItem('skalean.access_token');
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
      }
    }

    return config;
  });

  // Response interceptor
  client.interceptors.response.use(
    (response) => response,
    (error: unknown) => {
      if (
        axios.isAxiosError(error) &&
        typeof error.response?.status === 'number' &&
        error.response.status >= 500
      ) {
        logger.error({ status: error.response.status, url: error.config?.url }, 'API 5xx error');
        Sentry.captureException(error);
      }
      return Promise.reject(error);
    },
  );

  return client;
}

export const apiClient = createApiClient();
