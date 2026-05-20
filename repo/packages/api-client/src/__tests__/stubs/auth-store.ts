// Stub for @insurtech/shared-ui/stores/auth-store
// Used by vitest.config.ts alias -- real implementation lives in Sprint 5 auth package.
export const useAuthStore = {
  getState: () => ({
    accessToken: null as string | null,
    refreshToken: null as string | null,
    setTokens: (_access: string, _refresh: string) => {},
  }),
};
