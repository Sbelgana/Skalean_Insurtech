/**
 * E2E env setup -- Sprint 8 Task 8.14b Phase 2.
 *
 * Loaded by vitest BEFORE any test module imports (`setupFiles` config entry).
 * Ensures NODE_ENV=test + the .env / .env.test files are read by `loadEnv()`
 * BEFORE AppModule's ConfigModule.forRoot() validates the schema.
 *
 * The actual `.env` file in repo/ already contains JWT_PRIVATE_KEY +
 * JWT_PUBLIC_KEY + DATABASE_URL + REDIS_URL + KAFKA_BROKERS etc. Test override
 * for DATABASE_URL/REDIS_URL points to the test stack (postgres:5433,
 * redis:6380) -- see .env.test.
 *
 * We also force telemetry off + OAuth providers to placeholder so :
 *   - No OTel exporter spam in test logs
 *   - Calendar OAuth providers return 503 cleanly (controller fallback path)
 */

// CRITICAL : import reflect-metadata as the VERY first import in the vitest
// process. NestJS DI relies on `design:paramtypes` decorator metadata being
// written at class-definition time. If reflect-metadata is polyfilled AFTER
// the middleware/service classes are imported, the metadata is never written
// and DI silently provides `undefined` for all constructor params.
// Sprint 8 Task 8.14b Session D root cause.
import 'reflect-metadata';
import { generateKeyPairSync } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import * as dotenv from 'dotenv';

process.env['NODE_ENV'] = 'test';
// Enables JwtAuthGuard bypass : session + user lookups are skipped when
// NODE_ENV=test AND E2E_TEST_MODE=true. Hard-gated -- production never sets
// E2E_TEST_MODE. Sprint 8 Task 8.14b Session C.
process.env['E2E_TEST_MODE'] = 'true';

// When run via `pnpm --filter @insurtech/api test:e2e:unit`, cwd is
// apps/api/. The .env / .env.test live at the monorepo root (repo/).
// Probe multiple candidate paths so the setup works regardless of how
// vitest is invoked.
const cwd = process.cwd();
const repoRootCandidates = [
  cwd, // already at root (rare)
  resolve(cwd, '..', '..'), // from apps/api -> repo
  resolve(cwd, '..'), // safety net
];
function findRoot(): string {
  for (const candidate of repoRootCandidates) {
    if (existsSync(resolve(candidate, '.env'))) return candidate;
  }
  return cwd;
}
const repoRoot = findRoot();

const envPath = resolve(repoRoot, '.env');
if (existsSync(envPath)) {
  dotenv.config({ path: envPath, override: false });
}
const envTestPath = resolve(repoRoot, '.env.test');
if (existsSync(envTestPath)) {
  dotenv.config({ path: envTestPath, override: true });
}

// HARD override : test stack pointers (postgres 5433, redis 6380, kafka 9095).
// This is the authoritative source of truth -- whatever .env or .env.test
// said, E2E tests target the local test docker compose stack.
//   postgres container : skalean-postgres-test
//     -- user `skalean`, password `skalean_test`, db `skalean_insurtech_test`
//   redis container    : skalean-redis-test  -- requirepass skalean_redis_test
//   kafka container    : skalean-kafka-test  -- KRaft mode, no auth
process.env['DATABASE_URL'] =
  'postgresql://skalean:skalean_test@localhost:5433/skalean_insurtech_test';
process.env['DATABASE_HOST'] = 'localhost';
process.env['DATABASE_PORT'] = '5433';
process.env['DATABASE_USER'] = 'skalean';
process.env['DATABASE_PASSWORD'] = 'skalean_test';
process.env['DATABASE_NAME'] = 'skalean_insurtech_test';

process.env['REDIS_URL'] = 'redis://:skalean_redis_test@localhost:6380';
process.env['REDIS_HOST'] = 'localhost';
process.env['REDIS_PORT'] = '6380';
process.env['REDIS_PASSWORD'] = 'skalean_redis_test';

process.env['KAFKA_BROKERS'] = 'localhost:9095';
process.env['KAFKA_CLIENT_ID'] = 'skalean-insurtech-e2e';
process.env['KAFKA_GROUP_ID'] = 'skalean-insurtech-e2e';

