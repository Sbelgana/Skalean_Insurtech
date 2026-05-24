/**
 * Tests CalendarSyncController -- Sprint 8 Tache 8.10b.
 *
 * Unit-level controller tests : guards bypassed, dependencies mocked. Focus
 * on : 503 fallback when provider disabled, OAuth callback param handling,
 * webhook validation flow (handshake + POST receivers).
 *
 * End-to-end auth + RBAC integration is covered by e2e suite (Sprint 8.14).
 */

import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { TenantContextService } from '@insurtech/auth';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CalendarSyncController } from './calendar-sync.controller.js';
import type { OAuthCalendarConfig } from '../config/oauth-calendar.config.js';
import type { CalendarOAuth2Service } from '../services/calendar-oauth2.service.js';
import type { CalendarSyncTokenService } from '../services/calendar-sync-token.service.js';

const TENANT_A = '00000000-0000-0000-0000-000000000001';
const USER_A = '00000000-0000-0000-0000-000000000002';
const SYNC_ID = '00000000-0000-0000-0000-000000000700';

interface ControllerDeps {
  oauth: CalendarOAuth2Service;
  tokens: CalendarSyncTokenService;
  config: OAuthCalendarConfig;
  tenantContext: TenantContextService;
}

function buildConfig(overrides?: { googleEnabled?: boolean; outlookEnabled?: boolean }) {
  const google = { enabled: overrides?.googleEnabled ?? true };
  const outlook = { enabled: overrides?.outlookEnabled ?? true };
  return {
    google,
    outlook,
    webhookEnabled: true,
    webhookBaseUrl: 'https://real.example.com/wh',
    getProvider(name: 'google' | 'outlook') {
      return name === 'google' ? google : outlook;
    },
  } as unknown as OAuthCalendarConfig;
}

function buildController(opts: Partial<ControllerDeps> = {}): {
  ctrl: CalendarSyncController;
  deps: ControllerDeps;
} {
  const oauth = {
    initiateConnection: vi.fn().mockResolvedValue({ authUrl: 'https://provider/oauth' }),
    handleCallback: vi.fn().mockResolvedValue({
      id: SYNC_ID,
      provider: 'google',
      providerAccountId: 'u@gmail.com',
    }),
    disconnect: vi.fn().mockResolvedValue(undefined),
    getProviderByName: vi.fn(),
    ...opts.oauth,
  } as unknown as CalendarOAuth2Service;
  const tokens = {
    findByUser: vi.fn().mockResolvedValue([]),
    toConnectionInfo: vi.fn((r) => r),
    findByWebhookSubscriptionId: vi.fn(),
    ...opts.tokens,
  } as unknown as CalendarSyncTokenService;
  const config = opts.config ?? buildConfig();
  const tenantContext = {
    getCurrentContext: vi.fn().mockReturnValue({
      tenantId: TENANT_A,
      userId: USER_A,
    }),
    ...opts.tenantContext,
  } as unknown as TenantContextService;
  const ctrl = new CalendarSyncController(oauth, tokens, config, tenantContext);
  return { ctrl, deps: { oauth, tokens, config, tenantContext } };
}

