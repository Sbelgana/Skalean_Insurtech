"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startTelemetry = startTelemetry;
exports.shutdownTelemetry = shutdownTelemetry;
/**
 * Skalean InsurTech v2.2 -- OpenTelemetry SDK
 * Reference: B-01 Tache 1.1.12
 * decision-006 (no-emoji)
 */
const sdk_node_1 = require("@opentelemetry/sdk-node");
const exporter_trace_otlp_http_1 = require("@opentelemetry/exporter-trace-otlp-http");
const auto_instrumentations_node_1 = require("@opentelemetry/auto-instrumentations-node");
const resources_1 = require("@opentelemetry/resources");
let sdk = null;
function startTelemetry() {
    if (sdk)
        return;
    const otlpEndpoint = process.env['OTEL_EXPORTER_OTLP_ENDPOINT'];
    const serviceName = process.env['OTEL_SERVICE_NAME'] ?? 'skalean-insurtech-api';
    const appVersion = process.env['APP_VERSION'] ?? '2.2.0';
    const nodeEnv = process.env['NODE_ENV'] ?? 'development';
    const exporter = otlpEndpoint
        ? new exporter_trace_otlp_http_1.OTLPTraceExporter({ url: `${otlpEndpoint}/v1/traces` })
        : undefined;
    sdk = new sdk_node_1.NodeSDK({
        resource: new resources_1.Resource({
            'service.name': serviceName,
            'service.version': appVersion,
            'deployment.environment': nodeEnv,
        }),
        ...(exporter ? { traceExporter: exporter } : {}),
        instrumentations: [
            (0, auto_instrumentations_node_1.getNodeAutoInstrumentations)({
                '@opentelemetry/instrumentation-fs': { enabled: false },
                '@opentelemetry/instrumentation-http': { enabled: true },
                '@opentelemetry/instrumentation-pg': { enabled: true },
                '@opentelemetry/instrumentation-ioredis': { enabled: true },
            }),
        ],
    });
    sdk.start();
}
async function shutdownTelemetry() {
    if (sdk) {
        await sdk.shutdown();
        sdk = null;
    }
}
//# sourceMappingURL=otel.js.map