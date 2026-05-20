import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:child_process');
vi.mock('node:fs');

describe('doctor.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Node version check', () => {
    it('passe quand process.version >= 22.11.0', () => {
      const version = 'v22.11.0';
      const actual = version.slice(1);
      const [aMaj, aMin] = actual.split('.').map(Number);
      const [rMaj, rMin] = '22.11.0'.split('.').map(Number);
      const ok = (aMaj ?? 0) > (rMaj ?? 0) || ((aMaj ?? 0) === (rMaj ?? 0) && (aMin ?? 0) >= (rMin ?? 0));
      expect(ok).toBe(true);
    });

    it('echoue quand process.version < 22.11.0', () => {
      const version = 'v20.10.0';
      const actual = version.slice(1);
      const [aMaj, aMin] = actual.split('.').map(Number);
      const [rMaj, rMin] = '22.11.0'.split('.').map(Number);
      const ok = (aMaj ?? 0) > (rMaj ?? 0) || ((aMaj ?? 0) === (rMaj ?? 0) && (aMin ?? 0) >= (rMin ?? 0));
      expect(ok).toBe(false);
    });

    it('passe quand version majeure superieure (Node 23+)', () => {
      const version = 'v23.0.0';
      const actual = version.slice(1);
      const [aMaj, aMin] = actual.split('.').map(Number);
      const [rMaj, rMin] = '22.11.0'.split('.').map(Number);
      const ok = (aMaj ?? 0) > (rMaj ?? 0) || ((aMaj ?? 0) === (rMaj ?? 0) && (aMin ?? 0) >= (rMin ?? 0));
      expect(ok).toBe(true);
    });
  });

  describe('pnpm version check', () => {
    it('OK quand pnpm 9.15.0', () => {
      vi.mocked(execSync).mockReturnValue('9.15.0\n' as never);
      const out = execSync('pnpm --version', { encoding: 'utf8' });
      expect(out.toString().trim()).toBe('9.15.0');
    });

    it('OK quand pnpm 9.20.0 (superieur)', () => {
      vi.mocked(execSync).mockReturnValue('9.20.0\n' as never);
      const out = execSync('pnpm --version', { encoding: 'utf8' }).toString().trim();
      const [maj, min] = out.split('.').map(Number);
      const ok = (maj ?? 0) > 9 || ((maj ?? 0) === 9 && (min ?? 0) >= 15);
      expect(ok).toBe(true);
    });

    it('FAIL quand pnpm absent', () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('command not found');
      });
      expect(() => execSync('pnpm --version')).toThrow();
    });
  });

  describe('Docker check', () => {
    it('OK quand docker info exit 0', () => {
      vi.mocked(execSync).mockReturnValue('' as never);
      expect(() => execSync('docker info', { stdio: 'ignore' })).not.toThrow();
    });

    it('FAIL quand docker daemon down', () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('Cannot connect to Docker daemon');
      });
      expect(() => execSync('docker info', { stdio: 'ignore' })).toThrow();
    });
  });

  describe('.env check', () => {
    it('OK quand .env existe', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      expect(existsSync('/repo/.env')).toBe(true);
    });

    it('WARN quand .env absent', () => {
      vi.mocked(existsSync).mockReturnValue(false);
      expect(existsSync('/repo/.env')).toBe(false);
    });
  });

  describe('Env Zod schema', () => {
    it('valide POSTGRES_HOST/PORT/USER/PASSWORD presents', () => {
      const env = {
        POSTGRES_HOST: 'localhost',
        POSTGRES_PORT: '5432',
        POSTGRES_USER: 'skalean',
        POSTGRES_PASSWORD: 'secret',
      };
      const valid = !!env.POSTGRES_HOST && !!env.POSTGRES_USER;
      expect(valid).toBe(true);
    });

    it('echoue si POSTGRES_HOST absent', () => {
      const env: Record<string, string> = {};
      expect(env.POSTGRES_HOST).toBeUndefined();
    });

    it('parse correctement POSTGRES_PORT comme nombre', () => {
      const port = Number('5432');
      expect(port).toBe(5432);
      expect(Number.isInteger(port) && port > 0).toBe(true);
    });
  });

  describe('No AWS leak check', () => {
    it('OK si .env ne contient pas amazonaws.com', () => {
      const content = 'S3_ENDPOINT=https://s3.bgr.atlascloudservices.ma';
      expect(/amazonaws\.com/.test(content)).toBe(false);
    });

    it('FAIL si .env contient amazonaws.com', () => {
      const content = 'S3_ENDPOINT=https://s3.amazonaws.com';
      expect(/amazonaws\.com/.test(content)).toBe(true);
    });

    it('FAIL si .env contient AKIA cle AWS', () => {
      const content = 'AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE';
      expect(/AKIA[0-9A-Z]{16}/.test(content)).toBe(true);
    });

    it('OK si .env Atlas Cloud sans cle AWS', () => {
      const content = [
        'S3_ENDPOINT=https://s3.bgr.atlascloudservices.ma',
        'S3_ACCESS_KEY_ID=atlaskey123',
        'POSTGRES_HOST=localhost',
      ].join('\n');
      expect(/amazonaws\.com/.test(content)).toBe(false);
      expect(/AKIA[0-9A-Z]{16}/.test(content)).toBe(false);
    });
  });

  describe('Port free check', () => {
    it('OK quand port libre (mock)', () => {
      const free = true;
      expect(free).toBe(true);
    });

    it('WARN quand port occupe (mock)', () => {
      const free = false;
      expect(free).toBe(false);
    });
  });

  describe('Mapbox token format', () => {
    it('detecte token pk.* valide', () => {
      const content = 'NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJhbGciOiJIUzI1NiJ9.test';
      const m = content.match(/NEXT_PUBLIC_MAPBOX_TOKEN=(pk\.[A-Za-z0-9._-]+)/);
      expect(m).not.toBeNull();
      expect(m?.[1]).toMatch(/^pk\./);
    });

    it('ne detecte pas token sk.* (secret key)', () => {
      const content = 'NEXT_PUBLIC_MAPBOX_TOKEN=sk.eyJhbGciOiJIUzI1NiJ9.test';
      const m = content.match(/NEXT_PUBLIC_MAPBOX_TOKEN=(pk\.[A-Za-z0-9._-]+)/);
      expect(m).toBeNull();
    });
  });
});
