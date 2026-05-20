/**
 * JobsModule -- constantes BullMQ : token DI + options par defaut.
 *
 * DB Redis : 2 (isolation : DB 0 = cache, DB 1 = sessions, DB 2 = queues)
 * Default options : 3 retries, backoff exponentiel 1s/5s/30s,
 *   removeOnComplete 30 jours, removeOnFail 90 jours.
 *
 * Reference : decision-006 (no-emoji).
 * Tache : 1.3.11 (Sprint 3 / Phase 1).
 */
import type { JobsOptions } from 'bullmq';

/** Token DI pour les options de connexion Redis queues. */
export const JOBS_REDIS_OPTIONS_TOKEN = 'JOBS_REDIS_OPTIONS';

/** Index Redis DB reserves aux queues BullMQ. */
export const JOBS_REDIS_DB = 2;

/** Backoff exponentiel : 1s, 5s, 30s (3 tentatives max). */
const BACKOFF_DELAYS_MS = [1000, 5000, 30000] as const;

/** Duree retention jobs completes (30 jours en secondes). */
const REMOVE_ON_COMPLETE_AGE_S = 30 * 24 * 60 * 60;

/** Duree retention jobs echoues (90 jours en secondes). */
const REMOVE_ON_FAIL_AGE_S = 90 * 24 * 60 * 60;

/**
 * Options par defaut applicables a tous les jobs BullMQ.
 * Surchargeables au niveau du job via le 3e argument de `queue.add()`.
 */
export const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: BACKOFF_DELAYS_MS.length,
  backoff: {
    type: 'exponential',
    delay: BACKOFF_DELAYS_MS[0],
  },
  removeOnComplete: { age: REMOVE_ON_COMPLETE_AGE_S },
  removeOnFail: { age: REMOVE_ON_FAIL_AGE_S },
};
