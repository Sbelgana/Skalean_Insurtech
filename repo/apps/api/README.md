# @insurtech/api

Backend API NestJS 10.4 + Fastify 4.28 pour Skalean InsurTech v2.2.

## Quick start dev

Prerequis : Node 22.20.0, pnpm 9.15.0, Docker Desktop, Postgres 17 + Redis 7 + Kafka 3.7 lances localement (voir `infrastructure/docker/docker-compose.dev.yml`).

```bash
cd repo
pnpm install --frozen-lockfile
cp apps/api/.env.example apps/api/.env
# Editer .env avec vos secrets (JWT_SECRET, PASSWORD_PEPPER, S3_*, etc.)
pnpm --filter @insurtech/api dev
```

L'API demarre sur `http://localhost:4000`.

## Endpoints disponibles (Sprint 3 Tache 1.3.1)

- `GET /` retourne `{ name, version, env, uptime_seconds, timestamp }`.

## Endpoints prevus (Sprint 3 Taches 1.3.2 a 1.3.15)

- `GET /healthz` liveness probe (Tache 1.3.10).
- `GET /readyz` readiness probe (Tache 1.3.10).
- `GET /docs` Swagger UI (Tache 1.3.9).
- `GET /metrics` Prometheus (Tache 1.3.10).

## Tests

```bash
pnpm --filter @insurtech/api test
pnpm --filter @insurtech/api test:e2e
```

## Build prod

```bash
pnpm --filter @insurtech/api build
docker build -f apps/api/Dockerfile -t insurtech-api:0.1.0 .
docker run -p 4000:4000 --env-file apps/api/.env insurtech-api:0.1.0
```

## Variables environnement

Voir `.env.example` pour la liste complete des 40+ variables.

Variables requises (sans defaut) :
- `DATABASE_URL` : PostgreSQL connection string
- `REDIS_URL` : Redis connection string
- `KAFKA_BROKERS` : CSV broker list
- `S3_ACCESS_KEY_ID` : >= 8 chars
- `S3_SECRET_ACCESS_KEY` : >= 20 chars
- `JWT_SECRET` : >= 32 chars
- `JWT_REFRESH_SECRET` : >= 32 chars
- `MFA_SECRET_ENCRYPTION_KEY` : >= 32 chars
- `PASSWORD_PEPPER` : >= 16 chars

## Conventions

- Aucune emoji (decision-006).
- Pino logger uniquement (jamais console.log).
- Zod validation uniquement (jamais class-validator).
- Argon2id (jamais bcrypt) -- Sprint 5.
- pnpm uniquement (jamais npm/yarn).
- Multi-tenant : tenant_id + RLS sur toutes les tables -- Sprint 6.

## Reference

- B-03 Sprint 3 API Bootstrap : `00-pilotage/meta-prompts/B-03-sprint-03-api-bootstrap.md`.
- decision-003 NestJS Fastify : `00-pilotage/decisions/003-framework-backend-nestjs.md`.
- decision-006 No-emoji : `00-pilotage/decisions/006-no-emoji-policy.md`.
