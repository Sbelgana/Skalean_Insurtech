/**
 * apps/api/src/modules/auth/decorators/require-mfa.decorator
 *
 * @RequireMfa() -- marks an endpoint as requiring fresh MFA verification.
 * Read by MfaRequiredGuard (chained after JwtAuthGuard).
 *
 * Usage :
 *   @Post('payments')
 *   @RequireMfa()
 *   createPayment(@CurrentAuth() auth: AuthContext) { ... }
 */

import { SetMetadata } from '@nestjs/common';

export const REQUIRE_MFA_KEY = 'requireMfa';

export const RequireMfa = (): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRE_MFA_KEY, true);
