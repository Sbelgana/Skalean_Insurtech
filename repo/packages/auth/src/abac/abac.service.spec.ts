/**
 * Tests AbacService + 4 policies -- Sprint 7 Tache 2.3.7.
 *
 * Couvre :
 *   - OwnResourcesPolicy : owner / assignee matching
 *   - TimeBasedPolicy : windows pay.refunds (30j) / parts.orders.cancel (24h) / tow.complete (7j)
 *   - StatusBasedPolicy : insure.policies.cancel actif / books.invoices.update draft / etc.
 *   - WorkflowStatePolicy : transitions repair_sinistre / parts_order / expert_designation
 *   - AbacService routing : applies() -> evaluate() -> lastDeny preservation
 *   - registerPolicy custom + getRegisteredPolicies
 */

import { describe, expect, it } from 'vitest';
import { AbacService } from './abac.service.js';
import { OwnResourcesPolicy } from './policies/own-resources.policy.js';
import { StatusBasedPolicy } from './policies/status-based.policy.js';
import { TimeBasedPolicy } from './policies/time-based.policy.js';
import { WorkflowStatePolicy } from './policies/workflow-state.policy.js';
import type { AbacContext, AbacPolicy } from './types.js';
import { AuthRole } from '../types/auth-roles.js';
import { Permission } from '../rbac/permissions.enum.js';

const baseCtx = (overrides: Partial<AbacContext> = {}): AbacContext => ({
  userId: '00000000-0000-0000-0000-000000000001',
  userRole: AuthRole.BrokerUser,
  ...overrides,
});

describe('OwnResourcesPolicy (Sprint 7 Tache 2.3.7)', () => {
  const policy = new OwnResourcesPolicy();

  it('1. applies to *_own permissions', () => {
    expect(policy.applies(Permission.CRM_CONTACTS_READ_OWN)).toBe(true);
    expect(policy.applies(Permission.REPAIR_SINISTRES_READ_ASSIGNED)).toBe(true);
  });

  it('2. does not apply to non-_own permissions', () => {
    expect(policy.applies(Permission.CRM_CONTACTS_CREATE)).toBe(false);
  });

  it('3. owner match : allowed=true', () => {
    const r = policy.evaluateForPermission(
      baseCtx({ resourceOwnerId: '00000000-0000-0000-0000-000000000001' }),
      Permission.CRM_CONTACTS_READ_OWN,
    );
    expect(r.allowed).toBe(true);
  });

  it('4. owner mismatch : OWNER_MISMATCH', () => {
    const r = policy.evaluateForPermission(
      baseCtx({ resourceOwnerId: '00000000-0000-0000-0000-000000000099' }),
      Permission.CRM_CONTACTS_READ_OWN,
    );
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('OWNER_MISMATCH');
  });

  it('5. assignee match : allowed=true', () => {
    const r = policy.evaluateForPermission(
      baseCtx({ resourceAssigneeId: '00000000-0000-0000-0000-000000000001' }),
      Permission.REPAIR_SINISTRES_READ_ASSIGNED,
    );
    expect(r.allowed).toBe(true);
  });

  it('6. assignee mismatch : NOT_ASSIGNED', () => {
    const r = policy.evaluateForPermission(
      baseCtx({ resourceAssigneeId: '00000000-0000-0000-0000-000000000099' }),
      Permission.REPAIR_SINISTRES_READ_ASSIGNED,
    );
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('NOT_ASSIGNED');
  });

  it('7. no resource owner : RESOURCE_NOT_FOUND', () => {
    const r = policy.evaluateForPermission(baseCtx(), Permission.CRM_CONTACTS_READ_OWN);
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('RESOURCE_NOT_FOUND');
  });
});

