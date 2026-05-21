/**
 * @AnalystAllowed() : method-level decorator pour autoriser analyst_support read-only.
 *
 * Par defaut, sous @SuperAdminOnly, le SuperAdminGuard reject analyst_support sur
 * mutations (POST/PATCH/DELETE/PUT). Ajouter @AnalystAllowed sur method GET pour
 * confirm explicitement l'access analyst.
 *
 * Note : @AnalystAllowed est IMPLICITE sur GET sous @SuperAdminOnly. Ce decorator
 * sert surtout a tracer l'intention dans le code (audit + revues compliance).
 *
 * Reference : Sprint 6 / Tache 2.2.10.
 */

import { SetMetadata } from '@nestjs/common';
import { ANALYST_ALLOWED_KEY } from './metadata-keys.js';

export const AnalystAllowed = (): MethodDecorator =>
  SetMetadata(ANALYST_ALLOWED_KEY, true);
