#!/usr/bin/env tsx
/**
 * Lighthouse baseline runner -- audit 8 apps Skalean InsurTech
 * Reference: task-1.4.16 Sprint 4 Phase 1
 *
 * Output:
 *   lighthouse-reports/baseline-{app}.json   (Lighthouse JSON complet)
 *   lighthouse-reports/baseline-summary.txt  (ASCII table)
 * Exit code 1 si au moins un metric P0 below cible.
 *
 * Usage:
 *   pnpm lighthouse:baseline
 *   BROKER_URL=http://prod.example/fr pnpm lighthouse:baseline
 */
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const lighthouse = require('lighthouse');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const chromeLauncher = require('chrome-launcher');

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPORTS_DIR = join(__dirname, '..', 'lighthouse-reports');

interface AppTarget {
  name: string;
  url: string;
  profile: 'mobile' | 'desktop';
  cibles: {
    performance: number;
    accessibility: number;
    bestPractices: number;
    seo: number;
    pwa?: number;
  };
}

const APPS: AppTarget[] = [
  {
    name: 'web-broker',
    url: process.env.BROKER_URL ?? 'http://localhost:3001/fr',
    profile: 'desktop',
    cibles: { performance: 70, accessibility: 90, bestPractices: 90, seo: 90 },
  },
  {
    name: 'web-garage',
    url: process.env.GARAGE_URL ?? 'http://localhost:3002/fr',
    profile: 'desktop',
    cibles: { performance: 70, accessibility: 90, bestPractices: 90, seo: 90 },
  },
  {
    name: 'web-garage-mobile',
    url: process.env.GARAGE_MOBILE_URL ?? 'http://localhost:3003/fr',
    profile: 'mobile',
    cibles: { performance: 70, accessibility: 90, bestPractices: 90, seo: 90, pwa: 90 },
  },
  {
    name: 'web-insurtech-admin',
    url: process.env.ADMIN_URL ?? 'http://localhost:3000/fr',
    profile: 'desktop',
    cibles: { performance: 70, accessibility: 90, bestPractices: 90, seo: 90 },
  },
  {
    name: 'web-customer-portal',
    url: process.env.CUSTOMER_PORTAL_URL ?? 'http://localhost:3004/fr',
    profile: 'desktop',
    cibles: { performance: 80, accessibility: 90, bestPractices: 90, seo: 90 },
  },
  {
    name: 'web-customer-portal-mobile',
    url: process.env.CUSTOMER_PORTAL_URL ?? 'http://localhost:3004/fr',
    profile: 'mobile',
    cibles: { performance: 70, accessibility: 90, bestPractices: 90, seo: 90 },
  },
  {
    name: 'web-assure-portal',
    url: process.env.ASSURE_PORTAL_URL ?? 'http://localhost:3005/fr',
    profile: 'desktop',
    cibles: { performance: 70, accessibility: 90, bestPractices: 90, seo: 90 },
  },
  {
    name: 'web-assure-mobile',
    url: process.env.ASSURE_MOBILE_URL ?? 'http://localhost:3006/fr',
    profile: 'mobile',
    cibles: { performance: 70, accessibility: 90, bestPractices: 90, seo: 90, pwa: 90 },
  },
];

interface ScoreRow {
  app: string;
  profile: string;
  perf: number;
  a11y: number;
  bp: number;
  seo: number;
  pwa: number | null;
  pass: boolean;
  failures: string[];
}

