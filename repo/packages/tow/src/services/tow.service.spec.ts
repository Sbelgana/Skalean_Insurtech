/**
 * Tests skeleton TowService + TowDriverService -- Sprint 7.5b.9.
 */

import { describe, expect, it } from 'vitest';
import { TowService } from './tow.service.js';
import { TowDriverService } from './tow-driver.service.js';
import { NotImplementedError } from '../index.js';

describe('TowService skeleton (Sprint 7.5b.9)', () => {
  const service = new TowService();

  it('1. dispatchTow throws NotImplementedError Sprint 22.5', async () => {
    await expect(
      service.dispatchTow({
        tenantId: 't',
        requestSourceTenantId: 't2',
        requestSource: 'assure',
        vehicleType: 'car',
        pickupAddress: 'Marrakech',
        pickupLatitude: 31.6,
        pickupLongitude: -7.9,
      }),
    ).rejects.toThrow(NotImplementedError);
  });

  it('2. dispatchTow targetSprint contains 22.5', async () => {
    try {
      await service.dispatchTow({
        tenantId: 't',
        requestSourceTenantId: 't2',
        requestSource: 'broker',
        vehicleType: 'suv',
        pickupAddress: 'A',
        pickupLatitude: 0,
        pickupLongitude: 0,
      });
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as NotImplementedError).targetSprint).toBe('Sprint 22.5');
    }
  });

  it('3. updateTowMissionStatus throws NotImplementedError', async () => {
    await expect(
      service.updateTowMissionStatus({ missionId: 'm', status: 'accepted' }),
    ).rejects.toThrow(NotImplementedError);
  });

  it('4. listTowMissions throws NotImplementedError', async () => {
    await expect(service.listTowMissions()).rejects.toThrow(NotImplementedError);
  });
});

describe('TowDriverService skeleton (Sprint 7.5b.9)', () => {
  const service = new TowDriverService();

  it('5. registerDriver throws NotImplementedError Sprint 22.5', async () => {
    await expect(
      service.registerDriver({
        tenantId: 't',
        userId: 'u',
        licenseNumber: 'PERM-MA-001',
        vehiclePlate: '12345-A-6',
      }),
    ).rejects.toThrow(NotImplementedError);
  });

  it('6. assignDriverToMission throws NotImplementedError', async () => {
    await expect(
      service.assignDriverToMission({ missionId: 'm', driverId: 'd' }),
    ).rejects.toThrow(NotImplementedError);
  });

  it('7. error name + instance coherents', async () => {
    try {
      await service.assignDriverToMission({ missionId: 'x', driverId: 'y' });
    } catch (err) {
      expect(err).toBeInstanceOf(NotImplementedError);
      expect((err as Error).name).toBe('NotImplementedError');
    }
  });

  it('8. dispatch + assign : 2 sprints differents (mais meme target 22.5)', async () => {
    const tow = new TowService();
    try {
      await tow.dispatchTow({
        tenantId: 't',
        requestSourceTenantId: 't',
        requestSource: 'garage',
        vehicleType: 'truck_heavy',
        pickupAddress: 'A',
        pickupLatitude: 0,
        pickupLongitude: 0,
      });
    } catch (err) {
      expect((err as NotImplementedError).targetSprint).toBe('Sprint 22.5');
    }
    try {
      await service.assignDriverToMission({ missionId: 'a', driverId: 'b' });
    } catch (err) {
      expect((err as NotImplementedError).targetSprint).toBe('Sprint 22.5');
    }
  });
});
