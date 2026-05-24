/**
 * CustomFieldsValidatorService -- Sprint 8 Tache 8.7.
 *
 * Construit dynamiquement un schema Zod runtime depuis les definitions
 * `crm_custom_field_definitions` actives pour un tenant + entity_type donne.
 * Cache simple in-memory (Map + TTL 60s) -- granularite (tenantId, entityType).
 *
 * Strategy strict() : rejette champs non-definis (defense contre extra fields).
 *
 * Invalidation : ce service s'auto-enregistre comme cache invalidator sur
 * CustomFieldsDefinitionService au demarrage du module Nest. Tout change de
 * definition (create / update / deactivate / reactivate / hardDelete) vide la
 * clef de cache correspondante.
 *
 * Hooks integration dans Companies/Contacts/Deals/Interactions services :
 *   DIFFEREE Task 8.14 (E2E consolidation -- decision user Task 8.7).
 *
 * Reference : B-08 Tache 3.1.7.
 */

import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { TenantContextService } from '@insurtech/auth';
import type {
  CustomFieldEntityTypeDto,
  ValidationRulesDto,
} from '@insurtech/crm';
import type { CrmCustomFieldDefinitionEntity } from '@insurtech/database';
import { z, type ZodTypeAny } from 'zod';
import { CustomFieldsDefinitionService } from './custom-fields-definition.service.js';

const CACHE_TTL_MS = 60_000;

export interface CacheEntry {
  readonly schema: z.ZodObject<Record<string, ZodTypeAny>>;
  readonly expiresAt: number;
}

export interface ValidatorStats {
  readonly cacheSize: number;
  readonly hits: number;
  readonly misses: number;
}

export const VALIDATOR_ERROR_CODES = {
  TENANT_REQUIRED: 'CRM_VALIDATOR_TENANT_REQUIRED',
  INVALID_CUSTOM_FIELDS: 'CRM_VALIDATOR_INVALID_CUSTOM_FIELDS',
} as const;

@Injectable()
export class CustomFieldsValidatorService implements OnModuleInit {
  private readonly logger = new Logger(CustomFieldsValidatorService.name);
  private readonly cache = new Map<string, CacheEntry>();
  private hits = 0;
  private misses = 0;

  constructor(
    private readonly definitions: CustomFieldsDefinitionService,
    private readonly tenantContext: TenantContextService,
  ) {}

  onModuleInit(): void {
    // Register invalidation hook so definition changes drop cache entries.
    // Defensive guard : when AppModule boots in some test contexts the
    // CustomFieldsDefinitionService dependency may not be wired yet. Skip
    // the hook in that case -- cache invalidation will still be triggered
    // by the definition service itself when registered (Sprint 8.14b
    // Session B hardening note).
    if (!this.definitions) {
      this.logger.warn(
        'CustomFieldsDefinitionService not injected at onModuleInit ; skipping invalidator registration',
      );
      return;
    }
    if (typeof this.definitions.registerInvalidator !== 'function') {
      this.logger.warn(
        'CustomFieldsDefinitionService.registerInvalidator unavailable ; skipping',
      );
      return;
    }
    this.definitions.registerInvalidator((tenantId, entityType) => {
      this.invalidateCache(tenantId, entityType);
    });
  }

  private cacheKey(tenantId: string, entityType: CustomFieldEntityTypeDto): string {
    return `cf:${tenantId}:${entityType}`;
  }

  /**
   * Builds (or fetches from cache) a Zod schema validating the custom_fields
   * jsonb payload for a given tenant + entity_type.
   *
   * The schema :
   *   - Includes one key per active definition
   *   - Applies type-specific Zod constructors + validation_rules
   *   - Marks required vs optional per definition
   *   - Uses `.strict()` so unknown keys are rejected (security)
   */
  async buildSchemaForEntity(
    entityType: CustomFieldEntityTypeDto,
  ): Promise<z.ZodObject<Record<string, ZodTypeAny>>> {
    const ctx = this.tenantContext.getCurrentContext();
    const tenantId = ctx?.tenantId;
    if (!tenantId) {
      throw new BadRequestException({
        code: VALIDATOR_ERROR_CODES.TENANT_REQUIRED,
        message: 'Tenant context required',
      });
    }

    const key = this.cacheKey(tenantId, entityType);
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      this.hits++;
      return cached.schema;
    }
    this.misses++;

