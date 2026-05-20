/**
 * validate-i18n-keys.ts -- CI helper
 * Verifie parite cles cross-locale pour les 7 apps web.
 * Exit 1 si divergence detectee.
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

const LOCALES = ['fr', 'ar-MA', 'ar'] as const;
const SOURCE_LOCALE = 'fr' as const;

function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...flattenKeys(v as Record<string, unknown>, key));
    } else {
      keys.push(key);
    }
  }
  return keys;
}

function loadJson(filePath: string): Record<string, unknown> | null {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content) as Record<string, unknown>;
}

let hasErrors = false;
const report: string[] = ['# i18n Keys Validation Report', ''];

for (const app of APPS) {
  const messagesDir = path.join(REPO_ROOT, 'apps', app, 'src', 'messages');
  const sourceFile = path.join(messagesDir, `${SOURCE_LOCALE}.json`);
  const sourceMessages = loadJson(sourceFile);

  if (!sourceMessages) {
    report.push(`## ${app}: MISSING source ${SOURCE_LOCALE}.json`);
    hasErrors = true;
    continue;
  }

  const sourceKeys = flattenKeys(sourceMessages);
  report.push(`## ${app} (${sourceKeys.length} source keys)`);

  for (const locale of LOCALES) {
    if (locale === SOURCE_LOCALE) continue;
    const localeFile = path.join(messagesDir, `${locale}.json`);
    const localeMessages = loadJson(localeFile);

    if (!localeMessages) {
      report.push(`  - ${locale}: MISSING FILE`);
      hasErrors = true;
      continue;
    }

    const localeKeys = flattenKeys(localeMessages);
    const missingInLocale = sourceKeys.filter((k) => !localeKeys.includes(k));
    const extraInLocale = localeKeys.filter((k) => !sourceKeys.includes(k));

    if (missingInLocale.length > 0 || extraInLocale.length > 0) {
      if (missingInLocale.length > 0) {
        report.push(`  - ${locale}: MISSING ${missingInLocale.length} keys: ${missingInLocale.slice(0, 5).join(', ')}${missingInLocale.length > 5 ? '...' : ''}`);
      }
      if (extraInLocale.length > 0) {
        report.push(`  - ${locale}: EXTRA ${extraInLocale.length} keys: ${extraInLocale.slice(0, 5).join(', ')}${extraInLocale.length > 5 ? '...' : ''}`);
      }
      hasErrors = true;
    } else {
      report.push(`  - ${locale}: OK (${localeKeys.length} keys)`);
    }
  }
  report.push('');
}

const cacheDir = path.join(REPO_ROOT, '.cache');
if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
}
fs.writeFileSync(path.join(cacheDir, 'i18n-report.md'), report.join('\n'));

if (hasErrors) {
  console.error('[i18n] Validation FAILED. See .cache/i18n-report.md');
  process.exit(1);
} else {
  console.log('[i18n] All keys are in parity across locales.');
}
