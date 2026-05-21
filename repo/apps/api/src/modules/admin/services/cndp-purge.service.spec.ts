/**
 * Tests unitaires CndpPurgeService -- workflow + state machine.
 *
 * Reference : Sprint 6 / Tache 2.2.12.
 */

import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { AuthTenant, AuthUser, DataSource } from '@insurtech/database';
import type Redis from 'ioredis';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { InitiatePurgeRequestDto } from '../dto/cndp-purge.dto.js';
import type { PurgeRequest } from '../types/cndp-purge.type.js';
import { CndpPurgeService } from './cndp-purge.service.js';

const TENANT_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';
const ADMIN_ID = '99999999-9999-4999-8999-999999999999';

describe('CndpPurgeService', () => {
  let service: CndpPurgeService;
  let dataSource: DataSource;
  let redis: {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    sadd: ReturnType<typeof vi.fn>;
    srem: ReturnType<typeof vi.fn>;
    smembers: ReturnType<typeof vi.fn>;
  };
  let tenantRepoFindOne: ReturnType<typeof vi.fn>;
  let userRepoFindOne: ReturnType<typeof vi.fn>;
  let storedRequests: Map<string, string>;

  beforeEach(() => {
    storedRequests = new Map();
    redis = {
      get: vi.fn(async (key: string) => storedRequests.get(key) ?? null),
      set: vi.fn(async (key: string, value: string) => {
        storedRequests.set(key, value);
        return 'OK';
      }),
      sadd: vi.fn().mockResolvedValue(1),
      srem: vi.fn().mockResolvedValue(1),
      smembers: vi.fn().mockResolvedValue([]),
    };

    tenantRepoFindOne = vi.fn().mockResolvedValue({
      id: TENANT_ID,
      name: 'T',
      type: 'broker',
      settings: {},
      deletedAt: null,
    } as Partial<AuthTenant>);
    userRepoFindOne = vi.fn().mockResolvedValue({
      id: USER_ID,
      tenantId: TENANT_ID,
      email: 'u@x.ma',
    } as Partial<AuthUser>);

    dataSource = {
      getRepository: vi.fn((entity: { name?: string } | unknown) => {
        const name = (entity as { name?: string })?.name;
        if (name === 'AuthTenant') return { findOne: tenantRepoFindOne };
        if (name === 'AuthUser') return { findOne: userRepoFindOne };
        throw new Error(`unexpected entity ${String(name)}`);
      }),
      transaction: vi.fn(async (cb: (em: unknown) => Promise<unknown>) =>
        cb({
          createQueryBuilder: vi.fn(() => ({
            softDelete: vi.fn().mockReturnThis(),
            delete: vi.fn().mockReturnThis(),
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            execute: vi.fn().mockResolvedValue({ affected: 1 }),
          })),
        }),
      ),
    } as unknown as DataSource;

    service = new CndpPurgeService(dataSource, redis as unknown as Redis);
  });

  // ==========================================================================
  // INITIATE
  // ==========================================================================

  describe('initiate', () => {
    const baseDto: InitiatePurgeRequestDto = {
      tenantId: TENANT_ID,
      requestType: 'user_data',
      targetUserId: USER_ID,
      requestedByEmail: 'requester@example.ma',
      reason: 'GDPR right to be forgotten requested by data subject',
    };

    it('1. creates pending request', async () => {
      const result = await service.initiate(baseDto, ADMIN_ID);
      expect(result.status).toBe('pending');
      expect(result.tenantId).toBe(TENANT_ID);
      expect(result.targetUserId).toBe(USER_ID);
      expect(redis.set).toHaveBeenCalled();
      expect(redis.sadd).toHaveBeenCalled();
    });

    it('2. throws NotFoundException when tenant absent', async () => {
      tenantRepoFindOne.mockResolvedValue(null);
      await expect(service.initiate(baseDto, ADMIN_ID)).rejects.toThrow(NotFoundException);
    });

    it('3. throws NotFoundException when user not in tenant (user_data)', async () => {
      userRepoFindOne.mockResolvedValue(null);
      await expect(service.initiate(baseDto, ADMIN_ID)).rejects.toThrow(NotFoundException);
    });

    it('4. full_tenant skip user check', async () => {
      const fullDto: InitiatePurgeRequestDto = {
        tenantId: TENANT_ID,
        requestType: 'full_tenant',
        requestedByEmail: 'requester@example.ma',
        reason: 'Full tenant data deletion requested',
      };
      const result = await service.initiate(fullDto, ADMIN_ID);
      expect(result.requestType).toBe('full_tenant');
      expect(result.targetUserId).toBeNull();
    });
  });

  // ==========================================================================
  // VALIDATE
  // ==========================================================================

  describe('validate', () => {
    let createdId: string;
    beforeEach(async () => {
      const r = await service.initiate(
        {
          tenantId: TENANT_ID,
          requestType: 'user_data',
          targetUserId: USER_ID,
          requestedByEmail: 'req@example.ma',
          reason: 'GDPR test',
        },
        ADMIN_ID,
      );
      createdId = r.id;
    });

    it('5. transitions pending -> in_grace_period', async () => {
      const result = await service.validate(createdId, ADMIN_ID);
      expect(result.status).toBe('in_grace_period');
      expect(result.validatedAt).toBeInstanceOf(Date);
      expect(result.graceEndsAt).toBeInstanceOf(Date);
    });

    it('6. sets graceEndsAt 30 days after validation', async () => {
      const result = await service.validate(createdId, ADMIN_ID);
      const diffDays =
        ((result.graceEndsAt as Date).getTime() - (result.validatedAt as Date).getTime()) /
        (1000 * 60 * 60 * 24);
      expect(diffDays).toBeCloseTo(30, 0);
    });

    it('7. throws ConflictException if already validated', async () => {
      await service.validate(createdId, ADMIN_ID);
      await expect(service.validate(createdId, ADMIN_ID)).rejects.toThrow(ConflictException);
    });

    it('8. throws NotFoundException when request not exist', async () => {
      await expect(service.validate('99999999-9999-4999-8999-999999999999', ADMIN_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ==========================================================================
  // EXECUTE
  // ==========================================================================

  describe('execute', () => {
    let createdId: string;
    beforeEach(async () => {
      const r = await service.initiate(
        {
          tenantId: TENANT_ID,
          requestType: 'user_data',
          targetUserId: USER_ID,
          requestedByEmail: 'req@example.ma',
          reason: 'GDPR test execute',
        },
        ADMIN_ID,
      );
      createdId = r.id;
    });

    it('9. throws if not validated yet', async () => {
      await expect(service.execute(createdId, ADMIN_ID)).rejects.toThrow(BadRequestException);
    });

    it('10. throws GRACE_PERIOD_NOT_ELAPSED if validated but within grace', async () => {
      await service.validate(createdId, ADMIN_ID);
      try {
        await service.execute(createdId, ADMIN_ID);
        expect.fail('should have thrown');
      } catch (err) {
        const response = (err as BadRequestException).getResponse() as { code: string };
        expect(response.code).toBe('CNDP_PURGE_GRACE_PERIOD_NOT_ELAPSED');
      }
    });

    it('11. executes if grace period elapsed', async () => {
      await service.validate(createdId, ADMIN_ID);
      // Hack : retrieve request from Redis store, antedate graceEndsAt.
      const raw = storedRequests.get(`cndp:purge:request:${createdId}`);
      const parsed = JSON.parse(raw!) as PurgeRequest;
      const past = new Date(Date.now() - 1000);
      const antedated = { ...parsed, graceEndsAt: past };
      storedRequests.set(`cndp:purge:request:${createdId}`, JSON.stringify(antedated));

      const result = await service.execute(createdId, ADMIN_ID);
      expect(result.status).toBe('completed');
      expect(result.executedAt).toBeInstanceOf(Date);
      expect(result.affectedRecords).toBeDefined();
    });
  });

  // ==========================================================================
  // CANCEL
  // ==========================================================================

  describe('cancel', () => {
    let createdId: string;
    beforeEach(async () => {
      const r = await service.initiate(
        {
          tenantId: TENANT_ID,
          requestType: 'user_data',
          targetUserId: USER_ID,
          requestedByEmail: 'req@example.ma',
          reason: 'GDPR cancel test',
        },
        ADMIN_ID,
      );
      createdId = r.id;
    });

    it('12. cancels pending request', async () => {
      const result = await service.cancel(createdId, { reason: 'mistake' }, ADMIN_ID);
      expect(result.status).toBe('cancelled');
      expect(redis.srem).toHaveBeenCalled();
    });

    it('13. throws if already cancelled', async () => {
      await service.cancel(createdId, { reason: 'mistake' }, ADMIN_ID);
      await expect(
        service.cancel(createdId, { reason: 'again' }, ADMIN_ID),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ==========================================================================
  // LIST
  // ==========================================================================

  describe('listPending', () => {
    it('14. returns sorted requests', async () => {
      const r1 = await service.initiate(
        {
          tenantId: TENANT_ID,
          requestType: 'user_data',
          targetUserId: USER_ID,
          requestedByEmail: 'a@x.ma',
          reason: 'GDPR test list 1',
        },
        ADMIN_ID,
      );
      const r2 = await service.initiate(
        {
          tenantId: TENANT_ID,
          requestType: 'user_data',
          targetUserId: USER_ID,
          requestedByEmail: 'b@x.ma',
          reason: 'GDPR test list 2',
        },
        ADMIN_ID,
      );
      redis.smembers.mockResolvedValue([r1.id, r2.id]);
      const result = await service.listPending();
      expect(result.length).toBe(2);
    });

    it('15. removes stale index entries', async () => {
      redis.smembers.mockResolvedValue(['stale-id-1234']);
      const result = await service.listPending();
      expect(result).toEqual([]);
      expect(redis.srem).toHaveBeenCalledWith('cndp:purge:pending-index', 'stale-id-1234');
    });
  });
});
