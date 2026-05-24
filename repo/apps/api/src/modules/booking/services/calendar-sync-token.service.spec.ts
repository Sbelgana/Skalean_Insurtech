/**
 * Tests CalendarSyncTokenService -- Sprint 8 Tache 8.10 (foundation only).
 *
 * Unit tests avec DataSource mock. Encryption transparente via TypeORM
 * ValueTransformer testee separement (encrypted-column.transformer.spec.ts).
 *
 * Integration tests (live DB + real transformer round-trip) Sprint 8.14.
 */

import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { TenantContextService, type TenantContext } from '@insurtech/auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CALENDAR_SYNC_ERROR_CODES,
  CalendarSyncTokenService,
} from './calendar-sync-token.service.js';

const TENANT_A = '00000000-0000-0000-0000-000000000001';
const USER_A = '00000000-0000-0000-0000-000000000002';
const SYNC_ID = '00000000-0000-0000-0000-000000000700';

function buildTenantContext(tenantId: string | undefined): TenantContextService {
  return {
    getCurrentContext: (): TenantContext | undefined =>
      tenantId
        ? {
            tenantId,
            userId: USER_A,
            userRole: undefined,
            isSuperAdmin: false,
            traceId: 'trc',
            ipAddress: '127.0.0.1',
            userAgent: 'vitest',
          }
        : undefined,
  } as unknown as TenantContextService;
}

interface RepoStub {
  create: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
  find: ReturnType<typeof vi.fn>;
  findOne: ReturnType<typeof vi.fn>;
  createQueryBuilder: ReturnType<typeof vi.fn>;
}

