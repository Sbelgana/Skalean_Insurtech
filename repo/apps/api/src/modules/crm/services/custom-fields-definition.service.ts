/**
 * CustomFieldsDefinitionService -- Sprint 8 Tache 8.7.
 *
 * CRUD pour les definitions de custom fields per tenant. Stockes dans
 * `crm_custom_field_definitions`. Multi-tenant strict via RLS.
 *
 * Soft delete pattern (heritage 8.4 / 8.5) : `active boolean` toggle.
 * Hard delete reserve aux super-admin (permission CRM_CUSTOM_FIELDS_DELETE).
 *
 * Hooks d'invalidation cache validator : CustomFieldsValidatorService injecte
 * un callback `onDefinitionChanged(tenantId, entityType)` que ce service
 * appelle apres create/update/deactivate/reactivate/hardDelete.
 *
 * Reference : B-08 Tache 3.1.7.
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
import type {
  CreateFieldDefinitionDto,
  CustomFieldEntityTypeDto,
  FieldDefinitionFiltersDto,
  UpdateFieldDefinitionDto,
} from '@insurtech/crm';
import {
  CrmCustomFieldDefinitionEntity,
  type DataSource,
} from '@insurtech/database';
import { DATA_SOURCE_TOKEN } from '../../../database/data-source.provider.js';

export interface PaginatedFieldDefinitions {
  readonly items: readonly CrmCustomFieldDefinitionEntity[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

/** Cache invalidation hook signature -- registered by ValidatorService. */
export type CacheInvalidator = (
  tenantId: string,
  entityType: CustomFieldEntityTypeDto,
) => void;

export const FIELD_DEFINITION_ERROR_CODES = {
  TENANT_REQUIRED: 'CRM_FIELD_DEF_TENANT_REQUIRED',
  KEY_DUPLICATE: 'CRM_FIELD_DEF_KEY_DUPLICATE',
  NOT_FOUND: 'CRM_FIELD_DEF_NOT_FOUND',
  ALREADY_INACTIVE: 'CRM_FIELD_DEF_ALREADY_INACTIVE',
  ALREADY_ACTIVE: 'CRM_FIELD_DEF_ALREADY_ACTIVE',
  IMMUTABLE_ENTITY_TYPE_OR_KEY: 'CRM_FIELD_DEF_IMMUTABLE_FIELDS',
} as const;

@Injectable()
export class CustomFieldsDefinitionService {
  private readonly logger = new Logger(CustomFieldsDefinitionService.name);
  private readonly invalidators: CacheInvalidator[] = [];

  constructor(
    @Inject(DATA_SOURCE_TOKEN) private readonly dataSource: DataSource,
    private readonly tenantContext: TenantContextService,
  ) {}

  /**
   * Registers a cache-invalidation callback. Called by
   * CustomFieldsValidatorService at module init so this service does not
   * need a direct dependency on the validator (avoids circular DI).
   */
  registerInvalidator(invalidator: CacheInvalidator): void {
    this.invalidators.push(invalidator);
  }

  private notifyInvalidation(
    tenantId: string,
    entityType: CustomFieldEntityTypeDto,
  ): void {
    for (const invalidator of this.invalidators) {
      try {
        invalidator(tenantId, entityType);
      } catch (err) {
        this.logger.warn(
          `cache_invalidation_failed tenant=${tenantId} entity=${entityType} err=${(err as Error).message}`,
        );
      }
    }
  }

  private getRepo() {
    return this.dataSource.getRepository(CrmCustomFieldDefinitionEntity);
  }

  private requireTenantId(): string {
    const ctx = this.tenantContext.getCurrentContext();
    const tenantId = ctx?.tenantId;
    if (!tenantId) {
      throw new BadRequestException({
        code: FIELD_DEFINITION_ERROR_CODES.TENANT_REQUIRED,
        message: 'Tenant context required',
      });
    }
    return tenantId;
  }

  // ==========================================================================
  // Read
  // ==========================================================================

