import type { ValueTransformer } from 'typeorm';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm' as const;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;

function getKey(envKeyName: string): Buffer {
  const hex = process.env[envKeyName];
  if (!hex) {
    throw new Error(`Encryption key env var "${envKeyName}" is not set`);
  }
  const buf = Buffer.from(hex, 'hex');
  if (buf.length !== KEY_BYTES) {
    throw new Error(
      `Encryption key "${envKeyName}" must be ${KEY_BYTES} bytes (${KEY_BYTES * 2} hex chars), got ${buf.length}`,
    );
  }
  return buf;
}

export function createEncryptedColumnTransformer(envKeyName: string): ValueTransformer {
  return {
    to(plaintext: string | null | undefined): string | null {
      if (plaintext === null || plaintext === undefined) {
        return null;
      }
      const key = getKey(envKeyName);
      const iv = randomBytes(IV_BYTES);
      const cipher = createCipheriv(ALGORITHM, key, iv);
      const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
      const tag = cipher.getAuthTag();
      return `${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
    },
    from(ciphertext: string | null | undefined): string | null {
      if (ciphertext === null || ciphertext === undefined) {
        return null;
      }
      const parts = ciphertext.split(':');
      if (parts.length !== 3) {
        throw new Error('EncryptedColumnTransformer: invalid ciphertext format (expected iv:tag:enc)');
      }
      const iv = Buffer.from(parts[0] ?? '', 'base64');
      const tag = Buffer.from(parts[1] ?? '', 'base64');
      const enc = Buffer.from(parts[2] ?? '', 'base64');
      if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
        throw new Error('EncryptedColumnTransformer: invalid iv or tag length');
      }
      const key = getKey(envKeyName);
      const decipher = createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
    },
  };
}
