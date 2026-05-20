// Stub for @sentry/nextjs
// Used by vitest.config.ts alias -- real implementation loaded via optional dep in production.
export function captureException(
  _error: Error,
  _context?: { tags?: Record<string, string> },
): void {}
