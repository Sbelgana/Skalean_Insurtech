/**
 * Lighthouse CI config -- assertions strictes par app
 * Reference: task-1.4.16 Sprint 4 Phase 1
 *
 * Usage: pnpm lighthouse:ci  (via @lhci/cli)
 * Docs: https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/configuration.md
 */
module.exports = {
  ci: {
    collect: {
      url: [
        'http://localhost:3000/fr',
        'http://localhost:3001/fr',
        'http://localhost:3002/fr',
        'http://localhost:3003/fr',
        'http://localhost:3004/fr',
        'http://localhost:3005/fr',
        'http://localhost:3006/fr',
      ],
      numberOfRuns: 3,
      startServerCommand: 'pnpm dev:portals & pnpm dev:dashboards',
      startServerReadyPattern: 'Ready',
      startServerReadyTimeout: 120000,
      settings: {
        preset: 'desktop',
        chromeFlags: '--no-sandbox --disable-dev-shm-usage',
        skipAudits: ['uses-http2'],
      },
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.7, aggregationMethod: 'median' }],
        'categories:accessibility': ['error', { minScore: 0.9, aggregationMethod: 'median' }],
        'categories:best-practices': ['error', { minScore: 0.9, aggregationMethod: 'median' }],
        'categories:seo': ['error', { minScore: 0.9, aggregationMethod: 'median' }],
        'categories:pwa': ['warn', { minScore: 0.9 }],
        'first-contentful-paint': ['warn', { maxNumericValue: 2500 }],
        'largest-contentful-paint': ['warn', { maxNumericValue: 4000 }],
        'cumulative-layout-shift': ['warn', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['warn', { maxNumericValue: 300 }],
        'speed-index': ['warn', { maxNumericValue: 4000 }],
        'interactive': ['warn', { maxNumericValue: 5000 }],
        'no-vulnerable-libraries': 'error',
        'errors-in-console': 'warn',
        'is-on-https': 'off',
        'redirects-http': 'off',
        'unused-css-rules': 'warn',
        'unused-javascript': 'warn',
        'modern-image-formats': 'warn',
        'efficient-animated-content': 'warn',
        'uses-text-compression': 'warn',
        'uses-responsive-images': 'warn',
        'image-alt': 'error',
        'document-title': 'error',
        'html-has-lang': 'error',
        'html-lang-valid': 'error',
        'meta-description': 'warn',
        'meta-viewport': 'error',
        'tap-targets': 'warn',
        'color-contrast': 'error',
        'crawlable-anchors': 'error',
        'hreflang': 'warn',
        'canonical': 'warn',
        'robots-txt': 'warn',
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
    server: {},
  },
};
