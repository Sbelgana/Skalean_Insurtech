/**
 * Graceful shutdown helper -- chain app.close + Telemetry.shutdown avec timeout.
 *
 * Pattern critique pour SLA 99.9% Skalean InsurTech v2.2 :
 * - Refuser nouvelles connexions HTTP (app.close).
 * - Drainer requetes in-flight (Fastify closeWatcher 30s).
 * - Flusher Kafka in-flight (gere via onModuleDestroy du KafkaModule Sprint 3).
 * - Cloturer connexions Postgres pool (gere via onModuleDestroy DatabaseModule Sprint 2).
 * - Quitter Redis (gere via onModuleDestroy RedisModule Sprint 2).
 * - Flusher OpenTelemetry spans/metrics (shutdownTelemetry).
 * - process.exit(0).
 *
 * Reference : decision-003 (NestJS) + decision-006 (no-emoji).
 * Tache : 1.3.1 (Sprint 3 / Phase 1).
 */
import type { INestApplication, LoggerService } from '@nestjs/common';
import { shutdownTelemetry } from '@insurtech/shared-utils/telemetry';

export interface GracefulShutdownOptions {
  /** Timeout total en ms apres lequel process.exit(1) force. Default 30000. */
  timeoutMs: number;
  /** Signaux a intercepter. Default ['SIGTERM', 'SIGINT']. */
  signals: NodeJS.Signals[];
  /** Logger NestJS (LoggerService). */
  logger: LoggerService;
}

/** Flag global qui empeche double-shutdown chain. */
let isShuttingDown = false;

/**
 * Registre les handlers de signal et orchestre la sequence de shutdown.
 * Doit etre appelee APRES app.enableShutdownHooks() et AVANT app.listen().
 */
export function registerGracefulShutdown(
  app: INestApplication,
  options: GracefulShutdownOptions,
): void {
  const { timeoutMs, signals, logger } = options;

  for (const signal of signals) {
    process.on(signal, () => {
      void handleShutdown(signal, app, timeoutMs, logger);
    });
  }

  // Catch uncaught exceptions et unhandled rejections au top-level.
  // Sans cela, Node default behavior = process.exit(1) brutal sans cleanup.
  process.on('uncaughtException', (error: Error) => {
    logger.error?.(`Uncaught exception: ${error.message}`, error.stack);
    void handleShutdown('uncaughtException' as NodeJS.Signals, app, timeoutMs, logger);
  });

  process.on('unhandledRejection', (reason: unknown) => {
    logger.error?.(`Unhandled rejection: ${String(reason)}`);
    void handleShutdown('unhandledRejection' as NodeJS.Signals, app, timeoutMs, logger);
  });
}

/**
 * Orchestre la sequence de shutdown avec timeout et flag anti-double.
 */
async function handleShutdown(
  signal: NodeJS.Signals,
  app: INestApplication,
  timeoutMs: number,
  logger: LoggerService,
): Promise<void> {
  if (isShuttingDown) {
    logger.warn?.(`Already shutting down, ignoring signal ${signal}`);
    return;
  }
  isShuttingDown = true;

  logger.log?.(`Received ${signal}, initiating graceful shutdown (timeout ${timeoutMs}ms)`);

  // Promise.race : la sequence de shutdown VS le timeout total.
  const shutdownPromise = runShutdownSequence(app, logger);
  const timeoutPromise = new Promise<void>((_, reject) =>
    setTimeout(
      () => reject(new Error(`Shutdown timeout exceeded (${timeoutMs}ms)`)),
      timeoutMs,
    ),
  );

  try {
    await Promise.race([shutdownPromise, timeoutPromise]);
    logger.log?.('Graceful shutdown completed successfully');
    process.exit(0);
  } catch (error: unknown) {
    logger.error?.(
      `Graceful shutdown failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}

/**
 * Execute la sequence de shutdown dans l'ordre strict.
 * Chaque etape a son propre try/catch pour ne pas bloquer la suite.
 */
async function runShutdownSequence(
  app: INestApplication,
  logger: LoggerService,
): Promise<void> {
  // Etape 1 : app.close() = drain HTTP + flush onModuleDestroy hooks NestJS.
  // Kafka, DataSource, Redis sont geres via leurs hooks onModuleDestroy.
  await safeStep('app.close', () => app.close(), logger);

  // Etape 2 : Telemetry shutdown = export spans/metrics restants.
  // CETTE ETAPE doit etre faite ICI (pas via onModuleDestroy) car le SDK
  // OTEL est initialise avant NestJS et n'est pas un module NestJS.
  await safeStep('telemetry.shutdown', () => shutdownTelemetry(), logger);
}

/**
 * Wrapper qui execute une etape avec son propre try/catch + log.
 */
async function safeStep(
  name: string,
  fn: () => Promise<void> | void,
  logger: LoggerService,
): Promise<void> {
  const start = Date.now();
  try {
    await fn();
    logger.log?.(`Shutdown step ${name} completed in ${Date.now() - start}ms`);
  } catch (error: unknown) {
    logger.error?.(
      `Shutdown step ${name} failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Reset le flag isShuttingDown pour les tests.
 * NE PAS appeler en dehors des tests Vitest.
 */
export function resetShutdownStateForTesting(): void {
  isShuttingDown = false;
}
