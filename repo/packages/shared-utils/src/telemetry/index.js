"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shutdownTelemetry = exports.startTelemetry = void 0;
/**
 * Skalean InsurTech v2.2 -- Telemetry sub-path export
 *
 * Re-exporte les fonctions OpenTelemetry pour le sub-path import
 * @insurtech/shared-utils/telemetry utilise par apps/api.
 *
 * Reference : decision-006 (no-emoji).
 * Tache : 1.3.1 (Sprint 3 / Phase 1).
 */
var otel_js_1 = require("./otel.js");
Object.defineProperty(exports, "startTelemetry", { enumerable: true, get: function () { return otel_js_1.startTelemetry; } });
Object.defineProperty(exports, "shutdownTelemetry", { enumerable: true, get: function () { return otel_js_1.shutdownTelemetry; } });
//# sourceMappingURL=index.js.map