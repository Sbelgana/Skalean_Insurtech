/**
 * @insurtech/auth
 *
 * Public API of the auth package. Root barrel re-exporting curated sub-barrels.
 * The wildcard re-export here is acceptable because each sub-barrel is itself selectif.
 */

export * from './types/index.js';
export * from './schemas/index.js';
export * from './constants/index.js';
export { AuthModule } from './auth.module.js';

export const AUTH_PACKAGE_VERSION = '0.1.0';
