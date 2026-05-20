/**
 * Pino-equivalent logger -- web-customer-portal
 * Reference : task-1.4.5 Sprint 4 Phase 1
 */
import pino from 'pino';

const isProd = process.env.NODE_ENV === 'production';
const level = process.env.NEXT_PUBLIC_DEBUG === 'true' ? 'debug' : isProd ? 'info' : 'debug';

export const logger = pino({
  level,
  browser: {
    asObject: true,
    transmit: {
      level: 'warn',
      send: (lvl, logEvent) => {
        if (typeof window === 'undefined') return;
        try {
          // eslint-disable-next-line no-restricted-globals
          navigator.sendBeacon?.('/api/v1/logs', JSON.stringify({ ...logEvent, level: lvl }));
        } catch {
          // silently drop
        }
      },
    },
  },
  base: { app: 'web-customer-portal', env: process.env.NODE_ENV ?? 'development' },
  timestamp: pino.stdTimeFunctions.isoTime,
});
