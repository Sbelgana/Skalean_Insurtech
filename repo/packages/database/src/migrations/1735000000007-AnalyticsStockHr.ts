import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AnalyticsStockHr1735000000007 implements MigrationInterface {
  name = 'AnalyticsStockHr1735000000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // =========================================================
    // 1. ENUMs
    // =========================================================
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE stock_unit_enum AS ENUM ('unit', 'liter', 'kg', 'meter');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE stock_movement_type_enum AS ENUM ('in', 'out', 'adjustment', 'inventory');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE hr_role_enum AS ENUM (
          'mecanicien', 'tolier', 'peintre', 'chef_atelier',
          'expert', 'comptable', 'commercial', 'admin'
        );
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    // =========================================================
    // 2. analytics_events (append-only, partition-ready)
    // =========================================================
    await queryRunner.query(`
      CREATE TABLE analytics_events (
        id           uuid        NOT NULL DEFAULT gen_random_uuid(),
        tenant_id    uuid        NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
        event_name   text        NOT NULL CHECK (length(event_name) BETWEEN 1 AND 128),
        user_id      uuid        REFERENCES auth_users(id) ON DELETE SET NULL,
        session_id   text        CHECK (session_id IS NULL OR length(session_id) BETWEEN 1 AND 128),
        properties   jsonb       NOT NULL DEFAULT '{}'::jsonb,
        occurred_at  timestamptz NOT NULL DEFAULT now(),
        created_at   timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (occurred_at, id)
      );
    `);
    await queryRunner.query(`
      CREATE INDEX idx_analytics_events_tenant_occurred
        ON analytics_events (tenant_id, occurred_at DESC);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_analytics_events_event_name
        ON analytics_events (tenant_id, event_name, occurred_at DESC);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_analytics_events_user
        ON analytics_events (tenant_id, user_id, occurred_at DESC)
        WHERE user_id IS NOT NULL;
    `);
    await queryRunner.query(`
      CREATE INDEX idx_analytics_events_session
        ON analytics_events (tenant_id, session_id, occurred_at DESC)
        WHERE session_id IS NOT NULL;
    `);
    await queryRunner.query(`
      CREATE INDEX idx_analytics_events_properties_gin
        ON analytics_events USING GIN (properties jsonb_path_ops);
    `);
    await queryRunner.query(`ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE analytics_events FORCE ROW LEVEL SECURITY;`);
    await queryRunner.query(`
      CREATE POLICY analytics_events_select ON analytics_events
        FOR SELECT USING (app_can_access_tenant(tenant_id));
    `);
    await queryRunner.query(`
      CREATE POLICY analytics_events_insert ON analytics_events
        FOR INSERT WITH CHECK (app_can_access_tenant(tenant_id));
    `);
    await queryRunner.query(`
      CREATE POLICY analytics_events_update ON analytics_events
        FOR UPDATE USING (false);
    `);
    await queryRunner.query(`
      CREATE POLICY analytics_events_delete ON analytics_events
        FOR DELETE USING (
          app_can_access_tenant(tenant_id)
          AND occurred_at < (now() - interval '1095 days')
        );
    `);

    // =========================================================
    // 3. stock_items
    // =========================================================
    await queryRunner.query(`
      CREATE TABLE stock_items (
        id                uuid              NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        tenant_id         uuid              NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
        sku               text              NOT NULL CHECK (length(sku) BETWEEN 1 AND 64),
        name              text              NOT NULL CHECK (length(name) BETWEEN 1 AND 256),
        description       text              CHECK (description IS NULL OR length(description) <= 4096),
        category          text              CHECK (category IS NULL OR length(category) <= 128),
        unit              stock_unit_enum   NOT NULL DEFAULT 'unit',
        unit_price_ht     numeric(15,2)     NOT NULL DEFAULT 0 CHECK (unit_price_ht >= 0),
        tva_rate          numeric(5,2)      NOT NULL DEFAULT 20.00 CHECK (tva_rate >= 0 AND tva_rate <= 100),
        current_quantity  numeric(15,3)     NOT NULL DEFAULT 0,
        min_threshold     numeric(15,3)     NOT NULL DEFAULT 0 CHECK (min_threshold >= 0),
        supplier_name     text              CHECK (supplier_name IS NULL OR length(supplier_name) <= 256),
        created_at        timestamptz       NOT NULL DEFAULT now(),
        updated_at        timestamptz       NOT NULL DEFAULT now(),
        CONSTRAINT uq_stock_items_tenant_sku UNIQUE (tenant_id, sku)
      );
    `);
    await queryRunner.query(`
      CREATE INDEX idx_stock_items_tenant_low
        ON stock_items (tenant_id, current_quantity, min_threshold)
        WHERE current_quantity <= min_threshold;
    `);
    await queryRunner.query(`
      CREATE INDEX idx_stock_items_tenant_category
        ON stock_items (tenant_id, category)
        WHERE category IS NOT NULL;
    `);
    await queryRunner.query(`
      CREATE TRIGGER trg_stock_items_updated_at
        BEFORE UPDATE ON stock_items
        FOR EACH ROW EXECUTE FUNCTION set_updated_at_column();
    `);
    await queryRunner.query(`ALTER TABLE stock_items ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE stock_items FORCE ROW LEVEL SECURITY;`);
    await queryRunner.query(`
      CREATE POLICY stock_items_select ON stock_items
        FOR SELECT USING (app_can_access_tenant(tenant_id));
    `);
    await queryRunner.query(`
      CREATE POLICY stock_items_insert ON stock_items
        FOR INSERT WITH CHECK (app_can_access_tenant(tenant_id));
    `);
    await queryRunner.query(`
      CREATE POLICY stock_items_update ON stock_items
        FOR UPDATE USING (app_can_access_tenant(tenant_id))
        WITH CHECK (app_can_access_tenant(tenant_id));
    `);
    await queryRunner.query(`
      CREATE POLICY stock_items_delete ON stock_items
        FOR DELETE USING (app_can_access_tenant(tenant_id));
    `);

    // =========================================================
    // 4. stock_movements (append-only)
    // =========================================================
    await queryRunner.query(`
      CREATE TABLE stock_movements (
        id                     uuid                     NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        tenant_id              uuid                     NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
        item_id                uuid                     NOT NULL REFERENCES stock_items(id) ON DELETE RESTRICT,
        movement_type          stock_movement_type_enum NOT NULL,
        quantity               numeric(15,3)            NOT NULL CHECK (quantity > 0),
        unit_price_ht_at_time  numeric(15,2)            NOT NULL CHECK (unit_price_ht_at_time >= 0),
        related_resource_type  text                     CHECK (related_resource_type IS NULL OR length(related_resource_type) <= 64),
        related_resource_id    uuid,
        reason                 text                     CHECK (reason IS NULL OR length(reason) <= 1024),
        created_by             uuid                     REFERENCES auth_users(id) ON DELETE SET NULL,
        created_at             timestamptz              NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`
      CREATE INDEX idx_stock_movements_tenant_item_created
        ON stock_movements (tenant_id, item_id, created_at DESC);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_stock_movements_tenant_type
        ON stock_movements (tenant_id, movement_type, created_at DESC);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_stock_movements_related
        ON stock_movements (tenant_id, related_resource_type, related_resource_id)
        WHERE related_resource_id IS NOT NULL;
    `);
    await queryRunner.query(`ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE stock_movements FORCE ROW LEVEL SECURITY;`);
    await queryRunner.query(`
      CREATE POLICY stock_movements_select ON stock_movements
        FOR SELECT USING (app_can_access_tenant(tenant_id));
    `);
    await queryRunner.query(`
      CREATE POLICY stock_movements_insert ON stock_movements
        FOR INSERT WITH CHECK (app_can_access_tenant(tenant_id));
    `);
    await queryRunner.query(`
      CREATE POLICY stock_movements_update ON stock_movements
        FOR UPDATE USING (false);
    `);
    await queryRunner.query(`
      CREATE POLICY stock_movements_delete ON stock_movements
        FOR DELETE USING (false);
    `);

    // =========================================================
    // 5. hr_employees
    // =========================================================
    await queryRunner.query(`
      CREATE TABLE hr_employees (
        id                     uuid          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        tenant_id              uuid          NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
        user_id                uuid          REFERENCES auth_users(id) ON DELETE SET NULL,
        full_name              text          NOT NULL CHECK (length(full_name) BETWEEN 1 AND 256),
        role                   hr_role_enum  NOT NULL,
        employee_number        text          NOT NULL CHECK (length(employee_number) BETWEEN 1 AND 32),
        hire_date              date          NOT NULL,
        hourly_rate_dirham     numeric(15,2) CHECK (hourly_rate_dirham IS NULL OR hourly_rate_dirham >= 0),
        monthly_salary_dirham  numeric(15,2) CHECK (monthly_salary_dirham IS NULL OR monthly_salary_dirham >= 0),
        social_security_number text          CHECK (social_security_number IS NULL OR social_security_number ~ '^[0-9]{8,9}$'),
        active                 boolean       NOT NULL DEFAULT true,
        created_at             timestamptz   NOT NULL DEFAULT now(),
        updated_at             timestamptz   NOT NULL DEFAULT now(),
        CONSTRAINT uq_hr_employees_tenant_number UNIQUE (tenant_id, employee_number),
        CONSTRAINT chk_hr_employees_compensation CHECK (
          hourly_rate_dirham IS NOT NULL OR monthly_salary_dirham IS NOT NULL
        )
      );
    `);
    await queryRunner.query(`
      CREATE INDEX idx_hr_employees_tenant_active
        ON hr_employees (tenant_id, active);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_hr_employees_tenant_role
        ON hr_employees (tenant_id, role)
        WHERE active = true;
    `);
    await queryRunner.query(`
      CREATE INDEX idx_hr_employees_user
        ON hr_employees (user_id)
        WHERE user_id IS NOT NULL;
    `);
    await queryRunner.query(`
      CREATE TRIGGER trg_hr_employees_updated_at
        BEFORE UPDATE ON hr_employees
        FOR EACH ROW EXECUTE FUNCTION set_updated_at_column();
    `);
    await queryRunner.query(`ALTER TABLE hr_employees ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE hr_employees FORCE ROW LEVEL SECURITY;`);
    await queryRunner.query(`
      CREATE POLICY hr_employees_select ON hr_employees
        FOR SELECT USING (app_can_access_tenant(tenant_id));
    `);
    await queryRunner.query(`
      CREATE POLICY hr_employees_insert ON hr_employees
        FOR INSERT WITH CHECK (app_can_access_tenant(tenant_id));
    `);
    await queryRunner.query(`
      CREATE POLICY hr_employees_update ON hr_employees
        FOR UPDATE USING (app_can_access_tenant(tenant_id))
        WITH CHECK (app_can_access_tenant(tenant_id));
    `);
    await queryRunner.query(`
      CREATE POLICY hr_employees_delete ON hr_employees
        FOR DELETE USING (app_can_access_tenant(tenant_id));
    `);

    // =========================================================
    // 6. hr_attendance (append-only except checkout)
    // =========================================================
    await queryRunner.query(`
      CREATE TABLE hr_attendance (
        id            uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        tenant_id     uuid        NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
        employee_id   uuid        NOT NULL REFERENCES hr_employees(id) ON DELETE RESTRICT,
        check_in_at   timestamptz NOT NULL,
        check_out_at  timestamptz,
        break_minutes integer     NOT NULL DEFAULT 0 CHECK (break_minutes >= 0 AND break_minutes <= 720),
        notes         text        CHECK (notes IS NULL OR length(notes) <= 2048),
        created_at    timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT chk_hr_attendance_checkout_after CHECK (
          check_out_at IS NULL OR check_out_at >= check_in_at
        )
      );
    `);
    await queryRunner.query(`
      CREATE INDEX idx_hr_attendance_tenant_employee_checkin
        ON hr_attendance (tenant_id, employee_id, check_in_at DESC);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_hr_attendance_open
        ON hr_attendance (tenant_id, employee_id)
        WHERE check_out_at IS NULL;
    `);
    await queryRunner.query(`ALTER TABLE hr_attendance ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE hr_attendance FORCE ROW LEVEL SECURITY;`);
    await queryRunner.query(`
      CREATE POLICY hr_attendance_select ON hr_attendance
        FOR SELECT USING (app_can_access_tenant(tenant_id));
    `);
    await queryRunner.query(`
      CREATE POLICY hr_attendance_insert ON hr_attendance
        FOR INSERT WITH CHECK (app_can_access_tenant(tenant_id));
    `);
    await queryRunner.query(`
      CREATE POLICY hr_attendance_update ON hr_attendance
        FOR UPDATE USING (
          app_can_access_tenant(tenant_id)
          AND check_out_at IS NULL
        ) WITH CHECK (app_can_access_tenant(tenant_id));
    `);
    await queryRunner.query(`
      CREATE POLICY hr_attendance_delete ON hr_attendance
        FOR DELETE USING (false);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS hr_attendance CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS hr_employees CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS stock_movements CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS stock_items CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS analytics_events CASCADE;`);
    await queryRunner.query(`DROP TYPE IF EXISTS hr_role_enum;`);
    await queryRunner.query(`DROP TYPE IF EXISTS stock_movement_type_enum;`);
    await queryRunner.query(`DROP TYPE IF EXISTS stock_unit_enum;`);
  }
}
