/**
 * Smoke integration tests for @insurtech/auth AuthModule skeleton.
 * Sprint 5 Tache 2.1.1
 */

import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { Test } from '@nestjs/testing';
import { AuthModule } from '../../src/auth.module.js';

describe('AuthModule (integration smoke)', () => {
  it('compiles a NestJS test module', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AuthModule],
    }).compile();
    expect(moduleRef).toBeDefined();
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
