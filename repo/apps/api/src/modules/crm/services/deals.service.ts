/**
 * DealsService -- Sprint 8 Tache 8.4 (Phase 3 Sprint 1).
 *
 * CRUD deals + state machine workflow (move stage / close won / close lost /
 * reopen) avec verifications coherence pipeline et permissions backward
 * transitions.
 *
 * Multi-tenant strict :
 *   - tenant_id via TenantContext + RLS
 *   - Tous reads/writes scope tenant courant
 *
 * State machine logic :
 *   - Forward transition (target.position > current.position) : OK pour tous
 *     les roles avec CRM_DEALS_UPDATE
 *   - Skip forward (target.position - current.position > 1) : OK (skip pas
 *     backward)
 *   - Backward transition (target.position < current.position) : requiert
 *     permission CRM_DEALS_OVERRIDE_WORKFLOW (admin only) -- verifie via
 *     HierarchyResolver inline
 *   - Same stage : no-op (rejette)
 *   - Closed deal : ne peut pas etre move-stage (requires reopen)
 *
 * Audit trail : log structure via Pino (Logger NestJS). Kafka events
 * `deal.stage_changed`/`deal.closed`/`deal.reopened` planifies Sprint 9+
 * (orchestrateur B-08).
 *
 * Reference : B-08 Tache 3.1.4.
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
  type CloseDealDto,
  type CreateDealDto,
  type DealFiltersDto,
  type MoveToStageDto,
  type ReopenDealDto,
  type UpdateDealDto,
} from '@insurtech/crm';
import {
  CrmCompanyEntity,
  CrmDealEntity,
  CrmPipelineEntity,
  CrmStageEntity,
  type DataSource,
  type EntityManager,
} from '@insurtech/database';
import { DATA_SOURCE_TOKEN } from '../../../database/data-source.provider.js';
import { CustomFieldsValidatorService } from './custom-fields-validator.service.js';

export interface PaginatedDeals {
  readonly items: readonly CrmDealEntity[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

export const DEAL_ERROR_CODES = {
  TENANT_REQUIRED: 'CRM_DEAL_TENANT_REQUIRED',
  COMPANY_NOT_FOUND: 'CRM_DEAL_COMPANY_NOT_FOUND',
  PIPELINE_NOT_FOUND: 'CRM_DEAL_PIPELINE_NOT_FOUND',
  STAGE_NOT_FOUND: 'CRM_DEAL_STAGE_NOT_FOUND',
  STAGE_NOT_IN_PIPELINE: 'CRM_DEAL_STAGE_NOT_IN_PIPELINE',
  PIPELINE_HAS_NO_STAGES: 'CRM_DEAL_PIPELINE_HAS_NO_STAGES',
  NOT_FOUND: 'CRM_DEAL_NOT_FOUND',
  ALREADY_CLOSED: 'CRM_DEAL_ALREADY_CLOSED',
  NOT_CLOSED: 'CRM_DEAL_NOT_CLOSED',
  SAME_STAGE: 'CRM_DEAL_SAME_STAGE',
  BACKWARD_TRANSITION_DENIED: 'CRM_DEAL_BACKWARD_TRANSITION_DENIED',
  REOPEN_DENIED: 'CRM_DEAL_REOPEN_DENIED',
} as const;

@Injectable()
export class DealsService {
  private readonly logger = new Logger(DealsService.name);
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
    return this.customFieldsValidator.validate('deal', customFields);
  }

  private getRepo() {
    return this.dataSource.getRepository(CrmDealEntity);
  }

  private getCompanyRepo() {
    return this.dataSource.getRepository(CrmCompanyEntity);
  }

  private getPipelineRepo() {
    return this.dataSource.getRepository(CrmPipelineEntity);
  }

  private getStageRepo() {
    return this.dataSource.getRepository(CrmStageEntity);
  }

  private requireTenantId(): string {
    const ctx = this.tenantContext.getCurrentContext();
    const tenantId = ctx?.tenantId;
    if (!tenantId) {
      throw new BadRequestException({
        code: DEAL_ERROR_CODES.TENANT_REQUIRED,
        message: 'Tenant context required',
      });
    }
    return tenantId;
  }

  private currentUserRole(): AuthRole | undefined {
    return this.tenantContext.getCurrentContext()?.userRole;
  }

  /**
   * Returns true if the current user holds the given permission via direct
   * grant or role-hierarchy inheritance. Uses HierarchyResolver stateless
   * lookups (no DB roundtrip).
   */
  private hasPermission(
    permission: (typeof Permission)[keyof typeof Permission],
  ): boolean {
    const role = this.currentUserRole();
    if (!role) return false;
    const ctx = this.tenantContext.getCurrentContext();
    if (ctx?.isSuperAdmin) return true;
    const effective = this.hierarchy.getEffectivePermissions(role);
    return effective.has(permission);
  }

  // ==========================================================================
  // Create
  // ==========================================================================

  async create(dto: CreateDealDto, createdByUserId: string): Promise<CrmDealEntity> {
    const tenantId = this.requireTenantId();

    return this.dataSource.transaction(async (em: EntityManager) => {
      // 1. Company belongs to tenant
      const company = await em
        .getRepository(CrmCompanyEntity)
        .findOne({ where: { id: dto.companyId, tenantId } });
      if (!company || company.deletedAt) {
        throw new BadRequestException({
          code: DEAL_ERROR_CODES.COMPANY_NOT_FOUND,
          message: `Company ${dto.companyId} introuvable dans le tenant`,
        });
      }

      // 2. Pipeline belongs to tenant
      const pipeline = await em
        .getRepository(CrmPipelineEntity)
        .findOne({ where: { id: dto.pipelineId, tenantId } });
      if (!pipeline) {
        throw new BadRequestException({
          code: DEAL_ERROR_CODES.PIPELINE_NOT_FOUND,
          message: `Pipeline ${dto.pipelineId} introuvable dans le tenant`,
        });
      }

      // 3. Resolve stage : explicit or auto-pick first stage of pipeline
      let stage: CrmStageEntity | null = null;
      if (dto.stageId !== undefined) {
        stage = await em
          .getRepository(CrmStageEntity)
          .findOne({ where: { id: dto.stageId, tenantId } });
        if (!stage) {
          throw new BadRequestException({
            code: DEAL_ERROR_CODES.STAGE_NOT_FOUND,
            message: `Stage ${dto.stageId} introuvable dans le tenant`,
          });
        }
        if (stage.pipelineId !== dto.pipelineId) {
          throw new BadRequestException({
            code: DEAL_ERROR_CODES.STAGE_NOT_IN_PIPELINE,
            message: `Stage ${dto.stageId} n'appartient pas au pipeline ${dto.pipelineId}`,
          });
        }
      } else {
        stage = await em
          .getRepository(CrmStageEntity)
          .createQueryBuilder('s')
          .where('s.tenant_id = :tenantId', { tenantId })
          .andWhere('s.pipeline_id = :pipelineId', { pipelineId: dto.pipelineId })
          .orderBy('s.position', 'ASC')
          .getOne();
        if (!stage) {
          throw new BadRequestException({
            code: DEAL_ERROR_CODES.PIPELINE_HAS_NO_STAGES,
            message: `Pipeline ${dto.pipelineId} n'a aucun stage configure`,
          });
        }
      }

      const validatedCustom = await this.resolveCustomFields(dto.customFields);

      // 4. Insert deal
      const deal = em.getRepository(CrmDealEntity).create({
        tenantId,
        companyId: dto.companyId,
        contactId: dto.contactId ?? null,
        pipelineId: dto.pipelineId,
        stageId: stage.id,
        name: dto.name,
        amount: String(dto.amount),
        currency: dto.currency,
        expectedCloseDate: dto.expectedCloseDate ?? null,
        ownerUserId: dto.ownerUserId,
        description: dto.description ?? null,
        ...(validatedCustom !== undefined ? { customFields: validatedCustom } : {}),
        closedWon: null,
        closedAt: null,
        createdBy: createdByUserId,
        updatedBy: createdByUserId,
      });
      const saved = await em.getRepository(CrmDealEntity).save(deal);
      this.logger.log(
        `crm_deal_created id=${saved.id} name="${saved.name}" tenant=${tenantId} pipeline=${dto.pipelineId} stage=${stage.id} amount=${saved.amount} ${saved.currency} by=${createdByUserId}`,
      );
      return saved;
    });
  }

  // ==========================================================================
  // List + read
  // ==========================================================================

  async list(filters: DealFiltersDto): Promise<PaginatedDeals> {
    const tenantId = this.requireTenantId();
    const repo = this.getRepo();

    const qb = repo
      .createQueryBuilder('d')
      .where('d.tenant_id = :tenantId', { tenantId })
      .andWhere('d.deleted_at IS NULL');

    if (filters.q) {
      qb.andWhere('d.name ILIKE :q', { q: `%${filters.q}%` });
    }
    if (filters.pipelineId) {
      qb.andWhere('d.pipeline_id = :pipelineId', { pipelineId: filters.pipelineId });
    }
    if (filters.stageId) {
      qb.andWhere('d.stage_id = :stageId', { stageId: filters.stageId });
    }
    if (filters.companyId) {
      qb.andWhere('d.company_id = :companyId', { companyId: filters.companyId });
    }
    if (filters.contactId) {
      qb.andWhere('d.contact_id = :contactId', { contactId: filters.contactId });
    }
    if (filters.ownerUserId) {
      qb.andWhere('d.owner_user_id = :ownerUserId', { ownerUserId: filters.ownerUserId });
    }

    switch (filters.status) {
      case 'open':
        qb.andWhere('d.closed_won IS NULL');
        break;
      case 'won':
        qb.andWhere('d.closed_won = true');
        break;
      case 'lost':
        qb.andWhere('d.closed_won = false');
        break;
      default:
        // 'all' -- no filter
        break;
    }

    if (filters.closedFrom) {
      qb.andWhere('d.closed_at >= :closedFrom', { closedFrom: filters.closedFrom });
    }
    if (filters.closedTo) {
      qb.andWhere('d.closed_at <= :closedTo', { closedTo: filters.closedTo });
    }
    if (filters.expectedCloseFrom) {
      qb.andWhere('d.expected_close_date >= :ecf', {
        ecf: filters.expectedCloseFrom,
      });
    }
    if (filters.expectedCloseTo) {
      qb.andWhere('d.expected_close_date <= :ect', { ect: filters.expectedCloseTo });
    }

    const orderColumnMap: Record<string, string> = {
      name: 'd.name',
      amount: 'd.amount',
      created_at: 'd.created_at',
      updated_at: 'd.updated_at',
      expected_close_date: 'd.expected_close_date',
    };
    const orderColumn = orderColumnMap[filters.orderBy] ?? 'd.created_at';
    qb.orderBy(orderColumn, filters.orderDir);
    qb.skip(filters.offset).take(filters.limit);

    const [items, total] = await qb.getManyAndCount();
    return { items, total, limit: filters.limit, offset: filters.offset };
  }

  async findOne(id: string): Promise<CrmDealEntity> {
    const tenantId = this.requireTenantId();
    const deal = await this.getRepo().findOne({ where: { id, tenantId } });
    if (!deal || deal.deletedAt) {
      throw new NotFoundException({
        code: DEAL_ERROR_CODES.NOT_FOUND,
        message: `Deal ${id} introuvable`,
      });
    }
    return deal;
  }

  // ==========================================================================
  // Update non-stage fields
  // ==========================================================================

  async update(
    id: string,
    dto: UpdateDealDto,
    updatedByUserId: string,
  ): Promise<CrmDealEntity> {
    const tenantId = this.requireTenantId();

    return this.dataSource.transaction(async (em: EntityManager) => {
      const existing = await em
        .getRepository(CrmDealEntity)
        .findOne({ where: { id, tenantId } });
      if (!existing || existing.deletedAt) {
        throw new NotFoundException({
          code: DEAL_ERROR_CODES.NOT_FOUND,
          message: `Deal ${id} introuvable`,
        });
      }

      const updates: Record<string, unknown> = { updated_by: updatedByUserId };
      if (dto.contactId !== undefined) updates['contact_id'] = dto.contactId ?? null;
      if (dto.name !== undefined) updates['name'] = dto.name;
      if (dto.amount !== undefined) updates['amount'] = String(dto.amount);
      if (dto.currency !== undefined) updates['currency'] = dto.currency;
      if (dto.expectedCloseDate !== undefined) {
        updates['expected_close_date'] = dto.expectedCloseDate ?? null;
      }
      if (dto.ownerUserId !== undefined) updates['owner_user_id'] = dto.ownerUserId;
      if (dto.description !== undefined) updates['description'] = dto.description ?? null;
      if (dto.customFields !== undefined) {
        updates['custom_fields'] = await this.resolveCustomFields(dto.customFields);
      }

      await em
        .createQueryBuilder()
        .update(CrmDealEntity)
        .set(updates)
        .where('id = :id', { id })
        .execute();

      const updated = await em
        .getRepository(CrmDealEntity)
        .findOne({ where: { id, tenantId } });
      this.logger.log(
        `crm_deal_updated id=${id} fields=[${Object.keys(updates).join(',')}] by=${updatedByUserId}`,
      );
      return updated!;
    });
  }

  // ==========================================================================
  // State machine : moveToStage
  // ==========================================================================

  async moveToStage(
    id: string,
    dto: MoveToStageDto,
    updatedByUserId: string,
  ): Promise<CrmDealEntity> {
    const tenantId = this.requireTenantId();

    return this.dataSource.transaction(async (em: EntityManager) => {
      const deal = await em
        .getRepository(CrmDealEntity)
        .findOne({ where: { id, tenantId } });
      if (!deal || deal.deletedAt) {
        throw new NotFoundException({
          code: DEAL_ERROR_CODES.NOT_FOUND,
          message: `Deal ${id} introuvable`,
        });
      }
      if (deal.closedAt !== null) {
        throw new ConflictException({
          code: DEAL_ERROR_CODES.ALREADY_CLOSED,
          message: `Deal ${id} est ferme. Utiliser /reopen pour le reactiver.`,
        });
      }
      if (deal.stageId === dto.stageId) {
        throw new BadRequestException({
          code: DEAL_ERROR_CODES.SAME_STAGE,
          message: `Deal ${id} est deja dans le stage ${dto.stageId}`,
        });
      }

      const currentStage = await em
        .getRepository(CrmStageEntity)
        .findOne({ where: { id: deal.stageId, tenantId } });
      const targetStage = await em
        .getRepository(CrmStageEntity)
        .findOne({ where: { id: dto.stageId, tenantId } });

      if (!targetStage) {
        throw new BadRequestException({
          code: DEAL_ERROR_CODES.STAGE_NOT_FOUND,
          message: `Stage ${dto.stageId} introuvable dans le tenant`,
        });
      }
      if (targetStage.pipelineId !== deal.pipelineId) {
        throw new BadRequestException({
          code: DEAL_ERROR_CODES.STAGE_NOT_IN_PIPELINE,
          message: `Stage ${dto.stageId} n'appartient pas au pipeline ${deal.pipelineId} du deal`,
        });
      }

      // Backward transition gate
      if (currentStage && targetStage.position < currentStage.position) {
        if (!this.hasPermission(Permission.CRM_DEALS_OVERRIDE_WORKFLOW)) {
          throw new ForbiddenException({
            code: DEAL_ERROR_CODES.BACKWARD_TRANSITION_DENIED,
            message: `Backward transition de stage position=${currentStage.position} a position=${targetStage.position} requiert la permission ${Permission.CRM_DEALS_OVERRIDE_WORKFLOW}`,
          });
        }
      }

      await em
        .createQueryBuilder()
        .update(CrmDealEntity)
        .set({ stageId: targetStage.id, updatedBy: updatedByUserId })
        .where('id = :id', { id })
        .execute();

      const updated = await em
        .getRepository(CrmDealEntity)
        .findOne({ where: { id, tenantId } });
      this.logger.log(
        `crm_deal_stage_moved id=${id} from=${currentStage?.id ?? 'null'}(pos=${currentStage?.position ?? '?'}) to=${targetStage.id}(pos=${targetStage.position}) reason="${dto.reason ?? ''}" by=${updatedByUserId}`,
      );
      return updated!;
    });
  }

  // ==========================================================================
  // Close won / close lost
  // ==========================================================================

  async closeWon(
    id: string,
    dto: CloseDealDto,
    updatedByUserId: string,
  ): Promise<CrmDealEntity> {
    return this.closeDeal(id, true, dto, updatedByUserId);
  }

  async closeLost(
    id: string,
    dto: CloseDealDto,
    updatedByUserId: string,
  ): Promise<CrmDealEntity> {
    return this.closeDeal(id, false, dto, updatedByUserId);
  }

  private async closeDeal(
    id: string,
    won: boolean,
    dto: CloseDealDto,
    updatedByUserId: string,
  ): Promise<CrmDealEntity> {
    const tenantId = this.requireTenantId();

    return this.dataSource.transaction(async (em: EntityManager) => {
      const deal = await em
        .getRepository(CrmDealEntity)
        .findOne({ where: { id, tenantId } });
      if (!deal || deal.deletedAt) {
        throw new NotFoundException({
          code: DEAL_ERROR_CODES.NOT_FOUND,
          message: `Deal ${id} introuvable`,
        });
      }
      if (deal.closedAt !== null) {
        throw new ConflictException({
          code: DEAL_ERROR_CODES.ALREADY_CLOSED,
          message: `Deal ${id} est deja ferme (closed_at=${deal.closedAt.toISOString()})`,
        });
      }

      const closedAt = new Date();
      const updates: Record<string, unknown> = {
        closedWon: won,
        closedAt,
        updatedBy: updatedByUserId,
      };
      if (dto.actualAmount !== undefined) {
        updates['amount'] = String(dto.actualAmount);
      }

      await em
        .createQueryBuilder()
        .update(CrmDealEntity)
        .set(updates)
        .where('id = :id', { id })
        .execute();

      const updated = await em
        .getRepository(CrmDealEntity)
        .findOne({ where: { id, tenantId } });
      this.logger.log(
        `crm_deal_closed id=${id} won=${won} amount=${updated?.amount ?? '?'} ${updated?.currency ?? ''} reason="${dto.reason ?? ''}" by=${updatedByUserId}`,
      );
      return updated!;
    });
  }

  // ==========================================================================
  // Reopen (admin only)
  // ==========================================================================

  async reopen(
    id: string,
    dto: ReopenDealDto,
    updatedByUserId: string,
  ): Promise<CrmDealEntity> {
    const tenantId = this.requireTenantId();

    if (!this.hasPermission(Permission.CRM_DEALS_OVERRIDE_WORKFLOW)) {
      throw new ForbiddenException({
        code: DEAL_ERROR_CODES.REOPEN_DENIED,
        message: `Reopen requiert la permission ${Permission.CRM_DEALS_OVERRIDE_WORKFLOW}`,
      });
    }

    return this.dataSource.transaction(async (em: EntityManager) => {
      const deal = await em
        .getRepository(CrmDealEntity)
        .findOne({ where: { id, tenantId } });
      if (!deal || deal.deletedAt) {
        throw new NotFoundException({
          code: DEAL_ERROR_CODES.NOT_FOUND,
          message: `Deal ${id} introuvable`,
        });
      }
      if (deal.closedAt === null) {
        throw new BadRequestException({
          code: DEAL_ERROR_CODES.NOT_CLOSED,
          message: `Deal ${id} n'est pas ferme -- rien a reopen`,
        });
      }

      // Resolve target stage
      let targetStageId = dto.stageId;
      if (!targetStageId) {
        const firstStage = await em
          .getRepository(CrmStageEntity)
          .createQueryBuilder('s')
          .where('s.tenant_id = :tenantId', { tenantId })
          .andWhere('s.pipeline_id = :pipelineId', { pipelineId: deal.pipelineId })
          .orderBy('s.position', 'ASC')
          .getOne();
        if (!firstStage) {
          throw new BadRequestException({
            code: DEAL_ERROR_CODES.PIPELINE_HAS_NO_STAGES,
            message: `Pipeline ${deal.pipelineId} n'a aucun stage configure pour reopen`,
          });
        }
        targetStageId = firstStage.id;
      } else {
        const stage = await em
          .getRepository(CrmStageEntity)
          .findOne({ where: { id: targetStageId, tenantId } });
        if (!stage) {
          throw new BadRequestException({
            code: DEAL_ERROR_CODES.STAGE_NOT_FOUND,
            message: `Stage ${targetStageId} introuvable`,
          });
        }
        if (stage.pipelineId !== deal.pipelineId) {
          throw new BadRequestException({
            code: DEAL_ERROR_CODES.STAGE_NOT_IN_PIPELINE,
            message: `Stage ${targetStageId} n'appartient pas au pipeline ${deal.pipelineId}`,
          });
        }
      }

      await em
        .createQueryBuilder()
        .update(CrmDealEntity)
        .set({
          closedWon: null,
          closedAt: null,
          stageId: targetStageId,
          updatedBy: updatedByUserId,
        })
        .where('id = :id', { id })
        .execute();

      const updated = await em
        .getRepository(CrmDealEntity)
        .findOne({ where: { id, tenantId } });
      this.logger.log(
        `crm_deal_reopened id=${id} new_stage=${targetStageId} reason="${dto.reason}" by=${updatedByUserId}`,
      );
      return updated!;
    });
  }

  // ==========================================================================
  // Soft delete (admin only -- gated at controller via CRM_DEALS_DELETE)
  // ==========================================================================

  async softDelete(id: string, deletedByUserId: string): Promise<void> {
    const tenantId = this.requireTenantId();
    const repo = this.getRepo();
    const existing = await repo.findOne({ where: { id, tenantId } });
    if (!existing || existing.deletedAt) {
      throw new NotFoundException({
        code: DEAL_ERROR_CODES.NOT_FOUND,
        message: `Deal ${id} introuvable`,
      });
    }
    await repo
      .createQueryBuilder()
      .update(CrmDealEntity)
      .set({ deleted_at: new Date(), updated_by: deletedByUserId } as unknown as Record<
        string,
        unknown
      >)
      .where('id = :id', { id })
      .execute();
    this.logger.log(`crm_deal_soft_deleted id=${id} by=${deletedByUserId}`);
  }
}
