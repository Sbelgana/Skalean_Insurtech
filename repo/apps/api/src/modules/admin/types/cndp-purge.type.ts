/**
 * Types pour CndpPurgeService -- loi 09-08 droit oubli.
 *
 * Reference : Sprint 6 / Tache 2.2.12 + decision-003 conformite Maroc.
 */

export type PurgeRequestType = 'user_data' | 'full_tenant';

export type PurgeRequestStatus =
  | 'pending'
  | 'validated'
  | 'in_grace_period'
  | 'executed'
  | 'completed'
  | 'cancelled';

export interface PurgeRequest {
  id: string;
  tenantId: string;
  requestType: PurgeRequestType;
  /** UUID utilisateur dont les donnees doivent etre purgees (user_data). null pour full_tenant. */
  targetUserId: string | null;
  requestedByEmail: string;
  reason: string;
  status: PurgeRequestStatus;
  createdAt: Date;
  validatedAt: Date | null;
  validatedByUserId: string | null;
  graceEndsAt: Date | null;
  executedAt: Date | null;
  executedByUserId: string | null;
  completedAt: Date | null;
  /** Tables/rows purgees (audit) -- snapshot post-execution. */
  affectedRecords: Record<string, number> | null;
}

export const CNDP_PURGE_ERROR_CODES = {
  REQUEST_NOT_FOUND: 'CNDP_PURGE_REQUEST_NOT_FOUND',
  ALREADY_VALIDATED: 'CNDP_PURGE_ALREADY_VALIDATED',
  NOT_VALIDATED: 'CNDP_PURGE_NOT_VALIDATED',
  ALREADY_EXECUTED: 'CNDP_PURGE_ALREADY_EXECUTED',
  GRACE_PERIOD_NOT_ELAPSED: 'CNDP_PURGE_GRACE_PERIOD_NOT_ELAPSED',
  REQUEST_CANCELLED: 'CNDP_PURGE_REQUEST_CANCELLED',
} as const;

/** Grace period legale (loi 09-08 droit oubli) : 30 jours apres validation. */
export const CNDP_GRACE_PERIOD_DAYS = 30;
