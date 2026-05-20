/**
 * @insurtech/auth/data/banlist-loader
 *
 * Lazy loader for the banned-passwords list.
 * Reads JSON file once at first call and caches in a frozen ReadonlySet.
 * Uses fs.readFileSync (not import assertion) to keep ESM/CJS interop simple
 * and to avoid issues with `with { type: 'json' }` in older tooling.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

let CACHED: ReadonlySet<string> | null = null;

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));

export function loadBanlist(): ReadonlySet<string> {
  if (CACHED !== null) return CACHED;

  const jsonPath = resolve(MODULE_DIR, 'banned-passwords.json');
  const raw = readFileSync(jsonPath, 'utf-8');
  const parsed: unknown = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error('banlist-loader: banned-passwords.json must export an array');
  }
  if (parsed.length < 100) {
    throw new Error(
      `banlist-loader: banned-passwords.json must contain >= 100 entries (got ${parsed.length})`,
    );
  }

  const normalized = parsed
    .filter((p): p is string => typeof p === 'string')
    .map((p) => p.toLowerCase().trim())
    .filter((p) => p.length >= 4);

  CACHED = Object.freeze(new Set(normalized));
  return CACHED;
}

export function resetBanlistCache(): void {
  CACHED = null;
}
