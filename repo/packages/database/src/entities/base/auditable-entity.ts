import { Column } from 'typeorm';
import { BaseEntity } from './base-entity.js';

/**
 * AuditableEntity -- Skalean InsurTech.
 *
 * Extension de BaseEntity pour entites soumises a tracabilite forte
 * (contrats, paiements, sinistres, factures). Ajoute created_by/updated_by.
 *
 * Colonnes nullables car certaines operations sont systeme (jobs, webhooks).
 * FK vers auth_users ajoutee dans migration 1.2.2.
 *
 * Conformite : loi 9-88 CGNC (audit trail comptable 10 ans).
 */
export abstract class AuditableEntity extends BaseEntity {
  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  public createdBy!: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  public updatedBy!: string | null;
}
