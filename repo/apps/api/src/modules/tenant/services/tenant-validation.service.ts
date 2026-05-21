// TenantValidationService -- Source autoritative validations metier tenant.
//
// Couche metier au-dessus de TenantAccessCacheService (cache Redis 5min Tache 2.2.2).
// Stateless. Expose helpers permissifs et stricts (require throw).
//
// Defense in depth (Sprint 6 contracts) :
//   JAMAIS retourner true sur exception DB (fail-closed).
//   Cache MISS -> DB fallback automatique via TenantAccessCacheService.
//   Codes erreur stables exportes (TENANT_VALIDATION_ERROR_CODES).
//
// Reference :
//   Sprint 6 / Tache 2.2.5
//   Approche B super_admin : set_config + RLS clause OR app_is_super_admin
//   Tache 2.2.6 RLS migration ajoutera la clause systematiquement.
//   decision-002 multi-tenant + decision-006 no-emoji

import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { TenantSettings } from '@insurtech/auth';
import { AuthTenant, AuthTenantUser } from '@insurtech/database';
import type { DataSource } from '@insurtech/database';
import { DATA_SOURCE_TOKEN } from '../../../database/data-source.provider.js';
import {
  TENANT_VALIDATION_ERROR_CODES,
  type MultiTenantUserResult,
  type TenantDto,
  type UserAccessResult,
} from '../types/tenant-validation.type.js';
import { TenantAccessCacheService } from './tenant-access-cache.service.js';

@Injectable()
export class TenantValidationService {
  private readonly logger = new Logger(TenantValidationService.name);

  constructor(
    @Inject(DATA_SOURCE_TOKEN) private readonly dataSource: DataSource,
    private readonly cache: TenantAccessCacheService,
  ) {}

  // ===========================================================================
  // EXISTENCE
  // ===========================================================================

  /**
   * Verifie l'existence du tenant (non-deleted). Cache 5min.
   */
  async tenantExists(tenantId: string): Promise<boolean> {
    try {
      return await this.cache.getTenantExists(tenantId);
    } catch (err) {
      this.logger.warn(
        `tenant_exists_check_failed tenant=${tenantId} error=${(err as Error).message}`,
      );
      return false; // fail-closed
    }
  }

  /**
   * Retourne tenant DTO ou null. Cache settings via TenantAccessCacheService.
   *
   * Sprint 6 : `status` derive de deletedAt IS NULL.
   * Tache 2.2.9 ajoutera colonne status (suspended/archived/pending_setup).
   */
  async getTenantById(tenantId: string): Promise<TenantDto | null> {
    try {
      const repo = this.dataSource.getRepository(AuthTenant);
      const tenant = await repo.findOne({ where: { id: tenantId }, withDeleted: true });
      if (!tenant) return null;

      const settings = await this.cache.getTenantSettings(tenantId);
      if (!settings) return null;

      return {
        id: tenant.id,
        name: tenant.name,
        type: tenant.type,
        status: tenant.deletedAt ? 'archived' : 'active',
        settings,
        createdAt: tenant.createdAt,
        updatedAt: tenant.updatedAt,
        ...(tenant.deletedAt ? { deletedAt: tenant.deletedAt } : {}),
      };
    } catch (err) {
      this.logger.warn(
        `get_tenant_by_id_failed tenant=${tenantId} error=${(err as Error).message}`,
      );
      return null;
    }
  }

  /**
   * @throws NotFoundException si tenant inexistant ou archive.
   */
  async requireExistingTenant(tenantId: string): Promise<TenantDto> {
    const tenant = await this.getTenantById(tenantId);
    if (!tenant) {
      throw new NotFoundException({
        code: TENANT_VALIDATION_ERROR_CODES.TENANT_NOT_FOUND,
        message: `Tenant '${tenantId}' does not exist`,
      });
    }
    return tenant;
  }

  /**
   * @throws NotFoundException si tenant inexistant.
   * @throws ForbiddenException si tenant archive (status != 'active').
   *
   * Sprint 6 : seul `archived` declenche le ForbiddenException (deletedAt set).
   * Tache 2.2.9 ajoutera suspended/pending_setup.
   */
  async requireActiveTenant(tenantId: string): Promise<TenantDto> {
    const tenant = await this.requireExistingTenant(tenantId);
    if (tenant.status === 'archived') {
      throw new ForbiddenException({
        code: TENANT_VALIDATION_ERROR_CODES.TENANT_ARCHIVED,
        message: 'Tenant has been archived',
      });
    }
    return tenant;
  }

  // ===========================================================================
  // USER ACCESS
  // ===========================================================================

