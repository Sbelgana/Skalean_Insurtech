/**
 * Tests bootstrap @insurtech/tow -- Sprint 7.5b.2.
 */

import { describe, expect, it } from 'vitest';
import {
  TOW_PACKAGE_VERSION,
  NotImplementedError,
  type TowMission,
  type TowDriver,
  type TowMissionStatus,
  type TowDriverStatus,
  type TowVehicleType,
  type TowRequestSource,
} from './index.js';

describe('@insurtech/tow bootstrap (Sprint 7.5b.2)', () => {
  it('1. exposes package version', () => {
    expect(TOW_PACKAGE_VERSION).toBe('0.1.0');
  });

  it('2. NotImplementedError throws with sprint target', () => {
    const err = new NotImplementedError('dispatchTow', 'Sprint 22.5');
    expect(err.name).toBe('NotImplementedError');
    expect(err.message).toContain('Sprint 22.5');
    expect(err.targetSprint).toBe('Sprint 22.5');
  });

  it('3. TowMissionStatus 5 valeurs (workflow lifecycle)', () => {
    const statuses: TowMissionStatus[] = [
      'requested',
      'accepted',
      'in_progress',
      'completed',
      'cancelled',
    ];
    expect(statuses).toHaveLength(5);
  });

  it('4. TowMission type accepts valid mission', () => {
    const mission: TowMission = {
      id: 'm1',
      tenantId: 't1',
      requestSourceTenantId: 't2',
      requestSource: 'assure',
      vehicleType: 'car',
      pickupAddress: '123 Av Mohammed V, Marrakech',
      pickupLatitude: 31.6295,
      pickupLongitude: -7.9811,
      status: 'requested',
      requestedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(mission.status).toBe('requested');
    expect(mission.pickupAddress).toContain('Marrakech');
  });

  it('5. TowDriver type accepts valid driver', () => {
    const driver: TowDriver = {
      id: 'd1',
      tenantId: 't1',
      userId: 'u1',
      licenseNumber: 'PERM-MA-12345',
      vehiclePlate: '12345-A-6',
      status: 'available',
      currentLatitude: 31.6295,
      currentLongitude: -7.9811,
      lastSeenAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(driver.status).toBe('available');
    expect(driver.vehiclePlate).toMatch(/-/);
  });

  it('6. TowVehicleType 5 valeurs + TowRequestSource 3 valeurs', () => {
    const vehicles: TowVehicleType[] = ['car', 'suv', 'truck_light', 'truck_heavy', 'motorcycle'];
    const sources: TowRequestSource[] = ['assure', 'broker', 'garage'];
    const driverStatuses: TowDriverStatus[] = ['offline', 'available', 'busy', 'suspended'];
    expect(vehicles).toHaveLength(5);
    expect(sources).toHaveLength(3);
    expect(driverStatuses).toHaveLength(4);
  });
});
