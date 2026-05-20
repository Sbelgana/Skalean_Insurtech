/**
 * apps/api/src/modules/auth/auth.service
 *
 * Orchestrator service for signin/signout/refresh/MFA flows.
 * Sprint 5 Tache 2.1.6 + 2.1.7 + 2.1.8.
 * Sprint 5 Tache 2.1.10 will plug in LockoutService.
 * Sprint 5 Tache 2.1.12 will plug in AuditAuthService + Kafka events.
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  Argon2Service,
  HashingService,
  isMfaMandatory,
  JwtService,
  JWT_PARAMS,
  MfaChallengeExpiredError as DomainMfaChallengeExpired,
  MfaInvalidCodeError as DomainMfaInvalidCode,
  MfaService,
  MfaSetupTokenExpiredError as DomainMfaSetupExpired,
  RefreshReplayDetectedError,
  SessionNotFoundError,
  SessionService,
  TokenError,
  type SigninInput,
} from '@insurtech/auth';
import {
  AccountDeletedError,
  AccountDisabledError,
  AccountLockedError,
  EmailNotVerifiedError,
  InvalidCredentialsError,
  InvalidRefreshTokenError,
  MfaAlreadyEnabledError,
  MfaChallengeExpiredError,
  MfaInvalidCodeError,
  MfaNotEnabledError,
  MfaSetupExpiredError,
  TokenReuseDetectedError,
} from './auth.errors.js';
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
  ) {}

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

    const valid = await this.argon2.verify(user.password_hash, input.password);
    if (!valid) {
      this.logger.warn({
        action: 'signin_failed_wrong_password',
        user_id: user.id,
        ip: ctx.ip,
      });
      throw InvalidCredentialsError();
    }

    if (user.email_verified_at === null) {
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
    return response;
  }

  async signout(sid: string): Promise<void> {
    await this.session.revokeSession(sid);
    this.logger.log({ action: 'signout', sid });
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
        throw TokenReuseDetectedError();
      }
      if (err instanceof SessionNotFoundError) {
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