function buildQb(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue(undefined),
    getMany: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

function buildRepo(overrides: Partial<RepoStub> = {}): RepoStub {
  return {
    create: vi.fn((data) => ({ ...data, id: 'sync-1' })),
    save: vi.fn((entity) =>
      Promise.resolve({
        ...entity,
        id: entity?.id ?? 'sync-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ),
    find: vi.fn().mockResolvedValue([]),
    findOne: vi.fn().mockResolvedValue(null),
    createQueryBuilder: vi.fn(() => buildQb()),
    ...overrides,
  };
}

function buildService(
  repo: RepoStub = buildRepo(),
  tenantId: string | undefined = TENANT_A,
): CalendarSyncTokenService {
  const dataSource = { getRepository: vi.fn(() => repo) };
  return new CalendarSyncTokenService(dataSource as never, buildTenantContext(tenantId));
}

const baseSaveDto = {
  provider: 'google' as const,
  providerAccountId: 'user@gmail.com',
  accessToken: 'ya29.access-token-value',
  refreshToken: '1//refresh-token-value',
  tokenExpiresAt: new Date('2026-02-01T10:00:00Z'),
  scope: 'https://www.googleapis.com/auth/calendar',
};

describe('CalendarSyncTokenService (Sprint 8 Tache 8.10 foundation)', () => {
  beforeEach(() => {
    delete process.env['CALENDAR_SYNC_AUTO_DISABLE_THRESHOLD'];
  });

  describe('saveTokens', () => {
    it('1. throws TENANT_REQUIRED if no tenant context', async () => {
      // Empty string bypasses TS default-parameter substitution + trips the
      // falsy ternary inside buildTenantContext. (Task 8.14 mock-subtlety fix.)
      const service = buildService(buildRepo(), '');
      await expect(service.saveTokens(USER_A, baseSaveDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('2. creates new token row when none exists', async () => {
      const repo = buildRepo();
      const service = buildService(repo);
      await service.saveTokens(USER_A, baseSaveDto);
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT_A,
          userId: USER_A,
          provider: 'google',
          providerAccountId: 'user@gmail.com',
          accessToken: 'ya29.access-token-value',
          refreshToken: '1//refresh-token-value',
          syncEnabled: true,
          consecutiveFailures: 0,
        }),
      );
    });

    it('3. updates existing tokens on re-auth (reset failures + re-enable)', async () => {
      const repo = buildRepo({
        findOne: vi.fn().mockResolvedValue({
          id: SYNC_ID,
          tenantId: TENANT_A,
          userId: USER_A,
          provider: 'google',
          providerAccountId: 'user@gmail.com',
          consecutiveFailures: 3,
          syncEnabled: false,
        }),
      });
      const service = buildService(repo);
      await service.saveTokens(USER_A, baseSaveDto);
      // save was called with reset failures + re-enabled
      const saved = (repo.save as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as {
        consecutiveFailures?: number;
        syncEnabled?: boolean;
        accessToken?: string;
      };
      expect(saved.consecutiveFailures).toBe(0);
      expect(saved.syncEnabled).toBe(true);
      expect(saved.accessToken).toBe('ya29.access-token-value');
    });
  });

  describe('lookup', () => {
    it('4. findByUser returns rows filtered by tenant + user', async () => {
      const repo = buildRepo({
        find: vi.fn().mockResolvedValue([
          { id: 'sync-1', provider: 'google' },
          { id: 'sync-2', provider: 'outlook' },
        ]),
      });
      const service = buildService(repo);
      const result = await service.findByUser(USER_A);
      expect(result).toHaveLength(2);
      expect(repo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: TENANT_A, userId: USER_A },
        }),
      );
    });

    it('5. findActiveByUserProvider returns row with syncEnabled=true', async () => {
      const repo = buildRepo({
        findOne: vi.fn().mockResolvedValue({
          id: SYNC_ID,
          provider: 'google',
          syncEnabled: true,
        }),
      });
      const service = buildService(repo);
      const result = await service.findActiveByUserProvider(USER_A, 'google');
      expect(result?.id).toBe(SYNC_ID);
      expect(repo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: TENANT_A, userId: USER_A, provider: 'google', syncEnabled: true },
        }),
      );
    });

    it('6. findById throws NotFound when missing', async () => {
      const repo = buildRepo({ findOne: vi.fn().mockResolvedValue(null) });
      const service = buildService(repo);
      await expect(service.findById('missing')).rejects.toThrow(NotFoundException);
    });

    it('7. findByWebhookSubscriptionId queries without tenant filter (webhook receivers unauthenticated)', async () => {
      const repo = buildRepo({
        findOne: vi.fn().mockResolvedValue({ id: SYNC_ID, provider: 'google' }),
      });
      const service = buildService(repo);
      await service.findByWebhookSubscriptionId('google-channel-abc123');
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { webhookSubscriptionId: 'google-channel-abc123' },
      });
    });
  });

  describe('webhook subscriptions', () => {
    it('8. saveWebhookSubscription updates 3 webhook columns', async () => {
      const qb = buildQb();
      const repo = buildRepo({
        findOne: vi.fn().mockResolvedValue({
          id: SYNC_ID,
          tenantId: TENANT_A,
          provider: 'google',
        }),
        createQueryBuilder: vi.fn(() => qb),
      });
      const service = buildService(repo);
      const expiresAt = new Date('2026-02-08T00:00:00Z');
      await service.saveWebhookSubscription(SYNC_ID, {
        webhookSubscriptionId: 'channel-abc123',
        webhookResourceId: 'resource-xyz',
        webhookExpiresAt: expiresAt,
      });
      expect(qb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          webhook_subscription_id: 'channel-abc123',
          webhook_resource_id: 'resource-xyz',
          webhook_expires_at: expiresAt,
        }),
      );
    });

    it('9. findWebhooksExpiringWithin filters by threshold + active', async () => {
      const qb = buildQb({ getMany: vi.fn().mockResolvedValue([]) });
      const repo = buildRepo({ createQueryBuilder: vi.fn(() => qb) });
      const service = buildService(repo);
      await service.findWebhooksExpiringWithin(24);
      expect(qb.where).toHaveBeenCalledWith('s.sync_enabled = true');
      expect(qb.andWhere).toHaveBeenCalledWith('s.webhook_expires_at IS NOT NULL');
      // verify threshold parameter binding
      const thresholdCall = (qb.andWhere as ReturnType<typeof vi.fn>).mock.calls.find(
        (c) => String(c[0]).includes(':threshold'),
      );
      expect(thresholdCall).toBeDefined();
    });
  });

  describe('recordSyncOutcome', () => {
    it('10. success resets consecutive_failures to 0', async () => {
      let call = 0;
      const repo = buildRepo();
      repo.findOne = vi.fn(() => {
        call++;
        return Promise.resolve({
          id: SYNC_ID,
          tenantId: TENANT_A,
          provider: 'google',
          consecutiveFailures: call === 1 ? 3 : 0,
          syncEnabled: true,
          lastSyncStatus: call === 1 ? null : 'success',
        });
      });
      const qb = buildQb();
      repo.createQueryBuilder = vi.fn(() => qb);
      const service = buildService(repo);
      const result = await service.recordSyncOutcome(SYNC_ID, { status: 'success' });
      const setCall = (qb.set as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as {
        consecutive_failures?: number;
        last_sync_status?: string;
      };
      expect(setCall.consecutive_failures).toBe(0);
      expect(setCall.last_sync_status).toBe('success');
      expect(result.consecutiveFailures).toBe(0);
    });

    it('11. failure increments consecutive_failures', async () => {
      let call = 0;
      const repo = buildRepo();
      repo.findOne = vi.fn(() => {
        call++;
        return Promise.resolve({
          id: SYNC_ID,
          tenantId: TENANT_A,
          consecutiveFailures: call === 1 ? 2 : 3,
          syncEnabled: true,
        });
      });
      const qb = buildQb();
      repo.createQueryBuilder = vi.fn(() => qb);
      const service = buildService(repo);
      await service.recordSyncOutcome(SYNC_ID, { status: 'failed', error: 'oauth expired' });
      const setCall = (qb.set as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as {
        consecutive_failures?: number;
        last_sync_error?: string;
        sync_enabled?: boolean;
      };
      expect(setCall.consecutive_failures).toBe(3);
      expect(setCall.last_sync_error).toBe('oauth expired');
      // Not yet at threshold (default 5)
      expect(setCall.sync_enabled).toBeUndefined();
    });

    it('12. failure at threshold auto-disables sync', async () => {
      let call = 0;
      const repo = buildRepo();
      repo.findOne = vi.fn(() => {
        call++;
        return Promise.resolve({
          id: SYNC_ID,
          tenantId: TENANT_A,
          // Currently at threshold-1; this failure pushes to threshold
          consecutiveFailures: call === 1 ? 4 : 5,
          syncEnabled: call === 1 ? true : false,
        });
      });
      const qb = buildQb();
      repo.createQueryBuilder = vi.fn(() => qb);
      const service = buildService(repo);
      await service.recordSyncOutcome(SYNC_ID, { status: 'failed' });
      const setCall = (qb.set as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as {
        consecutive_failures?: number;
        sync_enabled?: boolean;
      };
      expect(setCall.consecutive_failures).toBe(5);
      expect(setCall.sync_enabled).toBe(false);
    });

    it('13. custom threshold via env var', async () => {
      process.env['CALENDAR_SYNC_AUTO_DISABLE_THRESHOLD'] = '2';
      let call = 0;
      const repo = buildRepo();
      repo.findOne = vi.fn(() => {
        call++;
        return Promise.resolve({
          id: SYNC_ID,
          tenantId: TENANT_A,
          consecutiveFailures: call === 1 ? 1 : 2,
          syncEnabled: call === 1 ? true : false,
        });
      });
      const qb = buildQb();
      repo.createQueryBuilder = vi.fn(() => qb);
      const service = buildService(repo);
      await service.recordSyncOutcome(SYNC_ID, { status: 'failed' });
      const setCall = (qb.set as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as {
        sync_enabled?: boolean;
      };
      expect(setCall.sync_enabled).toBe(false); // threshold=2 reached
    });
  });

  describe('enable / disable', () => {
    it('14. disable sets sync_enabled=false', async () => {
      const repo = buildRepo({
        findOne: vi.fn().mockResolvedValue({
          id: SYNC_ID,
          tenantId: TENANT_A,
          provider: 'google',
          syncEnabled: true,
        }),
      });
      const service = buildService(repo);
      await service.disable(SYNC_ID);
      expect(repo.createQueryBuilder).toHaveBeenCalled();
    });

    it('15. disable rejects already-disabled', async () => {
      const repo = buildRepo({
        findOne: vi.fn().mockResolvedValue({
          id: SYNC_ID,
          tenantId: TENANT_A,
          provider: 'google',
          syncEnabled: false,
        }),
      });
      const service = buildService(repo);
      try {
        await service.disable(SYNC_ID);
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ConflictException);
        const res = (err as ConflictException).getResponse() as { code?: string };
        expect(res.code).toBe(CALENDAR_SYNC_ERROR_CODES.ALREADY_DISABLED);
      }
    });

    it('16. enable sets sync_enabled=true + resets failures', async () => {
      const repo = buildRepo({
        findOne: vi.fn().mockResolvedValue({
          id: SYNC_ID,
          tenantId: TENANT_A,
          provider: 'outlook',
          syncEnabled: false,
        }),
      });
      const qb = buildQb();
      repo.createQueryBuilder = vi.fn(() => qb);
      const service = buildService(repo);
      await service.enable(SYNC_ID);
      const setCall = (qb.set as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as {
        sync_enabled?: boolean;
        consecutive_failures?: number;
      };
      expect(setCall.sync_enabled).toBe(true);
      expect(setCall.consecutive_failures).toBe(0);
    });

    it('17. enable is idempotent when already enabled', async () => {
      const repo = buildRepo({
        findOne: vi.fn().mockResolvedValue({
          id: SYNC_ID,
          tenantId: TENANT_A,
          syncEnabled: true,
        }),
      });
      const service = buildService(repo);
      await service.enable(SYNC_ID); // no-op
      expect(repo.createQueryBuilder).not.toHaveBeenCalled();
    });
  });

  describe('decryption accessors', () => {
    it('18. getDecryptedAccessTokenById returns plaintext when enabled', async () => {
      const repo = buildRepo({
        findOne: vi.fn().mockResolvedValue({
          id: SYNC_ID,
          tenantId: TENANT_A,
          accessToken: 'plaintext-access',
          syncEnabled: true,
        }),
      });
      const service = buildService(repo);
      const token = await service.getDecryptedAccessTokenById(SYNC_ID);
      expect(token).toBe('plaintext-access');
    });

    it('19. getDecryptedAccessTokenById returns null when disabled', async () => {
      const repo = buildRepo({
        findOne: vi.fn().mockResolvedValue({
          id: SYNC_ID,
          tenantId: TENANT_A,
          accessToken: 'plaintext-access',
          syncEnabled: false,
        }),
      });
      const service = buildService(repo);
      const token = await service.getDecryptedAccessTokenById(SYNC_ID);
      expect(token).toBeNull();
    });
  });

  describe('connection info DTO', () => {
    it('20. toConnectionInfo strips tokens, keeps metadata only', () => {
      const service = buildService();
      const dto = service.toConnectionInfo({
        id: SYNC_ID,
        provider: 'google',
        providerAccountId: 'user@gmail.com',
        syncEnabled: true,
        scope: 'cal.read',
        tokenExpiresAt: null,
        lastSyncAt: null,
        lastSyncStatus: 'success',
        lastSyncError: null,
        webhookExpiresAt: null,
        consecutiveFailures: 0,
        // sensitive fields purposefully present in source
        accessToken: 'should-not-appear',
        refreshToken: 'should-not-appear',
      } as never);
      const json = JSON.stringify(dto);
      expect(json).not.toContain('should-not-appear');
      expect(dto.id).toBe(SYNC_ID);
    });
  });

  describe('error codes constant', () => {
    it('21. exposes expected error codes', () => {
      expect(CALENDAR_SYNC_ERROR_CODES.NOT_FOUND).toBe('CALENDAR_SYNC_NOT_FOUND');
      expect(CALENDAR_SYNC_ERROR_CODES.ALREADY_DISABLED).toBe(
        'CALENDAR_SYNC_ALREADY_DISABLED',
      );
    });
  });
});
