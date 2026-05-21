/**
 * AdminOnboardingController -- routes admin onboarding management.
 *
 * Routes /api/v1/admin/tenants/onboard|/:id/resend-invitation|/:id/cancel-onboarding.
 *
 * @AdminOnly() class-level -> TenantContextGuard enforce isSuperAdmin.
 *
 * Reference : Sprint 6 / Tache 2.2.8.
 */

import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import type { TenantContext } from '@insurtech/auth';
import { AdminOnly } from '../../../common/decorators/admin-only.decorator.js';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator.js';
import {
  CancelOnboardingSchema,
  InitiateOnboardingSchema,
  type InitiateOnboardingDto,
} from '../dto/onboarding.dto.js';
import { TenantOnboardingService } from '../services/tenant-onboarding.service.js';
import type { OnboardingInitiateResult } from '../types/onboarding.type.js';

@Controller('api/v1/admin/tenants')
@AdminOnly()
export class AdminOnboardingController {
  constructor(private readonly onboarding: TenantOnboardingService) {}

  @Post('onboard')
  @HttpCode(HttpStatus.CREATED)
  async initiate(
    @Body() body: unknown,
    @CurrentTenant() ctx: TenantContext | undefined,
  ): Promise<OnboardingInitiateResult> {
    const dto: InitiateOnboardingDto = InitiateOnboardingSchema.parse(body);
    return this.onboarding.initiate(dto, ctx?.userId ?? 'unknown-admin');
  }

  @Post(':id/resend-invitation')
  @HttpCode(HttpStatus.OK)
  async resend(
    @Param('id', new ParseUUIDPipe({ version: '4' })) tenantId: string,
    @CurrentTenant() ctx: TenantContext | undefined,
  ): Promise<{ expiresAt: Date }> {
    return this.onboarding.resendInvitation(tenantId, ctx?.userId ?? 'unknown-admin');
  }

  @Post(':id/cancel-onboarding')
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancel(
    @Param('id', new ParseUUIDPipe({ version: '4' })) tenantId: string,
    @Body() body: unknown,
    @CurrentTenant() ctx: TenantContext | undefined,
  ): Promise<void> {
    const dto = CancelOnboardingSchema.parse(body);
    await this.onboarding.cancel(tenantId, dto.reason, ctx?.userId ?? 'unknown-admin');
  }
}
