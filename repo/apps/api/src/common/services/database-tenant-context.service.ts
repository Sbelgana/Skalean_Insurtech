/**
 * Service helper : applique SET LOCAL via Postgres set_config() (3-arg, local=true).
 *
 * IMPORTANT : utilise set_config(name, value, true) au lieu d'interpolation SQL
 *   - $1, $2 parametres binds -> immunite SQL injection
 *   - troisieme arg `true` = local-to-transaction (equivalent SET LOCAL)
 *   - reset automatique au COMMIT/ROLLBACK (zero residuel pool de connections)
 *
 * Variables Postgres exposees aux RLS policies Sprint 2 :
 *   - app.current_tenant_id   : UUID tenant scoping
 *   - app.is_super_admin      : 'true' -> RLS bypass via policy USING (... OR app_is_super_admin())
 *   - app.current_user_id     : UUID user pour audit row-level
 *   - app.assure_user_id      : UUID assure pour filtre L3 additionnel
 *   - app.cross_tenant_authorization_id : Sprint 26 framework prep
 *
 * Reference : Sprint 6 / Tache 2.2.4.
 */

import { Injectable, Logger } from '@nestjs/common';
import type { TenantContext } from '@insurtech/auth';

/**
 * Structural type pour EntityManager (eviter typeorm dep dans apps/api).
 * Compatible avec EntityManager TypeORM ainsi qu'avec mocks de test.
 */
export interface QueryableEntityManager {
  query(sql: string, parameters?: unknown[]): Promise<unknown>;
}

@Injectable()
export class DatabaseTenantContextService {
  private readonly logger = new Logger(DatabaseTenantContextService.name);

  /**
   * Applique SET LOCAL (via set_config local=true) pour les variables de session
   * Postgres correspondantes au contexte tenant.
   *
   * Discipline :
   *   - sequentiel (meme connection ne supporte pas parallel queries)
   *   - silent skip pour variables undefined (helpers Postgres retourneront NULL via current_setting)
   *   - super_admin context : seuls is_super_admin + user_id sont set, pas tenant_id
   */
  async applySetLocal(em: QueryableEntityManager, ctx: TenantContext): Promise<void> {
    if (ctx.tenantId) {
      await em.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [ctx.tenantId]);
    }

    if (ctx.isSuperAdmin) {
      await em.query(`SELECT set_config('app.is_super_admin', 'true', true)`);
    }

    if (ctx.userId) {
      await em.query(`SELECT set_config('app.current_user_id', $1, true)`, [ctx.userId]);
    }

    if (ctx.assureUserId) {
      await em.query(`SELECT set_config('app.assure_user_id', $1, true)`, [ctx.assureUserId]);
    }

    if (ctx.crossTenantAuthorizationId) {
      await em.query(`SELECT set_config('app.cross_tenant_authorization_id', $1, true)`, [
        ctx.crossTenantAuthorizationId,
      ]);
    }

    this.logger.debug(
      `tenant_set_local_applied tenant=${ctx.tenantId ?? '-'} super_admin=${ctx.isSuperAdmin} user=${ctx.userId ?? '-'} assure=${ctx.assureUserId ?? '-'}`,
    );
  }
}
