/**
 * Tests faker locale + custom MA data.
 * Les tests DB skipent si DATABASE_HOST absent.
 * Les tests purs (JSON structure) tournent toujours.
 * Aucune emoji (decision-006).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
const { Pool } = pg;

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_AVAILABLE = Boolean(process.env['DATABASE_HOST']);

interface NomsMaData {
  prenoms: string[];
  noms: string[];
}
interface VilleData {
  name: string;
  region: string;
  population: number;
}

// JSON structure tests -- always run
describe('Faker locale + custom MA data (unit)', () => {
  let nomsMa: NomsMaData;
  let villesMa: VilleData[];

  beforeAll(() => {
    nomsMa = JSON.parse(
      readFileSync(resolve(__dirname, '../../scripts/seed-data/noms-fr-ma.json'), 'utf-8'),
    ) as NomsMaData;
    villesMa = JSON.parse(
      readFileSync(resolve(__dirname, '../../scripts/seed-data/villes-ma.json'), 'utf-8'),
    ) as VilleData[];
  });

  it('All MA villes pool entries have required fields', () => {
    expect(villesMa.length).toBeGreaterThanOrEqual(20);
    for (const v of villesMa) {
      expect(v).toHaveProperty('name');
      expect(v).toHaveProperty('region');
      expect(v).toHaveProperty('population');
      expect(typeof v.name).toBe('string');
      expect(typeof v.region).toBe('string');
      expect(typeof v.population).toBe('number');
    }
  });

  it('noms-fr-ma.json has 100 prenoms and 100 noms', () => {
    expect(nomsMa.prenoms.length).toBe(100);
    expect(nomsMa.noms.length).toBe(100);
  });

  it('All prenoms are non-empty strings', () => {
    for (const p of nomsMa.prenoms) {
      expect(typeof p).toBe('string');
      expect(p.length).toBeGreaterThan(0);
    }
  });

  it('All noms are non-empty strings', () => {
    for (const n of nomsMa.noms) {
      expect(typeof n).toBe('string');
      expect(n.length).toBeGreaterThan(0);
    }
  });
});

// DB-dependent tests -- skip when no DB
describe.skipIf(!DB_AVAILABLE)('Faker locale + custom MA data (integration)', () => {
  let pool: InstanceType<typeof Pool>;
  let nomsMa: NomsMaData;
  let villesMa: VilleData[];

  beforeAll(() => {
    pool = new Pool({
      host: process.env['DATABASE_HOST'],
      port: parseInt(process.env['DATABASE_PORT'] ?? '5432', 10),
      database: process.env['DATABASE_NAME'],
      user: process.env['DATABASE_USER'],
      password: process.env['DATABASE_PASSWORD'],
    });
    nomsMa = JSON.parse(
      readFileSync(resolve(__dirname, '../../scripts/seed-data/noms-fr-ma.json'), 'utf-8'),
    ) as NomsMaData;
    villesMa = JSON.parse(
      readFileSync(resolve(__dirname, '../../scripts/seed-data/villes-ma.json'), 'utf-8'),
    ) as VilleData[];
  });

  afterAll(async () => {
    await pool.end();
  });

  it('Contact first_names are from MA pool', async () => {
    const r = await pool.query<{ first_name: string }>(
      'SELECT DISTINCT first_name FROM contacts LIMIT 50',
    );
    const validPrenoms = new Set(nomsMa.prenoms);
    for (const row of r.rows) {
      expect(validPrenoms.has(row.first_name)).toBe(true);
    }
  });

  it('Contact last_names are from MA pool', async () => {
    const r = await pool.query<{ last_name: string }>(
      'SELECT DISTINCT last_name FROM contacts LIMIT 50',
    );
    const validNoms = new Set(nomsMa.noms);
    for (const row of r.rows) {
      expect(validNoms.has(row.last_name)).toBe(true);
    }
  });

  it('Contact cities are from MA villes pool', async () => {
    const r = await pool.query<{ city: string }>(
      'SELECT DISTINCT city FROM contacts LIMIT 50',
    );
    const validVilles = new Set(villesMa.map((v) => v.name));
    for (const row of r.rows) {
      expect(validVilles.has(row.city)).toBe(true);
    }
  });
});
