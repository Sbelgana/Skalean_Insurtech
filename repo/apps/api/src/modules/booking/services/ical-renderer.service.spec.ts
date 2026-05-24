/**
 * Tests IcalRendererService -- Sprint 8 Tache 8.13.
 *
 * Pure / stateless serializer -- no mocking required.
 */

import type {
  BookingAppointmentEntity,
  BookingRoomEntity,
} from '@insurtech/database';
import { describe, expect, it } from 'vitest';
import { IcalRendererService } from './ical-renderer.service.js';

const CRLF = '\r\n';

function buildAppt(
  overrides: Partial<BookingAppointmentEntity> = {},
): BookingAppointmentEntity {
  return {
    id: '00000000-0000-0000-0000-000000000600',
    tenantId: '00000000-0000-0000-0000-000000000001',
    roomId: '00000000-0000-0000-0000-000000000500',
    assignedUserId: '00000000-0000-0000-0000-000000000002',
    title: 'Visite Bennani',
    description: 'Inspection',
    timeRange: {
      start: new Date('2026-06-01T10:00:00Z'),
      end: new Date('2026-06-01T11:00:00Z'),
    },
    timezone: 'Africa/Casablanca',
    attendees: [],
    status: 'confirmed',
    createdAt: new Date('2026-05-24T08:00:00Z'),
    updatedAt: new Date('2026-05-25T09:00:00Z'),
    ...overrides,
  } as unknown as BookingAppointmentEntity;
}

function buildRoom(
  overrides: Partial<BookingRoomEntity> = {},
): BookingRoomEntity {
  return {
    id: '00000000-0000-0000-0000-000000000500',
    tenantId: '00000000-0000-0000-0000-000000000001',
    name: 'Garage Atlas Bay 2',
    city: 'Marrakech',
    active: true,
    ...overrides,
  } as unknown as BookingRoomEntity;
}

describe('IcalRendererService (Sprint 8 Tache 8.13)', () => {
  const r = new IcalRendererService();

  describe('VCALENDAR structure', () => {
    it('1. empty appointments produces a valid VCALENDAR wrapper', () => {
      const out = r.render([], new Map());
      expect(out).toMatch(/^BEGIN:VCALENDAR\r\n/);
      expect(out).toContain(`VERSION:2.0${CRLF}`);
      expect(out).toContain(`PRODID:`);
      expect(out).toContain('CALSCALE:GREGORIAN');
      expect(out.endsWith(`END:VCALENDAR${CRLF}`)).toBe(true);
      // No VEVENT when no appointments
      expect(out).not.toContain('BEGIN:VEVENT');
    });

    it('2. each appointment becomes a VEVENT block with UID + DTSTAMP', () => {
      const out = r.render(
        [buildAppt(), buildAppt({ id: 'second' } as Partial<BookingAppointmentEntity>)],
        new Map(),
      );
      const eventStarts = (out.match(/BEGIN:VEVENT/g) ?? []).length;
      const eventEnds = (out.match(/END:VEVENT/g) ?? []).length;
      expect(eventStarts).toBe(2);
      expect(eventEnds).toBe(2);
      expect(out).toContain('UID:appointment-00000000-0000-0000-0000-000000000600@assurflow.skalean.com');
      expect(out).toContain('UID:appointment-second@assurflow.skalean.com');
      expect(out).toContain('DTSTAMP:');
    });

    it('3. uses CRLF line endings throughout (RFC 5545 3.1)', () => {
      const out = r.render([buildAppt()], new Map());
      // No bare LF without CR before it
      expect(out.includes('\n') && !out.includes('\r\n')).toBe(false);
      const linesCRLF = out.split(CRLF);
      expect(linesCRLF.length).toBeGreaterThan(5);
    });
  });

  describe('escapeText', () => {
    it('4. escapes special chars : backslash, semicolon, comma, newline', () => {
      const out = r.escapeText('A\\B;C,D\nE');
      expect(out).toBe('A\\\\B\\;C\\,D\\nE');
    });

    it('5. backslash escaped before semicolon (no double-escape)', () => {
      const out = r.escapeText('\\;');
      expect(out).toBe('\\\\\\;');
    });
  });

  describe('formatUtc', () => {
    it('6. converts to YYYYMMDDTHHMMSSZ format', () => {
      const date = new Date('2026-06-01T10:30:45.123Z');
      expect(r.formatUtc(date)).toBe('20260601T103045Z');
    });
  });

  describe('mapStatus', () => {
    it('7. maps 6 internal statuses to 3 iCal STATUS values', () => {
      expect(r.mapStatus('scheduled')).toBe('TENTATIVE');
      expect(r.mapStatus('confirmed')).toBe('CONFIRMED');
      expect(r.mapStatus('in_progress')).toBe('CONFIRMED');
      expect(r.mapStatus('completed')).toBe('CONFIRMED');
      expect(r.mapStatus('cancelled')).toBe('CANCELLED');
      expect(r.mapStatus('no_show')).toBe('CANCELLED');
    });
  });

  describe('VEVENT fields', () => {
    it('8. emits SUMMARY + DESCRIPTION + STATUS + DTSTART + DTEND', () => {
      const out = r.render([buildAppt()], new Map());
      expect(out).toContain('SUMMARY:Visite Bennani');
      expect(out).toContain('DESCRIPTION:Inspection');
      expect(out).toContain('STATUS:CONFIRMED');
      expect(out).toContain('DTSTART:20260601T100000Z');
      expect(out).toContain('DTEND:20260601T110000Z');
    });

    it('9. LOCATION built from room name + city when room provided', () => {
      const rooms = new Map([['00000000-0000-0000-0000-000000000500', buildRoom()]]);
      const out = r.render([buildAppt()], rooms);
      expect(out).toContain('LOCATION:Garage Atlas Bay 2 (Marrakech)');
    });

    it('10. LOCATION omits city parens when room has no city', () => {
      const rooms = new Map([
        [
          '00000000-0000-0000-0000-000000000500',
          buildRoom({ city: null } as Partial<BookingRoomEntity>),
        ],
      ]);
      const out = r.render([buildAppt()], rooms);
      expect(out).toContain('LOCATION:Garage Atlas Bay 2');
      expect(out).not.toContain('LOCATION:Garage Atlas Bay 2 (');
    });

    it('11. no LOCATION line when room is missing from the map', () => {
      const out = r.render([buildAppt()], new Map());
      expect(out).not.toContain('LOCATION:');
    });

    it('12. ATTENDEE line emitted only for attendees with email', () => {
      const appt = buildAppt({
        attendees: [
          { name: 'Karim', email: 'karim@example.com' },
          { name: 'NoEmail' }, // skipped
        ] as never,
      });
      const out = r.render([appt], new Map());
      expect(out).toContain('ATTENDEE;CN=Karim:mailto:karim@example.com');
      expect(out).not.toContain('CN=NoEmail');
    });

    it('13. SUMMARY content with special chars is escaped', () => {
      const appt = buildAppt({ title: 'Half; full, line\nbreak' });
      const out = r.render([appt], new Map());
      expect(out).toContain('SUMMARY:Half\\; full\\, line\\nbreak');
    });
  });
});
