/**
 * ErrorCodes -- catalogue centralise des codes d'erreur Skalean InsurTech.
 *
 * Utilise par ApiErrorResponses decorator (Swagger) et AllExceptionsFilter.
 * Format : { status: HTTP_STATUS, message: string_safe }
 *
 * Reference : decision-006 (no-emoji).
 * Tache : 1.3.9 (Sprint 3 / Phase 1).
 */

export interface ErrorCodeDef {
  status: number;
  message: string;
}

export const ErrorCodes = {
  // 400 Bad Request
  BAD_REQUEST: { status: 400, message: 'La requete est invalide.' },
  VALIDATION_ERROR: { status: 400, message: 'Les donnees soumises sont invalides.' },

  // 401 Unauthorized
  UNAUTHORIZED: { status: 401, message: 'Authentification requise.' },
  TOKEN_EXPIRED: { status: 401, message: 'Token expire. Veuillez vous reconnecter.' },
  TOKEN_INVALID: { status: 401, message: 'Token invalide.' },

  // 403 Forbidden
  FORBIDDEN: { status: 403, message: 'Acces refuse.' },
  INSUFFICIENT_PERMISSIONS: { status: 403, message: 'Permissions insuffisantes.' },

  // 404 Not Found
  NOT_FOUND: { status: 404, message: 'Ressource introuvable.' },
  TENANT_NOT_FOUND: { status: 404, message: 'Tenant introuvable.' },
  USER_NOT_FOUND: { status: 404, message: 'Utilisateur introuvable.' },

  // 409 Conflict
  CONFLICT: { status: 409, message: 'Conflit avec une ressource existante.' },
  DUPLICATE_ENTRY: { status: 409, message: 'Entree dupliquee.' },

  // 410 Gone
  GONE: { status: 410, message: 'Ressource supprimee.' },

  // 422 Unprocessable Entity
  UNPROCESSABLE_ENTITY: { status: 422, message: 'Entite non traitable.' },

  // 429 Too Many Requests
  TOO_MANY_REQUESTS: { status: 429, message: 'Trop de requetes. Veuillez reessayer plus tard.' },
  RATE_LIMIT_EXCEEDED: { status: 429, message: 'Limite de requetes depassee.' },

  // 500 Internal Server Error
  INTERNAL_SERVER_ERROR: { status: 500, message: 'Erreur interne. Veuillez reessayer.' },

  // 502 Bad Gateway
  BAD_GATEWAY: { status: 502, message: 'Service tiers indisponible.' },

  // 503 Service Unavailable
  SERVICE_UNAVAILABLE: { status: 503, message: 'Service temporairement indisponible.' },

  // 504 Gateway Timeout
  GATEWAY_TIMEOUT: { status: 504, message: 'Timeout du service amont.' },
} as const satisfies Record<string, ErrorCodeDef>;

export type ErrorCode = keyof typeof ErrorCodes;
