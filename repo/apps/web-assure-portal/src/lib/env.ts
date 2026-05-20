/**
 * Validation runtime des NEXT_PUBLIC_* via Zod
 * Reference : task-1.4.6 Sprint 4 Phase 1
 */
import { z } from 'zod';

const envSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url().default('http://localhost:4000'),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3005'),
  NEXT_PUBLIC_CDN_URL: z.string().url().optional().or(z.literal('')),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional().or(z.literal('')),
  NEXT_PUBLIC_GTM_ID: z.string().optional().or(z.literal('')),
  NEXT_PUBLIC_DEFAULT_LOCALE: z.enum(['fr', 'ar-MA', 'ar']).default('fr'),
  NEXT_PUBLIC_SUPPORTED_LOCALES: z.string().default('fr,ar-MA,ar'),
  NEXT_PUBLIC_TENANT_ID_HEADER: z.string().default('x-tenant-id'),
  NEXT_PUBLIC_TRACE_ID_HEADER: z.string().default('x-trace-id'),
  NEXT_PUBLIC_FEATURE_FLAGS_URL: z.string().url().optional().or(z.literal('')),
  NEXT_PUBLIC_AUTH_REFRESH_PATH: z.string().default('/api/v1/auth/refresh'),
  NEXT_PUBLIC_LIGHTHOUSE_PROFILE: z.enum(['desktop', 'mobile']).default('desktop'),
  NEXT_PUBLIC_PWA_ENABLED: z.enum(['true', 'false']).default('false'),
  NEXT_PUBLIC_DEBUG: z.enum(['true', 'false']).default('false'),
  NEXT_PUBLIC_AI_GATEWAY_URL: z.string().url().optional().or(z.literal('')),
});

const parsed = envSchema.safeParse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_CDN_URL: process.env.NEXT_PUBLIC_CDN_URL,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  NEXT_PUBLIC_GTM_ID: process.env.NEXT_PUBLIC_GTM_ID,
  NEXT_PUBLIC_DEFAULT_LOCALE: process.env.NEXT_PUBLIC_DEFAULT_LOCALE,
  NEXT_PUBLIC_SUPPORTED_LOCALES: process.env.NEXT_PUBLIC_SUPPORTED_LOCALES,
  NEXT_PUBLIC_TENANT_ID_HEADER: process.env.NEXT_PUBLIC_TENANT_ID_HEADER,
  NEXT_PUBLIC_TRACE_ID_HEADER: process.env.NEXT_PUBLIC_TRACE_ID_HEADER,
  NEXT_PUBLIC_FEATURE_FLAGS_URL: process.env.NEXT_PUBLIC_FEATURE_FLAGS_URL,
  NEXT_PUBLIC_AUTH_REFRESH_PATH: process.env.NEXT_PUBLIC_AUTH_REFRESH_PATH,
  NEXT_PUBLIC_LIGHTHOUSE_PROFILE: process.env.NEXT_PUBLIC_LIGHTHOUSE_PROFILE,
  NEXT_PUBLIC_PWA_ENABLED: process.env.NEXT_PUBLIC_PWA_ENABLED,
  NEXT_PUBLIC_DEBUG: process.env.NEXT_PUBLIC_DEBUG,
  NEXT_PUBLIC_AI_GATEWAY_URL: process.env.NEXT_PUBLIC_AI_GATEWAY_URL,
});

if (!parsed.success) {
  throw new Error(`[env] Invalid NEXT_PUBLIC_* variables: ${parsed.error.flatten().formErrors.join(', ')}`);
}

export const env = parsed.data;
