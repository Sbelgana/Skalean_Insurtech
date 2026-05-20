/**
 * apps/api/src/modules/auth/password-recovery.repository
 *
 * Sprint 5 in-memory impl. Sprint 6 will swap for the TypeORM-backed
 * auth_password_recoveries table.
 */

import { Injectable } from '@nestjs/common';

export const PASSWORD_RECOVERY_REPOSITORY_TOKEN = Symbol('PASSWORD_RECOVERY_REPOSITORY');

export interface PasswordRecoveryRecord {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  consumed_at: Date | null;
  created_at: Date;
  ip_at_creation: string | null;
  user_agent_at_creation: string | null;
}

export interface CreateRecoveryInput {
  user_id: string;
  token_hash: string;
  expires_at: Date;
  ip_at_creation?: string;
  user_agent_at_creation?: string;
}

export interface PasswordRecoveryRepository {
  create(input: CreateRecoveryInput): Promise<PasswordRecoveryRecord>;
  findActiveByTokenHash(tokenHash: string): Promise<PasswordRecoveryRecord | null>;
  markConsumed(id: string): Promise<void>;
  deleteUnconsumedForUser(userId: string): Promise<number>;
}

@Injectable()
export class InMemoryPasswordRecoveryRepository implements PasswordRecoveryRepository {
  private records = new Map<string, PasswordRecoveryRecord>();
  private byTokenHash = new Map<string, string>();

  async create(input: CreateRecoveryInput): Promise<PasswordRecoveryRecord> {
    const id = `recov-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const record: PasswordRecoveryRecord = {
      id,
      user_id: input.user_id,
      token_hash: input.token_hash,
      expires_at: input.expires_at,
      consumed_at: null,
      created_at: new Date(),
      ip_at_creation: input.ip_at_creation ?? null,
      user_agent_at_creation: input.user_agent_at_creation ?? null,
    };
    this.records.set(id, record);
    this.byTokenHash.set(input.token_hash, id);
    return record;
  }

  async findActiveByTokenHash(tokenHash: string): Promise<PasswordRecoveryRecord | null> {
    const id = this.byTokenHash.get(tokenHash);
    if (!id) return null;
    const r = this.records.get(id);
    if (!r) return null;
    if (r.consumed_at !== null) return null;
    if (r.expires_at < new Date()) return null;
    return r;
  }

  async markConsumed(id: string): Promise<void> {
    const r = this.records.get(id);
    if (r) r.consumed_at = new Date();
  }

  async deleteUnconsumedForUser(userId: string): Promise<number> {
    let count = 0;
    for (const [id, r] of this.records) {
      if (r.user_id === userId && r.consumed_at === null) {
        this.records.delete(id);
        this.byTokenHash.delete(r.token_hash);
        count += 1;
      }
    }
    return count;
  }
}
