/**
 * apps/api/src/modules/auth/dto/auth-response.dto
 *
 * Response shapes for /auth/* endpoints.
 */

import type { AuthRole } from '@insurtech/auth';

export interface UserPublic {
  id: string;
  email: string;
  display_name: string;
  role: AuthRole;
  tenant_id: string | null;
  email_verified: boolean;
  mfa_enabled: boolean;
  locale: 'fr-MA' | 'ar-MA' | 'en' | 'fr-FR';
  created_at: string;
  last_login_at: string | null;
}

export interface SigninSuccessResponse {
  mfa_required: false;
  access_token: string;
  refresh_token: string;
  access_expires_at: number;
  refresh_expires_at: number;
  token_type: 'Bearer';
  user: UserPublic;
}

export interface SigninMfaRequiredResponse {
  mfa_required: true;
  mfa_challenge_token: string;
  mfa_challenge_expires_at: number;
}

export type SigninResponse = SigninSuccessResponse | SigninMfaRequiredResponse;

export interface RefreshResponse {
  access_token: string;
  refresh_token: string;
  access_expires_at: number;
  refresh_expires_at: number;
  token_type: 'Bearer';
}
