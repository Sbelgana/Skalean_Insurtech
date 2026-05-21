/**
 * Tests unitaires TenantSuspensionService.
 *
 * Reference : Sprint 6 / Tache 2.2.9.
 */

import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { AuthTenant, DataSource, TenantStatus } from '@insurtech/database';
import type Redis from 'ioredis';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CrossTenantAuthorizationService } from '../../tenant/services/cross-tenant-authorization.service.js';
import type { TenantAccessCacheService } from '../../tenant/services/tenant-access-cache.service.js';
import { CrossTenantAuthorizationType } from '../../tenant/types/cross-tenant-authorization.type.js';
import {
  isTransitionAllowed,
} from '../types/suspension.type.js';
import { TenantSuspensionService } from './tenant-suspension.service.js';

const TENANT_ID = '11111111-1111-4111-8111-111111111111';
const ADMIN_ID = '22222222-2222-4222-8222-222222222222';

const buildTenant = (overrides: Partial<AuthTenant> = {}): AuthTenant => ({
  id: TENANT_ID,
  name: 'Test',
  type: 'broker',
  settings: {},
  status: 'active' as TenantStatus,
  suspendedAt: null,
  suspensionReason: null,
  suspensionType: null,
  reactivatedAt: null,
  reactivationReason: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  tenantUsers: [],
  sessions: [],
  ...overrides,
}) as AuthTenant;

