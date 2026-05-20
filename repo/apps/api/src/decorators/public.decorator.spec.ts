/**
 * Tests @Public() decorator + IS_PUBLIC_KEY constant.
 *
 * Reference : decision-006 (no-emoji).
 * Tache : 1.3.14 (Sprint 3 / Phase 1).
 */
import { describe, it, expect } from 'vitest';
import { IS_PUBLIC_KEY, Public } from './public.decorator';

describe('@Public() decorator', () => {
  it('IS_PUBLIC_KEY est la chaine "isPublic"', () => {
    expect(IS_PUBLIC_KEY).toBe('isPublic');
  });

  it('Public est une fonction (factory de decorateur)', () => {
    expect(typeof Public).toBe('function');
  });

  it('Public() retourne une fonction decorateur (MethodDecorator & ClassDecorator)', () => {
    const decorator = Public();
    expect(typeof decorator).toBe('function');
  });

  it('applique le metadata isPublic: true sur une methode de classe', () => {
    const { METADATA_KEY } = (() => {
      // Cree une classe de test avec le decorateur
      class TestController {
        // Decorateur applique manuellement pour eviter reflect-metadata hors contexte
        publicMethod() {}
      }
      const descriptor = Object.getOwnPropertyDescriptor(
        TestController.prototype,
        'publicMethod',
      );
      // Applique le decorateur
      const decorator = Public() as MethodDecorator;
      decorator(
        TestController.prototype,
        'publicMethod',
        descriptor ?? { value: TestController.prototype.publicMethod, writable: true, enumerable: false, configurable: true },
      );
      const value = Reflect.getMetadata(IS_PUBLIC_KEY, TestController.prototype.publicMethod);
      return { METADATA_KEY: value };
    })();
    expect(METADATA_KEY).toBe(true);
  });

  it('applique le metadata isPublic: true sur une classe', () => {
    const decorator = Public() as ClassDecorator;

    class TestController {}
    decorator(TestController);

    const value = Reflect.getMetadata(IS_PUBLIC_KEY, TestController);
    expect(value).toBe(true);
  });
});
