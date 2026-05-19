import {
  KafkaJSConnectionError,
  KafkaJSRequestTimeoutError,
  KafkaJSNonRetriableError,
  KafkaJSProtocolError,
  KafkaJSBrokerNotFound,
} from 'kafkajs';

const NON_RETRIABLE_PROTOCOL_CODES = new Set<string>([
  'MESSAGE_TOO_LARGE',
  'INVALID_TOPIC_EXCEPTION',
  'TOPIC_AUTHORIZATION_FAILED',
  'INVALID_REQUEST',
  'UNSUPPORTED_VERSION',
  'CLUSTER_AUTHORIZATION_FAILED',
  'INVALID_PRODUCER_EPOCH',
  'INVALID_TXN_STATE',
]);

export function isRetriableKafkaError(err: unknown): boolean {
  if (err instanceof KafkaJSConnectionError) return true;
  if (err instanceof KafkaJSRequestTimeoutError) return true;
  if (err instanceof KafkaJSBrokerNotFound) return true;
  if (err instanceof KafkaJSProtocolError) {
    const type = (err as KafkaJSProtocolError & { type?: string }).type;
    if (type !== undefined && NON_RETRIABLE_PROTOCOL_CODES.has(type)) return false;
    return true;
  }
  if (err instanceof KafkaJSNonRetriableError) return false;
  if (err !== null && typeof err === 'object' && 'code' in err) {
    const code = String((err as { code?: unknown }).code ?? '');
    if (code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'EPIPE') return true;
  }
  return false;
}

export function computeBackoffMs(
  attempt: number,
  initialMs: number,
  maxMs: number,
  jitter: boolean,
): number {
  const exp = Math.min(initialMs * 2 ** attempt, maxMs);
  if (!jitter) return exp;
  const rand = Math.random() * 0.3 * exp;
  return Math.floor(exp - 0.15 * exp + rand);
}
