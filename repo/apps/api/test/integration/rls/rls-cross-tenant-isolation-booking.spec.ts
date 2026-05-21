/**
 * RLS cross-tenant isolation tests -- Booking tables (Sprint 8 prep).
 *
 * Tables : booking_appointments, booking_rooms, booking_calendar_sync.
 *
 * Reference : Sprint 6 / Tache 2.2.12.
 */

import { describe, it } from 'vitest';

describe.skip('RLS isolation -- Booking (Pause #4 to enable)', () => {
  describe('booking_appointments', () => {
    it.skip('TC-41 -- INSERT then cross-tenant SELECT returns 0', async () => {});
    it.skip('TC-42 -- UPDATE cross-tenant returns 0 affected', async () => {});
  });

  describe('booking_rooms', () => {
    it.skip('TC-43 -- INSERT then cross-tenant SELECT returns 0', async () => {});
  });

  describe('booking_calendar_sync', () => {
    it.skip('TC-44 -- INSERT then cross-tenant SELECT returns 0', async () => {});
  });
});
