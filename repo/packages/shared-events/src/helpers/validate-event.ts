import { z } from 'zod';
import { type Topics, isKnownTopic } from '../topics.js';
import { topicSchemaMap } from '../schemas/index.js';
import { EventEnvelopeSchema, type EventEnvelope } from '../types/event-envelope.js';

export type ValidationSuccess<T> = {
  success: true;
  data: T;
};

export type ValidationFailure = {
  success: false;
  error: z.ZodError;
  message: string;
};

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

export function validateEventPayload<T = unknown>(
  topic: Topics,
  payload: unknown,
): ValidationResult<T> {
  const schema = topicSchemaMap[topic];
  if (!schema) {
    return {
      success: false,
      error: new z.ZodError([{ code: 'custom', path: ['topic'], message: `No schema registered for topic ${topic}` }]),
      message: `No schema registered for topic ${topic}`,
    };
  }
  const result = schema.safeParse(payload);
  if (result.success) {
    return { success: true, data: result.data as T };
  }
  return {
    success: false,
    error: result.error,
    message: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
  };
}

export function validateEventEnvelope<T = unknown>(
  raw: unknown,
): ValidationResult<EventEnvelope<T>> {
  const envelopeResult = EventEnvelopeSchema.safeParse(raw);
  if (!envelopeResult.success) {
    return {
      success: false,
      error: envelopeResult.error,
      message: 'Envelope structure invalid: ' + envelopeResult.error.issues.map((i) => i.message).join('; '),
    };
  }
  const envelope = envelopeResult.data;
  if (!isKnownTopic(envelope.event_name)) {
    return {
      success: false,
      error: new z.ZodError([{ code: 'custom', path: ['event_name'], message: `Unknown topic: ${envelope.event_name}` }]),
      message: `Unknown topic: ${envelope.event_name}`,
    };
  }
  const payloadValidation = validateEventPayload<T>(envelope.event_name, envelope.payload);
  if (!payloadValidation.success) return payloadValidation;
  return { success: true, data: { ...envelope, payload: payloadValidation.data } as EventEnvelope<T> };
}
