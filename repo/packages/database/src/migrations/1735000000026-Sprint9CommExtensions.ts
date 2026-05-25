import { type MigrationInterface, type QueryRunner } from 'typeorm';

/**
 * Sprint 9 Tache 3.2.1 -- migration delta enums communications.
 *
 * 1. comm_status_enum : ajoute valeur 'bounced' (Sprint 9 Tache 3.2.10 hard bounce auto opt-out)
 * 2. comm_language_enum : ajoute valeur 'en' (decision-008 multilingue 4 locales fr/ar-MA/ar/en)
 *
 * down() : impossible de DROP VALUE FROM ENUM en PostgreSQL natif ; on documente le rollback
 * en commentaire et on conserve les valeurs (safe forward-only).
 */
export class Sprint9CommExtensions1735000000026 implements MigrationInterface {
  public name = 'Sprint9CommExtensions1735000000026';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type t
          JOIN pg_enum e ON t.oid = e.enumtypid
          WHERE t.typname = 'comm_status_enum' AND e.enumlabel = 'bounced'
        ) THEN
          ALTER TYPE comm_status_enum ADD VALUE 'bounced' AFTER 'failed';
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type t
          JOIN pg_enum e ON t.oid = e.enumtypid
          WHERE t.typname = 'comm_language_enum' AND e.enumlabel = 'en'
        ) THEN
          ALTER TYPE comm_language_enum ADD VALUE 'en' AFTER 'ar';
        END IF;
      END$$;
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL ne supporte pas DROP VALUE FROM ENUM en natif.
    // Rollback manuel : recreer le type sans ces valeurs et migrer les donnees.
    // Forward-only safe pour Sprint 9 (les valeurs ajoutees ne cassent pas les consumers existants).
  }
}
