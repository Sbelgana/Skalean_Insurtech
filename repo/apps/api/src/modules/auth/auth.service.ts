/**
 * apps/api/src/modules/auth/auth.service
 *
 * Orchestrator service for signin/signout/refresh/MFA/recovery flows.
 * Sprint 5 Taches 2.1.6 + 2.1.7 + 2.1.8 + 2.1.9 + 2.1.11.
 * Sprint 5 closure : LockoutService + AuditAuthService wired into every flow.
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  AccountPermanentlyLockedError as DomainAccountPermanentlyLocked,
  Argon2Service,
  type AuthRole,
  HashingService,
  isMfaMandatory,
  JwtService,
  JWT_PARAMS,
  LockoutAccountLockedError as DomainLockoutAccountLocked,
  LockoutService,
  MfaChallengeExpiredError as DomainMfaChallengeExpired,
  MfaInvalidCodeError as DomainMfaInvalidCode,
  MfaService,
  MfaSetupTokenExpiredError as DomainMfaSetupExpired,
  RefreshReplayDetectedError,
  SessionNotFoundError,
  SessionService,
  TokenError,
  type SigninInput,
  type SignupInput,
} from '@insurtech/auth';
import {
  AccountDeletedError,
  AccountDisabledError,
  AccountLockedError,
  EmailNotVerifiedError,
  EmailVerificationInvalidError,
  InvalidCredentialsError,
  InvalidRefreshTokenError,
  MfaAlreadyEnabledError,
  MfaChallengeExpiredError,
  MfaInvalidCodeError,
  MfaNotEnabledError,
  MfaSetupExpiredError,
  PasswordPolicyViolationError,
  TokenReuseDetectedError,
} from './auth.errors.js';
import {
  type EmailVerificationRepository,
  EMAIL_VERIFICATION_REPOSITORY_TOKEN,
} from './email-verification.repository.js';
import { type EmailService, EMAIL_SERVICE_TOKEN } from './email.service.js';
import {
  type PasswordRecoveryRepository,
  PASSWORD_RECOVERY_REPOSITORY_TOKEN,
} from './password-recovery.repository.js';
import type {
  RefreshResponse,
  SigninMfaRequiredResponse,
  SigninResponse,
  SigninSuccessResponse,
  UserPublic,
} from './dto/auth-response.dto.js';
import type {
  ConfirmMfaResponse,
  DisableMfaResponse,
  SetupMfaResponse,
  VerifyMfaResponse,
} from './dto/mfa-response.dto.js';
import {
  type AuthUser,
  type UserRepository,
  USER_REPOSITORY_TOKEN,
} from './user.repository.js';
import { AuditAuthService, type AuditContextBase } from './audit-auth.service.js';

export interface SigninContext {
  ip: string;
  user_agent: string;
  request_id: string;
  remember_me: boolean;
  locale?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(USER_REPOSITORY_TOKEN) private readonly userRepo: UserRepository,
    private readonly argon2: Argon2Service,
    private readonly jwt: JwtService,
    private readonly session: SessionService,
    private readonly hashing: HashingService,
    private readonly mfa: MfaService,
    @Inject(EMAIL_VERIFICATION_REPOSITORY_TOKEN)
    private readonly emailVerifyRepo: EmailVerificationRepository,
    @Inject(EMAIL_SERVICE_TOKEN) private readonly emailService: EmailService,
    @Inject(PASSWORD_RECOVERY_REPOSITORY_TOKEN)
    private readonly recoveryRepo: PasswordRecoveryRepository,
    private readonly lockout: LockoutService,
    private readonly audit: AuditAuthService,
  ) {}

  /**
   * Translates a LockoutAccountLockedError / AccountPermanentlyLockedError
   * thrown by LockoutService into the ApiAuthError shape consumed by HTTP.
   */
  private translateLockoutError(err: unknown): never {
    if (err instanceof DomainAccountPermanentlyLocked) {
      throw AccountLockedError(null);
    }
    if (err instanceof DomainLockoutAccountLocked) {
      throw AccountLockedError(new Date(err.locked_until * 1000));
    }
    throw err;
  }

  /** Builds an AuditContextBase from a SigninContext + AuthUser. */
  private auditCtx(
    user: { id: string; email: string; tenant_id: string | null; role: AuthRole } | null,
    ctx: { ip: string; user_agent: string; request_id: string },
    sessionId: string | null = null,
  ): AuditContextBase {
    return {
      tenant_id: user?.tenant_id ?? null,
      user_id: user?.id ?? null,
      user_email: user?.email ?? null,
      user_role: user?.role ?? null,
      session_id: sessionId,
      ip: ctx.ip,
      user_agent: ctx.user_agent,
      request_id: ctx.request_id,
    };
  }

  /** Anti-enumeration : same response whether email exists or not. */
  async forgotPassword(
    email: string,
    ctx: { ip: string; user_agent: string },
  ): Promise<{ message: string }> {
    const lower = email.trim().toLowerCase();
    const sameResponse = {
      message: 'If your email is registered, a password reset link has been sent.',
    };
    const user = await this.userRepo.findByEmail(lower);
    if (!user) {
      this.logger.log({ action: 'forgot_password_unknown_email', email: lower });
      return sameResponse;
    }
    if (!user.is_active || user.deleted_at !== null) {
      this.logger.log({ action: 'forgot_password_inactive_user', user_id: user.id });
      return sameResponse;
    }
    await this.recoveryRepo.deleteUnconsumedForUser(user.id);
    const rawToken = this.hashing.randomToken(32);
    const tokenHash = this.hashing.sha256(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1h TTL
    await this.recoveryRepo.create({
      user_id: user.id,
      token_hash: tokenHash,
      expires_at: expiresAt,
      ip_at_creation: ctx.ip,
      user_agent_at_creation: ctx.user_agent,
    });
    await this.emailService.sendRecovery({
      to: lower,
      locale: user.locale,
      token: rawToken,
    });
    this.logger.log({ action: 'forgot_password_sent', user_id: user.id });
    await this.audit.logRecoveryCompleted(
      this.auditCtx(user, { ip: ctx.ip, user_agent: ctx.user_agent, request_id: 'forgot-pwd' }),
      { email: user.email },
    );
    return sameResponse;
  }

  /**
   * Validates the recovery token and applies the new password.
   * One-time use ; revokes all sessions on success.
   */
  async resetPassword(input: {
    recovery_token: string;
    new_password: string;
  }): Promise<{ message: string; reset: true }> {
    const tokenHash = this.hashing.sha256(input.recovery_token);
    const record = await this.recoveryRepo.findActiveByTokenHash(tokenHash);
    if (!record) {
      throw InvalidRefreshTokenError('Recovery token invalid or expired');
    }
    const user = await this.userRepo.findById(record.user_id);
    if (!user) {
      throw InvalidRefreshTokenError('User missing');
    }
    const policy = this.argon2.validatePolicy(input.new_password, {
      email: user.email,
      display_name: user.display_name,
    });
    if (!policy.valid) {
      throw PasswordPolicyViolationError(policy.reasons);
    }
    const newHash = await this.argon2.hash(input.new_password);
    await this.userRepo.updatePassword(user.id, newHash);
    await this.recoveryRepo.markConsumed(record.id);
    await this.session.revokeUserSessions(user.id);
    await this.emailService.sendPasswordChanged({
      to: user.email,
      locale: user.locale,
      display_name: user.display_name,
    });
    this.logger.log({ action: 'password_reset_success', user_id: user.id });
    await this.audit.logRecoveryCompleted(
      this.auditCtx(user, {
        ip: record.ip_at_creation ?? 'unknown',
        user_agent: record.user_agent_at_creation ?? 'unknown',
        request_id: 'reset-pwd',
      }),
      { email: user.email },
    );
    return { reset: true, message: 'Password updated. Please sign in with your new password.' };
  }

  /**
   * Creates a new user (email_verified_at NULL) and sends verification email.
   * Anti-enumeration : returns same response whether email exists or not.
   */
  async signup(
    input: SignupInput,
    ctx: { ip: string; user_agent: string; request_id: string },
  ): Promise<{ message: string }> {
    const email = input.email.trim().toLowerCase();
    const policy = this.argon2.validatePolicy(input.password, {
      email,
      display_name: input.display_name,
    });
    if (!policy.valid) {
      throw PasswordPolicyViolationError(policy.reasons);
    }
    const existing = await this.userRepo.findByEmail(email);
    if (existing) {
      this.logger.log({ action: 'signup_duplicate_attempt', email, ip: ctx.ip });
      return {
        message: 'If your email is not yet registered, a verification email has been sent.',
      };
    }
    const passwordHash = await this.argon2.hash(input.password);
    const userId = this.jwt.generateUuid();
    const role = (input.requested_role ?? 'prospect') as AuthRole;
    await this.userRepo.create({
      id: userId,
      email,
      display_name: input.display_name,
      role,
      tenant_id: null,
      password_hash: passwordHash,
      email_verified_at: null,
      mfa_enabled: false,
      mfa_secret_encrypted: null,
      mfa_recovery_codes_hashes: null,
      mfa_setup_completed_at: null,
      is_active: true,
      deleted_at: null,
      locked_until: null,
      failed_login_attempts: 0,
      locale: input.locale,
      created_at: new Date(),
      last_login_at: null,
      last_login_ip: null,
    });
    const rawToken = this.hashing.randomToken(32);
    const tokenHash = this.hashing.sha256(rawToken);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await this.emailVerifyRepo.create({
      user_id: userId,
      token_hash: tokenHash,
      purpose: 'signup',
      expires_at: expiresAt,
      ip_at_creation: ctx.ip,
      user_agent_at_creation: ctx.user_agent,
    });
    await this.emailService.sendVerification({
      to: email,
      locale: input.locale,
      token: rawToken,
      display_name: input.display_name,
    });
    this.logger.log({ action: 'signup_completed', user_id: userId, email });
    const auditBase: AuditContextBase = {
      tenant_id: null,
      user_id: userId,
      user_email: email,
      user_role: role,
      session_id: null,
      ip: ctx.ip,
      user_agent: ctx.user_agent,
      request_id: ctx.request_id,
    };
    await this.audit.logSignupStarted(auditBase, { email, locale: input.locale });
    await this.audit.logSignupCompleted(auditBase, { email, role });
    return {
      message: 'If your email is not yet registered, a verification email has been sent.',
    };
  }

  /** Verifies the email via SHA-256-hashed token lookup. One-time use. */
  async verifyEmail(token: string): Promise<{ verified: true; message: string }> {
    const tokenHash = this.hashing.sha256(token);
    const record = await this.emailVerifyRepo.findActiveByTokenHash(tokenHash);
    if (!record) {
      throw EmailVerificationInvalidError();
    }
    await this.userRepo.markEmailVerified(record.user_id, new Date());
    await this.emailVerifyRepo.markConsumed(record.id);
    this.logger.log({ action: 'email_verified', user_id: record.user_id });
    const user = await this.userRepo.findById(record.user_id);
    await this.audit.logEmailVerified(
      this.auditCtx(user, {
        ip: record.ip_at_creation ?? 'unknown',
        user_agent: record.user_agent_at_creation ?? 'unknown',
        request_id: 'verify-email',
      }),
      { email: user?.email ?? 'unknown' },
    );
    return { verified: true, message: 'Email verified. You can now sign in.' };
  }

  /** Re-sends verification (anti-enumeration : same response when unknown). */
  async resendVerification(
    email: string,
    ctx: { ip: string; user_agent: string },
  ): Promise<{ message: string }> {
    const lower = email.trim().toLowerCase();
    const user = await this.userRepo.findByEmail(lower);
    const sameResponse = {
      message: 'If your email is registered and not yet verified, a new email has been sent.',
    };
    if (!user) {
      this.logger.log({ action: 'resend_verification_unknown_email', email: lower });
      return sameResponse;
    }
    if (user.email_verified_at !== null) {
      this.logger.log({ action: 'resend_verification_already_verified', user_id: user.id });
      return sameResponse;
    }
    await this.emailVerifyRepo.deleteUnconsumedForUser(user.id);
    const rawToken = this.hashing.randomToken(32);
    const tokenHash = this.hashing.sha256(rawToken);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await this.emailVerifyRepo.create({
      user_id: user.id,
      token_hash: tokenHash,
      purpose: 'resend',
      expires_at: expiresAt,
      ip_at_creation: ctx.ip,
      user_agent_at_creation: ctx.user_agent,
    });
    await this.emailService.sendVerification({
      to: lower,
      locale: user.locale,
      token: rawToken,
      display_name: user.display_name,
    });
    this.logger.log({ action: 'resend_verification_sent', user_id: user.id });
    return sameResponse;
  }

  async signin(input: SigninInput, ctx: SigninContext): Promise<SigninResponse> {
    const email = input.email.trim().toLowerCase();
    this.logger.log({ action: 'signin_attempt', email, ip: ctx.ip });

    const user = await this.userRepo.findByEmail(email);
    if (!user) {
      await this.argon2.verifyEmptyForTiming(input.password);
      throw InvalidCredentialsError();
    }

    if (user.deleted_at !== null) {
      throw AccountDeletedError();
    }
    if (!user.is_active) {
      throw AccountDisabledError();
    }

    if (user.locked_until !== null && user.locked_until > new Date()) {
      throw AccountLockedError(user.locked_until);
    }

    // LockoutService check : throws if user is within an active lock window
    try {
      await this.lockout.assertNotLocked(user.id);
    } catch (err: unknown) {
      await this.audit.logSigninLocked(this.auditCtx(user, ctx), {
        tier: 1,
        locked_until: new Date().toISOString(),
      });
      this.translateLockoutError(err);
    }

    const valid = await this.argon2.verify(user.password_hash, input.password);
    if (!valid) {
      this.logger.warn({
        action: 'signin_failed_wrong_password',
        user_id: user.id,
        ip: ctx.ip,
      });
      // Record failed attempt -- throws AccountLockedError on tier transition
      try {
        await this.lockout.recordFailedAttempt({
          user_id: user.id,
          ip: ctx.ip,
          email: user.email,
        });
      } catch (err: unknown) {
        await this.audit.logSigninLocked(this.auditCtx(user, ctx), {
          tier: 1,
          locked_until: new Date().toISOString(),
        });
        this.translateLockoutError(err);
      }
      await this.audit.logSigninFailed(this.auditCtx(user, ctx), {
        reason: 'invalid_credentials',
      });
      throw InvalidCredentialsError();
    }

    // Successful password verify : reset lockout counter
    await this.lockout.recordSuccess(user.id);

    if (user.email_verified_at === null) {
      await this.audit.logSigninFailed(this.auditCtx(user, ctx), {
        reason: 'email_not_verified',
      });
      throw EmailNotVerifiedError();
    }

    if (user.mfa_enabled || isMfaMandatory(user.role)) {
      const challenge = await this.mfa.createChallengeToken({
        user_id: user.id,
        email: user.email,
      });
      this.logger.log({ action: 'signin_mfa_required', user_id: user.id });
      const response: SigninMfaRequiredResponse = {
        mfa_required: true,
        mfa_challenge_token: challenge.token,
        mfa_challenge_expires_at: challenge.expires_at,
      };
      return response;
    }

    const sid = this.jwt.generateId();
    const family = this.jwt.generateId();
    const refreshGen = 1;
    const refreshToken = this.jwt.signRefreshToken({
      sub: user.id,
      sid,
      token_family: family,
      generation: refreshGen,
    });
    const refreshPayload = this.jwt.verifyRefreshToken(refreshToken);

    await this.session.createSession({
      user_id: user.id,
      tenant_id: user.tenant_id,
      role: user.role,
      jti: refreshPayload.jti,
      refresh_token_family: family,
      refresh_generation: refreshGen,
      ip: ctx.ip,
      user_agent: ctx.user_agent,
      mfa_verified: false,
      remember_me: ctx.remember_me,
      ...(ctx.locale !== undefined ? { locale: ctx.locale } : {}),
    });

    const accessToken = this.jwt.signAccessToken({
      sub: user.id,
      tenant_id: user.tenant_id,
      email: user.email,
      role: user.role,
      mfa_verified: false,
      sid,
    });

    this.userRepo.updateLastLogin(user.id, new Date(), ctx.ip).catch((err: unknown) => {
      this.logger.warn(
        { err: err instanceof Error ? err.message : String(err), user_id: user.id },
        'updateLastLogin failed',
      );
    });

    const now = Math.floor(Date.now() / 1000);
    const response: SigninSuccessResponse = {
      mfa_required: false,
      access_token: accessToken,
      refresh_token: refreshToken,
      access_expires_at: now + JWT_PARAMS.ttl_access_seconds,
      refresh_expires_at: now + JWT_PARAMS.ttl_refresh_seconds,
      token_type: 'Bearer',
      user: this.toPublicUser(user),
    };
    this.logger.log({ action: 'signin_success', user_id: user.id, sid });
    await this.audit.logSigninSuccess(this.auditCtx(user, ctx, sid), {
      mfa_required: false,
      remember_me: ctx.remember_me,
    });
    return response;
  }

  async signout(sid: string, auditMeta?: AuditContextBase): Promise<void> {
    await this.session.revokeSession(sid);
    this.logger.log({ action: 'signout', sid });
    if (auditMeta) {
      await this.audit.logSignout(auditMeta, { session_id: sid });
    }
  }

  async signoutAll(userId: string): Promise<{ sessions_revoked: number }> {
    const count = await this.session.revokeUserSessions(userId);
    this.logger.log({ action: 'signout_all', user_id: userId, count });
    return { sessions_revoked: count };
  }

  async refresh(refreshToken: string, ctx: SigninContext): Promise<RefreshResponse> {
    let payload;
    try {
      payload = this.jwt.verifyRefreshToken(refreshToken);
    } catch (err: unknown) {
      if (err instanceof TokenError) {
        throw InvalidRefreshTokenError(err.message);
      }
      throw err;
    }

    const newJti = this.jwt.generateId();
    const newGeneration = payload.generation + 1;
    try {
      await this.session.rotateSession({
        old_jti: payload.jti,
        new_jti: newJti,
        expected_generation: payload.generation,
        new_generation: newGeneration,
        ip: ctx.ip,
        user_agent: ctx.user_agent,
        ...(ctx.locale !== undefined ? { locale: ctx.locale } : {}),
      });
    } catch (err: unknown) {
      if (err instanceof RefreshReplayDetectedError) {
        await this.audit.logRefreshReplayDetected(
          this.auditCtx(null, ctx, payload.sid),
          {
            token_family: payload.token_family,
            expected_generation: payload.generation,
            presented_generation: payload.generation,
          },
        );
        throw TokenReuseDetectedError();
      }
      if (err instanceof SessionNotFoundError) {
        await this.audit.logRefreshReplayDetected(
          this.auditCtx(null, ctx, payload.sid),
          {
            token_family: payload.token_family,
            expected_generation: payload.generation,
            presented_generation: payload.generation,
          },
        );
        throw TokenReuseDetectedError();
      }
      throw err;
    }

    const user = await this.userRepo.findById(payload.sub);
    if (!user) {
      throw InvalidRefreshTokenError('User missing');
    }

    const newAccess = this.jwt.signAccessToken({
      sub: user.id,
      tenant_id: user.tenant_id,
      email: user.email,
      role: user.role,
      mfa_verified: false,
      sid: payload.sid,
    });
    const newRefresh = this.jwt.signRefreshToken({
      sub: user.id,
      sid: payload.sid,
      token_family: payload.token_family,
      generation: newGeneration,
    });

    const now = Math.floor(Date.now() / 1000);
    return {
      access_token: newAccess,
      refresh_token: newRefresh,
      access_expires_at: now + JWT_PARAMS.ttl_access_seconds,
      refresh_expires_at: now + JWT_PARAMS.ttl_refresh_seconds,
      token_type: 'Bearer',
    };
  }

  async setupMfa(input: { user_id: string; email: string }): Promise<SetupMfaResponse> {
    const user = await this.userRepo.findById(input.user_id);
    if (!user) throw InvalidCredentialsError();
    if (user.mfa_enabled) throw MfaAlreadyEnabledError();
    const setup = await this.mfa.startSetup({ user_id: input.user_id, email: input.email });
    this.logger.log({ action: 'mfa_setup_started', user_id: input.user_id });
    return {
      setup_token: setup.setup_token,
      secret_b32: setup.secret_b32,
      qr_code_data_url: setup.qr_code_data_url,
      otpauth_url: setup.otpauth_url,
      expires_at: setup.expires_at,
    };
  }

  async confirmMfa(input: {
    user_id: string;
    setup_token: string;
    totp_code: string;
  }): Promise<ConfirmMfaResponse> {
    const user = await this.userRepo.findById(input.user_id);
    if (!user) throw InvalidCredentialsError();
    if (user.mfa_enabled) throw MfaAlreadyEnabledError();

    let result;
    try {
      result = await this.mfa.confirmSetup({
        setup_token: input.setup_token,
        totp_code: input.totp_code,
        user_id: input.user_id,
      });
    } catch (err: unknown) {
      if (err instanceof DomainMfaSetupExpired) throw MfaSetupExpiredError();
      if (err instanceof DomainMfaInvalidCode) throw MfaInvalidCodeError();
      throw err;
    }

    await this.userRepo.setMfaEnabled(user.id, true, result.encrypted_secret);
    await this.userRepo.setMfaRecoveryCodes(user.id, [...result.recovery_codes_hashed]);
    await this.session.revokeUserSessions(user.id);

    this.logger.log({ action: 'mfa_setup_confirmed', user_id: input.user_id });
    await this.audit.logMfaSetupCompleted(
      this.auditCtx(user, {
        ip: 'mfa-setup',
        user_agent: 'mfa-setup',
        request_id: 'mfa-setup',
      }),
      { method: 'totp', recovery_codes_count: result.recovery_codes_clear.length },
    );

    return {
      mfa_enabled: true,
      recovery_codes: result.confirm.recovery_codes,
      recovery_codes_warning: result.confirm.recovery_codes_warning,
      message: 'MFA enabled. All sessions revoked. Please sign in again with MFA.',
    };
  }

  async verifyMfa(input: {
    challenge_token: string;
    totp_code?: string;
    recovery_code?: string;
    ip: string;
    user_agent: string;
    request_id: string;
    remember_me?: boolean;
    locale?: string;
  }): Promise<VerifyMfaResponse> {
    let challenge;
    try {
      challenge = await this.mfa.consumeChallengeToken(input.challenge_token);
    } catch (err: unknown) {
      if (err instanceof DomainMfaChallengeExpired) throw MfaChallengeExpiredError();
      throw err;
    }

    const user = await this.userRepo.findById(challenge.user_id);
    if (!user) throw InvalidCredentialsError();
    if (!user.mfa_enabled || !user.mfa_secret_encrypted) {
      throw MfaNotEnabledError();
    }

    let mfaVerified = false;
    let usedRecoveryIndex: number | undefined;
    if (input.totp_code) {
      mfaVerified = await this.mfa.verifyEncryptedTotp({
        encrypted_secret: user.mfa_secret_encrypted,
        user_id: user.id,
        totp_code: input.totp_code,
      });
    } else if (input.recovery_code) {
      const r = await this.mfa.verifyRecoveryCode({
        hashes: user.mfa_recovery_codes_hashes ?? [],
        presented: input.recovery_code,
      });
      mfaVerified = r.valid;
      usedRecoveryIndex = r.recovery_code_index_used;
    }
    if (!mfaVerified) {
      throw MfaInvalidCodeError();
    }

    if (usedRecoveryIndex !== undefined) {
      await this.userRepo.consumeMfaRecoveryCode(user.id, usedRecoveryIndex);
    }

    const sid = this.jwt.generateId();
    const family = this.jwt.generateId();
    const refreshGen = 1;
    const refreshToken = this.jwt.signRefreshToken({
      sub: user.id,
      sid,
      token_family: family,
      generation: refreshGen,
    });
    const refreshPayload = this.jwt.verifyRefreshToken(refreshToken);

    await this.session.createSession({
      user_id: user.id,
      tenant_id: user.tenant_id,
      role: user.role,
      jti: refreshPayload.jti,
      refresh_token_family: family,
      refresh_generation: refreshGen,
      ip: input.ip,
      user_agent: input.user_agent,
      mfa_verified: true,
      remember_me: input.remember_me ?? false,
      ...(input.locale !== undefined ? { locale: input.locale } : {}),
    });

    const accessToken = this.jwt.signAccessToken({
      sub: user.id,
      tenant_id: user.tenant_id,
      email: user.email,
      role: user.role,
      mfa_verified: true,
      sid,
    });

    await this.userRepo.updateLastLogin(user.id, new Date(), input.ip);
    const now = Math.floor(Date.now() / 1000);

    this.logger.log({ action: 'mfa_verify_success', user_id: user.id });
    await this.audit.logMfaVerifySuccess(
      this.auditCtx(
        user,
        { ip: input.ip, user_agent: input.user_agent, request_id: input.request_id },
        sid,
      ),
      { method: usedRecoveryIndex !== undefined ? 'recovery_code' : 'totp' },
    );

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      access_expires_at: now + JWT_PARAMS.ttl_access_seconds,
      refresh_expires_at: now + JWT_PARAMS.ttl_refresh_seconds,
      token_type: 'Bearer',
      user: this.toPublicUser(user),
      mfa_verified: true,
    };
  }

  async disableMfa(input: {
    user_id: string;
    current_password: string;
    totp_code: string;
  }): Promise<DisableMfaResponse> {
    const user = await this.userRepo.findById(input.user_id);
    if (!user) throw InvalidCredentialsError();
    if (!user.mfa_enabled || !user.mfa_secret_encrypted) {
      throw MfaNotEnabledError();
    }

    const passwordOk = await this.argon2.verify(user.password_hash, input.current_password);
    if (!passwordOk) throw InvalidCredentialsError();

    const totpOk = await this.mfa.verifyEncryptedTotp({
      encrypted_secret: user.mfa_secret_encrypted,
      user_id: user.id,
      totp_code: input.totp_code,
    });
    if (!totpOk) throw MfaInvalidCodeError();

    await this.userRepo.setMfaEnabled(user.id, false, null);
    await this.userRepo.setMfaRecoveryCodes(user.id, null);
    const count = await this.session.revokeUserSessions(user.id);

    this.logger.log({ action: 'mfa_disabled', user_id: input.user_id });
    return {
      mfa_enabled: false,
      message: 'MFA disabled. All sessions revoked.',
      sessions_revoked: count,
    };
  }

  toPublicUser(user: AuthUser): UserPublic {
    return {
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      role: user.role,
      tenant_id: user.tenant_id,
      email_verified: user.email_verified_at !== null,
      mfa_enabled: user.mfa_enabled,
      locale: user.locale,
      created_at: user.created_at.toISOString(),
      last_login_at: user.last_login_at?.toISOString() ?? null,
    };
  }
}
