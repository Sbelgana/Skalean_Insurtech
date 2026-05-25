/**
 * @insurtech/comm/types/channel.enum
 *
 * Enum types canoniques pour Communications module Sprint 9.
 * Source-of-truth aligne avec Postgres enums comm_*_enum (Sprint 2 migration 1735000000004
 * + migration Sprint 9 1735000000026 qui ajoute `bounced` au status enum et `en` au language enum).
 *
 * Reference :
 *   - decision-006 (No-emoji)
 *   - decision-008 (Multilingue fr / ar-MA / ar / en)
 *   - Sprint 2 Tache 1.2.5 migration Communications
 *   - Sprint 9 Tache 3.2.1
 */

export const CHANNELS = ['whatsapp', 'email', 'sms', 'voice'] as const;
export type Channel = (typeof CHANNELS)[number];

export const DIRECTIONS = ['inbound', 'outbound'] as const;
export type Direction = (typeof DIRECTIONS)[number];

/**
 * MessageStatus etend Sprint 2 enum avec `bounced` (Sprint 9 Tache 3.2.10
 * delivery tracking : hard bounce auto opt-out CNDP).
 * Migration delta 1735000000026 ajoute la valeur SQL.
 */
export const MESSAGE_STATUSES = [
  'pending',
  'queued',
  'sent',
  'delivered',
  'read',
  'failed',
  'bounced',
] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

export const PROVIDERS = ['meta', 'twilio', 'sendgrid', 'mailgun'] as const;
export type Provider = (typeof PROVIDERS)[number];

/**
 * Locale supporte 4 valeurs : fr (francais general), ar-MA (darija marocain),
 * ar (arabe litteraire MSA), en (anglais international).
 * Note : Meta WhatsApp Templates ne supporte que `fr` et `ar` -- mapping ar-MA -> ar
 * applique a la couche provider (Sprint 9 Tache 3.2.2).
 */
export const LOCALES = ['fr', 'ar-MA', 'ar', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

/**
 * Mapping locale interne -> tag Meta WhatsApp accepte.
 * Meta Cloud API v21.0 supporte les BCP-47 generiques (fr, ar, en) mais pas ar-MA.
 */
export const META_LOCALE_MAP: Record<Locale, 'fr' | 'ar' | 'en'> = {
  fr: 'fr',
  'ar-MA': 'ar',
  ar: 'ar',
  en: 'en',
};
