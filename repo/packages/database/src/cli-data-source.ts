import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * cli-data-source -- Skalean InsurTech.
 *
 * DataSource dediee aux commandes CLI TypeORM (migration:create,
 * migration:generate, migration:run, migration:revert, migration:show).
 *
 * Difference avec data-source.ts (runtime) :
 *   - Charge entites depuis src/**\/*.entity.ts (TypeScript source, CLI tsx).
 *   - Charge migrations depuis src/migrations/*.ts.
 *   - data-source.ts runtime charge depuis dist/*.js pour production.
 *
 * Conformite : decision-008 data residency Atlas Cloud Services Benguerir.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));

function requireEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`cli-data-source: environment variable ${name} is required`);
  }
  return value;
}

const DATABASE_URL = process.env['DATABASE_URL'] ??
  `postgresql://${process.env['DATABASE_USER'] ?? 'skalean'}:${process.env['DATABASE_PASSWORD'] ?? 'skalean_dev_only'}@${process.env['DATABASE_HOST'] ?? 'localhost'}:${process.env['DATABASE_PORT'] ?? '5432'}/${process.env['DATABASE_NAME'] ?? 'skalean_insurtech'}`;

if (!DATABASE_URL) {
  requireEnvVar('DATABASE_URL');
}

// TypeORM CLI requires exactly ONE DataSource export. Default-only (Sprint 6 pause #4 fix).
export default new DataSource({
  type: 'postgres',
  url: DATABASE_URL,
  synchronize: false,
  logging: process.env['DATABASE_LOG_QUERIES'] === 'true',
  entities: [
    // *.entity.ts only -- exclude *.spec.ts (vitest imports). Pause #4 fix.
    // base/{base-entity,auditable-entity}.ts sont abstract et referencees par extends.
    resolve(__dirname, 'entities/**/*.entity.ts'),
  ],
  migrations: [resolve(__dirname, 'migrations/*.ts')],
  subscribers: [resolve(__dirname, 'subscribers/*.ts')],
  migrationsTableName: 'typeorm_migrations',
  migrationsRun: false,
});
