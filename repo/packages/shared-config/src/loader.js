"use strict";
/**
 * Skalean InsurTech v2.2 -- Env loader with cache singleton + dotenv
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadEnv = loadEnv;
exports.resetEnvCache = resetEnvCache;
const dotenv = __importStar(require("dotenv"));
const node_fs_1 = require("node:fs");
const env_schema_js_1 = require("./env.schema.js");
let cachedEnv = null;
function loadEnv(options = {}) {
    if (cachedEnv && !options.force)
        return cachedEnv;
    const envPath = options.dotenvPath ?? findDotenvPath();
    if (envPath && (0, node_fs_1.existsSync)(envPath)) {
        dotenv.config({ path: envPath });
    }
    const result = env_schema_js_1.EnvSchema.safeParse(process.env);
    if (!result.success) {
        process.stderr.write('========================================\n');
        process.stderr.write('FATAL: Invalid environment configuration\n');
        process.stderr.write('========================================\n');
        process.stderr.write(JSON.stringify(result.error.format(), null, 2) + '\n');
        process.stderr.write('========================================\n');
        process.stderr.write('Required env vars (cf. .env.example) :\n');
        for (const issue of result.error.issues) {
            process.stderr.write(`  ${issue.path.join('.')}: ${issue.message}\n`);
        }
        process.stderr.write('========================================\n');
        process.exit(1);
    }
    cachedEnv = result.data;
    return cachedEnv;
}
function resetEnvCache() {
    cachedEnv = null;
}
function findDotenvPath() {
    const cwd = process.cwd();
    const nodeEnv = process.env['NODE_ENV'] ?? 'development';
    const candidates = [
        `${cwd}/.env.${nodeEnv}.local`,
        `${cwd}/.env.local`,
        `${cwd}/.env.${nodeEnv}`,
        `${cwd}/.env`,
    ];
    for (const candidate of candidates) {
        if ((0, node_fs_1.existsSync)(candidate))
            return candidate;
    }
    return null;
}
//# sourceMappingURL=loader.js.map