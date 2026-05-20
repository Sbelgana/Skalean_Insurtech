/**
 * Smoke integration tests for @insurtech/auth AuthModule.
 * Sprint 5 Tache 2.1.1 (skeleton) + 2.1.2 (Argon2/Pepper) + 2.1.3 (Encryption/Hashing)
 */

import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { AuthModule } from '../../src/auth.module.js';
import { Argon2Service } from '../../src/services/argon2.service.js';
import { EncryptionService } from '../../src/services/encryption.service.js';
import { HashingService } from '../../src/services/hashing.service.js';
import { PepperService } from '../../src/services/pepper.service.js';

describe('AuthModule (integration smoke)', () => {
  const SAVED: Record<string, string | undefined> = {};
  const KEYS = ['PASSWORD_PEPPER', 'PASSWORD_PEPPER_VERSION', 'MFA_SECRET_ENCRYPTION_KEY'];

  beforeAll(() => {
    for (const k of KEYS) SAVED[k] = process.env[k];
    process.env['PASSWORD_PEPPER'] = 'a'.repeat(48);
    process.env['PASSWORD_PEPPER_VERSION'] = '1';
    process.env['MFA_SECRET_ENCRYPTION_KEY'] = 'b'.repeat(64);
  });

  afterAll(() => {
    for (const k of KEYS) {
      if (SAVED[k] === undefined) delete process.env[k];
      else process.env[k] = SAVED[k];
    }
  });

  it('compiles a NestJS test module with all current providers', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AuthModule],
    }).compile();
    expect(moduleRef).toBeDefined();
    expect(moduleRef.get(PepperService)).toBeInstanceOf(PepperService);
    expect(moduleRef.get(Argon2Service)).toBeInstanceOf(Argon2Service);
    expect(moduleRef.get(EncryptionService)).toBeInstanceOf(EncryptionService);
    expect(moduleRef.get(HashingService)).toBeInstanceOf(HashingService);
    await moduleRef.close();
  });

  it('declares @Global() decorator', () => {
    const isGlobal = Reflect.getMetadata('__module:global__', AuthModule);
    expect(isGlobal).toBe(true);
  });

  it('imports without errors when re-included multiple times', async () => {
    const m1 = await Test.createTestingModule({ imports: [AuthModule] }).compile();
    const m2 = await Test.createTestingModule({ imports: [AuthModule] }).compile();
    expect(m1).toBeDefined();
    expect(m2).toBeDefined();
    await Promise.all([m1.close(), m2.close()]);
  });
});
