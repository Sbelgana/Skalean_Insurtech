/**
 * @insurtech/comm/helpers/phone-email.helper
 *
 * Helpers normalisation phone E.164 + email RFC 5322 simplifie.
 * Reference Sprint 2 Tache 1.2.5 piege-5 (4 formats utilisateur Maroc).
 */

const PHONE_E164_RE = /^\+\d{8,15}$/;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const MA_E164_RE = /^\+212[567]\d{8}$/;

/**
 * Extrait E.164 depuis un input utilisateur. Accepte les formats marocains usuels :
 *   - 0612345678          -> +212612345678
 *   - 06 12 34 56 78      -> +212612345678
 *   - +212 6 12 34 56 78  -> +212612345678
 *   - 00212612345678      -> +212612345678
 *   - +212-612-345-678    -> +212612345678
 * Retourne null si format incoherent.
 *
 * Idempotent : extractPhoneE164(extractPhoneE164(x)) === extractPhoneE164(x).
 */
export function extractPhoneE164(input: string, defaultCountry = '+212'): string | null {
  if (typeof input !== 'string') return null;
  let cleaned = input.replace(/[\s.\-()]/g, '').trim();
  if (cleaned.length === 0) return null;

  if (cleaned.startsWith('00')) {
    cleaned = '+' + cleaned.slice(2);
  }

  if (cleaned.startsWith('0') && /^0[5-7]\d{8}$/.test(cleaned)) {
    cleaned = defaultCountry + cleaned.slice(1);
  }

  if (!cleaned.startsWith('+')) {
    if (/^\d{8,15}$/.test(cleaned)) {
      cleaned = '+' + cleaned;
    } else {
      return null;
    }
  }

  return PHONE_E164_RE.test(cleaned) ? cleaned : null;
}

/**
 * Normalise un phone input ; throw InvalidPhoneError si invalide.
 */
export function normalizePhone(input: string, defaultCountry = '+212'): string {
  const result = extractPhoneE164(input, defaultCountry);
  if (result === null) {
    throw new Error(`PHONE_INVALID: ${input}`);
  }
  return result;
}

/**
 * Verifie qu'un E.164 deja normalise est marocain (prefixe +212 + 5/6/7).
 */
export function isMaroccanPhone(e164: string): boolean {
  return MA_E164_RE.test(e164);
}

/**
 * Strip le `+` initial pour serialiser vers Meta Cloud API v21.0
 * qui exige `212612345678` (sans `+`). Cf piege-1 Sprint 9 Tache 3.2.1.
 */
export function formatPhoneForMeta(e164: string): string {
  if (!PHONE_E164_RE.test(e164)) {
    throw new Error(`PHONE_NOT_E164_CANONICAL: ${e164}`);
  }
  return e164.slice(1);
}

/**
 * Validation email RFC 5322 simplifie (sans MX lookup).
 */
export function validateEmail(input: string): boolean {
  if (typeof input !== 'string') return false;
  if (input.length > 320) return false;
  return EMAIL_RE.test(input.trim());
}

/**
 * Normalise un email : lowercase + trim. NE PAS strip +alias (mauvais routage).
 * Idempotent : normalizeEmail(normalizeEmail(x)) === normalizeEmail(x).
 */
export function normalizeEmail(input: string): string {
  if (typeof input !== 'string') {
    throw new Error('EMAIL_NOT_STRING');
  }
  const lower = input.trim().toLowerCase();
  if (!validateEmail(lower)) {
    throw new Error(`EMAIL_INVALID: ${input}`);
  }
  return lower;
}
