import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../..');
const POSTGRES_DIR = join(REPO_ROOT, 'infrastructure/docker/postgres');

describe('Postgres init files structure -- Tache 1.1.4', () => {
  const REQUIRED_FILES = [
    'init.sh',
    '001-init-extensions.sql',
    '002-init-tenant-rls-helpers.sql',
    '003-init-databases.sql',
    '004-init-roles-grants.sql',
  ];

  it.each(REQUIRED_FILES)('should have file %s', (file) => {
    expect(existsSync(join(POSTGRES_DIR, file))).toBe(true);
  });

  it('001-init-extensions.sql should declare 5 extensions', () => {
    const content = readFileSync(join(POSTGRES_DIR, '001-init-extensions.sql'), 'utf-8');
    const extensions = ['pgcrypto', 'pg_trgm', 'btree_gist', 'unaccent', 'citext'];
    for (const ext of extensions) {
      expect(content).toContain(`CREATE EXTENSION IF NOT EXISTS "${ext}"`);
    }
  });

  it('002-init-tenant-rls-helpers.sql should define 6 helpers', () => {
    const content = readFileSync(join(POSTGRES_DIR, '002-init-tenant-rls-helpers.sql'), 'utf-8');
    const helpers = [
      'app_current_tenant',
      'app_current_user_id',
      'app_is_super_admin',
      'app_assure_user_id',
      'app_cross_tenant_authorization_id',
      'app_can_access_tenant',
    ];
    for (const helper of helpers) {
      expect(content).toContain(`FUNCTION ${helper}`);
    }
  });

  it('all helpers should be STABLE PARALLEL SAFE', () => {
    const content = readFileSync(join(POSTGRES_DIR, '002-init-tenant-rls-helpers.sql'), 'utf-8');
    const stableMatches = content.match(/STABLE/g) ?? [];
    const parallelSafeMatches = content.match(/PARALLEL SAFE/g) ?? [];
    expect(stableMatches.length).toBeGreaterThanOrEqual(6);
    expect(parallelSafeMatches.length).toBeGreaterThanOrEqual(6);
  });

  it('all helpers should have COMMENT ON FUNCTION', () => {
    const content = readFileSync(join(POSTGRES_DIR, '002-init-tenant-rls-helpers.sql'), 'utf-8');
    const commentMatches = content.match(/COMMENT ON FUNCTION/g) ?? [];
    expect(commentMatches.length).toBeGreaterThanOrEqual(6);
  });

  it('no emoji in init scripts', () => {
    const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u;
    for (const file of REQUIRED_FILES) {
      const content = readFileSync(join(POSTGRES_DIR, file), 'utf-8');
      expect(content, `Emoji found in ${file}`).not.toMatch(emojiRegex);
    }
  });
});
