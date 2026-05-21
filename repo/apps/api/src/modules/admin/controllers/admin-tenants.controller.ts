/**
 * AdminTenantsController -- CRUD super admin pour tenants.
 *
 * Toutes les routes /api/v1/admin/tenants/* :
 *   - @AdminOnly() decorator (Tache 2.2.3) -> TenantContextGuard enforce isSuperAdmin
 *   - TenantTransactionInterceptor (Tache 2.2.4) injecte set_config app.is_super_admin='true'
 *   - Helper Postgres app_can_access_tenant() Cond 1 -> bypass RLS automatique
 *
 * Reference : Sprint 6 / Tache 2.2.7.
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { AdminOnly } from '../../../common/decorators/admin-only.decorator.js';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator.js';
import type { TenantContext } from '@insurtech/auth';
import {
  ArchiveTenantSchema,
  type ArchiveTenantDto,
  CreateTenantSchema,
  type CreateTenantDto,
  TenantFiltersSchema,
  type TenantFiltersDto,
  UpdateTenantSchema,
  type UpdateTenantDto,
} from '../dto/tenant.dto.js';
import { TenantManagementService } from '../services/tenant-management.service.js';
import type {
  PaginatedResult,
  TenantManagementDto,
} from '../types/tenant-management.type.js';

@Controller('api/v1/admin/tenants')
@AdminOnly()
export class AdminTenantsController {
  constructor(private readonly tenantManagement: TenantManagementService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() body: unknown,
    @CurrentTenant() ctx: TenantContext | undefined,
  ): Promise<TenantManagementDto> {
    const dto: CreateTenantDto = CreateTenantSchema.parse(body);
    const adminUserId = ctx?.userId ?? 'unknown-admin';
    return this.tenantManagement.create(dto, adminUserId);
  }

  @Get()
  async list(
    @Query() query: unknown,
  ): Promise<PaginatedResult<TenantManagementDto>> {
    const filters: TenantFiltersDto = TenantFiltersSchema.parse(query);
    return this.tenantManagement.list(filters);
  }

  @Get(':id')
  async findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<TenantManagementDto> {
    return this.tenantManagement.findById(id);
  }

  @Patch(':id')
  async update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
    @CurrentTenant() ctx: TenantContext | undefined,
  ): Promise<TenantManagementDto> {
    const dto: UpdateTenantDto = UpdateTenantSchema.parse(body);
    const adminUserId = ctx?.userId ?? 'unknown-admin';
    return this.tenantManagement.update(id, dto, adminUserId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async archive(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
    @CurrentTenant() ctx: TenantContext | undefined,
  ): Promise<void> {
    const dto: ArchiveTenantDto = ArchiveTenantSchema.parse(body);
    const adminUserId = ctx?.userId ?? 'unknown-admin';
    await this.tenantManagement.archive(id, dto.reason, adminUserId);
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  async restore(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentTenant() ctx: TenantContext | undefined,
  ): Promise<TenantManagementDto> {
    const adminUserId = ctx?.userId ?? 'unknown-admin';
    return this.tenantManagement.restore(id, adminUserId);
  }
}
