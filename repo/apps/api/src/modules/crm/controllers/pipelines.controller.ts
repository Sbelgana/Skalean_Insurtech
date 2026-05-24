/**
 * PipelinesController -- Sprint 8 Tache 8.3.
 *
 * Endpoints REST pour CRM pipelines + nested stage routes.
 *
 * Protection :
 *   - @RequireTenant : ctx.tenantId non-null (Sprint 6)
 *   - @RequirePermission(CRM_PIPELINES_MANAGE) : permission unique catalog v3.0
 *
 * Routes :
 *   GET    /api/v1/crm/pipelines
 *   GET    /api/v1/crm/pipelines/:id                        (avec stages tries position)
 *   POST   /api/v1/crm/pipelines                            (optional cascade stages)
 *   PATCH  /api/v1/crm/pipelines/:id
 *   POST   /api/v1/crm/pipelines/:id/set-default
 *   DELETE /api/v1/crm/pipelines/:id
 *   POST   /api/v1/crm/pipelines/:pipelineId/stages         (delegue StagesService)
 *   GET    /api/v1/crm/pipelines/:pipelineId/stages         (delegue StagesService)
 *   POST   /api/v1/crm/pipelines/:pipelineId/reorder-stages (delegue StagesService)
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
  Post,
  Query,
} from '@nestjs/common';
import { Permission, TenantContextService } from '@insurtech/auth';
import {
  CreatePipelineSchema,
  CreateStageSchema,
  PipelineFiltersSchema,
  ReorderStagesSchema,
  UpdatePipelineSchema,
  type CreatePipelineDto,
  type CreateStageDto,
  type PipelineFiltersDto,
  type ReorderStagesDto,
  type UpdatePipelineDto,
} from '@insurtech/crm';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator.js';
import { RequireTenant } from '../../../common/decorators/require-tenant.decorator.js';
import { PipelinesService } from '../services/pipelines.service.js';
import { StagesService } from '../services/stages.service.js';

@Controller('api/v1/crm/pipelines')
@RequireTenant()
export class PipelinesController {
  constructor(
    private readonly pipelines: PipelinesService,
    private readonly stages: StagesService,
    private readonly tenantContext: TenantContextService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission(Permission.CRM_PIPELINES_MANAGE)
  async create(@Body() body: unknown) {
    const dto = CreatePipelineSchema.parse(body) satisfies CreatePipelineDto;
    const userId = this.tenantContext.getCurrentContext()?.userId ?? 'unknown';
    return this.pipelines.create(dto, userId);
  }

  @Get()
  @RequirePermission(Permission.CRM_PIPELINES_MANAGE)
  async list(@Query() query: unknown) {
    const filters = PipelineFiltersSchema.parse(query) satisfies PipelineFiltersDto;
    return this.pipelines.list(filters);
  }

  @Get(':id')
  @RequirePermission(Permission.CRM_PIPELINES_MANAGE)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.pipelines.findOne(id);
  }

  @Patch(':id')
  @RequirePermission(Permission.CRM_PIPELINES_MANAGE)
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    const dto = UpdatePipelineSchema.parse(body) satisfies UpdatePipelineDto;
    const userId = this.tenantContext.getCurrentContext()?.userId ?? 'unknown';
    return this.pipelines.update(id, dto, userId);
  }

  @Post(':id/set-default')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(Permission.CRM_PIPELINES_MANAGE)
  async setDefault(@Param('id', ParseUUIDPipe) id: string) {
    const userId = this.tenantContext.getCurrentContext()?.userId ?? 'unknown';
    return this.pipelines.setDefault(id, userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission(Permission.CRM_PIPELINES_MANAGE)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    const userId = this.tenantContext.getCurrentContext()?.userId ?? 'unknown';
    await this.pipelines.delete(id, userId);
  }

  // -------------------------------------------------------------------------
  // Nested stages routes (delegated to StagesService)
  // -------------------------------------------------------------------------

  @Get(':pipelineId/stages')
  @RequirePermission(Permission.CRM_PIPELINES_MANAGE)
  async listStages(@Param('pipelineId', ParseUUIDPipe) pipelineId: string) {
    return this.stages.findByPipeline(pipelineId);
  }

  @Post(':pipelineId/stages')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission(Permission.CRM_PIPELINES_MANAGE)
  async createStage(
    @Param('pipelineId', ParseUUIDPipe) pipelineId: string,
    @Body() body: unknown,
  ) {
    const dto = CreateStageSchema.parse(body) satisfies CreateStageDto;
    const userId = this.tenantContext.getCurrentContext()?.userId ?? 'unknown';
    return this.stages.create(pipelineId, dto, userId);
  }

  @Post(':pipelineId/reorder-stages')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(Permission.CRM_PIPELINES_MANAGE)
  async reorderStages(
    @Param('pipelineId', ParseUUIDPipe) pipelineId: string,
    @Body() body: unknown,
  ) {
    const dto = ReorderStagesSchema.parse(body) satisfies ReorderStagesDto;
    const userId = this.tenantContext.getCurrentContext()?.userId ?? 'unknown';
    return this.stages.reorder(pipelineId, dto, userId);
  }
}
