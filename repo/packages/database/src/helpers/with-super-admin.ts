import type { DataSource, EntityManager } from 'typeorm';
import { logger } from '@insurtech/shared-utils';

/**
 * withSuperAdmin -- Skalean InsurTech.
 *
 * Helper transactionnel pour operations super admin globales uniquement :
 *   - Registry tenants (auth_tenants)
 *   - Tables systemes globales (currencies, regions Maroc)
 *   - Data migrations inter-tenants (rare, audite)
 *   - Jobs cron systeme (purge, archivage, retention)
 *
 * JAMAIS utiliser depuis un endpoint tenant courtier ou assure final.
 * Toute utilisation est loggee au niveau warn pour audit trail.
 *
 * Conformite : loi 09-08 CNDP article 23, decision-002, decision-003.
 */
export async function withSuperAdmin<T>(
  dataSource: DataSource,
  callback: (manager: EntityManager) => Promise<T>,
): Promise<T> {
  if (!dataSource.isInitialized) {
    throw new Error(
      'withSuperAdmin: DataSource not initialized. Call dataSource.initialize() first.',
    );
  }

  logger.warn(
    { helper: 'withSuperAdmin' },
    'withSuperAdmin: super admin transaction opening, RLS bypass active',
  );

  return dataSource.transaction(async (manager: EntityManager): Promise<T> => {
    await manager.query(`SELECT set_config('app.is_super_admin', 'true', true)`);
    await manager.query(`SELECT set_config('app.current_tenant_id', NULL, true)`);
    await manager.query(`SELECT set_config('app.current_user_id', NULL, true)`);
    await manager.query(`SELECT set_config('app.assure_user_id', NULL, true)`);

    return callback(manager);
  });
}
