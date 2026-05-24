/**
 * Tests EncryptedColumnTransformer (Sprint 2 -- foundation for Sprint 8.10).
 *
 * AES-256-GCM round-trip + tampering detection + IV uniqueness.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createEncryptedColumnTransformer } from './encrypted-column.transformer.js';

const ENV_KEY = 'TEST_ENCRYPTION_KEY_8_10_SPEC';
// Test-only AES-256 key (32 bytes hex = 64 hex chars). Different from production key.
const TEST_KEY_HEX = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2';

describe('EncryptedColumnTransformer (Sprint 2 / Task 8.10 foundation)', () => {
  let previousKey: string | undefined;

  beforeEach(() => {
    previousKey = process.env[ENV_KEY];
    process.env[ENV_KEY] = TEST_KEY_HEX;
  });

  afterEach(() => {
    if (previousKey === undefined) {
      delete process.env[ENV_KEY];
    } else {
      process.env[ENV_KEY] = previousKey;
    }
  });

  describe('round-trip', () => {
    it('1. encrypts then decrypts to original plaintext', () => {
      const t = createEncryptedColumnTransformer(ENV_KEY);
      const ct = t.to('Hello Bennani 2026');
      expect(ct).toBeTruthy();
      expect(ct).not.toContain('Bennani');
      const back = t.from(ct as string);
      expect(back).toBe('Hello Bennani 2026');
    });

    it('2. encrypts long OAuth-like token (1KB)', () => {
      const t = createEncryptedColumnTransformer(ENV_KEY);
      const longToken = 'ya29.' + 'a'.repeat(1000);
      const ct = t.to(longToken);
      const back = t.from(ct as string);
      expect(back).toBe(longToken);
    });

    it('3. preserves UTF-8 multibyte chars (CRM customers names)', () => {
      const t = createEncryptedColumnTransformer(ENV_KEY);
      const plaintext = 'Mohamed بن نسرين -- العربية';
      const ct = t.to(plaintext);
      const back = t.from(ct as string);
      expect(back).toBe(plaintext);
    });
  });

  describe('format', () => {
    it('4. ciphertext format is iv_b64:tag_b64:enc_b64 (3 colon-delimited parts)', () => {
      const t = createEncryptedColumnTransformer(ENV_KEY);
      const ct = t.to('test') as string;
      const parts = ct.split(':');
      expect(parts).toHaveLength(3);
      // Each part is base64-encoded
      for (const p of parts) {
        expect(p).toMatch(/^[A-Za-z0-9+/]+=*$/);
      }
    });

    it('5. IV is unique across encryptions of same plaintext (no determinism)', () => {
      const t = createEncryptedColumnTransformer(ENV_KEY);
      const ct1 = t.to('same plaintext') as string;
      const ct2 = t.to('same plaintext') as string;
      expect(ct1).not.toBe(ct2);
      // IV part is the first segment
      expect(ct1.split(':')[0]).not.toBe(ct2.split(':')[0]);
    });
  });

  describe('null handling', () => {
    it('6. to(null) returns null (no encryption attempt)', () => {
      const t = createEncryptedColumnTransformer(ENV_KEY);
      expect(t.to(null)).toBeNull();
    });

    it('7. to(undefined) returns null', () => {
      const t = createEncryptedColumnTransformer(ENV_KEY);
      expect(t.to(undefined)).toBeNull();
    });

    it('8. from(null) returns null', () => {
      const t = createEncryptedColumnTransformer(ENV_KEY);
      expect(t.from(null)).toBeNull();
    });
  });

  describe('tampering detection (AES-GCM authenticated)', () => {
    it('9. tampered ciphertext throws on decrypt', () => {
      const t = createEncryptedColumnTransformer(ENV_KEY);
      const ct = t.to('original') as string;
      const parts = ct.split(':');
      // Flip last byte of encrypted part
      const enc = Buffer.from(parts[2] ?? '', 'base64');
      enc[enc.length - 1] = enc[enc.length - 1]! ^ 0xff;
      const tampered = `${parts[0]}:${parts[1]}:${enc.toString('base64')}`;
      expect(() => t.from(tampered)).toThrow();
    });

    it('10. tampered IV throws on decrypt', () => {
      const t = createEncryptedColumnTransformer(ENV_KEY);
      const ct = t.to('original') as string;
      const parts = ct.split(':');
      const iv = Buffer.from(parts[0] ?? '', 'base64');
      iv[0] = iv[0]! ^ 0xff;
      const tampered = `${iv.toString('base64')}:${parts[1]}:${parts[2]}`;
      expect(() => t.from(tampered)).toThrow();
    });

    it('11. tampered auth tag throws on decrypt', () => {
      const t = createEncryptedColumnTransformer(ENV_KEY);
      const ct = t.to('original') as string;
      const parts = ct.split(':');
      const tag = Buffer.from(parts[1] ?? '', 'base64');
      tag[0] = tag[0]! ^ 0xff;
      const tampered = `${parts[0]}:${tag.toString('base64')}:${parts[2]}`;
      expect(() => t.from(tampered)).toThrow();
    });
  });

  describe('format validation', () => {
    it('12. invalid format (no colons) throws', () => {
      const t = createEncryptedColumnTransformer(ENV_KEY);
      expect(() => t.from('not_a_valid_ciphertext')).toThrow(
        /invalid ciphertext format/i,
      );
    });

    it('13. invalid format (2 colons) throws', () => {
      const t = createEncryptedColumnTransformer(ENV_KEY);
      expect(() => t.from('a:b')).toThrow(/invalid ciphertext format/i);
    });

    it('14. wrong IV length throws', () => {
      const t = createEncryptedColumnTransformer(ENV_KEY);
      // Provide a base64 string that decodes to wrong number of bytes for IV
      const shortIv = Buffer.from([1, 2, 3]).toString('base64');
      const validTag = Buffer.alloc(16).toString('base64');
      const validEnc = Buffer.alloc(8).toString('base64');
      expect(() => t.from(`${shortIv}:${validTag}:${validEnc}`)).toThrow();
    });
  });

  describe('key validation', () => {
    it('15. missing env var throws on encrypt', () => {
      const t = createEncryptedColumnTransformer('NON_EXISTENT_KEY_8_10');
      expect(() => t.to('x')).toThrow(/not set/i);
    });

    it('16. wrong key size throws on encrypt', () => {
      process.env['SHORT_KEY_8_10'] = 'abcd'; // 2 bytes, not 32
      const t = createEncryptedColumnTransformer('SHORT_KEY_8_10');
      expect(() => t.to('x')).toThrow(/must be 32 bytes/i);
      delete process.env['SHORT_KEY_8_10'];
    });

    it('17. different key cannot decrypt ciphertext from another key', () => {
      const tA = createEncryptedColumnTransformer(ENV_KEY);
      const ct = tA.to('secret') as string;
      // Swap the key
      process.env[ENV_KEY] =
        'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
      const tB = createEncryptedColumnTransformer(ENV_KEY);
      expect(() => tB.from(ct)).toThrow();
      process.env[ENV_KEY] = TEST_KEY_HEX; // restore for afterEach
    });
  });
});
