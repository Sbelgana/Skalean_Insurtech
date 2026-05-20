/**
 * @insurtech/auth/types/encrypted-payload
 *
 * Branded ciphertext type and decoded payload interface.
 */

declare const __encryptedBrand: unique symbol;

/**
 * Branded string for ciphertext output by EncryptionService.encrypt.
 * Format : `<iv-b64u>:<ct-b64u>:<tag-b64u>`.
 * The brand prevents accidental mixing with other strings.
 */
export type EncryptedString = string & { readonly [__encryptedBrand]: true };

export interface EncryptedPayload {
  iv: Buffer;
  ciphertext: Buffer;
  authTag: Buffer;
}
