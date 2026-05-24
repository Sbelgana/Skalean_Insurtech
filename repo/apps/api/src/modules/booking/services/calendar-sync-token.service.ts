/**
 * CalendarSyncTokenService -- Sprint 8 Tache 8.10 (foundation only).
 *
 * Persistence layer pour OAuth calendar tokens (Google / Outlook / CalDAV).
 *
 * Encryption AES-256-GCM TRANSPARENTE :
 *   - Le @Column transformer createEncryptedColumnTransformer (Sprint 2) chiffre
 *     access_token / refresh_token automatiquement avant INSERT/UPDATE et
 *     dechiffre apres SELECT. Format ciphertext "iv_b64:tag_b64:enc_b64".
 *   - Master key : env var CALENDAR_TOKEN_ENCRYPTION_KEY (32 bytes hex).
 *   - Entity expose `accessToken` / `refreshToken` en plaintext cote service ;
 *     DB stocke `access_token_encrypted` / `refresh_token_encrypted` cipher.
 *
 * Foundation scope (user decision Option A) :
 *   - DB CRUD complet pour tokens + webhook subscriptions tracking
 *   - PAS de Provider services (googleapis / MS Graph SDK) ni Controller OAuth
 *     flow : deferred Task 8.10b quand dev credentials disponibles + public
 *     callback URL accessible.
 *   - Sprint 8.12 (Bi-directional sync) consommera ce service pour obtenir
 *     access tokens valides (getValidAccessTokenById) avant chaque API call.
 *
 * Auto-disable threshold :
 *   - Apres N consecutive_failures (recommande 5, configurable AUTO_DISABLE_THRESHOLD),
 *     `sync_enabled` est mis a false pour preserver les tokens en attendant
 *     re-auth user (UX claire vs perte silencieuse).
 *
 * Audit Pino structured (loi 09-08 CNDP -- tokens = donnees sensitives).
 *
 * Reference : B-08 Tache 3.2.3 (foundation).
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
  CalendarProvider,
  CalendarSyncStatus,
  RecordSyncOutcomeDto,
  SaveCalendarTokensDto,
  SaveWebhookSubscriptionDto,
} from '@insurtech/booking';
import { BookingCalendarSyncEntity, type DataSource } from '@insurtech/database';
import { DATA_SOURCE_TOKEN } from '../../../database/data-source.provider.js';

export const CALENDAR_SYNC_ERROR_CODES = {
  TENANT_REQUIRED: 'CALENDAR_SYNC_TENANT_REQUIRED',
  NOT_FOUND: 'CALENDAR_SYNC_NOT_FOUND',
  DUPLICATE_ACCOUNT: 'CALENDAR_SYNC_DUPLICATE_ACCOUNT',
  ALREADY_DISABLED: 'CALENDAR_SYNC_ALREADY_DISABLED',
} as const;

/** Auto-disable threshold for consecutive failed syncs. */
export const DEFAULT_AUTO_DISABLE_THRESHOLD = 5;

@Injectable()
export class CalendarSyncTokenService {
  private readonly logger = new Logger(CalendarSyncTokenService.name);
  private readonly autoDisableThreshold: number;

  constructor(
    @Inject(DATA_SOURCE_TOKEN) private readonly dataSource: DataSource,
    private readonly tenantContext: TenantContextService,
  ) {
    const envThreshold = process.env['CALENDAR_SYNC_AUTO_DISABLE_THRESHOLD'];
    const parsed = envThreshold ? Number.parseInt(envThreshold, 10) : NaN;
    this.autoDisableThreshold = Number.isFinite(parsed) && parsed > 0
      ? parsed
      : DEFAULT_AUTO_DISABLE_THRESHOLD;
  }

  private getRepo() {
    return this.dataSource.getRepository(BookingCalendarSyncEntity);
  }

  private requireTenantId(): string {
    const ctx = this.tenantContext.getCurrentContext();
    const tenantId = ctx?.tenantId;
    if (!tenantId) {
      throw new BadRequestException({
        code: CALENDAR_SYNC_ERROR_CODES.TENANT_REQUIRED,
        message: 'Tenant context required',
      });
    }
    return tenantId;
  }

  // ==========================================================================
  // Lookup
  // ==========================================================================

  async findByUser(userId: string): Promise<BookingCalendarSyncEntity[]> {
    const tenantId = this.requireTenantId();
    return this.getRepo().find({
      where: { tenantId, userId },
      order: { provider: 'ASC', createdAt: 'ASC' },
    });
  }

