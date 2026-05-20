/**
 * @insurtech/auth/constants/email-regex
 *
 * ASCII-only RFC 5321 simplified email regex to defeat IDN/homograph attacks.
 * Used by signup/signin/recovery schemas (Sprint 5 Tache 2.1.1 onwards).
 *
 * Cyrillic 'o' (U+043E) vs Latin 'o' (U+006F) is rejected by [a-zA-Z] class.
 * Reference: decision-014 (Email anti-homograph), Sprint 33 (pentest).
 */

export const EMAIL_REGEX: RegExp = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export const EMAIL_REGEX_DESCRIPTION =
  'ASCII RFC 5321 simplified: local-part [a-zA-Z0-9._%+-]+, domain [a-zA-Z0-9.-]+, TLD min 2 letters';
