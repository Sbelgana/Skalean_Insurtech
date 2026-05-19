import { describe, it, expect } from 'vitest';
import {
  KafkaJSConnectionError,
  KafkaJSRequestTimeoutError,
  KafkaJSNonRetriableError,
  KafkaJSProtocolError,
  KafkaJSBrokerNotFound,
} from 'kafkajs';
import { isRetriableKafkaError, computeBackoffMs } from '../../src/kafka-publisher/retry-classifier.js';

describe('isRetriableKafkaError', () => {
  it('KafkaJSConnectionError is retriable', () => {
    expect(isRetriableKafkaError(new KafkaJSConnectionError('conn', { broker: 'x:1' }))).toBe(true);
  });
  it('KafkaJSRequestTimeoutError is retriable', () => {
    expect(isRetriableKafkaError(new KafkaJSRequestTimeoutError('timeout'))).toBe(true);
  });
  it('KafkaJSBrokerNotFound is retriable', () => {
    expect(isRetriableKafkaError(new KafkaJSBrokerNotFound('no broker'))).toBe(true);
  });
  it('KafkaJSNonRetriableError is NOT retriable', () => {
    expect(isRetriableKafkaError(new KafkaJSNonRetriableError('fatal'))).toBe(false);
  });
  it('KafkaJSProtocolError MESSAGE_TOO_LARGE is NOT retriable', () => {
    const err = Object.assign(new KafkaJSProtocolError('too large'), { type: 'MESSAGE_TOO_LARGE' });
    expect(isRetriableKafkaError(err)).toBe(false);
  });
  it('KafkaJSProtocolError INVALID_TOPIC_EXCEPTION is NOT retriable', () => {
    const err = Object.assign(new KafkaJSProtocolError('invalid'), { type: 'INVALID_TOPIC_EXCEPTION' });
    expect(isRetriableKafkaError(err)).toBe(false);
  });
  it('ECONNRESET code is retriable', () => {
    const err = { code: 'ECONNRESET', message: 'reset' };
    expect(isRetriableKafkaError(err)).toBe(true);
  });
  it('ETIMEDOUT code is retriable', () => {
    expect(isRetriableKafkaError({ code: 'ETIMEDOUT', message: 'timeout' })).toBe(true);
  });
  it('plain Error is NOT retriable', () => {
    expect(isRetriableKafkaError(new Error('random'))).toBe(false);
  });
  it('null is NOT retriable', () => {
    expect(isRetriableKafkaError(null)).toBe(false);
  });
  it('undefined is NOT retriable', () => {
    expect(isRetriableKafkaError(undefined)).toBe(false);
  });
});

describe('computeBackoffMs', () => {
  it('no jitter: returns exact exponential', () => {
    expect(computeBackoffMs(0, 100, 2000, false)).toBe(100);
    expect(computeBackoffMs(1, 100, 2000, false)).toBe(200);
    expect(computeBackoffMs(2, 100, 2000, false)).toBe(400);
    expect(computeBackoffMs(10, 100, 2000, false)).toBe(2000);
  });
  it('jitter returns value within 85-130% of exponential', () => {
    const val = computeBackoffMs(0, 100, 2000, true);
    expect(val).toBeGreaterThanOrEqual(85);
    expect(val).toBeLessThanOrEqual(130);
  });
});