  /**
   * Verifie l'acces user au tenant via auth_tenant_users.
   *
   * Sprint 6 : role transverse (super_admin_platform/analyst_support) detecte
   * en amont par TenantContextMiddleware (Tache 2.2.2) via JWT.role + bypass.
   * Ce service traite UNIQUEMENT le cas user standard.
   *
   * Cache 5min via TenantAccessCacheService.
   */
  async userCanAccessTenant(userId: string, tenantId: string): Promise<UserAccessResult> {
    try {
      const exists = await this.cache.getTenantExists(tenantId);
      if (!exists) {
        return { allowed: false, reason: 'TENANT_NOT_FOUND' };
      }
      const cacheResult = await this.cache.getUserAccess(userId, tenantId);
      if (cacheResult.allowed) {
        const role = await this.fetchUserRole(userId, tenantId);
        return role ? { allowed: true, role } : { allowed: true };
      }
      return cacheResult as UserAccessResult;
    } catch (err) {
      this.logger.warn(
        `user_can_access_tenant_failed user=${userId} tenant=${tenantId} error=${(err as Error).message}`,
      );
      return { allowed: false, reason: 'TENANT_NOT_FOUND' };
    }
  }

  /**
   * @throws NotFoundException si tenant inexistant.
   * @throws ForbiddenException si user n'a pas acces au tenant.
   */
  async requireUserAccess(userId: string, tenantId: string): Promise<UserAccessResult> {
    const result = await this.userCanAccessTenant(userId, tenantId);
    if (!result.allowed) {
      if (result.reason === 'TENANT_NOT_FOUND') {
        throw new NotFoundException({
          code: TENANT_VALIDATION_ERROR_CODES.TENANT_NOT_FOUND,
          message: `Tenant '${tenantId}' does not exist`,
        });
      }
      throw new ForbiddenException({
        code: TENANT_VALIDATION_ERROR_CODES.USER_NOT_LINKED_TO_TENANT,
        message: 'User does not have access to the requested tenant',
        ...(result.reason ? { reason: result.reason } : {}),
      });
    }
    return result;
  }

  private async fetchUserRole(userId: string, tenantId: string): Promise<string | undefined> {
    try {
      const repo = this.dataSource.getRepository(AuthTenantUser);
      const row = await repo.findOne({ where: { tenantId, userId } });
      return row?.role ?? undefined;
    } catch (err) {
      this.logger.debug(
        `fetch_user_role_failed user=${userId} tenant=${tenantId} error=${(err as Error).message}`,
      );
      return undefined;
    }
  }

  // ===========================================================================
  // SETTINGS
  // ===========================================================================

  /**
   * Retourne TenantSettings cachees ou null. Defaults Maroc via Zod.
   */
  async getTenantSettings(tenantId: string): Promise<TenantSettings | null> {
    try {
      return await this.cache.getTenantSettings(tenantId);
    } catch (err) {
      this.logger.warn(
        `get_tenant_settings_failed tenant=${tenantId} error=${(err as Error).message}`,
      );
      return null;
    }
  }

  // ===========================================================================
  // MULTI-TENANT USER
  // ===========================================================================

  /**
   * Liste paginee des tenants accessibles a un user.
   * Sprint 6 : pas de filtre status (deletedAt seulement). Tache 2.2.9 enrichira.
   */
  async getMultiTenantsForUser(
    userId: string,
    page = 1,
    pageSize = 50,
  ): Promise<MultiTenantUserResult> {
    const skip = (page - 1) * pageSize;
    const repo = this.dataSource.getRepository(AuthTenantUser);

    const qb = repo
      .createQueryBuilder('tu')
      .innerJoin(AuthTenant, 'tenant', 'tenant.id = tu.tenant_id AND tenant.deleted_at IS NULL')
      .where('tu.user_id = :userId', { userId })
      .select([
        'tenant.id AS id',
        'tenant.name AS name',
        'tenant.type AS type',
        'tu.role AS role',
      ])
      .orderBy('tenant.name', 'ASC')
      .offset(skip)
      .limit(pageSize);

    const [rows, total] = await Promise.all([
      qb.getRawMany<{ id: string; name: string; type: 'broker' | 'garage' | 'mixed'; role: string }>(),
      repo
        .createQueryBuilder('tu')
        .innerJoin(AuthTenant, 'tenant', 'tenant.id = tu.tenant_id AND tenant.deleted_at IS NULL')
        .where('tu.user_id = :userId', { userId })
        .getCount(),
    ]);

    return {
      tenants: rows.map((r) => ({ id: r.id, name: r.name, type: r.type, role: r.role })),
      total,
      page,
      pageSize,
    };
  }
}
