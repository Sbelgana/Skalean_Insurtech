/**
 * @insurtech/auth/services/session.repository
 *
 * Optional persistent audit trail for sessions beyond Redis TTL.
 * Postgres-backed impl deferred to Sprint 6 (requires @insurtech/database DI).
 * For Sprint 5 we ship a NoOp implementation (Redis is source of truth).
 *
 * The interface allows mock substitution for unit tests.
 */

import { Injectable } from '@nestjs/common';
import type { SessionMetadata } from '../types/session-metadata.js';

export const SESSION_REPOSITORY_TOKEN = Symbol('SESSION_REPOSITORY');

export interface SessionRepository {
  insert(s: SessionMetadata): Promise<void>;
  markRevoked(jti: string): Promise<void>;
  findByUserId(userId: string): Promise<SessionMetadata[]>;
  updateLastSeenAt(jti: string, ts: number): Promise<void>;
}

/**
 * NoOp default. Sprint 6 will replace this with a Postgres-backed impl.
 */
@Injectable()
export class NoOpSessionRepository implements SessionRepository {
  async insert(_s: SessionMetadata): Promise<void> {
    // Redis is the source of truth for Sprint 5; persistent audit trail comes Sprint 6.
  }

  async markRevoked(_jti: string): Promise<void> {
    // no-op
  }

  async findByUserId(_userId: string): Promise<SessionMetadata[]> {
    return [];
  }

  async updateLastSeenAt(_jti: string, _ts: number): Promise<void> {
    // no-op
  }
}
