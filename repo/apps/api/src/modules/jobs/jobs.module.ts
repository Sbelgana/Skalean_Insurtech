/**
 * JobsModule -- module global BullMQ (Redis-backed jobs queue).
 *
 * Setup BullModule.forRoot sur Redis DB 2 (JOBS_REDIS_DB).
 * Sprint 3 : integration stub (aucun job metier, juste l'infrastructure).
 * Sprint 9+ : enregistre les queues metier via BullModule.registerQueue().
 *
 * Default job options : 3 retries, backoff exponentiel 1s/5s/30s,
 *   removeOnComplete 30 jours, removeOnFail 90 jours.
 *
 * BullBoard UI : /admin/queues (auth Sprint 5+ -- public au Sprint 3).
 *
 * Reference : decision-006 (no-emoji).
 * Tache : 1.3.11 (Sprint 3 / Phase 1).
 */
import { Global, Logger, Module, type OnModuleInit } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { FastifyAdapter as BullBoardFastifyAdapter } from '@bull-board/fastify';
import type { ConnectionOptions } from 'bullmq';
import { JobProducerService } from './job-producer.service';
import { DEFAULT_JOB_OPTIONS, JOBS_REDIS_DB } from './jobs.constants';

/** Singleton serverAdapter expose a getExpressEntrypoint() ou setBasePath(). */
export const bullBoardAdapter = new BullBoardFastifyAdapter();

/**
 * Construit les options de connexion Redis pour BullModule.forRoot().
 * Isole les queues sur DB 2 (JOBS_REDIS_DB).
 */
function buildBullRootConnection(): ConnectionOptions {
  const raw = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
  const url = new URL(raw);

  return {
    host: url.hostname,
    port: url.port ? parseInt(url.port, 10) : 6379,
    ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
    db: JOBS_REDIS_DB,
    maxRetriesPerRequest: 3,
  } as ConnectionOptions;
}

@Global()
@Module({
  imports: [
    BullModule.forRoot({
      connection: buildBullRootConnection(),
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    }),
  ],
  providers: [JobProducerService],
  exports: [JobProducerService],
})
export class JobsModule implements OnModuleInit {
  private readonly logger = new Logger(JobsModule.name);

  onModuleInit(): void {
    // Configure BullBoard avec la liste des queues enregistrees.
    // Au Sprint 3, la liste est vide -- Sprint 9+ ajoutera les queues.
    bullBoardAdapter.setBasePath('/admin/queues');
    createBullBoard({
      queues: [] as InstanceType<typeof BullMQAdapter>[],
      serverAdapter: bullBoardAdapter,
    });

    this.logger.log('[JobsModule] BullMQ ready (Redis DB 2). BullBoard sur /admin/queues.');
  }
}
