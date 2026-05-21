/**
 * @SuperAdminWrite() : method-level decorator pour writes restricted super_admin_platform.
 *
 * Enforce par SuperAdminGuard : analyst_support reject 403 ANALYST_READ_ONLY meme
 * pour HTTP method non-mutation. Utile pour endpoints sensibles qui exigent
 * super_admin_platform explicite (ex: revoke session, delete user, force migration).
 *
 * Reference : Sprint 6 / Tache 2.2.10.
 */

import { SetMetadata } from '@nestjs/common';
import { SUPER_ADMIN_WRITE_KEY } from './metadata-keys.js';

export const SuperAdminWrite = (): MethodDecorator =>
  SetMetadata(SUPER_ADMIN_WRITE_KEY, true);