    const defs = await this.definitions.findByEntityType(entityType, true);
    const shape: Record<string, ZodTypeAny> = {};
    for (const def of defs) {
      shape[def.fieldKey] = this.buildFieldSchema(def);
    }

    const schema = z.object(shape).strict();
    this.cache.set(key, { schema, expiresAt: Date.now() + CACHE_TTL_MS });
    return schema;
  }

  /**
   * Validates a `custom_fields` payload against the runtime schema. Throws a
   * NestJS BadRequestException with a code + ZodError summary on failure.
   */
  async validate(
    entityType: CustomFieldEntityTypeDto,
    customFields: unknown,
  ): Promise<Record<string, unknown>> {
    const payload = customFields ?? {};
    const schema = await this.buildSchemaForEntity(entityType);
    const result = schema.safeParse(payload);
    if (!result.success) {
      throw new BadRequestException({
        code: VALIDATOR_ERROR_CODES.INVALID_CUSTOM_FIELDS,
        message: 'custom_fields validation failed',
        issues: result.error.issues.map((iss) => ({
          path: iss.path.join('.'),
          message: iss.message,
          code: iss.code,
        })),
      });
    }
    return result.data;
  }

  /**
   * Drop the cached schema for one (tenant, entityType) pair. Called by the
   * definition service via the registered invalidator.
   */
  invalidateCache(
    tenantId: string,
    entityType: CustomFieldEntityTypeDto,
  ): void {
    const key = this.cacheKey(tenantId, entityType);
    const existed = this.cache.delete(key);
    if (existed) {
      this.logger.log(
        `crm_validator_cache_invalidated tenant=${tenantId} entity=${entityType}`,
      );
    }
  }

  /** Clear the entire cache (e.g. on global reload). */
  clearCache(): void {
    this.cache.clear();
  }

  getStats(): ValidatorStats {
    return { cacheSize: this.cache.size, hits: this.hits, misses: this.misses };
  }

  // ==========================================================================
  // Internals
  // ==========================================================================

  private buildFieldSchema(def: CrmCustomFieldDefinitionEntity): ZodTypeAny {
    let s: ZodTypeAny;
    const rules: ValidationRulesDto = (def.validationRules ?? {}) as ValidationRulesDto;
    switch (def.fieldType) {
      case 'string':
      case 'url':
      case 'email': {
        let str = z.string();
        if (rules.minLength !== undefined) str = str.min(rules.minLength);
        if (rules.maxLength !== undefined) str = str.max(rules.maxLength);
        if (rules.pattern) str = str.regex(new RegExp(rules.pattern));
        if (def.fieldType === 'email') str = str.email();
        if (def.fieldType === 'url') str = str.url();
        s = str;
        break;
      }
      case 'number': {
        let n = z.number();
        if (rules.min !== undefined) n = n.min(rules.min);
        if (rules.max !== undefined) n = n.max(rules.max);
        s = n;
        break;
      }
      case 'boolean':
        s = z.boolean();
        break;
      case 'date':
        s = z
          .string()
          .regex(
            /^\d{4}-\d{2}-\d{2}$/,
            `${def.fieldKey} must be YYYY-MM-DD`,
          );
        break;
      case 'datetime':
        s = z.string().datetime({ offset: true });
        break;
      case 'select': {
        const values = (def.options ?? []).map((o) => o.value);
        if (values.length === 0) {
          // Defensive : create() rejects this, but keep schema valid by rejecting any input.
          s = z.never();
        } else {
          s = z.enum(values as [string, ...string[]]);
        }
        break;
      }
      case 'multiselect': {
        const values = (def.options ?? []).map((o) => o.value);
        if (values.length === 0) {
          s = z.array(z.never());
        } else {
          s = z.array(z.enum(values as [string, ...string[]]));
        }
        break;
      }
      default: {
        // Exhaustiveness guard
        const _exhaustive: never = def.fieldType;
        throw new Error(`Unsupported fieldType: ${String(_exhaustive)}`);
      }
    }
    if (!def.required) {
      s = s.optional();
    }
    return s;
  }
}
