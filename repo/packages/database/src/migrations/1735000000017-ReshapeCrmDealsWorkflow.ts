/**
 * Sprint 8 Tache 8.4 -- RESHAPE crm_deals pour workflow stages configurables.
 *
 * Contexte : Sprint 2 a fige crm_deals.stage en ENUM 6 valeurs hardcoded
 * (lead/qualified/proposal/negotiation/won/lost). Sprint 8.3 a introduit les
 * tables crm_pipelines + crm_stages (configurable per tenant). Cette migration
 * 017 reforme crm_deals pour referencer pipeline_id + stage_id.
 *
 * Choix architectural (user decision Task 8.4 prompt) : "Full reshape" -- on
 * supprime les colonnes legacy au lieu d'ajouter en additive. Plus propre,
 * casse intentionnellement les tests qui utilisent l'ancien shape (mis a jour
 * dans le meme commit).
 *
 * Changements :
 *   DROP   : colonnes title, stage (ENUM), won_at, lost_at, lost_reason, notes,
 *            amount_dirham
 *   DROP   : ENUM type crm_deal_stage
 *   DROP   : indexes/constraints relies aux colonnes supprimees
 *   ADD    : pipeline_id uuid NOT NULL FK -> crm_pipelines(id) ON DELETE RESTRICT
 *   ADD    : stage_id    uuid NOT NULL FK -> crm_stages(id)    ON DELETE RESTRICT
 *   ADD    : name        varchar(200) NOT NULL CHECK length >= 1
 *   ADD    : amount      numeric(15,2) NOT NULL DEFAULT 0 CHECK >= 0
 *   ADD    : description text NULLABLE
 *   ADD    : closed_won  boolean NULLABLE
 *   ADD    : closed_at   timestamptz NULLABLE
 *   ALTER  : company_id  NULL -> NOT NULL (Task 8.4 spec : company obligatoire)
 *   ALTER  : contact_id  NOT NULL -> NULL + FK ON DELETE SET NULL
 *            (Task 8.4 spec : contact peut etre supprime, deal conserve)
 *   ADD    : CHECK closed_consistency : (closed_won, closed_at) tous deux NULL
 *            ou tous deux NOT NULL (un deal "open" a closed_won IS NULL)
 *   ADD    : indexes (tenant, pipeline_id, stage_id), (tenant, company_id),
 *            (tenant, owner_user_id), (tenant, closed_won, closed_at) WHERE
 *            closed_won IS NOT NULL
 *   ADD    : GIN trigram sur name (renommage de title_trgm)
 *
 * Multi-tenant : pas de changement RLS (deja FORCE depuis Sprint 2).
 * Bug #5 Pause #5 prevention : grants conserves (insurtech_app SELECT/INSERT/UPDATE/DELETE).
 *
 * Reference : B-08 Tache 3.1.4.
 */

