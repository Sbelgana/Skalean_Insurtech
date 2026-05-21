// TenantSuspensionService -- state machine suspend/reactivate avec cascade.
//
// State machine :
//   pending_setup -> active    (TenantOnboardingService.complete)
//   active        -> suspended (suspend) | archived (archive)
//   suspended     -> active    (reactivate) | archived (archive)
//   archived      -> active    (restore)
//   archived      -> suspended INTERDIT
//
// Cascade par suspension_type (Sprint 6 documente, Sprint 11+ Pay et Sprint 9 Comm
// implementeront les consequences runtime complets) :
//   payment_failure       : sessions invalidated, read-only mode (futur), grace 7j
//   compliance_violation  : sessions invalidated, all blocked, ACAPS notif path
//   manual_admin          : sessions invalidated, read-only mode, custom message
//
// Reference : Sprint 6 / Tache 2.2.9.

import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AuthTenant,
  type DataSource,
  type TenantStatus,
  type TenantSuspensionType,
} from '@insurtech/database';
import type Redis from 'ioredis';
import { DATA_SOURCE_TOKEN } from '../../../database/data-source.provider.js';
import { REDIS_CLIENT_TOKEN } from '../../../redis/redis.provider.js';
import { CrossTenantAuthorizationService } from '../../tenant/services/cross-tenant-authorization.service.js';
import { TenantAccessCacheService } from '../../tenant/services/tenant-access-cache.service.js';
import type { SuspendTenantInput, SuspendedTenantDto } from '../types/suspension.type.js';
import {
  SUSPENSION_ERROR_CODES,
  isTransitionAllowed,
} from '../types/suspension.type.js';

@Injectable()
export class TenantSuspensionService {
  private readonly logger = new Logger(TenantSuspensionService.name);

  constructor(
    @Inject(DATA_SOURCE_TOKEN) private readonly dataSource: DataSource,
    @Inject(REDIS_CLIENT_TOKEN) private readonly redis: Redis,
    private readonly cache: TenantAccessCacheService,
    private readonly crossTenantAuthz: CrossTenantAuthorizationService,
  ) {}

  // ===========================================================================
  // SUSPEND
  // ===========================================================================

  async suspend(
    tenantId: string,
    input: SuspendTenantInput,
    adminUserId: string,
  ): Promise<SuspendedTenantDto> {
    const repo = this.dataSource.getRepository(AuthTenant);
    const tenant = await repo.findOne({ where: { id: tenantId }, withDeleted: true });
    this.assertTenantExists(tenant, tenantId);

    if (tenant.status === 'archived' || tenant.deletedAt !== null) {
      throw new BadRequestException({
        code: SUSPENSION_ERROR_CODES.TENANT_ARCHIVED,
        message: 'Tenant is archived. Restore first to enable suspension.',
      });
    }
    if (tenant.status === 'suspended') {
      throw new ConflictException({
        code: SUSPENSION_ERROR_CODES.TENANT_ALREADY_SUSPENDED,
        message: 'Tenant is already suspended',
      });
    }
    if (!isTransitionAllowed(tenant.status, 'suspended')) {
      throw new BadRequestException({
        code: SUSPENSION_ERROR_CODES.INVALID_STATE_TRANSITION,
        message: `Cannot transition from '${tenant.status}' to 'suspended'`,
      });
    }

    tenant.status = 'suspended';
    tenant.suspendedAt = new Date();
    tenant.suspensionReason = input.reason;
    tenant.suspensionType = input.suspensionType;
    // Clear previous reactivation fields.
    tenant.reactivatedAt = null;
    tenant.reactivationReason = null;
    await repo.save(tenant);

    // Cascade : invalidate sessions Redis, revoke active cross-tenant authz.
    const sessionsCleared = await this.invalidateTenantSessions(tenantId);
    const authzRevoked = await this.revokeActiveCrossTenantAuthz(tenantId, adminUserId, input.reason);

    await this.cache.invalidateAllForTenant(tenantId);

    this.logger.warn(
      `tenant_suspended tenant=${tenantId} type=${input.suspensionType} by_admin=${adminUserId} sessions_cleared=${sessionsCleared} authz_revoked=${authzRevoked} reason=${input.reason}`,
    );

    return this.toDto(tenant);
  }

  // ===========================================================================
  // REACTIVATE
  // ===========================================================================

  async reactivate(
    tenantId: string,
    reason: string,
    adminUserId: string,
  ): Promise<SuspendedTenantDto> {
    const repo = this.dataSource.getRepository(AuthTenant);
    const tenant = await repo.findOne({ where: { id: tenantId }, withDeleted: true });
    this.assertTenantExists(tenant, tenantId);

    if (tenant.deletedAt !== null || tenant.status === 'archived') {
      throw new BadRequestException({
        code: SUSPENSION_ERROR_CODES.TENANT_ARCHIVED,
        message: 'Tenant is archived. Restore first.',
      });
    }
    if (tenant.status !== 'suspended') {
      throw new BadRequestException({
        code: SUSPENSION_ERROR_CODES.TENANT_NOT_SUSPENDED,
        message: `Tenant is not suspended (current status: ${tenant.status})`,
      });
    }
    if (!isTransitionAllowed(tenant.status, 'active')) {
      throw new BadRequestException({
        code: SUSPENSION_ERROR_CODES.INVALID_STATE_TRANSITION,
        message: `Cannot transition from '${tenant.status}' to 'active'`,
      });
    }

    const previousType = tenant.suspensionType;
    tenant.status = 'active';
    tenant.reactivatedAt = new Date();
    tenant.reactivationReason = reason;
    // Conserver suspendedAt/Reason pour audit trail (historique).
    await repo.save(tenant);

    await this.cache.invalidateAllForTenant(tenantId);

    this.logger.log(
      `tenant_reactivated tenant=${tenantId} previous_type=${previousType ?? '-'} by_admin=${adminUserId} reason=${reason}`,
    );

    return this.toDto(tenant);
  }

