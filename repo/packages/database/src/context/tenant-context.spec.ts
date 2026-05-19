import { describe, it, expect } from 'vitest';
import {
  getTenantId,
  getUserId,
  getRequestIp,
  isSuperAdmin,
  getCorrelationId,
  isBatchMode,
  runInTenantContext,
  runInBatchMode,
  getCurrentContext,
} from './tenant-context.js';

const BASE_CTX = {
  tenantId: '11111111-1111-4111-8111-111111111111',
  userId: '22222222-2222-4222-8222-222222222222',
  userIp: '192.168.1.1',
  isSuperAdmin: false,
  correlationId: 'corr-abc',
};

describe('tenant-context', () => {
  it('T01 retourne null hors contexte', () => {
    expect(getTenantId()).toBeNull();
    expect(getUserId()).toBeNull();
    expect(getRequestIp()).toBeNull();
    expect(isSuperAdmin()).toBe(false);
    expect(getCorrelationId()).toBeNull();
    expect(isBatchMode()).toBe(false);
    expect(getCurrentContext()).toBeUndefined();
  });

  it('T02 runInTenantContext propage les valeurs', async () => {
    await runInTenantContext(BASE_CTX, async () => {
      expect(getTenantId()).toBe(BASE_CTX.tenantId);
      expect(getUserId()).toBe(BASE_CTX.userId);
      expect(getRequestIp()).toBe(BASE_CTX.userIp);
      expect(isSuperAdmin()).toBe(false);
      expect(getCorrelationId()).toBe(BASE_CTX.correlationId);
      expect(isBatchMode()).toBe(false);
    });
  });

  it('T03 contexte est isole entre deux runInTenantContext concurrents', async () => {
    const ctx1 = { ...BASE_CTX, tenantId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', correlationId: 'c1' };
    const ctx2 = { ...BASE_CTX, tenantId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', correlationId: 'c2' };

    await Promise.all([
      runInTenantContext(ctx1, async () => {
        await new Promise((r) => setTimeout(r, 5));
        expect(getTenantId()).toBe(ctx1.tenantId);
      }),
      runInTenantContext(ctx2, async () => {
        await new Promise((r) => setTimeout(r, 1));
        expect(getTenantId()).toBe(ctx2.tenantId);
      }),
    ]);
  });

  it('T04 isSuperAdmin retourne true si defini', async () => {
    await runInTenantContext({ ...BASE_CTX, isSuperAdmin: true }, async () => {
      expect(isSuperAdmin()).toBe(true);
    });
  });

  it('T05 runInBatchMode set batchMode true', async () => {
    await runInBatchMode(BASE_CTX, async () => {
      expect(isBatchMode()).toBe(true);
    });
  });

  it('T06 getCurrentContext retourne le store complet', async () => {
    await runInTenantContext(BASE_CTX, async () => {
      const ctx = getCurrentContext();
      expect(ctx?.tenantId).toBe(BASE_CTX.tenantId);
      expect(ctx?.correlationId).toBe(BASE_CTX.correlationId);
    });
  });
});
