/**
 * StagesService -- Sprint 8 Tache 8.3 (Phase 3 Sprint 1).
 *
 * CRUD stages individuels (rattaches a un pipeline) + reorder transaction.
 *
 * Multi-tenant strict :
 *   - tenant_id via TenantContext + RLS
 *   - Operations bornees au pipeline du tenant courant
 *
 * Reorder strategy : UNIQUE (pipeline_id, position) impose une transaction.
 * On utilise un offset transitoire (position + 1000) puis on remappe pour eviter
 * collision intermediaire (sinon UPDATE 2 lignes meme position -> 23505).
 *
 * Reference : B-08 Tache 3.1.3.
 */

import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { TenantContextService } from '@insurtech/auth';
import {
  type CreateStageDto,
  type ReorderStagesDto,
  type UpdateStageDto,
} from '@insurtech/crm';
import {
  CrmPipelineEntity,
  CrmStageEntity,
  type DataSource,
  type EntityManager,
} from '@insurtech/database';
import { DATA_SOURCE_TOKEN } from '../../../database/data-source.provider.js';

export const STAGE_ERROR_CODES = {
  TENANT_REQUIRED: 'CRM_STAGE_TENANT_REQUIRED',
  PIPELINE_NOT_FOUND: 'CRM_STAGE_PIPELINE_NOT_FOUND',
  NOT_FOUND: 'CRM_STAGE_NOT_FOUND',
  NAME_DUPLICATE: 'CRM_STAGE_NAME_DUPLICATE',
  POSITION_DUPLICATE: 'CRM_STAGE_POSITION_DUPLICATE',
  REORDER_INVALID: 'CRM_STAGE_REORDER_INVALID',
} as const;

@Injectable()
export class StagesService {
  private readonly logger = new Logger(StagesService.name);

  constructor(
    @Inject(DATA_SOURCE_TOKEN) private readonly dataSource: DataSource,
    private readonly tenantContext: TenantContextService,
  ) {}

  private getRepo() {
    return this.dataSource.getRepository(CrmStageEntity);
  }

  private getPipelineRepo() {
    return this.dataSource.getRepository(CrmPipelineEntity);
  }

  private requireTenantId(): string {
    const ctx = this.tenantContext.getCurrentContext();
    const tenantId = ctx?.tenantId;
    if (!tenantId) {
      throw new BadRequestException({
        code: STAGE_ERROR_CODES.TENANT_REQUIRED,
        message: 'Tenant context required',
      });
    }
    return tenantId;
  }

  private async assertPipelineExists(
    em: EntityManager | undefined,
    pipelineId: string,
    tenantId: string,
  ): Promise<void> {
    const repo = em
      ? em.getRepository(CrmPipelineEntity)
      : this.getPipelineRepo();
    const pipeline = await repo.findOne({ where: { id: pipelineId, tenantId } });
    if (!pipeline) {
      throw new BadRequestException({
        code: STAGE_ERROR_CODES.PIPELINE_NOT_FOUND,
        message: `Pipeline ${pipelineId} introuvable dans le tenant`,
      });
    }
  }

  /** List stages of a pipeline ordered by position ASC. */
  async findByPipeline(pipelineId: string): Promise<CrmStageEntity[]> {
    const tenantId = this.requireTenantId();
    await this.assertPipelineExists(undefined, pipelineId, tenantId);
    return this.getRepo().find({
      where: { tenantId, pipelineId },
      order: { position: 'ASC' },
    });
  }