describe('CalendarSyncController (Sprint 8 Tache 8.10b)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('connect', () => {
    it('1. returns authUrl on happy path', async () => {
      const { ctrl, deps } = buildController();
      const out = await ctrl.connect('google');
      expect(out.authUrl).toBe('https://provider/oauth');
      expect(deps.oauth.initiateConnection).toHaveBeenCalledWith('google');
    });

    it('2. throws 503 when provider disabled', async () => {
      const { ctrl } = buildController({
        config: buildConfig({ googleEnabled: false }),
      });
      try {
        await ctrl.connect('google');
        expect.fail('should throw');
      } catch (err) {
        expect(err).toBeInstanceOf(ServiceUnavailableException);
        const res = (err as ServiceUnavailableException).getResponse() as {
          code?: string;
        };
        expect(res.code).toBe('CALENDAR_PROVIDER_DISABLED');
      }
    });

    it('3. rejects unknown provider', async () => {
      const { ctrl } = buildController();
      await expect(ctrl.connect('exchange-2003')).rejects.toThrow(BadRequestException);
    });
  });

  describe('callback', () => {
    it('4. surfaces provider error param as 400', async () => {
      const { ctrl } = buildController();
      try {
        await ctrl.callback('google', 'state-x', undefined, 'access_denied', 'user denied');
        expect.fail('should throw');
      } catch (err) {
        expect(err).toBeInstanceOf(BadRequestException);
        const res = (err as BadRequestException).getResponse() as { code?: string };
        expect(res.code).toBe('CALENDAR_PROVIDER_ERROR');
      }
    });

    it('5. rejects callback without state or code', async () => {
      const { ctrl } = buildController();
      await expect(
        ctrl.callback('google', undefined, 'code-x', undefined, undefined),
      ).rejects.toThrow(BadRequestException);
      await expect(
        ctrl.callback('google', 'state-x', undefined, undefined, undefined),
      ).rejects.toThrow(BadRequestException);
    });

    it('6. returns syncId on happy path', async () => {
      const { ctrl, deps } = buildController();
      const out = await ctrl.callback('google', 'state', 'code', undefined, undefined);
      expect(out.syncId).toBe(SYNC_ID);
      expect(deps.oauth.handleCallback).toHaveBeenCalledWith('state', 'code', 'google');
    });
  });

  describe('listConnections', () => {
    it('7. returns connections array for current user', async () => {
      const { ctrl } = buildController({
        tokens: {
          findByUser: vi.fn().mockResolvedValue([
            { id: SYNC_ID, provider: 'google', syncEnabled: true },
          ]),
          toConnectionInfo: vi.fn((r) => r),
        } as unknown as CalendarSyncTokenService,
      });
      const out = await ctrl.listConnections();
      expect(out.connections).toHaveLength(1);
    });

    it('8. throws when no user context', async () => {
      const { ctrl } = buildController({
        tenantContext: {
          getCurrentContext: vi.fn().mockReturnValue({ tenantId: TENANT_A }),
        } as unknown as TenantContextService,
      });
      await expect(ctrl.listConnections()).rejects.toThrow(BadRequestException);
    });
  });

  describe('webhook health', () => {
    it('9. returns provider availability flags', async () => {
      const { ctrl } = buildController({
        config: buildConfig({ googleEnabled: true, outlookEnabled: false }),
      });
      const out = await ctrl.webhookHealth();
      expect(out.google).toBe(true);
      expect(out.outlook).toBe(false);
      expect(out.enabled).toBe(true);
    });
  });

  describe('outlookWebhookValidation (GET handshake)', () => {
    it('10. echoes validationToken with content-type text/plain', async () => {
      const { ctrl } = buildController();
      const send = vi.fn();
      const status = vi.fn().mockReturnValue({ send });
      const header = vi.fn();
      const res = { status, send, header } as unknown as Parameters<
        typeof ctrl.outlookWebhookValidation
      >[1];
      await ctrl.outlookWebhookValidation('echo-me-back-789', res);
      expect(header).toHaveBeenCalledWith('content-type', 'text/plain');
      expect(status).toHaveBeenCalledWith(200);
      expect(send).toHaveBeenCalledWith('echo-me-back-789');
    });

    it('11. returns 400 when validationToken missing', async () => {
      const { ctrl } = buildController();
      const send = vi.fn();
      const status = vi.fn().mockReturnValue({ send });
      const res = { status, send, header: vi.fn() } as unknown as Parameters<
        typeof ctrl.outlookWebhookValidation
      >[1];
      await ctrl.outlookWebhookValidation(undefined, res);
      expect(status).toHaveBeenCalledWith(400);
    });
  });

  describe('outlookWebhookReceive (POST)', () => {
    it('12. rejects payload without subscriptionId', async () => {
      const provider = {
        validateWebhookPayload: vi.fn().mockReturnValue({
          valid: false,
          reason: 'missing subscriptionId',
        }),
      };
      const { ctrl } = buildController({
        oauth: {
          getProviderByName: vi.fn().mockReturnValue(provider),
        } as unknown as CalendarOAuth2Service,
      });
      const out = await ctrl.outlookWebhookReceive({}, { value: [] });
      expect(out.accepted).toBe(false);
    });

    it('13. rejects unknown subscription id', async () => {
      const provider = {
        validateWebhookPayload: vi.fn().mockReturnValue({
          valid: true,
          subscriptionId: 'unknown-sub',
        }),
      };
      const { ctrl } = buildController({
        oauth: {
          getProviderByName: vi.fn().mockReturnValue(provider),
        } as unknown as CalendarOAuth2Service,
        tokens: {
          findByWebhookSubscriptionId: vi.fn().mockResolvedValue(null),
        } as unknown as CalendarSyncTokenService,
      });
      const out = await ctrl.outlookWebhookReceive({}, {});
      expect(out.accepted).toBe(false);
      expect(out.reason).toMatch(/unknown subscription/i);
    });

    it('14. accepts valid notification with matching clientState', async () => {
      let call = 0;
      const validateWebhookPayload = vi.fn().mockImplementation(() => {
        call++;
        if (call === 1) {
          return { valid: false, subscriptionId: 'sub-abc' };
        }
        return { valid: true, subscriptionId: 'sub-abc', resourceId: 'event-xyz' };
      });
      const provider = { validateWebhookPayload };
      const { ctrl } = buildController({
        oauth: {
          getProviderByName: vi.fn().mockReturnValue(provider),
        } as unknown as CalendarOAuth2Service,
        tokens: {
          findByWebhookSubscriptionId: vi.fn().mockResolvedValue({
            id: SYNC_ID,
            tenantId: TENANT_A,
            metadata: { webhookClientState: 'expected-cs' },
          }),
        } as unknown as CalendarSyncTokenService,
      });
      const out = await ctrl.outlookWebhookReceive({}, {});
      expect(out.accepted).toBe(true);
    });

    it('15. rejects when validation fails (clientState mismatch)', async () => {
      let call = 0;
      const validateWebhookPayload = vi.fn().mockImplementation(() => {
        call++;
        if (call === 1) {
          return { valid: false, subscriptionId: 'sub-abc' };
        }
        return { valid: false, subscriptionId: 'sub-abc', reason: 'clientState mismatch' };
      });
      const provider = { validateWebhookPayload };
      const { ctrl } = buildController({
        oauth: {
          getProviderByName: vi.fn().mockReturnValue(provider),
        } as unknown as CalendarOAuth2Service,
        tokens: {
          findByWebhookSubscriptionId: vi.fn().mockResolvedValue({
            id: SYNC_ID,
            tenantId: TENANT_A,
            metadata: { webhookClientState: 'expected' },
          }),
        } as unknown as CalendarSyncTokenService,
      });
      const out = await ctrl.outlookWebhookReceive({}, {});
      expect(out.accepted).toBe(false);
      expect(out.reason).toMatch(/clientState mismatch/);
    });
  });

  describe('googleWebhookReceive (POST)', () => {
    it('16. rejects missing X-Goog-Channel-ID header', async () => {
      const { ctrl } = buildController({
        oauth: {
          getProviderByName: vi.fn().mockReturnValue({
            validateWebhookPayload: vi.fn(),
          }),
        } as unknown as CalendarOAuth2Service,
      });
      const out = await ctrl.googleWebhookReceive({}, {});
      expect(out.accepted).toBe(false);
      expect(out.reason).toMatch(/missing X-Goog-Channel-ID/);
    });

    it('17. rejects unknown channel', async () => {
      const { ctrl } = buildController({
        oauth: {
          getProviderByName: vi.fn().mockReturnValue({
            validateWebhookPayload: vi.fn(),
          }),
        } as unknown as CalendarOAuth2Service,
        tokens: {
          findByWebhookSubscriptionId: vi.fn().mockResolvedValue(null),
        } as unknown as CalendarSyncTokenService,
      });
      const out = await ctrl.googleWebhookReceive(
        { 'x-goog-channel-id': 'ch-unknown' },
        {},
      );
      expect(out.accepted).toBe(false);
      expect(out.reason).toMatch(/unknown channel/);
    });

    it('18. accepts valid notification', async () => {
      const provider = {
        validateWebhookPayload: vi.fn().mockReturnValue({
          valid: true,
          subscriptionId: 'ch-xyz',
          resourceId: 'event-789',
        }),
      };
      const { ctrl } = buildController({
        oauth: {
          getProviderByName: vi.fn().mockReturnValue(provider),
        } as unknown as CalendarOAuth2Service,
        tokens: {
          findByWebhookSubscriptionId: vi.fn().mockResolvedValue({
            id: SYNC_ID,
            tenantId: TENANT_A,
            metadata: { webhookClientState: 'cs-google' },
          }),
        } as unknown as CalendarSyncTokenService,
      });
      const out = await ctrl.googleWebhookReceive(
        { 'x-goog-channel-id': 'ch-xyz', 'x-goog-channel-token': 'cs-google' },
        {},
      );
      expect(out.accepted).toBe(true);
      expect(provider.validateWebhookPayload).toHaveBeenCalled();
    });

    it('19. rejects when token validation fails', async () => {
      const provider = {
        validateWebhookPayload: vi
          .fn()
          .mockReturnValue({ valid: false, reason: 'X-Goog-Channel-Token mismatch' }),
      };
      const { ctrl } = buildController({
        oauth: {
          getProviderByName: vi.fn().mockReturnValue(provider),
        } as unknown as CalendarOAuth2Service,
        tokens: {
          findByWebhookSubscriptionId: vi.fn().mockResolvedValue({
            id: SYNC_ID,
            tenantId: TENANT_A,
            metadata: { webhookClientState: 'expected' },
          }),
        } as unknown as CalendarSyncTokenService,
      });
      const out = await ctrl.googleWebhookReceive(
        { 'x-goog-channel-id': 'ch-x', 'x-goog-channel-token': 'wrong' },
        {},
      );
      expect(out.accepted).toBe(false);
      expect(out.reason).toMatch(/mismatch/i);
    });
  });

  describe('disconnect', () => {
    it('20. delegates to oauth.disconnect with id', async () => {
      const { ctrl, deps } = buildController();
      await ctrl.disconnect(SYNC_ID);
      expect(deps.oauth.disconnect).toHaveBeenCalledWith(SYNC_ID);
    });
  });
});
