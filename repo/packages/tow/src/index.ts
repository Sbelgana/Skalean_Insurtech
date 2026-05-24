/**
 * @insurtech/tow -- Foundation skeleton package (Sprint 7.5b.2).
 *
 * Architecture v3.0 (decision-012 Tow remorqueur Uber-style) :
 *   - Types : TowMission / TowDriver
 *   - Services skeletons (Sprint 7.5b.9) : TowService / TowDriverService
 *   - DB tables : tow_missions / tow_drivers (creees Sprint 22.5)
 *
 * Cross-tenant authorization Sprint 7.5a v3.0 :
 *   - type 4 `client_to_tower_dispatch` : assure/broker/garage demande tow
 *   - type 5 `tower_to_garage_delivery` : tow livre vehicule au garage
 *
 * Implementations runtime : Sprint 22.5 (Tow App).
 * Avant ce sprint, les services throw NotImplementedError.
 *
 * Reference :
 *   - decision-012-ecosysteme-6-acteurs.md (Tow tenant + cross-tenant 4/5)
 *   - B-22.5 Sprint 22.5 Tow App (75h estimee).
 */

// Types tow general
export type { TowMissionStatus, TowRequestSource, TowVehicleType } from './types/tow.types.js';

// Types missions
export type {
  TowMission,
  DispatchTowInput,
  UpdateTowMissionStatusInput,
} from './types/tow-mission.types.js';

// Types drivers
export type {
  TowDriver,
  TowDriverStatus,
  RegisterTowDriverInput,
  AssignDriverToMissionInput,
} from './types/tow-driver.types.js';

// Constantes
export const TOW_PACKAGE_VERSION = '0.1.0';

/**
 * Marker error for skeleton services (Sprint 7.5b.9).
 * Thrown by service stubs until Sprint 22.5 implements them.
 */
export class NotImplementedError extends Error {
  constructor(message: string, public readonly targetSprint: string) {
    super(`[NotImplemented -- target Sprint ${targetSprint}] ${message}`);
    this.name = 'NotImplementedError';
  }
}
