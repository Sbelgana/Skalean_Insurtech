/**
 * Process.env type augmentation -- web-assure-mobile
 * Reference : task-1.4.7 Sprint 4 Phase 1
 */
declare namespace NodeJS {
  interface ProcessEnv {
    readonly NEXT_PUBLIC_API_URL?: string;
    readonly NEXT_PUBLIC_APP_URL?: string;
    readonly NEXT_PUBLIC_CDN_URL?: string;
    readonly NEXT_PUBLIC_DEFAULT_LOCALE?: string;
    readonly NEXT_PUBLIC_SENTRY_DSN?: string;
    readonly NEXT_PUBLIC_TENANT_ID_HEADER?: string;
    readonly NEXT_PUBLIC_PWA_ENABLED?: string;
    readonly NODE_ENV: 'development' | 'production' | 'test';
  }
}
