/**
 * PipelinesService -- Sprint 8 Tache 8.3 (Phase 3 Sprint 1).
 *
 * CRUD pipelines + cascade stages + set-default transaction.
 *
 * Multi-tenant strict :
 *   - tenant_id automatique via TenantContext + RLS
 *   - Tous les inserts/updates filtres par tenant_id courant
 *
 * Validations metier :
 *   - name UNIQUE per tenant (UNIQUE INDEX uq_crm_pipelines_tenant_name)
 *   - At most ONE is_default per tenant (UNIQUE partial INDEX) -- setDefault unset autres
 *   - Cascade stages : transaction insert pipeline + stages atomique
 *   - Delete CASCADE stages (DB foreign key)
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
  type CreatePipelineDto,
  type PipelineFiltersDto,
  type UpdatePipelineDto,
} from '@insurtech/crm';
import {
  CrmPipelineEntity,
  CrmStageEntity,
  type DataSource,
  type EntityManager,
} from '@insurtech/database';
import { DATA_SOURCE_TOKEN } from '../../../database/data-source.provider.js';

export interface PaginatedPipelines {
  readonly items: readonly CrmPipelineEntity[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

export const PIPELINE_ERROR_CODES = {
  TENANT_REQUIRED: 'CRM_PIPELINE_TENANT_REQUIRED',
  NAME_DUPLICATE: 'CRM_PIPELINE_NAME_DUPLICATE',
  NOT_FOUND: 'CRM_PIPELINE_NOT_FOUND',
  STAGE_NAME_DUPLICATE: 'CRM_PIPELINE_STAGE_NAME_DUPLICATE',
  STAGE_POSITION_DUPLICATE: 'CRM_PIPELINE_STAGE_POSITION_DUPLICATE',
} as const;

@Injectable()
export class PipelinesService {
  private readonly logger = new Logger(PipelinesService.name);

  constructor(
    @Inject(DATA_SOURCE_TOKEN) private readonly dataSource: DataSource,
    private readonly tenantContext: TenantContextService,
  ) {}

  private getRepo() {
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
        code: PIPELINE_ERROR_CODES.TENANT_REQUIRED,
        message: 'Tenant context required',
      });
    }
    return tenantId;
  }

  /**
   * Cree un pipeline. Si dto.stages fourni, cree pipeline + stages
   * atomically dans une transaction.
   *
   * Si isDefault=true et un autre default existe deja, unset l'autre dans
   * la meme transaction (sinon UNIQUE partial index rejet).
   */
  async create(dto: CreatePipelineDto, createdByUserId: string): Promise<CrmPipelineEntity> {
    const tenantId = this.requireTenantId();

    return this.dataSource.transaction(async (em: EntityManager) => {
      // Check duplicate name
      const existingByName = await em
        .getRepository(CrmPipelineEntity)
        .findOne({ where: { tenantId, name: dto.name } });
      if (existingByName) {
        throw new ConflictException({
          code: PIPELINE_ERROR_CODES.NAME_DUPLICATE,
          message: `Pipeline avec name "${dto.name}" existe deja dans ce tenant`,
        });
      }

      // If isDefault, unset current default first
      if (dto.isDefault) {
        await em
          .createQueryBuilder()
          .update(CrmPipelineEntity)
          .set({ isDefault: false })
          .where('tenant_id = :tenantId AND is_default = true', { tenantId })
          .execute();
      }

      const pipeline = em.getRepository(CrmPipelineEntity).create({
        tenantId,
        name: dto.name,
        description: dto.description ?? null,
        isDefault: dto.isDefault ?? false,
        createdBy: createdByUserId,
        updatedBy: createdByUserId,
      });
      const savedPipeline = await em.getRepository(CrmPipelineEntity).save(pipeline);

      // Cascade stages if provided
      if (dto.stages && dto.stages.length > 0) {
        const seenNames = new Set<string>();
        const seenPositions = new Set<number>();
        const stageEntities: CrmStageEntity[] = [];
        for (let i = 0; i < dto.stages.length; i++) {
          const s = dto.stages[i]!;
          if (seenNames.has(s.name)) {
            throw new BadRequestException({
              code: PIPELINE_ERROR_CODES.STAGE_NAME_DUPLICATE,
              message: `Stage name "${s.name}" duplique dans le pipeline`,
            });
          }
          seenNames.add(s.name);
          const position = s.position ?? i;
          if (seenPositions.has(position)) {
            throw new BadRequestException({
              code: PIPELINE_ERROR_CODES.STAGE_POSITION_DUPLICATE,
              message: `Stage position ${position} duplique dans le pipeline`,
            });
          }
          seenPositions.add(position);
          stageEntities.push(
            em.getRepository(CrmStageEntity).create({
              tenantId,
              pipelineId: savedPipeline.id,
              name: s.name,
              position,
              color: s.color,
              winProbability: String(s.winProbability),
              createdBy: createdByUserId,
              updatedBy: createdByUserId,
            }),
          );
        }
        await em.getRepository(CrmStageEntity).save(stageEntities);
      }

      this.logger.log(
        `crm_pipeline_created id=${savedPipeline.id} name="${savedPipeline.name}" tenant=${tenantId} stages=${dto.stages?.length ?? 0} by=${createdByUserId}`,
      );
      return savedPipeline;
    });
  }

  /** Liste pipelines avec filters + pagination. RLS auto. */
  async list(filters: PipelineFiltersDto): Promise<PaginatedPipelines> {
    const tenantId = this.requireTenantId();
    const repo = this.getRepo();

    const qb = repo.createQueryBuilder('p').where('p.tenant_id = :tenantId', { tenantId });

    if (filters.isDefault !== undefined) {
      qb.andWhere('p.is_default = :isDefault', { isDefault: filters.isDefault });
    }

    const orderColumnMap: Record<string, string> = {
      name: 'p.name',
      created_at: 'p.created_at',
      updated_at: 'p.updated_at',
    };
    const orderColumn = orderColumnMap[filters.orderBy] ?? 'p.created_at';
    qb.orderBy(orderColumn, filters.orderDir);
    qb.skip(filters.offset).take(filters.limit);

    const [items, total] = await qb.getManyAndCount();
    return { items, total, limit: filters.limit, offset: filters.offset };
  }

  /** Retrieve pipeline + ordered stages. */
  async findOne(id: string): Promise<CrmPipelineEntity & { stages: CrmStageEntity[] }> {
    const tenantId = this.requireTenantId();
    const repo = this.getRepo();
    const pipeline = await repo.findOne({ where: { id, tenantId } });
    if (!pipeline) {
      throw new NotFoundException({
        code: PIPELINE_ERROR_CODES.NOT_FOUND,
        message: `Pipeline ${id} introuvable`,
      });
    }
    const stages = await this.getStageRepo().find({
      where: { tenantId, pipelineId: id },
      order: { position: 'ASC' },
    });
    return Object.assign(pipeline, { stages });
  }

  /** Update pipeline. If isDefault=true, unset autres defaults dans transaction. */
  async update(
    id: string,
    dto: UpdatePipelineDto,
    updatedByUserId: string,
  ): Promise<CrmPipelineEntity> {
    const tenantId = this.requireTenantId();

    return this.dataSource.transaction(async (em: EntityManager) => {
      const existing = await em
        .getRepository(CrmPipelineEntity)
        .findOne({ where: { id, tenantId } });
      if (!existing) {
        throw new NotFoundException({
          code: PIPELINE_ERROR_CODES.NOT_FOUND,
          message: `Pipeline ${id} introuvable`,
        });
      }

      // Check duplicate name if changed
      if (dto.name !== undefined && dto.name !== existing.name) {
        const dup = await em
          .getRepository(CrmPipelineEntity)
          .findOne({ where: { tenantId, name: dto.name } });
        if (dup && dup.id !== id) {
          throw new ConflictException({
            code: PIPELINE_ERROR_CODES.NAME_DUPLICATE,
            message: `Pipeline avec name "${dto.name}" existe deja`,
          });
        }
      }

      // If setting isDefault=true, unset autres dans la transaction
      if (dto.isDefault === true && !existing.isDefault) {
        await em
          .createQueryBuilder()
          .update(CrmPipelineEntity)
          .set({ isDefault: false })
          .where('tenant_id = :tenantId AND is_default = true AND id <> :id', {
            tenantId,
            id,
          })
          .execute();
      }

      const updates: Record<string, unknown> = { updated_by: updatedByUserId };
      if (dto.name !== undefined) updates['name'] = dto.name;
      if (dto.description !== undefined) updates['description'] = dto.description ?? null;
      if (dto.isDefault !== undefined) updates['is_default'] = dto.isDefault;

      await em
        .createQueryBuilder()
        .update(CrmPipelineEntity)
        .set(updates)
        .where('id = :id', { id })
        .execute();

      const updated = await em
        .getRepository(CrmPipelineEntity)
        .findOne({ where: { id, tenantId } });
      this.logger.log(
        `crm_pipeline_updated id=${id} fields=[${Object.keys(updates).join(',')}] by=${updatedByUserId}`,
      );
      return updated!;
    });
  }

  /**
   * Set a pipeline as the unique default. Atomically unsets autres defaults.
   * No-op si deja default.
   */
  async setDefault(id: string, updatedByUserId: string): Promise<CrmPipelineEntity> {
    return this.update(id, { isDefault: true }, updatedByUserId);
  }

  /**
   * Hard delete pipeline. ON DELETE CASCADE elimine les stages.
   * Sprint 8.4 (Deals) ajoutera un check sur deals attaches.
   */
  async delete(id: string, deletedByUserId: string): Promise<void> {
    const tenantId = this.requireTenantId();
    const repo = this.getRepo();
    const existing = await repo.findOne({ where: { id, tenantId } });
    if (!existing) {
      throw new NotFoundException({
        code: PIPELINE_ERROR_CODES.NOT_FOUND,
        message: `Pipeline ${id} introuvable`,
      });
    }
    await repo.delete({ id });
    this.logger.log(`crm_pipeline_deleted id=${id} by=${deletedByUserId}`);
  }
}
