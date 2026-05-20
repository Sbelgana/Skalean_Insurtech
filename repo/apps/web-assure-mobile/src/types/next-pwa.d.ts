// next-pwa type declarations -- web-assure-mobile
// Reference : task-1.4.7 Sprint 4 Phase 1
// next-pwa 5.6.0 does not ship its own TypeScript declarations.
declare module 'next-pwa' {
  import type { NextConfig } from 'next';

  interface RuntimeCachingEntry {
    urlPattern: RegExp | string;
    handler: 'NetworkFirst' | 'NetworkOnly' | 'CacheFirst' | 'CacheOnly' | 'StaleWhileRevalidate';
    options?: {
      cacheName?: string;
      networkTimeoutSeconds?: number;
      expiration?: { maxEntries?: number; maxAgeSeconds?: number };
      cacheableResponse?: { statuses: number[] };
    };
  }

  interface PWAConfig {
    dest: string;
    register?: boolean;
    skipWaiting?: boolean;
    disable?: boolean;
    scope?: string;
    sw?: string;
    fallbacks?: Record<string, string>;
    buildExcludes?: RegExp[];
    runtimeCaching?: RuntimeCachingEntry[];
    cacheOnFrontEndNav?: boolean;
    reloadOnOnline?: boolean;
  }

  function withPWAInit(config: PWAConfig): (nextConfig: NextConfig) => NextConfig;
  export default withPWAInit;
}
