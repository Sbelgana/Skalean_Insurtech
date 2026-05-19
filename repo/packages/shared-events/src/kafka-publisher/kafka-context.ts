import { AsyncLocalStorage } from 'node:async_hooks';

export interface KafkaTenantStore {
  tenantId: string;
}

export interface KafkaRequestStore {
  correlationId: string;
  causationId?: string;
}

export const kafkaTenantContext = new AsyncLocalStorage<KafkaTenantStore>();
export const kafkaRequestContext = new AsyncLocalStorage<KafkaRequestStore>();
