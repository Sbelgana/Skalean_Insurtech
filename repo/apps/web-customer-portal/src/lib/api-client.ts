/**
 * Axios HTTP client -- web-customer-portal
 * Reference : task-1.4.5 Sprint 4 Phase 1
 */
import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
  AxiosError,
} from 'axios';
import * as Sentry from '@sentry/nextjs';
import { useCustomerTenantStore } from '@/store/customer-tenant-store';
import { generateCryptoId } from '@/lib/crypto-id';
import { logger } from '@/lib/logger';

const MUTATION_METHODS = new Set(['post', 'put', 'patch', 'delete']);

const baseURL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const tenantHeader = process.env.NEXT_PUBLIC_TENANT_ID_HEADER ?? 'x-tenant-id';
const traceHeader = process.env.NEXT_PUBLIC_TRACE_ID_HEADER ?? 'x-trace-id';

export interface ApiClientOptions {
  baseURL?: string;
  timeout?: number;
  withCredentials?: boolean;
}

export function createApiClient(options: ApiClientOptions = {}): AxiosInstance {
  const instance = axios.create({
    baseURL: options.baseURL ?? baseURL,
    timeout: options.timeout ?? 30_000,
    withCredentials: options.withCredentials ?? false,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  });

  instance.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      const method = (config.method ?? 'get').toLowerCase();

      if (typeof window !== 'undefined') {
        const tenantId = useCustomerTenantStore.getState().tenantId;
        if (tenantId) {
          config.headers.set(tenantHeader, tenantId);
        } else if (!config.url?.includes('/auth/') && !config.url?.includes('/health')) {
          logger.warn({ url: config.url }, 'Request without tenant-id (non-auth route)');
        }
      }

      const traceId = generateCryptoId();
      config.headers.set(traceHeader, traceId);

      if (MUTATION_METHODS.has(method)) {
        config.headers.set('Idempotency-Key', generateCryptoId());
      }

      if (typeof window !== 'undefined') {
        const token = sessionStorage.getItem('skalean.access_token');
        if (token) {
          config.headers.set('Authorization', `Bearer ${token}`);
        }
      }

      return config;
    },
    (error: AxiosError) => Promise.reject(error),
  );

  instance.interceptors.response.use(
    (response: AxiosResponse) => response,
    async (error: AxiosError) => {
      const status = error.response?.status;
      const config = error.config as (AxiosRequestConfig & { _retry?: boolean }) | undefined;

      if (status === 401 && config && !config._retry) {
        config._retry = true;
        logger.warn({ url: config.url }, 'Received 401, refresh flow placeholder');
        return Promise.reject(error);
      }

      if (status && status >= 500) {
        Sentry.captureException(error, {
          tags: { type: 'api-5xx', status: String(status) },
          extra: { url: error.config?.url, method: error.config?.method },
        });
        logger.error(
          { status, url: error.config?.url, message: error.message },
          'API 5xx error',
        );
      }

      return Promise.reject(error);
    },
  );

  return instance;
}

export const apiClient = createApiClient();
