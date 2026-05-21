// TenantManagementService -- CRUD super admin pour tenants.
//
// Securite : appele uniquement depuis controllers /api/v1/admin/* avec
// @AdminOnly() decorator (Tache 2.2.3) + TenantContextGuard verifie isSuperAdmin.
//
// Reference : Sprint 6 / Tache 2.2.7.

import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { TenantSettings } from '@insurtech/auth';
import { AuthTenant, type DataSource } from '@insurtech/database';
import { DATA_SOURCE_TOKEN } from '../../../database/data-source.provider.js';
import { TenantAccessCacheService } from '../../tenant/services/tenant-access-cache.service.js';
import type {
  CreateTenantDto,
  TenantFiltersDto,
  UpdateTenantDto,
} from '../dto/tenant.dto.js';
import {
  TENANT_MANAGEMENT_ERROR_CODES,
  type PaginatedResult,
  type TenantManagementDto,
} from '../types/tenant-management.type.js';
import { mergeTenantSettings } from '../utils/merge-tenant-settings.js';

const DEFAULT_SETTINGS: TenantSettings = {
  locale: 'fr',
  timezone: 'Africa/Casablanca',
  currency: 'MAD',
  branding: { primaryColor: '#E95D2C', logoUrl: null },
  features: { mfaRequiredForAdmin: true, sinistreAutoAssign: false },
  quotas: { maxUsers: 10, maxPolices: 1000, maxStorageGb: 50 },
  tenantType: 'broker',
};

@Injectable()
export class TenantManagementService {
  private readonly logger = new Logger(TenantManagementService.name);

  constructor(
    @Inject(DATA_SOURCE_TOKEN) private readonly dataSource: DataSource,
    private readonly cache: TenantAccessCacheService,
  ) {}

  // ===========================================================================
  // CREATE
  // ===========================================================================

  async create(dto: CreateTenantDto, adminUserId: string): Promise<TenantManagementDto> {
    const repo = this.dataSource.getRepository(AuthTenant);

    const existing = await repo.findOne({ where: { name: dto.name } });
    if (existing && !existing.deletedAt) {
      throw new ConflictException({
        code: TENANT_MANAGEMENT_ERROR_CODES.TENANT_NAME_CONFLICT,
        message: `Tenant with name '${dto.name}' already exists`,
      });
    }

    const settings: TenantSettings = mergeTenantSettings(
      { ...DEFAULT_SETTINGS, tenantType: dto.type },
      (dto.settings ?? {}) as Partial<TenantSettings>,
    );

    const entity = repo.create({
      name: dto.name,
      type: dto.type,
      settings: settings as unknown as Record<string, unknown>,
    });
    const saved = await repo.save(entity);

    this.logger.log(
      `tenant_created id=${saved.id} name=${saved.name} type=${saved.type} by=${adminUserId}`,
    );

    await this.cache.invalidateAllForTenant(saved.id);
    return this.toDto(saved, settings);
  }

  // ===========================================================================
  // UPDATE
  // ===========================================================================

