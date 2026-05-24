/**
 * Sprint 8 Tache 8.5 -- RESHAPE crm_interactions pour polymorphisme + soft-delete
 * hybride compatible avec l'immutabilite append-only Sprint 2.
 *
 * Decision architecturale (user Task 8.5 prompt) :
 *   - Polymorphisme Option B : 3 colonnes nullable (company_id / contact_id /
 *     deal_id) avec CHECK exactly-one-not-null. FK natifs Postgres + query
 *     planner indexes natifs, pas de trigger custom polymorphique.
 *   - Mutability Hybrid : Sprint 2 a installe des triggers append-only sur
 *     UPDATE/DELETE (decision-008 CNDP audit). Sprint 8.5 PRESERVE ces
 *     triggers (loi 09-08 immutability) et AJOUTE des fonctions SECURITY
 *     DEFINER `crm_interactions_soft_delete` + `crm_interactions_restore`
 *     qui sont les SEULES voies pour toggler `deleted_at`. Le mecanisme
 *     existant `app.archivist_bypass` est utilise par ces fonctions.
 *
 * Reshape :
 *   - ALTER contact_id NOT NULL -> NULL, FK RESTRICT -> CASCADE
 *   - ALTER deal_id FK RESTRICT -> CASCADE
 *   - ALTER direction NOT NULL -> NULL (only for call/email/whatsapp/sms)
 *   - ADD company_id uuid NULL FK -> crm_companies(id) ON DELETE CASCADE
 *   - DROP COLUMN content (renomme en body, no data to migrate -- fresh DB)
 *   - ADD COLUMN body text NULL
 *   - ADD COLUMN duration_minutes int NULL CHECK (only for call/meeting)
 *   - ADD COLUMN status varchar(15) NULL CHECK
 *   - ADD COLUMN deleted_at timestamptz NULL (soft delete)
 *   - ADD COLUMN deleted_by uuid NULL (audit who soft-deleted)
 *   - ADD COLUMN updated_at timestamptz NOT NULL DEFAULT NOW()
 *   - ADD COLUMN updated_by uuid NULL
 *   - ADD COLUMN parent_interaction_id uuid NULL FK SET NULL (annotation)
 *   - ADD CHECK exactly-one (company_id / contact_id / deal_id)
 *   - ADD CHECK type-direction consistency
 *   - ADD CHECK type-duration consistency
 *   - ADD CHECK type-status consistency
 *   - ADD new indexes + rename content_trgm -> body_trgm
 *   - ADD SECURITY DEFINER functions for soft-delete + restore
 *   - GRANT EXECUTE on functions to insurtech_app
 *
 * Cascade rationale : interactions are historical logs tied to an entity;
 * if entity is deleted, logs lose meaning (vs Deal 8.4 RESTRICT which
 * preserves commercial history). User Task 8.5 prompt decision.
 *
 * Bug #5 Pause #5 prevention : grants explicites.
 *
 * Reference : B-08 Tache 3.1.5.
 */

