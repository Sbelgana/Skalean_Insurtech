/**
 * Tests CustomFieldsValidatorService -- Sprint 8 Tache 8.7.
 *
 * Unit tests pour le builder Zod runtime + LRU cache + strict mode + types.
 * Integration end-to-end tests Sprint 8.14.
 */

import { BadRequestException } from '@nestjs/common';
import { TenantContextService, type TenantContext } from '@insurtech/auth';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  CustomFieldsValidatorService,
  VALIDATOR_ERROR_CODES,
} from './custom-fields-validator.service.js';
import type { CustomFieldsDefinitionService } from './custom-fields-definition.service.js';

const TENANT_A = '00000000-0000-0000-0000-000000000001';
const USER_A = '00000000-0000-0000-0000-000000000002';

function buildTenantContext(tenantId: string | undefined): TenantContextService {
  return {
    getCurrentContext: (): TenantContext | undefined =>
      tenantId
        ? {
            tenantId,
            userId: USER_A,
            userRole: undefined,
            isSuperAdmin: false,
            traceId: 'trc',
            ipAddress: '127.0.0.1',
            userAgent: 'vitest',
          }
        : undefined,
  } as unknown as TenantContextService;
}

function buildDefinitions(
  defs: Array<Partial<Record<string, unknown>>>,
): { service: CustomFieldsDefinitionService; findByEntityType: ReturnType<typeof vi.fn> } {
  const findByEntityType = vi.fn().mockResolvedValue(defs);
  const registerInvalidator = vi.fn();
  return {
    service: { findByEntityType, registerInvalidator } as unknown as CustomFieldsDefinitionService,
    findByEntityType,
  };
}

function makeService(
  defs: Array<Partial<Record<string, unknown>>>,
  tenantId: string | undefined = TENANT_A,
): { service: CustomFieldsValidatorService; defs: ReturnType<typeof buildDefinitions> } {
  const definitionsMock = buildDefinitions(defs);
  const service = new CustomFieldsValidatorService(
    definitionsMock.service,
    buildTenantContext(tenantId),
  );
  service.onModuleInit();
  return { service, defs: definitionsMock };
}

