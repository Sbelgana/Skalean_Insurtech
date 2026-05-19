import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '../../..');

function exists(rel: string): boolean {
  return existsSync(join(ROOT, rel));
}

describe('Monorepo structure', () => {
  it('has root config files', () => {
    expect(exists('package.json')).toBe(true);
    expect(exists('pnpm-workspace.yaml')).toBe(true);
    expect(exists('turbo.json')).toBe(true);
    expect(exists('.npmrc')).toBe(true);
    expect(exists('.nvmrc')).toBe(true);
    expect(exists('.gitignore')).toBe(true);
    expect(exists('.editorconfig')).toBe(true);
  });

  it('has 9 apps directories', () => {
    const apps = [
      'apps/api',
      'apps/web-insurtech-admin',
      'apps/web-broker',
      'apps/web-garage',
      'apps/web-garage-mobile',
      'apps/web-customer-portal',
      'apps/web-assure-portal',
      'apps/web-assure-mobile',
      'apps/mcp-server',
    ];
    for (const app of apps) {
      expect(exists(app), `Missing: ${app}`).toBe(true);
    }
    expect(apps.length).toBe(9);
  });

  it('has 25 packages directories', () => {
    const packages = [
      'packages/auth',
      'packages/database',
      'packages/crm',
      'packages/booking',
      'packages/comm',
      'packages/docs',
      'packages/signature',
      'packages/pay',
      'packages/books',
      'packages/compliance',
      'packages/analytics',
      'packages/insure',
      'packages/repair',
      'packages/stock',
      'packages/hr',
      'packages/sky',
      'packages/sky-ui',
      'packages/assure-shared',
      'packages/shared-types',
      'packages/shared-config',
      'packages/shared-utils',
      'packages/shared-events',
      'packages/shared-ui',
      'packages/shared-pwa',
      'packages/shared-maps',
    ];
    for (const pkg of packages) {
      expect(exists(pkg), `Missing: ${pkg}`).toBe(true);
    }
    expect(packages.length).toBe(25);
  });

  it('has infrastructure directories', () => {
    expect(exists('infrastructure/docker/postgres')).toBe(true);
    expect(exists('infrastructure/docker/redis')).toBe(true);
    expect(exists('infrastructure/docker/kafka')).toBe(true);
    expect(exists('infrastructure/docker/minio')).toBe(true);
    expect(exists('infrastructure/scripts')).toBe(true);
  });

  it('has docs directories', () => {
    expect(exists('docs/architecture')).toBe(true);
    expect(exists('docs/api')).toBe(true);
    expect(exists('docs/runbooks')).toBe(true);
    expect(exists('docs/security')).toBe(true);
  });

  it('has CI and hooks directories', () => {
    expect(exists('.github/workflows')).toBe(true);
    expect(exists('.husky')).toBe(true);
    expect(exists('.vscode')).toBe(true);
    expect(exists('test')).toBe(true);
  });

  it('package.json has required fields', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8')) as Record<
      string,
      unknown
    >;
    expect(pkg['private']).toBe(true);
    expect(pkg['packageManager']).toBe('pnpm@9.15.0');
    const engines = pkg['engines'] as Record<string, string>;
    expect(engines?.['node']).toBeDefined();
    const scripts = pkg['scripts'] as Record<string, string>;
    expect(scripts?.['dev']).toBeDefined();
    expect(scripts?.['build']).toBeDefined();
    expect(scripts?.['typecheck']).toBeDefined();
    expect(scripts?.['test']).toBeDefined();
    expect(scripts?.['docker:up']).toBeDefined();
  });
});
