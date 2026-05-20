/**
 * i18n-extract-keys.ts -- Sprint 4 utility
 * Extrait toutes les cles useTranslations() du codebase.
 * Reference : task-1.4.11 Sprint 4 Phase 1
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const REPO_ROOT = path.resolve(import.meta.dirname, '..');

const APPS = [
  'web-broker',
  'web-garage',
  'web-garage-mobile',
  'web-insurtech-admin',
  'web-customer-portal',
  'web-assure-portal',
  'web-assure-mobile',
] as const;

const USE_TRANSLATIONS_RE = /useTranslations\(['"]([^'"]+)['"]\)/g;
const T_KEY_RE = /\bt\(['"]([^'"]+)['"]\)/g;

function extractFromFile(content: string): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();
  let match: RegExpExecArray | null;
  USE_TRANSLATIONS_RE.lastIndex = 0;
  while ((match = USE_TRANSLATIONS_RE.exec(content)) !== null) {
    const ns = match[1];
    if (ns) {
      if (!result.has(ns)) result.set(ns, new Set());
    }
  }
  T_KEY_RE.lastIndex = 0;
  while ((match = T_KEY_RE.exec(content)) !== null) {
    const key = match[1];
    if (key) {
      for (const [, keys] of result) {
        keys.add(key);
      }
    }
  }
  return result;
}

function walkDir(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && !['node_modules', '.next', 'dist', '.turbo'].includes(entry.name)) {
      files.push(...walkDir(full));
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name) && !entry.name.includes('.spec.')) {
      files.push(full);
    }
  }
  return files;
}

const allUsedKeys = new Map<string, Map<string, Set<string>>>();

for (const app of APPS) {
  const srcDir = path.join(REPO_ROOT, 'apps', app, 'src');
  const files = walkDir(srcDir);
  const appKeys = new Map<string, Set<string>>();

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const extracted = extractFromFile(content);
    for (const [ns, keys] of extracted) {
      if (!appKeys.has(ns)) appKeys.set(ns, new Set());
      const existing = appKeys.get(ns);
      if (existing) {
        for (const k of keys) existing.add(k);
      }
    }
  }

  allUsedKeys.set(app, appKeys);
}

const report: string[] = ['# i18n Extracted Keys Report', ''];

for (const [app, namespaces] of allUsedKeys) {
  report.push(`## ${app}`);
  for (const [ns, keys] of namespaces) {
    report.push(`  - ${ns}: ${[...keys].join(', ')}`);
  }
  report.push('');
}

const cacheDir = path.join(REPO_ROOT, '.cache');
if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
}
fs.writeFileSync(path.join(cacheDir, 'i18n-keys-report.md'), report.join('\n'));
console.log('[i18n] Keys extraction complete. See .cache/i18n-keys-report.md');
