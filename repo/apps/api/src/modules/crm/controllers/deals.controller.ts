/**
 * DealsController -- Sprint 8 Tache 8.4.
 *
 * Endpoints REST CRUD + state machine workflow (move-stage / close-won /
 * close-lost / reopen) pour CRM deals.
 *
 * Permissions :
 *   - GET endpoints -> CRM_DEALS_READ
 *   - POST create -> CRM_DEALS_CREATE
 *   - PATCH update -> CRM_DEALS_UPDATE
 *   - POST move-stage -> CRM_DEALS_UPDATE (backward direction handled
 *     service-side via CRM_DEALS_OVERRIDE_WORKFLOW)
 *   - POST close-won / close-lost -> CRM_DEALS_CLOSE
 *   - POST reopen -> CRM_DEALS_OVERRIDE_WORKFLOW
 *   - DELETE -> CRM_DEALS_DELETE
 *
 * Routes :
 *   POST   /api/v1/crm/deals
 *   GET    /api/v1/crm/deals
 *   GET    /api/v1/crm/deals/:id
 *   PATCH  /api/v1/crm/deals/:id
 *   POST   /api/v1/crm/deals/:id/move-stage
 *   POST   /api/v1/crm/deals/:id/close-won
 *   POST   /api/v1/crm/deals/:id/close-lost
 *   POST   /api/v1/crm/deals/:id/reopen
 *   DELETE /api/v1/crm/deals/:id
 *
 * Reference : B-08 Tache 3.1.4.
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
  CloseDealSchema,
  CreateDealSchema,
  DealFiltersSchema,
  MoveToStageSchema,
  ReopenDealSchema,
  UpdateDealSchema,
  type CloseDealDto,
  type CreateDealDto,
  type DealFiltersDto,
  type MoveToStageDto,
  type ReopenDealDto,
  type UpdateDealDto,
} from '@insurtech/crm';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator.js';
import { RequireTenant } from '../../../common/decorators/require-tenant.decorator.js';
import { DealsService } from '../services/deals.service.js';

@Controller('api/v1/crm/deals')
@RequireTenant()
export class DealsController {
  constructor(
    private readonly deals: DealsService,
    private readonly tenantContext: TenantContextService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission(Permission.CRM_DEALS_CREATE)
  async create(@Body() body: unknown) {
    const dto = CreateDealSchema.parse(body) satisfies CreateDealDto;
    const userId = this.tenantContext.getCurrentContext()?.userId ?? 'unknown';
    return this.deals.create(dto, userId);
  }

  @Get()
  @RequirePermission(Permission.CRM_DEALS_READ)
  async list(@Query() query: unknown) {
    const filters = DealFiltersSchema.parse(query) satisfies DealFiltersDto;
    return this.deals.list(filters);
  }

  @Get(':id')
  @RequirePermission(Permission.CRM_DEALS_READ)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.deals.findOne(id);
  }

  @Patch(':id')
  @RequirePermission(Permission.CRM_DEALS_UPDATE)
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    const dto = UpdateDealSchema.parse(body) satisfies UpdateDealDto;
    const userId = this.tenantContext.getCurrentContext()?.userId ?? 'unknown';
    return this.deals.update(id, dto, userId);
  }

  @Post(':id/move-stage')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(Permission.CRM_DEALS_UPDATE)
  async moveStage(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    const dto = MoveToStageSchema.parse(body) satisfies MoveToStageDto;
    const userId = this.tenantContext.getCurrentContext()?.userId ?? 'unknown';
    return this.deals.moveToStage(id, dto, userId);
  }

  @Post(':id/close-won')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(Permission.CRM_DEALS_CLOSE)
  async closeWon(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    const dto = CloseDealSchema.parse(body) satisfies CloseDealDto;
    const userId = this.tenantContext.getCurrentContext()?.userId ?? 'unknown';
    return this.deals.closeWon(id, dto, userId);
  }

  @Post(':id/close-lost')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(Permission.CRM_DEALS_CLOSE)
  async closeLost(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    const dto = CloseDealSchema.parse(body) satisfies CloseDealDto;
    const userId = this.tenantContext.getCurrentContext()?.userId ?? 'unknown';
    return this.deals.closeLost(id, dto, userId);
  }

  @Post(':id/reopen')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(Permission.CRM_DEALS_OVERRIDE_WORKFLOW)
  async reopen(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    const dto = ReopenDealSchema.parse(body) satisfies ReopenDealDto;
    const userId = this.tenantContext.getCurrentContext()?.userId ?? 'unknown';
    return this.deals.reopen(id, dto, userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission(Permission.CRM_DEALS_DELETE)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    const userId = this.tenantContext.getCurrentContext()?.userId ?? 'unknown';
    await this.deals.softDelete(id, userId);
  }
}
