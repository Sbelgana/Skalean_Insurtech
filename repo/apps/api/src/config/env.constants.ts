/**
 * Tokens DI pour ConfigModule.
 *
 * Reference : decision-006 (no-emoji).
 * Tache : 1.3.2 (Sprint 3 / Phase 1).
 */

/**
 * Token DI pour injecter l'objet env complet via @Inject(ENV_TOKEN).
 * Usage typique : ConfigService consomme ce token.
 * Pour les services metier, preferer ConfigService.get('VAR_NAME').
 */
export const ENV_TOKEN = Symbol('ENV_TOKEN');
