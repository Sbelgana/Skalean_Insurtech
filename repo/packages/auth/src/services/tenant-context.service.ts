/**
 * TenantContextService -- Source unique de verite runtime pour le contexte multi-tenant.
 *
 * Reference :
 *   - Sprint 6 / Tache 2.2.1 (B-06)
 *   - decision-002-multi-tenant-3-niveaux
 *
 * Pattern : AsyncLocalStorage natif Node.js 22 + service NestJS @Global().
 * Le service expose des helpers ergonomiques + l'instance brute pour interop subscribers TypeORM.
 *
 * Discipline :
 *   - Lecture : `getCurrentTenantId()` (permissif) ou `requireTenantId()` (force assertion).
 *   - Ecriture : UNIQUEMENT via `runWithContext()` ou `runWithUpdatedContext()`.
 *   - JAMAIS `tenantContextStorage.enterWith()` (casse l'isolation parent/child).
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import type { AuthRole } from '../types/auth-roles.js';
import type {
  TenantContext,
  TenantContextUpdate,
  TenantSettings,
} from '../types/tenant-context.type.js';

/**
 * Instance singleton AsyncLocalStorage pour le contexte multi-tenant.
 *
 * Exportee module-level pour permettre l'acces hors DI NestJS :
 *   - Subscribers TypeORM (Sprint 2 `tenant-id-injector.subscriber.ts`).
 *   - Logger Pino mixin (Sprint 1 `pino-logger.service.ts`).
 *   - Tests fixtures (mock contextes).
 *
 * NE PAS creer d'autre instance AsyncLocalStorage<TenantContext>.
 */
export const tenantContextStorage = new AsyncLocalStorage<TenantContext>();

/**
 * Codes d'erreur stables exportes pour mapping centralise + alerts Sentry.
 */
export const TENANT_CONTEXT_ERROR_CODES = {
  TENANT_CONTEXT_MISSING: 'TENANT_CONTEXT_MISSING',
  TENANT_ID_REQUIRED: 'TENANT_ID_REQUIRED',
  SUPER_ADMIN_REQUIRED: 'SUPER_ADMIN_REQUIRED',
  ASSURE_USER_ID_REQUIRED: 'ASSURE_USER_ID_REQUIRED',
  USER_ID_REQUIRED: 'USER_ID_REQUIRED',
} as const;

@Injectable()
export class TenantContextService {
  private readonly logger = new Logger(TenantContextService.name);

  // ===========================================================================
  // ECRITURE : run / runWithUpdatedContext
  // ===========================================================================

  /**
   * Execute `fn` dans un nouveau contexte tenant. Toutes les operations
   * synchrones et asynchrones (Promise, await, setTimeout, queueMicrotask)
   * declenchees par `fn` ont acces au contexte via `getCurrentContext()`.
   */
  runWithContext<T>(ctx: TenantContext, fn: () => T | Promise<T>): T | Promise<T> {
    return tenantContextStorage.run(ctx, fn);
  }

  /**
   * Execute `fn` avec un contexte derive du contexte courant en mergeant `updates`.
   *
   * @throws InternalServerErrorException si pas de contexte parent.
   */
  runWithUpdatedContext<T>(
    updates: TenantContextUpdate,
    fn: () => T | Promise<T>,
  ): T | Promise<T> {
    const current = this.getCurrentContext();
    if (!current) {
      throw new InternalServerErrorException({
        code: TENANT_CONTEXT_ERROR_CODES.TENANT_CONTEXT_MISSING,
        message:
          'runWithUpdatedContext requires an existing parent context. ' +
          'Use runWithContext() to install the initial context.',
      });
    }
    const merged: TenantContext = { ...current, ...updates };
    return tenantContextStorage.run(merged, fn);
  }

  // ===========================================================================
  // LECTURE : getCurrentContext + helpers permissifs
  // ===========================================================================

  /**
   * Retourne le contexte tenant courant ou `undefined` si aucun contexte actif.
   *
   * Usage permissif : laisser le caller decider quoi faire si pas de contexte.
   * Pour assertion stricte, utiliser `requireTenantId()` ou `requireSuperAdmin()`.
   */
  getCurrentContext(): TenantContext | undefined {
    return tenantContextStorage.getStore();
  }

