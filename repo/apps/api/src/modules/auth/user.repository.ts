/**
 * apps/api/src/modules/auth/user.repository
 *
 * Sprint 5 ships an in-memory implementation (test/bootstrap).
 * Sprint 6 will replace with a Postgres-backed impl using @insurtech/database
 * (auth_users + auth_user_credentials tables).
 *
 * The interface stays stable across the swap.
 */

import { Injectable } from '@nestjs/common';
import type { AuthRole } from '@insurtech/auth';

export const USER_REPOSITORY_TOKEN = Symbol('USER_REPOSITORY');

export interface AuthUser {
  id: string;
  email: string;
  display_name: string;
  role: AuthRole;
  tenant_id: string | null;
  password_hash: string;
  email_verified_at: Date | null;
  mfa_enabled: boolean;
  mfa_secret_encrypted: string | null;
  is_active: boolean;
  deleted_at: Date | null;
  locked_until: Date | null;
  failed_login_attempts: number;
  locale: 'fr-MA' | 'ar-MA' | 'en' | 'fr-FR';
  created_at: Date;
  last_login_at: Date | null;
  last_login_ip: string | null;
}

export interface UserRepository {
  findById(id: string): Promise<AuthUser | null>;
  findByEmail(email: string): Promise<AuthUser | null>;
  create(user: AuthUser): Promise<AuthUser>;
  updateLastLogin(id: string, at: Date, ip: string): Promise<void>;
  updatePassword(id: string, passwordHash: string): Promise<void>;
  markEmailVerified(id: string, at: Date): Promise<void>;
  setFailedLogin(id: string, attempts: number, lockedUntil: Date | null): Promise<void>;
  resetFailedLogin(id: string): Promise<void>;
  setMfaEnabled(id: string, enabled: boolean, secretEncrypted: string | null): Promise<void>;
}

@Injectable()
export class InMemoryUserRepository implements UserRepository {
  private readonly users = new Map<string, AuthUser>();
  private readonly emailIndex = new Map<string, string>();

  async findById(id: string): Promise<AuthUser | null> {
    return this.users.get(id) ?? null;
  }

  async findByEmail(email: string): Promise<AuthUser | null> {
    const id = this.emailIndex.get(email.toLowerCase());
    if (!id) return null;
    return this.users.get(id) ?? null;
  }

  async create(user: AuthUser): Promise<AuthUser> {
    this.users.set(user.id, user);
    this.emailIndex.set(user.email.toLowerCase(), user.id);
    return user;
  }

  async updateLastLogin(id: string, at: Date, ip: string): Promise<void> {
    const u = this.users.get(id);
    if (!u) return;
    u.last_login_at = at;
    u.last_login_ip = ip;
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    const u = this.users.get(id);
    if (!u) return;
    u.password_hash = passwordHash;
  }

  async markEmailVerified(id: string, at: Date): Promise<void> {
    const u = this.users.get(id);
    if (!u) return;
    u.email_verified_at = at;
  }

  async setFailedLogin(id: string, attempts: number, lockedUntil: Date | null): Promise<void> {
    const u = this.users.get(id);
    if (!u) return;
    u.failed_login_attempts = attempts;
    u.locked_until = lockedUntil;
  }

  async resetFailedLogin(id: string): Promise<void> {
    const u = this.users.get(id);
    if (!u) return;
    u.failed_login_attempts = 0;
    u.locked_until = null;
  }

  async setMfaEnabled(id: string, enabled: boolean, secretEncrypted: string | null): Promise<void> {
    const u = this.users.get(id);
    if (!u) return;
    u.mfa_enabled = enabled;
    u.mfa_secret_encrypted = secretEncrypted;
  }

  /** Test helper -- clears all data. */
  clear(): void {
    this.users.clear();
    this.emailIndex.clear();
  }
}
