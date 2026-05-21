/**
 * AdminQuotasController -- routes super admin quotas/usage tenant.
 *
 * Routes /api/v1/admin/quotas/* :
 *   GET    /:tenantId                          @AnalystAllowed (read)
 *   PATCH  /:tenantId/override                 @SuperAdminWrite (set custom limit)
 *   DELETE /:tenantId/override/:resourceType   @SuperAdminWrite (clear override)
 *   GET    /near-limit                         @AnalystAllowed (alertes)
 *   GET    /:tenantId/usage-report             @AnalystAllowed (snapshot)
 *
 * Reference : Sprint 6 / Tache 2.2.11.
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
  Query,
} from '@nestjs/common';
import { AdminOnly } from '../../../common/decorators/admin-only.decorator.js';
import { AnalystAllowed } from '../../../common/decorators/analyst-allowed.decorator.js';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator.js';
import { SuperAdminOnly } from '../../../common/decorators/super-admin-only.decorator.js';
import { SuperAdminWrite } from '../../../common/decorators/super-admin-write.decorator.js';
import type { TenantContext } from '@insurtech/auth';
import {
  NearLimitFiltersSchema,
  SetQuotaOverrideSchema,
  type SetQuotaOverrideDto,
} from '../dto/quota.dto.js';
import { ResourceQuotaService } from '../services/resource-quota.service.js';
import type { ResourceType, TenantQuotaDto } from '../types/quota.type.js';

@Controller('api/v1/admin/quotas')
@AdminOnly()
@SuperAdminOnly()
export class AdminQuotasController {
  constructor(private readonly quotaService: ResourceQuotaService) {}

  @Get('near-limit')
  @AnalystAllowed()
  async nearLimit(@Query() query: unknown): Promise<TenantQuotaDto[]> {
    const filters = NearLimitFiltersSchema.parse(query);
    return this.quotaService.listQuotasNearLimit(filters.threshold);
  }

  @Get(':tenantId')
  @AnalystAllowed()
  async getQuota(
    @Param('tenantId', new ParseUUIDPipe({ version: '4' })) tenantId: string,
  ): Promise<TenantQuotaDto> {
    return this.quotaService.getQuotaForTenant(tenantId);
  }

  @Get(':tenantId/usage-report')
  @AnalystAllowed()
  async usageReport(
    @Param('tenantId', new ParseUUIDPipe({ version: '4' })) tenantId: string,
  ): Promise<TenantQuotaDto> {
    return this.quotaService.reportUsage(tenantId);
  }

  @Patch(':tenantId/override')
  @SuperAdminWrite()
  @HttpCode(HttpStatus.OK)
  async setOverride(
    @Param('tenantId', new ParseUUIDPipe({ version: '4' })) tenantId: string,
    @Body() body: unknown,
    @CurrentTenant() ctx: TenantContext | undefined,
  ): Promise<TenantQuotaDto> {
    const dto: SetQuotaOverrideDto = SetQuotaOverrideSchema.parse(body);
    return this.quotaService.setQuotaOverride(
      tenantId,
      dto.resourceType,
      dto.customLimit,
      dto.reason,
      ctx?.userId ?? 'unknown-admin',
    );
  }

  @Delete(':tenantId/override/:resourceType')
  @SuperAdminWrite()
  @HttpCode(HttpStatus.OK)
  async clearOverride(
    @Param('tenantId', new ParseUUIDPipe({ version: '4' })) tenantId: string,
    @Param('resourceType') resourceType: ResourceType,
    @CurrentTenant() ctx: TenantContext | undefined,
  ): Promise<TenantQuotaDto> {
    return this.quotaService.clearQuotaOverride(
      tenantId,
      resourceType,
      ctx?.userId ?? 'unknown-admin',
    );
  }
}
