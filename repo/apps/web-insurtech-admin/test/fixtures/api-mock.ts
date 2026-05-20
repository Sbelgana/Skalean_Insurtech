/**
 * API mock helpers -- web-insurtech-admin
 * Reference : task-1.4.4 Sprint 4 Phase 1
 */

export const mockApiResponses = {
  health: { status: 'ok', timestamp: new Date().toISOString() },
  tenants: { data: [], meta: { total: 0, page: 1 } },
  monitoring: { data: [], meta: { total: 0, page: 1 } },
};

export const mockApiErrors = {
  unauthorized: { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentification requise', statusCode: 401 } },
  forbidden: { success: false, error: { code: 'FORBIDDEN', message: 'Acces refuse', statusCode: 403 } },
  notFound: { success: false, error: { code: 'NOT_FOUND', message: 'Ressource introuvable', statusCode: 404 } },
  serverError: { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Erreur serveur', statusCode: 500 } },
};