  async update(
    tenantId: string,
    dto: UpdateTenantDto,
    adminUserId: string,
  ): Promise<TenantManagementDto> {
    const repo = this.dataSource.getRepository(AuthTenant);
    const tenant = await repo.findOne({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException({
        code: TENANT_MANAGEMENT_ERROR_CODES.TENANT_NOT_FOUND,
        message: `Tenant '${tenantId}' not found`,
      });
    }
    if (tenant.deletedAt !== null) {
      throw new BadRequestException({
        code: TENANT_MANAGEMENT_ERROR_CODES.TENANT_ALREADY_ARCHIVED,
        message: `Tenant '${tenantId}' is archived. Restore first.`,
      });
    }

    if (dto.name !== undefined && dto.name !== tenant.name) {
      const existing = await repo.findOne({ where: { name: dto.name } });
      if (existing && existing.id !== tenantId && !existing.deletedAt) {
        throw new ConflictException({
          code: TENANT_MANAGEMENT_ERROR_CODES.TENANT_NAME_CONFLICT,
          message: `Tenant with name '${dto.name}' already exists`,
        });
      }
      tenant.name = dto.name;
    }

    let settings = (tenant.settings as unknown as TenantSettings) ?? DEFAULT_SETTINGS;
    if (dto.settings) {
      settings = mergeTenantSettings(settings, dto.settings as Partial<TenantSettings>);
      tenant.settings = settings as unknown as Record<string, unknown>;
    }

    const saved = await repo.save(tenant);

    this.logger.log(`tenant_updated id=${saved.id} by=${adminUserId}`);

    await this.cache.invalidateAllForTenant(saved.id);
    return this.toDto(saved, settings);
  }

  // ===========================================================================
  // ARCHIVE (soft delete)
  // ===========================================================================

  async archive(tenantId: string, reason: string, adminUserId: string): Promise<void> {
    const repo = this.dataSource.getRepository(AuthTenant);
    const tenant = await repo.findOne({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException({
        code: TENANT_MANAGEMENT_ERROR_CODES.TENANT_NOT_FOUND,
        message: `Tenant '${tenantId}' not found`,
      });
    }
    if (tenant.deletedAt !== null) {
      throw new ConflictException({
        code: TENANT_MANAGEMENT_ERROR_CODES.TENANT_ALREADY_ARCHIVED,
        message: `Tenant '${tenantId}' already archived`,
      });
    }

    tenant.deletedAt = new Date();
    await repo.save(tenant);

    this.logger.warn(
      `tenant_archived id=${tenantId} by=${adminUserId} reason=${reason}`,
    );

    await this.cache.invalidateAllForTenant(tenantId);
  }

  // ===========================================================================
  // RESTORE
  // ===========================================================================

  async restore(tenantId: string, adminUserId: string): Promise<TenantManagementDto> {
    const repo = this.dataSource.getRepository(AuthTenant);
    const tenant = await repo.findOne({ where: { id: tenantId }, withDeleted: true });
    if (!tenant) {
      throw new NotFoundException({
        code: TENANT_MANAGEMENT_ERROR_CODES.TENANT_NOT_FOUND,
        message: `Tenant '${tenantId}' not found`,
      });
    }
    if (tenant.deletedAt === null) {
      throw new BadRequestException({
        code: TENANT_MANAGEMENT_ERROR_CODES.TENANT_NOT_ARCHIVED,
        message: `Tenant '${tenantId}' is not archived`,
      });
    }

    tenant.deletedAt = null;
    const saved = await repo.save(tenant);

    this.logger.log(`tenant_restored id=${tenantId} by=${adminUserId}`);

    await this.cache.invalidateAllForTenant(tenantId);
    const settings = (saved.settings as unknown as TenantSettings) ?? DEFAULT_SETTINGS;
    return this.toDto(saved, settings);
  }

  // ===========================================================================
  // GET / LIST / SEARCH
  // ===========================================================================

  async findById(tenantId: string): Promise<TenantManagementDto> {
    const repo = this.dataSource.getRepository(AuthTenant);
    const tenant = await repo.findOne({ where: { id: tenantId }, withDeleted: true });
    if (!tenant) {
      throw new NotFoundException({
        code: TENANT_MANAGEMENT_ERROR_CODES.TENANT_NOT_FOUND,
        message: `Tenant '${tenantId}' not found`,
      });
    }
    const settings = (tenant.settings as unknown as TenantSettings) ?? DEFAULT_SETTINGS;
    return this.toDto(tenant, settings);
  }

  async list(filters: TenantFiltersDto): Promise<PaginatedResult<TenantManagementDto>> {
    const repo = this.dataSource.getRepository(AuthTenant);

    const qb = repo
      .createQueryBuilder('t')
      .withDeleted()
      .orderBy('t.created_at', 'DESC')
      .offset((filters.page - 1) * filters.pageSize)
      .limit(filters.pageSize);

    if (filters.type) qb.andWhere('t.type = :type', { type: filters.type });
    if (filters.status === 'active') qb.andWhere('t.deleted_at IS NULL');
    if (filters.status === 'archived') qb.andWhere('t.deleted_at IS NOT NULL');
    if (filters.search) {
      qb.andWhere('t.name ILIKE :s', { s: `%${filters.search}%` });
    }
    if (filters.createdAfter) {
      qb.andWhere('t.created_at >= :after', { after: filters.createdAfter });
    }
    if (filters.createdBefore) {
      qb.andWhere('t.created_at <= :before', { before: filters.createdBefore });
    }

    const [rows, total] = await qb.getManyAndCount();
    const items = rows.map((r) => {
      const settings = (r.settings as unknown as TenantSettings) ?? DEFAULT_SETTINGS;
      return this.toDto(r, settings);
    });

    return {
      items,
      total,
      page: filters.page,
      pageSize: filters.pageSize,
      totalPages: Math.ceil(total / filters.pageSize),
    };
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  private toDto(t: AuthTenant, settings: TenantSettings): TenantManagementDto {
    return {
      id: t.id,
      name: t.name,
      type: t.type,
      status: t.deletedAt ? 'archived' : 'active',
      settings,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      ...(t.deletedAt ? { deletedAt: t.deletedAt } : {}),
    };
  }
}