  async findActiveByUserProvider(
    userId: string,
    provider: CalendarProvider,
  ): Promise<BookingCalendarSyncEntity | null> {
    const tenantId = this.requireTenantId();
    return this.getRepo().findOne({
      where: { tenantId, userId, provider, syncEnabled: true },
    });
  }

  async findById(id: string): Promise<BookingCalendarSyncEntity> {
    const tenantId = this.requireTenantId();
    const row = await this.getRepo().findOne({ where: { id, tenantId } });
    if (!row) {
      throw new NotFoundException({
        code: CALENDAR_SYNC_ERROR_CODES.NOT_FOUND,
        message: `Calendar sync ${id} not found`,
      });
    }
    return row;
  }

  /**
   * Phase 2 (Task 8.12) -- find all active sync tokens for a (tenant, user)
   * pair. Used by sync worker push path : iterate user's connected providers
   * and create/update events on each. Unauthenticated-friendly variant.
   */
  async findActiveTokensByUserAs(
    tenantId: string,
    userId: string,
  ): Promise<BookingCalendarSyncEntity[]> {
    return this.getRepo().find({
      where: { tenantId, userId, syncEnabled: true },
      order: { provider: 'ASC' },
    });
  }

  /**
   * Phase 2 (Task 8.12) -- cron reconciliation : enumerate every active sync.
   * Used by reconcileAll fallback for missed webhooks. Bypasses tenant context
   * (the cron is cross-tenant).
   */
  async findAllActiveTokens(): Promise<BookingCalendarSyncEntity[]> {
    return this.getRepo().find({
      where: { syncEnabled: true },
      order: { tenantId: 'ASC', provider: 'ASC' },
    });
  }

  /**
   * Lookup by webhook subscription id (Task 8.10b webhook receivers).
   * No tenant filter -- webhook payloads arrive unauthenticated, the
   * subscription id IS the authentication.
   */
  async findByWebhookSubscriptionId(
    webhookSubscriptionId: string,
  ): Promise<BookingCalendarSyncEntity | null> {
    return this.getRepo().findOne({
      where: { webhookSubscriptionId },
    });
  }

  /** Cron prep : list active syncs with webhook expiring within `withinHours`. */
  async findWebhooksExpiringWithin(
    withinHours: number,
  ): Promise<BookingCalendarSyncEntity[]> {
    const threshold = new Date(Date.now() + withinHours * 60 * 60 * 1000);
    return this.getRepo()
      .createQueryBuilder('s')
      .where('s.sync_enabled = true')
      .andWhere('s.webhook_expires_at IS NOT NULL')
      .andWhere('s.webhook_expires_at <= :threshold', { threshold })
      .orderBy('s.webhook_expires_at', 'ASC')
      .getMany();
  }

  // ==========================================================================
  // Mutations
  // ==========================================================================

  /**
   * Persist OAuth tokens after exchange. Encryption is transparent via
   * TypeORM ValueTransformer (Sprint 2). Re-uses existing row if same
   * (tenant, user, provider, providerAccountId) exists.
   */
  async saveTokens(
    userId: string,
    dto: SaveCalendarTokensDto,
  ): Promise<BookingCalendarSyncEntity> {
    const tenantId = this.requireTenantId();
    return this.saveTokensAs(tenantId, userId, dto);
  }

  /**
   * Tenant-explicit variant for unauthenticated callers (e.g. OAuth callback
   * where the CSRF state payload provides the tenant + user). Task 8.10b.
   */
  async saveTokensAs(
    tenantId: string,
    userId: string,
    dto: SaveCalendarTokensDto,
  ): Promise<BookingCalendarSyncEntity> {
    const repo = this.getRepo();

    const existing = await repo.findOne({
      where: {
        tenantId,
        userId,
        provider: dto.provider,
        providerAccountId: dto.providerAccountId,
      },
    });

    if (existing) {
      // Re-auth flow : update tokens + reset failure counters + re-enable.
      existing.accessToken = dto.accessToken;
      if (dto.refreshToken !== undefined) {
        existing.refreshToken = dto.refreshToken;
      }
      existing.tokenExpiresAt = dto.tokenExpiresAt ?? null;
      if (dto.scope !== undefined) existing.scope = dto.scope;
      existing.consecutiveFailures = 0;
      existing.lastSyncStatus = null;
      existing.lastSyncError = null;
      existing.syncEnabled = true;
      const saved = await repo.save(existing);
      this.logger.log(
        `calendar_sync_tokens_updated id=${saved.id} provider=${saved.provider} account=${saved.providerAccountId} tenant=${tenantId} user=${userId}`,
      );
      return saved;
    }

    const entity = repo.create({
      tenantId,
      userId,
      provider: dto.provider,
      providerAccountId: dto.providerAccountId,
      accessToken: dto.accessToken,
      refreshToken: dto.refreshToken ?? null,
      tokenExpiresAt: dto.tokenExpiresAt ?? null,
      scope: dto.scope ?? null,
      syncEnabled: true,
      consecutiveFailures: 0,
    });
    const saved = await repo.save(entity);
    this.logger.log(
      `calendar_sync_tokens_created id=${saved.id} provider=${saved.provider} account=${saved.providerAccountId} tenant=${tenantId} user=${userId}`,
    );
    return saved;
  }

