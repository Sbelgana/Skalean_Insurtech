/**
 * @insurtech/auth/services/encryption
 *
 * AES-256-GCM authenticated encryption service.
 * NIST SP 800-38D compliant. Used to encrypt MFA secrets at rest (Sprint 5 Tache 2.1.7)
 * and other reversible symmetric encryption needs.
 *
 * Key management :
 *   - Sprint 5 : MFA_SECRET_ENCRYPTION_KEY env (32 bytes after decode)
 *   - Sprint 14 : rotation v1 -> v2 via rotateKey()
 *   - Sprint 35 : migrated to Atlas Cloud Services KMS Benguerir HSM
 *
 * Output format : `<iv-base64url>:<ciphertext-base64url>:<authTag-base64url>`
 *   - iv  : 12 bytes (96 bits) random per call (NEVER reuse with same key)
 *   - ct  : variable length
 *   - tag : 16 bytes (128 bits) integrity authenticator
 */

import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import {
  assertKeyLength,
  decodeKey,
  parseEncryptedFormat,
  serializeEncryptedFormat,
} from './crypto.helpers.js';
import type { EncryptedString } from '../types/encrypted-payload.js';

const ALGORITHM = 'aes-256-gcm' as const;
const KEY_LENGTH_BYTES = 32 as const;
const IV_LENGTH_BYTES = 12 as const;
const AUTH_TAG_LENGTH_BYTES = 16 as const;

@Injectable()
export class EncryptionService implements OnModuleInit {
  private readonly logger = new Logger(EncryptionService.name);
  private key: Buffer | null = null;

  onModuleInit(): void {
    const raw = process.env['MFA_SECRET_ENCRYPTION_KEY'];
    if (!raw) {
      throw new Error('EncryptionService: MFA_SECRET_ENCRYPTION_KEY env var is required');
    }
    const decoded = decodeKey(raw, KEY_LENGTH_BYTES);
    assertKeyLength(decoded, KEY_LENGTH_BYTES, 'MFA_SECRET_ENCRYPTION_KEY');
    this.key = decoded;
    randomBytes(16);
    this.logger.log({
      action: 'encryption_key_loaded',
      algorithm: ALGORITHM,
      key_bytes: KEY_LENGTH_BYTES,
    });
  }

  /**
   * Encrypts plaintext with AES-256-GCM. Optional AAD binds ciphertext to context.
   */
  encrypt(plaintext: string, aad?: string): EncryptedString {
    if (this.key === null) {
      throw new Error('EncryptionService: not initialized -- call onModuleInit first');
    }
    const iv = randomBytes(IV_LENGTH_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv, {
      authTagLength: AUTH_TAG_LENGTH_BYTES,
    });
    if (aad !== undefined) {
      cipher.setAAD(Buffer.from(aad, 'utf-8'));
    }
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return serializeEncryptedFormat({ iv, ciphertext, authTag }) as EncryptedString;
  }

  /**
   * Decrypts a ciphertext produced by encrypt(). Verifies authTag and AAD.
   * @throws Error if authTag invalid (tampered ciphertext, wrong key, or wrong AAD)
   */
  decrypt(encrypted: EncryptedString | string, aad?: string): string {
    if (this.key === null) {
      throw new Error('EncryptionService: not initialized');
    }
    const parsed = parseEncryptedFormat(encrypted);
    if (parsed === null) {
      throw new Error('EncryptionService.decrypt: invalid encrypted format');
    }
    const { iv, ciphertext, authTag } = parsed;
    const decipher = createDecipheriv(ALGORITHM, this.key, iv, {
      authTagLength: AUTH_TAG_LENGTH_BYTES,
    });
    decipher.setAuthTag(authTag);
    if (aad !== undefined) {
      decipher.setAAD(Buffer.from(aad, 'utf-8'));
    }
    try {
      const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      return plaintext.toString('utf-8');
    } catch {
      this.logger.warn(
        { action: 'decrypt_auth_failed' },
        'AES-GCM authentication failed (tamper or wrong key/AAD)',
      );
      throw new Error(
        'EncryptionService.decrypt: authentication failed (ciphertext tampered or wrong key/AAD)',
      );
    }
  }

  /**
   * Re-encrypts a ciphertext with a new key, validating authenticity with the old key first.
   * Sprint 14 key rotation.
   */
  rotateKey(
    oldKey: Buffer,
    newKey: Buffer,
    encrypted: EncryptedString | string,
    aad?: string,
  ): EncryptedString {
    assertKeyLength(oldKey, KEY_LENGTH_BYTES, 'oldKey');
    assertKeyLength(newKey, KEY_LENGTH_BYTES, 'newKey');

    const parsed = parseEncryptedFormat(encrypted);
    if (parsed === null) throw new Error('rotateKey: invalid encrypted format');
    const { iv: oldIv, ciphertext: oldCt, authTag: oldTag } = parsed;

    const decipher = createDecipheriv(ALGORITHM, oldKey, oldIv, {
      authTagLength: AUTH_TAG_LENGTH_BYTES,
    });
    decipher.setAuthTag(oldTag);
    if (aad !== undefined) decipher.setAAD(Buffer.from(aad, 'utf-8'));
    const plaintext = Buffer.concat([decipher.update(oldCt), decipher.final()]);

    const newIv = randomBytes(IV_LENGTH_BYTES);
    const cipher = createCipheriv(ALGORITHM, newKey, newIv, {
      authTagLength: AUTH_TAG_LENGTH_BYTES,
    });
    if (aad !== undefined) cipher.setAAD(Buffer.from(aad, 'utf-8'));
    const newCt = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const newTag = cipher.getAuthTag();

    return serializeEncryptedFormat({
      iv: newIv,
      ciphertext: newCt,
      authTag: newTag,
    }) as EncryptedString;
  }

  /**
   * Returns the current key (for tests / rotation only).
   * NEVER expose to user-facing code.
   */
  getKeyForRotation(): Buffer {
    if (this.key === null) throw new Error('EncryptionService: not initialized');
    return Buffer.from(this.key);
  }
}
