/**
 * Tests unitaires TenantManagementService.
 *
 * Reference : Sprint 6 / Tache 2.2.7.
 */

import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { AuthTenant, DataSource } from '@insurtech/database';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TenantAccessCacheService } from '../../tenant/services/tenant-access-cache.service.js';
import type { CreateTenantDto, UpdateTenantDto } from '../dto/tenant.dto.js';
import { TenantManagementService } from './tenant-management.service.js';

const TENANT_ID = '11111111-1111-4111-8111-111111111111';
const ADMIN_USER = '99999999-9999-4999-8999-999999999999';

const buildAuthTenant = (overrides: Partial<AuthTenant> = {}): AuthTenant => ({
  id: TENANT_ID,
  name: 'Test Tenant',
  type: 'broker',
  settings: {},
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-02'),
  deletedAt: null,
  tenantUsers: [],
  sessions: [],
  ...overrides,
}) as AuthTenant;

describe('TenantManagementService', () => {
  let service: TenantManagementService;
  let dataSource: DataSource;
  let cache: TenantAccessCacheService;
  let repo: {
    findOne: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    createQueryBuilder: ReturnType<typeof vi.fn>;
  };

  let qb: {
    withDeleted: ReturnType<typeof vi.fn>;
    orderBy: ReturnType<typeof vi.fn>;
    offset: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    andWhere: ReturnType<typeof vi.fn>;
    getManyAndCount: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    qb = {
      withDeleted: vi.fn(),
      orderBy: vi.fn(),
      offset: vi.fn(),
      limit: vi.fn(),
      andWhere: vi.fn(),
      getManyAndCount: vi.fn().mockResolvedValue([[], 0]),
    };
    qb.withDeleted.mockReturnValue(qb);
    qb.orderBy.mockReturnValue(qb);
    qb.offset.mockReturnValue(qb);
    qb.limit.mockReturnValue(qb);
    qb.andWhere.mockReturnValue(qb);

    repo = {
      findOne: vi.fn(),
      save: vi.fn(async (e) => e),
      create: vi.fn((data) => ({ id: TENANT_ID, ...data })),
      createQueryBuilder: vi.fn(() => qb),
    };

    dataSource = {
      getRepository: vi.fn(() => repo),
    } as unknown as DataSource;

    cache = {
      invalidateAllForTenant: vi.fn().mockResolvedValue(undefined),
    } as unknown as TenantAccessCacheService;

    service = new TenantManagementService(dataSource, cache);
  });

  // ==========================================================================
  // CREATE
  // ==========================================================================

  describe('create', () => {
    it('1. creates tenant with default settings + invalidates cache', async () => {
      repo.findOne.mockResolvedValue(null);
      const dto: CreateTenantDto = { name: 'Acme Broker', type: 'broker' };

      const result = await service.create(dto, ADMIN_USER);

      expect(result.id).toBe(TENANT_ID);
      expect(result.name).toBe('Acme Broker');
      expect(result.type).toBe('broker');
      expect(result.status).toBe('active');
      expect(result.settings.locale).toBe('fr');
      expect(result.settings.currency).toBe('MAD');
      expect(cache.invalidateAllForTenant).toHaveBeenCalledWith(TENANT_ID);
    });

    it('2. rejects duplicate name with 409 CONFLICT', async () => {
      repo.findOne.mockResolvedValue(buildAuthTenant({ name: 'Existing' }));
      const dto: CreateTenantDto = { name: 'Existing', type: 'broker' };

      try {
        await service.create(dto, ADMIN_USER);
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ConflictException);
        const response = (err as ConflictException).getResponse() as { code: string };
        expect(response.code).toBe('TENANT_NAME_CONFLICT');
      }
    });

    it('3. allows reusing name of archived tenant', async () => {
      repo.findOne.mockResolvedValue(buildAuthTenant({ deletedAt: new Date() }));
      const dto: CreateTenantDto = { name: 'Was Archived', type: 'garage' };
      const result = await service.create(dto, ADMIN_USER);
      expect(result.name).toBe('Was Archived');
    });

    it('4. merges partial custom settings with defaults', async () => {
      repo.findOne.mockResolvedValue(null);
      const dto: CreateTenantDto = {
        name: 'Custom',
        type: 'garage',
        settings: { locale: 'ar-MA', branding: { primaryColor: '#FF0000' } },
      };
      const result = await service.create(dto, ADMIN_USER);
      expect(result.settings.locale).toBe('ar-MA');
      expect(result.settings.branding.primaryColor).toBe('#FF0000');
      expect(result.settings.branding.logoUrl).toBeNull();
      expect(result.settings.currency).toBe('MAD');
    });

    it('5. assigns tenantType matching the create type', async () => {
      repo.findOne.mockResolvedValue(null);
      const dto: CreateTenantDto = { name: 'Garage A', type: 'garage' };
      const result = await service.create(dto, ADMIN_USER);
      expect(result.settings.tenantType).toBe('garage');
    });
  });

  // ==========================================================================
  // UPDATE
  // ==========================================================================

  describe('update', () => {
    it('6. updates name + invalidates cache', async () => {
      repo.findOne.mockResolvedValueOnce(buildAuthTenant()).mockResolvedValueOnce(null);
      const dto: UpdateTenantDto = { name: 'New Name' };
      const result = await service.update(TENANT_ID, dto, ADMIN_USER);
      expect(result.name).toBe('New Name');
      expect(cache.invalidateAllForTenant).toHaveBeenCalledWith(TENANT_ID);
    });

    it('7. throws NotFoundException when tenant absent', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(
        service.update(TENANT_ID, { name: 'X' }, ADMIN_USER),
      ).rejects.toThrow(NotFoundException);
    });

    it('8. rejects update on archived tenant', async () => {
      repo.findOne.mockResolvedValue(buildAuthTenant({ deletedAt: new Date() }));
      try {
        await service.update(TENANT_ID, { name: 'X' }, ADMIN_USER);
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(BadRequestException);
        const response = (err as BadRequestException).getResponse() as { code: string };
        expect(response.code).toBe('TENANT_ALREADY_ARCHIVED');
      }
    });

    it('9. rejects rename to existing name (409)', async () => {
      repo.findOne
        .mockResolvedValueOnce(buildAuthTenant({ name: 'Current' }))
        .mockResolvedValueOnce(buildAuthTenant({ id: 'other-id', name: 'Taken' }));
      await expect(
        service.update(TENANT_ID, { name: 'Taken' }, ADMIN_USER),
      ).rejects.toThrow(ConflictException);
    });

    it('10. accepts rename if existing one is archived', async () => {
      repo.findOne
        .mockResolvedValueOnce(buildAuthTenant({ name: 'Current' }))
        .mockResolvedValueOnce(
          buildAuthTenant({ id: 'old-id', name: 'Reusable', deletedAt: new Date() }),
        );
      const result = await service.update(TENANT_ID, { name: 'Reusable' }, ADMIN_USER);
      expect(result.name).toBe('Reusable');
    });

    it('11. partial settings update preserves untouched fields', async () => {
      repo.findOne.mockResolvedValue(
        buildAuthTenant({
          settings: {
            locale: 'fr',
            timezone: 'Africa/Casablanca',
            currency: 'MAD',
            branding: { primaryColor: '#E95D2C', logoUrl: null },
            features: { mfaRequiredForAdmin: true, sinistreAutoAssign: false },
            quotas: { maxUsers: 10, maxPolices: 1000, maxStorageGb: 50 },
            tenantType: 'broker',
          },
        }),
      );
      const dto: UpdateTenantDto = {
        settings: { features: { sinistreAutoAssign: true } },
      };
      const result = await service.update(TENANT_ID, dto, ADMIN_USER);
      expect(result.settings.features.sinistreAutoAssign).toBe(true);
      expect(result.settings.features.mfaRequiredForAdmin).toBe(true);
      expect(result.settings.locale).toBe('fr');
    });
  });

  // ==========================================================================
  // ARCHIVE
  // ==========================================================================

  describe('archive', () => {
    it('12. soft-deletes tenant + invalidates cache', async () => {
      repo.findOne.mockResolvedValue(buildAuthTenant());
      await service.archive(TENANT_ID, 'data migration', ADMIN_USER);
      const saved = repo.save.mock.calls[0]![0];
      expect(saved.deletedAt).toBeInstanceOf(Date);
      expect(cache.invalidateAllForTenant).toHaveBeenCalledWith(TENANT_ID);
    });

    it('13. throws NotFoundException when tenant absent', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.archive(TENANT_ID, 'reason', ADMIN_USER)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('14. throws ConflictException when already archived', async () => {
      repo.findOne.mockResolvedValue(buildAuthTenant({ deletedAt: new Date() }));
      try {
        await service.archive(TENANT_ID, 'r', ADMIN_USER);
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ConflictException);
        const response = (err as ConflictException).getResponse() as { code: string };
        expect(response.code).toBe('TENANT_ALREADY_ARCHIVED');
      }
    });
  });

  // ==========================================================================
  // RESTORE
  // ==========================================================================

  describe('restore', () => {
    it('15. restores archived tenant (deletedAt = null)', async () => {
      repo.findOne.mockResolvedValue(buildAuthTenant({ deletedAt: new Date() }));
      const result = await service.restore(TENANT_ID, ADMIN_USER);
      expect(result.status).toBe('active');
      const saved = repo.save.mock.calls[0]![0];
      expect(saved.deletedAt).toBeNull();
    });

    it('16. throws NotFoundException when tenant absent', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.restore(TENANT_ID, ADMIN_USER)).rejects.toThrow(NotFoundException);
    });

    it('17. throws BadRequestException when not archived', async () => {
      repo.findOne.mockResolvedValue(buildAuthTenant({ deletedAt: null }));
      try {
        await service.restore(TENANT_ID, ADMIN_USER);
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(BadRequestException);
        const response = (err as BadRequestException).getResponse() as { code: string };
        expect(response.code).toBe('TENANT_NOT_ARCHIVED');
      }
    });
  });

  // ==========================================================================
  // FIND / LIST
  // ==========================================================================

  describe('findById', () => {
    it('18. returns tenant DTO', async () => {
      repo.findOne.mockResolvedValue(buildAuthTenant());
      const result = await service.findById(TENANT_ID);
      expect(result.id).toBe(TENANT_ID);
      expect(result.status).toBe('active');
    });

    it('19. includes archived tenants', async () => {
      repo.findOne.mockResolvedValue(buildAuthTenant({ deletedAt: new Date() }));
      const result = await service.findById(TENANT_ID);
      expect(result.status).toBe('archived');
    });

    it('20. throws NotFoundException when missing', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findById(TENANT_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe('list', () => {
    it('21. returns paginated empty result', async () => {
      const result = await service.list({ page: 1, pageSize: 25 });
      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });

    it('22. computes totalPages from total / pageSize', async () => {
      qb.getManyAndCount.mockResolvedValue([
        [buildAuthTenant({ id: 'a' }), buildAuthTenant({ id: 'b' })],
        50,
      ]);
      const result = await service.list({ page: 1, pageSize: 25 });
      expect(result.totalPages).toBe(2);
      expect(result.items).toHaveLength(2);
    });

    it('23. applies type filter', async () => {
      const andWhere = qb.andWhere;
      await service.list({ page: 1, pageSize: 25, type: 'garage' });
      expect(andWhere).toHaveBeenCalledWith('t.type = :type', { type: 'garage' });
    });

    it('24. applies status=active filter', async () => {
      const andWhere = qb.andWhere;
      await service.list({ page: 1, pageSize: 25, status: 'active' });
      expect(andWhere).toHaveBeenCalledWith('t.deleted_at IS NULL');
    });

    it('25. applies search filter (ILIKE)', async () => {
      const andWhere = qb.andWhere;
      await service.list({ page: 1, pageSize: 25, search: 'acme' });
      expect(andWhere).toHaveBeenCalledWith('t.name ILIKE :s', { s: '%acme%' });
    });
  });
});
