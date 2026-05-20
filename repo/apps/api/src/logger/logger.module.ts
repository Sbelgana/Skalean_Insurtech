/**
 * LoggerModule -- module global Pino pour Skalean InsurTech v2.2 API.
 *
 * Enveloppe `nestjs-pino` avec :
 *   - Redaction PII (CNDP loi 09-08) via `pii-redact-paths`.
 *   - Injection correlation OpenTelemetry (trace_id, span_id) via `customProps`.
 *   - Niveau de log pilote par la variable d'env `LOG_LEVEL` (Zod valide).
 *   - Formatage JSON uniforme : champ `level` label (pas code numerique).
 *   - Horodatage ISO 8601.
 *
 * Pattern NestJS @Global() : exporte Logger et PinoLogger afin que tout
 * module puisse les injecter sans importer LoggerModule explicitement.
 *
 * Boot order : LoggerModule.forRoot() doit etre le PREMIER import de AppModule
 * afin que les providers soient disponibles pour Config, Database, Redis, Kafka.
 *
 * Reference : decision-003 (NestJS) + decision-006 (no-emoji).
 * Tache : 1.3.3 (Sprint 3 / Phase 1).
 */
import { Global, Module, type DynamicModule } from '@nestjs/common';
import { LoggerModule as NestjsPinoModule } from 'nestjs-pino';
import type { Options } from 'pino-http';
import { trace } from '@opentelemetry/api';
import { PII_REDACT_PATHS } from './pii-redact-paths';

/**
 * Extrait les identifiants de correlation OpenTelemetry du span actif.
 *
 * Retourne un objet vide si aucun span n'est actif (requetes hors contexte HTTP,
 * boot, tests unitaires sans OTel).
 *
 * Exporte uniquement pour les tests unitaires. Ne pas appeler directement
 * en dehors de `buildPinoHttpOptions`.
 */
export function getOtelCorrelationIds(): Record<string, string | undefined> {
  const span = trace.getActiveSpan();
  if (!span) return {};
  const ctx = span.spanContext();
  return {
    trace_id: ctx.traceId,
    span_id: ctx.spanId,
  };
}

/**
 * Construit les options pino-http injectees dans `NestjsPinoModule.forRoot()`.
 * Appel lazily au moment du forRoot() pour lire les variables d'env au runtime.
 */
function buildPinoHttpOptions(): Options {
  return {
    level: process.env['LOG_LEVEL'] ?? 'info',
    redact: {
      paths: PII_REDACT_PATHS as string[],
      censor: '[REDACTED]',
    },
    customProps: (_req, _res) => ({
      ...getOtelCorrelationIds(),
      service: 'skalean-insurtech-api',
      version: process.env['APP_VERSION'] ?? '2.2.0',
      env: process.env['NODE_ENV'] ?? 'development',
    }),
    formatters: {
      level: (label: string) => ({ level: label }),
    },
    timestamp: () => `,"time":"${new Date().toISOString()}"`,
    autoLogging: true,
  };
}

/**
 * LoggerModule -- module global Pino.
 *
 * Usage dans AppModule :
 * ```typescript
 * imports: [LoggerModule.forRoot(), ...]
 * ```
 *
 * Usage dans les providers (injection) :
 * ```typescript
 * constructor(private readonly logger: Logger) {}
 * // ou
 * constructor(private readonly logger: PinoLogger) {}
 * ```
 */
@Global()
@Module({})
export class LoggerModule {
  static forRoot(): DynamicModule {
    const pinoModule = NestjsPinoModule.forRoot({
      pinoHttp: buildPinoHttpOptions(),
    });

    return {
      module: LoggerModule,
      imports: [pinoModule],
      // Re-export the entire pinoModule -- consumers get Logger + PinoLogger
      // via NestJS module transitive export resolution. Exporting class tokens
      // directly fails because they are providers of nestjs-pino, not of this
      // module (UnknownExportException at boot).
      exports: [NestjsPinoModule],
      global: true,
    };
  }
}
