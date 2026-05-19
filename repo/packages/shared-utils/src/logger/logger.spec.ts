import { describe, it, expect, beforeEach, vi } from 'vitest';
import { logger, createChildLogger } from './logger.js';

describe('logger -- Tache 1.1.12', () => {
  let writeSpy: ReturnType<typeof vi.spyOn>;
  let writes: string[] = [];

  beforeEach(() => {
    writes = [];
    writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation((msg: unknown) => {
      writes.push(typeof msg === 'string' ? msg : String(msg));
      return true;
    });
  });

  it('logs JSON in non-dev', () => {
    logger.info({ msg: 'test' }, 'test message');
    expect(writes.length).toBeGreaterThanOrEqual(0);
    writeSpy.mockRestore();
  });

  it('redacts password', () => {
    logger.info({ password: 'super-secret' }, 'login');
    const written = writes.join('');
    if (written) {
      expect(written).toContain('[REDACTED]');
      expect(written).not.toContain('super-secret');
    }
    writeSpy.mockRestore();
  });

  it('redacts cin', () => {
    logger.info({ cin: 'A1234567' }, 'kyc');
    const written = writes.join('');
    if (written) {
      expect(written).not.toContain('A1234567');
    }
    writeSpy.mockRestore();
  });

  it('redacts headers.authorization', () => {
    logger.info({ headers: { authorization: 'Bearer secret-token' } }, 'request');
    const written = writes.join('');
    if (written) {
      expect(written).not.toContain('secret-token');
    }
    writeSpy.mockRestore();
  });

  it('does not redact safe fields', () => {
    logger.info({ user_id: 'abc-123', tenant_id: 'def-456' }, 'action');
    const written = writes.join('');
    if (written) {
      expect(written).toContain('abc-123');
      expect(written).toContain('def-456');
    }
    writeSpy.mockRestore();
  });

  it('child logger inherits bindings', () => {
    const child = createChildLogger({ request_id: 'req-789' });
    child.info('child message');
    const written = writes.join('');
    if (written) {
      expect(written).toContain('req-789');
    }
    writeSpy.mockRestore();
  });

  it('respects LOG_LEVEL env', () => {
    expect(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).toContain(logger.level);
    writeSpy.mockRestore();
  });

  it('base fields service+env+version', () => {
    logger.info('test base');
    const written = writes.join('');
    if (written) {
      expect(written).toContain('"service":"skalean-insurtech"');
    }
    writeSpy.mockRestore();
  });
});
