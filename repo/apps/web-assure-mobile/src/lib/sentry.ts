/**
 * Sentry browser init -- web-assure-mobile
 * Reference : task-1.4.7 Sprint 4 Phase 1
 *
 * Initialisation idempotente via flag module-level.
 * Appele depuis Providers ('use client') apres montage.
 */
import * as Sentry from '@sentry/nextjs';

let initialized = false;

export function initSentry(): void {
  if (initialized) return;
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

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

  initialized = true;
}
