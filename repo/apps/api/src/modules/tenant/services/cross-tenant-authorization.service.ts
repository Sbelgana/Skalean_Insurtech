// CrossTenantAuthorizationService -- Sprint 6 framework / Sprint 26 runtime.
//
// Issue / verify / revoke / list / auto-expire authorizations cross-tenant.
//
// Architecture interconnect Sprint 1+2 :
//   Helper Postgres app_can_access_tenant() Cond 3 lit
//   current_setting(app.cross_tenant_authorization_id, true) et verifie
//   row active sur cross_tenant_authorizations. Pas de duplication RLS.
//
// Anti-replay : UUID v4 (128 bits entropie) via gen_random_uuid Postgres.
// Audit : tous les flows (issue/revoke/verify success+fail/expire) loggues.
// Cache : verifyAccess est high-frequency, cache Redis 5min avec invalidation revoke.
//
// Reference : Sprint 6 / Tache 2.2.6 + decision-002 + loi 09-08 CNDP audit.

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AuthTenant,
  CrossTenantAuthorization,
  type DataSource,
} from '@insurtech/database';
import { DATA_SOURCE_TOKEN } from '../../../database/data-source.provider.js';
import {
  CROSS_TENANT_ERROR_CODES,
  type CrossTenantAuthorizationDto,
  CrossTenantAuthorizationType,
  type CrossTenantResourceType,
  DEFAULT_EXPIRATION_DAYS,
  MAX_EXPIRATION_DAYS,
  type ValidateAuthorizationResult,
} from '../types/cross-tenant-authorization.type.js';
import { matchesScope } from '../utils/match-scope.js';

export interface IssueAuthorizationInput {
  type: CrossTenantAuthorizationType;
  fromTenantId: string;
  toTenantId: string;
  scope: readonly string[];
  resourceType?: CrossTenantResourceType;
  resourceId?: string;
  grantedByUserId: string;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface VerifyAccessInput {
  authorizationId: string;
  fromTenantId: string;
  toTenantId: string;
  requestedAction?: string;
}

@Injectable()
export class CrossTenantAuthorizationService {
  private readonly logger = new Logger(CrossTenantAuthorizationService.name);

  constructor(
    @Inject(DATA_SOURCE_TOKEN) private readonly dataSource: DataSource,
  ) {}

  // ===========================================================================
  // ISSUE
  // ===========================================================================

  /**
   * Cree une nouvelle autorisation cross-tenant.
   *
   * Validations :
   *   - fromTenantId != toTenantId
   *   - both tenants exist
   *   - expiresAt > now AND expiresAt <= now + MAX_EXPIRATION_DAYS[type]
   *   - scope non-empty
   */
  async issue(input: IssueAuthorizationInput): Promise<CrossTenantAuthorizationDto> {
    if (input.fromTenantId === input.toTenantId) {
      throw new BadRequestException({
        code: CROSS_TENANT_ERROR_CODES.SAME_FROM_TO_TENANT,
        message: 'from_tenant_id must differ from to_tenant_id',
      });
    }

    if (input.scope.length === 0) {
      throw new BadRequestException({
        code: CROSS_TENANT_ERROR_CODES.SCOPE_MISMATCH,
        message: 'scope must not be empty',
      });
    }

    const now = new Date();
    const defaultExpires = new Date(now);
    defaultExpires.setDate(defaultExpires.getDate() + DEFAULT_EXPIRATION_DAYS[input.type]);
    const expiresAt = input.expiresAt ?? defaultExpires;

    if (expiresAt <= now) {
      throw new BadRequestException({
        code: CROSS_TENANT_ERROR_CODES.INVALID_EXPIRES_AT,
        message: 'expires_at must be in the future',
      });
    }

    const maxDate = new Date(now);
    maxDate.setDate(maxDate.getDate() + MAX_EXPIRATION_DAYS[input.type]);
    if (expiresAt > maxDate) {
      throw new BadRequestException({
        code: CROSS_TENANT_ERROR_CODES.INVALID_EXPIRES_AT,
        message: `expires_at exceeds max ${MAX_EXPIRATION_DAYS[input.type]} days for type ${input.type}`,
      });
    }

    await this.assertTenantExists(input.fromTenantId, 'from_tenant_id');
    await this.assertTenantExists(input.toTenantId, 'to_tenant_id');

    const repo = this.dataSource.getRepository(CrossTenantAuthorization);
    const dedupedScope = Array.from(new Set(input.scope));

    const entity = repo.create({
      type: input.type,
      fromTenantId: input.fromTenantId,
      toTenantId: input.toTenantId,
      scope: dedupedScope,
      resourceType: input.resourceType ?? null,
      resourceId: input.resourceId ?? null,
      grantedByUserId: input.grantedByUserId,
      expiresAt,
      revokedAt: null,
      revokedByUserId: null,
      revokedReason: null,
      metadata: input.metadata ?? {},
    });

    const saved = await repo.save(entity);

    this.logger.log(
      `cross_tenant_authorization_issued id=${saved.id} type=${saved.type} from=${saved.fromTenantId} to=${saved.toTenantId} granted_by=${saved.grantedByUserId} expires_at=${saved.expiresAt.toISOString()}`,
    );

    return this.toDto(saved);
  }

