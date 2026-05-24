/**
 * Tow driver types -- Sprint 7.5b foundation skeleton (decision-012).
 *
 * Sprint 22.5 implementera driver app PWA mobile + availability toggle + geo-tracking.
 */

/** Statut driver (disponibilite + activite). */
export type TowDriverStatus = 'offline' | 'available' | 'busy' | 'suspended';

/**
 * Driver profile (table tow_drivers, Sprint 22.5).
 *
 * tenant_id = operateur de remorquage (Tow tenant). Driver est un user role
 * `tow_driver` (Sprint 7.5a foundation v3.0).
 */
export interface TowDriver {
  readonly id: string;
  readonly tenantId: string;
  readonly userId: string;
  readonly licenseNumber: string;
  readonly vehiclePlate: string;
  readonly status: TowDriverStatus;
  readonly currentLatitude?: number | null;
  readonly currentLongitude?: number | null;
  readonly lastSeenAt?: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** Input register driver (Sprint 22.5 service). */
export interface RegisterTowDriverInput {
  readonly tenantId: string;
  readonly userId: string;
  readonly licenseNumber: string;
  readonly vehiclePlate: string;
}

/** Input assign driver to mission (Sprint 22.5 dispatcher action). */
export interface AssignDriverToMissionInput {
  readonly missionId: string;
  readonly driverId: string;
}
