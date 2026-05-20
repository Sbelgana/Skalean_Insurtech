/**
 * casablanca spec -- shared-maps
 * Reference: task-1.4.10 Sprint 4 Phase 1
 */
import { describe, it, expect } from 'vitest';
import {
  CASABLANCA_CENTER,
  DEFAULT_ZOOM,
  toMapboxLocale,
  MA_COUNTRY_CODE,
  CASABLANCA_BOUNDS,
} from '../src/lib/casablanca';

describe('casablanca constants', () => {
  it('CASABLANCA_CENTER is correct coordinates', () => {
    expect(CASABLANCA_CENTER).toEqual([-7.5898, 33.5731]);
  });

  it('DEFAULT_ZOOM is 11', () => {
    expect(DEFAULT_ZOOM).toBe(11);
  });

  it('MA_COUNTRY_CODE is ma', () => {
    expect(MA_COUNTRY_CODE).toBe('ma');
  });

  it('CASABLANCA_BOUNDS has SW and NE corners', () => {
    expect(CASABLANCA_BOUNDS[0]).toBeDefined();
    expect(CASABLANCA_BOUNDS[1]).toBeDefined();
    expect(CASABLANCA_BOUNDS[0]![0]).toBeLessThan(CASABLANCA_BOUNDS[1]![0]);
    expect(CASABLANCA_BOUNDS[0]![1]).toBeLessThan(CASABLANCA_BOUNDS[1]![1]);
  });
});

describe('toMapboxLocale', () => {
  it('fr -> fr', () => expect(toMapboxLocale('fr')).toBe('fr'));
  it('ar-MA -> fr (Darija uses Latin labels)', () => expect(toMapboxLocale('ar-MA')).toBe('fr'));
  it('ar -> ar (arabe classique)', () => expect(toMapboxLocale('ar')).toBe('ar'));
  it('en -> fr (fallback)', () => expect(toMapboxLocale('en')).toBe('fr'));
  it('unknown -> fr (fallback)', () => expect(toMapboxLocale('de')).toBe('fr'));
});