  // ===========================================================================
  // STATUS LIFECYCLE (transitions techniques)
  // ===========================================================================

  /**
   * Marque un tenant pending_setup (apres onboarding initiate, avant complete).
   * Pas d'audit cascade -- transition technique.
   */
  async markPendingSetup(tenantId: string): Promise<void> {
    const repo = this.dataSource.getRepository(AuthTenant);
    const tenant = await repo.findOne({ where: { id: tenantId } });
    if (!tenant) return;
    if (tenant.status === 'pending_setup') return;
    if (!isTransitionAllowed(tenant.status, 'pending_setup')) {
      this.logger.warn(
        `status_transition_attempted tenant=${tenantId} from=${tenant.status} to=pending_setup REJECTED`,
      );
      return;
    }
    tenant.status = 'pending_setup';
    await repo.save(tenant);
    await this.cache.invalidateAllForTenant(tenantId);
  }

  /**
   * Marque un tenant active (apres onboarding complete).
   */
  async markActive(tenantId: string): Promise<void> {
    const repo = this.dataSource.getRepository(AuthTenant);
    const tenant = await repo.findOne({ where: { id: tenantId } });
    if (!tenant) return;
    if (tenant.status === 'active') return;
    if (!isTransitionAllowed(tenant.status, 'active')) {
      this.logger.warn(
        `status_transition_attempted tenant=${tenantId} from=${tenant.status} to=active REJECTED`,
      );
      return;
    }
    tenant.status = 'active';
    await repo.save(tenant);
    await this.cache.invalidateAllForTenant(tenantId);
  }

  // ===========================================================================
  // QUERIES
  // ===========================================================================

  async listSuspended(): Promise<SuspendedTenantDto[]> {
    const repo = this.dataSource.getRepository(AuthTenant);
    const rows = await repo.find({
      where: { status: 'suspended' },
      order: { suspendedAt: 'DESC' },
    });
    return rows.map((r) => this.toDto(r));
  }

  async getSuspensionDetails(tenantId: string): Promise<SuspendedTenantDto> {
    const repo = this.dataSource.getRepository(AuthTenant);
    const tenant = await repo.findOne({ where: { id: tenantId }, withDeleted: true });
    this.assertTenantExists(tenant, tenantId);
    return this.toDto(tenant);
  }

  // ===========================================================================
  // CASCADE HELPERS
  // ===========================================================================

  /**
   * Invalide toutes les sessions Redis du tenant.
   * Pattern Sprint 5 sessions DB1 : sessions:user:<userId>:tenant:<tenantId>:*
   */
  private async invalidateTenantSessions(tenantId: string): Promise<number> {
    const keys: string[] = [];
    const stream = this.redis.scanStream({ match: `sessions:*:tenant:${tenantId}:*` });
    for await (const batch of stream) {
      keys.push(...(batch as string[]));
    }
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
    return keys.length;
  }

  /**
   * Revoke toutes les cross-tenant authorizations actives ou le tenant est grantor (from_tenant_id).
   */
  private async revokeActiveCrossTenantAuthz(
    tenantId: string,
    adminUserId: string,
    reason: string,
  ): Promise<number> {
    try {
      const granted = await this.crossTenantAuthz.listGrantedBy(tenantId);
      let revokedCount = 0;
      for (const authz of granted) {
        if (authz.revokedAt) continue;
        if (authz.expiresAt.getTime() <= Date.now()) continue;
        try {
          await this.crossTenantAuthz.revoke(authz.id, `tenant_suspended:${reason}`, adminUserId);
          revokedCount += 1;
        } catch (err) {
          this.logger.debug(
            `cross_tenant_authz_revoke_skip authz=${authz.id} error=${(err as Error).message}`,
          );
        }
      }
      return revokedCount;
    } catch (err) {
      this.logger.warn(
        `cross_tenant_authz_revoke_cascade_failed tenant=${tenantId} error=${(err as Error).message}`,
      );
      return 0;
    }
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  private assertTenantExists(
    tenant: AuthTenant | null,
    tenantId: string,
  ): asserts tenant is AuthTenant {
    if (!tenant) {
      throw new NotFoundException({
        code: SUSPENSION_ERROR_CODES.TENANT_NOT_FOUND,
        message: `Tenant '${tenantId}' not found`,
      });
    }
  }

  private toDto(t: AuthTenant): SuspendedTenantDto {
    return {
      id: t.id,
      name: t.name,
      type: t.type,
      status: (t.status ?? 'active') as TenantStatus,
      suspendedAt: t.suspendedAt ?? null,
      suspensionReason: t.suspensionReason ?? null,
      suspensionType: (t.suspensionType ?? null) as TenantSuspensionType | null,
      reactivatedAt: t.reactivatedAt ?? null,
      reactivationReason: t.reactivationReason ?? null,
    };
  }
}
