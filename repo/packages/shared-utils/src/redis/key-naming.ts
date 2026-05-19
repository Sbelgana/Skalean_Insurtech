/**
 * Skalean InsurTech v2.2 -- Redis key naming conventions
 *
 * Pattern : {module}:{entity}:{tenant_id}:{entity_id}[:{sub}]
 *
 * Reference : cache-strategy.md
 */

const KEY_SEPARATOR = ':';

/**
 * Build a tenant-scoped key for cache, locks, AI, rate limit DBs.
 * Pattern : {module}:{entity}:{tenant_id}:{entity_id}[:{sub}]
 *
 * @example
 *   getTenantCacheKey('cache', 'police', 'tenant-uuid', 'police-uuid')
 *   // returns: 'cache:police:tenant-uuid:police-uuid'
 *
 *   getTenantCacheKey('lock', 'payment', 'tenant-uuid', 'transaction-uuid')
 *   // returns: 'lock:payment:tenant-uuid:transaction-uuid'
 */
export function getTenantCacheKey(...parts: string[]): string {
  if (parts.length < 3) {
    throw new Error(
      `getTenantCacheKey requires at least 3 parts (module, entity, tenant_id), got ${parts.length}`,
    );
  }
  for (const part of parts) {
    if (!part || typeof part !== 'string') {
      throw new Error(`Invalid key part: ${String(part)}`);
    }
    if (part.includes(KEY_SEPARATOR)) {
      throw new Error(`Key part must not contain '${KEY_SEPARATOR}': ${part}`);
    }
  }
  return parts.join(KEY_SEPARATOR);
}

/**
 * Build a non-tenant key (queue, ratelimit:ip).
 * Pattern : {module}:{entity}[:{sub}]
 */
export function getGlobalKey(...parts: string[]): string {
  if (parts.length < 2) {
    throw new Error(
      `getGlobalKey requires at least 2 parts (module, entity), got ${parts.length}`,
    );
  }
  for (const part of parts) {
    if (!part || part.includes(KEY_SEPARATOR)) {
      throw new Error(`Invalid key part: ${part}`);
    }
  }
  return parts.join(KEY_SEPARATOR);
}

/**
 * Build a wildcard pattern for SCAN operations on tenant-scoped keys.
 *
 * @example
 *   getTenantScanPattern('cache', 'police', 'tenant-uuid')
 *   // returns: 'cache:police:tenant-uuid:*'
 *
 *   getTenantScanPattern('cache', '*', 'tenant-uuid')
 *   // returns: 'cache:*:tenant-uuid:*'
 */
export function getTenantScanPattern(module: string, entity: string, tenantId: string): string {
  return `${module}:${entity}:${tenantId}:*`;
}
