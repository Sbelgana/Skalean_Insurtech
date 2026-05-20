/**
 * idb-helpers -- IndexedDB helpers via 'idb'
 * Reference: task-1.4.9 Sprint 4 Phase 1
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export interface QueuedOperation {
  id?: number | undefined;
  type: string;
  payload: unknown;
  createdAt: number;
  retries: number;
}

export interface DraftRecord {
  id: string;
  data: unknown;
  updatedAt: number;
}

export interface PhotoRecord {
  id: string;
  blob: Blob;
  createdAt: number;
}

export interface AppDbSchema extends DBSchema {
  operationQueue: {
    key: number;
    value: QueuedOperation;
    indexes: { 'by-createdAt': number };
  };
  drafts: {
    key: string;
    value: DraftRecord;
    indexes: { 'by-updatedAt': number };
  };
  photos: {
    key: string;
    value: PhotoRecord;
    indexes: { 'by-createdAt': number };
  };
}

const DB_NAME = 'insurtech-app';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<AppDbSchema>> | null = null;

/** Reset the cached db connection (for testing only). */
export function _resetDbForTesting(): void {
  dbPromise = null;
}

export function openAppDb(): Promise<IDBPDatabase<AppDbSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<AppDbSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('operationQueue')) {
          const qs = db.createObjectStore('operationQueue', {
            keyPath: 'id',
            autoIncrement: true,
          });
          qs.createIndex('by-createdAt', 'createdAt');
        }
        if (!db.objectStoreNames.contains('drafts')) {
          const ds = db.createObjectStore('drafts', { keyPath: 'id' });
          ds.createIndex('by-updatedAt', 'updatedAt');
        }
        if (!db.objectStoreNames.contains('photos')) {
          const ps = db.createObjectStore('photos', { keyPath: 'id' });
          ps.createIndex('by-createdAt', 'createdAt');
        }
      },
    });
  }
  return dbPromise;
}

export async function enqueueOperation(
  type: string,
  payload: unknown,
): Promise<number> {
  const db = await openAppDb();
  const op: QueuedOperation = { type, payload, createdAt: Date.now(), retries: 0 };
  return db.add('operationQueue', op);
}

export async function dequeueOperation(id: number): Promise<void> {
  const db = await openAppDb();
  await db.delete('operationQueue', id);
}

export async function listPendingOperations(): Promise<QueuedOperation[]> {
  const db = await openAppDb();
  return db.getAllFromIndex('operationQueue', 'by-createdAt');
}

export async function saveDraft(id: string, data: unknown): Promise<void> {
  const db = await openAppDb();
  await db.put('drafts', { id, data, updatedAt: Date.now() });
}

export async function loadDraft(id: string): Promise<DraftRecord | undefined> {
  const db = await openAppDb();
  return db.get('drafts', id);
}

export async function deleteDraft(id: string): Promise<void> {
  const db = await openAppDb();
  await db.delete('drafts', id);
}

export async function savePhoto(id: string, blob: Blob): Promise<void> {
  const db = await openAppDb();
  await db.put('photos', { id, blob, createdAt: Date.now() });
}

export async function loadPhoto(id: string): Promise<PhotoRecord | undefined> {
  const db = await openAppDb();
  return db.get('photos', id);
}

export async function deletePhoto(id: string): Promise<void> {
  const db = await openAppDb();
  await db.delete('photos', id);
}

export async function clearOldDrafts(cutoff: number): Promise<number> {
  const db = await openAppDb();
  const range = IDBKeyRange.upperBound(cutoff);
  let count = 0;
  let cursor = await db
    .transaction('drafts', 'readwrite')
    .store.index('by-updatedAt')
    .openCursor(range);
  while (cursor) {
    await cursor.delete();
    count += 1;
    cursor = await cursor.continue();
  }
  return count;
}
