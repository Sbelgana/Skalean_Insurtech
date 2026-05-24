/**
 * Tests AppointmentSyncListener -- Sprint 8 Tache 8.12 (Phase 2).
 *
 * Trivial passthrough listener -- focus on : event -> action mapping +
 * fire-and-forget error swallowing.
 */

import { describe, expect, it, vi } from 'vitest';
import { AppointmentSyncListener } from './appointment-sync.listener.js';
import type { CalendarSyncWorkerService } from './calendar-sync-worker.service.js';

const APPT = '00000000-0000-0000-0000-000000000600';
const TENANT = '00000000-0000-0000-0000-000000000001';

function buildListener(workerOverrides: Partial<CalendarSyncWorkerService> = {}) {
  const syncWorker = {
    syncAppointmentToExternal: vi.fn().mockResolvedValue(undefined),
    ...workerOverrides,
  } as unknown as CalendarSyncWorkerService;
  return { listener: new AppointmentSyncListener(syncWorker), syncWorker };
}

describe('AppointmentSyncListener (Sprint 8 Tache 8.12 Phase 2)', () => {
  it('1. handleCreated -> syncWorker.syncAppointmentToExternal(id, "created")', async () => {
    const { listener, syncWorker } = buildListener();
    await listener.handleCreated({ appointmentId: APPT, tenantId: TENANT });
    expect(syncWorker.syncAppointmentToExternal).toHaveBeenCalledWith(
      APPT,
      'created',
    );
  });

  it('2. handleUpdated -> syncWorker.syncAppointmentToExternal(id, "updated")', async () => {
    const { listener, syncWorker } = buildListener();
    await listener.handleUpdated({ appointmentId: APPT, tenantId: TENANT });
    expect(syncWorker.syncAppointmentToExternal).toHaveBeenCalledWith(
      APPT,
      'updated',
    );
  });

  it('3. handleCancelled -> syncWorker.syncAppointmentToExternal(id, "deleted")', async () => {
    const { listener, syncWorker } = buildListener();
    await listener.handleCancelled({ appointmentId: APPT, tenantId: TENANT });
    expect(syncWorker.syncAppointmentToExternal).toHaveBeenCalledWith(
      APPT,
      'deleted',
    );
  });

  it('4. swallows worker errors (does not propagate)', async () => {
    const { listener } = buildListener({
      syncAppointmentToExternal: vi.fn().mockRejectedValue(new Error('boom')),
    });
    // Must not throw
    await expect(
      listener.handleCreated({ appointmentId: APPT, tenantId: TENANT }),
    ).resolves.toBeUndefined();
  });
});
