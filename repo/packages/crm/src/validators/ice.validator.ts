/**
 * ICE (Identifiant Commun de l'Entreprise) validator -- Maroc.
 *
 * Sprint 8 Tache 8.1 (CRM Companies).
 *
 * Format : 15 chiffres exactement.
 * Structure :
 *   - 7 chiffres : identification entreprise (sequentiel DGI)
 *   - 4 chiffres : code etablissement (00001 = siege)
 *   - 2 chiffres : code TVA (000 sans TVA)
 *   - 2 derniers chiffres : cle de controle (modulo 97 sur 13 premiers)
 *
 * Algorithme cle controle officiel DGI MA :
 *   - Prendre les 13 premiers chiffres comme entier N
 *   - Cle = N modulo 97
 *   - Comparaison directe avec les 2 derniers chiffres
 *
 * Reference :
 *   - https://www.tax.gov.ma/wps/portal/DGI/Conventions/Identifiant-Commun-Entreprise
 *   - B-08 Tache 3.1.1.
 */

/** Regex stricte : exactement 15 chiffres. */
export const ICE_REGEX = /^\d{15}$/;

export type IceValidationError =
  | 'INVALID_FORMAT'
  | 'INVALID_LENGTH'
  | 'INVALID_CHECKSUM';

export interface IceValidationResult {
  valid: boolean;
  reason?: IceValidationError;
  /** Echo de la valeur validee (nettoyee whitespace). */
  normalized?: string;
}

/**
 * Valide un ICE marocain.
 *
 * @param input ICE brut (peut contenir espaces/tirets/etc. -- nettoyes avant)
 * @returns resultat validation + raison si invalide
 */
export function validateIce(input: string | null | undefined): IceValidationResult {
  if (input === null || input === undefined) {
    return { valid: false, reason: 'INVALID_FORMAT' };
  }

  // Nettoyer espaces + tirets (format affichage possible : "123456789012345" ou "12345 67890 12345")
  const cleaned = String(input).replace(/[\s-]/g, '');

  if (cleaned.length !== 15) {
    return { valid: false, reason: 'INVALID_LENGTH', normalized: cleaned };
  }

  if (!ICE_REGEX.test(cleaned)) {
    return { valid: false, reason: 'INVALID_FORMAT', normalized: cleaned };
  }

  // Cle de controle : 13 premiers chiffres modulo 97 == 2 derniers chiffres
  const first13 = cleaned.slice(0, 13);
  const provided = parseInt(cleaned.slice(13, 15), 10);

  // Utilisation BigInt pour eviter overflow JavaScript Number (15 digits = OK mais 13 OK aussi)
  const remainder = Number(BigInt(first13) % 97n);

  if (remainder !== provided) {
    return { valid: false, reason: 'INVALID_CHECKSUM', normalized: cleaned };
  }

  return { valid: true, normalized: cleaned };
}

/**
 * Format affichage standard ICE : "1234567890 12345" (10 + 5).
 * Pour input invalide retourne la valeur brute.
 */
export function formatIce(input: string | null | undefined): string {
  if (!input) return '';
  const cleaned = String(input).replace(/[\s-]/g, '');
  if (cleaned.length !== 15 || !ICE_REGEX.test(cleaned)) return String(input);
  return `${cleaned.slice(0, 10)} ${cleaned.slice(10, 15)}`;
}

/**
 * Helper Zod : refine pour valider ICE dans schema.
 */
export const iceRefinement = (value: string): boolean => validateIce(value).valid;

export const ICE_VALIDATION_MESSAGE =
  'ICE invalide. Format attendu : 15 chiffres avec cle de controle modulo 97 (DGI MA).';
