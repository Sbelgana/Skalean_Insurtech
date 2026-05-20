/**
 * Smoke integration tests for @insurtech/auth AuthModule.
 * Sprint 5 Tache 2.1.1 (skeleton) + Tache 2.1.2 (PepperService + Argon2Service)
 */

import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { AuthModule } from '../../src/auth.module.js';
import { Argon2Service } from '../../src/services/argon2.service.js';
import { PepperService } from '../../src/services/pepper.service.js';

describe('AuthModule (integration smoke)', () => {
  const SAVED_PEPPER = process.env['PASSWORD_PEPPER'];

  beforeAll(() => {
    process.env['PASSWORD_PEPPER'] = 'a'.repeat(48);
    process.env['PASSWORD_PEPPER_VERSION'] = '1';
  });

  afterAll(() => {
    if (SAVED_PEPPER === undefined) delete process.env['PASSWORD_PEPPER'];
    else process.env['PASSWORD_PEPPER'] = SAVED_PEPPER;
  });

  it('compiles a NestJS test module', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AuthModule],
    }).compile();
    expect(moduleRef).toBeDefined();
    expect(moduleRef.get(PepperService)).toBeInstanceOf(PepperService);
    expect(moduleRef.get(Argon2Service)).toBeInstanceOf(Argon2Service);
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
