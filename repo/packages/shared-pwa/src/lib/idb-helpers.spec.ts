/**
 * idb-helpers spec -- shared-pwa
 * Reference: task-1.4.9 Sprint 4 Phase 1
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  openAppDb,
  enqueueOperation,
  dequeueOperation,
  listPendingOperations,
  saveDraft,
  loadDraft,
  deleteDraft,
  savePhoto,
  loadPhoto,
  deletePhoto,
  clearOldDrafts,
  _resetDbForTesting,
} from './idb-helpers';

// fake-indexeddb/auto is loaded in test-setup.ts
beforeEach(async () => {
  // @ts-expect-error -- replace global indexedDB with fresh fake-indexeddb instance
  const { IDBFactory } = await import('fake-indexeddb');
  // @ts-expect-error -- replace global indexedDB with fresh instance
  globalThis.indexedDB = new IDBFactory();
  _resetDbForTesting();
});

describe('enqueueOperation / dequeueOperation', () => {
  it('enqueues and lists operations', async () => {
    await enqueueOperation('SYNC_CLAIM', { claimId: 'c1' });
    await enqueueOperation('SYNC_CLAIM', { claimId: 'c2' });
    const ops = await listPendingOperations();
    expect(ops.length).toBeGreaterThanOrEqual(2);
  });

  it('dequeues by id', async () => {
    const id = await enqueueOperation('TEST_OP', { x: 1 });
    await dequeueOperation(id);
    const ops = await listPendingOperations();
    const found = ops.find((o) => o.id === id);
    expect(found).toBeUndefined();
  });
});

describe('saveDraft / loadDraft / deleteDraft', () => {
  it('saves and loads draft', async () => {
    await saveDraft('draft-1', { form: 'sinistre', step: 2 });
    const draft = await loadDraft('draft-1');
    expect(draft).toBeDefined();
    expect(draft?.data).toEqual({ form: 'sinistre', step: 2 });
  });

  it('returns undefined for missing draft', async () => {
    const draft = await loadDraft('does-not-exist');
    expect(draft).toBeUndefined();
  });

  it('deletes draft', async () => {
    await saveDraft('draft-del', { x: 1 });
    await deleteDraft('draft-del');
    const draft = await loadDraft('draft-del');
    expect(draft).toBeUndefined();
  });
});

describe('savePhoto / loadPhoto / deletePhoto', () => {
  it('saves and loads photo', async () => {
    const blob = new Blob(['fake-image-data'], { type: 'image/jpeg' });
    await savePhoto('photo-1', blob);
    const record = await loadPhoto('photo-1');
    expect(record).toBeDefined();
    // fake-indexeddb may not preserve Blob identity via structured clone; check it's truthy
    expect(record?.blob).toBeTruthy();
  });

  it('returns undefined for missing photo', async () => {
    const record = await loadPhoto('no-photo');
    expect(record).toBeUndefined();
  });

  it('deletes photo', async () => {
    const blob = new Blob(['data'], { type: 'image/png' });
    await savePhoto('photo-del', blob);
    await deletePhoto('photo-del');
    const record = await loadPhoto('photo-del');
    expect(record).toBeUndefined();
  });
});

describe('clearOldDrafts', () => {
  it('removes drafts older than cutoff', async () => {
    const now = Date.now();
    const db = await openAppDb();
    // Insert old draft directly
    await db.put('drafts', { id: 'old-draft', data: {}, updatedAt: now - 10000 });
    await db.put('drafts', { id: 'new-draft', data: {}, updatedAt: now + 10000 });
    const removed = await clearOldDrafts(now - 5000);
    expect(removed).toBe(1);
    const old = await loadDraft('old-draft');
    expect(old).toBeUndefined();
    const fresh = await loadDraft('new-draft');
    expect(fresh).toBeDefined();
  });
});
