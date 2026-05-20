/**
 * @insurtech/auth/auth.module
 *
 * @Global() AuthModule, progressively enriched across Sprint 5.
 *
 * Tache 2.1.1 -- skeleton @Global() module
 * Tache 2.1.2 -- adds PepperService, Argon2Service
 * Tache 2.1.3 -- adds EncryptionService, HashingService
 * Tache 2.1.4 -- adds JwtService                                  <-- current
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
 */

import { Global, Module } from '@nestjs/common';
import { Argon2Service } from './services/argon2.service.js';
import { EncryptionService } from './services/encryption.service.js';
import { HashingService } from './services/hashing.service.js';
import { JwtService } from './services/jwt.service.js';
import { PepperService } from './services/pepper.service.js';

@Global()
@Module({
  imports: [],
  providers: [PepperService, Argon2Service, EncryptionService, HashingService, JwtService],
  controllers: [],
  exports: [PepperService, Argon2Service, EncryptionService, HashingService, JwtService],
})
export class AuthModule {}
