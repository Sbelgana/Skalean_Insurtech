/**
 * Tests RbacAuditService -- Sprint 7 Tache 2.3.9.
 *
 * Couvre :
 *   - logAccessGranted : skip si LOG_RBAC_GRANTED=false, execute sinon
 *   - logAccessDenied : TOUJOURS execute + audit_log INSERT + Kafka publish
 *   - Kafka publish failure : log warn mais ne casse pas
 *   - DB insert failure : log error mais ne casse pas
 */

import { AuthRole, Permission, RBAC_ERROR_CODES } from '@insurtech/auth';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  KAFKA_TOPIC_ACCESS_DENIED,
  KAFKA_TOPIC_ACCESS_GRANTED,
  RbacAuditService,
} from './rbac-audit.service.js';

function buildDataSource(insertFn?: () => Promise<void>) {
  return {
    getRepository: () => ({
      insert: insertFn ?? vi.fn().mockResolvedValue(undefined),
    }),
  } as unknown as Parameters<typeof RbacAuditService.prototype.logAccessDenied>[0] extends never
    ? never
    : ConstructorParameters<typeof RbacAuditService>[0];
}

function buildKafkaProducer(sendFn?: ReturnType<typeof vi.fn>) {
  return {
    send: sendFn ?? vi.fn().mockResolvedValue(undefined),
  } as unknown as ConstructorParameters<typeof RbacAuditService>[1];
}

const baseContext = {
  userId: '00000000-0000-0000-0000-000000000001',
  userRole: AuthRole.BrokerUser,
  tenantId: '00000000-0000-0000-0000-000000000002',
  ipAddress: '127.0.0.1',
  userAgent: 'vitest',
  traceId: 'trc-test',
};

