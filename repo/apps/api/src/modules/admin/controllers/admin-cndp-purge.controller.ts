/**
 * AdminCndpPurgeController -- routes super admin CNDP purge (loi 09-08).
 *
 * Routes /api/v1/admin/cndp/* :
 *   POST   /purge-request                  @AdminOnly (DPO ou super_admin initiate)
 *   GET    /purge-requests                 @AnalystAllowed (list pending)
 *   GET    /purge-requests/:id             @AnalystAllowed (details)
 *   POST   /purge-requests/:id/validate    @SuperAdminWrite (super_admin validate)
 *   POST   /purge-requests/:id/execute     @SuperAdminWrite (irreversible)
 *   POST   /purge-requests/:id/cancel      @SuperAdminWrite
 *
 * Reference : Sprint 6 / Tache 2.2.12 + loi 09-08 art. 24-26.
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
import { AnalystAllowed } from '../../../common/decorators/analyst-allowed.decorator.js';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator.js';
import { SuperAdminOnly } from '../../../common/decorators/super-admin-only.decorator.js';
import { SuperAdminWrite } from '../../../common/decorators/super-admin-write.decorator.js';
import {
  CancelPurgeRequestSchema,
  InitiatePurgeRequestSchema,
  type InitiatePurgeRequestDto,
} from '../dto/cndp-purge.dto.js';
import { CndpPurgeService } from '../services/cndp-purge.service.js';
import type { PurgeRequest } from '../types/cndp-purge.type.js';

@Controller('api/v1/admin/cndp')
@AdminOnly()
@SuperAdminOnly()
export class AdminCndpPurgeController {
  constructor(private readonly purgeService: CndpPurgeService) {}

  @Post('purge-request')
  @HttpCode(HttpStatus.CREATED)
  async initiate(
    @Body() body: unknown,
    @CurrentTenant() ctx: TenantContext | undefined,
  ): Promise<PurgeRequest> {
    const dto: InitiatePurgeRequestDto = InitiatePurgeRequestSchema.parse(body);
    return this.purgeService.initiate(dto, ctx?.userId ?? 'unknown-admin');
  }

  @Get('purge-requests')
  @AnalystAllowed()
  async listPending(): Promise<PurgeRequest[]> {
    return this.purgeService.listPending();
  }

  @Get('purge-requests/:id')
  @AnalystAllowed()
  async findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<PurgeRequest> {
    return this.purgeService.findById(id);
  }

  @Post('purge-requests/:id/validate')
  @SuperAdminWrite()
  @HttpCode(HttpStatus.OK)
  async validate(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentTenant() ctx: TenantContext | undefined,
  ): Promise<PurgeRequest> {
    return this.purgeService.validate(id, ctx?.userId ?? 'unknown-admin');
  }

  @Post('purge-requests/:id/execute')
  @SuperAdminWrite()
  @HttpCode(HttpStatus.OK)
  async execute(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentTenant() ctx: TenantContext | undefined,
  ): Promise<PurgeRequest> {
    return this.purgeService.execute(id, ctx?.userId ?? 'unknown-admin');
  }

  @Post('purge-requests/:id/cancel')
  @SuperAdminWrite()
  @HttpCode(HttpStatus.OK)
  async cancel(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
    @CurrentTenant() ctx: TenantContext | undefined,
  ): Promise<PurgeRequest> {
    const dto = CancelPurgeRequestSchema.parse(body);
    return this.purgeService.cancel(id, dto, ctx?.userId ?? 'unknown-admin');
  }
}
