/**
 * Sentry SDK configuration builder.
 *
 * initSentry() :
 *   - Si SENTRY_DSN non defini -> log warn et skip (pas de crash).
 *   - Si SENTRY_DSN defini -> Sentry.init() avec options standards.
 *
 * Options :
 *   - environment : NODE_ENV (development/staging/production)
 *   - release     : APP_VERSION (2.2.0)
 *   - tracesSampleRate : 1.0 dev, 0.1 prod (cost control)
 *   - beforeSend  : PII scrubber hook
 *   - integrations: NodeProfilingIntegration (CPU profiling)
 *
 * IMPORTANT : appeler initSentry() AVANT NestFactory.create() dans main.ts.
 *
 * Reference : decision-006 (no-emoji) + CNDP loi 09-08.
 * Tache : 1.3.12 (Sprint 3 / Phase 1).
 */
import * as Sentry from '@sentry/nestjs';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { sentryBeforeSend } from './sentry-before-send';

/** Flag interne indiquant si Sentry a ete initialise. */
let sentryInitialized = false;

/**
 * Retourne true si Sentry a ete initialise (utile pour les tests).
 */
export function isSentryInitialized(): boolean {
  return sentryInitialized;
}

/**
 * Initialise le SDK Sentry.
 *
 * No-op si SENTRY_DSN n'est pas defini dans les variables d'environnement.
 * Doit etre appelee le plus tot possible dans le bootstrap (avant NestFactory).
 */
export function initSentry(): void {
  const dsn = process.env['SENTRY_DSN'];
  const nodeEnv = process.env['NODE_ENV'] ?? 'development';
  const release = process.env['APP_VERSION'] ?? '0.1.0';

  if (!dsn) {
    // Log minimal -- Pino pas encore disponible a ce stade du boot.
    // eslint-disable-next-line no-console
    console.warn('[SentryConfig] SENTRY_DSN not set -- Sentry disabled.');
    return;
  }

  const isProd = nodeEnv === 'production';

  Sentry.init({
    dsn,
    environment: nodeEnv,
    release: `skalean-insurtech-api@${release}`,
    // tracesSampleRate : 10% en prod (cost control), 100% en dev/staging.
    tracesSampleRate: isProd ? 0.1 : 1.0,
    // profilesSampleRate : fraction des transactions deja echantillonnees a profiler.
    profilesSampleRate: isProd ? 0.1 : 1.0,
    integrations: [nodeProfilingIntegration()],
    beforeSend: sentryBeforeSend,
    // Desactive les fingerprints auto pour les erreurs normales
    // (sera configure finement Sprint 5+ avec les BusinessError).
    attachStacktrace: true,
    // Limite les breadcrumbs pour eviter le stockage de donnees PII.
    maxBreadcrumbs: 20,
  });

  sentryInitialized = true;
}

/**
 * Capture une exception dans Sentry.
 * No-op si Sentry n'est pas initialise (SENTRY_DSN absent).
 *
 * @param exception - Exception a capturer (Error ou valeur quelconque)
 * @param context   - Contexte optionnel (tenant_id, user_id, request_id)
 */
export function sentryCaptureException(
  exception: unknown,
  context?: {
    tenantId?: string;
    userId?: string;
    requestId?: string;
  },
): void {
  if (!sentryInitialized) return;

  Sentry.withScope((scope) => {
    if (context?.tenantId) {
      scope.setTag('tenant_id', context.tenantId);
    }
    if (context?.userId) {
      scope.setUser({ id: context.userId });
    }
    if (context?.requestId) {
      scope.setTag('request_id', context.requestId);
    }
    Sentry.captureException(exception);
  });
}

/**
 * Remet a zero le flag d'initialisation (tests uniquement).
 * NE PAS utiliser en production.
 */
export function resetSentryStateForTesting(): void {
  sentryInitialized = false;
}
