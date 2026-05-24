/**
 * Tow mission types -- Sprint 7.5b foundation skeleton (decision-012).
 */

import type { TowMissionStatus, TowRequestSource, TowVehicleType } from './tow.types.js';

/**
 * Mission de remorquage (table tow_missions, Sprint 22.5).
 *
 * `request_source_tenant_id` + `request_source` proviennent du cross-tenant
 * authorization `client_to_tower_dispatch` (decision-012 type 4).
 *
 * `target_garage_tenant_id` (optional) provient de `tower_to_garage_delivery`
 * (decision-012 type 5) -- mis quand le garage final est designe.
 */
export interface TowMission {
  readonly id: string;
  readonly tenantId: string;
  readonly requestSourceTenantId: string;
  readonly requestSource: TowRequestSource;
  readonly targetGarageTenantId?: string | null;
  readonly assignedDriverId?: string | null;
  readonly sinistreId?: string | null;
  readonly vehicleType: TowVehicleType;
  readonly pickupAddress: string;
  readonly pickupLatitude: number;
  readonly pickupLongitude: number;
  readonly deliveryAddress?: string | null;
  readonly status: TowMissionStatus;
  readonly requestedAt: Date;
  readonly acceptedAt?: Date | null;
  readonly completedAt?: Date | null;
  readonly cancelledAt?: Date | null;
  readonly cancellationReason?: string | null;
  readonly estimatedCostMad?: number | null;
  readonly actualCostMad?: number | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** Input dispatch tow (Sprint 22.5 service). */
export interface DispatchTowInput {
  readonly tenantId: string;
  readonly requestSourceTenantId: string;
  readonly requestSource: TowRequestSource;
  readonly vehicleType: TowVehicleType;
  readonly pickupAddress: string;
  readonly pickupLatitude: number;
  readonly pickupLongitude: number;
  readonly sinistreId?: string;
  readonly targetGarageTenantId?: string;
}

/** Input update mission status (Sprint 22.5 service). */
export interface UpdateTowMissionStatusInput {
  readonly missionId: string;
  readonly status: TowMissionStatus;
  readonly cancellationReason?: string;
}
