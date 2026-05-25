/**
 * @insurtech/comm/types/comm-message.types
 *
 * Interfaces TypeScript domaine pour CommMessage.
 * Co-existes avec entity TypeORM (@insurtech/database) pour separer
 * representation persistance vs representation domaine.
 */

import type { Channel, Direction, MessageStatus, Provider } from './channel.enum.js';

export type MessageVariables = Record<string, unknown>;

export interface CommMessage {
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
  templateVariables: MessageVariables;
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

export interface MessageTimelineEntry {
  status: MessageStatus;
  occurredAt: Date;
  source: 'system' | 'webhook' | 'admin';
  detail?: string | undefined;
}

/**
 * Matrice transitions valides Sprint 9 Tache 3.2.1 + 3.2.10.
 * Lecture : key = from status, value = liste statuses cibles autorises.
 * Toute transition vers `failed` est toujours autorisee depuis pending/queued/sent (cf updateStatus).
 */
export const STATUS_TRANSITIONS: Readonly<Record<MessageStatus, ReadonlyArray<MessageStatus>>> =
  Object.freeze({
    pending: ['queued', 'sent', 'failed'],
    queued: ['sent', 'failed'],
    sent: ['delivered', 'read', 'failed', 'bounced'],
    delivered: ['read', 'bounced'],
    read: [],
    failed: [],
    bounced: [],
  });

export interface PaginationCursor {
  createdAt: string;
  id: string;
}

export interface PaginatedResult<T> {
  items: ReadonlyArray<T>;
  cursor: string | null;
  total?: number;
}

/**
 * Encode un cursor pagination opaque (base64 JSON) -- pattern Sprint 9.
 * Cursor stable meme si nouvelles lignes inserees pendant pagination (vs offset).
 */
export function encodeCursor(cursor: PaginationCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodeCursor(opaque: string): PaginationCursor | null {
  try {
    const raw = Buffer.from(opaque, 'base64url').toString('utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'createdAt' in parsed &&
      'id' in parsed &&
      typeof (parsed as PaginationCursor).createdAt === 'string' &&
      typeof (parsed as PaginationCursor).id === 'string'
    ) {
      return parsed as PaginationCursor;
    }
    return null;
  } catch {
    return null;
  }
}
