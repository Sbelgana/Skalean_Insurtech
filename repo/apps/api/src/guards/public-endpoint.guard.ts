/**
 * PublicEndpointGuard -- garde "secure by default" (infrastructure Sprint 3).
 *
 * Principe :
 *   - TOUTES les routes sont protegees par defaut.
 *   - Les routes decorees avec @Public() sont exemptees de l'authentification.
 *   - Sprint 3 : le guard laisse passer toutes les requetes (pas encore de JWT).
 *   - Sprint 5 : ce guard sera enrichi pour valider le JWT (jose) sur les routes
 *     non-@Public(). Il levera UnauthorizedException si le token est absent/invalide.
 *
 * Enregistre comme APP_GUARD dans SecurityModule pour proteger toutes les routes.
 *
 * Implementation via Reflector.getAllAndOverride() :
 *   - Verifie d'abord le handler (methode), puis le controller (classe).
 *   - Si IS_PUBLIC_KEY = true sur l'un ou l'autre, la route est publique.
 *
 * Reference : decision-006 (no-emoji).
 * Tache : 1.3.14 (Sprint 3 / Phase 1).
 */
import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class PublicEndpointGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  /**
   * Autorise ou bloque la requete selon le decorateur @Public().
   *
   * Sprint 3 :
   *   - Route @Public() → true (autorisee).
   *   - Route non-@Public() → true (passe en Sprint 3, JWT absent).
   *
   * Sprint 5 (TODO) :
   *   - Route non-@Public() → valide le Bearer token JWT via jose.
   *   - Leve UnauthorizedException si token absent, expire ou invalide.
   *
   * @param context - Contexte d'execution NestJS (HTTP / WS / RPC).
   * @returns true si la requete est autorisee, false sinon (ou exception).
   */
  canActivate(context: ExecutionContext): boolean {
    // Lit le metadata @Public() sur le handler ou le controller.
    // getAllAndOverride : handler (methode) prend precedence sur controller (classe).
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Route explicitement marquee comme publique : toujours autorisee.
    if (isPublic === true) {
      return true;
    }

    // TODO Sprint 5 : routes non-publiques → validation JWT obligatoire.
    // Pour l'instant en Sprint 3 : pass-through (infrastructure uniquement).
    // Remplacer ce `return true` par la logique JWT quand disponible.
    return true;
  }
}
