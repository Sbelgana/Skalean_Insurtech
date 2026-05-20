/**
 * SecurityModule -- module NestJS pour le pattern "secure by default".
 *
 * Enregistre PublicEndpointGuard comme APP_GUARD global.
 * Toutes les routes de l'API sont protegees par defaut ;
 * les routes publiques (health probes, Swagger, auth) utilisent @Public().
 *
 * Evolution prevue :
 *   - Sprint 3 (actuel) : guard passe-tout (infrastructure uniquement).
 *   - Sprint 5 : guard valide le JWT Bearer via jose.
 *     Module sera enrichi avec JwtStrategy, PassportModule, etc.
 *
 * Ce module est @Global() pour que PublicEndpointGuard s'applique
 * a tous les modules metier sans import explicite.
 *
 * Reference : decision-006 (no-emoji).
 * Tache : 1.3.14 (Sprint 3 / Phase 1).
 */
import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PublicEndpointGuard } from '../guards/public-endpoint.guard';

@Global()
@Module({
  providers: [
    PublicEndpointGuard,
    {
      // APP_GUARD : applique PublicEndpointGuard a TOUTES les routes.
      // Avec ThrottlerRateLimitModule (aussi APP_GUARD), les deux gardes
      // sont executes en chaine : throttler → public-endpoint.
      provide: APP_GUARD,
      useClass: PublicEndpointGuard,
    },
  ],
  exports: [PublicEndpointGuard],
})
export class SecurityModule {}
