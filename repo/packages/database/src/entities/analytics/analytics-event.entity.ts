import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { AuthTenant } from '../system/auth-tenant.entity.js';
import type { AuthUser } from '../system/auth-user.entity.js';

@Entity({ name: 'analytics_events' })
@Index('idx_analytics_events_tenant_occurred', ['tenantId', 'occurredAt'])
export class AnalyticsEventEntity {
  @PrimaryColumn({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt!: Date;

  @PrimaryColumn({ name: 'id', type: 'uuid', default: () => 'gen_random_uuid()' })
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => AuthTenant, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: AuthTenant;

  @Column({ name: 'event_name', type: 'text' })
  eventName!: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId!: string | null;

  @ManyToOne('AuthUser', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user!: AuthUser | null;

  @Column({ name: 'session_id', type: 'text', nullable: true })
  sessionId!: string | null;

  @Column({ name: 'properties', type: 'jsonb', default: () => `'{}'::jsonb` })
  properties!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
