/**
 * Tests CalendarWebhookManagerService -- Sprint 8 Tache 8.10b.
 *
 * Unit tests focus on : cron orchestration logic, provider-specific renewal
 * (Google DELETE+CREATE vs Microsoft PATCH in-place), failure handling
 * (recordSyncOutcome on error).
 *
 * HTTP-level provider tests live in the provider spec files.
 */

import type { BookingCalendarSyncEntity } from '@insurtech/database';
import { describe, expect, it, vi } from 'vitest';
import type { CalendarProvider } from '../providers/calendar-provider.interface.js';
import { CalendarOAuth2Service } from './calendar-oauth2.service.js';
import { CalendarSyncTokenService } from './calendar-sync-token.service.js';
import { CalendarWebhookManagerService } from './calendar-webhook-manager.service.js';

const TENANT_A = '00000000-0000-0000-0000-000000000001';
const USER_A = '00000000-0000-0000-0000-000000000002';
const SYNC_GOOGLE = '00000000-0000-0000-0000-000000000800';
const SYNC_OUTLOOK = '00000000-0000-0000-0000-000000000801';

function buildGoogleRow(
  overrides: Partial<BookingCalendarSyncEntity> = {},
): BookingCalendarSyncEntity {
  return {
    id: SYNC_GOOGLE,
    tenantId: TENANT_A,
    userId: USER_A,
    provider: 'google',
    providerAccountId: 'user@gmail.com',
    syncEnabled: true,
    webhookSubscriptionId: 'old-channel-id',
    webhookResourceId: 'resource-xyz',
    webhookExpiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1h ahead
    metadata: { webhookClientState: 'persisted-cs' },
    consecutiveFailures: 0,
    ...overrides,
  } as unknown as BookingCalendarSyncEntity;
}

function buildOutlookRow(
  overrides: Partial<BookingCalendarSyncEntity> = {},
): BookingCalendarSyncEntity {
  return {
    id: SYNC_OUTLOOK,
    tenantId: TENANT_A,
    userId: USER_A,
    provider: 'outlook',
    providerAccountId: 'user@outlook.com',
    syncEnabled: true,
    webhookSubscriptionId: 'ms-sub-id',
    webhookExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    metadata: { webhookClientState: 'persisted-ms-cs' },
    consecutiveFailures: 0,
    ...overrides,
  } as unknown as BookingCalendarSyncEntity;
}

interface SetupOpts {
  expiring?: BookingCalendarSyncEntity[];
  accessToken?: string | null;
  providerOverrides?: Partial<CalendarProvider>;
  webhookBaseUrl?: string;
}

function setup(opts: SetupOpts = {}) {
  const provider: Partial<CalendarProvider> = {
    deleteWebhookSubscription: vi.fn().mockResolvedValue(undefined),
    createWebhookSubscription: vi.fn().mockResolvedValue({
      id: 'new-channel-id',
      resourceId: 'new-resource-xyz',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      clientState: 'persisted-cs',
    }),
    renewWebhookSubscription: vi.fn().mockResolvedValue({
      id: 'ms-sub-id',
      expiresAt: new Date(Date.now() + 70 * 60 * 60 * 1000),
      clientState: 'persisted-ms-cs',
    }),
    ...opts.providerOverrides,
  };

  const accessTokenValue =
    'accessToken' in opts ? opts.accessToken : 'access-token-xyz';
  const oauth = {
    getValidAccessToken: vi.fn().mockResolvedValue(accessTokenValue),
    getProviderByName: vi.fn().mockReturnValue(provider as CalendarProvider),
    getWebhookUrlFor: vi
      .fn()
      .mockReturnValue(opts.webhookBaseUrl ?? 'https://example.com/wh/google'),
  } as unknown as CalendarOAuth2Service;

  const tokens = {
    findWebhooksExpiringWithin: vi.fn().mockResolvedValue(opts.expiring ?? []),
    saveWebhookSubscriptionAs: vi.fn().mockResolvedValue(undefined),
    recordSyncOutcomeAs: vi.fn().mockResolvedValue(undefined),
  } as unknown as CalendarSyncTokenService;

  const service = new CalendarWebhookManagerService(oauth, tokens);
  return { service, oauth, tokens, provider };
}

