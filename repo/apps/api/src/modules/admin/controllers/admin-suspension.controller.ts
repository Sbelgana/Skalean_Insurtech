/**
 * AdminSuspensionController -- routes super admin suspend/reactivate.
 *
 * Routes :
 *   POST /api/v1/admin/tenants/:id/suspend    (body { reason, suspensionType })
 *   POST /api/v1/admin/tenants/:id/reactivate (body { reason })
 *   GET  /api/v1/admin/tenants/:id/suspension-details
 *   GET  /api/v1/admin/tenants-suspended      (list)
 *
 * @AdminOnly enforce isSuperAdmin via TenantContextGuard.
 *
 * Reference : Sprint 6 / Tache 2.2.9.
 */

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import type { TenantContext } from '@insurtech/auth';
import { AdminOnly } from '../../../common/decorators/admin-only.decorator.js';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator.js';
import {
  ReactivateTenantSchema,
  SuspendTenantSchema,
  type SuspendTenantDto,
} from '../dto/suspension.dto.js';
import { TenantSuspensionService } from '../services/tenant-suspension.service.js';
import type { SuspendedTenantDto } from '../types/suspension.type.js';

@Controller('api/v1/admin')
@AdminOnly()
export class AdminSuspensionController {
  constructor(private readonly suspension: TenantSuspensionService) {}

  @Post('tenants/:id/suspend')
  @HttpCode(HttpStatus.OK)
  async suspend(
    @Param('id', new ParseUUIDPipe({ version: '4' })) tenantId: string,
    @Body() body: unknown,
    @CurrentTenant() ctx: TenantContext | undefined,
  ): Promise<SuspendedTenantDto> {
    const dto: SuspendTenantDto = SuspendTenantSchema.parse(body);
    return this.suspension.suspend(tenantId, dto, ctx?.userId ?? 'unknown-admin');
  }

  @Post('tenants/:id/reactivate')
  @HttpCode(HttpStatus.OK)
  async reactivate(
    @Param('id', new ParseUUIDPipe({ version: '4' })) tenantId: string,
    @Body() body: unknown,
    @CurrentTenant() ctx: TenantContext | undefined,
  ): Promise<SuspendedTenantDto> {
    const dto = ReactivateTenantSchema.parse(body);
    return this.suspension.reactivate(tenantId, dto.reason, ctx?.userId ?? 'unknown-admin');
  }

  @Get('tenants/:id/suspension-details')
  async details(
    @Param('id', new ParseUUIDPipe({ version: '4' })) tenantId: string,
  ): Promise<SuspendedTenantDto> {
    return this.suspension.getSuspensionDetails(tenantId);
  }

  @Get('tenants-suspended')
  async listSuspended(): Promise<SuspendedTenantDto[]> {
    return this.suspension.listSuspended();
  }
}
