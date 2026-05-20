/**
 * apps/api/src/modules/auth/email-verification.repository
 *
 * Sprint 5 ships an in-memory implementation. Sprint 6 will replace with a
 * TypeORM-backed impl writing to the `auth_email_verifications` table.
 */

import { Injectable } from '@nestjs/common';

export const EMAIL_VERIFICATION_REPOSITORY_TOKEN = Symbol('EMAIL_VERIFICATION_REPOSITORY');

export type VerificationPurpose = 'signup' | 'change_email' | 'resend';

export interface EmailVerificationRecord {
  id: string;
  user_id: string;
  token_hash: string;
  purpose: VerificationPurpose;
  expires_at: Date;
  consumed_at: Date | null;
  created_at: Date;
  ip_at_creation: string | null;
  user_agent_at_creation: string | null;
}

export interface CreateVerificationInput {
  user_id: string;
  token_hash: string;
  purpose: VerificationPurpose;
  expires_at: Date;
  ip_at_creation?: string;
  user_agent_at_creation?: string;
}

export interface EmailVerificationRepository {
  create(input: CreateVerificationInput): Promise<EmailVerificationRecord>;
  findActiveByTokenHash(tokenHash: string): Promise<EmailVerificationRecord | null>;
  markConsumed(id: string): Promise<void>;
  deleteUnconsumedForUser(userId: string): Promise<number>;
}

@Injectable()
export class InMemoryEmailVerificationRepository implements EmailVerificationRepository {
  private records = new Map<string, EmailVerificationRecord>();
  private byTokenHash = new Map<string, string>();

  async create(input: CreateVerificationInput): Promise<EmailVerificationRecord> {
    const id = `verif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const record: EmailVerificationRecord = {
      id,
      user_id: input.user_id,
      token_hash: input.token_hash,
      purpose: input.purpose,
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

  async findActiveByTokenHash(tokenHash: string): Promise<EmailVerificationRecord | null> {
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

  /** Test helper. */
  clear(): void {
    this.records.clear();
    this.byTokenHash.clear();
  }
}
