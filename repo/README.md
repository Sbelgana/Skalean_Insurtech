# Skalean InsurTech v2.2

Plateforme InsurTech Marocaine -- 9 apps + 23 packages monorepo (pnpm + Turborepo).

## Stack technique

- **Runtime** : Node.js 22.20 LTS, TypeScript 5.7 strict
- **Backend** : NestJS 10.4 + Fastify, TypeORM 0.3, Postgres 16, Redis 7.4, Kafka 3.7 KRaft
- **Frontend** : Next.js 15, React 18, Tailwind CSS, shadcn/ui
- **Infrastructure** : Docker Compose (dev), Atlas Cloud Services Benguerir (prod)
- **Tests** : Vitest 2.1 + Playwright 1.49
- **Tooling** : pnpm 9.15 + Turborepo 2.4 + Biome 1.9 + Husky 9

## Quick start (5 commandes)

```bash
git clone git@github.com:skalean-insurtech/insurtech.git
cd insurtech/repo
pnpm install --frozen-lockfile     # 60-90s
pnpm docker:up                     # demarre 7 services en background
pnpm dev                           # lance toutes les apps en parallele
```

URLs accessibles :
- API : http://localhost:4000
- Web Broker : http://localhost:3001
- Web Garage : http://localhost:3002
- Customer Portal : http://localhost:3004
- Mailhog UI : http://localhost:8025
- Kafka UI : http://localhost:8080
- MinIO console : http://localhost:9001

## Documentation

- Architecture : `docs/architecture/`
- ADRs : `docs/architecture/ADR-*.md`
- API : `docs/api/`
- Conventions : `CONTRIBUTING.md`
- IA assistantes : `CLAUDE.md`

## Conformite

Programme conforme :
- Loi 09-08 CNDP (data residency Maroc)
- Loi 17-99 ACAPS (assurances)
- Loi 43-20 (signature electronique)
- Decret 2-09-165 (TZ Africa/Casablanca)

## Licence

Proprietary -- Skalean SARL. Voir `LICENSE`.
