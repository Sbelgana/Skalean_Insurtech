/**
 * Skalean InsurTech v2.2 -- Vitest setup global
 * Reference: B-01 Tache 1.1.11
 */
import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

const REPO_ROOT = resolve(import.meta.dirname, '..');

// Force NODE_ENV=test
process.env['NODE_ENV'] = 'test';
process.env['TZ'] = 'Africa/Casablanca';

// Load .env.test fallback .env
const envTestPath = resolve(REPO_ROOT, '.env.test');
const envPath = resolve(REPO_ROOT, '.env');

if (existsSync(envTestPath)) {
  dotenv.config({ path: envTestPath });
} else if (existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

// Default test secrets if not set
if (!process.env['JWT_SECRET']) process.env['JWT_SECRET'] = 'a'.repeat(32);
if (!process.env['JWT_REFRESH_SECRET']) process.env['JWT_REFRESH_SECRET'] = 'b'.repeat(32);
if (!process.env['MFA_SECRET_ENCRYPTION_KEY']) process.env['MFA_SECRET_ENCRYPTION_KEY'] = 'c'.repeat(32);
if (!process.env['PASSWORD_PEPPER']) process.env['PASSWORD_PEPPER'] = 'd'.repeat(16);
if (!process.env['S3_ACCESS_KEY_ID']) process.env['S3_ACCESS_KEY_ID'] = 'skalean01';
if (!process.env['S3_SECRET_ACCESS_KEY']) process.env['S3_SECRET_ACCESS_KEY'] = 'a'.repeat(20);
if (!process.env['DATABASE_URL']) process.env['DATABASE_URL'] = 'postgresql://skalean:skalean_test@localhost:5432/skalean_insurtech_test';
if (!process.env['REDIS_URL']) process.env['REDIS_URL'] = 'redis://localhost:6379';
if (!process.env['KAFKA_BROKERS']) process.env['KAFKA_BROKERS'] = 'localhost:9094';
