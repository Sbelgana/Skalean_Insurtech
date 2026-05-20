/**
 * ConfigModule -- module global qui valide et expose les variables environnement.
 *
 * Wraps @insurtech/shared-config/loadEnv() et expose ConfigService via DI.
 *
 * Convention :
 *   - @Global() rend ConfigService injectable depuis n'importe quel module
 *     sans imports redondants.
 *   - forRoot() appele dans AppModule (pattern dynamic module NestJS).
 *   - Validation Zod runtime au boot. Si fail, process.exit(1) avec details.
 *
 * Reference : decision-009 (Zod uniforme) + decision-006 (no-emoji).
 * Tache : 1.3.2 (Sprint 3 / Phase 1).
 */
import { Module, Global, type DynamicModule } from '@nestjs/common';
import { loadEnv, type Env } from '@insurtech/shared-config';
import { ConfigService } from './config.service';
import { ENV_TOKEN } from './env.constants';

@Global()
@Module({})
export class ConfigModule {
  /**
   * Charge et valide les env vars via Zod.
   * Retourne un DynamicModule qui expose ConfigService.
   *
   * Si on est dans le boot main.ts, loadEnv() a deja ete appele,
   * mais on re-valide ici pour les tests isoles qui instancient
   * ConfigModule sans passer par main.ts.
   */
  static forRoot(): DynamicModule {
    const env: Env = loadEnv();

    return {
      module: ConfigModule,
      providers: [
        {
          provide: ENV_TOKEN,
          useValue: env,
        },
        ConfigService,
      ],
      exports: [ConfigService, ENV_TOKEN],
      global: true,
    };
  }
}
