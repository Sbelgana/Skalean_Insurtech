/**
 * Zod schemas Search -- Sprint 8 Tache 8.6.
 *
 * Cross-CRM Full-Text Search via pg_trgm GIN indexes (heritage Tasks 8.1-8.5
 * + migration 019).
 *
 * Validates :
 *   - query length 2..200 (min : eviter full-scan trgm sur 1 char)
 *   - entityTypes : sous-ensemble configurable des 4 sources
 *   - limit : borne stricte par-entity (eviter dump massif)
 *   - similarityThreshold : tunable 0.1-1.0 (pg_trgm default 0.3)
 *
 * Reference : B-08 Tache 3.1.6.
 */

import { z } from 'zod';

export const SEARCH_ENTITY_TYPES = [
  'company',
  'contact',
  'deal',
  'interaction',
] as const;
export type SearchEntityType = (typeof SEARCH_ENTITY_TYPES)[number];

export const SearchEntityTypeSchema = z.enum(SEARCH_ENTITY_TYPES);

/**
 * Cross-CRM global search input. Returns grouped results per entity type
 * so the UI can render categorised sections.
 */
export const GlobalSearchSchema = z.object({
  q: z.string().min(2, 'query must be at least 2 chars').max(200),
  entityTypes: z
    .array(SearchEntityTypeSchema)
    .min(1)
    .max(4)
    .default([...SEARCH_ENTITY_TYPES]),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  similarityThreshold: z.coerce.number().min(0.1).max(1.0).default(0.3),
});

export type GlobalSearchDto = z.infer<typeof GlobalSearchSchema>;

/**
 * Per-entity search input (used by autocomplete pickers + dedicated search
 * pages).
 */
export const EntityScopedSearchSchema = z.object({
  q: z.string().min(2).max(200),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  similarityThreshold: z.coerce.number().min(0.1).max(1.0).default(0.3),
});

export type EntityScopedSearchDto = z.infer<typeof EntityScopedSearchSchema>;
