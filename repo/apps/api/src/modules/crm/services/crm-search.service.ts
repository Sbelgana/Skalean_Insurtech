/**
 * CrmSearchService -- Sprint 8 Tache 8.6 (Phase 3 Sprint 1).
 *
 * Full-Text Search cross-entity via pg_trgm GIN indexes (Sprint 2 + Tasks
 * 8.1-8.5 + migration 019).
 *
 * Entities indexees :
 *   - crm_companies : name, email (GIN trgm)
 *   - crm_contacts : full_name (GENERATED STORED), email, phone
 *   - crm_deals : name, description
 *   - crm_interactions : subject, body (substring 5000)
 *
 * Ranking : similarity(column, $query) DESC. Threshold tunable per query
 * (default 0.3 -- pg_trgm Postgres default).
 *
 * Multi-tenant defense in depth :
 *   - RLS Sprint 6 auto-filtre par tenant_id
 *   - WHERE tenant_id = $X explicite dans queries (planner hint + double check)
 *
 * Soft-delete :
 *   - crm_companies/contacts/deals/interactions tous filtres `deleted_at IS NULL`
 *   - (les indexes trgm sont eux-memes partials sur WHERE deleted_at IS NULL,
 *      query planner les utilise naturellement)
 *
 * Reference : B-08 Tache 3.1.6.
 */

import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { TenantContextService } from '@insurtech/auth';
import type {
  EntityScopedSearchDto,
  GlobalSearchDto,
  SearchEntityType,
} from '@insurtech/crm';
import type { DataSource } from '@insurtech/database';
import { DATA_SOURCE_TOKEN } from '../../../database/data-source.provider.js';

export interface CompanySearchHit {
  readonly id: string;
  readonly name: string;
  readonly ice: string | null;
  readonly city: string | null;
  readonly industry: string | null;
  readonly score: number;
}

export interface ContactSearchHit {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly fullName: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly companyId: string | null;
  readonly score: number;
}

export interface DealSearchHit {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly amount: string;
  readonly currency: string;
  readonly pipelineId: string;
  readonly stageId: string;
  readonly companyId: string;
  readonly score: number;
}

export interface InteractionSearchHit {
  readonly id: string;
  readonly type: string;
  readonly subject: string;
  readonly bodyExcerpt: string | null;
  readonly occurredAt: Date;
  readonly companyId: string | null;
  readonly contactId: string | null;
  readonly dealId: string | null;
  readonly score: number;
}

export interface GlobalSearchResult {
  readonly query: string;
  readonly companies: readonly CompanySearchHit[];
  readonly contacts: readonly ContactSearchHit[];
  readonly deals: readonly DealSearchHit[];
  readonly interactions: readonly InteractionSearchHit[];
}

export const SEARCH_ERROR_CODES = {
  TENANT_REQUIRED: 'CRM_SEARCH_TENANT_REQUIRED',
} as const;

@Injectable()
export class CrmSearchService {
  private readonly logger = new Logger(CrmSearchService.name);

  constructor(
    @Inject(DATA_SOURCE_TOKEN) private readonly dataSource: DataSource,
    private readonly tenantContext: TenantContextService,
  ) {}

  private requireTenantId(): string {
    const ctx = this.tenantContext.getCurrentContext();
    const tenantId = ctx?.tenantId;
    if (!tenantId) {
      throw new BadRequestException({
        code: SEARCH_ERROR_CODES.TENANT_REQUIRED,
        message: 'Tenant context required',
      });
    }
    return tenantId;
  }

  // ==========================================================================
  // Global search (grouped per entity)
  // ==========================================================================

  async globalSearch(dto: GlobalSearchDto): Promise<GlobalSearchResult> {
    const tenantId = this.requireTenantId();
    const start = Date.now();
    const want = (type: SearchEntityType): boolean => dto.entityTypes.includes(type);

    const [companies, contacts, deals, interactions] = await Promise.all([
      want('company')
        ? this.searchCompanies({
            q: dto.q,
            limit: dto.limit,
            similarityThreshold: dto.similarityThreshold,
          })
        : Promise.resolve([] as CompanySearchHit[]),
      want('contact')
        ? this.searchContacts({
            q: dto.q,
            limit: dto.limit,
            similarityThreshold: dto.similarityThreshold,
          })
        : Promise.resolve([] as ContactSearchHit[]),
      want('deal')
        ? this.searchDeals({
            q: dto.q,
            limit: dto.limit,
            similarityThreshold: dto.similarityThreshold,
          })
        : Promise.resolve([] as DealSearchHit[]),
      want('interaction')
        ? this.searchInteractions({
            q: dto.q,
            limit: dto.limit,
            similarityThreshold: dto.similarityThreshold,
          })
        : Promise.resolve([] as InteractionSearchHit[]),
    ]);

    const elapsedMs = Date.now() - start;
    this.logger.log(
      `crm_search_global tenant=${tenantId} q="${dto.q}" types=[${dto.entityTypes.join(',')}] hits=companies:${companies.length}/contacts:${contacts.length}/deals:${deals.length}/interactions:${interactions.length} elapsed_ms=${elapsedMs}`,
    );

    return {
      query: dto.q,
      companies,
      contacts,
      deals,
      interactions,
    };
  }

  // ==========================================================================
  // Per-entity searches
  // ==========================================================================

