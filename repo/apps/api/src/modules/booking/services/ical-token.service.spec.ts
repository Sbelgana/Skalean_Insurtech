/**
 * Tests IcalTokenService -- Sprint 8 Tache 8.13.
 *
 * Unit tests : dataSource + tenantContext mocked, no DB. Focus on :
 *   - SHA-256 hash storage (plain token never persisted)
 *   - validateAndRetrieve : expiry + revocation checks
 *   - revoke : NotFound vs AlreadyRevoked branching
 *   - findByUser / findAllTenantTokens : tenant context required
 */

import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { TenantContextService } from '@insurtech/auth';
import type {
  BookingIcalTokenEntity,
  DataSource,
} from '@insurtech/database';
import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { IcalTokenService } from './ical-token.service.js';

const TENANT_A = '00000000-0000-0000-0000-000000000001';
const USER_A = '00000000-0000-0000-0000-000000000002';
const TOKEN_ID = '00000000-0000-0000-0000-000000000a01';

function buildRow(
  overrides: Partial<BookingIcalTokenEntity> = {},
): BookingIcalTokenEntity {
  return {
    id: TOKEN_ID,
    tenantId: TENANT_A,
    userId: USER_A,
    tokenHash: 'abc',
    scope: 'own',
    name: 'iPhone',
    expiresAt: null,
    lastAccessedAt: null,
    accessCount: 0,
    active: true,
    revokedAt: null,
    revokedByUserId: null,
    createdAt: new Date('2026-05-20T10:00:00Z'),
    updatedAt: new Date('2026-05-20T10:00:00Z'),
    ...overrides,
  } as unknown as BookingIcalTokenEntity;
}

function setup(opts: { ctx?: { tenantId?: string; userId?: string }; findOne?: BookingIcalTokenEntity | null } = {}) {
  const repo = {
    create: vi.fn((data) => ({ ...data, id: TOKEN_ID })),
    save: vi.fn(async (data) => ({
      ...data,
      id: TOKEN_ID,
      createdAt: new Date('2026-05-20T10:00:00Z'),
      updatedAt: new Date('2026-05-20T10:00:00Z'),
    })),
    findOne: vi.fn().mockResolvedValue(opts.findOne ?? null),
    find: vi.fn().mockResolvedValue([]),
    createQueryBuilder: vi.fn().mockReturnValue({
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue({}),
    }),
  };
  const dataSource = {
    getRepository: vi.fn().mockReturnValue(repo),
  } as unknown as DataSource;
  const ctx = opts.ctx ?? { tenantId: TENANT_A, userId: USER_A };
  const tenantContext = {
    getCurrentContext: vi.fn().mockReturnValue(
      ctx.tenantId ? ctx : undefined,
    ),
  } as unknown as TenantContextService;
  const service = new IcalTokenService(dataSource, tenantContext);
  return { service, repo, dataSource };
}

