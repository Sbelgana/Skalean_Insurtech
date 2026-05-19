import type { ValueTransformer } from 'typeorm';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm' as const;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;
const ENV_KEY_NAME = 'PAY_CONFIG_ENCRYPTION_KEY';

function getKey(): Buffer {
  const hex = process.env[ENV_KEY_NAME];
  if (!hex) {
    const fallback = '0'.repeat(KEY_BYTES * 2);
    return Buffer.from(fallback, 'hex');
  }
  const buf = Buffer.from(hex, 'hex');
  if (buf.length !== KEY_BYTES) {
    throw new Error(
      `Encryption key "${ENV_KEY_NAME}" must be ${KEY_BYTES} bytes (${KEY_BYTES * 2} hex chars), got ${buf.length}`,
    );
  }
  return buf;
}

export class EncryptedJsonbTransformer implements ValueTransformer {
  to(value: Record<string, unknown> | null | undefined): string | null {
    if (value === null || value === undefined) {
      return null;
    }
    const plaintext = JSON.stringify(value);
    const key = getKey();
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
  }

  from(value: string | null | undefined): Record<string, unknown> | null {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value === 'object') {
      return value as Record<string, unknown>;
    }
    const parts = (value as string).split(':');
    if (parts.length !== 3) {
      throw new Error('EncryptedJsonbTransformer: invalid ciphertext format (expected iv:tag:enc)');
    }
    const iv = Buffer.from(parts[0] ?? '', 'base64');
    const tag = Buffer.from(parts[1] ?? '', 'base64');
    const enc = Buffer.from(parts[2] ?? '', 'base64');
    if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
      throw new Error('EncryptedJsonbTransformer: invalid iv or tag length');
    }
    const key = getKey();
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
    return JSON.parse(plaintext) as Record<string, unknown>;
  }
}
