/**
 * Skalean InsurTech v2.2 -- Backend API
 *
 * Boot orchestrator pour apps/api (NestJS 10.4 + Fastify 4.28).
 *
 * Order strict (NE PAS MODIFIER sans validation architecte) :
 *   1. import 'reflect-metadata' (polyfill DI obligatoire)
 *   2. startTelemetry() (auto-instrumentation OpenTelemetry AVANT tout import metier)
 *   3. loadEnv() (Zod runtime validation)
 *   4. NestFactory.create<NestFastifyApplication>(AppModule, FastifyAdapter, { bufferLogs: true })
 *   5. app.useLogger(app.get(Logger)) (nestjs-pino -- remplace logger default, flush bufferLogs)
 *   6. registerSecurity(app, env) (Helmet, CORS, Compress -- Tache 1.3.5)
 *   7. app.enableShutdownHooks() (active onModuleDestroy providers)
 *   8. registerGracefulShutdown() (handlers SIGTERM/SIGINT chain)
 *   9. app.listen(port, '0.0.0.0') (bind 0.0.0.0 pour Docker)
 *
 * Reference : decision-003 (NestJS Fastify) + decision-006 (no-emoji ABSOLUE).
 * Tache : 1.3.1 + 1.3.3 + 1.3.5 (Sprint 3 / Phase 1).
 */

// Polyfill DI -- DOIT etre la TOUTE PREMIERE ligne avant tout autre import.
import 'reflect-metadata';

// Telemetry FIRST -- avant tout import metier afin que OpenTelemetry
// auto-instrumentation patche les modules (http, pg, ioredis, kafkajs).
import { startTelemetry } from '@insurtech/shared-utils/telemetry';

// Boot order helpers
import { measureBootTime } from './bootstrap/start-time-logger';
import { registerGracefulShutdown } from './bootstrap/graceful-shutdown';
import { registerSecurity } from './bootstrap/security';

// NestJS imports (charges apres telemetry init)
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';

// Logger Pino (nestjs-pino -- remplace le Logger NestJS default apres boot).
import { Logger } from 'nestjs-pino';

// Env loader Zod (Sprint 2 Tache 1.2.14)
import { loadEnv } from '@insurtech/shared-config';

// App module (skeleton -- 1.3.2 enrichit)
import { AppModule } from './app.module';

/**
 * Bootstrap function -- entree principale.
 * Tout code metier passe par cette fonction. Aucun side-effect au niveau module.
 */
async function bootstrap(): Promise<void> {
  // Mesure du boot time (warn si > 5s).
  const bootStart = process.hrtime.bigint();

  // === ETAPE 1 : Telemetry FIRST ===
  // Sans cette etape avant tout import NestJS, l'auto-instrumentation
  // OpenTelemetry rate les premieres requetes du warm-up.
  startTelemetry();

  // === ETAPE 2 : Validation env Zod ===
  // loadEnv() retourne env type-safe. Si fail, process.exit(1) avec details Zod.
  const env = loadEnv();

  // === ETAPE 3 : Creation app NestJS + Fastify ===
  const bodyLimitMb = Number(process.env['BODY_LIMIT_MB'] ?? '10');
  const bodyLimitBytes = bodyLimitMb * 1024 * 1024;

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      // trustProxy: true requis derriere Cloudflare WAF + Atlas LB.
      // Permet a Fastify de respecter X-Forwarded-For, X-Forwarded-Proto,
      // X-Forwarded-Host pour audit logs et rate-limit.
      trustProxy: true,
      // bodyLimit en bytes (10 MiB par defaut).
      // Au-dela : HTTP 413 Payload Too Large.
      bodyLimit: bodyLimitBytes,
      caseSensitive: true,
      ignoreTrailingSlash: true,
      disableRequestLogging: false,
      maxParamLength: 200,
    }),
    {
      // bufferLogs : true = buffer les logs init NestJS jusqu'a useLogger().
      // Sans cela, les logs avant Pino actif vont vers console default.
      bufferLogs: true,
      // abortOnError : false = ne pas crash sur erreur module init,
      // permet shutdown propre meme si un module fail au boot.
      abortOnError: false,
    },
  );

  // === ETAPE 4 : Logger Pino actif ===
  // app.get(Logger) recupere l'instance nestjs-pino injectee par LoggerModule.
  // Les logs bufferises via bufferLogs: true sont flushes ici vers Pino.
  // Logger de nestjs-pino implemente LoggerService -- compatible NestJS.
  const logger = app.get(Logger);
  app.useLogger(logger);

  // === ETAPE 5 : Plugins de securite Fastify ===
  // Helmet (en-tetes HTTP), CORS (origines env.CORS_ORIGINS), Compress (gzip).
  // Tache 1.3.5 -- ordre : helmet -> cors -> compress (requis par Fastify encap).
  await registerSecurity(app, env);

  // === ETAPE 6 : Active shutdown hooks NestJS ===
  // Sans cela, les providers @OnModuleDestroy ne sont jamais appeles.
  app.enableShutdownHooks();

  // === ETAPE 7 : Graceful shutdown handlers ===
  // Chain : app.close() -> telemetry.shutdown() -> process.exit(0)
  // DB, Redis, Kafka geres via leurs hooks onModuleDestroy dans app.close().
  const timeoutMs = Number(process.env['GRACEFUL_SHUTDOWN_TIMEOUT_MS'] ?? '30000');
  registerGracefulShutdown(app, {
    timeoutMs,
    signals: ['SIGTERM', 'SIGINT'],
    logger,
  });

  // === ETAPE 8 : Listen sur API_PORT, bind 0.0.0.0 ===
  // Bind 0.0.0.0 EXPLICITEMENT (pas localhost) sinon Docker port mapping fail.
  const port = env.API_PORT ?? 4000;
  const host = process.env['API_HOST'] ?? '0.0.0.0';

  await app.listen(port, host);

  // === Boot termine -- log diagnostics ===
  const bootDurationMs = measureBootTime(bootStart, logger);
  logger.log(
    `Skalean InsurTech API listening on http://${host}:${port} ` +
      `(env=${env.NODE_ENV}, version=${env.APP_VERSION ?? '0.1.0'}, ` +
      `boot=${bootDurationMs}ms, pid=${process.pid})`,
  );
}

// === Lancement avec catch global ===
// Export de la promise pour que les tests puissent awaiter la completion.
// eslint-disable-next-line no-console
export const ready = bootstrap().catch((error: unknown) => {
  // Logger Pino non disponible si bootstrap fail tot. Fallback console.error.
  // C'est la SEULE exception au no-console-log policy : ultime fallback boot fail.
  // eslint-disable-next-line no-console
  console.error('[FATAL] Skalean InsurTech API failed to bootstrap:', error);
  process.exit(1);
});
