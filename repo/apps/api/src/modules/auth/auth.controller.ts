/**
 * apps/api/src/modules/auth/auth.controller
 *
 * REST endpoints for /api/v1/auth/*.
 * Sprint 5 Tache 2.1.6 (signin/signout/refresh/me)
 *           + 2.1.8 (setup-mfa/confirm-mfa/verify-mfa/disable-mfa)
 *           + 2.1.9 (signup/verify-email/resend-verification)
 */

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  type AuthContext,
  mfaDisableSchema,
  mfaSetupConfirmSchema,
  mfaVerifySchema,
  recoveryConfirmSchema,
  recoveryRequestSchema,
  refreshSchema,
  resendVerificationSchema,
  signinSchema,
  signupSchema,
  verifyEmailSchema,
} from '@insurtech/auth';
import { z } from 'zod';
import { Public } from '../../decorators/public.decorator';
import { AuthService, type SigninContext } from './auth.service.js';
import { CurrentAuth } from './decorators/current-auth.decorator.js';
import type {
  RefreshResponse,
  SigninResponse,
  UserPublic,
} from './dto/auth-response.dto.js';
import type {
  ConfirmMfaResponse,
  DisableMfaResponse,
  SetupMfaResponse,
  VerifyMfaResponse,
} from './dto/mfa-response.dto.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';

interface HttpHeadersBag {
  [k: string]: string | string[] | undefined;
}

const signoutSchema = z
  .object({
    all_devices: z.boolean().optional().default(false),
  })
  .strict();

