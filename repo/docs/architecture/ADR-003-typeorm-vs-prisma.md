# ADR-003 : TypeORM 0.3 retenu (vs Prisma 6)

**Date** : 2026-01-15
**Statut** : Acceptee
**Decideurs** : Saad Belgana (CTO)
**Mirror** : `00-pilotage/decisions/003-typeorm-vs-prisma.md`

## Contexte

ORM choix critique pour maintenance + features + perf. Options :
- Prisma 6 (modern DX, schema declaratif)
- TypeORM 0.3 (mature, decorators)
- Drizzle ORM (TS-first, leger)
- Knex.js (query builder, no ORM)

## Decision

**TypeORM 0.3.20 retenu**.

Raisons cles :
1. **RLS Postgres natif** : TypeORM permet `SET LOCAL app.current_tenant_id` via QueryRunner. Prisma genere son propre SQL pas RLS-friendly facilement.
2. **Subscriber pattern** : Sprint 2 implemente TenantIdInjectorSubscriber + AuditLogWriterSubscriber automatiques. Prisma n'a pas equivalent natif.
3. **Decorators NestJS-friendly** : alignement avec NestJS 10.4 ecosystem
4. **Migrations versionnees** : standard, ecosystem mature

Configuration cle :
- `synchronize: false` STRICT (jamais auto-create schema)
- `useDefineForClassFields: false` (decorateurs TypeScript experimentaux)
- Pool min 2 max 20 dev, scale prod

## Consequences

### Positives (+)
- RLS Postgres support complet
- Subscriber pattern automate cross-cutting concerns
- Migrations CLI mature
- TypeScript decorators familiar NestJS

### Negatives (-)
- API plus verbose que Prisma
- Schema dans entities (pas fichier .prisma centralise)
- Performance legerement moindre que Prisma pour cas simples

## References

- decision-003 (mirror)
- Sprint 1 (B-01) Tache 1.1.9 : DataSource singleton
- Sprint 2 (B-02) : Entites + migrations + Subscribers
