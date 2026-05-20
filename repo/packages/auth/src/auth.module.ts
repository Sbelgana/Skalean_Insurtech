/**
 * @insurtech/auth/auth.module
 *
 * @Global() AuthModule for NestJS, progressively enriched across Sprint 5.
 *
 * Tache 2.1.1 -- skeleton @Global() module
 * Tache 2.1.2 -- adds PepperService, Argon2Service     <-- current
 * Tache 2.1.3 -- adds EncryptionService, HashingService
 * Tache 2.1.4 -- adds JwtService
 * Tache 2.1.5 -- adds SessionService
 * Tache 2.1.6 -- adds AuthController, AuthService, JwtStrategy, JwtAuthGuard
 * Tache 2.1.7 -- adds MfaService
 * Tache 2.1.8 -- adds MfaRequiredGuard
 * Tache 2.1.9 -- adds SignupService, EmailVerificationService
 * Tache 2.1.10 -- adds LockoutService
 * Tache 2.1.11 -- adds RecoveryService
 * Tache 2.1.12 -- adds AuditAuthService
 * Tache 2.1.13 -- adds EmailService
 * Tache 2.1.14 -- adds RateLimitGuard auth-specific
 *
 * Convention : never re-import @Global() modules in feature modules.
 */

import { Global, Module } from '@nestjs/common';
import { Argon2Service } from './services/argon2.service.js';
import { PepperService } from './services/pepper.service.js';

@Global()
@Module({
  imports: [],
  providers: [PepperService, Argon2Service],
  controllers: [],
  exports: [PepperService, Argon2Service],
})
export class AuthModule {}
