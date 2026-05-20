/**
 * @insurtech/auth/services/hashing
 *
 * SHA-256 (FIPS 180-4) + HMAC-SHA-256 (RFC 2104) + CSPRNG token generation.
 *
 * Used by :
 *   - Tache 2.1.4 JwtService (hash refresh tokens for Redis storage)
 *   - Tache 2.1.7 MfaService (random challenge/setup tokens)
 *   - Sprint 9+ Comm (HMAC verify Meta WhatsApp webhook signatures)
 *   - Sprint 11+ Pay (HMAC verify CMI / Maroc Telecommerce webhooks)
 *   - Sprint 12 Audit (HMAC sign Kafka events)
 */

import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

@Injectable()
export class HashingService implements OnModuleInit {
  private readonly logger = new Logger(HashingService.name);

  onModuleInit(): void {
    randomBytes(16);
    this.logger.log({ action: 'hashing_service_initialized' });
  }

  /** SHA-256 hex digest of a UTF-8 string. Returns 64-char hex. */
  sha256(input: string): string {
    return createHash('sha256').update(input, 'utf-8').digest('hex');
  }

  /** SHA-256 hex digest of a Buffer. */
  sha256Buffer(input: Buffer): string {
    return createHash('sha256').update(input).digest('hex');
  }

  /** SHA-256 raw Buffer digest (for chaining with other crypto ops). */
  sha256Raw(input: string | Buffer): Buffer {
    const h = createHash('sha256');
    if (typeof input === 'string') h.update(input, 'utf-8');
    else h.update(input);
    return h.digest();
  }

  /**
   * HMAC-SHA-256 hex digest.
   * @param key - secret key (NIST SP 800-117 recommends >= 32 bytes; warning logged otherwise)
   */
  hmacSha256(input: string, key: string | Buffer): string {
    const keyBuf = typeof key === 'string' ? Buffer.from(key, 'utf-8') : key;
    if (keyBuf.length < 32) {
      this.logger.warn(
        { action: 'hmac_short_key', key_length: keyBuf.length },
        'HMAC-SHA-256 key is shorter than 32 bytes (NIST SP 800-117 recommendation)',
      );
    }
    return createHmac('sha256', keyBuf).update(input, 'utf-8').digest('hex');
  }

  /** HMAC-SHA-256 raw Buffer digest. */
  hmacSha256Raw(input: string | Buffer, key: string | Buffer): Buffer {
    const keyBuf = typeof key === 'string' ? Buffer.from(key, 'utf-8') : key;
    const h = createHmac('sha256', keyBuf);
    if (typeof input === 'string') h.update(input, 'utf-8');
    else h.update(input);
    return h.digest();
  }

  /**
   * Generates a CSPRNG random token in base64url format (URL-safe, no padding).
   * @param byteLength - number of random bytes (default 32 -> ~43 base64url chars)
   */
  randomToken(byteLength: number = 32): string {
    if (!Number.isInteger(byteLength) || byteLength < 8 || byteLength > 256) {
      throw new Error(
        `HashingService.randomToken: byteLength must be 8..256, got ${byteLength}`,
      );
    }
    return randomBytes(byteLength).toString('base64url');
  }

  /** Generates a CSPRNG random hex string of the given byte length. */
  randomHex(byteLength: number = 16): string {
    if (!Number.isInteger(byteLength) || byteLength < 4 || byteLength > 64) {
      throw new Error(
        `HashingService.randomHex: byteLength must be 4..64, got ${byteLength}`,
      );
    }
    return randomBytes(byteLength).toString('hex');
  }

  /** Constant-time string comparison. Returns false for different lengths. */
  timingSafeEqualString(a: string, b: string): boolean {
    const bufA = Buffer.from(a, 'utf-8');
    const bufB = Buffer.from(b, 'utf-8');
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  }

  /** Constant-time Buffer comparison (wraps crypto.timingSafeEqual). */
  timingSafeEqualBuffer(a: Buffer, b: Buffer): boolean {
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }
}
