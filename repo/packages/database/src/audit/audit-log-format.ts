export const AUDIT_LOG_SCHEMA_VERSION = 1 as const;

export interface AuditLogChanges {
  schemaVersion: 1;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  fieldsChanged: string[];
  truncated?: boolean;
  truncatedReason?: 'SIZE_EXCEEDED' | 'BLACKLISTED_FIELD';
  truncatedOriginalSize?: number;
  redactedFields?: string[] | undefined;
}

export const AUDIT_LOG_REDACTED_FIELDS: ReadonlyArray<string> = Object.freeze([
  'password',
  'password_hash',
  'salt',
  'access_token',
  'refresh_token',
  'reset_token',
  'mfa_secret',
  'rib',
  'iban',
  'card_number',
  'cvv',
  'cnie_scan_url',
]);

export const AUDITABLE_TABLES: ReadonlyArray<string> = Object.freeze([
  'auth_users',
  'auth_sessions',
  'auth_roles',
  'auth_user_roles',
  'insure_polices',
  'insure_garanties',
  'insure_avenants',
  'repair_sinistres',
  'repair_expertises',
  'pay_transactions',
  'pay_remboursements',
  'doc_documents',
]);

export const TENANT_INJECTION_EXEMPTED_TABLES: ReadonlyArray<string> = Object.freeze([
  'auth_tenants',
  'audit_log',
  'migrations',
  'migrations_lock',
  'system_config',
  'system_metrics',
  'typeorm_migrations',
]);

export const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
