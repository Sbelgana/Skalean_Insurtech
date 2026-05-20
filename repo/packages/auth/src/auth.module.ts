/**
 * @insurtech/auth/auth.module
 *
 * @Global() AuthModule, progressively enriched across Sprint 5.
 *
 * Tache 2.1.1 -- skeleton @Global() module
 * Tache 2.1.2 -- PepperService, Argon2Service
 * Tache 2.1.3 -- EncryptionService, HashingService
 * Tache 2.1.4 -- JwtService (RS256)
 * Tache 2.1.5 -- SessionService + REDIS_TOKEN factory + NoOpSessionRepository
 * Tache 2.1.6 -- AuthController, AuthService, JwtAuthGuard (in apps/api)
 * Tache 2.1.7 -- MfaService (TOTP RFC 6238 + QR + recovery codes)  <-- current
 * Tache 2.1.8 -- MfaRequiredGuard
 * Tache 2.1.9 -- SignupService, EmailVerificationService
 * Tache 2.1.10 -- LockoutService
 * Tache 2.1.11 -- RecoveryService
 * Tache 2.1.12 -- AuditAuthService
 * Tache 2.1.13 -- EmailService
 * Tache 2.1.14 -- RateLimitGuard auth-specific
 */

import { Global, Module, type Provider } from '@nestjs/common';
import { Redis } from 'ioredis';
import { Argon2Service } from './services/argon2.service.js';
import { EncryptionService } from './services/encryption.service.js';
import { HashingService } from './services/hashing.service.js';
import { JwtService } from './services/jwt.service.js';
import { MfaService } from './services/mfa.service.js';
import { PepperService } from './services/pepper.service.js';
import { REDIS_TOKEN, SessionService } from './services/session.service.js';
import {
  NoOpSessionRepository,
  SESSION_REPOSITORY_TOKEN,
} from './services/session.repository.js';

const redisProvider: Provider = {
  provide: REDIS_TOKEN,
  useFactory: (): Redis =>
    new Redis({
      host: process.env['REDIS_HOST'] ?? 'localhost',
      port: Number.parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
      db: Number.parseInt(process.env['REDIS_SESSIONS_DB'] ?? '1', 10),
      ...(process.env['REDIS_PASSWORD'] ? { password: process.env['REDIS_PASSWORD'] } : {}),
      lazyConnect: true,
    }),
};

const sessionRepoProvider: Provider = {
  provide: SESSION_REPOSITORY_TOKEN,
  useClass: NoOpSessionRepository,
};

@Global()
@Module({
  imports: [],
  providers: [
    PepperService,
    Argon2Service,
    EncryptionService,
    HashingService,
    JwtService,
    redisProvider,
    sessionRepoProvider,
    SessionService,
    MfaService,
  ],
  controllers: [],
  exports: [
    PepperService,
    Argon2Service,
    EncryptionService,
    HashingService,
    JwtService,
    SessionService,
    MfaService,
    REDIS_TOKEN,
    SESSION_REPOSITORY_TOKEN,
  ],
})
export class AuthModule {}