import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ReshapeCrmInteractionsPolymorphic1735000000018
  implements MigrationInterface
{
  name = 'ReshapeCrmInteractionsPolymorphic1735000000018';

  async up(q: QueryRunner): Promise<void> {
    // -------------------------------------------------------------------------
    // 1. Drop legacy indexes/constraints that reference columns we will change
    // -------------------------------------------------------------------------
    await q.query(`DROP INDEX IF EXISTS idx_crm_interactions_content_trgm;`);
    await q.query(
      `ALTER TABLE crm_interactions DROP CONSTRAINT IF EXISTS crm_interactions_content_max_size;`,
    );

    // -------------------------------------------------------------------------
    // 2. Rename content -> body (DROP + ADD : fresh DB, no data to migrate)
    // -------------------------------------------------------------------------
    await q.query(`ALTER TABLE crm_interactions DROP COLUMN IF EXISTS content;`);
    await q.query(`ALTER TABLE crm_interactions ADD COLUMN body text;`);
    await q.query(`
      ALTER TABLE crm_interactions
        ADD CONSTRAINT crm_interactions_body_max_size
        CHECK (body IS NULL OR char_length(body) < 50000);
    `);

    // -------------------------------------------------------------------------
    // 3. Polymorphism : contact_id -> NULL + CASCADE ; add company_id ; deal_id CASCADE
    // -------------------------------------------------------------------------
    await q.query(
      `ALTER TABLE crm_interactions DROP CONSTRAINT IF EXISTS crm_interactions_contact_id_fkey;`,
    );
    await q.query(`ALTER TABLE crm_interactions ALTER COLUMN contact_id DROP NOT NULL;`);
    await q.query(`
      ALTER TABLE crm_interactions
        ADD CONSTRAINT crm_interactions_contact_id_fkey
        FOREIGN KEY (contact_id) REFERENCES crm_contacts(id) ON DELETE CASCADE;
    `);

    await q.query(
      `ALTER TABLE crm_interactions DROP CONSTRAINT IF EXISTS crm_interactions_deal_id_fkey;`,
    );
    await q.query(`
      ALTER TABLE crm_interactions
        ADD CONSTRAINT crm_interactions_deal_id_fkey
        FOREIGN KEY (deal_id) REFERENCES crm_deals(id) ON DELETE CASCADE;
    `);

    await q.query(`ALTER TABLE crm_interactions ADD COLUMN company_id uuid;`);
    await q.query(`
      ALTER TABLE crm_interactions
        ADD CONSTRAINT crm_interactions_company_id_fkey
        FOREIGN KEY (company_id) REFERENCES crm_companies(id) ON DELETE CASCADE;
    `);

    // -------------------------------------------------------------------------
    // 4. direction NOT NULL -> NULL (only for call/email/whatsapp ; nullable for note/meeting)
    // -------------------------------------------------------------------------
    await q.query(`ALTER TABLE crm_interactions ALTER COLUMN direction DROP NOT NULL;`);

    // -------------------------------------------------------------------------
    // 5. New columns : duration_minutes / status / soft-delete / annotate parent
    // -------------------------------------------------------------------------
    await q.query(`ALTER TABLE crm_interactions ADD COLUMN duration_minutes int;`);
    await q.query(`ALTER TABLE crm_interactions ADD COLUMN status varchar(15);`);
    await q.query(`ALTER TABLE crm_interactions ADD COLUMN deleted_at timestamptz;`);
    await q.query(`ALTER TABLE crm_interactions ADD COLUMN deleted_by uuid;`);
    await q.query(
      `ALTER TABLE crm_interactions ADD COLUMN updated_at timestamptz NOT NULL DEFAULT NOW();`,
    );
    await q.query(`ALTER TABLE crm_interactions ADD COLUMN updated_by uuid;`);
    await q.query(
      `ALTER TABLE crm_interactions ADD COLUMN parent_interaction_id uuid;`,
    );
    await q.query(`
      ALTER TABLE crm_interactions
        ADD CONSTRAINT crm_interactions_parent_fkey
        FOREIGN KEY (parent_interaction_id)
        REFERENCES crm_interactions(id)
        ON DELETE SET NULL;
    `);

    // -------------------------------------------------------------------------
    // 6. CHECK constraints
    // -------------------------------------------------------------------------
    // Exactly-one-not-null among (company_id, contact_id, deal_id)
    await q.query(`
      ALTER TABLE crm_interactions
        ADD CONSTRAINT crm_interactions_exactly_one_related
        CHECK (
          (CASE WHEN company_id IS NOT NULL THEN 1 ELSE 0 END)
        + (CASE WHEN contact_id IS NOT NULL THEN 1 ELSE 0 END)
        + (CASE WHEN deal_id    IS NOT NULL THEN 1 ELSE 0 END)
        = 1
        );
    `);

    // duration_minutes only for type IN ('call', 'meeting')
    await q.query(`
      ALTER TABLE crm_interactions
        ADD CONSTRAINT crm_interactions_duration_consistency
        CHECK (
          duration_minutes IS NULL
          OR type::text IN ('call', 'meeting')
        );
    `);

    // direction only for type IN ('call', 'email', 'whatsapp')
    // (existing crm_interaction_type enum : call/email/whatsapp/meeting/note ;
    //  'sms' + 'task' will be added in a future migration if needed)
    await q.query(`
      ALTER TABLE crm_interactions
        ADD CONSTRAINT crm_interactions_direction_consistency
        CHECK (
          direction IS NULL
          OR type::text IN ('call', 'email', 'whatsapp')
        );
    `);

    // status enum-as-CHECK : only for type IN ('meeting', 'call')
    await q.query(`
      ALTER TABLE crm_interactions
        ADD CONSTRAINT crm_interactions_status_values
        CHECK (
          status IS NULL
          OR status IN ('scheduled', 'completed', 'cancelled', 'no_answer')
        );
    `);
    await q.query(`
      ALTER TABLE crm_interactions
        ADD CONSTRAINT crm_interactions_status_consistency
        CHECK (
          status IS NULL
          OR type::text IN ('meeting', 'call')
        );
    `);

    // soft-delete consistency : deleted_at <=> deleted_by both set or both null
    await q.query(`
      ALTER TABLE crm_interactions
        ADD CONSTRAINT crm_interactions_delete_consistency
        CHECK (
          (deleted_at IS NULL AND deleted_by IS NULL)
          OR (deleted_at IS NOT NULL AND deleted_by IS NOT NULL)
        );
    `);

    // -------------------------------------------------------------------------
    // 7. New indexes (timeline + polymorphic scoping + FTS on body)
    // -------------------------------------------------------------------------
    await q.query(`
      CREATE INDEX IF NOT EXISTS idx_crm_interactions_tenant_company
        ON crm_interactions(tenant_id, company_id, occurred_at DESC)
        WHERE company_id IS NOT NULL AND deleted_at IS NULL;
    `);
    // Sprint 2 had idx_crm_interactions_tenant_contact / _deal -- recreate to scope to deleted_at NULL
    await q.query(`DROP INDEX IF EXISTS idx_crm_interactions_tenant_contact;`);
    await q.query(`
      CREATE INDEX IF NOT EXISTS idx_crm_interactions_tenant_contact
        ON crm_interactions(tenant_id, contact_id, occurred_at DESC)
        WHERE contact_id IS NOT NULL AND deleted_at IS NULL;
    `);
    await q.query(`DROP INDEX IF EXISTS idx_crm_interactions_tenant_deal;`);
    await q.query(`
      CREATE INDEX IF NOT EXISTS idx_crm_interactions_tenant_deal
        ON crm_interactions(tenant_id, deal_id, occurred_at DESC)
        WHERE deal_id IS NOT NULL AND deleted_at IS NULL;
    `);
    // Global tenant timeline
    await q.query(`
      CREATE INDEX IF NOT EXISTS idx_crm_interactions_tenant_occurred
        ON crm_interactions(tenant_id, occurred_at DESC)
        WHERE deleted_at IS NULL;
    `);
    // Owner index (audit)
    await q.query(`
      CREATE INDEX IF NOT EXISTS idx_crm_interactions_tenant_created_by
        ON crm_interactions(tenant_id, created_by, occurred_at DESC)
        WHERE deleted_at IS NULL;
    `);
    // Parent index (annotate)
    await q.query(`
      CREATE INDEX IF NOT EXISTS idx_crm_interactions_parent
        ON crm_interactions(parent_interaction_id)
        WHERE parent_interaction_id IS NOT NULL;
    `);
    // FTS trgm on body (replaces content_trgm)
    await q.query(`
      CREATE INDEX IF NOT EXISTS idx_crm_interactions_body_trgm
        ON crm_interactions USING GIN (substring(body, 1, 5000) gin_trgm_ops)
        WHERE body IS NOT NULL AND deleted_at IS NULL;
    `);

    // -------------------------------------------------------------------------
    // 8. SECURITY DEFINER functions for soft-delete + restore
    //
    //    Sprint 2 trigger `crm_interactions_block_modification()` blocks all
    //    UPDATE/DELETE unless session var `app.archivist_bypass = 'true'`.
    //    These functions set that GUC locally and perform a targeted UPDATE.
    //    Service layer is the ONLY caller (permission-gated).
    // -------------------------------------------------------------------------
    await q.query(`
      CREATE OR REPLACE FUNCTION crm_interactions_soft_delete(
        p_interaction_id uuid,
        p_user_id uuid
      )
      RETURNS void
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $$
      BEGIN
        PERFORM set_config('app.archivist_bypass', 'true', true);
        UPDATE crm_interactions
          SET deleted_at = NOW(),
              deleted_by = p_user_id,
              updated_at = NOW(),
              updated_by = p_user_id
          WHERE id = p_interaction_id
            AND deleted_at IS NULL;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'crm_interactions: % introuvable ou deja supprime', p_interaction_id
            USING ERRCODE = 'P0002';
        END IF;
      END;
      $$;
    `);

    await q.query(`
      CREATE OR REPLACE FUNCTION crm_interactions_restore(
        p_interaction_id uuid,
        p_user_id uuid
      )
      RETURNS void
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $$
      BEGIN
        PERFORM set_config('app.archivist_bypass', 'true', true);
        UPDATE crm_interactions
          SET deleted_at = NULL,
              deleted_by = NULL,
              updated_at = NOW(),
              updated_by = p_user_id
          WHERE id = p_interaction_id
            AND deleted_at IS NOT NULL;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'crm_interactions: % introuvable ou non supprime', p_interaction_id
            USING ERRCODE = 'P0002';
        END IF;
      END;
      $$;
    `);

    // GRANT EXECUTE on these to insurtech_app (only entry points for mutability).
    await q.query(`
      GRANT EXECUTE ON FUNCTION crm_interactions_soft_delete(uuid, uuid)
        TO insurtech_app, insurtech_admin;
    `);
    await q.query(`
      GRANT EXECUTE ON FUNCTION crm_interactions_restore(uuid, uuid)
        TO insurtech_app, insurtech_admin;
    `);

    // Documentation
    await q.query(
      `COMMENT ON COLUMN crm_interactions.company_id IS 'Polymorphic FK -- CASCADE -- exactly one of (company_id, contact_id, deal_id) NOT NULL';`,
    );
    await q.query(
      `COMMENT ON COLUMN crm_interactions.deleted_at IS 'Soft-delete via SECURITY DEFINER crm_interactions_soft_delete(uuid, uuid). NEVER UPDATE directly (trigger blocks).';`,
    );
    await q.query(
      `COMMENT ON FUNCTION crm_interactions_soft_delete(uuid, uuid) IS 'Sprint 8.5 -- single entry point for toggling deleted_at. Bypasses append-only trigger via app.archivist_bypass GUC.';`,
    );
    await q.query(
      `COMMENT ON FUNCTION crm_interactions_restore(uuid, uuid) IS 'Sprint 8.5 -- restore soft-deleted interaction. Admin-gated at service layer via CRM_INTERACTIONS_RESTORE perm.';`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    // Drop SECURITY DEFINER functions
    await q.query(`DROP FUNCTION IF EXISTS crm_interactions_restore(uuid, uuid);`);
    await q.query(`DROP FUNCTION IF EXISTS crm_interactions_soft_delete(uuid, uuid);`);

    // Drop new indexes
    await q.query(`DROP INDEX IF EXISTS idx_crm_interactions_body_trgm;`);
    await q.query(`DROP INDEX IF EXISTS idx_crm_interactions_parent;`);
    await q.query(`DROP INDEX IF EXISTS idx_crm_interactions_tenant_created_by;`);
    await q.query(`DROP INDEX IF EXISTS idx_crm_interactions_tenant_occurred;`);
    await q.query(`DROP INDEX IF EXISTS idx_crm_interactions_tenant_company;`);
    // Recreate Sprint 2 simpler indexes on contact/deal (without deleted_at filter)
    await q.query(`DROP INDEX IF EXISTS idx_crm_interactions_tenant_contact;`);
    await q.query(`DROP INDEX IF EXISTS idx_crm_interactions_tenant_deal;`);

    // Drop CHECK constraints
    await q.query(
      `ALTER TABLE crm_interactions DROP CONSTRAINT IF EXISTS crm_interactions_delete_consistency;`,
    );
    await q.query(
      `ALTER TABLE crm_interactions DROP CONSTRAINT IF EXISTS crm_interactions_status_consistency;`,
    );
    await q.query(
      `ALTER TABLE crm_interactions DROP CONSTRAINT IF EXISTS crm_interactions_status_values;`,
    );
    await q.query(
      `ALTER TABLE crm_interactions DROP CONSTRAINT IF EXISTS crm_interactions_direction_consistency;`,
    );
    await q.query(
      `ALTER TABLE crm_interactions DROP CONSTRAINT IF EXISTS crm_interactions_duration_consistency;`,
    );
    await q.query(
      `ALTER TABLE crm_interactions DROP CONSTRAINT IF EXISTS crm_interactions_exactly_one_related;`,
    );
    await q.query(
      `ALTER TABLE crm_interactions DROP CONSTRAINT IF EXISTS crm_interactions_parent_fkey;`,
    );

    // Drop new columns
    await q.query(`ALTER TABLE crm_interactions DROP COLUMN IF EXISTS parent_interaction_id;`);
    await q.query(`ALTER TABLE crm_interactions DROP COLUMN IF EXISTS updated_by;`);
    await q.query(`ALTER TABLE crm_interactions DROP COLUMN IF EXISTS updated_at;`);
    await q.query(`ALTER TABLE crm_interactions DROP COLUMN IF EXISTS deleted_by;`);
    await q.query(`ALTER TABLE crm_interactions DROP COLUMN IF EXISTS deleted_at;`);
    await q.query(`ALTER TABLE crm_interactions DROP COLUMN IF EXISTS status;`);
    await q.query(`ALTER TABLE crm_interactions DROP COLUMN IF EXISTS duration_minutes;`);

    // Restore direction NOT NULL
    await q.query(`ALTER TABLE crm_interactions ALTER COLUMN direction SET NOT NULL;`);

    // Drop company FK + column
    await q.query(
      `ALTER TABLE crm_interactions DROP CONSTRAINT IF EXISTS crm_interactions_company_id_fkey;`,
    );
    await q.query(`ALTER TABLE crm_interactions DROP COLUMN IF EXISTS company_id;`);

    // Restore deal_id RESTRICT
    await q.query(
      `ALTER TABLE crm_interactions DROP CONSTRAINT IF EXISTS crm_interactions_deal_id_fkey;`,
    );
    await q.query(`
      ALTER TABLE crm_interactions
        ADD CONSTRAINT crm_interactions_deal_id_fkey
        FOREIGN KEY (deal_id) REFERENCES crm_deals(id) ON DELETE RESTRICT;
    `);

    // Restore contact_id NOT NULL + RESTRICT
    await q.query(
      `ALTER TABLE crm_interactions DROP CONSTRAINT IF EXISTS crm_interactions_contact_id_fkey;`,
    );
    await q.query(`ALTER TABLE crm_interactions ALTER COLUMN contact_id SET NOT NULL;`);
    await q.query(`
      ALTER TABLE crm_interactions
        ADD CONSTRAINT crm_interactions_contact_id_fkey
        FOREIGN KEY (contact_id) REFERENCES crm_contacts(id) ON DELETE RESTRICT;
    `);

    // Rename body -> content
    await q.query(
      `ALTER TABLE crm_interactions DROP CONSTRAINT IF EXISTS crm_interactions_body_max_size;`,
    );
    await q.query(`ALTER TABLE crm_interactions DROP COLUMN IF EXISTS body;`);
    await q.query(`ALTER TABLE crm_interactions ADD COLUMN content text;`);
    await q.query(`
      ALTER TABLE crm_interactions
        ADD CONSTRAINT crm_interactions_content_max_size
        CHECK (content IS NULL OR char_length(content) < 50000);
    `);

    // Restore legacy indexes
    await q.query(`
      CREATE INDEX IF NOT EXISTS idx_crm_interactions_tenant_contact
        ON crm_interactions(tenant_id, contact_id, occurred_at DESC);
    `);
    await q.query(`
      CREATE INDEX IF NOT EXISTS idx_crm_interactions_tenant_deal
        ON crm_interactions(tenant_id, deal_id, occurred_at DESC)
        WHERE deal_id IS NOT NULL;
    `);
    await q.query(`
      CREATE INDEX IF NOT EXISTS idx_crm_interactions_content_trgm
        ON crm_interactions USING GIN (substring(content, 1, 5000) gin_trgm_ops)
        WHERE content IS NOT NULL;
    `);
  }
}
