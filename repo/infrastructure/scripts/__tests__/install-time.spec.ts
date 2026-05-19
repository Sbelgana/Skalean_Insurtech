import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '../../..');

describe('Install prerequisites', () => {
  it('pnpm-lock.yaml exists (install was run)', () => {
    const lockExists = existsSync(join(ROOT, 'pnpm-lock.yaml'));
    expect(lockExists, 'pnpm-lock.yaml must exist after pnpm install').toBe(true);
  });

  it('turbo binary is available', () => {
    const turboBin =
      existsSync(join(ROOT, 'node_modules/.bin/turbo')) ||
      existsSync(join(ROOT, 'node_modules/.bin/turbo.cmd'));
    expect(turboBin, 'turbo binary not found -- run pnpm install').toBe(true);
  });

  it('.npmrc enforces save-exact', () => {
    const { readFileSync } = require('node:fs');
    const npmrc = readFileSync(join(ROOT, '.npmrc'), 'utf-8');
    expect(npmrc).toContain('save-exact=true');
    expect(npmrc).toContain('engine-strict=true');
  });

  it('.nvmrc specifies Node 22', () => {
    const { readFileSync } = require('node:fs');
    const nvmrc = readFileSync(join(ROOT, '.nvmrc'), 'utf-8').trim();
    expect(nvmrc.startsWith('22')).toBe(true);
  });
});
