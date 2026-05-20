declare namespace NodeJS {
  interface ProcessEnv {
    readonly NEXT_PUBLIC_API_URL: string;
    readonly NEXT_PUBLIC_APP_URL: string;
    readonly NEXT_PUBLIC_CDN_URL?: string;
    readonly NEXT_PUBLIC_SENTRY_DSN?: string;
    readonly NEXT_PUBLIC_MAPBOX_TOKEN?: string;
    readonly NEXT_PUBLIC_GTM_ID?: string;
    readonly NEXT_PUBLIC_DEFAULT_LOCALE: 'fr' | 'ar-MA' | 'ar';
    readonly NEXT_PUBLIC_SUPPORTED_LOCALES: string;
    readonly NEXT_PUBLIC_TENANT_ID_HEADER: string;
    readonly NEXT_PUBLIC_TRACE_ID_HEADER: string;
    readonly NEXT_PUBLIC_FEATURE_FLAGS_URL?: string;
    readonly NEXT_PUBLIC_AUTH_REFRESH_PATH: string;
    readonly NEXT_PUBLIC_LIGHTHOUSE_PROFILE: 'desktop' | 'mobile';
    readonly NEXT_PUBLIC_PWA_ENABLED: 'true' | 'false';
    readonly NEXT_PUBLIC_DEBUG: 'true' | 'false';
    readonly NEXT_PUBLIC_AI_GATEWAY_URL?: string;
  }
}
