// @insurtech/api-client -- runtime Zod schemas
// Sprint 4 placeholder. Sprint 5+ will populate this module with schemas auto-derived
// from the OpenAPI components.schemas via openapi-zod-client (or manually for critical DTOs).
// Use for: runtime validation of API responses (defense in depth), form validation reuse, mock data generation.

import { z } from 'zod';

/**
 * Health endpoint response schema (Sprint 3 minimal).
 * Sprint 5+ adds: AuthLoginResponseSchema, UserDtoSchema, etc.
 */
export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  timestamp: z.string().datetime(),
  version: z.string(),
  uptime: z.number().nonnegative(),
});

export const VersionResponseSchema = z.object({
  version: z.string(),
  commit: z.string(),
  env: z.enum(['development', 'staging', 'production']),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
export type VersionResponse = z.infer<typeof VersionResponseSchema>;

/**
 * Sprint 5+ TODO: auto-generation of Zod schemas from OpenAPI.
 * Leading approach: openapi-zod-client (Astahmer) which parses OpenAPI components.schemas
 * and emits Zod equivalents. Trade-offs documented in README.md "Sprint 5+ extensions".
 */
export const PLACEHOLDER_NOTICE = 'Sprint 5+ will populate runtime schemas. See README.md';
