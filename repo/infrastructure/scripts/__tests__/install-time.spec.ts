import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
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
    const npmrc = readFileSync(join(ROOT, '.npmrc'), 'utf-8');
    expect(npmrc).toContain('save-exact=true');
    expect(npmrc).toContain('engine-strict=true');
  });

  it('.nvmrc specifies Node 22', () => {
    const nvmrc = readFileSync(join(ROOT, '.nvmrc'), 'utf-8').trim();
    expect(nvmrc.startsWith('22')).toBe(true);
  });
});
