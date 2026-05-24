/**
 * TowService -- Sprint 7.5b.9 skeleton signatures.
 *
 * Implementations runtime : Sprint 22.5 (Tow App Uber-style).
 *
 * Signatures :
 *   - dispatchTow : INSERT tow_missions + cross-tenant client_to_tower_dispatch
 *   - updateTowMissionStatus : workflow transitions (accepted/in_progress/completed/cancelled)
 *   - listTowMissions : list par tenant (driver = ses missions / admin = toutes)
 */

import { NotImplementedError } from '../index.js';
import type {
  DispatchTowInput,
  TowMission,
  UpdateTowMissionStatusInput,
} from '../types/tow-mission.types.js';

const TARGET_SPRINT = 'Sprint 22.5';

export class TowService {
  /**
   * Dispatch d'une mission de remorquage.
   *
   * Cree :
   * - INSERT tow_missions (status=requested)
   * - Cross-tenant authorization client_to_tower_dispatch (Sprint 7.5a type 4)
   * - WebSocket emit aux drivers nearby (Sprint 22.5 dispatcher)
   *
   * Validations (Sprint 22.5) :
   * - request_source IN (assure / broker / garage)
   * - request_source_tenant_id doit etre coherent avec request_source
   * - vehicleType valide (5 valeurs)
   * - geocoding pickup_address Mapbox (decision Sprint 17)
   */
  async dispatchTow(_input: DispatchTowInput): Promise<TowMission> {
    throw new NotImplementedError('dispatchTow', TARGET_SPRINT);
  }

  /**
   * Update workflow status d'une mission.
   *
   * Transitions valides :
   * requested -> accepted | cancelled
   * accepted -> in_progress | cancelled
   * in_progress -> completed | cancelled
   *
   * Sprint 22.5 : WebSocket emit + push notification + audit_log entry.
   */
  async updateTowMissionStatus(_input: UpdateTowMissionStatusInput): Promise<TowMission> {
    throw new NotImplementedError('updateTowMissionStatus', TARGET_SPRINT);
  }

  /**
   * Liste missions du tenant courant. RLS automatique.
   *
   * Sprint 22.5 :
   * - tow_admin : toutes les missions du tenant
   * - tow_dispatcher : missions a affecter + en cours
   * - tow_driver : ses missions personnelles
   */
  async listTowMissions(_filters?: {
    status?: string;
    driverId?: string;
  }): Promise<TowMission[]> {
    throw new NotImplementedError('listTowMissions', TARGET_SPRINT);
  }
}
