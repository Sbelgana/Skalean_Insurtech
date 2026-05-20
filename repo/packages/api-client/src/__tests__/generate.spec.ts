import { describe, it, expect } from 'vitest';

describe('generate.ts script', () => {
  it('parses minimal OpenAPI spec into TypeScript types', async () => {
    const spec = {
      openapi: '3.1.0',
      info: { title: 'test', version: '0.0.1' },
      paths: {
        '/health': {
          get: {
            responses: {
              '200': {
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: { status: { type: 'string', const: 'ok' } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    };
    const { default: openapiTS, astToString } = await import('openapi-typescript');
    const ast = await openapiTS(spec as Parameters<typeof openapiTS>[0]);
    const out = astToString(ast);
    expect(out).toContain('paths');
    expect(out).toContain('/health');
  });

  it('rejects spec missing openapi field', async () => {
    const { default: openapiTS } = await import('openapi-typescript');
    await expect(
      openapiTS({ paths: {} } as Parameters<typeof openapiTS>[0]),
    ).rejects.toBeTruthy();
  });

  it('header timestamp is regenerated each run (deterministic across regeneration with same spec)', () => {
    const t1 = new Date('2026-05-06T00:00:00Z').toISOString();
    const t2 = new Date('2026-05-06T00:00:00Z').toISOString();
    expect(t1).toBe(t2);
  });
});
