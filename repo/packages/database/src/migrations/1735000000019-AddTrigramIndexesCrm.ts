/**
 * Sprint 8 Tache 8.6 -- ADD missing trigram GIN index for cross-CRM search.
 *
 * Most trigram indexes already in place from prior migrations :
 *   - Sprint 2 (migration 002) : crm_companies.name/email + crm_contacts.full_name/email/phone
 *   - Sprint 8.4 (migration 017) : crm_deals.name (renamed from title)
 *   - Sprint 8.5 (migration 018) : crm_interactions.subject + body
 *
 * Missing : crm_deals.description (column added by Task 8.4 reshape but no
 * trgm idx yet). Task 8.6 cross-entity search includes deal description as
 * a queryable field, so we add the GIN trgm index here.
 *
 * Reference : B-08 Tache 3.1.6.
 */

import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTrigramIndexesCrm1735000000019 implements MigrationInterface {
  name = 'AddTrigramIndexesCrm1735000000019';

  async up(q: QueryRunner): Promise<void> {
    // GIN trgm on crm_deals.description (search target Task 8.6 globalSearch)
    await q.query(`
      CREATE INDEX IF NOT EXISTS idx_crm_deals_description_trgm
        ON crm_deals USING GIN (description gin_trgm_ops)
        WHERE description IS NOT NULL AND deleted_at IS NULL;
    `);

    await q.query(
      `COMMENT ON INDEX idx_crm_deals_description_trgm IS 'GIN trgm pour crm_deals.description -- search Task 8.6 globalSearch';`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS idx_crm_deals_description_trgm;`);
  }
}
