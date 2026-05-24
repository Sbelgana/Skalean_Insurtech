/**
 * Tests CompaniesService -- Sprint 8 Tache 8.1.
 *
 * Unit tests avec DataSource mock. Tests integration (RLS live) seront ajoutes
 * Sprint 8.14 (E2E exhaustifs).
 */

import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { TenantContextService, type TenantContext } from '@insurtech/auth';
import { describe, expect, it, vi } from 'vitest';
import {
  CompaniesService,
  COMPANY_ERROR_CODES,
} from './companies.service.js';

const TENANT_A = '00000000-0000-0000-0000-000000000001';
const USER_A = '00000000-0000-0000-0000-000000000002';

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
  findOne: ReturnType<typeof vi.fn>;
  createQueryBuilder: ReturnType<typeof vi.fn>;
}

function buildRepo(overrides: Partial<RepoStub> = {}): RepoStub {
  const qb = {
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    take: vi.fn().mockReturnThis(),
    getManyAndCount: vi.fn().mockResolvedValue([[], 0]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue(undefined),
  };
  return {
    create: vi.fn((data) => ({ ...data, id: 'company-1' })),
    save: vi.fn((entity) => Promise.resolve({ ...entity, id: 'company-1', createdAt: new Date(), updatedAt: new Date() })),
    findOne: vi.fn().mockResolvedValue(null),
    createQueryBuilder: vi.fn(() => qb),
    ...overrides,
  };
}

function buildService(repo: RepoStub, tenantId: string | undefined = TENANT_A): CompaniesService {
  const dataSource = {
    getRepository: vi.fn(() => repo),
  } as never;
  const tenantContext = buildTenantContext(tenantId);
  return new CompaniesService(dataSource, tenantContext);
}

// Build valid ICE for tests
function validIce(first13: string): string {
  const rem = Number(BigInt(first13) % 97n);
  return first13 + String(rem).padStart(2, '0');
}

describe('CompaniesService (Sprint 8 Tache 8.1)', () => {
  describe('create', () => {
    it('1. throws TENANT_REQUIRED if no tenant context', async () => {
      const repo = buildRepo();
      // Empty string bypasses TS default-parameter substitution + trips
      // buildTenantContext's falsy ternary. (Task 8.14 mock-subtlety fix.)
      const service = buildService(repo, '');
      await expect(
        service.create({ name: 'Test', tags: [], country: 'MA' }, USER_A),
      ).rejects.toThrow(BadRequestException);
    });

    it('2. creates company without ICE successfully', async () => {
      const repo = buildRepo();
      const service = buildService(repo);
      const result = await service.create(
        { name: 'Bennani Courtage', country: 'MA', tags: [] },
        USER_A,
      );
      expect(result.id).toBe('company-1');
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Bennani Courtage', tenantId: TENANT_A }),
      );
      expect(repo.save).toHaveBeenCalled();
    });

    it('3. creates company with valid ICE', async () => {
      const ice = validIce('1234567890123');
      const repo = buildRepo();
      const service = buildService(repo);
      const result = await service.create(
        { name: 'Atlas Garage', ice, country: 'MA', tags: [] },
        USER_A,
      );
      expect(result.id).toBe('company-1');
    });

    it('4. rejects company with invalid ICE checksum', async () => {
      const repo = buildRepo();
      const service = buildService(repo);
      await expect(
        service.create(
          { name: 'Bad', ice: '123456789012399', country: 'MA', tags: [] },
          USER_A,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('5. rejects ICE with wrong length', async () => {
      const repo = buildRepo();
      const service = buildService(repo);
      try {
        await service.create(
          { name: 'Bad', ice: '12345', country: 'MA', tags: [] },
          USER_A,
        );
        expect.fail('should have thrown');
      } catch (err) {
        const res = (err as BadRequestException).getResponse() as { code?: string };
        expect(res.code).toBe(COMPANY_ERROR_CODES.ICE_INVALID);
      }
    });

    it('6. rejects duplicate ICE in same tenant', async () => {
      const ice = validIce('5555555555555');
      const repo = buildRepo({
        findOne: vi.fn().mockResolvedValue({ id: 'existing', deletedAt: null }),
      });
      const service = buildService(repo);
      await expect(
        service.create({ name: 'Dup', ice, country: 'MA', tags: [] }, USER_A),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findOne', () => {
    it('7. retrieves existing company', async () => {
      const repo = buildRepo({
        findOne: vi.fn().mockResolvedValue({
          id: 'company-1',
          tenantId: TENANT_A,
          name: 'X',
          deletedAt: null,
        }),
      });
      const service = buildService(repo);
      const result = await service.findOne('company-1');
      expect(result.id).toBe('company-1');
    });

    it('8. throws NotFound if company missing', async () => {
      const repo = buildRepo({ findOne: vi.fn().mockResolvedValue(null) });
      const service = buildService(repo);
      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });

    it('9. throws NotFound if soft-deleted', async () => {
      const repo = buildRepo({
        findOne: vi.fn().mockResolvedValue({
          id: 'company-1',
          tenantId: TENANT_A,
          name: 'X',
          deletedAt: new Date(),
        }),
      });
      const service = buildService(repo);
      await expect(service.findOne('company-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('list', () => {
    it('10. returns paginated empty result', async () => {
      const repo = buildRepo();
      const service = buildService(repo);
      const result = await service.list({
        limit: 50,
        offset: 0,
        orderBy: 'created_at',
        orderDir: 'DESC',
      });
      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.limit).toBe(50);
    });
  });

  describe('softDelete', () => {
    it('11. soft-deletes existing company', async () => {
      const repo = buildRepo({
        findOne: vi.fn().mockResolvedValue({
          id: 'company-1',
          tenantId: TENANT_A,
          name: 'X',
          deletedAt: null,
        }),
      });
      const service = buildService(repo);
      await service.softDelete('company-1', USER_A);
      expect(repo.createQueryBuilder).toHaveBeenCalled();
    });
  });
});
