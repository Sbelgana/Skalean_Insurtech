/**
 * RequestContextModule -- module global NestJS qui applique le middleware
 * RequestContextMiddleware sur toutes les routes.
 *
 * Le middleware initialise AsyncLocalStorage par requete HTTP, propageant
 * request_id, tenant_id, trace_id, span_id a travers la chaine async.
 *
 * @Global() expose le middleware (et la fonction getRequestContext)
 * sans que les modules metier n'aient a importer RequestContextModule.
 *
 * Placement dans AppModule : APRES LoggerModule et AVANT les modules metier,
 * pour que les logs des modules metier incluent automatiquement le contexte.
 *
 * Reference : decision-002 (multi-tenant) + decision-006 (no-emoji).
 * Tache : 1.3.4 (Sprint 3 / Phase 1).
 */
import {
  Global,
  Module,
  type NestModule,
  type MiddlewareConsumer,
} from '@nestjs/common';
import { RequestContextMiddleware } from './request-context.middleware';

@Global()
@Module({
  providers: [RequestContextMiddleware],
  exports: [RequestContextMiddleware],
})
export class RequestContextModule implements NestModule {
  /**
   * Applique RequestContextMiddleware sur toutes les routes (*).
   *
   * Le pattern '*' assure que chaque requete HTTP (routes, healthz, readyz,
   * swagger, etc.) initialise le RequestContext avant que les handlers NestJS
   * ne soient appeles.
   */
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
