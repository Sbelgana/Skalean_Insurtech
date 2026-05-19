/**
 * Vitest global setup -- runs once before all integration suites.
 * In CI (SKALEAN_CI=true), docker-compose is managed by GitHub Actions services.
 * Locally, it starts the test containers via docker-compose.test.yaml.
 * Aucune emoji (decision-006).
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default async function globalSetup(): Promise<void> {
  if (process.env['SKALEAN_CI'] === 'true' || process.env['CI'] === 'true') {
    return;
  }
  const composeFile = path.resolve(__dirname, '../../../infra/docker-compose.test.yaml');
  const up = spawnSync('docker', ['compose', '-f', composeFile, 'up', '-d', '--wait'], {
    stdio: 'inherit',
  });
  if (up.status !== 0) {
    throw new Error('docker compose up failed -- ensure Docker Desktop is running');
  }
}
