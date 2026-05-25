/**
 * @insurtech/comm/services/messages-repository.service
 *
 * Repository injectable Sprint 9 Tache 3.2.1.
 * Centralise queries comm_messages avec invariants metier :
 *   - filtre tenant_id explicite (defense-in-depth vs RLS)
 *   - garde-fou transitions status (STATUS_TRANSITIONS)
 *   - pagination cursor-based (opaque base64url)
 *
 * NB : ce service depend de @insurtech/database via le repository TypeORM
 * inject par l'app NestJS. Le constructor accepte un repo type-erased pour
 * eviter import cyclique au compile-time.
 */

import { Inject, Injectable, Optional, Logger } from '@nestjs/common';
import type { Repository, FindOptionsWhere } from 'typeorm';
import { Between, ILike, LessThan, IsNull, Not } from 'typeorm';

import type {
  Channel,
  Direction,
  MessageStatus,
  Provider,
} from '../types/channel.enum.js';
import {
  decodeCursor,
  encodeCursor,
  type CommMessage,
  type MessageTimelineEntry,
  type PaginatedResult,
  STATUS_TRANSITIONS,
} from '../types/comm-message.types.js';
import {
  InvalidStatusTransitionError,
  MessageNotFoundError,
  TenantMismatchError,
} from '../errors/messages.errors.js';
import type { MessageFiltersInput, CreateMessageRow } from '../schemas/message.schema.js';

/**
 * Token DI a fournir au module hote (apps/api) pour injecter le repository TypeORM.
 *   providers: [{ provide: COMM_MESSAGES_REPO, useFactory: ds => ds.getRepository(CommMessageEntity), inject: [DataSource] }]
 */
export const COMM_MESSAGES_REPO = Symbol('COMM_MESSAGES_REPO');

interface CommMessageRow {
  id: string;
  tenantId: string;
  contactId: string | null;
  channel: Channel;
  direction: Direction;
  toAddress: string;
  fromAddress: string;
  subject: string | null;
  body: string;
  templateId: string | null;
  templateVariables: Record<string, unknown>;
  status: MessageStatus;
  provider: Provider;
  providerMessageId: string | null;
  sentAt: Date | null;
  deliveredAt: Date | null;
  readAt: Date | null;
  failedAt: Date | null;
  failReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

type CommMessageRepo = Repository<CommMessageRow>;

export interface UpdateStatusOptions {
  providerMessageId?: string | undefined;
  sentAt?: Date | undefined;
  deliveredAt?: Date | undefined;
  readAt?: Date | undefined;
  failedAt?: Date | undefined;
  failReason?: string | undefined;
  force?: boolean | undefined;
}

@Injectable()
export class MessagesRepositoryService {
  private readonly logger = new Logger(MessagesRepositoryService.name);

  constructor(
    @Optional()
    @Inject(COMM_MESSAGES_REPO)
    private readonly repo: CommMessageRepo | undefined,
  ) {}

  private assertRepo(): CommMessageRepo {
    if (this.repo === undefined) {
      throw new Error('COMM_MESSAGES_REPO not injected -- register repository provider in host module');
    }
    return this.repo;
  }

