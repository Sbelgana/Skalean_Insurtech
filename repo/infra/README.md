# `repo/infra/` -- legacy compose location

**Note de clarification (Sprint 7.5b Tache 7.5b.0, recommandation Pause #5)**

Ce repertoire `repo/infra/` contient un fichier `docker-compose.test.yaml` historique
heritage Sprint 1. Il differe du compose principal du programme qui est dans
`repo/infrastructure/docker/`.

## Quel compose utiliser ?

### Test stack v3.0 (recommande -- ports 5433 / 6380 / 9095)

```bash
docker compose -f repo/infrastructure/docker/docker-compose.test.yaml up -d
```

Contient :
- `skalean-postgres-test` : POSTGRES_USER=skalean / PASSWORD=skalean_test / DB=skalean_insurtech_test
- `skalean-redis-test`
- `skalean-kafka-test` (port 9095, mapping interne 9094)

### Test stack legacy (DEPRECIE -- ports 5433 / 6380 / 9093)

`repo/infra/docker-compose.test.yaml`
- POSTGRES_USER=test / PASSWORD=test / DB=skalean_test
- Kafka port 9093 (mapping interne 9094)
- Conserve pour compatibility avec ancien `global-setup.ts` de
  `packages/database/test/global-setup.ts` qui pointe encore vers ce fichier
  (heritage Sprint 1 -- non corrige Sprint 7.5b pour eviter casser tests existants)

## Pourquoi 2 fichiers ?

| Fichier | Origine | Usage actuel |
|---|---|---|
| `repo/infra/docker-compose.test.yaml` | Sprint 1 bootstrap | Reference dans `packages/database/test/global-setup.ts` (skip si SKALEAN_CI=true) |
| `repo/infrastructure/docker/docker-compose.test.yaml` | Sprint 1.2.1+ | Stack actif (cf Pause #5 validation runtime live) |

## Recommandation

- Pour developpement local : utiliser `infrastructure/docker/docker-compose.test.yaml`
- Pour tests integration : `SKALEAN_CI=true pnpm test:integration` (skip auto-up)
- Variables env requises : voir `pause-5-validation-runtime.md`
  ```
  SKALEAN_CI=true
  TEST_DATABASE_HOST=localhost
  TEST_DATABASE_PORT=5433
  TEST_DATABASE_USER=skalean
  TEST_DATABASE_PASSWORD=skalean_test
  TEST_DATABASE_NAME=skalean_insurtech_test
  REDIS_URL=redis://localhost:6380
  KAFKA_BROKERS=localhost:9095
  ```

## Migration prevue

Sprint 8+ : unifier sur un seul compose dans `infrastructure/docker/` et
refactorer `global-setup.ts` pour pointer vers le bon fichier.

Reference :
- `pause-5-validation-runtime.md`
- `infrastructure/scripts/db-reset.sh`
- `infrastructure/scripts/post-migration-grants.sh`