describe('TimeBasedPolicy (Sprint 7 Tache 2.3.7)', () => {
  const policy = new TimeBasedPolicy();

  it('8. applies to pay.refunds.create', () => {
    expect(policy.applies(Permission.PAY_REFUNDS_CREATE)).toBe(true);
  });

  it('9. applies to parts.orders.cancel_within_window (v3.0)', () => {
    expect(policy.applies(Permission.PARTS_ORDERS_CANCEL)).toBe(true);
  });

  it('10. applies to tow.missions.complete (v3.0)', () => {
    expect(policy.applies(Permission.TOW_MISSIONS_COMPLETE)).toBe(true);
  });

  it('11. does not apply to crm.contacts.read', () => {
    expect(policy.applies(Permission.CRM_CONTACTS_READ)).toBe(false);
  });

  it('12. within window : allowed=true (pay.refunds 15j elapsed < 30j)', () => {
    const createdAt = new Date('2026-05-08T00:00:00Z');
    const now = new Date('2026-05-23T00:00:00Z');
    const r = policy.evaluateForPermission(
      baseCtx({ resourceCreatedAt: createdAt, now }),
      Permission.PAY_REFUNDS_CREATE,
    );
    expect(r.allowed).toBe(true);
  });

  it('13. window expired : TIME_WINDOW_EXPIRED (45j > 30j)', () => {
    const createdAt = new Date('2026-04-01T00:00:00Z');
    const now = new Date('2026-05-23T00:00:00Z');
    const r = policy.evaluateForPermission(
      baseCtx({ resourceCreatedAt: createdAt, now }),
      Permission.PAY_REFUNDS_CREATE,
    );
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('TIME_WINDOW_EXPIRED');
  });

  it('14. parts order > 24h : TIME_WINDOW_EXPIRED', () => {
    const createdAt = new Date('2026-05-21T00:00:00Z');
    const now = new Date('2026-05-23T00:00:00Z');
    const r = policy.evaluateForPermission(
      baseCtx({ resourceCreatedAt: createdAt, now }),
      Permission.PARTS_ORDERS_CANCEL,
    );
    expect(r.allowed).toBe(false);
  });

  it('15. no created_at : RESOURCE_NOT_FOUND', () => {
    const r = policy.evaluateForPermission(baseCtx(), Permission.PAY_REFUNDS_CREATE);
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('RESOURCE_NOT_FOUND');
  });

  it('16. getWindowMs introspection', () => {
    expect(policy.getWindowMs(Permission.PAY_REFUNDS_CREATE)).toBe(30 * 24 * 60 * 60 * 1000);
    expect(policy.getWindowMs(Permission.CRM_CONTACTS_READ)).toBeUndefined();
  });
});

describe('StatusBasedPolicy (Sprint 7 Tache 2.3.7)', () => {
  const policy = new StatusBasedPolicy();

  it('17. applies to insure.policies.cancel', () => {
    expect(policy.applies(Permission.INSURE_POLICIES_CANCEL)).toBe(true);
  });

  it('18. applies to expertise.quote.validate (v3.0)', () => {
    expect(policy.applies(Permission.EXPERTISE_VALIDATE_QUOTE)).toBe(true);
  });

  it('19. allowed status : allowed=true (police active)', () => {
    const r = policy.evaluateForPermission(
      baseCtx({ resourceStatus: 'active' }),
      Permission.INSURE_POLICIES_CANCEL,
    );
    expect(r.allowed).toBe(true);
  });

  it('20. denied status : STATUS_DENIES_ACTION (police expired)', () => {
    const r = policy.evaluateForPermission(
      baseCtx({ resourceStatus: 'expired' }),
      Permission.INSURE_POLICIES_CANCEL,
    );
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('STATUS_DENIES_ACTION');
  });

  it('21. expertise validate accept status submitted', () => {
    const r = policy.evaluateForPermission(
      baseCtx({ resourceStatus: 'submitted' }),
      Permission.EXPERTISE_VALIDATE_QUOTE,
    );
    expect(r.allowed).toBe(true);
  });

  it('22. expertise validate reject status approved', () => {
    const r = policy.evaluateForPermission(
      baseCtx({ resourceStatus: 'approved' }),
      Permission.EXPERTISE_VALIDATE_QUOTE,
    );
    expect(r.allowed).toBe(false);
  });
});

