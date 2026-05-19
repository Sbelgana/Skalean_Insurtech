import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(__dirname, '../../..'); // src/entities/base -> packages/database

describe('database package structure', () => {
  const requiredDirs = [
    'src/entities/base',
    'src/entities/system',
    'src/entities/crm',
    'src/entities/booking',
    'src/entities/comm',
    'src/entities/docs',
    'src/entities/pay',
    'src/entities/books',
    'src/entities/compliance',
    'src/entities/analytics',
    'src/helpers',
    'src/types',
    'src/migrations',
    'src/subscribers',
  ];

  for (const dir of requiredDirs) {
    it(`dossier ${dir} existe`, () => {
      expect(existsSync(resolve(pkgRoot, dir))).toBe(true);
    });
  }

  const requiredFiles = [
    'src/entities/base/base-entity.ts',
    'src/entities/base/auditable-entity.ts',
    'src/entities/base/index.ts',
    'src/entities/index.ts',
    'src/helpers/with-tenant-context.ts',
    'src/helpers/with-super-admin.ts',
    'src/helpers/index.ts',
    'src/types/tenant-context.ts',
    'src/types/index.ts',
    'src/cli-data-source.ts',
    'src/data-source.ts',
    'src/index.ts',
  ];

  for (const file of requiredFiles) {
    it(`fichier ${file} existe`, () => {
      expect(existsSync(resolve(pkgRoot, file))).toBe(true);
    });
  }

  it('BaseEntity exporte class abstraite', async () => {
    const { BaseEntity } = await import('./base-entity.js');
    expect(BaseEntity).toBeDefined();
  });

  it('AuditableEntity exporte class abstraite', async () => {
    const { AuditableEntity } = await import('./auditable-entity.js');
    expect(AuditableEntity).toBeDefined();
  });

  it('TenantContext interface correctement typee', () => {
    const ctx = {
      tenantId: 'abc',
      userId: null,
      assureUserId: null,
      isSuperAdmin: false,
    };
    expect(ctx.tenantId).toBe('abc');
    expect(ctx.isSuperAdmin).toBe(false);
  });
});
