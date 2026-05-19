import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuditLogWriterSubscriber } from './audit-log-writer.subscriber.js';
import { runInTenantContext } from '../context/tenant-context.js';
import type { InsertEvent, RemoveEvent, SoftRemoveEvent, UpdateEvent } from 'typeorm';

const TENANT = '11111111-1111-4111-8111-111111111111';
const USER = '22222222-2222-4222-8222-222222222222';

function makeQueryRunner() {
  return {
    query: vi.fn().mockResolvedValue([]),
    manager: { insert: vi.fn() },
  };
}

function makeMetadata(tableName: string) {
  return {
    tableName,
    primaryColumns: [{ propertyName: 'id' }],
  };
}

describe('AuditLogWriterSubscriber', () => {
  let subscriber: AuditLogWriterSubscriber;
  let qr: ReturnType<typeof makeQueryRunner>;

  beforeEach(() => {
    subscriber = new AuditLogWriterSubscriber();
    qr = makeQueryRunner();
  });

  function getQueryArgs(): unknown[] {
    return qr.query.mock.calls[0]?.[1] as unknown[] ?? [];
  }

  it('T01 afterInsert ecrit row audit_log pour table auditable', async () => {
    const event = {
      metadata: makeMetadata('auth_users'),
      entity: { id: 'u1', email: 'a@b.com' },
      queryRunner: qr,
    } as unknown as InsertEvent<unknown>;
    await runInTenantContext(
      { tenantId: TENANT, userId: USER, userIp: '10.0.0.1', isSuperAdmin: false, correlationId: 'cor1' },
      () => subscriber.afterInsert(event),
    );
    expect(qr.query).toHaveBeenCalledTimes(1);
    const args = getQueryArgs();
    expect(args[0]).toBe('INSERT');
    expect(args[1]).toBe('auth_users');
    expect(args[2]).toBe('u1');
    expect(args[3]).toBe(USER);
    expect(args[4]).toBe('10.0.0.1');
    const changesJson = args[6] as string;
    const changes = JSON.parse(changesJson) as { fieldsChanged: string[] };
    expect(changes.fieldsChanged).toContain('email');
  });

  it('T02 afterUpdate calcule diff fieldsChanged trie alphabetiquement', async () => {
    const event = {
      metadata: makeMetadata('auth_users'),
      databaseEntity: { id: 'u1', email: 'old@b.com', firstName: 'Ali', lastName: 'X' },
      entity: { id: 'u1', email: 'new@b.com', firstName: 'Ali', lastName: 'Y' },
      queryRunner: qr,
    } as unknown as UpdateEvent<unknown>;
    await runInTenantContext(
      { tenantId: TENANT, userId: USER, userIp: null, isSuperAdmin: false, correlationId: 'c2' },
      () => subscriber.afterUpdate(event),
    );
    const changesJson = getQueryArgs()[6] as string;
    const changes = JSON.parse(changesJson) as { fieldsChanged: string[] };
    expect(changes.fieldsChanged).toEqual(['email', 'lastName']);
  });

  it('T03 afterRemove ecrit row action DELETE', async () => {
    const event = {
      metadata: makeMetadata('auth_users'),
      databaseEntity: { id: 'u1', email: 'a@b.com' },
      queryRunner: qr,
    } as unknown as RemoveEvent<unknown>;
    await runInTenantContext(
      { tenantId: TENANT, userId: USER, userIp: null, isSuperAdmin: false, correlationId: 'c3' },
      () => subscriber.afterRemove(event),
    );
    expect(getQueryArgs()[0]).toBe('DELETE');
  });

  it('T04 afterSoftRemove ecrit row action SOFT_DELETE', async () => {
    const event = {
      metadata: makeMetadata('auth_users'),
      databaseEntity: { id: 'u1', email: 'a@b.com' },
      entity: { id: 'u1', email: 'a@b.com', deletedAt: new Date() },
      queryRunner: qr,
    } as unknown as SoftRemoveEvent<unknown>;
    await runInTenantContext(
      { tenantId: TENANT, userId: USER, userIp: null, isSuperAdmin: false, correlationId: 'c4' },
      () => subscriber.afterSoftRemove(event),
    );
    expect(getQueryArgs()[0]).toBe('SOFT_DELETE');
  });

  it('T05 table audit_log ignore recursion', async () => {
    const event = {
      metadata: makeMetadata('audit_log'),
      entity: { id: 'al1' },
      queryRunner: qr,
    } as unknown as InsertEvent<unknown>;
    await subscriber.afterInsert(event);
    expect(qr.query).not.toHaveBeenCalled();
  });

  it('T06 table non auditable ignoree silencieusement', async () => {
    const event = {
      metadata: makeMetadata('stock_items'),
      entity: { id: 's1', sku: 'P001' },
      queryRunner: qr,
    } as unknown as InsertEvent<unknown>;
    await subscriber.afterInsert(event);
    expect(qr.query).not.toHaveBeenCalled();
  });

  it('T07 password_hash redacte dans changes', async () => {
    const event = {
      metadata: makeMetadata('auth_users'),
      entity: { id: 'u1', email: 'a@b.com', password_hash: 'hashed_value' },
      queryRunner: qr,
    } as unknown as InsertEvent<unknown>;
    await runInTenantContext(
      { tenantId: TENANT, userId: USER, userIp: null, isSuperAdmin: false, correlationId: 'c7' },
      () => subscriber.afterInsert(event),
    );
    const changesJson = getQueryArgs()[6] as string;
    const changes = JSON.parse(changesJson) as { after: Record<string, unknown> };
    expect(changes.after?.['password_hash']).toBe('[REDACTED]');
  });

  it('T08 afterUpdate sans changement ne log pas', async () => {
    const entity = { id: 'u1', email: 'same@b.com' };
    const event = {
      metadata: makeMetadata('auth_users'),
      databaseEntity: entity,
      entity: { ...entity },
      queryRunner: qr,
    } as unknown as UpdateEvent<unknown>;
    await runInTenantContext(
      { tenantId: TENANT, userId: USER, userIp: null, isSuperAdmin: false, correlationId: 'c8' },
      () => subscriber.afterUpdate(event),
    );
    expect(qr.query).not.toHaveBeenCalled();
  });

  it('T09 batch mode skip audit log', async () => {
    const event = {
      metadata: makeMetadata('auth_users'),
      entity: { id: 'u1' },
      queryRunner: qr,
    } as unknown as InsertEvent<unknown>;
    const { runInBatchMode } = await import('../context/tenant-context.js');
    await runInBatchMode(
      { tenantId: TENANT, userId: USER, userIp: null, isSuperAdmin: false, correlationId: 'c9' },
      () => subscriber.afterInsert(event),
    );
    expect(qr.query).not.toHaveBeenCalled();
  });

  it('T10 truncation si diff > MAX_DIFF_SIZE_BYTES', async () => {
    const largeValue = 'x'.repeat(20000);
    const event = {
      metadata: makeMetadata('auth_users'),
      entity: { id: 'u1', email: 'a@b.com', largeField: largeValue },
      queryRunner: qr,
    } as unknown as InsertEvent<unknown>;
    await runInTenantContext(
      { tenantId: TENANT, userId: USER, userIp: null, isSuperAdmin: false, correlationId: 'c10' },
      () => subscriber.afterInsert(event),
    );
    const changesJson = getQueryArgs()[6] as string;
    const changes = JSON.parse(changesJson) as { truncated?: boolean };
    expect(changes.truncated).toBe(true);
  });
});
