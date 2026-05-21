/**
 * Types pour TenantOnboardingService.
 *
 * Workflow : create tenant + admin user pending + token + email invitation.
 * complete via clic email -> set password + active user.
 *
 * Reference : Sprint 6 / Tache 2.2.8.
 */

import type { TenantSettings } from '@insurtech/auth';

export type OnboardingLocale = 'fr-MA' | 'ar-MA' | 'en' | 'fr-FR';

export interface OnboardingInitiateInput {
  tenant: {
    name: string;
    type: 'broker' | 'garage' | 'mixed';
    settings?: Partial<TenantSettings>;
  };
  admin: {
    email: string;
    displayName: string;
    locale: OnboardingLocale;
  };
}

export interface OnboardingInitiateResult {
  tenantId: string;
  adminUserId: string;
  emailSentTo: string;
  expiresAt: Date;
}

export interface OnboardingCompleteInput {
  token: string;
  password: string;
}

export interface OnboardingCompleteResult {
  tenantId: string;
  userId: string;
  email: string;
}

export interface OnboardingVerifyTokenResult {
  valid: boolean;
  tenantName?: string;
  emailMasked?: string;
  expiresAt?: Date;
  reason?: 'NOT_FOUND' | 'EXPIRED' | 'USED' | 'CANCELLED';
}

export const ONBOARDING_ERROR_CODES = {
  TOKEN_INVALID: 'ONBOARDING_TOKEN_INVALID',
  TOKEN_EXPIRED: 'ONBOARDING_TOKEN_EXPIRED',
  TOKEN_USED: 'ONBOARDING_TOKEN_USED',
  EMAIL_CONFLICT: 'ONBOARDING_EMAIL_CONFLICT',
  TENANT_NAME_CONFLICT: 'ONBOARDING_TENANT_NAME_CONFLICT',
  TENANT_NOT_FOUND: 'ONBOARDING_TENANT_NOT_FOUND',
  USER_NOT_PENDING: 'ONBOARDING_USER_NOT_PENDING',
  ALREADY_CANCELLED: 'ONBOARDING_ALREADY_CANCELLED',
  PASSWORD_WEAK: 'ONBOARDING_PASSWORD_WEAK',
} as const;

/** Token TTL en secondes (7 jours). */
export const ONBOARDING_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

/** Placeholder password hash pour user en cours d'onboarding (jamais argon2 valide). */
export const PENDING_PASSWORD_HASH_PLACEHOLDER = '$pending$onboarding$placeholder';
