/**
 * Tests LoggerModule -- valide la configuration Pino, la redaction PII,
 * et l'injection de correlation OpenTelemetry.
 *
 * Strategy de test :
 *   - nestjs-pino est mocke pour eviter la dependance au middleware HTTP.
 *   - @opentelemetry/api est mocke pour controler le span actif.
 *   - Les tests unitaires directs valident PII_REDACT_PATHS et getOtelCorrelationIds.
 *   - Un test d'integration legere valide le DynamicModule retourne.
 *
 * Reference : decision-006 (no-emoji).
 * Tache : 1.3.3 (Sprint 3 / Phase 1).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// vi.hoisted() : evalue avant les imports et vi.mock() -- requis pour reference
// dans les factories vi.mock().
const MockLogger = vi.hoisted(() =>
  class MockLoggerClass {
    log = vi.fn();
    error = vi.fn();
    warn = vi.fn();
    debug = vi.fn();
    verbose = vi.fn();
    fatal = vi.fn();
  },
);

const MockPinoLogger = vi.hoisted(() =>
  class MockPinoLoggerClass {
    info = vi.fn();
    error = vi.fn();
    warn = vi.fn();
    debug = vi.fn();
    trace = vi.fn();
  },
);

const mockNestjsPinoForRoot = vi.hoisted(() =>
  vi.fn((_params?: unknown) => ({
    module: class FakePinoModule {},
    providers: [
      { provide: MockLogger, useValue: new MockLogger() },
      { provide: MockPinoLogger, useValue: new MockPinoLogger() },
    ],
    exports: [MockLogger, MockPinoLogger],
  })),
);

vi.mock('nestjs-pino', () => ({
  LoggerModule: { forRoot: mockNestjsPinoForRoot },
  Logger: MockLogger,
  PinoLogger: MockPinoLogger,
}));

const mockGetActiveSpan = vi.hoisted(() => vi.fn());

vi.mock('@opentelemetry/api', () => ({
  trace: {
    getActiveSpan: mockGetActiveSpan,
  },
}));

// Imports apres les mocks.
import { PII_REDACT_PATHS } from './pii-redact-paths';
import { LoggerModule, getOtelCorrelationIds } from './logger.module';

describe('PII_REDACT_PATHS', () => {
  it('contient le champ password', () => {
    expect(PII_REDACT_PATHS).toContain('password');
  });

  it('contient le champ email', () => {
    expect(PII_REDACT_PATHS).toContain('email');
  });

  it('contient le champ cin (CNDP loi 09-08)', () => {
    expect(PII_REDACT_PATHS).toContain('cin');
  });

  it('contient le champ token', () => {
    expect(PII_REDACT_PATHS).toContain('token');
  });

  it('contient des chemins un niveau de profondeur (wildcard *)', () => {
    const wildcardPaths = PII_REDACT_PATHS.filter((p) => p.startsWith('*.'));
    expect(wildcardPaths.length).toBeGreaterThan(0);
    expect(wildcardPaths).toContain('*.password');
    expect(wildcardPaths).toContain('*.email');
  });

  it('contient les en-tetes HTTP Authorization et Cookie', () => {
    expect(PII_REDACT_PATHS).toContain('req.headers.authorization');
    expect(PII_REDACT_PATHS).toContain('req.headers.cookie');
  });

  it('contient le set-cookie de reponse', () => {
    expect(PII_REDACT_PATHS).toContain('res.headers["set-cookie"]');
  });
});

describe('getOtelCorrelationIds()', () => {
  beforeEach(() => {
    mockGetActiveSpan.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('retourne un objet vide quand aucun span actif', () => {
    mockGetActiveSpan.mockReturnValue(undefined);
    const result = getOtelCorrelationIds();
    expect(result).toEqual({});
  });

  it('retourne trace_id et span_id quand un span est actif', () => {
    const mockSpan = {
      spanContext: vi.fn(() => ({
        traceId: 'abc123trace',
        spanId: 'def456span',
        traceFlags: 1,
      })),
    };
    mockGetActiveSpan.mockReturnValue(mockSpan);

    const result = getOtelCorrelationIds();
    expect(result).toEqual({
      trace_id: 'abc123trace',
      span_id: 'def456span',
    });
  });

  it('retourne un objet vide quand span retourne null', () => {
    mockGetActiveSpan.mockReturnValue(null);
    const result = getOtelCorrelationIds();
    expect(result).toEqual({});
  });
});

describe('LoggerModule', () => {
  beforeEach(() => {
    mockNestjsPinoForRoot.mockClear();
    mockGetActiveSpan.mockReturnValue(undefined);
  });

  it('forRoot() retourne un DynamicModule avec module = LoggerModule', () => {
    const mod = LoggerModule.forRoot();
    expect(mod.module).toBe(LoggerModule);
  });

  it('forRoot() retourne global: true', () => {
    const mod = LoggerModule.forRoot();
    expect(mod.global).toBe(true);
  });

  it('forRoot() appelle NestjsPinoModule.forRoot() avec pinoHttp options', () => {
    LoggerModule.forRoot();
    expect(mockNestjsPinoForRoot).toHaveBeenCalledTimes(1);
    const callArgs = mockNestjsPinoForRoot.mock.calls[0]?.[0] as {
      pinoHttp: Record<string, unknown>;
    };
    expect(callArgs).toBeDefined();
    expect(callArgs?.pinoHttp).toBeDefined();
  });

  it('forRoot() configure pinoHttp avec redact.paths PII', () => {
    LoggerModule.forRoot();
    const callArgs = mockNestjsPinoForRoot.mock.calls[0]?.[0] as {
      pinoHttp: {
        redact: { paths: string[]; censor: string };
      };
    };
    expect(callArgs?.pinoHttp?.redact?.paths).toContain('password');
    expect(callArgs?.pinoHttp?.redact?.paths).toContain('email');
    expect(callArgs?.pinoHttp?.redact?.censor).toBe('[REDACTED]');
  });

  it('forRoot() configure pinoHttp avec customProps incluant OTel et service', () => {
    LoggerModule.forRoot();
    const callArgs = mockNestjsPinoForRoot.mock.calls[0]?.[0] as {
      pinoHttp: {
        customProps: (_req: unknown, _res: unknown) => Record<string, unknown>;
      };
    };
    const props = callArgs?.pinoHttp?.customProps?.({}, {});
    expect(props).toBeDefined();
    expect(props?.service).toBe('skalean-insurtech-api');
  });

  it('forRoot() inclut imports avec le module nestjs-pino', () => {
    const mod = LoggerModule.forRoot();
    expect(Array.isArray(mod.imports)).toBe(true);
    expect((mod.imports as unknown[]).length).toBeGreaterThan(0);
  });

  it('forRoot() exporte Logger et PinoLogger de nestjs-pino', () => {
    const mod = LoggerModule.forRoot();
    expect(Array.isArray(mod.exports)).toBe(true);
    // Les exports doivent contenir les tokens Logger et PinoLogger.
    expect(mod.exports).toContain(MockLogger);
    expect(mod.exports).toContain(MockPinoLogger);
  });
});
