/**
 * Skalean InsurTech v2.2 -- Env loader with cache singleton + dotenv
 */
import { type Env } from './env.schema.js';
interface LoadEnvOptions {
    force?: boolean;
    dotenvPath?: string;
}
export declare function loadEnv(options?: LoadEnvOptions): Env;
export declare function resetEnvCache(): void;
export {};
//# sourceMappingURL=loader.d.ts.map