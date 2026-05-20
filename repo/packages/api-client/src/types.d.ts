// Type declarations for optional lazy-imported modules.
// These modules are imported via dynamic import() inside try-catch blocks
// and will be available at runtime when the respective packages are built
// (shared-ui Sprint 4+ stores, Sentry Sprint 8+).

// @insurtech/shared-ui stores (Sprint 4 task 1.4.8)
declare module '@insurtech/shared-ui/stores/tenant-store' {
  interface TenantStoreState {
    tenantId?: string | null;
    traceId?: string | null;
    userId?: string | null;
  }
  export const useTenantStore: {
    getState: () => TenantStoreState;
  };
}

declare module '@insurtech/shared-ui/stores/auth-store' {
  interface AuthStoreState {
    accessToken?: string | null;
    refreshToken?: string | null;
    setTokens: (accessToken: string, refreshToken: string) => void;
  }
  export const useAuthStore: {
    getState: () => AuthStoreState;
  };
}

// @insurtech/shared-ui components (Sprint 4 task 1.4.8)
declare module '@insurtech/shared-ui/components/toaster' {
  export const toast: {
    success: (message: string) => void;
    error: (message: string) => void;
    info: (message: string) => void;
    warning: (message: string) => void;
  };
}

// @sentry/nextjs (optional, Sprint 8+)
declare module '@sentry/nextjs' {
  export function captureException(
    error: Error,
    context?: { tags?: Record<string, string> },
  ): void;
}
