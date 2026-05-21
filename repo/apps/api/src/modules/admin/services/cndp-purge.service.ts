// CndpPurgeService -- conformite loi 09-08 droit oubli.
//
// Workflow :
//   1. initiate : DPO/Skalean enregistre demande (status=pending)
//   2. validate : super_admin valide (status=in_grace_period, graceEndsAt=now+30j)
//   3. execute : apres grace period, purge irreversible (status=executed -> completed)
//   4. cancel : possible avant grace period expire
//
// Sprint 6 storage : Redis (cndp:purge:request:<id>) car pas de table DB Sprint 6.
// Sprint 12 (compliance) : migration vers table dediee compliance_purge_requests
// avec audit trail 10 ans retention.
//
// Reference : Sprint 6 / Tache 2.2.12 + loi 09-08 art. 24-26 droit oubli + ACAPS.

import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AuthTenant,
  AuthTenantUser,
  AuthUser,
  type DataSource,
} from '@insurtech/database';
import type Redis from 'ioredis';
import { DATA_SOURCE_TOKEN } from '../../../database/data-source.provider.js';
import { REDIS_CLIENT_TOKEN } from '../../../redis/redis.provider.js';
import type {
  CancelPurgeRequestDto,
  InitiatePurgeRequestDto,
} from '../dto/cndp-purge.dto.js';
import {
  CNDP_GRACE_PERIOD_DAYS,
  CNDP_PURGE_ERROR_CODES,
  type PurgeRequest,
} from '../types/cndp-purge.type.js';

const KEY_PREFIX = 'cndp:purge:request:';
const requestKey = (id: string): string => `${KEY_PREFIX}${id}`;
const pendingIndexKey = 'cndp:purge:pending-index';
// 1 year TTL pour pending/in_grace (purge eventuelle si jamais valide).
const REQUEST_TTL_SECONDS = 365 * 24 * 60 * 60;

@Injectable()
export class CndpPurgeService {
  private readonly logger = new Logger(CndpPurgeService.name);

  constructor(
    @Inject(DATA_SOURCE_TOKEN) private readonly dataSource: DataSource,
    @Inject(REDIS_CLIENT_TOKEN) private readonly redis: Redis,
  ) {}

  // ===========================================================================
  // INITIATE
  // ===========================================================================

  async initiate(
    dto: InitiatePurgeRequestDto,
    initiatorUserId: string,
  ): Promise<PurgeRequest> {
    // Sanity check tenant existe.
    const tenantRepo = this.dataSource.getRepository(AuthTenant);
    const tenant = await tenantRepo.findOne({
      where: { id: dto.tenantId },
      withDeleted: true,
    });
    if (!tenant) {
      throw new NotFoundException({
        code: 'TENANT_NOT_FOUND',
        message: `Tenant '${dto.tenantId}' not found`,
      });
    }

    // Si user_data : verifier user existe dans le tenant.
    if (dto.requestType === 'user_data' && dto.targetUserId) {
      const userRepo = this.dataSource.getRepository(AuthUser);
      const user = await userRepo.findOne({
        where: { id: dto.targetUserId, tenantId: dto.tenantId },
        withDeleted: true,
      });
      if (!user) {
        throw new NotFoundException({
          code: 'USER_NOT_FOUND',
          message: `User '${dto.targetUserId}' not found in tenant '${dto.tenantId}'`,
        });
      }
    }

    const request: PurgeRequest = {
      id: randomUUID(),
      tenantId: dto.tenantId,
      requestType: dto.requestType,
      targetUserId: dto.targetUserId ?? null,
      requestedByEmail: dto.requestedByEmail,
      reason: dto.reason,
      status: 'pending',
      createdAt: new Date(),
      validatedAt: null,
      validatedByUserId: null,
      graceEndsAt: null,
      executedAt: null,
      executedByUserId: null,
      completedAt: null,
      affectedRecords: null,
    };

    await this.redis.set(
      requestKey(request.id),
      JSON.stringify(request),
      'EX',
      REQUEST_TTL_SECONDS,
    );
    await this.redis.sadd(pendingIndexKey, request.id);

    this.logger.warn(
      `cndp_purge_initiated request=${request.id} tenant=${dto.tenantId} type=${dto.requestType} requested_by=${dto.requestedByEmail} initiated_by_admin=${initiatorUserId}`,
    );

    return request;
  }

