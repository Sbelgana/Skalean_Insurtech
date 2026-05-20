/**
 * apps/api/src/modules/auth/auth.controller
 *
 * REST endpoints for /api/v1/auth/*.
 * Sprint 5 Tache 2.1.6.
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
import { type AuthContext, signinSchema, refreshSchema } from '@insurtech/auth';
import { z } from 'zod';
import { Public } from '../../decorators/public.decorator';
import { CurrentAuth } from './decorators/current-auth.decorator.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { AuthService, type SigninContext } from './auth.service.js';
import type {
  RefreshResponse,
  SigninResponse,
  UserPublic,
} from './dto/auth-response.dto.js';

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

  @UseGuards(JwtAuthGuard)
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

  @Public()
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
