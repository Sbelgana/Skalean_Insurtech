/**
 * DatabaseModule -- module global qui re-expose AppDataSource via DI NestJS.
 *
 * AppDataSource est defini dans @insurtech/database (Sprint 2 Tache 1.2.3).
 * Ce module l'enveloppe en provider NestJS injectable via @Inject('DATA_SOURCE').
 *
 * Convention :
 *   - @Global() rend AppDataSource injectable cross-module.
 *   - useFactory async permet d'attendre AppDataSource.initialize() si pas deja.
 *   - onModuleDestroy chaine AppDataSource.destroy() pour graceful shutdown.
 *
 * Reference : decision-003 (NestJS) + decision-006 (no-emoji).
 * Tache : 1.3.2 (Sprint 3 / Phase 1).
 */
import { Module, Global, type OnModuleDestroy, Inject } from '@nestjs/common';
import { dataSourceProvider, DATA_SOURCE_TOKEN } from './data-source.provider';
import type { DataSource } from '@insurtech/database';

@Global()
@Module({
  providers: [dataSourceProvider],
  exports: [DATA_SOURCE_TOKEN],
})
export class DatabaseModule implements OnModuleDestroy {
  constructor(@Inject(DATA_SOURCE_TOKEN) private readonly dataSource: DataSource) {}

  async onModuleDestroy(): Promise<void> {
    if (this.dataSource.isInitialized) {
      await this.dataSource.destroy();
    }
  }
}
