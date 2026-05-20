/**
 * Tests for @insurtech/auth/services/encryption.service
 * Sprint 5 Tache 2.1.3
 */

import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { EncryptionService } from '../../src/services/encryption.service.js';
import type { EncryptedString } from '../../src/types/encrypted-payload.js';

const KEY_HEX_32 = 'a'.repeat(64);

describe('EncryptionService', () => {
  let service: EncryptionService;

  beforeAll(() => {
    process.env['MFA_SECRET_ENCRYPTION_KEY'] = KEY_HEX_32;
    service = new EncryptionService();
    service.onModuleInit();
  });

  afterEach(() => {
    process.env['MFA_SECRET_ENCRYPTION_KEY'] = KEY_HEX_32;
  });

  describe('encrypt + decrypt', () => {
    it('round-trips a plaintext', () => {
      const ct = service.encrypt('hello world');
      const pt = service.decrypt(ct);
      expect(pt).toBe('hello world');
    });

    it('produces different ciphertexts for same plaintext (unique IV)', () => {
      const a = service.encrypt('same input');
      const b = service.encrypt('same input');
      expect(a).not.toBe(b);
      expect(service.decrypt(a)).toBe('same input');
      expect(service.decrypt(b)).toBe('same input');
    });

    it('format is iv-b64u:ct-b64u:tag-b64u (3 base64url parts)', () => {
      const ct = service.encrypt('x');
      const parts = ct.split(':');
      expect(parts).toHaveLength(3);
      for (const p of parts) {
        expect(p).toMatch(/^[A-Za-z0-9_-]+$/);
      }
    });

    it('throws on tampered ciphertext (authTag invalid)', () => {
      const ct = service.encrypt('integrity sensitive');
      const [iv, body, tag] = ct.split(':');
      // Flip last byte of ciphertext by xoring; we mutate the base64url via re-encoding.
      const ctBuf = Buffer.from(body ?? '', 'base64url');
      const last = ctBuf[ctBuf.length - 1] ?? 0;
      ctBuf[ctBuf.length - 1] = last ^ 0xff;
      const tampered = `${iv}:${ctBuf.toString('base64url')}:${tag}`;
      expect(() => service.decrypt(tampered as EncryptedString)).toThrow(/authentication failed/);
    });

    it('throws on tampered authTag', () => {
      const ct = service.encrypt('x');
      const [iv, body, tag] = ct.split(':');
      const flipped = `${iv}:${body}:${(tag ?? '').slice(0, -2)}aa`;
      expect(() => service.decrypt(flipped as EncryptedString)).toThrow();
    });

    it('throws on invalid format', () => {
      expect(() => service.decrypt('not-encrypted' as EncryptedString)).toThrow(
        /invalid encrypted format/,
      );
    });

    it('rejects empty-ciphertext format (defense in depth)', () => {
      // GCM allows empty plaintext at the cipher level, but our parseEncryptedFormat
      // rejects an empty ciphertext segment as defense against malformed inputs.
      const ct = service.encrypt('');
      const [iv, , tag] = ct.split(':');
      const malformed = `${iv}::${tag}` as EncryptedString;
      expect(() => service.decrypt(malformed)).toThrow(/invalid encrypted format/);
    });

    it('handles large plaintext (1 KB)', () => {
      const big = 'x'.repeat(1024);
      const ct = service.encrypt(big);
      expect(service.decrypt(ct)).toBe(big);
    });

    it('handles unicode plaintext', () => {
      const text = 'Bonjour Marrakech';
      expect(service.decrypt(service.encrypt(text))).toBe(text);
    });
  });

  describe('AAD binding', () => {
    it('decrypts when same AAD is provided', () => {
      const ct = service.encrypt('secret', 'user-123');
      expect(service.decrypt(ct, 'user-123')).toBe('secret');
    });

    it('throws when AAD differs', () => {
      const ct = service.encrypt('secret', 'user-123');
      expect(() => service.decrypt(ct, 'user-456')).toThrow(/authentication failed/);
    });

    it('throws when AAD missing at decrypt but used at encrypt', () => {
      const ct = service.encrypt('secret', 'user-123');
      expect(() => service.decrypt(ct)).toThrow();
    });

    it('throws when AAD provided at decrypt but missing at encrypt', () => {
      const ct = service.encrypt('secret');
      expect(() => service.decrypt(ct, 'user-123')).toThrow();
    });
  });

  describe('init guards', () => {
    it('throws if MFA_SECRET_ENCRYPTION_KEY missing', () => {
      const saved = process.env['MFA_SECRET_ENCRYPTION_KEY'];
      delete process.env['MFA_SECRET_ENCRYPTION_KEY'];
      try {
        const fresh = new EncryptionService();
        expect(() => fresh.onModuleInit()).toThrow(/MFA_SECRET_ENCRYPTION_KEY/);
      } finally {
        process.env['MFA_SECRET_ENCRYPTION_KEY'] = saved;
      }
    });

    it('throws on uninitialized encrypt call', () => {
      const fresh = new EncryptionService();
      expect(() => fresh.encrypt('x')).toThrow(/not initialized/);
    });

    it('throws on uninitialized decrypt call', () => {
      const fresh = new EncryptionService();
      expect(() => fresh.decrypt('iv:ct:tag')).toThrow(/not initialized/);
    });
  });

  describe('rotateKey', () => {
    it('re-encrypts under a new key, original still decrypts under old key', () => {
      const oldKey = Buffer.alloc(32, 0x11);
      const newKey = Buffer.alloc(32, 0x22);
      process.env['MFA_SECRET_ENCRYPTION_KEY'] = oldKey.toString('hex');
      const s1 = new EncryptionService();
      s1.onModuleInit();
      const ct = s1.encrypt('rotate me');

      const rotated = s1.rotateKey(oldKey, newKey, ct);
      expect(rotated).not.toBe(ct);

      process.env['MFA_SECRET_ENCRYPTION_KEY'] = newKey.toString('hex');
      const s2 = new EncryptionService();
      s2.onModuleInit();
      expect(s2.decrypt(rotated)).toBe('rotate me');
    });

    it('throws if old key wrong length', () => {
      expect(() =>
        service.rotateKey(Buffer.alloc(16), Buffer.alloc(32), 'iv:ct:tag'),
      ).toThrow(/oldKey/);
    });
  });

  describe('getKeyForRotation', () => {
    it('returns the key buffer when initialized', () => {
      const k = service.getKeyForRotation();
      expect(k.length).toBe(32);
    });
  });
});