  // ===========================================================================
  // VALIDATE
  // ===========================================================================

  async validate(requestId: string, validatorUserId: string): Promise<PurgeRequest> {
    const request = await this.fetchRequest(requestId);
    if (request.status === 'cancelled') {
      throw new BadRequestException({
        code: CNDP_PURGE_ERROR_CODES.REQUEST_CANCELLED,
        message: 'Request was cancelled',
      });
    }
    if (request.status !== 'pending') {
      throw new ConflictException({
        code: CNDP_PURGE_ERROR_CODES.ALREADY_VALIDATED,
        message: `Request already in status '${request.status}'`,
      });
    }

    const now = new Date();
    const graceEndsAt = new Date(now);
    graceEndsAt.setDate(graceEndsAt.getDate() + CNDP_GRACE_PERIOD_DAYS);

    const updated: PurgeRequest = {
      ...request,
      status: 'in_grace_period',
      validatedAt: now,
      validatedByUserId: validatorUserId,
      graceEndsAt,
    };
    await this.persist(updated);

    this.logger.warn(
      `cndp_purge_validated request=${requestId} validator=${validatorUserId} grace_ends_at=${graceEndsAt.toISOString()}`,
    );

    return updated;
  }

  // ===========================================================================
  // EXECUTE
  // ===========================================================================

  async execute(requestId: string, executorUserId: string): Promise<PurgeRequest> {
    const request = await this.fetchRequest(requestId);
    if (request.status === 'cancelled') {
      throw new BadRequestException({
        code: CNDP_PURGE_ERROR_CODES.REQUEST_CANCELLED,
        message: 'Request was cancelled',
      });
    }
    if (request.status === 'executed' || request.status === 'completed') {
      throw new ConflictException({
        code: CNDP_PURGE_ERROR_CODES.ALREADY_EXECUTED,
        message: 'Purge already executed',
      });
    }
    if (request.status !== 'in_grace_period') {
      throw new BadRequestException({
        code: CNDP_PURGE_ERROR_CODES.NOT_VALIDATED,
        message: 'Request must be validated and in grace period before execution',
      });
    }
    if (request.graceEndsAt && request.graceEndsAt.getTime() > Date.now()) {
      throw new BadRequestException({
        code: CNDP_PURGE_ERROR_CODES.GRACE_PERIOD_NOT_ELAPSED,
        message: `Grace period not elapsed yet (ends at ${request.graceEndsAt.toISOString()})`,
      });
    }

    const affected = await this.executePurgeQueries(request);

    const completed: PurgeRequest = {
      ...request,
      status: 'completed',
      executedAt: new Date(),
      executedByUserId: executorUserId,
      completedAt: new Date(),
      affectedRecords: affected,
    };
    await this.persist(completed);
    await this.redis.srem(pendingIndexKey, request.id);

    this.logger.warn(
      `cndp_purge_executed request=${requestId} executor=${executorUserId} affected=${JSON.stringify(affected)}`,
    );

    return completed;
  }

