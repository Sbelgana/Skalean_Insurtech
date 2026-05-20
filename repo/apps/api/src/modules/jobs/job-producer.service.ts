/**
 * JobProducerService -- service global pour ajouter des jobs BullMQ.
 *
 * Cree et cache des instances Queue BullMQ a la demande (lazy par nom).
 * Chaque Queue se connecte au Redis DB 2 (JOBS_REDIS_DB).
 * Pas de jobs metier au Sprint 3 : les Sprints 9+ appellent this.jobs.add().
 *
 * Logs Pino : job.added, job.failed, queue.created, shutdown.close.
 *
 * Reference : decision-006 (no-emoji).
 * Tache : 1.3.11 (Sprint 3 / Phase 1).
 */
import {
  Injectable,
  Logger,
  type OnModuleDestroy,
} from '@nestjs/common';
import { Queue, type Job, type JobsOptions, type ConnectionOptions } from 'bullmq';

/**
 * Interface interne pour les operations Queue independamment des generics
 * conditionnels stricts de BullMQ 5.x (ExtractNameType / ExtractDataType).
 * Evite les casts `any` dans le code metier.
 */
interface RawQueue {
  add: (
    name: string,
    data: unknown,
    opts?: JobsOptions,
  ) => Promise<{ id?: string; name: string; data: unknown }>;
  getJobCounts: (...types: string[]) => Promise<Record<string, number>>;
  close: () => Promise<void>;
}
import { DEFAULT_JOB_OPTIONS, JOBS_REDIS_DB } from './jobs.constants';

/**
 * Construit les options de connexion Redis pour BullMQ
 * depuis la variable d'environnement REDIS_URL.
 * Isole la connexion sur DB 2 (queues).
 */
function buildJobsRedisOptions(): ConnectionOptions {
  const raw = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
  const url = new URL(raw);

  return {
    host: url.hostname,
    port: url.port ? parseInt(url.port, 10) : 6379,
    ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
    db: JOBS_REDIS_DB,
    maxRetriesPerRequest: 3,
    reconnectOnError: (err: Error): boolean => {
      const retryOn = ['READONLY', 'ETIMEDOUT', 'ECONNRESET'];
      return retryOn.some((e) => err.message.includes(e));
    },
  } as ConnectionOptions;
}

@Injectable()
export class JobProducerService implements OnModuleDestroy {
  private readonly logger = new Logger(JobProducerService.name);

  /** Queues actives, indexees par nom. */
  private readonly queues = new Map<string, RawQueue>();

  /** Options de connexion Redis (construites au boot). */
  private readonly connection: ConnectionOptions;

  constructor() {
    this.connection = buildJobsRedisOptions();
  }

  /**
   * Retourne la Queue existante ou en cree une nouvelle (lazy).
   */
  private getOrCreateQueue(queueName: string): RawQueue {
    const existing = this.queues.get(queueName);
    if (existing) return existing;

    const queue = new Queue(queueName, {
      connection: this.connection,
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    }) as unknown as RawQueue;

    this.queues.set(queueName, queue);
    this.logger.log({ queueName }, 'queue.created');
    return queue;
  }

  /**
   * Ajoute un job dans la queue specifiee.
   *
   * @param queueName - Nom de la queue (ex: 'whatsapp-send', 'pdf-generate')
   * @param jobName   - Nom du job (discriminant pour le worker)
   * @param data      - Payload du job (valide par le caller)
   * @param options   - Options BullMQ additionnelles (override DEFAULT_JOB_OPTIONS)
   * @returns Instance Job avec `id` attribue
   */
  async add<T = unknown>(
    queueName: string,
    jobName: string,
    data: T,
    options?: JobsOptions,
  ): Promise<Job<T, unknown, string>> {
    const queue = this.getOrCreateQueue(queueName);
    try {
      const raw = await queue.add(jobName, data, options);
      this.logger.log(
        { queueName, jobName, jobId: raw.id },
        'job.added',
      );
      // Cast au type public Job<T> apres avoir valide la structure via RawQueue.
      return raw as unknown as Job<T, unknown, string>;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        { queueName, jobName, error: msg },
        'job.failed_to_add',
      );
      throw error;
    }
  }

  /**
   * Retourne les compteurs de la queue (utile pour monitoring / BullDashboard).
   */
  async getJobCounts(
    queueName: string,
  ): Promise<Record<string, number>> {
    const queue = this.getOrCreateQueue(queueName);
    return queue.getJobCounts(
      'waiting',
      'active',
      'completed',
      'failed',
      'delayed',
      'paused',
    );
  }

  /**
   * Ferme proprement toutes les queues actives.
   * Appele automatiquement par NestJS sur SIGTERM/SIGINT via onModuleDestroy.
   */
  async onModuleDestroy(): Promise<void> {
    const names = [...this.queues.keys()];
    this.logger.log({ queues: names }, 'shutdown.close_start');

    await Promise.all(
      [...this.queues.values()].map((q) => q.close()),
    );

    this.queues.clear();
    this.logger.log({ count: names.length }, 'shutdown.close_done');
  }
}