// Disable OTel exporters during tests.
process.env['OTEL_TRACES_EXPORTER'] = 'none';
process.env['OTEL_LOGS_EXPORTER'] = 'none';
process.env['OTEL_METRICS_EXPORTER'] = 'none';

// Calendar OAuth : placeholder credentials (providers return 503 in tests).
process.env['GOOGLE_OAUTH_CLIENT_ID'] =
  process.env['GOOGLE_OAUTH_CLIENT_ID'] ?? 'PLACEHOLDER_GOOGLE_CLIENT_ID';
process.env['GOOGLE_OAUTH_CLIENT_SECRET'] =
  process.env['GOOGLE_OAUTH_CLIENT_SECRET'] ?? 'PLACEHOLDER_GOOGLE_SECRET';
process.env['GOOGLE_OAUTH_REDIRECT_URI'] =
  process.env['GOOGLE_OAUTH_REDIRECT_URI'] ??
  'https://placeholder.ngrok-free.app/api/v1/booking/calendar/callback/google';
process.env['MICROSOFT_OAUTH_CLIENT_ID'] =
  process.env['MICROSOFT_OAUTH_CLIENT_ID'] ?? 'PLACEHOLDER_MICROSOFT_CLIENT_ID';
process.env['MICROSOFT_OAUTH_CLIENT_SECRET'] =
  process.env['MICROSOFT_OAUTH_CLIENT_SECRET'] ?? 'PLACEHOLDER_MICROSOFT_SECRET';
process.env['MICROSOFT_OAUTH_REDIRECT_URI'] =
  process.env['MICROSOFT_OAUTH_REDIRECT_URI'] ??
  'https://placeholder.ngrok-free.app/api/v1/booking/calendar/callback/outlook';
process.env['MICROSOFT_OAUTH_TENANT'] =
  process.env['MICROSOFT_OAUTH_TENANT'] ?? 'common';
process.env['CALENDAR_WEBHOOK_BASE_URL'] =
  process.env['CALENDAR_WEBHOOK_BASE_URL'] ??
  'https://placeholder.ngrok-free.app/api/v1/booking/calendar/webhook';

// Auth service hardening : pepper / mfa keys / argon2 params.
// PASSWORD_PEPPER : >= 32 chars (any ASCII).
// MFA_SECRET_ENCRYPTION_KEY : 64 hex chars OR 43 base64 chars OR 32-byte raw.
// HARD override so .env / .env.test cannot leak values too short for prod schema.
process.env['PASSWORD_PEPPER'] =
  'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4';
process.env['PASSWORD_PEPPER_VERSION'] = '1';
// 64 hex chars = 32 bytes (AES-256-GCM key).
process.env['MFA_SECRET_ENCRYPTION_KEY'] =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
// Calendar token encryption (AES-256-GCM 32-byte hex = 64 chars).
process.env['CALENDAR_TOKEN_ENCRYPTION_KEY'] =
  process.env['CALENDAR_TOKEN_ENCRYPTION_KEY'] ??
  'c65fcd3a9dcb54c0532d4be3da517380bf5d425036d929cd8b4acf67cdad1e02';

// JWT secrets fall back to dev values (deterministic) when not provided.
process.env['JWT_SECRET'] =
  process.env['JWT_SECRET'] ??
  'replace-with-32-char-minimum-secret-dev-only-not-for-prod';
process.env['JWT_REFRESH_SECRET'] =
  process.env['JWT_REFRESH_SECRET'] ??
  'replace-with-32-char-minimum-refresh-secret-dev-only';

// JWT keypair (RS256) -- generate a fresh keypair per test process so the
// helper does not depend on .env JWT_PRIVATE_KEY (which is base64-encoded
// multi-line PEM and finicky to load via dotenv). Pattern heritage from
// apps/api/test/auth-flow-e2e.spec.ts (Sprint 5).
if (!process.env['JWT_PRIVATE_KEY'] || !process.env['JWT_PUBLIC_KEY']) {
  const kp = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  process.env['JWT_PRIVATE_KEY'] = kp.privateKey;
  process.env['JWT_PUBLIC_KEY'] = kp.publicKey;
}
