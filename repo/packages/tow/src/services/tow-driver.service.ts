/**
 * TowDriverService -- Sprint 7.5b.9 skeleton signatures.
 *
 * Implementations runtime : Sprint 22.5 (Tow App driver PWA mobile).
 *
 * Signatures :
 *   - registerDriver : INSERT tow_drivers (status=offline)
 *   - assignDriverToMission : dispatcher action
 */

import { NotImplementedError } from '../index.js';
import type {
  AssignDriverToMissionInput,
  RegisterTowDriverInput,
  TowDriver,
} from '../types/tow-driver.types.js';

const TARGET_SPRINT = 'Sprint 22.5';

export class TowDriverService {
  /**
   * Inscrit un nouveau conducteur (driver).
   *
   * Validations (Sprint 22.5) :
   * - licenseNumber format permis MA valide
   * - vehiclePlate format plaque MA (NNNNN-X-N)
   * - userId doit avoir role tow_driver (RBAC v3.0)
   * - tenant_id doit etre type='tow' (decision-012)
   */
  async registerDriver(_input: RegisterTowDriverInput): Promise<TowDriver> {
    throw new NotImplementedError('registerDriver', TARGET_SPRINT);
  }

  /**
   * Assigne un driver a une mission (action tow_dispatcher).
   *
   * Workflow :
   * - mission doit etre status='requested'
   * - driver doit etre status='available'
   * - UPDATE mission.assigned_driver_id + driver.status='busy'
   * - WebSocket emit + push notification driver
   *
   * Sprint 22.5 : verification proximite geographique optional.
   */
  async assignDriverToMission(
    _input: AssignDriverToMissionInput,
  ): Promise<{ mission: { id: string }; driver: TowDriver }> {
    throw new NotImplementedError('assignDriverToMission', TARGET_SPRINT);
  }
}
