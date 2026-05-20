/**
 * Polyfill crypto.randomUUID -- web-assure-mobile
 * Reference : task-1.4.7 Sprint 4 Phase 1
 *
 * Fournit un UUID v4 dans tous les environnements (Node 14+, navigateurs, jsdom).
 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback manuel (jsdom sans SubtleCrypto)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
