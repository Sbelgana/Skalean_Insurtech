import { z } from 'zod';

export const ULID_REGEX = /^[0-9A-HJKMNP-TV-Z]{26}$/;
export const EVENT_VERSION_REGEX = /^\d+\.\d+$/;

export const EventEnvelopeSchema = z.object({
  event_id: z.string().regex(ULID_REGEX, 'event_id must be 26-char ULID Crockford base32'),
  event_name: z.string().min(1).max(200),
  event_version: z.string().regex(EVENT_VERSION_REGEX, 'event_version must match major.minor format').default('1.0'),
  occurred_at: z.string().datetime({ offset: false, precision: 3 }),
  tenant_id: z.string().uuid().nullable(),
  user_id: z.string().uuid().nullable(),
  correlation_id: z.string().uuid().nullable(),
  payload: z.unknown(),
});

export type EventEnvelope<T = unknown> = Omit<z.infer<typeof EventEnvelopeSchema>, 'payload'> & {
  payload: T;
};

export function isEventEnvelope(value: unknown): value is EventEnvelope {
  return EventEnvelopeSchema.safeParse(value).success;
}

export function isEventEnvelopeOf<T>(
  value: unknown,
  payloadSchema: z.ZodType<T>,
): value is EventEnvelope<T> {
  const envelopeResult = EventEnvelopeSchema.safeParse(value);
  if (!envelopeResult.success) return false;
  return payloadSchema.safeParse(envelopeResult.data.payload).success;
}
