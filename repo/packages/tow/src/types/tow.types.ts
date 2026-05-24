/**
 * Tow types -- Sprint 7.5b foundation skeleton (decision-012).
 *
 * Sprint 22.5 (Tow App) creera implementations + UI Uber-style + WebSocket dispatch.
 *
 * Workflow tow mission (decision-012 cross-tenant types 4 + 5) :
 *   requested -> accepted -> in_progress -> completed | cancelled
 *
 * Le tow tenant est un Customer B2B distinct (operateur remorquage Marrakech etc.).
 */

/** Statut d'une mission de remorquage (cycle). */
export type TowMissionStatus =
  | 'requested'
  | 'accepted'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

/** Type vehicule remorque. */
export type TowVehicleType =
  | 'car'
  | 'suv'
  | 'truck_light'
  | 'truck_heavy'
  | 'motorcycle';

/** Source de la demande (cross-tenant type 4 client_to_tower_dispatch). */
export type TowRequestSource = 'assure' | 'broker' | 'garage';
