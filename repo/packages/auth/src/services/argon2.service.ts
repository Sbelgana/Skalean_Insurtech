/**
 * @insurtech/auth/services/argon2
 *
 * Argon2id-based password hashing service. OWASP Password Storage Cheat Sheet 2024 compliant.
 *
 * Reference :
 *   - decision-013 (Argon2id over bcrypt)
 *   - https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
 *   - RFC 9106 (Argon2)
 *   - Sprint 5 Tache 2.1.2
 *
 * IMPORTANT : Docker images using this service MUST use glibc-based base
 * (debian, ubuntu) -- NOT alpine -- because @node-rs/argon2 prebuilt binaries
 * target glibc. See Sprint 32 Tache 5.1.1 Dockerfile.
 */

import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { hash as argon2Hash, verify as argon2Verify } from '@node-rs/argon2';
import { randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

/**
 * Argon2id numeric tag for @node-rs/argon2 (const enum Algorithm.Argon2id = 2).
 * Defined as a runtime constant because verbatimModuleSyntax forbids importing
 * ambient const enums from the dep.
 */
const ARGON2ID = 2 as const;
import { ARGON2_PARAMS, PASSWORD_POLICY } from '../constants/argon2-params.js';
import { loadBanlist } from '../data/banlist-loader.js';
import {
  compareArgon2Params,
  levenshteinDistance,
  normalizePasswordForBanlist,
  parseArgon2Hash,
} from './argon2.helpers.js';
import { PepperService } from './pepper.service.js';
import type {
  PasswordPolicyReason,
  PasswordPolicyResult,
} from '../types/password-policy-result.js';

/**
 * Pre-computed dummy hash used in `verifyEmptyForTiming()` to equalize timing
 * between login attempts where the user does not exist and where the user exists
 * but the password is wrong.
 */
let DUMMY_HASH: string | null = null;

export interface PolicyValidationContext {
  email?: string;
  display_name?: string;
}

@Injectable()
export class Argon2Service implements OnModuleInit {
  private readonly logger = new Logger(Argon2Service.name);
  private banlist: ReadonlySet<string> | null = null;

  constructor(private readonly pepperService: PepperService) {}

  async onModuleInit(): Promise<void> {
    const startBanlist = Date.now();
    this.banlist = loadBanlist();
    this.logger.log(
      `banlist loaded: ${this.banlist.size} entries in ${Date.now() - startBanlist}ms`,
    );

    randomBytes(16);

    if (DUMMY_HASH === null) {
      const startDummy = Date.now();
      DUMMY_HASH = await this.hash('dummy-password-for-timing-equalization-x9k3l2');
      this.logger.log(`dummy hash pre-computed in ${Date.now() - startDummy}ms`);
    }
  }

  /**
   * Hashes a plaintext password using Argon2id with OWASP 2024 params.
   * The pepper is appended before hashing for defense in depth.
   *
   * Performance : ~200-500 ms on 8GB RAM x86_64 (target zone OWASP 2024).
   */
  async hash(plaintext: string): Promise<string> {
    if (!plaintext || typeof plaintext !== 'string') {
      throw new Error('Argon2Service.hash: plaintext must be a non-empty string');
    }
    if (plaintext.length > PASSWORD_POLICY.maxLength) {
      throw new Error(
        `Argon2Service.hash: plaintext exceeds maxLength (${PASSWORD_POLICY.maxLength})`,
      );
    }

    const peppered = this.applyPepper(plaintext);
    return argon2Hash(peppered, {
      algorithm: ARGON2ID,
      memoryCost: ARGON2_PARAMS.memoryCost,
      timeCost: ARGON2_PARAMS.timeCost,
      parallelism: ARGON2_PARAMS.parallelism,
      outputLen: ARGON2_PARAMS.hashLength,
    });
  }

  /**
   * Verifies a plaintext password against a stored Argon2id hash.
   * Returns false (does NOT throw) for malformed hashes to defend against DB corruption attacks.
   */
  async verify(storedHash: string, plaintext: string): Promise<boolean> {
    if (!storedHash || !plaintext) return false;

    try {
      const peppered = this.applyPepper(plaintext);
      return await argon2Verify(storedHash, peppered);
    } catch (err: unknown) {
      this.logger.error(
        {
          err: err instanceof Error ? err.message : String(err),
          action: 'argon2_verify_error',
        },
        'Argon2 verify threw unexpectedly -- possible hash corruption or attack',
      );
      return false;
    }
  }

  /**
   * Equalizes timing for non-existent user. Call this when user lookup returns null
   * to prevent timing-based user enumeration.
   */
  async verifyEmptyForTiming(plaintext: string = 'irrelevant'): Promise<boolean> {
    if (DUMMY_HASH === null) return false;
    try {
      await argon2Verify(DUMMY_HASH, this.applyPepper(plaintext));
    } catch {
      // ignore -- timing equalization always returns false
    }
    return false;
  }

  /**
   * Detects whether a stored hash uses weaker params than the current ARGON2_PARAMS.
   * Used to silently upgrade hashes at next successful login.
   */
  needsRehash(storedHash: string): boolean {
    const parsed = parseArgon2Hash(storedHash);
    if (!parsed) return true;
    return !compareArgon2Params(parsed, ARGON2_PARAMS);
  }

  /**
   * Applies password policy : length, character classes, banlist, similarity to identifiers.
   */
  validatePolicy(plaintext: string, context: PolicyValidationContext = {}): PasswordPolicyResult {
    const reasons: PasswordPolicyReason[] = [];

    if (plaintext.length < PASSWORD_POLICY.minLength) reasons.push('too_short');
    if (plaintext.length > PASSWORD_POLICY.maxLength) reasons.push('too_long');

    if (PASSWORD_POLICY.requireUppercase && !/[A-Z]/.test(plaintext)) {
      reasons.push('missing_uppercase');
    }
    if (PASSWORD_POLICY.requireLowercase && !/[a-z]/.test(plaintext)) {
      reasons.push('missing_lowercase');
    }
    if (PASSWORD_POLICY.requireDigit && !/\d/.test(plaintext)) {
      reasons.push('missing_digit');
    }
    if (
      PASSWORD_POLICY.requireSpecial &&
      !/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(plaintext)
    ) {
      reasons.push('missing_special');
    }

    if (PASSWORD_POLICY.banlistEnabled && this.banlist?.has(normalizePasswordForBanlist(plaintext))) {
      reasons.push('banned');
    }

    if (context.email) {
      const localPart = context.email.split('@')[0]?.toLowerCase() ?? '';
      const lowerPwd = plaintext.toLowerCase();
      if (
        PASSWORD_POLICY.rejectIfContainsEmailLocal &&
        localPart.length >= 3 &&
        lowerPwd.includes(localPart)
      ) {
        reasons.push('contains_email_local');
      }
      if (
        localPart.length > 0 &&
        levenshteinDistance(lowerPwd, localPart) <= PASSWORD_POLICY.similarityThreshold
      ) {
        reasons.push('similar_to_email');
      }
    }

    if (context.display_name) {
      const lowerName = context.display_name.toLowerCase().replace(/\s+/g, '');
      const lowerPwd = plaintext.toLowerCase();
      if (
        PASSWORD_POLICY.rejectIfContainsDisplayName &&
        lowerName.length >= 3 &&
        lowerPwd.includes(lowerName)
      ) {
        reasons.push('contains_display_name');
      }
      if (
        lowerName.length > 0 &&
        levenshteinDistance(lowerPwd, lowerName) <= PASSWORD_POLICY.similarityThreshold
      ) {
        reasons.push('similar_to_display_name');
      }
    }

    if (reasons.length === 0) return { valid: true };
    return { valid: false, reasons };
  }

  /**
   * Generates a 10-character alphanumeric uppercase recovery code.
   * Excludes easily confused chars (0, O, 1, I, L).
   */
  generateRecoveryCode(): string {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let out = '';
    for (let i = 0; i < 10; i += 1) {
      out += chars[randomInt(0, chars.length)];
    }
    return out;
  }

  /** Generates a batch of N unique recovery codes (default 6). */
  generateRecoveryCodeBatch(count: number = 6): string[] {
    if (count < 1 || count > 20) {
      throw new Error(
        `Argon2Service.generateRecoveryCodeBatch: count must be 1..20, got ${count}`,
      );
    }
    const out = new Set<string>();
    while (out.size < count) {
      out.add(this.generateRecoveryCode());
    }
    return Array.from(out);
  }

  /** Constant-time comparison of two strings via node:crypto.timingSafeEqual. */
  timingSafeStringEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a, 'utf-8');
    const bufB = Buffer.from(b, 'utf-8');
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  }

  private applyPepper(plaintext: string): string {
    const pepper = this.pepperService.getCurrentPepper();
    return `${plaintext}${pepper}`;
  }
}
