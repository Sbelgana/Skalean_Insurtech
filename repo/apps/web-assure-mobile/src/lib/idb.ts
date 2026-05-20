/**
 * IndexedDB offline queue -- web-assure-mobile
 * Reference : task-1.4.7 Sprint 4 Phase 1
 *
 * File d'attente hors ligne pour les mutations API assure mobile.
 * Sprint 21+ implementera la synchronisation automatique.
 */
import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'skalean-assure-mobile';
const DB_VERSION = 1;
const STORE_OFFLINE_QUEUE = 'offline-queue';

export interface OfflineQueueItem {
  id?: number;
  url: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body: unknown;
  headers: Record<string, string>;
  createdAt: string;
  retryCount: number;
}

type AssureMobileDB = {
  [STORE_OFFLINE_QUEUE]: {
    key: number;
    value: OfflineQueueItem;
    indexes: { 'by-created': string };
  };
};

let dbPromise: Promise<IDBPDatabase<AssureMobileDB>> | null = null;

function getDb(): Promise<IDBPDatabase<AssureMobileDB>> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('IndexedDB not available in SSR'));
  }
  if (!dbPromise) {
    dbPromise = openDB<AssureMobileDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_OFFLINE_QUEUE)) {
          const store = db.createObjectStore(STORE_OFFLINE_QUEUE, {
            keyPath: 'id',
            autoIncrement: true,
          });
          store.createIndex('by-created', 'createdAt');
        }
      },
    });
  }
  return dbPromise;
}

export async function enqueueOfflineRequest(item: Omit<OfflineQueueItem, 'id'>): Promise<number> {
  const db = await getDb();
  return db.add(STORE_OFFLINE_QUEUE, item);
}

export async function getOfflineQueue(): Promise<OfflineQueueItem[]> {
  const db = await getDb();
  return db.getAll(STORE_OFFLINE_QUEUE);
}

export async function removeOfflineQueueItem(id: number): Promise<void> {
  const db = await getDb();
  await db.delete(STORE_OFFLINE_QUEUE, id);
}

export async function clearOfflineQueue(): Promise<void> {
  const db = await getDb();
  await db.clear(STORE_OFFLINE_QUEUE);
}

export async function getOfflineQueueCount(): Promise<number> {
  const db = await getDb();
  return db.count(STORE_OFFLINE_QUEUE);
}
