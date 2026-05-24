/**
 * CompaniesService -- Sprint 8 Tache 8.1 (Phase 3 Sprint 1).
 *
 * CRUD + search full-text trigram pour crm_companies.
 *
 * Multi-tenant strict :
 *   - tenant_id automatique via TenantContext + RLS
 *   - Tous les inserts/updates filtres par tenant_id courant (RLS enforce)
 *
 * Heritage Sprint 7.5b :
 *   - app_can_access_tenant() v3.0 helper applique automatiquement
 *   - GRANT TO insurtech_app deja applique (post-migration-grants Sprint 7.5b.0)
 *
 * Sprint 8.6 ajoutera full-text search via pg_trgm + GIN indexes (extension Sprint 1).
 *
 * Reference : B-08 Tache 3.1.1.
 */

import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { TenantContextService } from '@insurtech/auth';
import {
  type CompanyFiltersDto,
  type CreateCompanyDto,
  type UpdateCompanyDto,
  validateIce,
} from '@insurtech/crm';
import { CrmCompanyEntity, type DataSource } from '@insurtech/database';
import { DATA_SOURCE_TOKEN } from '../../../database/data-source.provider.js';
import { CustomFieldsValidatorService } from './custom-fields-validator.service.js';

export interface PaginatedCompanies {
  readonly items: readonly CrmCompanyEntity[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

export const COMPANY_ERROR_CODES = {
  TENANT_REQUIRED: 'CRM_COMPANY_TENANT_REQUIRED',
  ICE_INVALID: 'CRM_COMPANY_ICE_INVALID',
  ICE_DUPLICATE: 'CRM_COMPANY_ICE_DUPLICATE',
  NOT_FOUND: 'CRM_COMPANY_NOT_FOUND',
} as const;

@Injectable()
export class CompaniesService {
  private readonly logger = new Logger(CompaniesService.name);

  constructor(
    @Inject(DATA_SOURCE_TOKEN) private readonly dataSource: DataSource,
    private readonly tenantContext: TenantContextService,
    /**
     * Optional : when provided, `customFields` payloads on create/update are
     * validated against the tenant's `crm_custom_field_definitions` (Task 8.7).
     * Optional so unit tests can construct the service without wiring the
     * validator. Sprint 8 Task 8.14 (D3 -- hooks integration).
     */
    @Optional()
    private readonly customFieldsValidator?: CustomFieldsValidatorService,
  ) {}

  /** Validates dto.customFields if provided + validator is wired. */
  private async resolveCustomFields(
    customFields: Record<string, unknown> | undefined,
  ): Promise<Record<string, unknown> | undefined> {
    if (customFields === undefined) return undefined;
    if (!this.customFieldsValidator) return customFields;
    return this.customFieldsValidator.validate('company', customFields);
  }

  private getRepo() {
    return this.dataSource.getRepository(CrmCompanyEntity);
  }

  private requireTenantId(): string {
    const ctx = this.tenantContext.getCurrentContext();
    const tenantId = ctx?.tenantId;
    if (!tenantId) {
      throw new BadRequestException({
        code: COMPANY_ERROR_CODES.TENANT_REQUIRED,
        message: 'Tenant context required',
      });
    }
    return tenantId;
  }

  /**
   * Cree une nouvelle company dans le tenant courant.
   *
   * Validations :
   * - ICE optional, mais si fourni doit passer validateIce (15 digits + checksum DGI)
   * - ICE unique par tenant (idx_crm_companies_ice_tenant_uq sera ajoute Sprint 8.6+)
   */
  async create(dto: CreateCompanyDto, createdByUserId: string): Promise<CrmCompanyEntity> {
    const tenantId = this.requireTenantId();
    const repo = this.getRepo();

    if (dto.ice !== undefined) {
      const iceCheck = validateIce(dto.ice);
      if (!iceCheck.valid) {
        throw new BadRequestException({
          code: COMPANY_ERROR_CODES.ICE_INVALID,
          message: `ICE invalide : ${iceCheck.reason}`,
        });
      }
      // Check uniqueness intra-tenant (RLS automatique)
      const existing = await repo.findOne({
        where: { tenantId, ice: iceCheck.normalized ?? dto.ice },
      });
      if (existing && !existing.deletedAt) {
        throw new ConflictException({
          code: COMPANY_ERROR_CODES.ICE_DUPLICATE,
          message: `Company avec ICE ${dto.ice} existe deja`,
        });
      }
    }

    const validatedCustom = await this.resolveCustomFields(dto.customFields);

    const entity = repo.create({
      tenantId,
      name: dto.name,
      industry: dto.industry ?? null,
      ice: dto.ice ?? null,
      rc: dto.rc ?? null,
      patente: dto.patente ?? null,
      address: dto.address ?? null,
      city: dto.city ?? null,
      country: dto.country ?? 'MA',
      phone: dto.phone ?? null,
      email: dto.email ?? null,
      website: dto.website ?? null,
      ownerUserId: dto.ownerUserId ?? null,
      tags: dto.tags ?? [],
      notes: dto.notes ?? null,
      ...(validatedCustom !== undefined ? { customFields: validatedCustom } : {}),
      createdBy: createdByUserId,
      updatedBy: createdByUserId,
    });

    const saved = await repo.save(entity);
    this.logger.log(
      `crm_company_created id=${saved.id} name=${saved.name} tenant=${tenantId} by=${createdByUserId}`,
    );
    return saved;
  }

  /**
   * Liste companies avec filters + pagination.
   * RLS scope automatique sur tenant courant.
   */
  async list(filters: CompanyFiltersDto): Promise<PaginatedCompanies> {
    const tenantId = this.requireTenantId();
    const repo = this.getRepo();

    const qb = repo
      .createQueryBuilder('c')
      .where('c.tenant_id = :tenantId', { tenantId })
      .andWhere('c.deleted_at IS NULL');

    if (filters.q) {
      // Sprint 8.6 remplacera par pg_trgm GIN index search ; ILIKE pour MVP Sprint 8.1
      qb.andWhere('(c.name ILIKE :q OR c.email ILIKE :q OR c.city ILIKE :q)', {
        q: `%${filters.q}%`,
      });
    }
    if (filters.industry) {
      qb.andWhere('c.industry = :industry', { industry: filters.industry });
    }
    if (filters.city) {
      qb.andWhere('c.city = :city', { city: filters.city });
    }
    if (filters.ownerUserId) {
      qb.andWhere('c.owner_user_id = :ownerUserId', { ownerUserId: filters.ownerUserId });
    }
    if (filters.tags && filters.tags.length > 0) {
      qb.andWhere('c.tags && :tags', { tags: filters.tags });
    }

    const orderColumnMap: Record<string, string> = {
      name: 'c.name',
      created_at: 'c.created_at',
      updated_at: 'c.updated_at',
    };
    const orderColumn = orderColumnMap[filters.orderBy] ?? 'c.created_at';
    qb.orderBy(orderColumn, filters.orderDir);

    qb.skip(filters.offset).take(filters.limit);

    const [items, total] = await qb.getManyAndCount();

    return {
      items,
      total,
      limit: filters.limit,
      offset: filters.offset,
    };
  }

  /** Recupere une company par id (RLS automatique). */
  async findOne(id: string): Promise<CrmCompanyEntity> {
    const tenantId = this.requireTenantId();
    const repo = this.getRepo();
    const company = await repo.findOne({
      where: { id, tenantId },
    });
    if (!company || company.deletedAt) {
      throw new NotFoundException({
        code: COMPANY_ERROR_CODES.NOT_FOUND,
        message: `Company ${id} introuvable`,
      });
    }
    return company;
  }

  /**
   * Met a jour partiellement une company.
   * Champs non specifies dans dto = inchanges.
   */
  async update(
    id: string,
    dto: UpdateCompanyDto,
    updatedByUserId: string,
  ): Promise<CrmCompanyEntity> {
    const existing = await this.findOne(id);

    if (dto.ice !== undefined && dto.ice !== existing.ice) {
      const iceCheck = validateIce(dto.ice);
      if (!iceCheck.valid) {
        throw new BadRequestException({
          code: COMPANY_ERROR_CODES.ICE_INVALID,
          message: `ICE invalide : ${iceCheck.reason}`,
        });
      }
    }

    const repo = this.getRepo();
    const updates: Record<string, unknown> = {
      updated_by: updatedByUserId,
    };
    if (dto.name !== undefined) updates['name'] = dto.name;
    if (dto.industry !== undefined) updates['industry'] = dto.industry ?? null;
    if (dto.ice !== undefined) updates['ice'] = dto.ice ?? null;
    if (dto.rc !== undefined) updates['rc'] = dto.rc ?? null;
    if (dto.patente !== undefined) updates['patente'] = dto.patente ?? null;
    if (dto.address !== undefined) updates['address'] = dto.address ?? null;
    if (dto.city !== undefined) updates['city'] = dto.city ?? null;
    if (dto.country !== undefined) updates['country'] = dto.country;
    if (dto.phone !== undefined) updates['phone'] = dto.phone ?? null;
    if (dto.email !== undefined) updates['email'] = dto.email ?? null;
    if (dto.website !== undefined) updates['website'] = dto.website ?? null;
    if (dto.ownerUserId !== undefined) updates['owner_user_id'] = dto.ownerUserId ?? null;
    if (dto.tags !== undefined) updates['tags'] = dto.tags;
    if (dto.notes !== undefined) updates['notes'] = dto.notes ?? null;
    if (dto.customFields !== undefined) {
      updates['custom_fields'] = await this.resolveCustomFields(dto.customFields);
    }

    await repo
      .createQueryBuilder()
      .update(CrmCompanyEntity)
      .set(updates)
      .where('id = :id', { id: existing.id })
      .execute();
    const updated = await this.findOne(id);
    this.logger.log(
      `crm_company_updated id=${id} fields=[${Object.keys(updates).join(',')}] by=${updatedByUserId}`,
    );
    return updated;
  }

  /** Soft delete (deleted_at) -- preserve audit trail. */
  async softDelete(id: string, deletedByUserId: string): Promise<void> {
    const existing = await this.findOne(id);
    const repo = this.getRepo();
    await repo
      .createQueryBuilder()
      .update(CrmCompanyEntity)
      .set({ deleted_at: new Date(), updated_by: deletedByUserId } as unknown as Record<
        string,
        unknown
      >)
      .where('id = :id', { id: existing.id })
      .execute();
    this.logger.log(`crm_company_soft_deleted id=${id} by=${deletedByUserId}`);
  }
}
