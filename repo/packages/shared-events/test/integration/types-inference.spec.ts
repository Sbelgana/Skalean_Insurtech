import { describe, it, expectTypeOf } from 'vitest';
import type { EventEnvelope } from '../../src/types/event-envelope.js';
import type { UserSignedInPayload } from '../../src/schemas/auth/user-signed-in.schema.js';
import type { ContactCreatedPayload } from '../../src/schemas/crm/contact-created.schema.js';

describe('types inference', () => {
  it('EventEnvelope generic carries payload type', () => {
    expectTypeOf<EventEnvelope<UserSignedInPayload>['payload']>().toEqualTypeOf<UserSignedInPayload>();
  });
  it('UserSignedInPayload has user_id string', () => {
    expectTypeOf<UserSignedInPayload['user_id']>().toEqualTypeOf<string>();
  });
  it('ContactCreatedPayload has nullable email', () => {
    expectTypeOf<ContactCreatedPayload['email']>().toEqualTypeOf<string | null>();
  });
  it('EventEnvelope has correlation_id nullable', () => {
    expectTypeOf<EventEnvelope['correlation_id']>().toEqualTypeOf<string | null>();
  });
});
