/**
 * Tests for @insurtech/auth/services/crypto.helpers
 * Sprint 5 Tache 2.1.3
 */

import { describe, expect, it } from 'vitest';
import {
  assertKeyLength,
  decodeKey,
  parseEncryptedFormat,
  serializeEncryptedFormat,
} from '../../src/services/crypto.helpers.js';

describe('serializeEncryptedFormat + parseEncryptedFormat', () => {
  it('round-trips a payload', () => {
    const payload = {
      iv: Buffer.alloc(12, 0x01),
      ciphertext: Buffer.alloc(32, 0xab),
      authTag: Buffer.alloc(16, 0x02),
    };
    const s = serializeEncryptedFormat(payload);
    expect(s.split(':')).toHaveLength(3);
    const parsed = parseEncryptedFormat(s);
    expect(parsed).not.toBeNull();
    expect(parsed?.iv.equals(payload.iv)).toBe(true);
    expect(parsed?.ciphertext.equals(payload.ciphertext)).toBe(true);
    expect(parsed?.authTag.equals(payload.authTag)).toBe(true);
  });

  it('returns null on malformed input', () => {
    expect(parseEncryptedFormat('')).toBeNull();
    expect(parseEncryptedFormat('only-one-part')).toBeNull();
    expect(parseEncryptedFormat('a:b')).toBeNull();
    expect(parseEncryptedFormat('a:b:c:d')).toBeNull();
  });

  it('returns null on wrong iv length', () => {
    const badIv = serializeEncryptedFormat({
      iv: Buffer.alloc(8, 0x01),
      ciphertext: Buffer.alloc(32, 0xab),
      authTag: Buffer.alloc(16, 0x02),
    });
    expect(parseEncryptedFormat(badIv)).toBeNull();
  });

  it('returns null on wrong tag length', () => {
    const badTag = serializeEncryptedFormat({
      iv: Buffer.alloc(12, 0x01),
      ciphertext: Buffer.alloc(32, 0xab),
      authTag: Buffer.alloc(12, 0x02),
    });
    expect(parseEncryptedFormat(badTag)).toBeNull();
  });
});

describe('assertKeyLength', () => {
  it('passes for correct length', () => {
    expect(() => assertKeyLength(Buffer.alloc(32), 32, 'key')).not.toThrow();
  });

  it('throws with helpful message for wrong length', () => {
    expect(() => assertKeyLength(Buffer.alloc(10), 32, 'KEY_X')).toThrow(
      /KEY_X: invalid length \(got 10 bytes, expected 32\)/,
    );
  });
});

describe('decodeKey', () => {
  it('decodes 64 hex chars to 32 bytes', () => {
    const hex = 'a'.repeat(64);
    const b = decodeKey(hex, 32);
    expect(b.length).toBe(32);
  });

  it('decodes base64 of 32 bytes', () => {
    const b = Buffer.alloc(32, 0x12);
    const b64 = b.toString('base64');
    expect(decodeKey(b64, 32).equals(b)).toBe(true);
  });

  it('decodes base64url of 32 bytes', () => {
    const b = Buffer.alloc(32, 0x34);
    const b64u = b.toString('base64url');
    expect(decodeKey(b64u, 32).equals(b)).toBe(true);
  });

  it('throws on unrecognized format', () => {
    expect(() => decodeKey('a'.repeat(7), 32)).toThrow(/not recognized/);
  });
});
