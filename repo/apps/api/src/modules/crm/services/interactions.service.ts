/**
 * InteractionsService -- Sprint 8 Tache 8.5 (Phase 3 Sprint 1).
 *
 * Append-only Hybrid (Sprint 2 + 8.5) :
 *   - INSERT : permis (CREATE permission)
 *   - UPDATE : interdit (trigger DB Sprint 2)
 *   - DELETE : interdit (trigger DB)
 *   - soft-delete + restore : via SECURITY DEFINER functions
 *     (`crm_interactions_soft_delete` / `crm_interactions_restore`) qui
 *     bypassent le trigger via session GUC `app.archivist_bypass=true`.
 *   - Annotation : nouvelle interaction avec parent_interaction_id.
 *
 * Polymorphisme Option B : exactly one of company_id / contact_id / deal_id.
 *
 * Timeline cross-entity :
 *   - timelineForCompany : interactions ON company + contacts.company_id + deals.company_id
 *   - timelineForContact : interactions ON contact + company + deals.contact_id
 *   - timelineForDeal    : interactions ON deal + company + contact
 *
 * Permissions :
 *   - CRM_INTERACTIONS_CREATE / READ / SOFT_DELETE / RESTORE (catalog Sprint 7.5a +8.5)
 *
 * Audit Pino structured (Loi 09-08 CNDP) :
 *   - log every create / soft-delete / restore / annotate.
 *   - Kafka events Sprint 9+ (deferred per orchestrateur B-08).
 *
 * Reference : B-08 Tache 3.1.5.
 */

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  HierarchyResolver,
  Permission,
  TenantContextService,
  type AuthRole,
} from '@insurtech/auth';
import {
  type AnnotateInteractionDto,
  type CreateInteractionDto,
  type FilterInteractionsDto,
  type TimelineQueryDto,
} from '@insurtech/crm';
import {
  CrmCompanyEntity,
  CrmContactEntity,
  CrmDealEntity,
  CrmInteractionEntity,
  type DataSource,
  type EntityManager,
} from '@insurtech/database';
import { DATA_SOURCE_TOKEN } from '../../../database/data-source.provider.js';
import { CustomFieldsValidatorService } from './custom-fields-validator.service.js';

