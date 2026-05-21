/**
 * TenantTransactionInterceptor -- Wrap chaque endpoint dans une transaction Postgres
 * avec SET LOCAL (set_config local=true) pour activation RLS automatique.
 *
 * Pour chaque endpoint :
 *   1. Si @SkipTenantTransaction()   -> skip
 *   2. Si pas de TenantContext        -> skip (test/public sans tenant)
 *   3. Si !tenantId && !isSuperAdmin  -> skip (public auth route)
 *   4. Sinon : ouvrir transaction, set_config local, executer handler, commit
 *
 * SECURITE :
 *   - set_config(name, value, true) -> reset automatique au COMMIT/ROLLBACK
 *   - parametres $1 binds -> zero SQL injection vector
 *   - exception handler -> rollback automatique (TypeORM transaction()) + reset session
 *
 * Reference : Sprint 6 / Tache 2.2.4 + decision-002 multi-tenant.
 */

import {
  type CallHandler,
  type ExecutionContext,
  Inject,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantContextService } from '@insurtech/auth';
import type { DataSource } from '@insurtech/database';
import { Observable, from, lastValueFrom } from 'rxjs';
import { DATA_SOURCE_TOKEN } from '../../database/data-source.provider.js';
import { SKIP_TENANT_TRANSACTION_KEY } from '../decorators/skip-tenant-transaction.decorator.js';
import {
  DatabaseTenantContextService,
  type QueryableEntityManager,
} from '../services/database-tenant-context.service.js';

@Injectable()
export class TenantTransactionInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TenantTransactionInterceptor.name);

  constructor(
    @Inject(DATA_SOURCE_TOKEN) private readonly dataSource: DataSource,
    private readonly tenantContextService: TenantContextService,
    private readonly reflector: Reflector,
    private readonly dbTenantContext: DatabaseTenantContextService,
  ) {}

  intercept(executionContext: ExecutionContext, next: CallHandler): Observable<unknown> {
    const skip = this.reflector.getAllAndOverride<boolean | undefined>(
      SKIP_TENANT_TRANSACTION_KEY,
      [executionContext.getHandler(), executionContext.getClass()],
    );
    if (skip) {
      return next.handle();
    }

    const ctx = this.tenantContextService.getCurrentContext();
    if (!ctx) {
      return next.handle();
    }

    if (!ctx.tenantId && !ctx.isSuperAdmin) {
      return next.handle();
    }

    const startTime = process.hrtime.bigint();
    return from(this.runInTransaction(next, ctx)).pipe();
  }

  private async runInTransaction(
    next: CallHandler,
    ctx: ReturnType<TenantContextService['getCurrentContext']>,
  ): Promise<unknown> {
    if (!ctx) throw new Error('runInTransaction called without context');
    const start = process.hrtime.bigint();
    try {
      return await this.dataSource.transaction(async (em) => {
        await this.dbTenantContext.applySetLocal(em as unknown as QueryableEntityManager, ctx);
        return await lastValueFrom(next.handle());
      });
    } finally {
      const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
      this.logger.debug(
        `tenant_transaction_completed tenant=${ctx.tenantId ?? '-'} super_admin=${ctx.isSuperAdmin} duration_ms=${durationMs.toFixed(2)}`,
      );
    }
  }
}
