/**
 * OnboardingController -- routes publiques (sans auth) completion + verify token.
 *
 * Routes :
 *   POST /api/v1/public/onboarding/complete (body: token + password)
 *   POST /api/v1/public/onboarding/verify-token (body: token, UX preview)
 *
 * Prefixe /api/v1/public/* -> RouteCategory.Public (classifyRoute Tache 2.2.2)
 *   -> skip auth + tenant context + transaction.
 * @Public() decorator (Sprint 3) -> defense en profondeur si guard run.
 *
 * Reference : Sprint 6 / Tache 2.2.8.
 */

import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Public } from '../../../decorators/public.decorator.js';
import {
  CompleteOnboardingSchema,
  type CompleteOnboardingDto,
  VerifyOnboardingTokenSchema,
} from '../dto/onboarding.dto.js';
import { TenantOnboardingService } from '../services/tenant-onboarding.service.js';
import type {
  OnboardingCompleteResult,
  OnboardingVerifyTokenResult,
} from '../types/onboarding.type.js';

@Controller('api/v1/public/onboarding')
@Public()
export class OnboardingController {
  constructor(private readonly onboarding: TenantOnboardingService) {}

  @Post('complete')
  @HttpCode(HttpStatus.OK)
  async complete(@Body() body: unknown): Promise<OnboardingCompleteResult> {
    const dto: CompleteOnboardingDto = CompleteOnboardingSchema.parse(body);
    return this.onboarding.complete(dto);
  }

  @Post('verify-token')
  @HttpCode(HttpStatus.OK)
  async verifyToken(@Body() body: unknown): Promise<OnboardingVerifyTokenResult> {
    const dto = VerifyOnboardingTokenSchema.parse(body);
    return this.onboarding.verifyToken(dto.token);
  }
}
