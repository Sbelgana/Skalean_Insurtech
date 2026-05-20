/**
 * @insurtech/auth/services/crypto.helpers
 *
 * Pure helpers used by EncryptionService. Exported for unit tests.
 */

import type { EncryptedPayload } from '../types/encrypted-payload.js';

const SEPARATOR = ':';
const IV_LEN = 12;
const TAG_LEN = 16;

export function serializeEncryptedFormat(payload: EncryptedPayload): string {
  return [
    payload.iv.toString('base64url'),
    payload.ciphertext.toString('base64url'),
    payload.authTag.toString('base64url'),
  ].join(SEPARATOR);
}

export function parseEncryptedFormat(input: string): EncryptedPayload | null {
  if (typeof input !== 'string' || input.length === 0) return null;
  const parts = input.split(SEPARATOR);
  if (parts.length !== 3) return null;
  const ivB64 = parts[0];
  const ctB64 = parts[1];
  const tagB64 = parts[2];
  if (!ivB64 || !ctB64 || !tagB64) return null;

  let iv: Buffer;
  let ciphertext: Buffer;
  let authTag: Buffer;
  try {
    iv = Buffer.from(ivB64, 'base64url');
    ciphertext = Buffer.from(ctB64, 'base64url');
    authTag = Buffer.from(tagB64, 'base64url');
  } catch {
    return null;
  }
  if (iv.length !== IV_LEN) return null;
  if (authTag.length !== TAG_LEN) return null;
  if (ciphertext.length === 0) return null;

  return { iv, ciphertext, authTag };
}

/**
 * Throws if buffer length is not exactly expectedBytes.
 * Sanitized error message (does NOT leak the buffer content).
 */
export function assertKeyLength(buf: Buffer, expectedBytes: number, name: string): void {
  if (buf.length !== expectedBytes) {
    throw new Error(
      `${name}: invalid length (got ${buf.length} bytes, expected ${expectedBytes})`,
    );
  }
}

/**
 * Decodes a key env var into a Buffer. Accepts hex / base64 / base64url / raw utf-8 of the right byte length.
 */
export function decodeKey(raw: string, expectedBytes: number): Buffer {
  if (/^[0-9a-fA-F]+$/.test(raw) && raw.length === expectedBytes * 2) {
    return Buffer.from(raw, 'hex');
  }
  if (/^[A-Za-z0-9+/]+=*$/.test(raw)) {
    const b = Buffer.from(raw, 'base64');
    if (b.length === expectedBytes) return b;
  }
  if (/^[A-Za-z0-9_-]+$/.test(raw)) {
    const b = Buffer.from(raw, 'base64url');
    if (b.length === expectedBytes) return b;
  }
  if (raw.length === expectedBytes) {
    return Buffer.from(raw, 'utf-8');
  }
  throw new Error(
    `decodeKey: input not recognized. Expected ${expectedBytes}-byte key as ${expectedBytes * 2} hex chars, ${Math.ceil((expectedBytes * 4) / 3)} base64 chars, or ${expectedBytes}-byte raw string.`,
  );
}
