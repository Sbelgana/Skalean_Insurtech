/**
 * AppointmentsController -- Sprint 8 Tache 8.9.
 *
 * Endpoints REST CRUD + state machine + reschedule + reopen pour booking_appointments.
 *
 * Permissions :
 *   - GET endpoints      -> BOOKING_APPOINTMENTS_READ
 *   - POST create        -> BOOKING_APPOINTMENTS_CREATE
 *   - PATCH update       -> BOOKING_APPOINTMENTS_UPDATE
 *   - POST confirm/markInProgress/complete/cancel/noShow/reschedule
 *                        -> BOOKING_APPOINTMENTS_UPDATE
 *   - POST reopen        -> BOOKING_APPOINTMENTS_OVERRIDE_WORKFLOW (admin only)
 *   - DELETE             -> BOOKING_APPOINTMENTS_DELETE (hard delete)
 *
 * Reference : B-08 Tache 3.2.2.
 */

import {
  Body,
  Controller,
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
  CancelAppointmentSchema,
  CreateAppointmentSchema,
  FilterAppointmentsSchema,
  RescheduleAppointmentSchema,
  ReopenAppointmentSchema,
  UpdateAppointmentSchema,
  type CancelAppointmentDto,
  type CreateAppointmentDto,
  type FilterAppointmentsDto,
  type RescheduleAppointmentDto,
  type ReopenAppointmentDto,
  type UpdateAppointmentDto,
} from '@insurtech/booking';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator.js';
import { RequireTenant } from '../../../common/decorators/require-tenant.decorator.js';
import { AppointmentsService } from '../services/appointments.service.js';

@Controller('api/v1/booking/appointments')
@RequireTenant()
export class AppointmentsController {
  constructor(
    private readonly appointments: AppointmentsService,
    private readonly tenantContext: TenantContextService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission(Permission.BOOKING_APPOINTMENTS_CREATE)
  async create(@Body() body: unknown) {
    const dto = CreateAppointmentSchema.parse(body) satisfies CreateAppointmentDto;
    const userId = this.tenantContext.getCurrentContext()?.userId ?? 'unknown';
    return this.appointments.create(dto, userId);
  }

  @Get()
  @RequirePermission(Permission.BOOKING_APPOINTMENTS_READ)
  async list(@Query() query: unknown) {
    const filters = FilterAppointmentsSchema.parse(query) satisfies FilterAppointmentsDto;
    return this.appointments.list(filters);
  }

  @Get(':id')
  @RequirePermission(Permission.BOOKING_APPOINTMENTS_READ)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.appointments.findOne(id);
  }

  @Patch(':id')
  @RequirePermission(Permission.BOOKING_APPOINTMENTS_UPDATE)
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    const dto = UpdateAppointmentSchema.parse(body) satisfies UpdateAppointmentDto;
    const userId = this.tenantContext.getCurrentContext()?.userId ?? 'unknown';
    return this.appointments.update(id, dto, userId);
  }

  @Post(':id/confirm')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(Permission.BOOKING_APPOINTMENTS_UPDATE)
  async confirm(@Param('id', ParseUUIDPipe) id: string) {
    const userId = this.tenantContext.getCurrentContext()?.userId ?? 'unknown';
    return this.appointments.confirm(id, userId);
  }

  @Post(':id/in-progress')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(Permission.BOOKING_APPOINTMENTS_UPDATE)
  async markInProgress(@Param('id', ParseUUIDPipe) id: string) {
    const userId = this.tenantContext.getCurrentContext()?.userId ?? 'unknown';
    return this.appointments.markInProgress(id, userId);
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(Permission.BOOKING_APPOINTMENTS_UPDATE)
  async complete(@Param('id', ParseUUIDPipe) id: string) {
    const userId = this.tenantContext.getCurrentContext()?.userId ?? 'unknown';
    return this.appointments.complete(id, userId);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(Permission.BOOKING_APPOINTMENTS_UPDATE)
  async cancel(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    const dto = CancelAppointmentSchema.parse(body) satisfies CancelAppointmentDto;
    const userId = this.tenantContext.getCurrentContext()?.userId ?? 'unknown';
    return this.appointments.cancel(id, dto, userId);
  }

  @Post(':id/no-show')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(Permission.BOOKING_APPOINTMENTS_UPDATE)
  async markNoShow(@Param('id', ParseUUIDPipe) id: string) {
    const userId = this.tenantContext.getCurrentContext()?.userId ?? 'unknown';
    return this.appointments.markNoShow(id, userId);
  }

  @Post(':id/reschedule')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(Permission.BOOKING_APPOINTMENTS_UPDATE)
  async reschedule(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    const dto = RescheduleAppointmentSchema.parse(body) satisfies RescheduleAppointmentDto;
    const userId = this.tenantContext.getCurrentContext()?.userId ?? 'unknown';
    return this.appointments.reschedule(id, dto, userId);
  }

  @Post(':id/reopen')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(Permission.BOOKING_APPOINTMENTS_OVERRIDE_WORKFLOW)
  async reopen(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    const dto = ReopenAppointmentSchema.parse(body) satisfies ReopenAppointmentDto;
    const userId = this.tenantContext.getCurrentContext()?.userId ?? 'unknown';
    return this.appointments.reopen(id, dto, userId);
  }
}
