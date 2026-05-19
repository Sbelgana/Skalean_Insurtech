# Tests integration -- packages/database

Sprint 2 / Tache 1.2.15 -- Gate qualite avant Sprint 3.

## Prerequis

- Docker Desktop ou Docker Engine
- Conteneurs test demarres :
  ```bash
  docker compose -f infra/docker-compose.test.yaml up -d --wait
  ```
- Variables d'environnement (copier `.env.example.test` vers `.env.test`) :
  ```
  DATABASE_TEST_URL=postgres://test:test@localhost:5433/skalean_test
  KAFKA_TEST_BROKERS=localhost:9093
  REDIS_TEST_URL=redis://localhost:6380
  ```

## Commandes

### Lancer tous les tests integration

```bash
pnpm --filter @insurtech/database test:integration
```

### Avec couverture v8

```bash
pnpm --filter @insurtech/database test:integration:coverage
```

### Un seul spec

```bash
pnpm vitest run --config packages/database/vitest.config.integration.ts test/integration/migrations.spec.ts
```

### Depuis la racine

```bash
pnpm test:integration
```

## Suites de tests

| Fichier | Tests | Description |
|---------|-------|-------------|
| migrations.spec.ts | 12 | Migrations up/down/idempotent, RLS, index, FK, extensions |
| rls-multi-tenant.spec.ts | 16 | Isolation cross-tenant sur 16 tables |
| rls-super-admin.spec.ts | 8 | Bypass RLS super admin, non-leak contexte |
| subscribers-tenant-id.spec.ts | 8 | Injection auto tenant_id, blocage cross-tenant |
| subscribers-audit-log.spec.ts | 10 | Audit INSERT/UPDATE/SOFT_DELETE, actor, correlation |
| subscribers-timestamps.spec.ts | 6 | created_at/updated_at, bulk insert, no-op |
| seeds.spec.ts | 8 | Volumes seeds, determinisme, idempotence |

## Variables d'environnement

Voir `.env.example.test` a la racine du repo pour la liste complete.

## Conformite

- decision-002 : multi-tenant RLS Postgres
- decision-003 : TypeORM subscribers
- decision-006 : aucune emoji
- Loi 09-08 CNDP : donnees fictives uniquement
