// @ts-check
/**
 * Next.js configuration -- web-assure-mobile
 * Reference : task-1.4.7 Sprint 4 Phase 1
 *
 * Decisions strategiques :
 *   - decision-006 : aucune emoji dans aucune ressource servie
 *   - decision-008 : Atlas Cloud Benguerir uniquement
 *   - decision-009 : multilinguisme fr / ar-MA (Darija) / ar (classique RTL)
 *
 * PWA : next-pwa 5.6.0 avec runtimeCaching assure mobile.
 * Pas de output: 'standalone' (PWA necessite manifest + SW dans public/).
 */
import withPWAInit from 'next-pwa';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const withPWA = withPWAInit({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV !== 'production',
  scope: '/',
  sw: 'sw.js',
  fallbacks: { document: '/offline' },
  buildExcludes: [/middleware-manifest\.json$/, /_buildManifest\.js$/],
  runtimeCaching: [
    {
      urlPattern: /\/api\/v1\/auth\/.*/,
      handler: 'NetworkOnly',
      options: { cacheName: 'auth-no-cache' },
    },
    {
      urlPattern: /^https?:\/\/(api\.skalean-insurtech\.ma|localhost:4000)\/api\/v1\/.*/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api-assure-mobile-cache',
        networkTimeoutSeconds: 5,
        expiration: { maxEntries: 200, maxAgeSeconds: 86400 },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
    {
      urlPattern: /\.(png|jpg|jpeg|svg|gif|ico|webp|avif)$/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'images-cache',
        expiration: { maxEntries: 100, maxAgeSeconds: 2592000 },
      },
    },
    {
      urlPattern: /\.(css|js|woff2|woff|ttf|eot)$/,
      handler: 'StaleWhileRevalidate',
      options: { cacheName: 'static-assets-cache' },
    },
  ],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  experimental: {
    optimizePackageImports: ['lucide-react', '@insurtech/shared-ui'],
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost', port: '9000', pathname: '/skalean-insurtech/**' },
      { protocol: 'https', hostname: 's3.bgr.atlascloudservices.ma', pathname: '/skalean-insurtech/**' },
      { protocol: 'https', hostname: 'cdn.skalean-insurtech.ma' },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), geolocation=(self), microphone=()' },
        ],
      },
    ];
  },
};

export default withNextIntl(withPWA(nextConfig));
