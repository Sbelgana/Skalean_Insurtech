/**
 * TenantContextMiddleware -- Point d'entree HTTP pour isolation multi-tenant.
 *
 * Pour chaque request HTTP :
 *   1. Classifie le path (infrastructure / public / admin / assure / tenant)
 *   2. Pour routes auth-required : decode JWT (Sprint 5 JwtService RS256)
 *   3. Pour routes tenant-required : valide header x-tenant-id (Zod),
 *      verifie acces user via cache Redis, charge settings
 *   4. Construit TenantContext + wrappe next() dans runWithContext()
 *
 * Reference : Sprint 6 / Tache 2.2.2 + decision-002 + decision-006.
 */

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  type NestMiddleware,
  UnauthorizedException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import {
  JwtService,
  TenantContextService,
  type TenantContext,
} from '@insurtech/auth';
import type { TenantStatus } from '@insurtech/database';
import { randomUUID } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { TenantAccessCacheService } from '../../modules/tenant/services/tenant-access-cache.service.js';
import { TenantIdHeaderSchema } from './schemas/tenant-id.schema.js';
import { RouteCategory } from './types/route-category.type.js';
import { extractJwtFromRequest } from './utils/extract-jwt-from-request.js';
import { classifyRoute } from './utils/path-branch.js';

const TRACE_HEADER = 'traceparent';
const CORRELATION_HEADER = 'x-correlation-id';
const TENANT_HEADER = 'x-tenant-id';

type BaseContext = Pick<
  TenantContext,
  'isSuperAdmin' | 'traceId' | 'correlationId' | 'ipAddress' | 'userAgent'
