/**
 * ContactsService -- Sprint 8 Tache 8.2 (Phase 3 Sprint 1).
 *
 * CRUD + search trigram + link/unlink company pour crm_contacts.
 *
 * Multi-tenant strict :
 *   - tenant_id automatique via TenantContext + RLS
 *   - Tous les inserts/updates filtres par tenant_id courant (RLS enforce)
 *
 * Validations metier :
 *   - CIN MA (regex DGSN) si fourni -- unique per tenant (DB CHECK + UNIQUE partial index)
 *   - phone MA (+212 mobile 5/6/7) si fourni -- normalise E.164 avant insert
 *   - email citext -- unique per tenant si non null
 *   - companyId : si fourni, doit appartenir au meme tenant (RLS enforce + check explicit pour erreur clean)
 *
 * Heritage Sprint 7.5b :
 *   - app_can_access_tenant() v3.0 helper applique automatiquement
 *   - GRANT TO insurtech_app applique (post-migration-grants Sprint 7.5b.0)
 *
 * Reference : B-08 Tache 3.1.2.
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
  type ContactFiltersDto,
  type CreateContactDto,
  type UpdateContactDto,
  normalizePhoneMa,
  validateCin,
  validatePhoneMa,
} from '@insurtech/crm';
import { CrmCompanyEntity, CrmContactEntity, type DataSource } from '@insurtech/database';
import { DATA_SOURCE_TOKEN } from '../../../database/data-source.provider.js';
import { CustomFieldsValidatorService } from './custom-fields-validator.service.js';

export interface PaginatedContacts {
  readonly items: readonly CrmContactEntity[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

export const CONTACT_ERROR_CODES = {
  TENANT_REQUIRED: 'CRM_CONTACT_TENANT_REQUIRED',
  CIN_INVALID: 'CRM_CONTACT_CIN_INVALID',
  CIN_DUPLICATE: 'CRM_CONTACT_CIN_DUPLICATE',
  PHONE_INVALID: 'CRM_CONTACT_PHONE_INVALID',
  EMAIL_DUPLICATE: 'CRM_CONTACT_EMAIL_DUPLICATE',
  COMPANY_NOT_FOUND: 'CRM_CONTACT_COMPANY_NOT_FOUND',
  NOT_FOUND: 'CRM_CONTACT_NOT_FOUND',
} as const;

@Injectable()
export class ContactsService {
  private readonly logger = new Logger(ContactsService.name);

  constructor(
    @Inject(DATA_SOURCE_TOKEN) private readonly dataSource: DataSource,
    private readonly tenantContext: TenantContextService,
    /**
     * Optional : when provided, `customFields` payloads on create/update are
     * validated against tenant definitions. Sprint 8 Task 8.14 (D3).
     */
    @Optional()
    private readonly customFieldsValidator?: CustomFieldsValidatorService,
  ) {}

  private async resolveCustomFields(
    customFields: Record<string, unknown> | undefined,
  ): Promise<Record<string, unknown> | undefined> {
    if (customFields === undefined) return undefined;
    if (!this.customFieldsValidator) return customFields;
    return this.customFieldsValidator.validate('contact', customFields);
  }

  private getRepo() {
    return this.dataSource.getRepository(CrmContactEntity);
  }

  private getCompanyRepo() {
    return this.dataSource.getRepository(CrmCompanyEntity);
  }

  private requireTenantId(): string {
    const ctx = this.tenantContext.getCurrentContext();
    const tenantId = ctx?.tenantId;
    if (!tenantId) {
      throw new BadRequestException({
        code: CONTACT_ERROR_CODES.TENANT_REQUIRED,
        message: 'Tenant context required',
      });
    }
    return tenantId;
  }

  /**
   * Cree un nouveau contact dans le tenant courant.
   *
   * Validations :
   *   - CIN optional + valide MA + unique per tenant
   *   - phone optional + valide MA + normalise E.164
   *   - email optional + unique per tenant (UNIQUE partial index)
   *   - companyId optional + appartient au tenant courant
   */
  async create(dto: CreateContactDto, createdByUserId: string): Promise<CrmContactEntity> {
    const tenantId = this.requireTenantId();
    const repo = this.getRepo();

    // Validate CIN if provided
    let normalizedCin: string | null = null;
    if (dto.cin !== undefined) {
      const cinCheck = validateCin(dto.cin);
      if (!cinCheck.valid) {
        throw new BadRequestException({
          code: CONTACT_ERROR_CODES.CIN_INVALID,
          message: `CIN invalide : ${cinCheck.reason}`,
        });
      }
      normalizedCin = cinCheck.normalized ?? dto.cin;
      // Check uniqueness intra-tenant (RLS auto)
      const existing = await repo.findOne({
        where: { tenantId, cin: normalizedCin },
      });
      if (existing && !existing.deletedAt) {
        throw new ConflictException({
          code: CONTACT_ERROR_CODES.CIN_DUPLICATE,
          message: `Contact avec CIN ${normalizedCin} existe deja dans ce tenant`,
        });
      }
    }

    // Validate + normalize phone if provided
    let normalizedPhone: string | null = null;
    if (dto.phone !== undefined) {
      const phoneCheck = validatePhoneMa(dto.phone);
      if (!phoneCheck.valid) {
        throw new BadRequestException({
          code: CONTACT_ERROR_CODES.PHONE_INVALID,
          message: `Telephone MA invalide : ${phoneCheck.reason}`,
        });
      }
      normalizedPhone = phoneCheck.normalized ?? normalizePhoneMa(dto.phone);
    }

    // Validate email uniqueness if provided (UNIQUE partial idx handles concurrently)
    if (dto.email !== undefined) {
      const existing = await repo.findOne({
        where: { tenantId, email: dto.email.toLowerCase() },
      });
      if (existing && !existing.deletedAt) {
        throw new ConflictException({
          code: CONTACT_ERROR_CODES.EMAIL_DUPLICATE,
          message: `Contact avec email ${dto.email} existe deja dans ce tenant`,
        });
      }
    }

    // Validate companyId if provided
    if (dto.companyId !== undefined && dto.companyId !== null) {
      const companyRepo = this.getCompanyRepo();
      const company = await companyRepo.findOne({
        where: { id: dto.companyId, tenantId },
      });
      if (!company || company.deletedAt) {
        throw new BadRequestException({
          code: CONTACT_ERROR_CODES.COMPANY_NOT_FOUND,
          message: `Company ${dto.companyId} introuvable dans le tenant`,
        });
      }
    }

    const validatedCustom = await this.resolveCustomFields(dto.customFields);

    const entity = repo.create({
      tenantId,
      companyId: dto.companyId ?? null,
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email ? dto.email.toLowerCase() : null,
      phone: normalizedPhone,
      cin: normalizedCin,
      preferredLanguage: dto.preferredLanguage,
      preferredChannel: dto.preferredChannel,
      tags: dto.tags ?? [],
      notes: dto.notes ?? null,
      ...(validatedCustom !== undefined ? { customFields: validatedCustom } : {}),
      createdBy: createdByUserId,
      updatedBy: createdByUserId,
    });

    const saved = await repo.save(entity);
    this.logger.log(
      `crm_contact_created id=${saved.id} name="${saved.firstName} ${saved.lastName}" tenant=${tenantId} by=${createdByUserId}`,
    );
    return saved;
  }

  /**
   * Liste contacts avec filters + pagination.
   * RLS scope automatique sur tenant courant.
   */
  async list(filters: ContactFiltersDto): Promise<PaginatedContacts> {
    const tenantId = this.requireTenantId();
    const repo = this.getRepo();

    const qb = repo
      .createQueryBuilder('c')
      .where('c.tenant_id = :tenantId', { tenantId })
      .andWhere('c.deleted_at IS NULL');

    if (filters.q) {
      // Sprint 8.6 remplacera par pg_trgm GIN index ranked search ; ILIKE pour MVP Sprint 8.2
      qb.andWhere(
        '(c.full_name ILIKE :q OR c.email ILIKE :q OR c.phone ILIKE :q OR c.cin ILIKE :q)',
        { q: `%${filters.q}%` },
      );
    }
    if (filters.companyId) {
      qb.andWhere('c.company_id = :companyId', { companyId: filters.companyId });
    }
    if (filters.preferredLanguage) {
      qb.andWhere('c.preferred_language = :preferredLanguage', {
        preferredLanguage: filters.preferredLanguage,
      });
    }
    if (filters.preferredChannel) {
      qb.andWhere('c.preferred_channel = :preferredChannel', {
        preferredChannel: filters.preferredChannel,
      });
    }
    if (filters.tags && filters.tags.length > 0) {
      qb.andWhere('c.tags && :tags', { tags: filters.tags });
    }

    const orderColumnMap: Record<string, string> = {
      last_name: 'c.last_name',
      first_name: 'c.first_name',
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

  /** Recupere un contact par id (RLS auto). */
  async findOne(id: string): Promise<CrmContactEntity> {
    const tenantId = this.requireTenantId();
    const repo = this.getRepo();
    const contact = await repo.findOne({
      where: { id, tenantId },
    });
    if (!contact || contact.deletedAt) {
      throw new NotFoundException({
        code: CONTACT_ERROR_CODES.NOT_FOUND,
        message: `Contact ${id} introuvable`,
      });
    }
    return contact;
  }

  /**
   * Recherche par email (case-insensitive citext) -- retourne le premier match non-deleted.
   * Utile pour deduplication a l'import / reconciliation Sprint 9 Comm WhatsApp.
   */
  async findByEmail(email: string): Promise<CrmContactEntity | null> {
    const tenantId = this.requireTenantId();
    const repo = this.getRepo();
    const contact = await repo.findOne({
      where: { tenantId, email: email.toLowerCase() },
    });
    if (!contact || contact.deletedAt) {
      return null;
    }
    return contact;
  }

  /**
   * Met a jour partiellement un contact.
   * Champs non specifies = inchanges. Renormalise phone + valide CIN sur changement.
   */
  async update(
    id: string,
    dto: UpdateContactDto,
    updatedByUserId: string,
  ): Promise<CrmContactEntity> {
    const existing = await this.findOne(id);
    const tenantId = existing.tenantId;
    const repo = this.getRepo();

    // Re-validate CIN if changed
    let normalizedCin: string | null | undefined = undefined;
    if (dto.cin !== undefined) {
      if (dto.cin === null) {
        normalizedCin = null;
      } else {
        const cinCheck = validateCin(dto.cin);
        if (!cinCheck.valid) {
          throw new BadRequestException({
            code: CONTACT_ERROR_CODES.CIN_INVALID,
            message: `CIN invalide : ${cinCheck.reason}`,
          });
        }
        normalizedCin = cinCheck.normalized ?? dto.cin;
        if (normalizedCin !== existing.cin) {
          const dup = await repo.findOne({
            where: { tenantId, cin: normalizedCin },
          });
          if (dup && dup.id !== id && !dup.deletedAt) {
            throw new ConflictException({
              code: CONTACT_ERROR_CODES.CIN_DUPLICATE,
              message: `Contact avec CIN ${normalizedCin} existe deja`,
            });
          }
        }
      }
    }

    // Re-validate phone if changed
    let normalizedPhone: string | null | undefined = undefined;
    if (dto.phone !== undefined) {
      if (dto.phone === null) {
        normalizedPhone = null;
      } else {
        const phoneCheck = validatePhoneMa(dto.phone);
        if (!phoneCheck.valid) {
          throw new BadRequestException({
            code: CONTACT_ERROR_CODES.PHONE_INVALID,
            message: `Telephone MA invalide : ${phoneCheck.reason}`,
          });
        }
        normalizedPhone = phoneCheck.normalized ?? normalizePhoneMa(dto.phone);
      }
    }

    // Re-check email uniqueness if changed
    if (dto.email !== undefined && dto.email !== null) {
      const normalizedEmail = dto.email.toLowerCase();
      if (normalizedEmail !== (existing.email ?? '').toLowerCase()) {
        const dup = await repo.findOne({
          where: { tenantId, email: normalizedEmail },
        });
        if (dup && dup.id !== id && !dup.deletedAt) {
          throw new ConflictException({
            code: CONTACT_ERROR_CODES.EMAIL_DUPLICATE,
            message: `Contact avec email ${dto.email} existe deja`,
          });
        }
      }
    }

    // Validate companyId if changed
    if (dto.companyId !== undefined && dto.companyId !== null) {
      const companyRepo = this.getCompanyRepo();
      const company = await companyRepo.findOne({
        where: { id: dto.companyId, tenantId },
      });
      if (!company || company.deletedAt) {
        throw new BadRequestException({
          code: CONTACT_ERROR_CODES.COMPANY_NOT_FOUND,
          message: `Company ${dto.companyId} introuvable dans le tenant`,
        });
      }
    }

    const updates: Record<string, unknown> = {
      updated_by: updatedByUserId,
    };
    if (dto.firstName !== undefined) updates['first_name'] = dto.firstName;
    if (dto.lastName !== undefined) updates['last_name'] = dto.lastName;
    if (dto.email !== undefined) {
      updates['email'] = dto.email ? dto.email.toLowerCase() : null;
    }
    if (normalizedPhone !== undefined) updates['phone'] = normalizedPhone;
    if (normalizedCin !== undefined) updates['cin'] = normalizedCin;
    if (dto.companyId !== undefined) updates['company_id'] = dto.companyId ?? null;
    if (dto.preferredLanguage !== undefined) {
      updates['preferred_language'] = dto.preferredLanguage;
    }
    if (dto.preferredChannel !== undefined) {
      updates['preferred_channel'] = dto.preferredChannel;
    }
    if (dto.tags !== undefined) updates['tags'] = dto.tags;
    if (dto.notes !== undefined) updates['notes'] = dto.notes ?? null;
    if (dto.customFields !== undefined) {
      updates['custom_fields'] = await this.resolveCustomFields(dto.customFields);
    }

    await repo
      .createQueryBuilder()
      .update(CrmContactEntity)
      .set(updates)
      .where('id = :id', { id: existing.id })
      .execute();
    const updated = await this.findOne(id);
    this.logger.log(
      `crm_contact_updated id=${id} fields=[${Object.keys(updates).join(',')}] by=${updatedByUserId}`,
    );
    return updated;
  }

  /**
   * Link / unlink contact a une company (companyId nullable).
   * Si companyId !== null, verifie que la company appartient au tenant courant.
   */
  async linkToCompany(
    id: string,
    companyId: string | null,
    updatedByUserId: string,
  ): Promise<CrmContactEntity> {
    const existing = await this.findOne(id);
    const tenantId = existing.tenantId;

    if (companyId !== null) {
      const companyRepo = this.getCompanyRepo();
      const company = await companyRepo.findOne({
        where: { id: companyId, tenantId },
      });
      if (!company || company.deletedAt) {
        throw new BadRequestException({
          code: CONTACT_ERROR_CODES.COMPANY_NOT_FOUND,
          message: `Company ${companyId} introuvable dans le tenant`,
        });
      }
    }

    const repo = this.getRepo();
    await repo
      .createQueryBuilder()
      .update(CrmContactEntity)
      .set({ company_id: companyId, updated_by: updatedByUserId } as unknown as Record<
        string,
        unknown
      >)
      .where('id = :id', { id })
      .execute();
    this.logger.log(
      `crm_contact_linked id=${id} company_id=${companyId ?? 'null'} by=${updatedByUserId}`,
    );
    return this.findOne(id);
  }

  /** Soft delete (deleted_at) -- preserve audit trail CNDP. */
  async softDelete(id: string, deletedByUserId: string): Promise<void> {
    const existing = await this.findOne(id);
    const repo = this.getRepo();
    await repo
      .createQueryBuilder()
      .update(CrmContactEntity)
      .set({ deleted_at: new Date(), updated_by: deletedByUserId } as unknown as Record<
        string,
        unknown
      >)
      .where('id = :id', { id: existing.id })
      .execute();
    this.logger.log(`crm_contact_soft_deleted id=${id} by=${deletedByUserId}`);
  }
}
