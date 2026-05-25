/**
 * IcalTokenService -- Sprint 8 Tache 8.13.
 *
 * iCal feed token lifecycle :
 *   - create()              : generate plain token + persist SHA-256 hash only.
 *   - validateAndRetrieve() : public-endpoint validation (no tenant context).
 *   - recordAccess()        : usage tracking after successful validate.
 *   - findByUser()          : authenticated user lists their own tokens.
 *   - findAllTenantTokens() : admin lists every token in the tenant.
 *   - revoke()              : soft delete (active=false + revoked_at set).
 *
 * Security :
 *   - Plain token = `ical_` + base64url(32 random bytes) = 256-bit entropy.
 *   - DB stores ONLY the SHA-256 hex hash. A DB leak does not compromise
 *     active tokens (hash is one-way).
 *   - Plain token returned UNIQUEMENT at creation. UI must display it once
 *     and instruct the user to subscribe immediately.
 *
 * Reference : B-08 Tache 3.2.7.
 */

import { createHash, randomBytes } from 'node:crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { TenantContextService } from '@insurtech/auth';
import type { CreateIcalTokenDto } from '@insurtech/booking';
import {
  BookingIcalTokenEntity,
  type BookingIcalTokenScope,
  type DataSource,
} from '@insurtech/database';
import { DATA_SOURCE_TOKEN } from '../../../database/data-source.provider.js';

export const ICAL_TOKEN_ERROR_CODES = {
  TENANT_REQUIRED: 'BOOKING_ICAL_TENANT_REQUIRED',
  USER_REQUIRED: 'BOOKING_ICAL_USER_REQUIRED',
  NOT_FOUND: 'BOOKING_ICAL_NOT_FOUND',
  ALREADY_REVOKED: 'BOOKING_ICAL_ALREADY_REVOKED',
  SCOPE_FORBIDDEN: 'BOOKING_ICAL_SCOPE_FORBIDDEN',
} as const;

/**
 * Token plaintext prefix. The 32-byte secret is base64url-encoded after.
 * Prefix gives ops + log readers an at-a-glance "this is an iCal token" hint
 * without leaking entropy.
 */
const TOKEN_PREFIX = 'ical_';
const TOKEN_BYTES = 32;

@Injectable()
export class IcalTokenService {
  private readonly logger = new Logger(IcalTokenService.name);

  constructor(
    @Inject(DATA_SOURCE_TOKEN) private readonly dataSource: DataSource,
    private readonly tenantContext: TenantContextService,
  ) {}

  private getRepo() {
    return this.dataSource.getRepository(BookingIcalTokenEntity);
  }

  private requireTenant(): { tenantId: string; userId: string } {
    const ctx = this.tenantContext.getCurrentContext();
    if (!ctx?.tenantId) {
      throw new BadRequestException({
        code: ICAL_TOKEN_ERROR_CODES.TENANT_REQUIRED,
        message: 'Tenant context required',
      });
    }
    if (!ctx.userId) {
      throw new BadRequestException({
        code: ICAL_TOKEN_ERROR_CODES.USER_REQUIRED,
        message: 'User context required',
      });
    }
    return { tenantId: ctx.tenantId, userId: ctx.userId };
  }

  // ==========================================================================
  // Hashing helpers (pure)
  // ==========================================================================

  /** SHA-256 hex of the plaintext token. Stable across invocations. */
  static hash(plainToken: string): string {
    return createHash('sha256').update(plainToken).digest('hex');
  }

  /** Generates a fresh plain token string. NOT persisted by this method. */
  static generatePlainToken(): string {
    return `${TOKEN_PREFIX}${randomBytes(TOKEN_BYTES).toString('base64url')}`;
  }

  // ==========================================================================
  // Create
  // ==========================================================================

  /**
   * Creates a token. Returns BOTH the persisted entity AND the plain token
   * (the only place it ever exists). Caller wraps it into the public feed
   * URL and returns to the user.
   */
  async create(
    dto: CreateIcalTokenDto,
  ): Promise<{ token: BookingIcalTokenEntity; plainToken: string }> {
    const { tenantId, userId } = this.requireTenant();
    return this.createAs(tenantId, userId, dto);
  }

