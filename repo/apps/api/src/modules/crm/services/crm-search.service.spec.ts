/**
 * Tests CrmSearchService -- Sprint 8 Tache 8.6.
 *
 * Unit tests avec DataSource.query mock. Integration tests pour live
 * pg_trgm performance + ranking quality seront Sprint 8.14.
 *
 * Couvrent : globalSearch happy path / filtering / per-entity / SQL parameter
 * binding correctness / tenant_id explicit defense / error codes.
 */

import { BadRequestException } from '@nestjs/common';
import { TenantContextService, type TenantContext } from '@insurtech/auth';
import { describe, expect, it, vi } from 'vitest';
import {
  CrmSearchService,
  SEARCH_ERROR_CODES,
} from './crm-search.service.js';

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

interface MockResults {
  companies?: unknown[];
  contacts?: unknown[];
  deals?: unknown[];
  interactions?: unknown[];
}

function buildService(
  mocks: MockResults = {},
  tenantId: string | undefined = TENANT_A,
): { service: CrmSearchService; queryFn: ReturnType<typeof vi.fn> } {
  const queryFn = vi.fn((sql: string) => {
    if (sql.includes('FROM crm_companies')) return Promise.resolve(mocks.companies ?? []);
    if (sql.includes('FROM crm_contacts')) return Promise.resolve(mocks.contacts ?? []);
    if (sql.includes('FROM crm_deals')) return Promise.resolve(mocks.deals ?? []);
    if (sql.includes('FROM crm_interactions'))
      return Promise.resolve(mocks.interactions ?? []);
    return Promise.resolve([]);
  });
  const dataSource = { query: queryFn } as unknown;
  const service = new CrmSearchService(dataSource as never, buildTenantContext(tenantId));
  return { service, queryFn };
}

