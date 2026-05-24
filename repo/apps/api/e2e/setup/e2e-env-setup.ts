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

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import * as dotenv from 'dotenv';

process.env['NODE_ENV'] = 'test';

// Load .env.test first (test overrides), then .env (base values).
const cwd = process.cwd();
const candidates = [
  resolve(cwd, '.env.test'),
  resolve(cwd, '.env'),
];
for (const path of candidates) {
  if (existsSync(path)) {
    dotenv.config({ path, override: false });
  }
}

// Test stack overrides (postgres 5433, redis 6380, kafka 9095 per Sprint 7.5b)
process.env['DATABASE_URL'] =
  process.env['TEST_DATABASE_URL'] ??
  process.env['DATABASE_URL'] ??
  'postgresql://skalean:skalean_test@localhost:5433/skalean_insurtech_test';
// Test Redis runs with `--requirepass skalean_redis_test` (skalean-redis-test container).
process.env['REDIS_URL'] = 'redis://:skalean_redis_test@localhost:6380';
process.env['REDIS_HOST'] = 'localhost';
process.env['REDIS_PORT'] = '6380';
process.env['REDIS_PASSWORD'] = 'skalean_redis_test';
process.env['KAFKA_BROKERS'] = process.env['KAFKA_BROKERS'] ?? 'localhost:9095';

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
// Each value uses a deterministic 48-char base64 alphabet for reproducibility.
const TEST_PEPPER = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4';
const TEST_MFA_KEY = 'b1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4'; // 48 hex
if (
  !process.env['PASSWORD_PEPPER'] ||
  process.env['PASSWORD_PEPPER'].length < 32
) {
  process.env['PASSWORD_PEPPER'] = TEST_PEPPER;
}
process.env['PASSWORD_PEPPER_VERSION'] = process.env['PASSWORD_PEPPER_VERSION'] ?? '1';
if (
  !process.env['MFA_SECRET_ENCRYPTION_KEY'] ||
  process.env['MFA_SECRET_ENCRYPTION_KEY'].length < 32
) {
  process.env['MFA_SECRET_ENCRYPTION_KEY'] = TEST_MFA_KEY;
}
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
