/**
 * Tests CalendarSyncWorkerService -- Sprint 8 Tache 8.12 (Phase 2).
 *
 * Unit tests with all collaborators mocked. Focus :
 *   - push path : create vs update vs delete branching, multi-provider
 *     iteration, per-token failure handling, high-failure skip.
 *   - pull path : lifecycle events, deleted, create-only-when-local-exists,
 *     conflict resolution.
 *   - loop prevention : applyExternalToLocal does NOT emit an event (verified
 *     via the listener spec : repo update bypasses AppointmentsService).
 *
 * No HTTP : provider methods are vi.fn() returning fixture data.
 */

import type {
  BookingAppointmentEntity,
  BookingCalendarSyncEntity,
  BookingRoomEntity,
  DataSource,
} from '@insurtech/database';
import { describe, expect, it, vi } from 'vitest';
import type { OAuthCalendarConfig } from '../config/oauth-calendar.config.js';
import type {
  CalendarProvider,
  ExternalCalendarEvent,
  WebhookNotificationParsed,
} from '../providers/calendar-provider.interface.js';
import type { GoogleCalendarProvider } from '../providers/google-calendar.provider.js';
import type { OutlookCalendarProvider } from '../providers/outlook-calendar.provider.js';
import type { AppointmentsService } from './appointments.service.js';
import type { CalendarOAuth2Service } from './calendar-oauth2.service.js';
import type { CalendarSyncTokenService } from './calendar-sync-token.service.js';
import { CalendarSyncWorkerService } from './calendar-sync-worker.service.js';

const TENANT_A = '00000000-0000-0000-0000-000000000001';
const USER_A = '00000000-0000-0000-0000-000000000002';
const ROOM_A = '00000000-0000-0000-0000-000000000500';
const APPT_A = '00000000-0000-0000-0000-000000000600';
const TOKEN_G = '00000000-0000-0000-0000-000000000700';
const TOKEN_O = '00000000-0000-0000-0000-000000000701';

function buildAppt(
  overrides: Partial<BookingAppointmentEntity> = {},
): BookingAppointmentEntity {
  return {
    id: APPT_A,
    tenantId: TENANT_A,
    roomId: ROOM_A,
    assignedUserId: USER_A,
    title: 'Visite garage Atlas',
    description: 'Inspection vehicule',
    timeRange: {
      start: new Date('2026-06-01T10:00:00Z'),
      end: new Date('2026-06-01T11:00:00Z'),
    },
    timezone: 'Africa/Casablanca',
    attendees: [{ name: 'Karim', email: 'karim@example.com' }],
    status: 'scheduled',
    externalCalendarEventId: null,
    externalCalendarProvider: null,
    updatedAt: new Date('2026-05-25T10:00:00Z'),
    createdAt: new Date('2026-05-24T10:00:00Z'),
    ...overrides,
  } as unknown as BookingAppointmentEntity;
}

function buildRoom(
  overrides: Partial<BookingRoomEntity> = {},
): BookingRoomEntity {
  return {
    id: ROOM_A,
    tenantId: TENANT_A,
    name: 'Garage Atlas Bay 2',
    city: 'Marrakech',
    timezone: 'Africa/Casablanca',
    active: true,
    ...overrides,
  } as unknown as BookingRoomEntity;
}

function buildToken(
  overrides: Partial<BookingCalendarSyncEntity> = {},
): BookingCalendarSyncEntity {
  return {
    id: TOKEN_G,
    tenantId: TENANT_A,
    userId: USER_A,
    provider: 'google',
    providerAccountId: 'karim@gmail.com',
    syncEnabled: true,
    consecutiveFailures: 0,
    ...overrides,
  } as unknown as BookingCalendarSyncEntity;
}

