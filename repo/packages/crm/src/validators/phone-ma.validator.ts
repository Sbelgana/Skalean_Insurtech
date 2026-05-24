/**
 * Phone Maroc validator -- format E.164 mobile MA.
 *
 * Sprint 8 Tache 8.2 (CRM Contacts).
 *
 * Format reel mobile MA :
 *   - Prefixe : +212
 *   - Premier digit operateur : 5 (Inwi/Orange) | 6 (Maroc Telecom) | 7 (Orange/Wana, plans nouveaux)
 *   - Suivi de 8 chiffres
 *
 * Normalisation accepte plusieurs formats input :
 *   - "+212612345678"  -> "+212612345678" (canonique)
 *   - "0612345678"     -> "+212612345678" (national, drop leading 0)
 *   - "212612345678"   -> "+212612345678" (sans plus)
 *   - "+212 6 12 34 56 78" -> "+212612345678" (avec espaces/tirets/dots)
 *
 * Reference :
 *   - DB CHECK constraint : crm_contacts_phone_format ~ '^\+212[567]\d{8}$'
 *   - B-08 Tache 3.1.2
 */

/** Regex stricte E.164 mobile MA. */
export const PHONE_MA_REGEX = /^\+212[567]\d{8}$/;

export type PhoneMaValidationError =
  | 'INVALID_FORMAT'
  | 'INVALID_LENGTH'
  | 'INVALID_OPERATOR';

export interface PhoneMaValidationResult {
  valid: boolean;
  reason?: PhoneMaValidationError;
  /** Valeur normalisee canonique E.164. */
  normalized?: string;
}

/**
 * Normalise une chaine telephone vers E.164 MA si possible.
 *
 * Strip whitespace, tirets, points, parentheses. Convertit "0XXXXXXXXX" -> "+212XXXXXXXXX",
 * et "212XXXXXXXXX" sans plus -> "+212XXXXXXXXX". Ne valide pas le format final.
 */
export function normalizePhoneMa(input: string | null | undefined): string {
  if (input === null || input === undefined) return '';
  // Strip whitespace, dashes, dots, parentheses
  let cleaned = String(input).replace(/[\s\-.()]/g, '');
  if (cleaned.length === 0) return '';

  if (cleaned.startsWith('00212')) {
    cleaned = `+${cleaned.slice(2)}`;
  } else if (cleaned.startsWith('212')) {
    cleaned = `+${cleaned}`;
  } else if (cleaned.startsWith('0') && cleaned.length === 10) {
    cleaned = `+212${cleaned.slice(1)}`;
  }
  return cleaned;
}

/**
 * Valide un numero de mobile marocain.
 *
 * @param input Telephone brut (peut etre national/E.164/avec separateurs)
 * @returns resultat validation + raison + valeur normalisee si applicable
 */
export function validatePhoneMa(
  input: string | null | undefined,
): PhoneMaValidationResult {
  if (input === null || input === undefined) {
    return { valid: false, reason: 'INVALID_FORMAT' };
  }

  const normalized = normalizePhoneMa(input);
  if (normalized.length === 0) {
    return { valid: false, reason: 'INVALID_FORMAT' };
  }
  if (normalized.length !== 13) {
    return { valid: false, reason: 'INVALID_LENGTH', normalized };
  }
  if (!normalized.startsWith('+212')) {
    return { valid: false, reason: 'INVALID_FORMAT', normalized };
  }
  const operatorDigit = normalized.charAt(4);
  if (operatorDigit !== '5' && operatorDigit !== '6' && operatorDigit !== '7') {
    return { valid: false, reason: 'INVALID_OPERATOR', normalized };
  }
  if (!PHONE_MA_REGEX.test(normalized)) {
    return { valid: false, reason: 'INVALID_FORMAT', normalized };
  }
  return { valid: true, normalized };
}

/**
 * Helper Zod : refine pour valider phone MA dans schema.
 *
 * Accepte un input non normalise (le service normalise avant insert).
 */
export const phoneMaRefinement = (value: string): boolean => validatePhoneMa(value).valid;

export const PHONE_MA_VALIDATION_MESSAGE =
  'Telephone invalide. Format attendu : mobile Maroc +212 (5/6/7) suivi de 8 chiffres.';
