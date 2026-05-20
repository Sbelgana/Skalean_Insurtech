/**
 * apps/api/src/modules/auth/auth.service
 *
 * Orchestrator service for signin/signout/refresh flows.
 * Sprint 5 Tache 2.1.6.
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
  TokenReuseDetectedError,
} from './auth.errors.js';
import type {
  RefreshResponse,
  SigninMfaRequiredResponse,
  SigninResponse,
  SigninSuccessResponse,
  UserPublic,
} from './dto/auth-response.dto.js';
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
      const mfaChallengeToken = this.hashing.randomToken(32);
      this.logger.log({ action: 'signin_mfa_required', user_id: user.id });
      const mfaChallengeExpiresAt = Math.floor(Date.now() / 1000) + 300;
      const response: SigninMfaRequiredResponse = {
        mfa_required: true,
        mfa_challenge_token: mfaChallengeToken,
        mfa_challenge_expires_at: mfaChallengeExpiresAt,
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
        {
          err: err instanceof Error ? err.message : String(err),
          user_id: user.id,
        },
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
        // Signature was valid but session is missing -- token was already
        // rotated out (replay) or revoked. Treat as token reuse to preserve
        // OAuth 2.0 BCP semantics. Sprint 6+ may differentiate.
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
