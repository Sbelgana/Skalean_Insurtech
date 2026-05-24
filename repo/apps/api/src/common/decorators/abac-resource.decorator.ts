/**
 * @AbacResource decorator -- Sprint 7 Tache 2.3.8.
 *
 * Declare le resource type evalue par AbacGuard sur cet endpoint + comment
 * extraire l'ID depuis la request.
 *
 * Usage standard :
 *   @AbacResource('crm_contact', (req) => req.params.id)
 *   @RequirePermission(Permission.CRM_CONTACTS_READ_OWN)
 *   @Get('/contacts/:id')
 *
 * idExtractor default : (req) => req.params.id (cas le plus courant).
 *
 * Reference : B-07 Tache 2.3.8.
 */

import { SetMetadata } from '@nestjs/common';
import type { AbacResourceType } from '@insurtech/auth';
import { ABAC_RESOURCE_KEY } from './metadata-keys.js';

export type AbacIdExtractor = (request: {
  params?: Record<string, unknown>;
  body?: Record<string, unknown>;
  query?: Record<string, unknown>;
}) => string | undefined;

export interface AbacResourceMetadata {
  readonly resourceType: AbacResourceType;
  readonly idExtractor: AbacIdExtractor;
}

const defaultIdExtractor: AbacIdExtractor = (req) => {
  const id = req.params?.['id'];
  return typeof id === 'string' ? id : undefined;
};

export const AbacResource = (
  resourceType: AbacResourceType,
  idExtractor: AbacIdExtractor = defaultIdExtractor,
): MethodDecorator & ClassDecorator =>
  SetMetadata<string, AbacResourceMetadata>(ABAC_RESOURCE_KEY, {
    resourceType,
    idExtractor,
  });
