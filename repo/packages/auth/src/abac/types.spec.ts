/**
 * Tests ABAC types -- Sprint 7 Tache 2.3.6.
 */

import { describe, expect, it } from 'vitest';
import {
  ALL_ABAC_RESOURCE_TYPES,
  AbacContextSchema,
  AbacResourceTypeSchema,
  buildAbacContext,
  isAbacResourceType,
  type AbacContext,
  type AbacPolicy,
  type AbacResult,
} from './types.js';
import { AuthRole } from '../types/auth-roles.js';
import { Permission } from '../rbac/permissions.enum.js';

describe('ABAC types (Sprint 7 Tache 2.3.6)', () => {
  describe('AbacResourceType', () => {
    it('1. contains 14 resource types (11 v2.2 + 3 v3.0)', () => {
      expect(ALL_ABAC_RESOURCE_TYPES).toHaveLength(14);
    });

    it('2. includes v2.2 core resources', () => {
      expect(ALL_ABAC_RESOURCE_TYPES).toContain('crm_contact');
      expect(ALL_ABAC_RESOURCE_TYPES).toContain('insure_police');
      expect(ALL_ABAC_RESOURCE_TYPES).toContain('repair_sinistre');
      expect(ALL_ABAC_RESOURCE_TYPES).toContain('pay_transaction');
      expect(ALL_ABAC_RESOURCE_TYPES).toContain('doc_document');
    });

    it('3. includes v3.0 resources (expert_designation / tow_mission / parts_order)', () => {
      expect(ALL_ABAC_RESOURCE_TYPES).toContain('expert_designation');
      expect(ALL_ABAC_RESOURCE_TYPES).toContain('tow_mission');
      expect(ALL_ABAC_RESOURCE_TYPES).toContain('parts_order');
    });

    it('4. Zod schema validates correct value', () => {
      expect(AbacResourceTypeSchema.safeParse('crm_contact').success).toBe(true);
      expect(AbacResourceTypeSchema.safeParse('expert_designation').success).toBe(true);
    });

    it('5. Zod schema rejects invalid value', () => {
      expect(AbacResourceTypeSchema.safeParse('not_a_resource').success).toBe(false);
    });

    it('6. isAbacResourceType type guard', () => {
      expect(isAbacResourceType('parts_order')).toBe(true);
      expect(isAbacResourceType('invalid')).toBe(false);
      expect(isAbacResourceType(42)).toBe(false);
    });
  });

  describe('AbacContext', () => {
    it('7. minimal context (userId + userRole) validated', () => {
      const ctx: AbacContext = {
        userId: '00000000-0000-0000-0000-000000000001',
        userRole: AuthRole.BrokerAdmin,
      };
      // Zod validates as object (userRole is plain string here)
      const parsed = AbacContextSchema.safeParse(ctx);
      expect(parsed.success).toBe(true);
    });

    it('8. full context with resource fields', () => {
      const ctx: AbacContext = {
        userId: '00000000-0000-0000-0000-000000000001',
        userRole: AuthRole.GarageTechnicien,
        tenantId: '00000000-0000-0000-0000-000000000002',
        resourceType: 'repair_sinistre',
        resourceId: 'sinistre-abc',
        resourceOwnerId: '00000000-0000-0000-0000-000000000003',
        resourceAssigneeId: '00000000-0000-0000-0000-000000000001',
        resourceStatus: 'in_progress',
        resourceCreatedAt: new Date(),
        now: new Date(),
      };
      const parsed = AbacContextSchema.safeParse(ctx);
      expect(parsed.success).toBe(true);
    });

    it('9. invalid userId (not uuid) rejected by Zod', () => {
      const parsed = AbacContextSchema.safeParse({
        userId: 'not-a-uuid',
        userRole: AuthRole.BrokerAdmin,
      });
      expect(parsed.success).toBe(false);
    });
  });

  describe('buildAbacContext helper', () => {
    it('10. inject now default if absent', () => {
      const ctx = buildAbacContext({
        userId: '00000000-0000-0000-0000-000000000001',
        userRole: AuthRole.BrokerAdmin,
      });
      expect(ctx.now).toBeInstanceOf(Date);
    });

    it('11. preserve provided now', () => {
      const fixed = new Date('2026-05-23T12:00:00Z');
      const ctx = buildAbacContext({
        userId: '00000000-0000-0000-0000-000000000001',
        userRole: AuthRole.BrokerAdmin,
        now: fixed,
      });
      expect(ctx.now).toBe(fixed);
    });
  });

  describe('AbacResult shape', () => {
    it('12. allowed=true minimal result', () => {
      const r: AbacResult = { allowed: true };
      expect(r.allowed).toBe(true);
      expect(r.reason).toBeUndefined();
    });

    it('13. allowed=false with reason + policy', () => {
      const r: AbacResult = {
        allowed: false,
        reason: 'OWNER_MISMATCH',
        policy: 'OwnResourcesPolicy',
        permission: Permission.CRM_CONTACTS_UPDATE_OWN,
      };
      expect(r.allowed).toBe(false);
      expect(r.reason).toBe('OWNER_MISMATCH');
    });
  });

  describe('AbacPolicy interface (compile check)', () => {
    it('14. dummy policy compiles + applies + evaluate', () => {
      const dummy: AbacPolicy = {
        name: 'DummyPolicy',
        applies(perm) {
          return perm === Permission.CRM_CONTACTS_READ_OWN;
        },
        evaluate(ctx) {
          return { allowed: ctx.userId === ctx.resourceOwnerId };
        },
      };
      expect(dummy.applies(Permission.CRM_CONTACTS_READ_OWN)).toBe(true);
      expect(dummy.applies(Permission.CRM_CONTACTS_READ)).toBe(false);
      const r = dummy.evaluate({
        userId: 'u1',
        userRole: AuthRole.BrokerUser,
        resourceOwnerId: 'u1',
      }) as AbacResult;
      expect(r.allowed).toBe(true);
    });
  });
});