  /**
   * Create a stage. If dto.position not provided, auto-set to max(position) + 1.
   * UNIQUE (pipeline_id, name) + UNIQUE (pipeline_id, position) enforced by DB.
   */
  async create(
    pipelineId: string,
    dto: CreateStageDto,
    createdByUserId: string,
  ): Promise<CrmStageEntity> {
    const tenantId = this.requireTenantId();

    return this.dataSource.transaction(async (em: EntityManager) => {
      await this.assertPipelineExists(em, pipelineId, tenantId);
      const repo = em.getRepository(CrmStageEntity);

      // Check duplicate name in pipeline
      const dupName = await repo.findOne({ where: { pipelineId, name: dto.name } });
      if (dupName) {
        throw new ConflictException({
          code: STAGE_ERROR_CODES.NAME_DUPLICATE,
          message: `Stage avec name "${dto.name}" existe deja dans ce pipeline`,
        });
      }

      let position = dto.position;
      if (position === undefined) {
        const max = await repo
          .createQueryBuilder('s')
          .select('COALESCE(MAX(s.position), -1)', 'maxp')
          .where('s.pipeline_id = :pipelineId', { pipelineId })
          .getRawOne<{ maxp: number }>();
        position = (max?.maxp ?? -1) + 1;
      } else {
        const dupPos = await repo.findOne({ where: { pipelineId, position } });
        if (dupPos) {
          throw new ConflictException({
            code: STAGE_ERROR_CODES.POSITION_DUPLICATE,
            message: `Stage avec position ${position} existe deja dans ce pipeline`,
          });
        }
      }

      const stage = repo.create({
        tenantId,
        pipelineId,
        name: dto.name,
        position,
        color: dto.color,
        winProbability: String(dto.winProbability),
        createdBy: createdByUserId,
        updatedBy: createdByUserId,
      });
      const saved = await repo.save(stage);
      this.logger.log(
        `crm_stage_created id=${saved.id} pipeline=${pipelineId} name="${saved.name}" position=${saved.position} by=${createdByUserId}`,
      );
      return saved;
    });
  }

  /** Get a single stage (RLS auto). */
  async findOne(stageId: string): Promise<CrmStageEntity> {
    const tenantId = this.requireTenantId();
    const stage = await this.getRepo().findOne({ where: { id: stageId, tenantId } });
    if (!stage) {
      throw new NotFoundException({
        code: STAGE_ERROR_CODES.NOT_FOUND,
        message: `Stage ${stageId} introuvable`,
      });
    }
    return stage;
  }

  /** Update stage. Position changes go through reorder() for atomic batch instead. */
  async update(
    stageId: string,
    dto: UpdateStageDto,
    updatedByUserId: string,
  ): Promise<CrmStageEntity> {
    const tenantId = this.requireTenantId();

    return this.dataSource.transaction(async (em: EntityManager) => {
      const repo = em.getRepository(CrmStageEntity);
      const existing = await repo.findOne({ where: { id: stageId, tenantId } });
      if (!existing) {
        throw new NotFoundException({
          code: STAGE_ERROR_CODES.NOT_FOUND,
          message: `Stage ${stageId} introuvable`,
        });
      }

      // Check name duplicate in pipeline
      if (dto.name !== undefined && dto.name !== existing.name) {
        const dup = await repo.findOne({
          where: { pipelineId: existing.pipelineId, name: dto.name },
        });
        if (dup && dup.id !== stageId) {
          throw new ConflictException({
            code: STAGE_ERROR_CODES.NAME_DUPLICATE,
            message: `Stage avec name "${dto.name}" existe deja dans ce pipeline`,
          });
        }
      }

      // Check position duplicate in pipeline (single-stage move; for batch, use reorder)
      if (dto.position !== undefined && dto.position !== existing.position) {
        const dup = await repo.findOne({
          where: { pipelineId: existing.pipelineId, position: dto.position },
        });
        if (dup && dup.id !== stageId) {
          throw new ConflictException({
            code: STAGE_ERROR_CODES.POSITION_DUPLICATE,
            message: `Stage avec position ${dto.position} existe deja dans ce pipeline -- utiliser reorder pour swap`,
          });
        }
      }

      const updates: Record<string, unknown> = { updated_by: updatedByUserId };
      if (dto.name !== undefined) updates['name'] = dto.name;
      if (dto.position !== undefined) updates['position'] = dto.position;
      if (dto.color !== undefined) updates['color'] = dto.color;
      if (dto.winProbability !== undefined) {
        updates['win_probability'] = String(dto.winProbability);
      }

      await em
        .createQueryBuilder()
        .update(CrmStageEntity)
        .set(updates)
        .where('id = :id', { id: stageId })
        .execute();

      const updated = await repo.findOne({ where: { id: stageId, tenantId } });
      this.logger.log(
        `crm_stage_updated id=${stageId} fields=[${Object.keys(updates).join(',')}] by=${updatedByUserId}`,
      );
      return updated!;
    });
  }

