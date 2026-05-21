/**
 * Tests unitaires TenantOnboardingService.
 *
 * Reference : Sprint 6 / Tache 2.2.8.
 */

import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { Argon2Service } from '@insurtech/auth';
import type { AuthUser, DataSource } from '@insurtech/database';
import type Redis from 'ioredis';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EmailService } from '../../auth/email.service.js';
import type { CompleteOnboardingDto, InitiateOnboardingDto } from '../dto/onboarding.dto.js';
import {
  ONBOARDING_TOKEN_TTL_SECONDS,
  PENDING_PASSWORD_HASH_PLACEHOLDER,
} from '../types/onboarding.type.js';
import type { TenantManagementService } from './tenant-management.service.js';
import { TenantOnboardingService } from './tenant-onboarding.service.js';

const TENANT_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';
const ADMIN_ID = '99999999-9999-4999-8999-999999999999';

describe('TenantOnboardingService', () => {
  let service: TenantOnboardingService;
  let dataSource: DataSource;
  let redis: {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    del: ReturnType<typeof vi.fn>;
    incr: ReturnType<typeof vi.fn>;
    expire: ReturnType<typeof vi.fn>;
  };
  let emailService: EmailService;
  let argon2: Argon2Service;
  let tenantManagement: TenantManagementService;
  let userRepoFindOne: ReturnType<typeof vi.fn>;
  let txEntityManager: {
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    redis = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue('OK'),
      del: vi.fn().mockResolvedValue(1),
      incr: vi.fn().mockResolvedValue(1),
      expire: vi.fn().mockResolvedValue(1),
    };

    userRepoFindOne = vi.fn().mockResolvedValue(null);

    txEntityManager = {
      create: vi.fn((_entity, data) => ({ id: USER_ID, ...data })),
      save: vi.fn(async (_entity, value) => value),
      findOne: vi.fn(),
    };

    dataSource = {
      getRepository: vi.fn(() => ({ findOne: userRepoFindOne })),
      transaction: vi.fn(async (cb: (em: unknown) => Promise<unknown>) => cb(txEntityManager)),
    } as unknown as DataSource;

    emailService = {
      sendVerification: vi.fn().mockResolvedValue(undefined),
      sendRecovery: vi.fn().mockResolvedValue(undefined),
      sendPasswordChanged: vi.fn().mockResolvedValue(undefined),
    } as unknown as EmailService;

    argon2 = {
      hash: vi.fn().mockResolvedValue('$argon2id$v=19$hashed'),
    } as unknown as Argon2Service;

    tenantManagement = {
      create: vi.fn().mockResolvedValue({
        id: TENANT_ID,
        name: 'Test Tenant',
        type: 'broker',
        status: 'active',
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      findById: vi.fn().mockResolvedValue({
        id: TENANT_ID,
        name: 'Test Tenant',
        type: 'broker',
        status: 'active',
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      archive: vi.fn().mockResolvedValue(undefined),
    } as unknown as TenantManagementService;

    service = new TenantOnboardingService(
      dataSource,
      redis as unknown as Redis,
      emailService,
      argon2,
      tenantManagement,
    );
  });

  // ==========================================================================
  // INITIATE
  // ==========================================================================

  describe('initiate', () => {
    const validDto: InitiateOnboardingDto = {
      tenant: { name: 'Acme Broker', type: 'broker' },
      admin: {
        email: 'admin@acme.ma',
        displayName: 'Admin Acme',
        locale: 'fr-MA',
      },
    };

    it('1. creates tenant + user + token + sends email', async () => {
      const result = await service.initiate(validDto, ADMIN_ID);
      expect(result.tenantId).toBe(TENANT_ID);
      expect(result.adminUserId).toBe(USER_ID);
      expect(result.emailSentTo).toBe('admin@acme.ma');
      expect(tenantManagement.create).toHaveBeenCalled();
      expect(emailService.sendVerification).toHaveBeenCalled();
    });

    it('2. throws ConflictException EMAIL_CONFLICT when email already exists', async () => {
      userRepoFindOne.mockResolvedValue({ id: 'other-user', email: 'admin@acme.ma' });
      try {
        await service.initiate(validDto, ADMIN_ID);
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ConflictException);
        const response = (err as ConflictException).getResponse() as { code: string };
        expect(response.code).toBe('ONBOARDING_EMAIL_CONFLICT');
      }
      expect(tenantManagement.create).not.toHaveBeenCalled();
    });

    it('3. stores token in Redis with TTL 7 days', async () => {
      await service.initiate(validDto, ADMIN_ID);
      const setCall = redis.set.mock.calls.find((c) =>
        String(c[0]).startsWith('onboarding:token:'),
      );
      expect(setCall).toBeDefined();
      expect(setCall?.[2]).toBe('EX');
      expect(setCall?.[3]).toBe(ONBOARDING_TOKEN_TTL_SECONDS);
    });

    it('4. rollback (archive tenant) when user create fails', async () => {
      vi.mocked(dataSource.transaction).mockImplementation(async () => {
        throw new Error('db boom');
      });
      await expect(service.initiate(validDto, ADMIN_ID)).rejects.toThrow('db boom');
      expect(tenantManagement.archive).toHaveBeenCalledWith(
        TENANT_ID,
        'onboarding_rollback',
        ADMIN_ID,
      );
    });

    it('5. continues despite email failure (user can resend later)', async () => {
      vi.mocked(emailService.sendVerification).mockRejectedValue(new Error('smtp down'));
      const result = await service.initiate(validDto, ADMIN_ID);
      expect(result.tenantId).toBe(TENANT_ID);
    });

    it('6. creates AuthTenantUser link with role=tenant_admin', async () => {
      await service.initiate(validDto, ADMIN_ID);
      const createCalls = txEntityManager.create.mock.calls;
      const linkCall = createCalls.find((c) => c[1].role === 'tenant_admin');
      expect(linkCall).toBeDefined();
      expect(linkCall?.[1].tenantId).toBe(TENANT_ID);
    });

    it('7. uses PENDING_PASSWORD_HASH_PLACEHOLDER for new user', async () => {
      await service.initiate(validDto, ADMIN_ID);
      const userCall = txEntityManager.create.mock.calls.find(
        (c) => c[1].passwordHash !== undefined,
      );
      expect(userCall?.[1].passwordHash).toBe(PENDING_PASSWORD_HASH_PLACEHOLDER);
    });
  });

  // ==========================================================================
  // COMPLETE
  // ==========================================================================

  describe('complete', () => {
    const tokenPayload = {
      tenantId: TENANT_ID,
      userId: USER_ID,
      email: 'admin@acme.ma',
      tenantName: 'Acme',
      issuedAt: Math.floor(Date.now() / 1000),
      expiresAt: Math.floor(Date.now() / 1000) + 86400,
    };

    const completeDto: CompleteOnboardingDto = {
      token: 'token-abc-1234567890abcd',
      password: 'StrongPass123!',
    };

    it('8. completes onboarding with valid token', async () => {
      redis.get
        .mockResolvedValueOnce(null) // used token
        .mockResolvedValueOnce(JSON.stringify(tokenPayload));
      txEntityManager.findOne.mockResolvedValue({
        id: USER_ID,
        passwordHash: PENDING_PASSWORD_HASH_PLACEHOLDER,
      } as AuthUser);

      const result = await service.complete(completeDto);
      expect(result.userId).toBe(USER_ID);
      expect(result.tenantId).toBe(TENANT_ID);
      expect(argon2.hash).toHaveBeenCalledWith('StrongPass123!');
    });

    it('9. throws TOKEN_USED if token in used set', async () => {
      redis.get.mockResolvedValueOnce('1');
      try {
        await service.complete(completeDto);
        expect.fail('should have thrown');
      } catch (err) {
        const response = (err as BadRequestException).getResponse() as { code: string };
        expect(response.code).toBe('ONBOARDING_TOKEN_USED');
      }
    });

    it('10. throws TOKEN_INVALID if token absent in Redis', async () => {
      redis.get.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      try {
        await service.complete(completeDto);
        expect.fail('should have thrown');
      } catch (err) {
        const response = (err as BadRequestException).getResponse() as { code: string };
        expect(response.code).toBe('ONBOARDING_TOKEN_INVALID');
      }
    });

    it('11. throws TOKEN_EXPIRED if token expired', async () => {
      const expired = { ...tokenPayload, expiresAt: Math.floor(Date.now() / 1000) - 10 };
      redis.get
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(JSON.stringify(expired));
      try {
        await service.complete(completeDto);
        expect.fail('should have thrown');
      } catch (err) {
        const response = (err as BadRequestException).getResponse() as { code: string };
        expect(response.code).toBe('ONBOARDING_TOKEN_EXPIRED');
      }
    });

    it('12. throws PASSWORD_WEAK if argon2.hash rejects', async () => {
      redis.get
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(JSON.stringify(tokenPayload));
      vi.mocked(argon2.hash).mockRejectedValue(new Error('password in banlist'));
      await expect(service.complete(completeDto)).rejects.toThrow(BadRequestException);
    });

    it('13. throws when user not pending (already onboarded)', async () => {
      redis.get
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(JSON.stringify(tokenPayload));
      txEntityManager.findOne.mockResolvedValue({
        id: USER_ID,
        passwordHash: '$argon2id$v=19$real',
      } as AuthUser);

      await expect(service.complete(completeDto)).rejects.toBeInstanceOf(ConflictException);
    });

    it('14. marks token used and deletes original after success', async () => {
      redis.get
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(JSON.stringify(tokenPayload));
      txEntityManager.findOne.mockResolvedValue({
        id: USER_ID,
        passwordHash: PENDING_PASSWORD_HASH_PLACEHOLDER,
      } as AuthUser);

      await service.complete(completeDto);
      expect(redis.set).toHaveBeenCalledWith(
        expect.stringContaining('onboarding:token-used:'),
        '1',
        'EX',
        ONBOARDING_TOKEN_TTL_SECONDS,
      );
      expect(redis.del).toHaveBeenCalledWith(
        expect.stringContaining('onboarding:token:'),
      );
    });
  });

  // ==========================================================================
  // VERIFY TOKEN
  // ==========================================================================

  describe('verifyToken', () => {
    const payload = {
      tenantId: TENANT_ID,
      userId: USER_ID,
      email: 'admin@acme.ma',
      tenantName: 'Acme',
      issuedAt: Math.floor(Date.now() / 1000),
      expiresAt: Math.floor(Date.now() / 1000) + 86400,
    };

    it('15. returns valid+masked email for active token', async () => {
      redis.get.mockResolvedValueOnce(null).mockResolvedValueOnce(JSON.stringify(payload));
      const result = await service.verifyToken('some-token');
      expect(result.valid).toBe(true);
      expect(result.tenantName).toBe('Acme');
      expect(result.emailMasked).toBe('ad***@acme.ma');
    });

    it('16. returns USED when token in used set', async () => {
      redis.get.mockResolvedValueOnce('1');
      const result = await service.verifyToken('some-token');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('USED');
    });

    it('17. returns NOT_FOUND for unknown token', async () => {
      const result = await service.verifyToken('some-token');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('NOT_FOUND');
    });

    it('18. returns EXPIRED for expired payload', async () => {
      const expired = { ...payload, expiresAt: Math.floor(Date.now() / 1000) - 5 };
      redis.get.mockResolvedValueOnce(null).mockResolvedValueOnce(JSON.stringify(expired));
      const result = await service.verifyToken('some-token');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('EXPIRED');
    });
  });

  // ==========================================================================
  // RESEND
  // ==========================================================================

  describe('resendInvitation', () => {
    it('19. resends invitation + generates new token', async () => {
      userRepoFindOne.mockResolvedValue({
        id: USER_ID,
        email: 'admin@acme.ma',
        displayName: 'A',
        tenantId: TENANT_ID,
        passwordHash: PENDING_PASSWORD_HASH_PLACEHOLDER,
      } as AuthUser);

      const result = await service.resendInvitation(TENANT_ID, ADMIN_ID);
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(emailService.sendVerification).toHaveBeenCalled();
    });

    it('20. throws when no pending user found', async () => {
      userRepoFindOne.mockResolvedValue(null);
      await expect(service.resendInvitation(TENANT_ID, ADMIN_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('21. rate-limited to 3/h via Redis INCR', async () => {
      userRepoFindOne.mockResolvedValue({
        id: USER_ID,
        email: 'admin@acme.ma',
        displayName: 'A',
        tenantId: TENANT_ID,
        passwordHash: PENDING_PASSWORD_HASH_PLACEHOLDER,
      } as AuthUser);
      redis.incr.mockResolvedValueOnce(4);
      try {
        await service.resendInvitation(TENANT_ID, ADMIN_ID);
        expect.fail('should have thrown');
      } catch (err) {
        const response = (err as BadRequestException).getResponse() as { code: string };
        expect(response.code).toBe('ONBOARDING_RESEND_RATE_LIMIT');
      }
    });
  });

  // ==========================================================================
  // CANCEL
  // ==========================================================================

  describe('cancel', () => {
    it('22. soft-deletes pending user and archives tenant', async () => {
      userRepoFindOne.mockResolvedValue({
        id: USER_ID,
        tenantId: TENANT_ID,
        passwordHash: PENDING_PASSWORD_HASH_PLACEHOLDER,
      } as AuthUser);
      txEntityManager.findOne.mockResolvedValue({
        id: TENANT_ID,
        deletedAt: null,
      });

      await service.cancel(TENANT_ID, 'wrong tenant', ADMIN_ID);
      expect(txEntityManager.save).toHaveBeenCalledTimes(2);
    });

    it('23. throws when no pending user', async () => {
      userRepoFindOne.mockResolvedValue(null);
      await expect(service.cancel(TENANT_ID, 'r', ADMIN_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
