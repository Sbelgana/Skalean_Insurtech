/**
 * @insurtech/auth/services/argon2.helpers
 *
 * Pure functions used by Argon2Service. Exported for unit testing.
 */

import type { ARGON2_PARAMS } from '../constants/argon2-params.js';

export interface ParsedArgon2Hash {
  algorithm: string;
  version: number;
  memoryCost: number;
  timeCost: number;
  parallelism: number;
  saltB64: string;
  hashB64: string;
}

/**
 * Parses an Argon2id hash string into its components.
 * Format : `$argon2id$v=19$m=65536,t=3,p=4$<salt-b64>$<hash-b64>`
 * Returns null if the format is invalid (defensive against DB corruption).
 */
export function parseArgon2Hash(input: string): ParsedArgon2Hash | null {
  const match =
    /^\$(argon2id|argon2i|argon2d)\$v=(\d+)\$m=(\d+),t=(\d+),p=(\d+)\$([A-Za-z0-9+/=_-]+)\$([A-Za-z0-9+/=_-]+)$/.exec(
      input,
    );
  if (!match) return null;
  const algorithm = match[1] ?? '';
  const version = Number(match[2]);
  const memoryCost = Number(match[3]);
  const timeCost = Number(match[4]);
  const parallelism = Number(match[5]);
  const saltB64 = match[6] ?? '';
  const hashB64 = match[7] ?? '';
  return { algorithm, version, memoryCost, timeCost, parallelism, saltB64, hashB64 };
}

/**
 * Returns true if the parsed hash params meet or exceed the current ARGON2_PARAMS.
 * Used by Argon2Service.needsRehash to decide if a rehash is recommended.
 */
export function compareArgon2Params(
  parsed: ParsedArgon2Hash,
  current: typeof ARGON2_PARAMS,
): boolean {
  if (parsed.algorithm !== current.algorithm) return false;
  if (parsed.memoryCost < current.memoryCost) return false;
  if (parsed.timeCost < current.timeCost) return false;
  if (parsed.parallelism < current.parallelism) return false;
  return true;
}

/**
 * Computes the Levenshtein edit distance between two strings.
 * Quadratic time complexity O(m*n) -- acceptable for password length (max 128).
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const v0 = new Array<number>(b.length + 1);
  const v1 = new Array<number>(b.length + 1);

  for (let i = 0; i <= b.length; i += 1) v0[i] = i;

  for (let i = 0; i < a.length; i += 1) {
    v1[0] = i + 1;
    for (let j = 0; j < b.length; j += 1) {
      const cost = a[i] === b[j] ? 0 : 1;
      const delCost = (v0[j + 1] ?? 0) + 1;
      const insCost = (v1[j] ?? 0) + 1;
      const subCost = (v0[j] ?? 0) + cost;
      v1[j + 1] = Math.min(delCost, insCost, subCost);
    }
    for (let j = 0; j <= b.length; j += 1) v0[j] = v1[j] ?? 0;
  }

  return v0[b.length] ?? 0;
}

/**
 * Normalizes a password before banlist lookup : lowercase, trim.
 * The banlist is stored lowercased.
 */
export function normalizePasswordForBanlist(input: string): string {
  return input.toLowerCase().trim();
}
