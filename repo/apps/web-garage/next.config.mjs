// @ts-check
/**
 * Next.js configuration -- web-garage
 * Reference : task-1.4.1 Sprint 4 Phase 1
 *
 * Decisions strategiques :
 *   - decision-006 : aucune emoji dans aucune ressource servie
 *   - decision-008 : Atlas Cloud Benguerir uniquement (s3.bgr.atlascloudservices.ma), JAMAIS AWS
 *   - decision-009 : multilinguisme fr / ar-MA (Darija) / ar (classique RTL)
 *
 * Securite :
 *   - HSTS 1 an avec preload
 *   - CSP strict (img-src restricted)
 *   - X-Frame-Options DENY (pas d'iframe legitime sur web-garage)
 *   - Referrer-Policy strict-origin-when-cross-origin
 */
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const isProd = process.env.NODE_ENV === 'production';
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const cdnUrl = process.env.NEXT_PUBLIC_CDN_URL ?? '';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  compress: true,

  experimental: {
    serverActions: { bodySizeLimit: '10mb' },
    optimizePackageImports: ['lucide-react', '@insurtech/shared-ui'],
    typedRoutes: true,
  },

  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60,
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost', port: '9000', pathname: '/**' },
      { protocol: 'https', hostname: 's3.bgr.atlascloudservices.ma', pathname: '/**' },
      { protocol: 'https', hostname: 'cdn.skalean-insurtech.ma', pathname: '/**' },
      { protocol: 'https', hostname: 'api.skalean-insurtech.ma', pathname: '/**' },
      { protocol: 'https', hostname: 'api.mapbox.com', pathname: '/**' },
      { protocol: 'https', hostname: 'a.tiles.mapbox.com', pathname: '/**' },
      { protocol: 'https', hostname: 'b.tiles.mapbox.com', pathname: '/**' },
    ],
  },

  async rewrites() {
    return [
      { source: '/api/v1/:path*', destination: `${apiUrl}/api/v1/:path*` },
    ];
  },

  async headers() {
    const csp = [
      "default-src 'self'",
      `connect-src 'self' ${apiUrl} https://api.skalean-insurtech.ma https://*.sentry.io https://api.mapbox.com`,
      `img-src 'self' data: blob: ${cdnUrl} https://s3.bgr.atlascloudservices.ma https://api.mapbox.com`,
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self' data: https://fonts.gstatic.com",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ');

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
          ...(isProd ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' }] : []),
        ],
      },
    ];
  },

  eslint: { ignoreDuringBuilds: false, dirs: ['src'] },
  typescript: { ignoreBuildErrors: false },

  output: 'standalone',
};

export default withNextIntl(nextConfig);
