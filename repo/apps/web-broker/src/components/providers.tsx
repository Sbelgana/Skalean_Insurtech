'use client';

/**
 * Client-side providers -- web-broker
 * Reference : task-1.4.1 Sprint 4 Phase 1
 *
 * Compose :
 *   - QueryClientProvider (instance unique par session SPA)
 *   - ReactQueryDevtools (dev only)
 *   - Sentry browser init (idempotent flag)
 *   - Tenant context sync (cookie -> zustand)
 */
import { useEffect, useRef } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import * as Sentry from '@sentry/nextjs';
import { createQueryClient } from '@/lib/query-client';
import { useTenantStore } from '@/store/tenant-store';
import { logger } from '@/lib/logger';

interface ProvidersProps {
  children: React.ReactNode;
  locale: string;
}

let sentryInitialized = false;

function initSentry(): void {
  if (sentryInitialized) return;
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) {
    logger.debug('Sentry DSN missing, skip browser init');
    return;
  }
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
    ],
    beforeSend(event) {
      if (event.user) {
        delete event.user.email;
        delete event.user.ip_address;
      }
      return event;
    },
  });
  sentryInitialized = true;
}

export function Providers({ children, locale }: ProvidersProps) {
  const queryClientRef = useRef<ReturnType<typeof createQueryClient> | null>(null);
  if (!queryClientRef.current) {
    queryClientRef.current = createQueryClient();
  }
  const queryClient = queryClientRef.current;

  useEffect(() => {
    initSentry();
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const cookieMatch = document.cookie.match(/(?:^|;\s*)skalean\.tenant_id=([^;]+)/);
    if (cookieMatch?.[1]) {
      useTenantStore.getState().setTenantId(decodeURIComponent(cookieMatch[1]));
    }
  }, []);

  useEffect(() => {
    Sentry.setTag('locale', locale);
  }, [locale]);

  const showDevtools = process.env.NODE_ENV === 'development';

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {showDevtools ? <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-right" /> : null}
    </QueryClientProvider>
  );
}