  /** Hard delete stage. Sprint 8.4 (Deals) ajoutera check sur deals attaches. */
  async delete(stageId: string, deletedByUserId: string): Promise<void> {
    const tenantId = this.requireTenantId();
    const repo = this.getRepo();
    const existing = await repo.findOne({ where: { id: stageId, tenantId } });
    if (!existing) {
      throw new NotFoundException({
        code: STAGE_ERROR_CODES.NOT_FOUND,
        message: `Stage ${stageId} introuvable`,
      });
    }
    await repo.delete({ id: stageId });
    this.logger.log(`crm_stage_deleted id=${stageId} by=${deletedByUserId}`);
  }

  /**
   * Reorder stages atomically within a pipeline.
   *
   * Strategy : two-pass UPDATE pour eviter collision intermediaire avec UNIQUE
   * (pipeline_id, position) :
   *   1. Move all moved stages to position += 1_000_000 (transient, outside any real range)
   *   2. Move them to their final positions
   *
   * Validates : all stageIds belong to pipelineId/tenant, no duplicate newPositions
   * in the input, and the target final layout has no collision with un-moved stages.
   */
  async reorder(
    pipelineId: string,
    dto: ReorderStagesDto,
    updatedByUserId: string,
  ): Promise<CrmStageEntity[]> {
    const tenantId = this.requireTenantId();

    return this.dataSource.transaction(async (em: EntityManager) => {
      await this.assertPipelineExists(em, pipelineId, tenantId);
      const repo = em.getRepository(CrmStageEntity);

      // Validate no duplicate newPosition in the input
      const seenPos = new Set<number>();
      for (const move of dto.moves) {
        if (seenPos.has(move.newPosition)) {
          throw new BadRequestException({
            code: STAGE_ERROR_CODES.REORDER_INVALID,
            message: `newPosition ${move.newPosition} duplique dans le batch`,
          });
        }
        seenPos.add(move.newPosition);
      }

      // Load all moved stages and validate they belong to pipeline
      const movedIds = dto.moves.map((m) => m.stageId);
      const movedStages = await repo
        .createQueryBuilder('s')
        .where('s.tenant_id = :tenantId', { tenantId })
        .andWhere('s.pipeline_id = :pipelineId', { pipelineId })
        .andWhere('s.id IN (:...ids)', { ids: movedIds })
        .getMany();

      if (movedStages.length !== dto.moves.length) {
        throw new BadRequestException({
          code: STAGE_ERROR_CODES.REORDER_INVALID,
          message: `Certains stageIds n'appartiennent pas au pipeline ${pipelineId}`,
        });
      }

      const movedIdSet = new Set(movedIds);

      // Check no collision with un-moved stages in the pipeline
      const unmovedStages = await repo
        .createQueryBuilder('s')
        .where('s.tenant_id = :tenantId', { tenantId })
        .andWhere('s.pipeline_id = :pipelineId', { pipelineId })
        .andWhere('s.id NOT IN (:...ids)', { ids: movedIds })
        .getMany();

      const unmovedPositions = new Set(unmovedStages.map((s) => s.position));
      for (const move of dto.moves) {
        if (unmovedPositions.has(move.newPosition)) {
          throw new ConflictException({
            code: STAGE_ERROR_CODES.POSITION_DUPLICATE,
            message: `newPosition ${move.newPosition} collide avec un stage non-deplace`,
          });
        }
      }

      // Pass 1 : transient offset (+1_000_000) sur les stages a deplacer
      // pour eviter collision pendant l'UPDATE
      await em
        .createQueryBuilder()
        .update(CrmStageEntity)
        .set({ position: () => 'position + 1000000', updated_by: updatedByUserId })
        .where('id IN (:...ids)', { ids: movedIds })
        .execute();

      // Pass 2 : set final positions
      for (const move of dto.moves) {
        if (!movedIdSet.has(move.stageId)) continue;
        await em
          .createQueryBuilder()
          .update(CrmStageEntity)
          .set({ position: move.newPosition, updated_by: updatedByUserId })
          .where('id = :id', { id: move.stageId })
          .execute();
      }

      const finalStages = await repo.find({
        where: { tenantId, pipelineId },
        order: { position: 'ASC' },
      });
      this.logger.log(
        `crm_stages_reordered pipeline=${pipelineId} moves=${dto.moves.length} by=${updatedByUserId}`,
      );
      return finalStages;
    });
  }
}
