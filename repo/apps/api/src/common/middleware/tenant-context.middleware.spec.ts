/**
 * Tests unitaires TenantContextMiddleware -- 30+ scenarios.
 *
 * Couverture :
 *   - 5 branchements path (infrastructure, public, admin, assure, tenant)
 *   - validation header x-tenant-id (valid, missing, malformed, nil UUID, v1)
 *   - JWT decoding (absent, malformed, invalid signature)
 *   - acces user au tenant (cache hit, denied)
 *   - tenant inexistant
 *   - JWT vs header coherence (match, mismatch, platform-level null tenant)
 *
 * Reference : Sprint 6 / Tache 2.2.2.
 */

import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  AuthRole,
  type JwtPayload,
  JwtService,
  TenantContextService,
} from '@insurtech/auth';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TenantAccessCacheService } from '../../modules/tenant/services/tenant-access-cache.service.js';
import { TenantContextMiddleware } from './tenant-context.middleware.js';

const VALID_TENANT_ID = '11111111-1111-4111-8111-111111111111';
const VALID_USER_ID = '22222222-2222-4222-8222-222222222222';
const NIL_UUID = '00000000-0000-0000-0000-000000000000';
const V1_UUID = '11111111-1111-1111-9111-111111111111';

const buildJwtClaims = (overrides: Partial<JwtPayload> = {}): JwtPayload => ({
  sub: VALID_USER_ID,
  tenant_id: VALID_TENANT_ID,
  email: 'user@example.ma',
  role: AuthRole.BrokerAdmin,
  mfa_verified: true,
  jti: 'jti-1',
  sid: 'sid-1',
  iss: 'skalean-insurtech-api',
  aud: 'skalean-insurtech-app',
  iat: Math.floor(Date.now() / 1000),
  nbf: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 900,
  ...overrides,
});

const buildReq = (overrides: Partial<FastifyRequest> = {}): FastifyRequest =>
  ({
    url: '/api/v1/contacts',
    method: 'GET',
    headers: {
      'x-tenant-id': VALID_TENANT_ID,
      authorization: 'Bearer fake-jwt',
      'user-agent': 'vitest/1.0',
    },
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
    ...overrides,
  }) as unknown as FastifyRequest;

const buildRes = (): FastifyReply => ({}) as FastifyReply;

