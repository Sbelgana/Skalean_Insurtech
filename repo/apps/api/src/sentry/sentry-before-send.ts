/**
 * Sentry beforeSend hook -- scrubber PII dernier recours.
 *
 * Meme si AllExceptionsFilter ne loggue pas les champs sensibles,
 * ce hook est une defense en profondeur cote Sentry SDK.
 * Masque : password, cin, token, email, phone dans event data/extra/tags.
 *
 * Reference : decision-006 (no-emoji) + CNDP loi 09-08 (no PII leak).
 * Tache : 1.3.12 (Sprint 3 / Phase 1).
 */
import type { ErrorEvent, EventHint } from '@sentry/nestjs';

/** Champs PII a masquer dans les payloads Sentry. */
const PII_FIELD_PATTERNS = [
  /^password$/i,
  /^cin$/i,
  /^token$/i,
  /^authorization$/i,
  /^x-api-key$/i,
  /^secret$/i,
  /^phone$/i,
  /^mobile$/i,
  /^email$/i,
  /^access_token$/i,
  /^refresh_token$/i,
  /^jwt$/i,
];

const REDACTED = '[REDACTED]';

/**
 * Masque les champs PII dans un objet plat ou imbrique.
 */
function scrubObject(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const isSensitive = PII_FIELD_PATTERNS.some((re) => re.test(key));
    if (isSensitive) {
      result[key] = REDACTED;
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = scrubObject(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * beforeSend callback inject dans Sentry.init().
 * Retourne null pour dropperrer l'event (ne rien envoyer).
 * Retourne l'event scrubbed pour l'envoyer.
 *
 * Signature conforme a @sentry/nestjs 8.x (ErrorEvent, EventHint).
 */
export function sentryBeforeSend(
  event: ErrorEvent,
  _hint: EventHint,
): ErrorEvent | null {
  // Scrub extra data
  if (event.extra && typeof event.extra === 'object') {
    event.extra = scrubObject(event.extra as Record<string, unknown>);
  }

  // Scrub tags
  if (event.tags && typeof event.tags === 'object') {
    const scrubbed = scrubObject(event.tags as Record<string, unknown>);
    event.tags = scrubbed as typeof event.tags;
  }

  // Scrub request data
  if (event.request) {
    if (event.request.headers && typeof event.request.headers === 'object') {
      event.request.headers = scrubObject(
        event.request.headers as Record<string, unknown>,
      ) as typeof event.request.headers;
    }
    if (event.request.data && typeof event.request.data === 'object') {
      event.request.data = scrubObject(event.request.data as Record<string, unknown>);
    }
  }

  return event;
}
