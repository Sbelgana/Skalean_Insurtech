/**
 * Validation Zod du header x-tenant-id.
 *
 * Verifications :
 *   - format UUID v4/v5 (pas v1 timestamp-based pour eviter info leak)
 *   - rejette nil UUID 00000000-...-0
 *
 * Reference : Sprint 6 / Tache 2.2.2.
 */

import { z } from 'zod';

const NIL_UUID = '00000000-0000-0000-0000-000000000000';

export const TenantIdHeaderSchema = z
  .string()
  .min(36, 'tenant id must be 36 chars UUID')
  .max(36, 'tenant id must be 36 chars UUID')
  .uuid('tenant id must be valid UUID')
  .refine((v) => v !== NIL_UUID, {
    message: 'nil UUID is not accepted as tenant id',
  })
  .refine(
    (v) => {
      const version = v[14];
      return version === '4' || version === '5';
    },
    { message: 'tenant id must be UUID v4 or v5 (timestamp-based v1 rejected)' },
  );

export type TenantIdHeader = z.infer<typeof TenantIdHeaderSchema>;
