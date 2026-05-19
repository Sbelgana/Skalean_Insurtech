/**
 * Lightweight circuit breaker for Kafka publish operations.
 * Replaces opossum to avoid Node engine version constraints.
 * States: closed -> open (on threshold) -> half-open (after resetMs) -> closed (on success).
 * Aucune emoji (decision-006).
 */
import type { Logger as PinoLogger } from 'pino';

export type CircuitBreakerState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerFactoryOptions {
  threshold: number;
  resetMs: number;
  halfOpenAfterMs: number;
  timeoutMs: number;
  logger: PinoLogger;
  topic: string;
  onStateChange?: (state: CircuitBreakerState) => void;
}

export class KafkaCircuitBreaker {
  private state: CircuitBreakerState = 'closed';
  private failureCount = 0;
  private openedAt = 0;

  constructor(
    private readonly options: CircuitBreakerFactoryOptions,
    private readonly defaultAction?: () => Promise<unknown>,
  ) {}

  get currentState(): CircuitBreakerState {
    return this.state;
  }

  async fire(fn?: () => Promise<unknown>): Promise<unknown> {
    const action = fn ?? this.defaultAction;
    if (action === undefined) {
      throw new Error('KafkaCircuitBreaker.fire() requires a function argument');
    }

    if (this.state === 'open') {
      const elapsed = Date.now() - this.openedAt;
      if (elapsed >= this.options.resetMs) {
        this.transitionTo('half-open');
      } else {
        this.options.logger.warn(
          { topic: this.options.topic },
          'Kafka publish rejected by circuit breaker (open)',
        );
        const err = new Error('Breaker is open');
        (err as Error & { code: string }).code = 'EOPENBREAKER';
        throw err;
      }
    }

    try {
      const result = await this.withTimeout(action, this.options.timeoutMs);
      if (this.state === 'half-open') {
        this.transitionTo('closed');
        this.failureCount = 0;
      }
      return result;
    } catch (err) {
      this.failureCount++;
      if (this.state === 'half-open' || this.failureCount >= this.options.threshold) {
        this.transitionTo('open');
        this.openedAt = Date.now();
      }
      throw err;
    }
  }

  private transitionTo(next: CircuitBreakerState): void {
    if (this.state === next) return;
    this.state = next;
    switch (next) {
      case 'open':
        this.options.logger.warn(
          { topic: this.options.topic, resetMs: this.options.resetMs, breaker_state: 'open' },
          'Kafka publish circuit breaker opened',
        );
        break;
      case 'half-open':
        this.options.logger.info(
          { topic: this.options.topic, breaker_state: 'half-open' },
          'Kafka publish circuit breaker half-open',
        );
        break;
      case 'closed':
        this.options.logger.info(
          { topic: this.options.topic, breaker_state: 'closed' },
          'Kafka publish circuit breaker closed',
        );
        break;
    }
    this.options.onStateChange?.(next);
  }

  private withTimeout(fn: () => Promise<unknown>, ms: number): Promise<unknown> {
    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.options.logger.warn(
          { topic: this.options.topic, timeoutMs: ms },
          'Kafka publish timed out within circuit breaker',
        );
        reject(new Error(`Circuit breaker timeout after ${ms}ms`));
      }, ms);
      fn().then(
        (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        (e: unknown) => {
          clearTimeout(timer);
          reject(e);
        },
      );
    });
  }
}

export function createKafkaCircuitBreaker(
  asyncAction: () => Promise<unknown>,
  options: CircuitBreakerFactoryOptions,
): KafkaCircuitBreaker {
  return new KafkaCircuitBreaker(options, asyncAction);
}
