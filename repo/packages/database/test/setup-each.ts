/**
 * Vitest per-file setup -- runs before each test file.
 * Injects OTEL no-op exporters to prevent blocking HTTP calls during tests.
 * Aucune emoji (decision-006).
 */
import { beforeEach, afterEach } from 'vitest';

beforeEach(() => {
  process.env['OTEL_TRACES_EXPORTER'] = 'none';
  process.env['OTEL_LOGS_EXPORTER'] = 'none';
  process.env['OTEL_METRICS_EXPORTER'] = 'none';
});

afterEach(() => {
  // No-op placeholder. Per-suite cleanup is handled inside each spec.
});