  /** Returns the decrypted access token (or null if sync disabled). */
  async getDecryptedAccessTokenById(id: string): Promise<string | null> {
    const row = await this.findById(id);
    if (!row.syncEnabled) return null;
    return row.accessToken;
  }

  /** Returns the decrypted refresh token (or null). */
  async getDecryptedRefreshTokenById(id: string): Promise<string | null> {
    const row = await this.findById(id);
    return row.refreshToken;
  }

  /** Persist webhook subscription association after createWebhookSubscription. */
  async saveWebhookSubscription(
    id: string,
    dto: SaveWebhookSubscriptionDto,
  ): Promise<void> {
    const row = await this.findById(id);
    await this.persistWebhookSubscription(id, row.provider, dto);
  }

  /**
   * Tenant-explicit variant for OAuth callback path (unauthenticated).
   * Also persists the clientState used for webhook validation in metadata.
   * Task 8.10b.
   */
  async saveWebhookSubscriptionAs(
    tenantId: string,
    id: string,
    dto: SaveWebhookSubscriptionDto,
    clientState: string,
  ): Promise<void> {
    const row = await this.getRepo().findOne({ where: { id, tenantId } });
    if (!row) {
      throw new NotFoundException({
        code: CALENDAR_SYNC_ERROR_CODES.NOT_FOUND,
        message: `Calendar sync ${id} not found`,
      });
    }
    // Merge clientState into metadata jsonb so webhook receivers can validate
    // incoming notifications. Webhook validation pulls it from row.metadata.webhookClientState.
    const newMetadata = { ...(row.metadata ?? {}), webhookClientState: clientState };
    await this.getRepo()
      .createQueryBuilder()
      .update(BookingCalendarSyncEntity)
      .set({
        webhook_subscription_id: dto.webhookSubscriptionId,
        webhook_resource_id: dto.webhookResourceId ?? null,
        webhook_expires_at: dto.webhookExpiresAt,
        metadata: newMetadata,
      } as unknown as Record<string, unknown>)
      .where('id = :id', { id })
      .execute();
    this.logger.log(
      `calendar_sync_webhook_saved id=${id} provider=${row.provider} subscription_id=${dto.webhookSubscriptionId} expires_at=${dto.webhookExpiresAt.toISOString()} tenant=${tenantId}`,
    );
  }

  private async persistWebhookSubscription(
    id: string,
    provider: string,
    dto: SaveWebhookSubscriptionDto,
  ): Promise<void> {
    await this.getRepo()
      .createQueryBuilder()
      .update(BookingCalendarSyncEntity)
      .set({
        webhook_subscription_id: dto.webhookSubscriptionId,
        webhook_resource_id: dto.webhookResourceId ?? null,
        webhook_expires_at: dto.webhookExpiresAt,
      } as unknown as Record<string, unknown>)
      .where('id = :id', { id })
      .execute();
    this.logger.log(
      `calendar_sync_webhook_saved id=${id} provider=${provider} subscription_id=${dto.webhookSubscriptionId} expires_at=${dto.webhookExpiresAt.toISOString()}`,
    );
  }

  /** Record sync outcome from sync worker (Task 8.12). */
  async recordSyncOutcome(
    id: string,
    dto: RecordSyncOutcomeDto,
  ): Promise<BookingCalendarSyncEntity> {
    const tenantId = this.requireTenantId();
    return this.recordSyncOutcomeAs(tenantId, id, dto);
  }

