/**
 * Provider factory pour AppDataSource TypeORM.
 *
 * AppDataSource est defini dans @insurtech/database (Sprint 2 Tache 1.2.3).
 * Ce provider l'enveloppe en provider NestJS injectable via @Inject('DATA_SOURCE').
 *
 * Reference : decision-006 (no-emoji).
 * Tache : 1.3.2 (Sprint 3 / Phase 1).
 */
import type { Provider } from '@nestjs/common';
import { AppDataSource } from '@insurtech/database';
import type { DataSource } from '@insurtech/database';

export const DATA_SOURCE_TOKEN = 'DATA_SOURCE';

export const dataSourceProvider: Provider = {
  provide: DATA_SOURCE_TOKEN,
  useFactory: async (): Promise<DataSource> => {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
    return AppDataSource;
  },
};
