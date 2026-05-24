/**
 * InteractionsController -- Sprint 8 Tache 8.5.
 *
 * Endpoints REST pour CRM interactions polymorphes + timeline cross-entity.
 *
 * Mutability model (Hybrid Sprint 8.5) :
 *   - POST /interactions          : create (CRM_INTERACTIONS_CREATE)
 *   - GET endpoints               : read (CRM_INTERACTIONS_READ)
 *   - POST /:id/annotate          : annotation pattern (CRM_INTERACTIONS_CREATE)
 *   - DELETE /:id                 : soft-delete via SECURITY DEFINER func (CRM_INTERACTIONS_SOFT_DELETE)
 *   - POST /:id/restore           : restore via SECURITY DEFINER func (CRM_INTERACTIONS_RESTORE)
 *
 * Timeline endpoints (cross-entity aggregation) :
 *   - GET /api/v1/crm/companies/:id/timeline (delegue InteractionsService)
 *   - GET /api/v1/crm/contacts/:id/timeline
 *   - GET /api/v1/crm/deals/:id/timeline
 *
 * NO PATCH endpoint : Sprint 2 append-only triggers + Hybrid 8.5 immutability.
 * NO DELETE hard endpoint : RGPD anonymisation deferred Sprint 12 books-compliance.
 *
 * Reference : B-08 Tache 3.1.5.
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
  Post,
  Query,
} from '@nestjs/common';
import { Permission, TenantContextService } from '@insurtech/auth';
import {
  AnnotateInteractionSchema,
  CreateInteractionSchema,
  FilterInteractionsSchema,
  TimelineQuerySchema,
  type AnnotateInteractionDto,
  type CreateInteractionDto,
  type FilterInteractionsDto,
  type TimelineQueryDto,
} from '@insurtech/crm';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator.js';
import { RequireTenant } from '../../../common/decorators/require-tenant.decorator.js';
import { InteractionsService } from '../services/interactions.service.js';

@Controller('api/v1/crm/interactions')
@RequireTenant()
export class InteractionsController {
  constructor(
    private readonly interactions: InteractionsService,
    private readonly tenantContext: TenantContextService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission(Permission.CRM_INTERACTIONS_CREATE)
  async create(@Body() body: unknown) {
    const dto = CreateInteractionSchema.parse(body) satisfies CreateInteractionDto;
    const userId = this.tenantContext.getCurrentContext()?.userId ?? 'unknown';
    return this.interactions.create(dto, userId);
  }

  @Get()
  @RequirePermission(Permission.CRM_INTERACTIONS_READ)
  async list(@Query() query: unknown) {
    const filters = FilterInteractionsSchema.parse(query) satisfies FilterInteractionsDto;
    return this.interactions.list(filters);
  }

  @Get(':id')
  @RequirePermission(Permission.CRM_INTERACTIONS_READ)
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('includeDeleted') includeDeleted?: string,
  ) {
    return this.interactions.findOne(id, includeDeleted === 'true');
  }

  @Post(':id/annotate')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission(Permission.CRM_INTERACTIONS_CREATE)
  async annotate(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    const dto = AnnotateInteractionSchema.parse(body) satisfies AnnotateInteractionDto;
    const userId = this.tenantContext.getCurrentContext()?.userId ?? 'unknown';
    return this.interactions.annotate(id, dto, userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission(Permission.CRM_INTERACTIONS_SOFT_DELETE)
  async softDelete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    const userId = this.tenantContext.getCurrentContext()?.userId ?? 'unknown';
    await this.interactions.softDelete(id, userId);
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(Permission.CRM_INTERACTIONS_RESTORE)
  async restore(@Param('id', ParseUUIDPipe) id: string) {
    const userId = this.tenantContext.getCurrentContext()?.userId ?? 'unknown';
    await this.interactions.restore(id, userId);
    return { restored: true, id };
  }
}

/**
 * Standalone timeline controller -- the timeline endpoints are nested under
 * the parent entity routes for natural REST URL design.
 */
@Controller('api/v1/crm')
@RequireTenant()
export class InteractionsTimelineController {
  constructor(
    private readonly interactions: InteractionsService,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private readonly tenantContext: TenantContextService,
  ) {}

  @Get('companies/:id/timeline')
  @RequirePermission(Permission.CRM_INTERACTIONS_READ)
  async timelineForCompany(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: unknown,
  ) {
    const dto = TimelineQuerySchema.parse(query) satisfies TimelineQueryDto;
    return this.interactions.timelineForEntity('company', id, dto);
  }

  @Get('contacts/:id/timeline')
  @RequirePermission(Permission.CRM_INTERACTIONS_READ)
  async timelineForContact(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: unknown,
  ) {
    const dto = TimelineQuerySchema.parse(query) satisfies TimelineQueryDto;
    return this.interactions.timelineForEntity('contact', id, dto);
  }

  @Get('deals/:id/timeline')
  @RequirePermission(Permission.CRM_INTERACTIONS_READ)
  async timelineForDeal(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: unknown,
  ) {
    const dto = TimelineQuerySchema.parse(query) satisfies TimelineQueryDto;
    return this.interactions.timelineForEntity('deal', id, dto);
  }
}
