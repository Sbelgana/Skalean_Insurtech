/**
 * Tests IcalFeedController -- Sprint 8 Tache 8.13.
 *
 * Unit-level controller tests (guards bypassed -- guard testing lives in
 * e2e suite Sprint 8.14). Focus on :
 *   - Public feed : 200 + text/calendar headers vs 404 obscurity
 *   - .ics suffix parsing
 *   - feedUrl built from x-forwarded-* / env override
 *   - Authenticated CRUD : create returns plain token, listings don't
 *   - all_tenant scope reserved for ADMIN
 */

import { BadRequestException } from '@nestjs/common';
import type { TenantContextService } from '@insurtech/auth';
import { AuthRole } from '@insurtech/auth';
import type { BookingIcalTokenEntity } from '@insurtech/database';
import { describe, expect, it, vi } from 'vitest';
import { IcalFeedController } from './ical-feed.controller.js';
import type { IcalFeedService } from '../services/ical-feed.service.js';
import type { IcalTokenService } from '../services/ical-token.service.js';

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
    name: 'iPhone',
    scope: 'own',
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

function setup(opts: {
  feed?: { content: string; lastModified: Date; tokenId: string } | null;
  role?: AuthRole;
  isSuperAdmin?: boolean;
} = {}) {
  const feedService = {
    generateFeed: vi.fn().mockResolvedValue(opts.feed ?? null),
  } as unknown as IcalFeedService;
  const tokenService = {
    create: vi.fn().mockResolvedValue({
      token: buildRow(),
      plainToken: 'ical_aaa_bbb_ccc',
    }),
    findByUser: vi.fn().mockResolvedValue([buildRow()]),
    findAllTenantTokens: vi
      .fn()
      .mockResolvedValue([buildRow(), buildRow({ id: 'tok-2' })]),
    revoke: vi.fn().mockResolvedValue(undefined),
  } as unknown as IcalTokenService;
  const tenantContext = {
    getCurrentContext: vi.fn().mockReturnValue({
      tenantId: TENANT_A,
      userId: USER_A,
      userRole: opts.role ?? AuthRole.BrokerUser,
      isSuperAdmin: opts.isSuperAdmin ?? false,
    }),
  } as unknown as TenantContextService;
  const ctrl = new IcalFeedController(feedService, tokenService, tenantContext);
  return { ctrl, feedService, tokenService };
}

function fakeRes() {
  const send = vi.fn();
  const status = vi.fn().mockImplementation(() => ({ send }));
  const header = vi.fn();
  return {
    send,
    status,
    header,
    raw: { send, status, header } as never,
  };
}