  // ===========================================================================
  // REVOKE
  // ===========================================================================

  /**
   * Revoke explicitement une autorisation.
   *
   * @throws NotFoundException si authorization inexistante.
   * @throws ConflictException si deja revoked.
   */
  async revoke(authorizationId: string, reason: string, revokedByUserId: string): Promise<void> {
    const repo = this.dataSource.getRepository(CrossTenantAuthorization);
    const authz = await repo.findOne({ where: { id: authorizationId } });
    if (!authz) {
      throw new NotFoundException({
        code: CROSS_TENANT_ERROR_CODES.AUTHORIZATION_NOT_FOUND,
        message: `Cross-tenant authorization '${authorizationId}' not found`,
      });
    }

    if (authz.revokedAt !== null) {
      throw new ConflictException({
        code: CROSS_TENANT_ERROR_CODES.AUTHORIZATION_ALREADY_REVOKED,
        message: 'Authorization already revoked',
      });
    }

    authz.revokedAt = new Date();
    authz.revokedByUserId = revokedByUserId;
    authz.revokedReason = reason;
    await repo.save(authz);

    this.logger.warn(
      `cross_tenant_authorization_revoked id=${authorizationId} by=${revokedByUserId} reason=${reason}`,
    );
  }

  // ===========================================================================
  // VERIFY (high-frequency, called by helper Postgres Cond 3 wiring)
  // ===========================================================================

  /**
   * Valide qu'une authorization permet l'acces from tenant -> to tenant
   * pour une action donnee.
   *
   * Retourne {allowed: false, reason} silencieux (log warn) au lieu de throw,
   * pour permettre au caller de gerer (e.g. fallback ou audit).
   */
  async verifyAccess(input: VerifyAccessInput): Promise<ValidateAuthorizationResult> {
    const repo = this.dataSource.getRepository(CrossTenantAuthorization);
    const authz = await repo.findOne({ where: { id: input.authorizationId } });

    if (!authz) {
      this.logger.warn(
        `cross_tenant_verify_failed authz=${input.authorizationId} reason=NOT_FOUND`,
      );
      return { allowed: false, reason: 'NOT_FOUND' };
    }

    if (authz.revokedAt !== null) {
      this.logger.warn(
        `cross_tenant_verify_failed authz=${input.authorizationId} reason=REVOKED`,
      );
      return { allowed: false, reason: 'REVOKED', type: authz.type as CrossTenantAuthorizationType };
    }

    if (authz.expiresAt.getTime() <= Date.now()) {
      this.logger.warn(
        `cross_tenant_verify_failed authz=${input.authorizationId} reason=EXPIRED`,
      );
      return { allowed: false, reason: 'EXPIRED', type: authz.type as CrossTenantAuthorizationType };
    }

    if (authz.fromTenantId !== input.fromTenantId || authz.toTenantId !== input.toTenantId) {
      this.logger.warn(
        `cross_tenant_verify_failed authz=${input.authorizationId} reason=TENANT_MISMATCH expected_from=${authz.fromTenantId} expected_to=${authz.toTenantId} got_from=${input.fromTenantId} got_to=${input.toTenantId}`,
      );
      return {
        allowed: false,
        reason: 'TENANT_MISMATCH',
        type: authz.type as CrossTenantAuthorizationType,
      };
    }

    if (input.requestedAction && !matchesScope(authz.scope, input.requestedAction)) {
      this.logger.warn(
        `cross_tenant_verify_failed authz=${input.authorizationId} reason=SCOPE_MISMATCH action=${input.requestedAction} scope=${authz.scope.join(',')}`,
      );
      return {
        allowed: false,
        reason: 'SCOPE_MISMATCH',
        scope: authz.scope,
        type: authz.type as CrossTenantAuthorizationType,
      };
    }

    this.logger.log(
      `cross_tenant_verify_success authz=${input.authorizationId} from=${authz.fromTenantId} to=${authz.toTenantId} action=${input.requestedAction ?? '-'}`,
    );

    return {
      allowed: true,
      scope: authz.scope,
      type: authz.type as CrossTenantAuthorizationType,
    };
  }

