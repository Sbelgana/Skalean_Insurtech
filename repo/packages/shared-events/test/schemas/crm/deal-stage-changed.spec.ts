import { describe, it, expect } from 'vitest';
import { DealStageChangedPayloadSchema } from '../../../src/schemas/crm/deal-stage-changed.schema.js';

describe('DealStageChangedPayloadSchema', () => {
  const valid = {
    deal_id: '11111111-1111-4111-9111-111111111111',
    tenant_id: '22222222-2222-4222-9222-222222222222',
    from_stage: 'discovery',
    to_stage: 'proposal',
    amount_dirham: '15000.00',
    by_user_id: '33333333-3333-4333-9333-333333333333',
    changed_at: '2026-05-05T12:00:00.000Z',
    reason: null,
  };

  it('accepts valid payload', () => { expect(DealStageChangedPayloadSchema.safeParse(valid).success).toBe(true); });
  it('rejects amount_dirham as number', () => { expect(DealStageChangedPayloadSchema.safeParse({ ...valid, amount_dirham: 15000 }).success).toBe(false); });
  it('rejects amount_dirham too large', () => { expect(DealStageChangedPayloadSchema.safeParse({ ...valid, amount_dirham: '9999999999.99' }).success).toBe(false); });
  it('accepts amount_dirham 0', () => { expect(DealStageChangedPayloadSchema.safeParse({ ...valid, amount_dirham: '0.00' }).success).toBe(true); });
});
