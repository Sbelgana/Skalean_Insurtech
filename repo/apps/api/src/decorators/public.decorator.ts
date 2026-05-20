/**
 * @Public() -- decorateur pour marquer les routes accessibles sans authentification.
 *
 * Pattern "secure by default" :
 *   - TOUTES les routes sont protegees par defaut (JWT obligatoire, Sprint 5+).
 *   - @Public() exempte explicitement une route de l'authentification.
 *
 * Usage :
 *   @Public()
 *   @Get('/healthz')
 *   getHealth() { ... }
 *
 *   @Public()
 *   @Controller('auth')
 *   class AuthController { ... }  // Toute la classe est publique
 *
 * IS_PUBLIC_KEY est expose pour permettre a PublicEndpointGuard de lire le metadata.
 *
 * Reference : decision-006 (no-emoji).
 * Tache : 1.3.14 (Sprint 3 / Phase 1).
 */
import { SetMetadata } from '@nestjs/common';

/** Cle metadata utilisee par PublicEndpointGuard via Reflector. */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marque un endpoint ou un controller comme public (pas d'authentification requise).
 *
 * Applique le metadata `isPublic: true` sur le handler ou le controller.
 * PublicEndpointGuard lit ce metadata pour decider si la route est exemptee.
 *
 * @example
 * // Endpoint public (health probe, Swagger UI, endpoint auth)
 * @Public()
 * @Get('/healthz')
 * getHealth() {}
 *
 * @example
 * // Controller entier public
 * @Public()
 * @Controller('auth')
 * class AuthController {}
 */
export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_PUBLIC_KEY, true);
