/**
 * Cross-service integration tests for EncryptionService + HashingService.
 * Sprint 5 Tache 2.1.3
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { EncryptionService } from '../../src/services/encryption.service.js';
import { HashingService } from '../../src/services/hashing.service.js';

describe('Crypto integration (Encryption + Hashing)', () => {
  let enc: EncryptionService;
  let hash: HashingService;

  beforeAll(() => {
    process.env['MFA_SECRET_ENCRYPTION_KEY'] = 'a'.repeat(64);
    enc = new EncryptionService();
    enc.onModuleInit();
    hash = new HashingService();
    hash.onModuleInit();
  });

  it('encrypts MFA secret then hashes ciphertext for index lookups', () => {
    const secret = 'JBSWY3DPEHPK3PXP';
    const ciphertext = enc.encrypt(secret, 'user-123');
    const ctHash = hash.sha256(ciphertext);
    expect(ctHash).toHaveLength(64);
    expect(enc.decrypt(ciphertext, 'user-123')).toBe(secret);
  });

  it('round-trips refresh token : random -> hash for Redis storage', () => {
    const refresh = hash.randomToken(32);
    const refreshHash = hash.sha256(refresh);
    expect(refreshHash).toHaveLength(64);
    expect(hash.sha256(refresh)).toBe(refreshHash);
  });

  it('HMAC signs an audit event then verifies', () => {
    const event = '{"event":"signin","user_id":"u1"}';
    const key = 'a'.repeat(48);
    const sig = hash.hmacSha256(event, key);
    expect(hash.hmacSha256(event, key)).toBe(sig);
    expect(hash.hmacSha256(`${event} `, key)).not.toBe(sig);
  });

  it('rotateKey produces decryption-compatible ciphertext under new key', () => {
    const oldKey = Buffer.alloc(32, 0x33);
    const newKey = Buffer.alloc(32, 0x44);

    process.env['MFA_SECRET_ENCRYPTION_KEY'] = oldKey.toString('hex');
    const s1 = new EncryptionService();
    s1.onModuleInit();
    const ct = s1.encrypt('rotation-target');

    const rotated = s1.rotateKey(oldKey, newKey, ct);

    process.env['MFA_SECRET_ENCRYPTION_KEY'] = newKey.toString('hex');
    const s2 = new EncryptionService();
    s2.onModuleInit();
    expect(s2.decrypt(rotated)).toBe('rotation-target');
  });
});
