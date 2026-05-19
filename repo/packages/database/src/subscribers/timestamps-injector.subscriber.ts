import {
  type EntitySubscriberInterface,
  EventSubscriber,
  type InsertEvent,
  type SoftRemoveEvent,
  type UpdateEvent,
} from 'typeorm';

interface TemporalEntity {
  createdAt?: Date | null;
  updatedAt?: Date | null;
  deletedAt?: Date | null;
}

@EventSubscriber()
export class TimestampsInjectorSubscriber implements EntitySubscriberInterface {
  beforeInsert(event: InsertEvent<unknown>): void {
    if (!event.entity) return;
    const target = event.entity as TemporalEntity;
    const now = new Date();
    if (!target.createdAt) target.createdAt = now;
    if (!target.updatedAt) target.updatedAt = now;
  }

  beforeUpdate(event: UpdateEvent<unknown>): void {
    if (!event.entity) return;
    const target = event.entity as TemporalEntity;
    target.updatedAt = new Date();
  }

  beforeSoftRemove(event: SoftRemoveEvent<unknown>): void {
    if (!event.entity) return;
    const target = event.entity as TemporalEntity;
    if (!target.deletedAt) target.deletedAt = new Date();
  }
}
