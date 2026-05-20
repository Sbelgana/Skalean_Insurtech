/**
 * @insurtech/auth/services/mfa
 *
 * Implements TOTP RFC 6238 + recovery codes + setup/challenge tokens.
 *
 * Reference :
 *   - RFC 6238 (TOTP), RFC 4226 (HOTP), RFC 4648 (base32)
 *   - NIST SP 800-63B AAL2
 *   - ACAPS circulaire 2024 (MFA mandatory for broker_admin/garage_admin)
 *   - decision-016 (TOTP RFC 6238 standard)
 *
 * Sprint 5 Tache 2.1.7
 */

import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { authenticator } from 'otplib';
import qrcode from 'qrcode';
import { Argon2Service } from './argon2.service.js';
import { EncryptionService } from './encryption.service.js';
import { HashingService } from './hashing.service.js';
import { REDIS_TOKEN, type RedisLike } from './session.service.js';
import {
  buildOtpauthUrl,
  formatRecoveryCode,
  parseRecoveryCode,
  validateTotpFormat,
} from './mfa.helpers.js';
import {
  MfaChallengeExpiredError,
  MfaInvalidCodeError,
  MfaSetupTokenExpiredError,
} from '../errors/mfa-errors.js';
import type {
  MfaChallengeRecord,
  MfaConfirmResult,
  MfaSetupPendingRecord,
  MfaSetupResult,
  MfaVerifyResult,
} from '../types/mfa-types.js';
import type { EncryptedString } from '../types/encrypted-payload.js';
import { nowInSeconds } from '../types/jwt-payload.js';

const TOTP_DIGITS = 6;
const TOTP_PERIOD_SECONDS = 30;
const TOTP_WINDOW = 1;
const TOTP_ALGORITHM = 'SHA1' as const;
const RECOVERY_CODES_COUNT = 6;
const SETUP_PENDING_TTL_SECONDS = 30 * 60;
const CHALLENGE_TTL_SECONDS = 5 * 60;

@Injectable()
export class MfaService implements OnModuleInit {
  private readonly logger = new Logger(MfaService.name);
  private issuer = 'Skalean InsurTech';

  constructor(
    @Inject(REDIS_TOKEN) private readonly redis: RedisLike,
    private readonly argon2: Argon2Service,
    private readonly encryption: EncryptionService,
    private readonly hashing: HashingService,
  ) {}

  onModuleInit(): void {
    this.issuer = process.env['MFA_TOTP_ISSUER'] ?? 'Skalean InsurTech';
    this.logger.log({ action: 'mfa_service_init', issuer: this.issuer });
  }

  /**
   * Initiates MFA setup : generates secret + QR + otpauth URL,
   * stores pending in Redis with TTL 30 min.
   */
  async startSetup(input: { user_id: string; email: string }): Promise<MfaSetupResult> {
    const secretB32 = authenticator.generateSecret(20);
    const otpauthUrl = buildOtpauthUrl({
      email: input.email,
      issuer: this.issuer,
      secretB32,
      digits: TOTP_DIGITS,
      period: TOTP_PERIOD_SECONDS,
      algorithm: TOTP_ALGORITHM,
    });
    const qrCodeDataUrl = await qrcode.toDataURL(otpauthUrl, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 256,
    });

    const setupToken = this.hashing.randomToken(32);
    const setupKey = this.buildSetupKey(setupToken);
    const now = nowInSeconds();
    const expiresAt = now + SETUP_PENDING_TTL_SECONDS;
    const pending: MfaSetupPendingRecord = {
      user_id: input.user_id,
      secret_b32: secretB32,
      created_at: now,
      expires_at: expiresAt,
    };
    await this.redis.set(setupKey, JSON.stringify(pending), 'EX', SETUP_PENDING_TTL_SECONDS);

