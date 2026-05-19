import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AuthTenant } from '../system/auth-tenant.entity.js';
import type { CrmContactEntity } from './crm-contact.entity.js';
import type { CrmDealEntity } from './crm-deal.entity.js';

@Entity({ name: 'crm_companies' })
@Index('idx_crm_companies_tenant', ['tenantId'], { where: '"deleted_at" IS NULL' })
export class CrmCompanyEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => AuthTenant, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: AuthTenant;

  @Column({ name: 'name', type: 'text' })
  name!: string;

  @Column({ name: 'industry', type: 'text', nullable: true })
  industry!: string | null;

  @Column({ name: 'ice', type: 'text', nullable: true })
  ice!: string | null;

  @Column({ name: 'rc', type: 'text', nullable: true })
  rc!: string | null;

  @Column({ name: 'patente', type: 'text', nullable: true })
  patente!: string | null;

  @Column({ name: 'address', type: 'text', nullable: true })
  address!: string | null;

  @Column({ name: 'city', type: 'text', nullable: true })
  city!: string | null;

  @Column({ name: 'country', type: 'text', default: 'MA' })
  country!: string;

  @Column({ name: 'phone', type: 'text', nullable: true })
  phone!: string | null;

  @Column({ name: 'email', type: 'citext', nullable: true })
  email!: string | null;

  @Column({ name: 'website', type: 'text', nullable: true })
  website!: string | null;

  @Column({ name: 'owner_user_id', type: 'uuid', nullable: true })
  ownerUserId!: string | null;

  @Column({ name: 'tags', type: 'text', array: true, default: () => "'{}'" })
  tags!: string[];

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy!: string | null;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;

  @OneToMany('CrmContactEntity', 'company')
  contacts?: CrmContactEntity[];

  @OneToMany('CrmDealEntity', 'company')
  deals?: CrmDealEntity[];
}