@Controller('api/v1/auth')
@UseGuards(JwtAuthGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 3, ttl: 3600 } })
  @Post('signup')
  @HttpCode(HttpStatus.OK)
  async signup(
    @Body() body: unknown,
    @Req() req: { headers: HttpHeadersBag; ip?: string; socket?: { remoteAddress?: string } },
  ): Promise<{ message: string }> {
    const parsed = signupSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Invalid signup payload',
        issues: parsed.error.issues,
      });
    }
    const ctx = this.buildContext(req, false);
    return this.authService.signup(parsed.data, ctx);
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() body: unknown): Promise<{ verified: true; message: string }> {
    const parsed = verifyEmailSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Invalid verify-email payload',
        issues: parsed.error.issues,
      });
    }
    return this.authService.verifyEmail(parsed.data.verification_token);
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 3600 } })
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  async resendVerification(
    @Body() body: unknown,
    @Req() req: { headers: HttpHeadersBag; ip?: string; socket?: { remoteAddress?: string } },
  ): Promise<{ message: string }> {
    const parsed = resendVerificationSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Invalid resend-verification payload',
        issues: parsed.error.issues,
      });
    }
    const ctx = this.buildContext(req, false);
    return this.authService.resendVerification(parsed.data.email, {
      ip: ctx.ip,
      user_agent: ctx.user_agent,
    });
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60 } })
  @Post('signin')
  @HttpCode(HttpStatus.OK)
  async signin(
    @Body() body: unknown,
    @Req() req: { headers: HttpHeadersBag; ip?: string; socket?: { remoteAddress?: string } },
  ): Promise<SigninResponse> {
    const parsed = signinSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Invalid signin payload',
        issues: parsed.error.issues,
      });
    }
    const ctx = this.buildContext(req, parsed.data.remember_me);
    return this.authService.signin(parsed.data, ctx);
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 3600 } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(
    @Body() body: unknown,
    @Req() req: { headers: HttpHeadersBag; ip?: string; socket?: { remoteAddress?: string } },
  ): Promise<{ message: string }> {
    const parsed = recoveryRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Invalid forgot-password payload',
        issues: parsed.error.issues,
      });
    }
    const ctx = this.buildContext(req, false);
    return this.authService.forgotPassword(parsed.data.email, {
      ip: ctx.ip,
      user_agent: ctx.user_agent,
    });
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() body: unknown): Promise<{ message: string; reset: true }> {
    const parsed = recoveryConfirmSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Invalid reset-password payload',
        issues: parsed.error.issues,
      });
    }
    return this.authService.resetPassword({
      recovery_token: parsed.data.recovery_token,
      new_password: parsed.data.new_password,
    });
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() body: unknown,
    @Req() req: { headers: HttpHeadersBag; ip?: string; socket?: { remoteAddress?: string } },
  ): Promise<RefreshResponse> {
    const parsed = refreshSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Invalid refresh payload',
        issues: parsed.error.issues,
      });
    }
    const ctx = this.buildContext(req, false);
    return this.authService.refresh(parsed.data.refresh_token, ctx);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60 } })
  @Post('verify-mfa')
  @HttpCode(HttpStatus.OK)
  async verifyMfa(
    @Body() body: unknown,
    @Req() req: { headers: HttpHeadersBag; ip?: string; socket?: { remoteAddress?: string } },
  ): Promise<VerifyMfaResponse> {
    const parsed = mfaVerifySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Invalid verify-mfa payload',
        issues: parsed.error.issues,
      });
    }
    const ctx = this.buildContext(req, false);
    return this.authService.verifyMfa({
      challenge_token: parsed.data.challenge_token,
      ...(parsed.data.totp_code !== undefined ? { totp_code: parsed.data.totp_code } : {}),
      ...(parsed.data.recovery_code !== undefined
        ? { recovery_code: parsed.data.recovery_code }
        : {}),
      ip: ctx.ip,
      user_agent: ctx.user_agent,
      request_id: ctx.request_id,
    });
  }

  @Post('signout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async signout(
    @Body() body: unknown,
    @CurrentAuth() auth: AuthContext,
  ): Promise<void> {
    const parsed = signoutSchema.safeParse(body ?? {});
    const all = parsed.success ? parsed.data.all_devices : false;
    if (auth.subject.kind !== 'user') return;
    if (all) {
      await this.authService.signoutAll(auth.subject.user.id);
      return;
    }
    await this.authService.signout(auth.subject.session_id);
  }

  @Post('setup-mfa')
  @HttpCode(HttpStatus.OK)
  async setupMfa(@CurrentAuth() auth: AuthContext): Promise<SetupMfaResponse> {
    if (auth.subject.kind !== 'user') {
      throw new BadRequestException({ code: 'NOT_USER_SUBJECT', message: 'Not a user subject' });
    }
    return this.authService.setupMfa({
      user_id: auth.subject.user.id,
      email: auth.subject.user.email,
    });
  }

  @Post('confirm-mfa')
  @HttpCode(HttpStatus.OK)
  async confirmMfa(
    @Body() body: unknown,
    @CurrentAuth() auth: AuthContext,
  ): Promise<ConfirmMfaResponse> {
    if (auth.subject.kind !== 'user') {
      throw new BadRequestException({ code: 'NOT_USER_SUBJECT', message: 'Not a user subject' });
    }
    const parsed = mfaSetupConfirmSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Invalid confirm-mfa payload',
        issues: parsed.error.issues,
      });
    }
    return this.authService.confirmMfa({
      user_id: auth.subject.user.id,
      setup_token: parsed.data.setup_token,
      totp_code: parsed.data.totp_code,
    });
  }

  @Post('disable-mfa')
  @HttpCode(HttpStatus.OK)
  async disableMfa(
    @Body() body: unknown,
    @CurrentAuth() auth: AuthContext,
  ): Promise<DisableMfaResponse> {
    if (auth.subject.kind !== 'user') {
      throw new BadRequestException({ code: 'NOT_USER_SUBJECT', message: 'Not a user subject' });
    }
    const parsed = mfaDisableSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Invalid disable-mfa payload',
        issues: parsed.error.issues,
      });
    }
    return this.authService.disableMfa({
      user_id: auth.subject.user.id,
      current_password: parsed.data.current_password,
      totp_code: parsed.data.totp_code,
    });
  }

  @Get('me')
  async me(@CurrentAuth() auth: AuthContext): Promise<UserPublic> {
    if (auth.subject.kind !== 'user') {
      throw new BadRequestException({ code: 'NOT_USER_SUBJECT', message: 'Not a user subject' });
    }
    const u = auth.subject.user;
    return {
      id: u.id,
      email: u.email,
      display_name: u.display_name,
      role: u.role,
      tenant_id: u.tenant_id,
      email_verified: u.email_verified,
      mfa_enabled: u.mfa_enabled,
      locale: u.locale,
      created_at: u.created_at,
      last_login_at: null,
    };
  }

  private buildContext(
    req: { headers: HttpHeadersBag; ip?: string; socket?: { remoteAddress?: string } },
    rememberMe: boolean,
  ): SigninContext {
    const xff = req.headers['x-forwarded-for'];
    const ipFromXff =
      typeof xff === 'string' ? xff.split(',')[0]?.trim() : Array.isArray(xff) ? xff[0] : undefined;
    return {
      ip: ipFromXff ?? req.ip ?? req.socket?.remoteAddress ?? 'unknown',
      user_agent: (req.headers['user-agent'] as string | undefined) ?? 'unknown',
      request_id: (req.headers['x-request-id'] as string | undefined) ?? 'unknown',
      remember_me: rememberMe,
    };
  }
}