describe('TenantContextMiddleware', () => {
  let middleware: TenantContextMiddleware;
  let tenantContext: TenantContextService;
  let cache: TenantAccessCacheService;
  let jwtService: JwtService;

  beforeEach(() => {
    tenantContext = new TenantContextService();
    cache = {
      getUserAccess: vi.fn().mockResolvedValue({ allowed: true }),
      getTenantSettings: vi.fn().mockResolvedValue({
        locale: 'fr',
        timezone: 'Africa/Casablanca',
        currency: 'MAD',
        branding: { primaryColor: '#E95D2C', logoUrl: null },
        features: { mfaRequiredForAdmin: true, sinistreAutoAssign: false },
        quotas: { maxUsers: 10, maxPolices: 1000, maxStorageGb: 50 },
        tenantType: 'broker',
      }),
      getTenantExists: vi.fn().mockResolvedValue(true),
    } as unknown as TenantAccessCacheService;
    jwtService = {
      verifyAccessToken: vi.fn().mockReturnValue(buildJwtClaims()),
    } as unknown as JwtService;
    middleware = new TenantContextMiddleware(tenantContext, cache, jwtService);
  });

  // ==========================================================================
  // GROUP 1 : Path branching
  // ==========================================================================

  describe('path branching', () => {
    it('1. skip tenant validation for /healthz', async () => {
      const req = buildReq({ url: '/healthz', headers: {} });
      let captured: ReturnType<TenantContextService['getCurrentContext']>;
      await middleware.use(req, buildRes(), () => {
        captured = tenantContext.getCurrentContext();
      });
      expect(captured?.tenantId).toBeUndefined();
      expect(captured?.isSuperAdmin).toBe(false);
    });

    it('2. skip tenant validation for /readyz', async () => {
      const req = buildReq({ url: '/readyz', headers: {} });
      let captured: ReturnType<TenantContextService['getCurrentContext']>;
      await middleware.use(req, buildRes(), () => {
        captured = tenantContext.getCurrentContext();
      });
      expect(captured?.isSuperAdmin).toBe(false);
    });

    it('3. skip tenant for /docs/swagger', async () => {
      const req = buildReq({ url: '/docs/swagger', headers: {} });
      let captured: ReturnType<TenantContextService['getCurrentContext']>;
      await middleware.use(req, buildRes(), () => {
        captured = tenantContext.getCurrentContext();
      });
      expect(captured?.tenantId).toBeUndefined();
    });

    it('4. skip tenant for /api/v1/public/info', async () => {
      const req = buildReq({ url: '/api/v1/public/info', headers: {} });
      let captured: ReturnType<TenantContextService['getCurrentContext']>;
      await middleware.use(req, buildRes(), () => {
        captured = tenantContext.getCurrentContext();
      });
      expect(captured?.tenantId).toBeUndefined();
    });

    it('5. skip tenant for /api/v1/auth/signin (public auth)', async () => {
      const req = buildReq({ url: '/api/v1/auth/signin', headers: {} });
      let captured: ReturnType<TenantContextService['getCurrentContext']>;
      await middleware.use(req, buildRes(), () => {
        captured = tenantContext.getCurrentContext();
      });
      expect(captured?.tenantId).toBeUndefined();
    });

    it('6. set isSuperAdmin true for /api/v1/admin/*', async () => {
      const req = buildReq({
        url: '/api/v1/admin/tenants',
        headers: { authorization: 'Bearer fake' },
      });
      let captured: ReturnType<TenantContextService['getCurrentContext']>;
      await middleware.use(req, buildRes(), () => {
        captured = tenantContext.getCurrentContext();
      });
      expect(captured?.isSuperAdmin).toBe(true);
      expect(captured?.userId).toBe(VALID_USER_ID);
    });

    it('7. set assureUserId for /api/v1/assure/*', async () => {
      const req = buildReq({ url: '/api/v1/assure/policies' });
      let captured: ReturnType<TenantContextService['getCurrentContext']>;
      await middleware.use(req, buildRes(), () => {
        captured = tenantContext.getCurrentContext();
      });
      expect(captured?.assureUserId).toBe(VALID_USER_ID);
      expect(captured?.tenantId).toBe(VALID_TENANT_ID);
    });

    it('8. set tenantId for default /api/v1/* routes', async () => {
      const req = buildReq();
      let captured: ReturnType<TenantContextService['getCurrentContext']>;
      await middleware.use(req, buildRes(), () => {
        captured = tenantContext.getCurrentContext();
      });
      expect(captured?.tenantId).toBe(VALID_TENANT_ID);
      expect(captured?.userId).toBe(VALID_USER_ID);
      expect(captured?.isSuperAdmin).toBe(false);
    });
  });

  // ==========================================================================
  // GROUP 2 : Header validation
  // ==========================================================================

  describe('header validation', () => {
    it('9. throw BadRequestException if x-tenant-id missing', async () => {
      const req = buildReq({ headers: { authorization: 'Bearer fake' } });
      await expect(middleware.use(req, buildRes(), () => {})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('10. throw with code TENANT_ID_MISSING when header absent', async () => {
      const req = buildReq({ headers: { authorization: 'Bearer fake' } });
      try {
        await middleware.use(req, buildRes(), () => {});
        expect.fail('should have thrown');
      } catch (err) {
        const response = (err as BadRequestException).getResponse() as { code: string };
        expect(response.code).toBe('TENANT_ID_MISSING');
      }
    });

    it('11. throw if tenant_id is malformed UUID', async () => {
      const req = buildReq({
        headers: { 'x-tenant-id': 'not-a-uuid', authorization: 'Bearer fake' },
      });
      await expect(middleware.use(req, buildRes(), () => {})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('12. reject nil UUID', async () => {
      const req = buildReq({
        headers: { 'x-tenant-id': NIL_UUID, authorization: 'Bearer fake' },
      });
      await expect(middleware.use(req, buildRes(), () => {})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('13. reject UUID v1 timestamp-based', async () => {
      const req = buildReq({
        headers: { 'x-tenant-id': V1_UUID, authorization: 'Bearer fake' },
      });
      await expect(middleware.use(req, buildRes(), () => {})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('14. accept valid UUID v4', async () => {
      const req = buildReq();
      let captured: string | undefined;
      await middleware.use(req, buildRes(), () => {
        captured = tenantContext.getCurrentTenantId();
      });
      expect(captured).toBe(VALID_TENANT_ID);
    });

    it('15. throw with code TENANT_ID_INVALID on malformed UUID', async () => {
      const req = buildReq({
        headers: { 'x-tenant-id': 'xxx', authorization: 'Bearer fake' },
      });
      try {
        await middleware.use(req, buildRes(), () => {});
        expect.fail('should have thrown');
      } catch (err) {
        const response = (err as BadRequestException).getResponse() as { code: string };
        expect(response.code).toBe('TENANT_ID_INVALID');
      }
    });
  });

  // ==========================================================================
  // GROUP 3 : JWT decoding
  // ==========================================================================

  describe('JWT decoding', () => {
    it('16. throw UnauthorizedException if no Authorization header on tenant route', async () => {
      const req = buildReq({ headers: { 'x-tenant-id': VALID_TENANT_ID } });
      await expect(middleware.use(req, buildRes(), () => {})).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('17. throw if Authorization header malformed', async () => {
      const req = buildReq({
        headers: { 'x-tenant-id': VALID_TENANT_ID, authorization: 'Token fake' },
      });
      await expect(middleware.use(req, buildRes(), () => {})).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('18. throw if JWT signature invalid', async () => {
      vi.mocked(jwtService.verifyAccessToken).mockImplementation(() => {
        throw new Error('invalid signature');
      });
      const req = buildReq();
      await expect(middleware.use(req, buildRes(), () => {})).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('19. accept valid JWT and extract sub as userId', async () => {
      const req = buildReq();
      let captured: string | undefined;
      await middleware.use(req, buildRes(), () => {
        captured = tenantContext.getCurrentUserId();
      });
      expect(captured).toBe(VALID_USER_ID);
    });

    it('20. throw if admin route has no auth', async () => {
      const req = buildReq({ url: '/api/v1/admin/users', headers: {} });
      await expect(middleware.use(req, buildRes(), () => {})).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ==========================================================================
  // GROUP 4 : User access verification
  // ==========================================================================

  describe('user access verification', () => {
    it('21. call cache for user access verification', async () => {
      const req = buildReq();
      await middleware.use(req, buildRes(), () => {});
      expect(cache.getUserAccess).toHaveBeenCalledWith(VALID_USER_ID, VALID_TENANT_ID);
    });

    it('22. throw ForbiddenException if user has no access to tenant', async () => {
      vi.mocked(cache.getUserAccess).mockResolvedValue({
        allowed: false,
        reason: 'USER_NOT_LINKED_TO_TENANT',
      });
      const req = buildReq();
      await expect(middleware.use(req, buildRes(), () => {})).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('23. throw with code TENANT_ACCESS_DENIED', async () => {
      vi.mocked(cache.getUserAccess).mockResolvedValue({
        allowed: false,
        reason: 'USER_NOT_LINKED_TO_TENANT',
      });
      const req = buildReq();
      try {
        await middleware.use(req, buildRes(), () => {});
        expect.fail('should have thrown');
      } catch (err) {
        const response = (err as ForbiddenException).getResponse() as { code: string };
        expect(response.code).toBe('TENANT_ACCESS_DENIED');
      }
    });

    it('24. throw BadRequestException if tenant does not exist', async () => {
      vi.mocked(cache.getTenantExists).mockResolvedValue(false);
      const req = buildReq();
      await expect(middleware.use(req, buildRes(), () => {})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('25. throw with code TENANT_NOT_FOUND on missing tenant', async () => {
      vi.mocked(cache.getTenantExists).mockResolvedValue(false);
      const req = buildReq();
      try {
        await middleware.use(req, buildRes(), () => {});
        expect.fail('should have thrown');
      } catch (err) {
        const response = (err as BadRequestException).getResponse() as { code: string };
        expect(response.code).toBe('TENANT_NOT_FOUND');
      }
    });
  });

  // ==========================================================================
  // GROUP 5 : JWT vs header coherence
  // ==========================================================================

  describe('JWT vs header coherence', () => {
    it('26. throw TENANT_MISMATCH if JWT tenant_id differs from header (spoof)', async () => {
      vi.mocked(jwtService.verifyAccessToken).mockReturnValue(
        buildJwtClaims({ tenant_id: '99999999-9999-4999-8999-999999999999' }),
      );
      const req = buildReq();
      try {
        await middleware.use(req, buildRes(), () => {});
        expect.fail('should have thrown');
      } catch (err) {
        const response = (err as ForbiddenException).getResponse() as { code: string };
        expect(response.code).toBe('TENANT_MISMATCH');
      }
    });

    it('27. accept JWT with tenant_id=null (platform-level role)', async () => {
      vi.mocked(jwtService.verifyAccessToken).mockReturnValue(
        buildJwtClaims({ tenant_id: null, role: AuthRole.SuperAdminPlatform }),
      );
      const req = buildReq();
      let captured: string | undefined;
      await middleware.use(req, buildRes(), () => {
        captured = tenantContext.getCurrentTenantId();
      });
      expect(captured).toBe(VALID_TENANT_ID);
    });
  });

  // ==========================================================================
  // GROUP 6 : Context fields propagation
  // ==========================================================================

  describe('context fields', () => {
    it('28. propagate traceId from traceparent header W3C', async () => {
      const tp = '00-aabbccddeeff00112233445566778899-1122334455667788-01';
      const req = buildReq({
        headers: {
          'x-tenant-id': VALID_TENANT_ID,
          authorization: 'Bearer fake',
          traceparent: tp,
        },
      });
      let captured: string | undefined;
      await middleware.use(req, buildRes(), () => {
        captured = tenantContext.getTraceId();
      });
      expect(captured).toBe('aabbccddeeff00112233445566778899');
    });

    it('29. generate traceId if traceparent absent', async () => {
      const req = buildReq();
      let captured: string | undefined;
      await middleware.use(req, buildRes(), () => {
        captured = tenantContext.getTraceId();
      });
      expect(captured).toBeDefined();
      expect(captured?.length).toBeGreaterThan(0);
    });

    it('30. include user-agent in context', async () => {
      const req = buildReq();
      let captured: ReturnType<TenantContextService['getCurrentContext']>;
      await middleware.use(req, buildRes(), () => {
        captured = tenantContext.getCurrentContext();
      });
      expect(captured?.userAgent).toBe('vitest/1.0');
    });

    it('31. tenant settings cached in context', async () => {
      const req = buildReq();
      let captured: ReturnType<TenantContextService['getTenantSettings']>;
      await middleware.use(req, buildRes(), () => {
        captured = tenantContext.getTenantSettings();
      });
      expect(captured?.locale).toBe('fr');
      expect(captured?.currency).toBe('MAD');
    });

    it('32. assure context has both assureUserId AND tenantId', async () => {
      const req = buildReq({ url: '/api/v1/assure/sinistres' });
      let captured: ReturnType<TenantContextService['getCurrentContext']>;
      await middleware.use(req, buildRes(), () => {
        captured = tenantContext.getCurrentContext();
      });
      expect(captured?.tenantId).toBe(VALID_TENANT_ID);
      expect(captured?.assureUserId).toBe(VALID_USER_ID);
      expect(captured?.userId).toBe(VALID_USER_ID);
    });
  });

  // ==========================================================================
  // GROUP 7 : Isolation
  // ==========================================================================

  describe('isolation', () => {
    it('33. context cleared after middleware completes', async () => {
      const req = buildReq();
      await middleware.use(req, buildRes(), () => {});
      expect(tenantContext.getCurrentContext()).toBeUndefined();
    });

    it('34. parallel requests have isolated contexts (zero leak)', async () => {
      vi.mocked(jwtService.verifyAccessToken).mockImplementation(() =>
        buildJwtClaims(),
      );

      const tenantA = '11111111-1111-4111-8111-111111111111';
      const tenantB = '22222222-2222-4222-8222-222222222222';

      vi.mocked(jwtService.verifyAccessToken).mockImplementation((tok: string) => {
        return tok === 'tA'
          ? buildJwtClaims({ tenant_id: tenantA, sub: 'uA' })
          : buildJwtClaims({ tenant_id: tenantB, sub: 'uB' });
      });

      const reqA = buildReq({
        headers: { 'x-tenant-id': tenantA, authorization: 'Bearer tA' },
      });
      const reqB = buildReq({
        headers: { 'x-tenant-id': tenantB, authorization: 'Bearer tB' },
      });

      const results: Array<string | undefined> = [];
      await Promise.all([
        middleware.use(reqA, buildRes(), () => {
          results.push(tenantContext.getCurrentTenantId());
        }),
        middleware.use(reqB, buildRes(), () => {
          results.push(tenantContext.getCurrentTenantId());
        }),
      ]);

      expect(results).toContain(tenantA);
      expect(results).toContain(tenantB);
    });
  });
});
