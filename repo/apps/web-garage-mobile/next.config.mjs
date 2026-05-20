// apps/web-garage-mobile/next.config.mjs
// Next.js 15 + next-pwa 5.6.0 -- PWA technicien garage mobile (port 3003)
// Note: next-pwa 5.6.0 supporte Next.js 11-14 officiellement.
// Compatible Next.js 15 avec strict-peer-dependencies=false (verifie Sprint 4).
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
        cacheName: 'api-garage-cache',
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