describe('RbacAuditService (Sprint 7 Tache 2.3.9)', () => {
  const originalLogGranted = process.env['LOG_RBAC_GRANTED'];

  afterEach(() => {
    if (originalLogGranted === undefined) {
      delete process.env['LOG_RBAC_GRANTED'];
    } else {
      process.env['LOG_RBAC_GRANTED'] = originalLogGranted;
    }
  });

  describe('logAccessGranted', () => {
    it('1. SKIP si LOG_RBAC_GRANTED=false (defaut)', async () => {
      delete process.env['LOG_RBAC_GRANTED'];
      const insertFn = vi.fn().mockResolvedValue(undefined);
      const sendFn = vi.fn().mockResolvedValue(undefined);
      const svc = new RbacAuditService(
        { getRepository: () => ({ insert: insertFn }) } as never,
        { send: sendFn } as never,
      );
      await svc.logAccessGranted({
        permission: Permission.CRM_CONTACTS_READ,
        context: baseContext,
      });
      expect(insertFn).not.toHaveBeenCalled();
      expect(sendFn).not.toHaveBeenCalled();
    });

    it('2. EXECUTE si LOG_RBAC_GRANTED=true', async () => {
      process.env['LOG_RBAC_GRANTED'] = 'true';
      const insertFn = vi.fn().mockResolvedValue(undefined);
      const sendFn = vi.fn().mockResolvedValue(undefined);
      const svc = new RbacAuditService(
        { getRepository: () => ({ insert: insertFn }) } as never,
        { send: sendFn } as never,
      );
      await svc.logAccessGranted({
        permission: Permission.CRM_CONTACTS_READ,
        context: baseContext,
      });
      // attendre Kafka void publish best-effort
      await new Promise((resolve) => setTimeout(resolve, 5));
      expect(insertFn).toHaveBeenCalledOnce();
      expect(sendFn).toHaveBeenCalledOnce();
      expect(sendFn).toHaveBeenCalledWith({
        topic: KAFKA_TOPIC_ACCESS_GRANTED,
        messages: [expect.objectContaining({ key: baseContext.userId })],
      });
    });

    it('3. isGrantedLoggingEnabled getter reflect env', () => {
      process.env['LOG_RBAC_GRANTED'] = 'true';
      const svc = new RbacAuditService(
        { getRepository: () => ({ insert: vi.fn() }) } as never,
        { send: vi.fn() } as never,
      );
      expect(svc.isGrantedLoggingEnabled()).toBe(true);
    });
  });

  describe('logAccessDenied', () => {
    beforeEach(() => {
      delete process.env['LOG_RBAC_GRANTED'];
    });

    it('4. TOUJOURS execute audit_log INSERT + Kafka', async () => {
      const insertFn = vi.fn().mockResolvedValue(undefined);
      const sendFn = vi.fn().mockResolvedValue(undefined);
      const svc = new RbacAuditService(
        { getRepository: () => ({ insert: insertFn }) } as never,
        { send: sendFn } as never,
      );
      await svc.logAccessDenied({
        permission: Permission.CRM_CONTACTS_DELETE,
        reason: RBAC_ERROR_CODES.PERMISSION_NOT_GRANTED,
        context: baseContext,
      });
      await new Promise((resolve) => setTimeout(resolve, 5));
      expect(insertFn).toHaveBeenCalledOnce();
      expect(sendFn).toHaveBeenCalledOnce();
      expect(sendFn).toHaveBeenCalledWith({
        topic: KAFKA_TOPIC_ACCESS_DENIED,
        messages: [
          expect.objectContaining({
            key: baseContext.userId,
            value: expect.stringContaining(RBAC_ERROR_CODES.PERMISSION_NOT_GRANTED),
          }),
        ],
      });
    });

    it('5. inclut policy si fourni (ABAC denied)', async () => {
      const insertFn = vi.fn().mockResolvedValue(undefined);
      const sendFn = vi.fn().mockResolvedValue(undefined);
      const svc = new RbacAuditService(
        { getRepository: () => ({ insert: insertFn }) } as never,
        { send: sendFn } as never,
      );
      await svc.logAccessDenied({
        permission: Permission.CRM_CONTACTS_READ_OWN,
        reason: RBAC_ERROR_CODES.ABAC_DENIED,
        context: baseContext,
        policy: 'OwnResourcesPolicy',
      });
      await new Promise((resolve) => setTimeout(resolve, 5));
      const insertCall = insertFn.mock.calls[0]?.[0];
      expect(insertCall.changes.after.policy).toBe('OwnResourcesPolicy');
    });

    it('6. DB insert failure : ne propage pas, log error', async () => {
      const insertFn = vi.fn().mockRejectedValue(new Error('DB down'));
      const sendFn = vi.fn().mockResolvedValue(undefined);
      const svc = new RbacAuditService(
        { getRepository: () => ({ insert: insertFn }) } as never,
        { send: sendFn } as never,
      );
      // Ne doit PAS throw
      await expect(
        svc.logAccessDenied({
          permission: Permission.CRM_CONTACTS_DELETE,
          reason: RBAC_ERROR_CODES.PERMISSION_NOT_GRANTED,
          context: baseContext,
        }),
      ).resolves.not.toThrow();
      // Kafka send still attempted
      await new Promise((resolve) => setTimeout(resolve, 5));
      expect(sendFn).toHaveBeenCalledOnce();
    });

    it('7. Kafka publish failure : ne propage pas, log warn', async () => {
      const insertFn = vi.fn().mockResolvedValue(undefined);
      const sendFn = vi.fn().mockRejectedValue(new Error('Kafka down'));
      const svc = new RbacAuditService(
        { getRepository: () => ({ insert: insertFn }) } as never,
        { send: sendFn } as never,
      );
      await expect(
        svc.logAccessDenied({
          permission: Permission.CRM_CONTACTS_DELETE,
          reason: RBAC_ERROR_CODES.PERMISSION_NOT_GRANTED,
          context: baseContext,
        }),
      ).resolves.not.toThrow();
    });

    it('8. context sans userId : key=anonymous + tenant_id null', async () => {
      const insertFn = vi.fn().mockResolvedValue(undefined);
      const sendFn = vi.fn().mockResolvedValue(undefined);
      const svc = new RbacAuditService(
        { getRepository: () => ({ insert: insertFn }) } as never,
        { send: sendFn } as never,
      );
      await svc.logAccessDenied({
        permission: Permission.PUBLIC_PRODUCTS_READ,
        reason: RBAC_ERROR_CODES.NO_USER_CONTEXT,
        context: {
          userRole: AuthRole.Prospect,
        },
      });
      await new Promise((resolve) => setTimeout(resolve, 5));
      expect(sendFn).toHaveBeenCalledWith({
        topic: KAFKA_TOPIC_ACCESS_DENIED,
        messages: [expect.objectContaining({ key: 'anonymous' })],
      });
    });
  });

  describe('audit_log content', () => {
    beforeEach(() => {
      delete process.env['LOG_RBAC_GRANTED'];
    });

    it('9. action="auth.access_denied" + resource_type defaulted', async () => {
      const insertFn = vi.fn().mockResolvedValue(undefined);
      const svc = new RbacAuditService(
        { getRepository: () => ({ insert: insertFn }) } as never,
        { send: vi.fn().mockResolvedValue(undefined) } as never,
      );
      await svc.logAccessDenied({
        permission: Permission.INSURE_POLICIES_CANCEL,
        reason: RBAC_ERROR_CODES.PERMISSION_NOT_GRANTED,
        context: baseContext,
      });
      const call = insertFn.mock.calls[0]?.[0];
      expect(call.action).toBe('auth.access_denied');
      expect(call.resourceType).toBe('permission');
      expect(call.userId).toBe(baseContext.userId);
      expect(call.tenantId).toBe(baseContext.tenantId);
      expect(call.changes.after.permission).toBe(Permission.INSURE_POLICIES_CANCEL);
      expect(call.changes.after.reason).toBe(RBAC_ERROR_CODES.PERMISSION_NOT_GRANTED);
    });

    it('10. resource_type override depuis context (ex: crm_contact)', async () => {
      const insertFn = vi.fn().mockResolvedValue(undefined);
      const svc = new RbacAuditService(
        { getRepository: () => ({ insert: insertFn }) } as never,
        { send: vi.fn().mockResolvedValue(undefined) } as never,
      );
      await svc.logAccessDenied({
        permission: Permission.CRM_CONTACTS_READ_OWN,
        reason: RBAC_ERROR_CODES.ABAC_DENIED,
        context: {
          ...baseContext,
          resourceType: 'crm_contact',
          resourceId: 'contact-abc',
        },
      });
      const call = insertFn.mock.calls[0]?.[0];
      expect(call.resourceType).toBe('crm_contact');
      expect(call.resourceId).toBe('contact-abc');
    });
  });
});
