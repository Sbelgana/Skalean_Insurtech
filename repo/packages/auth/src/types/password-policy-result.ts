/**
 * @insurtech/auth/types/password-policy-result
 *
 * Result types returned by Argon2Service.validatePolicy().
 * Reasons are stable snake_case English keys mapped to i18n labels by frontends Sprint 4.
 */

export type PasswordPolicyReason =
  | 'too_short'
  | 'too_long'
  | 'missing_uppercase'
  | 'missing_lowercase'
  | 'missing_digit'
  | 'missing_special'
  | 'banned'
  | 'similar_to_email'
  | 'similar_to_display_name'
  | 'contains_email_local'
  | 'contains_display_name';

export type PasswordPolicyResult =
  | { valid: true }
  | { valid: false; reasons: PasswordPolicyReason[] };

export const ALL_PASSWORD_POLICY_REASONS: readonly PasswordPolicyReason[] = Object.freeze([
  'too_short',
  'too_long',
  'missing_uppercase',
  'missing_lowercase',
  'missing_digit',
  'missing_special',
  'banned',
  'similar_to_email',
  'similar_to_display_name',
  'contains_email_local',
  'contains_display_name',
]);
