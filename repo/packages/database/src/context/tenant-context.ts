import { AsyncLocalStorage } from 'node:async_hooks';

export interface TenantRequestContext {
  readonly tenantId: string | null;
  readonly userId: string | null;
  readonly userIp: string | null;
  readonly isSuperAdmin: boolean;
  readonly correlationId: string;
  readonly batchMode?: boolean;
}

const storage = new AsyncLocalStorage<TenantRequestContext>();

export function getTenantId(): string | null {
  return storage.getStore()?.tenantId ?? null;
}

export function getUserId(): string | null {
  return storage.getStore()?.userId ?? null;
}

export function getRequestIp(): string | null {
  return storage.getStore()?.userIp ?? null;
}

export function isSuperAdmin(): boolean {
  return storage.getStore()?.isSuperAdmin ?? false;
}

export function getCorrelationId(): string | null {
  return storage.getStore()?.correlationId ?? null;
}

export function isBatchMode(): boolean {
  return storage.getStore()?.batchMode ?? false;
}

export function runInTenantContext<T>(
  context: TenantRequestContext,
  fn: () => Promise<T>,
): Promise<T> {
  return storage.run(context, fn);
}

export function runInBatchMode<T>(
  context: Omit<TenantRequestContext, 'batchMode'>,
  fn: () => Promise<T>,
): Promise<T> {
  return storage.run({ ...context, batchMode: true }, fn);
}

export function getCurrentContext(): TenantRequestContext | undefined {
  return storage.getStore();
}