  async findByEntityType(
    entityType: CustomFieldEntityTypeDto,
    activeOnly = true,
  ): Promise<CrmCustomFieldDefinitionEntity[]> {
    const tenantId = this.requireTenantId();
    const qb = this.getRepo()
      .createQueryBuilder('d')
      .where('d.tenant_id = :tenantId', { tenantId })
      .andWhere('d.entity_type = :entityType', { entityType });
    if (activeOnly) {
      qb.andWhere('d.active = true');
    }
    qb.orderBy('d.display_order', 'ASC').addOrderBy('d.field_key', 'ASC');
    return qb.getMany();
  }

  async findByKey(
    entityType: CustomFieldEntityTypeDto,
    fieldKey: string,
  ): Promise<CrmCustomFieldDefinitionEntity | null> {
    const tenantId = this.requireTenantId();
    return this.getRepo().findOne({
      where: { tenantId, entityType, fieldKey },
    });
  }

  async findOne(id: string): Promise<CrmCustomFieldDefinitionEntity> {
    const tenantId = this.requireTenantId();
    const def = await this.getRepo().findOne({ where: { id, tenantId } });
    if (!def) {
      throw new NotFoundException({
        code: FIELD_DEFINITION_ERROR_CODES.NOT_FOUND,
        message: `Field definition ${id} not found`,
      });
    }
    return def;
  }

  async list(filters: FieldDefinitionFiltersDto): Promise<PaginatedFieldDefinitions> {
    const tenantId = this.requireTenantId();
    const qb = this.getRepo()
      .createQueryBuilder('d')
      .where('d.tenant_id = :tenantId', { tenantId });
    if (filters.entityType) {
      qb.andWhere('d.entity_type = :entityType', { entityType: filters.entityType });
    }
    if (filters.active !== undefined) {
      qb.andWhere('d.active = :active', { active: filters.active });
    }
    qb.orderBy('d.entity_type', 'ASC')
      .addOrderBy('d.display_order', 'ASC')
      .addOrderBy('d.field_key', 'ASC');
    qb.skip(filters.offset).take(filters.limit);
    const [items, total] = await qb.getManyAndCount();
    return { items, total, limit: filters.limit, offset: filters.offset };
  }

  // ==========================================================================
  // Create
  // ==========================================================================

  async create(
    dto: CreateFieldDefinitionDto,
    createdByUserId: string,
  ): Promise<CrmCustomFieldDefinitionEntity> {
    const tenantId = this.requireTenantId();
    const repo = this.getRepo();

    const existing = await repo.findOne({
      where: { tenantId, entityType: dto.entityType, fieldKey: dto.fieldKey },
    });
    if (existing) {
      throw new ConflictException({
        code: FIELD_DEFINITION_ERROR_CODES.KEY_DUPLICATE,
        message: `Custom field ${dto.entityType}.${dto.fieldKey} already defined`,
      });
    }

    const entity = repo.create({
      tenantId,
      entityType: dto.entityType,
      fieldKey: dto.fieldKey,
      fieldLabel: dto.fieldLabel,
      fieldType: dto.fieldType,
      options: dto.options ?? null,
      validationRules: dto.validationRules ?? {},
      required: dto.required,
      displayOrder: dto.displayOrder,
      active: true,
      description: dto.description ?? null,
      createdBy: createdByUserId,
      updatedBy: createdByUserId,
    });
    const saved = await repo.save(entity);
    this.notifyInvalidation(tenantId, dto.entityType);
    this.logger.log(
      `crm_field_definition_created id=${saved.id} tenant=${tenantId} entity=${dto.entityType} key=${dto.fieldKey} type=${dto.fieldType} by=${createdByUserId}`,
    );
    return saved;
  }

  // ==========================================================================
  // Update
  // ==========================================================================

