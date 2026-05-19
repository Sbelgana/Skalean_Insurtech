import { describe, it, expect } from 'vitest';
import { Topics } from '../../src/topics.js';
import { topicSchemaMap } from '../../src/schemas/index.js';

describe('topicSchemaMap completeness invariant', () => {
  it('every Topics enum value has a schema in the map', () => {
    for (const topic of Object.values(Topics)) {
      expect(topicSchemaMap[topic]).toBeDefined();
    }
  });

  it('topicSchemaMap has at least 49 entries', () => {
    expect(Object.keys(topicSchemaMap).length).toBeGreaterThanOrEqual(49);
  });

  it('topicSchemaMap has exactly the same keys as Topics enum', () => {
    const enumValues = new Set(Object.values(Topics) as string[]);
    const mapKeys = new Set(Object.keys(topicSchemaMap));
    expect(mapKeys.size).toBe(enumValues.size);
    for (const v of enumValues) {
      expect(mapKeys.has(v)).toBe(true);
    }
  });

  it('every schema has parse and safeParse methods', () => {
    for (const schema of Object.values(topicSchemaMap)) {
      const s = schema as { parse?: unknown; safeParse?: unknown };
      expect(typeof s.parse).toBe('function');
      expect(typeof s.safeParse).toBe('function');
    }
  });
});