describe('IcalFeedController (Sprint 8 Tache 8.13)', () => {
  describe('public feed', () => {
    it('1. valid token : 200 + text/calendar + content', async () => {
      const { ctrl } = setup({
        feed: {
          content: 'BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n',
          lastModified: new Date('2026-05-25T10:00:00Z'),
          tokenId: TOKEN_ID,
        },
      });
      const res = fakeRes();
      await ctrl.getFeed('ical_xyz.ics', res.raw);
      expect(res.header).toHaveBeenCalledWith(
        'Content-Type',
        'text/calendar; charset=utf-8',
      );
      expect(res.header).toHaveBeenCalledWith(
        'Cache-Control',
        'private, max-age=900',
      );
      expect(res.header).toHaveBeenCalledWith('Last-Modified', expect.any(String));
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(
        'BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n',
      );
    });

    it('2. invalid token : 404 with opaque message (NOT 401)', async () => {
      const { ctrl } = setup({ feed: null });
      const res = fakeRes();
      await ctrl.getFeed('ical_bogus.ics', res.raw);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.send).toHaveBeenCalledWith('Calendar not found');
    });

    it('3. path without .ics suffix : 404', async () => {
      const { ctrl, feedService } = setup({ feed: null });
      const res = fakeRes();
      await ctrl.getFeed('ical_xyz', res.raw);
      expect(res.status).toHaveBeenCalledWith(404);
      // Did not even call the service
      expect(feedService.generateFeed).not.toHaveBeenCalled();
    });

    it('4. .ics suffix stripped before validation', async () => {
      const { ctrl, feedService } = setup({
        feed: {
          content: 'X',
          lastModified: new Date(),
          tokenId: TOKEN_ID,
        },
      });
      await ctrl.getFeed('ical_abc.ics', fakeRes().raw);
      expect(feedService.generateFeed).toHaveBeenCalledWith('ical_abc');
    });
  });

  describe('create', () => {
    it('5. returns feedUrl with plain token + expected fields', async () => {
      const { ctrl } = setup();
      const result = await ctrl.create(
        { name: 'iPhone', scope: 'own' },
        { host: 'app.example.com', 'x-forwarded-proto': 'https' },
      );
      expect(result.feedUrl).toBe(
        'https://app.example.com/api/v1/booking/calendar/ical/ical_aaa_bbb_ccc.ics',
      );
      expect(result.id).toBe(TOKEN_ID);
      expect(result.name).toBe('iPhone');
      expect(result.scope).toBe('own');
    });

    it('6. rejects invalid input via Zod (missing name)', async () => {
      const { ctrl } = setup();
      await expect(
        ctrl.create({ scope: 'own' }, {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('7. non-admin cannot request all_tenant scope', async () => {
      const { ctrl } = setup({ role: AuthRole.BrokerUser });
      await expect(
        ctrl.create({ name: 'X', scope: 'all_tenant' }, {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('8. BrokerAdmin can request all_tenant scope', async () => {
      const { ctrl } = setup({ role: AuthRole.BrokerAdmin });
      const result = await ctrl.create(
        { name: 'AdminFeed', scope: 'all_tenant' },
        { host: 'app.example.com' },
      );
      expect(result.id).toBe(TOKEN_ID);
    });

    it('9. CALENDAR_PUBLIC_BASE_URL env override wins over headers', async () => {
      const prev = process.env['CALENDAR_PUBLIC_BASE_URL'];
      process.env['CALENDAR_PUBLIC_BASE_URL'] = 'https://override.example.com';
      try {
        const { ctrl } = setup();
        const result = await ctrl.create(
          { name: 'iPhone', scope: 'own' },
          { host: 'wrong.example.com' },
        );
        expect(result.feedUrl).toBe(
          'https://override.example.com/api/v1/booking/calendar/ical/ical_aaa_bbb_ccc.ics',
        );
      } finally {
        if (prev === undefined) delete process.env['CALENDAR_PUBLIC_BASE_URL'];
        else process.env['CALENDAR_PUBLIC_BASE_URL'] = prev;
      }
    });

    it('10. placeholder env override ignored', async () => {
      const prev = process.env['CALENDAR_PUBLIC_BASE_URL'];
      process.env['CALENDAR_PUBLIC_BASE_URL'] = 'PLACEHOLDER_URL';
      try {
        const { ctrl } = setup();
        const result = await ctrl.create(
          { name: 'iPhone', scope: 'own' },
          { host: 'real.example.com', 'x-forwarded-proto': 'https' },
        );
        expect(result.feedUrl).toContain('https://real.example.com/');
      } finally {
        if (prev === undefined) delete process.env['CALENDAR_PUBLIC_BASE_URL'];
        else process.env['CALENDAR_PUBLIC_BASE_URL'] = prev;
      }
    });
  });

  describe('listings', () => {
    it('11. list returns summaries (no feedUrl since plain token unrecoverable)', async () => {
      const { ctrl } = setup();
      const out = await ctrl.list();
      expect(out.tokens).toHaveLength(1);
      expect((out.tokens[0] as Record<string, unknown>).feedUrl).toBeUndefined();
    });

    it('12. admin list returns every token in tenant', async () => {
      const { ctrl } = setup({ role: AuthRole.BrokerAdmin });
      const out = await ctrl.adminListAll();
      expect(out.tokens).toHaveLength(2);
    });
  });

  describe('revoke', () => {
    it('13. delegates to token service with id', async () => {
      const { ctrl, tokenService } = setup();
      await ctrl.revoke(TOKEN_ID);
      expect(tokenService.revoke).toHaveBeenCalledWith(TOKEN_ID);
    });
  });
});
