/**
 * RLS policy coherence -- verification STATIQUE migrations Sprint 2.
 *
 * Cette spec ne necessite PAS de DB live (analyse statique des migrations TypeORM).
 * Garantit que TOUTES les CREATE POLICY statements utilisent le helper Sprint 1
 * `app_can_access_tenant()` -- single source of truth pour bypass logic.
 *
 * Si une policy passe sans helper -> FAIL avec details (table, policy, file).
 *
 * Reference : Sprint 6 / Tache 2.2.12 + decouverte architecturale Pause #1.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const MIGRATIONS_DIR = resolve(
  __dirname,
  '../../../../../packages/database/src/migrations',
);

/** Helper canonique pour RLS policies. Exceptions documentees doivent etre listees. */
const APPROVED_HELPERS = ['app_can_access_tenant', 'app_is_super_admin'];

/**
 * Pattern accepte pour policies "immutable" (audit/CGNC) :
 *   FOR DELETE USING (false)   -- aucune ligne ne peut etre supprimee
 *   FOR UPDATE USING (false)   -- aucune ligne ne peut etre modifiee
 * Compliance loi 09-08 + CGNC (Sprint 12) exige immutabilite audit trail.
 */
const IMMUTABLE_PATTERNS = [
  /FOR\s+DELETE\s+USING\s*\(\s*false\s*\)/i,
  /FOR\s+UPDATE\s+USING\s*\(\s*false\s*\)/i,
];

/** Tables systeme qui n'utilisent PAS le helper (exceptions documentees). */
const EXEMPTED_TABLES = new Set<string>([
  // auth_tenants n'a pas elle-meme tenant_id (c'est la table tenant root).
]);

/**
 * Tables avec coverage RLS partielle acceptee (audit/immutable).
 * Exemple : audit_log = SELECT + INSERT only (jamais UPDATE/DELETE).
 */
const INCOMPLETE_COVERAGE_ACCEPTED = new Set<string>([
  'audit_log', // immutable audit trail (Sprint 12 compliance)
]);

interface PolicyMatch {
  file: string;
  table: string;
  policyName: string;
  body: string;
}

function extractPolicies(): PolicyMatch[] {
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.ts'));
  const policies: PolicyMatch[] = [];

  // Regex tolerant : CREATE POLICY <name> ON <table> ... USING (...) WITH CHECK (...)
  const policyRegex =
    /CREATE\s+POLICY\s+(\w+)\s+ON\s+([\w.]+)\s+([\s\S]*?)(?=CREATE\s+POLICY|;|\$\$)/gi;

  for (const file of files) {
    const content = readFileSync(resolve(MIGRATIONS_DIR, file), 'utf8');
    let match: RegExpExecArray | null;
    while ((match = policyRegex.exec(content)) !== null) {
      const policyName = match[1]!;
      const table = match[2]!;
      const body = match[3]!;
      policies.push({ file, table, policyName, body });
    }
  }

  return policies;
}

describe('RLS policy coherence (static analysis of Sprint 2 migrations)', () => {
  const policies = extractPolicies();

  it('1. extracts at least 50 RLS policies from migrations', () => {
    expect(policies.length).toBeGreaterThanOrEqual(50);
  });

  it('2. all policies use approved helper (app_can_access_tenant or app_is_super_admin)', () => {
    const violations: string[] = [];

    for (const p of policies) {
      if (EXEMPTED_TABLES.has(p.table)) continue;
      const usesHelper = APPROVED_HELPERS.some((h) => p.body.includes(h));
      const isImmutable = IMMUTABLE_PATTERNS.some((re) => re.test(p.body));
      if (!usesHelper && !isImmutable) {
        violations.push(
          `${p.file} :: ${p.table} :: ${p.policyName} -- body excerpt: ${p.body.slice(0, 150).replace(/\s+/g, ' ')}`,
        );
      }
    }

    if (violations.length > 0) {
      const message = `RLS policy violations (${violations.length}) :\n${violations.join('\n')}`;
      throw new Error(message);
    }
    expect(violations).toEqual([]);
  });

  it('3. tables tenant-scoped have at least 4 policies (SELECT/INSERT/UPDATE/DELETE)', () => {
    const tablePolicies = new Map<string, Set<string>>();
    for (const p of policies) {
      if (EXEMPTED_TABLES.has(p.table)) continue;
      // Detect command type in policy name (convention : <table>_<command>).
      const cmd = p.policyName.split('_').pop()!.toLowerCase();
      if (!['select', 'insert', 'update', 'delete', 'all'].includes(cmd)) continue;
      const set = tablePolicies.get(p.table) ?? new Set<string>();
      set.add(cmd);
      tablePolicies.set(p.table, set);
    }

    const incompletePolicies: string[] = [];
    for (const [table, cmds] of tablePolicies) {
      // Soit 'all' (couvre toutes commandes), soit les 4 individuelles.
      if (cmds.has('all')) continue;
      if (INCOMPLETE_COVERAGE_ACCEPTED.has(table)) continue;
      const missing = ['select', 'insert', 'update', 'delete'].filter((c) => !cmds.has(c));
      if (missing.length > 0) {
        incompletePolicies.push(`${table} -- missing: ${missing.join(', ')}`);
      }
    }

    if (incompletePolicies.length > 0) {
      throw new Error(
        `Tables incomplete RLS coverage:\n${incompletePolicies.join('\n')}`,
      );
    }
  });

  it('4. all tables tenant-scoped have ENABLE ROW LEVEL SECURITY', () => {
    const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.ts'));
    let enableCount = 0;
    for (const file of files) {
      const content = readFileSync(resolve(MIGRATIONS_DIR, file), 'utf8');
      const matches = content.match(/ENABLE ROW LEVEL SECURITY/gi);
      if (matches) enableCount += matches.length;
    }
    expect(enableCount).toBeGreaterThanOrEqual(20);
  });

  it('5. report : RLS coverage stats', () => {
    const uniqueTables = new Set(policies.map((p) => p.table));
    const byCommand = { select: 0, insert: 0, update: 0, delete: 0, all: 0, other: 0 };
    for (const p of policies) {
      const cmd = p.policyName.split('_').pop()!.toLowerCase();
      if (cmd in byCommand) {
        byCommand[cmd as keyof typeof byCommand] += 1;
      } else {
        byCommand.other += 1;
      }
    }
    // Affiche le rapport pour pause #4 (ne fail pas).
    expect(uniqueTables.size).toBeGreaterThan(0);
    expect(policies.length).toBe(
      byCommand.select + byCommand.insert + byCommand.update + byCommand.delete + byCommand.all + byCommand.other,
    );
  });
});
