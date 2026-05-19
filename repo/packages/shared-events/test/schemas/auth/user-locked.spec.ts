import { describe, it, expect } from 'vitest';
import { UserLockedPayloadSchema } from '../../../src/schemas/auth/user-locked.schema.js';

describe('UserLockedPayloadSchema', () => {
  const valid = {
    user_id: '11111111-1111-4111-9111-111111111111',
    tenant_id: '22222222-2222-4222-9222-222222222222',
    reason: 'too_many_failed_attempts',
    failed_attempts_count: 5,
    locked_at: '2026-05-05T12:00:00.000Z',
    locked_until: '2026-05-05T13:00:00.000Z',
    locked_by_user_id: null,
    notes: null,
  };

  it('accepts valid payload', () => { expect(UserLockedPayloadSchema.safeParse(valid).success).toBe(true); });
  it('rejects negative failed_attempts_count', () => { expect(UserLockedPayloadSchema.safeParse({ ...valid, failed_attempts_count: -1 }).success).toBe(false); });
  it('rejects non-integer failed_attempts_count', () => { expect(UserLockedPayloadSchema.safeParse({ ...valid, failed_attempts_count: 1.5 }).success).toBe(false); });
  it('accepts null locked_until', () => { expect(UserLockedPayloadSchema.safeParse({ ...valid, locked_until: null }).success).toBe(true); });
  it('rejects unknown reason', () => { expect(UserLockedPayloadSchema.safeParse({ ...valid, reason: 'wrong_reason' }).success).toBe(false); });
});