describe('CrmSearchService (Sprint 8 Tache 8.6)', () => {
  describe('globalSearch', () => {
    it('1. throws TENANT_REQUIRED if no tenant context', async () => {
      // Empty string bypasses TS default-parameter substitution + trips
      // buildTenantContext's falsy ternary. (Task 8.14 mock-subtlety fix.)
      const { service } = buildService({}, '');
      await expect(
        service.globalSearch({
          q: 'Casa',
          entityTypes: ['company'],
          limit: 20,
          similarityThreshold: 0.3,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('2. returns grouped results across 4 entity types', async () => {
      const { service, queryFn } = buildService({
        companies: [
          {
            id: 'c1',
            name: 'Casablanca Auto',
            ice: null,
            city: 'Casablanca',
            industry: null,
            score: '0.5',
          },
        ],
        contacts: [
          {
            id: 'p1',
            first_name: 'Mohamed',
            last_name: 'Bennani',
            full_name: 'Mohamed Bennani',
            email: null,
            phone: null,
            company_id: 'c1',
            score: '0.4',
          },
        ],
        deals: [
          {
            id: 'd1',
            name: 'Renouvellement Casa',
            description: null,
            amount: '50000.00',
            currency: 'MAD',
            pipeline_id: 'pl1',
            stage_id: 's1',
            company_id: 'c1',
            score: '0.6',
          },
        ],
        interactions: [
          {
            id: 'i1',
            type: 'call',
            subject: 'Casa appel',
            body_excerpt: null,
            occurred_at: new Date('2026-01-15'),
            company_id: 'c1',
            contact_id: null,
            deal_id: null,
            score: '0.7',
          },
        ],
      });
      const result = await service.globalSearch({
        q: 'Casa',
        entityTypes: ['company', 'contact', 'deal', 'interaction'],
        limit: 20,
        similarityThreshold: 0.3,
      });
      expect(result.query).toBe('Casa');
      expect(result.companies).toHaveLength(1);
      expect(result.contacts).toHaveLength(1);
      expect(result.deals).toHaveLength(1);
      expect(result.interactions).toHaveLength(1);
      expect(queryFn).toHaveBeenCalledTimes(4);
    });

    it('3. honours entityTypes filter (only companies queried)', async () => {
      const { service, queryFn } = buildService({
        companies: [
          {
            id: 'c1',
            name: 'Atlas Garage',
            ice: '001234567890123',
            city: null,
            industry: null,
            score: '0.55',
          },
        ],
      });
      const result = await service.globalSearch({
        q: 'Atlas',
        entityTypes: ['company'],
        limit: 20,
        similarityThreshold: 0.3,
      });
      expect(result.companies).toHaveLength(1);
      expect(result.contacts).toEqual([]);
      expect(result.deals).toEqual([]);
      expect(result.interactions).toEqual([]);
      // Only ONE SQL roundtrip
      expect(queryFn).toHaveBeenCalledTimes(1);
    });

    it('4. honours similarity threshold parameter in SQL binding', async () => {
      const { service, queryFn } = buildService({});
      await service.globalSearch({
        q: 'Tanger',
        entityTypes: ['company'],
        limit: 10,
        similarityThreshold: 0.5,
      });
      const call = queryFn.mock.calls[0]!;
      const params = call[1] as unknown[];
      // params : [q, tenantId, ilikePattern, similarityThreshold, limit]
      expect(params[0]).toBe('Tanger');
      expect(params[1]).toBe(TENANT_A);
      expect(params[3]).toBe(0.5);
      expect(params[4]).toBe(10);
    });

    it('5. tenantId always bound explicitly (defense in depth vs RLS)', async () => {
      const { service, queryFn } = buildService({});
      await service.globalSearch({
        q: 'Rabat',
        entityTypes: ['company', 'contact'],
        limit: 20,
        similarityThreshold: 0.3,
      });
      for (const call of queryFn.mock.calls) {
        const params = call[1] as unknown[];
        expect(params[1]).toBe(TENANT_A);
      }
    });
  });

  describe('searchCompanies', () => {
    it('6. maps rows with score conversion', async () => {
      const { service } = buildService({
        companies: [
          {
            id: 'c1',
            name: 'Atlas',
            ice: null,
            city: 'Rabat',
            industry: 'auto',
            score: '0.42',
          },
        ],
      });
      const result = await service.searchCompanies({
        q: 'Atl',
        limit: 50,
        similarityThreshold: 0.3,
      });
      expect(result[0]?.id).toBe('c1');
      expect(result[0]?.score).toBe(0.42);
    });

    it('7. WHERE includes tenant_id + deleted_at IS NULL', async () => {
      const { service, queryFn } = buildService({});
      await service.searchCompanies({ q: 'Test', limit: 10, similarityThreshold: 0.3 });
      const sql = queryFn.mock.calls[0]?.[0] as string;
      expect(sql).toContain('tenant_id = $2');
      expect(sql).toContain('deleted_at IS NULL');
    });
  });

  describe('searchContacts', () => {
    it('8. uses full_name GENERATED STORED column (matches Sprint 2 GIN idx)', async () => {
      const { service, queryFn } = buildService({});
      await service.searchContacts({ q: 'Mohamed', limit: 50, similarityThreshold: 0.3 });
      const sql = queryFn.mock.calls[0]?.[0] as string;
      expect(sql).toContain('similarity(full_name, $1)');
      expect(sql).toContain('full_name ILIKE $3');
    });

    it('9. supports email exact match (case-insensitive)', async () => {
      const { service, queryFn } = buildService({
        contacts: [
          {
            id: 'p1',
            first_name: 'X',
            last_name: 'Y',
            full_name: 'X Y',
            email: 'foo@example.ma',
            phone: null,
            company_id: null,
            score: '1.0',
          },
        ],
      });
      await service.searchContacts({
        q: 'FOO@example.ma',
        limit: 50,
        similarityThreshold: 0.3,
      });
      const sql = queryFn.mock.calls[0]?.[0] as string;
      expect(sql).toContain('LOWER(email::text) = LOWER($1)');
    });

    it('10. maps phone field', async () => {
      const { service } = buildService({
        contacts: [
          {
            id: 'p1',
            first_name: 'X',
            last_name: 'Y',
            full_name: 'X Y',
            email: null,
            phone: '+212612345678',
            company_id: null,
            score: '0.9',
          },
        ],
      });
      const result = await service.searchContacts({
        q: 'X',
        limit: 50,
        similarityThreshold: 0.3,
      });
      expect(result[0]?.phone).toBe('+212612345678');
    });
  });

  describe('searchDeals', () => {
    it('11. excludes soft-deleted via WHERE deleted_at IS NULL', async () => {
      const { service, queryFn } = buildService({});
      await service.searchDeals({ q: 'Renouvellement', limit: 50, similarityThreshold: 0.3 });
      const sql = queryFn.mock.calls[0]?.[0] as string;
      expect(sql).toContain('deleted_at IS NULL');
    });

    it('12. ranks across name AND description', async () => {
      const { service, queryFn } = buildService({});
      await service.searchDeals({ q: 'sante', limit: 50, similarityThreshold: 0.3 });
      const sql = queryFn.mock.calls[0]?.[0] as string;
      expect(sql).toContain('similarity(name, $1)');
      expect(sql).toContain('similarity(description, $1)');
    });

    it('13. returns amount as string (numeric precision preserved)', async () => {
      const { service } = buildService({
        deals: [
          {
            id: 'd1',
            name: 'X',
            description: null,
            amount: '123456789.99',
            currency: 'MAD',
            pipeline_id: 'pl1',
            stage_id: 's1',
            company_id: 'c1',
            score: '0.4',
          },
        ],
      });
      const result = await service.searchDeals({
        q: 'X',
        limit: 50,
        similarityThreshold: 0.3,
      });
      expect(result[0]?.amount).toBe('123456789.99');
      expect(typeof result[0]?.amount).toBe('string');
    });
  });

  describe('searchInteractions', () => {
    it('14. uses substring(body, 1, 5000) to match GIN index expression', async () => {
      const { service, queryFn } = buildService({});
      await service.searchInteractions({
        q: 'follow-up',
        limit: 50,
        similarityThreshold: 0.3,
      });
      const sql = queryFn.mock.calls[0]?.[0] as string;
      expect(sql).toContain('similarity(substring(body, 1, 5000), $1)');
    });

    it('15. excludes soft-deleted interactions', async () => {
      const { service, queryFn } = buildService({});
      await service.searchInteractions({
        q: 'meeting',
        limit: 50,
        similarityThreshold: 0.3,
      });
      const sql = queryFn.mock.calls[0]?.[0] as string;
      expect(sql).toContain('deleted_at IS NULL');
    });

    it('16. returns body_excerpt truncated (280 chars)', async () => {
      const { service } = buildService({
        interactions: [
          {
            id: 'i1',
            type: 'note',
            subject: 'Long',
            body_excerpt: 'a'.repeat(280),
            occurred_at: new Date(),
            company_id: 'c1',
            contact_id: null,
            deal_id: null,
            score: '0.4',
          },
        ],
      });
      const result = await service.searchInteractions({
        q: 'a',
        limit: 50,
        similarityThreshold: 0.3,
      });
      expect(result[0]?.bodyExcerpt).toBe('a'.repeat(280));
    });
  });

  describe('error codes constant', () => {
    it('17. exposes expected error codes', () => {
      expect(SEARCH_ERROR_CODES.TENANT_REQUIRED).toBe('CRM_SEARCH_TENANT_REQUIRED');
    });
  });
});
