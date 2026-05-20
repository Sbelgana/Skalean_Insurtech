#!/usr/bin/env tsx
/**
 * Skalean InsurTech -- doctor script
 * Verifie l'environnement de developpement local de bout en bout.
 * Usage : pnpm doctor [--offline] [--fix] [--skip-mapbox]
 *
 * Exit code :
 *  0 = tous les checks OK ou WARN seulement
 *  1 = au moins un check FAIL
 *  2 = erreur interne (script crashe)
 */

import { execSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import { createConnection, createServer } from 'node:net';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');

type Status = 'OK' | 'WARN' | 'FAIL';

interface CheckResult {
  name: string;
  status: Status;
  detail: string;
  duration_ms: number;
}

const args = new Set(process.argv.slice(2));
const OFFLINE = args.has('--offline');
const SKIP_MAPBOX = args.has('--skip-mapbox') || OFFLINE;
const FIX = args.has('--fix');
const REPO_ROOT = resolve(__dirname, '..');

const results: CheckResult[] = [];

function record(name: string, status: Status, detail: string, start: number): void {
  results.push({ name, status, detail, duration_ms: Date.now() - start });
}

async function checkNodeVersion(): Promise<void> {
  const start = Date.now();
  const required = '22.11.0';
  const actual = process.version.slice(1);
  const [aMaj, aMin] = actual.split('.').map(Number);
  const [rMaj, rMin] = required.split('.').map(Number);
  const ok = (aMaj ?? 0) > (rMaj ?? 0) || ((aMaj ?? 0) === (rMaj ?? 0) && (aMin ?? 0) >= (rMin ?? 0));
  record('Node.js >= 22.11.0', ok ? 'OK' : 'FAIL', `actuel : v${actual}, requis : v${required}`, start);
}

async function checkPnpmVersion(): Promise<void> {
  const start = Date.now();
  try {
    const out = execSync('pnpm --version', { encoding: 'utf8' }).trim();
    const [maj, min] = out.split('.').map(Number);
    const ok = (maj ?? 0) > 9 || ((maj ?? 0) === 9 && (min ?? 0) >= 15);
    record('pnpm >= 9.15.0', ok ? 'OK' : 'FAIL', `actuel : ${out}, requis : 9.15.0+`, start);
  } catch {
    record('pnpm >= 9.15.0', 'FAIL', 'pnpm non installe (corepack enable)', start);
  }
}

async function checkDocker(): Promise<void> {
  const start = Date.now();
  try {
    execSync('docker info', { stdio: 'ignore' });
    record('Docker daemon up', 'OK', 'docker info exit 0', start);
  } catch {
    record('Docker daemon up', 'FAIL', 'Docker non demarre. Lancer Docker Desktop.', start);
  }
}

function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolveP) => {
    const srv = createServer();
    srv.once('error', () => resolveP(false));
    srv.once('listening', () => srv.close(() => resolveP(true)));
    srv.listen(port, '127.0.0.1');
  });
}

async function checkPortFree(port: number, label: string): Promise<void> {
  const start = Date.now();
  const free = await isPortFree(port);
  record(
    `Port ${port} (${label}) libre`,
    free ? 'OK' : 'WARN',
    free ? '' : 'port deja en ecoute',
    start,
  );
}

async function checkTcpReachable(
  host: string,
  port: number,
  label: string,
  timeoutMs = 3000,
): Promise<void> {
  const start = Date.now();
  const ok = await new Promise<boolean>((resolveP) => {
    const sock = createConnection({ host, port, timeout: timeoutMs });
    sock.once('connect', () => {
      sock.end();
      resolveP(true);
    });
    sock.once('error', () => resolveP(false));
    sock.once('timeout', () => {
      sock.destroy();
      resolveP(false);
    });
  });
  record(
    `${label} reachable (${host}:${port})`,
    ok ? 'OK' : 'WARN',
    ok ? '' : 'pas de connexion TCP',
    start,
  );
}

async function checkEnvFile(): Promise<void> {
  const start = Date.now();
  const envPath = resolve(REPO_ROOT, '.env');
  const envExamplePath = resolve(REPO_ROOT, '.env.example');
  if (existsSync(envPath)) {
    record('.env present', 'OK', envPath, start);
    return;
  }
  if (existsSync(envExamplePath) && FIX) {
    copyFileSync(envExamplePath, envPath);
    record('.env present', 'OK', '.env cree depuis .env.example (--fix)', start);
    return;
  }
  record(
    '.env present',
    'WARN',
    '.env manquant (executer --fix pour copier .env.example)',
    start,
  );
}

async function checkEnvVarsSchema(): Promise<void> {
  const start = Date.now();
  const envPath = resolve(REPO_ROOT, '.env');
  if (!existsSync(envPath)) {
    record('Env vars schema (Zod)', 'WARN', '.env manquant -- skip validation', start);
    return;
  }
  const content = readFileSync(envPath, 'utf8');
  const env: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && m[1] && m[2] !== undefined) env[m[1]] = m[2].trim();
  }
  const schema = z.object({
    POSTGRES_HOST: z.string().min(1),
    POSTGRES_PORT: z.coerce.number().int().positive(),
    POSTGRES_USER: z.string().min(1),
    POSTGRES_PASSWORD: z.string().min(1),
    REDIS_HOST: z.string().min(1),
    REDIS_PORT: z.coerce.number().int().positive(),
    KAFKA_BROKERS: z.string().min(1),
    NEXT_PUBLIC_API_URL: z.string().url(),
    NEXT_PUBLIC_MAPBOX_TOKEN: z.string().startsWith('pk.').optional(),
    S3_ENDPOINT: z.string().url(),
  });
  const r = schema.safeParse(env);
  if (r.success) {
    record(
      'Env vars schema (Zod)',
      'OK',
      `${Object.keys(env).length} variables validees`,
      start,
    );
  } else {
    record(
      'Env vars schema (Zod)',
      'FAIL',
      JSON.stringify(r.error.issues.map((i) => `${i.path.join('.')} ${i.message}`)),
      start,
    );
  }
}

