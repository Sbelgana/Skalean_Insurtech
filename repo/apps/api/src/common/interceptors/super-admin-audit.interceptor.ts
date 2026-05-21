/**
 * SuperAdminAuditInterceptor -- audit obligatoire loi 09-08 CNDP.
 *
 * Publie super_admin_access_granted/failed sur CHAQUE call admin (route avec
 * @SuperAdminOnly ou @AdminOnly). Async publish ne bloque pas la response.
 *
 * Format Pino structure :
 *   action=super_admin_access_granted
 *   user_id=<uuid>, role=<super_admin_platform|analyst_support>
 *   method=<POST|GET|...>, path=<url>
 *   ip=<x.x.x.x>, user_agent=<truncated>
 *   trace_id=<W3C> request_id=<correlation>
 *   tenant_target=<uuid|->  (si endpoint touche un tenant via :id param)
 *   duration_ms=<float>     (sur completion)
 *   status_code=<int>       (sur completion)
 *
 * Sprint 9 (comm worker) remplacera Pino structured -> Kafka topic
 * insurtech.events.audit.super_admin.action_*.
 *
 * Reference : Sprint 6 / Tache 2.2.10 + loi 09-08 CNDP audit trail 10 ans.
 */

import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantContextService } from '@insurtech/auth';
import { type Observable, tap } from 'rxjs';
import { ADMIN_ONLY_KEY, SUPER_ADMIN_ONLY_KEY } from '../decorators/metadata-keys.js';

@Injectable()
export class SuperAdminAuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(SuperAdminAuditInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly tenantContext: TenantContextService,
  ) {}

  intercept(executionContext: ExecutionContext, next: CallHandler): Observable<unknown> {
    const handler = executionContext.getHandler();
    const classRef = executionContext.getClass();

    const isAdmin =
      this.reflector.getAllAndOverride<boolean | undefined>(ADMIN_ONLY_KEY, [handler, classRef]) ??
      this.reflector.getAllAndOverride<boolean | undefined>(SUPER_ADMIN_ONLY_KEY, [
        handler,
        classRef,
      ]);

    if (!isAdmin) {
      return next.handle();
    }

    const request = executionContext.switchToHttp().getRequest<{
      method?: string;
      url?: string;
      ip?: string;
      headers?: Record<string, string | string[] | undefined>;
      params?: Record<string, string>;
    }>();
    const ctx = this.tenantContext.getCurrentContext();
    const start = process.hrtime.bigint();

    const baseFields = this.buildBaseFields(request, ctx, classRef.name, handler.name);

    // Log granted as soon as the request enters the controller chain (after guards).
    this.publish('super_admin_access_granted', baseFields);

    return next.handle().pipe(
      tap({
        next: () => {
          const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
          this.publish('super_admin_action_completed', {
            ...baseFields,
            duration_ms: durationMs.toFixed(2),
          });
        },
        error: (err: unknown) => {
          const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
          const status = this.extractStatus(err);
          this.publish('super_admin_action_failed', {
            ...baseFields,
            duration_ms: durationMs.toFixed(2),
            status_code: status,
            error: err instanceof Error ? err.message : String(err),
          });
        },
      }),
    );
  }

  private buildBaseFields(
    request: {
      method?: string;
      url?: string;
      ip?: string;
      headers?: Record<string, string | string[] | undefined>;
      params?: Record<string, string>;
    },
    ctx: ReturnType<TenantContextService['getCurrentContext']>,
    controller: string,
    handler: string,
  ): Record<string, string> {
    const ua = request.headers?.['user-agent'];
    const userAgent = Array.isArray(ua) ? ua[0] ?? 'unknown' : (ua ?? 'unknown');

    return {
      controller,
      handler,
      method: request.method ?? 'GET',
      path: request.url ?? '-',
      ip: request.ip ?? '-',
      user_agent: userAgent.slice(0, 120),
      user_id: ctx?.userId ?? '-',
      role: ctx?.userRole ?? '-',
      tenant_target: request.params?.['id'] ?? '-',
      trace_id: ctx?.traceId ?? '-',
      correlation_id: ctx?.correlationId ?? '-',
    };
  }

  private publish(action: string, fields: Record<string, string>): void {
    // Async-safe : try/catch silent pour ne JAMAIS bloquer la response.
    try {
      const serialized = Object.entries(fields)
        .map(([k, v]) => `${k}=${v}`)
        .join(' ');
      this.logger.log(`${action} ${serialized}`);
    } catch (err) {
      // Audit publish failure : log error mais ne PAS reject la request.
      this.logger.error(
        `super_admin_audit_publish_failed action=${action} error=${(err as Error).message}`,
      );
    }
  }

  private extractStatus(err: unknown): string {
    if (typeof err === 'object' && err && 'status' in err && typeof (err as { status: unknown }).status === 'number') {
      return String((err as { status: number }).status);
    }
    return '500';
  }
}
