/**
 * Skalean InsurTech v2.2 -- OpenTelemetry SDK
 * Reference: B-01 Tache 1.1.12
 * decision-006 (no-emoji)
 */
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { Resource } from '@opentelemetry/resources';

let sdk: NodeSDK | null = null;

export function startTelemetry(): void {
  if (sdk) return;

  const otlpEndpoint = process.env['OTEL_EXPORTER_OTLP_ENDPOINT'];
  const serviceName = process.env['OTEL_SERVICE_NAME'] ?? 'skalean-insurtech-api';
  const appVersion = process.env['APP_VERSION'] ?? '2.2.0';
  const nodeEnv = process.env['NODE_ENV'] ?? 'development';

  const exporter = otlpEndpoint
    ? new OTLPTraceExporter({ url: `${otlpEndpoint}/v1/traces` })
    : undefined;

  sdk = new NodeSDK({
    resource: new Resource({
      'service.name': serviceName,
      'service.version': appVersion,
      'deployment.environment': nodeEnv,
    }),
    ...(exporter ? { traceExporter: exporter } : {}),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-http': { enabled: true },
        '@opentelemetry/instrumentation-pg': { enabled: true },
        '@opentelemetry/instrumentation-ioredis': { enabled: true },
      }),
    ],
  });

  sdk.start();
}

export async function shutdownTelemetry(): Promise<void> {
  if (sdk) {
    await sdk.shutdown();
    sdk = null;
  }
}