  /**
   * Tenant-explicit variant. Used by tests + future provisioning workflows
   * that bypass HTTP context.
   */
  async createAs(
    tenantId: string,
    userId: string,
    dto: CreateIcalTokenDto,
  ): Promise<{ token: BookingIcalTokenEntity; plainToken: string }> {
    const plainToken = IcalTokenService.generatePlainToken();
    const tokenHash = IcalTokenService.hash(plainToken);

    const repo = this.getRepo();
    const entity = repo.create({
      tenantId,
      userId,
      tokenHash,
      name: dto.name,
      scope: (dto.scope ?? 'own') as BookingIcalTokenScope,
      expiresAt: dto.expiresAt ?? null,
      active: true,
      accessCount: 0,
    });
    const saved = await repo.save(entity);
    this.logger.log(
      `ical_token_created id=${saved.id} scope=${saved.scope} tenant=${tenantId} user=${userId} expires_at=${saved.expiresAt?.toISOString() ?? 'never'}`,
    );
    return { token: saved, plainToken };
  }

  // ==========================================================================
  // Public-endpoint validation (no tenant context)
  // ==========================================================================

  /**
   * Resolves a plain token to its row IFF (a) the hash matches, (b) the row
   * is active, and (c) the row has not expired. Returns null on any miss --
   * the controller maps to 404 (not 401) to keep the existence of a token
   * opaque to scanners.
   *
   * NO tenant context required : tokens authenticate themselves.
   */
  async validateAndRetrieve(
    plainToken: string,
  ): Promise<BookingIcalTokenEntity | null> {
    if (!plainToken || !plainToken.startsWith(TOKEN_PREFIX)) return null;
    const tokenHash = IcalTokenService.hash(plainToken);
    const row = await this.getRepo().findOne({ where: { tokenHash } });
    if (!row) return null;
    if (!row.active) return null;
    if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) return null;
    return row;
  }

  /**
   * Bumps `access_count` + `last_accessed_at`. Fire-and-forget from the
   * feed endpoint -- failure to record access must not break feed delivery.
   */
  async recordAccess(id: string): Promise<void> {
    await this.getRepo()
      .createQueryBuilder()
      .update(BookingIcalTokenEntity)
      .set({
        last_accessed_at: new Date(),
        access_count: () => 'access_count + 1',
      } as unknown as Record<string, unknown>)
      .where('id = :id', { id })
      .execute();
  }

  // ==========================================================================
  // Authenticated listing + revoke
  // ==========================================================================

  /** Lists tokens owned by the current user. */
  async findByUser(): Promise<BookingIcalTokenEntity[]> {
    const { tenantId, userId } = this.requireTenant();
    return this.getRepo().find({
      where: { tenantId, userId },
      order: { createdAt: 'DESC' },
    });
  }

  /** Lists every token in the tenant (admin scope). */
  async findAllTenantTokens(): Promise<BookingIcalTokenEntity[]> {
    const { tenantId } = this.requireTenant();
    return this.getRepo().find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Soft-delete. Reads first to differentiate "not found in this tenant"
   * (404) from "found but already revoked" (409 via ALREADY_REVOKED code).
   *
   * Authorization : caller must own the token OR have admin scope. The
   * controller layer enforces RBAC ; this method enforces ownership via
   * the (tenant, user) tuple unless allowAdmin is true.
   */
  async revoke(id: string, opts?: { allowAdmin?: boolean }): Promise<void> {
    const { tenantId, userId } = this.requireTenant();
    const where = opts?.allowAdmin
      ? { id, tenantId }
      : { id, tenantId, userId };
    const row = await this.getRepo().findOne({ where });
    if (!row) {
      throw new NotFoundException({
        code: ICAL_TOKEN_ERROR_CODES.NOT_FOUND,
        message: `iCal token ${id} not found`,
      });
    }
    if (!row.active) {
      throw new BadRequestException({
        code: ICAL_TOKEN_ERROR_CODES.ALREADY_REVOKED,
        message: `iCal token ${id} is already revoked`,
      });
    }
    await this.getRepo()
      .createQueryBuilder()
      .update(BookingIcalTokenEntity)
      .set({
        active: false,
        revokedAt: new Date(),
        revokedByUserId: userId,
      })
      .where('id = :id', { id })
      .execute();
    this.logger.log(
      `ical_token_revoked id=${id} scope=${row.scope} tenant=${tenantId} by=${userId}`,
    );
  }
}
