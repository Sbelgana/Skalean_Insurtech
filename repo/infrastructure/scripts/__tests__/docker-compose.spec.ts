import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '../../..');

describe('Docker Compose configuration', () => {
  it('docker-compose.dev.yaml exists', () => {
    expect(existsSync(join(ROOT, 'infrastructure/docker/docker-compose.dev.yaml'))).toBe(true);
  });

  it('docker-compose.test.yaml exists', () => {
    expect(existsSync(join(ROOT, 'infrastructure/docker/docker-compose.test.yaml'))).toBe(true);
  });

  it('dev compose contains 7 services + 2 init containers', () => {
    const content = readFileSync(
      join(ROOT, 'infrastructure/docker/docker-compose.dev.yaml'),
      'utf-8',
    );
    const requiredServices = [
      'postgres:',
      'redis:',
      'kafka:',
      'kafka-ui:',
      'mailhog:',
      'minio:',
      'n8n:',
      'kafka-init-topics:',
      'minio-init-buckets:',
    ];
    for (const service of requiredServices) {
      expect(content, `Missing service: ${service}`).toContain(service);
    }
  });

  it('dev compose uses KRaft mode (no Zookeeper)', () => {
    const content = readFileSync(
      join(ROOT, 'infrastructure/docker/docker-compose.dev.yaml'),
      'utf-8',
    );
    expect(content).toContain('KAFKA_CFG_PROCESS_ROLES: controller,broker');
    expect(content).not.toContain('zookeeper');
    expect(content).not.toContain('ZOOKEEPER');
  });

  it('dev compose has AUTO_CREATE_TOPICS_ENABLE=false', () => {
    const content = readFileSync(
      join(ROOT, 'infrastructure/docker/docker-compose.dev.yaml'),
      'utf-8',
    );
    expect(content).toContain('KAFKA_CFG_AUTO_CREATE_TOPICS_ENABLE: "false"');
  });

  it('dev compose has healthchecks on all main services', () => {
    const content = readFileSync(
      join(ROOT, 'infrastructure/docker/docker-compose.dev.yaml'),
      'utf-8',
    );
    const healthcheckCount = (content.match(/healthcheck:/g) ?? []).length;
    expect(healthcheckCount).toBeGreaterThanOrEqual(7);
  });

  it('dev compose has named volumes', () => {
    const content = readFileSync(
      join(ROOT, 'infrastructure/docker/docker-compose.dev.yaml'),
      'utf-8',
    );
    expect(content).toContain('postgres-data:');
    expect(content).toContain('redis-data:');
    expect(content).toContain('kafka-data:');
    expect(content).toContain('minio-data:');
    expect(content).toContain('n8n-data:');
  });

  it('dev compose uses skalean-net bridge network', () => {
    const content = readFileSync(
      join(ROOT, 'infrastructure/docker/docker-compose.dev.yaml'),
      'utf-8',
    );
    expect(content).toContain('skalean-net:');
    expect(content).toContain('driver: bridge');
  });

  it('dev compose init containers have restart: "no"', () => {
    const content = readFileSync(
      join(ROOT, 'infrastructure/docker/docker-compose.dev.yaml'),
      'utf-8',
    );
    const noRestartCount = (content.match(/restart: "no"/g) ?? []).length;
    expect(noRestartCount).toBeGreaterThanOrEqual(2);
  });

  it('test compose has subset services only', () => {
    const content = readFileSync(
      join(ROOT, 'infrastructure/docker/docker-compose.test.yaml'),
      'utf-8',
    );
    expect(content).toContain('postgres:');
    expect(content).toContain('redis:');
    expect(content).toContain('kafka:');
    expect(content).not.toContain('n8n:');
    expect(content).not.toContain('mailhog:');
    expect(content).not.toContain('kafka-ui:');
  });

  it('redis.conf exists and has AOF enabled', () => {
    const content = readFileSync(
      join(ROOT, 'infrastructure/docker/redis/redis.conf'),
      'utf-8',
    );
    expect(content).toContain('appendonly yes');
    expect(content).toContain('maxmemory 512mb');
    expect(content).toContain('maxmemory-policy allkeys-lru');
  });

  it('.env.example exists', () => {
    expect(existsSync(join(ROOT, '.env.example'))).toBe(true);
  });
});
