/**
 * StagesController -- Sprint 8 Tache 8.3.
 *
 * Endpoints REST pour stages individuels (PATCH/DELETE par stageId direct).
 * Endpoints pipeline-scoped (POST nested, list, reorder) sont dans PipelinesController.
 *
 * Routes :
 *   GET    /api/v1/crm/stages/:stageId
 *   PATCH  /api/v1/crm/stages/:stageId
 *   DELETE /api/v1/crm/stages/:stageId
 *
 * Reference : B-08 Tache 3.1.3.
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
} from '@nestjs/common';
import { Permission, TenantContextService } from '@insurtech/auth';
import {
  UpdateStageSchema,
  type UpdateStageDto,
} from '@insurtech/crm';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator.js';
import { RequireTenant } from '../../../common/decorators/require-tenant.decorator.js';
import { StagesService } from '../services/stages.service.js';

@Controller('api/v1/crm/stages')
@RequireTenant()
export class StagesController {
  constructor(
    private readonly stages: StagesService,
    private readonly tenantContext: TenantContextService,
  ) {}

  @Get(':stageId')
  @RequirePermission(Permission.CRM_PIPELINES_MANAGE)
  async findOne(@Param('stageId', ParseUUIDPipe) stageId: string) {
    return this.stages.findOne(stageId);
  }

  @Patch(':stageId')
  @RequirePermission(Permission.CRM_PIPELINES_MANAGE)
  async update(@Param('stageId', ParseUUIDPipe) stageId: string, @Body() body: unknown) {
    const dto = UpdateStageSchema.parse(body) satisfies UpdateStageDto;
    const userId = this.tenantContext.getCurrentContext()?.userId ?? 'unknown';
    return this.stages.update(stageId, dto, userId);
  }

  @Delete(':stageId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission(Permission.CRM_PIPELINES_MANAGE)
  async remove(@Param('stageId', ParseUUIDPipe) stageId: string): Promise<void> {
    const userId = this.tenantContext.getCurrentContext()?.userId ?? 'unknown';
    await this.stages.delete(stageId, userId);
  }
}
