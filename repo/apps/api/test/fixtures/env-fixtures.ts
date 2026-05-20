/**
 * Fixtures env vars pour tests Vitest.
 *
 * Fournit des valeurs valides pour tous les champs requis du EnvSchema
 * (packages/shared-config/src/env.schema.ts).
 *
 * Reference : decision-006 (no-emoji).
 * Tache : 1.3.1 (Sprint 3 / Phase 1).
 */

export const VALID_ENV_FIXTURE: Record<string, string> = {
  NODE_ENV: 'test',
  APP_NAME: 'skalean-insurtech-api-test',
  APP_VERSION: '0.0.0',
  API_PORT: '14000',
  API_HOST: '127.0.0.1',
  TZ: 'Africa/Casablanca',
  LOG_LEVEL: 'info',
  LOG_PRETTY_PRINT: 'false',
  LOG_REDACT_PII: 'true',
  BODY_LIMIT_MB: '10',
  GRACEFUL_SHUTDOWN_TIMEOUT_MS: '5000',
  // Database
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test_db',
  DATABASE_POOL_MIN: '1',
  DATABASE_POOL_MAX: '5',
  DATABASE_LOG: 'false',
  // Redis
  REDIS_URL: 'redis://localhost:6379',
  // Kafka
  KAFKA_BROKERS: 'localhost:9092',
  KAFKA_CLIENT_ID: 'skalean-test',
  KAFKA_GROUP_ID: 'skalean-test-group',
  // S3
  S3_ACCESS_KEY_ID: 'test-s3-key',
  S3_SECRET_ACCESS_KEY: 'test-s3-secret-at-least-20-chars',
  S3_REGION: 'ma-bgr-1',
  S3_FORCE_PATH_STYLE: 'true',
  // Auth
  JWT_SECRET: 'test-jwt-secret-at-least-32-chars-long!!',
  JWT_REFRESH_SECRET: 'test-jwt-refresh-secret-32-chars!!',
  MFA_SECRET_ENCRYPTION_KEY: 'test-mfa-secret-key-32-chars-ok!!',
  PASSWORD_PEPPER: 'test-pepper-16ch',
  JWT_ACCESS_TTL: '15m',
  JWT_REFRESH_TTL: '30d',
  ARGON2_MEMORY_COST: '65536',
  ARGON2_TIME_COST: '3',
  ARGON2_PARALLELISM: '4',
  // AI
  SKALEAN_AI_USE_MOCK: 'true',
  // CORS
  CORS_ORIGINS: 'http://localhost:3000',
  // Rate limit
  RATE_LIMIT_TTL_MS: '60000',
  RATE_LIMIT_MAX_REQUESTS: '100',
};

export const INVALID_ENV_FIXTURE: Record<string, string> = {
  NODE_ENV: 'invalid_value',
  API_PORT: 'not-a-number',
};

/**
 * Applique les fixtures dans process.env.
 */
export function applyEnvFixture(fixture: Record<string, string>): void {
  for (const [key, value] of Object.entries(fixture)) {
    process.env[key] = value;
  }
}

/**
 * Supprime les fixtures de process.env.
 */
export function clearEnvFixture(fixture: Record<string, string>): void {
  for (const key of Object.keys(fixture)) {
    delete process.env[key];
  }
}
