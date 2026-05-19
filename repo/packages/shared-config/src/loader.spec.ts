import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadEnv, resetEnvCache } from './loader.js';

describe('loadEnv -- Tache 1.1.8', () => {
  beforeEach(() => {
    resetEnvCache();
    process.env['NODE_ENV'] = 'test';
    process.env['DATABASE_URL'] = 'postgresql://localhost:5432/test';
    process.env['REDIS_URL'] = 'redis://localhost:6379';
    process.env['KAFKA_BROKERS'] = 'localhost:9094';
    process.env['S3_ACCESS_KEY_ID'] = 'skaleantest';
    process.env['S3_SECRET_ACCESS_KEY'] = 'a'.repeat(20);
    process.env['JWT_SECRET'] = 'a'.repeat(32);
    process.env['JWT_REFRESH_SECRET'] = 'b'.repeat(32);
    process.env['MFA_SECRET_ENCRYPTION_KEY'] = 'c'.repeat(32);
    process.env['PASSWORD_PEPPER'] = 'd'.repeat(16);
  });

  it('should load valid env and return typed Env', () => {
    const env = loadEnv({ force: true, dotenvPath: '__non_existent_path__' });
    expect(env.NODE_ENV).toBe('test');
    expect(env.DATABASE_URL).toBe('postgresql://localhost:5432/test');
    expect(env.API_PORT).toBe(4000);
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.TZ).toBe('Africa/Casablanca');
  });

  it('should cache result on subsequent calls', () => {
    const env1 = loadEnv({ force: true, dotenvPath: '__non_existent_path__' });
    const env2 = loadEnv({ dotenvPath: '__non_existent_path__' });
    expect(env1).toBe(env2);
  });

  it('should parse KAFKA_BROKERS CSV to array', () => {
    process.env['KAFKA_BROKERS'] = 'k1:9092,k2:9092, k3:9092';
    resetEnvCache();
    const env = loadEnv({ force: true, dotenvPath: '__non_existent_path__' });
    expect(env.KAFKA_BROKERS).toEqual(['k1:9092', 'k2:9092', 'k3:9092']);
  });

  it('should parse Bool transformer correctly', () => {
    process.env['DATABASE_LOG'] = 'true';
    resetEnvCache();
    const env = loadEnv({ force: true, dotenvPath: '__non_existent_path__' });
    expect(env.DATABASE_LOG).toBe(true);

    process.env['DATABASE_LOG'] = 'false';
    resetEnvCache();
    const env2 = loadEnv({ force: true, dotenvPath: '__non_existent_path__' });
    expect(env2.DATABASE_LOG).toBe(false);
  });

  it('should coerce API_PORT string to number', () => {
    process.env['API_PORT'] = '5000';
    resetEnvCache();
    const env = loadEnv({ force: true, dotenvPath: '__non_existent_path__' });
    expect(env.API_PORT).toBe(5000);
    expect(typeof env.API_PORT).toBe('number');
  });

  it('should use defaults for optional fields', () => {
    delete process.env['LOG_LEVEL'];
    delete process.env['TZ'];
    resetEnvCache();
    const env = loadEnv({ force: true, dotenvPath: '__non_existent_path__' });
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.TZ).toBe('Africa/Casablanca');
    expect(env.SKALEAN_AI_USE_MOCK).toBe(true);
  });

  it('should use defaults for CORS_ORIGINS', () => {
    delete process.env['CORS_ORIGINS'];
    resetEnvCache();
    const env = loadEnv({ force: true, dotenvPath: '__non_existent_path__' });
    expect(env.CORS_ORIGINS).toContain('http://localhost:3000');
    expect(env.CORS_ORIGINS).toContain('http://localhost:3006');
  });
});

describe('Env validation errors -- Tache 1.1.8', () => {
  beforeEach(() => {
    resetEnvCache();
  });

  it('should reject DATABASE_URL with invalid format', () => {
    process.env['DATABASE_URL'] = 'not-a-url';
    process.env['JWT_SECRET'] = 'a'.repeat(32);
    process.env['JWT_REFRESH_SECRET'] = 'b'.repeat(32);
    process.env['MFA_SECRET_ENCRYPTION_KEY'] = 'c'.repeat(32);
    process.env['PASSWORD_PEPPER'] = 'd'.repeat(16);
    process.env['S3_ACCESS_KEY_ID'] = 'skaleantest';
    process.env['S3_SECRET_ACCESS_KEY'] = 'a'.repeat(20);
    process.env['REDIS_URL'] = 'redis://localhost:6379';
    process.env['KAFKA_BROKERS'] = 'localhost:9094';

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(
      (_code?: number | string | null): never => {
        throw new Error('process.exit called');
      },
    );

    expect(() => loadEnv({ force: true, dotenvPath: '__non_existent_path__' })).toThrow('process.exit called');

    exitSpy.mockRestore();
  });

  it('should reject JWT_SECRET < 32 chars', () => {
    process.env['JWT_SECRET'] = 'too-short';
    process.env['DATABASE_URL'] = 'postgresql://localhost:5432/test';
    process.env['REDIS_URL'] = 'redis://localhost:6379';
    process.env['KAFKA_BROKERS'] = 'localhost:9094';
    process.env['S3_ACCESS_KEY_ID'] = 'skaleantest';
    process.env['S3_SECRET_ACCESS_KEY'] = 'a'.repeat(20);
    process.env['JWT_REFRESH_SECRET'] = 'b'.repeat(32);
    process.env['MFA_SECRET_ENCRYPTION_KEY'] = 'c'.repeat(32);
    process.env['PASSWORD_PEPPER'] = 'd'.repeat(16);

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(
      (_code?: number | string | null): never => {
        throw new Error('process.exit called');
      },
    );
    expect(() => loadEnv({ force: true, dotenvPath: '__non_existent_path__' })).toThrow();
    exitSpy.mockRestore();
  });
});
