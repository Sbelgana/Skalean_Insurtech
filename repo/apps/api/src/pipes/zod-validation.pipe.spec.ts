/**
 * Tests ZodValidationPipe -- valide la validation Zod, la gestion d'erreurs,
 * et le mode pass-through sans schema.
 *
 * Reference : decision-006 (no-emoji).
 * Tache : 1.3.6 (Sprint 3 / Phase 1).
 */
import { describe, it, expect } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import type { ArgumentMetadata } from '@nestjs/common';
import { z } from 'zod';
import {
  ZodValidationPipe,
  formatZodErrors,
  type ZodValidationError,
} from './zod-validation.pipe';

// ============================================================================
// Schemas de test
// ============================================================================

const SimpleSchema = z.object({
  name: z.string().min(1),
  age: z.number().int().min(0),
});

const NestedSchema = z.object({
  user: z.object({
    email: z.string().email(),
    address: z.object({
      city: z.string(),
    }),
  }),
});

const DefaultsSchema = z.object({
  name: z.string(),
  role: z.string().default('user'),
});

/** Metadata NestJS minimal pour les tests. */
const MOCK_METADATA: ArgumentMetadata = {
  type: 'body',
  metatype: Object,
  data: '',
};

// ============================================================================
// Tests formatZodErrors()
// ============================================================================

describe('formatZodErrors()', () => {
  it('formate les erreurs Zod en tableau ZodValidationError', () => {
    const schema = z.object({ name: z.string(), age: z.number() });
    const result = schema.safeParse({ name: 123, age: 'not-a-number' });
    if (result.success) throw new Error('Expected failure');

    const zodError = result.error;
    const errors = formatZodErrors(zodError);

    expect(Array.isArray(errors)).toBe(true);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toMatchObject({
      path: expect.any(String),
      message: expect.any(String),
      code: expect.any(String),
    });
  });

  it('formate le chemin dot-notation pour les champs imbriques', () => {
    const result = NestedSchema.safeParse({
      user: { email: 'invalid', address: { city: 123 } },
    });
    if (result.success) throw new Error('Expected failure');

    const errors = formatZodErrors(result.error);
    const paths = errors.map((e) => e.path);

    expect(paths.some((p) => p.includes('.'))).toBe(true);
  });

  it('formate le chemin en chaine vide pour les erreurs root-level', () => {
    const schema = z.string();
    const result = schema.safeParse(123);
    if (result.success) throw new Error('Expected failure');

    const errors = formatZodErrors(result.error);
    expect(errors[0]?.path).toBe('');
  });
});

// ============================================================================
// Tests ZodValidationPipe -- mode pass-through (sans schema)
// ============================================================================

describe('ZodValidationPipe -- sans schema (pass-through)', () => {
  it('retourne la valeur telle quelle sans schema', () => {
    const pipe = new ZodValidationPipe();
    const input = { foo: 'bar' };
    const result = pipe.transform(input, MOCK_METADATA);
    expect(result).toBe(input);
  });

  it('passe les primitives sans transformation', () => {
    const pipe = new ZodValidationPipe();
    expect(pipe.transform('hello', MOCK_METADATA)).toBe('hello');
    expect(pipe.transform(42, MOCK_METADATA)).toBe(42);
    expect(pipe.transform(null, MOCK_METADATA)).toBeNull();
  });

  it('ne leve pas d erreur pour des donnees invalides sans schema', () => {
    const pipe = new ZodValidationPipe();
    expect(() => pipe.transform({}, MOCK_METADATA)).not.toThrow();
  });
});

// ============================================================================
// Tests ZodValidationPipe -- avec schema (validation active)
// ============================================================================

describe('ZodValidationPipe -- avec schema', () => {
  it('retourne la valeur parsee si valide', () => {
    const pipe = new ZodValidationPipe(SimpleSchema);
    const input = { name: 'Alice', age: 30 };
    const result = pipe.transform(input, MOCK_METADATA);
    expect(result).toEqual({ name: 'Alice', age: 30 });
  });

  it('applique les defaults Zod dans la valeur retournee', () => {
    const pipe = new ZodValidationPipe(DefaultsSchema);
    const input = { name: 'Bob' };
    const result = pipe.transform(input, MOCK_METADATA) as { role: string };
    expect(result.role).toBe('user');
  });

  it('leve BadRequestException si validation echoue', () => {
    const pipe = new ZodValidationPipe(SimpleSchema);
    expect(() =>
      pipe.transform({ name: '', age: -1 }, MOCK_METADATA),
    ).toThrow(BadRequestException);
  });

  it('BadRequestException contient statusCode 400', () => {
    const pipe = new ZodValidationPipe(SimpleSchema);
    try {
      pipe.transform({ name: 123, age: 'bad' }, MOCK_METADATA);
      expect.fail('Devrait lever une exception');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      const response = (err as BadRequestException).getResponse() as {
        statusCode: number;
      };
      expect(response.statusCode).toBe(400);
    }
  });

  it('BadRequestException contient message "Validation failed"', () => {
    const pipe = new ZodValidationPipe(SimpleSchema);
    try {
      pipe.transform({ name: 123 }, MOCK_METADATA);
      expect.fail('Devrait lever une exception');
    } catch (err) {
      const response = (err as BadRequestException).getResponse() as {
        message: string;
      };
      expect(response.message).toBe('Validation failed');
    }
  });

  it('BadRequestException contient les details d erreur Zod', () => {
    const pipe = new ZodValidationPipe(SimpleSchema);
    try {
      pipe.transform({ name: 123, age: 'bad' }, MOCK_METADATA);
      expect.fail('Devrait lever une exception');
    } catch (err) {
      const response = (err as BadRequestException).getResponse() as {
        errors: ZodValidationError[];
      };
      expect(Array.isArray(response.errors)).toBe(true);
      expect(response.errors.length).toBeGreaterThan(0);
      expect(response.errors[0]).toMatchObject({
        path: expect.any(String),
        message: expect.any(String),
        code: expect.any(String),
      });
    }
  });

  it('valide les schemas imbriques et retourne les erreurs dot-notation', () => {
    const pipe = new ZodValidationPipe(NestedSchema);
    try {
      pipe.transform(
        { user: { email: 'not-an-email', address: { city: 42 } } },
        MOCK_METADATA,
      );
      expect.fail('Devrait lever une exception');
    } catch (err) {
      const response = (err as BadRequestException).getResponse() as {
        errors: ZodValidationError[];
      };
      const paths = response.errors.map((e) => e.path);
      // Au moins un chemin avec dot-notation (imbrication)
      expect(paths.some((p) => p.includes('.'))).toBe(true);
    }
  });

  it('leve BadRequestException pour valeur undefined si schema requis', () => {
    const pipe = new ZodValidationPipe(SimpleSchema);
    expect(() => pipe.transform(undefined, MOCK_METADATA)).toThrow(
      BadRequestException,
    );
  });

  it('accepte les body vides si schema le permet', () => {
    const optionalSchema = z.object({
      name: z.string().optional(),
    });
    const pipe = new ZodValidationPipe(optionalSchema);
    const result = pipe.transform({}, MOCK_METADATA);
    expect(result).toEqual({});
  });
});
