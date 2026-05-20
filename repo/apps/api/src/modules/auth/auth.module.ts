/**
 * apps/api/src/modules/auth/auth.module
 *
 * Sprint 5 closure -- wires AuthController + AuthService + Guards +
 * AuditAuthService onto the @insurtech/auth global services.
 *
 * Repository swap : when env USE_POSTGRES_REPOS=1, switches User /
 * EmailVerification / PasswordRecovery repositories to their Postgres-backed
 * impl (via @insurtech/database AppDataSource). Defaults to in-memory impls
 * for unit tests and dev without Postgres.
 *
 * EmailService swap : NodemailerEmailAdapter when SMTP_HOST is set, otherwise
 * StubEmailService.
 */

import { Module, type Provider } from '@nestjs/common';
import { AuthModule as InsurtechAuthModule } from '@insurtech/auth';
import { dataSourceProvider } from '../../database/data-source.provider.js';
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
import {
  EMAIL_SERVICE_TOKEN,
  NodemailerEmailAdapter,
  StubEmailService,
} from './email.service.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { MfaRequiredGuard } from './guards/mfa-required.guard.js';
import {
  InMemoryPasswordRecoveryRepository,
  PASSWORD_RECOVERY_REPOSITORY_TOKEN,
} from './password-recovery.repository.js';
import { PostgresEmailVerificationRepository } from './postgres-email-verification.repository.js';
import { PostgresPasswordRecoveryRepository } from './postgres-password-recovery.repository.js';
import { PostgresUserRepository } from './postgres-user.repository.js';
import { InMemoryUserRepository, USER_REPOSITORY_TOKEN } from './user.repository.js';

const usePostgres = process.env['USE_POSTGRES_REPOS'] === '1';

const userRepoProvider: Provider = {
  provide: USER_REPOSITORY_TOKEN,
  useClass: usePostgres ? PostgresUserRepository : InMemoryUserRepository,
};

const emailVerifyRepoProvider: Provider = {
  provide: EMAIL_VERIFICATION_REPOSITORY_TOKEN,
  useClass: usePostgres
    ? PostgresEmailVerificationRepository
    : InMemoryEmailVerificationRepository,
};

const recoveryRepoProvider: Provider = {
  provide: PASSWORD_RECOVERY_REPOSITORY_TOKEN,
  useClass: usePostgres
    ? PostgresPasswordRecoveryRepository
    : InMemoryPasswordRecoveryRepository,
};

const emailServiceProvider: Provider = {
  provide: EMAIL_SERVICE_TOKEN,
  useClass: process.env['SMTP_HOST'] ? NodemailerEmailAdapter : StubEmailService,
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
    ...(usePostgres ? [dataSourceProvider] : []),
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
