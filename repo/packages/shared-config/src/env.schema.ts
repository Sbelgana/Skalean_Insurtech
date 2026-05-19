/**
 * Skalean InsurTech v2.2 -- Env schema Zod runtime validation
 *
 * Reference :
 *   - 00-pilotage/meta-prompts/B-01-sprint-01-bootstrap.md (Tache 1.1.8)
 *   - 8-skalean-insurtech-prompt-master.md Section 3 (Zod strict)
 *   - decision-006 (no-emoji)
 *   - 2-variables-environnement.env catalog
 */

import { z } from 'zod';

// ============================================================================
// Helpers : Bool transform + array CSV
// ============================================================================

const Bool = z.preprocess((v) => {
  if (typeof v === 'boolean') return v;
  if (v === 'true' || v === '1') return true;
  if (v === 'false' || v === '0') return false;
  return v;
}, z.boolean());

const ArrayCSV = z.preprocess((v) => {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') return v.split(',').map((s) => s.trim()).filter(Boolean);
  return v;
}, z.array(z.string().min(1)));

// ============================================================================
// Schema definition (50+ variables grouped by category)
// ============================================================================

export const EnvSchema = z.object({
  // ==========================================================================
  // Runtime (5)
  // ==========================================================================
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  APP_VERSION: z.string().default('2.2.0'),
  API_PORT: z.coerce.number().int().min(1024).max(65535).default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  TZ: z.string().default('Africa/Casablanca'),

  // ==========================================================================
  // Database (4)
  // ==========================================================================
  DATABASE_URL: z.string().url(),
  DATABASE_POOL_MIN: z.coerce.number().int().nonnegative().default(2),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).default(20),
  DATABASE_LOG: Bool.default(false),

  // ==========================================================================
  // Redis (1)
  // ==========================================================================
  REDIS_URL: z.string().url(),

  // ==========================================================================
  // Kafka (3)
  // ==========================================================================
  KAFKA_BROKERS: ArrayCSV,
  KAFKA_CLIENT_ID: z.string().default('skalean-insurtech'),
  KAFKA_GROUP_ID: z.string().default('skalean-insurtech-default'),

  // ==========================================================================
  // S3 / Object Storage (6)
  // ==========================================================================
  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().default('ma-bgr-1'),
  S3_ACCESS_KEY_ID: z.string().min(8),
  S3_SECRET_ACCESS_KEY: z.string().min(20),
  S3_FORCE_PATH_STYLE: Bool.default(false),
  S3_KMS_KEY_BASE: z.string().optional(),

  // ==========================================================================
  // Auth (9)
  // ==========================================================================
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  MFA_SECRET_ENCRYPTION_KEY: z.string().min(32),
  PASSWORD_PEPPER: z.string().min(16),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),
  ARGON2_MEMORY_COST: z.coerce.number().int().min(8192).default(65536),
  ARGON2_TIME_COST: z.coerce.number().int().min(1).default(3),
  ARGON2_PARALLELISM: z.coerce.number().int().min(1).default(4),

  // ==========================================================================
  // Email SMTP (6)
  // ==========================================================================
  EMAIL_SMTP_HOST: z.string().default('localhost'),
  EMAIL_SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(1025),
  EMAIL_SMTP_USER: z.string().optional(),
  EMAIL_SMTP_PASSWORD: z.string().optional(),
  EMAIL_FROM_ADDRESS: z.string().email().default('noreply@skalean-insurtech.ma'),
  EMAIL_FROM_NAME: z.string().default('Skalean InsurTech'),

  // ==========================================================================
  // WhatsApp (3 -- optional, configured Sprint 9)
  // ==========================================================================
  WHATSAPP_API_URL: z.string().url().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),

  // ==========================================================================
  // Skalean AI (3 -- mock by default Sprint 1-28)
  // ==========================================================================
  SKALEAN_AI_BASE_URL: z.string().url().default('http://localhost:9999/mock'),
  SKALEAN_AI_API_KEY: z.string().default('mock-key-replaced-sprint-29'),
  SKALEAN_AI_USE_MOCK: Bool.default(true),

  // ==========================================================================
  // Sentry (1 -- optional)
  // ==========================================================================
  SENTRY_DSN: z.string().url().optional(),

  // ==========================================================================
  // OpenTelemetry (3 -- optional)
  // ==========================================================================
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
  OTEL_DEBUG: Bool.default(false),
  OTEL_SERVICE_NAME: z.string().default('skalean-insurtech-api'),

  // ==========================================================================
  // CORS (1)
  // ==========================================================================
  CORS_ORIGINS: ArrayCSV.default([
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:3003',
    'http://localhost:3004',
    'http://localhost:3005',
    'http://localhost:3006',
  ]),

  // ==========================================================================
  // Frontend (3 -- prefixed NEXT_PUBLIC_)
  // ==========================================================================
  NEXT_PUBLIC_API_URL: z.string().url().default('http://localhost:4000'),
  NEXT_PUBLIC_MAPBOX_TOKEN: z.string().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),

  // ==========================================================================
  // MCP server (1 -- Sprint 30)
  // ==========================================================================
  MCP_SERVER_URL: z.string().url().default('http://localhost:4001'),

  // ==========================================================================
  // Pay gateways (Sprint 11 -- 6 gateways MA, optional)
  // ==========================================================================
  CMI_API_URL: z.string().url().optional(),
  CMI_API_KEY: z.string().optional(),
  YOUCAN_API_URL: z.string().url().optional(),
  YOUCAN_API_KEY: z.string().optional(),

  // ==========================================================================
  // Signature Barid eSign (Sprint 10 -- optional)
  // ==========================================================================
  BARID_ESIGN_API_URL: z.string().url().optional(),
  BARID_ESIGN_API_KEY: z.string().optional(),

  // ==========================================================================
  // Atlas Cloud Services (Sprint 35 prod only -- optional)
  // ==========================================================================
  ATLAS_VAULT_URL: z.string().url().optional(),
  ATLAS_VAULT_TOKEN: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;
