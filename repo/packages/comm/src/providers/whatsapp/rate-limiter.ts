/**
 * @insurtech/comm/providers/whatsapp/rate-limiter
 *
 * Lightweight rate limiter Sprint 9 Tache 3.2.2.
 * Garanti minTime intervalle (12.5ms = 80/sec Meta hard limit).
 * Bottleneck remplace si scaling multi-pod necessaire Sprint 14+.
 */

export interface RateLimiterOptions {
  minTimeMs: number;
  maxQueueSize?: number;
}

export class SimpleRateLimiter {
  private lastRunAt = 0;
  private queue: Array<() => void> = [];
  private readonly minTimeMs: number;
  private readonly maxQueueSize: number;
  private running = false;

  constructor(options: RateLimiterOptions) {
    this.minTimeMs = options.minTimeMs;
    this.maxQueueSize = options.maxQueueSize ?? 1000;
  }

  async schedule<T>(fn: () => Promise<T>): Promise<T> {
    if (this.queue.length >= this.maxQueueSize) {
      throw new Error(`RATE_LIMITER_QUEUE_OVERFLOW: ${this.maxQueueSize}`);
    }

    return new Promise<T>((resolve, reject) => {
      const runner = (): void => {
        const now = Date.now();
        const elapsed = now - this.lastRunAt;
        const wait = Math.max(0, this.minTimeMs - elapsed);

        const tick = (): void => {
          this.lastRunAt = Date.now();
          fn().then(resolve, reject);
        };

        if (wait === 0) {
          tick();
        } else {
          setTimeout(tick, wait);
        }
      };
      this.queue.push(runner);
      this.drain();
    });
  }

  private drain(): void {
    if (this.running) return;
    this.running = true;
    setImmediate(() => {
      const next = this.queue.shift();
      this.running = false;
      if (next !== undefined) next();
    });
  }

  pendingCount(): number {
    return this.queue.length;
  }
}