describe('WorkflowStatePolicy (Sprint 7 Tache 2.3.7)', () => {
  const policy = new WorkflowStatePolicy();

  it('23. applies() returns false (routed explicit via evaluatePolicy)', () => {
    expect(policy.applies(Permission.REPAIR_SINISTRES_CLOSE)).toBe(false);
  });

  it('24. valid transition repair_sinistre : declared -> acknowledged', () => {
    const r = policy.evaluateForPermission(
      baseCtx({
        resourceType: 'repair_sinistre',
        resourceStatus: 'declared',
        resourceMetadata: { targetStatus: 'acknowledged' },
      }),
      Permission.REPAIR_SINISTRES_CLOSE,
    );
    expect(r.allowed).toBe(true);
  });

  it('25. invalid transition : WORKFLOW_TRANSITION_INVALID', () => {
    const r = policy.evaluateForPermission(
      baseCtx({
        resourceType: 'repair_sinistre',
        resourceStatus: 'declared',
        resourceMetadata: { targetStatus: 'closed' }, // direct skip
      }),
      Permission.REPAIR_SINISTRES_CLOSE,
    );
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('WORKFLOW_TRANSITION_INVALID');
  });

  it('26. parts_order workflow : pending -> placed OK', () => {
    const r = policy.evaluateForPermission(
      baseCtx({
        resourceType: 'parts_order',
        resourceStatus: 'pending',
        resourceMetadata: { targetStatus: 'placed' },
      }),
      Permission.PARTS_ORDERS_CREATE,
    );
    expect(r.allowed).toBe(true);
  });

  it('27. expert_designation workflow : designated -> accepted OK', () => {
    const r = policy.evaluateForPermission(
      baseCtx({
        resourceType: 'expert_designation',
        resourceStatus: 'designated',
        resourceMetadata: { targetStatus: 'accepted' },
      }),
      Permission.EXPERTISE_MISSIONS_ACCEPT,
    );
    expect(r.allowed).toBe(true);
  });

  it('28. tow_mission workflow : requested -> accepted OK', () => {
    const r = policy.evaluateForPermission(
      baseCtx({
        resourceType: 'tow_mission',
        resourceStatus: 'requested',
        resourceMetadata: { targetStatus: 'accepted' },
      }),
      Permission.TOW_MISSIONS_ACCEPT,
    );
    expect(r.allowed).toBe(true);
  });

  it('29. getValidTransitions introspection', () => {
    expect(policy.getValidTransitions('repair_sinistre', 'declared')).toContain('acknowledged');
    expect(policy.getValidTransitions('repair_sinistre', 'nonexistent')).toEqual([]);
  });
});

describe('AbacService routing (Sprint 7 Tache 2.3.7)', () => {
  it('30. registers 4 default policies', () => {
    const service = new AbacService();
    const names = service.getRegisteredPolicies();
    expect(names).toContain('OwnResourcesPolicy');
    expect(names).toContain('TimeBasedPolicy');
    expect(names).toContain('StatusBasedPolicy');
    expect(names).toContain('WorkflowStatePolicy');
  });

  it('31. evaluate routes to OwnResourcesPolicy for *_own', async () => {
    const service = new AbacService();
    const r = await service.evaluate(
      Permission.CRM_CONTACTS_READ_OWN,
      baseCtx({ resourceOwnerId: '00000000-0000-0000-0000-000000000001' }),
    );
    expect(r.allowed).toBe(true);
    expect(r.policy).toBe('OwnResourcesPolicy');
  });

  it('32. evaluate routes to TimeBasedPolicy for pay.refunds.create', async () => {
    const service = new AbacService();
    const createdAt = new Date('2026-05-08T00:00:00Z');
    const now = new Date('2026-05-23T00:00:00Z');
    const r = await service.evaluate(
      Permission.PAY_REFUNDS_CREATE,
      baseCtx({ resourceCreatedAt: createdAt, now }),
    );
    // both Time AND Status apply on PARTS_ORDERS_CANCEL etc, but PAY_REFUNDS only Time.
    expect(r.allowed).toBe(true);
    expect(r.policy).toBe('TimeBasedPolicy');
  });

  it('33. evaluate no policy applies : NO_POLICY_FOR_PERMISSION', async () => {
    const service = new AbacService();
    const r = await service.evaluate(Permission.CRM_CONTACTS_READ, baseCtx());
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('NO_POLICY_FOR_PERMISSION');
  });

  it('34. registerPolicy adds custom policy', () => {
    const service = new AbacService();
    const custom: AbacPolicy = {
      name: 'CustomTestPolicy',
      applies: () => false,
      evaluate: () => ({ allowed: true }),
    };
    service.registerPolicy(custom);
    expect(service.getRegisteredPolicies()).toContain('CustomTestPolicy');
  });

  it('35. evaluatePolicy targets a specific policy explicitement', async () => {
    const service = new AbacService();
    const r = await service.evaluatePolicy(
      'WorkflowStatePolicy',
      Permission.REPAIR_SINISTRES_CLOSE,
      baseCtx({
        resourceType: 'repair_sinistre',
        resourceStatus: 'declared',
        resourceMetadata: { targetStatus: 'acknowledged' },
      }),
    );
    expect(r.allowed).toBe(true);
  });
});