async function runOne(target: AppTarget): Promise<ScoreRow> {
  const chrome = await chromeLauncher.launch({
    chromeFlags: ['--headless', '--no-sandbox', '--disable-dev-shm-usage'],
  }) as { port: number; kill: () => Promise<void> };

  const settings = {
    output: 'json',
    logLevel: 'error',
    onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo', 'pwa'],
    formFactor: target.profile,
    screenEmulation:
      target.profile === 'mobile'
        ? { mobile: true, width: 360, height: 640, deviceScaleFactor: 2, disabled: false }
        : { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false },
    throttling:
      target.profile === 'mobile'
        ? { rttMs: 150, throughputKbps: 1638.4, cpuSlowdownMultiplier: 4, requestLatencyMs: 0, downloadThroughputKbps: 0, uploadThroughputKbps: 0 }
        : { rttMs: 40, throughputKbps: 10240, cpuSlowdownMultiplier: 1, requestLatencyMs: 0, downloadThroughputKbps: 0, uploadThroughputKbps: 0 },
  };

  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  const result = await lighthouse(target.url, { port: chrome.port, ...settings }) as { lhr: Record<string, { categories: Record<string, { score: number | null }> }> } | undefined;
  await chrome.kill();

  if (!result?.lhr) {
    throw new Error(`Lighthouse failed for ${target.name}`);
  }

  const lhr = result.lhr as unknown as { categories: Record<string, { score: number | null } | undefined> };
  const cats = lhr.categories;
  const score = (k: string): number => Math.round(((cats[k]?.score) ?? 0) * 100);

  const perf = score('performance');
  const a11y = score('accessibility');
  const bp = score('best-practices');
  const seo = score('seo');
  const pwa = cats['pwa'] != null ? score('pwa') : null;

  if (!existsSync(REPORTS_DIR)) mkdirSync(REPORTS_DIR, { recursive: true });
  const outFile = join(REPORTS_DIR, `baseline-${target.name}.json`);
  writeFileSync(outFile, JSON.stringify(lhr, null, 2));

  const failures: string[] = [];
  if (perf < target.cibles.performance) failures.push(`perf ${perf}<${target.cibles.performance}`);
  if (a11y < target.cibles.accessibility) failures.push(`a11y ${a11y}<${target.cibles.accessibility}`);
  if (bp < target.cibles.bestPractices) failures.push(`bp ${bp}<${target.cibles.bestPractices}`);
  if (seo < target.cibles.seo) failures.push(`seo ${seo}<${target.cibles.seo}`);
  if (target.cibles.pwa !== undefined && (pwa ?? 0) < target.cibles.pwa) {
    failures.push(`pwa ${pwa ?? 0}<${target.cibles.pwa}`);
  }

  return { app: target.name, profile: target.profile, perf, a11y, bp, seo, pwa, pass: failures.length === 0, failures };
}

function asciiTable(rows: ScoreRow[]): string {
  const header = '+----------------------------+----------+------+------+----+-----+-----+--------+';
  const cols   = '| app                        | profile  | perf | a11y | bp | seo | pwa | pass   |';
  const sep    = '+----------------------------+----------+------+------+----+-----+-----+--------+';
  const lines  = rows.map((r) => {
    const a  = r.app.padEnd(26).slice(0, 26);
    const p  = r.profile.padEnd(8);
    const pf = String(r.perf).padStart(4);
    const ay = String(r.a11y).padStart(4);
    const bp = String(r.bp).padStart(2);
    const se = String(r.seo).padStart(3);
    const pw = (r.pwa === null ? 'n/a' : String(r.pwa)).padStart(3);
    const ok = (r.pass ? 'PASS' : 'FAIL').padEnd(6);
    return `| ${a} | ${p} | ${pf} | ${ay} | ${bp} | ${se} | ${pw} | ${ok} |`;
  });
  return [header, cols, sep, ...lines, sep].join('\n');
}

async function main(): Promise<void> {
  console.log('Lighthouse baseline -- 8 apps audit\n');
  const rows: ScoreRow[] = [];

  for (const app of APPS) {
    process.stdout.write(`Auditing ${app.name} (${app.profile})... `);
    try {
      const r = await runOne(app);
      rows.push(r);
      process.stdout.write(`${r.pass ? 'OK' : 'FAIL'} (${r.failures.join(', ') || '-'})\n`);
    } catch (err) {
      console.error(`ERROR ${app.name}:`, err);
      rows.push({ app: app.name, profile: app.profile, perf: 0, a11y: 0, bp: 0, seo: 0, pwa: null, pass: false, failures: ['error-launching'] });
    }
  }

  const summary = asciiTable(rows);
  console.log('\n' + summary + '\n');

  if (!existsSync(REPORTS_DIR)) mkdirSync(REPORTS_DIR, { recursive: true });
  writeFileSync(join(REPORTS_DIR, 'baseline-summary.txt'), summary);

  const anyFail = rows.some((r) => !r.pass);
  if (anyFail) {
    console.error('FAILURE -- au moins un seuil P0 non atteint');
    process.exit(1);
  }
  console.log('SUCCESS -- tous les seuils P0 atteints');
  process.exit(0);
}

main().catch((err: unknown) => {
  console.error('FATAL', err);
  process.exit(2);
});
