/**
 * ConfigService -- type-safe access aux variables environnement valides Zod.
 *
 * Usage :
 *   constructor(private readonly config: ConfigService) {}
 *   const port = this.config.get('API_PORT'); // type number, autocompletion
 *   const env = this.config.get('NODE_ENV');  // type 'development' | 'staging' | 'production'
 *
 * Reference : decision-009 (Zod uniforme) + decision-006 (no-emoji).
 * Tache : 1.3.2 (Sprint 3 / Phase 1).
 */
import { Inject, Injectable } from '@nestjs/common';
import type { Env } from '@insurtech/shared-config';
import { ENV_TOKEN } from './env.constants';

@Injectable()
export class ConfigService {
  constructor(@Inject(ENV_TOKEN) private readonly env: Env) {}

  /**
   * Retourne la valeur typee d'une env var.
   * Generic K extends keyof Env permet autocomplete + type-inference.
   *
   * @example
   *   const port = this.config.get('API_PORT'); // number
   *   const dbUrl = this.config.get('DATABASE_URL'); // string
   */
  get<K extends keyof Env>(key: K): Env[K] {
    return this.env[key];
  }

  /**
   * Retourne un sous-ensemble de l'env (par prefix).
   * Utile pour passer un sous-objet a un module.
   *
   * @example
   *   const dbConfig = this.config.getByPrefix('DATABASE_');
   *   // { DATABASE_URL: '...', DATABASE_POOL_MIN: 2, ... }
   */
  getByPrefix<P extends string>(prefix: P): Partial<Env> {
    const result: Partial<Env> = {};
    for (const key of Object.keys(this.env)) {
      if (key.startsWith(prefix)) {
        // @ts-expect-error -- key is dynamically typed but safe.
        result[key] = this.env[key as keyof Env];
      }
    }
    return result;
  }

  /**
   * Verifie si on est en production.
   */
  isProduction(): boolean {
    return this.env.NODE_ENV === 'production';
  }

  /**
   * Verifie si on est en development.
   */
  isDevelopment(): boolean {
    return this.env.NODE_ENV === 'development';
  }

  /**
   * Verifie si on est en staging.
   */
  isStaging(): boolean {
    return this.env.NODE_ENV === 'staging';
  }

  /**
   * Verifie si on est en test (Vitest).
   */
  isTest(): boolean {
    return this.env.NODE_ENV === 'test';
  }

  /**
   * Retourne l'objet env complet (read-only).
   * Reserve aux usages avances (tests, debug, audit).
   */
  getAll(): Readonly<Env> {
    return Object.freeze({ ...this.env });
  }
}
