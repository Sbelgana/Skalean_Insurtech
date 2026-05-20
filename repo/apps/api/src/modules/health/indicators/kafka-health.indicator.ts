/**
 * KafkaHealthIndicator -- verifie l'etat connecte du producer Kafka.
 *
 * KafkaJS ne fournit pas de PING natif. L'indicateur ecoute les evenements
 * connect/disconnect du producer pour maintenir un state local.
 * Timeout configurable (default 1500ms).
 *
 * Reference : decision-006 (no-emoji).
 * Tache : 1.3.10 (Sprint 3 / Phase 1).
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  HealthCheckError,
  HealthIndicator,
  type HealthIndicatorResult,
} from '@nestjs/terminus';
import type { Producer } from 'kafkajs';
import { KAFKA_PRODUCER_TOKEN } from '../../../kafka/kafka.provider';

interface KafkaState {
  connected: boolean;
  lastError?: string;
}

/** Payload evenement REQUEST_TIMEOUT de kafkajs. */
interface KafkaRequestTimeoutPayload {
  payload?: { broker?: string };
}

@Injectable()
export class KafkaHealthIndicator extends HealthIndicator {
  private state: KafkaState = { connected: true };

  constructor(@Inject(KAFKA_PRODUCER_TOKEN) private readonly producer: Producer) {
    super();
    this.attachStateListeners();
  }

  /**
   * Verifie l'etat connecte du producer Kafka.
   * @param key - nom du service dans le resultat (ex: 'kafka')
   * @param timeoutMs - timeout en ms (default: 1500)
   */
  async isHealthy(key: string, timeoutMs: number): Promise<HealthIndicatorResult> {
    const start = Date.now();
    try {
      if (!this.state.connected) {
        throw new Error(this.state.lastError ?? 'Kafka producer disconnected');
      }

      const checkPromise = this.checkProducerActive();
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Kafka check timeout ${timeoutMs}ms`)),
          timeoutMs,
        ),
      );
      await Promise.race([checkPromise, timeoutPromise]);

      const duration = Date.now() - start;
      return this.getStatus(key, true, { duration_ms: duration });
    } catch (error) {
      const duration = Date.now() - start;
      const message = error instanceof Error ? error.message : String(error);
      throw new HealthCheckError(
        `Kafka health check failed`,
        this.getStatus(key, false, {
          duration_ms: duration,
          message: this.sanitizeMessage(message),
        }),
      );
    }
  }

  /**
   * Verification basique : producer present et non-disconnected.
   */
  private async checkProducerActive(): Promise<void> {
    if (!this.producer) throw new Error('Kafka producer not available');
    if (!this.state.connected) {
      throw new Error(this.state.lastError ?? 'Kafka producer disconnected');
    }
  }

  /**
   * Attache les listeners d'evenement Kafka pour tracker l'etat connecte.
   */
  private attachStateListeners(): void {
    if (!this.producer?.events) return;

    this.producer.on(this.producer.events.CONNECT, () => {
      this.state.connected = true;
      this.state.lastError = undefined;
    });

    this.producer.on(this.producer.events.DISCONNECT, () => {
      this.state.connected = false;
    });

    this.producer.on(this.producer.events.REQUEST_TIMEOUT, (event: unknown) => {
      this.state.connected = false;
      const payload = (event as KafkaRequestTimeoutPayload)?.payload;
      this.state.lastError = payload?.broker ?? 'Request timeout';
    });
  }

  /**
   * Sanitize le message d'erreur pour eviter le leak de credentials SASL.
   */
  private sanitizeMessage(msg: string): string {
    return msg.replace(/sasl_plain_username=[^\s,]+/gi, 'sasl_plain_username=[REDACTED]');
  }
}
