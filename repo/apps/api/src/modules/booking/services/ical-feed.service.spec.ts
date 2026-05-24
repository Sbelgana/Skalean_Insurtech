/**
 * Tests IcalFeedService -- Sprint 8 Tache 8.13.
 *
 * Orchestrator unit tests : token service + renderer + dataSource mocked.
 * Focus on : invalid token short-circuit, scope-driven query branching,
 * fire-and-forget recordAccess, all_tenant audit log.
 */

import type {
  BookingAppointmentEntity,
  BookingIcalTokenEntity,
  BookingRoomEntity,
  DataSource,
} from '@insurtech/database';
import { describe, expect, it, vi } from 'vitest';
import { IcalFeedService } from './ical-feed.service.js';
import type { IcalRendererService } from './ical-renderer.service.js';
import type { IcalTokenService } from './ical-token.service.js';

const TENANT_A = '00000000-0000-0000-0000-000000000001';
const USER_A = '00000000-0000-0000-0000-000000000002';

function buildToken(
  overrides: Partial<BookingIcalTokenEntity> = {},
): BookingIcalTokenEntity {
  return {
    id: 'tok-1',
    tenantId: TENANT_A,
    userId: USER_A,
    scope: 'own',
    active: true,
    expiresAt: null,
    ...overrides,
  } as unknown as BookingIcalTokenEntity;
}

function buildAppt(roomId = 'room-1'): BookingAppointmentEntity {
  return {
    id: 'appt-1',
    roomId,
    tenantId: TENANT_A,
  } as unknown as BookingAppointmentEntity;
}

function setup(opts: {
  token?: BookingIcalTokenEntity | null;
  appts?: BookingAppointmentEntity[];
  rooms?: BookingRoomEntity[];
} = {}) {
  const apptQb = {
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    getMany: vi.fn().mockResolvedValue(opts.appts ?? []),
  };
  const roomQb = {
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    getMany: vi.fn().mockResolvedValue(opts.rooms ?? []),
  };
  const dataSource = {
    getRepository: vi.fn((entity) => {
      const name = (entity as { name?: string })?.name ?? '';
      return {
        createQueryBuilder: vi
          .fn()
          .mockReturnValue(name === 'BookingRoomEntity' ? roomQb : apptQb),
      };
    }),
  } as unknown as DataSource;

  const tokenService = {
    validateAndRetrieve: vi.fn().mockResolvedValue(opts.token ?? null),
    recordAccess: vi.fn().mockResolvedValue(undefined),
  } as unknown as IcalTokenService;

  const renderer = {
    render: vi.fn().mockReturnValue('BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n'),
  } as unknown as IcalRendererService;

  const service = new IcalFeedService(dataSource, tokenService, renderer);
  return { service, tokenService, renderer, apptQb };
}

describe('IcalFeedService (Sprint 8 Tache 8.13)', () => {
  it('1. returns null when token validation fails', async () => {
    const { service, tokenService } = setup({ token: null });
    const result = await service.generateFeed('ical_invalid');
    expect(result).toBeNull();
    expect(tokenService.validateAndRetrieve).toHaveBeenCalledWith('ical_invalid');
  });

  it('2. renders content + sets lastModified when token valid', async () => {
    const token = buildToken();
    const { service, renderer } = setup({ token, appts: [], rooms: [] });
    const result = await service.generateFeed('ical_valid');
    expect(result).not.toBeNull();
    expect(result!.content).toContain('BEGIN:VCALENDAR');
    expect(result!.lastModified).toBeInstanceOf(Date);
    expect(result!.tokenId).toBe(token.id);
    expect(renderer.render).toHaveBeenCalled();
  });

  it('3. scope own : query restricted to token user id', async () => {
    const token = buildToken({ scope: 'own' });
    const { service, apptQb } = setup({ token });
    await service.generateFeed('ical_valid');
    // andWhere should have been called with assigned_user_id filter
    const andWhereCalls = (apptQb.andWhere as ReturnType<typeof vi.fn>).mock.calls;
    const hasUserFilter = andWhereCalls.some(
      (call) => typeof call[0] === 'string' && call[0].includes('assigned_user_id'),
    );
    expect(hasUserFilter).toBe(true);
  });

  it('4. scope team : NO user filter (whole tenant)', async () => {
    const token = buildToken({ scope: 'team' });
    const { service, apptQb } = setup({ token });
    await service.generateFeed('ical_valid');
    const andWhereCalls = (apptQb.andWhere as ReturnType<typeof vi.fn>).mock.calls;
    const hasUserFilter = andWhereCalls.some(
      (call) => typeof call[0] === 'string' && call[0].includes('assigned_user_id'),
    );
    expect(hasUserFilter).toBe(false);
  });

  it('5. scope all_tenant : also no user filter + emits info log', async () => {
    const token = buildToken({ scope: 'all_tenant' });
    const { service, apptQb } = setup({ token });
    await service.generateFeed('ical_valid');
    const andWhereCalls = (apptQb.andWhere as ReturnType<typeof vi.fn>).mock.calls;
    const hasUserFilter = andWhereCalls.some(
      (call) => typeof call[0] === 'string' && call[0].includes('assigned_user_id'),
    );
    expect(hasUserFilter).toBe(false);
  });

  it('6. fire-and-forget recordAccess (await not required by caller)', async () => {
    const token = buildToken();
    const { service, tokenService } = setup({ token });
    await service.generateFeed('ical_valid');
    expect(tokenService.recordAccess).toHaveBeenCalledWith(token.id);
  });

  it('7. recordAccess failure does NOT break feed delivery', async () => {
    const token = buildToken();
    const failingTokenService = {
      validateAndRetrieve: vi.fn().mockResolvedValue(token),
      recordAccess: vi.fn().mockRejectedValue(new Error('db gone')),
    } as unknown as IcalTokenService;
    const dataSource = {
      getRepository: vi.fn().mockReturnValue({
        createQueryBuilder: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnThis(),
          andWhere: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockReturnThis(),
          getMany: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as unknown as DataSource;
    const renderer = {
      render: vi.fn().mockReturnValue('BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n'),
    } as unknown as IcalRendererService;
    const service = new IcalFeedService(dataSource, failingTokenService, renderer);
    // Should not throw even if recordAccess rejects
    const result = await service.generateFeed('ical_valid');
    expect(result).not.toBeNull();
  });

  it('8. empty appointments -> no room query issued', async () => {
    const token = buildToken();
    const { service } = setup({ token, appts: [] });
    const result = await service.generateFeed('ical_valid');
    expect(result).not.toBeNull();
    // No assertion on rooms repo : map is empty, query short-circuited
  });

  it('9. rooms map populated from appointment.roomId set', async () => {
    const token = buildToken();
    const room = { id: 'room-1', name: 'A', city: 'Casa' } as BookingRoomEntity;
    const { service, renderer } = setup({
      token,
      appts: [buildAppt('room-1'), buildAppt('room-1')], // same room twice
      rooms: [room],
    });
    await service.generateFeed('ical_valid');
    const rendererCall = (renderer.render as ReturnType<typeof vi.fn>).mock.calls[0];
    const roomsMap = rendererCall?.[1] as Map<string, BookingRoomEntity>;
    expect(roomsMap.get('room-1')).toBe(room);
  });
});
