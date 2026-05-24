/**
 * CrmSearchController -- Sprint 8 Tache 8.6.
 *
 * Endpoints REST pour cross-CRM Full-Text Search (pg_trgm).
 *
 * Routes :
 *   GET /api/v1/crm/search                   (CRM_SEARCH_READ)
 *   GET /api/v1/crm/search/companies         (CRM_SEARCH_READ + CRM_COMPANIES_READ -- combined via OR via separate endpoint)
 *   GET /api/v1/crm/search/contacts          (CRM_SEARCH_READ)
 *   GET /api/v1/crm/search/deals             (CRM_SEARCH_READ)
 *   GET /api/v1/crm/search/interactions      (CRM_SEARCH_READ)
 *
 * Reference : B-08 Tache 3.1.6.
 */

import { Controller, Get, Query } from '@nestjs/common';
import { Permission } from '@insurtech/auth';
import {
  EntityScopedSearchSchema,
  GlobalSearchSchema,
  type EntityScopedSearchDto,
  type GlobalSearchDto,
} from '@insurtech/crm';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator.js';
import { RequireTenant } from '../../../common/decorators/require-tenant.decorator.js';
import { CrmSearchService } from '../services/crm-search.service.js';

@Controller('api/v1/crm/search')
@RequireTenant()
export class CrmSearchController {
  constructor(private readonly search: CrmSearchService) {}

  /**
   * Cross-entity global search. Returns grouped results :
   *   { query, companies: [], contacts: [], deals: [], interactions: [] }
   *
   * Query string :
   *   - q              : required, 2..200 chars
   *   - entityTypes    : optional CSV string e.g. "company,deal"
   *                      (will be coerced to array by Zod since query strings are flat)
   *   - limit          : optional, default 20, max 50 per entity
   *   - similarityThreshold : optional, default 0.3
   */
  @Get()
  @RequirePermission(Permission.CRM_SEARCH_READ)
  async global(@Query() query: Record<string, unknown>) {
    // Coerce comma-separated `entityTypes` query param to array, since query
    // strings come in as either string or string[].
    const normalized = this.normalizeEntityTypes(query);
    const dto = GlobalSearchSchema.parse(normalized) satisfies GlobalSearchDto;
    return this.search.globalSearch(dto);
  }

  @Get('companies')
  @RequirePermission(Permission.CRM_SEARCH_READ)
  async companies(@Query() query: unknown) {
    const dto = EntityScopedSearchSchema.parse(query) satisfies EntityScopedSearchDto;
    return this.search.searchCompanies(dto);
  }

  @Get('contacts')
  @RequirePermission(Permission.CRM_SEARCH_READ)
  async contacts(@Query() query: unknown) {
    const dto = EntityScopedSearchSchema.parse(query) satisfies EntityScopedSearchDto;
    return this.search.searchContacts(dto);
  }

  @Get('deals')
  @RequirePermission(Permission.CRM_SEARCH_READ)
  async deals(@Query() query: unknown) {
    const dto = EntityScopedSearchSchema.parse(query) satisfies EntityScopedSearchDto;
    return this.search.searchDeals(dto);
  }

  @Get('interactions')
  @RequirePermission(Permission.CRM_SEARCH_READ)
  async interactions(@Query() query: unknown) {
    const dto = EntityScopedSearchSchema.parse(query) satisfies EntityScopedSearchDto;
    return this.search.searchInteractions(dto);
  }

  /**
   * Normalize `entityTypes` query param :
   *   - "company"             -> ["company"]
   *   - "company,contact"     -> ["company", "contact"]
   *   - ["company", "deal"]   -> ["company", "deal"] (already array)
   *   - undefined             -> undefined (Zod default kicks in)
   */
  private normalizeEntityTypes(
    query: Record<string, unknown>,
  ): Record<string, unknown> {
    const raw = query['entityTypes'];
    if (raw === undefined || Array.isArray(raw)) return query;
    if (typeof raw === 'string') {
      return {
        ...query,
        entityTypes: raw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      };
    }
    return query;
  }
}