describe('TenantSuspensionService', () => {
  let service: TenantSuspensionService;
  let dataSource: DataSource;
  let redis: { scanStream: ReturnType<typeof vi.fn>; del: ReturnType<typeof vi.fn> };
  let cache: TenantAccessCacheService;
  let crossTenantAuthz: CrossTenantAuthorizationService;
  let tenantRepoFindOne: ReturnType<typeof vi.fn>;
  let tenantRepoSave: ReturnType<typeof vi.fn>;
  let tenantRepoFind: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    tenantRepoFindOne = vi.fn();
    tenantRepoSave = vi.fn(async (t) => t);
    tenantRepoFind = vi.fn().mockResolvedValue([]);

    dataSource = {
      getRepository: vi.fn(() => ({
        findOne: tenantRepoFindOne,
        save: tenantRepoSave,
        find: tenantRepoFind,
      })),
    } as unknown as DataSource;

    redis = {
      scanStream: vi.fn().mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield [];
        },
      }),
      del: vi.fn().mockResolvedValue(1),
    };

    cache = {
      invalidateAllForTenant: vi.fn().mockResolvedValue(undefined),
    } as unknown as TenantAccessCacheService;

    crossTenantAuthz = {
      listGrantedBy: vi.fn().mockResolvedValue([]),
      revoke: vi.fn().mockResolvedValue(undefined),
    } as unknown as CrossTenantAuthorizationService;

    service = new TenantSuspensionService(
      dataSource,
      redis as unknown as Redis,
      cache,
      crossTenantAuthz,
    );
  });

  // ==========================================================================
  // STATE MACHINE
  // ==========================================================================

  describe('state machine isTransitionAllowed', () => {
    it('1. pending_setup -> active OK', () => {
      expect(isTransitionAllowed('pending_setup', 'active')).toBe(true);
    });

    it('2. active -> suspended OK', () => {
      expect(isTransitionAllowed('active', 'suspended')).toBe(true);
    });

    it('3. active -> archived OK', () => {
      expect(isTransitionAllowed('active', 'archived')).toBe(true);
    });

    it('4. suspended -> active OK', () => {
      expect(isTransitionAllowed('suspended', 'active')).toBe(true);
    });

    it('5. archived -> active OK (via restore)', () => {
      expect(isTransitionAllowed('archived', 'active')).toBe(true);
    });

    it('6. archived -> suspended INTERDIT', () => {
      expect(isTransitionAllowed('archived', 'suspended')).toBe(false);
    });

    it('7. pending_setup -> suspended INTERDIT', () => {
      expect(isTransitionAllowed('pending_setup', 'suspended')).toBe(false);
    });
  });

  // ==========================================================================
  // SUSPEND
  // ==========================================================================

  describe('suspend', () => {
    it('8. transitions active -> suspended with reason + type', async () => {
      tenantRepoFindOne.mockResolvedValue(buildTenant());
      const result = await service.suspend(
        TENANT_ID,
        { reason: 'late payment', suspensionType: 'payment_failure' },
        ADMIN_ID,
      );
      expect(result.status).toBe('suspended');
      expect(result.suspensionReason).toBe('late payment');
      expect(result.suspensionType).toBe('payment_failure');
      expect(cache.invalidateAllForTenant).toHaveBeenCalledWith(TENANT_ID);
    });

    it('9. throws NotFoundException when tenant absent', async () => {
      tenantRepoFindOne.mockResolvedValue(null);
      await expect(
        service.suspend(TENANT_ID, { reason: 'r', suspensionType: 'manual_admin' }, ADMIN_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('10. throws TENANT_ARCHIVED if tenant archived', async () => {
      tenantRepoFindOne.mockResolvedValue(buildTenant({ status: 'archived' as TenantStatus }));
      try {
        await service.suspend(
          TENANT_ID,
          { reason: 'r', suspensionType: 'manual_admin' },
          ADMIN_ID,
        );
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(BadRequestException);
        const response = (err as BadRequestException).getResponse() as { code: string };
        expect(response.code).toBe('TENANT_ARCHIVED');
      }
    });

    it('11. throws TENANT_ALREADY_SUSPENDED if already suspended', async () => {
      tenantRepoFindOne.mockResolvedValue(
        buildTenant({ status: 'suspended' as TenantStatus }),
      );
      try {
        await service.suspend(
          TENANT_ID,
          { reason: 'r', suspensionType: 'manual_admin' },
          ADMIN_ID,
        );
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ConflictException);
        const response = (err as ConflictException).getResponse() as { code: string };
        expect(response.code).toBe('TENANT_ALREADY_SUSPENDED');
      }
    });

    it('12. throws INVALID_STATE_TRANSITION from pending_setup', async () => {
      tenantRepoFindOne.mockResolvedValue(
        buildTenant({ status: 'pending_setup' as TenantStatus }),
      );
      try {
        await service.suspend(
          TENANT_ID,
          { reason: 'r', suspensionType: 'manual_admin' },
          ADMIN_ID,
        );
        expect.fail('should have thrown');
      } catch (err) {
        const response = (err as BadRequestException).getResponse() as { code: string };
        expect(response.code).toBe('TENANT_INVALID_STATE_TRANSITION');
      }
    });

    it('13. clears previous reactivation fields on suspend', async () => {
      tenantRepoFindOne.mockResolvedValue(
        buildTenant({
          reactivatedAt: new Date('2026-01-01'),
          reactivationReason: 'old reactivation',
        }),
      );
      await service.suspend(
        TENANT_ID,
        { reason: 'r', suspensionType: 'manual_admin' },
        ADMIN_ID,
      );
      const saved = tenantRepoSave.mock.calls[0]![0];
      expect(saved.reactivatedAt).toBeNull();
      expect(saved.reactivationReason).toBeNull();
    });

    it('14. invalidates sessions via Redis scan + del', async () => {
      tenantRepoFindOne.mockResolvedValue(buildTenant());
      const sessionKeys = [`sessions:user:u1:tenant:${TENANT_ID}:s1`];
      redis.scanStream.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield sessionKeys;
        },
      });
      await service.suspend(
        TENANT_ID,
        { reason: 'r', suspensionType: 'compliance_violation' },
        ADMIN_ID,
      );
      expect(redis.del).toHaveBeenCalledWith(...sessionKeys);
    });

    it('15. revokes active cross-tenant authorizations granted by tenant', async () => {
      tenantRepoFindOne.mockResolvedValue(buildTenant());
      const future = new Date();
      future.setDate(future.getDate() + 5);
      vi.mocked(crossTenantAuthz.listGrantedBy).mockResolvedValue([
        {
          id: 'authz-1',
          type: CrossTenantAuthorizationType.BrokerToGarageAssignment,
          fromTenantId: TENANT_ID,
          toTenantId: 'other',
          scope: ['read.sinistre'],
          grantedByUserId: ADMIN_ID,
          grantedAt: new Date(),
          expiresAt: future,
          metadata: {},
        },
      ]);
      await service.suspend(
        TENANT_ID,
        { reason: 'r', suspensionType: 'payment_failure' },
        ADMIN_ID,
      );
      expect(crossTenantAuthz.revoke).toHaveBeenCalledWith(
        'authz-1',
        expect.stringContaining('tenant_suspended'),
        ADMIN_ID,
      );
    });
  });

  // ==========================================================================
  // REACTIVATE
  // ==========================================================================

  describe('reactivate', () => {
    it('16. transitions suspended -> active', async () => {
      tenantRepoFindOne.mockResolvedValue(
        buildTenant({
          status: 'suspended' as TenantStatus,
          suspendedAt: new Date(),
          suspensionType: 'payment_failure',
          suspensionReason: 'late',
        }),
      );
      const result = await service.reactivate(TENANT_ID, 'payment received', ADMIN_ID);
      expect(result.status).toBe('active');
      expect(result.reactivationReason).toBe('payment received');
    });

    it('17. preserves suspendedAt/Reason for audit history', async () => {
      const suspendedDate = new Date('2026-01-15');
      tenantRepoFindOne.mockResolvedValue(
        buildTenant({
          status: 'suspended' as TenantStatus,
          suspendedAt: suspendedDate,
          suspensionType: 'manual_admin',
          suspensionReason: 'customer pause',
        }),
      );
      const result = await service.reactivate(TENANT_ID, 'resume request', ADMIN_ID);
      expect(result.suspendedAt).toEqual(suspendedDate);
      expect(result.suspensionType).toBe('manual_admin');
      expect(result.suspensionReason).toBe('customer pause');
    });

    it('18. throws TENANT_NOT_SUSPENDED when status active', async () => {
      tenantRepoFindOne.mockResolvedValue(buildTenant({ status: 'active' as TenantStatus }));
      try {
        await service.reactivate(TENANT_ID, 'r', ADMIN_ID);
        expect.fail('should have thrown');
      } catch (err) {
        const response = (err as BadRequestException).getResponse() as { code: string };
        expect(response.code).toBe('TENANT_NOT_SUSPENDED');
      }
    });

    it('19. throws TENANT_ARCHIVED when tenant archived', async () => {
      tenantRepoFindOne.mockResolvedValue(
        buildTenant({ status: 'archived' as TenantStatus, deletedAt: new Date() }),
      );
      await expect(service.reactivate(TENANT_ID, 'r', ADMIN_ID)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('20. throws NotFoundException when tenant absent', async () => {
      tenantRepoFindOne.mockResolvedValue(null);
      await expect(service.reactivate(TENANT_ID, 'r', ADMIN_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ==========================================================================
  // MARK PENDING SETUP / ACTIVE
  // ==========================================================================

  describe('markPendingSetup', () => {
    it('21. transitions active -> pending_setup (rarely used but allowed test)', async () => {
      // This transition is technically not in the allowed list (active does not go
      // back to pending_setup), so service should reject silently.
      tenantRepoFindOne.mockResolvedValue(buildTenant({ status: 'active' as TenantStatus }));
      await service.markPendingSetup(TENANT_ID);
      expect(tenantRepoSave).not.toHaveBeenCalled();
    });

    it('22. no-op when tenant missing', async () => {
      tenantRepoFindOne.mockResolvedValue(null);
      await service.markPendingSetup(TENANT_ID);
      expect(tenantRepoSave).not.toHaveBeenCalled();
    });
  });

  describe('markActive', () => {
    it('23. transitions pending_setup -> active', async () => {
      tenantRepoFindOne.mockResolvedValue(
        buildTenant({ status: 'pending_setup' as TenantStatus }),
      );
      await service.markActive(TENANT_ID);
      const saved = tenantRepoSave.mock.calls[0]![0];
      expect(saved.status).toBe('active');
    });

    it('24. idempotent when already active', async () => {
      tenantRepoFindOne.mockResolvedValue(buildTenant({ status: 'active' as TenantStatus }));
      await service.markActive(TENANT_ID);
      expect(tenantRepoSave).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // QUERIES
  // ==========================================================================

  describe('listSuspended', () => {
    it('25. returns list of suspended tenants', async () => {
      tenantRepoFind.mockResolvedValue([
        buildTenant({ status: 'suspended' as TenantStatus, suspensionType: 'payment_failure' }),
      ]);
      const result = await service.listSuspended();
      expect(result).toHaveLength(1);
      expect(result[0]?.status).toBe('suspended');
    });
  });

  describe('getSuspensionDetails', () => {
    it('26. returns suspension details for a tenant', async () => {
      tenantRepoFindOne.mockResolvedValue(
        buildTenant({
          status: 'suspended' as TenantStatus,
          suspensionType: 'compliance_violation',
          suspensionReason: 'ACAPS report',
        }),
      );
      const result = await service.getSuspensionDetails(TENANT_ID);
      expect(result.suspensionType).toBe('compliance_violation');
      expect(result.suspensionReason).toBe('ACAPS report');
    });

    it('27. throws NotFoundException when absent', async () => {
      tenantRepoFindOne.mockResolvedValue(null);
      await expect(service.getSuspensionDetails(TENANT_ID)).rejects.toThrow(NotFoundException);
    });
  });
});
