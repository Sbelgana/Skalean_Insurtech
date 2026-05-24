/**
 * RbacAuditService -- Sprint 7 Tache 2.3.9.
 *
 * Service centralisant l'audit des evaluations RBAC + ABAC.
 *
 * Garanties :
 *   - logAccessDenied  : TOUJOURS log (Pino structure + INSERT audit_log + Kafka).
 *   - logAccessGranted : configurable via env LOG_RBAC_GRANTED (defaut 'false')
 *                        pour eviter explosion volume en production.
 *   - Loi 09-08 CNDP : audit obligatoire des refus d'acces aux donnees
 *     personnelles. Retention 10 ans via audit_log table.
 *
 * Architecture :
 *   - Pino structured log : visibilite immediate (loki/elk + SIEM).
 *   - audit_log INSERT : durable, queryable par compliance + super_admin reports.
 *   - Kafka event 'insurtech.events.audit.access_denied' : alerting Sprint 33+.
 *
 * Reference : B-07 Tache 2.3.9 + decision-006 (no-emoji) + loi 09-08 CNDP.
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  type AuthRole,
  type PermissionValue,
  type RbacErrorCode,
} from '@insurtech/auth';
import type { Producer } from 'kafkajs';
import { AuditLog, type DataSource } from '@insurtech/database';
import { DATA_SOURCE_TOKEN } from '../../database/data-source.provider.js';
import { KAFKA_PRODUCER_TOKEN } from '../../kafka/kafka.provider.js';

/** Kafka topic pour alerting acces refuse (Sprint 33+ subscriber). */
export const KAFKA_TOPIC_ACCESS_DENIED = 'insurtech.events.audit.access_denied';

/** Kafka topic pour log granted (best-effort, mode debug). */
export const KAFKA_TOPIC_ACCESS_GRANTED = 'insurtech.events.audit.access_granted';

export interface RbacAuditContext {
  readonly userId?: string;
  readonly userRole: AuthRole;
  readonly tenantId?: string;
  readonly resourceType?: string;
  readonly resourceId?: string;
  readonly ipAddress?: string;
  readonly userAgent?: string;
  readonly traceId?: string;
}

export interface AccessGrantedInput {
  readonly permission: PermissionValue;
  readonly context: RbacAuditContext;
}

export interface AccessDeniedInput {
  readonly permission: PermissionValue;
  readonly reason: RbacErrorCode | string;
  readonly context: RbacAuditContext;
  /** Policy ABAC qui a refuse (si applicable). */
  readonly policy?: string;
}

@Injectable()
export class RbacAuditService {
  private readonly logger = new Logger(RbacAuditService.name);
  private readonly logGrantedEnabled: boolean;

  constructor(
    @Inject(DATA_SOURCE_TOKEN) private readonly dataSource: DataSource,
    @Inject(KAFKA_PRODUCER_TOKEN) private readonly kafkaProducer: Producer,
  ) {
    this.logGrantedEnabled = (process.env['LOG_RBAC_GRANTED'] ?? 'false') === 'true';
  }

  /**
   * Log access GRANTED. Optionnel : seul si LOG_RBAC_GRANTED=true.
   * Pour eviter explosion volume + I/O en production.
   */
  async logAccessGranted(input: AccessGrantedInput): Promise<void> {
    if (!this.logGrantedEnabled) return;

    const { permission, context } = input;
    this.logger.log(
      `rbac_access_granted role=${context.userRole} permission=${permission} user=${context.userId ?? '-'} tenant=${context.tenantId ?? '-'} resource=${context.resourceType ?? '-'}/${context.resourceId ?? '-'}`,
    );

    await this.insertAuditLog('auth.access_granted', permission, context, {
      reason: 'allowed',
    });

    // Best-effort Kafka publish (n'echoue jamais la requete)
    void this.publishKafka(KAFKA_TOPIC_ACCESS_GRANTED, {
      action: 'auth.access_granted',
      permission,
      user_id: context.userId ?? null,
      user_role: context.userRole,
      tenant_id: context.tenantId ?? null,
      timestamp: new Date().toISOString(),
    }).catch((err) => {
      this.logger.warn(`kafka publish granted failed : ${(err as Error).message}`);
    });
  }

  /**
   * Log access DENIED. TOUJOURS execute (CNDP loi 09-08 article 14).
   */
  async logAccessDenied(input: AccessDeniedInput): Promise<void> {
    const { permission, reason, context, policy } = input;

    this.logger.warn(
      `rbac_access_denied role=${context.userRole} permission=${permission} reason=${reason} policy=${policy ?? '-'} user=${context.userId ?? '-'} tenant=${context.tenantId ?? '-'} resource=${context.resourceType ?? '-'}/${context.resourceId ?? '-'} ip=${context.ipAddress ?? '-'}`,
    );

    await this.insertAuditLog('auth.access_denied', permission, context, {
      reason,
      ...(policy ? { policy } : {}),
    });

    // Best-effort Kafka publish (alerting Sprint 33+)
    void this.publishKafka(KAFKA_TOPIC_ACCESS_DENIED, {
      action: 'auth.access_denied',
      permission,
      reason,
      policy: policy ?? null,
      user_id: context.userId ?? null,
      user_role: context.userRole,
      tenant_id: context.tenantId ?? null,
      resource_type: context.resourceType ?? null,
      resource_id: context.resourceId ?? null,
      ip_address: context.ipAddress ?? null,
      timestamp: new Date().toISOString(),
    }).catch((err) => {
      this.logger.warn(`kafka publish denied failed : ${(err as Error).message}`);
    });
  }

  private async insertAuditLog(
    action: string,
    permission: PermissionValue,
    context: RbacAuditContext,
    extra: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.dataSource.getRepository(AuditLog).insert({
        tenantId: context.tenantId ?? null,
        userId: context.userId ?? null,
        action,
        resourceType: context.resourceType ?? 'permission',
        resourceId: context.resourceId ?? null,
        changes: {
          after: {
            permission,
            ...extra,
          },
        },
        ipAddress: context.ipAddress ?? null,
        userAgent: context.userAgent ?? null,
      });
    } catch (err) {
      this.logger.error(
        `audit_log insert failed : ${(err as Error).message} (action=${action} permission=${permission})`,
      );
    }
  }

  private async publishKafka(topic: string, payload: Record<string, unknown>): Promise<void> {
    await this.kafkaProducer.send({
      topic,
      messages: [
        {
          key: payload['user_id'] ? String(payload['user_id']) : 'anonymous',
          value: JSON.stringify(payload),
        },
      ],
    });
  }

  /** Introspection pour tests + diagnostics. */
  isGrantedLoggingEnabled(): boolean {
    return this.logGrantedEnabled;
  }
}
