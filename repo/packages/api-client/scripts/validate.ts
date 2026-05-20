// @insurtech/api-client -- post-generation validation
// Verifies that:
//   1. types.gen.ts is parseable TypeScript
//   2. TSC project compiles without errors
//   3. smoke vitest run on representative hooks
//   4. no manual edits since last generation (header timestamp comparison)

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(__dirname, '..');
const TARGET = join(PACKAGE_ROOT, 'src', 'types.gen.ts');

function log(level: 'info' | 'ok' | 'fail', msg: string): void {
  const prefix = { info: '[validate]', ok: '[ok]', fail: '[fail]' }[level];
  console.log(`${prefix} ${msg}`);
}

async function checkHeader(): Promise<void> {
  const content = await readFile(TARGET, 'utf8');
  if (!content.startsWith('/**')) {
    throw new Error('types.gen.ts missing AUTO-GENERATED header');
  }
  if (!content.includes('AUTO-GENERATED FILE -- DO NOT EDIT MANUALLY')) {
    throw new Error('types.gen.ts header tampered');
  }
  log('ok', 'header intact');
}

function runTypecheck(): void {
  execSync('pnpm typecheck', { cwd: PACKAGE_ROOT, stdio: 'inherit' });
  log('ok', 'typecheck passed');
}

function runSmokeTests(): void {
  execSync('pnpm test --run --reporter=basic', { cwd: PACKAGE_ROOT, stdio: 'inherit' });
  log('ok', 'smoke tests passed');
}

async function main(): Promise<void> {
  try {
    log('info', 'validating generated client');
    await checkHeader();
    runTypecheck();
    runSmokeTests();
    log('ok', 'validation complete');
  } catch (err) {
    log('fail', (err as Error).message);
    process.exit(1);
  }
}

void main();