    this.logger.log({ action: 'mfa_setup_started', user_id: input.user_id });
    return {
      setup_token: setupToken,
      secret_b32: secretB32,
      qr_code_data_url: qrCodeDataUrl,
      otpauth_url: otpauthUrl,
      expires_at: expiresAt,
    };
  }

  /**
   * Confirms MFA setup with a TOTP code matching the pending secret.
   * On success, returns the encrypted secret + hashed recovery codes
   * for the caller to persist. Recovery codes are shown ONCE in clear.
   */
  async confirmSetup(input: {
    setup_token: string;
    totp_code: string;
    user_id: string;
  }): Promise<{
    encrypted_secret: EncryptedString;
    recovery_codes_clear: readonly string[];
    recovery_codes_hashed: readonly string[];
    confirm: MfaConfirmResult;
  }> {
    if (!validateTotpFormat(input.totp_code)) {
      throw new MfaInvalidCodeError();
    }

    const setupKey = this.buildSetupKey(input.setup_token);
    const raw = await this.redis.get(setupKey);
    if (!raw) {
      throw new MfaSetupTokenExpiredError();
    }
    const pending = JSON.parse(raw) as MfaSetupPendingRecord;
    if (pending.user_id !== input.user_id) {
      this.logger.warn({
        action: 'mfa_setup_user_mismatch',
        expected: pending.user_id,
        presented: input.user_id,
      });
      throw new MfaSetupTokenExpiredError();
    }

    const valid = this.verifyTotpCode(pending.secret_b32, input.totp_code);
    if (!valid) {
      throw new MfaInvalidCodeError();
    }

    await this.redis.del(setupKey);

    // Generate 6 recovery codes (12 chars each, formatted XXXX-XXXX-XXXX)
    const formattedCodes: string[] = [];
    for (let i = 0; i < RECOVERY_CODES_COUNT; i += 1) {
      const part1 = this.argon2.generateRecoveryCode();
      const raw12 = `${part1}AB`.slice(0, 12);
      formattedCodes.push(formatRecoveryCode(raw12));
    }
    const hashedCodes = await Promise.all(formattedCodes.map((c) => this.argon2.hash(c)));
    const encryptedSecret = this.encryption.encrypt(pending.secret_b32, input.user_id);

    this.logger.log({ action: 'mfa_setup_confirmed', user_id: input.user_id });

    return {
      encrypted_secret: encryptedSecret,
      recovery_codes_clear: formattedCodes,
      recovery_codes_hashed: hashedCodes,
      confirm: {
        mfa_enabled: true,
        recovery_codes: formattedCodes,
        recovery_codes_warning:
          'These codes are shown ONLY ONCE. Save them in a secure location.',
      },
    };
  }

  /** Verifies a TOTP code against an encrypted stored secret. */
  async verifyEncryptedTotp(input: {
    encrypted_secret: EncryptedString | string;
    user_id: string;
    totp_code: string;
  }): Promise<boolean> {
    if (!validateTotpFormat(input.totp_code)) return false;
    let secretB32: string;
    try {
      secretB32 = this.encryption.decrypt(input.encrypted_secret as EncryptedString, input.user_id);
    } catch {
      this.logger.warn({ action: 'mfa_decrypt_failed', user_id: input.user_id });
      return false;
    }
    return this.verifyTotpCode(secretB32, input.totp_code);
  }

  /** Verifies a TOTP code against a clear secret (internal + tests). */
  verifyTotpCode(secretB32: string, code: string): boolean {
    if (!validateTotpFormat(code)) return false;
    const totp = authenticator.clone();
    totp.options = {
      digits: TOTP_DIGITS,
      step: TOTP_PERIOD_SECONDS,
      window: TOTP_WINDOW,
      algorithm: 'sha1' as never,
    };
    return totp.verify({ token: code, secret: secretB32 });
  }

  /**
   * Verifies a recovery code against the array of hashed codes.
   * Iterates ALL hashes to maintain timing parity.
   */
  async verifyRecoveryCode(input: {
    hashes: readonly (string | null)[];
    presented: string;
  }): Promise<MfaVerifyResult> {
    const parsed = parseRecoveryCode(input.presented);
    if (!parsed) {
      await Promise.all(
        input.hashes.map((h) => (h ? this.argon2.verify(h, 'invalid') : Promise.resolve(false))),
      );
      return { valid: false };
    }
    const formatted = formatRecoveryCode(parsed);

    let matchedIndex: number | undefined;
    for (let i = 0; i < input.hashes.length; i += 1) {
      const h = input.hashes[i];
      if (h === null || h === undefined) continue;
      const ok = await this.argon2.verify(h, formatted);
      if (ok && matchedIndex === undefined) {
        matchedIndex = i;
      }
    }
    if (matchedIndex === undefined) {
      return { valid: false };
    }
    return {
      valid: true,
      used_recovery_code: true,
      recovery_code_index_used: matchedIndex,
    };
  }

  /** Creates a one-time challenge token used between /signin and /verify-mfa. */
  async createChallengeToken(input: {
    user_id: string;
    email: string;
  }): Promise<{ token: string; expires_at: number }> {
    const token = this.hashing.randomToken(32);
    const key = this.buildChallengeKey(token);
    const now = nowInSeconds();
    const expiresAt = now + CHALLENGE_TTL_SECONDS;
    const record: MfaChallengeRecord = {
      user_id: input.user_id,
      email: input.email,
      created_at: now,
      expires_at: expiresAt,
    };
    await this.redis.set(key, JSON.stringify(record), 'EX', CHALLENGE_TTL_SECONDS);
    return { token, expires_at: expiresAt };
  }

  /**
   * Consumes a challenge token (GET then DEL).
   * Returns the record or throws MfaChallengeExpiredError.
   */
  async consumeChallengeToken(token: string): Promise<MfaChallengeRecord> {
    const key = this.buildChallengeKey(token);
    const raw = await this.redis.get(key);
    if (!raw) throw new MfaChallengeExpiredError();
    await this.redis.del(key);
    try {
      return JSON.parse(raw) as MfaChallengeRecord;
    } catch {
      throw new MfaChallengeExpiredError();
    }
  }

  /** Generates a TOTP code for a given secret (test helper). */
  generateCurrentCode(secretB32: string): string {
    const totp = authenticator.clone();
    totp.options = {
      digits: TOTP_DIGITS,
      step: TOTP_PERIOD_SECONDS,
      window: 0,
      algorithm: 'sha1' as never,
    };
    return totp.generate(secretB32);
  }

  private buildSetupKey(token: string): string {
    return `mfa_setup:${this.hashing.sha256(token)}`;
  }

  private buildChallengeKey(token: string): string {
    return `mfa_challenge:${this.hashing.sha256(token)}`;
  }
}
