import { z } from 'zod';

export const SigninMethodSchema = z.enum([
  'password', 'magic_link', 'sso_google', 'sso_microsoft', 'mfa_totp', 'mfa_sms', 'api_key',
]);

export const UserSignedInPayloadSchema = z.object({
  user_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  signin_method: SigninMethodSchema,
  ip_address: z.string().ip({ version: 'v4' }).or(z.string().ip({ version: 'v6' })),
  user_agent: z.string().min(1).max(1024),
  signed_in_at: z.string().datetime(),
  session_id: z.string().uuid(),
  device_fingerprint: z.string().max(256).nullable(),
  geo_country: z.string().length(2).nullable(),
  geo_city: z.string().max(100).nullable(),
});

export type UserSignedInPayload = z.infer<typeof UserSignedInPayloadSchema>;
