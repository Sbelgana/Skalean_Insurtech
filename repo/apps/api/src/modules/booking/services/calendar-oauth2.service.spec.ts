/**
 * Tests CalendarOAuth2Service -- Sprint 8 Tache 8.10b.
 *
 * Orchestrator unit tests with provider + token-service + state-service mocked.
 * Real HTTP exchanges are tested at the provider level (google-/outlook-
 * calendar.provider.spec.ts).
 */

import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { TenantContextService, type TenantContext } from '@insurtech/auth';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OAuthCalendarConfig } from '../config/oauth-calendar.config.js';
import { GoogleCalendarProvider } from '../providers/google-calendar.provider.js';
import { OutlookCalendarProvider } from '../providers/outlook-calendar.provider.js';
import {
  CALENDAR_OAUTH2_ERROR_CODES,
  CalendarOAuth2Service,
} from './calendar-oauth2.service.js';
import { CalendarSyncTokenService } from './calendar-sync-token.service.js';
import { OAuthStateService } from './oauth-state.service.js';

const TENANT_A = '00000000-0000-0000-0000-000000000001';
const USER_A = '00000000-0000-0000-0000-000000000002';
const SYNC_ID = '00000000-0000-0000-0000-000000000700';

const ENV_KEYS = [
  'GOOGLE_OAUTH_CLIENT_ID',
  'GOOGLE_OAUTH_CLIENT_SECRET',
  'GOOGLE_OAUTH_REDIRECT_URI',
  'MICROSOFT_OAUTH_CLIENT_ID',
  'MICROSOFT_OAUTH_CLIENT_SECRET',
  'MICROSOFT_OAUTH_REDIRECT_URI',
  'CALENDAR_WEBHOOK_BASE_URL',
  'CALENDAR_TOKEN_ENCRYPTION_KEY',
];
const ENV_BACKUP: Record<string, string | undefined> = {};

function setupRealEnv(): void {
  for (const k of ENV_KEYS) ENV_BACKUP[k] = process.env[k];
  process.env['GOOGLE_OAUTH_CLIENT_ID'] = 'real-google-id';
  process.env['GOOGLE_OAUTH_CLIENT_SECRET'] = 'real-google-secret';
  process.env['GOOGLE_OAUTH_REDIRECT_URI'] = 'https://real.example.com/cb/google';
  process.env['MICROSOFT_OAUTH_CLIENT_ID'] = 'real-ms-id';
  process.env['MICROSOFT_OAUTH_CLIENT_SECRET'] = 'real-ms-secret';
  process.env['MICROSOFT_OAUTH_REDIRECT_URI'] = 'https://real.example.com/cb/outlook';
  process.env['CALENDAR_WEBHOOK_BASE_URL'] = 'https://real.example.com/wh';
  process.env['CALENDAR_TOKEN_ENCRYPTION_KEY'] =
    'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2';
}

function restoreEnv(): void {
  for (const k of ENV_KEYS) {
    if (ENV_BACKUP[k] === undefined) delete process.env[k];
    else process.env[k] = ENV_BACKUP[k];
  }
}

function buildTenantContext(tenantId?: string, userId?: string): TenantContextService {
  return {
    getCurrentContext: (): TenantContext | undefined => {
      if (!tenantId) return undefined;
      return {
        tenantId,
        userId: userId ?? USER_A,
        userRole: undefined,
        isSuperAdmin: false,
        traceId: 'trc',
        ipAddress: '127.0.0.1',
        userAgent: 'vitest',
      };
    },
  } as unknown as TenantContextService;
}

interface ServiceMocks {
  state: {
    generate: ReturnType<typeof vi.fn>;
    validateAndConsume: ReturnType<typeof vi.fn>;
  };
  googleProvider: Partial<GoogleCalendarProvider>;
  outlookProvider: Partial<OutlookCalendarProvider>;
  tokenService: Partial<CalendarSyncTokenService>;
}

