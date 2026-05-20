/**
 * @insurtech/auth/auth.module
 *
 * Skeleton @Global() AuthModule for NestJS.
 *
 * INTENTIONALLY EMPTY in Tache 2.1.1 -- enriched progressively :
 *   - Tache 2.1.2 adds Argon2Service to providers
 *   - Tache 2.1.3 adds EncryptionService, HashingService
 *   - Tache 2.1.4 adds JwtService
 *   - Tache 2.1.5 adds SessionService
 *   - Tache 2.1.6 adds AuthController, AuthService, JwtStrategy, JwtAuthGuard
 *   - Tache 2.1.7 adds MfaService
 *   - Tache 2.1.8 adds MfaRequiredGuard
 *   - Tache 2.1.9 adds SignupService, EmailVerificationService
 *   - Tache 2.1.10 adds LockoutService
 *   - Tache 2.1.11 adds RecoveryService
 *   - Tache 2.1.12 adds AuditAuthService
 *   - Tache 2.1.13 adds EmailService
 *   - Tache 2.1.14 adds RateLimitGuard auth-specific
 *   - Tache 2.1.15 covers it with E2E tests
 *
 * Convention : never re-import @Global() modules in feature modules.
 */

import { Global, Module } from '@nestjs/common';

@Global()
@Module({
  imports: [],
  providers: [],
  controllers: [],
  exports: [],
})
export class AuthModule {}