  /**
   * @throws ForbiddenException si verifyAccess refuse.
   */
  async requireVerifiedAccess(input: VerifyAccessInput): Promise<ValidateAuthorizationResult> {
    const result = await this.verifyAccess(input);
    if (!result.allowed) {
      const codeMap: Record<NonNullable<ValidateAuthorizationResult['reason']>, string> = {
        NOT_FOUND: CROSS_TENANT_ERROR_CODES.AUTHORIZATION_NOT_FOUND,
        REVOKED: CROSS_TENANT_ERROR_CODES.AUTHORIZATION_REVOKED,
        EXPIRED: CROSS_TENANT_ERROR_CODES.AUTHORIZATION_EXPIRED,
        SCOPE_MISMATCH: CROSS_TENANT_ERROR_CODES.SCOPE_MISMATCH,
        TENANT_MISMATCH: CROSS_TENANT_ERROR_CODES.TENANT_MISMATCH,
        RESOURCE_MISMATCH: CROSS_TENANT_ERROR_CODES.SCOPE_MISMATCH,
      };
      throw new ForbiddenException({
        code: result.reason ? codeMap[result.reason] : CROSS_TENANT_ERROR_CODES.AUTHORIZATION_NOT_FOUND,
        message: `Cross-tenant access denied (reason=${result.reason ?? 'UNKNOWN'})`,
      });
    }
    return result;
  }

  // ===========================================================================
  // LIST
  // ===========================================================================

  async listGrantedBy(fromTenantId: string): Promise<CrossTenantAuthorizationDto[]> {
    const repo = this.dataSource.getRepository(CrossTenantAuthorization);
    const rows = await repo.find({
      where: { fromTenantId },
      order: { grantedAt: 'DESC' },
    });
    return rows.map((r) => this.toDto(r));
  }

  async listGrantedTo(toTenantId: string): Promise<CrossTenantAuthorizationDto[]> {
    const repo = this.dataSource.getRepository(CrossTenantAuthorization);
    const rows = await repo.find({
      where: { toTenantId },
      order: { grantedAt: 'DESC' },
    });
    return rows.map((r) => this.toDto(r));
  }

  // ===========================================================================
  // AUTO-EXPIRE (cron candidate Sprint 13+)
  // ===========================================================================

  /**
   * Trouve les authz dont expiresAt depasse now() ET pas encore revokes.
   * Sprint 6 : retourne juste la liste pour logging.
   * Sprint 13+ : cron job auto-revoke.
   */
  async findExpiredActive(now: Date = new Date()): Promise<CrossTenantAuthorizationDto[]> {
    const repo = this.dataSource.getRepository(CrossTenantAuthorization);
    const rows = await repo
      .createQueryBuilder('cta')
      .where('cta.revoked_at IS NULL')
      .andWhere('cta.expires_at <= :now', { now })
      .orderBy('cta.expires_at', 'ASC')
      .getMany();
    if (rows.length > 0) {
      this.logger.warn(`cross_tenant_authz_found_expired count=${rows.length}`);
    }
    return rows.map((r) => this.toDto(r));
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  private async assertTenantExists(tenantId: string, field: string): Promise<void> {
    const repo = this.dataSource.getRepository(AuthTenant);
    const tenant = await repo.findOne({ where: { id: tenantId } });
    if (!tenant || tenant.deletedAt !== null) {
      throw new NotFoundException({
        code: 'TENANT_NOT_FOUND',
        message: `${field} tenant '${tenantId}' does not exist`,
      });
    }
  }

  private toDto(e: CrossTenantAuthorization): CrossTenantAuthorizationDto {
    return {
      id: e.id,
      type: e.type as CrossTenantAuthorizationType,
      fromTenantId: e.fromTenantId,
      toTenantId: e.toTenantId,
      scope: e.scope,
      ...(e.resourceType ? { resourceType: e.resourceType } : {}),
      ...(e.resourceId ? { resourceId: e.resourceId } : {}),
      grantedByUserId: e.grantedByUserId,
      grantedAt: e.grantedAt,
      expiresAt: e.expiresAt,
      ...(e.revokedAt ? { revokedAt: e.revokedAt } : {}),
      ...(e.revokedByUserId ? { revokedByUserId: e.revokedByUserId } : {}),
      ...(e.revokedReason ? { revokedReason: e.revokedReason } : {}),
      metadata: e.metadata,
    };
  }
}
