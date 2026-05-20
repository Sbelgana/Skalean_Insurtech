/**
 * apps/api/src/modules/auth/guards/mfa-required.guard
 *
 * Rejects request if endpoint requires fresh MFA but user.mfa_verified is false.
 * Applied after JwtAuthGuard (chained). Reads @RequireMfa() metadata.
 */

import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthContext } from '@insurtech/auth';
import { ApiAuthError } from '../auth.errors.js';
import { REQUIRE_MFA_KEY } from '../decorators/require-mfa.decorator.js';

@Injectable()
export class MfaRequiredGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requireMfa = this.reflector.getAllAndOverride<boolean>(REQUIRE_MFA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requireMfa) return true;

    const req = context.switchToHttp().getRequest<{ auth?: AuthContext }>();
    const auth = req.auth;

    if (!auth || auth.subject.kind !== 'user' || !auth.subject.user.mfa_verified) {
      throw new ApiAuthError('MFA_REQUIRED', 'MFA verification required for this operation', 403);
    }
    return true;
  }
}
