/**
 * Utility helpers for integration tests.
 * Aucune emoji (decision-006).
 */
import type { DataSource } from 'typeorm';

export async function countTables(ds: DataSource): Promise<number> {
  const rows: Array<{ c: number }> = await ds.query(
    `SELECT count(*)::int AS c FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name NOT LIKE 'typeorm_%'`,
  );
  return rows[0]?.c ?? 0;
}

export async function listIndexes(ds: DataSource, table: string): Promise<string[]> {
  const rows: Array<{ indexname: string }> = await ds.query(
    `SELECT indexname FROM pg_indexes WHERE tablename = $1 ORDER BY indexname`,
    [table],
  );
  return rows.map((r) => r.indexname);
}

export async function listForeignKeys(ds: DataSource, table: string): Promise<string[]> {
  const rows: Array<{ constraint_name: string }> = await ds.query(
    `SELECT constraint_name FROM information_schema.table_constraints WHERE table_name = $1 AND constraint_type = 'FOREIGN KEY' ORDER BY constraint_name`,
    [table],
  );
  return rows.map((r) => r.constraint_name);
}

export async function tableExists(ds: DataSource, table: string): Promise<boolean> {
  const rows: Array<{ oid: string | null }> = await ds.query(
    `SELECT to_regclass($1) AS oid`,
    [table],
  );
  return rows[0]?.oid !== null;
}