describe('CalendarWebhookManagerService (Sprint 8 Tache 8.10b)', () => {
  describe('renewAllExpiring (cron entry)', () => {
    it('1. returns zero counters when no webhooks expiring', async () => {
      const { service, oauth } = setup({ expiring: [] });
      const result = await service.renewAllExpiring();
      expect(result).toEqual({ attempted: 0, succeeded: 0, failed: 0 });
      expect(oauth.getValidAccessToken).not.toHaveBeenCalled();
    });

    it('2. renews multiple webhooks and accumulates counters', async () => {
      const rows = [buildGoogleRow(), buildOutlookRow()];
      const { service, tokens } = setup({ expiring: rows });
      const result = await service.renewAllExpiring();
      expect(result.attempted).toBe(2);
      expect(result.succeeded).toBe(2);
      expect(result.failed).toBe(0);
      expect(tokens.saveWebhookSubscriptionAs).toHaveBeenCalledTimes(2);
    });

    it('3. captures per-row failures and records sync outcome', async () => {
      const rows = [buildGoogleRow()];
      const failingProvider: Partial<CalendarProvider> = {
        deleteWebhookSubscription: vi.fn().mockResolvedValue(undefined),
        createWebhookSubscription: vi
          .fn()
          .mockRejectedValue(new Error('Google rate limited')),
      };
      const { service, tokens } = setup({
        expiring: rows,
        providerOverrides: failingProvider,
      });
      const result = await service.renewAllExpiring();
      expect(result.attempted).toBe(1);
      expect(result.succeeded).toBe(0);
      expect(result.failed).toBe(1);
      expect(tokens.recordSyncOutcomeAs).toHaveBeenCalledWith(
        TENANT_A,
        SYNC_GOOGLE,
        expect.objectContaining({ status: 'failed' }),
      );
    });

    it('4. continues processing remaining rows after individual failure', async () => {
      const rows = [buildGoogleRow({ id: 'g1' } as Partial<BookingCalendarSyncEntity>), buildOutlookRow()];
      let call = 0;
      const provider: Partial<CalendarProvider> = {
        deleteWebhookSubscription: vi.fn().mockResolvedValue(undefined),
        createWebhookSubscription: vi.fn(() => {
          call++;
          if (call === 1) return Promise.reject(new Error('fail first'));
          return Promise.resolve({
            id: 'ok',
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            clientState: 'cs',
          });
        }),
        renewWebhookSubscription: vi.fn().mockResolvedValue({
          id: 'ms-sub-id',
          expiresAt: new Date(Date.now() + 70 * 60 * 60 * 1000),
        }),
      };
      const { service } = setup({
        expiring: rows,
        providerOverrides: provider,
      });
      const result = await service.renewAllExpiring();
      expect(result.attempted).toBe(2);
      expect(result.succeeded).toBe(1);
      expect(result.failed).toBe(1);
    });
  });

  describe('renewOne -- provider-specific behavior', () => {
    it('5. Google : DELETE old subscription then CREATE new (no renew API)', async () => {
      const row = buildGoogleRow();
      const { service, provider, tokens } = setup({ expiring: [row] });
      await service.renewOne(row);
      expect(provider.deleteWebhookSubscription).toHaveBeenCalledWith(
        'access-token-xyz',
        'old-channel-id',
      );
      expect(provider.createWebhookSubscription).toHaveBeenCalled();
      // Should NOT call renewWebhookSubscription on Google
      expect(provider.renewWebhookSubscription).not.toHaveBeenCalled();
      // saveWebhookSubscriptionAs called with NEW subscription id + persisted clientState
      expect(tokens.saveWebhookSubscriptionAs).toHaveBeenCalledWith(
        TENANT_A,
        SYNC_GOOGLE,
        expect.objectContaining({ webhookSubscriptionId: 'new-channel-id' }),
        'persisted-cs',
      );
    });

    it('6. Google : delete failure during renewal is best-effort (proceeds to create)', async () => {
      const row = buildGoogleRow();
      const provider: Partial<CalendarProvider> = {
        deleteWebhookSubscription: vi
          .fn()
          .mockRejectedValue(new Error('expired channel 410')),
        createWebhookSubscription: vi.fn().mockResolvedValue({
          id: 'new-channel-id',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          clientState: 'cs',
        }),
      };
      const { service, tokens } = setup({
        expiring: [row],
        providerOverrides: provider,
      });
      await service.renewOne(row);
      expect(provider.createWebhookSubscription).toHaveBeenCalled();
      expect(tokens.saveWebhookSubscriptionAs).toHaveBeenCalled();
    });

    it('7. Microsoft : in-place PATCH renewal preserves subscription id', async () => {
      const row = buildOutlookRow();
      const { service, provider, tokens } = setup({ expiring: [row] });
      await service.renewOne(row);
      expect(provider.renewWebhookSubscription).toHaveBeenCalledWith(
        'access-token-xyz',
        'ms-sub-id',
      );
      // No delete/create on Microsoft path
      expect(provider.deleteWebhookSubscription).not.toHaveBeenCalled();
      expect(provider.createWebhookSubscription).not.toHaveBeenCalled();
      expect(tokens.saveWebhookSubscriptionAs).toHaveBeenCalledWith(
        TENANT_A,
        SYNC_OUTLOOK,
        expect.objectContaining({ webhookSubscriptionId: 'ms-sub-id' }),
        'persisted-ms-cs',
      );
    });

    it('8. throws when no webhook subscription id present', async () => {
      const row = buildGoogleRow({ webhookSubscriptionId: null } as Partial<BookingCalendarSyncEntity>);
      const { service } = setup({ expiring: [row] });
      await expect(service.renewOne(row)).rejects.toThrow(/no webhook subscription/i);
    });

    it('9. throws when access token unavailable (disabled or refresh failed)', async () => {
      const row = buildGoogleRow();
      const { service } = setup({ expiring: [row], accessToken: null });
      await expect(service.renewOne(row)).rejects.toThrow(/access token unavailable/i);
    });

    it('10. Google : generates fresh clientState when metadata missing', async () => {
      const row = buildGoogleRow({
        metadata: undefined,
      } as unknown as Partial<BookingCalendarSyncEntity>);
      const { service, tokens } = setup({ expiring: [row] });
      await service.renewOne(row);
      const call = (tokens.saveWebhookSubscriptionAs as unknown as ReturnType<typeof vi.fn>)
        .mock.calls[0];
      const clientStateArg = call?.[3] as string;
      // Generated state is hex 32 chars (16 bytes)
      expect(typeof clientStateArg).toBe('string');
      expect(clientStateArg.length).toBeGreaterThan(0);
    });
  });
});
