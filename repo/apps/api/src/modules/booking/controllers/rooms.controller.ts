/**
 * RoomsController -- Sprint 8 Tache 8.8.
 *
 * Endpoints REST CRUD pour booking_rooms.
 *
 * Permissions :
 *   - GET endpoints      -> BOOKING_ROOMS_READ
 *   - POST create / PATCH / DELETE soft / reactivate / hard delete
 *                         -> BOOKING_ROOMS_MANAGE (umbrella -- catalog Sprint 7.5a)
 *
 * Routes :
 *   GET    /api/v1/booking/rooms
 *   GET    /api/v1/booking/rooms/:id
 *   POST   /api/v1/booking/rooms
 *   PATCH  /api/v1/booking/rooms/:id
 *   DELETE /api/v1/booking/rooms/:id              (soft)
 *   POST   /api/v1/booking/rooms/:id/reactivate
 *   DELETE /api/v1/booking/rooms/:id/hard         (DB FK RESTRICT bloque si appointments referencent)
 *
 * Reference : B-08 Tache 3.2.1.
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
  CreateRoomSchema,
  FilterRoomsSchema,
  UpdateRoomSchema,
  type CreateRoomDto,
  type FilterRoomsDto,
  type UpdateRoomDto,
} from '@insurtech/booking';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator.js';
import { RequireTenant } from '../../../common/decorators/require-tenant.decorator.js';
import { RoomsService } from '../services/rooms.service.js';

@Controller('api/v1/booking/rooms')
@RequireTenant()
export class RoomsController {
  constructor(
    private readonly rooms: RoomsService,
    private readonly tenantContext: TenantContextService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission(Permission.BOOKING_ROOMS_MANAGE)
  async create(@Body() body: unknown) {
    const dto = CreateRoomSchema.parse(body) satisfies CreateRoomDto;
    const userId = this.tenantContext.getCurrentContext()?.userId ?? 'unknown';
    return this.rooms.create(dto, userId);
  }

  @Get()
  @RequirePermission(Permission.BOOKING_ROOMS_READ)
  async list(@Query() query: unknown) {
    const filters = FilterRoomsSchema.parse(query) satisfies FilterRoomsDto;
    return this.rooms.findAll(filters);
  }

  @Get(':id')
  @RequirePermission(Permission.BOOKING_ROOMS_READ)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.rooms.findOne(id);
  }

  @Patch(':id')
  @RequirePermission(Permission.BOOKING_ROOMS_MANAGE)
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    const dto = UpdateRoomSchema.parse(body) satisfies UpdateRoomDto;
    const userId = this.tenantContext.getCurrentContext()?.userId ?? 'unknown';
    return this.rooms.update(id, dto, userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission(Permission.BOOKING_ROOMS_MANAGE)
  async deactivate(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    const userId = this.tenantContext.getCurrentContext()?.userId ?? 'unknown';
    await this.rooms.deactivate(id, userId);
  }

  @Post(':id/reactivate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(Permission.BOOKING_ROOMS_MANAGE)
  async reactivate(@Param('id', ParseUUIDPipe) id: string) {
    const userId = this.tenantContext.getCurrentContext()?.userId ?? 'unknown';
    await this.rooms.reactivate(id, userId);
    return { reactivated: true, id };
  }

  @Delete(':id/hard')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission(Permission.BOOKING_ROOMS_MANAGE)
  async hardDelete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    const userId = this.tenantContext.getCurrentContext()?.userId ?? 'unknown';
    await this.rooms.hardDelete(id, userId);
  }
}
