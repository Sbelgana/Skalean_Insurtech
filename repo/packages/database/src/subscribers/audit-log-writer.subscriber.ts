import {
  type EntitySubscriberInterface,
  EventSubscriber,
  type InsertEvent,
  type RemoveEvent,
  type SoftRemoveEvent,
  type UpdateEvent,
  type EntityMetadata,
  type ObjectLiteral,
} from 'typeorm';
import { logger } from '@insurtech/shared-utils';
import {
  AUDITABLE_TABLES,
  AUDIT_LOG_REDACTED_FIELDS,
  AUDIT_LOG_SCHEMA_VERSION,
  type AuditLogChanges,
} from '../audit/audit-log-format.js';
import {
  getUserId,
  getRequestIp,
  getCorrelationId,
  isBatchMode,
} from '../context/tenant-context.js';

const AUDIT_LOG_TABLE_NAME = 'audit_log';
const MAX_DIFF_SIZE_BYTES = parseInt(process.env['AUDIT_LOG_MAX_DIFF_SIZE_BYTES'] ?? '10240', 10);
const TRUNCATE_LARGE = process.env['AUDIT_LOG_TRUNCATE_LARGE'] !== 'false';

type AuditAction = 'INSERT' | 'UPDATE' | 'DELETE' | 'SOFT_DELETE';

@EventSubscriber()
export class AuditLogWriterSubscriber implements EntitySubscriberInterface {
  async afterInsert(event: InsertEvent<ObjectLiteral>): Promise<void> {
    if (this.shouldSkip(event.metadata)) return;
    if (!event.entity) return;
    const changes = this.buildChanges(null, event.entity);
    await this.writeAuditRow(event, 'INSERT', changes);
  }

  async afterUpdate(event: UpdateEvent<ObjectLiteral>): Promise<void> {
    if (this.shouldSkip(event.metadata)) return;
    if (!event.entity || !event.databaseEntity) return;
    const changes = this.buildChanges(event.databaseEntity, event.entity);
    if (changes.fieldsChanged.length === 0) return;
    await this.writeAuditRow(event, 'UPDATE', changes);
  }

  async afterRemove(event: RemoveEvent<ObjectLiteral>): Promise<void> {
    if (this.shouldSkip(event.metadata)) return;
    if (!event.databaseEntity) return;
    const changes = this.buildChanges(event.databaseEntity, null);
    await this.writeAuditRow(event, 'DELETE', changes);
  }

  async afterSoftRemove(event: SoftRemoveEvent<ObjectLiteral>): Promise<void> {
    if (this.shouldSkip(event.metadata)) return;
    if (!event.databaseEntity) return;
    const changes = this.buildChanges(event.databaseEntity, event.entity ?? null);
    await this.writeAuditRow(event, 'SOFT_DELETE', changes);
  }

  private shouldSkip(metadata: EntityMetadata | undefined): boolean {
    if (!metadata) return true;
    const table = metadata.tableName;
    if (table === AUDIT_LOG_TABLE_NAME) return true;
    if (isBatchMode()) return true;
    if (!AUDITABLE_TABLES.includes(table)) return true;
    return false;
  }

  private buildChanges(before: unknown, after: unknown): AuditLogChanges {
    const beforeRedacted = this.redact(before);
    const afterRedacted = this.redact(after);
    const fieldsChanged = this.computeFieldsChanged(beforeRedacted, afterRedacted);

    let changes: AuditLogChanges = {
      schemaVersion: AUDIT_LOG_SCHEMA_VERSION,
      before: beforeRedacted as Record<string, unknown> | null,
      after: afterRedacted as Record<string, unknown> | null,
      fieldsChanged,
      redactedFields: this.detectRedacted(before, after),
    };

    const serialized = JSON.stringify(changes);
    if (serialized.length > MAX_DIFF_SIZE_BYTES && TRUNCATE_LARGE) {
      changes = {
        schemaVersion: AUDIT_LOG_SCHEMA_VERSION,
        before: null,
        after: null,
        fieldsChanged,
        truncated: true,
        truncatedReason: 'SIZE_EXCEEDED',
        truncatedOriginalSize: serialized.length,
        redactedFields: changes.redactedFields ?? [],
      };
    }

    return changes;
  }

  private computeFieldsChanged(before: unknown, after: unknown): string[] {
    const fields = new Set<string>();
    const beforeObj = (before ?? {}) as Record<string, unknown>;
    const afterObj = (after ?? {}) as Record<string, unknown>;
    for (const key of Object.keys(beforeObj)) {
      if (!this.deepEqual(beforeObj[key], afterObj[key])) fields.add(key);
    }
    for (const key of Object.keys(afterObj)) {
      if (!(key in beforeObj)) fields.add(key);
    }
    return Array.from(fields).sort();
  }

  private deepEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (a === null || b === null) return false;
    if (typeof a !== typeof b) return false;
    if (typeof a === 'object') {
      try {
        return JSON.stringify(a) === JSON.stringify(b);
      } catch {
        return false;
      }
    }
    return false;
  }

  private redact(entity: unknown): unknown {
    if (!entity || typeof entity !== 'object') return entity;
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(entity as Record<string, unknown>)) {
      out[key] = AUDIT_LOG_REDACTED_FIELDS.includes(key) ? '[REDACTED]' : value;
    }
    return out;
  }

  private detectRedacted(before: unknown, after: unknown): string[] {
    const found = new Set<string>();
    for (const obj of [before, after]) {
      if (obj && typeof obj === 'object') {
        for (const k of Object.keys(obj as Record<string, unknown>)) {
          if (AUDIT_LOG_REDACTED_FIELDS.includes(k)) found.add(k);
        }
      }
    }
    return Array.from(found).sort();
  }

  private async writeAuditRow(
    event: InsertEvent<ObjectLiteral> | UpdateEvent<ObjectLiteral> | RemoveEvent<ObjectLiteral> | SoftRemoveEvent<ObjectLiteral>,
    action: AuditAction,
    changes: AuditLogChanges,
  ): Promise<void> {
    try {
      if (!event.queryRunner) {
        logger.error(
          { tableName: event.metadata.tableName, action },
          'AuditLogWriter: queryRunner missing, cannot write audit_log',
        );
        return;
      }

      const tableName = event.metadata.tableName;
      const entityId = this.extractEntityId(event);
      const userId = getUserId();
      const ipAddress = getRequestIp();
      const correlationId = getCorrelationId();

      await event.queryRunner.query(
        `INSERT INTO audit_log
          (id, action, resource_type, resource_id, user_id, ip_address, user_agent, changes, created_at)
         VALUES
          (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, now())`,
        [action, tableName, entityId, userId, ipAddress, correlationId, JSON.stringify(changes)],
      );
    } catch (error) {
      logger.error(
        { err: error, tableName: event.metadata.tableName, action },
        'AuditLogWriter: failed to write audit_log row',
      );
    }
  }

  private extractEntityId(event: InsertEvent<ObjectLiteral> | UpdateEvent<ObjectLiteral> | RemoveEvent<ObjectLiteral> | SoftRemoveEvent<ObjectLiteral>): string | null {
    const ev = event as { entity?: unknown; databaseEntity?: unknown };
    const source = (ev.entity ?? ev.databaseEntity) as Record<string, unknown> | undefined;
    if (!source) return null;
    const pkColumn = event.metadata.primaryColumns?.[0]?.propertyName ?? 'id';
    return (source[pkColumn] as string) ?? null;
  }
}
