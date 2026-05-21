/**
 * AdminModule -- routes back-office /api/v1/admin/*.
 *
 * Securite : @AdminOnly() (Tache 2.2.3) sur tous controllers.
 * TenantContextGuard enforce isSuperAdmin via APP_GUARD global.
 *
 * Sprint 6 :
 *   Tache 2.2.7 : tenants CRUD (cette tache)
 *   Tache 2.2.9 : tenants suspend/reactivate (a venir)
 *   Tache 2.2.10 : SuperAdminGuard enrichi audit
 *
 * Reference : B-06 Sprint 6 / Tache 2.2.7.
 */
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TenantContextGuard } from '../../common/guards/tenant-context.guard.js';
import { AuthModule } from '../auth/auth.module.js';
import { TenantModule } from '../tenant/tenant.module.js';
import { AdminOnboardingController } from './controllers/admin-onboarding.controller.js';
import { AdminTenantsController } from './controllers/admin-tenants.controller.js';
import { OnboardingController } from './controllers/onboarding.controller.js';
import { TenantManagementService } from './services/tenant-management.service.js';
import { TenantOnboardingService } from './services/tenant-onboarding.service.js';

@Module({
  imports: [TenantModule, AuthModule],
  controllers: [AdminTenantsController, AdminOnboardingController, OnboardingController],
  providers: [
    TenantManagementService,
    TenantOnboardingService,
    {
      provide: APP_GUARD,
      useClass: TenantContextGuard,
    },
  ],
  exports: [TenantManagementService, TenantOnboardingService],
})
export class AdminModule {}