  private toDomain(row: CommMessageRow): CommMessage {
    return {
      id: row.id,
      tenantId: row.tenantId,
      contactId: row.contactId,
      channel: row.channel,
      direction: row.direction,
      toAddress: row.toAddress,
      fromAddress: row.fromAddress,
      subject: row.subject,
      body: row.body,
      templateId: row.templateId,
      templateVariables: row.templateVariables,
      status: row.status,
      provider: row.provider,
      providerMessageId: row.providerMessageId,
      sentAt: row.sentAt,
      deliveredAt: row.deliveredAt,
      readAt: row.readAt,
      failedAt: row.failedAt,
      failReason: row.failReason,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async findById(tenantId: string, messageId: string): Promise<CommMessage | null> {
    const repo = this.assertRepo();
    const row = await repo.findOne({ where: { id: messageId, tenantId } as FindOptionsWhere<CommMessageRow> });
    return row !== null ? this.toDomain(row) : null;
  }

  async findByIdOrFail(tenantId: string, messageId: string): Promise<CommMessage> {
    const found = await this.findById(tenantId, messageId);
    if (found === null) {
      throw new MessageNotFoundError(messageId);
    }
    return found;
  }

  async findByProviderMessageId(
    provider: Provider,
    providerMessageId: string,
    tenantId?: string,
  ): Promise<CommMessage | null> {
    const repo = this.assertRepo();
    const where: FindOptionsWhere<CommMessageRow> = { provider, providerMessageId };
    if (tenantId !== undefined) {
      where.tenantId = tenantId;
    }
    const row = await repo.findOne({ where });
    return row !== null ? this.toDomain(row) : null;
  }

  async create(input: CreateMessageRow): Promise<CommMessage> {
    const repo = this.assertRepo();
    const entity = repo.create({
      tenantId: input.tenantId,
      contactId: input.contactId,
      channel: input.channel,
      direction: input.direction,
      toAddress: input.toAddress,
      fromAddress: input.fromAddress,
      subject: input.subject,
      body: input.body,
      templateId: input.templateId,
      templateVariables: input.templateVariables,
      status: input.status ?? 'pending',
      provider: input.provider,
      providerMessageId: input.providerMessageId ?? null,
    });
    const saved = await repo.save(entity);
    return this.toDomain(saved);
  }

  async updateStatus(
    tenantId: string,
    messageId: string,
    targetStatus: MessageStatus,
    options: UpdateStatusOptions = {},
  ): Promise<CommMessage> {
    const repo = this.assertRepo();
    const row = await repo.findOne({ where: { id: messageId } as FindOptionsWhere<CommMessageRow> });
    if (row === null) {
      throw new MessageNotFoundError(messageId);
    }
    if (row.tenantId !== tenantId) {
      throw new TenantMismatchError(tenantId, row.tenantId);
    }

    if (options.force !== true) {
      const allowed = STATUS_TRANSITIONS[row.status];
      // `* -> failed` toujours autorise (operational catch-all)
      if (targetStatus !== 'failed' && !allowed.includes(targetStatus)) {
        throw new InvalidStatusTransitionError(row.status, targetStatus);
      }
    }

    row.status = targetStatus;
    if (options.providerMessageId !== undefined) row.providerMessageId = options.providerMessageId;
    if (options.sentAt !== undefined) row.sentAt = options.sentAt;
    if (options.deliveredAt !== undefined) row.deliveredAt = options.deliveredAt;
    if (options.readAt !== undefined) row.readAt = options.readAt;
    if (options.failedAt !== undefined) row.failedAt = options.failedAt;
    if (options.failReason !== undefined) row.failReason = options.failReason;

    const saved = await repo.save(row);
    this.logger.log(
      `comm_messages.updateStatus messageId=${messageId} from=${row.status} to=${targetStatus}`,
    );
    return this.toDomain(saved);
  }

  async findByFilters(
    tenantId: string,
    filters: MessageFiltersInput,
  ): Promise<PaginatedResult<CommMessage>> {
    const repo = this.assertRepo();
    const limit = Math.min(filters.limit, 200);
    const where: FindOptionsWhere<CommMessageRow> = { tenantId };

    if (filters.channel !== undefined) where.channel = filters.channel;
    if (filters.direction !== undefined) where.direction = filters.direction;
    if (filters.status !== undefined) where.status = filters.status;
    if (filters.contactId !== undefined) where.contactId = filters.contactId;
    if (filters.templateId !== undefined) where.templateId = filters.templateId;
    if (filters.dateFrom !== undefined && filters.dateTo !== undefined) {
      where.createdAt = Between(filters.dateFrom, filters.dateTo);
    }
    if (filters.search !== undefined && filters.search.length > 0) {
      where.body = ILike(`%${filters.search}%`);
    }

    if (filters.cursor !== undefined) {
      const decoded = decodeCursor(filters.cursor);
      if (decoded !== null) {
        where.createdAt = LessThan(new Date(decoded.createdAt));
      }
    }

    const rows = await repo.find({
      where,
      order: { createdAt: 'DESC', id: 'DESC' },
      take: limit + 1,
    });

    const hasMore = rows.length > limit;
    const items = (hasMore ? rows.slice(0, limit) : rows).map((r) => this.toDomain(r));
    let cursor: string | null = null;
    if (hasMore) {
      const last = items[items.length - 1];
      if (last !== undefined) {
        cursor = encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id });
      }
    }
    return { items, cursor };
  }

  async countByStatus(tenantId: string, channel?: Channel): Promise<Record<MessageStatus, number>> {
    const repo = this.assertRepo();
    const qb = repo
      .createQueryBuilder('m')
      .select('m.status', 'status')
      .addSelect('COUNT(*)::int', 'count')
      .where('m.tenant_id = :tenantId', { tenantId })
      .groupBy('m.status');
    if (channel !== undefined) {
      qb.andWhere('m.channel = :channel', { channel });
    }
    const rows = (await qb.getRawMany()) as Array<{ status: MessageStatus; count: number }>;
    const empty: Record<MessageStatus, number> = {
      pending: 0,
      queued: 0,
      sent: 0,
      delivered: 0,
      read: 0,
      failed: 0,
      bounced: 0,
    };
    for (const row of rows) {
      empty[row.status] = Number(row.count);
    }
    return empty;
  }

  /**
   * Reconstruit la timeline d'un message en s'appuyant sur les colonnes timestamps.
   * Note : pas de table evenement separee pour Sprint 9 -- les statuts sont les sources of truth.
   */
  async getStatusTimeline(tenantId: string, messageId: string): Promise<MessageTimelineEntry[]> {
    const msg = await this.findByIdOrFail(tenantId, messageId);
    const entries: MessageTimelineEntry[] = [];
    entries.push({ status: 'pending', occurredAt: msg.createdAt, source: 'system' });
    if (msg.sentAt !== null) entries.push({ status: 'sent', occurredAt: msg.sentAt, source: 'system' });
    if (msg.deliveredAt !== null)
      entries.push({ status: 'delivered', occurredAt: msg.deliveredAt, source: 'webhook' });
    if (msg.readAt !== null)
      entries.push({ status: 'read', occurredAt: msg.readAt, source: 'webhook' });
    if (msg.failedAt !== null) {
      entries.push({
        status: msg.status === 'bounced' ? 'bounced' : 'failed',
        occurredAt: msg.failedAt,
        source: 'webhook',
        detail: msg.failReason ?? undefined,
      });
    }
    return entries;
  }
}

// re-export to silence noUnusedImports for IsNull/Not (kept for future filters)
void IsNull;
void Not;
