/**
 * apps/api/src/modules/auth/guards/jwt-auth.guard
 *
 * Custom JWT auth guard (no Passport dependency).
 * Reads Authorization Bearer header, verifies with JwtService (RS256),
 * checks session via SessionService, loads user via UserRepository,
 * populates request.auth with AuthContext.
 *
 * Respects @Public() to skip the check.
 */

import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  type AuthContext,
  isTokenError,
  JwtService,
  SessionService,
  isSessionError,
} from '@insurtech/auth';
import { IS_PUBLIC_KEY } from '../../../decorators/public.decorator';
import { type UserRepository, USER_REPOSITORY_TOKEN } from '../user.repository.js';

interface NormalizedRequest {
  headers: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
  ip?: string;
  auth?: AuthContext;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly sessionService: SessionService,
    @Inject(USER_REPOSITORY_TOKEN) private readonly userRepo: UserRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<NormalizedRequest>();
    const authHeader = (req.headers['authorization'] ??
      req.headers['Authorization']) as string | undefined;
    const token = this.jwtService.extractFromHeader(authHeader);
    if (!token) {
      throw new UnauthorizedException({ code: 'NO_BEARER_TOKEN', message: 'Missing Bearer token' });
    }

    try {
      const payload = this.jwtService.verifyAccessToken(token);
      const session = await this.sessionService.ensureValid(payload.sid);
      const user = await this.userRepo.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException({ code: 'USER_NOT_FOUND', message: 'User not found' });
      }
      if (user.deleted_at !== null) {
        throw new UnauthorizedException({ code: 'ACCOUNT_DELETED', message: 'Account deleted' });
      }
      if (!user.is_active) {
        throw new UnauthorizedException({ code: 'ACCOUNT_DISABLED', message: 'Account disabled' });
      }

      const ipFromHeaders =
        (req.headers['x-forwarded-for'] as string | undefined)?.toString().split(',')[0]?.trim() ??
        req.ip ??
        req.socket?.remoteAddress ??
        'unknown';
      const userAgent =
        (req.headers['user-agent'] as string | undefined) ?? 'unknown';
      const requestId =
        (req.headers['x-request-id'] as string | undefined) ?? 'unknown';

      const auth: AuthContext = {
        subject: {
          kind: 'user',
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            display_name: user.display_name,
            tenant_id: user.tenant_id,
            mfa_enabled: user.mfa_enabled,
            mfa_verified: payload.mfa_verified,
            email_verified: user.email_verified_at !== null,
            locale: user.locale,
            created_at: user.created_at.toISOString(),
          },
          session_id: payload.sid,
          jwt_id: payload.jti,
        },
        ip: ipFromHeaders,
        user_agent: userAgent,
        request_id: requestId,
        authenticated_at: Math.floor(Date.now() / 1000),
      };
      req.auth = auth;

      // Touch last_seen_at (non-blocking)
      this.sessionService.touchLastSeen(session.jti, auth.ip).catch(() => {
        /* non-blocking */
      });

      return true;
    } catch (err: unknown) {
      if (isTokenError(err)) {
        throw new UnauthorizedException({ code: err.code, message: err.message });
      }
      if (isSessionError(err)) {
        throw new UnauthorizedException({ code: err.code, message: err.message });
      }
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      this.logger.error(
        { err: err instanceof Error ? err.message : String(err), action: 'jwt_auth_guard_error' },
        'JwtAuthGuard unexpected error',
      );
      throw new UnauthorizedException({
        code: 'AUTH_FAILED',
        message: 'Authentication failed',
      });
    }
  }
}
