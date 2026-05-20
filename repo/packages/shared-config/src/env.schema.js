"use strict";
/**
 * Skalean InsurTech v2.2 -- Env schema Zod runtime validation
 *
 * Reference :
 *   - 00-pilotage/meta-prompts/B-01-sprint-01-bootstrap.md (Tache 1.1.8)
 *   - 8-skalean-insurtech-prompt-master.md Section 3 (Zod strict)
 *   - decision-006 (no-emoji)
 *   - 2-variables-environnement.env catalog
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnvSchema = void 0;
const zod_1 = require("zod");
// ============================================================================
// Helpers : Bool transform + array CSV
// ============================================================================
const Bool = zod_1.z.preprocess((v) => {
    if (typeof v === 'boolean')
        return v;
    if (v === 'true' || v === '1')
        return true;
    if (v === 'false' || v === '0')
        return false;
    return v;
}, zod_1.z.boolean());
const ArrayCSV = zod_1.z.preprocess((v) => {
    if (Array.isArray(v))
        return v;
    if (typeof v === 'string')
        return v.split(',').map((s) => s.trim()).filter(Boolean);
    return v;
}, zod_1.z.array(zod_1.z.string().min(1)));
// ============================================================================
// Schema definition (50+ variables grouped by category)
// ============================================================================
exports.EnvSchema = zod_1.z.object({
    // ==========================================================================
    // Runtime (5)
    // ==========================================================================
    NODE_ENV: zod_1.z.enum(['development', 'test', 'staging', 'production']).default('development'),
    APP_VERSION: zod_1.z.string().default('2.2.0'),
    API_PORT: zod_1.z.coerce.number().int().min(1024).max(65535).default(4000),
    LOG_LEVEL: zod_1.z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    TZ: zod_1.z.string().default('Africa/Casablanca'),
    // ==========================================================================
    // Database (4)
    // ==========================================================================
    DATABASE_URL: zod_1.z.string().url(),
    DATABASE_POOL_MIN: zod_1.z.coerce.number().int().nonnegative().default(2),
    DATABASE_POOL_MAX: zod_1.z.coerce.number().int().min(1).default(20),
    DATABASE_LOG: Bool.default(false),
    // ==========================================================================
    // Redis (1)
    // ==========================================================================
    REDIS_URL: zod_1.z.string().url(),
    // ==========================================================================
    // Kafka (3)
    // ==========================================================================
    KAFKA_BROKERS: ArrayCSV,
    KAFKA_CLIENT_ID: zod_1.z.string().default('skalean-insurtech'),
    KAFKA_GROUP_ID: zod_1.z.string().default('skalean-insurtech-default'),
    // ==========================================================================
    // S3 / Object Storage (6)
    // ==========================================================================
    S3_ENDPOINT: zod_1.z.string().url().optional(),
    S3_REGION: zod_1.z.string().default('ma-bgr-1'),
    S3_ACCESS_KEY_ID: zod_1.z.string().min(8),
    S3_SECRET_ACCESS_KEY: zod_1.z.string().min(20),
    S3_FORCE_PATH_STYLE: Bool.default(false),
    S3_KMS_KEY_BASE: zod_1.z.string().optional(),
    // ==========================================================================
    // Auth (9)
    // ==========================================================================
    JWT_SECRET: zod_1.z.string().min(32),
    JWT_REFRESH_SECRET: zod_1.z.string().min(32),
    MFA_SECRET_ENCRYPTION_KEY: zod_1.z.string().min(32),
    PASSWORD_PEPPER: zod_1.z.string().min(16),
    JWT_ACCESS_TTL: zod_1.z.string().default('15m'),
    JWT_REFRESH_TTL: zod_1.z.string().default('30d'),
    ARGON2_MEMORY_COST: zod_1.z.coerce.number().int().min(8192).default(65536),
    ARGON2_TIME_COST: zod_1.z.coerce.number().int().min(1).default(3),
    ARGON2_PARALLELISM: zod_1.z.coerce.number().int().min(1).default(4),
    // ==========================================================================
    // Email SMTP (6)
    // ==========================================================================
    EMAIL_SMTP_HOST: zod_1.z.string().default('localhost'),
    EMAIL_SMTP_PORT: zod_1.z.coerce.number().int().min(1).max(65535).default(1025),
    EMAIL_SMTP_USER: zod_1.z.string().optional(),
    EMAIL_SMTP_PASSWORD: zod_1.z.string().optional(),
    EMAIL_FROM_ADDRESS: zod_1.z.string().email().default('noreply@skalean-insurtech.ma'),
    EMAIL_FROM_NAME: zod_1.z.string().default('Skalean InsurTech'),
    // ==========================================================================
    // WhatsApp (3 -- optional, configured Sprint 9)
    // ==========================================================================
    WHATSAPP_API_URL: zod_1.z.string().url().optional(),
    WHATSAPP_PHONE_NUMBER_ID: zod_1.z.string().optional(),
    WHATSAPP_ACCESS_TOKEN: zod_1.z.string().optional(),
    // ==========================================================================
    // Skalean AI (3 -- mock by default Sprint 1-28)
    // ==========================================================================
    SKALEAN_AI_BASE_URL: zod_1.z.string().url().default('http://localhost:9999/mock'),
    SKALEAN_AI_API_KEY: zod_1.z.string().default('mock-key-replaced-sprint-29'),
    SKALEAN_AI_USE_MOCK: Bool.default(true),
    // ==========================================================================
    // Sentry (1 -- optional)
    // ==========================================================================
    SENTRY_DSN: zod_1.z.string().url().optional(),
    // ==========================================================================
    // OpenTelemetry (3 -- optional)
    // ==========================================================================
    OTEL_EXPORTER_OTLP_ENDPOINT: zod_1.z.string().url().optional(),
    OTEL_DEBUG: Bool.default(false),
    OTEL_SERVICE_NAME: zod_1.z.string().default('skalean-insurtech-api'),
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
    NEXT_PUBLIC_API_URL: zod_1.z.string().url().default('http://localhost:4000'),
    NEXT_PUBLIC_MAPBOX_TOKEN: zod_1.z.string().optional(),
    NEXT_PUBLIC_SENTRY_DSN: zod_1.z.string().url().optional(),
    // ==========================================================================
    // MCP server (1 -- Sprint 30)
    // ==========================================================================
    MCP_SERVER_URL: zod_1.z.string().url().default('http://localhost:4001'),
    // ==========================================================================
    // Pay gateways (Sprint 11 -- 6 gateways MA, optional)
    // ==========================================================================
    CMI_API_URL: zod_1.z.string().url().optional(),
    CMI_API_KEY: zod_1.z.string().optional(),
    YOUCAN_API_URL: zod_1.z.string().url().optional(),
    YOUCAN_API_KEY: zod_1.z.string().optional(),
    // ==========================================================================
    // Signature Barid eSign (Sprint 10 -- optional)
    // ==========================================================================
    BARID_ESIGN_API_URL: zod_1.z.string().url().optional(),
    BARID_ESIGN_API_KEY: zod_1.z.string().optional(),
    // ==========================================================================
    // Atlas Cloud Services (Sprint 35 prod only -- optional)
    // ==========================================================================
    ATLAS_VAULT_URL: zod_1.z.string().url().optional(),
    ATLAS_VAULT_TOKEN: zod_1.z.string().optional(),
});
//# sourceMappingURL=env.schema.js.map