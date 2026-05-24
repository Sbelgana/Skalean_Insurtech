/**
 * CompaniesController -- Sprint 8 Tache 8.1.
 *
 * Endpoints REST CRUD + search pour CRM companies.
 *
 * Protection :
 *   - @RequireTenant : verifie ctx.tenantId non-null (Sprint 6)
 *   - @RequirePermission : verifie permission crm.companies.* (Sprint 7)
 *
 * Routes :
 *   POST   /api/v1/crm/companies         (crm.companies.create)
 *   GET    /api/v1/crm/companies         (crm.companies.read)
 *   GET    /api/v1/crm/companies/:id     (crm.companies.read)
 *   PATCH  /api/v1/crm/companies/:id     (crm.companies.update)
 *   DELETE /api/v1/crm/companies/:id     (crm.companies.delete)
 *
 * Reference : B-08 Tache 3.1.1.
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
import { TenantContextService, Permission } from '@insurtech/auth';
import {
  CompanyFiltersSchema,
  CreateCompanySchema,
  UpdateCompanySchema,
  type CompanyFiltersDto,
  type CreateCompanyDto,
  type UpdateCompanyDto,
} from '@insurtech/crm';
import { RequireTenant } from '../../../common/decorators/require-tenant.decorator.js';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator.js';
import { CompaniesService } from '../services/companies.service.js';

@Controller('api/v1/crm/companies')
@RequireTenant()
export class CompaniesController {
  constructor(
    private readonly companies: CompaniesService,
    private readonly tenantContext: TenantContextService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission(Permission.CRM_COMPANIES_CREATE)
  async create(@Body() body: unknown) {
    const dto = CreateCompanySchema.parse(body) satisfies CreateCompanyDto;
    const userId = this.tenantContext.getCurrentContext()?.userId ?? 'unknown';
    return this.companies.create(dto, userId);
  }

  @Get()
  @RequirePermission(Permission.CRM_COMPANIES_READ)
  async list(@Query() query: unknown) {
    const filters = CompanyFiltersSchema.parse(query) satisfies CompanyFiltersDto;
    return this.companies.list(filters);
  }

  @Get(':id')
  @RequirePermission(Permission.CRM_COMPANIES_READ)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.companies.findOne(id);
  }

  @Patch(':id')
  @RequirePermission(Permission.CRM_COMPANIES_UPDATE)
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    const dto = UpdateCompanySchema.parse(body) satisfies UpdateCompanyDto;
    const userId = this.tenantContext.getCurrentContext()?.userId ?? 'unknown';
    return this.companies.update(id, dto, userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission(Permission.CRM_COMPANIES_DELETE)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    const userId = this.tenantContext.getCurrentContext()?.userId ?? 'unknown';
    await this.companies.softDelete(id, userId);
  }
}
