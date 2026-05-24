/**
 * IcalRendererService -- Sprint 8 Tache 8.13.
 *
 * Serializes a list of booking appointments to RFC 5545 (text/calendar)
 * format. Stateless, pure -- no DB / no IO -- so it's trivially testable
 * and reusable from any caller that already has the appointment + room data.
 *
 * Conformance notes :
 *   - CRLF line endings ('\r\n') mandated by RFC 5545 section 3.1.
 *   - Special chars escaped : backslash, semicolon, comma, newline (3.3.11).
 *   - Long-line folding (> 75 octets) is OPTIONAL for Sprint 8 ; most modern
 *     clients accept long lines. Sprint 33 may add proper folding if a
 *     concrete client rejection surfaces.
 *   - UID is globally unique per RFC : `appointment-{uuid}@assurflow.skalean.com`.
 *   - DTSTAMP = generation time (now). DTSTART / DTEND = UTC (YYYYMMDDTHHMMSSZ).
 *   - STATUS maps 6 internal statuses to 3 iCal values
 *     (TENTATIVE / CONFIRMED / CANCELLED).
 *
 * Reference : https://datatracker.ietf.org/doc/html/rfc5545
 */

import { Injectable } from '@nestjs/common';
import type {
  BookingAppointmentEntity,
  BookingAttendee,
  BookingAppointmentStatus,
  BookingRoomEntity,
} from '@insurtech/database';

const CRLF = '\r\n';
const PRODID = '-//Skalean//Assurflow Insurtech v1.0//FR';

@Injectable()
export class IcalRendererService {
  /**
   * Renders the iCal body. Caller is responsible for setting
   * `Content-Type: text/calendar; charset=utf-8` on the HTTP response.
   *
   * @param appointments rows to include. Cancelled / no_show ARE included
   *   so the client can update its local copy ; STATUS:CANCELLED on the
   *   event tells the client to drop it.
   * @param rooms lookup map roomId -> entity (for LOCATION field).
   * @param calendarName free-form `X-WR-CALNAME` -- shown by some clients
   *   as the subscribed calendar's display name.
   */
  render(
    appointments: ReadonlyArray<BookingAppointmentEntity>,
    rooms: ReadonlyMap<string, BookingRoomEntity>,
    calendarName = 'Assurflow Appointments',
  ): string {
    const lines: string[] = [];
    lines.push('BEGIN:VCALENDAR');
    lines.push('VERSION:2.0');
    lines.push(`PRODID:${PRODID}`);
    lines.push('CALSCALE:GREGORIAN');
    lines.push('METHOD:PUBLISH');
    lines.push(`X-WR-CALNAME:${this.escapeText(calendarName)}`);
    lines.push('X-WR-TIMEZONE:Africa/Casablanca');

    const dtstamp = this.formatUtc(new Date());

    for (const appt of appointments) {
      const room = rooms.get(appt.roomId) ?? null;
      lines.push('BEGIN:VEVENT');
      lines.push(`UID:appointment-${appt.id}@assurflow.skalean.com`);
      lines.push(`DTSTAMP:${dtstamp}`);
      lines.push(`DTSTART:${this.formatUtc(appt.timeRange.start)}`);
      lines.push(`DTEND:${this.formatUtc(appt.timeRange.end)}`);
      lines.push(`SUMMARY:${this.escapeText(appt.title)}`);
      if (appt.description) {
        lines.push(`DESCRIPTION:${this.escapeText(appt.description)}`);
      }
      if (room) {
        const loc = room.city ? `${room.name} (${room.city})` : room.name;
        lines.push(`LOCATION:${this.escapeText(loc)}`);
      }
      lines.push(`STATUS:${this.mapStatus(appt.status)}`);
      lines.push(`CREATED:${this.formatUtc(appt.createdAt)}`);
      lines.push(`LAST-MODIFIED:${this.formatUtc(appt.updatedAt)}`);
      for (const attendee of (appt.attendees ?? []) as BookingAttendee[]) {
        const line = this.renderAttendee(attendee);
        if (line) lines.push(line);
      }
      lines.push('END:VEVENT');
    }

    lines.push('END:VCALENDAR');
    // RFC 5545 requires CRLF, including a trailing CRLF after END:VCALENDAR.
    return lines.join(CRLF) + CRLF;
  }

  // ==========================================================================
  // Helpers (exposed publicly only for unit tests of the renderer ; consumers
  // should call `render()`).
  // ==========================================================================

  /**
   * Escape per RFC 5545 section 3.3.11. Order matters : backslash MUST be
   * escaped first to avoid double-escaping the others.
   */
  escapeText(value: string): string {
    return value
      .replace(/\\/g, '\\\\')
      .replace(/\r\n|\r|\n/g, '\\n')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,');
  }

  /** Format Date as `YYYYMMDDTHHMMSSZ` (UTC). */
  formatUtc(date: Date): string {
    const iso = date.toISOString();
    // Strip dashes, colons, milliseconds. e.g. 2026-06-01T10:00:00.000Z -> 20260601T100000Z
    return iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  }

  /** Maps internal status enum to iCal STATUS values. */
  mapStatus(status: BookingAppointmentStatus): 'TENTATIVE' | 'CONFIRMED' | 'CANCELLED' {
    switch (status) {
      case 'scheduled':
        return 'TENTATIVE';
      case 'confirmed':
      case 'in_progress':
      case 'completed':
        return 'CONFIRMED';
      case 'cancelled':
      case 'no_show':
        return 'CANCELLED';
      default:
        return 'TENTATIVE';
    }
  }

  /**
   * Renders an ATTENDEE line. Skipped when no email (RFC requires mailto:
   * value). CN parameter contains the attendee name escaped for param
   * context (double-quotes stripped).
   */
  private renderAttendee(attendee: BookingAttendee): string | null {
    const a = attendee as { name?: string; email?: string };
    if (!a.email) return null;
    const cn = (a.name ?? a.email).replace(/"/g, '');
    return `ATTENDEE;CN=${cn}:mailto:${a.email}`;
  }
}
