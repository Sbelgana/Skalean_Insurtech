import type { DataSource, EntityManager } from 'typeorm';
import { logger } from '@insurtech/shared-utils';
import type { TenantContext } from '../types/tenant-context.js';

/**
 * withTenantContext -- Skalean InsurTech.
 *
 * Helper transactionnel critique multi-tenant. Toute operation DB metier DOIT
 * passer par ce helper. Ouvre une transaction, execute 4 SET LOCAL Postgres
 * (current_tenant_id, is_super_admin, current_user_id, assure_user_id), puis
 * appelle le callback avec l'EntityManager scope.
 *
 * SET LOCAL est transaction-scoped -- les variables sont auto-revoquees en fin
 * de transaction. Hors transaction, SET LOCAL est un no-op silencieux (faille).
 *
 * Validation defensive :
 *   - tenantId null + isSuperAdmin false -> throw (fuite isolation impossible).
 *   - tenantId non null + isSuperAdmin true -> warn (support technique seulement).
 *
 * Conformite : loi 09-08 CNDP article 23, decision-002 RLS Postgres strict,
 * decision-003 multi-tenant 3 niveaux.
 */
export async function withTenantContext<T>(
  dataSource: DataSource,
  ctx: TenantContext,
  callback: (manager: EntityManager) => Promise<T>,
): Promise<T> {
  if (!dataSource.isInitialized) {
    throw new Error(
      'withTenantContext: DataSource not initialized. Call dataSource.initialize() first.',
    );
  }

  if (ctx.tenantId === null && !ctx.isSuperAdmin) {
    throw new Error(
      'withTenantContext: tenantId is null and isSuperAdmin is false. ' +
        'A non-super-admin operation requires a non-null tenantId.',
    );
  }

  if (ctx.tenantId !== null && ctx.isSuperAdmin) {
    logger.warn(
      {
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        isSuperAdmin: ctx.isSuperAdmin,
      },
      'withTenantContext: super admin acting on specific tenant (support scenario)',
    );
  }

  return dataSource.transaction(async (manager: EntityManager): Promise<T> => {
    const tenantParam = ctx.tenantId ?? null;
    const userParam = ctx.userId ?? null;
    const assureParam = ctx.assureUserId ?? null;
    const superAdminParam = ctx.isSuperAdmin ? 'true' : 'false';

    await manager.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenantParam]);
    await manager.query(`SELECT set_config('app.is_super_admin', $1, true)`, [superAdminParam]);
    await manager.query(`SELECT set_config('app.current_user_id', $1, true)`, [userParam]);
    await manager.query(`SELECT set_config('app.assure_user_id', $1, true)`, [assureParam]);

    logger.debug(
      {
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        assureUserId: ctx.assureUserId,
        isSuperAdmin: ctx.isSuperAdmin,
      },
      'withTenantContext: session variables set',
    );

    return callback(manager);
  });
}
