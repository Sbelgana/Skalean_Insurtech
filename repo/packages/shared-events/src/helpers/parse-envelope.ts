import type { EventEnvelope } from '../types/event-envelope.js';
import { validateEventEnvelope } from './validate-event.js';

export function parseEnvelopeFromKafka<T = unknown>(raw: Buffer | string | null): EventEnvelope<T> {
  if (raw === null) throw new Error('Kafka message value is null');
  const text = typeof raw === 'string' ? raw : raw.toString('utf-8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(`Invalid JSON in Kafka message: ${(err as Error).message}`);
  }
  const result = validateEventEnvelope<T>(parsed);
  if (!result.success) throw new Error(`Envelope validation failed: ${result.message}`);
  return result.data;
}