describe('IcalTokenService (Sprint 8 Tache 8.13)', () => {
  describe('static helpers', () => {
    it('1. generatePlainToken : ical_ prefix + 43 chars base64url payload', () => {
      const t = IcalTokenService.generatePlainToken();
      expect(t).toMatch(/^ical_[A-Za-z0-9_-]+$/);
      // 32 bytes base64url = 43 chars (no padding) + 'ical_' prefix
      expect(t.length).toBeGreaterThanOrEqual(40);
    });

    it('2. hash : SHA-256 hex 64 chars, deterministic', () => {
      const h1 = IcalTokenService.hash('ical_xyz');
      const h2 = IcalTokenService.hash('ical_xyz');
      expect(h1).toBe(h2);
      expect(h1).toHaveLength(64);
      expect(h1).toMatch(/^[0-9a-f]{64}$/);
      expect(h1).toBe(createHash('sha256').update('ical_xyz').digest('hex'));
    });
  });

  describe('create', () => {
    it('3. requires tenant + user context', async () => {
      const { service } = setup({ ctx: {} });
      await expect(
        service.create({ name: 'X', scope: 'own' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('4. persists SHA-256 hash of plain token and returns plain token once', async () => {
      const { service, repo } = setup();
      const { token, plainToken } = await service.create({
        name: 'iPhone',
        scope: 'own',
      });
      expect(plainToken).toMatch(/^ical_/);
      // repo.create called with hash of plain token, NOT the plain token itself
      const expectedHash = IcalTokenService.hash(plainToken);
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tokenHash: expectedHash,
          name: 'iPhone',
          scope: 'own',
          tenantId: TENANT_A,
          userId: USER_A,
        }),
      );
      expect(token.id).toBe(TOKEN_ID);
    });
  });

  describe('validateAndRetrieve (public path)', () => {
    it('5. rejects token without ical_ prefix', async () => {
      const { service } = setup();
      const result = await service.validateAndRetrieve('not-a-real-token');
      expect(result).toBeNull();
    });

    it('6. returns null when hash not found', async () => {
      const { service } = setup({ findOne: null });
      const result = await service.validateAndRetrieve('ical_xyz');
      expect(result).toBeNull();
    });

    it('7. returns null when token revoked / inactive', async () => {
      const row = buildRow({ active: false, revokedAt: new Date() });
      const { service } = setup({ findOne: row });
      const result = await service.validateAndRetrieve('ical_xyz');
      expect(result).toBeNull();
    });

    it('8. returns null when token expired', async () => {
      const row = buildRow({
        expiresAt: new Date(Date.now() - 60_000),
      });
      const { service } = setup({ findOne: row });
      const result = await service.validateAndRetrieve('ical_xyz');
      expect(result).toBeNull();
    });

    it('9. returns row when active + non-expired', async () => {
      const row = buildRow({
        expiresAt: new Date(Date.now() + 3600_000),
      });
      const { service, repo } = setup({ findOne: row });
      const result = await service.validateAndRetrieve('ical_xyz');
      expect(result).toBe(row);
      // repo.findOne called with hash of plain token
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { tokenHash: IcalTokenService.hash('ical_xyz') },
      });
    });
  });

  describe('revoke', () => {
    it('10. throws NotFound when row missing', async () => {
      const { service } = setup({ findOne: null });
      await expect(service.revoke(TOKEN_ID)).rejects.toThrow(NotFoundException);
    });

    it('11. throws BadRequest when already revoked', async () => {
      const row = buildRow({ active: false });
      const { service } = setup({ findOne: row });
      await expect(service.revoke(TOKEN_ID)).rejects.toThrow(BadRequestException);
    });

    it('12. soft-deletes when active : sets active=false + revoked_at + revoked_by', async () => {
      const row = buildRow();
      const { service, repo } = setup({ findOne: row });
      await service.revoke(TOKEN_ID);
      expect(repo.createQueryBuilder).toHaveBeenCalled();
      const qb = (repo.createQueryBuilder as ReturnType<typeof vi.fn>).mock
        .results[0]?.value;
      expect(qb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          active: false,
          revokedAt: expect.any(Date),
          revokedByUserId: USER_A,
        }),
      );
    });

    it('13. allowAdmin=true scopes lookup to (tenant, id) only', async () => {
      const row = buildRow({ userId: 'other-user' });
      const { service, repo } = setup({ findOne: row });
      await service.revoke(TOKEN_ID, { allowAdmin: true });
      // Verify findOne where excluded userId
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: TOKEN_ID, tenantId: TENANT_A },
      });
    });
  });

  describe('listings', () => {
    it('14. findByUser : tenant + user filter', async () => {
      const { service, repo } = setup();
      await service.findByUser();
      expect(repo.find).toHaveBeenCalledWith({
        where: { tenantId: TENANT_A, userId: USER_A },
        order: { createdAt: 'DESC' },
      });
    });

    it('15. findAllTenantTokens : tenant filter only (admin)', async () => {
      const { service, repo } = setup();
      await service.findAllTenantTokens();
      expect(repo.find).toHaveBeenCalledWith({
        where: { tenantId: TENANT_A },
        order: { createdAt: 'DESC' },
      });
    });
  });
});
