/**
 * CustomFieldsController -- Sprint 8 Tache 8.7.
 *
 * Admin-only CRUD endpoints pour les definitions de custom fields per tenant.
 *
 * Permissions :
 *   - GET endpoints      -> CRM_CUSTOM_FIELDS_MANAGE (admin view)
 *   - POST create        -> CRM_CUSTOM_FIELDS_MANAGE
 *   - PATCH update       -> CRM_CUSTOM_FIELDS_MANAGE
 *   - DELETE deactivate  -> CRM_CUSTOM_FIELDS_MANAGE (soft)
 *   - POST reactivate    -> CRM_CUSTOM_FIELDS_MANAGE
 *   - DELETE :id/hard    -> CRM_CUSTOM_FIELDS_DELETE (super-admin)
 *
 * Routes :
 *   GET    /api/v1/crm/custom-fields
 *   GET    /api/v1/crm/custom-fields/:id
 *   POST   /api/v1/crm/custom-fields
 *   PATCH  /api/v1/crm/custom-fields/:id
 *   DELETE /api/v1/crm/custom-fields/:id          (soft)
 *   POST   /api/v1/crm/custom-fields/:id/reactivate
 *   DELETE /api/v1/crm/custom-fields/:id/hard     (super-admin)
 *
 * Reference : B-08 Tache 3.1.7.
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
  CreateFieldDefinitionSchema,
  FieldDefinitionFiltersSchema,
  UpdateFieldDefinitionSchema,
  type CreateFieldDefinitionDto,
  type FieldDefinitionFiltersDto,
  type UpdateFieldDefinitionDto,
} from '@insurtech/crm';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator.js';
import { RequireTenant } from '../../../common/decorators/require-tenant.decorator.js';
import { CustomFieldsDefinitionService } from '../services/custom-fields-definition.service.js';

@Controller('api/v1/crm/custom-fields')
@RequireTenant()
export class CustomFieldsController {
  constructor(
    private readonly definitions: CustomFieldsDefinitionService,
    private readonly tenantContext: TenantContextService,
  ) {}

  @Get()
  @RequirePermission(Permission.CRM_CUSTOM_FIELDS_MANAGE)
  async list(@Query() query: unknown) {
    const filters = FieldDefinitionFiltersSchema.parse(
      query,
    ) satisfies FieldDefinitionFiltersDto;
    return this.definitions.list(filters);
  }

  @Get(':id')
  @RequirePermission(Permission.CRM_CUSTOM_FIELDS_MANAGE)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.definitions.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission(Permission.CRM_CUSTOM_FIELDS_MANAGE)
  async create(@Body() body: unknown) {
    const dto = CreateFieldDefinitionSchema.parse(
      body,
    ) satisfies CreateFieldDefinitionDto;
    const userId = this.tenantContext.getCurrentContext()?.userId ?? 'unknown';
    return this.definitions.create(dto, userId);
  }

  @Patch(':id')
  @RequirePermission(Permission.CRM_CUSTOM_FIELDS_MANAGE)
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    const dto = UpdateFieldDefinitionSchema.parse(
      body,
    ) satisfies UpdateFieldDefinitionDto;
    const userId = this.tenantContext.getCurrentContext()?.userId ?? 'unknown';
    return this.definitions.update(id, dto, userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission(Permission.CRM_CUSTOM_FIELDS_MANAGE)
  async deactivate(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    const userId = this.tenantContext.getCurrentContext()?.userId ?? 'unknown';
    await this.definitions.deactivate(id, userId);
  }

  @Post(':id/reactivate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(Permission.CRM_CUSTOM_FIELDS_MANAGE)
  async reactivate(@Param('id', ParseUUIDPipe) id: string) {
    const userId = this.tenantContext.getCurrentContext()?.userId ?? 'unknown';
    await this.definitions.reactivate(id, userId);
    return { reactivated: true, id };
  }

  @Delete(':id/hard')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission(Permission.CRM_CUSTOM_FIELDS_DELETE)
  async hardDelete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    const userId = this.tenantContext.getCurrentContext()?.userId ?? 'unknown';
    await this.definitions.hardDelete(id, userId);
  }
}