  /**
   * Execute les DELETE SQL queries. Sprint 6 : soft-delete uniquement
   * (deletedAt = now). Sprint 12 (compliance) ajoutera hard-delete differe 90j
   * + backup encrypted pre-purge.
   */
  private async executePurgeQueries(request: PurgeRequest): Promise<Record<string, number>> {
    const affected: Record<string, number> = {};
    await this.dataSource.transaction(async (em) => {
      if (request.requestType === 'full_tenant') {
        const tenantUserRes = await em
          .createQueryBuilder()
          .softDelete()
          .from(AuthTenantUser)
          .where('tenant_id = :tid', { tid: request.tenantId })
          .execute();
        affected['auth_tenant_users'] = tenantUserRes.affected ?? 0;

        const userRes = await em
          .createQueryBuilder()
          .softDelete()
          .from(AuthUser)
          .where('tenant_id = :tid', { tid: request.tenantId })
          .execute();
        affected['auth_users'] = userRes.affected ?? 0;

        const tenantRes = await em
          .createQueryBuilder()
          .softDelete()
          .from(AuthTenant)
          .where('id = :tid', { tid: request.tenantId })
          .execute();
        affected['auth_tenants'] = tenantRes.affected ?? 0;
      } else if (request.requestType === 'user_data' && request.targetUserId) {
        const tenantUserRes = await em
          .createQueryBuilder()
          .delete()
          .from(AuthTenantUser)
          .where('user_id = :uid AND tenant_id = :tid', {
            uid: request.targetUserId,
            tid: request.tenantId,
          })
          .execute();
        affected['auth_tenant_users'] = tenantUserRes.affected ?? 0;

        const userRes = await em
          .createQueryBuilder()
          .softDelete()
          .from(AuthUser)
          .where('id = :uid', { uid: request.targetUserId })
          .execute();
        affected['auth_users'] = userRes.affected ?? 0;
      }
    });
    return affected;
  }

  // ===========================================================================
  // CANCEL
  // ===========================================================================

  async cancel(requestId: string, dto: CancelPurgeRequestDto, cancellerUserId: string): Promise<PurgeRequest> {
    const request = await this.fetchRequest(requestId);
    if (request.status === 'executed' || request.status === 'completed') {
      throw new ConflictException({
        code: CNDP_PURGE_ERROR_CODES.ALREADY_EXECUTED,
        message: 'Cannot cancel an already executed purge (irreversible)',
      });
    }
    if (request.status === 'cancelled') {
      throw new ConflictException({
        code: CNDP_PURGE_ERROR_CODES.REQUEST_CANCELLED,
        message: 'Request already cancelled',
      });
    }

    const updated: PurgeRequest = { ...request, status: 'cancelled' };
    await this.persist(updated);
    await this.redis.srem(pendingIndexKey, request.id);

    this.logger.warn(
      `cndp_purge_cancelled request=${requestId} canceller=${cancellerUserId} reason=${dto.reason}`,
    );

    return updated;
  }

  // ===========================================================================
  // QUERIES
  // ===========================================================================

  async listPending(): Promise<PurgeRequest[]> {
    const ids = await this.redis.smembers(pendingIndexKey);
    const results: PurgeRequest[] = [];
    for (const id of ids) {
      const raw = await this.redis.get(requestKey(id));
      if (raw) {
        results.push(this.parseRequest(raw));
      } else {
        // Stale index entry -- remove.
        await this.redis.srem(pendingIndexKey, id);
      }
    }
    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async findById(requestId: string): Promise<PurgeRequest> {
    return this.fetchRequest(requestId);
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  private async fetchRequest(requestId: string): Promise<PurgeRequest> {
    const raw = await this.redis.get(requestKey(requestId));
    if (!raw) {
      throw new NotFoundException({
        code: CNDP_PURGE_ERROR_CODES.REQUEST_NOT_FOUND,
        message: `Purge request '${requestId}' not found`,
      });
    }
    return this.parseRequest(raw);
  }

  private parseRequest(raw: string): PurgeRequest {
    const obj = JSON.parse(raw) as PurgeRequest;
    // Re-hydrate Date objects (JSON-stringified become strings).
    return {
      ...obj,
      createdAt: new Date(obj.createdAt),
      validatedAt: obj.validatedAt ? new Date(obj.validatedAt) : null,
      graceEndsAt: obj.graceEndsAt ? new Date(obj.graceEndsAt) : null,
      executedAt: obj.executedAt ? new Date(obj.executedAt) : null,
      completedAt: obj.completedAt ? new Date(obj.completedAt) : null,
    };
  }

  private async persist(request: PurgeRequest): Promise<void> {
    await this.redis.set(
      requestKey(request.id),
      JSON.stringify(request),
      'EX',
      REQUEST_TTL_SECONDS,
    );
  }
}
