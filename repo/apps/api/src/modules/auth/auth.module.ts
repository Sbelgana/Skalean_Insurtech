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
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { InMemoryUserRepository, USER_REPOSITORY_TOKEN } from './user.repository.js';

const userRepoProvider: Provider = {
  provide: USER_REPOSITORY_TOKEN,
  useClass: InMemoryUserRepository,
};

@Module({
  imports: [InsurtechAuthModule],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, userRepoProvider],
  exports: [AuthService, JwtAuthGuard, USER_REPOSITORY_TOKEN],
})
export class AuthModule {}
