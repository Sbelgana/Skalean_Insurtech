/**
 * Chemins PII a masquer dans les logs Pino.
 *
 * Conformite CNDP Loi 09-08 article 17 : aucun PII expose dans les logs.
 * Les chemins suivent la syntaxe pino `redact.paths`.
 *
 * pino-http expose les objets de log avec les proprietes :
 *   - `req.*`  -- attributs de la requete HTTP entrante.
 *   - `res.*`  -- attributs de la reponse HTTP.
 *   - Champs metier root-level ou nested injectes via `customProps` ou `assign`.
 *
 * Reference : decision-006 (no-emoji) + CNDP loi 09-08.
 * Tache : 1.3.3 (Sprint 3 / Phase 1).
 */

/** Champs PII de base presents dans les objets metier. */
const SENSITIVE_FIELDS: readonly string[] = [
  'password',
  'passwordHash',
  'password_hash',
  'refreshToken',
  'refresh_token',
  'accessToken',
  'access_token',
  'apiKey',
  'api_key',
  'token',
  'secret',
  'cin',
  'phone',
  'phoneNumber',
  'phone_number',
  'email',
  'firstName',
  'first_name',
  'lastName',
  'last_name',
  'fullName',
  'full_name',
  'dateOfBirth',
  'date_of_birth',
  'address',
  'iban',
  'bankAccount',
  'creditCard',
];

/**
 * Chemins complets a masquer dans les logs Pino (format dot-notation).
 *
 * Inclut :
 *   - Champs root-level (ex : `password`).
 *   - Champs un niveau de profondeur (ex : `user.password`, `body.email`).
 *   - En-tetes HTTP sensibles via `req.*` (pino-http).
 */
export const PII_REDACT_PATHS: readonly string[] = [
  // Root-level -- champs PII directs dans le log object.
  ...SENSITIVE_FIELDS,

  // Un niveau de profondeur -- {user: {password}}, {body: {email}}, etc.
  ...SENSITIVE_FIELDS.map((f) => `*.${f}`),

  // En-tetes HTTP sensibles (pino-http : req et res dans l'objet log).
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-api-key"]',
  'res.headers["set-cookie"]',
];
