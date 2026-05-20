/**
 * @insurtech/auth/types/token-pair
 *
 * Returned by JwtService for sign methods and AuthService.signin / refresh.
 */

declare const __signedJwtBrand: unique symbol;

export type SignedJwt = string & { readonly [__signedJwtBrand]: true };

export interface TokenPair {
  access_token: SignedJwt;
  refresh_token: SignedJwt;
  access_expires_at: number;
  refresh_expires_at: number;
  token_type: 'Bearer';
}