  getCurrentTenantId(): string | undefined {
    return this.getCurrentContext()?.tenantId;
  }

  getCurrentUserId(): string | undefined {
    return this.getCurrentContext()?.userId;
  }

  getCurrentUserRole(): AuthRole | undefined {
    return this.getCurrentContext()?.userRole;
  }

  /**
   * `true` si l'utilisateur courant est super_admin_platform OR analyst_support.
   * `false` si pas de contexte (routes publiques considerees non-admin).
   */
  isSuperAdmin(): boolean {
    return this.getCurrentContext()?.isSuperAdmin ?? false;
  }

  getAssureUserId(): string | undefined {
    return this.getCurrentContext()?.assureUserId;
  }

  getCrossTenantAuthId(): string | undefined {
    return this.getCurrentContext()?.crossTenantAuthorizationId;
  }

  getTenantSettings(): TenantSettings | undefined {
    return this.getCurrentContext()?.tenantSettings;
  }

  getTraceId(): string | undefined {
    return this.getCurrentContext()?.traceId;
  }

  // ===========================================================================
  // LECTURE STRICTE : require* (throw si manquant)
  // ===========================================================================

  /**
   * Retourne `tenantId` non-undefined.
   *
   * @throws InternalServerErrorException avec code `TENANT_CONTEXT_MISSING`
   */
  requireTenantId(): string {
    const tenantId = this.getCurrentTenantId();
    if (!tenantId) {
      this.logger.error(
        `${TENANT_CONTEXT_ERROR_CODES.TENANT_CONTEXT_MISSING} in requireTenantId()`,
      );
      throw new InternalServerErrorException({
        code: TENANT_CONTEXT_ERROR_CODES.TENANT_CONTEXT_MISSING,
        message:
          'Operation requires a tenant context. ' +
          'Ensure middleware ran or wrap call in tenantContextService.runWithContext().',
      });
    }
    return tenantId;
  }

  /**
   * Throw si l'utilisateur courant n'est PAS super admin.
   *
   * @throws ForbiddenException avec code `SUPER_ADMIN_REQUIRED`
   */
  requireSuperAdmin(): void {
    if (!this.isSuperAdmin()) {
      throw new ForbiddenException({
        code: TENANT_CONTEXT_ERROR_CODES.SUPER_ADMIN_REQUIRED,
        message: 'Operation requires super admin privileges',
      });
    }
  }

  /**
   * Retourne `userId` non-undefined.
   *
   * @throws InternalServerErrorException si pas d'utilisateur authentifie.
   */
  requireUserId(): string {
    const userId = this.getCurrentUserId();
    if (!userId) {
      throw new InternalServerErrorException({
        code: TENANT_CONTEXT_ERROR_CODES.USER_ID_REQUIRED,
        message: 'Operation requires authenticated user',
      });
    }
    return userId;
  }

  /**
   * Retourne `assureUserId` non-undefined.
   *
   * @throws ForbiddenException si pas un contexte assure.
   */
  requireAssureUserId(): string {
    const assureUserId = this.getAssureUserId();
    if (!assureUserId) {
      throw new ForbiddenException({
        code: TENANT_CONTEXT_ERROR_CODES.ASSURE_USER_ID_REQUIRED,
        message: 'Operation requires assure context (route /api/v1/assure/*)',
      });
    }
    return assureUserId;
  }

  // ===========================================================================
  // OBSERVABILITY : enrichissement logs
  // ===========================================================================

  /**
   * Retourne les champs du contexte a inclure dans chaque log entry.
   * Utilise par Pino mixin (Sprint 1 `pino-logger.service.ts`).
   */
  getLogContext(): Record<string, string | boolean | undefined> {
    const ctx = this.getCurrentContext();
    if (!ctx) return {};
    return {
      tenant_id: ctx.tenantId,
      user_id: ctx.userId,
      user_role: ctx.userRole,
      is_super_admin: ctx.isSuperAdmin,
      assure_user_id: ctx.assureUserId,
      cross_tenant_auth_id: ctx.crossTenantAuthorizationId,
      trace_id: ctx.traceId,
      correlation_id: ctx.correlationId,
    };
  }
}
