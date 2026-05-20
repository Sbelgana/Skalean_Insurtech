// @insurtech/api-client -- tenant header injection middleware
// Reads tenant context from @insurtech/shared-ui Zustand store and injects x-tenant-id header.
// Multi-tenant strict: every request must carry tenant_id (UUIDv4) for backend RBAC + scoping (Sprint 6).
// CNDP Loi 09-08: tenant_id is a UUID, not PII -> safe to log + transmit.

import type { Middleware } from 'openapi-fetch';

/**
 * Lazy import to avoid circular dep between api-client and shared-ui.
 * shared-ui exposes `useTenantStore` (Zustand) since 1.4.8.
 */
async function readTenantContext(): Promise<{
  tenantId: string | null;
  traceId: string | null;
  userId: string | null;
}> {
  // SSR guard: in Node.js / RSC server context, store is not available
  if (typeof window === 'undefined') {
    return { tenantId: null, traceId: null, userId: null };
  }

  try {
    const { useTenantStore } = await import(/* @vite-ignore */ '@insurtech/shared-ui/stores/tenant-store');
    const state = useTenantStore.getState();
    return {
      tenantId: state.tenantId ?? null,
      traceId: state.traceId ?? crypto.randomUUID(),
      userId: state.userId ?? null,
    };
  } catch {
    return { tenantId: null, traceId: null, userId: null };
  }
}

export const tenantMiddleware: Middleware = {
  async onRequest({ request }) {
    const { tenantId, traceId, userId } = await readTenantContext();

    if (tenantId) {
      request.headers.set('x-tenant-id', tenantId);
    }
    if (traceId) {
      request.headers.set('x-trace-id', traceId);
    }
    if (userId) {
      request.headers.set('x-user-id', userId);
    }

    // Locale propagation for backend i18n (error messages, validation)
    if (typeof document !== 'undefined') {
      const locale = document.documentElement.lang ?? 'fr';
      request.headers.set('Accept-Language', locale);
    }

    return request;
  },
};
