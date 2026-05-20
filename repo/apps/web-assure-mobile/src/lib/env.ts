/**
 * Environment validation -- web-assure-mobile
 * Reference : task-1.4.7 Sprint 4 Phase 1
 *
 * Valide les variables d'environnement publiques avec Zod.
 * Throw au demarrage si une variable critique est invalide.
 */
import { z } from 'zod';

const envSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url().default('http://localhost:4000'),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3006'),
  NEXT_PUBLIC_CDN_URL: z.string().default(''),
  NEXT_PUBLIC_DEFAULT_LOCALE: z.enum(['fr', 'ar-MA', 'ar']).default('fr'),
  NEXT_PUBLIC_SENTRY_DSN: z.string().default(''),
  NEXT_PUBLIC_TENANT_ID_HEADER: z.string().default('x-tenant-id'),
  NEXT_PUBLIC_PWA_ENABLED: z.string().default('false'),
});

const parsed = envSchema.safeParse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_CDN_URL: process.env.NEXT_PUBLIC_CDN_URL,
  NEXT_PUBLIC_DEFAULT_LOCALE: process.env.NEXT_PUBLIC_DEFAULT_LOCALE,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  NEXT_PUBLIC_TENANT_ID_HEADER: process.env.NEXT_PUBLIC_TENANT_ID_HEADER,
  NEXT_PUBLIC_PWA_ENABLED: process.env.NEXT_PUBLIC_PWA_ENABLED,
});

if (!parsed.success) {
  throw new Error(`Invalid environment variables:\n${JSON.stringify(parsed.error.format(), null, 2)}`);
}

export const env = parsed.data;