  /**
   * Tenant-explicit variant for unauthenticated callers (cron, webhook
   * receivers, OAuth callback refresh-failure path). Task 8.10b.
   */
  async recordSyncOutcomeAs(
    tenantId: string,
    id: string,
    dto: RecordSyncOutcomeDto,
  ): Promise<BookingCalendarSyncEntity> {
    const row = await this.getRepo().findOne({ where: { id, tenantId } });
    if (!row) {
      throw new NotFoundException({
        code: CALENDAR_SYNC_ERROR_CODES.NOT_FOUND,
        message: `Calendar sync ${id} not found`,
      });
    }
    return this.recordOutcomeOnRow(tenantId, row, dto);
  }

  private async recordOutcomeOnRow(
    tenantId: string,
    row: BookingCalendarSyncEntity,
    dto: RecordSyncOutcomeDto,
  ): Promise<BookingCalendarSyncEntity> {
    const id = row.id;

    const isSuccess = dto.status === 'success';
    const newFailures = isSuccess ? 0 : row.consecutiveFailures + 1;
    const shouldAutoDisable =
      !isSuccess && newFailures >= this.autoDisableThreshold && row.syncEnabled;

    await this.getRepo()
      .createQueryBuilder()
      .update(BookingCalendarSyncEntity)
      .set({
        last_sync_at: new Date(),
        last_sync_status: dto.status,
        last_sync_error: dto.error ?? null,
        consecutive_failures: newFailures,
        ...(shouldAutoDisable ? { sync_enabled: false } : {}),
      } as unknown as Record<string, unknown>)
      .where('id = :id', { id })
      .execute();

    const updated = await this.getRepo().findOne({ where: { id, tenantId } });
    this.logger.log(
      `calendar_sync_recorded id=${id} status=${dto.status} consecutive_failures=${newFailures} auto_disabled=${shouldAutoDisable} tenant=${tenantId}`,
    );
    return updated!;
  }

  /** Disable sync (manual disconnect or after auto-disable). Preserves tokens. */
  async disable(id: string): Promise<void> {
    const tenantId = this.requireTenantId();
    const row = await this.findById(id);
    if (!row.syncEnabled) {
      throw new ConflictException({
        code: CALENDAR_SYNC_ERROR_CODES.ALREADY_DISABLED,
        message: `Calendar sync ${id} is already disabled`,
      });
    }
    await this.getRepo()
      .createQueryBuilder()
      .update(BookingCalendarSyncEntity)
      .set({ sync_enabled: false } as unknown as Record<string, unknown>)
      .where('id = :id', { id })
      .execute();
    this.logger.log(
      `calendar_sync_disabled id=${id} provider=${row.provider} tenant=${tenantId}`,
    );
  }

  /** Re-enable sync (Task 8.10b after re-auth flow completes successfully). */
  async enable(id: string): Promise<void> {
    const tenantId = this.requireTenantId();
    const row = await this.findById(id);
    if (row.syncEnabled) {
      return; // idempotent
    }
    await this.getRepo()
      .createQueryBuilder()
      .update(BookingCalendarSyncEntity)
      .set({
        sync_enabled: true,
        consecutive_failures: 0,
      } as unknown as Record<string, unknown>)
      .where('id = :id', { id })
      .execute();
    this.logger.log(
      `calendar_sync_enabled id=${id} provider=${row.provider} tenant=${tenantId}`,
    );
  }

  /**
   * Public DTO -- never expose ciphertext or plaintext tokens, only metadata.
   */
  toConnectionInfo(row: BookingCalendarSyncEntity): {
    id: string;
    provider: CalendarProvider;
    providerAccountId: string;
    syncEnabled: boolean;
    scope: string | null;
    tokenExpiresAt: Date | null;
    lastSyncAt: Date | null;
    lastSyncStatus: CalendarSyncStatus | null;
    lastSyncError: string | null;
    webhookExpiresAt: Date | null;
    consecutiveFailures: number;
  } {
    return {
      id: row.id,
      provider: row.provider as CalendarProvider,
      providerAccountId: row.providerAccountId,
      syncEnabled: row.syncEnabled,
      scope: row.scope,
      tokenExpiresAt: row.tokenExpiresAt,
      lastSyncAt: row.lastSyncAt,
      lastSyncStatus: row.lastSyncStatus as CalendarSyncStatus | null,
      lastSyncError: row.lastSyncError,
      webhookExpiresAt: row.webhookExpiresAt,
      consecutiveFailures: row.consecutiveFailures,
    };
  }
}