import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ReshapeCrmDealsWorkflow1735000000017 implements MigrationInterface {
  name = 'ReshapeCrmDealsWorkflow1735000000017';

  async up(q: QueryRunner): Promise<void> {
    // ---------------------------------------------------------------------
    // 1. Drop legacy indexes that reference columns we will drop
    // ---------------------------------------------------------------------
    await q.query(`DROP INDEX IF EXISTS idx_crm_deals_tenant_stage;`);
    await q.query(`DROP INDEX IF EXISTS idx_crm_deals_close_date;`);
    await q.query(`DROP INDEX IF EXISTS idx_crm_deals_title_trgm;`);

    // ---------------------------------------------------------------------
    // 2. Drop legacy CHECK constraints + columns
    // ---------------------------------------------------------------------
    await q.query(
      `ALTER TABLE crm_deals DROP CONSTRAINT IF EXISTS crm_deals_won_consistency;`,
    );
    await q.query(
      `ALTER TABLE crm_deals DROP CONSTRAINT IF EXISTS crm_deals_lost_consistency;`,
    );
    await q.query(
      `ALTER TABLE crm_deals DROP CONSTRAINT IF EXISTS crm_deals_title_not_empty;`,
    );
    await q.query(
      `ALTER TABLE crm_deals DROP CONSTRAINT IF EXISTS crm_deals_amount_positive;`,
    );
    await q.query(
      `ALTER TABLE crm_deals DROP CONSTRAINT IF EXISTS crm_deals_currency_iso;`,
    );

    await q.query(`ALTER TABLE crm_deals DROP COLUMN IF EXISTS title;`);
    await q.query(`ALTER TABLE crm_deals DROP COLUMN IF EXISTS stage;`);
    await q.query(`ALTER TABLE crm_deals DROP COLUMN IF EXISTS won_at;`);
    await q.query(`ALTER TABLE crm_deals DROP COLUMN IF EXISTS lost_at;`);
    await q.query(`ALTER TABLE crm_deals DROP COLUMN IF EXISTS lost_reason;`);
    await q.query(`ALTER TABLE crm_deals DROP COLUMN IF EXISTS notes;`);
    await q.query(`ALTER TABLE crm_deals DROP COLUMN IF EXISTS amount_dirham;`);

    // ---------------------------------------------------------------------
    // 3. Drop the now-unused ENUM type
    // ---------------------------------------------------------------------
    await q.query(`DROP TYPE IF EXISTS crm_deal_stage;`);

    // ---------------------------------------------------------------------
    // 4. Adjust legacy contact_id : NOT NULL -> NULL + ON DELETE SET NULL
    // ---------------------------------------------------------------------
    await q.query(
      `ALTER TABLE crm_deals DROP CONSTRAINT IF EXISTS crm_deals_contact_id_fkey;`,
    );
    await q.query(`ALTER TABLE crm_deals ALTER COLUMN contact_id DROP NOT NULL;`);
    await q.query(`
      ALTER TABLE crm_deals
        ADD CONSTRAINT crm_deals_contact_id_fkey
        FOREIGN KEY (contact_id) REFERENCES crm_contacts(id) ON DELETE SET NULL;
    `);

    // ---------------------------------------------------------------------
    // 5. Add new columns (pipeline_id + stage_id + name + amount + close model)
    //
    //    company_id is currently nullable. There is no row yet (fresh DB), so
    //    we can safely flip to NOT NULL after adding the new mandatory columns.
    // ---------------------------------------------------------------------
    await q.query(`ALTER TABLE crm_deals ADD COLUMN pipeline_id uuid;`);
    await q.query(`ALTER TABLE crm_deals ADD COLUMN stage_id uuid;`);
    await q.query(`ALTER TABLE crm_deals ADD COLUMN name varchar(200);`);
    await q.query(
      `ALTER TABLE crm_deals ADD COLUMN amount numeric(15,2) NOT NULL DEFAULT 0;`,
    );
    await q.query(`ALTER TABLE crm_deals ADD COLUMN description text;`);
    await q.query(`ALTER TABLE crm_deals ADD COLUMN closed_won boolean;`);
    await q.query(`ALTER TABLE crm_deals ADD COLUMN closed_at timestamptz;`);

    // Mandatory FKs after column add
    await q.query(`
      ALTER TABLE crm_deals
        ADD CONSTRAINT crm_deals_pipeline_id_fkey
        FOREIGN KEY (pipeline_id) REFERENCES crm_pipelines(id) ON DELETE RESTRICT;
    `);
    await q.query(`
      ALTER TABLE crm_deals
        ADD CONSTRAINT crm_deals_stage_id_fkey
        FOREIGN KEY (stage_id) REFERENCES crm_stages(id) ON DELETE RESTRICT;
    `);

    // ---------------------------------------------------------------------
    // 6. Promote mandatory columns to NOT NULL (DB is empty; safe).
    // ---------------------------------------------------------------------
    await q.query(`ALTER TABLE crm_deals ALTER COLUMN company_id SET NOT NULL;`);
    await q.query(`ALTER TABLE crm_deals ALTER COLUMN pipeline_id SET NOT NULL;`);
    await q.query(`ALTER TABLE crm_deals ALTER COLUMN stage_id SET NOT NULL;`);
    await q.query(`ALTER TABLE crm_deals ALTER COLUMN name SET NOT NULL;`);

    // ---------------------------------------------------------------------
    // 7. CHECK constraints
    // ---------------------------------------------------------------------
    await q.query(`
      ALTER TABLE crm_deals
        ADD CONSTRAINT crm_deals_name_not_empty
        CHECK (char_length(name) >= 1);
    `);
    await q.query(`
      ALTER TABLE crm_deals
        ADD CONSTRAINT crm_deals_amount_non_negative
        CHECK (amount >= 0);
    `);
    await q.query(`
      ALTER TABLE crm_deals
        ADD CONSTRAINT crm_deals_currency_iso
        CHECK (currency ~ '^[A-Z]{3}$');
    `);
    await q.query(`
      ALTER TABLE crm_deals
        ADD CONSTRAINT crm_deals_close_consistency
        CHECK (
          (closed_won IS NULL AND closed_at IS NULL)
          OR (closed_won IS NOT NULL AND closed_at IS NOT NULL)
        );
    `);

    // ---------------------------------------------------------------------
    // 8. New indexes
    // ---------------------------------------------------------------------
    await q.query(`
      CREATE INDEX IF NOT EXISTS idx_crm_deals_tenant_pipeline_stage
        ON crm_deals(tenant_id, pipeline_id, stage_id)
        WHERE deleted_at IS NULL;
    `);
    await q.query(`
      CREATE INDEX IF NOT EXISTS idx_crm_deals_tenant_company
        ON crm_deals(tenant_id, company_id)
        WHERE deleted_at IS NULL;
    `);
    // owner index : restore (legacy idx_crm_deals_owner already present, we recreate name-stable)
    await q.query(`DROP INDEX IF EXISTS idx_crm_deals_owner;`);
    await q.query(`
      CREATE INDEX IF NOT EXISTS idx_crm_deals_tenant_owner
        ON crm_deals(tenant_id, owner_user_id)
        WHERE deleted_at IS NULL;
    `);
    await q.query(`
      CREATE INDEX IF NOT EXISTS idx_crm_deals_closed
        ON crm_deals(tenant_id, closed_won, closed_at)
        WHERE closed_won IS NOT NULL AND deleted_at IS NULL;
    `);
    // GIN trigram on new name column (replaces idx_crm_deals_title_trgm)
    await q.query(`
      CREATE INDEX IF NOT EXISTS idx_crm_deals_name_trgm
        ON crm_deals USING GIN (name gin_trgm_ops)
        WHERE deleted_at IS NULL;
    `);

    // ---------------------------------------------------------------------
    // 9. Documentation
    // ---------------------------------------------------------------------
    await q.query(
      `COMMENT ON COLUMN crm_deals.pipeline_id IS 'FK crm_pipelines.id -- workflow configurable Sprint 8.3 -- ON DELETE RESTRICT';`,
    );
    await q.query(
      `COMMENT ON COLUMN crm_deals.stage_id IS 'FK crm_stages.id -- workflow stage actuel -- ON DELETE RESTRICT';`,
    );
    await q.query(
      `COMMENT ON COLUMN crm_deals.closed_won IS 'true=won / false=lost / NULL=open. Coherent avec closed_at (CHECK crm_deals_close_consistency).';`,
    );
    await q.query(
      `COMMENT ON COLUMN crm_deals.closed_at IS 'Timestamp de cloture (won OU lost). NULL si deal open.';`,
    );
    await q.query(
      `COMMENT ON COLUMN crm_deals.amount IS 'Montant deal en numeric(15,2). Currency dans colonne currency (ISO 4217).';`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    // Reverse path : drop new structure, re-create legacy.
    // (Sprint 2 down() removes the table entirely, so this is mostly for symmetry.)
    await q.query(`DROP INDEX IF EXISTS idx_crm_deals_name_trgm;`);
    await q.query(`DROP INDEX IF EXISTS idx_crm_deals_closed;`);
    await q.query(`DROP INDEX IF EXISTS idx_crm_deals_tenant_owner;`);
    await q.query(`DROP INDEX IF EXISTS idx_crm_deals_tenant_company;`);
    await q.query(`DROP INDEX IF EXISTS idx_crm_deals_tenant_pipeline_stage;`);

    await q.query(
      `ALTER TABLE crm_deals DROP CONSTRAINT IF EXISTS crm_deals_close_consistency;`,
    );
    await q.query(
      `ALTER TABLE crm_deals DROP CONSTRAINT IF EXISTS crm_deals_currency_iso;`,
    );
    await q.query(
      `ALTER TABLE crm_deals DROP CONSTRAINT IF EXISTS crm_deals_amount_non_negative;`,
    );
    await q.query(
      `ALTER TABLE crm_deals DROP CONSTRAINT IF EXISTS crm_deals_name_not_empty;`,
    );

    await q.query(
      `ALTER TABLE crm_deals DROP CONSTRAINT IF EXISTS crm_deals_stage_id_fkey;`,
    );
    await q.query(
      `ALTER TABLE crm_deals DROP CONSTRAINT IF EXISTS crm_deals_pipeline_id_fkey;`,
    );

    await q.query(`ALTER TABLE crm_deals DROP COLUMN IF EXISTS closed_at;`);
    await q.query(`ALTER TABLE crm_deals DROP COLUMN IF EXISTS closed_won;`);
    await q.query(`ALTER TABLE crm_deals DROP COLUMN IF EXISTS description;`);
    await q.query(`ALTER TABLE crm_deals DROP COLUMN IF EXISTS amount;`);
    await q.query(`ALTER TABLE crm_deals DROP COLUMN IF EXISTS name;`);
    await q.query(`ALTER TABLE crm_deals DROP COLUMN IF EXISTS stage_id;`);
    await q.query(`ALTER TABLE crm_deals DROP COLUMN IF EXISTS pipeline_id;`);

    // Restore contact_id NOT NULL + ON DELETE RESTRICT
    await q.query(
      `ALTER TABLE crm_deals DROP CONSTRAINT IF EXISTS crm_deals_contact_id_fkey;`,
    );
    await q.query(`ALTER TABLE crm_deals ALTER COLUMN contact_id SET NOT NULL;`);
    await q.query(`
      ALTER TABLE crm_deals
        ADD CONSTRAINT crm_deals_contact_id_fkey
        FOREIGN KEY (contact_id) REFERENCES crm_contacts(id) ON DELETE RESTRICT;
    `);
    // company_id back to NULLABLE
    await q.query(`ALTER TABLE crm_deals ALTER COLUMN company_id DROP NOT NULL;`);

    // Re-create legacy ENUM + columns
    await q.query(`
      CREATE TYPE crm_deal_stage AS ENUM (
        'lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'
      );
    `);
    await q.query(
      `ALTER TABLE crm_deals ADD COLUMN title text NOT NULL DEFAULT 'restored';`,
    );
    await q.query(`ALTER TABLE crm_deals ALTER COLUMN title DROP DEFAULT;`);
    await q.query(
      `ALTER TABLE crm_deals ADD COLUMN stage crm_deal_stage NOT NULL DEFAULT 'lead';`,
    );
    await q.query(`ALTER TABLE crm_deals ADD COLUMN won_at timestamptz;`);
    await q.query(`ALTER TABLE crm_deals ADD COLUMN lost_at timestamptz;`);
    await q.query(`ALTER TABLE crm_deals ADD COLUMN lost_reason text;`);
    await q.query(`ALTER TABLE crm_deals ADD COLUMN notes text;`);
    await q.query(
      `ALTER TABLE crm_deals ADD COLUMN amount_dirham numeric(15,2) NOT NULL DEFAULT 0;`,
    );

    await q.query(`
      ALTER TABLE crm_deals
        ADD CONSTRAINT crm_deals_title_not_empty CHECK (char_length(title) > 0);
    `);
    await q.query(`
      ALTER TABLE crm_deals
        ADD CONSTRAINT crm_deals_amount_positive CHECK (amount_dirham >= 0);
    `);
    await q.query(`
      ALTER TABLE crm_deals
        ADD CONSTRAINT crm_deals_currency_iso CHECK (currency ~ '^[A-Z]{3}$');
    `);
    await q.query(`
      ALTER TABLE crm_deals
        ADD CONSTRAINT crm_deals_won_consistency
        CHECK ((stage = 'won' AND won_at IS NOT NULL) OR stage <> 'won');
    `);
    await q.query(`
      ALTER TABLE crm_deals
        ADD CONSTRAINT crm_deals_lost_consistency
        CHECK ((stage = 'lost' AND lost_at IS NOT NULL) OR stage <> 'lost');
    `);

    await q.query(`
      CREATE INDEX idx_crm_deals_tenant_stage
        ON crm_deals(tenant_id, stage) WHERE deleted_at IS NULL;
    `);
    await q.query(`
      CREATE INDEX idx_crm_deals_owner
        ON crm_deals(tenant_id, owner_user_id) WHERE deleted_at IS NULL;
    `);
    await q.query(`
      CREATE INDEX idx_crm_deals_close_date
        ON crm_deals(tenant_id, expected_close_date)
        WHERE deleted_at IS NULL
          AND stage NOT IN ('won', 'lost');
    `);
    await q.query(`
      CREATE INDEX idx_crm_deals_title_trgm
        ON crm_deals USING GIN (title gin_trgm_ops)
        WHERE deleted_at IS NULL;
    `);
  }
}
