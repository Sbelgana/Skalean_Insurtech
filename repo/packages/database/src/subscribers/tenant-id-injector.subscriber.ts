import {
  type EntitySubscriberInterface,
  EventSubscriber,
  type InsertEvent,
  type QueryRunner,
  type UpdateEvent,
} from 'typeorm';
import { logger } from '@insurtech/shared-utils';
import { BaseEntity } from '../entities/base/base-entity.js';
import { MissingTenantContextError } from '../errors/missing-tenant-context.error.js';
import { ImmutableTenantIdError } from '../errors/immutable-tenant-id.error.js';
import { InvalidTenantContextError } from '../errors/invalid-tenant-context.error.js';
import {
  TENANT_INJECTION_EXEMPTED_TABLES,
  UUID_V4_REGEX,
} from '../audit/audit-log-format.js';
import { isBatchMode, isSuperAdmin, getUserId } from '../context/tenant-context.js';

const tenantIdCache = new WeakMap<QueryRunner, string | null>();

@EventSubscriber()
export class TenantIdInjectorSubscriber implements EntitySubscriberInterface<BaseEntity> {
  listenTo(): typeof BaseEntity {
    return BaseEntity;
  }

  async beforeInsert(event: InsertEvent<BaseEntity>): Promise<void> {
    if (isBatchMode()) return;

    const tableName = event.metadata.tableName;
    if (TENANT_INJECTION_EXEMPTED_TABLES.includes(tableName)) return;
    if (!event.entity) return;

    const currentValue = (event.entity as BaseEntity).tenantId;
    if (currentValue && UUID_V4_REGEX.test(currentValue)) return;

    const tenantId = await this.resolveTenantId(event.queryRunner);

    if (!tenantId) {
      if (isSuperAdmin()) {
        logger.warn(
          { tableName, userId: getUserId() },
          'TenantIdInjector: super admin INSERT without tenant context, allowed but flagged',
        );
        return;
      }
      throw new MissingTenantContextError(tableName, getUserId(), 'INSERT');
    }

    if (!UUID_V4_REGEX.test(tenantId)) {
      throw new InvalidTenantContextError(tenantId);
    }

    (event.entity as BaseEntity).tenantId = tenantId;
  }

  async beforeUpdate(event: UpdateEvent<BaseEntity>): Promise<void> {
    if (isBatchMode()) return;

    const tableName = event.metadata.tableName;
    if (TENANT_INJECTION_EXEMPTED_TABLES.includes(tableName)) return;
    if (!event.entity || !event.databaseEntity) return;

    const oldValue = (event.databaseEntity as BaseEntity).tenantId;
    const newValue = (event.entity as BaseEntity).tenantId;

    if (oldValue && newValue && oldValue !== newValue) {
      if (isSuperAdmin()) {
        logger.warn(
          { tableName, entityId: (event.databaseEntity as BaseEntity).id, oldValue, newValue },
          'TenantIdInjector: super admin tenant_id change allowed but flagged',
        );
        return;
      }
      throw new ImmutableTenantIdError(
        tableName,
        (event.databaseEntity as BaseEntity).id,
        oldValue,
        newValue,
      );
    }
  }

  private async resolveTenantId(queryRunner: QueryRunner): Promise<string | null> {
    if (tenantIdCache.has(queryRunner)) {
      return tenantIdCache.get(queryRunner) ?? null;
    }
    const result: Array<{ tid: string | null }> = await queryRunner.query(
      'SELECT app_current_tenant() AS tid',
    );
    const tid = result?.[0]?.tid ?? null;
    tenantIdCache.set(queryRunner, tid);
    return tid;
  }

  afterTransactionCommit(event: { queryRunner: QueryRunner }): void {
    tenantIdCache.delete(event.queryRunner);
  }

  afterTransactionRollback(event: { queryRunner: QueryRunner }): void {
    tenantIdCache.delete(event.queryRunner);
  }
}