function buildService(
  opts: { tenantId?: string; userId?: string; mocks?: Partial<ServiceMocks> } = {},
): { service: CalendarOAuth2Service; mocks: ServiceMocks; config: OAuthCalendarConfig } {
  const config = new OAuthCalendarConfig();
  const state = {
    generate: opts.mocks?.state?.generate ?? vi.fn().mockResolvedValue('state-token'),
    validateAndConsume:
      opts.mocks?.state?.validateAndConsume ??
      vi.fn().mockResolvedValue({
        tenantId: TENANT_A,
        userId: USER_A,
        provider: 'google',
        createdAt: Date.now(),
        nonce: 'nonce',
      }),
  };
  const googleProvider = {
    getAuthorizationUrl: vi.fn().mockReturnValue('https://google.com/oauth?state=state-token'),
    exchangeCodeForTokens: vi.fn().mockResolvedValue({
      accessToken: 'access-google',
      refreshToken: 'refresh-google',
      expiresAt: new Date(Date.now() + 3600_000),
      scope: 'calendar',
    }),
    refreshAccessToken: vi.fn().mockResolvedValue({
      accessToken: 'refreshed-google',
      refreshToken: 'refresh-google',
      expiresAt: new Date(Date.now() + 3600_000),
      scope: 'calendar',
    }),
    getUserEmail: vi.fn().mockResolvedValue('user@gmail.com'),
    createWebhookSubscription: vi.fn().mockResolvedValue({
      id: 'channel-abc',
      resourceId: 'resource-xyz',
      expiresAt: new Date(Date.now() + 7 * 24 * 3600_000),
      clientState: 'cs',
    }),
    deleteWebhookSubscription: vi.fn().mockResolvedValue(undefined),
    ...opts.mocks?.googleProvider,
  };
  const outlookProvider = {
    getAuthorizationUrl: vi.fn(),
    ...opts.mocks?.outlookProvider,
  };
  const tokenService = {
    findById: vi.fn(),
    saveTokensAs: vi.fn().mockResolvedValue({
      id: SYNC_ID,
      tenantId: TENANT_A,
      userId: USER_A,
      provider: 'google',
      providerAccountId: 'user@gmail.com',
      syncEnabled: true,
    }),
    saveWebhookSubscriptionAs: vi.fn().mockResolvedValue(undefined),
    recordSyncOutcomeAs: vi.fn().mockResolvedValue(undefined),
    disable: vi.fn().mockResolvedValue(undefined),
    ...opts.mocks?.tokenService,
  };
  const mocks: ServiceMocks = {
    state: state as unknown as ServiceMocks['state'],
    googleProvider: googleProvider as unknown as ServiceMocks['googleProvider'],
    outlookProvider: outlookProvider as unknown as ServiceMocks['outlookProvider'],
    tokenService: tokenService as unknown as ServiceMocks['tokenService'],
  };
  const service = new CalendarOAuth2Service(
    config,
    state as unknown as OAuthStateService,
    googleProvider as unknown as GoogleCalendarProvider,
    outlookProvider as unknown as OutlookCalendarProvider,
    tokenService as unknown as CalendarSyncTokenService,
    buildTenantContext(opts.tenantId, opts.userId),
  );
  return { service, mocks, config };
}

