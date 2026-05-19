import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = join(__dirname, '../../..');

const EMOJI_REGEX =
  /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F1FF}\u{1F200}-\u{1F2FF}]/u;

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.turbo',
  'coverage',
  'test-results',
  'playwright-report',
  'docker-data',
  '.docker-data',
]);

const TEXT_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.json', '.yaml', '.yml',
  '.md', '.sh', '.sql', '.toml', '.ini', '.env', '.txt',
]);

function collectFiles(dir: string): string[] {
  const files: string[] = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...collectFiles(fullPath));
      } else if (entry.isFile() && TEXT_EXTENSIONS.has(extname(entry.name))) {
        files.push(fullPath);
      }
    }
  } catch {
    // ignore permission errors
  }
  return files;
}

describe('No-emoji policy (decision-006)', () => {
  it('has no emoji in any config or source file', () => {
    const files = collectFiles(ROOT);
    const violations: string[] = [];

    for (const file of files) {
      try {
        const content = readFileSync(file, 'utf-8');
        if (EMOJI_REGEX.test(content)) {
          violations.push(file.replace(ROOT, ''));
        }
      } catch {
        // skip unreadable files
      }
    }

    if (violations.length > 0) {
      console.error('Emoji violations found in:', violations);
    }
    expect(violations).toHaveLength(0);
  });
});
