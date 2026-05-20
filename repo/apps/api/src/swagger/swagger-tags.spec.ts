/**
 * Tests swagger-tags.ts -- SWAGGER_TAGS catalog.
 *
 * Reference : decision-006 (no-emoji).
 * Tache : 1.3.9 (Sprint 3 / Phase 1).
 */
import { describe, it, expect } from 'vitest';
import { SWAGGER_TAGS, getTagByName, getTagNames } from './swagger-tags';

describe('SWAGGER_TAGS', () => {
  it('contient au moins 20 tags', () => {
    expect(SWAGGER_TAGS.length).toBeGreaterThanOrEqual(20);
  });

  it('contient exactement 21 tags', () => {
    expect(SWAGGER_TAGS.length).toBe(21);
  });

  it('chaque tag a name + description non-vides', () => {
    for (const tag of SWAGGER_TAGS) {
      expect(tag.name).toBeTruthy();
      expect(tag.description).toBeTruthy();
    }
  });

  it('noms de tags sont uniques', () => {
    const names = SWAGGER_TAGS.map((t) => t.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  it('contient tags transverses (Health, Auth, Tenant, RBAC)', () => {
    const names = getTagNames();
    expect(names).toContain('Health');
    expect(names).toContain('Auth');
    expect(names).toContain('Tenant');
    expect(names).toContain('RBAC');
  });

  it('contient tags metier core (CRM, Booking, Comm, Docs, Pay)', () => {
    const names = getTagNames();
    expect(names).toContain('CRM');
    expect(names).toContain('Booking');
    expect(names).toContain('Comm');
    expect(names).toContain('Docs');
    expect(names).toContain('Pay');
  });

  it('contient tags metier supplementaires (Books, Compliance, Analytics)', () => {
    const names = getTagNames();
    expect(names).toContain('Books');
    expect(names).toContain('Compliance');
    expect(names).toContain('Analytics');
  });

  it('contient tags verticales (Insure, Repair)', () => {
    const names = getTagNames();
    expect(names).toContain('Insure');
    expect(names).toContain('Repair');
  });

  it('contient tags frontends (Assure, Prospect, Admin)', () => {
    const names = getTagNames();
    expect(names).toContain('Assure');
    expect(names).toContain('Prospect');
    expect(names).toContain('Admin');
  });

  it('contient tags AI (SkaleanAI, MCP)', () => {
    const names = getTagNames();
    expect(names).toContain('SkaleanAI');
    expect(names).toContain('MCP');
  });

  it('contient tag Public', () => {
    expect(getTagByName('Public')).toBeDefined();
  });
});

describe('getTagByName', () => {
  it('retourne le tag Auth', () => {
    const tag = getTagByName('Auth');
    expect(tag).toBeDefined();
    expect(tag?.name).toBe('Auth');
  });

  it('retourne undefined si tag non trouve', () => {
    expect(getTagByName('NonExistent')).toBeUndefined();
  });

  it('description Auth references Sprint 5', () => {
    const auth = getTagByName('Auth');
    expect(auth?.description).toMatch(/Sprint 5/);
  });

  it('description MCP references Sprint 31', () => {
    const mcp = getTagByName('MCP');
    expect(mcp?.description).toMatch(/Sprint 31/);
  });
});

describe('getTagNames', () => {
  it('retourne un tableau de strings', () => {
    const names = getTagNames();
    expect(Array.isArray(names)).toBe(true);
    expect(names.every((n) => typeof n === 'string')).toBe(true);
  });

  it('retourne 21 noms', () => {
    expect(getTagNames().length).toBe(21);
  });
});
