/**
 * BookingIcalTokenEntity -- Sprint 8 Tache 8.13.
 *
 * iCal feed subscription tokens. Token plaintext is NEVER stored ; only its
 * SHA-256 hex hash is persisted in `token_hash`. Plain token is shown to the
 * user exactly once at creation (returned by the create endpoint, then never
 * re-displayed). Validation = hash(plain) lookup.
 */

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

export type BookingIcalTokenScope = 'own' | 'team' | 'all_tenant';

@Entity('booking_ical_tokens')
@Index('idx_booking_ical_tokens_owner', ['tenantId', 'userId', 'active'])
export class BookingIcalTokenEntity {
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

  /**
   * SHA-256 hex of the plaintext token (`ical_<base64url(32)>`).
   * Plaintext is shown to the user once at creation and never stored.
   */
  @Column({ name: 'token_hash', type: 'varchar', length: 64, unique: true })
  tokenHash!: string;

  @Column({
    name: 'scope',
    type: 'varchar',
    length: 20,
    default: 'own',
  })
  scope!: BookingIcalTokenScope;

  /** User-friendly label : "iPhone Calendar", "Outlook desktop", etc. */
  @Column({ name: 'name', type: 'varchar', length: 150 })
  name!: string;

  /** Optional expiration ; NULL means active until revoked. */
  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;

  @Column({ name: 'last_accessed_at', type: 'timestamptz', nullable: true })
  lastAccessedAt!: Date | null;

  @Column({ name: 'access_count', type: 'int', default: 0 })
  accessCount!: number;

  @Column({ name: 'active', type: 'boolean', default: true })
  active!: boolean;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;

  @Column({ name: 'revoked_by_user_id', type: 'uuid', nullable: true })
  revokedByUserId!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
