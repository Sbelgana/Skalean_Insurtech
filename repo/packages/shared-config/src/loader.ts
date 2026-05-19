/**
 * Skalean InsurTech v2.2 -- Env loader with cache singleton + dotenv
 */

import * as dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import { EnvSchema, type Env } from './env.schema.js';

let cachedEnv: Env | null = null;

interface LoadEnvOptions {
  force?: boolean;
  dotenvPath?: string;
}

export function loadEnv(options: LoadEnvOptions = {}): Env {
  if (cachedEnv && !options.force) return cachedEnv;

  const envPath = options.dotenvPath ?? findDotenvPath();
  if (envPath && existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }

  const result = EnvSchema.safeParse(process.env);

  if (!result.success) {
    process.stderr.write('========================================\n');
    process.stderr.write('FATAL: Invalid environment configuration\n');
    process.stderr.write('========================================\n');
    process.stderr.write(JSON.stringify(result.error.format(), null, 2) + '\n');
    process.stderr.write('========================================\n');
    process.stderr.write('Required env vars (cf. .env.example) :\n');
    for (const issue of result.error.issues) {
      process.stderr.write(`  ${issue.path.join('.')}: ${issue.message}\n`);
    }
    process.stderr.write('========================================\n');
    process.exit(1);
  }

  cachedEnv = result.data;
  return cachedEnv;
}

export function resetEnvCache(): void {
  cachedEnv = null;
}

function findDotenvPath(): string | null {
  const cwd = process.cwd();
  const nodeEnv = process.env['NODE_ENV'] ?? 'development';

  const candidates = [
    `${cwd}/.env.${nodeEnv}.local`,
    `${cwd}/.env.local`,
    `${cwd}/.env.${nodeEnv}`,
    `${cwd}/.env`,
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}