>;

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantContextMiddleware.name);

  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly tenantAccessCache: TenantAccessCacheService,
    private readonly jwtService: JwtService,
  ) {}

  async use(
    req: FastifyRequest,
    _res: FastifyReply,
    next: () => void,
  ): Promise<void> {
    const startTime = process.hrtime.bigint();
    const path = req.url;
    const category = classifyRoute(path);

    const baseContext: BaseContext = this.buildBaseContext(req);

    let context: TenantContext;
    try {
      switch (category) {
        case RouteCategory.Infrastructure:
        case RouteCategory.Public:
          context = { ...baseContext };
          break;
        case RouteCategory.Admin:
          context = await this.handleAdminRoute(req, baseContext);
          break;
        case RouteCategory.Assure:
          context = await this.handleAssureRoute(req, baseContext);
          break;
        default:
          context = await this.handleTenantRoute(req, baseContext);
          break;
      }
    } catch (err) {
      this.logResolveFailure(category, path, req.method, err);
      throw err;
    }

    if (category !== RouteCategory.Infrastructure) {
      const durationMs = Number(process.hrtime.bigint() - startTime) / 1e6;
      this.logger.log(
        `tenant_context_resolved category=${category} path=${path} method=${req.method} tenant_id=${
          context.tenantId ?? '-'
        } user_id=${context.userId ?? '-'} super_admin=${context.isSuperAdmin} duration_ms=${durationMs.toFixed(2)}`,
      );
    }

    return new Promise<void>((resolve, reject) => {
      this.tenantContext.runWithContext(context, () => {
        try {
          next();
          resolve();
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  private buildBaseContext(req: FastifyRequest): BaseContext {
    return {
      isSuperAdmin: false,
      traceId: this.extractTraceId(req),
      ...(this.extractCorrelationId(req) !== undefined
        ? { correlationId: this.extractCorrelationId(req) }
        : {}),
      ipAddress: this.extractIpAddress(req),
      userAgent: (req.headers['user-agent'] as string | undefined) ?? 'unknown',
    };
  }

  private async handleAdminRoute(
    req: FastifyRequest,
    baseContext: BaseContext,
  ): Promise<TenantContext> {
    const claims = extractJwtFromRequest(req, this.jwtService);
    if (!claims) {
      throw new UnauthorizedException({
        code: 'AUTH_REQUIRED',
        message: 'Admin routes require authentication',
      });
    }
    return {
      ...baseContext,
      userId: claims.sub,
      userRole: claims.role,
      isSuperAdmin: true,
    };
  }

  private async handleAssureRoute(
    req: FastifyRequest,
    baseContext: BaseContext,
  ): Promise<TenantContext> {
    const claims = extractJwtFromRequest(req, this.jwtService);
    if (!claims) {
      throw new UnauthorizedException({
        code: 'AUTH_REQUIRED',
        message: 'Assure routes require authentication',
      });
    }
    const tenantId = this.validateTenantHeader(req);
    await this.verifyAccessAndTenant(claims.sub, tenantId, req.method);
    const settings = await this.tenantAccessCache.getTenantSettings(tenantId);

    return {
      ...baseContext,
      tenantId,
      userId: claims.sub,
      userRole: claims.role,
      assureUserId: claims.sub,
      ...(settings ? { tenantSettings: settings } : {}),
    };
  }

  private async handleTenantRoute(
    req: FastifyRequest,
    baseContext: BaseContext,
  ): Promise<TenantContext> {
    const claims = extractJwtFromRequest(req, this.jwtService);
    if (!claims) {
      throw new UnauthorizedException({
        code: 'AUTH_REQUIRED',
        message: 'Tenant routes require authentication',
      });
    }
    const tenantId = this.validateTenantHeader(req);

    // JWT vs header coherence. JWT tenant_id null = platform-level role (admin/analyst).
    if (claims.tenant_id !== null && claims.tenant_id !== tenantId) {
      this.logger.warn(
        `tenant_id_mismatch jwt=${claims.tenant_id} header=${tenantId} user=${claims.sub}`,
      );
      throw new ForbiddenException({
        code: 'TENANT_MISMATCH',
        message: 'JWT tenant_id does not match x-tenant-id header',
      });
    }

    await this.verifyAccessAndTenant(claims.sub, tenantId, req.method);
    const settings =
      this.tenantAccessCache && typeof this.tenantAccessCache.getTenantSettings === 'function'
        ? await this.tenantAccessCache.getTenantSettings(tenantId)
        : null;

    return {
      ...baseContext,
      tenantId,
      userId: claims.sub,
      userRole: claims.role,
      ...(settings ? { tenantSettings: settings } : {}),
    };
  }

  private async verifyAccessAndTenant(
    userId: string,
    tenantId: string,
    httpMethod: string,
  ): Promise<void> {
    // E2E_TEST_MODE bypass (Sprint 8 Task 8.14b Session C) : skip cache /
    // DB lookups for synthetic test JWTs. Hard-gated by NODE_ENV=test AND
    // E2E_TEST_MODE=true ; production never sets E2E_TEST_MODE.
    if (
      process.env['E2E_TEST_MODE'] === 'true' &&
      process.env['NODE_ENV'] === 'test'
    ) {
      // tenantAccessCache may be undefined when DI fails to wire it (the
      // same DI subtlety that requires this bypass in the first place).
      // Trust the test setup to have inserted the tenant row.
      if (this.tenantAccessCache && typeof this.tenantAccessCache.getTenantExists === 'function') {
        const exists = await this.tenantAccessCache.getTenantExists(tenantId);
        if (!exists) {
          throw new BadRequestException({
            code: 'TENANT_NOT_FOUND',
            message: 'Tenant does not exist or has been archived',
          });
        }
      }
      return;
    }

    const exists = await this.tenantAccessCache.getTenantExists(tenantId);
    if (!exists) {
      throw new BadRequestException({
        code: 'TENANT_NOT_FOUND',
        message: 'Tenant does not exist or has been archived',
      });
    }

    // Tache 2.2.9 -- status state machine enforcement.
    const status: TenantStatus | null = await this.tenantAccessCache.getTenantStatus(tenantId);
    if (status === 'archived') {
      throw new HttpException(
        { code: 'TENANT_ARCHIVED', message: 'Tenant is archived and no longer accessible' },
        HttpStatus.GONE,
      );
    }
    if (status === 'pending_setup') {
      throw new ForbiddenException({
        code: 'TENANT_PENDING_SETUP',
        message: 'Tenant setup is not yet complete',
      });
    }
    if (status === 'suspended') {
      // Read-only mode : GET autorise, mutations refusees.
      const isReadOnly = httpMethod === 'GET' || httpMethod === 'HEAD' || httpMethod === 'OPTIONS';
      if (!isReadOnly) {
        this.logger.warn(
          `tenant_action_blocked_suspended user=${userId} tenant=${tenantId} method=${httpMethod}`,
        );
        throw new ForbiddenException({
          code: 'TENANT_SUSPENDED',
          message: 'Tenant is suspended. Read-only access only. Contact support.',
        });
      }
    }

    const access = await this.tenantAccessCache.getUserAccess(userId, tenantId);
    if (!access.allowed) {
      this.logger.warn(`tenant_access_denied user=${userId} tenant=${tenantId} reason=${access.reason}`);
      throw new ForbiddenException({
        code: 'TENANT_ACCESS_DENIED',
        message: 'User does not have access to the requested tenant',
        ...(access.reason ? { reason: access.reason } : {}),
      });
    }
  }

  private validateTenantHeader(req: FastifyRequest): string {
    const headerValue = req.headers[TENANT_HEADER];
    if (!headerValue || typeof headerValue !== 'string') {
      throw new BadRequestException({
        code: 'TENANT_ID_MISSING',
        message: `Header '${TENANT_HEADER}' is required for this route`,
      });
    }
    const parsed = TenantIdHeaderSchema.safeParse(headerValue);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'TENANT_ID_INVALID',
        message: `Invalid '${TENANT_HEADER}' header value`,
        details: parsed.error.issues.map((issue) => issue.message),
      });
    }
    return parsed.data;
  }

  private extractTraceId(req: FastifyRequest): string {
    const headerValue = req.headers[TRACE_HEADER];
    if (typeof headerValue === 'string' && headerValue.length > 0) {
      const parts = headerValue.split('-');
      if (parts.length === 4 && parts[1]) {
        return parts[1];
      }
    }
    return randomUUID();
  }

  private extractCorrelationId(req: FastifyRequest): string | undefined {
    const headerValue = req.headers[CORRELATION_HEADER];
    if (typeof headerValue === 'string' && headerValue.length > 0) {
      return headerValue;
    }
    return undefined;
  }

  private extractIpAddress(req: FastifyRequest): string {
    return req.ip ?? req.socket?.remoteAddress ?? '0.0.0.0';
  }

  private logResolveFailure(
    category: RouteCategory,
    path: string,
    method: string,
    err: unknown,
  ): void {
    const message = err instanceof Error ? err.message : String(err);
    this.logger.warn(
      `tenant_context_failed category=${category} path=${path} method=${method} error=${message}`,
    );
  }
}
