import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TenantIdInjectorSubscriber } from './tenant-id-injector.subscriber.js';
import { MissingTenantContextError } from '../errors/missing-tenant-context.error.js';
import { ImmutableTenantIdError } from '../errors/immutable-tenant-id.error.js';
import { InvalidTenantContextError } from '../errors/invalid-tenant-context.error.js';
import { runInTenantContext, runInBatchMode } from '../context/tenant-context.js';
import type { InsertEvent, UpdateEvent } from 'typeorm';

const VALID_TENANT = '11111111-1111-4111-8111-111111111111';
const VALID_USER = '22222222-2222-4222-8222-222222222222';

function makeInsertEvent(
  tableName: string,
  entity: Record<string, unknown>,
  pgTenantValue: string | null = VALID_TENANT,
): InsertEvent<Record<string, unknown>> {
  const queryRunner = {
    query: vi.fn().mockResolvedValue([{ tid: pgTenantValue }]),
  };
  return {
    metadata: { tableName },
    entity,
    queryRunner,
  } as unknown as InsertEvent<Record<string, unknown>>;
}

function makeUpdateEvent(
  tableName: string,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): UpdateEvent<Record<string, unknown>> {
  return {
    metadata: { tableName },
    entity: after,
    databaseEntity: before,
    queryRunner: { query: vi.fn() },
  } as unknown as UpdateEvent<Record<string, unknown>>;
}

describe('TenantIdInjectorSubscriber', () => {
  let subscriber: TenantIdInjectorSubscriber;

  beforeEach(() => {
    subscriber = new TenantIdInjectorSubscriber();
  });

  it('T01 INSERT auto-injects tenantId from app_current_tenant', async () => {
    const event = makeInsertEvent('auth_users', { email: 'a@b.com' });
    await runInTenantContext(
      { tenantId: null, userId: VALID_USER, userIp: null, isSuperAdmin: false, correlationId: 'c1' },
      () => subscriber.beforeInsert(event),
    );
    expect((event.entity as Record<string, unknown>)['tenantId']).toBe(VALID_TENANT);
    expect(event.queryRunner?.query).toHaveBeenCalledWith('SELECT app_current_tenant() AS tid');
  });

  it('T02 INSERT throws MissingTenantContextError sans context et non super admin', async () => {
    const event = makeInsertEvent('auth_users', { email: 'a@b.com' }, null);
    await expect(
      runInTenantContext(
        { tenantId: null, userId: VALID_USER, userIp: null, isSuperAdmin: false, correlationId: 'c2' },
        () => subscriber.beforeInsert(event),
      ),
    ).rejects.toThrow(MissingTenantContextError);
  });

  it('T03 INSERT super admin reussit avec tenant_id NULL et log warn', async () => {
    const event = makeInsertEvent('auth_users', { email: 'a@b.com' }, null);
    await runInTenantContext(
      { tenantId: null, userId: VALID_USER, userIp: null, isSuperAdmin: true, correlationId: 'c3' },
      () => subscriber.beforeInsert(event),
    );
    expect((event.entity as Record<string, unknown>)['tenantId']).toBeUndefined();
  });

  it('T04 INSERT sur table whitelistee auth_tenants skip injection', async () => {
    const event = makeInsertEvent('auth_tenants', { name: 'AXA' });
    await subscriber.beforeInsert(event);
    expect((event.entity as Record<string, unknown>)['tenantId']).toBeUndefined();
    expect(event.queryRunner?.query).not.toHaveBeenCalled();
  });

  it('T05 INSERT sur audit_log skip injection', async () => {
    const event = makeInsertEvent('audit_log', { action: 'INSERT' });
    await subscriber.beforeInsert(event);
    expect((event.entity as Record<string, unknown>)['tenantId']).toBeUndefined();
  });

  it('T06 INSERT respecte tenantId existant si UUID valide', async () => {
    const otherTenant = '33333333-3333-4333-8333-333333333333';
    const event = makeInsertEvent('auth_users', { tenantId: otherTenant });
    await runInTenantContext(
      { tenantId: VALID_TENANT, userId: VALID_USER, userIp: null, isSuperAdmin: false, correlationId: 'c6' },
      () => subscriber.beforeInsert(event),
    );
    expect((event.entity as Record<string, unknown>)['tenantId']).toBe(otherTenant);
  });

  it('T07 INSERT throws InvalidTenantContextError si app_current_tenant retourne non UUID', async () => {
    const event = makeInsertEvent('auth_users', { email: 'a@b.com' }, 'not-a-uuid');
    await expect(
      runInTenantContext(
        { tenantId: null, userId: VALID_USER, userIp: null, isSuperAdmin: false, correlationId: 'c7' },
        () => subscriber.beforeInsert(event),
      ),
    ).rejects.toThrow(InvalidTenantContextError);
  });

  it('T08 UPDATE throws ImmutableTenantIdError si tenant_id modifie', async () => {
    const event = makeUpdateEvent(
      'auth_users',
      { id: 'u1', tenantId: VALID_TENANT },
      { id: 'u1', tenantId: '99999999-9999-4999-8999-999999999999' },
    );
    await expect(
      runInTenantContext(
        { tenantId: VALID_TENANT, userId: VALID_USER, userIp: null, isSuperAdmin: false, correlationId: 'c8' },
        () => subscriber.beforeUpdate(event),
      ),
    ).rejects.toThrow(ImmutableTenantIdError);
  });

  it('T09 UPDATE super admin peut modifier tenant_id avec warn', async () => {
    const event = makeUpdateEvent(
      'auth_users',
      { id: 'u1', tenantId: VALID_TENANT },
      { id: 'u1', tenantId: '99999999-9999-4999-8999-999999999999' },
    );
    await expect(
      runInTenantContext(
        { tenantId: VALID_TENANT, userId: VALID_USER, userIp: null, isSuperAdmin: true, correlationId: 'c9' },
        () => subscriber.beforeUpdate(event),
      ),
    ).resolves.not.toThrow();
  });

  it('T10 batch mode skip injection', async () => {
    const event = makeInsertEvent('auth_users', { email: 'a@b.com' }, null);
    await runInBatchMode(
      { tenantId: null, userId: VALID_USER, userIp: null, isSuperAdmin: true, correlationId: 'c10' },
      () => subscriber.beforeInsert(event),
    );
    expect((event.entity as Record<string, unknown>)['tenantId']).toBeUndefined();
    expect(event.queryRunner?.query).not.toHaveBeenCalled();
  });

  it('T11 cache tenantId par queryRunner sur INSERTs successifs', async () => {
    const queryRunner = {
      query: vi.fn().mockResolvedValue([{ tid: VALID_TENANT }]),
    };
    const e1 = { metadata: { tableName: 'auth_users' }, entity: {}, queryRunner } as unknown as InsertEvent<Record<string, unknown>>;
    const e2 = { metadata: { tableName: 'auth_users' }, entity: {}, queryRunner } as unknown as InsertEvent<Record<string, unknown>>;
    await runInTenantContext(
      { tenantId: null, userId: VALID_USER, userIp: null, isSuperAdmin: false, correlationId: 'c11' },
      async () => {
        await subscriber.beforeInsert(e1);
        await subscriber.beforeInsert(e2);
      },
    );
    expect(queryRunner.query).toHaveBeenCalledTimes(1);
  });

  it('T12 listenTo retourne BaseEntity', () => {
    const klass = subscriber.listenTo();
    expect(typeof klass).toBe('function');
  });
});
