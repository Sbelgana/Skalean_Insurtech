import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * BaseEntity -- Skalean InsurTech.
 *
 * Classe abstraite pour toutes les entites metier soumises a isolation
 * multi-tenant (decision-003). Fournit id, tenant_id, timestamps, soft delete.
 *
 * Conformite : loi 09-08 CNDP article 17, decision-002 RLS Postgres strict.
 */
export abstract class BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  public id!: string;

  @Index()
  @Column({ name: 'tenant_id', type: 'uuid', nullable: false })
  public tenantId!: string;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
    default: () => 'now()',
  })
  public createdAt!: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamptz',
    default: () => 'now()',
  })
  public updatedAt!: Date;

  @DeleteDateColumn({
    name: 'deleted_at',
    type: 'timestamptz',
    nullable: true,
  })
  public deletedAt!: Date | null;
}
