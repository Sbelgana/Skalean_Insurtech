/**
 * Helper : decode JWT depuis Authorization header pour middleware.
 *
 * Le middleware execute AVANT JwtAuthGuard, donc req.user n'est PAS encore set.
 * Cette function decode le JWT et retourne les claims pour la suite du middleware.
 *
 * Reference : Sprint 6 / Tache 2.2.2.
 */

import { UnauthorizedException } from '@nestjs/common';
import type { JwtPayload, JwtService } from '@insurtech/auth';
import type { FastifyRequest } from 'fastify';

/**
 * Extrait et verifie JWT depuis header Authorization.
 *
 * @returns JwtPayload si JWT present et valide, null si absent
 * @throws UnauthorizedException si JWT present mais invalide
 */
export function extractJwtFromRequest(
  req: FastifyRequest,
  jwtService: JwtService,
): JwtPayload | null {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    throw new UnauthorizedException({
      code: 'AUTH_HEADER_MALFORMED',
      message: 'Authorization header must be "Bearer <token>"',
    });
  }

  const token = parts[1];
  if (!token) {
    throw new UnauthorizedException({
      code: 'AUTH_TOKEN_MISSING',
      message: 'JWT token missing in Authorization header',
    });
  }

  try {
    return jwtService.verifyAccessToken(token);
  } catch (_err) {
    throw new UnauthorizedException({
      code: 'AUTH_TOKEN_INVALID',
      message: 'JWT verification failed',
    });
  }
}
