/**
 * apps/api/src/modules/auth/decorators/current-auth.decorator
 *
 * Extracts AuthContext from the request after JwtAuthGuard has populated it.
 */

import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthContext } from '@insurtech/auth';

export const CurrentAuth = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthContext => {
    const req = ctx.switchToHttp().getRequest<{ auth?: AuthContext }>();
    if (!req.auth) {
      throw new Error(
        'CurrentAuth: request.auth is missing -- ensure route is protected by JwtAuthGuard',
      );
    }
    return req.auth;
  },
);