describe('CustomFieldsValidatorService (Sprint 8 Tache 8.7)', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  describe('buildSchemaForEntity / validate -- per field type', () => {
    it('1. throws TENANT_REQUIRED if no tenant context', async () => {
      // Empty string bypasses TS default-parameter substitution + trips
      // buildTenantContext's falsy ternary. (Task 8.14 mock-subtlety fix.)
      const { service } = makeService([], '');
      await expect(service.buildSchemaForEntity('company')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('2. string field accepts valid value', async () => {
      const { service } = makeService([
        {
          fieldKey: 'sector',
          fieldType: 'string',
          required: false,
          validationRules: {},
        },
      ]);
      const result = await service.validate('company', { sector: 'auto' });
      expect(result).toEqual({ sector: 'auto' });
    });

    it('3. string field with maxLength rejects too long', async () => {
      const { service } = makeService([
        {
          fieldKey: 'sector',
          fieldType: 'string',
          required: false,
          validationRules: { maxLength: 3 },
        },
      ]);
      await expect(
        service.validate('company', { sector: 'too long value' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('4. number field with min/max', async () => {
      const { service } = makeService([
        {
          fieldKey: 'employees',
          fieldType: 'number',
          required: false,
          validationRules: { min: 1, max: 1000 },
        },
      ]);
      await service.validate('company', { employees: 50 });
      await expect(
        service.validate('company', { employees: 0 }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.validate('company', { employees: 9999 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('5. boolean field', async () => {
      const { service } = makeService([
        {
          fieldKey: 'is_vip',
          fieldType: 'boolean',
          required: false,
          validationRules: {},
        },
      ]);
      await service.validate('contact', { is_vip: true });
      await expect(
        service.validate('contact', { is_vip: 'yes' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('6. date field YYYY-MM-DD format', async () => {
      const { service } = makeService([
        {
          fieldKey: 'birth_date',
          fieldType: 'date',
          required: false,
          validationRules: {},
        },
      ]);
      await service.validate('contact', { birth_date: '1990-05-15' });
      await expect(
        service.validate('contact', { birth_date: 'not-a-date' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('7. datetime field ISO 8601', async () => {
      const { service } = makeService([
        {
          fieldKey: 'next_followup',
          fieldType: 'datetime',
          required: false,
          validationRules: {},
        },
      ]);
      await service.validate('deal', {
        next_followup: '2026-01-15T10:00:00+01:00',
      });
      await expect(
        service.validate('deal', { next_followup: 'invalid' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('8. email field RFC validation', async () => {
      const { service } = makeService([
        {
          fieldKey: 'alt_email',
          fieldType: 'email',
          required: false,
          validationRules: {},
        },
      ]);
      await service.validate('contact', { alt_email: 'foo@example.ma' });
      await expect(
        service.validate('contact', { alt_email: 'not-an-email' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('9. url field validation', async () => {
      const { service } = makeService([
        {
          fieldKey: 'website',
          fieldType: 'url',
          required: false,
          validationRules: {},
        },
      ]);
      await service.validate('company', { website: 'https://example.ma' });
      await expect(
        service.validate('company', { website: 'not-a-url' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('10. select field enforces options enum', async () => {
      const { service } = makeService([
        {
          fieldKey: 'tier',
          fieldType: 'select',
          required: false,
          validationRules: {},
          options: [
            { value: 'gold', label: 'Gold' },
            { value: 'silver', label: 'Silver' },
          ],
        },
      ]);
      await service.validate('contact', { tier: 'gold' });
      await expect(
        service.validate('contact', { tier: 'bronze' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('11. multiselect field accepts subset of options', async () => {
      const { service } = makeService([
        {
          fieldKey: 'tags',
          fieldType: 'multiselect',
          required: false,
          validationRules: {},
          options: [
            { value: 'urgent', label: 'Urgent' },
            { value: 'follow', label: 'Follow up' },
          ],
        },
      ]);
      await service.validate('deal', { tags: ['urgent', 'follow'] });
      await expect(
        service.validate('deal', { tags: ['urgent', 'unknown'] }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('strict mode + required', () => {
    it('12. strict mode rejects extra fields not in definitions', async () => {
      const { service } = makeService([
        {
          fieldKey: 'sector',
          fieldType: 'string',
          required: false,
          validationRules: {},
        },
      ]);
      try {
        await service.validate('company', {
          sector: 'auto',
          extra_field: 'bogus',
        });
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(BadRequestException);
        const res = (err as BadRequestException).getResponse() as {
          code?: string;
        };
        expect(res.code).toBe(VALIDATOR_ERROR_CODES.INVALID_CUSTOM_FIELDS);
      }
    });

    it('13. required field rejects missing value', async () => {
      const { service } = makeService([
        {
          fieldKey: 'cin_required',
          fieldType: 'string',
          required: true,
          validationRules: {},
        },
      ]);
      await expect(service.validate('contact', {})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('14. optional field accepts missing value', async () => {
      const { service } = makeService([
        {
          fieldKey: 'optional_note',
          fieldType: 'string',
          required: false,
          validationRules: {},
        },
      ]);
      const result = await service.validate('contact', {});
      expect(result).toEqual({});
    });

    it('15. empty definitions list -> empty object accepts {}, rejects anything else', async () => {
      const { service } = makeService([]);
      await service.validate('company', {});
      await service.validate('company', undefined);
      await expect(service.validate('company', { foo: 'bar' })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('cache', () => {
    it('16. cache hit on second call within TTL', async () => {
      const { service, defs } = makeService([
        {
          fieldKey: 'sector',
          fieldType: 'string',
          required: false,
          validationRules: {},
        },
      ]);
      await service.validate('company', { sector: 'auto' });
      await service.validate('company', { sector: 'auto' });
      expect(defs.findByEntityType).toHaveBeenCalledTimes(1);
      const stats = service.getStats();
      expect(stats.hits).toBeGreaterThanOrEqual(1);
    });

    it('17. cache miss for different entityType', async () => {
      const { service, defs } = makeService([]);
      await service.validate('company', {});
      await service.validate('deal', {});
      expect(defs.findByEntityType).toHaveBeenCalledTimes(2);
    });

    it('18. invalidateCache drops the entry', async () => {
      const { service, defs } = makeService([
        {
          fieldKey: 'sector',
          fieldType: 'string',
          required: false,
          validationRules: {},
        },
      ]);
      await service.validate('company', { sector: 'a' });
      service.invalidateCache(TENANT_A, 'company');
      await service.validate('company', { sector: 'b' });
      expect(defs.findByEntityType).toHaveBeenCalledTimes(2);
    });

    it('19. cache TTL expires after 60s', async () => {
      vi.useFakeTimers();
      const { service, defs } = makeService([
        {
          fieldKey: 'sector',
          fieldType: 'string',
          required: false,
          validationRules: {},
        },
      ]);
      await service.validate('company', { sector: 'a' });
      vi.advanceTimersByTime(61_000);
      await service.validate('company', { sector: 'b' });
      expect(defs.findByEntityType).toHaveBeenCalledTimes(2);
      vi.useRealTimers();
    });

    it('20. clearCache drops everything', async () => {
      const { service, defs } = makeService([]);
      await service.validate('company', {});
      await service.validate('deal', {});
      expect(service.getStats().cacheSize).toBe(2);
      service.clearCache();
      expect(service.getStats().cacheSize).toBe(0);
      await service.validate('company', {});
      expect(defs.findByEntityType).toHaveBeenCalledTimes(3);
    });
  });

  describe('integration with definition service', () => {
    it('21. registers invalidator on definition service at onModuleInit', () => {
      const { defs } = makeService([]);
      expect(defs.service.registerInvalidator).toHaveBeenCalledTimes(1);
    });
  });

  describe('error codes constant', () => {
    it('22. exposes expected error codes', () => {
      expect(VALIDATOR_ERROR_CODES.INVALID_CUSTOM_FIELDS).toBe(
        'CRM_VALIDATOR_INVALID_CUSTOM_FIELDS',
      );
    });
  });
});
