/**
 * apps/api/src/modules/auth/auth.module
 *
 * Sprint 5 -- wires AuthController + AuthService + Guards + AuditAuthService
 * onto the @insurtech/auth global services. Uses in-memory repos for the
 * remaining persistent state ; Sprint 6 will swap them for Postgres-backed
 * impls.
 */

import { Module, type Provider } from '@nestjs/common';
import { AuthModule as InsurtechAuthModule } from '@insurtech/auth';
import {
  AuditAuthService,
  AUDIT_PUBLISHER_TOKEN,
  PinoAuditPublisher,
} from './audit-auth.service.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import {
  EMAIL_VERIFICATION_REPOSITORY_TOKEN,
  InMemoryEmailVerificationRepository,
} from './email-verification.repository.js';
import { EMAIL_SERVICE_TOKEN, StubEmailService } from './email.service.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { MfaRequiredGuard } from './guards/mfa-required.guard.js';
import {
  InMemoryPasswordRecoveryRepository,
  PASSWORD_RECOVERY_REPOSITORY_TOKEN,
} from './password-recovery.repository.js';
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

const recoveryRepoProvider: Provider = {
  provide: PASSWORD_RECOVERY_REPOSITORY_TOKEN,
  useClass: InMemoryPasswordRecoveryRepository,
};

const auditPublisherProvider: Provider = {
  provide: AUDIT_PUBLISHER_TOKEN,
  useClass: PinoAuditPublisher,
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
    recoveryRepoProvider,
    auditPublisherProvider,
    AuditAuthService,
  ],
  exports: [
    AuthService,
    JwtAuthGuard,
    MfaRequiredGuard,
    AuditAuthService,
    USER_REPOSITORY_TOKEN,
    EMAIL_VERIFICATION_REPOSITORY_TOKEN,
    EMAIL_SERVICE_TOKEN,
    PASSWORD_RECOVERY_REPOSITORY_TOKEN,
    AUDIT_PUBLISHER_TOKEN,
  ],
})
export class AuthModule {}