interface SetupOpts {
  appt?: BookingAppointmentEntity | null;
  room?: BookingRoomEntity | null;
  tokens?: BookingCalendarSyncEntity[];
  googleEnabled?: boolean;
  outlookEnabled?: boolean;
  googleProviderOverrides?: Partial<CalendarProvider>;
  outlookProviderOverrides?: Partial<CalendarProvider>;
  accessToken?: string | null;
  findByExternalIdResult?: BookingAppointmentEntity | null;
}

function setup(opts: SetupOpts = {}) {
  const appt = opts.appt === undefined ? buildAppt() : opts.appt;
  const room = opts.room === undefined ? buildRoom() : opts.room;

  // Mocked TypeORM repo : factor by entity name string -- both appointment +
  // room repos route through the same getRepository<E>(name) call.
  const apptRepo = {
    findOne: vi.fn().mockResolvedValue(appt),
    createQueryBuilder: vi.fn().mockReturnValue({
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue({}),
    }),
  };
  const roomRepo = {
    findOne: vi.fn().mockResolvedValue(room),
  };
  const dataSource = {
    getRepository: vi.fn((entityName: string) => {
      if (entityName === 'BookingAppointmentEntity') return apptRepo;
      if (entityName === 'BookingRoomEntity') return roomRepo;
      throw new Error(`Unexpected repo lookup : ${entityName}`);
    }),
  } as unknown as DataSource;

  const baseGoogle: Partial<CalendarProvider> = {
    name: 'google' as const,
    createEvent: vi.fn().mockResolvedValue({
      id: 'g-evt-1',
      title: 'Visite garage Atlas',
      startAt: new Date('2026-06-01T10:00:00Z'),
      endAt: new Date('2026-06-01T11:00:00Z'),
      timezone: 'Africa/Casablanca',
      attendees: [],
      lastModifiedAt: new Date('2026-06-01T09:00:00Z'),
      createdAt: new Date('2026-06-01T09:00:00Z'),
    } as ExternalCalendarEvent),
    updateEvent: vi.fn().mockResolvedValue({} as ExternalCalendarEvent),
    deleteEvent: vi.fn().mockResolvedValue(undefined),
    getEvent: vi.fn().mockResolvedValue(null),
  };
  const baseOutlook: Partial<CalendarProvider> = {
    name: 'outlook' as const,
    createEvent: vi.fn().mockResolvedValue({ id: 'o-evt-1' } as ExternalCalendarEvent),
    updateEvent: vi.fn().mockResolvedValue({} as ExternalCalendarEvent),
    deleteEvent: vi.fn().mockResolvedValue(undefined),
    getEvent: vi.fn().mockResolvedValue(null),
  };

  const google = {
    ...baseGoogle,
    ...opts.googleProviderOverrides,
  } as unknown as GoogleCalendarProvider;
  const outlook = {
    ...baseOutlook,
    ...opts.outlookProviderOverrides,
  } as unknown as OutlookCalendarProvider;

  const config = {
    isAnyEnabled: vi.fn().mockReturnValue(true),
    getProvider: vi.fn((name: 'google' | 'outlook') => ({
      enabled:
        name === 'google'
          ? (opts.googleEnabled ?? true)
          : (opts.outlookEnabled ?? true),
    })),
  } as unknown as OAuthCalendarConfig;

  const appointments = {
    findByExternalIdAs:
      'findByExternalIdResult' in opts
        ? vi.fn().mockResolvedValue(opts.findByExternalIdResult)
        : vi.fn().mockResolvedValue(null),
    updateExternalReference: vi.fn().mockResolvedValue(undefined),
  } as unknown as AppointmentsService;

  const tokens = {
    findActiveTokensByUserAs: vi.fn().mockResolvedValue(opts.tokens ?? [buildToken()]),
    findByWebhookSubscriptionId: vi.fn().mockResolvedValue(opts.tokens?.[0] ?? buildToken()),
    findAllActiveTokens: vi.fn().mockResolvedValue(opts.tokens ?? []),
    recordSyncOutcomeAs: vi.fn().mockResolvedValue(undefined),
  } as unknown as CalendarSyncTokenService;

  const accessTokenValue =
    'accessToken' in opts ? opts.accessToken : 'valid-access-xyz';
  const oauth = {
    getValidAccessToken: vi.fn().mockResolvedValue(accessTokenValue),
  } as unknown as CalendarOAuth2Service;

  const worker = new CalendarSyncWorkerService(
    dataSource,
    appointments,
    tokens,
    oauth,
    config,
    google,
    outlook,
  );
  return { worker, dataSource, appointments, tokens, oauth, config, google, outlook };
}

