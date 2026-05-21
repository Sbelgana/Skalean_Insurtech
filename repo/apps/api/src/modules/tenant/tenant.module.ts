/**
 * TenantModule -- Sprint 6 Tache 2.2.2.
 *
 * Enrichi avec :
 *   - TenantAccessCacheService (Redis cache acces user + tenant settings)
 *
 * Sprint 6 a venir :
 *   - Tache 2.2.4 TenantTransactionInterceptor (SET LOCAL Postgres)
 *   - Tache 2.2.5 TenantValidationService
 *   - Tache 2.2.6 CrossTenantAuthorizationService
 *   - Tache 2.2.7 TenantManagementService
 *
 * Reference : B-06 Sprint 6 Multi-Tenant.
 */
import { Module } from '@nestjs/common';
import { TenantAccessCacheService } from './services/tenant-access-cache.service.js';
import { TenantValidationService } from './services/tenant-validation.service.js';

@Module({
  providers: [TenantAccessCacheService, TenantValidationService],
  exports: [TenantAccessCacheService, TenantValidationService],
})
export class TenantModule {}
