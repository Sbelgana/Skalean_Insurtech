/**
 * apps/api/src/modules/auth/postgres-user.repository
 *
 * Sprint 5 closure -- TypeORM-backed UserRepository implementation.
 * Uses raw SQL via DataSource.query to avoid Entity boilerplate ; Sprint 6
 * will add proper TypeORM Entity classes once multi-tenant RLS is wired.
 *
 * Activated when env USE_POSTGRES_REPOS=1 ; otherwise InMemoryUserRepository
 * is injected by AuthModule.
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import type { DataSource } from '@insurtech/database';
import type { AuthRole } from '@insurtech/auth';
import { DATA_SOURCE_TOKEN } from '../../database/data-source.provider.js';
import type { AuthUser, UserRepository } from './user.repository.js';

interface AuthUserRow {
  id: string;
  email: string;
  display_name: string;
  role: AuthRole;
  tenant_id: string | null;
  password_hash: string;
  email_verified_at: Date | null;
  mfa_enabled: boolean;
  mfa_secret_encrypted: string | null;
  mfa_recovery_codes_hashes: (string | null)[] | null;
  mfa_setup_completed_at: Date | null;
  is_active: boolean;
  deleted_at: Date | null;
  locked_until: Date | null;
  failed_login_attempts: number;
  locale: 'fr-MA' | 'ar-MA' | 'en' | 'fr-FR';
  created_at: Date;
  last_login_at: Date | null;
  last_login_ip: string | null;
}

function rowToAuthUser(row: AuthUserRow): AuthUser {
  return {
    id: row.id,
    email: row.email,
    display_name: row.display_name,
    role: row.role,
    tenant_id: row.tenant_id,
    password_hash: row.password_hash,
    email_verified_at: row.email_verified_at,
    mfa_enabled: row.mfa_enabled,
    mfa_secret_encrypted: row.mfa_secret_encrypted,
    mfa_recovery_codes_hashes: row.mfa_recovery_codes_hashes,
    mfa_setup_completed_at: row.mfa_setup_completed_at,
    is_active: row.is_active,
    deleted_at: row.deleted_at,
    locked_until: row.locked_until,
    failed_login_attempts: row.failed_login_attempts,
    locale: row.locale,
    created_at: row.created_at,
    last_login_at: row.last_login_at,
    last_login_ip: row.last_login_ip,
  };
}

@Injectable()
export class PostgresUserRepository implements UserRepository {
  private readonly logger = new Logger(PostgresUserRepository.name);

  constructor(@Inject(DATA_SOURCE_TOKEN) private readonly ds: DataSource) {}

  async findById(id: string): Promise<AuthUser | null> {
    const rows = (await this.ds.query(`SELECT * FROM auth_users WHERE id = $1 LIMIT 1`, [
      id,
    ])) as AuthUserRow[];
    return rows[0] ? rowToAuthUser(rows[0]) : null;
  }

  async findByEmail(email: string): Promise<AuthUser | null> {
    const rows = (await this.ds.query(
      `SELECT * FROM auth_users WHERE lower(email::text) = lower($1) LIMIT 1`,
      [email],
    )) as AuthUserRow[];
    return rows[0] ? rowToAuthUser(rows[0]) : null;
  }

  async create(user: AuthUser): Promise<AuthUser> {
    await this.ds.query(
      `INSERT INTO auth_users (
        id, tenant_id, email, password_hash, display_name, role, locale,
        is_active, mfa_enabled, mfa_secret_encrypted, mfa_recovery_codes_hashes,
        mfa_setup_completed_at, email_verified_at, last_login_at, last_login_ip,
        locked_until, failed_login_attempts, created_at, deleted_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19
      )`,
      [
        user.id,
        user.tenant_id,
        user.email,
        user.password_hash,
        user.display_name,
        user.role,
        user.locale,
        user.is_active,
        user.mfa_enabled,
        user.mfa_secret_encrypted,
        user.mfa_recovery_codes_hashes ? JSON.stringify(user.mfa_recovery_codes_hashes) : null,
        user.mfa_setup_completed_at,
        user.email_verified_at,
        user.last_login_at,
        user.last_login_ip,
        user.locked_until,
        user.failed_login_attempts,
        user.created_at,
        user.deleted_at,
      ],
    );
    return user;
  }

  async updateLastLogin(id: string, at: Date, ip: string): Promise<void> {
    await this.ds.query(
      `UPDATE auth_users SET last_login_at = $2, last_login_ip = $3 WHERE id = $1`,
      [id, at, ip],
    );
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await this.ds.query(
      `UPDATE auth_users SET password_hash = $2, updated_at = now() WHERE id = $1`,
      [id, passwordHash],
    );
  }

  async markEmailVerified(id: string, at: Date): Promise<void> {
    await this.ds.query(`UPDATE auth_users SET email_verified_at = $2 WHERE id = $1`, [id, at]);
  }

  async setFailedLogin(id: string, attempts: number, lockedUntil: Date | null): Promise<void> {
    await this.ds.query(
      `UPDATE auth_users SET failed_login_attempts = $2, locked_until = $3 WHERE id = $1`,
      [id, attempts, lockedUntil],
    );
  }

  async resetFailedLogin(id: string): Promise<void> {
    await this.ds.query(
      `UPDATE auth_users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1`,
      [id],
    );
  }

  async setMfaEnabled(id: string, enabled: boolean, secretEncrypted: string | null): Promise<void> {
    await this.ds.query(
      `UPDATE auth_users SET mfa_enabled = $2, mfa_secret_encrypted = $3, mfa_setup_completed_at = $4 WHERE id = $1`,
      [id, enabled, secretEncrypted, enabled ? new Date() : null],
    );
  }

  async setMfaRecoveryCodes(id: string, hashes: (string | null)[] | null): Promise<void> {
    await this.ds.query(`UPDATE auth_users SET mfa_recovery_codes_hashes = $2 WHERE id = $1`, [
      id,
      hashes ? JSON.stringify(hashes) : null,
    ]);
  }

  async consumeMfaRecoveryCode(id: string, index: number): Promise<void> {
    const rows = (await this.ds.query(
      `SELECT mfa_recovery_codes_hashes FROM auth_users WHERE id = $1`,
      [id],
    )) as Array<{ mfa_recovery_codes_hashes: (string | null)[] | null }>;
    const current = rows[0]?.mfa_recovery_codes_hashes;
    if (!current || index < 0 || index >= current.length) return;
    const updated = [...current];
    updated[index] = null;
    await this.ds.query(`UPDATE auth_users SET mfa_recovery_codes_hashes = $2 WHERE id = $1`, [
      id,
      JSON.stringify(updated),
    ]);
  }
}
