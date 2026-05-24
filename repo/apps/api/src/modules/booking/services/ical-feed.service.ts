/**
 * IcalFeedService -- Sprint 8 Tache 8.13.
 *
 * Orchestrator wiring the token validator + appointment+room queries +
 * RFC 5545 renderer. Public-endpoint entry point is `generateFeed(plainToken)`,
 * called by the unauthenticated `.ics` controller route.
 *
 * Scope semantics :
 *   - `own`        : appointments.assignedUserId === token.userId
 *   - `team`       : all appointments in token.tenantId
 *   - `all_tenant` : same as team + INFO log per access (audit)
 *
 * Time window : [now - 30d, now + 365d]. Past events are still useful for
 * UX (history visible in subscribed clients) and future cap prevents
 * unbounded payloads. Sprint 13 may tune based on real usage.
 *
 * Reference : B-08 Tache 3.2.7.
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  BookingAppointmentEntity,
  BookingIcalTokenEntity,
  BookingRoomEntity,
  type DataSource,
} from '@insurtech/database';
import { DATA_SOURCE_TOKEN } from '../../../database/data-source.provider.js';
import { IcalRendererService } from './ical-renderer.service.js';
import { IcalTokenService } from './ical-token.service.js';

/** Past horizon : how far back to expose events. */
const PAST_DAYS = 30;
/** Future horizon : how far ahead to expose events. */
const FUTURE_DAYS = 365;

export interface IcalFeedResult {
  readonly content: string;
  readonly lastModified: Date;
  readonly tokenId: string;
}

@Injectable()
export class IcalFeedService {
  private readonly logger = new Logger(IcalFeedService.name);

  constructor(
    @Inject(DATA_SOURCE_TOKEN) private readonly dataSource: DataSource,
    private readonly tokenService: IcalTokenService,
    private readonly renderer: IcalRendererService,
  ) {}

  /**
   * Resolves the plain token, fetches scope-filtered appointments + their
   * rooms, renders RFC 5545. Returns null when the token is invalid (the
   * controller maps that to a 404 to keep token existence opaque).
   *
   * Access counters are bumped fire-and-forget : missing the update does
   * not affect feed delivery (best-effort telemetry).
   */
  async generateFeed(plainToken: string): Promise<IcalFeedResult | null> {
    const token = await this.tokenService.validateAndRetrieve(plainToken);
    if (!token) return null;

    if (token.scope === 'all_tenant') {
      // Admin-scope access : audit log line. Volume should stay low (admin
      // users only). Production should also forward to Audit table -- defer
      // to a follow-up.
      this.logger.log(
        `ical_feed_all_tenant_access token_id=${token.id} tenant=${token.tenantId} user=${token.userId}`,
      );
    }

    const appointments = await this.fetchAppointments(token);
    const rooms = await this.fetchRoomsMap(token.tenantId, appointments);
    const content = this.renderer.render(appointments, rooms);

    // Fire-and-forget access recording.
    this.tokenService.recordAccess(token.id).catch((err: Error) => {
      this.logger.warn(
        `ical_feed_record_access_failed token_id=${token.id} err=${err.message}`,
      );
    });

    return {
      content,
      lastModified: new Date(),
      tokenId: token.id,
    };
  }

  /**
   * Fetches appointments for the token scope, within the rolling time window.
   * Cancelled / no_show ARE included so the subscriber's local copy can be
   * cleared (renderer emits STATUS:CANCELLED).
   */
  private async fetchAppointments(
    token: BookingIcalTokenEntity,
  ): Promise<BookingAppointmentEntity[]> {
    const from = new Date(Date.now() - PAST_DAYS * 24 * 60 * 60 * 1000);
    const to = new Date(Date.now() + FUTURE_DAYS * 24 * 60 * 60 * 1000);

    const qb = this.dataSource
      .getRepository(BookingAppointmentEntity)
      .createQueryBuilder('a')
      .where('a.tenant_id = :tenantId', { tenantId: token.tenantId })
      .andWhere(
        `a.time_range && tstzrange(:from::timestamptz, :to::timestamptz, '[)')`,
        { from: from.toISOString(), to: to.toISOString() },
      )
      .orderBy('lower(a.time_range)', 'ASC');

    if (token.scope === 'own') {
      qb.andWhere('a.assigned_user_id = :userId', { userId: token.userId });
    }
    // team / all_tenant : no user filter -- whole tenant range.

    return qb.getMany();
  }

  /**
   * Loads the rooms referenced by the fetched appointments into a Map for
   * O(1) lookup during render. Empty roomIds list returns an empty map
   * (no query issued).
   */
  private async fetchRoomsMap(
    tenantId: string,
    appointments: ReadonlyArray<BookingAppointmentEntity>,
  ): Promise<Map<string, BookingRoomEntity>> {
    if (appointments.length === 0) return new Map();
    const ids = Array.from(new Set(appointments.map((a) => a.roomId)));
    const rooms = await this.dataSource
      .getRepository(BookingRoomEntity)
      .createQueryBuilder('r')
      .where('r.tenant_id = :tenantId', { tenantId })
      .andWhere('r.id IN (:...ids)', { ids })
      .getMany();
    return new Map(rooms.map((r) => [r.id, r]));
  }
}
