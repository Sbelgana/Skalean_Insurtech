import 'reflect-metadata';
import { DataSource, type DataSourceOptions, type QueryRunner } from 'typeorm';
import { systemEntities } from '../../entities/system/index.js';
import { crmEntities } from '../../entities/crm/index.js';
import { bookingEntities } from '../../entities/booking/index.js';
import { commEntities } from '../../entities/comm/index.js';
import { docsEntities } from '../../entities/docs/index.js';
import { payEntities } from '../../entities/pay/index.js';
import { booksEntities } from '../../entities/books/index.js';
import { complianceEntities } from '../../entities/compliance/index.js';
import { analyticsEntities } from '../../entities/analytics/index.js';
import { stockEntities } from '../../entities/stock/index.js';
import { hrEntities } from '../../entities/hr/index.js';
import { insureEntities } from '../../entities/insure/index.js';
import { InitialSystem1735000000001 } from '../../migrations/1735000000001-InitialSystem.js';
import { CRM1735000000002 } from '../../migrations/1735000000002-CRM.js';
import { Booking1735000000003 } from '../../migrations/1735000000003-Booking.js';
import { Communications1735000000004 } from '../../migrations/1735000000004-Communications.js';
import { DocsPayments1735000000005 } from '../../migrations/1735000000005-DocsPayments.js';
import { BooksCompliance1735000000006 } from '../../migrations/1735000000006-BooksCompliance.js';
import { AnalyticsStockHr1735000000007 } from '../../migrations/1735000000007-AnalyticsStockHr.js';
import { CreateCrmPipelinesStages1735000000016 } from '../../migrations/1735000000016-CreateCrmPipelinesStages.js';
import { ReshapeCrmDealsWorkflow1735000000017 } from '../../migrations/1735000000017-ReshapeCrmDealsWorkflow.js';
import { ReshapeCrmInteractionsPolymorphic1735000000018 } from '../../migrations/1735000000018-ReshapeCrmInteractionsPolymorphic.js';
import { AddTrigramIndexesCrm1735000000019 } from '../../migrations/1735000000019-AddTrigramIndexesCrm.js';
import { AddCustomFieldsDefinitions1735000000020 } from '../../migrations/1735000000020-AddCustomFieldsDefinitions.js';
import { ExtendBookingRoomsMetadata1735000000021 } from '../../migrations/1735000000021-ExtendBookingRoomsMetadata.js';
import { ExtendBookingAppointmentsAddEnum1735000000022 } from '../../migrations/1735000000022-ExtendBookingAppointments.js';
import { ReshapeBookingAppointments1735000000023 } from '../../migrations/1735000000023-ReshapeBookingAppointments.js';

export interface TestDataSourceOptions {
  migrationsRun?: boolean;
}

const baseOptions = (): DataSourceOptions => ({
  type: 'postgres',
  host: process.env['TEST_DATABASE_HOST'] ?? process.env['DATABASE_HOST'] ?? 'localhost',
  port: Number(process.env['TEST_DATABASE_PORT'] ?? process.env['DATABASE_PORT'] ?? 5432),
  username: process.env['TEST_DATABASE_USER'] ?? process.env['DATABASE_USER'] ?? 'skalean',
  password: process.env['TEST_DATABASE_PASSWORD'] ?? process.env['DATABASE_PASSWORD'] ?? 'skalean_dev_only',
  database: process.env['TEST_DATABASE_NAME'] ?? process.env['DATABASE_NAME'] ?? 'skalean_insurtech',
  entities: [...systemEntities, ...crmEntities, ...bookingEntities, ...commEntities, ...docsEntities, ...payEntities, ...booksEntities, ...complianceEntities, ...analyticsEntities, ...stockEntities, ...hrEntities, ...insureEntities],
  migrations: [InitialSystem1735000000001, CRM1735000000002, Booking1735000000003, Communications1735000000004, DocsPayments1735000000005, BooksCompliance1735000000006, AnalyticsStockHr1735000000007, CreateCrmPipelinesStages1735000000016, ReshapeCrmDealsWorkflow1735000000017, ReshapeCrmInteractionsPolymorphic1735000000018, AddTrigramIndexesCrm1735000000019, AddCustomFieldsDefinitions1735000000020, ExtendBookingRoomsMetadata1735000000021, ExtendBookingAppointmentsAddEnum1735000000022, ReshapeBookingAppointments1735000000023],
  migrationsRun: false,
  synchronize: false,
  logging: process.env['TEST_DATABASE_LOG'] === 'true',
  extra: {
    statement_timeout: 30000,
    application_name: 'skalean-database-test',
  },
});

export async function createTestDataSource(opts: TestDataSourceOptions = {}): Promise<DataSource> {
  const ds = new DataSource(baseOptions());
  await ds.initialize();

  if (opts.migrationsRun) {
    await ds.runMigrations();
  }

  return ds;
}

export async function dropAllTables(ds: DataSource): Promise<void> {
  await ds.query(`
    DO $$
    DECLARE r record;
    BEGIN
      FOR r IN (
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
          AND tablename NOT IN ('typeorm_migrations')
      ) LOOP
        EXECUTE format('DROP TABLE IF EXISTS %I CASCADE;', r.tablename);
      END LOOP;
      FOR r IN (
        SELECT typname FROM pg_type
        WHERE typcategory = 'E'
          AND typnamespace = 'public'::regnamespace
      ) LOOP
        EXECUTE format('DROP TYPE IF EXISTS %I CASCADE;', r.typname);
      END LOOP;
    END$$;
  `);
  await ds.query(`DELETE FROM typeorm_migrations WHERE 1 = 1;`).catch(() => undefined);
}

export async function withRlsContext<T>(
  ds: DataSource,
  tenantId: string | null,
  isSuperAdmin: boolean,
  fn: (qr: QueryRunner) => Promise<T>,
): Promise<T> {
  const qr = ds.createQueryRunner();
  try {
    await qr.query(`SELECT set_config('app.current_tenant_id', $1, true);`, [tenantId ?? '']);
    await qr.query(`SELECT set_config('app.is_super_admin', $1, true);`, [String(isSuperAdmin)]);
    return await fn(qr);
  } finally {
    await qr.release();
  }
}
