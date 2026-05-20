/**
 * apps/api/src/modules/auth/auth.module
 *
 * Sprint 5 Tache 2.1.6 -- wires AuthController + AuthService + JwtAuthGuard
 * onto the @insurtech/auth global services (Argon2Service, JwtService,
 * SessionService, HashingService, EncryptionService, PepperService).
 *
 * Sprint 6 will swap InMemoryUserRepository for the Postgres-backed impl.
 */

import { Module, type Provider } from '@nestjs/common';
import { AuthModule as InsurtechAuthModule } from '@insurtech/auth';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import {
  EMAIL_VERIFICATION_REPOSITORY_TOKEN,
  InMemoryEmailVerificationRepository,
} from './email-verification.repository.js';
import { EMAIL_SERVICE_TOKEN, StubEmailService } from './email.service.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { MfaRequiredGuard } from './guards/mfa-required.guard.js';
import { InMemoryUserRepository, USER_REPOSITORY_TOKEN } from './user.repository.js';

const userRepoProvider: Provider = {
  provide: USER_REPOSITORY_TOKEN,
  useClass: InMemoryUserRepository,
};

const emailVerifyRepoProvider: Provider = {
  provide: EMAIL_VERIFICATION_REPOSITORY_TOKEN,
  useClass: InMemoryEmailVerificationRepository,
};

const emailServiceProvider: Provider = {
  provide: EMAIL_SERVICE_TOKEN,
  useClass: StubEmailService,
};

@Module({
  imports: [InsurtechAuthModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtAuthGuard,
    MfaRequiredGuard,
    userRepoProvider,
    emailVerifyRepoProvider,
    emailServiceProvider,
  ],
  exports: [
    AuthService,
    JwtAuthGuard,
    MfaRequiredGuard,
    USER_REPOSITORY_TOKEN,
    EMAIL_VERIFICATION_REPOSITORY_TOKEN,
    EMAIL_SERVICE_TOKEN,
  ],
})
export class AuthModule {}
