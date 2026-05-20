/**
 * SentryNestModule -- module NestJS pour l'observabilite Sentry.
 *
 * Module leger : Sentry est initialise dans main.ts via initSentry()
 * (appele AVANT NestFactory.create).
 * Ce module log le statut Sentry au demarrage de l'AppModule.
 *
 * @sentry/nestjs 8.43.0 n'exporte pas de SentryModule.forRoot().
 * L'integration NestJS se fait via nestIntegration() et decorateurs.
 *
 * Reference : decision-006 (no-emoji) + CNDP loi 09-08.
 * Tache : 1.3.12 (Sprint 3 / Phase 1).
 */
import { Global, Logger, Module, type OnModuleInit } from '@nestjs/common';

@Global()
@Module({})
export class SentryNestModule implements OnModuleInit {
  private readonly logger = new Logger(SentryNestModule.name);

  onModuleInit(): void {
    const dsn = process.env['SENTRY_DSN'];
    if (dsn) {
      this.logger.log('[SentryNestModule] Sentry active (DSN configure).');
    } else {
      this.logger.warn('[SentryNestModule] SENTRY_DSN absent -- Sentry desactive.');
    }
  }
}
