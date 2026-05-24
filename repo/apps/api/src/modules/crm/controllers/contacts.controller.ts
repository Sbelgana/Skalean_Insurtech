/**
 * ContactsController -- Sprint 8 Tache 8.2.
 *
 * Endpoints REST CRUD + search + link/unlink company pour CRM contacts.
 *
 * Protection :
 *   - @RequireTenant : verifie ctx.tenantId non-null (Sprint 6)
 *   - @RequirePermission : verifie permission crm.contacts.* (Sprint 7)
 *
 * Routes :
 *   POST   /api/v1/crm/contacts                          (crm.contacts.create)
 *   GET    /api/v1/crm/contacts                          (crm.contacts.read)
 *   GET    /api/v1/crm/contacts/:id                      (crm.contacts.read)
 *   GET    /api/v1/crm/contacts/by-email/:email          (crm.contacts.read)
 *   PATCH  /api/v1/crm/contacts/:id                      (crm.contacts.update)
 *   PATCH  /api/v1/crm/contacts/:id/company              (crm.contacts.update) -- link/unlink
 *   DELETE /api/v1/crm/contacts/:id                      (crm.contacts.delete)
 *
 * Reference : B-08 Tache 3.1.2.
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
  ContactFiltersSchema,
  CreateContactSchema,
  LinkContactToCompanySchema,
  UpdateContactSchema,
  type ContactFiltersDto,
  type CreateContactDto,
  type LinkContactToCompanyDto,
  type UpdateContactDto,
} from '@insurtech/crm';
import { RequireTenant } from '../../../common/decorators/require-tenant.decorator.js';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator.js';
import { ContactsService } from '../services/contacts.service.js';

@Controller('api/v1/crm/contacts')
@RequireTenant()
export class ContactsController {
  constructor(
    private readonly contacts: ContactsService,
    private readonly tenantContext: TenantContextService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission(Permission.CRM_CONTACTS_CREATE)
  async create(@Body() body: unknown) {
    const dto = CreateContactSchema.parse(body) satisfies CreateContactDto;
    const userId = this.tenantContext.getCurrentContext()?.userId ?? 'unknown';
    return this.contacts.create(dto, userId);
  }

  @Get()
  @RequirePermission(Permission.CRM_CONTACTS_READ)
  async list(@Query() query: unknown) {
    const filters = ContactFiltersSchema.parse(query) satisfies ContactFiltersDto;
    return this.contacts.list(filters);
  }

  @Get('by-email/:email')
  @RequirePermission(Permission.CRM_CONTACTS_READ)
  async findByEmail(@Param('email') email: string) {
    return this.contacts.findByEmail(email);
  }

  @Get(':id')
  @RequirePermission(Permission.CRM_CONTACTS_READ)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.contacts.findOne(id);
  }

  @Patch(':id')
  @RequirePermission(Permission.CRM_CONTACTS_UPDATE)
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    const dto = UpdateContactSchema.parse(body) satisfies UpdateContactDto;
    const userId = this.tenantContext.getCurrentContext()?.userId ?? 'unknown';
    return this.contacts.update(id, dto, userId);
  }

  @Patch(':id/company')
  @RequirePermission(Permission.CRM_CONTACTS_UPDATE)
  async linkToCompany(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    const dto = LinkContactToCompanySchema.parse(body) satisfies LinkContactToCompanyDto;
    const userId = this.tenantContext.getCurrentContext()?.userId ?? 'unknown';
    return this.contacts.linkToCompany(id, dto.companyId, userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission(Permission.CRM_CONTACTS_DELETE)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    const userId = this.tenantContext.getCurrentContext()?.userId ?? 'unknown';
    await this.contacts.softDelete(id, userId);
  }
}
