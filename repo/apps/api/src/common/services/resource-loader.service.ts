/**
 * ResourceLoaderService -- Sprint 7 Tache 2.3.8.
 *
 * Charge une ressource depuis sa source (DB / external) pour evaluer ABAC.
 * Pattern delegateur : chaque AbacResourceType est mappe a une fonction de
 * chargement (loader). Les modules metier (CRM Sprint 8, Insure Sprint 14,
 * etc.) enregistreront leurs loaders via registerLoader().
 *
 * Cache Redis 1min : Sprint 7 Tache 2.3.10 ajoutera invalidation distribuee.
 * Pour Sprint 7 Tache 2.3.8, in-process LRU Map suffit (eviction simple).
 *
 * Reference : B-07 Tache 2.3.8.
 */

import { Injectable, Logger } from '@nestjs/common';
import type { AbacResourceType } from '@insurtech/auth';

export interface LoadedResource {
  readonly id: string;
  readonly ownerId?: string;
  readonly assigneeId?: string;
  readonly status?: string;
  readonly createdAt?: Date;
  readonly metadata?: Record<string, unknown>;
}

export type ResourceLoader = (
  id: string,
  tenantId: string | undefined,
) => Promise<LoadedResource | undefined>;

const CACHE_TTL_MS = 60_000;
const MAX_CACHE_ENTRIES = 1000;

@Injectable()
export class ResourceLoaderService {
  private readonly logger = new Logger(ResourceLoaderService.name);
  private readonly loaders = new Map<AbacResourceType, ResourceLoader>();
  private readonly cache = new Map<string, { value: LoadedResource; expiresAt: number }>();

  registerLoader(resourceType: AbacResourceType, loader: ResourceLoader): void {
    this.loaders.set(resourceType, loader);
    this.logger.log(`registered loader for resourceType=${resourceType}`);
  }

  getRegisteredResourceTypes(): readonly AbacResourceType[] {
    return Array.from(this.loaders.keys());
  }

  async load(
    resourceType: AbacResourceType,
    id: string,
    tenantId: string | undefined,
  ): Promise<LoadedResource | undefined> {
    const cacheKey = `${tenantId ?? '_'}:${resourceType}:${id}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const loader = this.loaders.get(resourceType);
    if (!loader) {
      this.logger.warn(`no loader registered for resourceType=${resourceType}`);
      return undefined;
    }

    const resource = await loader(id, tenantId);
    if (resource) {
      this.cacheSet(cacheKey, resource);
    }
    return resource;
  }

  invalidate(resourceType: AbacResourceType, id: string, tenantId: string | undefined): void {
    const key = `${tenantId ?? '_'}:${resourceType}:${id}`;
    this.cache.delete(key);
  }

  invalidateAll(): void {
    this.cache.clear();
  }

  private cacheSet(key: string, value: LoadedResource): void {
    if (this.cache.size >= MAX_CACHE_ENTRIES) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) this.cache.delete(firstKey);
    }
    this.cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  }
}
