/**
 * Skalean InsurTech v2.2 -- Pino logger with PII redaction
 * Reference: B-01 Tache 1.1.12
 * decision-006 (no-emoji)
 * CNDP loi 09-08 article 17 : aucun PII expose dans logs
 */
import { pino, type Logger, type LoggerOptions } from 'pino';

const SENSITIVE_FIELDS = [
  'password', 'passwordHash', 'password_hash',
  'refreshToken', 'refresh_token', 'accessToken', 'access_token',
  'apiKey', 'api_key', 'token', 'secret',
  'cin', 'phone', 'phoneNumber', 'phone_number',
  'email', 'firstName', 'first_name', 'lastName', 'last_name',
  'fullName', 'full_name', 'dateOfBirth', 'date_of_birth',
  'address', 'iban', 'bankAccount', 'creditCard',
];

const REDACT_PATHS: string[] = [
  // Root-level fields (CNDP loi 09-08 -- aucun PII expose dans logs)
  ...SENSITIVE_FIELDS,
  // One level deep: {user: {password: ...}}, {body: {password: ...}}, etc.
  ...SENSITIVE_FIELDS.map((f) => `*.${f}`),
  // HTTP headers + body
  'headers.authorization',
  'headers.cookie',
  '*.headers.authorization',
  '*.headers.cookie',
  'body.password',
  'body.refreshToken',
  'body.cin',
  '*.body.password',
  '*.body.refreshToken',
  '*.body.cin',
];

const level = (process.env['LOG_LEVEL'] ?? 'info') as pino.Level;
const nodeEnv = process.env['NODE_ENV'] ?? 'development';
const appVersion = process.env['APP_VERSION'] ?? '2.2.0';

const baseLoggerOptions: LoggerOptions = {
  level,
  base: {
    service: 'skalean-insurtech',
    env: nodeEnv,
    version: appVersion,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label }),
  },
  redact: {
    paths: REDACT_PATHS,
    censor: '[REDACTED]',
  },
};

const devTransport = {
  target: 'pino-pretty',
  options: {
    colorize: true,
    ignore: 'pid,hostname',
    translateTime: 'SYS:standard',
  },
};

export const logger: Logger = pino({
  ...baseLoggerOptions,
  ...(nodeEnv === 'development' ? { transport: devTransport } : {}),
});

export function createChildLogger(bindings: Record<string, unknown>): Logger {
  return logger.child(bindings);
}
