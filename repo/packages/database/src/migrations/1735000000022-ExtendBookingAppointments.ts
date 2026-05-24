/**
 * Sprint 8 Tache 8.9 part 1 -- ALTER TYPE booking_appointment_status ADD VALUE 'in_progress'.
 *
 * SPLIT NECESSAIRE : Postgres restriction "New enum values must be committed
 * before they can be used" (errcode 55P04 / routine check_safe_enum_use).
 * Cette migration ne fait QUE l'ajout de valeur enum ; la migration suivante
 * (023) utilise 'in_progress' dans des indexes partiels.
 *
 * State machine 6 valeurs apres ce changement :
 *   scheduled / confirmed / in_progress / completed / cancelled / no_show
 *
 * Reference : B-08 Tache 3.2.2 (split part 1/2).
 */

import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ExtendBookingAppointmentsAddEnum1735000000022
  implements MigrationInterface
{
  name = 'ExtendBookingAppointmentsAddEnum1735000000022';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TYPE booking_appointment_status ADD VALUE IF NOT EXISTS 'in_progress'
        BEFORE 'completed';
    `);
  }

  async down(_q: QueryRunner): Promise<void> {
    // Postgres ne supporte pas ALTER TYPE DROP VALUE. La valeur 'in_progress'
    // reste dans l'enum apres un down() -- acceptable car developer tooling.
  }
}