  async update(
    id: string,
    dto: UpdateFieldDefinitionDto,
    updatedByUserId: string,
  ): Promise<CrmCustomFieldDefinitionEntity> {
    const tenantId = this.requireTenantId();
    const repo = this.getRepo();
    const existing = await repo.findOne({ where: { id, tenantId } });
    if (!existing) {
      throw new NotFoundException({
        code: FIELD_DEFINITION_ERROR_CODES.NOT_FOUND,
        message: `Field definition ${id} not found`,
      });
    }

    // Reject any attempt to update immutable fields (defensive ; Zod already
    // omits them but a caller could try via raw service call).
    const dtoAsAny = dto as unknown as Record<string, unknown>;
    if ('entityType' in dtoAsAny || 'fieldKey' in dtoAsAny) {
      throw new BadRequestException({
        code: FIELD_DEFINITION_ERROR_CODES.IMMUTABLE_ENTITY_TYPE_OR_KEY,
        message: 'entityType and fieldKey are immutable -- delete + create instead',
      });
    }

    const updates: Record<string, unknown> = { updated_by: updatedByUserId };
    if (dto.fieldLabel !== undefined) updates['field_label'] = dto.fieldLabel;
    if (dto.fieldType !== undefined) updates['field_type'] = dto.fieldType;
    if (dto.options !== undefined) updates['options'] = dto.options;
    if (dto.validationRules !== undefined) {
      updates['validation_rules'] = dto.validationRules;
    }
    if (dto.required !== undefined) updates['required'] = dto.required;
    if (dto.displayOrder !== undefined) updates['display_order'] = dto.displayOrder;
    if (dto.active !== undefined) updates['active'] = dto.active;
    if (dto.description !== undefined) updates['description'] = dto.description;

    await repo
      .createQueryBuilder()
      .update(CrmCustomFieldDefinitionEntity)
      .set(updates)
      .where('id = :id', { id })
      .execute();

    const updated = await repo.findOne({ where: { id, tenantId } });
    this.notifyInvalidation(tenantId, existing.entityType);
    this.logger.log(
      `crm_field_definition_updated id=${id} fields=[${Object.keys(updates).join(',')}] by=${updatedByUserId}`,
    );
    return updated!;
  }

  // ==========================================================================
  // Soft delete / restore
  // ==========================================================================

  async deactivate(id: string, deactivatedByUserId: string): Promise<void> {
    const tenantId = this.requireTenantId();
    const existing = await this.findOne(id);
    if (!existing.active) {
      throw new ConflictException({
        code: FIELD_DEFINITION_ERROR_CODES.ALREADY_INACTIVE,
        message: `Field definition ${id} is already inactive`,
      });
    }
    await this.getRepo()
      .createQueryBuilder()
      .update(CrmCustomFieldDefinitionEntity)
      .set({ active: false, updated_by: deactivatedByUserId } as unknown as Record<
        string,
        unknown
      >)
      .where('id = :id', { id })
      .execute();
    this.notifyInvalidation(tenantId, existing.entityType);
    this.logger.log(
      `crm_field_definition_deactivated id=${id} entity=${existing.entityType} key=${existing.fieldKey} by=${deactivatedByUserId}`,
    );
  }

  async reactivate(id: string, reactivatedByUserId: string): Promise<void> {
    const tenantId = this.requireTenantId();
    const existing = await this.findOne(id);
    if (existing.active) {
      throw new ConflictException({
        code: FIELD_DEFINITION_ERROR_CODES.ALREADY_ACTIVE,
        message: `Field definition ${id} is already active`,
      });
    }
    await this.getRepo()
      .createQueryBuilder()
      .update(CrmCustomFieldDefinitionEntity)
      .set({ active: true, updated_by: reactivatedByUserId } as unknown as Record<
        string,
        unknown
      >)
      .where('id = :id', { id })
      .execute();
    this.notifyInvalidation(tenantId, existing.entityType);
    this.logger.log(
      `crm_field_definition_reactivated id=${id} entity=${existing.entityType} key=${existing.fieldKey} by=${reactivatedByUserId}`,
    );
  }

  // ==========================================================================
  // Hard delete (admin only via CRM_CUSTOM_FIELDS_DELETE perm at controller)
  // ==========================================================================

  async hardDelete(id: string, deletedByUserId: string): Promise<void> {
    const tenantId = this.requireTenantId();
    const existing = await this.findOne(id);
    await this.getRepo().delete({ id });
    this.notifyInvalidation(tenantId, existing.entityType);
    this.logger.log(
      `crm_field_definition_hard_deleted id=${id} entity=${existing.entityType} key=${existing.fieldKey} by=${deletedByUserId}`,
    );
  }
}
