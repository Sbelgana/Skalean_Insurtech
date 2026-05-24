/**
 * CIN (Carte d'Identite Nationale) validator -- Maroc.
 *
 * Sprint 8 Tache 8.2 (CRM Contacts).
 *
 * Format reel CIN MA :
 *   - 1 ou 2 lettres majuscules (prefixe region/serie)
 *   - 6 a 8 chiffres
 *
 * Exemples valides : "A123456", "BE789012", "X12345678", "AB1234567".
 *
 * Reference :
 *   - DB CHECK constraint : crm_contacts_cin_format ~ '^[A-Z]{1,2}[0-9]{6,8}$'
 *   - B-08 Tache 3.1.2
 */

/** Regex stricte : 1-2 lettres majuscules suivies de 6-8 chiffres. */
export const CIN_REGEX = /^[A-Z]{1,2}[0-9]{6,8}$/;

export type CinValidationError = 'INVALID_FORMAT' | 'INVALID_LENGTH';

export interface CinValidationResult {
  valid: boolean;
  reason?: CinValidationError;
  /** Valeur normalisee (uppercase + whitespace strip). */
  normalized?: string;
}

/**
 * Valide un CIN marocain.
 *
 * @param input CIN brut (peut contenir espaces, casse mixte -- normalise avant validation)
 * @returns resultat validation + raison si invalide
 */
export function validateCin(input: string | null | undefined): CinValidationResult {
  if (input === null || input === undefined) {
    return { valid: false, reason: 'INVALID_FORMAT' };
  }

  // Normaliser : strip whitespace + uppercase (CIN s'ecrit toujours en majuscules)
  const cleaned = String(input).replace(/\s+/g, '').toUpperCase();

  if (cleaned.length < 7 || cleaned.length > 10) {
    return { valid: false, reason: 'INVALID_LENGTH', normalized: cleaned };
  }

  if (!CIN_REGEX.test(cleaned)) {
    return { valid: false, reason: 'INVALID_FORMAT', normalized: cleaned };
  }

  return { valid: true, normalized: cleaned };
}

/**
 * Helper Zod : refine pour valider CIN dans schema.
 */
export const cinRefinement = (value: string): boolean => validateCin(value).valid;

export const CIN_VALIDATION_MESSAGE =
  'CIN invalide. Format attendu : 1-2 lettres majuscules suivies de 6-8 chiffres (ex : A123456, BE789012).';
