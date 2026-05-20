/**
 * apps/api/src/modules/auth/postgres-email-verification.repository
 *
 * Sprint 5 closure -- TypeORM-backed EmailVerificationRepository.
 * Writes to auth_email_verifications (migration AuthSprint5Augmentation1735000000009).
 */

import { Inject, Injectable } from '@nestjs/common';
import type { DataSource } from '@insurtech/database';
import { DATA_SOURCE_TOKEN } from '../../database/data-source.provider.js';
import type {
  CreateVerificationInput,
  EmailVerificationRecord,
  EmailVerificationRepository,
  VerificationPurpose,
} from './email-verification.repository.js';

interface Row {
  id: string;
  user_id: string;
  tenant_id: string | null;
  token_hash: string;
  purpose: VerificationPurpose;
  expires_at: Date;
  consumed_at: Date | null;
  created_at: Date;
  ip_at_creation: string | null;
  user_agent_at_creation: string | null;
}

function rowToRecord(r: Row): EmailVerificationRecord {
  return {
    id: r.id,
    user_id: r.user_id,
    token_hash: r.token_hash,
    purpose: r.purpose,
    expires_at: r.expires_at,
    consumed_at: r.consumed_at,
    created_at: r.created_at,
    ip_at_creation: r.ip_at_creation,
    user_agent_at_creation: r.user_agent_at_creation,
  };
}

@Injectable()
export class PostgresEmailVerificationRepository implements EmailVerificationRepository {
  constructor(@Inject(DATA_SOURCE_TOKEN) private readonly ds: DataSource) {}

  async create(input: CreateVerificationInput): Promise<EmailVerificationRecord> {
    const rows = (await this.ds.query(
      `INSERT INTO auth_email_verifications (
        user_id, token_hash, purpose, expires_at, ip_at_creation, user_agent_at_creation
      ) VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING *`,
      [
        input.user_id,
        input.token_hash,
        input.purpose,
        input.expires_at,
        input.ip_at_creation ?? null,
        input.user_agent_at_creation ?? null,
      ],
    )) as Row[];
    if (!rows[0]) throw new Error('PostgresEmailVerificationRepository.create: insert returned no row');
    return rowToRecord(rows[0]);
  }

  async findActiveByTokenHash(tokenHash: string): Promise<EmailVerificationRecord | null> {
    const rows = (await this.ds.query(
      `SELECT * FROM auth_email_verifications
        WHERE token_hash = $1 AND consumed_at IS NULL AND expires_at > now()
        LIMIT 1`,
      [tokenHash],
    )) as Row[];
    return rows[0] ? rowToRecord(rows[0]) : null;
  }

  async markConsumed(id: string): Promise<void> {
    await this.ds.query(
      `UPDATE auth_email_verifications SET consumed_at = now() WHERE id = $1 AND consumed_at IS NULL`,
      [id],
    );
  }

  async deleteUnconsumedForUser(userId: string): Promise<number> {
    const r = (await this.ds.query(
      `DELETE FROM auth_email_verifications WHERE user_id = $1 AND consumed_at IS NULL`,
      [userId],
    )) as unknown as [unknown, number];
    return Array.isArray(r) && typeof r[1] === 'number' ? r[1] : 0;
  }
}
