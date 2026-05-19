import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AuthTenant } from '../system/auth-tenant.entity.js';
import { AuthUser } from '../system/auth-user.entity.js';
import { createEncryptedColumnTransformer } from './transformers/encrypted-column.transformer.js';

export type BookingCalendarProvider = 'google' | 'outlook' | 'caldav';

const TOKEN_TRANSFORMER = createEncryptedColumnTransformer('CALENDAR_TOKEN_ENCRYPTION_KEY');

@Entity('booking_calendar_syncs')
@Index('idx_booking_calendar_syncs_user', ['tenantId', 'userId', 'provider'])
export class BookingCalendarSyncEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => AuthTenant, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: AuthTenant;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => AuthUser, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'user_id' })
  user!: AuthUser;

  @Column({
    name: 'provider',
    type: 'enum',
    enum: ['google', 'outlook', 'caldav'],
    enumName: 'booking_calendar_provider',
  })
  provider!: BookingCalendarProvider;

  @Column({ name: 'provider_account_id', type: 'varchar', length: 255 })
  providerAccountId!: string;

  @Column({
    name: 'access_token_encrypted',
    type: 'text',
    transformer: TOKEN_TRANSFORMER,
  })
  accessToken!: string;

  @Column({
    name: 'refresh_token_encrypted',
    type: 'text',
    nullable: true,
    transformer: TOKEN_TRANSFORMER,
  })
  refreshToken!: string | null;

  @Column({ name: 'token_expires_at', type: 'timestamptz', nullable: true })
  tokenExpiresAt!: Date | null;

  @Column({ name: 'last_sync_at', type: 'timestamptz', nullable: true })
  lastSyncAt!: Date | null;

  @Column({ name: 'last_sync_error', type: 'varchar', length: 500, nullable: true })
  lastSyncError!: string | null;

  @Column({ name: 'sync_enabled', type: 'boolean', default: true })
  syncEnabled!: boolean;

  @Column({ name: 'scope', type: 'varchar', length: 500, nullable: true })
  scope!: string | null;

  @Column({ name: 'metadata', type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