export interface PaginatedInteractions {
  readonly items: readonly CrmInteractionEntity[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

export type RelatedEntityType = 'company' | 'contact' | 'deal';

export const INTERACTION_ERROR_CODES = {
  TENANT_REQUIRED: 'CRM_INTERACTION_TENANT_REQUIRED',
  RELATED_NOT_FOUND: 'CRM_INTERACTION_RELATED_NOT_FOUND',
  RELATED_AMBIGUOUS: 'CRM_INTERACTION_RELATED_AMBIGUOUS',
  PARENT_NOT_FOUND: 'CRM_INTERACTION_PARENT_NOT_FOUND',
  NOT_FOUND: 'CRM_INTERACTION_NOT_FOUND',
  ALREADY_DELETED: 'CRM_INTERACTION_ALREADY_DELETED',
  NOT_DELETED: 'CRM_INTERACTION_NOT_DELETED',
  RESTORE_DENIED: 'CRM_INTERACTION_RESTORE_DENIED',
  SOFT_DELETE_DENIED: 'CRM_INTERACTION_SOFT_DELETE_DENIED',
} as const;

@Injectable()
export class InteractionsService {
  private readonly logger = new Logger(InteractionsService.name);
  private readonly hierarchy = new HierarchyResolver();

  constructor(
    @Inject(DATA_SOURCE_TOKEN) private readonly dataSource: DataSource,
    private readonly tenantContext: TenantContextService,
    /**
     * Optional : when provided, `customFields` payloads are validated against
     * tenant definitions. Sprint 8 Task 8.14 (D3).
     */
    @Optional()
    private readonly customFieldsValidator?: CustomFieldsValidatorService,
  ) {}

  private async resolveCustomFields(
    customFields: Record<string, unknown> | undefined,
  ): Promise<Record<string, unknown> | undefined> {
    if (customFields === undefined) return undefined;
    if (!this.customFieldsValidator) return customFields;
    return this.customFieldsValidator.validate('interaction', customFields);
  }

  private getRepo() {
    return this.dataSource.getRepository(CrmInteractionEntity);
  }

  private getCompanyRepo() {
    return this.dataSource.getRepository(CrmCompanyEntity);
  }

  private getContactRepo() {
    return this.dataSource.getRepository(CrmContactEntity);
  }

  private getDealRepo() {
    return this.dataSource.getRepository(CrmDealEntity);
  }

  private requireTenantId(): string {
    const ctx = this.tenantContext.getCurrentContext();
    const tenantId = ctx?.tenantId;
    if (!tenantId) {
      throw new BadRequestException({
        code: INTERACTION_ERROR_CODES.TENANT_REQUIRED,
        message: 'Tenant context required',
      });
    }
    return tenantId;
  }

  private currentUserRole(): AuthRole | undefined {
    return this.tenantContext.getCurrentContext()?.userRole;
  }

  private hasPermission(
    permission: (typeof Permission)[keyof typeof Permission],
  ): boolean {
    const role = this.currentUserRole();
    if (!role) return false;
    const ctx = this.tenantContext.getCurrentContext();
    if (ctx?.isSuperAdmin) return true;
    return this.hierarchy.getEffectivePermissions(role).has(permission);
  }

  // ==========================================================================
  // Create
  // ==========================================================================

  async create(
    dto: CreateInteractionDto,
    createdByUserId: string,
  ): Promise<CrmInteractionEntity> {
    const tenantId = this.requireTenantId();

    return this.dataSource.transaction(async (em: EntityManager) => {
      // Polymorphic validation : verify the related entity exists in this tenant.
      if (dto.companyId) {
        const company = await em
          .getRepository(CrmCompanyEntity)
          .findOne({ where: { id: dto.companyId, tenantId } });
        if (!company || company.deletedAt) {
          throw new BadRequestException({
            code: INTERACTION_ERROR_CODES.RELATED_NOT_FOUND,
            message: `Company ${dto.companyId} introuvable`,
          });
        }
      } else if (dto.contactId) {
        const contact = await em
          .getRepository(CrmContactEntity)
          .findOne({ where: { id: dto.contactId, tenantId } });
        if (!contact || contact.deletedAt) {
          throw new BadRequestException({
            code: INTERACTION_ERROR_CODES.RELATED_NOT_FOUND,
            message: `Contact ${dto.contactId} introuvable`,
          });
        }
      } else if (dto.dealId) {
        const deal = await em
          .getRepository(CrmDealEntity)
          .findOne({ where: { id: dto.dealId, tenantId } });
        if (!deal || deal.deletedAt) {
          throw new BadRequestException({
            code: INTERACTION_ERROR_CODES.RELATED_NOT_FOUND,
            message: `Deal ${dto.dealId} introuvable`,
          });
        }
      } else {
        // Defensive : Zod refine should already cover this.
        throw new BadRequestException({
          code: INTERACTION_ERROR_CODES.RELATED_AMBIGUOUS,
          message: 'Exactly one of companyId / contactId / dealId required',
        });
      }

      // Parent (annotation) validation
      if (dto.parentInteractionId) {
        const parent = await em
          .getRepository(CrmInteractionEntity)
          .findOne({ where: { id: dto.parentInteractionId, tenantId } });
        if (!parent || parent.deletedAt) {
          throw new BadRequestException({
            code: INTERACTION_ERROR_CODES.PARENT_NOT_FOUND,
            message: `Parent interaction ${dto.parentInteractionId} introuvable`,
          });
        }
      }

      const validatedCustom = await this.resolveCustomFields(dto.customFields);

      const entity = em.getRepository(CrmInteractionEntity).create({
        tenantId,
        companyId: dto.companyId ?? null,
        contactId: dto.contactId ?? null,
        dealId: dto.dealId ?? null,
        type: dto.interactionType,
        direction: dto.direction ?? null,
        subject: dto.subject,
        body: dto.body ?? null,
        occurredAt: dto.occurredAt ?? new Date(),
        durationMinutes: dto.durationMinutes ?? null,
        status: dto.status ?? null,
        parentInteractionId: dto.parentInteractionId ?? null,
        ...(validatedCustom !== undefined ? { customFields: validatedCustom } : {}),
        createdBy: createdByUserId,
      });
      const saved = await em.getRepository(CrmInteractionEntity).save(entity);
      this.logger.log(
        `crm_interaction_created id=${saved.id} type=${saved.type} tenant=${tenantId} related=${dto.companyId ? `company:${dto.companyId}` : dto.contactId ? `contact:${dto.contactId}` : `deal:${dto.dealId}`} by=${createdByUserId}`,
      );
      return saved;
    });
  }

  // ==========================================================================
  // Annotation -- shorthand for creating a child interaction on same scope
  // ==========================================================================

  async annotate(
    parentInteractionId: string,
    dto: AnnotateInteractionDto,
    createdByUserId: string,
  ): Promise<CrmInteractionEntity> {
    const tenantId = this.requireTenantId();
    const parent = await this.getRepo().findOne({
      where: { id: parentInteractionId, tenantId },
    });
    if (!parent || parent.deletedAt) {
      throw new BadRequestException({
        code: INTERACTION_ERROR_CODES.PARENT_NOT_FOUND,
        message: `Parent interaction ${parentInteractionId} introuvable`,
      });
    }
    // Inherit the parent's polymorphic scope.
    const createDto: CreateInteractionDto = {
      interactionType: 'note',
      subject: dto.subject,
      body: dto.body,
      parentInteractionId,
      ...(parent.companyId ? { companyId: parent.companyId } : {}),
      ...(parent.contactId ? { contactId: parent.contactId } : {}),
      ...(parent.dealId ? { dealId: parent.dealId } : {}),
    };
    const saved = await this.create(createDto, createdByUserId);
    this.logger.log(
      `crm_interaction_annotated id=${saved.id} parent=${parentInteractionId} by=${createdByUserId}`,
    );
    return saved;
  }

  // ==========================================================================
  // Read
  // ==========================================================================

  async findOne(id: string, includeDeleted = false): Promise<CrmInteractionEntity> {
    const tenantId = this.requireTenantId();
    const interaction = await this.getRepo().findOne({ where: { id, tenantId } });
    if (!interaction) {
      throw new NotFoundException({
        code: INTERACTION_ERROR_CODES.NOT_FOUND,
        message: `Interaction ${id} introuvable`,
      });
    }
    if (interaction.deletedAt && !includeDeleted) {
      throw new NotFoundException({
        code: INTERACTION_ERROR_CODES.NOT_FOUND,
        message: `Interaction ${id} supprimee`,
      });
    }
    return interaction;
  }

  async list(filters: FilterInteractionsDto): Promise<PaginatedInteractions> {
    const tenantId = this.requireTenantId();
    const qb = this.getRepo()
      .createQueryBuilder('i')
      .where('i.tenant_id = :tenantId', { tenantId });

    if (!filters.includeDeleted) {
      qb.andWhere('i.deleted_at IS NULL');
    }
    if (filters.q) {
      qb.andWhere('(i.subject ILIKE :q OR i.body ILIKE :q)', { q: `%${filters.q}%` });
    }
    if (filters.interactionType) {
      qb.andWhere('i.type::text = :type', { type: filters.interactionType });
    }
    if (filters.companyId) {
      qb.andWhere('i.company_id = :companyId', { companyId: filters.companyId });
    }
    if (filters.contactId) {
      qb.andWhere('i.contact_id = :contactId', { contactId: filters.contactId });
    }
    if (filters.dealId) {
      qb.andWhere('i.deal_id = :dealId', { dealId: filters.dealId });
    }
    if (filters.createdBy) {
      qb.andWhere('i.created_by = :createdBy', { createdBy: filters.createdBy });
    }
    if (filters.occurredFrom) {
      qb.andWhere('i.occurred_at >= :from', { from: filters.occurredFrom });
    }
    if (filters.occurredTo) {
      qb.andWhere('i.occurred_at <= :to', { to: filters.occurredTo });
    }

    const orderColumn =
      filters.orderBy === 'created_at' ? 'i.created_at' : 'i.occurred_at';
    qb.orderBy(orderColumn, filters.orderDir);
    qb.skip(filters.offset).take(filters.limit);

    const [items, total] = await qb.getManyAndCount();
    return { items, total, limit: filters.limit, offset: filters.offset };
  }

  // ==========================================================================
  // Timeline cross-entity aggregation
  // ==========================================================================

  /**
   * Cross-entity timeline.
   *
   * Aggregates interactions related to the target entity AND any related
   * upstream / downstream entities :
   *   - company : own + contacts.company_id matches + deals.company_id matches
   *   - contact : own + the contact's company + deals where contact_id matches
   *   - deal    : own + the deal's company + the deal's contact
   *
   * RLS auto-filters tenant. `deleted_at IS NULL` always applied.
   */
  async timelineForEntity(
    entityType: RelatedEntityType,
    entityId: string,
    query: TimelineQueryDto,
  ): Promise<PaginatedInteractions> {
    const tenantId = this.requireTenantId();

    // Resolve the "scope set" of related ids based on entityType.
    const scope = await this.resolveScope(entityType, entityId, tenantId);

    const qb = this.getRepo()
      .createQueryBuilder('i')
      .where('i.tenant_id = :tenantId', { tenantId })
      .andWhere('i.deleted_at IS NULL');

    // OR clauses for the scope sets
    qb.andWhere(
      `(
        (i.company_id IS NOT NULL AND i.company_id = ANY(:companyIds))
     OR (i.contact_id IS NOT NULL AND i.contact_id = ANY(:contactIds))
     OR (i.deal_id    IS NOT NULL AND i.deal_id    = ANY(:dealIds))
      )`,
      {
        companyIds: scope.companyIds,
        contactIds: scope.contactIds,
        dealIds: scope.dealIds,
      },
    );

    if (query.interactionType) {
      qb.andWhere('i.type::text = :type', { type: query.interactionType });
    }
    if (query.occurredFrom) {
      qb.andWhere('i.occurred_at >= :from', { from: query.occurredFrom });
    }
    if (query.occurredTo) {
      qb.andWhere('i.occurred_at <= :to', { to: query.occurredTo });
    }

    qb.orderBy('i.occurred_at', 'DESC');
    qb.skip(query.offset).take(query.limit);

    const [items, total] = await qb.getManyAndCount();
    return { items, total, limit: query.limit, offset: query.offset };
  }

  /**
   * Resolves the set of related ids to query against for the timeline scope.
   */
  private async resolveScope(
    entityType: RelatedEntityType,
    entityId: string,
    tenantId: string,
  ): Promise<{ companyIds: string[]; contactIds: string[]; dealIds: string[] }> {
    if (entityType === 'company') {
      const contacts = await this.getContactRepo()
        .createQueryBuilder('c')
        .select('c.id', 'id')
        .where('c.tenant_id = :tenantId', { tenantId })
        .andWhere('c.company_id = :companyId', { companyId: entityId })
        .andWhere('c.deleted_at IS NULL')
        .getRawMany<{ id: string }>();
      const deals = await this.getDealRepo()
        .createQueryBuilder('d')
        .select('d.id', 'id')
        .where('d.tenant_id = :tenantId', { tenantId })
        .andWhere('d.company_id = :companyId', { companyId: entityId })
        .andWhere('d.deleted_at IS NULL')
        .getRawMany<{ id: string }>();
      return {
        companyIds: [entityId],
        contactIds: contacts.map((r) => r.id),
        dealIds: deals.map((r) => r.id),
      };
    }

    if (entityType === 'contact') {
      const contact = await this.getContactRepo().findOne({
        where: { id: entityId, tenantId },
      });
      if (!contact) {
        throw new NotFoundException({
          code: INTERACTION_ERROR_CODES.RELATED_NOT_FOUND,
          message: `Contact ${entityId} introuvable`,
        });
      }
      const deals = await this.getDealRepo()
        .createQueryBuilder('d')
        .select('d.id', 'id')
        .where('d.tenant_id = :tenantId', { tenantId })
        .andWhere('d.contact_id = :contactId', { contactId: entityId })
        .andWhere('d.deleted_at IS NULL')
        .getRawMany<{ id: string }>();
      return {
        companyIds: contact.companyId ? [contact.companyId] : [],
        contactIds: [entityId],
        dealIds: deals.map((r) => r.id),
      };
    }

    // entityType === 'deal'
    const deal = await this.getDealRepo().findOne({
      where: { id: entityId, tenantId },
    });
    if (!deal || deal.deletedAt) {
      throw new NotFoundException({
        code: INTERACTION_ERROR_CODES.RELATED_NOT_FOUND,
        message: `Deal ${entityId} introuvable`,
      });
    }
    return {
      companyIds: [deal.companyId],
      contactIds: deal.contactId ? [deal.contactId] : [],
      dealIds: [entityId],
    };
  }

  // ==========================================================================
  // Soft delete + restore via SECURITY DEFINER DB functions
  // ==========================================================================

  /**
   * Calls SECURITY DEFINER function crm_interactions_soft_delete().
   * The function bypasses the Sprint 2 append-only trigger via session GUC.
   * Permission CRM_INTERACTIONS_SOFT_DELETE is enforced at controller level.
   */
  async softDelete(id: string, userId: string): Promise<void> {
    const tenantId = this.requireTenantId();
    if (!this.hasPermission(Permission.CRM_INTERACTIONS_SOFT_DELETE)) {
      throw new ForbiddenException({
        code: INTERACTION_ERROR_CODES.SOFT_DELETE_DENIED,
        message: `Soft delete requires ${Permission.CRM_INTERACTIONS_SOFT_DELETE}`,
      });
    }

    // Verify the interaction belongs to the current tenant before invoking.
    const existing = await this.getRepo().findOne({ where: { id, tenantId } });
    if (!existing) {
      throw new NotFoundException({
        code: INTERACTION_ERROR_CODES.NOT_FOUND,
        message: `Interaction ${id} introuvable`,
      });
    }
    if (existing.deletedAt) {
      throw new ConflictException({
        code: INTERACTION_ERROR_CODES.ALREADY_DELETED,
        message: `Interaction ${id} deja supprimee`,
      });
    }

    await this.dataSource.query(`SELECT crm_interactions_soft_delete($1, $2);`, [
      id,
      userId,
    ]);
    this.logger.log(`crm_interaction_soft_deleted id=${id} by=${userId}`);
  }

  /**
   * Calls SECURITY DEFINER function crm_interactions_restore().
   * Permission CRM_INTERACTIONS_RESTORE enforced at controller level (admin only).
   */
  async restore(id: string, userId: string): Promise<void> {
    const tenantId = this.requireTenantId();
    if (!this.hasPermission(Permission.CRM_INTERACTIONS_RESTORE)) {
      throw new ForbiddenException({
        code: INTERACTION_ERROR_CODES.RESTORE_DENIED,
        message: `Restore requires ${Permission.CRM_INTERACTIONS_RESTORE}`,
      });
    }

    const existing = await this.getRepo().findOne({ where: { id, tenantId } });
    if (!existing) {
      throw new NotFoundException({
        code: INTERACTION_ERROR_CODES.NOT_FOUND,
        message: `Interaction ${id} introuvable`,
      });
    }
    if (!existing.deletedAt) {
      throw new BadRequestException({
        code: INTERACTION_ERROR_CODES.NOT_DELETED,
        message: `Interaction ${id} n'est pas supprimee -- rien a restaurer`,
      });
    }

    await this.dataSource.query(`SELECT crm_interactions_restore($1, $2);`, [
      id,
      userId,
    ]);
    this.logger.log(`crm_interaction_restored id=${id} by=${userId}`);
  }
}