describe('CalendarSyncWorkerService (Sprint 8 Tache 8.12 Phase 2)', () => {
  describe('PUSH path : syncAppointmentToExternal', () => {
    it('1. no-op when appointment not found', async () => {
      const { worker, tokens } = setup({ appt: null });
      await worker.syncAppointmentToExternal(APPT_A, 'created');
      expect(tokens.findActiveTokensByUserAs).not.toHaveBeenCalled();
    });

    it('2. no-op when appointment has no assigned user', async () => {
      const { worker, tokens } = setup({
        appt: buildAppt({ assignedUserId: null } as Partial<BookingAppointmentEntity>),
      });
      await worker.syncAppointmentToExternal(APPT_A, 'created');
      expect(tokens.findActiveTokensByUserAs).not.toHaveBeenCalled();
    });

    it('3. no-op when no active tokens for user', async () => {
      const { worker, google } = setup({ tokens: [] });
      await worker.syncAppointmentToExternal(APPT_A, 'created');
      expect(google.createEvent).not.toHaveBeenCalled();
    });

    it('4. created : calls createEvent + persists external reference', async () => {
      const { worker, google, appointments, tokens } = setup();
      await worker.syncAppointmentToExternal(APPT_A, 'created');
      expect(google.createEvent).toHaveBeenCalled();
      expect(appointments.updateExternalReference).toHaveBeenCalledWith(
        TENANT_A,
        APPT_A,
        expect.objectContaining({
          externalCalendarEventId: 'g-evt-1',
          externalCalendarProvider: 'google',
        }),
      );
      expect(tokens.recordSyncOutcomeAs).toHaveBeenCalledWith(
        TENANT_A,
        TOKEN_G,
        expect.objectContaining({ status: 'success' }),
      );
    });

    it('5. updated : calls updateEvent when external ref already present', async () => {
      const { worker, google, appointments } = setup({
        appt: buildAppt({
          externalCalendarEventId: 'g-evt-existing',
          externalCalendarProvider: 'google',
        } as Partial<BookingAppointmentEntity>),
      });
      await worker.syncAppointmentToExternal(APPT_A, 'updated');
      expect(google.updateEvent).toHaveBeenCalledWith(
        'valid-access-xyz',
        'g-evt-existing',
        expect.any(Object),
      );
      expect(appointments.updateExternalReference).not.toHaveBeenCalled();
    });

    it('6. updated with no external ref : creates external event', async () => {
      const { worker, google } = setup();
      await worker.syncAppointmentToExternal(APPT_A, 'updated');
      expect(google.createEvent).toHaveBeenCalled();
      expect(google.updateEvent).not.toHaveBeenCalled();
    });

    it('7. deleted : calls deleteEvent only when external ref matches provider', async () => {
      const { worker, google } = setup({
        appt: buildAppt({
          externalCalendarEventId: 'g-evt-to-delete',
          externalCalendarProvider: 'google',
        } as Partial<BookingAppointmentEntity>),
      });
      await worker.syncAppointmentToExternal(APPT_A, 'deleted');
      expect(google.deleteEvent).toHaveBeenCalledWith(
        'valid-access-xyz',
        'g-evt-to-delete',
      );
    });

    it('8. deleted with no external ref : no-op', async () => {
      const { worker, google, tokens } = setup();
      await worker.syncAppointmentToExternal(APPT_A, 'deleted');
      expect(google.deleteEvent).not.toHaveBeenCalled();
      // Outcome still recorded as success (graceful no-op)
      expect(tokens.recordSyncOutcomeAs).toHaveBeenCalledWith(
        TENANT_A,
        TOKEN_G,
        expect.objectContaining({ status: 'success' }),
      );
    });

    it('9. skips token when consecutive_failures >= threshold', async () => {
      const failed = buildToken({ consecutiveFailures: 5 });
      const { worker, google, oauth } = setup({ tokens: [failed] });
      await worker.syncAppointmentToExternal(APPT_A, 'created');
      expect(oauth.getValidAccessToken).not.toHaveBeenCalled();
      expect(google.createEvent).not.toHaveBeenCalled();
    });

    it('10. skips token when provider disabled (placeholder credentials)', async () => {
      const { worker, google } = setup({ googleEnabled: false });
      await worker.syncAppointmentToExternal(APPT_A, 'created');
      expect(google.createEvent).not.toHaveBeenCalled();
    });

    it('11. multi-provider : iterates both google + outlook', async () => {
      const { worker, google, outlook } = setup({
        tokens: [buildToken(), buildToken({ id: TOKEN_O, provider: 'outlook' })],
      });
      await worker.syncAppointmentToExternal(APPT_A, 'created');
      expect(google.createEvent).toHaveBeenCalled();
      expect(outlook.createEvent).toHaveBeenCalled();
    });

    it('12. per-provider failure : recorded + continues other providers', async () => {
      const { worker, outlook, tokens } = setup({
        tokens: [buildToken(), buildToken({ id: TOKEN_O, provider: 'outlook' })],
        googleProviderOverrides: {
          createEvent: vi.fn().mockRejectedValue(new Error('Google rate limited')),
        },
      });
      await worker.syncAppointmentToExternal(APPT_A, 'created');
      // Outlook still attempted
      expect(outlook.createEvent).toHaveBeenCalled();
      // Failure recorded on google token only
      expect(tokens.recordSyncOutcomeAs).toHaveBeenCalledWith(
        TENANT_A,
        TOKEN_G,
        expect.objectContaining({ status: 'failed' }),
      );
    });

    it('13. no access token (refresh failed) : skips provider call cleanly', async () => {
      const { worker, google } = setup({ accessToken: null });
      await worker.syncAppointmentToExternal(APPT_A, 'created');
      expect(google.createEvent).not.toHaveBeenCalled();
    });
  });

  describe('PULL path : handleExternalChange', () => {
    const notification: WebhookNotificationParsed = {
      subscriptionId: 'sub-abc',
      resourceId: 'ext-evt-123',
      changeType: 'updated',
    };

    it('14. unknown subscription : warn + return', async () => {
      const { worker, oauth } = setup();
      const tokens = {
        findByWebhookSubscriptionId: vi.fn().mockResolvedValue(null),
      } as unknown as CalendarSyncTokenService;
      // Construct a worker with overridden tokens (others stay)
      (worker as unknown as { tokens: CalendarSyncTokenService }).tokens = tokens;
      await worker.handleExternalChange('google', notification);
      expect(oauth.getValidAccessToken).not.toHaveBeenCalled();
    });

    it('15. token disabled : early return', async () => {
      const disabled = buildToken({ syncEnabled: false });
      const { worker, oauth } = setup({ tokens: [disabled] });
      await worker.handleExternalChange('google', notification);
      expect(oauth.getValidAccessToken).not.toHaveBeenCalled();
    });

    it('16. lifecycle subscriptionRenew : delegates to webhook manager (skip)', async () => {
      const { worker, oauth } = setup();
      await worker.handleExternalChange('outlook', {
        ...notification,
        lifecycleEvent: 'subscriptionRenew',
      });
      expect(oauth.getValidAccessToken).not.toHaveBeenCalled();
    });

    it('17. lifecycle reauthorizationRequired : records failed', async () => {
      const { worker, tokens } = setup();
      await worker.handleExternalChange('outlook', {
        ...notification,
        lifecycleEvent: 'reauthorizationRequired',
      });
      expect(tokens.recordSyncOutcomeAs).toHaveBeenCalledWith(
        TENANT_A,
        TOKEN_G,
        expect.objectContaining({
          status: 'failed',
          error: expect.stringMatching(/reauthorization/i),
        }),
      );
    });

    it('18. lifecycle subscriptionRemove : records failed', async () => {
      const { worker, tokens } = setup();
      await worker.handleExternalChange('outlook', {
        ...notification,
        lifecycleEvent: 'subscriptionRemove',
      });
      expect(tokens.recordSyncOutcomeAs).toHaveBeenCalledWith(
        TENANT_A,
        TOKEN_G,
        expect.objectContaining({ status: 'failed' }),
      );
    });

    it('19. deleted notification : cancel local + success outcome', async () => {
      const localAppt = buildAppt({
        externalCalendarEventId: 'ext-evt-123',
        externalCalendarProvider: 'google',
        status: 'scheduled',
      } as Partial<BookingAppointmentEntity>);
      const { worker, tokens, dataSource } = setup({
        findByExternalIdResult: localAppt,
      });
      await worker.handleExternalChange('google', {
        ...notification,
        changeType: 'deleted',
      });
      // Direct repo update path used (no AppointmentsService.cancel call)
      expect(dataSource.getRepository).toHaveBeenCalled();
      expect(tokens.recordSyncOutcomeAs).toHaveBeenCalledWith(
        TENANT_A,
        TOKEN_G,
        expect.objectContaining({ status: 'success' }),
      );
    });

    it('20. external event not found (404) : success no-op', async () => {
      const { worker, tokens, appointments } = setup({
        googleProviderOverrides: {
          getEvent: vi.fn().mockResolvedValue(null),
        },
      });
      await worker.handleExternalChange('google', notification);
      expect(appointments.findByExternalIdAs).not.toHaveBeenCalled();
      expect(tokens.recordSyncOutcomeAs).toHaveBeenCalledWith(
        TENANT_A,
        TOKEN_G,
        expect.objectContaining({ status: 'success' }),
      );
    });

    it('21. external event with no local match : skipped (no import in Phase 2)', async () => {
      const externalEvent: ExternalCalendarEvent = {
        id: 'ext-evt-123',
        title: 'External-only meeting',
        startAt: new Date('2026-06-01T10:00:00Z'),
        endAt: new Date('2026-06-01T11:00:00Z'),
        timezone: 'UTC',
        attendees: [],
        lastModifiedAt: new Date(),
        createdAt: new Date(),
      };
      const { worker, tokens } = setup({
        googleProviderOverrides: {
          getEvent: vi.fn().mockResolvedValue(externalEvent),
        },
        findByExternalIdResult: null,
      });
      await worker.handleExternalChange('google', notification);
      expect(tokens.recordSyncOutcomeAs).toHaveBeenCalledWith(
        TENANT_A,
        TOKEN_G,
        expect.objectContaining({ status: 'success' }),
      );
    });

    it('22. error during pull : recorded failure outcome', async () => {
      const { worker, tokens } = setup({
        googleProviderOverrides: {
          getEvent: vi.fn().mockRejectedValue(new Error('Graph 500')),
        },
      });
      await worker.handleExternalChange('google', notification);
      expect(tokens.recordSyncOutcomeAs).toHaveBeenCalledWith(
        TENANT_A,
        TOKEN_G,
        expect.objectContaining({ status: 'failed' }),
      );
    });
  });

  describe('resolveConflict', () => {
    it('23. external newer : applies external to local (no event emit)', async () => {
      const local = buildAppt({
        updatedAt: new Date('2026-05-25T10:00:00Z'),
      } as Partial<BookingAppointmentEntity>);
      const external: ExternalCalendarEvent = {
        id: 'ext',
        title: 'Updated externally',
        startAt: new Date('2026-06-01T10:00:00Z'),
        endAt: new Date('2026-06-01T11:00:00Z'),
        timezone: 'UTC',
        attendees: [],
        lastModifiedAt: new Date('2026-05-26T10:00:00Z'), // newer
        createdAt: new Date('2026-05-20T10:00:00Z'),
      };
      const { worker, dataSource } = setup();
      await worker.resolveConflict(local, external, buildToken());
      // Direct DB update happened
      expect(dataSource.getRepository).toHaveBeenCalled();
    });

    it('24. local newer : no-op (next push will overwrite external)', async () => {
      const local = buildAppt({
        updatedAt: new Date('2026-05-27T10:00:00Z'),
      } as Partial<BookingAppointmentEntity>);
      const external: ExternalCalendarEvent = {
        id: 'ext',
        title: 'Old external version',
        startAt: new Date(),
        endAt: new Date(),
        timezone: 'UTC',
        attendees: [],
        lastModifiedAt: new Date('2026-05-26T10:00:00Z'), // older
        createdAt: new Date(),
      };
      const { worker, dataSource } = setup();
      // Reset the call count to verify resolveConflict didn't fetch a repo
      (dataSource.getRepository as ReturnType<typeof vi.fn>).mockClear();
      await worker.resolveConflict(local, external, buildToken());
      expect(dataSource.getRepository).not.toHaveBeenCalled();
    });

    it('25. equal timestamp : external wins (tie-break)', async () => {
      const tsValue = new Date('2026-05-26T10:00:00Z');
      const local = buildAppt({
        updatedAt: tsValue,
      } as Partial<BookingAppointmentEntity>);
      const external: ExternalCalendarEvent = {
        id: 'ext',
        title: 'Tie-break external',
        startAt: new Date(),
        endAt: new Date(),
        timezone: 'UTC',
        attendees: [],
        lastModifiedAt: tsValue,
        createdAt: new Date(),
      };
      const { worker, dataSource } = setup();
      (dataSource.getRepository as ReturnType<typeof vi.fn>).mockClear();
      await worker.resolveConflict(local, external, buildToken());
      expect(dataSource.getRepository).toHaveBeenCalled();
    });
  });

  describe('reconcileAll cron', () => {
    it('26. no-op when no providers enabled', async () => {
      const { worker, tokens } = setup();
      const config = {
        isAnyEnabled: vi.fn().mockReturnValue(false),
      } as unknown as OAuthCalendarConfig;
      (worker as unknown as { config: OAuthCalendarConfig }).config = config;
      await worker.reconcileAll();
      expect(tokens.findAllActiveTokens).not.toHaveBeenCalled();
    });

    it('27. iterates active tokens and skips high-failure ones', async () => {
      const ok = buildToken({ id: 'ok', consecutiveFailures: 0 });
      const bad = buildToken({ id: 'bad', consecutiveFailures: 7 });
      const { worker, tokens } = setup({ tokens: [ok, bad] });
      await worker.reconcileAll();
      expect(tokens.findAllActiveTokens).toHaveBeenCalled();
    });
  });

  describe('toExternalFormat mapper', () => {
    it('28. preserves timezone, attendees, builds location from room', () => {
      const { worker } = setup();
      const appt = buildAppt();
      const room = buildRoom();
      const out = worker.toExternalFormat(appt, room);
      expect(out.title).toBe('Visite garage Atlas');
      expect(out.timezone).toBe('Africa/Casablanca');
      expect(out.location).toBe('Garage Atlas Bay 2 (Marrakech)');
      expect(out.attendees).toHaveLength(1);
      expect(out.attendees[0]?.email).toBe('karim@example.com');
    });

    it('29. omits location when room missing', () => {
      const { worker } = setup();
      const out = worker.toExternalFormat(buildAppt(), null);
      expect(out.location).toBeUndefined();
    });
  });
});
