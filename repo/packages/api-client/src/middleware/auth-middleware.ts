// @insurtech/api-client -- JWT Bearer + refresh token rotation middleware
// On 401: tries to refresh access token via POST /api/v1/auth/refresh, then retries the original request once.
// Mutex: prevents multiple concurrent refresh requests (multi-tab / parallel calls).
// Failure: redirects to /login (browser only).
// Sprint 5 Auth integration: tokens stored in HttpOnly cookies + accessible via /auth/me probe.

import type { Middleware } from 'openapi-fetch';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
}

/**
 * Module-scope mutex to coordinate concurrent refresh attempts.
 * Promise resolves to the new accessToken once refresh completes.
 */
let refreshPromise: Promise<string | null> | null = null;

async function readAuthState(): Promise<AuthState> {
  if (typeof window === 'undefined') {
    return { accessToken: null, refreshToken: null };
  }
  try {
    const { useAuthStore } = await import(/* @vite-ignore */ '@insurtech/shared-ui/stores/auth-store');
    const state = useAuthStore.getState();
    return {
      accessToken: state.accessToken ?? null,
      refreshToken: state.refreshToken ?? null,
    };
  } catch {
    return { accessToken: null, refreshToken: null };
  }
}

export async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const baseUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';
      const { refreshToken } = await readAuthState();
      if (!refreshToken) {
        return null;
      }

      const response = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
        credentials: 'include',
      });

      if (!response.ok) {
        // Sprint 5 Auth: failed refresh redirects to login
        if (typeof window !== 'undefined') {
          window.location.href = '/login?reason=session-expired';
        }
        return null;
      }

      const data = (await response.json()) as { accessToken: string; refreshToken: string };
      const { useAuthStore } = await import(/* @vite-ignore */ '@insurtech/shared-ui/stores/auth-store');
      useAuthStore.getState().setTokens(data.accessToken, data.refreshToken);
      return data.accessToken;
    } finally {
      // release mutex regardless of outcome
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export const authMiddleware: Middleware = {
  async onRequest({ request }) {
    const { accessToken } = await readAuthState();
    if (accessToken && !request.headers.has('Authorization')) {
      request.headers.set('Authorization', `Bearer ${accessToken}`);
    }
    return request;
  },

  async onResponse({ request, response }) {
    if (response.status !== 401) {
      return response;
    }

    // Avoid infinite loop on refresh endpoint itself
    const url = new URL(request.url);
    if (url.pathname.endsWith('/auth/refresh') || url.pathname.endsWith('/auth/login')) {
      return response;
    }

    const newToken = await refreshAccessToken();
    if (!newToken) {
      return response; // refresh failed, redirect already handled
    }

    // Retry original request with new token (single retry, no recursion)
    const retryRequest = new Request(request, {
      headers: new Headers(request.headers),
    });
    retryRequest.headers.set('Authorization', `Bearer ${newToken}`);
    const retryResponse = await fetch(retryRequest);
    return retryResponse;
  },
};