describe('CalendarOAuth2Service (Sprint 8 Tache 8.10b)', () => {
  beforeEach(() => {
    setupRealEnv();
  });

  afterEach(() => {
    restoreEnv();
  });

  describe('initiateConnection', () => {
    it('1. throws 503 when google provider disabled (placeholder credentials)', async () => {
      process.env['GOOGLE_OAUTH_CLIENT_ID'] = 'PLACEHOLDER_x';
      const { service } = buildService({ tenantId: TENANT_A, userId: USER_A });
      try {
        await service.initiateConnection('google');
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ServiceUnavailableException);
        const res = (err as ServiceUnavailableException).getResponse() as { code?: string };
        expect(res.code).toBe(CALENDAR_OAUTH2_ERROR_CODES.PROVIDER_DISABLED);
      }
    });

    it('2. throws when no tenant context', async () => {
      const { service } = buildService({ tenantId: undefined });
      await expect(service.initiateConnection('google')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('3. happy path : returns authUrl + state', async () => {
      const { service, mocks } = buildService({ tenantId: TENANT_A, userId: USER_A });
      const result = await service.initiateConnection('google');
      expect(result.authUrl).toContain('google.com/oauth');
      expect(result.state).toBe('state-token');
      expect(mocks.state.generate).toHaveBeenCalledWith(TENANT_A, USER_A, 'google');
    });
  });

  describe('handleCallback', () => {
    it('4. validates state, exchanges code, persists tokens, returns sync row', async () => {
      const { service, mocks } = buildService({});
      const result = await service.handleCallback('state-token', 'auth-code', 'google');
      expect(mocks.state.validateAndConsume).toHaveBeenCalledWith('state-token');
      expect(mocks.googleProvider.exchangeCodeForTokens).toHaveBeenCalled();
      expect(mocks.googleProvider.getUserEmail).toHaveBeenCalled();
      expect(mocks.tokenService.saveTokensAs).toHaveBeenCalledWith(
        TENANT_A,
        USER_A,
        expect.objectContaining({
          provider: 'google',
          providerAccountId: 'user@gmail.com',
          accessToken: 'access-google',
        }),
      );
      expect(result.id).toBe(SYNC_ID);
    });

    it('5. creates webhook subscription when webhookBaseUrl is real', async () => {
      const { service, mocks } = buildService({});
      await service.handleCallback('state-token', 'auth-code', 'google');
      expect(mocks.googleProvider.createWebhookSubscription).toHaveBeenCalled();
      expect(mocks.tokenService.saveWebhookSubscriptionAs).toHaveBeenCalled();
    });

    it('6. webhook creation failure does NOT rollback token persistence (best-effort)', async () => {
      const failingProvider = {
        getAuthorizationUrl: vi.fn(),
        exchangeCodeForTokens: vi.fn().mockResolvedValue({
          accessToken: 'access',
          refreshToken: 'refresh',
          expiresAt: new Date(Date.now() + 3600_000),
        }),
        refreshAccessToken: vi.fn(),
        getUserEmail: vi.fn().mockResolvedValue('user@gmail.com'),
        createWebhookSubscription: vi.fn().mockRejectedValue(new Error('webhook failed')),
        renewWebhookSubscription: vi.fn(),
        deleteWebhookSubscription: vi.fn(),
        validateWebhookPayload: vi.fn(),
      };
      const { service, mocks } = buildService({
        mocks: { googleProvider: failingProvider as never },
      });
      const result = await service.handleCallback('state-token', 'auth-code', 'google');
      // Tokens still saved despite webhook failure
      expect(mocks.tokenService.saveTokensAs).toHaveBeenCalled();
      expect(result.id).toBe(SYNC_ID);
    });

    it('7. rejects when state provider does not match callback provider', async () => {
      const state = {
        generate: vi.fn(),
        validateAndConsume: vi.fn().mockResolvedValue({
          tenantId: TENANT_A,
          userId: USER_A,
          provider: 'outlook', // mismatch!
          createdAt: Date.now(),
          nonce: 'n',
        }),
      };
      const { service } = buildService({ mocks: { state } });
      await expect(
        service.handleCallback('state-token', 'auth-code', 'google'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getValidAccessToken', () => {
    it('8. returns access token when not expiring soon', async () => {
      const tokenService = {
        findById: vi.fn().mockResolvedValue({
          id: SYNC_ID,
          syncEnabled: true,
          accessToken: 'valid-access',
          tokenExpiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 min ahead
        }),
      };
      const { service } = buildService({
        mocks: { tokenService: tokenService as never },
      });
      const token = await service.getValidAccessToken(SYNC_ID);
      expect(token).toBe('valid-access');
    });

    it('9. returns null when sync disabled', async () => {
      const tokenService = {
        findById: vi.fn().mockResolvedValue({
          id: SYNC_ID,
          syncEnabled: false,
          accessToken: 'whatever',
          tokenExpiresAt: new Date(Date.now() + 3600_000),
        }),
      };
      const { service } = buildService({
        mocks: { tokenService: tokenService as never },
      });
      expect(await service.getValidAccessToken(SYNC_ID)).toBeNull();
    });

    it('10. refreshes token when within REFRESH_BUFFER_MS', async () => {
      const tokenService = {
        findById: vi.fn().mockResolvedValue({
          id: SYNC_ID,
          tenantId: TENANT_A,
          userId: USER_A,
          provider: 'google',
          providerAccountId: 'u@gmail.com',
          syncEnabled: true,
          accessToken: 'old-access',
          refreshToken: 'refresh-token',
          tokenExpiresAt: new Date(Date.now() + 60 * 1000), // 1 min ahead (< 5 min buffer)
        }),
        saveTokensAs: vi.fn().mockResolvedValue(undefined),
        recordSyncOutcomeAs: vi.fn().mockResolvedValue(undefined),
      };
      const { service, mocks } = buildService({
        mocks: { tokenService: tokenService as never },
      });
      const token = await service.getValidAccessToken(SYNC_ID);
      expect(token).toBe('refreshed-google');
      expect(mocks.googleProvider.refreshAccessToken).toHaveBeenCalledWith('refresh-token');
      expect(mocks.tokenService.saveTokensAs).toHaveBeenCalled();
    });

    it('11. returns null + records failure when refresh token missing', async () => {
      const tokenService = {
        findById: vi.fn().mockResolvedValue({
          id: SYNC_ID,
          tenantId: TENANT_A,
          userId: USER_A,
          provider: 'google',
          syncEnabled: true,
          accessToken: 'old',
          refreshToken: null,
          tokenExpiresAt: new Date(Date.now() + 60 * 1000),
        }),
        recordSyncOutcomeAs: vi.fn().mockResolvedValue(undefined),
      };
      const { service, mocks } = buildService({
        mocks: { tokenService: tokenService as never },
      });
      const token = await service.getValidAccessToken(SYNC_ID);
      expect(token).toBeNull();
      expect(mocks.tokenService.recordSyncOutcomeAs).toHaveBeenCalledWith(
        TENANT_A,
        SYNC_ID,
        expect.objectContaining({ status: 'failed' }),
      );
    });
  });

  describe('disconnect', () => {
    it('12. deletes webhook + disables sync', async () => {
      const tokenService = {
        findById: vi.fn().mockResolvedValue({
          id: SYNC_ID,
          tenantId: TENANT_A,
          userId: USER_A,
          provider: 'google',
          syncEnabled: true,
          accessToken: 'access',
          webhookSubscriptionId: 'channel-abc',
        }),
        disable: vi.fn().mockResolvedValue(undefined),
      };
      const { service, mocks } = buildService({
        mocks: { tokenService: tokenService as never },
      });
      await service.disconnect(SYNC_ID);
      expect(mocks.googleProvider.deleteWebhookSubscription).toHaveBeenCalled();
      expect(mocks.tokenService.disable).toHaveBeenCalledWith(SYNC_ID);
    });

    it('13. disable still happens even when webhook delete fails (best-effort)', async () => {
      const failingProvider = {
        getAuthorizationUrl: vi.fn(),
        exchangeCodeForTokens: vi.fn(),
        refreshAccessToken: vi.fn(),
        getUserEmail: vi.fn(),
        createWebhookSubscription: vi.fn(),
        renewWebhookSubscription: vi.fn(),
        deleteWebhookSubscription: vi.fn().mockRejectedValue(new Error('404')),
        validateWebhookPayload: vi.fn(),
      };
      const tokenService = {
        findById: vi.fn().mockResolvedValue({
          id: SYNC_ID,
          tenantId: TENANT_A,
          provider: 'google',
          syncEnabled: true,
          accessToken: 'access',
          webhookSubscriptionId: 'channel-abc',
        }),
        disable: vi.fn().mockResolvedValue(undefined),
      };
      const { service } = buildService({
        mocks: {
          googleProvider: failingProvider as never,
          tokenService: tokenService as never,
        },
      });
      await service.disconnect(SYNC_ID);
      expect(tokenService.disable).toHaveBeenCalled();
    });
  });

  describe('error codes constant', () => {
    it('14. exposes expected error codes', () => {
      expect(CALENDAR_OAUTH2_ERROR_CODES.PROVIDER_DISABLED).toBe(
        'CALENDAR_OAUTH2_PROVIDER_DISABLED',
      );
      expect(CALENDAR_OAUTH2_ERROR_CODES.REFRESH_FAILED).toBe(
        'CALENDAR_OAUTH2_REFRESH_FAILED',
      );
    });
  });
});
