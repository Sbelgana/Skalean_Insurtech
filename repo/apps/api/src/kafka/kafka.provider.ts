/**
 * Provider factory pour kafkaProducer KafkaJS.
 *
 * Cree un producer KafkaJS connecte depuis KAFKA_BROKERS, KAFKA_CLIENT_ID.
 * Retry exponentiel : max 5 tentatives, backoff 200ms-6400ms.
 *
 * Reference : decision-004 (Kafka over RabbitMQ) + decision-006 (no-emoji).
 * Tache : 1.3.2 (Sprint 3 / Phase 1).
 */
import type { Provider } from '@nestjs/common';
import { Kafka, type Producer } from 'kafkajs';

export const KAFKA_PRODUCER_TOKEN = 'KAFKA_PRODUCER';

export const kafkaProducerProvider: Provider = {
  provide: KAFKA_PRODUCER_TOKEN,
  useFactory: async (): Promise<Producer> => {
    const brokers = (process.env['KAFKA_BROKERS'] ?? 'localhost:9092')
      .split(',')
      .map((b) => b.trim())
      .filter(Boolean);

    const clientId = process.env['KAFKA_CLIENT_ID'] ?? 'skalean-insurtech';

    const kafka = new Kafka({
      clientId,
      brokers,
      retry: {
        initialRetryTime: 200,
        retries: 5,
      },
    });

    const producer = kafka.producer({
      allowAutoTopicCreation: false,
    });

    // Connexion avec retry exponentiel backoff
    const maxRetries = 5;
    let attempt = 0;
    let lastError: unknown = null;

    while (attempt < maxRetries) {
      try {
        await producer.connect();
        return producer;
      } catch (err: unknown) {
        lastError = err;
        attempt++;
        await new Promise((r) => setTimeout(r, 200 * Math.pow(2, attempt)));
      }
    }

    throw new Error(
      `Kafka producer connect failed after ${maxRetries} retries: ${
        lastError instanceof Error ? lastError.message : String(lastError)
      }`,
    );
  },
};