async function checkAtlasCloudReachable(): Promise<void> {
  const start = Date.now();
  if (OFFLINE) {
    record('Atlas Cloud Benguerir reachable', 'WARN', 'mode --offline', start);
    return;
  }
  try {
    const r = await fetch('https://s3.bgr.atlascloudservices.ma/', {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000),
    });
    record(
      'Atlas Cloud Benguerir reachable',
      r.ok || r.status < 500 ? 'OK' : 'WARN',
      `HTTP ${r.status}`,
      start,
    );
  } catch (e) {
    record(
      'Atlas Cloud Benguerir reachable',
      'WARN',
      `pas de connexion : ${(e as Error).message}`,
      start,
    );
  }
}

async function checkNoAwsLeak(): Promise<void> {
  const start = Date.now();
  const envPath = resolve(REPO_ROOT, '.env');
  if (!existsSync(envPath)) {
    record('Pas de fuite AWS dans .env', 'WARN', '.env absent', start);
    return;
  }
  const content = readFileSync(envPath, 'utf8');
  const violations: string[] = [];
  if (/amazonaws\.com/.test(content)) violations.push('endpoint amazonaws.com');
  if (/AKIA[0-9A-Z]{16}/.test(content)) violations.push('cle AWS access key');
  if (violations.length === 0) {
    record('Pas de fuite AWS dans .env', 'OK', 'decision-008 respectee', start);
  } else {
    record(
      'Pas de fuite AWS dans .env',
      'FAIL',
      `${violations.join(', ')} -- INTERDIT (decision-008)`,
      start,
    );
  }
}

async function checkMapboxToken(): Promise<void> {
  const start = Date.now();
  if (SKIP_MAPBOX) {
    record('Mapbox token valide', 'WARN', 'skipped', start);
    return;
  }
  const envPath = resolve(REPO_ROOT, '.env');
  if (!existsSync(envPath)) {
    record('Mapbox token valide', 'WARN', '.env absent', start);
    return;
  }
  const content = readFileSync(envPath, 'utf8');
  const m = content.match(/NEXT_PUBLIC_MAPBOX_TOKEN=(pk\.[A-Za-z0-9._-]+)/);
  if (!m) {
    record(
      'Mapbox token valide',
      'WARN',
      'NEXT_PUBLIC_MAPBOX_TOKEN absent ou format pk.*',
      start,
    );
    return;
  }
  try {
    const r = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/Casablanca.json?access_token=${m[1]}&limit=1`,
      { signal: AbortSignal.timeout(5000) },
    );
    record('Mapbox token valide', r.ok ? 'OK' : 'FAIL', `HTTP ${r.status}`, start);
  } catch (e) {
    record('Mapbox token valide', 'WARN', `probe echec : ${(e as Error).message}`, start);
  }
}

function printAsciiTable(): void {
  const W = { name: 40, status: 6, detail: 60, dur: 6 };
  const sep =
    '+' +
    '-'.repeat(W.name + 2) +
    '+' +
    '-'.repeat(W.status + 2) +
    '+' +
    '-'.repeat(W.detail + 2) +
    '+' +
    '-'.repeat(W.dur + 2) +
    '+';
  const pad = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}.` : s.padEnd(n));
  console.log(sep);
  console.log(
    `| ${pad('Check', W.name)} | ${pad('Stat', W.status)} | ${pad('Detail', W.detail)} | ${pad('ms', W.dur)} |`,
  );
  console.log(sep);
  for (const r of results) {
    console.log(
      `| ${pad(r.name, W.name)} | ${pad(r.status, W.status)} | ${pad(r.detail, W.detail)} | ${pad(String(r.duration_ms), W.dur)} |`,
    );
  }
  console.log(sep);
}

(async () => {
  console.log('Skalean InsurTech -- doctor');
  console.log(`Mode : ${OFFLINE ? 'offline' : 'online'}${FIX ? ' + fix' : ''}`);
  console.log('');
  await checkNodeVersion();
  await checkPnpmVersion();
  await checkDocker();
  await checkEnvFile();
  await checkEnvVarsSchema();
  await checkNoAwsLeak();
  for (const p of [3000, 3001, 3002, 3003, 3004, 3005, 3006, 4000, 4001]) {
    await checkPortFree(
      p,
      p === 4000 ? 'api' : p === 4001 ? 'bff' : `app-${p}`,
    );
  }
  if (!OFFLINE) {
    await checkTcpReachable('127.0.0.1', 5432, 'PostgreSQL');
    await checkTcpReachable('127.0.0.1', 6379, 'Redis');
    await checkTcpReachable('127.0.0.1', 9092, 'Kafka');
    await checkAtlasCloudReachable();
  }
  await checkMapboxToken();
  printAsciiTable();
  const fails = results.filter((r) => r.status === 'FAIL').length;
  const warns = results.filter((r) => r.status === 'WARN').length;
  console.log(
    `\n${results.length} checks : ${results.length - fails - warns} OK, ${warns} WARN, ${fails} FAIL`,
  );
  process.exit(fails > 0 ? 1 : 0);
})().catch((e) => {
  console.error('doctor crashe :', e);
  process.exit(2);
});
