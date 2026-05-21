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
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard.js';
import { TenantContextGuard } from '../../common/guards/tenant-context.guard.js';
import { SuperAdminAuditInterceptor } from '../../common/interceptors/super-admin-audit.interceptor.js';
import { AuthModule } from '../auth/auth.module.js';
import { TenantModule } from '../tenant/tenant.module.js';
import { AdminCndpPurgeController } from './controllers/admin-cndp-purge.controller.js';
import { AdminOnboardingController } from './controllers/admin-onboarding.controller.js';
import { AdminQuotasController } from './controllers/admin-quotas.controller.js';
import { AdminSuspensionController } from './controllers/admin-suspension.controller.js';
import { AdminTenantsController } from './controllers/admin-tenants.controller.js';
import { OnboardingController } from './controllers/onboarding.controller.js';
import { CndpPurgeService } from './services/cndp-purge.service.js';
import { ResourceQuotaService } from './services/resource-quota.service.js';
import { TenantManagementService } from './services/tenant-management.service.js';
import { TenantOnboardingService } from './services/tenant-onboarding.service.js';
import { TenantSuspensionService } from './services/tenant-suspension.service.js';

@Module({
  imports: [TenantModule, AuthModule],
  controllers: [
    AdminTenantsController,
    AdminOnboardingController,
    AdminSuspensionController,
    AdminQuotasController,
    AdminCndpPurgeController,
    OnboardingController,
  ],
  providers: [
    TenantManagementService,
    TenantOnboardingService,
    TenantSuspensionService,
    ResourceQuotaService,
    CndpPurgeService,
    // Tache 2.2.3 -- TenantContextGuard global (basic isSuperAdmin + RequireTenant).
    {
      provide: APP_GUARD,
      useClass: TenantContextGuard,
    },
    // Tache 2.2.10 -- SuperAdminGuard fine-grained role + write-protection.
    {
      provide: APP_GUARD,
      useClass: SuperAdminGuard,
    },
    // Tache 2.2.10 -- SuperAdminAuditInterceptor audit obligatoire loi 09-08.
    {
      provide: APP_INTERCEPTOR,
      useClass: SuperAdminAuditInterceptor,
    },
  ],
  exports: [
    TenantManagementService,
    TenantOnboardingService,
    TenantSuspensionService,
    ResourceQuotaService,
    CndpPurgeService,
  ],
})
export class AdminModule {}
