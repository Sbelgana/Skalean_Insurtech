import { describe, it, expect, beforeEach } from 'vitest';
import { TimestampsInjectorSubscriber } from './timestamps-injector.subscriber.js';
import type { InsertEvent, SoftRemoveEvent, UpdateEvent } from 'typeorm';

describe('TimestampsInjectorSubscriber', () => {
  let subscriber: TimestampsInjectorSubscriber;

  beforeEach(() => {
    subscriber = new TimestampsInjectorSubscriber();
  });

  it('T01 beforeInsert set createdAt si absent', () => {
    const entity: Record<string, unknown> = { name: 'Test' };
    const event = { entity } as unknown as InsertEvent<unknown>;
    const before = Date.now();
    subscriber.beforeInsert(event);
    const createdAt = entity['createdAt'] as Date;
    expect(createdAt).toBeInstanceOf(Date);
    expect(createdAt.getTime()).toBeGreaterThanOrEqual(before);
  });

  it('T02 beforeInsert set updatedAt si absent', () => {
    const entity: Record<string, unknown> = {};
    const event = { entity } as unknown as InsertEvent<unknown>;
    subscriber.beforeInsert(event);
    expect(entity['updatedAt']).toBeInstanceOf(Date);
  });

  it('T03 beforeInsert ne remplace pas createdAt existant', () => {
    const existing = new Date('2020-01-01');
    const entity: Record<string, unknown> = { createdAt: existing };
    const event = { entity } as unknown as InsertEvent<unknown>;
    subscriber.beforeInsert(event);
    expect(entity['createdAt']).toBe(existing);
  });

  it('T04 beforeUpdate met a jour updatedAt', () => {
    const entity: Record<string, unknown> = { updatedAt: new Date('2020-01-01') };
    const event = { entity } as unknown as UpdateEvent<unknown>;
    const before = Date.now();
    subscriber.beforeUpdate(event);
    const updatedAt = entity['updatedAt'] as Date;
    expect(updatedAt.getTime()).toBeGreaterThanOrEqual(before);
  });

  it('T05 beforeUpdate sans entity fait rien', () => {
    const event = { entity: null } as unknown as UpdateEvent<unknown>;
    expect(() => subscriber.beforeUpdate(event)).not.toThrow();
  });

  it('T06 beforeSoftRemove set deletedAt si absent', () => {
    const entity: Record<string, unknown> = {};
    const event = { entity } as unknown as SoftRemoveEvent<unknown>;
    const before = Date.now();
    subscriber.beforeSoftRemove(event);
    const deletedAt = entity['deletedAt'] as Date;
    expect(deletedAt).toBeInstanceOf(Date);
    expect(deletedAt.getTime()).toBeGreaterThanOrEqual(before);
  });

  it('T07 beforeSoftRemove ne remplace pas deletedAt existant', () => {
    const existing = new Date('2021-06-15');
    const entity: Record<string, unknown> = { deletedAt: existing };
    const event = { entity } as unknown as SoftRemoveEvent<unknown>;
    subscriber.beforeSoftRemove(event);
    expect(entity['deletedAt']).toBe(existing);
  });

  it('T08 beforeInsert idempotent avec entity deja hydratee', () => {
    const d1 = new Date('2023-01-01');
    const d2 = new Date('2023-01-01');
    const entity: Record<string, unknown> = { createdAt: d1, updatedAt: d2 };
    const event = { entity } as unknown as InsertEvent<unknown>;
    subscriber.beforeInsert(event);
    expect(entity['createdAt']).toBe(d1);
    expect(entity['updatedAt']).toBe(d2);
  });
});