  async searchCompanies(dto: EntityScopedSearchDto): Promise<CompanySearchHit[]> {
    const tenantId = this.requireTenantId();
    const rows = await this.dataSource.query<
      Array<{
        id: string;
        name: string;
        ice: string | null;
        city: string | null;
        industry: string | null;
        score: string;
      }>
    >(
      `
      SELECT id, name, ice, city, industry,
        GREATEST(
          similarity(name, $1),
          CASE WHEN email IS NOT NULL THEN similarity(email::text, $1) ELSE 0 END
        ) AS score
      FROM crm_companies
      WHERE tenant_id = $2
        AND deleted_at IS NULL
        AND (
          name ILIKE $3
          OR similarity(name, $1) > $4
          OR (email IS NOT NULL AND email::text ILIKE $3)
        )
      ORDER BY score DESC, name ASC
      LIMIT $5
      `,
      [dto.q, tenantId, `%${dto.q}%`, dto.similarityThreshold, dto.limit],
    );
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      ice: r.ice,
      city: r.city,
      industry: r.industry,
      score: Number(r.score),
    }));
  }

  async searchContacts(dto: EntityScopedSearchDto): Promise<ContactSearchHit[]> {
    const tenantId = this.requireTenantId();
    const rows = await this.dataSource.query<
      Array<{
        id: string;
        first_name: string;
        last_name: string;
        full_name: string;
        email: string | null;
        phone: string | null;
        company_id: string | null;
        score: string;
      }>
    >(
      `
      SELECT id, first_name, last_name, full_name, email, phone, company_id,
        GREATEST(
          similarity(full_name, $1),
          CASE WHEN email IS NOT NULL THEN similarity(email::text, $1) ELSE 0 END,
          CASE WHEN phone IS NOT NULL THEN similarity(phone, $1) ELSE 0 END
        ) AS score
      FROM crm_contacts
      WHERE tenant_id = $2
        AND deleted_at IS NULL
        AND (
          full_name ILIKE $3
          OR similarity(full_name, $1) > $4
          OR (email IS NOT NULL AND LOWER(email::text) = LOWER($1))
          OR (phone IS NOT NULL AND phone ILIKE $3)
        )
      ORDER BY score DESC, full_name ASC
      LIMIT $5
      `,
      [dto.q, tenantId, `%${dto.q}%`, dto.similarityThreshold, dto.limit],
    );
    return rows.map((r) => ({
      id: r.id,
      firstName: r.first_name,
      lastName: r.last_name,
      fullName: r.full_name,
      email: r.email,
      phone: r.phone,
      companyId: r.company_id,
      score: Number(r.score),
    }));
  }

  async searchDeals(dto: EntityScopedSearchDto): Promise<DealSearchHit[]> {
    const tenantId = this.requireTenantId();
    const rows = await this.dataSource.query<
      Array<{
        id: string;
        name: string;
        description: string | null;
        amount: string;
        currency: string;
        pipeline_id: string;
        stage_id: string;
        company_id: string;
        score: string;
      }>
    >(
      `
      SELECT id, name, description, amount, currency, pipeline_id, stage_id, company_id,
        GREATEST(
          similarity(name, $1),
          CASE WHEN description IS NOT NULL THEN similarity(description, $1) ELSE 0 END
        ) AS score
      FROM crm_deals
      WHERE tenant_id = $2
        AND deleted_at IS NULL
        AND (
          name ILIKE $3
          OR similarity(name, $1) > $4
          OR (description IS NOT NULL AND similarity(description, $1) > $4)
        )
      ORDER BY score DESC, name ASC
      LIMIT $5
      `,
      [dto.q, tenantId, `%${dto.q}%`, dto.similarityThreshold, dto.limit],
    );
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      amount: r.amount,
      currency: r.currency,
      pipelineId: r.pipeline_id,
      stageId: r.stage_id,
      companyId: r.company_id,
      score: Number(r.score),
    }));
  }

  async searchInteractions(
    dto: EntityScopedSearchDto,
  ): Promise<InteractionSearchHit[]> {
    const tenantId = this.requireTenantId();
    // body index is on `substring(body, 1, 5000)` so we mirror that in the
    // similarity comparison to use the GIN index.
    const rows = await this.dataSource.query<
      Array<{
        id: string;
        type: string;
        subject: string;
        body_excerpt: string | null;
        occurred_at: Date;
        company_id: string | null;
        contact_id: string | null;
        deal_id: string | null;
        score: string;
      }>
    >(
      `
      SELECT id, type::text AS type, subject,
        substring(body, 1, 280) AS body_excerpt,
        occurred_at, company_id, contact_id, deal_id,
        GREATEST(
          similarity(subject, $1),
          CASE WHEN body IS NOT NULL
            THEN similarity(substring(body, 1, 5000), $1)
            ELSE 0
          END
        ) AS score
      FROM crm_interactions
      WHERE tenant_id = $2
        AND deleted_at IS NULL
        AND (
          subject ILIKE $3
          OR similarity(subject, $1) > $4
          OR (body IS NOT NULL AND similarity(substring(body, 1, 5000), $1) > $4)
        )
      ORDER BY score DESC, occurred_at DESC
      LIMIT $5
      `,
      [dto.q, tenantId, `%${dto.q}%`, dto.similarityThreshold, dto.limit],
    );
    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      subject: r.subject,
      bodyExcerpt: r.body_excerpt,
      occurredAt: r.occurred_at,
      companyId: r.company_id,
      contactId: r.contact_id,
      dealId: r.deal_id,
      score: Number(r.score),
    }));
  }
}
