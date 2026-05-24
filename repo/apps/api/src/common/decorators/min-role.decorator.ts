/**
 * @MinRole decorator -- Sprint 7 Tache 2.3.4.
 *
 * Exige le role specifie OU n'importe lequel de ses ancetres dans la hierarchie.
 *
 * Exemple : @MinRole(AuthRole.BrokerUser) accepte :
 *   - broker_user (lui-meme)
 *   - broker_admin (parent direct dans RoleHierarchy)
 *   - super_admin_platform (wildcard, toujours OK)
 *
 * Usage :
 *   @MinRole(AuthRole.BrokerUser)
 *   @Get('/broker/quotes')
 *
 * Compose avec RoleGuard. La resolution des ancetres est calculee a partir du
 * RoleHierarchy DAG (relation parent -> enfants : broker_admin -> [broker_user])
 * par recherche reverse au boot ou cached dans le guard.
 *
 * Reference : B-07 Tache 2.3.4.
 */

import { SetMetadata } from '@nestjs/common';
import type { AuthRole } from '@insurtech/auth';
import { MIN_ROLE_KEY } from './metadata-keys.js';

/**
 * Decorator @MinRole(role) : accepte role + tous ses ancetres dans la hierarchie.
 * Class-level ou method-level.
 */
export const MinRole = (role: AuthRole): MethodDecorator & ClassDecorator =>
  SetMetadata(MIN_ROLE_KEY, role);
