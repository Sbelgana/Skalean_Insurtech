/**
 * TenantContextModule -- Module Global NestJS exposant TenantContextService.
 *
 * Le @Global() decorator rend ce module accessible dans tous les modules NestJS
 * importeurs sans necessiter import explicite. Choix intentionnel : le service
 * est de l'infrastructure runtime au meme titre que ConfigService.
 *
 * Reference : Sprint 6 / Tache 2.2.1.
 */

import { Global, Module } from '@nestjs/common';
import { TenantContextService } from '../services/tenant-context.service.js';

@Global()
@Module({
  providers: [TenantContextService],
  exports: [TenantContextService],
})
export class TenantContextModule {}
