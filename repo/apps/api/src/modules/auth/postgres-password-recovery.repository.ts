/**
 * apps/api/src/modules/auth/postgres-password-recovery.repository
 *
 * Sprint 5 closure -- TypeORM-backed PasswordRecoveryRepository.
 * Writes to auth_password_recoveries (migration AuthSprint5Augmentation1735000000009).
 */

import { Inject, Injectable } from '@nestjs/common';
import type { DataSource } from '@insurtech/database';
import { DATA_SOURCE_TOKEN } from '../../database/data-source.provider.js';
import type {
  CreateRecoveryInput,
  PasswordRecoveryRecord,
  PasswordRecoveryRepository,
} from './password-recovery.repository.js';

interface Row {
  id: string;
  user_id: string;
  tenant_id: string | null;
  token_hash: string;
  expires_at: Date;
  consumed_at: Date | null;
  created_at: Date;
  ip_at_creation: string | null;
  user_agent_at_creation: string | null;
}

function rowToRecord(r: Row): PasswordRecoveryRecord {
  return {
    id: r.id,
    user_id: r.user_id,
    token_hash: r.token_hash,
    expires_at: r.expires_at,
    consumed_at: r.consumed_at,
    created_at: r.created_at,
    ip_at_creation: r.ip_at_creation,
    user_agent_at_creation: r.user_agent_at_creation,
  };
}

@Injectable()
export class PostgresPasswordRecoveryRepository implements PasswordRecoveryRepository {
  constructor(@Inject(DATA_SOURCE_TOKEN) private readonly ds: DataSource) {}

  async create(input: CreateRecoveryInput): Promise<PasswordRecoveryRecord> {
    const rows = (await this.ds.query(
      `INSERT INTO auth_password_recoveries (
        user_id, token_hash, expires_at, ip_at_creation, user_agent_at_creation
      ) VALUES ($1,$2,$3,$4,$5)
      RETURNING *`,
      [
        input.user_id,
        input.token_hash,
        input.expires_at,
        input.ip_at_creation ?? null,
        input.user_agent_at_creation ?? null,
      ],
    )) as Row[];
    if (!rows[0]) {
      throw new Error('PostgresPasswordRecoveryRepository.create: insert returned no row');
    }
    return rowToRecord(rows[0]);
  }

  async findActiveByTokenHash(tokenHash: string): Promise<PasswordRecoveryRecord | null> {
    const rows = (await this.ds.query(
      `SELECT * FROM auth_password_recoveries
        WHERE token_hash = $1 AND consumed_at IS NULL AND expires_at > now()
        LIMIT 1`,
      [tokenHash],
    )) as Row[];
    return rows[0] ? rowToRecord(rows[0]) : null;
  }

  async markConsumed(id: string): Promise<void> {
    await this.ds.query(
      `UPDATE auth_password_recoveries SET consumed_at = now() WHERE id = $1 AND consumed_at IS NULL`,
      [id],
    );
  }

  async deleteUnconsumedForUser(userId: string): Promise<number> {
    const r = (await this.ds.query(
      `DELETE FROM auth_password_recoveries WHERE user_id = $1 AND consumed_at IS NULL`,
      [userId],
    )) as unknown as [unknown, number];
    return Array.isArray(r) && typeof r[1] === 'number' ? r[1] : 0;
  }
}
