/**
 * Pino logger -- web-assure-mobile
 * Reference : task-1.4.7 Sprint 4 Phase 1
 *
 * Logger isomorphique : structured JSON cote serveur, transmit POST /api/v1/logs cote client.
 * PII redaction : password, token, cin, phone, email.
 * decision-006 : aucune emoji dans les logs.
 */
import pino from 'pino';

const isServer = typeof window === 'undefined';
const isDev = process.env.NODE_ENV !== 'production';

export const logger = pino({
  level: isDev ? 'debug' : 'info',
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    app: 'web-assure-mobile',
    env: process.env.NODE_ENV ?? 'development',
  },
  redact: {
    paths: [
      'password',
      'token',
      'access_token',
      'refresh_token',
      'cin',
      'phone',
      'email',
      '*.password',
      '*.token',
      '*.cin',
      '*.phone',
      '*.email',
    ],
    censor: '[REDACTED]',
  },
  ...(isServer
    ? {}
    : {
        browser: {
          transmit: {
            level: 'warn',
            send: (_level: string, logEvent: pino.LogEvent) => {
              if (typeof fetch === 'undefined') return;
              void fetch('/api/v1/logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(logEvent),
                keepalive: true,
              });
            },
          },
        },
      }),
});
