/**
 * Tests ConfigModule -- valide que ConfigModule charge et expose ConfigService
 * avec acces type-safe aux variables environnement.
 *
 * Note : loadEnv() appelle process.exit(1) sur validation failure (pas throw).
 * Les tests de validation failure mockent process.exit et resetEnvCache().
 *
 * Reference : decision-006 (no-emoji).
 * Tache : 1.3.2 (Sprint 3 / Phase 1).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigModule } from './config.module';
import { ConfigService } from './config.service';
import { ENV_TOKEN } from './env.constants';
import {
  applyEnvFixture,
  clearEnvFixture,
  VALID_ENV_FIXTURE,
} from '../../test/fixtures/env-fixtures';
import { resetEnvCache } from '@insurtech/shared-config';

describe('ConfigModule', () => {
  let module: TestingModule;

  beforeEach(() => {
    resetEnvCache();
    applyEnvFixture(VALID_ENV_FIXTURE);
  });

  afterEach(async () => {
    if (module) await module.close();
    clearEnvFixture(VALID_ENV_FIXTURE);
    resetEnvCache();
    vi.restoreAllMocks();
  });

  it('charge ConfigService via DI', async () => {
    module = await Test.createTestingModule({
      imports: [ConfigModule.forRoot()],
    }).compile();

    const config = module.get(ConfigService);
    expect(config).toBeInstanceOf(ConfigService);
  });

  it('ConfigService.get(API_PORT) retourne number 14000', async () => {
    module = await Test.createTestingModule({
      imports: [ConfigModule.forRoot()],
    }).compile();

    const config = module.get(ConfigService);
    expect(config.get('API_PORT')).toBe(14000);
    expect(typeof config.get('API_PORT')).toBe('number');
  });

  it('ConfigService.get(NODE_ENV) retourne test', async () => {
    module = await Test.createTestingModule({
      imports: [ConfigModule.forRoot()],
    }).compile();

    const config = module.get(ConfigService);
    expect(config.get('NODE_ENV')).toBe('test');
  });

  it('ConfigService.isTest() retourne true en NODE_ENV=test', async () => {
    module = await Test.createTestingModule({
      imports: [ConfigModule.forRoot()],
    }).compile();

    const config = module.get(ConfigService);
    expect(config.isTest()).toBe(true);
    expect(config.isProduction()).toBe(false);
    expect(config.isDevelopment()).toBe(false);
    expect(config.isStaging()).toBe(false);
  });

  it('ConfigService.getByPrefix(DATABASE_) retourne uniquement les vars DATABASE_', async () => {
    module = await Test.createTestingModule({
      imports: [ConfigModule.forRoot()],
    }).compile();

    const config = module.get(ConfigService);
    const dbConfig = config.getByPrefix('DATABASE_');
    expect(Object.keys(dbConfig).every((k) => k.startsWith('DATABASE_'))).toBe(true);
    expect(Object.keys(dbConfig).length).toBeGreaterThan(0);
  });

  it('ConfigService.getAll() retourne objet readonly frozen', async () => {
    module = await Test.createTestingModule({
      imports: [ConfigModule.forRoot()],
    }).compile();

    const config = module.get(ConfigService);
    const all = config.getAll();
    expect(Object.isFrozen(all)).toBe(true);
  });

  it('ConfigModule expose ENV_TOKEN via DI', async () => {
    module = await Test.createTestingModule({
      imports: [ConfigModule.forRoot()],
    }).compile();

    const env = module.get(ENV_TOKEN);
    expect(env).toBeDefined();
    expect(typeof env).toBe('object');
  });

  it('echoue avec process.exit(1) si DATABASE_URL malforme', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    clearEnvFixture(VALID_ENV_FIXTURE);
    // Re-appliquer toutes les vars sauf DATABASE_URL
    applyEnvFixture(VALID_ENV_FIXTURE);
    process.env['DATABASE_URL'] = 'not-a-valid-url';
    resetEnvCache();

    ConfigModule.forRoot();

    expect(exitSpy).toHaveBeenCalledWith(1);
    // Restaurer etat pour afterEach
    process.env['DATABASE_URL'] = VALID_ENV_FIXTURE['DATABASE_URL'] as string;
    resetEnvCache();
  });

  it('echoue avec process.exit(1) si API_PORT non-numerique', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    applyEnvFixture(VALID_ENV_FIXTURE);
    process.env['API_PORT'] = 'abc';
    resetEnvCache();

    ConfigModule.forRoot();

    expect(exitSpy).toHaveBeenCalledWith(1);
    process.env['API_PORT'] = VALID_ENV_FIXTURE['API_PORT'] as string;
    resetEnvCache();
  });

  it('ConfigService.get(REDIS_URL) retourne une string URL', async () => {
    module = await Test.createTestingModule({
      imports: [ConfigModule.forRoot()],
    }).compile();

    const config = module.get(ConfigService);
    const redisUrl = config.get('REDIS_URL');
    expect(typeof redisUrl).toBe('string');
    expect(redisUrl.length).toBeGreaterThan(0);
  });
});
