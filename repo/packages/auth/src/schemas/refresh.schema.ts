/**
 * @insurtech/auth/schemas/refresh
 *
 * Zod schema for /api/v1/auth/refresh endpoint (Sprint 5 Tache 2.1.6).
 * Refresh tokens are base64url-encoded JWT (long enough to survive HTTP/2 header limits but bounded).
 */

import { z } from 'zod';

export const refreshSchema = z
  .object({
    refresh_token: z
      .string({ required_error: 'refresh_token is required' })
      .min(40, 'refresh_token is too short')
      .max(2048, 'refresh_token is too long')
      .regex(/^[A-Za-z0-9._-]+$/, 'refresh_token must be base64url-encoded'),
  })
  .strict();

export type RefreshInput = z.infer<typeof refreshSchema>;

export function parseRefresh(input: unknown): RefreshInput {
  return refreshSchema.parse(input);
}
